// FOB (2026-11-24, engineer: "a fence or railing on top of the concrete barrier … the renderings … show it as basically embedded in the
// concrete"): apps/ps-bridge, a sidewalk railing or fence over the deck-edge barrier or curb stands on its top, in the cross-section figure
// (ui/xsfig.js, also the typical-section DXF of ui/sheets.js) and the 3D view (ui/view3d.js geom), both through PSB3DUI.edgeTop (the
// schematic barrier outline BAR_PROF, b_w × BAR_H 32 in, flat top over 0.45 b_w). Elsewhere on the sidewalk slab as before. Display only.
// Hand checks (sidewalk 6 ft × 8 in, barrier b_w = 1.5 ft = 18 in on it, flat top over 0.45 × 18 = 8.1 in):
//   fence 0.5 ft = 6 in: flat top, 8 + 32 = 40 in above the deck top (before: 8 in, the sidewalk top)
//   fence 1.2 ft = 14.4 in: u/b_w = 0.8 on the face (0.75, 0.25)-(1, 0): g = 0.25 × (1 − 0.8)/0.25 = 0.20, 8 + 0.20 × 32 = 14.4 in (before 8)
//   curb 12 × 10 in on the 8 in sidewalk, fence 0.4 ft: 8 + 10 = 18 in (before 8); fence 3 ft (beyond the curb): 8 in (as before)
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'barrier.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d', 'xsfig'].map(n => path.join(APP, `ui/${n}.js`)));
W.PSBSections.install();
const J = v => JSON.parse(JSON.stringify(v));
function project() {
  const P = W.PSBModel.defaultProject(); Object.assign(P.spans, { lengths: [100], continuity: 'simple' });
  Object.assign(P.xs, { bays: [8, 8, 8], nb: 4, skews: [0, 0], ohL: 3, ohR: 3 });
  P.types = W.PSBBridge.newTypes(P); P.design = { g: 2, s: 1 }; P.xs.dl = W.PSBBridgeDL.defaults(P); P.xs.dl.barL.bw = 1.5; P.xs.dl.barR.bw = 1.5; return P;
}
const fig = (P, k, sd) => W.PSBXsFig.model(P, 1).app.find(a => a.kind === k && a.side === sd);
const g3 = (P, k, sd) => W.PSB3DUI.geom(P).app.find(a => a.kind === k && a.side === sd);
const near = (a, b, m) => assert.ok(Math.abs(a - b) < 1e-9, `${m}: ${a} vs ${b}`);

test('edgeTop: the schematic barrier top (flat 0.45 b_w, sloped face), a curb top, null off them', () => {
  const P = project(); P.xs.dl.swL = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 };
  near(W.PSB3DUI.edgeTop(P, 'L', 6), 40, 'flat top'); near(W.PSB3DUI.edgeTop(P, 'L', 14.4), 8 + 0.2 * 32, 'sloped face'); near(W.PSB3DUI.edgeTop(P, 'L', 18), 8, 'toe');
  assert.equal(W.PSB3DUI.edgeTop(P, 'L', 20), null); assert.equal(W.PSB3DUI.edgeTop(P, 'R', 6), 32, 'no sidewalk on the right: the barrier on the deck');
  P.xs.dl.barL = { ...P.xs.dl.barL, type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 0.5 }; near(W.PSB3DUI.edgeTop(P, 'L', 4.8), 18, 'curb top'); assert.equal(W.PSB3DUI.edgeTop(P, 'L', 13), null);
});

test('figure and 3D: the sidewalk fence on the barrier or curb top; elsewhere on the sidewalk as before', () => {
  const P = project(); P.xs.dl.swL = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; P.xs.dl.swR = { w: 6, t: 8, fence: 0.05, fenceX: 1.2 };
  const m = W.PSBXsFig.model(P, 1), yT = m.yTop;
  near(fig(P, 'fence', 'L').y0 - yT, 40, 'figure L'); near(fig(P, 'fence', 'R').y0 - yT, 14.4, 'figure R'); near(fig(P, 'fence', 'L').y1 - fig(P, 'fence', 'L').y0, 42, 'post height');
  const G = W.PSB3DUI.geom(P); near(g3(P, 'fence', 'L').y0 - G.deck.yTop, 40, '3D L'); near(g3(P, 'fence', 'R').y0 - G.deck.yTop, 14.4, '3D R');
  const Q = J(P); Q.xs.dl.swL.fenceX = 3; near(fig(Q, 'fence', 'L').y0 - yT, 8, 'beyond the barrier: the sidewalk top'); near(g3(Q, 'fence', 'L').y0 - G.deck.yTop, 8, '3D beyond');
  const C = J(P); C.xs.dl.barL = { ...C.xs.dl.barL, type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 0.5 }; C.xs.dl.swL.fenceX = 0.4;
  near(fig(C, 'fence', 'L').y0 - yT, 18, 'curb: figure'); near(g3(C, 'fence', 'L').y0 - G.deck.yTop, 18, 'curb: 3D');
  near(fig(C, 'rail', 'L').y0 - yT, 18, 'curb railing on the curb (as before)');
});


// GEOM (2026-11-24, engineer: Geometry-mode barriers drawn with their actual profile): left rectangle 12 × 42 in, right polygon (0,0) (16,0)
// (16,3) (9,10) (7,36) (0,36) in, sidewalks 6 ft × 8 in; fences at 0.5 ft (6 in: 8 + 42 = 50 in) and 0.25 ft (3 in: 8 + 36 = 44 in).
test('Geometry-mode barriers: the figure, the DXF and the 3D view take their outline; the fence on its top; entered as before', () => {
  const P = project(), dl = P.xs.dl; Object.assign(dl.barL, { bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 } });
  Object.assign(dl.barR, { bMode: 'geom', bShape: 'poly', bPts: [[0, 0], [16, 0], [16, 3], [9, 10], [7, 36], [0, 36]] });
  dl.swL = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; dl.swR = { w: 6, t: 8, fence: 0.05, fenceX: 0.25 };
  const m = W.PSBXsFig.model(P, 1), bL = fig(P, 'bar', 'L'), bR = fig(P, 'bar', 'R');
  assert.ok(bL.geo && bR.geo); near(bL.y1 - bL.y0, 42, 'L height'); near(bR.y1 - bR.y0, 36, 'R height'); near(bR.bw, 16, 'R width at the deck');
  assert.deepEqual(J(bL.poly), [[0, m.yTop + 8], [12, m.yTop + 8], [12, m.yTop + 50], [0, m.yTop + 50]]);
  near(bR.poly[2][0], m.Wd - 16, 'R polygon mirrored from the right edge');
  near(fig(P, 'fence', 'L').y0 - m.yTop, 50, 'figure L fence'); near(fig(P, 'fence', 'R').y0 - m.yTop, 44, 'figure R fence');
  const G = W.PSB3DUI.geom(P), gL = g3(P, 'bar', 'L'); assert.ok(gL.geo && gL.pts.length === 4); near(gL.h, 42, '3D height');
  near(g3(P, 'fence', 'L').y0 - G.deck.yTop, 50, '3D L fence'); near(g3(P, 'fence', 'R').y0 - G.deck.yTop, 44, '3D R fence');
  const E = project(); E.xs.dl.swL = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; const bE = fig(E, 'bar', 'L'); assert.ok(!bE.geo && !bE.poly); near(bE.y1 - bE.y0, 32, 'entered: schematic height');
});
