// SBXF (2026-11-13; engineer decision 2026-11-13, girder types): apps/steel-bridge engine/crossframes.js bayDepths, inputsOf, pointLoads and
// ui/framing.js build: each cross-frame bay takes the depth of the shallower of the two girders it connects (the girder type on each line).
// 1. A project saved before girder types (no girders[i].lines): bayDepths null, inputsOf / compute / pointLoads exactly as before.
// 2. Girder types of equal depth (a new project as created; one type on every line): every computed value as before (inputsOf with
//    bays: false is the before), only p.dW / p.xfBay and the worked steps added.
// 3. Exterior 6 in shallower than Interior (the hand check of the PR): bays G1–G2 and G4–G5 D = 54 in, G2–G4 60 in; the governing bay
//    G1–G2: h = round(max(54 − 8, 0.75 × 54)) = 46 in (was 52), d = 54 + 0.875 + 1 = 55.88 in (was 61.88); with Interior reported the
//    deck-placement bracing: h = 46 < 0.8 × 60 = 48 → C = 3.6 (was 2.4), M_br × 1.5, chord forces M_br / h; the frame weights per bay
//    (h = 46, 52, 52, 46); the wind on the reported girder as before.
// 4. Exterior 6 in deeper: Interior reported unchanged; Exterior reported h = 52 (Interior's D = 60), d = 61.88, d_W = 67.88 (wind unchanged).
// 5. A line with no type: the other girder; two types on one line: the shallower. 6. CF10 with an owner's web-depth rule (CTDOT): the bay D.
// 7. ui/framing.js build: dxfB (the Download DXF as before) only when the governing bay's depth differs from the reported girder's.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'ui/framing.js'].map(E));
const M = W.SBDModel, CF = W.SBDCrossframes, AN = W.SBDAnalysis, J = o => JSON.parse(JSON.stringify(o));
const withExt = dD => { const P = M.newProject(); P.girders[1].segments.forEach(s => { s.D += dD; }); return P; };
const run = (P, gi, bays) => { const A = AN.analyzeGirder(P, gi, { ll: false }), I = CF.inputsOf(P, { gi, A, ...(bays === false ? { bays: false } : {}) }), R = CF.compute(I.p, CF.envOf(P)); return { I, R, C: CF.checks(R) }; };
// the computed values of a run (the worked steps and the added p.dW / p.xfBay aside)
const vals = X => { const p = J(X.I.p); delete p.dW; delete p.xfBay; const R = J({ ...X.R, steps: null, p: null, E: null });
  return JSON.stringify({ p, src: Object.keys(X.I.src).filter(k => k !== 'dW').sort(), R, C: J(X.C).map(c => ({ id: c.id, st: c.status, it: c.items.map(i => [i.st, i.r, i.demand, i.capacity]) })) }); };

test('a project saved before girder types: bayDepths null; inputsOf, compute, steps and pointLoads as before', () => {
  const P = M.defaultProject(); assert.equal(CF.bayDepths(P), null);
  const L = M.defaultProject(); M.addType(L, 0, { label: 'B' }); delete L.girders[1].lines; L.girders[1].line = 0; L.girders[1].segments.forEach(s => { s.D += 6; });
  assert.equal(CF.bayDepths(L), null, 'two girders saved before types (no lines): as before, even with different depths');
  for (const Q of [P, L]) for (const gi of [0, Q.girders.length - 1]) {
    const a = run(Q, gi), b = run(Q, gi, false);
    assert.equal(JSON.stringify(J(a.I)), JSON.stringify(J(b.I))); assert.equal(JSON.stringify(J(a.R.steps)), JSON.stringify(J(b.R.steps))); assert.equal(vals(a), vals(b));
    assert.ok(!('xfBay' in a.I.p) && !('dW' in a.I.p));
  }
  const X = CF.pointLoads(L, 1); assert.ok(X && !X.X.hb, 'no per-bay h');
});

