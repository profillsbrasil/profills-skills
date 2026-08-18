---
name: profills-navegador
description: >-
  Use antes de qualquer ação de navegador via claude-in-chrome — pesquisar na
  web, abrir um site, coletar posts — e antes da primeira tab de cada sessão.
  Use também quando a tab abrir no computador errado ("abriu no outro PC"),
  quando as tools mcp__claude-in-chrome__ não existirem ou não responderem,
  ou numa máquina nova sem a extensão instalada. A profills-garimpo invoca
  esta antes de navegar — e qualquer skill que for usar o navegador deve
  fazer o mesmo.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-navegador

Garante que a navegação aconteça no **navegador certo, pronto**, antes de qualquer tab — o equivalente para navegador do que a dev-up é para dev server. O usuário final é o comercial: conduza pela mão, sem jargão.

**O fato que muda tudo**: a extensão claude-in-chrome conecta **por conta Claude, não por máquina**. Todos os computadores do usuário com a extensão logada aparecem conectados ao mesmo tempo, e `tabs_create_mcp`/`navigate` **não recebem navegador como parâmetro** — a tab abre no navegador *selecionado como estado da sessão*. Sem selecionar explicitamente, ela abre num computador que o usuário não está olhando.

## Fluxo

1. **Carregue as tools numa chamada só** de ToolSearch: `list_connected_browsers`, `select_browser`, `switch_browser`, `tabs_context_mcp`, `tabs_create_mcp`, `navigate` (+ `read_page`/`get_page_text`/`computer` se a tarefa seguir daqui). Prefixo `mcp__claude-in-chrome__` não existe → extensão ausente nesta máquina: `references/instalacao.md`.

2. **`list_connected_browsers`** — sempre, antes da primeira tab. Resolva o alvo nesta ordem, sem incomodar o usuário enquanto houver sinal confiável:
   - **Exatamente um navegador `isLocal:true`** (o caso comum: sessão interativa, usuário sentado nesta máquina) → `select_browser` nele **automaticamente**, salve no cache e **anuncie**: "abrindo no navegador deste computador — se a página não aparecer aí, me avisa". Nada de pergunta.
   - **Nenhum `isLocal`, cache válido** (`~/.config/profills-navegador/browser`, linhas `deviceId=...` e `name=...`, deviceId ainda na lista) → `select_browser` direto, anunciando qual.
   - **Nenhum `isLocal`, sem cache** (lista vazia ou só PCs remotos) → o computador do usuário está sem a extensão. Explique e mande o link `https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn`, conduzindo por `references/instalacao.md`; se existirem remotos e ele preferir usar outro PC, caia no passo 3. Nunca escolha um remoto em silêncio.
   - **Ambiguidade real** (2+ `isLocal`, ou o usuário disse que está em outro PC) → passo 3.

3. **Pergunta — só como exceção.** Nunca chega seca: explique antes o que vai acontecer e por quê (a pesquisa abre pela extensão do Claude; a conta tem a extensão em mais de um computador; você precisa saber em qual ele está). Depois a AskUserQuestion com uma opção por navegador (`name` + sistema, `isLocal` marcado como "máquina desta sessão") e a opção de escolher pelo próprio navegador — ela dispara `switch_browser`, que manda o pedido para **todos** os PCs: clicar **Connect** só no computador em que ele está, onde também dá para **nomear** o navegador ("PC escritório") — nomes acabam com a dúvida "Browser 1/2/3" de vez. Salve a escolha no cache.

   > A descrição da tool `list_connected_browsers` pede pergunta sempre que houver 2+ conectados. A seleção automática do `isLocal` é decisão documentada do dono desta skill (usuário leigo, fricção mínima) — aceitável porque o anúncio da seleção e a correção fácil são obrigatórios. Silencioso, nunca.

4. **Prontidão, não fé**: `tabs_context_mcp` sem `createIfEmpty` para ver o estado; crie **uma** tab própria com `tabs_create_mcp`; navegue; confirme que carregou lendo dado estruturado (`tabs_context_mcp`/`read_page`) — nunca por screenshot.

5. **Handoff**: declare ao usuário (e à skill que invocou) o navegador selecionado pelo nome e a tab pronta pelo id. Pedido avulso de pesquisa ("pesquisa X") → continue a pesquisa nessa tab.

## Disciplina de tabs

A skill só mexe nas tabs que **ela** criou, identificadas por id exato — nunca fecha tab alheia, nunca "parece a minha". Não feche a última tab do grupo da sessão: isso derruba o grupo inteiro (deixe `about:blank` se necessário).

## Fatos contra o erro clássico

| Suposição tentadora | Realidade |
|---|---|
| "A tab abre no PC onde esta sessão roda" | Abre no navegador **selecionado na sessão** — que pode ser outro PC da conta. |
| "`list_connected_browsers` lista perfis da mesma máquina" | Lista navegadores de **todas as máquinas** da conta (deviceId, nome, SO, isLocal). |
| "`isLocal:true` é garantia" | É o melhor sinal **em sessão interativa**. Em sessão remota/background diz só onde o processo roda — por isso o anúncio da seleção é obrigatório. |
| "`connectedAt` indica o navegador ativo" | Instável — reconexões (sleep/reload/rede) mudam o timestamp sem relação com uso. |
| "A seleção persiste entre sessões" | Não conte com isso. Re-selecione a cada sessão (cache primeiro). |

## Erros nomeados

| Sintoma | O que é | Ação |
|---|---|---|
| Tools `mcp__claude-in-chrome__*` ausentes, ou lista de navegadores vazia | Extensão não instalada/conectada | `references/instalacao.md` |
| Usuário: "abriu no outro computador" | Navegador errado selecionado — erro de **seleção**, não de sessão/authwall | Refazer passo 3, atualizar cache |
| `switch_browser` expirou (2 min sem clique) | Ninguém clicou Connect | Confirmar que o usuário está vendo o navegador; repetir ou cair na lista |
