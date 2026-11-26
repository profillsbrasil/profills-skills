#!/usr/bin/env node
// checar-harness.js — confere que as skills falam por intenção e que os dois adaptadores cobrem cada uma
// (Node >= 18, sem dependência).
// As skills não citam ferramenta de um harness: escrevem "pergunte com opções (intenção `perguntar`)", e
// docs/harness/claude-code.md e docs/harness/codex.md dizem o que a intenção é em cada um. Este script
// falha quando:
//   - um SKILL.md, uma reference ou um asset em .md cita uma ferramenta, comando ou skill própria de um
//     harness (tabela FERRAMENTAS), fora das EXCECOES;
//   - uma intenção citada nas skills não tem linha na tabela "## Intenções" dos dois adaptadores;
//   - um SKILL.md não manda ler os dois adaptadores.
// Uso:     node scripts/checar-harness.js [<pasta do plugin>]
// Exemplo: node plugins/profills/scripts/checar-harness.js
//          → {"ok":true,"arquivos":24,"intencoes":{...},"ferramentas_cruas":[],...}
// Saída: JSON em stdout. Exit 0 = ok · 1 = achou problema · 2 = erro de uso.

const fs = require('fs');
const path = require('path');

const ADAPTADORES = { 'claude-code': 'docs/harness/claude-code.md', codex: 'docs/harness/codex.md' };

