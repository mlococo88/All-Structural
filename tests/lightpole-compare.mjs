#!/usr/bin/env node
// Light Pole and Sign Post: every computed result of two versions of the tool, compared case by case (headless Chromium,
// file://, offline; KaTeX 0.16.9 served from tests/libs). Added 2026-11-01 (PR LP-0) so that each later PR can show that
// nothing changes except what it states.
//
// For each case the page starts with empty storage, the case's project state is applied with the page's own applyState()
// (which runs calc()), and the harness reads:
//   1. results: the argument objects of the page's renderSummary(ctx) (every stack's found / pstress / asd / lrfd / nat / b2 /
//      broms), buildReport(inp, allCombos, gov, embed, struct) (light pole) and buildSignReport(inp, sw, pw, allCombos,
//      postDesigns, poleSeg) (sign), last call of each. Every global function declaration is a property of window, so the
//      wrappers see the page's own calls. Functions are left out, NaN/Infinity kept as strings, repeated objects written once;
//   2. text: per output tab (all but the Manual), the text of every table row, result row, flag, paragraph, list item, step
//      label, heading and TeX annotation, in page order;
//   2b. cable values: each cable's components and its reactions in every combination and azimuth (an explicit "unchanged"
//      check: engineer, 2026-11-01, no change to anything cable-related);
//   3. drawings: a hash of every SVG, by the id of its nearest ancestor with an id;
//   4. console errors and page errors.
// Differences are listed leaf by leaf (results), line by line (text) and by SVG.
//
//   node tests/lightpole-compare.mjs [--a origin/main] [--b "Light Pole and Sign Post.html"] [--cases default,sign1,...]
//        [--old-saves] [--tol 0] [--max-diffs 30] [--out <dir>] [--shots <dir>] [--jobs 4] [--list]
//   --a / --b    a git ref (the tool and shared/ are extracted from it), "<ref>:<file>", or a file in the working tree
//   --old-saves  B opens the project state that A applied (an old saved project, without the fields B adds), instead of
//                B's own new-project defaults with the case's changes
//   --tol        relative tolerance for numbers (default 0: exact)
//   --out        folder for the raw readouts (A/B JSON per case)
//   --shots      B's screenshots of each output tab, 1280 px wide, per case
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from './lib.mjs';

const TOOL = 'Light Pole and Sign Post.html';
const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }

// ---- cases: changes applied to the page's own DEFAULT_STATE (new project), keyed by name ----
// inputs: input-field values (strings, as captureState stores them); top: top-level state fields; cables / fixtures: rows.
export const CASES = {
  default: {},
  sqshaft: { inputs: { shaftShape: 'square', poleShape: 'square', poleDiaTop: '8', poleTwTop: '0.25', rebarMode: 'manual', manBarN: '10' }, top: { constraint: 'con', anchRe: 'no' } },
  nocable: { inputs: { poleShape: 'rect', poleDiaTop: '8', poleDepthTop: '6', poleTwTop: '0.25', V: '140', soilClass: 'custom', S1: '200' }, top: { cablesEnabled: false, isoFac: 2 } },
  broms: { inputs: { bromsSoil: 'cohesive', bromsC: '1.2', KdMode: 'override', Kd: '0.95' } },
  cable45: { cables: [{ hc: 32, th: 45, L: 80, s: 4, D: 0.75, g: 0.35 }] },
  tall: { inputs: { H: '60', poleDiaTop: '6', poleDiaBase: '12', poleTwBase: '0.3125', b: '3.5' } },
  ice: { inputs: { tIce: '1.0', Vice: '60' }, top: { anchRe: 'no' } },
  bolts15: { inputs: { boltDia: '1.500', boltQty: '8', boltBC: '20', b: '3.5', fc: '5000' }, top: { anchRe: 'no', anchTq: 'untorqued' } },
  arms: { fixtures: [{ hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70 }, { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40 }] },
  torsion: { fixtures: [{ hf: 30, th: 90, a: 10, epa: 3.0, aIce: 3.0, tIce: 0.5, W: 80, armD: 3.5 }], top: { cablesEnabled: false } },
  sign1: { top: { appMode: 'sign', signPosts: 1 } },
  sign1sq: { inputs: { poleShape: 'square', poleDiaTop: '8', poleTwTop: '0.3125', signCfMode: 'manual', signCfMan: '1.5', shaftShape: 'square' }, top: { appMode: 'sign', signPosts: 1 } },
  sign2: { inputs: { V: '130', shaftShape: 'square', signB: '16', signS: '5' }, top: { appMode: 'sign', signPosts: 2 } },
  sign2bs: { inputs: { signB: '40', signS: '3', signClr: '8', signSpacing: '20', poleDiaTop: '8', poleTwTop: '0.322' }, top: { appMode: 'sign', signPosts: 2 } },
};

