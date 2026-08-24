export const meta = {
  name: 'evals-profills',
  description: 'Roda os evals das skills profills (versão atual × baseline git) em sandbox, nota por asserção e agrega o benchmark',
  whenToUse: 'Depois de mudar uma skill profills-*: Workflow({name: "evals-profills", args: {skills: ["profills-post"], baseline: "main", iteration: 2}}). Sem args roda as 6 contra main.',
  phases: [
    { title: 'Preparar', detail: 'plano a partir dos evals.json, snapshot do baseline, sandbox por run' },
    { title: 'Rodar', detail: 'skill atual × baseline, Sonnet, sandbox isolado' },
    { title: 'Notar', detail: 'grader Opus por eval com as expectations do evals.json' },
    { title: 'Agregar', detail: 'aggregate_benchmark + viewer estático por skill' },
  ],
}

// ---- parâmetros -----------------------------------------------------------
const REPO = '/home/othavio/Work/profills-skills'
const TODAS = ['profills-radar', 'profills-garimpo', 'profills-post', 'profills-voz', 'profills-navegador', 'profills-setup']
const skills = (args && args.skills && args.skills.length) ? args.skills : TODAS
const baseline = (args && args.baseline) || 'main'
const iteration = (args && args.iteration) || 1
const WS = (args && args.ws) || (REPO + '/../profills-evals-workspace')
const SC = '/home/othavio/.claude/plugins/cache/claude-plugins-official/skill-creator/unknown/skills/skill-creator'
const IT = 'iteration-' + iteration

// ---- schemas ----------------------------------------------------------------
const PLAN = { type: 'object', properties: {
  evals: { type: 'array', items: { type: 'object', properties: {
    skill: { type: 'string' }, id: { type: 'integer' }, name: { type: 'string' }, dir: { type: 'string' },
  }, required: ['skill', 'id', 'name', 'dir'] } },
  snapshot: { type: 'string' },
}, required: ['evals', 'snapshot'] }
const RUN = { type: 'object', properties: {
  transcript: { type: 'string' }, arquivos_em_outputs: { type: 'integer' }, terminou: { type: 'boolean' },
}, required: ['transcript', 'arquivos_em_outputs', 'terminou'] }
const GRADE = { type: 'object', properties: {
  eval: { type: 'string' }, n: { type: 'integer' }, passou_atual: { type: 'integer' }, passou_baseline: { type: 'integer' },
  eval_fraco: { type: 'boolean' }, nota: { type: 'string', description: 'uma frase' },
}, required: ['eval', 'n', 'passou_atual', 'passou_baseline', 'eval_fraco', 'nota'] }
const AGG = { type: 'object', properties: {
  tabela_md: { type: 'string' }, viewers: { type: 'array', items: { type: 'string' } },
}, required: ['tabela_md', 'viewers'] }

// ---- fase 0: preparar --------------------------------------------------------
phase('Preparar')
const plano = await agent([
  'Prepare o workspace de evals. Repo: ' + REPO + ' (SOMENTE LEITURA, exceto o que está descrito abaixo, tudo fora do repo). Workspace: ' + WS + '.',
  '1. Snapshot do baseline: mkdir -p ' + WS + '/snapshot-' + baseline.replace(/[^a-zA-Z0-9]/g, '_') + ' e dentro dele: git -C ' + REPO + ' archive ' + baseline + ' skills | tar -x -C <pasta>. O caminho completo da pasta skills/ do snapshot é o campo snapshot.',
  '2. Para cada skill em ' + JSON.stringify(skills) + ', leia ' + REPO + '/skills/<skill>/evals/evals.json. Para cada eval: name = "eval-<id>-" + slug ascii de até 40 chars do prompt; dir = ' + WS + '/<skill>/' + IT + '/<name>. Crie dir com eval_metadata.json {eval_id, eval_name, prompt, expected_output, assertions: expectations ou []}.',
  '3. Em cada dir, para cfg em [with_skill, old_skill]: mkdir <dir>/<cfg>/outputs e <dir>/<cfg>/repo; copie ' + REPO + '/linkedin-data para <dir>/<cfg>/repo/linkedin-data; se o eval tem files, copie o conteúdo de cada pasta listada (relativa à raiz da skill) POR CIMA de <dir>/<cfg>/repo (sobrescrevendo); depois git init -q <dir>/<cfg>/repo. Se a fixture pede ausência de arquivo (existe um arquivo .apagar listando caminhos), apague-os.',
  '4. Devolva o plano completo no StructuredOutput.',
].join('\n'), { label: 'preparar', phase: 'Preparar', schema: PLAN, model: 'sonnet' })
if (!plano) throw new Error('preparação falhou')
log(plano.evals.length + ' evals preparados; baseline ' + baseline)

