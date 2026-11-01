// apps/steel-bridge/engine/splices.js (window.SBDSplices): bolted field splices, AASHTO LRFD 10th Ed. 6.13.6.1, against GirderDetail's
// own Field splice functions run in Node from "Steel Bridge Design.html" (gdCompute, gdChecks, autoDesignSplice, fitSplice, spCtNarrow).
//
// Parity cases (the same inputs go to GirderDetail and to this engine; every value of GirderDetail's result object is compared, every
// check: status, governing item, each item's location, ratio and status; the auto-design: the plates, bolts and message):
//   1. The built-in splice (GD_DEFAULT, FS1 of the PlateLine example girder), 10th and 8th Edition, under each owner (AASHTO, RIDOT with
//      its LL multiplier m = 1.2 and haunch 0, MassDOT with η = 1.05, CTDOT with the oversized-hole slip rule spl.ovs), and its auto-design.
//   2. Every field splice of the 100 tests/projects/st/gd_*.json hand-off payloads (stations from the payload's fatigue detail list,
//      "Field splice FSk at x ft"): the splice inputs built from the payload the way Preliminary sizing's spliceExport builds them
//      (sections 0.01 ft each side; moments at the node nearest the splice, shears the largest in the element and its neighbours; the
//      utilities; the owner's load factors and minimum plate), then GirderDetail's autoDesignSplice and this engine's autoDesign from the
//      same start, then gdCompute/gdChecks against compute/checks on the designed splice; also with GirderDetail's built-in plates as
//      they are (failing items included) and the 8th Edition on every fifth payload.
//   3. The new app's own path: the payload as an sbd2 project (an-fixture.mjs), engine/analysis.js, girder(): the demands at each splice
//      against the payload's (the expected analysis differences of analysis.test.mjs only), and the designed splices pass.
//   4. Hand checks (arithmetic in the comments).
// No browser recording was needed: the payloads hold every input of the splice module (GirderDetail's node grid and the forces there).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdDecl } from './gd-source.mjs';
import { payloadFiles, readPayload, gdNodes, zoneAt, projectFromPayload } from './an-fixture.mjs';

const ENG = p => path.join(ROOT, 'apps/steel-bridge/engine', p);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), ENG('flexure.js'), ENG('shear.js'), ENG('stiffeners.js'), ENG('analysis.js'), ENG('splices.js'));
const S = W.SBDSplices, OW = W.SBDOwners;
const clone = o => JSON.parse(JSON.stringify(o));
const payloads = payloadFiles();

