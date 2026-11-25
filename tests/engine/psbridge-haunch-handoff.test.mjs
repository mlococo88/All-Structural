// HHO (2026-11-25, engineer: "The haunch that gets passed to other apps should get fixed to include the full thickness"): the PS Bridge app's
// geometry hand-off (superGeometry, HANDOFF.md §4.14) sends the haunch at the CL bearings beside the entered minimum, and Bridge Substructure
// Loading takes it for its one haunch. Round trip on a design made here:
//   1. sender (apps/ps-bridge/engine/handoffs.js sgPayload, with engine/haunch.js): deck.haunch = t_h (unchanged meaning and format),
//      deck.haunchBrg = t_h + Δ_deck (the largest over every girder type and line), deck.haunchMid = t_h; the shared §4.14 check and the
//      receiver's own check accept it; a note says what each field is;
//   2. JSON round trip; the receiver's own code (Bridge Substructure Loading.html haunchIn, cut at its anchors): br.haunch = deck.haunchBrg;
//      an older payload (no haunchBrg; the Steel Bridge app sends none): deck.haunch, as before; a bad haunchBrg is not used;
//   3. hand check of the receiver's superstructure depth at the supports d_sup = (t_s + haunch + d)/12, as its own expression;
//   4. without engine/haunch.js (no corrected profile) the payload is the one sent before (no new fields).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = h => ['sections', 'model', 'rigid', 'lldf-fg', ...(h ? ['haunch'] : []), 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs'].map(n => path.join(APP, `engine/${n}.js`));
const W = loadShared('steps.js', 'handoff-store.js', ...PBDF, ...ENG(true)), W0 = loadShared('steps.js', 'handoff-store.js', ...PBDF, ...ENG(false));
[W, W0].forEach(w => { w.BridgeBeam = { get: () => null }; w.BridgeXfer = { sharedProject: () => null }; });
const J = v => JSON.parse(JSON.stringify(v));
const cellsOf = (w, P) => w.PSBBridge.results(P, inp => w.PSBHoldDown.compute(J(inp))).cells;
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

// the receiver's own code, cut at its anchors
const BSL = fs.readFileSync(path.join(ROOT, 'Bridge Substructure Loading.html'), 'utf8');
function cut(a, b, from) { const i = BSL.indexOf(a, from || 0), j = BSL.indexOf(b, i); assert.ok(i > 0 && j > i, 'anchor ' + a); return BSL.slice(i, j); }
const RCV = (() => { const s = BSL.indexOf('(function patchGeoHandoff() {');
  const C = { HS: () => W.SharedHandoffStore, Math, Number, isFinite, num: v => { const x = parseFloat(v); return isFinite(x) ? x : 0; } }; vm.createContext(C);
  vm.runInContext(cut('  const concrete = p =>', '\n', s) + '\n' + cut('  function check(p) {', '  function depthOf', s) + '\n' + cut('  const haunchIn = p =>', '  /* plan()', s) + '\nthis.check = check; this.haunchIn = haunchIn;', C);
  return C; })();
const DSUP = cut('  const dSup = ', '\n').trim();
assert.equal(DSUP, 'const dSup = (nz(b.ts) + nz(b.haunch) + nz(b.d)) / 12;', 'receiver superstructure depth as copied below');

/* the test design: NEXT 24F, one 45 ft span, flange 120 in (S = 10 ft), t_s = 8 in, t_h = 2 in, straight strands 16 / 16 / 12,
   w_NC 0, w_DC2 0.5, w_DW 0.3 klf (a haunch test case only: it is overstressed at release); every line the same girder type */
