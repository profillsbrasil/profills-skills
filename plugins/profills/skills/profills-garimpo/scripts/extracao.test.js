#!/usr/bin/env node
// extracao.test.js: roda o JS de "## Extração (JS)" de references/navegacao.md contra um DOM de fixture.
// Uso: node skills/profills-garimpo/scripts/extracao.test.js [navegacao.md]   (Node >= 18, sem dependência)
// O DOM é sintético, montado a partir da descrição das duas estruturas no navegacao.md, não copiado de página real.
// O innerText aqui é aproximado: elemento de bloco quebra linha, inline emenda, <br> quebra linha.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const NAVEGACAO = process.argv[2] || path.join(__dirname, '..', 'references', 'navegacao.md');

const BLOCO = new Set(['body', 'div', 'p', 'li', 'ul', 'section', 'article', 'header', 'footer']);
const QUEBRA = '\u0000';

class El {
  constructor(tag, attrs, nodes) {
    this.tag = tag;
    this.attrs = attrs || {};
    this.nodes = [];
    this.parentElement = null;
    nodes.flat().filter((n) => n !== null && n !== undefined && n !== false).forEach((n) => {
      if (n instanceof El) n.parentElement = this;
      this.nodes.push(n);
    });
  }

  get children() { return this.nodes.filter((n) => n instanceof El); }
  get textContent() { return this.nodes.map((n) => (n instanceof El ? n.textContent : n)).join(''); }
  get innerText() {
    return renderiza(this).replace(new RegExp(`^${QUEBRA}+|${QUEBRA}+$`, 'g'), '').replace(new RegExp(`${QUEBRA}+`, 'g'), '\n');
  }
  get width() { return Number(this.attrs.width) || 0; }
  get href() { return this.attrs.href; }
  getAttribute(nome) { return nome in this.attrs ? String(this.attrs[nome]) : null; }
  contains(outro) {
    for (let no = outro; no; no = no.parentElement) if (no === this) return true;
    return false;
  }
  descendentes() { return this.children.flatMap((c) => [c, ...c.descendentes()]); }
  querySelectorAll(seletor) {
    const lista = seletor.split(',').map(analisa);
    return this.descendentes().filter((e) => lista.some((s) => casa(e, s)));
  }
  querySelector(seletor) { return this.querySelectorAll(seletor)[0] || null; }
  closest(seletor) {
    const lista = seletor.split(',').map(analisa);
    for (let no = this; no; no = no.parentElement) if (lista.some((s) => casa(no, s))) return no;
    return null;
  }
}

function renderiza(n) {
  if (!(n instanceof El)) return n;
  if (n.tag === 'br') return '\n';
  const dentro = n.nodes.map(renderiza).join('');
  return BLOCO.has(n.tag) ? `${QUEBRA}${dentro}${QUEBRA}` : dentro;
}

