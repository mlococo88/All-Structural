#!/usr/bin/env node
// Compare a tool's computed results between two versions (main vs a branch, or two files), headless, offline.
// See tests/README.md. Examples:
//   node tests/compare.mjs --tool gd                                   (origin/main vs the working tree, built-in project, AASHTO)
//   node tests/compare.mjs --tool gd --project builtin,xsA --owner AASHTO,RIDOT
//   node tests/compare.mjs --tool st --payload def15_AASHTO_G2 --a origin/main --b stgirder.html
//   node tests/compare.mjs --tool page --file lldf.html
// Exit code: 0 all sections identical, 1 a difference, 2 an error.
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HERE, openPage, resolveFile, hash, diff } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = args.tool || 'gd';
const FILE = args.file || { gd: 'Steel Bridge Beam Modules.html', st: 'stgirder.html' }[TOOL];
if (!FILE) { console.error('--file is required for --tool ' + TOOL); process.exit(2); }
const A = resolveFile(args.a || 'origin/main', FILE), B = resolveFile(args.b || FILE, FILE);
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'out'); fs.mkdirSync(OUT, { recursive: true });
const MAXD = +(args['max-diffs'] || 25), QUIET = +(args.quiet || 8000);
const list = (v, d) => String(v || d).split(',').map(s => s.trim()).filter(Boolean);

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
async function gdRun(src, c) {
  const ls = c.project === 'builtin' ? undefined : JSON.parse(fs.readFileSync(fs.existsSync(c.project) ? c.project : path.join(HERE, 'projects', 'gd', c.project + '.json'), 'utf8'));
  const { b, p, errs, dialogs, blocked } = await openPage(src.file, { ls });
  try {
    await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
    await p.evaluate(() => plEnsure()); const idle = [await gdIdle(p)];
    const plf = () => p.frames().find(fr => fr !== p.mainFrame());
    if (c.mode) { await p.click(`.gd-mode-b[data-gdmode="${c.mode}"]`); await p.waitForTimeout(800); idle.push(await gdIdle(p)); }
    if (c.owner || c.skew != null) {
      await plf().evaluate(([o, sk]) => { if (o) P.limits.dot = o; if (sk != null) P.bridge.skews = P.bridge.skews.map(() => sk); try { fillInputs(); } catch (e) {} recompute(); autosave(); postBridge(true); }, [c.owner || null, c.skew != null ? +c.skew : null]);
      await p.waitForTimeout(1500); idle.push(await gdIdle(p));
    }
    const R = {};
    R['gd.project'] = await p.evaluate(() => { const q = JSON.parse(JSON.stringify(P)); delete q.ui; return JSON.parse(JSON.stringify(q).replace(/"ts":\d+/g, '"ts":0')); });
    R['pl.project'] = await plf().evaluate(() => { const q = JSON.parse(JSON.stringify(P)); delete q.ui; return JSON.parse(JSON.stringify(q).replace(/"ts":\d+/g, '"ts":0')); });
    R['pl.checks'] = await plf().evaluate(() => C ? Object.fromEntries(C.map(c => [c.id, { st: c.status, items: c.items.map(i => [i.loc, i.st, i.r != null && isFinite(i.r) ? +i.r : null, (i.cells || []).join(' | ')]) }])) : null);
    R['pl.analysis'] = await plf().evaluate(() => { const o = {}; for (const gt of Object.keys(AN.types)) { const T = AN.R.types[gt]; o[gt] = { Mup: Array.from(T.Mup), Mun: Array.from(T.Mun), Msp: Array.from(T.Msp), Msn: Array.from(T.Msn), dl: AN.types[gt].dl.map(d => d.d), reac: AN.types[gt].reac.map(r => [r.strMax, r.strMin]) }; } return o; });
    for (const m of GD_MODULES) {
      await p.evaluate(m => setMod(m), m); await p.waitForTimeout(400);
      if (m !== 'df' && m !== 'sa') { await p.evaluate(() => { try { getDemands('pl'); } catch (e) { console.error('getDemands: ' + e.message); } }); await p.waitForTimeout(800); }
      idle.push(await gdIdle(p, 4000));
      R['mod.' + m] = await p.evaluate(() => CK ? Object.fromEntries(CK.map(c => [c.id, { st: c.status, items: c.items.map(i => [i.loc, i.st, i.r != null && isFinite(i.r) ? +i.r : null, (i.cells || []).join(' | ')]) }])) : (RS && RS.errors ? { errors: RS.errors } : null));
    }
    R['sa.girder1'] = await p.evaluate(() => { const R = GM.sa.compute({ ...P.sa, girder: 1 }); if (R.errors.length) return { errors: R.errors }; const A = a => Array.from(a); return { StrMp: A(R.StrMp), StrMn: A(R.StrMn), SvcP: A(R.SvcP), StrV: A(R.StrV), MDC1: A(R.MDC1), LLp: A(R.LLp), reac: R.reac.map(q => [q.str, q.strMin]), lld: R.lld.map(q => q.d), dTot: A(R.dTot) }; });
    return { R, errs, dialogs, blocked: [...blocked], idle: idle.map(x => x.via + ' ' + x.ms + ' ms') };
  } finally { await b.close(); }
}

