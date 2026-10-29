// apps/steel-bridge/engine/stiffeners.js against GirderDetail's own Transverse stiffeners (GM.ts.compute, GM.ts.checks), Bearing
// stiffeners (bsCompute, bsChecks) and Preliminary sizing's stiffener layout (tsBaysOf, tsBayX, tsPanels, tsGirderBays), taken from
// "Steel Bridge Design.html" and run in a Node vm (gd-source.mjs's gdBlock / gdDecl).
//
// Inputs: tests/projects/sbd2-stiff/<project>_<owner>[_bays].json, recorded by tests/engine/record-stiffeners.mjs from the page itself for
// the 5 projects × 4 owners of the 100 tests/projects/st/gd_*.json hand-off payloads (P.ts, P.bs as Preliminary sizing sends them and
// GirderDetail auto-designs them; the layout of every girder; uniform d_o/D and a per-bay layout), with the page's own results.
// 1. GirderDetail in Node = GirderDetail in the browser (the recorded results).
// 2. This engine = GirderDetail in Node: every row value and every check item (ratio and status), with the owner rules (η, m, the
//    sacrificial thickness of uncoated weathering steel, TS8, BS7, CP2 Category C); GirderDetail's built-in inputs; variations (pairs,
//    connection plates only, unstiffened panels, F_yw < F_ys, 2 and 3 bearing pairs, fillet-welded flange connection, utilities).
// 3. The layout: baysOf / bayX / bayPanels / girderBays = tsBaysOf / tsBayX / tsPanels / tsGirderBays for every girder.
// 4. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdBlock, gdDecl } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('owners.js'), ENG('shear.js'), ENG('stiffeners.js'));
const SB = W.SBDStiffeners, OW = W.SBDOwners;
const FIX = path.join(ROOT, 'tests/projects/sbd2-stiff');
const fixtures = fs.existsSync(FIX) ? fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort().map(f => ({ f, ...JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')) })) : [];
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- GirderDetail in Node ---------- */
const TAG = '\n// stiffeners.test.mjs';
let GD = null;
function run(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
function gd() {
  if (GD) return GD;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: {} }, cf: {} }; var GM = {};', ctx);
  const loaded = new Set();
  ['ES', 'T', 'GD_GR', 'RANK', 'ge', 'worst', 'parseDim', 'nm', 'numRows', 'wMinFor', 'rc', 'ckNew', 'LE', 'GE', 'f0', 'f2', 'f3', 'frac', 'esc', 'A610_shearC', 'A610_Vp', 'webShear', 'PHI',
    'TS_ROWSPEC', 'TS_BRG', 'TS_PN2', 'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnRules', 'gdOwnCite', 'LF_ONE', 'gdLF', 'OWN_K', 'gdOwnM', 'gdWsSt', 'gdPLq', 'gdPLe', 'gdUt', 'gdUtOn', 'cfDiaOn',
    'BS_DEFAULT', 'bsCompute', 'bsChecks', 'tsBaysOf', 'tsBayX', 'tsPanels', 'tsGirderBays', 'num']
    .forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  run(ctx, c => vm.runInContext(gdBlock('GM.ts = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.ts)' }), loaded);
  const setP = P => { ctx.P = { ts: clone(P.ts || {}), bs: clone(P.bs || {}), cf: clone(P.cf || {}), df: { bridge: clone(P.dfBridge || {}) } }; };
  GD = { ctx, loaded, setP,
    ts: P => { setP(P); return run(ctx, c => { const R = c.GM.ts.compute(c.P.ts); return { R, C: R.errors.length ? null : c.GM.ts.checks(R) }; }, loaded); },
    bs: P => { setP(P); return run(ctx, c => { const R = c.bsCompute(c.P); return { R, C: R.errors.length ? null : c.bsChecks(R) }; }, loaded); },
    fn: name => run(ctx, c => vm.runInContext(name, c), loaded) };
  // warm-up (gd-source.mjs: optimized code does not see a const added later): every path once
  fixtures.forEach(fx => { GD.ts(fx.P); GD.bs(fx.P); });
  return GD;
}
/* this engine's env from the recorded GirderDetail state (gdOwner, gdLF, gdWsSt, cfDiaOn) */
function envOf(P) {
  const b = P.dfBridge || {}, l = b.lf, lf = l && typeof l === 'object' && +l.m > 0 && +l.eta > 0 && +l.etaN > 0 ? l : { m: 1, eta: 1, etaN: 1 }, w = b.ok && b.wsNet;
  return { owner: OW.LIST.includes(b.owner) ? b.owner : 'AASHTO', lf, ws: w && +w.s > 0 ? +w.s : 0, dia: ((P.cf || {}).dia || {}).on === 'yes' };
}

/* ---------- comparison ---------- */
const stats = { vals: 0, items: 0, diffs: [], worst: { rel: 0, what: '' } };
function cmp(list, where) {
  for (const [k, a, b] of list) {
    stats.vals++;
    if (Object.is(a, b) || a === b) continue;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) continue;
    const rel = typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) ? Math.abs(a - b) / Math.max(1e-300, Math.abs(b)) : Infinity;
    if (rel > stats.worst.rel) stats.worst = { rel, what: `${where} ${k}: ${a} vs ${b}` };
    if (rel < 1e-12) continue;
    stats.diffs.push(`${where} ${k}: ${a} vs GirderDetail ${b}`);
  }
}
const TSK = ['Vu', 'VuB', 'VuC', 'Vu1', 'Vu2', 'rhow', 'It', 'It1', 'It2', 'J', 'Fcrs', 'rhot', 'Ireq', 'IreqEq', 'ntf', 'fat', 'Rcp'], PK = ['k', 'C', 'Vp', 'Vn', 'Vcr', 'stiff', 'eqn', 'rho', 'Vu', 'end'];
const BSK = ['Ru', 'bLim', 'bAvail', 'bEff', 'Apn', 'Rsb', 'red', 'sEnd', 'Ltot', 'A', 'I', 'rg', 'sl', 'Po', 'Pe', 'Pn', 'Pr', 'Rweld', 'wMin'];
function itemPairs(mine, theirs, where) {
  const out = [], P = (k, a, b) => out.push([k, a, b]);
  P('check ids', mine.map(c => c.id).join(), theirs.map(c => c.id).join());
  theirs.forEach(c => { const m = mine.find(x => x.id === c.id); if (!m) return;
    P(`${c.id} n`, m.items.length, c.items.length); P(`${c.id} status`, m.status, c.status); P(`${c.id} gov`, m.gov, c.gov); P(`${c.id} na`, !!m.naWhy, !!c.naWhy);
    c.items.forEach((it, i) => { const q = m.items[i] || {}; stats.items++; P(`${c.id}[${i}] loc`, q.loc, it.loc); P(`${c.id}[${i}] st`, q.st, it.st); if (it.r != null || q.r != null) P(`${c.id}[${i}] r`, q.r ?? null, it.r ?? null); }); });
  return out;
}
const browserItems = CK => CK.map(c => [c.id, c.items.map(it => [it.loc, it.r ?? null, it.st]), c.naWhy || '']);
function cmpTs(mineR, gdR, where) {
  if (gdR.errors.length || mineR.errors.length) { cmp([['errors', JSON.stringify([...mineR.errors]), JSON.stringify([...gdR.errors])]], where); return; }
  gdR.rows.forEach((r, i) => { const o = mineR.rows[i], L = []; TSK.forEach(k => L.push([k, o[k], r[k]])); [0, 1].forEach(j => { const a = j ? o.p2 : o.p1, b = j ? r.p2 : r.p1; PK.forEach(k => L.push([`p${j + 1}.${k}`, a[k], b[k]])); L.push([`p${j + 1}.phVn`, a.phVn, b.phVn]); }); L.push(['name', o.name, r.name]); cmp(L, `${where} TS row ${i}`); });
}
function cmpBs(mineR, gdR, where) {
  if (gdR.errors.length || mineR.errors.length) { cmp([['errors', JSON.stringify([...mineR.errors]), JSON.stringify([...gdR.errors])]], where); return; }
  gdR.rows.forEach((r, i) => cmp(BSK.map(k => [k, mineR.rows[i][k], r[k]]), `${where} BS row ${i}`));
}

