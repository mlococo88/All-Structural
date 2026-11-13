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
//   node tests/psbridge-compare.mjs [--tabs loss,str,flex,shear,end,camb,hand,deck,rt,rpt] [--case <part of a name>] [--old <file>] [--new <index.html>] [--verbose]
//     --control: changes one shown value by 1e-9 (relative) and one step value before comparing (and, with the Report, one Report value, one
//     Report step value and one number given to the old report's comparison): the run must report each (the harness sees a difference)
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
let total = 0, totalSteps = 0, total10 = 0, totalRpt = 0, totalRptSteps = 0, totalOldRpt = 0;
for (const name of names) {
  // 1. the new app on the project
  const P = await nw.p.evaluate(([src, nm]) => { eval(src); const P = window.__TAB_CASES(() => window.PSBModel.defaultProject())[nm]; localStorage.setItem('psb2.project.current', window.PSBModel.exportJSON(P)); return P; }, [caseSrc, name]);
  await nw.p.reload(); await nw.p.waitForSelector('#tabBar [data-otab]'); await nw.p.waitForTimeout(300);
  const inp = await nw.p.evaluate(() => window.PSBDesign.inputs(window.PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project));
  const shown = [], steps = []; let ps10 = null, k10 = -1;
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
      return { ev, st, nSteps, domSteps: document.querySelectorAll('.rp-doc .rp-step').length, k10, sum, kErr: document.querySelectorAll('.rp-doc .katex-error').length, bad: document.querySelectorAll('.rp-doc .rp-bad').length };
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
  const per = tabs.map(t => `${t} ${shown.filter(q => q.tab === t).length} values + ${steps.filter(q => q.tab === t).length} steps`).join(', ') + (rpt ? `, rpt ${rpt.ev.length} values + ${rpt.st.length} steps (${rpt.nSteps} shown), old report ${nOld} numbers` : '');
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
log(`${names.length} designs, tabs ${tabs.join(', ')}${REPORT ? ', rpt' : ''}: ${total} shown values and ${totalSteps} step values compared (of them ${total10} PS-10 values with the hand values, the rest with the old app; the Report ${totalRpt} values and ${totalRptSteps} step values, and ${totalOldRpt} numbers of the old app's own report); ${fails} with differences, ${errors} errors`);
process.exit(errors ? 2 : fails ? 1 : 0);
