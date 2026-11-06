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
// A tool entry may name hash (opened as file#hash) and frame (a same-origin iframe that holds the app): the page object the tool
// functions get is then that frame, with the page's own keyboard, screenshot, viewport and dialog handling (added 2026-11-05, RBRT).
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
// stdSave(p, name): Save as through the standard save controls (STDS, shared/projects-ui.js projectBar) when the page has them:
// the Save as dialog, the name, Save (and "Replace it" when the name exists). false when the page has no projectBar (main before
// the tool opted in): the tool entry then uses its old Save path.
export const stdSave = async (p, name) => { const r = await p.evaluate(n => { const pb = window.SharedProjectsUI && SharedProjectsUI.bars && SharedProjectsUI.bars[0]; if (!pb) return false;
  pb.saveAs(); const d = document.querySelector('dialog.spSave[open]'); d.querySelector('.spName').value = n; d.querySelector('[data-sa=ok]').click(); if (d.open) d.querySelector('[data-sa=ok]').click(); return true; }, name);
  if (r) await p.waitForTimeout(300); return r; };
export const TOOLS = {
  lldf: {
    file: 'lldf.html', list: null, auto: 'lldf_autosave_v1', noList: true,
    ready: p => p.waitForFunction(() => window.lldfLast),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window.lldfLast, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#skew', 10),
    save: async () => {}
  },
  bsl: {
    file: 'Bridge Substructure Loading.html', list: 'subloads_projects_v1', auto: 'subloads_v1', newList: true,
    ready: p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(MODEL, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#f_units_1_hp', 2),
    view: p => tabView(p, '#tab-bar .tab-btn', 2, '.active'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { if (window.SLPL) window.SLPL.save(n); }, name); await p.waitForTimeout(300); }
  },
  spc: {
    file: 'Section Property Calculator.html', list: 'spc_projects_v1', auto: 'spc_autosave_v1', ownUndo: true,   // part ids (time-based, new on every load) are not results and are left out
    ready: p => p.waitForFunction(() => window.SPCUI && window.SPCUI.res),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window.SPCUI.res, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)).replace(/\bp[0-9a-z]{9,}\b/g, 'ID')); }),
    change: async p => { await p.evaluate(() => { const m = window.SPCUI.model; m.parts[0].x += 1; }); await p.evaluate(() => { fullRebuild(); }); await p.waitForTimeout(900); },
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { window.SPCUI.model.project.name = n; rebuildInputs(); const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'Save' && x.classList.contains('primary')); b.click(); }, name); await p.waitForTimeout(400); }
  },
  mlg: {
    file: 'Moving Load Generator.html', list: 'movingLoadGen.projects.v1', auto: 'movingLoadGen.autosave.v1', newList: true,
    ready: p => p.waitForFunction(() => typeof RES !== 'undefined' && RES),
    results: async p => { await p.waitForFunction(() => RES && RES.abs, null, { timeout: 20000 }).catch(() => {}); await p.waitForTimeout(300); return p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(RES, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }); },
    change: p => bump(p, 'aside input[type=number]', 5),
    // main has no list: A's "save" writes nothing; B saves through the new list
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { if (window.MLPL) window.MLPL.save(n); }, name); await p.waitForTimeout(300); }   // STDS: the standard Save as (branch), the old Save (main)
  },
  timber: {
    file: 'Timber Beam Check.html', list: 'tbc_projects_v1', auto: 'tbc_autosave_v1',
    ready: p => p.waitForFunction(() => window.TBC && window.TBC.res),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window.TBC.res, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#inputPanel input[type=number], input[type=number]', 2),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { window.TBC.model.project.name = n; const b = [...document.querySelectorAll('button')].find(x => x.textContent === 'Save' && x.closest('[data-secid=inProj], #inProj, section, div')); b.click(); }, name); await p.waitForTimeout(400); }
  },
  lightpole: {
    file: 'Light Pole and Sign Post.html', list: 'lpp_projects_v1', auto: 'lpp_session_v1',
    ready: p => p.waitForFunction(() => typeof LPP_LAST !== 'undefined' && LPP_LAST),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(LPP_LAST, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#V', 10),
    view: p => tabView(p, '#tabBar button', 2, '.active, [aria-selected=true]'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => commitSave(n), name); await p.waitForTimeout(300); }   // STDS: the standard Save as (branch), the old Save (main)
  },
  abutment: {
    file: 'abutment_calculator.html', list: 'abutcalc_v1_projects', auto: 'abutcalc_v1_autosave', openIgnore: ['fingerprint'], undoSel: '#btnUndo', redoSel: '#btnRedo',
    ready: p => p.waitForFunction(() => window.LAST_R),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window.LAST_R, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, 'input[type=number][data-path]', 0.5),
    view: p => tabView(p, '.tab', 2, '.active, .on'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('btnSaveProj').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(300); }   // STDS (2026-11-06): the standard Save as (branch), the old Save Project prompt (main); its own Projects dialog is replaced by the standard one
  },
  edm: {
    file: 'elastomeric_design_module.html', list: 'edm_v1_projects', auto: 'edm_v1_autosave',
    ready: p => p.waitForFunction(() => typeof LAST !== 'undefined' && LAST),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(LAST, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, 'input[type=number][data-path="geom.hri"]', 0.05),
    view: p => tabView(p, '.tab', 2, '.active, .on'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('btnSaveProj').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(300); }   // STDS (2026-11-06): the standard Save as (branch), the old Save Project prompt (main); its own Projects dialog is replaced by the standard one
  },
  steelbeam: {
    file: 'Steel Beam Design - AISC 15th.html', list: 'sbd_projects_v1', auto: 'sbd_autosave_v1', ownUndo: true,
    ready: p => p.waitForFunction(() => typeof AN !== 'undefined' && AN),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify({ AN, DZ }, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '[data-fkey=dsnLcx]', 2),   // not spanL0: see fixlog PLIB open item (span edits ignored after the Validation benchmarks run)
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { S.proj.name = n; const b = [...document.querySelectorAll('#inputPanel button')].find(x => x.textContent === 'Save'); b.click(); }, name); await p.waitForTimeout(400); }
  },
  smd: {
    file: 'Shear and Moment Diagrams.html', list: 'smd_saves_v1', auto: 'smd_auto_v1', ownUndo: true,   // the tool's own Undo / Redo (↩ ↪) is unchanged and not re-tested here
    // the 3-span template gives loads, so the test change (span 1 length + 2) moves the results; the template is picked on both sides before reading
    ready: async p => { await p.waitForFunction(() => typeof tabR !== 'undefined' && document.getElementById('tplSel')); await p.waitForTimeout(800);
      if (!(await p.evaluate(() => loads.length))) { await p.selectOption('#tplSel', '3s'); await p.waitForTimeout(1500); } },
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify({ tabR, nodeR, shD, moD, deD, env, crits, totL }, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#spanTbl input[data-si]', 2),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const i = document.getElementById('projNm'); i.value = n; i.dispatchEvent(new Event('input', { bubbles: true })); document.getElementById('bSv').click(); }, name); await p.waitForTimeout(400); }
  },
  bgeo: {
    // Bridge Geometry: the standard Saved projects dialog since STDS (2026-11-06; was its own library panel). main seeds five example
    // bridges into the library on first open (the branch no longer does), so the dialog checks look at the row of A's project only.
    file: 'Bridge Geometry.html', list: 'bridgeGeomEngine.library.v1', auto: 'bridgeGeomEngine.project.v1',
    ready: p => p.waitForFunction(() => typeof ENG !== 'undefined' && ENG && document.getElementById('pane-output')),
    results: p => p.evaluate(() => { const seen = new WeakSet(); const eng = JSON.parse(JSON.stringify(ENG, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)));
      const t = id => { const k = document.getElementById(id).cloneNode(true); k.querySelectorAll('[data-sp],script,style,.legendbar').forEach(x => x.remove()); return k.textContent.replace(/\s+/g, ' '); };
      return { eng, output: t('pane-output'), seat: t('pane-seat'), bridge: t('pane-bridge') }; }),
    change: p => bump(p, '#spantbl input[data-f="edgeL"]', 2),
    view: p => tabView(p, '.tabbtn', 2, '.active, .on'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('proj_saveas').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(400); },   // STDS (2026-11-06): the standard Save as (branch), Save As New (main)
    // STDS: the standard Saved projects dialog (the library panel is gone); main seeded five example bridges, so B2 (on A's storage) lists them too: only A's row is checked
    dlg: { rows: 'dialog.spLib tbody tr[data-name="From%20main"]', first: 'dialog.spLib [data-spa=open][data-n="From%20main"]' },
    // the heatmap legend (.legendbar: lowest / highest deck elevation) is filled only once the Output tab has been drawn: a view detail, left out
    no390: 'the page has no phone layout: at 390 px it is 1086 px wide on origin/main, and the library panel already scrolls sideways there (395 / 310 px)'
  },
  rebar: {
    // the rebar calculator. Its standalone file was retired 2026-11-05 (RBRT; now a redirect page): the same app (same list key) is
    // tested in the Development & Splice tab of Concrete Beam Capacity, opened as #dev; every call below runs inside that frame.
    file: 'Concrete Beam Capacity.html', hash: '#dev', frame: '#suite-frame-dev', list: 'rebar_aci_projects_v1', auto: 'rcsuite.rebar_autosave_v1',
    ready: p => p.waitForFunction(() => typeof computeFactors === 'function' && (document.getElementById('projSelect') || window.RBPL) && document.getElementById('dashboard').textContent.length > 20),   // STDS: no drop-down on the branch
    results: p => p.evaluate(() => { const inp = readInputs(); const seen = new WeakSet(); const f = JSON.parse(JSON.stringify({ inp, f: computeFactors(inp) }, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)));
      const d = document.getElementById('dashboard').cloneNode(true); d.querySelectorAll('[data-sp]').forEach(x => x.remove()); return { ...f, dash: d.textContent.replace(/\s+/g, ' ') }; }),
    change: p => bump(p, '#fc', 500),
    view: p => tabView(p, '#tabs .tab', 2, '.active'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { document.getElementById('saveName').value = n; saveProject(); }, name); await p.waitForTimeout(400); }   // STDS: the standard Save as (branch), the old Save (main)
  },
  cbc: {
    // Concrete Beam Capacity, Beam Capacity tab (srcdoc frame #suite-frame-capacity of the suite; STDS 2026-11-06): its list rcbeam_v2_projects
    // ({ name: a copy of S + __savedAt }); main: its own Save Project / Open dialog (saveAs(name)), branch: the standard save.
    file: 'Concrete Beam Capacity.html', hash: '#capacity', frame: '#suite-frame-capacity', list: 'rcbeam_v2_projects', auto: 'rcbeam_v2_auto',
    ready: p => p.waitForFunction(() => typeof allChecks === 'function' && typeof CC !== 'undefined' && CC && document.getElementById('tabBar').children.length > 2),
    results: p => p.evaluate(() => { const seen = new WeakSet(); const r = JSON.parse(JSON.stringify({ CC, chk: allChecks() }, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)));
      const d = document.getElementById('cbcDash').cloneNode(true); d.querySelectorAll('[data-sp]').forEach(x => x.remove()); return { ...r, dash: d.textContent.replace(/\s+/g, ' ') }; }),
    change: p => bump(p, '[data-fkey=fc]', 1),
    view: p => tabView(p, '#tabBar button', 2, '.active'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { if (saveAs(n)) { S.proj.name = S.proj.name || n; autosave(); refresh(); } }, name); await p.waitForTimeout(400); }   // STDS: the standard Save as (branch), the old Save (main: projDialogGo)
  },
  asd: {
    // Concrete Beam Capacity, ASD tab (srcdoc frame #suite-frame-asd of the suite; STDS 2026-11-06): its list asd_v1_projects ({ name: { when,
    // data: a copy of S } }); main: its own Save Project prompt and Open dialog, branch: the standard save.
    file: 'Concrete Beam Capacity.html', hash: '#asd', frame: '#suite-frame-asd', list: 'asd_v1_projects', auto: 'asd_v1_auto',
    ready: p => p.waitForFunction(() => typeof CC !== 'undefined' && CC && document.getElementById('tabBar').children.length > 2),
    results: p => p.evaluate(() => { const seen = new WeakSet(); const r = JSON.parse(JSON.stringify({ CC }, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)));
      const d = document.getElementById('asdDash').cloneNode(true); d.querySelectorAll('[data-sp]').forEach(x => x.remove()); return { ...r, dash: d.textContent.replace(/\s+/g, ' ') }; }),
    change: p => bump(p, '[data-fkey=mLl]', 10),
    view: p => tabView(p, '#tabBar button', 2, '.active'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt, al = window.alert; window.prompt = () => n; window.alert = () => {}; try { doSave(); } finally { window.prompt = pr; window.alert = al; } }, name); await p.waitForTimeout(400); }   // STDS: the standard Save as (branch), the old Save Project prompt (main)
  },
  index: {
    // index.html (MCT generator, React, compiled by Babel in the browser): Undo / Redo only. Its named projects are the shared Bridge
    // Projects registry (BridgeProjects), unchanged, so there is no list here. Results: the model (cfg, as autosaved) and the page text.
    file: 'index.html', list: null, auto: 'mct_cfg_v3', noList: true,
    ready: p => p.waitForFunction(() => document.querySelector('button[data-sp]') || document.body.innerText.includes('Download MCT'), null, { timeout: 120000 }),
    // the page text depends on the wizard step shown (a view), so the results are the model and the MCT size line ("N vehicles · M lines")
    results: async p => { await p.waitForTimeout(600); return p.evaluate(() => ({ cfg: JSON.parse(localStorage.getItem('mct_cfg_v3') || 'null'),
      mct: (document.body.innerText.match(/\d+ vehicles?\s*·\s*\d+ lines/) || [''])[0] })); },
    // the Geometry step's first number input (a React input: the value is set through the native setter so React sees the change)
    change: async p => { await p.locator('button', { hasText: 'Geometry' }).first().click(); await p.waitForTimeout(800);
      await p.evaluate(() => { const i = [...document.querySelectorAll('input[type=number]')].find(x => x.offsetParent && x.value !== '' && !x.disabled);
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String((+i.value || 0) + 1)); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }); await p.waitForTimeout(1500); },
    save: async () => {}
  },
  sbapp: {
    // Steel Bridge app (apps/steel-bridge): used by tests/smoke/github-sync-tools.mjs and home-projects.mjs (GHS2, 2026-11-05). Not run by this
    // file (its list is engine/library.js, items by id: tests/smoke/steel-bridge-library.mjs tests it). Results: the project as autosaved
    // (without its name: a GitHub copy carries its own) and the output tab's text; save = the standard Save as (STDS-B, 2026-11-06; a name in
    // use is replaced) on the branch, the old Save as (asks the name) before it.
    file: 'apps/steel-bridge/index.html', list: null, auto: 'sbd2.project.current', noRun: true,
    ready: p => p.waitForFunction(() => (document.getElementById('bSave') || document.querySelector('[data-sp=chip]')) && document.getElementById('out') && document.getElementById('out').innerText.length > 50),
    results: async p => { await p.waitForTimeout(800); return p.evaluate(() => { const q = JSON.parse(localStorage.getItem('sbd2.project.current') || 'null'); const n = q && q.project ? q.project.name : '';
      if (q && q.project) delete q.project.name; return { P: q, out: document.getElementById('out').innerText.split(n || '\u0000').join('NAME') }; }); },
    change: async p => { await p.evaluate(() => { const i = document.querySelector('#inPanes input[type=number]'); i.value = String((+i.value || 0) + 1); i.dispatchEvent(new Event('input', { bubbles: true })); i.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(900); },
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('bSaveAs').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(400); },
    names: p => p.evaluate(() => (JSON.parse(localStorage.getItem('sbd2.lib.index') || '{"items":[]}').items || []).map(i => i.name)),
    // STDS-B: the standard Saved projects dialog (no own ui entry since 2026-11-06)
  },
  pile: {
    // Pile Designer (STDS-P, 2026-11-06): its list is IndexedDB (tests/smoke/pile-library.mjs tests it); used by github-sync-tools.mjs and
    // home-projects.mjs. Results: the autosaved inputs and LPILE import (the GitHub copy carries no title-block change); save = the
    // standard Save as; names: the tool's in-memory copy of the IndexedDB records.
    file: 'Pile Designer.html', list: null, auto: 'micropile_lrfd_inputs_v1', noRun: true,
    errOk: /^Failed to load resource: net::ERR_FAILED$/,   // cdn.tailwindcss.com is not in the test kit (tests/libs): the same error on main
    ready: async p => { await p.waitForFunction(() => document.querySelector('.input-rail input[type=number]') && window.SharedProjectsUI && SharedProjectsUI.bars && SharedProjectsUI.bars[0], null, { timeout: 60000 }); await p.waitForTimeout(800); },
    results: async p => { await p.waitForTimeout(1200); return p.evaluate(() => ({ inputs: JSON.parse(localStorage.getItem('micropile_lrfd_inputs_v1') || 'null'), out: (document.querySelector('main') || document.body).innerText.length > 0 })); },
    change: async p => { await p.evaluate(() => { const i = [...document.querySelectorAll('.input-rail input[type=number]')].find(x => x.offsetParent && x.value !== '') || document.querySelector('.input-rail input[type=number]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, String((+i.value || 0) + 1)); i.dispatchEvent(new Event('input', { bubbles: true })); i.blur(); }); await p.waitForTimeout(1500); },
    save: async (p, name) => { await stdSave(p, name); await p.waitForTimeout(500); },
    names: p => p.evaluate(() => PDLIB.recs().map(r => r.name))
  },
  gd: {
    // Steel Bridge Design.html (GirderDetail): used by tests/smoke/github-sync-tools.mjs and home-projects.mjs (GHS2, 2026-11-05; its
    // shared Saved projects dialog); not run by this file (results: tests/compare.mjs --tool gd). Results after gdIdle: the modules'
    // project P (without ui, ts zeroed) and the open module's checks; save = Save as (asks the name; a name in use asks to overwrite).
    file: 'Steel Bridge Design.html', list: 'girderdetail_projects_v1', auto: 'girderdetail_autosave_v1', noRun: true,
    // STDS-G (2026-11-06): the standard save (one Save writes both girderdetail_projects_v1 and plateline_projects_v1); main: the old pane
    ready: async p => { await p.waitForFunction(() => typeof window.gdIdle === 'function' && (document.getElementById('pb_saveas') || (window.SharedProjectsUI && SharedProjectsUI.bars && SharedProjectsUI.bars[0])), null, { timeout: 120000 }); await p.evaluate(() => window.gdIdle({ quiet: 3000 })); },
    results: async p => { await p.evaluate(() => window.gdIdle({ quiet: 3000 })); return p.evaluate(() => { const q = JSON.parse(JSON.stringify(P)); delete q.ui;
      return JSON.parse(JSON.stringify({ P: q, CK: typeof CK !== 'undefined' && CK ? CK.map(c => [c.id, c.status, c.items.map(i => [i.loc, i.st, i.r != null && isFinite(i.r) ? +i.r : null])]) : null }).replace(/"ts":\d+/g, '"ts":0')); }); },
    change: p => bump(p, 'input[type=number][data-k]', 1),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('pb_saveas').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(400); }   // STDS-G: the standard Save as (branch), the old Save as (main)
  },
  spreadfooting: {
    file: 'Spread Footing.html', list: 'sfd_projects', auto: 'sfd_auto', ownUndo: true,   // the tool's own Undo / Redo (U-2) is unchanged and not re-tested here
    ready: p => p.waitForFunction(() => typeof R !== 'undefined' && R),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(R, (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#inputPanel input[type=number][data-path]', 0.5),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { document.getElementById('projName').value = n; document.getElementById('btnSaveProj').click(); }, name); await p.waitForTimeout(300); }   // STDS: the standard Save as (branch), the old Save (main)
  },
  baseplate: {
    file: 'BasePlateAnchorDesigner.html', list: 'bpad_projects_v1', auto: 'bpad_autosave_v1',
    ready: p => p.waitForFunction(() => typeof computeAll === 'function' && document.querySelector('#inputPanel input')),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(computeAll(), (k, v) => typeof v === 'function' ? undefined : (typeof v === 'number' && !isFinite(v) ? String(v) : v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#inputPanel input[type=number]', 0.5),
    view: p => tabView(p, '#tabBar button, .tabBtn, [data-tab]', 2, '.active, [aria-selected=true]'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; try { document.getElementById('btnSaveAs').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(300); }
  },
  retwall: {
    file: 'Retaining Wall Designer.html', list: 'retaincalcpro.projects.v1', auto: 'retaincalcpro.autosave.v1',
    ready: p => p.waitForFunction(() => window._R),
    results: p => p.evaluate(() => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(window._R, (k, v) => typeof v === 'function' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#H, .sidebar input[type=number]', 1),
    view: p => tabView(p, '.tab-btn', 2, '.active'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pn = document.getElementById('proj_name'); pn.value = n; document.getElementById('proj_save_btn').click(); }, name); await p.waitForTimeout(300); }   // STDS: the standard Save as (branch), the old Save (main)
  },
  gusset: {
    file: 'Gusset Plate Rating.html', list: 'gussetRating.projects.v1', auto: 'gussetRating.autosave.v1',
    ready: p => p.waitForFunction(() => window.__gprForTest && window.__gprForTest().R),
    results: p => p.evaluate(() => { const t = window.__gprForTest(); const seen = new WeakSet(); return JSON.parse(JSON.stringify({ R: t.R, minRF: t.minRF }, (k, v) => typeof v === 'function' || k === 'ui' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v))); }),
    change: p => bump(p, '#sidebar input[type=number][data-k^="plates"], #sidebar input[type=number]', 0.125),
    view: p => tabView(p, 'header ~ * .tab-btn, .tab-btn', 3, '.active'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const pr = window.prompt; window.prompt = () => n; CUR = ''; try { document.getElementById('pb_saveas').click(); } finally { window.prompt = pr; } }, name); await p.waitForTimeout(300); }
  },
  stonearch: {
    file: 'Stone Masonry Arch Load Rating.html', list: 'stoneArchLR.projects', auto: 'stoneArchLR.autosave',
    ready: p => p.waitForFunction(() => document.querySelector('#outPanel') && document.querySelector('#outPanel').innerText.length > 200),
    results: p => p.evaluate(() => { const seen = new WeakSet(); const M = JSON.parse(JSON.stringify(window.__modelForTest(), (k, v) => typeof v === 'function' ? undefined : (v && typeof v === 'object' ? (seen.has(v) ? '[cycle]' : (seen.add(v), v)) : v)));
      const sum = document.querySelector('#pane_sum'); return { M, sum: sum ? sum.textContent.replace(/\s+/g, ' ') : '' }; }),
    change: p => bump(p, '#inPanel input[type=number]', 5),
    view: p => tabView(p, '#tabs button', 2, '.on'),
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { document.getElementById('projName').value = n; document.getElementById('bSave').click(); }, name); }   // STDS: the standard Save as (branch), the old Save (main)
  },
  asce7: {
    file: 'ASCE7-16 Load Generator.html', list: 'asce7bldg.projects', auto: 'asce7bldg.autosave',
    ready: p => p.waitForFunction(() => typeof R === 'object' && document.querySelector('#outbody') && document.querySelector('#outbody').innerText.length > 50),
    results: p => p.evaluate(`({ R: JSON.parse(JSON.stringify(R)), out: ${textOf('#outbody')} })`),
    change: async p => { await p.evaluate(() => { const b = [...document.querySelectorAll('#intabs .itab')]; (b[1] || b[0]).click(); });
      await p.waitForTimeout(150); const inp = await p.$('#inpanel input[type=number]:not([disabled])'); const v = Number(await inp.inputValue()) || 0; await inp.fill(String(v + 7)); await inp.dispatchEvent('input'); await inp.dispatchEvent('change'); await p.waitForTimeout(800); },
    view: async p => { const back = await p.evaluate(() => S.tab); await p.evaluate(() => { const b = [...document.querySelectorAll('#tabs > *')]; b[2].click(); }); await p.waitForTimeout(600);
      return async () => { await p.evaluate(t => { S.tab = t; render(); }, back); await p.waitForTimeout(400); }; },
    save: async (p, name) => { if (await stdSave(p, name)) return; await p.evaluate(n => { const b = [...document.querySelectorAll('#intabs .itab')]; b[b.length - 1].click(); }, name); await p.waitForTimeout(150);
      await p.evaluate(n => { const i = document.getElementById('savename'); i.value = n; doSave(); }, name); }
  }
};

// Imported for TOOLS (tests/smoke/github-sync.mjs, 2026-11-05): the run below happens only when this file is the script run.
if (/project-library\.mjs$/.test(process.argv[1] || '')) await main();
async function main() {
const T = TOOLS[arg('tool', 'asce7')]; if (T && T.noRun) { console.error('this tool is not run by project-library.mjs (see its entry)'); process.exit(2); } if (!T) { console.error('unknown --tool; one of ' + Object.keys(TOOLS).join(', ')); process.exit(2); }
// A: the whole tree at REF (the tool loads shared/ by relative path)
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const ADIR = path.join(os.tmpdir(), 'allstruct-tests', 'tree-' + sha);
if (!fs.existsSync(path.join(ADIR, '.done'))) { fs.mkdirSync(ADIR, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} | tar -x -C "${ADIR}"`]); fs.writeFileSync(path.join(ADIR, '.done'), sha); }
const FA = path.join(ADIR, T.file), FB = path.join(REPO, T.file);
// the list UI: the shared dialog (default) or the tool's own list with the shared rename / duplicate (T.ui)
const UI = Object.assign({ open: async p => { await p.evaluate(() => { const d = document.querySelector('dialog.spLib[open]'); if (d) d.close(); [...document.querySelectorAll('button[data-sp]')].find(b => /^(Saved projects|Projects)…$/.test(b.textContent)).click(); }); await p.waitForSelector('dialog.spLib[open]'); },
  rows: 'dialog.spLib tbody tr', btn: (a, n) => `dialog.spLib [data-spa=${a}][data-n="${encodeURIComponent(n)}"]`, first: 'dialog.spLib [data-spa=open]',
  err: async (p, s) => p.$eval('dialog.spLib .spErr', e => e.textContent).catch(() => ''), box: 'dialog.spLib', delConfirm: true }, T.ui || T.dlg || {});   // T.dlg: the standard dialog, other row selectors
const drop = o => { if (!T.openIgnore) return o; const c = { ...o }; T.openIgnore.forEach(k => delete c[k]); return c; };   // fields the tool's own Save changes (abutment: the save adds a revision to S.meta, so the input fingerprint differs from the autosave's)
let fails = 0; const ok = (c, m) => { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) fails++; };
const ctxOf = ([k, a, b]) => { if (typeof a !== 'string' || typeof b !== 'string') return JSON.stringify([k, a, b]).slice(0, 400); let i = 0; while (i < a.length && a[i] === b[i]) i++;
  return `${k} @${i}: A «${a.slice(Math.max(0, i - 80), i + 120)}» B «${b.slice(Math.max(0, i - 80), i + 120)}»`; };
const same = (a, b, m) => { const d = diff(a, b); ok(!d.length, m + (d.length ? ` (${d.length} differences, first: ${d.slice(0, 2).map(ctxOf).join(' ; ')})` : '')); };
async function run(file, o) {
  const s = await openPage(file, { vw: 1280, vh: 900, hash: T.hash || '', ...o });
  s.dl = []; s.reply = []; s.p.removeAllListeners('dialog');
  s.p.on('dialog', async d => { s.dl.push(d.type() + ': ' + d.message().slice(0, 200)); const r = s.reply.shift(); if (r === false) await d.dismiss(); else await d.accept(typeof r === 'string' ? r : d.defaultValue()); });
  if (T.frame) {   // the app lives in a frame: frame methods first, the page's for the rest (keyboard, screenshot, setViewportSize)
    const page = s.p; await page.waitForSelector(T.frame, { state: 'attached' }); const fr = await (await page.$(T.frame)).contentFrame();
    const via = (o, k) => typeof o[k] === 'function' ? o[k].bind(o) : o[k];
    s.page = page; s.p = new Proxy(fr, { get: (t, k) => k in t ? via(t, k) : via(page, k) });
  }
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
const aLS = await lsAll(A.p); ok((T.newList || T.noList || !!aLS[T.list]) && !!aLS[T.auto], 'A wrote its autosave' + (T.newList ? ' (no project list on main: new in this change)' : ' and its project list'));
const aErr = A.errs.slice(); await A.b.close();
// A and B reopened on A's storage (a reload can differ from the live page in a view detail; both sides reload)
const A2 = await run(FA, { ls: aLS }), a2 = await T.results(A2.p); aErr.push(...A2.errs); await A2.b.close();
const B2 = await run(FB, { ls: aLS });
same(await T.results(B2.p), a2, "B opened on A's autosave: results identical to A reopened on it");
if (!T.newList && !T.noList) {
ok(await B2.p.evaluate(k => localStorage.getItem(k), T.list) === aLS[T.list], "A's project list is unchanged after B opens");
// open A's saved item through the dialog after going back to the defaults (undo history)
await UI.open(B2.p);
const rows = await B2.p.$$eval(UI.rows, r => r.map(x => x.innerText.replace(/\s+/g, ' ')));
ok(rows.length === 1 && /From main/.test(rows[0]), 'the dialog lists the project A saved: ' + rows.join(' | '));
await B2.p.click(UI.first); await B2.p.waitForTimeout(900);
same(drop(await T.results(B2.p)), drop(a2), "A's saved project opened from B's dialog: results identical" + (T.openIgnore ? ' (except ' + T.openIgnore.join(', ') + ')' : ''));
}
B2.errs.length && console.log('  B2 console: ' + B2.errs.join(' | ')); await B2.b.close();

// ---------- 2. Undo / Redo (B) ----------
const p = B.p; const shot = async n => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, n + '.png') }); } };
await shot('header');
if (!T.ownUndo) {
  const bu = T.undoSel ? p.locator(T.undoSel) : p.locator('[data-sp] >> text=Undo').first(), br = T.redoSel ? p.locator(T.redoSel) : p.locator('[data-sp] >> text=Redo').first();
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
if (!T.noList) {
// ---------- 3. dialog (B) ----------
await T.save(p, 'Job 1'); await p.waitForTimeout(400); await T.save(p, 'Job 2'); await p.waitForTimeout(400);
const L0 = await lsAll(p), item = n => JSON.stringify(JSON.parse(L0[T.list])[n]);
await UI.open(p); await shot('dialog');
const act = async (a, n, reply) => { B.reply = reply; await p.click(UI.btn(a, n)); await p.waitForTimeout(300); };
await act('rename', 'Job 1', ['Job 1 renamed']);
let L1 = await lsAll(p), M1 = JSON.parse(L1[T.list]);
// T.renameSets: fields the tool's OWN rename writes into the item (Bridge Geometry: its existing Rename sets the item's "name"); left out of the rename checks
const rn = o => { if (typeof o === 'string') o = JSON.parse(o); if (!T.renameSets || o == null) return JSON.stringify(o); const c = JSON.parse(typeof o === 'string' ? o : JSON.stringify(o)); T.renameSets.forEach(k => delete c[k]); return JSON.stringify(c); };
ok(!('Job 1' in M1) && rn(M1['Job 1 renamed']) === rn(item('Job 1')), 'Rename: item moved unchanged' + (T.renameSets ? ' (except ' + T.renameSets.join(', ') + ', set by the tool\'s own Rename)' : ''));
for (const k of Object.keys(L0)) if (k !== T.list && k !== T.auto && !/^bridgeSuite\.v1\.projectsUI\./.test(k)) ok(L1[k] === L0[k], 'Rename left ' + k + ' unchanged');   // START (2026-11-06): the start chooser's own recent list follows a rename
await act('dup', 'Job 2', ['Job 2 copy']); M1 = JSON.parse((await lsAll(p))[T.list]);
ok(JSON.stringify(M1['Job 2 copy']) === item('Job 2') && JSON.stringify(M1['Job 2']) === item('Job 2'), 'Duplicate: copy identical, original kept');
await act('rename', 'Job 2 copy', ['Job 2', true]); M1 = JSON.parse((await lsAll(p))[T.list]);
ok(!('Job 2 copy' in M1) && rn(M1['Job 2']) === rn(item('Job 2')), 'Rename onto an existing name asks and replaces');
if (UI.delConfirm) { await act('del', 'Job 2', [false]); ok('Job 2' in JSON.parse((await lsAll(p))[T.list]), 'Delete: Cancel keeps it'); }
await act('del', 'Job 2', [true]); ok(!('Job 2' in JSON.parse((await lsAll(p))[T.list])), 'Delete: OK removes it');
// quota: every setItem refused
const Lq = await lsAll(p);
await p.evaluate(() => { window.__si = Storage.prototype.setItem; Storage.prototype.setItem = function () { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; }; });
await act('dup', 'Job 1 renamed', ['Q']);
const qmsg = await UI.err(p, B); ok(/storage is full/i.test(qmsg), 'quota: message shown: ' + qmsg.slice(0, 80));
await shot('dialog-quota');
await p.evaluate(() => { Storage.prototype.setItem = window.__si; });
same(await lsAll(p), Lq, 'quota: storage byte-identical');
await act('open', 'Job 1 renamed', []); same(drop(await T.results(p)), drop(b1), 'Open from the dialog: results of the saved project');
await p.setViewportSize({ width: 390, height: 800 }); await UI.open(p).catch(() => {}); await p.waitForTimeout(300); await shot('dialog-390');
if (T.no390) console.log('  skip 390 px: ' + T.no390);
else { const sw = await p.evaluate(sel => document.querySelector(sel).scrollWidth <= document.querySelector(sel).clientWidth + 1, UI.box); ok(sw, '390 px: the dialog does not scroll sideways'); }

}
// ---------- 4. console ----------
const extra = B.errs.filter(e => !aErr.includes(e)); ok(!extra.length, 'no console errors beyond main\'s' + (extra.length ? ': ' + extra.join(' | ') : ''));
await B.b.close();
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS'); process.exit(fails ? 1 : 0);
}
