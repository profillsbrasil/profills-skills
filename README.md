# profills-skills

Marketplace com dois plugins da Profills para o time comercial. Cada plugin se instala sozinho: instale só o que você usa.

| Plugin | Para quem | O que faz |
|---|---|---|
| `profills-skills` | Quem posta no LinkedIn da Profills | Acompanha o que as empresas de referência postam no LinkedIn e no Instagram e gera rascunhos de post, no Claude Code ou no Codex Desktop. |
| `crm-profills` | Vendedor com conta ativa no CRM | Liga o CRM ao Claude Code ou ao Codex, com as permissões da sua tela. |

## Conteúdo do LinkedIn (`profills-skills`)

O plugin acompanha o que os concorrentes e as empresas de referência postam no LinkedIn e no Instagram e transforma isso em rascunhos de post em português, no seu jeito de falar. Você conversa com o assistente em português e ele conduz cada passo, sem código. Ele funciona do mesmo jeito em dois assistentes: o **Claude Code** e o **Codex Desktop** (o app do ChatGPT, na aba Codex). Use o que a sua conta tem.

### Pré-requisitos

- Um dos dois assistentes, instalado e com login feito:
  - [Claude Code](https://claude.com/claude-code), com conta Claude de plano pago (Pro, Max, Team ou Enterprise);
  - ou o app **ChatGPT desktop**, com a aba Codex.
- A extensão do navegador do seu assistente, instalada no **mesmo navegador em que o seu LinkedIn e o seu Instagram estão logados** (Chrome, Edge, Brave, Opera ou Vivaldi). A coleta abre as páginas nesse navegador, com o seu login, e só lê.
  - No Claude Code: a extensão [**Claude**](https://chromewebstore.google.com/detail/claude/fcoeoabgfenejglbffodgkkbkcdhcgfn) (Claude in Chrome), da Anthropic.
  - No Codex Desktop: a extensão [**ChatGPT**](https://chromewebstore.google.com/detail/chatgpt/hehggadaopoacecdllhhajmbjkdcmajg), da OpenAI, ligada no app em **Settings → Computer Use**.
- [Node.js](https://nodejs.org) 22.13 ou mais novo (a versão LTS do site serve).

Não sabe se tem tudo? Instale o plugin e rode a `profills-setup`: ela confere cada item, guia a instalação do que falta, inclusive da extensão, e testa o navegador abrindo o LinkedIn e lendo o título da página. A extensão só fica ✅ quando esse teste passa.

### Instalar

Abra o terminal (no Windows, o **PowerShell**; no Linux ou Mac, o terminal normal). No Windows, instale antes o [Git for Windows](https://git-scm.com/downloads/win), que os comandos usam para baixar as skills.

No **Claude Code**:

```
claude plugin marketplace add https://github.com/profillsbrasil/profills-skills
claude plugin install profills-skills@profills-skills
```

Depois, dentro do Claude Code, digite `/profills-setup`.

No **Codex Desktop**, com o comando `codex` no terminal:

```
codex plugin marketplace add https://github.com/profillsbrasil/profills-skills
codex plugin add profills-skills@profills-skills
```

Feche e abra o app, e numa conversa da aba Codex digite `$profills-setup` (ou peça "configura as skills da Profills"). Sem o comando `codex` no terminal, instale pelo próprio app, em **Plugins**.

A `profills-setup` confere o que falta, instala a `humanize-pt-br`, cria a pasta de dados `Profills LinkedIn` na sua pasta pessoal, testa o navegador e diz o próximo passo.

### As skills

| Skill | O que faz para você |
|---|---|
| `profills-setup` | Instala e confere tudo, cria a pasta de dados e atualiza a pasta quando as skills mudam. |
| `profills-voz` | Conversa com você uns 10 minutos e grava o que você vende, para quem e como você fala. Todo post sai dessa voz. |
| `profills-radar` | Guarda a lista de empresas que você acompanha, importa sua planilha de concorrentes e escolhe as empresas e as redes de cada rodada pela prioridade, dentro de um limite de páginas que protege a sua conta (12 empresas só com LinkedIn, menos quando elas têm Instagram). |
| `profills-navegador` | Deixa o seu navegador, com a extensão do assistente, pronto antes de abrir qualquer página (a coleta da garimpo e as páginas que a radar lê), e guia a instalação da extensão quando falta. |
| `profills-garimpo` | Lê os posts recentes de cada empresa da rodada no seu navegador, no LinkedIn e no Instagram, e mostra os números de cada rede separados. Post em outro idioma ganha um resumo em português. |
| `profills-boletim` | Responde "o que os concorrentes fizeram?": o que cada empresa postou de novo, quem ficou sem leitura e por quê, e 3 pautas de post. |
| `profills-post` | Escreve de 3 a 5 versões de post na sua voz e mostra lado a lado para você escolher e copiar. |

### O caminho comum

No Claude Code você chama uma skill com `/` (`/profills-voz`); no Codex, com `$` (`$profills-voz`). Nos dois dá para pedir em palavras.

1. Instale e rode a `profills-setup`, como em [Instalar](#instalar).
2. Grave sua voz com a `profills-voz` antes do primeiro post. Sem ela a `profills-post` não escreve, porque o texto sairia com a cara de outra empresa.
3. Pergunte "o que os concorrentes fizeram?". A `profills-boletim` monta a rodada, pede a coleta quando falta e grava o boletim com as pautas. Se a rodada anterior ficou pela metade, ela oferece coletar só as empresas que faltam, sem abrir de novo as páginas já lidas.
4. Peça "gera um post da pauta 2", com o número da pauta que você quiser. A `profills-post` pega essa pauta no boletim mais novo e escreve as versões.

### Abra o assistente dentro da pasta de dados

A pasta `Profills LinkedIn`, na sua pasta pessoal, guarda a lista de empresas, as coletas, os boletins, os rascunhos e a sua voz. Dentro dela fica um `AGENTS.md` que as skills mantêm em dia, com o papel de cada skill e o estado da pasta, e um `CLAUDE.md` de uma linha que faz o Claude Code ler o mesmo arquivo. Abra o assistente dentro dessa pasta e ele começa a conversa já sabendo o fluxo.

No Claude Code, no Linux ou Mac:

```
cd ~/"Profills LinkedIn"
claude
```

No Claude Code, no Windows (PowerShell):

```
cd "$HOME\Profills LinkedIn"
claude
```

No Codex Desktop, abra a pasta `Profills LinkedIn` como o projeto da conversa.

### Importar uma planilha de concorrentes

Se você já tem uma planilha de concorrentes no Excel (`.xlsx`), peça "importa minha planilha de concorrentes" e diga onde está o arquivo. A `profills-radar` lê as abas `Mapa competitivo` e `Canais digitais`, mostra o que vai entrar na lista antes de gravar e pergunta o que estiver em dúvida, como uma empresa sem página no LinkedIn ou um nome parecido com outro que você já acompanha. Rodar de novo com a mesma planilha não duplica nada.

### Atualizar

No terminal, no Claude Code:

```
claude plugin marketplace update profills-skills
claude plugin update profills-skills@profills-skills
```

No Codex Desktop:

```
codex plugin marketplace upgrade
```

Depois rode a `profills-setup`. Quando a versão nova muda o formato dos arquivos, ela atualiza a sua pasta sem perder nada e guarda antes uma cópia do que vai mudar em `Profills LinkedIn/.backup/`, numa pasta com a data do dia. Ela também atualiza a `humanize-pt-br`.

### Revisor de texto (`humanize-pt-br`)

A `humanize-pt-br` tira do rascunho as marcas de texto escrito por IA. A `profills-post` a usa em todo post, e a `profills-setup` a instala e atualiza para você. Se preferir rodar no terminal, os comandos abaixo precisam do [Node.js](https://nodejs.org) na versão LTS.

Para instalar:

```
npx skills add othavi0/skills --skill humanize-pt-br -g -y -a claude-code
```

No Codex, troque `-a claude-code` por `-a codex`.

Para atualizar:

```
npx skills update humanize-pt-br -g -y
```

O `update` só baixa quando há versão nova; com tudo em dia, ele responde que está atualizado. Se ele responder `No installed skills found matching: humanize-pt-br`, a skill foi instalada de outro jeito. Rode então o comando de instalar, que traz a versão atual, e o `update` passa a funcionar.

Para editar as skills, clone o repo; `.claude/skills` já aponta para `plugins/profills/skills/`. As skills falam por intenção, e o que cada intenção é em cada assistente fica em `plugins/profills/docs/harness/`; `node plugins/profills/scripts/checar-harness.js` confere que nenhuma skill cita ferramenta de um assistente só.

## CRM no agente (`crm-profills`)

O plugin é para o vendedor com conta ativa no CRM da Profills. Ele traz o servidor do CRM e a skill `crm-profills-conexao`, que confere a conexão e refaz o login. O agente busca clientes, lê propostas e registra atendimentos em seu nome, com as mesmas permissões da sua tela.

Para instalar, cole este pedido no seu agente, no Claude Code, no claude.ai, no Claude Desktop ou no Codex:

```
Instale o CRM da Profills seguindo https://raw.githubusercontent.com/profillsbrasil/crm-profills-mcp-docs/main/INSTALAR.md
```

O agente instala o plugin e pede o seu login no CRM. A doc completa está em [profillsbrasil/crm-profills-mcp-docs](https://github.com/profillsbrasil/crm-profills-mcp-docs).
