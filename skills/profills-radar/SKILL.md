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

## O script é quem lê o índice

`scripts/indice.js` faz as três contas do índice — validar, reconstruir e procurar parecido. **Você usa a saída dele; não repita a conta em prosa** nem conte dias de cabeça:

```bash
node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs"                        # valida
node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs" --reconstruir          # refaz o índice a partir das fichas
node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs" --procurar "Maquimox"  # acha ficha parecida
```

Sai JSON em stdout; exit 0 = ok, 1 = alguma checagem falhou (leia `problemas`), 2 = erro de uso. O que a validação devolve e você consome direto:

| Campo | Para que serve |
|---|---|
| `indice_existe`, `n_empresas` | escolher a branch no passo 0 |
| `fichas_orfas` | fichas fora da lista — **não são problema de índice**: não derrubam `ok` e você as oferece ao usuário, não conserta sozinho |
| `empresas[]` (`nome`, `slug`, `id`, `setor`, `pais`, `pesquisa`, `catalogo`, `alerta`) | montar as opções da Seleção e a lista da Gestão, sem reabrir o arquivo |
| `dias_desde_pesquisa` e `pesquisa_vencida` (mais de 60 dias) | oferecer a re-pesquisa — a conta dos 60 dias é do script |
| `problemas[]` (`tipo`, `linha`, `detalhe`) | o que corrigir no `INDEX.md` antes de seguir — só formato e consistência do índice |

`--reconstruir` reescreve o `INDEX.md` a partir das fichas de `refs/` e **recupera o campo `catálogo` do disco**: para cada ficha ele procura `<DADOS>/catalog/raw/<slug>/<AAAA-MM-DD>/` (irmã de `refs/`; `--catalog "<pasta>"` sobrescreve o caminho) e usa a data mais recente que trouxe post — `meta.json` com `status: ok` ou `posts.json` não vazio. Coleta vazia não vira catálogo, e cada empresa sai em `escritas[]` com `catalogo`, `origem_catalogo` (`catalog/raw`, `índice anterior` ou `sem catálogo`) e `prova_catalogo`.

O `⚠`, ao contrário, **não é recuperável**: é frase sua, não dado de coleta, e nenhum arquivo do disco a guarda. Por isso a saída traz `avisos[]` com `alertas_perdidos` — com um índice anterior legível, ele lista as empresas cujo texto não existe mais; sem índice anterior nenhum, diz que os alertas ⚠ que existiam precisam ser refeitos. Leia esse aviso ao usuário e refaça os alertas com ele, empresa por empresa, em vez de seguir como se não houvesse nenhum.

`--procurar` normaliza sem acento e compara por distância: `ha_parecido` e `candidatos[]` com `semelhanca`.

Na conversa, chame cada empresa **pelo nome**. O slug e o id numérico são endereço de máquina — eles vivem nos arquivos de handoff (`INDEX.md`, `selection.md`), e na fala com o usuário viram "o endereço dela no LinkedIn"; `<slug>.md` vira "a ficha da empresa".

## Fluxo

### 0. Resolva os dados e escolha a branch

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

Depois rode `node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs"` e decida pela saída:

