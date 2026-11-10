# profills-skills — pipeline de conteúdo LinkedIn

Skills em `skills/`: o pipeline `profills-radar` → `profills-garimpo` → `profills-post`, a `profills-boletim` (novidades e pautas sobre a coleta), a `profills-voz` (o `voz.md` que a post consome) e as transversais `profills-navegador` e `profills-setup` (a setup cria `DADOS`). A description de cada uma diz quando usar; a tabela "Quem invoca quem" diz quem chama quem. O cache da navegador vive fora do repo, em `~/.config/profills-navegador/browser`. O usuário final é o **comercial, não dev**: "conduza pela mão" é princípio de produto de todas elas.

Os princípios operacionais de cada skill (medido vs inferido, inspirar-não-copiar, pastas por data, compliance) vivem nos próprios `SKILL.md` e references — este arquivo não os repete; ele guarda o que atravessa arquivos e o que nenhum arquivo isolado conta.

**Renomeio de 2026-08-18**: as skills chamavam `linkedin-refs`, `linkedin-catalog`, `linkedin-draft` e `product-marketing` (nesta ordem de correspondência). Os documentos de `research/` mantêm os nomes antigos de propósito — são registro histórico, não retroeditar.

## Mapa

| Caminho | O que é |
|---|---|
| `skills/<nome>/` | Fonte canônica das skills (`SKILL.md` + `references/` + `assets/` + `evals/`). `.claude/skills/*` são **symlinks** para cá — editar sempre em `skills/`. |
| `.claude-plugin/` | Manifesto do plugin (`plugin.json`) e marketplace (`marketplace.json`) com duas entradas: `profills-skills` (`source: "./"`, este repo) e `crm-profills` (`source: "url"`, o repo público `profillsbrasil/crm-profills-mcp-docs`, que é dono do plugin do CRM). A entrada do CRM usa `url` e não `github` porque o Codex lê este mesmo marketplace e pula a fonte `github`. |
| `linkedin-data/` | A pasta `DADOS` (ver regra em Invariantes) quando o diretório atual é este repo — dado vivo do usuário, não fixture de exemplo. Nome em inglês de propósito: descreve o dado (posts do LinkedIn), não uma skill; renomeá-lo quebraria os contratos de path de todas as skills + o histórico. |
| `research/linkedin-skills-achados.md` | Pesquisa que fundou o projeto (jul/2026): fatos testados sobre o LinkedIn, ToS, por que não usar scraper/API. **Está truncado no meio da última seção** — não procurar ali uma conclusão que não existe. |
| `README.md` | Guia de instalação em pt-BR para o comercial (não dev): pré-requisitos, comandos, tabela das skills, e uma seção curta do plugin do CRM que aponta para a doc pública dele. |

## O pipeline e seus contratos (handoff por arquivo)

`profills-radar` → `profills-garimpo` → `profills-post`, com a `profills-boletim` entre a garimpo e a post. As skills não se chamam por API — **acoplam-se por arquivos**, todos dentro de `DADOS` (ver regra em Invariantes). Mudar nome/formato de um destes quebra a skill seguinte:

- `DADOS/selection.md` — radar → garimpo. Efêmero (gitignored), sobrescrito a cada run. Cada linha leva nome, slug e **id numérico** (`—` se não resolvido) — o id é o fallback de slug da garimpo. Garimpo sem seleção invoca a radar, nunca pede lista direto ao usuário. Leva até `LIMITE_POR_RODADA` empresas, escolhidas pelas camadas `CAMADAS` do `radar/scripts/indice.js` (o teto vem da regra de volume do `compliance.md` da garimpo).
- `DADOS/refs/INDEX.md` + `refs/<slug>.md` — índice resume e aponta, dossiê guarda o detalhe (nunca duplicar entre os dois). A **radar** é dona do formato e cria o índice quando não existe; também o enche de uma planilha de concorrentes (`radar/scripts/importar.js`), sem duplicar ficha de quem já está na lista. A linha está na versão 2, com campos de chave nomeada que o `indice.js` lê pela tabela `CAMPOS` (formato na `profills-radar/SKILL.md`); linha da versão 1 dá `formato_antigo`. É do `id` que a seleção copia o id. A **garimpo** escreve só o campo `catálogo AAAA-MM-DD` da linha ao fim de cada coleta, e só para empresa com `status: ok`. A seção `## Do Not Copy` do dossiê é perguntada pela **garimpo** ao fim do catálogo e lida pela **profills-post** (vazio = nunca perguntado → a post pergunta).
- `DADOS/catalog/raw/<slug>/<AAAA-MM-DD>/posts.json` + `meta.json` — o dado estruturado primário e o contexto da página (seguidores = denominador da taxa de engajamento normalizada; `status` ∈ `ok|sem_posts|pagina_nao_gerenciada|erro_navegacao` — `STATUS.txt` está aposentado). Schema v2 (2026-08) em `profills-garimpo/references/schema-post.md`. Campos, opcionais e compatibilidade com coleta antiga (inclusive `idioma` e `resumo_pt`) estão no `schema-post.md`; a profills-post ainda não lê `resumo_pt`. Perfil, summary e dashboard nascem dele.
- `DADOS/catalog/<slug>.md` (template `perfil-template.md`) — o perfil por empresa; é isto (+ o `posts.json` bruto) que a **profills-post** consome. `_summary.md` é o comparativo para o humano/dashboard — a profills-post não o lê.
- `DADOS/voz.md` — a voz do usuário, criada e mantida pela skill **profills-voz** (template em `profills-voz/assets/voz-template.md`). **Ainda não existe** até a primeira run; a profills-post invoca a skill quando não o encontra. As seções `Palavras banidas` e `Isso não sou eu` são checadas pelo quality gate da profills-post; `Termos permitidos` guarda os nomes de produto que o `post/scripts/checar-formato.js` poupa quando contêm uma palavra banida; `Dores do ICP` alimenta o teste analgésico/vitamina. A linha `Quem escreve os posts:` do cabeçalho é gravada pela profills-voz, que só pergunta a autoria quando a linha falta.
- `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>.md` — saída persistida da profills-post: linhas de contexto (formato no passo 8 da `profills-post/SKILL.md`), uma linha `---`, e o texto final pronto para colar — é este formato que `post/scripts/checar-formato.js` lê. `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>/variacoes.md` guarda as 3-5 variações geradas (o usuário pode voltar à "outra").
- `DADOS/boletins/AAAA-MM-DD.md` — saída da profills-boletim (template `profills-boletim/assets/boletim-template.md`): cabeçalho com data e rodada, `## Novidades` por empresa, `## Cobertura` com os baldes do `boletim/scripts/boletim.js` e `## Pautas para você`, numeradas, cada uma com o link do post que a sustenta e o ângulo. Uma rodada por dia: a segunda no mesmo dia sobrescreve. A **profills-post** lê o mais novo quando o pedido é "a pauta N do boletim". O que é post novo, coleta desta rodada e `coleta_no_futuro` é regra do `boletim.js`, explicada nas linhas `empresas[].novos[]` e `rodada` da seção "O script" da `profills-boletim/SKILL.md`.
- `DADOS/.profills.json` — `{"versao_dados": 2, "atualizado_em": …}`, a versão da pasta; sem ele, a pasta é da versão 1. Quem o grava é a **setup**: ao criar a pasta, ou por `setup/scripts/migrar.js`, que converte a pasta antiga (índice, `STATUS.txt` legado, subpastas) com cópia em `DADOS/.backup/<data>/` (gitignored) e é idempotente. Mudança futura de formato em `DADOS` sobe a versão e ganha um passo nesse script.
- `DADOS/CLAUDE.md` — o que o Claude lê quando o comercial o abre dentro da pasta. Três partes com um dono cada: o bloco `profills:fixo` (regras, skill por pedido, onde fica cada coisa) é copiado de `profills-setup/assets/claude-dados-template.md`; o bloco `profills:mapa` (estado da pasta) é gerado dos arquivos; ambos só pelo `profills-setup/scripts/mapa.js`, que a setup e as outras 5 skills rodam no fecho. `## Notas da equipe` fica fora dos marcadores e o script nunca a reescreve. Mudar o texto do bloco fixo é editar o template; a próxima rodada de qualquer skill espalha.
- `DADOS/.picker/` — runtime do picker local da profills-post (gitignored). A escolha das variações é esse picker no formato do feed, com Copiar em cada card; Artifact fica no dashboard da garimpo, não no comparador da post.

**Quem invoca quem** (fonte única — a description de uma skill só cita invocação que existe aqui):

| Skill | Invoca | Quando |
|---|---|---|
| profills-garimpo | profills-radar | `selection.md` ausente ou vazio |
| profills-garimpo | profills-navegador | antes da primeira empresa |
| profills-post | profills-voz | `voz.md` ausente |
| profills-post | humanize-pt-br | passo de humanização |
| profills-boletim | profills-radar | `selection.md` ausente, sem data ou com data depois de hoje, `indice_ausente` ou `indice_com_problemas` do `boletim.js`, ou o comercial escolheu montar uma rodada nova em vez de terminar ou fechar a rodada anterior (a radar regrava a data, e a garimpo reabriria as páginas já coletadas) |
| profills-boletim | profills-garimpo | `rodada.faltam_coletar` do `boletim.js` com empresa |
| radar, garimpo, post, voz, boletim | profills-setup | `DADOS` não existe ou está numa versão antiga; na boletim, também `indice_ilegivel` do `boletim.js` |

Ninguém mais invoca ninguém: a garimpo segue neutra sem `voz.md`; radar, post e boletim não navegam. Skill invocada por outra devolve o controle sem sugestão própria; chamada pelo usuário termina com **uma** sugestão.

## Invariantes que atravessam arquivos

