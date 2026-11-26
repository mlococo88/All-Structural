// apps/ps-bridge AP-B (2026-11-23): the line-girder applicability check and the ranges of applicability of the live-load distribution factor
// equations for every section family (engine/applicability.js window.PSBApplic; fixlog/ps-bridge.md AP-B). Made-up bridges.
//   1. Inside every range (the 19 harness B designs and a new project, every girder type × line): no check and no warning added; the
//      result equals that of the app loaded without engine/applicability.js except the new field R.ap (every ratio identical).
//   2. Hand cases: in range (each value against its range); out of range: S, N_b, the skew above 60°, d_e, t_s, K_g: the FAIL check, its
//      ratio, the warning; entered distribution factors: not flagged; a box beam (types f / g): N_b fails, I / J a note; a NEDBT with no
//      topping (PS-42): a warning, not a FAIL.
//   3. The worked steps ld.ap.* (each value, its range, the result).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'pl', 'applicability', 'reltension', 'holddown', 'pierblock', 'rating-along', 'design', 'bridge', 'bridge-dl', 'demands', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'];
const load = list => loadShared('steps.js', ...PBDF, ...list.map(n => path.join(APP, `engine/${n}.js`)));
const W = load(ENG), W0 = load(ENG.filter(n => n !== 'applicability'));
const M = W.PSBModel, D = W.PSBDesign, AP = W.PSBApplic;
const J = v => JSON.parse(JSON.stringify(v));
const tag = v => Number.isNaN(v) ? '$NaN' : v === Infinity ? '$+Inf' : v === -Infinity ? '$-Inf' : Object.is(v, -0) ? '$-0' : v;
function canon(v, L, st = []) {
  if (typeof v === 'number') return tag(v);
  if (v === undefined) return '$undef';
  if (typeof v === 'function') { const l = +L > 0 ? +L : 100, a = v.length <= 1 ? [0, 2.5, l * 0.4, l / 2, l].map(x => [x]) : [[l * 0.3, 250, 170, 1]].map(q => q.slice(0, v.length));
    return { $fn: a.map(q => { try { return canon(v(...q), L, st); } catch (e) { return { $throw: String(e && e.message) }; } }) }; }
  if (v === null || typeof v !== 'object') return v;
  if (st.includes(v)) return '$cycle';
  if (ArrayBuffer.isView(v)) return Array.from(v, tag);
  st.push(v); let o; if (Array.isArray(v)) o = v.map(x => canon(x, L, st)); else { o = {}; for (const k of Object.keys(v)) o[k] = canon(v[k], L, st); } st.pop(); return o;
}
const text = (R, L) => JSON.stringify(canon(R, L));
const run = P => { const i = D.inputs(P); return { i, R: W.PSBHoldDown.compute(J(i)) }; };
const item = (a, k) => a.items.find(q => q.key === k);
const chk = R => R.checks.find(c => c.n === AP.NAME);
// the made-up bridge: a new project (5 girders at 9 ft, overhangs 3 ft, one 120 ft span, BT-72, 8 in deck, no skew); G2 is shown
const bridge = f => { const P = M.newProject(); if (f) f(P); return P; };

test('inside every range (19 harness B designs + a new project, every type × line): no check, no warning; only R.ap is new', () => {
  const cases = Object.assign({ newProject: M.newProject() }, TAB_CASES(() => M.defaultProject())); let n = 0;
  for (const [name, P0] of Object.entries(cases)) {
    const P = M.importJSON(M.exportJSON(P0)).project, P2 = W0.PSBModel.importJSON(M.exportJSON(P0)).project; W.PSBBridge.fill(P); W0.PSBBridge.fill(P2);
    W.PSBBridge.cells(P).forEach(c => { const i = D.cellInputs(P, c.k, c.g), R = W.PSBHoldDown.compute(J(i)), R0 = W0.PSBHoldDown.compute(J(W0.PSBDesign.cellInputs(P2, c.k, c.g)));
      if (R.error) { assert.equal(R.error, R0.error); return; }
      assert.ok(R.ap && R.ap.level !== 'fail', `${name} G${c.g}: ${R.ap && R.ap.text}`); assert.equal(chk(R), undefined);
      const ap = R.ap; delete R.ap; assert.equal(text(R, i.L), text(R0, i.L), `${name} G${c.g}/S${c.s}`); R.ap = ap; n++; });
  }
  assert.ok(n >= 140, 'cells ' + n);
  console.log(`  AP-B: ${n} girder type × line results inside their ranges: identical with and without engine/applicability.js (0 checks added)`);
});

