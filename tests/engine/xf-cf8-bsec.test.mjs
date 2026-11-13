// SBBS (2026-11-13; display only): apps/steel-bridge engine/crossframes.js checks CF8 — the web distortion stiffness β_sec is a term of the
// torsional brace system stiffness β_T (AASHTO LRFD 10th Ed. Eq. 6.7.4.2.2-6, springs in series), not a requirement of its own (the requirement
// is Eq. 6.7.4.2.2-1, (β_T)act ≥ (β_T)req). Its item had the status 'pass' hard-coded and was shown "OK" at any ratio (1.235 in the three-type
// 30 / 36 / 42 case). Now: no status of its own ('na'), labelled "component (see β_T)" on the tab and in the Report; the ratio is shown as before.
// The check's status and governing item are unchanged (β_T ≤ β_sec, so the system row's ratio is always the larger).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js'].map(E)));
const M = W.SBDModel, FUI = W.SBDFramingUI;
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const three = () => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, 30); setD(P, 0, 36);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, 42); return P; };
const NO = Object.fromEntries(['sum', 'proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'spl', 'wd', 'rt'].map(k => [k, false]));

test('three types 30 / 36 / 42, Mid: β_sec ratio 1.235 is labelled a component of β_T, not "OK"; the system row fails; CF8 fails as before', () => {
  const B = FUI.build({ P: three(), g: 0 }), c = B.C.find(q => q.id === 'CF8'), [br, sec, g, T] = c.items;
  assert.equal(sec.loc, 'Web distortion, β_sec'); assert.equal(sec.st, 'na'); assert.equal(sec.lbl, 'component (see β_T)'); assert.equal(sec.step, 'cf.sb.bsec');
  assert.equal(sec.cells[2], '1.23'); assert.ok(Math.abs(sec.r - 31420 / 25447) < 5e-4, `r = ${sec.r}`);   // β_T,req / β_sec = 31,420 / 25,447 = 1.235
  assert.equal(T.loc, 'System, β_T'); assert.equal(T.st, 'fail'); assert.ok(T.r > sec.r, 'β_T ≤ β_sec: the system ratio is the larger');
  assert.equal(c.status, 'fail'); assert.equal(c.gov, 3, 'the system row governs'); assert.equal(br.st, 'pass'); assert.equal(g.st, 'pass');
  // the Report's check table: the status cell of the β_sec row is the label
  const RB = W.SBDReportData.compute(three(), 0, { want: { frm: true } }), Mo = W.SBDReportBuild.model(RB, { detail: 'gov', include: NO });
  const rows = Mo.sections[0].subs.find(s => s.id === 'ck').items.find(i => i.type === 'table').rows.filter(r => /^CF8 /.test(r[0]));
  assert.equal(rows.length, 4); assert.equal(rows[1][5], 'component (see β_T)'); assert.equal(rows[3][5], 'Fail');
});

test('β_sec below the requirement (Exterior, ratio 0.72) and β_sec infinite (bracing ≥ 0.8 D): the same label; CF8 passes as before', () => {
  const c = FUI.build({ P: three(), g: 1 }).C.find(q => q.id === 'CF8'), sec = c.items[1];
  assert.equal(sec.lbl, 'component (see β_T)'); assert.ok(sec.r < 1); assert.equal(c.status, 'pass'); assert.equal(c.items[c.gov].loc, 'System, β_T');
  const d = FUI.build({ P: M.defaultProject(), g: 0 }).C.find(q => q.id === 'CF8'), s0 = d.items[1];
  assert.equal(s0.lbl, 'component (see β_T)'); assert.equal(s0.cells[0], '∞'); assert.equal(d.items[d.gov].loc, 'System, β_T');
});
