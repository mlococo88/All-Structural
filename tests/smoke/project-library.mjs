#!/usr/bin/env node
// Saved-project list and Undo / Redo added to a tool with shared/projects.js + shared/projects-ui.js (PLIB, 2026-11-02).
// One tool per run (TOOLS below). For that tool:
//   A = a git ref (default origin/main, the whole tree extracted so shared/ is there), B = the working tree.
//   1. results identical A vs B: on load, after an input change (the tool's own input, change event), and B opened on A's autosave
//      and A's saved-project list (old data opens as before; the list item A saved opens in B with the same results);
//   2. B only: Undo returns the results before the change, Redo the results after it; Ctrl+Z / Ctrl+Y; tab / view changes add no step;
//   3. B only: Saved projects dialog: Rename (item byte-identical under the new name), Duplicate, Delete, Open; other keys unchanged;
//      a refused write (setItem patched to throw QuotaExceededError) shows the message and leaves storage byte-identical;
//   4. console errors: none in B beyond those A also has.
//   node tests/smoke/project-library.mjs --tool asce7 [--a origin/main] [--shots <dir>]
// Results are read with the tool's `results` function (computed objects and/or the result panel text with every [data-sp] element removed).
import fs from 'fs';
import os from 'os';
import path from 'path';
import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const SHOTS = arg('shots', process.env.SHOTS);
let A = null;
const REF = arg('a', 'origin/main');

// Each tool: file, list key and autosave key (the tool's own, unchanged), ready (page is computed), results (what must not change),
// change (one real input change through the page), view (a view-only change: no undo step), save (the tool's own Save path, name).
const textOf = sel => `(() => { const r = document.querySelector(${JSON.stringify(sel)}); if (!r) return ''; const c = r.cloneNode(true); c.querySelectorAll('[data-sp]').forEach(e => e.remove()); return c.innerText.replace(/[ \\t]+/g, ' '); })()`;
// bump(p, sel, d): the first matching input (hidden panes too) + d, with input and change events, as typing does
const bump = async (p, sel, d) => { const r = await p.evaluate(([sel, d]) => { const i = document.querySelector(sel); if (!i) return null; i.value = String((Number(i.value) || 0) + d); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); return i.id || i.name || sel; }, [sel, d]); if (r == null) throw new Error('no input ' + sel); await p.waitForTimeout(900); return r; };
// tabView(p, sel, n): click tab n of the tab bar `sel`; returns a function that clicks the tab that was on before
const tabView = async (p, sel, n, onSel) => { const was = await p.evaluate(([sel, on]) => [...document.querySelectorAll(sel)].findIndex(b => b.matches(on)), [sel, onSel]);
  await p.evaluate(([sel, n]) => document.querySelectorAll(sel)[n].click(), [sel, n]); await p.waitForTimeout(600);
  return async () => { await p.evaluate(([sel, n]) => document.querySelectorAll(sel)[n].click(), [sel, Math.max(0, was)]); await p.waitForTimeout(600); }; };
