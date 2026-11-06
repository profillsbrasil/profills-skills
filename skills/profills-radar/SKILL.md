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

Você mantém a **memória de referências**: a lista de empresas que o usuário observa no LinkedIn para tirar ideias de conteúdo. O entregável é uma **seleção** de até 12 empresas em `DADOS/selection.md`, que a `profills-garimpo` coleta em seguida. Quem entra em cada rodada sai das camadas de prioridade, contadas pelo script.

## O índice é um mapa, não um armazém

A memória vive em `DADOS/refs/`:

- `INDEX.md` — uma linha por empresa, no formato fixo abaixo. O índice resume e aponta.
- `<slug>.md` — a ficha da empresa: tudo que a pesquisa levantou. Cada fato vive num lugar só, aqui.

Cabeçalho do `INDEX.md`, com o qual você cria o arquivo quando ele não existe:

```markdown
# Índice de referências — empresas do LinkedIn

## Empresas
```

E uma linha por empresa. Cada campo vem depois de ` · ` e começa pela chave dele, nesta ordem:

```markdown
- [Nome](<slug>.md) — `<slug>` · id <número|—> · setor <texto> · país <texto> · prioridade <Alta|Média|Adjacente|Validação|a definir> · linkedin <sim|não> · pesquisa AAAA-MM-DD · <sem catálogo|catálogo AAAA-MM-DD> [· grupo <texto>] [· ⚠ <frase>]
```

| Campo | Obrigatório | O que vai |
|---|---|---|
| `id` | sim | o id numérico da página, ou `—` quando ela não mostrou |
| `setor`, `país` | sim | rótulo curto; texto livre sem o caractere `·` |
| `prioridade` | sim | `Alta`, `Média`, `Adjacente`, `Validação` ou `a definir` — a que o usuário disse; `a definir` enquanto ele não disse |
| `linkedin` | sim | `sim` quando a empresa tem página; `não` quando não tem, e aí a `profills-garimpo` não a coleta |
| `pesquisa` | sim | data da última pesquisa |
| `catálogo` | sim | nasce `sem catálogo`; quem troca pela data é a `profills-garimpo`, ao fim de cada coleta — você lê, ela escreve |
| `grupo` | não | o recorte em que o usuário agrupa a empresa, quando ele der um, ou o grupo que a importação achou pela regra do ID citado |
| `⚠` | não | sempre o último; leva o resto da linha. Use quando a pesquisa mostrar presença digital fraca (audiência de dezenas de seguidores, meses sem publicar): é essa empresa que produz catálogo vazio depois |

O slug só tem letras sem acento, números, `-` e `_`: é o nome da ficha e o endereço da página. Empresa sem página no LinkedIn ganha um slug feito do nome (`gama-embalagens`) e `linkedin não`.

## O script é quem lê o índice

