<!--
Andaime do boletim. Ao gravar DADOS/boletins/AAAA-MM-DD.md: troque cada <campo> pelo valor do JSON do
boletim.js, apague as seções de exemplo que não se aplicam e não deixe nenhum comentário HTML no arquivo.
Medido = copiado do JSON. Inferido = leitura sua, sempre com o rótulo "(inferido)".
-->
# Boletim dos concorrentes — <DD/MM/AAAA>

Rodada de <DD/MM/AAAA do rodada.data>: <rodada.n_empresas> empresas, <n de rodada.coletadas> coletadas, <totais.posts_novos> posts novos.

> Anúncio feito só para campanha não aparece na página da empresa; este boletim cobre as publicações.

## Novidades

### <Nome da empresa>

<"Primeira coleta desta empresa: todos os posts da janela contam como novos." quando primeira_coleta é true>
<"Cadência: <anterior.posts_por_semana> posts por semana em <DD/MM> e <atual.posts_por_semana> em <DD/MM>." quando cadencia existe; com mesma_janela false, diga que as janelas diferem e não compare>

- **<DD/MM>**, <formato>, gancho "<hook literal>". [Ver no LinkedIn](<url>). <likes> curtidas, <comentarios> comentários, <reposts> compartilhamentos.
  - Resumo em português: <resumo_pt>. <só quando estrangeiro é true>
  - O que isso indica para você (inferido): <uma frase, ligada ao que o voz.md diz que você vende; sem voz.md, ligada ao setor>

## Cobertura

| Situação | Empresas |
|---|---|
| Com novidade | <nomes de cobertura.com_novidade, ou "nenhuma"> |
| Sem novidade | <nomes, com a nota quando houver ("não postou nos últimos 7 dias")> |
| Indisponível | <nomes, cada um com o motivo em palavras simples ("a página não abriu", "ainda não coletada nesta rodada")> |
| Sem LinkedIn | <nomes, ou "nenhuma"> |
| Fora desta rodada | <nomes, ou "nenhuma"> |

## Pautas para você (inferido)

1. **<título da pauta em pt-BR>**
   - Ângulo: <ângulo, da taxonomia de ângulos>.
   - Apoia-se em: o post de <DD/MM> da <Nome da empresa> ([link](<url>)), que <o que o post fez, em uma frase>.
   - Por que serve para você: <uma frase>.
2. **<título>**
   - Ângulo: <ângulo>.
   - Apoia-se em: <post>.
   - Por que serve para você: <frase>.
3. **<título>**
   - Ângulo: <ângulo>.
   - Apoia-se em: <post>.
   - Por que serve para você: <frase>.

Para escrever um post, peça: "gera um post da pauta 1 do boletim".
