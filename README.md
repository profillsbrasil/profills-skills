# profills-skills

Pipeline de conteúdo para o LinkedIn da Profills: acompanha o que as empresas de referência postam e transforma isso em rascunhos de post prontos para revisar e publicar — tudo conduzido dentro do Claude Code, sem precisar mexer em código.

## Pré-requisitos

- [Claude Code](https://claude.com/claude-code) instalado e com login feito.
- Google Chrome ou um derivado (Brave, Edge, Arc, Vivaldi, Opera) com a extensão **Claude para Chrome** instalada — é o navegador que a coleta usa para ler os posts do LinkedIn.

## Instalar

Abra o terminal — no Windows, o **PowerShell**; no Linux ou Mac, o terminal normal — e rode estes dois comandos (no Windows, instale antes o [Git for Windows](https://git-scm.com/downloads/win), que o comando usa para baixar as skills):

```
claude plugin marketplace add https://github.com/profillsbrasil/profills-skills
claude plugin install profills-skills@profills-skills
```

Depois, dentro do Claude Code, digite `/profills-setup` — ela confere o resto, cria a pasta neste PC e aponta o próximo passo: a voz, se ainda não existir; senão o primeiro post, para ver o fluxo.

## Atualizar

```
claude plugin marketplace update profills-skills
claude plugin update profills-skills@profills-skills
```

## As skills

| Skill | O que faz |
|---|---|
| `profills-radar` | Guarda a lista de empresas de referência que você acompanha no LinkedIn. |
| `profills-garimpo` | Cataloga o que essas empresas postam e monta um dashboard comparando tudo. |
| `profills-post` | Gera rascunhos de post em português, no seu estilo, a partir do catálogo. |
| `profills-voz` | Cria e mantém o arquivo com o que você vende, para quem, e como você fala de verdade. |
| `profills-navegador` | Garante que o navegador certo, com a extensão, está pronto antes de qualquer coleta. |
| `profills-setup` | Instala, confere e atualiza tudo — e cria a pasta de dados na primeira vez. |

Para editar as skills, clone o repo; `.claude/skills` já aponta para `skills/`.
