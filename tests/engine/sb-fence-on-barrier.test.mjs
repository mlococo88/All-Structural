// FOB (2026-11-24, engineer: "a fence or railing on top of the concrete barrier … the renderings … show it as basically embedded in the
// concrete"): apps/steel-bridge/engine/drawings.js appOf, the base y0 of a railing or fence drawn over a barrier or a curb is the top of
// that barrier (the schematic outline SBDDrawings.BAR_SCH, w × 34 in) or curb; elsewhere the deck / sidewalk surface as before. Display
// only: the loads (every line load's id, x, w and category) are the same with and without a fence position on the barrier.
// Hand checks (sidewalk 8 in, barrier w = 1.5 ft = 18 in, flat top over 0.42 × 18 = 7.56 in):
//   fence 0.5 ft = 6 in from the edge: on the flat top, y0 = 8 + 34 = 42 in (before: 8 in, the sidewalk top)
//   fence 1.2 ft = 14.4 in, right sidewalk 10 in: u/w = 0.8, on the face (0.62, 0.30)-(1, 0.12): g = 0.30 − 0.18 × 0.18/0.38 = 0.21474,
//     y0 = 10 + 0.21474 × 34 = 17.301 in (before: 10 in)
//   curb 12 x 10 in on an 8 in sidewalk, fence 0.4 ft: y0 = 8 + 10 = 18 in (before: 8 in); fence 3 ft (beyond the curb): 8 in (as before)
//   curb railing at 0.5 ft (on the curb): 18 in (as before)
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'dxf.js', 'barrier.js', ENG('model.js'), ENG('owners.js'), ENG('sections.js'), ENG('lldf.js'), ENG('loads.js'), ENG('shear.js'),
  ENG('stiffeners.js'), ENG('flexure.js'), ENG('framing.js'), ENG('crossframes.js'), ENG('drawings.js'));
const M = W.SBDModel, DW = W.SBDDrawings, LD = W.SBDLoads, J = o => JSON.parse(JSON.stringify(o));
const base = () => J(M.defaultProject());
const items = P => DW.model(P).app.items;
const at = (P, k, sd) => items(P).find(a => a.k === k && a.sd === sd);
const loads = P => { const q = LD.fromModel(P, { girder: 0 }), R = LD.compute(q.b, q.p); assert.deepEqual(J(R.errors), []); return J(R.dead.per.map(L => [L.id, L.x, L.plf, L.cat])); };

test('topOf: the schematic outline (flat top 0.42 w, sloped face, toe 0.12 h); outside the outline null', () => {
  const o = DW.BAR_SCH.map(([f, g]) => [f * 18, g * 34]);
  assert.equal(DW.topOf(o, 0), 34); assert.equal(DW.topOf(o, 6), 34); assert.ok(Math.abs(DW.topOf(o, 14.4) - 0.2147368421 * 34) < 1e-9);
  assert.ok(Math.abs(DW.topOf(o, 18) - 0.12 * 34) < 1e-9); assert.equal(DW.topOf(o, 18.5), null); assert.equal(DW.topOf(o, -0.5), null);
});

test('barrier edges: a sidewalk fence over the barrier stands on its top; loads unchanged', () => {
  const P = base(); P.xs.sidewalks.L = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; P.xs.sidewalks.R = { w: 5, t: 10, fence: 0.04, fenceX: 1.2 }; P.xs.sidewalks.ped = 75;
  assert.equal(at(P, 'fence', 'L').y0, 42); assert.ok(Math.abs(at(P, 'fence', 'R').y0 - 17.30105263) < 1e-6, at(P, 'fence', 'R').y0);
  assert.equal(at(P, 'bar', 'L').y0, 8); assert.equal(at(P, 'bar', 'L').h, 34);
  const Q = J(P); Q.xs.sidewalks.L.fenceX = 3; Q.xs.sidewalks.R.fenceX = 3;   // beyond the barrier: the sidewalk top, as before
  assert.equal(at(Q, 'fence', 'L').y0, 8); assert.equal(at(Q, 'fence', 'R').y0, 10);
  // the fence position does not move any load other than the fence itself (its x is the entered one either way)
  const a = loads(P), b = loads(Q); assert.deepEqual(a.filter(r => !/^fence/.test(r[0])), b.filter(r => !/^fence/.test(r[0])));
});

