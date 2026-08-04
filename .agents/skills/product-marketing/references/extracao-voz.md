# Extração de voz — do material bruto aos marcadores

## Fontes, da mais forte à mais fraca

A regra: **quanto menos editado, mais voz.** Edição lixa exatamente os marcadores que você procura.

1. **Fala transcrita** — áudio de WhatsApp, gravação de call/reunião, vídeo dele falando. O padrão-ouro: ninguém edita a própria fala.
2. **Mensagem escrita no calor** — WhatsApp/e-mail real para cliente ou fornecedor. Escrita, mas espontânea.
3. **Post antigo dele** (LinkedIn, Instagram) — já é performance, mas performance *dele*.
4. **Texto editado** — site, catálogo, apresentação. Sinal fraco: costuma ser a voz de quem escreveu o site, não a dele. Use só para Identidade e Provas, não para voz.

Peça sempre pelo topo da lista. "Me manda um áudio de 1 minuto explicando o que a empresa faz, como se eu fosse um cliente interessado" resolve na maioria dos casos — é mais fácil para o usuário do que procurar material antigo.

## Marcadores a extrair

Para cada categoria, anote o achado **com o trecho-recibo** do material:

| Marcador | O que observar |
|---|---|
| **Vocabulário próprio** | Palavras/expressões que ele repete; jargão do setor que ele usa com naturalidade; gíria ou interjeição característica |
| **Vocabulário ausente** | O que ele *nunca* diz — anglicismo corporativo, formalidade de ofício, diminutivo. A ausência define a voz tanto quanto a presença |
| **Frase** | Curta e cortada ou longa e encadeada? Pergunta retórica? Reticência? |
| **Abertura e fechamento** | Como ele começa uma explicação (direto no assunto? contexto antes?) e como termina (convite? resumo? piada?) |
| **Emoji e pontuação** | Usa? Quais? Exclamação dupla? Tudo minúsculo? |
| **Metáforas** | De que mundo vêm as comparações dele (chão de fábrica, futebol, família, números)? |
| **Pessoa** | "Eu", "a gente", "nós da [empresa]"? |

## O anti-perfil

Tão importante quanto capturar o que ele é: registrar o que ele **não** é. Duas listas no arquivo final:

- **Palavras banidas** — termos que ele nunca usa (extraídos por ausência no material + rejeições na validação). É a lista que o quality gate da `linkedin-draft` checa em todo rascunho. Prevenir é mais barato que corrigir: uma vez listada, a palavra não volta.
- **Isso não sou eu** — construções, tons e clichês que ele rejeitou ("frase de coach", "muito formal", "parece vendedor de curso"). Cada entrada com o exemplo concreto que foi rejeitado.

## Validação — mostrar, não perguntar

Monte 2-3 frases de teste na voz extraída (uma de abertura de post, uma de explicação, uma de fechamento) e pergunte **sobre partes específicas**:

- "Você usaria a palavra *robusta* para falar da máquina?"
- "Essa abertura — 'Semana passada um cliente me perguntou...' — soa como você começaria?"

Pergunta vaga ("ficou bom?") colhe resposta vaga ("ficou ótimo") e o erro só aparece no primeiro rascunho rejeitado. Cada rejeição da validação já alimenta o anti-perfil antes de o arquivo estrear.
