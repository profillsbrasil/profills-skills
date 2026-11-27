---
name: profills-garimpo
description: >-
  Cataloga os posts recentes de empresas no LinkedIn e no Instagram, no
  navegador logado, com perfil, comparativo e dashboard. Use para "o que as empresas andam postando", "analisa os posts da X",
  "monitorar concorrentes", "leitura de tendência" (janela ampliada) ou
  re-catalogar.
  Não use para escolher a lista (profills-radar) nem escrever posts
  (profills-post).
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-garimpo

**Harness.** Antes do primeiro passo, leia uma vez por sessão o adaptador do harness em que você roda: `../../docs/harness/claude-code.md` no Claude Code, `../../docs/harness/codex.md` no Codex (os caminhos são relativos a este arquivo; na dúvida, leia os dois e use o que descreve as ferramentas que você tem). Cada intenção citada aqui, como `perguntar` ou `invocar-skill`, está lá com a ferramenta, o jeito de ver que ela falta e o que fazer sem ela.

## Medido vs inferido

O princípio que rege todo o catálogo: **separe o que foi medido do que foi inferido.** Data, texto, formato e engajamento (likes/comentários) são fatos lidos da página. Tema, tom, ângulo e "hook forte" são leituras suas. Rotular os dois deixa o usuário — e a `profills-post` — sabendo o que é dado e o que é palpite. Um pico de engajamento é fato; *por que* ele engajou é hipótese.

## Fluxo

### 0. Localize a pasta de dados

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, ou se `DADOS/.profills.json` falta ou traz `versao_dados` menor que 4, invoque a skill `profills-setup` — ela cria ou atualiza a pasta e confere o resto da instalação.

Concluído quando você tem o caminho de `DADOS` e ele existe em disco.

### 1. Resolva a seleção

Leia `DADOS/selection.md`. Cada linha traz o nome, o slug entre crases, o id numérico da empresa e as contas a coletar nesta rodada, uma por rede:

```markdown
- [Nome da Empresa](refs/<slug>.md) — `<slug>` · id <id numérico ou —> · <setor> · <país> · linkedin `<slug>` · instagram `<handle>`
```

Só as redes da linha entram nesta rodada: a empresa pode vir só com `linkedin`, só com `instagram` ou com as duas. O **slug é a chave da empresa** (`catalog/<slug>.md`, `refs/<slug>.md`), e a **conta é a chave da coleta** (`catalog/raw/<rede>/<conta>/…`): no LinkedIn a conta é o slug, no Instagram é o handle. O id é o plano B quando o slug falha na navegação do LinkedIn (`references/navegacao.md`).

Arquivo ausente ou vazio, ou linha sem nenhuma rede (seleção do formato anterior) → **invoque a `profills-radar`** (intenção `invocar-skill`): é ela que decide as empresas e as redes, monta a rodada até o limite de páginas e escreve a seleção.

**Rodada em mais de uma sessão.** A data do cabeçalho (`# Seleção ativa — AAAA-MM-DD`) marca a rodada. Conta que já tem `catalog/raw/<rede>/<conta>/<data>/meta.json` com `"concluida": true` e data entre a do cabeçalho e hoje, as duas inclusive, já foi coletada nesta rodada: tire-a da lista desta sessão e diga ao usuário, pelo nome da empresa e da rede, quais já estavam feitas. Só colete de novo se ele pedir. É essa regra que deixa coletar as de prioridade Alta numa sessão e o resto na seguinte sem repetir página. Pasta com data depois de hoje não conta: ela vem de relógio ou fuso adiantado, e a `profills-boletim` para e avisa o comercial antes de chamar esta skill.

Concluído quando você tem nome, slug e id de cada empresa e a conta de cada rede que falta coletar nesta rodada.

### 2. Carregue o contexto do usuário

Se existir `DADOS/voz.md`, leia antes — o produto e o público dele definem o que é relevante nos posts das empresas. Sem esse arquivo, catalogue de forma neutra e siga; esta skill não para para montar a voz.

