#!/usr/bin/env node
// migrar.js — atualiza a pasta de dados DADOS para a versão atual (Node >= 18, sem dependência).
// Sem --aplicar só simula e lista as ações. Com --aplicar copia para DADOS/.backup/<hoje>/ cada
// arquivo que vai reescrever, cria as subpastas que faltam, converte as linhas antigas do
// refs/INDEX.md, converte STATUS.txt legado em meta.json e grava DADOS/.profills.json por último.
// Idempotente: rodar de novo depois de terminar devolve acoes [] e não muda nenhum byte; rodar de
// novo depois de cair no meio termina o que faltou.
// Uso:     node scripts/migrar.js <DADOS> [--aplicar] [--hoje AAAA-MM-DD]
// Exemplo: node scripts/migrar.js "$HOME/Profills LinkedIn"
//          → {"dados":"...","versao_atual":1,"versao_alvo":2,"acoes":[{"tipo":"converter_indice",...}],"ok":true}
// Saída: JSON em stdout. Exit 0 = ok · 1 = alguma linha não deu para converter ou a gravação parou
// no meio (campo erro) · 2 = erro de uso.

const fs = require('fs');
const path = require('path');

// O formato da linha do índice é da profills-radar; a migração usa o mesmo parser e o mesmo escritor.
const indice = require(path.join(__dirname, '..', '..', 'profills-radar', 'scripts', 'indice.js'));

const VERSAO_ALVO = 2;
const MARCADOR = '.profills.json';
const SUBPASTAS = ['refs', path.join('catalog', 'raw'), 'drafts', 'boletins'];

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

function lerVersao(dados) {
  const caminho = path.join(dados, MARCADOR);
  if (!fs.existsSync(caminho)) return { versao: 1, existe: false };
  try {
    // O Set-Content do PowerShell 5 grava UTF-8 com BOM, e o JSON.parse não aceita o BOM.
    const v = JSON.parse(fs.readFileSync(caminho, 'utf8').replace(/^﻿/, '')).versao_dados;
    return Number.isInteger(v) ? { versao: v, existe: true } : { versao: 1, existe: true, ilegivel: true };
  } catch (e) {
    return { versao: 1, existe: true, ilegivel: true };
  }
}

// ---------- o que muda ----------

function converterLinhaAntiga(texto, numero) {
  const cabeca = indice.cabecaDaLinha(texto);
  const antiga = indice.parsearCaudaAntiga(cabeca.resto);
  const problemas = antiga.problemas.map((p) => ({ linha: numero, trecho: texto.slice(0, 120), ...p }));

  // Linha sem página no LinkedIn chegava com `—` ou vazio no lugar do slug: o slug vira o nome da ficha.
  const semPagina = cabeca.slug === '' || cabeca.slug === '—';
  const slug = semPagina ? cabeca.arquivo.replace(/\.md$/, '') : cabeca.slug;
  if (!indice.SLUG_VALIDO.test(slug)) {
    problemas.push({ linha: numero, trecho: texto.slice(0, 120), tipo: 'slug_invalido', detalhe: `o slug "${slug}" tem caractere fora de letras, números, "-" e "_"` });
  }
  if (problemas.length) return { problemas };

  return {
    problemas,
    linha: indice.formatarLinha({
      nome: cabeca.nome,
      slug,
      id: antiga.id,
      setor: antiga.setor,
      pais: antiga.pais,
      prioridade: 'a definir',
      linkedin: !semPagina,
      pesquisa: antiga.pesquisa,
      catalogo: antiga.catalogo,
      grupo: null,
      alerta: antiga.alerta,
    }),
  };
}

// O índice que fica no disco passa inteiro pelo parser da versão 2: qualquer linha de lista que ele
// recusa trava a migração, em vez de passar calada e aparecer depois na radar.
function problemasDaVersao2(linhas) {
  const problemas = [];
  const vistos = new Map();
  linhas.forEach((texto, i) => {
    if (!indice.RE_ITEM.test(texto)) return;
    const r = indice.parsearLinha(texto, i + 1);
    const onde = { linha: i + 1, trecho: texto.slice(0, 120) };
    if (r.erro) {
      problemas.push({ ...onde, tipo: r.erro, detalhe: 'o começo da linha não segue "- [Nome](<slug>.md) — `<slug>` · …": confira se o nome tem colchete, se o arquivo está entre parênteses e se o slug está entre crases' });
      return;
    }
    problemas.push(...r.problemas.map((p) => ({ ...onde, ...p })));
    const slug = r.empresa.slug;
    if (vistos.has(slug)) {
      problemas.push({ ...onde, tipo: 'slug_duplicado', detalhe: `o endereço "${slug}" já aparece na linha ${vistos.get(slug)}: duas linhas para a mesma empresa` });
    } else {
      vistos.set(slug, i + 1);
    }
  });
  return problemas;
}

