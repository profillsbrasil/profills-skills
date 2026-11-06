---
name: profills-post
description: >-
  Escreve post de LinkedIn em pt-BR na voz do usuário com o catálogo da
  profills-garimpo. Use para "gera um post sobre X", "ideias de post sobre
  [tema]", "escreve inspirado no que a Y postou", "transforma o catálogo em
  posts", "post da pauta N do boletim" ou revisar rascunho. Não use para
  catalogar (profills-garimpo) nem criar a voz (profills-voz).
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

- **Mostre como vai ficar de verdade**, não descreva. Cada opção é um preview realista de feed no picker local (`references/comparador.md`), não card abstrato — ele bate o olho, copia no card e entende o que vai publicar.
- **Pergunte com `AskUserQuestion`**, em linguagem simples, sempre com a opção recomendada e o porquê: ofereça as escolhas prontas (qual ângulo, mais curto?, outro gancho?).
- **Pegue o dado real dele** antes de finalizar. Os `[campos]` do rascunho (nome, número, quem fez) são de propósito: você os preenche COM ele, perguntando com jeito.
- **Fale a língua dele**: `catalog/<slug>.md` é "o que a X anda postando", o dossiê é "a ficha da empresa", o crivo é "um crivo de qualidade". Nomes internos (slug, quality gate, Push/Shine, Expert Panel, ICP) ficam fora da conversa.
- **Feche cada resposta com o próximo passo** ("quer que eu ajuste o tom?", "monto a ideia da foto?") — uma sugestão por vez, até o post estar pronto pra colar.

## Fluxo

### 0. Ache a pasta de dados

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, ou se `DADOS/.profills.json` falta ou traz `versao_dados` menor que 2, invoque a skill `profills-setup` — ela cria ou atualiza a pasta e confere o resto da instalação.

Concluído quando você tem o caminho absoluto de `DADOS` e ele existe no disco.

### 1. Fixe o tema e a referência

O usuário escolhe o tema e, opcionalmente, a empresa que inspira. Quando ele pedir posts a partir do catálogo sem nomear tema ("transforma isso em posts"), leia `DADOS/catalog/<slug>.md`, tire de lá 3-4 temas que engajaram na empresa e ofereça-os com `AskUserQuestion`, com a sua recomendação e o porquê.

**Pauta do boletim.** Quando ele pede "a pauta N do boletim", abra o boletim mais novo de `DADOS/boletins/` (o `AAAA-MM-DD.md` de data maior) e leia a pauta N da seção `## Pautas para você`: o título dela é o tema, o ângulo dela é o ângulo da primeira variação, e o post que ela cita é o post-referência. Ache esse post pelo link no `posts.json` da empresa citada (a pasta de data mais recente em `DADOS/catalog/raw/`) e siga daqui como "inspirado no que a <empresa> postou"; nesse caso o `posts.json` basta como catálogo, e o perfil `catalog/<slug>.md` entra no passo 2 só se existir. Diga em uma frase qual pauta e qual post você pegou. Sem boletim na pasta, ou sem a pauta N nele, diga isso em uma frase, liste as pautas que existem (se houver) e pergunte o tema.

**Rascunho já salvo.** Quando ele traz um arquivo de `DADOS/drafts/` para revisar, os passos 1, 3, 4 e 7 ficam de fora, e o picker não abre: o texto pronto para colar vai no chat. Do passo 2 vale a voz: sem `DADOS/voz.md`, siga o passo 2.2 (invoque a `profills-voz` ou pare sem mexer no arquivo). O Do Not Copy só entra quando a inspiração do arquivo nomeia uma empresa cujo dossiê em `DADOS/refs/` tem a seção preenchida; aí confira o texto contra ela. Seção vazia ou dossiê ausente não gera pergunta nesse ramo. Rode o `checar-formato.js` no arquivo como ele está e conte o que o script mediu, em linguagem simples. Conserte com o `voz.md` (número de **Provas** no lugar de `[campo]`), passe pelos passos 5 e 6 e regrave no **mesmo caminho**, no formato do passo 8, com o `mapa.js` do passo 8 em seguida. Os avisos vão para a conversa como no passo 5. Concluído quando o arquivo foi regravado no mesmo caminho, o `checar-formato.js` volta `ok: true` nele e o `mapa.js` rodou.

