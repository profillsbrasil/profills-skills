# Compliance — dirigindo a conta real num site que proíbe automação

A coleta lê o LinkedIn e o Instagram pela conta do próprio usuário, no navegador dele. As regras abaixo valem para as duas redes; o que é só do Instagram está em [Instagram](#instagram).

Logar na conta pessoal vincula o usuário ao User Agreement do LinkedIn (Seção 8.2), que proíbe qualquer automação — inclusive leitura/scraping. O precedente *hiQ v. LinkedIn* cobre só dado público **sem** login; não protege uma sessão autenticada. O risco real, para uso pessoal de baixo volume e navegação passiva, é de conta (checkpoint, restrição temporária), não criminal — mas não é zero. Estes guarda-corpos reduzem o risco; não o eliminam.

## Regras

- **Ritmo humano.** Pausas de segundos entre rolagens, entre posts abertos e entre contas, nunca uma cadência fixa de robô.
- **Só leitura.** Nunca curtir, comentar, seguir, conectar, salvar, compartilhar ou publicar. O que a skill produz é rascunho; publicar é sempre o usuário, à mão.
- **A conta é a do usuário.** A coleta usa a sessão que ele já tem aberta no navegador dele. Não crie conta, não troque de conta e não faça login por ele: tela de login é parada, e quem loga é ele.
- **Sem burlar proteção.** Authwall, captcha, "atividade incomum" → parar a sessão e avisar. Não contornar login-wall nem bot-detection.
- **Linhagem.** Cada post coletado guarda `url` + `data` da coleta. Todo dado é rastreável à sua fonte.
- **Volume por sessão: dezenas de páginas, não centenas, somando as duas redes.** Regras abaixo, em [Tamanho da rodada](#tamanho-da-rodada).
- **Pare na detecção.** Qualquer sinal de restrição encerra a coleta na hora. Melhor um catálogo parcial que uma conta sinalizada.

## Tamanho da rodada

O limite da rodada é de páginas, somando as duas redes. A conta é do `indice.js` da `profills-radar` (`PAGINAS_POR_CONTA` e `LIMITE_PAGINAS_POR_RODADA`), que monta a seleção dentro dele:

- **LinkedIn: 3 páginas por conta** na janela padrão, os passos de `navegacao.md`: uma navegação até `/company/<slug>/posts/`, a troca para Recentes, a extração e poucas rolagens ("na janela padrão raramente precisa rolar muito").
- **Instagram: 6 páginas por conta** na janela padrão, os passos de `navegacao-instagram.md`: o perfil e um post por página, até 5. Medido ao vivo: a grade do perfil não traz curtidas, comentários nem a data do reel, então cada post da janela é uma página.
- **Limite: 36 páginas por rodada**, as 12 empresas só com LinkedIn de antes do Instagram. Com Instagram cabem menos empresas: 4 com as duas redes, ou 6 só com Instagram.

Divida em sessões quando:

- a seleção passa do limite de páginas;
- a janela é ampliada para várias contas, porque cada uma rola o feed por semanas e multiplica as páginas; no Instagram, a ampliada abre um post por página por semanas, e vai em poucas contas por sessão;
- o LinkedIn ou o Instagram dão qualquer sinal (lentidão anormal, captcha, aviso de atividade, pedido de login fora de hora). Aqui a coleta das duas redes para na hora, pela regra acima, e o resto fica para outro dia.

Ao dividir, as empresas de prioridade Alta vão na primeira sessão, e as outras na seguinte. A prioridade é o campo `prioridade` da linha da empresa em `DADOS/refs/INDEX.md`.

**Tempo para avisar o usuário.** Não existe medição do tempo por conta. A conta abaixo é estimativa e vai dita como estimativa: na janela padrão, de 3 a 5 minutos por conta, contando as pausas, nas duas redes. Multiplique pelo número de contas da rodada (12 contas dão de 36 a 60 minutos). Na janela ampliada, diga só que demora mais, sem número.

## Instagram

Os Termos de Uso do Instagram também proíbem coletar dado por meio automatizado sem permissão, e logar vincula o usuário a eles como no LinkedIn. O risco é o mesmo, de conta, e os guarda-corpos acima valem iguais. O que o Instagram pede a mais:

- **Nada que deixe rastro para a empresa.** Story e destaque marcam quem viu: não se abrem. Mensagens diretas e notificações também não, porque são da conta pessoal do usuário e não da coleta.
- **Só perfil de empresa.** A coleta abre o perfil da empresa e os posts dela. Perfil de pessoa não se abre, nem o de quem comentou.
- **Comentário é contagem.** O catálogo guarda quantos comentários um post tem; o nome e o texto de quem comentou não entram em arquivo nenhum.
- **Endereço do post é `/p/<código>/`.** O endereço de reel leva a um feed de reels de outras contas, que não é a página que a coleta pediu (medido em `navegacao-instagram.md`).

## Por que não um scraper ou a API

Não é preguiça de arquitetura — é a opção mais defensável para o caso. A API oficial do LinkedIn não lê posts de empresas de terceiros (exige ser admin). Scrapers pagos (Firecrawl, Browserbase, Apify) violam o ToS igual e o próprio repositório de origem os marca como proibidos para LinkedIn. O navegador real logado, em ritmo humano e só lendo, é o que a comunidade considera pragmático para 5-20 empresas checadas periodicamente.
