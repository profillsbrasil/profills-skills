#!/usr/bin/env node
// extracao.test.js: roda os dois blocos JS de references/navegacao.md ("## Ordenar por Recentes (JS)" e
// "## Extração (JS)") contra um DOM de fixture, em dois ambientes: o comum (escopo da página, como no Claude in
// Chrome) e o do Codex Desktop (escopo só de leitura).
// Uso: node plugins/profills/skills/profills-garimpo/scripts/extracao.test.js [navegacao.md]   (Node >= 18, sem dependência)
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

function bloco(titulo) {
  const secao = fs.readFileSync(NAVEGACAO, 'utf8').split(/^## /m).find((s) => s.startsWith(`${titulo}\n`));
  const m = secao && secao.match(/```js\n([\s\S]*?)\n```/);
  if (!m) throw new Error(`bloco \`\`\`js de "## ${titulo}" não achado em navegacao.md`);
  return m[1];
}

// O que existe no escopo em que o Codex Desktop roda JavaScript na página (page.playwright.evaluate, "read-only
// page scope"), medido por sonda em 2026-11-26. Faltam lá, entre outros: parseFloat, parseInt, BigInt, Uint8Array,
// atob e globalThis. O bloco roda aqui só com esta lista, para um global novo quebrar no teste e não no Codex.
const GLOBAIS_DO_CODEX = ['Number', 'Math', 'Date', 'JSON', 'String', 'Array', 'Object', 'RegExp', 'Set', 'Map',
  'isNaN', 'setTimeout', 'Promise', 'console', 'window', 'document'];

// Os dois ambientes. No Codex, medido em 2026-11-26: só os GLOBAIS_DO_CODEX, `window` não aceita propriedade nova
// ("Cannot add property __garimpo, object is not extensible", a mensagem do V8 em modo estrito, por isso o bloco
// roda estrito aqui) e os elementos não têm `click`. No comum, os globais do Node, `window` gravável e `click`.
const AMBIENTES = {
  comum: { estrito: false, soGlobaisDoCodex: false, window: () => ({}), clica: true },
  codex: { estrito: true, soGlobaisDoCodex: true, window: () => Object.preventExtensions({}), clica: false },
};

// As esperas dos blocos não importam no DOM de fixture, que muda na hora do clique.
const semEspera = (fn) => { setImmediate(fn); };

async function roda(js, body, nome) {
  const amb = AMBIENTES[nome];
  const window = amb.window();
  const ctx = vm.createContext({ document: { body, querySelectorAll: (s) => body.querySelectorAll(s) }, window, setTimeout: semEspera });
  if (amb.soGlobaisDoCodex) {
    vm.runInContext(
      `(() => { const fica = new Set(${JSON.stringify(GLOBAIS_DO_CODEX)});
        for (const nome of Object.getOwnPropertyNames(globalThis)) if (!fica.has(nome)) { try { delete globalThis[nome]; } catch (e) {} } })()`,
      ctx,
    );
  }
  const retorno = await vm.runInContext(`(async () => { ${amb.estrito ? "'use strict';" : ''} return ${js}; })()`, ctx);
  return JSON.parse(JSON.stringify({ retorno, completos: window.__garimpo }));
}

const comTextos = (lista) => {
  const js = bloco('Extração (JS)');
  const linha = 'const TEXTOS = [];';
  if (!js.includes(linha)) throw new Error(`a linha "${linha}" não está no bloco de extração`);
  return js.replace(linha, `const TEXTOS = ${JSON.stringify(lista)};`);
};

const extrai = (body, ambiente = 'comum', textos = []) => roda(textos.length ? comTextos(textos) : bloco('Extração (JS)'), body, ambiente);

// Os outros blocos ```js do navegacao.md não têm DOM de fixture: confere-se ao menos que não citam o que falta lá.
const FALTAM_NO_CODEX = /\b(parseFloat|parseInt|BigInt|Uint8Array|atob|globalThis|Boolean)\b|\b\d+n\b/;
for (const [, js] of fs.readFileSync(NAVEGACAO, 'utf8').matchAll(/```js\n([\s\S]*?)\n```/g)) {
  const achado = js.match(FALTAM_NO_CODEX);
  assert.ok(!achado, `bloco js do navegacao.md usa ${achado && achado[0]}, que o escopo do Codex Desktop não tem`);
}

function paginaOrdenacao(rotulo, ambiente) {
  const acoes = new WeakMap();
  const liga = (el, fn) => {
    acoes.set(el, fn);
    if (AMBIENTES[ambiente].clica) el.click = fn;
    return el;
  };
  const poe = (pai, ...filhos) => filhos.forEach((f) => { f.parentElement = pai; pai.nodes.push(f); });
  const gatilho = h('button', {}, `Classificar por: ${rotulo}`);
  const menu = h('div', {});
  liga(gatilho, () => {
    if (menu.nodes.length) return;
    const recentes = liga(h('div', { role: 'option' }, 'Recentes'), () => {
      gatilho.nodes = ['Classificar por: Recentes'];
      menu.nodes = [];
    });
    poe(menu, h('div', { role: 'option' }, rotulo), recentes);
  });
  const body = h('body', {}, h('div', {}, gatilho), menu, h('div', {}, h('div', { role: 'menuitem' }, 'Velocidade')));
  // O clique da ferramenta do navegador, fora do JS: acha o elemento pelo papel e pelo texto, como na árvore de acessibilidade.
  const clicaPelaFerramenta = ({ papel, texto }) => {
    const el = body.descendentes().find((e) => (e.getAttribute('role') || e.tag) === papel && e.innerText.trim() === texto);
    if (!el || !acoes.has(el)) throw new Error(`a ferramenta não achou ${papel} "${texto}" para clicar`);
    acoes.get(el)();
  };
  return { body, gatilho, clicaPelaFerramenta };
}

const ordena = (body, ambiente) => roda(bloco('Ordenar por Recentes (JS)'), body, ambiente).then((r) => r.retorno);

// Lê como o agente lê, pelo caminho que o `escopo` do retorno indica: o texto inteiro de cada post sai de
// window.__garimpo (escopo gravável) ou do bloco rodado de novo com TEXTOS (escopo só de leitura), em pedaços.
async function le(body, ambiente) {
  const { retorno, completos } = await extrai(body, ambiente);
  let pedacos;
  if (retorno.escopo === 'gravavel') {
    pedacos = retorno.posts.map((p) => completos[p.n - 1].texto.match(/[\s\S]{1,850}/g) || []);
  } else if (retorno.escopo === 'so_leitura') {
    const { retorno: r2 } = await extrai(body, ambiente, retorno.posts.map((p) => p.n));
    assert.deepStrictEqual(r2.textos.map((t) => t.id), retorno.posts.map((p) => p.id), 'TEXTOS devolve os mesmos posts do resumo');
    pedacos = r2.textos.map((t) => t.pedacos);
  } else {
    throw new Error(`escopo inesperado no retorno: ${JSON.stringify(retorno.escopo)}`);
  }
  pedacos.flat().forEach((pd) => assert.ok(pd.length <= 850, `pedaço de ${pd.length} caracteres`));
  const textos = pedacos.map((ps) => ps.join(''));
  textos.forEach((t, i) => assert.strictEqual(t.length, retorno.posts[i].texto_chars, `post ${i + 1}: pedaços somam texto_chars`));
  return { retorno, textos, completos };
}

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });
const nosDois = (nome, fn) => Object.keys(AMBIENTES).forEach((amb) => caso(`${amb}: ${nome}`, () => fn(amb)));