test('hand case in range: 120 ft, 5 BT-72 at 9 ft, t_s 8 in, exterior d_e = 3 − 1.5 = 1.5 ft', () => {
  const { i, R } = run(bridge()), a = R.ap;
  assert.equal(a.level, 'ok'); assert.equal(a.family, 'k'); assert.equal(a.bad.length, 0); assert.equal(chk(R), undefined);
  // each value against its range: 3.5 ≤ 9 ≤ 16; 4.5 ≤ 8 ≤ 12; 20 ≤ 120 ≤ 240; 5 ≥ 4; 10,000 ≤ K_g ≤ 7,000,000; θ = 0 ≤ 60
  assert.equal(item(a, 'S').value, 9); assert.deepEqual([item(a, 'S').lo, item(a, 'S').hi], [3.5, 16]);
  assert.equal(item(a, 'ts').value, i.ts); assert.deepEqual([item(a, 'ts').lo, item(a, 'ts').hi], [4.5, 12]);
  assert.equal(item(a, 'L').value, 120); assert.deepEqual([item(a, 'L').lo, item(a, 'L').hi], [20, 240]);
  assert.equal(item(a, 'Nb').value, 5); assert.equal(item(a, 'Nb').lo, 4);
  assert.equal(item(a, 'Kg').value, R.df.Kg); assert.ok(R.df.Kg > 1e4 && R.df.Kg < 7e6); assert.deepEqual([item(a, 'Kg').lo, item(a, 'Kg').hi], [10000, 7000000]);
  assert.equal(item(a, 'th').value, 0); assert.equal(item(a, 'de'), undefined, 'interior: no d_e');
  assert.ok(a.items.every(q => q.ok));
  const P = bridge(); P.design = { g: 1, s: 1 }; W.PSBBridge.fill(P); const e = run(P).R.ap;
  assert.equal(item(e, 'de').value, 1.5); assert.deepEqual([item(e, 'de').lo, item(e, 'de').hi], [-1, 5.5]); assert.equal(e.level, 'ok');
});

test('hand cases out of range: S = 17 ft, N_b = 3, θ = 65°, d_e = 6.5 ft, t_s = 4 in: the FAIL check, its ratio and the warning', () => {
  // S = 17 ft > 16: ratio 17 / 16 = 1.0625
  let q = run(bridge(P => { P.xs.bays = [17, 17, 17, 17]; })), c = chk(q.R);
  assert.equal(q.R.ap.level, 'fail'); assert.deepEqual(J(q.R.ap.bad.map(b => b.key)), ['S']); assert.ok(c && c.pass === false); assert.equal(c.v, 1); assert.ok(Math.abs(c.r - 17 / 16) < 1e-12);
  assert.match(q.R.warns[q.R.warns.length - 1], /S = 17 ft \(3\.5 ≤ S ≤ 16 ft, Tables 4\.6\.2\.2\.2b-1, 4\.6\.2\.2\.3a-1\)/); assert.match(q.R.ap.text, /FAIL/);
  // the distribution factors themselves are the engine's (not changed by the check)
  const W1 = W0, r0 = W1.PSBHoldDown.compute(J(W1.PSBDesign.inputs(bridge(P => { P.xs.bays = [17, 17, 17, 17]; }))));
  assert.equal(q.R.dfm, r0.dfm); assert.equal(q.R.dfv, r0.dfv); assert.equal(q.R.checks.length, r0.checks.length + 1);
  // N_b = 3 < 4: ratio 4 / 3
  q = run(bridge(P => { P.xs.nb = 3; P.xs.bays = [9, 9]; })); c = chk(q.R);
  assert.deepEqual(J(q.R.ap.bad.map(b => b.key)), ['Nb']); assert.ok(Math.abs(c.r - 4 / 3) < 1e-12);
  // θ = 65° > 60°: ratio 65 / 60 (the engine caps θ at 60° for the factors)
  q = run(bridge(P => { P.xs.skews = [65, 65]; })); c = chk(q.R);
  assert.deepEqual(J(q.R.ap.bad.map(b => b.key)), ['th']); assert.ok(Math.abs(c.r - 65 / 60) < 1e-12); assert.equal(q.R.df.th, 60);
  assert.ok(q.R.ap.extra.some(x => x.id === 'sk20' && x.level === 'note'));
  // exterior G1 with an 8 ft overhang: d_e = 8 − 1.5 = 6.5 ft > 5.5: ratio 6.5 / 5.5
  q = run(bridge(P => { P.xs.ohL = 8; P.design = { g: 1, s: 1 }; })); c = chk(q.R);
  assert.deepEqual(J(q.R.ap.bad.map(b => b.key)), ['de']); assert.ok(Math.abs(c.r - 6.5 / 5.5) < 1e-12);
  // t_s = 4 in < 4.5: ratio 4.5 / 4
  q = run(bridge(P => { P.base.ts = 4; })); c = chk(q.R);
  assert.deepEqual(J(q.R.ap.bad.map(b => b.key)), ['ts']); assert.ok(Math.abs(c.r - 4.5 / 4) < 1e-12);
  // two at once: the larger ratio governs, v = 2
  q = run(bridge(P => { P.xs.bays = [17, 17, 17, 17]; P.xs.skews = [70, 70]; })); c = chk(q.R);
  assert.equal(c.v, 2); assert.ok(Math.abs(c.r - 70 / 60) < 1e-12);
  // skews 20° < θ ≤ 60°: a note only
  q = run(bridge(P => { P.xs.skews = [35, 35]; })); assert.equal(q.R.ap.level, 'note'); assert.equal(chk(q.R), undefined);
  console.log('  AP-B hand cases: S 17 ft → r 1.0625; N_b 3 → 1.3333; θ 65° → 1.0833; d_e 6.5 ft → 1.1818; t_s 4 in → 1.1250 (each FAIL)');
});

