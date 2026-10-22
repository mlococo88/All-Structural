#!/usr/bin/env node
// ST-Girder on an interior span of a GirderDetail hand-off, headless, offline (developer tooling only; see tests/README.md).
//
// Why a separate script: a "Send to ST-Girder" payload (gdStPayload) always describes the whole continuous girder, and ST-Girder applies
// every hand-off on span 1 (gdAdopt: sel = externalSpans(p)[0], which overwrites any _selSpan in the payload). Another span is chosen only
// in the UI, with the "Span n" buttons on the Inputs tab (pickSpan: external._selSpan, geom.L = span length, plates from section.zones).
// So this script applies an existing payload of tests/projects/st exactly as compare.mjs --tool st does (publish, then #gdpull), then
// CLICKS the "Span n" button and reads everything once the session holds that span. No tool is changed.
//
// DUPLICATED CODE (kept duplicated on purpose; compare.mjs is not touched): stSettled, stTexts, stReadout, stApply, normalize, the
// GirderDetail open/idle helpers (plFrame, gdOpen; gdIdle without the fallback for pages older than 2026-10-15, and gdOpen without --mode)
// and the report/baseline loop are copies of tests/compare.mjs (2026-10-22, at
// cb584ac). The sections and their names are the same as --tool st (st.session, st.status, st.checks, st.rating, st.governing,
// st.sections, st.stations, st.R, st.tab.<tab>, st.report.all). When compare.mjs's readout changes, copy the change here.
//
// Targets:
//   --target st  (default): stgirder.html. Each span of each payload in a fresh browser: apply the payload, click "Span n", read.
//   --target sbd: the ST-Girder frame of "Steel Bridge Design.html" (iframe named gd-st). The payload name gd_<project>_<owner>_G<n> gives
//                 the project, owner and girder: the merged tool opens the project (as compare.mjs --tool gd), window.gdStOpen(n) sends
//                 gdStPayload(n) to the frame, then the "Span n" button is clicked inside the frame. Only gd_* payloads.
//
// Examples (from the repository root):
//   node tests/st-span.mjs                                                  (every gd_* payload, spans 2 and 3, origin/main vs working tree)
//   node tests/st-span.mjs --payload gd_xsA_RIDOT_G2 --span 2
//   node tests/st-span.mjs --a origin/main --record-baseline tests/baselines/st_interior.json   (runs A only)
//   node tests/st-span.mjs --baseline tests/baselines/st_interior.json --b stgirder.html         (runs B only)
//   node tests/st-span.mjs --target sbd --baseline tests/baselines/st_interior.json             (the merged tool's frame vs the stgirder.html baseline)
// Options: --target st|sbd, --a (default origin/main), --b (default the working-tree file), --file (default stgirder.html, or
//   "Steel Bridge Design.html" for sbd), --payload (names in projects/st, comma list, or "all" = every gd_* payload; default all),
//   --span (comma list; default 2,3), --jobs N (payloads run N at a time, one browser each per side; default 2; --record-baseline and --baseline run one side only),
//   --timeout ms (page default timeouts; default 120000), --tries N (attempts per span; default 3), --resume (with --record-baseline: skip
//   the spans the file already holds), --max-diffs, --out, --quiet.
// Exit code: 0 all sections identical, 1 a difference, 2 an error (including console errors).
import fs from 'fs';
import os from 'os';
import path from 'path';
import { HERE, openPage, resolveFile, hash, diff } from './lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TARGET = args.target || 'st';
if (!['st', 'sbd'].includes(TARGET)) { console.error('--target must be st or sbd'); process.exit(2); }
const FILE = args.file || (TARGET === 'sbd' ? 'Steel Bridge Design.html' : 'stgirder.html');
const BASE = args.baseline ? path.resolve(args.baseline) : null, REC = args['record-baseline'] ? path.resolve(args['record-baseline']) : null;
const A = BASE ? { label: 'baseline ' + path.relative(process.cwd(), BASE), file: null } : resolveFile(args.a || 'origin/main', FILE);
const B = REC ? null : resolveFile(args.b || FILE, FILE);   // --record-baseline runs A only
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'out-span'); fs.mkdirSync(OUT, { recursive: true });
const MAXD = +(args['max-diffs'] || 25), QUIET = +(args.quiet || 8000);
const list = (v, d) => String(v || d).split(',').map(s => s.trim()).filter(Boolean);
const STDIR = path.join(HERE, 'projects', 'st');
const SPANS = list(args.span, '2,3').map(Number);
// a loaded machine can make a page load or wait take longer than Playwright's 30 s: the page's default timeouts are --timeout ms
// (default 120000), and a span that fails (timeout, closed browser) is run again from scratch, up to --tries times (default 3)
const TMO = +(args.timeout || 120000), TRIES = Math.max(1, +(args.tries || 3)), SKIP = !!args.resume;
if (SPANS.some(n => !(n >= 1 && Number.isInteger(n)))) { console.error('--span: positive integers'); process.exit(2); }

