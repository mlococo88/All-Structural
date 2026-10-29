// apps/steel-bridge/engine/fatigue.js against GirderDetail's own Fatigue module (GM.fa.compute, GM.fa.checks), its bridge-wide fatigue
// functions (gdFatSet, gdFatSup, gdFatN, gdFatNr, gdFatLS, gdFatStud) and the Girder section module's GS17 (GM.gs.compute / checks), taken
// from "Steel Bridge Design.html" and run in a Node vm (gd-source.mjs).
//
// Inputs: tests/projects/sbd2-fat/<project>_<owner>.json, recorded by tests/engine/record-fatigue.mjs from the page itself for the 5 projects
// × 4 owners of the 100 tests/projects/st/gd_*.json hand-off payloads (P.fa as Preliminary sizing sends it: the detail inventory of the
// interior and exterior girders; P.df.bridge; P.cf), with the page's own results.
// 1. GirderDetail in Node = GirderDetail in the browser (the recorded results).
// 2. This engine = GirderDetail in Node: every row value and every check item (ratio, status), with the owner rules (OWN8 haunch, OWN25
//    Category C at connection plates, OWN39 FA7) and the diaphragm names; GirderDetail's built-in inputs; variations (Fatigue I / II forced,
//    ADTT low and high, uncracked negative section, stresses entered, custom height, utilities, the web check FA3, distortion inputs, the
//    evaluation FA5/FA6 with R_R entered, a growth rate of 0).
// 3. GS17 on every station of the 100 payloads (the stations of the flexure tests): this engine's flange() on engine/flexure.js locations =
//    GirderDetail's GM.gs GS17 items, with the bridge's spans (n by station) and two traffic levels (Fatigue I and Fatigue II).
// 4. The limit-state functions on a grid of n, categories and settings.
// 5. Hand checks (arithmetic in the comments).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { gdBlock, gdDecl, gdGirderSection, gdRun } from './gd-source.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', ENG('sections.js'), ENG('owners.js'), ENG('flexure.js'), ENG('shear.js'), ENG('fatigue.js'));
const FA = W.SBDFatigue, OW = W.SBDOwners, FX = W.SBDFlexure;
const FIX = path.join(ROOT, 'tests/projects/sbd2-fat');
const fixtures = fs.existsSync(FIX) ? fs.readdirSync(FIX).filter(f => f.endsWith('.json')).sort().map(f => ({ f, ...JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')) })) : [];
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- GirderDetail in Node ---------- */
const TAG = '\n// fatigue.test.mjs';
let GD = null;
function run(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`); loaded.add(m[1]); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${m[1]})` }); }
  }
  throw new Error('too many missing declarations');
}
const PRE = ['ES', 'T', 'GD_GR', 'RANK', 'ge', 'worst', 'sum', 'parseDim', 'nm', 'numRows', 'rc', 'ckNew', 'LE', 'GE', 'f0', 'f2', 'f3', 'frac', 'esc', 'STLBL', 'A610_shearC', 'A610_Vp', 'webShear', 'PHI',
  'OWN_LIST', 'OWN_RULES', 'gdOwner', 'gdOwnR', 'gdOwnRules', 'gdOwnCite', 'LF_ONE', 'gdLF', 'gdHP', 'gdUt', 'gdUtOn', 'cfDiaOn', 'modRatio', 'steelProps', 'addPart', 'secSet', 'rowDk', 'secTxt',
  'FAT_TH', 'FA_CAT', 'FA_CATS', 'FA_STUD', 'gdFatSet', 'gdFatSup', 'gdFatN', 'gdFatNear', 'gdFatNr', 'gdFatLS', 'gdFatStud', 'gdFatTxt', 'FA_DET', 'FA_LOC', 'FA_SPEC', 'faRR'];
