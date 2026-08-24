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
 * Exit: 0 coleta utilizável (leia `avisos` mesmo assim) · 1 status ≠ ok (sem perfil) · 2 erro de uso/arquivo.
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

// engajamento total do post (likes + comentários + reposts) — numerador da
// taxa normalizada de references/benchmark-mercado.md
function engTotal(p) {
  const e = (p && p.engajamento) || {};
  return (e.likes || 0) + (e.comentarios || 0) + (e.reposts || 0);
}

// reação dentro do feed da própria empresa (likes + comentários, sem reposts) —
// é o que destaque_semana e outlier medem, conforme references/schema-post.md
function engInterno(p) {
  const e = (p && p.engajamento) || {};
  return (e.likes || 0) + (e.comentarios || 0);
}

function distribuicao(posts, campo) {
  const d = {};
  let semValor = 0;
  for (const p of posts) {
    const v = p[campo];
    if (v === null || v === undefined || v === '') semValor++;
    else d[v] = (d[v] || 0) + 1;
  }
  return { d, semValor };
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

const args = process.argv.slice(2);
const pasta = args.find((a) => !a.startsWith('--'));
if (!pasta) morra('Uso: node scripts/metricas.js <pasta raw/<slug>/<AAAA-MM-DD>> [--janela padrao|ampliada]');

const idxJanela = args.findIndex((a) => a === '--janela' || a.startsWith('--janela='));
let janelaForcada = null;
if (idxJanela !== -1) {
  const a = args[idxJanela];
  janelaForcada = a.includes('=') ? a.split('=')[1] : args[idxJanela + 1];
  if (janelaForcada !== 'padrao' && janelaForcada !== 'ampliada') {
    morra('--janela aceita só "padrao" ou "ampliada".');
  }
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
if (!Array.isArray(posts)) morra('posts.json precisa ser um array de posts.');

const avisos = [];

let meta = null;
if (fs.existsSync(arqMeta)) {
  const lidoMeta = leJson(arqMeta);
  if (lidoMeta.erro) morra(lidoMeta.erro);
  meta = lidoMeta.valor;
} else {
  avisos.push('Sem meta.json nesta coleta: sem seguidores, a taxa normalizada não existe e a empresa não entra na comparação entre empresas.');
}

// ------------------------------------------------------------------- contexto

const slug = (meta && meta.slug) || path.basename(path.dirname(pasta));
const coletadoEm = (meta && meta.coletado_em) || path.basename(pasta);
const status = (meta && meta.status) || (posts.length > 0 ? 'ok' : 'desconhecido');
const nota = (meta && meta.nota) || null;
const janelaDias = meta && Number.isFinite(meta.janela_dias) ? meta.janela_dias : 7;
if (!meta || !Number.isFinite(meta.janela_dias)) {
  if (meta) avisos.push('meta.json sem janela_dias: assumi 7 (janela padrão).');
}
const janela = janelaForcada || (janelaDias > 7 ? 'ampliada' : 'padrao');
const seguidores = meta && Number.isFinite(meta.seguidores) ? meta.seguidores : null;

if (status !== 'ok') {
  avisos.push(`status "${status}" — sem perfil por empresa; no _summary.md a linha é "sem dados: ${nota || 'sem nota no meta.json'}".`);
}
if (meta && Number.isFinite(meta.posts_coletados) && meta.posts_coletados !== posts.length) {
  avisos.push(`meta.json diz ${meta.posts_coletados} posts, posts.json tem ${posts.length}.`);
}
if (seguidores === null && status === 'ok') {
  avisos.push('Sem "seguidores" no meta.json: taxa_normalizada é null e esta empresa não se compara com as outras (só consigo likes brutos).');
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
  resultado.ok = avisos.length === 0;
  process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
  // exit 1 só quando a coleta não serve para perfil (status ≠ ok); aviso informativo não derruba o exit
  process.exit(status === 'ok' ? 0 : 1);
}

// ------------------------------------------------------------------- período

const datas = posts.map((p) => p.data).filter(Boolean).sort();
if (datas.length !== n) avisos.push(`${n - datas.length} post(s) sem campo "data".`);
if (datas.length > 0) {
  resultado.periodo = { primeira: datas[0], ultima: datas[datas.length - 1] };
  const foraDaJanela = datas.filter((d) => diasEntre(d, coletadoEm) > janelaDias);
  if (foraDaJanela.length > 0) {
    avisos.push(`${foraDaJanela.length} post(s) com data anterior à janela de ${janelaDias} dias (o mais antigo: ${foraDaJanela[0]}).`);
  }
}

// -------------------------------------------------------------- engajamento

const totais = posts.map(engTotal);
const internos = posts.map(engInterno);
resultado.engajamento_total = totais.reduce((a, b) => a + b, 0);
const media = resultado.engajamento_total / n;
resultado.engajamento_medio = arredonda(media, 2);

// Fórmula única: references/benchmark-mercado.md — média POR POST de
// (likes + comentários + reposts) ÷ seguidores × 100. Não é a soma da janela.
if (seguidores) {
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

const hk = distribuicao(posts, 'hook_categoria');
resultado.hooks = hk.d;
if (hk.semValor > 0) avisos.push(`${hk.semValor} post(s) sem "hook_categoria" (não entram na distribuição de hooks).`);

const comCorte = posts.filter((p) => typeof p.hook_cabe_no_corte === 'boolean');
if (comCorte.length > 0) {
  const cabem = comCorte.filter((p) => p.hook_cabe_no_corte === true).length;
  resultado.hook_cabe_no_corte_pct = arredonda((cabem / comCorte.length) * 100, 1);
  if (comCorte.length !== n) avisos.push(`hook_cabe_no_corte_pct medido sobre ${comCorte.length} de ${n} posts (o resto não tem o campo).`);
} else {
  avisos.push('Nenhum post tem "hook_cabe_no_corte": a % de hooks que cabem no corte não existe nesta coleta.');
}

// --------------------------------------------------- destaque / outliers

function resumoPost(p, valor) {
  return {
    post_id: p.post_id || null,
    url: p.url || null,
    data: p.data || null,
    formato: p.formato || null,
    hook: p.hook || null,
    hook_categoria: p.hook_categoria || null,
    engajamento_interno: valor,
    engajamento_total: engTotal(p),
  };
}

function calculaDestaque() {
  const maxValor = Math.max(...internos);
  if (maxValor === 0) {
    avisos.push('Todos os posts da janela têm 0 like e 0 comentário: não há destaque da semana a apontar.');
    return null;
  }
  // empate: fica o mais recente
  const candidatos = posts
    .map((p, i) => ({ p, v: internos[i] }))
    .filter((x) => x.v === maxValor)
    .sort((a, b) => String(b.p.data || '').localeCompare(String(a.p.data || '')));
  if (candidatos.length > 1) avisos.push(`${candidatos.length} posts empatados em ${maxValor} (likes + comentários); escolhi o mais recente como destaque.`);
  return resumoPost(candidatos[0].p, maxValor);
}

if (janela === 'ampliada') {
  if (n > 5) {
    const mediaInterna = internos.reduce((a, b) => a + b, 0) / n;
    const variancia = internos.reduce((a, v) => a + Math.pow(v - mediaInterna, 2), 0) / n; // populacional
    const desvio = Math.sqrt(variancia);
    const limiar = mediaInterna + 1.5 * desvio;
    const lista = posts
      .map((p, i) => ({ p, v: internos[i] }))
      .filter((x) => x.v > limiar)
      .sort((a, b) => b.v - a.v)
      .map((x) => resumoPost(x.p, x.v));
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
    avisos.push(`Amostra insuficiente para outlier: ${n} post(s) na janela ampliada (precisa de mais de 5). Sem média nem desvio; use o destaque simples.`);
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

const semArquivo = [];
const suspeitos = [];
for (const p of posts) {
  if (!p.screenshot) continue;
  const alvo = path.isAbsolute(p.screenshot) ? p.screenshot : path.join(pasta, p.screenshot);
  if (!fs.existsSync(alvo)) semArquivo.push(p.screenshot);
  else if (fs.statSync(alvo).size < 1024) suspeitos.push(p.screenshot);
}
if (semArquivo.length > 0) avisos.push(`${semArquivo.length} campo(s) "screenshot" apontam para arquivo que não existe (ex.: ${semArquivo[0]}) — use screenshot: null e descreva em descricao_visual.`);
if (suspeitos.length > 0) avisos.push(`${suspeitos.length} screenshot(s) com menos de 1 KB (ex.: ${suspeitos[0]}) — cheira a placeholder; captura falsa é proibida, use screenshot: null.`);

// ------------------------------------------------------------------- saída

resultado.ok = avisos.length === 0;
process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
process.exit(status === 'ok' ? 0 : 1);