/* ---------------- ST-Girder readout (copied from compare.mjs) ---------------- */
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
async function stReadout(f) {
  await f.waitForFunction(() => !!localStorage.getItem('stgirder.session'), null, { timeout: 20000 });
  const R = await f.evaluate(() => { const inp = JSON.parse(localStorage.getItem('stgirder.session')); const R = computeAll(inp);
    const strip = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? undefined : v));
    const o = { 'st.session': inp, 'st.status': { ok: R.ok, err: R.error || null, lf: R.lf || null } };
    if (R.ok) Object.assign(o, { 'st.checks': Object.fromEntries(R.checks.map((c, i) => [i + ' ' + c.n, { value: c.v, limit: c.lim, ratio: c.r }])), 'st.rating': strip(R.rating),
      'st.governing': { MuPeak: R.flex.MuPeak, VuPeak: R.shearR.VuPeak, s2: R.stress.s2Gov && R.stress.s2Gov.r }, 'st.sections': R.segP.map(g => [g.cN.I, g.c3N.I, g.cr.I, g.pl.Mp]),
      'st.stations': R.stations.map(s => ({ x: s.x, M1: s.M1, M2: s.M2, Mw: s.Mw, Ml: s.Ml, MlD: s.MlD, qM: s.qM, Mu: s.Mu, Mun: s.Mun, Vl: s.Vl, VlD: s.VlD, qV: s.qV, Vu: s.Vu })) });
    o['st.R'] = strip(R);
    return o; });
  Object.assign(R, await stTexts(f));
  return R;
}
const readPayload = name => JSON.parse(fs.readFileSync(fs.existsSync(name) ? name : path.join(STDIR, name + '.json'), 'utf8')).payload;
async function stApply(p, file, pay) {
  const pa = await p.evaluate(q => { BridgeXfer.publish('girderDemands', q, 'GirderDetail', 'Steel Bridge Design.html'); return JSON.parse(localStorage.getItem('bridgeSuite.v1.girderDemands')).producedAt; }, pay);
  await p.goto('file://' + file + '#gdpull=' + encodeURIComponent(pa)); await p.reload(); await p.waitForSelector('.tabs .tab, .callout.warn', { timeout: 60000 });
  await p.waitForFunction(pa => { try { const s = JSON.parse(localStorage.getItem('stgirder.session')); return s && s.external && s.external.producedAt === pa; } catch (e) { return false; } }, pa, { timeout: 20000 });
  await p.waitForTimeout(800);
}

/* ---------------- span selection (new) ---------------- */
// Inputs tab, then the banner's "Span n: x0–x1 ft (L′)" button (pickSpan), then wait until the saved session holds that span
async function pickSpan(f, n) {
  await f.evaluate(() => { const t = [...document.querySelectorAll('.tabs .tab')].find(e => e.textContent.trim() === 'Inputs'); if (t) t.click(); });
  await f.waitForTimeout(300);
  const ok = await f.evaluate(n => { const b = [...document.querySelectorAll('button')].find(e => e.textContent.trim().startsWith('Span ' + n + ':')); if (!b) return false; b.click(); return true; }, n);
  if (!ok) throw new Error(`no "Span ${n}" button (the hand-off has fewer spans?)`);
  await f.waitForFunction(n => { try { const s = JSON.parse(localStorage.getItem('stgirder.session')); return s && s.external && s.external._selSpan && +s.external._selSpan.idx === n; } catch (e) { return false; } }, n, { timeout: 20000 });
  await f.waitForTimeout(800);
}

