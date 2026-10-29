// apps/steel-bridge/engine/constructibility.js (window.SBDConstr): constructibility during deck placement, AASHTO LRFD 10th Ed. 6.10.3,
// against GirderDetail's own functions run in Node from "Steel Bridge Design.html" (gd-source.mjs): the Girder section module
// (GM.gs.compute, GM.gs.checks: GS14, GS15, GS16) and the Deck overhang module (GM.oh.compute, GM.oh.checks: OH1–OH5).
//
// Parity cases
//   1. Recorded inputs (tests/projects/sbd2-stiff, record-stiffeners.mjs): GirderDetail's Girder section rows exactly as Preliminary
//      sizing sends them (L_b,C, C_b,C, nprC with Method A γ_e and the governing section, V_DC1, V_CL, d_o, end panel) for the 5
//      projects × 4 owners × 2 stiffener layouts: as recorded (no pour-sequence M_DCc) and a second time with an M_DCc that differs
//      from M_DC1 (rows and governing sections), f_ℓ = 3 ksi and V_CL × 2. The same rows go to GirderDetail and to this engine.
//   2. Every station GirderDetail's Check at any location checks, on each of the 100 tests/projects/st/gd_*.json payloads, with the
//      payload's own M_DCc, M_CL (S2-8) fed in (GirderDetail's pour sequence, so the check logic alone is compared); L_b,C, C_b,C
//      and nprC from bracingC() (brace points every ≤ L_b of the payload, SB2-O9); the same rows to GirderDetail. The Deck overhang
//      rows of each exterior girder (ohRowsAt) with GirderDetail's default bracket inputs, against GM.oh.
//   3. The stored hand-off (girderDetail.checks.constr: GirderDetail's own governing item per span and group, and OH1–OH5 with the
//      stored bracket loads): recomputed here from the stored inputs (rounded to 0.001 / 0.0001 in the payload).
//   4. With this app's own pour sequence (engine/analysis.js seq.MDCc) in place of the payload's M_DCc: the expected difference
//      SB2-A1 (GirderDetail loads a node on a pour boundary in both pours: its M_DCc ~1 % larger near the piers; the engineer's
//      decision 2026-10-29: the new app keeps its exact pour loads). Every ratio difference is keyed to the M_DCc difference at that
//      location; where M_DCc agrees the ratios are identical.
//   5. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdDecl, gdBlock } from './gd-source.mjs';
import { payloadFiles, readPayload, projectFromPayload } from './an-fixture.mjs';

