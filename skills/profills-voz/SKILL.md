---
name: profills-voz
description: >-
  Cria e mantém DADOS/voz.md — o que o usuário vende, para quem e como
  ele fala. Use para "criar/atualizar meu arquivo de voz", quando a
  profills-post não encontra o arquivo, ou quando um rascunho "não soa
  como eu".
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-voz

Você monta o **arquivo de voz**: `DADOS/voz.md`, o retrato de quem o usuário é por escrito — o que vende, para quem, e como fala. É o insumo que faz a `profills-post` soar como ele, e não como a empresa de referência. O princípio que rege tudo aqui: **voz se mostra, não se descreve**. Ninguém sabe descrever a própria voz ("sou informal mas profissional" não diz nada); mas qualquer mensagem de WhatsApp que a pessoa mandou para um cliente mostra a voz inteira.

Quem usa isto é o **comercial, não dev**: ele não sabe que esse arquivo existe nem por que importa. Diga em uma frase o que você vai fazer ("é o que faz os posts saírem com a sua cara, monto em 10 minutos"), conduza um passo por vez e peça sempre o exemplo concreto — o áudio, a mensagem, o print.

## 0. Localize os dados e escolha a branch

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

Confira se o arquivo já existe antes de decidir o que fazer: `test -f "<DADOS>/voz.md"` no Bash, `Test-Path "<DADOS>\voz.md"` no PowerShell (`<DADOS>` é o caminho que a regra acima resolveu).