if (args.list) { console.log(Object.keys(CASES).join('\n')); process.exit(0); }

// a side: a working-tree file, or a git ref (tool + shared/ written to a temp folder, so relative shared/*.js loads work)
function side(spec) {
  const wt = path.resolve(REPO, spec);
  if (fs.existsSync(wt) && fs.statSync(wt).isFile()) return { file: wt, label: path.relative(REPO, wt) };
  const [ref, f] = spec.includes(':') ? [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)] : [spec, TOOL];
  const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', ref], { encoding: 'utf8' }).trim();
  const dir = path.join(os.tmpdir(), 'allstruct-tests', 'lp-' + sha); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, path.basename(f)), execFileSync('git', ['-C', REPO, 'show', `${sha}:${f}`], { maxBuffer: 1 << 28 }));
  try { const tar = execFileSync('git', ['-C', REPO, 'archive', sha, 'shared'], { maxBuffer: 1 << 28 }); execFileSync('tar', ['-x', '-C', dir], { input: tar }); } catch (e) { /* no shared/ at that ref */ }
  return { file: path.join(dir, path.basename(f)), label: `${ref} (${sha}):${f}` };
}

// in-page: apply the case, capture
const PAGE_FN = async ({ mut, state, shots }) => {
  const cap = {};
  for (const n of ['renderSummary', 'buildReport', 'buildSignReport']) {
    const o = window[n]; if (typeof o !== 'function') continue;
    window[n] = function (...a) { cap[n] = a; return o.apply(this, a); };
  }
  // eslint-disable-next-line no-undef
  let st = state ? JSON.parse(JSON.stringify(state)) : JSON.parse(JSON.stringify(DEFAULT_STATE));
  if (!state && mut) {
    Object.assign(st.inputs, mut.inputs || {});
    Object.assign(st, mut.top || {});
    if (mut.cables) st.cables = mut.cables;
    if (mut.fixtures) st.fixtures = mut.fixtures;
  }
  // eslint-disable-next-line no-undef
  applyState(st);
  await new Promise(r => setTimeout(r, 400));
  // eslint-disable-next-line no-undef
  const applied = captureState();
  const seen = new Map();
  const ser = (v, p) => {
    if (typeof v === 'number') return Number.isNaN(v) ? 'NaN' : (Number.isFinite(v) ? v : (v > 0 ? 'Inf' : '-Inf'));
    if (v === undefined) return '(undefined)';
    if (typeof v === 'function') return undefined;
    if (v === null || typeof v !== 'object') return v;
    if (typeof Node !== 'undefined' && v instanceof Node) return '[node]';
    if (seen.has(v)) return '[ref ' + seen.get(v) + ']';
    seen.set(v, p);
    if (Array.isArray(v)) return v.map((x, i) => ser(x, p + '[' + i + ']'));
    const o = {};
    for (const k of Object.keys(v)) { const s = ser(v[k], p + '.' + k); if (s !== undefined) o[k] = s; }
    return o;
  };
  const results = {};
  for (const [k, a] of Object.entries(cap)) results[k] = ser(a, k);
  // cable values on their own (engineer, 2026-11-01: every cable result must stay identical): each cable's components
  // (cableComponents with the inp calc() used) and, for every combination and wind azimuth, each cable's reactions and the
  // cable totals
  let cablesOut = null;
  if (cap.buildReport) {
    const [inp0, allCombos] = cap.buildReport;
    // eslint-disable-next-line no-undef
    const comps = (typeof cablesEnabled !== 'undefined' && cablesEnabled) ? cables.map(c => cableComponents(c, inp0)) : [];
    const pick = (o, ks) => { const r = {}; ks.forEach(k => { r[k] = o[k]; }); return r; };
    cablesOut = ser({
      components: comps.map(cp => pick(cp, ['wIce', 'KzC', 'qW', 'qWI', 'D_v', 'Di_v', 'W_h', 'Wi_h', 'A_cable'])),
      // keyed by combination, so a combination added by a later version shows as new, not as a shift of the others
      combos: Object.fromEntries(allCombos.map(r => [r.key, { dirs: (r.dirs || [r]).map(d => ({ phi: d.phi,
        ...pick(d, ['cableRes', 'cableAng', 'hcEff', 'sV', 'cableWindH', 'cableWindM', 'M_cable']),
        per: (d.per || []).map(x => pick(x, ['wv', 'wh', 'Ht', 'Hpull', 'Vc', 'Hw', 'Hx', 'Hy', 'wRes'])) })) }])),
    }, 'cables');
  }
  const text = {}, svgs = {};
  const SEL = 'tr, .resrow, .flag, .verdict, p, li, .step-label, h2, h3, summary, annotation, .tbl-note, .eq-why';
  document.querySelectorAll('.tabpage').forEach(pg => {
    const id = pg.dataset.page; if (id === 'manual') return;
    text[id] = Array.from(pg.querySelectorAll(SEL)).map(e => (e.textContent || '').replace(/\s+/g, ' ').trim().replace(/\d{1,2}\/\d{1,2}\/\d{4}(, \d{1,2}:\d{2}(:\d{2})?\s?[AP]M)?/g, '<date>')).filter(Boolean);
    Array.from(pg.querySelectorAll('svg')).filter(s => !s.closest('.katex')).forEach((s, i) => { let a = s.parentElement; while (a && !a.id) a = a.parentElement; const key = id + ':' + (a ? a.id : '?') + ':' + i;
      let h = 0; const str = s.outerHTML; for (let j = 0; j < str.length; j++) h = (h * 31 + str.charCodeAt(j)) | 0; svgs[key] = h + ':' + str.length; });
  });
  return { results, cables: cablesOut, text, svgs, applied };
};

