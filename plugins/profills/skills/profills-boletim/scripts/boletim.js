#!/usr/bin/env node
// boletim.js — a conta do boletim da profills-boletim (Node >= 18, sem dependência).
// Lê o índice (pelo indice.js da profills-radar) e a seleção da rodada. A unidade de exame é a conta, uma
// empresa numa rede: a página no LinkedIn ou o perfil no Instagram, com as coletas em
// catalog/raw/<rede>/<conta>/<data>/. De cada empresa da seleção entram as contas que a linha dela lista;
// de cada conta saem o balde de cobertura, os posts novos (contra a coleta anterior da mesma conta) e a
// cadência das duas coletas (posts_por_semana do metricas.js da profills-garimpo). A empresa leva a
// cobertura agregada das contas e a soma dos posts novos; engajamento de redes diferentes nunca se soma.
// Só lê: não grava nada, e rodar duas vezes no mesmo estado dá a mesma saída.
// Uso:     node scripts/boletim.js <DADOS> [--hoje AAAA-MM-DD]
// Exemplo: node scripts/boletim.js "$HOME/Profills LinkedIn" --hoje 2026-08-24
//          → {"acao":"boletim","rodada":{"data":"2026-08-24","faltam_coletar":[]},"empresas":[{"nome":…,"cobertura":…,"contas":[…]}],"cobertura":{...},"ok":true}
//          rodada.situacao diz o que fazer com a seleção: de_hoje, anterior_por_terminar, anterior_sem_boletim, anterior_com_boletim.
// Saída: JSON em stdout. Exit 0 = ok · 1 = índice, seleção ou coleta com data depois de hoje impedem o boletim (campo problemas) · 2 = erro de uso.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { dataValida, datasDaConta } = require(path.join(__dirname, '..', '..', '..', 'scripts', 'coleta.js'));

const INDICE = path.join(__dirname, '..', '..', 'profills-radar', 'scripts', 'indice.js');
const METRICAS = path.join(__dirname, '..', '..', 'profills-garimpo', 'scripts', 'metricas.js');

// Cada empresa do índice cai em exatamente um balde, nesta ordem de precedência. Cada conta examinada
// cai num dos três primeiros; a empresa leva o primeiro que alguma conta dela tem.
const BALDES = ['com_novidade', 'sem_novidade', 'indisponivel', 'sem_rede', 'fora_desta_rodada'];
const NA_RODADA = BALDES.slice(0, 3);
// Status de meta.json que contam como retrato válido da página: servem de coleta anterior para comparar.
// sem_posts é silêncio, que é dado; pagina_nao_gerenciada é página sem aba de publicações ou perfil privado.
const STATUS_SEM_POSTS = new Set(['sem_posts', 'pagina_nao_gerenciada']);
const REDE_POR_EXTENSO = { linkedin: 'LinkedIn', instagram: 'Instagram' };
const mesmaConta = (a, b) => a.rede === b.rede && a.conta === b.conta;

function morrer(mensagem) {
  process.stderr.write(mensagem + '\n');
  process.exit(2);
}

function hojeISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function lerJson(arquivo) {
  if (!fs.existsSync(arquivo)) return { ausente: true };
  try {
    return { valor: JSON.parse(fs.readFileSync(arquivo, 'utf8').replace(/^\uFEFF/, '')) };
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

// Linha da seleção: - [Nome](refs/<slug>.md) — `<slug>` · id <id|—> · <setor> · <país> · linkedin `<slug>` · instagram `<handle>`,
// com só as redes a coletar nesta rodada. Linha sem nenhum campo de rede é do formato anterior.
function lerSelecao(arquivo) {
  if (!fs.existsSync(arquivo)) return null;
  const texto = fs.readFileSync(arquivo, 'utf8').replace(/^﻿/, '');
  const cabecalho = texto.match(/^#\s+Seleção ativa\s+[—–-]\s+(\d{4}-\d{2}-\d{2})\s*$/m);
  const empresas = [];
  for (const m of texto.matchAll(/^\s*-\s+\[[^\]]+\]\([^)]*\)\s+[—–-]\s+`([^`]+)`(.*)$/gm)) {
    const contas = [...m[2].matchAll(/·\s*(linkedin|instagram)\s+`([^`]+)`/g)].map((r) => ({ rede: r[1], conta: r[2].trim() }));
    empresas.push({ slug: m[1], contas });
  }
  return { data: cabecalho && dataValida(cabecalho[1]) ? cabecalho[1] : null, empresas, slugs: empresas.map((e) => e.slug) };
}

