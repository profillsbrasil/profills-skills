# Quality gate — o crivo antes de humanizar

Um rascunho gerado por template tende a ser competente e sem alma. Este crivo separa "montado" de "publicável" antes de o `humanize-pt-br` dar o polimento final. Adaptado (traduzido) do repositório MIT [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills).

Os nomes daqui (quality gate, Push/Shine, Expert Panel, ICP) são vocabulário interno seu. Na conversa, o usuário ouve "passei um crivo de qualidade".

## Checklist mensurável (roda primeiro)

O resto deste arquivo é julgamento. Isto aqui é contagem, e contagem quem faz é o script:

```
node "<pasta desta skill>/scripts/checar-formato.js" "<arquivo>" --voz "<DADOS>/voz.md"
```

Ele aceita o `.md` salvo em `drafts/` (o texto do post é tudo que vem depois da primeira linha `---`) ou um `.txt` com o texto da variação, e devolve JSON. Os limites de cada checagem vêm no campo `limites` da própria saída — este arquivo não os repete, e você não os recita de cabeça.

| Campo da saída | O que reprova |
|---|---|
| `hook_cabe` | hook estourou o corte "ver mais" |
| `acima_de_2000` / corpo acima de `corpo_max` | corpo maior do que a faixa que performa |
| `tem_markdown` | `**`, `#`, `- `, `[texto](url)` — o feed mostra literal |
| `link_no_corpo` | link no texto em vez do comentário |
| `paragrafo_longo` | bloco sem quebra, ilegível no celular |
| `palavras_banidas_encontradas` | ocorrência da seção **Palavras banidas** do `voz.md` |
| `travessao` | travessão no corpo (marca de IA que o `humanize-pt-br` tira) |
| `campos_pendentes` | `[campo]` não preenchido |

**`ok: false` é ❌: a variação volta para revisão antes do painel de personas**, não depois. O campo `falhas` diz, em uma linha cada, o número medido e o limite — corrija por ali e rode de novo. Exit code: 0 = passou, 1 = reprovou, 2 = erro de uso/arquivo.

O campo `avisos` é outra coisa: **não reprova nada**, é assunto para levar ao usuário.

| Aviso | O que fazer |
|---|---|
| `corpo_curto` | corpo abaixo de `limites.corpo_min`. Pergunte ("ficou curto — quer engordar ou vai assim?") e siga a resposta dele. Molde de Enquete é curto por desenho. |
| `voz_sem_palavras_banidas` | o `voz.md` passado não tem a seção **Palavras banidas**: nenhum termo foi lido, então o gate de banidas está **não medido**, não aprovado. Diga isso e ofereça a `profills-voz` para preencher a seção. |

Duas coisas o script **não** faz e você faz na mão: o passe de **Isso não sou eu** do `voz.md` (é construção e tom, não palavra) e todo o julgamento das seções abaixo.

## Teste "e daí?" (So what?)

Para cada afirmação do rascunho, pergunte: **"Ok, e daí?"** Se a linha não responde com um benefício mais fundo para o leitor, ela não está pronta. Encadeie até chegar no que o leitor de fato liga.

- ❌ "Nossa máquina tem selagem automática."
- "E daí?" → ✅ "A selagem automática tira o operador da linha — a mesma equipe embala 40% a mais por turno."

Aplique com dureza especial no hook e no CTA.

## Analgésico ou vitamina

Depois do "e daí?", rotule o rascunho inteiro: **analgésico** (toca uma dor nomeada do ICP — medo, custo, risco, cobrança do chefe) ou **vitamina** (informação boa de saber, sem dor por trás). A dor vem do campo **Dores do ICP** (em Identidade) do `voz.md` e da matéria-prima coletada. Vitamina não reprova sozinha — mas um conjunto de variações **só** de vitaminas volta para revisão: pelo menos uma opção precisa doer.

## Ângulo pessoal: o teste da vulnerabilidade

Quando o rascunho expõe erro, fracasso ou situação pessoal (comum no molde História), quatro perguntas antes de seguir:

1. Compartilha para **ensinar** ou para desabafar? (ferida ainda aberta → não vai)
2. O usuário ficaria confortável se **viralizasse**?
3. Tem **lição** além da dor?
4. As **outras pessoas** da história estão protegidas (sem nome/cargo identificável sem aval)?

Qualquer "não" → reformular com o usuário antes do painel.

## Push e Shine — o passe de reescrita

- **Push** — reescreva mirando **uma pessoa** (a persona do público, não "o mercado"). É aqui que a voz entra.
- **Shine** — passe de robô: gramática, estrutura e legibilidade (frase que um leitor apressado segue no celular, sem período de três orações); as contagens e as palavras banidas já vieram do checklist mensurável. Falta o **passe de voz** que é seu: **Isso não sou eu** do `voz.md` — uma ocorrência reprova. Depois vem o passe humano, que é a skill `humanize-pt-br`.

"Carta, não comunicado": escreva para uma pessoa, na voz honesta do usuário. Nada de "Prezado cliente".

## Expert Panel — pontuação

Monte 3-5 personas relevantes ao contexto e faça cada uma pontuar o rascunho de 1 a 10 **com crítica específica**, não só nota. **O corte é: todas ≥7 e a média ≥8.** Reprocesse até bater os dois.

Personas sugeridas para post de LinkedIn:
- **O leitor-alvo (ICP)** — isto para o meu scroll? eu comentaria?
- **Ghostwriter B2B** — o hook prende? a estrutura sustenta?
- **Checagem de marcas de IA** — soa humano ou tem cara de gerado? (antecipa o `humanize-pt-br`)
- **Voz da marca** — bate com o `voz.md`? não copia o tom da referência?

Rubrica:

| Nota | Significado |
|---|---|
| 9-10 | pronto para publicar |
| 7-8 | forte, ajustes menores |
| 5-6 | funciona, mas tem lacuna clara |
| 3-4 | problema significativo |
| 1-2 | repensar |

## Anti-padrões (nomeie a falha)

- **Rascunho de nome trocável** — troque a empresa no texto: se o post continua igual, puxe o específico do usuário (`voz.md`, catálogo).
- **On-ramp quebrado** — a segunda linha abandona a promessa do hook e pula para o pitch.
- **Contradição do catálogo** — o usuário pede formato/ângulo que o catálogo mostrou não engajar naquela empresa. Sinalize o desvio antes de obedecer.
- **Hook aposentado** — a abertura bate na lista de `moldes.md` (Hooks aposentados). Troque pela alternativa indicada.
- **CTA sem nome** — fecho genérico que falha a regra do verbo nomeado de `moldes.md` (CTAs), ou que pede mais de uma ação.
- **Isca de engajamento** — "comente SIM que eu mando", corrente de marcação, pedido artificial de reação. O algoritmo pune e a audiência percebe; engajamento se ganha com a pergunta que o post tornou inevitável.
