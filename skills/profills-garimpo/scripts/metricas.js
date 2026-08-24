#!/usr/bin/env node
/*
 * metricas.js — a conta do catálogo, num lugar só.
 *
 * Lê posts.json + meta.json de UMA coleta e devolve todo número que o perfil,
 * o _summary.md, o dashboard e a resposta ao usuário usam. Ninguém recalcula
 * em prosa o que sai daqui.
 *
 * Uso:  node scripts/metricas.js <DADOS/catalog/raw/<slug>/<AAAA-MM-DD>> [--janela padrao|ampliada]
 * Ex.:  node scripts/metricas.js "$DADOS/catalog/raw/skymsen/2026-07-14"
 * Saída (stdout, JSON): {"slug":"skymsen","status":"ok","n_posts":5,"taxa_normalizada":null,
 *   "engajamento_medio":8,"posts_por_semana":5,"formato_dominante":"video",
 *   "destaque_semana":{"post_id":"urn:li:activity:..."},"avisos":["..."],"ok":false}
 * Exit: 0 coleta utilizável (leia `avisos` mesmo assim) · 1 status ≠ ok (sem perfil) · 2 erro de uso/arquivo
 *       ou posts.json malformado (não é array, item que não é objeto de post).
 * Nenhuma estatística sai como NaN: entrada ilegível vira `null` + aviso dizendo por quê.
 */

'use strict';

const fs = require('fs');
const path = require('path');

// --------------------------------------------------------------- utilidades

function morra(msg) {
  process.stderr.write(msg + '\n');
  process.exit(2);
}

function arredonda(n, casas) {
  const f = Math.pow(10, casas);
  return Math.round(n * f) / f;
}

function leJson(arquivo) {
  let bruto;
  try {
    bruto = fs.readFileSync(arquivo, 'utf8');
  } catch (e) {
    return { erro: `não consegui ler ${arquivo}: ${e.code || e.message}` };
  }
  try {
    return { valor: JSON.parse(bruto) };
  } catch (e) {
    return { erro: `${path.basename(arquivo)} não é JSON válido: ${e.message}` };
  }
}

// Um contador do LinkedIn pode chegar como número (12), como string numérica
// ("12", "1.200") ou como o abreviado da própria UI ("1,2 mil", "3 mil").
// Devolve { valor } quando dá para ler, { invalido: true } quando não dá.
// Ausente ou string vazia contam como 0, que é o que o schema já assumia.
function numeroBr(v) {
  if (v === null || v === undefined) return { valor: 0 };
  if (typeof v === 'number') return Number.isFinite(v) ? { valor: v } : { invalido: true };
  if (typeof v !== 'string') return { invalido: true };

  let s = v.trim().replace(/[\u00a0\u202f]/g, ' ').toLowerCase();
  if (s === '') return { valor: 0 };

  let mult = 1;
  const abrev = s.match(/^(.*?)\s*(mil|mi|milh(?:ão|ões|ao|oes))$/);
  if (abrev) {
    s = abrev[1].trim();
    mult = abrev[2] === 'mil' ? 1000 : 1000000;
    if (s === '') return { invalido: true };
  }

  // pt-BR: ponto separa milhar, vírgula separa decimal
  const limpo = s.replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(limpo)) return { invalido: true };

  const n = Number(limpo) * mult;
  if (!Number.isFinite(n)) return { invalido: true };
  return { valor: mult === 1 ? n : Math.round(n) };
}

// Lê o bloco `engajamento` de um post. Qualquer campo ilegível invalida o post
// inteiro: ele sai das médias, do destaque e dos outliers em vez de virar 0
// silencioso (0 é um dado, "não consegui ler" é outro).
function analisaEngajamento(p) {
  const e = p.engajamento;
  if (e === null || e === undefined) return { likes: 0, comentarios: 0, reposts: 0 };
  if (typeof e !== 'object' || Array.isArray(e)) {
    return { invalido: true, campo: 'engajamento', bruto: e };
  }
  const out = { likes: 0, comentarios: 0, reposts: 0 };
  for (const campo of ['likes', 'comentarios', 'reposts']) {
    const r = numeroBr(e[campo]);
    if (r.invalido) return { invalido: true, campo, bruto: e[campo] };
    out[campo] = r.valor;
  }
  return out;
}

function idDoPost(p, i) {
  return typeof p.post_id === 'string' && p.post_id ? p.post_id : `#${i + 1} (sem post_id)`;
}