- **Pasta de dados (`DADOS`)** — dona: `profills-setup/SKILL.md`; as outras 5 skills carregam a cópia **literal** (o plugin roda onde este arquivo não existe) e a igualdade se confere com `grep -h "^\*\*Pasta de dados" skills/*/SKILL.md | sort -u | wc -l` (tem de dar 1, e `grep -l` tem de listar radar, garimpo, post, voz e boletim): se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, ou se `DADOS/.profills.json` falta ou traz `versao_dados` menor que 2, invoque a skill `profills-setup` — ela cria ou atualiza a pasta e confere o resto da instalação.
- **Taxonomias fechadas** (`profills-garimpo/references/taxonomias.md`) — valores fixos para formato/hook/ângulo/gatilho, compartilhados por schema, perfis, dashboard e moldes da profills-post. Mudar um valor quebra a comparabilidade com todos os `posts.json` históricos; se precisar, migrar o histórico junto.
- **Não propor scraper/API/Firecrawl como "melhoria"** da coleta. O navegador real logado é decisão fundamentada (`profills-garimpo/references/compliance.md` + `research/`), não limitação técnica.
- **Fatos de navegação validados ao vivo** (as duas estruturas da aba Publicações, ordenação por Recentes, data tirada do id do post) vivem só em `profills-garimpo/references/navegacao.md`. Quando a UI do LinkedIn mudar, atualizar **lá** — não rederivar nem criar segunda cópia.

## Dependências externas ao repo

- `humanize-pt-br` — skill global do usuário, publicada em [othavi0/skills](https://github.com/othavi0/skills) (`skills/writing/humanize-pt-br`); instalada e mantida pela **profills-setup**, encadeada pela profills-post no passo de humanização.
- `artifact-design` — skill do harness, exigida antes de publicar o dashboard da garimpo via tool Artifact. O comparador da profills-post é o picker local (`scripts/picker/`), não Artifact. `dataviz` — só o dashboard da garimpo.
- Moldes, taxonomias, benchmark e quality gate são adaptados (traduzidos) de [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT) — manter a atribuição ao importar mais material de lá.

## Convenções

- Tudo em pt-BR — SKILL.md, references, dados, commits.
- Cada skill tem `evals/evals.json` (prompt → expected_output → `expectations` verificáveis, com fixture em `evals/files/<id>/` quando o caso depende de estado em disco). Mudança de comportamento numa skill atualiza os evals dela **e roda o runner**: `Workflow({name: "evals-profills", args: {skills: ["profills-x"], baseline: "main", iteration: N}})` (`.claude/workflows/evals-profills.js`, usa o plugin `skill-creator@claude-plugins-official`; workspace em `../profills-evals-workspace/`, fora do repo).
- Contas e checagens que precisam sair iguais toda vez ficam em `skills/<nome>/scripts/*.js` (Node puro); os `*.test.js` ao lado rodam com `node <arquivo>`, sem dependência. O SKILL.md manda rodar e usa a saída; não recalcula em prosa.
- O motor de render do picker é um só: `profills-post/scripts/picker/picker-frame.html` (o servidor injeta o bloco `DADOS`; aberto cru no navegador, renderiza o `EXEMPLO` e serve de referência visual). Mudança visual do picker se faz nesse arquivo, que é o único template: uma segunda cópia já divergiu uma vez.
- `profills-post/scripts/picker/` (server.cjs, helper.js, lifecycle-lib.cjs, start/stop-server.sh) deriva de [obra/superpowers](https://github.com/obra/superpowers) (MIT, Jesse Vincent) — licença em `scripts/picker/LICENSE-obra-superpowers`, cabeçalho de atribuição nesses cinco arquivos; manter ao sincronizar com o upstream.
- Frontmatter só com `name`, `description` e `metadata` (padrão aberto agentskills.io; `metadata` é campo oficial). Description só com gatilhos, perto de 300 caracteres, e só cita invocação da tabela "Quem invoca quem".
- Não instalar o plugin dentro deste repo: os symlinks de `.claude/skills/` já servem as skills, e instalar duplicaria tudo.

## Pegadinhas

- As mudanças entram por PR em `profillsbrasil/profills-skills`; o que entrou e quando está no `git log`.
- O `.gitignore` da raiz ignora o runtime do harness (`.claude/scheduled_tasks.lock`, `settings.local.json`), os `skills/*.zip` e as pastas de teste do picker; os symlinks de `.claude/skills/*` **são** versionados. O de `linkedin-data/` ignora screenshots, imagens brutas, `selection.md`, `.picker/` e `.backup/`, e versiona `refs/`, `catalog/*.md`, `catalog/raw/**/*.json`, `drafts/`, `boletins/`, `voz.md`, `.profills.json` e `CLAUDE.md`.
- `linkedin-data/` é dado real e incompleto (smoke test de 2026-07-14): confira com `ls` o que existe antes de usá-lo como exemplo, porque faltam perfis `catalog/<slug>.md`, `voz.md` e coletas com seguidores.
- A profundidade da coleta tem dois nomes: **janela padrão** (semanal, `destaque_semana`) e **janela ampliada** (`outlier`), definidos no schema v2. Use só esses.
