// coleta.js — o que uma pasta de coleta diz, num lugar só (Node >= 18, sem dependência).
// Uma coleta é DADOS/catalog/raw/<rede>/<conta>/<AAAA-MM-DD>/, com posts.json e meta.json. Daqui saem o
// status, se ela terminou e se ela vira catálogo. O indice.js da profills-radar usa isto para a data do
// último catálogo de cada empresa, e o banco.js para a coluna catalogo da tabela coleta.
// Carregado com require(); não tem linha de comando.

const fs = require('fs');
const path = require('path');

// A rede é o primeiro nível de catalog/raw/. A conta é o slug no LinkedIn e o handle no Instagram.
const REDES = ['linkedin', 'instagram'];
const STATUS_SEM_POSTS = new Set(['sem_posts', 'pagina_nao_gerenciada']);

function dataValida(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function lerJson(arquivo) {
  if (!fs.existsSync(arquivo)) return { ausente: true };
  try {
    return { valor: JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '')) };
  } catch (e) {
    return { erro: e.message };
  }
}

// `concluida` é true ou false pelo meta.json (sem o campo, a garimpo não chegou ao fim), e null quando
// não há meta.json legível: a coleta de 2026-07 é de antes dele. `catalogo` é a regra do catálogo:
// coleta com status ok, sem erro, que não parou no meio. A coleta de 2026-07 não diz se terminou e vale.
function lerColeta(pasta) {
  const meta = lerJson(path.join(pasta, 'meta.json'));
  const posts = lerJson(path.join(pasta, 'posts.json'));
  const c = { data: path.basename(pasta), pasta, meta: null, posts: null, status: null, concluida: null, erro: null, catalogo: false };
  if (meta.erro) c.erro = `meta.json ilegível: ${meta.erro}`;
  else if (meta.valor !== undefined) {
    c.meta = meta.valor && typeof meta.valor === 'object' ? meta.valor : {};
    c.status = typeof c.meta.status === 'string' ? c.meta.status : null;
    c.concluida = c.meta.concluida === true;
  }
  if (!c.erro) {
    if (posts.erro) c.erro = `posts.json ilegível: ${posts.erro}`;
    else if (posts.valor !== undefined && !Array.isArray(posts.valor)) c.erro = 'posts.json não é uma lista de posts';
    else if (Array.isArray(posts.valor)) c.posts = posts.valor.filter((p) => p && typeof p === 'object');
    else if (STATUS_SEM_POSTS.has(c.status)) c.posts = [];
    else c.erro = 'a coleta não gravou posts.json';
  }
  if (!c.erro && meta.ausente) c.status = 'ok';
  c.catalogo = !c.erro && c.status === 'ok' && c.concluida !== false;
  return c;
}

// As pastas de data de uma conta, da mais antiga para a mais nova. Nome que não é data real fica de fora.
function datasDaConta(pastaConta) {
  let entradas;
  try {
    entradas = fs.readdirSync(pastaConta, { withFileTypes: true });
  } catch (e) {
    return [];
  }
  return entradas
    .filter((d) => d.isDirectory() && dataValida(d.name))
    .map((d) => d.name)
    .sort();
}

// A data da coleta mais recente da conta que vira catálogo, ou null.
function ultimoCatalogo(pastaConta) {
  const datas = datasDaConta(pastaConta);
  for (let i = datas.length - 1; i >= 0; i--) {
    if (lerColeta(path.join(pastaConta, datas[i])).catalogo) return datas[i];
  }
  return null;
}

module.exports = { REDES, dataValida, lerColeta, datasDaConta, ultimoCatalogo };
