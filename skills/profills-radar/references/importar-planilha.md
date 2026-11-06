# Importar planilha

O comercial tem uma planilha de concorrentes (`.xlsx`) e quer a lista inteira de uma vez. Conduza pela mão: ele não precisa saber o que é slug, aba ou JSON.

## O script

`scripts/importar.js` traz a planilha para a lista:

```bash
node "<pasta desta skill>/scripts/importar.js" "<planilha.xlsx>" "<DADOS>/refs"             # só simula
node "<pasta desta skill>/scripts/importar.js" "<planilha.xlsx>" "<DADOS>/refs" --aplicar   # grava fichas e linhas
```

`--pular <id_planilha>` (repetível) deixa uma linha da planilha de fora e a lista em `puladas[]`.

Ele lê as abas `Mapa competitivo` e `Canais digitais` pelo nome das colunas e devolve `novas[]`, `ja_existem[]`, `sem_linkedin[]`, `perfil_pessoal[]`, `puladas[]`, `problemas[]`, `resumo` e `ok`. Com qualquer item em `problemas[]` ele sai com exit 1 e não grava nada, nem com `--aplicar`; cada problema traz o `id_planilha` e a `linha` quando se refere a uma linha. Planilha corrompida ou arquivo que não é `.xlsx` sai com exit 2 e a frase em stderr.

O script resolve prioridade sem acento e o grupo pelo ID citado; você só repassa o que ele devolveu. Rodar de novo com a mesma planilha não muda nada.

## Os 4 passos

1. **Ache a planilha.** Peça o arquivo pelo nome ou pelo caminho ("está na pasta Downloads"). Concluído quando você tem o caminho de um `.xlsx` que existe.

