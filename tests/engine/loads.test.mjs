// apps/steel-bridge/engine/loads.js, lldf.js and owners.js against GirderDetail's own LLDF and DLs module (GM.df.compute in
// "Steel Bridge Design.html", run in a Node vm with the declarations it reads, through gd-source.mjs's gdBlock / gdRun).
//
// Inputs: tests/projects/sbd2-loads/<project>_<owner>.json, GirderDetail's P.df (the module inputs and the bridge Preliminary
// sizing sends it) recorded from the page itself by tests/engine/record-loads.mjs for the 5 projects × 4 owners of the 100
// tests/projects/st/gd_*.json hand-off payloads, with GirderDetail's own result of the page in the browser.
// 1. GirderDetail in Node = GirderDetail in the browser (the recorded result), so the Node run is the app's.
// 2. This engine = GirderDetail in Node: every region's K_g, e_g, skew factors, every girder's one- and multi-lane moment and
//    shear factors, g_M, g_V, fatigue factors, method, the lever-rule and rigid cross-section trials; the dead loads: tributary
//    widths, deck, haunch, SIP forms, every line load (x, w, rule) and each girder's share, DC1 / DC2 / DW / PL / UT / UF, the beam
//    classes. Expected: identical (the port keeps GirderDetail's operations in the same order).
// 3. The 100 payloads: girderDetail.df (per span g_M, g_V, fatigue; per pier g_M) and girderDetail.loads (each component's w, the
//    totals, the distribution method and beam class, the lanes, roadway, deflection factor, the steel self-weight) against this
//    engine, to the payload's 4 decimals. The steel self-weight average of the payload is weighted by the analysis nodes'
//    tributary lengths; here by segment length: compared to 0.2%.
// 4. Variations of the recorded inputs that reach the other branches (curbs, sidewalks thick and thin, fences, median, overlays,
//    added rows of every category and rule, overrides, beam classes, RIDOT 60/40, K_g averaged and simplified, the exterior
//    "not less than interior" policy, shear skew on exterior girders only, skews over 30° and 60°, N_b = 3, S > 16 ft, a 22 ft
//    roadway): this engine = GirderDetail in Node, identical.
// 5. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdBlock, gdDecl } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), 'lldf.js', ENG('lldf.js'), ENG('loads.js'));
const LD = W.SBDLoads, LL = W.SBDLldf, OW = W.SBDOwners, M = W.SBDModel;
const FIX = path.join(ROOT, 'tests/projects/sbd2-loads');
const fixtures = fs.existsSync(FIX) ? fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'))) : [];
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- GirderDetail's GM.df in Node ---------- */
let GD = null;
// Declarations are loaded with a trailing comment of this test, so that V8 does not reuse code compiled for the same text in another
// vm context (sections.test.mjs's): code compiled where a const was not yet declared kept throwing "ES is not defined" there.
const TAG = '\n// loads.test.mjs';
function run(ctx, fn, loaded) {   // gd-source.mjs gdRun, with the tagged declarations
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
function gdDf() {
  if (GD) return GD;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: null } }; var GM = {};', ctx);
  const loaded = new Set(), lit = gdBlock('GM.df = {', '\n};\n') + '\n};' + TAG;
  // every declaration GM.df.compute reads, loaded before any call (a function V8 optimizes inside the lever-rule loop does not
  // see a const added to the context afterwards: see gd-source.mjs); run() adds any other on demand
  ['ES', 'sum', 'f2', 'f3', 'parseDim', 'nm', 'numRows', 'modRatio', 'steelProps', 'LF_ONE', 'gdLF', 'gdHP', 'DF_MPF', 'DF_RNG', 'DF_CLS', 'DF_SIMPLE', 'DF_DIST',
    'dfGeometry', 'dfType', 'dfSpacing', 'dfSkew', 'dfEmp', 'dfLeverC', 'dfLever', 'dfLeverAll', 'dfRigid', 'dfMember', 'dfEdges', 'dfDead', 'dfOpt', 'dfXsIn',
    'DF_EDGE_K', 'DF_EDGE_LBL', 'dfEdgeIn', 'dfBridgeEff', 'dfLLFace'].forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  run(ctx, c => vm.runInContext(lit, c, { filename: 'Steel Bridge Design.html (GM.df)' }), loaded);
  const go = df => { ctx.P = { df: clone(df) }; return run(ctx, c => c.GM.df.compute(c.P.df), loaded); };
  GD = { ctx, run: go };
  // warm-up: every path used below runs once before the comparisons
  fixtures.forEach(fx => go(fx.df)); variants().forEach(v => go(v.df));
  return GD;
}

