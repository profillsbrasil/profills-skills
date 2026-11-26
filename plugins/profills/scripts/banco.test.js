#!/usr/bin/env node
// banco.test.js — o banco derivado DADOS/indice.db, rodado pelo terminal como as skills rodam.
// Uso: node plugins/profills/scripts/banco.test.js   (Node >= 22.13, sem dependência)
// Cada caso monta uma pasta DADOS temporária, roda banco.js como processo e confere o JSON.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn, spawnSync } = require('child_process');

const BANCO = path.join(__dirname, 'banco.js');
const INDICE = path.join(__dirname, '..', 'skills', 'profills-radar', 'scripts', 'indice.js');
const HOJE = '2026-11-26';

const CABECALHO = ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', ''];
const linha = (nome, slug, { prioridade = 'Alta', linkedin = 'sim', instagram = '—', grupo } = {}) =>
  `- [${nome}](${slug}.md) — \`${slug}\` · id — · setor caixas · país BR · prioridade ${prioridade} · linkedin ${linkedin} · instagram ${instagram} · pesquisa 2026-11-01${grupo ? ` · grupo ${grupo}` : ''}`;

function escreverIndex(dados, linhas) {
  fs.mkdirSync(path.join(dados, 'refs'), { recursive: true });
  fs.writeFileSync(path.join(dados, 'refs', 'INDEX.md'), [...CABECALHO, ...linhas, ''].join('\n'));
  for (const l of linhas) fs.writeFileSync(path.join(dados, 'refs', l.match(/\]\(([^)]+)\)/)[1]), '# ficha\n');
}

// meta e posts: objeto/array vira JSON; undefined não grava o arquivo.
function coletar(dados, rede, conta, data, { meta, posts } = {}) {
  const pasta = path.join(dados, 'catalog', 'raw', rede, conta, data);
  fs.mkdirSync(pasta, { recursive: true });
  if (meta !== undefined) fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify(meta));
  if (posts !== undefined) fs.writeFileSync(path.join(pasta, 'posts.json'), JSON.stringify(posts));
  return pasta;
}

const OK = { status: 'ok', concluida: true, janela_dias: 7 };
const post = (n, extra = {}) => ({ post_id: `urn:li:activity:${n}`, url: `https://www.linkedin.com/feed/update/urn:li:activity:${n}/`, data: '2026-10-30', hook: `hook ${n}`, engajamento: { likes: 10, comentarios: 1, reposts: 0 }, ...extra });

// Três empresas, cinco contas (uma só no disco, uma só no índice), seis coletas, seis posts, oito métricas.
function montarDados() {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'banco-test-'));
  escreverIndex(dados, [
    linha('Alfa', 'alfa', { instagram: 'alfa.br' }),
    linha('Beta', 'beta', { prioridade: 'a definir' }),
    linha('Gama', 'gama', { linkedin: 'não', instagram: 'gama.ig' }),
  ]);
  coletar(dados, 'linkedin', 'alfa', '2026-07-14', { posts: [post(1), post(2, { hook: 'hook antigo' })] });
  coletar(dados, 'linkedin', 'alfa', '2026-11-01', {
    meta: { ...OK, seguidores: '6 mil', seguidores_arredondado: true },
    posts: [post(2, { engajamento: { likes: '1,2 mil', comentarios: 3, reposts: 1 } }), post(3)],
  });
  coletar(dados, 'linkedin', 'alfa', '2026-11-05', { meta: { status: 'ok', concluida: false }, posts: [post(3, { engajamento: { likes: 'muitos' } })] });
  coletar(dados, 'linkedin', 'beta', '2026-11-01', { meta: { status: 'sem_posts', concluida: true, nota: 'parada' }, posts: [] });
  coletar(dados, 'linkedin', 'orfa', '2026-11-01', {
    meta: OK,
    posts: [post(9), { url: 'https://www.linkedin.com/posts/orfa-q2?utm=x', data: '2026-10-29' }, { texto: 'sem post_id nem url' }],
  });
  coletar(dados, 'instagram', 'alfa.br', '2026-11-02', { meta: OK, posts: [{ post_id: 'DA1xYz', url: 'https://www.instagram.com/p/DA1xYz/', data: '2026-11-01' }] });
  return dados;
}

