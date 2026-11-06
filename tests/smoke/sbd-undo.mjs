#!/usr/bin/env node
// Steel Bridge Design.html: page-wide Undo / Redo (GDUR, 2026-11-06). One in-memory history for the modules' inputs (GirderDetail's P)
// and Preliminary sizing (its frame's P), without view state. Checks:
//   header chip · Undo · Redo · Save · Saved projects… · Print (Undo / Redo disabled on load); a Preliminary sizing input change is one step;
//   opening another module and output tab is not a step; a modules' input change is one step; Ctrl+Z (page) and the Undo button put both
//   parts back in order (byte-identical without view state, view kept); Redo re-applies; Ctrl+Z inside Preliminary sizing's frame is the
//   page's Undo; a new change clears Redo; Open of a saved project starts the history again; no storage key added by the history;
//   Preliminary sizing's own "Revert" bar hidden when embedded (plateline_undo_v1 untouched); no console errors.
//   node tests/smoke/sbd-undo.mjs [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS), FILE = path.join(REPO, 'Steel Bridge Design.html');
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; return c; };
console.log('sbd-undo: ' + FILE);
const o = await openPage(FILE, { vw: 1400, vh: 900, timeout: 120000 }), p = o.p;
await p.waitForFunction(() => typeof window.gdIdle === 'function' && typeof plEnsure === 'function' && typeof GD_UNDO === 'object', null, { timeout: 120000 });
await p.evaluate(() => { plEnsure(); return window.gdIdle({ quiet: 4000 }); });
const plFrame = async () => { for (const f of p.frames()) { if (f === p.mainFrame()) continue; try { if (await f.evaluate(() => typeof postBridge === 'function' && typeof AN !== 'undefined')) return f; } catch (e) { } } return null; };
let F = await plFrame();
const keys0 = await p.evaluate(() => Object.keys(localStorage).sort().join(','));
// the parts without view state (as the history compares them; time stamps zeroed)
const parts = async () => ({ gd: await p.evaluate(() => { const o = Object.assign({}, P); delete o.ui; delete o.mod; return JSON.stringify(o).replace(/"ts":\d+/g, '"ts":0'); }),
  pl: await F.evaluate(() => { const o = Object.assign({}, P); delete o.ui; return JSON.stringify(o).replace(/"ts":\d+/g, '"ts":0'); }) });
const sizes = () => p.evaluate(() => GD_UNDO.sizes());
const settled = () => p.waitForFunction(() => GD_UNDO.sizes().pend === 0, null, { timeout: 150000, polling: 250 });
const idle = () => p.evaluate(() => window.gdIdle({ quiet: 3000 }));
const dis = () => p.evaluate(() => [document.getElementById('gd-undo').disabled, document.getElementById('gd-redo').disabled].join(','));