function planejarIndice(dados) {
  const caminho = path.join(dados, 'refs', 'INDEX.md');
  if (!fs.existsSync(caminho)) return { acoes: [], problemas: [] };
  // O BOM do Bloco de Notas esconderia a primeira linha do RE_ITEM; o arquivo novo sai sem ele.
  const original = fs.readFileSync(caminho, 'utf8').replace(/^\uFEFF/, '');
  const quebra = original.includes('\r\n') ? '\r\n' : '\n';
  const linhas = original.split(quebra);
  const problemas = [];
  let convertidas = 0;

  const novas = linhas.map((texto, i) => {
    if (!indice.RE_ITEM.test(texto)) return texto;
    const lida = indice.parsearLinha(texto, i + 1);
    if (lida.erro || lida.empresa.formato !== 1) return texto;
    const r = converterLinhaAntiga(texto, i + 1);
    if (r.problemas.length) {
      problemas.push(...r.problemas);
      return texto;
    }
    convertidas++;
    return r.linha;
  });

  // Tudo ou nada: índice meio convertido confundiria a radar mais que índice todo antigo.
  if (!problemas.length) problemas.push(...problemasDaVersao2(novas));
  if (problemas.length || !convertidas) return { acoes: [], problemas };
  return {
    acoes: [{ tipo: 'converter_indice', alvo: path.join('refs', 'INDEX.md'), detalhe: `${convertidas} linha(s) passam para o formato novo, com prioridade "a definir"`, conteudo: novas.join(quebra), backup: true }],
    problemas,
  };
}

// STATUS.txt era a nota solta das coletas sem post, antes do meta.json (aposentado em 2026-08).
function metaDoStatus(slug, data, texto, pastaDia) {
  const t = texto.trim();
  const maiusculo = t.toUpperCase();
  let status = 'sem_posts';
  if (/N[ÃA]O GERENCIADA|AUTO-GERADA/.test(maiusculo)) status = 'pagina_nao_gerenciada';
  else if (/ERRO|FALHOU|INTERROMPID/.test(maiusculo)) status = 'erro_navegacao';
  const seguidores = t.match(/(\d[\d.]*)\s+seguidores/i);
  let postsColetados = 0;
  try {
    const posts = JSON.parse(fs.readFileSync(path.join(pastaDia, 'posts.json'), 'utf8'));
    if (Array.isArray(posts)) postsColetados = posts.length;
  } catch (e) {
    postsColetados = 0;
  }
  const nota = t.replace(/^[A-ZÀ-Ú ]+:\s*/, '');
  return {
    slug,
    coletado_em: data,
    seguidores: seguidores ? Number(seguidores[1].replace(/\./g, '')) : null,
    janela_dias: 7,
    posts_coletados: postsColetados,
    status,
    nota: nota.charAt(0).toUpperCase() + nota.slice(1),
  };
}

function planejarStatus(dados) {
  const raiz = path.join(dados, 'catalog', 'raw');
  const acoes = [];
  if (!fs.existsSync(raiz)) return acoes;
  for (const slug of fs.readdirSync(raiz).sort()) {
    const pastaEmpresa = path.join(raiz, slug);
    if (!fs.statSync(pastaEmpresa).isDirectory()) continue;
    for (const data of fs.readdirSync(pastaEmpresa).sort()) {
      const dia = path.join(pastaEmpresa, data);
      if (!dataValida(data) || !fs.statSync(dia).isDirectory()) continue;
      const status = path.join(dia, 'STATUS.txt');
      if (!fs.existsSync(status) || fs.existsSync(path.join(dia, 'meta.json'))) continue;
      const meta = metaDoStatus(slug, data, fs.readFileSync(status, 'utf8'), dia);
      acoes.push({
        tipo: 'converter_status',
        alvo: path.join('catalog', 'raw', slug, data, 'meta.json'),
        detalhe: `STATUS.txt vira meta.json com status "${meta.status}"; o STATUS.txt fica onde está`,
        conteudo: JSON.stringify(meta, null, 2) + '\n',
        backup: false,
      });
    }
  }
  return acoes;
}

