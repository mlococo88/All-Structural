// SBXF2 (2026-11-13; engineer decision SB-21, the engineer's request for this DXF change): apps/steel-bridge engine/sheets.js cf — the
// Drawings cross-frame (or diaphragm) sheet draws one detail per distinct bay depth, labelled with its bays; one depth (equal depths, or a
// project saved before girder types): the sheet as before (the before is the single-detail drawing of inputsOf(P, { bays: false })).
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
const withExt = dD => { const P = M.newProject(); P.girders[1].segments.forEach(s => { s.D += dD; }); return P; };
const cfText = P => { const G = W.SBDDrawings.model(J(P)), R = W.SBDSheets.build(G, null, { paper: 'D', only: ['cf'], date: '2026-11-13' }); return R.D.toDXF({ ltscale: 1 }); };
const titles = t => t.match(/(INTERMEDIATE|END) (CROSS-FRAME|DIAPHRAGM)[^\r\n]*/g) || [];

test('one bay depth: one detail, no bay label (new project, one type on every line, Exterior deeper, a project saved before types)', () => {
  const one = M.newProject(); M.setLines(one, 0, [0, 1, 2, 3, 4]);
  for (const P of [M.newProject(), one, withExt(6), M.defaultProject()]) { const T = titles(cfText(P)); assert.equal(T.length, 2, T.join(' | ')); T.forEach(t => assert.ok(!/BAYS/.test(t), t)); }
});
test('Exterior 6 in shallower: two details, G1–G2 and G4–G5 at the Exterior depth, G2–G3 and G3–G4 at the Interior depth', () => {
  const T = titles(cfText(withExt(-6)));
  assert.deepEqual(T, ['INTERMEDIATE CROSS-FRAME (TYPE X) - BAYS G1-G2, G4-G5 (DEPTH OF G1, EXTERIOR)', 'END CROSS-FRAME AT BEARINGS (ALONG 0.00 DEG. SKEW) - BAYS G1-G2, G4-G5 (DEPTH OF G1, EXTERIOR)',
    'INTERMEDIATE CROSS-FRAME (TYPE X) - BAYS G2-G3, G3-G4 (DEPTH OF G2, INTERIOR)', 'END CROSS-FRAME AT BEARINGS (ALONG 0.00 DEG. SKEW) - BAYS G2-G3, G3-G4 (DEPTH OF G2, INTERIOR)']);
  const n = t => (t.match(/WORK PT\./g) || []).length; assert.equal(n(cfText(withExt(-6))), 2 * n(cfText(M.newProject())), 'a work-point dimension in each intermediate detail');
});

// SB-23 (2026-11-13; the engineer's request for this DXF change): the Cross-frames tab graphic's Download DXF (ui/tabgraphics-b.js: engine/tabgraphics-b.js
// crossframe with opt.groups = ui/framing.js build dxfG) draws the same bay depth groups as the Drawings sheet (engine/crossframes.js bayGroups, moved
// from engine/sheets.js cfGroups); one depth: the frame on screen, byte for byte.
const FUI = W.SBDFramingUI, TX = W.SBDTabGfxB, CF = W.SBDCrossframes;
const tabDxf = (P, gi) => { const B = FUI.build({ P, g: gi }), o = { dia: CF.cfDiaOn(P.crossframes) }; return { B, t: TX.crossframe(B, P, B.dxfG ? { ...o, groups: B.dxfG } : o).D.toDXF({ ltscale: 1 }), t0: TX.crossframe(B, P, o).D.toDXF({ ltscale: 1 }) }; };
const elev = t => t.match(/CROSS-FRAME ELEVATION[^\r\n]*/g) || [], wp = t => t.match(/WORK-POINT DEPTH[^\r\n]*/g) || [];
test('tab Download DXF: one depth (new project, one type, Exterior deeper, a project saved before types): the frame on screen, unchanged', () => {
  const one = M.newProject(); M.setLines(one, 0, [0, 1, 2, 3, 4]);
  for (const P of [M.newProject(), one, withExt(6), M.defaultProject()]) for (const gi of [0, 1]) { const X = tabDxf(J(P), gi); assert.equal(X.B.dxfG, undefined); assert.equal(X.t, X.t0); assert.deepEqual(elev(X.t), ['CROSS-FRAME ELEVATION, TYPE X']); }
  const X = tabDxf(withExt(6), 1); assert.deepEqual(wp(X.t), ['WORK-POINT DEPTH h = 52.00 IN, GIRDER DEPTH d = 61.88 IN, S = 114.00 IN.'], 'Exterior deeper, Exterior reported: the bays\' depth (was its own, h = 58)');
});
test('tab Download DXF, Exterior 6 in shallower: the Drawings\' two bay depth groups, labelled the same, at their h and d', () => {
  const P = withExt(-6), lab = ['BAYS G1-G2, G4-G5 (DEPTH OF G1, EXTERIOR)', 'BAYS G2-G3, G3-G4 (DEPTH OF G2, INTERIOR)'];
  assert.deepEqual(J(CF.bayGroups(P).map(g => [g.h, g.dg, g.bays])), [[46, 55.88, [0, 3]], [52, 61.88, [1, 2]]]);
  const dw = titles(cfText(P)).filter(t => /^INTERMEDIATE/.test(t)).map(t => t.replace(/^.* - /, ''));
  assert.deepEqual(dw, lab, 'the Drawings sheet');
  for (const gi of [0, 1]) { const X = tabDxf(P, gi);
    assert.deepEqual(elev(X.t).map(t => t.replace(/^.* - /, '')), lab, 'the tab: the same groups');
    assert.deepEqual(wp(X.t), ['WORK-POINT DEPTH h = 46.00 IN, GIRDER DEPTH d = 55.88 IN, S = 114.00 IN.', 'WORK-POINT DEPTH h = 52.00 IN, GIRDER DEPTH d = 61.88 IN, S = 114.00 IN.']);
    const n = g => (X.t.match(new RegExp(`\\n${g}\\r?\\n`, 'g')) || []).length; assert.deepEqual([n('G1'), n('G2'), n('G3')], [1, 2, 1], 'each group between the girders of its first bay: G1–G2, G2–G3'); }
});
