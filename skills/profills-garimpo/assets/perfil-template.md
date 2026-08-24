# <Nome da Empresa> — Perfil de conteúdo LinkedIn

> **Como usar este template — apague este bloco no arquivo entregue.** Todo número abaixo é copiado do JSON de `scripts/metricas.js` rodado na pasta da coleta (passo 6 do `SKILL.md`); nada é recalculado à mão. O campo do JSON está indicado entre parênteses em cada linha. Escolha **um** dos dois blocos de "Cadência e engajamento" conforme a janela e apague o outro. O arquivo entregue não pode conter comentário HTML (`<!-- ... -->`) nem instrução de preenchimento.

- **Slug**: `<slug>` · **Coletado em**: <AAAA-MM-DD> (`coletado_em`)
- **Seguidores**: <n> (`seguidores`; "não informados" quando `null`) · **Janela**: <padrão (7 dias) / ampliada (<n> dias)> (`janela`, `janela_dias`) — <n> posts (`n_posts`), de <data> a <data> (`periodo`)
- **Fonte bruta**: `raw/<slug>/<AAAA-MM-DD>/posts.json`

> Neste relatório, [medido] = lido da página (fato); [inferido] = leitura da IA (hipótese).

## Cadência e engajamento [medido]

**Janela padrão (7 dias, ≤5 posts)** — o que está fresco, sem estatística:

- Posts na janela: <n_posts> — <acima / dentro / abaixo> do padrão B2B (3-5 por semana), <posts_por_semana>/semana.
- Engajamento por post: <lista curta, um por post: data · likes/comentários>.
- Engajamento médio por post: <engajamento_medio> (likes + comentários + reposts).
- Taxa de engajamento normalizada: <taxa_normalizada>% — contra a âncora B2B de ~2% (`benchmark-mercado.md`). Se veio `null`: "não calculável — sem seguidores no `meta.json`", e a empresa fica fora da comparação com as outras.
- Dias/horários dos posts: <...>

**Janela ampliada (o usuário pediu leitura de tendência)** — aqui a série sustenta média:

- Posts/semana no período: <posts_por_semana> — <acima / dentro / abaixo> do padrão B2B (3-5×).
- Engajamento médio e desvio-padrão: <outliers.media> ± <outliers.desvio_padrao>, limiar de outlier <outliers.limiar>.
- Taxa de engajamento normalizada: <taxa_normalizada>%.
- Evolução: <cadência e engajamento subindo, estáveis ou caindo ao longo do período — cada número citado sai de uma rodada do script por subperíodo, não de conta de cabeça>.
- <Se `amostra_insuficiente: true`: "Amostra insuficiente (<n_posts> posts) — sem média nem outlier; use o destaque da janela.">

## Formatos [medido]

Distribuição vinda de `formatos`; dominante em `formato_dominante`.

| Formato | % dos posts | Engajamento médio |
|---|---|---|
| ... | ... | ... |

- Formatos de alto multiplicador subusados: <...>

## Temas recorrentes [inferido]

Ranqueados por frequência. Cada tema cita um post-recibo (link + data).

- **<Tema>** — aparece em X de Y posts. Ex.: [post](url) (<data>).

## Hooks e ângulos [inferido]

- Categorias de hook mais usadas: <distribuição `hooks`>
- Ângulos retóricos dominantes: <contados do `posts.json`>
- % de hooks que cabem no corte: <hook_cabe_no_corte_pct>%

## Destaque [medido + inferido]

Janela padrão: o post de `destaque_semana`. Janela ampliada: os posts de `outliers.posts` (critério e limiar no próprio JSON).

| Post | Engajamento [medido] | Formato | Hook | Por que engajou (hipótese) [inferido] |
|---|---|---|---|---|
| [link](url) | 240 likes / 31 com. | carrossel (Hack-List) | "..." | aplica social-proof + specificity |

## Tom de voz [inferido]

<Pessoa, registro, uso de emoji, o que caracteriza a voz da empresa.>

## Change Log

Só ao re-catalogar; apague a seção inteira na primeira coleta. Uma entrada por data, a mais recente no topo, comparando os dois JSON do `metricas.js` (o de hoje e o da coleta anterior).

- **<AAAA-MM-DD>** — cadência <antes> → <agora> posts/semana; formato dominante <antes> → <agora>; taxa normalizada <antes>% → <agora>%.
