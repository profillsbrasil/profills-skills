#!/usr/bin/env node
// indice.test.js — a rodada por camadas de prioridade do indice.js, rodada pelo terminal.
// Uso: node skills/profills-radar/scripts/indice.test.js   (Node >= 18, sem dependência)

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const INDICE = path.join(__dirname, 'indice.js');
const HOJE = '2026-11-06';

function antes(dias) {
  const d = new Date(HOJE + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - dias);
  return d.toISOString().slice(0, 10);
}

// [nome, prioridade, dias desde o catálogo (null = nunca), linkedin]
function montar(empresas) {
  const refs = fs.mkdtempSync(path.join(os.tmpdir(), 'indice-test-'));
  const linhas = empresas.map(([nome, prioridade, dias, linkedin = true]) => {
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    fs.writeFileSync(path.join(refs, `${slug}.md`), `# ${nome}\n`);
    const catalogo = dias === null ? 'sem catálogo' : `catálogo ${antes(dias)}`;
    return `- [${nome}](${slug}.md) — \`${slug}\` · id — · setor caixas · país BR · prioridade ${prioridade} · linkedin ${linkedin ? 'sim' : 'não'} · pesquisa ${antes(10)} · ${catalogo}`;
  });
  fs.writeFileSync(path.join(refs, 'INDEX.md'), ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', '', ...linhas, ''].join('\n'));
  return refs;
}

function rodada(refs) {
  const r = spawnSync(process.execPath, [INDICE, refs, '--hoje', HOJE], { encoding: 'utf8' });
  const saida = JSON.parse(r.stdout);
  assert.strictEqual(saida.ok, true, JSON.stringify(saida.problemas));
  return saida;
}

const nomes = (lista) => lista.map((e) => e.nome);
const casos = [];
const caso = (nome, fn) => casos.push({ nome, fn });

caso('cada camada espera o seu intervalo', () => {
  const r = rodada(
    montar([
      ['Alta Ontem', 'Alta', 1],
      ['Media 13', 'Média', 13],
      ['Media 14', 'Média', 14],
      ['Media Nunca', 'Média', null],
      ['Adjacente 27', 'Adjacente', 27],
      ['Adjacente 28', 'Adjacente', 28],
      ['Validacao 40', 'Validação', 40],
      ['Sem Prioridade', 'a definir', null],
      ['Alta Sem Pagina', 'Alta', null, false],
    ]),
  ).rodada;
  assert.strictEqual(r.limite_por_rodada, 12);
  assert.deepStrictEqual(nomes(r.devidas), ['Alta Ontem', 'Media Nunca', 'Media 14', 'Adjacente 28', 'Validacao 40']);
  assert.deepStrictEqual(nomes(r.em_dia), ['Media 13', 'Adjacente 27']);
  assert.deepStrictEqual(nomes(r.a_definir), ['Sem Prioridade']);
  assert.deepStrictEqual(nomes(r.sem_linkedin), ['Alta Sem Pagina'], 'linkedin não nunca entra em devidas, nem sendo Alta');
  assert.deepStrictEqual(r.fora_do_limite, []);
});

caso('passa de 12: as demais vão para fora_do_limite, na mesma ordem', () => {
  const alta = Array.from({ length: 14 }, (_, i) => [`Alta ${String(i).padStart(2, '0')}`, 'Alta', i]);
  const saida = rodada(montar([...alta, ['Media Nunca', 'Média', null]]));
  const r = saida.rodada;
  assert.strictEqual(r.devidas.length, 12);
  assert.strictEqual(r.devidas[0].nome, 'Alta 13', 'catálogo mais antigo primeiro');
  assert.deepStrictEqual(nomes(r.fora_do_limite), ['Alta 01', 'Alta 00', 'Media Nunca']);
  const baldes = ['devidas', 'fora_do_limite', 'em_dia', 'sem_linkedin', 'a_definir'].flatMap((b) => nomes(r[b]));
  assert.deepStrictEqual(baldes.sort(), nomes(saida.empresas).sort(), 'cada empresa cai em exatamente um balde');
});

caso('nunca catalogada vem antes da catalogada na mesma camada', () => {
  const r = rodada(montar([['Alta Velha', 'Alta', 90], ['Alta Nova', 'Alta', null]])).rodada;
  assert.deepStrictEqual(nomes(r.devidas), ['Alta Nova', 'Alta Velha']);
});

caso('--procurar acha pelo campo grupo da ficha', () => {
  const refs = montar([['Kappa Caixas', 'Alta', null]]);
  fs.writeFileSync(path.join(refs, 'kappa-caixas.md'), '# Kappa Caixas\n\n- **Endereço no LinkedIn**: `kappa-caixas`\n- **Grupo**: Grupo Lambda\n');
  const r = JSON.parse(spawnSync(process.execPath, [INDICE, refs, '--procurar', 'Grupo Lambda'], { encoding: 'utf8' }).stdout);
  assert.deepStrictEqual(r.candidatos.map((c) => [c.slug, c.por]), [['kappa-caixas', 'grupo']]);
});

caso('catálogo com data no futuro vira aviso e a empresa entra na rodada', () => {
  const saida = rodada(montar([['Media Futuro', 'Média', -30], ['Media 3', 'Média', 3]]));
  assert.deepStrictEqual(nomes(saida.rodada.devidas), ['Media Futuro']);
  assert.deepStrictEqual(nomes(saida.rodada.em_dia), ['Media 3']);
  assert.deepStrictEqual((saida.avisos || []).map((a) => [a.tipo, a.slug, a.catalogo]), [['catalogo_no_futuro', 'media-futuro', antes(-30)]]);
});

caso('pasta refs/ ausente: --procurar e a validação não quebram', () => {
  const refs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'indice-test-')), 'refs');
  const v = spawnSync(process.execPath, [INDICE, refs, '--hoje', HOJE], { encoding: 'utf8' });
  assert.strictEqual(v.stderr, '');
  assert.strictEqual(JSON.parse(v.stdout).pasta_existe, false);
  const { candidatosParecidos } = require(INDICE);
  assert.deepStrictEqual(candidatosParecidos(refs, 'Kappa'), []);
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
