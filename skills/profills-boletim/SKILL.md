---
name: profills-boletim
description: >-
  Boletim do que os concorrentes publicaram no LinkedIn: novidades,
  cobertura e 3 pautas. Use para "o que os concorrentes fizeram",
  "boletim dos concorrentes", "novidades da semana". Não use para
  escrever o post (profills-post) nem gerir a lista (profills-radar).
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-boletim

Você responde "o que os concorrentes fizeram". O entregável é um arquivo, `DADOS/boletins/AAAA-MM-DD.md`, com o que cada empresa da rodada publicou de novo, quem ficou sem cobertura e por quê, e 3 pautas em pt-BR que a `profills-post` transforma em post. Nada é agendado: o boletim nasce quando alguém pede.

Quem usa é o comercial, não dev. Fale das empresas pelo nome; slug, `posts.json` e balde são vocabulário seu. Antes de cada passo longo (pesquisa, coleta), diga em uma frase o que vai acontecer.

## Medido vs inferido

Data, link, formato, gancho, idioma, engajamento e cadência são medidos: saem do JSON do `boletim.js`, que os lê das coletas. O que o post indica para o comercial e as pautas são leitura sua e levam o rótulo "(inferido)" no arquivo. Você não recalcula número nenhum.

## Fluxo

### 0. Resolva os dados

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, ou se `DADOS/.profills.json` falta ou traz `versao_dados` menor que 2, invoque a skill `profills-setup` — ela cria ou atualiza a pasta e confere o resto da instalação.

Concluído quando você tem o caminho absoluto de `DADOS` e ele existe no disco.

### 1. Monte a rodada

Invoque a `profills-radar` para a seleção desta rodada. Ela monta a lista pelas camadas de prioridade, pergunta o que faltar (prioridade de empresa nova, troca de empresa) e grava `DADOS/selection.md` com a data no cabeçalho. Lista vazia é com ela também: a radar conduz a primeira run.

Se o `selection.md` já existe com a data de hoje no cabeçalho, a rodada de hoje já foi montada: diga isso e siga sem reabrir a seleção, a não ser que o comercial peça outra.

Concluído quando o `selection.md` tem a data de hoje no cabeçalho.

### 2. Garanta a coleta

Rode o script (passo 3) e leia `rodada.faltam_coletar`. Lista vazia: todas as empresas da rodada já têm coleta desta rodada, siga.

Lista com empresas: invoque a `profills-garimpo`. Ela conduz o navegador logado do comercial, conta o tamanho da rodada e o tempo, e oferece as saídas (rodada inteira, só as de prioridade Alta, deixar para depois). Quando ela devolver o controle, rode o script de novo. Se o comercial deixou parte para depois, siga com o que foi coletado: as que faltam entram no boletim como indisponíveis, com o motivo "ainda não coletada nesta rodada".

Concluído quando `faltam_coletar` está vazio ou o comercial escolheu deixar as restantes para depois.

### 3. Rode a conta

```bash
node "<pasta desta skill>/scripts/boletim.js" "<DADOS>"
```

"Pasta desta skill" é o diretório onde este `SKILL.md` está. Sai JSON em stdout. Exit 0 = ok; 1 = o índice ou a seleção impedem o boletim (leia `problemas`: `indice_ausente`, `indice_com_problemas` e `selecao_ausente` voltam à `profills-radar`); 2 = pasta errada.

