// SBCOPE (2026-11-19; engineer request 2026-11-19, approved): apps/steel-bridge engine/crossframes.js diaCope / copePts / copeSug, the coped-end
// items and steps of CFD / CFE, CF10's coped-ends option; ui/framing.js copeRows; engine/model.js validate. Coped ends of the channel or rolled W
// diaphragm so that a section deep enough for the least depth fits between the girder flanges.
//   1. No cope (absent, 'no', or 'no' with cope values): every item, step and DIA value as without the fields.
//   2. Hand check, made-up shallow plate girder (web 22 in, flanges 14 × 2 in, d_g = 26 in): no section fits uncoped (CF10 nearest MC18x42.7,
//      1.50 in short; W21x44 does not fit, 20.70 > 20.00 in); CF10 suggests W21x44 with coped ends; with the cope on: h_e, c, shear, block
//      shear, flexure at the cope, axial, bolts.
//   3. The engineer's girder as stated (web 24 in, flanges 14 × 1.5 in, d_g = 27 in): W21x44 fits uncoped (20.70 ≤ 22.00 in): no cope needed.
//   4. Entered cope values, the end diaphragms (eCope), the fit and cope-length failures. 5. validate and the inputs.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), CF = W.SBDCrossframes, M = W.SBDModel, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs ${b}`);
const frame = (D, tf, mut) => { const p = J(CF.DEF); p.dg = D + 2 * tf; Object.assign(p.sb, { D, tc: tf, tt: tf, bc: 14, bt: 14, tw: 0.5 }); if (mut) mut(p); return p; };
const run = (p, dia) => { p.dia = { ...p.dia, on: 'yes', ...dia }; const R = CF.compute(p, null), C = CF.checks(R); return { R, C, D: R.DIA.i, E: R.DIA.e, d: C.find(c => c.id === 'CFD'), c10: C.find(c => c.id === 'CF10') }; };
const item = (c, re) => c.items.find(i => re.test(i.loc));

test('1. no cope: identical to a project without the fields', () => {
  for (const sh of ['W21x44', 'MC18x42.7', 'W24x55']) { const s = x => JSON.stringify({ C: x.C.filter(c => c.id !== 'CF10'), st: x.R.steps, D: x.R.DIA });
    const a = run(frame(60, 1), { shape: sh }); for (const o of [{ cope: 'no' }, { cope: 'no', cT: 1, cB: 1, cL: 5, cR: 1, eCope: '' }, { cope: '' }]) assert.equal(s(run(frame(60, 1), { shape: sh, ...o })), s(a), `${sh} ${JSON.stringify(o)}`); }
});