/* ---------- comparison ---------- */
// every number this engine and GirderDetail both produce, as [name, ours, GirderDetail's]
function pairs(o, g) {
  const out = [], P = (k, a, b) => out.push([k, a, b]);
  P('errors', JSON.stringify([...o.errors]), JSON.stringify([...g.errors])); if (o.errors.length || g.errors.length) return out;
  P('n', o.MR.n, g.MR.n); P('rL', o.base.rL, g.base.rL); P('rR', o.base.rR, g.base.rR); P('fL', o.base.fL, g.base.fL); P('fR', o.base.fR, g.base.fR);
  o.regions.forEach((r, k) => { const q = g.regions[k], t = `${r.id}.`;
    P(t + 'eg', r.eg, q.eg); P(t + 'Kg', r.Kg, q.Kg); if (q.KgAvg) P(t + 'KgAvg', r.KgAvg.Kg, q.KgAvg.Kg); P(t + 'scfM', r.sk.scfM, q.sk.scfM); P(t + 'scfV', r.sk.scfV, q.sk.scfV); P(t + 'c1', r.sk.c1, q.sk.c1);
    ['Wdeck', 'roadway', 'NL', 'laneW', 'deL', 'deR', 'Savg', 'sumX2'].forEach(k2 => P(t + k2, r.geo[k2], q.geo[k2])); P(t + 'gDef', r.gDef, q.gDef);
    r.members.forEach((m, j) => { const n = q.members[j], u = `${t}G${j + 1}.`;
      ['mom1', 'mom2', 'shr1', 'shr2'].forEach(k2 => P(u + k2, m.r[k2], n.r[k2])); ['gM', 'gV', 'fatM', 'fatV', 'method', 'S', 'mE', 'vE', 'eM', 'eV', 'de'].forEach(k2 => { if (k2 in n) P(u + k2, m[k2], n[k2]); });
      if (n.rig) { P(u + 'rig.g', m.rig.g, n.rig.g); P(u + 'rig.n', m.rig.nLoaded, n.rig.nLoaded); }
      if (n.lever1) { P(u + 'lever1.R', m.lever1.R, n.lever1.R); P(u + 'lever1.w0', m.lever1.wheels[0], n.lever1.wheels[0]); }
      const L = r.lever[j], Lg = q.lever[j]; P(u + 'lever.n', L.cfgs.length, Lg.cfgs.length); L.cfgs.forEach((c, i) => { P(`${u}lever${c.N}.R`, c.R, Lg.cfgs[i].R); P(`${u}lever${c.N}.s`, c.wheels[0], Lg.cfgs[i].wheels[0]); }); }); });
  const d = o.dead, e = g.dead;
  ['trib', 'deck', 'haunch', 'sip', 'dc1', 'dc2', 'dw', 'pl', 'ut', 'uf', 'cls', 'ub', 'bays'].forEach(k => { if (e[k] || d[k]) (e[k] || []).forEach((v, i) => P(`dead.${k}${i}`, d[k] ? d[k][i] : undefined, v)); });
  P('dead.method', d.method, e.method); P('dead.Wd', d.Wd, e.Wd); P('dead.xbar', d.xbar, e.xbar); P('dead.S2', d.S2, e.S2); P('dead.nLoads', d.per.length, e.per.length);
  e.per.forEach((L, k) => { const m = d.per[k] || {}, t = `dead.${L.id}.`; P(t + 'id', m.id, L.id); P(t + 'cat', m.cat, L.cat); P(t + 'dist', m.dist, L.dist); P(t + 'x', m.x, L.x); P(t + 'plf', m.plf, L.plf); P(t + 'e', m.e, L.e);
    P(t + 'ovr', JSON.stringify(m.ovr || null), JSON.stringify(L.ovr || null)); (L.r || []).forEach((v, i) => P(t + 'r' + i, m.r[i], v)); });
  return out;
}
function compare(name, o, g, acc) {
  for (const [k, a, b] of pairs(o, g)) {
    acc.n++;
    if (typeof a === 'number' && typeof b === 'number') { const rel = Math.abs(a - b) / Math.max(1, Math.abs(b)); if (rel > acc.worst.rel) acc.worst = { rel, name, k, a, b }; if (!(a === b || (isNaN(a) && isNaN(b)))) acc.diffs.push(`${name} ${k}: ${a} vs ${b}`); }
    else if (a !== b) acc.diffs.push(`${name} ${k}: ${a} vs ${b}`);
  }
}
export const ours = df => LD.compute(df.bridge, df);

