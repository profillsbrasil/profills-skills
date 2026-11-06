#!/usr/bin/env node
// importar.test.js — casos da importação de planilha, rodados pelo terminal como o comercial roda.
// Uso: node skills/profills-radar/scripts/importar.test.js   (Node >= 18, sem dependência)
// A planilha é a fixture fictícia do eval 8, gerada por fixtures/gerar-planilhas.py.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const IMPORTAR = path.join(__dirname, 'importar.js');
const INDICE = path.join(__dirname, 'indice.js');
const FIXTURE = path.join(__dirname, '..', 'evals', 'files', '8');
const PLANILHA = path.join(FIXTURE, 'concorrentes-ficticios.xlsx');
const SEM_COLUNA = path.join(__dirname, 'fixtures', 'sem-coluna-prioridade.xlsx');
const HOJE = '2026-11-06';

function montar({ comLista = true } = {}) {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'importar-test-'));
  const refs = path.join(dados, 'refs');
  fs.mkdirSync(refs);
  if (comLista) {
    for (const f of fs.readdirSync(path.join(FIXTURE, 'linkedin-data', 'refs'))) {
      fs.copyFileSync(path.join(FIXTURE, 'linkedin-data', 'refs', f), path.join(refs, f));
    }
  }
  return refs;
}

function rodar(script, args) {
  const r = spawnSync(process.execPath, [script, ...args, '--hoje', HOJE], { encoding: 'utf8' });
  let json = null;
  try {
    json = JSON.parse(r.stdout);
  } catch (e) {
    json = null;
  }
  return { status: r.status, json, stderr: r.stderr };
}

const importar = (refs, ...args) => rodar(IMPORTAR, [PLANILHA, refs, ...args]);
const validar = (refs) => rodar(INDICE, [refs]);
const nomes = (lista) => lista.map((x) => x.nome);
const novaPorNome = (saida, nome) => saida.novas.find((n) => n.nome === nome);
const ler = (refs, arquivo) => fs.readFileSync(path.join(refs, arquivo), 'utf8');

function hashDaPasta(raiz) {
  const h = crypto.createHash('sha256');
  for (const nome of fs.readdirSync(raiz).sort()) h.update(nome).update(fs.readFileSync(path.join(raiz, nome)));
  return h.digest('hex');
}

const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso('simular lê as duas abas e não grava nada', () => {
  const refs = montar();
  const antes = hashDaPasta(refs);
  const r = importar(refs);
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.json.ok, true);
  assert.strictEqual(r.json.aplicado, false);
  assert.deepStrictEqual(nomes(r.json.novas), ['Alfa Cartonagem', 'Beta Envase', 'Gama Embalagens', 'Delta Máquinas', 'Épsilon Pack', 'Zeta Papéis', 'Teta Líquidos']);
  assert.strictEqual(novaPorNome(r.json, 'Alfa Cartonagem').slug, 'alfa-cartonagem', 'slug sai da página /company/ da aba Canais');
  assert.strictEqual(novaPorNome(r.json, 'Beta Envase').slug, 'beta-envase', 'subdomínio br. e barra final não mudam o slug');
  assert.strictEqual(hashDaPasta(refs), antes, 'a simulação não muda nenhum byte');
});

caso('data serial do Excel e data em texto viram AAAA-MM-DD', () => {
  const r = importar(montar());
  assert.strictEqual(novaPorNome(r.json, 'Alfa Cartonagem').pesquisa, '2026-10-20');
  assert.strictEqual(novaPorNome(r.json, 'Zeta Papéis').pesquisa, '2026-10-21');
});

caso('sem LinkedIn e perfil pessoal ficam com linkedin não e slug do nome', () => {
  const r = importar(montar());
  assert.deepStrictEqual(nomes(r.json.sem_linkedin), ['Gama Embalagens', 'Teta Líquidos']);
  assert.deepStrictEqual(nomes(r.json.perfil_pessoal), ['Delta Máquinas']);
  const delta = novaPorNome(r.json, 'Delta Máquinas');
  assert.strictEqual(delta.linkedin, false);
  assert.strictEqual(delta.slug, 'delta-maquinas');
  assert.strictEqual(novaPorNome(r.json, 'Teta Líquidos').slug, 'teta-liquidos');
});

caso('duas páginas: a primeira é o slug, a segunda vai para a ficha', () => {
  const refs = montar();
  const r = importar(refs, '--aplicar');
  const epsilon = novaPorNome(r.json, 'Épsilon Pack');
  assert.strictEqual(epsilon.slug, 'epsilon-pack');
  assert.deepStrictEqual(epsilon.outras_paginas, ['epsilon-pack-iberia']);
  assert.match(ler(refs, 'epsilon-pack.md'), /\*\*Outras páginas no LinkedIn\*\*: `epsilon-pack-iberia`/);
});

caso('prioridade fora da lista vira a definir, com nota', () => {
  const zeta = novaPorNome(importar(montar()).json, 'Zeta Papéis');
  assert.strictEqual(zeta.prioridade, 'a definir');
  assert.match(zeta.notas.join(' '), /Urgente/);
});

caso('grupo só pela regra do ID citado; o texto inteiro vai para a ficha', () => {
  const refs = montar();
  const r = importar(refs, '--aplicar');
  assert.strictEqual(novaPorNome(r.json, 'Alfa Cartonagem').grupo, 'Alfa Cartonagem');
  assert.strictEqual(novaPorNome(r.json, 'Beta Envase').grupo, 'Alfa Cartonagem');
  assert.strictEqual(novaPorNome(r.json, 'Épsilon Pack').grupo, null, 'citar nome sem ID não junta grupo');
  assert.match(ler(refs, 'beta-envase.md'), /\*\*Grupo e nomes relacionados\*\*: Divisão de envase da Alfa Cartonagem\. Consolidar grupo com F001\./);
  assert.match(ler(refs, 'beta-envase.md'), /- Alfa Cartonagem — mesmo grupo/);
});

