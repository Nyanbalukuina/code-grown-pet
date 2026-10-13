// 実際のElectronに接続し、開始・応答・終了の生存期間を確認する。
const { createServer } = require('node:net');
const { spawn } = require('node:child_process');
const { randomBytes } = require('node:crypto');
const { join } = require('node:path');
const { createRequire } = require('node:module');
const assert = require('node:assert/strict');
const { createDecoder, encode } = require('../packages/protocol/dist/index.js');
const companion = join(__dirname, '../packages/companion');
const electron = createRequire(join(companion, 'package.json'))('electron');

// 各シナリオのソケット・子プロセスを必ず終了する。
async function scenario(mode) {
  const pipe = `\\\\.\\pipe\\pet-smoke-${randomBytes(12).toString('hex')}`;
  const token = randomBytes(32).toString('hex');
  let socket;
  let child;
  let authenticated = false;
  let ready = false;
  let stderr = '';
  const server = createServer(candidate => {
    socket = candidate;
    candidate.setEncoding('utf8');
    candidate.on('error', () => {});
    candidate.on('data', createDecoder(message => {
      if (message.type === 'hello') { assert.equal(message.token, token); authenticated = true; }
      if (message.type === 'ready') {
        assert.ok(authenticated);
        ready = true;
        if (mode === "disconnect") candidate.destroy();
        else if (mode === "timeout") return;
        else candidate.write(encode({ version: 1, type: 'ping' }));
      }
      if (message.type === 'ping') {
        candidate.write(encode({ version: 1, type: 'toggle' }));
        candidate.write(encode({ version: 1, type: 'toggle' }));
        candidate.write(encode({ version: 1, type: 'stop' }));
      }
    }, () => candidate.destroy()));
  });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, resolve); });
  try {
    const env = { ...process.env, CODE_GROWN_PET_PIPE: pipe, CODE_GROWN_PET_TOKEN: token };
    delete env.ELECTRON_RUN_AS_NODE;
    child = spawn(electron, [companion], { env, windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    child.stderr.on('data', chunk => stderr += chunk.toString());
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Smoke timeout: ' + stderr)), 20000);
      child.once('error', error => { clearTimeout(timeout); reject(error); });
      child.once('exit', code => {
        clearTimeout(timeout);
        if (!ready) reject(new Error('No ready event. Close any existing pet first. ' + stderr));
        else if (code !== 0) reject(new Error('Exit code: ' + code + ' ' + stderr));
        else resolve();
      });
    });
    console.log(mode === 'disconnect' ? 'PASS: connection loss exits companion' : mode === 'timeout' ? 'PASS: heartbeat timeout exits companion' : 'PASS: handshake, heartbeat, toggle, graceful stop');
  } finally {
    socket?.destroy();
    server.close();
    if (child && child.exitCode === null) child.kill();
  }
}

// 通常停止と、拡張が異常終了した状況を順番に試す。
(async () => { await scenario("normal"); await scenario("disconnect"); await scenario("timeout"); })().catch(error => { console.error(error); process.exitCode = 1; });