/* ---------- variations of the recorded inputs (branch coverage) ---------- */
export function variants() {
  const base = fixtures.find(f => f.project === 'builtin' && f.owner === 'AASHTO'), rid = fixtures.find(f => f.project === 'builtin' && f.owner === 'RIDOT');
  if (!base) return [];
  const V = [], add = (name, fn, src) => { const df = clone((src || base).df); fn(df, df.bridge); V.push({ name, df }); };
  const curb = (e, ch) => ({ type: 'curb', bw: 1.5, bwt: 0.4, cw: 12, ch, rw: 0.05, rp: 0.5 });
  add('curbs 10 in (mountable) left, 14 in right, railing face 1.25 ft', df => { df.edges = { L: curb(0, 10), R: { ...curb(0, 14), rf: 1.25 } }; });
  add('curb with entered traffic face; barrier with entered face', df => { df.edges = { L: { ...curb(0, 12), face: 2 }, R: { type: 'barrier', bw: 1.25, bwt: 0.5, face: 1.75 } }; });
  add('sidewalks: left 6 ft × 12 in with fence, right 5 ft × 8 in (mountable), pedestrian 75 psf, appurtenance w_c 0.145', df => { Object.assign(df.dl, { swL: 6, swThkL: 12, swR: 5, swThkR: 8, ped: 75, fenceL: 0.05, fenceXL: 1, wcA: 0.145 }); });
  add('sidewalk fence on the right, ped 90 psf, MassDOT pile-cap', df => { Object.assign(df.dl, { swR: 7, swThkR: 10, fenceR: 0.03, fenceXR: 6.5, ped: 90, method: 'massdot' }); });
  add('median 4 ft × 9 in, continuous slab', df => { Object.assign(df.dl, { medW: 4, medThk: 9, medJoint: 'no' }); });
  add('median with joint, equal (AASHTO) method', df => { Object.assign(df.dl, { medW: 3, medThk: 8, medJoint: 'yes', method: 'aashto' }); });
  add('wearing surface by thickness, two overlays (psf and thickness)', df => { Object.assign(df.dl, { wsMode: 'thk', wsThk: 2.5, wsGam: 0.14 }); df.ovl = [{ name: 'Membrane', mode: 'psf', psf: 5 }, { name: 'HMA', mode: 'thk', thk: 1.5, gam: 0.145 }]; });
  add('added rows: every category and rule', df => { df.extra = [{ name: 'Utility A', cat: 'UT', x: 17.5, plf: 0.3, dist: 'two' }, { name: 'Future bay', cat: 'UF', x: 27, plf: 0.25, dist: 'auto' },
    { name: 'Sign', cat: 'DC2', x: 1, plf: 0.2, dist: 'pilecap' }, { name: 'Pipe', cat: 'DW', x: 40, plf: 0.15, dist: 'auto' }, { name: 'DC1 rail', cat: 'DC1', x: 44, plf: 0.1, dist: 'two' }, { name: 'Ped strip', cat: 'PL', x: 2, plf: 0.05, dist: 'equal' }, { name: 'Outside', cat: 'DC2', x: 0.5, plf: 0.1, dist: 'two' }]; });
  add('RIDOT 60/40 with sidewalk, median, utility and added rows', df => { Object.assign(df.dl, { method: 'ridot', swL: 8, swThkL: 12, medW: 4, medThk: 9, ped: 75 }); df.extra = [{ name: 'Utility', cat: 'UT', x: 17.5, plf: 0.3, dist: 'auto' }, { name: 'Light', cat: 'DC2', x: 30, plf: 0.1, dist: 'auto' }, { name: 'DW row', cat: 'DW', x: 30, plf: 0.1, dist: 'auto' }]; }, rid);
  add('overrides of x, line load and rule; beam classes', df => { df.loadOverrides = { barL: { x: 1, plf: 0.5 }, barR: { dist: 'equal' }, ws: { dist: 'pilecap' } }; df.beamClass = { 1: 'interior', 4: 'ext-sw' }; });
  add('K_g averaged over the plate pieces', df => { df.kg = 'avg'; });
  add('K_g simplified terms (Table 4.6.2.2.1-3)', df => { df.kg = 'simple'; });
  add('exterior not less than interior (policy); shear skew on exterior girders only', df => { df.extMin = 'yes'; df.skewV = 'ext'; });
  add('skews 35° / 45° (moment reduction) and 65° (θ > 60°)', (df, b) => { b.regions.forEach((r, k) => { r.skA = [35, 45, 65][k % 3]; r.skB = [45, 35, 70][k % 3]; }); });
  add('N_b = 3 at 12 ft', (df, b) => { b.nb = 3; b.S = 12; b.bays = [12, 12]; });
  add('N_b = 4, bays 17 ft (S > 16 ft: lever rule)', (df, b) => { b.nb = 4; b.S = 17; b.bays = [17, 17, 17]; });
  add('22 ft roadway: two half-width lanes', (df, b) => { b.nb = 3; b.S = 8; b.bays = [8, 8]; b.ohL = 3.5; b.ohR = 3.5; });
  add('unequal bays 8, 10, 11, 9 ft; overhangs 4.5 / 2 ft (negative d_e side)', (df, b) => { b.bays = [8, 10, 11, 9]; b.S = 9.5; b.ohL = 4.5; b.ohR = 1.25; df.edges.R.bw = 1.75; });
  add('sacrificial 0.5 in, w_c for E_c 0.145 (CTDOT OWN17)', (df, b) => { b.tsac = 0.5; b.wcE = 0.145; });
  add('owner haunch rule (OWN8) with a 3 in haunch', (df, b) => { b.haunch = 3; b.lf = { ...b.lf, h0: true }; });
  add('truck gap 6 ft', df => { df.gap = 6; });
  add('overhangs 5.5 ft, 7 girders at 7 ft (one-lane lever rule governs)', (df, b) => { b.nb = 7; b.S = 7; b.bays = [7, 7, 7, 7, 7, 7]; b.ohL = 5.5; b.ohR = 5.5; });
  // the four SB2-O19 items (lldf.html's rules, GirderDetail #472) and the pier skew rule (GirderDetail DFL5)
  add('SB2-O19 item 2: support skews 20 / 35 / 35 / 50° (spans 1 and 3 differ by 15° > 10°: no moment reduction there)', (df, b) => { const sk = [20, 35, 35, 50]; b.skews = sk; b.regions.forEach(r => { if (r.kind === 'span') { r.skA = sk[r.i]; r.skB = sk[r.i + 1]; } else r.skA = r.skB = sk[r.i]; }); });
  add('pier rule: support skews 40 / 52 / 52 / 40° (piers 1 and 2: an adjacent span differs by 12°)', (df, b) => { const sk = [40, 52, 52, 40]; b.skews = sk; b.regions.forEach(r => { if (r.kind === 'span') { r.skA = sk[r.i]; r.skB = sk[r.i + 1]; } else r.skA = r.skB = sk[r.i]; }); });
  // SB2-O23 / GirderDetail DFL6: the tables' θ is |θ|; the 10° rule compares the signed skews
  add('SB2-O23: support skews −30° at every line (moment reduction and shear correction with θ = 30°)', (df, b) => { const sk = [-30, -30, -30, -30]; b.skews = sk; b.regions.forEach(r => { if (r.kind === 'span') { r.skA = sk[r.i]; r.skB = sk[r.i + 1]; } else r.skA = r.skB = sk[r.i]; }); });
  add('SB2-O23: support skews −40 / −45 / −38 / −65° (mixed with the 10° rule and θ > 60°)', (df, b) => { const sk = [-40, -45, -38, -65]; b.skews = sk; b.regions.forEach(r => { if (r.kind === 'span') { r.skA = sk[r.i]; r.skB = sk[r.i + 1]; } else r.skA = r.skB = sk[r.i]; }); });
  add('SB2-O23: support skews −35 / 35 / 35 / −35° (signs differ: spans 1 and 3 lines 70° apart, no moment reduction; span 2 keeps it)', (df, b) => { const sk = [-35, 35, 35, -35]; b.skews = sk; b.regions.forEach(r => { if (r.kind === 'span') { r.skA = sk[r.i]; r.skB = sk[r.i + 1]; } else r.skA = r.skB = sk[r.i]; }); });
  add('SB2-O19 item 3: N_b = 3 at 14 ft, overhangs 6 ft (3 lanes; 2 trucks still govern)', (df, b) => { b.nb = 3; b.S = 14; b.bays = [14, 14]; b.ohL = 6; b.ohR = 6; });
  add('SB2-O19 item 3: N_b = 4 at 18 ft (S > 16 ft), overhangs 4 ft', (df, b) => { b.nb = 4; b.S = 18; b.bays = [18, 18, 18]; b.ohL = 4; b.ohR = 4; });
  add('SB2-O19 item 4: overhangs 3.3 ft (lever-rule peak between the 0.25 ft grid points)', (df, b) => { b.ohL = 3.3; b.ohR = 3.3; });
  add('input errors', df => { df.gap = 3; df.dl.swL = -1; df.extra = [{ name: 'Bad', cat: 'DC2', x: -1, plf: 'x', dist: 'auto' }]; });
  return V;
}

