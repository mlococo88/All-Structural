// apps/steel-bridge/engine/welds.js against GirderDetail's own Welds and transitions module (GM.wt.compute, GM.wt.checks), taken from
// "Steel Bridge Design.html" and run in a Node vm (gd-source.mjs).
//
// 1. GirderDetail's built-in input (GM.wt.def) and variations of it (owner factors η, m and the haunch rule, utilities, the pedestrian
//    part of LL+IM, grades, n rounded, weld sizes, Category C, radius and missing width transitions, a thinner larger side, input errors).
// 2. The 100 tests/projects/st/gd_*.json hand-off payloads: the weld locations and transitions of each girder made from the file's
//    demands (demandsFromPayload + fromDemands: every support side and both sides of every plate change; each shop flange transition),
//    with the file's deck, materials and owner factors, given to both GirderDetail's GM.wt and this engine: every value and every check
//    item. (GirderDetail's Preliminary sizing makes its own rows from its own analysis: the weld rows are this app's, the calculation is
//    GirderDetail's.)
// 3. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdBlock, gdDecl } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('sections.js'), ENG('shear.js'), ENG('welds.js'));
const WT = W.SBDWelds;
const clone = o => JSON.parse(JSON.stringify(o)), J = clone;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

/* ---------- GirderDetail in Node ---------- */
const TAG = '\n// welds.test.mjs';
let GD = null;
function run(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
const PRE = ['ES', 'T', 'GD_GR', 'RANK', 'PHI', 'ge', 'worst', 'sum', 'parseDim', 'nm', 'numRows', 'rc', 'gvR', 'ckNew', 'LE', 'GE', 'f0', 'f2', 'f3', 'frac', 'esc',
  'LF_ONE', 'gdLF', 'gdOwnM', 'OWN_K', 'gdHP', 'gdPLq', 'gdPLe', 'gdUt', 'gdUtOn', 'gdGLq', 'gdGLh', 'gdGLb', 'modRatio', 'steelProps', 'addPart', 'secSet', 'rowDk', 'wMinFor', 'WT_FSPEC', 'WT_TSPEC'];
function gd() {
  if (GD) return GD;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: {} }, wt: null }; var GM = {};', ctx);
  const loaded = new Set();
  PRE.forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  run(ctx, c => vm.runInContext(gdBlock('GM.wt = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.wt)' }), loaded);
  GD = { ctx, wt: (p, lf) => { ctx.P = { df: { bridge: lf ? { lf: { v: 1, o: null, eD: 1, eR: 1, eI: 1, ...lf } } : {} }, wt: clone(p) };
    return run(ctx, c => { const R = c.GM.wt.compute(c.P.wt); return { R, C: R.errors.length ? null : c.GM.wt.checks(R) }; }, loaded); } };
  return GD;
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
const FK = ['vuT', 'vuB', 'Rw', 'Rweb', 'frT', 'frB', 'wminT', 'wminB', 'VLL'], TK = ['I', 'Qt', 'Qb', 'vt', 'vb', 'gm', 'V'], RK = ['fp', 'fn', 'df', 'cat', 'th', 'slopeT', 'dbw', 'slopeW', 'A1', 'A2'];
function cmpAll(m, g, where) {
  if (g.R.errors.length || m.errors.length) { cmp([['errors', JSON.stringify([...m.errors]), JSON.stringify([...g.R.errors])]], where); return; }
  const R = g.R; cmp([['n', m.MR.n, R.MR.n], ['Fexx', m.Fexx, R.Fexx], ['Fuw', m.Fuw, R.Fuw], ...['dc', 'dw', 'll', 'fat'].map(k => [`g.${k}`, m.g[k], R.g[k]]), ...['ts', 'hh', 'beff', 'n', 'Ar', 'dr'].map(k => [`dk.${k}`, m.dk[k], R.dk[k]])], where);
  R.fw.forEach((r, i) => { const q = m.fw[i]; cmp(FK.map(k => [k, q[k], r[k]]).concat([['nterms', q.terms.length, r.terms.length], ['plAdj', JSON.stringify(q.plAdj || null), JSON.stringify(r.plAdj || null)]]), `${where} fw ${i}`);
    r.terms.forEach((t, j) => cmp(TK.map(k => [k, q.terms[j][k], t[k]]).concat([['name', q.terms[j].n, t.n], ['sec', q.terms[j].sn, t.sn]]), `${where} fw ${i} term ${j}`)); });
  R.tr.forEach((r, i) => cmp(RK.map(k => [k, m.tr[i][k], r[k]]), `${where} tr ${i}`));
  const C = WT.checks(m);
  cmp([['check ids', C.map(c => c.id).join(), g.C.map(c => c.id).join()]], where);
  g.C.forEach(c => { const q = C.find(x => x.id === c.id); if (!q) return;
    cmp([[`${c.id} n`, q.items.length, c.items.length], [`${c.id} status`, q.status, c.status], [`${c.id} gov`, q.gov, c.gov], [`${c.id} na`, !!q.naWhy, !!c.naWhy]], where);
    c.items.forEach((it, k) => { const a = q.items[k] || {}; stats.items++; cmp([[`${c.id}[${k}] loc`, a.loc, it.loc], [`${c.id}[${k}] st`, a.st, it.st], [`${c.id}[${k}] r`, a.r ?? null, it.r ?? null]], where); }); });
  const ids = new Set(); m.fw.forEach(r => WT.steps(m, 'fw', r.i).forEach(s => ids.add(s.id))); m.tr.forEach(r => WT.steps(m, 'tr', r.i).forEach(s => ids.add(s.id)));
  C.forEach(c => c.items.forEach(it => assert.ok(!it.step || ids.has(it.step), `${where}: step ${it.step} not worked`)));
}

