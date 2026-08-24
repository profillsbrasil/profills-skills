#!/usr/bin/env node
// indice.js — a conta do índice de referências da profills-radar (Node >= 18, sem dependência).
// Faz três coisas sobre DADOS/refs: valida o INDEX.md linha a linha (campos, ordem, id, datas,
// existência da ficha, fichas órfãs, pesquisa vencida em 60 dias); reconstrói o INDEX.md a partir
// das fichas quando ele sumiu (--reconstruir, recuperando o campo catálogo em catalog/raw/ e no
// índice anterior — o alerta ⚠ não é recuperável do disco); e procura ficha parecida antes de criar
// uma nova (--procurar, sem acento e por distância).
// Uso:     node scripts/indice.js <pasta refs> [--reconstruir] [--catalog <pasta>] [--procurar "<nome>"] [--hoje AAAA-MM-DD]
// Exemplo: node scripts/indice.js linkedin-data/refs --procurar "Maquimox"
//          → {"acao":"procurar","termo":"Maquimox","ha_parecido":true,"candidatos":[{"slug":"maqinox-...","semelhanca":0.75}],"ok":true}
// Saída: JSON em stdout. Exit 0 = ok · 1 = alguma checagem falhou · 2 = erro de uso/arquivo.

const fs = require('fs');
const path = require('path');

// ---------- utilidades ----------

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
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(s + 'T00:00:00Z');
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
}

function diasEntre(inicio, fim) {
  const a = new Date(inicio + 'T00:00:00Z').getTime();
  const b = new Date(fim + 'T00:00:00Z').getTime();
  return Math.round((b - a) / 86400000);
}

// Todo arquivo entra aqui: INDEX.md salvo no Windows chega com \r\n e o \r sobra no fim do campo.
function lerTexto(caminho) {
  return fs.readFileSync(caminho, 'utf8').replace(/\r\n/g, '\n');
}

// O campo Setor da ficha é uma frase; a linha do índice quer um rótulo curto.
function resumirSetor(texto) {
  if (!texto) return null;
  let corte = texto.split(/[;—(]/)[0].trim();
  if (corte.length > 60) {
    const cabeca = corte.slice(0, 60);
    const espaco = cabeca.lastIndexOf(' ');
    corte = (espaco > 0 ? cabeca.slice(0, espaco) : cabeca).trim();
  }
  corte = corte.replace(/[\s,·-]+$/, '').trim();
  // não termina em preposição/conjunção solta ("... para", "... e")
  corte = corte.replace(/\s+(para|de|do|da|dos|das|e|em|com|por|a|o)$/i, '').trim();
  return corte || null;
}

function normalizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function distancia(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const atual = [i];
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(atual[j - 1] + 1, anterior[j] + 1, anterior[j - 1] + custo);
    }
    anterior = atual;
  }
  return anterior[b.length];
}

function semelhanca(a, b) {
  if (!a.length || !b.length) return 0;
  const maior = Math.max(a.length, b.length);
  return Number((1 - distancia(a, b) / maior).toFixed(2));
}

// ---------- leitura das fichas ----------

const PADROES_VAZIOS = /^(—|-|a confirmar|<[^>]*>)$/i;