test('LLDF and dead loads: GirderDetail in Node reproduces GirderDetail in the browser (recorded), 20 project/owner inputs', () => {
  // Node's and Chromium's Math.pow may differ in the last bit (different V8 builds), so this step allows round-off (1e-14 relative)
  // and reports how many values were not bit-identical; the parity test below compares this engine with GirderDetail in the SAME
  // Node run and requires identity.
  assert.equal(fixtures.length, 20, 'expected 20 recorded inputs in tests/projects/sbd2-loads (node tests/engine/record-loads.mjs)');
  const G = gdDf(); let n = 0, nb = 0, worst = 0;
  const eq = (a, b, what) => { n++; if (typeof b === 'number') { if (a !== b) { nb++; const r = Math.abs(a - b) / Math.max(1, Math.abs(b)); worst = Math.max(worst, r); assert.ok(r < 1e-14, `${what}: ${a} vs ${b}`); } } else assert.equal(a, b, what); };
  for (const fx of fixtures) {
    const R = G.run(fx.df), r = fx.gd, t = `${fx.project}/${fx.owner}`;
    assert.deepEqual([...R.errors], r.errors || [], `${t}: errors`);
    R.regions.forEach((rg, k) => { eq(rg.Kg, r.regions[k].Kg, `${t} ${rg.id} Kg`); rg.members.forEach((m, j) => [m.gM, m.gV, m.fatM, m.fatV, m.method].forEach((v, i) => eq(v, r.regions[k].members[j][i], `${t} ${rg.id} G${j + 1} #${i}`))); });
    ['dc1', 'dc2', 'dw', 'pl'].forEach(k => R.dead[k].forEach((v, i) => eq(v, r.dead[k][i], `${t} dead ${k}${i}`)));
    R.dead.per.forEach((L, k) => { const q = r.dead.per[k]; [L.id, L.cat, L.dist, L.x, L.plf].forEach((v, i) => eq(v, q[i], `${t} ${L.id} #${i}`)); L.r.forEach((v, i) => eq(v, q[5][i], `${t} ${L.id} r${i}`)); });
  }
  console.log(`       ${fixtures.length} inputs, ${n} values: ${n - nb} bit-identical, ${nb} differ by round-off (largest relative ${worst.toExponential(2)})`);
});

