// apps/steel-bridge/engine/shear.js against GirderDetail's own shear: webShear, A610_shearC / A610_Vp, Preliminary sizing's tsVn, and the
// shear lines of the Girder section module (GM.gs.compute: V_u, V_u of the web panel, deck placement V_u, r.sh, the special fatigue V_u)
// with its checks GS11 (6.10.9), GS16 (6.10.3.3) and GS18 (6.10.5.3), run in Node from "Steel Bridge Design.html" (gd-source.mjs).
//
// 1. GirderDetail's Girder section rows as Preliminary sizing sends them (tests/projects/sbd2-stiff, recorded by record-stiffeners.mjs:
//    every project and owner, uniform and per-bay stiffeners, with the web panel shears), GirderDetail in Node = the browser, then this
//    engine = GirderDetail (owner load rules included).
// 2. Every station of the 100 tests/projects/st/gd_*.json payloads (fromPayload: d_o from the payload's stiffener spacing, end panels within
//    d_o of an abutment), as GirderDetail rows, run through GM.gs.compute (AASHTO base) and GM.gs.checks: identical; and the same stations
//    unstiffened (d_o = 0), at d_o = 1.5D, 3D and 3.2D, and with the end panel turned off (an interior panel at an abutment: tension field).
// 3. tsVn = webShear (tension field on), and = GirderDetail's tsVn, on every recorded panel.
// 4. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import vm from 'node:vm';
import { gdBlock, gdDecl } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('owners.js'), ENG('shear.js'), ENG('stiffeners.js'));
const SH = W.SBDShear, OW = W.SBDOwners;
const FIX = path.join(ROOT, 'tests/projects/sbd2-stiff'), ST = path.join(ROOT, 'tests/projects/st');
const fixtures = fs.existsSync(FIX) ? fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort().map(f => ({ f, ...JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')) })) : [];
const payloads = fs.readdirSync(ST).filter(f => /^gd_.*\.json$/.test(f)).sort();
const clone = o => JSON.parse(JSON.stringify(o));
const nm = v => typeof v === 'number' ? v : Number(v);

/* GirderDetail's Girder section module in its own vm context (as gd-source.mjs gdGirderSection, with every declaration the owner paths
   read loaded BEFORE the first call, and tagged: V8 does not let code it has already optimized see a const added to the context later,
   nor reuse code compiled in another test's context; see gd-source.mjs and loads.test.mjs) */
const TAG = '\n// shear.test.mjs';
let GSX = null;
function gdRun(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
function gdGirderSection() {
  if (GSX) return GSX;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext("var P = { df: { bridge: {} }, fa: { limit: 'auto', ADTT: 1000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } }, cf: {} }; var GM = {};", ctx);
  const loaded = new Set();
  ['ES', 'T', 'GD_GR', 'RANK', 'ge', 'worst', 'parseDim', 'nm', 'numRows', 'rc', 'ckNew', 'LE', 'GE', 'f0', 'f2', 'f3', 'frac', 'esc', 'A610_shearC', 'A610_Vp', 'webShear', 'PHI',
    'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnRules', 'gdOwnCite', 'LF_ONE', 'gdLF', 'OWN_K', 'gdOwnM', 'gdWsSt', 'gdPLq', 'gdPLe', 'gdGovML', 'gdUt', 'gdUtOn', 'gdHP', 'gdGLt']
    .forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  gdRun(ctx, c => vm.runInContext(gdBlock('GM.gs = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.gs)' }), loaded);
  GSX = { ctx, loaded, compute: (p, opt) => gdRun(ctx, c => c.GM.gs.compute(p, opt), loaded), fn: name => gdRun(ctx, c => vm.runInContext(name, c), loaded) };
  // warm-up: every path used below, before the comparisons (the recorded rows with their owners, then AASHTO base)
  const def = () => JSON.parse(JSON.stringify(ctx.GM.gs.def));
  fixtures.forEach(fx => { const s = ctx.P; ctx.P = { ...s, df: { bridge: clone(fx.P.dfBridge || {}) }, fa: clone(fx.P.fa), cf: clone(fx.P.cf || {}) }; try { const R = GSX.compute(clone(fx.P.gs)); if (!R.errors.length) gdRun(ctx, c => c.GM.gs.checks(R), loaded); } finally { ctx.P = s; } });
  [{}, { gT: 'HPS70W', gB: 'HPS70W' }].forEach(o => { const R = GSX.compute({ ...def(), ...o }, { base: true }); gdRun(ctx, c => c.GM.gs.checks(R), loaded); });
  return GSX;
}
/* Preliminary sizing's tsVn (stored in the page as the text of pl-src): its declaration from the whole file */
function plTsVn(GS) {
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8'), a = html.indexOf('\nfunction tsVn('), lines = html.slice(a + 1).split('\n'), out = [lines[0]];
  for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (L === '' || /^[\s})\]]/.test(L)) out.push(L); else break; }
  vm.runInContext(out.join('\n') + '\nthis.__tsVn = tsVn;' + TAG, GS.ctx, { filename: 'Steel Bridge Design.html (pl-src tsVn)' });
  return GS.ctx.__tsVn;
}

const stats = { vals: 0, diffs: [], worst: { rel: 0, what: '' } };
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
const SHK = ['k', 'C', 'Vp', 'Vn', 'Vcr', 'stiff', 'eqn', 'rat', 'lam'];
/* a GirderDetail Girder section row -> a location of this engine */
const utv = (u, k) => { const v = u && u.ut && typeof u.ut === 'object' ? +u.ut[k] : 0; return isFinite(v) ? v : 0; };
function locOf(r) {
  return { name: r.name, x: r.x, plates: { D: nm(r.D), tw: nm(r.tw), topB: nm(r.topB), topT: nm(r.topT), botB: nm(r.botB), botT: nm(r.botT) }, do: nm(r.do), end: r.end === 'yes',
    V: { DC1: nm(r.VDC1), DC2: nm(r.VDC2), DW: nm(r.VDW), LL: nm(r.VLL), UT: utv(r, 'VUT'), UF: utv(r, 'VUF'), CL: nm(r.VCL), f: nm(r.Vf) },
    Vpan: r.VDC1p != null && r.VDC1p !== '' ? { DC1: nm(r.VDC1p), DC2: nm(r.VDC2p), DW: nm(r.VDWp), LL: nm(r.VLLp), UT: utv(r, 'VUTp'), UF: utv(r, 'VUFp') } : null, pl: r.pl };
}
/* compare one GirderDetail compute result + checks against this engine's locations */
function cmpRows(R, CK, mine, where) {
  R.rows.forEach((r, i) => { const o = mine[i], L = [['Vu', o.Vu, r.Vu], ['VuP', o.VuP, r.VuP == null ? null : r.VuP], ['VuF', o.VuF, r.VuF], ['VuC', o.VuC, r.VuC]]; SHK.forEach(k => L.push(['sh.' + k, o.sh[k], r.sh[k]])); cmp(L, `${where} ${r.name}`); });
  ['GS11', 'GS16', 'GS18'].forEach(id => { const c = CK.find(q => q.id === id); const rowsIn = id === 'GS18' ? mine.filter(o => o.sh.stiff && !o.end) : mine;
    cmp([[`${id} n`, rowsIn.length, c.items.length]], where);
    c.items.forEach((it, i) => { const o = rowsIn[i], q = o && o.checks.find(x => x.id === id); if (!q) { stats.diffs.push(`${where} ${id} item ${i} missing`); return; }
      cmp([[`${id} ${o.name} r`, q.ratio, it.r], [`${id} ${o.name} st`, q.ok ? 'pass' : 'fail', it.st]], where); }); });
}
function gdFactors(p, lf, base) {
  const e = base ? 1 : lf.eta, eN = base ? 1 : lf.etaN, m = base ? 1 : lf.m, g = k => nm(p.gam[k]);
  return { dc: g('dc') * e, dw: g('dw') * e, dcMin: g('dcMin') * eN, dwMin: g('dwMin') * eN, ll: g('ll') * e * m, fat: g('fat'), cdc: g('cdc'), ccl: g('ccl'), m };
}
const GR = { '36': 36, '50': 50, '50W': 50, HPS50W: 50, HPS70W: 70 };

test('parity with GirderDetail Girder section shear (GS11, GS16, GS18) on the rows Preliminary sizing sends (recorded, every owner, uniform and per-bay)', () => {
  if (!fixtures.length) { console.log('       (no tests/projects/sbd2-stiff fixtures)'); return; }
  const GS = gdGirderSection(); ['f0', 'f2', 'f3', 'frac', 'esc'].forEach(k => GS.fn(k));
  let nRows = 0, nodeDiff = 0;
  for (const fx of fixtures) {
    const where = fx.f.replace(/\.json$/, ''), b = fx.P.dfBridge || {}, l = b.lf, lf = l && +l.m > 0 && +l.eta > 0 && +l.etaN > 0 ? l : { m: 1, eta: 1, etaN: 1 };
    const saveP = GS.ctx.P; GS.ctx.P = { ...saveP, df: { bridge: clone(b) }, fa: clone(fx.P.fa), cf: clone(fx.P.cf || {}) };
    try {
      const R = gdRun(GS.ctx, c => c.GM.gs.compute(clone(fx.P.gs)), GS.loaded); assert.deepEqual([...R.errors], [], where);
      const CK = Array.from(gdRun(GS.ctx, c => c.GM.gs.checks(R), GS.loaded));
      // Node = browser
      R.rows.forEach((r, i) => { const q = fx.gd.gs.rows[i]; [['Vu', r.Vu, q.Vu], ['VuP', r.VuP, q.VuP], ['VuF', r.VuF, q.VuF], ['VuC', r.VuC, q.VuC], ['Vn', r.sh.Vn, q.sh[3]]].forEach(([k, a, c]) => { if (!(a === c || Math.abs(a - c) <= 1e-12 * Math.abs(c))) { nodeDiff++; console.log(`       Node vs browser ${where} ${i} ${k}: ${a} vs ${c}`); } }); });
      const prj = { mat: { Fyw: GR[fx.P.gs.gW] }, G: gdFactors(fx.P.gs, lf, false) }, mine = fx.P.gs.rows.map(r => SH.location(locOf(r), prj));
      cmpRows(R, CK, mine, where); nRows += R.rows.length;
      mine.forEach(o => { const ids = new Set(o.steps.map(s => s.id)); o.checks.forEach(c => assert.ok(ids.has(c.step), `${where} missing step ${c.step}`)); });
    } finally { GS.ctx.P = saveP; }
  }
  console.log(`       ${fixtures.length} recorded inputs, ${nRows} rows; Node = browser (${nodeDiff} differ); ${stats.vals} values; largest relative difference ${stats.worst.rel.toExponential(2)}`);
  assert.equal(nodeDiff, 0); assert.deepEqual(stats.diffs.slice(0, 20), [], `${stats.diffs.length} differences`);
});

test('parity with GirderDetail Girder section shear at every station of the 100 gd_*.json payloads (and d_o variations)', () => {
  const GS = gdGirderSection(), d0 = GS.ctx.GM.gs.def; ['f0', 'f2', 'f3', 'frac', 'esc'].forEach(k => GS.fn(k));
  const t0 = Date.now(); let nLoc = 0, nCase = 0; const s0 = stats.diffs.length;
  for (const f of payloads) {
    const pl = JSON.parse(fs.readFileSync(path.join(ST, f), 'utf8')).payload, F = SH.fromPayload(pl), D = F.locs[0].plates.D;
    const vars = [['', l => l], ['unstiffened', l => ({ ...l, do: 0, end: false })], ['1.5D', l => ({ ...l, do: 1.5 * D })], ['3D, no end', l => ({ ...l, do: 3 * D, end: false })], ['3.2D', l => ({ ...l, do: 3.2 * D })]];
    for (const [vn, fn] of (f.endsWith('_G1.json') ? vars : vars.slice(0, 1))) {
      const locs = F.locs.map(fn), rows = locs.map((L, i) => ({ ...clone(d0.rows[0]), name: L.name, region: 'pos', cont: 'yes', ...L.plates, beff: 96, MDC1: 0, MDC2: 0, MDW: 0, MLLp: 0, MLLn: 0, MCL: 0, MfP: 0, MfN: 0,
        VDC1: L.V.DC1, VDC2: L.V.DC2, VDW: L.V.DW, VLL: L.V.LL, VCL: L.V.CL, Vf: L.V.f, do: L.do, end: L.end ? 'yes' : 'no', ...(L.V.UT || L.V.UF ? { ut: { VUT: L.V.UT, VUF: L.V.UF } } : {}), i }));
      const p = { ...clone(d0), gW: GR[String(pl.girderDetail.materials.Fyw)] ? String(pl.girderDetail.materials.Fyw) : '50', rows };
      const R = GS.compute(p, { base: true }); assert.deepEqual([...R.errors], [], f);
      const CK = Array.from(gdRun(GS.ctx, c => c.GM.gs.checks(R), GS.loaded));
      const prj = { ...F.prj, G: gdFactors(d0, null, true) }, mine = locs.map(L => SH.location(L, prj));
      cmpRows(R, CK, mine, `${f} ${vn}`); nLoc += locs.length; nCase++;
    }
  }
  { // GirderDetail's built-in Girder section rows, as is
    const p = clone(d0), R = GS.compute(clone(p), { base: true }), CK = Array.from(gdRun(GS.ctx, c => c.GM.gs.checks(R), GS.loaded));
    const mine = p.rows.map(r => SH.location(locOf(r), { mat: { Fyw: GR[p.gW] }, G: gdFactors(p, null, true) })); cmpRows(R, CK, mine, 'built-in'); nLoc += mine.length; nCase++; }
  console.log(`       ${payloads.length} payloads + the built-in rows, ${nCase} cases, ${nLoc} locations; ${stats.diffs.length - s0} differ; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  assert.deepEqual(stats.diffs.slice(s0, s0 + 20), []);
});

test('tsVn = webShear and = Preliminary sizing tsVn on every recorded panel; panels() runs', () => {
  const GS = gdGirderSection(), tsVnGD = plTsVn(GS); let n = 0; const diffs = [];
  for (const fx of fixtures.filter(x => x.project === 'builtin' || x.project === 'xsA')) {
    const D = fx.layout.D;
    fx.layout.girders.forEach(g => g.panels.forEach(pn => [0.4375, 0.5625, 0.75].forEach(tw => [1.0, 2.7].forEach(rat => {
      n++; const a = SH.tsVn(D, tw, 50, pn.d, pn.end, rat, true), b = tsVnGD(D, tw, 50, pn.d, pn.end, rat, true), w = SH.webShear(D, tw, 50, pn.d, 2 * D * tw / rat, pn.end);
      if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push(`tsVn ${pn.p}-${pn.q}`);
      if (Math.abs(a.Vn - w.Vn) > 1e-9 * w.Vn || a.eq !== w.eqn) diffs.push(`webShear ${pn.p}-${pn.q} ${a.Vn} ${w.Vn}`);
      const c = tsVnGD(D, tw, 50, pn.d, pn.end, rat, false), d = SH.tsVn(D, tw, 50, pn.d, pn.end, rat, false); if (JSON.stringify(c) !== JSON.stringify(d)) diffs.push(`tsVn no tfa ${pn.p}`); }))));
  }
  console.log(`       ${n} panel cases: ${diffs.length} differ`);
  assert.deepEqual(diffs.slice(0, 10), []);
  // panels() on a payload with the built-in layout
  const pl = JSON.parse(fs.readFileSync(path.join(ST, payloads[0]), 'utf8')).payload, dem = SH.demands(pl), sup = pl.member.supports, ST_ = W.SBDStiffeners;
  const bays = ST_.girderBays({ web: 'stiffened', mode: 'uniform', doRatio: 1 }, 60, sup, true, sup, ST_.framesDefault(sup, 25), 1), pans = bays.flatMap(ST_.bayPanels);
  const twAt = (p, q) => Math.min(dem.zAt(p + 1e-6).tw, dem.zAt(q - 1e-6).tw), rat = (p, q) => Math.max(...[p + 1e-6, q - 1e-6].map(x => { const s = dem.zAt(x); return 2 * s.D * s.tw / (s.topB * s.topT + s.botB * s.botT); }));
  const P = SH.panels(pans, { D: 60, Fyw: 50, twAt, rat, vu: dem.vu });
  assert.equal(P.rows.length, pans.length); assert.ok(P.gov && P.gov.r > 0); assert.ok(P.rows.filter(q => q.end).every(q => q.eq === '6.10.9.3.3-1'));
  assert.ok(P.rows.filter(q => !q.end).every(q => /6\.10\.9\.3\.2-[28]/.test(q.eq)), 'interior and pier panels use the tension field');
  assert.ok(P.gov.steps.length > 5);
});

test('hand checks: GS11 and GS18 at GirderDetail\'s built-in Pier 1 row', () => {
  // Pier 1: D = 60, t_w = 9/16, top 18 × 1 1/2, bottom 18 × 2, F_yw = 50, d_o = 90 in, interior panel (pier side: tension field, S2-4).
  // k = 5 + 5/(90/60)^2 = 5 + 2.2222 = 7.2222; D/t_w = 106.667; √(Ek/F_yw) = √(29,000 × 7.2222/50) = 64.722; 1.40 × 64.722 = 90.61 < 106.667:
  // C = 1.57/106.667^2 × (29,000 × 7.2222/50) = 1.57/11,377.8 × 4188.89 = 0.578018 (Eq. 6.10.9.3.2-6).
  // V_p = 0.58(50)(60)(0.5625) = 978.75 kip. 2Dt_w/(b_fc t_fc + b_ft t_ft) = 67.5/(27 + 36) = 1.0714 ≤ 2.5: Eq. 6.10.9.3.2-2:
  // V_n = 978.75[0.578018 + 0.87(1 − 0.578018)/√(1 + 1.5^2)] = 978.75[0.578018 + 0.367125/1.802776] = 978.75(0.781662) = 765.05 kip.
  // V_u = 1.25(95 + 14) + 1.50(16) + 1.75(105) = 136.25 + 24 + 183.75 = 344.00 kip; ratio 344.00/765.05 = 0.4496.
  // GS18: V_u = 95 + 14 + 16 + 1.75(55) = 221.25 kip ≤ V_cr = 0.578018(978.75) = 565.73 kip; ratio 0.3911.
  const L = { name: 'Pier 1', plates: { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 }, do: 90, end: false, V: { DC1: 95, DC2: 14, DW: 16, LL: 105, CL: 12, f: 55 } };
  const r = SH.location(L, { mat: { Fyw: 50 }, G: SH.factors() });
  assert.ok(Math.abs(r.sh.k - 7.222222) < 1e-6); assert.ok(Math.abs(r.sh.C - 0.578018) < 1e-6, String(r.sh.C)); assert.ok(Math.abs(r.sh.Vn - 765.05) < 0.01, String(r.sh.Vn));
  assert.equal(r.sh.eqn, '6.10.9.3.2-2'); assert.ok(Math.abs(r.Vu - 344) < 1e-9);
  const g11 = r.checks.find(c => c.id === 'GS11'), g18 = r.checks.find(c => c.id === 'GS18');
  assert.ok(Math.abs(g11.ratio - 0.4496) < 1e-4); assert.ok(Math.abs(r.VuF - 221.25) < 1e-9); assert.ok(Math.abs(r.sh.Vcr - 565.73) < 0.01); assert.ok(Math.abs(g18.ratio - 0.3911) < 1e-4);
  // the same panel at an abutment (end panel): V_n = CV_p = 565.73 kip, GS18 not applicable
  const e = SH.location({ ...L, end: true, do: 90 }, { mat: { Fyw: 50 }, G: SH.factors() });
  assert.equal(e.sh.eqn, '6.10.9.3.3-1'); assert.ok(Math.abs(e.sh.Vn - 565.73) < 0.01); assert.ok(!e.checks.find(c => c.id === 'GS18').inUse);
  const s = r.steps.find(q => q.id === 'sh.pan.Vp'); assert.equal(W.SharedSteps.line(s, false), 'V_p = 0.58F_(yw)Dt_w = 0.58(50.00)(60.00)(0.5625) = 978.75 kip');
});


test('SB2-R1: shear demands with pedestrianInLL take V_LL as is (no V_PL added)', () => {
  const pl = JSON.parse(fs.readFileSync(path.join(ST, 'gd_xsA_CTDOT_G1.json'), 'utf8')).payload; assert.equal(pl.pedestrianInLL, true);
  // at 110 ft (stations 109.999 and 110.001): the largest |V_LL| is V_LLneg = −104.326 at 110.001 (includes the pedestrian −9.314) -> LL = 104.326
  // (before: 104.326 + 9.314 = 113.640)
  const D = SH.demands(pl), D2 = SH.demands({ ...pl, pedestrianInLL: false });
  assert.ok(Math.abs(D.at(109.999).LL - 104.326) < 1e-9, D.at(109.999).LL); assert.ok(Math.abs(D2.at(109.999).LL - 113.640) < 1e-9, D2.at(109.999).LL);
});
