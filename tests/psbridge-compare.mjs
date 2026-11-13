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
//   Tabs: Losses, Stresses (PR 2c-1), Flexure, Shear (PR 2c-2), End zone & hold-down, Camber & deflection (PR 2d-1), Handling, Deck, Rating (PR 2d-2).
//   node tests/psbridge-compare.mjs [--tabs loss,str,flex,shear,end,camb,hand,deck,rt] [--case <part of a name>] [--old <file>] [--new <index.html>] [--verbose]
//     --control: changes one shown value by 1e-9 (relative) and one step value before comparing: the run must report both (the harness sees a difference)
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
const SEED = { 'psbeam.inputs.v1': '{"girder":"PCI BT-72","L":118}', 'psbeam.ui.v1': '{"tab":"losses"}' };
let fails = 0, errors = 0;
const log = s => console.log(s);

// the projects: the new page builds them (PSBModel.defaultProject of the page), from the same TAB_CASES source
const caseSrc = fs.readFileSync(path.join(REPO, 'tests/engine/psbridge-tab-cases.mjs'), 'utf8').replace(/^export const TAB_CASES = /m, 'window.__TAB_CASES = ');
const names = Object.keys(TAB_CASES(() => ({ base: { opt: {}, loads: {}, cont: {}, harp: {}, mat: {}, handling: {}, deck: {} }, spans: {}, xs: {} }))).filter(n => !args.case || n.includes(args.case));

const nw = await openPage(NEW, { vw: 1400, vh: 1000, ls: SEED });
await nw.p.waitForSelector('#tabBar [data-otab]');
const old = await openPage(OLD, { vw: 1400, vh: 1000, timeout: 120000 });
await old.p.waitForFunction(() => typeof computeAll === 'function', null, { timeout: 120000 });
let total = 0, totalSteps = 0;
for (const name of names) {
  // 1. the new app on the project
  const P = await nw.p.evaluate(([src, nm]) => { eval(src); const P = window.__TAB_CASES(() => window.PSBModel.defaultProject())[nm]; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); return P; }, [caseSrc, name]);
  await nw.p.reload(); await nw.p.waitForSelector('#tabBar [data-otab]'); await nw.p.waitForTimeout(300);
  const inp = await nw.p.evaluate(() => window.PSBDesign.inputs(window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project));
  const shown = [], steps = [];
  for (const t of tabs) {
    await nw.p.click(`#tabBar [data-otab="${t}"]`); await nw.p.waitForTimeout(250);
    const r = await nw.p.evaluate(([t, wk]) => {
      const P = window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, inp = window.PSBDesign.inputs(P), R = computeAll(inp);
      const at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
      const ev = [...document.querySelectorAll('#out [data-ev]')].map(el => ({ tab: t, path: el.dataset.ev, d: +el.dataset.d, div: el.dataset.div ? +el.dataset.div : 0, text: el.textContent, v: at(R, el.dataset.ev) }));
      const W = (wk === 'losses' || wk === 'stresses' ? window.PSBWorkedStress : wk === 'flexure' || wk === 'shear' ? window.PSBWorkedStrength : wk === 'endzone' || wk === 'camber' ? window.PSBWorkedEnd : wk === 'handling' || wk === 'deck' || wk === 'rating' ? window.PSBWorkedHDR : window.PSBWorked)[wk](inp, R);
      const st = Object.entries(W.paths).map(([id, p]) => { const s = W.steps.find(q => q.id === id); return { tab: t, id, path: p, v: s.value, onTab: !!document.getElementById('st-' + id) }; });
      return { ev, st, err: R.error };
    }, [t, TABS[t]]);
    if (r.err) { log(`ERROR ${name} / ${t}: the new page's engine: ${r.err}`); errors++; }
    shown.push(...r.ev); steps.push(...r.st);
  }
  // 2. the old app on the same inputs
  await old.p.evaluate(i => { localStorage.clear(); localStorage.setItem('psbeam.inputs.v1', JSON.stringify(i)); }, inp);
  await old.p.reload(); await old.p.waitForFunction(() => typeof computeAll === 'function', null, { timeout: 120000 }); await old.p.waitForTimeout(1500);
  const paths = [...new Set(shown.map(q => q.path).concat(steps.map(q => q.path)))];
  const o = await old.p.evaluate(([i, paths]) => {
    let loaded = null; try { loaded = JSON.parse(localStorage.getItem('psbeam.inputs.v1')); } catch (e) { /* none */ }
    const R = computeAll(i), at = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o), vals = {};
    paths.forEach(p => { vals[p] = at(R, p); });
    return { vals, err: R.error, loaded };
  }, [inp, paths]);
  if (o.err) { log(`ERROR ${name}: the old app's engine: ${o.err}`); errors++; continue; }
  const same = JSON.stringify(o.loaded) === JSON.stringify(inp);
  // 3. compare
  if (args.control && shown.length && steps.length) { shown[0].v *= 1 + 1e-9; steps[0].v = steps[0].v * (1 + 1e-9); }
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const bad = [];
  shown.forEach(q => { const ov = o.vals[q.path], want = fx(q.div ? ov / q.div : ov, q.d);
    if (typeof ov !== 'number' || q.text !== want || !Object.is(q.v, ov)) bad.push(`${q.tab} ${q.path}: shown "${q.text}" (${q.v}) vs old ${ov} -> "${want}"`); });
  steps.forEach(q => { const ov = o.vals[q.path]; if (!q.onTab) bad.push(`${q.tab} step ${q.id} not on the tab`); if (!Object.is(q.v, ov)) bad.push(`${q.tab} step ${q.id} (${q.path}): ${q.v} vs old ${ov}`); });
  total += shown.length; totalSteps += steps.length;
  const per = tabs.map(t => `${t} ${shown.filter(q => q.tab === t).length} values + ${steps.filter(q => q.tab === t).length} steps`).join(', ');
  if (bad.length) { fails++; log(`DIFF ${name}: ${bad.length} of ${shown.length + steps.length}`); bad.slice(0, 25).forEach(b => log('    ' + b)); }
  else log(`same ${name}: ${per}${same ? '' : ' (note: the old app changed the stored inputs on load; compared on the new app\'s inputs)'}`);
  if (args.verbose && !same) log('    inputs the old app stored: ' + JSON.stringify(o.loaded).slice(0, 400));
  void P;
}
// 4. the old app's keys in the new app's storage
const ls = await nw.p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
Object.entries(SEED).forEach(([k, v]) => { if (ls[k] !== v) { fails++; log(`DIFF storage: ${k} changed by the new app`); } });
const other = Object.keys(ls).filter(k => !k.startsWith('psb2.') && !(k in SEED));
if (other.length) { fails++; log('DIFF storage: keys other than psb2.* written: ' + other.join(', ')); }
const cerr = nw.errs.concat(old.errs.filter(e => !/Failed to load resource|deoptimised the styling/.test(e)));
if (cerr.length) { errors++; log('ERROR console: ' + cerr.slice(0, 5).join(' | ')); }
await nw.b.close(); await old.b.close();
log(`${names.length} designs, tabs ${tabs.join(', ')}: ${total} shown values and ${totalSteps} step values compared with the old app; ${fails} with differences, ${errors} errors`);
process.exit(errors ? 2 : fails ? 1 : 0);
