#!/usr/bin/env node
// migrar.test.js — casos da migração da pasta DADOS, rodados pelo terminal como o comercial roda.
// Uso: node plugins/profills/skills/profills-setup/scripts/migrar.test.js   (Node >= 18, sem dependência)
// Cada caso monta uma pasta temporária, roda migrar.js e indice.js como processos e confere a saída.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MIGRAR = path.join(__dirname, 'migrar.js');
const INDICE = path.join(__dirname, '..', '..', 'profills-radar', 'scripts', 'indice.js');
const HOJE = '2026-11-06';
const BOM = '﻿';

const CABECALHO = [
  '# Índice de referências — empresas do LinkedIn',
  '',
  'O índice é um mapa, não um armazém: cada linha aponta para o dossiê que guarda o detalhe. O dossiê de uma empresa vive num arquivo só (`<slug>.md`) — o índice nunca repete o conteúdo, só resume e linka.',
  '',
  '## Empresas',
  '',
];

// linkedin-data/refs/INDEX.md como estava no commit a175c1c.
const LINHAS_REAIS = [
  '- [Cetro Máquinas](cetromaquinas.md) — `cetromaquinas` · id — · máquinas de embalagem/processamento · BR · pesquisa 2026-07-14 · catálogo 2026-07-14 · ⚠ catálogo parcial (smoke test)',
  '- [Maqinox indústria de Máquinas](maqinox-ind-stria-de-maquinas.md) — `maqinox-ind-stria-de-maquinas` · id — · máquinas de envase/Doypack · BR · pesquisa 2026-07-14 · sem catálogo',
  '- [Tecnoenvase Máquinas e Equipamentos](tecnoenvase-maquinas-e-equipamentos-ltda.md) — `tecnoenvase-maquinas-e-equipamentos-ltda` · id — · envasadoras/dosadoras · BR · pesquisa 2026-07-14 · sem catálogo',
  '- [Tecnox do Brasil](tecnox-do-brasil.md) — `tecnox-do-brasil` · id — · embalagem flexível/Doypack · BR · pesquisa 2026-07-14 · sem catálogo',
  '- [Skymsen (Metalúrgica Siemsen)](skymsen.md) — `skymsen` · id — · processamento de alimentos (benchmark maior) · BR · pesquisa 2026-07-14 · sem catálogo',
  '- [Sulpack Indústria de Máquinas](sulpack-industria-de-maquinas-para-embalagens.md) — `sulpack-industria-de-maquinas-para-embalagens` · id — · seladoras/embaladoras · BR · pesquisa 2026-07-14 · sem catálogo · ⚠ presença digital fraca (~38 seguidores)',
];

const ESPERADO_REAL = {
  cetromaquinas: { setor: 'máquinas de embalagem/processamento', alerta: 'catálogo parcial (smoke test)' },
  'maqinox-ind-stria-de-maquinas': { setor: 'máquinas de envase/Doypack', alerta: null },
  'tecnoenvase-maquinas-e-equipamentos-ltda': { setor: 'envasadoras/dosadoras', alerta: null },
  'tecnox-do-brasil': { setor: 'embalagem flexível/Doypack', alerta: null },
  skymsen: { setor: 'processamento de alimentos (benchmark maior)', alerta: null },
  'sulpack-industria-de-maquinas-para-embalagens': { setor: 'seladoras/embaladoras', alerta: 'presença digital fraca (~38 seguidores)' },
};

// linkedin-data/refs/INDEX.md na versão 2 da pasta, antes do campo instagram.
const LINHAS_V2 = [
  '- [Cetro Máquinas](cetromaquinas.md) — `cetromaquinas` · id — · setor máquinas de embalagem/processamento · país BR · prioridade a definir · linkedin sim · pesquisa 2026-07-14 · catálogo 2026-07-14 · ⚠ catálogo parcial (smoke test)',
  '- [Maqinox indústria de Máquinas](maqinox-ind-stria-de-maquinas.md) — `maqinox-ind-stria-de-maquinas` · id — · setor máquinas de envase/Doypack · país BR · prioridade a definir · linkedin sim · pesquisa 2026-07-14 · sem catálogo',
  '- [Tecnox do Brasil](tecnox-do-brasil.md) — `tecnox-do-brasil` · id — · setor embalagem flexível/Doypack · país BR · prioridade a definir · linkedin sim · pesquisa 2026-07-14 · sem catálogo',
  '- [Sulpack Indústria de Máquinas](sulpack-industria-de-maquinas-para-embalagens.md) — `sulpack-industria-de-maquinas-para-embalagens` · id — · setor seladoras/embaladoras · país BR · prioridade a definir · linkedin sim · pesquisa 2026-07-14 · sem catálogo · ⚠ presença digital fraca (~38 seguidores)',
];
const comInstagram = (linha) => linha.replace(/ · linkedin (sim|não) · /, ' · linkedin $1 · instagram — · ');
// A versão 3 da linha não tem o campo catálogo: a data sai das coletas.
const semCatalogo = (linha) => linha.replace(/ · (?:sem catálogo|catálogo \d{4}-\d{2}-\d{2})(?= · |$)/, '');
const paraV3 = (linha) => semCatalogo(comInstagram(linha));
// O que a migração acrescenta ao .gitignore da pasta: o banco derivado de banco.js.
const IGNORAR_BANCO = ['indice.db', 'indice.db-wal', 'indice.db-shm'];
// O montar() cria catalog/raw/ sem a pasta da rede: a criação dela não é o que estes casos conferem.
const tiposSemPasta = (r) => r.acoes.map((a) => a.tipo).filter((t) => t !== 'criar_pasta');

