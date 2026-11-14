// apps/ps-bridge 2026-11-14 (PS Bridge catch-up, item 7): the Loads & LLDF cross-section's lanes, wheels and lever-rule influence line
//   (ui/xsfig.js PSBXsFig.lldf) reproduce the moved engine's values. The engine (engine/pbd-lldf-flexure.js distFactors, frozen) returns only
//   the scalars; the figure places the wheels itself, by the engine's own rule. For every layout below, the drawn positions give back the
//   engine's result of that girder line exactly (computed through PSBHoldDown.compute, the page's computation):
//     lever rule: wheels 2 ft and 8 ft inboard of the traffic face (the face d_e outboard of the exterior girder ℄); each ordinate = the
//       influence line of the exterior girder at the wheel (1.0 at it, 0 at the next girder S away, linear; 0 beyond, not counted);
//       g_lever = m Σ 0.5 × ordinate with the multiple presence m = 1.2 as the engine applies it = df.lever;
//     rigid section: N_L = the engine's governing count of 12 ft lanes from the face; each lane resultant 5 ft inside its edge; e from the
//       centroid of the girders (the actual lines; with unequal bays the engine's PS-19 positions); R = m(N_L/N_b + X_ext Σe/Σx²) = df.rigid,
//       m = 1.2 / 1.0 / 0.85 / 0.65.
//   Layouts: exterior G1 and G_nb on equal bays; unequal bays (both sides); a 6 ft × 12 in sidewalk (negative d_e: the second wheel beyond
//   the next girder, not counted); wide barriers on one side; a project without the cross-section barriers (the entered d_e); N_L 1 to 4.
//   Interior lines, NEXT and box beams / slabs: no case (the note says why).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBD, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'view3d', 'xsfig'].map(n => path.join(APP, `ui/${n}.js`)));
const J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, msg, tol = 1e-12) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
function project(o) {
  const P = W.PSBModel.defaultProject(); Object.assign(P.spans, { lengths: o.spans || [110], continuity: 'simple' });
  Object.assign(P.xs, { bays: o.bays, nb: o.bays.length + 1, skews: (o.spans || [110]).concat(0).map(() => 0), ohL: o.ohL ?? 3, ohR: o.ohR ?? 3 });
  if (o.base) Object.assign(P.base, J(o.base)); if (o.NL) P.base.loads.NL = o.NL;
  P.types = W.PSBBridge.newTypes(P); P.design = { g: 1, s: 1 }; P.xs.dl = W.PSBBridgeDL.defaults(P); if (o.dl) o.dl(P.xs.dl); return P;
}
/* the engine's result of line g in span s, and the figure's model of it */
function at(P, g, s = 1) {
  const c = W.PSBBridge.cells(P).find(q => q.g === g && q.s === s), inp = W.PSBDesign.cellInputs(P, c.k, g), R = W.PSBHoldDown.compute(J(inp));
  assert.ok(!R.error, R.error); return { inp, R, L: W.PSBXsFig.lldf(P, s, g, inp, R.df) };
}
/* the checks of an exterior line: the drawn wheels and ordinates give the engine's lever and rigid values */
function exterior(P, g, tag) {
  const { inp, R, L } = at(P, g), df = R.df, m = L.m, nb = P.xs.nb, off = W.PSBModel.girderOffsets(P).map(x => x * 12);
  assert.equal(L.kind, 'ext', `${tag}: exterior`); assert.ok(df.ext, `${tag}: the engine's exterior girder`);
  const lv = L.cases.find(c => c.key === 'lever'), rg = L.cases.find(c => c.key === 'rigid'), S = +inp.S, de = +inp.loads.de, dir = g === 1 ? 1 : -1;
  // positions: the face d_e outboard of the girder ℄; the wheels 2 and 8 ft inboard of the face; the next girder S away (= its own line)
  close(lv.xg, off[g - 1], `${tag}: girder`); close(lv.xf, off[g - 1] - dir * de * 12, `${tag}: traffic face`);
  close(lv.xa, off[g - 1 + dir], `${tag}: the next girder at S (the engine's S = the line's bay)`, 1e-9);
  close(lv.wheels[0], lv.xf + dir * 24, `${tag}: wheel 1 at 2 ft`); close(lv.wheels[1], lv.xf + dir * 96, `${tag}: wheel 2 at 8 ft`); close(lv.wheels[1] - lv.wheels[0], dir * 72, `${tag}: 6 ft apart`);
  // the ordinates of the drawn influence line under the wheels and the reaction they give
  let sum = 0; lv.terms.forEach((t, i) => { const xo = dir * (off[g - 1] - lv.wheels[i]) / 12; close(t.xo, xo, `${tag}: wheel ${i + 1} x`);
    const ord = xo > -S ? (S + xo) / S : 0; close(t.ord, ord, `${tag}: ordinate ${i + 1}`); if (xo > -S) sum += 0.5 * ord; });
  close(lv.m, 1.2, `${tag}: m = 1.2 (one lane)`); close(1.2 * sum, df.lever, `${tag}: m Σ 0.5 ordinate = the engine's g_lever`); close(lv.value, df.lever, `${tag}: drawn lever = engine`);
  // rigid section: the engine's lane count; lanes from the face; resultants 5 ft inside each lane
  assert.equal(rg.NL, df.rigidNL, `${tag}: N_L = the engine's governing count`); assert.equal(rg.lanes.length, df.rigidNL);
  rg.res.forEach((x, j) => close(x, lv.xf + dir * (5 + 12 * j) * 12, `${tag}: lane ${j + 1} resultant`));
  const X = df.rigidX ? df.rigidX.x.map(v => v + P.xs.ohL) : off.map(v => v / 12), xbar = X.reduce((a, v) => a + v, 0) / nb, Xext = Math.abs(X[g - 1] - xbar);
  const sx2 = X.reduce((a, v) => a + (v - xbar) ** 2, 0), sE = rg.res.reduce((a, x) => a + dir * (xbar - x / 12), 0), MPF = [1.2, 1.0, 0.85, 0.65];
  close(rg.m, MPF[rg.NL - 1], `${tag}: m of ${rg.NL} lanes`); close(rg.value, df.rigid, `${tag}: drawn rigid R = the engine's`, 1e-9);
  close(MPF[rg.NL - 1] * (rg.NL / nb + Xext * sE / sx2), df.rigid, `${tag}: R from the drawn resultants`, 1e-9);
  return { lv, rg, df };
}

