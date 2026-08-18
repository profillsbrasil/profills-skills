# Codex × navegador e skills — achados (2026-08-18)

Pesquisa feita ao desenhar a `profills-navegador` (v1 ficou só claude-in-chrome, por decisão do usuário). Este arquivo guarda o que foi verificado sobre o lado Codex para quando esse suporte for atacado. Fatos com fonte; datas de agosto/2026.

## Skills: já funcionam no Codex sem mudar nada

- O Codex (CLI e IDE) descobre `SKILL.md` nativamente desde dez/2025, varrendo **`.agents/skills/`** nos escopos repo (`$CWD`, `$CWD/..`, raiz do git), user (`~/.agents/skills/`) e admin (`/etc/codex/skills`). O layout deste repo já é o caminho nativo — **sem symlink**. Confirmado na doc (learn.chatgpt.com/docs/build-skills, redirecionada de developers.openai.com/codex/skills) e no código (`codex-rs/core/src/skills.rs`, `SkillScope::{User,Repo,System,Admin}`).
- Invocação: `/skills` lista; `$nome-da-skill` força; ativação implícita casa a description contra o prompt. Só as descriptions entram no prompt inicial (~2% da janela ou 8000 chars); o corpo carrega sob demanda.
- `AGENTS.md` é convenção separada (instruções sempre presentes) — o spec agents.md não menciona skills; não houve fusão.

## Detecção de harness dentro de um SKILL.md

- Claude Code: `CLAUDECODE=1` é universal e documentada em todo subprocesso (code.claude.com/docs/en/env-vars); há também `CLAUDE_CODE_CHILD_SESSION`.
- Codex: **não existe variável universal equivalente**. Sinais condicionais no código-fonte: `CODEX_SANDBOX` (=`seatbelt`, só macOS com sandbox), `CODEX_SANDBOX_NETWORK_DISABLED` (só com rede restrita), `CODEX_CI=1` (só no `unified_exec`). Heurística honesta: checar `CLAUDECODE`; ausente, tratar `CODEX_*` presentes ou a existência de `~/.codex/` como indício, declarando que é melhor esforço.

## Navegador: não há equivalente 1:1 do claude-in-chrome no CLI

- **"Codex for Chrome"** (extensão oficial OpenAI, mai/2026): usa a sessão real logada (LinkedIn/Gmail citados na doc), mas **só funciona pelo app desktop, só macOS/Windows** — não pelo CLI nem no Linux. O CLI responde "privileged native pipe bridge is not available" (issues openai/codex#22164 e #26820, abertas, sem previsão).
- Caminho viável no CLI: MCP. Melhor opção mapeada: **chrome-devtools-mcp** (time Chrome DevTools do Google) anexado a um Chrome real **já logado** — usuário abre `google-chrome --remote-debugging-port=9222 --user-data-dir=<perfil>` e o servidor roda com `--browserUrl=http://127.0.0.1:9222`. Registro: `codex mcp add chrome-devtools -- npx chrome-devtools-mcp@latest`. Fonte: github.com/ChromeDevTools/chrome-devtools-mcp.
- Playwright MCP (Microsoft) por padrão usa perfil próprio isolado (sem cookies do usuário); usar o perfil real esbarra no bloqueio do Chrome v136+ a remote debugging no user-data-dir padrão (exige cópia do perfil).
- **Custo real da paridade**: as primitivas do chrome-devtools-mcp são outras (CDP, não as tools `find`/`computer`/`read_page` do claude-in-chrome) — dar suporte pleno exige portar a lógica de `profills-garimpo/references/navegacao.md`, não trocar um parâmetro.

## MCP no Codex (para instruções de setup futuras)

`~/.codex/config.toml` (ou `.codex/config.toml` do projeto), tabela `[mcp_servers.<nome>]` com `command`/`args`/`env` (stdio) ou `url` (HTTP). CLI: `codex mcp add <nome> -- <comando>` / `--url <url>`, `codex mcp list`, `/mcp` dentro da sessão. Fonte: learn.chatgpt.com/docs/extend/mcp e `codex-rs/cli/src/mcp_cmd.rs`.
