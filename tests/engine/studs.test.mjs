// apps/steel-bridge/engine/studs.js against GirderDetail's own Shear connectors module (GM.sc.compute, GM.sc.checks), taken from
// "Steel Bridge Design.html" and run in a Node vm (gd-source.mjs), and against the stud results GirderDetail sends in the hand-off (S2-6).
//
// 1. Inputs tests/projects/sbd2-fat/<project>_<owner>.json (tests/engine/record-fatigue.mjs: P.sc as Preliminary sizing sends it, P.fa
//    for the fatigue settings, P.df.bridge for the owner and the spans): GirderDetail in Node = the browser; this engine = GirderDetail in
//    Node, every zone and region value and every check item (SC1–SC7), with variations (Q_n entered, skew, splices, Fatigue I / II forced,
//    a lane fraction that leaves the traffic inputs incomplete, the owner's haunch rule, small flanges, D < 24 in, input errors).
// 2. The 100 tests/projects/st/gd_*.json payloads: fromPayload() + compute() + checks() = the payload's girderDetail.details.studs.results
//    (GirderDetail's GM.sc on its own inputs, values rounded to 1e-6 in the hand-off): every zone (I, Q, A_slab, limit state, γ, Z_r, n, N,
//    (ΔF)_n, V_fat, V_sr, p_max, ratio, pass) and region (P_c, P_s, P_p, P_n, P, n_req, n_prov, coverage, ratio, pass, SC6).
// 3. The option b_eff per girder (off by default): the difference it makes on the built-in project's five girders (reported).
// 4. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdBlock, gdDecl } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('sections.js'), ENG('owners.js'), ENG('shear.js'), ENG('fatigue.js'), ENG('studs.js'));
const SC = W.SBDStuds, FA = W.SBDFatigue, OW = W.SBDOwners;
const FIX = path.join(ROOT, 'tests/projects/sbd2-fat');
const fixtures = fs.existsSync(FIX) ? fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort().map(f => ({ f, ...JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')) })) : [];
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- GirderDetail in Node ---------- */
const TAG = '\n// studs.test.mjs';
let GD = null;
function run(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
const PRE = ['ES', 'T', 'GD_GR', 'RANK', 'ge', 'worst', 'sum', 'parseDim', 'nm', 'numRows', 'rc', 'ckNew', 'LE', 'GE', 'f0', 'f2', 'f3', 'frac', 'esc', 'STLBL',
  'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnRules', 'gdOwnCite', 'LF_ONE', 'gdLF', 'gdHP', 'modRatio', 'steelProps', 'addPart', 'secSet', 'secTxt',
  'FAT_TH', 'FA_CAT', 'FA_CATS', 'FA_STUD', 'gdFatSet', 'gdFatSup', 'gdFatN', 'gdFatNear', 'gdFatNr', 'gdFatStud', 'gdFatTxt', 'SC_ZSPEC', 'SC_RSPEC'];
function gd() {
  if (GD) return GD;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: {} }, cf: {}, fa: null, sc: null }; var GM = {};', ctx);
  const loaded = new Set();
  PRE.forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  run(ctx, c => vm.runInContext(gdBlock('GM.sc = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.sc)' }), loaded);
  const setP = P => { ctx.P = { fa: P.fa ? clone(P.fa) : undefined, sc: clone(P.sc), cf: clone(P.cf || {}), df: { bridge: clone(P.dfBridge || {}) } }; };
  GD = { ctx, loaded, setP, sc: P => { setP(P); return run(ctx, c => { const R = c.GM.sc.compute(c.P.sc); return { R, C: R.errors.length ? null : c.GM.sc.checks(R) }; }, loaded); } };
  return GD;
}
/* this engine's env from the recorded GirderDetail state (gdOwner, gdLF h0, gdFatSet from P.fa, gdFatSup from P.df.bridge) */
function envOf(P) {
  const b = P.dfBridge || {}, l = b.lf, lf = l && typeof l === 'object' && +l.m > 0 && +l.eta > 0 && +l.etaN > 0 ? l : { h0: false };
  return { owner: OW.LIST.includes(b.owner) ? b.owner : 'AASHTO', lf, fat: { set: FA.settings(P.fa || FA.DEFAULT), B: FA.supports(b) } };
}

/* ---------- comparison ---------- */
const stats = { vals: 0, items: 0, diffs: [], worst: { rel: 0, what: '' } };
function cmp(list, where, tol) {
  for (const [k, a, b] of list) {
    stats.vals++;
    if (Object.is(a, b) || a === b) continue;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) continue;
    const rel = typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) ? Math.abs(a - b) / Math.max(1e-300, Math.abs(b)) : Infinity;
    const abs = typeof a === 'number' && typeof b === 'number' ? Math.abs(a - b) : Infinity;
    if (!tol && rel > stats.worst.rel) stats.worst = { rel, what: `${where} ${k}: ${a} vs ${b}` };
    if (tol ? abs <= tol : rel < 1e-12) continue;
    stats.diffs.push(`${where} ${k}: ${a} vs GirderDetail ${b}`);
  }
}
const ZK = ['name', 'I', 'yb', 'Aslab', 'Q', 'Zr', 'Vfat', 'Vsr', 'preq', 'pmax', 'edge'], FK = ['lim', 'gam', 'Zr', 'eq', 'N', 'dFn', 'nn'], RK = ['name', 'Pc', 'Ps', 'Pp', 'Pnc', 'Pns', 'Pn', 'P', 'nreq', 'nprov', 'cov', 'lost', 'nnet'];
function itemPairs(mine, theirs) {
  const out = [], P = (k, a, b) => out.push([k, a, b]);
  P('check ids', mine.map(c => c.id).join(), theirs.map(c => c.id).join());
  theirs.forEach(c => { const m = mine.find(x => x.id === c.id); if (!m) return;
    P(`${c.id} n`, m.items.length, c.items.length); P(`${c.id} status`, m.status, c.status); P(`${c.id} gov`, m.gov, c.gov); P(`${c.id} na`, !!m.naWhy, !!c.naWhy);
    c.items.forEach((it, i) => { const q = m.items[i] || {}; stats.items++; P(`${c.id}[${i}] loc`, q.loc, it.loc); P(`${c.id}[${i}] st`, q.st, it.st); if (it.r != null || q.r != null) P(`${c.id}[${i}] r`, q.r ?? null, it.r ?? null); }); });
  return out;
}
function cmpSc(m, g, where) {
  if (g.errors.length || m.errors.length) { cmp([['errors', JSON.stringify([...m.errors]), JSON.stringify([...g.errors])]], where); return; }
  cmp(['Asc', 'QnE', 'Qn', 'Qr', 'Zr', 'Ffat', 'gf', 'h', 'st', 'tdeck'].map(k => [k, m[k], g[k]]).concat([['n', m.dk.n, g.dk.n], ['gaps', JSON.stringify(m.gaps), JSON.stringify(g.gaps)]]), where);
  g.zones.forEach((z, i) => cmp(ZK.map(k => [k, m.zones[i][k], z[k]]).concat(FK.map(k => [`fat.${k}`, m.zones[i].fat[k], z.fat[k]])), `${where} zone ${i}`));
  g.regions.forEach((r, i) => cmp(RK.map(k => [k, m.regions[i][k], r[k]]), `${where} region ${i}`));
}
const browserItems = CK => CK.map(c => [c.id, c.items.map(it => [it.loc, it.r ?? null, it.st]), c.naWhy || '']);