| Campo | Para que serve |
|---|---|
| `empresas[].cobertura` | o balde de cada empresa, um só: `com_novidade`, `sem_novidade`, `indisponivel`, `sem_linkedin`, `fora_desta_rodada` |
| `empresas[].motivo`, `nota` | por que a empresa está no balde (`erro_navegacao`, `coleta_com_erro`, `nao_coletada_nesta_rodada`, `sem_posts`…), e a frase da coleta |
| `empresas[].novos[]` | os posts da coleta mais recente que não estavam na anterior: `data`, `url`, `formato`, `hook`, `angulo`, `idioma`, `estrangeiro`, `resumo_pt`, `engajamento`, `destaque_da_coleta` |
| `empresas[].primeira_coleta` | `true` quando não há coleta anterior: todos os posts da janela contam como novos |
| `empresas[].cadencia` | `posts_por_semana` da coleta anterior e da atual e a `diferenca`; `mesma_janela: false` quer dizer que não se compara |
| `cobertura`, `rodada`, `totais` | a matriz, a data e o tamanho da rodada, o total de posts novos |
| `voz_existe`, `boletim_do_dia_existe` | se há `voz.md` para ler; se o arquivo de hoje vai ser sobrescrito |
| `avisos[]` | `resumo_pt_ausente` (leia o texto no `posts.json` da pasta indicada e resuma você, com o rótulo "(inferido)"), `janelas_diferentes`, `post_sem_chave`, `selecao_fora_do_indice` |

Concluído quando o script voltou exit 0 e você tem o JSON.

### 4. Escreva o boletim

Com `voz_existe: true`, leia `DADOS/voz.md` antes: o que o comercial vende e para quem decide o que cada novidade indica. Sem voz, escreva a leitura pelo setor e siga; o boletim não para para montar a voz.

Grave `DADOS/<arquivo_boletim>` seguindo `assets/boletim-template.md`. Segunda rodada no mesmo dia sobrescreve o arquivo do dia; com `boletim_do_dia_existe: true`, diga isso em uma frase.

- **Cabeçalho**: a data de hoje, a data e o tamanho da rodada, e o aviso fixo de uma linha do template sobre anúncios de campanha.
- **Novidades**: uma seção por empresa de `com_novidade`, cada post com data, link, formato, gancho literal e engajamento copiados do JSON. Post com `estrangeiro: true` leva o `resumo_pt`; o gancho fica no idioma original. `primeira_coleta: true` vira a frase do template. Cada post ganha uma frase "(inferido)" sobre o que ele indica para o comercial.
- **Cobertura**: a tabela dos cinco baldes, com todas as empresas do índice, cada uma num balde só, e o motivo em palavras simples.
- **Pautas**: 3 pautas originais em pt-BR. Cada uma cita o post que a sustenta (empresa, data, link) e o ângulo da taxonomia (`../profills-garimpo/references/taxonomias.md`). Reuse o tema e o ângulo, nunca o texto: nada de frase copiada nem traduzida do post. Sem nenhum post novo na rodada, apoie as pautas nos posts da coleta mais recente de cada empresa (o `posts.json` da `coleta_atual.pasta`) e diga isso no cabeçalho das pautas; sem post nenhum em disco, escreva que não há pauta nesta rodada e por quê.

O arquivo não leva comentário HTML do template nem slug de empresa.

Concluído quando o arquivo existe, cada número dele bate com o JSON do script, a matriz cobre todas as empresas do índice, as pautas são 3 (ou a frase de por que não há) e cada uma cita um post com link.

### 5. Atualize o resumo da pasta

Rode `node "<pasta desta skill>/../profills-setup/scripts/mapa.js" "<DADOS>"`, que atualiza o resumo da pasta em `<DADOS>/CLAUDE.md`; se ele não voltar `ok: true`, avise em uma frase que o resumo não foi atualizado e siga.

### 6. Feche

Conte ao comercial, em poucas frases: quantas empresas publicaram algo novo, a novidade que mais salta (pelo nome da empresa), quem ficou sem cobertura e por quê, e o caminho do arquivo. Termine com uma sugestão só: pedir à `profills-post` "gera um post da pauta N do boletim", com a pauta que você recomenda e o porquê em uma frase.

## Compliance

Esta skill não navega. Quem abre o LinkedIn é a `profills-garimpo`, com as regras dela (`../profills-garimpo/references/compliance.md`): só leitura, ritmo humano, parada na detecção. Nada é curtido, comentado, conectado nem publicado, e o boletim fica só como arquivo na pasta de dados.
