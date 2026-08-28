'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');

const SCRIPT_DIR = __dirname;
const START = path.join(SCRIPT_DIR, 'start-server.sh');
const STOP = path.join(SCRIPT_DIR, 'stop-server.sh');

function makeDados() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'profills-picker-'));
}

function sessionDir(dadosDir) {
  return path.join(dadosDir, '.picker', 'current');
}

function runStart(dadosDir, extraArgs = [], extraEnv = {}) {
  return spawnSync('bash', [START, '--dados-dir', dadosDir, ...extraArgs], {
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      BRAINSTORM_LIFECYCLE_CHECK_MS: '200',
      ...extraEnv
    }
  });
}

function runStop(dadosDir) {
  return spawnSync('bash', [STOP, '--dados-dir', dadosDir], {
    encoding: 'utf8',
    timeout: 10000
  });
}

function assertNoSecret(text, label) {
  const haystack = String(text || '');
  if (haystack.includes('?key=')) {
    assert.fail(`${label} contained a query key`);
  }
}

function parseOneJson(stdout) {
  const lines = String(stdout || '')
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  assert.equal(lines.length, 1, 'stdout must be exactly one JSON object');
  return JSON.parse(lines[0]);
}

function tokenOf(dadosDir) {
  return fs.readFileSync(path.join(dadosDir, '.picker', '.last-token'), 'utf8').trim();
}

// "Accepts" means the real client gets in: 403 without the key, 200 with it.
// A server that only ever answers 403 is up but useless, and must not pass.
async function httpAccepts(url, dadosDir) {
  let gate;
  try {
    gate = await request(url);
  } catch (e) {
    return false;
  }
  if (gate.status !== 403) return false;
  const page = await fetchScreen(url, tokenOf(dadosDir));
  return page.status === 200;
}

function serverDown(url) {
  return request(url).then(() => false, () => true);
}

function request(url, headers) {
  return new Promise((resolve, reject) => {
    // agent:false — a pooled keep-alive socket to a restarted server on the same port would reset.
    const req = http.get(url, { headers: headers || {}, agent: false }, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        resolve({
          status: res.statusCode,
          headers: res.headers,
          body: Buffer.concat(chunks).toString('utf8')
        });
      });
    });
    req.on('error', (e) => reject(new Error(e.message + ' for GET ' + url.replace(/key=.*/, 'key=REDACTED'))));
    req.setTimeout(2000, () => {
      req.destroy();
      reject(new Error('timeout'));
    });
  });
}

async function fetchScreen(url, token) {
  const boot = await request(url + '?key=' + encodeURIComponent(token));
  const setCookie = boot.headers['set-cookie'];
  const cookie = Array.isArray(setCookie) ? setCookie[0] : setCookie;
  const cookieHeader = cookie ? String(cookie).split(';')[0] : '';
  return request(url, { cookie: cookieHeader });
}

async function waitUntil(fn, timeoutMs, message) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await fn()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message || 'timed out');
}

const SAMPLE = {
  titulo: 'Escolha o ângulo',
  empresa: { nome: 'Profills', iniciais: 'P', descricao: 'Máquinas' },
  opcoes: [
    { angulo: 'Dado', porque: 'prova', texto: "Primeira opção de teste com texto longo o bastante. Custa R$& e $' e $$ 10." },
    { angulo: 'Contrário', porque: 'debate', texto: 'Segunda opção de teste.' },
    { angulo: 'História', porque: 'cena', texto: 'Terceira opção de teste.' }
  ]
};

test('start prints chat-safe JSON and HTTP accepts', async (t) => {
  const dadosDir = makeDados();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const result = runStart(dadosDir);
  assertNoSecret(result.stdout, 'stdout');
  assertNoSecret(result.stderr, 'stderr');
  assert.equal(result.status, 0, result.stderr || 'start exit');

  const body = parseOneJson(result.stdout);
  assert.equal(body.status, 'started');
  assert.equal(typeof body.port, 'number');
  assert.match(body.url, /^http:\/\/localhost:\d+\/$/);
  assert.equal(body.url.includes('?'), false);
  assert.equal(await httpAccepts(body.url, dadosDir), true);
  const log = fs.readFileSync(path.join(sessionDir(dadosDir), 'state', 'server.log'), 'utf8');
  assertNoSecret(log, 'server.log');
});

