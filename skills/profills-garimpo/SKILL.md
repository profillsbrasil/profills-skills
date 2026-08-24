---
name: profills-garimpo
description: >-
  Cataloga os posts recentes de empresas no LinkedIn pelo navegador
  logado e gera perfil por empresa, comparativo e dashboard. Use para
  "o que as empresas andam postando", "analisa os posts da X", "monitorar
  concorrentes", "leitura de tendência" (janela ampliada) ou re-catalogar.
  Não use para escolher a lista (profills-radar) nem escrever posts
  (profills-post).
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-garimpo

## Medido vs inferido

O princípio que rege todo o catálogo: **separe o que foi medido do que foi inferido.** Data, texto, formato e engajamento (likes/comentários) são fatos lidos da página. Tema, tom, ângulo e "hook forte" são leituras suas. Rotular os dois deixa o usuário — e a `profills-post` — sabendo o que é dado e o que é palpite. Um pico de engajamento é fato; *por que* ele engajou é hipótese.

## Fluxo

### 0. Localize a pasta de dados

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

Concluído quando você tem o caminho de `DADOS` e ele existe em disco.

### 1. Resolva a seleção

Leia `DADOS/selection.md`. Cada linha traz o nome, o slug entre crases e o id numérico da empresa:

```markdown
- [Nome da Empresa](refs/<slug>.md) — `<slug>` · id <id numérico ou —> · <setor> · <país>
```

O **slug é a chave de todos os paths** que você escreve (`catalog/raw/<slug>/…`, `catalog/<slug>.md`, `refs/<slug>.md`); o id é o plano B quando o slug falha na navegação (`references/navegacao.md`).

Arquivo ausente ou vazio → **invoque a `profills-radar`**: é ela que decide as empresas, segura a lista em 5 e escreve a seleção.

Concluído quando você tem nome, slug e id de cada empresa da rodada.

### 2. Carregue o contexto do usuário

Se existir `DADOS/voz.md`, leia antes — o produto e o público dele definem o que é relevante nos posts das empresas. Sem esse arquivo, catalogue de forma neutra e siga; esta skill não para para montar a voz.

Concluído quando você sabe o que o usuário vende, ou registrou que está catalogando neutro.

### 3. Fixe a janela

Quem escolhe a janela é o **pedido do usuário**, nunca a contagem de posts que aparecer depois:

- **Padrão (o default)** — últimos **7 dias, no máximo 5 posts por empresa**, os mais recentes primeiro. É o alvo para escrever um post oportuno; histórico demais dilui o que está fresco.
- **Ampliada** — só quando ele pede leitura de tendência ("como a X evoluiu nos últimos meses"). Escolha a janela em dias com ele (90 é um bom padrão), suba o teto de posts e avise que a navegação fica mais longa.

A janela vai em `janela_dias` no `meta.json` e decide o campo computado da síntese: `destaque_semana` na padrão, `outlier` na ampliada (`references/schema-post.md`).

Concluído quando `janela_dias` e o teto de posts por empresa estão escritos para esta rodada.

### 4. Avise, e só então abra o navegador

O usuário está emprestando a conta real dele. Antes da primeira empresa, explique em uma frase e confirme com `AskUserQuestion`: "vou abrir o LinkedIn no seu navegador e ler as páginas das empresas devagar, como se você estivesse rolando o feed — nada é curtido, comentado nem publicado. Posso ir?". Ofereça as saídas junto: seguir agora, seguir com menos empresas, deixar para depois.

Com o "pode ir", **invoque a skill `profills-navegador`**: é ela que garante o navegador certo (o usuário tem a extensão em várias máquinas) e trata máquina sem extensão. A coleta começa no handoff dela — navegador selecionado + tab pronta, com as tools já carregadas.

Concluído quando o usuário confirmou e você tem o id da tab entregue pelo handoff.

### 5. Colete — uma empresa por vez

Processe **uma empresa de cada vez** e salve o bruto em disco antes de passar à próxima. Screenshots enchem o contexto rápido; terminar uma empresa e liberar o material antes da próxima mantém a sessão viável numa lista grande.

Para cada empresa, siga `references/navegacao.md` (como dirigir o `claude-in-chrome`, ordenar por Recentes, rolar o feed, authwall e erros) e salve:

```
DADOS/catalog/raw/<slug>/<AAAA-MM-DD>/
├── posts.json        # array de posts (dado estruturado — o artefato primário)
├── meta.json         # seguidores, janela, nº de posts e o status da coleta
└── screenshots/      # um PNG por post com mídia
```

Cada execução cria a pasta do dia; pasta de data anterior fica intacta — é isso que permite comparar cadência semana a semana. Segunda rodada no mesmo dia sobrescreve só a pasta de hoje.

