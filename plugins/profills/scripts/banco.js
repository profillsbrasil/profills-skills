#!/usr/bin/env node
// banco.js — o banco derivado DADOS/indice.db (Node >= 22.13, sem dependência).
// Os arquivos de DADOS são a fonte de tudo; o banco é um índice deles para as consultas que cruzam
// coletas, e nenhum dado nasce só nele. Este script cria ou atualiza o banco a partir do refs/INDEX.md
// (lido pelo parser do indice.js da profills-radar) e das coletas em catalog/raw/<rede>/<conta>/<data>/
// (lidas pelo coleta.js), relendo só a conta cujos arquivos mudaram, e roda uma consulta SQL só de
// leitura. Apagar o indice.db não perde nada: a próxima chamada o refaz.
// Uso:     node scripts/banco.js <DADOS>                          # cria ou atualiza
//          node scripts/banco.js <DADOS> --checar                 # diz se está velho, sem gravar
//          node scripts/banco.js <DADOS> --refazer                # refaz do zero
//          node scripts/banco.js <DADOS> --consultar "<SQL>" [--limite N]
// Exemplo: node scripts/banco.js "$HOME/Profills LinkedIn" --consultar "SELECT count(*) AS n FROM post"
//          → {"acao":"consultar","linhas":[{"n":12}],"n_linhas":1,"truncado":false,"ok":true,...}
// Saída: JSON em stdout. Exit 0 = ok · 1 = Node antigo, consulta recusada ou SQL inválido (campo
// problemas) · 2 = erro de uso.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const indice = require(path.join(__dirname, '..', 'skills', 'profills-radar', 'scripts', 'indice.js'));
const { REDES, lerColeta, datasDaConta } = require(path.join(__dirname, 'coleta.js'));
const { numeroBr, analisaEngajamento } = require(path.join(__dirname, '..', 'skills', 'profills-garimpo', 'scripts', 'metricas.js'));

const ARQUIVO = 'indice.db';
// Mudou o schema abaixo: suba a versão. O banco de versão diferente é refeito na próxima chamada.
const VERSAO_SCHEMA = '1';
const LIMITE_PADRAO = 200;
// Outra sessão gravando segura o banco por alguns ms; sem espera, a segunda daria "database is locked".
const ESPERA_MS = 10000;