ok(await p.evaluate(() => [...document.getElementById('gd-hdr-proj').children].map(b => b.dataset.sp || b.id).join('|')) === 'chip|gd-undo|gd-redo|btn-print', 'header: chip · Undo · Redo · Print (HDRS #907: Save / Saved projects… in the card only)');
for (const w of [1280, 1400, 1920]) { await p.setViewportSize({ width: w, height: 900 }); await p.waitForTimeout(300);
  const h = await p.evaluate(() => { const r = document.querySelector('header').getBoundingClientRect(), t = [...document.querySelectorAll('header .brand, header .hdr-group > *')].filter(e => e.offsetParent).map(e => e.getBoundingClientRect()); return { h: Math.round(r.height), one: t.every(x => x.top < r.top + r.height / 2 && x.bottom > r.top + r.height / 2) }; });
  ok(h.one && h.h <= 64, `${w} px: header on one row (${h.h} px)`); if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbd-undo-hdr-${w}.png`), clip: { x: 0, y: 0, width: w, height: 240 } }); }
await p.setViewportSize({ width: 1400, height: 900 });
ok(await dis() === 'true,true', 'on load: Undo and Redo disabled (no history)');

// 1. a Preliminary sizing input change (in its frame)
const s0 = await parts();
const plId = await F.evaluate(() => { const i = [...document.querySelectorAll('input[type=number][data-k]')].find(x => x.value !== '' && !x.disabled); i.focus(); i.value = String((+i.value || 0) + 1); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return i.id || i.dataset.k; });
await settled(); await idle(); await settled();
const s1 = await parts(); let z = await sizes();
ok(s1.pl !== s0.pl && z.undo === 1 && z.redo === 0, `Preliminary sizing input ${plId} changed: one step (undo ${z.undo}, redo ${z.redo})`);
ok(await dis() === 'false,true', 'Undo enabled, Redo disabled');

// 2. view changes are not steps: another module, another output tab
await p.evaluate(() => document.getElementById('mtab-splice').click()); await p.waitForTimeout(500);
await p.evaluate(() => { const b = [...document.querySelectorAll('.tab-btn')].find(x => x.dataset.tab === 'checks'); if (b) b.click(); }); await p.waitForTimeout(1500); await settled();
z = await sizes(); ok(z.undo === 1 && await p.evaluate(() => P.mod) === 'splice', 'opening Field splice and its Checks tab: no step');

// 3. a modules' input change (Field splice, sidebar)
const gdId = await p.evaluate(() => { const i = [...document.querySelectorAll('#side input[type=number]')].find(x => x.value !== '' && !x.disabled); i.focus(); i.value = String((+i.value || 0) + 1); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); i.blur(); return i.id; });
await settled(); await idle(); await settled();
const s2 = await parts(); z = await sizes();
ok(s2.gd !== s1.gd && z.undo === 2, `modules' input ${gdId} changed: a second step (undo ${z.undo})`);

// 4. Ctrl+Z on the page: the modules' change undone, view kept
await p.evaluate(() => document.activeElement && document.activeElement.blur()); await p.keyboard.press('Control+z'); await p.waitForTimeout(300); await idle();
let u = await parts(); z = await sizes();
ok(u.gd === s1.gd && u.pl === s1.pl, 'Ctrl+Z: both parts as before the modules\' change');
ok(z.undo === 1 && z.redo === 1 && await p.evaluate(() => P.mod) === 'splice', 'Ctrl+Z: one step back, Redo available, the open module kept');
// 5. Ctrl+Z inside Preliminary sizing's frame (the page's Undo): the Preliminary sizing change undone
await p.evaluate(() => document.getElementById('mtab-pl').click()); await p.waitForTimeout(800); F = await plFrame();
await F.evaluate(() => { document.activeElement && document.activeElement.blur(); document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true, cancelable: true })); });
await p.waitForTimeout(500); await idle();
u = await parts(); z = await sizes();
ok(u.pl === s0.pl, 'Ctrl+Z in Preliminary sizing\'s frame: its input back (page Undo)');
ok(u.gd === s0.gd, 'after the automatic refresh the modules\' part equals the state on load');
ok(z.undo === 0 && z.redo === 2 && await dis() === 'true,false', 'history: undo 0, redo 2; Undo disabled');
// 6. Redo (button) twice
await p.evaluate(() => document.getElementById('gd-redo').click()); await p.waitForTimeout(300); await idle();
u = await parts(); ok(u.pl === s1.pl && u.gd === s1.gd, 'Redo: the Preliminary sizing change again (both parts as after it)');
await p.evaluate(() => document.getElementById('gd-redo').click()); await p.waitForTimeout(300); await idle();
u = await parts(); ok(u.gd === s2.gd && u.pl === s2.pl, 'Redo: the modules\' change again (both parts as after it)');
// 7. Undo button, then a new change clears Redo
await p.evaluate(() => document.getElementById('gd-undo').click()); await p.waitForTimeout(300); await idle();
u = await parts(); ok(u.gd === s1.gd, 'Undo button: the modules\' change undone');
await F.evaluate(() => { const i = [...document.querySelectorAll('input[type=number][data-k]')].find(x => x.value !== '' && !x.disabled); i.value = String((+i.value || 0) + 2); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); });
await settled(); z = await sizes(); ok(z.redo === 0 && z.undo === 2, 'a new change after Undo: Redo cleared');
await idle();
// 8. nothing stored by the history
const keys1 = await p.evaluate(() => Object.keys(localStorage).sort().join(','));
ok(keys1 === keys0, 'no storage key added (' + keys1 + ')');
// 9. Preliminary sizing's own Revert bar: hidden when embedded, the key untouched
const bar = await F.evaluate(() => { localStorage.setItem('plateline_undo_v1', JSON.stringify({ data: P, name: '', what: 'Suggest', ts: Date.now(), state: 'applied' })); renderUndo(); const b = document.getElementById('undo-bar'); const r = { hidden: b.hidden, key: !!localStorage.getItem('plateline_undo_v1') }; localStorage.removeItem('plateline_undo_v1'); renderUndo(); return r; });
ok(bar.hidden && bar.key, 'embedded: Preliminary sizing\'s Revert bar not shown (its key kept as written)');
// 10. Open of a saved project starts the history again
await p.evaluate(() => GD_PB.saveAs()); await p.fill('dialog.spSave .spName', 'Undo test'); await p.evaluate(() => document.querySelector('dialog.spSave [data-sa=ok]').click()); await p.waitForTimeout(800);
await p.evaluate(() => { document.querySelector('#gd-savecard [data-sp=lib]').click(); }); await p.waitForTimeout(400);   // HDRS (#907): the card's Saved projects…
await p.evaluate(() => document.querySelector(`#gdLibDlg [data-spa=open][data-n="${CSS.escape(encodeURIComponent('Undo test'))}"]`).click()); await p.waitForTimeout(800);
await p.evaluate(() => { const d = document.getElementById('gdLibDlg'); if (d && d.open) d.close(); });
z = await sizes(); ok(z.undo === 0 && z.redo === 0, 'Open of a saved project: the history starts again');
if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'sbd-undo-1400.png'), clip: { x: 0, y: 0, width: 1400, height: 300 } });
await p.setViewportSize({ width: 390, height: 800 }); await p.waitForTimeout(600); ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth), '390 px: no sideways scroll');
if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'sbd-undo-390.png') });
ok(o.errs.length === 0, 'no console errors' + (o.errs.length ? ': ' + o.errs.slice(0, 3).join(' | ') : ''));
await o.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
