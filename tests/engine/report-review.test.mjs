// shared/report-review.js (2026-11-23): the Report review tools moved from apps/steel-bridge/ui/rpreview.js (PR #1646) to one shared copy
// used by Steel Bridge Design and Prestressed Bridge Design (CLAUDE.md §3). No DOM needed for these parts.
//   - each app's tools keep their own prefixed localStorage keys (§5): the steel app's are unchanged (sbd2.reportReview.v1, sbd2.reportToc:
//     comments saved before the move are read as before); the PS app's are psb2.reportReview.v1, psb2.reportToc;
//   - two apps never share a comment list (in Chromium every file:// page shares one localStorage);
//   - a key without an app prefix is refused; comment text is escaped; unreadable storage gives an empty list.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const W = loadShared('report-review.js', path.join(ROOT, 'apps/steel-bridge/ui/rpreview.js'), path.join(ROOT, 'apps/ps-bridge/ui/report.js'));
const store = new Map(); W.localStorage = { getItem: k => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: k => store.delete(k) };
const SR = W.SharedReportReview, SB = W.SBDReportReview, PS = W.PSBReportReview, J = v => JSON.parse(JSON.stringify(v));

test('shared/report-review.js: one namespace; the steel keys unchanged, the PS keys prefixed psb2.; the same API for both', () => {
  assert.deepEqual(Object.keys(SR).sort(), ['create', 'esc', 'projKey']);
  assert.equal(SB.KEY, 'sbd2.reportReview.v1'); assert.equal(SB.TOC_KEY, 'sbd2.reportToc');
  assert.equal(PS.KEY, 'psb2.reportReview.v1'); assert.equal(PS.TOC_KEY, 'psb2.reportToc');
  for (const R of [SB, PS]) assert.deepEqual(Object.keys(R).sort(), ['KEY', 'TOC_KEY', 'attach', 'esc', 'load', 'projKey', 'reviewedCopy', 'save']);
});
test('comments saved by the steel app before the move are read as before (the stored format is unchanged)', () => {
  store.clear(); const old = { '24-001 | Made-up bridge A': [{ id: 'rp-st1', where: '2.1 Loads', quote: '', text: 'one', author: 'A', ts: '2026-11-19T10:00:00.000Z', status: 'open' }] };
  store.set('sbd2.reportReview.v1', JSON.stringify(old));
  const P = { project: { number: '24-001', name: 'Made-up bridge A' } };
  assert.deepEqual(J(SB.load(P)), old['24-001 | Made-up bridge A']);
  SB.save(P, SB.load(P).concat([{ id: 'rp-st2', text: 'two', status: 'resolved' }]));
  assert.deepEqual(J(JSON.parse(store.get('sbd2.reportReview.v1'))['24-001 | Made-up bridge A'].map(c => c.text)), ['one', 'two']);
});
test('two apps never share a list: the same project name in both apps keeps two lists under two keys; the project object is not touched', () => {
  store.clear(); const P = { project: { number: 'EX-1', name: 'Made-up bridge' } }, p0 = JSON.stringify(P);
  SB.save(P, [{ id: 'a', text: 'steel', status: 'open' }]); PS.save(P, [{ id: 'b', text: 'ps', status: 'open' }]);
  assert.equal(SB.load(P)[0].text, 'steel'); assert.equal(PS.load(P)[0].text, 'ps'); assert.equal(JSON.stringify(P), p0);
  assert.deepEqual([...store.keys()].sort(), ['psb2.reportReview.v1', 'sbd2.reportReview.v1']);
  assert.equal(SR.projKey(P), 'EX-1 | Made-up bridge'); assert.equal(SR.projKey({}), 'untitled');
  store.set('psb2.reportReview.v1', '{broken'); assert.deepEqual(J(PS.load(P)), []); assert.equal(SB.load(P).length, 1);
});
test('a key without an app prefix is refused; comment text is escaped', () => {
  assert.throws(() => SR.create({ key: 'reportReview', tocKey: 'x.toc', title: 'T' }), /prefixed per app/);
  assert.throws(() => SR.create({ key: 'x.review', tocKey: 'toc', title: 'T' }), /prefixed per app/);
  const X = SR.create({ key: 'xyz1.reportReview.v1', tocKey: 'xyz1.reportToc', title: 'T' }); assert.equal(X.KEY, 'xyz1.reportReview.v1');
  assert.equal(SR.esc('<img src=x onerror="alert(1)"> & \'q\''), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;q&#39;'); assert.equal(PS.esc('<b>'), '&lt;b&gt;');
});