function scVariants(P) {
  const v = [], base = () => clone(P.sc);
  { const p = base(); p.Qn10 = 22.5; p.skew = 'yes'; p.Frc = 30; p.wv = 40; v.push(['Q_n entered, skewed', { ...P, sc: p }]); }
  { const p = base(); p.splX = ''; v.push(['no splices', { ...P, sc: p }]); }
  { const p = base(); p.splX = '50; 180 300'; p.splL = 3; p.splC = 6; v.push(['other splices', { ...P, sc: p }]); }
  { const fa = clone(P.fa); fa.limit = 'I'; v.push(['Fatigue I forced', { ...P, fa }]); }
  { const fa = clone(P.fa); fa.limit = 'II'; fa.gam.fII = 0.75; v.push(['Fatigue II forced', { ...P, fa }]); }
  { const fa = clone(P.fa); fa.ADTT = 20000; fa.p = 0.8; v.push(['high ADTT (Fatigue I by ADTT)', { ...P, fa }]); }
  { const fa = clone(P.fa); fa.p = 1.5; v.push(['traffic inputs incomplete', { ...P, fa }]); }
  { const b = clone(P.dfBridge || {}); b.lf = { ...(b.lf || {}), v: 1, m: 1, eta: 1, etaN: 1, h0: true }; v.push(['haunch 0 in properties', { ...P, dfBridge: b }]); }
  { const b = clone(P.dfBridge || {}); delete b.spans; v.push(['no bridge spans', { ...P, dfBridge: b }]); }
  { const p = base(); p.zones.forEach((z, i) => { z.topB = 12; z.nr = 3; z.p = i % 3 ? 3 : 30; if (i % 4 === 0) z.D = 20; }); p.st = 3; p.h = 4; p.hh = 3; p.d = '0.75'; v.push(['small flanges, D < 24, short studs', { ...P, sc: p }]); }
  { const p = base(); p.zones[0].x2 = p.zones[0].x1; p.zones[1].nr = 2.5; p.wv = 0; v.push(['input errors', { ...P, sc: p }]); }
  return v;
}