Concluído quando você sabe o que o usuário vende, ou registrou que está catalogando neutro.

### 3. Fixe a janela

Quem escolhe a janela é o **pedido do usuário**, nunca a contagem de posts que aparecer depois:

- **Padrão (o default)** — últimos **7 dias, no máximo 5 posts por conta**, os mais recentes primeiro. É o alvo para escrever um post oportuno; histórico demais dilui o que está fresco.
- **Ampliada** — só quando ele pede leitura de tendência ("como a X evoluiu nos últimos meses"). Escolha a janela em dias com ele (90 é um bom padrão), suba o teto de posts e avise que a navegação fica mais longa; no Instagram cada post é uma página, então a janela ampliada no Instagram vai em poucas contas por sessão (`references/compliance.md`).

A janela vai em `janela_dias` no `meta.json` e decide o campo computado da síntese: `destaque_semana` na padrão, `outlier` na ampliada (`references/schema-post.md`).

Concluído quando `janela_dias` e o teto de posts por conta estão escritos para esta rodada.

### 4. Avise, e só então abra o navegador

O usuário está emprestando as contas reais dele. Antes da primeira empresa, conte em texto o tamanho real da rodada: quantas empresas faltam coletar e em quais redes, quantas delas são de prioridade Alta (o campo `prioridade` da linha de cada slug em `DADOS/refs/INDEX.md`) e o tempo aproximado pela conta de `references/compliance.md`, dito como estimativa. Explique em uma frase o que vai fazer: "vou abrir o LinkedIn e o Instagram no seu navegador e ler as páginas das empresas devagar, como se você estivesse rolando o feed. Nada é curtido, comentado, seguido nem publicado." (cite só as redes da rodada).

Então confirme numa pergunta com opções (intenção `perguntar`), com três saídas:

- **seguir com a rodada inteira**, a recomendada quando a rodada cabe numa sessão pela seção "Tamanho da rodada" de `references/compliance.md`;
- **coletar só as de prioridade Alta agora e o resto depois**, a recomendada quando aquela seção manda dividir. Sem nenhuma Alta, ou com todas Alta, a opção não aparece;
- **deixar para depois**.

Escolhendo só as Alta, colete-as e diga pelo nome quais ficaram para a próxima sessão. O `selection.md` não muda, e a retomada segue a regra do passo 1.

Com o "pode ir", **invoque a skill `profills-navegador`**: é ela que garante o navegador certo (intenção `navegador-pronto`: no Claude in Chrome o usuário pode ter a extensão em várias máquinas) e trata máquina sem extensão. A coleta começa no handoff dela: navegador selecionado e aba pronta, com o que o adaptador manda declarar.

Concluído quando o usuário ouviu o tamanho da rodada e o tempo estimado, confirmou quais empresas entram nesta sessão, e você tem o id da aba entregue pelo handoff.

### 5. Colete — uma conta por vez

Processe **uma empresa de cada vez**, e dentro dela uma conta por vez, na ordem da linha (LinkedIn, depois Instagram). Salve o bruto em disco antes de passar à próxima. Screenshots enchem o contexto rápido; terminar uma conta e liberar o material antes da próxima mantém a sessão viável numa lista grande.

Cada rede tem o seu arquivo de navegação, com os passos pelas intenções do adaptador, os blocos de JavaScript e os erros: `references/navegacao.md` para o LinkedIn (ordenar por Recentes, rolar o feed, authwall) e `references/navegacao-instagram.md` para o Instagram (o perfil, a grade e um post por página). Para cada conta, salve:

```
DADOS/catalog/raw/<rede>/<conta>/<AAAA-MM-DD>/
├── posts.json        # array de posts (dado estruturado — o artefato primário)
├── meta.json         # seguidores, janela, nº de posts, o status e se a coleta terminou
└── screenshots/      # uma imagem (.png ou .jpg) por post com mídia
```

