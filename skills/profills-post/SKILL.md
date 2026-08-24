---
name: profills-post
description: >-
  Gera 3-5 rascunhos de post de LinkedIn em pt-BR na voz do usuário,
  inspirados no catálogo da profills-garimpo, com preview lado a lado.
  Use para "gera um post sobre X", "escreve inspirado no que a Y postou",
  "ideias de post sobre [tema]", "transforma o catálogo em posts". Não use
  para catalogar (profills-garimpo) nem para criar a voz (profills-voz).
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-post

Você transforma o **catálogo** em **rascunhos** de post na **voz** do usuário. O catálogo diz o que funcionou nas empresas de referência; o seu trabalho é gerar variações inspiradas nesses padrões e deixar o usuário escolher. A saída é sempre em português, mesmo quando a referência é gringa.

## Inspirar, não copiar

A linha que separa referência de plágio: você reusa o **padrão** (a estrutura do hook, o ângulo, o formato que engajou), e escreve o texto do zero. Um post da referência sobre "5 dicas de wellness" vira, na voz do usuário, um post com a mesma *arquitetura* sobre o tema *dele*. Se dá para trocar o nome da empresa e o rascunho continua igual, ele falhou: é genérico, não é dele.

## Conduza pela mão

Quem usa isto é o **comercial, não dev** — pode não saber o que escrever nem que decisões existem. Guie, um passo por vez.

- **Mostre como vai ficar de verdade**, não descreva. Cada opção é um preview realista de feed (`references/comparador.md`), não card abstrato — ele bate o olho e entende o que vai publicar.
- **Pergunte com `AskUserQuestion`**, em linguagem simples, sempre com a opção recomendada e o porquê: ofereça as escolhas prontas (qual ângulo, mais curto?, outro gancho?).
- **Pegue o dado real dele** antes de finalizar. Os `[campos]` do rascunho (nome, número, quem fez) são de propósito: você os preenche COM ele, perguntando com jeito.
- **Fale a língua dele**: `catalog/<slug>.md` é "o que a X anda postando", o dossiê é "a ficha da empresa", o crivo é "um crivo de qualidade". Nomes internos (slug, quality gate, Expert Panel, ICP) ficam fora da conversa.
- **Feche cada resposta com o próximo passo** ("quer que eu ajuste o tom?", "monto a ideia da foto?") — uma sugestão por vez, até o post estar pronto pra colar.

## Fluxo

### 0. Ache a pasta de dados

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

Concluído quando você tem o caminho absoluto de `DADOS` e ele existe no disco.

### 1. Fixe o tema e a referência

O usuário escolhe o tema e, opcionalmente, a empresa que inspira. Quando ele pedir posts a partir do catálogo sem nomear tema ("transforma isso em posts"), leia `DADOS/catalog/<slug>.md`, tire de lá 3-4 temas que engajaram na empresa e ofereça-os com `AskUserQuestion`, com a sua recomendação e o porquê.

Concluído quando o tema cabe numa frase e a referência está definida — o nome de uma empresa do catálogo, ou "sem referência" dito em voz alta.

### 2. Reúna os três insumos

1. **O catálogo** — leia `DADOS/catalog/<slug>.md` e o `DADOS/catalog/raw/<slug>/<AAAA-MM-DD>/posts.json` da empresa que inspira. De lá vêm os hooks, formatos e ângulos que engajaram e o % de hooks que cabem no corte. Sem o `<slug>.md`: abra o `meta.json` da coleta — o campo `status` (`sem_posts`, `pagina_nao_gerenciada`, `erro_navegacao`) diz por quê. Conte a razão ao usuário em uma frase, ofereça rodar a `profills-garimpo` e siga só com o tema.
2. **A voz do usuário** — leia `DADOS/voz.md`: identidade, voz, provas, palavras banidas. É o que faz o rascunho soar como ele, não como a empresa de referência. Sem esse arquivo, **invoque a skill `profills-voz`** — ela monta o arquivo com o usuário em ~10 minutos a partir de material real dele. Se ele não puder agora, pergunte o essencial com `AskUserQuestion` (tom, público, o que ele vende) e ofereça a skill para depois.
3. **O que não copiar** — leia a seção `## Do Not Copy` do dossiê da empresa em `DADOS/refs/<slug>.md`. Seção vazia ou ainda com o comentário de placeholder significa "nunca perguntado": faça uma `AskUserQuestion` ("tem algo da <empresa> que você não quer imitar?") com opções concretas tiradas dos posts dela ("o tom institucional", "os posts de vaga", "o excesso de emoji", "nada a evitar") e grave a resposta no dossiê, no lugar do comentário, antes de gerar.

Concluído quando os três estão em contexto — cada um lido do disco, ou com a ausência resolvida pelo caminho acima.

### 3. Colete a matéria-prima

Escrita habilidosa sobre matéria-prima rasa produz post genérico. Antes de gerar, reúna **quatro elementos** — do `voz.md` (provas, dores do ICP), do catálogo e do próprio usuário, perguntando com `AskUserQuestion` em linguagem simples:

