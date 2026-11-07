#!/usr/bin/env node
// Retaining Wall Designer: required inputs (RWIE, engineer 2026-11-06). Headless Chromium, file://, pinned libraries from tests/libs.
// For each blank or invalid input below:
//   1. there are no results (window._R.fatal) and the check summary, every output tab, the Drawings and the Report show the common
//      banner "Input error: no results" naming the input;
//   2. the field is outlined (data-rwie="e") with its reason under it, and the banner's link focuses that field;
//   3. 0 console / page errors.
// A doubtful value (REVIEW) is marked but does not block the results. A saved autosave holding a blank value opens on the banner
// (no crash). The default project has no banner and no mark.
// RWSC (2026-11-07): the self-consistency panel passes on representative walls, reports MISMATCH on a tampered result, hides on error.
// RWPR (2026-11-07): the Report prints alone, with every section, the overview figures and the input echo; 0 KaTeX errors.
// RWKX (2026-11-07): the tabs' equations are all set by KaTeX, none in error; MathJax is not loaded.
//   node tests/smoke/retaining-wall-checks.mjs [--file <file or git ref>]
import path from 'path';
import { openPage, resolveFile } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Retaining Wall Designer.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
let failures = 0;
const check = (ok, msg) => { console.log((ok ? '  ok   ' : '  FAIL ') + msg); if (!ok) failures++; };

// [name, inputs to set, field expected marked, 'e' error | 'r' review]
const CASES = [
  ['default project', {}, null],
  ['stem height H_s blank', { Hs: '' }, 'Hs', 'e'],
  ['stem height H_s negative', { Hs: -3 }, 'Hs', 'e'],
  ['footing thickness t_f blank', { tf: '' }, 'tf', 'e'],
  ['stem cover beyond the stem thickness', { cov_stem: 20 }, 'cov_stem', 'e'],
  ["f'c blank", { fc: '' }, 'fc', 'e'],
  ['friction angle φ = 95°', { phi: 95 }, 'phi', 'e'],
  ['allowable bearing q_a blank', { qa: '' }, 'qa', 'e'],
  ['column loads with distribution length blank', { col_DL: 20, col_Ldist: '' }, 'col_Ldist', 'e'],
  ['bar override #12', { ovr_bar_s1: 12 }, 'ovr_bar_s1', 'e'],
  ['backfill β ≥ φ (the analysis\' own check)', { beta: 35 }, 'beta', 'e'],
  ['AASHTO: manual q_R blank', { design_basis: 'AASHTO', aashto_qn_mode: 'manual', aashto_qR: '' }, 'aashto_qR', 'e'],
  ['AASHTO: variable height high < low', { design_basis: 'AASHTO', vh_enable: true, vh_hlo: 10, vh_hhi: 6 }, 'vh_hhi', 'e'],
  ['AASHTO: collision joint spacing blank', { design_basis: 'AASHTO', aashto_ct_enable: true, aashto_ct_tl: 'manual', aashto_ct_ljoint: '' }, 'aashto_ct_ljoint', 'e'],
  ['REVIEW: β < 0', { beta: -5 }, 'beta', 'r'],
];
const TABS = ['overview', 'stability', 'stem', 'footing', 'rebar', 'diagram', 'threed', 'drawings', 'report'];