caso('codex: a extração roda até o fim no escopo só de leitura e diz escopo so_leitura', async () => {
  const { retorno } = await extrai(paginaComponentkey().body, 'codex');
  assert.strictEqual(retorno.escopo, 'so_leitura');
  assert.strictEqual(retorno.posts.length, 2);
});

caso('comum: a extração guarda os posts em window.__garimpo e diz escopo gravavel', async () => {
  const pagina = paginaComponentkey();
  const { retorno, completos } = await extrai(pagina.body, 'comum');
  assert.strictEqual(retorno.escopo, 'gravavel');
  assert.deepStrictEqual(completos.map((p) => p.id), pagina.ids);
});

nosDois('TEXTOS devolve o texto inteiro do post pedido, em pedaços de até 850, sem estado guardado', async (amb) => {
  const id = idDoDia('2026-11-09T12:00:00Z');
  const longo = Array.from({ length: 40 }, (_, k) => `Frase ${k + 1} de um post comprido sobre a linha de produção.`).join(' ');
  const body = h('body', {}, cardNovo({
    id, data: 'há 1 d', linhas: [longo],
    grupos: [grupo(ICONE.likes, 1), grupo(ICONE.comentarios, 2), grupo(ICONE.reposts, 3)],
  }));
  const { retorno } = await extrai(body, amb, [1]);
  const [t] = retorno.textos;
  console.log('  pedaços:', t.pedacos.map((pd) => pd.length).join(' + '), '=', t.texto_chars);
  assert.strictEqual(t.n, 1);
  assert.strictEqual(t.id.replace(/_/g, ''), id);
  assert.strictEqual(t.pedacos.join(''), longo);
  assert.ok(t.pedacos.length > 1 && t.pedacos.every((pd) => pd.length <= 850));
  assert.strictEqual(retorno.posts, undefined, 'com TEXTOS o retorno traz só os textos');
});

