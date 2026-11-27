# Detalhes de instalação (branches que nem todo run usa)

## Windows: Git for Windows

A instalação do plugin (intenção `instalar-plugin`) clona o repositório com `git`. No Windows o Git não vem instalado — sem ele o comando falha dizendo que `git` não foi encontrado. Instale o [Git for Windows](https://git-scm.com/downloads/win) (instalador gráfico, next-next-finish, opções padrão), abra um terminal novo e repita o comando. Bônus: com ele instalado, o shell do harness pode passar a ser o Git Bash (a seção Shell do adaptador diz), e aí as checagens Bash de `references/shell.md` valem no Windows também.

## `marketplace add` falha sem ser por falta de `git`

O repositório `profillsbrasil/profills-skills` é público — não há credencial a configurar. Causas reais, na ordem de probabilidade:

1. **Sem internet** ou proxy corporativo bloqueando `github.com` — testar abrindo github.com no navegador.
2. **Comando na forma curta** (`marketplace add profillsbrasil/profills-skills`): essa forma clona por SSH (`git@github.com:`) e falha com `Permission denied (publickey)` em máquina sem chave SSH — o caso de todo PC de comercial. Use sempre a forma com URL completa do passo 3 do `SKILL.md`, que clona por HTTPS (testado: clona sem credencial).
3. **O repo ficou privado** (decisão futura): aí o Git precisa de credencial. Caminho mais simples para não-dev: instalar o GitHub CLI (cli.github.com), rodar `gh auth login` (login pelo navegador) e repetir o comando.

## Node.js ausente ou antigo

O `npx` instala a `humanize-pt-br`, e os scripts das skills precisam do Node 22.13 ou mais novo (o banco de consultas usa o SQLite que vem com ele). Passo a passo para quando o usuário escolher instalar ou atualizar o Node:

- Link: nodejs.org → baixar a versão **LTS** (não a "Current").
- Windows e Mac: instalador gráfico, next-next-finish.
- Linux: o instalador do site ou o gerenciador do sistema (`apt`, `pacman`, `dnf`) — o site é o caminho que não exige saber qual gerenciador a máquina usa.
- Node antigo: o instalador da LTS do site instala por cima da versão velha. Quem instalou pelo `nvm` roda `nvm install --lts` e `nvm alias default 'lts/*'`.
- Depois de instalar, **abrir um terminal novo** (o `PATH` não atualiza no terminal já aberto) e repetir a checagem de `npx` e a de `node -p process.versions.node`.

## humanize-pt-br: quando o `update` não acha a skill

O `npx skills` não tem um comando que só confere a versão: o `update` compara a versão instalada com a do GitHub e só baixa quando mudou, então rodá-lo com tudo em dia não altera nada. Ele encontra só o que o `npx skills add -g` registrou no arquivo de controle dele (`~/.agents/.skill-lock.json`, ou `$XDG_STATE_HOME/skills/.skill-lock.json` quando essa variável existe). Skill copiada à mão ou instalada por outra ferramenta não está nesse arquivo: o `update` responde `No installed skills found matching: humanize-pt-br` e termina sem erro, sem atualizar. Nesse caso rode o comando de instalação de novo; ele sobrescreve a cópia com a versão atual e registra a skill, e daí em diante o `update` funciona.

## unslop (opcional, só se o usuário pedir por nome)

O conflito que a pergunta do passo 3 põe na mesa: `unslop` traz "must always apply" e uma regra própria sobre travessão, que pode brigar com o que a `humanize-pt-br` decide. Quando o usuário escolhe instalar assim mesmo:

1. Registre o conflito em uma frase: "essa skill pode brigar com a humanize-pt-br em alguns casos (regra de travessão) — se notar o texto final estranho, é o primeiro lugar pra olhar".
2. Não há fonte oficial única — duas versões públicas existem, ambas instaláveis pelo comando da intenção `instalar-skill-externa`, trocando `othavi0/skills` pelo repositório e `humanize-pt-br` por `unslop`: `cursor/plugins` ou, alternativa com menos instalações, `theclaymethod/unslop`.
3. Instalada quando o arquivo que a intenção `instalar-skill-externa` aponta, com `unslop` no lugar de `humanize-pt-br`, existe.
