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
  const G = gd(), a = G.auto(clone(p), owner), b = S.autoDesign(clone(p), envOf(owner));
  walk(a.p, { top: b.p.top, bot: b.p.bot, web: b.p.web }, `${where} auto`);
  walk({ ok: a.r.ok, fails: a.r.fails.join(',') }, { ok: b.ok, fails: b.fails.join(',') }, `${where} auto`);
  // messages: GirderDetail's mention its own buttons and tabs; the plate and bolt description is compared
  const core = s => String(s).split(/ (?:Widen|Use "|To fix|Why)/)[0].replace(/ \(Preliminary sizing[^)]*\)/g, '');
  if (!/flange is .* wide/.test(a.r.msg) && core(a.r.msg) !== core(b.msg)) stats.diffs.push(`${where} auto msg: ${b.msg}\n         vs GirderDetail ${a.r.msg}`);
  return { a, b };
}
const report = (name, t0) => { console.log(`       ${name}: ${stats.vals} values, ${stats.items} check items compared; largest relative difference ${stats.worst.rel.toExponential(2)}${stats.worst.what ? ' (' + stats.worst.what + ')' : ''}; ${((Date.now() - t0) / 1000).toFixed(1)} s`); };
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
  return { owner, lf, minPlate: mp, list: xsU.map(x => { const zl = zoneAt(pl, x - 0.01), zr = zoneAt(pl, x + 0.01), sec = z => ({ tw: z.web.thickness, topB: z.topFlange.width, topT: z.topFlange.thickness, botB: z.botFlange.width, botT: z.botFlange.thickness });
    const dm = S.demandsAt(arr, x), p = clone(S.DEF), mt = gdq.materials, dk = gdq.deck;
    // GD45: the pedestrian part of LL+IM where the payload has it (dem.pl = { key: [part, value] })
    if (has('M_PLpos')) { const i = dm.i, o = {}; const q1 = A[i].L.M_LLpos > 0 ? r1(A[i].L.M_PLpos) : 0, q2 = A[i].L.M_LLneg < 0 ? r1(A[i].L.M_PLneg) : 0; if (q1) o.MLLp = [q1, dm.dem.MLLp]; if (q2) o.MLLn = [q2, dm.dem.MLLn]; if (Object.keys(o).length) dm.dem.pl = o; }
    p.sec = { ...p.sec, D: zl.web.depth, gF: mt.gradeFlange, gW: mt.gradeWeb, L: sec(zl), R: sec(zr), ts: dk.ts, hh: dk.haunch, beff: dk.beff, fc: mt.fc, wc: mt.wc, K1: 1, Ar: dk.Ar, dr: dk.ts / 2 };
    p.dem = dm.dem; return { x, p, i: dm.i }; }) };
}
test('parity with GirderDetail: every field splice of the 100 hand-off payloads, auto-designed (autoDesignSplice) and checked; built-in plates as they are; 8th Edition', () => {
  const t0 = Date.now(); stats.diffs.length = 0; stats.vals = 0; stats.items = 0; stats.worst = { rel: 0, what: '' };
  let nSp = 0, nOk = 0, nFail = 0; const fails = {};
  payloads.forEach((f, fi) => {
    const pl = readPayload(f), PS = payloadSplices(pl), tag = f.replace(/^gd_|\.json$/g, '');
    W.SBDOwners && null;
    PS.list.forEach(s => { const where = `${tag} FS@${s.x}`; nSp++;
      const env = { owner: PS.owner, lf: PS.lf, minPlate: PS.minPlate }; OWN[PS.owner] = { lf: PS.lf, minPlate: PS.minPlate };
      const { b } = cmpAuto(s.p, PS.owner, where);
      if (b.ok) nOk++; else { nFail++; b.fails.forEach(id => fails[id] = (fails[id] || 0) + 1); }
      cmpSplice({ ...s.p, top: b.p.top, bot: b.p.bot, web: b.p.web }, PS.owner, `${where} designed`);
      cmpSplice(s.p, PS.owner, `${where} built-in plates`);
      if (fi % 5 === 0) { const q = clone(s.p); q.sec.code = '8'; cmpSplice(q, PS.owner, `${where} 8th Ed.`); }
      void env; });
  });
  report(`${payloads.length} payloads, ${nSp} splices (auto-design: ${nOk} pass every check, ${nFail} do not${nFail ? ': ' + JSON.stringify(fails) : ''})`, t0);
  assert.ok(nSp >= 300, `only ${nSp} splices found`);
  assertNoDiff();
});