test('entered distribution factors are not flagged', () => {
  const q = run(bridge(P => { P.xs.bays = [17, 17, 17, 17]; P.xs.skews = [65, 65]; P.base.loads.dfAuto = false; P.base.loads.dfm = 0.9; P.base.loads.dfv = 1.1; }));
  assert.equal(q.R.ap.entered, true); assert.notEqual(q.R.ap.level, 'fail'); assert.equal(chk(q.R), undefined); assert.ok(!q.R.warns.some(w => /range of applicability/.test(w) && /FAIL/.test(w)));
});

test('families: NEXT (types i / j), box beams (types f / g: N_b fails, I / J a note), NEDBT with no topping (PS-42: a warning)', () => {
  const cases = TAB_CASES(() => M.defaultProject());
  const pick = re => { const k = Object.keys(cases).find(n => re.test(n)); assert.ok(k, String(re)); const P = M.importJSON(M.exportJSON(cases[k])).project; W.PSBBridge.fill(P); return P; };
  // NEXT: S = the beam width
  let P = pick(/^NEXT/), q = run(P); assert.equal(q.R.ap.family, 'next'); assert.equal(item(q.R.ap, 'S').value, q.R.df.Sf); assert.equal(q.R.ap.level, 'ok');
  // box beam: 5 beams inside; 4 beams: N_b outside 5 to 20 (ratio 5 / 4)
  P = pick(/^box BIII-36, no topping/); q = run(P); assert.equal(q.R.ap.family, 'fg'); assert.equal(q.R.ap.level === 'fail', false);
  const nb = P.xs.nb; P.xs.nb = 4; P.xs.bays = P.xs.bays.slice(0, 3); W.PSBBridge.fill(P);
  if (W.PSBInputCheck.collect(P).errors.length === 0) { q = run(P); assert.ok(q.R.ap.bad.some(b => b.key === 'Nb'), 'N_b = 4 of a box'); assert.ok(chk(q.R)); assert.ok(chk(q.R).r >= 5 / 4 - 1e-12); }
  assert.ok(nb >= 5);
  // I / J outside: a note (4.6.2.2.3a), never a FAIL
  const fake = { df: { fg: { type: 'f', kind: 'box beams', b: 48, L: 60, Nb: 8, I: 30000, J: 20000, ext: false, rawSkew: 0, thV: 0, d: 27 } }, checks: [], warns: [] };
  const a = AP.of({ loads: { dfAuto: true, skew: 0 }, ts: 5 }, fake); assert.equal(a.level, 'note'); assert.equal(a.bad.length, 0); assert.equal(item(a, 'I').ok, false);
  // PS-42: a MassDOT NEDBT with t_s = 0: the t_s item is a warning
  const nm = Object.keys(W.PSBSections.MD).find(k => W.PSBSections.MD[k].src.fam === 'nedbt'); assert.ok(nm);
  const b2 = AP.of({ girder: nm, ts: 0, S: 5, L: 80, nGirders: 6, loads: { dfAuto: true, llAuto: true, skew: 0 } }, { df: { Kg: 2e6, ext: false }, checks: [], warns: [] });
  assert.equal(item(b2, 'ts').level, 'warn'); assert.equal(b2.level, 'warn'); assert.equal(b2.bad.length, 0);
  // any other I-girder with t_s = 0: FAIL
  const b3 = AP.of({ girder: 'BT-72', ts: 0, S: 5, L: 80, nGirders: 6, loads: { dfAuto: true, llAuto: true, skew: 0 } }, { df: { Kg: 2e6, ext: false }, checks: [], warns: [] });
  assert.equal(b3.level, 'fail'); assert.deepEqual(J(b3.bad.map(x => x.key)), ['ts']);
});

test('worked steps ld.ap.*: each value, its range, the result; the count = the check\'s value', () => {
  for (const f of [null, P => { P.xs.bays = [17, 17, 17, 17]; }]) {
    const { i, R } = run(bridge(f)), L = W.PSBWorked.loads(i, R), S = L.steps.filter(s => /^ld\.ap\./.test(s.id));
    assert.deepEqual(J(S.map(s => s.id)), ['ld.ap.S', 'ld.ap.ts', 'ld.ap.L', 'ld.ap.Nb', 'ld.ap.Kg', 'ld.ap.th', 'ld.ap.r']);
    const r = S.find(s => s.id === 'ld.ap.r'), s = S.find(q => q.id === 'ld.ap.S');
    assert.equal(r.value, f ? 1 : 0); assert.equal(r.ok, !f); assert.equal(s.ok, !f); assert.match(s.note, f ? /OUTSIDE/ : /Inside/); assert.match(s.note, /3\.5 ≤ S ≤ 16 ft/);
    L.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), p.id));
  }
});