Havendo empresa que inspira, **nomeie o padrão que você vai reusar** — o par ângulo + categoria de hook do post-referência, lido do `posts.json` (ex.: "vou reusar o padrão do post de gummies: ângulo `trend` com hook de pergunta"). É esse par que o passo 8 confere contra a variação que ele escolheu.

Concluído quando o tema cabe numa frase, a referência está definida — o nome de uma empresa do catálogo, ou "sem referência" dito em voz alta — e, havendo post-referência, o par ângulo + hook está anunciado.

### 2. Reúna os três insumos

1. **O catálogo** — leia `DADOS/catalog/<slug>.md` e o `DADOS/catalog/raw/<slug>/<AAAA-MM-DD>/posts.json` da empresa que inspira. De lá vêm os hooks, formatos e ângulos que engajaram e o % de hooks que cabem no corte. Sem o `<slug>.md`: abra o `meta.json` da coleta — o campo `status` (`sem_posts`, `pagina_nao_gerenciada`, `erro_navegacao`) diz por quê. Conte a razão ao usuário em uma frase, ofereça rodar a `profills-garimpo` e siga só com o tema. Sem empresa que inspira, ou sem pasta dela em `DADOS/catalog/raw/`, diga em uma frase que não há catálogo para esse tema, ofereça rodar a `profills-garimpo` e siga só com o tema; a linha `Inspiração:` do passo 8 fica "sem referência". Nesse caso não se cria `catalog/<slug>.md` nem dossiê.
2. **A voz do usuário** — leia `DADOS/voz.md`: identidade, voz, provas, palavras banidas. É o que faz o rascunho soar como ele, não como a empresa de referência. Sem esse arquivo, **invoque a skill `profills-voz`** e espere ela gravar o `voz.md` antes de seguir — ela monta o arquivo com o usuário em ~10 minutos a partir de material real dele. Não existe rascunho sem voz: se ele disser que agora não tem tempo, explique em uma frase que sem a voz o post sai genérico, com a cara da empresa de referência e não a dele, e pare sem gerar rascunho, com a sugestão de rodar a `profills-voz` quando ele tiver os 10 minutos.
3. **O que não copiar** — leia a seção `## Do Not Copy` do dossiê da empresa em `DADOS/refs/<slug>.md`. Seção vazia ou ainda com o comentário de placeholder significa "nunca perguntado": faça uma `AskUserQuestion` ("tem algo da <empresa> que você não quer imitar?") com opções concretas tiradas dos posts dela ("o tom institucional", "os posts de vaga", "o excesso de emoji", "nada a evitar") e grave a resposta no dossiê, no lugar do comentário e no formato que o comentário de `<pasta desta skill>/../profills-radar/assets/dossie-template.md` fixa (uma linha datada por resposta), antes de gerar.

Concluído quando os três estão em contexto — cada um lido do disco, ou com a ausência resolvida pelo caminho acima. A voz só se resolve com o `DADOS/voz.md` gravado pela `profills-voz`; sem ele, a run termina neste passo, sem nada em `DADOS/drafts/`.

### 3. Colete a matéria-prima

Escrita habilidosa sobre matéria-prima rasa produz post genérico. Antes de gerar, reúna **quatro elementos** — do `voz.md` (provas, dores do ICP), do catálogo e do próprio usuário, perguntando com `AskUserQuestion` em linguagem simples:

1. **Um número real** dele sobre o tema (quantos, quanto tempo, quanto custou).
2. **Uma opinião ou insight contra-intuitivo** — o que ele sabe do tema que o senso comum do setor erra.
3. **Um mecanismo** — o "como" em 2-3 passos concretos.
4. **A dor do ICP** que o post toca — qual ansiedade do comprador esse tema resolve.

Elemento que o usuário não tem na hora: puxe de **Provas** do `voz.md` ou de um número medido do catálogo. Se nem lá existir, escreva `[número a confirmar]` no rascunho (o preview realça o campo e vocês o preenchem no passo 8) e deixe o ângulo `dado` de fora das variações; diga isso ao usuário em uma frase ("deixei de fora a versão puxada por número porque ainda não temos um número real"). Opinião e mecanismo vêm sempre dele — esses você pergunta até ter.

Concluído quando os quatro estão escritos, cada um com a origem anotada (usuário, `voz.md`, catálogo) ou marcado como `[a confirmar]`. Sem número real, o ângulo `dado` está fora e o usuário sabe por quê. (Nem todo elemento entra em toda variação — são a despensa, não a receita.)

### 4. Gere 3-5 variações — uma por ângulo

