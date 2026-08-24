# Dashboard visual do catálogo

O dado estruturado vive em disco para rastreabilidade; o dashboard é a camada visual — o que deixa o usuário digerir cadência, formatos, hooks e outliers de relance, em vez de ler JSON. É o equivalente ao "visual companion": mostrar, não descrever.

## Antes de desenhar

- Carregue a skill **`artifact-design`** para calibrar quanto investimento de design o caso pede.
- Carregue a skill **`dataviz`** antes de escrever qualquer gráfico (cadência, distribuição de formato, engajamento) — ela define paleta acessível em claro/escuro e specs de marca.
- Publique com a tool **Artifact** (página HTML autocontida, tudo inline).

## O que o dashboard mostra

Um painel por execução, cobrindo as empresas da seleção:

1. **Cabeçalho** — data da coleta, janela (padrão/ampliada), empresas incluídas e as que ficaram sem dados.
2. **Cadência** — posts/semana por empresa, com a faixa de benchmark (3-5×) marcada. Um gráfico de barras ou linha.
3. **Distribuição de formato** — que formatos cada empresa usa (barra empilhada ou small multiples), destacando formatos subusados de alto multiplicador.
4. **Destaques / outliers** — o pico da semana de cada empresa (`destaque_semana`; outlier estatístico só em janela ampliada), com hook, categoria, engajamento e link. Tabela ordenável.
5. **Temas recorrentes** — por empresa, com frequência e um post-recibo cada.
6. **Leitura vs. mercado** — uma linha por empresa: **taxa de engajamento normalizada** (contra a âncora de ~2%, ver `benchmark-mercado.md`) e posição vs. padrão de cadência e formato.
7. **Mix de conteúdo** — distribuição de `angulo` por empresa; sinalize quando mais da metade da janela é pitch de produto/institucional — mix saudável equilibra ensinar, bastidor e opinião com a venda.

## Regras

- **Medido vs inferido visível.** Engajamento e cadência são dados; tema, tom e "por que engajou" são leitura — o dashboard não deve borrar os dois (ex.: um selo ou seção separando fato de hipótese).
- **Entre empresas, só taxa normalizada.** Likes brutos comparam posts da MESMA empresa; entre empresas, sempre a taxa normalizada (fórmula em `benchmark-mercado.md`). Sem `seguidores` no `meta.json`, diga isso no painel em vez de comparar bruto.
- **Número sozinho não brilha.** Seguidores, impressões ou alcance nunca aparecem como destaque sem a métrica de ação ao lado (taxa, comentários) — vanity metric isolada engana o olho.
- **Cada outlier linka o post.** O usuário precisa poder clicar e ver o original.
- **Todo valor sai do `posts.json`.** Amostra insuficiente (<5 posts) aparece como aviso, e empresa com `status` diferente de `ok` aparece como linha "sem dados: <nota>" — nunca como gráfico vazio fingindo dado.
- **Tema/formato via taxonomia.** Os eixos categóricos usam os valores fechados de `taxonomias.md`, para as empresas serem comparáveis no mesmo gráfico.
