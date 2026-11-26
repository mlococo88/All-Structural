// apps/ps-bridge HP (2026-11-25, engineer decision: t_h is the MINIMUM haunch, at midspan, at the girder centreline): the haunch along the
// girder t_h(x) = max(t_h + Δ_deck(1 − ψ), 0.5), ψ = 4x(L − x)/L² (engine/haunch.js, window.PSBHaunch, after computeAll; the moved engine is
// not edited). Made-up designs from the app's default project.
//   1. hand check: NEXT 24F, L = 45 ft, S = 10 ft, t_h = 2 in, 44 straight strands (Δ_deck = 3.346 in): midspan 5.35 -> 2.00 in, bearings
//      2.00 -> 5.35 in, 0.1L 3.20 -> 4.14 in; only R.haunch[i].buildup changes (and buildup0, R.hp are added): the page's whole result with
//      and without the correction, value by value;
//   2. Δ_deck < 0 (engineer 2026-11-26): t_h stays at midspan, the haunch at the bearings max(t_h + Δ_deck, 0.5) < t_h, and the sag warning;
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
/* HP tests: the profile alone (PSBHaunch without run: HDC off) against no module; HDC tests: the page's result (profile + DC1) against the
   profile alone */
const withH = (h, f) => { const keep = W.PSBHaunch; W.PSBHaunch = h; try { return f(); } finally { W.PSBHaunch = keep; } };
const profOnly = inp => withH(Object.assign({}, W.PSBHaunch, { run: undefined }), () => W.PSBHoldDown.compute(JSON.parse(JSON.stringify(inp))));
function both(P) {
  const R = profOnly(W.PSBDesign.inputs(P)), R0 = withH(undefined, () => W.PSBHoldDown.compute(W.PSBDesign.inputs(P)));
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

test('Δ_deck < 0 (engineer 2026-11-26): t_h stays at midspan, max(t_h + Δ_deck, 0.5) at the bearings, and the sag warning', () => {
  const P = next45(P => { P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; }), { R, R0 } = both(P), d = R.cam.afterDeck, H = R.haunch;
  assert.ok(d < 0, 'sag at deck placement: ' + d);
  near(H[5].buildup, 2, 1e-12, 'midspan'); near(H[0].buildup, Math.max(2 + d, 0.5), 1e-12, 'bearings'); assert.ok(H[0].buildup < 2, 'thinner than t_h at the bearings');
  H.forEach(r => near(r.buildup, Math.max(2 + d * (1 - r.par), 0.5), 1e-12, 'x = ' + r.x));
  assert.equal(R.hp.neg, true); assert.equal(R.hp.mid, 2); assert.equal(R.hp.max, 2);
  const w = R.warns.filter(x => W.PSBHaunch.SAG_RE.test(x)); assert.equal(w.length, 1); assert.equal(w[0], R.hp.sag);
  assert.ok(w[0].includes(`Δ_deck = ${d.toFixed(2)} in`) && w[0].includes(`t_h + Δ_deck = ${H[0].buildup.toFixed(2)} in`), w[0]);
  const wi = R.warns.indexOf(R.hp.sag);
  assert.deepEqual(diff(R, R0).filter(p => !isHP(p)), [`warns.${wi}`], 'only the haunch and the sag warning');
  const st = W.PSBWorkedEnd.camber(W.PSBDesign.inputs(P), R).steps;
  assert.ok(/girder sags at deck placement/.test(st.find(s => s.id === 'cb.haunch').note));
  assert.ok(/Thinner than t_h/.test(st.find(s => s.id === 'cb.haunchBrg').note));
  // the 0.5 in floor: t_h = 0.5 in, the bearings at 0.5 in, the warning names the floor
  const Q = next45(P => { P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; P.base.th = 0.5; }), Rq = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q));
  assert.ok(Rq.cam.afterDeck < 0); assert.equal(Rq.haunch[0].buildup, 0.5); assert.ok(/the 0\.5 in floor/.test(Rq.hp.sag), Rq.hp.sag);
  // no sag: no warning
  const Rn = W.PSBHoldDown.compute(W.PSBDesign.inputs(next45())); assert.equal(Rn.hp.sag, null); assert.ok(!Rn.warns.some(x => W.PSBHaunch.SAG_RE.test(x)));
});