test('parity with GirderDetail LLDF and DLs (GM.df.compute): 20 recorded inputs + variations; identical', () => {
  const G = gdDf(), acc = { n: 0, diffs: [], worst: { rel: 0 } }, cases = [...fixtures.map(fx => ({ name: `${fx.project}/${fx.owner}`, df: fx.df })), ...variants()];
  for (const c of cases) compare(c.name, ours(c.df), G.run(c.df), acc);
  console.log(`       ${cases.length} module inputs (${fixtures.length} recorded, ${cases.length - fixtures.length} variations), ${acc.n} values compared; ${acc.diffs.length} differ; largest relative difference ${acc.worst.rel}`);
  assert.deepEqual(acc.diffs.slice(0, 20), []);
});

/* ---------- payloads ---------- */
const STD = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(STD).filter(f => /^gd_.*\.json$/.test(f)).sort();
test('the 100 gd_*.json hand-off payloads: girderDetail.df and girderDetail.loads reproduced to their 4 decimals', () => {
  const byKey = Object.fromEntries(fixtures.map(fx => [`${fx.project}_${fx.owner}`, fx])), R = {}, bad = []; let nv = 0, worstSt = 0;
  const near = (a, b, what, tol = 0.5e-4 + 1e-9) => { nv++; if (!(Math.abs(a - b) <= tol)) bad.push(`${what}: ${a} vs ${b}`); };
  for (const f of payloads) {
    const m = /^gd_(\w+?)_(AASHTO|RIDOT|MassDOT|CTDOT)_G(\d+)\.json$/.exec(f), fx = byKey[`${m[1]}_${m[2]}`], j = +m[3] - 1;
    const g = JSON.parse(fs.readFileSync(path.join(STD, f), 'utf8')).payload.girderDetail, k = `${m[1]}_${m[2]}`;
    const r = R[k] || (R[k] = ours(fx.df)); assert.deepEqual([...r.errors], [], f);
    const spans = r.regions.filter(q => q.kind === 'span'), piers = r.regions.filter(q => q.kind === 'sup');
    g.df.spans.forEach((s, i) => ['gM', 'gV', 'fatM', 'fatV'].forEach(q => near(spans[i].members[j][q], s[q], `${f} span ${i + 1} ${q}`)));
    g.df.piers.forEach((s, i) => near(piers[i].members[j].gM, s.gM, `${f} pier ${i + 1} gM`));
    const L = g.loads, D = r.dead, gi = LD.girder(r, j), comp = id => L.components.find(c => c.id === id);
    near(D.deck[j], comp('deck').w, `${f} deck`); near(D.trib[j], comp('deck').width, `${f} deck width`); near(D.haunch[j], comp('haunch').w, `${f} haunch`); near(D.sip[j], comp('sip').w, `${f} sip`);
    D.per.filter(q => q.cat !== 'PL').forEach(q => { const c = comp(q.id); if (!c) { bad.push(`${f}: load ${q.id} not in the payload`); return; } near(q.r[j], c.w, `${f} ${q.id} w`); near(q.plf, c.wTotal, `${f} ${q.id} wTotal`); near(q.x, c.x, `${f} ${q.id} x`); if (q.dist !== c.dist) bad.push(`${f} ${q.id} dist ${q.dist} vs ${c.dist}`); });
    L.components.filter(c => !['steel', 'xf', 'deck', 'haunch', 'sip'].includes(c.id)).forEach(c => { if (!D.per.find(q => q.id === c.id)) bad.push(`${f}: payload load ${c.id} not here`); });
    near(gi.DC2, L.totals.DC2, `${f} DC2`); near(gi.DW, L.totals.DW, `${f} DW`); near(gi.DC1, L.totals.DC1wet, `${f} DC1 wet`); near(gi.UT, L.totals.UT, `${f} UT`); near(gi.UF, L.totals.UF, `${f} UF`); near(gi.PL, L.totals.PL, `${f} PL`);
    if (D.method !== L.distribution.method) bad.push(`${f} method ${D.method} vs ${L.distribution.method}`); if (gi.clsLabel !== L.distribution.beamClass) bad.push(`${f} class ${gi.clsLabel} vs ${L.distribution.beamClass}`);
    const g0 = r.regions[0].geo; nv += 3; if (g0.NL !== L.liveLoad.lanes) bad.push(`${f} lanes`); near(g0.roadway, L.liveLoad.roadway, `${f} roadway`); near(r.regions[0].gDef, L.liveLoad.deflectionDF, `${f} deflection DF`); near(g0.laneW, L.liveLoad.laneWidth, `${f} lane width`);
    // girder self-weight: the plates of the bridge (Preliminary sizing) as segments
    const b = fx.df.bridge, cuts = [...new Set([...b.plates.top, ...b.plates.bot, ...b.plates.web].flatMap(q => [q.x0, q.x1]))].sort((a, c) => a - c);
    const at = (l, x) => l.find(q => x >= q.x0 - 1e-9 && x <= q.x1 + 1e-9) || l[l.length - 1];
    const segs = cuts.slice(0, -1).map((x0, i) => { const x1 = cuts[i + 1], x = (x0 + x1) / 2, t = at(b.plates.top, x), bo = at(b.plates.bot, x); return { x0, x1, D: b.plates.D, tw: at(b.plates.web, x).t, topB: t.b, topT: t.t, botB: bo.b, botT: bo.t }; }).filter(s => s.x1 - s.x0 > 1e-6);
    const sw = LD.steelWeight(segs, b.allow), st = comp('steel');
    near(sw.min, st.wMin, `${f} steel wMin`); near(sw.max, st.wMax, `${f} steel wMax`); const rel = Math.abs(sw.avg - st.w) / st.w; worstSt = Math.max(worstSt, rel); if (rel > 0.002) bad.push(`${f} steel average ${sw.avg} vs ${st.w}`);
  }
  console.log(`       ${payloads.length} payloads, ${nv} values: ${bad.length} differ; steel self-weight average largest relative difference ${worstSt.toExponential(2)} (node-weighted vs segment-weighted)`);
  assert.deepEqual(bad.slice(0, 20), []);
});