test('second start is already_running on the same port', async (t) => {
  const dadosDir = makeDados();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const first = parseOneJson(runStart(dadosDir).stdout);
  const secondResult = runStart(dadosDir);
  assert.equal(secondResult.status, 0, secondResult.stderr || 'second start exit');
  assertNoSecret(secondResult.stdout, 'stdout');
  const second = parseOneJson(secondResult.stdout);
  assert.equal(second.status, 'already_running');
  assert.equal(second.port, first.port);
  assert.equal(await httpAccepts(second.url, dadosDir), true);
});

test('stale pid is replaced without signaling the decoy', async (t) => {
  const dadosDir = makeDados();
  const decoy = spawn('sleep', ['30'], { detached: true, stdio: 'ignore' });
  decoy.unref();
  t.after(() => {
    try { process.kill(decoy.pid, 'SIGKILL'); } catch (e) { /* gone */ }
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const stateDir = path.join(sessionDir(dadosDir), 'state');
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(path.join(stateDir, 'server.pid'), String(decoy.pid) + '\n');
  fs.writeFileSync(path.join(stateDir, 'server-instance-id'), 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa\n');

  const result = runStart(dadosDir);
  assert.equal(result.status, 0, result.stderr || 'start exit');
  const body = parseOneJson(result.stdout);
  assert.equal(body.status, 'replaced');
  process.kill(decoy.pid, 0);
  assert.equal(await httpAccepts(body.url, dadosDir), true);
});

test('owner exit clears pid and server-info', async (t) => {
  const dadosDir = makeDados();
  const outFile = path.join(dadosDir, 'start.json');
  const stateDir = path.join(sessionDir(dadosDir), 'state');
  const pidFile = path.join(stateDir, 'server.pid');
  const infoFile = path.join(stateDir, 'server-info');
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const owner = spawn('bash', ['-c', `
    bash -c "bash \\"$START\\" --dados-dir \\"$DADOS\\" > \\"$OUT\\""
    exec sleep 60
  `], {
    env: {
      ...process.env,
      START,
      DADOS: dadosDir,
      OUT: outFile,
      BRAINSTORM_LIFECYCLE_CHECK_MS: '200'
    },
    stdio: 'ignore'
  });
  t.after(() => {
    try { process.kill(owner.pid, 'SIGKILL'); } catch (e) { /* gone */ }
  });

  await waitUntil(
    () => fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').trim().length > 0,
    8000,
    'start did not write JSON'
  );
  const first = parseOneJson(fs.readFileSync(outFile, 'utf8'));
  assert.equal(await httpAccepts(first.url, dadosDir), true);

  process.kill(owner.pid, 'SIGKILL');
  await waitUntil(
    () => !fs.existsSync(pidFile) && !fs.existsSync(infoFile),
    3000,
    'owner death left pid or server-info'
  );
  assert.equal(await serverDown(first.url), true);

  const later = runStart(dadosDir);
  assert.equal(later.status, 0, later.stderr || 'later start exit');
  assert.notEqual(parseOneJson(later.stdout).status, 'already_running');
});

test('stop reports stopped then not_running', async (t) => {
  const dadosDir = makeDados();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const started = parseOneJson(runStart(dadosDir).stdout);
  const first = runStop(dadosDir);
  assert.equal(first.status, 0, first.stderr || 'stop exit');
  assert.equal(parseOneJson(first.stdout).status, 'stopped');
  assert.equal(await serverDown(started.url), true);

  const second = runStop(dadosDir);
  assert.equal(second.status, 0, second.stderr || 'second stop exit');
  assert.equal(parseOneJson(second.stdout).status, 'not_running');
});

test('LinkedIn screen has Copy on each card', async (t) => {
  const dadosDir = makeDados();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const started = parseOneJson(runStart(dadosDir).stdout);
  const contentDir = path.join(sessionDir(dadosDir), 'content');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(path.join(contentDir, 'opcoes.json'), JSON.stringify(SAMPLE));
  await new Promise((resolve) => setTimeout(resolve, 400));

  const page = await fetchScreen(started.url, tokenOf(dadosDir));
  assert.equal(page.status, 200);
  assert.equal(page.body.includes('Primeira opção de teste'), true);
  assert.equal(page.body.includes('"Copiar " + letra'), true);
  assert.equal(page.body.includes("data-choice=\"' + letra + '\""), true);
  assert.equal(page.body.includes('<!-- CONTENT -->'), false);
  assert.equal(page.body.includes("Custa R$& e $' e $$ 10."), true, 'wrapInFrame must not expand $ patterns');
});

// Production sessions live under DADOS (home or repo), never under /tmp: the
// only branch where stop-server.sh deletes the session. Test that branch.
function makeDadosOutsideTmp() {
  return fs.mkdtempSync(path.join(SCRIPT_DIR, '.test-dados-'));
}

function writeScreen(dadosDir, name, screen) {
  const contentDir = path.join(sessionDir(dadosDir), 'content');
  fs.mkdirSync(contentDir, { recursive: true });
  fs.writeFileSync(path.join(contentDir, name), JSON.stringify(screen));
}

test('a choice from the previous session never survives a restart or a rewritten screen', async (t) => {
  const dadosDir = makeDadosOutsideTmp();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });
  const stateDir = path.join(sessionDir(dadosDir), 'state');
  const eventsFile = path.join(stateDir, 'events');

  parseOneJson(runStart(dadosDir).stdout);
  writeScreen(dadosDir, 'tema.json', SAMPLE);
  await new Promise((resolve) => setTimeout(resolve, 400));
  fs.writeFileSync(eventsFile, JSON.stringify({ type: 'click', choice: 'B' }) + '\n');

  // Same screen name rewritten (screen-updated) must drop the stale choice.
  writeScreen(dadosDir, 'tema.json', { ...SAMPLE, titulo: 'Outra rodada' });
  await waitUntil(() => !fs.existsSync(eventsFile), 2000, 'screen-updated kept the old choice');

  // A second start while the picker is up (already_running) is a new round too:
  // the screen goes to .anterior/ and the tab shows the waiting page.
  const screenFile = path.join(sessionDir(dadosDir), 'content', 'tema.json');
  const again = parseOneJson(runStart(dadosDir).stdout);
  assert.equal(again.status, 'already_running');
  assert.equal(fs.existsSync(screenFile), false);
  assert.equal(fs.readdirSync(path.join(sessionDir(dadosDir), 'content', '.anterior')).some((f) => f.endsWith('-tema.json')), true);
  assert.equal((await fetchScreen(again.url, tokenOf(dadosDir))).body.includes('Esperando os rascunhos'), true);
  writeScreen(dadosDir, 'tema.json', { ...SAMPLE, titulo: 'Outra rodada' });
  await new Promise((resolve) => setTimeout(resolve, 400));

  // Stop outside /tmp keeps the folder and the screen, drops the choice.
  fs.writeFileSync(eventsFile, JSON.stringify({ type: 'click', choice: 'B' }) + '\n');
  assert.equal(parseOneJson(runStop(dadosDir).stdout).status, 'stopped');
  assert.equal(fs.existsSync(eventsFile), false);
  assert.equal(fs.existsSync(screenFile), true);

  // The next server is a new round: the old choice is gone, the old screen is
  // archived (not served), and the tab opens on the waiting page.
  fs.mkdirSync(stateDir, { recursive: true });
  fs.writeFileSync(eventsFile, JSON.stringify({ type: 'click', choice: 'B' }) + '\n');
  const restarted = parseOneJson(runStart(dadosDir).stdout);
  assert.equal(fs.existsSync(eventsFile), false);
  assert.equal(fs.existsSync(screenFile), false);
  assert.equal(fs.readdirSync(path.join(sessionDir(dadosDir), 'content', '.anterior')).filter((f) => f.endsWith('-tema.json')).length, 2, 'archives must not overwrite each other');
  const page = await fetchScreen(restarted.url, tokenOf(dadosDir));
  assert.equal(page.body.includes('Outra rodada'), false);
  assert.equal(page.body.includes('Esperando os rascunhos'), true);
});

test('cmdlineOf falls back to ps when procfs is missing', () => {
  const lib = path.join(SCRIPT_DIR, 'lifecycle-lib.cjs');
  const probe = spawnSync('node', ['-e', `
    const { cmdlineOf } = require(${JSON.stringify(lib)});
    const args = cmdlineOf(process.pid);
    process.stdout.write(JSON.stringify(args));
  `], { encoding: 'utf8', env: { ...process.env, BRAINSTORM_PROC_DIR: '/nonexistent-procfs' } });
  assert.equal(probe.status, 0, probe.stderr);
  const args = JSON.parse(probe.stdout);
  assert.ok(Array.isArray(args) && args.length > 0, 'ps fallback returned nothing');
  assert.ok(args.some((a) => /node/.test(a)), 'ps fallback did not see the node binary');
});

test('port fallback still opens with a key the gate accepts', async (t) => {
  const dadosDir = makeDados();
  const seen = path.join(dadosDir, 'opened-urls');
  const launcher = path.join(dadosDir, 'launcher.sh');
  fs.writeFileSync(launcher, '#!/usr/bin/env bash\nprintf \'%s\\n\' "$1" >> "' + seen + '"\n');
  fs.chmodSync(launcher, 0o700);
  const env = { BRAINSTORM_OPEN_CMD: launcher };
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });

  const first = parseOneJson(runStart(dadosDir, ['--open'], env).stdout);
  assert.equal(parseOneJson(runStop(dadosDir).stdout).status, 'stopped');

  // Squat the remembered port so the next start must fall back to another one.
  const squatter = http.createServer((req, res) => res.end('squat'));
  await new Promise((resolve) => squatter.listen(first.port, '127.0.0.1', resolve));
  t.after(() => squatter.close());

  const second = parseOneJson(runStart(dadosDir, ['--open'], env).stdout);
  assert.notEqual(second.port, first.port, 'server did not fall back');
  assert.equal(second.opened, true);
  await waitUntil(() => fs.existsSync(seen) && fs.readFileSync(seen, 'utf8').trim().split('\n').length === 2, 2000, 'launcher not called after fallback');
  const openedUrl = fs.readFileSync(seen, 'utf8').trim().split('\n')[1];
  assert.equal(openedUrl.startsWith(second.url), true);
  assert.equal((await request(openedUrl)).status, 200, 'opened tab must pass the gate after a port fallback');
  assert.equal(await httpAccepts(second.url, dadosDir), true);
});

