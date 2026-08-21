# Mesma checagem, dois shells

A ferramenta de shell do Claude Code depende do sistema: Linux e Mac usam Bash; Windows usa Git Bash quando o Git for Windows está instalado e **PowerShell quando não está** (doc oficial: code.claude.com/docs/en/setup, "Set up on Windows"). Descubra qual você tem pelo primeiro comando que rodar — erro de sintaxe em `command -v` significa PowerShell. A partir daí, use a coluna certa.

`HOME` abaixo é `~` no Bash e `$env:USERPROFILE` no PowerShell; o caminho mostrado ao usuário é sempre no formato do sistema dele (`/home/nome/Profills LinkedIn` ou `C:\Users\NOME\Profills LinkedIn`).

| Checagem | Bash (Linux, Mac, Git Bash) | PowerShell (Windows sem Git) |
|---|---|---|
| Estou num repo git? | `git rev-parse --show-toplevel` | `git rev-parse --show-toplevel` (sem `git` instalado, o comando não existe → você não está num repo; siga para `HOME`) |
| npx existe? | `command -v npx` | `Get-Command npx` |
| humanize-pt-br instalada? | `test -f ~/.claude/skills/humanize-pt-br/SKILL.md` | `Test-Path "$env:USERPROFILE\.claude\skills\humanize-pt-br\SKILL.md"` |
| `DADOS` existe com as subpastas? | `ls -d DADOS/refs DADOS/catalog DADOS/drafts` | `Test-Path` em cada uma |
| Criar `DADOS` | `mkdir -p "$HOME/Profills LinkedIn"/{refs,catalog/raw,drafts}` | `New-Item -ItemType Directory -Force "$env:USERPROFILE\Profills LinkedIn\refs","$env:USERPROFILE\Profills LinkedIn\catalog\raw","$env:USERPROFILE\Profills LinkedIn\drafts"` |
| `voz.md` existe? | `test -f DADOS/voz.md` | `Test-Path DADOS\voz.md` |

Os comandos de instalação (`claude plugin …`, `npx skills add …`) são idênticos nos dois shells — e também no `cmd.exe`, caso o usuário os digite por conta própria. O `cmd.exe` é a exceção para caminhos: ele **não** expande `~`; se precisar mandar o usuário abrir a pasta, dê o caminho completo `C:\Users\NOME\Profills LinkedIn`.
