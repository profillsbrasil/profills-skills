<!--
Andaime do boletim. Ao gravar DADOS/boletins/AAAA-MM-DD.md: troque cada <campo> pelo valor do JSON do
boletim.js, apague as seções de exemplo que não se aplicam e não deixe nenhum comentário HTML no arquivo.
Cada número é de uma rede: diga qual e nunca some nem compare o LinkedIn com o Instagram.
-->
# Boletim dos concorrentes — <DD/MM/AAAA>

Rodada de <DD/MM/AAAA do rodada.data>: <rodada.n_empresas> empresas em <rodada.n_contas> contas (LinkedIn e Instagram), <n de rodada.coletadas> contas coletadas, <totais.posts_novos> posts novos.

> Anúncio feito só para campanha não aparece na página da empresa; este boletim cobre as publicações.

## Novidades

### <Nome da empresa>

#### No LinkedIn

<"Primeira coleta desta página: todos os posts da janela contam como novos." quando primeira_coleta da conta é true>
<"Cadência: <anterior.posts_por_semana> posts por semana em <DD/MM> e <atual.posts_por_semana> em <DD/MM>." quando a conta tem cadencia; com mesma_janela false, diga que as janelas diferem e não compare>

- **<DD/MM>**, <formato>, gancho "<hook literal>". [Ver no LinkedIn](<url>). <likes> curtidas, <comentarios> comentários, <reposts> compartilhamentos.
  - Resumo em português: <resumo_pt>. <só quando estrangeiro é true>
  - O que isso indica para você (inferido): <uma frase, ligada ao que o voz.md diz que você vende; sem voz.md, ligada ao setor>

#### No Instagram

<"Primeira coleta deste perfil: todos os posts da janela contam como novos." quando primeira_coleta da conta é true>
<linha de cadência da conta do Instagram, como a do LinkedIn>

- **<DD/MM>**, <formato>, gancho "<hook literal>". [Ver no Instagram](<url>). <likes> curtidas, <comentarios> comentários, <reposts> reposts, <compartilhamentos> compartilhamentos.
  - Resumo em português: <resumo_pt>. <só quando estrangeiro é true>
  - O que isso indica para você (inferido): <uma frase>

<Conta da mesma empresa sem novidade nesta rodada, em vez da subseção dela: "No <rede>, nada novo desde <DD/MM da coleta_anterior>." com a cadência da conta quando houver. Conta indisponível: "No <rede>, sem cobertura: <motivo em palavras simples>.">

## Cobertura

| Situação | Empresas |
|---|---|
| Com novidade | <nomes de cobertura.com_novidade, ou "nenhuma"; empresa com duas contas na rodada leva a situação de cada rede entre parênteses ("Beta Rótulos (Instagram com novidade, LinkedIn sem novidade)")> |
| Sem novidade | <nomes, com a rede e a nota quando houver ("Alfa Envase (LinkedIn: não postou nos últimos 7 dias)")> |
| Indisponível | <nomes, cada um com a rede e o motivo em palavras simples ("a página não abriu", "ainda não coletada nesta rodada")> |
| Sem LinkedIn nem Instagram | <nomes de cobertura.sem_rede, ou "nenhuma"> |
| Fora desta rodada | <nomes, ou "nenhuma"> |

## Pautas para você (inferido)

1. **<título da pauta em pt-BR>**
   - Ângulo: <ângulo, da taxonomia de ângulos>.
   - Apoia-se em: o post de <DD/MM> da <Nome da empresa> no <LinkedIn ou Instagram> ([link](<url>)), que <o que o post fez, em uma frase>.
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