Cada rascunho ataca o tema por um **ângulo diferente** da tabela de ângulos de `references/moldes.md` — ex.: um `dado`, um `contrarian`, uma `historia-cliente`. Para cada um: escolha o molde de post e a categoria de hook, preencha com o conteúdo do usuário, aplique os blocos de credibilidade quando o ângulo pede prova, e feche com um dos CTAs de `references/moldes.md`.

Formato vencedor da referência, ou pedido dele, é carrossel, documento ou imagem: leia `references/formato-visual.md` antes de gerar.

**Diversifique o hook, não só o ângulo.** Três ângulos diferentes com o mesmo tipo de abertura não são escolha real: garanta pelo menos uma variação de cada **família de hook** — intelectual, de cena, direto ao leitor (coluna Família da tabela de hooks em `moldes.md`); da quarta variação em diante, repita família mas não categoria.

Concluído quando existem 3-5 rascunhos completos, cada um com ângulo próprio, as três famílias de hook representadas e nenhuma categoria de hook repetida, nenhum deles abrindo com um hook da lista de aposentados.

### 5. Passe pelo crivo

Antes de humanizar, rode o crivo de `references/quality-gate.md` em cada rascunho: primeiro o **checklist mensurável** (o script `scripts/checar-formato.js`), depois o teste "e daí?", o rótulo analgésico/vitamina, o passe de voz contra o `voz.md` e o painel de personas. Rascunho que não bate o corte volta para revisão, não para o usuário.

O checklist é script, não olhômetro: escreva cada variação num `.txt` do seu diretório de trabalho e rode

```
node "<pasta desta skill>/scripts/checar-formato.js" "<variacao.txt>" --voz "<DADOS>/voz.md"
```

Exit 2 quer dizer arquivo ou argumento errado: corrija o caminho, não o texto. `ok: false` reprova a variação **antes** do painel de personas — conserte o que o campo `falhas` aponta (ele já traz o número medido e o limite) e rode de novo. Os limites vêm do próprio JSON (`limites`); não os recite de cabeça.

O campo `avisos` **não reprova**: é conversa com o usuário. `corpo_curto` vira uma pergunta ("ficou curto — quer engordar ou vai assim?"), nunca um bloqueio; molde de Enquete é curto por desenho. `voz_sem_palavras_banidas` significa que o gate de banidas ficou **não medido** — diga isso em vez de dar por aprovado e ofereça a `profills-voz` para preencher a seção.

Concluído quando cada rascunho que segue adiante tem `ok: true` no script, os avisos foram levados ao usuário e ele bateu o corte definido em `quality-gate.md`.

### 6. Humanize

Encadeie a skill **`humanize-pt-br`** em cada rascunho aprovado — ela remove as marcas de IA em português (vocabulário inflado, conectivos automáticos, conclusões genéricas). O hook fica intacto; o corpo ganha voz humana.

Concluído quando todo rascunho aprovado passou pela skill, o hook de cada um segue igual ao de antes e o `checar-formato.js` volta `ok: true` de novo em cada texto humanizado; o que reprovar volta ao passo 5.

### 7. Mostre lado a lado

As opções abrem no **picker local** desta skill, no formato do feed. Não use Artifact neste passo.

```
bash "<pasta desta skill>/scripts/picker/start-server.sh" --dados-dir "<DADOS>" --open
```

O comando devolve um JSON `{status, url, port, opened}`. A `url` não abre sozinha: a aba só entra pela chave que o `--open` carrega. Não cole a `url` no chat nem acrescente query a ela. Com `opened: true`, diga que a aba abriu no navegador. Com `opened: false` (sem tela gráfica, SSH, navegador que não respondeu), diga em uma frase que a aba não abriu neste ambiente e ofereça escolher pelo chat. Aba fechada, picker caído ou Windows: `references/comparador.md`. Depois de cada start, grave a tela desta rodada com nome novo.

Grave a tela em `DADOS/.picker/current/content/<tema-slug>.json`, nome novo a cada revisão. O JSON segue o contrato de `references/comparador.md`. Cada card tem Copiar (A, B, C…).

Depois que ele copia no navegador, leia `DADOS/.picker/current/state/events`: uma linha JSON por clique, campo `choice` com a letra; vale a **última** linha, porque ele pode mudar de ideia. O arquivo é zerado a cada tela gravada e a cada start, então leia só depois de gravar a tela desta rodada. O chat vale se ele digitar a letra.