/* variations of the recorded inputs that reach the other branches */
function tsVariants(P) {
  const v = [], base = () => clone(P.ts);
  { const p = base(); Object.values(p.types).forEach(t => { t.sides = '2'; }); v.push(['pairs', p]); }
  { const p = base(); p.rows.forEach(r => { r.type = 'B'; }); v.push(['connection plates only', p]); }
  { const p = base(); p.rows.forEach((r, i) => { r.do1 = i % 2 ? 4 * r.D : 1.6 * r.D; r.do2 = i % 3 ? 3.2 * r.D : 0.5 * r.D; }); v.push(['wide and narrow panels', p]); }
  { const p = base(); p.gW = '36'; p.gS = 'HPS70W'; v.push(['Fyw < Fys', p]); }
  { const p = base(); p.rows.forEach(r => { r.tw = 0.4375; r.VLL = r.VLL * 1.8; if (r.VLLb != null) r.VLLb *= 1.8; }); v.push(['thin web, high shear', p]); }
  { const p = base(); p.rows.forEach(r => { ['VDC1b', 'VDC2b', 'VDWb', 'VLLb', 'VDC1c', 'VDC2c', 'VDWc', 'VLLc'].forEach(k => delete r[k]); r.df = 3.1; }); v.push(['no panel shears, fatigue', p]); }
  { const p = base(); p.rows.forEach(r => { r.ut = { VUT: 3.2, VUF: 1.1, VUTb: 3.5, VUFb: 1.2, VUTc: 3.0, VUFc: 1.0 }; }); v.push(['utilities', p]); }
  { const p = base(); Object.values(p.types).forEach(t => { t.bt = 3.5; t.tp = '5/16'; t.gap = 1; t.w = '3/16'; t.wf = 0.25; }); p.rows.forEach(r => { r.bft = 20; r.tft = 2.5; }); v.push(['small plates', p]); }
  return v;
}
function bsVariants(P) {
  const v = [], base = () => clone(P.bs);
  { const p = base(); p.types.A.np = 2; p.types.B.np = 3; p.types.B.sp = 10; v.push(['2 and 3 pairs', p]); }
  { const p = base(); p.gW = '36'; p.gS = '50'; v.push(['Fyw < Fys', p]); }
  { const p = base(); p.types.A.conn = 'fillet'; p.types.B.conn = 'cjp'; p.types.A.bt = 12; p.types.B.tp = 0.5; v.push(['fillet connection, wide, thin', p]); }
  { const p = base(); p.rows.forEach(r => { r.ed = 3; r.RLL *= 3; }); v.push(['short end, high reaction', p]); }
  { const p = base(); p.types.A.tp = 0.375; p.types.A.bt = 4; p.D = 96; v.push(['slender column', p]); }
  return v;
}