function distribuicao(posts, campo) {
  const d = {};
  let semValor = 0;
  let naoTextual = 0;
  for (const p of posts) {
    const v = p[campo];
    if (v === null || v === undefined || v === '') semValor++;
    else if (typeof v !== 'string') naoTextual++;
    else d[v] = (d[v] || 0) + 1;
  }
  return { d, semValor, naoTextual };
}

function dominante(dist) {
  const pares = Object.entries(dist).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  if (pares.length === 0) return { valor: null, empate: [] };
  const topo = pares[0][1];
  const empate = pares.filter(([, n]) => n === topo).map(([v]) => v);
  return { valor: pares[0][0], empate: empate.length > 1 ? empate : [] };
}

function diasEntre(a, b) {
  return Math.round((Date.parse(b) - Date.parse(a)) / 86400000);
}

// ------------------------------------------------------------------- argumentos

const USO = 'Uso: node scripts/metricas.js <pasta raw/<slug>/<AAAA-MM-DD>> [--janela padrao|ampliada]';

const args = process.argv.slice(2);
let pasta = null;
let janelaForcada = null;

for (let i = 0; i < args.length; i += 1) {
  const a = args[i];
  if (a === '--janela') {
    janelaForcada = args[i + 1];
    if (!janelaForcada) morra('Faltou o valor depois de --janela ("padrao" ou "ampliada").');
    i += 1;
  } else if (a.startsWith('--janela=')) {
    janelaForcada = a.slice('--janela='.length);
  } else if (a.startsWith('--')) {
    morra(`Opção desconhecida: ${a}. ${USO}`);
  } else if (pasta === null) {
    pasta = a;
  } else {
    morra(`Argumento sobrando: ${a}. ${USO}`);
  }
}

if (!pasta) morra(USO);
if (janelaForcada !== null && janelaForcada !== 'padrao' && janelaForcada !== 'ampliada') {
  morra('--janela aceita só "padrao" ou "ampliada".');
}

if (!fs.existsSync(pasta) || !fs.statSync(pasta).isDirectory()) {
  morra(`Pasta não encontrada: ${pasta}`);
}

const arqPosts = path.join(pasta, 'posts.json');
const arqMeta = path.join(pasta, 'meta.json');

if (!fs.existsSync(arqPosts)) morra(`Sem posts.json em ${pasta} — a coleta não chegou a gravar o bruto.`);

const lidoPosts = leJson(arqPosts);
if (lidoPosts.erro) morra(lidoPosts.erro);
const posts = lidoPosts.valor;
if (!Array.isArray(posts)) {
  morra(`posts.json precisa ser um array de posts (veio ${posts === null ? 'null' : Array.isArray(posts) ? 'array' : typeof posts}). Regrave o bruto conforme references/schema-post.md.`);
}
for (let i = 0; i < posts.length; i += 1) {
  const p = posts[i];
  if (!p || typeof p !== 'object' || Array.isArray(p)) {
    morra(`posts.json: o item ${i + 1} não é um objeto de post (veio ${p === null ? 'null' : Array.isArray(p) ? 'array' : typeof p}). Regrave o bruto conforme references/schema-post.md.`);
  }
}

const avisos = [];

let meta = null;
if (fs.existsSync(arqMeta)) {
  const lidoMeta = leJson(arqMeta);
  if (lidoMeta.erro) morra(lidoMeta.erro);
  meta = lidoMeta.valor;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) {
    morra('meta.json precisa ser um objeto com slug, coletado_em, seguidores, janela_dias e status.');
  }
} else {
  avisos.push('Sem meta.json nesta coleta: sem seguidores, a taxa normalizada não existe e a empresa não entra na comparação entre empresas.');
}

// ------------------------------------------------------------------- contexto

const slug = (meta && meta.slug) || path.basename(path.dirname(pasta));
const coletadoEm = (meta && meta.coletado_em) || path.basename(pasta);
const status = (meta && meta.status) || (posts.length > 0 ? 'ok' : 'desconhecido');
const nota = (meta && meta.nota) || null;
const janelaDiasBruto = meta ? meta.janela_dias : undefined;
const janelaDiasValida = Number.isFinite(janelaDiasBruto) && janelaDiasBruto > 0;
const janelaDias = janelaDiasValida ? janelaDiasBruto : 7;
if (meta && !janelaDiasValida) {
  if (janelaDiasBruto === null || janelaDiasBruto === undefined) {
    avisos.push('meta.json sem janela_dias: assumi 7 (janela padrão).');
  } else {
    avisos.push(`meta.json com janela_dias inválido (${JSON.stringify(janelaDiasBruto)}): assumi 7 (janela padrão), senão cadência e "fora da janela" viriam sem sentido.`);
  }
}
const janela = janelaForcada || (janelaDias > 7 ? 'ampliada' : 'padrao');