function gd() {
  if (GD) return GD;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: {} }, cf: {}, fa: null }; var GM = {};', ctx);
  const loaded = new Set();
  PRE.forEach(k => { const d = gdDecl(k); if (d && !loaded.has(k)) { loaded.add(k); vm.runInContext(d + TAG, ctx, { filename: `Steel Bridge Design.html (${k})` }); } });
  run(ctx, c => vm.runInContext(gdBlock('GM.fa = {', '\n};\n') + '\n};' + TAG, c, { filename: 'Steel Bridge Design.html (GM.fa)' }), loaded);
  const setP = P => { ctx.P = { fa: clone(P.fa), cf: clone(P.cf || {}), df: { bridge: clone(P.dfBridge || {}) } }; };
  GD = { ctx, loaded, setP,
    fa: P => { setP(P); return run(ctx, c => { const R = c.GM.fa.compute(c.P.fa); return { R, C: R.errors.length ? null : c.GM.fa.checks(R) }; }, loaded); },
    fn: (P, code) => { setP(P); return run(ctx, c => vm.runInContext(code, c), loaded); } };
  return GD;
}
/* this engine's env from the recorded GirderDetail state (gdOwner, gdLF h0, cfDiaOn) */
function envOf(P) {
  const b = P.dfBridge || {}, l = b.lf, lf = l && typeof l === 'object' && +l.m > 0 && +l.eta > 0 && +l.etaN > 0 ? l : { h0: false };
  return { owner: OW.LIST.includes(b.owner) ? b.owner : 'AASHTO', lf, dia: ((P.cf || {}).dia || {}).on === 'yes' };
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
const ROWK = ['name', 'cat', 'A', 'th', 'nn', 'ADTTeq', 'lim', 'N', 'dFn', 'gam', 'res', 'y', 'd', 'fP', 'fN', 'df', 'fD1', 'fD2', 'fDL', 'hasDL', 'fLLt', 'exempt', 'dem', 'Vu', 'VUTF', 'fUT', 'fUF'];
function itemPairs(mine, theirs) {
  const out = [], P = (k, a, b) => out.push([k, a, b]);
  P('check ids', mine.map(c => c.id).join(), theirs.map(c => c.id).join());
  theirs.forEach(c => { const m = mine.find(x => x.id === c.id); if (!m) return;
    P(`${c.id} n`, m.items.length, c.items.length); P(`${c.id} status`, m.status, c.status); P(`${c.id} gov`, m.gov, c.gov); P(`${c.id} na`, !!m.naWhy, !!c.naWhy);
    c.items.forEach((it, i) => { const q = m.items[i] || {}; stats.items++; P(`${c.id}[${i}] loc`, q.loc, it.loc); P(`${c.id}[${i}] st`, q.st, it.st); if (it.r != null || q.r != null) P(`${c.id}[${i}] r`, q.r ?? null, it.r ?? null); }); });
  return out;
}
function cmpFa(m, g, where) {
  if (g.errors.length || m.errors.length) { cmp([['errors', JSON.stringify([...m.errors]), JSON.stringify([...g.errors])]], where); return; }
  cmp([['ADTTSL', m.ADTTSL, g.ADTTSL], ['n', m.MR.n, g.MR.n], ['hh', m.dk.hh, g.dk.hh]], where);
  g.rows.forEach((r, i) => { const o = m.rows[i], L = ROWK.map(k => [k, o[k], r[k]]);
    if (r.sh || o.sh) ['k', 'C', 'Vp', 'Vcr'].forEach(k => L.push([`sh.${k}`, (o.sh || {})[k], (r.sh || {})[k]]));
    if (r.S) ['s', 'c3', 'cn', 'r'].forEach(s => ['yb', 'I'].forEach(k => L.push([`S.${s}.${k}`, o.S[s][k], r.S[s][k]])));
    if (r.ev || o.ev) { ['dfe', 'dfmax', 'inf'].forEach(k => L.push([`ev.${k}`, (o.ev || {})[k], (r.ev || {})[k]])); Object.keys((r.ev || {}).lives || {}).forEach(k => ['Y', 'rem'].forEach(q => L.push([`ev.${k}.${q}`, o.ev.lives[k] && o.ev.lives[k][q], r.ev.lives[k][q]]))); }
    cmp(L, `${where} row ${i}`); });
}
const browserItems = CK => CK.map(c => [c.id, c.items.map(it => [it.loc, it.r ?? null, it.st]), c.naWhy || '']);

/* variations of the recorded inputs that reach the other branches */
function faVariants(fa) {
  const v = [], base = () => clone(fa);
  { const p = base(); p.limit = 'I'; v.push(['Fatigue I forced', p]); }
  { const p = base(); p.limit = 'II'; p.gam.fII = 0.8; v.push(['Fatigue II forced', p]); }
  { const p = base(); p.ADTT = 8000; p.p = 1.0; v.push(['high ADTT', p]); }
  { const p = base(); p.ADTT = 150; p.life = 100; v.push(['low ADTT, 100 years', p]); }
  { const p = base(); p.negSec = 'uncracked'; p.nRule = 'round'; v.push(['uncracked negative section, n rounded', p]); }
  { const p = base(); p.rows.forEach((r, i) => { if (i % 3 === 0) { r.mode = 'S'; r.dfP = 4.2 + i / 10; r.dfN = 1.3; r.fDL = i % 2 ? -12 : 3; } }); v.push(['stresses entered', p]); }
  { const p = base(); p.rows.forEach((r, i) => { if (i % 4 === 1) { r.loc = 'y'; r.yo = 20; } if (i % 4 === 2) { r.loc = 'wt'; r.yo = 3; } if (i % 5 === 0) { r.det = 'custom'; r.cat = "E'"; } if (i % 5 === 1) r.det = 'Ep-cover'; }); v.push(['custom heights and categories', p]); }
  { const p = base(); p.rows.forEach((r, i) => { r.ut = { MUT: 40 + i, MUF: i % 2 ? 25 : -25, VUT: 3, VUF: 1 }; if (i % 2) { r.do = 90; r.Vf = Math.max(r.Vf, 20); } }); v.push(['utilities, web check', p]); }
  { const p = base(); p.rows.forEach((r, i) => { r.do = i % 2 ? 1.5 * r.D : 2.5 * r.D; r.Vf = 30 + i; r.Vp = 60 + 2 * i; r.tw = 0.4375; }); p.gW = 'HPS70W'; v.push(['web check FA3, thin web', p]); }
  { const p = base(); p.dist = { cp: 'no', lat: 'yes', latLoc: 'web', latStiff: 'no', latDist: 5, latBf: 16, skew: 'yes' }; v.push(['distortion: no cp, lateral on web, skew', p]); }
  { const p = base(); p.dist = { cp: 'na', lat: 'yes', latLoc: 'flange', latStiff: 'yes', latDist: 10, latBf: 16, skew: 'no' }; v.push(['distortion: lateral on flange', p]); }
  { const p = base(); p.dist = { cp: 'na', lat: 'no', latLoc: 'web', latStiff: 'yes', latDist: 10, latBf: 16, skew: 'no' }; v.push(['distortion: none', p]); }
  { const p = base(); p.ev = { on: 'yes', yearOpen: 1968, yearEval: 2026, ADTT: 1500, g: 2.0, Rs: 1.0, target: 25, level: 'E1', rrE1: '1.7 2.0 2.1 1.6 2.0 1.5 1.3 1.6', rrE2: '', rrMean: '2.8 3.1 3.2 2.5 3.0 2.3 2.0 2.4' }; v.push(['evaluation, E1 level', p]); }
  { const p = base(); p.ev = { on: 'yes', yearOpen: 1990, yearEval: 2026, ADTT: 3000, g: 0, Rs: 1.3, target: 40, level: 'E2', rrE1: '', rrE2: '', rrMean: '' }; v.push(['evaluation, g = 0, E2 not entered', p]); }
  { const p = base(); p.ev = { on: 'yes', yearOpen: 1990, yearEval: 1980, ADTT: 3000, g: -1, Rs: 1.3, target: 40, level: 'min', rrE1: '1 2', rrE2: '', rrMean: '' }; p.p = 1.2; v.push(['input errors', p]); }
  return v;
}

test('parity with GirderDetail Fatigue (FA1–FA7) on the recorded inputs of the gd_* projects and variations', () => {
  if (!fixtures.length) { console.log('       (no tests/projects/sbd2-fat fixtures: run node tests/engine/record-fatigue.mjs)'); return; }
  const G = gd(), cases = [];
  for (const fx of fixtures) { cases.push([fx.f.replace(/\.json$/, ''), fx.P, fx]); faVariants(fx.P.fa).forEach(([nm, p]) => cases.push([`${fx.f.replace(/\.json$/, '')} [${nm}]`, { ...fx.P, fa: p }, null])); }
  // GirderDetail's built-in inputs, under each owner and with diaphragms
  for (const o of ['AASHTO', 'RIDOT', 'MassDOT', 'CTDOT']) cases.push([`built-in ${o}`, { fa: clone(G.ctx.GM.fa.def), cf: o === 'MassDOT' ? { dia: { on: 'yes' } } : {}, dfBridge: { owner: o, lf: { v: 1, m: 1, eta: 1, etaN: 1, h0: o === 'RIDOT' } } }, null]);
  cases.forEach(([, P]) => G.fa(P));   // warm-up: every path once (gd-source.mjs)
  let nodeB = 0, nodeDiff = 0, nR = 0;
  for (const [where, P, fx] of cases) {
    const g = G.fa(P), E = envOf(P);
    if (fx && fx.gd.fa.rows) {   // 1. Node = browser
      const nb = (a, b, w) => { nodeB++; if (!(Object.is(a, b) || a === b || (typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b))))) { nodeDiff++; if (nodeDiff < 5) console.log(`       Node vs browser ${w}: ${a} vs ${b}`); } };
      g.R.rows.forEach((r, i) => { const b = fx.gd.fa.rows[i]; ['cat', 'lim', 'gam', 'res', 'df', 'dem', 'fDL', 'fLLt', 'exempt'].forEach(k => nb(r[k], b[k], `${where} fa ${i} ${k}`)); nb(r.Vu ?? null, b.Vu, `${where} fa ${i} Vu`); });
      browserItems(g.C).forEach(([id, its], j) => its.forEach((it, i) => { nb(it[1], fx.gd.fa.checks[j][1][i][1], `${where} ${id} ${i}`); nb(it[2], fx.gd.fa.checks[j][1][i][2], `${where} ${id} ${i} st`); }));
    }
    const m = FA.compute(clone(P.fa), E); cmpFa(m, g.R, where); if (!m.errors.length && g.C) cmp(itemPairs(FA.checks(m), g.C), where + ' checks'); nR += g.R.rows ? g.R.rows.length : 0;
    // the worked steps render, and every check item's step id exists
    if (!m.errors.length) { const C = FA.checks(m); m.rows.forEach(r => { const ids = new Set(FA.steps(m, r).map(s => s.id)); C.forEach(c => c.items.filter(it => it.step && it.step.startsWith(`fa${r.i}.`) && !/\.(own)$/.test(it.step)).forEach(it => assert.ok(ids.has(it.step), `${where}: step ${it.step}`))); }); }
  }
  assert.equal(JSON.stringify(FA.DEFAULT), JSON.stringify(G.ctx.GM.fa.def), 'DEFAULT = GM.fa.def');
  console.log(`       ${fixtures.length} recorded inputs + ${cases.length - fixtures.length} variations and built-in cases: ${nR} detail rows; ${stats.vals} values, ${stats.items} check items; Node = browser on ${nodeB} values (${nodeDiff} differ); largest relative difference ${stats.worst.rel.toExponential(2)}${stats.worst.what ? ' (' + stats.worst.what + ')' : ''}`);
  assert.equal(nodeDiff, 0, 'GirderDetail in Node differs from the browser');
  assert.deepEqual(stats.diffs.slice(0, 20), [], `${stats.diffs.length} differences`);
});

