#!/usr/bin/env node
// importar.test.js — casos da importação de planilha, rodados pelo terminal como o comercial roda.
// Uso: node skills/profills-radar/scripts/importar.test.js   (Node >= 18, sem dependência)
// A planilha é a fixture fictícia do eval 8, gerada por fixtures/gerar-planilhas.py.

const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
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
  assert.strictEqual(novaPorNome(r.json, 'Alfa Cartonagem').pesquisa, '2026-08-20');
  assert.strictEqual(novaPorNome(r.json, 'Zeta Papéis').pesquisa, '2026-08-21');
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

caso('--pular deixa a linha de fora e diz qual', () => {
  const refs = montar();
  const r = importar(refs, '--pular', 'F003', '--aplicar');
  assert.strictEqual(r.json.ok, true);
  assert.deepStrictEqual(r.json.puladas, [{ id_planilha: 'F003', nome: 'Gama Embalagens' }]);
  assert.ok(!novaPorNome(r.json, 'Gama Embalagens'));
  assert.ok(!fs.existsSync(path.join(refs, 'gama-embalagens.md')));
});

caso('--pular com ID que não está na planilha é problema com o ID, e nada é gravado', () => {
  const refs = montar();
  const antes = hashDaPasta(refs);
  const r = importar(refs, '--pular', 'F003', '--pular', 'Z999', '--aplicar');
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.json.ok, false);
  const [p] = problemaDo(r, 'pular_id_inexistente');
  assert.ok(p, JSON.stringify(r.json.problemas));
  assert.strictEqual(p.id_planilha, 'Z999');
  assert.match(p.detalhe, /Z999/);
  assert.strictEqual(problemaDo(r, 'pular_id_inexistente').length, 1, 'F003 está na planilha');
  assert.strictEqual(hashDaPasta(refs), antes);
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

// ---------- planilhas montadas no próprio teste ----------

const TABELA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// Zip mínimo: cada entrada com deflate, CRC e tamanhos certos (o teste estraga depois, quando quer).
function zip(arquivos) {
  const locais = [];
  const centrais = [];
  let offset = 0;
  for (const [nome, texto] of Object.entries(arquivos)) {
    const cru = Buffer.from(texto, 'utf8');
    const dados = zlib.deflateRawSync(cru);
    const n = Buffer.from(nome, 'utf8');
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);
    local.writeUInt32LE(crc32(cru), 14);
    local.writeUInt32LE(dados.length, 18);
    local.writeUInt32LE(cru.length, 22);
    local.writeUInt16LE(n.length, 26);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(crc32(cru), 16);
    central.writeUInt32LE(dados.length, 20);
    central.writeUInt32LE(cru.length, 24);
    central.writeUInt16LE(n.length, 28);
    central.writeUInt32LE(offset, 42);
    locais.push(local, n, dados);
    centrais.push(central, n);
    offset += 30 + n.length + dados.length;
  }
  const diretorio = Buffer.concat(centrais);
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(Object.keys(arquivos).length, 8);
  fim.writeUInt16LE(Object.keys(arquivos).length, 10);
  fim.writeUInt32LE(diretorio.length, 12);
  fim.writeUInt32LE(offset, 16);
  return Buffer.concat([...locais, diretorio, fim]);
}

const escapar = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const letra = (j) => String.fromCharCode(65 + j);

// Célula: texto vira inlineStr, número vira número, { f } é fórmula sem valor guardado, { f, v } com valor.
function celula(valor, ref) {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return `<c r="${ref}"><v>${valor}</v></c>`;
  if (typeof valor === 'object') return `<c r="${ref}"${valor.v !== undefined ? ' t="str"' : ''}><f>${escapar(valor.f)}</f>${valor.v !== undefined ? `<v>${escapar(valor.v)}</v>` : ''}</c>`;
  return `<c r="${ref}" t="inlineStr"><is><t>${escapar(valor)}</t></is></c>`;
}