function planejar(dados, hoje) {
  const versao = lerVersao(dados);
  const saida = { versao_atual: versao.versao, acoes: [], problemas: [] };
  if (versao.versao > VERSAO_ALVO) {
    saida.problemas.push({ tipo: 'pasta_mais_nova', detalhe: `a pasta está na versão ${versao.versao} e estas skills só conhecem até a ${VERSAO_ALVO}: atualize o plugin antes` });
    return saida;
  }

  for (const sub of SUBPASTAS) {
    if (!fs.existsSync(path.join(dados, sub))) saida.acoes.push({ tipo: 'criar_pasta', alvo: sub, detalhe: 'pasta que faltava' });
  }
  const doIndice = planejarIndice(dados);
  saida.acoes.push(...doIndice.acoes);
  saida.problemas.push(...doIndice.problemas);
  saida.acoes.push(...planejarStatus(dados));

  // O marcador vai por último e só sem problema: pasta marcada como nova tem de estar nova.
  if (!saida.problemas.length && (versao.versao < VERSAO_ALVO || versao.ilegivel)) {
    saida.acoes.push({
      tipo: 'gravar_marcador',
      alvo: MARCADOR,
      detalhe: `marca a pasta como versão ${VERSAO_ALVO}`,
      conteudo: JSON.stringify({ versao_dados: VERSAO_ALVO, atualizado_em: hoje }, null, 2) + '\n',
      backup: versao.existe,
    });
  }
  return saida;
}

// ---------- aplicar ----------

function copiarParaBackup(dados, pastaBackup, alvo) {
  const origem = path.join(dados, alvo);
  const destino = path.join(pastaBackup, alvo);
  // A cópia que já existe é a mais antiga do dia: numa segunda tentativa, o arquivo de agora pode já ser o novo.
  if (fs.existsSync(destino) || !fs.existsSync(origem)) return;
  fs.mkdirSync(path.dirname(destino), { recursive: true });
  fs.copyFileSync(origem, destino);
}

// Escreve num temporário e renomeia: o arquivo fica inteiro antigo ou inteiro novo, nunca pela metade.
function escreverInteiro(caminho, conteudo) {
  fs.mkdirSync(path.dirname(caminho), { recursive: true });
  const temporario = caminho + '.migrar-tmp';
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

// Devolve null quando tudo foi gravado, ou a frase que explica onde e por que parou.
function aplicar(dados, acoes, pastaBackup) {
  for (const a of acoes) {
    try {
      if (a.tipo === 'criar_pasta') {
        fs.mkdirSync(path.join(dados, a.alvo), { recursive: true });
        continue;
      }
      if (a.backup) copiarParaBackup(dados, pastaBackup, a.alvo);
      escreverInteiro(path.join(dados, a.alvo), a.conteudo);
    } catch (e) {
      const motivo = MOTIVOS[e.code] ? `${MOTIVOS[e.code]} em "${e.path ? path.dirname(e.path) : dados}"` : e.message;
      return `Não deu para gravar "${path.join(dados, a.alvo)}": ${motivo}. O que já foi gravado continua certo e a pasta não foi marcada como nova; resolva isso e rode de novo com --aplicar, que a migração termina o que faltou.`;
    }
  }
  return null;
}

// ---------- argumentos ----------

function principal(argv) {
  const args = argv.slice(2);
  let dados = null;
  let aplicarAgora = false;
  let hoje = hojeISO();
  const uso = 'Uso: node scripts/migrar.js <DADOS> [--aplicar] [--hoje AAAA-MM-DD]';

  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === '--aplicar') aplicarAgora = true;
    else if (a === '--hoje') {
      hoje = args[++i];
      if (!hoje || !dataValida(hoje)) morrer('Uso: --hoje precisa de uma data AAAA-MM-DD, ex.: --hoje 2026-11-06.');
    } else if (a.startsWith('--')) morrer(`Opção desconhecida: ${a}. ${uso}`);
    else if (dados === null) dados = a;
    else morrer(`Argumento sobrando: ${a}. ${uso}`);
  }
  if (!dados) morrer(uso);
  dados = path.resolve(dados);
  if (fs.existsSync(dados) && !fs.statSync(dados).isDirectory()) morrer(`Não é uma pasta: ${dados}`);

  const plano = planejar(dados, hoje);
  const pastaBackup = path.join(dados, '.backup', hoje);
  const temBackup = plano.acoes.some((a) => a.backup);
  // Com problema, nada é gravado: nem as pastas que faltam, para a pasta não mudar pela metade.
  const aplicavel = aplicarAgora && plano.acoes.length > 0 && plano.problemas.length === 0;
  const erro = aplicavel ? aplicar(dados, plano.acoes, pastaBackup) : null;
  const ok = plano.problemas.length === 0 && !erro;

  const saida = {
    dados,
    versao_atual: plano.versao_atual,
    versao_alvo: VERSAO_ALVO,
    aplicado: aplicavel && !erro,
    backup: temBackup ? pastaBackup : null,
    acoes: plano.acoes.map(({ tipo, alvo, detalhe }) => ({ tipo, alvo, detalhe })),
    problemas: plano.problemas,
    ...(erro ? { erro } : {}),
    ok,
  };
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}

principal(process.argv);