const indexCom = (linhas, quebra = '\n') => [...CABECALHO, ...linhas, ''].join(quebra);

// coletas: [slug, data, { posts, meta, status }] na forma da versão 2, catalog/raw/<slug>/<data>/.
// meta é o objeto do meta.json (ou o texto cru); status é o texto de um STATUS.txt da versão 1.
function montar({ index, marcador, coletas = [], claude, agents } = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'migrar-test-'));
  for (const sub of ['refs', 'catalog/raw', 'drafts', 'boletins']) fs.mkdirSync(path.join(dados, sub), { recursive: true });
  if (index !== undefined) {
    fs.writeFileSync(path.join(dados, 'refs', 'INDEX.md'), index, 'utf8');
    for (const m of index.matchAll(/\]\(([^)\s]+\.md)\)/g)) fs.writeFileSync(path.join(dados, 'refs', m[1]), '# ficha\n');
  }
  if (marcador !== undefined) fs.writeFileSync(path.join(dados, '.profills.json'), JSON.stringify({ versao_dados: marcador }) + '\n');
  if (claude !== undefined) fs.writeFileSync(path.join(dados, 'CLAUDE.md'), claude);
  if (agents !== undefined) fs.writeFileSync(path.join(dados, 'AGENTS.md'), agents);
  for (const [rel, data, { posts, meta, status } = {}] of coletas) {
    const pasta = path.join(dados, 'catalog', 'raw', rel, data);
    fs.mkdirSync(pasta, { recursive: true });
    if (posts !== undefined) fs.writeFileSync(path.join(pasta, 'posts.json'), JSON.stringify(posts, null, 2) + '\n');
    if (meta !== undefined) fs.writeFileSync(path.join(pasta, 'meta.json'), typeof meta === 'string' ? meta : JSON.stringify(meta, null, 2) + '\n');
    if (status !== undefined) fs.writeFileSync(path.join(pasta, 'STATUS.txt'), status);
  }
  return dados;
}

const ler = (dados, rel) => fs.readFileSync(path.join(dados, rel), 'utf8');
const lerJson = (dados, rel) => JSON.parse(ler(dados, rel));
const POSTS = [{ post_id: 'urn:li:activity:7001', url: 'https://www.linkedin.com/feed/update/urn:li:activity:7001/', data: '2026-07-10' }];
const META_V2 = { slug: 'tecnox-do-brasil', coletado_em: '2026-07-14', seguidores: 154, janela_dias: 7, posts_coletados: 0, status: 'sem_posts', nota: 'LinkedIn parado.' };

