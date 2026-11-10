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
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
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
  // RECORD_DXF=1 records every sheet; RECORD_DXF=<ids> (comma-separated sheet ids, e.g. "sec" for SBXS, "plan,erect" for SBFLIP) only those sheets
  if (process.env.RECORD_DXF) { const ids = process.env.RECORD_DXF === '1' ? null : process.env.RECORD_DXF.split(','), keep = ids ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
    const out = keep ? Object.fromEntries(Object.entries(keep).map(([k, v]) => [k, ids.includes(k.split('|').pop()) ? got[k] : v])) : got;
    fs.writeFileSync(BASE, JSON.stringify(out, null, 0).replace(/,"/g, ',\n"') + '\n'); console.log(`       recorded ${n} sheet hashes${keep ? ` (the "${ids.join('", "')}" sheets only)` : ''} in ${path.relative(ROOT, BASE)}`); return; }
  const want = JSON.parse(fs.readFileSync(BASE, 'utf8')), diff = Object.keys(want).filter(k => want[k] !== got[k]), miss = Object.keys(want).filter(k => !(k in got));
  assert.deepEqual(miss, [], 'sheets not built'); assert.deepEqual(diff, [], 'DXF changed');
  console.log(`       ${n / 2} sheets identical to the baseline (${Object.keys(want).filter(k => /\|sec$/.test(k)).length} typical-section sheets re-recorded for SBXS, ${Object.keys(want).filter(k => /\|(plan|erect)$/.test(k)).length} framing-plan and erection sheets for SBFLIP; every plot scale unchanged)`);
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

// SBFLIP (2026-11-10, engineer): the framing plan (DW.plan, the "FRAMING PLAN" sheet) and the erection diagram ("ERECTION DIAGRAM AND
// GIRDER LAYOUT") are drawn with G1 at the top and G_nb at the bottom, stations to the right, as the screen plan, 3D view and section.
// Checks, on the sheets as built (any offset): G1's centerline above G_nb's, every girder below the one before it, the girder tags in the
// same order; each support line's angle from the normal to the girders = the entered skew, + with the G_nb (lower) end ahead-station; the
// support labels above G1, the skew labels below G_nb; text not mirrored (rotation 0, positive height). Hand check (built-in, 30°): G1
// to G5 = 4 × 9.5 = 38 ft = 456 in apart; each support line Δx = 456 tan 30° = 263.27 in ahead at G5, angle atan(263.27 / 456) = 30.00°.
test('SBFLIP: plan and erection sheets have G1 at the top; support lines at the entered skew with the G_nb end ahead for + skew', () => {
  const cases = [...projects()];
  for (const sk of [0, 30, -30, 45]) { const P = J(M.defaultProject()); P.xs.skews = P.xs.skews.map(() => sk); P.framing = { ...M.defaultFraming(), splices: [82, 278] }; cases.push([`built-in ${sk}°`, P]); }
  { const P = J(M.defaultProject()); P.xs.skews = [10, -20, 30, 0]; cases.push(['built-in 10/-20/30/0°', P]); }
  let nL = 0; const hand = [];
  for (const [name, P] of cases) {
    const G = DW.model(P); assert.equal(G.errors.length, 0, name + ': ' + G.errors.join(' '));
    const B = SH.build(G, null, { paper: 'D', only: ['plan', 'erect'], date: '2026-11-10' }), nb = G.nb, wIn = (G.ys[nb - 1] - G.ys[0]) * 12;
    for (const s of B.sheets) {
      const E = B.D.E.slice(s.i0, s.iC), L = E.filter(e => e.t === 'LINE'), T = E.filter(e => e.t === 'TEXT');
      T.forEach(e => assert.ok(!e.rot && e.hh > 0, `${name} ${s.id}: text "${e.s}" mirrored or rotated`));
      const gl = L.filter(e => e.l === 'S-GRDR-CNTR'); assert.equal(gl.length, nb, `${name} ${s.id}: girder lines`);
      const gy = gl.map(e => e.pts[0][1]);   // drawn in girder order G1..G_nb
      gy.slice(1).forEach((y, i) => close(gy[i] - y, (G.ys[i + 1] - G.ys[i]) * 12, 1e-6, `${name} ${s.id}: G${i + 1} above G${i + 2}`));
      assert.ok(gy[0] > gy[nb - 1] || nb === 1, `${name} ${s.id}: G1 y ${gy[0]} above G${nb} y ${gy[nb - 1]}`);
      const yT = gy[0], yB = gy[nb - 1];
      if (s.id === 'plan') { const tg = G.girders.map(g => T.find(e => e.s === g.label).pts[0][1]); tg.slice(1).forEach((y, i) => assert.ok(y < tg[i], `${name}: tag G${i + 2} below G${i + 1}`));
        T.filter(e => /^CL (BRG\.|PIER)/.test(e.s)).forEach(e => assert.ok(e.pts[0][1] > yT, `${name}: "${e.s}" above G1`));
        T.filter(e => /^SKEW /.test(e.s)).forEach(e => assert.ok(e.pts[0][1] < yB, `${name}: "${e.s}" below G${nb}`)); }
      // support lines: the bearing-layer lines that run past both G1 and G_nb
      const sl = L.filter(e => e.l === 'S-BRNG-CNTR' && Math.max(e.pts[0][1], e.pts[1][1]) > yT && Math.min(e.pts[0][1], e.pts[1][1]) < yB);
      assert.equal(sl.length, G.sup.length, `${name} ${s.id}: support lines`);
      sl.sort((a, b) => (a.pts[0][0] + a.pts[1][0]) - (b.pts[0][0] + b.pts[1][0])).forEach((e, k) => {
        const [p, q] = e.pts[0][1] > e.pts[1][1] ? e.pts : [e.pts[1], e.pts[0]];   // p the upper (G1) end, q the lower (G_nb) end
        const ang = Math.atan2(q[0] - p[0], p[1] - q[1]) * 180 / Math.PI; close(ang, G.skews[k], 1e-6, `${name} ${s.id}: support ${k + 1} angle`); nL++;
        if (name === 'built-in 30°' && s.id === 'plan' && k === 0) hand.push(wIn, wIn * Math.tan(Math.PI / 6), ang); });
    }
  }
  close(hand[0], 456, 1e-9, 'G1-G5'); close(hand[1], 263.2717, 1e-4, 'Δx'); close(hand[2], 30, 1e-9, 'angle');
  console.log(`       ${cases.length} projects, plan and erection sheets: G1 on top, ${nL} support lines at their skew (G_nb end ahead for +)`);
});