**O `meta.json` diz se a coleta terminou.** Antes de abrir a página da conta, crie a pasta do dia e grave o `meta.json` com `slug` (o da empresa, também no Instagram), `coletado_em`, `janela_dias` e `"concluida": false`. Ao terminar a conta, regrave-o inteiro com os campos de `references/schema-post.md` e `"concluida": true`. Sessão que cai no meio deixa `false`, e é por ele que a próxima sessão e a `profills-boletim` sabem que a conta falta.

Cada execução cria a pasta do dia; pasta de data anterior fica intacta — é isso que permite comparar cadência semana a semana. Segunda rodada no mesmo dia sobrescreve só a pasta de hoje.

**Screenshot só existe quando a captura aconteceu.** Se a tool não devolveu o PNG (save indisponível, falha, post que não abriu), grave `screenshot: null` e descreva a imagem em `descricao_visual` — a descrição é o fallback documentado. **Arquivo placeholder é proibido**: PNG de 1×1, arquivo vazio ou imagem que você gerou não é captura, é dado falso. O `metricas.js` do passo 6 acusa (aviso de screenshot inexistente ou com menos de 1 KB).

**5a. Extraia o medido.** Rode o JS do arquivo de navegação da rede e preencha, a partir do retorno dele e do texto literal do post, os campos da tabela **Medido** de `references/schema-post.md` (o Instagram tem a seção própria lá). No LinkedIn, quando o JS devolve só `texto`/`imagem`, confira a coluna "Como reconhecer" de `references/taxonomias.md` lendo o card na página (intenção `ler-pagina`, ou o screenshot do post) — enquete, newsletter, evento, documento e reshare só aparecem assim. No Instagram o formato do JS vale como está. Concluído quando cada post da janela tem todo campo medido preenchido ou `null` explícito.

**5b. Classifique o inferido.** Leia o texto de cada post e preencha a tabela **Inferido** do mesmo arquivo, usando sempre um valor das taxonomias fechadas de `references/taxonomias.md`; sem sinal claro, `null`. Grave o `idioma` de todo post e, quando ele não for `pt`, o `resumo_pt`: uma ou duas frases fiéis ao texto, sem traduzir `texto` nem `hook`, que ficam no original. Post estrangeiro usa as mesmas taxonomias. Concluído quando todo campo inferido de todo post está preenchido com valor da taxonomia ou `null` explícito, e todo post fora do português tem `resumo_pt`.

**Conta sem posts na janela é dado, não erro.** Grave o `meta.json` com `"status"` diferente de `ok` e a `"nota"` de uma frase (valores em `references/schema-post.md`) e siga para a próxima conta. A empresa só fica sem perfil quando nenhuma conta dela tem `status: ok`.

Concluído quando cada conta da seleção tem `posts.json` + `meta.json` na pasta do dia, com `status` preenchido e `"concluida": true`.

### 6. Rode as métricas e sintetize o perfil

Antes de escrever qualquer número, rode o script **uma vez por conta**, sobre a pasta que você acabou de gravar:

```bash
node "<pasta desta skill>/scripts/metricas.js" "<DADOS>/catalog/raw/<rede>/<conta>/<AAAA-MM-DD>"
```

Cada JSON é de uma rede só e traz `rede` e `conta`. Número de redes diferentes não se soma nem se compara: o perfil, o `_summary.md` e o dashboard mostram a rede de cada número.

"Pasta desta skill" é o diretório onde este `SKILL.md` está. Janela ampliada é detectada pelo `janela_dias` do `meta.json`; se precisar forçar, `--janela padrao|ampliada`.

Ele lê `posts.json` + `meta.json` e devolve, em JSON: `n_posts`, `n_posts_com_engajamento_legivel`, `periodo`, `posts_por_semana`, `engajamento_medio`, `taxa_normalizada` (a fórmula de `references/benchmark-mercado.md`; `null` sem seguidores), `formato_dominante` + `formatos`, `hooks`, `hook_cabe_no_corte_pct`, `idiomas` (posts por código de idioma) e — conforme a janela do passo 3 — `destaque_semana` ou `outliers` (com `media`, `desvio_padrao`, `limiar`; `amostra_insuficiente: true` quando a janela ampliada tem 5 posts ou menos).

