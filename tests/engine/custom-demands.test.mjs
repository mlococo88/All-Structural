// Custom (entered) demands (2026-11-01, custom demands PR; ui/demands.js): every check module's "Custom (entered)" demand source.
//
// 1. Proof of path: custom rows equal to this project's analysis at the analysis stations (copied from the module's own analysis
//    payload) give the same locations, demands, capacities, ratios and worked steps as the 'analysis' source (Flexure; Shear &
//    stiffeners: stations, panels, transverse stiffeners and bearing stiffeners with the analysis reactions).
// 2. Hand checks: one station entered by hand, its M_u (Strength I with the owner's η and m) and ratio worked by hand in the comments.
// 3. Saved data: old projects (no P.custom, no P.demandSrc) validate and compute as before; the choice and the rows are saved and read
//    back; the factored entry gives the same flexure as the unfactored one with the factors applied by hand.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/demands.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js'].map(E));
const J = v => JSON.parse(JSON.stringify(v));
const W = loadShared(...FILES);
W.SBDReportData.install();
const CD = W.SBDCustomDemands;
const gid = (P, g) => P.girders[g].id;
const setRows = (P, mod, g, rows, extra) => { P.custom = { ...(P.custom || {}), [mod]: { ...((P.custom || {})[mod] || {}), [gid(P, g)]: { mode: 'unf', rows, sup: [], ...(extra || {}) } } }; };
const same = (a, b) => Object.is(a, b);
/* the projects of the proofs: the built-in project (G1, and its second girder), and RIDOT (η, m) with a 6 ft sidewalk over G1 (the
   pedestrian load, its own column in the custom table; tests/engine/ped-owner.test.mjs) */
function VARIANTS() {
  const P0 = W.SBDModel.defaultProject(), P1 = W.SBDModel.defaultProject();
  P1.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P1.xs.sidewalks.ped = 75;
  P1.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
  const L = [['built-in G1', P0, 0], ['RIDOT + sidewalk G1', P1, 0]];
  if (P0.girders.length > 1) L.push([`built-in ${P0.girders[1].label || 'G2'}`, P0, 1]);
  return L;
}

/* flexure rows from the analysis payload (ui/rating.js fromAnalysis, the Flexure tab's analysis path): LL+IM without the pedestrian part
   (the custom table has its own PL column) */
const flexRows = pl => pl.stations.map(s => { const q = pl.pedestrianInLL ? s : { ...s, M_PLpos: 0, M_PLneg: 0 }, o = { x: s.x };
  CD.SPECS.flex.unf.cols.forEach(([k]) => { o[k] = +s[k] || 0; });
  if (pl.pedestrianInLL) { o.M_LLpos = (+s.M_LLpos || 0) - (+s.M_PLpos || 0); o.M_LLneg = (+s.M_LLneg || 0) - (+s.M_PLneg || 0); } void q; return o; });

function flexEqual(F, A, tag) {
  assert.equal(F.rows.length, A.rows.length, tag + ': locations');
  let n = 0, maxd = 0;
  F.rows.forEach((r, i) => { const q = A.rows[i];
    assert.equal(r.name, q.name); assert.equal(r.x, q.x); assert.equal(r.pos, q.pos); assert.equal(r.Cb, q.Cb, `${tag} ${r.name} C_b`);
    const d = Math.max(Math.abs(r.Mu - q.Mu), Math.abs(r.Ms - q.Ms)); maxd = Math.max(maxd, d);
    assert.ok(d <= 1e-9 * Math.max(1, Math.abs(q.Mu)), `${tag} ${r.name} M_u ${r.Mu} vs ${q.Mu}`);
    assert.equal(r.checks.length, q.checks.length);
    r.checks.forEach((c, j) => { const e = q.checks[j]; assert.equal(c.id, e.id);
      ['demand', 'capacity', 'ratio'].forEach(k => { const a = c[k], b = e[k]; if (same(a, b)) return; const dd = Math.abs(a - b); maxd = Math.max(maxd, dd);
        assert.ok(dd <= 1e-9 * Math.max(1, Math.abs(b)), `${tag} ${r.name} ${c.id} ${k}: ${a} vs ${b}`); }); n++; });
    // the worked steps: the same steps (ids, values) after the custom source step
    const sF = W.SBDFlexureUI.stepsOf(F, r), sA = W.SBDFlexureUI.stepsOf(A, q);
    assert.equal(sF[0].id, 'cd.src'); assert.equal(sF.length, sA.length + 1, `${tag} ${r.name} steps`);
    sA.forEach((s, k) => { const t = sF[k + 1]; assert.equal(t.id, s.id); if (typeof s.value === 'number') assert.ok(same(t.value, s.value) || Math.abs(t.value - s.value) <= 1e-9 * Math.max(1, Math.abs(s.value)), `${tag} ${r.name} step ${s.id}: ${t.value} vs ${s.value}`); else assert.equal(String(t.value), String(s.value)); });
  });
  assert.equal(F.gov.gov.ratio, A.gov.gov.ratio); assert.equal(F.gov.x, A.gov.x);
  return { n, maxd };
}

