#!/usr/bin/env node
// Pile Designer: saved-project library (IndexedDB) Rename / Duplicate and Undo / Redo (PLIB, 2026-11-02). The library is in IndexedDB,
// not localStorage, so tests/smoke/project-library.mjs (mapStore lists) does not cover it; this script does the same checks for it.
//   A = a git ref (default origin/main, whole tree extracted), B = the working tree.
//   1. page text (every [data-sp] element and the autosave flash removed) and the autosaved inputs identical A vs B on load and after
//      an input change;  2. B: Undo / Redo buttons and Ctrl+Z / Ctrl+Y exact;  3. B: Save as new, rename (record unchanged but its name),
//      duplicate (new id and name, the rest unchanged), a refused write (IDBObjectStore.put throws QuotaExceededError: message shown,
//      library unchanged), load (starts a new undo history), delete (Cancel keeps, OK removes);  4. no console errors beyond A's.
//   STDS-P (2026-11-06): 3. through the standard save (header Save, Save as with Replace it, the standard dialog's Rename / Duplicate /
//      Open / Delete, old duplicate names listed as "(older, saved …)", the home-page mirror, 390 px).
// Test-only: React 18.3.1 (unpkg, the tool's tag) is served from tests/libs react@18.2.0 (18.3.1 is not in the kit); Tailwind is not
// served (layout not checked here).
//   node tests/smoke/pile-library.mjs [--a origin/main]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { REPO, HERE, loadPlaywright, chromiumPath, libFor } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('a', 'origin/main'), FILE = 'Pile Designer.html';
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const ADIR = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(ADIR, '.done'))) { fs.mkdirSync(ADIR, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${ADIR}"`]); fs.writeFileSync(path.join(ADIR, '.done'), sha); }
const LIBS = path.join(HERE, 'libs');
const SUB = { 'unpkg.com/react@18.3.1/umd/react.production.min.js': path.join(LIBS, 'react@18.2.0/umd/react.production.min.js'),
  'unpkg.com/react-dom@18.3.1/umd/react-dom.production.min.js': path.join(LIBS, 'react-dom@18.2.0/umd/react-dom.production.min.js') };
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
async function run(file) {
  const { chromium } = await loadPlaywright();
  const b = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await b.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.route('**/*', r => { const u = r.request().url(); if (/^(file|data|about|blob):/.test(u)) return r.continue();
    const f = SUB[u.replace(/^https?:\/\//, '').split('?')[0]] || libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: 'application/javascript', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/^https?:\/\/fonts\./.test(u)) return r.fulfill({ body: '', contentType: 'text/css' }); return r.abort(); });
  const p = await ctx.newPage(), errs = [], dl = [], replies = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 300)));
  p.on('dialog', async d => { dl.push(d.type() + ': ' + d.message().slice(0, 160)); const r = replies.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : d.defaultValue()); });
  await p.goto('file://' + file, { timeout: 60000 });
  await p.waitForFunction(() => document.querySelector('.input-rail input[type=number]'), null, { timeout: 60000 }); await p.waitForTimeout(2500);
  return { b, p, errs, dl, replies };
}
// STDS-P (2026-11-06): the Project tab block (#pdPrjBlock: the new "Save and open" card replaced "Project file" and "Project library") and the
// header buttons are left out of the A vs B text: the page's results (the rest of the page) must be identical
const text = p => p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-sp],script,style,#pdPrjBlock,.pd-hdrBtns').forEach(x => x.remove()); return c.innerText.replace(/saved to browser|auto-save on/g, '').replace(/Project fileSave \/ load \.json · auto-saves to this browser.Project libraryStored in this browser \(IndexedDB\)./, '')   /* main's two collapsed panels (STDS-P: replaced by the card) */.replace(/\s+/g, ' '); });
const state = async p => ({ text: await text(p), inputs: await p.evaluate(() => localStorage.getItem('micropile_lrfd_inputs_v1')) });
const change = async p => { await p.evaluate(() => { const i = [...document.querySelectorAll('.input-rail input[type=number]')].find(x => x.offsetParent && x.value !== '');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String((+i.value || 0) + 1)); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }); await p.waitForTimeout(1500); };
const same = (a, b, m) => { const eq = JSON.stringify(a) === JSON.stringify(b); ok(eq, m);
  if (!eq && a && b && typeof a.text === 'string') { let i = 0; while (i < a.text.length && a.text[i] === b.text[i]) i++; console.log('       A: …' + a.text.slice(Math.max(0, i - 80), i + 120) + '\n       B: …' + b.text.slice(Math.max(0, i - 80), i + 120) + '\n       inputs same: ' + (a.inputs === b.inputs)); } };

