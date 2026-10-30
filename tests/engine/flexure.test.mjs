// apps/steel-bridge/engine/flexure.js against GirderDetail's own Girder section module (GM.gs.compute and GM.gs.checks in
// "Steel Bridge Design.html", run in a vm by gd-source.mjs) and against Preliminary sizing's own unbraced-length functions
// (feCb, feAt, feNpr, feGe, feGeA, feGov, taken from the page text and run in a vm).
//
// Parity cases
//   1. Every station GirderDetail's "Check at any location" checks, on each of the 100 tests/projects/st/gd_*.json hand-off
//      payloads: every payload station, both sides (±0.01 ft) of each plate change and interior support, 0.01 ft inside the
//      ends. Demands: the payload's unfactored station moments (girderDemands of the hand-off; linear between stations), as
//      ST-Girder read them. L_b, C_b and the nonprismatic data from fromPayload()/bracing() (brace points every ≤ L_b of the
//      payload in each span). The same row goes to GirderDetail (GM.gs.compute with the AASHTO factors, base) and to this
//      engine; P.df.bridge.skews = the payload's support skews (so the 6.10.6.2.3 skew test is GirderDetail's own).
//      The AASHTO G1 payload of each family is run a second time with f_ℓ = 7.5 ksi (amplification, GS10, GS12 bottom).
//   2. GirderDetail's built-in Girder section rows (GM.gs.def) as is, with f_ℓ, with HPS70W flanges (hybrid), with negM 6.10.8.
//   3. bracing() with this engine's fe* functions and with Preliminary sizing's: identical rows.
// Compared per row: M_u, M_s, the opposite extreme, γ_p by sign, Strength I and Service II flange stresses, M_y (D6.2), and
// positive: D_p, M_y, S_xt, compactness, M_n; negative: D_c, R_b, F_nc (FLB, LTB, r_t, L_p, L_r, F_cr, F_yr), C_b used, f_bu,
// f_ℓ amplification, the nonprismatic F_e/r_t/γ_e, App. A6 permission and resistances; D_c (Service II), F_crw; Fatigue I
// ranges; and for each GS5–GS10, GS12, GS13, GS19 item: ratio and pass/fail. Expected: identical.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdGirderSection, gdRun } from './gd-source.mjs';

