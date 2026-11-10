// SBTS (engineer decision 2026-11-10, items 1 and 3; AASHTO LRFD 10th Ed. 6.10.3.4.1, 6.10.3.2, 6.10.1.6, 6.10.8.2.3, 6.10.8.2.3c and
// C6.10.8.2.3c): with this project's pour sequence, Constructibility checks at every location both the largest positive and the largest
// negative noncomposite moment of the pour envelope (MDCp = max(M_DC1, envP), MDCn = min(M_DC1, envN)), each with its own flange in
// compression, f_bu, f_ℓ amplification and F_nc, and with C_b / γ_e from its own side of the envelope over the unbraced length. The governing
// case is reported. Regression: the station-by-station M_DCc took one side by the sign of M_DC1, so near an inflection the opposite-sign pour
// moment was never checked (skewed 100-130-100 G2 x = 71 ft: only M_c = −73.81 kip-ft was checked, the +499.86 kip-ft of the pour stages not).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'ui/demands.js', 'ui/flexure.js', 'ui/shear.js', 'ui/framing.js', 'ui/splices.js', 'ui/constructibility.js'].map(E)));
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
// the skewed project of tests/smoke/steel-bridge-summary.mjs
const skewed = () => { const P = W.SBDModel.defaultProject(); P.spans.lengths = [100, 130, 100]; P.xs.skews = [35, 30, 30, 35];
  const pos = { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 18, botT: 1.25 }, neg = { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 };
  const segs = () => [{ x0: 0, x1: 80, ...pos }, { x0: 80, x1: 120, ...neg }, { x0: 120, x1: 210, ...pos }, { x0: 210, x1: 250, ...neg }, { x0: 250, x1: 330, ...pos }];
  P.girders = [{ id: 'G1', label: 'G1', position: 'exterior', beff: 102, segments: segs() }, { id: 'G2', label: 'G2', position: 'interior', beff: 114, segments: segs() }];
  P.framing.splices = [70, 165, 260]; return P; };
let cache = null; const run = () => cache || (cache = W.SBDConstrUI.build({ P: skewed(), g: 1, src: 'project' }));
const at = (R, x) => R.rows.find(r => Math.abs(r.x - x) < 0.006), ck = (r, k) => r.checks.find(c => c.key === k);

test('two-sign check at skewed G2 x = 71 ft: the positive pour moment is checked and governs (SBTS)', () => {
  const R = run(), r = at(R, 71); assert.ok(R.F.sides, 'both sides of the pour envelope known');
  assert.equal(r.cases.length, 2); const [n, p] = r.cases; assert.equal(n.side, -1); assert.equal(p.side, 1); assert.equal(r, p, 'the positive case governs');
  // Hand check, positive case (pos section top 16 × 0.75, web 60 × 0.5625, bottom 18 × 1.25: ȳ = 26.495 in, I = 40,759 in⁴, c_top = 35.505 in):
  //   M_c = 1.25(408.45) + 1.50(−7.14) = 499.86 kip-ft; f_bu = 499.86(12)(35.505)/40,759 = 5.225 ksi (top flange in compression);
  //   f_ℓ = 12.50 ksi (skew, first order; L_b ≤ 1.2L_p√(C_b R_b/(f_bu/F_yc)): no amplification);
  //   GS14 yielding (5.225 + 12.50)/50 = 0.3545 (governs); buckling F_nc = 41.91 ksi with γ_e 9.7961 of the positive-side diagram: (5.225 + 12.50/3)/41.91 = 0.2241.
  near(p.MDCc, 408.45, 0.01, 'M_DCc+'); near(p.Mc, 499.86, 0.01, 'M_c+'); assert.equal(p.conC.lab, 'top'); near(p.conC.f, 5.2252, 1e-4, 'f_bu+');
  near(ck(p, 'yield').ratio, 0.3545, 1e-4, 'GS14 yield +'); near(p.ltC.npr.ge, 9.7961, 1e-4, 'γ_e +'); near(p.ltC.Fnc, 41.9057, 1e-3, 'F_nc +'); near(ck(p, 'buckling').ratio, 0.2241, 1e-4, 'GS14 buckling +');
  // negative case: as checked before this change (M_c = 1.25(−50.48) + 1.50(−7.14) = −73.81 kip-ft, bottom flange; GS15 tension 0.2654)
  near(n.Mc, -73.808, 0.01, 'M_c−'); assert.equal(n.conC.lab, 'bottom'); near(n.gov.ratio, 0.26543, 1e-4, 'GS15 −'); near(n.ltC.npr.ge, 8.7534, 1e-4, 'γ_e −');
  assert.ok(/Both signs occur here and both are checked/.test(r.steps.find(s => s.id === 'cn.Mc').note), 'the worked M_c names both cases');
  // x = 70: the pour stages give one sign only, one case, unchanged (GS14 yield 0.3683); x = 72: the negative case governs (0.3521) with the positive also checked (0.3404)
  const a = at(R, 70), b = at(R, 72); assert.ok(!a.cases, 'x = 70: one case'); near(a.gov.ratio, 0.36829, 1e-4, 'x = 70');
  assert.equal(b.side, -1); near(b.gov.ratio, 0.35209, 1e-4, 'x = 72 −'); near(b.alt.gov.ratio, 0.34044, 1e-4, 'x = 72 +');
  // both cases count for the span results; o.cs names the case
  R.spans.forEach(s => ['top', 'bot', 'tens', 'shear'].forEach(k => { if (s[k]) assert.ok(s[k].cs && s[k].cs.checks.includes(s[k].check)); }));
});

