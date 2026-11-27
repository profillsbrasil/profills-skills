# Compliance — dirigindo a conta real num site que proíbe automação

Logar na conta pessoal vincula o usuário ao User Agreement do LinkedIn (Seção 8.2), que proíbe qualquer automação — inclusive leitura/scraping. O precedente *hiQ v. LinkedIn* cobre só dado público **sem** login; não protege uma sessão autenticada. O risco real, para uso pessoal de baixo volume e navegação passiva, é de conta (checkpoint, restrição temporária), não criminal — mas não é zero. Estes guarda-corpos reduzem o risco; não o eliminam.

## Regras

- **Ritmo humano.** Pausas de segundos entre rolagens e entre empresas, nunca uma cadência fixa de robô.
- **Só leitura.** Nunca curtir, comentar, conectar ou publicar. O que a skill produz é rascunho; publicar é sempre o usuário, à mão.
- **Sem burlar proteção.** Authwall, captcha, "atividade incomum" → parar a sessão e avisar. Não contornar login-wall nem bot-detection.
- **Linhagem.** Cada post coletado guarda `url` + `data` da coleta. Todo dado é rastreável à sua fonte.
- **Volume por sessão: dezenas de páginas, não centenas.** Regras abaixo, em [Tamanho da rodada](#tamanho-da-rodada).
- **Pare na detecção.** Qualquer sinal de restrição encerra a coleta na hora. Melhor um catálogo parcial que uma conta sinalizada.

## Tamanho da rodada

A seleção da `profills-radar` traz até 12 empresas. Na janela padrão, cada empresa custa os passos de `navegacao.md`: uma navegação até `/company/<slug>/posts/`, a troca para Recentes, a extração e poucas rolagens ("na janela padrão raramente precisa rolar muito"), com pausas de segundos entre elas. Doze empresas somam dezenas de páginas, e por isso uma rodada de 12 cabe numa sessão em ritmo humano.

Divida em sessões quando:

- a rodada passa de 12 empresas;
- a janela é ampliada para várias empresas, porque cada uma rola o feed por semanas e multiplica as páginas;
- o LinkedIn dá qualquer sinal (lentidão anormal, captcha, aviso de atividade, pedido de login fora de hora). Aqui a coleta para na hora, pela regra acima, e o resto fica para outro dia.

Ao dividir, as empresas de prioridade Alta vão na primeira sessão, e as outras na seguinte. A prioridade é o campo `prioridade` da linha da empresa em `DADOS/refs/INDEX.md`.

**Tempo para avisar o usuário.** Não existe medição do tempo por empresa. A conta abaixo é estimativa e vai dita como estimativa: na janela padrão, de 3 a 5 minutos por empresa, contando as pausas. Multiplique pelo número de empresas da rodada (12 empresas dão de 36 a 60 minutos). Na janela ampliada, diga só que demora mais, sem número.

## Por que não um scraper ou a API

Não é preguiça de arquitetura — é a opção mais defensável para o caso. A API oficial não lê posts de empresas de terceiros (exige ser admin). Scrapers pagos (Firecrawl, Browserbase, Apify) violam o ToS igual e o próprio repositório de origem os marca como proibidos para LinkedIn. O navegador real logado, em ritmo humano e só lendo, é o que a comunidade considera pragmático para 5-20 empresas checadas periodicamente.