test('RIDOT BDM 9.4.6: one warning when the haunch is thicker than 4 in (RIDOT only, not at 4 in or less, not for box beams)', () => {
  const P = next45(P => { P.base.owner = 'RIDOT'; }), R = W.PSBHoldDown.compute(W.PSBDesign.inputs(P));
  assert.equal(R.hp.owner, 'RIDOT'); assert.equal(R.hp.lim, 4);
  const w = R.warns.filter(x => W.PSBHaunch.WARN_RE.test(x)); assert.equal(w.length, 1); assert.equal(w[0], R.hp.warn);
  assert.ok(/haunch up to 5\.30 in \(at the bearings/.test(w[0]), w[0]);   // HDC: Δ_deck 3.302 with the average haunch weight
  for (const ow of ['AASHTO', 'MassDOT', 'CTDOT']) { const Q = next45(P => { P.base.owner = ow; }), Rq = W.PSBHoldDown.compute(W.PSBDesign.inputs(Q));
    assert.ok(!Rq.warns.some(x => W.PSBHaunch.WARN_RE.test(x)), ow); assert.equal(Rq.hp.lim, null); }
  // 4 in or less: t_h = 0.5 in + Δ (about 3.37 in with the lighter haunch) at the bearings
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

test('worked steps: midspan and bearings carry the result; every tab case: only the haunch and the RIDOT / sag warnings differ', () => {
  const P = next45(), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), E = W.PSBWorkedEnd.camber(inp, R);
  assert.ok(Object.is(E.steps.find(s => s.id === 'cb.haunch').value, R.haunch[5].buildup)); assert.ok(Object.is(E.steps.find(s => s.id === 'cb.haunchBrg').value, R.haunch[0].buildup));
  assert.equal(E.paths['cb.haunchBrg'], 'haunch.0.buildup'); assert.equal(E.paths['cb.haunch'], 'haunch.5.buildup');
  E.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), p.id));
  let n = 0;
  for (const [name, Pc] of Object.entries(TAB_CASES(() => W.PSBModel.defaultProject()))) {
    const { R: Rc, R0 } = both(Pc); if (Rc.error) continue; n++;
    const d = diff(Rc, R0).filter(p => !isHP(p)), wi = [...(Rc.warns || [])].map((x, i) => W.PSBHaunch.WARN_RE.test(x) || W.PSBHaunch.SAG_RE.test(x) ? `warns.${i}` : null).filter(Boolean);
    assert.deepEqual(d, wi, name);
  }
  assert.ok(n >= 7, 'cases ' + n);
});

/* ---------- HDC (2026-11-25, §4): DC1 from the average haunch t̄_h = t_h + Δ_deck/3, two passes (engine/haunch.js run) ----------
   Hand check, the NEXT 24F design above: L = 540 in, b = 120 in, w_c,d,DL = 0.150 kcf, β = 120(0.150)/144 = 0.125 klf per in;
   k = 5 L⁴ / (12 · 384 E_c I_g) = 0.32209 in per klf (E_c, I_g of the engine); pass 1 Δ_0 = 3.3458 in;
   Δ = 3.3458 / (1 + 0.32209(0.125)/3) = 3.3458 / 1.013420 = 3.3015 in; t̄_h = 2 + 3.3015/3 = 3.1005 in;
   w_h = 120(3.1005)/144(0.150) = 0.3876 klf (before 120(2)/144(0.150) = 0.2500); ΔM_DC1 at midspan = 0.1376(45)²/8 = 34.8 k-ft,
   Strength I M_u 2335.2 -> 2378.6 k-ft (+1.25 × 34.8 = 43.5, the engine +43.3). */