test('parity with GirderDetail Transverse stiffeners (TS1–TS8, CP1, CP2) and Bearing stiffeners (BS1–BS7) on the recorded inputs of the gd_* projects', () => {
  if (!fixtures.length) { console.log('       (no tests/projects/sbd2-stiff fixtures: run node tests/engine/record-stiffeners.mjs)'); return; }
  const G = gd(); let nT = 0, nB = 0, nV = 0, nodeB = 0, nodeDiff = 0;
  for (const fx of fixtures) {
    const E = envOf(fx.P), where = fx.f.replace(/\.json$/, '');
    // 1. Node = browser
    const T = G.ts(fx.P), B = G.bs(fx.P);
    const nb = (a, b, w) => { nodeB++; if (!(Object.is(a, b) || a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b))))) { nodeDiff++; if (nodeDiff < 5) console.log(`       Node vs browser ${w}: ${a} vs ${b}`); } };
    if (fx.gd.ts.rows) { T.R.rows.forEach((r, i) => { const b = fx.gd.ts.rows[i]; TSK.forEach(k => nb(r[k], b[k], `${where} ts ${i} ${k}`)); });
      browserItems(T.C).forEach(([id, its], j) => its.forEach((it, i) => { nb(it[1], fx.gd.ts.checks[j][1][i][1], `${where} ${id} ${i}`); nb(it[2], fx.gd.ts.checks[j][1][i][2], `${where} ${id} ${i} st`); })); }
    if (fx.gd.bs.rows) { B.R.rows.forEach((r, i) => { const b = fx.gd.bs.rows[i]; BSK.forEach(k => nb(r[k], b[k], `${where} bs ${i} ${k}`)); });
      browserItems(B.C).forEach(([id, its], j) => its.forEach((it, i) => { nb(it[1], fx.gd.bs.checks[j][1][i][1], `${where} ${id} ${i}`); nb(it[2], fx.gd.bs.checks[j][1][i][2], `${where} ${id} ${i} st`); })); }
    // 2. this engine = GirderDetail
    const mt = SB.transverse(clone(fx.P.ts), E); cmpTs(mt, T.R, where); if (!mt.errors.length) cmp(itemPairs(SB.transverseChecks(mt), T.C, where), where + ' TS checks'); nT += T.R.rows ? T.R.rows.length : 0;
    const mb = SB.bearing(clone(fx.P.bs), E); cmpBs(mb, B.R, where); if (!mb.errors.length) cmp(itemPairs(SB.bearingChecks(mb), B.C, where), where + ' BS checks'); nB += B.R.rows ? B.R.rows.length : 0;
    // variations (uniform files only; the per-bay ones carry the same module data shape)
    if (fx.mode === 'uniform') {
      tsVariants(fx.P).forEach(([nm, p]) => { nV++; const Pv = { ...fx.P, ts: p }, g = G.ts(Pv), m = SB.transverse(clone(p), E); cmpTs(m, g.R, `${where} [${nm}]`); if (g.C && !m.errors.length) cmp(itemPairs(SB.transverseChecks(m), g.C, `${where} [${nm}]`), `${where} [${nm}]`); });
      bsVariants(fx.P).forEach(([nm, p]) => { nV++; const Pv = { ...fx.P, bs: p }, g = G.bs(Pv), m = SB.bearing(clone(p), E); cmpBs(m, g.R, `${where} [${nm}]`); if (g.C && !m.errors.length) cmp(itemPairs(SB.bearingChecks(m), g.C, `${where} [${nm}]`), `${where} [${nm}]`); });
    }
    // every row's worked steps render (no exception), and the step ids the check items link to exist
    if (!mt.errors.length) mt.rows.forEach(r => { const ids = new Set(SB.transverseSteps(mt, r).map(s => s.id)); SB.transverseChecks(mt).forEach(c => c.items.filter(it => it.step && it.step.startsWith(`ts${r.i}.`)).forEach(it => assert.ok(ids.has(it.step), `${where} missing step ${it.step}`))); });
    if (!mb.errors.length) mb.rows.forEach(r => { const ids = new Set(SB.bearingSteps(mb, r).map(s => s.id)); SB.bearingChecks(mb).forEach(c => c.items.filter(it => it.step && (it.step.startsWith(`bs${r.i}.`))).forEach(it => assert.ok(ids.has(it.step), `${where} missing step ${it.step}`))); });
  }
  // GirderDetail's built-in inputs
  { const P0 = { ts: clone(G.ctx.GM.ts.def), bs: clone(G.fn('BS_DEFAULT')), cf: {}, dfBridge: {} }, T = G.ts(P0), B = G.bs(P0), E = envOf(P0);
    const mt = SB.transverse(clone(P0.ts), E), mb = SB.bearing(clone(P0.bs), E); cmpTs(mt, T.R, 'built-in'); cmp(itemPairs(SB.transverseChecks(mt), T.C, 'built-in'), 'built-in TS'); cmpBs(mb, B.R, 'built-in'); cmp(itemPairs(SB.bearingChecks(mb), B.C, 'built-in'), 'built-in BS');
    assert.equal(JSON.stringify(SB.TS_DEFAULT), JSON.stringify(G.ctx.GM.ts.def), 'TS_DEFAULT = GM.ts.def'); assert.equal(JSON.stringify(SB.BS_DEFAULT), JSON.stringify(G.fn('BS_DEFAULT')), 'BS_DEFAULT = GirderDetail BS_DEFAULT'); }
  console.log(`       ${fixtures.length} recorded inputs: ${nT} transverse stiffener rows, ${nB} bearings, ${nV} variations; ${stats.vals} values, ${stats.items} check items; Node = browser on ${nodeB} values (${nodeDiff} differ); largest relative difference ${stats.worst.rel.toExponential(2)}${stats.worst.rel ? ' (' + stats.worst.what + ')' : ''}`);
  assert.equal(nodeDiff, 0, 'GirderDetail in Node differs from the browser');
  assert.deepEqual(stats.diffs.slice(0, 20), [], `${stats.diffs.length} differences`);
});