test('curb edges: a sidewalk fence over the curb on its top; the curb railing on the curb as before', () => {
  const P = base(); ['L', 'R'].forEach(s => { P.xs.edges[s] = { ...P.xs.edges[s], type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 0.5 }; });
  P.xs.sidewalks.L = { w: 6, t: 8, fence: 0.05, fenceX: 0.4 }; P.xs.sidewalks.R = { w: 6, t: 8, fence: 0.05, fenceX: 3 }; P.xs.sidewalks.ped = 75;
  assert.equal(at(P, 'fence', 'L').y0, 18); assert.equal(at(P, 'fence', 'R').y0, 8);
  assert.equal(at(P, 'rail', 'L').y0, 18); assert.equal(at(P, 'rail', 'R').y0, 18);
  const Q = J(P); Q.xs.edges.L.rp = 2; assert.equal(at(Q, 'rail', 'L').y0, 8);   // a railing beyond the curb: the sidewalk top
});

test('the built-in project (no fence) has the same appurtenance items as before FOB', () => {
  assert.deepEqual(J(items(base()).map(a => [a.k, a.sd, a.x0, a.x1, a.y0, a.h])), [['bar', 'L', 0, 1.5, 0, 34], ['bar', 'R', 43, 44.5, 0, 34], ['ws', null, 1.5, 43, 0, 0]]);
});

// GEOM (2026-11-24, engineer: draw a Geometry-mode barrier with its actual profile in every renderer): the barrier item carries its outline
// (shared/barrier.js G.pts) and height; the fence stands on that outline's top. Hand checks: left rectangle 12 × 42 in on an 8 in sidewalk,
// fence at 0.5 ft = 6 in: 8 + 42 = 50 in; right polygon (0,0) (16,0) (16,3) (9,10) (7,36) (0,36), fence at 0.25 ft = 3 in (top 0..7 in at
// 36 in): 8 + 36 = 44 in; at 0.7 ft = 8.4 in, on the face (9,10)-(7,36): y = 10 + 26 × (9 − 8.4)/2 = 17.8 in, 8 + 17.8 = 25.8 in.
test('Geometry-mode barriers: drawn with their own outline; the fence on its top; an entered barrier as before', () => {
  const P = base(); P.xs.edges.L = { ...P.xs.edges.L, bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 } };
  P.xs.edges.R = { ...P.xs.edges.R, bMode: 'geom', bShape: 'poly', bPts: [[0, 0], [16, 0], [16, 3], [9, 10], [7, 36], [0, 36]] };
  P.xs.sidewalks.L = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; P.xs.sidewalks.R = { w: 6, t: 8, fence: 0.05, fenceX: 0.25 }; P.xs.sidewalks.ped = 75;
  const bL = at(P, 'bar', 'L'), bR = at(P, 'bar', 'R');
  assert.ok(bL.geo && bR.geo && !bL.sch); assert.equal(bL.h, 42); assert.equal(bR.h, 36);
  assert.deepEqual(J(bL.pts), [[0, 0], [12, 0], [12, 42], [0, 42]]); assert.deepEqual(J(DW.barPts(bR))[2], [44.5 - 16 / 12, 8 + 3]);
  assert.equal(at(P, 'fence', 'L').y0, 50); assert.equal(at(P, 'fence', 'R').y0, 44);
  const Q = J(P); Q.xs.sidewalks.R.fenceX = 0.7; assert.ok(Math.abs(at(Q, 'fence', 'R').y0 - 25.8) < 1e-9, at(Q, 'fence', 'R').y0);
  const E = base(); E.xs.sidewalks.L = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; const bE = at(E, 'bar', 'L'); assert.ok(bE.sch && !bE.geo && !bE.pts && bE.h === 34);
  // the DXF section draws the outline on S-DECK-BARR
  const D = W.SharedDxf.drawing({ prefix: 'S-' }); DW.section(DW.model(P), D); const pl = D.E.filter(e => e.t === 'PL' && D.L[e.l] && /DECK-BARR/.test(D.L[e.l].name || e.l));
  assert.ok(pl.length >= 2, 'barrier outlines'); assert.ok(pl.some(e => e.pts.length === 6) && pl.some(e => e.pts.length === 4), 'the polygon (6 points) and the rectangle (4 points)');
});
