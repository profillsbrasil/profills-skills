#!/usr/bin/env node
// importar.js — traz uma planilha de concorrentes (.xlsx) para a lista da profills-radar (Node >= 18, sem dependência).
// Lê as abas "Mapa competitivo" e "Canais digitais" pelo nome das colunas, cruza cada empresa com a página
// dela no LinkedIn e compara com o índice que já existe. Sem --aplicar só simula. Com --aplicar grava uma
// ficha por empresa nova, pelo assets/dossie-template.md, e a linha dela no INDEX.md pelo formatarLinha do
// indice.js; empresa que já está na lista só ganha prioridade e grupo quando estavam "a definir" ou vazios.
// Idempotente: rodar de novo com a mesma planilha não muda nenhum byte.
// Uso:     node scripts/importar.js <planilha.xlsx> <DADOS>/refs [--aplicar] [--pular <ID>]... [--hoje AAAA-MM-DD]
// Exemplo: node scripts/importar.js concorrentes.xlsx "$HOME/Profills LinkedIn/refs"
//          → {"novas":[...],"ja_existem":[],"sem_linkedin":[...],"perfil_pessoal":[...],"problemas":[],"ok":true}
// Saída: JSON em stdout. Exit 0 = ok · 1 = coluna ou aba faltando, índice com problema, ou conflito de endereço · 2 = erro de uso.

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const indice = require(path.join(__dirname, 'indice.js'));
const TEMPLATE = path.join(__dirname, '..', 'assets', 'dossie-template.md');

function morrer(mensagem) {
  process.stderr.write(mensagem + '\n');
  process.exit(2);
}

function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ---------- zip e xlsx ----------

// Lê o zip pelo diretório central, que é onde ficam os tamanhos certos de cada arquivo.
function lerZip(buffer) {
  let fim = -1;
  for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
    if (buffer.readUInt32LE(i) === 0x06054b50) {
      fim = i;
      break;
    }
  }
  if (fim < 0) throw new Error('o arquivo não é um .xlsx (zip sem diretório central)');
  const total = buffer.readUInt16LE(fim + 10);
  let p = buffer.readUInt32LE(fim + 16);
  const arquivos = new Map();
  for (let n = 0; n < total; n++) {
    if (buffer.readUInt32LE(p) !== 0x02014b50) throw new Error('diretório central do zip corrompido');
    const metodo = buffer.readUInt16LE(p + 10);
    const tamanho = buffer.readUInt32LE(p + 20);
    const nomeLen = buffer.readUInt16LE(p + 28);
    const extraLen = buffer.readUInt16LE(p + 30);
    const comentarioLen = buffer.readUInt16LE(p + 32);
    const local = buffer.readUInt32LE(p + 42);
    const nome = buffer.toString('utf8', p + 46, p + 46 + nomeLen);
    arquivos.set(nome, { metodo, tamanho, local });
    p += 46 + nomeLen + extraLen + comentarioLen;
  }
  return (nome) => {
    const a = arquivos.get(nome);
    if (!a) return null;
    const inicio = a.local + 30 + buffer.readUInt16LE(a.local + 26) + buffer.readUInt16LE(a.local + 28);
    const dados = buffer.subarray(inicio, inicio + a.tamanho);
    let xml;
    if (a.metodo === 0) xml = dados.toString('utf8');
    else if (a.metodo === 8) xml = zlib.inflateRawSync(dados).toString('utf8');
    else throw new Error(`"${nome}" usa uma compressão que este leitor não conhece (${a.metodo})`);
    // Planilha gravada pelo OpenXML SDK prefixa cada elemento (<x:row>, <x:c>); o Excel não.
    return xml.replace(/<(\/?)[A-Za-z_][\w.-]*:(?=[A-Za-z_])/g, '<$1');
  };
}

function decodificar(texto) {
  return texto.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (_, e) => {
    if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10));
    return { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }[e.toLowerCase()];
  });
}

function atributo(tag, nome) {
  const m = tag.match(new RegExp(`\\b${nome}="([^"]*)"`));
  return m ? decodificar(m[1]) : null;
}

