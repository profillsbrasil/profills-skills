---
name: profills-navegador
description: >-
  Seleciona e prepara o navegador certo via claude-in-chrome antes da
  primeira tab de cada sessão. Use antes de navegar (pesquisar na web,
  abrir um site, coletar posts), quando a tab "abriu no outro PC", quando
  as tools mcp__claude-in-chrome__ não existem ou não respondem, ou numa
  máquina sem a extensão. A profills-garimpo invoca antes de coletar.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-navegador

Garante que a navegação aconteça no **navegador certo, pronto**, antes de qualquer tab. O usuário final é o comercial: conduza pela mão, sem jargão.

**O fato que muda tudo**: a extensão claude-in-chrome conecta **por conta Claude, não por máquina**. Todos os computadores do usuário com a extensão logada aparecem conectados ao mesmo tempo, e `tabs_create_mcp`/`navigate` **não recebem navegador como parâmetro** — a tab abre no navegador *selecionado como estado da sessão*. Sem selecionar explicitamente, ela abre num computador que o usuário não está olhando.

**O cache da escolha**: `~/.config/profills-navegador/browser` guarda o último navegador que o usuário confirmou, em duas linhas — `deviceId=<id>` e `name=<nome do navegador>`. Gravar é `mkdir -p ~/.config/profills-navegador` e escrever as duas linhas. É escolha humana: desempata quando o sinal automático é ambíguo, e é oferecido em uma frase quando o sinal automático aponta para outro lugar — a correção "abriu no outro PC" custa um turno, e o anúncio existe para esse turno nunca vir.

## Fluxo

1. **Carregue as tools numa chamada só** de ToolSearch, todas com o prefixo `mcp__claude-in-chrome__`: `list_connected_browsers`, `select_browser`, `switch_browser`, `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `get_page_text`, `find`, `computer`. Tools que não aparecem por nome, ou que aparecem e não respondem, são o estado **extensão ausente nesta máquina** → conduza `references/instalacao.md`.
   *Concluído quando* as 10 tools respondem por nome, ou o roteiro de instalação começou com o usuário.

2. **`list_connected_browsers`** — sempre, antes da primeira tab. Se o usuário acabou de dizer que a tab abriu no PC errado, vá direto ao passo 3: a correção dele vence cache e heurística. Fora isso, resolva o alvo nesta ordem, parando no primeiro caso que casar:
   1. **Exatamente um navegador `isLocal:true`** (o caso comum: sessão interativa, usuário sentado nesta máquina) → `select_browser` nele e anuncie: "abrindo no navegador deste computador — se a página não aparecer aí, me avisa". Se o cache aponta para **outro** navegador que está na lista, a frase ganha a alternativa: "antes você escolheu o *PC escritório* — quer que eu use ele?". Grave o cache com este navegador (crie o diretório se preciso) — no caso do conflito, só depois que ele não pediu a troca.
   2. **Nenhum `isLocal`, cache válido** (o arquivo existe e o `deviceId` está na lista) → `select_browser` nele e anuncie: "estou usando o *PC escritório*, que você escolheu antes — quer trocar?".
   3. **Cache órfão** (o `deviceId` sumiu da lista) → apague o arquivo, avise que o navegador salvo não está mais conectado e siga.
   4. **Lista vazia, ou só PCs remotos e sem cache** — o computador do usuário está sem a extensão → conduza `references/instalacao.md`. Se ele preferir usar um dos PCs remotos, vá ao passo 3: escolher um remoto é decisão dele, dita em voz alta.
   5. **Dois ou mais `isLocal`** → cache válido entre eles desempata; senão, passo 3.

   O anúncio é **texto da sua resposta ao usuário**, não nota do seu raciocínio: se a frase "abrindo no navegador deste computador" não está no que ele lê, o passo não aconteceu.
   *Concluído quando* `select_browser` retornou OK **e** a frase de anúncio está na resposta que o usuário lê — ou o passo 3 assumiu.

3. **Pergunta — só como exceção.** Explique antes o que vai acontecer e por quê: a página abre pela extensão do Claude, a conta tem a extensão em mais de um computador, e você precisa saber em qual ele está. Depois `AskUserQuestion` com uma opção por navegador (`name` + sistema, o `isLocal` marcado como "máquina desta sessão") e sempre uma opção de socorro — "não sei / me ajuda a descobrir" — que dispara `switch_browser`: o pedido vai para **todos** os PCs e ele clica **Connect** só no computador que está usando, onde também dá para **nomear** o navegador ("PC escritório"). Nomes acabam com a dúvida "Browser 1/2/3" de vez. O `switch_browser` expira em 2 minutos sem clique: quando expirar, confirme que ele está de fato olhando o navegador e repita, ou volte à lista de opções. Grave a escolha no cache.

   > A descrição da tool `list_connected_browsers` pede pergunta sempre que houver 2+ conectados. Resolver sozinho pelo `isLocal` e pelo cache é decisão documentada do dono desta skill (usuário leigo, fricção mínima) — aceitável porque toda seleção é anunciada e trocar custa uma frase.

   A pergunta é feita **de verdade** (`AskUserQuestion`), e a resposta ao usuário termina nela — nunca num fato consumado ("troquei para o Browser 1") decidido por você.
   *Concluído quando* o usuário escolheu, `select_browser`/`switch_browser` retornou OK e o cache guarda o `deviceId` novo.

4. **Prontidão, não fé**: `tabs_context_mcp` sem `createIfEmpty` para ver o estado; crie **uma** tab própria com `tabs_create_mcp`; navegue; confirme que carregou lendo dado estruturado (`tabs_context_mcp`/`read_page`) — nunca por screenshot.
   *Concluído quando* o dado estruturado lista a tab que você criou com a URL carregada — a URL alvo quando o pedido tem uma, `about:blank` quando outra skill vai navegar em seguida.

5. **Handoff** — declare, campo a campo: o navegador (`name` e `deviceId`), o `tabId` da tab pronta, e as tools já carregadas, que a skill seguinte usa sem recarregar: `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `get_page_text`, `find`, `computer`.
   *Concluído quando* os três campos — navegador (`name` + `deviceId`), `tabId`, lista de tools — aparecem literalmente na sua última mensagem; faltou um, o handoff não aconteceu. Invocada por outra skill, devolva o controle sem sugestão própria ("navegador pronto, voltando ao que você pediu"); chamada direto pelo usuário, feche com uma única sugestão de próximo passo.

## Disciplina de tabs

Mexa apenas nas tabs que **esta skill** criou nesta sessão, identificadas pelo id exato. Mantenha ao menos uma tab viva no grupo da sessão — fechar a última derruba o grupo inteiro (deixe uma `about:blank` no lugar).

## Fatos contra o erro clássico

| Suposição tentadora | Realidade |
|---|---|
| "`isLocal:true` é garantia" | É o melhor sinal **em sessão interativa**. Em sessão remota/background diz só onde o processo roda — por isso anunciar a seleção é obrigatório. |
| "`connectedAt` indica o navegador ativo" | Instável — reconexões (sleep, reload, queda de rede) mudam o timestamp sem relação com uso. |
| "A seleção persiste entre sessões" | A seleção é estado da sessão e morre com ela; o que atravessa é o cache em disco. |