console.log(`pile-library: ${FILE}  A = ${REF} (${sha})  B = working tree`);
const A = await run(path.join(ADIR, FILE)), B = await run(path.join(REPO, FILE));
const a0 = await state(A.p), b0 = await state(B.p); same(a0, b0, 'on load: page text and autosaved inputs identical');
await change(A.p); await change(B.p);
const a1 = await state(A.p), b1 = await state(B.p); same(a1, b1, 'after an input change: identical');
ok(JSON.stringify(a1) !== JSON.stringify(a0), 'the input change changes the page (the test change is real)');
const aErr = A.errs.slice(); await A.b.close();
// ---------- Undo / Redo ----------
const p = B.p, click = t => p.evaluate(t => [...document.querySelectorAll('button[data-sp]')].find(x => x.textContent === t).click(), t);
ok(await p.evaluate(() => !document.querySelector('button[data-sp][title^="Undo"]').disabled), 'Undo enabled after a change');
await click('Undo'); await p.waitForTimeout(1500); same(await state(p), b0, 'Undo: back to the state before the change');
ok(await p.evaluate(() => document.querySelector('button[data-sp][title^="Undo"]').disabled), 'Undo disabled at the start of the history');
await click('Redo'); await p.waitForTimeout(1500); same(await state(p), b1, 'Redo: the change again');
await p.keyboard.press('Control+z'); await p.waitForTimeout(1500); same(await state(p), b0, 'Ctrl+Z');
await p.keyboard.press('Control+y'); await p.waitForTimeout(1500); same(await state(p), b1, 'Ctrl+Y');
// ---------- library (STDS-P: the standard save over the IndexedDB records) ----------
const idb = () => p.evaluate(async () => (await idbGetAll()).sort((a, b) => a.id.localeCompare(b.id)));
const strip = (r, ...k) => { const c = { ...r }; k.forEach(x => delete c[x]); return JSON.stringify(c); };
const saveAs = async (n, replace) => { await p.evaluate(() => SharedProjectsUI.bars[0].saveAs()); await p.fill('dialog.spSave .spName', n); await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click());
  if (replace) { ok(/already exists/.test(await p.$eval('dialog.spSave .spMsg', e => e.innerText)), 'Save as a name in use: "Replace it" asked'); await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click()); } await p.waitForTimeout(900); };