test('opened is false when the launcher does not exist or fails', async (t) => {
  const dadosDir = makeDados();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });
  const missing = parseOneJson(runStart(dadosDir, ['--open'], { BRAINSTORM_OPEN_CMD: path.join(dadosDir, 'no-such-launcher') }).stdout);
  assert.equal(missing.opened, false);
  const failing = parseOneJson(runStart(dadosDir, ['--open'], { BRAINSTORM_OPEN_CMD: 'false' }).stdout);
  assert.equal(failing.opened, false);
});

test('recovery error line is valid JSON even with spaces in DADOS', () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'profills picker '));
  const dadosDir = path.join(base, 'Profills LinkedIn');
  fs.mkdirSync(dadosDir);
  try {
    // A node that dies at once makes start-server.sh take the "was killed" branch.
    const fakeBin = path.join(base, 'bin');
    fs.mkdirSync(fakeBin);
    fs.writeFileSync(path.join(fakeBin, 'node'), '#!/usr/bin/env bash\ncase "$1" in *lifecycle-lib.cjs) exec ' + process.execPath + ' "$@";; esac\nexit 3\n');
    fs.chmodSync(path.join(fakeBin, 'node'), 0o700);
    const r = spawnSync('bash', [START, '--dados-dir', dadosDir], {
      encoding: 'utf8', timeout: 15000, env: { ...process.env, PATH: fakeBin + ':' + process.env.PATH }
    });
    assert.equal(r.status, 1);
    const body = parseOneJson(r.stdout);
    assert.match(body.error, /foi encerrado/);
    assert.equal(body.error.includes('"' + dadosDir + '"'), true);
  } finally {
    fs.rmSync(base, { recursive: true, force: true });
  }
});

