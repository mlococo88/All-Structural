// SBNS (2026-11-13; Decision pending engineer review, following the engineer's choice "name nearest, flag it", SB-27): apps/steel-bridge
// engine/crossframes.js checks, CF10 — when CF10 names a nearest section (no channel or W of the list meets both the 0.75d depth requirement
// and the fit d ≤ D_0 − c), the CF10 row's status is 'warn' (Warning), the status the CFD depth item gives the same shortfall, also with a
// diaphragm in use (before: 'pass'). On the tab (FUI.build), in the Report's check table (frm) and in the Summary (the Diaphragms cell's
// warnings and the warning list). Where a section meets both: unchanged ('pass' with a diaphragm; 'warn' with cross-frames, as before).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js'].map(E)));
W.SBDReportData.install();
const M = W.SBDModel, FUI = W.SBDFramingUI, S = W.SBDSummary;
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const dia = (P, sh, grp) => { Object.assign(P.crossframes.dia, { on: 'yes', shape: sh }); if (grp) P.crossframes.dia.grp = grp; return P; };
const NO = Object.fromEntries(['sum', 'proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'spl', 'wd', 'rt'].map(k => [k, false]));
const cf10 = (P, gi) => FUI.build({ P, g: gi }).C.find(c => c.id === 'CF10');
const rptSt = (P, gi) => { const B = W.SBDReportData.compute(P, gi, { want: { frm: true } }), Mo = W.SBDReportBuild.model(B, { detail: 'gov', include: NO });
  const row = Mo.sections[0].subs.find(s => s.id === 'ck').items.find(i => i.type === 'table').rows.find(r => /^CF10 /.test(r[0])); return row[row.length - 1]; };
const sum = (P, gi) => { const k = S.modOf('cf').k; return S.cells(P, gi, { [k]: S.run(P, gi, k) }); };
const W10 = 'Diaphragms: CF10 Intermediate bracing type for the girder depth, Intermediate bracing: Warning.';

test('hand check 1: Interior 30 / Exterior 36, diaphragm W27x84 (CF10 nearest W27x84, 28.41/26.70 = 1.064): CF10 Warning, as the CFD depth item', () => {
  for (const gi of [0, 1]) {
    const P = dia(two(30, 36), 'W27x84'), C = FUI.build({ P, g: gi }).C, c = C.find(q => q.id === 'CF10');
    assert.match(c.items[0].cells[2], /^rolled diaphragm W27x84: the nearest section, FAILS the depth requirement .*ratio 1\.064; SB-27\)$/);
    assert.equal(c.items[0].st, 'warn'); assert.equal(c.status, 'warn');
    const dep = C.find(q => q.id === 'CFD').items.find(i => /^Depth/.test(i.loc)); assert.equal(dep.st, 'warn'); assert.equal(+dep.r.toFixed(3), 1.064);
    assert.equal(rptSt(dia(two(30, 36), 'W27x84'), gi), 'Warning');
    const G = sum(dia(two(30, 36), 'W27x84'), gi); assert.ok(G.warn.includes(W10)); assert.equal(G.cells.cf.nWarn, 3, 'CFD depth (intermediate, end) and CF10');
  }
});

test('hand check 2: three types 30 / 36 / 42, diaphragms per group (W27x84, W33x118 nearest: 32.91/32.90 = 1.0003; W36x135): CF10 Warning', () => {
  const mk = () => dia(three(30, 36, 42), 'W33x118', { '0,4': 'W27x84', '1,3': 'W33x118', 2: 'W36x135' });
  for (const gi of [0, 1, 2]) {
    const c = cf10(mk(), gi), T = c.items[0].cells[2];
    assert.match(T, /G2–G3, G4–G5: rolled diaphragm W33x118: the nearest section, FAILS the depth requirement .*0\.01 in short, ratio 1\.000; SB-27\)/);
    assert.ok(Math.abs(32.91 / 32.90 - 1.0003) < 1e-4);
    assert.equal(c.items[0].st, 'warn'); assert.equal(rptSt(mk(), gi), 'Warning'); assert.ok(sum(mk(), gi).warn.includes(W10));
  }
});

test('unchanged where a section meets both, or with cross-frames: equal depths W27x84 OK; c = 0 W30x99 OK; the built-in project', () => {
  const ok = dia(two(30, 30), 'W27x84'); assert.equal(cf10(ok, 0).items[0].st, 'pass'); assert.equal(rptSt(dia(two(30, 30), 'W27x84'), 0), 'OK');
  assert.ok(!sum(dia(two(30, 30), 'W27x84'), 0).warn.includes(W10));
  const c0 = dia(two(30, 36), 'W30x99'); c0.crossframes.dia.clr = 0; assert.equal(cf10(c0, 0).items[0].st, 'pass', 'c = 0: W30x99 meets both');
  const xf = two(30, 36); assert.equal(xf.crossframes.dia.on === 'yes', false); assert.equal(cf10(xf, 0).items[0].st, 'warn', 'cross-frames below the depth minimum: warn, as before');
  assert.equal(cf10(M.defaultProject(), 0).items[0].st, 'pass', 'the built-in project: deep, cross-frames');
});