const seguidoresLido = meta ? numeroBr(meta.seguidores) : { valor: 0 };
let seguidores = null;
if (meta) {
  if (seguidoresLido.invalido) {
    avisos.push(`seguidores_nao_numerico: meta.json tem "seguidores": ${JSON.stringify(meta.seguidores)} — não consigo ler como número, então taxa_normalizada é null.`);
  } else if (meta.seguidores !== null && meta.seguidores !== undefined) {
    seguidores = seguidoresLido.valor;
  }
}

if (status !== 'ok') {
  avisos.push(`status "${status}" — sem perfil por empresa; no _summary.md a linha é "sem dados: ${nota || 'sem nota no meta.json'}".`);
}
if (meta && Number.isFinite(meta.posts_coletados) && meta.posts_coletados !== posts.length) {
  avisos.push(`meta.json diz ${meta.posts_coletados} posts, posts.json tem ${posts.length}.`);
}
if (seguidores === null && status === 'ok' && !seguidoresLido.invalido) {
  avisos.push('Sem "seguidores" no meta.json: taxa_normalizada é null e esta empresa não se compara com as outras (só consigo likes brutos).');
}
if (seguidores === 0) {
  avisos.push('seguidores = 0 no meta.json: taxa impossível (divisão por zero), taxa_normalizada é null — releia o topo da página da empresa e regrave o número.');
} else if (seguidores !== null && seguidores < 0) {
  avisos.push(`seguidores negativo no meta.json (${seguidores}): taxa_normalizada é null — regrave o número do topo da página.`);
}

const n = posts.length;

// ---------------------------------------------------------------- resultado base

const resultado = {
  slug,
  pasta,
  coletado_em: coletadoEm,
  status,
  nota,
  janela,
  janela_dias: janelaDias,
  n_posts: n,
  n_posts_com_engajamento_legivel: n,
  periodo: null,
  seguidores,
  engajamento_medio: null,
  engajamento_total: 0,
  taxa_normalizada: null,
  posts_por_semana: null,
  formato_dominante: null,
  formatos: {},
  hooks: {},
  hook_cabe_no_corte_pct: null,
  destaque_semana: null,
  outliers: null,
  amostra_insuficiente: false,
  avisos,
  ok: false,
};

if (n === 0) {
  resultado.posts_por_semana = 0;
  resultado.engajamento_total = null;
  resultado.n_posts_com_engajamento_legivel = 0;
  avisos.push('posts.json vazio: nenhum post nesta coleta, então não há média, destaque nem taxa — trate como empresa sem posts na janela.');
  resultado.ok = false;
  process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
  // exit 1 só quando a coleta não serve para perfil (status ≠ ok); aviso informativo não derruba o exit
  process.exit(status === 'ok' ? 0 : 1);
}

// ------------------------------------------------------------------- período

const datas = posts.map((p) => p.data).filter((d) => typeof d === 'string' && d !== '').sort();
if (datas.length !== n) avisos.push(`${n - datas.length} post(s) sem campo "data" (ou com "data" que não é texto AAAA-MM-DD).`);
if (datas.length > 0) {
  resultado.periodo = { primeira: datas[0], ultima: datas[datas.length - 1] };
  const foraDaJanela = datas.filter((d) => diasEntre(d, coletadoEm) > janelaDias);
  if (foraDaJanela.length > 0) {
    avisos.push(`${foraDaJanela.length} post(s) com data anterior à janela de ${janelaDias} dias (o mais antigo: ${foraDaJanela[0]}).`);
  }
}

// -------------------------------------------------------------- engajamento

// Só entram na conta os posts cujo engajamento dá para ler. Os outros ficam
// registrados em aviso, com post_id e valor bruto, e somem das estatísticas.
const validos = []; // { p, total, interno }
posts.forEach((p, i) => {
  const e = analisaEngajamento(p);
  if (e.invalido) {
    avisos.push(`engajamento_nao_numerico: post ${idDoPost(p, i)} tem "${e.campo}": ${JSON.stringify(e.bruto)} — não consigo ler como número; o post sai da média, do destaque e dos outliers.`);
    return;
  }
  validos.push({
    p,
    // total (likes + comentários + reposts) = numerador da taxa normalizada de
    // references/benchmark-mercado.md
    total: e.likes + e.comentarios + e.reposts,
    // interno (likes + comentários, sem reposts) = reação dentro do feed da
    // própria empresa, que é o que destaque_semana e outlier medem
    interno: e.likes + e.comentarios,
  });
});

