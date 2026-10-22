#!/usr/bin/env node
// Compare a tool's computed results between two versions (main vs a branch, or two files), headless, offline.
// See tests/README.md. Examples:
//   node tests/compare.mjs --tool gd                                   (origin/main vs the working tree, built-in project, AASHTO)
//   node tests/compare.mjs --tool gd --project builtin,xsA --owner AASHTO,RIDOT
//   node tests/compare.mjs --tool st --payload builtin,def15_AASHTO_G2 --a origin/main --b stgirder.html
//   node tests/compare.mjs --tool sbd --project builtin --owner AASHTO  (merged tool's ST-Girder view vs stgirder.html, every girder)
//   node tests/compare.mjs --tool page --file lldf.html
// Exit code: 0 all sections identical, 1 a difference, 2 an error.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HERE, openPage, resolveFile, hash, diff } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = args.tool || 'gd';
// sbd: B is the merged tool (Steel Bridge Design.html, from PR 1 of the merge), A is stgirder.html
const FILE = args.file || { gd: 'Steel Bridge Design.html', st: 'stgirder.html', sbd: 'Steel Bridge Design.html' }[TOOL];
if (!FILE) { console.error('--file is required for --tool ' + TOOL); process.exit(2); }
const BASE = args.baseline ? path.resolve(args.baseline) : null, REC = args['record-baseline'] ? path.resolve(args['record-baseline']) : null;
const A = BASE ? { label: 'baseline ' + path.relative(process.cwd(), BASE), file: null } : TOOL === 'sbd' ? resolveFile(args.a || 'stgirder.html', 'stgirder.html') : resolveFile(args.a || 'origin/main', FILE);
if (TOOL === 'sbd' && !args.b && !fs.existsSync(path.join(HERE, '..', FILE))) { console.error(`--tool sbd: ${FILE} is not in the working tree (the merged tool comes with PR 1 of the merge); pass --b <file>`); process.exit(2); }
const B = resolveFile(args.b || FILE, FILE);
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'out'); fs.mkdirSync(OUT, { recursive: true });
const MAXD = +(args['max-diffs'] || 25), QUIET = +(args.quiet || 8000);
const list = (v, d) => String(v || d).split(',').map(s => s.trim()).filter(Boolean);
const STDIR = path.join(HERE, 'projects', 'st');

