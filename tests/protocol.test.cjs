// 通信の境界条件をNode.js標準テストで確認する。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseMessage, createDecoder, encode, MAX_LINE } = require('../packages/protocol/dist/index.js');

// 壊れたJSON・非対応版・無効な認証情報を拒否する。
test('rejects malformed and incompatible messages', () => {
  for (const value of ['{', 'null', '{"version":2,"type":"stop"}', '{"version":1,"type":"unknown"}', '{"version":1,"type":"hello","token":"short"}']) {
    assert.equal(parseMessage(value), null);
  }
  assert.equal(parseMessage(' '.repeat(MAX_LINE + 1)), null);
});

// 分割受信と一括受信で、順番を保って一度ずつ通知する。
test('decodes fragmented and combined messages', () => {
  const received = [];
  const decode = createDecoder(message => received.push(message), () => assert.fail('unexpected invalid message'));
  const first = encode({ version: 1, type: 'hello', token: 'a'.repeat(64) });
  decode(first.slice(0, 12));
  assert.equal(received.length, 0);
  decode(first.slice(12) + encode({ version: 1, type: 'ready' }));
  assert.deepEqual(received.map(message => message.type), ['hello', 'ready']);
});

// 不正入力後は追加の命令を実行せず、バッファの肥大化を止める。
test('fails closed on invalid or oversized frames', () => {
  let invalid = 0;
  const messages = [];
  const decode = createDecoder(message => messages.push(message), () => invalid++);
  decode('bad\n' + encode({ version: 1, type: 'stop' }));
  decode(encode({ version: 1, type: 'stop' }));
  assert.equal(invalid, 1);
  assert.equal(messages.length, 0);
  const oversized = createDecoder(() => assert.fail(), () => invalid++);
  oversized('x'.repeat(MAX_LINE + 1));
  assert.equal(invalid, 2);
});

// 保存通知を受け付け、配列など文字列以外の種類指定は拒否する。
test('validates save notification types', () => {
  assert.deepEqual(parseMessage('{"version":1,"type":"saved"}'), { version: 1, type: 'saved' });
  assert.equal(parseMessage('{"version":1,"type":["saved"]}'), null);
});