function rodar(script, args) {
  const r = spawnSync(process.execPath, [script, ...args, '--hoje', HOJE], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  return { status: r.status, json, stdout: r.stdout, stderr: r.stderr };
}

const migrar = (dados, ...args) => rodar(MIGRAR, [dados, ...args]);
const validar = (dados) => rodar(INDICE, [path.join(dados, 'refs')]);
const lerIndex = (dados) => fs.readFileSync(path.join(dados, 'refs', 'INDEX.md'), 'utf8');
const existe = (dados, rel) => fs.existsSync(path.join(dados, rel));

function hashDaPasta(raiz) {
  const h = crypto.createHash('sha256');
  const andar = (pasta) => {
    for (const nome of fs.readdirSync(pasta).sort()) {
      const p = path.join(pasta, nome);
      if (fs.statSync(p).isDirectory()) andar(p);
      else h.update(path.relative(raiz, p) + '\0').update(fs.readFileSync(p));
    }
  };
  andar(raiz);
  return h.digest('hex');
}

function aplicarComSucesso(dados) {
  const r = migrar(dados, '--aplicar');
  assert.ok(r.json, `migrar.js não devolveu JSON: ${r.stderr.slice(0, 300)}`);
  assert.deepStrictEqual(r.json.problemas, [], 'migração sem problema');
  assert.strictEqual(r.json.ok, true, 'migração ok');
  assert.strictEqual(r.status, 0, 'exit 0');
  return r.json;
}

function validarComSucesso(dados, n) {
  const v = validar(dados);
  assert.ok(v.json, `indice.js não devolveu JSON: ${v.stderr.slice(0, 300)}`);
  assert.deepStrictEqual(v.json.problemas, [], 'índice sem problema depois da migração');
  assert.strictEqual(v.json.n_empresas, n, `índice com ${n} empresa(s)`);
  return Object.fromEntries(v.json.empresas.map((e) => [e.slug, e]));
}

function recusaSemGravar(dados, tipo) {
  fs.rmdirSync(path.join(dados, 'drafts'));
  const antes = hashDaPasta(dados);
  const simulado = migrar(dados);
  assert.strictEqual(simulado.json.ok, false, 'simulação devolve ok false');
  assert.ok(simulado.json.problemas.some((p) => p.tipo === tipo), `problema ${tipo} na simulação: ${JSON.stringify(simulado.json.problemas)}`);
  const r = migrar(dados, '--aplicar');
  assert.strictEqual(r.json.ok, false, '--aplicar devolve ok false');
  assert.strictEqual(r.status, 1, 'exit 1');
  assert.strictEqual(hashDaPasta(dados), antes, 'nenhum byte da pasta mudou');
  assert.ok(!existe(dados, '.profills.json'), 'marcador não gravado');
  assert.ok(!existe(dados, '.backup'), 'nenhum backup criado');
  assert.ok(!existe(dados, 'drafts'), 'nenhuma pasta criada');
  assert.strictEqual(r.json.aplicado, false, 'aplicado false');
}

const casos = [
  ['setor v1 que começa por "grupo" continua setor', () => {
    const dados = montar({ index: indexCom(['- [Grupo X](gx.md) — `gx` · id — · grupo industrial de embalagens · BR · pesquisa 2026-07-14 · sem catálogo']) });
    const r = aplicarComSucesso(dados);
    assert.ok(r.acoes.some((a) => a.tipo === 'converter_indice'), 'a linha v1 foi convertida');
    const e = validarComSucesso(dados, 1).gx;
    assert.strictEqual(e.setor, 'grupo industrial de embalagens');
    assert.strictEqual(e.pais, 'BR');
    assert.strictEqual(e.grupo, null);
  }],

  ['país v1 que começa por "linkedin" continua país', () => {
    const dados = montar({ index: indexCom(['- [P](p.md) — `p` · id — · s · linkedin BR · pesquisa 2026-07-14 · sem catálogo']) });
    aplicarComSucesso(dados);
    const e = validarComSucesso(dados, 1).p;
    assert.strictEqual(e.setor, 's');
    assert.strictEqual(e.pais, 'linkedin BR');
    assert.strictEqual(e.linkedin, true);
  }],

  ['BOM com empresa na linha 1 e CRLF: as duas linhas migram', () => {
    const linhas = [
      '- [A](a.md) — `a` · id 1 · s · BR · pesquisa 2026-07-14 · sem catálogo',
      '- [B](b.md) — `b` · id 2 · s · BR · pesquisa 2026-07-14 · sem catálogo',
    ];
    const dados = montar({ index: BOM + linhas.join('\r\n') + '\r\n' });
    aplicarComSucesso(dados);
    const novo = lerIndex(dados);
    assert.ok(novo.split('\r\n').filter((l) => l.startsWith('- ')).every((l) => l.includes(' · setor s · país BR · ')), `as duas linhas ganharam chave: ${novo}`);
    assert.ok(!/(^|[^\r])\n/.test(novo), 'CRLF continua CRLF');
    const v = validar(dados);
    assert.strictEqual(v.json.n_empresas, 2, 'índice lê as duas empresas');
    assert.deepStrictEqual(v.json.problemas.filter((p) => p.tipo !== 'cabecalho_ausente'), [], 'nenhum problema de linha');
  }],

  ['indice.js lê a linha 1 de um INDEX da versão atual com BOM', () => {
    const linhas = [
      '- [A](a.md) — `a` · id 1 · setor s · país BR · prioridade Alta · linkedin sim · instagram — · pesquisa 2026-07-14',
      '- [B](b.md) — `b` · id 2 · setor s · país BR · prioridade Alta · linkedin sim · instagram — · pesquisa 2026-07-14',
    ];
    const dados = montar({ index: BOM + linhas.join('\n') + '\n', marcador: 3 });
    const v = validar(dados);
    assert.strictEqual(v.json.n_empresas, 2, 'índice lê as duas empresas');
    assert.deepStrictEqual(v.json.problemas.filter((p) => p.tipo !== 'cabecalho_ausente'), [], 'nenhum problema de linha');
  }],

  ['linha de lista fora do formato bloqueia a migração', () => {
    const dados = montar({
      index: indexCom([
        '- [Foo [BR]](foo.md) — `foo` · id — · s · BR · pesquisa 2026-07-14 · sem catálogo',
        '- [Bar](bar.md) — `bar` · id — · s · BR · pesquisa 2026-07-14 · sem catálogo',
      ]),
    });
    recusaSemGravar(dados, 'linha_fora_do_formato');
  }],

  ['linha v2 com campo inválido bloqueia o marcador', () => {
    const dados = montar({
      index: indexCom([
        '- [A](a.md) — `a` · id 1 · s · BR · pesquisa 2026-07-14 · sem catálogo',
        '- [B](b.md) — `b` · id 2 · setor s · país BR · prioridade urgente · linkedin sim · pesquisa 2026-07-14 · sem catálogo',
      ]),
    });
    recusaSemGravar(dados, 'prioridade_invalida');
  }],

  ['falha de escrita no --aplicar vira JSON e a retomada termina', () => {
    if (process.getuid && process.getuid() === 0) return 'pulado: root ignora permissão';
    const original = indexCom(LINHAS_REAIS);
    const dados = montar({ index: original });
    fs.chmodSync(path.join(dados, 'refs'), 0o555);
    let r;
    try {
      r = migrar(dados, '--aplicar');
    } finally {
      fs.chmodSync(path.join(dados, 'refs'), 0o755);
    }
    assert.ok(r.json, `saída JSON em vez de stack trace: ${r.stderr.slice(0, 300)}`);
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.status, 1, 'exit 1');
    assert.ok(typeof r.json.erro === 'string' && r.json.erro.includes('INDEX.md'), `erro cita o arquivo: ${r.json.erro}`);
    assert.ok(!/\n\s+at /.test(r.stderr), 'sem stack trace');
    assert.ok(!existe(dados, '.profills.json'), 'marcador não gravado na falha');
    assert.strictEqual(lerIndex(dados), original, 'INDEX intacto na falha');

    aplicarComSucesso(dados);
    validarComSucesso(dados, 6);
    assert.strictEqual(fs.readFileSync(path.join(dados, '.backup', HOJE, 'refs', 'INDEX.md'), 'utf8'), original, 'backup guarda o INDEX original');
  }],

  ['INDEX real do commit a175c1c', () => {
    const original = indexCom(LINHAS_REAIS);
    const dados = montar({ index: original });
    aplicarComSucesso(dados);
    const empresas = validarComSucesso(dados, 6);
    for (const [slug, esperado] of Object.entries(ESPERADO_REAL)) {
      const e = empresas[slug];
      assert.deepStrictEqual(
        { setor: e.setor, pais: e.pais, id: e.id, pesquisa: e.pesquisa, alerta: e.alerta, prioridade: e.prioridade, linkedin: e.linkedin, instagram: e.instagram },
        { ...esperado, pais: 'BR', id: '—', pesquisa: '2026-07-14', prioridade: 'a definir', linkedin: true, instagram: null },
        slug,
      );
    }
    assert.ok(lerIndex(dados).split('\n').filter((l) => l.startsWith('- ')).every((l) => !/ · (sem catálogo|catálogo \d)/.test(l.split(' · ⚠')[0])), 'nenhuma linha guarda o campo catálogo');
    assert.strictEqual(fs.readFileSync(path.join(dados, '.backup', HOJE, 'refs', 'INDEX.md'), 'utf8'), original, 'backup byte a byte');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dados, '.profills.json'), 'utf8')).versao_dados, 4);
  }],

  ['variante de 2026-08-04 sem id e com catálogo parcial', () => {
    const cetro = '- [Cetro Máquinas](cetromaquinas.md) — `cetromaquinas` · máquinas de embalagem/processamento · BR · pesquisa 2026-07-14 · catálogo parcial 2026-07-14 (smoke test)';
    const dados = montar({ index: indexCom([cetro, ...LINHAS_REAIS.slice(1)]) });
    aplicarComSucesso(dados);
    const e = validarComSucesso(dados, 6).cetromaquinas;
    assert.strictEqual(e.id, '—');
    assert.strictEqual(e.alerta, 'catálogo parcial (smoke test)', 'o qualificador do catálogo vira alerta; a data sai das coletas');
  }],

  ['INDEX real com CRLF', () => {
    const dados = montar({ index: indexCom(LINHAS_REAIS, '\r\n') });
    aplicarComSucesso(dados);
    assert.ok(!/(^|[^\r])\n/.test(lerIndex(dados)), 'CRLF continua CRLF');
    validarComSucesso(dados, 6);
  }],

  ['⚠ com " · " dentro chega inteiro', () => {
    const dados = montar({ index: indexCom(['- [Bar](bar.md) — `bar` · id — · s · BR · pesquisa 2026-07-14 · sem catálogo · ⚠ a · b · c']) });
    aplicarComSucesso(dados);
    assert.strictEqual(validarComSucesso(dados, 1).bar.alerta, 'a · b · c');
  }],

  ['segunda rodada não muda nenhum byte (sha256)', () => {
    const dados = montar({ index: indexCom(LINHAS_REAIS) });
    aplicarComSucesso(dados);
    const antes = hashDaPasta(dados);
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(r.acoes, [], 'nada a fazer');
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 da pasta igual');
  }],

  ['slug duplicado trava a migração sem gravar', () => {
    const dados = montar({
      index: indexCom([
        '- [Foo](foo.md) — `foo` · id — · s · BR · pesquisa 2026-07-14 · sem catálogo',
        '- [Foo de novo](foo.md) — `foo` · id — · t · BR · pesquisa 2026-07-14 · sem catálogo',
      ]),
    });
    recusaSemGravar(dados, 'slug_duplicado');
  }],

  ['pasta na versão 5 é recusada sem mudar nada', () => {
    const dados = montar({ index: indexCom(LINHAS_REAIS), marcador: 5 });
    const antes = hashDaPasta(dados);
    const r = migrar(dados, '--aplicar');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.problemas.some((p) => p.tipo === 'pasta_mais_nova'));
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 da pasta igual');
  }],

  // ---------- versão 2 → 3: a rede vira nível de pasta ----------

  ['v2 → v3: cada coleta vai para catalog/raw/linkedin/<slug>, com o registro para desfazer', () => {
    const dados = montar({
      index: indexCom(LINHAS_V2),
      marcador: 2,
      coletas: [
        ['cetromaquinas', '2026-07-14', { posts: POSTS }],
        ['tecnox-do-brasil', '2026-07-14', { posts: [], meta: META_V2 }],
      ],
    });
    const postsAntes = ler(dados, 'catalog/raw/cetromaquinas/2026-07-14/posts.json');
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(
      r.acoes.filter((a) => a.tipo === 'mover_coleta').map((a) => a.alvo),
      [path.join('catalog', 'raw', 'linkedin', 'cetromaquinas'), path.join('catalog', 'raw', 'linkedin', 'tecnox-do-brasil')],
    );
    assert.ok(!existe(dados, 'catalog/raw/cetromaquinas') && !existe(dados, 'catalog/raw/tecnox-do-brasil'), 'nenhuma pasta de empresa fica solta em catalog/raw/');
    assert.strictEqual(ler(dados, 'catalog/raw/linkedin/cetromaquinas/2026-07-14/posts.json'), postsAntes, 'posts.json chega byte a byte');
    const movidos = ler(dados, `.backup/${HOJE}/movidos.jsonl`).trim().split('\n').map((l) => JSON.parse(l));
    assert.deepStrictEqual(movidos, [
      { de: path.join('catalog', 'raw', 'cetromaquinas'), para: path.join('catalog', 'raw', 'linkedin', 'cetromaquinas') },
      { de: path.join('catalog', 'raw', 'tecnox-do-brasil'), para: path.join('catalog', 'raw', 'linkedin', 'tecnox-do-brasil') },
    ]);
    assert.ok(existe(dados, 'catalog/raw/linkedin'), 'a pasta da rede existe');
    assert.strictEqual(JSON.parse(ler(dados, '.profills.json')).versao_dados, 4);
  }],

  ['v2 → v3: meta.json ganha "concluida": true, e a coleta antiga sem meta.json continua sem', () => {
    const dados = montar({
      index: indexCom(LINHAS_V2),
      marcador: 2,
      coletas: [
        ['cetromaquinas', '2026-07-14', { posts: POSTS }],
        ['tecnox-do-brasil', '2026-07-14', { posts: [], meta: META_V2 }],
      ],
    });
    const metaAntes = ler(dados, 'catalog/raw/tecnox-do-brasil/2026-07-14/meta.json');
    aplicarComSucesso(dados);
    assert.deepStrictEqual(lerJson(dados, 'catalog/raw/linkedin/tecnox-do-brasil/2026-07-14/meta.json'), { ...META_V2, concluida: true }, 'os campos de antes ficam, e concluida entra');
    assert.strictEqual(ler(dados, `.backup/${HOJE}/catalog/raw/linkedin/tecnox-do-brasil/2026-07-14/meta.json`), metaAntes, 'backup do meta.json original');
    assert.ok(!existe(dados, 'catalog/raw/linkedin/cetromaquinas/2026-07-14/meta.json'), 'coleta de 2026-07 sem meta.json não ganha meta.json');
  }],

  ['v2 → v3: a linha do índice ganha o campo instagram e perde o catálogo', () => {
    const dados = montar({ index: indexCom(LINHAS_V2), marcador: 2 });
    const r = aplicarComSucesso(dados);
    assert.ok(r.acoes.some((a) => a.tipo === 'converter_indice'));
    assert.strictEqual(lerIndex(dados), indexCom(LINHAS_V2.map(paraV3)), 'cada linha é a de antes com " · instagram —" depois do linkedin e sem o catálogo');
    const empresas = validarComSucesso(dados, 4);
    assert.ok(Object.values(empresas).every((e) => e.instagram === null), 'instagram — é null');
    assert.strictEqual(ler(dados, `.backup/${HOJE}/refs/INDEX.md`), indexCom(LINHAS_V2), 'backup do INDEX de antes');
  }],

  ['v1 → v2 → v3 numa execução só: linha antiga, STATUS.txt e pasta solta', () => {
    const dados = montar({
      index: indexCom(LINHAS_REAIS),
      coletas: [
        ['cetromaquinas', '2026-07-14', { posts: POSTS }],
        ['tecnoenvase-maquinas-e-equipamentos-ltda', '2026-07-14', { status: 'PÁGINA NÃO GERENCIADA: /posts/ redireciona para /about/.' }],
      ],
    });
    aplicarComSucesso(dados);
    const empresas = validarComSucesso(dados, 6);
    assert.strictEqual(empresas.cetromaquinas.setor, 'máquinas de embalagem/processamento', 'a linha v1 chega na v3 com o setor certo');
    assert.strictEqual(empresas.cetromaquinas.instagram, null);
    const meta = lerJson(dados, 'catalog/raw/linkedin/tecnoenvase-maquinas-e-equipamentos-ltda/2026-07-14/meta.json');
    assert.strictEqual(meta.status, 'pagina_nao_gerenciada', 'o STATUS.txt virou meta.json no lugar novo');
    assert.strictEqual(meta.concluida, true);
    assert.ok(existe(dados, 'catalog/raw/linkedin/tecnoenvase-maquinas-e-equipamentos-ltda/2026-07-14/STATUS.txt'), 'o STATUS.txt vai junto com a pasta');
    assert.ok(!existe(dados, 'catalog/raw/tecnoenvase-maquinas-e-equipamentos-ltda'), 'nada fica no caminho antigo');
    assert.strictEqual(JSON.parse(ler(dados, '.profills.json')).versao_dados, 4);
    assert.deepStrictEqual(aplicarComSucesso(dados).acoes, [], 'segunda rodada sem ação');
  }],

  ['queda no meio da v3: a retomada termina e a terceira rodada não muda nenhum byte', () => {
    if (process.getuid && process.getuid() === 0) return 'pulado: root ignora permissão';
    const dados = montar({
      index: indexCom(LINHAS_V2),
      marcador: 2,
      coletas: [
        ['cetromaquinas', '2026-07-14', { posts: POSTS }],
        ['maqinox-ind-stria-de-maquinas', '2026-07-14', { posts: POSTS }],
        ['sulpack-industria-de-maquinas-para-embalagens', '2026-07-14', { posts: POSTS }],
        ['tecnox-do-brasil', '2026-07-14', { posts: [], meta: META_V2 }],
      ],
    });
    // Mover uma pasta para outra pasta-mãe reescreve o ".." dela: sem permissão de escrita nela, o rename falha.
    const travada = path.join(dados, 'catalog', 'raw', 'sulpack-industria-de-maquinas-para-embalagens');
    fs.chmodSync(travada, 0o555);
    let r;
    try {
      r = migrar(dados, '--aplicar');
    } finally {
      fs.chmodSync(travada, 0o755);
    }
    assert.ok(r.json, `saída JSON em vez de stack trace: ${r.stderr.slice(0, 300)}`);
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.status, 1, 'exit 1');
    assert.ok(r.json.erro.includes('sulpack-industria-de-maquinas-para-embalagens'), `erro cita a pasta: ${r.json.erro}`);
    assert.ok(existe(dados, 'catalog/raw/linkedin/cetromaquinas') && existe(dados, 'catalog/raw/linkedin/maqinox-ind-stria-de-maquinas'), 'as duas primeiras já foram');
    assert.ok(existe(dados, 'catalog/raw/sulpack-industria-de-maquinas-para-embalagens/2026-07-14/posts.json'), 'a travada ficou no lugar antigo, inteira');
    assert.strictEqual(JSON.parse(ler(dados, '.profills.json')).versao_dados, 2, 'marcador não gravado na queda');
    assert.strictEqual(lerIndex(dados), indexCom(LINHAS_V2), 'INDEX intacto na queda');

    const retomada = aplicarComSucesso(dados);
    assert.deepStrictEqual(
      retomada.acoes.filter((a) => a.tipo === 'mover_coleta').map((a) => path.basename(a.alvo)),
      ['sulpack-industria-de-maquinas-para-embalagens', 'tecnox-do-brasil'],
      'a retomada só move o que faltou',
    );
    assert.strictEqual(lerJson(dados, 'catalog/raw/linkedin/tecnox-do-brasil/2026-07-14/meta.json').concluida, true);
    validarComSucesso(dados, 4);
    assert.strictEqual(JSON.parse(ler(dados, '.profills.json')).versao_dados, 4);
    const antes = hashDaPasta(dados);
    assert.deepStrictEqual(aplicarComSucesso(dados).acoes, [], 'terceira rodada sem ação');
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 da pasta igual');
  }],

  ['pasta v4 com coleta interrompida: concluida false continua false e nada muda', () => {
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 4 });
    const pasta = path.join(dados, 'catalog', 'raw', 'linkedin', 'tecnox-do-brasil', '2026-11-20');
    fs.mkdirSync(pasta, { recursive: true });
    fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify({ slug: 'tecnox-do-brasil', coletado_em: '2026-11-20', janela_dias: 7, concluida: false }, null, 2) + '\n');
    const antes = hashDaPasta(dados);
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(r.acoes, [], 'nada a fazer');
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 da pasta igual');
  }],

  ['empresa com slug linkedin trava a migração sem gravar', () => {
    const dados = montar({ index: indexCom(LINHAS_V2), marcador: 2, coletas: [['linkedin', '2026-07-14', { posts: POSTS }], ['cetromaquinas', '2026-07-14', { posts: POSTS }]] });
    fs.rmdirSync(path.join(dados, 'drafts'));
    const antes = hashDaPasta(dados);
    const r = migrar(dados, '--aplicar');
    assert.strictEqual(r.json.ok, false);
    assert.strictEqual(r.status, 1, 'exit 1');
    assert.deepStrictEqual(r.json.problemas.map((p) => [p.tipo, p.alvo]), [['slug_reservado', path.join('catalog', 'raw', 'linkedin')]]);
    assert.strictEqual(hashDaPasta(dados), antes, 'nenhum byte da pasta mudou');
    assert.ok(!existe(dados, '.backup') && !existe(dados, 'drafts'), 'nem backup nem pasta nova');
  }],

  ['empresa com slug instagram também trava', () => {
    const dados = montar({ index: indexCom(LINHAS_V2), marcador: 2, coletas: [['instagram', '2026-07-14', { posts: POSTS }]] });
    const r = migrar(dados, '--aplicar');
    assert.deepStrictEqual(r.json.problemas.map((p) => p.tipo), ['slug_reservado']);
    assert.ok(existe(dados, 'catalog/raw/instagram/2026-07-14/posts.json'), 'a coleta fica onde estava');
  }],

  ['a mesma empresa no caminho antigo e no novo: problema, e o script não junta as duas', () => {
    const dados = montar({
      index: indexCom(LINHAS_V2),
      marcador: 2,
      coletas: [['cetromaquinas', '2026-07-14', { posts: POSTS }], ['linkedin/cetromaquinas', '2026-08-01', { posts: POSTS }]],
    });
    const antes = hashDaPasta(dados);
    const r = migrar(dados, '--aplicar');
    assert.deepStrictEqual(r.json.problemas.map((p) => [p.tipo, p.alvo]), [['destino_existe', path.join('catalog', 'raw', 'linkedin', 'cetromaquinas')]]);
    assert.strictEqual(hashDaPasta(dados), antes, 'nenhum byte da pasta mudou');
  }],

  ['meta.json ilegível não trava a migração: fica como está, com aviso', () => {
    const dados = montar({ index: indexCom(LINHAS_V2), marcador: 2, coletas: [['tecnox-do-brasil', '2026-07-14', { posts: [], meta: '{ isto não é json' }]] });
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(r.avisos.map((a) => [a.tipo, a.alvo]), [['meta_ilegivel', path.join('catalog', 'raw', 'linkedin', 'tecnox-do-brasil', '2026-07-14', 'meta.json')]]);
    assert.strictEqual(ler(dados, 'catalog/raw/linkedin/tecnox-do-brasil/2026-07-14/meta.json'), '{ isto não é json', 'o arquivo chega como estava');
    assert.strictEqual(JSON.parse(ler(dados, '.profills.json')).versao_dados, 4);
  }],

  // ---------- versão 3: o catálogo sai da linha, o banco derivado sai do git ----------

  ['pasta já na v3 com o campo catálogo: a migração tira só esse campo, e o ⚠ fica inteiro', () => {
    const comCampo = [
      ...LINHAS_V2.map(comInstagram),
      '- [Zeta](zeta.md) — `zeta` · id 9 · setor s · país BR · prioridade Alta · linkedin sim · instagram zeta.br · pesquisa 2026-07-14 · catálogo 2026-08-01 · grupo Z · ⚠ revisar · catálogo 2026-01-01 era parcial',
    ];
    const dados = montar({ index: indexCom(comCampo), marcador: 3 });
    const antes = validar(dados);
    assert.ok(antes.json.problemas.length && antes.json.problemas.every((p) => p.tipo === 'formato_antigo'), `antes da migração a linha com catálogo é formato_antigo: ${JSON.stringify(antes.json.problemas)}`);
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(tiposSemPasta(r), ['converter_indice', 'gravar_marcador'], 'a conversão do índice e o marcador da 4');
    assert.strictEqual(
      lerIndex(dados),
      indexCom([...LINHAS_V2.map(paraV3), '- [Zeta](zeta.md) — `zeta` · id 9 · setor s · país BR · prioridade Alta · linkedin sim · instagram zeta.br · pesquisa 2026-07-14 · grupo Z · ⚠ revisar · catálogo 2026-01-01 era parcial']),
    );
    assert.strictEqual(validarComSucesso(dados, 5).zeta.alerta, 'revisar · catálogo 2026-01-01 era parcial');
    assert.deepStrictEqual(aplicarComSucesso(dados).acoes, [], 'segunda rodada sem ação');
  }],

  ['.gitignore da pasta ganha as linhas do banco derivado, uma vez só', () => {
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 3 });
    const original = '# Seleção ativa é efêmera\nselection.md\nindice.db\n';
    fs.writeFileSync(path.join(dados, '.gitignore'), original);
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(tiposSemPasta(r), ['ignorar_banco', 'gravar_marcador']);
    const novo = ler(dados, '.gitignore');
    assert.ok(novo.startsWith(original), 'o que já estava fica igual, no começo');
    for (const linha of IGNORAR_BANCO) assert.strictEqual(novo.split('\n').filter((l) => l === linha).length, 1, `${linha} aparece uma vez`);
    assert.strictEqual(ler(dados, `.backup/${HOJE}/.gitignore`), original, 'backup do .gitignore de antes');
    const depois = hashDaPasta(dados);
    assert.deepStrictEqual(aplicarComSucesso(dados).acoes, [], 'segunda rodada sem ação');
    assert.strictEqual(hashDaPasta(dados), depois, 'sha256 da pasta igual');
  }],

  ['pasta sem .gitignore (fora de um repo) não ganha um', () => {
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 3 });
    assert.deepStrictEqual(tiposSemPasta(aplicarComSucesso(dados)), ['gravar_marcador']);
    assert.ok(!existe(dados, '.gitignore'));
  }],

  // ---------- versão 4: as instruções vão para o AGENTS.md, e o CLAUDE.md só o importa ----------

  ['v3 → v4: o CLAUDE.md antigo vai byte a byte para o AGENTS.md, com as notas, e vira o import', () => {
    // BOM, CRLF e acento: o texto do comercial tem de chegar igual, sem normalizar nada.
    const antigo = BOM + '<!-- profills:fixo:inicio -->\r\nregras\r\n<!-- profills:fixo:fim -->\r\n\r\n## Notas da equipe\r\n\r\n- 2026-10-01: só posts sobre manutenção preventiva.\r\n';
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 3, claude: antigo });
    const simulado = migrar(dados);
    const acao = simulado.json.acoes.find((a) => a.tipo === 'mover_instrucoes');
    assert.deepStrictEqual({ de: acao.de, alvo: acao.alvo }, { de: 'CLAUDE.md', alvo: 'AGENTS.md' }, 'a ação diz de onde e para onde');
    assert.ok(typeof acao.detalhe === 'string' && acao.detalhe.length > 0, 'a ação traz o detalhe');
    assert.strictEqual(ler(dados, 'CLAUDE.md'), antigo, 'a simulação não grava');
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(tiposSemPasta(r), ['mover_instrucoes', 'gravar_marcador']);
    assert.ok(fs.readFileSync(path.join(dados, 'AGENTS.md')).equals(Buffer.from(antigo, 'utf8')), 'AGENTS.md igual ao CLAUDE.md antigo, byte a byte');
    assert.strictEqual(ler(dados, 'CLAUDE.md'), '@AGENTS.md\n', 'CLAUDE.md só com o import');
    assert.strictEqual(ler(dados, `.backup/${HOJE}/CLAUDE.md`), antigo, 'backup do CLAUDE.md antigo');
    assert.strictEqual(r.backup, path.join(dados, '.backup', HOJE), 'saída aponta a pasta do backup');
    assert.strictEqual(lerJson(dados, '.profills.json').versao_dados, 4);
    const antes = hashDaPasta(dados);
    assert.deepStrictEqual(aplicarComSucesso(dados).acoes, [], 'segunda rodada sem ação');
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 da pasta igual');
  }],

  ['pasta já marcada 4 com o CLAUDE.md antigo ainda termina a conversão', () => {
    const antigo = '# Minhas anotações\n\n## Notas da equipe\n\n- tom formal.\n';
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 4, claude: antigo });
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(tiposSemPasta(r), ['mover_instrucoes'], 'só a conversão; o marcador já está na 4');
    assert.strictEqual(ler(dados, 'AGENTS.md'), antigo);
    assert.strictEqual(ler(dados, 'CLAUDE.md'), '@AGENTS.md\n');
  }],

  ['queda entre as duas gravações (AGENTS.md igual ao CLAUDE.md antigo): a retomada só troca o CLAUDE.md', () => {
    const antigo = '# Regras\n\n## Notas da equipe\n\n- nota que não pode sumir.\n';
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 3, claude: antigo, agents: antigo });
    const r = aplicarComSucesso(dados);
    assert.deepStrictEqual(tiposSemPasta(r), ['mover_instrucoes', 'gravar_marcador']);
    assert.strictEqual(ler(dados, 'AGENTS.md'), antigo, 'AGENTS.md continua com o texto');
    assert.strictEqual(ler(dados, 'CLAUDE.md'), '@AGENTS.md\n');
    assert.deepStrictEqual(aplicarComSucesso(dados).acoes, [], 'segunda rodada sem ação');
  }],

  ['CLAUDE.md antigo e AGENTS.md com textos diferentes: problema, e nada é gravado', () => {
    const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 3, claude: '## Notas da equipe\n\n- nota do CLAUDE.md.\n', agents: '## Notas da equipe\n\n- nota do AGENTS.md.\n' });
    const antes = hashDaPasta(dados);
    const r = migrar(dados, '--aplicar');
    assert.strictEqual(r.json.ok, false, 'ok false');
    assert.strictEqual(r.status, 1, 'exit 1');
    const p = r.json.problemas.find((x) => x.tipo === 'instrucoes_em_dois_arquivos');
    assert.ok(p, `problema instrucoes_em_dois_arquivos: ${JSON.stringify(r.json.problemas)}`);
    assert.ok(p.detalhe.includes(path.join(dados, 'CLAUDE.md')) && p.detalhe.includes(path.join(dados, 'AGENTS.md')), `detalhe cita os dois caminhos: ${p.detalhe}`);
    assert.strictEqual(hashDaPasta(dados), antes, 'nenhum byte da pasta mudou');
    assert.ok(!existe(dados, '.backup'), 'nenhum backup criado');
  }],

  ['pasta v3 sem CLAUDE.md, ou com o import, só ganha o marcador 4', () => {
    for (const claude of [undefined, '@AGENTS.md\n', BOM + '@AGENTS.md\r\n']) {
      const dados = montar({ index: indexCom(LINHAS_V2.map(paraV3)), marcador: 3, claude });
      const r = aplicarComSucesso(dados);
      assert.deepStrictEqual(tiposSemPasta(r), ['gravar_marcador'], `só o marcador (CLAUDE.md ${JSON.stringify(claude)})`);
      assert.strictEqual(lerJson(dados, '.profills.json').versao_dados, 4);
      assert.ok(!existe(dados, 'AGENTS.md'), 'o AGENTS.md fica para o mapa.js');
      assert.strictEqual(existe(dados, 'CLAUDE.md') ? ler(dados, 'CLAUDE.md') : undefined, claude, 'CLAUDE.md como estava');
    }
  }],
];

let falhas = 0;
for (const [nome, caso] of casos) {
  try {
    const nota = caso();
    console.log(`ok     ${nome}${nota ? ` (${nota})` : ''}`);
  } catch (e) {
    falhas++;
    console.log(`FALHA  ${nome}: ${e.message.split('\n')[0]}`);
  }
}
console.log(`${casos.length - falhas}/${casos.length} casos passaram`);
process.exit(falhas ? 1 : 0);
