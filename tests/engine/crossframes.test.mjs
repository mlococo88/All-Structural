// apps/steel-bridge/engine/crossframes.js against GirderDetail's own Cross-frames module (GM.cf.compute, GM.cf.checks with cfDiaChecks)
// and its DC1 cross-frame weight (gdXfW, gdXfModel, gdXfPts), taken from "Steel Bridge Design.html" and run in a Node vm (gd-source.mjs).
// Inputs: the GirderDetail states recorded from the page itself: tests/projects/sbd2-fat/*.json (P.cf, P.df.bridge with its frame list
// P.df.bridge.xf; 5 projects × 4 owners) and tests/projects/sbd2-stiff/*.json (P.cf, P.ts, P.bs, P.df.bridge; 40), GirderDetail's built-in
// inputs, and variations (frame types, member sizes, connections, wind, stability bracing on/off, user forces, fatigue ranges, the diaphragm
// with every channel and W, end diaphragms with jacking, owners).
// 1. This engine = GirderDetail in Node: every member value (A, r_x, r_z, ℓ, forces, KL/r, Q, P_e, P_n, P_r, A_n, U, resistances), the truss
//    unit forces, wind, the stability bracing values, every check item's ratio and status (CF1 to CF11, CFD, CFE), naWhy.
// 2. Weight: xfModel / xfW / xfPts = gdXfModel / gdXfW / gdXfPts on the recorded frame lists (every girder's point loads).
// (The frame list itself, engine/framing.js plXfDef = Preliminary sizing's, and Preliminary sizing in Node = the recorded P.df.bridge.xf: tests/engine/framing.test.mjs.)
// 3. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdBlock, gdDecl } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('owners.js'), ENG('sections.js'), ENG('flexure.js'), ENG('model.js'), ENG('framing.js'), ENG('crossframes.js'));
const CF = W.SBDCrossframes, OW = W.SBDOwners;
const J = o => JSON.parse(JSON.stringify(o));
const rd = d => fs.readdirSync(path.join(ROOT, 'tests/projects', d)).filter(f => f.endsWith('.json')).sort().map(f => ({ f: `${d}/${f}`, ...JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects', d, f), 'utf8')) }));
const FIX = [...rd('sbd2-fat'), ...rd('sbd2-stiff')];

/* ---------- GirderDetail in Node ---------- */
const TAG = '\n// crossframes.test.mjs';
let GD = null;
function gd() {
  if (GD) return GD;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: {} }, cf: {} }; var GM = {};', ctx);
  const loaded = new Set();
  const add = k => { if (loaded.has(k)) return; const d = gdDecl(k); if (!d) throw new Error(`GirderDetail declaration not found: ${k}`); loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); };
  const run = fn => { for (let k = 0; k < 400; k++) { try { return fn(ctx); } catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e; add(m[1]); } } throw new Error('too many missing declarations'); };
  // constants first (optimized code does not see a const added later; gd-source.mjs)
  ['ES', 'T', 'GD_GR', 'RANK', 'ge', 'worst', 'parseDim', 'nm', 'rc', 'ckNew', 'LE', 'f0', 'f2', 'f3', 'frac', 'esc', 'PHI', 'BOLT', 'FUB', 'ANGLES', 'angleProps', 'CF_MEM', 'CF_CH', 'CF_DIA',
    'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnRules', 'gdOwnCite', 'LF_ONE', 'gdLF', 'steelProps', 'sum', 'ltbFnc', 'cfDiaSec', 'cfDiaOn', 'cfIsDia', 'cfDiaGap', 'cfDiaEnd', 'cfTypeRec', 'cfTsCP', 'cfCPsize', 'cfBsCP', 'cfCP', 'cfDiaFit', 'cfDiaChecks',
    'XF_ROW', 'gdXfW', 'gdXfModel', 'gdXfPts', 'dfOpt'].forEach(add);
  run(c => vm.runInContext(gdBlock('GM.cf = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.cf)' }));
  const setP = P => { ctx.P = { cf: J(P.cf || {}), ts: J(P.ts || {}), bs: J(P.bs || {}), df: { bridge: J(P.dfBridge || {}), dl: J(P.dl || {}) } }; };
  GD = { ctx, run, setP,
    cf: P => { setP(P); return run(c => { const R = c.GM.cf.compute(c.P.cf); return { R, C: R.errors && R.errors.length ? null : c.GM.cf.checks(R) }; }); },
    xf: (P, b) => { setP(P); return run(c => { const X = c.gdXfModel(); return { X, G: c.gdXfPts(b, X) }; }); },
    def: () => J(run(c => c.GM.cf.def)) };
  return GD;
}
/* this engine's env from the recorded GirderDetail state (gdOwner, gdLF, P.ts, P.bs, P.df.bridge.skews) */
function envOf(P) {
  const b = P.dfBridge || {}, l = b.lf, lf = l && typeof l === 'object' && +l.m > 0 && +l.eta > 0 && +l.etaN > 0 ? l : { m: 1, eta: 1, etaN: 1 };
  return { owner: OW.LIST.includes(b.owner) ? b.owner : 'AASHTO', lf, skews: Array.isArray(b.skews) ? b.skews : null, ts: P.ts ? J(P.ts) : null, bs: P.bs ? J(P.bs) : null };
}