const lib = async () => { await p.evaluate(() => { const d = document.getElementById('pdLibDlg'); if (d && d.open) d.close(); document.querySelector('[data-sp=hlib]').click(); }); await p.waitForTimeout(400); };
const row = (n, a) => p.evaluate(([n, a]) => document.querySelector(`#pdLibDlg [data-spa=${a}][data-n="${CSS.escape(encodeURIComponent(n))}"]`).click(), [n, a]);
const chip = () => p.evaluate(() => { SharedProjectsUI.bars[0].refresh(); return document.querySelector('[data-sp=chip]').innerText.replace(/\s+/g, ' '); });
ok(await p.evaluate(() => [...document.querySelectorAll('.pd-hdrBtns button')].map(b => b.textContent.replace(/Ctrl\+S/, '').trim()).join('|').replace(/^Project:.*?\|/, 'chip|')) === 'chip|Undo|Redo|Save|Saved projects…|Methodology & code path', 'header: chip · Undo · Redo · Save · Saved projects… · Methodology');
ok(await p.evaluate(() => document.querySelector('#pdPrjBlock .panel-title, #pdPrjBlock h2, #pdPrjBlock') && /Save and open/.test(document.querySelector('#pdPrjBlock').innerText.slice(0, 40))), 'Project tab: "Save and open" first');
await p.evaluate(() => document.querySelector('[data-sp=hsave]').click()); await p.waitForSelector('dialog.spSave[open]'); await p.fill('dialog.spSave .spName', 'Job 1'); await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click()); await p.waitForTimeout(900);
let L = await idb(); const j1 = L[0]; ok(L.length === 1 && j1.name === 'Job 1' && j1.inputs && 'updatedAt' in j1 && 'lpile' in j1, 'Save (no name yet: Save as): one record { id, name, inputs, lpile, updatedAt }');
ok(/Job 1 · saved/.test(await chip()), 'chip: Job 1 saved');
await change(p); ok(/unsaved changes/.test(await chip()), 'an input change: unsaved changes');
const n0 = B.dl.length; await p.evaluate(() => document.querySelector('[data-sp=hsave]').click()); await p.waitForTimeout(900); L = await idb();
ok(B.dl.length === n0 && L.length === 1 && L[0].id === j1.id && L[0].updatedAt >= j1.updatedAt && /saved/.test(await chip()), 'Save on the open project: same record, no question');
await saveAs('Job 1', false); ok((await idb()).length === 1, 'Save as with the open name: no new record');
await saveAs('Job 2'); L = await idb(); ok(L.length === 2, 'Save as a new name: a second record');
await saveAs('Job 1', true); L = await idb(); ok(L.length === 2 && L.filter(r => r.name === 'Job 1').length === 1, 'Replace it: no new duplicate name');
await lib(); B.replies.push('Job 1 renamed'); const before = (await idb()).find(r => r.name === 'Job 1'); await row('Job 1', 'rename'); await p.waitForTimeout(900);
L = await idb(); const rn = L.find(r => r.id === before.id); ok(rn.name === 'Job 1 renamed' && strip(rn, 'name') === strip(before, 'name'), 'Rename: the record unchanged but its name');
B.replies.push(undefined); await row('Job 1 renamed', 'dup'); await p.waitForTimeout(900);
L = await idb(); const cp = L.find(r => r.name === 'Job 1 renamed (copy)');
ok(L.length === 3 && cp && strip(cp, 'id', 'name') === strip(rn, 'id', 'name'), 'Duplicate: a copy (new id, "(copy)" name), original kept');
// duplicate names kept from before: listed with "(older, saved …)"
await p.evaluate(async () => { const r = (await idbGetAll()).find(x => x.name === 'Job 2'); await idbPut({ ...r, id: 'p_old_dup', updatedAt: '2026-10-01T15:00:00.000Z' }); });
await p.reload(); await p.waitForFunction(() => window.SharedProjectsUI && SharedProjectsUI.bars && SharedProjectsUI.bars[0], null, { timeout: 60000 }); await p.waitForTimeout(1500);
await lib(); const names = await p.$$eval('#pdLibDlg tbody tr td:first-child', r => r.map(x => x.innerText.trim()));
ok(names.includes('Job 2') && names.some(n => /^Job 2 \(older, saved Oct 1, 2026, 11:00 AM EDT\)$/.test(n)) && names.length === 4, 'old duplicate names: every record listed (' + names.join(' | ') + ')');
// a refused write: message, the library and the list unchanged
const L0 = await idb();
await p.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
B.replies.push('Q'); await row('Job 2', 'dup'); await p.waitForTimeout(1200);
await p.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
ok(B.dl.some(m => /alert: The project was not duplicated\. Browser storage is full/.test(m)), 'quota: message shown');
ok(JSON.stringify(await idb()) === JSON.stringify(L0) && (await p.evaluate(() => PDLIB.recs().length)) === L0.length, 'quota: library (and its in-memory copy) unchanged');
await p.evaluate(() => document.getElementById('pdLibDlg').close());
await change(p); ok((await p.evaluate(() => PDPL.h.sizes())).undo > 0, 'a change after the library work is an undo step');
B.replies.push(true); await lib(); await row('Job 2', 'open'); await p.waitForTimeout(1800);
const sz = await p.evaluate(() => PDPL.h.sizes()); ok(sz.undo === 0 && sz.redo === 0 && B.dl.at(-1).startsWith('confirm: The project on screen has unsaved changes'), 'Open (asks first on unsaved changes) starts a new undo history');
await lib(); B.replies.push(false); await row('Job 1 renamed (copy)', 'del'); await p.waitForTimeout(700); ok((await idb()).length === 4, 'Delete: Cancel keeps it');
B.replies.push(true); await row('Job 1 renamed (copy)', 'del'); await p.waitForTimeout(900); ok((await idb()).length === 3, 'Delete: OK removes it');
const mir = await p.evaluate(() => JSON.parse(localStorage.getItem('micropile_lrfd_index_v1')));
ok(mir.v === 1 && mir.items.length === 3 && mir.items.every(i => i.id && i.name && i.updatedAt && i.size > 0), 'home-page mirror micropile_lrfd_index_v1: names and times of the 3 records');
await p.evaluate(() => document.getElementById('pdLibDlg').close());
await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(500); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390 px: no sideways scroll');
const extra = B.errs.filter(e => !aErr.includes(e)); ok(!extra.length, "no console errors beyond main's" + (extra.length ? ': ' + extra.join(' | ') : ''));
await B.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
