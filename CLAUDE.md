# profills-skills — pipeline de conteúdo LinkedIn

Seis skills project-level: o pipeline `profills-radar` → `profills-garimpo` → `profills-post` (catalogar o que empresas de referência postam e transformar em rascunhos pt-BR) + `profills-voz` (cria e mantém o arquivo de voz do usuário que a profills-post consome) + `profills-navegador` (transversal: garante o navegador certo e pronto via claude-in-chrome — o usuário tem a extensão em várias máquinas — e conduz a instalação onde falta; a garimpo a invoca antes de navegar, e o cache dela vive fora do repo, em `~/.config/profills-navegador/browser`) + `profills-setup` (transversal: instala, confere e atualiza a instalação do plugin e explica o resultado ao usuário; é quem cria a pasta de dados `DADOS` na primeira vez). O usuário final é o **comercial, não dev** — "conduza pela mão" é princípio de produto de todas elas, não floreio.

Os princípios operacionais de cada skill (medido vs inferido, inspirar-não-copiar, pastas por data, compliance) vivem nos próprios `SKILL.md` e references — este arquivo não os repete; ele guarda o que atravessa arquivos e o que nenhum arquivo isolado conta.

**Renomeio de 2026-08-18**: as skills chamavam `linkedin-refs`, `linkedin-catalog`, `linkedin-draft` e `product-marketing` (nesta ordem de correspondência). Os documentos de `research/` mantêm os nomes antigos de propósito — são registro histórico, não retroeditar.

## Mapa

| Caminho | O que é |
|---|---|
| `skills/<nome>/` | Fonte canônica das skills (`SKILL.md` + `references/` + `assets/` + `evals/`). `.claude/skills/*` são **symlinks** para cá — editar sempre em `skills/`. |
| `.claude-plugin/` | Manifesto do plugin (`plugin.json`) + marketplace (`marketplace.json`, `source: "./"`) — é o que torna `claude plugin install profills-skills@profills-skills` possível em outra máquina. |
| `linkedin-data/` | A pasta `DADOS` (ver regra em Invariantes) quando o diretório atual é este repo — dado vivo do usuário, não fixture de exemplo. Nome em inglês de propósito: descreve o dado (posts do LinkedIn), não uma skill; renomeá-lo quebraria os contratos de path das 6 skills + o histórico. |
| `research/linkedin-skills-achados.md` | Pesquisa que fundou o projeto (jul/2026): fatos testados sobre o LinkedIn, ToS, por que não usar scraper/API. **Está truncado no meio da última seção** — não procurar ali uma conclusão que não existe. |
| `README.md` | Guia de instalação em pt-BR para o comercial (não dev): pré-requisitos, comandos, tabela das 6 skills. |

## O pipeline e seus contratos (handoff por arquivo)

`profills-radar` → `profills-garimpo` → `profills-post`. As skills não se chamam por API — **acoplam-se por arquivos**, todos dentro de `DADOS` (ver regra em Invariantes). Mudar nome/formato de um destes quebra a skill seguinte:

- `DADOS/selection.md` — radar → garimpo. Efêmero (gitignored), sobrescrito a cada run. Cada linha leva nome, slug e **id numérico** (`—` se não resolvido) — o id é o fallback de slug da garimpo. Garimpo sem seleção invoca a radar, nunca pede lista direto ao usuário.
- `DADOS/refs/INDEX.md` + `refs/<slug>.md` — índice resume e aponta, dossiê guarda o detalhe (nunca duplicar entre os dois). A **radar** é dona do formato e cria o índice quando não existe; a linha leva `id <numérico ou —>` logo após o slug (é de lá que a seleção copia o id); a **garimpo** escreve só o campo `catálogo AAAA-MM-DD` da linha ao fim de cada coleta, e só para empresa com `status: ok`. A seção `## Do Not Copy` do dossiê é perguntada pela **garimpo** ao fim do catálogo e lida pela **profills-post** (vazio = nunca perguntado → a post pergunta).
- `DADOS/catalog/raw/<slug>/<AAAA-MM-DD>/posts.json` + `meta.json` — o dado estruturado primário e o contexto da página (seguidores = denominador da taxa de engajamento normalizada; `status` ∈ `ok|sem_posts|pagina_nao_gerenciada|erro_navegacao` — `STATUS.txt` está aposentado). Schema v2 (2026-08) em `profills-garimpo/references/schema-post.md`. Perfil, summary e dashboard nascem dele.
- `DADOS/catalog/<slug>.md` (template `perfil-template.md`) — o perfil por empresa; é isto (+ o `posts.json` bruto) que a **profills-post** consome. `_summary.md` é o comparativo para o humano/dashboard — a profills-post não o lê.
- `DADOS/voz.md` — a voz do usuário, criada e mantida pela skill **profills-voz** (template em `profills-voz/assets/voz-template.md`). **Ainda não existe** até a primeira run; a profills-post invoca a skill quando não o encontra. As seções `Palavras banidas` e `Isso não sou eu` são checadas pelo quality gate da profills-post; `Dores do ICP` alimenta o teste analgésico/vitamina.
- `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>.md` — saída persistida da profills-post: o texto final aprovado, pronto para colar.

**Quem invoca quem** (fonte única — a description de uma skill só cita invocação que existe aqui):

| Skill | Invoca | Quando |
|---|---|---|
| profills-garimpo | profills-radar | `selection.md` ausente ou vazio |
| profills-garimpo | profills-navegador | antes da primeira empresa |
| profills-post | profills-voz | `voz.md` ausente |
| profills-post | humanize-pt-br | passo de humanização |
| radar, garimpo, post, voz | profills-setup | `DADOS` não existe |