/* ---------- comparison ---------- */
const stats = { vals: 0, items: 0, cases: 0, diffs: [], worst: { rel: 0, what: '' } };
function cmp(list, where) {
  for (const [k, a, b] of list) {
    stats.vals++;
    if (Object.is(a, b) || a === b) continue;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) continue;
    const rel = typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) ? Math.abs(a - b) / Math.max(1e-300, Math.abs(b)) : Infinity;
    if (rel > stats.worst.rel) stats.worst = { rel, what: `${where} ${k}: ${a} vs ${b}` };
    if (rel === 0) continue;
    stats.diffs.push(`${where} ${k}: ${a} vs GirderDetail ${b}`);
  }
}
const MEMK = ['A', 'rx', 'rz', 'xbar', 'L', 'Tu', 'Cu', 'cT', 'cC', 'lrx', 'KLr', 'bt', 'lim', 'Q', 'Po', 'Pe', 'Pn', 'Pr', 'Pyr', 'An', 'Lc', 'U', 'Pur', 'slC', 'Fmax', 'phRb', 'boltR', 'brgA', 'brgG', 'brgR', 'gage', 'edge', 'dP', 'df', 'name'];
const SBK = ['Dg', 'Iyc', 'Iyt', 'Iyeff', 'cD', 'tD', 'ho', 'L', 'n', 'Mu', 'Cb', 'Lb', 'C', 'Mbr', 'full', 'deepFrame', 'hBr', 'Ad', 'Lc', 'Ah', 'bbr', 'deep', 'bs', 'tsp', 'bsec', 'ng', 'bg', 'bT', 'Cs', 'bReq', 'Ix'];
const DIAK = ['d', 'Mn', 'Fnc', 'Vn', 'C', 'Fw', 'Mw', 'Vw', 'Mbr', 'nb', 's', 'ecc', 'sy2', 'ym', 'V', 'Vt', 'M', 'fmax', 'Mc', 'fw', 'res', 'phiRs', 'phiRb'];
function compareCF(P, where) {
  const g = gd().cf(P), R = CF.compute(J(P.cf), envOf(P));
  if (g.R.errors && g.R.errors.length) { assert.deepEqual(J(R.errors), J(g.R.errors), `${where} errors`); return; }
  assert.equal(R.errors.length, 0, `${where}: ${R.errors.join('; ')}`); stats.cases++;
  const a = R, b = g.R, L = [];
  ['S', 'h', 'Lb', 'dft', 'FT', 'gF', 'n', 's', 'e0', 'tg', 'Fy', 'Fu', 'Fub', 'thr', 'dh', 'emin', 'primary'].forEach(k => L.push([k, a[k], b[k]]));
  ['III', 'V'].forEach(w => ['V', 'PZ', 'W', 'Fw'].forEach(k => L.push([`W.${w}.${k}`, a.W[w][k], b.W[w][k]])));
  b.frames.forEach((e, i) => ['L', 'unit', 'ubr', 'lbl', 'k'].forEach(k => L.push([`frame${i}.${k}`, a.frames[i][k], e[k]])));
  b.combos.forEach((c, i) => c.f.forEach((q, j) => ['w', 'u', 'br', 'T', 'Cc'].forEach(k => L.push([`combo ${c.id}.${j}.${k}`, a.combos[i].f[j][k], q[k]]))));
  Object.keys(b.mem).forEach(k => MEMK.forEach(q => L.push([`mem.${k}.${q}`, a.mem[k][q], b.mem[k][q]])));
  assert.equal(!!a.SB, !!b.SB, `${where} SB`); if (b.SB) SBK.forEach(k => L.push([`SB.${k}`, a.SB[k], b.SB[k]]));
  cmp(L, where);
  const C = CF.checks(R);
  assert.deepEqual(J(C.map(c => c.id)), J(g.C.map(c => c.id)), `${where} check list`);
  g.C.forEach((c, i) => { const m = C[i]; assert.equal(m.items.length, c.items.length, `${where} ${c.id} items`); assert.equal(m.status, c.status, `${where} ${c.id} status`); assert.equal(m.gov, c.gov, `${where} ${c.id} governing item`);
    assert.equal(!!m.naWhy, !!c.naWhy, `${where} ${c.id} naWhy`);
    c.items.forEach((it, j) => { stats.items++; assert.equal(m.items[j].st, it.st, `${where} ${c.id} item ${j} (${it.loc}) status`); cmp([[`${c.id}.${j}.r`, m.items[j].r ?? null, it.r ?? null]], where);
      if (it.cells && m.items[j].cells && c.id !== 'CF10') cmp(it.cells.map((v, q) => [`${c.id}.${j}.cell${q}`, m.items[j].cells[q], v]).filter(([, x, y]) => !/[a-zA-Z(]/.test(String(y))), where); }); });
  ['i', 'e'].forEach(k => { const x = b.DIA && b.DIA[k], y = a.DIA && a.DIA[k]; assert.equal(!!y, !!x, `${where} DIA.${k}`); if (x) cmp(DIAK.map(q => [`DIA.${k}.${q}`, y[q], x[q]]), where); });
  return { R, C };
}
/* variations of a GirderDetail state */
function variations(P0) {
  const out = [], v = (lbl, fn) => { const P = J(P0); P.cf = Object.assign(gd().def(), P.cf || {}); fn(P.cf, P); out.push([lbl, P]); };
  v('as recorded', () => {});
  ['X', 'Kb', 'Kt'].forEach(t => v(`type ${t}`, c => { c.type = t; }));
  v('L6x6x5/8 chords, L4x4x1/2 diagonals', c => { c.mem.top.sec = 'L6x6x5/8'; c.mem.bot.sec = 'L6x6x5/8'; c.mem.diag.sec = 'L4x4x1/2'; });
  v('LLV angles', c => { c.mem.top.sec = 'L5x3-1/2x3/8 (LLV)'; c.mem.diag.sec = 'L6x4x1/2 (LLV)'; c.type = 'Kt'; });
  v('custom slender angle', c => { c.mem.diag = { sec: 'custom', b1: 6, b2: 6, t: 0.3125 }; });
  v('grade 50 angles, 4 bolts of 1 in A490 threads excluded', c => { c.gA = '50'; c.conn = { ...c.conn, d: '1', gr: 'A490', thr: 'excl', n: 4, s: 3.5, e: 1.75, tg: 0.625 }; });
  v('3 bolts', c => { c.conn.n = 3; });
  v('1 bolt (error)', c => { c.conn.n = 1; });
  v('user forces and fatigue ranges', c => { c.user = { StrI: { top: 12, bot: -35, diag: 48 }, Con: { top: -20, bot: 15, diag: -30 }, Fat: { top: 2.5, bot: 4, diag: 6 } }; c.fatCat = 'E'; });
  v('fatigue E prime', c => { c.user.Fat = { top: 0, bot: 1.2, diag: 3 }; c.fatCat = 'Ep'; });
  v('stability bracing off', c => { c.sb.on = 'no'; });
  v('stability bracing, not full depth', c => { c.sb.full = 'no'; c.h = 30; });
  v('stability bracing, long span, large M_u', c => { c.sb.L = 180; c.sb.Mu = 9000; c.sb.n = 2; c.Lb = 30; });
  v('wind 160 mph, K_z 1.2', c => { c.wind.V = 160; c.wind.Kz = 1.2; });
  v('primary members', c => { c.primary = c.primary === 'yes' ? 'no' : 'yes'; });
  v('shallow girder', c => { c.dg = 40; c.sb.D = 36; c.h = 28; });
  [...CF.CF_DIA.map(s => s[0]), ...CF.CF_CH.map(s => s[0])].forEach(sh => v(`diaphragm ${sh}`, c => { c.dia = { ...c.dia, on: 'yes', shape: sh }; }));
  v('diaphragm, end diaphragms MC18x42.7 with jacking', c => { c.dia = { ...c.dia, on: 'yes', shape: 'W24x55', eShape: 'MC18x42.7', eNb: 5, end: 'yes', Rj: 120, aj: 14, nb: 4, pitch: 3, ecc: 3.5 }; });
  v('diaphragm, custom W, stability off', c => { c.dia = { ...c.dia, on: 'yes', shape: 'custom', d: 30, bf: 10, tf: 0.75, tw: 0.5 }; c.sb.on = 'no'; });
  v('diaphragm, 2 bolts at 6 in, grade 36', c => { c.dia = { ...c.dia, on: 'yes', shape: 'C15x33.9', nb: 2, pitch: 6, gr: '36', ecc: 5 }; });
  return out;
}

test('This engine = GirderDetail GM.cf compute and checks (recordings × variations; every value, check item ratio and status)', () => {
  for (const fx of FIX) for (const [lbl, P] of variations(fx.P)) compareCF(P, `${fx.f} ${lbl}`);
  // GirderDetail's built-in inputs, AASHTO
  compareCF({ cf: gd().def(), dfBridge: {} }, 'built-in');
  console.log(`       cross-frames: ${stats.cases} cases, ${stats.vals} values, ${stats.items} check items; largest relative difference ${stats.worst.rel}${stats.worst.what ? ` (${stats.worst.what})` : ''}`);
  assert.deepEqual(stats.diffs.slice(0, 10), []);
  assert.ok(stats.cases > 1500, `${stats.cases}`);
});

test('DC1 cross-frame weight: xfModel, xfW, xfPts = gdXfModel, gdXfW, gdXfPts on the recorded frame lists (every girder point load)', () => {
  let n = 0, worst = 0;
  const modes = [{}, { xf: 'auto', xfAllow: 0 }, { xf: 'auto', xfAllow: 15 }, { xf: 'ovr', xfInt: 0.6, xfEnd: '' }, { xf: 'ovr', xfInt: 0.5, xfEnd: 1.2 }, { xf: 'off' }];
  for (const fx of rd('sbd2-fat')) { const b = fx.P.dfBridge;
    for (const dl of modes) for (const dia of [false, true]) {
      const P = J(fx.P); P.dl = dl; if (dia) P.cf.dia = { ...P.cf.dia, on: 'yes', shape: 'W24x55', eShape: 'C15x33.9' };
      const g = gd().xf(P, { spans: b.spans, xf: b.xf }), set = { mode: dl.xf || 'auto', allow: dl.xfAllow === undefined ? undefined : dl.xfAllow, Wi: dl.xfInt, We: dl.xfEnd };
      if (dl.xfAllow === undefined && !dl.xf) set.allow = undefined;
      const X = CF.xfModel(set, J(P.cf));
      ['on', 'kind', 'type', 'h', 'At', 'Ab', 'Ad', 'A', 'g', 'Ae', 'ge', 'Wi', 'We'].forEach(k => assert.deepEqual(X[k], g.X[k], `${fx.f} ${JSON.stringify(dl)} ${dia} X.${k}`));
      const G = CF.xfPts({ spans: b.spans, xf: b.xf }, X);
      if (!g.G) { assert.equal(G, null); continue; }
      g.G.forEach((pts, i) => pts.forEach((q, j) => { ['x', 'P', 'W', 'Lf'].forEach(k => { const d = Math.abs(G[i][j][k] - q[k]); worst = Math.max(worst, d); assert.ok(d === 0, `${fx.f} girder ${i + 1} point ${j} ${k}: ${G[i][j][k]} vs ${q[k]}`); }); assert.equal(G[i][j].end, q.end); n++; }));
    } }
  console.log(`       weight: ${n} point loads identical (largest difference ${worst})`);
  assert.ok(n > 10000, `${n}`);
});

test('Hand check: GirderDetail built-in cross-frame, L5x5x3/8 single angles, X-frame S = 114 in, h = 48 in', () => {
  // Angle L5x5x3/8 by leg rectangles: A = 5(0.375) + (5 − 0.375)(0.375) = 1.875 + 1.734375 = 3.609375 in².
  // Diagonal ℓ = √(114² + 48²) = √(12,996 + 2,304) = √15,300 = 123.693 in.
  // Wind, Strength III: P_Z = 2.56e-6(130²)(1.0)(1.0)(1.3) = 0.0562432 ksf; W = 0.0562432(62.5/12)/2 = 0.146467 kip/ft; F_w = 0.146467(25) = 3.66167 kip.
  // Strength V: P_Z = 2.56e-6(80²)(1.3) = 0.0212992 ksf; F_w = 0.0212992(5.208333)/2(25) = 1.38667 kip.
  const R = CF.compute(J(CF.DEF), {}), d = R.mem.diag;
  assert.ok(Math.abs(d.A - 3.609375) < 1e-12);
  assert.ok(Math.abs(d.L - Math.sqrt(15300)) < 1e-9);
  assert.ok(Math.abs(R.W.III.PZ - 0.0562432) < 1e-12 && Math.abs(R.W.III.Fw - 3.6616666) < 1e-6);
  assert.ok(Math.abs(R.W.V.Fw - 1.3866666) < 1e-6);
  // Compression (CF1): ℓ/r_x = 123.693/r_x; (KL/r)_eff = 72 + 0.75ℓ/r_x when ℓ/r_x ≤ 80, else 32 + 1.25ℓ/r_x.
  const lrx = d.L / d.rx, KLr = lrx <= 80 ? 72 + 0.75 * lrx : 32 + 1.25 * lrx, Pe = Math.PI ** 2 * 29000 * d.A / KLr ** 2, Po = 36 * d.A;   // P_o = QF_yA_g, Q below
  assert.ok(Math.abs(d.KLr - KLr) < 1e-12 && Math.abs(d.Pe - Pe) < 1e-9);
  // b/t = 5/0.375 = 13.333 > 0.45√(29,000/36) = 12.772, ≤ 0.91√(29,000/36) = 25.83: Q = 1.34 − 0.76(13.333)√(36/29,000) = 1.34 − 0.35702 = 0.98298
  assert.ok(Math.abs(d.Q - (1.34 - 0.76 * (5 / 0.375) * Math.sqrt(36 / 29000))) < 1e-12 && Math.abs(d.Q - 0.98298) < 1e-5);
  assert.ok(Math.abs(d.Po - d.Q * Po) < 1e-9);
  // Bolt shear (CF4): 2(0.80)(0.45)(0.6013)(120) = 51.9523 kip
  assert.ok(Math.abs(d.boltR - 51.95232) < 1e-9);
  // Stability bracing (CF7): I_yc = 0.75(16³)/12 = 256, I_yt = 1.125(16³)/12 = 384 in⁴; h_o = 60 + (0.75 + 1.125)/2 = 60.9375 in
  assert.ok(Math.abs(R.SB.Iyc - 256) < 1e-12 && Math.abs(R.SB.Iyt - 384) < 1e-12 && Math.abs(R.SB.ho - 60.9375) < 1e-12);
  // M_br = 2.4(1320)/(3(29,000)I_yeff)(24,984/1.0)²(300/(500(60.9375))), with I_yeff = 256 + (t/c)384; the step carries the value used
  const S = R.SB, Mbr = 2.4 * 1320 / (3 * 29000 * S.Iyeff) * (2082 * 12) ** 2 * 300 / (500 * 60.9375);
  assert.ok(Math.abs(S.Mbr - Mbr) < 1e-9); assert.equal(R.steps.find(s => s.id === 'cf.sb.Mbr').value, S.Mbr);
});

test('Hand check: weight of one interior X-frame in DC1 (S = 9.5 ft, h = 48 in, L5x5x3/8, +10 %)', () => {
  // S = 114 in; d = √(114² + 48²) = 123.693 in; W = (114(3.609375 + 3.609375) + 2(123.693)(3.609375))(0.2836)/1000 (1.10)
  //   = (822.938 + 892.909)(0.2836e-3)(1.10) = 1715.846(0.2836e-3)(1.10) = 0.535284 kip; each girder takes W/2 = 0.267642 kip.
  const X = CF.xfModel({ mode: 'auto', allow: 10 }, J(CF.DEF)), Wf = CF.xfW(X, 9.5, false);
  const ref = (114 * 2 * 3.609375 + 2 * Math.sqrt(15300) * 3.609375) * 0.2836 / 1000 * 1.1;
  assert.ok(Math.abs(Wf - ref) < 1e-15 && Math.abs(Wf - 0.535284) < 1e-5);
});

test('Analysis takes the cross-frame point loads of the framing (SB2-A6): source, count, total, equilibrium; explicit girder loads still win', () => {
  const W2 = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), ENG('lldf.js'), ENG('loads.js'), ENG('flexure.js'), ENG('framing.js'), ENG('crossframes.js'), ENG('analysis.js'));
  const P = W2.SBDModel.defaultProject(); P.xs.skews = [28, 28, 28, 28];
  const AN = W2.SBDAnalysis, R = AN.analyzeGirder(P, 0, { ll: false }), LD = AN.loadsOf(P, P.girders[0], AN.moduleOf(P, 0));
  const X = W2.SBDCrossframes.pointLoads(P, 0);
  assert.equal(LD.src.xf, 'module'); assert.equal(LD.xf.length, X.pts.length); assert.ok(X.pts.length > 10);
  assert.ok(Math.abs(LD.xf.reduce((a, q) => a + q.P, 0) - X.tot) < 1e-12);
  // ΣR = steel + cross-frames. Within 1e-5 relative: the shared engine (shared/moving-load.js staticAnalysis) meshes a point load 0.006 ft from a
  // station (217.994 ft) as a very short element and loses 1e-4 of that load in ΣR (0.75 lb of 102.66 kip here); reported, not changed (SB2-X1).
  const wsTot = R.segs.reduce((a, s, i) => a + R.wSteel[i] * (s.x1 - s.x0), 0), sR = R.st.DC1steel.R.reduce((a, b) => a + b, 0);
  assert.ok(Math.abs(sR - wsTot - X.tot) / (wsTot + X.tot) < 1e-5, `ΣR ${sR} vs ${wsTot + X.tot}`);
  assert.equal(X.line, 1, 'the plate girder takes cross-section girder G2 (interior): frames on both sides, W/2 each');
  const P2 = JSON.parse(JSON.stringify(P)); P2.girders[0].loads = { DC1wet: 1, DC2: 0.2, DW: 0.2, xf: [{ x: 50, P: 1 }] };
  assert.equal(AN.loadsOf(P2, P2.girders[0], null).src.xf, 'girder');
  P.crossframes.weight.mode = 'off'; assert.equal(AN.loadsOf(P, P.girders[0], null).src.xf, 'none');
});