test('ready works without /proc (macOS path)', async (t) => {
  const dadosDir = makeDados();
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });
  const stateDir = path.join(sessionDir(dadosDir), 'state');
  const started = parseOneJson(runStart(dadosDir).stdout);
  const probe = spawnSync('node', [path.join(SCRIPT_DIR, 'lifecycle-lib.cjs'), 'ready', stateDir], {
    encoding: 'utf8',
    env: { ...process.env, BRAINSTORM_PROC_DIR: path.join(dadosDir, 'no-proc-here') }
  });
  assert.equal(probe.status, 0, 'ready must fall back to ps when /proc is missing');
  assert.equal(await httpAccepts(started.url, dadosDir), true);
});

test('foreground prints the same JSON first, then holds', async (t) => {
  const dadosDir = makeDados();
  const outFile = path.join(dadosDir, 'fg.json');
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });
  const fg = spawn('bash', [START, '--dados-dir', dadosDir, '--foreground'], {
    env: { ...process.env, BRAINSTORM_LIFECYCLE_CHECK_MS: '200' },
    stdio: ['ignore', fs.openSync(outFile, 'w'), 'ignore']
  });
  t.after(() => {
    try { process.kill(fg.pid, 'SIGKILL'); } catch (e) { /* gone */ }
  });
  await waitUntil(
    () => fs.existsSync(outFile) && fs.readFileSync(outFile, 'utf8').trim().length > 0,
    8000,
    'foreground never printed'
  );
  const body = parseOneJson(fs.readFileSync(outFile, 'utf8'));
  assert.equal(body.status, 'started');
  assert.equal(fg.exitCode, null, 'foreground must still be running');
  assert.equal(await httpAccepts(body.url, dadosDir), true);
});

