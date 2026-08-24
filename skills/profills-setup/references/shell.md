# Mesma checagem, dois shells

A ferramenta de shell do Claude Code depende do sistema: Linux e Mac usam Bash; Windows usa Git Bash quando o Git for Windows está instalado e **PowerShell quando não está** (doc oficial: code.claude.com/docs/en/setup, "Set up on Windows"). Descubra qual você tem pelo primeiro comando que rodar — erro de sintaxe em `command -v` significa PowerShell. A partir daí, use a coluna certa.

`<DADOS>` é placeholder: **resolva o caminho antes de rodar** qualquer linha que o contenha (`linkedin-data/` na raiz do repo-fonte; senão `$HOME/Profills LinkedIn` no Bash e `$env:USERPROFILE\Profills LinkedIn` no PowerShell). O caminho mostrado ao usuário é sempre no formato do sistema dele: `/home/nome/Profills LinkedIn` ou `C:\Users\NOME\Profills LinkedIn`.

| Checagem | Bash (Linux, Mac, Git Bash) | PowerShell (Windows sem Git) |
|---|---|---|
| Estou num repo git? | `git rev-parse --show-toplevel` | igual (sem `git` instalado o comando não existe → você não está num repo, a linha seguinte não se aplica; use `HOME`) |
| É o repo-fonte? | `test -f "$(git rev-parse --show-toplevel)/skills/profills-setup/SKILL.md"` | `Test-Path "$(git rev-parse --show-toplevel)\skills\profills-setup\SKILL.md"` |
| npx existe? | `command -v npx` | `Get-Command npx` |
| humanize-pt-br instalada? | `ls ~/.claude/skills/humanize-pt-br/SKILL.md ~/.agents/skills/humanize-pt-br/SKILL.md 2>/dev/null` (uma linha basta) | `Test-Path "$env:USERPROFILE\.claude\skills\humanize-pt-br\SKILL.md","$env:USERPROFILE\.agents\skills\humanize-pt-br\SKILL.md"` |
| `DADOS` existe com as subpastas? | `ls -d "<DADOS>/refs" "<DADOS>/catalog/raw" "<DADOS>/drafts"` | `Test-Path "<DADOS>\refs","<DADOS>\catalog\raw","<DADOS>\drafts"` |
| `voz.md` existe? | `test -f "<DADOS>/voz.md"` | `Test-Path "<DADOS>\voz.md"` |
| Criar `DADOS` | `mkdir -p "<DADOS>/refs" "<DADOS>/catalog/raw" "<DADOS>/drafts"` | `New-Item -ItemType Directory -Force "<DADOS>\refs","<DADOS>\catalog\raw","<DADOS>\drafts"` |

## `.gitignore`, só no caso repo-fonte

Dentro do repo-fonte a pasta é `linkedin-data/` e está sob git: a seleção da rodada é efêmera e as imagens da coleta são pesadas. Se `linkedin-data/.gitignore` não existir, crie com este conteúdo:

```
# Dados brutos pesados da coleta — não versionar
catalog/raw/**/screenshots/
catalog/raw/**/*.png
catalog/raw/**/*.jpg

# Seleção ativa é efêmera por sessão
selection.md
```

Versionados de propósito: `refs/`, `catalog/*.md`, `catalog/raw/**/*.json`, `drafts/` e `voz.md`. Ignorado de verdade quando `git check-ignore linkedin-data/selection.md` responde o caminho. Fora do repo-fonte (`~/Profills LinkedIn/`) não há git — nada a ignorar.

## cmd.exe

Os comandos de instalação (`claude plugin …`, `npx skills add …`) são idênticos nos dois shells — e também no `cmd.exe`, caso o usuário os digite por conta própria. O `cmd.exe` é a exceção para caminhos: ele **não** expande `~`; para mandar o usuário abrir a pasta, dê o caminho completo `C:\Users\NOME\Profills LinkedIn`.
