# Benchmark de mercado — o segundo eixo

O catálogo compara cada empresa contra ela mesma (outliers internos). O benchmark de mercado dá o segundo eixo: "esta empresa posta 1×/semana **vs. o padrão B2B de 3-5×**". Dizer só a frequência bruta é menos acionável que situá-la contra a referência do setor.

Dados de mercado adaptados (traduzidos) do repositório MIT [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills). São referência de setor, não lei — o sinal real da empresa (outliers próprios) sempre manda mais.

## Taxa de engajamento normalizada

**Esta é a fonte única da fórmula no pipeline** — o `SKILL.md`, o `perfil-template.md`, o `dashboard.md` e o `schema-post.md` citam "taxa normalizada (`benchmark-mercado.md`)" e não repetem a conta. Quem a executa é `scripts/metricas.js`.

Likes brutos entre empresas de audiências diferentes não se comparam — 13 likes numa página de 30k seguidores valem menos que 2 likes numa de 1,9k. A métrica de comparação entre empresas é sempre a taxa:

```
taxa = média por post de (likes + comentários + reposts) ÷ seguidores × 100
```

**Média por post, nunca a soma da janela.** A soma cresce com o número de posts: a mesma empresa pareceria 5× melhor numa semana de 5 posts que numa de 1 post. Quem divide por seguidores é a média.

Exemplo: 5 posts na janela somando 190 interações (likes + comentários + reposts), página com 12.400 seguidores.

- média por post = 190 ÷ 5 = **38**
- taxa = 38 ÷ 12.400 × 100 = **0,31%**
- (a soma da janela daria 190 ÷ 12.400 × 100 = 1,53% — isso **não** é a taxa)

`seguidores` vem do `meta.json` da coleta; sem ele a taxa não existe (`null`), e a empresa fica fora da comparação entre empresas — diga isso em vez de comparar bruto.

**Quem faz essa conta é `scripts/metricas.js`**, no campo `taxa_normalizada`. Perfil, `_summary.md`, dashboard e resposta ao usuário copiam o número de lá; ninguém recalcula à mão.

Âncora relatada para páginas B2B: **média de ~2%; 3-5% é bom**. Âncora frouxa por natureza: checagem em ago/2026 achou números incompatíveis entre vendors (metodologias divergem — por seguidor, por impressão, percentis). Use como ordem de grandeza; **não** segmente por vertical com números de vendor, e o sinal da própria empresa continua mandando mais.

## Cadência

- **Padrão de páginas de empresa B2B**: 3-5 posts/semana. Menos perde momentum; mais causa fadiga.
- Publicar em dias úteis, com melhor tração relatada terça a quinta, de manhã / meio-dia / fim de tarde.

## Formato por engajamento (LinkedIn B2B, ranking relatado)

| Formato | Multiplicador de engajamento vs. média |
|---|---|
| História pessoal com lição de negócio | 1,5-2× |
| Dado / pesquisa original | 1,3-1,5× |
| Carrossel de documento (8-12 slides) | 1,3-1,8× |
| Take contrário do setor | 1,2-1,5× |

## Regras de algoritmo (para contextualizar, não julgar)

- A primeira hora concentra o alcance; comentário vale mais que reação, que vale mais que clique.
- Documento/carrossel tende a ter alcance forte.
- É relatado que 60-80% dos leitores decidem no corte do "ver mais" se clicam — é o que dá sentido a medir `hook_cabe_no_corte` (o limite em caracteres vive em `../profills-post/SKILL.md`, "Restrições de formato").

As restrições de **escrita** de post (tamanho de corpo, link no comentário, markdown) vivem na `profills-post`, que é quem escreve. Aqui ficam só os números de mercado contra os quais o catálogo compara.

## Como usar no `_summary.md`

Ao lado da métrica própria de cada empresa, coloque a leitura contra o benchmark:

- Cadência: "Nubank posta ~2×/semana — abaixo do padrão B2B (3-5×)."
- Formato: "O formato dominante da empresa é texto puro; carrossel (1,3-1,8×) está subusado."
