# Instalar e conectar a extensão (conduza pela mão)

Roteiro para quando as tools `mcp__claude-in-chrome__*` não existem ou nenhum navegador aparece conectado. O usuário é comercial: **um passo por vez, confirmando cada um antes do próximo**.

Antes de começar, avise o que vai acontecer: "a extensão do Claude para o navegador não está nesta máquina — vou te guiar na instalação, leva uns 3 minutos".

## Pré-requisito

A extensão só funciona em conta de plano pago. Para conferir junto com o usuário: claude.ai → **Settings** → **Plan**.

Se a conta for gratuita, diga o que muda em vez de parar em silêncio: continua funcionando pesquisar empresas pela web (`profills-radar`) e escrever posts a partir de catálogo já coletado (`profills-post`); fica bloqueado coletar posts novos no LinkedIn (`profills-garimpo`), que precisa do navegador logado.

## Passos

1. **Instalar**: mande o link direto da extensão **"Claude"** na Chrome Web Store — `https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn` (desenvolvedor: Anthropic) → "Adicionar ao Chrome". Funciona no Chrome e nos derivados (Brave, Edge, Arc, Vivaldi, Opera): instale no navegador que ele já usa no dia a dia.
2. **Entrar**: quando a extensão pedir, fazer login com a mesma conta do claude.ai.
3. **Fixar o ícone**: ícone de quebra-cabeça no canto do navegador → alfinete ao lado de "Claude" (facilita ver os pedidos de permissão depois).
4. **Conectar ao Claude Code**: aqui nesta conversa, rodar `/chrome` e escolher **"Enabled by default"** — vale para sempre e a conversa continua de onde parou. Se o Claude Code mostrar "Claude wants to use your browser", é só seguir o guiado. Caminho alternativo, só se o `/chrome` não existir nesta versão: `claude --chrome` no terminal — avise antes que esse comando **reinicia o Claude Code e fecha esta conversa**, e peça para ele te chamar de novo quando voltar.
5. **Permissões por site**: na primeira ação em cada site aparece uma caixa "Claude in Chrome wants to..." — explicar as opções: "Allow this action" (só desta vez) ou "Always allow actions on this site" (recomendada para os sites de trabalho, ex.: LinkedIn). Dá para revogar depois na aba de permissões da extensão.
6. **Verificar**: rodar `list_connected_browsers` de novo. O navegador novo deve aparecer — sugira **nomeá-lo** já ("PC escritório", "notebook"): com vários computadores na conta, o nome é o que evita a tab abrir no lugar errado. Com ele na lista, volte ao Fluxo do SKILL.md (passo 2) e siga a tarefa original do usuário.

## Se travar

- **Extensão instalada mas não conecta** → conferir plano pago ativo; limpar cache/cookies de claude.ai; desabilitar extensões conflitantes; reconectar via `/chrome`.
- **Claude Desktop instalado na mesma máquina** → a extensão prende no host do Desktop e ignora o Claude Code (issues #55524 no macOS, #58201 no Windows, ambas fechadas sem correção). Não há fix oficial: o caminho é desinstalar/desativar o Claude Desktop nessa máquina, ou usar outra. Cheque isto antes de repetir o troubleshooting genérico.
- **Login por API key ou por `claude setup-token`** → a integração com o navegador fica desligada mesmo com `--chrome`, porque a extensão não autentica com essa credencial. O caminho é entrar com `/login` na conta do claude.ai.
- **Claude Code rodando em WSL** → a integração com o navegador não é suportada; rodar o Claude Code no Windows nativo resolve.
- **Site não abre** → alguns domínios são bloqueados por padrão pela extensão (bancos, cripto, adulto).
- **Fonte oficial** (casos fora deste roteiro): coleção "Claude in Chrome" em support.claude.com.
