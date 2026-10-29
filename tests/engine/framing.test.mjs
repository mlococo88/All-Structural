// apps/steel-bridge/engine/framing.js against Preliminary sizing's own framingLayout, buildModel and plXfDef, taken from the page text
// (pl-src) of "Steel Bridge Design.html" and run in a Node vm (pl-source.mjs).
// 1. Preliminary sizing in Node = Preliminary sizing in the browser: the frame list it published to GirderDetail (P.df.bridge.xf) in the
//    20 recordings tests/projects/sbd2-fat/*.json (builtin, builtin28 for 4 owners; xsA, curb, util from their seeds tests/projects/gd/*.json).
// 2. This engine's layout(P, m) = framingLayout(P, m) on the same inputs: every frame (type, span, bay, x_a, x_c), every girder's bearings
//    and points, every span's orientation record, the plXfDef list; for the recorded projects and for variations (orientation, arrangement
//    contiguous / staggered / stepped, spacing, pier-region spacing, skews 0° to 50° and unequal, girder count, splice clearance, owners).
// 3. modelOf(sbd2 project) builds the same inputs from the sbd2 project (spans, xs, plate segments, framing): same layout.
// 4. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { plContext } from './pl-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('owners.js'), ENG('model.js'), ENG('framing.js'));
const FRM = W.SBDFraming;
const J = o => JSON.parse(JSON.stringify(o));
const OWNERS = ['AASHTO', 'RIDOT', 'MassDOT', 'CTDOT'];