test('limit state: settings / supports / nAt / nRange / limitState / studLimit = gdFatSet / gdFatSup / gdFatN / gdFatNr / gdFatLS / gdFatStud', () => {
  const G = gd(), diffs = [];
  const bridges = [{}, { ok: true, spans: [110, 140, 110], cont: true }, { ok: true, spans: [80], cont: false }, { ok: true, spans: [60, 60], cont: false }];
  const sets = [{ limit: 'auto', ADTT: 2000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } }, { limit: 'auto', ADTT: 20000, p: 0.8, life: 75, gam: { fI: 1.75, fII: 0.8 } }, { limit: 'I', ADTT: 100, p: 1, life: 50, gam: { fI: 1.5, fII: 0.75 } },
    { limit: 'II', ADTT: 5000, p: 0.85, life: 100, gam: { fI: 1.75, fII: 0.8 } }, { limit: 'auto', ADTT: 0, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } }];
  let n = 0;
  for (const b of bridges) for (const f of sets) {
    const P = { fa: f, dfBridge: b, cf: {} }, s = FA.settings(f), B = FA.supports(b);
    const gs = G.fn(P, 'gdFatSet()'); n++; if (JSON.stringify(gs) !== JSON.stringify(s)) diffs.push(`set ${JSON.stringify(f)}`);
    const gb = G.fn(P, 'gdFatSup()'); if (JSON.stringify(gb) !== JSON.stringify(B)) diffs.push(`sup ${JSON.stringify(b)}`);
    for (const x of [null, 0, 5, 99, 100, 109, 110, 111, 124, 125, 180, 250, 263, 300, 360]) for (const neg of [false, true]) for (const cont of [false, true]) { n++;
      const a = FA.nAt(x, neg, cont, B), c = G.fn(P, `gdFatN(${JSON.stringify(x)}, ${neg}, ${cont})`); if (a !== c) diffs.push(`nAt ${x} ${neg} ${cont}: ${a} vs ${c}`); }
    for (const [a1, b1] of [[0, 11], [88, 99], [99, 110], [110, 124], [150, 166], [44, 132], [300, 360]]) for (const cont of [false, true]) { n++;
      const a = FA.nRange(a1, b1, true, cont, B), c = G.fn(P, `gdFatNr(${a1}, ${b1}, true, ${cont})`); if (a !== c) diffs.push(`nRange ${a1}-${b1}: ${a} vs ${c}`); }
    for (const cat of [...FA.CATS, 'X']) for (const nn of [1, 1.5, 2]) { n++;
      const a = JSON.stringify(FA.limitState(cat, nn, 1.75, s)), c = JSON.stringify(G.fn(P, `gdFatLS(${JSON.stringify(cat)}, ${nn}, 1.75)`)); if (a !== c) diffs.push(`LS ${cat} ${nn}: ${a} vs ${c}`); }
    for (const d of [0.75, 0.875, 1]) for (const nn of [1, 1.5]) { n++;
      const ZrI = 7.0 * Math.PI * d * d / 4, a = JSON.stringify(FA.studLimit(nn, d, ZrI, 1.75, s)), c = JSON.stringify(G.fn(P, `gdFatStud(${nn}, ${d}, ${ZrI}, 1.75)`)); if (a !== c) diffs.push(`stud ${d} ${nn}: ${a} vs ${c}`); }
  }
  console.log(`       ${n} cases: ${diffs.length} differ`);
  assert.deepEqual(diffs.slice(0, 10), []);
});

