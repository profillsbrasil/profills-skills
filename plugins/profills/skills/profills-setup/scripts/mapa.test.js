#!/usr/bin/env node
// mapa.test.js — casos do DADOS/CLAUDE.md mantido pelo mapa.js, rodados pelo terminal como as skills rodam.
// Uso: node skills/profills-setup/scripts/mapa.test.js   (Node >= 18, sem dependência)
// Cada caso monta uma pasta temporária, roda mapa.js como processo e confere a saída e o arquivo.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const MAPA = path.join(__dirname, 'mapa.js');
const TEMPLATE = fs.readFileSync(path.join(__dirname, '..', 'assets', 'claude-dados-template.md'), 'utf8');
const FIXO = TEMPLATE.slice(TEMPLATE.indexOf('<!-- profills:fixo:inicio -->'), TEMPLATE.indexOf('<!-- profills:fixo:fim -->') + '<!-- profills:fixo:fim -->'.length);
const HOJE = '2026-11-06';

const LINHA_A = '- [Alfa](alfa.md) — `alfa` · id 1 · setor s · país BR · prioridade Alta · linkedin sim · pesquisa 2026-11-01 · sem catálogo';
const LINHA_B = '- [Beta](beta.md) — `beta` · id 2 · setor s · país BR · prioridade a definir · linkedin não · pesquisa 2026-11-01 · sem catálogo';
const indexCom = (linhas) => ['# Índice de referências', '', '## Empresas', '', ...linhas, ''].join('\n');
const FICHA_VAZIA = '# Alfa\n\n## Do Not Copy\n\n<!-- vazio = ainda não perguntado. -->\n\n## Contexto\n\nfaz máquina\n';
const FICHA_RESPONDIDA = '# Beta\n\n## Do Not Copy\n\n- o tom de piada\n\n## Contexto\n\nfaz máquina\n';

function montar({ index, claude } = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'mapa-test-'));
  for (const sub of ['refs', 'catalog/raw', 'drafts', 'boletins']) fs.mkdirSync(path.join(dados, sub), { recursive: true });
  fs.writeFileSync(path.join(dados, '.profills.json'), JSON.stringify({ versao_dados: 2, atualizado_em: HOJE }) + '\n');
  if (index !== undefined) {
    fs.writeFileSync(path.join(dados, 'refs', 'INDEX.md'), index);
    fs.writeFileSync(path.join(dados, 'refs', 'alfa.md'), FICHA_VAZIA);
    fs.writeFileSync(path.join(dados, 'refs', 'beta.md'), FICHA_RESPONDIDA);
  }
  if (claude !== undefined) fs.writeFileSync(path.join(dados, 'CLAUDE.md'), claude);
  return dados;
}