Salve **todas** as variações em `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>/variacoes.md` (crie a pasta): uma seção por variação, com ângulo, categoria de hook e família de hook no cabeçalho dela e o texto integral abaixo. O picker some quando a sessão acaba; as descartadas ficam no arquivo.

O picker fica no ar até o fim: os passos 8 e 9 mostram o preview nele. O passo 8 o para quando não há ajuste; com ajuste, o passo 9.

Concluído quando o picker está no ar com uma opção por variação, o `variacoes.md` existe no disco com todas elas (ângulo, categoria e família por variação) e o usuário escolheu uma — pelo Copiar ou pelo chat.

### 8. Persista o escolhido

Preencha os `[campos]` com o dado real dele, mostre o preview final no picker (JSON de tela com uma opção só) e salve o texto em `DADOS/drafts/<AAAA-MM-DD>-<tema-slug>.md` — o texto exato do preview, pronto para colar. Crie a pasta `DADOS/drafts/` se ela ainda não existir. O preview morre com a sessão; o arquivo é o que ele encontra amanhã.

O arquivo tem **formato fixo**, porque é dele que o script tira o texto do post: primeiro as **linhas de contexto**, uma por linha e nesta ordem: `Tema:`, `Ângulo:`, `Hook:` (a categoria), `Inspiração:` (a empresa, ou "sem referência"), `Data:` e `Origem dos números:` (a origem de cada número do texto: `voz.md`, catálogo `<slug>` ou resposta do usuário em <data>). Depois vem uma linha sozinha com `---`, e do `---` até o fim do arquivo **só o texto do post**, exatamente como ele vai colar. Nenhum comentário seu depois da cerca.

Número cuja origem você não sabe apontar não entra no post: vira `[número a confirmar]` e vocês resolvem juntos antes de salvar (o script reprova enquanto o campo estiver lá).

Se a variação escolhida usa padrão diferente do que você anunciou no passo 1 (outro ângulo ou outra categoria de hook), **diga isso em uma frase ao salvar** — "você levou a história de cliente, não o padrão de pergunta da Cetro que eu tinha proposto". Não é erro, é registro.

Antes de dar por pronto, rode `node "<pasta desta skill>/scripts/checar-formato.js" "<DADOS>/drafts/<AAAA-MM-DD>-<tema-slug>.md" --voz "<DADOS>/voz.md"` no arquivo salvo. Avisos seguem a regra do passo 5: viram conversa e não impedem salvar.

Com o arquivo salvo, rode `node "<pasta desta skill>/../profills-setup/scripts/mapa.js" "<DADOS>"`, que atualiza o resumo da pasta em `<DADOS>/CLAUDE.md`; se ele não voltar `ok: true`, avise em uma frase que o resumo não foi atualizado e siga.

Concluído quando o arquivo existe no disco no formato acima, o script devolve `ok: true` nele, os avisos foram conversados, e as linhas de contexto trazem ângulo, categoria de hook e a origem de cada número. Se ele deu o post por fechado sem pedir ajuste, pare o picker aqui com o comando do passo 9.

### 9. Ajuste o que ele pedir

Pedidos de iteração ("encurta o 2", "troca o gancho", "deixa mais direto") mexem só no trecho afetado: grave um JSON de tela **com nome novo** em `DADOS/.picker/current/content/` e reescreva o rascunho já salvo no passo 8, no mesmo arquivo.

Quando ele der o post por fechado, pare o picker:

```
bash "<pasta desta skill>/scripts/picker/stop-server.sh" --dados-dir "<DADOS>"
```

Concluído quando o picker mostrou o ajuste, o arquivo em `DADOS/drafts/` bate com ele, o `checar-formato.js` volta `ok: true` no arquivo reescrito e o picker foi parado.

## Restrições de formato (LinkedIn)

O que é medido está no `scripts/checar-formato.js` (passos 5, 8 e 9); use os números que ele devolve.

O que **você julga**, porque o script não julga:

- Link no comentário, não no corpo — o script pega o link; convencer o usuário a mover é com você.
- **O LinkedIn não renderiza markdown.** Destaque é caractere unicode (𝗮𝘀𝘀𝗶𝗺) — `**asteriscos**` saem literais no feed. Use com muita parcimônia e nunca no hook: leitor de tela não lê unicode bold, e busca não o indexa.
- Ritmo de leitura no celular: quebras frequentes, frase curta seguida de frase que explica.