- Arquivo ausente → [Criar](#criar).
- Arquivo existe e o pedido é sobre um **fato** ("atualiza", "adiciona esse case", "fechamos o cliente 50", "produto novo") → [Atualizar](#atualizar).
- Arquivo existe e um rascunho foi rejeitado por **voz** ("não soa como eu", "eu nunca falaria assim") → [Calibrar](#calibrar).

Concluído quando você sabe se o arquivo existe e qual das três branches está seguindo.

## Criar

### 1. Peça o material bruto

Peça o mais bruto que ele tiver: quanto menos editado, mais voz. A escala das fontes, da mais forte à mais fraca, e a frase pronta para pedir cada uma estão em `references/extracao-voz.md` — um áudio de 1 minuto resolve a maioria dos casos, e dois ou três exemplos bastam. Ofereça as opções com `AskUserQuestion`, em linguagem simples, com a recomendada e o porquê.

Concluído quando você tem em mãos 2-3 amostras do material dele. Se ele não tiver nada agora, peça que grave o áudio de 1 minuto na hora; se nem isso der, siga com o que ele contar, avise que a voz sai inferida e marque cada traço como hipótese a confirmar no passo 5.

### 2. Extraia os marcadores de voz

Percorra o material com a tabela de marcadores de `references/extracao-voz.md`. Cada achado carrega o **trecho-recibo** do material — traço sustentado por trecho é medida; traço sem trecho é palpite seu e entra marcado como hipótese.

Concluído quando cada marcador da tabela tem achado com recibo, hipótese declarada, ou está explicitamente vazio.

### 3. Complete com a entrevista curta

Pergunte só o que o material não mostrou:

- **Identidade** — o que vende, quem decide a compra, as dores desse comprador, o diferencial.
- **Provas** — pergunte "quantos?" e "desde quando?" até virar número. "40 clientes desde 2023" entra; sem número confirmado, o campo fica `[a confirmar]` e a `profills-post` pede depois.
- **Eixos de tom** (sério↔leve, formal↔casual, reverente↔irreverente, entusiasmado↔direto) — um `AskUserQuestion` por eixo, com **duas frases-exemplo concretas** como opções (uma de cada extremo, escritas com o vocabulário dele) e a recomendação que você inferiu do material, com o porquê. Voz reconhecível mora perto dos extremos; se ele ficar no meio nos quatro, mostre o par de frases de novo e pergunte qual delas ele mandaria hoje para um cliente.
- **Tom por contexto e linguagem do cliente** — preencha do próprio material; o que ele não mostrar vira uma pergunta concreta ("como você comemora uma entrega no grupo do WhatsApp?"). A linguagem do cliente sai do mesmo áudio de venda: como o **cliente** chama o produto, a dor e o resultado.

Se outra skill já colheu tom, público ou produto (a `profills-post` faz isso quando o usuário adia a voz), aproveite as respostas que já existem e pule essas partes.

Concluído quando as oito seções do template têm resposta real ou um `[a confirmar]` declarado.

### 4. Escreva o arquivo

Grave `DADOS/voz.md` seguindo `assets/voz-template.md`. Cada traço de voz no formato falseável **"X, mas nunca Y"** ("direto, mas nunca seco") — adjetivo solto ("amigável") não sobrevive ao uso.

Concluído quando o arquivo está em disco, nenhum `<placeholder>` do template sobrou, todo traço tem o "mas nunca" com o trecho-recibo ao lado, as quatro linhas de **Tom por contexto** têm frase real, e toda prova tem número ou `[a confirmar]`. Escrito ainda não é pronto — falta a validação.

### 5. Valide mostrando

Escreva 2-3 frases de teste na voz montada (uma abertura de post, uma explicação, um fechamento) e pergunte sobre cada uma, específico: "você usaria a palavra *robusta* para falar da máquina?", "essa abertura — 'Semana passada um cliente me perguntou…' — soa como você começaria?". Pergunta específica colhe correção; "ficou bom?" colhe "ficou ótimo". Cada rejeição vira entrada no arquivo: palavra em **Palavras banidas** com a data, construção ou tom em **Isso não sou eu** com o exemplo rejeitado e a data.

Concluído quando as frases de teste foram julgadas uma a uma, o arquivo gravado já inclui as rejeições, e há **≥3 palavras banidas confirmadas por ele**. Se ele aprovar tudo, chegue nas três perguntando direto ("alguém do setor escreveria 'solução robusta' — você escreveria?").

## Atualizar

Pedido pontual sobre um fato: novo case, número atualizado, produto novo.

1. Edite só a seção que o fato toca e preserve o resto. Prova substituída fica na mesma linha com a data, no formato do template (`~~40 clientes ativos desde 2023~~ → 50 clientes ativos (atualizado 2026-08-24)`) — histórico é prova de consistência.
2. Atualize o cabeçalho do arquivo com a data de hoje (`atualizado em <AAAA-MM-DD>`).
3. Mostre ao usuário o antes/depois da linha mexida. Número ambíguo ("uns 50") volta como pergunta antes de entrar.

Concluído quando a alteração está gravada em `DADOS/voz.md`, o cabeçalho registra a data e o usuário viu o antes/depois.

Pedido sobre *voz*, e não sobre fato → [Calibrar](#calibrar).

## Calibrar

Um rascunho foi rejeitado por voz. Essa rejeição é o único pedaço medido do arquivo — o resto é inferido do material —, então grave-a inteira.

1. Pergunte **qual palavra ou frase** doeu, específico ("foi 'solução robusta' ou o tom da abertura?").
2. Grave: palavra rejeitada em **Palavras banidas** com a data; construção ou tom em **Isso não sou eu** com o exemplo rejeitado e a data; traço "X, mas nunca Y" que se mostrou errado, reescrito.
3. Atualize o cabeçalho com a data de hoje e mostre a ele a linha que entrou, dizendo que é isso que faz o próximo rascunho errar menos.

Concluído quando a rejeição está gravada em `DADOS/voz.md`, o cabeçalho registra a data e o usuário viu a linha nova.

## Próximo passo

- **Outra skill invocou você** (a `profills-post`, porque `DADOS/voz.md` não existia): diga em uma frase onde salvou e devolva o controle — o rascunho que ele pediu continua de onde parou, sem sugestão sua.
- **O usuário chamou você**: feche com **uma** sugestão só — "salvei em `<caminho>`; agora, quando eu escrever um post, ele já sai com a sua cara — quer testar com `/profills-post`?".

## Guarda-corpo

Na dúvida entre o que soa melhor e o que ele de fato falaria, ganha o que ele falaria.
