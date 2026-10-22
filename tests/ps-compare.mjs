#!/usr/bin/env node
// PS-Beam / Prestressed Bridge Design: compare every computed result between two versions (main vs a branch, or two files), headless, offline.
// Separate from compare.mjs on purpose (another harness, other owners). The helpers it needs from tests/lib.mjs and tests/compare.mjs
// (loadPlaywright, chromiumPath, libFor, openPage, resolveFile, hash, diff, normalize, the settle loop, the case pool and the report)
// are DUPLICATED here, not imported, so that a change to those files cannot change this harness. Keep the copies in step by hand if needed.
//
// Usage (from the repository root):
//   node tests/ps-compare.mjs                                    origin/main vs the working tree, every case
//   node tests/ps-compare.mjs --project defaults,next_skew       some cases (names: see CASES below / tests/projects/ps/*.json)
//   node tests/ps-compare.mjs --record-baseline tests/baselines/ps.json            record A's section hashes (A = origin/main)
//   node tests/ps-compare.mjs --baseline tests/baselines/ps.json --b "Prestressed Bridge Design.html"   B against the baseline (A not run)
//   node tests/ps-compare.mjs --a 3ef3506 --b my-branch          git refs (a ref older than the rename is read as psbeam.html)
// Options: --a (default origin/main), --b (default the working-tree file), --file (default "Prestressed Bridge Design.html" when it is
//   in the working tree, else psbeam.html), --project (comma list or "all"; default all), --jobs N (cases at a time; default 1 when A and B
//   both run (two browsers), 2 with --baseline; at most 2 browsers on a shared machine), --max-diffs (default 25), --out (raw readouts),
//   --settle ms (how long the inputs must stay unchanged after load; default 1500), --retries N (a run that fails to load is
//   started again up to N times; default 2).
// Exit code: 0 all sections identical, 1 a difference, 2 an error (including console errors; "Failed to load resource" and Babel's
// "code generator has deoptimised the styling" size note are not counted).
//
// Cases: "defaults" opens the tool with empty storage (the built-in example, first-open path). Every other case seeds localStorage
// key psbeam.inputs.v1 with tests/projects/ps/<case>.json (the full inputs object, as the tool saves it), then opens the tool.
//   shape_<name>  every girder library shape (strands, span and spacing fitted to the shape so every check computes)
//   approx_losses  approximate long-term losses (5.9.3.3)   cont_restraint  continuity on, restraint moments on
//   deck_handling  deck design and handling checks on       exterior        exterior girder (position fixed, overhang 3 ft)
//   debond_harp    debonded rows + harped strands           next_skew       NEXT 36F, 30 deg skew
//   midas_3span    3-span MIDAS demands payload, span 2      midas_df0       the same with the imported shear DF = 0
// Sections read per case (after the tool has loaded and its autosave has settled):
//   ps.inputs      the inputs the tool saved (psbeam.inputs.v1) after load (merge onto defaults, design-beam follow)
//   ps.checks      every check of computeAll(inputs): name, value, limit, ratio, pass, location, units
//   ps.R           the full computeAll(inputs) result, functions stripped
//   ps.warnings    R.error and R.warns
//   ps.tab.<tab>   the visible text of every tab's content (title block and footer excluded), once it stops changing;
//                  the Inputs tab once per input group (ps.tab.Inputs.<group>)
//   ps.report      the Report tab text (the whole calculation report)
//   ps.pay.superRx bxSuperRxPayload(inputs, R) (superReactions hand-off, HANDOFF.md 4.4)
//   ps.pay.psSection   bridgeSuite.v1.psSection as published on load
//   ps.pay.capacity    bridgeSuite.v1.capacity after "Send capacity to MCT Rating" (Rating tab) is clicked
//   ps.storage     every localStorage key after load (before any tab is opened), values normalized
// Normalized before comparing (volatile, or renamed by the Prestressed Bridge Design rename): ISO time stamps and dates, local date/time
// text, millisecond time stamps under time-like keys, the file:// folder, the tool's own file name ("psbeam.html" and
// "Prestressed Bridge Design.html" both read "(PS file)") and its display name ("PS-Girder" and "Prestressed Bridge Design", in any letter case:
// CSS upper-cases some headings) all read "(PS tool)"), so the rename compares equal.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

