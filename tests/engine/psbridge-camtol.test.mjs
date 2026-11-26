// apps/ps-bridge HCT (engineer answer 2026-11-26: "camber tolerance: YES, as a Settings input (± % of predicted camber), showing haunch at
// bearings and midspan for high and low camber"; follow-up of PR #1722; §4 review): base.opt.camTol = p (optional; blank or 0: none).
// engine/haunch.js tolOf: δ_C = p |Δ_erect| / 100; high / low camber: Δ_deck ± δ_C, the haunch at midspan t_h ∓ δ_C (seats set for the
// predicted camber), the haunch at the bearings that keeps t_h at midspan max(t_h + Δ_deck ± δ_C, 0.5).
//   1. hand check, the HP test design (NEXT 24F, 45 ft, t_h 2 in, 44 straight strands) with p = 10 %;
//   2. no tolerance (absent, blank, 0): R.hp.tol null and the whole result as before; with p > 0 only R.hp.tol is added (no check, load,
//      ratio or warning changes);
//   3. the worked steps carry the values; the input is on the Cross-section tab (Deck and haunch), checked as 'opt', 0 to 100.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...['sections', 'model', 'lldf-fg', 'deckdist', 'haunch', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-end'].map(n => path.join(APP, `engine/${n}.js`)));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const design = f => { const P = W.PSBModel.defaultProject(); P.base.girder = 'NEXT 24F'; P.spans.lengths = [45]; P.xs.bays = P.xs.bays.map(() => 10); P.base.ts = 8; P.base.th = 2;
  P.base.rows = [{ n: 16, y: 2.875, dbnd: 0, nd: 0 }, { n: 16, y: 4.875, dbnd: 0, nd: 0 }, { n: 12, y: 6.875, dbnd: 0, nd: 0 }]; P.base.harp.n = 0;
  P.base.loads.wNC = 0; P.base.loads.wBar = 0.5; P.base.loads.wDW = 0.3; if (f) f(P); assert.deepEqual([...W.PSBInputCheck.collect(P).errors.map(e => e.msg)], []); return P; };
const run = P => W.PSBHoldDown.compute(W.PSBDesign.inputs(P));
function diff(a, b, at = '', out = [], seen = new Set()) {
  if (typeof a === 'function' || typeof b === 'function') return out;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (!Object.is(a, b)) out.push(at); return out; }
  if (seen.has(a)) return out; seen.add(a);
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diff(a[k], b[k], at ? `${at}.${k}` : k, out, seen));
  return out;
}

test('HCT hand check: p = 10 %, δ_C = 0.1|Δ_erect|; high: midspan t_h − δ_C, bearings max(t_h + Δ_deck + δ_C, 0.5); low the other way', () => {
  const R = run(design(P => { P.base.opt.camTol = 10; })), T = R.hp.tol, C = R.cam.erect, d = R.cam.afterDeck;
  assert.equal(d.toFixed(3), '3.346'); assert.equal(T.p, 10); assert.ok(Object.is(T.C, C)); near(T.dC, 0.1 * Math.abs(C), 1e-12, 'δ_C');
  near(T.hi.d, d + T.dC, 1e-12); near(T.hi.mid, 2 - T.dC, 1e-12); near(T.hi.brgKeep, 2 + d + T.dC, 1e-12);
  near(T.lo.d, d - T.dC, 1e-12); near(T.lo.mid, 2 + T.dC, 1e-12); near(T.lo.brgKeep, 2 + d - T.dC, 1e-12);
  console.log(`    HCT check: Δ_erect ${C.toFixed(3)} in, δ_C ${T.dC.toFixed(3)} in; Δ_deck ${d.toFixed(3)}; high: mid ${T.hi.mid.toFixed(2)}, brg ${T.hi.brgKeep.toFixed(2)}; low: mid ${T.lo.mid.toFixed(2)}, brg ${T.lo.brgKeep.toFixed(2)} in`);
});

test('HCT: no tolerance (absent, blank, 0): R.hp.tol null and the result as before; p > 0: only R.hp.tol added', () => {
  const R0 = run(design());
  assert.equal(R0.hp.tol, null);
  for (const v of ['', 0]) { const R = run(design(P => { P.base.opt.camTol = v; })); assert.equal(R.hp.tol, null); assert.deepEqual(diff(R, R0), [], String(v)); }
  const R = run(design(P => { P.base.opt.camTol = 60; })); assert.deepEqual(diff(R, R0).filter(p => !/^hp\.tol/.test(p)), [], 'only R.hp.tol');
  assert.ok(R.hp.tol.hi.mid < 0, 'a large tolerance: the high-camber midspan haunch below 0 (shown as is, no floor)');
});

test('HCT: worked steps = the values; the input field (Cross-section, Deck and haunch: opt, 0 to 100)', () => {
  const P = design(P => { P.base.opt.camTol = 10; }), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), E = W.PSBWorkedEnd.camber(inp, R), s = id => E.steps.find(q => q.id === id);
  const T = R.hp.tol; assert.ok(Object.is(s('cb.tolC').value, T.dC));
  ['hi', 'lo'].forEach(k => { assert.ok(Object.is(s(`cb.tol.${k}.mid`).value, T[k].mid), k); assert.ok(Object.is(s(`cb.tol.${k}.brg`).value, T[k].brgKeep), k); });
  E.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), p.id));
  const f = W.PSBFields.CARDS ? W.PSBFields.CARDS.flatMap(c => c.fields.map(x => Object.assign({ card: c.id, tab: c.tab }, x))).find(x => x.p === 'base.opt.camTol') : null;
  assert.ok(f, 'the field'); assert.equal(f.tab, 'xsec'); assert.equal(f.card, 'deck'); assert.equal(f.k, 'opt'); assert.equal(f.max, 100);
  const bad = design(); bad.base.opt.camTol = 150; assert.ok(W.PSBInputCheck.collect(bad).errors.length > 0, 'over 100 %: an input error');
});