/* ---------- GS17 on the payload stations ---------- */
const DIR = path.join(ROOT, 'tests/projects/st');
const payloads = fs.readdirSync(DIR).filter(f => /^gd_.*\.json$/.test(f)).sort();
// a location of engine/flexure.js -> GirderDetail Girder section row (as tests/engine/flexure.test.mjs gdRow)
function gdRow(GS, L, i) {
  const n = L.npr || {}, M = L.M;
  return { ...clone(GS.ctx.GM.gs.def.rows[0]), name: L.name, region: L.region, cont: L.cont ? 'yes' : 'no', beff: L.beff, ...L.plates,
    Lb: L.Lb, LbC: L.Lb, Cb: L.Cb, CbC: '', lbB: n.b || 0, lbT: n.t || 0, npr: n.kind || '', lbK: n.K == null ? '' : n.K, lbIr: n.Ir == null ? '' : n.Ir, nprWhy: n.why || '', geA: n.geA || '', ...(n.gov ? { nprG: n.gov } : {}),
    MDC1: M.DC1, MDCc: 0, MDC2: M.DC2, MDW: M.DW, MLLp: M.LLp, MLLn: M.LLn, MCL: 0, MfP: M.FATp, MfN: M.FATn, VDC1: 0, VDC2: 0, VDW: 0, VLL: 0, VCL: 0, Vf: 0,
    fl: L.fl, flC: 0, do: 0, end: 'no', ut: { MUT: M.UT, MUF: M.UF }, x: L.x, i };
}
function gdModule(GS, prj, rows, over) {
  const d = clone(GS.ctx.GM.gs.def), dk = prj.deck;
  return { ...d, gT: '50', gB: '50', gW: '50', Fyr: prj.mat.Fyr, fc: prj.mat.fc, wc: prj.wc, K1: 1, nRule: 'exact', rebarMp: 'excl', ts: dk.ts, tdeck: dk.tdeck, hh: dk.haunch,
    Art: dk.rebar.top.A, crt: dk.rebar.top.c, Arb: dk.rebar.bot.A, crb: dk.rebar.bot.c, negM: 'auto', rows, ...(over || {}) };
}
test('GS17 flange stress range: flange() on engine/flexure.js locations = GirderDetail GM.gs GS17, every station of the 100 gd_* payloads', () => {
  const GS = gdGirderSection(), P0 = GS.ctx.P, fa0 = P0.fa, br0 = P0.df.bridge;
  ['gdFatNear', 'gdFatSup', 'gdFatN', 'gdFatLS', 'gdFatSet', 'f0', 'f2', 'f3', 'frac', 'esc'].forEach(k => GS.fn(k));   // declared before the first use with a bridge (gd-source.mjs warm-up note)
  const traffic = [{ limit: 'auto', ADTT: 1000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } }, { limit: 'auto', ADTT: 6000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } }];
  const cats = [['B', 'B'], ["C'", 'E']];
  let nLoc = 0, nIt = 0, nII = 0, nI = 0; const diffs = []; let worst = { rel: 0, what: '' };
  try {
    payloads.forEach((f, k) => {
      const pl = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')).payload, d = FX.fromPayload(pl, {}), sup = pl.member.supports;
      // every 4th station (all payloads; all stations on the first payload of each family)
      const locs = d.locs.filter((L, i) => i % (/_G1\.json$/.test(f) ? 1 : 4) === 0);
      const bridge = { ok: true, spans: pl.member.spans, cont: sup.length > 2, skews: ((pl.girderDetail.skew || {}).bySupport || []).slice() };
      const tr = traffic[k % 2], [catT, catB] = cats[k % 2], s = FA.settings(tr), B = FA.supports(bridge);
      GS.ctx.P.fa = clone(tr); GS.ctx.P.df.bridge = clone(bridge);
      const p = gdModule(GS, d.prj, locs.map((L, i) => gdRow(GS, L, i)), { catT, catB });
      const R = GS.compute(p, { base: true }), C = gdRun(GS.ctx, c => c.GM.gs.checks(R), GS.loaded), c17 = C.find(c => c.id === 'GS17');
      const G = FX.girder(locs, d.prj, { supports: sup });
      G.rows.forEach((r, i) => { nLoc++;
        const o = FA.flange(r, { set: s, B, catT, catB }), g = c17.items.slice(2 * i, 2 * i + 2);
        o.items.forEach((it, j) => { nIt++; if (it.lim === 'II') nII++; else nI++;
          const q = g[j], rel = Math.abs(it.r - q.r) / Math.max(1e-300, Math.abs(q.r));
          if (rel > worst.rel) worst = { rel, what: `${f} ${it.loc}: ${it.r} vs ${q.r}` };
          if (it.loc !== q.loc || it.st !== q.st || rel > 1e-12) diffs.push(`${f} ${it.loc}: ${it.r} ${it.st} vs GirderDetail ${q.loc} ${q.r} ${q.st}`); });
        if (o.fatN !== R.rows[i].fatN) diffs.push(`${f} ${r.name} n ${o.fatN} vs ${R.rows[i].fatN}`); });
    });
  } finally { GS.ctx.P.fa = fa0; GS.ctx.P.df.bridge = br0; }
  console.log(`       ${payloads.length} payloads, ${nLoc} locations, ${nIt} flange items (${nI} Fatigue I, ${nII} Fatigue II): ${diffs.length} differ; largest relative difference ${worst.rel.toExponential(2)}`);
  assert.ok(nI > 0 && nII > 0, 'both limit states reached');
  assert.deepEqual(diffs.slice(0, 10), []);
});

