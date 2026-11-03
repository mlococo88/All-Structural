#!/usr/bin/env node
// Pile Designer: saved-project library (IndexedDB) Rename / Duplicate and Undo / Redo (PLIB, 2026-11-02). The library is in IndexedDB,
// not localStorage, so tests/smoke/project-library.mjs (mapStore lists) does not cover it; this script does the same checks for it.
//   A = a git ref (default origin/main, whole tree extracted), B = the working tree.
//   1. page text (every [data-sp] element and the autosave flash removed) and the autosaved inputs identical A vs B on load and after
//      an input change;  2. B: Undo / Redo buttons and Ctrl+Z / Ctrl+Y exact;  3. B: Save as new, rename (record unchanged but its name),
//      duplicate (new id and name, the rest unchanged), a refused write (IDBObjectStore.put throws QuotaExceededError: message shown,
//      library unchanged), load (starts a new undo history), delete (Cancel keeps, OK removes);  4. no console errors beyond A's.
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
const text = p => p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-sp],script,style').forEach(x => x.remove()); return c.innerText.replace(/saved to browser|auto-save on/g, '').replace(/\s+/g, ' '); });
const state = async p => ({ text: await text(p), inputs: await p.evaluate(() => localStorage.getItem('micropile_lrfd_inputs_v1')) });
const change = async p => { await p.evaluate(() => { const i = [...document.querySelectorAll('.input-rail input[type=number]')].find(x => x.offsetParent && x.value !== '');
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String((+i.value || 0) + 1)); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }); await p.waitForTimeout(1500); };
const same = (a, b, m) => ok(JSON.stringify(a) === JSON.stringify(b), m);

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
// ---------- library ----------
const idb = () => p.evaluate(async () => (await idbGetAll()).sort((a, b) => a.id.localeCompare(b.id)));
const strip = (r, ...k) => { const c = { ...r }; k.forEach(x => delete c[x]); return JSON.stringify(c); };
await p.evaluate(() => [...document.querySelectorAll('button')].find(x => /^Project library/.test(x.textContent.trim())).click()); await p.waitForTimeout(500);
B.replies.push('Job 1'); await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === '+ Save as new').click()); await p.waitForTimeout(900);
let L = await idb(); const j1 = L[0]; ok(L.length === 1 && j1.name === 'Job 1', 'Save as new: one record');
B.replies.push('Job 1 renamed'); await p.evaluate(() => document.querySelector('[data-pdlib=ren]').click()); await p.waitForTimeout(900);
L = await idb(); ok(L.length === 1 && L[0].name === 'Job 1 renamed' && strip(L[0], 'name') === strip(j1, 'name'), 'Rename: the record unchanged but its name');
B.replies.push(undefined); await p.evaluate(() => document.querySelector('[data-pdlib=dup]').click()); await p.waitForTimeout(900);
L = await idb(); const org = L.find(r => r.id === j1.id), cp = L.find(r => r.id !== j1.id);
ok(L.length === 2 && cp.name === 'Job 1 renamed (copy)' && strip(cp, 'id', 'name') === strip(org, 'id', 'name') && strip(org) === strip({ ...j1, name: 'Job 1 renamed' }), 'Duplicate: a copy (new id, "(copy)" name), original kept');
await p.evaluate(() => { window.__put = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
B.replies.push('Q'); await p.evaluate(() => document.querySelector('[data-pdlib=dup]').click()); await p.waitForTimeout(900);
await p.evaluate(() => { IDBObjectStore.prototype.put = window.__put; });
const qm = await p.evaluate(() => { const e = [...document.querySelectorAll('div')].find(x => !x.children.length && /Browser storage is full/.test(x.textContent)); return e ? e.textContent : ''; });
ok(/not duplicated/.test(qm), 'quota: message shown: ' + qm.slice(0, 70)); ok(JSON.stringify(await idb()) === JSON.stringify(L), 'quota: library unchanged');
await change(p); ok((await p.evaluate(() => PDPL.h.sizes())).undo > 0, 'a change after the library work is an undo step');
B.replies.push(true); await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'load').click()); await p.waitForTimeout(1800);
const sz = await p.evaluate(() => PDPL.h.sizes()); ok(sz.undo === 0 && sz.redo === 0, 'Load from the library starts a new undo history');
B.replies.push(false); await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'del').click()); await p.waitForTimeout(700);
ok((await idb()).length === 2, 'Delete: Cancel keeps it');
B.replies.push(true); await p.evaluate(() => [...document.querySelectorAll('button')].find(x => x.textContent.trim() === 'del').click()); await p.waitForTimeout(900);
ok((await idb()).length === 1, 'Delete: OK removes it');
const extra = B.errs.filter(e => !aErr.includes(e)); ok(!extra.length, "no console errors beyond main's" + (extra.length ? ': ' + extra.join(' | ') : ''));
await B.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
