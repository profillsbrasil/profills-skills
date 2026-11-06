#!/usr/bin/env node
// mapa.js — mantém DADOS/CLAUDE.md, o arquivo que o Claude lê ao abrir a pasta de dados (Node >= 18, sem dependência).
// O arquivo tem três partes: o bloco fixo (regras e mapa das skills, copiado sempre de
// assets/claude-dados-template.md), o bloco do mapa (o estado da pasta, lido dos arquivos) e as
// "Notas da equipe", que ficam fora dos marcadores e nunca são reescritas. Sem CLAUDE.md, cria do
// template; com um CLAUDE.md sem marcadores, põe os dois blocos no topo e mantém o texto abaixo.
// Idempotente: no mesmo estado não grava nada, e a data "Estado em" só muda quando o mapa muda.
// Uso:     node scripts/mapa.js <DADOS> [--hoje AAAA-MM-DD]
// Exemplo: node scripts/mapa.js "$HOME/Profills LinkedIn"
//          → {"arquivo":".../CLAUDE.md","criado":false,"fixo_atualizado":false,"mapa_atualizado":true,"mapa":{...},"ok":true}
// Saída: JSON em stdout. Exit 0 = ok (problema no índice entra no mapa, não falha) · 1 = não deu
// para gravar ou os marcadores estão quebrados (campo erro) · 2 = erro de uso.

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

// O índice é da profills-radar: o mapa usa a validação dela em vez de reler o formato da linha.
const INDICE = path.join(__dirname, '..', '..', 'profills-radar', 'scripts', 'indice.js');
const TEMPLATE = path.join(__dirname, '..', 'assets', 'claude-dados-template.md');
const MARCAS = {
  fixo: ['<!-- profills:fixo:inicio -->', '<!-- profills:fixo:fim -->'],
  mapa: ['<!-- profills:mapa:inicio -->', '<!-- profills:mapa:fim -->'],
};
const RE_NOTAS = /^## Notas da equipe\s*$/m;
const RE_DATA_DO_MAPA = /^Estado em (\d{4}-\d{2}-\d{2})\./m;
const MAX_NA_LISTA = 8;

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

