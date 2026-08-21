---
name: profills-voz
description: >-
  Cria e mantém o arquivo de voz do usuário (DADOS/voz.md) — o
  que ele vende, para quem, e como ele fala de verdade. Use quando o usuário
  pedir para "criar/atualizar meu arquivo de voz" ou "product marketing", quando
  a profills-post ou a profills-garimpo não encontrarem o arquivo, ou quando o
  usuário reclamar que um rascunho "não soa como eu".
metadata:
  version: 0.1.0
  author: othavio
  license: MIT
---

# profills-voz

Você monta o **arquivo de voz**: `DADOS/voz.md`, o retrato de quem o usuário é por escrito — o que vende, para quem, e como fala. É o insumo que faz a `profills-post` soar como ele, e não como a empresa de referência. O princípio que rege tudo aqui: **voz se mostra, não se descreve**. Ninguém sabe descrever a própria voz ("sou informal mas profissional" não diz nada); mas qualquer mensagem de WhatsApp que a pessoa mandou para um cliente mostra a voz inteira.

**Pasta de dados (`DADOS`)**: se o diretório atual está num repo git com `linkedin-data/` na raiz (`git rev-parse --show-toplevel`), `DADOS` é essa pasta; senão é `~/Profills LinkedIn/`. Se nenhuma das duas existe, invoque a skill `profills-setup` — ela cria a pasta e confere o resto da instalação.

## Escolha a branch

- **Arquivo não existe** → siga [Criar](#criar).
- **Usuário quer mexer** ("atualiza", "adiciona esse case", "muda o tom") → siga [Atualizar](#atualizar).
- **Rascunho rejeitado por voz** ("não soa como eu", "eu nunca falaria assim") → siga [Calibrar](#calibrar).

## Criar

1. **Peça material bruto, na ordem de força do sinal.** Quanto menos editado o material, mais voz ele carrega — nota escrita e texto institucional filtram exatamente os marcadores que você procura. Peça pelo mais forte que ele tiver, descendo a lista de `references/extracao-voz.md`: áudio/transcrição de conversa real > mensagem de WhatsApp/e-mail para cliente > post antigo dele > texto do site. Dois ou três exemplos bastam. Use `AskUserQuestion` para oferecer as opções em linguagem simples ("me manda um áudio explicando o que você vende, como se eu fosse um cliente" costuma ser o caminho mais fácil).

2. **Extraia os marcadores de voz** do material seguindo `references/extracao-voz.md`: vocabulário que ele usa (e o que nunca usa), tamanho de frase, como abre e fecha, uso de emoji, metáforas do mundo dele. Marque cada achado com o trecho-recibo do material.

3. **Complete com a entrevista curta** — só o que o material não mostrou. Identidade (o que vende, para quem, a dor que resolve), provas reais (números, casos, prazos — pergunte "quantos?" e "desde quando?" até virar número), e o posicionamento nos 4 eixos de tom (sério↔leve, formal↔casual, reverente↔irreverente, entusiasmado↔direto). Respostas todas no meio dos eixos produzem voz sem graça — se ele hesitar, provoque com exemplos concretos dos dois extremos.

4. **Escreva o arquivo** em `DADOS/voz.md` seguindo `assets/voz-template.md`. Cada traço de voz no formato falseável **"X, mas nunca Y"** ("direto, mas nunca seco") — adjetivo solto ("amigável") não sobrevive ao uso. O arquivo está escrito quando: todo traço tem o "mas nunca", a lista de banidas tem ≥5 entradas vindas do material real, e toda prova tem número. Escrito ainda não é pronto — falta a validação.

5. **Valide mostrando, não perguntando.** Escreva 2-3 frases de teste na voz montada e pergunte sobre cada uma, específico: "você usaria a palavra X?", "essa frase parece sua?". "Ficou bom?" só gera resposta vaga. O que ele rejeitar vira entrada da seção **Isso não sou eu**.

## Atualizar

Pedido pontual: novo case, número atualizado, produto novo. Edite a seção certa preservando o resto; provas antigas substituídas descem para um comentário com a data, não somem. Se a mudança é de *voz* (não de fato), trate como [Calibrar](#calibrar).

## Calibrar

Um rascunho foi rejeitado por voz — isso é dado, não fracasso. Pergunte **qual palavra ou frase** doeu (específico, não "o que achou?"). A resposta alimenta o arquivo: palavra rejeitada entra em **Palavras banidas**; construção rejeitada entra em **Isso não sou eu**; e se um traço "X, mas nunca Y" se mostrou errado, reescreva-o. O arquivo melhora a cada rejeição — diga isso ao usuário.

## Conduza pela mão

Quem usa isto é o **comercial, não dev**. Ele não sabe que esse arquivo existe nem por que importa — explique em uma frase ("é o que faz os posts saírem com a sua cara, monto em 10 minutos") e conduza um passo por vez. Nunca peça "descreva sua brand voice"; peça o áudio, a mensagem, o exemplo.

## Guarda-corpos

- **Todo traço tem recibo.** Voz afirmada sem trecho do material que a sustente é palpite seu — marque como hipótese ou pergunte.
- **Prova é número real do usuário.** "Muitos clientes" não entra; "40 clientes desde 2023" entra. Sem número confirmado, o campo fica com `[a confirmar]` — a `profills-post` sabe pedir depois.
- **O arquivo é dele, não seu.** Na dúvida entre o que soa melhor e o que ele de fato falaria, ganha o que ele falaria.