test('2. hand check: web 22 in, flanges 14 × 2 in (d_g = 26 in): no section fits uncoped; W21x44 with coped ends', () => {
  const u = run(frame(22, 2), { shape: 'W21x44' });
  // d_req = 0.75(26) = 19.50 in; fit D_0 − c = 22 − 2 = 20.00 in: W21x44 20.70 > 20.00 (fail), MC18x42.7 18.00 < 19.50 (the nearest, 1.50 in short)
  assert.equal(item(u.d, /^Fit between the girders \(engineer decision SB-25\)/).st, 'fail'); assert.match(u.c10.items[0].cells[2], /MC18x42\.7: the nearest section, FAILS/);
  const o = u.c10.items.find(i => /^Option: coped ends/.test(i.loc)); assert.ok(o, 'CF10 option'); assert.equal(o.st, 'adv'); assert.match(o.cells[2], /^W21x44 with coped ends: h_e = 19\.70 in, c = 6\.00 in$/); assert.equal(o.cells[3], 'not applied');
  assert.equal(u.D.CP, undefined, 'never applied without the switch');
  const k = run(frame(22, 2), { shape: 'W21x44', cope: 'yes' }), P = k.D.CP, Q = k.D.CQ;
  // the diaphragm centred on d_g: 2.65 to 23.35 in; window t_b + c/2 = 3.00 to t_b + D_0 − c/2 = 23.00 in: reach 0.35 in each, < t_f = 0.45 → 0.45 → 1/8 up 0.50 in
  near(P.nB, 0.35, 1e-9, 'reach bottom'); assert.equal(P.cB, 0.5); assert.equal(P.cT, 0.5); near(P.he, 19.7, 1e-9, 'h_e'); assert.equal(P.full, 24);
  // cope length: 14/2 + 1 − 2.0 (the diaphragm end, 3.5 − 1.5) = 6.00 in
  assert.equal(P.cL, 6); assert.equal(P.cR, 0.5);
  // coped section: web 19.70 × 0.35: S = 0.35(19.70²)/6 = 22.64 in³
  near(P.S, 0.35 * 19.7 ** 2 / 6, 1e-9, 'S'); near(P.S, 22.64, 5e-3, 'S');
  // V = 2M_br/S = 2(621.25)/114 = 10.90 kip; shear: min(1.0(0.58)(50)(6.895), 0.80(0.58)(65)((19.70 − 4(0.9375))0.35)) = min(199.96, 168.37) = 168.37 kip
  near(Q.Vb, 10.899, 1e-3, 'V'); near(Q.Rv, 168.37, 5e-3, 'shear'); near(Q.Vb / Q.Rv, 0.065, 1e-3, 'shear ratio');
  // block shear (one line, U_bs = 1): L_ev = 20.70/2 − 0.50 − 4.5 = 5.35; A_vg = (5.35 + 9)(0.35) = 5.0225; A_vn = 5.0225 − 3.5(0.9375)(0.35) = 3.8741;
  // A_tn = (1.5 − 0.5(0.9375))(0.35) = 0.3609; 0.80 min(0.58(65)(3.8741) + 65(0.3609), 0.58(50)(5.0225) + 65(0.3609)) = 0.80 min(169.51, 169.11) = 135.29 kip
  near(Q.Lev, 5.35, 1e-9, 'L_ev'); near(Q.Rbs, 135.29, 5e-3, 'block shear'); near(Q.Vb / Q.Rbs, 0.081, 1e-3, 'block shear ratio');
  // flexure at the cope: M = 621.25 + 10.899(2.0 + 6.0) = 708.44 kip-in; λ = 19.7√50/(10(0.35)√(475 + 280(19.7/6)²)) = 0.673 ≤ 0.7: Q = 1; φM_n = 0.9(50)(22.64) = 1018.7; ratio 0.695
  near(Q.Mcp, 708.44, 0.01, 'M at the cope'); near(Q.lamC, 0.6734, 1e-4, 'λ'); assert.equal(Q.Q, 1); near(Q.phiMc, 1018.74, 0.01, 'φM_n'); near(Q.Mcp / Q.phiMc, 0.695, 1e-3, 'flexure ratio');
  // every coped item passes; the fit on h_e passes (19.70 ≤ 20.00)
  const cp = k.d.items.filter(i => i.cope); assert.equal(cp.length, 8); assert.deepEqual(J(cp.filter(i => i.st !== 'pass').map(i => i.loc)), []);
  assert.equal(k.R.SB.hBr, 19.7, 'the 0.8D test takes h_e');
  const o2 = k.c10.items.find(i => /^Option: coped ends/.test(i.loc)); assert.equal(o2.cells[3], 'in use (Coped ends on)');
  // bolts: 2 lines of 4 at 3 in, g = 3 in, A325-X: f = 30.14 kip < 32.33 kip
  const b = run(frame(22, 2, p => { p.conn.thr = 'excl'; }), { shape: 'W21x44', cope: 'yes', nl: 2, g: 3 }); near(b.D.fmax, 30.14, 5e-3, 'bolt'); near(b.D.fmax / b.D.res, 0.932, 1e-3, 'bolt ratio');
  near(b.D.CQ.Rbs, 144.68, 5e-3, 'block shear, two lines (U_bs = 0.5)');
  // the work: equation → values → result, each item linked to its step
  ['cT', 'cB', 'he', 'full', 'cL', 'S', 'Lev', 'V', 'bs', 'Q', 'M', 'P'].forEach(s => assert.ok(k.R.steps.some(t => t.id === `cf.cfd.cope.${s}`), s));
  cp.forEach(i => assert.ok(k.R.steps.some(t => t.id === i.step), i.step));
});

