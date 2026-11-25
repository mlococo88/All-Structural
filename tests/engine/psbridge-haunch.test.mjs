// apps/ps-bridge HP (2026-11-25, engineer decision: t_h is the MINIMUM haunch, at midspan, at the girder centreline): the haunch along the
// girder t_h(x) = max(t_h + Δ_deck(1 − ψ), 0.5), ψ = 4x(L − x)/L² (engine/haunch.js, window.PSBHaunch, after computeAll; the moved engine is
// not edited). Made-up designs from the app's default project.
//   1. hand check: NEXT 24F, L = 45 ft, S = 10 ft, t_h = 2 in, 44 straight strands (Δ_deck = 3.346 in): midspan 5.35 -> 2.00 in, bearings
//      2.00 -> 5.35 in, 0.1L 3.20 -> 4.14 in; only R.haunch[i].buildup changes (and buildup0, R.hp are added): the page's whole result with
//      and without the correction, value by value;
//   2. Δ_deck < 0 (decision pending engineer review): the minimum t_h at the bearings, t_h + |Δ_deck| at midspan;
//   3. RIDOT BDM 9.4.6: one warning when the haunch is thicker than 4 in (RIDOT only; not at 4 in or less; not for box beams);
//   4. the anchors in the frozen engine's computeAll; a changed engine value is an error, not a silent second correction;
//   5. the worked steps (midspan, bearings) carry the result's values; every tab case: only the haunch values and the RIDOT warning differ.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...['sections', 'model', 'lldf-fg', 'deckdist', 'haunch', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-end'].map(n => path.join(APP, `engine/${n}.js`)));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const design = (f) => { const P = W.PSBModel.defaultProject(); if (f) f(P); assert.deepEqual([...W.PSBInputCheck.collect(P).errors.map(e => e.msg)], []); return P; };
/* the test design of the investigation: NEXT 24F, 45 ft, flange 120 in (S = 10 ft), t_h = 2 in, straight strands 16 / 16 / 12,
   w_NC 0, w_DC2 0.5 klf, w_DW 0.3 klf (a haunch test case only: it is overstressed at release) */
const next45 = (f) => design(P => { P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10); P.base.ts = 8; P.base.th = 2;
  P.base.rows = [{ n: 16, y: 2.875, dbnd: 0, nd: 0 }, { n: 16, y: 4.875, dbnd: 0, nd: 0 }, { n: 12, y: 6.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
  P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; if (f) f(P); });
function both(P) {
  const R = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)), keep = W.PSBHaunch;
  W.PSBHaunch = undefined; let R0; try { R0 = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)); } finally { W.PSBHaunch = keep; }
  return { R, R0 };
}
function diff(a, b, at = '', out = [], seen = new Set()) {
  if (typeof a === 'function' || typeof b === 'function') return out;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (!Object.is(a, b)) out.push(at); return out; }
  if (seen.has(a)) return out; seen.add(a);
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diff(a[k], b[k], at ? `${at}.${k}` : k, out, seen));
  return out;
}
const isHP = p => /^haunch\.\d+\.buildup0?$/.test(p) || /^hp(\.|$)/.test(p);

test('hand check: NEXT 24F 45 ft, t_h = 2 in: midspan 5.35 -> 2.00, bearings 2.00 -> 5.35, 0.1L 3.20 -> 4.14 in; only the haunch differs', () => {
  const P = next45(), { R, R0 } = both(P), d = R.cam.afterDeck, H = R.haunch;
  assert.equal(R.g.isNext, true); assert.equal(R.g.btf, 120); assert.equal(R.L, 45);
  assert.equal(d.toFixed(3), '3.346'); assert.ok(Object.is(d, R0.cam.afterDeck));
  // before (the engine): t_h + Δ ψ; after: t_h + Δ (1 − ψ)
  assert.equal(H[5].buildup0.toFixed(2), '5.35'); assert.equal(H[5].buildup.toFixed(2), '2.00');
  assert.equal(H[0].buildup0.toFixed(2), '2.00'); assert.equal(H[0].buildup.toFixed(2), '5.35'); assert.equal(H[10].buildup.toFixed(2), '5.35');
  assert.equal(H[1].par.toFixed(2), '0.36'); assert.equal(H[1].buildup0.toFixed(2), '3.20'); assert.equal(H[1].buildup.toFixed(2), '4.14');
  H.forEach((r, i) => { near(r.buildup, 2 + d * (1 - r.par), 1e-12, 'x = ' + r.x); assert.ok(Object.is(r.buildup0, R0.haunch[i].buildup)); });
  assert.equal(R.hp.mid, H[5].buildup); assert.equal(R.hp.brg, H[0].buildup); assert.equal(R.hp.min, 2); near(R.hp.max, 2 + d, 1e-12); assert.equal(R.hp.neg, false);
  assert.equal(R.hp.warn, null, 'AASHTO: no RIDOT warning');
  assert.deepEqual(diff(R, R0).filter(p => !isHP(p)), [], 'nothing else of R changes');
});