async function run(name, set, id, kind, ls) {
  const { b, p, errs } = await openPage(SRC.file, ls ? { ls } : {});
  await p.waitForTimeout(2500);
  const o = await p.evaluate(async ({ set, TABS }) => {
    for (const [k, v] of Object.entries(set)) { const el = document.getElementById(k); if (!el) return { missing: k }; if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    if (Object.keys(set).length) { if (typeof syncConditionalUI === 'function') syncConditionalUI(); onInputChange(); }
    await new Promise(r => setTimeout(r, 600));
    const banner = sel => { const e = document.querySelector(sel + ' .rwie-box'); return e ? e.innerText.replace(/\s+/g, ' ') : ''; };
    const tabs = {};
    for (const t of TABS) { document.querySelector(`.tab-btn[data-tab="${t}"]`).click(); await new Promise(r => setTimeout(r, t === 'report' ? 2500 : 300)); tabs[t] = banner('#tab-' + t); }
    const marks = [...document.querySelectorAll('[data-rwie]')].map(e => [e.id, e.dataset.rwie]);
    const msg = [...document.querySelectorAll('.rwie-msg')].map(e => e.textContent).join(' / ');
    const dash = banner('#rwDash');
    let focused = '';
    const a = document.querySelector('#rwDash .rwie-go'); if (a) { a.click(); await new Promise(r => setTimeout(r, 300)); focused = document.activeElement ? document.activeElement.id : ''; }
    return { fatal: !!(window._R && window._R.fatal), dash, tabs, marks, msg, focused };
  }, { set, TABS });
  await b.close();
  console.log(name);
  if (o.missing) { check(false, 'input not found: ' + o.missing); return; }
  if (!id) {
    check(!o.fatal && !o.dash && TABS.every(t => !o.tabs[t]) && !o.marks.length, 'results shown, no banner, no mark');
  } else if (kind === 'r') {
    check(!o.fatal && !o.dash, 'REVIEW does not block the results');
    check(o.marks.some(m => m[0] === id && m[1] === 'r') && /REVIEW/.test(o.msg), `${id} marked REVIEW: ${o.msg.slice(0, 120)}`);
  } else {
    check(o.fatal, 'no results (window._R.fatal)');
    check(/Input error: no results/.test(o.dash), 'check summary banner: ' + o.dash.slice(0, 140));
    const miss = TABS.filter(t => !/Input error: no results/.test(o.tabs[t]));
    check(!miss.length, 'banner on every output tab' + (miss.length ? ' — missing on ' + miss.join(', ') : ''));
    check(o.marks.some(m => m[0] === id && m[1] === 'e'), `${id} outlined with its reason: ${o.msg.slice(0, 120)}`);
    check(o.focused === id, `the banner link focuses ${id} (focused: ${o.focused || 'none'})`);
  }
  check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
}
console.log(`retaining-wall-checks: ${SRC.label}`);
for (const [name, set, id, kind] of CASES) await run(name, set, id, kind);
// a saved autosave holding blank values (an older project saved with an invalid value) opens on the banner
{
  const { b, p } = await openPage(SRC.file); await p.waitForTimeout(2500);
  const ls = await p.evaluate(() => { const o = {}; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); o[k] = localStorage.getItem(k); } return o; });
  await b.close();
  const k = Object.keys(ls).find(x => /^retaincalcpro\.autosave/.test(x));
  if (!k) check(false, 'no autosave key found');
  else {
    const o = JSON.parse(ls[k]); let n = 0; const walk = x => { if (x && typeof x === 'object') for (const kk in x) { if (kk === 'Hs' || kk === 'fc') { x[kk] = ''; n++; } else walk(x[kk]); } }; walk(o);
    check(n > 0, `autosave ${k}: H_s and f'c set blank (${n})`);
    await run('saved autosave with H_s blank', {}, 'Hs', 'e', { [k]: JSON.stringify(o) });
  }
}
// RWSC: the self-consistency panel (independent recomputations) passes on representative walls, says MISMATCH and opens when a
// shown value is made inconsistent, and is empty while an input is in error
const SC = [['ACI default', {}], ['ACI water + seismic + column + surcharge + β + key', { Hs: 16, wt_depth: 6, incl_hydro: true, incl_passive: true, kh: 0.15, col_DL: 20, col_LL: 10, col_Ldist: 1, q_sur: 250, beta: 10, use_shear_key: true }],
  ['ACI triangular bearing', { Hs: 18, Lt: 1, Lh: 6 }], ['AASHTO barrier + collision + variable height', { design_basis: 'AASHTO', vh_enable: true, bar_enable: true, aashto_ct_enable: true }],
  ['AASHTO rock + water + η 1.05', { design_basis: 'AASHTO', aashto_ecc_limit: 'rock', wt_depth: 6, incl_hydro: true, aashto_eta: 1.05 }]];
