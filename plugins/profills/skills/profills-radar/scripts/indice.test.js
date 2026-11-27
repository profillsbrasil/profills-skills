#!/usr/bin/env node
// indice.test.js — a rodada por camadas de prioridade do indice.js, rodada pelo terminal.
// Uso: node plugins/profills/skills/profills-radar/scripts/indice.test.js   (Node >= 18, sem dependência)

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

// Uma coleta terminada com post em <DADOS>/catalog/raw/<rede>/<conta>/<data>/: é dela que sai o catálogo.
function coletar(refs, slug, data, meta = { status: 'ok', concluida: true }, rede = 'linkedin') {
  const pasta = path.join(refs, '..', 'catalog', 'raw', rede, slug, data);
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'posts.json'), JSON.stringify([{ post_id: 'urn:li:activity:1' }]));
  fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify(meta));
}

// [nome, prioridade, dias desde o catálogo no LinkedIn (null = nunca), linkedin, { instagram, dias no Instagram }]
function montar(empresas) {
  const refs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'indice-test-')), 'refs');
  fs.mkdirSync(refs);
  const linhas = empresas.map(([nome, prioridade, dias, linkedin = true, { instagram = null, diasIg = null } = {}]) => {
    const slug = nome.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    fs.writeFileSync(path.join(refs, `${slug}.md`), `# ${nome}\n`);
    if (dias !== null) coletar(refs, slug, antes(dias));
    if (instagram && diasIg !== null) coletar(refs, instagram, antes(diasIg), undefined, 'instagram');
    return `- [${nome}](${slug}.md) — \`${slug}\` · id — · setor caixas · país BR · prioridade ${prioridade} · linkedin ${linkedin ? 'sim' : 'não'} · instagram ${instagram || '—'} · pesquisa ${antes(10)}`;
  });
  fs.writeFileSync(path.join(refs, 'INDEX.md'), ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', '', ...linhas, ''].join('\n'));
  return refs;
}

function comLinhas(linhas) {
  const refs = fs.mkdtempSync(path.join(os.tmpdir(), 'indice-test-'));
  for (const l of linhas) fs.writeFileSync(path.join(refs, l.match(/\]\(([^)]+)\)/)[1]), '# ficha\n');
  fs.writeFileSync(path.join(refs, 'INDEX.md'), ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', '', ...linhas, ''].join('\n'));
  return refs;
}

const validar = (refs) => JSON.parse(spawnSync(process.execPath, [INDICE, refs, '--hoje', HOJE], { encoding: 'utf8' }).stdout);
const reconstruir = (refs) => JSON.parse(spawnSync(process.execPath, [INDICE, refs, '--reconstruir', '--hoje', HOJE], { encoding: 'utf8' }).stdout);
const LINHA = (instagram) => `- [Alfa](alfa.md) — \`alfa\` · id — · setor caixas · país BR · prioridade Alta · linkedin sim · ${instagram}pesquisa ${antes(10)}`;

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
  assert.strictEqual(r.limite_paginas, 36);
  assert.strictEqual(r.paginas, 5 * 3, 'cinco contas do LinkedIn, 3 páginas cada');
  assert.deepStrictEqual(nomes(r.devidas), ['Alta Ontem', 'Media Nunca', 'Media 14', 'Adjacente 28', 'Validacao 40']);
  assert.deepStrictEqual(nomes(r.em_dia), ['Media 13', 'Adjacente 27']);
  assert.deepStrictEqual(nomes(r.a_definir), ['Sem Prioridade']);
  assert.deepStrictEqual(nomes(r.sem_rede), ['Alta Sem Pagina'], 'sem LinkedIn e sem Instagram nunca entra em devidas, nem sendo Alta');
  assert.deepStrictEqual(r.fora_do_limite, []);
});