// Uma linha por coisa que existe nos arquivos; ids inteiros são do banco e mudam a cada refação.
const SCHEMA = `
CREATE TABLE meta (chave TEXT PRIMARY KEY, valor TEXT NOT NULL);
-- O que foi lido de cada fonte: refs/INDEX.md e cada catalog/raw/<rede>/<conta>, com a assinatura dos arquivos.
CREATE TABLE fonte (chave TEXT PRIMARY KEY, assinatura TEXT NOT NULL);
-- Uma linha do refs/INDEX.md.
CREATE TABLE empresa (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  arquivo TEXT NOT NULL,
  id_linkedin TEXT,
  setor TEXT,
  pais TEXT,
  prioridade TEXT,
  linkedin INTEGER NOT NULL,
  instagram TEXT,
  pesquisa TEXT,
  grupo TEXT,
  alerta TEXT
);
-- A página de uma empresa numa rede: o slug no LinkedIn, o handle no Instagram. Vem da linha do índice
-- ou de uma pasta de coleta; pasta sem linha no índice fica com empresa_id null.
CREATE TABLE conta (
  id INTEGER PRIMARY KEY,
  empresa_id INTEGER REFERENCES empresa (id),
  rede TEXT NOT NULL CHECK (rede IN ('linkedin', 'instagram')),
  handle TEXT NOT NULL,
  UNIQUE (rede, handle)
);
-- Uma pasta de data. concluida: 1 ou 0 pelo meta.json, null sem meta.json legível (a coleta de 2026-07).
-- catalogo: 1 quando a coleta vira catálogo, pela regra do coleta.js.
CREATE TABLE coleta (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES conta (id),
  data TEXT NOT NULL,
  pasta TEXT NOT NULL,
  status TEXT,
  concluida INTEGER,
  catalogo INTEGER NOT NULL,
  seguidores INTEGER,
  seguidores_arredondado INTEGER,
  janela_dias INTEGER,
  nota TEXT,
  erro TEXT,
  UNIQUE (conta_id, data)
);
-- Um post, uma vez por conta, com os campos da coleta mais nova que o viu. id_externo é o post_id, ou a
-- url sem query quando falta. hashtags é a lista em JSON.
CREATE TABLE post (
  id INTEGER PRIMARY KEY,
  conta_id INTEGER NOT NULL REFERENCES conta (id),
  id_externo TEXT NOT NULL,
  url TEXT,
  data TEXT,
  idioma TEXT,
  resumo_pt TEXT,
  texto TEXT,
  formato TEXT,
  framework_carrossel TEXT,
  hook TEXT,
  hook_categoria TEXT,
  hook_cabe_no_corte INTEGER,
  cta TEXT,
  hashtags TEXT,
  link_externo TEXT,
  artigo_titulo TEXT,
  angulo TEXT,
  gatilho_psicologico TEXT,
  tom TEXT,
  descricao_visual TEXT,
  screenshot TEXT,
  UNIQUE (conta_id, id_externo)
);
CREATE INDEX post_data ON post (data);
-- O número de um post visto numa coleta: o mesmo post em duas coletas tem duas linhas. Contador que não
-- deu para ler fica null, não zero.
CREATE TABLE metrica (
  post_id INTEGER NOT NULL REFERENCES post (id),
  coleta_id INTEGER NOT NULL REFERENCES coleta (id),
  likes INTEGER,
  comentarios INTEGER,
  reposts INTEGER,
  destaque_semana INTEGER,
  PRIMARY KEY (post_id, coleta_id)
) WITHOUT ROWID;
CREATE INDEX metrica_coleta ON metrica (coleta_id);
`;
// Ordem de apagar: quem aponta vem antes de quem é apontado.
const TABELAS = ['metrica', 'post', 'coleta', 'conta', 'empresa', 'fonte', 'meta'];

function morrer(mensagem) {
  process.stderr.write(mensagem + '\n');
  process.exit(2);
}

// ---------- Node e node:sqlite ----------

// node:sqlite existe sem flag desde a 22.13 e a 23.4.
function nodeSuportado(versao) {
  const [maior, menor] = String(versao).split('.').map(Number);
  if (maior === 22) return menor >= 13;
  if (maior === 23) return menor >= 4;
  return maior > 23;
}

// Antes da 24.15 (e entre a 25.0 e a 25.6) o require imprime ExperimentalWarning no stderr. Só esse
// aviso é calado; qualquer outro segue para o stderr.
function carregarSqlite() {
  const emitir = process.emitWarning;
  process.emitWarning = function (aviso, ...resto) {
    const tipo = typeof resto[0] === 'string' ? resto[0] : resto[0] && resto[0].type;
    if (tipo === 'ExperimentalWarning' && /sqlite/i.test(String((aviso && aviso.message) || aviso))) return;
    return emitir.call(process, aviso, ...resto);
  };
  try {
    return require('node:sqlite').DatabaseSync;
  } finally {
    process.emitWarning = emitir;
  }
}

// ---------- o disco ----------

function carimbo(caminho) {
  try {
    const s = fs.statSync(caminho);
    return `${s.size}:${s.mtimeMs}`;
  } catch (e) {
    return '-';
  }
}

const hash = (texto) => crypto.createHash('sha1').update(texto).digest('hex');
const chaveDaConta = (rede, handle) => `${rede}/${handle}`;
const pastaRelativa = (...partes) => partes.join('/');