test('--open launches with the key and reports opened, also when already running', async (t) => {
  const dadosDir = makeDados();
  const seen = path.join(dadosDir, 'opened-urls');
  const launcher = path.join(dadosDir, 'launcher.sh');
  fs.writeFileSync(launcher, '#!/usr/bin/env bash\nprintf \'%s\\n\' "$1" >> "' + seen + '"\n');
  fs.chmodSync(launcher, 0o700);
  t.after(() => {
    runStop(dadosDir);
    fs.rmSync(dadosDir, { recursive: true, force: true });
  });
  const env = { BRAINSTORM_OPEN_CMD: launcher };

  const first = runStart(dadosDir, ['--open'], env);
  assertNoSecret(first.stdout, 'stdout');
  const body = parseOneJson(first.stdout);
  assert.equal(body.opened, true);
  await waitUntil(() => fs.existsSync(seen), 2000, 'launcher not called');

  const again = parseOneJson(runStart(dadosDir, ['--open'], env).stdout);
  assert.equal(again.status, 'already_running');
  assert.equal(again.opened, true);
  await waitUntil(() => fs.readFileSync(seen, 'utf8').trim().split('\n').length === 2, 2000, 'second --open did not relaunch');

  const urls = fs.readFileSync(seen, 'utf8').trim().split('\n');
  const token = tokenOf(dadosDir);
  for (const u of urls) {
    assert.equal(u, body.url + '?key=' + encodeURIComponent(token));
    assert.equal((await request(u)).status, 200);
  }

  const headless = parseOneJson(runStart(dadosDir, ['--open'], { BRAINSTORM_OPEN_CMD: '', DISPLAY: '', WAYLAND_DISPLAY: '' }).stdout);
  if (process.platform === 'linux' && !/microsoft/i.test(os.release())) assert.equal(headless.opened, false);
});

test('an option flag without a value fails fast in pt-BR', () => {
  for (const script of [START, STOP]) {
    const r = spawnSync('bash', [script, '--dados-dir'], { encoding: 'utf8', timeout: 5000 });
    assert.equal(r.status, 1, path.basename(script) + ' did not fail');
    assert.match(parseOneJson(r.stdout).error, /precisa de um valor/);
  }
  const r = spawnSync('bash', [START, '--dados-dir', '--open'], { encoding: 'utf8', timeout: 5000 });
  assert.equal(r.status, 1);
});