// ---- fase 1+2: rodar e notar (pipeline por eval) --------------------------------
const runPrompt = (e, cfg) => {
  const skillPath = cfg === 'with_skill' ? REPO + '/skills/' + e.skill : plano.snapshot + '/' + e.skill
  const runDir = e.dir + '/' + cfg
  return [
    'Você é o Claude Code atendendo um usuário comercial (não dev). Execute o pedido SEGUINDO A SKILL em ' + skillPath + '/SKILL.md (leia inteiro, mais as references que ela mandar; scripts/ da skill podem ser executados com node). Fidelidade ao que a skill manda é o que está sendo medido.',
    'SANDBOX — regras absolutas:',
    '- Diretório de trabalho: ' + runDir + '/repo (repo git com linkedin-data/ na raiz). Caminhos absolutos a partir dele. NUNCA leia nem escreva em ' + REPO + '/linkedin-data, em ~/Profills LinkedIn nem em ~/.config; o que a skill mandar gravar em ~/.config vai em ' + runDir + '/repo/config/ (diga isso no transcript).',
    '- O disco do sandbox já reflete o estado inicial do caso. O "(Contexto: ...)" do pedido descreve só o que não é disco: o que o usuário responde, o que uma tool devolve. Não invente estado além disso.',
    '- AskUserQuestion indisponível: escreva no transcript a pergunta exata, as opções e a recomendada, marcada [PERGUNTA], e siga com a recomendada (ou com a resposta que o contexto já dá).',
    '- Tools mcp__claude-in-chrome__ e navegador real indisponíveis: onde o contexto declara o retorno de uma tool, use-o; onde não, escreva a chamada exata e o resultado plausível, marcado [TOOL]. Nunca carregue essas tools.',
    '- Tool Artifact indisponível: onde a skill mandar publicar artefato, escreva o HTML completo em ' + runDir + '/outputs/artifact-<nome>.html e trate o caminho como o link.',
    '- claude plugin ... e npx skills add ... não são executados: escreva o comando exato e assuma o resultado que o contexto indica.',
    '- WebSearch/WebFetch reais podem ser usados se a skill mandar pesquisar.',
    '- Invocar outra skill: leia o SKILL.md dela no diretório-pai de ' + skillPath + ' e siga.',
    'PEDIDO DO USUÁRIO: o campo prompt de ' + e.dir + '/eval_metadata.json. Ignore expected_output e assertions desse arquivo — são gabarito.',
    'SAÍDA OBRIGATÓRIA em ' + runDir + '/outputs/: (1) transcript.md em pt-BR: passos executados com [PERGUNTA]/[TOOL], e ao fim a seção "## Resposta final" com o texto exato que o usuário leria; (2) cópia de todo arquivo criado ou alterado dentro de repo/, com o caminho relativo preservado (ex.: outputs/linkedin-data/refs/INDEX.md); pasta criada vazia ganha um arquivo .keep na cópia. Não faça commit.',
  ].join('\n')
}
const gradePrompt = (e) => [
  'Você é o grader. Leia primeiro ' + SC + '/agents/grader.md. Eval: ' + e.dir + '/eval_metadata.json — o campo assertions é a lista FIXA de expectations (se estiver vazio, derive 4-8 de expected_output e grave-as de volta em assertions).',
  'Duas execuções: ' + e.dir + '/with_skill/outputs/ (skill ATUAL: ' + REPO + '/skills/' + e.skill + ') e ' + e.dir + '/old_skill/outputs/ (BASELINE: ' + plano.snapshot + '/' + e.skill + '). Grade as duas com as MESMAS asserções. Regra dura: afirmação do transcript sem evidência em arquivo de outputs/ ou na "## Resposta final" é FAIL. Quando a asserção citar um script da skill (metricas.js, checar-formato.js, indice.js), RODE o script sobre o artefato para decidir.',
  'Escreva <run>/grading.json nas duas pastas: {"expectations":[{"text","passed","evidence"}],"summary":{"passed","failed","total","pass_rate"},"eval_feedback":{"weak_assertions":[],"missing_coverage":[],"notes":"uma frase"}}. Campos text/passed/evidence exatamente assim.',
].join('\n')