/* ---------- hand checks ---------- */
test('hand check: GirderDetail built-in cross-section, dead loads of G1 (exterior) and G2, MassDOT pile-cap', () => {
  // 5 girders at 9.5 ft, overhangs 3.25 ft: deck 44.5 ft, girder lines at x = 3.25, 12.75, 22.25, 31.75, 41.25 ft; x̄ = 22.25 ft.
  // Deck 8 in at 0.150 kcf: G1 tributary 3.25 + 9.5/2 = 8.00 ft → 8.00 × 8/12 × 0.150 = 0.8000 klf; G2 9.50 ft → 0.9500 klf.
  // Haunch 2 in × 16 in flange: 2/12 × 16/12 × 0.150 = 0.03333 klf. SIP 15 psf on the clear bays (9.5 − 16/12 = 8.1667 ft):
  // G1 15/1000 × 8.1667/2 = 0.06125 klf; G2 15/1000 × 8.1667 = 0.12250 klf.
  // Barriers 0.40 klf at 0.75 ft from each edge. Pile-cap: c = −19, −9.5, 0, 9.5, 19 ft; Σc² = 2(19² + 9.5²) = 902.5 ft².
  // Left barrier, e = 0.75 − 22.25 = −21.5 ft: G1 0.4/5 + 0.4(−21.5)(−19)/902.5 = 0.08 + 0.181053 = 0.261053 klf;
  //   G2 0.08 + 0.4(−21.5)(−9.5)/902.5 = 0.08 + 0.090526 = 0.170526 klf. Right barrier (e = +21.5): G1 0.08 + max(0, −0.181053) = 0.08 klf.
  // FWS 25 psf between the barrier faces (1.5 to 43.0 ft, 41.5 ft): 1.0375 klf, equally: 0.2075 klf per girder.
  // DC2 G1 = 0.261053 + 0.08 = 0.341053 klf.
  const fx = fixtures.find(f => f.project === 'builtin' && f.owner === 'AASHTO'), r = ours(fx.df), D = r.dead;
  const c = (a, b, w) => assert.ok(Math.abs(a - b) < 1e-6, `${w}: ${a} vs ${b}`);
  c(D.xbar, 22.25, 'x̄'); c(D.S2, 902.5, 'Σc²'); c(D.trib[0], 8, 'trib G1'); c(D.deck[0], 0.8, 'deck G1'); c(D.deck[1], 0.95, 'deck G2'); c(D.haunch[0], 2 / 12 * 16 / 12 * 0.15, 'haunch');
  c(D.sip[0], 0.015 * (9.5 - 16 / 12) / 2, 'SIP G1'); c(D.sip[1], 0.015 * (9.5 - 16 / 12), 'SIP G2');
  const bar = D.per.find(L => L.id === 'barL'), barR = D.per.find(L => L.id === 'barR'), ws = D.per.find(L => L.id === 'ws');
  c(bar.r[0], 0.08 + 0.4 * 21.5 * 19 / 902.5, 'barrier L on G1'); c(bar.r[1], 0.08 + 0.4 * 21.5 * 9.5 / 902.5, 'barrier L on G2'); c(barR.r[0], 0.08, 'barrier R on G1');
  c(ws.plf, 1.0375, 'FWS'); c(ws.r[2], 0.2075, 'FWS each'); c(D.dc2[0], 0.341053, 'DC2 G1'); c(Math.round(D.dc2[0] * 1e4) / 1e4, 0.3411, 'payload totals.DC2 0.3411');
  const st = r.dead.steps.find(s => s.id === 'dl.G1.barL'); assert.equal(st.value, bar.r[0]);
});