test('hand checks: FA1 Fatigue II at a connection plate weld toe; FA2 net tension; FA3 web; GS17 limit state (GirderDetail built-in inputs)', () => {
  const R = FA.compute(clone(FA.DEFAULT)), r = R.rows[1], s = FA.settings(FA.DEFAULT);
  // ADTT_SL = 0.85(2000) = 1700 trucks/day. Row 2: Cp-stiff, Category C′ (A = 44.0 × 10⁸ ksi³, (ΔF)_TH = 12 ksi), n = 1.
  // Infinite-life equivalent: 44e8 (1.75/(0.80 × 12))³/(365 × 75 × 1) = 44e8 × 0.0060575 / 27,375 = 973.6 trucks/day; 1700 ≥ 973.6: Fatigue I.
  assert.ok(Math.abs(R.ADTTSL - 1700) < 1e-9); assert.equal(r.cat, "C'"); assert.ok(Math.abs(r.ADTTeq - 973.6) < 0.1, String(r.ADTTeq)); assert.equal(r.lim, 'I'); assert.equal(r.res, 12);
  // Same row forced to Fatigue II: N = 365(75)(1)(1700) = 46,537,500; (ΔF)_n = (44e8/46,537,500)^(1/3) = (94.548)^(1/3) = 4.5556 ksi; γ = 0.80.
  const p2 = clone(FA.DEFAULT); p2.limit = 'II'; const R2 = FA.compute(p2), r2 = R2.rows[1];
  assert.ok(Math.abs(r2.N - 46537500) < 1e-6); assert.ok(Math.abs(r2.dFn - 4.5556) < 1e-4, String(r2.dFn)); assert.equal(r2.gam, 0.8);
  // Stress range at the bottom flange inner face (y = t_bf = 1.125 in), plates 16 × 3/4, 60 × 9/16, 16 × 1 1/8, b_eff 114, t_s 8, haunch 2,
  // f′c = 4 ksi: E_c = 120,000(0.150²)(4^0.33) = 2700 × 1.5801 = 4266.3 ksi... (n = 29,000/E_c); f+ = −620(12)(1.125 − ȳ_n)/I_n.
  // Check the arithmetic chain against the section values themselves (no rounding), then the ratio:
  const S = r.S, fP = -620 * 12 * (1.125 - S.cn.yb) / S.cn.I, fN = 150 * 12 * (1.125 - S.r.yb) / S.r.I;
  assert.ok(Math.abs(r.fP - fP) < 1e-12 && Math.abs(r.fN - fN) < 1e-12); assert.ok(Math.abs(r.df - (Math.abs(fP) + Math.abs(fN))) < 1e-12);
  assert.ok(Math.abs(r.dem - 1.75 * r.df) < 1e-12);
  // Row 4 (Pier 1, top flange): M_D1 = −2300, M_D2 = −710 kip-ft: f_DL = tension at the top flange: not exempt.
  // FA3 at row 4: V_u = 125 + 1.75(55) = 221.25 kip; d_o = 90 in, D = 60, t_w = 9/16: k = 5 + 5/(90/60)² = 7.2222; D/t_w = 106.667;
  // 1.40√(29,000 × 7.2222/50) = 1.40(64.722) = 90.61 < 106.667: C = 1.57/106.667² × (29,000 × 7.2222/50) = 1.57/11,377.8 × 4188.9 = 0.57802;
  // V_cr = C V_p = 0.57802 × 978.75 = 565.74 kip ≥ 221.25.
  const r4 = R.rows[3]; assert.ok(r4.fDL > 0 && !r4.exempt); assert.ok(Math.abs(r4.Vu - 221.25) < 1e-9);
  assert.ok(Math.abs(r4.sh.k - 7.2222) < 1e-4); assert.ok(Math.abs(r4.sh.C - 0.57802) < 1e-5, String(r4.sh.C)); assert.ok(Math.abs(r4.sh.Vcr - 565.74) < 0.01, String(r4.sh.Vcr));
  // GS17 limit state for Category B at n = 1.5: equivalent = 120e8 (1.75/(0.80 × 16))³/(365 × 75 × 1.5) = 120e8 × 0.0025555/41,062.5 = 746.8 trucks/day;
  // 1700 ≥ 746.8: Fatigue I, (ΔF)_TH = 16 ksi.
  const q = FA.limitState('B', 1.5, 1.75, s); assert.ok(Math.abs(q.eq - 746.8) < 0.1, String(q.eq)); assert.equal(q.lim, 'I'); assert.equal(q.res, 16);
  // Studs (Condition 9.2, m = 5): equivalent = 1040e8 (1.75/(0.80 × 7.0))⁵/(365 × 75 × 1) = 1040e8 × 0.0029802/27,375 = 11,322 trucks/day (the
  // "11,320" of GirderDetail's note); 1700 < 11,322: Fatigue II; Z_r = (1040e8/46,537,500)^(1/5) × 0.60132 = (2234.76)^(0.2) × 0.60132 = 4.6757 × 0.60132 = 2.8116 kip.
  const z = FA.studLimit(1, 0.875, 7.0 * Math.PI * 0.875 ** 2 / 4, 1.75, s); assert.ok(Math.abs(z.eq - 11322) < 1, String(z.eq)); assert.equal(z.lim, 'II');
  assert.ok(Math.abs(z.dFn - 4.6757) < 1e-4, String(z.dFn)); assert.ok(Math.abs(z.Zr - 2.8116) < 1e-4, String(z.Zr));
  // a worked line renders with the substituted values
  const st = FA.steps(R2, r2).find(o => o.id === 'fa1.N'); assert.equal(W.SharedSteps.line(st, false).replace(/\s+/g, ' '), 'N = 365(life)n(ADTT)_(SL) = 365(75)(1)(1,700) = 46537500');
});