Contador pode chegar como número (`12`), string numérica (`"1.200"`) ou o abreviado da UI (`"1,2 mil"`) — o script lê os três. O que ele não consegue ler vira aviso `engajamento_nao_numerico` (com `post_id` e o valor bruto) e **o post sai da média, do destaque e dos outliers** em vez de virar zero silencioso. **Nenhuma estatística sai como `NaN`**: quando a entrada não dá conta, o campo vem `null` e o aviso diz por quê.

**A conta é do script; sua parte é a leitura.** Todo número que entra no perfil, no `_summary.md`, no dashboard e na sua resposta ao usuário é copiado desse JSON — você não recalcula média, taxa, cadência nem destaque em prosa.

Exit `0` = coleta utilizável — mas leia o campo `avisos` sempre: `ok: false` significa que há checagem falhando (sem `seguidores`, `seguidores: 0` — taxa impossível —, engajamento ilegível, amostra insuficiente, post fora da janela, screenshot inexistente, com prosa no lugar do caminho ou suspeito de placeholder, `destaque_semana` gravado no post errado, `resumo_pt_ausente` em post fora do português); conserte o que for erro seu e leve para o texto o que for limitação do dado ("sem seguidores: esta empresa não entra na comparação"). Exit `1` = `status` ≠ `ok`, sem perfil para esta empresa. Exit `2` = pasta ou arquivo errado (corrija o caminho) ou `posts.json` malformado — não é um array, ou tem item que não é objeto de post: regrave o bruto conforme `references/schema-post.md`.

Com os JSON na mão, gere `DADOS/catalog/<slug>.md` seguindo `assets/perfil-template.md`, um bloco de números por rede coletada — uma empresa sem nenhuma conta com `status: ok` fica de fora. O relatório em prosa nasce **do JSON**, assim a `profills-post` lê o dado estruturado direto, sem interpretar prosa.

Na janela padrão (≤5 posts), o foco é **o que está fresco**: por post, o tema, o hook, o formato e o engajamento, mais o `destaque_semana` que o script apontou e sobre o quê ele era. Média, desvio-padrão e outlier estatístico pertencem à janela ampliada.

Todo tema ou padrão citado carrega seu recibo: qual post, qual data. Afirmação sem post que a sustente não entra.

O template é andaime: preencha **só o bloco de janela desta rodada** e apague o outro, apague o bloco de instruções do topo e **não deixe nenhum comentário HTML (`<!-- ... -->`) no arquivo entregue** — instrução de preenchimento não é conteúdo do perfil.

**Re-catalogação**: a pasta do dia é nova, o perfil não. Rode o script também na pasta da coleta anterior da mesma conta e compare os dois JSON; anexe um `## Change Log` no fim de `catalog/<slug>.md` — por rede, cadência, formato dominante e taxa de engajamento, cada um com o número de antes e o de agora. Rede coletada pela primeira vez ganha o bloco dela no perfil, sem Change Log.

Concluído quando cada empresa com alguma conta em `status: ok` tem `catalog/<slug>.md` com todas as seções do template preenchidas, cada afirmação com o post que a sustenta, cada número com a rede dele e igual ao do JSON do `metricas.js`, e nenhum comentário `<!-- ... -->` sobrando no arquivo.

### 7. Compare e feche

Depois de todas as empresas, um arquivo:

1. `DADOS/catalog/_summary.md` — tabela comparativa com uma linha por empresa e rede (empresa, rede, data da coleta, cadência, formato dominante, taxa de engajamento) + o eixo de mercado de `references/benchmark-mercado.md`: "esta empresa posta 1×/semana no LinkedIn vs. o padrão B2B de 3-5×". Cada célula numérica é `posts_por_semana`, `formato_dominante` e `taxa_normalizada` do JSON do `metricas.js` daquela conta — entre empresas só a taxa normalizada compara, e só dentro da mesma rede, porque audiências diferentes não se comparam em bruto. Ordene por rede, para a comparação ficar entre linhas da mesma rede, e nunca some números das duas redes numa célula. Conta sem dados entra numa linha `sem dados: <nota do meta.json>`; conta sem `seguidores` entra com a taxa em branco e a razão ("sem seguidores no meta.json"), nunca com likes brutos na coluna da taxa.

   **Rodada com parte das contas**: se o `_summary.md` já existe, **edite-o** — atualize a data do cabeçalho e só as linhas das contas desta rodada, preservando as demais como estão (elas são o retrato da coleta delas, com a data delas). Criar do zero só quando o arquivo não existe. Se a tabela antiga não tiver as colunas de rede e de data por linha, acrescente-as ao migrar (as linhas antigas são do LinkedIn): sem elas, linhas de rodadas ou redes diferentes viram um comparativo falso.
O `DADOS/refs/INDEX.md` não muda: a data do último catálogo de cada empresa sai das coletas, da pasta mais recente com `status: ok` e `"concluida": true` (a regra está em `scripts/coleta.js` do plugin), e é ela que a `profills-radar` lê para não mandar re-catalogar quem acabou de sair. O `meta.json` do passo 5 já é o carimbo.

Com o `_summary.md` gravado, rode `node "<pasta desta skill>/../profills-setup/scripts/mapa.js" "<DADOS>"`, que atualiza o resumo da pasta em `<DADOS>/AGENTS.md`; se ele não voltar `ok: true`, avise em uma frase que o resumo não foi atualizado e siga.

Concluído quando o `_summary.md` cobre todas as contas coletadas nesta sessão (as com dados e as sem), cada linha com a rede e os números do `metricas.js` dela, as linhas de contas fora desta rodada continuam como estavam, e o `INDEX.md` está como estava antes da coleta.

### 8. Monte o dashboard visual

Renderize o catálogo como uma página visual seguindo `references/dashboard.md` e mostre-a ao comercial (intenção `mostrar-pagina`). O dado estruturado fica em disco para rastreabilidade; o dashboard é a camada visual para o humano digerir cadência, formatos, hooks e destaques de relance. Todo valor plotado vem do JSON do `metricas.js` de cada empresa — o painel é vitrine da conta, não uma segunda conta.

Concluído quando as 7 seções de `dashboard.md` existem na página, cada número bate com o JSON do `metricas.js` e o link (ou, onde o adaptador manda gravar em arquivo, o caminho do HTML) está na conversa.

## Conduza pela mão

Depois do dashboard, guie com perguntas com opções (`perguntar`), opções concretas e a recomendada com o porquê:

1. **Aponte o que salta**: quem lidera, o formato que engaja, o espaço aberto.
2. **Pergunte o que não copiar**, uma empresa por vez: "tem algo do jeito da <Empresa> que você não quer imitar?", com opções tiradas dos posts que você acabou de ler ("o tom institucional", "os posts de vaga", "o excesso de emoji", "nada a evitar"). Grave a resposta em `DADOS/refs/<slug>.md`, na seção `## Do Not Copy`, no lugar do comentário que estiver lá. Critério: mesmo **tema** pode; mesma estrutura, ordem de argumentos ou estilo de frase, não. A `profills-post` lê essa seção antes de escrever, e seção vazia significa "ninguém perguntou ainda".
3. **Ofereça o próximo passo**: um rascunho com a `profills-post`, a partir de um ângulo que você recomenda.

Na conversa, chame as empresas pelo nome. Slug, dossiê e taxonomia são vocabulário seu, não dele.

## Compliance

Você dirige as contas reais do usuário em sites cujos termos proíbem automação: **só leia**. Curtir, comentar, seguir, conectar, salvar e publicar ficam com ele, à mão; no Instagram, stories, mensagens diretas e notificações nem se abrem. Ritmo, volume, parada na detecção e linhagem de cada post estão em `references/compliance.md` — parte do fluxo, não nota de rodapé.
