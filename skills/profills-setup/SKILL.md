---
name: profills-setup
description: >-
  Instala, confere e atualiza o ambiente profills: plugin de skills,
  humanize-pt-br, Node/npx e a pasta de dados DADOS. Use para "instalar
  as skills da Profills", "configurar o profills", "atualizar as skills",
  "o que está faltando", numa máquina nova, ou quando outra skill do
  pipeline não encontra DADOS.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-setup

Deixa o ambiente pronto antes de qualquer skill do pipeline rodar. O usuário final é o comercial, não dev: **conduza pela mão, um comando por vez** — explique em uma frase o que o comando faz, rode, confirme pelo critério, só então passe para o próximo.

## Pasta de dados (`DADOS`)

Esta skill é a dona da regra; as outras quatro (radar, garimpo, post, voz) carregam o texto abaixo, literal, na linha que começa por `**Pasta de dados (`DADOS`)**`:

> se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, ou se `DADOS/.profills.json` falta ou traz `versao_dados` menor que 2, invoque a skill `profills-setup` — ela cria ou atualiza a pasta e confere o resto da instalação.

Quando nenhuma das duas existe, é por isso que você foi invocada — quem decide onde criar é o item `DADOS` do passo 3.

**Versão da pasta.** `DADOS/.profills.json` guarda `{"versao_dados": 2, "atualizado_em": "AAAA-MM-DD"}`. Pasta sem esse arquivo é da versão 1: foi criada antes de as skills mudarem o formato da lista de empresas. Quem leva uma pasta antiga até a versão atual, sem perder nada, é o passo 4.

**Dois shells**: Linux e Mac usam Bash, Windows usa Git Bash ou PowerShell. Cada checagem e cada criação de pasta tem as duas formas em `references/shell.md` — use a coluna do shell que você tem. Os comandos `claude plugin …` e `npx …` são iguais nos dois.

## Fluxo

Comece pela porta de entrada:

- **Outra skill invocou você** (radar, garimpo, post ou voz). O diagnóstico completo fica para quando o usuário chamar a skill por nome; aqui você resolve só a pasta:
  - **`DADOS` não existia**: vá direto ao item **`DADOS` ❌** do passo 3, crie a pasta já com `boletins/` e o marcador da versão 2, anuncie o caminho e siga para o passo 6.
  - **`DADOS` existe, mas é antiga** (sem `.profills.json`, ou com `versao_dados` menor que 2): faça o passo 4 inteiro e siga para o passo 6. Sem Node, conduza o item **Node/npx ❌** do passo 3 antes do passo 4. Se o Node ficou para depois ou o `migrar.js` não chegou a `ok: true`, o passo 6 manda ficar com o usuário, não devolver o controle.
- **O usuário chamou você** ("instala", "configura", "atualiza", "o que está faltando"): passo 1.

### 1. Diagnóstico silencioso

Rode as checagens de `references/shell.md` — cada comando de fato executado, com a saída dele registrada, porque é essa saída que sustenta cada ✅/❌ da tabela — e monte o quadro inteiro antes de falar com o usuário — ele recebe um quadro pronto, em vez de acompanhar sete comandos passando. Concluído quando você sabe o estado de cada uma das sete peças:

- **Plugin `profills-skills`** — `claude plugin list` mostra `profills-skills`. **Exceção "via repo"**: se o toplevel git do diretório atual tem `skills/profills-setup/SKILL.md`, você está dentro do repo-fonte, as skills já vêm dos symlinks de `.claude/skills` e o plugin não é necessário — marque ✅ com a nota "via repo" e não instale nada. Esse mesmo sinal decide onde criar a pasta de dados, no passo 3.
- **humanize-pt-br** — `~/.claude/skills/humanize-pt-br/SKILL.md` ou `~/.agents/skills/humanize-pt-br/SKILL.md` existe.
- **Node/npx** — `command -v npx` (Bash) ou `Get-Command npx` (PowerShell).
- **Pasta `DADOS`** — resolvida pela regra acima, com `refs/`, `catalog/raw/`, `drafts/` e `boletins/` dentro.
- **Versão da pasta** — `versao_dados` lido de `DADOS/.profills.json`: 2 é ✅; arquivo ausente ou número menor é ❌. Sem pasta `DADOS`, fica ❌ e se resolve junto com ela.
- **`DADOS/voz.md`** — existe ou não.
- **unslop** — opcional, entra como `—` até o usuário pedir por nome.

