# As skills profills no Claude Code

As skills deste plugin falam por **intenção**: escrevem "pergunte com opções (intenção `perguntar`)", e não o nome de uma ferramenta. Este arquivo diz o que cada intenção é no Claude Code. Leia uma vez por sessão, antes do primeiro passo da primeira skill; o equivalente do Codex é o `codex.md` ao lado.

Cada linha traz a ferramenta, como saber que ela falta, o que fazer sem ela e a evidência. **Verificado** quer dizer rodado nesta máquina, lido na documentação oficial ou no código; **inferido** quer dizer deduzido de evidência indireta. Intenção sem a ferramenta segue a coluna "Sem a ferramenta": nunca pule o passo em silêncio.

## Intenções

| Intenção | No Claude Code | Sem a ferramenta | Evidência |
|---|---|---|---|
| `perguntar` | `AskUserQuestion`: até 4 perguntas por chamada, a opção recomendada primeiro, com o porquê; `multiSelect: true` quando a skill pede escolha de várias | No modo `-p` a ferramenta não existe: escreva as opções numeradas em texto, marque a recomendada, diga "pode escolher mais de uma" quando for o caso, e termine a resposta na pergunta | Verificado: ferramenta desta sessão; ausência em `-p` na documentação do Claude Code |
| `invocar-skill` | Ferramenta `Skill` com o nome da skill (`profills-setup`, `humanize-pt-br`) | Leia o `SKILL.md` da skill (as do plugin ficam em `../<nome>/SKILL.md` a partir da pasta da skill atual) e siga-o | Verificado |
| `chamar-skill-pelo-nome` | O que o comercial digita para chamar uma skill: `/profills-voz`, `/profills-post` e assim por diante | — | Verificado |
| `pesquisar-web` | `WebSearch` para achar, `WebFetch` para ler páginas públicas (site da empresa, notícia). Nunca para LinkedIn ou Instagram: essas páginas só abrem pelo navegador do usuário | Sem as duas, a intenção `abrir-pagina` numa busca do Google no navegador do usuário | Verificado: ferramentas desta sessão |
| `navegador-pronto` | Extensão Claude in Chrome. Detecção, escolha entre computadores e cache na seção [Navegador certo](#navegador-certo-no-claude-in-chrome) | Ferramenta ausente ou nenhum navegador conectado: roteiro do Claude in Chrome em `skills/profills-navegador/references/instalacao.md` | Verificado nesta máquina |
| `abrir-pagina` | `tabs_create_mcp` para criar a aba própria, `navigate` para a URL | Vai para `navegador-pronto` | Verificado |
| `ler-pagina` | `read_page` (árvore de acessibilidade) e `get_page_text`; `find` para achar um elemento | Vai para `navegador-pronto` | Verificado |
| `rodar-js` | `javascript_tool`, que não vem no handoff da navegador: carregue com `ToolSearch` `select:mcp__claude-in-chrome__javascript_tool` | Sem ela, leia com `ler-pagina` e registre na nota que a leitura foi à mão | Verificado |
| `rolar` | `computer` com scroll ou a tecla End | Clique em "Exibir mais resultados" com `computer`; sem isso, pare a coleta com o que carregou | Verificado |
| `capturar-tela` | `computer` com screenshot e `save_to_disk: true` | Falhou ou não gravou: `screenshot: null`, como manda a tabela de erros da `navegacao.md` | Verificado; a falha já aconteceu (`schema-post.md`) |
| `fechar-aba` | `tabs_close_mcp`, só nas abas que a sessão criou, deixando uma viva no grupo | — | Verificado |
| `mostrar-pagina` | O dashboard da garimpo: carregue as skills `artifact-design` e `dataviz` e publique com a ferramenta `Artifact` (página privada em claude.ai), link na conversa. O picker da post é HTML local e abre o navegador sozinho | Sem `Artifact` (sessão sem a ferramenta): grave o HTML autocontido em `DADOS/catalog/_dashboard.html` e abra como no `codex.md` | Verificado: ferramenta desta sessão |
| `instrucoes-da-pasta` | O Claude Code lê `DADOS/CLAUDE.md`, que só traz a linha `@AGENTS.md` e importa `DADOS/AGENTS.md`. O comercial abre o Claude dentro da pasta: `cd "<caminho da pasta>"` e depois `claude` | Sem `CLAUDE.md` na pasta, o Claude Code lê o `AGENTS.md` sozinho a partir da 2.1.277 | Verificado na documentação ("Share one file with other coding tools", em code.claude.com/docs/en/memory) e ao vivo em 2026-11-26 no Claude Code 2.1.332: `claude -p` numa pasta `Profills LinkedIn` com só o import no `CLAUDE.md` respondeu o marcador que estava no `AGENTS.md` |
| `instalar-plugin` | Seção [Plugin](#plugin) | — | Verificado (`claude plugin --help`, doc discover-plugins) |
| `instalar-skill-externa` | `npx skills add othavi0/skills --skill humanize-pt-br -g -y -a claude-code`; instalada quando `~/.claude/skills/humanize-pt-br/SKILL.md` existe | — | Verificado em uso |

## Navegador certo no Claude in Chrome

**O fato que muda tudo**: a extensão conecta **por conta Claude, não por máquina**. Todos os computadores do usuário com a extensão logada aparecem conectados ao mesmo tempo, e `tabs_create_mcp`/`navigate` **não recebem navegador como parâmetro**: a aba abre no navegador *selecionado como estado da sessão*. Sem selecionar explicitamente, ela abre num computador que o usuário não está olhando.

**O cache da escolha**: `~/.config/profills-navegador/browser` guarda o último navegador que o usuário confirmou, em duas linhas, `deviceId=<id>` e `name=<nome do navegador>`. Gravar é `mkdir -p ~/.config/profills-navegador` e escrever as duas linhas. É escolha humana: desempata quando o sinal automático é ambíguo, e é oferecido em uma frase quando o sinal automático aponta para outro lugar. A correção "abriu no outro PC" custa um turno, e o anúncio existe para esse turno nunca vir. O cache é só do Claude in Chrome.

1. **Carregue as ferramentas numa chamada só** de `ToolSearch`, todas com o prefixo `mcp__claude-in-chrome__`: `list_connected_browsers`, `select_browser`, `switch_browser`, `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `get_page_text`, `find`, `computer`. Ferramentas que não aparecem por nome, ou que aparecem e não respondem, são o estado **extensão ausente nesta máquina**: conduza o roteiro de instalação.
   *Concluído quando* as 10 ferramentas respondem por nome, ou o roteiro de instalação começou com o usuário.

2. **`list_connected_browsers`**, sempre, antes da primeira aba. Se o usuário acabou de dizer que a aba abriu no PC errado, vá direto ao item 3: a correção dele vence cache e heurística. Fora isso, resolva o alvo nesta ordem, parando no primeiro caso que casar:
   1. **Exatamente um navegador `isLocal:true`** (o caso comum: sessão interativa, usuário sentado nesta máquina): `select_browser` nele e anuncie "abrindo no navegador deste computador — se a página não aparecer aí, me avisa". Se o cache aponta para **outro** navegador que está na lista, a frase ganha a alternativa: "antes você escolheu o *PC escritório* — quer que eu use ele?". Grave o cache com este navegador (crie o diretório se preciso); no caso do conflito, só depois que ele não pediu a troca.
   2. **Nenhum `isLocal`, cache válido** (o arquivo existe e o `deviceId` está na lista): `select_browser` nele e anuncie "estou usando o *PC escritório*, que você escolheu antes — quer trocar?".
   3. **Cache órfão** (o `deviceId` sumiu da lista): apague o arquivo, avise que o navegador salvo não está mais conectado e siga.
   4. **Lista vazia, ou só PCs remotos e sem cache**: o computador do usuário está sem a extensão, conduza o roteiro de instalação. Se ele preferir usar um dos PCs remotos, vá ao item 3: escolher um remoto é decisão dele, dita em voz alta.
   5. **Dois ou mais `isLocal`**: cache válido entre eles desempata; senão, item 3.

   O anúncio é **texto da sua resposta ao usuário**, não nota do seu raciocínio: se a frase "abrindo no navegador deste computador" não está no que ele lê, o passo não aconteceu.
   *Concluído quando* `select_browser` retornou OK **e** a frase de anúncio está na resposta que o usuário lê, ou o item 3 assumiu.

3. **Pergunta, só como exceção.** Explique antes o que vai acontecer e por quê: a página abre pela extensão do Claude, a conta tem a extensão em mais de um computador, e você precisa saber em qual ele está. Depois `AskUserQuestion` com uma opção por navegador (`name` + sistema, o `isLocal` marcado como "máquina desta sessão") e sempre uma opção de socorro, "não sei / me ajuda a descobrir", que dispara `switch_browser`: o pedido vai para **todos** os PCs e ele clica **Connect** só no computador que está usando, onde também dá para **nomear** o navegador ("PC escritório"). Nomes acabam com a dúvida "Browser 1/2/3" de vez. O `switch_browser` expira em 2 minutos sem clique: quando expirar, confirme que ele está de fato olhando o navegador e repita, ou volte à lista de opções. Grave a escolha no cache.

   > A descrição da ferramenta `list_connected_browsers` pede pergunta sempre que houver 2+ conectados. Resolver sozinho pelo `isLocal` e pelo cache é decisão documentada do dono desta skill (usuário leigo, fricção mínima), aceitável porque toda seleção é anunciada e trocar custa uma frase.

   A pergunta é feita **de verdade** (`AskUserQuestion`), e a resposta ao usuário termina nela, nunca num fato consumado ("troquei para o Browser 1") decidido por você.
   *Concluído quando* o usuário escolheu, `select_browser`/`switch_browser` retornou OK e o cache guarda o `deviceId` novo.

4. **Prontidão**: `tabs_context_mcp` sem `createIfEmpty` para ver o estado; crie **uma** aba própria com `tabs_create_mcp`; navegue; confirme que carregou lendo dado estruturado (`tabs_context_mcp`/`read_page`), nunca por screenshot.

5. **Handoff**: além do navegador (`name` e `deviceId`) e do `tabId`, declare as ferramentas já carregadas, que a skill seguinte usa sem recarregar: `tabs_context_mcp`, `tabs_create_mcp`, `navigate`, `read_page`, `get_page_text`, `find`, `computer`.

| Suposição tentadora | Realidade |
|---|---|
| "`isLocal:true` é garantia" | É o melhor sinal **em sessão interativa**. Em sessão remota ou em segundo plano diz só onde o processo roda; por isso anunciar a seleção é obrigatório. |
| "`connectedAt` indica o navegador ativo" | Instável: reconexões (sleep, reload, queda de rede) mudam o horário sem relação com uso. |
| "A seleção persiste entre sessões" | A seleção é estado da sessão e morre com ela; o que atravessa é o cache em disco. |

**Contornos da ferramenta** que os blocos JS da `navegacao.md` já trazem: o `javascript_tool` bloqueia sequência longa de dígitos (por isso o id volta com `_` a cada 4) e corta valor acima de uns 1.000 caracteres (por isso o texto sai em pedaços de 850).

**Conectar a extensão a esta conversa**: `/chrome` e "Enabled by default". Só se `/chrome` não existir nesta versão: `claude --chrome` no terminal, avisando antes que esse comando **reinicia o Claude Code e fecha esta conversa**.

## Plugin

| Passo | Comando |
|---|---|
| Conferir | `claude plugin list` mostra `profills-skills` |
| Instalar | `claude plugin marketplace add https://github.com/profillsbrasil/profills-skills` e depois `claude plugin install profills-skills@profills-skills` |
| Atualizar | `claude plugin marketplace update profills-skills` e depois `claude plugin update profills-skills@profills-skills` |
| Skill nova não aparece | Reabrir o Claude Code; se persistir, `claude plugin uninstall profills-skills@profills-skills` e instalar de novo |

Depois de instalar, avise: "pode ser preciso reabrir o Claude Code para as skills novas aparecerem".

## Claude Code ausente

Se `claude` não existe no terminal (`claude: command not found`, ou `'claude' não é reconhecido`), o Claude Code em si não está instalado. Conduza pela página oficial (code.claude.com/docs/en/setup) com o comando do sistema do usuário:

- **Windows (PowerShell)**: `irm https://claude.ai/install.ps1 | iex`. Se aparecer `'irm' não é reconhecido`, o usuário está no Prompt de Comando (cmd), não no PowerShell: peça para abrir o PowerShell (o prompt começa com `PS C:\`).
- **Linux e Mac**: `curl -fsSL https://claude.ai/install.sh | bash`.

Depois: abrir um terminal novo, rodar `claude` e fazer login pelo navegador. Funciona quando `claude --version` imprime um número de versão. O plano gratuito do claude.ai não inclui Claude Code: a conta precisa ser Pro, Max, Team ou Enterprise.

## Shell

A ferramenta de shell do Claude Code depende do sistema: Linux e Mac usam Bash; Windows usa Git Bash quando o Git for Windows está instalado e **PowerShell quando não está** (code.claude.com/docs/en/setup, "Set up on Windows"). As duas formas de cada checagem estão em `skills/profills-setup/references/shell.md`.
