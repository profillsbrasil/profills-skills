# Benchmark de mercado — o segundo eixo

O catálogo compara cada empresa contra ela mesma (outliers internos). O benchmark de mercado dá o segundo eixo: "esta empresa posta 1×/semana **vs. o padrão B2B de 3-5×**". Dizer só a frequência bruta é menos acionável que situá-la contra a referência do setor.

Dados de mercado adaptados (traduzidos) do repositório MIT [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills). São referência de setor, não lei — o sinal real da empresa (outliers próprios) sempre manda mais.

## Taxa de engajamento normalizada

Likes brutos entre empresas de audiências diferentes não se comparam — 13 likes numa página de 30k seguidores valem menos que 2 likes numa de 1,9k. A métrica de comparação entre empresas é sempre a taxa:

```
taxa = (likes + comentários + reposts) ÷ seguidores × 100    (seguidores: meta.json da coleta)
```

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
- Link no corpo do post derruba alcance — quando visto num post, vale citar no perfil da empresa (a `linkedin-draft` sugere link no comentário).
- Documento/carrossel tende a ter alcance forte.
- Hook até ~210 caracteres, antes do corte "ver mais" — relatado que 60-80% dos leitores decidem ali se clicam. Post entre 1.200-1.600 caracteres performa bem; acima de ~2.000 cai o engajamento (queda relatada na casa de ~35%).

## Como usar no `_summary.md`

Ao lado da métrica própria de cada empresa, coloque a leitura contra o benchmark:

- Cadência: "Nubank posta ~2×/semana — abaixo do padrão B2B (3-5×)."
- Formato: "O formato dominante da empresa é texto puro; carrossel (1,3-1,8×) está subusado."
