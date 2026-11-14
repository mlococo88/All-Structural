#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/) browser harness B (docs/ps-bridge-plan.md §3 "Tabs and graphics"): the values the new app's result tabs show
// equal the old app's ("Prestressed Bridge Design.html", frozen since PR 2a) computed values for the same inputs. Headless Chromium, file://,
// the CDN libraries from tests/libs (tests/lib.mjs openPage).
//   For each design of tests/engine/psbridge-tab-cases.mjs:
//   1. the new app opens on the project (psb2.project.current); for each tab compared, every engine value it shows (data-ev: the R path, the
//      decimals, a unit divisor) is read with its text, and every worked step with an R path (engine/worked-stress.js paths) is read with its
//      value; the step must be on the tab (#st-<id>);
//   2. the old app opens with the same engine inputs (PSBDesign.inputs(P), stored as its own psbeam.inputs.v1, as the old app saves them);
//      the inputs it loads are compared with them (a difference is reported); computeAll of those inputs is run on the old page (its own
//      Babel-compiled engine) and the value at every path read;
//   3. each shown value must equal the old value: the text = the old value formatted as the tab formats it (÷ divisor, decimals), and the
//      number the new page holds = the old number exactly (Object.is: NaN, ±∞ and −0 kept); each step value = the old value exactly.
//   4. every psbeam.* key seeded in the new app's page is byte-identical after all the designs (the new app reads and writes psb2.* only).
//   Tabs: Losses, Stresses (PR 2c-1), Flexure, Shear (PR 2c-2), End zone & hold-down, Camber & deflection (PR 2d-1), Handling, Deck, Rating (PR 2d-2);
//   the Report (PR 2e, 'rpt'): every number the Report writes (its model's vals: the summary, the project section and each result tab's cards,
//   with their R paths) and every worked step it shows with an R path (the tabs' engine/worked*.js paths) is compared as above; each number
//   must be in the rendered section's text and every step rendered; and the old app's own report (psrModel of the frozen page, its "Design
//   summary" table and key quantities) must show the Report's numbers: each old cell's text = the Report's number in the old report's format
//   (SharedSteps.n at the old report's decimals).
//   2026-11-13 ('own'): the Owner rules input tab's engine values (the owner's material checks in its rules table: value, limit, ratio) are
//   compared as above; the check summary column's PASS / FAIL totals must count every engine check (each in a group; the material limits in
//   "Materials (owner limits)", shown when the design has one) and the Report's §1 the same FAIL rows.
//   2026-11-13 (display): the group renamed "Owner limits" and the RIDOT girder age at continuity (RIDOT 5.6.3.3, continuity on) in it: its
//   Owner rules row (t_d, the minimum, the ratio) compared as above, the chip shown when the design has any of the owner-limit checks, and
//   the Report's §1 row of each in group "Owner limits".
//   node tests/psbridge-compare.mjs [--import] [--tabs loss,str,flex,shear,end,camb,hand,deck,rt,rpt,own] [--case <part of a name>] [--old <file>] [--new <index.html>] [--verbose]
//     --control: changes one shown value by 1e-9 (relative) and one step value before comparing (and, with the Report, one Report value, one
//     Report step value and one number given to the old report's comparison): the run must report each (the harness sees a difference)
//   PR 2f (--import): each design reaches the new app through the real import path ("From the old app", engine/legacy.js, ui/legacy.js) instead
//     of a written psb2 project: the old app's inputs of the design (PSBDesign.inputs of the case) are put where the old app keeps them, in turn
//     (design i mod 4): 0 its design on screen psbeam.inputs.v1 with its bridge model psbeam.bridge.v1 (PBD.migrate + one more stored cell),
//     1 a shared Bridge Suite project (bridgeSuite.v1.projects slices psbeam + psbeamBridge), 2 the older list psbeam.projects.v1, 3 an old
//     Export JSON file (Import JSON, the file picker); the Project tab's list is read, the design chosen and imported (the confirm accepted) and
//     the import summary must say "Results: the same as the old app". The old app then opens with those same old inputs and every shown value
//     and step is compared as above. Every old key put there must be byte-identical after the import, and the imported project's engine
//     inputs must equal the old inputs (but the title block's girder label and the PS-10 box of this app).
//     --control with --import also puts one changed input (f′c + 0.1 ksi) in the first design's old data while the old app computes the
//     unchanged inputs: the run must report differences.
//     PR 3a-4 (PS-17): the import's restore notice must be the expected one (autosave / shared: the one more stored design 'G1/S1x' not
//     restored, not a girder × span cell; older / file: none); PS-22: it must be an inline banner below the tab bar (in the page flow); it is
//     then closed with its Close button.
//   PR 2d-3 (PS-10): the new page's results are computeAll + engine/holddown.js (PSBHoldDown.compute). The values of that addition (paths
//   ps10.* and its check) have no counterpart in the old app: they are compared with hand values worked here from the inputs and the old
//   app's own f_pbt, A_b and w_sw (F_hd = 2 n_h f_pbt A_b sin α, α = atan((y_end − y_mid)/(12 frac L)), W = w_sw (L + 2 e_end/12), limit f W),
//   to 1e-12 (relative) and as shown; every other value is compared with the old app exactly, as before.
//   PS-30 / PS-31 (engineer decisions 2026-11-14): a design on a standard box beam / voided slab of the CTDOT plates (engine/sections.js;
//   the frozen old app has the old, wrong entries): the old app's engine computes the same inputs with the plate's entry put in its GIRDERS
//   under the new name (every other value compared as before), the new page's gross section must be the plate's, and the old app's values
//   with the old entry are logged (before / after). The old page is opened on the inputs with the old library name. --import: the old app's
//   data hold the old name; the import summary must say the results are the same (the import, with the old app's section values) and show
//   the section-corrected alert (#lgSec, old → new name); the imported project's inputs = the case's (the corrected name).
//   PS-34 (2026-11-14): the pier block's family thickness of a NEXT / box / slab (ps34.t, engine/pierblock.js; the old app's t_bf is the
//   I-girder bottom flange) is compared with the thickness worked here from the old app's girder (NEXT h − t_f, box the bottom slab, voided
//   slab (h − D)/2, solid slab h); every other value with the old app, as before.
//   PS-35 (2026-11-14): a box beam / voided slab design gets the type (f) / (g) distribution factors (engine/lldf-fg.js): the old page computes
//   with that module wrapping its own distFactors (the module file added to the old page), so every value downstream is compared as before;
//   the (f) / (g) factors are checked by hand in tests/engine/psbridge-lldf-fg.test.mjs; the old app's type (k) factors logged (before / after).
// Exit code: 0 every value equal, 1 a difference, 2 an error (a page did not load, a console error).
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from './lib.mjs';
import { TAB_CASES } from './engine/psbridge-tab-cases.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const NEW = path.resolve(args.new || path.join(REPO, 'apps/ps-bridge/index.html'));
const OLD = path.resolve(args.old || path.join(REPO, 'Prestressed Bridge Design.html'));
/* the tabs compared and the worked steps each shows (RC.W key of the page) */
const TABS = { loss: 'losses', str: 'stresses', flex: 'flexure', shear: 'shear', end: 'endzone', camb: 'camber', hand: 'handling', deck: 'deck', rt: 'rating' };
const tabs = (args.tabs ? String(args.tabs).split(',') : Object.keys(TABS)).filter(t => TABS[t]);
const REPORT = !args.tabs || String(args.tabs).split(',').includes('rpt');   // PR 2e
const OWN = !args.tabs || String(args.tabs).split(',').includes('own');   // 2026-11-13: the Owner rules table and the check summary column
const IMPORT = !!args.import, IMP_WAYS = ['autosave', 'shared', 'older', 'file'];   // PR 2f
const TMP = IMPORT ? fs.mkdtempSync(path.join(process.env.TMPDIR || '/tmp', 'psb2f-b-')) : '';
let nImp = 0, nImpKeys = 0; const impNotes = [];
const SEED = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72","L":118}', 'psbeam.ui.v1': '{"tab":"losses"}' };
let fails = 0, errors = 0, n29 = 0; const d29 = [];   // PS-29
let nStd = 0; const dStd = [], bad0 = [];   // PS-30 / PS-31
let nFG = 0; const dFG = [];   // PS-35
let total34 = 0;   // PS-34
const log = s => console.log(s);
// reloadKept(p, name, o, wait): reload the new page and check that the keys o the harness just put are in the reloaded page's storage, each
// value as put. 2026-11-13 (PR PS-19): now and then the reloaded page saw a store with none of them (only the seed and psb2.ui: the page's
// browser storage reset, on main too), so the import list had nothing and the harness timed out (PR 3a-4 took it for a missed click and
// repeated the click: removed, that was not the cause). Then the keys are put again and the page reloaded, at most 3 times, said in the log;
// nothing is compared on a page without them.
async function reloadKept(p, name, o, wait) {
  for (let t = 1; ; t++) {
    await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(wait);
    if (await p.evaluate(o => Object.entries(o).every(([k, v]) => localStorage.getItem(k) === v), o)) {
      if (t > 1) log(`note ${name}: the page's storage held the design's keys on reload ${t}`); return; }
    if (t >= 3) throw new Error(`${name}: the reloaded page's storage does not hold the keys put for the design (3 reloads)`);
    await p.evaluate(o => Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, v)), o);
  }
}

