# Preview realista de feed

Cada opção é renderizada como um **post real do LinkedIn**: foto do perfil, nome, o texto com o corte do "…mais", o espaço da foto, a barra de reações, Copiar em cada card. Este arquivo é o contrato do JSON. O HTML mora no picker local (`scripts/picker/`), não no Artifact.

## Grave um JSON de tela — não desenhe HTML

O motor já existe em `scripts/picker/picker-frame.html`. Escrever HTML na mão reintroduz corte do "…mais" no lugar errado e visual que muda de rodada. O trabalho é **preencher o JSON**, não desenhar:

1. Ligue o picker: `bash "<pasta desta skill>/scripts/picker/start-server.sh" --dados-dir "<DADOS>" --open`.
2. O JSON de stdout traz `opened`. `true`: a aba abriu. `false`: sem navegador aqui, escolha pelo chat. Não cole a `url` nem chave. Aba fechada ou picker caído: rode o comando de novo e grave a tela de novo (todo start arquiva a anterior).
3. Grave `DADOS/.picker/current/content/<nome>.json` com o objeto abaixo. Nome novo a cada revisão.
4. Depois que ele copia, leia `DADOS/.picker/current/state/events` (`choice` A/B/C, vale a última linha). O chat vale se ele digitar.

O `assets/preview-template.html` continua como referência visual do card. Não publique Artifact neste passo.

### Campos do JSON de tela

- `kicker` / `titulo` / `subtitulo` — o cabeçalho da página, escrito na linguagem do comercial.
- `empresa` — `nome`, `iniciais` (do avatar), `descricao`, `seguidores` (opcional).
- `opcoes[].angulo` + `opcoes[].porque` — o rótulo acima do card e a justificativa curta; só aparecem no modo comparador.
- `opcoes[].foto` + `fotoNota` — o que mostrar no espaço da imagem (ex. "foto da fábrica/equipe" / "puxa mais que texto"), ou `foto: null` para post sem imagem.

## O que o motor renderiza (pra você saber o que prometer)

1. **Cabeçalho de post** — avatar com monograma, nome + selo, descrição, "Agora · 🌐", "Seguir".
2. **Corte "…mais" realista** — o LinkedIn mostra ~2-3 linhas antes do "…mais". O motor corta em `LIMITE = 205` caracteres, em fronteira de palavra, sem partir `[campo]` ao meio; o "…mais" é clicável. Post com ≤215 caracteres aparece inteiro. Os dois números medem coisas diferentes: o script mede o **primeiro parágrafo** contra 210 (`limites.hook_max`); o motor do preview corta o **texto corrido** em 205. Se o preview cortar o hook no meio, é sinal de parágrafo longo demais — e o `paragrafo_longo` do script já acusa.
3. **Linha de corte** — a marca "↑ o que aparece antes do clique", que ensina ao usuário por que a primeira linha é tudo.
4. **`[campos]` realçados** — viram destaque automático; são os pontos que você preenche COM o usuário no passo 8.
5. **Espaço da foto** e **barra de reações** — para o card parecer real.
6. **Grid com folga** — 2 colunas em tela larga, 1 no mobile, tema claro/escuro. Nada disso precisa de ajuste seu.
7. **Copiar em cada card** — A, B, C… no comparador e no preview de um. Publicar no LinkedIn é o usuário.

## Regras

- **O texto do preview é o post final** — o que ele vê é o que ele publica (fora os `[campos]`).
- **Nada de auto-publicar** — o picker mostra e copia; publicar no LinkedIn é o usuário.