function variants() {
  const v = [], b = () => clone(WT.DEFAULT);
  v.push(['built-in', b(), null]);
  v.push(['owner η 1.05, m 1.10, haunch 0', b(), { eta: 1.05, etaN: 0.95, m: 1.1, h0: true }]);
  { const p = b(); p.fw[0].pl = { VLL: [12, 95] }; v.push(['pedestrian part of LL+IM, m 1.2', p, { eta: 1, etaN: 1, m: 1.2, h0: false }]); }
  { const p = b(); p.fw[0].ut = { VUT: 4, VUF: 3 }; v.push(['utilities', p, null]); }
  { const p = b(); p.gW = 'HPS70W'; p.nRule = 'round'; p.Fexx = 80; p.fw[0].w = 0.25; p.fw[0].beff = 96; v.push(['grades, n rounded, 1/4 in weld, row b_eff', p, null]); }
  { const p = b(); p.fw.push({ ...p.fw[0], name: 'thick flanges', topT: 1.5, botT: 2, w: 0.25, Vfr: 0 }); p.tr[0].ground = 'no'; p.tr[0].b2 = 20; p.tr[0].wType = 'radius'; p.tr[0].Lw = 20; v.push(['Category C, radius, no fatigue shear', p, null]); }
  { const p = b(); p.tr.push({ ...p.tr[0], name: 'width change not detailed', fl: 'top', b1: 14, t1: 1, b2: 18, t2: 0.875, wType: 'none', Lt: 0, Ar: 5, dr: 3 }); p.tr.push({ ...p.tr[0], name: 'steep taper', b2: 22, wType: 'taper', Lw: 5, Lt: 0.5, t2: 3 }); v.push(['width not detailed, steep tapers, row A_r', p, null]); }
  { const p = b(); p.tr = []; v.push(['no transitions', p, null]); }
  { const p = b(); p.fw[0].D = ''; p.ts = 0; v.push(['input errors', p, null]); }
  { const p = b(); p.fw = []; p.tr = []; v.push(['nothing entered', p, null]); }
  return v;
}

test('parity with GirderDetail Welds and transitions (FW1–FW4, TR1–TR4): the built-in input and variations', () => {
  const G = gd();
  assert.equal(JSON.stringify(WT.DEFAULT), JSON.stringify(G.ctx.GM.wt.def), 'DEFAULT = GM.wt.def');
  const cases = variants(); cases.forEach(([, p, lf]) => G.wt(p, lf));   // warm-up (gd-source.mjs)
  for (const [where, p, lf] of cases) cmpAll(WT.compute(clone(p), lf ? { lf } : {}), G.wt(p, lf), where);
  assert.deepEqual(stats.diffs.slice(0, 20), [], `${stats.diffs.length} differences`);
});

