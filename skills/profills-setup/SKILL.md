---
name: profills-setup
description: >-
  Instala, verifica e atualiza o ambiente do pipeline profills — o plugin de
  skills, a skill humanize-pt-br, Node/npx e a pasta de dados (DADOS) com suas
  subpastas. Use quando o usuário pedir para "instalar as skills da Profills",
  "configurar o profills", "atualizar as skills" ou "ver o que está faltando";
  numa máquina nova, sem o plugin instalado; ou quando outra skill do pipeline
  (profills-radar, profills-garimpo, profills-post, profills-voz) não encontrar
  a pasta de dados e precisar dela. Mostra uma tabela de status de cada peça e
  conduz a instalação do que faltar, um passo por vez.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-setup

Garante que o ambiente esteja pronto antes de qualquer skill do pipeline rodar — o equivalente para instalação do que a `profills-navegador` é para navegador. O usuário final é o comercial, não dev: **conduza pela mão, um comando por vez**, explicando em uma frase o que cada comando faz antes de rodá-lo.

## Pasta de dados (`DADOS`)

Regra canônica, usada por todas as skills do pipeline para localizar os dados:

> Se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

Quando é você quem cria a pasta (nenhuma das duas existia), decida onde pelo mesmo sinal do diagnóstico do plugin (passo 1 abaixo): se o toplevel git tiver `skills/profills-setup/SKILL.md`, você está dentro do repo-fonte `profills-skills` — crie `linkedin-data/` ali. Caso contrário, crie `~/Profills LinkedIn/` — no Windows é `C:\Users\NOME\Profills LinkedIn`, e é nesse formato que você mostra o caminho ao usuário de Windows.

**Windows × Linux**: os usuários usam os dois. A ferramenta de shell muda com o sistema (Linux/Mac: Bash; Windows com Git for Windows: Git Bash; Windows sem ele: PowerShell), então cada checagem abaixo tem a forma Bash e a forma PowerShell em `references/shell.md` — use a que corresponde ao shell que você tem. Os comandos `claude plugin …` e `npx …` são idênticos nos dois.

## Fluxo

### 1. Diagnóstico silencioso

Faça o diagnóstico inteiro antes de falar com o usuário — rode os comandos abaixo e monte o quadro de status. Concluído quando você sabe, para cada uma das 5 peças abaixo, se está presente (a sexta, extensão Chrome, fica para a `profills-navegador`):

- **Plugin instalado?** `claude plugin list` mostra `profills-skills`. Exceção: se o diretório atual está num repo git cujo toplevel tem `skills/profills-setup/SKILL.md` (você está no repo-fonte), as skills já vêm de `.claude/skills` (symlinks) e o plugin não é necessário — trate como ✅ e anote "via repo".
- **humanize-pt-br presente?** `~/.claude/skills/humanize-pt-br/SKILL.md` ou `~/.agents/skills/humanize-pt-br/SKILL.md` existe.
- **Node/npx disponível?** `command -v npx` (Bash) ou `Get-Command npx` (PowerShell).
- **Pasta `DADOS` existe**, com `refs/`, `catalog/` e `drafts/` dentro dela (resolva `DADOS` pela regra acima).
- **`DADOS/voz.md` existe?**
- **Extensão Chrome**: fica com a `profills-navegador`, que a diagnostica quando a sessão for de fato navegar (antes da `profills-garimpo`).

### 2. Uma tabela só

Mostre exatamente uma tabela, três colunas (nome | o que faz, ≤12 palavras | status), nesta ordem — a ordem de uso no pipeline:

| Skill/dependência | O que faz | Status |
|---|---|---|
| profills-setup | Instala e verifica o ambiente do pipeline | ✅/❌ |
| profills-voz | Cria o arquivo de voz do usuário | ✅/❌ |
| profills-radar | Escolhe as empresas de referência a observar | ✅/❌ |
| profills-navegador | Garante o navegador certo e pronto pra coletar | ✅/❌ |
| profills-garimpo | Cataloga o que as empresas de referência postam | ✅/❌ |
| profills-post | Gera rascunhos de post a partir do catálogo | ✅/❌ |
| humanize-pt-br | Remove marcas de IA do texto final | ✅/❌ |
| unslop (opcional) | Corta clichês de IA — redundante com o item acima | ✅/❌ |

