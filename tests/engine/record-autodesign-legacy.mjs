#!/usr/bin/env node
// Records what the legacy design helpers produce on the 20 recorded projects (tests/projects/sbd2-fat: builtin, builtin28, curb, util, xsA ×
// AASHTO, RIDOT, MassDOT, CTDOT), run in Node from the page text of "Steel Bridge Design.html" (added 2026-10-30 for the Auto design parity):
//   - Preliminary sizing: the quick suggestion (suggestLayout) and Full design (suggestFull), on the project as Preliminary sizing has it
//     (tests/engine/ad-fixture.mjs plProject: DEFAULT or the seed's plateline_autosave_v1, owner set);
//   - ST-Girder's Optimize (OptimizeTab: the bottom flange thickness swept ±0.75 in by 1/8 in around the current one, computeAll at each, the
//     thinnest with every check passing) on each girder's GirderDetail hand-off (tests/projects/st/gd_<project>_<owner>_G<k>.json), adopted
//     as ST-Girder's "Pull from GirderDetail" does (gdAdopt).
// Output: tests/projects/sbd2-autodesign/legacy_<project>_<owner>.json. Usage: node tests/engine/record-autodesign-legacy.mjs [filter …]
// (Full design takes about ten minutes a project; run several filters in parallel.)
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';
import { plDecl } from './pl-source.mjs';
import { gdDecl } from './gd-source.mjs';
import { stDecl, stAdopt } from './st-source.mjs';
import { legacyContext } from './legacy-closure.mjs';
import { plProject, RECS } from './ad-fixture.mjs';

const OUT = path.join(ROOT, 'tests/projects/sbd2-autodesign'); fs.mkdirSync(OUT, { recursive: true });
const J = o => JSON.parse(JSON.stringify(o));
const filt = process.argv.slice(2);
const PL = legacyContext(['OWN_RULES', 'DEFAULT', 'suggestLayout', 'suggestFull', 'sgLists'], n => plDecl(n) || gdDecl(n)); PL.ev('window.GD_OWN_RULES = OWN_RULES;');
const ST = legacyContext(['DEFAULTS', 'computeAll', 'mergeInputs', 'gdLoadsCheck', 'externalSpans', 'zonesToSec', 'GRADES', 'fmt', 'ownLFOf', 'lfFac', 'gdLoadsOf', 'gdLoadGroups', 'gdOwnUse', 'gdLsrc', 'gdLLText', 'gdXfer', 'GD_LBL'], stDecl);
ST.ev(`var __nx=null; var inpRef={current:mergeInputs(DEFAULTS)}; var setInp=v=>{__nx=v;}; var setGdAuto=()=>{}; var setGdNew=()=>{}; var gdIsNew=()=>false; var GD_CH='girderDemands', GD_RX='stgirder'; window.confirm=()=>true;
${stAdopt()}; var __adopt=p=>{__nx=null; inpRef.current=mergeInputs(DEFAULTS); gdAdopt(p,'test',false); return __nx;};`);
const lay = r => ({ D: r.D, tw: r.tw, web: r.web.map(q => ({ L: q.L, t: q.t })), top: r.top.map(q => ({ L: q.L, b: q.b, t: q.t })), bot: r.bot.map(q => ({ L: q.L, b: q.b, t: q.t })), splices: (r.splices || []).slice() });
/* ST-Girder's OptimizeTab sweep, operation for operation (anchor `function OptimizeTab({R,inp}){`) */
function stOptimize(inp) {
  const base = +inp.sec.tfb, vals = []; for (let t = Math.max(0.5, base - 0.75); t <= base + 0.75 + 1e-6; t += 0.125) vals.push(+t.toFixed(3));
  const rows = vals.map(t => { const e = J(inp); e.sec.tfb = t; if (e.sec.useSegs && Array.isArray(e.sec.segs)) e.sec.segs = e.sec.segs.map(s => ({ ...s, tfb: +(Math.max(0.25, (+s.tfb || t) + (t - base))).toFixed(4) }));
    const R = ST.ctx.computeAll(e); if (!R.ok || !Array.isArray(R.checks)) return { t, pass: false, err: R.error || 'compute failed' };
    const fail = R.checks.filter(c => !c.pass).map(c => c.t); return { t, pass: !fail.length, fail, segs: e.sec.useSegs ? e.sec.segs.map(s => ({ xEnd: s.xEnd, tfb: s.tfb })) : null }; });
  const best = rows.filter(r => r.pass).sort((a, b) => a.t - b.t)[0] || null;
  return { base, L: inp.geom.L, rows, best };
}
for (const [pr, ow] of RECS) {
  const name = `${pr}_${ow}`; if (filt.length && !filt.some(f => name.includes(f))) continue;
  const file = path.join(OUT, `legacy_${name}.json`); if (fs.existsSync(file) && !process.env.FORCE) { console.log('have', name); continue; }
  const P = plProject(pr, ow, PL.ev('DEFAULT')), t0 = Date.now();
  const fast = PL.ctx.suggestLayout(J(P));
  const full = await PL.ctx.suggestFull(J(P), null, () => false);
  const st = [];
  for (let k = 1; k <= 5; k++) { const f = path.join(ROOT, `tests/projects/st/gd_${name}_G${k}.json`); if (!fs.existsSync(f)) continue;
    const inp = ST.ctx.__adopt(JSON.parse(fs.readFileSync(f, 'utf8')).payload); st.push({ g: k, ...(inp ? stOptimize(inp) : { err: 'not adopted' }) }); }
  const rec = { project: pr, owner: ow, seconds: Math.round((Date.now() - t0) / 1000), obj: P.suggest.obj || 'cost', costs: P.costs, nb: P.bridge.nb,
    fast: fast.errors && fast.errors.length ? { errors: fast.errors } : { ...lay(fast), cost: fast.cost.total, wTot: fast.cost.wTot },
    full: full.errors && full.errors.length ? { errors: full.errors } : { ...lay(full), cost: full.cost.total, wTot: full.cost.wTot, passed: !!(full.full && full.full.passed), spacing: full.spacing, spPier: full.spPier ?? null, webType: full.webType },
    st };
  fs.writeFileSync(file, JSON.stringify(rec, null, 1));
  console.log(name, rec.seconds, 's', 'full D', rec.full.D, 'passed', rec.full.passed, 'ST', st.map(s => s.best ? s.best.t : '-').join(','));
}
