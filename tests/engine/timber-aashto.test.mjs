// "Timber Beam Check.html", AASHTO LRFD 10th Ed. (2024) mode, phase T1 (fix log TBA1, 2026-11-16): the tool's own engine
// (tbc-source.mjs) — a sample of the entered table values pinned with their table and row, the Art. 8.4.4 factors, the hand
// checks of the fix log, the code switch in the saved data (absent = NDS; version 4 only with AASHTO) and the input errors.
// Every entered value was compared with the AASHTO LRFD 10th Ed. PDF (rendered pages and text; fix log TBA1, "How verified").
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { tbcEngine } from './tbc-source.mjs';

const E = tbcEngine();
const J = v => JSON.parse(JSON.stringify(v));   // values from the vm realm compared as plain data
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b} (±${tol})`);
const aas = (fn) => { const m = E.tbcDefaultModel(); m.design.code = 'AASHTO'; m.design.aashto = E.tbcAashtoDefaults(); fn && fn(m); return E.tbcAashto(m); };

test('Table 8.4.1.1.4-1 sample values (ksi; [Fbo, Fto, Fvo, Fcpo, Fco, Eo])', () => {
  const S = E.AAS_SAWN, P = [
    [S['DF-L'].dim['No.2'], [0.900, 0.575, 0.180, 0.625, 1.350, 1600], 'DF-L No. 2, Dimension'],
    [S['DF-L'].dim['No.1&Btr'], [1.200, 0.800, 0.180, 0.625, 1.550, 1800], 'DF-L No. 1 & Btr, Dimension'],
    [S['DF-L'].BS['DSS'], [1.900, 1.100, 0.170, 0.730, 1.300, 1700], 'DF-L Dense Select Structural, Beams and Stringers'],
    [S['DF-L'].BS['No.1'], [1.350, 0.675, 0.170, 0.625, 0.925, 1600], 'DF-L No. 1, Beams and Stringers'],
    [S['DF-L'].BS['DNo.2'], [1.000, 0.500, 0.170, 0.730, 0.700, 1400], 'DF-L No. 2 Dense, Beams and Stringers (WWPA)'],
    [S['DF-L'].PT['No.2'], [0.750, 0.475, 0.170, 0.625, 0.700, 1300], 'DF-L No. 2, Posts and Timbers'],
    [S.ES.dim['SS'], [1.250, 0.575, 0.140, 0.335, 1.200, 1200], 'Eastern Softwoods Select Structural'],
    [S.HF.BS['No.1'], [1.050, 0.525, 0.140, 0.405, 0.750, 1300], 'Hem-Fir No. 1, Beams and Stringers'],
    [S.MSP.dimW['10']['No.2'], [0.800, 0.475, 0.175, 0.565, 1.300, 1400], 'Mixed Southern Pine No. 2, Dimension 10 in. wide'],
    [S.MSP.T['SS'], [1.500, 1.000, 0.165, 0.375, 0.900, 1300], 'Mixed Southern Pine Select Structural, 5 in. x 5 in. and larger'],
    [S.NRO.BS['No.2'], [0.875, 0.425, 0.205, 0.885, 0.500, 1000], 'Northern Red Oak No. 2, Beams and Stringers'],
    [S.RM.PT['No.1'], [1.150, 0.750, 0.195, 0.615, 0.825, 1500], 'Red Maple No. 1, Posts and Timbers'],
    [S.RO.dim['No.1'], [0.825, 0.500, 0.170, 0.820, 0.825, 1300], 'Red Oak No. 1, Dimension'],
    [S.SP.dimW['2-4']['SS'], [2.350, 1.650, 0.175, 0.565, 1.900, 1800], 'Southern Pine Select Structural, Dimension 2 in.-4 in. wide'],
    [S.SP.dimW['12']['No.1'], [1.000, 0.650, 0.175, 0.565, 1.400, 1600], 'Southern Pine No. 1, Dimension 12 in. wide'],
    [S.SP.T['No.2'], [0.850, 0.550, 0.165, 0.375, 0.525, 1200], 'Southern Pine No. 2, 5 in. x 5 in. and larger'],
    [S.SPF.dim['No.1/No.2'], [0.875, 0.450, 0.135, 0.425, 1.150, 1400], 'Spruce-Pine-Fir No. 1 / No. 2, Dimension'],
    [S.SPFS.BS['SS'], [1.050, 0.625, 0.125, 0.335, 0.675, 1200], 'Spruce-Pine-Fir (South) Select Structural, Beams and Stringers'],
    [S.YP.dim['No.2'], [0.700, 0.400, 0.145, 0.420, 0.575, 1300], 'Yellow Poplar No. 2, Dimension']];
  P.forEach(([got, want, row]) => assert.deepEqual(J(got), want, 'Table 8.4.1.1.4-1, ' + row));
  // 122 tabulated rows: DF-L 4 + 5 + 5 (WCLIB) + 6 + 6 (WWPA), the WCLIB rows being the WWPA rows without No. 2 Dense
  const n = Object.values(S).reduce((s, sp) => s + ['dim', 'BS', 'PT', 'T'].reduce((t, c) => t + (sp[c] ? Object.keys(sp[c]).length : 0), 0) + (sp.dimW ? Object.values(sp.dimW).reduce((t, w) => t + Object.keys(w).length, 0) : 0), 0);
  assert.equal(n + 10, 122, 'rows of Table 8.4.1.1.4-1 (the 10 WCLIB DF-L timber rows are the same values as WWPA)');
});

test('Tables 8.4.1.2.3-1 and 8.4.1.2.3-2 sample values (ksi)', () => {
  const G = E.AAS_GL1, H = E.AAS_GL2;
  assert.deepEqual(J(G['24F-V4 DF/DF'].v), [2.400, 1.850, 0.650, 0.650, 0.265, 1800], 'Table 8.4.1.2.3-1, 24F-V4 DF/DF: Fbxo+, Fbxo-, Fcpo t/c face, Fvxo, Exo');
  assert.deepEqual(J(G['20F-V3 DF/DF'].v), [2.000, 1.450, 0.650, 0.560, 0.265, 1600], 'Table 8.4.1.2.3-1, 20F-V3 DF/DF');
  assert.deepEqual(J(G['24F-V4 SP/SP'].v), [2.400, 1.650, 0.740, 0.650, 0.210, 1700], 'Table 8.4.1.2.3-1, 24F-V4 SP/SP (Fvxo 0.210)');
  assert.deepEqual(J(G['20F-1.5E'].v), [2.0, 1.1, 0.425, 0.425, 0.195, 1500], 'Table 8.4.1.2.3-1, 20F-1.5E (one Fcpo; Fvxo 0.195)');
  assert.deepEqual(J(G['26F-V2 SP/SP'].v), [2.600, 2.100, 0.740, 0.740, 0.300, 1900], 'Table 8.4.1.2.3-1, 26F-V2 SP/SP');
  assert.equal(Object.keys(G).length, 24, 'Table 8.4.1.2.3-1 rows');
  assert.deepEqual(J(H['2'].v), [1600, 0.560, 1.700, 0.265], 'Table 8.4.1.2.3-2, No. 2 DF L2: Eo, Fcpo, Fbxo, Fvxo');
  assert.deepEqual(J(H['49'].v), [1700, 0.650, 1.800, 0.300], 'Table 8.4.1.2.3-2, No. 49 SP N1M16');
  assert.equal(Object.keys(H).length, 15, 'Table 8.4.1.2.3-2 rows');
});

test('Art. 8.4.4 factor tables and Art. 8.5.2.2', () => {
  assert.deepEqual(J(E.AAS_PHI), { Fb: 0.85, Fv: 0.75, Fcp: 0.90 }, 'Art. 8.5.2.2');
  assert.deepEqual(J(E.AAS_CLAMBDA.map(c => c[2])), [0.8, 1.0, 1.0, 0.6, 1.0], 'Table 8.4.4.9-1: Strength I, II, III, IV, Extreme Event I');
  assert.deepEqual(J(E.AAS_CM_DIM), { FbLo: 1.00, FbHi: 0.85, Fv: 0.97, Fcp: 0.67, E: 0.90 }, 'Table 8.4.4.3-1, <= 4 in.');
  assert.deepEqual(J(E.AAS_CM_TIM), { Fb: 1.00, Fv: 1.00, Fcp: 0.67, E: 1.00 }, 'Table 8.4.4.3-1, > 4 in.');
  assert.deepEqual(J(E.AAS_CM_GL), { Fb: 0.80, Fv: 0.875, Fcp: 0.53, E: 0.833 }, 'Table 8.4.4.3-2');
  assert.deepEqual(J(E.AAS_CF_DIM[8]), [1.2, 1.3], 'Table 8.4.4.4-1, width 8 in.');
  assert.deepEqual(J(E.AAS_CF_DIM[14]), [0.9, 1.0], 'Table 8.4.4.4-1, width >= 14 in.');
  assert.deepEqual(J(E.AAS_CF_BS_WIDE['No.1']), [0.74, 0.90], 'Table 8.4.4.4-2, No. 1');
  assert.deepEqual(J(E.AAS_CFU[6]), [1.15, 1.05], 'Table 8.4.4.6-1, width 6 in.');
  assert.deepEqual(J(E.AAS_CI), { Fb: 0.80, Fv: 0.80, Fcp: 1.00, E: 0.95 }, 'Table 8.4.4.7-1');
  assert.deepEqual(J(E.AAS_CD_PLANK), { '4x6': 1.10, '4x8': 1.15, '4x10': 1.25, '4x12': 1.50 }, 'Table 8.4.4.8-2');
});

test('hand check 1: 2x10 DF-L No. 2, dry, edgewise (fix log TBA1)', () => {
  const A = aas();
  assert.ok(A.ok, A.errors.join('; '));
  close(A.CKF.Fb, 2.5 / 0.85, 1e-12, 'CKF,b'); assert.equal(A.CF.Fb, 1.1, 'CF Table 8.4.4.4-1');
  // Fb = 0.900 x 2.9412 x 1.0 x 1.1 x 1.0 x 1.0 x 1.0 x 0.8 = 2.3294 ksi; phi Fb = 0.85 x 2.3294 = 1.980 ksi
  close(A.lims[0].Fb, 2.329412, 5e-6, 'Fb Strength I'); close(A.lims[0].phiFb, 1.98, 1e-9, 'phi Fb Strength I');
  close(A.lims[0].Fv, 0.48, 1e-12, 'Fv Strength I');   // 0.180 x 3.3333 x 0.8
  close(A.lims[0].Fcp, 0.625 * 2.1 / 0.9 * 0.8, 1e-12, 'Fcp Strength I');
  close(A.lims[3].Fb, 0.9 * 2.5 / 0.85 * 1.1 * 0.6, 1e-12, 'Fb Strength IV'); assert.equal(A.E, 1600, 'E');
});

test('hand check 2: 6x16 DF-L No. 1 Beams and Stringers, wet', () => {
  const A = aas(m => { m.material.size = '6x16'; m.design.aashto.gr = 'No.1'; m.design.moisture = 'Wet'; });
  assert.ok(A.ok, A.errors.join('; ')); assert.equal(A.cat, 'BS');
  close(A.CF.Fb, Math.pow(12 / 15.5, 1 / 9), 1e-12, 'CF Eq. 8.4.4.4-2'); close(A.CF.Fb, 0.97196, 5e-6, 'CF value');
  assert.deepEqual([A.CM.Fb, A.CM.Fv, A.CM.Fcp, A.CM.E], [1, 1, 0.67, 1], 'CM > 4 in.');
  // Fb = 1.350 x 2.9412 x 1.00 x 0.97196 x 0.8 = 3.0874 ksi; Fcp = 0.625 x 2.3333 x 0.67 x 0.8 = 0.78167 ksi
  close(A.lims[0].Fb, 3.08741, 5e-5, 'Fb Strength I'); close(A.lims[0].Fcp, 0.781667, 1e-6, 'Fcp Strength I'); assert.equal(A.E, 1600);
});

test('hand check 3: glulam 24F-V4 DF/DF 5-1/8 x 18, 30 ft, wet, tension laminations omitted', () => {
  const A = aas(m => { m.material.type = 'glulam'; m.geom.spans = [{ L: 30 }]; m.design.moisture = 'Wet'; m.design.aashto.noTL = true; });
  assert.ok(A.ok, A.errors.join('; '));
  close(A.R0.Fb, 1.8, 1e-12, 'Fbx+ x 0.75 (d = 18 >= 15)'); close(A.R0.Fbn, 1.3875, 1e-12, 'Fbx- x 0.75'); close(A.R0.Fv, 0.1908, 1e-12, 'Fvx x 0.72');
  // CV = [(12/18)(5.125/5.125)(21/30)]^0.10 = 0.46667^0.1 = 0.92662
  close(A.CV, Math.pow((12 / 18) * (21 / 30), 0.1), 1e-12, 'CV'); close(A.CV, 0.92662, 5e-6, 'CV value');
  // Fb+ = 1.8 x 2.9412 x 0.8 x 0.92662 x 0.8 = 3.1396 ksi; E = 1800 x 0.833 = 1499.4 ksi
  close(A.lims[0].Fb, 3.13963, 5e-5, 'Fb+ Strength I'); close(A.E, 1499.4, 1e-9, 'E');
  const B = aas(m => { m.material.type = 'glulam'; m.material.glulam.grp = 'SP'; m.material.glulam.b = 5; m.design.aashto.gl = '24F-V3 SP/SP'; });
  assert.ok(B.ok, B.errors.join('; ')); assert.equal(B.CVd.a, 0.05, 'a = 0.05 for Southern Pine');
});

test('other factors: CM threshold, SP sizes, flat use, incising, deck factors', () => {
  let A = aas(m => { m.design.aashto.gr = 'SS'; m.material.size = '2x6'; m.design.moisture = 'Wet'; });   // 1.5 x 1.3 = 1.95 > 1.15
  assert.equal(A.CM.Fb, 0.85); assert.equal(A.CM.Fv, 0.97);
  A = aas(m => { m.design.moisture = 'Wet'; }); assert.equal(A.CM.Fb, 1.0, '0.9 x 1.1 = 0.99 <= 1.15');
  A = aas(m => { m.design.aashto.sp = 'SP'; m.material.size = '6x12'; m.design.moisture = 'Wet'; }); assert.equal(A.cat, 'T'); assert.deepEqual([A.CM.Fb, A.CM.Fcp], [1, 1], 'SP timbers wet or dry');
  A = aas(m => { m.design.aashto.sp = 'SP'; m.material.size = '2x10'; }); assert.equal(A.CF.Fb, 1.0); assert.equal(A.ref.Fb, 0.8);
  A = aas(m => { m.material.size = '2x10'; m.design.flatUse = true; }); assert.equal(A.Cfu, 1.2);
  A = aas(m => { m.material.size = '6x16'; m.design.flatUse = true; m.design.aashto.gr = 'No.1'; }); assert.deepEqual([A.CF.Fb, A.CF.E], [0.74, 0.90], 'Table 8.4.4.4-2');
  A = aas(m => { m.design.incising = true; }); assert.deepEqual(J(A.Ci), J(E.AAS_CI)); close(A.E, 1600 * 0.95, 1e-9, 'E incised');
  A = aas(m => { m.design.aashto.deck = 'laminated'; }); assert.equal(A.Cd, 1.15);
  A = aas(m => { m.design.aashto.deck = 'stressed'; m.design.aashto.gr = 'SS'; }); assert.equal(A.Cd, 1.30);
  A = aas(m => { m.material.size = '4x6'; m.design.flatUse = true; m.design.aashto.deck = 'plank'; }); assert.deepEqual([A.Cd, A.Cfu], [1.10, 1], 'plank deck 4x6: no Cfu with Cd');
  A = aas(m => { m.material.size = 'Custom'; m.material.customB = 3.5; m.material.customD = 11.25; m.design.flatUse = true; m.design.aashto.deck = 'plank'; }); assert.equal(A.Cd, 1.50, 'plank 4x12 (custom size)');
});

test('input errors', () => {
  const has = (A, re, tab) => { assert.ok(!A.ok); const i = A.errors.findIndex(e => re.test(e)); assert.ok(i >= 0, A.errors.join('; ')); if (tab) assert.equal(A.errTab[i], tab); };
  has(aas(m => { m.material.type = 'scl'; }), /SCL/, 'material');
  has(aas(m => { m.design.aashto.sp = 'ES'; m.material.size = '6x12'; }), /no Beams and Stringers values/, 'material');
  has(aas(m => { m.design.aashto.gr = 'DSS'; }), /not tabulated/, 'material');
  has(aas(m => { m.material.size = '4x6'; m.design.aashto.deck = 'plank'; }), /Flat use/, 'factors');
  has(aas(m => { m.material.size = '2x10'; m.design.flatUse = true; m.design.aashto.deck = 'plank'; }), /planks/, 'factors');
  has(aas(m => { m.material.type = 'glulam'; m.design.flatUse = true; }), /Flat use/, 'factors');
  has(aas(m => { m.material.type = 'glulam'; m.design.aashto.gl = '24F-V3 SP/SP'; }), /species group/, 'material');
});

test('saved data: the code switch is optional (absent = NDS); version 4 only with AASHTO', () => {
  const d = E.tbcDefaultModel();
  const s = E.tbcSanitize(JSON.parse(JSON.stringify(d)));
  assert.ok(!('code' in s.design) && !('aashto' in s.design), 'NDS project: no new field');
  assert.equal(JSON.stringify(s), JSON.stringify(E.tbcSanitize(JSON.parse(JSON.stringify(s)))), 'round trip');
  assert.equal(E.tbcVersionFor(s), 2);
  const a = JSON.parse(JSON.stringify(d)); a.design.code = 'AASHTO'; a.design.aashto = { sp: 'HF', gr: 'No.1', gl: 'T2-49', deck: 'laminated', noTL: true };
  const t = E.tbcSanitize(a);
  assert.equal(t.design.code, 'AASHTO'); assert.deepEqual(JSON.parse(JSON.stringify(t.design.aashto)), a.design.aashto); assert.equal(E.tbcVersionFor(t), 4);
  const bad = JSON.parse(JSON.stringify(a)); bad.design.code = 'Other'; bad.design.aashto = { sp: 'XX', gr: 7, gl: 'nope', deck: 'x', noTL: 'yes' };
  const u = E.tbcSanitize(bad);
  assert.ok(!('code' in u.design)); assert.deepEqual(JSON.parse(JSON.stringify(u.design.aashto)), JSON.parse(JSON.stringify(E.tbcAashtoDefaults())));
  const v4 = { ...JSON.parse(JSON.stringify(t)), _schema: 'timber-beam-check', version: 4 };
  assert.equal(E.tbcMigrate(v4).model.design.code, 'AASHTO');
  assert.throws(() => E.tbcMigrate({ ...v4, version: 7 }), /newer format/);   // TBA2: the tool reads version 5 (bridge loads); TBA5: 6 (deflection limit)
});