const W = loadShared('units.js', 'steps.js', path.join(ROOT, 'apps/steel-bridge/engine/sections.js'), path.join(ROOT, 'apps/steel-bridge/engine/owners.js'), path.join(ROOT, 'apps/steel-bridge/engine/flexure.js'));
const FX = W.SBDFlexure, SEC = W.SBDSections, STEPS = W.SharedSteps;
const close = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol * Math.max(1, Math.abs(b)), `${what}: ${a} vs ${b}`);
const DIR = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(DIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
const readP = f => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload;

/* Preliminary sizing's own fe* functions, from the page text */
let FE = null;
function gdFe() {
  if (FE) return FE;
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8'), ctx = {}; vm.createContext(ctx);
  let code = 'const ES = 29000;\n';
  for (const n of ['feCb', 'feAt', 'feNpr', 'feGe', 'feGeA', 'feGov']) {
    const a = html.indexOf(`\nfunction ${n}(`); assert.ok(a > 0, `${n} not found`); const b = html.indexOf('\n}\n', a); code += html.slice(a + 1, b + 3);
  }
  vm.runInContext(code + 'this.FE = { feCb, feAt, feNpr, feGe, feGeA, feGov };', ctx, { filename: 'Steel Bridge Design.html (fe*)' });
  return (FE = ctx.FE);
}

/* a location of this engine -> GirderDetail Girder section row */
function gdRow(GS, L, i) {
  const n = L.npr || {}, M = L.M;
  return { ...JSON.parse(JSON.stringify(GS.ctx.GM.gs.def.rows[0])), name: L.name, region: L.region, cont: L.cont ? 'yes' : 'no', beff: L.beff, ...L.plates,
    Lb: L.Lb, LbC: L.Lb, Cb: L.Cb, CbC: '', lbB: n.b || 0, lbT: n.t || 0, npr: n.kind || '', lbK: n.K == null ? '' : n.K, lbIr: n.Ir == null ? '' : n.Ir, nprWhy: n.why || '', geA: n.geA || '', ...(n.gov ? { nprG: n.gov } : {}),
    MDC1: M.DC1, MDCc: 0, MDC2: M.DC2, MDW: M.DW, MLLp: M.LLp, MLLn: M.LLn, MCL: 0, MfP: M.FATp, MfN: M.FATn, VDC1: 0, VDC2: 0, VDW: 0, VLL: 0, VCL: 0, Vf: 0,
    fl: L.fl, flC: 0, do: 0, end: 'no', ut: { MUT: M.UT, MUF: M.UF }, x: L.x, i };
}
function gdModule(GS, prj, rows, over) {
  const d = JSON.parse(JSON.stringify(GS.ctx.GM.gs.def)), dk = prj.deck;
  return { ...d, gT: '50', gB: '50', gW: '50', Fyr: prj.mat.Fyr, fc: prj.mat.fc, wc: prj.wc, K1: 1, nRule: 'exact', rebarMp: 'excl', ts: dk.ts, tdeck: dk.tdeck, hh: dk.haunch,
    Art: dk.rebar.top.A, crt: dk.rebar.top.c, Arb: dk.rebar.bot.A, crb: dk.rebar.bot.c, negM: 'auto', rows, ...(over || {}) };
}
function gdRunCase(GS, p, skews) {
  GS.ctx.P.df.bridge = { skews: skews.slice() };
  const R = GS.compute(p, { base: true }); assert.deepEqual([...(R.errors || [])], [], 'GirderDetail input errors: ' + (R.errors || []).join('; '));
  const CK = gdRun(GS.ctx, c => c.GM.gs.checks(R), GS.loaded);
  return { R, CK: Array.from(CK) };
}

/* pairs [what, ours, GirderDetail's] */
function rowPairs(o, r) {
  const out = [], P = (k, a, b) => out.push([k, a, b]);
  P('Mu', o.Mu, r.Mu); P('Ms', o.Ms, r.Ms); P('Mrev', o.Mrev, r.Mrev); P('rev', o.rev, r.rev);
  for (const k of ['DC1', 'DC2', 'DW', 'UT', 'UF']) P('gam.' + k, o.gm[k], r.gm[k]);
  P('str.top', o.str.top, r.str.top); P('str.bot', o.str.bot, r.str.bot); P('svc.top', o.svc.top, r.svc.top); P('svc.bot', o.svc.bot, r.svc.bot);
  P('yT.My', o.yT.My, r.yT.My); P('yB.My', o.yB.My, r.yB.My); P('Rh', o.Rh, r.Rh);
  P('DcS', o.DcS, r.DcS); P('webS.F', o.webS.F, r.webS.F); P('webS.k', o.webS.k, r.webS.k); P('dfT', o.dfT, r.dfT); P('dfB', o.dfB, r.dfB);
  if (r.pos) { for (const k of ['Dp', 'My', 'Sxt', 'compact', 'Mn0', 'cap13', 'Mn', 'FncP']) P(k, o[k], r[k]); P('below', o.below, !!r.d61.below); }
  else {
    for (const k of ['Dc', 'Rb', 'CbU', 'fbuC', 'useA6']) P(k, o[k], r[k]);
    for (const k of ['FLB', 'LTB', 'Fnc', 'rt', 'Lp', 'Lr', 'Fcr', 'Fyr', 'lf', 'lpf', 'lrf']) P('lt.' + k, o.lt[k], r.lt[k]);
    P('am.AF', o.am.AF, r.am.AF); P('am.fl', o.am.fl, r.am.fl);
    P('npr', o.lt.npr ? o.lt.npr.kind : '', r.lt.npr ? r.lt.npr.kind : '');
    if (r.lt.npr && r.lt.npr.kind === 'ge') { for (const k of ['fS', 'FeS', 'ge', 'fbu', 'Fe', 'rtE', 'K']) P('npr.' + k, o.lt.npr[k], r.lt.npr[k]); P('npr.gv.f', o.lt.npr.gv ? o.lt.npr.gv.f : null, r.lt.npr.gv ? r.lt.npr.gv.f : null);
      if (r.lt.npr.gv) { P('npr.gv.Rb', o.lt.npr.gv.Rb, r.lt.npr.gv.Rb); P('npr.gv.Rh', o.lt.npr.gv.Rh, r.lt.npr.gv.Rh); } }
    const a = o.A6, b = r.A6;
    P('A6.ok', a.ok, b.ok); P('A6.nwhy', a.why.length, b.why.length); P('A6.skew', a.why.some(s => /skewed/.test(s)), b.why.some(s => /skewed/.test(s)));
    for (const k of ['lw', 'lrwP', 'crwP', 'awcP', 'skM', 'lpDcp', 'webCompact', 'Rpc', 'Rpt', 'Sxc', 'J', 'FyrA', 'kc', 'MncF', 'Lp', 'Lr', 'FcrA', 'MncL', 'Mnc', 'Mnt']) P('A6.' + k, a[k], b[k]);
    P('A6.am.fl', a.am.fl, b.am.fl);
  }
  return out;
}
/* GirderDetail's check items of one row -> ours */
const IDS = new Set(['GS5', 'GS6', 'GS7', 'GS8', 'GS9', 'GS10', 'GS12', 'GS13', 'GS19']);
function itemPairs(CK, byName, mine) {
  const out = [];
  for (const c of CK) { if (!IDS.has(c.id)) continue;
    for (const it of c.items) {
      const m = /^(@\d+|[^,:]+?)(?:(, nonprismatic L_b)|, (compression flange|tension flange)|: (not permitted)|, (Strength I, bottom flange)|, (deck placement).*|, (top|bottom))?( \(not the method in use\))?$/.exec(it.loc);
      if (!m) continue; if (m[6]) continue; const nm = m[1], o = mine[nm]; if (!o) continue;
      if (!isFinite(it.r) && it.st !== 'na' && c.id !== 'GS19') continue;   // warning lines (nonprismatic notes)
      let key;
      if (c.id === 'GS5') key = 'duct'; else if (c.id === 'GS6') key = m[3] === 'compression flange' ? 'ncC' : m[3] === 'tension flange' ? 'ncT' : 'mn';
      else if (c.id === 'GS7') key = 'fnc'; else if (c.id === 'GS8') key = 'fnt'; else if (c.id === 'GS9') key = m[4] ? 'a6' : m[3] === 'compression flange' ? 'a6c' : 'a6t';
      else if (c.id === 'GS10') key = 'fl'; else if (c.id === 'GS12') key = m[7] === 'top' ? 'svt' : 'svb'; else if (c.id === 'GS13') key = 'web'; else key = 'rev';
      const q = o.checks.find(x => x.id === c.id && x.key === key);
      if (!q) { out.push([`${nm} ${c.id} ${key}: missing`, 0, 1]); continue; }
      if (it.st === 'na' || it.oos) { out.push([`${nm} ${c.id} ${key} na`, !q.inUse && !isFinite(q.ratio), true]); continue; }
      if (c.id === 'GS19') { out.push([`${nm} GS19`, q.ok, it.st === 'pass']); continue; }
      out.push([`${nm} ${c.id} ${key} ratio`, q.ratio, it.r]); out.push([`${nm} ${c.id} ${key} pass`, q.ok, it.st === 'pass']);
      if (/not the method in use/.test(it.loc)) out.push([`${nm} ${c.id} ${key} in use`, q.inUse, false]);   // GirderDetail marks a failing item of the other method only
      else if (!q.inUse) out.push([`${nm} ${c.id} ${key} not in use, passes`, q.ok, true]);
    }
  }
  return out;
}
const stats = { cases: 0, rows: 0, vals: 0, items: 0, diffs: [], worst: { rel: 0 }, a6: {} };
function cmp(list, where) {
  for (const [k, a, b] of list) {
    stats.vals++;
    if (Object.is(a, b) || (a === b)) continue;
    if (typeof a === 'number' && typeof b === 'number' && Number.isNaN(a) && Number.isNaN(b)) continue;
    const rel = typeof a === 'number' && typeof b === 'number' && isFinite(a) && isFinite(b) ? Math.abs(a - b) / Math.max(1e-300, Math.abs(b)) : Infinity;
    if (rel < 1e-12) { if (rel > stats.worst.rel) stats.worst = { rel, what: `${where} ${k}` }; continue; }
    stats.diffs.push(`${where} ${k}: ${a} vs GirderDetail ${b}`);
    if (rel > stats.worst.rel) stats.worst = { rel, what: `${where} ${k}` };
  }
}
function runCase(GS, name, prj, locs, skews, over) {
  stats.cases++;
  const rows = locs.map((L, i) => gdRow(GS, L, i)), { R, CK } = gdRunCase(GS, gdModule(GS, prj, rows, over), skews);
  const prj2 = over && over.negM === '6108' ? { ...prj, a6: { ...prj.a6, method: '6108' } } : prj;
  const G = FX.girder(locs, prj2, {}), mine = {};
  G.rows.forEach(o => { mine[o.name] = o; });
  R.rows.forEach((r, i) => { stats.rows++; cmp(rowPairs(G.rows[i], r), `${name} ${r.name}`);
    if (!r.pos) { const k = name.replace(/_G\d.*$/, ''); (stats.a6[k] = stats.a6[k] || { ok: 0, no: 0, skew: 0 }); stats.a6[k][r.A6.ok ? 'ok' : 'no']++; if (r.A6.why.some(s => /skewed/.test(s))) stats.a6[k].skew++; } });
  const ip = itemPairs(CK, null, mine); stats.items += ip.length; cmp(ip, name);
  return { R, G };
}

test('parity with GirderDetail Girder section (GS5–GS10, GS12, GS13, GS19) at every station of the 100 gd_*.json payloads + built-in rows', () => {
  const GS = gdGirderSection(), t0 = Date.now();
  ['f0', 'f2', 'f3', 'frac', 'esc'].forEach(k => GS.fn(k));   // loaded before compute runs many times (gd-source.mjs: optimized code does not see a const added later)
  const builtins = () => {
  const d = GS.ctx.GM.gs.def, nr = SEC.modularRatio(d.fc, d.wc, d.K1, d.nRule).n, GR = { '50W': 50, HPS70W: 70 };
  const bi = (rowsOver, gT, over, skews) => {
    const prj = { deck: { ts: d.ts, tdeck: d.tdeck, haunch: d.hh, rebar: { top: { A: d.Art, c: d.crt }, bot: { A: d.Arb, c: d.crb } } }, mat: { Fyt: GR[gT], Fyb: GR[gT], Fyw: 50, Fyr: d.Fyr, fc: d.fc }, n: nr, wc: d.wc, G: FX.factors(), a6: { method: 'auto', skews } };
    const locs = d.rows.map((r, i) => ({ name: `@${i}`, x: null, region: r.region, cont: r.cont === 'yes', plates: { D: r.D, tw: r.tw, topB: r.topB, topT: r.topT, botB: r.botB, botT: r.botT }, beff: r.beff, Lb: r.Lb, Cb: r.Cb, fl: 0, npr: null,
      M: { DC1: r.MDC1, DC2: r.MDC2, DW: r.MDW, LLp: r.MLLp, LLn: r.MLLn, UT: 0, UF: 0, FATp: r.MfP, FATn: r.MfN }, ...rowsOver(i) }));
    return runCase(GS, `built-in ${gT}${over ? ' ' + JSON.stringify(over) : ''}${skews.length ? ' skew ' + skews[0] : ''}`, prj, locs, skews, { gT, gB: gT, gW: '50W', ...(over || {}) });
  };
  const B = bi(() => ({}), '50W', null, []);
  bi(() => ({ fl: 6 }), '50W', null, []); bi(() => ({ Cb: 1.4, fl: 4 }), 'HPS70W', null, []); bi(() => ({}), '50W', { negM: '6108' }, []); bi(() => ({}), '50W', null, [28, 28]);
  bi(i => ({ npr: { kind: 'simp', b: 16, t: 1.5 } }), '50W', null, []);
  bi(i => ({ npr: { kind: 'ge', b: 18, t: 1.25, K: 1.2 } }), '50W', null, []);
  bi(i => ({ npr: { kind: 'ge', b: 18, t: 1.25, geA: { m: 'A', ge: 1.8 }, gov: { x: 100, topB: 18, topT: 1, botB: 18, botT: 1.25, tw: 0.5625, MDC1: -1900, MDC2: -280, MDW: -300, MLL: -2100 } } }), '50W', null, []);
  return B; };
  const B0 = builtins();   // GirderDetail's built-in rows first: every branch of compute/checks runs once before the payloads
  for (const f of payloads) {
    const pl = readP(f), F = FX.fromPayload(pl), sk = pl.girderDetail.skew.bySupport;
    runCase(GS, f, F.prj, F.locs, sk);
    if (/_AASHTO_G1\.json$/.test(f)) runCase(GS, f + ' (f_l 7.5)', F.prj, F.locs.map(L => ({ ...L, fl: 7.5 })), sk);
  }
  console.log(`       ${stats.cases} cases, ${stats.rows} locations, ${stats.vals} values (${stats.items} check items) compared in ${((Date.now() - t0) / 1000).toFixed(1)} s; ${stats.diffs.length} differ; largest relative difference ${stats.worst.rel ? stats.worst.rel.toExponential(2) + ' (' + stats.worst.what + ')' : '0 (all identical)'}`);
  console.log('       A6 permission at negative-flexure locations (permitted / not / skew > 20°): ' + Object.entries(stats.a6).map(([k, v]) => `${k} ${v.ok}/${v.no}/${v.skew}`).join(', '));
  stats.diffs.slice(0, 25).forEach(s => console.log('       ' + s));
  assert.equal(stats.diffs.length, 0, 'differences from GirderDetail (listed above)');
  assert.ok(stats.rows > 30000);
  // built-in rows: Pier 1 is negative flexure with A6 permitted (no skew); with 28° skew it is not (S2-9)
  assert.equal(B0.G.rows[1].A6.ok, true); assert.equal(B0.G.rows[1].useA6, true);
  assert.equal(stats.a6['built-in 50W skew 28'].ok, 0); assert.equal(stats.a6['built-in 50W skew 28'].skew, 1);
});

test('A6 permission flips with skew as merged in S2-9: builtin28 (28°) never permitted for skew; builtin (15°) has no skew reason', () => {
  for (const f of payloads.filter(f => /^gd_builtin(28)?_AASHTO/.test(f))) {
    const pl = readP(f), F = FX.fromPayload(pl), G = FX.girder(F.locs.filter(L => L.region === 'neg'), F.prj, {}), sk = Math.max(...pl.girderDetail.skew.bySupport);
    assert.ok(G.rows.length > 10, f);
    G.rows.forEach(r => {
      assert.equal(r.A6.why.some(s => /skewed 28°/.test(s)), sk > 20, `${f} ${r.name}`);
      if (sk > 20) { assert.equal(r.A6.ok, false); assert.equal(r.useA6, false); assert.equal(r.checks.find(c => c.id === 'GS9').inUse, false); }
    });
  }
  // the stored hand-off (girderDetail.checks.negFlex, GirderDetail's own run): its A6 values at the governing stations agree with this engine
  let n = 0;
  const byOwner = {};
  for (const f of payloads) {   // every owner: GirderDetail stored these with its owner rules (OWN8: RIDOT/MassDOT haunch 0); the owner is in the file name
    const owner = (/_(AASHTO|RIDOT|MassDOT|CTDOT)(_|\.)/.exec(f) || [])[1] || 'AASHTO';
    const pl = readP(f), nf = pl.girderDetail.checks && pl.girderDetail.checks.negFlex; if (!nf) continue;
    const F = FX.fromPayload(pl, { rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } }, owner });   // the Girder section module's own rebar (its default), not the payload's A_r
    for (const sp of nf.spans) for (const o of [sp.comp, sp.tens]) { if (!o) continue;
      const L = { ...F.locs[0], name: 'x', x: o.x, region: 'neg', plates: o.sec, npr: null, Lb: o.Lb, Cb: 1 }, r = FX.location(L, F.prj), a = o.a6;
      close(r.A6.skM, a.skM, 1e-9, `${f} skM`); close(r.A6.crwP, a.crw, 1e-4, `${f} crw`); close(r.A6.lrwP, a.lrw, 1e-5, `${f} lrw`); close(r.A6.lw, a.lw, 1e-5, `${f} lw`); close(r.A6.Iyc / r.A6.Iyt, a.IycIyt, 1e-4, `${f} Iyc/Iyt`);
      assert.equal(r.A6.why.some(s => /skewed/.test(s)), a.why.some(s => /skewed/.test(s)), `${f} skew reason`);
      assert.equal(r.A6.why.some(s => /slender/.test(s)), a.why.some(s => /slender/.test(s)), `${f} slender web reason`);
      n++; byOwner[owner] = (byOwner[owner] || 0) + 1; }
  }
  console.log('       stored governing items by owner: ' + Object.entries(byOwner).map(([k, v]) => `${k} ${v}`).join(', '));
  assert.ok(n >= 400, `${n} stored governing items`); assert.ok(byOwner.MassDOT > 0 && byOwner.RIDOT > 0, 'OWN8 owners covered');
});