/* ---------------- GirderDetail ---------------- */
// wait until GirderDetail is idle: window.gdIdle() when the page has it (2026-10-15 on), else the same logic from here (older copies)
async function gdIdle(p, quiet = QUIET) {
  const r = await p.evaluate(o => typeof window.gdIdle === 'function' ? window.gdIdle(o).then(ms => ({ ms, via: 'gdIdle' })) : null, { quiet });
  if (r) return r;
  const t0 = Date.now(); let last = null, since = Date.now();
  while (Date.now() - t0 < 150000) {
    const s = await p.evaluate(() => { const q = JSON.parse(JSON.stringify(P)); delete q.ui; const busy = !!(GD_XF_REQ || GD_XF_T) || (typeof GD_RQ !== 'undefined' && GD_RQ.size > 0) || (typeof GD_PLQ !== 'undefined' && GD_PLQ.length > 0) || typeof PL_FRAME === 'undefined' || !PL_FRAME || !PL_FRAME.dataset.ready;
      return (busy ? 'busy:' : '') + JSON.stringify(q).replace(/"ts":\d+/g, '"ts":0'); });
    if (s !== last || s.startsWith('busy:')) { last = s; since = Date.now(); } else if (Date.now() - since >= quiet) return { ms: Date.now() - t0, via: 'settle (page has no gdIdle)' };
    await p.waitForTimeout(500);
  }
  throw new Error('GirderDetail not idle after 150 s');
}
const GD_MODULES = ['df', 'sa', 'gs', 'cf', 'oh', 'fa', 'ts', 'sc', 'wt', 'bstf', 'splice'];
// the Preliminary sizing frame (GirderDetail has one srcdoc frame; the merged tool may have more, so the one that has the sizing app's globals)
const plFrame = async p => { for (const fr of p.frames()) { if (fr === p.mainFrame()) continue; try { if (await fr.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return fr; } catch (e) { } } return null; };
// open GirderDetail with the case's project, wait until idle, set the mode, owner and skew as asked (shared by gd and sbd)
async function gdOpen(file, c) {
  const ls = c.project === 'builtin' ? undefined : JSON.parse(fs.readFileSync(fs.existsSync(c.project) ? c.project : path.join(HERE, 'projects', 'gd', c.project + '.json'), 'utf8'));
  const o = await openPage(file, { ls }), p = o.p;
  try {
    await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
    await p.evaluate(() => plEnsure()); const idle = [await gdIdle(p)];
    if (c.mode) { await p.click(`.gd-mode-b[data-gdmode="${c.mode}"]`); await p.waitForTimeout(800); idle.push(await gdIdle(p)); }
    if (c.owner || c.skew != null) {
      await (await plFrame(p)).evaluate(([o, sk]) => { if (o) P.limits.dot = o; if (sk != null) P.bridge.skews = P.bridge.skews.map(() => sk); try { fillInputs(); } catch (e) {} recompute(); autosave(); postBridge(true); }, [c.owner || null, c.skew != null ? +c.skew : null]);
      await p.waitForTimeout(1500); idle.push(await gdIdle(p));
    }
    return { ...o, idle };
  } catch (e) { await o.b.close(); throw e; }
}
// every girder's "Send to ST-Girder" payload (gdStPayload, pedestrian load added to LL+IM as the checkbox default), keyed G1..Gn
const gdStPayloads = p => p.evaluate(() => { const b = P.df && P.df.bridge, nb = b && b.ok ? b.nb : 0, o = {};
  for (let g = 1; g <= nb; g++) { const r = gdStPayload(g, true); o['G' + g] = r.error ? { error: r.error } : r.payload; } return o; });
// a calculation report as text lines (block ends become line breaks; MathJax source stays as TeX)
const htmlLines = html => `(() => { const d = document.createElement('div'); d.innerHTML = String(${html}).replace(/<(\\/p|\\/div|\\/tr|br|\\/h\\d|\\/li|\\/section|\\/table|\\/caption|\\/th|\\/td)\\b[^>]*>/gi, m => m + '\\n');
  return d.textContent.split('\\n').map(s => s.replace(/\\s+/g, ' ').trim()).filter(Boolean); })()`;
async function gdRun(src, c) {
  const { b, p, errs, dialogs, blocked, idle } = await gdOpen(src.file, c);
  try {
    const plf = await plFrame(p);
    const R = {};
    R['gd.project'] = await p.evaluate(() => { const q = JSON.parse(JSON.stringify(P)); delete q.ui; return JSON.parse(JSON.stringify(q).replace(/"ts":\d+/g, '"ts":0')); });
    R['pl.project'] = await plf.evaluate(() => { const q = JSON.parse(JSON.stringify(P)); delete q.ui; return JSON.parse(JSON.stringify(q).replace(/"ts":\d+/g, '"ts":0')); });
    R['pl.checks'] = await plf.evaluate(() => C ? Object.fromEntries(C.map(c => [c.id, { st: c.status, items: c.items.map(i => [i.loc, i.st, i.r != null && isFinite(i.r) ? +i.r : null, (i.cells || []).join(' | ')]) }])) : null);
    R['pl.analysis'] = await plf.evaluate(() => { const o = {}; for (const gt of Object.keys(AN.types)) { const T = AN.R.types[gt]; o[gt] = { Mup: Array.from(T.Mup), Mun: Array.from(T.Mun), Msp: Array.from(T.Msp), Msn: Array.from(T.Msn), dl: AN.types[gt].dl.map(d => d.d), reac: AN.types[gt].reac.map(r => [r.strMax, r.strMin]) }; } return o; });
    // every girder's ST-Girder hand-off (girderDemands), before the modules below change the selected module's inputs
    R['gd.stPayloads'] = await gdStPayloads(p);
    for (const m of GD_MODULES) {
      await p.evaluate(m => setMod(m), m); await p.waitForTimeout(400);
      if (m !== 'df' && m !== 'sa') { await p.evaluate(() => { try { getDemands('pl'); } catch (e) { console.error('getDemands: ' + e.message); } }); await p.waitForTimeout(800); }
      idle.push(await gdIdle(p, 4000));
      R['mod.' + m] = await p.evaluate(() => CK ? Object.fromEntries(CK.map(c => [c.id, { st: c.status, items: c.items.map(i => [i.loc, i.st, i.r != null && isFinite(i.r) ? +i.r : null, (i.cells || []).join(' | ')]) }])) : (RS && RS.errors ? { errors: RS.errors } : null));
      // the module's calculation report, every section, every item worked (the options of the Girder report)
      R['rpt.' + m] = await p.evaluate(htmlLines(`buildCalcReport({ ...crOpts(), inputs: true, combos: true, cap: true, stress: true, checks: true, summary: true, drawings: true, manual: false, detail: 'full' })`));
    }
    R['sa.girder1'] = await p.evaluate(() => { const R = GM.sa.compute({ ...P.sa, girder: 1 }); if (R.errors.length) return { errors: R.errors }; const A = a => Array.from(a); return { StrMp: A(R.StrMp), StrMn: A(R.StrMn), SvcP: A(R.SvcP), StrV: A(R.StrV), MDC1: A(R.MDC1), LLp: A(R.LLp), reac: R.reac.map(q => [q.str, q.strMin]), lld: R.lld.map(q => q.d), dTot: A(R.dTot) }; });
    // DXF export: the drawing list and geometry as built in the browser, before Pyodide/ezdxf runs (layouts) and the R12 writer
    R['gd.dxf'] = await p.evaluate(() => { const o = {};
      try { const r = dxfBuild(true); o.layouts = { parts: r.parts, n: r.n, over: r.over, miss: r.miss, sheets: r.spec.sheets.map(s => ({ title: s.title, k: s.k, W: s.W, H: s.H, cells: s.cells, m0: s.m0 })), layers: r.spec.layers, entities: JSON.stringify(r.spec.entities) }; } catch (e) { o.layouts = { error: e.message }; }
      try { const r = dxfBuild(false); o.r12 = { parts: r.parts, n: r.n, layers: r.layers }; } catch (e) { o.r12 = { error: e.message }; }
      return o; });
    if (R['gd.dxf'].layouts && R['gd.dxf'].layouts.entities) R['gd.dxf'].layouts.entities = 'sha256 ' + hash(R['gd.dxf'].layouts.entities);
    if (args['save-st'] && src === B) saveSt(c, R['gd.stPayloads']);
    return { R, errs, dialogs, blocked: [...blocked], idle: idle.map(x => x.via + ' ' + x.ms + ' ms') };
  } finally { await b.close(); }
}
// --save-st: write B's payloads to projects/st/gd_<project>_<owner>_G<n>.json ({ payload }, as the existing files)
function saveSt(c, pays) {
  const dir = typeof args['save-st'] === 'string' ? path.resolve(args['save-st']) : STDIR; fs.mkdirSync(dir, { recursive: true });
  for (const [g, pay] of Object.entries(pays)) { if (pay.error) continue; fs.writeFileSync(path.join(dir, `gd_${c.label}_${c.owner || 'AASHTO'}_${g}.json`), JSON.stringify({ payload: pay })); }
}

/* ---------------- ST-Girder ---------------- */
// text of the app sheet once it has stopped changing (charts and KaTeX render after React), as trimmed lines
async function stSettled(f, max = 10000) {
  const t0 = Date.now(); let last = null, n = 0;
  for (;;) {
    const s = await f.evaluate(() => { const el = document.querySelector('.sheet') || document.body; return el.innerText; });
    if (s === last) { if (++n >= 2) break; } else { last = s; n = 0; }
    if (Date.now() - t0 > max) break;
    await f.waitForTimeout(250);
  }
  return last.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
// the visible text of every tab, then the report with every section and every station (Report tab: all chips on, detail "all")
async function stTexts(f) {
  const out = {}, tabs = await f.$$eval('.tabs .tab', els => els.map(e => e.textContent.trim()));
  for (let i = 0; i < tabs.length; i++) {
    await f.evaluate(i => document.querySelectorAll('.tabs .tab')[i].click(), i); await f.waitForTimeout(150);
    out['st.tab.' + tabs[i]] = await stSettled(f);
  }
  if (tabs.includes('Report')) {
    await f.evaluate(() => [...document.querySelectorAll('.tabs .tab')].find(e => e.textContent.trim() === 'Report').click()); await f.waitForTimeout(150);
    for (let k = 0; k < 40; k++) { const i = await f.evaluate(() => [...document.querySelectorAll('.crv-tog input[type=checkbox]')].findIndex(cb => !cb.checked)); if (i < 0) break; await f.evaluate(i => document.querySelectorAll('.crv-tog input[type=checkbox]')[i].click(), i); await f.waitForTimeout(100); }
    if (await f.$('.crv-det select')) await f.selectOption('.crv-det select', 'all');
    await f.waitForTimeout(150); out['st.report.all'] = await stSettled(f, 20000);
  } else out['st.report.all'] = null;
  return out;
}
// everything computed for the saved session (computeAll of stgirder.session, the inputs the app shows), plus the visible text
async function stReadout(f) {
  await f.waitForFunction(() => !!localStorage.getItem('stgirder.session'), null, { timeout: 20000 });
  const R = await f.evaluate(() => { const inp = JSON.parse(localStorage.getItem('stgirder.session')); const R = computeAll(inp);
    const strip = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? undefined : v));
    const o = { 'st.session': inp, 'st.status': { ok: R.ok, err: R.error || null, lf: R.lf || null } };
    if (R.ok) Object.assign(o, { 'st.checks': Object.fromEntries(R.checks.map((c, i) => [i + ' ' + c.n, { value: c.v, limit: c.lim, ratio: c.r }])), 'st.rating': strip(R.rating),
      'st.governing': { MuPeak: R.flex.MuPeak, VuPeak: R.shearR.VuPeak, s2: R.stress.s2Gov && R.stress.s2Gov.r }, 'st.sections': R.segP.map(g => [g.cN.I, g.c3N.I, g.cr.I, g.pl.Mp]),
      'st.stations': R.stations.map(s => ({ x: s.x, M1: s.M1, M2: s.M2, Mw: s.Mw, Ml: s.Ml, MlD: s.MlD, qM: s.qM, Mu: s.Mu, Mun: s.Mun, Vl: s.Vl, VlD: s.VlD, qV: s.qV, Vu: s.Vu })) });
    o['st.R'] = strip(R);   // the full computed state, functions stripped
    return o; });
  Object.assign(R, await stTexts(f));
  return R;
}
const readPayload = name => JSON.parse(fs.readFileSync(fs.existsSync(name) ? name : path.join(STDIR, name + '.json'), 'utf8')).payload;
// stgirder.html: apply a hand-off the way GirderDetail's "Send to ST-Girder" + "Open ST-Girder now" does (publish, then open with #gdpull=<producedAt>)
async function stApply(p, file, pay) {
  const pa = await p.evaluate(q => { BridgeXfer.publish('girderDemands', q, 'GirderDetail', 'Steel Bridge Design.html'); return JSON.parse(localStorage.getItem('bridgeSuite.v1.girderDemands')).producedAt; }, pay);
  await p.goto('file://' + file + '#gdpull=' + encodeURIComponent(pa)); await p.reload(); await p.waitForSelector('.tabs .tab, .callout.warn', { timeout: 60000 });
  await p.waitForFunction(pa => { try { const s = JSON.parse(localStorage.getItem('stgirder.session')); return s && s.external && s.external.producedAt === pa; } catch (e) { return false; } }, pa, { timeout: 20000 });
  await p.waitForTimeout(800);
}
async function stRun(src, c) {
  const { b, p, errs, dialogs, blocked } = await openPage(src.file);
  try {
    await p.waitForSelector('.tabs .tab', { timeout: 60000 }); await p.waitForTimeout(1000);
    if (c.payload !== 'builtin') await stApply(p, src.file, readPayload(c.payload));
    const R = await stReadout(p.mainFrame());
    return { R, errs: errs.filter(e => !/^Failed to load resource/.test(e)), dialogs, blocked: [...blocked], idle: [] };
  } finally { await b.close(); }
}