// Texto rico vem em vários <t>; a leitura fonética (<rPh>) não é parte do texto.
function textoDe(xml) {
  const limpo = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '');
  return [...limpo.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map((m) => decodificar(m[1])).join('');
}

function colunaDe(ref) {
  let n = 0;
  for (const ch of ref.replace(/\d+$/, '')) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

function lerPlanilha(caminho) {
  const ler = lerZip(fs.readFileSync(caminho));
  const workbook = ler('xl/workbook.xml');
  if (!workbook) throw new Error('o arquivo não tem xl/workbook.xml: não é uma planilha do Excel');
  const rels = new Map(
    [...(ler('xl/_rels/workbook.xml.rels') || '').matchAll(/<Relationship\b[^>]*>/g)].map((m) => [atributo(m[0], 'Id'), atributo(m[0], 'Target')]),
  );
  const compartilhadas = [...(ler('xl/sharedStrings.xml') || '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => textoDe(m[1]));
  const data1904 = /<workbookPr\b[^>]*date1904="(1|true)"/.test(workbook);

  const abas = new Map();
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const alvo = rels.get(atributo(m[0], 'r:id'));
    if (!alvo) continue;
    const xml = ler(alvo.startsWith('/') ? alvo.slice(1) : path.posix.join('xl', alvo));
    if (xml) abas.set(atributo(m[0], 'name'), lerLinhas(xml, compartilhadas));
  }
  return { abas, data1904 };
}

function lerLinhas(xml, compartilhadas) {
  const linhas = [];
  for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const numero = Number(atributo(r[1], 'r')) || linhas.length + 1;
    const celulas = [];
    for (const c of (r[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const ref = atributo(c[1], 'r');
      const tipo = atributo(c[1], 't');
      const corpo = c[2] || '';
      const v = corpo.match(/<v>([\s\S]*?)<\/v>/);
      let valor = null;
      if (tipo === 'inlineStr') valor = textoDe(corpo);
      else if (tipo === 's') valor = v ? compartilhadas[Number(v[1])] : null;
      else if (tipo === 'str' || tipo === 'd') valor = v ? decodificar(v[1]) : null;
      else if (tipo === 'b') valor = v ? v[1] === '1' : null;
      else if (tipo === 'e') valor = null;
      else valor = v ? Number(v[1]) : null;
      celulas[ref ? colunaDe(ref) : celulas.length] = valor;
    }
    linhas[numero - 1] = celulas;
  }
  return linhas;
}

// ---------- as colunas que a importação lê ----------

const ABAS = {
  mapa: {
    nome: 'Mapa competitivo',
    colunas: [
      { campo: 'id', cabecalho: 'ID', obrigatoria: true },
      { campo: 'nome', cabecalho: 'Empresa / unidade', obrigatoria: true },
      { campo: 'origem', cabecalho: 'Origem', obrigatoria: true },
      { campo: 'papel', cabecalho: 'Papel no mercado', obrigatoria: true },
      { campo: 'relacao', cabecalho: 'Relação com GT', obrigatoria: false },
      { campo: 'prioridade', cabecalho: 'Prioridade proposta', obrigatoria: true },
      { campo: 'oferta', cabecalho: 'Oferta localizada', obrigatoria: false },
      { campo: 'aplicacoes', cabecalho: 'Aplicações divulgadas', obrigatoria: false },
      { campo: 'acompanhar', cabecalho: 'O que acompanhar', obrigatoria: false },
      { campo: 'relacionados', cabecalho: 'Grupo e nomes relacionados', obrigatoria: true },
      { campo: 'situacao', cabecalho: 'Situação Brasil / ressalva', obrigatoria: false },
      { campo: 'fonte', cabecalho: 'Fonte da oferta', obrigatoria: false },
      { campo: 'conferido', cabecalho: 'Conferido em', obrigatoria: true, data: true },
    ],
  },
  canais: {
    nome: 'Canais digitais',
    colunas: [
      { campo: 'id', cabecalho: 'ID empresa', obrigatoria: true },
      { campo: 'canal', cabecalho: 'Canal', obrigatoria: true },
      { campo: 'regiao', cabecalho: 'Região / escopo', obrigatoria: false },
      { campo: 'url', cabecalho: 'URL', obrigatoria: true },
      { campo: 'status', cabecalho: 'Status da identificação', obrigatoria: false },
      { campo: 'observacao', cabecalho: 'Observação', obrigatoria: false },
    ],
  },
};

const ENDERECOS = [
  { tipo: 'pagina', re: /linkedin\.com\/company\/([^/?#\s]+)/i },
  { tipo: 'perfil_pessoal', re: /linkedin\.com\/in\//i },
];

function texto(valor) {
  if (valor === null || valor === undefined) return null;
  const t = String(valor).replace(/\s+/g, ' ').trim();
  return t || null;
}

function dataDe(valor, data1904) {
  if (typeof valor === 'number') {
    const base = data1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30);
    return new Date(base + Math.floor(valor) * 86400000).toISOString().slice(0, 10);
  }
  const t = texto(valor) || '';
  const iso = t.match(/^(\d{4}-\d{2}-\d{2})/);
  const br = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  const d = iso ? iso[1] : br ? `${br[3]}-${br[2]}-${br[1]}` : null;
  return d && indice.dataValida(d) ? d : null;
}

// O cabeçalho é a linha com mais nomes de coluna conhecidos; as linhas de cima são título e resumo.
function lerTabela(linhas, aba, data1904) {
  const alvo = (c) => indice.normalizar(c.cabecalho);
  let melhor = { linha: -1, posicoes: new Map() };
  linhas.forEach((celulas, i) => {
    if (!celulas) return;
    const posicoes = new Map();
    celulas.forEach((v, j) => {
      const coluna = aba.colunas.find((c) => texto(v) && indice.normalizar(v) === alvo(c));
      if (coluna && !posicoes.has(coluna.campo)) posicoes.set(coluna.campo, j);
    });
    if (posicoes.size > melhor.posicoes.size) melhor = { linha: i, posicoes };
  });
  if (melhor.posicoes.size < 2) return { erro: { tipo: 'cabecalho_nao_encontrado', aba: aba.nome, detalhe: `a aba "${aba.nome}" não tem uma linha com os nomes das colunas (${aba.colunas.map((c) => c.cabecalho).join(', ')})` } };
  const faltando = aba.colunas.filter((c) => c.obrigatoria && !melhor.posicoes.has(c.campo)).map((c) => c.cabecalho);
  if (faltando.length) {
    return { erro: { tipo: 'coluna_ausente', aba: aba.nome, colunas: faltando, detalhe: `a aba "${aba.nome}" não tem a(s) coluna(s) ${faltando.map((c) => `"${c}"`).join(', ')} (cabeçalho na linha ${melhor.linha + 1})` } };
  }
  const registros = [];
  for (let i = melhor.linha + 1; i < linhas.length; i++) {
    const celulas = linhas[i] || [];
    const r = { linha: i + 1 };
    for (const c of aba.colunas) {
      const bruto = melhor.posicoes.has(c.campo) ? celulas[melhor.posicoes.get(c.campo)] : null;
      r[c.campo] = c.data ? dataDe(bruto, data1904) : texto(bruto);
    }
    if (r.id) registros.push(r);
  }
  return { registros };
}

// ---------- da planilha para empresas ----------

function slugDoNome(nome) {
  return indice.normalizar(nome).replace(/\s+/g, '-');
}

function classificarEndereco(url) {
  for (const e of ENDERECOS) {
    const m = url.match(e.re);
    if (m) return { tipo: e.tipo, slug: m[1] ? decodeURIComponent(m[1]).toLowerCase() : null };
  }
  return { tipo: 'desconhecido', slug: null };
}

// Regra determinística de grupo: um texto de "Grupo e nomes relacionados" que cita o ID de outra linha
// junta as duas no mesmo grupo, e o grupo leva o nome da primeira empresa dele na ordem da planilha.
// Nome de marca solto no texto não junta ninguém: "não confundir com X" também cita nomes.
function grupos(registros) {
  const pai = registros.map((_, i) => i);
  const raiz = (i) => (pai[i] === i ? i : (pai[i] = raiz(pai[i])));
  registros.forEach((r, i) => {
    registros.forEach((outro, j) => {
      if (i === j || !r.relacionados) return;
      const citado = new RegExp(`(^|[^A-Za-z0-9])${outro.id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^A-Za-z0-9]|$)`);
      if (citado.test(r.relacionados)) {
        const [a, b] = [raiz(i), raiz(j)].sort((x, y) => x - y);
        pai[b] = a;
      }
    });
  });
  const tamanho = new Map();
  registros.forEach((_, i) => tamanho.set(raiz(i), (tamanho.get(raiz(i)) || 0) + 1));
  return registros.map((_, i) => (tamanho.get(raiz(i)) > 1 ? registros[raiz(i)].nome : null));
}

function montarEmpresas(mapa, canais, hoje) {
  const grupoDe = grupos(mapa);
  return mapa.map((r, i) => {
    const notas = [];
    const linkedin = canais.filter((c) => c.id === r.id && indice.normalizar(c.canal || '') === 'linkedin');
    const comUrl = linkedin.filter((c) => c.url).map((c) => ({ ...c, ...classificarEndereco(c.url) }));
    const paginas = comUrl.filter((c) => c.tipo === 'pagina');
    const pessoais = comUrl.filter((c) => c.tipo === 'perfil_pessoal');
    for (const c of comUrl.filter((x) => x.tipo === 'desconhecido')) notas.push(`endereço do LinkedIn que não é página de empresa: ${c.url}`);

    let endereco;
    if (paginas.length) endereco = { tipo: 'pagina', motivo: null };
    else if (pessoais.length) endereco = { tipo: 'perfil_pessoal', motivo: 'a planilha aponta só um perfil pessoal no LinkedIn, não a página da empresa; a profills-garimpo não coleta perfil de pessoa' };
    else if (linkedin.length) endereco = { tipo: 'sem_url', motivo: `a planilha não traz endereço no LinkedIn (status: ${linkedin.map((c) => c.status).filter(Boolean).join('; ') || 'sem status'})` };
    else endereco = { tipo: 'sem_url', motivo: 'a planilha não traz o canal LinkedIn desta empresa' };

    const prioridade = indice.PRIORIDADES.includes(r.prioridade) ? r.prioridade : 'a definir';
    if (r.prioridade && prioridade !== r.prioridade) notas.push(`a planilha dizia prioridade "${r.prioridade}", fora da lista (${indice.PRIORIDADES.join(', ')}); ficou "a definir"`);
    if (!r.conferido) notas.push(`a planilha não traz a data "Conferido em"; a pesquisa ficou com a data de hoje (${hoje})`);

    return {
      registro: r,
      id_planilha: r.id,
      nome: r.nome,
      slug: paginas.length ? paginas[0].slug : slugDoNome(r.nome),
      linkedin: paginas.length > 0,
      endereco,
      pagina: paginas[0] || null,
      paginas_extras: paginas.slice(1),
      prioridade,
      grupo: grupoDe[i],
      pesquisa: r.conferido || hoje,
      notas,
    };
  });
}

// ---------- a ficha, pelo template ----------

function lerTemplate() {
  const linhas = indice.lerTexto(TEMPLATE).split('\n');
  const campos = [];
  const secoes = [];
  for (const l of linhas) {
    const campo = l.match(/^-\s+\*\*([^*]+)\*\*:/);
    const secao = l.match(/^##\s+(.+)$/);
    if (secao) secoes.push({ titulo: secao[1].trim(), corpo: [] });
    else if (secoes.length) secoes[secoes.length - 1].corpo.push(l);
    else if (campo) campos.push(campo[1].trim());
  }
  return { campos, secoes: secoes.map((s) => ({ titulo: s.titulo, corpo: s.corpo.join('\n').trim() })) };
}

const SEM_DADO = 'não informado na planilha';

function renderizarFicha(e, contexto) {
  const r = e.registro;
  const endereco = (p) => `\`${p.slug}\` (\`linkedin.com/company/${p.slug}\`)`;
  const extras = e.paginas_extras.map((p) => `${endereco(p)}${[p.regiao, p.observacao].filter(Boolean).length ? ` — ${[p.regiao, p.observacao].filter(Boolean).join(': ')}` : ''}`);
  const valores = {
    'Endereço no LinkedIn': e.linkedin ? endereco(e.pagina) : `\`—\` — ${e.endereco.motivo}`,
    'ID numérico': '`—` — a planilha não traz; a página mostra na primeira coleta',
    Prioridade: e.prioridade,
    Grupo: e.grupo || '—',
    'Grupo e nomes relacionados': r.relacionados || '—',
    'Outras páginas no LinkedIn': extras.length ? extras.join('; ') : '—',
    Setor: r.papel || SEM_DADO,
    'País / idioma dos posts': `${(r.origem || '[a confirmar]').replace(/·/g, '-')} · idioma a confirmar na coleta`,
    'Última pesquisa': e.pesquisa,
    'Confirmação do usuário': '[a confirmar]',
    Fonte: `planilha "${contexto.planilha}", ID ${r.id}, conferida em ${r.conferido || 'data não informada'}; importada em ${contexto.hoje}`,
  };

  const linhaDoLinkedin = e.pagina && (e.pagina.status || e.pagina.observacao) ? [e.pagina.status, e.pagina.observacao].filter(Boolean).join(' — ') : null;
  const contextoLinhas = [
    ['Oferta localizada', r.oferta],
    ['Aplicações divulgadas', r.aplicacoes],
    ['Situação Brasil / ressalva', r.situacao],
    ['Fonte da oferta', r.fonte],
    ['LinkedIn na planilha', linhaDoLinkedin],
    ...e.notas.map((n) => ['Nota da importação', n]),
  ].filter(([, v]) => v);

  const doGrupo = contexto.empresas.filter((o) => o !== e && e.grupo && o.grupo === e.grupo).map((o) => `- ${o.nome} — mesmo grupo (${e.grupo}); tem ficha`);
  const mesmoPapel = contexto.empresas
    .filter((o) => o !== e && r.papel && o.registro.papel === r.papel && !(e.grupo && o.grupo === e.grupo))
    .slice(0, 3)
    .map((o) => `- ${o.nome} — mesmo papel no mercado (${r.papel}) na planilha; tem ficha`);
  const similares = [...doGrupo, ...mesmoPapel];

  const secoes = {
    'Por que é referência': [r.relacao, r.acompanhar ? `O que acompanhar: ${r.acompanhar}` : null].filter(Boolean).join('. ') || `A planilha "${contexto.planilha}" lista a empresa sem dizer por quê.`,
    Contexto: contextoLinhas.length
      ? [...contextoLinhas.map(([k, v]) => `- **${k}**: ${v}`), '', `Fonte: planilha "${contexto.planilha}", conferida em ${r.conferido || 'data não informada'}.`].join('\n')
      : `A planilha "${contexto.planilha}" não traz contexto desta empresa; a primeira re-pesquisa completa esta seção.`,
    Similares: similares.length ? similares.join('\n') : 'A planilha não aponta similares; a primeira re-pesquisa completa esta seção.',
    'Tendências do setor': 'A planilha não traz tendências do setor; a primeira re-pesquisa completa esta seção.',
  };

  const saida = [`# ${e.nome}`, ''];
  for (const campo of contexto.template.campos) saida.push(`- **${campo}**: ${valores[campo] || SEM_DADO}`);
  for (const s of contexto.template.secoes) {
    // As seções que o template deixa só com o comentário (Do Not Copy, Histórico) nascem iguais ao template.
    const corpo = secoes[s.titulo] || (/^<!--[\s\S]*-->$/.test(s.corpo) ? s.corpo : `A planilha não traz dado para esta seção.`);
    saida.push('', `## ${s.titulo}`, '', corpo);
  }
  return saida.join('\n') + '\n';
}

// ---------- o plano ----------

function acharNaLista(e, examinado, pasta) {
  const slugs = new Set([e.slug, ...e.paginas_extras.map((p) => p.slug)]);
  const porSlug = new Map(examinado.empresas.map((x) => [x.slug, x]));
  for (const s of slugs) if (porSlug.has(s)) return { existente: porSlug.get(s), parecidas: [] };
  const nome = indice.normalizar(e.nome);
  const mesmoNome = examinado.empresas.find((x) => indice.normalizar(x.nome) === nome);
  if (mesmoNome) return { existente: mesmoNome, parecidas: [] };
  const candidatos = indice.candidatosParecidos(pasta, e.nome).filter((c) => porSlug.has(c.slug));
  const forte = candidatos.find((c) => c.inteira >= 0.9);
  if (forte) return { existente: porSlug.get(forte.slug), parecidas: [] };
  // Numa planilha de dezenas de linhas, o 0,7 da busca manual faria "Beta" parecer "Eta": aqui só 0,85 ou mais.
  return { existente: null, parecidas: candidatos.filter((c) => c.semelhanca >= 0.85).map(({ nome: n, slug, semelhanca, por }) => ({ nome: n, slug, semelhanca, por })) };
}

const PROBLEMAS_ACEITOS = new Set(['pasta_ausente', 'indice_vazio']);

function planejar(planilhaPath, pasta, hoje, pular) {
  const saida = { planilha: planilhaPath, refs: pasta, hoje, novas: [], ja_existem: [], sem_linkedin: [], perfil_pessoal: [], puladas: [], problemas: [], ok: false };
  let planilha;
  try {
    planilha = lerPlanilha(planilhaPath);
  } catch (e) {
    morrer(`Não deu para ler a planilha "${planilhaPath}": ${e.message}.`);
  }
  const tabelas = {};
  for (const [chave, aba] of Object.entries(ABAS)) {
    const linhas = planilha.abas.get(aba.nome);
    if (!linhas) {
      saida.problemas.push({ tipo: 'aba_ausente', aba: aba.nome, detalhe: `a planilha não tem a aba "${aba.nome}"; abas que ela tem: ${[...planilha.abas.keys()].join(', ')}` });
      continue;
    }
    const t = lerTabela(linhas, aba, planilha.data1904);
    if (t.erro) saida.problemas.push(t.erro);
    else tabelas[chave] = t.registros;
  }
  if (saida.problemas.length) return { saida, plano: null };

  const examinado = indice.examinar(pasta, hoje);
  const semFichas = examinado.problemas.every((p) => p.tipo === 'indice_ausente') && !examinado.fichas_orfas.length;
  const doIndice = examinado.problemas.filter((p) => !PROBLEMAS_ACEITOS.has(p.tipo) && !(p.tipo === 'indice_ausente' && semFichas));
  if (doIndice.length) {
    saida.problemas.push({ tipo: 'indice_com_problemas', detalhe: 'o INDEX.md tem problemas: rode o indice.js e conserte-os antes de importar (ou rode --reconstruir, se o índice sumiu)', problemas: doIndice });
    return { saida, plano: null };
  }

  const empresas = montarEmpresas(tabelas.mapa, tabelas.canais, hoje);
  const contexto = { planilha: path.basename(planilhaPath), hoje, empresas, template: lerTemplate() };
  const vistosId = new Map();
  const vistosSlug = new Map();
  const plano = { criar: [], atualizar: [] };
  const fichas = new Set(fs.existsSync(pasta) ? fs.readdirSync(pasta) : []);

  for (const e of empresas) {
    // --pular: a linha que o usuário disse ser uma empresa que já está na lista com outro nome.
    if (pular.has(e.id_planilha)) {
      saida.puladas.push({ id_planilha: e.id_planilha, nome: e.nome });
      continue;
    }
    if (vistosId.has(e.id_planilha)) {
      saida.problemas.push({ tipo: 'id_repetido_na_planilha', id_planilha: e.id_planilha, detalhe: `o ID ${e.id_planilha} aparece nas linhas ${vistosId.get(e.id_planilha)} e ${e.registro.linha} da aba "${ABAS.mapa.nome}"` });
      continue;
    }
    vistosId.set(e.id_planilha, e.registro.linha);
    if (!indice.SLUG_VALIDO.test(e.slug)) {
      saida.problemas.push({ tipo: 'slug_invalido', id_planilha: e.id_planilha, detalhe: `${e.nome}: o endereço "${e.slug}" tem caractere fora de letras, números, "-" e "_"` });
      continue;
    }
    if (vistosSlug.has(e.slug)) {
      saida.problemas.push({ tipo: 'endereco_repetido_na_planilha', id_planilha: e.id_planilha, detalhe: `${e.nome} e ${vistosSlug.get(e.slug)} dão o mesmo endereço "${e.slug}"` });
      continue;
    }
    vistosSlug.set(e.slug, e.nome);

    if (!e.linkedin) {
      (e.endereco.tipo === 'perfil_pessoal' ? saida.perfil_pessoal : saida.sem_linkedin).push({ nome: e.nome, slug: e.slug, motivo: e.endereco.motivo });
    }

    const { existente, parecidas } = acharNaLista(e, examinado, pasta);
    if (existente) {
      const muda = {};
      if ((existente.prioridade || 'a definir') === 'a definir' && e.prioridade !== 'a definir') muda.prioridade = e.prioridade;
      if (!existente.grupo && e.grupo) muda.grupo = e.grupo;
      saida.ja_existem.push({ id_planilha: e.id_planilha, nome: e.nome, nome_na_lista: existente.nome, slug: existente.slug, muda });
      if (Object.keys(muda).length) plano.atualizar.push({ existente, muda });
      continue;
    }

    const conteudo = renderizarFicha(e, contexto);
    const arquivo = `${e.slug}.md`;
    // Ficha fora da lista com o mesmo conteúdo é sobra de uma importação que parou antes do índice.
    if (fichas.has(arquivo) && fs.readFileSync(path.join(pasta, arquivo), 'utf8') !== conteudo) {
      saida.problemas.push({ tipo: 'ficha_fora_da_lista', id_planilha: e.id_planilha, detalhe: `${e.nome}: já existe a ficha "${arquivo}" fora do índice, com outro conteúdo; reindexe ou remova essa ficha antes de importar` });
      continue;
    }
    saida.novas.push({
      id_planilha: e.id_planilha,
      nome: e.nome,
      slug: e.slug,
      linkedin: e.linkedin,
      prioridade: e.prioridade,
      grupo: e.grupo,
      pesquisa: e.pesquisa,
      outras_paginas: e.paginas_extras.map((p) => p.slug),
      notas: e.notas,
      parecidas,
    });
    plano.criar.push({
      arquivo,
      conteudo,
      linha: indice.formatarLinha({
        nome: e.nome,
        slug: e.slug,
        id: '—',
        setor: e.registro.papel || '[a confirmar]',
        pais: e.registro.origem || '[a confirmar]',
        prioridade: e.prioridade,
        linkedin: e.linkedin,
        pesquisa: e.pesquisa,
        catalogo: null,
        grupo: e.grupo,
        alerta: null,
      }),
    });
  }
  saida.ok = saida.problemas.length === 0;
  return { saida, plano };
}

// ---------- aplicar ----------

function escreverInteiro(caminho, conteudo) {
  const temporario = caminho + '.importar-tmp';
  fs.writeFileSync(temporario, conteudo, 'utf8');
  fs.renameSync(temporario, caminho);
}

// Troca o valor de um campo do topo da ficha; o campo que falta entra logo abaixo do endereço.
function trocarCampo(textoFicha, rotulo, valor) {
  const re = new RegExp(`^(\\s*[-*]\\s*\\*\\*${rotulo}\\*\\*\\s*:).*$`, 'm');
  if (re.test(textoFicha)) return textoFicha.replace(re, `$1 ${valor}`);
  return textoFicha.replace(/^(\s*[-*]\s*\*\*(?:Endereço no LinkedIn|Slug LinkedIn)\*\*\s*:.*)$/m, `$1\n- **${rotulo}**: ${valor}`);
}

const ROTULO = { prioridade: 'Prioridade', grupo: 'Grupo' };

function aplicar(pasta, plano) {
  fs.mkdirSync(pasta, { recursive: true });
  const caminhoIndice = path.join(pasta, 'INDEX.md');
  const bruto = fs.existsSync(caminhoIndice) ? fs.readFileSync(caminhoIndice, 'utf8') : null;
  const quebra = bruto && bruto.includes('\r\n') ? '\r\n' : '\n';
  const linhas = bruto === null ? ['# Índice de referências — empresas do LinkedIn', '', '## Empresas', ''] : bruto.replace(/^﻿/, '').split(quebra);
  let gravados = 0;

  // As fichas vão antes do índice: uma ficha sem linha é retomada na rodada seguinte pelo conteúdo igual.
  for (const c of plano.criar) {
    const caminho = path.join(pasta, c.arquivo);
    if (fs.existsSync(caminho) && fs.readFileSync(caminho, 'utf8') === c.conteudo) continue;
    escreverInteiro(caminho, c.conteudo);
    gravados++;
  }
  for (const { existente, muda } of plano.atualizar) {
    const caminho = path.join(pasta, existente.arquivo);
    let ficha = fs.readFileSync(caminho, 'utf8');
    for (const [campo, valor] of Object.entries(muda)) {
      const lido = ficha.match(new RegExp(`^\\s*[-*]\\s*\\*\\*${ROTULO[campo]}\\*\\*\\s*:\\s*(.*)$`, 'm'));
      const atual = lido ? lido[1].replace(/`/g, '').trim() : '';
      if (!lido || /^(a definir|—|-|)$/i.test(atual) || atual.startsWith('<')) ficha = trocarCampo(ficha, ROTULO[campo], valor);
    }
    escreverInteiro(caminho, ficha);
    gravados++;
    const lida = indice.parsearLinha(linhas[existente.linha - 1], existente.linha).empresa;
    linhas[existente.linha - 1] = indice.formatarLinha({ ...lida, ...muda });
  }
  if (plano.criar.length) {
    while (linhas.length && linhas[linhas.length - 1].trim() === '') linhas.pop();
    if (/^##\s/.test(linhas[linhas.length - 1] || '')) linhas.push('');
    linhas.push(...plano.criar.map((c) => c.linha), '');
  }
  if (plano.criar.length || plano.atualizar.length) {
    escreverInteiro(caminhoIndice, linhas.join(quebra));
    gravados++;
  }
  return gravados;
}

// ---------- argumentos ----------

function principal(argv) {
  const args = argv.slice(2);
  const uso = 'Uso: node scripts/importar.js <planilha.xlsx> <DADOS>/refs [--aplicar] [--pular <ID>]... [--hoje AAAA-MM-DD]';
  const posicionais = [];
  let aplicarAgora = false;
  const pular = new Set();
  let hoje = hojeISO();
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--aplicar') aplicarAgora = true;
    else if (a === '--pular') {
      const id = args[++i];
      if (!id) morrer('Uso: --pular precisa do ID da linha na planilha, ex.: --pular G007.');
      pular.add(id);
    }
    else if (a === '--hoje') {
      hoje = args[++i];
      if (!hoje || !indice.dataValida(hoje)) morrer('Uso: --hoje precisa de uma data AAAA-MM-DD, ex.: --hoje 2026-11-06.');
    } else if (a.startsWith('--')) morrer(`Opção desconhecida: ${a}. ${uso}`);
    else posicionais.push(a);
  }
  if (posicionais.length !== 2) morrer(uso);
  const [planilha, refs] = posicionais.map((p) => path.resolve(p));
  if (!fs.existsSync(planilha) || !fs.statSync(planilha).isFile()) morrer(`Planilha não encontrada: ${planilha}`);
  if (fs.existsSync(refs) && !fs.statSync(refs).isDirectory()) morrer(`Não é uma pasta: ${refs}`);

  const { saida, plano } = planejar(planilha, refs, hoje, pular);
  saida.aplicado = false;
  saida.arquivos_gravados = 0;
  if (aplicarAgora && saida.ok) {
    saida.arquivos_gravados = aplicar(refs, plano);
    saida.aplicado = true;
  }
  saida.resumo = {
    novas: saida.novas.length,
    ja_existem: saida.ja_existem.length,
    ja_existem_com_mudanca: saida.ja_existem.filter((j) => Object.keys(j.muda).length).length,
    sem_linkedin: saida.sem_linkedin.length,
    perfil_pessoal: saida.perfil_pessoal.length,
    com_grupo: saida.novas.filter((n) => n.grupo).length,
  };
  const { ok, ...resto } = saida;
  process.stdout.write(JSON.stringify({ ...resto, ok }, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}

principal(process.argv);