test('bracing(): L_b, C_b and nonprismatic data with Preliminary sizing\'s own fe* functions: identical', () => {
  const FE = gdFe(); let n = 0, kinds = {};
  for (const f of payloads.filter(f => /_AASHTO_G[12]\.json$/.test(f))) {
    const pl = readP(f), A = FX.fromPayload(pl), B = FX.fromPayload(pl, { impl: FE });
    A.locs.forEach((L, i) => { const M = B.locs[i]; n++; kinds[L.npr ? L.npr.kind : L.region] = (kinds[L.npr ? L.npr.kind : L.region] || 0) + 1;
      assert.deepEqual(JSON.parse(JSON.stringify({ Lb: L.Lb, Cb: L.Cb, npr: L.npr })), JSON.parse(JSON.stringify({ Lb: M.Lb, Cb: M.Cb, npr: M.npr })), `${f} ${L.name}`); });
  }
  console.log(`       ${n} locations; ${Object.entries(kinds).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  assert.ok(kinds.ge > 0 && kinds.simp > 0 && kinds.pos > 0);
});

/* ---------- hand checks ---------- */
test('hand check: built-in negative-flexure row (Pier 1), 6.10.8 compression flange', () => {
  // Steel 18 × 1.5 top, 60 × 0.5625 web, 18 × 2 bottom; F_y = 50 ksi; rebar 6.6 in² at 2.5 in below the top of an 8 in slab, 3.2 in² at
  // 1.75 in above its bottom, haunch 2 in; L_b = 20 ft, C_b = 1.0; M_DC1 −2300, M_DC2 −330, M_DW −380, M_LL −2400 kip-ft.
  // γ: all moments negative, adding to the negative moment -> maximum factors: 1.25, 1.25, 1.50, LL 1.75.
  // M_u = 1.25(−2300) + 1.25(−330) + 1.50(−380) + 1.75(−2400) = −2875 − 412.5 − 570 − 4200 = −8057.5 kip-ft
  // Steel: A = 36 + 33.75 + 27 = 96.75 in²; ȳ = [36(1) + 33.75(32) + 27(62.75)]/96.75 = (36 + 1080 + 1694.25)/96.75 = 29.0465 in
  // d = 63.5 in; I_s = 12 + 36(28.0465)² + 10125 + 33.75(2.9535)² + 5.0625 + 27(33.7035)² = 69,227.5 in⁴ (rounded)
  // Steel + rebar: y_rt = 63.5 + 2 + 8 − 2.5 = 71 in, y_rb = 63.5 + 2 + 1.75 = 67.25 in;
  //   A = 96.75 + 6.6 + 3.2 = 106.55; ȳ = (2810.25 + 468.6 + 215.2)/106.55 = 3494.05/106.55 = 32.7926 in
  // D_c = ȳ − t_b = 30.7926 in (the stored hand-off value at Pier 2 of builtin G1 is 30.7926: same section)
  // R_b: 2D_c/t_w = 109.48 ≤ λ_rw = 5.7√(29000/50) = 137.27 -> R_b = 1.0
  // FLB: λ_f = 18/(2·2) = 4.5 ≤ λ_pf = 0.38√580 = 9.152 -> F_nc,FLB = R_bR_hF_yc = 50 ksi
  // LTB: r_t = 18/√(12(1 + 30.7926(0.5625)/(3·18·2))) = 18/√(12 · 1.16038) = 18/3.7316 = 4.8237 in
  //   L_p = 1.1(4.8237)√580 = 127.79 in; F_yr = max(min(35, 50), 25) = 35; L_r = π(4.8237)√(29000/35) = 436.19 in; L_b = 240 in
  //   F_nc,LTB = 1.0[1 − (1 − 35/50)(240 − 127.79)/(436.19 − 127.79)]50 = [1 − 0.3(0.36385)]50 = 44.542 ksi
  const GS = gdGirderSection(), d = GS.ctx.GM.gs.def, r0 = d.rows[1];
  const prj = { deck: { ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: SEC.modularRatio(4, 0.15, 1, 'exact').n, G: FX.factors(), a6: { method: '6108', skews: [] } };
  const r = FX.location({ name: 'Pier 1', region: 'neg', cont: true, plates: { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 }, beff: 114, Lb: 20, Cb: 1, fl: 0,
    M: { DC1: r0.MDC1, DC2: r0.MDC2, DW: r0.MDW, LLp: r0.MLLp, LLn: r0.MLLn, FATp: r0.MfP, FATn: r0.MfN } }, prj);
  close(r.Mu, -8057.5, 1e-12, 'M_u');
  close(r.card.cr.yb, 3494.05 / 106.55, 1e-12, 'ȳ steel + rebar'); close(r.Dc, 3494.05 / 106.55 - 2, 1e-12, 'D_c');
  assert.equal(r.Rb, 1); close(r.lt.FLB, 50, 1e-12, 'F_nc,FLB');
  const rt = 18 / Math.sqrt(12 * (1 + r.Dc * 0.5625 / 108)); close(r.lt.rt, rt, 1e-12, 'r_t'); close(r.lt.rt, 4.8237, 1e-4, 'r_t (rounded)');
  close(r.lt.Lp, 1.1 * rt * Math.sqrt(580), 1e-12, 'L_p'); close(r.lt.Lr, Math.PI * rt * Math.sqrt(29000 / 35), 1e-12, 'L_r');
  close(r.lt.LTB, 44.542, 1e-4, 'F_nc,LTB'); close(r.lt.Fnc, r.lt.LTB, 0, 'F_nc');
  // f_bu: DC1 on steel, the rest on steel + rebar, bottom fibre (y = 0): f = −M(12)(0 − ȳ)/I = M(12)ȳ/I, compression for M < 0
  const fb = -(1.25 * -2300 * 12 * r.card.s.yb / r.card.s.I + (1.25 * -330 + 1.5 * -380 + 1.75 * -2400) * 12 * r.card.cr.yb / r.card.cr.I);
  close(r.fbuC, fb, 1e-12, 'f_bu'); close(r.checks.find(c => c.id === 'GS7').ratio, fb / r.lt.LTB, 1e-12, 'GS7 ratio');
  // the worked step of the compression-flange check reads ... ≤ 44.54
  const st = r.steps.find(x => x.id === 'fx.fnc.ok'); assert.match(STEPS.line(st, false), /≤ 44\.54/); assert.match(st.ref, /AASHTO LRFD 10th Ed\./);
});

test('hand check: built-in positive-flexure row (Span 1), compact composite section, 6.10.7.1', () => {
  // 16 × 0.75 top, 60 × 0.5625 web, 16 × 1.125 bottom; b_eff 114, t_s 8, haunch 2, f'c 4, F_y 50; continuous span.
  // Plastic: P_s = 0.85(4)(114)(8) = 3100.8; P_c = 50(12) = 600; P_w = 50(33.75) = 1687.5; P_t = 50(18) = 900 kip
  //   Case I: P_t + P_w = 2587.5 < P_c + P_s = 3700.8; Case II: P_t + P_w + P_c = 3187.5 ≥ P_s -> PNA in the top flange
  //   Ȳ = (0.75/2)[(1687.5 + 900 − 3100.8)/600 + 1] = 0.375(0.14450) = 0.054188 in; D_cp = 0 -> compact (2D_cp/t_w = 0 ≤ 90.6)
  // d = 61.875; D_t = 61.875 + 2 + 8 = 71.875; y_p = 61.875 − 0.054188 = 61.820813; D_p = 71.875 − 61.8208 = 10.0542 in
  // D_p/D_t = 0.13988 > 0.1 -> M_n = M_p(1.07 − 0.7(0.13988)) = 0.97208 M_p
  // Ductility: D_p = 10.054 ≤ 0.42(71.875) = 30.19 in
  // M_u = 1.25(1450 + 210) + 1.50(240) + 1.75(1650) = 2075 + 360 + 2887.5 = 5322.5 kip-ft
  const prj = { deck: { ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: SEC.modularRatio(4, 0.15, 1, 'exact').n, G: FX.factors(), a6: {} };
  const r = FX.location({ name: 'Span 1', region: 'pos', cont: true, plates: { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }, beff: 114, Lb: 25, Cb: 1, fl: 0,
    M: { DC1: 1450, DC2: 210, DW: 240, LLp: 1650, LLn: -400, FATp: 620, FATn: -150 } }, prj);
  close(r.Mu, 5322.5, 1e-12, 'M_u'); assert.equal(r.pl.cs, 'II'); close(r.pl.Yb, 0.375 * ((1687.5 + 900 - 3100.8) / 600 + 1), 1e-12, 'Ȳ');
  assert.equal(r.compact, true); close(r.Dp, 71.875 - (61.875 - r.pl.Yb), 1e-12, 'D_p'); close(r.Dp, 10.0542, 1e-5, 'D_p (rounded)');
  close(r.Mn0, r.pl.Mp * (1.07 - 0.7 * r.Dp / 71.875), 1e-12, 'M_n'); close(r.Mn0 / r.pl.Mp, 0.97208, 1e-5, 'M_n/M_p');
  const g6 = r.checks.find(c => c.id === 'GS6'); close(g6.demand, 5322.5, 1e-12, 'GS6 demand'); close(g6.capacity, Math.min(r.Mn0, r.cap13), 0, 'GS6 capacity');
  const g5 = r.checks.find(c => c.id === 'GS5'); close(g5.capacity, 0.42 * 71.875, 1e-12, 'GS5'); assert.equal(g5.ok, true);
  // SB2-C1 (display only): each factor × moment is written with parentheses, also for a positive moment (before: "1.251450.00")
  assert.equal(STEPS.line(r.steps.find(x => x.id === 'fx.Mu'), false).split(' = ').slice(-2).join(' = '), '1.25(1450.00) + 1.25(210.00) + 1.50(240.00) + 1.75(1650.00) = 5322.5 kip-ft');
  assert.match(STEPS.line(r.steps.find(x => x.id === 'fx.Ms'), false), /1450\.00 \+ 210\.00 \+ 240\.00 \+ 1\.30\(1650\.00\)/);
});

test('factored demands as input give the same checks as the unfactored ones', () => {
  const prj = { deck: { ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: 8.0, G: FX.factors(), a6: { method: 'auto', skews: [] } };
  const base = { name: 'P', region: 'neg', cont: true, plates: { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 }, beff: 114, Lb: 20, Cb: 1.2, fl: 3 };
  const u = FX.location({ ...base, M: { DC1: -2300, DC2: -330, DW: -380, LLp: 250, LLn: -2400, FATp: 120, FATn: -520 } }, prj);
  const f = FX.location({ ...base, factored: { str: { DC1: 1.25 * -2300, DC2: 1.25 * -330, DW: 1.5 * -380, LL: 1.75 * -2400 }, svc: { DC1: -2300, DC2: -330, DW: -380, LL: 1.3 * -2400 }, fat: { p: 1.75 * 120, n: 1.75 * -520 } } }, prj);
  for (const c of u.checks.filter(c => isFinite(c.ratio))) close(f.checks.find(q => q.id === c.id && q.key === c.key).ratio, c.ratio, 1e-12, c.id + ' ' + c.key);
  close(f.dfB, u.dfB, 1e-12, 'Δf bottom');
});

test('steps: ids unique, no undefined/NaN, every check links to a step', () => {
  const pl = readP('gd_builtin_AASHTO_G2.json'), F = FX.fromPayload(pl, { fl: 5 });
  const pick = F.locs.filter((L, i) => i % 23 === 0 || (L.npr && i % 5 === 0)); let nA6 = 0;
  for (const L of pick) { const r = FX.location(L, F.prj), ids = r.steps.map(s => s.id);
    assert.equal(new Set(ids).size, ids.length, `${L.name} ids unique`);
    r.steps.forEach(s => assert.ok(!/undefined|NaN/.test(STEPS.line(s, true)), `${L.name} ${s.id}: ${STEPS.line(s, true)}`));
    r.checks.forEach(c => { assert.ok(ids.includes(c.step), `${L.name} ${c.id} ${c.key}: step ${c.step}`); assert.match(c.ref, /AASHTO LRFD 10th Ed\./); });
    // SB2-O14 (text only): composite, the tension flange is continuously braced by the deck, Eq. A6.1.4-1 (was A6.1.2-1)
  }
  // a stocky web (D 36 × 3/4: 2D_c/t_w < λ_rw), negative flexure, composite: Appendix A6 permitted
  const prj = { deck: { ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } } }, mat: { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 }, n: SEC.modularRatio(4, 0.15, 1, 'exact').n, G: FX.factors(), a6: { method: 'auto', skews: [] } };
  const rA = FX.location({ name: 'Pier', region: 'neg', cont: true, plates: { D: 36, tw: 0.75, topB: 18, topT: 1.5, botB: 18, botT: 2 }, beff: 114, Lb: 20, Cb: 1, fl: 0, M: { DC1: -900, DC2: -150, DW: -150, LLp: 300, LLn: -1000 } }, prj);
  rA.checks.filter(c => c.key === 'a6t').forEach(c => { nA6++; assert.match(c.ref, /Eq\. A6\.1\.4-1/); assert.match(c.title, /continuously braced/); assert.match(rA.steps.find(s => s.id === 'fx.a6t.ok').ref, /Eq\. A6\.1\.4-1/); });
  assert.ok(nA6 > 0, 'some A6 tension flange items');
});