/* ---------------- Steel Bridge Design: the ST-Girder view (frame) vs stgirder.html ----------------
   B: the merged tool opens the case's project (as --tool gd), then for each girder G1..Gn opens its "Design & Rating (ST-Girder)" view,
   which sends gdStPayload(G) to the ST-Girder frame by message. Contract (wired in PR 1): window.gdStOpen(g) returns a Promise that resolves
   with the payload sent, once the frame has applied it; the frame is the iframe named "gd-st". A: stgirder.html in one tab, the same payloads
   applied one after the other with #gdpull (as "Send to ST-Girder" + "Open ST-Girder now" for G1, then G2, ...). Each girder's readout is --tool st's. */
async function sbdRunB(src, c) {
  const { b, p, errs, dialogs, blocked, idle } = await gdOpen(src.file, c);
  try {
    if (!(await p.evaluate(() => typeof window.gdStOpen === 'function'))) throw new Error(`${src.label} has no ST-Girder view (window.gdStOpen): --tool sbd needs the merged tool (PR 1)`);
    const nb = await p.evaluate(() => { const b = P.df && P.df.bridge; return b && b.ok ? b.nb : 0; }), R = {}, pays = {}, ms = [];
    for (let g = 1; g <= nb; g++) {
      const t0 = Date.now(), pay = await p.evaluate(g => window.gdStOpen(g), g); ms.push(Date.now() - t0); pays['G' + g] = pay;
      const f = p.frames().find(fr => fr.name() === 'gd-st'); if (!f) throw new Error('no frame named gd-st');
      await f.waitForFunction(pa => { try { const s = JSON.parse(localStorage.getItem('stgirder.session')); return s && s.external && s.external.producedAt === pa; } catch (e) { return false; } }, pay.producedAt, { timeout: 20000 });
      await f.waitForTimeout(800);
      for (const [k, v] of Object.entries(await stReadout(f))) R[`G${g} ${k}`] = v;
    }
    return { R, pays, errs: errs.filter(e => !/^Failed to load resource/.test(e)), dialogs, blocked: [...blocked], idle: [...idle.map(x => x.via + ' ' + x.ms + ' ms'), 'ST view open ' + ms.join(', ') + ' ms'] };
  } finally { await b.close(); }
}
async function sbdRunA(src, pays) {
  const { b, p, errs, dialogs, blocked } = await openPage(src.file);
  try {
    await p.waitForSelector('.tabs .tab', { timeout: 60000 }); await p.waitForTimeout(1000);
    const R = {};
    for (const [g, pay] of Object.entries(pays)) { await stApply(p, src.file, pay); for (const [k, v] of Object.entries(await stReadout(p.mainFrame()))) R[`${g} ${k}`] = v; }
    return { R, errs: errs.filter(e => !/^Failed to load resource/.test(e)), dialogs, blocked: [...blocked], idle: [] };
  } finally { await b.close(); }
}

