// apps/ps-bridge (2026-11-14; decision pending engineer review; updated for PS-30 / PS-32, the CTDOT plate sections of engine/sections.js): box beam and voided deck slab voids are drawn where the engine places them
//   (sectionVoids, pbd-section.js: a box cell on the bottom wall, y = wall … wall + voidH; voided slab round voids on mid-depth). The old app's
//   section graphic centred the box void on the depth; the new app keeps every graphic on the engine's position (the one tensionSideArea uses)
//   and says so: the Section properties tab's gross-section card (ui/section.js voidNote) and the Report's §2 assumptions (report/builders.js
//   voidNotes). Checked: (1) the note's numbers = the library's and sectionVoids' (every box and voided slab), none for other shapes; (2) the
//   Section properties graphic draws the void at sectionVoids' position (box: 5 in above the soffit, not centred); (3) the tab card and the
//   Report §2 carry the note for a box design and not for an I-girder; (4) nothing computed changes (the note reads R.g only).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBD,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const GIRDERS = vm.runInContext('GIRDERS', W);
const design = (girder, o) => { const P = W.PSBModel.defaultProject(); Object.assign(P.base, { girder, ...(o || {}) }); const inp = W.PSBDesign.inputs(P); return { P, inp, R: W.PSBHoldDown.compute(inp) }; };
const BOX = { ts: 6, harp: { n: 0, yEnd: 8, yMid: 4, frac: 0.4 }, rows: [{ n: 10, y: 2, nd: 0, dbnd: 0 }] };

test('void note: the numbers of the library and of sectionVoids, for every box beam and voided deck slab; none for the other shapes', () => {
  for (const [n, L] of Object.entries(GIRDERS).filter(([k]) => k !== 'Custom')) {
    const g = W.girderGross({ girder: n, S: 8, mat: { wc: 0.15 } }), t = W.PSBUiSection.voidNote(g), v = W.sectionVoids(g);
    if (L.box) {   // PS-30: every box is a CTDOT plate section: the void centred between the 5½ in slabs
      assert.equal(v.length, 1); assert.equal(v[0].y - v[0].h / 2, L.wall, `${n}: the void starts on the bottom wall`); assert.equal(L.wall, 5.5); assert.equal(L.h - L.wall - L.voidH, 5.5, n + ': top slab 5½ in');
      assert.ok(t.includes(`y = ${L.wall.toFixed(1)} to ${(L.wall + L.voidH).toFixed(1)} in above the soffit, centred between the 5.5 in top and bottom slabs`)
        && t.includes(`${L.voidW.toFixed(1)} × ${L.voidH.toFixed(1)} in cell`) && /where the engine places it \(sectionVoids\)/.test(t) && /are the plate's values \(AASHTO B[IV]+-(36|48), CTDOT BDM plate 5\.2\.1b, PDF p\. 327\)/.test(t), `${n}: ${t}`);
    } else if (L.deck && L.voids) {   // PS-32: the CTDOT voided slabs (the plate's voids)
      const e = W.PSBSections.STD[n]; assert.ok(e, n);
      assert.ok(v.every(q => q.y === L.h / 2)); assert.ok(t.startsWith(`Voids: ${e.src.voids.map(q => `Ø${q.d.toFixed(1)} in at x = ${q.x.toFixed(1)} in`).join(', ')}, on mid-depth (y = ${(L.h / 2).toFixed(1)} in)`), `${n}: ${t}`);
    } else assert.equal(t, '', n);
  }
});

test('void note: the Section properties graphic draws the box void where sectionVoids puts it (BI-36, PS-30: 5.5 to 21.5 in above the soffit, centred)', () => {
  const d = design('AASHTO BI-36 (27in)', BOX), VK = W.PSBVizKit, s0 = VK.scene, rects = [];
  VK.scene = () => { const S = s0(), r0 = S.rect; S.rect = (x0, y0, x1, y1, cls, o) => { if (cls === 'dt-cc' && o && o.fill === '#fff') rects.push([x0, y0, x1, y1]); return r0(x0, y0, x1, y1, cls, o); }; return S; };
  try { W.PSBUiSection.figure(d, 700); } finally { VK.scene = s0; }
  assert.deepEqual(JSON.parse(JSON.stringify(rects)), [[-12.75, 5.5, 12.75, 21.5]]);
});

test('void note: on the Section properties tab and in the Report §2 assumptions for a box design; not for an I-girder; nothing computed changes', () => {
  for (const [girder, o, has] of [['AASHTO BIII-36 (39in)', BOX, true], ['AASHTO SIV-48 (21in)', BOX, true], ['PCI BT-72', null, false]]) {
    const d = design(girder, o), R0 = JSON.stringify(d.R);
    const B = W.PSBReportData.compute(d.P, null); assert.equal(B.err, '');
    const html = W.PSBUiSection.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });
    assert.equal(/id="sec-void-note"/.test(html), has, girder + ': tab note');
    const M = W.PSBReportBuild.model(B), doc = W.SharedReport.build(M), T = W.SharedReport.text(doc);
    assert.equal(/Voids?: .*CTDOT BDM plate 5\.[12]\.\d[ab], PDF p\. 3\d\d/.test(T), has, girder + ': report');
    if (has) { const s2 = M.sections.find(s => s.id === 'proj'), a = s2.subs.find(s => /Assumptions/.test(s.title)), t = JSON.stringify(a.items);
      assert.ok(t.includes(`${girder}: Void`) && /\(see \[\[rs\.sec\]\]\)/.test(t), girder + ': §2 assumption with its link'); }
    assert.deepEqual(JSON.parse(JSON.stringify(doc.unresolved)), [], girder + ': links resolve');
    assert.equal(JSON.stringify(d.R), R0, girder + ': R unchanged');
  }
});

test('void note: a bridge with an I-girder span and a box span (girder types): the Report (each type on its governing line) has the box note once, its link resolved', () => {
  const P = W.PSBModel.newProject(); P.spans.lengths = [60, 60]; P.xs.skews = [0, 0, 0];
  Object.assign(P.base, { rows: [{ n: 10, y: 2, nd: 0, dbnd: 0 }], harp: { n: 0, yEnd: 8, yMid: 4, frac: 0.4 } });
  P.types = W.PSBBridge.newTypes(P); P.xs.dl = W.PSBBridgeDL.defaults(P);
  P.types.forEach(t => { if (t.span === 2) t.ovr.girder = 'AASHTO BIII-36 (39in)'; });
  assert.deepEqual(JSON.parse(JSON.stringify(W.PSBInputCheck.collect(P).errors)), []);
  const B = W.PSBReportData.compute(P, null, 'gov'); assert.equal(B.err, '');
  const M = W.PSBReportBuild.model(B, {}), doc = W.SharedReport.build(M), a = M.sections.find(s => s.id === 'proj').subs.find(s => /Assumptions/.test(s.title));
  const t = JSON.stringify(a.items);
  assert.equal((t.match(/AASHTO BIII-36 \(39in\): Void: one 23\.5 × 28\.0 in cell, y = 5\.5 to 33\.5 in above the soffit, centred/g) || []).length, 1, t.slice(0, 400));
  assert.ok(!/PCI BT-72: Void/.test(t));
  assert.deepEqual(JSON.parse(JSON.stringify(doc.unresolved)), [], 'links resolve');
});
