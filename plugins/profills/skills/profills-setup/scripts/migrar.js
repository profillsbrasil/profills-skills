#!/usr/bin/env node
// migrar.js — atualiza a pasta de dados DADOS para a versão atual (Node >= 18, sem dependência).
// Sem --aplicar só simula e lista as ações. Com --aplicar copia para DADOS/.backup/<hoje>/ cada
// arquivo que vai reescrever, cria as subpastas que faltam, move cada catalog/raw/<slug>/ para
// catalog/raw/linkedin/<slug>/ (anotando o movimento em .backup/<hoje>/movidos.jsonl), converte as
// linhas antigas do refs/INDEX.md (e tira delas o campo catálogo, que agora sai das coletas), converte
// STATUS.txt legado em meta.json, escreve "concluida": true no meta.json que ainda não tem o campo, põe o
// banco derivado (indice.db) no .gitignore da pasta quando ela tem um e grava DADOS/.profills.json por
// último. Uma execução leva a pasta da versão 1 ou 2 até a 3. Cada ação sai do que está no disco: rodar de novo depois de terminar
// devolve acoes [] e não muda nenhum byte; rodar de novo depois de cair no meio termina o que faltou.
// Para desfazer um movimento, leia movidos.jsonl de baixo para cima e mova cada "para" de volta a "de".
// Uso:     node scripts/migrar.js <DADOS> [--aplicar] [--hoje AAAA-MM-DD]
// Exemplo: node scripts/migrar.js "$HOME/Profills LinkedIn"
//          → {"dados":"...","versao_atual":1,"versao_alvo":2,"acoes":[{"tipo":"converter_indice",...}],"ok":true}
// Saída: JSON em stdout. Exit 0 = ok · 1 = alguma linha ou pasta não deu para converter ou a gravação
// parou no meio (campo erro) · 2 = erro de uso. avisos[] não impede a migração.

const fs = require('fs');
const path = require('path');

// O formato da linha do índice é da profills-radar; a migração usa o mesmo parser e o mesmo escritor.
const indice = require(path.join(__dirname, '..', '..', 'profills-radar', 'scripts', 'indice.js'));

const VERSAO_ALVO = 3;
const MARCADOR = '.profills.json';
const RAW = path.join('catalog', 'raw');
// Desde a versão 3 a rede é o primeiro nível de catalog/raw/: <rede>/<conta>/<AAAA-MM-DD>/.
// A conta é o slug da página no LinkedIn e o handle no Instagram.
const REDES = ['linkedin', 'instagram'];
const SUBPASTAS = ['refs', path.join(RAW, 'linkedin'), 'drafts', 'boletins'];
// O banco.js do plugin refaz DADOS/indice.db dos arquivos a qualquer hora: ele e os arquivos do WAL não vão para o git.
const IGNORAR_BANCO = ['indice.db', 'indice.db-wal', 'indice.db-shm'];

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
      grupo: null,
      alerta: antiga.alerta,
    }),
  };
}

// Linha da versão 2 sem outro problema ganha o campo instagram logo depois do linkedin, quando não o tem,
// e perde o campo catálogo: o resto da linha fica byte a byte. O catálogo é procurado só antes do ⚠, que
// leva o resto da linha e pode citar a palavra. Linha da versão 2 com problema fica como está, e o problema trava.
function converterLinhaV2(texto, numero, lida) {
  const problemas = lida.problemas.filter((p) => p.tipo !== 'formato_antigo').map((p) => ({ linha: numero, trecho: texto.slice(0, 120), ...p }));
  if (problemas.length) return { problemas };
  const corte = texto.indexOf(' · ⚠');
  const [campos, alerta] = corte >= 0 ? [texto.slice(0, corte), texto.slice(corte)] : [texto, ''];
  const semCatalogo = campos.replace(/ · (?:sem catálogo|catálogo [^·]*?)(?= · |$)/, '');
  const comInstagram = / · instagram /.test(semCatalogo) ? semCatalogo : semCatalogo.replace(/( · linkedin (?:sim|não))( · |$)/, '$1 · instagram —$2');
  return { problemas, linha: comInstagram + alerta };
}

// O índice que fica no disco passa inteiro pelo parser da versão atual: qualquer linha de lista que ele
// recusa trava a migração, em vez de passar calada e aparecer depois na radar.
function problemasDoFormatoAtual(linhas) {
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
    if (lida.erro || lida.empresa.formato === 3) return texto;
    const r = lida.empresa.formato === 1 ? converterLinhaAntiga(texto, i + 1) : converterLinhaV2(texto, i + 1, lida);
    if (r.problemas.length) {
      problemas.push(...r.problemas);
      return texto;
    }
    convertidas++;
    return r.linha;
  });

  // Tudo ou nada: índice meio convertido confundiria a radar mais que índice todo antigo.
  if (!problemas.length) problemas.push(...problemasDoFormatoAtual(novas));
  if (problemas.length || !convertidas) return { acoes: [], problemas };
  return {
    acoes: [
      {
        tipo: 'converter_indice',
        alvo: path.join('refs', 'INDEX.md'),
        detalhe: `${convertidas} linha(s) passam para o formato novo: com o campo instagram (vazio onde faltava), sem o campo catálogo (a data sai das coletas) e com prioridade "a definir" na linha que ainda não tinha prioridade`,
        conteudo: novas.join(quebra),
        backup: true,
      },
    ],
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
    concluida: true,
  };
}

