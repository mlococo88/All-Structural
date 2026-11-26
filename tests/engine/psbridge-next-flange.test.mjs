// apps/ps-bridge NF-4 (engineer answer 2026-11-26, "NEXT library: flange 4 in for NEXT F, 8 in for NEXT D"; CLAUDE.md §4): the old
// library's NEXT F entries take flangeT 4 in (engine/sections.js NEXT_FT, applied at install; the moved engine unchanged) and the weak-axis
// I_y and J of a NEXT use the flange g.next.ft (engine/sections.js wrapWeakJ; the engine's own NEXT branch takes 8 in).
//   1. the library: NEXT 24F–36F flangeT 4 (the area difference of the two tabulated widths, 192 / 48 = 4.0 in); MassDOT NEXT F 4, NEXT D 8;
//      withLegacy puts 8 back (the old app's design, as imported) and restores 4;
//   2. hand check, NEXT 36F at b_f = 120 in (the tab design "NEXT 36F with a 6 in topping, no draped strands", G2): I_y 1,854,763 → 1,395,797 in⁴,
//      J 48,681 → 37,407 in⁴; the handling I_y (approxIy) 1,193,011 → 622,869 in⁴; the drawing's flange underside 28 → 32 in; the release
//      tension force (5.9.2.3.1b, exact parts) 226.99 → 210.68 kip, A_s,req 7.566 → 7.023 in², ratio 12.204 → 11.327;
//   3. NEXT D: weakAxisAndJ the engine's own result; the anchor of the wrapper is in the engine's function once;
//   4. the worked steps wk.* carry the wrapped values.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'worked'].map(n => path.join(APP, `engine/${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...ENG), W0 = loadShared(...PBD);
const G = vm.runInContext('GIRDERS', W), G0 = vm.runInContext('GIRDERS', W0), S = W.PSBSections, J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m}: ${a} vs hand ${b}`);
const rj = (a, b) => { const A = Math.max(a, b), B = Math.min(a, b); return A * B ** 3 * (1 / 3 - 0.21 * (B / A) * (1 - B ** 4 / (12 * A ** 4))); };
const NF = ['NEXT 24F', 'NEXT 28F', 'NEXT 32F', 'NEXT 36F'];
const tab = () => { const P0 = TAB_CASES(() => W.PSBModel.defaultProject())['NEXT 36F with a 6 in topping, no draped strands'], P = W.PSBModel.importJSON(W.PSBModel.exportJSON(P0)).project; W.PSBBridge.fill(P);
  const c = W.PSBBridge.cells(P).find(q => q.g === 2), inp = W.PSBDesign.cellInputs(P, c.k, c.g); return { inp, R: W.PSBHoldDown.compute(J(inp)) }; };

test('NF-4 library: NEXT 24F–36F flange 4 in (was 8; (A_144 − A_96)/48 = 4.0 in); MassDOT NEXT F 4, NEXT D 8; withLegacy gives the old 8 back', () => {
  NF.forEach(n => { assert.equal(G0[n].flangeT, 8, n + ' (the moved engine)'); assert.equal(G[n].flangeT, 4, n);
    assert.equal((G[n].pMax.A - G[n].pMin.A) / (G[n].wMax - G[n].wMin), 4, n + ': flange from the tabulated areas'); });
  S.ORDER_MD.filter(n => /NEXT/.test(n)).forEach(n => assert.equal(G[n].flangeT, /F$/.test(n) ? 4 : 8, n));
  assert.deepEqual(J(S.NEXT_FT), NF.map(name => ({ name, old: 8, now: 4 })));
  const inside = S.withLegacy(() => NF.map(n => G[n].flangeT)); assert.deepEqual(inside, [8, 8, 8, 8]); assert.deepEqual(NF.map(n => G[n].flangeT), [4, 4, 4, 4]);
  // every other GIRDERS entry of the old library as the moved engine's (PS-38's NEXT 28F I aside)
  NF.forEach(n => assert.deepEqual(J(Object.assign({}, G[n], { flangeT: 8 })), J(n === 'NEXT 28F' ? Object.assign({}, G0[n], { pMax: Object.assign({}, G0[n].pMax, { I: 92836 }) }) : G0[n]), n));
});

test('NF-4 hand check, NEXT 36F at 120 in: I_y, J, the handling I_y, the outline, the release tension force 226.99 → 210.68 kip', () => {
  const { R } = tab(), g = R.g; assert.equal(g.btf, 120); assert.equal(g.next.ft, 4); assert.equal(g.next.B, 13); assert.deepEqual(J(g.d), [4, 0, 32, 0]);
  // weak axis: hs = h − t_f; I_y = 2[B hs³/12 + B hs (c/2)²] + t_f b_f³/12; J = 2 J(B, hs) + J(b_f, t_f)
  const wj = W.weakAxisAndJ(g), Iy = t => { const hs = 36 - t; return 2 * (13 * hs ** 3 / 12 + 13 * hs * 30 ** 2) + t * 120 ** 3 / 12; }, Jt = t => 2 * rj(13, 36 - t) + rj(120, t);
  near(Iy(8), 1854762.667, 1e-3, 'I_y before'); near(Iy(4), 1395797.333, 1e-3, 'I_y after'); near(wj.Iweak, Iy(4), 1e-6, 'I_y (wrapped)');
  near(Jt(8), 48681.34, 0.01, 'J before'); near(Jt(4), 37407.18, 0.01, 'J after'); near(wj.J, Jt(4), 1e-6, 'J (wrapped)'); near(wj.Sy, Iy(4) / 60, 1e-6, 'S_y');
  const g8 = Object.assign({}, g, { next: Object.assign({}, g.next, { ft: 8 }) }); near(W.weakAxisAndJ(g8).Iweak, Iy(8), 1e-6, 'ft = 8: the engine\'s own');
  // the handling weak-axis I (approxIy, d = [t_f, 0, h − t_f, 0]): t_f b_tf³/12 + (h − t_f) b_bf³/12, b_bf = 2B = 26
  near(vm.runInContext('approxIy', W)(g), 4 * 120 ** 3 / 12 + 32 * 26 ** 3 / 12, 1e-6, 'approxIy after'); near(4 * 120 ** 3 / 12 + 32 * 26 ** 3 / 12, 622869.333, 1e-3);
  near(8 * 120 ** 3 / 12 + 28 * 26 ** 3 / 12, 1193010.667, 1e-3, 'approxIy before');
  assert.deepEqual(J(W.halfPolygon(g)), [[0, 32], [23.5, 32], [23.5, 0], [36.5, 0], [36.5, 32], [60, 32], [60, 36], [0, 36]], 'outline: the flange underside at h − 4');
  // release tension (5.9.2.3.1b, exact parts) at x = 3 ft: f_t = −0.65937, f_b = 3.47786 ksi, c = 36(0.65937)/(0.65937 + 3.47786) = 5.7375 in
  const rs = R.relSteel, row = R.grid.reduce((b, r) => Math.abs(r.x - rs.x) < Math.abs(b.x - rs.x) ? r : b, R.grid[0]), ft = -row.relTop, fb = row.relBot, c = 36 * ft / (ft + fb);
  near(c, 5.7375, 1e-4, 'c'); const f = u => ft * (1 - u / c);
  const Tbefore = 120 * c * ft / 2, Tafter = 120 * 4 * f(2) + 26 * (c - 4) * f(4 + (c - 4) / 2);
  near(Tbefore, 226.991, 1e-3, 'T before (the 8 in flange holds the tension zone)'); near(Tafter, 210.684, 1e-3, 'T after (4 in flange + the stems)'); near(rs.T, Tafter, 1e-9, 'T (engine)');
  near(rs.AsReq, Tafter / 30, 1e-9, 'A_s,req = T / 30 ksi'); near(rs.dc, Tafter / 30 / 0.62, 1e-9, 'ratio'); assert.equal(rs.dc.toFixed(3), '11.327'); assert.equal((Tbefore / 30 / 0.62).toFixed(3), '12.204');
});

test('NF-4: a NEXT D keeps the engine\'s I_y and J (its flange 8 in); the wrapper\'s anchor is in the engine\'s weakAxisAndJ once; the worked steps', () => {
  const t = Function.prototype.toString.call(vm.runInContext('weakAxisAndJ', W0)); assert.equal(t.split(S.WJ_ANCHOR).length - 1, 1);
  const P = W.PSBModel.defaultProject(); P.base.girder = 'MassDOT NEXT 28D'; P.base.ts = 6; P.base.harp.n = 0; P.xs.bays = P.xs.bays.map(() => 9.1);
  const inp = W.PSBDesign.inputs(P), g = W.girderGross(J(inp)); assert.equal(g.next.ft, 8);
  assert.deepEqual(J(W.weakAxisAndJ(g)), J(vm.runInContext('weakAxisAndJ', W0)(J(g))), 'NEXT D: the engine\'s own');
  const { inp: i2, R } = tab(), st = W.PSBWorked.section(i2, R).steps, s = id => st.find(q => q.id === id), wj = W.weakAxisAndJ(R.g);
  assert.ok(Object.is(s('sec.wk.Iy').value, wj.Iweak) && Object.is(s('sec.wk.J').value, wj.J), 'the steps carry the wrapped values');
  assert.equal(s('sec.wk.hs').value, 32); assert.ok(/t_f = 4 in/.test(s('sec.wk.hs').label), s('sec.wk.hs').label);
});