A extensão do Chrome fica de fora do diagnóstico: quem a confere é a `profills-navegador`, na hora de coletar.

### 2. Uma tabela só

Mostre exatamente uma tabela, com **estas oito linhas, nesta ordem e com este texto** — só a coluna Status muda entre máquinas. Status: ✅ presente · ❌ falta · `—` opcional ou conferido depois.

| Peça | O que faz | Status |
|---|---|---|
| Plugin `profills-skills` | Traz as 6 skills: setup, voz, radar, navegador, garimpo, post | ✅/❌ |
| humanize-pt-br | Tira as marcas de IA do texto final | ✅/❌ |
| Node/npx | Roda as contas das skills (radar, garimpo, post) e instala a humanize-pt-br | ✅/❌ |
| Pasta de dados | Guarda empresas, catálogos e rascunhos | ✅/❌ |
| Versão da pasta | Deixa a pasta no formato que estas skills leem | ✅/❌ |
| Arquivo de voz | O que você vende, para quem e como você fala | ✅/❌ |
| Extensão do Chrome | Deixa o Claude ler o LinkedIn no seu navegador | conferida na hora de coletar |
| unslop (opcional) | Corta clichês de IA — redundante com a humanize-pt-br | ✅/— |

Concluído quando as sete linhas diagnosticadas estão preenchidas (a da extensão fica com a nota fixa). Tudo ✅: diga isso em uma frase e vá para o passo 6, sem rodar comando de instalação. Só a versão da pasta em ❌: vá direto ao passo 4.

### 3. Instalar o que falta

Nesta ordem, um item por vez:

- **Plugin ❌** (fora do caso "via repo" — instalação que parou no meio, ou pasta copiada na mão): explique que isso baixa e ativa as 6 skills.
  ```
  claude plugin marketplace add https://github.com/profillsbrasil/profills-skills
  claude plugin install profills-skills@profills-skills
  ```
  Instalado quando `claude plugin list` volta a mostrar `profills-skills`. Se um dos comandos falhar, a causa está na tabela de sintomas no fim deste arquivo. Depois de instalar, avise: "pode ser preciso reabrir o Claude Code para as skills novas aparecerem" (não dá para confirmar isso ao vivo nesta sessão).
- **Node/npx ❌**: o Node.js é o motor dos scripts que a radar, a garimpo e a post rodam (índice, métricas, checagem de formato) e do `npx` que instala a `humanize-pt-br` — sem ele o pipeline não anda. Pergunte com `AskUserQuestion`, duas opções — **"Instalar o Node agora"** (recomendada: passo a passo por sistema em `references/instalacao.md`, ~3 min) ou **"Deixar para depois"**. Instalou: peça para abrir um terminal novo, refaça a checagem de `npx` e siga para o item seguinte. Deixou para depois: pule a `humanize-pt-br`, marque Node como pendente e diga em uma frase que radar, garimpo e post só vão funcionar depois de instalar. Pendência aberta no fim da rodada muda o fecho do passo 6: a única ação sugerida é a que destrava o pendente (instalar o Node, instalar o Git), nunca `/profills-voz`, `/profills-radar` ou `/profills-post`.
- **humanize-pt-br ❌** (com npx disponível): explique que isso traz a skill que tira as marcas de IA dos rascunhos.
  ```
  npx skills add othavi0/skills --skill humanize-pt-br -g -y -a claude-code
  ```
  Instalada quando `~/.claude/skills/humanize-pt-br/SKILL.md` existe.
- **`DADOS` ❌**: crie onde o sinal do passo 1 mandar — dentro do repo-fonte (`skills/profills-setup/SKILL.md` no toplevel), a pasta é `linkedin-data/` na raiz do repo; fora dele, é `~/Profills LinkedIn/` (no Windows, `C:\Users\NOME\Profills LinkedIn`). O comando por shell, o marcador da versão e o `.gitignore` do caso repo-fonte estão em `references/shell.md`; pasta nova nasce já na versão 2, sem passar pelo passo 4. Com o Node presente, rode em seguida `node "<pasta desta skill>/scripts/mapa.js" "<DADOS>"`: ele cria `<DADOS>/CLAUDE.md`, o arquivo que o Claude lê quando é aberto dentro da pasta, com as regras, o papel de cada skill e o estado da pasta; com o Node pendente, o `CLAUDE.md` espera o Node. Pronta quando o `ls` (ou `Get-ChildItem`) da pasta, rodado depois de criar, mostra `refs/`, `catalog/raw/`, `drafts/`, `boletins/`, `.profills.json` e, com Node, `CLAUDE.md` — "já resolvi" só depois de ver essa saída —, o usuário ouviu o caminho no formato do sistema dele e — no repo-fonte — `git check-ignore linkedin-data/selection.md` responde o caminho.
- **Versão da pasta ❌** com a pasta já existente: é o passo 4, logo a seguir.
- **unslop**: só entra quando o usuário pedir por nome. Aí `AskUserQuestion` com o conflito na mesa — **"Seguir só com a humanize-pt-br"** (recomendada: as duas brigam na regra de travessão) ou **"Instalar a unslop mesmo assim"** (comandos e o aviso em `references/instalacao.md`).

