# profills-skills

Marketplace com dois plugins da Profills para o time comercial. Cada plugin se instala sozinho: instale só o que você usa.

| Plugin | Para quem | O que faz |
|---|---|---|
| `profills-skills` | Quem posta no LinkedIn da Profills | Acompanha o que as empresas de referência postam e gera rascunhos de post. |
| `crm-profills` | Vendedor com conta ativa no CRM | Liga o CRM ao Claude Code ou ao Codex, com as permissões da sua tela. |

## Conteúdo do LinkedIn (`profills-skills`)

O plugin acompanha o que os concorrentes e as empresas de referência postam no LinkedIn e transforma isso em rascunhos de post em português, no seu jeito de falar. Você conversa com o Claude Code em português e ele conduz cada passo, sem código.

### Pré-requisitos

- [Claude Code](https://claude.com/claude-code) instalado e com login feito.
- Google Chrome ou um derivado (Brave, Edge, Arc, Vivaldi, Opera) com a extensão **Claude para Chrome**. A coleta usa esse navegador, com o seu login, para ler os posts do LinkedIn.

### Instalar

Abra o terminal (no Windows, o **PowerShell**; no Linux ou Mac, o terminal normal) e rode estes dois comandos. No Windows, instale antes o [Git for Windows](https://git-scm.com/downloads/win), que o comando usa para baixar as skills.

```
claude plugin marketplace add https://github.com/profillsbrasil/profills-skills
claude plugin install profills-skills@profills-skills
```

Depois, dentro do Claude Code, digite `/profills-setup`. Ela confere o que falta, instala a `humanize-pt-br`, cria a pasta de dados `Profills LinkedIn` na sua pasta pessoal e diz o próximo passo.

### As skills

| Skill | O que faz para você |
|---|---|
| `profills-setup` | Instala e confere tudo, cria a pasta de dados e atualiza a pasta quando as skills mudam. |
| `profills-voz` | Conversa com você uns 10 minutos e grava o que você vende, para quem e como você fala. Todo post sai dessa voz. |
| `profills-radar` | Guarda a lista de empresas que você acompanha, importa sua planilha de concorrentes e escolhe as empresas de cada rodada, até 12, pela prioridade. |
| `profills-navegador` | Deixa o Chrome com a extensão pronto antes de qualquer coleta. |
| `profills-garimpo` | Lê os posts recentes de cada empresa da rodada no seu navegador. Post em outro idioma ganha um resumo em português. |
| `profills-boletim` | Responde "o que os concorrentes fizeram?": o que cada empresa postou de novo, quem ficou sem leitura e por quê, e 3 pautas de post. |
| `profills-post` | Escreve de 3 a 5 versões de post na sua voz e mostra lado a lado para você escolher e copiar. |

### O caminho comum

1. Instale e rode `/profills-setup`, como em [Instalar](#instalar).
2. Grave sua voz com `/profills-voz` antes do primeiro post. Sem ela a `profills-post` não escreve, porque o texto sairia com a cara de outra empresa.
3. Pergunte ao Claude "o que os concorrentes fizeram?". A `profills-boletim` monta a rodada, pede a coleta quando falta e grava o boletim com as pautas.
4. Peça "gera um post da pauta 2", com o número da pauta que você quiser. A `profills-post` pega essa pauta no boletim mais novo e escreve as versões.

### Abra o Claude dentro da pasta de dados

A pasta `Profills LinkedIn`, na sua pasta pessoal, guarda a lista de empresas, as coletas, os boletins, os rascunhos e a sua voz. Dentro dela fica um `CLAUDE.md` que as skills mantêm em dia, com o papel de cada skill e o estado da pasta. Abra o Claude Code dentro dessa pasta e ele começa a conversa já sabendo o fluxo.

No Linux ou Mac:

```
cd ~/"Profills LinkedIn"
claude
```

No Windows (PowerShell):

```
cd "$HOME\Profills LinkedIn"
claude
```

### Importar uma planilha de concorrentes

Se você já tem uma planilha de concorrentes no Excel (`.xlsx`), peça "importa minha planilha de concorrentes" e diga onde está o arquivo. A `profills-radar` lê as abas `Mapa competitivo` e `Canais digitais`, mostra o que vai entrar na lista antes de gravar e pergunta o que estiver em dúvida, como uma empresa sem página no LinkedIn ou um nome parecido com outro que você já acompanha. Rodar de novo com a mesma planilha não duplica nada.

### Atualizar

No terminal:

```
claude plugin marketplace update profills-skills
claude plugin update profills-skills@profills-skills
```

Depois, dentro do Claude Code, rode `/profills-setup`. Quando a versão nova muda o formato dos arquivos, ela atualiza a sua pasta sem perder nada e guarda antes uma cópia do que vai mudar em `Profills LinkedIn/.backup/`, numa pasta com a data do dia. Ela também atualiza a `humanize-pt-br`.

### Revisor de texto (`humanize-pt-br`)

A `humanize-pt-br` tira do rascunho as marcas de texto escrito por IA. A `profills-post` a usa em todo post, e a `profills-setup` a instala e atualiza para você. Se preferir rodar no terminal, os comandos abaixo precisam do [Node.js](https://nodejs.org) na versão LTS.

Para instalar:

```
npx skills add othavi0/skills --skill humanize-pt-br -g -y -a claude-code
```

Para atualizar:

```
npx skills update humanize-pt-br -g -y
```

O `update` só baixa quando há versão nova; com tudo em dia, ele responde que está atualizado. Se ele responder `No installed skills found matching: humanize-pt-br`, a skill foi instalada de outro jeito. Rode então o comando de instalar, que traz a versão atual, e o `update` passa a funcionar.

Para editar as skills, clone o repo; `.claude/skills` já aponta para `skills/`.

## CRM no agente (`crm-profills`)

O plugin é para o vendedor com conta ativa no CRM da Profills. Ele traz o servidor do CRM e a skill `crm-profills-conexao`, que confere a conexão e refaz o login. O agente busca clientes, lê propostas e registra atendimentos em seu nome, com as mesmas permissões da sua tela.

Para instalar, cole este pedido no seu agente, no Claude Code, no claude.ai, no Claude Desktop ou no Codex:

```
Instale o CRM da Profills seguindo https://raw.githubusercontent.com/profillsbrasil/crm-profills-mcp-docs/main/INSTALAR.md
```

O agente instala o plugin e pede o seu login no CRM. A doc completa está em [profillsbrasil/crm-profills-mcp-docs](https://github.com/profillsbrasil/crm-profills-mcp-docs).