**5a. Extraia o medido.** Rode o JS de `references/navegacao.md` e preencha, a partir do retorno dele e do texto literal do post, os campos da tabela **Medido** de `references/schema-post.md`. Para `formato`, quando o JS devolve só `texto`/`imagem`, confira a coluna "Como reconhecer" de `references/taxonomias.md` com `read_page` (ou o screenshot do post) — enquete, newsletter, evento, documento e reshare só aparecem assim. Concluído quando cada post da janela tem todo campo medido preenchido ou `null` explícito.

**5b. Classifique o inferido.** Leia o texto de cada post e preencha a tabela **Inferido** do mesmo arquivo, usando sempre um valor das taxonomias fechadas de `references/taxonomias.md`; sem sinal claro, `null`. Concluído quando todo campo inferido de todo post está preenchido com valor da taxonomia ou `null` explícito.

**Empresa sem posts na janela é dado, não erro.** Grave o `meta.json` com `"status"` diferente de `ok` e a `"nota"` de uma frase (valores em `references/schema-post.md`), pule o perfil dela e siga para a próxima.

Concluído quando cada empresa da seleção tem `posts.json` + `meta.json` na pasta do dia, com `status` preenchido.

### 6. Sintetize o perfil

De `posts.json`, gere `DADOS/catalog/<slug>.md` seguindo `assets/perfil-template.md` — uma empresa com `status` diferente de `ok` fica de fora. O relatório em prosa nasce **do JSON**, assim a `profills-post` lê o dado estruturado direto, sem interpretar prosa.

Na janela padrão (≤5 posts), o foco é **o que está fresco**: por post, o tema, o hook, o formato e o engajamento, mais qual post **puxou mais engajamento na janela** (o maior, simples) e sobre o quê. Média, desvio-padrão e outlier estatístico pertencem à janela ampliada.

Todo tema ou padrão citado carrega seu recibo: qual post, qual data. Afirmação sem post que a sustente não entra.

**Re-catalogação**: a pasta do dia é nova, o perfil não. Compare com o perfil anterior e anexe um `## Change Log` no fim de `catalog/<slug>.md` — cadência subiu/caiu, novo formato dominante, taxa de engajamento mudou.

Concluído quando cada empresa com `status: ok` tem `catalog/<slug>.md` com todas as seções do template preenchidas e cada afirmação com o post que a sustenta.

### 7. Compare e feche

Depois de todas as empresas, dois arquivos:

1. `DADOS/catalog/_summary.md` — tabela comparativa (cadência, formato dominante, taxa de engajamento por empresa) + o eixo de mercado de `references/benchmark-mercado.md`: "esta empresa posta 1×/semana vs. o padrão B2B de 3-5×". Entre empresas, compare pela **taxa normalizada** (fórmula em `benchmark-mercado.md`) — audiências diferentes não se comparam em bruto. Empresa sem dados entra numa linha `sem dados: <nota do meta.json>`.
2. `DADOS/refs/INDEX.md` — na linha de cada empresa com `status: ok`, troque o campo `catálogo …` pela data desta rodada (`catálogo AAAA-MM-DD`); empresa com outro status mantém o campo como estava — sem perfil, sem carimbo. É esse campo que a `profills-radar` lê para não mandar re-catalogar quem acabou de sair.

Concluído quando o `_summary.md` cobre todas as empresas da seleção (as com dados e as sem) e, no `INDEX.md`, só as linhas das empresas com `status: ok` mostram a data de hoje.

### 8. Monte o dashboard visual

Renderize o catálogo como um artefato visual seguindo `references/dashboard.md`. O dado estruturado fica em disco para rastreabilidade; o dashboard é a camada visual para o humano digerir cadência, formatos, hooks e destaques de relance.

Concluído quando as 7 seções de `dashboard.md` existem no artefato publicado e o link está na conversa.

## Conduza pela mão

Depois do dashboard, guie — com `AskUserQuestion`, opções concretas e a recomendada com o porquê:

1. **Aponte o que salta**: quem lidera, o formato que engaja, o espaço aberto.
2. **Pergunte o que não copiar**, uma empresa por vez: "tem algo do jeito da <Empresa> que você não quer imitar?", com opções tiradas dos posts que você acabou de ler ("o tom institucional", "os posts de vaga", "o excesso de emoji", "nada a evitar"). Grave a resposta em `DADOS/refs/<slug>.md`, na seção `## Do Not Copy`, no lugar do comentário que estiver lá. Critério: mesmo **tema** pode; mesma estrutura, ordem de argumentos ou estilo de frase, não. A `profills-post` lê essa seção antes de escrever, e seção vazia significa "ninguém perguntou ainda".
3. **Ofereça o próximo passo**: um rascunho com a `profills-post`, a partir de um ângulo que você recomenda.

Na conversa, chame as empresas pelo nome. Slug, dossiê e taxonomia são vocabulário seu, não dele.

## Compliance

Você dirige a conta real do usuário num site cujos termos proíbem automação: **só leia**. Curtir, comentar, conectar e publicar ficam com ele, à mão. Ritmo, volume, parada na detecção e linhagem de cada post estão em `references/compliance.md` — parte do fluxo, não nota de rodapé.