// Cada entrada é o nome de uma peça que só existe num harness. `padrao` acha a citação no texto.
const FERRAMENTAS = [
  { nome: 'AskUserQuestion', harness: 'claude-code', padrao: /\bAskUserQuestion\b/ },
  { nome: 'ToolSearch', harness: 'claude-code', padrao: /\bToolSearch\b/ },
  { nome: 'Artifact', harness: 'claude-code', padrao: /\bArtifacts?\b/ },
  { nome: 'Skill (ferramenta)', harness: 'claude-code', padrao: /`Skill`|ferramenta Skill\b/ },
  { nome: 'Agent (ferramenta)', harness: 'claude-code', padrao: /`Agent`/ },
  { nome: 'WebSearch', harness: 'claude-code', padrao: /\bWebSearch\b/ },
  { nome: 'WebFetch', harness: 'claude-code', padrao: /\bWebFetch\b/ },
  { nome: 'TodoWrite', harness: 'claude-code', padrao: /\bTodoWrite\b/ },
  { nome: 'mcp__ (ferramenta MCP)', harness: 'claude-code', padrao: /\bmcp__\w*/ },
  { nome: 'claude-in-chrome (servidor MCP)', harness: 'claude-code', padrao: /\bclaude-in-chrome\b/ },
  {
    nome: 'ferramenta do Claude in Chrome',
    harness: 'claude-code',
    padrao: /\b(list_connected_browsers|select_browser|switch_browser|tabs_context_mcp|tabs_create_mcp|tabs_close_mcp|read_page|get_page_text|javascript_tool|form_input|gif_creator|save_to_disk)\b|`(navigate|find|computer)`/,
  },
  { nome: 'artifact-design / dataviz', harness: 'claude-code', padrao: /\b(artifact-design|dataviz)\b/ },
  { nome: '/chrome ou claude --chrome', harness: 'claude-code', padrao: /(^|[\s`(])\/chrome\b|claude --chrome/ },
  { nome: 'claude plugin', harness: 'claude-code', padrao: /\bclaude plugin\b/ },
  { nome: '-a claude-code', harness: 'claude-code', padrao: /-a claude-code\b/ },
  { nome: '/<skill> (chamada pelo nome)', harness: 'claude-code', padrao: /(^|[\s`("'])\/profills-[a-z]+/ },
  { nome: 'request_user_input', harness: 'codex', padrao: /\brequest_user_input\w*/ },
  { nome: 'cua (navegação do Codex)', harness: 'codex', padrao: /\bcua_repl\b|\bcua\.\w+/ },
  { nome: 'node_repl', harness: 'codex', padrao: /\bnode_repl\b/ },
  { nome: 'exec_command / spawn_agent', harness: 'codex', padrao: /\b(exec_command|spawn_agent|wait_agent)\b/ },
  { nome: 'codex plugin', harness: 'codex', padrao: /\bcodex plugin\b/ },
  { nome: '$<skill> (chamada pelo nome)', harness: 'codex', padrao: /\$profills-[a-z]+/ },
];

// Citação permitida fora dos adaptadores: arquivo relativo à pasta do plugin, a ferramenta e o motivo.
// Cada exceção precisa ter uso; a que sobrar sem uso vira problema, para a lista não crescer à toa.
const EXCECOES = [];

const RE_INTENCAO = /[Ii]ntenç(?:ão|ões)((?:\s*(?:,|e|ou)?\s*`[a-z][a-z-]*`)+)/g;
const RE_ID = /`([a-z][a-z-]*)`/g;
const RE_LINHA_ADAPTADOR = /^\|\s*`([a-z][a-z-]*)`\s*\|/;

const lerTexto = (caminho) => fs.readFileSync(caminho, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');

function arquivosDasSkills(raiz) {
  const skills = path.join(raiz, 'skills');
  const lista = [];
  for (const nome of fs.readdirSync(skills).sort()) {
    const pasta = path.join(skills, nome);
    if (!fs.statSync(pasta).isDirectory()) continue;
    if (fs.existsSync(path.join(pasta, 'SKILL.md'))) lista.push(path.join(pasta, 'SKILL.md'));
    for (const sub of ['references', 'assets']) {
      const p = path.join(pasta, sub);
      if (!fs.existsSync(p)) continue;
      for (const f of fs.readdirSync(p).sort()) if (f.endsWith('.md')) lista.push(path.join(p, f));
    }
  }
  return lista;
}

// As intenções que um adaptador cobre são as linhas da tabela da seção "## Intenções".
function intencoesDoAdaptador(caminho) {
  if (!fs.existsSync(caminho)) return null;
  const texto = lerTexto(caminho);
  const secao = texto.split(/^## /m).find((s) => s.startsWith('Intenções'));
  if (!secao) return new Set();
  const ids = new Set();
  for (const linha of secao.split('\n')) {
    const m = linha.match(RE_LINHA_ADAPTADOR);
    if (m) ids.add(m[1]);
  }
  return ids;
}

function checar(raiz) {
  const saida = {
    ok: false,
    arquivos: 0,
    intencoes: {},
    ferramentas_cruas: [],
    intencoes_sem_linha: [],
    sem_leitura_do_adaptador: [],
    adaptador_ausente: [],
    excecoes_sem_uso: [],
  };
  const cobertas = {};
  for (const [harness, rel] of Object.entries(ADAPTADORES)) {
    cobertas[harness] = intencoesDoAdaptador(path.join(raiz, rel));
    if (cobertas[harness] === null) saida.adaptador_ausente.push(rel);
  }

  const usadas = new Map();
  const excecoesUsadas = new Set();
  const arquivos = arquivosDasSkills(raiz);
  saida.arquivos = arquivos.length;

  for (const caminho of arquivos) {
    const rel = path.relative(raiz, caminho).split(path.sep).join('/');
    const texto = lerTexto(caminho);
    const linhas = texto.split('\n');

    linhas.forEach((linha, i) => {
      for (const f of FERRAMENTAS) {
        if (!f.padrao.test(linha)) continue;
        const excecao = EXCECOES.find((e) => e.arquivo === rel && e.ferramenta === f.nome);
        if (excecao) {
          excecoesUsadas.add(excecao);
          continue;
        }
        const m = linha.match(f.padrao);
        saida.ferramentas_cruas.push({ arquivo: rel, linha: i + 1, ferramenta: f.nome, harness: f.harness, trecho: m[0].trim() });
      }
    });

    for (const m of texto.matchAll(RE_INTENCAO)) {
      for (const id of m[1].matchAll(RE_ID)) {
        if (!usadas.has(id[1])) usadas.set(id[1], new Set());
        usadas.get(id[1]).add(rel);
      }
    }

    if (path.basename(caminho) === 'SKILL.md') {
      const faltam = Object.values(ADAPTADORES).filter((a) => !texto.includes(`../../${a}`));
      if (faltam.length) saida.sem_leitura_do_adaptador.push({ arquivo: rel, faltam: faltam.map((a) => `../../${a}`) });
    }
  }

  for (const [id, onde] of [...usadas].sort()) {
    saida.intencoes[id] = [...onde].sort();
    const faltaEm = Object.keys(ADAPTADORES).filter((h) => cobertas[h] && !cobertas[h].has(id));
    if (faltaEm.length) saida.intencoes_sem_linha.push({ intencao: id, falta_em: faltaEm.map((h) => ADAPTADORES[h]), usada_em: saida.intencoes[id] });
  }
  saida.excecoes_sem_uso = EXCECOES.filter((e) => !excecoesUsadas.has(e)).map(({ arquivo, ferramenta }) => ({ arquivo, ferramenta }));

  saida.ok = !saida.ferramentas_cruas.length && !saida.intencoes_sem_linha.length && !saida.sem_leitura_do_adaptador.length
    && !saida.adaptador_ausente.length && !saida.excecoes_sem_uso.length;
  return saida;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length > 1 || (args[0] && args[0].startsWith('--'))) {
    process.stderr.write('Uso: node scripts/checar-harness.js [<pasta do plugin>]\n');
    process.exit(2);
  }
  const raiz = path.resolve(args[0] || path.join(__dirname, '..'));
  if (!fs.existsSync(path.join(raiz, 'skills'))) {
    process.stderr.write(`Pasta do plugin sem skills/: ${raiz}\n`);
    process.exit(2);
  }
  const saida = checar(raiz);
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  process.exit(saida.ok ? 0 : 1);
}

module.exports = { checar, FERRAMENTAS, EXCECOES };
