# Dashboard visual do catálogo

O dado estruturado vive em disco para rastreabilidade; o dashboard é a camada visual — o que deixa o usuário digerir cadência, formatos, hooks e outliers de relance, em vez de ler JSON. É o equivalente ao "visual companion": mostrar, não descrever.

## Antes de desenhar

- Tenha em mãos o JSON do **`scripts/metricas.js`** de cada empresa da rodada (passo 6 do `SKILL.md`). **Todo número do painel é copiado de lá** — cadência, taxa normalizada, distribuição de formato, hooks, destaque/outlier. O dashboard não faz conta nenhuma.
- Mostre a página pela intenção `mostrar-pagina` do adaptador do harness: ele diz onde ela é publicada ou gravada e as skills de design e de gráfico que o harness oferece para carregar antes de desenhar.
- A página é HTML autocontido, tudo inline: nada de arquivo externo nem chamada de rede, para abrir igual publicada ou do disco.
- Gráfico com paleta legível em claro e escuro, e cada série com rótulo, não só cor.

## O que o dashboard mostra

Um painel por execução, cobrindo as empresas da seleção. Cada número leva a rede dele, e cada gráfico que compara empresas fica dentro de uma rede só (um painel ou uma série por rede):

1. **Cabeçalho** — data da coleta, janela (padrão/ampliada), empresas e redes incluídas e as contas que ficaram sem dados.
2. **Cadência** — `posts_por_semana` por empresa, uma barra por rede, com a faixa de benchmark (3-5×) marcada só no LinkedIn. Um gráfico de barras ou linha.
3. **Distribuição de formato** — o campo `formatos` de cada empresa (barra empilhada ou small multiples), destacando formatos subusados de alto multiplicador.
4. **Destaques / outliers** — o `destaque_semana` de cada empresa (na janela ampliada, os `outliers.posts`, com o `limiar` declarado), com hook, categoria, engajamento e link. Tabela ordenável.
5. **Temas recorrentes** — por empresa, com frequência e um post-recibo cada.
6. **Leitura vs. mercado** — uma linha por empresa e rede: **`taxa_normalizada`** (no LinkedIn contra a âncora de ~2%, ver `benchmark-mercado.md`; no Instagram, sem âncora) e posição vs. padrão de cadência e formato. Empresa com `taxa_normalizada: null` aparece com a razão no lugar do número, fora dos rankings.
7. **Mix de conteúdo** — distribuição de `angulo` por empresa (contada do `posts.json`, o único eixo que o script não agrega); sinalize quando mais da metade da janela é pitch de produto/institucional — mix saudável equilibra ensinar, bastidor e opinião com a venda.

## Regras

- **Medido vs inferido visível.** Engajamento e cadência são dados; tema, tom e "por que engajou" são leitura — o dashboard não deve borrar os dois (ex.: um selo ou seção separando fato de hipótese).
- **Entre empresas, só taxa normalizada, e dentro da mesma rede.** Likes brutos comparam posts da MESMA conta; entre empresas, sempre a `taxa_normalizada` do `metricas.js` (fórmula em `benchmark-mercado.md`), uma rede de cada vez. Engajamento de redes diferentes não se soma nem divide o mesmo eixo. Quando a taxa vem `null`, diga isso no painel em vez de comparar bruto.
- **Número sozinho não brilha.** Seguidores, impressões ou alcance nunca aparecem como destaque sem a métrica de ação ao lado (taxa, comentários) — vanity metric isolada engana o olho.
- **Cada outlier linka o post.** O usuário precisa poder clicar e ver o original.
- **Todo valor sai do `metricas.js`** (que por sua vez só lê o `posts.json`/`meta.json`). `amostra_insuficiente: true` aparece como aviso no painel, e empresa com `status` diferente de `ok` aparece como linha "sem dados: <nota>" — nunca como gráfico vazio fingindo dado. Nenhum número do painel pode ser digitado sem estar no JSON.
- **Tema/formato via taxonomia.** Os eixos categóricos usam os valores fechados de `taxonomias.md`, para as empresas serem comparáveis no mesmo gráfico.