const DIR = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(DIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
test('parity with GirderDetail Welds and transitions on the 100 gd_* payloads (rows from the file\'s demands)', () => {
  const G = gd(); let nF = 0, nT = 0, nP = 0; const gov = {};
  const s0 = { vals: stats.vals, items: stats.items, n: stats.diffs.length };
  for (const f of payloads) {
    const pl = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload, d = WT.demandsFromPayload(pl), p = WT.fromDemands(d.D, { gen: d.gen });
    const g = G.wt(p, d.env.lf), m = WT.compute(clone(p), { lf: d.env.lf });
    assert.deepEqual([...m.errors], [], f); cmpAll(m, g, f); nP++; nF += m.fw.length; nT += m.tr.length;
    WT.checks(m).forEach(c => c.items.forEach(it => { if (typeof it.r === 'number' && (!gov[c.id] || it.r > gov[c.id].r)) gov[c.id] = { r: it.r, w: `${f} ${it.loc}` }; }));
  }
  console.log(`       ${nP} payloads: ${nF} weld locations, ${nT} transitions; ${stats.vals - s0.vals} values, ${stats.items - s0.items} check items; ${stats.diffs.length - s0.n} differ; largest relative difference ${stats.worst.rel.toExponential(2)}${stats.worst.what ? ' (' + stats.worst.what + ')' : ''}`);
  Object.entries(gov).forEach(([k, o]) => console.log(`       largest ${k} ratio ${o.r.toFixed(4)}: ${o.w}`));
  assert.equal(nP, 100);
  assert.deepEqual(stats.diffs.slice(0, 20), [], `${stats.diffs.length} differences`);
});

test('fromDemands: left and right of supports and plate changes, transitions skip field splices', () => {
  const pl = JSON.parse(fs.readFileSync(path.join(DIR, 'gd_builtin_AASHTO_G1.json'), 'utf8')).payload, d = WT.demandsFromPayload(pl), p = WT.fromDemands(d.D, { gen: d.gen });
  // 4 supports: Abut. 1 (right), Pier 1 left/right, Pier 2 left/right, Abut. 2 (left) = 6 rows; 8 plate changes × 2 sides = 16 rows
  assert.equal(p.fw.length, 22);
  // plate changes at 82, 100, 127, 145, 215, 233, 260, 278 ft; field splices (stud gaps) at 82, 145, 215, 278: shop transitions at 100, 127, 233, 260 (both flanges)
  assert.equal(JSON.stringify(p.tr.map(r => r.x)), '[100,100,127,127,233,233,260,260]');
  assert.ok(p.tr.every(r => Math.abs(r.Lt - 2.5 * (r.t2 - r.t1)) < 1e-12 && r.ground === 'yes'));
});

test('hand checks: FW1–FW4 and TR1–TR4 on GirderDetail\'s built-in input', () => {
  const R = WT.compute(clone(WT.DEFAULT)), r = R.fw[0], t = R.tr[0], C = WT.checks(R), it = id => C.find(c => c.id === id).items;
  // R_r = 2(0.6)(0.80)(70)(0.707)(0.3125) = 67.2 × 0.2209375 = 14.8470 kip/in (2 × 0.6 × 0.8 = 0.96; 0.96 × 70 = 67.2; 0.707 × 0.3125 = 0.2209375)
  assert.ok(Math.abs(r.Rw - 14.847) < 1e-3, String(r.Rw));
  // web: 0.80(0.58)(70)(0.5625) = 0.464 × 70 = 32.48; × 0.5625 = 18.27 kip/in
  assert.ok(Math.abs(r.Rweb - 18.27) < 1e-9, String(r.Rweb));
  // DC1 on the steel: plates 16 × 3/4, 60 × 9/16, 16 × 1 1/8: A = 12 + 33.75 + 18 = 63.75 in²; ȳ = (18(0.5625) + 33.75(31.125) + 12(61.5))/63.75
  //   = (10.125 + 1050.469 + 738)/63.75 = 1798.594/63.75 = 28.2132 in; Q_t = 12(61.5 − 28.2132) = 399.44 in³.
  const t0 = r.terms[0]; assert.ok(Math.abs(t0.yb - 28.2132) < 1e-4, String(t0.yb)); assert.ok(Math.abs(t0.Qt - 399.44) < 0.01, String(t0.Qt));
  // Q_b = 18(28.2132 − 0.5625) = 497.71 in³; v = 1.25(60)Q/I: the chain on the section's I
  assert.ok(Math.abs(t0.Qb - 497.71) < 0.01, String(t0.Qb)); assert.ok(Math.abs(t0.vb - 1.25 * 60 * t0.Qb / t0.I) < 1e-15);
  // FW4: top flange 3/4 in (thicker part 3/4 ≤ 3/4) → 1/4 in; bottom 1 1/8 > 3/4 → 5/16 in; w = 5/16: both pass, ratios 0.8 and 1.0
  assert.equal(JSON.stringify(it('FW4').map(i => [i.st, i.r])), '[["pass",0.8],["pass",1]]');
  // FW1 bottom: v_u = Σ terms ≤ 14.847; FW3: γ = 1.75, V_f = 45: Δf = 1.75(45)Q_b,n/I_n/(2(0.707)(0.3125))
  const L = r.terms[3]; assert.ok(Math.abs(r.frB - 1.75 * 45 * L.Qb / L.I / 0.441875) < 1e-12);
  // TR1: bottom flange 16 × 1 1/8 to 16 × 1 1/2, y = 0.5625 in; Δt = 0.375 in over L_t = 1 in: slope 0.375 ≤ 0.4 (TR2 ratio 0.9375);
  // t_1/t_2 = 1.125/1.5 = 0.75 ≥ 0.5, A_1/A_2 = 18/24 = 0.75 (TR4 pass); no width change (TR3 n/a); Category B (ground), (ΔF)_TH = 16 ksi.
  assert.equal(t.y, 0.5625); assert.equal(it('TR2')[0].r, 0.375 / 0.4); assert.equal(C.find(c => c.id === 'TR3').items.length, 0); assert.equal(t.th, 16);
  assert.equal(JSON.stringify(it('TR4').map(i => [i.st, i.value])), '[["pass",0.75],["pass",0.75]]');
  // f+ = 650(12)(ȳ_n − 0.5625)/I_n, f− = 180(12)(ȳ_r − 0.5625)/I_r; γΔf = 1.75(f+ + f−)
  assert.ok(Math.abs(t.df - 1.75 * (650 * 12 * (t.S.cn.yb - 0.5625) / t.S.cn.I + 180 * 12 * (t.S.r.yb - 0.5625) / t.S.r.I)) < 1e-12);
  const s = WT.steps(R, 'fw', 0).find(o => o.id === 'wf0.Rw');   // rendered line assert.equal(W.SharedSteps.line(s, false), 'R_r = 2(0.6)φ_(e2)F_(exx)(0.707w) = 2(0.6)(0.80)(70)(0.707)(0.3125) = 14.847 kip/in');
});

test('Welds tab (ui/welds.js build): the default project, every girder, from this app\'s analysis', () => {
  const E = f => path.join(ROOT, 'apps/steel-bridge', f);
  const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
    E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/framing.js'), E('engine/analysis.js'), E('engine/welds.js'), E('ui/welds.js'));
  const P = U.SBDModel.defaultProject(); assert.equal(U.SBDModel.validate(P).errors.length, 0);
  P.girders.forEach((g, gi) => { const B = U.SBDWeldsUI.build({ P, g: gi }); assert.ok(!B.err, B.err);
    // 3 spans: Abut. 1 R, Pier 1 L/R, Pier 2 L/R, Abut. 2 L (6) + 4 plate changes × 2 sides (8); plate changes at 88, 128, 232, 272 ft,
    // field splices 82, 145, 215, 278 ft (none within 0.5 ft): 4 changes × 2 flanges = 8 transitions
    assert.equal(B.R.fw.length, 14); assert.equal(B.R.tr.length, 8);
    console.log(`       ${g.label}: FW1 ${B.gov.FW1.loc} ${B.gov.FW1.r.toFixed(4)}; FW2 ${B.gov.FW2.r.toFixed(4)}; FW3 ${B.gov.FW3.loc} ${B.gov.FW3.r.toFixed(4)}; TR1 ${B.gov.TR1.loc} ${B.gov.TR1.r.toFixed(4)}`);
    B.C.forEach(c => c.items.forEach(it => assert.ok(!Number.isNaN(it.r), `${c.id} ${it.loc}`))); });
  const p2 = JSON.parse(JSON.stringify(P)); p2.deck.composite = false; assert.ok(U.SBDWeldsUI.build({ P: p2, g: 0 }).err);
});

test('Welds tab load factors (2026-11-01): the project\'s, not P.welds.gam (kept, unused, reported); the strength check headlines the summary', () => {
  const E = f => path.join(ROOT, 'apps/steel-bridge', f);
  const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'), E('engine/loads.js'),
    E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/framing.js'), E('engine/analysis.js'), E('engine/welds.js'), E('ui/welds.js'));
  const UI = U.SBDWeldsUI, P = U.SBDModel.defaultProject(), B0 = UI.build({ P, g: 0 });
  // the defaults: γ_DC 1.25, γ_DW 1.50, γ_LL 1.75 (Table 3.4.1-1), Fatigue I 1.75 (the Fatigue & studs input), the same as the old defaults of P.welds.gam
  assert.equal(JSON.stringify(UI.projGam(P)), '{"dc":1.25,"dw":1.5,"ll":1.75,"fat":1.75}'); assert.equal(JSON.stringify(B0.R.g), JSON.stringify(UI.projGam(P))); assert.equal(UI.oldGam(P).length, 0);
  // an old project with γ_LL 1.50 and Fatigue I 1.50 saved on this tab: the results are the default project's; the values stay in the file and are reported
  const Q = J(P); Q.welds.gam = { dc: 1.25, dw: 1.50, ll: 1.50, fat: 1.50 }; const BQ = UI.build({ P: Q, g: 0 });
  assert.equal(JSON.stringify(BQ.C.map(c => c.items.map(it => it.r))), JSON.stringify(B0.C.map(c => c.items.map(it => it.r))));
  assert.equal(JSON.stringify(Q.welds.gam), '{"dc":1.25,"dw":1.5,"ll":1.5,"fat":1.5}'); assert.equal(U.SBDModel.validate(Q).errors.length, 0);
  assert.equal(JSON.stringify(UI.oldGam(Q).map(o => [o.k, o.was, o.now])), '[["ll",1.5,1.75],["fat",1.5,1.75]]');
  // hand check, G1 Pier 2 left, top (FW1 governing): v_u = Σ γ V Q/I; the LL+IM term 1.75(129.164)(2549.405)/162131.93 = 3.5543 kip/in (with the old
  // γ_LL 1.50: 3.0465); v_u = 1.6324 + 0.3300 + 0.3280 + 3.5543 = 5.8446 kip/in; R_r = 14.847 kip/in; FW1 = 5.8446/14.847 = 0.3937 (was 0.3595)
  const r = B0.R.fw.find(q => B0.gov.FW1.loc === `${q.name}, top`), t = r.terms.find(q => q.n === 'LL+IM');
  near(t.vt, 1.75 * t.V * t.Qt / t.I, 1e-12, 'LL term'); near(t.vt, 3.5543, 1e-4, 'LL term value'); near(r.vuT, 5.8446, 1e-4, 'v_u'); near(B0.gov.FW1.r, 0.3937, 1e-4, 'FW1');
  // the Fatigue I factor follows the Fatigue & studs input: 1.50 → FW3 and TR1 × 1.50/1.75
  const F = J(P); F.fatigue.gam.fI = 1.5; const BF = UI.build({ P: F, g: 0 }); near(BF.gov.FW3.r, B0.gov.FW3.r * 1.5 / 1.75, 1e-12, 'FW3'); near(BF.gov.TR1.r, B0.gov.TR1.r * 1.5 / 1.75, 1e-12, 'TR1');
  assert.equal(BF.gov.FW1.r, B0.gov.FW1.r);
  // the summary: the strength check (FW1 / FW2) headlines, not FW4 at 1.000 (the minimum weld size)
  assert.equal(B0.gov.FW4.r, 1); const sg = UI.strengthGov(B0.C); assert.equal(sg.c.id, 'FW1'); assert.equal(sg.it, B0.gov.FW1);
  assert.equal(JSON.stringify(UI.SUM.flatMap(q => q[2]).sort()), JSON.stringify(B0.C.map(c => c.id).sort()), 'every check is in a summary group');
});
