'use strict';
// browserLauncherForPlatform and the browser-opening flow derive from obra/superpowers
// (skills/brainstorming/scripts/server.cjs), MIT License, Copyright (c) 2025 Jesse Vincent.
// See LICENSE-obra-superpowers in this folder.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { spawnSync, execFile, exec } = require('child_process');

// Tests point this at a missing directory to exercise the no-procfs (macOS) path.
const PROC_DIR = process.env.BRAINSTORM_PROC_DIR || '/proc';

function readTrim(file) {
  return fs.readFileSync(file, 'utf8').trim();
}

// Argument list of a live process. Linux: /proc/<pid>/cmdline (exact argv).
// macOS/BSD (no procfs): `ps -o args=`, split on whitespace — good enough to
// find the `--brainstorm-server-id=<id>` token, which never contains spaces.
function cmdlineOf(pid) {
  try {
    return fs.readFileSync(path.join(PROC_DIR, String(pid), 'cmdline'), 'utf8').split('\0');
  } catch (e) {
    // fall through to ps
  }
  try {
    const out = spawnSync('ps', ['-ww', '-o', 'args=', '-p', String(pid)], { encoding: 'utf8' });
    if (out.status !== 0 || !out.stdout.trim()) return null;
    return out.stdout.trim().split(/\s+/);
  } catch (e) {
    return null;
  }
}

function identityMatches(pid, instanceId) {
  const args = cmdlineOf(pid);
  if (!args) return false;
  return args.includes('--brainstorm-server-id=' + instanceId);
}

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e && e.code === 'EPERM';
  }
}

// Liveness only: any HTTP answer (the key gate's 403 included) means the
// server is accepting. Whether the page opens is the browser's job (see open).
function httpAccepts(host, port, timeoutMs) {
  const probeHost = (host === '0.0.0.0' || host === '::') ? '127.0.0.1' : host;
  return new Promise((resolve) => {
    const req = http.get({ host: probeHost, port, path: '/', timeout: timeoutMs }, (res) => {
      res.resume();
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
  });
}

function inspect(stateDir) {
  const pidPath = path.join(stateDir, 'server.pid');
  const idPath = path.join(stateDir, 'server-instance-id');
  const infoPath = path.join(stateDir, 'server-info');
  let pid;
  let instanceId;
  let info;
  try {
    pid = Number(readTrim(pidPath));
    instanceId = readTrim(idPath);
    info = JSON.parse(readTrim(infoPath));
  } catch (e) {
    return null;
  }
  if (!Number.isInteger(pid) || pid <= 1) return null;
  if (!/^[A-Za-z0-9_-]{32,64}$/.test(instanceId)) return null;
  const port = Number(info.port);
  if (!Number.isInteger(port) || port < 1) return null;
  const host = info.host || '127.0.0.1';
  return { pid, instanceId, port, host };
}

async function isReady(stateDir) {
  const snap = inspect(stateDir);
  if (!snap) return null;
  if (!processAlive(snap.pid)) return null;
  if (!identityMatches(snap.pid, snap.instanceId)) return null;
  if (!(await httpAccepts(snap.host, snap.port, 500))) return null;
  return snap;
}

function browserLauncherForPlatform(url, {
  platform = process.platform,
  osRelease = os.release(),
  env = process.env
} = {}) {
  const isWSL = platform === 'linux' && /microsoft/i.test(osRelease);
  if (platform === 'darwin') return { bin: 'open', args: [url] };
  if (platform === 'win32' || isWSL) {
    return { bin: 'rundll32.exe', args: ['url.dll,FileProtocolHandler', url] };
  }
  if (env.DISPLAY || env.WAYLAND_DISPLAY) return { bin: 'xdg-open', args: [url] };
  return null;
}

// Opens the picker in the user's browser with the session key in the URL, so
// the tab gets the cookie and later key-less visits pass the gate. The key
// never reaches stdout: only {opened: true|false} does. "Opened" means the
// launcher ran and did not fail within the grace window (ENOENT and non-zero
// exits arrive asynchronously, so a bare try/catch would always say true).
function openBrowser(stateDir, tokenFile, urlHost, graceMs = 1500) {
  const snap = inspect(stateDir);
  if (!snap) return Promise.resolve(false);
  let token;
  try {
    token = readTrim(tokenFile);
  } catch (e) {
    return Promise.resolve(false);
  }
  if (!token) return Promise.resolve(false);
  const host = urlHost.includes(':') && !urlHost.startsWith('[') ? '[' + urlHost + ']' : urlHost;
  const url = 'http://' + host + ':' + snap.port + '/?key=' + encodeURIComponent(token);
  let child;
  if (process.env.BRAINSTORM_OPEN_CMD) {
    child = exec(process.env.BRAINSTORM_OPEN_CMD + ' ' + JSON.stringify(url));
  } else {
    const launcher = browserLauncherForPlatform(url);
    if (!launcher) return Promise.resolve(false);
    child = execFile(launcher.bin, launcher.args);
  }
  return new Promise((resolve) => {
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    child.on('error', () => done(false));
    child.on('exit', (code) => done(code === 0));
    setTimeout(() => {
      // Still running after the grace window: a browser that stays attached.
      child.unref();
      done(true);
    }, graceMs).unref();
  });
}

function chatJson(status, port, urlHost, opened) {
  const host = urlHost.includes(':') && !urlHost.startsWith('[') ? '[' + urlHost + ']' : urlHost;
  const body = {
    status,
    url: 'http://' + host + ':' + Number(port) + '/',
    port: Number(port)
  };
  if (opened !== undefined) body.opened = opened;
  return JSON.stringify(body) + '\n';
}

async function main(argv) {
  const cmd = argv[0];
  if (cmd === 'ready') {
    const snap = await isReady(argv[1]);
    process.exit(snap ? 0 : 1);
  }
  if (cmd === 'print') {
    // print <status> <stateDir> <urlHost> [opened: true|false|skip]
    const status = argv[1];
    const stateDir = argv[2];
    const urlHost = argv[3] || 'localhost';
    const openedArg = argv[4];
    const snap = inspect(stateDir);
    if (!snap) {
      process.stderr.write('{"error":"missing server-info"}\n');
      process.exit(1);
    }
    const opened = openedArg === 'true' ? true : openedArg === 'false' ? false : undefined;
    process.stdout.write(chatJson(status, snap.port, urlHost, opened));
    return;
  }
  if (cmd === 'claim') {
    // claim <newDir> <lockDir> -> exit 0 if this caller now holds lockDir.
    // rename(2) is atomic and fails while a non-empty lockDir exists, so one
    // caller wins. An empty lockDir (owner marker already removed by a
    // takeover) is cleared first; rmdir fails harmlessly when it is not empty.
    try { fs.rmdirSync(argv[2]); } catch (e) { /* not empty or gone */ }
    try {
      fs.renameSync(argv[1], argv[2]);
      process.exit(0);
    } catch (e) {
      process.exit(1);
    }
  }
  if (cmd === 'open') {
    // open <stateDir> <tokenFile> <urlHost>  -> exit 0 if a launcher ran
    const ok = await openBrowser(argv[1], argv[2], argv[3] || 'localhost');
    process.exit(ok ? 0 : 1);
  }
  process.stderr.write('{"error":"unknown lifecycle-lib command"}\n');
  process.exit(1);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(() => process.exit(1));
}

module.exports = { cmdlineOf, identityMatches, isReady, inspect, browserLauncherForPlatform, openBrowser };