// A garimpo grava o meta.json com "concluida": false ao abrir a página e com true ao terminar.
// Pasta sem meta.json é coleta de 2026-07, de antes do meta.json, ou coleta que parou antes de começar;
// quem decide entre as duas é a data da rodada, em examinarConta. meta.json ilegível conta como
// terminado, para o erro aparecer em lerColeta em vez de mandar a conta de volta à garimpo.
function estadoDaPasta(pasta) {
  const meta = lerJson(path.join(pasta, 'meta.json'));
  if (meta.ausente) return 'sem_meta';
  if (meta.erro || !meta.valor || meta.valor.concluida === true) return 'concluida';
  return 'interrompida';
}

// Uma coleta é uma pasta de data com posts.json e meta.json. `comparavel` diz se ela retrata a
// página no dia (serve de anterior); `erro` diz por que não dá para ler. Difere do lerColeta do coleta.js
// de propósito: aqui erro_navegacao sem posts.json é o motivo da coleta, não um erro de leitura.
function lerColeta(pastaConta, data) {
  const pasta = path.join(pastaConta, data);
  const meta = lerJson(path.join(pasta, 'meta.json'));
  const posts = lerJson(path.join(pasta, 'posts.json'));
  const coleta = { data, pasta, estado: estadoDaPasta(pasta), status: null, nota: null, janela_dias: null, posts: null, erro: null };
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
  coleta.comparavel = !coleta.erro && coleta.estado !== 'interrompida' && (coleta.status === 'ok' || STATUS_SEM_POSTS.has(coleta.status));
  return coleta;
}

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
function semRepetidos(coleta, aviso) {
  const ids = new Set();
  const urls = new Set();
  return coleta.posts.filter((p) => {
    const id = idDe(p);
    const url = normalizarUrl(p.url);
    if ((id && ids.has(id)) || (url && urls.has(url))) {
      aviso('post_repetido', `o post ${id || url} aparece mais de uma vez na coleta ${coleta.data}: conta uma vez só`);
      return false;
    }
    if (id) ids.add(id);
    if (url) urls.add(url);
    return true;
  });
}

function postsNovos(atual, anterior, aviso) {
  const ids = new Set();
  const urls = new Set();
  for (const p of anterior ? anterior.posts : []) {
    if (idDe(p)) ids.add(idDe(p));
    if (normalizarUrl(p.url)) urls.add(normalizarUrl(p.url));
  }
  return atual.posts.filter((p) => {
    const id = idDe(p);
    const url = normalizarUrl(p.url);
    if (!id && !url) aviso('post_sem_chave', `um post da coleta ${atual.data} não tem post_id nem url: entra como novo e não tem link`);
    return !(id && ids.has(id)) && !(url && urls.has(url));
  });
}

