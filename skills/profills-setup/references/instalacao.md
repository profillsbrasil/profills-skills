# Detalhes de instalação (branches que nem todo run usa)

## Claude Code ausente

Se `claude` não existe no terminal, o Claude Code em si não está instalado — nada das skills funciona antes disso. Conduza pela página oficial (code.claude.com/docs/en/setup) com o comando do sistema do usuário:

- **Windows (PowerShell)**: `irm https://claude.ai/install.ps1 | iex`. Se aparecer `'irm' não é reconhecido`, o usuário está no Prompt de Comando (cmd), não no PowerShell — peça para abrir o PowerShell (o prompt começa com `PS C:\`).
- **Linux e Mac**: `curl -fsSL https://claude.ai/install.sh | bash`.

Depois: abrir um terminal novo, rodar `claude` e fazer login pelo navegador. Funciona quando `claude --version` imprime um número de versão. O plano gratuito do claude.ai não inclui Claude Code — a conta precisa ser Pro, Max, Team ou Enterprise.

## Windows: Git for Windows

`claude plugin marketplace add` clona o repositório com `git`. No Windows o Git não vem instalado — sem ele o comando falha dizendo que `git` não foi encontrado. Instale o [Git for Windows](https://git-scm.com/downloads/win) (instalador gráfico, next-next-finish, opções padrão), abra um terminal novo e repita o comando. Bônus: com ele instalado o Claude Code passa a usar o Git Bash, e as checagens Bash de `references/shell.md` valem no Windows também.

## `marketplace add` falha sem ser por falta de `git`

O repositório `profillsbrasil/profills-skills` é público — não há credencial a configurar. Causas reais, na ordem de probabilidade:

1. **Sem internet** ou proxy corporativo bloqueando `github.com` — testar abrindo github.com no navegador.
2. **Comando na forma curta** `marketplace add profillsbrasil/profills-skills`: essa forma clona por SSH (`git@github.com:`) e falha com `Permission denied (publickey)` em máquina sem chave SSH — o caso de todo PC de comercial. Use sempre a forma com URL completa do passo 3 do `SKILL.md`, que clona por HTTPS (testado: clona sem credencial).
3. **O repo ficou privado** (decisão futura): aí o Git precisa de credencial. Caminho mais simples para não-dev: instalar o GitHub CLI (cli.github.com), rodar `gh auth login` (login pelo navegador) e repetir o comando.

## Node.js ausente (para `humanize-pt-br`)

Passo a passo para quando o usuário escolher instalar o Node:

- Link: nodejs.org → baixar a versão **LTS** (não a "Current").
- Windows e Mac: instalador gráfico, next-next-finish.
- Linux: o instalador do site ou o gerenciador do sistema (`apt`, `pacman`, `dnf`) — o site é o caminho que não exige saber qual gerenciador a máquina usa.
- Depois de instalar, **abrir um terminal novo** (o `PATH` não atualiza no terminal já aberto) e repetir a checagem de `npx`.

## unslop (opcional, só se o usuário pedir por nome)

O conflito que a pergunta do passo 3 põe na mesa: `unslop` traz "must always apply" e uma regra própria sobre travessão, que pode brigar com o que a `humanize-pt-br` decide. Quando o usuário escolhe instalar assim mesmo:

1. Registre o conflito em uma frase: "essa skill pode brigar com a humanize-pt-br em alguns casos (regra de travessão) — se notar o texto final estranho, é o primeiro lugar pra olhar".
2. Não há fonte oficial única — duas versões públicas existem, ambas instaláveis pelo mesmo padrão de comando da `humanize-pt-br`:
   ```
   npx skills add cursor/plugins --skill unslop -g -y -a claude-code
   ```
   ou, alternativa com menos instalações:
   ```
   npx skills add theclaymethod/unslop --skill unslop -g -y -a claude-code
   ```
3. Instalada quando `~/.claude/skills/unslop/SKILL.md` existe.