test('parity with GirderDetail Shear connectors (SC1–SC7) on the recorded inputs of the gd_* projects and variations', () => {
  if (!fixtures.length) { console.log('       (no tests/projects/sbd2-fat fixtures: run node tests/engine/record-fatigue.mjs)'); return; }
  const G = gd(), cases = [];
  for (const fx of fixtures) { const w = fx.f.replace(/\.json$/, ''); cases.push([w, fx.P, fx]); scVariants(fx.P).forEach(([nm, P]) => cases.push([`${w} [${nm}]`, P, null])); }
  for (const o of ['AASHTO', 'RIDOT']) cases.push([`built-in ${o}`, { sc: clone(G.ctx.GM.sc.def), fa: clone(FA.DEFAULT), dfBridge: { owner: o } }, null]);   // FA.DEFAULT = GM.fa.def (fatigue.test.mjs)
  cases.forEach(([, P]) => G.sc(P));   // warm-up (gd-source.mjs)
  let nodeB = 0, nodeDiff = 0, nZ = 0, nR = 0;
  for (const [where, P, fx] of cases) {
    const g = G.sc(P), E = envOf(P);
    if (fx && fx.gd.sc.zones) {
      const nb = (a, b, w) => { nodeB++; if (!(Object.is(a, b) || a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b))))) { nodeDiff++; if (nodeDiff < 5) console.log(`       Node vs browser ${w}: ${a} vs ${b}`); } };
      g.R.zones.forEach((z, i) => { const b = fx.gd.sc.zones[i]; nb(z.fat.lim, b.lim, `${where} z${i} lim`); ['I', 'Q', 'Zr', 'Vsr', 'preq', 'edge'].forEach(k => nb(z[k], b[k], `${where} z${i} ${k}`)); });
      g.R.regions.forEach((r, i) => { const b = fx.gd.sc.regions[i]; ['P', 'nreq', 'nprov', 'lost', 'nnet'].forEach(k => nb(r[k], b[k], `${where} r${i} ${k}`)); });
      browserItems(g.C).forEach(([id, its], j) => its.forEach((it, i) => { nb(it[1], fx.gd.sc.checks[j][1][i][1], `${where} ${id} ${i}`); nb(it[2], fx.gd.sc.checks[j][1][i][2], `${where} ${id} ${i} st`); }));
    }
    const m = SC.compute(clone(P.sc), E); cmpSc(m, g.R, where); if (!m.errors.length && g.C) cmp(itemPairs(SC.checks(m), g.C), where + ' checks');
    if (!m.errors.length) { nZ += m.zones.length; nR += m.regions.length;
      const ids = new Set(SC.steps(m).map(s => s.id)); SC.checks(m).forEach(c => c.items.forEach(it => assert.ok(!it.step || ids.has(it.step), `${where}: step ${it.step}`))); }
  }
  assert.equal(JSON.stringify(SC.DEFAULT), JSON.stringify(G.ctx.GM.sc.def), 'DEFAULT = GM.sc.def');
  console.log(`       ${fixtures.length} recorded inputs + ${cases.length - fixtures.length} variations and built-in cases: ${nZ} zones, ${nR} regions; ${stats.vals} values, ${stats.items} check items; Node = browser on ${nodeB} values (${nodeDiff} differ); largest relative difference ${stats.worst.rel.toExponential(2)}${stats.worst.what ? ' (' + stats.worst.what + ')' : ''}`);
  assert.equal(nodeDiff, 0, 'GirderDetail in Node differs from the browser');
  assert.deepEqual(stats.diffs.slice(0, 20), [], `${stats.diffs.length} differences`);
});