// the projects: the new page builds them (PSBModel.defaultProject of the page), from the same TAB_CASES source
const caseSrc = fs.readFileSync(path.join(REPO, 'tests/engine/psbridge-tab-cases.mjs'), 'utf8').replace(/^export const TAB_CASES = /m, 'window.__TAB_CASES = ');
const names = Object.keys(TAB_CASES(() => ({ base: { opt: {}, loads: {}, cont: {}, harp: {}, mat: {}, handling: {}, deck: {} }, spans: {}, xs: {} }))).filter(n => !args.case || n.includes(args.case));

// --import: the harness puts each design's psbeam.inputs.v1 itself (checked per design), so the page is not seeded with one (its init script
// would put the seed back on a reload before the import)
if (IMPORT) delete SEED['psbeam.inputs.v1'];
const nw = await openPage(NEW, { vw: 1400, vh: 1000, ls: SEED });
await nw.p.waitForSelector('#tabBar [data-otab]');
const old = await openPage(OLD, { vw: 1400, vh: 1000, timeout: 120000 });
await old.p.waitForFunction(() => typeof computeAll === 'function', null, { timeout: 120000 });
let total = 0, totalSteps = 0, total10 = 0, totalRpt = 0, totalRptSteps = 0, totalOldRpt = 0;
for (const name of names) {
  // 1. the new app on the project
  let inp, P;
  if (!IMPORT) {
    P = await nw.p.evaluate(([src, nm]) => { eval(src); const P = window.__TAB_CASES(() => window.PSBModel.defaultProject())[nm]; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); return P; }, [caseSrc, name]);
    const pj = await nw.p.evaluate(() => localStorage.getItem('psb2.project.current'));
    await reloadKept(nw.p, name, { 'psb2.project.current': pj }, 300);
    inp = await nw.p.evaluate(() => window.PSBDesign.inputs(window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project));
  } else {
    // PR 2f: the old app's inputs of the design, put where the old app keeps them, imported through the Project tab
    const how = IMP_WAYS[nImp++ % 4], ctl = args.control && nImp === 1;
    const seed = await nw.p.evaluate(([src, nm, how, ctl]) => { eval(src); const P = window.__TAB_CASES(() => window.PSBModel.defaultProject())[nm], inp = window.PSBDesign.inputs(P);
      const saved = JSON.parse(JSON.stringify(inp)); if (ctl) saved.mat.fc = +saved.mat.fc + 0.1;
      const SC = window.PSBSections, leg = SC && SC.STD[saved.girder] ? Object.keys(SC.MAP).find(k => SC.MAP[k] === saved.girder) : null; if (leg) saved.girder = leg;   // PS-31: the old app saved the old library's name
      const br = window.PBD.migrate(saved, 'pl'); br.projId = how === 'shared' ? 'bp_h' : null; br.designs['G1/S1x'] = saved;   // + one more stored design
      const o = {};
      for (let i = localStorage.length - 1; i >= 0; i--) { const k = localStorage.key(i); if (/^(psbeam\.(inputs|bridge|projects)\.v1|bridgeSuite\.)/.test(k)) localStorage.removeItem(k); }
      if (how === 'autosave') { o['psbeam.inputs.v1'] = JSON.stringify(saved); o['psbeam.bridge.v1'] = JSON.stringify(br); }
      if (how === 'shared') { o['bridgeSuite.v1.projects'] = JSON.stringify({ bp_h: { name: nm.slice(0, 40), savedAt: '2026-11-13T12:00:00Z', slices: { psbeam: saved, psbeamBridge: br } } }); o['bridgeSuite.v1.currentProjectId'] = 'bp_h'; }
      if (how === 'older') o['psbeam.projects.v1'] = JSON.stringify({ old1: { name: nm.slice(0, 40), savedAt: '2026-09-01T00:00:00Z', inp: saved } });
      Object.entries(o).forEach(([k, v]) => localStorage.setItem(k, v));
      return { o, inp, file: how === 'file' ? JSON.stringify(saved, null, 1) : null };   // the old Export JSON: JSON.stringify(inp, null, 1)
    }, [caseSrc, name, how, ctl]);
    inp = seed.inp;
    await reloadKept(nw.p, name, seed.o, 200);
    await nw.p.click('#inTabs [data-itab="proj"]');
    if (how === 'file') { const f = path.join(TMP, 'old-export.json'); fs.writeFileSync(f, seed.file); await nw.p.click('[data-lg="file"]').catch(() => {}); await nw.p.setInputFiles('#fImport', f); }
    else { await nw.p.click('[data-lg="scan"]'); const id = { autosave: 'autosave', shared: 'reg:bp_h', older: 'lib:old1' }[how]; await nw.p.check(`input[name="lgPick"][value="${id}"]`); await nw.p.click('[data-lg="imp"]'); }
    await nw.p.waitForSelector('#lgSum', { timeout: 120000 }); await nw.p.waitForTimeout(200);
    const imp = await nw.p.evaluate(o => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = window.PSBDesign.inputs(P), changed = Object.keys(o).filter(k => localStorage.getItem(k) !== o[k]);
      const t = document.getElementById('notices'), tb = document.getElementById('tabBar').getBoundingClientRect();
      const ns = t ? [...t.querySelectorAll('.notice')] : [], below = ns.every(n => getComputedStyle(n).position === 'static' && n.getBoundingClientRect().top >= tb.bottom - 0.5);
      return { res: (document.getElementById('lgRes') || {}).textContent || '', sec: (document.getElementById('lgSec') || {}).textContent || '', i, changed, src: P.legacy && P.legacy.source.key, note: t ? t.textContent : '', place: below ? '' : 'over the tab bar' }; }, seed.o);
    // PR 3a-4 (PS-17): with a bridge model (autosave, shared) the restore notice names the harness's one more stored design 'G1/S1x' as not
    // restored (not a girder × span cell); without one (older, file) no notice. PS-22: the notice is an inline banner below the tab bar (a
    // notice over the tab bar is a difference); it is read, then closed with its Close button.
    const wantNote = how === 'autosave' || how === 'shared' ? "The old bridge model's other designs were not restored: G1/S1x (not a girder × span cell).Close" : '';
    if (imp.place) imp.note += ' [' + imp.place + ']';
    while (await nw.p.isVisible('#notices .nClose')) await nw.p.click('#notices .nClose');
    const strip = x => { const y = JSON.parse(JSON.stringify(x)); delete y.proj; if (y.opt) { delete y.opt.hdCheck; delete y.opt.hdFrac; } return y; };
    impNotes.push({ name, how, sec: imp.sec, ok: /Results: the same as the old app/.test(imp.res), res: imp.res.slice(0, 160), sameInp: JSON.stringify(strip(imp.i)) === JSON.stringify(strip(inp)), changed: imp.changed, ctl, note: imp.note, wantNote });
    nImpKeys += Object.keys(seed.o).length + (how === 'file' ? 1 : 0);
  }
  const shown = [], steps = []; let ps10 = null, k10 = -1, colOwn = null, ps29 = null;
  for (const t of tabs) {
    await nw.p.click(`#tabBar [data-otab="${t}"]`); await nw.p.waitForTimeout(250);
    const r = await nw.p.evaluate(([t, wk]) => {
      const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, inp = window.PSBDesign.inputs(P), R = window.PSBHoldDown.compute(inp);
      const k10 = R.ps10 && !R.ps10.off ? R.checks.findIndex(c => c.n === window.PSBHoldDown.NAME) : -1;
      const at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
      const ev = [...document.querySelectorAll('#out [data-ev]')].map(el => ({ tab: t, path: el.dataset.ev, d: +el.dataset.d, div: el.dataset.div ? +el.dataset.div : 0, text: el.textContent, v: at(R, el.dataset.ev) }));
      const W = (wk === 'losses' || wk === 'stresses' ? window.PSBWorkedStress : wk === 'flexure' || wk === 'shear' ? window.PSBWorkedStrength : wk === 'endzone' || wk === 'camber' ? window.PSBWorkedEnd : wk === 'handling' || wk === 'deck' || wk === 'rating' ? window.PSBWorkedHDR : window.PSBWorked)[wk](inp, R);
      const st = Object.entries(W.paths).map(([id, p]) => { const s = W.steps.find(q => q.id === id); return { tab: t, id, path: p, v: s.value, onTab: !!document.getElementById('st-' + id) }; });
      return { ev, st, err: R.error, k10, ps10: R.ps10 || null };
    }, [t, TABS[t]]);
    if (r.err) { log(`ERROR ${name} / ${t}: the new page's engine: ${r.err}`); errors++; }
    shown.push(...r.ev); steps.push(...r.st); ps10 = r.ps10; k10 = r.k10;
    if (t === 'loss') ps29 = await nw.p.evaluate(() => { const c = document.getElementById('card-gain'), e = c && c.querySelector('[data-ev="fpeGain"]'), n = document.getElementById('gain-ss-note');
      return { gain: e ? e.textContent : null, note: n ? n.textContent : null }; });
  }
  // 2026-11-13: the Owner rules input tab (the owner's material checks: the engine's value, limit and ratio in its rules table) and the check
  // summary column (its PASS / FAIL totals count every engine check of the design, the owner's limits in "Owner limits")
  if (OWN) {
    await nw.p.click('#inTabs [data-itab="own"]'); await nw.p.waitForTimeout(200);
    const r = await nw.p.evaluate(() => {
      const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P)), at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
      const ev = [...document.querySelectorAll('#inPanes [data-pane="own"] [data-ev]')].map(el => ({ tab: 'own', path: el.dataset.ev, d: +el.dataset.d, div: 0, text: el.textContent, v: at(R, el.dataset.ev) }));
      const N = new Set(window.PSBDashUI.GROUPS.flatMap(g => g.checks.map(q => q[0]))), num = s => { const el = document.querySelector('#sbDashHead ' + s); return el ? parseInt(el.textContent, 10) : 0; };
      return { ev, all: R.checks.length, out: R.checks.filter(c => !N.has(c.n)).map(c => c.n), nF: R.checks.filter(c => !c.pass).length, F: num('.sdF'), Pn: num('.sdP'),
        mat: R.checks.filter(c => /^(Girder f′c|Release strength f′ci|Girder age at continuity) \((RIDOT|MassDOT|CTDOT) /.test(c.n)).length, chip: !!document.querySelector('#sbDashCol [data-sdgrp="mat"]') };
    });
    shown.push(...r.ev); colOwn = r;
  }
  // PR 2e: the Report (the model the tab mounted; its numbers in the rendered sections)
  let rpt = null;
  if (REPORT) {
    await nw.p.click('#tabBar [data-otab="rpt"]'); await nw.p.waitForSelector('.rp-doc .rp-step', { timeout: 60000 });
    rpt = await nw.p.evaluate(() => {
      const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, B = window.PSBReportData.compute(P, null), R = B.R, M = window.PSBReportUI.state.M;
      const at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o), paths = Object.assign({}, ...Object.values(B.W).map(w => w.paths || {}));
      const k10 = R.ps10 && !R.ps10.off ? R.checks.findIndex(c => c.n === window.PSBHoldDown.NAME) : -1;
      const secTxt = M.sections.map((s, i) => (document.querySelector(`.rp-doc section[data-rpsec="rp-s${i + 1}"]`) || {}).textContent || '');
      const ev = M.vals.map(v => ({ tab: 'rpt:' + v.sec, path: v.path, d: v.d, div: v.div, text: v.text, v: at(R, v.path), inDom: secTxt[M.sections.findIndex(s => s.id === v.sec)].includes(v.text) }));
      const st = []; M.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => { if (paths[t.id]) st.push({ tab: 'rpt:' + s.id, id: t.id, path: paths[t.id], v: t.value, onTab: true }); }); })));
      const nSteps = M.sections.reduce((a, s) => a + s.subs.reduce((b, q) => b + q.items.filter(i => i.type === 'steps').reduce((c, i) => c + i.steps.length, 0), 0), 0);
      const num = p => { const v = M.vals.find(q => q.sec === 'sum' && q.path === p); return v ? at(R, p) : undefined; };
      const sum = { checks: R.checks.map((c, i) => ({ loc: num(`checks.${i}.loc`), v: num(`checks.${i}.v`), lim: num(`checks.${i}.lim`), r: num(`checks.${i}.r`) })),
        kq: Object.fromEntries(['totalLoss', 'pctLoss', 'fpe', 'dfm', 'dfv', 'fMid.phiMn', 'MuMid', 'cam.rel', 'cam.final', 'L'].map(p => [p, num(p)])) };
      const nF = [...document.querySelectorAll('.rp-doc section[data-rpsec="rp-s1"] table tbody tr')].filter(tr => tr.children[7] && tr.children[7].textContent.trim() === 'FAIL').length;
      const s1 = document.querySelector('.rp-doc section[data-rpsec="rp-s1"]'), ownRows = s1 ? [...s1.querySelectorAll('table tbody tr')].filter(tr => tr.children[0] && tr.children[0].textContent.trim() === 'Owner limits').length : 0;
      return { nF, ownRows, notCol: !!s1 && /Not in the check summary column/.test(s1.textContent), ev, st, nSteps, domSteps: document.querySelectorAll('.rp-doc .rp-step').length, k10, sum, kErr: document.querySelectorAll('.rp-doc .katex-error').length, bad: document.querySelectorAll('.rp-doc .rp-bad').length };
    });
    shown.push(...rpt.ev); steps.push(...rpt.st);
  }
  // PS-30 / PS-31 (engineer decisions 2026-11-14): a standard box beam / voided slab of the CTDOT plates (engine/sections.js) is not in the
  // frozen old app's library (it has the old, wrong entries). The intended difference: the expected values are the old app's own engine with
  // the plate's entry put in its GIRDERS under the new name (computeAll of the same inputs: every other value as before), independent of
  // this app's library module and migration; the new page's gross section must be the plate's A, I, y_b. The old page is opened on the inputs
  // with the old library name of that section (one it knows; else the BT-72), then computes the real inputs. The old app's values with the old
  // entry are logged (before / after).
  const std = await nw.p.evaluate(g => { const S = window.PSBSections; if (!S || !S.STD[g]) return null;
    const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
    return { entry: S.engineOf(S.STD[g]), src: S.STD[g].src, leg: Object.keys(S.MAP).find(k => S.MAP[k] === g) || null, g: { h: R.g.h, A: R.g.A, I: R.g.I, yb: R.g.yb, w: R.g.w } }; }, inp.girder);
  const oldStore = std ? Object.assign({}, inp, { girder: std.leg || 'PCI BT-72' }) : inp;
  // PS-35 (engineer decision 2026-11-14): a box beam / voided slab gets the type (f) / (g) distribution factors (engine/lldf-fg.js, an
  // app-side override of the engine's distFactors). The intended difference: the old app's engine computes the same inputs with its own
  // distFactors wrapped by that module (the module file put in the old page), so every value downstream of DF_M, DF_V is compared as before;
  // the (f) / (g) factors themselves are checked by hand in tests/engine/psbridge-lldf-fg.test.mjs. The old app's own type (k) factors are
  // logged (before / after).
  const fgNew = await nw.p.evaluate(() => { const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = window.PSBHoldDown.compute(window.PSBDesign.inputs(P));
    return R.df && R.df.fg ? { dfm: R.dfm, dfv: R.dfv, type: R.df.fg.type, J: R.df.fg.J, Jsrc: R.df.fg.Jsrc } : null; });
  // 2. the old app on the same inputs
  await old.p.evaluate(i => { localStorage.clear(); localStorage.setItem('psbeam.inputs.v1', JSON.stringify(i)); }, oldStore);
  await old.p.reload(); await old.p.waitForFunction(() => typeof computeAll === 'function', null, { timeout: 120000 }); await old.p.waitForTimeout(1500);
  if (fgNew) await old.p.addScriptTag({ path: path.join(path.dirname(NEW), 'engine/lldf-fg.js') });   // PS-35 (see above)
  const isPS10 = p => /^ps10\./.test(p) || (k10 >= 0 && new RegExp(`^checks\\.${k10}\\.`).test(p));
  // PS-34 (engineer decision 2026-11-14): the pier block's thickness of a NEXT / box / slab (ps34.*, engine/pierblock.js) has no counterpart
  // in the old app (its t_bf is the I-girder bottom flange): compared with the family thickness worked here from the old app's own girder
  // (NEXT h − t_f; box the bottom slab; voided slab (h − D)/2 below the largest void; solid slab h)
  const isPS34 = p => /^ps34\./.test(p);
  const paths = [...new Set(shown.map(q => q.path).concat(steps.map(q => q.path)))].filter(p => !isPS10(p) && !isPS34(p));
  const o = await old.p.evaluate(([i, paths, std, fgNew]) => {
    let loaded = null; try { loaded = JSON.parse(localStorage.getItem('psbeam.inputs.v1')); } catch (e) { /* none */ }
    let before = null;
    if (std) { GIRDERS[i.girder] = std.entry;   // PS-30 / PS-31: the plate's entry (see above)
      if (std.leg) { const Rb = computeAll(Object.assign({}, i, { girder: std.leg })), Ra = computeAll(i), pick = R => ({ h: R.g.h, A: R.g.A, I: R.g.I, yb: R.g.yb, Sb: R.g.Sb, St: R.g.St, phiMn: R.fMid.phiMn / 12, MuMid: R.MuMid / 12,
        checks: R.checks.map(c => [c.n, c.r, c.pass]) }); before = { old: pick(Rb), now: pick(Ra) }; } }
    let fg0 = null; if (fgNew) { const R0 = computeAll(i); fg0 = { dfm: R0.dfm, dfv: R0.dfv }; }   // PS-35: the old app's own type (k) factors (before)
    const R = fgNew ? window.PSBLldfFG.run(i, computeAll) : computeAll(i), at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o), vals = {};
    paths.forEach(p => { vals[p] = at(R, p); });
    // PS-10 hand values (no counterpart in the old app): from the inputs and the old app's f_pbt, A_b, w_sw
    const h = i.harp, L = +i.L, al = Math.atan((+h.yEnd - +h.yMid) / (12 * +h.frac * L)), Fstr = R.fpbt * R.ss.st.Ab * Math.sin(al), Ftot = 2 * +h.n * Fstr, Lg = L + 2 * (+i.opt.endOh || 0) / 12, Wb = R.g.wsw * Lg;
    const f = typeof i.opt.hdFrac === 'number' && i.opt.hdFrac > 0 ? i.opt.hdFrac : 0.75, lim = f * Wb;
    const hand = { alpha: al, Fstr, Ftot, Lg, W: Wb, lim, frac: f, nh: +h.n, slope: Math.tan(al), r: Ftot / lim, loc: R.ss.hp.frac * L, applies: !(R.own && R.own.hd) && i.opt.hdCheck !== false && +h.n > 0 };
    // PR 2e: the old app's own report (psrModel): the "Design summary" table and key quantities, as text
    let orpt = null; try { const M = psrModel(i, R), it = M.sections[0].subs[0].items; orpt = { rows: it[0].rows.map(r => r.cells.map(c => (c && typeof c === 'object' ? c.t : c))), kv: it[1].rows.map(r => [r[0], r[1]]) }; } catch (e) { orpt = { err: String(e && e.message) }; }
    // PS-29: the old Losses tab's displayed "f_pe with permanent gains credited" (f_pe + Δf_p,perm + Δf_pSS, its line ~6663) and the parts
    // of the new value worked here from the old app's components
    const ps29 = { fpe: R.fpe, pc: R.gains.precast, cmp: R.gains.composite, ss: R.gains.deckShr, refd: i.opt.lossMethod === 'refined', oldShown: R.fpeGain + R.gains.deckShr };
    const g = R.g, t34 = g.isNext ? g.h - g.next.ft : g.isBox ? g.box.wall : g.isDeck ? (g.box.voids > 0 ? (g.h - g.box.voidD) / 2 : g.h) : null;   // PS-34
    return { vals, err: R.error, loaded, hand, oldChecks: R.checks.length, orpt, ps29, before, t34, fg0, fg1: R.df && R.df.fg ? { dfm: R.dfm, dfv: R.dfv } : null };
  }, [inp, paths, std, fgNew]);
  if (o.err) { log(`ERROR ${name}: the old app's engine: ${o.err}`); errors++; continue; }
  const same = JSON.stringify(o.loaded) === JSON.stringify(oldStore);
  if (std) { nStd++; const want = { h: std.entry.h, A: std.entry.A, I: std.entry.I, yb: std.entry.yb, w: std.entry.w };
    if (JSON.stringify(std.g) !== JSON.stringify(want)) bad0.push(`PS-30: the new page's gross section ${JSON.stringify(std.g)} vs the plate's ${JSON.stringify(want)} (CTDOT BDM plate ${std.src.plate})`);
    if (o.before) { const b = o.before, f = (v, d) => (+v).toFixed(d); dStd.push(`${name}: ${std.leg} -> ${inp.girder} (plate ${std.src.plate}, PDF p. ${std.src.page}): h ${b.old.h} -> ${b.now.h} in, A ${b.old.A} -> ${b.now.A} in², I ${b.old.I} -> ${b.now.I} in⁴, y_b ${b.old.yb} -> ${b.now.yb} in, S_b ${f(b.old.Sb, 0)} -> ${f(b.now.Sb, 0)} in³, S_t ${f(b.old.St, 0)} -> ${f(b.now.St, 0)} in³, φM_n ${f(b.old.phiMn, 0)} -> ${f(b.now.phiMn, 0)} k-ft (M_u ${f(b.old.MuMid, 0)} -> ${f(b.now.MuMid, 0)}); ratios changed: ${b.old.checks.map((c, j) => [c, b.now.checks[j]]).filter(([c, d]) => d && Math.abs(c[1] - d[1]) > 5e-4).map(([c, d]) => `${c[0]} ${f(c[1], 3)}${c[2] ? '' : ' FAIL'} -> ${f(d[1], 3)}${d[2] ? '' : ' FAIL'}`).join('; ')}`); }
    if (IMPORT && std.leg) { const q = impNotes[impNotes.length - 1];
      if (!/^Section corrected after the import \(PS-31\)/.test(q.sec) || !q.sec.includes(`"${std.leg}" → "${inp.girder}"`)) bad0.push(`PS-31 import (${q.how}): the summary's section-corrected alert "${q.sec.slice(0, 200)}"`); } }
  if (fgNew) { nFG++; const f = (v, d) => (+v).toFixed(d);
    if (!o.fg1 || o.fg1.dfm !== fgNew.dfm || o.fg1.dfv !== fgNew.dfv) bad0.push(`PS-35: the old page with the (f) / (g) module gives DF_M ${o.fg1 && o.fg1.dfm}, DF_V ${o.fg1 && o.fg1.dfv}; the new page ${fgNew.dfm}, ${fgNew.dfv}`);
    dFG.push(`${name}: DF_M ${f(o.fg0.dfm, 4)} -> ${f(fgNew.dfm, 4)}, DF_V ${f(o.fg0.dfv, 4)} -> ${f(fgNew.dfv, 4)} (type (${fgNew.type}), J ${f(fgNew.J, 0)} in⁴ ${fgNew.Jsrc})`); }
  // 3. compare
  const imp = IMPORT ? impNotes[impNotes.length - 1] : null;
  if (args.control && shown.length && steps.length) { shown[0].v *= 1 + 1e-9; steps[0].v = steps[0].v * (1 + 1e-9); }
  if (args.control && rpt) { const a = shown.find(q => /^rpt:/.test(q.tab) && !isPS10(q.path)), b = steps.find(q => /^rpt:/.test(q.tab) && !isPS10(q.path)); if (a) a.v *= 1 + 1e-9; if (b) b.v *= 1 + 1e-9; rpt.sum.kq.fpe += 0.01; }
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const bad = bad0.splice(0), near = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
  // PS-10: applies where the hand rule says so; its values = the hand values
  if (!!(ps10 && !ps10.off) !== o.hand.applies) bad.push(`PS-10: the new app ${ps10 && !ps10.off ? 'checks' : 'does not check'}, the hand rule says ${o.hand.applies ? 'check' : 'no check'}`);
  if (k10 >= 0 && k10 !== o.oldChecks) bad.push(`PS-10 check index ${k10}, the old app has ${o.oldChecks} checks (the addition must come last)`);
  const handOf = p => { const m = /^ps10\.(\w+)$/.exec(p); if (m) return o.hand[m[1]]; if (k10 >= 0 && p === `checks.${k10}.r`) return o.hand.r; if (k10 >= 0 && p === `checks.${k10}.v`) return o.hand.Ftot; if (k10 >= 0 && p === `checks.${k10}.lim`) return o.hand.lim; if (k10 >= 0 && p === `checks.${k10}.loc`) return o.hand.loc; return undefined; };
  let n10 = 0;
  shown.filter(q => isPS10(q.path)).forEach(q => { n10++; const hv = handOf(q.path), want = fx(q.div ? hv / q.div : hv, q.d);
    if (!near(q.v, hv) || q.text !== want) bad.push(`PS-10 ${q.tab} ${q.path}: shown "${q.text}" (${q.v}) vs hand ${hv} -> "${want}"`); });
  steps.filter(q => isPS10(q.path)).forEach(q => { n10++; const hv = handOf(q.path); if (!q.onTab) bad.push(`${q.tab} step ${q.id} not on the tab`); if (!near(q.v, hv)) bad.push(`PS-10 step ${q.id} (${q.path}): ${q.v} vs hand ${hv}`); });
  total10 += n10;
  // PS-29 (engineer decision, 2026-11-14): the one intended difference from the old app's display. The old Losses tab shows f_pe with the
  // permanent gains as f_pe + Δf_p,perm + Δf_pSS (Δf_pSS counted twice in the refined method, credited without a loss term in the
  // approximate one); the new tab shows f_pe + Δf_p,DC1 + Δf_p,SD, computed here independently from the old app's components, and the note
  // states Δf_pSS (refined: already in Δf_pLT, 5.9.3.4.3; approximate: not credited). The engine's fpeGain (compared above) is unchanged.
  if (ps29 && tabs.includes('loss')) { const q = o.ps29, want = q.fpe + q.pc + q.cmp + (args.control ? 0.01 : 0), wantTxt = fx(want, 2);
    n29++; if (ps29.gain !== wantTxt) bad.push(`PS-29 loss: f_pe with the permanent gains shown "${ps29.gain}" vs f_pe + Δf_p,DC1 + Δf_p,SD = ${wantTxt}`);
    if (fx(q.oldShown, 2) !== wantTxt) d29.push(`${name}: old display ${fx(q.oldShown, 2)} (+ Δf_pSS ${fx(q.ss, 2)}) -> new ${wantTxt} ksi`);
    const ssTxt = fx(q.ss, 2) + ' ksi', re = q.refd ? /^Δf.?pSS = .* is already in the long-term loss Δf.?pLT \(refined method, 5\.9\.3\.4\.3/ : /^Δf.?pSS \(.*\) is not credited: the approximate method \(5\.9\.3\.3\)/;
    if (!ps29.note || !ps29.note.includes(ssTxt) || !re.test(ps29.note)) bad.push(`PS-29 loss: the Δf_pSS note "${ps29.note}" (expected ${q.refd ? 'refined' : 'approximate'}, Δf_pSS = ${ssTxt})`); }
  let n34 = 0; shown.filter(q => isPS34(q.path)).forEach(q => { n34++; const want = q.path === 'ps34.t' ? o.t34 : undefined;
    if (q.path !== 'ps34.t' || q.v !== want || q.text !== fx(want, q.d)) bad.push(`PS-34 ${q.tab} ${q.path}: shown "${q.text}" (${q.v}) vs the family thickness ${want}`); });
  steps.filter(q => isPS34(q.path)).forEach(q => bad.push(`PS-34 step ${q.id}: no step expected on ${q.path}`)); total34 += n34;
  shown.filter(q => !isPS10(q.path) && !isPS34(q.path)).forEach(q => { const ov = o.vals[q.path], want = fx(q.div ? ov / q.div : ov, q.d);
    if (typeof ov !== 'number' || q.text !== want || !Object.is(q.v, ov)) bad.push(`${q.tab} ${q.path}: shown "${q.text}" (${q.v}) vs old ${ov} -> "${want}"`); });
  steps.filter(q => !isPS10(q.path) && !isPS34(q.path)).forEach(q => { const ov = o.vals[q.path]; if (!q.onTab) bad.push(`${q.tab} step ${q.id} not on the tab`); if (!Object.is(q.v, ov)) bad.push(`${q.tab} step ${q.id} (${q.path}): ${q.v} vs old ${ov}`); });
  if (colOwn) {
    if (colOwn.out.length) bad.push('check summary column: not in a group: ' + colOwn.out.join('; '));
    if (colOwn.F !== colOwn.nF || colOwn.F + colOwn.Pn !== colOwn.all) bad.push(`check summary column: ${colOwn.F} FAIL + ${colOwn.Pn} PASS, the engine ${colOwn.nF} failing of ${colOwn.all}`);
    if (!!colOwn.mat !== colOwn.chip) bad.push(`Owner limits chip ${colOwn.chip ? 'shown' : 'missing'} with ${colOwn.mat} material checks`);
    if (colOwn.mat && colOwn.ev.length < 3 * colOwn.mat) bad.push(`Owner rules table: ${colOwn.ev.length} values for ${colOwn.mat} owner-limit checks`);
    if (rpt && rpt.ownRows !== colOwn.mat) bad.push(`Report §1: ${rpt.ownRows} rows in group Owner limits, the design has ${colOwn.mat} owner-limit checks`);
    if (rpt && rpt.notCol) bad.push('Report §1: a "not in the check summary column" note');
    if (rpt && rpt.nF !== colOwn.F) bad.push(`Report §1 FAIL rows ${rpt.nF} vs the column's ${colOwn.F}`);
  }
  // PR 2e: the Report rendered (every number in its section, every step, no KaTeX error, no unresolved §) and the old app's report
  let nOld = 0;
  if (rpt) {
    rpt.ev.filter(q => !q.inDom).slice(0, 10).forEach(q => bad.push(`${q.tab} ${q.path}: "${q.text}" not in the rendered section`));
    if (rpt.domSteps !== rpt.nSteps) bad.push(`Report: ${rpt.domSteps} steps rendered of ${rpt.nSteps}`);
    if (rpt.kErr || rpt.bad) bad.push(`Report: ${rpt.kErr} KaTeX errors, ${rpt.bad} unresolved § references`);
    if (o.orpt.err) bad.push('old report (psrModel): ' + o.orpt.err);
    else {
      const cmp = await old.p.evaluate(([orpt, sum, k10]) => {
        const S = window.SharedSteps, N = (x, d) => S.n(x, d), cell = (v, d) => typeof v === 'number' ? (isFinite(v) ? N(v, d) : '∞') : '—', out = [];
        let n = 0;
        orpt.rows.forEach((r, j) => { const c = sum.checks[j]; if (!c || j === k10) { out.push(`old summary row ${j} (${r[0]}): no check ${j} in the Report`); return; }
          [[1, cell(c.loc, 1)], [2, cell(Math.abs(c.v), 2)], [3, cell(Math.abs(c.lim), 2)], [5, N(c.r, 2)]].forEach(([k, want]) => { n++; if (r[k] !== want) out.push(`old summary "${r[0]}" column ${k}: old "${r[k]}" vs the Report's ${want}`); }); });
        const q = sum.kq, KQ = { 'Span L': N(q.L, 2) + ' ft', 'Total loss': N(q.totalLoss, 2) + ' ksi (' + N(q.pctLoss, 1) + '%)', 'Effective prestress f_pe': N(q.fpe, 2) + ' ksi', 'DF_m / DF_v': N(q.dfm, 3) + ' / ' + N(q.dfv, 3),
          'φM_n / M_u at midspan': N(q['fMid.phiMn'] / 12, 0) + ' / ' + N(q.MuMid / 12, 0) + ' kip-ft', 'Camber at release / final': N(q['cam.rel'], 2) + ' / ' + N(q['cam.final'], 2) + ' in' };
        Object.entries(KQ).forEach(([lab, want]) => { const r = orpt.kv.find(z => z[0] === lab); n++; if (!r) out.push(`old key quantity ${lab}: not in the old report`); else if (r[1] !== want) out.push(`old key quantity ${lab}: old "${r[1]}" vs the Report's "${want}"`); });
        return { n, out };
      }, [o.orpt, rpt.sum, k10]);
      nOld = cmp.n; bad.push(...cmp.out);
      if (k10 >= 0 && o.orpt.rows.length !== k10) bad.push(`old summary has ${o.orpt.rows.length} rows, the Report ${k10} + PS-10`);
    }
    totalRpt += rpt.ev.length; totalRptSteps += rpt.st.length; totalOldRpt += nOld;
  }
  total += shown.length; totalSteps += steps.length;
  const per = tabs.map(t => `${t} ${shown.filter(q => q.tab === t).length} values + ${steps.filter(q => q.tab === t).length} steps`).join(', ') + (colOwn ? `, own ${colOwn.ev.length} values (column ${colOwn.F} FAIL + ${colOwn.Pn} PASS)` : '') + (rpt ? `, rpt ${rpt.ev.length} values + ${rpt.st.length} steps (${rpt.nSteps} shown), old report ${nOld} numbers` : '');
  if (imp) { if (!imp.ok) bad.push(`import (${imp.how}): the summary does not say the results are the same: "${imp.res}"`); if (!imp.sameInp) bad.push(`import (${imp.how}): the imported project's engine inputs are not the old inputs`);
    if (imp.changed.length) bad.push(`import (${imp.how}): old keys changed: ${imp.changed.join(', ')}`);
    if (imp.note !== imp.wantNote) bad.push(`import (${imp.how}): the restore notice "${imp.note}", expected "${imp.wantNote}"`); }
  if (bad.length) { fails++; log(`DIFF ${name}: ${bad.length} of ${shown.length + steps.length}`); bad.slice(0, 25).forEach(b => log('    ' + b)); }
  else log(`same ${name}${imp ? ` [imported: ${imp.how}]` : ''}: ${per}${same ? '' : ' (note: the old app changed the stored inputs on load; compared on the new app\'s inputs)'}`);
  if (args.verbose && !same) log('    inputs the old app stored: ' + JSON.stringify(o.loaded).slice(0, 400));
  void P;
}
// 4. the old app's keys in the new app's storage
const ls = await nw.p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
Object.entries(SEED).forEach(([k, v]) => { if (ls[k] !== v) { fails++; log(`DIFF storage: ${k} changed by the new app`); } });   // --import: the harness itself puts each design's old data there (checked per design)
const other = Object.keys(ls).filter(k => !k.startsWith('psb2.') && !(k in SEED) && !(IMPORT && /^(psbeam\.(inputs|bridge|projects)\.v1|bridgeSuite\.v1\.(projects|currentProjectId))$/.test(k)));
if (other.length) { fails++; log('DIFF storage: keys other than psb2.* written: ' + other.join(', ')); }
const cerr = nw.errs.concat(old.errs.filter(e => !/Failed to load resource|deoptimised the styling/.test(e)));
if (cerr.length) { errors++; log('ERROR console: ' + cerr.slice(0, 5).join(' | ')); }
if (total34) log(`PS-34: ${total34} shown values of the pier block's family thickness compared with the thickness worked here from the old app's girder`);
if (nFG) { log(`PS-35: ${nFG} designs on a box beam / voided slab, compared with the old app's engine with its distFactors wrapped by engine/lldf-fg.js (types (f) / (g); intended difference from its type (k) factors; before = the old app's own factors):`); dFG.forEach(t => log('    ' + t)); }
if (nStd) { log(`PS-30 / PS-31: ${nStd} designs with a standard box / voided slab of the CTDOT plates, compared with the old app's engine computing the plate's entry (intended difference from its own wrong table; before = the old app with the old entry):`); dStd.forEach(t => log('    ' + t)); }
if (n29) { log(`PS-29: ${n29} designs, the shown f_pe with the permanent gains = f_pe + Δf_p,DC1 + Δf_p,SD (worked here); intended differences from the old app's display (Δf_pSS no longer added): ${d29.length}`); d29.forEach(t => log('    ' + t)); }
await nw.b.close(); await old.b.close();
if (IMPORT) fs.rmSync(TMP, { recursive: true, force: true });
log(`${names.length} designs${IMPORT ? ` imported through "From the old app" (${IMP_WAYS.map(w => `${w} ${impNotes.filter(q => q.how === w).length}`).join(', ')}; ${nImpKeys} old keys / files, each unchanged; ${impNotes.filter(q => q.ok).length} summaries "the same")` : ''}, tabs ${tabs.join(', ')}${REPORT ? ', rpt' : ''}${OWN ? ', own (the Owner rules table and the check summary column)' : ''}: ${total} shown values and ${totalSteps} step values compared (of them ${total10} PS-10 values with the hand values, the rest with the old app; the Report ${totalRpt} values and ${totalRptSteps} step values, and ${totalOldRpt} numbers of the old app's own report); ${fails} with differences, ${errors} errors`);
process.exit(errors ? 2 : fails ? 1 : 0);
