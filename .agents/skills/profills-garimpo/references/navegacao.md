# Navegação — dirigindo o Brave logado

A coleta usa o `claude-in-chrome`: o Brave real do usuário, já logado no LinkedIn. Isso evita os sinais clássicos de automação headless (o `navigator.webdriver`, o user-agent "HeadlessChrome") porque é o navegador dele de verdade, com movimento humano. As tools têm o prefixo `mcp__claude-in-chrome__` e carregam via `ToolSearch`.

## Por que o navegador logado, e não um scraper

A aba `/company/<slug>/posts/` só existe logado — deslogado ela cai em authwall total (testado). Não há API oficial que leia posts de empresas de terceiros (a Community Management API exige ser admin da página). E os termos do LinkedIn, além de scrapers como Firecrawl/Browserbase, proíbem raspagem — o próprio repositório marketingskills marca isso como violação explícita de ToS. O navegador real logado, em ritmo humano e só lendo, é o caminho mais defensável para uso pessoal de baixo volume. Ver `compliance.md`.

## Passos por empresa

1. **Navegador pronto primeiro**: a skill `profills-navegador` já deve ter rodado (o SKILL.md invoca ela antes da primeira empresa) — é ela que seleciona o navegador certo entre as máquinas conectadas, carrega as tools e entrega uma tab própria. Não chame `tabs_create_mcp`/`navigate` sem esse handoff: com a conta conectada em mais de um PC, a tab abre no computador errado.

2. **Navegue na tab do handoff** (`navigate`) para `https://www.linkedin.com/company/<slug>/posts/`. Se precisar de tools além das que a profills-navegador carregou, complete numa chamada de `ToolSearch`: `select:mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__get_page_text,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__javascript_tool`.

3. **Confirme que carregou logado.** Se a página mostrar authwall/login em vez do feed, a sessão do usuário caiu — pare e peça para ele logar no LinkedIn no Brave antes de continuar. Não tente burlar. Logado, **anote os seguidores** do topo da página ("N seguidores") — é o denominador da taxa de engajamento e vai no `meta.json` da coleta (`schema-post.md`).

4. **Ordene por Recentes.** O padrão da aba é "Populares", que reordena por engajamento e quebra o cálculo de cadência. Clique no "Classificar por: Populares" e escolha **"Recentes"** para ordem cronológica. O feed re-renderiza — espere ~2s e re-extraia (os posts remontam no DOM).

5. **Extraia via `data-urn`** com `javascript_tool` — ver [Extração validada](#extração-validada-js). A árvore de acessibilidade não expõe o `activity id`; o DOM sim.

6. **Role para carregar mais.** A paginação é scroll infinito client-side, sem parâmetro de URL. Use `computer` para rolar (tecla End ou scroll) ou clique em "Exibir mais resultados", e espere o carregamento entre cada rolagem. Ritmo humano — pausas de segundos, não rajada.

7. **Pare** cedo: o alvo padrão é **até 5 posts da última semana** (os mais recentes primeiro). Pare ao juntar 5 posts, ao passar de 7 dias na data, ou quando o feed acabar — o que vier primeiro. Como é pouco, raramente precisa rolar muito.

8. **Screenshot dos posts com mídia** com `computer` (screenshot, `save_to_disk: true`), salvando em `screenshots/post-<id>.png`. Só posts com imagem/carrossel/vídeo — texto puro não precisa.

## Extração validada (JS)

Testado ao vivo (jul/2026). O feed **intercala anúncios** entre os posts orgânicos — mas o anúncio **não tem `data-urn` de activity**, então filtrar por `[data-urn*="urn:li:activity"]` já pega só os posts da empresa e descarta os anúncios, sem heurística de autor. O `activity id` do atributo é o `post_id`; o permalink é `linkedin.com/feed/update/<urn>/`.

```js
(() => {
  const posts = Array.from(document.querySelectorAll('[data-urn*="urn:li:activity"]'));
  return posts.map(e => {
    const urn = e.getAttribute('data-urn');
    const texto = (e.querySelector('.update-components-text, .feed-shared-update-v2__description')?.innerText || '').replace(/\s+/g,' ').trim();
    const dataRel = (e.querySelector('.update-components-actor__sub-description')?.innerText || '').split('•')[0].trim();
    const hashtags = Array.from(e.querySelectorAll('a[href*="HASH_TAG"]')).map(a => a.innerText.split('\n').pop().trim()); // limpa o prefixo "hashtag\n"
    const link = e.querySelector('a[href*="lnkd.in"], .update-components-article__link')?.href || null;
    const hasVideo = !!e.querySelector('video, .update-components-linkedin-video');
    const hasDoc = !!e.querySelector('.document-s-container, [data-test-document-entity]');
    const hasArticle = !!e.querySelector('.update-components-article');
    const hasImg = !!e.querySelector('.update-components-image img');
    const formato = hasVideo?'video':hasDoc?'carrossel':hasArticle?'artigo':hasImg?'imagem':'texto';
    const social = e.querySelector('.social-details-social-counts')?.innerText.replace(/\s+/g,' ').trim() || '';
    return { urn, dataRel, formato, texto, hashtags, link, social };
  });
})()
```

- `dataRel` vem relativo ("1 h", "1 d", "4 d") — converta para data absoluta com a data de hoje. **Cuidado com "m": no LinkedIn PT, "11 m" é 11 MESES, não minutos** (minutos é "min"). Confundir os dois faz post velho passar por recente. Fonte da verdade é o `activity id` (Snowflake): id maior = mais novo — se o número for muito menor que os posts claramente recentes, é antigo, ignore o "m". Parser: `min`→minutos, `h`→horas, `d`→dias, `sem`→semanas×168h, `m`/`mês`/`meses`→meses×720h, `a`/`ano`→anos.
- `social` vem como texto ("1 1 compartilhamento") — parseie reações/comentários/compartilhamentos dele; vazio = 0 engajamento.
- Ajuste os seletores se a UI do LinkedIn mudar (ela muda com frequência); o `data-urn` é o ponto estável.

## Tabela de erros

| Sintoma | Ação |
|---|---|
| Tools `mcp__claude-in-chrome__*` ausentes ou nenhum navegador conectado | não é erro de página — invoque a `profills-navegador` (instalação/conexão guiada) |
| Usuário diz que a aba abriu em outro computador | navegador errado selecionado — refaça a seleção pela `profills-navegador` (ela atualiza o cache) |
| Página pede login/authwall | sessão caiu — pare e peça ao usuário para logar no Brave |
| Feed não carrega mais posts ao rolar | chegou ao fim disponível — pare e catalogue o que tem |
| Empresa com pouquíssimos posts (<5 na janela) | reduza a exigência; sinalize "amostra insuficiente" no perfil |
| Screenshot falha/timeout na mesma aba | não repita a mesma captura — siga com `read_page`/texto e marque `screenshot: null` |
| Percepção de rate-limit (captcha, "atividade incomum") | **pare a sessão imediatamente**, não insista; avise o usuário |

## Slug e ID

O slug vem da URL `linkedin.com/company/<slug>`. Ele pode mudar num rebranding; o ID numérico (5-9 dígitos) não. Se a `profills-radar` guardou o ID no dossiê e o slug falhar, tente pela URL com ID.
