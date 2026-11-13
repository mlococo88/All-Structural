// Decisions pending engineer review (2026-11-13), apps/steel-bridge engine/crossframes.js:
//  SBBG: CF8's β_br and β_g are components of β_T (AASHTO LRFD 10th Ed. Eq. 6.7.4.2.2-6, springs in series) as β_sec is (#1510): no verdict
//        of their own ('na'), labelled "component (see β_T)"; the check's status and governing item unchanged (β_T ≤ each term).
//  SBFE: the diaphragm fit d ≤ D_0 − c (SB-25) is checked for the end diaphragm (CFE, and a separate end shape) too, with the same clearance.
//  SBFV: where a girder's web depth varies along the span, the fit (CFD, CFE) and CF10's fit rule take the least web depth of the bay's two
//        girders at any frame location (intermediate or at a bearing line), not D_0 at the first support; constant webs exactly as before.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, CF = W.SBDCrossframes, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const dia = (P, sh, o) => { Object.assign(P.crossframes.dia, { on: 'yes', shape: sh }, o || {}); return P; };
const ck = (P, id, gi = 0) => FUI.build({ P: J(P), g: gi }).C.find(c => c.id === id);
const fit = c => c.items.filter(i => /Fit between the girders/.test(i.loc));
const CMP = 'component (see β_T)';

test('SBBG: β_br, β_sec and β_g are components of β_T; β_g below β_T,req (was "Fail") keeps CF8 failing on β_T, governing as before', () => {
  // the built-in project on 3 girders at 9.5 ft, spans × 1.5 (165, 210, 165 ft): β_g = 24(3 − 1)²(114)²(29,000)(37,472)/(3(1,980)³) = 58,219,
  // β_br = 1,215,375, β_sec = ∞, β_T = (1/1,215,375 + 0 + 1/58,219)⁻¹ = 55,558 < β_T,req = 83,346: ratios β_g 1.432, β_T 1.500
  const P = M.defaultProject(); P.xs.nb = 3; P.xs.bays = [9.5, 9.5]; P.spans.lengths = P.spans.lengths.map(v => v * 1.5);
  const L = P.spans.lengths.reduce((a, b) => a + b, 0); P.girders.forEach(g => { const s = g.segments, k = L / s[s.length - 1].x1; s.forEach(q => { q.x0 *= k; q.x1 *= k; }); });
  const c = ck(P, 'CF8'), [br, sec, g, T] = c.items;
  for (const it of [br, sec, g]) { assert.equal(it.st, 'na'); assert.equal(it.lbl, CMP); }
  assert.equal(+g.r.toFixed(3), 1.432); assert.equal(+T.r.toFixed(3), 1.5); assert.equal(T.st, 'fail'); assert.equal(c.status, 'fail'); assert.equal(c.items[c.gov].loc, 'System, β_T');
  assert.match(c.note, /β_br, β_sec and β_g are components of β_T \(springs in series, Eq\. 6\.7\.4\.2\.2-6\)/);
  const d = ck(M.defaultProject(), 'CF8'); assert.deepEqual(J(d.items.map(i => [i.st, i.lbl || null])), [['na', CMP], ['na', CMP], ['na', CMP], ['pass', null]]); assert.equal(d.status, 'pass'); assert.equal(d.gov, 3);
});