test('layout: baysOf / bayX / bayPanels / girderBays = Preliminary sizing tsBaysOf / tsBayX / tsPanels / tsGirderBays (uniform and per-bay)', () => {
  if (!fixtures.length) return;
  let nG = 0, nP = 0, diffs = [];
  for (const fx of fixtures) {
    const Ly = fx.layout, F = Ly.framing, lay = { web: F.stiff === 'on' ? 'stiffened' : 'unstiffened', mode: F.doMode, doRatio: F.doRatio, bays: F.bays && F.bays.list };
    if (F.stiff !== 'on') continue;
    Ly.girders.forEach((g, i) => { nG++;
      const B = SB.girderBays(lay, Ly.D, Ly.sup, Ly.cont, g.bear, g.ints, i + 1), P = B.flatMap(SB.bayPanels);
      if (JSON.stringify(B) !== JSON.stringify(g.bays)) diffs.push(`${fx.f} G${i + 1} bays`);
      if (JSON.stringify(P) !== JSON.stringify(g.panels)) diffs.push(`${fx.f} G${i + 1} panels`); nP += P.length; });
  }
  console.log(`       ${nG} girders, ${nP} panels: ${diffs.length} differ`);
  assert.deepEqual(diffs, []);
});

test('hand checks: transverse stiffener TS3 and bearing stiffener BS2/BS3 (GirderDetail built-in inputs)', () => {
  const R = SB.transverse(clone(SB.TS_DEFAULT)), r = R.rows[0];
  // Row 1, Type A: one plate 6 × 1/2, D = 60, t_w = 9/16, d_o = 60 / 60, end panel 1.
  // I_t = t_p b_t^3 / 3 = 0.5(6^3)/3 = 36.000 in^4. J = max(2.5/(60/60)^2 − 2.0, 0.5) = 0.5; b = min(60, 60) = 60;
  // I_t1 = 60(0.5625^3)(0.5) = 60(0.177979)(0.5) = 5.3394 in^4.
  // F_crs = min(0.31(29,000)/(6/0.5)^2, 50) = min(62.43, 50) = 50 ksi; ρ_t = max(50/50, 1) = 1.0;
  // I_t2 = 60^4 (1.0)^1.3 / 40 × (50/29,000)^1.5 = 324,000 × 7.1590e-5 = 23.195 in^4.
  // V_u = 1.25(55 + 8) + 1.50(9) + 1.75(85) = 78.75 + 13.5 + 148.75 = 241.0 kip (no panel shears).
  // Panel 2 (interior, d_o = 60 = D): k = 5 + 5/1 = 10; D/t_w = 106.67; 1.40√(29,000·10/50) = 1.40(76.158) = 106.62 < 106.67:
  // C = 1.57/106.67^2 × (29,000·10/50) = 1.57/11,377.8 × 5800 = 0.80034; V_p = 0.58(50)(60)(0.5625) = 978.75 kip; φV_cr = 783.33 kip > 241: ρ_w = 0.
  // Panel 1 (end, d_o = 60 ≤ 1.5D): same k and C, V_n = CV_p = 783.33 kip. Neither panel V_u > φV_cr: I_req = min(I_t1, I_t2) = 5.3394 in^4 (Eq. -1).
  assert.ok(Math.abs(r.It - 36) < 1e-9); assert.ok(Math.abs(r.It1 - 60 * 0.5625 ** 3 * 0.5) < 1e-12); assert.ok(Math.abs(r.It1 - 5.3394) < 1e-4);
  assert.equal(r.Fcrs, 50); assert.equal(r.rhot, 1); assert.ok(Math.abs(r.It2 - 23.195) < 1e-3, String(r.It2));
  assert.ok(Math.abs(r.Vu - 241) < 1e-9); assert.ok(Math.abs(r.p2.k - 10) < 1e-12); assert.ok(Math.abs(r.p2.C - 0.80034) < 1e-5, String(r.p2.C));
  assert.ok(Math.abs(r.p2.Vp - 978.75) < 1e-9); assert.ok(Math.abs(r.p1.Vn - 783.33) < 0.01, String(r.p1.Vn)); assert.equal(r.p1.eqn, '6.10.9.3.3-1');
  assert.equal(r.rhow, 0); assert.ok(r.ntf); assert.ok(Math.abs(r.Ireq - r.It1) < 1e-12); assert.equal(r.IreqEq, '6.10.11.1.3-1');
  // Bearing 1 (Abut. 1), Type A: one pair 7 × 7/8, clip 1, t_w 9/16, b_fb 16, F_ys = F_yw = 50, D = 60, e_d = 9 in.
  // R_u = 1.25(60 + 9) + 1.50(10) + 1.75(95) = 86.25 + 15 + 166.25 = 267.5 kip.
  // b_t,eff = min(7, (16 − 0.5625)/2) − 1 = 6.0 in; A_pn = 2(1)(6.0)(0.875) = 10.5 in^2; (R_sb)_r = 1.0(1.4)(10.5)(50) = 735.0 kip.
  // 9t_w = 5.0625 in; end side min(5.0625, 9 − 0.4375) = 5.0625; L_w = 5.0625 + 0.875 + 5.0625 − 0.875 = 10.125 in;
  // A = 2(1)(7)(0.875) + 1(0.875)(0.5625) + 10.125(0.5625) = 12.25 + 0.4922 + 5.6953 = 18.4375 in^2;
  // I = 0.875(2·7 + 0.5625)^3/12 + 10.125(0.5625^3)/12 = 0.875(3088.217)/12 + 0.15017 = 225.183 + 0.150 = 225.333 in^4; r_s = √(225.333/18.4375) = 3.4959 in;
  // KL/r = 0.75(60)/3.4959 = 12.872; P_e = π²(29,000)(18.4375)/12.872² = 31,849 kip; P_o = 50(18.4375) = 921.875 kip; P_o/P_e = 0.028945;
  // P_n = 0.658^0.028945 × 921.875 = 0.987958 × 921.875 = 910.77 kip; P_r = 0.95 P_n = 865.24 kip.
  const B = SB.bearing(clone(SB.BS_DEFAULT)), b = B.rows[0];
  assert.ok(Math.abs(b.Ru - 267.5) < 1e-9); assert.ok(Math.abs(b.bEff - 6) < 1e-12); assert.ok(Math.abs(b.Rsb - 735) < 1e-9);
  assert.ok(Math.abs(b.A - 18.4375) < 1e-9); assert.ok(Math.abs(b.I - 225.333) < 1e-3, String(b.I)); assert.ok(Math.abs(b.Po - 921.875) < 1e-9);
  assert.ok(Math.abs(b.Pe - 31849.08) < 0.01, String(b.Pe)); assert.ok(Math.abs(b.Pr - 865.24) < 0.01, String(b.Pr));
  // a worked line renders with the substituted values
  const s = SB.bearingSteps(B, b).find(q => q.id === 'bs0.Rsb'); assert.equal(W.SharedSteps.line(s, false), '(R_(sb))_r = φ_b(1.4)A_(pn)F_(ys) = 1.0(1.4)(10.500)(50.00) = 735.00 kip');
});

