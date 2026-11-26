---
name: profills-navegador
description: >-
  Seleciona e prepara o navegador do usuário (extensão Claude in Chrome ou
  ChatGPT) antes da primeira aba de cada sessão. Use antes de navegar
  (abrir um site, ler uma página, coletar posts), quando a aba "abriu no
  outro PC", quando a ferramenta do navegador não existe ou não responde, ou
  numa máquina sem a extensão. A profills-garimpo e a profills-radar invocam
  antes da primeira página; a profills-setup, para o teste.
metadata:
  version: 0.2.0
  author: othavio
  license: MIT
---

# profills-navegador

**Harness.** Antes do primeiro passo, leia uma vez por sessão o adaptador do harness em que você roda: `../../docs/harness/claude-code.md` no Claude Code, `../../docs/harness/codex.md` no Codex (os caminhos são relativos a este arquivo; na dúvida, leia os dois e use o que descreve as ferramentas que você tem). Cada intenção citada aqui, como `perguntar` ou `invocar-skill`, está lá com a ferramenta, o jeito de ver que ela falta e o que fazer sem ela.

Garante que a navegação aconteça no **navegador certo, pronto**, antes de qualquer aba. O usuário final é o comercial: conduza pela mão, sem jargão.

**O princípio**: toda página abre pela extensão no navegador do próprio comercial, o mesmo em que o LinkedIn e o Instagram dele estão logados, para usar os logins, os cookies e o cache que já existem ali. Busca por fetch, scraper, API ou navegador sem tela fica fora. No Claude Code a extensão é a **Claude in Chrome**; no Codex Desktop, a **extensão ChatGPT**. A escolha entre vários computadores e o cache em `~/.config/profills-navegador/browser` são do Claude in Chrome e estão no adaptador dele.

## Fluxo

1. **Estado da extensão** (intenção `navegador-pronto`): faça a detecção que o adaptador descreve. Ferramenta ausente, que não responde, ou nenhum navegador conectado é o estado **extensão ausente nesta máquina**: conduza `references/instalacao.md`, na parte do harness em que você roda.
   *Concluído quando* a extensão responde e você sabe quais navegadores estão conectados, ou o roteiro de instalação começou com o usuário.

2. **Navegador certo**: escolha o alvo pela regra do adaptador. Se o usuário acabou de dizer que a aba abriu no lugar errado, a correção dele vence qualquer escolha automática. Com mais de um candidato e nenhum sinal que desempate, pergunte (intenção `perguntar`), explicando antes em uma frase por que precisa saber, e termine a resposta na pergunta: nunca num fato consumado decidido por você. A escolha automática sempre vem anunciada em texto da resposta que o usuário lê ("abrindo no navegador deste computador — se a página não aparecer aí, me avisa"); se a frase não está no que ele lê, o passo não aconteceu.
   *Concluído quando* o navegador está selecionado e anunciado, ou a pergunta está na mesa.

3. **Prontidão, não fé**: abra **uma** aba própria (intenção `abrir-pagina`) e confirme que carregou lendo dado estruturado (intenção `ler-pagina`: a URL e o título da aba), nunca por captura de tela.
   *Concluído quando* o dado estruturado mostra a aba que você abriu com a URL carregada: a URL alvo quando o pedido tem uma, `about:blank` quando outra skill vai navegar em seguida.

   **Invocada pela `profills-setup`** para conferir a instalação, a prontidão é o "teste real" do fim de `references/instalacao.md` (abrir o LinkedIn, ler o título e a URL, fechar a aba), e o handoff traz o resultado: passou, LinkedIn deslogado nesse navegador, ou falhou e em qual passo.

4. **Handoff**: declare, campo a campo, o navegador (nome e identificador), o id da aba pronta e o que mais o adaptador manda declarar.
   *Concluído quando* esses campos aparecem literalmente na sua última mensagem; faltou um, o handoff não aconteceu. Invocada por outra skill, devolva o controle sem sugestão própria ("navegador pronto, voltando ao que você pediu"); chamada direto pelo usuário, feche com uma única sugestão de próximo passo.

## Disciplina de abas

Mexa apenas nas abas que **esta sessão** abriu, identificadas pelo id exato, e feche-as pela intenção `fechar-aba` quando o trabalho acabar. No Claude in Chrome, mantenha ao menos uma aba viva no grupo da sessão: fechar a última derruba o grupo inteiro (deixe uma `about:blank` no lugar).

## Só leitura

O navegador é do comercial, com as contas dele. Abrir página e ler é o trabalho; curtir, comentar, conectar, publicar e mandar mensagem ficam com ele. Login pedido, captcha ou aviso de "atividade incomum": pare e peça ao comercial, sem tentar contornar.
