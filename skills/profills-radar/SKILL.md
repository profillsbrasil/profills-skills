---
name: profills-radar
description: >-
  Lista de empresas de referência do LinkedIn: escolhe quais catalogar
  nesta rodada e gerencia a lista. Use para "adiciona a empresa X",
  "quais empresas eu acompanho", "atualiza os dados da Y", ou quando a
  profills-garimpo não encontra DADOS/selection.md. Não use para ver o
  que elas postam — isso é a profills-garimpo.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-radar

Você mantém a **memória de referências**: a lista de empresas que o usuário observa no LinkedIn para tirar ideias de conteúdo. O entregável é uma **seleção** de até 5 empresas em `DADOS/selection.md`, que a `profills-garimpo` coleta em seguida.

## O índice é um mapa, não um armazém

A memória vive em `DADOS/refs/`:

- `INDEX.md` — uma linha por empresa, no formato fixo abaixo. O índice resume e aponta.
- `<slug>.md` — a ficha da empresa: tudo que a pesquisa levantou. Cada fato vive num lugar só, aqui.

Cabeçalho do `INDEX.md`, com o qual você cria o arquivo quando ele não existe:

```markdown
# Índice de referências — empresas do LinkedIn

## Empresas
```

E uma linha por empresa, nesta ordem de campos:

```markdown
- [Nome](<slug>.md) — `<slug>` · id <id numérico ou —> · <setor> · <país> · pesquisa AAAA-MM-DD · catálogo AAAA-MM-DD
```

O campo `catálogo` nasce como `sem catálogo` e quem o troca pela data é a `profills-garimpo`, ao fim de cada coleta — você lê esse campo, ela escreve. Quando a pesquisa mostrar presença digital fraca (audiência de dezenas de seguidores, meses sem publicar), feche a linha com `· ⚠ <uma frase>`: é essa empresa que produz catálogo vazio depois.

Na conversa, chame cada empresa **pelo nome**. O slug e o id numérico são endereço de máquina — eles vivem nos arquivos de handoff (`INDEX.md`, `selection.md`), e na fala com o usuário viram "o endereço dela no LinkedIn"; `<slug>.md` vira "a ficha da empresa".

## Fluxo

### 0. Resolva os dados e escolha a branch

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

Depois leia `DADOS/refs/INDEX.md` e decida:

- **Arquivo ausente ou sem nenhuma linha de empresa** → [Primeira run](#primeira-run). Crie o `INDEX.md` com o cabeçalho acima antes de escrever a primeira linha.
- **Índice com empresas**, e o pedido é catalogar (do usuário ou da `profills-garimpo`) → [Seleção](#seleção).
- **Pedido sobre a lista** — "adiciona", "remove", "atualiza", "quais eu acompanho" → [Gestão](#gestão).

Concluído quando `DADOS/refs/INDEX.md` existe, nem que seja só com o cabeçalho, e você nomeou a branch que vai seguir.

### Primeira run

A memória está vazia. O usuário não sabe que precisa povoar a lista, e um comercial que nunca pensou nisso trava se você pedir "3 a 5 empresas" do nada — comece pelo que ele sabe responder.

1. **Descubra o nicho dele.** Se `DADOS/voz.md` existir, leia: o que ele vende e para quem já está lá. Senão, pergunte em prosa, em uma frase, o que a empresa dele vende e para quem. Concluído quando você consegue nomear o setor e o público.

2. **Pesquise 4-6 candidatas reais** desse setor via WebSearch/WebFetch: concorrentes, líderes do nicho, quem publica com regularidade no LinkedIn em pt-BR. Concluído quando cada candidata tem nome, o que faz e uma razão de uma frase para acompanhá-la.

3. **Ofereça as candidatas** com `AskUserQuestion` (multiSelect): uma opção por empresa com a razão de uma frase, mais a opção "tenho outras em mente" — aí aceite nome ou URL (`linkedin.com/company/<slug>`). Diga que 3 a 5 empresas bastam para começar. Se ele hesitar ou disser que não sabe, proponha as três candidatas mais fortes com o porquê, em vez de repetir a pergunta. Concluído quando existe uma lista aprovada por ele, com pelo menos uma empresa.

4. **Faça cada empresa aprovada entrar** por [Como entra uma empresa nova](#como-entra-uma-empresa-nova), inteiro.

5. **Ofereça as similares** que as pesquisas do passo 4 descobriram, com `AskUserQuestion` (multiSelect): "achei estas empresas parecidas — quer adicionar alguma?". As aprovadas entram pelo mesmo caminho do passo 4.

6. Escreva a [seleção](#a-seleção) com as empresas que ele quer catalogar agora.

### Como entra uma empresa nova

Vale para a primeira run, para as similares aprovadas e para o "adiciona a empresa X" da Gestão — sempre os três passos, nunca só a pesquisa.

1. **Pesquise a empresa** via WebSearch/WebFetch: seu conhecimento tem corte temporal e setor muda. Três eixos:
   - **Contexto**: setor, porte, o que faz, posicionamento, notícias recentes. É a moldura para interpretar os posts depois — saber que a empresa lançou produto semana passada explica uma leva de posts.
   - **Similares**: 2-4 empresas parecidas ou concorrentes que valem a pena acompanhar.
   - **Tendências do setor**: temas, formatos e pautas em alta no nicho agora.

   Concluído quando os três eixos têm resposta vinda de uma busca desta sessão.

2. **Resolva o endereço no LinkedIn**: o slug (`linkedin.com/company/<slug>`) e, quando a página mostrar, o id numérico — o slug muda em rebranding, o id não.
   - Duas ou mais páginas plausíveis (homônimos, matriz e filial): mostre 2-3 candidatas com nome, seguidores e cidade, e peça ao usuário para confirmar qual é.
   - Nenhuma candidata: diga que não achou a página dessa empresa no LinkedIn, escreva a ficha com `—` no lugar do slug e ofereça seguir sem ela na seleção, porque a `profills-garimpo` só coleta quem tem página.

   Concluído quando a ficha tem o slug ou o motivo pelo qual não tem.

3. **Escreva a ficha** em `DADOS/refs/<slug>.md` seguindo `assets/dossie-template.md` e acrescente a linha da empresa no `INDEX.md`, com o id resolvido no passo 2 (ou `—`), `pesquisa <data de hoje>` e `sem catálogo`.

   Concluído quando toda seção do template está preenchida ou carrega o motivo de estar vazia — com duas exceções: `## Do Not Copy` fica com o comentário do template até a `profills-garimpo` perguntar ao usuário, e `## Histórico` só ganha conteúdo na primeira re-pesquisa.

### Seleção

A memória já tem empresas: mostre o que você já conhece, em vez de pedir links de novo.

1. **Apresente as empresas do índice** com `AskUserQuestion` (multiSelect) para o usuário escolher quais catalogar desta vez. Cada opção leva o nome, o setor e o campo `catálogo` da linha ("catalogada em 12/08" ou "nunca catalogada"). Concluído quando ele escolheu pelo menos uma.

2. **Segure em 5.** Coletar mais de 5 empresas vira uma sessão longa de navegação no LinkedIn. Se ele marcar mais, peça para priorizar as 5 mais relevantes e diga que as outras entram na próxima rodada; se ele mantiver a escolha depois de ouvir a razão, escreva as 5 primeiras da ordem de prioridade dele e diga quais ficaram de fora.

3. **Ofereça o que está atrasado**, quando houver: empresa similar já descoberta que ainda não virou ficha, ou empresa cujo campo `pesquisa` tem mais de 60 dias — nesse caso a rota é [Atualizar](#gestão). Sem nenhum dos dois casos, diga que a lista está fresca e siga.

4. Escreva a [seleção](#a-seleção).

### Gestão

Pedidos sobre a lista, sem catalogar:

- **Adicionar** → [Como entra uma empresa nova](#como-entra-uma-empresa-nova), os três passos.
- **Remover** → tire a linha do índice e mantenha a ficha no disco como histórico; apague o arquivo só se ele pedir.
- **Atualizar / re-pesquisar** → refaça os três eixos de pesquisa, mova o conteúdo anterior da ficha para `## Histórico` com a data em que ele valia, escreva o novo por cima e troque o campo `pesquisa` da linha do índice pela data de hoje. Concluído quando a ficha carrega duas datas: a de hoje no topo e a anterior no histórico.
- **Listar** → leia o índice e mostre as empresas por nome, com setor, quando foram pesquisadas e quando foram catalogadas pela última vez.

### A seleção

O handoff para a `profills-garimpo` é `DADOS/selection.md`. Sobrescreva-o a cada rodada — ele é efêmero, e o que precisa durar já está nas fichas:

```markdown
# Seleção ativa — 2026-08-24

- [Nubank](refs/nubank.md) — `nubank` · id 15216 · fintech · BR
- [Anthropic](refs/anthropic.md) — `anthropic` · id — · IA · global
```

O `id` é obrigatório na linha e vem da linha da empresa no `INDEX.md`; `—` quando o índice também não tem. Índice antigo sem o campo id: acrescente `id —` na linha ao lê-la, e resolva o id na próxima re-pesquisa. É por ele que a `profills-garimpo` reencontra a página quando o slug mudou.

Concluído quando cada empresa escolhida tem `refs/<slug>.md`, uma linha no `INDEX.md` e uma linha no `selection.md`; são no máximo 5; e o usuário ouviu, pelo nome, quais entraram.

### Feche

- **A `profills-garimpo` invocou você**: assim que o `selection.md` estiver escrito, devolva o controle a ela — a coleta continua de onde parou, sem sugestão sua.
- **O usuário chamou você**: termine com uma sugestão só — rodar a `profills-garimpo` para coletar as empresas escolhidas.

## Guarda-corpos

- **Similar sugerida é proposta, não fato.** Empresa entra na lista com o aval do usuário, e a ficha guarda o que a pesquisa sustentou — cada afirmação com a fonte que a produziu.