test('Δ_deck < 0 (decision pending engineer review): t_h kept at the bearings, t_h + |Δ_deck| at midspan', () => {
  const P = next45(P => { P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; }), { R, R0 } = both(P), d = R.cam.afterDeck, H = R.haunch;
  assert.ok(d < 0, 'sag at deck placement: ' + d);
  near(H[0].buildup, 2, 1e-12, 'bearings'); near(H[5].buildup, 2 - d, 1e-12, 'midspan'); assert.equal(R.hp.neg, true); assert.equal(R.hp.min, 2);
  H.forEach(r => assert.ok(r.buildup >= 2 - 1e-12, 'never thinner than t_h'));
  assert.deepEqual(diff(R, R0).filter(p => !isHP(p)), []);
  const st = W.PSBWorkedEnd.camber(W.PSBDesign.inputs(P), R).steps;
  assert.ok(/pending engineer review/.test(st.find(s => s.id === 'cb.haunch').note));
});

test('RIDOT BDM 9.4.6: one warning when the haunch is thicker than 4 in (RIDOT only, not at 4 in or less, not for box beams)', () => {
  const P = next45(P => { P.base.owner = 'RIDOT'; }), R = W.PSBHoldDown.compute(W.PSBDesign.inputs(P));
  assert.equal(R.hp.owner, 'RIDOT'); assert.equal(R.hp.lim, 4);
  const w = R.warns.filter(x => W.PSBHaunch.WARN_RE.test(x)); assert.equal(w.length, 1); assert.equal(w[0], R.hp.warn);
  assert.ok(/haunch up to 5\.35 in \(at the bearings/.test(w[0]), w[0]);
  for (const ow of ['AASHTO', 'MassDOT', 'CTDOT']) { const Q = next45(P => { P.base.owner = ow; }), Rq = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q));
    assert.ok(!Rq.warns.some(x => W.PSBHaunch.WARN_RE.test(x)), ow); assert.equal(Rq.hp.lim, null); }
  // 4 in or less: t_h = 0.5 in + Δ (3.40 in with the lighter haunch) = 3.90 in at the bearings
  const Q = next45(P => { P.base.owner = 'RIDOT'; P.base.th = 0.5; }), Rq = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q));
  assert.ok(Rq.hp.max <= 4, String(Rq.hp.max)); assert.ok(!Rq.warns.some(x => W.PSBHaunch.WARN_RE.test(x)));
  // box beam: no haunch in this engine, no warning
  const B = design(P => { P.base.owner = 'RIDOT'; P.base.girder = 'AASHTO BIII-36 (39in)'; P.base.ts = 6; P.base.th = 4; P.base.harp.n = 0; P.base.rows = [{ n: 16, y: 2, nd: 4, dbnd: 8 }, { n: 4, y: 37, nd: 0, dbnd: 0 }];
    P.xs.bays = [3, 3, 3, 3]; P.xs.ohL = 1.5; P.xs.ohR = 1.5; P.spans.lengths = [70]; });
  const Rb = W.PSBHoldDown.compute(W.PSBDesign.inputs(B)); assert.ok(Rb.g.isBox && Rb.hp.max > 4); assert.ok(!Rb.warns.some(x => W.PSBHaunch.WARN_RE.test(x)));
});

test('the anchors in the frozen computeAll; a changed engine haunch value is an error', () => {
  const src = Function.prototype.toString.call(W.computeAll);
  W.PSBHaunch.anchors().forEach(a => assert.equal(src.split(a).length - 1, 1, a));
  const P = next45(), inp = W.PSBDesign.inputs(P), R = W.computeAll(JSON.parse(JSON.stringify(inp)));
  R.haunch[3].buildup += 1e-9; assert.throws(() => W.PSBHaunch.apply(inp, R), /engine changed/);
  const R2 = W.computeAll(JSON.parse(JSON.stringify(inp))); W.PSBHaunch.apply(inp, R2); const v = R2.haunch[5].buildup; W.PSBHaunch.apply(inp, R2);
  assert.equal(R2.haunch[5].buildup, v, 'applied once');
});

test('worked steps: midspan and bearings carry the result; every tab case: only the haunch and the RIDOT warning differ', () => {
  const P = next45(), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), E = W.PSBWorkedEnd.camber(inp, R);
  assert.ok(Object.is(E.steps.find(s => s.id === 'cb.haunch').value, R.haunch[5].buildup)); assert.ok(Object.is(E.steps.find(s => s.id === 'cb.haunchBrg').value, R.haunch[0].buildup));
  assert.equal(E.paths['cb.haunchBrg'], 'haunch.0.buildup'); assert.equal(E.paths['cb.haunch'], 'haunch.5.buildup');
  E.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), p.id));
  let n = 0;
  for (const [name, Pc] of Object.entries(TAB_CASES(() => W.PSBModel.defaultProject()))) {
    const { R: Rc, R0 } = both(Pc); if (Rc.error) continue; n++;
    const d = diff(Rc, R0).filter(p => !isHP(p)), wi = (Rc.warns || []).findIndex(x => W.PSBHaunch.WARN_RE.test(x));
    assert.deepEqual(d, wi >= 0 ? [`warns.${wi}`] : [], name);
  }
  assert.ok(n >= 7, 'cases ' + n);
});