test('hand check: interior girder moment and shear factors, S = 9.5 ft, L = 110 ft, t_s = 8 in, K_g = 869,919 in⁴, skew 15°', () => {
  // K_g/(12 L t_s³) = 869,918.955/(12 × 110 × 512) = 869,918.955/675,840 = 1.287167; ^0.1 = 1.025566.
  // One lane: 0.06 + (9.5/14)^0.4 (9.5/110)^0.3 (1.025566) = 0.06 + 0.856324 × 0.479622 × 1.025566 = 0.06 + 0.421212 = 0.481212.
  // Two lanes: 0.075 + (9.5/9.5)^0.6 (9.5/110)^0.2 (1.025566) = 0.075 + 1 × 0.612726 × 1.025566 = 0.075 + 0.628391 = 0.703391.
  // Skew 15° < 30°: r_M = 1, so G2 (interior) span 1 g_M = 0.703391 (the payload: 0.7034).
  // Shear: one lane 0.36 + 9.5/25 = 0.74; two lanes 0.2 + 9.5/12 − (9.5/35)² = 0.2 + 0.791667 − 0.073673 = 0.917993;
  // skew correction 1 + 0.20 (12 L t_s³/K_g)^0.3 tan 15° = 1 + 0.20 (0.776900)^0.3 (0.267949) = 1 + 0.20 × 0.927064 × 0.267949 = 1.049681;
  // g_V = 0.917993 × 1.049681 = 0.963600 (the payload: 0.9636).
  const e = LL.emp(869918.9552617256, 110, 8, 9.5, false);
  const c = (a, b, w) => assert.ok(Math.abs(a - b) < 2e-6, `${w}: ${a} vs ${b}`);
  c(e.kterm, 1.025566, 'kterm'); c(e.mom1, 0.481212, 'g_M,1'); c(e.mom2, 0.703391, 'g_M,2'); c(e.shr1, 0.74, 'g_V,1'); c(e.shr2, 0.917993, 'g_V,2');
  const fx = fixtures.find(f => f.project === 'builtin' && f.owner === 'AASHTO'), r = ours(fx.df), s0 = r.regions[0];
  assert.ok(Math.abs(s0.Kg / 869918.955 - 1) < 1e-9, 'K_g span 1'); c(s0.sk.scfV, 1.049681, 'r_V'); c(s0.members[1].gM, 0.703391, 'G2 g_M'); c(s0.members[1].gV, 0.963600, 'G2 g_V');
  // exterior G1: lever rule one lane: wheels 2 ft from the barrier face (x = 3.5 and 9.5 ft); G1 at 3.25, G2 at 12.75:
  // R = 0.5 (12.75 − 3.5)/9.5 + 0.5 (12.75 − 9.5)/9.5 = 0.486842 + 0.171053 = 0.657895; × m 1.2 = 0.789474.
  // Rigid section, X_ext = 19 ft, Σx² = 902.5 ft², d_e = 1.75 ft, curb at 20.75 ft; lanes at e = 15.75, 3.75, −8.25 ft:
  // 1 lane 1.2 (1/5 + 19 × 15.75/902.5) = 1.2 (0.2 + 0.331579) = 0.637895; 2 lanes 1.0 (2/5 + 19 × 19.5/902.5) = 0.810526;
  // 3 lanes 0.85 (3/5 + 19 × 11.25/902.5) = 0.85 × 0.836842 = 0.711316. Governing 0.810526 (the payload's G1 g_M 0.8105).
  const g1 = s0.members[0]; c(g1.lever1.R, 0.657895, 'lever R'); c(g1.lever1.df, 0.789474, 'lever g'); c(g1.rig.g, 0.810526, 'rigid'); c(g1.gM, 0.810526, 'G1 g_M');
  c(g1.fatM, 0.789474 / 1.2, 'G1 fatigue: max(lever 0.789474, rigid one lane 0.637895) / 1.2 (4.6.2.2.2d; the lever rule governs here)');
});

