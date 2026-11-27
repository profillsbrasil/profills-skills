// Teste do checar-harness.js: roda o script de verdade num plugin de mentira e no plugin do repo.
// Uso: node plugins/profills/scripts/checar-harness.test.js

const fs = require('fs');
const os = require('os');
const path = require('path');
const assert = require('assert');
const { spawnSync } = require('child_process');

const SCRIPT = path.join(__dirname, 'checar-harness.js');
const PLUGIN_DO_REPO = path.join(__dirname, '..');
let falhas = 0;

function rodar(raiz) {
  const r = spawnSync(process.execPath, [SCRIPT, raiz], { encoding: 'utf8' });
  return { codigo: r.status, saida: JSON.parse(r.stdout) };
}

const LEITURA = 'Leia `../../docs/harness/claude-code.md` no Claude Code e `../../docs/harness/codex.md` no Codex.';
const adaptador = (ids) => `# Adaptador\n\n## Intenções\n\n| Intenção | Como |\n|---|---|\n${ids.map((id) => `| \`${id}\` | algo |`).join('\n')}\n\n## Outra seção\n\n| \`fora-da-tabela\` | não conta |\n`;

function montar({ skill, claude = ['perguntar', 'abrir-pagina'], codex = ['perguntar', 'abrir-pagina'], reference = null }) {
  const raiz = fs.mkdtempSync(path.join(os.tmpdir(), 'checar-harness-'));
  fs.mkdirSync(path.join(raiz, 'docs', 'harness'), { recursive: true });
  fs.writeFileSync(path.join(raiz, 'docs', 'harness', 'claude-code.md'), adaptador(claude));
  fs.writeFileSync(path.join(raiz, 'docs', 'harness', 'codex.md'), adaptador(codex));
  const pasta = path.join(raiz, 'skills', 'profills-teste');
  fs.mkdirSync(path.join(pasta, 'references'), { recursive: true });
  fs.writeFileSync(path.join(pasta, 'SKILL.md'), skill);
  if (reference) fs.writeFileSync(path.join(pasta, 'references', 'ref.md'), reference);
  return raiz;
}

function caso(nome, fn) {
  try {
    fn();
    console.log(`ok - ${nome}`);
  } catch (e) {
    falhas += 1;
    console.log(`FALHOU - ${nome}\n  ${e.message}`);
  }
}

caso('skill limpa, intenções nos dois adaptadores: passa', () => {
  const raiz = montar({ skill: `# Teste\n\n${LEITURA}\n\nPergunte com opções (intenção \`perguntar\`) e abra a página (intenção \`abrir-pagina\`).\n` });
  const { codigo, saida } = rodar(raiz);
  assert.strictEqual(codigo, 0, JSON.stringify(saida));
  assert.deepStrictEqual(Object.keys(saida.intencoes), ['abrir-pagina', 'perguntar']);
});

caso('skill com ferramenta crua do Claude Code: falha e aponta a linha', () => {
  const raiz = montar({ skill: `# Teste\n\n${LEITURA}\n\nPergunte com \`AskUserQuestion\`.\n` });
  const { codigo, saida } = rodar(raiz);
  assert.strictEqual(codigo, 1);
  assert.deepStrictEqual(saida.ferramentas_cruas.map((f) => [f.arquivo, f.linha, f.ferramenta]), [['skills/profills-teste/SKILL.md', 5, 'AskUserQuestion']]);
});

caso('reference com ferramenta do Codex e do Claude in Chrome: falha nas duas', () => {
  const raiz = montar({
    skill: `# Teste\n\n${LEITURA}\n`,
    reference: 'Rode `cua.getState()`.\nDepois `tabs_create_mcp` e `navigate`.\n',
  });
  const { codigo, saida } = rodar(raiz);
  assert.strictEqual(codigo, 1);
  assert.deepStrictEqual(saida.ferramentas_cruas.map((f) => [f.linha, f.harness]), [[1, 'codex'], [2, 'claude-code']]);
});

caso('intenção usada sem linha no adaptador do Codex: falha e diz onde falta', () => {
  const raiz = montar({ skill: `# Teste\n\n${LEITURA}\n\nUse as intenções \`perguntar\` e \`rolar\`.\n`, claude: ['perguntar', 'rolar'], codex: ['perguntar'] });
  const { codigo, saida } = rodar(raiz);
  assert.strictEqual(codigo, 1);
  assert.deepStrictEqual(saida.intencoes_sem_linha, [{ intencao: 'rolar', falta_em: ['docs/harness/codex.md'], usada_em: ['skills/profills-teste/SKILL.md'] }]);
});

caso('linha fora da seção "## Intenções" não cobre a intenção', () => {
  const raiz = montar({ skill: `# Teste\n\n${LEITURA}\n\nIntenção \`fora-da-tabela\`.\n` });
  const { saida } = rodar(raiz);
  assert.deepStrictEqual(saida.intencoes_sem_linha.map((i) => i.intencao), ['fora-da-tabela']);
});

caso('SKILL.md que não manda ler os adaptadores: falha', () => {
  const raiz = montar({ skill: '# Teste\n\nSem a linha do adaptador.\n' });
  const { codigo, saida } = rodar(raiz);
  assert.strictEqual(codigo, 1);
  assert.strictEqual(saida.sem_leitura_do_adaptador.length, 1);
});

caso('caminho com /profills- dentro de outro caminho não conta como chamada pelo nome', () => {
  const raiz = montar({ skill: `# Teste\n\n${LEITURA}\n\nRode \`node "<pasta>/../profills-setup/scripts/mapa.js"\` e leia skills/profills-voz/SKILL.md.\n` });
  assert.strictEqual(rodar(raiz).codigo, 0);
});

caso('o plugin do repo passa', () => {
  const { codigo, saida } = rodar(PLUGIN_DO_REPO);
  assert.strictEqual(codigo, 0, JSON.stringify(saida, null, 2));
  assert.ok(saida.arquivos > 20, `só ${saida.arquivos} arquivos lidos`);
});

console.log(falhas ? `\n${falhas} caso(s) falharam` : '\ntodos os casos passaram');
process.exit(falhas ? 1 : 0);
