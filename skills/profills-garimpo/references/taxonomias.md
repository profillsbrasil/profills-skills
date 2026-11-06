# Taxonomias fechadas

Classificar com listas fechadas — em vez de rótulo livre a cada post — é o que torna o catálogo **agregável e comparável entre empresas**. "70% dos outliers da empresa X são hook de confissão" só é possível se "confissão" for um valor fixo, não uma paráfrase diferente a cada vez.

Adaptado (traduzido) do repositório MIT [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills).

## Formato do post

A coluna **Como reconhecer** separa o que o JS de `navegacao.md` já devolve em `formato` do que exige você olhar o post — sem essa checagem manual, todo `poll`, `newsletter`, `evento`, `documento` e `reshare` cai em `texto` ou `imagem`.

| Valor | O que é | Como reconhecer |
|---|---|---|
| `texto` | só texto | JS |
| `imagem` | texto + 1 imagem | JS |
| `carrossel` | documento/PDF de múltiplos slides (classifique também o `framework_carrossel`) | JS |
| `video` | vídeo nativo | JS |
| `artigo` | link para artigo/newsletter do LinkedIn | JS |
| `documento` | anexo de documento não-carrossel | manual: card de arquivo com uma página só, sem navegação entre slides |
| `poll` | enquete | manual: bloco de opções com barra de porcentagem e "N votos" |
| `newsletter` | edição de newsletter nativa da página (assinatura em série) | manual: o card de artigo traz nome da newsletter + "Edição N" ou botão Assinar |
| `evento` | criação/divulgação de evento do LinkedIn | manual: card com data/hora e botão de participação |
| `reshare` | repost de outro post (marque de quem, se relevante) | manual: post embutido com o autor original dentro do card |

## Framework de carrossel

Só quando o formato é carrossel/documento. Os 5 padrões de arquitetura de slides:

| Valor | Estrutura |
|---|---|
| `Value-Stack` | empilha benefícios/itens de valor, um por slide |
| `Problem-Proof` | problema → agitação → prova/solução |
| `Hack-List` | lista numerada de táticas, cada slide nomeia uma |
| `Rant-Callout` | opinião forte/desabafo, slides curtos e enfáticos |
| `Demo-Walkthrough` | passo a passo de um processo/produto |

Carrossel se julga por saves/comentários, não por likes. Quando um carrossel performa mal, a causa costuma ser o slide 1 ou o framework errado — não os slides do meio.

## Categoria de hook (8 "opening moves")

A primeira linha decide se alguém lê o resto. As oito aberturas:

| Valor | O que faz | Cuidado |
|---|---|---|
| `curiosity-gap` | segura o substantivo ("ninguém te conta o que causa isso") | tem que pagar a promessa, senão é clickbait |
| `bold-claim` | afirmação específica e falseável ("isso substituiu minha rotina inteira") | precisa de sustentação |
| `first-person-confession` | "eu estava fazendo X completamente errado" | soa falso sem detalhe vivido |
| `contrast` | dois estados no primeiro golpe (antes/depois) | — |
| `relatability` | espelha uma situação hiperespecífica ("POV: são 15h e você está no quarto café") | — |
| `question` | pergunta exata que o público digitaria | — |
| `countdown` | contagem/gamificado ("dia 1 de...") | — |
| `proof-first` | lidera com o recibo (o número, o resultado) | — |

## Ângulo retórico (7)

O ângulo do post, além do tema. Da "angle library" do PR:

| Valor | Fórmula |
|---|---|
| `dado` | um dado quente / estatística própria |
| `contrarian` | opinião contrária ao senso comum do setor |
| `previmos-isso` | "a gente já dizia isso há X meses" |
| `historia-cliente` | impacto num cliente real |
| `insider` | explicação de bastidor que só quem é de dentro sabe |
| `trend` | conecta com uma tendência/notícia do momento |
| `founder-pov` | ponto de vista pessoal do fundador/liderança |

## Gatilho psicológico

O gatilho dominante do post, quando há um claro (`null` se ambíguo). Subconjunto útil do catálogo de modelos mentais:

| Valor | O que aciona |
|---|---|
| `social-proof` | "N pessoas/empresas usam" — prova social |
| `scarcity` | escassez / vagas limitadas / urgência |
| `pratfall` | admite um erro/fraqueza (aumenta credibilidade) |
| `zeigarnik` | loop aberto / suspense que pede fechamento |
| `contrast` | efeito de contraste (antes×depois, caro×barato) |
| `authority` | autoridade / especialista / dado de pesquisa |
| `reciprocity` | dá valor de graça esperando reciprocidade |
| `bandwagon` | "todo mundo está fazendo" — efeito manada |