Concluído quando cada linha ❌ da tabela virou ✅ ou virou uma decisão que o usuário tomou ("deixar o Node para depois").

### 4. Atualizar a pasta

A pasta de dados guarda o trabalho do comercial: empresas, catálogos, rascunhos, voz. Quando as skills mudam o formato de um desses arquivos, `scripts/migrar.js` (nesta skill) leva a pasta até a versão atual e guarda uma cópia de tudo que reescreve. Ele precisa do Node: com o Node pendente, a versão da pasta fica pendente junto, e o fecho pede o Node.

1. **Veja o que vai mudar, sem mudar nada.** Rode `node "<pasta desta skill>/scripts/migrar.js" "<DADOS>"`. A saída é JSON: `versao_atual`, `acoes[]` (cada uma com `tipo`, `alvo` e `detalhe`), `problemas[]` e `ok`. Concluído quando você tem a lista de ações.

2. **Explique em linguagem simples, antes de aplicar.** Uma frase por tipo de ação que apareceu, sem nome de arquivo técnico nem JSON:

   | `tipo` | O que dizer |
   |---|---|
   | `criar_pasta` | "vou criar a pasta de <rascunhos, boletins…>, que ainda não existia" |
   | `converter_indice` | "a lista das suas empresas ganha uma etiqueta em cada informação (setor, país, prioridade); nenhuma empresa sai da lista, e a prioridade fica 'a definir' até você me dizer" |
   | `converter_status` | "umas anotações antigas de coleta viram o arquivo que as skills leem hoje; a anotação original continua lá" |
   | `gravar_marcador` | "anoto na pasta que ela já está na versão nova, para não refazer isso" |

   Diga também que uma cópia da lista fica guardada antes da mudança. É atualização do que já é dele, dentro do pedido: siga sem pedir licença. Com `problemas[]` cheio, não aplique; vá ao item 5.

3. **Aplique.** Rode o mesmo comando com `--aplicar`. Concluído quando a saída volta `ok: true`. Saída com o campo `erro` quer dizer que a gravação parou no meio: o texto diz qual arquivo e por quê (falta de permissão, disco cheio, arquivo aberto em outro programa). Conte isso ao comercial em uma frase, conduza o conserto e rode de novo; a nova rodada termina o que faltou.

4. **Confira.** Quando existe `<DADOS>/refs/INDEX.md`, rode `node "<pasta desta skill>/../profills-radar/scripts/indice.js" "<DADOS>/refs"` até `ok: true`; problema que sobrar é do índice, e quem o corrige é a `profills-radar`. Depois rode o `migrar.js` sem `--aplicar` mais uma vez: `acoes` tem de voltar `[]`. Por fim rode `node "<pasta desta skill>/scripts/mapa.js" "<DADOS>"`, que cria ou atualiza o `<DADOS>/CLAUDE.md` com o estado da pasta já migrada e mantém o texto que o comercial tiver escrito nele. Concluído quando as duas primeiras saídas confirmam e o `mapa.js` voltou `ok: true`; se ele falhar, avise em uma frase que o resumo da pasta não foi atualizado e siga, porque a pasta já está pronta sem ele.

5. **Linha que não dá para converter.** Com qualquer item em `problemas[]` o script não grava nada: nem a lista, nem as pastas, nem a marca da versão. Cada problema traz `linha` e `trecho`.
   - `linha_ambigua` ou `slug_invalido`: não dá para saber o que é setor e o que é país, ou o endereço do LinkedIn tem caractere estranho. Diga ao comercial o nome da empresa daquela linha e pergunte o setor e o país dela (ou o endereço certo).
   - `linha_fora_do_formato`: o começo da linha está quebrado, em geral um colchete dentro do nome (`[Foo [BR]]`). Mostre o nome como está e proponha a versão sem o colchete extra.
   - Outro tipo (`campo_desconhecido`, `prioridade_invalida`, `campo_ausente`…): o `detalhe` diz o campo e o valor esperado. Mostre a empresa e o valor que veio, e pergunte o certo.

   Corrija só aquela linha, no formato em que ela já está, e volte ao item 1.

