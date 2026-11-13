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