test('SBFE: CFE checks the fit too: W36x135 between 30 in webs fails at the bearing lines (35.60 > 28.00, 1.271); a separate end shape W24x55 fits', () => {
  const e = fit(ck(dia(two(30, 30), 'W36x135'), 'CFE'));
  assert.equal(e.length, 1); assert.equal(e[0].st, 'fail'); assert.equal(e[0].capacity, 28); assert.equal(+e[0].r.toFixed(3), 1.271); assert.equal(e[0].step, 'cf.cfe.fit');
  assert.match(e[0].loc, /the end diaphragm at the bearing lines with the same clearance, Decision pending engineer review/);
  const B = FUI.build({ P: dia(two(30, 30), 'W36x135'), g: 0 }), s = B.R.steps.find(t => t.id === 'cf.cfe.fit'); assert.equal(s.value, 28); assert.equal(s.ok, false); assert.match(s.note, /SBFE/);
  const x = fit(ck(dia(two(30, 30), 'W36x135', { eShape: 'W24x55' }), 'CFE')); assert.equal(x[0].st, 'pass'); assert.equal(+x[0].r.toFixed(3), +(23.6 / 28).toFixed(3));
  // groups (three types, no end shape): CFE per group, as CFD
  const G = fit(ck(dia(three(30, 36, 42), 'W36x135'), 'CFE', 1)); assert.deepEqual(J(G.map(i => [i.loc.split(':')[0], i.capacity, i.st, i.step])),
    [['G1–G2, G5–G6 (W36x135)', 28, 'fail', 'cf.cfe.g1.fit'], ['G2–G3, G4–G5 (W36x135)', 34, 'fail', 'cf.cfe.g2.fit'], ['G3–G4 (W36x135)', 40, 'pass', 'cf.cfe.g3.fit']]);
  assert.ok(!fit(ck(dia(two(30, 30), 'W27x84'), 'CFE'))[0].loc.includes('does not fit'));
});

test('SBFV: a web depth varying along the span: the least web depth at the frames (CFD, CFE, CF10); constant webs as before', () => {
  // Interior and Exterior D = 36 in, the Interior's middle segment (128 to 232 ft) D = 33 in; W33x118 (d = 32.90 in)
  const P = two(36, 36); P.girders[0].segments[2].D = 33; dia(P, 'W33x118');
  const I = CF.inputsOf(P, { gi: 0 }); assert.deepEqual(J(I.p.xfBay.bays.map(q => q.Df)), [33, 33, 33, 33]); assert.equal(I.p.xfBay.bays[0].Dfw, 'D = 33.00 in on G2 Interior at x = 133.33 ft');
  for (const id of ['CFD', 'CFE']) { const F = fit(ck(P, id)); assert.equal(F[0].capacity, 31); assert.equal(F[0].st, 'fail'); assert.equal(+F[0].r.toFixed(3), 1.061);   // was 36 − 2 = 34: 0.968 OK
    assert.match(F[0].loc, /the least web depth at the frames along the span, D = 33\.00 in on G2 Interior at x = 133\.33 ft/); }
  // CF10: Interior 36 with a 30 in middle segment: d_req 0.75 × 37.88 = 28.41 in > 30 − 2 = 28.00 → the nearest W27x84 (was W30x99 with D_0 = 36)
  const Q = two(36, 36); Q.girders[0].segments[2].D = 30; const T = CF.cfTypeRec(CF.inputsOf(Q, { gi: 0 }).p, CF.envOf(Q));
  assert.equal(T.fit.lim, 28); assert.match(T.rec, /^rolled diaphragm W27x84: the nearest section, FAILS the depth requirement/);
  // a project saved before girder types (one girder on every line): p.D0 the least at the frames
  const B = M.defaultProject(); B.girders[0].segments[2].D = 50; const IB = CF.inputsOf(B, { gi: 0 }); assert.equal(IB.p.D0, 50); assert.equal(IB.p.D0w, 'D = 50.00 in at x = 133.33 ft on G1');
  // constant webs: Df = D_0 at the first support, no added text
  for (const C of [two(30, 36), two(36, 30), three(30, 36, 42), M.defaultProject()]) { const p = CF.inputsOf(C, { gi: 0 }).p;
    if (p.xfBay) p.xfBay.bays.forEach(q => q && assert.equal(q.Df, +(+q.s.D0).toFixed(2))); assert.equal(p.D0w, undefined); }
  assert.ok(!/least web depth at the frames/.test(fit(ck(dia(two(30, 36), 'W27x84'), 'CFD'))[0].loc));
});