/* GirderDetail's splice functions in their own vm context (every declaration pulled in on first use; tagged, see gd-source.mjs) */
const TAG = '\n// splices.test.mjs';
let GDX = null;
function gdRun(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
const OWN = { AASHTO: { lf: { v: 1, m: 1, eta: 1, etaN: 1, h0: false }, minPlate: 0.375 }, RIDOT: { lf: { v: 1, m: 1.2, eta: 1, etaN: 1, h0: true }, minPlate: 0.4375 },
  MassDOT: { lf: { v: 1, m: 1, eta: 1.05, etaN: 1, h0: true }, minPlate: 0.375 }, CTDOT: { lf: { v: 1, m: 1, eta: 1.05, etaN: 1, h0: false }, minPlate: 0.5 } };
function gd() {
  if (GDX) return GDX;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext("var P = { df: { bridge: {} }, std: {} }; var GM = {};", ctx);
  const loaded = new Set();
  ['T', 'GD_GR', 'BOLT', 'FUB', 'PHI', 'ES', 'RANK', 'worst', 'sum', 'ge', 'parseDim', 'nm', 'num2', 'f0', 'f2', 'f3', 'frac', 'esc', 'A610_shearC', 'A610_Vp', 'modRatio', 'steelProps', 'addPart', 'SAME_KEYS', 'secEff',
    'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnCite', 'LF_ONE', 'gdLF', 'OWN_K', 'gdOwnM', 'gdHP', 'gdPLq', 'gdUt', 'gdGLq', 'gdGLt', 'STD_DEF', 'std', 'spStdT', 'spNextT',
    'gdCompute', 'gdChecks', 'spCtNarrow', 'fitSplice', 'autoDesignSplice']
    .forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  const setP = (p, owner) => { const o = OWN[owner || 'AASHTO']; ctx.P = { ...clone(p), df: { bridge: owner ? { owner, lf: clone(o.lf) } : {} }, std: { minPlate: o.minPlate } }; };
  GDX = { ctx, loaded,
    compute: (p, owner) => { setP(p, owner); const R = gdRun(ctx, c => c.gdCompute(c.P), loaded); return R; },
    checks: R => Array.from(gdRun(ctx, c => c.gdChecks(R), loaded)),
    auto: (p, owner) => { setP(p, owner); const r = gdRun(ctx, c => c.autoDesignSplice(), loaded); const P = clone(ctx.P); return { r: clone(r), p: { top: P.top, bot: P.bot, web: P.web } }; } };
  // warm-up: every path before the comparisons (V8: see gd-source.mjs)
  const d0 = clone(S.DEF);
  for (const o of Object.keys(OWN)) for (const code of ['10', '8']) { const p = clone(d0); p.sec.code = code; const R = GDX.compute(p, o); GDX.checks(R); }
  GDX.auto(clone(d0), 'CTDOT'); GDX.auto(clone(d0), 'AASHTO');
  return GDX;
}
const envOf = owner => ({ owner, lf: OWN[owner].lf, minPlate: OWN[owner].minPlate });

/* ---------- comparison ---------- */
const stats = { vals: 0, items: 0, diffs: [], worst: { rel: 0, what: '' } };
const SKIP = new Set(['P', 'env', 'Vexpr', 'work', 'where', 'cells', 'sym', 'note', 'msg', 'lbl']);
function walk(g, m, where, depth = 0) {
  if (typeof g === 'function' || depth > 12) return;
  if (typeof g === 'number') { stats.vals++;
    if (Object.is(g, m) || (Number.isNaN(g) && Number.isNaN(m))) return;
    const rel = typeof m === 'number' && isFinite(g) && isFinite(m) ? Math.abs(g - m) / Math.max(1e-300, Math.abs(g)) : Infinity;
    if (rel > stats.worst.rel) stats.worst = { rel, what: `${where}: ${m} vs GirderDetail ${g}` };
    if (rel > 1e-12 && Math.abs(g - m) > 1e-12) stats.diffs.push(`${where}: ${m} vs GirderDetail ${g}`); return; }
  if (typeof g === 'string' || typeof g === 'boolean' || g == null) { stats.vals++; if (g !== m && !(g == null && m == null)) stats.diffs.push(`${where}: ${JSON.stringify(m)} vs GirderDetail ${JSON.stringify(g)}`); return; }
  if (Array.isArray(g) || ArrayBuffer.isView(g)) { if (!m || m.length !== g.length) { stats.diffs.push(`${where}: length ${m && m.length} vs ${g.length}`); return; } for (let i = 0; i < g.length; i++) walk(g[i], m[i], `${where}[${i}]`, depth + 1); return; }
  if (typeof g === 'object') { if (!m || typeof m !== 'object') { stats.diffs.push(`${where}: missing`); return; } for (const k of Object.keys(g)) { if (SKIP.has(k)) continue; walk(g[k], m[k], `${where}.${k}`, depth + 1); } }
}
function cmpChecks(CKg, CKm, where) {
  if (CKg.length !== CKm.length) { stats.diffs.push(`${where}: ${CKm.length} checks vs GirderDetail ${CKg.length}`); return; }
  CKg.forEach((c, i) => { const o = CKm[i], w = `${where} ${c.id}`;
    walk({ id: c.id, status: c.status, gov: c.gov, naWhy: (c.naWhy || '').replace(' on the Section tab', ''), n: c.items.length }, { id: o.id, status: o.status, gov: o.gov, naWhy: o.naWhy || '', n: o.items.length }, w);
    c.items.forEach((it, j) => { const q = o.items[j]; if (!q) return; stats.items++; walk({ loc: it.loc, r: it.r ?? null, st: it.st }, { loc: q.loc, r: q.r ?? null, st: q.st }, `${w} #${j}`); });
    if (!!c.ctN !== !!o.ctN) stats.diffs.push(`${w}: CTDOT note ${!!o.ctN} vs ${!!c.ctN}`); });
}
function cmpSplice(p, owner, where, withSteps) {
  const G = gd(), Rg = G.compute(clone(p), owner), Rm = S.compute(clone(p), envOf(owner));
  walk(Rg, Rm, where);
  if (Rg.errors.length) return { Rg, Rm, CKg: null, CKm: null };
  const CKg = G.checks(Rg), CKm = S.checks(Rm, { steps: !!withSteps });
  cmpChecks(CKg, CKm, where);
  return { Rg, Rm, CKg, CKm };
}
function cmpAuto(p, owner, where) {
  // SB2-AD8 (B4): this engine raises the end distances to DT4's e_min (the owner's edge distance where larger) before its search;
  // GirderDetail's autoDesignSplice keeps the entered ones. GirderDetail runs on the inputs with the same end distances (AD8 applied by hand).
  const pg = clone(p), R0 = S.compute(clone(p), envOf(owner)), em = R0.errors.length ? 0 : R0.emin, up = (o, f) => { if (!(S.parseDim(o[f]) >= em - 1e-9)) { o[f] = em; stats.ad8 = (stats.ad8 || 0) + 1; } };
  if (em) { ['top', 'bot'].forEach(k => { up(pg[k], 'ef'); up(pg[k], 'ep'); }); up(pg.web, 'ew'); up(pg.web, 'ewp'); }
  const G = gd(), b = S.autoDesign(clone(p), envOf(owner)), a = G.auto(/was not changed/.test(b.msg) ? clone(p) : pg, owner);   // not changed (DT10, too narrow): the entered end distances stay
  walk(a.p, { top: b.p.top, bot: b.p.bot, web: b.p.web }, `${where} auto`);
  walk({ ok: a.r.ok, fails: a.r.fails.join(',') }, { ok: b.ok, fails: b.fails.join(',') }, `${where} auto`);
  // messages: GirderDetail's mention its own buttons and tabs; the plate and bolt description is compared
  const core = s => String(s).split(/ (?:Widen|Use "|To fix|Why)/)[0].replace(/ \(Preliminary sizing[^)]*\)/g, '');
  if (!/flange is .* wide/.test(a.r.msg) && core(a.r.msg) !== core(b.msg)) stats.diffs.push(`${where} auto msg: ${b.msg}\n         vs GirderDetail ${a.r.msg}`);
  return { a, b };
}
const report = (name, t0) => { console.log(`       ${name}: ${stats.vals} values, ${stats.items} check items compared; end distances raised by AD8 ${stats.ad8 || 0}; largest relative difference ${stats.worst.rel.toExponential(2)}${stats.worst.what ? ' (' + stats.worst.what + ')' : ''}; ${((Date.now() - t0) / 1000).toFixed(1)} s`); };
const assertNoDiff = () => assert.equal(stats.diffs.length, 0, `${stats.diffs.length} difference(s):\n       ${stats.diffs.slice(0, 30).join('\n       ')}`);

/* ---------- 1. built-in splice ---------- */
test('parity with GirderDetail: the built-in splice, 10th and 8th Edition, every owner (gdCompute, gdChecks), and its auto-design', () => {
  const t0 = Date.now(); stats.diffs.length = 0;
  for (const owner of Object.keys(OWN)) for (const code of ['10', '8']) for (const prs of ['no', 'yes']) {
    const p = clone(S.DEF); p.sec.code = code; p.sec.prs = prs;
    cmpSplice(p, owner, `built-in ${owner} ${code}th prs=${prs}`, true);
    const q = clone(p); q.dem.dMp = 400; q.dem.dMn = 250; q.bolts.thr = 'incl'; q.bolts.cls = 'A'; q.bolts.prep = 'punched'; q.bolts.eccV = 'incl'; q.bolts.eccS = 'excl'; q.bolts.long = 'both'; q.sec.web = 'stiffened'; q.sec.do = 90;
    q.dem.ut = { MUT: -40, MUF: -25, VUT: 6, VUF: 4 }; q.dem.pl = { MLLp: [80, 1150], VLL: [5, 70] }; q.bolts.stitch = 'adv'; q.bolts.c1 = 1.25; q.top.inner = false; q.web.nc = 1;
    cmpSplice(q, owner, `built-in variant ${owner} ${code}th prs=${prs}`, true);
  }
  for (const owner of Object.keys(OWN)) cmpAuto(S.DEF, owner, `built-in ${owner}`);
  report('built-in', t0); assertNoDiff();
});

/* ---------- 2. the splices of the 100 hand-off payloads ---------- */
const r1 = v => +(+v).toFixed(1);
/* the splice inputs at x from a payload, as spliceExport builds them (GirderDetail's node grid = the payload stations) */
function payloadSplices(pl) {
  const G = gdNodes(pl), A = G.at, N = G.N, gdq = pl.girderDetail, own = pl.ownerRules || { owner: 'AASHTO' }, owner = own.owner || 'AASHTO';
  const node = k => A.map(a => +a.L[k] || 0), elem = k => A.slice(0, N - 1).map(a => +a.R[k] || 0), has = k => A[0].L[k] !== undefined;
  const arr = { xs: G.xs, MDC1: node('M_DC1'), MDC2: node('M_DC2'), MDW: node('M_DW'), MCL: node('M_CL'), Mp: node('M_LLpos'), Mn: node('M_LLneg'), MfP: node('M_FATpos'), MfN: node('M_FATneg'),
    VDC1: elem('V_DC1'), VDC2: elem('V_DC2'), VDW: elem('V_DW'), VCL: elem('V_CL'), Vp: elem('V_LLpos'), Vn: elem('V_LLneg') };
  if (has('M_UT') || has('M_UF')) { arr.MUT = node('M_UT'); arr.MUF = node('M_UF'); arr.VUT = elem('V_UT'); arr.VUF = elem('V_UF'); }
  const xsF = [...new Set(JSON.stringify(pl.girderDetail).match(/Field splice FS\d+ at [\d.]+ ft/g) || [])].map(s => +s.match(/at ([\d.]+) ft/)[1]).sort((a, b) => a - b);
  const xsU = xsF.filter((v, i) => i === 0 || v !== xsF[i - 1]);
  const lf = { v: 1, m: +(own.llMultiplier || {}).m || 1, eta: +(own.eta || {}).max || 1, etaN: +(own.eta || {}).min || 1, h0: own.haunchInProperties === false };
  const mp = { AASHTO: 0.375, RIDOT: 0.4375, MassDOT: 0.375, CTDOT: 0.5 }[owner] || 0.375;
  // the same without the pedestrian load (the new engine has none yet; as analysis.test.mjs pairsPayload)
  const sub = (a, b) => a.map((v, i) => v - b[i]);
  const noPL = has('M_PLpos') ? { ...arr, Mp: sub(arr.Mp, node('M_PLpos')), Mn: sub(arr.Mn, node('M_PLneg')), Vp: sub(arr.Vp, elem('V_PLpos')), Vn: sub(arr.Vn, elem('V_PLneg')) } : arr;
  return { owner, lf, minPlate: mp, noPL: x => S.demandsAt(noPL, x).dem, withPL: x => S.demandsAt(arr, x).dem, list: xsU.map(x => { const zl = zoneAt(pl, x - 0.01), zr = zoneAt(pl, x + 0.01), sec = z => ({ tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness });
    const dm = S.demandsAt(arr, x), p = clone(S.DEF), mt = gdq.materials, dk = gdq.deck;
    // GD45: the pedestrian part of LL+IM where the payload has it (dem.pl = { key: [part, value] })
    if (has('M_PLpos')) { const i = dm.i, o = {}; const q1 = A[i].L.M_LLpos > 0 ? r1(A[i].L.M_PLpos) : 0, q2 = A[i].L.M_LLneg < 0 ? r1(A[i].L.M_PLneg) : 0; if (q1) o.MLLp = [q1, dm.dem.MLLp]; if (q2) o.MLLn = [q2, dm.dem.MLLn]; if (Object.keys(o).length) dm.dem.pl = o; }
    p.sec = { ...p.sec, D: zl.web.depth, gF: mt.gradeFlange, gW: mt.gradeWeb, L: sec(zl), R: sec(zr), ts: dk.ts, hh: dk.haunch, beff: dk.beff, fc: mt.fc, wc: mt.wc, K1: 1, Ar: dk.Ar, dr: dk.ts / 2 };
    p.dem = dm.dem; return { x, p, i: dm.i }; }) };
}
test('parity with GirderDetail: every field splice of the 100 hand-off payloads, auto-designed (autoDesignSplice) and checked; built-in plates as they are; 8th Edition', () => {
  const t0 = Date.now(); stats.diffs.length = 0; stats.vals = 0; stats.items = 0; stats.worst = { rel: 0, what: '' };
  let nSp = 0, nOk = 0, nFail = 0, nAuto = 0; const fails = {};
  payloads.forEach((f, fi) => {
    const pl = readPayload(f), PS = payloadSplices(pl), tag = f.replace(/^gd_|\.json$/g, '');
    PS.list.forEach(s => { const where = `${tag} FS@${s.x}`; nSp++;
      OWN[PS.owner] = { lf: PS.lf, minPlate: PS.minPlate };
      if (fi % 3 === 0) {   // the auto-design search (about 1,000 trial splices each) on every third payload; the run time of the whole set is 2.5 min
        const { b } = cmpAuto(s.p, PS.owner, where); nAuto++;
        if (b.ok) nOk++; else { nFail++; b.fails.forEach(id => fails[id] = (fails[id] || 0) + 1); }
        cmpSplice({ ...s.p, top: b.p.top, bot: b.p.bot, web: b.p.web }, PS.owner, `${where} designed`); }
      cmpSplice(s.p, PS.owner, `${where} built-in plates`);
      if (fi % 5 === 0) { const q = clone(s.p); q.sec.code = '8'; cmpSplice(q, PS.owner, `${where} 8th Ed.`); }
      });
  });
  report(`${payloads.length} payloads, ${nSp} splices; ${nAuto} auto-designed: ${nOk} pass every check, ${nFail} do not${nFail ? ': ' + JSON.stringify(fails) : ''}`, t0);
  assert.ok(nSp >= 300, `only ${nSp} splices found`);
  assertNoDiff();
});

/* ---------- 3. the app's own path: engine/analysis.js demands at each splice ---------- */
test('the app path: splices of a payload project from engine/analysis.js (girder()): demands against the payload\'s, the designs and checks', () => {
  const t0 = Date.now(), A = W.SBDAnalysis, keys = ['MDC1', 'MDC2', 'MDW', 'MLLp', 'MLLn', 'MCL', 'VDC1', 'VDC2', 'VDW', 'VLL', 'VCL', 'dMp', 'dMn'], big = {}; let n = 0, nPass = 0;
  payloads.filter((f, i) => i === 0 || /xsA_AASHTO_G1|util_MassDOT_G2/.test(f)).forEach(f => {
    const pl = readPayload(f), PS = payloadSplices(pl), P = projectFromPayload(pl);
    P.ownerRules = { owner: PS.owner, eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } }; P.splices = W.SBDModel.defaultSplices(); P.framing = { ...W.SBDModel.defaultFraming(), splices: PS.list.map(s => s.x) };
    const AR = A.analyzeGirder(P, 0); assert.deepEqual([...(AR.errors || [])], [], f);
    const G = S.girder(P, 0, AR, { env: { owner: PS.owner, lf: PS.lf, minPlate: PS.minPlate } });
    assert.deepEqual([...G.errors], [], f);
    G.list.forEach((s, k) => { const ref = PS.withPL(s.x),   // with the pedestrian load: the analysis has it since the sb-ped-owner PR
      scale = { M: Math.max(...keys.filter(q => q[0] === 'M' || q[0] === 'd').map(q => Math.abs(ref[q]))), V: Math.max(...keys.filter(q => q[0] === 'V').map(q => Math.abs(ref[q]))) };
      keys.forEach(q => { const d = Math.abs(s.p.dem[q] - ref[q]), sc = q[0] === 'V' ? scale.V : scale.M, rel = d / Math.max(1, sc); if (!big[q] || rel > big[q].rel) big[q] = { rel, d, ours: s.p.dem[q], ref: ref[q], at: `${f} ${s.name}` }; });
      n++; if (s.CK && !s.CK.some(c => c.status === 'fail')) nPass++;
      assert.ok(s.CK && s.CK.steps.length > 50, 'worked steps'); });
  });
  console.log(`       ${n} splices of 3 payloads, ${nPass} pass every check with this app's demands; ${((Date.now() - t0) / 1000).toFixed(1)} s. Largest demand difference against the payload (relative to the largest M or V at the splice):`);
  Object.entries(big).forEach(([q, b]) => console.log(`         ${q}: ${b.d.toFixed(1)} (${(100 * b.rel).toFixed(2)} %), ${b.ours} vs ${b.ref} at ${b.at}`));
  Object.entries(big).forEach(([q, b]) => assert.ok(b.rel < 0.03, `${q}: ${(100 * b.rel).toFixed(2)} % at ${b.at}`));
});

/* ---------- 4. hand checks ---------- */
test('hand check: the built-in splice (AASHTO LRFD 10th Ed.), values and worked steps', () => {
  const R = S.compute(clone(S.DEF), {}), C = S.checks(R), it = (id, k) => C.find(c => c.id === id).items[k], st = id => C.steps.concat(S.steps(R)).find(q => q.id === id);
  const near = (a, b, t, w) => assert.ok(Math.abs(a - b) <= t, `${w}: ${a} vs ${b}`);
  // Smaller section: left (16 × 3/4 top, 60 × 9/16 web, 16 × 1 1/8 bottom; I smaller than the right side's 18 × 1, 18 × 1 1/4).
  assert.equal(R.smSide, 'L');
  // P_fy top (6.13.6.1.3b): 7/8 in bolts, d_h = 15/16, net hole width d_h + 1/16 = 1.0 in (6.8.3); 2 lines each side of the web = 4 holes.
  //   left 16 × 0.75: A_g = 12.0, A_n = 12.0 − 4(1.0)(0.75) = 9.0; A_e = (0.80 × 70)/(0.95 × 50) × 9.0 = 1.178947 × 9.0 = 10.6105 ≤ 12.0
  //   P_fy = 50 × 10.6105 = 530.53 kip (right 18 × 1: A_n = 14.0, A_e = 16.505, 825.3 kip): 530.53 governs.
  //   (GirderDetail's manual, Part 7 "Built-in example", still quotes 541.6 kip = 50 × 1.179 × 9.19, a net area with d_h only; its code uses d_h + 1/16.)
  near(R.Pfy.top.P, 50 * (0.8 * 70) / (0.95 * 50) * 9.0, 1e-9, 'P_fy top'); near(R.Pfy.top.P, 530.53, 0.01, 'P_fy top');
  //   bottom: left 16 × 1.125: A_n = 18.0 − 4(1.0)(1.125) = 13.5, A_e = 15.9158, P_fy = 795.79 kip (right 18 × 1.25: 1,031.6 kip)
  near(R.Pfy.bot.P, 795.79, 0.01, 'P_fy bottom');
  // Bolt shear (6.13.2.7): φ_sR_n = 0.80(0.56)(0.6013)(120)(2 planes) = 64.652 kip per bolt; top flange 2 × 2 × 3 = 12 bolts per side = 775.82 kip.
  near(R.fl.top.phR1, 0.8 * 0.56 * 0.6013 * 120 * 2, 1e-9, 'φsRn');
  // Filler (6.13.6.1.5), left side, t = 1.0 − 0.75 = 0.25 in: A_f = 0.25 × 16 = 4.0; A_p = min(A_flange 12.0, A_plates 16(0.5) + 2(6.5)(0.625) = 16.125) = 12.0;
  //   γ = 4/12 = 0.3333, R = (1 + γ)/(1 + 2γ) = 1.3333/1.6667 = 0.800; 775.82 × 0.8 = 620.66 kip; TF1 left: 530.53/620.66 = 0.8548.
  near(R.fl.top.sides[0].R, 0.8, 1e-12, 'R'); near(it('TF1', 0).r, 530.5263 / 620.6570, 1e-5, 'TF1 left');
  // Strength I, max negative (Table 3.4.1-1): M = 1.25(−120) + 1.25(−30) + 1.50(−35) + 1.75(−1,250) = −150 − 37.5 − 52.5 − 2,187.5 = −2,427.5 kip-ft.
  near(R.combos[1].M, -2427.5, 1e-9, 'M StrN');
  // M_r negative (C6.13.6.1.3b): top P_fy 530.53 ≤ bottom 795.79, so M_r = 530.53 × (61.5 − 0.5625) = 530.53 × 60.9375 = 32,329 kip-in = 2,694.08 kip-ft
  //   (arm between the flange centroids: 1.125 + 60 + 0.375 = 61.5 and 1.125/2 = 0.5625); MT1: 2,427.5/2,694.08 = 0.9011, no H_w.
  near(R.mNeg.Mr / 12, 2694.08, 0.01, 'Mr neg'); near(it('MT1', 1).r, 2427.5 / 2694.0789, 1e-5, 'MT1');
  // Web (6.10.9.2): D/t_w = 60/0.5625 = 106.67 > 1.40√(Ek/F_yw) = 1.40√(29,000 × 5/50) = 75.39, so C = 1.57/106.67² × (29,000 × 5/50) = 0.40017;
  //   V_p = 0.58(50)(60)(0.5625) = 978.75 kip; V_r = φ_vV_n = 1.0 × 0.40017 × 978.75 = 391.66 kip (6.13.6.1.3c).
  near(R.phVn, 1.57 / (60 / 0.5625) ** 2 * (29000 * 5 / 50) * 978.75, 1e-9, 'V_r'); near(R.phVn, 391.66, 0.01, 'V_r');
  // Web bolt group, 17 rows × 2 columns at 3 in: I_p = 34(1.5²) + 2 × 9 × 2(1² + … + 8²) = 76.5 + 7,344 = 7,420.5 in²; e = 0.5/2 + 1.75 + 1.5 = 3.5 in;
  //   M_t = 391.66 × 3.5 = 1,370.82 kip-in; R_x = 1,370.82 × 24/7,420.5 = 4.434; R_y = 391.66/34 + 1,370.82 × 1.5/7,420.5 = 11.797;
  //   R_u = √(4.434² + 11.797²) = 12.602 kip ≤ φ_sR_n = 64.652; WS1 = 0.1949.
  near(R.web.Ip, 7420.5, 1e-9, 'Ip'); near(R.web.e, 3.5, 1e-12, 'e'); near(R.combos[0].wb.R, 12.602, 0.001, 'R_u'); near(it('WS1', 0).r, 12.6022 / 64.6518, 1e-4, 'WS1');
  // the worked steps carry the same values
  assert.equal(st('sp.top.Pfy').value, R.Pfy.top.P); assert.equal(st('sp.Mr.neg').value, R.mNeg.Mr / 12); assert.equal(st('sp.TF1.0').value, it('TF1', 0).r);
  assert.ok(C.every(c => c.items.every(i => C.steps.some(q => q.id === i.step))), 'every item has its step');
});

test('demandsAt: node nearest the splice, shears the largest of the element and its neighbours (spliceExport)', () => {
  // nodes 0, 10, 20, 30, 40 ft; splice at 23 ft: nearest node 20 (index 2); element containing 23 = element 2 (20–30); shears of elements 1, 2, 3 → max |V|.
  const A = { xs: [0, 10, 20, 30, 40], MDC1: [0, 50, 80, 50, 0], MDC2: [0, 1, 2, 3, 4], MDW: [0, 1, 2, 3, 4], MCL: [0, 0, -3, 0, 0], Mp: [0, 5, 9.96, 5, 0], Mn: [0, -1, -2.04, -1, 0], MfP: [0, 0, 7, 0, 0], MfN: [0, 0, -6, 0, 0],
    VDC1: [10, -5, 7, -12], VDC2: [1, 2, 3, 4], VDW: [1, 1, 1, 1], VCL: [0, 0, 0, 0], Vp: [3, 4, 5, 6], Vn: [-7, -1, -1, -1] };
  const d = S.demandsAt(A, 23);
  assert.equal(d.i, 2); assert.equal(d.e, 2);
  assert.deepEqual(JSON.parse(JSON.stringify(d.dem)), { MDC1: 80, MDC2: 2, MDW: 2, MLLp: 10, MLLn: -2, MCL: -3, VDC1: 12, VDC2: 4, VDW: 1, VLL: 6, VCL: 0, dMp: 7, dMn: 6 });
  // at 5 ft: element 0 (neighbours −1 dropped, 0 and 1): V_DC1 = max(10, 5) = 10, V_LL = max(3, 4, 7, 1) = 7
  const e = S.demandsAt(A, 5).dem; assert.equal(e.VDC1, 10); assert.equal(e.VLL, 7);
});

/* ---------- SB2-AD8 (B4, 2026-11-01): auto-design end distances = DT4's e_min (owner edge distance) ---------- */
test('AD8: CTDOT auto-designed splice takes the owner\'s 2 in end distances and passes DT4; other owners keep 1.75 in', () => {
  // Built-in splice, 7/8 in bolts, sheared/cut edge 'cut': Table 6.13.2.6.6-1 e_min = 1.125 in; CTDOT V2 6.13.6.1 edge 2 in -> e_min = max(1.125, 2) = 2.00 in.
  // Entered e_f = e_p = e_w = e_wp = 1.75 in < 2.00 -> set to 2.00 (CTDOT); AASHTO / RIDOT / MassDOT: e_min = 1.125 ≤ 1.75 -> kept.
  // the built-in splice with 20 in flanges (16 in is too narrow for 2 gage lines with CTDOT's 2 in edge distance: DT10, "not changed")
  const G = gd(), P0 = clone(S.DEF); ['L', 'R'].forEach(k => { P0.sec[k].topB = 20; P0.sec[k].botB = 20; });
  const narrow = S.autoDesign(clone(S.DEF), envOf('CTDOT')); assert.match(narrow.msg, /was not changed/); assert.equal(+narrow.p.top.ef, 1.75);
  for (const owner of Object.keys(OWN)) {
    const b = S.autoDesign(clone(P0), envOf(owner)), R = S.compute(b.p, envOf(owner)), C = S.checks(R, { steps: false }), dt4 = C.find(c => c.id === 'DT4');
    const want = owner === 'CTDOT' ? 2 : 1.75;
    for (const k of ['top', 'bot']) { assert.equal(+b.p[k].ef, want, `${owner} ${k} ef`); assert.equal(+b.p[k].ep, want, `${owner} ${k} ep`); }
    assert.equal(+b.p.web.ew, want); assert.equal(+b.p.web.ewp, want);
    assert.equal(R.emin, owner === 'CTDOT' ? 2 : 1.125);
    assert.ok(dt4.items.every(i => i.st === 'pass'), `${owner} DT4: ${dt4.items.map(i => i.loc + ' ' + i.st).join('; ')}`);
    if (owner === 'CTDOT') {   // before (GirderDetail's autoDesignSplice on the same input): DT4 fails at 1.75 < 2.00
      const a = G.auto(clone(P0), owner); assert.ok(a.r.fails.includes('DT4'), 'GirderDetail CTDOT: DT4 fails (1.75 in < 2 in)'); assert.equal(+a.p.top.ef, 1.75);
    }
  }
});

test('Splices take the project\'s load factors (SPGAM, 2026-11-01): defaults = the old built-in ones; saved splices.gam kept, unused; Fatigue I from the Fatigue & studs input', () => {
  const SP = W.SBDSplices, M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
  const P = M.defaultProject(); assert.equal(JSON.stringify(SP.projGam(P)), JSON.stringify(SP.DEF.gam), 'the project factors = GirderDetail\'s module defaults');
  assert.equal(JSON.stringify(SP.settings(P).gam), JSON.stringify(SP.DEF.gam));
  const Q = J(P); Q.splices.gam = { ...Q.splices.gam, llS: 1.5, fat: 1.5 };   // an old project's saved values
  assert.equal(JSON.stringify(SP.settings(Q).gam), JSON.stringify(SP.DEF.gam), 'saved values not used'); assert.equal(Q.splices.gam.llS, 1.5, 'kept in the project');
  Q.fatigue.gam.fI = 1.6; assert.equal(SP.settings(Q).gam.fat, 1.6);
  Q.splices.gam.llS = -1; assert.ok(!M.validate(Q).errors.some(e => /^splices\.gam/.test(e.path)), 'validate no longer blocks on splices.gam');
});