const nValidos = validos.length;
resultado.n_posts_com_engajamento_legivel = nValidos;
const internos = validos.map((x) => x.interno);

let media = null;
if (nValidos === 0) {
  resultado.engajamento_total = null;
  resultado.engajamento_medio = null;
  avisos.push('Nenhum post desta coleta tem engajamento legível: engajamento_medio, engajamento_total, taxa_normalizada e destaque/outlier ficam null. Regrave os contadores em número antes de escrever o perfil.');
} else {
  resultado.engajamento_total = validos.reduce((a, x) => a + x.total, 0);
  media = resultado.engajamento_total / nValidos;
  resultado.engajamento_medio = arredonda(media, 2);
  if (nValidos !== n) {
    avisos.push(`Média e destaque medidos sobre ${nValidos} de ${n} posts (o resto tem engajamento ilegível).`);
  }
}

// Fórmula única: references/benchmark-mercado.md — média POR POST de
// (likes + comentários + reposts) ÷ seguidores × 100. Não é a soma da janela.
if (media !== null && seguidores !== null && seguidores > 0) {
  resultado.taxa_normalizada = arredonda((media / seguidores) * 100, 3);
}

resultado.posts_por_semana = arredonda((n / janelaDias) * 7, 2);

// ---------------------------------------------------------- formato e hooks

const fmt = distribuicao(posts, 'formato');
resultado.formatos = fmt.d;
const dom = dominante(fmt.d);
resultado.formato_dominante = dom.valor;
if (dom.empate.length > 1) avisos.push(`Empate no formato dominante entre ${dom.empate.join(', ')} — cite os dois em vez de escolher um.`);
if (fmt.semValor > 0) avisos.push(`${fmt.semValor} post(s) sem "formato".`);
if (fmt.naoTextual > 0) avisos.push(`${fmt.naoTextual} post(s) com "formato" que não é texto — fora da distribuição; os valores válidos estão em references/taxonomias.md.`);

const hk = distribuicao(posts, 'hook_categoria');
resultado.hooks = hk.d;
if (hk.semValor > 0) avisos.push(`${hk.semValor} post(s) sem "hook_categoria" (não entram na distribuição de hooks).`);
if (hk.naoTextual > 0) avisos.push(`${hk.naoTextual} post(s) com "hook_categoria" que não é texto — fora da distribuição; os valores válidos estão em references/taxonomias.md.`);

const comCorte = posts.filter((p) => typeof p.hook_cabe_no_corte === 'boolean');
if (comCorte.length > 0) {
  const cabem = comCorte.filter((p) => p.hook_cabe_no_corte === true).length;
  resultado.hook_cabe_no_corte_pct = arredonda((cabem / comCorte.length) * 100, 1);
  if (comCorte.length !== n) avisos.push(`hook_cabe_no_corte_pct medido sobre ${comCorte.length} de ${n} posts (o resto não tem o campo).`);
} else {
  avisos.push('Nenhum post tem "hook_cabe_no_corte": a % de hooks que cabem no corte não existe nesta coleta.');
}

// --------------------------------------------------- destaque / outliers

function resumoPost(x) {
  const p = x.p;
  return {
    post_id: p.post_id || null,
    url: p.url || null,
    data: p.data || null,
    formato: p.formato || null,
    hook: p.hook || null,
    hook_categoria: p.hook_categoria || null,
    engajamento_interno: x.interno,
    engajamento_total: x.total,
  };
}

function calculaDestaque() {
  if (nValidos === 0) return null; // já avisado: sem engajamento legível
  const maxValor = Math.max(...internos);
  if (maxValor === 0) {
    avisos.push('Todos os posts da janela têm 0 like e 0 comentário: não há destaque da semana a apontar.');
    return null;
  }
  // empate: fica o mais recente
  const candidatos = validos
    .filter((x) => x.interno === maxValor)
    .sort((a, b) => String(b.p.data || '').localeCompare(String(a.p.data || '')));
  if (candidatos.length > 1) avisos.push(`${candidatos.length} posts empatados em ${maxValor} (likes + comentários); escolhi o mais recente como destaque.`);
  return resumoPost(candidatos[0]);
}

