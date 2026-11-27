#!/usr/bin/env node
// boletim.js — a conta do boletim da profills-boletim (Node >= 18, sem dependência).
// Lê o índice (pelo indice.js da profills-radar), a seleção da rodada e, por empresa do índice,
// a coleta mais recente e a anterior em catalog/raw/<slug>/<data>/. Devolve, por empresa, o balde
// de cobertura, os posts novos e a cadência das duas coletas (posts_por_semana do metricas.js da
// profills-garimpo). Só lê: não grava nada, e rodar duas vezes no mesmo estado dá a mesma saída.
// Uso:     node scripts/boletim.js <DADOS> [--hoje AAAA-MM-DD]
// Exemplo: node scripts/boletim.js "$HOME/Profills LinkedIn" --hoje 2026-08-24
//          → {"acao":"boletim","rodada":{"data":"2026-08-24","faltam_coletar":[]},"empresas":[...],"cobertura":{...},"ok":true}
//          rodada.situacao diz o que fazer com a seleção: de_hoje, anterior_por_terminar, anterior_sem_boletim, anterior_com_boletim.
// Saída: JSON em stdout. Exit 0 = ok · 1 = índice, seleção ou coleta com data depois de hoje impedem o boletim (campo problemas) · 2 = erro de uso.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const INDICE = path.join(__dirname, '..', '..', 'profills-radar', 'scripts', 'indice.js');
const METRICAS = path.join(__dirname, '..', '..', 'profills-garimpo', 'scripts', 'metricas.js');

// Cada empresa do índice cai em exatamente um balde, nesta ordem de precedência.
const BALDES = ['com_novidade', 'sem_novidade', 'indisponivel', 'sem_linkedin', 'fora_desta_rodada'];
// Status de meta.json que contam como retrato válido da página: servem de coleta anterior para comparar.
// sem_posts é silêncio, que é dado; pagina_nao_gerenciada é página sem aba de publicações.
const STATUS_SEM_POSTS = new Set(['sem_posts', 'pagina_nao_gerenciada']);
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

function morrer(mensagem) {
  process.stderr.write(mensagem + '\n');
  process.exit(2);
}

function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dataValida(s) {
  if (!RE_DATA.test(s)) return false;
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

function lerIndice(refs, hoje) {
  const r = spawnSync(process.execPath, [INDICE, refs, '--hoje', hoje], { encoding: 'utf8' });
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    return null;
  }
}