const tol = args.tol !== undefined ? +args.tol : 0;
const maxD = +(args['max-diffs'] || 30);
const numEq = (a, b) => typeof a === 'number' && typeof b === 'number' && Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));

function lineDiff(a, b) {   // LCS on lines: [-] only in A, [+] only in B
  const n = a.length, m = b.length;
  if (n * m > 4e7) return { removed: a.filter(x => !b.includes(x)), added: b.filter(x => !a.includes(x)) };
  const L = Array.from({ length: n + 1 }, () => new Int32Array(m + 1));
  for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const removed = [], added = []; let i = 0, j = 0;
  while (i < n && j < m) { if (a[i] === b[j]) { i++; j++; } else if (L[i + 1][j] >= L[i][j + 1]) removed.push(a[i++]); else added.push(b[j++]); }
  while (i < n) removed.push(a[i++]); while (j < m) added.push(b[j++]);
  return { removed, added };
}

async function runSide(sd, name, state, shotsDir) {
  const o = await openPage(sd.file, { vw: 1280, vh: 900 });
  try {
    await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 15000 }).catch(() => {});
    await o.p.waitForTimeout(300);
    const r = await o.p.evaluate(PAGE_FN, { mut: CASES[name], state });
    if (shotsDir) {
      fs.mkdirSync(shotsDir, { recursive: true });
      const tabs = await o.p.evaluate(() => Array.from(document.querySelectorAll('#tabBar button')).map(b => b.dataset.tab));
      for (const t of tabs) {
        await o.p.evaluate(t => { const b = document.querySelector(`#tabBar button[data-tab="${t}"]`); if (b) b.click(); }, t);
        await o.p.waitForTimeout(250);
        await o.p.screenshot({ path: path.join(shotsDir, `${name}-${t}-1280.png`), fullPage: true });
      }
    }
    r.errs = o.errs.slice(); r.blocked = [...o.blocked];
    return r;
  } finally { await o.b.close(); }
}