nosDois('componentkey: linha só de número no meio do texto não corta o post', async (amb) => {
  const { retorno, textos } = await le(paginaComponentkey().body, amb);
  console.log('  post 1 texto:', JSON.stringify(textos[0]), '| texto_cortado:', retorno.posts[0].texto_cortado);
  assert.strictEqual(textos[0], 'Nosso balanço de\n2026\nem três pontos:\n1.\nA linha nova entrou em produção.');
  assert.strictEqual(retorno.posts[0].texto_cortado, false);
});

nosDois('componentkey: contadores perto do ícone continuam certos e o 0 da tela fica 0 sem aviso', async (amb) => {
  const { retorno } = await extrai(paginaComponentkey().body, amb);
  const p = retorno.posts[0];
  assert.deepStrictEqual({ likes: p.likes, comentarios: p.comentarios, reposts: p.reposts }, { likes: 12, comentarios: 3, reposts: 0 });
  assert.ok(!retorno.avisos.some((a) => a.startsWith('post 1')), `post 1 não deveria ter aviso: ${retorno.avisos}`);
});

nosDois('componentkey: número longe do ícone é lido e ícone ausente vira aviso, não 0', async (amb) => {
  const { retorno } = await extrai(paginaComponentkey().body, amb);
  const p = retorno.posts[1];
  assert.strictEqual(p.likes, 5);
  assert.strictEqual(p.comentarios, 7, 'número a 3 níveis do ícone');
  assert.strictEqual(p.reposts, null, 'ícone ausente não vira 0');
  assert.ok(retorno.avisos.some((a) => /^post 2: contador de reposts não achado/.test(a)), 'aviso do contador ausente');
});

nosDois('componentkey: texto do segundo post, ids e conta de cards', async (amb) => {
  const pagina = paginaComponentkey();
  const { retorno, textos } = await le(pagina.body, amb);
  assert.strictEqual(textos[1], 'Visita técnica na fábrica.');
  assert.deepStrictEqual(retorno.posts.map((p) => p.id.replace(/_/g, '')), pagina.ids);
  assert.strictEqual(retorno.estrutura, 'componentkey');
  assert.strictEqual(retorno.cards, 2);
  assert.strictEqual(retorno.seguidores, 12400);
});

