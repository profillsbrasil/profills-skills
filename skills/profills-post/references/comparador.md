# Preview realista de feed

Cada opção é renderizada como um **post real do LinkedIn**: foto do perfil, nome, o texto com o corte do "…mais", o espaço da foto, a barra de reações. Este arquivo é a mecânica disso.

## Use o template — não escreva o HTML do zero

O card já existe, testado, em **`assets/preview-template.html`** (dentro desta skill). Escrever o HTML na mão a cada sessão reintroduz exatamente os erros que o template elimina: corte do "…mais" no lugar errado, visual que muda de uma rodada pra outra, SVG quebrado. O trabalho é **preencher, não desenhar**:

1. Copie o template para o scratchpad com `cp` — **um arquivo por artefato** (ex. `linkedin-opcoes.html`, `linkedin-post-final.html`). O caminho do arquivo é o que dá a URL do artefato: republicar do mesmo caminho mantém a URL, um caminho novo cria outro artefato.
2. Leia **só o topo** da cópia (Read com `limit: 75`): ali estão as instruções de preenchimento, o `EXEMPLO` de formato e a linha-marcador. As ~250 linhas restantes são o motor, e ler tudo desperdiça ~4k tokens de input.
3. Siga o cabeçalho do próprio template para preencher e substitua com Edit **apenas a linha `const DADOS = EXEMPLO;`**.
4. Carregue a skill `artifact-design` (a tool Artifact exige) e publique com a tool **Artifact**.

### Campos do `DADOS` que o cabeçalho do template não explica

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
7. **Modo de 1 item** — o preview final: traz stats, dica do gancho e o botão "Copiar o texto".

## Regras

- **O texto do preview é o post final** — o que ele vê é o que ele publica (fora os `[campos]`).
- **Nada de auto-publicar** — o preview mostra; publicar no LinkedIn é o usuário.