test('girder types of equal depth: every computed value as before; the bay depths worked', () => {
  const P = M.newProject(), S = M.newProject(); M.setLines(S, 0, [0, 1, 2, 3, 4]);
  for (const Q of [P, S]) for (const gi of Q.girders.map((_, i) => i)) {
    const a = run(Q, gi), b = run(Q, gi, false);
    assert.equal(vals(a), vals(b), `type ${gi}`);
    assert.equal(a.I.p.xfBay.vary, false); assert.equal(a.I.p.xfBay.j, 0, 'ties: the first bay'); assert.equal(a.I.p.dW, a.I.p.dg);
    const ids = a.R.steps.map(s => s.id); for (const id of ['cf.xfD', 'cf.h', 'cf.dg', 'cf.dW']) assert.ok(ids.includes(id), id);
  }
  const X = CF.pointLoads(P, 0); assert.deepEqual(J(X.X.hb), [52, 52, 52, 52]);
  M.newProject().girders.forEach((_, gi) => { const Q = M.newProject(), a = CF.pointLoads(Q, gi), b = J(a); assert.ok(a.pts.length > 0); assert.deepEqual(b.pts, J(xfPtsBefore(Q, gi))); });
});
// the point loads with one h for every bay (the before)
function xfPtsBefore(P, gi) { const FRM = W.SBDFraming, L = FRM.compute(P), c = Object.assign(CF.defaults(), P.crossframes || {}), X = CF.xfModel(c.weight, { ...c, h: CF.inputsOf(P, { L, bays: false }).p.h });
  const G = CF.xfPts({ spans: P.spans.lengths.map(Number), xf: L.xf }, X); return G[Math.min(FRM.lineOf(P, P.girders[gi]), G.length - 1)]; }