- **`indice_existe: false` e `fichas_orfas` vazio** (ou `pasta_existe: false`, ou índice sem nenhuma linha de empresa) → [Primeira run](#primeira-run). Crie a pasta `refs/` se ela faltar e o `INDEX.md` com o cabeçalho acima antes de escrever a primeira linha.
- **`indice_existe: false` e `fichas_orfas` com arquivos** — a memória existe, o mapa se perdeu: rode `--reconstruir`, diga ao usuário **quantas e quais empresas você recuperou**, quais voltaram com a data de catálogo achada em `catalog/raw/` e o que veio com `[a confirmar]` (campo `escritas[].campos_a_confirmar`), leia o aviso `alertas_perdidos` e refaça os `⚠` com ele, e siga para [Seleção](#seleção) — não é primeira run, e reaproveitar ficha velha sem avisar é pior que refazê-la. Empresa com `pesquisa_vencida` depois disso entra na oferta de re-pesquisa da Seleção.
- **Índice com empresas**, e o pedido é catalogar (do usuário ou da `profills-garimpo`) → [Seleção](#seleção).
- **Pedido sobre a lista** — "adiciona", "remove", "atualiza", "quais eu acompanho" → [Gestão](#gestão).

Se a saída trouxer `problemas` de formato (`id_invalido`, `data_pesquisa_invalida`, `linha_fora_do_formato`, `ficha_ausente`…), conserte as linhas apontadas antes de seguir e rode o script de novo até `ok: true` — cada `detalhe` diz o que era esperado. `problemas` é só do índice: linha torta, campo faltando, ficha que a linha promete e não existe.

**`fichas_orfas` não é problema seu para consertar.** São fichas fora da lista — removidas de propósito ou nunca indexadas — e o script já não derruba o `ok` por causa delas. Diga ao usuário, pelos nomes: "tenho estas fichas fora da lista (removidas ou nunca indexadas) — quer que eu volte alguma para o índice?". Reindexe só as que ele aprovar, com uma linha nova a partir da ficha; as outras ficam no disco como histórico.

Concluído quando o script rodou, `DADOS/refs/INDEX.md` existe (nem que seja só com o cabeçalho) e você nomeou a branch que vai seguir.

### Primeira run

A memória está vazia. O usuário não sabe que precisa povoar a lista, e um comercial que nunca pensou nisso trava se você pedir "3 a 5 empresas" do nada — comece pelo que ele sabe responder.

1. **Descubra o nicho dele.** Se `DADOS/voz.md` existir, leia: o que ele vende e para quem já está lá. Senão, pergunte em prosa, em uma frase, o que a empresa dele vende e para quem. Concluído quando você consegue nomear o setor e o público.

2. **Pesquise 4-6 candidatas reais** desse setor via WebSearch/WebFetch: concorrentes, líderes do nicho, quem publica com regularidade no LinkedIn em pt-BR. Concluído quando cada candidata tem nome, o que faz e uma razão de uma frase para acompanhá-la.

3. **Ofereça as candidatas** com `AskUserQuestion` (multiSelect): uma opção por empresa com a razão de uma frase, mais a opção "tenho outras em mente" — aí aceite nome ou URL (`linkedin.com/company/<slug>`). Diga que 3 a 5 empresas bastam para começar. Se ele hesitar ou disser que não sabe, proponha as três candidatas mais fortes com o porquê, em vez de repetir a pergunta. Concluído quando existe uma lista aprovada por ele, com pelo menos uma empresa.

4. **Faça cada empresa aprovada entrar** por [Como entra uma empresa nova](#como-entra-uma-empresa-nova), inteiro.

5. **Ofereça as similares** que as pesquisas do passo 4 descobriram, com `AskUserQuestion` (multiSelect): "achei estas empresas parecidas — quer adicionar alguma?". As aprovadas entram pelo mesmo caminho do passo 4.

6. Escreva a [seleção](#a-seleção) com as empresas que ele quer catalogar agora.

### Como entra uma empresa nova

Vale para a primeira run, para as similares aprovadas e para o "adiciona a empresa X" da Gestão — sempre os quatro passos, nunca só a pesquisa.

1. **Procure parecida antes de criar**: `node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs" --procurar "<nome que o usuário disse>"`. Com `ha_parecido: true`, pergunte ao usuário se é a mesma empresa, mostrando o nome do candidato ("já tenho a Maqinox indústria de Máquinas na sua lista — é essa mesma, escrita de outro jeito?"):
   - **É a mesma** → não crie ficha nova. Se a ficha dela está velha (`pesquisa_vencida` ou o usuário quer dados novos), siga por [Atualizar](#gestão); senão, diga que ela já está na lista desde quando.
   - **São diferentes** → siga para o passo 2 e registre na ficha nova, em uma linha, que a semelhança foi verificada com o usuário.

   Concluído quando o script rodou e, havendo candidato, o usuário disse se é a mesma.

2. **Pesquise a empresa** via WebSearch/WebFetch: seu conhecimento tem corte temporal e setor muda. Três eixos:
   - **Contexto**: setor, porte, o que faz, posicionamento, notícias recentes. É a moldura para interpretar os posts depois — saber que a empresa lançou produto semana passada explica uma leva de posts.
   - **Similares**: 2-4 empresas parecidas ou concorrentes que valem a pena acompanhar.
   - **Tendências do setor**: temas, formatos e pautas em alta no nicho agora.

   Concluído quando os três eixos têm resposta vinda de uma busca desta sessão.

3. **Resolva o endereço no LinkedIn**: o slug (`linkedin.com/company/<slug>`) e, quando a página mostrar, o id numérico — o slug muda em rebranding, o id não.
   - Duas ou mais páginas plausíveis (homônimos, matriz e filial): mostre 2-3 candidatas com nome, seguidores e cidade, e peça ao usuário para confirmar qual é. **Espere a resposta dele.** Enquanto ela não vier, a ficha fica com `[a confirmar]` no campo de confirmação e você não segue como se ele tivesse escolhido.
   - Nenhuma candidata: diga que não achou a página dessa empresa no LinkedIn, escreva a ficha com `—` no lugar do slug e ofereça seguir sem ela na seleção, porque a `profills-garimpo` só coleta quem tem página.

   Concluído quando a ficha tem o slug ou o motivo pelo qual não tem.

4. **Escreva a ficha** em `DADOS/refs/<slug>.md` seguindo `assets/dossie-template.md` e acrescente a linha da empresa no `INDEX.md`, com o id resolvido no passo 3 (ou `—`), `pesquisa <data de hoje>` e `sem catálogo`. Depois rode a validação do script; ela tem de voltar `ok: true` (ou só com problemas de outras linhas, já conhecidos).

   **Confirmação do usuário é citação, não paráfrase**: o campo `Confirmação do usuário` guarda a frase dele entre aspas e a data em que ele disse. Sem resposta real nesta sessão, o campo fica `[a confirmar]` — nunca escreva "o usuário confirmou" por conta própria.

   Concluído quando toda seção do template está preenchida ou carrega o motivo de estar vazia — com duas exceções: `## Do Not Copy` fica com o comentário do template até a `profills-garimpo` perguntar ao usuário, e `## Histórico` só ganha conteúdo na primeira re-pesquisa.

### Seleção

A memória já tem empresas: mostre o que você já conhece, em vez de pedir links de novo. A Seleção só começa com o script em `ok: true` — índice torto vira coleta na página errada. Havendo `fichas_orfas`, ofereça-as antes de perguntar o resto, como "fichas fora da lista (removidas ou nunca indexadas)", e reindexe as que ele aprovar.

1. **Apresente as empresas do índice** com `AskUserQuestion` (multiSelect) para o usuário escolher quais catalogar desta vez, usando o `empresas[]` da saída do script. Cada opção leva o `nome`, o `setor` e o campo `catalogo` ("catalogada em 12/08" ou "nunca catalogada"), e o `alerta` quando a empresa tem um. Concluído quando ele escolheu pelo menos uma.

2. **Segure em 5.** Coletar mais de 5 empresas vira uma sessão longa de navegação no LinkedIn. Essa razão vai **em texto que o usuário lê** — na própria pergunta, quando você já sabe que a lista passa de 5, ou na resposta seguinte. Se ele marcar mais de 5, peça para priorizar as 5 mais relevantes e diga que as outras entram na próxima rodada; se ele mantiver a escolha depois de ouvir a razão, escreva as 5 primeiras da ordem de prioridade dele e diga, pelo nome, quais ficaram de fora. Concluído quando o `selection.md` tem no máximo 5 empresas e o usuário leu por que esse é o teto.

3. **Ofereça o que está atrasado**, quando houver: empresa similar já descoberta que ainda não virou ficha, ou empresa que o script marcou com `pesquisa_vencida: true` — cite os `dias_desde_pesquisa` dela e mande para [Atualizar](#gestão). Com `pesquisa_vencida` vazio e nenhuma similar pendente, diga que a lista está fresca e siga.

4. Escreva a [seleção](#a-seleção).

### Gestão

Pedidos sobre a lista, sem catalogar:

- **Adicionar** → [Como entra uma empresa nova](#como-entra-uma-empresa-nova), os quatro passos, começando pelo `--procurar`.
- **Remover** → tire a linha do índice e mantenha a ficha no disco como histórico; apague o arquivo só se ele pedir. A ficha vira órfã de propósito — diga isso ao usuário, porque o script vai listá-la em `fichas_orfas` na próxima validação, como ficha fora da lista, sem reprovar o índice.
- **Atualizar / re-pesquisar** → refaça os três eixos de pesquisa, mova o conteúdo anterior da ficha para `## Histórico` **com o texto que estava lá, palavra por palavra**, sob a data em que ele valia; escreva o novo por cima e troque o campo `pesquisa` da linha do índice pela data de hoje. `## Por que é referência` e `## Do Not Copy` não são tocados. Concluído quando a ficha carrega duas datas — a de hoje no topo e a anterior no histórico — e o script volta `ok: true`.
- **Listar** → mostre as empresas do `empresas[]` da saída do script, por nome, com setor, `pesquisa`, `catalogo` e o `alerta` de quem tem. Só o que está no índice: se ele perguntar algo que a linha não carrega (seguidores, quantos posts), abra a ficha ou diga que ainda não sabe — não estime.

### A seleção

O handoff para a `profills-garimpo` é `DADOS/selection.md`. Sobrescreva-o a cada rodada — ele é efêmero, e o que precisa durar já está nas fichas:

```markdown
# Seleção ativa — 2026-08-24

- [Nubank](refs/nubank.md) — `nubank` · id 15216 · fintech · BR
- [Anthropic](refs/anthropic.md) — `anthropic` · id — · IA · global
```

**Valide o índice antes de escrever**: rode `node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs"` e só escreva o `selection.md` com `ok: true` — `fichas_orfas` cheio não impede nada, ele não entra no `ok`. Índice inválido é corrigido primeiro — a `profills-garimpo` navega pelo que estiver aqui, e linha torta vira coleta na página errada. `problemas` do tipo `id_invalido` numa linha antiga: acrescente `id —` e resolva o id na próxima re-pesquisa.

Cada campo da linha sai do `empresas[]` da saída do script — `nome`, `slug`, `id`, `setor`, `pais` — sem reescrever nem encurtar nada. O `id` é obrigatório; `—` quando o índice também não tem. É por ele que a `profills-garimpo` reencontra a página quando o slug mudou.

Concluído quando o script voltou `ok: true`, cada empresa escolhida tem `refs/<slug>.md`, uma linha no `INDEX.md` e uma linha no `selection.md`; são no máximo 5; e o usuário ouviu, pelo nome, quais entraram.

### Feche

- **A `profills-garimpo` invocou você**: assim que o `selection.md` estiver escrito, devolva o controle a ela — a coleta continua de onde parou, sem sugestão sua.
- **O usuário chamou você**: termine com uma sugestão só — rodar a `profills-garimpo` para coletar as empresas escolhidas.

## Guarda-corpos

- **Similar sugerida é proposta, não fato.** Empresa entra na lista com o aval do usuário, e a ficha guarda o que a pesquisa sustentou — cada afirmação com a fonte que a produziu.
