#!/usr/bin/env node
// index.html (MIDAS MCT generator): the Report step against the three window reports it replaced (IXRX, 2026-11-03).
// There is no fixture with MIDAS results, so each case seeds one: the model (mct_cfg_v3), capacity zones (mct_cap_zones_v1) and
// synthetic MIDAS beam-force rows written to the legacy key mct_results_v1 (the page moves them to IndexedDB on load), one row per
// element end, nodes 101… at the positions of the page's own MCT node list (generateMCT / generateGFS_MCT).
//   node tests/smoke/index-report.mjs --file <index.html> --case base|lfr|arema --out <json> --mode old|rep|state|route [--nokatex]
//   old:   the window reports as written ("Generate Report" from AASHTO Rating → Summary, so the RF chart is captured; "Print AREMA
//          Report"; the Report Card's print window), each as text (innerText + KaTeX annotations) and as HTML.
//   rep:   the Report step as printed (#rp-print, print media): text + KaTeX annotations, unresolved / duplicate references.
//   state: what must not change: reportState and the rating values (JSON), localStorage, IndexedDB rows, the text of every step and
//          every AASHTO Rating sub-tab.
//   route: Print from each step (beforeprint and the print buttons): the Report is printed and the step of before comes back.
// The file must sit in a full copy of the repository (it loads shared/*.js), e.g. a git worktree of origin/main.
import fs from 'fs';
import path from 'path';
import { loadPlaywright, chromiumPath, libFor } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', 'index.html')), CASE = arg('case', 'base'), OUT = arg('out', null), MODE = arg('mode', 'rep');
const NOKATEX = process.argv.includes('--nokatex');

const T = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2' };
export const CASES = {
  base: {
    cfg: { projectName: 'Test Bridge', projectBridgeId: 'BR-101', projectUser: 'MJL', projectDate: '2026-11-03', projectClient: 'Town',
      rating: { dcLC: 'DC1 - Non-composite DL', dwLC: 'DW - Barrier/Overlay', llposLC: 'HL-93TRK_Suspended Span(max)', llnegLC: 'HL-93TRK_Suspended Span(min)' } },
    zones: [{ id: 'capA', startX: 0, endX: 81, type: 'manual', MnPos: 900, MnNeg: 700, Vn: 220, Fy: 50, ZxPos: 0, ZxNeg: 0, Aw: 0, SxPos: 0, SxNeg: 0, aremaComps: null, outToOut: 42 }],
    ll: ['HL-93TRK_Suspended Span'],
  },
  lfr: {
    cfg: { projectName: 'Three Span', projectBridgeId: 'BR-7', projectUser: 'EE', projectDate: '2026-10-01', spans: [30, 40, 30], elemsPerSpan: 8,
      sectionZones: [{ id: 'z0', startX: 0, endX: 100, type: 'catalog', name: 'W27X94' }],
      rating: { method: 'LFR', level: 'Operating', dcLC: 'DC1 - Non-composite DL', dwLC: 'DW - Barrier/Overlay', llposLC: 'HL-93TRK_Suspended Span(max)', llnegLC: 'HL-93TRK_Suspended Span(min)',
        llFactors: [
          { id: 'df', label: 'Distribution Factor', symbol: 'g', value: 0.62, enabled: true, hint: '', isPercent: false },
          { id: 'im', label: 'Dynamic Load Allowance', symbol: 'IM', value: 33, enabled: true, hint: '', isPercent: true },
          { id: 'mpf', label: 'Multiple Presence Factor', symbol: 'm', value: 1.2, enabled: true, hint: '', isPercent: false },
          { id: 'u1', label: 'User Factor 1', symbol: 'F₁', value: 1.0, enabled: false, hint: '', isPercent: false },
          { id: 'u2', label: 'User Factor 2', symbol: 'F₂', value: 1.0, enabled: false, hint: '', isPercent: false }] } },
    zones: [{ id: 'capQ', startX: 0, endX: 100, type: 'quickcalc', MnPos: 0, MnNeg: 0, Vn: 0, Fy: 50, ZxPos: 278, ZxNeg: 278, Aw: 13.2, SxPos: 0, SxNeg: 0, aremaComps: null, outToOut: 42 }],
    ll: ['HL-93TRK_Suspended Span'], scale: 1.6,
  },
  arema: {
    cfg: { projectName: 'Rail Bridge', projectBridgeId: 'RR-12', projectUser: 'MJL', projectDate: '2026-11-03', selectedVehicles: ['AREMA-E80'], movingLoadCode: 'AREMA',
      rating: { dcLC: 'DC1 - Non-composite DL', dwLC: 'DW - Barrier/Overlay', llposLC: 'AREMA-E80_Suspended Span(max)', llnegLC: 'AREMA-E80_Suspended Span(min)',
        arema_dcLC: 'DC1 - Non-composite DL', arema_llLC: 'AREMA-E80_Suspended Span(max)', arema_llNegLC: 'AREMA-E80_Suspended Span(min)',
        arema_reportProjectNum: 'P-2026-14', arema_reportOwner: 'Rail Co', arema_reportInspector: 'J. Doe', arema_reportRatingDate: '2026-10-30',
        arema_reportNotes: 'Field-measured plate thicknesses.\nRivets in good condition.' } },
    zones: [{ id: 'capR', startX: 0, endX: 81, type: 'arema', MnPos: 500, MnNeg: 500, Vn: 150, Fy: 36, ZxPos: 0, ZxNeg: 0, Aw: 0, SxPos: 0, SxNeg: 0, aremaComps: null, outToOut: 42,
      holeDiam: 1, holePitch: 3, holeGage: 1.5, holesInChain: 0, unbracedL: 240, autoRyc: true }],
    ll: ['AREMA-E80_Suspended Span'], scale: 3,
  },
};

