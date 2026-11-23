// Report review tools (apps/steel-bridge/ui/rpreview.js, 2026-11-19): comments kept per project under the prefixed key sbd2.reportReview.v1
// (CLAUDE.md §5: a new key, additive; the project file unchanged); every comment text HTML-escaped; no DOM needed for these parts.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const W = loadShared('report-review.js', path.join(ROOT, 'apps/steel-bridge/ui/rpreview.js')), R = W.SBDReportReview;   // 2026-11-23: the code is shared/report-review.js; rpreview.js gives it this app's keys
const store = new Map(); W.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };

test('keys are prefixed (sbd2.*), comments are kept per project, the project object is not touched', () => {
  assert.ok(/^sbd2\./.test(R.KEY) && /^sbd2\./.test(R.TOC_KEY));
  const A = { project: { number: '24-001', name: 'Made-up bridge A' } }, B = { project: { name: 'Made-up bridge B' } }, a0 = JSON.stringify(A);
  assert.equal(R.projKey(A), '24-001 | Made-up bridge A'); assert.equal(R.projKey({}), 'untitled');
  R.save(A, [{ id: 'rp-st1', text: 'one', status: 'open' }]); R.save(B, [{ id: 'rp-st2', text: 'two', status: 'resolved' }]);
  assert.deepEqual(JSON.parse(JSON.stringify(R.load(A))), [{ id: 'rp-st1', text: 'one', status: 'open' }]); assert.equal(R.load(B)[0].text, 'two');
  assert.equal(JSON.stringify(A), a0); assert.equal([...store.keys()].join(','), R.KEY);
  store.set(R.KEY, '{broken'); assert.deepEqual(JSON.parse(JSON.stringify(R.load(A))), []);   // unreadable: an empty list, no throw
});
test('comment text is escaped (no markup injection)', () => {
  assert.equal(R.esc('<img src=x onerror="alert(1)"> & \'q\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;q&#39;');
});
