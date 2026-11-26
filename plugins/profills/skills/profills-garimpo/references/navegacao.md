# Navegação — dirigindo o navegador logado

A coleta usa o `claude-in-chrome` no navegador que a `profills-navegador` selecionou, já logado no LinkedIn. A aba `/company/<slug>/posts/` **só existe logado** — deslogado ela cai em authwall total (testado). Por que o navegador real e não um scraper ou a API: `compliance.md`.

## Passos por empresa

1. **Navegador pronto primeiro**: a `profills-navegador` já rodou (o `SKILL.md` a invoca antes da primeira empresa) e entregou no handoff o navegador selecionado, o id de uma tab própria e as tools `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `get_page_text`, `find` e `computer` já carregadas. Trabalhe nessa tab: com a conta conectada em mais de um PC, uma tab criada fora do handoff abre no computador errado.

2. **Carregue o `javascript_tool`**, que não vem no handoff e é o que roda os passos 5 e 6: `ToolSearch` com `select:mcp__claude-in-chrome__javascript_tool`.

3. **Navegue** (`navigate`) para `https://www.linkedin.com/company/<slug>/posts/`.

4. **Confirme que carregou logado.** Feed visível → siga; os seguidores do topo da página ("N seguidores"), denominador da taxa de engajamento, saem da extração do passo 6. Authwall/tela de login → a sessão do usuário caiu: pare, peça para ele logar no LinkedIn no navegador que a `profills-navegador` selecionou e diga que o catálogo continua de onde parou quando ele avisar.