const A = side(args.a || 'origin/main'), B = side(args.b || TOOL);
const names = args.cases ? String(args.cases).split(',') : Object.keys(CASES);
for (const n of names) if (!CASES[n]) { console.error('unknown case ' + n + ' (--list)'); process.exit(2); }
const out = args.out || path.join(os.tmpdir(), 'allstruct-tests', 'lp-out');
fs.mkdirSync(out, { recursive: true });
console.log(`A: ${A.label}\nB: ${B.label}${args['old-saves'] ? '  (B opens the project state A applied: old saves)' : ''}\ncases: ${names.join(', ')}   tolerance: ${tol || 'exact'}\n`);

const jobs = +(args.jobs || 4);
const reports = new Array(names.length);
let next = 0, totalDiff = 0;
async function worker() {
  while (next < names.length) {
    const k = next++, name = names[k];
    const ra = await runSide(A, name, null);
    const rb = await runSide(B, name, args['old-saves'] ? ra.applied : null, args.shots ? path.join(args.shots) : null);
    fs.writeFileSync(path.join(out, `${name}.A.json`), JSON.stringify(ra)); fs.writeFileSync(path.join(out, `${name}.B.json`), JSON.stringify(rb));
    const L = [];
    const dr = diff(ra.results, rb.results).filter(([, a, b]) => !numEq(a, b));
    L.push(`== ${name}: results ${dr.length ? dr.length + ' differing value(s)' : 'identical'}${tol ? ' (tol ' + tol + ')' : ''}`);
    dr.slice(0, maxD).forEach(([p, a, b]) => L.push(`   ${p}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`));
    if (dr.length > maxD) L.push(`   … ${dr.length - maxD} more`);
    const dc = diff(ra.cables, rb.cables).filter(([, a, b]) => !numEq(a, b));
    const ncv = JSON.stringify(rb.cables || null).match(/-?\d+(\.\d+)?(e[-+]?\d+)?/g)?.length || 0;
    L.push(`   cable values: ${ra.cables || rb.cables ? (dc.length ? dc.length + ' DIFFER' : 'identical (' + ncv + ' numbers)') : 'n/a (sign mode)'}`);
    dc.slice(0, maxD).forEach(([p, a, b]) => L.push(`     ${p}: ${JSON.stringify(a)} -> ${JSON.stringify(b)}`));
    totalDiff += dc.length;
    let nt = 0;
    for (const t of new Set([...Object.keys(ra.text), ...Object.keys(rb.text)])) {
      const d = lineDiff(ra.text[t] || [], rb.text[t] || []);
      if (!d.removed.length && !d.added.length) continue;
      nt += d.removed.length + d.added.length;
      L.push(`   text [${t}]: -${d.removed.length} +${d.added.length}`);
      d.removed.slice(0, maxD).forEach(x => L.push(`     - ${x.slice(0, 220)}`));
      d.added.slice(0, maxD).forEach(x => L.push(`     + ${x.slice(0, 220)}`));
    }
    if (!nt) L.push('   text: identical');
    const ds = [...new Set([...Object.keys(ra.svgs), ...Object.keys(rb.svgs)])].filter(k2 => ra.svgs[k2] !== rb.svgs[k2]);
    L.push(`   drawings: ${ds.length ? ds.length + ' differ: ' + ds.join(', ') : 'identical'}`);
    L.push(`   console errors: A ${ra.errs.length}, B ${rb.errs.length}${rb.errs.length ? ' — ' + rb.errs.slice(0, 3).join(' | ') : ''}`);
    if (rb.blocked.length) L.push(`   blocked (B): ${rb.blocked.join(', ')}`);
    totalDiff += dr.length + nt + ds.length + rb.errs.length;
    reports[k] = L.join('\n');
  }
}
await Promise.all(Array.from({ length: Math.min(jobs, names.length) }, worker));
console.log(reports.join('\n\n'));
console.log(`\nreadouts: ${out}\n${totalDiff ? 'DIFFERENCES FOUND' : 'ALL CASES IDENTICAL'}`);