function analisa(seletor) {
  return seletor.trim().split(/\s+/).map((parte) => {
    const comp = { tag: null, classes: [], attrs: [] };
    const re = /(\*|[a-z][a-z0-9]*)|\.([\w-]+)|\[([\w-]+)(?:([\^*]?=)(?:"([^"]*)"|([^\]]*)))?\]/giy;
    let m;
    while (re.lastIndex < parte.length && (m = re.exec(parte))) {
      if (m[1]) comp.tag = m[1] === '*' ? null : m[1].toLowerCase();
      else if (m[2]) comp.classes.push(m[2]);
      else comp.attrs.push({ nome: m[3], op: m[4] || null, valor: m[5] !== undefined ? m[5] : m[6] });
    }
    if (re.lastIndex !== parte.length) throw new Error(`seletor que o DOM de teste não entende: ${parte}`);
    return comp;
  });
}

function casaComposto(e, comp) {
  if (comp.tag && e.tag !== comp.tag) return false;
  const classes = (e.attrs.class || '').split(/\s+/);
  if (!comp.classes.every((c) => classes.includes(c))) return false;
  return comp.attrs.every(({ nome, op, valor }) => {
    const v = e.getAttribute(nome);
    if (v === null) return false;
    if (!op) return true;
    if (op === '=') return v === valor;
    if (op === '^=') return v.startsWith(valor);
    return v.includes(valor);
  });
}

function casa(e, partes) {
  if (!casaComposto(e, partes[partes.length - 1])) return false;
  let no = e.parentElement;
  for (let i = partes.length - 2; i >= 0; i -= 1) {
    while (no && !casaComposto(no, partes[i])) no = no.parentElement;
    if (!no) return false;
    no = no.parentElement;
  }
  return true;
}

const h = (tag, attrs, ...nodes) => new El(tag, attrs, nodes);

function idDoDia(iso) {
  return (BigInt(Date.parse(iso)) << 22n).toString();
}

function chaveDoId(id, tipo = 0x0a) {
  let v = BigInt(id) << 1n;
  const varint = [];
  do {
    let b = Number(v & 0x7fn);
    v >>= 7n;
    if (v) b |= 0x80;
    varint.push(b);
  } while (v);
  const bytes = Buffer.from([tipo, varint.length + 1, 0x08, ...varint]);
  return `${bytes.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}-replaceableCommentTools-0`;
}

const ICONE = {
  likes: 'thumbs-up-outline-feed-compact',
  comentarios: 'comment-outline-feed-compact',
  reposts: 'arrows-swap-outline-feed-compact',
};

function grupo(icone, valor, fundo = false) {
  const svg = h('svg', { id: icone });
  if (fundo) return h('div', {}, h('button', {}, h('span', {}, svg)), h('div', {}, h('span', {}, String(valor))));
  return h('div', {}, h('button', {}, svg, valor === null ? null : h('span', {}, String(valor))));
}

function cardNovo({ id, data, linhas, mais = false, grupos }) {
  return h('div', { role: 'listitem', componentkey: `update-card-focus-${id}` },
    h('div', {}, h('div', {}, 'Empresa Exemplo'), h('div', {}, '12.400 seguidores'), h('div', {}, data)),
    h('div', {}, ...linhas.flatMap((l, i) => (i ? [h('br', {}), l] : [l]))),
    mais ? h('div', {}, h('button', {}, '… mais')) : null,
    h('div', {}, ...grupos),
    h('div', { componentkey: chaveDoId(id) }, h('div', {}, 'Comentar como Empresa Exemplo')));
}

function paginaComponentkey() {
  const id1 = idDoDia('2026-11-08T12:00:00Z');
  const id2 = idDoDia('2026-11-05T12:00:00Z');
  return {
    ids: [id1, id2],
    body: h('body', {},
      h('div', {}, 'Empresa Exemplo'), h('div', {}, '12.400 seguidores'),
      cardNovo({
        id: id1, data: 'há 2 d',
        linhas: ['Nosso balanço de', '2026', 'em três pontos:', '1.', 'A linha nova entrou em produção.'],
        grupos: [grupo(ICONE.likes, 12), grupo(ICONE.comentarios, 3), grupo(ICONE.reposts, null)],
      }),
      cardNovo({
        id: id2, data: 'há 5 d',
        linhas: ['Visita técnica na fábrica.'],
        grupos: [grupo(ICONE.likes, 5), grupo(ICONE.comentarios, 7, true)],
      })),
  };
}

function paginaDataUrn() {
  const id = idDoDia('2026-11-07T12:00:00Z');
  return {
    ids: [id],
    body: h('body', {},
      h('div', {}, '6 mil seguidores'),
      h('div', { class: 'occludable-update' },
        h('div', { 'data-urn': `urn:li:activity:${id}` },
          h('div', { class: 'update-components-actor__sub-description' }, '3 d • Editado'),
          h('div', { class: 'update-components-text' }, 'Balanço de', h('br', {}), '2026', h('br', {}), 'fechado.', h('br', {}),
            h('a', { href: 'https://www.linkedin.com/feed/hashtag/industria' }, 'hashtag', h('br', {}), '#industria')),
          h('div', { class: 'update-components-image' }, h('img', { width: 600 })),
          h('div', { class: 'social-details-social-counts' },
            h('span', {}, '45'), ' ', h('span', {}, '6 comentários'), ' ', h('span', {}, '2 compartilhamentos'))))),
  };
}

function blocoDeExtracao() {
  const md = fs.readFileSync(NAVEGACAO, 'utf8');
  const m = md.match(/## Extração \(JS\)\s*```js\n([\s\S]*?)\n```/);
  if (!m) throw new Error('bloco ```js de "## Extração (JS)" não achado em navegacao.md');
  return m[1];
}

function extrai(body) {
  const window = {};
  const ctx = vm.createContext({ document: { body, querySelectorAll: (s) => body.querySelectorAll(s) }, window, atob });
  const retorno = vm.runInContext(blocoDeExtracao(), ctx);
  return JSON.parse(JSON.stringify({ retorno, completos: window.__garimpo }));
}

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso('componentkey: linha só de número no meio do texto não corta o post', () => {
  const { completos, retorno } = extrai(paginaComponentkey().body);
  console.log('  post 1 texto:', JSON.stringify(completos[0].texto), '| texto_cortado:', completos[0].texto_cortado);
  assert.strictEqual(completos[0].texto, 'Nosso balanço de\n2026\nem três pontos:\n1.\nA linha nova entrou em produção.');
  assert.strictEqual(retorno.posts[0].texto_cortado, false);
});

caso('componentkey: contadores perto do ícone continuam certos e o 0 da tela fica 0 sem aviso', () => {
  const { retorno } = extrai(paginaComponentkey().body);
  const p = retorno.posts[0];
  console.log('  post 1 contadores:', JSON.stringify({ likes: p.likes, comentarios: p.comentarios, reposts: p.reposts }));
  assert.deepStrictEqual({ likes: p.likes, comentarios: p.comentarios, reposts: p.reposts }, { likes: 12, comentarios: 3, reposts: 0 });
  assert.ok(!retorno.avisos.some((a) => a.startsWith('post 1')), `post 1 não deveria ter aviso: ${retorno.avisos}`);
});

caso('componentkey: número longe do ícone é lido e ícone ausente vira aviso, não 0', () => {
  const { retorno } = extrai(paginaComponentkey().body);
  const p = retorno.posts[1];
  console.log('  post 2 contadores:', JSON.stringify({ likes: p.likes, comentarios: p.comentarios, reposts: p.reposts }), '| avisos:', JSON.stringify(retorno.avisos));
  assert.strictEqual(p.likes, 5);
  assert.strictEqual(p.comentarios, 7, 'número a 3 níveis do ícone');
  assert.strictEqual(p.reposts, null, 'ícone ausente não vira 0');
  assert.ok(retorno.avisos.some((a) => /^post 2: contador de reposts não achado/.test(a)), 'aviso do contador ausente');
});

caso('componentkey: texto do segundo post, ids e conta de cards', () => {
  const pagina = paginaComponentkey();
  const { completos, retorno } = extrai(pagina.body);
  assert.strictEqual(completos[1].texto, 'Visita técnica na fábrica.');
  assert.deepStrictEqual(completos.map((p) => p.id), pagina.ids);
  assert.strictEqual(retorno.estrutura, 'componentkey');
  assert.strictEqual(retorno.cards, 2);
  assert.strictEqual(retorno.seguidores, 12400);
});

caso('componentkey: card com "… mais" sai com texto_cortado e o trecho antes dele', () => {
  const id = idDoDia('2026-11-09T12:00:00Z');
  const body = h('body', {}, cardNovo({
    id, data: 'há 1 d', mais: true,
    linhas: ['Começo do post', '3', 'passos para a linha'],
    grupos: [grupo(ICONE.likes, '1,2 mil'), grupo(ICONE.comentarios, 40), grupo(ICONE.reposts, 9)],
  }));
  const { completos, retorno } = extrai(body);
  assert.strictEqual(completos[0].texto, 'Começo do post\n3\npassos para a linha');
  assert.strictEqual(completos[0].texto_cortado, true);
  assert.deepStrictEqual([completos[0].likes, completos[0].comentarios, completos[0].reposts], [1200, 40, 9]);
  assert.deepStrictEqual(retorno.avisos, []);
});

caso('data-urn: retorno igual ao de antes', () => {
  const pagina = paginaDataUrn();
  const { completos, retorno } = extrai(pagina.body);
  assert.strictEqual(retorno.estrutura, 'data-urn');
  assert.deepStrictEqual(retorno.avisos, []);
  assert.strictEqual(retorno.seguidores, 6000);
  assert.strictEqual(retorno.seguidores_arredondado, true);
  const p = completos[0];
  assert.deepStrictEqual(
    { id: p.id, dataRel: p.dataRel, formato: p.formato, texto: p.texto, texto_cortado: p.texto_cortado, hashtags: p.hashtags, likes: p.likes, comentarios: p.comentarios, reposts: p.reposts },
    { id: pagina.ids[0], dataRel: '3 d', formato: 'imagem', texto: 'Balanço de\n2026\nfechado.\n#industria', texto_cortado: false, hashtags: ['#industria'], likes: 45, comentarios: 6, reposts: 2 },
  );
});

let falhas = 0;
for (const { nome, fn } of casos) {
  try {
    fn();
    console.log(`ok: ${nome}`);
  } catch (e) {
    falhas += 1;
    console.log(`FALHA: ${nome}\n  ${e.message.split('\n').join('\n  ')}`);
  }
}
console.log(`${casos.length - falhas} de ${casos.length} casos passaram`);
process.exit(falhas ? 1 : 0);