if (janela === 'ampliada') {
  if (nValidos > 5) {
    const mediaInterna = internos.reduce((a, b) => a + b, 0) / nValidos;
    const variancia = internos.reduce((a, v) => a + Math.pow(v - mediaInterna, 2), 0) / nValidos; // populacional
    const desvio = Math.sqrt(variancia);
    const limiar = mediaInterna + 1.5 * desvio;
    const lista = validos
      .filter((x) => x.interno > limiar)
      .sort((a, b) => b.interno - a.interno)
      .map((x) => resumoPost(x));
    resultado.outliers = {
      criterio: 'likes + comentários acima de média + 1,5×desvio-padrão (populacional) da própria empresa',
      media: arredonda(mediaInterna, 2),
      desvio_padrao: arredonda(desvio, 2),
      limiar: arredonda(limiar, 2),
      posts: lista,
    };
    if (lista.length === 0) avisos.push('Nenhum post passou do limiar de outlier: a série é homogênea — diga isso, não force um destaque.');
  } else {
    resultado.amostra_insuficiente = true;
    resultado.destaque_semana = calculaDestaque();
    const detalhe = nValidos === n ? `${n} post(s)` : `${nValidos} post(s) com engajamento legível (de ${n})`;
    avisos.push(`Amostra insuficiente para outlier: ${detalhe} na janela ampliada (precisa de mais de 5). Sem média nem desvio; use o destaque simples.`);
  }
} else {
  resultado.destaque_semana = calculaDestaque();
  if (janelaDias > 7) avisos.push(`janela_dias ${janelaDias} com leitura padrão forçada por --janela padrao.`);
}

// checagem: o campo destaque_semana gravado no posts.json bate com o calculado?
const marcados = posts.filter((p) => p.destaque_semana === true);
if (janela === 'padrao' && resultado.destaque_semana) {
  if (marcados.length > 1) {
    avisos.push(`${marcados.length} posts marcados com "destaque_semana": true no posts.json — só pode haver um.`);
  } else if (marcados.length === 1 && marcados[0].post_id !== resultado.destaque_semana.post_id) {
    avisos.push(`"destaque_semana": true está no post ${marcados[0].post_id}, mas o maior engajamento é o ${resultado.destaque_semana.post_id}.`);
  }
}
if (janela === 'ampliada' && marcados.length > 0) {
  avisos.push('Janela ampliada com "destaque_semana" gravado no posts.json: o campo dessa janela é "outlier".');
}

// ------------------------------------------------------------- screenshots

// caminho de imagem: tem barra de pasta ou termina em extensão de imagem
function pareceCaminho(s) {
  return s.includes('/') || s.includes('\\') || /\.(png|jpe?g|webp|gif|avif|bmp)$/i.test(s.trim());
}

const semArquivo = [];
const suspeitos = [];
const comProsa = [];
const naoTextuais = [];
for (const p of posts) {
  if (!p.screenshot) continue;
  if (typeof p.screenshot !== 'string') {
    naoTextuais.push(JSON.stringify(p.screenshot));
    continue;
  }
  if (!pareceCaminho(p.screenshot)) {
    comProsa.push(p.screenshot);
    continue;
  }
  const alvo = path.isAbsolute(p.screenshot) ? p.screenshot : path.join(pasta, p.screenshot);
  if (!fs.existsSync(alvo)) semArquivo.push(p.screenshot);
  else if (!fs.statSync(alvo).isFile()) semArquivo.push(p.screenshot);
  else if (fs.statSync(alvo).size < 1024) suspeitos.push(p.screenshot);
}
if (semArquivo.length > 0) avisos.push(`${semArquivo.length} campo(s) "screenshot" apontam para arquivo que não existe (ex.: ${semArquivo[0]}) — use screenshot: null e descreva em descricao_visual.`);
if (suspeitos.length > 0) avisos.push(`${suspeitos.length} screenshot(s) com menos de 1 KB (ex.: ${suspeitos[0]}) — cheira a placeholder; captura falsa é proibida, use screenshot: null.`);
if (comProsa.length > 0) avisos.push(`${comProsa.length} campo(s) screenshot com prosa em vez de caminho (ex.: ${JSON.stringify(comProsa[0])}) — pela regra do schema v2, use null + descricao_visual.`);
if (naoTextuais.length > 0) avisos.push(`${naoTextuais.length} campo(s) screenshot que não são texto (ex.: ${naoTextuais[0]}) — use um caminho de arquivo ou null + descricao_visual.`);

// ------------------------------------------------------------------- saída

resultado.ok = avisos.length === 0;
process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
process.exit(status === 'ok' ? 0 : 1);