6. **Diga onde ficou a cópia.** O campo `backup` da saída é a pasta `<DADOS>/.backup/<data>/`. Mostre o caminho no formato do sistema dele e diga que ali está a lista como era antes. Com `backup: null` nada foi reescrito, e não há cópia a mostrar.

Concluído quando a linha "Versão da pasta" da tabela virou ✅.

### 5. Atualizar o plugin

Quando o pedido é atualizar, e não instalar do zero, rode explicando cada comando:

```
claude plugin marketplace update profills-skills
claude plugin update profills-skills@profills-skills
```

Se a `humanize-pt-br` estiver instalada, rodar o mesmo comando do passo 3 de novo também atualiza (o `npx skills add` sempre busca a versão atual). Plugin novo pode trazer formato novo de pasta: termine rodando o passo 4, que sem nada a fazer devolve `acoes: []` e não muda nada. Concluído quando você refez o passo 2 e a tabela mostra o que de fato mudou.

### 6. Fecho

- **Outra skill invocou você**: assim que a pasta existe e está na versão atual, devolva o controle a ela — o pedido original do usuário continua de onde parou. Com a versão da pasta pendente (Node que ficou para depois, ou `migrar.js` sem `ok: true`), não devolva: a skill que chamou leria a lista antiga, daria `formato_antigo` e chamaria você de novo, em laço. Fique com o usuário, diga em uma frase que o pedido original espera a pasta ficar pronta e conduza o que falta: a instalação do Node (passo 3) ou o conserto da linha (passo 4, item 5).
- **O usuário chamou você**: termine com exatamente **uma** sugestão.
  - Antes dela, quando `DADOS` é `~/Profills LinkedIn/` e o `<DADOS>/CLAUDE.md` existe, diga em uma frase que, daqui em diante, ele deve abrir o Claude dentro dessa pasta, para o Claude já começar sabendo o fluxo das skills e o estado da pasta. Mostre o caminho e o comando no formato do sistema dele: `cd "<caminho da pasta>"` e depois `claude`, com o caminho como `/home/nome/Profills LinkedIn` no Linux, `/Users/nome/Profills LinkedIn` no Mac e `C:\Users\NOME\Profills LinkedIn` no Windows. Isso é orientação, não segunda sugestão. Quando `DADOS` é a `linkedin-data/` de um repo, como no repo-fonte, não diga nada disso.
  - `DADOS/voz.md` não existe → `/profills-voz`. Uma frase: é a conversa da voz dele neste PC.
  - `DADOS/voz.md` existe → `/profills-post`. Uma frase: o setup deste PC está pronto, agora a gente faz um post pra ele ver como funciona. Sem catálogo a post segue só com o tema.

Concluído quando o usuário recebeu uma sugestão só (ou o controle voltou à skill que chamou) e nenhuma pergunta ficou aberta.

## Sintoma → causa → ação

| Sintoma | Causa | Ação |
|---|---|---|
| `claude: command not found` (ou `'claude' não é reconhecido`) | Claude Code não está instalado nesta máquina | Instalação por sistema em `references/instalacao.md` |
| `plugin marketplace add` falha com `git`/`spawn` não encontrado | Git ausente (comum no Windows) | Instalar Git for Windows — `references/instalacao.md` |
| `plugin marketplace add` falha com `Permission denied (publickey)` | Usou a forma curta `owner/repo`, que clona por SSH | Repetir com a URL completa do passo 3 |
| `plugin marketplace add` falha com 404 / `marketplace.json` não encontrado | Sem internet, URL digitada errada, ou o repo ficou privado | Conferir rede e a URL; se privado, `references/instalacao.md` |
| `npx: command not found` (ou `'npx' não é reconhecido`) | Node.js ausente | Instalar LTS em nodejs.org, abrir terminal novo, repetir |
| `command -v`/`mkdir -p` dá erro de sintaxe | A ferramenta de shell é PowerShell, não Bash | Usar a forma PowerShell de `references/shell.md` |
| Skill nova não aparece em `/help` depois de instalar | Sessão atual não recarregou o plugin | Reabrir o Claude Code; se persistir, `claude plugin uninstall profills-skills@profills-skills` e instalar de novo (passo 3) |
