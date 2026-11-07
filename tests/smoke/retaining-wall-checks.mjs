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
console.log(failures ? `${failures} FAILED` : 'all ok');
process.exit(failures ? 1 : 0);