/* ---------------- ST-Girder (GirderDetail hand-off payload) ---------------- */
async function stRun(src, c) {
  const pay = JSON.parse(fs.readFileSync(fs.existsSync(c.payload) ? c.payload : path.join(HERE, 'projects', 'st', c.payload + '.json'), 'utf8')).payload;
  const { b, p, errs, dialogs, blocked } = await openPage(src.file);
  try {
    await p.waitForSelector('.tabs .tab', { timeout: 60000 }); await p.waitForTimeout(1000);
    const pa = await p.evaluate(q => { BridgeXfer.publish('girderDemands', q, 'GirderDetail', 'Steel Bridge Beam Modules.html'); return JSON.parse(localStorage.getItem('bridgeSuite.v1.girderDemands')).producedAt; }, pay);
    await p.goto('file://' + src.file + '#gdpull=' + encodeURIComponent(pa)); await p.reload(); await p.waitForSelector('.tabs .tab', { timeout: 60000 }); await p.waitForTimeout(2500);
    const R = await p.evaluate(() => { const inp = JSON.parse(localStorage.getItem('stgirder.session')); const R = computeAll(inp);
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? undefined : v));
      return { 'st.session': inp, 'st.status': { ok: R.ok, err: R.error || null, lf: R.lf || null }, 'st.checks': Object.fromEntries(R.checks.map((c, i) => [i + ' ' + c.n, { value: c.v, limit: c.lim, ratio: c.r }])), 'st.rating': strip(R.rating),
        'st.governing': { MuPeak: R.flex.MuPeak, VuPeak: R.shearR.VuPeak, s2: R.stress.s2Gov && R.stress.s2Gov.r }, 'st.sections': R.segP.map(g => [g.cN.I, g.c3N.I, g.cr.I, g.pl.Mp]),
        'st.stations': R.stations.map(s => ({ x: s.x, M1: s.M1, M2: s.M2, Mw: s.Mw, Ml: s.Ml, MlD: s.MlD, qM: s.qM, Mu: s.Mu, Mun: s.Mun, Vl: s.Vl, VlD: s.VlD, qV: s.qV, Vu: s.Vu })) }; });
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
// volatile values that differ between any two runs: ISO time stamps, millisecond time stamps under time-like keys, the folder a file was opened from
const normalize = R => JSON.parse(JSON.stringify(R)
  .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '(time)')
  .replace(/(\\*"(?:ts|seenAt|savedAt|producedAt|updatedAt|at|time)\\*":)\d{12,}/g, '$10')
  .replace(/file:\/\/\/[^"\\]*\//g, 'file:///(dir)/'));

const cases = [];
if (TOOL === 'gd') {
  for (const pr of list(args.project, 'builtin')) for (const o of list(args.owner, 'AASHTO'))
    cases.push({ name: `${pr} / ${o}${args.skew != null ? ' / skew ' + args.skew : ''}${args.mode ? ' / mode ' + args.mode : ''}`, project: pr === 'builtin28' ? 'builtin' : pr, owner: o, skew: pr === 'builtin28' ? 28 : args.skew, mode: args.mode });
} else if (TOOL === 'st') {
  for (const py of list(args.payload, 'def15_AASHTO_G2')) cases.push({ name: 'payload ' + py, payload: py });
} else cases.push({ name: FILE });
const RUN = { gd: gdRun, st: stRun, page: pageRun }[TOOL];
if (!RUN) { console.error('unknown --tool ' + TOOL + ' (gd, st, page)'); process.exit(2); }

console.log(`A: ${A.label}\nB: ${B.label}\ntool: ${TOOL}   readouts saved in ${OUT}\n`);
let differ = false, failed = false;
for (const c of cases) {
  const t0 = Date.now();
  let ra, rb;
  try { [ra, rb] = await Promise.all([RUN(A, c), RUN(B, c)]); } catch (e) { console.log(`== ${c.name}: ERROR ${e.message}`); failed = true; continue; }
  ra.R = normalize(ra.R); rb.R = normalize(rb.R);
  const tag = c.name.replace(/[^A-Za-z0-9_.-]+/g, '_');
  fs.writeFileSync(path.join(OUT, tag + '.A.json'), JSON.stringify(ra)); fs.writeFileSync(path.join(OUT, tag + '.B.json'), JSON.stringify(rb));
  console.log(`== ${c.name}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const secs = [...new Set([...Object.keys(ra.R), ...Object.keys(rb.R)])], dl = [];
  for (const s of secs) {
    const ha = hash(ra.R[s] ?? null), hb = hash(rb.R[s] ?? null), same = ha === hb;
    console.log(`  ${s.padEnd(14)} ${ha}  ${hb}  ${same ? 'same' : 'DIFFERENT'}`);
    if (!same) { differ = true; dl.push([s, diff(ra.R[s] ?? null, rb.R[s] ?? null)]); }
  }
  for (const [s, d] of dl) {
    console.log(`  -- ${s}: ${d.length} value${d.length === 1 ? '' : 's'} differ${d.length > MAXD ? ` (first ${MAXD})` : ''}`);
    for (const [k, a, b2] of d.slice(0, MAXD)) console.log(`     ${k}:  A ${JSON.stringify(a)?.slice(0, 140)}  |  B ${JSON.stringify(b2)?.slice(0, 140)}`);
  }
  for (const [lab, r] of [['A', ra], ['B', rb]]) {
    console.log(`  ${lab}: console errors ${r.errs.length}${r.errs.length ? ' ' + JSON.stringify(r.errs.slice(0, 3)) : ''}, dialogs ${r.dialogs.length}${r.dialogs.length ? ' ' + JSON.stringify(r.dialogs.slice(0, 2)) : ''}${r.blocked.length ? `, blocked ${r.blocked.length} (${r.blocked.slice(0, 2).join(', ')})` : ''}${r.idle.length ? ', idle: ' + r.idle[0] + (r.idle.length > 1 ? ` (+${r.idle.length - 1} waits)` : '') : ''}`);
    if (r.errs.length) failed = true;
  }
}
console.log(differ ? '\nRESULT: differences found' : failed ? '\nRESULT: identical results, but errors (see above)' : '\nRESULT: all sections identical');
process.exit(differ ? 1 : failed ? 2 : 0);
