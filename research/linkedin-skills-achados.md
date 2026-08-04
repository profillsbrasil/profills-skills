# Pesquisa consolidada — skills de LinkedIn (catalogar empresas + gerar posts)

> Gerado em 2026-07-14. Fontes: teste empírico ao vivo (agent-browser deslogado), 6 agentes de
> pesquisa web, catálogo de 10 skills do skills.sh, leitura integral do repo
> `coreyhaines31/marketingskills` (47 skills + tools/, 13 agentes). Clone local do repo em
> scratchpad da sessão; re-clonar se precisar: `git clone --depth 1 https://github.com/coreyhaines31/marketingskills`.

## Objetivo

Duas skills novas (decidido em grill):

- **Skill A `linkedin-catalog`** — recebe lista de empresas → dirige o Brave real logado
  (claude-in-chrome) → navega `/company/<slug>/posts/` → coleta janela ~60 dias OU ~40 posts
  (o que vier primeiro, parâmetros ajustáveis) → emite dado estruturado + `report.md`.
- **Skill B `linkedin-draft`** — consome o report + perfil de voz → gera rascunhos pt-BR →
  encadeia `humanize-pt-br`.

## Fatos duros sobre o LinkedIn (jul/2026, testados)

| Alvo | Deslogado | Nota |
|---|---|---|
| `/company/<slug>/` (raiz) | ✅ ~10 posts (SSR p/ crawler) | pode virar authwall em browser real; não confiar sem validar |
| `/company/<slug>/posts/` | ❌ authwall total | redirect servidor antes de render (testado Anthropic/Nubank) |
| `/search/results/content/` | ❌ login-wall (`/uas/login`) | filtros via URL (fromOrganization etc.) são reverse-engineered, não oficiais |
| permalink `/posts/…activity-<id>` | ✅ texto sem métricas | exige já ter a URL |

- Paginação da aba `/posts/` logada = **scroll infinito client-side** (sem param de URL). Feed de
  page é limitado a ~1 ano ou ~500 posts.
- Slug: descobrir via busca de empresas; pode mudar (rebranding) — cachear também o ID numérico.
- `?feedView=all` existe mas semântica não confirmada — **validar ao vivo logado antes de hardcodar**.
- **Nenhuma API oficial serve**: Community Management API só lê posts de páginas onde o usuário é
  admin. Proxycurl morreu (processo do LinkedIn, 2025). Apify/Bright Data raspam só a versão
  pública (~10-30 posts) por centavos — alternativa sem tocar a conta, se um dia precisar.
- **ToS**: Seção 8.2 proíbe qualquer automação (inclusive leitura). hiQ não protege uso logado
  (cobre só dado público sem login; a própria hiQ perdeu no contrato). Risco = conta
  (checkpoint → restrição 24h-7d → ban), não criminal. Navegação passiva de baixo volume tem
  pouquíssimos relatos de punição, mas não há número oficial "seguro" — todos os limites citados
  (~80-100 views/24h etc.) são folclore de vendors.
- **Mitigação**: browser real do usuário (sem `navigator.webdriver`/headless UA), volume em dezenas
  não centenas de páginas/dia, delays aleatórios, horário humano, fingerprint estável, orçamento
  configurável exposto na skill (nunca prometer número "seguro").

## Ferramentas de browser (papéis)

- **claude-in-chrome** — Brave real logado; mouse/scroll humano; ~1.5k tok/página; tab group
  isolado por sessão; `read_page`/`get_page_text`/`find`/`browser_batch`. → **coleta da Skill A**.
- **agent-browser** — CLI CDP headless; ~300 tok/página; sessões paralelas; auth via
  `--state`/profile; detect