function rodar(dados, ...args) {
  const r = spawnSync(process.execPath, [BANCO, dados, ...args], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  assert.ok(json, `banco.js não devolveu JSON: ${r.stdout.slice(0, 200)} ${r.stderr.slice(0, 300)}`);
  assert.strictEqual(r.stderr, '', 'stderr vazio: nem aviso de experimental, nem stack trace');
  return { ...json, exit: r.status };
}

const atualizar = (dados) => rodar(dados);
function consultar(dados, sql, ...args) {
  const r = rodar(dados, '--consultar', sql, ...args);
  assert.strictEqual(r.ok, true, JSON.stringify(r.problemas));
  return r.linhas;
}
const linhasDe = (dados, sql) => consultar(dados, sql, '--limite', '100000').map((l) => Object.values(l));

// O conteúdo pelo que tem nome fora do banco (slug, rede, conta, data, id do post), nunca pelo id inteiro.
const CONTEUDO = [
  'SELECT slug, nome, arquivo, id_linkedin, setor, pais, prioridade, linkedin, instagram, pesquisa, grupo, alerta FROM empresa ORDER BY slug',
  'SELECT c.rede, c.handle, e.slug FROM conta c LEFT JOIN empresa e ON e.id = c.empresa_id ORDER BY c.rede, c.handle',
  'SELECT ct.rede, ct.handle, co.data, co.pasta, co.status, co.concluida, co.catalogo, co.seguidores, co.seguidores_arredondado, co.janela_dias, co.nota, co.erro FROM coleta co JOIN conta ct ON ct.id = co.conta_id ORDER BY 1, 2, 3',
  'SELECT ct.rede, ct.handle, p.id_externo, p.url, p.data, p.idioma, p.resumo_pt, p.texto, p.formato, p.framework_carrossel, p.hook, p.hook_categoria, p.hook_cabe_no_corte, p.cta, p.hashtags, p.link_externo, p.artigo_titulo, p.angulo, p.gatilho_psicologico, p.tom, p.descricao_visual, p.screenshot FROM post p JOIN conta ct ON ct.id = p.conta_id ORDER BY 1, 2, 3',
  'SELECT ct.rede, ct.handle, p.id_externo, co.data, m.likes, m.comentarios, m.reposts, m.destaque_semana FROM metrica m JOIN post p ON p.id = m.post_id JOIN coleta co ON co.id = m.coleta_id JOIN conta ct ON ct.id = co.conta_id ORDER BY 1, 2, 3, 4',
];
const hashDoConteudo = (dados) => crypto.createHash('sha256').update(JSON.stringify(CONTEUDO.map((sql) => linhasDe(dados, sql)))).digest('hex');

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso('monta do zero e conta o que está nos arquivos', () => {
  const dados = montarDados();
  const r = atualizar(dados);
  assert.strictEqual(r.ok, true, JSON.stringify(r.problemas));
  assert.strictEqual(r.exit, 0);
  assert.strictEqual(r.arquivo, path.join(dados, 'indice.db'));
  assert.strictEqual(r.refeito, 'banco_ausente');
  assert.deepStrictEqual(r.totais, { empresas: 3, contas: 5, coletas: 6, posts: 6, metricas: 8 });
  assert.deepStrictEqual(r.avisos.map((a) => [a.tipo, a.pasta]), [['post_sem_chave', path.join('catalog', 'raw', 'linkedin', 'orfa', '2026-11-01')]]);
});

caso('cada coleta guarda status, concluída e catálogo pela regra de coleta.js', () => {
  const dados = montarDados();
  assert.deepStrictEqual(
    linhasDe(dados, 'SELECT ct.rede, ct.handle, co.data, co.status, co.concluida, co.catalogo FROM coleta co JOIN conta ct ON ct.id = co.conta_id ORDER BY 1, 2, 3'),
    [
      ['instagram', 'alfa.br', '2026-11-02', 'ok', 1, 1],
      ['linkedin', 'alfa', '2026-07-14', 'ok', null, 1],
      ['linkedin', 'alfa', '2026-11-01', 'ok', 1, 1],
      ['linkedin', 'alfa', '2026-11-05', 'ok', 0, 0],
      ['linkedin', 'beta', '2026-11-01', 'sem_posts', 1, 0],
      ['linkedin', 'orfa', '2026-11-01', 'ok', 1, 1],
    ],
  );
});

caso('o último catálogo do banco é o mesmo da rodada do indice.js', () => {
  const dados = montarDados();
  const doBanco = linhasDe(
    dados,
    "SELECT e.slug, (SELECT max(co.data) FROM coleta co JOIN conta ct ON ct.id = co.conta_id WHERE ct.empresa_id = e.id AND ct.rede = 'linkedin' AND co.catalogo = 1) FROM empresa e ORDER BY e.slug",
  );
  const v = JSON.parse(spawnSync(process.execPath, [INDICE, path.join(dados, 'refs'), '--hoje', HOJE], { encoding: 'utf8' }).stdout);
  assert.deepStrictEqual(doBanco, v.empresas.map((e) => [e.slug, e.catalogo]).sort());
  assert.deepStrictEqual(doBanco, [['alfa', '2026-11-01'], ['beta', null], ['gama', null]]);
});

caso('post visto em duas coletas: um post, uma métrica por coleta, campos da coleta mais nova', () => {
  const dados = montarDados();
  assert.deepStrictEqual(linhasDe(dados, "SELECT hook FROM post WHERE id_externo = 'urn:li:activity:2'"), [['hook 2']]);
  assert.deepStrictEqual(
    linhasDe(dados, "SELECT co.data, m.likes, m.comentarios, m.reposts FROM metrica m JOIN post p ON p.id = m.post_id JOIN coleta co ON co.id = m.coleta_id WHERE p.id_externo = 'urn:li:activity:2' ORDER BY 1"),
    [['2026-07-14', 10, 1, 0], ['2026-11-01', 1200, 3, 1]],
    'o contador "1,2 mil" vira 1200, pela leitura do metricas.js',
  );
  assert.deepStrictEqual(
    linhasDe(dados, "SELECT m.likes, m.comentarios, m.reposts FROM metrica m JOIN post p ON p.id = m.post_id JOIN coleta co ON co.id = m.coleta_id WHERE p.id_externo = 'urn:li:activity:3' AND co.data = '2026-11-05'"),
    [[null, null, null]],
    'contador ilegível fica null, não zero',
  );
  assert.deepStrictEqual(linhasDe(dados, "SELECT seguidores, seguidores_arredondado FROM coleta WHERE data = '2026-11-01' AND pasta LIKE '%/alfa/%'"), [[6000, 1]]);
});

caso('conta sem linha no índice entra sem empresa; post sem post_id usa a url sem query', () => {
  const dados = montarDados();
  assert.deepStrictEqual(linhasDe(dados, "SELECT empresa_id FROM conta WHERE handle = 'orfa'"), [[null]]);
  assert.deepStrictEqual(
    linhasDe(dados, "SELECT p.id_externo FROM post p JOIN conta ct ON ct.id = p.conta_id WHERE ct.handle = 'orfa' ORDER BY 1"),
    [['https://www.linkedin.com/posts/orfa-q2'], ['urn:li:activity:9']],
  );
  assert.deepStrictEqual(
    linhasDe(dados, "SELECT ct.rede, ct.handle FROM conta ct JOIN empresa e ON e.id = ct.empresa_id WHERE e.slug IN ('alfa', 'gama') ORDER BY 1, 2"),
    [['instagram', 'alfa.br'], ['instagram', 'gama.ig'], ['linkedin', 'alfa']],
    'linkedin não não ganha conta do LinkedIn; o instagram da linha ganha conta mesmo sem coleta',
  );
});

caso('--checar acusa a conta com coleta nova, e a atualização relê só ela', () => {
  const dados = montarDados();
  atualizar(dados);
  const emDia = rodar(dados, '--checar');
  assert.deepStrictEqual([emDia.ok, emDia.velho, emDia.mudancas], [true, false, { indice: false, contas: [], removidas: [] }]);
  coletar(dados, 'linkedin', 'beta', '2026-11-20', { meta: OK, posts: [post(20)] });
  const velho = rodar(dados, '--checar');
  assert.deepStrictEqual([velho.velho, velho.mudancas], [true, { indice: false, contas: ['linkedin/beta'], removidas: [] }]);
  const r = atualizar(dados);
  assert.deepStrictEqual([r.refeito, r.mudancas], [null, { indice: false, contas: ['linkedin/beta'], removidas: [] }]);
  assert.deepStrictEqual(r.totais, { empresas: 3, contas: 5, coletas: 7, posts: 7, metricas: 9 });
  assert.strictEqual(rodar(dados, '--checar').velho, false);
  assert.deepStrictEqual(atualizar(dados).mudancas, { indice: false, contas: [], removidas: [] }, 'sem mudança no disco, nada a reler');
});

caso('--checar não cria o banco', () => {
  const dados = montarDados();
  const r = rodar(dados, '--checar');
  assert.deepStrictEqual([r.ok, r.existe, r.velho], [true, false, true]);
  assert.ok(!fs.existsSync(path.join(dados, 'indice.db')));
});

caso('coleta apagada do disco sai do banco, com a conta que ficou sem nada', () => {
  const dados = montarDados();
  atualizar(dados);
  fs.rmSync(path.join(dados, 'catalog', 'raw', 'linkedin', 'orfa'), { recursive: true });
  fs.rmSync(path.join(dados, 'catalog', 'raw', 'linkedin', 'alfa', '2026-11-05'), { recursive: true });
  const r = atualizar(dados);
  assert.deepStrictEqual(r.mudancas, { indice: false, contas: ['linkedin/alfa'], removidas: ['linkedin/orfa'] });
  assert.deepStrictEqual(r.totais, { empresas: 3, contas: 4, coletas: 4, posts: 4, metricas: 5 });
});

caso('mudar o INDEX.md atualiza as empresas sem reler as coletas', () => {
  const dados = montarDados();
  atualizar(dados);
  escreverIndex(dados, [
    linha('Alfa', 'alfa', { instagram: 'alfa.br' }),
    linha('Beta', 'beta', { prioridade: 'Média', grupo: 'Grupo B' }),
    linha('Gama', 'gama', { linkedin: 'não', instagram: 'gama.ig' }),
    linha('Orfa', 'orfa'),
  ]);
  const r = atualizar(dados);
  assert.deepStrictEqual(r.mudancas, { indice: true, contas: [], removidas: [] });
  assert.deepStrictEqual(linhasDe(dados, "SELECT prioridade, grupo FROM empresa WHERE slug = 'beta'"), [['Média', 'Grupo B']]);
  assert.deepStrictEqual(linhasDe(dados, "SELECT e.slug FROM conta ct JOIN empresa e ON e.id = ct.empresa_id WHERE ct.handle = 'orfa'"), [['orfa']], 'a conta que estava sem empresa ganha a dela');
  assert.deepStrictEqual(r.totais, { empresas: 4, contas: 5, coletas: 6, posts: 6, metricas: 8 });
});

caso('atualizado aos poucos ou refeito do zero, o conteúdo é o mesmo', () => {
  const dados = montarDados();
  atualizar(dados);
  coletar(dados, 'linkedin', 'beta', '2026-11-20', { meta: OK, posts: [post(20), post(1, { hook: 'repost do 1' })] });
  fs.rmSync(path.join(dados, 'catalog', 'raw', 'linkedin', 'alfa', '2026-11-05'), { recursive: true });
  escreverIndex(dados, [linha('Alfa', 'alfa', { instagram: 'alfa.br' }), linha('Beta', 'beta', { prioridade: 'Média' })]);
  atualizar(dados);
  const aosPoucos = hashDoConteudo(dados);
  const refeito = rodar(dados, '--refazer');
  assert.deepStrictEqual([refeito.ok, refeito.refeito], [true, 'pedido']);
  assert.strictEqual(hashDoConteudo(dados), aosPoucos, '--refazer');
  for (const f of ['indice.db', 'indice.db-wal', 'indice.db-shm']) fs.rmSync(path.join(dados, f), { force: true });
  assert.strictEqual(hashDoConteudo(dados), aosPoucos, 'banco apagado e refeito');
});

caso('a consulta só lê: escrita é recusada e o banco fica igual', () => {
  const dados = montarDados();
  atualizar(dados);
  const antes = hashDoConteudo(dados);
  for (const sql of ['DELETE FROM post', "UPDATE empresa SET nome = 'x'", 'DROP TABLE post', 'CREATE TABLE x (a)']) {
    const r = rodar(dados, '--consultar', sql);
    assert.deepStrictEqual([r.ok, r.exit, r.problemas.map((p) => p.tipo)], [false, 1, ['consulta_so_leitura']], sql);
  }
  assert.strictEqual(hashDoConteudo(dados), antes);
});

caso('SQL inválido vira problema com a mensagem do SQLite, sem stack trace', () => {
  const dados = montarDados();
  const r = rodar(dados, '--consultar', 'SELEC * FROM post');
  assert.deepStrictEqual([r.ok, r.exit, r.problemas.map((p) => p.tipo)], [false, 1, ['sql_invalido']]);
  assert.match(r.problemas[0].detalhe, /syntax error/);
});

caso('--limite corta as linhas e avisa que cortou', () => {
  const dados = montarDados();
  const r = rodar(dados, '--consultar', 'SELECT id_externo FROM post ORDER BY id_externo', '--limite', '2');
  assert.deepStrictEqual([r.ok, r.n_linhas, r.truncado, r.linhas.length], [true, 6, true, 2]);
  const inteiro = rodar(dados, '--consultar', 'SELECT id_externo FROM post');
  assert.deepStrictEqual([inteiro.n_linhas, inteiro.truncado], [6, false]);
});

caso('banco de outra versão do schema é refeito', () => {
  const dados = montarDados();
  atualizar(dados);
  const { DatabaseSync } = require('node:sqlite');
  const db = new DatabaseSync(path.join(dados, 'indice.db'));
  db.exec("UPDATE meta SET valor = '0' WHERE chave = 'schema'; DELETE FROM post;");
  db.close();
  const r = atualizar(dados);
  assert.deepStrictEqual([r.ok, r.refeito], [true, 'schema_novo']);
  assert.strictEqual(r.totais.posts, 6);
});

caso('arquivo corrompido é apagado e refeito', () => {
  const dados = montarDados();
  atualizar(dados);
  for (const f of ['indice.db-wal', 'indice.db-shm']) fs.rmSync(path.join(dados, f), { force: true });
  fs.writeFileSync(path.join(dados, 'indice.db'), 'isto não é um banco SQLite '.repeat(200));
  const r = atualizar(dados);
  assert.deepStrictEqual([r.ok, r.refeito], [true, 'banco_corrompido']);
  assert.strictEqual(r.totais.posts, 6);
});

caso('pasta sem índice nem coleta: banco vazio, sem erro', () => {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'banco-test-'));
  const r = atualizar(dados);
  assert.deepStrictEqual([r.ok, r.totais], [true, { empresas: 0, contas: 0, coletas: 0, posts: 0, metricas: 0 }]);
});

