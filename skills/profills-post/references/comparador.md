# Preview realista de feed

Cada opção é renderizada como um **post real do LinkedIn**: foto do perfil, nome, o texto com o corte do "…mais", o espaço da foto, a barra de reações, Copiar em cada card. Este arquivo é o contrato do JSON.

## Grave um JSON de tela — não desenhe HTML

O motor já existe em `scripts/picker/picker-frame.html`. Escrever HTML na mão reintroduz corte do "…mais" no lugar errado e visual que muda de rodada. O trabalho é **preencher o JSON**, não desenhar; o passo 7 do `SKILL.md` diz onde gravar e como ler a escolha.

Referência visual do card: abra `scripts/picker/picker-frame.html` cru no navegador (renderiza o `EXEMPLO`).

### Campos do JSON de tela

- `kicker` / `titulo` / `subtitulo` — o cabeçalho da página, escrito na linguagem do comercial.
- `empresa` — `nome`, `iniciais` (do avatar), `descricao`, `seguidores` (opcional).
- `opcoes[].texto` — o post completo da variação; o motor faz o corte do "…mais", não divida na mão.
- `opcoes[].angulo` + `opcoes[].porque` — o rótulo acima do card e a justificativa curta; só aparecem no modo comparador.
- `opcoes[].foto` + `fotoNota` — o que mostrar no espaço da imagem (ex. "foto da fábrica/equipe" / "puxa mais que texto"), ou `foto: null` para post sem imagem.

## Quando a aba não abre ou some

- **Aba fechada ou "não vejo nada"**: rode o mesmo `start-server.sh` de novo. `already_running` reabre a aba; `started` ou `replaced` quer dizer que o picker não estava no ar.
- **Todo start é uma rodada nova**: o script arquiva as telas em `content/.anterior/` e zera `events`, e a aba abre na página de espera até você gravar a tela. Grave a tela de novo, com nome novo.
- **Windows (Git Bash)**: o comando fica preso no terminal. Rode em background e leia a primeira linha do stdout, que é o mesmo JSON.

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
