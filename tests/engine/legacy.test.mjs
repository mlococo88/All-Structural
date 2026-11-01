// engine/legacy.js (import of old Steel Bridge Design projects, CLAUDE.md §5) and engine/model.js importLegacy / importJSON.
//
// 1. The 20 recorded projects (tests/projects/gd seeds xsA, curb, util and the built-in project, builtin28 = every skew 28°; owners AASHTO,
//    RIDOT, MassDOT, CTDOT; the same steps as tests/engine/record-*.mjs): Preliminary sizing's project (pl-source.mjs DEFAULT or the seed's
//    plateline_autosave_v1, owner set in it) + GirderDetail's (the seed's girderdetail_autosave_v1, or GirderDetail's built-in module
//    inputs), as one Steel Bridge Design project file. Imported, then computed with this app's analysis and flexure for G1–G5, against
//    GirderDetail's own results for the same girder (tests/projects/st/gd_<project>_<owner>_G<n>.json, recorded from GirderDetail):
//      - the model (spans, plates, b_eff, skews, girders, deck, owner): exact;
//      - the analysis envelopes (largest and smallest M, V of each load over the girder);
//      - the governing negative flexure per span (girderDetail.checks.negFlex: GS7/GS9 compression flange, GS8 tension flange).
//    A table of the largest difference per quantity is printed with its cause; the bounds asserted are the documented differences.
// 2. Nothing dropped: every leaf of every part is either mapped or found at its own path under project.legacy.unmapped.
// 3. Round trip: export → importJSON → identical project. Old autosave keys read only (a storage stand-in that throws on write).
// 4. ST-Girder alone and the other entry points; refusals.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { plContext } from './pl-source.mjs';
import { gdDecl, gdBlock } from './gd-source.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const U = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', E('engine/model.js'), E('engine/legacy.js'), E('engine/sections.js'), E('engine/flexure.js'), E('engine/owners.js'), 'lldf.js', E('engine/lldf.js'),
  E('engine/loads.js'), E('engine/shear.js'), E('engine/stiffeners.js'), E('engine/framing.js'), E('engine/crossframes.js'), E('engine/analysis.js'), E('engine/fatigue.js'), E('engine/rating.js'), E('ui/shear.js'), E('ui/rating.js'), E('engine/studs.js'), E('ui/fatigue.js'));
const M = U.SBDModel, LG = U.SBDLegacy, J = o => JSON.parse(JSON.stringify(o));
const OWNERS = ['AASHTO', 'RIDOT', 'MassDOT', 'CTDOT'], PROJECTS = ['builtin', 'builtin28', 'xsA', 'curb', 'util'];

