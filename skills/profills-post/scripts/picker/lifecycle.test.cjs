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

function runStart(dadosDir, extraArgs = []) {
  return spawnSync('bash', [START, '--dados-dir', dadosDir, ...extraArgs], {
    encoding: 'utf8',
    timeout: 20000,
    env: {
      ...process.env,
      BRAINSTORM_LIFECYCLE_CHECK_MS: '200',
      BRAINSTORM_OPEN: ''
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

function httpAccepts(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(800, () => {
      req.destroy();
      resolve(false);
    });
  });
}

function request(url, headers) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, { headers: headers || {} }, (res) => {
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
    req.on('error', reject);
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
    { angulo: 'Dado', porque: 'prova', texto: 'Primeira opção de teste com texto longo o bastante.' },
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
  assert.equal(await httpAccepts(body.url), true);
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
  assert.equal(await httpAccepts(second.url), true);
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
  assert.equal(await httpAccepts(body.url), true);
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
      BRAINSTORM_LIFECYCLE_CHECK_MS: '200',
      BRAINSTORM_OPEN: ''
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
  assert.equal(await httpAccepts(first.url), true);

  process.kill(owner.pid, 'SIGKILL');
  await waitUntil(
    () => !fs.existsSync(pidFile) && !fs.existsSync(infoFile),
    3000,
    'owner death left pid or server-info'
  );
  assert.equal(await httpAccepts(first.url), false);

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
  assert.equal(await httpAccepts(started.url), false);

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

  const token = fs.readFileSync(path.join(dadosDir, '.picker', '.last-token'), 'utf8').trim();
  const page = await fetchScreen(started.url, token);
  assert.equal(page.status, 200);
  assert.equal(page.body.includes('Primeira opção de teste'), true);
  assert.equal(page.body.includes('"Copiar " + letra'), true);
  assert.equal(page.body.includes("data-choice=\"' + letra + '\""), true);
});
