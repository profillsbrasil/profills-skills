# Instalar e conectar a extensão (conduza pela mão)

Roteiro para quando a ferramenta do navegador não existe, não responde, ou nenhum navegador aparece conectado (intenção `navegador-pronto` do adaptador). O usuário é comercial: **um passo por vez, confirmando cada um antes do próximo**.

Antes de começar, avise o que vai acontecer: "a extensão que deixa eu ler páginas no seu navegador não está pronta nesta máquina — vou te guiar na instalação, leva uns 3 minutos".

## Qual navegador

A extensão vai no **mesmo navegador em que o LinkedIn e o Instagram dele já estão logados**: é desse login que a coleta depende, e é ele que a extensão aproveita. Pergunte qual navegador ele usa no dia a dia para essas redes, se não souber. Os dois funcionam no Chrome e nos derivados de Chromium (Edge, Brave, Opera, Vivaldi; o Claude in Chrome também no Arc). Firefox e Safari ficam fora. Com o LinkedIn aberto num navegador e a extensão em outro, a coleta abre deslogada.

## Claude Code: extensão Claude in Chrome

**Pré-requisito**: a extensão só funciona em conta Claude de plano pago. Para conferir junto com o usuário: claude.ai → **Settings** → **Plan**. Se a conta for gratuita, diga o que muda em vez de parar em silêncio: continua funcionando pesquisar empresas pela web (`profills-radar`) e escrever posts a partir de catálogo já coletado (`profills-post`); fica bloqueado coletar posts novos (`profills-garimpo`), que precisa do navegador logado.

1. **Instalar**: o link direto da extensão **"Claude"** (desenvolvedor: Anthropic) na Chrome Web Store, `https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn` → "Adicionar ao Chrome", aberto no navegador da seção acima.
2. **Entrar**: quando a extensão pedir, fazer login com a mesma conta do claude.ai.
3. **Fixar o ícone**: ícone de quebra-cabeça no canto do navegador → alfinete ao lado de "Claude" (facilita ver os pedidos de permissão depois).
4. **Conectar a esta conversa**: o comando de conectar a extensão ao Claude Code está no adaptador (`claude-code.md`, seção do Claude in Chrome), com a opção que vale para sempre. Se o Claude Code mostrar "Claude wants to use your browser", é só seguir o guiado. Se o caminho alternativo do adaptador reinicia o Claude Code, avise antes que a conversa fecha e peça para ele te chamar de novo quando voltar.
5. **Permissões por site**: na primeira ação em cada site aparece uma caixa "Claude in Chrome wants to...". Explique as opções: "Allow this action" (só desta vez) ou "Always allow actions on this site" (recomendada para os sites de trabalho, como LinkedIn e Instagram). Dá para revogar depois na aba de permissões da extensão.
6. **Nomear**: com o navegador novo na lista de conectados, sugira **nomeá-lo** já ("PC escritório", "notebook"): com vários computadores na conta, o nome é o que evita a aba abrir no lugar errado.

**Se travar**:

- **Extensão instalada mas não conecta**: conferir plano pago ativo; limpar cache e cookies de claude.ai; desabilitar extensões conflitantes; conectar de novo pelo comando do adaptador.
- **Claude Desktop instalado na mesma máquina**: a extensão prende no host do Desktop e ignora o Claude Code (issues #55524 no macOS, #58201 no Windows, ambas fechadas sem correção). Não há conserto oficial: o caminho é desinstalar ou desativar o Claude Desktop nessa máquina, ou usar outra. Cheque isto antes de repetir os passos genéricos.
- **Login por API key ou por `setup-token`**: a integração com o navegador fica desligada, porque a extensão não autentica com essa credencial. O caminho é entrar com a conta do claude.ai no Claude Code.
- **Claude Code rodando em WSL**: a integração com o navegador não é suportada; rodar o Claude Code no Windows nativo resolve.
- **Site não abre**: alguns domínios são bloqueados por padrão pela extensão (bancos, cripto, adulto).
- **Fonte oficial** (casos fora deste roteiro): coleção "Claude in Chrome" em support.claude.com, e code.claude.com/docs/en/chrome.

## Codex Desktop: extensão ChatGPT

**Pré-requisito**: a extensão trabalha pelo **app ChatGPT desktop**, na aba Codex, logado na conta do ChatGPT; o Codex num terminal comum não usa a extensão. Sem o app, a seção "Codex ausente" do adaptador (`codex.md`) diz o caminho.

1. **Instalar**: o link direto da extensão **"ChatGPT"** (desenvolvedor: OpenAI) na Chrome Web Store, `https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg` → "Adicionar ao Chrome", aberto no navegador da seção "Qual navegador".
2. **Entrar**: login na extensão com a mesma conta do ChatGPT do app.
3. **Ligar no app**: no app ChatGPT desktop, **Settings → Computer Use**, e ligar o uso do navegador com a extensão (documentação: learn.chatgpt.com/docs/chrome-extension). Se o app pedir para escolher o navegador, escolha o da seção "Qual navegador".
4. **Fixar o ícone**: quebra-cabeça no canto do navegador → alfinete ao lado de "ChatGPT".
5. **Voltar à conversa**: peça para ele dizer "pronto" aqui. Se a ferramenta do navegador continuar ausente nesta conversa, peça para abrir uma conversa nova no app (a ferramenta entra quando a conversa começa; inferido) e chamar esta skill de novo.

**Se travar**:

- **O estado não mostra navegador `extension`**: conferir se a extensão está ativa (não desativada) no navegador certo, e se o app ChatGPT está aberto, porque a ponte local com o navegador é do app.
- **Abriu o navegador de dentro do app, sem o login dele**: esse não serve para coletar; o adaptador manda usar só o navegador da extensão.
- **Fonte oficial**: learn.chatgpt.com/docs/chrome-extension.

## O teste real, nos dois

Instalação só conta quando funciona. No fim do roteiro, faça o teste de verdade:

1. Detecte de novo (intenção `navegador-pronto`) e escolha o navegador pelo Fluxo do `SKILL.md`.
2. Abra uma aba própria (intenção `abrir-pagina`) em `https://www.linkedin.com/feed/`.
3. Leia o título da aba e a URL por dado estruturado (intenção `ler-pagina`, ou `document.title` pela intenção `rodar-js`), nunca por captura de tela.
4. Feche a aba de teste (intenção `fechar-aba`).

O teste **passa** quando o título lido não está vazio e a URL continua em `linkedin.com/feed`: a extensão abriu, leu e o LinkedIn está logado nesse navegador. A URL foi para `/login`, `/authwall` ou `/uas/login`: a extensão funciona, mas o LinkedIn não está logado nesse navegador; peça para ele entrar no LinkedIn ali (ou instalar a extensão no navegador em que já está logado) e repita o teste. Nenhum navegador, ferramenta que não responde ou aba que não abre: o teste **falhou**; volte ao passo que travou. Só depois do teste que passou, volte ao Fluxo do `SKILL.md` (passo 2) e siga a tarefa original do usuário.

Diga o resultado em uma frase de comercial, com o que foi lido: "abri o LinkedIn no seu Chrome e li o título da página: está funcionando e você está logado". Não leia nem mostre post, nome ou mensagem do feed dele no teste: o título basta.