test('Flexure: custom rows = this project\'s analysis at every analysis station give the same locations, ratios and steps (built-in + saved projects)', () => {
  const list = VARIANTS();
  for (const [tag, P, g] of list) {
    const A = W.SBDFlexureUI.build({ P, g, src: 'analysis', method: 'auto' }); assert.ok(!A.err, tag + ': ' + A.err);
    const pl = W.SBDRatingUI.fromAnalysis(P, g).pl;
    const Pc = J(P); setRows(Pc, 'flex', g, flexRows(pl));
    const F = W.SBDFlexureUI.build({ P: Pc, g, src: 'custom', method: 'auto' }); assert.ok(!F.err, tag + ': ' + F.err);
    assert.match(F.what, /^Demands: entered \(Custom\), unfactored/);
    const o = flexEqual(F, A, tag);
    console.log(`       ${tag}: ${F.rows.length} locations, ${o.n} checks equal (largest difference ${o.maxd}); governing ${F.gov.gov.id} ${F.gov.gov.ratio.toFixed(4)} at x = ${F.gov.x} ft`);
  }
});

/* shear rows and reactions from the analysis payload (ui/shear.js fromAnalysis): LL+IM without the pedestrian part (its own column) */
const shearRows = pl => pl.stations.map(s => { const o = { x: s.x }; CD.SPECS.shear.unf.cols.forEach(([k]) => { o[k] = +s[k] || 0; });
  if (pl.pedestrianInLL) { o.V_LLpos = (+s.V_LLpos || 0) - (+s.V_PLpos || 0); o.V_LLneg = (+s.V_LLneg || 0) - (+s.V_PLneg || 0); } return o; });