/* ---------------- duplicated from tests/lib.mjs (see header) ---------------- */
const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'libs', 'MANIFEST.json'), 'utf8'));
async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) { /* not installed locally */ }
  try { const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(); return createRequire(path.join(root, 'noop.js'))('playwright'); }
  catch (e) { throw new Error('playwright package not found: install it with "npm i -g playwright" (no browser download needed when /opt/pw-browsers/chromium exists)'); }
}
function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  return fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;
}
function libFor(url) {
  const k = url.replace(/^https?:\/\//, '').split('?')[0];
  const exact = MANIFEST.routes[k];
  if (exact) return path.join(HERE, 'libs', exact);
  for (const [pre, dir] of Object.entries(MANIFEST.prefixes || {})) if (k.startsWith(pre)) return path.join(HERE, 'libs', dir, k.slice(pre.length));
  return null;
}
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
async function openPage(file, { ls, vw = 1400, vh = 1000, hash = '' } = {}) {
  const { chromium } = await loadPlaywright();
  const b = await chromium.launch({ executablePath: chromiumPath(), timeout: 600000 });
  const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
  const blocked = new Set();
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/^(file|data|about|blob):/.test(u)) return r.continue();
    const f = libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: '', contentType: 'text/css' });
    blocked.add(u.slice(0, 160)); return r.abort();
  });
  const errs = [], dialogs = [];
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 400)));
  p.on('dialog', async d => { dialogs.push(d.message().slice(0, 400)); await d.accept(); });
  if (ls) await p.addInitScript(o => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } }, ls);
  await p.goto('file://' + file + hash, { waitUntil: 'domcontentloaded', timeout: 300000 });   // patient: the machine may be shared
  return { b, ctx, p, errs, dialogs, blocked };
}
// "Prestressed Bridge Design.html" (working tree), "origin/main" (bare ref: the tool's file name), or "abc123:psbeam.html".
// A git ref older than the rename is read under the previous name (psbeam.html).
const RENAMED = { 'Prestressed Bridge Design.html': ['psbeam.html'] };
function resolveFile(spec, tool) {
  const wt = path.resolve(REPO, spec);
  if (fs.existsSync(wt) && fs.statSync(wt).isFile()) { const rel = path.relative(REPO, wt); return { file: wt, label: rel.startsWith('..') ? wt : rel }; }
  const [ref, f] = spec.includes(':') ? [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)] : [spec, tool];
  const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', ref], { encoding: 'utf8' }).trim();
  let buf = null, err = null, got = f;
  for (const name of [f, ...(RENAMED[f] || [])]) { try { buf = execFileSync('git', ['-C', REPO, 'show', `${sha}:${name}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }); got = name; break; } catch (e) { err = err || e; } }
  if (!buf) throw err;
  const dir = path.join(os.tmpdir(), 'allstruct-tests', 'ps-' + sha); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, got); fs.writeFileSync(out, buf);   // keep the file's own name at that ref (the page reads its own name)
  return { file: out, label: `${ref} (${sha}):${got}` };
}
const hash = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 12);
function diff(a, b, p = '', out = []) {
  if (a === b) return out;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a, tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) { out.push([p || '(root)', a, b]); return out; }
  if (ta === 'array') { if (a.length !== b.length) out.push([p + '.length', a.length, b.length]); for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${p}[${i}]`, out); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p + '.' + k, out);
  return out;
}

/* ---------------- arguments ---------------- */
const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const FILE = args.file || (fs.existsSync(path.join(REPO, 'Prestressed Bridge Design.html')) ? 'Prestressed Bridge Design.html' : 'psbeam.html');
const BASE = args.baseline ? path.resolve(args.baseline) : null, REC = args['record-baseline'] ? path.resolve(args['record-baseline']) : null;
const A = BASE ? { label: 'baseline ' + path.relative(process.cwd(), BASE), file: null } : resolveFile(args.a || 'origin/main', FILE);
const B = resolveFile(args.b || FILE, FILE);
const OUT = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'ps-out'); fs.mkdirSync(OUT, { recursive: true });
const MAXD = +(args['max-diffs'] || 25), SETTLE = +(args.settle || 1500);
const PSDIR = path.join(HERE, 'projects', 'ps');
const LS_KEY = 'psbeam.inputs.v1';