const ENG = p => path.join(ROOT, 'apps/steel-bridge/engine', p);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('flexure.js'), ENG('shear.js'), ENG('stiffeners.js'), ENG('analysis.js'), ENG('constructibility.js'));
const C = W.SBDConstr, AN = W.SBDAnalysis, FX = W.SBDFlexure;
const FIX = path.join(ROOT, 'tests/projects/sbd2-stiff');
const fixtures = fs.existsSync(FIX) ? fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort().map(f => ({ f, ...JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')) })) : [];
const payloads = payloadFiles();
const clone = o => JSON.parse(JSON.stringify(o));
const nm = v => typeof v === 'number' ? v : Number(v);
const GR = { '36': 36, '50': 50, '50W': 50, HPS50W: 50, HPS70W: 70 };
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);

/* GirderDetail's Girder section and Deck overhang modules in their own vm context (tagged; every declaration loaded before the
   comparisons: see gd-source.mjs and shear.test.mjs on V8 and consts added to a context later) */
const TAG = '\n// constructibility.test.mjs';
let GDX = null;
function gdRun(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
function gd() {
  if (GDX) return GDX;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext("var P = { df: { bridge: {} }, fa: { limit: 'auto', ADTT: 1000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } }, cf: {}, oh: {} }; var GM = {};", ctx);
  const loaded = new Set();
  ['ES', 'T', 'GD_GR', 'RANK', 'ge', 'worst', 'parseDim', 'nm', 'numRows', 'rc', 'ckNew', 'LE', 'GE', 'f0', 'f2', 'f3', 'frac', 'esc', 'A610_shearC', 'A610_Vp', 'webShear', 'PHI',
    'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnRules', 'gdOwnCite', 'LF_ONE', 'gdLF', 'OWN_K', 'gdOwnM', 'gdWsSt', 'gdPLq', 'gdPLe', 'gdGovML', 'gdUt', 'gdUtOn', 'gdHP', 'gdGLt',
    'sum', 'steelProps', 'addPart', 'rhFactor', 'ltbFnc', 'ampFl', 'fcrw', 'gsGov', 'gsGeTex', 'gsGovTex', 'gsGeWarn', 'OH_SPEC']
    .forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  gdRun(ctx, c => vm.runInContext(gdBlock('GM.gs = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.gs)' }), loaded);
  gdRun(ctx, c => vm.runInContext(gdBlock('GM.oh = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.oh)' }), loaded);
  GDX = { ctx, loaded, gs: (p, opt) => { const R = gdRun(ctx, c => c.GM.gs.compute(p, opt), loaded); assert.deepEqual([...(R.errors || [])], [], 'GirderDetail input errors'); return { R, CK: Array.from(gdRun(ctx, c => c.GM.gs.checks(R), loaded)) }; },
    oh: p => { const R = gdRun(ctx, c => c.GM.oh.compute(p), loaded); assert.deepEqual([...(R.errors || [])], [], 'GirderDetail overhang input errors'); return { R, CK: Array.from(gdRun(ctx, c => c.GM.oh.checks(R), loaded)) }; },
    fn: name => gdRun(ctx, c => vm.runInContext(name, c), loaded) };
  // warm-up: every path used below, before the comparisons (recorded rows, then the built-in rows, then the overhang module)
  const def = () => clone(ctx.GM.gs.def);
  ['f0', 'f2', 'f3', 'frac', 'esc'].forEach(k => GDX.fn(k));
  fixtures.forEach(fx => { const s = ctx.P; ctx.P = { ...s, df: { bridge: clone(fx.P.dfBridge || {}) }, fa: clone(fx.P.fa), cf: clone(fx.P.cf || {}) }; try { GDX.gs(clone(fx.P.gs)); GDX.gs(seqVariant(clone(fx.P.gs))); } finally { ctx.P = s; } });
  [{}, { gT: 'HPS70W', gB: 'HPS70W' }].forEach(o => GDX.gs({ ...def(), ...o }, { base: true }));
  GDX.oh(clone(ctx.GM.oh.def));
  return GDX;
}

/* a variant of recorded rows: an M_DCc that differs from M_DC1 (+6 %, also at the governing section of a 'ge' L_b), f_ℓ = 3 ksi, V_CL × 2 */
function seqVariant(p) {
  p.rows.forEach(r => { r.MDCc = Math.round(1.06 * r.MDC1 * 10) / 10; r.flC = 3; r.VCL = 2 * r.VCL; if (r.nprC && r.nprC.G) r.nprC.G.MDCc = Math.round(1.06 * r.nprC.G.MDC1 * 10) / 10; });
  return p;
}
/* a GirderDetail Girder section row -> a location of this engine */
function locOf(r) {
  return { name: r.name, x: r.x, plates: { D: nm(r.D), tw: nm(r.tw), topB: nm(r.topB), topT: nm(r.topT), botB: nm(r.botB), botT: nm(r.botT) },
    M: { DC1: nm(r.MDC1), DCc: r.MDCc, CL: nm(r.MCL) }, V: { DC1: nm(r.VDC1), CL: nm(r.VCL) }, LbC: nm(r.LbC), CbC: r.CbC === '' || r.CbC == null ? 0 : nm(r.CbC), Cb: nm(r.Cb), nprC: r.nprC,
    flC: nm(r.flC) || 0, do: nm(r.do) || 0, end: r.end === 'yes' };
}
const prjOf = p => ({ mat: { Fyt: GR[p.gT], Fyb: GR[p.gB], Fyw: GR[p.gW] }, G: { cdc: nm(p.gam.cdc), ccl: nm(p.gam.ccl) } });

const stats = { vals: 0, diffs: [], worst: { rel: 0, what: '' } };
function cmp(list, where) {
  for (const [k, a, b] of list) {
    stats.vals++;
    if (Object.is(a, b) || a === b) continue;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) continue;
    if ((a == null || a === '') && (b == null || b === '')) continue;
    const rel = typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) ? Math.abs(a - b) / Math.max(1e-300, Math.abs(b)) : Infinity;
    if (rel > stats.worst.rel) stats.worst = { rel, what: `${where} ${k}: ${a} vs ${b}` };
    if (rel < 1e-12) continue;
    stats.diffs.push(`${where} ${k}: ${a} vs GirderDetail ${b}`);
  }
}
/* row values and GS14–GS16 items of GirderDetail (R, CK) against this engine's rows (mine, same order) */
function cmpGS(R, CK, mine, where) {
  R.rows.forEach((r, i) => { const o = mine[i], L = [];
    for (const k of ['Mc', 'DcC', 'RhC', 'CbCu', 'VuC']) L.push([k, o[k], r[k]]);
    L.push(['con.top', o.con.top, r.con.top], ['con.bot', o.con.bot, r.con.bot], ['conC.lab', o.conC.lab, r.conC.lab], ['conC.f', o.conC.f, r.conC.f], ['conT.f', o.conT.f, r.conT.f]);
    for (const k of ['FLB', 'LTB', 'Fnc', 'rt', 'Lp', 'Lr', 'Fcr', 'Fyr']) L.push(['ltC.' + k, o.ltC[k], r.ltC[k]]);
    L.push(['npr', o.ltC.npr ? o.ltC.npr.kind : '', r.ltC.npr ? r.ltC.npr.kind : '']);
    if (r.ltC.npr && r.ltC.npr.kind === 'ge') { for (const k of ['fS', 'rtS', 'FeS', 'ge', 'fbu', 'Fe', 'rtE', 'K']) L.push(['npr.' + k, o.ltC.npr[k], r.ltC.npr[k]]);
      L.push(['npr.gv', !!o.ltC.npr.gv, !!r.ltC.npr.gv]); if (r.ltC.npr.gv) for (const k of ['f', 'S', 'Mc', 'Dc', 'Rh', 'MD']) L.push(['npr.gv.' + k, o.ltC.npr.gv[k], r.ltC.npr.gv[k]]); }
    L.push(['amC.AF', o.amC.AF, r.amC.AF], ['amC.fl', o.amC.fl, r.amC.fl], ['webC.F', o.webC.F, r.webC.F], ['webC.k', o.webC.k, r.webC.k], ['sh.Vcr', o.sh.Vcr, r.sh.Vcr], ['sh.C', o.sh.C, r.sh.C]);
    cmp(L, `${where} ${r.name}`); });
  // items in GirderDetail's order: GS14 yield, buckling (per row; a warning line where γ_e is a bound outside the step limit is skipped), GS15 web, tension, GS16
  const order = { GS14: ['yield', 'buckling'], GS15: ['web', 'tension'], GS16: ['shear'] }; let n = 0;
  for (const id of ['GS14', 'GS15', 'GS16']) { const c = CK.find(q => q.id === id), items = c.items.filter(it => isFinite(it.r)), keys = order[id];
    cmp([[`${id} n`, items.length, mine.length * keys.length]], where);
    items.forEach((it, j) => { const o = mine[Math.floor(j / keys.length)], q = o && o.checks.find(x => x.id === id && x.key === keys[j % keys.length]); if (!q) { stats.diffs.push(`${where} ${id} item ${j} missing`); return; }
      cmp([[`${id} ${o.name} ${q.key} r`, q.ratio, it.r], [`${id} ${o.name} ${q.key} st`, q.ok ? 'pass' : 'fail', it.st]], where); n++; }); }
  return n;
}
/* this engine's overhang rows -> GirderDetail's GM.oh, compared */
function cmpOH(Rg, CKg, Rm, where) {
  cmp([['wu', Rm.wu, Rg.wu], ['Fl', Rm.Fl, Rg.Fl], ['Pl', Rm.Pl, Rg.Pl]], where);
  Rg.rows.forEach((r, i) => { const o = Rm.rows[i], L = [];
    for (const k of ['Mu', 'fTop', 'fBot', 'Dc', 'Ml', 'rt', 'Fyr', 'lf', 'lpf', 'lrf', 'FncF', 'Lp', 'Lr', 'Fcr', 'FncL', 'Fnc', 'fbu', 'AF', 'k', 'Fcrw']) L.push([k, o[k], r[k]]);
    L.push(['c.lab', o.c.lab, r.c.lab], ['c.fl', o.c.fl, r.c.fl], ['tf.fl', o.tf.fl, r.tf.fl], ['c.fl1', o.c.fl1, r.c.fl1]); cmp(L, `${where} ${r.name}`); });
  const map = { OH1: ['yield'], OH2: ['buckling'], OH3: ['web'], OH4: ['tension'], OH5: ['fl.c', 'fl.t'] }; let n = 0;
  CKg.filter(c => /^OH[1-5]$/.test(c.id)).forEach(c => { const ks = map[c.id];
    c.items.forEach((it, j) => { const o = Rm.rows[Math.floor(j / ks.length)], k = ks[j % ks.length], q = k === 'fl.c' ? o.checks.find(x => x.id === 'OH5' && x.flange === o.c.lab) : k === 'fl.t' ? o.checks.find(x => x.id === 'OH5' && x.flange === o.tf.lab) : o.checks.find(x => x.id === c.id);
      cmp([[`${c.id} ${o.name} r`, q.ratio, it.r], [`${c.id} ${o.name} st`, q.ok ? 'pass' : 'fail', it.st]], where); n++; }); });
  return n;
}

test('parity with GirderDetail GS14–GS16 on the rows Preliminary sizing sends (recorded: 5 projects × 4 owners × 2 layouts; as recorded and with M_DCc ≠ M_DC1, f_ℓ, V_CL)', () => {
  if (!fixtures.length) { console.log('       (no tests/projects/sbd2-stiff fixtures)'); return; }
  const G = gd(); let nRows = 0, nItems = 0, nGe = 0, nodeDiff = 0; const s0 = stats.diffs.length;
  for (const fx of fixtures) {
    const saveP = G.ctx.P; G.ctx.P = { ...saveP, df: { bridge: clone(fx.P.dfBridge || {}) }, fa: clone(fx.P.fa), cf: clone(fx.P.cf || {}) };
    try {
      for (const [vn, p] of [['', clone(fx.P.gs)], [' (M_DCc, f_l, V_CL)', seqVariant(clone(fx.P.gs))]]) {
        const where = fx.f.replace(/\.json$/, '') + vn, { R, CK } = G.gs(clone(p));
        if (!vn) R.rows.forEach((r, i) => { const q = fx.gd.gs.rows[i]; if (!(r.VuC === q.VuC || Math.abs(r.VuC - q.VuC) <= 1e-12 * Math.abs(q.VuC))) nodeDiff++; });   // Node = browser (V_u of deck placement, recorded)
        const prj = prjOf(p), mine = p.rows.map(r => C.location(locOf(r), prj));
        nItems += cmpGS(R, CK, mine, where); nRows += R.rows.length; nGe += R.rows.filter(r => r.ltC.npr && r.ltC.npr.kind === 'ge').length;
        mine.forEach(o => { const ids = new Set(o.steps.map(s => s.id)); o.checks.forEach(c => assert.ok(ids.has(c.step), `${where} missing step ${c.step}`)); });
      }
    } finally { G.ctx.P = saveP; }
  }
  console.log(`       ${fixtures.length} recorded inputs × 2, ${nRows} rows (${nGe} with a nonprismatic 'ge' deck-placement L_b), ${nItems} GS14–GS16 items, ${stats.vals} values; Node = browser V_uC (${nodeDiff} differ); ${stats.diffs.length - s0} differ; largest relative difference ${stats.worst.rel.toExponential(2)}`);
  stats.diffs.slice(s0, s0 + 20).forEach(s => console.log('       ' + s));
  assert.equal(nodeDiff, 0); assert.equal(stats.diffs.length - s0, 0); assert.ok(nGe > 300, 'nonprismatic rows covered');
});

/* the GirderDetail row of a location of this engine */
function gdRowOf(d0, L, i) {
  return { ...clone(d0.rows[0]), name: L.name, region: 'pos', cont: 'yes', beff: 96, ...L.plates, Lb: L.LbC, LbC: L.LbC, Cb: L.Cb, CbC: L.CbC, nprC: L.nprC === '' ? '' : clone(L.nprC),
    MDC1: L.M.DC1, MDCc: L.M.DCc, MDC2: 0, MDW: 0, MLLp: 0, MLLn: 0, MCL: L.M.CL, MfP: 0, MfN: 0, VDC1: L.V.DC1, VDC2: 0, VDW: 0, VLL: 0, VCL: L.V.CL, Vf: 0, fl: 0, flC: L.flC, do: L.do, end: L.end ? 'yes' : 'no', x: L.x, i };
}
const gdModP = (d0, pl, rows) => { const m = pl.girderDetail.materials, g = String(m.Fyf) === '70' ? 'HPS70W' : '50', gw = String(m.Fyw) === '70' ? 'HPS70W' : '50';
  return { ...clone(d0), gT: g, gB: g, gW: gw, rows }; };

test('parity with GirderDetail GS14–GS16 at every station of the 100 gd_*.json payloads, the payload\'s M_DCc fed in; Deck overhang OH1–OH5 (GM.oh)', () => {
  const G = gd(), d0 = G.ctx.GM.gs.def, t0 = Date.now(); let nLoc = 0, nItems = 0, nOH = 0, nCase = 0, seq = 0; const s0 = stats.diffs.length;
  for (const f of payloads) {
    const pl = readPayload(f), F = C.fromPayload(pl);
    if (F.locs.some(L => L.M.DCc !== 0)) seq++;
    for (const [vn, fn] of f.endsWith('_G1.json') ? [['', L => L], [' (f_l 4)', L => ({ ...L, flC: 4 })]] : [['', L => L]]) {
      const locs = F.locs.map(fn), { R, CK } = G.gs(gdModP(d0, pl, locs.map((L, i) => gdRowOf(d0, L, i))), { base: true });
      const mine = locs.map(L => C.location(L, F.prj)); nItems += cmpGS(R, CK, mine, f + vn); nLoc += locs.length; nCase++;
    }
    if (F.oh) { const def = clone(G.ctx.GM.oh.def), p = { ...def, gF: F.prj.mat.Fyt === 70 ? 'HPS70W' : '50W', gW: F.prj.mat.Fyw === 70 ? 'HPS70W' : '50W', rows: F.oh.rows.map(r => ({ name: r.name, D: r.D, tw: r.tw, topB: r.topB, topT: r.topT, botB: r.botB, botT: r.botT, Lb: r.Lb, MDC1: r.MDC1, MCL: r.MCL })) };
      const { R, CK } = G.oh(p), mine = C.overhang(F.oh.rows, { ...C.OH_DEF }, { Fyf: F.prj.mat.Fyt, Fyw: F.prj.mat.Fyw }); nOH += cmpOH(R, CK, mine, f + ' OH'); }
  }
  console.log(`       ${nCase} cases (${seq} payloads with a pour-sequence M_DCc), ${nLoc} locations, ${nItems} GS14–GS16 items, ${nOH} OH1–OH5 items in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${stats.diffs.length - s0} differ; largest relative difference so far ${stats.worst.rel.toExponential(2)}`);
  stats.diffs.slice(s0, s0 + 20).forEach(s => console.log('       ' + s));
  assert.equal(stats.diffs.length - s0, 0); assert.ok(nLoc > 30000); assert.ok(nOH > 500); assert.ok(seq >= 80);
});

test('the stored hand-off girderDetail.checks.constr (GirderDetail\'s own governing items per span, and OH1–OH5 with its bracket loads) recomputed from the stored inputs', () => {
  let n = 0, nOH = 0, worst = { d: 0 }, same = 0, tot = 0; const why = {};
  const chk = (a, b, tol, what) => { const d = Math.abs(a - b); if (d > worst.d) worst = { d, what }; assert.ok(d <= tol, `${what}: ${a} vs stored ${b}`); };
  for (const f of payloads) {
    const pl = readPayload(f), st = pl.girderDetail.checks.constr, m = pl.girderDetail.materials, mat = { Fyt: +m.Fyf, Fyb: +m.Fyf, Fyw: +m.Fyw }, ts = (pl.girderDetail.details.transverseStiffener || {}).spacings || [0];
    assert.equal(st.gam.dc, 1.25); assert.equal(st.gam.cl, 1.5);
    const F = C.fromPayload(pl), Gm = C.girder(F.locs, F.prj, { supports: F.supports, oh: F.oh });
    st.spans.forEach((sp, k) => {
      for (const key of ['top', 'bot', 'tens', 'shear']) { const o = sp[key]; if (!o) continue;
        const L = { name: `${f} span ${k + 1} ${key}`, x: o.x, plates: o.sec, M: { DC1: o.MDC1, DCc: o.MDCc, CL: o.MCL }, V: { DC1: o.VDC1 || 0, CL: o.VCL || 0 }, LbC: o.LbC, CbC: o.Cb || 1, Cb: 1, flC: 0, do: ts[0] || 0, end: false };
        const r = C.location(L, { mat, G: C.factors() }), w = L.name;
        if (key !== 'shear') chk(r.Mc, o.Mc, 2e-3, w + ' Mc');
        if (o.kind === 'yield' || o.kind === 'web' || o.kind === 'tension') { const q = r.checks.find(c => c.key === o.kind); chk(q.demand, o.dem, 2e-4, w + ' demand'); chk(q.capacity, o.cap, 2e-4, w + ' capacity'); chk(q.ratio, o.r, 1.2e-4, w + ' ratio'); }
        else if (o.kind === 'buckling') { const q = r.checks.find(c => c.key === 'buckling'); chk(q.demand, o.dem, 2e-4, w + ' demand'); chk(r.ltC.FLB, o.FLB, 2e-4, w + ' FLB');
          if (!o.npr) { chk(r.ltC.LTB, o.LTB, 2e-3, w + ' LTB'); chk(q.ratio, o.r, 1.2e-4, w + ' ratio'); chk(r.ltC.rt, o.rt, 1e-4, w + ' rt'); chk(r.ltC.Lp, o.Lp, 1e-3, w + ' Lp'); } }
        else { chk(r.VuC, o.dem, 5e-3, w + ' V_u'); chk(r.sh.C, o.C, 1e-4, w + ' C'); chk(r.sh.Vp, o.Vp, 1e-4, w + ' V_p'); chk(o.cap, o.C * o.Vp, 0.05, w + ' V_cr'); }
        n++;
        // the governing location found here (payload brace points, SB2-O9) against GirderDetail's (its own framing)
        const b = Gm.spans[k][key]; tot++;
        if (b && Math.abs(b.row.x - o.x) < 0.006 && Math.abs(b.ratio - o.r) <= 1.2e-4) same++;
        else { const c = !b ? 'none' : Math.abs(b.row.LbC - o.LbC) > 0.01 || (o.Cb != null && Math.abs(b.row.CbCu - o.Cb) > 1e-3) ? 'L_b,C or C_b,C differ (brace points every ≤ L_b here, GirderDetail\'s own framing; SB2-O9)'
            : key === 'shear' ? 'V_DC1, V_CL at the station (payload shears; GirderDetail its element shear, SB2-A3)'
            : Math.abs(b.row.x - o.x) < 0.006 && Math.abs(b.row.Mc - o.Mc) <= 2e-3 * Math.abs(o.Mc) ? 'M_c at the station (payload moments linear between stations; GirderDetail its own analysis there)' : 'other';
          why[c] = (why[c] || 0) + 1; }
      }
      for (const key of ['oh', 'ohfl']) { const o = sp[key]; if (!o) continue; const I = st.oh.inputs;
        const R = C.overhang([{ name: 'x', x: o.x, ...o.sec, Lb: o.Lb, MDC1: o.MDC1, MCL: o.MCL }], { Rh: I.Rh, Cb: I.Cb, gam: { dc: I.gDC, cl: I.gCL }, a: I.a, hb: I.hb, loads: { wu: I.wu, Fl: I.Fl, Pl: I.Pl } }, { Fyf: I.Fy, Fyw: mat.Fyw }), r = R.rows[0], w = `${f} span ${k + 1} ${o.id}`;
        // the stored F_ℓ and P_ℓ are rounded to 0.0001 (F_ℓ: up to 0.00005 klf × L_b² ≈ 0.03 kip-in of M_ℓ, 0.001 ksi of f_ℓ)
        chk(r.Mu, o.Mu, 2e-3, w + ' Mu'); chk(r.Ml, o.Ml, 0.04, w + ' M_l'); chk(r.AF, o.AF, 1e-4, w + ' AF');
        const q = o.id === 'OH5' ? r.checks.find(c => c.id === 'OH5' && c.flange === o.flange) : r.checks.find(c => c.id === o.id);
        chk(q.demand, o.dem, 2e-3, w + ' demand'); chk(q.capacity, o.cap, 2e-4, w + ' capacity'); chk(q.ratio, o.r, 1.2e-4, w + ' ratio'); nOH++;
        // the overhang row placed here: the same station as GirderDetail's
        const b = Gm.spans[k][key]; assert.ok(b && Math.abs(b.row.x - o.x) < 0.006, `${w}: OH row at ${b && b.row.x} vs stored ${o.x}`); }
    });
  }
  console.log(`       ${n} stored GS14–GS16 governing items and ${nOH} OH items recomputed; largest |difference| ${worst.d.toExponential(2)} (${worst.what}; the payload rounds to 0.001 / 0.0001)`);
  console.log(`       governing location and ratio per span and group as GirderDetail's own: ${same} of ${tot}; otherwise: ${Object.entries(why).map(([k, v]) => `${v} ${k}`).join(', ')}`);
  assert.ok(n >= 1150 && nOH >= 230); assert.ok(!why.other && !why.none, 'every governing-item difference has a known cause');
});

test('this app\'s pour sequence (engine/analysis.js) in place of the payload\'s M_DCc: the SB2-A1 difference, keyed location by location', () => {
  const ALL = !!process.env.SBD_CN_ALL, list = ALL ? payloads : payloads.filter((f, i) => i % 10 === 0), t0 = Date.now();
  let nLoc = 0, worstM = { rel: 0 }, worstR = { d: 0 }; const hist = { '≤ 0.05 %': 0, '0.05–0.5 %': 0, '> 0.5 %': 0 }, nearPier = { in: 0, out: 0 };
  for (const f of list) {
    const pl = readPayload(f), P = projectFromPayload(pl), AR = AN.analyzeGirder(P, 0, { ll: false });
    assert.deepEqual([...AR.errors], [], f); if (!AR.seq) continue;
    // the payload with M_DCc replaced by this app's (linear between this app's stations, which are GirderDetail's nodes); everything else the payload's
    const pl2 = clone(pl); pl2.stations.forEach(s => { if (s.M_DCc !== undefined) s.M_DCc = FX.feAt(AR.x, AR.seq.MDCc, s.x); });
    const A = C.fromPayload(pl), B = C.fromPayload(pl2), maxM = Math.max(...A.locs.map(L => Math.abs(L.M.DCc))), piers = AR.sup.slice(1, -1), Lsp = Math.min(...AR.spans);
    A.locs.forEach((L, i) => { const a = C.location(L, A.prj), b = C.location(B.locs[i], B.prj), dM = B.locs[i].M.DCc - L.M.DCc, rel = Math.abs(dM) / maxM; nLoc++;
      if (rel > worstM.rel) worstM = { rel, f, x: L.x, a: L.M.DCc, b: B.locs[i].M.DCc };
      hist[rel <= 5e-4 ? '≤ 0.05 %' : rel <= 5e-3 ? '0.05–0.5 %' : '> 0.5 %']++;
      if (rel > 5e-3) nearPier[piers.some(q => Math.abs(L.x - q) <= 0.3 * Lsp) ? 'in' : 'out']++;
      // keyed: M_c changes by γ_DC ΔM_DCc and nothing else; the stresses scale with M_c; L_b,C, C_b,C (from 1.25M_DC1 + 1.5M_CL, Preliminary
      // sizing) and the shear (V_DC1, V_CL) do not depend on M_DCc
      close(b.Mc - a.Mc, 1.25 * dM, 1e-9, `${f} ${L.name} ΔM_c = 1.25ΔM_DCc`);
      const k = b.Mc / a.Mc; if (Math.sign(b.Mc) === Math.sign(a.Mc)) { close(b.conC.f, a.conC.f * k, 1e-9, `${f} ${L.name} f_bu ∝ M_c`); close(b.conT.f, a.conT.f * k, 1e-9, `${f} ${L.name} f_t ∝ M_c`); }
      assert.equal(b.LbC, L.LbC); assert.equal(b.CbCu, a.CbCu); assert.equal(b.checks.find(c => c.key === 'shear').ratio, a.checks.find(c => c.key === 'shear').ratio, `${f} ${L.name} shear`);
      for (const c of a.checks) { const d = b.checks.find(q => q.key === c.key), dd = Math.abs(d.ratio - c.ratio); if (dd > worstR.d) worstR = { d: dd, f, x: L.x, key: c.key, a: c.ratio, b: d.ratio }; }
    });
  }
  console.log(`       ${list.length} payloads${ALL ? '' : ' (every 10th; SBD_CN_ALL=1 runs all 100)'} in ${((Date.now() - t0) / 1000).toFixed(1)} s, ${nLoc} locations. |ΔM_DCc| / max |M_DCc|: ${Object.entries(hist).map(([k, v]) => `${k}: ${v}`).join(', ')}; the > 0.5 % ones within 0.3 L of a pier: ${nearPier.in} of ${nearPier.in + nearPier.out}`);
  console.log(`       largest M_DCc difference ${(100 * worstM.rel).toFixed(2)} % of max |M_DCc| (${worstM.f}, x = ${worstM.x && worstM.x.toFixed(2)} ft: GirderDetail ${worstM.a && worstM.a.toFixed(1)}, this app ${worstM.b && worstM.b.toFixed(1)} kip-ft)`);
  console.log(`       largest ratio change ${worstR.d.toFixed(4)} (${worstR.f}, x = ${worstR.x && worstR.x.toFixed(2)} ft, ${worstR.key}: ${worstR.a && worstR.a.toFixed(4)} -> ${worstR.b && worstR.b.toFixed(4)})`);
  assert.ok(worstM.rel < 0.02, 'M_DCc within 2 % (SB2-A1: ~1 %)'); assert.ok(worstR.d < 0.01);
});

test('fromAnalysis(): the project path (analysis, cross-frames, stiffener panels, exterior girder overhang rows) runs and links its steps', () => {
  const pl = readPayload('gd_builtin_AASHTO_G1.json'), P = projectFromPayload(pl), AR = AN.analyzeGirder(P, 0, { ll: false });
  P.stiffeners = W.SBDModel.defaultStiffeners();
  const F = C.fromAnalysis(P, 0, AR, {}), G = C.girder(F.locs, F.prj, { supports: F.supports, oh: F.oh });
  assert.ok(F.locs.length > 300); assert.ok(F.seq); assert.equal(F.ext, true); assert.equal(G.oh.rows.length, 3);
  // the governing per span is close to the payload path (same plates, this app's own M_DCc and shears)
  const A = C.fromPayload(pl), GA = C.girder(A.locs, A.prj, { supports: A.supports });
  G.spans.forEach((s, k) => ['top', 'bot', 'tens'].forEach(key => { if (s[key] && GA.spans[k][key]) close(s[key].ratio, GA.spans[k][key].ratio, 0.03, `span ${k + 1} ${key}`); }));
  G.rows.slice(0, 20).forEach(r => { const ids = new Set(r.steps.map(s => s.id)); r.checks.forEach(c => assert.ok(ids.has(c.step), c.step)); });
  G.oh.rows.forEach(r => { const ids = new Set(r.steps.map(s => s.id)); r.checks.forEach(c => assert.ok(ids.has(c.step), c.step)); });
});

/* ---------- hand checks ---------- */
test('hand check: deck placement on a doubly symmetric steel I (GS14, GS15, GS16)', () => {
  // Steel I: flanges 16 × 1, web 60 × 1/2, F_y 50 (A = 62 in², ȳ = 31 in, I = 38,770.667 in⁴, d = 62 in; sections.test.mjs hand check 1).
  // M_DC1 = 1000, M_DCc = 1100 (pour sequence), M_CL = 100 kip-ft: M_c = 1.25(1100) + 1.5(100) = 1525 kip-ft (Art. 3.4.2.1).
  // f_top = −1525(12)(62 − 31)/38,770.667 = −567,300/38,770.667 = −14.63220 ksi; f_bot = +14.63220 ksi. Top flange in compression.
  // D_c = (62 − 1) − 31 = 30 in. R_h = 1. L_b = 20 ft = 240 in, C_b = 1.0, R_b = 1.0.
  // F_yr = max(min(0.7·50, 50), 25) = 35 ksi. λ_f = 16/2 = 8 ≤ λ_pf = 0.38√(29,000/50) = 9.15161: F_nc,FLB = 50 ksi.
  // r_t = 16/√(12(1 + 30(0.5)/(3·16·1))) = 16/√15.75 = 4.031621 in; L_p = 1.1(4.031621)√580 = 106.8037 in;
  // L_r = π(4.031621)√(29,000/35) = π(4.031621)(28.78492) = 364.5814 in;
  // F_nc,LTB = [1 − (1 − 35/50)(240 − 106.8037)/(364.5814 − 106.8037)](50) = [1 − 0.3(0.516713)](50) = 42.24935 ksi.
  // GS14 yielding: 14.63220/50 = 0.292644; flexural resistance: 14.63220/42.24935 = 0.346329.
  // GS15 web: k = 9/(30/60)² = 36, F_crw = 0.9(29,000)(36)/(60/0.5)² = 65.25 → min(65.25, 50, 50/0.7) = 50: 0.292644; tension 14.63220/50 = 0.292644.
  // GS16: V_u = 1.25(50) + 1.5(5) = 70 kip; unstiffened, k = 5, D/t_w = 120 > 1.40√(29,000·5/50) = 75.392:
  //   C = 1.57/120² (29,000·5/50) = 0.316181; V_p = 0.58(50)(60)(0.5) = 870 kip; V_cr = 275.0771 kip; 70/275.0771 = 0.254474.
  const r = C.location({ name: 'hand', plates: { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 }, M: { DC1: 1000, DCc: 1100, CL: 100 }, V: { DC1: 50, CL: 5 }, LbC: 20, CbC: 1, do: 0, end: false },
    { mat: { Fyt: 50, Fyb: 50, Fyw: 50 }, G: C.factors() });
  const ck = k => r.checks.find(c => c.key === k);
  close(r.Mc, 1525, 1e-12, 'Mc'); close(r.con.top, -14.632196, 1e-6, 'f_top'); assert.equal(r.conC.lab, 'top'); close(r.DcC, 30, 1e-12, 'Dc');
  close(r.ltC.rt, 4.031621, 1e-6, 'rt'); close(r.ltC.Lp, 106.8037, 1e-6, 'Lp'); close(r.ltC.Lr, 364.5814, 1e-6, 'Lr'); close(r.ltC.LTB, 42.24935, 1e-6, 'LTB'); assert.equal(r.ltC.FLB, 50);
  close(ck('yield').ratio, 0.292644, 1e-5, 'GS14 yield'); close(ck('buckling').ratio, 0.346329, 1e-5, 'GS14 buckling'); close(ck('web').ratio, 0.292644, 1e-5, 'GS15 web'); close(ck('tension').ratio, 0.292644, 1e-5, 'GS15 tension');
  close(r.sh.C, 0.316181, 1e-5, 'C'); close(r.sh.Vcr, 275.0771, 1e-6, 'Vcr'); close(ck('shear').ratio, 0.254474, 1e-5, 'GS16');
  assert.equal(r.gov.key, 'buckling');
  // without M_DCc (0): M_DC1 is used, M_c = 1.25(1000) + 150 = 1400
  close(C.location({ name: 'h2', plates: { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 }, M: { DC1: 1000, DCc: 0, CL: 100 }, V: {}, LbC: 20 }, { mat: { Fyt: 50, Fyb: 50, Fyw: 50 } }).Mc, 1400, 1e-12, 'Mc without M_DCc');
  const st = r.steps, s = id => st.find(q => q.id === id);
  assert.equal(s('cn.Mc').value, r.Mc); assert.equal(s('cn.LTB').value, r.ltC.LTB); assert.equal(s('cn.buck.ok').ok, true);
  assert.ok(/1\.25\(1100\.00\) \+ 1\.50\(100\.00\)/.test(s('cn.Mc').sub));
});

test('hand check: overhang brackets on the exterior girder (OH1–OH5, GirderDetail\'s default bracket inputs and location)', () => {
  // Bracket loads (GM.oh.def): deck 0.150(9/12)(30/12) = 0.28125 klf × 1.25; forms 0.010(30/12) = 0.025, screed 0.085, railing 0.025,
  // walkway 0.125, construction LL 0.020(30/12) = 0.05 klf, sum 0.31 × 1.5: w_u = 0.3515625 + 0.465 = 0.8165625 klf.
  // a/h_b = 36/54 = 0.666667: F_ℓ = 0.544375 klf; P_ℓ = 1.5(3.0)(0.666667) = 3.0 kip.
  // Location (def row): web 60 × 0.5625, top 16 × 0.75, bottom 16 × 1.125, L_b 23.3 ft, M_DC1 1700, M_CL 180: M_u = 1.25(1700) + 1.5(180) = 2395 kip-ft.
  // M_ℓ = 0.544375(23.3)²/12 × 12 + 3.0(279.6)/8 = 0.544375(542.89) + 104.85 = 295.5357 + 104.85 = 400.3857 kip-in.
  // Top flange: S_ℓ = 0.75(16)²/6 = 32 in³, f_ℓ1 = 400.3857/32 = 12.51205 ksi; bottom: 1.125(16)²/6 = 48 in³, f_ℓ1 = 8.34137 ksi.
  // Steel section: A = 12 + 33.75 + 18 = 63.75 in²; ȳ = (18(0.5625) + 33.75(31.125) + 12(61.5))/63.75 = 1798.594/63.75 = 28.21324 in; d = 61.875 in.
  // Top flange in compression (M_u > 0): f_bu = 2395(12)(61.875 − 28.21324)/I = 25.8178 ksi (I = 37,471.85 in⁴); the amplified f_ℓ and the OH1–OH5
  // ratios are compared with GirderDetail's own module on the same input below (OH1 0.94222, OH2 0.84967, OH3 0.51636, OH4 0.59960, OH5 0.70977 / 0.27805).
  const R = C.overhang([{ name: 'def', D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125, Lb: 23.3, MDC1: 1700, MCL: 180 }], {}, { Fyf: 50, Fyw: 50 }), r = R.rows[0];
  close(R.wu, 0.8165625, 1e-12, 'wu'); close(R.Fl, 0.544375, 1e-12, 'Fl'); close(R.Pl, 3.0, 1e-12, 'Pl'); close(r.Mu, 2395, 1e-12, 'Mu'); close(r.Ml, 400.3857, 1e-6, 'Ml');
  close(r.c.fl1, 12.51205, 1e-6, 'f_l1 top'); close(r.tf.fl1, 8.34137, 1e-6, 'f_l1 bottom'); close(r.s.yb, 28.21324, 1e-6, 'yb'); close(r.fbu, 25.8178, 1e-5, 'f_bu');
  assert.equal(r.c.lab, 'top'); assert.equal(r.checks.filter(c => c.id === 'OH5').length, 2);
  const oh5 = r.checks.find(c => c.id === 'OH5' && c.flange === 'top'); close(oh5.demand, r.c.fl1 * r.AF, 1e-12, 'OH5 top'); close(oh5.capacity, 30, 1e-12, '0.6F_y');
  // same as GirderDetail's own module on its built-in input
  const G = gd(), { R: Rg, CK } = G.oh(clone(G.ctx.GM.oh.def)); const s0 = stats.diffs.length; cmpOH(Rg, CK, R, 'GM.oh.def'); assert.equal(stats.diffs.length - s0, 0, stats.diffs.slice(s0).join('; '));
});