function lerSelecao(arquivo) {
  if (!fs.existsSync(arquivo)) return null;
  const texto = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '');
  const cabecalho = texto.match(/^#\s+Seleção ativa\s+[—–-]\s+(\d{4}-\d{2}-\d{2})\s*$/m);
  const slugs = [];
  for (const m of texto.matchAll(/^\s*-\s+\[[^\]]+\]\([^)]*\)\s+[—–-]\s+`([^`]+)`/gm)) slugs.push(m[1]);
  return { data: cabecalho && dataValida(cabecalho[1]) ? cabecalho[1] : null, slugs };
}

// Uma coleta é uma pasta de data com posts.json e meta.json. `comparavel` diz se ela retrata a
// página no dia (serve de anterior); `erro` diz por que não dá para ler.
function lerColeta(raiz, slug, data) {
  const pasta = path.join(raiz, slug, data);
  const meta = lerJson(path.join(pasta, 'meta.json'));
  const posts = lerJson(path.join(pasta, 'posts.json'));
  const coleta = { data, pasta, status: null, nota: null, janela_dias: null, posts: null, erro: null };
  if (meta.erro) coleta.erro = `meta.json ilegível: ${meta.erro}`;
  else if (meta.valor) {
    coleta.status = typeof meta.valor.status === 'string' ? meta.valor.status : null;
    coleta.nota = meta.valor.nota || null;
    coleta.janela_dias = meta.valor.janela_dias ?? null;
  }
  if (!coleta.erro) {
    if (posts.erro) coleta.erro = `posts.json ilegível: ${posts.erro}`;
    else if (posts.valor !== undefined && !Array.isArray(posts.valor)) coleta.erro = 'posts.json não é uma lista de posts';
    else if (Array.isArray(posts.valor)) coleta.posts = posts.valor.filter((p) => p && typeof p === 'object');
    else if (STATUS_SEM_POSTS.has(coleta.status)) coleta.posts = [];
    else if (coleta.status === 'ok' || !coleta.status) coleta.erro = 'a coleta não gravou posts.json';
  }
  // Coleta antiga (2026-07) não tem meta.json: posts.json legível vale como status ok.
  if (!coleta.erro && !coleta.status) coleta.status = 'ok';
  coleta.comparavel = !coleta.erro && (coleta.status === 'ok' || STATUS_SEM_POSTS.has(coleta.status));
  return coleta;
}

function todasAsDatas(raiz, slug) {
  const pasta = path.join(raiz, slug);
  if (!fs.existsSync(pasta)) return [];
  return fs
    .readdirSync(pasta, { withFileTypes: true })
    .filter((d) => d.isDirectory() && dataValida(d.name))
    .map((d) => d.name)
    .sort();
}

const datasDeColeta = (raiz, slug, hoje) => todasAsDatas(raiz, slug).filter((d) => d <= hoje);

function cadenciaDe(coleta) {
  if (STATUS_SEM_POSTS.has(coleta.status)) return { data: coleta.data, n_posts: 0, posts_por_semana: 0, janela_dias: coleta.janela_dias, destaque: null };
  const r = spawnSync(process.execPath, [METRICAS, coleta.pasta], { encoding: 'utf8' });
  let m = null;
  try {
    m = JSON.parse(r.stdout);
  } catch (e) {
    m = null;
  }
  return {
    data: coleta.data,
    n_posts: m ? m.n_posts ?? null : null,
    posts_por_semana: m ? m.posts_por_semana ?? null : null,
    janela_dias: m ? m.janela_dias ?? coleta.janela_dias : coleta.janela_dias,
    destaque: m && m.destaque_semana ? m.destaque_semana.post_id || m.destaque_semana.url || null : null,
  };
}

const normalizarUrl = (u) => (typeof u === 'string' && u.trim() ? u.trim().split(/[?#]/)[0].replace(/\/+$/, '') : null);
const idDe = (p) => (typeof p.post_id === 'string' && p.post_id.trim() ? p.post_id.trim() : null);

function postNovo(p, destaque) {
  const idioma = typeof p.idioma === 'string' && p.idioma.trim() ? p.idioma.trim().toLowerCase() : null;
  return {
    post_id: idDe(p),
    data: p.data || null,
    url: p.url || null,
    formato: p.formato || null,
    hook: p.hook || null,
    hook_categoria: p.hook_categoria || null,
    angulo: p.angulo || null,
    idioma,
    estrangeiro: idioma !== null && idioma !== 'pt',
    resumo_pt: p.resumo_pt || null,
    engajamento: p.engajamento ?? null,
    destaque_da_coleta: destaque !== null && (destaque === idDe(p) || destaque === p.url),
  };
}

// O mesmo post pode aparecer duas vezes na mesma coleta (rolagem do feed): vale a primeira vez.
function semRepetidos(coleta, avisos, nome) {
  const ids = new Set();
  const urls = new Set();
  return coleta.posts.filter((p) => {
    const id = idDe(p);
    const url = normalizarUrl(p.url);
    if ((id && ids.has(id)) || (url && urls.has(url))) {
      avisos.push({ tipo: 'post_repetido', empresa: nome, detalhe: `o post ${id || url} aparece mais de uma vez na coleta ${coleta.data}: conta uma vez só` });
      return false;
    }
    if (id) ids.add(id);
    if (url) urls.add(url);
    return true;
  });
}

function postsNovos(atual, anterior, avisos, nome) {
  const ids = new Set();
  const urls = new Set();
  for (const p of anterior ? anterior.posts : []) {
    if (idDe(p)) ids.add(idDe(p));
    if (normalizarUrl(p.url)) urls.add(normalizarUrl(p.url));
  }
  return atual.posts.filter((p) => {
    const id = idDe(p);
    const url = normalizarUrl(p.url);
    if (!id && !url) avisos.push({ tipo: 'post_sem_chave', empresa: nome, detalhe: `um post da coleta ${atual.data} não tem post_id nem url: entra como novo e não tem link` });
    return !(id && ids.has(id)) && !(url && urls.has(url));
  });
}

function examinarEmpresa(e, rodada, raiz, hoje, avisos) {
  const base = { nome: e.nome, slug: e.slug, prioridade: e.prioridade || 'a definir' };
  if (e.linkedin === false) return { ...base, cobertura: 'sem_linkedin', motivo: null };
  if (!rodada.slugs.includes(e.slug)) return { ...base, cobertura: 'fora_desta_rodada', motivo: null, ultimo_catalogo: e.catalogo || null };

  // A regra da profills-garimpo: coletada nesta rodada é quem tem meta.json numa pasta com data entre a do
  // cabeçalho e hoje. Pasta da rodada sem meta.json é coleta interrompida e a garimpo a refaz.
  const datas = datasDeColeta(raiz, e.slug, hoje);
  const daRodada = datas.filter((d) => d >= rodada.data);
  const completas = daRodada.filter((d) => fs.existsSync(path.join(raiz, e.slug, d, 'meta.json')));
  const ultima = completas[completas.length - 1];
  if (!ultima) {
    const anteriores = datas.filter((d) => d < rodada.data);
    let nota = anteriores.length ? `última coleta em ${anteriores[anteriores.length - 1]}, antes desta rodada` : 'nunca coletada';
    if (daRodada.length) nota = `coleta interrompida em ${daRodada[daRodada.length - 1]}: a pasta não tem meta.json`;
    return { ...base, cobertura: 'indisponivel', motivo: 'nao_coletada_nesta_rodada', nota, coleta_atual: null };
  }
  const atual = lerColeta(raiz, e.slug, ultima);
  if (atual.erro) return { ...base, cobertura: 'indisponivel', motivo: 'coleta_com_erro', nota: atual.erro, coleta_atual: { data: atual.data } };
  if (atual.status !== 'ok' && !STATUS_SEM_POSTS.has(atual.status)) {
    return { ...base, cobertura: 'indisponivel', motivo: atual.status, nota: atual.nota, coleta_atual: { data: atual.data, status: atual.status } };
  }

  atual.posts = semRepetidos(atual, avisos, e.nome);
  // Pasta da rodada sem meta.json é coleta interrompida: posts parciais não servem de base de comparação.
  let anterior = null;
  const antes = datas.filter((d) => d < ultima && (d < rodada.data || completas.includes(d)));
  for (let i = antes.length - 1; i >= 0 && !anterior; i--) {
    const c = lerColeta(raiz, e.slug, antes[i]);
    if (c.comparavel) anterior = c;
  }
  const cadAtual = cadenciaDe(atual);
  const cadAnterior = anterior ? cadenciaDe(anterior) : null;
  const novos = postsNovos(atual, anterior, avisos, e.nome)
    .map((p) => postNovo(p, cadAtual.destaque))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  for (const p of novos) {
    if (p.estrangeiro && !p.resumo_pt) avisos.push({ tipo: 'resumo_pt_ausente', empresa: e.nome, detalhe: `post de ${p.data} em ${p.idioma} sem resumo_pt: leia o texto em ${atual.pasta}/posts.json` });
  }

  let cadencia = null;
  if (cadAnterior) {
    const numeros = typeof cadAtual.posts_por_semana === 'number' && typeof cadAnterior.posts_por_semana === 'number';
    cadencia = {
      anterior: { data: cadAnterior.data, posts_por_semana: cadAnterior.posts_por_semana, n_posts: cadAnterior.n_posts },
      atual: { data: cadAtual.data, posts_por_semana: cadAtual.posts_por_semana, n_posts: cadAtual.n_posts },
      diferenca: numeros ? Math.round((cadAtual.posts_por_semana - cadAnterior.posts_por_semana) * 100) / 100 : null,
      mesma_janela: cadAtual.janela_dias === cadAnterior.janela_dias,
    };
    if (!cadencia.mesma_janela) avisos.push({ tipo: 'janelas_diferentes', empresa: e.nome, detalhe: `a coleta ${cadAnterior.data} usou janela de ${cadAnterior.janela_dias} dias e a ${cadAtual.data} de ${cadAtual.janela_dias}: a cadência não se compara` });
  }

  return {
    ...base,
    cobertura: novos.length ? 'com_novidade' : 'sem_novidade',
    motivo: atual.status === 'ok' ? null : atual.status,
    nota: atual.nota,
    coleta_atual: { data: atual.data, status: atual.status, pasta: atual.pasta, n_posts: atual.posts.length },
    coleta_anterior: anterior ? { data: anterior.data, status: anterior.status, n_posts: anterior.posts.length } : null,
    primeira_coleta: !anterior,
    n_novos: novos.length,
    novos,
    cadencia,
  };
}

// Boletins gravados desde o dia da rodada até hoje: um deles é o boletim desta rodada.
function boletinsEntre(dados, de, ate) {
  const pasta = path.join(dados, 'boletins');
  if (!fs.existsSync(pasta)) return [];
  return fs
    .readdirSync(pasta)
    .map((n) => n.replace(/\.md$/, ''))
    .filter((d) => dataValida(d) && d >= de && d <= ate)
    .sort()
    .map((d) => path.join('boletins', `${d}.md`));
}

function principal(argv) {
  const args = argv.slice(2);
  let dados = null;
  let hoje = hojeISO();
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--hoje') {
      hoje = args[++i];
      if (!hoje || !dataValida(hoje)) morrer('Uso: --hoje precisa de uma data AAAA-MM-DD.');
    } else if (args[i].startsWith('--')) morrer(`Opção desconhecida: ${args[i]}. Uso: node scripts/boletim.js <DADOS> [--hoje AAAA-MM-DD]`);
    else if (dados) morrer('Passe uma pasta de dados só. Uso: node scripts/boletim.js <DADOS> [--hoje AAAA-MM-DD]');
    else dados = path.resolve(args[i]);
  }
  if (!dados) morrer('Uso: node scripts/boletim.js <DADOS> [--hoje AAAA-MM-DD]');
  if (!fs.existsSync(dados) || !fs.statSync(dados).isDirectory()) morrer(`A pasta de dados ${dados} não existe.`);

  const saida = {
    acao: 'boletim',
    dados,
    hoje,
    arquivo_boletim: path.join('boletins', `${hoje}.md`),
    boletim_do_dia_existe: fs.existsSync(path.join(dados, 'boletins', `${hoje}.md`)),
    voz_existe: fs.existsSync(path.join(dados, 'voz.md')),
    rodada: null,
    empresas: [],
    cobertura: Object.fromEntries(BALDES.map((b) => [b, []])),
    totais: { empresas: 0, posts_novos: 0 },
    avisos: [],
    problemas: [],
    ok: false,
  };
  const terminar = () => {
    saida.ok = saida.problemas.length === 0;
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
    process.exit(saida.ok ? 0 : 1);
  };

  const indice = lerIndice(path.join(dados, 'refs'), hoje);
  if (!indice) {
    saida.problemas.push({ tipo: 'indice_ilegivel', detalhe: 'o indice.js da profills-radar não respondeu JSON' });
    return terminar();
  }
  if (!indice.indice_existe || indice.n_empresas === 0) {
    saida.problemas.push({ tipo: 'indice_ausente', detalhe: 'a lista de empresas não existe ou está vazia: a profills-radar cria a lista' });
    return terminar();
  }
  if (!indice.ok) {
    saida.problemas.push({ tipo: 'indice_com_problemas', detalhe: 'o indice.js reprovou o INDEX.md: a profills-radar corrige antes', problemas_indice: indice.problemas });
    return terminar();
  }

  const selecao = lerSelecao(path.join(dados, 'selection.md'));
  if (!selecao || selecao.slugs.length === 0) {
    saida.problemas.push({ tipo: 'selecao_ausente', detalhe: 'selection.md não existe ou não tem empresa: a profills-radar monta a rodada' });
    return terminar();
  }
  if (!selecao.data) {
    saida.problemas.push({ tipo: 'selecao_sem_data', detalhe: 'o cabeçalho do selection.md não traz "# Seleção ativa — AAAA-MM-DD": a profills-radar reescreve a seleção' });
    return terminar();
  }
  if (selecao.data > hoje) {
    saida.problemas.push({ tipo: 'selecao_no_futuro', detalhe: `o cabeçalho do selection.md traz ${selecao.data}, depois de hoje (${hoje}): o relógio da máquina ou uma edição à mão; a profills-radar remonta a rodada com a data de hoje` });
    return terminar();
  }
  const slugsDoIndice = new Set(indice.empresas.map((e) => e.slug));
  for (const slug of selecao.slugs) {
    if (!slugsDoIndice.has(slug)) saida.avisos.push({ tipo: 'selecao_fora_do_indice', detalhe: `\`${slug}\` está na seleção e não está no índice: fica fora do boletim` });
  }

  const raiz = path.join(dados, 'catalog', 'raw');
  // Pasta com data depois de hoje fica fora da conta, mas a garimpo a contaria como coletada: sem esta
  // parada, a empresa iria para a garimpo, que a daria por feita, e o boletim a mostraria faltando de novo.
  for (const e of indice.empresas) {
    if (e.linkedin === false || !selecao.slugs.includes(e.slug)) continue;
    for (const data of todasAsDatas(raiz, e.slug).filter((d) => d > hoje)) {
      saida.problemas.push({ tipo: 'coleta_no_futuro', empresa: e.nome, data, detalhe: `a coleta de ${e.nome} está numa pasta de ${data}, depois de hoje (${hoje}): o relógio ou o fuso do computador estava adiantado quando ela foi gravada` });
    }
  }
  if (saida.problemas.length) return terminar();

  for (const e of indice.empresas) {
    const r = examinarEmpresa(e, selecao, raiz, hoje, saida.avisos);
    saida.empresas.push(r);
    saida.cobertura[r.cobertura].push({ nome: r.nome, slug: r.slug, motivo: r.motivo || null, nota: r.nota || null });
  }
  const daRodada = saida.empresas.filter((e) => selecao.slugs.includes(e.slug) && e.cobertura !== 'sem_linkedin');
  const faltam = daRodada.filter((e) => e.motivo === 'nao_coletada_nesta_rodada');
  const boletimDaRodada = boletinsEntre(dados, selecao.data, hoje).pop() || null;
  let situacao = 'de_hoje';
  if (selecao.data < hoje) situacao = faltam.length ? 'anterior_por_terminar' : boletimDaRodada ? 'anterior_com_boletim' : 'anterior_sem_boletim';
  saida.rodada = {
    data: selecao.data,
    situacao,
    n_empresas: daRodada.length,
    coletadas: daRodada.filter((e) => e.motivo !== 'nao_coletada_nesta_rodada').map((e) => e.nome),
    faltam_coletar: faltam.map((e) => ({ nome: e.nome, slug: e.slug, nota: e.nota })),
    boletim_da_rodada_existe: boletimDaRodada !== null,
    boletim_da_rodada: boletimDaRodada,
  };
  saida.totais = { empresas: saida.empresas.length, posts_novos: saida.empresas.reduce((s, e) => s + (e.n_novos || 0), 0) };
  return terminar();
}

if (require.main === module) principal(process.argv);
