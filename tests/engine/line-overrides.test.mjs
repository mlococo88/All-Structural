// SBLO (2026-11-13; engineer decisions SB-7, SB-9, SB-10): apps/steel-bridge per-line overrides of a girder type — engine/model.js lineOv,
// lineOvEntry, lineOvReset, effective, customAt, migrateLineOv, atLine; engine/autodesign.js typeProject (each line's copy reads its line's
// values); ui/handoffs.js lldfApply for one line; ui/demands.js entry for one line.
// 1. A project without overrides (saved before, or new): atLine as before (the design line is P itself; the analysis unchanged).
// 2. A line's entered values override the type's on that line only; blank keys take the type's; the boxes and the pull likewise.
// 3. The analysis of a line with overrides equals the analysis of a project storing those values on the type (the same numbers).
// 4. Reset to the type removes the line's values; migration keeps a malformed field (lineOvBad) and drops empty entries; validate.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT, plain } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js',
  'engine/rating.js', 'engine/welds.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js', 'ui/welds.js', 'engine/splplace.js', 'engine/autodesign.js', 'ui/handoffs.js', 'ui/demands.js'].map(E));
const M = W.SBDModel, AN = W.SBDAnalysis, AD = W.SBDAutoDesign, J = o => JSON.parse(JSON.stringify(o));
const anKey = R => JSON.stringify({ ...plain(R), girder: null, gi: null });

test('no overrides: atLine as before; saved projects carry no lineOv and read none', () => {
  const P = M.newProject(), D = M.defaultProject();
  assert.equal(M.atLine(P, 0, 1), P, 'design line: P itself'); assert.notEqual(M.atLine(P, 0, 2), P);
  assert.equal(M.lineOv(P, 0, 2), null); assert.ok(!('lineOv' in P.girders[0])); assert.equal(M.migrateLineOv(D), null); assert.equal(JSON.stringify(D), JSON.stringify(M.defaultProject()));
  const V = M.atLine(P, 0, 2); assert.equal(V.girders[0].line, 2); assert.equal(V.girders[0].loadsManual, P.girders[0].loadsManual);
});

test('a line\'s values override the type\'s on that line only; blank keys and boxes take the type\'s', () => {
  const P = M.newProject(), g = P.girders[0]; g.loadsManual = { DC2: 0.3, DW: 0.2 }; g.loadsOverride = true; g.dfManual = { gM: 0.7 }; g.dfOverride = true;
  const o = M.lineOvEntry(P, 0, 3); o.loadsManual = { DC2: 0.45, DW: '' }; o.dfOverride = false; o.dfPull = { use: true, spans: [{ gM: 0.8 }], piers: [], source: { line: 3 } };
  const V3 = M.atLine(P, 0, 3).girders[0], V2 = M.atLine(P, 0, 2).girders[0];
  assert.deepEqual(J(V3.loadsManual), { DC2: 0.45, DW: 0.2 }, 'DC2 the line\'s, DW (blank on the line) the type\'s');
  assert.equal(V3.loadsOverride, true); assert.equal(V3.dfOverride, false); assert.equal(V3.dfPull.spans[0].gM, 0.8); assert.deepEqual(J(V3.dfManual), { gM: 0.7 });
  assert.deepEqual(J(V2.loadsManual), { DC2: 0.3, DW: 0.2 }); assert.equal(V2.dfOverride, true); assert.equal(V2.dfPull, undefined, 'line G3: the type\'s values');
  assert.deepEqual(J(P.girders[0].loadsManual), { DC2: 0.3, DW: 0.2 }, 'the type itself unchanged');
  // on the design line too
  const d = M.lineOvEntry(P, 0, 1); d.loadsManual = { DC2: 0.6 }; const V1 = M.atLine(P, 0, 1); assert.notEqual(V1, P); assert.equal(V1.girders[0].loadsManual.DC2, 0.6);
});