`scripts/indice.js` faz as contas do índice: validar, montar a rodada, reconstruir e procurar parecido. **Você usa a saída dele; não repita a conta em prosa** nem conte dias de cabeça:

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
| `empresas[]` (`nome`, `slug`, `id`, `setor`, `pais`, `prioridade`, `linkedin` true/false, `pesquisa`, `catalogo`, `grupo`, `alerta`) | montar as opções da Seleção e a lista da Gestão, sem reabrir o arquivo |
| `dias_desde_pesquisa` e `pesquisa_vencida` (mais de 60 dias) | oferecer a re-pesquisa — a conta dos 60 dias é do script |
| `rodada` (`devidas`, `fora_do_limite`, `em_dia`, `sem_linkedin`, `a_definir`, `limite_por_rodada`) | montar a [Seleção](#seleção): cada empresa cai em um balde só, já em ordem de prioridade e do catálogo mais antigo |
| `problemas[]` (`tipo`, `linha`, `detalhe`) | o que corrigir no `INDEX.md` antes de seguir — só formato e consistência do índice |
| `avisos[]` com `catalogo_no_futuro` | a linha tem `catálogo` com data depois de hoje: diga ao usuário o nome da empresa e a data, e que ela entra na rodada como devida até a data ser corrigida. Não derruba o `ok` |

`--reconstruir` reescreve o `INDEX.md` a partir das fichas de `refs/`, sempre na ordem de campos acima. `prioridade` e `grupo` saem dos campos da ficha (ou da linha anterior do índice, quando a ficha não os tem; sem nenhum dos dois, `prioridade a definir`), e `linkedin` sai do endereço: `—` no endereço é `linkedin não`. Ele **recupera o campo `catálogo` do disco**: para cada ficha ele procura `<DADOS>/catalog/raw/<slug>/<AAAA-MM-DD>/` (irmã de `refs/`; `--catalog "<pasta>"` sobrescreve o caminho) e usa a data mais recente que trouxe post — `meta.json` com `status: ok` ou `posts.json` não vazio. Coleta vazia não vira catálogo, e cada empresa sai em `escritas[]` com `catalogo`, `origem_catalogo` (`catalog/raw`, `índice anterior` ou `sem catálogo`) e `prova_catalogo`.

O `⚠`, ao contrário, **não é recuperável**: é frase sua, não dado de coleta, e nenhum arquivo do disco a guarda. Por isso a saída traz `avisos[]` com `alertas_perdidos` — com um índice anterior legível, ele lista as empresas cujo texto não existe mais; sem índice anterior nenhum, diz que os alertas ⚠ que existiam precisam ser refeitos. Leia esse aviso ao usuário e refaça os alertas com ele, empresa por empresa, em vez de seguir como se não houvesse nenhum.

`--procurar` normaliza sem acento e compara por distância com o nome, o slug e o `Grupo` de cada ficha, e procura o nome inteiro na linha `Grupo e nomes relacionados`: `ha_parecido` e `candidatos[]` com `semelhanca` e `por` (`nome`, `slug`, `grupo` ou `nomes relacionados`). É assim que "Beta Envase" acha a ficha da Alfa Cartonagem quando a da Alfa cita a Beta Envase como divisão dela.

**As camadas da rodada** vivem na tabela `CAMADAS` do script, e a conta dos dias é dele:

| Prioridade | Entra na rodada quando |
|---|---|
| `Alta` | toda rodada |
| `Média` | o último catálogo tem 14 dias ou mais, ou nunca houve |
| `Adjacente`, `Validação` | o último catálogo tem 28 dias ou mais, ou nunca houve |
| `a definir` | ainda não entra: você pergunta a prioridade antes |

Empresa com `linkedin não` nunca entra em `devidas`. Passando de `LIMITE_POR_RODADA` (12), as demais vão para `fora_do_limite`, que é a fila da próxima rodada. Catálogo com data depois de hoje conta como devida e sai em `avisos[]`.

`scripts/importar.js` traz uma planilha de concorrentes para a lista ([Importar planilha](#importar-planilha)):

```bash
node "<pasta desta skill>/scripts/importar.js" "<planilha.xlsx>" "<DADOS>/refs"             # só simula
node "<pasta desta skill>/scripts/importar.js" "<planilha.xlsx>" "<DADOS>/refs" --aplicar   # grava fichas e linhas
```

`--pular <id_planilha>` (repetível) deixa uma linha da planilha de fora e a lista em `puladas[]`.

Ele lê as abas `Mapa competitivo` e `Canais digitais` pelo nome das colunas e devolve `novas[]`, `ja_existem[]`, `sem_linkedin[]`, `perfil_pessoal[]`, `puladas[]`, `problemas[]`, `resumo` e `ok`. Com qualquer item em `problemas[]` ele sai com exit 1 e não grava nada, nem com `--aplicar`; cada problema traz o `id_planilha` e a `linha` quando se refere a uma linha. Planilha corrompida ou arquivo que não é `.xlsx` sai com exit 2 e a frase em stderr. Prioridade escrita sem acento ou em outra caixa ("media", "ALTA") vale como a da lista. Rodar de novo com a mesma planilha não muda nada.

O `grupo` sai de uma regra só. Quando o texto de "Grupo e nomes relacionados" de uma linha cita o ID de outra linha, as duas ficam no mesmo grupo, e o grupo leva o nome da primeira delas na ordem da planilha. Se essa primeira empresa já está na lista, o grupo leva o nome que ela tem na lista. A empresa que já está na lista não ganha um grupo que é só o nome dela mesma; a nova ganha, para o recorte achar todas pelo mesmo nome.

Na conversa, chame cada empresa **pelo nome**. O slug e o id numérico são endereço de máquina — eles vivem nos arquivos de handoff (`INDEX.md`, `selection.md`), e na fala com o usuário viram "o endereço dela no LinkedIn"; `<slug>.md` vira "a ficha da empresa".

## Fluxo

### 0. Resolva os dados e escolha a branch

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, ou se `DADOS/.profills.json` falta ou traz `versao_dados` menor que 2, invoque a skill `profills-setup` — ela cria ou atualiza a pasta e confere o resto da instalação.

Depois rode `node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs"` e decida pela saída:

- **`indice_existe: false` e `fichas_orfas` vazio** (ou `pasta_existe: false`, ou índice sem nenhuma linha de empresa) → [Primeira run](#primeira-run). Crie a pasta `refs/` se ela faltar e o `INDEX.md` com o cabeçalho acima antes de escrever a primeira linha.
- **`indice_existe: false` e `fichas_orfas` com arquivos** — a memória existe, o mapa se perdeu: rode `--reconstruir`, diga ao usuário **quantas e quais empresas você recuperou**, quais voltaram com a data de catálogo achada em `catalog/raw/` e o que veio com `[a confirmar]` (campo `escritas[].campos_a_confirmar`), leia o aviso `alertas_perdidos` e refaça os `⚠` com ele, e siga para [Seleção](#seleção) — não é primeira run, e reaproveitar ficha velha sem avisar é pior que refazê-la. Empresa com `pesquisa_vencida` depois disso entra na oferta de re-pesquisa da Seleção.
- **Índice com empresas**, e o pedido é catalogar (do usuário ou da `profills-garimpo`) → [Seleção](#seleção).
- **Pedido sobre a lista** — "adiciona", "remove", "atualiza", "quais eu acompanho", "importa minha planilha" → [Gestão](#gestão).

Se a saída trouxer `problemas` de formato (`id_invalido`, `campo_ausente`, `campo_desconhecido`, `prioridade_invalida`, `slug_invalido`, `data_pesquisa_invalida`, `linha_fora_do_formato`, `ficha_ausente`…), conserte as linhas apontadas antes de seguir e rode o script de novo até `ok: true` — cada `detalhe` diz o que era esperado. `problemas` é só do índice: linha torta, campo faltando, ficha que a linha promete e não existe.

**`formato_antigo` não se conserta à mão.** Ele diz que a pasta de dados é de uma versão anterior das skills: invoque a `profills-setup`, que atualiza a pasta inteira com cópia de segurança, e volte quando ela devolver o controle.

**`fichas_orfas` não é problema seu para consertar.** São fichas fora da lista — removidas de propósito ou nunca indexadas — e o script já não derruba o `ok` por causa delas. Diga ao usuário, pelos nomes: "tenho estas fichas fora da lista (removidas ou nunca indexadas) — quer que eu volte alguma para o índice?". Reindexe só as que ele aprovar, com uma linha nova a partir da ficha; as outras ficam no disco como histórico.

Concluído quando o script rodou, `DADOS/refs/INDEX.md` existe (nem que seja só com o cabeçalho) e você nomeou a branch que vai seguir.

### Primeira run

A memória está vazia. O usuário não sabe que precisa povoar a lista, e um comercial que nunca pensou nisso trava se você pedir "3 a 5 empresas" do nada — comece pelo que ele sabe responder.

Se ele disser que já tem uma planilha de concorrentes, a lista começa por ela: siga [Importar planilha](#importar-planilha) e depois a [Seleção](#seleção).

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
   - Nenhuma candidata: diga que não achou a página dessa empresa no LinkedIn, escreva a ficha com `—` no endereço, dê a ela um slug feito do nome para o arquivo e a linha, marque `linkedin não` e ofereça seguir sem ela na seleção, porque a `profills-garimpo` só coleta quem tem página.

   Concluído quando a ficha tem o slug ou o motivo pelo qual não tem.

4. **Escreva a ficha** em `DADOS/refs/<slug>.md` seguindo `assets/dossie-template.md` e acrescente a linha da empresa no `INDEX.md`, no formato acima: o id resolvido no passo 3 (ou `—`), a `prioridade` que o usuário disse (`a definir` se ele não disse), `linkedin sim` ou `não` conforme o passo 3, `pesquisa <data de hoje>` e `sem catálogo`. A ficha repete `Prioridade` e `Grupo` nos campos do topo, porque é de lá que o `--reconstruir` os recupera. Depois rode a validação do script; ela tem de voltar `ok: true` (ou só com problemas de outras linhas, já conhecidos).

   **Confirmação do usuário é citação, não paráfrase**: o campo `Confirmação do usuário` guarda a frase dele entre aspas e a data em que ele disse. Sem resposta real nesta sessão, o campo fica `[a confirmar]` — nunca escreva "o usuário confirmou" por conta própria.

   Concluído quando toda seção do template está preenchida ou carrega o motivo de estar vazia — com duas exceções: `## Do Not Copy` fica com o comentário do template até a `profills-garimpo` perguntar ao usuário, e `## Histórico` só ganha conteúdo na primeira re-pesquisa.

### Seleção

A memória já tem empresas: mostre o que você já conhece, em vez de pedir links de novo. A Seleção só começa com o script em `ok: true` — índice torto vira coleta na página errada. Havendo `fichas_orfas`, ofereça-as antes de perguntar o resto, como "fichas fora da lista (removidas ou nunca indexadas)", e reindexe as que ele aprovar.

1. **Pergunte a prioridade que falta.** Empresa em `rodada.a_definir` não tem camada. Pergunte com `AskUserQuestion`, uma pergunta por empresa (até 4 por chamada), opções `Alta`, `Média`, `Adjacente` e `Validação`, cada uma com o que ela muda: Alta entra em toda rodada; Média, a cada 2 semanas; Adjacente e Validação, a cada 4. Grave a resposta no campo `prioridade` da linha do `INDEX.md` e no campo `Prioridade` da ficha (acrescente a linha abaixo do endereço quando a ficha não a tiver), e rode o script de novo. Se ele não quiser decidir agora ("deixa a definir"), a empresa fica `a definir` e entra no passo 2 como opção fora da rodada. Concluído quando `a_definir` está vazio ou ele disse que deixa para depois.

2. **Ofereça a rodada calculada.** Mostre em texto as empresas de `rodada.devidas`, pelo nome, cada uma com a prioridade e o último catálogo ("catalogada em 12/08" ou "nunca catalogada"), e o `alerta` de quem tem. Elas já vêm marcadas: pergunte com `AskUserQuestion` se ele segue com essa rodada (opção recomendada), quer tirar ou trocar alguma, ou quer só as de prioridade Alta. Quem pediu ajuste diz os nomes; as opções de troca são as de `fora_do_limite`, `em_dia` e as `a definir` que ficaram. Diga quantas ficaram em `fora_do_limite` e cite pelo nome só as 3 primeiras, que entram primeiro na próxima rodada ("ficaram 15 para a próxima rodada, começando por A, B e C"); com 3 ou menos, cite todas. As de `sem_linkedin` não entram, porque não há página para coletar; diga isso uma vez, sem listá-las a cada rodada. Concluído quando ele aprovou a lista da rodada.

   **O teto é 12.** A `profills-garimpo` coleta no navegador logado dele, e cada empresa custa algumas páginas (a lista de posts, a rolagem, a página da empresa). Com 12 empresas a sessão já soma dezenas de páginas, o volume que a regra de coleta da garimpo aceita; passar disso vira rajada, que o LinkedIn pode ler como robô e travar a conta dele. Essa razão vai **em texto que o usuário lê**, na própria pergunta quando a rodada chega a 12 ou na resposta seguinte se ele pedir mais. Se ele pedir mais de 12, peça para escolher as 12 desta vez e diga que as outras entram na próxima; se ele mantiver o pedido depois de ouvir a razão, escreva as 12 primeiras na ordem da rodada e diga, pelo nome, quais ficaram de fora. Concluído quando o `selection.md` tem no máximo 12 empresas e o usuário leu por que esse é o teto.

3. **Ofereça o que está atrasado**, quando houver: empresa similar já descoberta que ainda não virou ficha, ou empresa que o script marcou com `pesquisa_vencida: true` — cite os `dias_desde_pesquisa` dela e mande para [Atualizar](#gestão). Com `pesquisa_vencida` vazio e nenhuma similar pendente, diga que a lista está fresca e siga.

4. Escreva a [seleção](#a-seleção).

### Gestão

Pedidos sobre a lista, sem catalogar:

- **Adicionar** → [Como entra uma empresa nova](#como-entra-uma-empresa-nova), os quatro passos, começando pelo `--procurar`.
- **Importar planilha** → [Importar planilha](#importar-planilha).
- **Remover** → tire a linha do índice e mantenha a ficha no disco como histórico; apague o arquivo só se ele pedir. A ficha vira órfã de propósito — diga isso ao usuário, porque o script vai listá-la em `fichas_orfas` na próxima validação, como ficha fora da lista, sem reprovar o índice.
- **Atualizar / re-pesquisar** → refaça os três eixos de pesquisa, mova o conteúdo anterior da ficha para `## Histórico` **com o texto que estava lá, palavra por palavra**, sob a data em que ele valia; escreva o novo por cima e troque o campo `pesquisa` da linha do índice pela data de hoje. `## Por que é referência` e `## Do Not Copy` não são tocados. Concluído quando a ficha carrega duas datas — a de hoje no topo e a anterior no histórico — e o script volta `ok: true`.
- **Listar** → mostre as empresas do `empresas[]` da saída do script, por nome, com setor, `pesquisa`, `catalogo` e o `alerta` de quem tem. Só o que está no índice: se ele perguntar algo que a linha não carrega (seguidores, quantos posts), abra a ficha ou diga que ainda não sabe — não estime.

### Importar planilha

O comercial tem uma planilha de concorrentes (`.xlsx`) e quer a lista inteira de uma vez. Conduza pela mão: ele não precisa saber o que é slug, aba ou JSON.

1. **Ache a planilha.** Peça o arquivo pelo nome ou pelo caminho ("está na pasta Downloads"). Concluído quando você tem o caminho de um `.xlsx` que existe.

2. **Simule.** Rode o `importar.js` sem `--aplicar`. Com `problemas[]` cheio, nada foi gravado. Trate cada tipo pela tabela abaixo, rode a simulação de novo e repita até `ok: true`. Fale com o comercial pela aba, pela linha e pelo nome da empresa, que é como ele acha a célula no Excel.

   | Tipo | O que dizer ao comercial e o que fazer |
   |---|---|
   | exit 2, "planilha corrompida" ou "não é um .xlsx" | "O arquivo veio estragado ou não é uma planilha do Excel. Abra no Excel e salve de novo como .xlsx, ou baixe outra cópia." Rode de novo com o arquivo novo |
   | `aba_ausente` | "Não achei a aba X. Ela tem outro nome na sua planilha?" Com o nome certo, peça para ele renomear a aba para X |
   | `cabecalho_nao_encontrado` | "Na aba X não achei a linha com os nomes das colunas (ID, Empresa / unidade…). A planilha é essa mesma?" |
   | `coluna_ausente` | "Na aba X falta a coluna Y. Ela tem outro nome aí?" Peça para ele renomear o título da coluna para Y |
   | `celula_vazia` | "Na aba X, linha N, a coluna Y está vazia, e sem ela eu não sei qual empresa é." Peça para ele preencher ou apagar a linha |
   | `formula_sem_valor` | "Na aba X, linha N, a coluna Y tem uma fórmula que nunca foi calculada (a planilha foi gerada por um programa). Abra no Excel, salve e me mande de novo." |
   | `celula_com_erro` | "Na aba X, linha N, a coluna Y mostra um erro do Excel (`codigo`). Corrija a célula e salve de novo." |
   | `planilha_sem_empresas` | "A aba X tem os títulos das colunas, mas nenhuma empresa embaixo. É essa a planilha?" |
   | `id_repetido_na_planilha` | "O ID X aparece em duas linhas da aba Mapa competitivo (as linhas estão no `detalhe`). Cada empresa precisa de um ID só." Peça para ele trocar um dos dois |
   | `endereco_repetido_na_planilha` | "A Fulana e a Beltrana apontam para a mesma página no LinkedIn. São a mesma empresa?" Se forem, ele apaga uma das linhas; se não forem, ele corrige o endereço de uma delas na aba Canais digitais |
   | `slug_invalido` | "O endereço no LinkedIn da Fulana tem um caractere que a coleta não abre (acento ou símbolo). Copie o endereço de novo, direto da página da empresa." Ou rode com `--pular <id_planilha>` e trate a empresa por [Como entra uma empresa nova](#como-entra-uma-empresa-nova) |
   | `conflito_de_endereco` | "A Fulana da planilha é a Fulana da sua lista, mas a lista usa a página `na_lista` e a planilha traz `na_planilha`. Qual das duas é a página certa?" Com `na_lista` vazio, a lista tem a empresa sem página e a planilha traz uma. Pergunte com `AskUserQuestion`. Vale a da lista: rode com `--pular <id_planilha>`. Vale a da planilha: troque o endereço da ficha e da linha do índice pelo da planilha (o slug muda o nome da ficha) e rode de novo |
   | `ficha_fora_da_lista` | "Já existe uma ficha da Fulana fora da sua lista, com outro conteúdo." Ofereça voltá-la para o índice, como no passo 0 com `fichas_orfas`, ou rode com `--pular <id_planilha>` |
   | `indice_com_problemas` | não fale de planilha: a lista atual tem linha torta. Conserte pelo passo 0 e volte |

   Concluído quando a simulação voltou `ok: true`.

3. **Conte em linguagem simples, antes de gravar.** Uma frase para cada grupo que veio:
   - `novas`: "vou criar a ficha de N empresas novas", com os nomes;
   - `ja_existem`: "estas já estavam na sua lista e ficam como estão", e, para quem tem `muda`, "ganham a prioridade (ou o grupo) que a planilha dá";
   - `sem_linkedin` e `perfil_pessoal`: "estas ficam na lista, mas a coleta pula", com o `motivo` de cada uma em palavras simples: a planilha não traz o endereço no LinkedIn; o endereço é de outro tipo de página (vitrine, escola, grupo), e a coleta só lê página de empresa; ou, no perfil pessoal, "só o perfil de uma pessoa, e perfil de pessoa a coleta não lê";
   - `novas[].parecidas`: "a X da planilha parece a Y que você já tem; é a mesma?". Sendo a mesma, rode a importação com `--pular <id_planilha>` dessa linha e, se ele quiser os dados novos, trate a empresa que já existe por [Atualizar](#gestão); não sendo, siga;
   - `novas[].notas` com prioridade fora da lista: "a planilha dizia 'Urgente' para a Z; ela entra como 'a definir' e eu pergunto na seleção";
   - `novas[].notas` com data inválida: "a data de conferência da Z veio como '5 nov 2026', que eu não leio; usei a data de hoje".

   É inclusão do que ele mesmo trouxe, dentro do pedido: siga sem pedir licença, a não ser que uma `parecidas` espere resposta. Concluído quando ele ouviu os números e cada `parecidas` teve resposta.

4. **Aplique e valide.** Rode o mesmo comando com `--aplicar` e depois o `indice.js` até `ok: true`. Diga quantas empresas a lista tem agora e quantas a próxima rodada já pega (`rodada.devidas`). Concluído quando o script voltou `ok: true` e `n_empresas` bate com o que você anunciou.

As fichas importadas levam `[a confirmar]` na confirmação do usuário e a planilha como fonte, com a data em que ela foi conferida; as seções que a planilha não cobre (tendências, porte) dizem isso e se completam na primeira re-pesquisa. Seguindo para catalogar, vá à [Seleção](#seleção).

### A seleção

O handoff para a `profills-garimpo` é `DADOS/selection.md`. Sobrescreva-o a cada rodada — ele é efêmero, e o que precisa durar já está nas fichas:

```markdown
# Seleção ativa — 2026-08-24

- [Nubank](refs/nubank.md) — `nubank` · id 15216 · fintech · BR
- [Anthropic](refs/anthropic.md) — `anthropic` · id — · IA · global
```

**Valide o índice antes de escrever**: rode `node "<pasta desta skill>/scripts/indice.js" "<DADOS>/refs"` e só escreva o `selection.md` com `ok: true` — `fichas_orfas` cheio não impede nada, ele não entra no `ok`. Índice inválido é corrigido primeiro — a `profills-garimpo` navega pelo que estiver aqui, e linha torta vira coleta na página errada. Empresa com `linkedin: false` não entra na seleção: não há página para coletar.

Cada campo da linha sai do `empresas[]` da saída do script — `nome`, `slug`, `id`, `setor`, `pais` — sem reescrever nem encurtar nada. O `id` é obrigatório; `—` quando o índice também não tem. É por ele que a `profills-garimpo` reencontra a página quando o slug mudou.

Concluído quando o script voltou `ok: true`, cada empresa escolhida tem `refs/<slug>.md`, uma linha no `INDEX.md` e uma linha no `selection.md`; são no máximo 12; e o usuário ouviu, pelo nome, quais entraram.

### Feche

Antes de fechar, rode `node "<pasta desta skill>/../profills-setup/scripts/mapa.js" "<DADOS>"`, que atualiza o resumo da pasta em `<DADOS>/CLAUDE.md`; se ele não voltar `ok: true`, avise em uma frase que o resumo não foi atualizado e siga.

- **A `profills-garimpo` invocou você**: assim que o `selection.md` estiver escrito, devolva o controle a ela — a coleta continua de onde parou, sem sugestão sua.
- **O usuário chamou você**: termine com uma sugestão só — rodar a `profills-garimpo` para coletar as empresas escolhidas.

## Guarda-corpos

- **Similar sugerida é proposta, não fato.** Empresa entra na lista com o aval do usuário, e a ficha guarda o que a pesquisa sustentou — cada afirmação com a fonte que a produziu.
