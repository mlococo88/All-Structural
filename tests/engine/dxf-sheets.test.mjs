// SBXS (2026-11-10, engineer: "the cross section graphic dimension lines are overlapping a lot"): the typical cross-section drawing
// (engine/drawings.js section + appDraw, the sheet "TYPICAL SECTION AND NOTES" of engine/sheets.js, also the Summary tab's figure) was
// laid out again. The engineer asked for this drawing to be fixed, so its DXF changes (an engineer-requested exception to "do not change
// the DXF"); every other sheet of the drawing set must stay byte-identical.
// 1. Every sheet of the set (paper D and B; built-in project, built-in with a field splice, an 11-girder bridge with a sidewalk and fence
//    on a 30° skew, two hand-off payloads), each written as its own DXF (its entities, the set's layer, linetype and dimension style
//    tables), against tests/baselines/dxf-sheets.json (SHA-256, recorded on origin/main before the change: RECORD_DXF=1 node
//    tests/engine/run.mjs dxf-sheets). Only the "sec" entries were re-recorded after the change; each sheet's plot scale is in the key
//    list too (the section sheet kept its scale, so the sheets after it did not move).
// 2. No text of the cross-section drawing overlaps another text, and no line (extension line, dimension line, leader, outline) crosses a
//    text, other than the lines of the text's own dimension: the sheet and the Summary figure, built-in and 11-girder projects (text boxes
//    as tests/engine/overlap.mjs).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { test, ROOT } from './harness.mjs';
import { load } from './gfx-fixture.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const W = load(), M = W.SBDModel, DW = W.SBDDrawings, SH = W.SBDSheets, X = W.SharedDxf, J = o => JSON.parse(JSON.stringify(o));
const BASE = path.join(ROOT, 'tests/baselines/dxf-sheets.json');
const sha = t => crypto.createHash('sha256').update(t).digest('hex').slice(0, 24);

export function p11() {   // 11 girders at 4 ft, 4'-1 1/2" overhangs (48'-3" deck), a 6 ft left sidewalk with a fence 5'-6" from the deck edge, 30° skew
  const P = J(M.defaultProject()); Object.assign(P.xs, { nb: 11, bays: new Array(10).fill(4), ohL: 4.125, ohR: 4.125, skews: P.xs.skews.map(() => 30) });
  P.xs.sidewalks.L = { w: 6, t: 8, fence: 0.05, fenceX: 5.5 }; return P;
}
export function projects() {
  const P0 = J(M.defaultProject()), P1 = J(P0); P1.framing = { ...M.defaultFraming(), splices: [82] };
  const out = [['built-in', P0], ['built-in splice', P1], ['11 girders', p11()]];
  [['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }], ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]].forEach(([f, o]) => {
    const pl = readPayload(f), P = projectFromPayload(pl); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes(); P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    out.push([f, P]); });
  return out;
}
// one sheet as its own DXF: its entities with the set's tables
function sheetDxf(D, s) { const D2 = X.drawing({ prefix: 'S-' }); D2.E = D.E.slice(s.i0, s.i1); D2.L = D.L; D2.lt = D.lt; D2.ds = D.ds; return D2.toDXF({ ltscale: 1 }); }

test('SBXS: every sheet other than the typical section is byte-identical to origin/main (SHA-256 of each sheet as its own DXF)', () => {
  const got = {};
  for (const [name, P] of projects()) for (const paper of ['D', 'B']) {
    const G = DW.model(P); assert.equal(G.errors.length, 0, name + ': ' + G.errors.join(' '));
    const B = SH.build(G, null, { paper, date: '2026-11-10' });
    B.sheets.forEach(s => { got[`${name}|${paper}|${s.id}`] = sha(sheetDxf(B.D, s)); got[`${name}|${paper}|${s.id}|k`] = String(s.k); });
  }
  const n = Object.keys(got).length; assert.ok(n > 100, 'cases ' + n);
  if (process.env.RECORD_DXF) { const keep = process.env.RECORD_DXF === 'sec' ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
    const out = keep ? Object.fromEntries(Object.entries(keep).map(([k, v]) => [k, /\|sec$/.test(k) ? got[k] : v])) : got;
    fs.writeFileSync(BASE, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n'); console.log(`       recorded ${n} sheet hashes${keep ? ' (the "sec" sheets only)' : ''} in ${path.relative(ROOT, BASE)}`); return; }
  const want = JSON.parse(fs.readFileSync(BASE, 'utf8')), diff = Object.keys(want).filter(k => want[k] !== got[k]), miss = Object.keys(want).filter(k => !(k in got));
  assert.deepEqual(miss, [], 'sheets not built'); assert.deepEqual(diff, [], 'DXF changed');
  console.log(`       ${n / 2} sheets identical to the baseline (${Object.keys(want).filter(k => /\|sec$/.test(k)).length} typical-section sheets re-recorded for SBXS; every plot scale unchanged)`);
});

import { textOverlaps, textLineHits, describe, describeHit } from './overlap.mjs';
// the 11-girder bridge on shallow girders (the engineer's drawing: girder 1'-4", haunch 2", bottom flange 16 x 1 1/2)
function p11s() { const P = p11(); P.girders.forEach(g => g.segments.forEach(s => Object.assign(s, { D: 13, tw: 0.5, topB: 12, topT: 1.5, botB: 16, botT: 1.5 }))); return P; }
test('SBXS: the typical cross-section has no text over another text and no line through a text (sheet and Summary figure)', () => {
  let n = 0; const bad = [];
  for (const [name, P] of [...projects(), ['11 girders, shallow', p11s()]]) {
    const G = DW.model(P); assert.equal(G.errors.length, 0, name);
    const B = SH.build(G, null, { paper: 'D', only: ['sec'], date: '2026-11-10' }), s = B.sheets[0], Ds = { ...B.D, E: B.D.E.slice(s.i0, s.iC) };   // the drawing, notes and tables (not the title block)
    const wIn = (G.ys[G.nb - 1] + G.deck.ohL + G.deck.ohR) * 12, Dm = X.drawing({ prefix: 'S-' }); DW.section(G, Dm, { k: DW.scaleFor(wIn * 1.3, 10) });   // as ui/summary.js xsSvg
    for (const [w, D] of [[`sheet 1:${s.k}`, Ds], [`Summary 1:${Dm.k}`, Dm]]) {
      const t = textOverlaps(D, X), l = textLineHits(D, X); n++;
      t.forEach(o => bad.push(`${name}, ${w}: text over text ${describe(o)}`)); l.forEach(o => bad.push(`${name}, ${w}: ${describeHit(o)}`));
    }
  }
  assert.deepEqual(bad, [], bad.slice(0, 20).join('\n'));
  console.log(`       ${n} drawings (6 projects, sheet and Summary scale): no text overlaps, no line through a text`);
});