export const TOOLS = {
  spreadfooting: {
    file: 'Spread Footing.html', list: 'sfd_projects', auto: 'sfd_auto', ownUndo: true,   // the tool's own Undo / Redo (U-2) is unchanged and not re-tested here
    ready: p => p.waitForFunction(() => typeof R !== 'undefined' && R),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(R, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#inputPanel input[type=number][data-path]', 0.5),
    save: async (p, name) => { await p.evaluate(n => { document.getElementById('projName').value = n; document.getElementById('btnSaveProj').click(); }, name); await p.waitForTimeout(300); }
  },
  baseplate: {
    file: 'BasePlateAnchorDesigner.html', list: 'bpad_projects_v1', auto: 'bpad_autosave_v1',
    ready: p => p.waitForFunction(() => typeof computeAll === 'function' && document.querySelector('#inputPanel input')),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(computeAll(), (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#inputPanel input[type=number]', 0.5),
    view: p => tabView(p, '#tabBar button, .tabBtn, [data-tab]', 2, '.active, [aria-selected=true]'),
    save: async (p, name) => { await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('btnSaveAs').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(300); }
  },
  retwall: {
    file: 'Retaining Wall Designer.html', list: 'retaincalcpro.projects.v1', auto: 'retaincalcpro.autosave.v1',
    ready: p => p.waitForFunction(() => window._R),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window._R, (k, v) => typeof v === 'function' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#H, .sidebar input[type=number]', 1),
    view: p => tabView(p, '.tab-btn', 2, '.active'),
    save: async (p, name) => { await p.evaluate(n => { const pn = document.getElementById('proj_name'); pn.value = n; document.getElementById('proj_save_btn').click(); }, name); await p.waitForTimeout(300); }
  },
  gusset: {
    file: 'Gusset Plate Rating.html', list: 'gussetRating.projects.v1', auto: 'gussetRating.autosave.v1',
    ready: p => p.waitForFunction(() => window.__gprForTest && window.__gprForTest().R),
    results: p => p.evaluate(() => { const t = window.__gprForTest(); const seen = new WeakSet(); return JSON.parse(JSON.stringify({ R: t.R, minRF: t.minRF }, (k, v) => typeof v === 'function' || k === 'ui' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#sidebar input[type=number][data-k^="plates"], #sidebar input[type=number]', 0.125),
    view: p => tabView(p, 'header ~ * .tab-btn, .tab-btn', 3, '.active'),
    save: async (p, name) => { await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; CUR = ''; try { document.getElementById('pb_saveas').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(300); }
  },
  stonearch: {
    file: 'Stone Masonry Arch Load Rating.html', list: 'stoneArchLR.projects', auto: 'stoneArchLR.autosave',
    ready: p => p.waitForFunction(() => document.querySelector('#outPanel') && document.querySelector('#outPanel').innerText.length > 200),
    results: p => p.evaluate(() => { const seen = new WeakSet(); const M = JSON.parse(JSON.stringify(window.__modelForTest(), (k, v) => typeof v === 'function' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)));
      const sum = document.querySelector('#pane_sum'); return { M, sum: sum ? sum.textContent.replace(/\s+/g, ' ') : '' }; }),
    change: p => bump(p, '#inPanel input[type=number]', 5),
    view: p => tabView(p, '#tabs button', 2, '.on'),
    save: async (p, name) => { await p.evaluate(n => { document.getElementById('projName').value = n; document.getElementById('bSave').click(); }, name); }
  },
  asce7: {
    file: 'ASCE7-16 Load Generator.html', list: 'asce7bldg.projects', auto: 'asce7bldg.autosave',
    ready: p => p.waitForFunction(() => typeof R === 'object' && document.querySelector('#outbody') && document.querySelector('#outbody').innerText.length > 50),
    results: p => p.evaluate(`({ R: JSON.parse(JSON.stringify(R)), out: ${textOf('#outbody')} })`),
    change: async p => { await p.evaluate(() => { const b = [...document.querySelectorAll('#intabs .itab')]; (b[1] || b[0]).click(); });
      await p.waitForTimeout(150); const inp = await p.$('#inpanel input[type=number]:not([disabled])'); const v = Number(await inp.inputValue()) || 0; await inp.fill(String(v + 7)); await inp.dispatchEvent('input'); await inp.dispatchEvent('change'); await p.waitForTimeout(800); },
    view: async p => { const back = await p.evaluate(() => S.tab); await p.evaluate(() => { const b = [...document.querySelectorAll('#tabs > *')]; b[2].click(); }); await p.waitForTimeout(600);
      return async () => { await p.evaluate(t => { S.tab = t; render(); }, back); await p.waitForTimeout(400); }; },
    save: async (p, name) => { await p.evaluate(n => { const b = [...document.querySelectorAll('#intabs .itab')]; b[b.length - 1].click(); }, name); await p.waitForTimeout(150);
      await p.evaluate(n => { const i = document.getElementById('savename'); i.value = n; doSave(); }, name); }
  }
};

const T = TOOLS[arg('tool', 'asce7')]; if (!T) { console.error('unknown --tool; one of ' + Object.keys(TOOLS).join(', ')); process.exit(2); }
// A: the whole tree at REF (the tool loads shared/ by relative path)
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const ADIR = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(ADIR, '.done'))) { fs.mkdirSync(ADIR, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${ADIR}"`]); fs.writeFileSync(path.join(ADIR, '.done'), sha); }
const FA = path.join(ADIR, T.file), FB = path.join(REPO, T.file);
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const ctxOf = ([k, a, b]) => { if (typeof a !== 'string' || typeof b !== 'string') return JSON.stringify([k, a, b]).slice(0, 400); let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return `${k} @${i}: A «${a.slice(Math.max(0, i - 80), i + 120)}» B «${b.slice(Math.max(0, i - 80), i + 120)}»`; };
const same = (a, b, m) => { const d = diff(a, b); ok(!d.length, m + (d.length ? ` (${d.length} differences, first: ${d.slice(0, 2).map(ctxOf).join(' ; ')})` : '')); };
async function run(file, o) {
  const s = await openPage(file, { vw: 1280, vh: 900, ...o });
  s.dl = []; s.reply = []; s.p.removeAllListeners('dialog');
  s.p.on('dialog', async d => { s.dl.push(d.type() + ': ' + d.message().slice(0, 200)); const r = s.reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : d.defaultValue()); });
  await T.ready(s.p); await s.p.waitForTimeout(900); return s;
}
const lsAll = p => p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });

console.log(`project-library: ${T.file}  A = ${REF} (${sha})  B = working tree`);
// ---------- 1. A vs B ----------
A = await run(FA); const B = await run(FB);
const a0 = await T.results(A.p), b0 = await T.results(B.p); same(a0, b0, 'on load: results identical');
await T.change(A.p); await T.change(B.p);
const a1 = await T.results(A.p), b1 = await T.results(B.p); same(a1, b1, 'after an input change: results identical');
ok(JSON.stringify(a1) !== JSON.stringify(a0), 'the input change changes the results (the test change is real)');
await T.save(A.p, 'From main'); await A.p.waitForTimeout(500);
const aLS = await lsAll(A.p); ok(!!aLS[T.list] && !!aLS[T.auto], 'A wrote its autosave and its project list');
const aErr = A.errs.slice(); await A.b.close();
// A and B reopened on A's storage (a reload can differ from the live page in a view detail; both sides reload)
const A2 = await run(FA, { ls: aLS }), a2 = await T.results(A2.p); aErr.push(...A2.errs); await A2.b.close();
const B2 = await run(FB, { ls: aLS });
same(await T.results(B2.p), a2, "B opened on A's autosave: results identical to A reopened on it");
ok(await B2.p.evaluate(k => localStorage.getItem(k), T.list) === aLS[T.list], "A's project list is unchanged after B opens");
// open A's saved item through the dialog after going back to the defaults (undo history)
await B2.p.click('[data-sp] >> text=Saved projects…'); await B2.p.waitForSelector('dialog.spLib[open]');
const rows = await B2.p.$$eval('dialog.spLib tbody tr', r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
ok(rows.length === 1 && /From main/.test(rows[0]), 'the dialog lists the project A saved: ' + rows.join(' | '));
await B2.p.click('dialog.spLib [data-spa=open]'); await B2.p.waitForTimeout(900);
same(await T.results(B2.p), a2, "A's saved project opened from B's dialog: results identical");
B2.errs.length && console.log('  B2 console: ' + B2.errs.join(' | ')); await B2.b.close();

// ---------- 2. Undo / Redo (B) ----------
const p = B.p; const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
await shot('header');
if (!T.ownUndo) {
  const bu = p.locator('[data-sp] >> text=Undo').first(), br = p.locator('[data-sp] >> text=Redo').first();
  ok(!(await bu.isDisabled()), 'Undo is enabled after a change');
  const back = T.view ? await T.view(p) : null;
  await bu.click(); await p.waitForTimeout(900); if (back) await back(); same(await T.results(p), b0, 'Undo: results back to those before the change (a view change was not a step)');
  ok(await bu.isDisabled(), 'Undo disabled at the start of the history');
  await br.click(); await p.waitForTimeout(900); same(await T.results(p), b1, 'Redo: results after the change again');
  await p.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  await p.keyboard.press('Control+z'); await p.waitForTimeout(900); same(await T.results(p), b0, 'Ctrl+Z');
  await p.keyboard.press('Control+y'); await p.waitForTimeout(900); same(await T.results(p), b1, 'Ctrl+Y');
  const autoAfter = await p.evaluate(k => localStorage.getItem(k), T.auto); ok(autoAfter && JSON.stringify(JSON.parse(autoAfter)) !== '{}', 'autosave written after undo / redo');
}
// ---------- 3. dialog (B) ----------
await T.save(p, 'Job 1'); await p.waitForTimeout(400); await T.save(p, 'Job 2'); await p.waitForTimeout(400);
const L0 = await lsAll(p), item = n => JSON.stringify(JSON.parse(L0[T.list])[n]);
await p.click('[data-sp] >> text=Saved projects…'); await p.waitForSelector('dialog.spLib[open]'); await shot('dialog');
const act = async (a, n, reply) => { B.reply = reply; await p.click(`dialog.spLib [data-spa=${a}][data-n="${encodeURIComponent(n)}"]`); await p.waitForTimeout(300); };
await act('rename', 'Job 1', ['Job 1 renamed']);
let L1 = await lsAll(p), M1 = JSON.parse(L1[T.list]);
ok(!('Job 1' in M1) && JSON.stringify(M1['Job 1 renamed']) === item('Job 1'), 'Rename: item moved unchanged');
for (const k of Object.keys(L0)) if (k !== T.list && k !== T.auto) ok(L1[k] === L0[k], 'Rename left ' + k + ' unchanged');
await act('dup', 'Job 2', ['Job 2 copy']); M1 = JSON.parse((await lsAll(p))[T.list]);
ok(JSON.stringify(M1['Job 2 copy']) === item('Job 2') && JSON.stringify(M1['Job 2']) === item('Job 2'), 'Duplicate: copy identical, original kept');
await act('rename', 'Job 2 copy', ['Job 2', true]); M1 = JSON.parse((await lsAll(p))[T.list]);
ok(!('Job 2 copy' in M1) && JSON.stringify(M1['Job 2']) === item('Job 2'), 'Rename onto an existing name asks and replaces');
await act('del', 'Job 2', [false]); ok('Job 2' in JSON.parse((await lsAll(p))[T.list]), 'Delete: Cancel keeps it');
await act('del', 'Job 2', [true]); ok(!('Job 2' in JSON.parse((await lsAll(p))[T.list])), 'Delete: OK removes it');
// quota: every setItem refused
const Lq = await lsAll(p);
await p.evaluate(() => { window.__si = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }; });
await act('dup', 'Job 1 renamed', ['Q']);
const qmsg = await p.$eval('dialog.spLib .spErr', e => e.textContent).catch(() => ''); ok(/storage is full/i.test(qmsg), 'quota: message shown: ' + qmsg.slice(0, 80));
await shot('dialog-quota');
await p.evaluate(() => { Storage.prototype.setItem = window.__si; });
same(await lsAll(p), Lq, 'quota: storage byte-identical');
await act('open', 'Job 1 renamed', []); same(await T.results(p), b1, 'Open from the dialog: results of the saved project');
await p.setViewportSize({ width: 390, height: 800 }); await p.click('[data-sp] >> text=Saved projects…').catch(() => {}); await p.waitForTimeout(300); await shot('dialog-390');
const sw = await p.evaluate(() => document.querySelector('dialog.spLib').scrollWidth <= document.querySelector('dialog.spLib').clientWidth + 1); ok(sw, '390 px: the dialog does not scroll sideways');

// ---------- 4. console ----------
const extra = B.errs.filter(e => !aErr.includes(e)); ok(!extra.length, 'no console errors beyond main\'s' + (extra.length ? ': ' + extra.join(' | ') : ''));
await B.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
