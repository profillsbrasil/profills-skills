#!/usr/bin/env node
// coleta.test.js — o que uma pasta de coleta diz (status, concluída, catálogo), rodado pelo terminal.
// Uso: node plugins/profills/scripts/coleta.test.js   (Node >= 18, sem dependência)

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const { lerColeta, datasDaConta, ultimoCatalogo, REDES } = require('./coleta.js');

const conta = () => fs.mkdtempSync(path.join(os.tmpdir(), 'coleta-test-'));

// meta e posts: objeto/array vira JSON; string é gravada crua (para JSON quebrado); undefined não grava.
function gravar(pastaConta, data, { meta, posts } = {}) {
  const dia = path.join(pastaConta, data);
  fs.mkdirSync(dia, { recursive: true });
  const escrever = (nome, v) => {
    if (v === undefined) return;
    fs.writeFileSync(path.join(dia, nome), typeof v === 'string' ? v : JSON.stringify(v));
  };
  escrever('meta.json', meta);
  escrever('posts.json', posts);
  return dia;
}

const UM_POST = [{ post_id: 'urn:li:activity:1', data: '2026-11-01' }];
const resumo = (c) => ({ status: c.status, concluida: c.concluida, catalogo: c.catalogo, erro: c.erro === null ? null : 'erro' });

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso('as redes são linkedin e instagram', () => {
  assert.deepStrictEqual(REDES, ['linkedin', 'instagram']);
});

caso('coleta de 2026-07 sem meta.json: status ok, concluída desconhecida, vira catálogo', () => {
  const c = lerColeta(gravar(conta(), '2026-07-14', { posts: UM_POST }));
  assert.deepStrictEqual(resumo(c), { status: 'ok', concluida: null, catalogo: true, erro: null });
  assert.strictEqual(c.data, '2026-07-14');
  assert.strictEqual(c.posts.length, 1);
  assert.strictEqual(c.meta, null);
});

caso('meta.json ok e concluída: catálogo', () => {
  const c = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'ok', concluida: true, seguidores: 120 }, posts: UM_POST }));
  assert.deepStrictEqual(resumo(c), { status: 'ok', concluida: true, catalogo: true, erro: null });
  assert.strictEqual(c.meta.seguidores, 120);
});

caso('coleta interrompida ("concluida": false, ou sem o campo) não é catálogo', () => {
  const interrompida = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'ok', concluida: false }, posts: UM_POST }));
  assert.deepStrictEqual(resumo(interrompida), { status: 'ok', concluida: false, catalogo: false, erro: null });
  const semCampo = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'ok' }, posts: UM_POST }));
  assert.deepStrictEqual(resumo(semCampo), { status: 'ok', concluida: false, catalogo: false, erro: null });
});

caso('sem_posts e pagina_nao_gerenciada não são catálogo, com ou sem posts.json', () => {
  const comArquivo = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'sem_posts', concluida: true }, posts: [] }));
  assert.deepStrictEqual(resumo(comArquivo), { status: 'sem_posts', concluida: true, catalogo: false, erro: null });
  const semArquivo = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'pagina_nao_gerenciada', concluida: true } }));
  assert.deepStrictEqual(resumo(semArquivo), { status: 'pagina_nao_gerenciada', concluida: true, catalogo: false, erro: null });
  assert.deepStrictEqual(semArquivo.posts, []);
});

caso('arquivo ilegível ou faltando é erro, e coleta com erro não é catálogo', () => {
  const metaQuebrado = lerColeta(gravar(conta(), '2026-11-01', { meta: '{ status: ok', posts: UM_POST }));
  assert.deepStrictEqual(resumo(metaQuebrado), { status: null, concluida: null, catalogo: false, erro: 'erro' });
  assert.match(metaQuebrado.erro, /meta\.json/);
  const postsQuebrado = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'ok', concluida: true }, posts: '[{' }));
  assert.match(postsQuebrado.erro, /posts\.json/);
  assert.strictEqual(postsQuebrado.catalogo, false);
  const postsNaoLista = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'ok', concluida: true }, posts: { a: 1 } }));
  assert.match(postsNaoLista.erro, /não é uma lista/);
  const semPosts = lerColeta(gravar(conta(), '2026-11-01', { meta: { status: 'ok', concluida: true } }));
  assert.match(semPosts.erro, /não gravou posts\.json/);
  const vazia = lerColeta(gravar(conta(), '2026-11-01'));
  assert.deepStrictEqual(resumo(vazia), { status: null, concluida: null, catalogo: false, erro: 'erro' });
});

caso('o BOM do Bloco de Notas não quebra a leitura', () => {
  const c = lerColeta(gravar(conta(), '2026-11-01', { meta: '﻿{"status":"ok","concluida":true}', posts: '﻿[]' }));
  assert.deepStrictEqual(resumo(c), { status: 'ok', concluida: true, catalogo: true, erro: null });
});

caso('datasDaConta lista só pasta de data real, em ordem', () => {
  const c = conta();
  for (const d of ['2026-11-08', '2026-11-01', '2026-13-01', 'rascunho']) gravar(c, d, { posts: [] });
  fs.writeFileSync(path.join(c, '2026-11-09'), 'arquivo, não pasta');
  assert.deepStrictEqual(datasDaConta(c), ['2026-11-01', '2026-11-08']);
  assert.deepStrictEqual(datasDaConta(path.join(c, 'nao-existe')), []);
});

caso('ultimoCatalogo é a data mais recente que vira catálogo', () => {
  const c = conta();
  gravar(c, '2026-10-20', { posts: UM_POST });
  gravar(c, '2026-11-01', { meta: { status: 'ok', concluida: true }, posts: UM_POST });
  gravar(c, '2026-11-05', { meta: { status: 'ok', concluida: false }, posts: UM_POST });
  gravar(c, '2026-11-08', { meta: { status: 'sem_posts', concluida: true }, posts: [] });
  assert.strictEqual(ultimoCatalogo(c), '2026-11-01');
  assert.strictEqual(ultimoCatalogo(path.join(c, 'nao-existe')), null);
  const nenhum = conta();
  gravar(nenhum, '2026-11-08', { meta: { status: 'sem_posts', concluida: true }, posts: [] });
  assert.strictEqual(ultimoCatalogo(nenhum), null);
});

let falhas = 0;
for (const { nome, fn } of casos) {
  try {
    fn();
    console.log(`ok     ${nome}`);
  } catch (e) {
    falhas++;
    console.log(`FALHOU ${nome}\n       ${e.message.split('\n').join('\n       ')}`);
  }
}
console.log(`${casos.length - falhas}/${casos.length} casos passaram`);
process.exit(falhas ? 1 : 0);