const ehPasta = (p) => fs.existsSync(p) && fs.statSync(p).isDirectory();
const datasEm = (pasta) => fs.readdirSync(pasta).filter((d) => dataValida(d) && ehPasta(path.join(pasta, d))).sort();

// Na versão 2, cada catalog/raw/<slug>/ com pastas de data é uma empresa do LinkedIn: ela vai para
// catalog/raw/linkedin/<slug>/. Uma pasta de rede com data logo dentro é empresa cujo slug é o nome da rede.
function planejarMovimentos(dados) {
  const raiz = path.join(dados, RAW);
  const acoes = [];
  const problemas = [];
  if (!ehPasta(raiz)) return { acoes, problemas };
  for (const nome of fs.readdirSync(raiz).sort()) {
    const pasta = path.join(raiz, nome);
    if (!ehPasta(pasta) || !datasEm(pasta).length) continue;
    if (REDES.includes(nome)) {
      problemas.push({
        tipo: 'slug_reservado',
        alvo: path.join(RAW, nome),
        detalhe: `"${path.join(RAW, nome)}" tem coletas com data logo dentro: é a empresa de endereço "${nome}", e na versão nova esse é o nome da pasta da rede. Mova as pastas de data dela para "${path.join(RAW, nome, nome)}" e rode de novo`,
      });
      continue;
    }
    const alvo = path.join(RAW, 'linkedin', nome);
    if (fs.existsSync(path.join(dados, alvo))) {
      problemas.push({ tipo: 'destino_existe', alvo, detalhe: `a empresa "${nome}" tem coletas em "${path.join(RAW, nome)}" e em "${alvo}": junte as pastas de data dela em "${alvo}" e rode de novo` });
    } else {
      acoes.push({ tipo: 'mover_coleta', de: path.join(RAW, nome), alvo, detalhe: `as coletas de "${nome}" vão para a pasta do LinkedIn`, backup: false });
    }
  }
  return { acoes, problemas };
}

// Cada coleta do disco, onde ela está agora (no caminho antigo ou já no da rede) e onde fica na versão 3.
function coletasDoDisco(dados) {
  const raiz = path.join(dados, RAW);
  if (!ehPasta(raiz)) return [];
  const contas = [];
  for (const nome of fs.readdirSync(raiz).sort()) {
    const pasta = path.join(raiz, nome);
    if (!ehPasta(pasta)) continue;
    if (!REDES.includes(nome)) {
      contas.push({ conta: nome, pasta, rede: 'linkedin' });
      continue;
    }
    // Pasta de rede com data logo dentro é o slug_reservado: as datas não são contas.
    for (const conta of fs.readdirSync(pasta).sort()) {
      if (!dataValida(conta) && ehPasta(path.join(pasta, conta))) contas.push({ conta, pasta: path.join(pasta, conta), rede: nome });
    }
  }
  return contas.flatMap(({ conta, pasta, rede }) => datasEm(pasta).map((data) => ({ conta, data, agora: path.join(pasta, data), alvo: path.join(RAW, rede, conta, data) })));
}

// meta.json da versão 2 não diz se a coleta terminou; ele só existia no fim dela, então ganha "concluida": true.
// Coleta sem meta.json nem STATUS.txt (as de 2026-07) fica sem: o boletim.js a lê do jeito de sempre.
function planejarMetas(dados) {
  const acoes = [];
  const avisos = [];
  for (const c of coletasDoDisco(dados)) {
    const meta = path.join(c.agora, 'meta.json');
    const status = path.join(c.agora, 'STATUS.txt');
    const alvo = path.join(c.alvo, 'meta.json');
    if (!fs.existsSync(meta)) {
      if (!fs.existsSync(status)) continue;
      const novo = metaDoStatus(c.conta, c.data, fs.readFileSync(status, 'utf8'), c.agora);
      acoes.push({ tipo: 'converter_status', alvo, detalhe: `STATUS.txt vira meta.json com status "${novo.status}"; o STATUS.txt fica onde está`, conteudo: JSON.stringify(novo, null, 2) + '\n', backup: false });
      continue;
    }
    let lido;
    try {
      lido = JSON.parse(fs.readFileSync(meta, 'utf8').replace(/^\uFEFF/, ''));
    } catch (e) {
      lido = null;
    }
    if (!lido || typeof lido !== 'object' || Array.isArray(lido)) {
      avisos.push({ tipo: 'meta_ilegivel', alvo, detalhe: 'o meta.json desta coleta não é um objeto JSON legível: fica como está, e o boletim mostra a coleta com erro' });
      continue;
    }
    if (!('concluida' in lido)) {
      acoes.push({ tipo: 'marcar_concluida', alvo, detalhe: 'o meta.json ganha "concluida": true', conteudo: JSON.stringify({ ...lido, concluida: true }, null, 2) + '\n', backup: true });
    }
  }
  return { acoes, avisos };
}

