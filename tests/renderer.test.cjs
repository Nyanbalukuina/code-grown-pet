// 描画コードを小さなDOM代替で実行し、保存通知・動きの抑制・解除を確認する。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { runInNewContext } = require('node:vm');

// preloadの通知とWeb Animationsを代替し、描画の境界を検証する。
for (const reduced of [false, true]) {
  test(`save animation and cleanup (reduced motion: ${reduced})`, () => {
    let saved;
    let cleanup;
    let cancelled = 0;
    let unsubscribed = false;
    const animations = [];
    runInNewContext(readFileSync(join(__dirname, '../packages/companion/dist/renderer/index.js'), 'utf8'), {
      pet: { onSaved(callback) { saved = callback; return () => { unsubscribed = true; }; } },
      document: { querySelector() { return { animate(frames, options) { animations.push({ frames, options }); return { cancel() { cancelled++; } }; } }; } },
      window: { matchMedia() { return { matches: reduced }; }, addEventListener(event, callback) { assert.equal(event, 'beforeunload'); cleanup = callback; } },
    });
    assert.equal(animations.length, 0);
    saved();
    saved();
    assert.equal(animations.length, 2);
    assert.equal(cancelled, 1);
    assert.equal(animations[0].options.duration, 650);
    assert.equal('transform' in animations[0].frames[0], !reduced);
    cleanup();
    assert.ok(unsubscribed);
    assert.equal(cancelled, 2);
  });
}