5. **Ordene por Recentes.** A aba abre ordenada por engajamento ("Populares" ou "Principais", conforme a estrutura), o que quebra o cálculo de cadência. Rode o JS de [Ordenar por Recentes](#ordenar-por-recentes-js). Concluído quando ele devolve `ok: true`. Com `ok: false`, recarregue a página e rode mais uma vez; se repetir, grave `"status": "erro_navegacao"` com o `motivo` na nota.

6. **Extraia** com o JS de [Extração](#extração-js). Concluído quando `avisos` volta vazio ou cada aviso foi tratado pela [tabela de avisos](#avisos-do-extrator): é ela que pega post pulado.

7. **Role para carregar mais.** A paginação é scroll infinito client-side, sem parâmetro de URL. Use `computer` para rolar (tecla End ou scroll) ou clique em "Exibir mais resultados", esperando o carregamento entre cada rolagem. Ritmo humano — pausas de segundos, não rajada. Depois de rolar, rode a extração de novo: ela relê a página inteira.

8. **Pare** cedo: ao atingir o teto de posts da rodada, ao passar da janela em dias (pelo campo `dia` da extração), ou quando o feed acabar — o que vier primeiro. Na janela padrão (até 5 posts / 7 dias) raramente precisa rolar muito.

9. **Screenshot dos posts com mídia** com `computer` (screenshot, `save_to_disk: true`), salvando em `screenshots/post-<id>` com a extensão que a ferramenta gravar (`.png` ou `.jpg`). Só posts com imagem/carrossel/vídeo — texto puro não precisa.

## As duas estruturas da aba

O LinkedIn serve a aba Publicações em duas estruturas, e a conta logada decide qual vem. Os dois JS deste arquivo reconhecem a estrutura sozinhos; a extração devolve o nome dela em `estrutura`.

| | `data-urn` | `componentkey` |
|---|---|---|
| Card do post | elemento com `data-urn="urn:li:activity:<id>"` ou `urn:li:ugcPost:<id>` | `div[role=listitem]` com `componentkey` começando por `update-card-focus` |
| Id do post | o próprio `data-urn` | protobuf em base64 no `componentkey` que termina em `-replaceableCommentTools…`, dentro do card |
| Anúncio | `data-urn` de outro tipo (`inAppPromotion`) | card com "Anuncie no LinkedIn" e sem a chave do id |
| Ordenação padrão | "Classificar por: Populares" | "Classificar por: Principais" |
| Rótulo de data | "22 h" | "há 22 h" |
| Conferido | ao vivo em 10/11/2026: 9 posts de uma página, ordem, datas e contadores batendo com a tela | relatado na coleta de 10/11/2026 (12 empresas). O JS daqui rodou só num DOM montado por esse relato, não numa página real |

Na primeira empresa da rodada em que `estrutura` vier `componentkey`, confira dois posts contra a tela: texto, dia e os três contadores. Se os dois batem, siga e diga no fecho da rodada que a estrutura `componentkey` foi conferida nesta data. Se algum item diverge, pare essa empresa com `"status": "erro_navegacao"`, ponha na nota o item que divergiu e diga ao usuário que a skill precisa de atualização para a estrutura nova.

O id do `componentkey` tem dois tipos, e ler só um pula post: o primeiro byte é `0x0A` (activity, texto e imagem) ou `0x12` (ugcPost, vídeo e documento); depois vêm o tamanho, `0x08` e um varint, e o id é o varint deslocado 1 bit à direita. Os bytes `0a 0b 08 80 c0 b9 84 9a f6 92 f1 d0 01` dão `urn:li:activity:7525838065450299392`, um post de 10/11/2026.

## Ordenar por Recentes (JS)

O menu abre com `click()` ou com a sequência de eventos de ponteiro, conforme a estrutura, e a primeira tentativa logo depois da carga costuma falhar; por isso o JS tenta três vezes, com 2 s entre elas. A opção se acha pelo texto exato, porque o player de vídeo põe outros `[role=menuitem]` na página.

```js
await (async () => {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  const gatilho = () => [...document.querySelectorAll('button, div[role=button]')].find((e) => /^Classificar por:/.test(e.innerText.trim()));
  const opcao = () => [...document.querySelectorAll('[role=option], [role=menuitem]')].find((e) => e.innerText.trim() === 'Recentes');
  const rotulo = () => gatilho()?.innerText.replace(/\s+/g, ' ').trim() || null;
  const eventos = (el) => ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'].forEach((tipo) => el.dispatchEvent(
    new (tipo.startsWith('pointer') ? PointerEvent : MouseEvent)(tipo, { bubbles: true, cancelable: true, view: window })));
  const antes = rotulo();
  if (!antes) return { ok: false, motivo: 'botão "Classificar por" não achado' };
  if (/Recentes/.test(antes)) return { ok: true, antes, depois: antes, abriu_com: null };
  let abriu_com = null;
  for (const [nome, abre] of [['click', (g) => g.click()], ['eventos', eventos], ['eventos, 2a vez', eventos]]) {
    const g = gatilho();
    if (!g) break;
    abre(g);
    await espera(2000);
    if (opcao()) { abriu_com = nome; break; }
  }
  if (!abriu_com) return { ok: false, antes, motivo: 'menu não abriu' };
  opcao().click();
  await espera(2500);
  return { ok: /Recentes/.test(rotulo() || ''), antes, depois: rotulo(), abriu_com };
})()
```

## Extração (JS)

```js
(() => {
  const sep = (s) => String(s).replace(/(\d{4})(?=\d)/g, '$1_');
  const dataDoId = (id) => new Date(Number(BigInt(id) >> 22n));
  const limpa = (t) => (t || '').replace(/ /g, ' ').trim();
  const numero = (t) => {
    const m = limpa(t).match(/^(\d[\d.,]*)\s*(mil|mi)?$/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    return Math.round(n * (m[2] === 'mil' ? 1e3 : m[2] === 'mi' ? 1e6 : 1));
  };
  const posts = [];
  const avisos = [];
  let anuncios = 0;
  let cards = 0;
  let estrutura;

  const cardsNovos = [...document.querySelectorAll('div[role=listitem][componentkey^="update-card-focus"]')];
  if (cardsNovos.length) {
    estrutura = 'componentkey';
    cards = cardsNovos.length;
    const REL = /^há \d+ ?(min|h|d|sem|m|mês|meses|a|ano|anos)\b/;
    const idDaChave = (chave) => {
      const b64 = chave.split('-replaceableCommentTools')[0].replace(/-/g, '+').replace(/_/g, '/');
      let b;
      try { b = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); } catch (e) { return null; }
      const tipo = b[0] === 0x0a ? 'activity' : b[0] === 0x12 ? 'ugcPost' : null;
      if (!tipo || b[2] !== 0x08) return null;
      let v = 0n;
      let desloca = 0n;
      for (let i = 3; i < b.length; i += 1) {
        v |= BigInt(b[i] & 0x7f) << desloca;
        desloca += 7n;
        if (!(b[i] & 0x80)) break;
      }
      return { tipo, id: String(v >> 1n) };
    };
    const ICONES = {
      likes: 'thumbs-up-outline-feed-compact',
      comentarios: 'comment-outline-feed-compact',
      reposts: 'arrows-swap-outline-feed-compact',
    };
    const contadores = (card) => {
      const icones = Object.entries(ICONES).map(([campo, id]) => [campo, card.querySelector(`svg[id="${id}"]`)]);
      const achados = icones.map(([, svg]) => svg).filter(Boolean);
      const lidos = {};
      icones.forEach(([campo, svg]) => {
        const outros = achados.filter((s) => s !== svg);
        if (!svg || !outros.length) { lidos[campo] = null; return; }
        let no = svg;
        let folha;
        while (!folha && !outros.some((s) => no.parentElement.contains(s))) {
          no = no.parentElement;
          folha = [...no.querySelectorAll('*')].find((e) => !e.children.length && numero(e.textContent) !== null);
        }
        lidos[campo] = folha ? numero(folha.textContent) : 0;
      });
      let barra = achados.length > 1 ? achados[0].parentElement : null;
      while (barra && !achados.every((s) => barra.contains(s))) barra = barra.parentElement;
      return { lidos, barra };
    };
    cardsNovos.forEach((card, i) => {
      const bruto = card.innerText;
      const linhas = bruto.split('\n').map(limpa);
      const chave = card.querySelector('[componentkey*="-replaceableCommentTools"]')?.getAttribute('componentkey');
      const rels = linhas.filter((l) => REL.test(l));
      if (!chave) {
        if (card.innerText.includes('Anuncie no LinkedIn')) anuncios += 1;
        else avisos.push(`card ${i + 1} sem id (${rels[0] || 'sem data'}): post pulado`);
        return;
      }
      const lido = idDaChave(chave);
      if (!lido) {
        avisos.push(`card ${i + 1} com id que não decodifica (${rels[0] || 'sem data'}): post pulado`);
        return;
      }
      const { lidos, barra } = contadores(card);
      Object.keys(ICONES).filter((campo) => lidos[campo] === null)
        .forEach((campo) => avisos.push(`post ${posts.length + 1}: contador de ${campo} não achado (${rels[0] || 'sem data'})`));
      const rodape = barra ? barra.innerText.trim() : '';
      const corte = rodape ? bruto.lastIndexOf(rodape) : -1;
      const antesDoRodape = corte > -1 ? bruto.slice(0, corte).split('\n').map(limpa) : [];
      const corpo = antesDoRodape.some((l) => REL.test(l)) ? antesDoRodape : linhas;
      const ini = corpo.findIndex((l) => REL.test(l));
      let fim = corpo.findIndex((l, k) => k > ini && /^…\s?mais$/.test(l));
      if (fim === -1) fim = corpo.length;
      const cortado = /^…\s?mais$/.test(corpo[fim] || '');
      const texto = corpo.slice(ini + 1, fim).join('\n').replace(/\n{3,}/g, '\n\n').trim();
      const documento = linhas.some((l) => /^\d+ páginas$/.test(l));
      const formato = rels.length > 1 ? 'reshare'
        : card.querySelector('video') ? 'video'
        : documento ? 'carrossel'
        : [...card.querySelectorAll('img')].some((im) => im.width >= 300) ? 'imagem'
        : 'texto';
      posts.push({
        tipo: lido.tipo, id: lido.id, data: dataDoId(lido.id).toISOString(), dataRel: rels[0] || null, formato, texto,
        texto_cortado: cortado,
        vaga: !!card.querySelector('a[href*="/jobs/view/"]'),
        hashtags: texto.match(/#[\p{L}\p{N}_]+/gu) || [],
        link: card.querySelector('a[href*="lnkd.in"]')?.href || null,
        ...lidos,
      });
    });
  } else {
    estrutura = 'data-urn';
    const itens = [...document.querySelectorAll('.occludable-update')];
    const vazios = itens.filter((e) => !e.querySelector('[data-urn]')).length;
    cards = itens.length - vazios;
    if (vazios) avisos.push(`${vazios} card(s) ainda sem conteúdo: role até eles e rode de novo`);
    document.querySelectorAll('[data-urn]').forEach((e) => {
      const m = e.getAttribute('data-urn').match(/^urn:li:(activity|ugcPost):(\d+)$/);
      if (e.parentElement.closest('[data-urn]')) return;
      if (!m) { anuncios += 1; return; }
      const social = limpa(e.querySelector('.social-details-social-counts')?.innerText).replace(/\s+/g, ' ');
      const conta = (re) => numero((social.match(re) || [])[1] || '0') || 0;
      const tem = (s) => !!e.querySelector(s);
      posts.push({
        tipo: m[1], id: m[2], data: dataDoId(m[2]).toISOString(),
        dataRel: limpa((e.querySelector('.update-components-actor__sub-description')?.innerText || '').split('•')[0]),
        formato: tem('video, .update-components-linkedin-video') ? 'video'
          : tem('.document-s-container, [data-test-document-entity]') ? 'carrossel'
          : tem('.update-components-article') ? 'artigo'
          : tem('.update-components-image img') ? 'imagem' : 'texto',
        texto: limpa(limpa(e.querySelector('.update-components-text, .feed-shared-update-v2__description')?.innerText)
          .replace(/^hashtag\n/gm, '').replace(/…\s?mais$/, '')),
        texto_cortado: false,
        vaga: tem('a[href*="/jobs/view/"]'),
        hashtags: [...e.querySelectorAll('a[href*="HASH_TAG"], a[href*="/hashtag/"]')].map((a) => limpa(a.innerText.split('\n').pop())),
        link: e.querySelector('a[href*="lnkd.in"], .update-components-article__link')?.href || null,
        likes: conta(/^(\d[\d.,]*(?: mil| mi)?)(?= \d|$)/),
        comentarios: conta(/(\d[\d.,]*(?: mil| mi)?) comentários?/),
        reposts: conta(/(\d[\d.,]*(?: mil| mi)?) compartilhamentos?/),
      });
    });
  }

  if (cards !== posts.length + anuncios) {
    avisos.push(`${cards} cards na página, ${posts.length} posts e ${anuncios} anúncios lidos: a conta não fecha`);
  }
  posts.forEach((p, i) => {
    if (i && p.data > posts[i - 1].data) avisos.push(`post ${i + 1} é mais novo que o post ${i}: fixado, ou a ordem não é Recentes`);
  });
  const seg = document.body.innerText.match(/(\d[\d.,]*)\s*(mil|mi)?\s+seguidores/);
  window.__garimpo = posts;
  return {
    estrutura, cards, anuncios, avisos,
    seguidores: seg ? numero(`${seg[1]} ${seg[2] || ''}`) : null,
    seguidores_arredondado: !!(seg && seg[2]),
    posts: posts.map((p, i) => ({
      n: i + 1, tipo: p.tipo, id: sep(p.id), dia: dataDoId(p.id).toLocaleDateString('sv'), dataRel: p.dataRel, formato: p.formato,
      texto_chars: p.texto.length, texto_cortado: p.texto_cortado, vaga: p.vaga,
      likes: p.likes, comentarios: p.comentarios, reposts: p.reposts, link: p.link, hashtags: p.hashtags,
    })),
  };
})()
```

O retorno traz `estrutura`, `cards`, `anuncios`, `avisos`, `seguidores` e um resumo por post, na ordem da tela. Como usar cada parte:

- **Id.** A ferramenta bloqueia sequência longa de dígitos, então `id` vem com `_` a cada 4: tire os `_`. O `post_id` é `urn:li:<tipo>:<id>` e o `url` é `https://www.linkedin.com/feed/update/<post_id>/`, nos dois tipos.
- **Texto.** A ferramenta corta valor acima de uns 1.000 caracteres, então o texto fica em `window.__garimpo` e sai em pedaços: `window.__garimpo[<n - 1>].texto.match(/[\s\S]{1,850}/g)`. Junte os pedaços na ordem. Com `texto_cortado: true`, o card só tinha o trecho antes do "… mais": abra o `url` do post e leia o texto inteiro de lá.
- **Data.** `dia` é o `data` do `posts.json`. Ele sai do id, que é um Snowflake (`id >> 22` são os milissegundos desde 1970), no fuso do navegador. `dataRel` é o rótulo da tela e serve para conferir.
- **Formato.** Na estrutura `data-urn` o JS devolve `texto`, `imagem`, `carrossel`, `video` ou `artigo`; na `componentkey`, `texto`, `imagem`, `carrossel`, `video` ou `reshare`. Os outros valores dependem de você olhar o post — coluna "Como reconhecer" de `taxonomias.md`. `vaga: true` marca post com link de vaga.
- **Engajamento.** `likes`, `comentarios` e `reposts` já vêm em número. Na `data-urn`, contador ausente na tela é `0`. Na `componentkey`, o JS procura o número no grupo do próprio ícone: ícone sem número é `0`, e ícone que o JS não acha vem `null`, com aviso.
- **Seguidores.** O LinkedIn arredonda ("6 mil", "1,1 mi"). O JS devolve o número convertido e `seguidores_arredondado`; os dois vão para o `meta.json` (`schema-post.md`).
- **Página global.** Ela mostra os posts do mercado da conta que olha (português, inglês, alemão): registre o `idioma` do que veio.

### Avisos do extrator

| Aviso | O que fazer |
|---|---|
| `N card(s) ainda sem conteúdo` | role até o fim da lista carregada e rode a extração de novo |
| `card N sem id` ou `com id que não decodifica` | é um post pulado: leia esse card com `read_page`, grave o post à mão se for da empresa e conte na `nota` do `meta.json`. O formato do id mudou — avise o usuário que este arquivo precisa de atualização |
| `a conta não fecha` | algum card não virou post nem anúncio: ache qual pela ordem da tela e trate como post pulado |
| `post N: contador de <campo> não achado` | leia esse número no card do post N na tela e grave-o no `posts.json`. Não grave `0` nem `null` no lugar: o `metricas.js` lê `null` como zero, e o post entraria na média com um contador falso. Confira também o fim do texto desse post, que sem a barra de contadores pode trazer números do rodapé. Se o aviso vier em todos os posts, o ícone mudou: avise o usuário que este arquivo precisa de atualização |
| `post N é mais novo que o post N-1` | post fixado no topo: siga. Sem post fixado, a ordenação não pegou: refaça o passo 5 |

## Data relativa da tela

O `dia` do post sai do id (ver Extração). O rótulo relativo só confere a tela, e nele o sufixo engana:

| Sufixo PT | Significa |
|---|---|
| `min` | minutos |
| `h` | horas |
| `d` | dias |
| `sem` | semanas |
| `m`, `mês`, `meses` | **meses** |
| `a`, `ano`, `anos` | anos |

"11 m" são 11 meses; minutos é "min". Se o rótulo e o `dia` discordarem, vale o `dia`.

## Tabela de erros

| Sintoma | Ação |
|---|---|
| Tools `mcp__claude-in-chrome__*` ausentes ou nenhum navegador conectado | não é erro de página — invoque a `profills-navegador` (instalação/conexão guiada) |
| Usuário diz que a aba abriu em outro computador | navegador errado selecionado — refaça a seleção pela `profills-navegador` (ela atualiza o cache) |
| Página pede login/authwall | sessão caiu — pare, peça o login e retome quando ele avisar |
| Página existe mas não tem aba "Publicações" | página não gerenciada — `meta.json` com `"status": "pagina_nao_gerenciada"`, siga para a próxima empresa |
| Feed não carrega mais posts ao rolar | chegou ao fim disponível — pare e catalogue o que tem |
| Zero posts na janela | `meta.json` com `"status": "sem_posts"` e a nota; silêncio é sinal, entra no `_summary.md` |
| Empresa com pouquíssimos posts (<5 na janela) | catalogue o que tem e sinalize "amostra insuficiente" no perfil |
| Screenshot falha/timeout na mesma aba | não repita a mesma captura — siga com `read_page`/texto e marque `screenshot: null` |
| Percepção de rate-limit (captcha, "atividade incomum") | **pare a sessão imediatamente**, não insista; avise o usuário e feche com o que já está em disco |

## Slug e ID

O slug vem da URL `linkedin.com/company/<slug>` e pode mudar num rebranding; o ID numérico (5-9 dígitos) não. A `profills-radar` põe os dois na linha de `selection.md` — se o slug der 404, tente `https://www.linkedin.com/company/<id>/posts/`. Sem id na linha (`—`) e com o slug falhando, registre `"status": "erro_navegacao"` e peça o link da página ao usuário no fim da rodada.