As 6 primeiras linhas seguem o plugin inteiro; `humanize-pt-br` e `unslop` são dependências externas. Concluído quando as 8 linhas estão preenchidas com o diagnóstico do passo 1 (unslop nunca vira ❌ "bloqueante" — é sempre opcional, marque como está, sem cobrar instalação dela).

### 3. Instalar o que falta

Um item por vez, nesta ordem: explique em uma frase o que o comando faz, rode, confirme pelo critério checável, só então passe pro próximo.

- **Plugin ausente** (e não é o caso "via repo"): explique que isso baixa e ativa as 6 skills.
  ```
  claude plugin marketplace add https://github.com/profillsbrasil/profills-skills
  claude plugin install profills-skills@profills-skills
  ```
  Instalado quando `claude plugin list` volta a mostrar `profills-skills`. Se um dos comandos falhar, a causa está na tabela de sintomas no fim deste arquivo. Depois de instalar, avise: "pode ser preciso reabrir o Claude Code para as skills novas aparecerem" (não dá para confirmar isso ao vivo nesta sessão).
- **npx ausente**: explique que `humanize-pt-br` depende de Node.js. Instrua instalar a versão LTS em nodejs.org (detalhe por sistema em `references/instalacao.md`) e **continue com o resto do fluxo** sem bloquear — não é pré-requisito das outras peças.
- **humanize-pt-br ausente** (com npx disponível): explique que isso traz a skill de humanização de texto pt-BR para a conta do usuário.
  ```
  npx skills add othavi0/skills --skill humanize-pt-br -g -y -a claude-code
  ```
  Instalado quando `~/.claude/skills/humanize-pt-br/SKILL.md` existe.
- **`DADOS` ausente**: crie a pasta decidida acima com `refs/`, `catalog/raw/` e `drafts/` dentro (comando por shell em `references/shell.md`). Pronta quando as três existem — e o usuário ouviu onde ela fica, no formato do sistema dele.
- **unslop**: instale só quando o usuário pedir por nome — aí `references/instalacao.md` tem as fontes e o aviso de conflito com `humanize-pt-br`.

### 4. Atualizar

Quando o usuário pedir para atualizar (não para instalar do zero), rode, explicando cada um:

```
claude plugin marketplace update profills-skills
claude plugin update profills-skills@profills-skills
```

Se `humanize-pt-br` estiver instalado, rodar o mesmo comando do passo 3 de novo também atualiza (o `npx skills add` sempre busca a versão atual). Depois, refaça o passo 2 e mostre a tabela atualizada — é o critério de conclusão: a tabela pós-update reflete o que de fato mudou.

### 5. Próximo passo

Depende de quem chamou:

- **Outra skill invocou você** (radar, garimpo, post ou voz, porque `DADOS` não existia): assim que a pasta existe, devolva o controle a ela — o pedido original do usuário continua de onde parou, sem sugestão sua.
- **O usuário chamou `/profills-setup`**: termine com **uma** sugestão só, nunca um menu — `DADOS/voz.md` não existe → `/profills-voz`; existe → `/profills-radar`.

## Sintoma → causa → ação

| Sintoma | Causa | Ação |
|---|---|---|
| `claude: command not found` (ou `'claude' não é reconhecido`) | Claude Code não está instalado nesta máquina | Instalação por sistema em `references/instalacao.md` |
| `plugin marketplace add` falha com `git`/`spawn` não encontrado | Git ausente (comum no Windows) | Instalar Git for Windows — `references/instalacao.md` |
| `plugin marketplace add` falha com `Permission denied (publickey)` | Usou a forma curta `owner/repo`, que clona por SSH | Repetir com a URL `https://github.com/profillsbrasil/profills-skills` |
| `plugin marketplace add` falha com 404 / `marketplace.json` não encontrado | Sem internet, URL digitada errada, ou o repo ficou privado | Conferir rede e a URL; se privado, `references/instalacao.md` |
| `npx: command not found` (ou `'npx' não é reconhecido`) | Node.js ausente | Instalar LTS em nodejs.org, abrir terminal novo, repetir |
| `command -v`/`mkdir -p` dá erro de sintaxe | A ferramenta de shell é PowerShell, não Bash | Usar a forma PowerShell de `references/shell.md` |
| Skill nova não aparece em `/help` depois de instalar | Sessão atual não recarregou o plugin | Reabrir o Claude Code |
