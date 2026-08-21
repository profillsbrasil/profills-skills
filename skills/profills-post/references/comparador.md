# Preview realista de feed

Quem usa esta skill é o **comercial, não dev**. Ele precisa **ver como o post vai cair no feed** antes de publicar — não um card abstrato nem texto em monospace. Então cada opção é renderizada como um **post real do LinkedIn**: foto do perfil, nome, o texto com o corte do "…mais", o espaço da foto, a barra de reações. É "mostrar, não descrever" levado a sério.

## Use o template — não escreva o HTML do zero

O card já existe, testado, em **`assets/preview-template.html`** (dentro desta skill). Escrever o HTML na mão a cada sessão reintroduz exatamente os erros que o template elimina: corte do "…mais" no lugar errado, visual que muda de uma rodada pra outra, SVG quebrado. O trabalho é **preencher, não desenhar**:

1. Copie o template para o scratchpad com `cp` (um arquivo por artefato — ex. `linkedin-opcoes.html`, `linkedin-post-final.html`).
2. Leia **só o topo** da cópia (Read com `limit: 75` — cobre as instruções, o `EXEMPLO` de formato e a linha-marcador; as ~250 linhas restantes são o motor e ler tudo desperdiça ~4k tokens de input). Então substitua com Edit **apenas a linha `const DADOS = EXEMPLO;`** por `const DADOS = { …os seus dados, no formato do EXEMPLO… };`. Não toque no `EXEMPLO` nem em nada após "FIM DO BLOCO EDITÁVEL".
3. Carregue a skill `artifact-design` (a tool Artifact exige) e publique com a tool **Artifact**.

Nas iterações ("encurta o post 2", "troca o gancho"), edite só o trecho afetado dentro do seu `DADOS` e republique no mesmo caminho — a URL do artefato se mantém.

### O que vai no `DADOS`

- `kicker` / `titulo` / `subtitulo` — o cabeçalho da página, na linguagem do comercial.
- `empresa` — `nome`, `iniciais` (do avatar), `descricao`, `seguidores` (opcional).
- `opcoes[]` — **1 item = preview final** (stats, dica do gancho, botão "Copiar o texto"); **2+ itens = comparador lado a lado**, numerado na ordem da lista. Cada item:
  - `angulo` + `porque` — o rótulo acima do card e a justificativa curta (só aparecem no comparador).
  - `texto` — o post **completo**, num template literal (crases), com as quebras de linha reais. **Não divida o texto na mão**: o motor calcula o corte "…mais" sozinho.
  - `foto` + `fotoNota` — o que mostrar no espaço da imagem (ex. "foto da fábrica/equipe" / "puxa mais que texto"), ou `foto: null` para post sem imagem.

O template vem com dados de exemplo — eles mostram o formato esperado e devem ser substituídos por inteiro.

## O que o motor renderiza (pra você saber o que prometer)

1. **Cabeçalho de post** — avatar com monograma, nome + selo, descrição, "Agora · 🌐", "Seguir".
2. **Corte "…mais" realista** — o LinkedIn mostra ~2-3 linhas (**~200-210 caracteres**) antes do "…mais", não só o gancho. O motor corta nesse ponto, em fronteira de palavra, sem partir `[campo]` ao meio; o "…mais" é clicável e expande o resto. Post com ≤215 caracteres aparece inteiro.
3. **Linha de corte** — a marca "↑ o que aparece antes do clique", ensinando por que a primeira linha é tudo.
4. **`[campos]` realçados** — qualquer `[coisa entre colchetes]` no texto vira destaque automaticamente. Mantê-los é intencional: são os pontos que você preenche COM o usuário depois.
5. **Espaço da foto** e **barra de reações** — para o card parecer real (imagem/vídeo engaja acima de texto puro no setor).
6. **Grid com folga** — 2 colunas em tela larga, 1 no mobile, tema claro/escuro. Nada disso precisa de ajuste seu.

## Escolha via AskUserQuestion

Depois de mostrar o artefato, **pergunte no chat com `AskUserQuestion`** qual ângulo o usuário quer levar (uma opção por ângulo, com o porquê de cada). Não faça ele voltar e digitar; ofereça a escolha. Escolhido o ângulo, preencha os `[campos]` com o dado real dele (peça em linguagem simples) e mostre o **preview final**: o mesmo template com `opcoes` reduzido ao escolhido — o modo de 1 item já traz o botão de copiar.

## Regras

- **O texto do preview é o post final** — o que ele vê é o que ele publica (fora os `[campos]`).
- **Nada de auto-publicar** — o preview mostra; publicar é o usuário.
- **Um passo por vez** — mostre, pergunte, ajuste. Não despeje tudo e suma.
