# Navegação — dirigindo o navegador logado

A coleta usa o `claude-in-chrome` no navegador que a `profills-navegador` selecionou, já logado no LinkedIn. A aba `/company/<slug>/posts/` **só existe logado** — deslogado ela cai em authwall total (testado). Por que o navegador real e não um scraper ou a API: `compliance.md`.

## Passos por empresa

1. **Navegador pronto primeiro**: a `profills-navegador` já rodou (o `SKILL.md` a invoca antes da primeira empresa) e entregou no handoff o navegador selecionado, o id de uma tab própria e as tools `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `get_page_text`, `find` e `computer` já carregadas. Trabalhe nessa tab: com a conta conectada em mais de um PC, uma tab criada fora do handoff abre no computador errado.

2. **Carregue o `javascript_tool`**, que não vem no handoff e é o que faz a extração do passo 5: `ToolSearch` com `select:mcp__claude-in-chrome__javascript_tool`.

3. **Navegue** (`navigate`) para `https://www.linkedin.com/company/<slug>/posts/`.

4. **Confirme que carregou logado.** Feed visível → **anote os seguidores** do topo da página ("N seguidores"): é o denominador da taxa de engajamento e vai no `meta.json` (`schema-post.md`). Authwall/tela de login → a sessão do usuário caiu: pare, peça para ele logar no LinkedIn no navegador que a `profills-navegador` selecionou e diga que o catálogo continua de onde parou quando ele avisar.

5. **Ordene por Recentes.** O padrão da aba é "Populares", que reordena por engajamento e quebra o cálculo de cadência. Clique no "Classificar por: Populares" e escolha **"Recentes"** para ordem cronológica. O feed re-renderiza — espere ~2s antes de extrair (os posts remontam no DOM).

6. **Extraia via `data-urn`** com `javascript_tool` — ver [Extração validada](#extração-validada-js). A árvore de acessibilidade não expõe o `activity id`; o DOM sim.

7. **Role para carregar mais.** A paginação é scroll infinito client-side, sem parâmetro de URL. Use `computer` para rolar (tecla End ou scroll) ou clique em "Exibir mais resultados", esperando o carregamento entre cada rolagem. Ritmo humano — pausas de segundos, não rajada.

8. **Pare** cedo: ao atingir o teto de posts da rodada, ao passar da janela em dias, ou quando o feed acabar — o que vier primeiro. Na janela padrão (até 5 posts / 7 dias) raramente precisa rolar muito.

9. **Screenshot dos posts com mídia** com `computer` (screenshot, `save_to_disk: true`), salvando em `screenshots/post-<id>.png`. Só posts com imagem/carrossel/vídeo — texto puro não precisa.

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

- `formato` sai daqui com um de cinco valores (`texto`, `imagem`, `carrossel`, `video`, `artigo`). Os outros cinco da taxonomia dependem de você olhar o post — ver a coluna "Como reconhecer" em `taxonomias.md`.
- `social` vem como texto ("1 1 compartilhamento") — parseie reações/comentários/compartilhamentos dele; vazio = 0 engajamento.
- Ajuste os seletores se a UI do LinkedIn mudar (ela muda com frequência); o `data-urn` é o ponto estável.

## Parser de data relativa

Fonte única do pipeline: `dataRel` vem relativo ("1 h", "1 d", "4 d") e vira data absoluta contando a partir de hoje.

| Sufixo PT | Significa |
|---|---|
| `min` | minutos |
| `h` | horas |
| `d` | dias |
| `sem` | semanas (×168 h) |
| `m`, `mês`, `meses` | **meses** (×720 h) |
| `a`, `ano`, `anos` | anos |

**Cuidado com "m": no LinkedIn PT, "11 m" é 11 MESES, não minutos** (minutos é "min"). Confundir os dois faz post velho passar por recente. Fonte da verdade é o `activity id` (Snowflake): id maior = mais novo — se o número for muito menor que os posts claramente recentes, é antigo, ignore a leitura de "m" como minutos.

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
