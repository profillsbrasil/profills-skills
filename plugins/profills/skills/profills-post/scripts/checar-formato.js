#!/usr/bin/env node
/*
 * checar-formato.js — o crivo mensurável do rascunho de LinkedIn.
 * Fonte única das contagens da profills-post: hook, tamanho do corpo, markdown,
 * link no corpo, parágrafo longo, palavras banidas, travessão e campos pendentes.
 * Uso: node scripts/checar-formato.js <arquivo-do-rascunho> [--voz <DADOS/voz.md>]
 * Aceita o .md salvo em drafts/ (o texto é tudo que vem depois da primeira linha
 * "---") ou um .txt solto (o arquivo inteiro é o texto).
 * Saída: JSON em stdout, com "falhas" (reprovam) e "avisos" (conversa com o usuário,
 * não reprovam). Exit 0 = ok:true · 1 = alguma checagem reprovou · 2 = erro de uso/arquivo.
 * Exemplo: {"ok":true,"falhas":[],"avisos":["corpo_curto: corpo com 1074 chars ..."],
 *           "hook_chars":68,"hook_cabe":true,"corpo_chars":1074, ...}
 * Os limites usados na conta voltam no campo "limites" — não os recopie em prosa.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const LIMITES = {
  hook_max: 210,
  corpo_min: 1200,
  corpo_max: 1600,
  corpo_teto: 2000,
  linha_max: 180,
};

function morrer(mensagem) {
  process.stderr.write(mensagem + '\n');
  process.exit(2);
}

function lerArgumentos(argv) {
  const args = argv.slice(2);
  let arquivo = null;
  let voz = null;
  for (let i = 0; i < args.length; i += 1) {
    const a = args[i];
    if (a === '--voz') {
      voz = args[i + 1];
      if (!voz) morrer('Faltou o caminho depois de --voz.');
      i += 1;
    } else if (a.startsWith('--')) {
      morrer(`Opção desconhecida: ${a}. Uso: node scripts/checar-formato.js <arquivo> [--voz <voz.md>]`);
    } else if (arquivo === null) {
      arquivo = a;
    } else {
      morrer('Passe um arquivo de rascunho só. Uso: node scripts/checar-formato.js <arquivo> [--voz <voz.md>]');
    }
  }
  if (!arquivo) morrer('Uso: node scripts/checar-formato.js <arquivo-do-rascunho> [--voz <DADOS/voz.md>]');
  return { arquivo, voz };
}

function lerArquivo(caminho, rotulo) {
  let conteudo;
  try {
    conteudo = fs.readFileSync(caminho, 'utf8');
  } catch (erro) {
    morrer(`Não consegui ler ${rotulo} em ${caminho}: ${erro.code === 'ENOENT' ? 'arquivo não existe' : erro.message}.`);
  }
  return conteudo.replace(/\r\n/g, '\n');
}

/*
 * Extrai o texto que vai para o feed, no formato prescrito no passo 8 da skill:
 * linhas de contexto, uma linha que é exatamente "---", e o texto do post até o
 * fim do arquivo. Sem nenhuma cerca "---" isolada, o arquivo inteiro é o texto.
 * Uma segunda cerca isolada no fim do arquivo é sobra de formatação e sai fora.
 */
function extrairTexto(conteudo) {
  const linhas = conteudo.split('\n');
  const primeiraCerca = linhas.findIndex((linha) => linha.trim() === '---');
  const corpo = primeiraCerca === -1 ? linhas.slice() : linhas.slice(primeiraCerca + 1);
  while (corpo.length && corpo[corpo.length - 1].trim() === '') corpo.pop();
  if (corpo.length && corpo[corpo.length - 1].trim() === '---') corpo.pop();
  return corpo.join('\n').trim();
}

// Hook = o primeiro parágrafo, ou seja, o texto até a primeira quebra dupla.
// É o que o leitor lê antes de decidir clicar em "ver mais".
// Post sem linha em branco (título na primeira linha, parágrafos colados) teria o
// texto inteiro como hook; nele o hook é a primeira linha.
function extrairHook(texto) {
  const paragrafos = texto.split(/\n[ \t]*\n/);
  const hook = paragrafos.length > 1 ? paragrafos[0] : texto.split('\n')[0];
  return hook.trim();
}

