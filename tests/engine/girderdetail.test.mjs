// shared/moving-load.js against GirderDetail's own line-girder engine (Steel Bridge Design.html: sgBeam, sgILGrid,
// sgLLRow, sgFatRow, feIM — taken from the page text and run in a vm; nothing else of the page is loaded).
// Both engines get the same spans and the same EI along the girder (plates of the hand-off payloads in
// tests/projects/st, composite with n or steel only), so any difference is the engines' own:
//   1. moment influence lines at GirderDetail's nodes                       -> round-off (both exact at nodes)
//   2. dead load with GirderDetail's nodal (lumped) loads w*trib             -> round-off
//   3. dead load, uniform w: shared (consistent loads, exact) vs GirderDetail (lumped loads; deflection by
//      nodal-rule virtual work)                                             -> discretisation, reported
//   4. HL-93 envelopes per lane with IM: shared analyze (HL93-Truck preset) vs GirderDetail feIM(MLL/VLL)
//                                                                           -> search grids, reported
// Run: node tests/engine/run.mjs girderdetail      (prints the differences; asserts the bounds below)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const PAYLOADS = ['gd_builtin_AASHTO_G1', 'gd_builtin_AASHTO_G2', 'gd_builtin_AASHTO_G3', 'gd_xsA_AASHTO_G2', 'gd_curb_AASHTO_G1'];
const VERBOSE = !!process.env.GD_VERBOSE;

function gdEngine() {
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8');
  const a = html.indexOf('const FE_CACHE = new Map();'), b = html.indexOf('\n/* Staged stiffness', a);
  assert.ok(a > 0 && b > a, 'sgBeam block not found in Steel Bridge Design.html');
  const im = html.match(/\nfunction feIM\(e, im\) \{.*\}\n/);
  assert.ok(im, 'feIM not found');
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(html.slice(a, b) + im[0] + '\nthis.GD={sgBeam,sgLLRow,sgFatRow,feIM};', ctx, { filename: 'Steel Bridge Design.html (sgBeam block)' });
  return ctx.GD;
}

function girder(name, S) {
  const p = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/st', name + '.json'), 'utf8')).payload;
  const dk = p.girderDetail.deck, n = p.girderDetail.materials.n;
  const zones = p.section.zones.map(z => {
    const s = { bt: z.topFlange.width, tt: z.topFlange.thickness, D: z.web.depth, tw: z.web.thickness, bb: z.botFlange.width, tb: z.botFlange.thickness };
    return { x0: z.startX, x1: z.endX, s, In: S.props(s, { comp: true, n, beff: dk.beff, ts: dk.ts, th: dk.haunch, inclH: false }).I,
      Is: S.props(s, { comp: false }).I };
  });
  const wDC1 = p.girderDetail.loads.components.filter(c => c.category === 'DC1' && c.w > 0).reduce((t, c) => t + c.w, 0);
  return { name, spans: p.member.spans, zones, wDC1 };
}
const Iat = (zones, key, x) => { for (const z of zones) if (x >= z.x0 && x < z.x1) return z[key]; return zones[zones.length - 1][key]; };
const segsOf = (zones, key) => zones.map(z => ({ len: z.x1 - z.x0, I: z[key] }));
const rel = (a, b, scale) => Math.abs(a - b) / scale;

function mlgModel(G, key, extra = {}) {   // the page's HL-93 preset (Moving Load Generator defaults), DF 1, LLF 1
  return { spans: G.spans, E: 29000, segs: segsOf(G.zones, key).map(s => ({ ...s, bad: false })), axles: [[8, 0], [32, 14], [32, 14]], short: 'HL93-Truck',
    stdLane: null, udl: { mode: 'lane', w: 0.64, gap: 0, trunc: false }, vK: 3, vMin: 14, vMax: 30, neglect: true, dirs: [1, -1],
    secondary: 'HL93-Tandem', multi: true, mScale: 0.9, mHmin: 50, mFixed: 14, imp: { method: 'const', val: 1.33, S: 6.5, bal: false, onUdl: false },
    llf: 1, dfM: G.spans.map(() => 1), dfV: G.spans.map(() => 1), dfNeg: 0, step: 1, hStep: 2, ...extra };
}

