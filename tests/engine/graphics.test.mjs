// apps/steel-bridge/ui/graphics.js (window.SBDGraphics): the helper for the output-tab graphics in the Drawings-tab format.
// Display only: nothing here computes a result. Checks, on the built-in project and 5 hand-off payloads (as drawings.test.mjs):
//  1. elevation(): entities built, every coordinate finite, the expected layers, supports / plate breaks / cross-frames / splices on
//     the model's stations (X = station x 12 in), the stations axis, the file validates as DXF R12;
//  2. ratioLayer(): colours follow the ratio (green < 0.8, amber 0.8 to 1.0, red > 1.0 or NG), one band per location, a legend;
//  3. chart(): axes, grid on its own layer, series, limit line, bars; mapping X / Y / pick are inverses;
//  4. hand check on the built-in project (arithmetic in the comments).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f), UI = f => path.join(ROOT, 'apps/steel-bridge/ui', f);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'dxf.js', ENG('model.js'), ENG('owners.js'), ENG('sections.js'), ENG('lldf.js'), ENG('loads.js'), ENG('shear.js'), ENG('stiffeners.js'),
  ENG('flexure.js'), ENG('framing.js'), ENG('crossframes.js'), ENG('drawings.js'), UI('graphics.js'));
const X = W.SharedDxf, GR = W.SBDGraphics, M = W.SBDModel;
const J = o => JSON.parse(JSON.stringify(o));

/* every number of every entity finite; returns the layer names used */
export function checkFinite(D, what) {
  const used = new Set();
  D.E.forEach((e, i) => { used.add(e.l); e.pts.forEach(p => p.forEach(v => assert.ok(Number.isFinite(v), `${what}: entity ${i} (${e.t} ${e.l}) has a non-finite coordinate`)));
    if (e.t === 'TEXT') { assert.ok(Number.isFinite(e.hh) && e.hh > 0, `${what}: text height`); assert.ok(!/NaN|undefined|Infinity/.test(e.s), `${what}: text "${e.s}"`); }
    if (e.t === 'CIRCLE' || e.t === 'ARC') assert.ok(Number.isFinite(e.r)); });
  return used;
}
const dxfOk = (D, what) => { const v = X.validate(D.toDXF({ ltscale: 1 })); assert.ok(v.ok, `${what}: ${v.errors.join('; ')}`); };

function checkElev(P, name) {
  const gi = 0, E = GR.elevation(P, gi); assert.deepEqual(J(E.errors), [], name);
  const used = checkFinite(E.D, name);
  ['S-GRDR-PLAT', 'S-GRDR', 'S-BRNG', 'S-DIMS', 'S-ANNO-TEXT', 'S-AXIS', 'S-GRID'].forEach(l => assert.ok(used.has(l), `${name}: layer ${l}`));
  const sup = E.G.sup, segs = P.girders[gi].segments;
  // supports: one triangle per support at x = station x 12
  const br = E.D.E.filter(e => e.l === 'S-BRNG').map(e => e.pts[0][0]); assert.equal(br.length, sup.length);
  sup.forEach((s, k) => assert.ok(Math.abs(br[k] - s * 12) < 1e-9, `${name}: support ${k}`));
  // plate breaks: the plate rectangles end on the segment stations
  const pl = E.D.E.filter(e => e.l === 'S-GRDR-PLAT' && e.t === 'PL' && e.closed), top = pl.filter(e => e.pts[0][1] > 0 || e.pts[2][1] > 0 && e.pts[0][1] >= 0).sort((a, b) => a.pts[0][0] - b.pts[0][0]);
  assert.equal(top.length, segs.length * 1 + 0, `${name}: top plates`);
  segs.forEach((s, k) => { assert.ok(Math.abs(top[k].pts[0][0] - s.x0 * 12) < 1e-9 && Math.abs(top[k].pts[1][0] - s.x1 * 12) < 1e-9, `${name}: plate ${k}`); });
  assert.equal(E.stations.plates.length, segs.length - 1);
  // cross-frames: one line per station on the CF layer (ft x 12)
  const cf = E.D.E.filter(e => e.l === 'S-XFRM' && e.t === 'LINE'); assert.equal(cf.length, E.stations.cf.length); assert.ok(cf.length > 0, `${name}: cross-frames`);
  // splices
  assert.equal(E.D.E.filter(e => e.l === 'S-SPLC' && e.t === 'LINE').length, E.stations.splices.length);
  // pick: x = 12 ft
  assert.equal(E.pick(12 * 12, 0), Math.max(E.L0, 12)); assert.equal(E.pick(-5, 0), E.L0);
  dxfOk(E.D, name); return E;
}
test('graphics: elevation of the built-in project and 5 payloads', () => {
  checkElev(J(M.defaultProject()), 'built-in');
  const PAY = [['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }], ['gd_builtin_CTDOT_G3.json', { nb: 4, bays: [10, 10.5, 10], skews: [0, 0, 0, 0], spl: [90, 270] }],
    ['gd_curb_MassDOT_G2.json', { nb: 6, bays: [8, 8, 8.5, 8, 8], skews: [15, 15, 15, 15], spl: [] }], ['gd_util_RIDOT_G4.json', { nb: 7, bays: [7.5, 7.5, 7.5, 7.5, 7.5, 7.5], skews: [35, 35, 35, 35], spl: [85, 275] }],
    ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]];
  for (const [f, o] of PAY) { const P = projectFromPayload(readPayload(f)); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes(); checkElev(P, f); }
});

