#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): results regression, headless, offline. Every unit's load components and limit-state combinations,
// the concurrent design sets, the foundation and abutment hand-off payloads, the input checks and the key values of every output tab and of
// the Report, compared between two versions (main vs a branch) or against the recorded baseline (tests/baselines/bsl.json).
// Same conventions as compare.mjs / ps-compare.mjs (section hashes, --record-baseline / --baseline, exit codes); helpers from tests/lib.mjs.
//
// Usage (from the repository root):
//   node tests/bsl-compare.mjs --baseline tests/baselines/bsl.json             the working tree against the baseline (A not run): the regression test
//   node tests/bsl-compare.mjs                                                origin/main vs the working tree, every case, differing values listed
//   node tests/bsl-compare.mjs --text                                         the same plus the display sections (full tab text, Report text,
//                                                                             localStorage): the main-vs-branch probe of a display-only PR
//   node tests/bsl-compare.mjs --a origin/main --record-baseline tests/baselines/bsl.json   record A's section hashes (A = origin/main)
//   node tests/bsl-compare.mjs --project default,skew30 --a 3ef3506 --b my-branch
// Options: --a (default origin/main), --b (default the working-tree file), --project (comma list or "all"; default all), --text (add the
//   display sections; never recorded in the baseline), --jobs N (cases at a time; default 1, i.e. two browsers when A and B both run),
//   --max-diffs (values listed per section; default 25), --out (raw readouts; default <tmp>/allstruct-tests/out).
// Exit code: 0 every section identical, 1 a difference, 2 an error (including console errors).
//
// Cases: "default" opens the tool with empty storage (the built-in example). Every other case opens tests/projects/bsl/<case>.json with the
// tool's own openProject (the Import JSON path):
//   water_wall        Pier 1 a wall pier in water: design and check flood, scour, flow angle, debris raft, ice (dynamic), barge collision
//                     (B_B 50 ft); Pier 2 hammerhead in water
//   pile_ham_massdot  owner MassDOT, curve R 1500 ft at 50 mph, expansion joint at Pier 1 (back / ahead reactions); Pier 1 a pile bent with
//                     vehicle collision (0 to 15° to the roadway); Pier 2 hammerhead with ship collision and vehicle collision (42 in barrier)
//   abut_coulomb      Abut. 1 Coulomb, Abut. 2 at rest; approach slab with live load, ES surcharge, water table; S_a table (site class D),
//                     seismic earth pressure location (c) at 0.45H; load-factor overrides (Strength I DC max / LL, Service I WS, Strength V WL)
//   rect_indiv        Pier 1 rectangular columns on individual footings, pinned base; expansion joint at Pier 2; sidewalks 6 and 4 ft
//   skew30            every support skewed 30°, Abut. 1 L_ab 50 ft and L_ftg 54 ft entered, Abut. 2 L_ab 48 ft
// Sections (numeric; the baseline holds these):
//   bsl.inputs           the project after open (P without ui and the date)
//   bsl.checks           the Summary checks (MODEL.C) and the input check list (SubLoadsInputCheck.collect)
//   bsl.u<k>.defs        unit k's force definitions (group, label, unit)
//   bsl.u<k>.comps       for every limit state, every load component of the combination (comboComps: permanent, fixed, live load with
//                        its full lane search result, alternative cases), i.e. every unfactored load effect at every location
//   bsl.u<k>.combine     every limit state's maximum and minimum of every force (combine), with the envelope and its governing state
//   bsl.u<k>.conc        the concurrent design sets (Combinations tab)
//   bsl.u<k>.found       the foundationLoads hand-off payload (HANDOFF.md §4.6) at every level the unit offers, every limit state
//   bsl.pay.abutmentLoads   the abutmentLoads hand-off payload (HANDOFF.md §4.5, with the definition blocks)
//   bsl.tab.<tab>        the values of the tab for every unit selected in turn: every table value cell (td.val) and fact (.fact b)
//   bsl.report.values    the Report's values: table cells and key-value rows that hold a digit, and every worked step's value and unit
// Display sections (--text only, never in the baseline): bsl.text.<tab> (the tab's whole text for every unit), bsl.text.report (the Report
//   text), bsl.storage (every localStorage key after load). A display-only PR is expected to change some of these; list them in the PR.
// Normalized: ISO dates and times, the file:// folder.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { HERE, REPO, openPage, hash, diff } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = 'Bridge Substructure Loading.html', PDIR = path.join(HERE, 'projects', 'bsl');
const BASE = args.baseline ? path.resolve(args.baseline) : null, REC = args['record-baseline'] ? path.resolve(args['record-baseline']) : null;
const TEXT = !!args.text; if (TEXT && (BASE || REC)) { console.error('--text does not apply with --baseline / --record-baseline'); process.exit(2); }
// a version of the tool: a file in the working tree, or a git ref (the tool file and shared/ at that ref, extracted once: the tool loads
// shared/*.js by relative path)
function resolveFile(spec) {
  const wt = path.resolve(REPO, spec); if (fs.existsSync(wt) && fs.statSync(wt).isFile()) return { file: wt, label: path.relative(REPO, wt) };
  const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', spec], { encoding: 'utf8' }).trim(), dir = path.join(os.tmpdir(), 'allstruct-tests', 'bsl-' + sha);
  if (!fs.existsSync(path.join(dir, '.done'))) { fs.mkdirSync(dir, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} "${FILE}" shared | tar -x -C "${dir}"`]); fs.writeFileSync(path.join(dir, '.done'), sha); }
  return { file: path.join(dir, FILE), label: `${spec} (${sha})` };
}
const A = BASE ? { label: 'baseline ' + path.relative(process.cwd(), BASE), file: null } : resolveFile(args.a || 'origin/main');
const B = REC ? null : resolveFile(args.b || FILE);
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'out'); fs.mkdirSync(OUT, { recursive: true });
const MAXD = +(args['max-diffs'] || 25), JOBS = Math.max(1, +(args.jobs || 1));
const ALL = ['default', ...fs.readdirSync(PDIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()];
const CASES = !args.project || args.project === 'all' ? ALL : String(args.project).split(',').map(s => s.trim()).filter(Boolean);
for (const c of CASES) if (!ALL.includes(c)) { console.error(`unknown case ${c} (cases: ${ALL.join(', ')})`); process.exit(2); }

const norm = s => String(s).replace(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z?/g, '(time)').replace(/\b\d{4}-\d{2}-\d{2}\b/g, '(date)')
  .replace(/\b\d{1,2}\/\d{1,2}\/\d{4},? \d{1,2}:\d{2}(:\d{2})?( [AP]M)?/g, '(time)').replace(/file:\/\/[^\s"')]*\//g, '(dir)/');
const normJ = v => JSON.parse(norm(JSON.stringify(v)));

async function run(src, name) {
  const proj = name === 'default' ? null : fs.readFileSync(path.join(PDIR, name + '.json'), 'utf8');
  const { b, p, errs, dialogs, blocked } = await openPage(src.file, { vw: 1440, vh: 1000 });
  try {
    await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && typeof slrModel === 'function', null, { timeout: 60000 });
    await p.waitForTimeout(800);
    if (proj) { await p.evaluate(([j, n]) => openProject(JSON.parse(j), n + '.json'), [proj, name]); await p.waitForTimeout(800); }
    const R = await p.evaluate(async TEXT => {
      const seen = new WeakSet(), plain = x => JSON.parse(JSON.stringify(x, function (k, v) {
        if (typeof v === 'function') return undefined; if (typeof v === 'number' && !isFinite(v)) return String(v);
        if (ArrayBuffer.isView(v)) return Array.from(v, z => isFinite(z) ? z : String(z));
        if (v && typeof v === 'object') { if (seen.has(v)) return '(ref)'; seen.add(v); } return v; }));
      const S = {}, wait = ms => new Promise(r => setTimeout(r, ms));
      const inp = JSON.parse(JSON.stringify(P)); delete inp.ui; if (inp.meta) delete inp.meta.date; S['bsl.inputs'] = inp;
      S['bsl.checks'] = { C: MODEL.C, ic: window.SubLoadsInputCheck ? SubLoadsInputCheck.collect().map(x => [x.label, x.msg]) : null, E: MODEL.G.E };
      const n = P.units.length;
      for (let k = 0; k < n; k++) {
        const r = unitRes(k); if (r.err) { S[`bsl.u${k}.defs`] = { err: r.err }; continue; }
        S[`bsl.u${k}.defs`] = r.UM.defs.map(d => [d.grp, d.label, d.u]);
        const comps = {}; COMBOS.forEach(c => { let X = null; try { X = comboComps(k, c); } catch (e) { X = { err: e.message }; } comps[c.id] = X ? plain(X) : null; });
        S[`bsl.u${k}.comps`] = comps;
        let cb = null; try { cb = plain(combine(k)); } catch (e) { cb = { err: e.message }; } S[`bsl.u${k}.combine`] = cb;
        let cs = null; try { cs = plain(concurrentSets(k).map(s => ({ grp: s.grp, loc: s.loc, q: s.q, rows: s.rows }))); } catch (e) { cs = { err: e.message }; } S[`bsl.u${k}.conc`] = cs;
        const H = window.SubLoadsFoundationHandoff, fo = {};
        if (H) H.levels(k).forEach(lev => { const ids = COMBOS.map(c => c.id).concat(['StrC']); const x = H.build(k, lev, ids); fo[lev] = x.err ? { err: x.err } : plain(x.p); });
        S[`bsl.u${k}.found`] = fo;
      }
      let ab = null; try { const x = abutHandoffPayload(); ab = x.err ? { err: x.err } : plain(x.p); } catch (e) { ab = { err: e.message }; } S['bsl.pay.abutmentLoads'] = ab;
      // tabs: every unit selected in turn
      const ids = TABS.filter(t => t !== '|').map(t => t[0]).filter(id => !['v3d', 'manual', 'report', 'drawings'].includes(id)), sel0 = P.ui.sel, tab0 = P.ui.tab;
      for (const id of ids) {
        const vals = {}, txt = {};
        for (let k = 0; k < n; k++) {
          P.ui.sel = k; showTab(id); await wait(30); const el = document.getElementById('tab-' + id); if (!el) continue;
          vals['u' + k] = [...el.querySelectorAll('td.val, .fact b')].map(e => e.textContent.replace(/\s+/g, ' ').trim());
          if (TEXT) txt['u' + k] = el.innerText;
        }
        S['bsl.tab.' + id] = vals; if (TEXT) S['bsl.text.' + id] = txt;
      }
      P.ui.sel = sel0; showTab(tab0); await wait(50);
      // Report values
      const M = slxAdd(slrModel()), out = [], dig = /\d/;
      const walk = (o, where) => { if (!o || typeof o !== 'object') return; if (Array.isArray(o)) { o.forEach((x, i) => walk(x, where)); return; }
        const w = o.title ? where + ' / ' + o.title : where;
        if (o.type === 'table') (o.rows || []).forEach(r => { const cells = Array.isArray(r) ? r : r && Array.isArray(r.cells) ? r.cells : [r]; out.push([w, 'row', cells.map(c => typeof c === 'object' && c ? JSON.stringify(c) : String(c)).filter(c => dig.test(c))]); });
        else if (o.type === 'kv') (o.rows || []).forEach(r => { if (dig.test(String(r[1]))) out.push([w, 'kv', String(r[1])]); });
        else if (o.type === 'steps') (o.steps || []).forEach(s => out.push([w, 'step', s.value, s.unit || '']));
        else if (o.type === 'note' || o.type === 'figure') return;
        else Object.keys(o).forEach(key => { if (key !== 'title' && typeof o[key] === 'object') walk(o[key], w); });
      };
      walk(M, ''); S['bsl.report.values'] = plain(out);
      if (TEXT) { showTab('report'); for (let i = 0; i < 40 && !(SLR.doc); i++) await wait(250); await wait(500); S['bsl.text.report'] = SLR.doc && window.SharedReport ? SharedReport.text(SLR.doc) : '(no report)'; showTab(tab0); await wait(50);
        const ls = {}; for (let i = 0; i < localStorage.length; i++) { const key = localStorage.key(i); ls[key] = localStorage.getItem(key); } S['bsl.storage'] = Object.fromEntries(Object.keys(ls).sort().map(key => [key, ls[key]])); }
      return S;
    }, TEXT);
    const RN = normJ(R);
    return { R: RN, H: Object.fromEntries(Object.entries(RN).map(([k, v]) => [k, hash(v)])), errs: errs.filter(e => !/Failed to load resource/.test(e)), dialogs, blocked: [...blocked] };
  } finally { await b.close(); }
}

const baseline = BASE ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
const record = REC ? (fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : { tool: 'bsl', cases: {} }) : null;
console.log(`A: ${A.label}${B ? `\nB: ${B.label}` : ''}\ncases: ${CASES.join(', ')}${TEXT ? ' (with display sections)' : ''}`);
let worst = 0; const t0 = Date.now();
async function one(c) {
  const lines = []; const log = s => lines.push(s);
  try {
    let ra, rb;
    if (REC) { ra = await run(A, c); rb = null; }
    else if (BASE) { const bc = baseline.cases[c]; if (!bc) throw new Error('case not in the baseline'); rb = await run(B, c); ra = { R: null, H: bc.sections, errs: [] }; }
    else[ra, rb] = await Promise.all([run(A, c), run(B, c)]);
    log(`\n=== ${c} ===`); let code = 0;
    if (REC) { if (ra.errs.length) { log('  console errors: ' + ra.errs.join(' | ')); code = 2; }
      log(`  recorded ${Object.keys(ra.H).length} sections`); return { code, lines, rec: { a: A.label, sections: ra.H } }; }
    const keys = [...new Set([...Object.keys(ra.H), ...Object.keys(rb.H)])];
    for (const k of keys) { const same = ra.H[k] === rb.H[k]; log(`  ${same ? 'same     ' : 'DIFFERENT'} ${k}  ${ra.H[k] || '(none)'} ${rb.H[k] || '(none)'}`); if (!same) { code = Math.max(code, 1);
      if (ra.R) { const d = diff(ra.R[k], rb.R[k]); d.slice(0, MAXD).forEach(([pp, x, y]) => log(`      ${pp}: ${JSON.stringify(x)?.slice(0, 200)} -> ${JSON.stringify(y)?.slice(0, 200)}`)); if (d.length > MAXD) log(`      … ${d.length - MAXD} more`); } } }
    for (const [lab, r] of [['A', ra], ['B', rb]]) if (r.errs.length) { log(`  ${lab} console errors: ${r.errs.join(' | ')}`); code = 2; }
    fs.writeFileSync(path.join(OUT, `bsl_${c}.json`), JSON.stringify({ A: ra.R, B: rb.R }, null, 1));
    return { code, lines };
  } catch (e) { log(`\n=== ${c} ===\n  ERROR ${e.message}`); return { code: 2, lines }; }
}
const queue = CASES.slice(), results = {};
await Promise.all([...Array(Math.min(JOBS, CASES.length))].map(async () => { while (queue.length) { const c = queue.shift(); results[c] = await one(c); } }));
for (const c of CASES) { const r = results[c]; console.log(r.lines.join('\n')); worst = Math.max(worst, r.code);
  if (record && r.rec) { record.cases[c] = r.rec; record.recorded = new Date().toISOString().slice(0, 10); } }
if (record) fs.writeFileSync(REC, JSON.stringify(record, null, 1) + '\n');
console.log(`\n${worst === 0 ? 'ALL IDENTICAL' : worst === 1 ? 'DIFFERENCES FOUND' : 'ERRORS'} (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
process.exit(worst);