test('model: the optional stiffener inputs (additive; a project without them still reads)', () => {
  const M = loadShared('units.js', 'steps.js', ENG('model.js')).SBDModel, p = M.defaultProject();
  assert.equal(JSON.stringify(M.validate(p).errors.map(e => e.path)), "[]");
  const q = clone(p); delete q.stiffeners; assert.equal(JSON.stringify(M.validate(q).errors.map(e => e.path)), "[]", 'a version 1 project saved before this PR');
  const r = clone(p); r.stiffeners.layout.mode = 'x'; r.stiffeners.layout.bays = [{ g: 1, a: 10, b: 5, n: 2 }]; r.stiffeners.bearing.types.B.tp = 0;
  assert.equal(JSON.stringify(M.validate(r).errors.map(e => e.path)), JSON.stringify(['stiffeners.layout.mode', 'stiffeners.layout.bays.0', 'stiffeners.bearing.types.B.tp']));
  assert.equal(JSON.stringify(M.defaultStiffeners().transverse.types), JSON.stringify(SB.TS_DEFAULT.types), 'model defaults = GirderDetail GM.ts.def types');
  assert.equal(JSON.stringify(M.defaultStiffeners().bearing.types), JSON.stringify(SB.BS_DEFAULT.types), 'model defaults = GirderDetail BS_DEFAULT types');
});