test('lldf figure: new project, G1 and G5 (equal bays, barriers): the drawn lever and rigid cases = the engine', () => {
  const P = project({ bays: [9, 9, 9, 9] });
  const a = exterior(P, 1, 'G1'), b = exterior(P, 5, 'G5');
  close(a.df.lever, b.df.lever, 'symmetric bridge: the same lever factor');
  [2, 3, 4].forEach(g => { const { L } = at(P, g); assert.equal(L.kind, 'int'); assert.equal(L.cases.length, 0); assert.match(L.note, /interior girder/); });
});
test('lldf figure: unequal bays 8 / 10 / 9.5 / 8.5 ft, overhangs 4 / 2.5 ft (PS-19 rigid on the real lines), N_L up to 3', () => {
  const P = project({ bays: [8, 10, 9.5, 8.5], ohL: 4, ohR: 2.5, NL: 3 });
  const a = exterior(P, 1, 'G1'), b = exterior(P, 5, 'G5');
  assert.ok(a.df.rigidX && b.df.rigidX, 'the engine used the actual girder lines'); close(+at(P, 1).inp.S, 8, 'G1: S = its bay'); close(+at(P, 5).inp.S, 8.5, 'G5: S = its bay');
});
test('lldf figure: a 6 ft × 12 in sidewalk on the right (negative d_e: the second wheel beyond the next girder is not counted); wide left barrier', () => {
  const P = project({ bays: [8.5, 9.5, 9.5, 8.5], ohL: 3.5, ohR: 3, NL: 4, dl: d => { d.swR = { w: 6, t: 12 }; d.barL = Object.assign({}, d.barL, { bw: 2.5 }); } });
  const b = exterior(P, 5, 'G5 sidewalk'), a = exterior(P, 1, 'G1 wide barrier');
  close(+at(P, 5).inp.loads.de, -3, 'G5: d_e = 3 − 6'); assert.ok(!b.lv.terms[1].on && b.lv.terms[1].ord === 0, 'the second wheel is beyond the next girder');
  close(+at(P, 1).inp.loads.de, 1, 'G1: d_e = 3.5 − 2.5'); assert.ok(a.lv.terms.every(t => t.on));
});
test('lldf figure: no cross-section barriers (the entered d_e); one-lane rigid check', () => {
  const P = project({ bays: [7, 7, 7], NL: 1 }); delete P.xs.dl; P.base.loads.de = 0.75;
  const a = exterior(P, 1, 'G1 entered d_e'); close(+at(P, 1).inp.loads.de, 0.75, 'entered'); assert.equal(a.rg.NL, 1); close(a.rg.m, 1.2, 'm = 1.2');
});
test('lldf figure: NEXT, box beams and slabs: no lever rule (no wheels, a note)', () => {
  const N = project({ bays: [8, 8, 8, 8], base: { girder: 'NEXT 36F', ts: 6, harp: { n: 0, yEnd: 24, yMid: 6, frac: 0.4 }, rows: [{ n: 10, y: 2, dbnd: 0, nd: 0 }] } });
  const n = at(N, 1); assert.equal(n.L.kind, 'next'); assert.equal(n.L.cases.length, 0); assert.match(n.L.note, /no lever rule/);
  const B = project({ bays: [3, 3, 3, 3, 3], ohL: 1.5, ohR: 1.5, base: { girder: 'AASHTO BIII-36 (39in)', ts: 6, harp: { n: 0, yEnd: 24, yMid: 6, frac: 0.4 }, rows: [{ n: 16, y: 2, dbnd: 0, nd: 0 }] } });
  const b = at(B, 1); assert.equal(b.L.kind, 'fg'); assert.equal(b.L.cases.length, 0); assert.match(b.L.note, /no lever rule/);
  // the figure with a case draws its wheels; without one none
  const P = project({ bays: [9, 9, 9, 9] }), { L } = at(P, 1);
  const out = W.PSBXsFig.svg(P, 1, 700, { shown: 1, ll: L.cases[0] }); assert.equal((out.svg.match(/class="dt-wh xs-wh"/g) || []).length, 2, 'two wheels'); assert.match(out.svg, /class="dt-il"/, 'the influence line');
  const r = W.PSBXsFig.svg(P, 1, 700, { shown: 1, ll: L.cases[1] }); assert.equal((r.svg.match(/class="dt-wh xs-wh"/g) || []).length, 2 * L.cases[1].NL, 'two wheels a lane'); assert.ok(!/class="dt-il"/.test(r.svg), 'no influence line in the rigid case');
  assert.equal((W.PSBXsFig.svg(P, 1, 700, { shown: 1 }).svg.match(/class="dt-wh xs-wh"/g) || []).length, 0, 'no case: no wheels');
});