// Só a pasta que tem .gitignore está num repo git (o caso do repo-fonte); fora de um, não há o que ignorar.
function planejarGitignore(dados) {
  const caminho = path.join(dados, '.gitignore');
  if (!fs.existsSync(caminho)) return [];
  const original = fs.readFileSync(caminho, 'utf8');
  const quebra = original.includes('\r\n') ? '\r\n' : '\n';
  const presentes = new Set(original.split(/\r?\n/).map((l) => l.trim()));
  const faltam = IGNORAR_BANCO.filter((l) => !presentes.has(l));
  if (!faltam.length) return [];
  const bloco = ['# Banco derivado das coletas (banco.js do plugin): refeito dos arquivos a qualquer hora', ...faltam].join(quebra);
  // Uma linha em branco separa o bloco novo do que já estava.
  const separador = original === '' ? '' : original.endsWith(quebra) ? quebra : quebra + quebra;
  return [{ tipo: 'ignorar_banco', alvo: '.gitignore', detalhe: `o .gitignore passa a ignorar ${faltam.join(', ')}`, conteudo: original + separador + bloco + quebra, backup: true }];
}

function planejar(dados, hoje) {
  const versao = lerVersao(dados);
  const saida = { versao_atual: versao.versao, acoes: [], problemas: [], avisos: [] };
  if (versao.versao > VERSAO_ALVO) {
    saida.problemas.push({ tipo: 'pasta_mais_nova', detalhe: `a pasta está na versão ${versao.versao} e estas skills só conhecem até a ${VERSAO_ALVO}: atualize o plugin antes` });
    return saida;
  }

  for (const sub of SUBPASTAS) {
    if (!fs.existsSync(path.join(dados, sub))) saida.acoes.push({ tipo: 'criar_pasta', alvo: sub, detalhe: 'pasta que faltava' });
  }
  // Os movimentos vêm antes de tudo que grava dentro de uma coleta: o alvo dessas gravações já é o caminho novo.
  const movimentos = planejarMovimentos(dados);
  saida.acoes.push(...movimentos.acoes);
  saida.problemas.push(...movimentos.problemas);
  const doIndice = planejarIndice(dados);
  saida.acoes.push(...doIndice.acoes);
  saida.problemas.push(...doIndice.problemas);
  const metas = planejarMetas(dados);
  saida.acoes.push(...metas.acoes);
  saida.avisos.push(...metas.avisos);
  saida.acoes.push(...planejarGitignore(dados));

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

const RETOMAR = 'O que já foi gravado continua certo e a pasta não foi marcada como nova; resolva isso e rode de novo com --aplicar, que a migração termina o que faltou.';

// Devolve null quando tudo foi gravado, ou a frase que explica onde e por que parou.
function aplicar(dados, acoes, pastaBackup) {
  for (const a of acoes) {
    try {
      if (a.tipo === 'criar_pasta') {
        fs.mkdirSync(path.join(dados, a.alvo), { recursive: true });
        continue;
      }
      if (a.tipo === 'mover_coleta') {
        // Anota antes de mover: uma linha a mais (o movimento que falhou) não atrapalha desfazer; uma a menos sim.
        fs.mkdirSync(pastaBackup, { recursive: true });
        fs.appendFileSync(path.join(pastaBackup, 'movidos.jsonl'), JSON.stringify({ de: a.de, para: a.alvo }) + '\n');
        fs.mkdirSync(path.dirname(path.join(dados, a.alvo)), { recursive: true });
        try {
          fs.renameSync(path.join(dados, a.de), path.join(dados, a.alvo));
        } catch (e) {
          const motivo = MOTIVOS[e.code] ? `${MOTIVOS[e.code]} em "${path.join(dados, a.de)}" ou em "${path.dirname(path.join(dados, a.alvo))}"` : e.message;
          return `Não deu para mover "${path.join(dados, a.de)}" para "${path.join(dados, a.alvo)}": ${motivo}. ${RETOMAR}`;
        }
        continue;
      }
      if (a.backup) copiarParaBackup(dados, pastaBackup, a.alvo);
      escreverInteiro(path.join(dados, a.alvo), a.conteudo);
    } catch (e) {
      const motivo = MOTIVOS[e.code] ? `${MOTIVOS[e.code]} em "${e.path ? path.dirname(e.path) : dados}"` : e.message;
      return `Não deu para gravar "${path.join(dados, a.alvo)}": ${motivo}. ${RETOMAR}`;
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
  const temBackup = plano.acoes.some((a) => a.backup || a.tipo === 'mover_coleta');
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
    acoes: plano.acoes.map(({ tipo, de, alvo, detalhe }) => ({ tipo, ...(de ? { de } : {}), alvo, detalhe })),
    problemas: plano.problemas,
    avisos: plano.avisos,
    ...(erro ? { erro } : {}),
    ok,
  };
  process.stdout.write(JSON.stringify(saida, null, 2) + '\n');
  process.exit(ok ? 0 : 1);
}

principal(process.argv);