const lerTexto = (caminho) => fs.readFileSync(caminho, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
const pastas = (p) => (fs.existsSync(p) ? fs.readdirSync(p).filter((n) => fs.statSync(path.join(p, n)).isDirectory()) : []);
const arquivos = (p) => (fs.existsSync(p) ? fs.readdirSync(p).filter((n) => !n.startsWith('.') && fs.statSync(path.join(p, n)).isFile()) : []);

// ---------- o estado da pasta ----------

function lerVersao(dados) {
  const caminho = path.join(dados, '.profills.json');
  if (!fs.existsSync(caminho)) return { versao: 1, marcador: false };
  try {
    const v = JSON.parse(lerTexto(caminho)).versao_dados;
    return Number.isInteger(v) ? { versao: v, marcador: true } : { versao: null, marcador: true };
  } catch (e) {
    return { versao: null, marcador: true };
  }
}

function lerIndice(dados, hoje) {
  const r = spawnSync(process.execPath, [INDICE, path.join(dados, 'refs'), '--hoje', hoje], { encoding: 'utf8' });
  let v;
  try {
    v = JSON.parse(r.stdout);
  } catch (e) {
    return { existe: false, empresas: [], pesquisa_vencida: [], problemas: [{ tipo: 'indice_ilegivel', detalhe: `o indice.js da profills-radar não respondeu: ${(r.stderr || String(r.error || '')).trim().slice(0, 200)}` }] };
  }
  // Pasta sem refs/ ou sem INDEX.md e sem fichas é pasta que ainda não começou, não problema.
  const problemas = v.problemas.filter((p) => p.tipo !== 'pasta_ausente' && !(p.tipo === 'indice_ausente' && !v.fichas_orfas.length));
  return { existe: Boolean(v.indice_existe), empresas: v.empresas, pesquisa_vencida: v.pesquisa_vencida, problemas };
}

function contarPrioridades(empresas) {
  const contagem = {};
  for (const e of empresas) contagem[e.prioridade] = (contagem[e.prioridade] || 0) + 1;
  return contagem;
}

function ultimaColeta(dados) {
  const raiz = path.join(dados, 'catalog', 'raw');
  const porData = new Map();
  for (const slug of pastas(raiz)) {
    for (const data of pastas(path.join(raiz, slug)).filter(dataValida)) porData.set(data, (porData.get(data) || 0) + 1);
  }
  if (!porData.size) return null;
  const data = [...porData.keys()].sort().pop();
  return { data, empresas: porData.get(data) };
}

function ultimoArquivo(pasta, filtro = () => true) {
  const nomes = arquivos(pasta).filter(filtro).sort();
  return nomes.length ? { arquivo: nomes[nomes.length - 1], total: nomes.length } : null;
}

function lerVoz(dados) {
  const caminho = path.join(dados, 'voz.md');
  if (!fs.existsSync(caminho)) return { existe: false, atualizado_em: null };
  const m = lerTexto(caminho).split('\n').slice(0, 15).join('\n').match(/atualizado em (\d{4}-\d{2}-\d{2})/i);
  return { existe: true, atualizado_em: m ? m[1] : null };
}

// Seção vazia ou só com o comentário do template quer dizer que ninguém perguntou ao comercial ainda.
function doNotCopyVazio(dados) {
  const refs = path.join(dados, 'refs');
  return arquivos(refs)
    .filter((n) => n.endsWith('.md') && n !== 'INDEX.md')
    .sort()
    .filter((n) => {
      const m = lerTexto(path.join(refs, n)).match(/^## Do Not Copy\s*\n([\s\S]*?)(?=^## |(?![\s\S]))/m);
      return m && m[1].replace(/<!--[\s\S]*?-->/g, '').trim() === '';
    })
    .map((n) => n.replace(/\.md$/, ''));
}

function lerMapa(dados, hoje) {
  const versao = lerVersao(dados);
  const indice = lerIndice(dados, hoje);
  return {
    versao_dados: versao.versao,
    marcador: versao.marcador,
    indice_existe: indice.existe,
    empresas: {
      total: indice.empresas.length,
      por_prioridade: contarPrioridades(indice.empresas),
      sem_linkedin: indice.empresas.filter((e) => e.linkedin === false).length,
    },
    problemas_indice: indice.problemas.map(({ linha, slug, tipo, detalhe }) => ({ linha: linha ?? null, slug: slug ?? null, tipo, detalhe })),
    ultima_coleta: ultimaColeta(dados),
    ultimo_rascunho: ultimoArquivo(path.join(dados, 'drafts'), (n) => n.endsWith('.md')),
    ultimo_boletim: ultimoArquivo(path.join(dados, 'boletins')),
    voz: lerVoz(dados),
    pendencias: { do_not_copy_vazio: doNotCopyVazio(dados), pesquisa_vencida: indice.pesquisa_vencida },
  };
}

// ---------- o texto do bloco ----------

function lista(slugs) {
  const mostrados = slugs.slice(0, MAX_NA_LISTA).map((s) => `\`${s}\``).join(', ');
  return slugs.length > MAX_NA_LISTA ? `${mostrados} e mais ${slugs.length - MAX_NA_LISTA}` : mostrados;
}

function linhaVersao(m) {
  if (m.versao_dados === null) return '- Versão da pasta: o `.profills.json` está ilegível; a `profills-setup` conserta.';
  if (!m.marcador) return '- Versão da pasta: 1, sem `.profills.json`; a `profills-setup` atualiza a pasta.';
  return `- Versão da pasta: ${m.versao_dados}.`;
}

function linhasIndice(m) {
  const linhas = [];
  if (!m.indice_existe) linhas.push('- Empresas no índice: nenhuma ainda; a `profills-radar` cria a lista.');
  else {
    const prioridades = Object.entries(m.empresas.por_prioridade).map(([p, n]) => `${p}: ${n}`).join(', ');
    linhas.push(`- Empresas no índice: ${m.empresas.total}${prioridades ? ` (prioridade ${prioridades})` : ''}. Sem página no LinkedIn: ${m.empresas.sem_linkedin}.`);
  }
  if (!m.problemas_indice.length) {
    if (m.indice_existe) linhas.push('- Problemas no índice: nenhum.');
    return linhas;
  }
  linhas.push(`- Problemas no índice: ${m.problemas_indice.length}. Quem corrige é a \`profills-radar\`.`);
  for (const p of m.problemas_indice.slice(0, MAX_NA_LISTA)) {
    const onde = [p.linha ? `linha ${p.linha}` : null, p.slug ? `\`${p.slug}\`` : null].filter(Boolean).join(', ');
    linhas.push(`  - ${onde ? onde + ': ' : ''}${p.tipo}.`);
  }
  if (m.problemas_indice.length > MAX_NA_LISTA) linhas.push(`  - e mais ${m.problemas_indice.length - MAX_NA_LISTA}.`);
  return linhas;
}

function linhaVoz(v) {
  if (!v.existe) return '- Voz: `voz.md` não existe; a `profills-post` chama a `profills-voz` antes do primeiro post.';
  return v.atualizado_em ? `- Voz: \`voz.md\` atualizado em ${v.atualizado_em}.` : '- Voz: `voz.md` existe, sem data "atualizado em" no cabeçalho.';
}

function linhasPendencias(p) {
  const itens = [];
  if (p.do_not_copy_vazio.length) {
    itens.push(`  - "Do Not Copy" vazio em ${p.do_not_copy_vazio.length} ficha(s): ${lista(p.do_not_copy_vazio)}. A \`profills-garimpo\` pergunta ao fim do catálogo, e a \`profills-post\` antes de escrever.`);
  }
  if (p.pesquisa_vencida.length) {
    itens.push(`  - Pesquisa com mais de 60 dias em ${p.pesquisa_vencida.length} empresa(s): ${lista(p.pesquisa_vencida)}. A \`profills-radar\` atualiza.`);
  }
  return itens.length ? ['- Pendências:', ...itens] : ['- Pendências: nenhuma.'];
}

function corpoDoMapa(m, data) {
  const c = m.ultima_coleta;
  const r = m.ultimo_rascunho;
  const b = m.ultimo_boletim;
  return [
    '## Estado da pasta',
    '',
    `Estado em ${data}. Gerado pelo \`mapa.js\` a partir dos arquivos desta pasta; não edite à mão.`,
    '',
    linhaVersao(m),
    ...linhasIndice(m),
    c ? `- Última coleta: ${c.data}, com ${c.empresas} empresa(s).` : '- Última coleta: nenhuma ainda.',
    r ? `- Último rascunho: \`drafts/${r.arquivo}\` (${r.total} no total).` : '- Último rascunho: nenhum ainda.',
    ...(b ? [`- Último boletim: \`boletins/${b.arquivo}\`.`] : []),
    linhaVoz(m.voz),
    ...linhasPendencias(m.pendencias),
    '',
  ].join('\n');
}

// ---------- o arquivo ----------

function bloco(nome, corpo) {
  const [inicio, fim] = MARCAS[nome];
  return `${inicio}\n${corpo}${fim}`;
}

// Marcador só vale como linha inteira e antes de "## Notas da equipe": uma nota ou um texto do
// comercial que cita o marcador é texto, e o script não pode travar nem apagar nada por causa dele.
function linhasDoMarcador(texto, marca) {
  const notas = texto.search(RE_NOTAS);
  const limite = notas === -1 ? texto.length : notas;
  const achadas = [];
  for (let a = 0; a < limite; ) {
    const quebra = texto.indexOf('\n', a);
    const z = quebra === -1 ? texto.length : quebra;
    if (texto.slice(a, z).trim() === marca) achadas.push({ a, z });
    a = z + 1;
  }
  return achadas;
}

// Devolve onde o bloco está, null quando não tem nenhum marcador, ou o erro quando os marcadores não fecham um par.
function localizar(texto, nome) {
  const [inicio, fim] = MARCAS[nome];
  const is = linhasDoMarcador(texto, inicio);
  const fs_ = linhasDoMarcador(texto, fim);
  if (!is.length && !fs_.length) return null;
  if (is.length !== 1 || fs_.length !== 1 || fs_[0].a < is[0].z) {
    return { erro: `os marcadores "${inicio}" e "${fim}", cada um sozinho na linha e antes de "## Notas da equipe", não formam um par (achei ${is.length} de início e ${fs_.length} de fim); deixe um de cada, nesta ordem, e rode de novo` };
  }
  return { a: is[0].a, z: fs_[0].z, corpo: texto.slice(is[0].z + 1, fs_[0].a) };
}

function trocar(texto, lugar, novo) {
  return texto.slice(0, lugar.a) + novo + texto.slice(lugar.z);
}

function montar(atual, template, mapa, hoje) {
  const noTemplate = localizar(template, 'fixo');
  const fixoNovo = template.slice(noTemplate.a, noTemplate.z);
  const notasDoTemplate = template.slice(template.search(RE_NOTAS));

  let texto = atual;
  let fixo = localizar(texto, 'fixo');
  let lugarMapa = localizar(texto, 'mapa');
  for (const l of [fixo, lugarMapa]) if (l && l.erro) return { erro: l.erro };

  const fixoAntigo = fixo ? texto.slice(fixo.a, fixo.z) : null;
  const corpoAntigo = lugarMapa ? lugarMapa.corpo : null;
  const dataAntiga = corpoAntigo && (corpoAntigo.match(RE_DATA_DO_MAPA) || [])[1];
  // Renderizar com a data antiga e comparar diz se o estado mudou sem guardar nada fora do arquivo.
  const corpoNovo = dataAntiga && corpoDoMapa(mapa, dataAntiga) === corpoAntigo ? corpoAntigo : corpoDoMapa(mapa, hoje);
  const mapaNovo = bloco('mapa', corpoNovo);

  if (fixo) texto = trocar(texto, fixo, fixoNovo);
  lugarMapa = localizar(texto, 'mapa');
  if (lugarMapa) texto = trocar(texto, lugarMapa, mapaNovo);

  if (!fixo && !lugarMapa) texto = `${fixoNovo}\n\n${mapaNovo}\n\n${texto}`;
  else if (!fixo) texto = `${fixoNovo}\n\n${texto}`;
  else if (!lugarMapa) {
    fixo = localizar(texto, 'fixo');
    texto = `${texto.slice(0, fixo.z)}\n\n${mapaNovo}${texto.slice(fixo.z)}`;
  }

  if (!RE_NOTAS.test(texto)) texto = `${texto.replace(/\n*$/, '')}\n\n${notasDoTemplate}`;

  return {
    texto,
    fixo_atualizado: fixoAntigo !== fixoNovo,
    mapa_atualizado: corpoAntigo !== corpoNovo,
    estado_em: corpoNovo.match(RE_DATA_DO_MAPA)[1],
  };
}

// Escreve num temporário e renomeia: o arquivo fica inteiro antigo ou inteiro novo, nunca pela metade.
function escreverInteiro(caminho, conteudo) {
  const temporario = caminho + '.mapa-tmp';
  fs.writeFileSync(temporario, conteudo, 'utf8');
  fs.renameSync(temporario, caminho);
}

const MOTIVOS = {
  EACCES: 'falta permissão de escrita',
  EPERM: 'falta permissão de escrita',
  EROFS: 'o disco está só para leitura',
  ENOSPC: 'o disco está cheio',
  EBUSY: 'outro programa está com o arquivo aberto',
};

function explicar(e, caminho) {
  const motivo = MOTIVOS[e.code] ? `${MOTIVOS[e.code]} em "${path.dirname(caminho)}"` : e.message;
  return `Não deu para gravar "${caminho}": ${motivo}. O arquivo continua como estava; resolva isso e rode de novo.`;
}

// ---------- argumentos ----------

function principal(argv) {
  const args = argv.slice(2);
  let dados = null;
  let hoje = hojeISO();
  const uso = 'Uso: node scripts/mapa.js <DADOS> [--hoje AAAA-MM-DD]';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--hoje') {
      hoje = args[++i];
      if (!hoje || !dataValida(hoje)) morrer('Uso: --hoje precisa de uma data AAAA-MM-DD, ex.: --hoje 2026-11-06.');
    } else if (a.startsWith('--')) morrer(`Opção desconhecida: ${a}. ${uso}`);
    else if (dados === null) dados = a;
    else morrer(`Argumento sobrando: ${a}. ${uso}`);
  }
  if (!dados) morrer(uso);
  dados = path.resolve(dados);
  if (!fs.existsSync(dados) || !fs.statSync(dados).isDirectory()) morrer(`Pasta de dados não encontrada: ${dados}. A profills-setup cria a pasta antes.`);

  const arquivo = path.join(dados, 'CLAUDE.md');
  const mapa = lerMapa(dados, hoje);
  const saida = { arquivo, criado: false, fixo_atualizado: false, mapa_atualizado: false, mapa, ok: false };
  const terminar = () => {
    process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
    process.exit(saida.ok ? 0 : 1);
  };

  let bruto = null;
  try {
    if (fs.existsSync(arquivo)) bruto = fs.readFileSync(arquivo, 'utf8');
  } catch (e) {
    saida.erro = `Não deu para ler "${arquivo}": ${MOTIVOS[e.code] || e.message}.`;
    return terminar();
  }
  const template = lerTexto(TEMPLATE);
  const atual = bruto === null ? template : bruto.replace(/^﻿/, '').replace(/\r\n/g, '\n');
  const r = montar(atual, template, mapa, hoje);
  if (r.erro) {
    saida.erro = `O "${arquivo}" não foi mudado: ${r.erro}.`;
    return terminar();
  }

  // Arquivo salvo no Windows volta com a mesma quebra de linha e o mesmo BOM com que chegou.
  const comBom = bruto !== null && bruto.startsWith('﻿');
  const crlf = bruto !== null && bruto.includes('\r\n');
  const final = (comBom ? '﻿' : '') + (crlf ? r.texto.replace(/\n/g, '\r\n') : r.texto);

  saida.criado = bruto === null;
  saida.fixo_atualizado = !saida.criado && r.fixo_atualizado;
  saida.mapa_atualizado = r.mapa_atualizado;
  saida.mapa.estado_em = r.estado_em;
  if (final !== bruto) {
    try {
      escreverInteiro(arquivo, final);
    } catch (e) {
      saida.erro = explicar(e, arquivo);
      return terminar();
    }
  }
  saida.ok = true;
  terminar();
}

principal(process.argv);