/* ---------- the hand-off payloads ---------- */
const DIR = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(DIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
const r6 = x => (typeof x === 'number' && isFinite(x) ? Math.round(x * 1e6) / 1e6 : null);
test('fromPayload: this engine on the 100 gd_* payloads = the stud results GirderDetail sends (S2-6), to the hand-off rounding (1e-6)', () => {
  let nP = 0, nZ = 0, nR = 0, worst = { abs: 0, what: '' }; const diffs = [];
  const T = (k, a, b, w) => { if (a === b) return; if (typeof a === 'number' && typeof b === 'number') { const d = Math.abs(a - b); if (d > worst.abs) worst = { abs: d, what: `${w} ${k}: ${a} vs ${b}` }; if (d <= 1.5e-6 * Math.max(1, Math.abs(b) / 1e3)) return; } diffs.push(`${w} ${k}: ${a} vs ${b}`); };
  for (const f of payloads) {
    const pl = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload, q = pl.girderDetail.details.studs.results, d = SC.fromPayload(pl);
    assert.ok(d, `${f}: no stud results`); nP++;
    const R = SC.compute(d.p, d.env); assert.deepEqual([...R.errors], [], f); const C = SC.checks(R), c1 = C.find(c => c.id === 'SC1'), c2 = C.find(c => c.id === 'SC2'), i6 = C.find(c => c.id === 'SC6').items.slice(R.gaps.length);
    [['Asc', R.Asc], ['QnE', R.QnE], ['Qn', R.Qn], ['phiSc', R.phiSc], ['Qr', R.Qr], ['ZrI', R.Zr], ['gamI', R.gf], ['Ffat', R.Ffat], ['n', R.MR.n], ['fc', R.fc], ['beff', R.dk.beff], ['ts', R.dk.ts]].forEach(([k, v]) => T(k, r6(v), q[k], f));
    R.zones.forEach((z, i) => { nZ++; const o = q.zones[i], w = `${f} zone ${i}`, it = c1.items[i];
      [['I', z.I], ['Q', z.Q], ['Aslab', z.Aslab], ['gam', z.fat.gam], ['Zr', z.Zr], ['nn', z.fat.nn], ['N', z.fat.N], ['dFn', z.fat.dFn], ['Vfat', z.Vfat], ['Vsr', z.Vsr], ['preq', z.preq], ['r', it.r]].forEach(([k, v]) => T(k, r6(v), o[k], w));
      T('lim', z.fat.lim, o.lim, w); T('ok', it.st === 'pass', o.ok, w); });
    let k6 = 0;
    R.regions.forEach((r, i) => { nR++; const o = q.regions[i], w = `${f} region ${i}`, it = c2.items[i];
      [['Pc', r.Pc], ['Ps', r.Ps], ['Pp', r.Pp], ['Pn', r.Pn], ['P', r.P], ['nreq', r.nreq], ['nprov', r.nprov], ['cov', r.cov], ['r', it.r]].forEach(([k, v]) => T(k, r6(v), o[k], w));
      if (r.kind === 'pier') { T('Pnc', r6(r.Pnc), o.Pnc, w); T('Pns', r6(r.Pns), o.Pns, w); }
      T('ok', it.st === 'pass', o.ok, w);
      if (r.lost > 0) { const j = i6[k6++] || {}; T('lost', r.lost, o.lost, w); T('nnet', r.nnet, o.nnet, w); T('r6', r6(j.r), o.r6, w); T('ok6', j.st === 'pass', o.ok6, w); } else T('lost', undefined, o.lost, w); });
    T('gaps', JSON.stringify(R.gaps.map(g => [r6(g.x), r6(g.a), r6(g.b)])), JSON.stringify(q.gaps.map(g => [g.x, g.a, g.b])), f);
  }
  console.log(`       ${nP} payloads, ${nZ} zones, ${nR} regions: ${diffs.length} differ; largest absolute difference ${worst.abs.toExponential(2)}${worst.what ? ' (' + worst.what + ')' : ''}`);
  assert.deepEqual(diffs.slice(0, 20), []);
});

test('option b_eff per girder (off by default): the difference on the built-in project (reported, not adopted)', () => {
  const rows = [];
  for (const f of payloads.filter(f => /^gd_builtin_AASHTO_G\d\.json$/.test(f))) {
    const pl = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload, a = SC.fromPayload(pl), b = SC.fromPayload(pl, { beffMode: 'girder' });
    const A = SC.compute(a.p, a.env), B = SC.compute(b.p, b.env), cA = SC.checks(A), cB = SC.checks(B), mx = (C, id) => Math.max(...C.find(c => c.id === id).items.map(i => i.r));
    rows.push({ g: pl.girderDetail.label, pos: pl.girderDetail.position, beffBridge: A.dk.beff, beffGirder: B.dk.beff, sc1: [mx(cA, 'SC1'), mx(cB, 'SC1')], sc2: [mx(cA, 'SC2'), mx(cB, 'SC2')],
      dPreq: Math.max(...A.zones.map((z, i) => Math.abs(B.zones[i].preq / z.preq - 1))), fails: [cA, cB].map(C => C.filter(c => c.id === 'SC1' || c.id === 'SC2').reduce((s, c) => s + c.items.filter(i => i.st === 'fail').length, 0)) });
  }
  rows.forEach(o => console.log(`       ${o.g} (${o.pos}): b_eff ${o.beffBridge} → ${o.beffGirder} in; max SC1 ${o.sc1[0].toFixed(4)} → ${o.sc1[1].toFixed(4)}; max SC2 ${o.sc2[0].toFixed(4)} → ${o.sc2[1].toFixed(4)}; largest change of p_max ${(100 * o.dPreq).toFixed(2)}%; SC1/SC2 failures ${o.fails[0]} → ${o.fails[1]}`));
  assert.equal(rows.length, 5);
  assert.ok(rows.every(o => o.beffBridge === rows[0].beffBridge), 'one bridge-wide b_eff by default');
});

test('hand checks: SC1 fatigue pitch and SC2 strength count (GirderDetail built-in inputs)', () => {
  const R = SC.compute(clone(SC.DEFAULT), { fat: { set: FA.settings(FA.DEFAULT), B: null } }), z = R.zones[0], r = R.regions[0];
  // Studs 7/8 in: A_sc = π(0.875²)/4 = 0.60132 in²; Q_n = 0.70(0.60132)(60) = 25.255 kip; Q_r = 1.00 Q_n; Z_r (Fatigue I) = 7.0(0.60132) = 4.2092 kip.
  assert.ok(Math.abs(R.Asc - 0.601320) < 1e-6); assert.ok(Math.abs(R.Qr - 25.2555) < 1e-4, String(R.Qr)); assert.ok(Math.abs(R.Zr - 4.20924) < 1e-5);
  // f′c = 4, w_c = 0.150: E_c = 120,000(1)(0.0225)(4^0.33) = 2700(1.580083) = 4266.2 ksi; n = 29,000/4266.2 = 6.7976.
  assert.ok(Math.abs(R.MR.Ec - 4266.2) < 0.1, String(R.MR.Ec)); assert.ok(Math.abs(R.dk.n - 6.7976) < 1e-4, String(R.dk.n));
  // Zone 1: plates 16 × 3/4, 60 × 9/16, 16 × 1 1/8 (d = 61.875 in); steel A = 18 + 33.75 + 12 = 63.75 in², ȳ_s = (18(0.5625) + 33.75(31.125) + 12(61.5))/63.75 = 28.209 in.
  // Slab: b_eff t_s/n = 114(8)/6.7976 = 134.17 in² at y_slab = 61.875 + 2 + 4 = 67.875 in.
  // The traffic of GM.fa.def (ADTT_SL 1700, n = 1 with no bridge and no pier region): Fatigue II for studs (1700 < 11,322), Z_r = 2.8116 kip, γ = 0.80.
  assert.ok(Math.abs(z.Aslab - 114 * 8 / R.dk.n) < 1e-9); assert.ok(Math.abs(z.ySlab - 67.875) < 1e-12); assert.equal(z.fat.lim, 'II'); assert.ok(Math.abs(z.Zr - 2.8116) < 1e-4);
  // V_fat = γV_fQ/I = 0.80(38)Q/I; V_sr = V_fat (straight, F_fat = 0); p_max = 3 Z_r / V_sr. Check the chain on the section values:
  assert.ok(Math.abs(z.Vfat - 0.8 * 38 * z.Q / z.I) < 1e-15); assert.equal(z.Vsr, z.Vfat); assert.ok(Math.abs(z.preq - 3 * z.Zr / z.Vsr) < 1e-12);
  // Region 1 (Abut. 1 to max. positive, 0–44 ft): P_c = 0.85(4)(114)(8) = 3100.8 kip; P_s = 50(60)(0.5625) + 50(16(0.75) + 16(1.125)) = 1687.5 + 1500 = 3187.5 kip;
  // P = P_p = 3100.8 kip; n = 3100.8/25.2555 = 122.78. Provided: zone 1, 22 ft at 9 in × 3 = 3⌊264/9⌋ = 3(29) = 87; zone 2, 22 ft at 12 in × 3 = 3(22) = 66: 153 ≥ 122.78.
  assert.ok(Math.abs(r.Pc - 3100.8) < 1e-9); assert.ok(Math.abs(r.Ps - 3187.5) < 1e-9); assert.ok(Math.abs(r.P - 3100.8) < 1e-9);
  assert.ok(Math.abs(r.nreq - 122.78) < 0.01, String(r.nreq)); assert.equal(r.nprov, 153);
  const s = SC.steps(R).find(o => o.id === 'scr0.Pc'); assert.equal(W.SharedSteps.line(s, false), 'P_(1p) = 0.85f′_cb_(eff)t_s = 0.85(4.00)(114.00)(8.00) = 3100.8 kip');
});
