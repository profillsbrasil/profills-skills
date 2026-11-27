# <Nome da Empresa> — Perfil de conteúdo

> **Como usar este template — apague este bloco no arquivo entregue.** Todo número abaixo é copiado do JSON de `scripts/metricas.js` rodado na pasta da coleta de cada conta (passo 6 do `SKILL.md`); nada é recalculado à mão. O campo do JSON está indicado entre parênteses em cada linha. Há um bloco de números por rede coletada (LinkedIn, Instagram): repita o bloco "Cadência e engajamento" uma vez por rede, com o título da rede, e apague a rede que a empresa não tem. Em cada bloco, escolha **um** dos dois sub-blocos conforme a janela e apague o outro. Número de uma rede nunca se soma nem se compara com número da outra. O arquivo entregue não pode conter comentário HTML (`<!-- ... -->`) nem instrução de preenchimento.

- **Slug**: `<slug>` · **Janela**: <padrão (7 dias) / ampliada (<n> dias)> (`janela`, `janela_dias`)
- **LinkedIn**: `<slug>` · coletado em <AAAA-MM-DD> (`coletado_em`) · <n> seguidores (`seguidores`; "não informados" quando `null`) · <n> posts (`n_posts`), de <data> a <data> (`periodo`) · fonte `raw/linkedin/<slug>/<AAAA-MM-DD>/posts.json`
- **Instagram**: `<handle>` · coletado em <AAAA-MM-DD> · <n> seguidores · <n> posts, de <data> a <data> · fonte `raw/instagram/<handle>/<AAAA-MM-DD>/posts.json`
- **Idiomas**: <distribuição `idiomas` de cada rede, ex.: LinkedIn en 4, pt 1; Instagram pt 5>

> Neste relatório, [medido] = lido da página (fato); [inferido] = leitura da IA (hipótese).

## Cadência e engajamento — <LinkedIn / Instagram> [medido]

**Janela padrão (7 dias, ≤5 posts)** — o que está fresco, sem estatística:

- Posts na janela: <n_posts> — <posts_por_semana>/semana; no LinkedIn, <acima / dentro / abaixo> do padrão B2B (3-5 por semana). No Instagram não há padrão de mercado no `benchmark-mercado.md`: diga só o número.
- Engajamento por post: <lista curta, um por post: data · likes/comentários>.
- Engajamento médio por post: <engajamento_medio> (likes + comentários + reposts).
- Taxa de engajamento normalizada: <taxa_normalizada>% — no LinkedIn, contra a âncora B2B de ~2% (`benchmark-mercado.md`); no Instagram, sem âncora. Se veio `null`: "não calculável — sem seguidores no `meta.json`", e a conta fica fora da comparação com as outras da mesma rede.
- Dias/horários dos posts: <...>

**Janela ampliada (o usuário pediu leitura de tendência)** — aqui a série sustenta média:

- Posts/semana no período: <posts_por_semana> — <acima / dentro / abaixo> do padrão B2B (3-5×).
- Engajamento médio e desvio-padrão: <outliers.media> ± <outliers.desvio_padrao>, limiar de outlier <outliers.limiar>.
- Taxa de engajamento normalizada: <taxa_normalizada>%.
- Evolução: <cadência e engajamento subindo, estáveis ou caindo ao longo do período — cada número citado sai de uma rodada do script por subperíodo, não de conta de cabeça>.
- <Se `amostra_insuficiente: true`: "Amostra insuficiente (<n_posts> posts) — sem média nem outlier; use o destaque da janela.">

## Formatos [medido]

Distribuição vinda de `formatos` de cada rede; dominante em `formato_dominante`.

| Rede | Formato | % dos posts | Engajamento médio |
|---|---|---|---|
| ... | ... | ... | ... |

- Formatos de alto multiplicador subusados: <...>

## Temas recorrentes [inferido]

Ranqueados por frequência, nas duas redes. Cada tema cita um post-recibo (link, data e rede).

- **<Tema>** — aparece em X de Y posts. Ex.: [post](url) (<data>, <rede>).

## Hooks e ângulos [inferido]

- Categorias de hook mais usadas: <distribuição `hooks`>
- Ângulos retóricos dominantes: <contados do `posts.json`>
- % de hooks que cabem no corte: <hook_cabe_no_corte_pct>% (só no LinkedIn)

## Destaque [medido + inferido]

Um destaque por rede. Janela padrão: o post de `destaque_semana`. Janela ampliada: os posts de `outliers.posts` (critério e limiar no próprio JSON).

| Rede | Post | Engajamento [medido] | Formato | Hook | Por que engajou (hipótese) [inferido] |
|---|---|---|---|---|---|
| LinkedIn | [link](url) | 240 likes / 31 com. | carrossel (Hack-List) | "..." | aplica social-proof + specificity |

## Posts em outro idioma [inferido]

Só quando `idiomas` traz código diferente de `pt`; sem post estrangeiro, apague a seção. Um item por post fora do português, com o `resumo_pt` do `posts.json` copiado sem reescrever. O hook fica no original.

- [post](url) (<data>) · <idioma> · hook original: "<hook>" · em pt-BR: <resumo_pt>

## Tom de voz [inferido]

<Pessoa, registro, uso de emoji, o que caracteriza a voz da empresa.>

## Change Log

Só ao re-catalogar; apague a seção inteira na primeira coleta. Uma entrada por data, a mais recente no topo, comparando os dois JSON do `metricas.js` (o de hoje e o da coleta anterior).

- **<AAAA-MM-DD>, <rede>** — cadência <antes> → <agora> posts/semana; formato dominante <antes> → <agora>; taxa normalizada <antes>% → <agora>%.
