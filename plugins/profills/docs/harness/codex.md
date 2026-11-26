# As skills profills no Codex

As skills deste plugin falam por **intenção**: escrevem "pergunte com opções (intenção `perguntar`)", e não o nome de uma ferramenta. Este arquivo diz o que cada intenção é no Codex. Leia uma vez por sessão, antes do primeiro passo da primeira skill; o equivalente do Claude Code é o `claude-code.md` ao lado.

O alvo é o **app Codex Desktop** (o app do ChatGPT com a aba Codex), com a extensão ChatGPT no navegador do usuário. O Codex CLI puro num terminal não é alvo: a navegação depende de variáveis que o app injeta.

Cada linha traz a ferramenta, como saber que ela falta, o que fazer sem ela e a evidência. **Verificado** quer dizer rodado na máquina do dono, lido na documentação oficial ou no código; **inferido** quer dizer deduzido de evidência indireta. Intenção sem a ferramenta segue a coluna "Sem a ferramenta": nunca pule o passo em silêncio.

Medição que sustenta os "verificado" do navegador e da pergunta: Codex Desktop 26.1120 para Linux, num teste só de leitura do próprio Codex em 2026-11-26, na máquina do dono.

## Intenções

| Intenção | No Codex Desktop | Sem a ferramenta | Evidência |
|---|---|---|---|
| `perguntar` | `request_user_input_async`, com opções em toda pergunta (a recomendada primeiro, com "(Recomendado)" e o porquê) | Ferramenta ausente, ou a skill pede escolha de várias: escreva as opções numeradas em texto, marque a recomendada, diga "pode responder mais de um número" quando for o caso, e termine a resposta na pergunta, esperando o comercial | A ferramenta existe na conversa do app: verificado, não disparada. Exigir opções em toda pergunta: verificado no código do CLI 0.172 (`request_user_input`). Escolha de várias numa chamada: não verificado |
| `invocar-skill` | Leia o `SKILL.md` da skill e siga-o: as do plugin ficam em `../<nome>/SKILL.md` a partir da pasta da skill atual; a `humanize-pt-br` fica em `~/.agents/skills/humanize-pt-br/SKILL.md` | Skill externa ausente: siga sem ela e diga em uma frase o que ficou de fora | Verificado: o prompt do Codex manda resolver caminho relativo à pasta do `SKILL.md`; o Codex lê `~/.agents/skills` |
| `chamar-skill-pelo-nome` | O que o comercial digita para chamar uma skill: `$profills-voz`, `$profills-post` e assim por diante, ou o pedido em palavras | — | Verificado na documentação (learn.chatgpt.com/docs/build-skills) |
| `pesquisar-web` | A busca web da sessão, quando o Codex a oferece, para páginas públicas (site da empresa, notícia). Nunca para LinkedIn ou Instagram | Sem busca web: a intenção `abrir-pagina` numa busca do Google no navegador do usuário, e leia o resultado com `ler-pagina` | Inferido: o Codex tem busca web, com outro nome e configuração não conferidos |
| `navegador-pronto` | Ferramenta `mcp__cua_repl.js`. Detecção e escolha na seção [Navegador certo](#navegador-certo-na-extensão-chatgpt) | Ferramenta ausente, ou nenhum navegador `type: "extension"` no estado: roteiro da extensão ChatGPT em `skills/profills-navegador/references/instalacao.md` | Verificado |
| `abrir-pagina` | Pelo `cua` do `mcp__cua_repl.js`, numa aba nova do navegador `extension`. A chamada exata é a que a própria ferramenta documenta na sessão | Vai para `navegador-pronto` | Verificado: o teste abriu aba sem pedir permissão. Nome da chamada: não registrado no teste |
| `ler-pagina` | Árvore de acessibilidade da aba, pelo `cua` | Vai para `navegador-pronto` | Verificado: leu LinkedIn e Instagram logados |
| `rodar-js` | JavaScript de leitura no DOM da aba, pelo `cua`. Os dois blocos JS da `navegacao.md` servem como estão | Sem JS na aba: leia com `ler-pagina` e registre na nota que a leitura foi à mão | Verificado: leitura por JS no DOM. Os blocos da garimpo rodando aqui: não verificado |
| `rolar` | Rolagem do `cua` (há `cua.scroll` no código do app), ou a tecla End | Clique em "Exibir mais resultados"; sem isso, pare a coleta com o que carregou | Inferido do código do app 26.1120; não exercitado |
| `capturar-tela` | Captura da aba gravada em disco, se a ferramenta oferecer | Sem captura em arquivo: `screenshot: null`, como manda a tabela de erros da `navegacao.md` | Não verificado |
| `fechar-aba` | Pelo `cua`, só nas abas que a sessão abriu | — | Verificado: o teste fechou a aba |
| `mostrar-pagina` | Não há Artifact. Grave o HTML autocontido (tudo inline) em `DADOS/catalog/_dashboard.html` e abra no navegador padrão: `xdg-open "<arquivo>"` no Linux, `open "<arquivo>"` no Mac, `start "" "<arquivo>"` no Windows. Diga também o caminho, no formato do sistema dele. O picker da post é HTML local e abre o navegador sozinho | O comando não abriu: dê o caminho e peça para ele abrir o arquivo com dois cliques | Inferido: a associação de HTML com o navegador existe na máquina do dono; abrir não foi testado. O plugin `visualize` do app desenha na conversa, mas não é usado aqui |
| `instrucoes-da-pasta` | O Codex lê `DADOS/AGENTS.md` quando a pasta é aberta como projeto no app | O Codex não lê `CLAUDE.md` (só com `project_doc_fallback_filenames`) | Verificado com `codex debug prompt-input` (CLI 0.172). Abrir a pasta como projeto no app: inferido, rótulo do botão não conferido |
| `instalar-plugin` | Seção [Plugin](#plugin) | — | Verificado no CLI 0.172 (`codex plugin --help`) |
| `instalar-skill-externa` | `npx skills add othavi0/skills --skill humanize-pt-br -g -y -a codex`; instalada quando `~/.agents/skills/humanize-pt-br/SKILL.md` existe | — | Inferido: o `npx skills` aceita `-a <agente>`; o Codex lê `~/.agents/skills` (verificado) |

## Navegador certo na extensão ChatGPT

1. **Estado**: rode `cua.getState()` pelo `mcp__cua_repl.js`. Com a extensão conectada, ele devolve o navegador com `type: "extension"` e um `extensionInstanceId` (verificado). Ferramenta ausente, erro de conexão ou nenhum navegador `type: "extension"`: a extensão falta ou está desligada neste computador, conduza o roteiro de instalação. Erro estranho do `cua`: `mcp__cua_repl.js_reset` uma vez e `cua.getState()` de novo; voltou o mesmo erro, roteiro de instalação.
2. **Qual navegador**: use só navegador `type: "extension"`. O `type: "iab"` é o navegador de dentro do app, sem os logins do comercial: nunca colete por ele. Com mais de um `extension` (por exemplo Chrome e Brave, ou dois perfis), cada um vem com `family`, `name` e às vezes `profileName` (lido no código do app 26.1120, não exercitado). Pergunte (intenção `perguntar`) em qual deles o LinkedIn e o Instagram estão logados, uma opção por navegador, e use o escolhido na sessão inteira. Com um só, use-o e anuncie em uma frase: "abrindo no seu <nome do navegador>".
3. **Não há cache em disco** nem escolha entre computadores: a extensão ChatGPT fala com o app deste computador. O arquivo `~/.config/profills-navegador/browser` é do Claude in Chrome e não se usa aqui.
4. **Prontidão**: abra uma aba própria, navegue e confirme que carregou lendo dado estruturado (o título da aba pela árvore de acessibilidade ou `document.title` por JS de leitura), nunca por captura de tela.
5. **Handoff**: o navegador (`name` e `extensionInstanceId`) e o identificador da aba aberta.

Login, captcha ou "atividade incomum" no meio da coleta: pare e peça ao comercial no chat, como no Claude.

Os contornos dos blocos JS da `navegacao.md` (o `_` a cada 4 dígitos no id e o texto em pedaços de 850) existem por causa do Claude in Chrome. Aqui eles não atrapalham: tire os `_` do id e junte os pedaços do mesmo jeito.

## Plugin

O app Codex Desktop e o CLI dividem a mesma pasta `~/.codex` (inferido: o app escreveu o `~/.codex/config.toml` que o CLI lê, verificado). Com o CLI no terminal:

| Passo | Comando |
|---|---|
| Conferir | `codex plugin list` mostra `profills-skills@profills-skills` com `installed, enabled` |
| Instalar | `codex plugin marketplace add https://github.com/profillsbrasil/profills-skills` e depois `codex plugin add profills-skills@profills-skills` |
| Atualizar | `codex plugin marketplace upgrade`; se `codex plugin list` não mostrar a versão nova, `codex plugin add profills-skills@profills-skills` de novo (este segundo passo é inferido) |
| Skill nova não aparece | Fechar e abrir o app Codex Desktop |

Sem o CLI no terminal, o caminho é o próprio app: **Plugins**, e o "+" no plugin (documentação learn.chatgpt.com/docs/plugins; adicionar um marketplace pelo app não foi conferido). Dentro de uma conversa do app, a skill que está rodando a partir de `~/.codex/plugins/cache/` já prova que o plugin está instalado.

## Codex ausente

A extensão ChatGPT só trabalha pelo app ChatGPT desktop (aba Codex). Sem o app, conduza pela página oficial do ChatGPT desktop para o sistema do usuário, com login na conta do ChatGPT; a configuração da extensão fica em **Settings → Computer Use** dentro do app (documentação learn.chatgpt.com/docs/chrome-extension).

## Shell

O app roda os comandos no shell do sistema. Linux e Mac usam Bash; no Windows, qual shell o app usa não foi conferido: descubra pelo primeiro comando que rodar (erro de sintaxe em `command -v` quer dizer PowerShell) e use a coluna certa de `skills/profills-setup/references/shell.md`.