function mapa(dados, hoje = HOJE) {
  const r = spawnSync(process.execPath, [MAPA, dados, '--hoje', hoje], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  assert.ok(json, `mapa.js não devolveu JSON: ${r.stderr.slice(0, 300)}`);
  return { status: r.status, json, stderr: r.stderr };
}

function mapaOk(dados, hoje) {
  const r = mapa(dados, hoje);
  assert.strictEqual(r.json.ok, true, `ok true: ${r.json.erro || ''}`);
  assert.strictEqual(r.status, 0, 'exit 0');
  return r.json;
}

const lerClaude = (dados) => fs.readFileSync(path.join(dados, 'CLAUDE.md'), 'utf8');
const blocoMapa = (texto) => texto.slice(texto.indexOf('<!-- profills:mapa:inicio -->'), texto.indexOf('<!-- profills:mapa:fim -->'));
const novoRascunho = (dados, nome) => fs.writeFileSync(path.join(dados, 'drafts', nome), 'Tema: x\n---\ntexto\n');

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

const casos = [
  ['pasta nova sem CLAUDE.md: cria do template com o mapa preenchido', () => {
    const dados = montar();
    const r = mapaOk(dados);
    assert.strictEqual(r.criado, true, 'criado true');
    const texto = lerClaude(dados);
    assert.ok(texto.startsWith(FIXO), 'começa pelo bloco fixo igual ao do template');
    assert.ok(blocoMapa(texto).includes(`Estado em ${HOJE}.`), 'mapa com a data de hoje');
    assert.ok(blocoMapa(texto).includes('Empresas no índice: nenhuma ainda'), 'pasta sem índice aparece como começo, não como problema');
    assert.deepStrictEqual(r.mapa.problemas_indice, [], 'nenhum problema de índice numa pasta nova');
    assert.ok(/^## Notas da equipe$/m.test(texto.slice(texto.indexOf('<!-- profills:mapa:fim -->'))), 'Notas da equipe depois do mapa');
  }],

  ['estado lido dos arquivos: empresas, sem LinkedIn, coleta, rascunho, boletim, voz e pendências', () => {
    const dados = montar({ index: indexCom([LINHA_A, LINHA_B]) });
    for (const [slug, data] of [['alfa', '2026-10-01'], ['alfa', '2026-11-02'], ['beta', '2026-11-02'], ['beta', 'rascunho']]) fs.mkdirSync(path.join(dados, 'catalog', 'raw', slug, data), { recursive: true });
    novoRascunho(dados, '2026-10-30-a.md');
    novoRascunho(dados, '2026-11-03-b.md');
    fs.writeFileSync(path.join(dados, 'boletins', '2026-11-04.md'), 'b\n');
    fs.writeFileSync(path.join(dados, 'voz.md'), '# Voz\n\n> Montado em 2026-10-01 · atualizado em 2026-10-20, a partir de: áudio.\n');
    const m = mapaOk(dados).mapa;
    assert.deepStrictEqual(m.empresas, { total: 2, por_prioridade: { Alta: 1, 'a definir': 1 }, sem_linkedin: 1 });
    assert.deepStrictEqual(m.ultima_coleta, { data: '2026-11-02', empresas: 2 });
    assert.deepStrictEqual(m.ultimo_rascunho, { arquivo: '2026-11-03-b.md', total: 2 });
    assert.strictEqual(m.ultimo_boletim.arquivo, '2026-11-04.md');
    assert.deepStrictEqual(m.voz, { existe: true, atualizado_em: '2026-10-20' });
    assert.deepStrictEqual(m.pendencias, { do_not_copy_vazio: ['alfa'], pesquisa_vencida: [] });
    const bloco = blocoMapa(lerClaude(dados));
    for (const trecho of ['Empresas no índice: 2', 'Sem página no LinkedIn: 1', 'Última coleta: 2026-11-02, com 2', '`drafts/2026-11-03-b.md`', '`boletins/2026-11-04.md`', 'atualizado em 2026-10-20', '"Do Not Copy" vazio em 1 ficha(s): `alfa`']) {
      assert.ok(bloco.includes(trecho), `bloco traz "${trecho}"`);
    }
  }],

  ['segunda rodada no mesmo estado não muda nenhum byte (sha256), nem dias depois', () => {
    const dados = montar({ index: indexCom([LINHA_A]) });
    mapaOk(dados);
    const antes = hashDaPasta(dados);
    const r = mapaOk(dados);
    assert.strictEqual(r.mapa_atualizado, false, 'mapa_atualizado false');
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 igual no mesmo dia');
    const depois = mapaOk(dados, '2026-11-20');
    assert.strictEqual(depois.mapa.estado_em, HOJE, 'a data continua a do último estado');
    assert.strictEqual(hashDaPasta(dados), antes, 'sha256 igual 14 dias depois sem mudança na pasta');
  }],

  ['mudança de estado muda a data e preserva as notas da equipe', () => {
    const dados = montar({ index: indexCom([LINHA_A]) });
    mapaOk(dados);
    const nota = '- 2026-11-06: só posts sobre manutenção preventiva até dezembro.';
    fs.appendFileSync(path.join(dados, 'CLAUDE.md'), `\n${nota}\n`);
    const comNota = lerClaude(dados);
    const notas = comNota.slice(comNota.indexOf('## Notas da equipe'));
    novoRascunho(dados, '2026-11-10-c.md');
    const r = mapaOk(dados, '2026-11-10');
    assert.strictEqual(r.mapa_atualizado, true, 'mapa_atualizado true');
    const texto = lerClaude(dados);
    assert.ok(blocoMapa(texto).includes('Estado em 2026-11-10.'), 'data nova no mapa');
    assert.ok(texto.endsWith(notas), 'Notas da equipe, com a nota, byte a byte iguais no fim');
  }],

  ['CLAUDE.md do comercial sem marcadores: blocos no topo e o texto dele intacto abaixo', () => {
    const dele = '# Minhas anotações\n\nLigar para o cliente X toda segunda.\n\n## Notas da equipe\n\n- 2026-10-01: tom formal.\n';
    const dados = montar({ claude: dele });
    const r = mapaOk(dados);
    assert.strictEqual(r.criado, false, 'criado false');
    const texto = lerClaude(dados);
    assert.ok(texto.startsWith(FIXO), 'bloco fixo no topo');
    assert.ok(texto.indexOf('<!-- profills:mapa:fim -->') < texto.indexOf(dele), 'mapa antes do texto do comercial');
    assert.ok(texto.endsWith(dele), 'texto do comercial intacto no fim, sem segunda seção de notas');
    assert.strictEqual(texto.split('## Notas da equipe').length - 1, 1, 'uma seção de notas só');
    const antes = hashDaPasta(dados);
    mapaOk(dados);
    assert.strictEqual(hashDaPasta(dados), antes, 'rodar de novo não muda nada');
  }],

  ['texto sem marcadores e sem notas ganha a seção de notas no fim', () => {
    const dele = 'Anotação solta do comercial.\n';
    const dados = montar({ claude: dele });
    mapaOk(dados);
    const texto = lerClaude(dados);
    assert.ok(texto.includes(`<!-- profills:mapa:fim -->\n\n${dele}`), 'texto do comercial logo depois do mapa, intacto');
    assert.ok(/\n## Notas da equipe\n/.test(texto.slice(texto.indexOf(dele))), 'Notas da equipe depois do texto dele');
  }],

  ['bloco fixo editado à mão volta ao template e o resto fica', () => {
    const dados = montar();
    mapaOk(dados);
    const original = lerClaude(dados);
    fs.writeFileSync(path.join(dados, 'CLAUDE.md'), original.replace('## Regras', '## Regras que eu mudei'));
    const r = mapaOk(dados);
    assert.strictEqual(r.fixo_atualizado, true, 'fixo_atualizado true');
    assert.strictEqual(r.mapa_atualizado, false, 'mapa_atualizado false');
    assert.strictEqual(lerClaude(dados), original, 'arquivo igual ao de antes da edição');
  }],

  ['índice com problema entra no mapa sem derrubar o script', () => {
    const ruim = LINHA_B.replace('prioridade a definir', 'prioridade urgente');
    const dados = montar({ index: indexCom([LINHA_A, ruim]) });
    const r = mapaOk(dados);
    const p = r.mapa.problemas_indice.find((x) => x.tipo === 'prioridade_invalida');
    assert.ok(p, `problema prioridade_invalida no JSON: ${JSON.stringify(r.mapa.problemas_indice)}`);
    assert.strictEqual(p.linha, 6, 'linha do problema');
    const bloco = blocoMapa(lerClaude(dados));
    assert.ok(bloco.includes('Problemas no índice: 1. Quem corrige é a `profills-radar`.'), 'bloco conta o problema');
    assert.ok(bloco.includes('linha 6, `beta`: prioridade_invalida.'), 'bloco aponta a linha');
  }],

  ['marcadores quebrados: erro em JSON, exit 1 e arquivo intacto', () => {
    const quebrado = '<!-- profills:mapa:inicio -->\nsem fim\n\n## Notas da equipe\n\n- 2026-10-01: x.\n';
    const dados = montar({ claude: quebrado });
    const r = mapa(dados);
    assert.strictEqual(r.json.ok, false, 'ok false');
    assert.strictEqual(r.status, 1, 'exit 1');
    assert.ok(/não formam um par/.test(r.json.erro), `erro legível: ${r.json.erro}`);
    assert.strictEqual(lerClaude(dados), quebrado, 'arquivo intacto');
  }],

  ['nota que cita um marcador no meio da frase não quebra o script', () => {
    const dados = montar();
    mapaOk(dados);
    const notas = [
      '- 2026-11-06: o resumo fica entre <!-- profills:mapa:inicio --> e o fim dele.',
      '<!-- profills:mapa:fim -->',
    ];
    fs.appendFileSync(path.join(dados, 'CLAUDE.md'), `\n${notas.join('\n')}\n`);
    const comNotas = lerClaude(dados);
    const trechoNotas = comNotas.slice(comNotas.indexOf('## Notas da equipe'));
    novoRascunho(dados, '2026-11-10-c.md');
    const r = mapaOk(dados, '2026-11-10');
    assert.strictEqual(r.mapa_atualizado, true, 'o mapa continua sendo atualizado');
    const texto = lerClaude(dados);
    assert.ok(blocoMapa(texto).includes('Estado em 2026-11-10.'), 'data nova no bloco do topo');
    assert.ok(texto.endsWith(trechoNotas), 'Notas da equipe, com as duas notas, byte a byte iguais no fim');
  }],

  ['CLAUDE.md à mão que cita o par de marcadores no meio do texto fica inteiro', () => {
    const dele = 'O mapa vai entre <!-- profills:mapa:inicio --> aqui\nTEXTO QUE NÃO PODE SUMIR\ne aqui <!-- profills:mapa:fim --> no fim.\n';
    const dados = montar({ claude: dele });
    mapaOk(dados);
    const texto = lerClaude(dados);
    assert.ok(texto.startsWith(FIXO), 'bloco fixo no topo');
    assert.ok(texto.includes(`<!-- profills:mapa:fim -->\n\n${dele}`), 'texto do comercial intacto logo depois do mapa');
    const antes = hashDaPasta(dados);
    mapaOk(dados);
    assert.strictEqual(hashDaPasta(dados), antes, 'rodar de novo não muda nada');
  }],

  ['marcador com espaço nas pontas da linha ainda vale', () => {
    const dados = montar();
    mapaOk(dados);
    const original = lerClaude(dados);
    fs.writeFileSync(path.join(dados, 'CLAUDE.md'), original.replace('<!-- profills:mapa:inicio -->', '  <!-- profills:mapa:inicio -->  '));
    mapaOk(dados);
    assert.strictEqual(lerClaude(dados), original, 'o bloco é reconhecido e volta ao formato do template, sem segundo mapa');
  }],

  ['falha de escrita vira JSON com o motivo, sem stack trace', () => {
    if (process.getuid && process.getuid() === 0) return 'pulado: root ignora permissão';
    const dados = montar();
    fs.chmodSync(dados, 0o555);
    let r;
    try {
      r = mapa(dados);
    } finally {
      fs.chmodSync(dados, 0o755);
    }
    assert.strictEqual(r.json.ok, false, 'ok false');
    assert.strictEqual(r.status, 1, 'exit 1');
    assert.ok(r.json.erro.includes('CLAUDE.md') && r.json.erro.includes('falta permissão de escrita'), `erro cita o arquivo e o motivo: ${r.json.erro}`);
    assert.ok(!/\n\s+at /.test(r.stderr), 'sem stack trace');
    assert.ok(!fs.existsSync(path.join(dados, 'CLAUDE.md')), 'nenhum CLAUDE.md pela metade');
  }],

  ['CRLF e BOM do Windows continuam como chegaram', () => {
    const dele = '﻿Nota do comercial.\r\nOutra linha.\r\n';
    const dados = montar({ claude: dele });
    mapaOk(dados);
    const texto = lerClaude(dados);
    assert.ok(texto.startsWith('﻿<!-- profills:fixo:inicio -->'), 'BOM continua no começo');
    assert.ok(!/(^|[^\r])\n/.test(texto), 'toda quebra continua CRLF');
    const antes = hashDaPasta(dados);
    mapaOk(dados);
    assert.strictEqual(hashDaPasta(dados), antes, 'rodar de novo não muda nada');
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