test('3. the girder as given (web 24 in, flanges 14 × 1.5 in, d_g = 27 in): W21x44 fits without a cope', () => {
  const u = run(frame(24, 1.5), { shape: 'W21x44' });
  // d_req = 0.75(27) = 20.25 in ≤ 20.70 in; fit D_0 − c = 22.00 in ≥ 20.70 in
  assert.equal(item(u.d, /^Depth \(6\.7\.4\.2/).st, 'pass'); assert.equal(item(u.d, /^Fit between the girders/).st, 'pass');
  assert.ok(!u.c10.items.some(i => /^Option: coped ends/.test(i.loc)), 'no option when a section fits');
});

test('4. entered values, end diaphragms, failures', () => {
  const e = run(frame(22, 2), { shape: 'W21x44', cope: 'yes', cT: 0.25, cB: 0.25, cL: 4 }), P = e.D.CP;
  assert.equal(P.cT, 0.25); assert.equal(P.he, 20.2); assert.equal(item(e.d, /^Fit between the girders, coped ends/).st, 'fail'); assert.equal(item(e.d, /^Cope length/).st, 'fail');
  assert.equal(e.E.CP.cT, 0.25, 'the end diaphragm takes the entered values');
  const n = run(frame(22, 2), { shape: 'W21x44', cope: 'yes', eCope: 'no' }); assert.ok(n.D.CP && !n.E.CP);
  const m = run(frame(22, 2), { shape: 'W21x44', eCope: 'yes' }); assert.ok(!m.D.CP && m.E.CP);
  // full depth: W24x55 (23.60) on d_g = 26: limit 24.00 passes; W27x84 (26.70) fails
  assert.equal(item(run(frame(22, 2), { shape: 'W27x84', cope: 'yes' }).d, /^Coped diaphragm, full depth/).st, 'fail');
  // the outline: 12 points, the copes at both ends
  assert.equal(CF.copePts(0, 100, 0, 20, { cL: 6, cB: 0.5, cT: 0.5 }).length, 12);
});

test('5. validate and the inputs', () => {
  const P = M.newProject(), err = () => J(M.validate(P).errors.filter(e => /dia\.(cope|eCope|c[TBLR])$/.test(e.path)).map(e => e.path));
  assert.deepEqual(err(), []); Object.assign(P.crossframes.dia, { cope: 'yes', cT: '', cB: 0.5, cL: 6, cR: '' }); assert.deepEqual(err(), []);
  Object.assign(P.crossframes.dia, { cope: 'maybe', cT: -1 }); assert.deepEqual(err().sort(), ['crossframes.dia.cT', 'crossframes.dia.cope']);
  const h = { num: p => `<input data-path="${p}">`, sel: (p, l, o, cur) => `<select data-path="${p}" data-cur="${cur}">`, card: (t, b) => b, esc: s => String(s) };
  const Q = M.newProject(); Object.assign(Q.crossframes.dia, { on: 'yes', shape: 'W21x44' }); let html = FUI.inputs(Q, h);
  assert.ok(html.includes('data-path="crossframes.dia.cope" data-cur="no"') && !html.includes('crossframes.dia.cT'));
  Q.crossframes.dia.cope = 'yes'; html = FUI.inputs(Q, h); assert.ok(['cT', 'cB', 'cL', 'cR'].every(k => html.includes(`data-path="crossframes.dia.${k}"`)) && html.includes(FUI.COPE_HINT));
});