function acharMarkdown(texto) {
  const marcas = [];
  if (/\*\*[^*\n]+\*\*/.test(texto)) marcas.push('**negrito**');
  if (/^#{1,6}\s+\S/m.test(texto)) marcas.push('# título');
  if (/^\s*[-*]\s+\S/m.test(texto)) marcas.push('- item de lista');
  if (/\[[^\]\n]+\]\([^)\n]+\)/.test(texto)) marcas.push('[texto](url)');
  return marcas;
}

/*
 * Link no corpo. O padrão de domínio solto roda SEM a flag "i" de propósito:
 * "linha.Com" (ponto final seguido de palavra capitalizada) não é link, e casar
 * isso reprovaria rascunho correto. URL explícita e "www." continuam valendo
 * em qualquer caixa.
 */
function acharLinks(texto) {
  const padroes = [
    /https?:\/\/\S+/gi,
    /\bwww\.[a-z0-9-]+\.[a-z]{2,}\S*/gi,
    /\b[a-z0-9-]{2,}\.(?:com\.br|com|br|net|org|io|co|app|me|ai)\b(?:\/\S*)?/g,
  ];
  const achados = padroes.flatMap((padrao) =>
    [...texto.matchAll(padrao)].map((m) => ({ inicio: m.index, fim: m.index + m[0].length, texto: m[0] })),
  );
  // Um link casa com mais de um padrão (URL inteira e domínio solto dentro dela). A comparação é
  // pela posição no texto, não pela string: o mesmo domínio solto noutra frase é outro link.
  const dentroDeOutro = (a) =>
    achados.some((b) => b.inicio <= a.inicio && a.fim <= b.fim && b.fim - b.inicio > a.fim - a.inicio);
  const soltos = achados.filter((a) => !dentroDeOutro(a)).sort((a, b) => a.inicio - b.inicio);
  return [...new Set(soltos.map((a) => a.texto))];
}

// As linhas do hook ficam fora desta régua: quem as limita é o hook_max, que é maior.
function acharLinhasLongas(texto, linhasDoHook) {
  const longas = [];
  texto.split('\n').forEach((linha, i) => {
    if (i >= linhasDoHook && linha.trim().length > LIMITES.linha_max) {
      longas.push({ linha: i + 1, chars: linha.trim().length });
    }
  });
  return longas;
}

/*
 * Lê os termos de uma seção "## <titulo>" do voz.md. O título casa sem
 * olhar caixa e aceita texto depois ("## Palavras banidas (atualizada em ...)").
 * Item entre aspas → o que está entre aspas; item sem aspas → o texto antes
 * da data entre parênteses ou do travessão de explicação. Placeholder do
 * template (linha que começa com "<") é ignorado.
 * Devolve também se a seção existe: sem "Palavras banidas", nenhum termo foi
 * lido e o gate de banidas não está aprovado, só não medido.
 */