test('the analysis of a line with overrides = a project storing those values on the type', () => {
  const P = M.newProject(), o = M.lineOvEntry(P, 0, 2); o.loadsManual = { DC2: 0.45, DW: 0.31 }; o.loadsOverride = true; o.dfManual = { gM: 0.72, gV: 0.9 }; o.dfOverride = true;
  const A = AN.analyzeGirder(M.atLine(P, 0, 2), 0);
  const Q = M.newProject(); Object.assign(Q.girders[0], { loadsManual: { DC2: 0.45, DW: 0.31 }, loadsOverride: true, dfManual: { gM: 0.72, gV: 0.9 }, dfOverride: true });
  const B = AN.analyzeGirder(M.atLine(Q, 0, 2), 0); assert.equal(anKey(A), anKey(B));
  const C = AN.analyzeGirder(M.atLine(P, 0, 3), 0), D0 = AN.analyzeGirder(M.atLine(M.newProject(), 0, 3), 0); assert.equal(anKey(C), anKey(D0), 'line G4 without overrides: as before');
  assert.notEqual(anKey(A), anKey(AN.analyzeGirder(M.atLine(M.newProject(), 0, 2), 0)));
});

test('Auto design: each line\'s copy of the type reads its line\'s values', () => {
  const P = M.newProject(), o = M.lineOvEntry(P, 0, 2); o.loadsManual = { DC2: 0.45 }; o.loadsOverride = true;
  const Q = AD.typeProject(P, 0), k = Q.girders.findIndex(g => g.line === 2 && !g.adFixed);
  assert.equal(Q.girders[k].loadsManual.DC2, 0.45); assert.equal(Q.girders[k].loadsOverride, true);
  Q.girders.filter(g => !g.adFixed && g.line !== 2).forEach(g => { assert.equal(g.loadsManual, undefined); assert.equal(g.loadsOverride, undefined); });
  assert.equal(anKey(AN.analyzeGirder(Q, k)), anKey(AN.analyzeGirder(M.atLine(P, 0, 2), 0)), 'the run computes what the Summary computes');
});

test('LL & DL pull for one line; Custom demands for one line; reset; migration; validate', () => {
  const P = M.newProject(), H = W.SBDHandoffs, plan = { pull: { use: true, spans: [{ gM: 0.81 }], piers: [], source: { line: 3 } }, rows: [{ lbl: 'Span 1: g moment', nu: 0.81 }] };
  H.lldfApply(P, 0, plan, '2026-11-13T15:00:00.000Z', 3); assert.equal(P.girders[0].dfPull, undefined); assert.equal(P.girders[0].lineOv['3'].dfPull.spans[0].gM, 0.81);
  H.lldfApply(P, 0, plan, '2026-11-13T15:00:00.000Z'); assert.equal(P.girders[0].dfPull.spans[0].gM, 0.81, 'no line: the type, as before');
  const CD = W.SBDCustomDemands; P.custom = { flex: { G1: { mode: 'unf', rows: [{ x: 10, M_DC1: 100 }], sup: [] } } };
  CD.setLovTarget(() => ({ gi: 0, j: 2 })); const Eg = CD.entry(P, 'flex', 0); assert.deepEqual(J(Eg.rows), [{ x: 10, M_DC1: 100 }], 'starts as a copy of the type\'s'); Eg.rows[0].M_DC1 = 150;
  assert.equal(P.custom.flex.G1.rows[0].M_DC1, 100, 'the type\'s table unchanged'); assert.equal(M.atLine(P, 0, 2).custom.flex.G1.rows[0].M_DC1, 150); assert.equal(M.atLine(P, 0, 3).custom.flex.G1.rows[0].M_DC1, 100);
  CD.setLovTarget(null); assert.equal(CD.entry(P, 'flex', 0), P.custom.flex.G1);
  M.lineOvReset(P, 0, 2, 'custom.flex'); assert.equal(P.girders[0].lineOv['2'], undefined); M.lineOvReset(P, 0, 3); assert.equal(P.girders[0].lineOv, undefined);
  const B = M.newProject(); B.girders[0].lineOv = 'bad'; B.girders[1].lineOv = { 0: {}, 4: { dfOverride: true } };
  assert.match(M.migrateLineOv(B), /could not be read/); assert.equal(B.girders[0].lineOvBad, 'bad'); assert.deepEqual(J(B.girders[1].lineOv), { 4: { dfOverride: true } });
  assert.equal(M.validate(B).errors.filter(e => /lineOv/.test(e.path)).length, 0); B.girders[1].lineOv = []; assert.ok(M.validate(B).errors.some(e => /lineOv/.test(e.path)));
  const T = M.importJSON(JSON.stringify(M.defaultProject())); assert.deepEqual(J(T.notes), []);
});
