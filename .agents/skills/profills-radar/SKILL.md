---
name: profills-radar
description: >-
  Memória das empresas de referência do LinkedIn — a lista de quem você observa
  para se inspirar. Use ao começar qualquer pesquisa de "o que as empresas andam
  postando", ao escolher quais empresas catalogar desta vez, ou ao gerenciar essa
  lista ("adiciona a empresa X", "quais empresas eu acompanho", "atualiza os dados
  da Y"). Na primeira vez pede 3-5 empresas e pesquisa cada uma; depois só mostra
  as que já conhece para você escolher até 5. A skill profills-garimpo invoca esta
  automaticamente quando não há seleção ativa.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-radar

Você mantém a **memória de referências**: a lista de empresas que o usuário observa no LinkedIn para tirar ideias de conteúdo. Seu trabalho é entregar uma **seleção** de até 5 empresas para a `profills-garimpo` coletar — pedindo empresas novas quando a memória está vazia, ou deixando o usuário escolher entre as que já conhece.

## O índice é um mapa, não um armazém

A memória vive em `linkedin-data/refs/` na raiz deste repositório de skills (se não achar, rode `git rev-parse --show-toplevel`):

- `INDEX.md` — uma linha por empresa: nome, slug, setor, país, datas. O índice **resume e aponta**; nunca repete o conteúdo do dossiê.
- `<slug>.md` — o dossiê da empresa: tudo que a pesquisa levantou. Cada fato vive num lugar só, aqui.

Refira-se a cada empresa **pelo nome**, nunca pelo slug cru, no que o usuário lê.

## Escolha a branch

Leia `linkedin-data/refs/INDEX.md` e decida:

- **Índice sem empresas** (primeira execução) → siga [Primeira run](#primeira-run-onboarding).
- **Índice com empresas** e o usuário quer catalogar → siga [Seleção](#seleção-runs-seguintes).
- **Usuário quer mexer na lista** ("adiciona", "remove", "atualiza") → siga [Gestão](#gestão).

## Primeira run (onboarding)

A memória está vazia, então esta é a primeira vez. Diga isso ao usuário com naturalidade — ele não sabe que precisa popular a lista.

1. **Peça 3-5 empresas de referência** com `AskUserQuestion`. São a "competição" ou a inspiração — de quem ele quer tirar ideias. Aceite nome da empresa ou URL do LinkedIn (`linkedin.com/company/<slug>`). Deixe claro no texto que 3-5 é o ideal para começar sem virar trabalho.

2. **Pesquise cada empresa** para ter dados atuais (seu conhecimento tem corte temporal — não confie na memória). Para cada uma, levante três coisas via WebSearch/WebFetch:
   - **Contexto**: setor, porte, o que faz, posicionamento, notícias recentes. Isso vira a moldura para interpretar os posts depois — saber que a empresa lançou produto semana passada explica uma leva de posts.
   - **Similares**: 2-4 empresas parecidas ou concorrentes que valem a pena acompanhar.
   - **Tendências do setor**: o que está em alta no nicho agora (temas, formatos, pautas do momento).

3. **Resolva o slug** de cada empresa (`linkedin.com/company/<slug>`) e guarde também o ID numérico se conseguir — o slug muda em rebranding, o ID não.

4. **Escreva um dossiê** por empresa em `linkedin-data/refs/<slug>.md` seguindo `assets/dossie-template.md`, e adicione a linha correspondente no `INDEX.md`.

5. **Ofereça as similares** que a pesquisa descobriu com `AskUserQuestion` (multiSelect): "achei estas empresas parecidas — quer adicionar alguma?". As aprovadas viram dossiês também.

6. Termine escrevendo a [seleção](#a-seleção) com as empresas que o usuário quer catalogar agora (no máximo 5).

## Seleção (runs seguintes)

A memória já tem empresas. Não peça links de novo — mostre o que você já conhece.

1. **Apresente as empresas do índice** com `AskUserQuestion` (multiSelect) para o usuário escolher quais catalogar desta vez. Popule as opções com dados reais do índice (setor, quando foi o último catálogo).

2. **Segure em 5.** Se ele marcar mais de 5, aponte que coletar muitas empresas numa sessão vira uma navegação longa e arriscada no LinkedIn, e peça para priorizar as 5 mais relevantes. O limite protege a conta e o seu contexto.

3. **Sugira novidades** se fizer sentido: empresas similares que você descobriu antes mas ele ainda não catalogou, ou uma re-pesquisa de quem está com dados velhos (>60 dias desde a última pesquisa).

4. Escreva a [seleção](#a-seleção).

## A seleção

O handoff para a `profills-garimpo` é o arquivo `linkedin-data/selection.md`. Sobrescreva-o a cada run com as empresas escolhidas:

```markdown
# Seleção ativa — <data>

- [Nubank](refs/nubank.md) — `nubank` · fintech · BR
- [Anthropic](refs/anthropic.md) — `anthropic` · IA · global
```

Depois de escrever, diga ao usuário quais empresas entraram e que a `profills-garimpo` já pode coletá-las.

## Gestão

Pedidos avulsos sobre a lista, sem catalogar:

- **Adicionar** → pesquise (passo 2 da primeira run), escreva o dossiê, atualize o índice.
- **Remover** → tire a linha do índice; deixe o dossiê no disco (histórico) a menos que ele peça para apagar.
- **Atualizar / re-pesquisar** → refaça a pesquisa, atualize o dossiê preservando o histórico anterior numa seção `## Histórico`, e mude a data no índice.
- **Listar** → leia o índice e mostre as empresas por nome, com setor e datas.

## Conduza pela mão

O usuário pode nem saber que precisa popular a lista, ou quais empresas fazem sentido. **Guie**: na primeira run explique o que está acontecendo, sugira empresas quando ele hesitar, e ao terminar aponte o próximo passo (rodar a `profills-garimpo`). Nunca deixe o usuário travado sem saber o que fazer a seguir.

## Guarda-corpos

- **Pesquise antes de afirmar.** Empresa, setor e tendências mudam — todo dado do dossiê sai de uma busca desta sessão, não da sua memória. Datar cada pesquisa deixa isso auditável.
- **Nunca invente uma empresa** que o usuário não pediu nem que a pesquisa não sustentou. Similar sugerida é proposta, não fato — só entra na lista com o aval dele.
