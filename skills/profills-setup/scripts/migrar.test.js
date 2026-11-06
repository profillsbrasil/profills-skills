#!/usr/bin/env node
// migrar.test.js — casos da migração da pasta DADOS, rodados pelo terminal como o comercial roda.
// Uso: node skills/profills-setup/scripts/migrar.test.js   (Node >= 18, sem dependência)
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
  cetromaquinas: { setor: 'máquinas de embalagem/processamento', catalogo: '2026-07-14', alerta: 'catálogo parcial (smoke test)' },
  'maqinox-ind-stria-de-maquinas': { setor: 'máquinas de envase/Doypack', catalogo: null, alerta: null },
  'tecnoenvase-maquinas-e-equipamentos-ltda': { setor: 'envasadoras/dosadoras', catalogo: null, alerta: null },
  'tecnox-do-brasil': { setor: 'embalagem flexível/Doypack', catalogo: null, alerta: null },
  skymsen: { setor: 'processamento de alimentos (benchmark maior)', catalogo: null, alerta: null },
  'sulpack-industria-de-maquinas-para-embalagens': { setor: 'seladoras/embaladoras', catalogo: null, alerta: 'presença digital fraca (~38 seguidores)' },
};

const indexCom = (linhas, quebra = '\n') => [...CABECALHO, ...linhas, ''].join(quebra);

function montar({ index, marcador } = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'migrar-test-'));
  for (const sub of ['refs', 'catalog/raw', 'drafts', 'boletins']) fs.mkdirSync(path.join(dados, sub), { recursive: true });
  if (index !== undefined) {
    fs.writeFileSync(path.join(dados, 'refs', 'INDEX.md'), index, 'utf8');
    for (const m of index.matchAll(/\]\(([^)\s]+\.md)\)/g)) fs.writeFileSync(path.join(dados, 'refs', m[1]), '# ficha\n');
  }
  if (marcador !== undefined) fs.writeFileSync(path.join(dados, '.profills.json'), JSON.stringify({ versao_dados: marcador }) + '\n');
  return dados;
}

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

  ['indice.js lê a linha 1 de um INDEX v2 com BOM', () => {
    const linhas = [
      '- [A](a.md) — `a` · id 1 · setor s · país BR · prioridade Alta · linkedin sim · pesquisa 2026-07-14 · sem catálogo',
      '- [B](b.md) — `b` · id 2 · setor s · país BR · prioridade Alta · linkedin sim · pesquisa 2026-07-14 · sem catálogo',
    ];
    const dados = montar({ index: BOM + linhas.join('\n') + '\n', marcador: 2 });
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
        { setor: e.setor, pais: e.pais, id: e.id, pesquisa: e.pesquisa, catalogo: e.catalogo, alerta: e.alerta, prioridade: e.prioridade, linkedin: e.linkedin },
        { ...esperado, pais: 'BR', id: '—', pesquisa: '2026-07-14', prioridade: 'a definir', linkedin: true },
        slug,
      );
    }
    assert.strictEqual(fs.readFileSync(path.join(dados, '.backup', HOJE, 'refs', 'INDEX.md'), 'utf8'), original, 'backup byte a byte');
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dados, '.profills.json'), 'utf8')).versao_dados, 2);
  }],

  ['variante de 2026-08-04 sem id e com catálogo parcial', () => {
    const cetro = '- [Cetro Máquinas](cetromaquinas.md) — `cetromaquinas` · máquinas de embalagem/processamento · BR · pesquisa 2026-07-14 · catálogo parcial 2026-07-14 (smoke test)';
    const dados = montar({ index: indexCom([cetro, ...LINHAS_REAIS.slice(1)]) });
    aplicarComSucesso(dados);
    const e = validarComSucesso(dados, 6).cetromaquinas;
    assert.strictEqual(e.id, '—');
    assert.strictEqual(e.catalogo, '2026-07-14');
    assert.strictEqual(e.alerta, 'catálogo parcial (smoke test)');
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

  ['pasta na versão 3 é recusada sem mudar nada', () => {
    const dados = montar({ index: indexCom(LINHAS_REAIS), marcador: 3 });
    const antes = hashDaPasta(dados);
    const r = migrar(dados, '--aplicar');
    assert.strictEqual(r.json.ok, false);
    assert.ok(r.json.problemas.some((p) => p.tipo === 'pasta_mais_nova'));
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 da pasta igual');
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
