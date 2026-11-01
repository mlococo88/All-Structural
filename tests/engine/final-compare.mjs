#!/usr/bin/env node
// Final comparison, new app vs old app (B5, 2026-11-01). Not a .test file: it runs for a long time (about 1 min a girder) and prints a
// table; docs/steel-bridge-comparison.md records the result.
//   node tests/engine/final-compare.mjs [--girders 0,1,2,3,4] [--projects builtin,xsA] [--owners AASHTO] [--json out.json]
//
// For each of the 20 recorded projects (tests/projects/gd seeds xsA, curb, util and the built-in project, builtin28; owners AASHTO, RIDOT,
// MassDOT, CTDOT; built as tests/engine/legacy.test.mjs builds them) the old app's project file is imported through the import path
// (engine/legacy.js, the "From old app" button), and for each girder G1–G5 every module is computed twice with the report's data
// (report/data.js compute, report/builders.js govRows: each check group's governing ratio or rating factor, the modules' own values):
//   new:  this app's analysis (src 'analysis'): the whole new app on the imported project;
//   old:  GirderDetail's own demands, the hand-off it sent for that girder (tests/projects/st/gd_<project>_<owner>_G<n>.json; src 'file'),
//         with this app's module engines. Those engines reproduce GirderDetail's module results on the same demands exactly or to round-off
//         (the module parity tests: flexure, proportions, shear, stiffeners, studs, fatigue, constructibility, splices, welds against
//         GirderDetail's own functions; rating against ST-Girder), so this column is GirderDetail's result.
// The difference of each group is then the import path's: the analysis (and the model from the import), not the formulas. The analysis
// envelopes are compared too (as legacy.test.mjs). Field splices are not in the file path (designed from the project's analysis);
// tests/engine/splices.test.mjs compares them with GirderDetail on the payloads.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, ROOT } from './harness.mjs';
import { plContext } from './pl-source.mjs';
import { gdDecl, gdBlock } from './gd-source.mjs';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/legacy.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/demands.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js'].filter(f => fs.existsSync(E(f))).map(f => f.includes('/') ? E(f) : f));
const U = loadShared(...FILES);
U.SBDReportData.install();
const M = U.SBDModel, LG = U.SBDLegacy, J = o => JSON.parse(JSON.stringify(o));
const OWNERS = (arg('owners') || 'AASHTO,RIDOT,MassDOT,CTDOT').split(','), PROJECTS = (arg('projects') || 'builtin,builtin28,xsA,curb,util').split(','), GIRDERS = (arg('girders') || '0,1,2,3,4').split(',').map(Number);

/* ---------- the old app's saved parts (copied from tests/engine/legacy.test.mjs, unchanged) ---------- */
let PLDEF = null;
const plDefault = () => PLDEF || (PLDEF = (() => { const L = plContext(['ownBlank', 'DEFAULT', 'migrateOwner', 'migrateCosts']); return J(L.run(c => vm.runInContext('migrateOwner(migrateCosts(JSON.parse(JSON.stringify(DEFAULT))))', c))); })());
let GDDEF = null;
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
  LG.ownMigrate(pl);
  { const d = U.SBDOwners.defaults(owner).find(q => q.path === 'xs.dlMethod'), dl = gd.df && gd.df.dl; if (dl && (dl.method || 'massdot') === 'massdot') dl.method = d ? d.value : 'massdot'; }
  pl.limits.dot = owner; if (pr === 'builtin28') pl.bridge.skews = pl.bridge.skews.map(() => 28);
  return { pl, gd };
}
const sbdFile = (pr, owner) => { const { pl, gd } = parts(pr, owner); return { app: 'SteelBridgeDesign', v: 1, name: `${pr} ${owner}`, data: gd, pl: { app: 'PlateLine', v: 1, name: pr, data: pl }, st: null }; };
const readP = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests/projects/st', f), 'utf8')).payload;

/* ---------- run ---------- */
const out = [], t0 = Date.now(), QA = ['M_DC1', 'M_DC2', 'M_DW', 'M_LLpos', 'M_LLneg', 'M_FATpos', 'M_FATneg', 'V_DC1', 'V_LLpos', 'V_LLneg'];
for (const pr of PROJECTS) for (const ow of OWNERS) {
  const r = M.importJSON(JSON.stringify(sbdFile(pr, ow))); if (!r.ok) { out.push({ pr, ow, err: r.error }); continue; }
  const P = r.project;
  for (const gi of GIRDERS) {
    const f = `gd_${pr}_${ow}_G${gi + 1}.json`; if (!fs.existsSync(path.join(ROOT, 'tests/projects/st', f))) continue;
    const pl = readP(f), t1 = Date.now();
    let Bn, Bo; try { Bn = U.SBDReportData.compute(P, gi, { src: 'analysis' }); Bo = U.SBDReportData.compute(P, gi, { src: 'file', pl, plName: f }); } catch (e) { out.push({ pr, ow, gi, err: e.message }); continue; }
    const Rn = U.SBDReportBuild.govRows(Bn), Ro = U.SBDReportBuild.govRows(Bo);
    // analysis envelopes (this app's, in the hand-off shape) against GirderDetail's hand-off
    const env = {}; try { const A = U.SBDRatingUI.fromAnalysis(P, gi); if (!A.err) { const S = A.pl.stations, Sg = pl.stations;
      QA.forEach(k => { const a = S.map(s => +s[k] || 0), b = Sg.map(s => +s[k] || 0), sc = Math.max(...b.map(Math.abs)) || 1; env[k] = { max: (Math.max(...a) - Math.max(...b)) / sc, min: (Math.min(...a) - Math.min(...b)) / sc }; }); } } catch (e) { env.err = e.message; }
    const rec = { pr, ow, gi, s: (Date.now() - t1) / 1000, env, rows: [] };
    const grps = [...new Set([...Rn.rows.map(q => q.grp), ...Ro.rows.map(q => q.grp)])];
    grps.forEach(gp => { const a = Rn.rows.find(q => q.grp === gp), b = Ro.rows.find(q => q.grp === gp), v = q => (q ? (q.rf != null ? q.rf : q.r) : null);
      rec.rows.push({ grp: gp, rf: !!((a && a.rf != null) || (b && b.rf != null)), nw: v(a), old: v(b), checkN: a && a.check, checkO: b && b.check, locN: a && a.loc, locO: b && b.loc }); });
    rec.errN = Rn.err; rec.errO = Ro.err;
    out.push(rec);
    const big = rec.rows.filter(q => q.nw != null && q.old != null && Math.abs(q.nw - q.old) > 5e-3 * Math.max(1, Math.abs(q.old)));
    console.log(`${pr} ${ow} G${gi + 1} (${rec.s.toFixed(0)} s): ${rec.rows.length} groups; ${big.length ? big.map(q => `${q.grp}: ${q.nw != null ? q.nw.toFixed(3) : '—'} vs ${q.old != null ? q.old.toFixed(3) : '—'}`).join('; ') : 'all within 0.5 %'}`);
  }
}
const J2 = arg('json'); if (J2) fs.writeFileSync(J2, JSON.stringify(out, null, 1));
console.log(`done in ${((Date.now() - t0) / 60000).toFixed(1)} min, ${out.length} girders`);