test('model: the optional fatigue and studs inputs (additive; a project without them still reads)', () => {
  const M = loadShared('units.js', 'steps.js', ENG('model.js')).SBDModel, p = M.defaultProject();
  assert.equal(JSON.stringify(M.validate(p).errors.map(e => e.path)), '[]');
  const q = clone(p); delete q.fatigue; delete q.studs; assert.equal(JSON.stringify(M.validate(q).errors.map(e => e.path)), '[]', 'a version 1 project saved before this PR');
  const r = clone(p); r.fatigue.ADTT = -1; r.fatigue.limit = 'x'; r.studs.zones = [{ x1: 10, x2: 5, nr: 2.5, p: 6 }]; r.studs.beffMode = 'x';
  assert.equal(JSON.stringify(M.validate(r).errors.map(e => e.path)), JSON.stringify(['fatigue.limit', 'fatigue.ADTT', 'studs.beffMode', 'studs.zones.0']));
  assert.equal(M.defaultStuds().beffMode, 'bridge', 'b_eff per girder is off by default');
});

test('ui/fatigue.js build(): the example and a hand-off file (no exception; the GirderDetail stud results unchanged with no project zones)', () => {
  const E = f => path.join(ROOT, 'apps/steel-bridge', f);
  const U = loadShared('units.js', 'steps.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/fatigue.js'), E('engine/studs.js'), E('ui/fatigue.js'));
  const P = U.SBDModel.defaultProject(), R = U.SBDFatigueUI.build({ P, g: 0, pl: null });
  assert.equal(R.err, undefined); assert.equal(R.FR.errors.length + R.SR.errors.length, 0); assert.equal(R.FR.rows.length, 4); assert.equal(R.gs17, null);
  const pl = JSON.parse(fs.readFileSync(path.join(DIR, 'gd_builtin_AASHTO_G2.json'), 'utf8')).payload, q = pl.girderDetail.details.studs.results;
  P.studs.h = 5; P.studs.st = 3.5;   // the payload's studs (Preliminary sizing's), so the SC1/SC2 ratios are GirderDetail's
  const R2 = U.SBDFatigueUI.build({ P, g: 0, pl });
  assert.equal(R2.FR.errors.length + R2.SR.errors.length, 0); assert.ok(R2.gs17.length > 100 && R2.FR.rows.length > 10);
  const c1 = R2.SCC.find(c => c.id === 'SC1').items; q.zones.forEach((z, i) => assert.ok(Math.abs(c1[i].r - z.r) < 1e-6, `zone ${i}`));
  // this project's analysis (engine/analysis.js): the default demand source of the tab
  const UA = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), E('engine/lldf.js'), E('engine/loads.js'), E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/analysis.js'), E('engine/fatigue.js'), E('engine/studs.js'), E('ui/fatigue.js'));
  const R3 = UA.SBDFatigueUI.build({ P: UA.SBDModel.defaultProject(), g: 0 });
  assert.equal(R3.err, undefined); assert.equal(R3.FR.errors.length + R3.SR.errors.length, 0); assert.equal(R3.SR.zones.length, 30); assert.equal(R3.SR.regions.length, 6); assert.ok(R3.gs17.length > 300 && R3.g17.it.r > 0);
});