phase('Rodar')
const resultados = await pipeline(
  plano.evals,
  e => parallel(['with_skill', 'old_skill'].map(cfg => () =>
    agent(runPrompt(e, cfg), { label: 'run:' + e.skill.replace('profills-', '') + '#' + e.id + (cfg === 'with_skill' ? ':atual' : ':base'), phase: 'Rodar', schema: RUN, model: 'sonnet' })
  )).then(rs => ({ e, runs: rs })),
  ({ e, runs }) => agent(gradePrompt(e), { label: 'grade:' + e.skill.replace('profills-', '') + '#' + e.id, phase: 'Notar', schema: GRADE, model: 'opus' })
    .then(g => ({ skill: e.skill, id: e.id, runs_ok: runs.filter(Boolean).length, grade: g }))
)
const ok = resultados.filter(Boolean)
const semGrade = ok.filter(r => !r.grade).map(r => r.skill + '#' + r.id)
if (semGrade.length) log('grader null: ' + semGrade.join(', '))

// ---- fase 3: agregar -------------------------------------------------------
phase('Agregar')
const agg = await agent([
  'SOMENTE LEITURA fora de ' + WS + '. Para cada skill em ' + JSON.stringify(skills) + ': cd ' + SC + ' && python -m scripts.aggregate_benchmark ' + WS + '/<skill>/' + IT + ' --skill-name <skill>; depois python ' + SC + '/eval-viewer/generate_review.py ' + WS + '/<skill>/' + IT + ' --skill-name <skill> --benchmark ' + WS + '/<skill>/' + IT + '/benchmark.json --static ' + WS + '/viewer-<skill>-' + IT + '.html' + (iteration > 1 ? ' --previous-workspace ' + WS + '/<skill>/iteration-' + (iteration - 1) : '') + '.',
  'Depois monte, lendo os grading.json, uma tabela markdown skill | atual (passou/total, %) | baseline (passou/total, %) com linha TOTAL, mais a lista das asserções que a versão atual falhou (skill, eval, texto curto) e a lista dos evals marcados eval_fraco. Grave em ' + WS + '/resumo-' + IT + '.md e devolva a tabela e os caminhos dos viewers.',
].join('\n'), { label: 'agregar', phase: 'Agregar', schema: AGG, model: 'sonnet' })

return { iteration: IT, baseline, workspace: WS, resumo: agg ? agg.tabela_md : null, viewers: agg ? agg.viewers : [], sem_grade: semGrade, por_eval: ok.map(r => ({ eval: r.skill + '#' + r.id, atual: r.grade ? r.grade.passou_atual : null, baseline: r.grade ? r.grade.passou_baseline : null, n: r.grade ? r.grade.n : null, fraco: r.grade ? r.grade.eval_fraco : null })) }
