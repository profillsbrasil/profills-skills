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

Rode o script (passo 3) e decida pela `rodada.situacao`. A rodada pode durar mais de uma sessão: a `profills-garimpo` coleta as de prioridade Alta num dia e o resto no outro sem mudar o `selection.md`, e retoma pela data do cabeçalho. Montar uma rodada nova põe a data de hoje no cabeçalho e faz a garimpo abrir de novo, na conta do comercial, as páginas já coletadas na rodada anterior. Por isso a radar só entra quando não há rodada a aproveitar ou quando o comercial escolhe uma nova.

| Saída do script | O que fazer |
|---|---|
| `selecao_ausente`, `selecao_sem_data`, `indice_ausente` ou `indice_com_problemas` em `problemas` | Invoque a `profills-radar`. Ela monta a lista pelas camadas de prioridade, pergunta o que faltar (prioridade de empresa nova, troca de empresa) e grava `DADOS/selection.md` com a data de hoje no cabeçalho. Lista vazia é com ela também: a radar conduz a primeira run. |
| `selecao_no_futuro` em `problemas` | A seleção traz uma data depois de hoje, por relógio da máquina adiantado ou edição à mão. Diga isso ao comercial em uma frase, com a data, e invoque a `profills-radar` para remontar a rodada com a data de hoje. |
| `situacao: de_hoje` | A rodada de hoje já está montada: diga isso e siga sem reabrir a seleção, a não ser que o comercial peça outra. |
| `situacao: anterior_por_terminar` | A rodada de `rodada.data` ficou pela metade. Pergunte se ele quer terminar essa rodada, coletando só as empresas de `faltam_coletar` (diga os nomes), ou montar uma nova pela radar, que abre de novo as páginas já coletadas. Recomende terminar. Terminar segue para o passo 2 sem tocar no `selection.md`. |
| `situacao: anterior_sem_boletim` | A rodada de `rodada.data` está toda coletada e ainda não virou boletim. Pergunte se ele quer o boletim dessa rodada, sem abrir o LinkedIn, ou uma rodada nova pela radar. Recomende o boletim dessa rodada. |
| `situacao: anterior_com_boletim` | A rodada de `rodada.data` já virou o boletim em `rodada.boletim_da_rodada`. Diga isso e ofereça montar uma rodada nova pela radar; se ele não quiser, aponte o boletim que já existe e pare. |

Depois que a radar gravar a seleção, rode o script de novo.

Concluído quando o script voltou sem `problemas` e o comercial sabe qual rodada o boletim cobre: a de hoje ou a anterior que ele escolheu terminar ou fechar.

### 2. Garanta a coleta

Rode o script (passo 3) e leia `rodada.faltam_coletar`. Lista vazia: todas as empresas da rodada já têm coleta desta rodada, siga.

Lista com empresas: invoque a `profills-garimpo`. Numa rodada anterior que o comercial escolheu terminar, ela retoma pela data do cabeçalho e coleta só as que faltam. Ela conduz o navegador logado do comercial, conta o tamanho da rodada e o tempo, e oferece as saídas (rodada inteira, só as de prioridade Alta, deixar para depois). Quando ela devolver o controle, rode o script de novo. Se o comercial deixou parte para depois, siga com o que foi coletado: as que faltam entram no boletim como indisponíveis, com o motivo "ainda não coletada nesta rodada".

Concluído quando `faltam_coletar` está vazio ou o comercial escolheu deixar as restantes para depois.

### 3. Rode a conta

```bash
node "<pasta desta skill>/scripts/boletim.js" "<DADOS>"
```

"Pasta desta skill" é o diretório onde este `SKILL.md` está. Sai JSON em stdout. Exit 0 = ok; 1 = o índice ou a seleção impedem o boletim (leia `problemas` e siga a tabela do passo 1); 2 = pasta errada.

| Campo | Para que serve |
|---|---|
| `empresas[].cobertura` | o balde de cada empresa, um só: `com_novidade`, `sem_novidade`, `indisponivel`, `sem_linkedin`, `fora_desta_rodada` |
| `empresas[].motivo`, `nota` | por que a empresa está no balde (`erro_navegacao`, `coleta_com_erro`, `nao_coletada_nesta_rodada`, `sem_posts`…), e a frase da coleta |
| `empresas[].novos[]` | os posts da coleta desta rodada que não estavam na coleta anterior: `data`, `url`, `formato`, `hook`, `angulo`, `idioma`, `estrangeiro`, `resumo_pt`, `engajamento`, `destaque_da_coleta` |
| `empresas[].primeira_coleta` | `true` quando não há coleta anterior: todos os posts da janela contam como novos |
| `empresas[].cadencia` | `posts_por_semana` da coleta anterior e da atual e a `diferenca`; `mesma_janela: false` quer dizer que não se compara |
| `rodada` | `data` do cabeçalho, `situacao` (passo 1), `coletadas`, `faltam_coletar` (nome, slug e a `nota`: antes da rodada, nunca coletada ou coleta interrompida sem `meta.json`), `boletim_da_rodada_existe` e o caminho em `boletim_da_rodada` |
| `cobertura`, `totais` | a matriz e o total de posts novos, cada post contado uma vez |
| `voz_existe`, `boletim_do_dia_existe` | se há `voz.md` para ler; se o arquivo de hoje vai ser sobrescrito |
| `avisos[]` | `resumo_pt_ausente` (leia o texto no `posts.json` da pasta indicada e resuma você, com o rótulo "(inferido)"), `janelas_diferentes`, `post_sem_chave`, `post_repetido` (o mesmo post duas vezes na coleta: o script já o conta uma vez), `selecao_fora_do_indice` |

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