function lerSecaoDeTermos(linhas, titulo) {
  const cabecalho = new RegExp(`^##\\s+${titulo.split(/\s+/).join('\\s+')}\\b`, 'i');
  const termos = [];
  let dentro = false;
  let secaoEncontrada = false;
  for (const linha of linhas) {
    if (/^##\s+/.test(linha)) {
      dentro = cabecalho.test(linha.trim());
      if (dentro) secaoEncontrada = true;
      continue;
    }
    if (!dentro) continue;
    const item = linha.trim();
    if (!/^[-*]\s+/.test(item)) continue;
    let corpo = item.replace(/^[-*]\s+/, '').replace(/~~[^~]*~~/g, ' ').trim();
    if (corpo.startsWith('<')) continue;
    const aspas = corpo.match(/[«"“”'‘’]([^«»"“”'‘’\n]{2,})[»"“”'‘’]/g);
    if (aspas && aspas.length) {
      aspas.forEach((bruto) => {
        const termo = bruto.replace(/^[«"“”'‘’]|[»"“”'‘’]$/g, '').trim();
        if (termo) termos.push(termo);
      });
      continue;
    }
    corpo = corpo.split(/\s[—–]\s/)[0];
    corpo = corpo.replace(/\s*\([^)]*\)\s*$/, '').trim();
    if (corpo) termos.push(corpo);
  }
  return { termos, secaoEncontrada };
}

// "## Termos permitidos" guarda nomes de produto que contêm um termo banido
// ("gable top" com "top" banido): a ocorrência dentro deles não conta.
function lerTermosDaVoz(conteudoVoz) {
  const linhas = conteudoVoz.split('\n');
  const banidas = lerSecaoDeTermos(linhas, 'palavras banidas');
  return {
    banidos: banidas.termos,
    permitidos: lerSecaoDeTermos(linhas, 'termos permitidos').termos,
    secaoBanidasEncontrada: banidas.secaoEncontrada,
  };
}

function formasDoPlural(palavra) {
  const formas = [palavra];
  if (/ão$/.test(palavra)) formas.push(palavra.slice(0, -2) + 'ões', palavra.slice(0, -2) + 'ães', palavra + 's');
  else if (/m$/.test(palavra)) formas.push(palavra.slice(0, -1) + 'ns');
  else if (/el$/.test(palavra)) formas.push(palavra.slice(0, -1) + 'is', palavra.slice(0, -2) + 'éis');
  else if (/ol$/.test(palavra)) formas.push(palavra.slice(0, -1) + 'is', palavra.slice(0, -2) + 'óis');
  else if (/[au]l$/.test(palavra)) formas.push(palavra.slice(0, -1) + 'is');
  else if (/il$/.test(palavra)) formas.push(palavra.slice(0, -1) + 's');
  else if (/[rzs]$/.test(palavra)) formas.push(palavra + 'es');
  else formas.push(palavra + 's');
  return formas;
}

const escapar = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/*
 * Posições [início, fim) de cada ocorrência do termo como palavra inteira, com a
 * última palavra no singular ou num plural simples. Limite de palavra por
 * \p{L}\p{N} porque o \b do JS trata letra acentuada como separador.
 */
function ocorrencias(texto, termo) {
  const palavras = termo.normalize('NFC').toLowerCase().trim().split(/\s+/);
  const ultima = palavras.pop();
  const corpo = [...palavras.map(escapar), `(?:${formasDoPlural(ultima).map(escapar).join('|')})`].join('\\s+');
  const padrao = new RegExp(`(?<![\\p{L}\\p{N}])${corpo}(?![\\p{L}\\p{N}])`, 'giu');
  return [...texto.normalize('NFC').matchAll(padrao)].map((m) => [m.index, m.index + m[0].length]);
}

function acharBanidas(texto, banidos, permitidos) {
  const protegidas = permitidos.flatMap((termo) => ocorrencias(texto, termo));
  const livre = ([ini, fim]) => !protegidas.some(([pIni, pFim]) => pIni <= ini && fim <= pFim);
  return banidos.filter((termo) => termo.length >= 3 && ocorrencias(texto, termo).some(livre));
}

function acharCamposPendentes(texto) {
  const brutos = texto.match(/\[[^\]\n]{0,80}\]/g) || [];
  return brutos.filter((campo) => !/^\[\s*\]$/.test(campo));
}