let W, S, GD;
function setup() { if (!S) { W = loadShared('vehicles.js', 'moving-load.js'); S = W.SharedMovingLoad; GD = gdEngine(); } }
const report = [];
const log = s => { report.push(s); if (VERBOSE) console.log('       ' + s); };

test('1. moment influence lines at GirderDetail nodes: round-off', () => {
  setup();
  for (const name of PAYLOADS.slice(0, 2)) {
    const G = girder(name, S), sp = G.spans;
    const b0 = GD.sgBeam(sp, false, null, true), EI = new Float64Array(b0.N - 1).map((_, e) => Iat(G.zones, 'In', (b0.xs[e] + b0.xs[e + 1]) / 2));
    const gb = GD.sgBeam(sp, false, EI, true), N = gb.N, xs = gb.xs;
    // shared: a light vehicle (only the influence lines are used), mesh keys and M sections at every GirderDetail node
    const m = mlgModel(G, 'In', { axles: [[1, 0]], vK: 0, secondary: '', multi: false, udl: { mode: 'none', w: 0, gap: 0, trunc: false }, dirs: [1], scanKeys: [...xs], scanM: [...xs] });
    const R = S.analyze(m, { refine: false, vehicles: {} });
    const node = x => { let i = 0; while (i < R.x.length - 1 && R.x[i] < x - 1e-6) i++; assert.ok(Math.abs(R.x[i] - x) < 1e-6); return i; };
    const jMap = xs.map(node), eM = {}; R.effs.forEach((ef, ei) => { if (ef.t === 'M') eM[ef.node] = ei; });
    let mx = 0, scale = 0;
    for (let i = 1; i < N - 1; i++) { const ei = eM[jMap[i]]; if (ei === undefined) continue;
      for (let j = 0; j < N; j++) { const g = gb.ILM[i * N + j], s = R.IL[ei][jMap[j]]; scale = Math.max(scale, Math.abs(g)); mx = Math.max(mx, Math.abs(g - s)); } }
    log(`${name}: IL(M) ${N - 2} sections x ${N} load points, max |diff| ${mx.toExponential(2)} ft (max |IL| ${scale.toFixed(2)} ft)`);
    assert.ok(mx / scale < 1e-6, `${name}: IL differ ${mx}`);
  }
});

test('2-3. dead load (DC1 on the steel section): lumped loads round-off; uniform load and deflection reported', () => {
  setup();
  for (const name of PAYLOADS) {
    const G = girder(name, S), sp = G.spans, w = G.wDC1;
    const b0 = GD.sgBeam(sp, false, null, true), N = b0.N, xs = b0.xs;
    const EI = new Float64Array(N - 1).map((_, e) => Iat(G.zones, 'Is', (xs[e] + xs[e + 1]) / 2));
    const gb = GD.sgBeam(sp, false, EI, true), trib = gb.trib;
    // GirderDetail (analyzeGirder): M = sum ILM * w * trib; deflection = sum M * ILM * trib * 1728 / (E I(node)); reactions from ILV
    const Mg = new Float64Array(N); for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += gb.ILM[i * N + j] * w * trib[j]; Mg[i] = s; }
    const c = xs.map((x, k) => trib[k] * 1728 / (29000 * Iat(G.zones, 'Is', x)));
    const dg = xs.map((_, x) => { let s = 0; for (let k = 0; k < N; k++) s += Mg[k] * gb.ILM[k * N + x] * c[k]; return s; });
    const Rg = gb.sup.map(s => { let r = 0; for (let j = 0; j < N; j++) r += ((s < N - 1 ? gb.ILV[s * N + j] : 0) - (s > 0 ? gb.ILV[(s - 1) * N + j] : 0) + (j === s ? 1 : 0)) * w * trib[j]; return r; });
    const spec = { spans: sp, E: 29000, segs: segsOf(G.zones, 'Is'), stations: [...xs] };
    // 2. the same nodal loads -> exact
    const lump = S.staticAnalysis({ ...spec, loads: { P: xs.map((x, j) => [x, w * trib[j]]) } });
    const sM = Math.max(...Mg.map(Math.abs)), dML = Math.max(...lump.M.map((v, i) => Math.abs(v - Mg[i])));
    const dRL = Math.max(...lump.R.map((v, k) => Math.abs(v - Rg[k])));
    log(`${name}: w = ${w.toFixed(4)} klf, lumped loads: max |dM| ${dML.toExponential(2)} kip-ft (max |M| ${sM.toFixed(1)}), max |dR| ${dRL.toExponential(2)} kips`);
    assert.ok(dML / sM < 1e-7 && dRL < 1e-6 * sM, `${name}: lumped dead load differs`);
    // 3. uniform load, exact (shared) vs lumped (GirderDetail)
    const U = S.staticAnalysis({ ...spec, loads: { w } });
    let dM = 0, at = 0; U.M.forEach((v, i) => { const d = Math.abs(v - Mg[i]); if (d > dM) { dM = d; at = xs[i]; } });
    const sD = Math.max(...dg.map(Math.abs)), dD = Math.max(...U.defl.map((v, i) => Math.abs(v - dg[i]))), dR = Math.max(...U.R.map((v, k) => Math.abs(v - Rg[k])));
    const pier = gb.sup.slice(1, -1).map(s => `M(${xs[s]}) ${U.M[s].toFixed(2)} vs ${Mg[s].toFixed(2)}`).join(', ');
    log(`${name}: uniform: max |dM| ${dM.toFixed(3)} kip-ft at x = ${at} (${(100 * dM / sM).toFixed(3)} % of max |M|); ${pier}; max |dR| ${dR.toFixed(4)} kips; max |d defl| ${dD.toFixed(4)} in (max ${sD.toFixed(3)} in, ${(100 * dD / sD).toFixed(2)} %)`);
    assert.ok(dM / sM < 2e-3 && dD / sD < 1e-2, `${name}: uniform dead load differs more than discretisation`);
  }
});

