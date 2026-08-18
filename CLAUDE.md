# profills-skills — pipeline de conteúdo LinkedIn

Cinco skills project-level: o pipeline `profills-radar` → `profills-garimpo` → `profills-post` (catalogar o que empresas de referência postam e transformar em rascunhos pt-BR) + `profills-voz` (cria e mantém o arquivo de voz do usuário que a profills-post consome) + `profills-navegador` (transversal: garante o navegador certo e pronto via claude-in-chrome — o usuário tem a extensão em várias máquinas — e conduz a instalação onde falta; a garimpo a invoca antes de navegar, e o cache dela vive fora do repo, em `~/.config/profills-navegador/browser`). O usuário final é o **comercial, não dev** — "conduza pela mão" é princípio de produto de todas elas, não floreio.

Os princípios operacionais de cada skill (medido vs inferido, inspirar-não-copiar, pastas por data, compliance) vivem nos próprios `SKILL.md` e references — este arquivo não os repete; ele guarda o que atravessa arquivos e o que nenhum arquivo isolado conta.

**Renomeio de 2026-08-18**: as skills chamavam `linkedin-refs`, `linkedin-catalog`, `linkedin-draft` e `product-marketing` (nesta ordem de correspondência). Os documentos de `research/` mantêm os nomes antigos de propósito — são registro histórico, não retroeditar.

## Mapa

| Caminho | O que é |
|---|---|
| `.agents/skills/<nome>/` | Fonte canônica das skills (`SKILL.md` + `references/` + `assets/` + `evals/`). `.claude/skills/*` são **symlinks** para cá — editar sempre em `.agents/`. |
| `linkedin-data/` | Camada de dados que as skills produzem em runtime — é o dado vivo do usuário, não fixture de exemplo. O nome segue em inglês de propósito: descreve o dado (posts do LinkedIn), não uma skill, e renomeá-lo quebraria os contratos de path das 4 skills + o histórico. |
| `research/linkedin-skills-achados.md` | Pesquisa que fundou o projeto (jul/2026): fatos testados sobre o LinkedIn, ToS, por que não usar scraper/API. **Está truncado no meio da última seção** — não procurar ali uma conclusão que não existe. |
| `README.md` | Só o título, sem conteúdo. A orientação do repo é este CLAUDE.md. |

As skills localizam a raiz do repo com `git rev-parse --show-toplevel` — os paths de `linkedin-data/` são relativos a ela.

## O pipeline e seus contratos (handoff por arquivo)

`profills-radar` → `profills-garimpo` → `profills-post`. As skills não se chamam por API — **acoplam-se por arquivos**. Mudar nome/formato de um destes quebra a skill seguinte:

- `linkedin-data/selection.md` — radar → garimpo. Efêmero (gitignored), sobrescrito a cada run. Garimpo sem seleção invoca a radar, nunca pede lista direto ao usuário.
- `linkedin-data/refs/INDEX.md` + `refs/<slug>.md` — índice resume e aponta, dossiê guarda o detalhe (nunca duplicar entre os dois). A seção `## Do Not Copy` do dossiê é lida pela **profills-post**.
- `linkedin-data/catalog/raw/<slug>/<AAAA-MM-DD>/posts.json` + `meta.json` — o dado estruturado primário e o contexto da página (seguidores = denominador da taxa de engajamento normalizada). Schema v2 (2026-08) em `profills-garimpo/references/schema-post.md`. Perfil, summary e dashboard nascem dele.
- `linkedin-data/catalog/<slug>.md` (template `perfil-template.md`) — o perfil por empresa; é isto (+ o `posts.json` bruto) que a **profills-post** consome. `_summary.md` é o comparativo para o humano/dashboard — a profills-post não o lê.
- `.agents/voz.md` — a voz do usuário, criada e mantida pela skill **profills-voz** (template em `profills-voz/assets/voz-template.md`). **Ainda não existe** até a primeira run; a profills-post invoca a skill quando não o encontra. As seções `Palavras banidas` e `Isso não sou eu` são checadas pelo quality gate da profills-post; `Dores do ICP` alimenta o teste analgésico/vitamina.
- `linkedin-data/drafts/<AAAA-MM-DD>-<tema-slug>.md` — saída persistida da profills-post: o texto final aprovado, pronto para colar.

## Invariantes que atravessam arquivos

- **Taxonomias fechadas** (`profills-garimpo/references/taxonomias.md`) — valores fixos para formato/hook/ângulo/gatilho, compartilhados por schema, perfis, dashboard e moldes da profills-post. Mudar um valor quebra a comparabilidade com todos os `posts.json` históricos; se precisar, migrar o histórico junto.
- **Não propor scraper/API/Firecrawl como "melhoria"** da coleta. O navegador real logado é decisão fundamentada (`profills-garimpo/references/compliance.md` + `research/`), não limitação técnica.
- **Fatos de navegação validados ao vivo** (filtro por `data-urn`, ordenação Populares→Recentes, parser de data relativa) vivem só em `profills-garimpo/references/navegacao.md`. Quando a UI do LinkedIn mudar, atualizar **lá** — não rederivar nem criar segunda cópia.

## Dependências externas ao repo

- `humanize-pt-br` — skill global do usuário (`~/.agents/skills/`), encadeada pela profills-post no passo de humanização.
- `artifact-design` — skill do harness, exigida antes de publicar dashboard (garimpo) e comparador (post) via tool Artifact. `dataviz` — só o dashboard da garimpo (tem gráficos); o comparador da profills-post não usa.
- Moldes, taxonomias, benchmark e quality gate são adaptados (traduzidos) de [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills) (MIT) — manter a atribuição ao importar mais material de lá.

## Convenções

- Tudo em pt-BR — SKILL.md, references, dados, commits.
- Cada skill tem `evals/evals.json` (3 casos prompt → expected_output). Mudança de comportamento numa skill atualiza os evals dela.
- O template `profills-post/assets/preview-template.html` é motor testado: preencher só o bloco `DADOS` (instruções no topo do próprio arquivo), nunca reescrever o HTML.

## Estado do repo (2026-08-18) e pegadinhas

- Git: 2 commits (README inicial + `feat: pipeline de skills LinkedIn completo`), árvore sincronizada com `profillsbrasil/profills-skills`. O `.gitignore` da raiz ignora só runtime do harness (`.claude/scheduled_tasks.lock`, `settings.local.json`); o de `linkedin-data/` ignora screenshots e `selection.md`, versionando `refs/`, `catalog/*.md` e `raw/**/*.json`.
- Schema reconciliado em 2026-08 (**v2**): `schema-post.md` agora bate com os `posts.json` reais (`hashtags`, `link_externo`, `destaque_semana`…; `outlier` só em janela ampliada). As coletas de **2026-07-14 não têm `meta.json`** — taxa de engajamento normalizada só existe de agosto em diante.
- **"Scan rápido" vs "modo profundo" foi aposentado em 2026-08** — o conceito nunca teve definição e duplicava a distinção real, **janela padrão (semanal) vs. ampliada** (formalizada no schema v2: `destaque_semana` vs `outlier`). Não reintroduzir os termos antigos.
- Smoke test de 2026-07-14 gerou `_summary.md` e os `raw/`, mas **os perfis por empresa (`catalog/<slug>.md`) nunca foram gerados** — o passo 5 da profills-garimpo ainda não tem instância real.
- **`## Do Not Copy` está vazio (placeholder) em todos os 6 dossiês.** A profills-post depende dessa seção; silêncio ali hoje significa "nunca perguntado ao usuário", não "nada a evitar".
