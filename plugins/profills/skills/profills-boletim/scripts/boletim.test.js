#!/usr/bin/env node
// boletim.test.js — casos do boletim.js, rodados pelo terminal como a skill roda.
// Uso: node plugins/profills/skills/profills-boletim/scripts/boletim.test.js   (Node >= 18, sem dependência)
// Cada caso monta uma pasta de dados temporária com empresas fictícias, roda boletim.js como processo e confere o JSON.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BOLETIM = path.join(__dirname, 'boletim.js');
const HOJE = '2026-08-24';

const linha = (nome, slug, { prioridade = 'Alta', linkedin = 'sim', instagram = '—' } = {}) =>
  `- [${nome}](${slug}.md) — \`${slug}\` · id — · setor envase · país BR · prioridade ${prioridade} · linkedin ${linkedin} · instagram ${instagram} · pesquisa 2026-08-01`;

// Uma empresa da seleção: o slug só (coleta o LinkedIn) ou { slug, linkedin, instagram, semRedes }, que diz as redes
// da linha. semRedes escreve a linha do formato anterior, sem campo de rede.
function linhaDaSelecao(s) {
  const { slug, linkedin = true, instagram = null, semRedes = false } = typeof s === 'string' ? { slug: s } : s;
  const redes = semRedes ? [] : [linkedin && `linkedin \`${slug}\``, instagram && `instagram \`${instagram}\``].filter(Boolean);
  return [`- [${slug}](refs/${slug}.md) — \`${slug}\` · id — · envase · BR`, ...redes].join(' · ');
}

function montar({ empresas, selecao, rodada = HOJE, catalog = true, boletins = [] }) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'boletim-test-'));
  fs.mkdirSync(path.join(dados, 'refs'), { recursive: true });
  fs.mkdirSync(path.join(dados, 'boletins'), { recursive: true });
  for (const d of boletins) fs.writeFileSync(path.join(dados, 'boletins', `${d}.md`), '# Boletim\n');
  if (catalog) fs.mkdirSync(path.join(dados, 'catalog', 'raw', 'linkedin'), { recursive: true });
  fs.writeFileSync(path.join(dados, 'refs', 'INDEX.md'), ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', '', ...empresas.map((e) => linha(...e)), ''].join('\n'));
  for (const [nome, slug] of empresas) fs.writeFileSync(path.join(dados, 'refs', `${slug}.md`), `# ${nome}\n`);
  if (selecao) fs.writeFileSync(path.join(dados, 'selection.md'), [`# Seleção ativa — ${rodada}`, '', ...selecao.map(linhaDaSelecao), ''].join('\n'));
  return dados;
}

const post = (n, extra = {}) => ({
  post_id: `urn:li:activity:${7000 + n}`,
  url: `https://www.linkedin.com/feed/update/urn:li:activity:${7000 + n}/`,
  data: `2026-08-${String(10 + n).padStart(2, '0')}`,
  idioma: 'pt',
  resumo_pt: null,
  formato: 'imagem',
  hook: `Hook do post ${n}`,
  hook_categoria: 'question',
  angulo: 'dado',
  engajamento: { likes: 10 * n, comentarios: n, reposts: 0 },
  screenshot: null,
  ...extra,
});

const postIg = (codigo, data, extra = {}) => ({
  post_id: `ig:${codigo}`,
  url: `https://www.instagram.com/p/${codigo}/`,
  data,
  idioma: 'pt',
  resumo_pt: null,
  formato: 'reel',
  hook: `Legenda do ${codigo}`,
  hook_categoria: 'question',
  angulo: 'dado',
  engajamento: { likes: 50, comentarios: 4, reposts: 1, compartilhamentos: 7 },
  ...extra,
});