for (const [name, set] of SC) {
  const { b, p, errs } = await openPage(SRC.file); await p.waitForTimeout(2500);
  const o = await p.evaluate(async set => {
    for (const [k, v] of Object.entries(set)) { const el = document.getElementById(k); if (el.type === 'checkbox') el.checked = !!v; else el.value = v; el.dispatchEvent(new Event('change', { bubbles: true })); el.dispatchEvent(new Event('input', { bubbles: true })); }
    if (typeof syncConditionalUI === 'function') syncConditionalUI(); onInputChange(); await new Promise(r => setTimeout(r, 500));
    const sum = () => { const e = document.querySelector('#rwSelf summary'); return e ? e.innerText : ''; };
    const ok = sum(), n = rwSelfChecks(window._R).length;
    const R = Object.assign({}, window._R, { SumV: window._R.SumV + 100 }); rwSelfRender(R);
    const ng = sum(), open = !!document.querySelector('#rwSelf details[open]');
    rwSelfRender(window._R);
    document.getElementById('fc').value = ''; onInputChange(); const gone = !document.querySelector('#rwSelf details');
    return { ok, n, ng, open, gone };
  }, set);
  await b.close();
  console.log('self-consistency: ' + name);
  check(/all \d+ passed/.test(o.ok) && o.n >= 10, o.ok + ` (${o.n} checks)`);
  check(/MISMATCH/.test(o.ng) && o.open, 'ΣV made inconsistent: ' + o.ng + (o.open ? ' (opened)' : ''));
  check(o.gone, 'no panel while an input is in error');
  check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
}
// RWPR (2026-11-07): the Report in print (Print report, window.print stubbed, print media, page.pdf): the report alone, every section,
// the overview figures, the input echo with the Project tab dates, 0 KaTeX errors, a multi-page PDF; the page comes back after printing
for (const [name, set] of [['ACI, water + column + seismic', { proj_name: 'Main St Wall', proj_date: '2026-11-06', proj_chkdate: '2026-11-07', Hs: 14, wt_depth: 6, incl_hydro: true, col_DL: 20, col_LL: 10, kh: 0.1, ovr_bar_s1: 6, ovr_spc_s1: 8 }],
  ['AASHTO, barrier + collision + variable height + key', { design_basis: 'AASHTO', bar_enable: true, aashto_ct_enable: true, vh_enable: true, use_shear_key: true }]]) {
  const { b, p, errs } = await openPage(SRC.file); await p.waitForTimeout(2500);
  await p.evaluate(async set => {
    for (const [k, v] of Object.entries(set)) { const e = document.getElementById(k); if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
    if (typeof syncConditionalUI === 'function') syncConditionalUI(); onInputChange();
    document.querySelector('.tab-btn[data-tab="report"]').click(); await new Promise(r => setTimeout(r, 6000));
    window.__printed = 0; window.print = () => { window.__printed++; };
  }, set);
  await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0);
  await p.emulateMedia({ media: 'print' }); await p.waitForTimeout(1000);
  const o = await p.evaluate(() => { const box = document.getElementById('rp-print'), vis = e => !!e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0, t = box ? box.innerText : '';
    return { box: vis(box), app: vis(document.getElementById('app')), kerr: box ? box.querySelectorAll('.katex-error').length : -1, t,
      img3d: !!(box && box.querySelector('img[alt="3D model of the wall"]')), svgs: box ? box.querySelectorAll('figure svg').length : 0 }; });
  const pdf = await p.pdf({ format: 'Letter', preferCSSPageSize: true }), pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  const back = await p.evaluate(() => !document.body.classList.contains('rp-printing'));
  await b.close();
  console.log('print: ' + name);
  check(o.box && !o.app, 'the report alone on the page');
  const secs = ['DESIGN SUMMARY', 'OVERVIEW OF THE WALL', 'INPUT PARAMETERS', 'STABILITY', 'STEM DESIGN', 'FOOTING DESIGN', 'REINFORCEMENT SCHEDULE', 'ASSUMPTIONS AND WARNINGS', 'REFERENCES', 'APPENDIX: FIGURES OF THE RESULT TABS'];
  const miss = secs.filter(x => !o.t.toUpperCase().includes(x));
  check(!miss.length, 'every section printed' + (miss.length ? ' — missing ' + miss.join(', ') : ''));
  check(o.img3d && o.svgs >= 5, `overview 3D image and ${o.svgs} drawn figures`);
  check(/Checked date/.test(o.t) && /Bar overrides/.test(o.t), 'input echo: Project dates and bar overrides');
  if (set.proj_date) check(o.t.includes('2026-11-06') && o.t.includes('S1 #6 @ 8'), 'input echo values: date 2026-11-06, S1 #6 @ 8 in');
  check(o.kerr === 0, `0 KaTeX errors (${o.kerr})`);
  check(pages >= 15, `${pages} printed pages`);
  check(back, 'the page comes back after printing');
  check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
}
// RWKX (2026-11-07): the result tabs' worked steps are set by KaTeX (MathJax removed): every equation typeset, none in error or red
// (an unsupported command), no $$ left, and MathJax not loaded
for (const [name, set] of [['ACI water + seismic + key + passive', { Hs: 14, wt_depth: 6, incl_hydro: true, kh: 0.15, beta: 8, use_shear_key: true, incl_passive: true }],
  ['AASHTO collision + interface shear + Coulomb + LS', { design_basis: 'AASHTO', bar_enable: true, aashto_ct_enable: true, yl_enable: true, aashto_ish_enable: true, aashto_ep_method: 'coulomb', aashto_ll_surcharge: true }]]) {
  const { b, p, errs } = await openPage(SRC.file); await p.waitForTimeout(2500);
  const o = await p.evaluate(async set => {
    for (const [k, v] of Object.entries(set)) { const e = document.getElementById(k); if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
    if (typeof syncConditionalUI === 'function') syncConditionalUI(); onInputChange();
    const out = { mj: !!window.MathJax || !!document.querySelector('script[src*="mathjax"]'), tabs: {} };
    for (const t of ['stability', 'stem', 'footing']) {
      document.querySelector(`.tab-btn[data-tab="${t}"]`).click(); await new Promise(r => setTimeout(r, 900));
      const P = document.getElementById('tab-' + t);
      out.tabs[t] = { eq: P.querySelectorAll('.eq-math').length, kx: P.querySelectorAll('.eq-math .katex-display').length, err: P.querySelectorAll('.katex-error').length,
        red: [...P.querySelectorAll('.katex')].filter(k => /cc0000/i.test(k.innerHTML)).length, left: (P.innerText.match(/\$\$/g) || []).length };
    }
    return out;
  }, set);
  await b.close();
  console.log('KaTeX: ' + name);
  check(!o.mj, 'MathJax not loaded');
  for (const [t, x] of Object.entries(o.tabs)) check(x.eq > 10 && x.kx === x.eq && !x.err && !x.red && !x.left, `${t}: ${x.kx} of ${x.eq} equations by KaTeX, ${x.err} errors, ${x.red} red, ${x.left} $$ left`);
  check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
}
console.log(failures ? `${failures} FAILED` : 'all ok');
process.exit(failures ? 1 : 0);