nosDois('componentkey: card com "… mais" sai com texto_cortado e o trecho antes dele', async (amb) => {
  const id = idDoDia('2026-11-09T12:00:00Z');
  const body = h('body', {}, cardNovo({
    id, data: 'há 1 d', mais: true,
    linhas: ['Começo do post', '3', 'passos para a linha'],
    grupos: [grupo(ICONE.likes, '1,2 mil'), grupo(ICONE.comentarios, 40), grupo(ICONE.reposts, 9)],
  }));
  const { retorno, textos } = await le(body, amb);
  const p = retorno.posts[0];
  assert.strictEqual(textos[0], 'Começo do post\n3\npassos para a linha');
  assert.strictEqual(p.texto_cortado, true);
  assert.deepStrictEqual([p.likes, p.comentarios, p.reposts], [1200, 40, 9]);
  assert.deepStrictEqual(retorno.avisos, []);
});

nosDois('data-urn: retorno igual ao de antes', async (amb) => {
  const pagina = paginaDataUrn();
  const { retorno, textos } = await le(pagina.body, amb);
  assert.strictEqual(retorno.estrutura, 'data-urn');
  assert.deepStrictEqual(retorno.avisos, []);
  assert.strictEqual(retorno.seguidores, 6000);
  assert.strictEqual(retorno.seguidores_arredondado, true);
  const p = retorno.posts[0];
  assert.deepStrictEqual(
    { id: p.id.replace(/_/g, ''), dataRel: p.dataRel, formato: p.formato, texto: textos[0], texto_cortado: p.texto_cortado, hashtags: p.hashtags, likes: p.likes, comentarios: p.comentarios, reposts: p.reposts },
    { id: pagina.ids[0], dataRel: '3 d', formato: 'imagem', texto: 'Balanço de\n2026\nfechado.\n#industria', texto_cortado: false, hashtags: ['#industria'], likes: 45, comentarios: 6, reposts: 2 },
  );
});

nosDois('ordenação: já em Recentes, devolve ok sem clicar', async (amb) => {
  const { body } = paginaOrdenacao('Recentes', amb);
  const r = await ordena(body, amb);
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.depois, 'Classificar por: Recentes');
  assert.strictEqual(r.clicar, undefined);
});

caso('comum: ordenação clica sozinha de Populares para Recentes', async () => {
  const { body, gatilho } = paginaOrdenacao('Populares', 'comum');
  const r = await ordena(body, 'comum');
  console.log('  retorno:', JSON.stringify(r));
  assert.deepStrictEqual(r, { ok: true, antes: 'Classificar por: Populares', depois: 'Classificar por: Recentes', abriu_com: 'click' });
  assert.strictEqual(gatilho.innerText, 'Classificar por: Recentes');
});

caso('codex: ordenação sem click no elemento pede os dois cliques à ferramenta e confere o rótulo', async () => {
  const { body, gatilho, clicaPelaFerramenta } = paginaOrdenacao('Populares', 'codex');
  const passos = [];
  for (let rodada = 0; rodada < 4; rodada += 1) {
    const r = await ordena(body, 'codex');
    passos.push(r);
    if (!r.clicar) break;
    clicaPelaFerramenta(r.clicar);
  }
  console.log('  rodadas:', JSON.stringify(passos));
  assert.deepStrictEqual(passos.map((r) => r.clicar || null), [
    { passo: 'abrir o menu', papel: 'button', texto: 'Classificar por: Populares' },
    { passo: 'escolher Recentes', papel: 'option', texto: 'Recentes' },
    null,
  ]);
  assert.strictEqual(passos[0].ok, false);
  assert.strictEqual(passos[2].ok, true);
  assert.strictEqual(passos[2].depois, 'Classificar por: Recentes');
  assert.strictEqual(gatilho.innerText, 'Classificar por: Recentes');
});

(async () => {
  let falhas = 0;
  for (const { nome, fn } of casos) {
    try {
      await fn();
      console.log(`ok: ${nome}`);
    } catch (e) {
      falhas += 1;
      console.log(`FALHA: ${nome}\n  ${(e.stack && e.name !== 'AssertionError' ? `${e.name}: ${e.message}` : e.message).split('\n').join('\n  ')}`);
    }
  }
  console.log(`${casos.length - falhas} de ${casos.length} casos passaram`);
  process.exit(falhas ? 1 : 0);
})();
