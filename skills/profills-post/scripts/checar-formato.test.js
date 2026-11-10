#!/usr/bin/env node
// checar-formato.test.js — casos do checar-formato.js, rodados pelo terminal como a skill roda.
// Uso: node skills/profills-post/scripts/checar-formato.test.js   (Node >= 18, sem dependência)
// Cada caso grava um rascunho (e um voz.md quando precisa) numa pasta temporária, roda o script como processo e confere o JSON.

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'checar-formato.js');

function frase(n) {
  const base = 'Linha de texto do post sobre a caixa de envase e a rotina da fábrica ';
  return base.repeat(Math.ceil(n / base.length) + 1).slice(0, n - 1).replace(/ $/, 'a') + '.';
}

function voz({ banidas = [], permitidos = null }) {
  const linhas = ['# Voz', '', '## Palavras banidas', '', ...banidas.map((t) => `- "${t}" (2026-11-10)`), ''];
  if (permitidos) linhas.push('## Termos permitidos', '', ...permitidos.map((t) => `- "${t}"`), '');
  linhas.push('## Isso não sou eu', '', '- abertura motivacional', '');
  return linhas.join('\n');
}

function checar(texto, vozMd) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'checar-formato-test-'));
  const rascunho = path.join(pasta, 'rascunho.md');
  fs.writeFileSync(rascunho, `tema: teste\n---\n${texto}\n`);
  const args = [SCRIPT, rascunho];
  if (vozMd !== undefined) {
    fs.writeFileSync(path.join(pasta, 'voz.md'), vozMd);
    args.push('--voz', path.join(pasta, 'voz.md'));
  }
  const r = spawnSync(process.execPath, args, { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  assert.ok(json, `checar-formato.js não devolveu JSON: ${r.stderr.slice(0, 300)}`);
  return { status: r.status, json };
}

function postSemLinhaEmBranco(tituloChars) {
  const linhas = [frase(tituloChars)];
  while (linhas.join('\n').length + 151 < 1300) linhas.push(frase(150));
  linhas.push(frase(1300 - linhas.join('\n').length - 1));
  const texto = linhas.join('\n');
  assert.strictEqual(texto.length, 1300, 'o post de teste tem 1300 chars');
  assert.ok(!/\n\s*\n/.test(texto), 'o post de teste não tem linha em branco');
  return texto;
}

const banidas = (texto, opcoes) => checar(texto, voz(opcoes)).json.palavras_banidas_encontradas;

const casos = [
  ['hook: título curto, sem linha em branco, 1300 chars no total: hook é a primeira linha e o post passa', () => {
    const { status, json } = checar(postSemLinhaEmBranco(120));
    assert.strictEqual(json.hook_chars, 120);
    assert.strictEqual(json.hook_cabe, true);
    assert.deepStrictEqual(json.falhas, []);
    assert.strictEqual(json.ok, true);
    assert.strictEqual(status, 0, 'exit 0');
  }],
  ['hook: título de 200 chars sem linha em branco cabe no corte de 210', () => {
    const { json } = checar(postSemLinhaEmBranco(200));
    assert.strictEqual(json.hook_chars, 200);
    assert.strictEqual(json.hook_cabe, true);
    assert.ok(!json.falhas.some((f) => f.startsWith('hook')), 'nenhuma falha de hook');
  }],
  ['hook: primeira linha acima de 210 chars continua reprovada', () => {
    const { status, json } = checar(postSemLinhaEmBranco(230));
    assert.strictEqual(json.hook_chars, 230);
    assert.strictEqual(json.hook_cabe, false);
    assert.ok(json.falhas.includes('hook com 230 chars, acima do corte de 210'), json.falhas.join(' | '));
    assert.strictEqual(status, 1, 'exit 1');
  }],
  ['hook: com linha em branco, o hook continua sendo o primeiro parágrafo inteiro', () => {
    const texto = [frase(120), frase(120), '', frase(150), frase(150)].join('\n');
    const { json } = checar(texto);
    assert.strictEqual(json.hook_chars, 241);
    assert.strictEqual(json.hook_cabe, false);
  }],
  ['banidas: "resolução" não dispara "solução"', () => {
    assert.deepStrictEqual(banidas('A resolução do problema veio da linha.', { banidas: ['solução'] }), []);
  }],
  ['banidas: o plural "soluções" dispara "solução", também em maiúscula', () => {
    assert.deepStrictEqual(banidas('Temos soluções para a linha.', { banidas: ['solução'] }), ['solução']);
    assert.deepStrictEqual(banidas('SOLUÇÕES PARA A LINHA.', { banidas: ['solução'] }), ['solução']);
    assert.deepStrictEqual(banidas('Uma solução, e só.', { banidas: ['solução'] }), ['solução']);
  }],
  ['banidas: "top" não casa dentro de "topo"', () => {
    assert.deepStrictEqual(banidas('O topo da caixa.', { banidas: ['top'] }), []);
  }],
  ['banidas: termo de mais de uma palavra continua funcionando', () => {
    assert.deepStrictEqual(banidas('Uma solução robusta para o envase.', { banidas: ['solução robusta'] }), ['solução robusta']);
    assert.deepStrictEqual(banidas('Uma solução que é robusta.', { banidas: ['solução robusta'] }), []);
  }],
  ['banidas: com "gable top" permitido, "a caixa gable top" passa', () => {
    assert.deepStrictEqual(banidas('a caixa gable top', { banidas: ['top'], permitidos: ['gable top'] }), []);
    assert.deepStrictEqual(banidas('A caixa Gable Top chegou.', { banidas: ['top'], permitidos: ['gable top'] }), []);
  }],
  ['banidas: com "gable top" permitido, "produto top de linha" é reprovado', () => {
    const { status, json } = checar('produto top de linha', voz({ banidas: ['top'], permitidos: ['gable top'] }));
    assert.deepStrictEqual(json.palavras_banidas_encontradas, ['top']);
    assert.ok(json.falhas.includes('palavra banida do voz.md no texto: top'), json.falhas.join(' | '));
    assert.strictEqual(status, 1, 'exit 1');
  }],
  ['banidas: texto com o termo permitido e o banido solto reprova', () => {
    const texto = 'A caixa gable top chegou.\n\nÉ um produto top de linha.';
    assert.deepStrictEqual(banidas(texto, { banidas: ['top'], permitidos: ['gable top'] }), ['top']);
  }],
  ['banidas: o exemplo do gable top passa com o permitido e reprova sem ele', () => {
    const texto = 'A caixa gable top chegou.\n\nA resolução do problema veio da linha.';
    assert.deepStrictEqual(banidas(texto, { banidas: ['top', 'solução'], permitidos: ['gable top'] }), []);
    assert.deepStrictEqual(banidas(texto, { banidas: ['top', 'solução'] }), ['top']);
  }],
];

let falhou = 0;
for (const [nome, caso] of casos) {
  try {
    caso();
    console.log(`ok   ${nome}`);
  } catch (erro) {
    falhou += 1;
    console.log(`FAIL ${nome}\n     ${erro.message.split('\n').join('\n     ')}`);
  }
}
console.log(`\n${casos.length - falhou}/${casos.length} casos passaram`);
process.exit(falhou ? 1 : 0);