const shearSup = pl => pl.reactions.map(r => ({ DC1: r.DC1, DC2: r.DC2, DW: r.DW, LL: r.LL - (r.PL || 0), PL: r.PL || 0, UT: r.UT, UF: r.UF }));
const close = (a, b, what) => { if (same(a, b)) return 0; const d = Math.abs(a - b); assert.ok(d <= 1e-9 * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`); return d; };
function shearEqual(F, A, tag) {
  let n = 0, maxd = 0; const m = d => { maxd = Math.max(maxd, d); n++; };
  assert.equal(F.stations.length, A.stations.length, tag + ': stations');
  F.stations.forEach((r, i) => { const q = A.stations[i]; assert.equal(r.name, q.name); m(close(r.Vu, q.Vu, `${tag} ${r.name} V_u`)); if (q.VuP != null) m(close(r.VuP, q.VuP, `${tag} ${r.name} V_u,panel`));
    r.checks.forEach((c, j) => { const e = q.checks[j]; assert.equal(c.id, e.id); if (c.na == null) m(close(c.ratio, e.ratio, `${tag} ${r.name} ${c.id}`)); });
    const sF = W.SBDShearUI.stepsOf(F, 'loc', r), sA = W.SBDShearUI.stepsOf(A, 'loc', q); assert.equal(sF[0].id, 'cd.src'); assert.equal(sF.length, sA.length + 1);
    sA.forEach((s, k) => { assert.equal(sF[k + 1].id, s.id); if (typeof s.value === 'number') m(close(sF[k + 1].value, s.value, `${tag} ${r.name} step ${s.id}`)); }); });
  assert.equal(F.panels.rows.length, A.panels.rows.length, tag + ': panels');
  F.panels.rows.forEach((q, i) => { const p = A.panels.rows[i]; assert.equal(q.p, p.p); m(close(q.Vu, p.Vu, `${tag} panel ${q.p} V_u`)); m(close(q.r, p.r, `${tag} panel ${q.p} ratio`)); });
  assert.equal(F.TS.rows.length, A.TS.rows.length, tag + ': stiffeners');
  F.tsC.forEach((c, j) => c.items.forEach((it, k) => { const e = A.tsC[j].items[k]; assert.equal(it.loc, e.loc); if (typeof e.r === 'number') m(close(it.r, e.r, `${tag} ${c.id} ${it.loc}`)); }));
  assert.equal(F.BS.rows.length, A.BS.rows.length, tag + ': bearings');
  F.BS.rows.forEach((r, i) => { m(close(r.Ru, A.BS.rows[i].Ru, `${tag} ${r.name} R_u`)); });
  F.bsC.forEach((c, j) => c.items.forEach((it, k) => { const e = A.bsC[j].items[k]; assert.equal(it.loc, e.loc); if (typeof e.r === 'number') m(close(it.r, e.r, `${tag} ${c.id} ${it.loc}`)); }));
  ['stGov', 'tsGov', 'bsGov'].forEach(k => { if (A[k]) assert.ok(F[k]); });
  m(close(F.panels.gov.r, A.panels.gov.r, tag + ' governing panel'));
  return { n, maxd };
}

test('Shear & stiffeners: custom rows and reactions = this project\'s analysis give the same stations, panels, stiffeners and bearings', () => {
  for (const [tag, P, g] of VARIANTS()) {
    const A = W.SBDShearUI.build({ P, g, src: 'analysis' }); assert.ok(!A.err, tag + ': ' + A.err);
    const pl = W.SBDShearUI.fromAnalysis(P, g).pl, Pc = J(P);
    setRows(Pc, 'shear', g, shearRows(pl), { sup: shearSup(pl) });
    const F = W.SBDShearUI.build({ P: Pc, g, src: 'custom' }); assert.ok(!F.err, tag + ': ' + F.err);
    assert.match(F.what, /^Demands: entered \(Custom\)/);
    const o = shearEqual(F, A, tag);
    console.log(`       ${tag}: ${F.stations.length} stations, ${F.panels.rows.length} panels, ${F.TS.rows.length} stiffeners, ${F.BS.rows.length} bearings; ${o.n} values equal (largest difference ${o.maxd})`);
  }
});

test('Flexure hand check: one station entered, M_u by Strength I (AASHTO, then RIDOT η and m) and the GS6 ratio', () => {
  // Built-in project, G1, x = 44 ft (span 1, positive flexure, compact composite section; f_ℓ = 0: no skew).
  // Entered (kip-ft): M_DC1 = 1450, M_DC2 = 210, M_DW = 240, M_LL+IM = +1650 / −400.
  // AASHTO (η = 1, m = 1), Table 3.4.1-1/-2 maximum factors in positive flexure:
  //   M_u = 1.25(1450 + 210) + 1.50(240) + 1.75(1650) = 2075 + 360 + 2887.5 = 5322.5 kip-ft
  //   M_s (Service II) = 1450 + 210 + 240 + 1.30(1650) = 1900 + 2145 = 4045 kip-ft
  //   GS6: (M_u + f_ℓS_xt/3)/(φ_fM_n) = 5322.5/M_n (the engine's M_n of this section: the section, not the demands)
  const P = W.SBDModel.defaultProject();
  setRows(P, 'flex', 0, [{ x: 44, M_DC1: 1450, M_DC2: 210, M_DW: 240, M_LLpos: 1650, M_LLneg: -400 }]);
  const F = W.SBDFlexureUI.build({ P, g: 0, src: 'custom', method: 'auto' }); assert.ok(!F.err, F.err);
  assert.equal(F.rows.length, 1); const r = F.rows[0];
  assert.equal(r.x, 44); assert.equal(r.region, 'pos');
  assert.ok(Math.abs(r.Mu - 5322.5) < 1e-9, `M_u ${r.Mu}`); assert.ok(Math.abs(r.Ms - 4045) < 1e-9, `M_s ${r.Ms}`);
  const gs6 = r.checks.find(c => c.id === 'GS6'); assert.ok(Math.abs(gs6.ratio - 5322.5 / r.Mn) < 1e-12);
  // (M_n = min(M_n0, 1.3R_hM_y), and M_y depends on the factored permanent moments M_D1, M_D2 (D6.2.2): from the entered rows too)
  const st = W.SBDFlexureUI.stepsOf(F, r); assert.equal(st[0].id, 'cd.src'); assert.match(st[0].label, /Demands: entered \(Custom\)/); assert.match(st[0].note, /M_DC1 = 1450\.00 kip-ft/);
  // RIDOT: η and m from the owner rules (engine/owners.js); M_u = η[1.25(DC) + 1.50(DW)] + η·m·1.75(LL+IM)
  const P2 = J(P); P2.ownerRules = { owner: 'RIDOT', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
  const lf = W.SBDOwners.loadFactors('RIDOT', P2.ownerRules.eta, P2.xs.nb), F2 = W.SBDFlexureUI.build({ P: P2, g: 0, src: 'custom', method: 'auto' });
  const hand = lf.eta * (1.25 * 1660 + 1.5 * 240) + lf.eta * lf.m * 1.75 * 1650;
  assert.ok(Math.abs(F2.rows[0].Mu - hand) < 1e-9, `${F2.rows[0].Mu} vs ${hand}`);
  console.log(`       AASHTO: M_u = ${r.Mu} kip-ft, M_s = ${r.Ms}, M_n = ${r.Mn.toFixed(1)}, GS6 = ${gs6.ratio.toFixed(4)}; RIDOT η = ${lf.eta}, m = ${lf.m}: M_u = ${F2.rows[0].Mu.toFixed(2)} (hand ${hand.toFixed(2)})`);
});

test('Flexure: a pier entered alone takes C_b = 1.0 (the rows do not reach the brace points); C_b from the entered moments is proved with the analysis rows above', () => {
  const P = W.SBDModel.defaultProject();
  setRows(P, 'flex', 0, [{ x: 109.995, M_DC1: -2300, M_DC2: -330, M_DW: -380, M_LLpos: 250, M_LLneg: -2400 }, { x: 110.005, M_DC1: -2300, M_DC2: -330, M_DW: -380, M_LLpos: 250, M_LLneg: -2400 }]);
  const F = W.SBDFlexureUI.build({ P, g: 0, src: 'custom', method: 'auto' }); assert.ok(!F.err, F.err);
  assert.deepEqual(J(F.rows.map(r => r.name)), ['x = 109.99 ft', 'x = 110.01 ft']);
  // negative flexure, minimum factors where they relieve: M_u = 1.25(−2300 − 330) + 1.50(−380) + 1.75(−2400) = −3287.5 − 570 − 4200 = −8057.5 kip-ft
  F.rows.forEach(r => { assert.equal(r.region, 'neg'); assert.ok(Math.abs(r.Mu + 8057.5) < 1e-9, `${r.Mu}`); assert.equal(r.Cb, 1); assert.match(W.SBDFlexureUI.stepsOf(F, r)[0].note, /C_b = 1\.0/); });
});

test('Flexure, factored entry: the same checks as the unfactored rows with the factors applied by hand (positive and pier)', () => {
  const P = W.SBDModel.defaultProject(), P2 = J(P);
  const U = [{ x: 44, M_DC1: 1450, M_DC2: 210, M_DW: 240, M_LLpos: 1650, M_LLneg: -400, M_FATpos: 620, M_FATneg: -150 }, { x: 109.995, M_DC1: -2300, M_DC2: -330, M_DW: -380, M_LLpos: 250, M_LLneg: -2400, M_FATpos: 120, M_FATneg: -520 }];
  U[1].x = 109.99;   // a row at the location checked beside the pier (no interpolation: the two entries are compared at their own values)
  setRows(P, 'flex', 0, U);
  // by hand, Table 3.4.1-1: positive (x = 44): steel 1.25(1450), long-term 1.25(210) + 1.50(240), short-term 1.75(1650); Service II 1.0, 1.0, 1.30; Fatigue I 1.75
  //          pier (x = 109.99): 1.25(−2300), 1.25(−330) + 1.50(−380), 1.75(−2400); Service II −2300, −710, 1.30(−2400); Fatigue I 1.75(120), 1.75(−520)
  const fac = u => { const pos = u.x < 100, LL = pos ? u.M_LLpos : u.M_LLneg; return { x: u.x, Mu_s: 1.25 * u.M_DC1, Mu_l: 1.25 * u.M_DC2 + 1.5 * u.M_DW, Mu_n: 1.75 * LL, Ms_s: u.M_DC1, Ms_l: u.M_DC2 + u.M_DW, Ms_n: 1.3 * LL, Mf_p: 1.75 * u.M_FATpos, Mf_n: 1.75 * u.M_FATneg }; };
  setRows(P2, 'flex', 0, U.map(fac), { mode: 'fac' });
  const A = W.SBDFlexureUI.build({ P, g: 0, src: 'custom', method: 'auto' }), B = W.SBDFlexureUI.build({ P: P2, g: 0, src: 'custom', method: 'auto' });
  assert.ok(!A.err && !B.err, A.err || B.err); assert.match(B.what, /factored \(Strength I/);
  assert.equal(A.rows.length, B.rows.length);
  let n = 0;
  A.rows.forEach((r, i) => { const q = B.rows[i]; assert.equal(q.factored, true); assert.equal(r.region, q.region); assert.equal(r.Cb, q.Cb);
    assert.ok(Math.abs(r.Mu - q.Mu) < 1e-9 && Math.abs(r.Ms - q.Ms) < 1e-9, `${r.name}: ${r.Mu}/${q.Mu}, ${r.Ms}/${q.Ms}`);
    r.checks.forEach(c => { if (c.id === 'GS19' || !isFinite(c.ratio)) return; const d = q.checks.find(e => e.id === c.id && e.title === c.title); assert.ok(d, c.id); assert.ok(Math.abs(c.ratio - d.ratio) < 1e-9, `${r.name} ${c.id}: ${c.ratio} vs ${d.ratio}`); n++; }); });
  console.log(`       ${n} check ratios equal (unfactored rows vs. factored rows)`);
});

test('Shear hand check: one station and one abutment reaction entered', () => {
  // Built-in project, G1, x = 44 ft: V_DC1 = 20, V_DC2 = 3, V_DW = 3, V_LL+IM = +40 / −5, V_CL = 3, V_FAT = +25 / −4 (kip)
  //   V_u = 1.25(20 + 3) + 1.50(3) + 1.75(40) = 28.75 + 4.5 + 70 = 103.25 kip (GS11, the panel holds this row alone)
  //   V_u,deck placement = 1.25(20) + 1.50(3) = 29.5 kip (GS16);  V_u,fatigue = 20 + 3 + 3 + 1.75(25) = 69.75 kip (GS18, 6.10.5.3)
  // Abut. 1: R_DC1 = 100, R_DC2 = 15, R_DW = 17, R_LL+IM = 120: R_u = 1.25(115) + 1.50(17) + 1.75(120) = 143.75 + 25.5 + 210 = 379.25 kip
  const P = W.SBDModel.defaultProject();
  setRows(P, 'shear', 0, [{ x: 44, V_DC1: 20, V_DC2: 3, V_DW: 3, V_LLpos: 40, V_LLneg: -5, V_CL: 3, V_FATpos: 25, V_FATneg: -4 }], { sup: [{ DC1: 100, DC2: 15, DW: 17, LL: 120 }] });
  const R = W.SBDShearUI.build({ P, g: 0, src: 'custom' }); assert.ok(!R.err, R.err);
  assert.equal(R.stations.length, 1); const r = R.stations[0];
  assert.ok(Math.abs(r.Vu - 103.25) < 1e-9 && Math.abs(r.VuP - 103.25) < 1e-9 && Math.abs(r.VuC - 29.5) < 1e-9 && Math.abs(r.VuF - 69.75) < 1e-9, `${r.Vu} ${r.VuP} ${r.VuC} ${r.VuF}`);
  assert.ok(Math.abs(r.checks.find(c => c.id === 'GS11').ratio - 103.25 / r.sh.Vn) < 1e-12);
  assert.equal(R.panels.rows.length, 1); assert.ok(R.panels.rows[0].p <= 44 && R.panels.rows[0].q >= 44);
  assert.equal(R.BS.rows.length, 1); assert.equal(R.BS.rows[0].name, 'Abut. 1, G1'); assert.ok(Math.abs(R.BS.rows[0].Ru - 379.25) < 1e-9, `${R.BS.rows[0].Ru}`);
  assert.match(W.SBDShearUI.stepsOf(R, 'bs', R.BS.rows[0])[0].note, /R_DC1 = 100\.00 kip/);
  assert.match(W.SBDShearUI.stepsOf(R, 'loc', r)[0].label, /Demands: entered \(Custom\)/);
  // no reactions entered: the bearings are not checked (no error)
  setRows(P, 'shear', 0, [{ x: 44, V_DC1: 20 }]); const R2 = W.SBDShearUI.build({ P, g: 0, src: 'custom' }); assert.ok(!R2.err); assert.equal(R2.BS.rows.length, 0); assert.deepEqual(J(R2.BS.errors), []);
  console.log(`       V_u = ${r.Vu}, φV_n = ${r.sh.Vn.toFixed(2)}, GS11 = ${(r.Vu / r.sh.Vn).toFixed(4)}; R_u = ${R.BS.rows[0].Ru}`);
});

test('Saved data: old projects load and compute as before; the choice and the rows are saved and read back', () => {
  const P = W.SBDModel.defaultProject();
  assert.equal(P.custom, undefined); assert.equal(P.demandSrc, undefined);
  assert.deepEqual(J(W.SBDModel.validate(P).errors), []);
  assert.equal(CD.srcGet(P, 'flex'), null);
  // default source unchanged (this project's analysis), and custom rows present but not chosen change nothing
  const A = W.SBDFlexureUI.build({ P, g: 0 }), S0 = W.SBDShearUI.build({ P, g: 0 });
  assert.match(A.what, /^This project's analysis/); assert.match(S0.what, /^This project's analysis/);
  const P2 = J(P); setRows(P2, 'flex', 0, [{ x: 44, M_DC1: 1 }]); setRows(P2, 'shear', 0, [{ x: 44, V_DC1: 1 }]);
  assert.ok(W.SBDReportData.sameFlex(W.SBDFlexureUI.build({ P: P2, g: 0 }), A));
  assert.equal(W.SBDShearUI.build({ P: P2, g: 0 }).stGov.gov.ratio, S0.stGov.gov.ratio);
  // the choice is saved: export, import, the tab's default reads it
  CD.srcSet(P2, 'flex', 'custom'); CD.srcSet(P2, 'shear', 'example');
  const back = W.SBDModel.importJSON(W.SBDModel.exportJSON(P2)); assert.ok(back.ok); assert.deepEqual(J(back.errors), []);
  assert.equal(CD.srcGet(back.project, 'flex'), 'custom'); assert.equal(CD.srcGet(back.project, 'shear'), 'example');
  assert.deepEqual(J(back.project.custom), J(P2.custom));
  assert.match(W.SBDFlexureUI.build({ P: back.project, g: 0 }).what, /^Demands: entered \(Custom\)/);
  assert.match(W.SBDShearUI.build({ P: back.project, g: 0 }).what, /^Example/);
  CD.srcSet(P2, 'shear', null); assert.equal(P2.demandSrc.shear, undefined); CD.srcSet(P2, 'flex', 'file'); assert.equal(P2.demandSrc, undefined, 'a file is not saved');
  // a bad shape is an error of the model (the tab never sees it)
  assert.ok(W.SBDModel.validate({ ...P, custom: [] }).errors.some(e => e.path === 'custom'));
  assert.ok(W.SBDModel.validate({ ...P, demandSrc: { flex: 'x' } }).errors.some(e => e.path === 'demandSrc'));
  // the analysis cache does not see the custom rows (editing them does not run the analysis again)
  const n = W.SBDReportData.cache.size; W.SBDAnalysis.analyzeGirder(P2, 0); W.SBDAnalysis.analyzeGirder(P, 0); assert.ok(W.SBDReportData.cache.size <= n + 1);
});

test('Custom table: paste from Excel (tab-separated, header skipped), the girder\'s own rows, checks of the entries', () => {
  const P = W.SBDModel.defaultProject();
  const r = CD.paste(P, 'flex', 0, 'r:0:x', 'x\tM_DC1\tM_DC2\n44\t1,450\t210\n100\t(25)\tabc\n');
  assert.equal(r.rows, 2); assert.equal(r.skipped, 1);
  assert.deepEqual(J(CD.get(P, 'flex', 0).rows), [{ x: 44, M_DC1: 1450, M_DC2: 210 }, { x: 100, M_DC1: -25 }]);
  CD.paste(P, 'flex', 0, 'r:1:M_DW', '5\t6\n7\t8');   // from a cell: fills right and down
  assert.deepEqual(J(CD.get(P, 'flex', 0).rows[1]), { x: 100, M_DC1: -25, M_DW: 5, M_LLpos: 6 }); assert.deepEqual(J(CD.get(P, 'flex', 0).rows[2]), { M_DW: 7, M_LLpos: 8 });
  assert.match(CD.payload(P, 0, 'flex').err, /enter x/);
  CD.get(P, 'flex', 0).rows[2].x = 44; assert.match(CD.payload(P, 0, 'flex').err, /Two rows at x = 44/);
  CD.get(P, 'flex', 0).rows[2].x = 400; assert.match(CD.payload(P, 0, 'flex').err, /outside the girder/);
  assert.match(CD.payload(W.SBDModel.defaultProject(), 0, 'flex').err, /No rows entered/);
  CD.paste(P, 'shear', 0, 's:1:DC1', '10\t11\n12\t13'); assert.deepEqual(J(CD.get(P, 'shear', 0).sup), [{}, { DC1: 10, DC2: 11 }, { DC1: 12, DC2: 13 }]);
});

test('Report: "each tab\'s choice" takes the entered rows of a tab set to Custom, shows the entered table and the custom step', () => {
  const P = W.SBDModel.defaultProject();
  setRows(P, 'flex', 0, [{ x: 44, M_DC1: 1450, M_DC2: 210, M_DW: 240, M_LLpos: 1650, M_LLneg: -400 }]);
  setRows(P, 'shear', 0, [{ x: 44, V_DC1: 20, V_DC2: 3, V_DW: 3, V_LLpos: 40 }], { sup: [{ DC1: 100, LL: 120 }] });
  CD.srcSet(P, 'flex', 'custom'); CD.srcSet(P, 'shear', 'custom');
  const B = W.SBDReportData.compute(P, 0, { src: 'tabs', want: { flex: true, shear: true, rt: true } });
  assert.deepEqual(J(B.err), {}); assert.ok(B.custom.flex && B.custom.shear);
  assert.equal(B.flex.rows.length, 1); assert.equal(B.flexSame, false, 'the rating keeps this project\'s analysis');
  const M = W.SBDReportBuild.model(B, { detail: 'gov' }), doc = W.SharedReport.build(M);
  assert.deepEqual(J(doc.unresolved), []);
  const fs = M.sections.find(s => s.id === 'flex'), cd = fs.subs.find(q => q.id === 'cd'); assert.ok(cd, 'the entered table');
  const t = cd.items.find(i => i.type === 'table'); assert.equal(t.rows.length, 1); assert.equal(t.rows[0][0], '44.000');
  const st = fs.subs.flatMap(q => q.items).find(i => i.type === 'steps'); assert.ok(st.steps.some(s => s.id === 'cd.src'));
  const ss = M.sections.find(s => s.id === 'shear'); assert.ok(ss.subs.find(q => q.id === 'cd').items.filter(i => i.type === 'table').length === 2, 'rows and reactions');
  // 'analysis' (default) ignores the tab choices, as before
  const B0 = W.SBDReportData.compute(P, 0, { want: { flex: true } }); assert.equal(B0.custom, null); assert.ok(B0.flex.rows.length > 100);
});
