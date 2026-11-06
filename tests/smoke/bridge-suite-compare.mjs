#!/usr/bin/env node
// Bridge Suite standard save (BSS, 2026-11-06): what must not change, origin/main (A, a worktree or extracted tree) vs the working tree (B),
// for lldf.html and Prestressed Bridge Design.html (index.html: tests/smoke/index-report.mjs --mode state / rep on both files).
// Each side: a seeded suite list (bridgeSuite.v1.projects, the open project "Alpha" holding an MCT part and MIDAS demands), then
//   load    -> results, every localStorage key (time stamps, the page's folder and seenAt normalised), the Report text;
//   edit    -> one input changed (the app autosaves into the open project) -> the same again;
//   reload  -> the page opened again on that storage (the app's part read back from the project) -> the same again;
//   export  -> the Export JSON file (savedAt normalised).
// Page text outside the Report is not compared (the header and the Project tab change by design).
//   node tests/smoke/bridge-suite-compare.mjs --a <folder with origin/main> [--app lldf,psb]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const AROOT = path.resolve(arg('a', '')); if (!arg('a', '')) { console.error('--a <folder with origin/main checked out> is required'); process.exit(2); }
const SEED = { 'bridgeSuite.v1.projects': JSON.stringify({ bp_cmp_alpha: { name: 'Alpha', savedAt: '2026-11-01T12:00:00.000Z', slices: { mct: { projectName: 'Alpha' } }, demands: { kind: 'test', rows: [1, 2] } } }),
  'bridgeSuite.v1.currentProjectId': 'bp_cmp_alpha' };