/* ---------------- any tool: smoke + page text and storage ---------------- */
async function pageRun(src, c) {
  const { b, p, errs, dialogs, blocked } = await openPage(src.file);
  try {
    await p.waitForTimeout(+(args.wait || 5000));
    const R = await p.evaluate(() => ({ 'page.text': document.body.innerText.replace(/\d{1,2}\/\d{1,2}\/\d{4}(,? \d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?)?/g, '(date)'),
      'page.storage': Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k).replace(/"(ts|savedAt|producedAt|updatedAt)":("[^"]*"|\d+)/g, '"$1":0')])) }));
    return { R, errs, dialogs, blocked: [...blocked], idle: [] };
  } finally { await b.close(); }
}

/* ---------------- cases, run, report ---------------- */
// volatile values that differ between any two runs: ISO time stamps and dates, local date/time text, millisecond time stamps under time-like keys,
// the file:// folder a page was opened from, and GirderDetail's file name (renamed to "Steel Bridge Design.html" by the merge, PR 1)
const normalize = R => JSON.parse(JSON.stringify(R)
  .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '(time)')
  .replace(/\b\d{4}-\d\d-\d\d\b/g, '(date)')
  .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}(,? \d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?)?/g, '(date)')
  .replace(/(\\*"(?:ts|seenAt|savedAt|producedAt|updatedAt|at|time)\\*":)\d{12,}/g, '$10')
  .replace(/file:\/\/\/[^"\\]*\//g, 'file:///(dir)/')
  .replace(/Steel Bridge Beam Modules\.html|Steel Bridge Design\.html/g, '(GirderDetail file)'));

const cases = [];
if (TOOL === 'gd' || TOOL === 'sbd') {
  for (const pr of list(args.project, 'builtin')) for (const o of list(args.owner, 'AASHTO'))
    cases.push({ name: `${pr} / ${o}${args.skew != null ? ' / skew ' + args.skew : ''}${args.mode ? ' / mode ' + args.mode : ''}`, label: pr, project: pr === 'builtin28' ? 'builtin' : pr, owner: o, skew: pr === 'builtin28' ? 28 : args.skew, mode: args.mode });
} else if (TOOL === 'st') {
  // builtin = no hand-off (the app's own example); all = every payload in projects/st
  const pl = String(args.payload || 'builtin,def15_AASHTO_G2') === 'all' ? ['builtin', ...fs.readdirSync(STDIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()] : list(args.payload, 'builtin,def15_AASHTO_G2');
  for (const py of pl) cases.push({ name: py === 'builtin' ? 'built-in (no hand-off)' : 'payload ' + py, payload: py });
} else cases.push({ name: FILE });
const RUN = { gd: gdRun, st: stRun, page: pageRun }[TOOL];
if (!RUN && TOOL !== 'sbd') { console.error('unknown --tool ' + TOOL + ' (gd, st, sbd, page)'); process.exit(2); }
if (BASE && TOOL === 'sbd') { console.error('--baseline does not apply to --tool sbd (A is stgirder.html)'); process.exit(2); }
const baseline = BASE ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
const record = REC ? (fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : { tool: TOOL, cases: {} }) : null;
// --jobs N (default: the number of CPUs): cases run N at a time, each in its own browsers; each case's report is printed whole, in case order
const JOBS = Math.max(1, Math.round(+(args.jobs || os.cpus().length)) || 1);
console.log(`A: ${A.label}\nB: ${B.label}\ntool: ${TOOL}   readouts saved in ${OUT}   jobs: ${Math.min(JOBS, cases.length)}\n`);
let differ = false, failed = false;
async function runCase(c) {
  const out = [], log = t => out.push(t), t0 = Date.now(); let cd = false, cf = false, rec = null;
  let ra, rb;
  try {
    if (TOOL === 'sbd') { rb = await sbdRunB(B, c); ra = await sbdRunA(A, rb.pays); delete rb.pays; }
    else if (BASE) { rb = await RUN(B, c); const bc = baseline.cases[c.name]; if (!bc) throw new Error('case not in the baseline'); ra = { R: null, H: bc.sections, errs: [], dialogs: [], blocked: [], idle: [] }; }
    else [ra, rb] = await Promise.all([RUN(A, c), RUN(B, c)]);
  } catch (e) { log(`== ${c.name}: ERROR ${e.message}`); return { out, differ: false, failed: true, rec }; }
  if (ra.R) ra.R = normalize(ra.R); rb.R = normalize(rb.R);
  const tag = c.name.replace(/[^A-Za-z0-9_.-]+/g, '_');
  if (ra.R) fs.writeFileSync(path.join(OUT, tag + '.A.json'), JSON.stringify(ra)); fs.writeFileSync(path.join(OUT, tag + '.B.json'), JSON.stringify(rb));
  log(`== ${c.name}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const HA = ra.H || Object.fromEntries(Object.keys(ra.R).map(s => [s, hash(ra.R[s] ?? null)]));
  const secs = [...new Set([...Object.keys(HA), ...Object.keys(rb.R)])], dl = [];
  for (const s of secs) {
    const ha = HA[s] || hash(null), hb = hash(rb.R[s] ?? null), same = ha === hb;
    log(`  ${s.padEnd(14)} ${ha}  ${hb}  ${same ? 'same' : 'DIFFERENT'}`);
    if (!same) { cd = true; if (ra.R) dl.push([s, diff(ra.R[s] ?? null, rb.R[s] ?? null)]); }
  }
  if (!ra.R && cd) log('  (the baseline stores hashes only: run with --a <git ref> to list the values that differ)');
  for (const [s, d] of dl) {
    log(`  -- ${s}: ${d.length} value${d.length === 1 ? '' : 's'} differ${d.length > MAXD ? ` (first ${MAXD})` : ''}`);
    for (const [k, a, b2] of d.slice(0, MAXD)) log(`     ${k}:  A ${JSON.stringify(a)?.slice(0, 140)}  |  B ${JSON.stringify(b2)?.slice(0, 140)}`);
  }
  for (const [lab, r] of [['A', ra], ['B', rb]]) {
    log(`  ${lab}: console errors ${r.errs.length}${r.errs.length ? ' ' + JSON.stringify(r.errs.slice(0, 3)) : ''}, dialogs ${r.dialogs.length}${r.dialogs.length ? ' ' + JSON.stringify(r.dialogs.slice(0, 2)) : ''}${r.blocked.length ? `, blocked ${r.blocked.length} (${r.blocked.slice(0, 2).join(', ')})` : ''}${r.idle.length ? ', idle: ' + r.idle[0] + (r.idle.length > 1 ? ` (+${r.idle.length - 1} waits)` : '') : ''}`);
    if (r.errs.length) cf = true;
  }
  if (TOOL === 'sbd' && rb.idle.length) log('  B: ' + rb.idle[rb.idle.length - 1]);
  if (record && ra.R) rec = { a: A.label, sections: HA };
  return { out, differ: cd, failed: cf, rec };
}
// a pool of JOBS workers over the cases; each result is printed (and recorded) in case order as soon as the cases before it are done
const res = new Array(cases.length); let next = 0, shown = 0;
function flush() {
  while (shown < cases.length && res[shown]) { const r = res[shown], c = cases[shown++];
    console.log(r.out.join('\n')); if (r.differ) differ = true; if (r.failed) failed = true;
    // --record-baseline FILE: keep A's section hashes (A = origin/main by default) for later runs with --baseline FILE
    if (record && r.rec) { record.cases[c.name] = r.rec; record.recorded = new Date().toISOString().slice(0, 10); fs.writeFileSync(REC, JSON.stringify(record, null, 1) + '\n'); } } }
await Promise.all([...Array(Math.min(JOBS, cases.length))].map(async () => { while (next < cases.length) { const i = next++; res[i] = await runCase(cases[i]); flush(); } }));
console.log(differ ? '\nRESULT: differences found' : failed ? '\nRESULT: identical results, but errors (see above)' : '\nRESULT: all sections identical');
process.exit(differ ? 1 : failed ? 2 : 0);
