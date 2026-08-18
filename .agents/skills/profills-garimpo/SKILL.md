---
name: profills-garimpo
description: >-
  Cataloga o que empresas andam postando no LinkedIn — abre os posts de cada
  empresa no seu navegador logado, extrai tema, cadência, formato, hooks e
  engajamento, e gera um dashboard visual comparando todas. Use quando o usuário
  passar uma lista de empresas e quiser "ver o que elas postam", "analisar os
  posts de X", "monitorar concorrentes no LinkedIn", ou "entender a estratégia de
  conteúdo de Y". Alimenta a skill profills-post, que transforma o catálogo em
  rascunhos de post. Para escolher/gerenciar quais empresas, veja profills-radar.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-garimpo

Você produz o **catálogo**: o retrato do que cada empresa anda postando no LinkedIn — temas, cadência, formatos, hooks e o que engajou — para servir de matéria-prima aos posts do próprio usuário. A coleta roda no navegador real logado dele; o resultado é dado estruturado em disco + um dashboard visual.

## Medido vs inferido

O princípio que rege todo o catálogo: **separe o que foi medido do que foi inferido.** Data, texto, formato e engajamento (likes/comentários) são fatos lidos da página. Tema, tom, ângulo e "hook forte" são leituras suas. Rotular os dois no relatório evita que o usuário — ou a `profills-post` — trate um palpite de tom como se fosse dado. Um outlier de engajamento é fato; *por que* ele engajou é hipótese.

## Fluxo

### 1. Resolva a seleção

Leia `linkedin-data/selection.md` (na raiz do repo; se não achar, `git rev-parse --show-toplevel`). Se não existir ou estiver vazio, **invoque a `profills-radar` primeiro** — ela decide quais empresas catalogar. Não peça a lista direto ao usuário; esse é o trabalho da `profills-radar`.

### 2. Carregue o contexto do usuário

Se existir `.agents/voz.md` (ou `.claude/voz.md`), leia antes — o produto e o público dele definem o que é relevante nos posts das empresas. Sem esse arquivo, siga assim mesmo, catalogando de forma neutra.

### 3. Alvo da coleta — recente e enxuto

O objetivo é ficar **atualizado** para escrever um post oportuno, não auditar histórico. Por padrão, pegue os posts da **última semana (7 dias), no máximo 5 por empresa** — os mais recentes primeiro. Nunca mais que 5: a skill alimenta a escrita de um post atual, e histórico demais só dilui o que está fresco.

Se uma empresa não postou nada na semana, registre isso (silêncio também é sinal) e siga. Só amplie a janela se o usuário pedir explicitamente uma leitura de tendência mais funda — o padrão é leve e recente.

### 4. Colete — uma empresa por vez

Processe **uma empresa de cada vez** e salve o bruto em disco antes de passar à próxima. Screenshots enchem o contexto rápido; terminar uma empresa e liberar o material antes da próxima mantém a sessão viável numa lista grande.

Antes da primeira empresa, **invoque a skill `profills-navegador`**: é ela quem garante o navegador certo (o usuário tem a extensão em várias máquinas) e trata máquina sem extensão — a coleta só começa com o handoff dela (navegador selecionado + tab pronta). Daí em diante, para cada empresa, siga `references/navegacao.md` (como dirigir o `claude-in-chrome`, rolar o feed, e lidar com authwall/erros). Por post, extraia os campos de `references/schema-post.md`, classificando com as taxonomias fechadas de `references/taxonomias.md`. Salve:

```
linkedin-data/catalog/raw/<slug>/<AAAA-MM-DD>/
├── posts.json        # array de posts (dado estruturado — o artefato primário)
├── meta.json         # contexto da página: seguidores, janela, nº de posts
└── screenshots/      # um PNG por post com mídia
```

**Nunca sobrescreva a pasta de uma data anterior.** Cada execução cria a pasta do dia — é isso que permite comparar cadência semana a semana.

### 5. Sintetize o perfil

De `posts.json`, gere `linkedin-data/catalog/<slug>.md` seguindo `assets/perfil-template.md`. O relatório em prosa nasce **do JSON**, não o contrário — assim a `profills-post` lê o dado estruturado direto, sem interpretar prosa.

Com a amostra da semana (≤5 posts), o foco é **o que está fresco**, não estatística: capture por post o tema, o hook, o formato e o engajamento, e aponte qual post **puxou mais engajamento na semana** (o maior, simples — não outlier estatístico) e sobre o quê. Não force cadência (posts/semana vira o próprio número coletado) nem desvio-padrão numa amostra tão pequena.

Todo tema ou padrão citado carrega seu recibo: qual post, qual data. Afirmação sem post que a sustente não entra.

### 6. Compare e feche

Depois de todas as empresas, gere `linkedin-data/catalog/_summary.md`: tabela comparativa (cadência, formato dominante, **taxa de engajamento** por empresa) + o eixo de mercado de `references/benchmark-mercado.md` — "esta empresa posta 1×/semana vs. o padrão B2B de 3-5×". Entre empresas, compare pela taxa normalizada (engajamento ÷ seguidores, do `meta.json`), nunca por likes brutos — audiências diferentes não se comparam em bruto. Dois eixos: contra ela mesma (destaque/outliers) e contra o mercado.

Se estiver re-catalogando uma empresa já vista, não recomece: compare com o relatório anterior e anexe um `## Change Log` (cadência subiu/caiu, novo formato dominante, engajamento médio mudou).

### 7. Monte o dashboard visual

Renderize o catálogo como um artefato visual seguindo `references/dashboard.md`. O dado estruturado fica em disco para rastreabilidade; o dashboard é a camada visual para o humano digerir cadência, formatos, hooks e outliers de relance.

## Conduza pela mão

Não termine largando o dashboard e sumindo. Depois de catalogar, **guie**: aponte de relance o que mais chama atenção (quem lidera, o formato que engaja, o espaço aberto), e ofereça o próximo passo — gerar um rascunho com a `profills-post` a partir de um ângulo que você recomenda, com o porquê. A skill entrega o retrato *e* mostra o que fazer com ele.

## Compliance

A coleta dirige a conta real do usuário num site cujos termos proíbem automação. Trate `references/compliance.md` como parte do fluxo, não nota de rodapé: ritmo humano, sem burlar login-wall, registrar fonte+data de cada post, e **nunca publicar nem interagir** — só ler. O usuário posta; você cataloga.
