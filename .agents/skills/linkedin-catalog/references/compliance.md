# Compliance — dirigindo a conta real num site que proíbe automação

Logar na conta pessoal vincula o usuário ao User Agreement do LinkedIn (Seção 8.2), que proíbe qualquer automação — inclusive leitura/scraping. O precedente *hiQ v. LinkedIn* cobre só dado público **sem** login; não protege uma sessão autenticada. O risco real, para uso pessoal de baixo volume e navegação passiva, é de conta (checkpoint, restrição temporária), não criminal — mas não é zero. Estes guarda-corpos reduzem o risco; não o eliminam.

## Regras

- **Ritmo humano.** Pausas de segundos entre rolagens e entre empresas, nunca uma cadência fixa de robô. Volume por sessão baixo — dezenas de páginas, não centenas.
- **Só leitura.** Nunca curtir, comentar, conectar ou publicar. O que a skill produz é rascunho; publicar é sempre o usuário, à mão.
- **Sem burlar proteção.** Authwall, captcha, "atividade incomum" → parar a sessão e avisar. Não contornar login-wall nem bot-detection.
- **Linhagem.** Cada post coletado guarda `url` + `data` da coleta. Todo dado é rastreável à sua fonte.
- **Volume moderado.** Se a seleção é grande, mantenha a janela padrão enxuta e espalhe empresas por sessões diferentes em vez de uma rajada só.
- **Pare na detecção.** Qualquer sinal de restrição encerra a coleta na hora. Melhor um catálogo parcial que uma conta sinalizada.

## Por que não um scraper ou a API

Não é preguiça de arquitetura — é a opção mais defensável para o caso. A API oficial não lê posts de empresas de terceiros (exige ser admin). Scrapers pagos (Firecrawl, Browserbase, Apify) violam o ToS igual e o próprio repositório de origem os marca como proibidos para LinkedIn. O navegador real logado, em ritmo humano e só lendo, é o que a comunidade considera pragmático para 5-20 empresas checadas periodicamente.
