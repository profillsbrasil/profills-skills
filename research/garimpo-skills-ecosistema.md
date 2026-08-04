# Garimpo do ecossistema de skills — melhorias para o pipeline LinkedIn

> Gerado em 2026-08-04. Método: 6 buscas no skills.sh (`npx skills find`) + 8 agentes lendo o
> conteúdo real (SKILL.md + references) de cada repo candidato no GitHub, julgando cada ideia
> contra o que as skills locais já cobrem. Ideias já cobertas pelo repo local foram descartadas.

## Veredito por repo

| Repo | Reputação | Veredito |
|---|---|---|
| **samber/cc-skills** | 178★, Samuel Berthe (autor de samber/lo), CI + evals por skill | **A melhor fonte.** Rigoroso, fontes nomeadas (Ogilvy, NN/g, A/B tests com número). Minerar linkedin-ghostwriting, copywriting-cta, substack-ghostwriting/voice-matching. |
| **coreyhaines31/marketingskills** (`social` + `content-strategy`) | 43k★, já é a base dos moldes locais | As duas skills ainda não mineradas tinham ouro: carrosséis slide-a-slide, taxonomia de CTA, social listening, "write from emotion". |
| **kostja94/marketing-skills** | 848★, ligado a alignify.co | Cheat-sheet de referência: bom para tabelas pontuais (specs de imagem, números de engajamento). Sem workflow — arquitetura local já é superior. |
| **jamesgray007/hoai-course** | 20★, material de curso | Pequeno mas substantivo: "Hooks to Retire", Vulnerability Test, template de brand. Sem lastro em dado — garimpar, não adotar em bloco. |
| **refoundai/lenny-skills** | 1,2k★, citações verificadas de episódios | Bom, mas a skill content-marketing foi REMOVIDA no rebuild 2.0 do próprio repo (o install count é histórico). Escopo mais largo que o nosso; 4 ideias transferem. |
| **langchain-ai/deepagents** | 27k★, mas a skill é fixture de demo | 2-3 ideias aproveitáveis (imagem-companheira, pasta de saída); o resto o local já cobre melhor. |
| **alirezarezvani/claude-skills** | 24k★ com cara de SEO-farm (330+ skills duplicadas em 8 pastas) | Não é slop puro, mas tem inconsistência interna real (benchmark 0,54% vs 2,0% no mesmo skill). Ideias de normalização de engajamento valem; **verificar qualquer número independentemente antes de adotar**. |
| **claude-office-skills/skills** (`linkedin-automation`) | 355★, 4,1k installs | **Slop confirmado.** Declara MCP server que não existe no repo, templates com placeholder, e prescreve automação de conexão/DM/post — exatamente o que nossa compliance proíbe. Nada a importar. |

## Ideias por alvo (já filtradas: só o que o local NÃO cobre)

### 1. `product-marketing.md` — a maior alavanca

O arquivo de voz do usuário ainda não existe, e o garimpo trouxe uma receita completa para criá-lo bem (fontes: samber/substack-ghostwriting + tone-of-voice-creator, hoai/applying-brand-guidelines, corey/content-strategy):

- **Extração de voz ranqueada por qualidade de sinal**: transcrição de call/conversa > post social bruto > mensagem casual (WhatsApp) > texto editado. "Começar de transcript, não de nota — nota escrita filtra os marcadores de voz." Muito mais forte que pedir ao usuário para descrever a própria voz em abstrato. *(Aplicado com inversão consciente das posições 2-3: mensagem de WhatsApp acima de post antigo — post público já é performance; mensagem no calor é espontânea.)*
- **Voice markers concretos**: vocabulário-padrão vs. palavras banidas, comprimento de frase, ritmo, domínio de metáfora, como abre/fecha texto + seção "isso não soa como eu" (o anti-voz do próprio usuário — o simétrico do Do Not Copy das referências).
- **Lista de palavras banidas** checada pelo quality gate em todo rascunho ("prevenção é mais barata que prescrição").
- **Traço falseável "X mas nunca Y"** (ex. "confiante, nunca arrogante") em vez de adjetivo solto.
- **Quiz de tom em 4 eixos** (NN/g: engraçado↔sério, formal↔casual, respeitoso↔irreverente, entusiasmado↔direto), com aviso de que tudo-no-meio = voz sem graça.
- **Tom por contexto** (comemorar / problema / ensinar / thought-leadership pedem tons diferentes) + pilares de mensagem.
- **Minerar conversas do próprio negócio** (calls de venda, CS, suporte) para Customer Language e Proof Points — hoje o pipeline só mina posts dos OUTROS.

### 2. `linkedin-draft`

**Mecânico / risco real:**
- **Unicode bold**: LinkedIn não renderiza markdown — negrito tem que ser caractere unicode matemático (𝗮𝘀𝘀𝗶𝗺), senão `**asteriscos**` saem literais no feed. Nada no repo previne isso hoje. (samber)
- **Specs de imagem**: 1200×627 (1.91:1) / 1200×1200; carrossel orgânico até 20 imagens; documento ~100MB/~300 págs; vertical preferido (88% mobile). Hoje a foto é só slot conceitual. (kostja)
- **Pasta de saída do rascunho aprovado** (ex. `linkedin-data/drafts/<slug>/`): hoje o fluxo termina no Artifact sem persistir o texto final em disco. (deepagents)