2. **Simule.** Rode o `importar.js` sem `--aplicar`. Com `problemas[]` cheio, nada foi gravado. Trate cada tipo pela tabela abaixo, rode a simulação de novo e repita até `ok: true`. Fale com o comercial pela aba, pela linha e pelo nome da empresa, que é como ele acha a célula no Excel.

   | Tipo | O que dizer ao comercial e o que fazer |
   |---|---|
   | exit 2, "planilha corrompida" ou "não é um .xlsx" | "O arquivo veio estragado ou não é uma planilha do Excel. Abra no Excel e salve de novo como .xlsx, ou baixe outra cópia." Rode de novo com o arquivo novo |
   | `aba_ausente` | "Não achei a aba X. Ela tem outro nome na sua planilha?" Com o nome certo, peça para ele renomear a aba para X |
   | `cabecalho_nao_encontrado` | "Na aba X não achei a linha com os nomes das colunas (ID, Empresa / unidade…). A planilha é essa mesma?" |
   | `coluna_ausente` | "Na aba X falta a coluna Y. Ela tem outro nome aí?" Peça para ele renomear o título da coluna para Y |
   | `celula_vazia` | "Na aba X, linha N, a coluna Y está vazia, e sem ela eu não sei qual empresa é." Peça para ele preencher ou apagar a linha |
   | `formula_sem_valor` | "Na aba X, linha N, a coluna Y tem uma fórmula que nunca foi calculada (a planilha foi gerada por um programa). Abra no Excel, salve e me mande de novo." |
   | `celula_com_erro` | "Na aba X, linha N, a coluna Y mostra um erro do Excel (`codigo`). Corrija a célula e salve de novo." |
   | `planilha_sem_empresas` | "A aba X tem os títulos das colunas, mas nenhuma empresa embaixo. É essa a planilha?" |
   | `id_repetido_na_planilha` | "O ID X aparece em duas linhas da aba Mapa competitivo (as linhas estão no `detalhe`). Cada empresa precisa de um ID só." Peça para ele trocar um dos dois |
   | `endereco_repetido_na_planilha` | "A Fulana e a Beltrana apontam para a mesma página no LinkedIn. São a mesma empresa?" Se forem, ele apaga uma das linhas; se não forem, ele corrige o endereço de uma delas na aba Canais digitais |
   | `slug_invalido` | "O endereço no LinkedIn da Fulana tem um caractere que a coleta não abre (acento ou símbolo). Copie o endereço de novo, direto da página da empresa." Ou rode com `--pular <id_planilha>` e trate a empresa por [Como entra uma empresa nova](../SKILL.md#como-entra-uma-empresa-nova) |
   | `conflito_de_endereco` | "A Fulana da planilha é a Fulana da sua lista, mas a lista usa a página `na_lista` e a planilha traz `na_planilha`. Qual das duas é a página certa?" Com `na_lista` vazio, a lista tem a empresa sem página e a planilha traz uma. Pergunte com `AskUserQuestion`. Vale a da lista: rode com `--pular <id_planilha>`. Vale a da planilha: troque o endereço da ficha e da linha do índice pelo da planilha (o slug muda o nome da ficha) e rode de novo |
   | `ficha_fora_da_lista` | "Já existe uma ficha da Fulana fora da sua lista, com outro conteúdo." Ofereça voltá-la para o índice, como no passo 0 com `fichas_orfas`, ou rode com `--pular <id_planilha>` |
   | `pular_id_inexistente` | o `--pular` levou um ID que a aba Mapa competitivo não tem, e a empresa que devia ficar de fora entraria. Ache na simulação anterior o `id_planilha` certo da empresa, corrija o `--pular` e rode de novo. Só fale com o comercial se o ID veio dele: "Não achei o ID X na aba Mapa competitivo. Qual é o ID da linha dessa empresa?" |
   | `indice_com_problemas` | não fale de planilha: a lista atual tem linha torta. Conserte pelo passo 0 e volte |

   Concluído quando a simulação voltou `ok: true`.

3. **Conte em linguagem simples, antes de gravar.** Uma frase para cada grupo que veio:
   - `novas`: "vou criar a ficha de N empresas novas", com os nomes;
   - `ja_existem`: "estas já estavam na sua lista e ficam como estão", e, para quem tem `muda`, "ganham a prioridade (ou o grupo) que a planilha dá";
   - `sem_linkedin` e `perfil_pessoal`: "estas ficam na lista, mas a coleta pula", com o `motivo` de cada uma em palavras simples: a planilha não traz o endereço no LinkedIn; o endereço é de outro tipo de página (vitrine, escola, grupo), e a coleta só lê página de empresa; ou, no perfil pessoal, "só o perfil de uma pessoa, e perfil de pessoa a coleta não lê";
   - `novas[].parecidas`: "a X da planilha parece a Y que você já tem; é a mesma?". Sendo a mesma, rode a importação com `--pular <id_planilha>` dessa linha e, se ele quiser os dados novos, trate a empresa que já existe por [Atualizar](../SKILL.md#gestão); não sendo, siga;
   - `novas[].notas` com prioridade fora da lista: "a planilha dizia 'Urgente' para a Z; ela entra como 'a definir' e eu pergunto na seleção";
   - `novas[].notas` com data inválida: "a data de conferência da Z veio como '5 nov 2026', que eu não leio; usei a data de hoje".

   É inclusão do que ele mesmo trouxe, dentro do pedido: siga sem pedir licença, a não ser que uma `parecidas` espere resposta. Concluído quando ele ouviu os números e cada `parecidas` teve resposta.

4. **Aplique e valide.** Rode o mesmo comando com `--aplicar` e depois o `indice.js` até `ok: true`. Diga quantas empresas a lista tem agora e quantas a próxima rodada já pega (`rodada.devidas`). Concluído quando o script voltou `ok: true` e `n_empresas` bate com o que você anunciou.

As fichas importadas levam `[a confirmar]` na confirmação do usuário e a planilha como fonte, com a data em que ela foi conferida; as seções que a planilha não cobre (tendências, porte) dizem isso e se completam na primeira re-pesquisa.