caso('pasta DADOS que não existe é erro de uso', () => {
  const r = spawnSync(process.execPath, [BANCO, path.join(os.tmpdir(), 'nao-existe-banco-test')], { encoding: 'utf8' });
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /não existe/);
});

caso('a versão mínima do Node é a que tem node:sqlite sem flag', () => {
  const { nodeSuportado } = require(BANCO);
  const versoes = ['20.18.0', '22.12.0', '22.13.0', '22.23.5', '23.3.0', '23.4.0', '24.0.0', '26.13.1'];
  assert.deepStrictEqual(versoes.map(nodeSuportado), [false, false, true, true, false, true, true, true]);
});

// Assíncrono: os processos têm de rodar ao mesmo tempo, não um depois do outro.
function emParalelo(dados, n) {
  const um = () =>
    new Promise((resolve) => {
      const p = spawn(process.execPath, [BANCO, dados], { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      let err = '';
      p.stdout.on('data', (d) => (out += d));
      p.stderr.on('data', (d) => (err += d));
      p.on('close', (code) => resolve({ code, out, err }));
    });
  return Promise.all(Array.from({ length: n }, um));
}

caso('quatro atualizações ao mesmo tempo: nenhuma trava, nenhum dado se perde', async () => {
  for (let rodada = 0; rodada < 3; rodada++) {
    const dados = montarDados();
    const rs = await emParalelo(dados, 4);
    for (const r of rs) {
      assert.strictEqual(r.code, 0, `exit ${r.code}: ${r.out.slice(0, 300)} ${r.err.slice(0, 300)}`);
      assert.strictEqual(r.err, '');
      assert.doesNotMatch(r.out, /locked|busy/i);
    }
    assert.ok(rs.filter((r) => JSON.parse(r.out).refeito === 'banco_ausente').length === 1, 'só uma monta o banco; as outras acham ele pronto');
    assert.deepStrictEqual(atualizar(dados).totais, { empresas: 3, contas: 5, coletas: 6, posts: 6, metricas: 8 });
    coletar(dados, 'linkedin', 'beta', '2026-11-20', { meta: OK, posts: [post(20)] });
    coletar(dados, 'linkedin', 'gama-li', '2026-11-20', { meta: OK, posts: [post(21)] });
    for (const r of await emParalelo(dados, 4)) assert.strictEqual(r.code, 0, r.out + r.err);
    assert.deepStrictEqual(atualizar(dados).totais, { empresas: 3, contas: 6, coletas: 8, posts: 8, metricas: 10 });
  }
});

caso('require do banco.js não roda o script', () => {
  const r = spawnSync(process.execPath, ['-e', `require(${JSON.stringify(BANCO)}); console.log('ok')`], { encoding: 'utf8' });
  assert.strictEqual(r.stdout.trim(), 'ok');
});

(async () => {
  let falhas = 0;
  for (const { nome, fn } of casos) {
    try {
      await fn();
      console.log(`ok     ${nome}`);
    } catch (e) {
      falhas++;
      console.log(`FALHOU ${nome}\n       ${e.message.split('\n').join('\n       ')}`);
    }
  }
  console.log(`${casos.length - falhas}/${casos.length} casos passaram`);
  process.exit(falhas ? 1 : 0);
})();