caso('empresa que já está na lista não ganha ficha nova, só a prioridade que faltava', () => {
  const refs = montar();
  const fichaAntes = ler(refs, 'eta-cartons.md');
  const r = importar(refs, '--aplicar');
  assert.deepStrictEqual(r.json.ja_existem.map((j) => [j.nome, j.muda]), [['Eta Cartons', { prioridade: 'Média' }]]);
  assert.ok(!novaPorNome(r.json, 'Eta Cartons'));
  const v = validar(refs).json;
  assert.strictEqual(v.ok, true, JSON.stringify(v.problemas));
  assert.strictEqual(v.n_empresas, 9);
  assert.strictEqual(v.empresas.find((e) => e.slug === 'eta-cartons').prioridade, 'Média');
  assert.strictEqual(v.empresas.find((e) => e.slug === 'omega-embalagens').prioridade, 'Alta', 'empresa fora da planilha fica como estava');
  assert.strictEqual(ler(refs, 'eta-cartons.md'), fichaAntes.replace('**Prioridade**: a definir', '**Prioridade**: Média'));
});

caso('parecida forte vira pergunta, não fusão', () => {
  const gama = novaPorNome(importar(montar()).json, 'Gama Embalagens');
  assert.deepStrictEqual(gama.parecidas.map((p) => p.slug), ['omega-embalagens']);
  assert.deepStrictEqual(novaPorNome(importar(montar()).json, 'Beta Envase').parecidas, [], 'Beta e Eta não passam do corte de 0,85');
});

caso('aplicar duas vezes não muda nenhum byte', () => {
  const refs = montar();
  importar(refs, '--aplicar');
  const depois = hashDaPasta(refs);
  const r = importar(refs, '--aplicar');
  assert.strictEqual(r.status, 0);
  assert.strictEqual(r.json.arquivos_gravados, 0);
  assert.strictEqual(r.json.novas.length, 0);
  assert.strictEqual(r.json.ja_existem.length, 8);
  assert.strictEqual(hashDaPasta(refs), depois);
});

caso('rodada que parou antes do índice termina na seguinte', () => {
  const limpa = montar();
  importar(limpa, '--aplicar');
  const refs = montar();
  const indiceOriginal = ler(refs, 'INDEX.md');
  importar(refs, '--aplicar');
  fs.writeFileSync(path.join(refs, 'INDEX.md'), indiceOriginal);
  fs.writeFileSync(path.join(refs, 'eta-cartons.md'), ler(path.join(FIXTURE, 'linkedin-data', 'refs'), 'eta-cartons.md'));
  const r = importar(refs, '--aplicar');
  assert.strictEqual(r.json.ok, true, JSON.stringify(r.json.problemas));
  assert.strictEqual(hashDaPasta(refs), hashDaPasta(limpa));
});

caso('lista vazia: o índice nasce com o cabeçalho e valida', () => {
  const refs = montar({ comLista: false });
  const r = importar(refs, '--aplicar');
  assert.strictEqual(r.json.novas.length, 8);
  assert.match(ler(refs, 'INDEX.md'), /^# Índice de referências — empresas do LinkedIn\n\n## Empresas\n\n- \[Alfa Cartonagem\]/);
  const v = validar(refs).json;
  assert.strictEqual(v.ok, true, JSON.stringify(v.problemas));
  assert.deepStrictEqual(v.rodada.devidas.map((e) => e.nome), ['Alfa Cartonagem', 'Épsilon Pack', 'Beta Envase', 'Eta Cartons']);
  assert.deepStrictEqual(v.rodada.sem_linkedin.map((e) => e.nome).sort(), ['Delta Máquinas', 'Gama Embalagens', 'Teta Líquidos']);
  assert.deepStrictEqual(v.rodada.a_definir.map((e) => e.nome), ['Zeta Papéis']);
});

caso('--procurar acha a empresa do grupo pelos nomes relacionados da ficha', () => {
  const refs = montar();
  importar(refs, '--aplicar');
  const r = rodar(INDICE, [refs, '--procurar', 'Beta Envase']).json;
  const alfa = r.candidatos.find((c) => c.slug === 'alfa-cartonagem');
  assert.ok(alfa, JSON.stringify(r.candidatos));
  assert.strictEqual(alfa.por, 'nomes relacionados');
});

caso('coluna obrigatória faltando sai com exit 1 dizendo qual', () => {
  const refs = montar();
  const antes = hashDaPasta(refs);
  const r = rodar(IMPORTAR, [SEM_COLUNA, refs, '--aplicar']);
  assert.strictEqual(r.status, 1);
  const p = r.json.problemas.find((x) => x.tipo === 'coluna_ausente');
  assert.deepStrictEqual(p.colunas, ['Prioridade proposta']);
  assert.match(p.detalhe, /Mapa competitivo/);
  assert.strictEqual(hashDaPasta(refs), antes);
});

caso('índice com problema trava a importação sem gravar', () => {
  const refs = montar();
  fs.appendFileSync(path.join(refs, 'INDEX.md'), '- [Velha](velha.md) — `velha` · id — · setor x · BR · pesquisa 2026-01-01 · sem catálogo\n');
  fs.writeFileSync(path.join(refs, 'velha.md'), '# Velha\n');
  const antes = hashDaPasta(refs);
  const r = importar(refs, '--aplicar');
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.json.problemas[0].tipo, 'indice_com_problemas');
  assert.strictEqual(r.json.problemas[0].problemas[0].tipo, 'formato_antigo');
  assert.strictEqual(hashDaPasta(refs), antes);
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