test('Exterior 6 in shallower: the governing bay G1–G2, h = 46 in, d = 55.88 in; C = 3.6; per-bay frame weights', () => {
  const P = withExt(-6), BD = CF.bayDepths(P);
  assert.deepEqual(J(BD.bays.map(q => q.s.D)), [54, 60, 60, 54]); assert.deepEqual(J(BD.bays.map(q => q.s.label)), ['Exterior', 'Interior', 'Interior', 'Exterior']);
  assert.equal(BD.gov.j, 0);
  const a = run(P, 0), b = run(P, 0, false), p = a.I.p;
  assert.equal(p.h, 46); assert.equal(b.I.p.h, 52); assert.equal(p.dg, 55.88); assert.equal(b.I.p.dg, 61.88); assert.equal(p.dW, 61.88, 'wind on Interior as before');
  assert.equal(a.R.W.III.Fw, b.R.W.III.Fw, 'wind force unchanged');
  assert.equal(p.sb.D, 60); assert.equal(p.sb.full, 'no'); assert.equal(b.I.p.sb.full, 'yes'); assert.equal(a.R.SB.C, 3.6); assert.equal(b.R.SB.C, 2.4);
  assert.ok(Math.abs(a.R.SB.Mbr / b.R.SB.Mbr - 1.5) < 1e-12, 'M_br ∝ C');
  const top = R => R.combos.find(c => c.id === 'Con').f.find(q => q.e.k === 'top').br;
  assert.ok(Math.abs(top(a.R) - a.R.SB.Mbr / 46) < 1e-9 && Math.abs(top(b.R) - b.R.SB.Mbr / 52) < 1e-9, 'chord force = M_br / h');
  assert.ok(Math.abs(a.R.mem.top.Tu - 5.135) < 5e-4 && Math.abs(b.R.mem.top.Tu - 3.029) < 5e-4, `top chord ${a.R.mem.top.Tu} / ${b.R.mem.top.Tu}`);
  const X = CF.pointLoads(P, 0); assert.deepEqual(J(X.X.hb), [46, 52, 52, 46]);
  // a frame of G1–G2 weighs xfW with h = 46, of G2–G3 with h = 52
  const L = W.SBDFraming.compute(P), f0 = L.xf.f.find(f => f[2] === 0 && !f[0]), f1 = L.xf.f.find(f => f[2] === 1 && !f[0]), G = CF.xfPts({ spans: P.spans.lengths.map(Number), xf: L.xf }, X.X);
  const w0 = CF.xfW({ ...X.X, h: 46 }, f0[5], false), w1 = CF.xfW({ ...X.X, h: 52 }, f1[5], false);
  assert.ok(G[0].some(q => Math.abs(q.W - w0) < 1e-12) && G[2].some(q => Math.abs(q.W - w1) < 1e-12));
  // hand: W = (S(A_t + A_b) + 2√(S² + h²)A_d)(0.2836/1000)(1.10), S = 12 L_f, A = 3.609 in² (L5x5x3/8, leg rectangles)
  const A = CF.angleProps(5, 5, 0.375).A, S = f0[5] * 12; assert.ok(Math.abs(A - 3.609375) < 1e-9);
  assert.ok(Math.abs(w0 - (S * 2 * A + 2 * Math.hypot(S, 46) * A) * 0.2836 / 1000 * 1.1) < 1e-12);
  // the step shows the two girders and the min
  const st = a.R.steps.find(s => s.id === 'cf.xfD'); assert.match(st.label, /G1–G2/); assert.match(st.sub, /\\min\(54\.00,\\ 60\.00\)/); assert.equal(st.value, 54);
  assert.match(st.note, /Assumption \(engineer decision 2026-11-13/);
  assert.equal(a.R.steps.find(s => s.id === 'cf.h').value, 46);
});

test('Exterior 6 in deeper: Interior reported as before; Exterior reported takes Interior\'s depth, its wind as before', () => {
  const P = withExt(6);
  { const a = run(P, 0), b = run(P, 0, false); assert.equal(vals(a), vals(b)); assert.equal(a.I.p.xfBay.vary, false); }
  const a = run(P, 1), b = run(P, 1, false);
  assert.equal(b.I.p.h, 58); assert.equal(a.I.p.h, 52); assert.equal(b.I.p.dg, 67.88); assert.equal(a.I.p.dg, 61.88); assert.equal(a.I.p.dW, 67.88);
  assert.equal(a.R.W.III.Fw, b.R.W.III.Fw); assert.equal(a.I.p.sb.D, 66); assert.equal(a.I.p.sb.full, 'no', 'h = 52 < 0.8 × 66 = 52.8'); assert.equal(a.I.p.xfBay.vary, true);
  assert.deepEqual(J(CF.pointLoads(P, 0).X.hb), [52, 52, 52, 52]);
});

test('a line with no type: the other girder; two types on one line: the shallower; CF10 with a web-depth rule takes the bay D', () => {
  const P = withExt(-6); P.girders[1].lines = [4]; P.girders[1].line = 4;   // G1 without a type
  let BD = CF.bayDepths(P); assert.equal(BD.bays[0].a, null); assert.equal(BD.bays[0].s.label, 'Interior'); assert.equal(BD.gov.j, 3);
  const Q = withExt(-6); Q.girders[0].lines = [0, 1, 2, 3];   // G1 on Interior and Exterior
  BD = CF.bayDepths(Q); assert.equal(BD.bays[0].a.label, 'Exterior'); assert.equal(BD.bays[0].a.D, 54);
  const C = withExt(-6); C.ownerRules = { ...(C.ownerRules || {}), owner: 'CTDOT' };
  const E = CF.envOf(C), I = CF.inputsOf(C, { gi: 0 }), TR = CF.cfTypeRec(I.p, E);
  if (TR.web) assert.equal(TR.Dw, 54); else assert.equal(TR.dB, 55.88);
  assert.equal(CF.cfTypeRec(CF.inputsOf(M.newProject(), { gi: 0 }).p, E).dB, CF.cfTypeRec(CF.inputsOf(M.newProject(), { gi: 0, bays: false }).p, E).dB);
});

test('ui/framing.js build: the Download DXF model as before (dxfB) only when the governing bay\'s depth differs', () => {
  const FUI = W.SBDFramingUI;
  const e = FUI.build({ P: M.newProject(), g: 0 }); assert.equal(e.dxfB, undefined);
  const P = withExt(-6), B = FUI.build({ P, g: 0 }); assert.ok(B.dxfB); assert.equal(B.dxfB.I.p.h, 52); assert.equal(B.I.p.h, 46); assert.equal(B.dxfB.line, B.line);
  assert.equal(FUI.build({ P: withExt(-6), g: 1 }).dxfB, undefined, 'Exterior reported: its own depth governs');
});
