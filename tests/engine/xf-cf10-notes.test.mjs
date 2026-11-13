// SBCKN (2026-11-13; display only, CLAUDE.md §6): apps/steel-bridge ui/framing.js ckRec / recStep / ckNotes and report/builders.js frm — the
// check table of the Cross-frames tab and the Report showed only an item's demand and resistance (or its first two text cells), so CF10's
// recommendation and the bracing in use (its third and fourth cells) and every check's note were never shown. They are now: CF10's two texts
// in its Item cell, linked to the step that works them (cf.type, SB-22, else the girder depth d), and each check's note below the table.
// The values are those of SBDCrossframes.checks, unchanged.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared(...['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js'].map(E)));
const M = W.SBDModel, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const three = () => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, 30); setD(P, 0, 36);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, 42); return P; };
const NO = Object.fromEntries(['sum', 'proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'spl', 'wd', 'rt'].map(k => [k, false]));
const ckSub = (P, gi) => { const B = W.SBDReportData.compute(P, gi, { want: { frm: true } }), Mo = W.SBDReportBuild.model(B, { detail: 'gov', include: NO }), doc = W.SharedReport.build(Mo);
  assert.deepEqual(J(doc.unresolved), [], 'every [[key]] resolves'); return { sub: Mo.sections[0].subs.find(s => s.id === 'ck'), B }; };

test('CF10: the recommendation and the bracing in use, in the Report Item cell and linked to the step that works them', () => {
  // three types (Exterior 30, Mid 36, Core 42): a diaphragm is recommended per bay depth group (SB-22), worked in cf.type
  const { sub, B } = ckSub(three(), 0), row = sub.items.find(i => i.type === 'table').rows.find(r => /^CF10 /.test(r[0]));
  const it = B.frm.C.find(c => c.id === 'CF10').items[0];
  assert.equal(row[1], `Intermediate bracing. Recommended: ${it.cells[2]}. In use: ${it.cells[3]}. [[cf.type]]`);
  assert.match(row[1], /G1–G2, G5–G6: rolled diaphragm W30x99; G2–G3, G4–G5: rolled diaphragm W36x135; G3–G4: rolled diaphragm W36x135\. In use: X-frame\./);
  // the built-in project (saved before girder types): no cf.type step, the link goes to d (cf.dg); the ratio cell's dead cf.type link too
  const b = ckSub(M.defaultProject(), 0), r0 = b.sub.items.find(i => i.type === 'table').rows.find(r => /^CF10 /.test(r[0]));
  assert.equal(r0[1], 'Intermediate bracing. Recommended: K (bottom)-frame (S/h = 2.19). In use: X-frame. [[cf.dg]]'); assert.equal(r0[4].key, 'cf.dg');
  assert.equal(FUI.recStep(new Set(['cf.dg'])), 'cf.dg'); assert.equal(FUI.recStep(new Set(['cf.dg', 'cf.type'])), 'cf.type');
  assert.equal(FUI.ckRec({ id: 'CF11' }, { cells: ['a', 'b', 'c', 'd'] }), null);
});

test('every check note is shown below the check table (Report), CF10 linked; the numbers are those of the checks', () => {
  for (const [P, dOn] of [[three(), false], [M.defaultProject(), false], [(() => { const P = M.newProject(); Object.assign(P.crossframes.dia, { on: 'yes', shape: 'W21x44' }); return P; })(), true]]) {
    const { sub, B } = ckSub(P, 0), C = B.frm.C, notes = sub.items.filter(i => i.type === 'note').map(i => i.text);
    const withNote = C.filter(c => c.note); assert.ok(withNote.length >= (dOn ? 3 : 9), withNote.map(c => c.id).join());
    withNote.forEach(c => assert.ok(notes.some(t => t.startsWith(`${c.id}: `)), `${c.id} note shown`));
    assert.ok(notes.some(t => /^CF10: Basis: the girder depth d/.test(t) && /\[\[cf\.(type|dg)\]\]$/.test(t)), 'CF10 note linked');
    if (dOn) assert.ok(notes.some(t => /^CFD: Properties from nominal dimensions/.test(t)));
    // the demand / resistance cells are the checks' numbers, as before
    const rows = sub.items.find(i => i.type === 'table').rows; let k = 0;
    C.forEach(c => { if (!c.items.length) { k++; return; } c.items.forEach(it => { const r = rows[k++]; if (isFinite(it.demand)) assert.equal(r[2].t, W.SharedUnits.fmt(it.demand, 2)); }); });
  }
});
