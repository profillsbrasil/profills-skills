#!/usr/bin/env node
/*
 * checar-formato.js — o crivo mensurável do rascunho de LinkedIn.
 * Fonte única das contagens da profills-post: hook, tamanho do corpo, markdown,
 * link no corpo, parágrafo longo, palavras banidas, travessão e campos pendentes.
 * Uso: node scripts/checar-formato.js <arquivo-do-rascunho> [--voz <DADOS/voz.md>]
 * Aceita o .md salvo em drafts/ (usa o texto entre os dois "---") ou um .txt solto.
 * Saída: JSON em stdout. Exit 0 = ok:true · 1 = alguma checagem reprovou · 2 = erro de uso/arquivo.
 * Exemplo: {"ok":false,"falhas":["corpo_chars 811 abaixo do mínimo de 1200"],
 *           "hook_chars":68,"hook_cabe":true,"corpo_chars":811,"corpo_na_faixa":false, ...}
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
 * Extrai o texto que vai para o feed:
 * 1. arquivo com duas linhas "---" (o formato de drafts/) → o que está entre elas;
 * 2. senão, descarta o cabeçalho de contexto do topo (linhas "Tema: ...", "> ...") e usa o resto.
 */
function extrairTexto(conteudo) {
  const linhas = conteudo.split('\n');
  const cercas = [];
  linhas.forEach((linha, i) => {
    if (linha.trim() === '---') cercas.push(i);
  });
  if (cercas.length >= 2) {
    return linhas.slice(cercas[0] + 1, cercas[1]).join('\n').trim();
  }
  let inicio = 0;
  while (inicio < linhas.length) {
    const l = linhas[inicio].trim();
    if (l === '' || l.startsWith('>') || /^(tema|ângulo|angulo|inspirado em|salvo em|origem)\s*:/i.test(l)) {
      inicio += 1;
    } else {
      break;
    }
  }
  return linhas.slice(inicio).join('\n').trim();
}

// Hook = o que aparece antes do corte "ver mais": até a primeira quebra dupla
// ou o fim da primeira linha, o que vier antes.
function extrairHook(texto) {
  const ateQuebraDupla = texto.split('\n\n')[0];
  const primeiraLinha = texto.split('\n')[0];
  return (primeiraLinha.length <= ateQuebraDupla.length ? primeiraLinha : ateQuebraDupla).trim();
}

function acharMarkdown(texto) {
  const marcas = [];
  if (/\*\*[^*\n]+\*\*/.test(texto)) marcas.push('**negrito**');
  if (/^#{1,6}\s+\S/m.test(texto)) marcas.push('# título');
  if (/^\s*[-*]\s+\S/m.test(texto)) marcas.push('- item de lista');
  if (/\[[^\]\n]+\]\([^)\n]+\)/.test(texto)) marcas.push('[texto](url)');
  return marcas;
}

function acharLinks(texto) {
  const achados = new Set();
  const padroes = [
    /https?:\/\/\S+/gi,
    /\bwww\.[a-z0-9-]+\.[a-z]{2,}\S*/gi,
    /\b[a-z0-9-]{2,}\.(?:com\.br|com|br|net|org|io|co|app|me|ai)\b(?:\/\S*)?/gi,
  ];
  for (const padrao of padroes) {
    const m = texto.match(padrao);
    if (m) m.forEach((achado) => achados.add(achado));
  }
  // Um link casa com mais de um padrão (URL inteira e domínio solto): fica só o achado mais longo.
  const lista = [...achados];
  return lista.filter((a) => !lista.some((b) => b !== a && b.includes(a)));
}

function acharLinhasLongas(texto) {
  const longas = [];
  texto.split('\n').forEach((linha, i) => {
    if (linha.trim().length > LIMITES.linha_max) {
      longas.push({ linha: i + 1, chars: linha.trim().length });
    }
  });
  return longas;
}

/*
 * Lê os termos da seção "## Palavras banidas" do voz.md.
 * Item entre aspas → o que está entre aspas; item sem aspas → o texto antes
 * da data entre parênteses ou do travessão de explicação. Placeholder do
 * template (linha que começa com "<") é ignorado.
 */
function lerPalavrasBanidas(conteudoVoz) {
  const linhas = conteudoVoz.split('\n');
  const termos = [];
  let dentro = false;
  for (const linha of linhas) {
    if (/^##\s+/.test(linha)) {
      dentro = /^##\s+palavras\s+banidas\s*$/i.test(linha.trim());
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
  return termos;
}

function acharBanidas(texto, termos) {
  const alvo = texto.toLowerCase();
  const achadas = [];
  for (const termo of termos) {
    if (termo.length >= 3 && alvo.includes(termo.toLowerCase())) achadas.push(termo);
  }
  return achadas;
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

  let termosBanidos = [];
  if (voz) termosBanidos = lerPalavrasBanidas(lerArquivo(voz, 'o arquivo de voz'));

  const hook = extrairHook(texto);
  const hookChars = hook.length;
  const corpoChars = texto.length;
  const marcasMarkdown = acharMarkdown(texto);
  const links = acharLinks(texto);
  const linhasLongas = acharLinhasLongas(texto);
  const banidas = acharBanidas(texto, termosBanidos);
  const travessoes = (texto.match(/[—–]/g) || []).length;
  const campos = acharCamposPendentes(texto);

  const resultado = {
    arquivo: path.resolve(arquivo),
    voz: voz ? path.resolve(voz) : null,
    ok: false,
    falhas: [],
    hook_chars: hookChars,
    hook_cabe: hookChars <= LIMITES.hook_max,
    corpo_chars: corpoChars,
    corpo_na_faixa: corpoChars >= LIMITES.corpo_min && corpoChars <= LIMITES.corpo_max,
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
  if (!resultado.corpo_na_faixa) {
    falhas.push(
      corpoChars < LIMITES.corpo_min
        ? `corpo_chars ${corpoChars} abaixo do mínimo de ${LIMITES.corpo_min}`
        : `corpo_chars ${corpoChars} acima do máximo de ${LIMITES.corpo_max}`
    );
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
  resultado.ok = falhas.length === 0;

  process.stdout.write(JSON.stringify(resultado, null, 2) + '\n');
  process.exit(resultado.ok ? 0 : 1);
}

main();