function xlsx(abas) {
  const nomes = Object.keys(abas);
  const arquivos = {
    '[Content_Types].xml': '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>',
    'xl/workbook.xml': `<?xml version="1.0"?><workbook xmlns:r="r"><sheets>${nomes.map((n, i) => `<sheet name="${escapar(n)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0"?><Relationships>${nomes.map((_, i) => `<Relationship Id="rId${i + 1}" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}</Relationships>`,
  };
  nomes.forEach((n, i) => {
    const linhas = abas[n].map((cels, k) => `<row r="${k + 1}">${cels.map((v, j) => celula(v, `${letra(j)}${k + 1}`)).join('')}</row>`);
    arquivos[`xl/worksheets/sheet${i + 1}.xml`] = `<?xml version="1.0"?><worksheet><sheetData>${linhas.join('')}</sheetData></worksheet>`;
  });
  return zip(arquivos);
}

const CAB_MAPA = ['ID', 'Empresa / unidade', 'Origem', 'Papel no mercado', 'Prioridade proposta', 'Grupo e nomes relacionados', 'Conferido em'];
const CAB_CANAIS = ['ID empresa', 'Canal', 'URL', 'Status da identificação'];

// mapa: [id, nome, prioridade, relacionados, conferido]; canais: [id, url, status]
function gravarPlanilha(mapa, canais) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'importar-xlsx-'));
  const arquivo = path.join(dir, 'planilha.xlsx');
  fs.writeFileSync(
    arquivo,
    xlsx({
      'Mapa competitivo': [['Título da planilha'], CAB_MAPA, ...mapa.map(([id, nome, prio, rel = '—', conf = '2026-11-01']) => [id, nome, 'Brasil', 'Caixas', prio, rel, conf])],
      'Canais digitais': [CAB_CANAIS, ...canais.map(([id, url, status = 'Localizado']) => [id, 'LinkedIn', url, status])],
    }),
  );
  return arquivo;
}

const LI = (slug) => `https://www.linkedin.com/company/${slug}`;
const problemaDo = (r, tipo) => (r.json ? r.json.problemas.filter((p) => p.tipo === tipo) : []);

caso('crc32 do teste bate com o do zlib', () => {
  if (!zlib.crc32) return;
  const b = Buffer.from('Mapa competitivo · Canais digitais');
  assert.strictEqual(crc32(b), zlib.crc32(b));
});

caso('fórmula sem valor guardado vira problema com ID, aba e linha, e nada é gravado', () => {
  const refs = montar();
  const antes = hashDaPasta(refs);
  const planilha = gravarPlanilha([['G1', { f: 'CONCATENATE("Del","ta")' }, 'Alta'], ['G2', 'Kappa', { f: '"Al"&"ta"' }]], [['G1', LI('delta')], ['G2', LI('kappa')]]);
  const r = rodar(IMPORTAR, [planilha, refs, '--aplicar']);
  assert.strictEqual(r.status, 1, r.stderr);
  assert.strictEqual(r.json.ok, false);
  const f = problemaDo(r, 'formula_sem_valor');
  assert.deepStrictEqual(f.map((p) => [p.id_planilha, p.aba, p.linha, p.coluna]), [['G1', 'Mapa competitivo', 3, 'Empresa / unidade'], ['G2', 'Mapa competitivo', 4, 'Prioridade proposta']]);
  assert.strictEqual(hashDaPasta(refs), antes);
});

caso('fórmula com valor guardado vale o valor', () => {
  const planilha = gravarPlanilha([['G1', { f: 'CONCATENATE("Del","ta")', v: 'Delta Caixas' }, 'Alta']], [['G1', LI('delta-caixas')]]);
  const r = rodar(IMPORTAR, [planilha, montar()]);
  assert.strictEqual(r.json.ok, true, JSON.stringify(r.json.problemas));
  assert.deepStrictEqual(nomes(r.json.novas), ['Delta Caixas']);
});

caso('nome vazio numa linha com ID vira celula_vazia', () => {
  const refs = montar();
  const planilha = gravarPlanilha([['G1', 'Kappa', 'Alta'], ['G2', null, 'Alta']], [['G1', LI('kappa')]]);
  const r = rodar(IMPORTAR, [planilha, refs, '--aplicar']);
  assert.strictEqual(r.status, 1);
  assert.deepStrictEqual(problemaDo(r, 'celula_vazia').map((p) => [p.id_planilha, p.linha, p.coluna]), [['G2', 4, 'Empresa / unidade']]);
  assert.ok(!fs.existsSync(path.join(refs, 'kappa.md')));
});

