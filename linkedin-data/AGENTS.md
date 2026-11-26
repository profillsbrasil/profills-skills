<!-- profills:fixo:inicio -->
# Pasta de dados da Profills

Esta pasta guarda o trabalho de LinkedIn de um comercial da Profills: as empresas que ele acompanha, o que elas postam, a voz dele e os rascunhos de post. Este arquivo é o `AGENTS.md` da pasta: o Codex o lê direto, e o Claude Code o lê pelo `CLAUDE.md` ao lado, que só traz a linha `@AGENTS.md`. Quem usa é o comercial, não um programador. Fale com ele em pt-BR, em linguagem simples, um passo por vez, e explique o que vai fazer antes de fazer.

## Qual skill usar

| Pedido do comercial | Skill |
|---|---|
| Instalar, conferir ou atualizar as skills e esta pasta | `profills-setup` |
| Criar ou ajustar o arquivo de voz ("não soa como eu") | `profills-voz` |
| Escolher, incluir ou rever as empresas acompanhadas | `profills-radar` |
| Navegador não abre, abriu no outro PC, extensão faltando | `profills-navegador` |
| Ver o que as empresas andam postando | `profills-garimpo` |
| Ver o que os concorrentes fizeram desde a última coleta | `profills-boletim` |
| Escrever um post | `profills-post` |

O caminho comum é voz, radar, garimpo e post. O boletim chama a radar e a garimpo por você e termina com pautas que a post usa. Cada skill lê o que a anterior gravou nesta pasta, então use a skill em vez de refazer o trabalho dela à mão.

## Regras

- O LinkedIn é só leitura: abrir páginas e ler posts no navegador logado do comercial, com pausas de segundos entre uma rolagem e outra, como uma pessoa faz. Curtir, comentar, conectar, publicar e mandar mensagem ficam fora: a sessão só lê. Por sessão, dezenas de páginas, não centenas.
- Login pedido, captcha ou aviso de "atividade incomum" encerram a coleta na hora: pare e avise o comercial, sem tentar contornar. Um catálogo parcial é melhor que uma conta sinalizada.
- Não proponha scraper, API nem serviço de raspagem (Firecrawl, Apify e parecidos) para ler o LinkedIn. Ler pelo navegador logado é decisão da Profills, explicada no `references/compliance.md` da skill `profills-garimpo`, não uma limitação a resolver.
- O bloco "Estado da pasta" abaixo é gerado pelo script `scripts/mapa.js` da skill `profills-setup`. As skills rodam o script ao terminar, e os dois blocos, o "Estado da pasta" e este de regras, só mudam por ele; o que o comercial quiser registrar vai em "Notas da equipe".
- Quando o comercial pedir para lembrar uma decisão da equipe, acrescente uma linha em "Notas da equipe", no fim deste arquivo (o `AGENTS.md`; o `CLAUDE.md` fica só com o import), no formato `- AAAA-MM-DD: <decisão>`. Nunca apague nem reescreva uma nota; se uma decisão nova substitui outra, escreva a nova dizendo que substitui. Nunca escreva nas notas as linhas de marcação `<!-- profills:... -->` que delimitam os blocos acima.
- Número que vai para um post sai de um arquivo desta pasta ou de uma resposta do comercial. Número sem origem não entra.

## Onde fica cada coisa

| Caminho | O que guarda | Quem grava |
|---|---|---|
| `refs/INDEX.md` | A lista de empresas, uma linha por empresa | `profills-radar` |
| `refs/<empresa>.md` | A ficha de cada empresa, com o que não copiar dela | `profills-radar`, `profills-garimpo` |
| `catalog/raw/<rede>/<empresa>/<data>/` | Os posts coletados num dia (`posts.json`) e o contexto da página (`meta.json`), numa pasta por rede social (`linkedin`, `instagram`) | `profills-garimpo` |
| `catalog/<empresa>.md` e `catalog/_summary.md` | O perfil de cada empresa e o comparativo entre elas | `profills-garimpo` |
| `drafts/` | Os posts escritos, um arquivo por post, e as variações de cada um | `profills-post` |
| `boletins/` | Um boletim por dia: novidades dos concorrentes, cobertura e 3 pautas | `profills-boletim` |
| `voz.md` | O que o comercial vende, para quem e como ele fala | `profills-voz` |
| `AGENTS.md` e `CLAUDE.md` | Estas instruções, que o Claude Code e o Codex leem ao abrir a pasta; o `CLAUDE.md` só importa o `AGENTS.md` | o `mapa.js` da `profills-setup` |
| `.profills.json` | A versão do formato desta pasta | `profills-setup` |
| `indice.db` | O banco de consultas, montado destes arquivos; apagar não perde nada | o `banco.js` do plugin, que o refaz quando falta ou está velho |
| `.backup/` | Cópias guardadas antes de cada atualização da pasta | `profills-setup` |
<!-- profills:fixo:fim -->

<!-- profills:mapa:inicio -->
## Estado da pasta

Estado em 2026-11-26. Gerado pelo `mapa.js` a partir dos arquivos desta pasta; não edite à mão.

- Versão da pasta: 4.
- Empresas no índice: 6 (prioridade a definir: 6). Sem página no LinkedIn: 0.
- Problemas no índice: nenhum.
- Última coleta: 2026-07-14, com 5 empresa(s).
- Último rascunho: nenhum ainda.
- Voz: `voz.md` não existe; a `profills-post` chama a `profills-voz` antes do primeiro post.
- Pendências:
  - "Do Not Copy" vazio em 6 ficha(s): `cetromaquinas`, `maqinox-ind-stria-de-maquinas`, `skymsen`, `sulpack-industria-de-maquinas-para-embalagens`, `tecnoenvase-maquinas-e-equipamentos-ltda`, `tecnox-do-brasil`. A `profills-garimpo` pergunta ao fim do catálogo, e a `profills-post` antes de escrever.
  - Pesquisa com mais de 60 dias em 6 empresa(s): `cetromaquinas`, `maqinox-ind-stria-de-maquinas`, `tecnoenvase-maquinas-e-equipamentos-ltda`, `tecnox-do-brasil`, `skymsen`, `sulpack-industria-de-maquinas-para-embalagens`. A `profills-radar` atualiza.
<!-- profills:mapa:fim -->

## Notas da equipe

Decisões que a equipe pediu para lembrar, uma por linha, com a data.