test('4. HL-93 envelopes per lane with IM (M and V): reported; within search-grid differences', () => {
  setup();
  for (const name of PAYLOADS.slice(0, 2)) {
    const G = girder(name, S), sp = G.spans;
    const b0 = GD.sgBeam(sp, false, null, true), EI = new Float64Array(b0.N - 1).map((_, e) => Iat(G.zones, 'In', (b0.xs[e] + b0.xs[e + 1]) / 2));
    const gb = GD.sgBeam(sp, false, EI, false), xs = gb.xs;
    const R = S.analyze(mlgModel(G, 'In'), { refine: true, vehicles: W.SharedVehicles.build().presets });
    const gi = x => xs.findIndex(v => Math.abs(v - x) < 1e-6);
    const out = { Mp: [0, 0], Mn: [0, 0], Vp: [0, 0], Vn: [0, 0] }, sc = { M: 0, V: 0 };
    for (const r of R.rows) {
      const i = gi(r.x); if (i < 0) continue;
      const em = R.effs[r.mi], rm = R.res[r.mi], ev = R.effs[r.vi], rv = R.res[r.vi];
      const gm = GD.feIM(gb.MLL[i], 0.33), gNeg = em.neg ? Math.min(gm.neg, gm.neg2) : gm.neg;
      const gvRow = ev.cutL ? gb.VLLr[i] : gb.VLL[i - 1], gv = GD.feIM(gvRow, 0.33);
      sc.M = Math.max(sc.M, Math.abs(gm.pos), Math.abs(gNeg)); sc.V = Math.max(sc.V, Math.abs(gv.pos), Math.abs(gv.neg));
      const upd = (k, a, b) => { const d = a - b; if (Math.abs(d) > Math.abs(out[k][0])) out[k] = [d, r.x]; };
      upd('Mp', rm.max, gm.pos); upd('Mn', rm.min, gNeg); upd('Vp', rv.max, gv.pos); upd('Vn', rv.min, gv.neg);
    }
    const f = (k, s) => `${out[k][0] >= 0 ? '+' : ''}${out[k][0].toFixed(2)} at x = ${out[k][1]} (${(100 * Math.abs(out[k][0]) / s).toFixed(2)} %)`;
    log(`${name}: shared - GirderDetail, largest: +M ${f('Mp', sc.M)}; -M ${f('Mn', sc.M)}; +V ${f('Vp', sc.V)}; -V ${f('Vn', sc.V)}`);
    for (const k of ['Mp', 'Mn']) assert.ok(Math.abs(out[k][0]) / sc.M < 0.01, `${name} ${k}`);
    for (const k of ['Vp', 'Vn']) assert.ok(Math.abs(out[k][0]) / sc.V < 0.01, `${name} ${k}`);
  }
  if (!VERBOSE) report.forEach(s => console.log('       ' + s));
});