function corromper(origem, nome, deslocamento) {
  const b = Buffer.from(fs.readFileSync(origem));
  let p = b.length - 22;
  while (b.readUInt32LE(p) !== 0x06054b50) p--;
  p = b.readUInt32LE(p + 16);
  for (;;) {
    const n = b.readUInt16LE(p + 28);
    if (b.toString('utf8', p + 46, p + 46 + n) === nome) break;
    p += 46 + n + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  const local = b.readUInt32LE(p + 42);
  const tamanho = b.readUInt32LE(p + 20);
  const inicio = local + 30 + b.readUInt16LE(local + 26) + b.readUInt16LE(local + 28);
  const alvo = inicio + Math.min(deslocamento, tamanho - 4);
  for (let k = 0; k < 4; k++) b[alvo + k] ^= 0x55;
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'importar-corr-')), 'corrompida.xlsx');
  fs.writeFileSync(destino, b);
  return destino;
}

caso('byte estragado em qualquer parte lida da planilha sai com exit 2 "planilha corrompida"', () => {
  const refs = montar();
  const antes = hashDaPasta(refs);
  const passaram = [];
  for (const nome of ['xl/workbook.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/sharedStrings.xml']) {
    for (const d of [0, 10, 40, 90, 150, 300, 600, 900, 1500, 3000]) {
      const r = rodar(IMPORTAR, [corromper(PLANILHA, nome, d), refs, '--aplicar']);
      if (r.status !== 2 || !/planilha corrompida/.test(r.stderr)) passaram.push(`${nome}+${d}: exit ${r.status} ${r.json ? `ok ${r.json.ok}` : r.stderr.trim()}`);
    }
  }
  assert.deepStrictEqual(passaram, []);
  assert.strictEqual(hashDaPasta(refs), antes);
});

caso('tamanho descomprimido diferente do diretório central sai com exit 2', () => {
  const b = Buffer.from(fs.readFileSync(gravarPlanilha([['G1', 'Kappa', 'Alta']], [['G1', LI('kappa')]])));
  let p = b.length - 22;
  while (b.readUInt32LE(p) !== 0x06054b50) p--;
  const total = b.readUInt16LE(p + 10);
  p = b.readUInt32LE(p + 16);
  for (let n = 0; n < total; n++) {
    b.writeUInt32LE(b.readUInt32LE(p + 24) + 1, p + 24);
    p += 46 + b.readUInt16LE(p + 28) + b.readUInt16LE(p + 30) + b.readUInt16LE(p + 32);
  }
  const destino = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'importar-corr-')), 'tamanho.xlsx');
  fs.writeFileSync(destino, b);
  const r = rodar(IMPORTAR, [destino, montar()]);
  assert.strictEqual(r.status, 2);
  assert.match(r.stderr, /planilha corrompida/);
});

caso('planilha sem nenhuma linha de empresa é problema, não ok', () => {
  const r = rodar(IMPORTAR, [gravarPlanilha([], []), montar(), '--aplicar']);
  assert.strictEqual(r.status, 1);
  assert.strictEqual(r.json.ok, false);
  assert.strictEqual(problemaDo(r, 'planilha_sem_empresas').length, 1);
});

caso('mesmo nome, página diferente: conflito_de_endereco com os dois endereços, nada gravado', () => {
  const refs = montar();
  const antes = hashDaPasta(refs);
  const planilha = gravarPlanilha([['H1', 'Eta Cartons', 'Alta'], ['H2', 'Kappa', 'Alta']], [['H1', LI('outra-eta')], ['H2', LI('kappa')]]);
  const r = rodar(IMPORTAR, [planilha, refs, '--aplicar']);
  assert.strictEqual(r.status, 1);
  const [c] = problemaDo(r, 'conflito_de_endereco');
  assert.ok(c, JSON.stringify(r.json && r.json.problemas));
  assert.strictEqual(c.id_planilha, 'H1');
  assert.strictEqual(c.na_lista, 'eta-cartons');
  assert.strictEqual(c.na_planilha, 'outra-eta');
  assert.strictEqual(hashDaPasta(refs), antes);
  const pulando = rodar(IMPORTAR, [planilha, refs, '--pular', 'H1']);
  assert.strictEqual(pulando.json.ok, true, JSON.stringify(pulando.json.problemas));
});

