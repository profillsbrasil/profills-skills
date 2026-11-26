#!/usr/bin/env node
// boletim.test.js — casos do boletim.js, rodados pelo terminal como a skill roda.
// Uso: node skills/profills-boletim/scripts/boletim.test.js   (Node >= 18, sem dependência)
// Cada caso monta uma pasta de dados temporária com empresas fictícias, roda boletim.js como processo e confere o JSON.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const BOLETIM = path.join(__dirname, 'boletim.js');
const HOJE = '2026-08-24';

const linha = (nome, slug, { prioridade = 'Alta', linkedin = 'sim' } = {}) =>
  `- [${nome}](${slug}.md) — \`${slug}\` · id — · setor envase · país BR · prioridade ${prioridade} · linkedin ${linkedin} · pesquisa 2026-08-01 · sem catálogo`;

function montar({ empresas, selecao, rodada = HOJE, catalog = true, boletins = [] }) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'boletim-test-'));
  fs.mkdirSync(path.join(dados, 'refs'), { recursive: true });
  fs.mkdirSync(path.join(dados, 'boletins'), { recursive: true });
  for (const d of boletins) fs.writeFileSync(path.join(dados, 'boletins', `${d}.md`), '# Boletim\n');
  if (catalog) fs.mkdirSync(path.join(dados, 'catalog', 'raw'), { recursive: true });
  fs.writeFileSync(path.join(dados, 'refs', 'INDEX.md'), ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', '', ...empresas.map((e) => linha(...e)), ''].join('\n'));
  for (const [nome, slug] of empresas) fs.writeFileSync(path.join(dados, 'refs', `${slug}.md`), `# ${nome}\n`);
  if (selecao) {
    const linhas = selecao.map((slug) => `- [${slug}](refs/${slug}.md) — \`${slug}\` · id — · envase · BR`);
    fs.writeFileSync(path.join(dados, 'selection.md'), [`# Seleção ativa — ${rodada}`, '', ...linhas, ''].join('\n'));
  }
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

function coleta(dados, slug, data, posts, meta = {}) {
  const pasta = path.join(dados, 'catalog', 'raw', slug, data);
  fs.mkdirSync(pasta, { recursive: true });
  if (posts !== undefined) fs.writeFileSync(path.join(pasta, 'posts.json'), typeof posts === 'string' ? posts : JSON.stringify(posts, null, 2));
  if (meta === null) return;
  const n = Array.isArray(posts) ? posts.length : 0;
  fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify({ slug, coletado_em: data, seguidores: 1000, janela_dias: 7, posts_coletados: n, status: 'ok', ...meta }, null, 2));
}

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
    const e = empresa(json, 'alfa-envase');
    assert.strictEqual(e.cobertura, 'com_novidade');
    assert.strictEqual(e.primeira_coleta, false);
    assert.deepStrictEqual(e.novos.map((p) => p.post_id), ['urn:li:activity:7003']);
    const p = e.novos[0];
    assert.strictEqual(p.idioma, 'en', 'idioma em minúscula');
    assert.strictEqual(p.estrangeiro, true);
    assert.strictEqual(p.resumo_pt, 'A empresa mostra a linha nova.');
    assert.deepStrictEqual(p.engajamento, { likes: 30, comentarios: 3, reposts: 0 });
    assert.strictEqual(p.destaque_da_coleta, true, 'o post de maior likes + comentários é o destaque do metricas.js');
    assert.strictEqual(e.coleta_anterior.data, '2026-08-17');
    assert.strictEqual(e.cadencia.anterior.n_posts, 2);
    assert.strictEqual(e.cadencia.atual.n_posts, 3);
    assert.strictEqual(typeof e.cadencia.diferenca, 'number');
    assert.deepStrictEqual(json.cobertura.com_novidade.map((x) => x.nome), ['Alfa Envase']);
    assert.strictEqual(json.totais.posts_novos, 1);
  }],

  ['repetir a mesma coleta não dá novidade', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1), post(2)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)]);
    const e = empresa(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(e.cobertura, 'sem_novidade');
    assert.strictEqual(e.n_novos, 0);
  }],

  ['primeira coleta: todo post da janela é novo e a saída diz que é a primeira', () => {
    const dados = montar({ empresas: [['Beta Rótulos', 'beta-rotulos']], selecao: ['beta-rotulos'] });
    coleta(dados, 'beta-rotulos', '2026-08-24', [post(1), post(2)]);
    const e = empresa(boletim(dados).json, 'beta-rotulos');
    assert.strictEqual(e.cobertura, 'com_novidade');
    assert.strictEqual(e.primeira_coleta, true);
    assert.strictEqual(e.n_novos, 2);
    assert.strictEqual(e.cadencia, null, 'sem coleta anterior não há mudança de cadência');
    assert.deepStrictEqual(e.novos.map((p) => p.data), ['2026-08-12', '2026-08-11'], 'mais recentes primeiro');
  }],

  ['coleta indisponível: erro de navegação e posts.json quebrado caem em indisponivel', () => {
    const dados = montar({ empresas: [['Gama Tampas', 'gama-tampas'], ['Delta Selagem', 'delta-selagem']], selecao: ['gama-tampas', 'delta-selagem'] });
    coleta(dados, 'gama-tampas', '2026-08-24', undefined, { status: 'erro_navegacao', nota: 'a página não abriu', posts_coletados: 0 });
    coleta(dados, 'delta-selagem', '2026-08-24', '{ isto não é json');
    const { json } = boletim(dados);
    const g = empresa(json, 'gama-tampas');
    assert.strictEqual(g.cobertura, 'indisponivel');
    assert.strictEqual(g.motivo, 'erro_navegacao');
    assert.strictEqual(g.nota, 'a página não abriu');
    const d = empresa(json, 'delta-selagem');
    assert.strictEqual(d.cobertura, 'indisponivel');
    assert.strictEqual(d.motivo, 'coleta_com_erro');
    assert.deepStrictEqual(json.cobertura.indisponivel.map((x) => x.nome).sort(), ['Delta Selagem', 'Gama Tampas']);
  }],

  ['empresa sem posts na janela é silêncio: sem_novidade, não indisponível', () => {
    const dados = montar({ empresas: [['Épsilon Dosadoras', 'epsilon-dosadoras']], selecao: ['epsilon-dosadoras'] });
    coleta(dados, 'epsilon-dosadoras', '2026-08-17', [post(1)]);
    coleta(dados, 'epsilon-dosadoras', '2026-08-24', undefined, { status: 'sem_posts', nota: 'não postou nos últimos 7 dias', posts_coletados: 0 });
    const e = empresa(boletim(dados).json, 'epsilon-dosadoras');
    assert.strictEqual(e.cobertura, 'sem_novidade');
    assert.strictEqual(e.motivo, 'sem_posts');
    assert.strictEqual(e.cadencia.atual.posts_por_semana, 0);
  }],

  ['sem LinkedIn cai em sem_linkedin e não conta na rodada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Zeta Caixas', 'zeta-caixas', { linkedin: 'não' }]], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    const { json } = boletim(dados);
    assert.strictEqual(empresa(json, 'zeta-caixas').cobertura, 'sem_linkedin');
    assert.strictEqual(json.rodada.n_empresas, 1);
  }],

  ['empresa fora da rodada cai em fora_desta_rodada, mesmo com coleta em disco', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Eta Filmes', 'eta-filmes', { prioridade: 'Média' }]], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coleta(dados, 'eta-filmes', '2026-08-24', [post(5)]);
    const { json } = boletim(dados);
    const e = empresa(json, 'eta-filmes');
    assert.strictEqual(e.cobertura, 'fora_desta_rodada');
    assert.strictEqual(e.novos, undefined, 'fora da rodada não lista posts');
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
    const e = empresa(boletim(dados).json, 'teta-valvulas');
    assert.strictEqual(e.n_novos, 1, 'o post antigo com a mesma url, só com query diferente, não é novo');
    assert.strictEqual(e.novos[0].url, 'https://www.linkedin.com/posts/teta-novo?utm_source=x');
  }],

  ['empresa da rodada ainda não coletada aparece em faltam_coletar', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase'], ['Beta Rótulos', 'beta-rotulos']], selecao: ['alfa-envase', 'beta-rotulos'] });
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)]);
    coleta(dados, 'beta-rotulos', '2026-08-10', [post(1)]);
    const { json } = boletim(dados);
    assert.deepStrictEqual(json.rodada.faltam_coletar, [{ nome: 'Beta Rótulos', slug: 'beta-rotulos', nota: 'última coleta em 2026-08-10, antes desta rodada' }]);
    assert.strictEqual(empresa(json, 'beta-rotulos').motivo, 'nao_coletada_nesta_rodada');
  }],

  ['idempotente: duas execuções dão a mesma saída e não gravam nada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'] });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(2), post(1)]);
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
    const e = empresa(json, 'alfa-envase');
    assert.strictEqual(e.n_novos, 2, 'o post 3 e o post 4, uma vez cada');
    assert.strictEqual(json.totais.posts_novos, 2);
    assert.strictEqual(e.coleta_atual.n_posts, 3, 'n_posts da coleta sem as repetições');
    assert.strictEqual(json.avisos.filter((a) => a.tipo === 'post_repetido').length, 2, 'um aviso por repetição');
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
    assert.deepStrictEqual(json.rodada.coletadas, ['Alfa Envase']);
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
    assert.strictEqual(empresa(json, 'alfa-envase').coleta_atual.data, '2026-08-23');
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
      json.problemas.map((p) => [p.tipo, p.empresa, p.data]),
      [['coleta_no_futuro', 'Alfa Envase', '2026-08-25']],
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
    const e = empresa(json, 'alfa-envase');
    assert.strictEqual(e.cobertura, 'indisponivel');
    assert.strictEqual(e.motivo, 'nao_coletada_nesta_rodada');
    assert.match(e.nota, /meta\.json/);
    assert.strictEqual(json.totais.posts_novos, 0);
  }],

  ['coleta completa ontem e interrompida hoje, na mesma rodada: vale a completa', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-23', [post(2), post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(1)], null);
    const { json } = boletim(dados);
    const e = empresa(json, 'alfa-envase');
    assert.deepStrictEqual(json.rodada.faltam_coletar, []);
    assert.strictEqual(e.coleta_atual.data, '2026-08-23');
    assert.deepStrictEqual(e.novos.map((p) => p.post_id), ['urn:li:activity:7002']);
  }],

  ['coleta interrompida dentro da rodada não serve de anterior', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-23' });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1)]);
    coleta(dados, 'alfa-envase', '2026-08-23', [post(2)], null);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3), post(2), post(1)]);
    const e = empresa(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(e.coleta_anterior.data, '2026-08-17', 'a pasta de 23/08 sem meta.json é pulada');
    assert.deepStrictEqual(e.novos.map((p) => p.post_id).sort(), ['urn:li:activity:7002', 'urn:li:activity:7003']);
  }],
  ['rodada antiga com duas coletas completas: a anterior é a penúltima, não a de antes da rodada', () => {
    const dados = montar({ empresas: [['Alfa Envase', 'alfa-envase']], selecao: ['alfa-envase'], rodada: '2026-08-10' });
    coleta(dados, 'alfa-envase', '2026-08-17', [post(1), post(2)]);
    coleta(dados, 'alfa-envase', '2026-08-24', [post(3), post(2), post(1)]);
    const e = empresa(boletim(dados).json, 'alfa-envase');
    assert.strictEqual(e.coleta_anterior.data, '2026-08-17');
    assert.deepStrictEqual(e.novos.map((p) => p.post_id), ['urn:li:activity:7003'], 'os posts de 17/08 já eram conhecidos');
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