/* ---------------- readout ---------------- */
// text of an element once it has stopped changing (Plotly and KaTeX render after React), as trimmed lines
async function settledText(p, sel, max = 10000) {
  const t0 = Date.now(); let last = null, n = 0;
  for (;;) {
    const s = await p.evaluate(sel => [...document.querySelectorAll(sel)].map(el => el.innerText).join('\n'), sel);
    if (s === last) { if (++n >= 2) break; } else { last = s; n = 0; }
    if (Date.now() - t0 > max) break;
    await p.waitForTimeout(250);
  }
  return last.split('\n').map(s => s.replace(/\s+/g, ' ').trim()).filter(Boolean);
}
// the saved inputs, once the autosave has written them and they have stayed unchanged for SETTLE ms
async function settledInputs(p) {
  const t0 = Date.now(); let last = null, since = Date.now();
  while (Date.now() - t0 < 180000) {
    const s = await p.evaluate(k => localStorage.getItem(k), LS_KEY);
    if (s !== last) { last = s; since = Date.now(); } else if (s && Date.now() - since >= SETTLE) return JSON.parse(s);
    await p.waitForTimeout(200);
  }
  throw new Error('the inputs were not saved within 180 s');
}
const CONTENT = '.sheet-inner > .cols, .sheet-inner > .cols-full';
async function clickTab(p, label) {
  await p.evaluate(l => [...document.querySelectorAll('.tabs .tab')].find(e => e.textContent.trim() === l).click(), label);
  await p.waitForTimeout(150);
}
async function psRun(src, c) {
  const ls = c.seed ? { [LS_KEY]: fs.readFileSync(c.seed, 'utf8') } : undefined;
  const { b, p, errs, dialogs, blocked } = await openPage(src.file, { ls });
  try {
    await p.waitForSelector('.tabs .tab, .callout.warn', { timeout: 300000 });
    const inp = await settledInputs(p);
    const R = {};
    R['ps.inputs'] = inp;
    Object.assign(R, await p.evaluate(inp => {
      const strip = o => JSON.parse(JSON.stringify(o, (k, v) => typeof v === 'function' ? undefined : v));
      const r = computeAll(inp), o = {};
      o['ps.checks'] = r.error ? { error: r.error } : r.checks.map(c => ({ n: c.n, v: c.v, lim: c.lim, r: c.r, pass: c.pass, loc: c.loc, u: c.u }));
      o['ps.R'] = strip(r);
      o['ps.warnings'] = { error: r.error || null, warns: r.warns || [] };
      let sr; try { sr = bxSuperRxPayload(inp, r); } catch (e) { sr = { threw: e.message }; }
      o['ps.pay.superRx'] = strip(sr);
      let ps = null; try { ps = JSON.parse(localStorage.getItem('bridgeSuite.v1.psSection')); } catch (e) { ps = { unreadable: true }; }
      o['ps.pay.psSection'] = ps;
      o['ps.storage'] = Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]));
      return o;
    }, inp));
    // every tab's content; the Inputs tab once per input group
    const tabs = await p.$$eval('.tabs .tab', els => els.map(e => e.textContent.trim()));
    for (const t of tabs) {
      await clickTab(p, t);
      const groups = t === 'Inputs' ? await p.$$eval('.psbInTabs .psbInTab', els => els.map(e => e.textContent.trim())) : [];
      if (groups.length) {
        for (let i = 0; i < groups.length; i++) {
          await p.evaluate(i => document.querySelectorAll('.psbInTabs .psbInTab')[i].click(), i); await p.waitForTimeout(150);
          R['ps.tab.Inputs.' + groups[i]] = await settledText(p, CONTENT);
        }
      } else if (t === 'Report') R['ps.report'] = await settledText(p, CONTENT, 30000);
      else R['ps.tab.' + t] = await settledText(p, CONTENT);
    }
    // capacity hand-off: the Rating tab's send button (one-shot publish; its alert is accepted and listed under dialogs)
    if (tabs.includes('Rating')) {
      await clickTab(p, 'Rating');
      const before = await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.capacity'));
      const clicked = await p.evaluate(() => { const bt = [...document.querySelectorAll('button')].find(e => /Send capacity to MCT Rating/.test(e.textContent)); if (bt) bt.click(); return !!bt; });
      if (clicked) await p.waitForFunction(b => localStorage.getItem('bridgeSuite.v1.capacity') !== b, before, { timeout: 20000 }).catch(() => {});
      R['ps.pay.capacity'] = await p.evaluate(() => { try { return JSON.parse(localStorage.getItem('bridgeSuite.v1.capacity')); } catch (e) { return { unreadable: true }; } });
    } else R['ps.pay.capacity'] = null;
    return { R, errs: errs.filter(e => !/^Failed to load resource|^\[BABEL\] Note: The code generator has deoptimised/.test(e)), dialogs, blocked: [...blocked] };
  } finally { await b.close(); }
}