// Uma conta da seleção (empresa + rede) na rodada: a mesma regra que valia para a empresa quando só havia LinkedIn.
function examinarConta(e, { rede, conta }, rodada, raiz, hoje, avisos) {
  const aviso = (tipo, detalhe) => avisos.push({ tipo, empresa: e.nome, rede, conta, detalhe });
  const pastaConta = path.join(raiz, rede, conta);
  const base = { rede, conta, cobertura: 'indisponivel', motivo: null, nota: null, coleta_atual: null, coleta_anterior: null, primeira_coleta: null, n_novos: 0, novos: [], cadencia: null };

  // A regra da profills-garimpo: coletada nesta rodada é a conta com meta.json com "concluida": true numa pasta
  // com data entre a do cabeçalho e hoje. Pasta da rodada sem meta.json, ou com "concluida": false, é coleta
  // interrompida e a garimpo a refaz.
  const datas = datasDaConta(pastaConta).filter((d) => d <= hoje);
  const daRodada = datas.filter((d) => d >= rodada.data);
  const completas = daRodada.filter((d) => estadoDaPasta(path.join(pastaConta, d)) === 'concluida');
  const ultima = completas[completas.length - 1];
  if (!ultima) {
    const anteriores = datas.filter((d) => d < rodada.data);
    let nota = anteriores.length ? `última coleta em ${anteriores[anteriores.length - 1]}, antes desta rodada` : 'nunca coletada';
    const parou = daRodada[daRodada.length - 1];
    if (parou) {
      nota = estadoDaPasta(path.join(pastaConta, parou)) === 'sem_meta'
        ? `coleta interrompida em ${parou}: a pasta não tem meta.json`
        : `coleta interrompida em ${parou}: o meta.json não traz "concluida": true`;
    }
    return { ...base, motivo: 'nao_coletada_nesta_rodada', nota };
  }
  const atual = lerColeta(pastaConta, ultima);
  if (atual.erro) return { ...base, motivo: 'coleta_com_erro', nota: atual.erro, coleta_atual: { data: atual.data } };
  if (atual.status !== 'ok' && !STATUS_SEM_POSTS.has(atual.status)) {
    return { ...base, motivo: atual.status, nota: atual.nota, coleta_atual: { data: atual.data, status: atual.status } };
  }

  atual.posts = semRepetidos(atual, aviso);
  // Coleta interrompida não serve de base de comparação: posts parciais. Dentro da rodada, sem meta.json também é
  // interrompida; antes dela, pasta sem meta.json é a coleta de 2026-07, que vale.
  let anterior = null;
  const antes = datas.filter((d) => d < ultima && (d < rodada.data || completas.includes(d)));
  for (let i = antes.length - 1; i >= 0 && !anterior; i--) {
    const c = lerColeta(pastaConta, antes[i]);
    if (c.comparavel) anterior = c;
  }
  const cadAtual = cadenciaDe(atual);
  const cadAnterior = anterior ? cadenciaDe(anterior) : null;
  const novos = postsNovos(atual, anterior, aviso)
    .map((p) => postNovo(p, cadAtual.destaque))
    .sort((a, b) => (b.data || '').localeCompare(a.data || ''));
  for (const p of novos) {
    if (p.estrangeiro && !p.resumo_pt) aviso('resumo_pt_ausente', `post de ${p.data} em ${p.idioma} sem resumo_pt: leia o texto em ${atual.pasta}/posts.json`);
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
    if (!cadencia.mesma_janela) aviso('janelas_diferentes', `a coleta ${cadAnterior.data} usou janela de ${cadAnterior.janela_dias} dias e a ${cadAtual.data} de ${cadAtual.janela_dias}: a cadência não se compara`);
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

// As contas de uma empresa que esta rodada examina: as da linha dela na seleção que o índice também tem,
// na ordem do índice.
const contasDaRodada = (e, linha) => (linha ? e.contas.filter((c) => linha.contas.some((s) => mesmaConta(s, c))) : []);

function examinarEmpresa(e, linha, rodada, raiz, hoje, avisos) {
  const base = { nome: e.nome, slug: e.slug, prioridade: e.prioridade || 'a definir' };
  if (!e.contas.length) return { ...base, cobertura: 'sem_rede', n_novos: 0, contas: [] };
  const daRodada = contasDaRodada(e, linha);
  if (!daRodada.length) {
    return { ...base, cobertura: 'fora_desta_rodada', n_novos: 0, contas: e.contas.map((c) => ({ rede: c.rede, conta: c.conta, ultimo_catalogo: c.catalogo || null })) };
  }
  const contas = daRodada.map((c) => examinarConta(e, c, rodada, raiz, hoje, avisos));
  const cobertura = NA_RODADA.find((b) => contas.some((c) => c.cobertura === b));
  return { ...base, cobertura, n_novos: contas.reduce((s, c) => s + c.n_novos, 0), contas };
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
  if (!selecao || selecao.empresas.length === 0) {
    saida.problemas.push({ tipo: 'selecao_ausente', detalhe: 'selection.md não existe ou não tem empresa: a profills-radar monta a rodada' });
    return terminar();
  }
  const semRedes = selecao.empresas.filter((s) => s.contas.length === 0).map((s) => s.slug);
  if (semRedes.length) {
    saida.problemas.push({ tipo: 'selecao_sem_redes', slugs: semRedes, detalhe: `a seleção é do formato anterior, sem dizer as redes a coletar (${semRedes.map((s) => `\`${s}\``).join(', ')}): a profills-radar remonta a rodada` });
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
  const linhaDe = (slug) => selecao.empresas.find((s) => s.slug === slug) || null;
  const porSlug = new Map(indice.empresas.map((e) => [e.slug, e]));
  for (const s of selecao.empresas) {
    const e = porSlug.get(s.slug);
    if (!e) {
      saida.avisos.push({ tipo: 'selecao_fora_do_indice', detalhe: `\`${s.slug}\` está na seleção e não está no índice: fica fora do boletim` });
      continue;
    }
    for (const c of s.contas.filter((c) => !e.contas.some((x) => mesmaConta(x, c)))) {
      saida.avisos.push({ tipo: 'conta_fora_do_indice', empresa: e.nome, rede: c.rede, conta: c.conta, detalhe: `a seleção pede o ${REDE_POR_EXTENSO[c.rede]} \`${c.conta}\` de ${e.nome}, e a lista não traz essa conta para a empresa: ela fica fora do boletim` });
    }
  }

  const raiz = path.join(dados, 'catalog', 'raw');
  // Pasta com data depois de hoje fica fora da conta, mas a garimpo a contaria como coletada: sem esta
  // parada, a conta iria para a garimpo, que a daria por feita, e o boletim a mostraria faltando de novo.
  for (const e of indice.empresas) {
    for (const c of contasDaRodada(e, linhaDe(e.slug))) {
      for (const data of datasDaConta(path.join(raiz, c.rede, c.conta)).filter((d) => d > hoje)) {
        saida.problemas.push({ tipo: 'coleta_no_futuro', empresa: e.nome, rede: c.rede, conta: c.conta, data, detalhe: `a coleta de ${e.nome} no ${REDE_POR_EXTENSO[c.rede]} está numa pasta de ${data}, depois de hoje (${hoje}): o relógio ou o fuso do computador estava adiantado quando ela foi gravada` });
      }
    }
  }
  if (saida.problemas.length) return terminar();

  for (const e of indice.empresas) {
    const r = examinarEmpresa(e, linhaDe(e.slug), selecao, raiz, hoje, saida.avisos);
    saida.empresas.push(r);
    saida.cobertura[r.cobertura].push({
      nome: r.nome,
      slug: r.slug,
      contas: r.contas.map((c) => ({ rede: c.rede, conta: c.conta, cobertura: c.cobertura || r.cobertura, motivo: c.motivo || null, nota: c.nota || null })),
    });
  }
  const daRodada = saida.empresas.filter((e) => NA_RODADA.includes(e.cobertura));
  const contas = daRodada.flatMap((e) => e.contas.map((c) => ({ nome: e.nome, slug: e.slug, ...c })));
  const faltam = contas.filter((c) => c.motivo === 'nao_coletada_nesta_rodada');
  const boletimDaRodada = boletinsEntre(dados, selecao.data, hoje).pop() || null;
  let situacao = 'de_hoje';
  if (selecao.data < hoje) situacao = faltam.length ? 'anterior_por_terminar' : boletimDaRodada ? 'anterior_com_boletim' : 'anterior_sem_boletim';
  saida.rodada = {
    data: selecao.data,
    situacao,
    n_empresas: daRodada.length,
    n_contas: contas.length,
    coletadas: contas.filter((c) => c.motivo !== 'nao_coletada_nesta_rodada').map((c) => ({ nome: c.nome, rede: c.rede })),
    faltam_coletar: faltam.map((c) => ({ nome: c.nome, slug: c.slug, rede: c.rede, conta: c.conta, nota: c.nota })),
    boletim_da_rodada_existe: boletimDaRodada !== null,
    boletim_da_rodada: boletimDaRodada,
  };
  saida.totais = { empresas: saida.empresas.length, posts_novos: saida.empresas.reduce((s, e) => s + e.n_novos, 0) };
  return terminar();
}

if (require.main === module) principal(process.argv);
