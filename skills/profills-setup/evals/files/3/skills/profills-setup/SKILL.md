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

Esta skill é a dona da regra; as outras quatro (radar, garimpo, post, voz) carregam a regra abaixo, literal, seguida da instrução de invocar esta skill:

> Se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`.

Quando nenhuma das duas existe, é por isso que você foi invocada — quem decide onde criar é o item `DADOS` do passo 3.

**Dois shells**: Linux e Mac usam Bash, Windows usa Git Bash ou PowerShell. Cada checagem e cada criação de pasta tem as duas formas em `references/shell.md` — use a coluna do shell que você tem. Os comandos `claude plugin …` e `npx …` são iguais nos dois.

## Fluxo

Comece pela porta de entrada:

- **Outra skill invocou você** (radar, garimpo, post ou voz, porque `DADOS` não existia): vá direto ao item **`DADOS` ausente** do passo 3, crie a pasta, anuncie o caminho e siga para o passo 5. O diagnóstico completo fica para quando o usuário chamar a skill por nome.
- **O usuário chamou você** ("instala", "configura", "atualiza", "o que está faltando"): passo 1.

### 1. Diagnóstico silencioso

Rode as checagens de `references/shell.md` e monte o quadro inteiro antes de falar com o usuário — ele recebe um quadro pronto, em vez de acompanhar seis comandos passando. Concluído quando você sabe o estado de cada uma das seis peças:

- **Plugin `profills-skills`** — `claude plugin list` mostra `profills-skills`. **Exceção "via repo"**: se o toplevel git do diretório atual tem `skills/profills-setup/SKILL.md`, você está dentro do repo-fonte, as skills já vêm dos symlinks de `.claude/skills` e o plugin não é necessário — marque ✅ com a nota "via repo" e não instale nada. Esse mesmo sinal decide onde criar a pasta de dados, no passo 3.
- **humanize-pt-br** — `~/.claude/skills/humanize-pt-br/SKILL.md` ou `~/.agents/skills/humanize-pt-br/SKILL.md` existe.
- **Node/npx** — `command -v npx` (Bash) ou `Get-Command npx` (PowerShell).
- **Pasta `DADOS`** — resolvida pela regra acima, com `refs/`, `catalog/raw/` e `drafts/` dentro.
- **`DADOS/voz.md`** — existe ou não.
- **unslop** — opcional, entra como `—` até o usuário pedir por nome.

A extensão do Chrome fica de fora do diagnóstico: quem a confere é a `profills-navegador`, na hora de coletar.

### 2. Uma tabela só

Mostre exatamente uma tabela, com **estas sete linhas, nesta ordem e com este texto** — só a coluna Status muda entre máquinas. Status: ✅ presente · ❌ falta · `—` opcional ou conferido depois.

| Peça | O que faz | Status |
|---|---|---|
| Plugin `profills-skills` | Traz as 6 skills: setup, voz, radar, navegador, garimpo, post | ✅/❌ |
| humanize-pt-br | Tira as marcas de IA do texto final | ✅/❌ |
| Node/npx | Motor que instala a humanize-pt-br | ✅/❌ |
| Pasta de dados | Guarda empresas, catálogos e rascunhos | ✅/❌ |
| Arquivo de voz | O que você vende, para quem e como você fala | ✅/❌ |
| Extensão do Chrome | Deixa o Claude ler o LinkedIn no seu navegador | conferida na hora de coletar |
| unslop (opcional) | Corta clichês de IA — redundante com a humanize-pt-br | ✅/— |

Concluído quando as seis linhas diagnosticadas estão preenchidas (a da extensão fica com a nota fixa). Tudo ✅: diga isso em uma frase e vá para o passo 5, sem rodar comando de instalação.

### 3. Instalar o que falta

Nesta ordem, um item por vez:

- **Plugin ❌** (fora do caso "via repo" — instalação que parou no meio, ou pasta copiada na mão): explique que isso baixa e ativa as 6 skills.
  ```
  claude plugin marketplace add https://github.com/profillsbrasil/profills-skills
  claude plugin install profills-skills@profills-skills
  ```
  Instalado quando `claude plugin list` volta a mostrar `profills-skills`. Se um dos comandos falhar, a causa está na tabela de sintomas no fim deste arquivo. Depois de instalar, avise: "pode ser preciso reabrir o Claude Code para as skills novas aparecerem" (não dá para confirmar isso ao vivo nesta sessão).
- **Node/npx ❌**: a `humanize-pt-br` é instalada por `npx`, que vem junto com o Node.js. Pergunte com `AskUserQuestion`, duas opções — **"Instalar o Node agora"** (recomendada: é o que destrava a humanização; passo a passo por sistema em `references/instalacao.md`) ou **"Seguir sem"** (o resto do pipeline roda igual). Instalou: peça para abrir um terminal novo, refaça a checagem de `npx` e siga para o item seguinte. Seguiu sem: pule também a `humanize-pt-br` e diga em uma frase o que fica de fora.
- **humanize-pt-br ❌** (com npx disponível): explique que isso traz a skill que tira as marcas de IA dos rascunhos.
  ```
  npx skills add othavi0/skills --skill humanize-pt-br -g -y -a claude-code
  ```
  Instalada quando `~/.claude/skills/humanize-pt-br/SKILL.md` existe.
- **`DADOS` ❌**: crie onde o sinal do passo 1 mandar — dentro do repo-fonte (`skills/profills-setup/SKILL.md` no toplevel), a pasta é `linkedin-data/` na raiz do repo; fora dele, é `~/Profills LinkedIn/` (no Windows, `C:\Users\NOME\Profills LinkedIn`). O comando por shell e o `.gitignore` do caso repo-fonte estão em `references/shell.md`. Pronta quando o `ls` (ou `Get-ChildItem`) da pasta, rodado depois de criar, mostra `refs/`, `catalog/raw/` e `drafts/` — "já resolvi" só depois de ver essa saída —, o usuário ouviu o caminho no formato do sistema dele e — no repo-fonte — `git check-ignore linkedin-data/selection.md` responde o caminho.
- **unslop**: só entra quando o usuário pedir por nome. Aí `AskUserQuestion` com o conflito na mesa — **"Seguir só com a humanize-pt-br"** (recomendada: as duas brigam na regra de travessão) ou **"Instalar a unslop mesmo assim"** (comandos e o aviso em `references/instalacao.md`).

Concluído quando cada linha ❌ da tabela virou ✅ ou virou uma decisão que o usuário tomou ("seguir sem Node").

### 4. Atualizar

Quando o pedido é atualizar, e não instalar do zero, rode explicando cada comando:

```
claude plugin marketplace update profills-skills
claude plugin update profills-skills@profills-skills
```

Se a `humanize-pt-br` estiver instalada, rodar o mesmo comando do passo 3 de novo também atualiza (o `npx skills add` sempre busca a versão atual). Concluído quando você refez o passo 2 e a tabela mostra o que de fato mudou.

### 5. Fecho

- **Outra skill invocou você**: assim que a pasta existe, devolva o controle a ela — o pedido original do usuário continua de onde parou.
- **O usuário chamou você**: termine com exatamente **uma** sugestão.
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