export async function open(file, cs, { nokatex = false, vw = 1400, vh = 1000 } = {}) {
  const { chromium } = await loadPlaywright();
  const b = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/^(file|data|about|blob):/.test(u)) return r.continue();
    if (nokatex && /katex/i.test(u)) return r.abort();
    const f = libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: T[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: '', contentType: 'text/css' });
    return r.abort();
  });
  const errs = [];
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error' && !/BABEL|ERR_FAILED|katex/i.test(m.text())) errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('dialog', d => d.accept());
  const C = CASES[cs];
  const ready = () => p.waitForFunction(() => document.querySelector('button[data-sp]') && typeof generateMCT === 'function', null, { timeout: 180000 });
  await p.addInitScript(o => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } },
    { mct_cfg_v3: JSON.stringify(C.cfg), mct_cap_zones_v1: JSON.stringify(C.zones) });
  await p.goto('file://' + file, { timeout: 180000 }); await ready(); await p.waitForTimeout(800);
  // the MIDAS rows: positions from the page's own MCT node list (stable model; the cfg as the page loaded it)
  await p.evaluate(async ([ll, sc]) => {
    const cfg = JSON.parse(localStorage.getItem('mct_cfg_v3'));
    const mct = generateMCT(cfg), L = mct.split('\n'), i0 = L.findIndex(l => /^\*NODE/.test(l)), X = [];
    for (let i = i0 + 1; i < L.length && !/^\*/.test(L[i]); i++) { const m = L[i].match(/^\s*(\d+),\s*([-\d.]+)/); if (m) X.push([+m[1], +m[2]]); }
    const spans = cfg.spans, tot = spans.reduce((a, b) => a + b, 0);
    const loc = x => { let s0 = 0; for (const Ls of spans) { if (x <= s0 + Ls + 1e-9) return [x - s0, Ls]; s0 += Ls; } return [0, spans[spans.length - 1]]; };
    const r3 = v => Math.round(v * 1000) / 1000;
    const lcs = { 'Selfweight': [0.055, 0], 'DC1 - Non-composite DL': [0.738, 0], 'DC2 - Composite DL': [0.0086, 0], 'DW - Barrier/Overlay': [0.465, 0] };
    const rows = [];
    const f = (lc, x, end) => { const [s, Ls] = loc(x), e = end === 'I' ? 1 : -1;
      if (lcs[lc]) { const w = lcs[lc][0]; return [w * (s * (Ls - s) / 2 - Ls * Ls / 11), w * (Ls / 2 - s) * e]; }
      const k = sc, sn = Math.sin(Math.PI * s / Ls), q = x / tot;
      if (/\(max\)$/.test(lc)) return [k * (260 * sn + 25 + 15 * q), k * (55 * (1 - s / Ls) + 12) * e];
      return [-k * (190 * (1 - sn) + 18 + 10 * q), -k * (50 * (s / Ls) + 10) * e]; };
    const names = [...Object.keys(lcs), ...ll.flatMap(v => [v + '(max)', v + '(min)'])];
    for (let j = 0; j + 1 < X.length; j++) for (const lc of names) for (const [end, nd] of [['I', X[j]], ['J', X[j + 1]]]) {
      const [M, V] = f(lc, nd[1], end);
      rows.push({ elem: 101 + j, load: lc, end, node: nd[0], axial: 0, shearY: 0, shearZ: r3(V), torsion: 0, momentY: r3(M), momentZ: 0 });
    }
    await idbSet('results_rows', rows);   // as the page stores them; and the legacy key, which the page moves there on load
    localStorage.setItem('mct_results_v1', JSON.stringify(rows));
  }, [C.ll, C.scale || 1]);
  await p.reload({ timeout: 180000 }); await ready();
  await p.waitForFunction(() => !localStorage.getItem('mct_results_v1'), null, { timeout: 30000 }); await p.waitForTimeout(1200);
  // the rows are in the app (Results step: "N rows · M load cases"); the step is left as it was (step 0)
  await step(p, 'Results');
  await p.waitForFunction(() => /\d+ rows · \d+ load cases/.test(document.querySelector('#root').innerText), null, { timeout: 30000 });
  await step(p, 'Project');
  return { b, ctx, p, errs };
}