caso('só LinkedIn, o limite de páginas leva 12 empresas, e as demais vão para fora_do_limite na mesma ordem', () => {
  const alta = Array.from({ length: 14 }, (_, i) => [`Alta ${String(i).padStart(2, '0')}`, 'Alta', i]);
  const saida = rodada(montar([...alta, ['Media Nunca', 'Média', null]]));
  const r = saida.rodada;
  assert.strictEqual(r.devidas.length, 12);
  assert.strictEqual(r.devidas[0].nome, 'Alta 13', 'catálogo mais antigo primeiro');
  assert.deepStrictEqual(nomes(r.fora_do_limite), ['Alta 01', 'Alta 00', 'Media Nunca']);
  const baldes = ['devidas', 'fora_do_limite', 'em_dia', 'sem_rede', 'a_definir'].flatMap((b) => nomes(r[b]));
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

caso('o campo instagram chega em empresas[]: o handle, ou null com —', () => {
  const refs = comLinhas([LINHA('instagram alfa.cartonagem_br · '), LINHA('instagram — · ').replace(/alfa/g, 'beta')]);
  const v = validar(refs);
  assert.strictEqual(v.ok, true, JSON.stringify(v.problemas));
  assert.deepStrictEqual(v.empresas.map((e) => [e.slug, e.instagram]), [['alfa', 'alfa.cartonagem_br'], ['beta', null]]);
});

caso('linha sem o campo instagram é da versão anterior da pasta: formato_antigo', () => {
  const v = validar(comLinhas([LINHA('')]));
  assert.strictEqual(v.ok, false);
  assert.deepStrictEqual(v.problemas.map((p) => p.tipo), ['formato_antigo'], 'não é campo_ausente: quem resolve é a profills-setup');
  assert.strictEqual(v.empresas[0].instagram, null);
});

caso('instagram com @ ou fora de letras, números, ponto e _ é instagram_invalido', () => {
  for (const ruim of ['@alfa', 'alfa cartonagem', 'instagram.com/alfa']) {
    const v = validar(comLinhas([LINHA(`instagram ${ruim} · `)]));
    assert.deepStrictEqual(v.problemas.map((p) => p.tipo), ['instagram_invalido'], ruim);
  }
});

caso('o catálogo sai das coletas: a data mais recente concluída com status ok', () => {
  const refs = montar([['Alfa', 'Média', null], ['Beta', 'Média', null], ['Gama', 'Média', null]]);
  coletar(refs, 'alfa', antes(20));
  coletar(refs, 'alfa', antes(5), { status: 'ok', concluida: false });
  coletar(refs, 'beta', antes(3), { status: 'sem_posts', concluida: true });
  const pastaLegada = path.join(refs, '..', 'catalog', 'raw', 'linkedin', 'gama', antes(2));
  fs.mkdirSync(pastaLegada, { recursive: true });
  fs.writeFileSync(path.join(pastaLegada, 'posts.json'), JSON.stringify([{ post_id: 'urn:li:activity:9' }]));
  const saida = rodada(refs);
  assert.deepStrictEqual(
    saida.empresas.map((e) => [e.slug, e.contas[0].catalogo]),
    [['alfa', antes(20)], ['beta', null], ['gama', antes(2)]],
    'interrompida e sem_posts não contam; a coleta de 2026-07 sem meta.json conta',
  );
  assert.deepStrictEqual(nomes(saida.rodada.devidas), ['Beta', 'Alfa']);
  assert.deepStrictEqual(nomes(saida.rodada.em_dia), ['Gama']);
});

caso('--catalog aponta outra pasta de coletas também na validação', () => {
  const refs = montar([['Alfa', 'Média', null]]);
  const outra = fs.mkdtempSync(path.join(os.tmpdir(), 'indice-test-'));
  const pasta = path.join(outra, 'linkedin', 'alfa', antes(1));
  fs.mkdirSync(pasta, { recursive: true });
  fs.writeFileSync(path.join(pasta, 'posts.json'), '[]');
  fs.writeFileSync(path.join(pasta, 'meta.json'), JSON.stringify({ status: 'ok', concluida: true }));
  const v = JSON.parse(spawnSync(process.execPath, [INDICE, refs, '--catalog', outra, '--hoje', HOJE], { encoding: 'utf8' }).stdout);
  assert.deepStrictEqual(v.empresas.map((e) => e.contas), [[{ rede: 'linkedin', conta: 'alfa', catalogo: antes(1) }]]);
});

caso('linha que ainda traz o campo catálogo é da pasta anterior: formato_antigo', () => {
  for (const campo of ['sem catálogo', `catálogo ${antes(3)}`]) {
    const v = validar(comLinhas([`${LINHA('instagram — · ')} · ${campo}`]));
    assert.strictEqual(v.ok, false, campo);
    assert.deepStrictEqual(v.problemas.map((p) => p.tipo), ['formato_antigo'], campo);
    assert.match(v.problemas[0].detalhe, /catálogo/);
  }
});

caso('--reconstruir escreve a linha sem catálogo e traz o Instagram da ficha', () => {
  const dados = fs.mkdtempSync(path.join(os.tmpdir(), 'indice-test-'));
  const refs = path.join(dados, 'refs');
  fs.mkdirSync(refs);
  fs.writeFileSync(
    path.join(refs, 'alfa.md'),
    '# Alfa\n\n- **Endereço no LinkedIn**: `alfa` (`linkedin.com/company/alfa`)\n- **Instagram**: `alfa.br` (`instagram.com/alfa.br`)\n- **Setor**: caixas\n- **País / idioma dos posts**: BR · PT\n- **Última pesquisa**: 2026-11-01\n',
  );
  coletar(refs, 'alfa', '2026-11-02');
  coletar(refs, 'alfa', '2026-11-05', { concluida: false });
  const r = reconstruir(refs);
  assert.strictEqual(r.ok, true, JSON.stringify(r.problemas));
  assert.deepStrictEqual(r.escritas.map((e) => [e.slug, e.instagram]), [['alfa', 'alfa.br']]);
  assert.match(fs.readFileSync(path.join(refs, 'INDEX.md'), 'utf8'), / · linkedin sim · instagram alfa\.br · pesquisa 2026-11-01$/m);
  const v = validar(refs);
  assert.strictEqual(v.ok, true, JSON.stringify(v.problemas));
  assert.deepStrictEqual(v.empresas[0].contas, [
    { rede: 'linkedin', conta: 'alfa', catalogo: '2026-11-02' },
    { rede: 'instagram', conta: 'alfa.br', catalogo: null },
  ], 'a coleta de 05/11 com concluida false não é catálogo');
});

caso('empresa só com Instagram entra na rodada com a conta do Instagram, que custa 6 páginas', () => {
  const r = rodada(montar([['So Insta', 'Alta', null, false, { instagram: 'so.insta' }]])).rodada;
  assert.deepStrictEqual(r.devidas.map((e) => [e.nome, e.contas.map((c) => [c.rede, c.conta, c.catalogo]), e.paginas]), [
    ['So Insta', [['instagram', 'so.insta', null]], 6],
  ]);
  assert.deepStrictEqual(r.sem_rede, []);
});

caso('empresa com as duas redes leva só a conta vencida; o catálogo do Instagram sai de raw/instagram/<handle>', () => {
  const saida = rodada(montar([
    ['Duas Vencidas', 'Média', 20, true, { instagram: 'duas.vencidas', diasIg: 30 }],
    ['So Insta Vencido', 'Média', 2, true, { instagram: 'insta.vencido' }],
    ['Em Dia', 'Média', 2, true, { instagram: 'em.dia', diasIg: 3 }],
  ]));
  const r = saida.rodada;
  assert.deepStrictEqual(r.devidas.map((e) => [e.nome, e.contas.map((c) => `${c.rede}:${c.dias_desde_catalogo}`), e.paginas]), [
    ['So Insta Vencido', ['instagram:null'], 6],
    ['Duas Vencidas', ['linkedin:20', 'instagram:30'], 9],
  ], 'nunca catalogada primeiro; a que tem as duas vencidas soma 3 + 6 páginas');
  assert.deepStrictEqual(nomes(r.em_dia), ['Em Dia']);
  assert.deepStrictEqual(r.em_dia[0].contas.map((c) => [c.rede, c.catalogo]), [['linkedin', antes(2)], ['instagram', antes(3)]]);
  assert.strictEqual(r.paginas, 15);
});

caso('o limite é de páginas das duas redes: quatro empresas com as duas cabem, a quinta fica de fora', () => {
  const cinco = Array.from({ length: 5 }, (_, i) => [`Dupla ${i}`, 'Alta', null, true, { instagram: `dupla.${i}` }]);
  const r = rodada(montar(cinco)).rodada;
  assert.deepStrictEqual([r.devidas.length, r.paginas, nomes(r.fora_do_limite)], [4, 36, ['Dupla 4']]);
});

caso('a primeira empresa que não cabe leva as seguintes para fora_do_limite, mesmo as que caberiam', () => {
  const r = rodada(montar([
    ...Array.from({ length: 11 }, (_, i) => [`Linkedin ${String(i).padStart(2, '0')}`, 'Alta', 40 - i]),
    ['Dupla', 'Alta', 1, true, { instagram: 'dupla.br', diasIg: 1 }],
    ['Media', 'Média', null],
  ])).rodada;
  assert.deepStrictEqual([r.devidas.length, r.paginas, nomes(r.fora_do_limite)], [11, 33, ['Dupla', 'Media']]);
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