function project(w) { const P = w.PSBModel.newProject(); P.project.name = 'Haunch hand-off check'; P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10);
  P.base.ts = 8; P.base.th = 2; P.base.rows = [{ n: 16, y: 2.875, dbnd: 0, nd: 0 }, { n: 16, y: 4.875, dbnd: 0, nd: 0 }, { n: 12, y: 6.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
  P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; w.PSBBridge.syncSpans(P); return P; }

test('sender: deck.haunch = t_h (as before), deck.haunchBrg = t_h + Δ_deck, deck.haunchMid; the §4.14 checks accept it', () => {
  const P = project(W), cells = cellsOf(W, P), r = W.PSBHandoffs.sgPayload(P, cells); assert.ok(r.ok, r.error);
  const p = r.payload, hp = cells.map(c => c.R.hp), d = hp[0].d;
  assert.ok(hp.every(h => h && Object.is(h.d, d)), 'one girder type, the same Δ_deck on every line');
  assert.equal(d.toFixed(3), '3.346'); assert.equal(p.deck.haunch, 2);
  assert.equal(p.deck.haunchBrg, Math.round((2 + d) * 1e4) / 1e4); assert.equal(p.deck.haunchBrg.toFixed(2), '5.35'); assert.equal(p.deck.haunchMid, 2);
  assert.ok(W.SharedHandoffStore.checkGeometry(p).ok); const c = RCV.check(J(p)); assert.ok(c.ok, c.errors.join('; '));
  assert.ok(p.notes.some(n => /deck\.haunchBrg = 5\.35, the haunch at the CL bearings, t_h \+ Δ_deck \(the camber at deck placement\) = 2\.00 \+ 3\.35/.test(n)), p.notes.join(' | '));
  const h = W.PSBHandoffs.haunchSent(cells); assert.equal(h.brg, hp[0].brg); assert.equal(h.th, 2);
});

test('round trip: the receiver takes deck.haunchBrg; an older payload (as from the Steel Bridge app: no haunchBrg) keeps deck.haunch; hand check of d_sup', () => {
  const P = project(W), p = J(W.PSBHandoffs.sgPayload(P, cellsOf(W, P)).payload);
  const hi = RCV.haunchIn(p); assert.equal(hi.brg, true); assert.equal(hi.v, p.deck.haunchBrg); assert.equal(hi.min, 2); assert.equal(hi.mid, 2);
  // the receiver's superstructure depth at the supports, its own expression: (t_s + haunch + d)/12 = (8 + 5.3458 + 24)/12 = 3.1122 ft (before (8 + 2 + 24)/12 = 2.8333 ft)
  const nz = v => +v || 0, dSup = b => vm.runInNewContext(DSUP + ' dSup', { nz, b });
  const after = dSup({ ts: p.deck.ts, haunch: hi.v, d: p.section.depth }), before = dSup({ ts: p.deck.ts, haunch: p.deck.haunch, d: p.section.depth });
  near(after, (8 + p.deck.haunchBrg + 24) / 12, 1e-12, 'd_sup after'); near(before, 34 / 12, 1e-12, 'd_sup before'); assert.equal(after.toFixed(4), '3.1121'); assert.equal(before.toFixed(4), '2.8333');
  // an older payload (no haunchBrg), a bad value: deck.haunch as before
  const old = J(p); delete old.deck.haunchBrg; delete old.deck.haunchMid; assert.deepEqual(J(RCV.haunchIn(old)), { v: 2, brg: false });
  for (const bad of [-1, 'x', null, NaN]) { const q = J(p); q.deck.haunchBrg = bad; assert.equal(RCV.haunchIn(q).v, 2, String(bad)); }
  // without the corrected profile (engine/haunch.js not loaded) the sender sends what it sent before: no new fields
  const P0 = project(W0), p0 = W0.PSBHandoffs.sgPayload(P0, cellsOf(W0, P0)).payload;
  assert.deepEqual(Object.keys(p0.deck), ['ts', 'total', 'haunch']); assert.equal(W0.PSBHandoffs.haunchSent(cellsOf(W0, P0)), null);
  const a = J(p), b = J(p0); delete a.deck.haunchBrg; delete a.deck.haunchMid; a.notes = a.notes.slice(0, -1); ['producedAt', 'contentHash'].forEach(k => { delete a[k]; delete b[k]; });
  assert.deepEqual(a, b, 'every other field as before');
});
