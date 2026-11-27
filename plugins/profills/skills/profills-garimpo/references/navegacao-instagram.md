# Navegação no Instagram — dirigindo o navegador logado

O Instagram de uma empresa se coleta pelo mesmo navegador logado do LinkedIn, pelas mesmas intenções do adaptador do harness. Este arquivo guarda só o que é do Instagram: os fatos medidos, os passos por conta e os dois blocos de JavaScript. O que vale para as duas redes (navegador pronto, aba própria, escopo do JavaScript, ritmo, parada na detecção) está em `navegacao.md` e `compliance.md` e não se repete aqui.

## Fatos validados ao vivo

Medidos em 26 e 27/11/2026 pelo Claude in Chrome, numa conta logada com a interface em português, em perfis comerciais (`cetromaquinas`, `natgeo`); os 15 comentários ao abrir o post foram medidos também no Codex Desktop.

| Onde | Fato |
|---|---|
| Perfil `https://www.instagram.com/<handle>/` | O topo (`header`) traz handle, nome, "3.239 posts", "149 mil seguidores" ou "267 mi seguidores", bio e botões. A `og:url` é `https://www.instagram.com/<handle>/` |
| Grade do perfil | 12 links no carregamento, do mais novo para o mais velho, no formato `/<handle>/p/<código>/` ou `/<handle>/reel/<código>/`. O código tem 11 caracteres de `A-Z a-z 0-9 _ -` |
| Ícone de cada item da grade | `svg` com `aria-label` "Clipe" (reel), "Carrossel" ou nenhum (imagem). Post fixado troca o ícone de tipo por "Ícone de post fixado" e vem antes dos outros, mesmo sendo antigo (três no `natgeo`, de outubro e novembro) |
| Texto alternativo da imagem da grade | Imagem e carrossel: "Photo by CETRO on November 27, 2026. …" ou "Photo shared by …", em inglês mesmo com a interface em português. Reel: o começo da legenda, sem data |
| Post aberto por `https://www.instagram.com/p/<código>/` | Vale para reel também: a página fica em `/p/<código>/` e a `og:url` diz `/<handle>/reel/<código>/`. Abrir `/reel/<código>/` redireciona para `/reels/<código>/`, um feed de reels de outras contas, por isso a coleta nunca abre esse endereço |
| Data do post | `time[datetime]` dentro do link para o próprio post (`/<handle>/p/<código>/` ou `/reel/`), com hora exata em UTC. A legenda tem outro `time`, fora de link, alguns segundos antes |
| Legenda | No bloco que começa com o handle e o `time` fora de link; inteira na página do post, igual à da `og:description` nos 4 posts medidos (115 a 496 caracteres). Hashtag é texto da legenda e link `/explore/tags/` |
| Contadores | Uma `section` com os ícones "Curtir", "Comentar", "Repostar", "Compartilhar" e "Salvar"; o número de cada um é o `span` que vem logo depois do ícone, e ícone sem número é 0. A barra arredonda ("4 mil") |
| `og:description` | "3,959 likes, 27 comments - natgeo no November 27, 2026: \"<legenda>\"." Número em inglês, exato abaixo de dez mil; acima disso ela também arredonda ("24K likes") |
| Comentários | 15 carregam ao abrir (medido no Claude in Chrome e no Codex Desktop), cada um com o handle em link `/<handle>/`, um `time[datetime]` dentro do link `/p/<código>/c/<id>/` e o texto. A contagem da barra inclui respostas: 2 na barra e 1 comentário carregado no reel da `cetromaquinas` |
| Reposts e compartilhamentos | Existem no Instagram e são contadores diferentes: 78 reposts e 41 compartilhamentos num reel do `natgeo` |
| Ferramenta do Claude in Chrome | Bloqueia o código do post no retorno ("[BLOCKED: Base64 encoded data]", e "[BLOCKED: JWT token]" com ponto a cada 4). Com espaço a cada 4 caracteres ele passa |