export const step = async (p, name) => { await p.evaluate(n => { const b = [...document.querySelectorAll('nav button')].find(x => x.textContent.replace(/\s+/g, ' ').trim().endsWith(n)); if (!b) throw new Error('no step ' + n); b.click(); }, name); await p.waitForTimeout(900); };
export const subTab = async (p, label) => { await p.evaluate(l => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.includes(l) && x.offsetParent); if (b) b.click(); }, label); await p.waitForTimeout(900); };
// text with the KaTeX annotations (formulas as TeX), and the number of figures
const grab = (p, sel) => p.evaluate(sel => { const r = document.querySelector(sel); if (!r) return { t: '', tex: '', im: 0 };
  return { t: r.innerText, tex: [...r.querySelectorAll('annotation')].map(a => a.textContent).join('\n'), im: [...r.querySelectorAll('svg,img,canvas')].filter(e => !e.closest('.katex')).length }; }, sel);

async function main() {
  const o = await open(FILE, CASE, { nokatex: NOKATEX }); const p = o.p; const R = { case: CASE, file: FILE, katex: !NOKATEX };
  if (MODE === 'old') {
    // window.open is caught: the document each report writes
    await p.evaluate(() => { window.__W = []; window.open = () => { const w = { closed: false, _h: '', document: { write: h => { w._h += h; }, close: () => window.__W.push(w._h) }, focus() {}, print() {} }; return w; }; });
    await step(p, 'AASHTO Rating'); await p.waitForTimeout(1500);   // Inputs & Setup: the RF chart is drawn there, so the report has its image
    await p.evaluate(() => [...document.querySelectorAll('button')].find(b => /Generate Report/.test(b.textContent)).click()); await p.waitForTimeout(500);
    await subTab(p, 'Report Card');
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Print \/ Export/.test(b.textContent)); if (b) b.click(); });
    await step(p, 'AREMA Rating'); await p.waitForTimeout(800);
    await p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(b => /Print AREMA Report/.test(b.textContent)); if (b) b.click(); });
    await p.waitForTimeout(500);
    const W = await p.evaluate(() => window.__W);
    R.html = { gen: W.find(h => /Bridge Rating &amp; MCT Report|Bridge Rating & MCT Report/.test(h)) || '', card: W.find(h => /Rating Report Card/.test(h)) || '', arema: W.find(h => /Load Rating Report — AREMA/.test(h)) || '' };
    const v = await o.ctx.newPage();
    R.txt = {};
    for (const [k, h] of Object.entries(R.html)) { if (!h) { R.txt[k] = null; continue; } await v.setContent(h.replace(/<link[^>]*fonts\.googleapis[^>]*>/g, ''), { waitUntil: 'load' }).catch(() => {}); await v.emulateMedia({ media: 'print' }); R.txt[k] = await grab(v, 'body'); }
  } else if (MODE === 'rep') {
    await step(p, 'AREMA Rating'); await step(p, 'AASHTO Rating');
    await step(p, 'Report'); await p.waitForTimeout(2500);
    await p.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await p.waitForTimeout(1200);
    await p.emulateMedia({ media: 'print' });
    R.rep = await grab(p, '#rp-print');
    R.info = await p.evaluate(() => ({ unres: window.IDRP ? window.IDRP.doc.unresolved.length : -1, dup: window.IDRP ? window.IDRP.doc.dup.length : -1 }));
    await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  }
  else if (MODE === 'state') {
    const ls = () => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
    const idb = () => p.evaluate(async () => JSON.stringify(await idbGet('results_rows')));
    const main = () => p.evaluate(() => { const c = document.querySelector('#root').cloneNode(true); return c.innerText.replace(/\d{1,2}:\d{2}:\d{2}( [AP]M)?/g, '<time>'); });
    R.ls0 = await ls(); R.idb0 = await idb(); R.T = {};
    const steps = await p.evaluate(() => STEPS.slice());
    for (const s of steps) {
      if (s === 'Report') continue;
      await step(p, s); R.T[s] = await main();
      if (s === 'AASHTO Rating') for (const t of ['Summary', 'Multi-Vehicle', 'Demand vs. Cap', 'Service II', 'Fatigue', 'PS Strength I', 'PS Service III', 'Report Card', 'Inputs & Setup']) { await subTab(p, t); R.T[s + ' / ' + t] = await main(); }
    }
    R.ls1 = await ls();
    await step(p, 'Report'); await p.waitForTimeout(2500);
    // the Report's own sections (idxrModel), without what IXRX adds and without the Notes text
    R.model = await p.evaluate(() => { const M = window.IDRP && window.IDRP.model; if (!M) return null; const seen = new WeakSet();
      return JSON.parse(JSON.stringify(M.sections.filter(s => !['Model and MCT report', 'AREMA rating report', 'Rating report card', 'Notes and references'].includes(s.title)), (k, v) => typeof v === 'function' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[c]' : (seen.add(v), v)) : v))); });
    await p.evaluate(() => { window.dispatchEvent(new Event('beforeprint')); window.dispatchEvent(new Event('afterprint')); }); await p.waitForTimeout(800);
    await step(p, 'Project'); R.ls2 = await ls(); R.idb2 = await idb();
  } else if (MODE === 'route') {
    const ls = () => p.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
    const main = () => p.evaluate(() => document.querySelector('#root').innerText.replace(/\d{1,2}:\d{2}:\d{2}( [AP]M)?/g, '<time>'));
    const chk = async () => { await p.waitForTimeout(500); const r = await p.evaluate(() => ({ len: (document.getElementById('rp-print') || {}).innerText?.length || 0, cls: document.body.classList.contains('rp-printing'), head: ((document.getElementById('rp-page') || {}).textContent || '').length }));
      await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(900); return r; };
    await step(p, 'AASHTO Rating');
    const steps = await p.evaluate(() => STEPS.slice()); R.route = [];
    const how = { bp: async () => p.evaluate(() => window.dispatchEvent(new Event('beforeprint'))),
      gen: async () => p.evaluate(() => { [...document.querySelectorAll('button')].find(b => /Generate Report/.test(b.textContent)).click(); window.dispatchEvent(new Event('beforeprint')); }) };
    for (const s of steps) for (const [h, fn] of Object.entries(how)) {
      await step(p, s); const t0 = await main(), l0 = await ls(); await fn(); const r = await chk();
      R.route.push([s, h, r.len > 3000, r.cls, r.head > 50, (await main()) === t0, (await ls()) === l0]);
    }
    for (const [s, sub, re] of [['AASHTO Rating', 'Report Card', /Print \/ Export/], ['AREMA Rating', null, /Print AREMA Report/]]) {
      await step(p, s); if (sub) await subTab(p, sub); const t0 = await main(), l0 = await ls();
      const ok = await p.evaluate(re => { const b = [...document.querySelectorAll('button')].find(b => new RegExp(re).test(b.textContent)); if (!b) return false; b.click(); window.dispatchEvent(new Event('beforeprint')); return true; }, re.source);
      if (!ok) { R.route.push([s, sub || 'button', 'no button']); continue; }
      const r = await chk(); R.route.push([s + (sub ? ' / ' + sub : ''), 'button', r.len > 3000, r.cls, r.head > 50, (await main()) === t0, (await ls()) === l0]);
    }
    R.bad = R.route.filter(r => !r.slice(2).every(x => x === true));
  }
  else if (MODE === 'inc') {
    // the Include boxes: the session boxes write nothing; an AREMA section box writes only cfg.rating.arema_reportSections[key]
    const ls = () => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).map(k => [k, localStorage.getItem(k)])));
    const secs = () => p.evaluate(() => window.IDRP.model.sections.map(s => s.title + ': ' + s.subs.map(q => q.title).join(' / ')));
    const click = async sel => { await p.evaluate(sel => document.querySelector(sel).click(), sel); await p.waitForTimeout(1500); };
    await step(p, 'AASHTO Rating'); await step(p, 'Report'); await p.waitForTimeout(2500);
    R.inc = []; let l0 = await ls(), s0 = await secs();
    for (const sel of ['input[data-ixa="geometry"]', 'input[data-ixa="geometry"]', 'input[data-ixx="mct"]', 'input[data-ixx="arema"]', 'input[data-ixx="card"]', 'input[data-ixx="gen"]']) {
      await click(sel); const l1 = await ls(), s1 = await secs();
      const keys = Object.keys({ ...l0, ...l1 }).filter(k => l0[k] !== l1[k]);
      const cfgD = keys.includes('mct_cfg_v3') ? (() => { const a = JSON.parse(l0.mct_cfg_v3), b = JSON.parse(l1.mct_cfg_v3); return JSON.stringify({ ...a, rating: { ...a.rating, arema_reportSections: 0 } }) === JSON.stringify({ ...b, rating: { ...b.rating, arema_reportSections: 0 } }) ? 'only arema_reportSections: ' + JSON.stringify(b.rating.arema_reportSections) : 'OTHER FIELDS'; })() : '';
      R.inc.push({ sel, keys, cfgD, sections: s1.filter(x => !s0.includes(x)).map(x => x.slice(0, 160)), gone: s0.filter(x => !s1.includes(x)).map(x => x.slice(0, 160)) });
      l0 = l1; s0 = s1; }
    console.log(JSON.stringify(R.inc, null, 1));
  }
  R.errs = o.errs;
  if (OUT) fs.writeFileSync(OUT, JSON.stringify(R));
  if (MODE === 'route') console.log(CASE, 'route', R.route.length, 'paths; failing:', JSON.stringify(R.bad), 'errs', o.errs.slice(0, 3));
  else if (MODE === 'state') console.log(CASE, 'state', Object.keys(R.T).length, 'views', 'errs', o.errs.slice(0, 3));
  else console.log(CASE, MODE, NOKATEX ? 'nokatex' : 'katex', JSON.stringify(Object.fromEntries(Object.entries(R.txt || { rep: R.rep }).map(([k, v]) => [k, v ? [v.t.length, v.tex.length, v.im] : null]))), R.info || '', 'errs', o.errs.slice(0, 3));
  await o.b.close();
}
if (process.argv[1] && import.meta.url.endsWith(path.basename(process.argv[1]))) await main();