const setVal = `(sel, v) => { const i = document.querySelector(sel); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, v); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }`;
const APPS = {
  lldf: { file: 'lldf.html',
    ready: p => p.waitForFunction(() => window.lldfLast, null, { timeout: 60000 }),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window.lldfLast, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    report: async p => { await p.evaluate(() => { const b = [...document.querySelectorAll('#lxOutTabs button')].find(x => x.textContent.trim() === 'Report'); if (b) b.click(); }); await p.waitForTimeout(1500);
      return p.evaluate(() => { const r = document.getElementById('lldfRptView'); return r ? r.innerText.replace(/\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?/g, '<t>') : ''; }); },
    edit: p => p.evaluate(`(${setVal})('#skew', '12')`),
    exportBtn: p => p.evaluate(() => document.getElementById('projExport').click()) },
  psb: { file: 'Prestressed Bridge Design.html',
    ready: p => p.waitForFunction(() => document.body.innerText.includes('PASS') || document.body.innerText.includes('ERR'), null, { timeout: 120000 }),
    // the Design status chips (every check's ratio) and the header's checks count; every computed value: tests/ps-compare.mjs
    results: p => p.evaluate(() => { const h = [...document.querySelectorAll('body *')].find(e => e.children.length === 0 && /^DESIGN STATUS$/i.test(e.textContent.trim()));
      const box = h && (h.closest('div[class]') || h.parentNode); let c = box; for (let i = 0; i < 3 && c && c.innerText.length < 200; i++) c = c.parentNode;
      return { status: c ? c.innerText : '', checks: (document.body.innerText.match(/\d+\/\d+ PASS/) || [''])[0] }; }),
    report: async p => { await p.evaluate(() => { const b = [...document.querySelectorAll('button,a,[role=tab]')].find(x => x.textContent.trim() === 'Report' || x.textContent.trim() === 'REPORT'); if (b) b.click(); }); await p.waitForTimeout(2500);
      return p.evaluate(() => { const r = document.querySelector('.rp-doc') || document.querySelector('#rp-page'); return r ? r.innerText.replace(/\d{1,2}:\d{2}(:\d{2})?\s?(AM|PM)?/g, '<t>') : ''; }); },
    edit: async p => { await p.evaluate(() => { const t = [...document.querySelectorAll('button,a,[role=tab]')].find(x => x.textContent.trim() === 'Inputs' || x.textContent.trim() === 'INPUTS'); if (t) t.click(); }); await p.waitForTimeout(400);
      await p.evaluate(() => { const t = [...document.querySelectorAll('button,a,[role=tab]')].find(x => x.textContent.trim() === 'Project'); if (t) t.click(); }); await p.waitForTimeout(600);
      await p.evaluate(`(${setVal})('.tb-grid .tb-cell input', 'Cmp Bridge')`); },
    exportBtn: async p => { await p.evaluate(() => { const t = [...document.querySelectorAll('button,a,[role=tab]')].find(x => x.textContent.trim() === 'Inputs' || x.textContent.trim() === 'INPUTS'); if (t) t.click(); }); await p.waitForTimeout(300);
      await p.evaluate(() => { const t = [...document.querySelectorAll('button,a,[role=tab]')].find(x => x.textContent.trim() === 'Project'); if (t) t.click(); }); await p.waitForTimeout(600);
      await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim().toLowerCase() === 'export json').click()); } }
};
const norm = v => JSON.stringify(v).replace(/\\?"(savedAt|ts|producedAt|updatedAt|seenAt|setAt|at|publishedAt|_exported|date)\\?":\s*\\?"[^"\\]*\\?"/g, '"$1":0').replace(/file:\/\/[^"\\]*?\/(?=[^/"\\]*\.html|\\"|")/g, 'file:///DIR/');
const storage = p => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
async function run(root, A) {
  const s = await openPage(path.join(root, A.file), { vw: 1400, vh: 900, timeout: 120000 });   // seeded below, then reloaded (no init script: a reload must keep what the page wrote)
  const p = s.p, R = {};
  await A.ready(p); await p.evaluate(o => { localStorage.clear(); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, SEED);
  await p.reload(); await A.ready(p); await p.waitForTimeout(3000);
  R.load = { results: await A.results(p), storage: await storage(p) }; R.load.report = await A.report(p);
  await A.edit(p); await p.waitForTimeout(3000);
  R.edit = { results: await A.results(p), storage: await storage(p) };
  await p.reload(); await A.ready(p); await p.waitForTimeout(3000);
  R.reload = { results: await A.results(p), storage: await storage(p) }; R.reload.report = await A.report(p);
  const dl = p.waitForEvent('download', { timeout: 15000 }).catch(() => null); await A.exportBtn(p); const d = await dl;
  R.export = d ? fs.readFileSync(await d.path(), 'utf8') : null;
  R.errs = s.errs.filter(e => !/BABEL\] Note|Failed to load resource/.test(e));
  await s.b.close(); return R;
}
let failed = 0;
for (const key of arg('app', 'lldf,psb').split(',')) {
  const A = APPS[key]; const a = await run(AROOT, A), b = await run(REPO, A);
  console.log(`== ${key}`);
  for (const ph of ['load', 'edit', 'reload']) for (const part of Object.keys(a[ph])) {
    if (part === 'storage') { const ks = new Set([...Object.keys(a[ph].storage), ...Object.keys(b[ph].storage)]); const bad = [...ks].filter(k => /updatedAt$/.test(k) ? (a[ph].storage[k] == null) !== (b[ph].storage[k] == null) : norm(a[ph].storage[k]) !== norm(b[ph].storage[k]));   // a key that is itself a time stamp: present on both
      console.log(`  ${bad.length ? 'DIFF' : 'same'} ${ph}.storage (${ks.size} keys)${bad.length ? ': ' + bad.map(k => `${k}\n      A ${String(a[ph].storage[k]).slice(0, 300)}\n      B ${String(b[ph].storage[k]).slice(0, 300)}`).join('\n    ') : ''}`); if (bad.length) failed++; continue; }
    const same = norm(a[ph][part]) === norm(b[ph][part]); console.log(`  ${same ? 'same' : 'DIFF'} ${ph}.${part} (${JSON.stringify(a[ph][part]).length} chars)`); if (!same) failed++;
  }
  const se = norm(a.export) === norm(b.export) && a.export != null; console.log(`  ${se ? 'same' : 'DIFF'} Export JSON (${(a.export || '').length} chars)`); if (!se) { failed++; const x = norm(a.export), y = norm(b.export); let i = 0; while (i < x.length && x[i] === y[i]) i++; console.log('    A …' + x.slice(Math.max(0, i - 80), i + 120) + '\n    B …' + y.slice(Math.max(0, i - 80), i + 120)); }
  console.log(`  console errors: A ${JSON.stringify(a.errs)} B ${JSON.stringify(b.errs)}`); if (b.errs.length) failed++;
}
console.log(failed ? `${failed} DIFFERENT` : 'all identical');
process.exit(failed ? 1 : 0);