Ninguém mais invoca ninguém: a garimpo segue neutra sem `voz.md`; radar e post não navegam. Skill invocada por outra devolve o controle sem sugestão própria; chamada pelo usuário termina com **uma** sugestão.

## Invariantes que atravessam arquivos

- **Pasta de dados (`DADOS`)** — dona: `profills-setup/SKILL.md`; as outras 4 skills carregam a cópia **literal** (o plugin roda onde este arquivo não existe) e a igualdade se confere com `grep -h "^\*\*Pasta de dados" skills/*/SKILL.md | sort -u | wc -l` (tem de dar 1, e `grep -l` tem de listar radar, garimpo, post e voz): se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.
- **Taxonomias fechadas** (`profills-garimpo/references/taxonomias.md`) — valores fixos para formato/hook/ângulo/gatilho, compartilhados por schema, perfis, dashboard e moldes da profills-post. Mudar um valor quebra a comparabilidade com todos os `posts.json` históricos; se precisar, migrar o histórico junto.
- **Não propor scraper/API/Firecrawl como "melhoria"** da coleta. O navegador real logado é decisão fundamentada (`profills-garimpo/references/compliance.md` + `research/`), não limitação técnica.
- **Fatos de navegação validados ao vivo** (filtro por `data-urn`, ordenação Populares→Recentes, parser de data relativa) vivem só em `profills-garimpo/references/navegacao.md`. Quando a UI do LinkedIn mudar, atualizar **lá** — não rederivar nem criar segunda cópia.

## Dependências externas ao repo

- `humanize-pt-br` — skill global do usuário, publicada em [othavi0/skills](https://github.com/othavi0/skills) (`skills/writing/humanize-pt-br`); instalada e mantida pela **profills-setup**, encadeada pela profills-post no passo de humanização.
- `artifact-design` — skill do harness, exigida antes de publicar dashboard (garimpo) e comparador (post) via tool Artifact. `dataviz` — só o dashboard da garimpo (tem gráficos); o comparador da profills-post não usa.
- Moldes, taxonomias, benchmark e quality gate são adaptados (traduzidos) de [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT) — manter a atribuição ao importar mais material de lá.

## Convenções

- Tudo em pt-BR — SKILL.md, references, dados, commits.
- Cada skill tem `evals/evals.json` (3 casos prompt → expected_output). Mudança de comportamento numa skill atualiza os evals dela.
- O template `profills-post/assets/preview-template.html` é motor testado: preencher só o bloco `DADOS` (instruções no topo do próprio arquivo), nunca reescrever o HTML.

## Estado do repo (2026-08-21) e pegadinhas

- **2026-08-21**: repo virou plugin instalável (`.claude-plugin/plugin.json` + `marketplace.json`, source `./`); `.agents/skills/` migrou para `skills/` (fonte canônica) e `.agents/` foi removido do repo — setup é só Claude Code. Nasceu a skill `profills-setup` (instala/confere/atualiza o plugin, instala a `humanize-pt-br`, cria e confere `DADOS`). A pasta de dados fora do repo passou a ser `~/Profills LinkedIn/` (dentro do repo continua `linkedin-data/`) via a regra `DADOS` acima. **Não instalar o plugin dentro deste repo** — os symlinks de `.claude/skills/` já servem as skills localmente; instalar por cima duplicaria tudo.
- Git: histórico de 6 commits (inicial, pipeline completo, renomeio para `profills-*`, skill `profills-navegador` — os dois últimos via PR mergeado), árvore sincronizada com `profillsbrasil/profills-skills`. O `.gitignore` da raiz ignora só runtime do harness (`.claude/scheduled_tasks.lock`, `settings.local.json`) — os symlinks de `.claude/skills/*` **são** versionados. O de `linkedin-data/` ignora screenshots/imagens brutas e `selection.md` (efêmero), versionando `refs/`, `catalog/*.md`, `catalog/raw/**/*.json`, `drafts/` e `voz.md`.
- Schema reconciliado em 2026-08 (**v2**): `schema-post.md` agora bate com os `posts.json` reais (`hashtags`, `link_externo`, `destaque_semana`…; `outlier` só em janela ampliada). As coletas de **2026-07-14** só têm `meta.json` nas duas empresas sem posts (migrados do `STATUS.txt` em 2026-08-24, com `status`/`nota`; seguidores só na tecnox) — as quatro com posts não têm — taxa de engajamento normalizada só existe de agosto em diante.
- **"Scan rápido" vs "modo profundo" foi aposentado em 2026-08** — o conceito nunca teve definição e duplicava a distinção real, **janela padrão (semanal) vs. ampliada** (formalizada no schema v2: `destaque_semana` vs `outlier`). Não reintroduzir os termos antigos.
- Smoke test de 2026-07-14 gerou `_summary.md` e os `raw/`, mas **os perfis por empresa (`catalog/<slug>.md`) nunca foram gerados** — o passo 5 da profills-garimpo ainda não tem instância real.
- **`## Do Not Copy` está vazio (placeholder) em todos os 6 dossiês** — nunca foi perguntado. Desde 2026-08-24 a garimpo pergunta ao fim do catálogo e a post pergunta quando encontra vazio; os 6 dossiês só se preenchem na próxima coleta.
- **2026-08-24**: auditoria das 6 skills (writing-for-agents + doc oficial + pesquisa da comunidade) e refatoração: descriptions só com gatilhos (~300 chars), tabela "quem invoca quem" acima como fonte única, `id` na seleção, `status` no `meta.json`, fontes únicas para parser de data (`navegacao.md`), taxonomias (`taxonomias.md`, slugs) e taxa de engajamento (`benchmark-mercado.md`). Frontmatter fica só com `name/description/metadata` (padrão aberto agentskills.io — `metadata` é campo oficial, não lixo).