/* ---------- the old app's saved parts ---------- */
let PLDEF = null;
// Preliminary sizing's built-in project as its page holds and saves it: loadData(DEFAULT) = migrateOwner(migrateCosts(DEFAULT)) (the owner defaults of
// DEFAULT's owner, MassDOT, applied once: f'c 5 ksi, …), which is what the recordings started from before the owner was set
const plDefault = () => PLDEF || (PLDEF = (() => { const L = plContext(['ownBlank', 'DEFAULT', 'migrateOwner', 'migrateCosts']); return J(L.run(c => vm.runInContext('migrateOwner(migrateCosts(JSON.parse(JSON.stringify(DEFAULT))))', c))); })());
let GDDEF = null;
/* GirderDetail's built-in module inputs (GD_FULL: GD_DEFAULT, BS_DEFAULT and each module's def), from the page text */
function gdDefault() {
  if (GDDEF) return GDDEF;
  const ctx = { console }; vm.createContext(ctx); vm.runInContext('var P = { df: { bridge: {} } }; var GM = {};', ctx);
  const loaded = new Set(), run = fn => { for (let k = 0; k < 400; k++) { try { return fn(); } catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e; const d = gdDecl(m[1]); if (!d) throw e; loaded.add(m[1]); run(() => vm.runInContext(d.replace(/^(const|let) /, 'var '), ctx)); } } };   // var: a declaration that failed on a missing name can run again
  const out = run(() => vm.runInContext('(' + gdDecl('GD_DEFAULT').replace(/^const GD_DEFAULT = /, '').replace(/;\s*$/, '') + ')', ctx));
  out.bs = J(run(() => vm.runInContext('(' + gdDecl('BS_DEFAULT').replace(/^const BS_DEFAULT = /, '').replace(/;\s*$/, '') + ')', ctx)));
  for (const id of ['ts', 'sc', 'cf', 'oh', 'wt', 'gs', 'fa', 'df', 'sa']) { run(() => vm.runInContext(gdBlock(`GM.${id} = {`, '\n};\n') + '\n};', ctx)); out[id] = J(ctx.GM[id].def); }
  return (GDDEF = J(out));
}
function parts(pr, owner) {
  let pl, gd;
  if (pr === 'builtin' || pr === 'builtin28') { pl = J(plDefault()); gd = J(gdDefault()); }
  else { const seed = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/gd', pr + '.json'), 'utf8')); pl = JSON.parse(seed.plateline_autosave_v1).data; gd = JSON.parse(seed.girderdetail_autosave_v1).data; }
  LG.ownMigrate(pl);   // the old page's load-time owner-defaults migration, with the project's own owner, before the recorder set the owner
  // GirderDetail's owner change (the recorder set the owner in Preliminary sizing, which sent it to GirderDetail): the owner's default dead load
  // distribution method (OWN14 'df.dl.method': RIDOT ridot, CTDOT aashto; generic massdot) replaces the generic one the project had
  { const d = U.SBDOwners.defaults(owner).find(q => q.path === 'xs.dlMethod'), dl = gd.df && gd.df.dl; if (dl && (dl.method || 'massdot') === 'massdot') dl.method = d ? d.value : 'massdot'; }
  pl.limits.dot = owner; if (pr === 'builtin28') pl.bridge.skews = pl.bridge.skews.map(() => 28);
  return { pl, gd };
}
const sbdFile = (pr, owner) => { const { pl, gd } = parts(pr, owner); return { app: 'SteelBridgeDesign', v: 1, name: `${pr} ${owner}`, data: gd, pl: { app: 'PlateLine', v: 1, name: pr, data: pl }, st: null }; };
const readP = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/st', f), 'utf8')).payload;

/* ---------- comparison ---------- */
const big = {};   // quantity -> { rel, abs, ours, ref, where }
const note = (q, ours, ref, where, scale) => { const abs = Math.abs(ours - ref), rel = abs / Math.max(1e-9, Math.abs(scale ?? ref)); if (!big[q] || rel > big[q].rel) big[q] = { rel, abs, ours, ref, where }; };
const ext = (arr, f) => arr.reduce((a, v) => f(a, v), f === Math.max ? -Infinity : Infinity);
const QA = [['M_DC1', 'M_DC1'], ['M_DC2', 'M_DC2'], ['M_DW', 'M_DW'], ['M_LLpos', 'M_LLpos'], ['M_LLneg', 'M_LLneg'], ['M_FATpos', 'M_FATpos'], ['M_FATneg', 'M_FATneg']];

test('import the 20 recorded projects (Steel Bridge Design files), compute G1–G5: the model exact, analysis and negative flexure against GirderDetail', () => {
  const FX = U.SBDFlexure, FRM = U.SBDFraming, RT = U.SBDRatingUI; let nG = 0;
  for (const pr of PROJECTS) for (const ow of OWNERS) {
    const r = M.importJSON(JSON.stringify(sbdFile(pr, ow))); assert.ok(r.ok, r.error); assert.equal(r.errors.map(e => e.msg).join('; '), '', `${pr} ${ow}`);
    const P = r.project; assert.equal(P.girders.length, 5);
    for (let gi = 0; gi < 5; gi++) {
      const f = `gd_${pr}_${ow}_G${gi + 1}.json`, pl = readP(f), gd = pl.girderDetail, g = P.girders[gi], where = `${pr} ${ow} G${gi + 1}`; nG++;
      // model: exact
      assert.equal(JSON.stringify(P.spans.lengths), JSON.stringify(pl.member.spans), where);
      assert.equal(JSON.stringify(g.segments.map(s => [s.x0, s.x1, s.D, s.tw, s.topB, s.topT, s.botB, s.botT])), JSON.stringify(pl.section.zones.map(z => [z.startX, z.endX, z.web.depth, z.web.thickness, z.topFlange.width, z.topFlange.thickness, z.botFlange.width, z.botFlange.thickness])), `${where} plates`);
      assert.ok(Math.abs(g.beff - gd.deck.beff) < 0.006, `${where} b_eff ${g.beff} vs ${gd.deck.beff}`); assert.equal(g.position, gd.position, where);
      assert.equal(JSON.stringify(P.xs.skews), JSON.stringify(gd.skew.bySupport), `${where} skews`); assert.equal(P.ownerRules.owner, pl.ownerRules.owner, where);
      assert.equal(P.deck.ts, gd.deck.ts); assert.equal(P.deck.haunch, gd.deck.haunch); assert.equal(P.materials.concrete.fc, gd.materials.fc, where);
      // analysis and flexure: G1 (exterior) and G2 (interior); G3-G5 repeat them (symmetric bridges, one plate layout); about 9 s a girder
      if (gi > 1) continue;
      // LL+IM includes the pedestrian load in both (GirderDetail's hand-off: pedestrianInLL; this app: SBDAnalysis.llPL, sb-ped-owner PR), and M_PL alone
      const A = RT.fromAnalysis(P, gi); assert.ok(!A.err, A.err); const S = A.pl.stations, Sg = pl.stations;
      assert.equal(!!A.pl.pedestrianInLL, !!(pl.pedestrianInLL && Sg.some(s => s.M_PLpos || s.M_PLneg)), `${where} pedestrianInLL`);
      [...QA, ...(A.pl.pedestrianInLL ? [['M_PLpos', 'M_PLpos'], ['M_PLneg', 'M_PLneg']] : [])].forEach(([k, kg]) => { const val = s => +s[kg] || 0;
        const ref = Sg.map(val), ours = S.map(s => s[k] || 0), sc = Math.max(...ref.map(Math.abs));
        note(k + ' max', ext(ours, Math.max), ext(ref, Math.max), where, sc); note(k + ' min', ext(ours, Math.min), ext(ref, Math.min), where, sc); });
      // negative flexure per span (GS7/GS9 compression, GS8 tension), as the Flexure tab on a file, on this app's analysis
      const nf = gd.checks && gd.checks.negFlex; if (!nf) continue;
      const sup = A.pl.member.supports, frB = FRM.forGirder(P, { gi }, sup), flS = FRM.flSkew(P.xs.skews, g.position === 'exterior', P.framing);
      // the owner's load rules as the Flexure tab applies them (sb-ped-owner PR: engine/flexure.js factorsOwner, OWN6/OWN7, and m kept off the
      // pedestrian part, GD45), as GirderDetail's Girder section
      const lf = U.SBDOwners.loadFactors(ow, P.ownerRules.eta, P.xs.nb);
      const F = FX.fromPayload(A.pl, { fl: flS.fl, owner: ow, rebar: P.deck.rebar, braces: frB.braces, lenOf: frB.lenOf, lf }), G = FX.girder(F.locs, F.prj, { supports: F.supports });
      // xsA (sidewalks with a pedestrian load) listed apart
      const sfx = pr === 'xsA' ? ' [xsA, pedestrian]' : '';
      for (const sp of nf.spans) { const a = sup[sp.span - 1], b = sup[sp.span];
        const rows = G.rows.filter(q => q.region === 'neg' && q.x >= a - 1e-6 && q.x <= b + 1e-6), mx = ids => Math.max(0, ...rows.flatMap(q => q.checks.filter(c => ids.includes(c.id) && c.inUse && isFinite(c.ratio)).map(c => c.ratio)));
        if (sp.comp) note('negFlex comp. flange (GS7/GS9)' + sfx, mx(['GS7', 'GS9']), sp.comp.r, `${where} span ${sp.span}`);
        if (sp.tens) note('negFlex tens. flange (GS8)' + sfx, mx(['GS8']), sp.tens.r, `${where} span ${sp.span}`); }
    }
  }
  console.log(`       ${nG} girders of 20 imported projects; largest difference per quantity (relative to GirderDetail's largest |value| of the quantity on the girder; flexure: ratio difference / ratio):`);
  Object.entries(big).forEach(([k, o]) => console.log(`       ${k.padEnd(34)} ${(100 * o.rel).toFixed(3).padStart(7)} %  ours ${o.ours.toFixed(3)} vs GirderDetail ${o.ref.toFixed(3)}  (${o.where})`));
  assert.equal(nG, 100);
  BOUNDS.forEach(([k, b]) => assert.ok(!big[k] || big[k].rel <= b, `${k}: ${(100 * big[k].rel).toFixed(3)} % > ${100 * b} %`));
});
// the documented differences (fixlog/steel-bridge.md, legacy import entry): bounds of the table above
// - M_DC1 ≤ 1.0 %: the cross-frame point loads. GirderDetail's dead load weighed Preliminary sizing's suggested frame (K-frame, L3x3x3/8 bottom chord and
//   diagonals: 2.80 kip on builtin G1); this app weighs the frame its Cross-frames module checks (the imported GirderDetail Cross-frames inputs: X-frame,
//   L5x5x3/8 × 3: 4.73 kip), and the girder steel at 490/144 lb/ft per in² (SB2-A2, +0.08 % of the steel part). Largest 0.76 % (builtin AASHTO G2).
// - M_DC2, M_DW ≤ 0.05 %: round-off of the hand-off (0.001 kip-ft) and the station grids (largest 0.006 %).
// - LL+IM (pedestrian load included on both sides since the sb-ped-owner PR), M_PL and fatigue moments ≤ 0.01 %.
// - negative flexure ≤ 0.5 %: the M_DC1 above through f_bu, and C_b / L_b from this app's framing (largest 0.32 %, builtin CTDOT G2 span 1).
// - xsA (sidewalks, 75 psf pedestrian load): ≤ 0.5 %, as the others (sb-ped-owner PR: the pedestrian load in the analysis and the owner η, m in
//   engine/flexure.js; before: up to 10.4 %, xsA RIDOT G1, 1.040 vs 1.160).
const BOUNDS = [['M_DC1 max', 0.01], ['M_DC1 min', 0.01], ...['M_DC2', 'M_DW'].flatMap(k => [[k + ' max', 5e-4], [k + ' min', 5e-4]]),
  ...['M_LLpos', 'M_LLneg', 'M_FATpos', 'M_FATneg', 'M_PLpos', 'M_PLneg'].flatMap(k => [[k + ' max', 1e-4], [k + ' min', 1e-4]]),
  ['negFlex comp. flange (GS7/GS9)', 0.005], ['negFlex tens. flange (GS8)', 0.005], ['negFlex comp. flange (GS7/GS9) [xsA, pedestrian]', 0.005], ['negFlex tens. flange (GS8) [xsA, pedestrian]', 0.005]];

test('nothing dropped: every leaf of the old parts is mapped or kept under legacy.unmapped; the import summary lists it', () => {
  for (const pr of PROJECTS) { const r = LG.importLegacy(sbdFile(pr, 'RIDOT')), P = r.project, U0 = P.legacy.unmapped;
    assert.ok(r.ok); assert.ok(r.summary.unmapped.length > 0);
    // module rows are not mapped (this app makes its own): kept, at their own path
    assert.equal(JSON.stringify(U0.gd.fa.rows), JSON.stringify(parts(pr, 'RIDOT').gd.fa.rows));
    assert.equal(JSON.stringify(U0.gd.sc.regions), JSON.stringify(parts(pr, 'RIDOT').gd.sc.regions));   // the zones are read since D-2 (2026-11-01); the regions stay
    const txt = LG.summaryText(r.summary); assert.ok(/kept in the project under legacy\.unmapped/.test(txt));
    if (pr === 'util') assert.ok(r.summary.notes.some(n => /xf, xfAllow/.test(n)), r.summary.notes.join(' | '));
  }
});

test('round trip: export the imported project, import it again: identical; the old autosave keys are read, never written', () => {
  const r = M.importJSON(JSON.stringify(sbdFile('xsA', 'MassDOT'))), t1 = M.exportJSON(r.project), r2 = M.importJSON(t1);
  assert.ok(r2.ok); assert.equal(M.exportJSON(r2.project), t1);
  const { pl, gd } = parts('curb', 'CTDOT'), keys = { girderdetail_autosave_v1: JSON.stringify({ data: gd, name: 'x' }), plateline_autosave_v1: JSON.stringify({ data: pl, name: 'curb', ts: 1 }) };
  const store = { getItem: k => keys[k] ?? null, setItem: () => { throw new Error('write'); }, removeItem: () => { throw new Error('delete'); } };
  const a = LG.fromStorage(store), b = LG.importLegacy(sbdFile('curb', 'CTDOT'));
  assert.ok(a.ok, a.error); delete a.project.legacy; delete b.project.legacy; a.project.project.name = b.project.project.name;
  assert.equal(JSON.stringify(a.project), JSON.stringify(b.project));
  assert.equal(LG.fromStorage({ getItem: () => null }).ok, false);
});

test('other entry points: GirderDetail file, PlateLine file, ST-Girder alone (one simple span), hand-off and newer files refused', () => {
  const { pl, gd } = parts('builtin', 'AASHTO');
  const a = M.importJSON(JSON.stringify({ app: 'PlateLine', v: 1, name: 'p', data: pl })); assert.ok(a.ok); assert.equal(a.project.girders.length, 5); assert.equal(a.errors.map(e => e.msg).join('; '), '');
  const b = M.importJSON(JSON.stringify({ app: 'GirderDetail', data: gd })); assert.ok(b.ok, b.error); assert.equal(b.errors.map(e => e.msg).join('; '), '');
  const st = { proj: { name: 'ST', girderId: 'G3', by: 'MLC', date: '2026-10-01', job: '7' }, sec: { D: 66, tw: 0.5, bft: 16, tft: 0.75, bfb: 18, tfb: 1.25, useSegs: false, segs: [] }, negM: { As: 12, dTop: 4 },
    mat: { grade: 'HPS 50W (Fy=50)', Fyw: 50, Fyf: 50, Fu: 70, Es: 29000, hybrid: false }, deck: { fc: 4, wc: 0.15, ts: 8, haunch: 2, beffAuto: true, beff: 108, deckOn: true, oh: 3, fyd: 60 },
    geom: { L: 120, S: 9, nGirders: 5, Lb: 20 }, loads: { pos: 'interior', skew: 0 }, stiff: { transverse: true, doSpc: 60, bt: 6, tp: 0.5, bearB: 7, bearT: 0.75, bearN: 2 }, conn: { studD: 0.875, studH: 6, Fu: 60 },
    fatigue: { ADTT: 1000, adttIsSingleLane: true, designLife: 75, lsMode: 'auto' }, rate: { phiC: 0.95, phiS: 1 }, rateVeh: [{ name: 'x' }], _schema: 'stgirder' };
  const c = M.importJSON(JSON.stringify(st)); assert.ok(c.ok); assert.equal(c.errors.map(e => e.msg).join('; '), '');
  assert.equal(JSON.stringify(c.project.spans), '{"lengths":[120],"continuity":"simple"}'); assert.equal(c.project.rating.phiC, 0.95); assert.equal(c.project.girders[0].beff, 108);
  assert.equal(c.project.materials.steel.top, '50W'); assert.equal(JSON.stringify(c.project.legacy.unmapped.st.rateVeh), '[{"name":"x"}]');
  assert.equal(M.importJSON(JSON.stringify({ _schema: 'stgirder-external-demands', stations: [] })).ok, false);
  assert.equal(M.importJSON(JSON.stringify({ app: 'SteelBridgeDesign', v: 2, data: {} })).ok, false);
});

test('stud pitch zones (D-2, 2026-11-01): GirderDetail\'s zones imported as entered; its built-in example left out; the app\'s own layout meets SC1 and SC2', () => {
  const mx = (C, id) => Math.max(0, ...C.find(c => c.id === id).items.map(i => i.r).filter(isFinite));
  // the recorded seeds hold GirderDetail's built-in example zones (0–22 ft 3 @ 9 in, 22–55 ft 3 @ 12 in): not imported
  const f = sbdFile('xsA', 'AASHTO'), P0 = M.importJSON(JSON.stringify(f)).project;
  assert.equal((P0.studs.zones || []).length, 0); assert.ok(P0.legacy.summary.notes.some(n => /built-in example/.test(n)));
  assert.ok(!JSON.stringify(P0.legacy.unmapped).includes('"zones"'), 'sc.zones read');
  // the app's own layout (xsA G1, exterior with a sidewalk: little fatigue shear, so Preliminary sizing's fatigue rule gives pitches up to 24 in):
  // before, SC2 failed (Abut. 1 to max. positive, Span 1: n_prov 888 studs in the girder, ratio 1.372); now the zones of a short region are
  // tightened by n_prov/n_req (rounded down to 1/2 in, ≥ 6d) until SC2 passes: ratio 0.988, 1108 studs.
  const F0 = U.SBDFatigueUI.build({ P: P0, g: 0, src: 'analysis' });
  assert.ok(mx(F0.SCC, 'SC2') <= 1 + 1e-9 && mx(F0.SCC, 'SC1') <= 1 + 1e-9, `SC1 ${mx(F0.SCC, 'SC1')}, SC2 ${mx(F0.SCC, 'SC2')}`);
  assert.ok(Math.abs(mx(F0.SCC, 'SC2') - 0.988) < 5e-4, String(mx(F0.SCC, 'SC2')));
  F0.SR.zones.forEach(z => assert.ok(z.p >= 6 * 0.875 - 1e-9 && Math.abs(z.p * 2 - Math.round(z.p * 2)) < 1e-9));
  // zones a GirderDetail user loaded (the hand-off's, from Preliminary sizing): imported as entered, checked as given (not refined)
  const Zg = readP('gd_xsA_AASHTO_G1.json').girderDetail.details.studs.zones; f.data.sc.zones = J(Zg);
  const P1 = M.importJSON(JSON.stringify(f)).project;
  assert.deepEqual(J(P1.studs.zones), Zg.map(z => ({ x1: z.x1, x2: z.x2, nr: z.nr, p: z.p })));
  const F1 = U.SBDFatigueUI.build({ P: P1, g: 0, src: 'analysis' });
  assert.deepEqual(J(F1.SR.zones.map(z => z.p)), Zg.map(z => z.p));
  assert.ok(Math.abs(mx(F1.SCC, 'SC2') - 0.956) < 5e-4, String(mx(F1.SCC, 'SC2')));   // GirderDetail's own SC2 on this girder: 0.956 (C-20 aside)
});
test('construction live load on import (D-1, 2026-11-01): w_CL = cll × b_eff per girder, M_CL and V_CL as GirderDetail\'s', () => {
  // GirderDetail GM.sa.compute: wCL = cll/1000 × b_eff,ft; the recorded projects have cll = 20 psf (Preliminary sizing / GirderDetail's bridge).
  // builtin G2 (interior): b_eff = 9.5 ft → w_CL = 0.020 × 9.5 = 0.190 klf; G1 (exterior): b_eff = 8.0 ft → 0.160 klf.
  const P = M.importJSON(JSON.stringify(sbdFile('builtin', 'AASHTO'))).project;
  assert.deepEqual(J(P.girders.map(g => g.loadsManual && g.loadsManual.CL)), [0.16, 0.19, 0.19, 0.19, 0.16]);
  P.girders.forEach(g => assert.ok(Math.abs(g.loadsManual.CL - 0.02 * g.beff / 12) < 1e-9));
  assert.ok(P.legacy.summary.notes.some(n => /^Construction live load 20 psf/.test(n)));
  assert.ok(!JSON.stringify(P.legacy.unmapped).includes('"cll"'), 'cll read');
  for (const [pr, ow, gi] of [['builtin', 'AASHTO', 1], ['curb', 'MassDOT', 0]]) {
    const Q = M.importJSON(JSON.stringify(sbdFile(pr, ow))).project, R = U.SBDAnalysis.analyzeGirder(Q, gi), pl = readP(`gd_${pr}_${ow}_G${gi + 1}.json`);
    const mx = a => Math.max(...Array.from(a).map(Math.abs)), ref = Math.max(...pl.stations.map(s => Math.abs(+s.M_CL || 0))), refV = Math.max(...pl.stations.map(s => Math.abs(+s.V_CL || 0)));
    assert.ok(ref > 0 && Math.abs(mx(R.st.CL.M) - ref) / ref < 1e-3, `${pr} ${ow} G${gi + 1} M_CL ${mx(R.st.CL.M)} vs ${ref}`);
    assert.ok(Math.abs(mx(R.st.CL.VL) - refV) / refV < 0.015, `${pr} ${ow} G${gi + 1} V_CL ${mx(R.st.CL.VL)} vs ${refV} (C-7: station vs element shear)`);
  }
  // an entered construction live load is kept; a file without cll leaves loadsManual alone
  const f = sbdFile('builtin', 'AASHTO'); if (f.data.df && f.data.df.bridge) delete f.data.df.bridge.cll; delete f.pl.data.suggest.cll;
  assert.ok(M.importJSON(JSON.stringify(f)).project.girders.every(g => !g.loadsManual));
});
