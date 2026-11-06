<!-- profills:fixo:inicio -->
# Pasta de dados da Profills

Esta pasta guarda o trabalho de LinkedIn de um comercial da Profills: as empresas que ele acompanha, o que elas postam, a voz dele e os rascunhos de post. Quem usa é o comercial, não um programador. Fale com ele em pt-BR, em linguagem simples, um passo por vez, e explique o que vai fazer antes de fazer.

## Qual skill usar

| Pedido do comercial | Skill |
|---|---|
| Instalar, conferir ou atualizar as skills e esta pasta | `profills-setup` |
| Criar ou ajustar o arquivo de voz ("não soa como eu") | `profills-voz` |
| Escolher, incluir ou rever as empresas acompanhadas | `profills-radar` |
| Navegador não abre, abriu no outro PC, extensão faltando | `profills-navegador` |
| Ver o que as empresas andam postando | `profills-garimpo` |
| Escrever um post | `profills-post` |

O caminho comum é voz, radar, garimpo e post. Cada skill lê o que a anterior gravou nesta pasta, então use a skill em vez de refazer o trabalho dela à mão.

## Regras

- O LinkedIn é só leitura: abrir páginas e ler posts no navegador logado do comercial, com pausas de segundos entre uma rolagem e outra, como uma pessoa faz. Nada de curtir, comentar, publicar nem mandar mensagem. Por sessão, dezenas de páginas, não centenas.
- Login pedido, captcha ou aviso de "atividade incomum" encerram a coleta na hora: pare e avise o comercial, sem tentar contornar. Um catálogo parcial é melhor que uma conta sinalizada.
- Não proponha scraper, API nem serviço de raspagem (Firecrawl, Apify e parecidos) para ler o LinkedIn. Ler pelo navegador logado é decisão da Profills, explicada no `references/compliance.md` da skill `profills-garimpo`, não uma limitação a resolver.
- O bloco "Estado da pasta" abaixo é gerado pelo script `scripts/mapa.js` da skill `profills-setup`. As skills atualizam esse bloco ao terminar; não edite à mão nem ele nem este bloco de regras.
- Quando o comercial pedir para lembrar uma decisão da equipe, acrescente uma linha em "Notas da equipe", no fim deste arquivo, no formato `- AAAA-MM-DD: <decisão>`. Nunca apague nem reescreva uma nota; se uma decisão nova substitui outra, escreva a nova dizendo que substitui. Nunca escreva nas notas as linhas de marcação `<!-- profills:... -->` que delimitam os blocos acima.
- Número que vai para um post sai de um arquivo desta pasta ou de uma resposta do comercial. Número sem origem não entra.

## Onde fica cada coisa

| Caminho | O que guarda | Quem grava |
|---|---|---|
| `refs/INDEX.md` | A lista de empresas, uma linha por empresa | `profills-radar` (a garimpo só marca a data do catálogo) |
| `refs/<empresa>.md` | A ficha de cada empresa, com o que não copiar dela | `profills-radar`, `profills-garimpo` |
| `catalog/raw/<empresa>/<data>/` | Os posts coletados num dia (`posts.json`) e o contexto da página (`meta.json`) | `profills-garimpo` |
| `catalog/<empresa>.md` e `catalog/_summary.md` | O perfil de cada empresa e o comparativo entre elas | `profills-garimpo` |
| `drafts/` | Os posts escritos, um arquivo por post, e as variações de cada um | `profills-post` |
| `boletins/` | Reservada para boletins; nenhuma skill grava aqui ainda | nenhuma |
| `voz.md` | O que o comercial vende, para quem e como ele fala | `profills-voz` |
| `.profills.json` | A versão do formato desta pasta | `profills-setup` |
| `.backup/` | Cópias guardadas antes de cada atualização da pasta | `profills-setup` |
<!-- profills:fixo:fim -->

<!-- profills:mapa:inicio -->
## Estado da pasta

Estado em 2026-11-06. Gerado pelo `mapa.js` a partir dos arquivos desta pasta; não edite à mão.

- Versão da pasta: 2.
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
