#!/usr/bin/env node
// Steel Bridge Design.html: the standard save (STDS-G, 2026-11-06). One project = the modules' part (girderdetail_projects_v1) and
// Preliminary sizing's part (plateline_projects_v1) under one name; both keys and item formats unchanged.
//   1. A = a git ref (default origin/main, whole tree) vs B = the working tree, same empty storage: after load (idle) and after one input
//      change, identical: every localStorage key and value (time stamps zeroed), the Export JSON text, the open module's calculation report
//      and the page text outside the save controls ("Saved projects" pane / "Save and open" card, the header's [data-sp] controls);
//   2. B only: header chip · Save · Saved projects…; the card first in the modules' Project tab; Save as writes BOTH lists under the name
//      (each item = that part's P, as its own Save wrote it); plain Save asks nothing; Save as a name in use asks "Replace it";
//      older saves in one list only are listed and open that part (message names the missing part); Rename / Duplicate / Delete act
//      on both lists (Delete asks); a refused write to the second list puts the first back; Preliminary sizing's Save button and Ctrl+S
//      (in its frame) are the page's Save; no Delete / drop-down left in either pane; 390 px: no sideways scroll; no console errors.
//   node tests/smoke/sbd-standard-save.mjs [--a origin/main] [--shots <dir>]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('a', 'origin/main'), SHOTS = arg('shots', process.env.SHOTS), FILE = 'Steel Bridge Design.html';
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const ADIR = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(ADIR, '.done'))) { fs.mkdirSync(ADIR, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${ADIR}"`]); fs.writeFileSync(path.join(ADIR, '.done'), sha); }
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; return c; };
const Z = t => String(t).replace(/"(ts|producedAt|seenAt|savedAt|at)":\s*\d+/g, '"$1":0').replace(/\d{1,2}\/\d{1,2}\/\d{4},? \d{1,2}:\d{2}(:\d{2})? ?[AP]M/g, '<time>').replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, '<iso>');

async function run(file) {
  const o = await openPage(file, { vw: 1400, vh: 900, timeout: 120000 });
  await o.p.waitForFunction(() => typeof window.gdIdle === 'function' && typeof plEnsure === 'function', null, { timeout: 120000 });
  await o.p.evaluate(() => { plEnsure(); return window.gdIdle({ quiet: 4000 }); });
  await o.p.evaluate(() => { window.__dl = []; const c = URL.createObjectURL; URL.createObjectURL = b => { if (b instanceof Blob) b.text().then(t => window.__dl.push(t)); return c.call(URL, b); }; });
  return o;
}
async function state(p) {
  await p.evaluate(() => window.gdIdle({ quiet: 4000 }));
  const ls = await p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)])));
  const n = await p.evaluate(() => window.__dl.length); await p.evaluate(() => document.getElementById('pb_export').click());
  await p.waitForFunction(n => window.__dl.length > n, n); const exp = await p.evaluate(() => window.__dl.at(-1));
  const rpt = await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = buildCalcReport({ ...crOpts(), inputs: true, combos: true, cap: true, stress: true, checks: true, summary: true, drawings: true, manual: false, detail: 'full' }); return d.textContent.replace(/\s+/g, ' '); });
  const text = await p.evaluate(() => { const c = document.body.cloneNode(true); c.querySelectorAll('[data-sp],script,style,#sec-pm,dialog,header,#gd-top').forEach(x => x.remove()); return c.innerText.replace(/Save and open|Saved projects/g, '<pm>').replace(/\s+/g, ' '); });
  // GDHD (2026-11-06): the header and the top bar were rearranged (controls moved, not changed): compared as the set of their controls' ids
  const ctl = await p.evaluate(() => [...document.querySelectorAll('header [id], #gd-top [id]')].filter(e => !e.closest('[data-sp]') && !/^gd-(undo|redo|acts|own-pill)$/.test(e.id)).map(e => e.id).sort().join(' '));
  return { ls: Object.fromEntries(Object.entries(ls).map(([k, v]) => [k, Z(v)])), exp: Z(exp), rpt: Z(rpt), text: Z(text), ctl };
}
const same = (a, b, m) => { const bad = Object.keys(a).filter(k => JSON.stringify(a[k]) !== JSON.stringify(b[k])); ok(!bad.length, m + (bad.length ? ': differ in ' + bad.join(', ') : ''));
  for (const k of bad) { if (k === 'ls') console.log('       keys A: ' + Object.keys(a.ls).join(', ') + '\n       keys B: ' + Object.keys(b.ls).join(', ') + '\n       ' + JSON.stringify(diff(a.ls, b.ls).slice(0, 3)).slice(0, 600));
    else { const x = a[k], y = b[k]; let i = 0; while (i < x.length && x[i] === y[i]) i++; console.log(`       ${k} A: …${x.slice(Math.max(0, i - 80), i + 120)}\n       ${k} B: …${y.slice(Math.max(0, i - 80), i + 120)}`); } } };