/* ---------------- cases, run, report ---------------- */
const normalize = R => JSON.parse(JSON.stringify(R)
  .replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '(time)')
  .replace(/\b\d{4}-\d\d-\d\d\b/g, '(date)')
  .replace(/\b\d{1,2}\/\d{1,2}\/\d{4}(,? \d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?)?/g, '(date)')
  .replace(/(\\*"(?:ts|t|seenAt|savedAt|producedAt|updatedAt|at|time)\\*":)\d{12,}/g, '$10')
  .replace(/file:\/\/\/[^"\\]*\//g, 'file:///(dir)/')
  .replace(/Prestressed Bridge Design\.html|psbeam\.html/g, '(PS file)')
  .replace(/Prestressed Bridge Design|PS-Girder/gi, '(PS tool)'));   // any case: CSS text-transform upper-cases some headings in innerText

const ALL = ['defaults', ...fs.readdirSync(PSDIR).filter(f => f.endsWith('.json')).map(f => f.slice(0, -5)).sort()];
const names = !args.project || args.project === 'all' ? ALL : String(args.project).split(',').map(s => s.trim()).filter(Boolean);
const cases = names.map(n => {
  if (n === 'defaults') return { name: 'defaults', seed: null };
  const f = fs.existsSync(n) ? path.resolve(n) : path.join(PSDIR, n + '.json');
  if (!fs.existsSync(f)) { console.error('unknown case ' + n + ' (tests/projects/ps/<case>.json or a path)'); process.exit(2); }
  return { name: fs.existsSync(n) ? path.basename(n, '.json') : n, seed: f };
});
const baseline = BASE ? JSON.parse(fs.readFileSync(BASE, 'utf8')) : null;
const record = REC ? (fs.existsSync(REC) ? JSON.parse(fs.readFileSync(REC, 'utf8')) : { tool: 'ps', cases: {} }) : null;
const JOBS = Math.max(1, Math.round(+(args.jobs || (BASE ? 2 : 1))) || 1);
console.log(`A: ${A.label}\nB: ${B.label}\ntool: ps   readouts saved in ${OUT}   jobs: ${Math.min(JOBS, cases.length)}\n`);
let differ = false, failed = false;
// --retries N (default 2): a run that fails to load (page crash, time-out on a busy machine) is started again, up to N more times
const RETRIES = Math.max(0, Math.round(+(args.retries ?? 2)) || 0);
async function retry(f) { for (let i = 0; ; i++) { try { return await f(); } catch (e) { if (i >= RETRIES) throw e; console.error(`(retry ${i + 1}: ${String(e.message).split('\n')[0]})`); } } }
async function runCase(c) {
  const out = [], log = t => out.push(t), t0 = Date.now(); let cd = false, cf = false, rec = null;
  let ra, rb;
  try {
    if (BASE) { const bc = baseline.cases[c.name]; if (!bc) throw new Error('case not in the baseline'); rb = await retry(() => psRun(B, c)); ra = { R: null, H: bc.sections, errs: [], dialogs: [], blocked: [] }; }
    else [ra, rb] = await Promise.all([retry(() => psRun(A, c)), retry(() => psRun(B, c))]);
  } catch (e) { log(`== ${c.name}: ERROR ${e.message}`); return { out, differ: false, failed: true, rec }; }
  if (ra.R) ra.R = normalize(ra.R); rb.R = normalize(rb.R);
  const tag = c.name.replace(/[^A-Za-z0-9_.-]+/g, '_');
  if (ra.R) fs.writeFileSync(path.join(OUT, tag + '.A.json'), JSON.stringify(ra)); fs.writeFileSync(path.join(OUT, tag + '.B.json'), JSON.stringify(rb));
  log(`== ${c.name}   (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
  const HA = ra.H || Object.fromEntries(Object.keys(ra.R).map(s => [s, hash(ra.R[s] ?? null)]));
  const secs = [...new Set([...Object.keys(HA), ...Object.keys(rb.R)])], dl = [];
  for (const s of secs) {
    const ha = HA[s] || hash(null), hb = hash(rb.R[s] ?? null), same = ha === hb;
    log(`  ${s.padEnd(28)} ${ha}  ${hb}  ${same ? 'same' : 'DIFFERENT'}`);
    if (!same) { cd = true; if (ra.R) dl.push([s, diff(ra.R[s] ?? null, rb.R[s] ?? null)]); }
  }
  if (!ra.R && cd) log('  (the baseline stores hashes only: run with --a <git ref> to list the values that differ)');
  for (const [s, d] of dl) {
    log(`  -- ${s}: ${d.length} value${d.length === 1 ? '' : 's'} differ${d.length > MAXD ? ` (first ${MAXD})` : ''}`);
    for (const [k, a, b2] of d.slice(0, MAXD)) log(`     ${k}:  A ${JSON.stringify(a)?.slice(0, 140)}  |  B ${JSON.stringify(b2)?.slice(0, 140)}`);
  }
  for (const [lab, r] of [['A', ra], ['B', rb]]) {
    log(`  ${lab}: console errors ${r.errs.length}${r.errs.length ? ' ' + JSON.stringify(r.errs.slice(0, 3)) : ''}, dialogs ${r.dialogs.length}${r.dialogs.length ? ' ' + JSON.stringify(r.dialogs.map(d => d.slice(0, 60)).slice(0, 2)) : ''}${r.blocked.length ? `, blocked ${r.blocked.length} (${r.blocked.slice(0, 2).join(', ')})` : ''}`);
    if (r.errs.length) cf = true;
  }
  if (record && ra.R) rec = { a: A.label, sections: HA };
  return { out, differ: cd, failed: cf, rec };
}
const res = new Array(cases.length); let next = 0, shown = 0;
function flush() {
  while (shown < cases.length && res[shown]) { const r = res[shown], c = cases[shown++];
    console.log(r.out.join('\n')); if (r.differ) differ = true; if (r.failed) failed = true;
    if (record && r.rec) { record.cases[c.name] = r.rec; record.recorded = new Date().toISOString().slice(0, 10); fs.writeFileSync(REC, JSON.stringify(record, null, 1) + '\n'); } } }
await Promise.all([...Array(Math.min(JOBS, cases.length))].map(async () => { while (next < cases.length) { const i = next++; res[i] = await runCase(cases[i]); flush(); } }));
console.log(differ ? '\nRESULT: differences found' : failed ? '\nRESULT: identical results, but errors (see above)' : '\nRESULT: all sections identical');
process.exit(differ ? 1 : failed ? 2 : 0);