test('hand check SB2-O23: support skews −30° / −30°, interior G2, span 1 (θ = |θ| = 30°; before: read as no skew)', () => {
  // Same section as above: S = 9.5 ft, L = 110 ft, t_s = 8 in, K_g = 869,918.955 in⁴; 12 L t_s³ / K_g = 675,840 / 869,918.955 = 0.776900.
  // Shear (Table 4.6.2.2.3c-1): r_V = 1 + 0.20 (0.776900)^0.3 tan 30° = 1 + 0.20 × 0.927064 × 0.577350 = 1.107048 (before: 1.0).
  //   g_V,1 = 0.74 × 1.107048 = 0.819216; g_V,2 = 0.917993 × 1.107048 = 1.016263; g_V = 1.016263 (before 0.917993, +10.7 %).
  // Moment (Table 4.6.2.2.2e-1, θ = 30°, both lines −30°: no 10° change): c_1 = 0.25 (1.287167)^0.25 (9.5/110)^0.5
  //   = 0.25 × 1.065145 × 0.293877 = 0.078255; r_M = 1 − 0.078255 (tan 30°)^1.5 = 1 − 0.078255 × 0.438691 = 0.965670 (before: 1.0).
  //   g_M = 0.703391 × 0.965670 = 0.679243 (before 0.703391).
  const v = variants().find(q => q.name.startsWith('SB2-O23: support skews −30°')), r = ours(v.df), s0 = r.regions[0], g2 = s0.members[1];
  const c = (a, b, w) => assert.ok(Math.abs(a - b) < 2e-6, `${w}: ${a} vs ${b}`);
  c(s0.sk.scfV, 1.107048, 'r_V'); c(g2.r.shr1, 0.819216, 'g_V,1'); c(g2.r.shr2, 1.016263, 'g_V,2'); c(g2.gV, 1.016263, 'g_V');
  c(s0.sk.c1, 0.078255, 'c_1'); c(s0.sk.scfM, 0.965670, 'r_M'); c(g2.gM, 0.679243, 'g_M');
  // the 10° rule compares the signed skews: −35 / 35 / 35 / −35°, span 1's lines are 70° apart: no moment reduction; span 2 keeps it
  const w = ours(variants().find(q => q.name.startsWith('SB2-O23: support skews −35')).df);
  assert.equal(w.regions[0].sk.noRed, true); assert.equal(w.regions[0].sk.scfM, 1); assert.equal(w.regions[1].sk.noRed, false); assert.ok(w.regions[1].sk.scfM < 1);
  assert.ok(w.regions[0].sk.scfV > 1, 'shear correction with |θ| = 35°');
});

test('owner rules: load factors (η, m, h0) and OWN8 haunch', () => {
  // RIDOT, nonredundant auto with 5 girders (no), η_I question yes: η_D 1.00 (fixed), η_R 1.00, η_I 1.05 → η = max(1.05, 0.95) = 1.05,
  // η_N = min(1/1.05, 1) = 0.952381; m = 1.2 (RIDOT BDM 3.4.1.2); h0 (RIDOT BDM 6.5.1, 9.4.6).
  const L = OW.loadFactors('RIDOT', { I: 'yes', R: 'auto', D: 'no' }, 5);
  assert.equal(L.eta, 1.05); assert.ok(Math.abs(L.etaN - 1 / 1.05) < 1e-12); assert.equal(L.m, 1.2); assert.equal(L.h0, true); assert.equal(OW.haunchInProps(2, L), 0);
  const A = OW.loadFactors('AASHTO', { eD: 1, eR: 1, eI: 1 }, 5); assert.equal(A.eta, 1); assert.equal(A.h0, false); assert.equal(OW.haunchInProps(2, A), 2);
  const C = OW.loadFactors('CTDOT', { I: 'no' }, 3); assert.equal(C.eR, 1.05, 'CTDOT nonredundant with 3 girders'); assert.equal(C.h0, false);
  // the recorded bridges: Preliminary sizing's lf = this port's loadFactors for the same owner (the default η answers)
  for (const fx of fixtures) { const b = fx.df.bridge, l = OW.loadFactors(b.owner, {}, b.nb); ['m', 'eD', 'eR', 'eI', 'eta', 'etaN', 'h0'].forEach(k => assert.equal(l[k], b.lf[k], `${fx.project}/${fx.owner} lf.${k}`)); }
  assert.equal(OW.RULES.rules.length, 125); assert.equal(OW.rule('AASHTO', 'ld.haunch0'), null); assert.equal(OW.cite(OW.rule('MassDOT', 'ld.haunch0')), 'MassDOT Bridge Manual Part I 3.5.1.2');
});

test('model: the default project runs through fromModel; a version 1 project without xs reads the defaults', () => {
  const P = M.defaultProject(); assert.deepEqual([...M.validate(P).errors].map(e => e.msg), []);
  const { b, p } = LD.fromModel(P), r = LD.compute(b, p); assert.deepEqual([...r.errors], []);
  assert.equal(r.regions.length, 5); assert.equal(r.dead.N, 5);
  const old = M.defaultProject(); delete old.xs; delete old.ownerRules; assert.deepEqual([...M.validate(old).errors].map(e => e.msg), []);
  const r2 = LD.compute(...Object.values(LD.fromModel(old))); assert.deepEqual([...r2.errors], []);
  const bad = M.defaultProject(); bad.xs.bays = [9.5]; bad.xs.skews = [0]; bad.ownerRules.owner = 'XDOT';
  const paths = [...M.validate(bad).errors].map(e => e.path); ['xs.bays', 'xs.skews', 'ownerRules.owner'].forEach(k => assert.ok(paths.includes(k), k));
  // every step has an id and a label; ids unique within the result
  const ids = new Set(); [...r.steps, ...r.dead.steps, ...r.regions.flatMap(q => [...q.steps, ...q.members.flatMap(m => m.steps)])].forEach(s => { assert.ok(s.id && s.label); assert.ok(!ids.has(s.id), s.id); ids.add(s.id); });
});