Não medido: perfil sem posts, perfil privado, curtidas ocultas pelo dono, legenda acima de 500 caracteres, a interface em inglês e o Codex Desktop rodando os dois blocos.

## A coleta abre cada post

A grade dá o código, a ordem e o formato de todo item, e a data só de imagem e carrossel. Curtidas, comentários, a legenda inteira e a data do reel só existem na página do post. Sem elas não há taxa de engajamento nem destaque, então a coleta abre **cada post da janela**, um por página, e usa a grade para não abrir o que não precisa:

- para no primeiro item não fixado com `dia_alt` antes da janela: a grade vem do mais novo para o mais velho, e tudo depois dele também está fora;
- pula post fixado com `dia_alt` fora da janela. Fixado sem `dia_alt` (reel) ou sem formato abre, porque pode ser da semana;
- abre no máximo o teto de posts da janela (5 na padrão).

Na janela padrão uma conta custa até 6 páginas: o perfil e 5 posts. É isso que o limite de páginas por rodada do `compliance.md` conta.

## Passos por conta

1. **Navegador pronto e aba própria**, como nos passos 1 e 2 de `navegacao.md`: a mesma aba serve às duas redes da empresa.
2. **Abra o perfil** (intenção `abrir-pagina`) em `https://www.instagram.com/<handle>/` e espere uns segundos.
3. **Leia o perfil** com o bloco [Perfil (JS)](#perfil-js) (intenção `rodar-js`). Retorno com `pagina: "outra"`: leia a página (intenção `ler-pagina`). Tela de login é sessão caída: pare e peça o login, como no LinkedIn. Handle que não existe é `erro_navegacao`. `privada: true` grava `pagina_nao_gerenciada` com a nota "perfil privado"; `sem_posts: true`, ou nenhum item na janela, grava `sem_posts`.
4. **Escolha os posts** da lista `itens` pela regra da seção acima. Se a janela pede mais itens que a grade trouxe (só na ampliada), role o perfil (intenção `rolar`), espere e rode o bloco de novo: ele relê a grade inteira.
5. **Abra cada post escolhido** (intenção `abrir-pagina`) em `https://www.instagram.com/p/<código sem os espaços>/`, também os reels, com pausa de alguns segundos entre um e outro, e rode o bloco [Post (JS)](#post-js). Confira que o `codigo` do retorno é o que você abriu; se não for, abra de novo. Post com `dia` antes da janela encerra a conta.
6. **Capture a tela** do post (intenção `capturar-tela`) em `screenshots/post-<código>`, pela regra de screenshot do `schema-post.md`.
7. **Feche a aba** (intenção `fechar-aba`) só no fim da rodada.

Nenhum passo clica: legenda, contadores e grade estão na página sem clique. Os dois blocos leem sem guardar nada entre chamadas e só usam os globais que o Codex Desktop tem, então rodam iguais nos dois harnesses e não precisam do campo `escopo` nem da linha `TEXTOS` da extração do LinkedIn: um post por página cabe num retorno só.

## Perfil (JS)

```js
(() => {
  const limpa = (t) => (t || '').replace(/ /g, ' ').trim();
  const numero = (t) => {
    const m = limpa(t).match(/^(\d[\d.,]*)\s*(mil|mi)?$/);
    if (!m) return null;
    const n = Number(m[1].split('.').join('').replace(',', '.'));
    return Math.round(n * (m[2] === 'mil' ? 1e3 : m[2] === 'mi' ? 1e6 : 1));
  };
  const sep = (s) => String(s).replace(/(.{4})(?=.)/g, '$1 ');
  const MESES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
  const diaDoAlt = (alt) => {
    const m = (alt || '').match(/^Photo (?:shared )?by .+? on ([A-Za-z]+) (\d{1,2}), (\d{4})/);
    const mes = m ? MESES.indexOf(m[1].toLowerCase()) + 1 : 0;
    return mes ? `${m[3]}-${String(mes).padStart(2, '0')}-${m[2].padStart(2, '0')}` : null;
  };
  const og = (document.querySelector('meta[property="og:url"]')?.getAttribute('content') || '').match(/instagram\.com\/([A-Za-z0-9._]+)\/?$/);
  const header = document.querySelector('main header') || document.querySelector('header');
  if (!og || !header) return { pagina: 'outra', avisos: ['a aba não está num perfil: abra https://www.instagram.com/<handle>/ e rode de novo'] };
  const avisos = [];
  const topo = limpa(header.innerText);
  const conta = (re) => {
    const m = topo.match(re);
    return m ? { n: numero(`${m[1]} ${m[2] || ''}`), arredondado: !!m[2] } : null;
  };
  const seg = conta(/(\d[\d.,]*)\s*(mil|mi)?\s+seguidores/);
  const total = conta(/(\d[\d.,]*)\s*(mil|mi)?\s+posts?\b/);
  if (!seg) avisos.push('seguidores não achados no topo do perfil');
  const corpo = limpa((document.querySelector('main') || document.body).innerText);
  const privada = /Esta conta é privada/.test(corpo);
  const vazio = /Ainda não há nenhum post/.test(corpo);
  const vistos = new Set();
  const itens = [];
  document.querySelectorAll('main a[href*="/p/"], main a[href*="/reel/"]').forEach((a) => {
    const m = (a.getAttribute('href') || '').match(/^\/(?:([A-Za-z0-9._]+)\/)?(p|reel)\/([A-Za-z0-9_-]+)\/$/);
    if (!m || vistos.has(m[3])) return;
    vistos.add(m[3]);
    const icones = [...a.querySelectorAll('svg[aria-label]')].map((s) => s.getAttribute('aria-label'));
    const fixado = icones.some((i) => /fixado/.test(i));
    const formato = m[2] === 'reel' || icones.includes('Clipe') ? 'reel' : icones.includes('Carrossel') ? 'carrossel' : fixado ? null : 'imagem';
    itens.push({ n: itens.length + 1, codigo: sep(m[3]), dono: m[1] || null, fixado, formato, dia_alt: diaDoAlt(a.querySelector('img')?.getAttribute('alt')) });
  });
  if (!itens.length && !privada && !vazio) avisos.push('grade sem posts carregados: espere uns segundos e rode de novo');
  return {
    pagina: 'perfil', handle: og[1], seguidores: seg ? seg.n : null, seguidores_arredondado: seg ? seg.arredondado : false,
    posts_no_perfil: total ? total.n : null, privada, sem_posts: vazio, itens, avisos,
  };
})()
```

O retorno traz `handle`, `seguidores`, `seguidores_arredondado`, `posts_no_perfil`, `privada`, `sem_posts`, `avisos` e um item por post da grade, na ordem da tela:

- **`codigo`** vem com espaço a cada 4 caracteres, que a ferramenta do Claude in Chrome bloqueia sem eles: tire os espaços antes de montar o endereço.
- **`formato`** é `reel`, `carrossel` ou `imagem`, pelo ícone; `null` em post fixado que não é reel, porque o ícone de fixado esconde o tipo. Na página do post o formato sai de novo, e vale o de lá.
- **`fixado`** marca post fixado no topo.
- **`dia_alt`** é a data do texto alternativo, só em imagem e carrossel. Serve para escolher o que abrir; a data gravada é a do post.
- **`seguidores`** é o denominador da taxa do Instagram. "149 mil" vira 149000 com `seguidores_arredondado: true`, que vai para o `meta.json` como no LinkedIn.

## Post (JS)

```js
(() => {
  const limpa = (t) => (t || '').replace(/ /g, ' ').trim();
  // A barra do post escreve o número em pt-BR ("4 mil", "1.234"); a og:description, em inglês ("3,959", "24K").
  const numero = (t, ingles) => {
    const m = limpa(t).match(/^(\d[\d.,]*)\s*(mil|mi|K|M)?$/);
    if (!m) return null;
    const [milhar, decimal] = ingles ? [',', '.'] : ['.', ','];
    const mult = { mil: 1e3, K: 1e3, mi: 1e6, M: 1e6 }[m[2]] || 1;
    return { n: Math.round(Number(m[1].split(milhar).join('').replace(decimal, '.')) * mult), arredondado: mult > 1 };
  };
  const sep = (s) => String(s).replace(/(.{4})(?=.)/g, '$1 ');
  const meta = (p) => document.querySelector(`meta[property="${p}"]`)?.getAttribute('content') || '';
  const og = meta('og:url').match(/instagram\.com\/([A-Za-z0-9._]+)\/(p|reel)\/([A-Za-z0-9_-]+)/);
  if (!og) return { pagina: 'outra', avisos: ['a aba não está num post: abra https://www.instagram.com/p/<código>/ e rode de novo'] };
  const [, dono, caminho, codigo] = og;
  const avisos = [];
  const main = document.querySelector('main') || document.body;
  const doPost = (a) => !!a && (a.getAttribute('href') || '').includes(`/${codigo}/`);
  const tempos = [...main.querySelectorAll('time[datetime]')];
  const tempoPost = tempos.find((t) => doPost(t.closest('a')) && !t.closest('a').getAttribute('href').includes('/c/'));
  const tempoLegenda = tempos.find((t) => !t.closest('a'));
  const data = (tempoPost || tempoLegenda)?.getAttribute('datetime') || null;
  if (!tempoPost) avisos.push(tempoLegenda ? 'data tirada da legenda: o link de data do post não foi achado' : 'data do post não achada');
  let legenda = '';
  if (tempoLegenda) {
    // Sobe do time da legenda até o bloco com texto depois dele, sem entrar no que já tem comentário ou contadores.
    const rotulo = tempoLegenda.innerText;
    const depois = (el) => el.innerText.slice(el.innerText.indexOf(rotulo) + rotulo.length).trim();
    let no = tempoLegenda;
    const perto = (el) => el.parentElement && el !== main && !el.parentElement.querySelector('section, a[href*="/c/"]');
    while (perto(no) && !depois(no)) no = no.parentElement;
    legenda = depois(no);
  }
  const descricao = meta('og:description');
  const legendaOg = (descricao.match(/: "([\s\S]*)"\.?\s*$/) || [])[1];
  if (legendaOg !== undefined && legendaOg.trim() !== legenda) avisos.push(`legenda da página (${legenda.length} caracteres) difere da og:description (${legendaOg.trim().length}): confira na tela`);
  const ICONES = { Curtir: 'likes', Comentar: 'comentarios', Repostar: 'reposts', Compartilhar: 'compartilhamentos' };
  const barra = main.querySelector('svg[aria-label="Comentar"]')?.closest('section');
  const lidos = {};
  if (barra) {
    let atual = null;
    barra.querySelectorAll('svg[aria-label], span').forEach((e) => {
      if (e.tagName.toLowerCase() === 'svg') {
        atual = ICONES[e.getAttribute('aria-label')] || null;
        if (atual && !lidos[atual]) lidos[atual] = { n: 0, arredondado: false };
      } else if (atual && !e.children.length && lidos[atual].n === 0 && numero(e.textContent)) lidos[atual] = numero(e.textContent);
    });
  } else avisos.push('barra de contadores não achada: leia curtidas e comentários na tela');
  const doOg = {
    likes: numero((descricao.match(/^([\d.,]+[KM]?) likes?\b/) || [])[1] || '', true),
    comentarios: numero((descricao.match(/([\d.,]+[KM]?) comments?\b/) || [])[1] || '', true),
  };
  const contadores = {};
  const arredondados = [];
  Object.values(ICONES).forEach((campo) => {
    const a = lidos[campo];
    const b = doOg[campo];
    const v = !a ? b : b && ((a.arredondado && !b.arredondado) || (a.n === 0 && b.n > 0)) ? b : a;
    contadores[campo] = v ? v.n : null;
    if (v && v.arredondado) arredondados.push(campo);
    if (!v) avisos.push(`contador de ${campo} não achado: leia na tela`);
  });
  const formato = caminho === 'reel' ? 'reel'
    : main.querySelector('button[aria-label="Avançar"]') ? 'carrossel'
    : main.querySelector('video') ? 'video'
    : 'imagem';
  return {
    pagina: 'post', codigo: sep(codigo), dono, data, dia: data ? new Date(data).toLocaleDateString('sv') : null, formato,
    legenda_chars: legenda.length, legenda_pedacos: legenda.match(/[\s\S]{1,850}/g) || [],
    hashtags: legenda.match(/#[\p{L}\p{N}_]+/gu) || [],
    ...contadores, arredondados,
    comentarios_carregados: new Set([...main.querySelectorAll('a[href*="/c/"]')].filter(doPost).map((a) => a.getAttribute('href'))).size,
    avisos,
  };
})()
```

O retorno traz um post, o da página:

- **`codigo`** e **`dono`**: o `post_id` é `ig:<código sem espaços>` e o `url` é `https://www.instagram.com/p/<código sem espaços>/`. Post com `dono` diferente do handle da conta é colaboração de outra conta: grave e diga na `nota` do `meta.json`.
- **`dia`** é o `data` do `posts.json`, no fuso do navegador; `data` é a hora exata em UTC.
- **`formato`**: `reel` pela `og:url`, `carrossel` pelo botão "Avançar", `video` quando há vídeo fora de reel, senão `imagem`.
- **`legenda_pedacos`**: junte na ordem e confira que o total tem `legenda_chars` caracteres. A legenda é o `texto` do `posts.json`, e o `hook` é a primeira linha dela.
- **`likes`**, **`comentarios`**, **`reposts`** e **`compartilhamentos`** já vêm em número. O bloco lê a barra e a `og:description` e fica com o mais exato: a barra arredonda acima de mil ("4 mil"), a `og:description` só acima de dez mil. Campo em `arredondados` saiu arredondado das duas fontes.
- **`comentarios_carregados`** conta os comentários que a página mostrou, sem ler quem comentou: o nome e o texto de quem comenta não entram no catálogo.

### Avisos do bloco

| Aviso | O que fazer |
|---|---|
| `a aba não está num perfil` ou `num post` | abra o endereço de novo e rode o bloco; repetindo, leia a página (`ler-pagina`) e veja se é login, bloqueio ou página que não existe |
| `seguidores não achados` | leia o número no topo do perfil e grave-o; sem ele, a taxa dessa conta fica `null` |
| `grade sem posts carregados` | espere uns segundos e rode de novo; continuando vazia sem `sem_posts`, leia a página |
| `data tirada da legenda` | a data vale, com segundos de diferença; siga |
| `data do post não achada` | leia a data na tela e grave-a; sem data o post não entra |
| `legenda da página difere da og:description` | leia a legenda na tela e grave a inteira |
| `contador de <campo> não achado` ou `barra de contadores não achada` | leia o número na tela e grave-o, nunca `0` no lugar |

## Tabela de erros

A tabela de erros de `navegacao.md` vale aqui igual (ferramenta ausente, aba no computador errado, login, rate-limit). O que muda no Instagram:

| Sintoma | Ação |
|---|---|
| Página de conta que não existe (o texto exato não foi medido) | handle errado ou conta apagada: `erro_navegacao` com a nota, e peça o perfil certo ao usuário no fim da rodada |
| Aba foi parar em `/reels/` | a página abriu pelo endereço de reel: volte a `https://www.instagram.com/p/<código>/` |
| "Tente novamente mais tarde", captcha, pedido de confirmar a conta | **pare a coleta das duas redes na hora** e avise o usuário |