test('SB2-O16: bearing stiffeners take the support reactions of engine/analysis.js (Shear tab, "This project\'s analysis"); the file path is unchanged', () => {
  const E = f => path.join(ROOT, 'apps/steel-bridge', f);
  const U = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/owners.js'), E('engine/lldf.js'), E('engine/loads.js'),
    E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('ui/shear.js'));
  const P = U.SBDModel.defaultProject(); P.stiffeners = U.SBDModel.defaultStiffeners();
  const A = U.SBDShearUI.fromAnalysis(P, 0); assert.equal(A.err, undefined);
  const R = U.SBDShearUI.build({ P, g: 0, pl: A.pl }), AR = A.R; assert.match(AR.loads.source, /loads module/, 'dead loads and factors from the loads module');
  assert.equal(R.err, undefined); assert.equal(R.rxn, true); assert.equal(R.BS.errors.length, 0); assert.equal(R.BS.rows.length, AR.sup.length);
  R.BS.rows.forEach((r, k) => { assert.equal(r.RDC1, AR.st.DC1.R[k]); assert.equal(r.RDC2, AR.st.DC2.R[k]); assert.equal(r.RDW, AR.st.DW.R[k]); assert.equal(r.RLL, AR.llR[k].max);
    // R_u = 1.25(R_DC1 + R_DC2) + 1.50 R_DW + 1.75 R_LL+IM (AASHTO default owner: η = 1, m = 1)
    assert.ok(Math.abs(r.Ru - (1.25 * (r.RDC1 + r.RDC2) + 1.5 * r.RDW + 1.75 * r.RLL)) < 1e-9); });
  // the interim upper bound (the same stations without the reactions: the jump in shear, the sum of the two LL+IM shear envelopes)
  const pl0 = JSON.parse(JSON.stringify(A.pl)); delete pl0.reactions; const R0 = U.SBDShearUI.build({ P, g: 0, pl: pl0 });
  assert.equal(R0.rxn, false);
  const out = R.BS.rows.map((r, k) => { const q = R0.BS.rows[k];
    // dead loads: the jump in shear across the support equals the reaction (statics), to the 0.005 ft station offset
    assert.ok(Math.abs(q.RDC1 - r.RDC1) < 0.02 * Math.max(1, r.RDC1), `${r.name} R_DC1 ${q.RDC1} vs ${r.RDC1}`);
    assert.ok(q.RLL >= r.RLL - 1e-6, `${r.name}: the shear sum is an upper bound of the LL+IM reaction`);
    return `${r.name}: R_LL+IM ${r.RLL.toFixed(1)} (was ${q.RLL.toFixed(1)}, ${(100 * (q.RLL / r.RLL - 1)).toFixed(1)} %), R_u ${r.Ru.toFixed(1)} (was ${q.Ru.toFixed(1)})`; });
  console.log('       default project, ' + out.join('; '));
});