function main() {
  const { arquivo, voz } = lerArgumentos(process.argv);
  const conteudo = lerArquivo(arquivo, 'o rascunho');
  const texto = extrairTexto(conteudo);
  if (!texto) morrer(`O arquivo ${arquivo} não tem texto de post — só cabeçalho ou está vazio.`);

  const avisos = [];
  let termosBanidos = [];
  let termosPermitidos = [];
  if (!/^\s*---\s*$/m.test(conteudo)) {
    avisos.push('sem_cerca: o arquivo não tem a linha "---" que separa contexto de texto — medi o arquivo inteiro como post; se há linhas de contexto no topo, elas entraram na conta.');
  }
  if (voz && !fs.existsSync(voz)) {
    avisos.push(`voz_nao_encontrada: ${voz} não existe — o gate de palavras banidas está NÃO MEDIDO, não aprovado.`);
  } else if (voz) {
    const lidas = lerTermosDaVoz(lerArquivo(voz, 'o arquivo de voz'));
    termosBanidos = lidas.banidos;
    termosPermitidos = lidas.permitidos;
    if (!lidas.secaoBanidasEncontrada) {
      avisos.push(
        `voz_sem_palavras_banidas: ${voz} não tem a seção "## Palavras banidas" — nenhum termo foi lido, ` +
          'então o gate de banidas está NÃO MEDIDO, não aprovado.'
      );
    }
  }

  const hook = extrairHook(texto);
  const hookChars = hook.length;
  const corpoChars = texto.length;
  const marcasMarkdown = acharMarkdown(texto);
  const links = acharLinks(texto);
  const linhasLongas = acharLinhasLongas(texto, hook.split('\n').length);
  const banidas = acharBanidas(texto, termosBanidos, termosPermitidos);
  const travessoes = (texto.match(/[—–]/g) || []).length;
  const campos = acharCamposPendentes(texto);

  const resultado = {
    arquivo: path.resolve(arquivo),
    voz: voz ? path.resolve(voz) : null,
    ok: false,
    falhas: [],
    avisos: [],
    hook_chars: hookChars,
    hook_cabe: hookChars <= LIMITES.hook_max,
    corpo_chars: corpoChars,
    corpo_na_faixa: corpoChars >= LIMITES.corpo_min && corpoChars <= LIMITES.corpo_max,
    corpo_curto: corpoChars < LIMITES.corpo_min,
    acima_de_2000: corpoChars > LIMITES.corpo_teto,
    tem_markdown: marcasMarkdown.length > 0,
    markdown_marcas: marcasMarkdown,
    link_no_corpo: links.length > 0,
    links: links,
    paragrafo_longo: linhasLongas.length > 0,
    linhas_longas: linhasLongas,
    palavras_banidas_encontradas: banidas,
    termos_banidos_lidos: termosBanidos.length,
    travessao: travessoes > 0,
    travessoes: travessoes,
    campos_pendentes: campos,
    limites: LIMITES,
  };

  const falhas = [];
  if (!resultado.hook_cabe) falhas.push(`hook com ${hookChars} chars, acima do corte de ${LIMITES.hook_max}`);
  // Corpo curto é aviso, não falha: molde curto (Enquete) é curto por desenho.
  if (resultado.corpo_curto) {
    avisos.push(
      `corpo_curto: corpo com ${corpoChars} chars, abaixo dos ${LIMITES.corpo_min} da faixa que costuma performar — ` +
        'não reprova; pergunte ao usuário se quer engordar ou se vai assim.'
    );
  } else if (corpoChars > LIMITES.corpo_max) {
    falhas.push(`corpo_chars ${corpoChars} acima do máximo de ${LIMITES.corpo_max}`);
  }
  if (resultado.acima_de_2000) falhas.push(`corpo_chars ${corpoChars} passa de ${LIMITES.corpo_teto}, onde o engajamento cai`);
  if (resultado.tem_markdown) falhas.push(`markdown no texto (${marcasMarkdown.join(', ')}) — o LinkedIn não renderiza`);
  if (resultado.link_no_corpo) falhas.push(`link no corpo (${links.join(', ')}) — vai para o comentário`);
  if (resultado.paragrafo_longo) {
    falhas.push(
      `${linhasLongas.length} parágrafo(s) acima de ${LIMITES.linha_max} chars sem quebra: linha(s) ${linhasLongas
        .map((l) => l.linha)
        .join(', ')}`
    );
  }
  if (banidas.length) falhas.push(`palavra banida do voz.md no texto: ${banidas.join(', ')}`);
  if (resultado.travessao) falhas.push(`${travessoes} travessão(ões) no corpo`);
  if (campos.length) falhas.push(`campo pendente: ${campos.join(', ')}`);

  resultado.falhas = falhas;
  resultado.avisos = avisos;
  resultado.ok = falhas.length === 0;

  process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
  process.exit(resultado.ok ? 0 : 1);
}

main();
