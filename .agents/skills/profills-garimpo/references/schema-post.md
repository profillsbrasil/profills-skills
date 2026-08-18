# Schema de extração por post

O `posts.json` de cada empresa é um array destes objetos. Ele é o **artefato primário** — o relatório em prosa e o dashboard nascem dele. Preencha um campo com `null` quando não houver sinal claro; não invente para preencher.

> Schema v2 (2026-08): alinhado aos campos que a coleta real produz. As coletas de 2026-07-14 são compatíveis (não têm `meta.json` nem `framework_carrossel`; trate ausência como `null`).

```json
{
  "post_id": "urn:li:activity:7135991839244902400",
  "url": "https://www.linkedin.com/posts/...-activity-7135991839244902400-xxxx",
  "data": "2026-07-10",
  "idioma": "PT",
  "texto": "texto completo do post",
  "formato": "carrossel",
  "framework_carrossel": "Hack-List",
  "hook": "primeira linha literal do post",
  "hook_categoria": "curiosity-gap",
  "hook_cabe_no_corte": true,
  "cta": "comenta aqui embaixo qual você usaria",
  "hashtags": ["#embalagem", "#automacao"],
  "link_externo": "https://blog.exemplo.com.br/post",
  "artigo_titulo": null,
  "angulo": "dado",
  "gatilho_psicologico": "social-proof",
  "tom": "primeira pessoa, informal, com emoji",
  "descricao_visual": "slide 1 mostra a máquina em operação com título em amarelo",
  "engajamento": { "likes": 240, "comentarios": 31, "reposts": 12 },
  "screenshot": "screenshots/post-7135991839244902400.png",
  "destaque_semana": false
}
```

## Medido (lido da página — fato)

| Campo | Como obter |
|---|---|
| `post_id`, `url` | do atributo `data-urn` / permalink do post |
| `data` | data de publicação (converta "3d", "1mo" para data absoluta usando a data de hoje) |
| `idioma` | `PT` ou `EN` — detecte pelo texto |
| `texto` | texto completo, incluindo quebras de linha |
| `formato` | ver taxonomia de formato em `taxonomias.md` |
| `hook`, `hook_cabe_no_corte` | primeira linha literal (até a primeira quebra ou ~210 chars); cabe se ≤ 210 (limiar do "ver mais") |
| `cta` | a chamada final, se houver (`null` se não) |
| `hashtags` | array das hashtags do post (`[]` se nenhuma — ausência também é sinal de estilo) |
| `link_externo` | URL externa do post (lnkd.in, blog), `null` se não houver |
| `artigo_titulo` | título do card, só quando `formato` é `artigo` (`null` fora disso) |
| `engajamento` | likes, comentários, reposts — números na página **no momento da coleta** |

## Inferido (leitura sua — hipótese)

| Campo | Como classificar |
|---|---|
| `framework_carrossel` | só quando `formato` é carrossel/documento — ver os 5 frameworks em `taxonomias.md` (`null` fora disso) |
| `hook_categoria` | uma das 8 categorias de hook em `taxonomias.md` |
| `angulo` | um dos 7 ângulos retóricos em `taxonomias.md` |
| `gatilho_psicologico` | o gatilho dominante, se houver um claro (`null` se ambíguo) |
| `tom` | pessoa (1ª/institucional), registro (formal/casual), uso de emoji |
| `descricao_visual` | posts com mídia: o que a imagem/vídeo/slide mostra, em uma frase — o sinal visual quando o screenshot falhar (`null` para texto puro) |

## Computado (na síntese, não na extração)

O discriminador é a **janela**, não a contagem: padrão (semanal, o default) usa `destaque_semana`; ampliada (o usuário pediu leitura de tendência) usa `outlier`.

- `destaque_semana` — janela padrão: `true` **só no post de maior `likes + comentarios`** da janela da empresa. É o "pico da semana" — simples, não estatístico.
- `outlier` — janela ampliada: `true` se `likes + comentarios` passou de `média + 1,5×desvio-padrão` da própria empresa; exige **>5 posts** para o desvio sustentar (menos que isso → sinalize amostra insuficiente). Na janela padrão o campo não existe.

## Meta da coleta — `meta.json`

Ao lado de `posts.json`, um `meta.json` com o contexto da página no dia:

```json
{
  "slug": "cetromaquinas",
  "coletado_em": "2026-08-04",
  "seguidores": 12400,
  "janela_dias": 7,
  "posts_coletados": 5
}
```

`seguidores` vem do topo da página da empresa ("12.400 seguidores") e é o denominador da **taxa de engajamento normalizada** (`benchmark-mercado.md`) — sem ele, comparar likes brutos entre uma página de 30k e uma de 1,9k seguidores é enganoso.

## Screenshot

Todo post com mídia (imagem, carrossel, vídeo) ganha um screenshot em `screenshots/post-<id>.png`. O screenshot captura o que o texto não diz — a anatomia visual do carrossel, o print, o gráfico. Post de texto puro não precisa (`screenshot: null`).