test('graphics: ratio colours (green < 0.8, amber 0.8 to 1.0, red > 1.0 or NG) and the layer, legend and bands', () => {
  assert.equal(GR.ratioColor(0.79), 3); assert.equal(GR.ratioColor(0.8), 2); assert.equal(GR.ratioColor(1.0), 2); assert.equal(GR.ratioColor(1.0001), 1);
  assert.equal(GR.ratioColor(0.2, false), 1); assert.equal(GR.ratioColor(NaN), 1);
  const P = J(M.defaultProject()), E = GR.elevation(P, 0), n0 = E.D.E.length;
  const items = [{ x: 0, ratio: 0.5 }, { x: 55, ratio: 0.85 }, { x: 110, ratio: 1.2 }, { x: 180, ratio: 0.3, ok: false }, { x: 250, ratio: 0.99 }, { x: 360, ratio: 0.1 }];
  const R = GR.ratioLayer(E, items, { what: 'FLEXURE' }); assert.equal(R.cols.length, 6); assert.deepEqual(J(R.cols.map(c => c.color)), [3, 2, 1, 1, 2, 3]);
  assert.ok(E.D.E.length > n0); const used = checkFinite(E.D, 'ratio'); ['S-RATIO-OK', 'S-RATIO-WARN', 'S-RATIO-NG'].forEach(l => assert.ok(used.has(l), l));
  assert.equal(E.D.L['S-RATIO-OK'].color, 3); assert.equal(E.D.L['S-RATIO-WARN'].color, 2); assert.equal(E.D.L['S-RATIO-NG'].color, 1);
  // bands tile the girder: from L0 to L1 with the mid-points between locations
  assert.equal(R.cols[0].x0, E.L0); assert.equal(R.cols[5].x1, E.L1); assert.equal(R.cols[1].x1, (55 + 110) / 2); assert.equal(R.cols[2].x0, (55 + 110) / 2);
  assert.ok(E.D.E.some(e => e.t === 'TEXT' && e.s === 'NG') && E.D.E.some(e => e.t === 'TEXT' && e.s === '0.85'));
  GR.mark(E, 'STA 110 FT', 110); assert.ok(checkFinite(E.D, 'mark').has('S-SEL')); dxfOk(E.D, 'ratio');
  assert.doesNotThrow(() => GR.ratioLayer(E, [], {}));
});

test('graphics: chart (axes, grid layer, series, limit line, bars) and its mapping', () => {
  const C = GR.chart({ at: [0, 0], w: 120, hgt: 40, h: 2, title: 'RF ALONG THE GIRDER', xr: [0, 360], series: [{ name: 'INVENTORY', pts: [[0, 2.1], [100, 1.4], [360, 0.9]] }, { name: 'OPERATING', pts: [[0, 2.8], [180, 1.7], [360, 1.2]], kind: 'step' }],
    limits: [{ y: 1, label: 'RF = 1.0' }] });
  const used = checkFinite(C.D, 'chart'); ['S-AXIS', 'S-GRID', 'S-CHART-S1', 'S-CHART-S2', 'S-CHART-LIMIT', 'S-ANNO-TEXT'].forEach(l => assert.ok(used.has(l), l));
  assert.ok(Math.abs(C.X(180) - 60) < 1e-9 && Math.abs(C.pick(C.X(123)) - 123) < 1e-9, 'X / pick inverse'); assert.ok(Math.abs(C.Y(C.yr[0])) < 1e-9 && Math.abs(C.Y(C.yr[1]) - 40) < 1e-9);
  // the RF = 1.0 line is at Y(1) on the limit layer
  const lim = C.D.E.find(e => e.l === 'S-CHART-LIMIT' && e.t === 'LINE'); assert.ok(Math.abs(lim.pts[0][1] - C.Y(1)) < 1e-9);
  dxfOk(C.D, 'chart');
  const B = GR.chart({ w: 60, hgt: 30, h: 2, cats: ['f_bu', 'phi F_nc'], series: [{ name: 'DEMAND', kind: 'bars', pts: [[0, 38.2]] }, { name: 'RESISTANCE', kind: 'bars', pts: [[1, 50]], color: 3 }] });
  checkFinite(B.D, 'bars'); dxfOk(B.D, 'bars');
  assert.doesNotThrow(() => GR.chart({ series: [] })); assert.doesNotThrow(() => GR.chart({ series: [{ pts: [[NaN, 1], [1, Infinity], [2, 3]] }] }));
});

test('graphics hand check: built-in project (110-140-110 ft, plates change at 88, 128, 232, 272 ft)', () => {
  const P = J(M.defaultProject()), E = GR.elevation(P, 0);
  // supports at 0, 110, 250, 360 ft = 0, 1320, 3000, 4320 in; plate breaks 88, 128, 232, 272 ft = 1056, 1536, 2784, 3264 in
  assert.deepEqual(J(E.stations.sup), [0, 110, 250, 360]); assert.deepEqual(J(E.stations.plates), [88, 128, 232, 272]);
  assert.deepEqual(J(E.D.E.filter(e => e.l === 'S-BRNG').map(e => e.pts[0][0])), [0, 1320, 3000, 4320]);
  // the stations axis: length 360 ft, step niceStep(360, 10) = 50 ft (raw 36: 3.6 -> 5 x 10 = 50): ticks 0, 50, ..., 350 (8)
  assert.equal(GR.niceStep(360, 10), 50);
  const lab = E.D.E.filter(e => e.t === 'TEXT' && /^\d+$/.test(e.s) && e.hh === E.h * 0.8).map(e => +e.s); assert.deepEqual(J(lab), [0, 50, 100, 150, 200, 250, 300, 350]);
  // text height: 2 % of the length 4320 in = 86.4 in
  assert.ok(Math.abs(E.h - 86.4) < 1e-9);
});