caso('mesmo nome, a lista sem página e a planilha com página: o detalhe diz que a lista tem a empresa sem página', () => {
  const refs = montar();
  const primeira = rodar(IMPORTAR, [gravarPlanilha([['N1', 'Nu Caixas', 'Alta']], []), refs, '--aplicar']);
  assert.strictEqual(primeira.json.ok, true, JSON.stringify(primeira.json.problemas));
  assert.deepStrictEqual(nomes(primeira.json.sem_linkedin), ['Nu Caixas']);
  const r = rodar(IMPORTAR, [gravarPlanilha([['N1', 'Nu Caixas', 'Alta']], [['N1', LI('nu-caixas-br')]]), refs]);
  const [c] = problemaDo(r, 'conflito_de_endereco');
  assert.ok(c, JSON.stringify(r.json && r.json.problemas));
  assert.strictEqual(c.na_lista, null);
  assert.match(c.detalhe, /a lista tem a empresa sem página no LinkedIn e a planilha traz linkedin\.com\/company\/nu-caixas-br/);
});

caso('primeira importação numa pasta refs/ que ainda não existe cria a pasta', () => {
  const refs = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'importar-nova-')), 'refs');
  const r = importar(refs, '--aplicar');
  assert.strictEqual(r.status, 0, r.stderr);
  assert.strictEqual(r.json.novas.length, 8);
  assert.strictEqual(validar(refs).json.ok, true);
});

caso('prioridade sem acento, em caixa alta ou com espaço vira o valor canônico', () => {
  const planilha = gravarPlanilha(
    [['P1', 'Um', 'media'], ['P2', 'Dois', 'ALTA'], ['P3', 'Tres', ' Validação '], ['P4', 'Quatro', 'adjacente']],
    [['P1', LI('um')], ['P2', LI('dois')], ['P3', LI('tres')], ['P4', LI('quatro')]],
  );
  const r = rodar(IMPORTAR, [planilha, montar()]);
  assert.deepStrictEqual(r.json.novas.map((n) => [n.nome, n.prioridade, n.notas]), [['Um', 'Média', []], ['Dois', 'Alta', []], ['Tres', 'Validação', []], ['Quatro', 'Adjacente', []]]);
});

caso('data inválida ou em outro formato: a nota diz que veio inválida e qual era', () => {
  const planilha = gravarPlanilha([['D1', 'Um', 'Alta', '—', '2026-13-40'], ['D2', 'Dois', 'Alta', '—', '5 nov 2026'], ['D3', 'Tres', 'Alta', '—', null]], [['D1', LI('um')], ['D2', LI('dois')], ['D3', LI('tres')]]);
  const r = rodar(IMPORTAR, [planilha, montar()]);
  const nota = (nome) => novaPorNome(r.json, nome).notas.join(' | ');
  assert.match(nota('Um'), /inválida.*"2026-13-40"/);
  assert.match(nota('Dois'), /inválida.*"5 nov 2026"/);
  assert.doesNotMatch(nota('Um'), /não traz/);
  assert.match(nota('Tres'), /não traz a data/);
});

caso('página /showcase/ diz que o endereço não é página de empresa, com o tipo', () => {
  const planilha = gravarPlanilha([['S1', 'Vitrine', 'Alta']], [['S1', 'https://www.linkedin.com/showcase/vitrine-show', 'Perfil localizado']]);
  const r = rodar(IMPORTAR, [planilha, montar()]);
  const [s] = r.json.sem_linkedin;
  assert.strictEqual(s.nome, 'Vitrine');
  assert.match(s.motivo, /o endereço não é página de empresa: showcase/);
  assert.doesNotMatch(s.motivo, /status/);
});

caso('empresa que já existe não ganha um grupo que é só ela; o grupo leva o nome da lista', () => {
  const refs = montar();
  const planilha = gravarPlanilha([['E1', 'Eta Cartons Ltda', 'Média'], ['E2', 'Eta Envase', 'Alta', 'Unidade de envase da E1.']], [['E1', LI('eta-cartons')], ['E2', LI('eta-envase')]]);
  const r = rodar(IMPORTAR, [planilha, refs]);
  assert.strictEqual(r.json.ok, true, JSON.stringify(r.json.problemas));
  assert.deepStrictEqual(r.json.ja_existem.map((j) => [j.nome_na_lista, j.muda]), [['Eta Cartons', { prioridade: 'Média' }]]);
  assert.strictEqual(novaPorNome(r.json, 'Eta Envase').grupo, 'Eta Cartons');
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