// Uma coleta de uma conta numa rede: catalog/raw/<rede>/<conta>/<data>/. No LinkedIn a conta é o slug; no Instagram
// é o handle, e o meta.json leva o slug da empresa.
function coleta(dados, conta, data, posts, meta = {}, rede = 'linkedin') {
  const pasta = path.join(dados, 'catalog', 'raw', rede, conta, data);
  fs.mkdirSync(pasta, { recursive: true });
  if (posts !== undefined) fs.writeFileSync(path.join(pasta, 'posts.json'), typeof posts === 'string' ? posts : JSON.stringify(posts, null, 2));
  if (meta === null) return;
  const n = Array.isArray(posts) ? posts.length : 0;
  fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify({ slug: conta, coletado_em: data, seguidores: 1000, janela_dias: 7, posts_coletados: n, status: 'ok', concluida: true, ...meta }, null, 2));
}
const coletaIg = (dados, slug, handle, data, posts, meta = {}) => coleta(dados, handle, data, posts, { slug, ...meta }, 'instagram');

function boletim(dados) {
  const r = spawnSync(process.execPath, [BOLETIM, dados, '--hoje', HOJE], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  assert.ok(json, `boletim.js não devolveu JSON: ${r.stderr.slice(0, 300)}`);
  return { status: r.status, json, stdout: r.stdout };
}

const empresa = (json, slug) => {
  const e = json.empresas.find((x) => x.slug === slug);
  assert.ok(e, `${slug} está em empresas[]`);
  return e;
};
// A conta de uma empresa numa rede, em empresas[].contas.
const conta = (json, slug, rede = 'linkedin') => {
  const c = empresa(json, slug).contas.find((x) => x.rede === rede);
  assert.ok(c, `${slug} tem a conta do ${rede} em contas[]`);
  return c;
};

function hashDaPasta(raiz) {
  const h = crypto.createHash('sha256');
  const andar = (dir) => {
    for (const nome of fs.readdirSync(dir).sort()) {
      const p = path.join(dir, nome);
      h.update(path.relative(raiz, p));
      if (fs.statSync(p).isDirectory()) andar(p);
      else h.update(fs.readFileSync(p));
    }
  };
  andar(raiz);
  return h.digest('hex');
}

const casos = [
  ['novidade entre duas coletas: só o post que não estava na anterior, com cadência das duas', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1), post(2)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3, { idioma: 'EN', resumo_pt: 'A empresa mostra a linha nova.' }), post(2), post(1)]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 0, 'exit 0');
    assert.strictEqual(empresa(json, 'alfa-envase').cobertura, 'com_novidade');
    const c = conta(json, 'alfa-envase');
    assert.strictEqual(c.conta, 'alfa-envase');
    assert.strictEqual(c.cobertura, 'com_novidade');
    assert.strictEqual(c.primeira_coleta, false);
    assert.deepStrictEqual(c.novos.map((p) => p.post_id), ['urn:li:activity:7003']);
    const p = c.novos[0];
    assert.strictEqual(p.idioma, 'en', 'idioma em minúscula');
    assert.strictEqual(p.estrangeiro, true);
    assert.strictEqual(p.resumo_pt, 'A empresa mostra a linha nova.');
    assert.deepStrictEqual(p.engajamento, { likes: 30, comentarios: 3, reposts: 0 });
    assert.strictEqual(p.destaque_da_coleta, true, 'o post de maior likes + comentários é o destaque do metricas.js');
    assert.strictEqual(c.coleta_anterior.data, '2026-08-17');
    assert.strictEqual(c.cadencia.anterior.n_posts, 2);
    assert.strictEqual(c.cadencia.atual.n_posts, 3);
    assert.strictEqual(typeof c.cadencia.diferenca, 'number');
    assert.deepStrictEqual(json.cobertura.com_novidade, [{ nome: 'Alfa Envase', slug: 'alfa-envase', contas: [{ rede: 'linkedin', conta: 'alfa-envase', cobertura: 'com_novidade', motivo: null, nota: null }] }]);
    assert.strictEqual(json.totais.posts_novos, 1);
  }],

  ['repetir a mesma coleta não dá novidade', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1), post(2)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)]);
    const { json } = boletim(dados);
    assert.strictEqual(empresa(json, 'alfa-envase').cobertura, 'sem_novidade');
    assert.strictEqual(empresa(json, 'alfa-envase').n_novos, 0);
    assert.strictEqual(conta(json, 'alfa-envase').cobertura, 'sem_novidade');
  }],

  ['primeira coleta: todo post da janela é novo e a saída diz que é a primeira', () => {
    const dados = montar({ empresas: [['Beta Rótulos', 'beta-rotulos']], selecao: ['beta-rotulos'] });
    coleta(dados, 'beta-rotulos', '2026-08-24', [post(1), post(2)]);
    const { json } = boletim(dados);
    assert.strictEqual(empresa(json, 'beta-rotulos').n_novos, 2);
    const c = conta(json, 'beta-rotulos');
    assert.strictEqual(c.cobertura, 'com_novidade');
    assert.strictEqual(c.primeira_coleta, true);
    assert.strictEqual(c.n_novos, 2);
    assert.strictEqual(c.cadencia, null, 'sem coleta anterior não há mudança de cadência');
    assert.deepStrictEqual(c.novos.map((p) => p.data), ['2026-08-12', '2026-08-11'], 'mais recentes primeiro');
  }],

  ['coleta indisponível: erro de navegação e posts.json quebrado caem em indisponivel', () => {
    const dados = montar({ empresas: [['Gama Tampas', 'gama-tampas'], ['Delta Selagem', 'delta-selagem']], selecao: ['gama-tampas', 'delta-selagem'] });
    coleta(dados, 'gama-tampas', '2026-08-24', undefined, { status: 'erro_navegacao', nota: 'a página não abriu', posts_coletados: 0 });
    coleta(dados, 'delta-selagem', '2026-08-24', '{ isto não é json');
    const { json } = boletim(dados);
    assert.strictEqual(empresa(json, 'gama-tampas').cobertura, 'indisponivel');
    const g = conta(json, 'gama-tampas');
    assert.strictEqual(g.cobertura, 'indisponivel');
    assert.strictEqual(g.motivo, 'erro_navegacao');
    assert.strictEqual(g.nota, 'a página não abriu');
    const d = conta(json, 'delta-selagem');
    assert.strictEqual(d.cobertura, 'indisponivel');
    assert.strictEqual(d.motivo, 'coleta_com_erro');
    assert.deepStrictEqual(json.cobertura.indisponivel.map((x) => x.nome).sort(), ['Delta Selagem', 'Gama Tampas']);
    assert.strictEqual(json.cobertura.indisponivel.find((x) => x.slug === 'gama-tampas').contas[0].motivo, 'erro_navegacao');
  }],

  ['empresa sem posts na janela é silêncio: sem_novidade, não indisponível', () => {
    const dados = montar({ empresas: [['Épsilon Dosadoras', 'epsilon-dosadoras']], selecao: ['epsilon-dosadoras'] });
    coleta(dados, 'epsilon-dosadoras', '2026-08-17', [post(1)]);
    coleta(dados, 'epsilon-dosadoras', '2026-08-24', undefined, { status: 'sem_posts', nota: 'não postou nos últimos 7 dias', posts_coletados: 0 });
    const { json } = boletim(dados);
    assert.strictEqual(empresa(json, 'epsilon-dosadoras').cobertura, 'sem_novidade');
    const c = conta(json, 'epsilon-dosadoras');
    assert.strictEqual(c.motivo, 'sem_posts');
    assert.strictEqual(c.cadencia.atual.posts_por_semana, 0);
  }],

  ['empresa sem LinkedIn nem Instagram cai em sem_rede e não conta na rodada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Zeta Caixas', 'zeta-caixas', { linkedin: 'não' }]], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    const { json } = boletim(dados);
    const z = empresa(json, 'zeta-caixas');
    assert.strictEqual(z.cobertura, 'sem_rede');
    assert.deepStrictEqual(z.contas, []);
    assert.deepStrictEqual(json.cobertura.sem_rede, [{ nome: 'Zeta Caixas', slug: 'zeta-caixas', contas: [] }]);
    assert.strictEqual(json.rodada.n_empresas, 1);
  }],

  ['empresa fora da rodada cai em fora_desta_rodada, mesmo com coleta em disco, com o último catálogo de cada conta', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Eta Filmes', 'eta-filmes', { prioridade: 'Média', instagram: 'etafilmes' }]], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coleta(dados, 'eta-filmes', '2026-08-24', [post(5)]);
    const { json } = boletim(dados);
    const e = empresa(json, 'eta-filmes');
    assert.strictEqual(e.cobertura, 'fora_desta_rodada');
    assert.deepStrictEqual(e.contas, [{ rede: 'linkedin', conta: 'eta-filmes', ultimo_catalogo: '2026-08-24' }, { rede: 'instagram', conta: 'etafilmes', ultimo_catalogo: null }], 'fora da rodada não lista posts');
    for (const balde of Object.keys(json.cobertura)) {
      const n = json.cobertura[balde].filter((x) => x.slug === 'eta-filmes').length;
      assert.strictEqual(n, balde === 'fora_desta_rodada' ? 1 : 0, `eta-filmes só em fora_desta_rodada (achado em ${balde})`);
    }
  }],

  ['post sem post_id é reconhecido pela url', () => {
    const dados = montar({ empresas: [['Teta Válvulas', 'teta-valvulas']], selecao: ['teta-valvulas'] });
    const semId = (n) => post(n, { post_id: null });
    coleta(dados, 'teta-valvulas', '2026-08-17', [semId(1)]);
    coleta(dados, 'teta-valvulas', '2026-08-24', [post(2, { post_id: null, url: 'https://www.linkedin.com/posts/teta-novo?utm_source=x' }), { ...semId(1), url: semId(1).url + '?trk=feed' }]);
    const c = conta(boletim(dados).json, 'teta-valvulas');
    assert.strictEqual(c.n_novos, 1, 'o post antigo com a mesma url, só com query diferente, não é novo');
    assert.strictEqual(c.novos[0].url, 'https://www.linkedin.com/posts/teta-novo?utm_source=x');
  }],

  ['empresa da rodada ainda não coletada aparece em faltam_coletar', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos']], selecao: ['alfa-envase', 'beta-rotulos'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coleta(dados, 'beta-rotulos', '2026-08-10', [post(1)]);
    const { json } = boletim(dados);
    assert.deepStrictEqual(json.rodada.faltam_coletar, [{ nome: 'Beta Rótulos', slug: 'beta-rotulos', rede: 'linkedin', conta: 'beta-rotulos', nota: 'última coleta em 2026-08-10, antes desta rodada' }]);
    assert.strictEqual(conta(json, 'beta-rotulos').motivo, 'nao_coletada_nesta_rodada');
  }],

  ['idempotente: duas execuções dão a mesma saída e não gravam nada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase', { instagram: 'alfaenvase' }]], selecao: [{ slug: 'alfa-envase', instagram: 'alfaenvase' }] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)]);
    coletaIg(dados, 'alfa-envase', 'alfaenvase', '2026-08-24', [postIg('AbC1', '2026-08-22')]);
    const antes = hashDaPasta(dados);
    const a = boletim(dados).stdout;
    const b = boletim(dados).stdout;
    assert.strictEqual(a, b, 'mesma saída');
    assert.strictEqual(hashDaPasta(dados), antes, 'a pasta não mudou');
  }],

  ['pasta sem catalog: a rodada inteira falta coletar, sem erro', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos']], selecao: ['alfa-envase', 'beta-rotulos'], catalog: false });
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 0, 'exit 0');
    assert.strictEqual(json.rodada.faltam_coletar.length, 2);
    assert.strictEqual(json.cobertura.indisponivel.length, 2);
    assert.strictEqual(json.totais.posts_novos, 0);
  }],

  ['sem seleção: exit 1 com selecao_ausente', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']] });
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 1);
    assert.deepStrictEqual(json.problemas.map((p) => p.tipo), ['selecao_ausente']);
  }],

  ['segunda rodada no mesmo dia: a saída avisa que o boletim do dia já existe', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    assert.strictEqual(boletim(dados).json.boletim_do_dia_existe, false);
    fs.writeFileSync(path.join(dados, 'boletins', `${HOJE}.md`), '# Boletim\n');
    const { json } = boletim(dados);
    assert.strictEqual(json.boletim_do_dia_existe, true);
    assert.strictEqual(json.arquivo_boletim, path.join('boletins', '2026-08-24.md'));
  }],
  ['post repetido na mesma coleta conta uma vez só, por post_id e pela url', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    const semId = post(4, { post_id: null });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3), post(3), semId, { ...semId, url: semId.url + '?trk=feed' }, post(1)]);
    const { json } = boletim(dados);
    const c = conta(json, 'alfa-envase');
    assert.strictEqual(c.n_novos, 2, 'o post 3 e o post 4, uma vez cada');
    assert.strictEqual(json.totais.posts_novos, 2);
    assert.strictEqual(c.coleta_atual.n_posts, 3, 'n_posts da coleta sem as repetições');
    const repetidos = json.avisos.filter((a) => a.tipo === 'post_repetido');
    assert.strictEqual(repetidos.length, 2, 'um aviso por repetição');
    assert.deepStrictEqual([repetidos[0].empresa, repetidos[0].rede], ['Alfa Envase', 'linkedin']);
  }],

  ['rodada dividida: seleção de ontem com empresa faltando pede para terminar a rodada, sem tratar as coletadas como faltando', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos', { prioridade: 'Média' }]], selecao: ['alfa-envase', 'beta-rotulos'], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-23', [post(1)]);
    coleta(dados, 'beta-rotulos', '2026-08-17', [post(2)]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 0, 'exit 0');
    assert.strictEqual(json.rodada.data, '2026-08-23');
    assert.strictEqual(json.rodada.situacao, 'anterior_por_terminar');
    assert.deepStrictEqual(json.rodada.faltam_coletar.map((x) => x.slug), ['beta-rotulos']);
    assert.deepStrictEqual(json.rodada.coletadas, [{ nome: 'Alfa Envase', rede: 'linkedin' }]);
    assert.strictEqual(json.rodada.boletim_da_rodada_existe, false);
  }],

  ['rodada dividida: a segunda sessão coleta o resto hoje e a rodada fecha sem reabrir a primeira', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos']], selecao: ['alfa-envase', 'beta-rotulos'], rodada: '2026-08-23', boletins: ['2026-08-23'] });
    coleta(dados, 'alfa-envase', '2026-08-23', [post(1)]);
    coleta(dados, 'beta-rotulos', '2026-08-24', [post(2)]);
    const { json } = boletim(dados);
    assert.deepStrictEqual(json.rodada.faltam_coletar, []);
    assert.strictEqual(json.rodada.situacao, 'anterior_com_boletim');
    assert.strictEqual(json.rodada.boletim_da_rodada_existe, true);
    assert.strictEqual(conta(json, 'alfa-envase').coleta_atual.data, '2026-08-23');
  }],

  ['rodada anterior completa e sem boletim: a situação diz isso', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-20' });
    coleta(dados, 'alfa-envase', '2026-08-20', [post(1)]);
    const { json } = boletim(dados);
    assert.strictEqual(json.rodada.situacao, 'anterior_sem_boletim');
    assert.strictEqual(json.rodada.boletim_da_rodada_existe, false);
  }],

  ['seleção de hoje: situação de_hoje', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    assert.strictEqual(boletim(dados).json.rodada.situacao, 'de_hoje');
  }],

  ['seleção com data depois de hoje: exit 1 com selecao_no_futuro', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-25' });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 1);
    assert.deepStrictEqual(json.problemas.map((p) => p.tipo), ['selecao_no_futuro']);
  }],

  ['coleta com data depois de hoje: exit 1 com coleta_no_futuro, sem mandar a empresa para a garimpo', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rotulos', 'beta-rotulos']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-25', [post(2), post(1)]);
    coleta(dados, 'beta-rotulos', '2026-08-26', [post(3)]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 1);
    assert.deepStrictEqual(
      json.problemas.map((p) => [p.tipo, p.empresa, p.rede, p.data]),
      [['coleta_no_futuro', 'Alfa Envase', 'linkedin', '2026-08-25']],
      'só a empresa da rodada; a pasta de quem está fora da rodada não muda nada',
    );
    assert.strictEqual(json.rodada, null, 'sem rodada montada, não há faltam_coletar para a garimpo');
  }],

  ['pasta da rodada sem meta.json é coleta interrompida: a empresa continua em faltam_coletar', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)], null);
    const { json } = boletim(dados);
    assert.deepStrictEqual(json.rodada.faltam_coletar.map((x) => x.slug), ['alfa-envase']);
    assert.strictEqual(empresa(json, 'alfa-envase').cobertura, 'indisponivel');
    const c = conta(json, 'alfa-envase');
    assert.strictEqual(c.cobertura, 'indisponivel');
    assert.strictEqual(c.motivo, 'nao_coletada_nesta_rodada');
    assert.match(c.nota, /meta\.json/);
    assert.strictEqual(json.totais.posts_novos, 0);
  }],

  ['coleta completa ontem e interrompida hoje, na mesma rodada: vale a completa', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-23', [post(2), post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)], null);
    const { json } = boletim(dados);
    const c = conta(json, 'alfa-envase');
    assert.deepStrictEqual(json.rodada.faltam_coletar, []);
    assert.strictEqual(c.coleta_atual.data, '2026-08-23');
    assert.deepStrictEqual(c.novos.map((p) => p.post_id), ['urn:li:activity:7002']);
  }],

  ['coleta interrompida dentro da rodada não serve de anterior', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-23', [post(2)], null);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3), post(2), post(1)]);
    const c = conta(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(c.coleta_anterior.data, '2026-08-17', 'a pasta de 23/08 sem meta.json é pulada');
    assert.deepStrictEqual(c.novos.map((p) => p.post_id).sort(), ['urn:li:activity:7002', 'urn:li:activity:7003']);
  }],
  ['rodada antiga com duas coletas completas: a anterior é a penúltima, não a de antes da rodada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-10' });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1), post(2)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3), post(2), post(1)]);
    const c = conta(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(c.coleta_anterior.data, '2026-08-17');
    assert.deepStrictEqual(c.novos.map((p) => p.post_id), ['urn:li:activity:7003'], 'os posts de 17/08 já eram conhecidos');
  }],

  ['meta.json com "concluida": false dentro da rodada é coleta interrompida', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)], { concluida: false });
    const { json } = boletim(dados);
    assert.deepStrictEqual(json.rodada.faltam_coletar.map((x) => x.slug), ['alfa-envase']);
    const c = conta(json, 'alfa-envase');
    assert.strictEqual(c.motivo, 'nao_coletada_nesta_rodada');
    assert.match(c.nota, /coleta interrompida em 2026-08-24/);
    assert.match(c.nota, /concluida/);
  }],

  ['coleta com "concluida": false antes da rodada não serve de anterior', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-10', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-17', [post(2)], { concluida: false });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3), post(2), post(1)]);
    const c = conta(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(c.coleta_anterior.data, '2026-08-10', 'a de 17/08 parou no meio: os posts dela não são base');
    assert.deepStrictEqual(c.novos.map((p) => p.post_id).sort(), ['urn:li:activity:7002', 'urn:li:activity:7003']);
  }],

  ['coleta antiga sem meta.json, antes da rodada, continua servindo de anterior', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-07-14', [post(1)], null);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)]);
    const c = conta(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(c.primeira_coleta, false);
    assert.strictEqual(c.coleta_anterior.data, '2026-07-14');
    assert.deepStrictEqual(c.novos.map((p) => p.post_id), ['urn:li:activity:7002']);
  }],

  // Instagram: a conta é o handle, as coletas ficam em catalog/raw/instagram/<handle>/<data>/.

  ['empresa só com Instagram: a conta do Instagram é examinada e a empresa não cai em sem_rede', () => {
    const dados = montar({ empresas: [['Zeta Caixas', 'zeta-caixas', { linkedin: 'não', instagram: 'zetacaixas' }]], selecao: [{ slug: 'zeta-caixas', linkedin: false, instagram: 'zetacaixas' }] });
    coletaIg(dados, 'zeta-caixas', 'zetacaixas', '2026-08-17', [postIg('AbC1', '2026-08-14')]);
    coletaIg(dados, 'zeta-caixas', 'zetacaixas', '2026-08-24', [postIg('XyZ9', '2026-08-22'), postIg('AbC1', '2026-08-14')]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 0, 'exit 0');
    const e = empresa(json, 'zeta-caixas');
    assert.strictEqual(e.cobertura, 'com_novidade');
    assert.deepStrictEqual(e.contas.map((c) => [c.rede, c.conta]), [['instagram', 'zetacaixas']]);
    const c = conta(json, 'zeta-caixas', 'instagram');
    assert.deepStrictEqual(c.novos.map((p) => p.url), ['https://www.instagram.com/p/XyZ9/']);
    assert.deepStrictEqual(c.novos[0].engajamento, { likes: 50, comentarios: 4, reposts: 1, compartilhamentos: 7 }, 'o engajamento sai como a coleta do Instagram gravou');
    assert.strictEqual(c.coleta_anterior.data, '2026-08-17');
    assert.match(c.coleta_atual.pasta, /catalog[\\/]raw[\\/]instagram[\\/]zetacaixas[\\/]2026-08-24$/);
    assert.strictEqual(json.cobertura.sem_rede.length, 0);
    assert.deepStrictEqual(json.rodada.coletadas, [{ nome: 'Zeta Caixas', rede: 'instagram' }]);
  }],

  ['empresa com as duas redes e novidade só no Instagram: a empresa tem novidade e cada conta leva o próprio balde', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase', { instagram: 'alfaenvase' }]], selecao: [{ slug: 'alfa-envase', instagram: 'alfaenvase' }] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coletaIg(dados, 'alfa-envase', 'alfaenvase', '2026-08-17', [postIg('AbC1', '2026-08-14')]);
    coletaIg(dados, 'alfa-envase', 'alfaenvase', '2026-08-24', [postIg('XyZ9', '2026-08-22'), postIg('AbC1', '2026-08-14')]);
    const { json } = boletim(dados);
    const e = empresa(json, 'alfa-envase');
    assert.strictEqual(e.cobertura, 'com_novidade');
    assert.strictEqual(e.n_novos, 1);
    assert.deepStrictEqual(e.contas.map((c) => [c.rede, c.cobertura, c.n_novos]), [['linkedin', 'sem_novidade', 0], ['instagram', 'com_novidade', 1]]);
    assert.deepStrictEqual(json.cobertura.com_novidade, [{
      nome: 'Alfa Envase',
      slug: 'alfa-envase',
      contas: [
        { rede: 'linkedin', conta: 'alfa-envase', cobertura: 'sem_novidade', motivo: null, nota: null },
        { rede: 'instagram', conta: 'alfaenvase', cobertura: 'com_novidade', motivo: null, nota: null },
      ],
    }]);
    assert.strictEqual(json.cobertura.sem_novidade.length, 0, 'a empresa fica num balde só');
    assert.strictEqual(json.totais.posts_novos, 1);
    assert.strictEqual(json.rodada.n_contas, 2);
  }],

  ['conta do Instagram faltando coletar: entra em faltam_coletar com a rede e o handle, e a do LinkedIn conta como coletada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase', { instagram: 'alfaenvase' }]], selecao: [{ slug: 'alfa-envase', instagram: 'alfaenvase' }], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-23', [post(1)]);
    coletaIg(dados, 'alfa-envase', 'alfaenvase', '2026-08-10', [postIg('AbC1', '2026-08-08')]);
    const { json } = boletim(dados);
    assert.deepStrictEqual(json.rodada.faltam_coletar, [{ nome: 'Alfa Envase', slug: 'alfa-envase', rede: 'instagram', conta: 'alfaenvase', nota: 'última coleta em 2026-08-10, antes desta rodada' }]);
    assert.deepStrictEqual(json.rodada.coletadas, [{ nome: 'Alfa Envase', rede: 'linkedin' }]);
    assert.strictEqual(json.rodada.situacao, 'anterior_por_terminar');
    assert.strictEqual(empresa(json, 'alfa-envase').cobertura, 'com_novidade', 'o LinkedIn tem a primeira coleta');
    assert.strictEqual(conta(json, 'alfa-envase', 'instagram').motivo, 'nao_coletada_nesta_rodada');
  }],

  ['conta que a linha da seleção não lista não é examinada: o Instagram em dia fica de fora da rodada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase', { instagram: 'alfaenvase' }]], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    const { json } = boletim(dados);
    assert.deepStrictEqual(empresa(json, 'alfa-envase').contas.map((c) => c.rede), ['linkedin']);
    assert.deepStrictEqual(json.rodada.faltam_coletar, []);
  }],

  ['coleta do Instagram com data depois de hoje: coleta_no_futuro traz a rede e o handle', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase', { instagram: 'alfaenvase' }]], selecao: [{ slug: 'alfa-envase', instagram: 'alfaenvase' }] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coletaIg(dados, 'alfa-envase', 'alfaenvase', '2026-08-25', [postIg('AbC1', '2026-08-24')]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 1);
    assert.deepStrictEqual(json.problemas.map((p) => [p.tipo, p.empresa, p.rede, p.conta, p.data]), [['coleta_no_futuro', 'Alfa Envase', 'instagram', 'alfaenvase', '2026-08-25']]);
  }],

  ['seleção do formato anterior, sem campo de rede: exit 1 com selecao_sem_redes', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos']], selecao: [{ slug: 'alfa-envase', semRedes: true }, 'beta-rotulos'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 1);
    assert.deepStrictEqual(json.problemas.map((p) => [p.tipo, p.slugs]), [['selecao_sem_redes', ['alfa-envase']]]);
    assert.strictEqual(json.rodada, null);
  }],

  ['seleção com conta que o índice não tem para a empresa: aviso conta_fora_do_indice e a conta fica fora', () => {
    const dados = montar({
      empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos', { linkedin: 'não', instagram: 'betarotulos' }]],
      selecao: [{ slug: 'alfa-envase', instagram: 'alfaenvase' }, { slug: 'beta-rotulos', linkedin: false, instagram: 'beta.antigo' }],
    });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coletaIg(dados, 'beta-rotulos', 'beta.antigo', '2026-08-24', [postIg('AbC1', '2026-08-22')]);
    const { status, json } = boletim(dados);
    assert.strictEqual(status, 0, 'exit 0: é aviso, não problema');
    assert.deepStrictEqual(
      json.avisos.filter((a) => a.tipo === 'conta_fora_do_indice').map((a) => [a.empresa, a.rede, a.conta]),
      [['Alfa Envase', 'instagram', 'alfaenvase'], ['Beta Rótulos', 'instagram', 'beta.antigo']],
    );
    assert.deepStrictEqual(empresa(json, 'alfa-envase').contas.map((c) => c.rede), ['linkedin']);
    const b = empresa(json, 'beta-rotulos');
    assert.strictEqual(b.cobertura, 'fora_desta_rodada', 'nenhuma conta da linha está no índice: a empresa não entra na rodada');
    assert.deepStrictEqual(b.contas, [{ rede: 'instagram', conta: 'betarotulos', ultimo_catalogo: null }]);
    assert.deepStrictEqual(json.rodada.faltam_coletar, []);
    assert.strictEqual(json.rodada.n_empresas, 1);
  }],
];

let falhas = 0;
for (const [nome, caso] of casos) {
  try {
    caso();
    console.log(`ok     ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`FALHA  ${nome}: ${e.message.split('\n')[0]}`);
  }
}
console.log(`${casos.length - falhas}/${casos.length} casos passaram`);
process.exit(falhas ? 1 : 0);