**Estrutura de geração:**
- **Entrevista de 4 elementos antes de escrever** (checklist-gate: ≥1 métrica quantificada + 1 insight contra-intuitivo + 1 mecanismo em 2-3 passos + 1 CTA definido) — "sem isso, mesmo escrita habilidosa produz post genérico". (samber)
- **Diversificação de HOOK além de ângulo**: as 3-5 variações devem puxar mecanismos de hook genuinamente diferentes (≥1 intelectual, 1 sensorial, 1 direto-ao-leitor) — "três sabores de contrarian não é escolha real". Hoje só a diversidade de ângulo é exigida. (samber)
- **Regra 80/20 do hook** (revela 80% do valor, esconde 20% — o "como") como critério testável. (samber)
- **ABT (AND→BUT→THEREFORE)** como microestrutura do corpo, dentro de qualquer template. (samber)
- **"Write from emotion" + ritmo "Short. Breathe. Land."** como instrução de composição do molde História (antes de escrever, não no polimento do humanize). (corey/social)
- **Carrossel com profundidade**: tabela slide-a-slide por framework, failure mode nomeado por framework, e a nota LinkedIn (subir como PDF; o texto do post acima do documento é um SEGUNDO hook, não "segue anexo"). (corey/social)

**Quality gate:**
- **Taxonomia de CTA** (Question / Agreement / Share / Save, com padrão de frase) + **anti-padrão de verbo genérico** ("Saiba mais" → "Leia o passo a passo completo"). Hoje não há checagem de CTA. (corey + samber)
- **"Hooks to Retire"**: blocklist de ganchos clichê com motivo + alternativa. (hoai)
- **Painkiller vs. vitamin**: rótulo binário por rascunho; vitamin-only volta para revisão. (lenny) *(Aplicado no nível do conjunto, não do rascunho: como a skill sempre oferece 3-5 opções, reprovar cada vitamina isolada eliminaria a opção leve legítima — o crivo é "pelo menos uma opção precisa doer".)*
- **Content-market fit**: nomear a dor/ansiedade do leitor-ICP que o post resolve ANTES de escolher ângulo — complementa o sinal externo do catálogo com o sinal do ICP. (lenny)
- **Vulnerability Test** (4 perguntas) quando o ângulo é pessoal/fracasso. (hoai)
- **Anti-padrão engagement-bait** ("comente SIM para receber") — o algoritmo pune. (kostja)
- **Validação de voz com pergunta específica** ("você usaria essa palavra?"), nunca "ficou bom?". (samber/substack)
- **Meta de legibilidade** (nível 4ª-5ª série) como critério objetivo no passo Shine. (lenny)
- Menor: melhores horários (já cobertos pelo benchmark-mercado.md pré-existente) e poll como 5º molde *(aplicado)*. Hashtags 3-5 é conselho recorrente mas **contestado** — a Maqinox (sem hashtags) foi elogiada no nosso próprio catálogo; não adotar cegamente *(decisão: não aplicado)*.

### 3. `linkedin-catalog`

- **Taxa de engajamento normalizada por seguidores** (likes+comentários+reposts ÷ seguidores ×100) + capturar follower count no schema. Corrige uma falha real visível no catálogo de julho: comparar 13 likes da Skymsen com 2 da Maqinox (1,9k seguidores) em bruto é enganoso. Benchmark de referência: ~2% média / 3-5% bom / >5% excelente — **verificar números independentemente** (a fonte tem inconsistência interna). (alirezarezvani)
- **Benchmark por vertical** (LinkedIn: 1,8% B2B services a 3,2% finance) em vez de "B2B" monolítico. (alirezarezvani, mesma ressalva)
- **Check de mix promocional** no dashboard: sinalizar quando a fatia de posts de pitch/produto passa de ~10-20% da janela. (alirezarezvani)
- **Regra anti-vanity-metric** no dashboard (seguidores brutos, impressões sem engajamento). (alirezarezvani)
- Números citáveis para o benchmark local: ~35% de queda >2.000 chars; 60-80% decidem no primeiro trecho. (kostja)
- Valores de taxonomia `newsletter` e `evento` (baixa prioridade). (kostja) *(Aplicado — adição de valor novo não quebra comparabilidade com dados antigos.)*

### 4. Escopo novo (skills futuras, não fix nas atuais)

- **`linkedin-engage`**: a janela pós-publicação (responder comentários na 1ª hora) + social listening com rubrica de pontuação (ICP fit ×2, intent ×2, comment opportunity ×2…) para um top-10 diário de posts de terceiros onde vale comentar — com 3 tiers de qualidade de comentário. Compatível com a compliance local se a IA só sugere e o usuário posta. (hoai + corey/listening)
- **Camada de estratégia**: pilares de conteúdo (product/audience/search/competitor-led) + rubrica ponderada para escolher ENTRE temas candidatos (Customer Impact 40%, Content-Market Fit 30%…). Hoje o usuário sempre chega com o tema pronto. (corey/content-strategy)

## Não importar

- `claude-office-skills/skills@linkedin-automation` — dependência MCP fictícia + prescreve automação que viola o ToS (e a nossa compliance).
- Pacote completo do `copywriting-tone-of-voice-creator` (samber) — infraestrutura de marca corporativa (80+ perguntas, arquétipos de Jung); over-engineering para o perfil "comercial não-dev". Só as peças pequenas listadas acima.
- `copywriting-hooks` (samber) é para artigo longo/blog, não feed — transferir por analogia, não plug-and-play.