// Barato: só stat. Uma conta muda quando muda o tamanho ou a hora de um meta.json ou posts.json dela,
// ou quando uma pasta de data aparece ou some.
function lerDisco(dados) {
  const contas = new Map();
  for (const rede of REDES) {
    const raiz = path.join(dados, 'catalog', 'raw', rede);
    let nomes = [];
    try {
      nomes = fs.readdirSync(raiz, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort();
    } catch (e) {
      nomes = [];
    }
    for (const handle of nomes) {
      const pasta = path.join(raiz, handle);
      const datas = datasDaConta(pasta);
      const partes = datas.map((d) => `${d}|${carimbo(path.join(pasta, d, 'meta.json'))}|${carimbo(path.join(pasta, d, 'posts.json'))}`);
      contas.set(chaveDaConta(rede, handle), { rede, handle, pasta, datas, assinatura: hash(partes.join('\n')) });
    }
  }
  return { indice: carimbo(path.join(dados, 'refs', 'INDEX.md')), contas };
}

function diferencas(disco, fontes) {
  const contas = [...disco.contas.keys()].filter((k) => fontes.get(`catalog/raw/${k}`) !== disco.contas.get(k).assinatura);
  const removidas = [...fontes.keys()]
    .filter((k) => k.startsWith('catalog/raw/'))
    .map((k) => k.slice('catalog/raw/'.length))
    .filter((k) => !disco.contas.has(k))
    .sort();
  return { indice: fontes.get('refs/INDEX.md') !== disco.indice, contas, removidas };
}

// As empresas do INDEX.md, pelo parser da profills-radar. Validar a linha é trabalho da radar: aqui
// só fica de fora a linha que nem o parser lê.
function lerEmpresas(dados, avisos) {
  const caminho = path.join(dados, 'refs', 'INDEX.md');
  if (!fs.existsSync(caminho)) return [];
  const vistos = new Set();
  const empresas = [];
  indice
    .lerTexto(caminho)
    .split('\n')
    .forEach((texto, i) => {
      if (!indice.RE_ITEM.test(texto)) return;
      const r = indice.parsearLinha(texto, i + 1);
      if (r.erro) return avisos.push({ tipo: 'linha_ilegivel', linha: i + 1, detalhe: 'a linha do refs/INDEX.md não segue o formato; a empresa fica fora do banco até a profills-radar corrigir' });
      if (vistos.has(r.empresa.slug)) return avisos.push({ tipo: 'slug_repetido', linha: i + 1, detalhe: `o slug "${r.empresa.slug}" já apareceu antes no refs/INDEX.md; vale a primeira linha` });
      vistos.add(r.empresa.slug);
      empresas.push(r.empresa);
    });
  return empresas;
}

// ---------- valores ----------

const texto = (v) => (v === null || v === undefined ? null : typeof v === 'string' ? v : JSON.stringify(v));
const booleano = (v) => (v === true ? 1 : v === false ? 0 : null);
const inteiro = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const r = numeroBr(v);
  return r.invalido ? null : Math.round(r.valor);
};
const normalizarUrl = (u) => (typeof u === 'string' && u.trim() ? u.trim().split(/[?#]/)[0].replace(/\/+$/, '') : null);
const idExterno = (p) => (typeof p.post_id === 'string' && p.post_id.trim() ? p.post_id.trim() : normalizarUrl(p.url));

// ---------- o banco ----------

const CORROMPIDO = /not a database|malformed|file is encrypted/i;

function remover(arquivo) {
  for (const f of [arquivo, `${arquivo}-wal`, `${arquivo}-shm`]) fs.rmSync(f, { force: true });
}

// Abre e confere que o arquivo é um banco. O que não é banco é apagado: o banco é derivado.
function abrir(DatabaseSync, arquivo, { somenteLeitura = false } = {}) {
  const conectar = () => {
    const db = new DatabaseSync(arquivo, somenteLeitura ? { readOnly: true } : {});
    db.exec(`PRAGMA busy_timeout = ${ESPERA_MS}`);
    db.prepare('SELECT count(*) AS n FROM sqlite_master').get();
    return db;
  };
  try {
    return { db: conectar(), corrompido: false };
  } catch (e) {
    if (!CORROMPIDO.test(e.message)) throw e;
    if (somenteLeitura) return { db: null, corrompido: true };
    remover(arquivo);
    return { db: conectar(), corrompido: true };
  }
}

const dormir = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);

// Trocar o banco novo para WAL pede o arquivo só para si, e o SQLite não espera o busy_timeout nesse
// ponto: duas sessões abrindo o banco novo juntas dariam "database is locked". Aqui a espera é à mão.
function ligarWal(db) {
  const limite = Date.now() + ESPERA_MS;
  for (;;) {
    try {
      if (db.prepare('PRAGMA journal_mode').get().journal_mode !== 'wal') db.exec('PRAGMA journal_mode = WAL');
      return;
    } catch (e) {
      if (!/locked|busy/i.test(e.message) || Date.now() > limite) throw e;
      dormir(20);
    }
  }
}

function versaoDoBanco(db) {
  const temMeta = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'meta'").get();
  if (!temMeta) return null;
  const v = db.prepare("SELECT valor FROM meta WHERE chave = 'schema'").get();
  return v ? v.valor : null;
}

function recriar(db) {
  for (const t of TABELAS) db.exec(`DROP TABLE IF EXISTS ${t}`);
  db.exec(SCHEMA);
  db.prepare("INSERT INTO meta (chave, valor) VALUES ('schema', ?)").run(VERSAO_SCHEMA);
}

function preparar(db) {
  const p = (sql) => db.prepare(sql);
  return {
    empresa: p(`INSERT INTO empresa (slug, nome, arquivo, id_linkedin, setor, pais, prioridade, linkedin, instagram, pesquisa, grupo, alerta)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    conta: p(`INSERT INTO conta (rede, handle) VALUES (?, ?)
      ON CONFLICT (rede, handle) DO UPDATE SET handle = excluded.handle RETURNING id`),
    contaDe: p('SELECT id FROM conta WHERE rede = ? AND handle = ?'),
    coleta: p(`INSERT INTO coleta (conta_id, data, pasta, status, concluida, catalogo, seguidores, seguidores_arredondado, janela_dias, nota, erro)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id`),
    post: p(`INSERT INTO post (conta_id, id_externo, url, data, idioma, resumo_pt, texto, formato, framework_carrossel, hook, hook_categoria,
        hook_cabe_no_corte, cta, hashtags, link_externo, artigo_titulo, angulo, gatilho_psicologico, tom, descricao_visual, screenshot)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (conta_id, id_externo) DO UPDATE SET url = excluded.url, data = excluded.data, idioma = excluded.idioma,
        resumo_pt = excluded.resumo_pt, texto = excluded.texto, formato = excluded.formato, framework_carrossel = excluded.framework_carrossel,
        hook = excluded.hook, hook_categoria = excluded.hook_categoria, hook_cabe_no_corte = excluded.hook_cabe_no_corte, cta = excluded.cta,
        hashtags = excluded.hashtags, link_externo = excluded.link_externo, artigo_titulo = excluded.artigo_titulo, angulo = excluded.angulo,
        gatilho_psicologico = excluded.gatilho_psicologico, tom = excluded.tom, descricao_visual = excluded.descricao_visual,
        screenshot = excluded.screenshot
      RETURNING id`),
    metrica: p('INSERT INTO metrica (post_id, coleta_id, likes, comentarios, reposts, destaque_semana) VALUES (?, ?, ?, ?, ?, ?)'),
    apagarMetricas: p('DELETE FROM metrica WHERE coleta_id IN (SELECT id FROM coleta WHERE conta_id = ?)'),
    apagarPosts: p('DELETE FROM post WHERE conta_id = ?'),
    apagarColetas: p('DELETE FROM coleta WHERE conta_id = ?'),
    fonte: p('INSERT INTO fonte (chave, assinatura) VALUES (?, ?) ON CONFLICT (chave) DO UPDATE SET assinatura = excluded.assinatura'),
    apagarFonte: p('DELETE FROM fonte WHERE chave = ?'),
  };
}

function gravarEmpresas(db, q, empresas) {
  db.exec('UPDATE conta SET empresa_id = NULL; DELETE FROM empresa;');
  for (const e of empresas) {
    q.empresa.run(e.slug, e.nome, e.arquivo, e.id && e.id !== '—' ? e.id : null, e.setor, e.pais, e.prioridade, e.linkedin === false ? 0 : 1, e.instagram, e.pesquisa, e.grupo, e.alerta);
    if (e.linkedin !== false) q.conta.get('linkedin', e.slug);
    if (e.instagram) q.conta.get('instagram', e.instagram);
  }
}

function esvaziarConta(q, rede, handle) {
  const c = q.contaDe.get(rede, handle);
  if (!c) return;
  q.apagarMetricas.run(c.id);
  q.apagarPosts.run(c.id);
  q.apagarColetas.run(c.id);
}

// Relê todas as coletas da conta, da mais antiga para a mais nova: o post fica com os campos da mais nova.
function gravarConta(q, conta, avisos) {
  esvaziarConta(q, conta.rede, conta.handle);
  const contaId = q.conta.get(conta.rede, conta.handle).id;
  for (const data of conta.datas) {
    const c = lerColeta(path.join(conta.pasta, data));
    const pasta = pastaRelativa('catalog', 'raw', conta.rede, conta.handle, data);
    const m = c.meta || {};
    const coletaId = q.coleta.get(contaId, data, pasta, c.status, booleano(c.concluida), c.catalogo ? 1 : 0, inteiro(m.seguidores), booleano(m.seguidores_arredondado), inteiro(m.janela_dias), texto(m.nota), c.erro).id;
    if (c.erro) avisos.push({ tipo: 'coleta_com_erro', pasta, detalhe: c.erro });
    const vistos = new Set();
    for (const p of c.posts || []) {
      const chave = idExterno(p);
      if (!chave) {
        avisos.push({ tipo: 'post_sem_chave', pasta, detalhe: 'um post sem post_id nem url ficou fora do banco' });
        continue;
      }
      if (vistos.has(chave)) {
        avisos.push({ tipo: 'post_repetido', pasta, detalhe: `o post ${chave} aparece mais de uma vez na coleta: conta uma vez só` });
        continue;
      }
      vistos.add(chave);
      const idioma = typeof p.idioma === 'string' && p.idioma.trim() ? p.idioma.trim().toLowerCase() : null;
      const postId = q.post.get(
        contaId, chave, texto(p.url), texto(p.data), idioma, texto(p.resumo_pt), texto(p.texto), texto(p.formato), texto(p.framework_carrossel),
        texto(p.hook), texto(p.hook_categoria), booleano(p.hook_cabe_no_corte), texto(p.cta), Array.isArray(p.hashtags) ? JSON.stringify(p.hashtags) : texto(p.hashtags),
        texto(p.link_externo), texto(p.artigo_titulo), texto(p.angulo), texto(p.gatilho_psicologico), texto(p.tom), texto(p.descricao_visual), texto(p.screenshot),
      ).id;
      const e = analisaEngajamento(p);
      q.metrica.run(postId, coletaId, e.invalido ? null : e.likes, e.invalido ? null : e.comentarios, e.invalido ? null : e.reposts, booleano(p.destaque_semana));
    }
  }
}

// A conta da linha do índice ganha a empresa dela; a conta que ficou sem empresa e sem coleta sai.
function religar(db) {
  db.exec(`
    UPDATE conta SET empresa_id = (
      SELECT e.id FROM empresa e
      WHERE (conta.rede = 'linkedin' AND e.linkedin = 1 AND e.slug = conta.handle)
         OR (conta.rede = 'instagram' AND e.instagram = conta.handle)
      ORDER BY e.id LIMIT 1);
    DELETE FROM conta WHERE empresa_id IS NULL AND NOT EXISTS (SELECT 1 FROM coleta WHERE coleta.conta_id = conta.id);
  `);
}

function totais(db) {
  const n = (t) => db.prepare(`SELECT count(*) AS n FROM ${t}`).get().n;
  return { empresas: n('empresa'), contas: n('conta'), coletas: n('coleta'), posts: n('post'), metricas: n('metrica') };
}

// ---------- ações ----------

function atualizar(DatabaseSync, dados, { refazer = false } = {}) {
  const inicio = performance.now();
  const arquivo = path.join(dados, ARQUIVO);
  // O disco é lido antes do lock: o tempo com o banco travado é só o de gravar.
  const disco = lerDisco(dados);
  const { db, corrompido } = abrir(DatabaseSync, arquivo);
  const avisos = [];
  let refeito = null;
  let mudancas;
  try {
    ligarWal(db);
    db.exec('PRAGMA synchronous = NORMAL; PRAGMA foreign_keys = ON;');
    // A transação é tomada antes de ler o estado do banco: quem esperou a vez lê o que a outra sessão gravou.
    db.exec('BEGIN IMMEDIATE');
    try {
      const vazio = db.prepare("SELECT count(*) AS n FROM sqlite_master WHERE type = 'table'").get().n === 0;
      if (refazer) refeito = 'pedido';
      else if (corrompido) refeito = 'banco_corrompido';
      else if (vazio) refeito = 'banco_ausente';
      else if (versaoDoBanco(db) !== VERSAO_SCHEMA) refeito = 'schema_novo';
      if (refeito) recriar(db);
      const fontes = new Map(db.prepare('SELECT chave, assinatura FROM fonte').all().map((f) => [f.chave, f.assinatura]));
      mudancas = diferencas(disco, fontes);
      const q = preparar(db);
      if (mudancas.indice) {
        gravarEmpresas(db, q, lerEmpresas(dados, avisos));
        q.fonte.run('refs/INDEX.md', disco.indice);
      }
      for (const k of mudancas.removidas) {
        const [rede, handle] = k.split('/');
        esvaziarConta(q, rede, handle);
        q.apagarFonte.run(`catalog/raw/${k}`);
      }
      for (const k of mudancas.contas) {
        const conta = disco.contas.get(k);
        gravarConta(q, conta, avisos);
        q.fonte.run(`catalog/raw/${k}`, conta.assinatura);
      }
      if (mudancas.indice || mudancas.contas.length || mudancas.removidas.length) religar(db);
      db.exec('COMMIT');
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
    return { acao: refazer ? 'refazer' : 'atualizar', dados, arquivo, refeito, mudancas, totais: totais(db), avisos, ms: Math.round(performance.now() - inicio), ok: true };
  } finally {
    db.close();
  }
}

function checar(DatabaseSync, dados) {
  const arquivo = path.join(dados, ARQUIVO);
  const disco = lerDisco(dados);
  const saida = { acao: 'checar', dados, arquivo, existe: fs.existsSync(arquivo), velho: true, motivo: null, mudancas: null, ok: true };
  if (!saida.existe) return { ...saida, motivo: 'banco_ausente' };
  const { db, corrompido } = abrir(DatabaseSync, arquivo, { somenteLeitura: true });
  if (corrompido) return { ...saida, motivo: 'banco_corrompido' };
  try {
    if (versaoDoBanco(db) !== VERSAO_SCHEMA) return { ...saida, motivo: 'schema_novo' };
    const fontes = new Map(db.prepare('SELECT chave, assinatura FROM fonte').all().map((f) => [f.chave, f.assinatura]));
    const mudancas = diferencas(disco, fontes);
    const velho = mudancas.indice || mudancas.contas.length > 0 || mudancas.removidas.length > 0;
    return { ...saida, velho, motivo: velho ? 'arquivos_mudaram' : null, mudancas };
  } finally {
    db.close();
  }
}

// Atualiza antes, e consulta por uma conexão só de leitura: escrita nenhuma passa, nem por ATTACH.
function consultar(DatabaseSync, dados, sql, limite) {
  const atualizacao = atualizar(DatabaseSync, dados);
  const saida = { acao: 'consultar', dados, arquivo: atualizacao.arquivo, sql, atualizacao: { refeito: atualizacao.refeito, mudancas: atualizacao.mudancas, avisos: atualizacao.avisos }, linhas: [], n_linhas: 0, truncado: false, problemas: [], ok: false };
  const { db } = abrir(DatabaseSync, atualizacao.arquivo, { somenteLeitura: true });
  try {
    const linhas = db.prepare(sql).all();
    saida.n_linhas = linhas.length;
    saida.truncado = linhas.length > limite;
    saida.linhas = linhas.slice(0, limite).map((l) => ({ ...l }));
  } catch (e) {
    const tipo = /readonly|read-only/i.test(e.message) ? 'consulta_so_leitura' : 'sql_invalido';
    const detalhe = tipo === 'consulta_so_leitura' ? `a consulta tentou gravar (${e.message}): o banco é derivado e só se lê; o que muda vai para os arquivos de DADOS` : e.message;
    saida.problemas.push({ tipo, detalhe });
  } finally {
    db.close();
  }
  saida.ok = saida.problemas.length === 0;
  return saida;
}

// ---------- argumentos ----------

const USO = 'Uso: node scripts/banco.js <DADOS> [--checar | --refazer | --consultar "<SQL>" [--limite N]]';

function principal(argv) {
  const args = argv.slice(2);
  let dados = null;
  let acao = 'atualizar';
  let sql = null;
  let limite = LIMITE_PADRAO;
  const escolher = (nova) => {
    if (acao !== 'atualizar') morrer(`Use uma ação só: --checar, --refazer ou --consultar. ${USO}`);
    acao = nova;
  };
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--checar') escolher('checar');
    else if (a === '--refazer') escolher('refazer');
    else if (a === '--consultar') {
      escolher('consultar');
      sql = args[++i];
      if (!sql || !sql.trim()) morrer(`--consultar precisa do SQL entre aspas. ${USO}`);
    } else if (a === '--limite') {
      limite = Number(args[++i]);
      if (!Number.isInteger(limite) || limite < 1) morrer(`--limite precisa de um número inteiro maior que zero. ${USO}`);
    } else if (a.startsWith('--')) morrer(`Opção desconhecida: ${a}. ${USO}`);
    else if (dados === null) dados = a;
    else morrer(`Argumento sobrando: ${a}. ${USO}`);
  }
  if (!dados) morrer(USO);
  dados = path.resolve(dados);
  if (!fs.existsSync(dados) || !fs.statSync(dados).isDirectory()) morrer(`A pasta de dados ${dados} não existe.`);

  const fim = (saida) => {
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
    process.exit(saida.ok ? 0 : 1);
  };
  if (!nodeSuportado(process.versions.node)) {
    return fim({
      acao,
      dados,
      problemas: [{ tipo: 'node_antigo', versao: process.versions.node, minimo: '22.13.0', detalhe: `o Node ${process.versions.node} não tem node:sqlite; o banco precisa do Node 22.13 ou mais novo: a profills-setup conduz a atualização` }],
      ok: false,
    });
  }
  const DatabaseSync = carregarSqlite();
  if (acao === 'checar') return fim(checar(DatabaseSync, dados));
  if (acao === 'consultar') return fim(consultar(DatabaseSync, dados, sql, limite));
  return fim(atualizar(DatabaseSync, dados, { refazer: acao === 'refazer' }));
}

module.exports = { nodeSuportado, VERSAO_SCHEMA, ARQUIVO };

if (require.main === module) principal(process.argv);