test('HDC hand check: NEXT 24F 45 ft, t_h = 2 in: t̄_h 3.1005 in, w_h 0.2500 -> 0.3876 klf, Δ_deck 3.346 -> 3.302 in, M_u 2335.2 -> 2378.6 k-ft', () => {
  const P = next45(), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), Rp = profOnly(inp), h = R.hdc;
  assert.equal(h.b, 120); assert.equal(h.wc, 0.15); assert.equal(h.beta, 0.125); near(h.k, 5 * 540 ** 4 / (12 * 384 * Rp.cp.Ecg * Rp.g.I), 1e-12, 'k');
  assert.ok(Object.is(h.d0, Rp.cam.afterDeck)); assert.equal(h.d0.toFixed(4), '3.3458'); assert.equal(h.k.toFixed(5), '0.32209');
  near(h.d, h.d0 / (1 + h.k * h.beta / 3), 1e-12, 'Δ solved'); near(R.cam.afterDeck, h.d, 1e-9, 'pass 2 Δ = solved Δ'); assert.equal(h.d.toFixed(4), '3.3015');
  near(h.tavg, 2 + h.d / 3, 1e-12, 't̄_h'); assert.equal(h.tavg.toFixed(4), '3.1005');
  near(R.cp.wdkHaunch, 120 * h.tavg / 144 * 0.15, 1e-12, 'w_h'); assert.equal(R.cp.wdkHaunch.toFixed(4), '0.3876'); assert.equal(Rp.cp.wdkHaunch.toFixed(4), '0.2500'); assert.equal(h.w0, Rp.cp.wdkHaunch);
  near(R.wDk - Rp.wDk, R.cp.wdkHaunch - Rp.cp.wdkHaunch, 1e-12, 'w_DC1 grows by the haunch only');
  const fl = Q => Q.checks.find(c => c.n === 'Flexure'); assert.equal(fl(Rp).v.toFixed(1), '2335.2'); assert.equal(fl(R).v.toFixed(1), '2378.6');
  assert.equal(fl(Rp).r.toFixed(3), '0.480'); assert.equal(fl(R).r.toFixed(3), '0.489');
  assert.equal(R.cam.dDK.toFixed(4), '0.4469'); assert.equal(Rp.cam.dDK.toFixed(4), '0.4026');
  // the haunch profile of PR HP uses pass 2's Δ_deck
  near(R.haunch[0].buildup, 2 + R.cam.afterDeck, 1e-12, 'bearing haunch'); assert.equal(R.haunch[5].buildup, 2);
  // the section properties, e_g and the haunch-in-properties option keep t_h
  ['Ic', 'ybc', 'Ac', 'Sbc', 'Stg', 'Std', 'hc', 'wdkDeck', 'wdkHW'].forEach(f => assert.ok(Object.is(R.cp[f], Rp.cp[f]), 'cp.' + f));
  assert.ok(Object.is(R.df.eg, Rp.df.eg), 'e_g'); assert.ok(Object.is(R.dfm, Rp.dfm), 'DF_M');
  const Q = next45(P => { P.base.haunchInProps = true; }), iq = W.PSBDesign.inputs(Q), Rq = W.PSBHoldDown.compute(iq), Rqp = profOnly(iq);
  ['Ic', 'ybc', 'Ac', 'hc'].forEach(f => assert.ok(Object.is(Rq.cp[f], Rqp.cp[f]), 'haunch in props: cp.' + f)); assert.ok(Rq.cp.Ic > Rp.cp.Ic);
  // worked steps: t̄_h and w_h carry the result; every pair agrees
  const Wk = W.PSBWorked.loads(inp, R), v = id => Wk.steps.find(s => s.id === id);
  assert.ok(Object.is(v('ld.havg').value, h.tavg)); assert.ok(Object.is(v('ld.whaunch').value, R.cp.wdkHaunch)); assert.equal(Wk.paths['ld.havg'], 'hdc.tavg');
  Wk.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), `${p.id}: ${p.shown} vs ${p.engine}`));
});

test('HDC: Δ_deck < 0 (engineer 2026-11-26): DC1 takes at least t_h, w_h = b max(t_h + Δ_deck/3, t_h) = b t_h: the result as before (and the sag warning); box beams: nothing changes', () => {
  const P = next45(P => { P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; }), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), Rp = profOnly(inp), h = R.hdc;
  assert.ok(h.neg && h.same && h.d0 < 0 && Object.is(h.d, h.d0)); assert.equal(h.tavg, 2); assert.equal(h.add, 0);
  assert.ok(Object.is(R.cp.wdkHaunch, h.w0)); near(R.cp.wdkHaunch, 120 * 2 / 144 * 0.150, 1e-12, 'w_h = b t_h / 144 w_c');
  assert.deepEqual(diff(R, Rp).filter(p => !/^hdc/.test(p)), [], 'pass 1 is the answer (the HP result, sag warning included)');
  assert.equal(R.warns.filter(w => W.PSBHaunch.SAG_RE.test(w)).length, 1, 'the sag warning (HP)');
  const st = W.PSBWorked.loads(inp, R).steps.find(s => s.id === 'ld.whaunch'); assert.ok(st && /DC1 takes at least t_h/.test(st.note), st && st.note);
  const B = design(P => { P.base.girder = 'AASHTO BIII-36 (39in)'; P.base.ts = 6; P.base.harp.n = 0; P.base.rows = [{ n: 16, y: 2, nd: 4, dbnd: 8 }, { n: 4, y: 37, nd: 0, dbnd: 0 }];
    P.xs.bays = [3, 3, 3, 3]; P.xs.ohL = 1.5; P.xs.ohR = 1.5; P.spans.lengths = [70]; });
  const ib = W.PSBDesign.inputs(B), Rb = W.PSBHoldDown.compute(ib), Rbp = profOnly(ib);
  assert.equal(Rb.hdc, undefined); assert.deepEqual(diff(Rb, Rbp), [], 'box: the result as before');
});

test('HDC: the no-balance case is moot under the midspan rule (engineer 2026-11-26): a long sagging NEXT keeps t_h, no extra warning', () => {
  const P = next45(P => { P.spans.lengths = [120]; P.base.rows = [{ n: 6, y: 2.875, dbnd: 0, nd: 0 }]; }), inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp), Rp = profOnly(inp), h = R.hdc;
  assert.ok(h && h.same && h.neg && !h.diverge && h.d0 < 0 && 2 * h.k * h.beta / 3 >= 1, JSON.stringify(h));
  assert.ok(Object.is(R.cp.wdkHaunch, Rp.cp.wdkHaunch)); assert.equal(R.warns.filter(w => /cannot be balanced/.test(w)).length, 0);
  assert.deepEqual(diff(R, Rp).filter(p => !/^hdc/.test(p)), []);
});