function lerFicha(pasta, arquivo) {
  const texto = lerTexto(path.join(pasta, arquivo));
  const linhas = texto.split('\n');
  const campo = (rotulos) => {
    for (const linha of linhas) {
      for (const rotulo of rotulos) {
        const m = linha.match(new RegExp('^\\s*[-*]\\s*\\*\\*' + rotulo + '\\*\\*\\s*:\\s*(.+)$', 'i'));
        if (m) return m[1].trim();
      }
    }
    return null;
  };
  const tituloLinha = linhas.find((l) => /^#\s+\S/.test(l));
  const nome = tituloLinha ? tituloLinha.replace(/^#\s+/, '').trim() : null;

  const bruto = {
    slug: campo(['Slug LinkedIn', 'Endereço no LinkedIn', 'Endereco no LinkedIn']),
    id: campo(['ID numérico', 'ID numerico']),
    setor: campo(['Setor']),
    pais: campo(['País / idioma dos posts', 'Pais / idioma dos posts', 'País']),
    pesquisa: campo(['Última pesquisa', 'Ultima pesquisa']),
  };

  const slugMatch = bruto.slug ? bruto.slug.match(/`([^`]+)`/) : null;
  const slug = slugMatch ? slugMatch[1].trim() : null;

  let id = '—';
  if (bruto.id) {
    const digitos = bruto.id.match(/(\d{4,})/);
    id = digitos ? digitos[1] : '—';
  }

  let setor = bruto.setor ? bruto.setor.replace(/\s+/g, ' ').replace(/·/g, '-').trim() : null;
  let pais = bruto.pais ? bruto.pais.split('·')[0].replace(/·/g, '-').trim() : null;
  if (pais && PADROES_VAZIOS.test(pais)) pais = null;

  const dataMatch = bruto.pesquisa ? bruto.pesquisa.match(/(\d{4}-\d{2}-\d{2})/) : null;
  const pesquisa = dataMatch ? dataMatch[1] : null;

  return { arquivo, nome, slug, id, setor, pais, pesquisa };
}

function listarFichas(pasta) {
  return fs
    .readdirSync(pasta)
    .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
    .sort();
}

// ---------- leitura do índice ----------

const RE_LINHA = /^-\s+\[([^\]]+)\]\(([^)]+)\)\s+—\s+`([^`]+)`\s+·\s+(.+)$/;
// Toda linha de lista do INDEX.md é candidata a linha de empresa: linha solta vira problema, não sumiço.
const RE_ITEM = /^-\s+/;

function parsearLinha(texto, numero) {
  const m = texto.match(RE_LINHA);
  if (!m) return { erro: 'linha_fora_do_formato', linha: numero, trecho: texto };

  const [, nome, arquivo, slug, resto] = m;
  const campos = resto.split('·').map((c) => c.trim()).filter(Boolean);
  const empresa = { nome, arquivo, slug, id: null, setor: null, pais: null, pesquisa: null, catalogo: null, alerta: null, linha: numero, trecho: texto };
  const problemas = [];

  if (campos.length && /^⚠/.test(campos[campos.length - 1])) {
    empresa.alerta = campos.pop().replace(/^⚠\s*/, '');
  }
  const idCampo = campos.shift();
  const mid = idCampo ? idCampo.match(/^id\s+(\d+|—)$/) : null;
  if (mid) empresa.id = mid[1];
  else problemas.push({ tipo: 'id_invalido', detalhe: `esperado "id <número>" ou "id —", veio "${idCampo || ''}"` });

  const catalogoCampo = campos.pop();
  if (catalogoCampo === 'sem catálogo') empresa.catalogo = null;
  else if (catalogoCampo && /^catálogo\s+\d{4}-\d{2}-\d{2}$/.test(catalogoCampo)) {
    empresa.catalogo = catalogoCampo.replace(/^catálogo\s+/, '');
    if (!dataValida(empresa.catalogo)) problemas.push({ tipo: 'data_catalogo_invalida', detalhe: `"${empresa.catalogo}" não é uma data AAAA-MM-DD real` });
  } else {
    problemas.push({ tipo: 'catalogo_fora_do_formato', detalhe: `esperado "sem catálogo" ou "catálogo AAAA-MM-DD", veio "${catalogoCampo || ''}"` });
  }

  const pesquisaCampo = campos.pop();
  const mp = pesquisaCampo ? pesquisaCampo.match(/^pesquisa\s+(\S+)$/) : null;
  if (mp && dataValida(mp[1])) empresa.pesquisa = mp[1];
  else problemas.push({ tipo: 'data_pesquisa_invalida', detalhe: `esperado "pesquisa AAAA-MM-DD", veio "${pesquisaCampo || ''}"` });

  empresa.pais = campos.length ? campos.pop() : null;
  empresa.setor = campos.length ? campos.join(' · ') : null;
  if (!empresa.pais) problemas.push({ tipo: 'pais_ausente', detalhe: 'a linha não tem o campo país' });
  if (!empresa.setor) problemas.push({ tipo: 'setor_ausente', detalhe: 'a linha não tem o campo setor' });

  return { empresa, problemas };
}

function lerIndice(pasta) {
  const caminho = path.join(pasta, 'INDEX.md');
  if (!fs.existsSync(caminho)) return { existe: false, caminho, linhas: [], texto: null };
  const texto = lerTexto(caminho);
  return { existe: true, caminho, texto, linhas: texto.split('\n') };
}

// ---------- ações ----------

function validar(pasta, hoje) {
  if (!fs.existsSync(pasta)) {
    // Pasta refs/ ausente é estado de fluxo (primeira run), não erro de uso.
    const vazio = {
      acao: 'validar',
      pasta,
      hoje,
      pasta_existe: false,
      indice_existe: false,
      n_empresas: 0,
      empresas: [],
      fichas_orfas: [],
      pesquisa_vencida: [],
      problemas: [{ tipo: 'pasta_ausente', detalhe: `a pasta ${pasta} não existe — crie-a antes de escrever a primeira ficha; é primeira run` }],
      ok: false,
    };
    process.stdout.write(JSON.stringify(vazio, null, 2) + '\n');
    process.exit(1);
  }
  const indice = lerIndice(pasta);
  const saida = {
    acao: 'validar',
    pasta,
    hoje,
    pasta_existe: true,
    indice_existe: indice.existe,
    n_empresas: 0,
    empresas: [],
    fichas_orfas: [],
    pesquisa_vencida: [],
    problemas: [],
    ok: false,
  };

  const fichas = listarFichas(pasta);

  if (!indice.existe) {
    saida.fichas_orfas = fichas;
    saida.problemas.push({
      tipo: 'indice_ausente',
      detalhe: fichas.length
        ? `INDEX.md não existe, mas há ${fichas.length} ficha(s) em refs/ — rode --reconstruir`
        : 'INDEX.md não existe e não há fichas em refs/ — é primeira run',
    });
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
    process.exit(1);
  }

  if (!/^##\s+Empresas\s*$/m.test(indice.texto)) {
    saida.problemas.push({ tipo: 'cabecalho_ausente', detalhe: 'o INDEX.md não tem a seção "## Empresas"' });
  }

  const vistos = new Map();
  indice.linhas.forEach((texto, i) => {
    if (!RE_ITEM.test(texto)) return;
    const numero = i + 1;
    const r = parsearLinha(texto, numero);
    if (r.erro) {
      saida.problemas.push({ linha: numero, trecho: texto.slice(0, 120), tipo: r.erro, detalhe: 'esperado "- [Nome](<slug>.md) — `<slug>` · id <id ou —> · <setor> · <país> · pesquisa AAAA-MM-DD · <catálogo>"' });
      return;
    }
    const e = r.empresa;
    for (const p of r.problemas) saida.problemas.push({ linha: numero, slug: e.slug, ...p });

    if (e.arquivo !== `${e.slug}.md`) {
      saida.problemas.push({ linha: numero, slug: e.slug, tipo: 'link_nao_bate_com_slug', detalhe: `o link aponta para "${e.arquivo}" e o slug é "${e.slug}"` });
    }
    const fichaExiste = fs.existsSync(path.join(pasta, e.arquivo));
    if (!fichaExiste) {
      saida.problemas.push({ linha: numero, slug: e.slug, tipo: 'ficha_ausente', detalhe: `a linha aponta para "${e.arquivo}", que não existe em refs/` });
    }
    if (vistos.has(e.slug)) {
      saida.problemas.push({ linha: numero, slug: e.slug, tipo: 'slug_duplicado', detalhe: `o slug "${e.slug}" já aparece na linha ${vistos.get(e.slug)}` });
    } else {
      vistos.set(e.slug, numero);
    }

    const dias = e.pesquisa ? diasEntre(e.pesquisa, hoje) : null;
    const vencida = dias !== null && dias > 60;
    if (vencida) saida.pesquisa_vencida.push(e.slug);

    saida.empresas.push({
      nome: e.nome,
      slug: e.slug,
      arquivo: e.arquivo,
      id: e.id,
      setor: e.setor,
      pais: e.pais,
      pesquisa: e.pesquisa,
      dias_desde_pesquisa: dias,
      pesquisa_vencida: vencida,
      catalogo: e.catalogo,
      alerta: e.alerta,
      ficha_existe: fichaExiste,
      linha: numero,
    });
  });

  saida.n_empresas = saida.empresas.length;
  const noIndice = new Set(saida.empresas.map((e) => e.arquivo));
  // Ficha órfã não é erro de índice: é ficha fora da lista (removida ou nunca indexada).
  // Ela sai em fichas_orfas, para a skill oferecer a reindexação — e não derruba o ok.
  saida.fichas_orfas = fichas.filter((f) => !noIndice.has(f));
  if (saida.n_empresas === 0 && !saida.problemas.some((p) => p.tipo === 'cabecalho_ausente')) {
    saida.problemas.push({ tipo: 'indice_vazio', detalhe: 'o INDEX.md existe mas não tem nenhuma linha de empresa' });
  }

  saida.ok = saida.problemas.length === 0;
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  process.exit(saida.ok ? 0 : 1);
}

// O campo catálogo é do disco, não do índice: cada coleta da profills-garimpo deixa
// catalog/raw/<slug>/<AAAA-MM-DD>/. Vale a data mais recente que trouxe post — meta.json com
// status "ok" ou posts.json com pelo menos um post. Coleta vazia (sem_posts, página não
// gerenciada) não conta como catálogo.
function catalogoNoDisco(raiz, slug) {
  const pastaEmpresa = path.join(raiz, slug);
  let datas;
  try {
    datas = fs
      .readdirSync(pastaEmpresa, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}-\d{2}-\d{2}$/.test(d.name) && dataValida(d.name))
      .map((d) => d.name)
      .sort()
      .reverse();
  } catch (e) {
    return null;
  }
  for (const data of datas) {
    const dia = path.join(pastaEmpresa, data);
    let meta = null;
    try {
      meta = JSON.parse(lerTexto(path.join(dia, 'meta.json')));
    } catch (e) {
      meta = null;
    }
    if (meta && meta.status === 'ok') return { data, prova: 'meta.json com status ok' };
    try {
      const posts = JSON.parse(lerTexto(path.join(dia, 'posts.json')));
      if (Array.isArray(posts) && posts.length) return { data, prova: `posts.json com ${posts.length} post(s)` };
    } catch (e) {
      // pasta sem posts.json legível: não é catálogo, segue para a data anterior
    }
  }
  return null;
}

function reconstruir(pasta, hoje, raizCatalogo) {
  const indice = lerIndice(pasta);
  const anteriores = new Map();
  const linhasIlegiveis = [];
  if (indice.existe) {
    indice.linhas.forEach((texto, i) => {
      if (!RE_ITEM.test(texto)) return;
      const r = parsearLinha(texto, i + 1);
      if (r.erro) linhasIlegiveis.push({ linha: i + 1, trecho: texto.slice(0, 120) });
      else anteriores.set(r.empresa.slug, { catalogo: r.empresa.catalogo, alerta: r.empresa.alerta });
    });
  }

  const fichas = listarFichas(pasta);
  const saida = {
    acao: 'reconstruir',
    pasta,
    hoje,
    arquivo: indice.caminho,
    indice_existia: indice.existe,
    catalogo_raiz: raizCatalogo,
    catalogo_raiz_existe: fs.existsSync(raizCatalogo),
    n_fichas: fichas.length,
    escritas: [],
    fichas_ignoradas: [],
    avisos: [],
    problemas: [],
    ok: false,
  };

  if (!fichas.length) {
    saida.problemas.push({ tipo: 'sem_fichas', detalhe: 'não há ficha nenhuma em refs/ para reconstruir o índice — é primeira run' });
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
    process.exit(1);
  }

  const linhas = [];
  for (const arquivo of fichas) {
    let ficha;
    try {
      ficha = lerFicha(pasta, arquivo);
    } catch (e) {
      saida.fichas_ignoradas.push({ arquivo, motivo: 'não deu para ler o arquivo' });
      continue;
    }
    if (!ficha.nome || !ficha.slug) {
      saida.fichas_ignoradas.push({ arquivo, motivo: !ficha.nome ? 'sem título "# Nome" no topo' : 'sem o campo de endereço no LinkedIn com o slug entre crases' });
      continue;
    }
    const anterior = anteriores.get(ficha.slug) || {};
    const doDisco = catalogoNoDisco(raizCatalogo, ficha.slug);
    // Entre a data do disco e a do índice anterior vale a mais recente: nenhuma das duas mente,
    // e a do disco costuma ser a que o índice perdido não chegou a registrar.
    let dataCatalogo = null;
    let origem = 'sem catálogo';
    if (doDisco && (!anterior.catalogo || doDisco.data >= anterior.catalogo)) {
      dataCatalogo = doDisco.data;
      origem = 'catalog/raw';
    } else if (anterior.catalogo) {
      dataCatalogo = anterior.catalogo;
      origem = 'índice anterior';
    }
    const setor = resumirSetor(ficha.setor);
    const campos = [
      `id ${ficha.id || '—'}`,
      setor || '[a confirmar]',
      ficha.pais || '[a confirmar]',
      `pesquisa ${ficha.pesquisa || '[a confirmar]'}`,
      dataCatalogo ? `catálogo ${dataCatalogo}` : 'sem catálogo',
    ];
    if (anterior.alerta) campos.push(`⚠ ${anterior.alerta}`);
    linhas.push(`- [${ficha.nome}](${ficha.slug}.md) — \`${ficha.slug}\` · ${campos.join(' · ')}`);
    saida.escritas.push({
      slug: ficha.slug,
      nome: ficha.nome,
      arquivo,
      id: ficha.id || '—',
      setor,
      pesquisa: ficha.pesquisa,
      catalogo: dataCatalogo,
      origem_catalogo: origem,
      prova_catalogo: origem === 'catalog/raw' ? doDisco.prova : null,
      alerta_preservado: anterior.alerta || null,
      campos_a_confirmar: ['setor', 'pais', 'pesquisa'].filter((c) => !ficha[c]),
    });
  }

  if (!linhas.length) {
    saida.problemas.push({ tipo: 'nenhuma_ficha_legivel', detalhe: 'nenhuma ficha de refs/ tem título e slug — o índice não foi escrito' });
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
    process.exit(1);
  }

  const conteudo = [
    '# Índice de referências — empresas do LinkedIn',
    '',
    'O índice é um mapa, não um armazém: cada linha aponta para a ficha que guarda o detalhe.',
    '',
    '## Empresas',
    '',
    ...linhas,
    '',
  ].join('\n');
  fs.writeFileSync(indice.caminho, conteudo, 'utf8');

  for (const e of saida.escritas) {
    if (e.campos_a_confirmar.length) {
      saida.problemas.push({ tipo: 'campo_a_confirmar', slug: e.slug, detalhe: `a ficha não trouxe: ${e.campos_a_confirmar.join(', ')}` });
    }
  }
  for (const i of saida.fichas_ignoradas) {
    saida.problemas.push({ tipo: 'ficha_ignorada', detalhe: `${i.arquivo}: ${i.motivo}` });
  }

  // O ⚠ é frase escrita por você, não dado de coleta: nenhum arquivo do disco o devolve.
  if (!indice.existe) {
    saida.avisos.push({
      tipo: 'alertas_perdidos',
      empresas: [],
      detalhe: 'alertas ⚠ do índice anterior, se existiam, precisam ser refeitos — nenhum arquivo do disco os guarda',
    });
  } else {
    const semTextoAnterior = saida.escritas.filter((e) => !anteriores.has(e.slug)).map((e) => e.nome);
    if (semTextoAnterior.length || linhasIlegiveis.length) {
      saida.avisos.push({
        tipo: 'alertas_perdidos',
        empresas: semTextoAnterior,
        linhas_ilegiveis: linhasIlegiveis,
        detalhe: 'o índice anterior não tinha linha legível para estas empresas — um ⚠ que existisse nelas precisa ser refeito',
      });
    }
  }

  saida.ok = saida.problemas.length === 0;
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  process.exit(saida.ok ? 0 : 1);
}

function procurar(pasta, termo) {
  const alvo = normalizar(termo);
  const saida = { acao: 'procurar', pasta, termo, ha_parecido: false, candidatos: [], ok: true };
  if (!alvo) morrer('Uso: --procurar precisa de um nome, ex.: --procurar "Maquimox".');

  const pedacos = alvo.split(' ').filter(Boolean);
  for (const arquivo of listarFichas(pasta)) {
    let ficha;
    try {
      ficha = lerFicha(pasta, arquivo);
    } catch (e) {
      continue;
    }
    const candidatos = [
      { valor: normalizar(ficha.nome || ''), por: 'nome' },
      { valor: normalizar(ficha.slug || arquivo.replace(/\.md$/, '')), por: 'slug' },
    ];
    let melhor = { semelhanca: 0, por: null };
    for (const { valor, por } of candidatos) {
      if (!valor) continue;
      let s = semelhanca(alvo, valor);
      if (valor.includes(alvo) || alvo.includes(valor)) s = Math.max(s, 0.85);
      for (const palavra of valor.split(' ').filter(Boolean)) {
        for (const pedaco of pedacos) {
          s = Math.max(s, semelhanca(pedaco, palavra));
        }
      }
      if (s > melhor.semelhanca) melhor = { semelhanca: s, por };
    }
    if (melhor.semelhanca >= 0.7) {
      saida.candidatos.push({
        nome: ficha.nome,
        slug: ficha.slug,
        arquivo,
        pesquisa: ficha.pesquisa,
        semelhanca: melhor.semelhanca,
        por: melhor.por,
      });
    }
  }
  saida.candidatos.sort((a, b) => b.semelhanca - a.semelhanca);
  saida.ha_parecido = saida.candidatos.length > 0;
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  process.exit(0);
}

// ---------- argumentos ----------

function principal(argv) {
  const args = argv.slice(2);
  let pasta = null;
  let acao = 'validar';
  let termo = null;
  let catalogo = null;
  let hoje = hojeISO();

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--reconstruir') {
      if (acao === 'procurar') morrer('Use --reconstruir ou --procurar, não os dois na mesma chamada.');
      acao = 'reconstruir';
    } else if (a === '--procurar') {
      if (acao === 'reconstruir') morrer('Use --reconstruir ou --procurar, não os dois na mesma chamada.');
      acao = 'procurar';
      termo = args[++i];
      if (!termo) morrer('Uso: --procurar precisa de um nome, ex.: --procurar "Maquimox".');
    } else if (a === '--catalog') {
      catalogo = args[++i];
      if (!catalogo) morrer('Uso: --catalog precisa de uma pasta, ex.: --catalog "<DADOS>/catalog/raw".');
    } else if (a === '--hoje') {
      hoje = args[++i];
      if (!hoje || !dataValida(hoje)) morrer('Uso: --hoje precisa de uma data AAAA-MM-DD, ex.: --hoje 2026-08-24.');
    } else if (a.startsWith('--')) {
      morrer(`Opção desconhecida: ${a}. Uso: node scripts/indice.js <pasta refs> [--reconstruir] [--catalog <pasta>] [--procurar "<nome>"] [--hoje AAAA-MM-DD]`);
    } else if (pasta === null) {
      pasta = a;
    } else {
      morrer(`Argumento sobrando: ${a}. Uso: node scripts/indice.js <pasta refs> [--reconstruir] [--catalog <pasta>] [--procurar "<nome>"] [--hoje AAAA-MM-DD]`);
    }
  }

  if (!pasta) morrer('Uso: node scripts/indice.js <pasta refs> [--reconstruir] [--catalog <pasta>] [--procurar "<nome>"] [--hoje AAAA-MM-DD]');
  pasta = path.resolve(pasta);
  if (acao !== 'validar' && !fs.existsSync(pasta)) morrer(`Pasta não encontrada: ${pasta}`);
  if (fs.existsSync(pasta) && !fs.statSync(pasta).isDirectory()) morrer(`Não é uma pasta: ${pasta}`);

  // catalog/raw/ é irmã de refs/ dentro de DADOS; --catalog sobrescreve quando não é.
  const raizCatalogo = catalogo ? path.resolve(catalogo) : path.resolve(pasta, '..', 'catalog', 'raw');

  if (acao === 'reconstruir') return reconstruir(pasta, hoje, raizCatalogo);
  if (acao === 'procurar') return procurar(pasta, termo);
  return validar(pasta, hoje);
}

principal(process.argv);
