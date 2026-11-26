// apps/ps-bridge EZN (2026-11-25, engineer "Fix NEXT stems only"; CLAUDE.md §4): the concrete tensile force of AASHTO LRFD 10th Ed.
//   5.9.2.3.1b / Table 5.9.2.3.1b-1 (and near an interior support 5.12.3.3.5) on a NEXT beam counts the two stems only below the flange
//   (engine/reltension.js chordWidth: the length of the horizontal line inside the outline), not the gap between them. Every other shape:
//   the engine's sectionWidthAt, unchanged (box beams and voided slabs: voids ignored, conservative).
//   Hand check, NEXT 36F (stems 13 in at 60 in centres, flange 8 in), bottom tension at midspan, f_top = 2.158, f_bot = -2.542 ksi:
//   b = 73 → 26 in; c = 36(2.542)/(2.542 + 2.158) = 19.474 in (in the stems); A = 26 × 19.474 = 506.32 in², ȳ = 9.737 in,
//   f = 2.542(1 − 9.737/19.474) = 1.2712 ksi; T = 643.6 kip (before 73 × 19.474 × 1.2712 = 1807.1 kip); A_s,req = T/30 = 21.45 in² (before 60.24).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...['sections', 'model', 'lldf-fg', 'deckdist', 'reltension', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)));
const SW = vm.runInContext('sectionWidthAt', W), GIRDERS = vm.runInContext('GIRDERS', W), RT = W.PSBRelTension;
const gOf = (name, f) => { const P = W.PSBModel.defaultProject(); P.base.girder = name; P.base.harp.n = 0; P.base.rows = [{ n: 10, y: 2, nd: 0, dbnd: 0 }]; P.base.opt.relBondedReinf = true; P.base.opt.relAs = 0.62; if (f) f(P);
  const inp = W.PSBDesign.inputs(P); return { inp, R: W.PSBHoldDown.compute(inp) }; };

test('EZN: NEXT width below the flange = the two stems (NEXT 36F: 2 × 13 = 26 in, the engine\'s sectionWidthAt 73 in); in the flange the flange width', () => {
  const { R } = gOf('NEXT 36F'), G = R.g;
  assert.equal(SW(G, 10), 73); assert.equal(RT.widthAt(G, 10), 26); assert.equal(RT.widthAt(G, 33), G.btf); assert.equal(RT.chordWidth(G, 10), 26);
});
test('EZN: every NEXT in the library: the width below the flange is less than the engine\'s, and about 2 stems; other shapes unchanged', () => {
  let nN = 0, nO = 0;
  for (const g of Object.keys(GIRDERS).filter(k => !/Custom/.test(k))) {
    const { R } = gOf(g), G = R.g;
    for (let i = 1; i < 60; i++) { const y = G.h * i / 60;
      if (G.isNext) { const ft = G.next.ft; if (y < G.h - ft - 3 && y > 1) { const w = RT.widthAt(G, y); assert.ok(w < SW(G, y) - 10 && w > 1.6 * G.next.B && w < 2.6 * G.next.B, `${g} y ${y}: ${w} vs ${SW(G, y)}`); nN++; } }
      else { assert.equal(RT.widthAt(G, y), SW(G, y), `${g} y ${y}`); nO++; } }
  }
  assert.ok(nN > 100 && nO > 1000, `${nN} ${nO}`);
});
test('EZN: hand check, NEXT 36F, bottom tension at midspan: c = 19.474 in, A = 506.32 in², f = 1.2712 ksi, T = 643.6 kip, A_s,req = 21.45 in² (before 1807.1 kip, 60.24 in²)', () => {
  const { R } = gOf('NEXT 36F'), rs = R.relSteel, G = R.g;
  const w = R.grid.reduce((b, r) => r.relBot < b.relBot ? r : b, R.grid[0]); assert.equal(w.x, 60);
  const p = RT.parts(G, w.relTop, w.relBot); assert.equal(p.parts.length, 1); const q = p.parts[0];
  assert.equal(p.c.toFixed(3), '19.474'); assert.equal(q.ba.toFixed(2), '26.00'); assert.equal(q.A.toFixed(2), '506.32'); assert.equal(q.dbar.toFixed(3), '9.737'); assert.equal(q.f.toFixed(4), '1.2712');
  assert.equal(rs.Tbot.toFixed(1), '643.6'); assert.equal(rs.Tbot, p.T);
  assert.equal(R.relT.strip.Tbot.toFixed(1), '1807.1', 'the engine\'s 240 strips at 73 in (kept in R.relT.strip)');
  assert.equal(rs.AsReq.toFixed(2), '21.45'); assert.equal(rs.where, 'bottom (midspan)');
  const E = W.PSBWorkedEnd.endzone(gOf('NEXT 36F').inp, R), s = E.steps.find(x => x.id === 'ez.rel.Tbot.p1');
  assert.match(s.label, /stems \(the two stems; the gap between them not counted\)/); assert.ok(!E.steps.some(x => /outer stem faces/.test(x.label)));
});
test('EZN: a box beam, a voided slab and an I-girder: T unchanged by EZN (the exact sum on the engine\'s width)', () => {
  let n = 0;
  for (const g of ['AASHTO BI-36 (27in)', 'Deck slab 21×48 (voided)', 'MassDOT S36-15', 'PCI BT-72', 'MassDOT NEDBT 48']) {
    const { R } = gOf(g); if (R.error) continue; n++; const rs = R.relSteel, G = R.g, grid = R.grid;
    const wT = grid.reduce((b, r) => r.relTop < b.relTop ? r : b, grid[0]), wB = grid.reduce((b, r) => r.relBot < b.relBot ? r : b, grid[0]);
    const ex = (fT, fB) => { const n = 100000; let T = 0; for (let i = 0; i < n; i++) { const y = (i + 0.5) * G.h / n, f = fB + (fT - fB) * y / G.h; if (f < 0) T += -f * SW(G, y) * G.h / n; } return T; };
    assert.ok(Math.abs(rs.Ttop - ex(wT.relTop, wT.relBot)) < 2e-3 + 1e-5 * rs.Ttop, g + ' top'); assert.ok(Math.abs(rs.Tbot - ex(wB.relTop, wB.relBot)) < 2e-3 + 1e-5 * rs.Tbot, g + ' bottom');
  }
  assert.ok(n >= 4, 'designs ' + n);
});
test('EZN: NEXT 36F with A_s,prov = 25 in²: the release-tension steel check NG → OK (60.24 > 25 before; 21.45 ≤ 25 after)', () => {
  const { R } = gOf('NEXT 36F', P => { P.base.opt.relAs = 25; }), c = R.checks.find(q => q.n === 'Release tens. steel (5.9.2.3.1b)');
  assert.equal(c.pass, true); assert.equal(c.r.toFixed(3), (21.45438733551851 / 25).toFixed(3)); assert.ok(R.relT.strip.Tbot / 30 / 25 > 1, 'NG with the engine\'s strips');
});