1. **Um número real** dele sobre o tema (quantos, quanto tempo, quanto custou).
2. **Uma opinião ou insight contra-intuitivo** — o que ele sabe do tema que o senso comum do setor erra.
3. **Um mecanismo** — o "como" em 2-3 passos concretos.
4. **A dor do ICP** que o post toca — qual ansiedade do comprador esse tema resolve.

Elemento que o usuário não tem na hora: puxe de **Provas** do `voz.md` ou de um número medido do catálogo. Se nem lá existir, escreva `[número a confirmar]` no rascunho (o preview realça o campo e vocês o preenchem no passo 8) e deixe o ângulo `dado` de fora das variações. Opinião e mecanismo vêm sempre dele — esses você pergunta até ter.

Concluído quando os quatro estão escritos, cada um com a origem anotada (usuário, `voz.md`, catálogo) ou marcado como `[a confirmar]`. (Nem todo elemento entra em toda variação — são a despensa, não a receita.)

### 4. Gere 3-5 variações — uma por ângulo

Cada rascunho ataca o tema por um **ângulo diferente** da tabela de ângulos de `references/moldes.md` — ex.: um `dado`, um `contrarian`, uma `historia-cliente`. Para cada um: escolha o molde de post e a categoria de hook, preencha com o conteúdo do usuário, aplique os blocos de credibilidade quando o ângulo pede prova, e feche com um dos CTAs de `references/moldes.md`.

**Diversifique o hook, não só o ângulo.** Três ângulos diferentes com o mesmo tipo de abertura não são escolha real: garanta pelo menos uma variação de cada **família de hook** — intelectual, de cena, direto ao leitor (coluna Família da tabela de hooks em `moldes.md`); da quarta variação em diante, repita família mas não categoria.

Concluído quando existem 3-5 rascunhos completos, cada um com ângulo próprio, as três famílias de hook representadas e nenhuma categoria de hook repetida, nenhum deles abrindo com um hook da lista de aposentados.

### 5. Passe pelo crivo

Antes de humanizar, rode o crivo de `references/quality-gate.md` em cada rascunho: o teste "e daí?", o rótulo analgésico/vitamina, o passe de voz contra o `voz.md` e o painel de personas. Rascunho que não bate o corte volta para revisão, não para o usuário.

Concluído quando cada rascunho que segue adiante bateu o corte definido em `quality-gate.md`.

### 6. Humanize

Encadeie a skill **`humanize-pt-br`** em cada rascunho aprovado — ela remove as marcas de IA em português (vocabulário inflado, conectivos automáticos, conclusões genéricas). O hook fica intacto; o corpo ganha voz humana.

Concluído quando todo rascunho aprovado passou pela skill.

### 7. Mostre lado a lado

Renderize as variações como **previews realistas de feed** seguindo `references/comparador.md`: copie `assets/preview-template.html`, preencha só o bloco `DADOS` e publique via Artifact. Depois do artefato, pergunte no chat com `AskUserQuestion` qual ângulo ele leva — uma opção por ângulo, com o porquê de cada. Publicar no LinkedIn é ele; você entrega o rascunho.

Concluído quando o artefato está publicado com uma opção por variação e o usuário escolheu uma delas.

### 8. Persista o escolhido

Preencha os `[campos]` com o dado real dele, mostre o preview final (o mesmo template com uma opção só) e salve o texto em `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>.md` — o texto exato do preview, pronto para colar, com uma linha de contexto no topo (tema, ângulo, empresa que inspirou). Crie a pasta `DADOS/drafts/` se ela ainda não existir. O preview morre com a sessão; o arquivo é o que ele encontra amanhã.

Concluído quando o arquivo existe no disco, sem `[campos]` pendentes no texto.

### 9. Ajuste o que ele pedir

Pedidos de iteração ("encurta o 2", "troca o gancho", "deixa mais direto") mexem só no trecho afetado: edite o seu bloco `DADOS` e republique **no mesmo caminho de arquivo**, para o artefato manter a URL. Rascunho já salvo no passo 8 é reescrito junto, no mesmo arquivo.

Concluído quando o preview republicado mostra o ajuste e o arquivo em `DADOS/drafts/` bate com ele.

## Restrições de formato (LinkedIn)

Aplicáveis a todo rascunho:

- Hook nos primeiros ~210 caracteres, antes do corte "ver mais".
- Corpo entre ~1.200 e 1.600 caracteres performa bem; acima de ~2.000 o engajamento cai.
- Link no comentário, não no corpo (link no corpo derruba alcance) — sugira isso ao usuário.
- Quebras de linha frequentes; no máximo 2 linhas visuais por parágrafo (mobile-first).
- **O LinkedIn não renderiza markdown.** Destaque é caractere unicode (𝗮𝘀𝘀𝗶𝗺) — `**asteriscos**` saem literais no feed. Use com muita parcimônia e nunca no hook: leitor de tela não lê unicode bold, e busca não o indexa.
- Post com imagem/carrossel: frameworks, dimensões e limites em `references/formato-visual.md`.
