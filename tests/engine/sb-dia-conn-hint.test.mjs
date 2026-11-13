// SB-26 (2026-11-13; engineer decision SB-26; display only): apps/steel-bridge ui/framing.js CONN_HINT, report/builders.js frm — the default
// diaphragm end connection (4 bolts per end at 3 in, bolt line 3.5 in from the web) is kept; a hint next to the connection inputs and an
// assumption note in the Report's framing checks say it is a placeholder that must be designed (it usually fails as entered). No value changes.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js'].map(E)));
const M = W.SBDModel, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const NO = Object.fromEntries(['sum', 'proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'spl', 'wd', 'rt'].map(k => [k, false]));
const notes = P => { const B = W.SBDReportData.compute(P, 0, { want: { frm: true } }), Mo = W.SBDReportBuild.model(B, { detail: 'gov', include: NO }), doc = W.SharedReport.build(Mo);
  assert.deepEqual(J(doc.unresolved), [], 'every [[key]] resolves'); return Mo.sections[0].subs.find(s => s.id === 'ck').items.filter(i => i.type === 'note').map(i => i.text); };
const h = { num: (p, l) => `<input data-path="${p}">`, sel: () => '', card: (t, b) => b, esc: s => String(s) };

test('the hint next to the diaphragm connection inputs (diaphragm on only); the default connection unchanged', () => {
  const P = M.newProject(); Object.assign(P.crossframes.dia, { on: 'yes', shape: 'W21x44' });
  const html = FUI.inputs(P, h), i = html.indexOf('data-path="crossframes.dia.ecc"'), j = html.indexOf(FUI.CONN_HINT);
  assert.ok(i > 0 && j > i, 'right after the bolt line input'); assert.match(FUI.CONN_HINT, /placeholder, not a design\. It usually fails the CFD \/ CFE bolted connection checks as entered/);
  assert.ok(!FUI.inputs(M.newProject(), h).includes(FUI.CONN_HINT), 'cross-frames: no hint');
  const d = M.defaultCrossframes().dia; assert.deepEqual([d.nb, d.pitch, d.ecc], [4, 3, 3.5]);
});

test('the Report: an assumption note with this project\'s connection (diaphragm only), the Diaphragms tab linked', () => {
  const P = M.newProject(); Object.assign(P.crossframes.dia, { on: 'yes', shape: 'W21x44' });
  const n = notes(P).filter(t => /SB-26/.test(t)); assert.equal(n.length, 1);
  assert.match(n[0], /^Assumption: the default end connection of the diaphragm \(4 bolts per end in one row at 3 in pitch, the bolt line 3\.5 in from the girder web, the bolt diameter and grade of the Framing & bracing tab\) is a placeholder, not a design\./);
  assert.match(n[0], /\[\[tab:cf\|Diaphragms tab\]\]; this project: 4 bolts per end at 3\.00 in, bolt line 3\.50 in from the web\.\)$/);
  P.crossframes.dia.nb = 6; assert.match(notes(P).find(t => /SB-26/.test(t)), /this project: 6 bolts per end/);
  assert.ok(!notes(M.newProject()).some(t => /SB-26/.test(t)), 'cross-frames: no note');
});
