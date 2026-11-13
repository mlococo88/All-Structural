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
//     restored, not a girder × span cell; older / file: none); it is then closed (it lies over the tab bar).
//   PR 2d-3 (PS-10): the new page's results are computeAll + engine/holddown.js (PSBHoldDown.compute). The values of that addition (paths
//   ps10.* and its check) have no counterpart in the old app: they are compared with hand values worked here from the inputs and the old
//   app's own f_pbt, A_b and w_sw (F_hd = 2 n_h f_pbt A_b sin α, α = atan((y_end − y_mid)/(12 frac L)), W = w_sw (L + 2 e_end/12), limit f W),
//   to 1e-12 (relative) and as shown; every other value is compared with the old app exactly, as before.
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
let fails = 0, errors = 0;
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
      const t = document.getElementById('toast');
      return { res: (document.getElementById('lgRes') || {}).textContent || '', i, changed, src: P.legacy && P.legacy.source.key, note: t && !t.hidden ? t.textContent : '' }; }, seed.o);
    // PR 3a-4 (PS-17): with a bridge model (autosave, shared) the restore notice names the harness's one more stored design 'G1/S1x' as not
    // restored (not a girder × span cell); without one (older, file) no notice. The notice is read, then closed (it lies over the tab bar).
    const wantNote = how === 'autosave' || how === 'shared' ? "The old bridge model's other designs were not restored: G1/S1x (not a girder × span cell).Close" : '';
    if (imp.note) await nw.p.click('#tClose');
    const strip = x => { const y = JSON.parse(JSON.stringify(x)); delete y.proj; if (y.opt) { delete y.opt.hdCheck; delete y.opt.hdFrac; } return y; };
    impNotes.push({ name, how, ok: /Results: the same as the old app/.test(imp.res), res: imp.res.slice(0, 160), sameInp: JSON.stringify(strip(imp.i)) === JSON.stringify(strip(inp)), changed: imp.changed, ctl, note: imp.note, wantNote });
    nImpKeys += Object.keys(seed.o).length + (how === 'file' ? 1 : 0);
  }
  const shown = [], steps = []; let ps10 = null, k10 = -1, colOwn = null;
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
  // 2. the old app on the same inputs
  await old.p.evaluate(i => { localStorage.clear(); localStorage.setItem('psbeam.inputs.v1', JSON.stringify(i)); }, inp);
  await old.p.reload(); await old.p.waitForFunction(() => typeof computeAll === 'function', null, { timeout: 120000 }); await old.p.waitForTimeout(1500);
  const isPS10 = p => /^ps10\./.test(p) || (k10 >= 0 && new RegExp(`^checks\\.${k10}\\.`).test(p));
  const paths = [...new Set(shown.map(q => q.path).concat(steps.map(q => q.path)))].filter(p => !isPS10(p));
  const o = await old.p.evaluate(([i, paths]) => {
    let loaded = null; try { loaded = JSON.parse(localStorage.getItem('psbeam.inputs.v1')); } catch (e) { /* none */ }
    const R = computeAll(i), at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o), vals = {};
    paths.forEach(p => { vals[p] = at(R, p); });
    // PS-10 hand values (no counterpart in the old app): from the inputs and the old app's f_pbt, A_b, w_sw
    const h = i.harp, L = +i.L, al = Math.atan((+h.yEnd - +h.yMid) / (12 * +h.frac * L)), Fstr = R.fpbt * R.ss.st.Ab * Math.sin(al), Ftot = 2 * +h.n * Fstr, Lg = L + 2 * (+i.opt.endOh || 0) / 12, Wb = R.g.wsw * Lg;
    const f = typeof i.opt.hdFrac === 'number' && i.opt.hdFrac > 0 ? i.opt.hdFrac : 0.75, lim = f * Wb;
    const hand = { alpha: al, Fstr, Ftot, Lg, W: Wb, lim, frac: f, nh: +h.n, slope: Math.tan(al), r: Ftot / lim, loc: R.ss.hp.frac * L, applies: !(R.own && R.own.hd) && i.opt.hdCheck !== false && +h.n > 0 };
    // PR 2e: the old app's own report (psrModel): the "Design summary" table and key quantities, as text
    let orpt = null; try { const M = psrModel(i, R), it = M.sections[0].subs[0].items; orpt = { rows: it[0].rows.map(r => r.cells.map(c => (c && typeof c === 'object' ? c.t : c))), kv: it[1].rows.map(r => [r[0], r[1]]) }; } catch (e) { orpt = { err: String(e && e.message) }; }
    return { vals, err: R.error, loaded, hand, oldChecks: R.checks.length, orpt };
  }, [inp, paths]);
  if (o.err) { log(`ERROR ${name}: the old app's engine: ${o.err}`); errors++; continue; }
  const same = JSON.stringify(o.loaded) === JSON.stringify(inp);
  // 3. compare
  const imp = IMPORT ? impNotes[impNotes.length - 1] : null;
  if (args.control && shown.length && steps.length) { shown[0].v *= 1 + 1e-9; steps[0].v = steps[0].v * (1 + 1e-9); }
  if (args.control && rpt) { const a = shown.find(q => /^rpt:/.test(q.tab) && !isPS10(q.path)), b = steps.find(q => /^rpt:/.test(q.tab) && !isPS10(q.path)); if (a) a.v *= 1 + 1e-9; if (b) b.v *= 1 + 1e-9; rpt.sum.kq.fpe += 0.01; }
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const bad = [], near = (a, b) => typeof a === 'number' && Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b));
  // PS-10: applies where the hand rule says so; its values = the hand values
  if (!!(ps10 && !ps10.off) !== o.hand.applies) bad.push(`PS-10: the new app ${ps10 && !ps10.off ? 'checks' : 'does not check'}, the hand rule says ${o.hand.applies ? 'check' : 'no check'}`);
  if (k10 >= 0 && k10 !== o.oldChecks) bad.push(`PS-10 check index ${k10}, the old app has ${o.oldChecks} checks (the addition must come last)`);
  const handOf = p => { const m = /^ps10\.(\w+)$/.exec(p); if (m) return o.hand[m[1]]; if (k10 >= 0 && p === `checks.${k10}.r`) return o.hand.r; if (k10 >= 0 && p === `checks.${k10}.v`) return o.hand.Ftot; if (k10 >= 0 && p === `checks.${k10}.lim`) return o.hand.lim; if (k10 >= 0 && p === `checks.${k10}.loc`) return o.hand.loc; return undefined; };
  let n10 = 0;
  shown.filter(q => isPS10(q.path)).forEach(q => { n10++; const hv = handOf(q.path), want = fx(q.div ? hv / q.div : hv, q.d);
    if (!near(q.v, hv) || q.text !== want) bad.push(`PS-10 ${q.tab} ${q.path}: shown "${q.text}" (${q.v}) vs hand ${hv} -> "${want}"`); });
  steps.filter(q => isPS10(q.path)).forEach(q => { n10++; const hv = handOf(q.path); if (!q.onTab) bad.push(`${q.tab} step ${q.id} not on the tab`); if (!near(q.v, hv)) bad.push(`PS-10 step ${q.id} (${q.path}): ${q.v} vs hand ${hv}`); });
  total10 += n10;
  shown.filter(q => !isPS10(q.path)).forEach(q => { const ov = o.vals[q.path], want = fx(q.div ? ov / q.div : ov, q.d);
    if (typeof ov !== 'number' || q.text !== want || !Object.is(q.v, ov)) bad.push(`${q.tab} ${q.path}: shown "${q.text}" (${q.v}) vs old ${ov} -> "${want}"`); });
  steps.filter(q => !isPS10(q.path)).forEach(q => { const ov = o.vals[q.path]; if (!q.onTab) bad.push(`${q.tab} step ${q.id} not on the tab`); if (!Object.is(q.v, ov)) bad.push(`${q.tab} step ${q.id} (${q.path}): ${q.v} vs old ${ov}`); });
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
await nw.b.close(); await old.b.close();
if (IMPORT) fs.rmSync(TMP, { recursive: true, force: true });
log(`${names.length} designs${IMPORT ? ` imported through "From the old app" (${IMP_WAYS.map(w => `${w} ${impNotes.filter(q => q.how === w).length}`).join(', ')}; ${nImpKeys} old keys / files, each unchanged; ${impNotes.filter(q => q.ok).length} summaries "the same")` : ''}, tabs ${tabs.join(', ')}${REPORT ? ', rpt' : ''}${OWN ? ', own (the Owner rules table and the check summary column)' : ''}: ${total} shown values and ${totalSteps} step values compared (of them ${total10} PS-10 values with the hand values, the rest with the old app; the Report ${totalRpt} values and ${totalRptSteps} step values, and ${totalOldRpt} numbers of the old app's own report); ${fails} with differences, ${errors} errors`);
process.exit(errors ? 2 : fails ? 1 : 0);