test('C_b and γ_e per sign case from that side of the envelope (bracingC side), and one case without a pour sequence (SBTS)', () => {
  const R = run(), env = R.F.env; assert.ok(env.MDCp && env.MDCn);
  env.xs.forEach((x, i) => { assert.ok(env.MDCp[i] >= 0 && env.MDCn[i] <= 0); assert.equal(R.F.env.MDC1[i] >= 0 ? env.MDCp[i] : env.MDCn[i], env.MDCc[i], `seq.MDCc is the side of M_DC1 at ${x}`); });
  const L = R.F.locs.find(q => Math.abs(q.x - 71) < 0.006); assert.equal(L.side, -1); assert.equal(L.alt.side, 1);
  const bp = W.SBDConstr.bracingC(71, env, { braces: R.F.braces, L: R.F.AR.Lt, secAt: x => R.F.locs.reduce((b, q) => Math.abs(q.x - x) < Math.abs(b.x - x) ? q : b).plates, D: 60, sp: 25, G: R.F.prj.G, side: 1 });
  assert.equal(bp.side, 1); assert.equal(bp.mSrc, 'DCc');
  // the pour sequence off: no second case anywhere
  const P = skewed(); P.analysis.seq = 'off'; const R0 = W.SBDConstrUI.build({ P, g: 1, src: 'project' }); assert.ok(!R0.F.sides); assert.ok(R0.rows.every(r => !r.cases));
});

test('location(): L.alt checked as a second case; the governing case reported, a tie keeps L.side (SBTS)', () => {
  const C = W.SBDConstr, prj = { mat: { Fyt: 50, Fyb: 50, Fyw: 50 }, G: C.factors() }, pl = { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 };
  const base = { name: 'x', x: 10, plates: pl, M: { DC1: 100, DCc: 300, CL: 0 }, V: { DC1: 0, CL: 0 }, LbC: 10, CbC: 1, Cb: 1, flC: 0, do: 0, end: false, side: 1 };
  const one = C.location(base, prj), two = C.location({ ...base, alt: { side: -1, DCc: -600, LbC: 10, CbC: 1 } }, prj);
  assert.ok(!one.cases); assert.equal(two.side, -1, 'the larger negative moment governs'); assert.equal(two.conC.lab, 'bottom'); near(two.Mc, -750, 1e-9, 'M_c−');
  near(two.alt.gov.ratio, one.gov.ratio, 1e-12, 'the positive case as alone'); assert.equal(two.alt.conC.lab, 'top');
  const tie = C.location({ ...base, alt: { side: -1, DCc: -300, LbC: 10, CbC: 1 } }, prj); assert.equal(tie.side, 1, 'tie: L.side');
});

test('in-app notes: both signs and the basis of C_b and γ_e stated; the open-item note removed (SBTS)', () => {
  const C = W.SBDConstr, a = C.notes(true, true), b = C.notes(true, false), c = C.notes(false, false);
  assert.ok(a.some(t => /Both signs of the deck-placement moment/.test(t) && /6\.10\.3\.4\.1/.test(t) && /6\.10\.1\.6/.test(t)));
  assert.ok(a.some(t => /Basis of C_b and γ_e/.test(t) && /positive-side envelope/.test(t) && /C6\.10\.8\.2\.3c/.test(t)));
  assert.ok(![...a, ...b, ...c].some(t => /is not checked at that station/.test(t)), 'the former open-item note is gone');
  assert.ok(b.some(t => /One M_DCc value per station/.test(t)), 'a file / entered rows: one case, stated');
  assert.ok(!c.some(t => /Both signs/.test(t)), 'no pour sequence: no two-sign note');
});