/* ---------------- GirderDetail open/idle (copied from compare.mjs; --target sbd only) ---------------- */
async function gdIdle(p, quiet = QUIET) {
  const r = await p.evaluate(o => typeof window.gdIdle === 'function' ? window.gdIdle(o).then(ms => ({ ms, via: 'gdIdle' })) : null, { quiet });
  if (r) return r;
  throw new Error('the page has no window.gdIdle');
}
const plFrame = async p => { for (const fr of p.frames()) { if (fr === p.mainFrame()) continue; try { if (await fr.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return fr; } catch (e) { } } return null; };
async function gdOpen(file, c) {
  const ls = c.project === 'builtin' ? undefined : JSON.parse(fs.readFileSync(path.join(HERE, 'projects', 'gd', c.project + '.json'), 'utf8'));
  const o = await openPage(file, { ls }), p = o.p;
  try {
    await p.waitForFunction(() => typeof P !== 'undefined' && P && typeof plEnsure === 'function', null, { timeout: 60000 });
    await p.evaluate(() => plEnsure()); const idle = [await gdIdle(p)];
    if (c.owner || c.skew != null) {
      await (await plFrame(p)).evaluate(([o, sk]) => { if (o) P.limits.dot = o; if (sk != null) P.bridge.skews = P.bridge.skews.map(() => sk); try { fillInputs(); } catch (e) {} recompute(); autosave(); postBridge(true); }, [c.owner || null, c.skew != null ? +c.skew : null]);
      await p.waitForTimeout(1500); idle.push(await gdIdle(p));
    }
    return { ...o, idle };
  } catch (e) { await o.b.close(); throw e; }
}

/* ---------------- one payload, every asked span ---------------- */
// one span in a fresh browser (empty storage, as each compare.mjs --tool st case), so no UI state of another span carries over
async function stSpan(src, c, n) {
  const { b, p, errs, dialogs, blocked } = await openPage(src.file);
  try {
    p.setDefaultTimeout(TMO); p.setDefaultNavigationTimeout(TMO);
    await p.waitForSelector('.tabs .tab', { timeout: 60000 }); await p.waitForTimeout(1000);
    await stApply(p, src.file, readPayload(c.payload));
    await pickSpan(p.mainFrame(), n);
    return { R: await stReadout(p.mainFrame()), errs: errs.filter(e => !/^Failed to load resource/.test(e)), dialogs, blocked: [...blocked], idle: [] };
  } finally { await b.close(); }
}
async function sbdSpan(src, c, n) {
  const m = /^gd_(builtin28|builtin|xsA|curb|util)_([A-Za-z]+)_G(\d+)$/.exec(c.payload);
  if (!m) throw new Error('--target sbd takes gd_<project>_<owner>_G<n> payloads only');
  const { b, p, errs, dialogs, blocked, idle } = await gdOpen(src.file, { project: m[1] === 'builtin28' ? 'builtin' : m[1], owner: m[2], skew: m[1] === 'builtin28' ? 28 : null });
  try {
    p.setDefaultTimeout(TMO); p.setDefaultNavigationTimeout(TMO);
    if (!(await p.evaluate(() => typeof window.gdStOpen === 'function'))) throw new Error(`${src.label} has no ST-Girder view (window.gdStOpen)`);
    const pay = await p.evaluate(g => window.gdStOpen(g), +m[3]);
    const f = p.frames().find(fr => fr.name() === 'gd-st'); if (!f) throw new Error('no frame named gd-st');
    await f.waitForFunction(pa => { try { const s = JSON.parse(localStorage.getItem('stgirder.session')); return s && s.external && s.external.producedAt === pa; } catch (e) { return false; } }, pay.producedAt, { timeout: 20000 });
    await f.waitForTimeout(800);
    await pickSpan(f, n);
    return { R: await stReadout(f), errs: errs.filter(e => !/^Failed to load resource/.test(e)), dialogs, blocked: [...blocked], idle: idle.map(x => x.via + ' ' + x.ms + ' ms') };
  } finally { await b.close(); }
}
// every asked span of one payload, one after the other: { R: { span: readout }, errs, dialogs, blocked, idle } (messages of all spans together)
async function RUN(src, c) {
  const o = { R: {}, errs: [], dialogs: [], blocked: [], idle: [] };
  for (const n of SPANS) {
    if (src === A && record && SKIP && record.cases[caseName(c.payload, n)]) continue;   // --resume: already recorded
    let r = null;
    for (let k = 1; ; k++) { try { r = await (TARGET === 'sbd' ? sbdSpan : stSpan)(src, c, n); break; }
      catch (e) { if (k >= TRIES) throw e; o.idle.push(`span ${n}: attempt ${k} failed (${e.message.split('\n')[0].slice(0, 120)}), retried`); } }
    o.R[n] = r.R;
    for (const k of ['errs', 'dialogs', 'blocked', 'idle']) o[k].push(...r[k].map(x => `span ${n}: ${x}`)); }
  return o;
}

/* ---------------- cases, run, report (as compare.mjs) ---------------- */
const normalize = R => JSON.parse(JSON.stringify(R)
  .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '(time)')
  .replace(/\b\d{4}-\d\d-\d\d\b/g, '(date)')
  .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}(,? \d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?)?/g, '(date)')
  .replace(/(\\*"(?:ts|seenAt|savedAt|producedAt|updatedAt|at|time)\\*":)\d{12,}/g, '$10')
  .replace(/file:\/\/\/[^"\\]*\//g, 'file:///(dir)/')
  .replace(/Steel Bridge Beam Modules\.html|Steel Bridge Design\.html/g, '(GirderDetail file)'));

const payloads = String(args.payload || 'all') === 'all' ? fs.readdirSync(STDIR).filter(f => /^gd_.*\.json$/.test(f)).map(f => f.slice(0, -5)).sort() : list(args.payload);
const cases = payloads.map(py => ({ payload: py }));
const caseName = (py, n) => `payload ${py} / span ${n}`;
const baseline = BASE ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
const record = REC ? (fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : { tool: 'st-span', cases: {} }) : null;
const JOBS = Math.max(1, Math.round(+(args.jobs || 2)) || 1);
console.log(`target: ${TARGET}\nA: ${A.label}\nB: ${B ? B.label : '(not run: --record-baseline records A)'}\nspans: ${SPANS.join(', ')}   payloads: ${cases.length}   readouts saved in ${OUT}   jobs: ${Math.min(JOBS, cases.length)}\n`);
let differ = false, failed = false, nSame = 0, nDiff = 0;
async function runCase(c) {
  const out = [], log = t => out.push(t), t0 = Date.now(); let cd = false, cf = false; const rec = {};
  let ra = null, rb = null;
  try {
    if (REC) ra = await RUN(A, c);
    else if (BASE) rb = await RUN(B, c);
    else [ra, rb] = await Promise.all([RUN(A, c), RUN(B, c)]);
  } catch (e) { log(`== payload ${c.payload}: ERROR ${e.message}`); return { out, differ: false, failed: true, rec, nd: 0, ns: 0 }; }
  let nd = 0, ns = 0;
  for (const n of SPANS) {
    const name = caseName(c.payload, n), tag = name.replace(/[^A-Za-z0-9_.-]+/g, '_');
    if (ra && !ra.R[n]) { log(`== ${name}: already in the baseline (--resume), not run`); continue; }
    const RA = ra ? normalize(ra.R[n]) : null, RB = rb ? normalize(rb.R[n]) : null;
    if (RA) fs.writeFileSync(path.join(OUT, tag + '.A.json'), JSON.stringify(RA)); if (RB) fs.writeFileSync(path.join(OUT, tag + '.B.json'), JSON.stringify(RB));
    log(`== ${name}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
    let HA = RA ? Object.fromEntries(Object.keys(RA).map(s => [s, hash(RA[s] ?? null)])) : null;
    if (BASE) { const bc = baseline.cases[name]; if (!bc) { log('  ERROR case not in the baseline'); cf = true; continue; } HA = bc.sections; }
    if (REC) { rec[name] = { a: A.label, sections: HA }; log(`  recorded ${Object.keys(HA).length} sections; span ${RA['st.session'].external._selSpan.idx}, L = ${RA['st.session'].geom.L} ft, status ok ${RA['st.status'].ok}`); continue; }
    const secs = [...new Set([...Object.keys(HA), ...Object.keys(RB)])], dl = []; let sd = false;
    for (const s of secs) {
      const ha = HA[s] || hash(null), hb = hash(RB[s] ?? null), same = ha === hb;
      log(`  ${s.padEnd(14)} ${ha}  ${hb}  ${same ? 'same' : 'DIFFERENT'}`);
      if (!same) { sd = true; if (RA) dl.push([s, diff(RA[s] ?? null, RB[s] ?? null)]); }
    }
    if (sd) { cd = true; nd++; } else ns++;
    if (!RA && sd) log('  (the baseline stores hashes only: run with --a <git ref> to list the values that differ)');
    for (const [s, d] of dl) {
      log(`  -- ${s}: ${d.length} value${d.length === 1 ? '' : 's'} differ${d.length > MAXD ? ` (first ${MAXD})` : ''}`);
      for (const [k, a, b2] of d.slice(0, MAXD)) log(`     ${k}:  A ${JSON.stringify(a)?.slice(0, 140)}  |  B ${JSON.stringify(b2)?.slice(0, 140)}`);
    }
  }
  for (const [lab, r] of [['A', ra], ['B', rb]]) {
    if (!r) continue;
    for (const t of r.idle.filter(t => /retried$/.test(t))) log(`  ${lab}: ${t}`);
    log(`  ${lab}: console errors ${r.errs.length}${r.errs.length ? ' ' + JSON.stringify(r.errs.slice(0, 3)) : ''}, dialogs ${r.dialogs.length}${r.dialogs.length ? ' ' + JSON.stringify(r.dialogs.slice(0, 2)) : ''}${r.blocked.length ? `, blocked ${r.blocked.length} (${r.blocked.slice(0, 2).join(', ')})` : ''}${r.idle.length ? ', idle: ' + r.idle[0] + (r.idle.length > 1 ? ` (+${r.idle.length - 1} waits)` : '') : ''}`);
    if (r.errs.length) cf = true;
  }
  return { out, differ: cd, failed: cf, rec: cf ? {} : rec, nd, ns };   // a case with console errors is not recorded
}
const res = new Array(cases.length); let next = 0, shown = 0, nRec = 0;
function flush() {
  while (shown < cases.length && res[shown]) { const r = res[shown++];
    console.log(r.out.join('\n')); if (r.differ) differ = true; if (r.failed) failed = true; nDiff += r.nd; nSame += r.ns;
    if (record && Object.keys(r.rec).length) { Object.assign(record.cases, r.rec); nRec += Object.keys(r.rec).length; record.recorded = new Date().toISOString().slice(0, 10);
      record.cases = Object.fromEntries(Object.entries(record.cases).sort(([a], [b]) => a.localeCompare(b))); fs.writeFileSync(REC, JSON.stringify(record, null, 1) + '\n'); } } }
await Promise.all([...Array(Math.min(JOBS, cases.length))].map(async () => { while (next < cases.length) { const i = next++; res[i] = await runCase(cases[i]); flush(); } }));
if (REC) console.log(`\nrecorded ${nRec} span cases in ${path.relative(process.cwd(), REC)}`);
else console.log(`\nspan cases: ${nSame} identical, ${nDiff} different`);
console.log(differ ? 'RESULT: differences found' : failed ? 'RESULT: errors (see above)' : 'RESULT: ' + (REC ? 'recorded cleanly' : 'all sections identical'));
process.exit(differ ? 1 : failed ? 2 : 0);
