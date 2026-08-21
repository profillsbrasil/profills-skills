---
name: profills-post
description: >-
  Gera rascunhos de post de LinkedIn em português a partir do catálogo que a
  profills-garimpo montou — você escolhe um tema, e a skill produz 3-5 variações
  de ângulos diferentes inspiradas no que engajou nas empresas de referência,
  passa por um crivo de qualidade, remove marcas de IA e mostra as opções lado a
  lado para você escolher. Use quando o usuário disser "gera um post sobre X no
  estilo da empresa Y", "escreve um post inspirado no que a Z postou", "preciso
  de ideias de post sobre [tema]", ou "transforma esse catálogo em posts". Lê o
  catálogo de profills-garimpo e encadeia a skill humanize-pt-br no final.
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-post

Você transforma o **catálogo** em **rascunhos** de post na **voz** do usuário. O catálogo diz o que funcionou nas empresas de referência; o seu trabalho é gerar variações inspiradas nesses padrões — nunca cópias — e deixar o usuário escolher. A saída é sempre em português, mesmo quando a referência é gringa.

## Três insumos antes de escrever

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

1. **O catálogo** — leia `DADOS/catalog/<slug>.md` (e o `posts.json` bruto) da empresa que inspira o post. É de onde vêm os hooks, formatos e ângulos que engajaram. Sem catálogo, sugira rodar a `profills-garimpo` primeiro, ou trabalhe só com o tema que o usuário deu.
2. **A voz do usuário** — leia `DADOS/voz.md`: identidade, voz, provas, palavras banidas. É o que faz o rascunho soar como ele, não como a empresa de referência. Sem esse arquivo, **invoque a skill `profills-voz`** — ela monta o arquivo com o usuário em ~10 minutos a partir de material real dele. Se ele não puder agora, pergunte o essencial com `AskUserQuestion` (tom, público, o que ele vende) e ofereça a skill para depois.
3. **O que não copiar** — leia a seção "Do Not Copy" do dossiê da empresa em `DADOS/refs/<slug>.md`. Tom ou tema que o usuário rejeitou não entra no rascunho.

## Conduza pela mão

Quem usa isto é o **comercial, não dev** — pode não saber o que escrever nem que decisões existem. Não largue opções e suma: **guie, um passo por vez**.

- **Mostre como vai ficar de verdade**, não descreva. Cada opção é um preview realista de feed (ver `references/comparador.md`), não card abstrato — ele bate o olho e entende o que vai publicar.
- **Pergunte com `AskUserQuestion`**, em linguagem simples, sempre com recomendação e o porquê. Nunca faça ele adivinhar ou digitar do zero — ofereça as escolhas (qual ângulo, mais curto?, outro gancho?).
- **Pegue o dado real dele** antes de finalizar. Os `[campos]` do rascunho (nome, número, quem fez) são de propósito: você os preenche COM ele, perguntando com jeito.
- **Aponte sempre o próximo passo** ("quer que eu ajuste o tom?", "monto a ideia da foto?"). A skill segura na mão até o post estar pronto pra colar.

## Inspirar, não copiar

A linha que separa referência de plágio: você reusa o **padrão** (a estrutura do hook, o ângulo, o formato que engajou), nunca o texto. Um post da referência sobre "5 dicas de wellness" vira, na voz do usuário, um post com a mesma *arquitetura* sobre o tema *dele*. Se o rascunho serve para qualquer empresa do setor — se dá para trocar o nome e continuar igual — ele falhou; é genérico, não é dele.

## Fluxo

### 1. Fixe o tema e a referência

O usuário escolhe o tema (e opcionalmente a empresa que inspira). Puxe do catálogo os sinais para esse tema: quais hooks e ângulos engajaram, qual formato performou, o benchmark de tamanho.

### 2. Colete a matéria-prima

Escrita habilidosa sobre matéria-prima rasa produz post genérico. Antes de gerar, reúna **quatro elementos** — do `voz.md` (provas, dores do ICP) e do próprio usuário, perguntando com `AskUserQuestion` em linguagem simples:

1. **Um número real** dele sobre o tema (quantos, quanto tempo, quanto custou).
2. **Uma opinião ou insight contra-intuitivo** — o que ele sabe do tema que o senso comum do setor erra.
3. **Um mecanismo** — o "como" em 2-3 passos concretos.
4. **A dor do ICP** que o post toca — qual ansiedade do comprador esse tema resolve.

Só avance com os quatro. Faltou um → pergunte; não invente número nem opinião pelo usuário. (Nem todo elemento entra em toda variação — são a despensa, não a receita.)

### 3. Gere 3-5 variações — uma por ângulo

Cada rascunho ataca o tema por um **ângulo diferente** (não são 5 versões da mesma frase). Cubra ângulos distintos da `references/moldes.md` — ex.: um `dado`, um `contrarian`, uma `historia-cliente`. Para cada um: escolha o molde de post e a categoria de hook, preencha com o conteúdo do usuário, aplique os blocos de credibilidade quando o ângulo pede prova, e feche com um CTA da taxonomia (ver moldes).

**Diversifique o hook, não só o ângulo.** Três ângulos diferentes com o mesmo tipo de abertura não são escolha real. Entre as variações, garanta pelo menos: um hook **intelectual** (curiosity-gap, bold-claim, contrast), um **de cena** (relatability, confissão, countdown) e um **direto ao leitor** (question, proof-first).

### 4. Passe pelo quality gate

Antes de humanizar, rode o crivo de `references/quality-gate.md`: o teste "So what?" em cada afirmação, e o Expert Panel (personas do contexto LinkedIn pontuam 1-10, itera até média ≥8). Rascunho que não passa volta para revisão, não para o usuário.

### 5. Humanize

Encadeie a skill **`humanize-pt-br`** em cada rascunho aprovado — ela remove as marcas de IA em português (vocabulário inflado, conectivos automáticos, conclusões genéricas). O hook fica intacto; o corpo ganha voz humana.

### 6. Mostre lado a lado

Renderize as variações como **previews realistas de feed** seguindo `references/comparador.md`: copie `assets/preview-template.html`, preencha só o bloco `DADOS` (o motor cuida do corte "…mais", dos `[campos]` e do layout) e publique via Artifact. O mesmo template, com uma opção só, é o preview final depois da escolha. Publicar é ele; você entrega o rascunho.

### 7. Persista o escolhido

Depois da escolha e dos `[campos]` preenchidos, salve o texto final em `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>.md` — o texto exato do preview, pronto para colar, com uma linha de contexto no topo (tema, ângulo, empresa que inspirou). O preview morre com a sessão; o arquivo é o que ele encontra amanhã.

## Restrições de formato (LinkedIn)

Aplicáveis a todo rascunho, do `references/moldes.md`:

- Hook nos primeiros ~210 caracteres, antes do corte "ver mais".
- Corpo entre ~1.200 e 1.600 caracteres performa bem; acima de ~2.000 o engajamento cai.
- Link no comentário, não no corpo (link no corpo derruba alcance) — sugira isso ao usuário.
- Quebras de linha frequentes; no máximo 2 linhas visuais por parágrafo (mobile-first).
- **O LinkedIn não renderiza markdown.** Destaque é caractere unicode (𝗮𝘀𝘀𝗶𝗺) — `**asteriscos**` saem literais no feed. Use com muita parcimônia e nunca no hook: leitor de tela não lê unicode bold, e busca não o indexa.
- Post com imagem/carrossel: frameworks, dimensões e limites em `references/formato-visual.md`.
