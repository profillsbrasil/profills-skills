'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

function readTrim(file) {
  return fs.readFileSync(file, 'utf8').trim();
}

function cmdlineOf(pid) {
  try {
    return fs.readFileSync('/proc/' + pid + '/cmdline', 'utf8').split('\0');
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

function chatJson(status, port, urlHost) {
  return JSON.stringify({
    status,
    url: 'http://' + urlHost + ':' + Number(port) + '/',
    port: Number(port)
  }) + '\n';
}

async function main(argv) {
  const cmd = argv[0];
  if (cmd === 'ready') {
    const snap = await isReady(argv[1]);
    process.exit(snap ? 0 : 1);
  }
  if (cmd === 'print') {
    const status = argv[1];
    const stateDir = argv[2];
    const urlHost = argv[3] || 'localhost';
    const snap = inspect(stateDir);
    if (!snap) {
      process.stderr.write('{"error":"missing server-info"}\n');
      process.exit(1);
    }
    process.stdout.write(chatJson(status, snap.port, urlHost));
    return;
  }
  process.stderr.write('{"error":"unknown lifecycle-lib command"}\n');
  process.exit(1);
}

if (require.main === module) {
  main(process.argv.slice(2)).catch(() => process.exit(1));
}