console.log(`sbd-standard-save: ${FILE}  A = ${REF} (${sha})  B = working tree`);
const [A, B] = await Promise.all([run(path.join(ADIR, FILE)), run(path.join(REPO, FILE))]);
const a0 = await state(A.p), b0 = await state(B.p); same(a0, b0, 'on load: localStorage (every key), Export JSON, report, page text identical');
// an input change in Preliminary sizing (the view open on load): its first visible number input + 1, with input and change events
const plFrame = async p => { for (const f of p.frames()) { if (f === p.mainFrame()) continue; try { if (await f.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return f; } catch (e) { } } return null; };
const bump = async p => { const f = await plFrame(p);
  const id = await f.evaluate(() => { const i = [...document.querySelectorAll('input[type=number][data-k]')].find(x => x.value !== '' && !x.disabled); i.value = String((+i.value || 0) + 1); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return i.id || i.dataset.k || i.name; });
  await p.waitForTimeout(1500); return id; };
await bump(A.p); await bump(B.p); await A.p.waitForTimeout(1500); await B.p.waitForTimeout(1500);
const a1 = await state(A.p), b1 = await state(B.p); same(a1, b1, 'after an input change: identical');
ok(a1.ls.plateline_autosave_v1 !== a0.ls.plateline_autosave_v1, 'the input change is real (the autosave changed)');
const aErr = A.errs.slice(); await A.b.close();

// ---------- B: the standard save ----------
const p = B.p; let PLF = await plFrame(p); const plf = () => PLF;
const lists = () => p.evaluate(() => ({ gd: JSON.parse(localStorage.getItem('girderdetail_projects_v1') || '{}'), pl: JSON.parse(localStorage.getItem('plateline_projects_v1') || '{}') }));
const names = async () => { const l = await lists(); return Object.keys(l.gd).join('|') + ' / ' + Object.keys(l.pl).join('|'); };
const chip = () => p.evaluate(() => { GD_PB.refresh(); return document.querySelector('[data-sp=chip]').innerText.replace(/\s+/g, ' '); });
const saveAs = async (n, replace) => { await p.evaluate(() => GD_PB.saveAs()); await p.fill('dialog.spSave .spName', n); await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click());
  if (replace) { ok(/already exists/.test(await p.$eval('dialog.spSave .spMsg', e => e.innerText)), `Save as "${n}" (in use): "Replace it" asked`); await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click()); } await p.waitForTimeout(800); };
const lib = async () => { await p.evaluate(() => { const d = document.getElementById('gdLibDlg'); if (d && d.open) d.close(); document.querySelector('[data-sp=hlib]').click(); }); await p.waitForTimeout(400); };
const row = (n, a) => p.evaluate(([n, a]) => document.querySelector(`#gdLibDlg [data-spa=${a}][data-n="${CSS.escape(encodeURIComponent(n))}"]`).click(), [n, a]);
const live = async () => ({ gd: await p.evaluate(() => JSON.stringify(P)), pl: await (plf()).evaluate(() => JSON.stringify(P)) });