let PLC = null;
function pl() {
  if (PLC) return PLC;
  const L = plContext(['OWN_LIST', 'OWN_TBL', 'DEFAULT', 'FL_MEMO', 'framingLayout', 'buildModel', 'plOwnXf', 'plXfDef']);
  PLC = { L, DEF: J(L.ev('DEFAULT')), FL: L.ev('framingLayout'), BM: L.ev('buildModel'), XD: L.ev('plXfDef') };
  return PLC;
}
/* the Preliminary sizing project of a recording: built-in (DEFAULT, builtin28 = every skew 28°) or the seed's plateline_autosave_v1 */
function plProject(pr, owner) {
  const { DEF } = pl(); let P;
  if (pr === 'builtin' || pr === 'builtin28') P = J(DEF);
  else { const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/gd', pr + '.json'), 'utf8')); P = JSON.parse(seed.plateline_autosave_v1).data; }
  P.limits.dot = owner; if (pr === 'builtin28') P.bridge.skews = P.bridge.skews.map(() => 28);
  return P;
}
/* Preliminary sizing in Node: { m, FR (plain), xf } */
function plRun(P) {
  const { L, BM, FL, XD } = pl();
  return L.run(() => { const m = BM(P); if (m.errors.length) throw new Error(m.errors.join('; ')); const FR = FL(P, m); return { m, FR: J({ frames: FR.frames, girders: FR.girders, orient: FR.orient, ys: FR.ys, yc: FR.yc, sp: FR.sp }), xf: J(XD(FR)) }; });
}
/* the framingLayout inputs this engine reads, from Preliminary sizing's model m */
const mIn = m => J({ nb: m.nb, S: m.S, bays: m.bays, skews: m.skews, sup: m.sup, spans: m.spans, cont: m.cont, splices: m.splices,
  trans: m.trans.map(t => ({ fl: t.fl, x: t.x, atSplice: t.atSplice })), webTrans: m.webTrans.map(t => ({ x: t.x, atSplice: t.atSplice })), top: m.top.map(r => ({ x0: r.x0, x1: r.x1, b: r.b })), bot: m.bot.map(r => ({ x0: r.x0, x1: r.x1, b: r.b })) });
const pIn = P => J({ framing: P.framing, limits: { spliceClear: P.limits.spliceClear, dot: P.limits.dot } });
const mine = (P, m) => { const FR = FRM.layout(pIn(P), mIn(m)); return { FR: J({ frames: FR.frames, girders: FR.girders, orient: FR.orient, ys: FR.ys, yc: FR.yc, sp: FR.sp }), xf: J(FRM.plXfDef(FR)) }; };

const stats = { cases: 0, frames: 0, values: 0, worst: 0, what: '' };
function same(a, b, where) {   // exact, value by value
  const walk = (x, y, p) => {
    if (typeof x === 'number' && typeof y === 'number') { stats.values++; if (Object.is(x, y) || x === y) return; const d = Math.abs(x - y); if (d > stats.worst) { stats.worst = d; stats.what = `${where} ${p}`; } assert.fail(`${where} ${p}: ${x} vs Preliminary sizing ${y}`); }
    if (x && y && typeof x === 'object') { const ks = new Set([...Object.keys(x), ...Object.keys(y)]); ks.forEach(k => walk(x[k], y[k], `${p}.${k}`)); return; }
    stats.values++; assert.deepEqual(x, y, `${where} ${p}`);
  };
  walk(a, b, '');
}
const recs = () => fs.readdirSync(path.join(ROOT, 'tests/projects/sbd2-fat')).filter(f => f.endsWith('.json')).sort();

test('Preliminary sizing in Node = the browser: the frame list sent to GirderDetail (20 recordings)', () => {
  let n = 0;
  for (const f of recs()) { const [pr, ow] = f.replace('.json', '').split('_'), rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/sbd2-fat', f), 'utf8'));
    const r = plRun(plProject(pr, ow)); same(r.xf, rec.P.dfBridge.xf, f); n += r.xf.f.length; }
  assert.ok(n > 1000, `${n} frames`);
});

/* variations of a Preliminary sizing project (inputs framingLayout reads) */
function variations(P0) {
  const out = [], v = (lbl, fn) => { const P = J(P0); fn(P); out.push([lbl, P]); };
  v('as is', () => {});
  for (const sk of [[0, 0, 0, 0], [20, 20, 20, 20], [22, 22, 22, 22], [35, 35, 35, 35], [45, 45, 45, 45], [-30, -30, -30, -30], [10, 30, 30, 10], [0, 25, 40, 50], [50, 50, 30, 0]])
    for (const arr of ['contiguous', 'staggered', 'stepped']) for (const orient of ['auto', 'normal'])
      v(`skews ${sk} ${arr} ${orient}`, P => { P.bridge.skews = P.bridge.skews.map((_, i) => sk[i % sk.length]); P.framing.arrange = arr; P.framing.orient = orient; });
  for (const sp of [15, 20, 22.5]) v(`spacing ${sp}`, P => { P.framing.spacing = sp; });
  for (const s2 of [12, 15]) for (const sk of [0, 30]) v(`pier spacing ${s2}, skew ${sk}`, P => { P.framing.spPier = s2; P.bridge.skews = P.bridge.skews.map(() => sk); P.framing.arrange = 'staggered'; });
  v('pier spacing 15, region 30 ft', P => { P.framing.spPier = 15; P.framing.pierLen = 30; });
  v('parallel at 35°', P => { P.framing.orient = 'parallel'; P.bridge.skews = P.bridge.skews.map(() => 35); });
  v('splice clearance 5 ft', P => { P.limits.spliceClear = 5; P.bridge.skews = P.bridge.skews.map(() => 33); });
  v('staggered minimum 8 ft', P => { P.framing.stagMin = 8; P.framing.arrange = 'staggered'; P.bridge.skews = P.bridge.skews.map(() => 40); });
  return out;
}

test('This engine = Preliminary sizing framingLayout: recorded projects × variations, every frame, girder point and span record (exact)', () => {
  for (const f of recs()) { const [pr, ow] = f.replace('.json', '').split('_');
    for (const [lbl, P] of variations(plProject(pr, ow))) {
      let r; try { r = plRun(P); } catch (e) { continue; }   // an input Preliminary sizing rejects (none expected)
      const a = mine(P, r.m); same(a.FR, r.FR, `${f} ${lbl}`); same(a.xf, r.xf, `${f} ${lbl} xf`); stats.cases++; stats.frames += r.FR.frames.length; } }
  console.log(`       framing: ${stats.cases} layouts, ${stats.frames} frames, ${stats.values} values identical (largest difference ${stats.worst})`);
  assert.ok(stats.cases >= 1000, `${stats.cases} layouts`);
});

/* an sbd2 project from a Preliminary sizing project: spans, cross-section (xs.nb, bays, skews), one girder with the plate segments of
   buildModel's sections, the framing settings, the field splices, the owner */
function sbd2Of(P, m) {
  const M = W.SBDModel, p = M.defaultProject();
  p.spans.lengths = m.spans.slice(); p.spans.continuity = m.cont ? 'continuous' : 'simple';
  p.xs = M.defaultXs(p); p.xs.nb = m.nb; p.xs.bays = m.bays.slice(); p.xs.skews = m.skews.slice();
  p.girders = [{ id: 'G1', label: 'G1', position: 'interior', beff: 114, segments: m.secs.map(s => ({ x0: s.x0, x1: s.x1, D: m.D, tw: s.tw, topB: s.top.b, topT: s.top.t, botB: s.bot.b, botT: s.bot.t })) }];
  p.framing = { ...FRM.DEF, spacing: +P.framing.spacing, spPier: P.framing.spPier ?? '', pierLen: P.framing.pierLen ?? '', orient: P.framing.orient, arrange: P.framing.arrange, supClear: +P.framing.supClear, stagMin: +P.framing.stagMin,
    spliceClear: +P.limits.spliceClear, tol: +P.limits.tol, splices: m.splices.slice() };
  p.ownerRules = { owner: P.limits.dot, eta: {} };
  return p;
}
test('modelOf(sbd2 project) gives the same layout as Preliminary sizing on its own project (recordings × 6 variations)', () => {
  let n = 0;
  for (const f of recs()) { const [pr, ow] = f.replace('.json', '').split('_');
    for (const [lbl, P] of variations(plProject(pr, ow)).filter((_, i) => i % 9 === 0)) { const r = plRun(P), R = FRM.compute(sbd2Of(P, r.m));
      assert.equal(R.errors.length, 0, R.errors.join('; '));
      same(J({ frames: R.FR.frames, girders: R.FR.girders }), { frames: r.FR.frames, girders: r.FR.girders }, `${f} ${lbl} (sbd2)`); n++; } }
  assert.ok(n >= 60, `${n}`);
});

test('Hand check: built-in 3-span 110-140-110 ft, 15° skew, 5 girders at 9.5 ft, s = 25 ft (parallel frames)', () => {
  // Every support skewed 15° ≤ 20°: frames parallel to the skew. Equal skews, so every girder's span equals the centerline span.
  // Span 1: n = ⌈110/25⌉ − 1 = 4 per bay, at 110/5 = 22 ft; span 2: ⌈140/25⌉ − 1 = 5, at 140/6 = 23.333 ft; span 3 as span 1.
  // (Preliminary sizing shifts a line by up to a quarter panel only where a frame falls within 2 ft of a field splice: splices at
  // 82, 145, 215, 278 ft; G1 frames at 22, 44, 66, 88 (|88 − 82| = 6 ft clear) ... so no shift is needed in span 1.)
  const { DEF } = pl(), P = J(DEF); P.limits.dot = 'AASHTO';
  const r = plRun(P), p = sbd2Of(P, r.m), R = FRM.compute(p);
  const g1 = R.FR.girders[0], ints = g1.pts.filter(q => q.f.type === 'int').map(q => q.s);
  assert.deepEqual(J(R.FR.orient.map(o => [o.o, o.n])), [['parallel', 4], ['parallel', 5], ['parallel', 4]]);
  // span 1 of G1 at 22, 44, 66, 88 ft (own stations from its Abut. 1 bearing)
  [22, 44, 66, 88].forEach((x, j) => assert.ok(Math.abs(ints[j] - x) < 1e-9, `G1 frame ${j + 1}: ${ints[j]}`));
  // brace points rounded to 0.001 ft (Preliminary sizing braceG): 156.667 − 133.333 = 23.334 ft
  assert.ok(Math.abs(R.girders[0].lb - 23.334) < 1e-9, `largest unbraced length ${R.girders[0].lb} ft (span 2)`);
  // the steps carry the values used
  const st = id => R.steps.find(s => s.id === 'fr.' + id).value;
  assert.equal(st('k1.th'), 15); assert.ok(Math.abs(st('k1.s') - 140 / 6) < 1e-12);
});

test('Hand check: 35° skew, normal frames, first frame offset e = max(clear, 4b_f, 0.4s) from the obtuse bearing (C6.7.4.2.1)', () => {
  // Single span 100 ft, 4 girders at 10 ft, every support 35°, s = 25 ft, b_f = 16 in, clear 3 ft.
  // tan 35° = 0.70021; bearings move (y − y_c)·tan θ: y = 0, 10, 20, 30 ft, y_c = 15 → −10.503, −3.501, +3.501, +10.503 ft.
  // 4b_f = 4(16)/12 = 5.333 ft; first iteration T = B_min − A_max = (100 − 10.503) − 10.503 = 78.994 ft; with e = 0.4(25) = 10 ft:
  // tot = ⌈(78.994 − 20)/25⌉ = 3 intervals, s = 58.994/3 = 19.665 ft, e = max(3, 5.333, 0.4·19.665 = 7.866) = 7.866 ft; iterated:
  // tot = ⌈(78.994 − 15.732)/25⌉ = 3, s = 63.262/3 = 21.087 ft, e = 0.4(21.087) = 8.435 ft; again s = (78.994 − 16.870)/3 = 20.708, e = 8.283;
  // after the 8 passes of Preliminary sizing: s = 20.788 ft, e = 8.315 ft.
  const p = W.SBDModel.defaultProject(); p.spans.lengths = [100]; p.spans.continuity = 'simple';
  p.xs.nb = 4; p.xs.bays = [10, 10, 10]; p.xs.skews = [35, 35];
  p.girders[0].segments = [{ x0: 0, x1: 100, D: 48, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 }];
  p.framing = { ...FRM.DEF, splices: [] };
  const R = FRM.compute(p), o = R.FR.orient[0];
  assert.equal(o.o, 'normal'); assert.ok(Math.abs(o.bf - 16 / 12) < 1e-12); assert.ok(Math.abs(o.dmin - 16 / 3) < 1e-12);
  let s = 25, e = 10; const T = 100 - 2 * 15 * Math.tan(35 * Math.PI / 180);   // A_max = +10.503, B_min = 100 − 10.503 → T = 78.994 ft
  for (let it = 0; it < 8; it++) { const tot = Math.max(1, Math.ceil((T - 2 * e) / 25 - 1e-9)); s = (T - 2 * e) / tot; e = Math.max(3, 16 / 3, 0.4 * s); }
  assert.ok(Math.abs(o.e0 - e) < 1e-9 && Math.abs(o.e1 - e) < 1e-9, `e = ${o.e0} vs ${e}`);
  s = (T - 2 * e) / 3;   // the grid spacing between the first and last full lines with the final e: (78.994 − 2(8.315))/3 = 20.788 ft
  assert.ok(Math.abs(o.s - s) < 1e-9, `s = ${o.s} vs ${s}`); assert.ok(Math.abs(e - 8.31518) < 1e-5 && Math.abs(s - 20.78781) < 1e-5);
  // on every girder the first intermediate frame is at least e from its own bearing
  R.FR.girders.forEach(g => { const f = g.pts.filter(q => q.f.type === 'int').map(q => q.s).sort((a, b) => a - b); assert.ok(f[0] >= 3 - 1e-9 && 100 - f[f.length - 1] >= 3 - 1e-9); });
});

test('Per-girder brace points = the recorded stiffener layout of Preliminary sizing in the browser (sbd2-stiff: bearings and cross-frames of every girder)', () => {
  let n = 0;
  for (const f of fs.readdirSync(path.join(ROOT, 'tests/projects/sbd2-stiff')).filter(q => q.endsWith('.json') && !q.includes('_bays')).sort()) {
    const rec = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/sbd2-stiff', f), 'utf8')), [pr, ow] = f.replace('.json', '').split('_');
    const P = plProject(pr, ow); P.framing = { ...P.framing, ...rec.layout.framing };
    const r = plRun(P), R = FRM.compute(sbd2Of(P, r.m));
    rec.layout.girders.forEach((g, i) => { const G = R.FR.girders[i];
      same(J(G.bear), g.bear, `${f} G${i + 1} bearings`); same(J(G.pts.filter(q => q.f.type === 'int').map(q => q.s)), g.ints, `${f} G${i + 1} cross-frames`); n++; });
  }
  assert.ok(n >= 100, `${n} girders`);
});

test('forGirder / girderBraces: analysis stations, the girder\'s own lengths, supports must match (unequal skews, staggered); skew f_l', () => {
  const { DEF } = pl(), P = J(DEF); P.limits.dot = 'AASHTO'; P.bridge.skews = [10, 30, 30, 45]; P.framing.arrange = 'staggered';
  const r = plRun(P), p = sbd2Of(P, r.m), sup = [0, 110, 250, 360];
  const b = FRM.forGirder(p, { line: 0 }, sup), L = FRM.compute(p), g = L.FR.girders[0];
  // every own station maps into its span and back
  b.own.forEach((s, j) => assert.ok(Math.abs(FRM.toG(L.FR, 0, sup, b.braces[j]) - s) < 1e-9));
  // a span's analysis length 110 ft maps to the girder's own span length B[1] − B[0]
  assert.ok(Math.abs(b.lenOf(0, 110) - (g.bear[1] - g.bear[0])) < 1e-9);
  assert.equal(FRM.forGirder(p, { line: 0 }, [0, 100, 250, 360]), null, 'other supports: null');
  assert.equal(FRM.forGirder({ ...p, framing: undefined }, { gi: 0 }, sup), null, 'no framing: null');
  // skew f_l (C6.10.1): 45° > 20°: exterior 1.25(7.5) = 9.375 → 9.38 ksi (rounded to 0.01 as Preliminary sizing), interior 1.25(10) = 12.5 ksi
  assert.equal(FRM.flSkew(P.bridge.skews, true).fl, 9.38); assert.equal(FRM.flSkew(P.bridge.skews, false).fl, 12.5); assert.equal(FRM.flSkew([15, 20], false).fl, 0);
});
