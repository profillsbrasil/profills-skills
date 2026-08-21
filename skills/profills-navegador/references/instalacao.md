# Instalar e conectar a extensão (conduza pela mão)

Roteiro para quando as tools `mcp__claude-in-chrome__*` não existem ou nenhum navegador aparece conectado. O usuário é comercial: **um passo por vez, confirmando cada um antes do próximo** — não despeje a lista inteira.

Antes de começar, avise o que vai acontecer: "a extensão do Claude para o navegador não está nesta máquina — vou te guiar na instalação, leva uns 3 minutos".

## Pré-requisito

Plano pago do Claude (Pro, Max, Team ou Enterprise). No plano gratuito a extensão não funciona — se for o caso, pare aqui e explique.

## Passos

1. **Instalar**: mande o link direto da extensão **"Claude"** na Chrome Web Store — `https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn` (desenvolvedor: Anthropic) → "Adicionar ao Chrome". Funciona no Chrome e, via Claude Code, também em Brave, Edge, Arc, Vivaldi e Opera — o usuário deste pipeline usa **Brave**, e está coberto.
2. **Entrar**: quando a extensão pedir, fazer login com a mesma conta do claude.ai.
3. **Fixar o ícone**: ícone de quebra-cabeça no canto do navegador → alfinete ao lado de "Claude" (facilita ver os pedidos de permissão depois).
4. **Conectar ao Claude Code**: no terminal, rodar `claude --chrome` — ou, dentro de uma sessão, `/chrome` e escolher "Enabled by default" para não precisar da flag nunca mais. Se o Claude Code mostrar "Claude wants to use your browser", é só seguir o guiado.
5. **Permissões por site**: na primeira ação em cada site aparece uma caixa "Claude in Chrome wants to..." — explicar as opções: "Allow this action" (só desta vez) ou "Always allow actions on this site" (recomendada para os sites de trabalho, ex.: LinkedIn). Dá para revogar depois na aba de permissões da extensão.
6. **Verificar**: rodar `list_connected_browsers` de novo. O navegador novo deve aparecer — sugira **nomeá-lo** já ("PC escritório", "notebook"): com vários computadores na conta, o nome é o que evita a tab abrir no lugar errado.

Depois do passo 6, voltar ao Fluxo do SKILL.md (passo 2).

## Se travar

- Extensão instalada mas não conecta → conferir plano pago ativo; limpar cache/cookies de claude.ai; desabilitar extensões conflitantes; reconectar via `/chrome`.
- Site não abre → alguns domínios são bloqueados por padrão pela extensão (bancos, cripto, adulto).
- Fonte oficial (para casos fora deste roteiro): coleção "Claude in Chrome" em support.claude.com.