ok(await p.evaluate(() => [...document.getElementById('gd-hdr-proj').children].map(b => b.dataset.sp || b.id).join('|')) === 'chip|gd-undo|gd-redo|hsave|hlib|btn-print', 'header: chip · Undo · Redo · Save · Saved projects… · Print');
// GDHD (2026-11-06): the header on one row at common laptop widths; the moved controls in the top bar
for (const w of [1280, 1400, 1920]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(400);
  const h = await p.evaluate(() => { const r = document.querySelector('header').getBoundingClientRect(), t = [...document.querySelectorAll('header .brand, header .hdr-group > *')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()); return { h: Math.round(r.height), one: t.every(x => x.top < r.top + r.height / 2 && x.bottom > r.top + r.height / 2) }; });
  ok(h.one && h.h <= 64, `${w} px: header on one row (${h.h} px)`); if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbd-hdr-${w}.png`), clip: { x: 0, y: 0, width: w, height: 240 } }); }
await p.setViewportSize({ width: 1400, height: 900 });
ok(await p.evaluate(() => ['btn-designall', 'btn-grpt', 'btn-v3dbr', 'btn-dxf'].every(i => document.getElementById(i).closest('#gd-acts')) && !!document.querySelector('#gd-top #gd-owner') && !!document.querySelector('#gd-top #own-info')), 'top bar: Design all · Girder report · 3D view · Export DXF; Owner next to the title block');
ok(await p.evaluate(async () => { document.getElementById('btn-print').click();   // the open view's report dialog (Preliminary sizing's, in its frame, on load)
  const d = P.mod === 'pl' ? PL_FRAME.contentDocument : document, a = !d.getElementById('rpt-modal').hidden; d.getElementById('rpt-cancel').click();
  document.getElementById('own-info').click(); await new Promise(r => setTimeout(r, 100)); const b = !document.getElementById('own-modal').hidden; document.getElementById('own-close').click(); return a && b; }), 'Print opens the report dialog; Owner "rules" opens the owner rules (handlers kept)');
ok(await p.evaluate(() => document.querySelector('#sec-pm').firstElementChild.id === 'gd-savecard' && !!document.querySelector('#gd-savecard [data-sp=card]')), 'modules\' Project tab: the "Save and open" card first');
ok(await p.evaluate(() => !document.getElementById('proj_list') && !document.getElementById('pb_delete') && !document.getElementById('pb_open')), 'modules\' pane: no drop-down, Open or Delete left');
ok(await plf().evaluate(() => !document.getElementById('proj_list') && !document.getElementById('pb_delete') && !!document.getElementById('pb_lib')), 'Preliminary sizing pane: no drop-down or Delete; Save · Save as… · Saved projects…');
await p.evaluate(() => document.querySelector('[data-sp=hsave]').click()); await p.waitForSelector('dialog.spSave[open]');
ok(true, 'Save with no saved name: the Save as dialog'); await p.evaluate(() => document.querySelector('dialog.spSave').close());
await saveAs('Job 1');
let L = await lists(), V = await live();
ok(Object.keys(L.gd).join() === 'Job 1' && Object.keys(L.pl).join() === 'Job 1', 'Save as "Job 1": both lists hold "Job 1"');
ok(JSON.stringify(L.gd['Job 1']) === V.gd && JSON.stringify(L.pl['Job 1']) === V.pl, 'each list item = that part\'s P (as its own Save wrote it)');
ok(/Job 1 · saved/.test(await chip()), 'chip: Job 1 · saved');
ok(await plf().evaluate(() => CUR_NAME) === 'Job 1', 'Preliminary sizing\'s open name follows (its autosave keeps it)');
await bump(p); await p.evaluate(() => window.gdIdle({ quiet: 3000 })); ok(/unsaved changes/.test(await chip()), 'an input change: unsaved changes');
const nd = B.dialogs.length; await p.evaluate(() => document.querySelector('[data-sp=hsave]').click()); await p.waitForTimeout(800);
L = await lists(); V = await live(); ok(B.dialogs.length === nd && !(await p.evaluate(() => !!document.querySelector('dialog[open]'))) && JSON.stringify(L.gd['Job 1']) === V.gd, 'Save on the open name: no question, the list updated');
// Preliminary sizing changes: its Save button (in its frame) and Ctrl+S there save both
await plf().evaluate(() => { P.meta.name = 'PL renamed'; autosave(); });
await plf().evaluate(() => document.getElementById('pb_save').click()); await p.waitForTimeout(800);
ok((await lists()).pl['Job 1'].meta.name === 'PL renamed', 'Preliminary sizing\'s Save button: the page\'s Save (both parts under "Job 1")');
await plf().evaluate(() => { P.meta.name = 'PL ctrl s'; autosave(); }); await p.locator('#pl-frame').evaluate(f => f.contentWindow.focus());
await plf().evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true }))); await p.waitForTimeout(800);
ok((await lists()).pl['Job 1'].meta.name === 'PL ctrl s', 'Ctrl+S in Preliminary sizing: the page\'s Save');
await saveAs('Job 2'); await saveAs('Job 1', true); ok(await names() === 'Job 1|Job 2 / Job 1|Job 2', 'Save as a name in use: Replace it (no duplicate names)');
// older saves in one list only
await p.evaluate(() => { const g = JSON.parse(localStorage.girderdetail_projects_v1), l = JSON.parse(localStorage.plateline_projects_v1);
  g['Old modules'] = JSON.parse(JSON.stringify(g['Job 2'])); g['Old modules'].meta.subject = 'old modules'; l['Old sizing'] = JSON.parse(JSON.stringify(l['Job 2'])); l['Old sizing'].meta.name = 'old sizing';
  localStorage.girderdetail_projects_v1 = JSON.stringify(g); localStorage.plateline_projects_v1 = JSON.stringify(l); });
await lib(); const rows = await p.$$eval('#gdLibDlg tbody tr td:first-child', r => r.map(x => x.innerText.replace(/\s*\(open now\)/, '').trim()));
ok(rows.join('|') === 'Job 1|Job 2|Old modules|Old sizing', 'Saved projects…: the names of both lists (' + rows.join(' | ') + ')');
await row('Old sizing', 'open'); await p.waitForTimeout(1200);
ok(await plf().evaluate(() => P.meta.name) === 'old sizing' && await p.evaluate(() => CUR) === 'Old sizing', 'open a Preliminary-sizing-only save: that part loaded, the name open');
ok(/no saved part for the modules/.test(await p.evaluate(() => document.getElementById('proj_msg').textContent)) && /no saved part for the modules/.test(await plf().evaluate(() => document.getElementById('proj_msg').textContent)), 'the message names the missing part (both panes)');
await lib(); await row('Old modules', 'open'); await p.waitForTimeout(2500);
ok(await p.evaluate(() => P.meta.subject) === 'old modules' && await plf().evaluate(() => CUR_NAME) === 'Old modules', 'open a modules-only save: that part loaded; Preliminary sizing keeps its inputs, its name follows');
// rename / duplicate / delete: both lists
const g2 = JSON.stringify((await lists()).gd['Job 2']), p2 = JSON.stringify((await lists()).pl['Job 2']);
await lib(); B.dialogs.length = 0; await p.evaluate(() => { window.__pr = window.prompt; window.prompt = () => 'Job 2b'; }); await row('Job 2', 'rename'); await p.waitForTimeout(600);
L = await lists(); ok(JSON.stringify(L.gd['Job 2b']) === g2 && JSON.stringify(L.pl['Job 2b']) === p2 && !L.gd['Job 2'] && !L.pl['Job 2'], 'Rename: both items moved unchanged');
ok(Object.keys(L.gd).join('|') === 'Job 1|Job 2b|Old modules', 'Rename keeps the item\'s place in the list');
await p.evaluate(() => { window.prompt = window.__pr; }); await lib(); await row('Job 2b', 'dup'); await p.waitForTimeout(600);   // the name asked: accepted as offered
L = await lists(); ok(JSON.stringify(L.gd['Job 2b (copy)']) === g2 && JSON.stringify(L.pl['Job 2b (copy)']) === p2, 'Duplicate: both parts copied');
await lib(); await row('Job 2b (copy)', 'del'); await p.waitForTimeout(600);
L = await lists(); ok(B.dialogs.some(m => /Delete/.test(m)) && !L.gd['Job 2b (copy)'] && !L.pl['Job 2b (copy)'], 'Delete (asks): both parts removed');
// a refused write to the second list: the first is put back
const before = await p.evaluate(() => [localStorage.getItem('girderdetail_projects_v1'), localStorage.getItem('plateline_projects_v1')]);
await p.evaluate(() => { window.__set = Storage.prototype.setItem; Storage.prototype.setItem = function (k, v) { if (k === 'plateline_projects_v1') throw new DOMException('quota', 'QuotaExceededError'); return window.__set.call(this, k, v); }; });
await p.evaluate(() => { const d = document.getElementById('gdLibDlg'); if (d.open) d.close(); }); B.dialogs.length = 0; await saveAs('Quota');
await p.evaluate(() => { Storage.prototype.setItem = window.__set; });
const after = await p.evaluate(() => [localStorage.getItem('girderdetail_projects_v1'), localStorage.getItem('plateline_projects_v1')]);
ok(JSON.stringify(after) === JSON.stringify(before) && B.dialogs.some(m => /storage is full/i.test(m)), 'refused write: message shown, both lists as they were');
const keys = await p.evaluate(() => Object.keys(localStorage).sort().join(', '));
ok(!/projectsUI|githubSync/.test(keys), 'no new storage key with sync off (' + keys + ')');
if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await lib(); await p.screenshot({ path: path.join(SHOTS, 'sbd-dialog.png') }); await p.evaluate(() => document.getElementById('gdLibDlg').close()); }
await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(600); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390 px: no sideways scroll');
if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'sbd-390.png') });
const extra = B.errs.filter(e => !aErr.includes(e)); ok(!extra.length, "no console errors beyond main's" + (extra.length ? ': ' + extra.join(' | ') : ''));
await B.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
