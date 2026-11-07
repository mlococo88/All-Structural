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
// RWPL (2026-11-07): pile-supported footing (Phase 8c) input errors and results are in CASES and AUD.
// Audit items (2026-11-07, table AUD): the new checks of the calculation audit on their check cases (RWS13 stem S1/S3 layout, RWEC ACI eccentricity limit, RWFF front-face T&S, RWSK shear key, RWE1 AASHTO Extreme Event I, RWIB ACI/IBC 0.7E, RWSQ stem seismic, RWCV EE II vertical earth thrust, RWUP ACI uplift split, RWPC partial-contact soil block, ...).
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
  ['RWPL pile row outside the footing', { fnd_type: 'pile', pile_x2: 20 }, 'pile_x2', 'e'],
  ['RWPL two pile rows at the same x', { fnd_type: 'pile', pile_x2: 1.5 }, 'pile_x2', 'e'],
  ['RWPL embedment + clear ≥ t_f', { fnd_type: 'pile', pile_embed: 16 }, 'pile_embed', 'e'],
  ['RWPL AASHTO φ_c > 1', { fnd_type: 'pile', design_basis: 'AASHTO', pile_phic: 1.2 }, 'pile_phic', 'e'],
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
// Audit items (2026-11-07): the new checks, their values on the decisions' check cases, their rows on the dashboard, tab and Report.
// [name, inputs, [[JS expression on R (window._R) / T (tab texts) / P (Report text), label]]]
const AUD = [
  ['RWS13 ACI default: S3–S1 lap 14.8 in, S1 ends 7.23 ft above the joint', {}, [
    ['R.checks.stemS3Lap.ok && R.checks.stemMAlong.ok', 'both new checks pass'], ['Math.abs(R.s13_lst - 14.80) < 0.01', 'ℓst = 14.8 in'],
    ['Math.abs(R.z_s1_end - 7.233) < 0.01 && !R.s1_full', 'S1 ends 7.23 ft'], ['R.z_cutoff === undefined', 'no alternate-bar cut-off'],
    ['/Mid Step 3 — S3–S1 Lap/i.test(T.stem) && !/Alternate-bar cutoff/i.test(T.stem)', 'Stem tab: Mid Step 3, no cut-off step'],
    ['/Stem S3–S1 Lap/.test(T.overview) && /Stem M along height/.test(T.overview)', 'dashboard rows'], ['/Mid Step 3 — S3–S1 lap/.test(P)', 'Report: Mid Step 3']]],
  ['RWS13 AASHTO default: S3 #3 / S1 #5, ℓst = max(14.78, 12.0)', { design_basis: 'AASHTO' }, [
    ['R.s13_diff && R.s13_big === "S1" && Math.abs(R.s13_lst - 14.78) < 0.01', 'ℓst = ℓd(#5) = 14.78 in'], ['Math.abs(R.s1_ext - 13.22) < 0.01', 'extension max(d, 15d_b, L/20) = 13.22 in'],
    ['R.checks.stemS3Lap.ok && R.checks.stemMAlong.ok', 'both new checks pass']]],
  ['RWEC ACI default: middle third by default, e −0.22 ft, D/C 0.105', {}, [
    ['document.getElementById("aci_ecc_limit").value === "b6" && R.checks.ecc && R.checks.ecc.ok', 'select b6, check passes'], ['Math.abs(Math.abs(R.e) / R.ecc_lim_aci - 0.105) < 0.001', 'D/C 0.105'],
    ['/Eccentricity/.test(T.overview) && /Eccentricity limit \\(engineer/i.test(T.stability)', 'dashboard row and Stability Step 6'], ['/Eccentricity limit \\(service\\)/.test(P) && /Eccentricity limit e ≤ B\\/6/.test(P)', 'Report input echo and Step 6']]],
  ['RWEC ACI variant L_t 2, L_h 3, t_f 24, key 36 in, passive: e 1.366 > B/6 → FAIL 1.26', { Lt: 2, Lh: 3, tf: 24, use_shear_key: true, dk: 36, incl_passive: true, qa: 4000 }, [
    ['!R.checks.ecc.ok && Math.abs(Math.abs(R.e) / R.ecc_lim_aci - 1.261) < 0.001', 'FAIL, D/C 1.261']]],
  ['RWEC same variant with B/4: PASS 0.84', { Lt: 2, Lh: 3, tf: 24, use_shear_key: true, dk: 36, incl_passive: true, qa: 4000, aci_ecc_limit: 'b4' }, [
    ['R.checks.ecc.ok && Math.abs(Math.abs(R.e) / R.ecc_lim_aci - 0.841) < 0.001', 'PASS, D/C 0.841']]],
  ['RWEC an autosave saved before the option opens with "No eccentricity limit" (old behaviour)', {}, [
    ['document.getElementById("aci_ecc_limit").value === "none" && !R.checks.ecc && R.ecc_lim_aci === null', 'set to none, no ecc check row'], ['/saved before the option existed/.test(T.stability)', 'the notice on Stability Step 6']], { strip: ['aci_ecc_limit'] }],
  ['RWFF AASHTO default: S4 front-face verticals 0.1733 in²/ft, #3@7', { design_basis: 'AASHTO' }, [
    ['Math.abs(R.As_ff_stem - 0.1733) < 0.0001 && R.sel_ff.bar.num === 3 && R.sel_ff.spacing === 7 && R.checks.tsFF.ok', 'S4 #3@7 ≥ 0.1733'],
    ['/Stem Front T&S \\(S4\\)/.test(T.overview) && /S4 front-face vertical/i.test(T.stem)', 'dashboard row and Stem Step 6'], ['/Bar selection S4/.test(P)', 'Report Step 6']]],
  ['RWFF AASHTO f_y 80 ksi: Eq. 5.10.6-1 with f_y = 75 ksi (S2, S4, F3 0.1387 / 0.1393)', { design_basis: 'AASHTO', fy: 80000 }, [
    ['R.fy_TS === 75 && Math.abs(R.As_temp_stem - 0.1387) < 0.0001 && Math.abs(R.As_ff_stem - 0.1387) < 0.0001 && Math.abs(R.As_ftg_long - 0.1393) < 0.0001', 'capped f_y']]],
  ['RWFF ACI: no S4, note only', {}, [['R.sel_ff === null && !R.checks.tsFF && /no vertical bars are required/i.test(T.stem)', 'note on Stem Step 6']]],
  ['RWSK ACI 12-in key, passive on: plain concrete, D/C 0.167 / 0.190', { use_shear_key: true, dk: 12, incl_passive: true }, [
    ['R.keyR.plain && Math.abs(R.keyR.Mu - 528) < 0.5 && Math.abs(R.keyR.phiMn_pl - 3162) < 1 && Math.abs(R.keyR.phiVn_pl - 6072) < 1 && R.checks.keyFlex.ok && R.checks.keyShear.ok && !R.checks.keyDev', 'plain: M_u 528 ≤ φM_n 3162, V_u 1152 ≤ φV_n 6072'],
    ['/Shear Key — Structural Design/i.test(T.footing) && /Key Flex/.test(T.overview)', 'Footing card and dashboard row'], ['/Shear key \\(b_k = 12\\.0 in/.test(P) && /Passive pressure at the top of the key/.test(P)', 'Report sub']]],
  ['RWSK ACI 36-in key: M_u 6480 > 3162 → reinforced K1 #4@9', { use_shear_key: true, dk: 36, incl_passive: true }, [
    ['!R.keyR.plain && R.keyR.rf.sel.bar.num === 4 && R.keyR.rf.sel.spacing === 9 && R.checks.keyFlex.ok && R.checks.keyShear.ok && R.checks.keyDev.ok', 'K1 #4@9, flexure, shear and development OK']]],
  ['RWSK AASHTO 12-in key: reinforced, K1 hooked both ends', { design_basis: 'AASHTO', use_shear_key: true, dk: 12, incl_passive: true }, [
    ['!R.keyR.plain && R.keyR.rf.hook_bot && R.checks.keyDev.ok && Math.abs(R.keyR.Mu - 495) < 0.5', 'M_u 495, K1 #3@18 hooked at the key bottom']]],
  ['RWSK key with passive off: no sliding credit note, key still designed; key width b_k 18 in', { use_shear_key: true, dk: 12, key_bk: 18 }, [
    ['R.keyR.no_credit && R.keyR.bk === 18 && /gives no sliding credit/.test(T.stability) && /gives no sliding credit/.test(T.footing)', 'notes on Stability and Footing'],
    ['getComputedStyle(document.getElementById("hint_key_pp")).display !== "none"', 'note under the key input']]],
  ['RWSK walls without a key: no key rows', {}, [['R.keyR === null && !R.checks.keyFlex', 'no key design']]],
  ['RWE1 AASHTO k_h 0.10: Extreme Event I sliding 0.856 / 0.879, e 0.284 / 0.411, q 1390 / 1420', { design_basis: 'AASHTO', kh: 0.10 }, [
    ['Math.abs(R.aashtoR.ee1.c1.dcS - 0.856) < 0.001 && Math.abs(R.aashtoR.ee1.c2.dcS - 0.879) < 0.001 && Math.abs(R.aashtoR.ee1.c1.e - 0.284) < 0.001 && Math.abs(R.aashtoR.ee1.c2.q - 1420) < 1', 'both cases'],
    ['R.checks.eeSliding.ok && R.checks.eeEcc.ok && R.checks.eeBearing.ok && !R.warnings.some(w => /not evaluated/.test(w))', 'checks pass, no "not evaluated" warning'],
    ['/Step 7a — Extreme Event I/i.test(T.stability) && /EQ Sliding/.test(T.overview) && /Step 7a — Extreme Event I/.test(P)', 'Stability card, dashboard, Report']]],
  ['RWE1 AASHTO k_h 0.20: sliding 1.153 FAIL', { design_basis: 'AASHTO', kh: 0.20 }, [['!R.checks.eeSliding.ok && Math.abs(R.aashtoR.ee1.sliding_dcr - 1.153) < 0.001', 'FAIL, DCR 1.153']]],
  ['RWIB ACI k_h 0.10: static FS 7.54 / 1.656 (≥ 1.5), with 0.7E 6.09 / 1.462 (≥ 1.1)', { kh: 0.10 }, [
    ['Math.abs(R.FOS_OT - 7.54) < 0.005 && Math.abs(R.FOS_SL - 1.656) < 0.001 && Math.abs(R.FOS_OT_E - 6.086) < 0.001 && Math.abs(R.FOS_SL_E - 1.462) < 0.001', 'static and 0.7E factors of safety'],
    ['R.checks.sliding.ok && R.checks.slidingE.ok && R.checks.otE.ok', 'all pass (sliding failed before: 1.392 < 1.5)'],
    ['/0\\.7 × ΔP_E, FOS ≥ 1\\.1/.test(T.stability) && /Sliding \\(0\\.7E\\)/.test(T.overview) && /IBC 2018 §1807\\.2\\.3 Exception/.test(P) && !/IBC 2021/.test(P + T.stability)', 'tab, dashboard, Report; IBC 2018 cited']]],
  ['RWSQ ACI k_h 0.10: stem M_u 18432 → 22365 (U = 1.2D + 1.0E + 1.6H governs)', { kh: 0.10 }, [
    ['Math.abs(R.Mu_stem_eq - 22365) < 1 && R.stem_eq_governs && Math.abs(R.Mu_stem_lbft - 22365) < 1', 'M_u 22365, seismic governs'],
    ['/Seismic combination U = 1\\.2D \\+ 1\\.0E \\+ 1\\.6H/.test(T.stem) && /Seismic combination U = 1\\.2D/.test(P)', 'Stem Step 1 and Report']]],
  ['RWSQ AASHTO k_h 0.10: stem Extreme Event I 14335 < Strength I 32274', { design_basis: 'AASHTO', kh: 0.10 }, [
    ['Math.abs(R.Mu_stem_eq - 14335) < 1 && !R.stem_eq_governs && Math.abs(R.Mu_stem_lbft - 32274) < 1', 'EE I computed, does not govern'],
    ['/Extreme Event I at the stem base/.test(T.stem)', 'Stem Step 1']]],
  ['RWCV AASHTO collision, β 10° Rankine, MassDOT γ_EH = 0: P_a,V drops from the EE II resisting load (V 18166 → 17347)', { design_basis: 'AASHTO', beta: 10, aashto_ep_method: 'rankine', aashto_ct_enable: true, aashto_ct_eh: 'zero' }, [
    ['Math.abs(R.aashtoR.ct.ee2.V_ct_min - 17347) < 1 && Math.abs(R.aashtoR.ct.ee2.sliding_dcr_ct - 0.256) < 0.001', 'V 17347, sliding DCR 0.256']]],
  ['RWCV same with γ_EH "full": unchanged (V 18166)', { design_basis: 'AASHTO', beta: 10, aashto_ep_method: 'rankine', aashto_ct_enable: true, aashto_ct_eh: 'full' }, [
    ['Math.abs(R.aashtoR.ct.ee2.V_ct_min - 18166) < 1', 'V 18166']]],
  ['RWCV AASHTO collision, Coulomb δ 20°, MassDOT: V 17694 → 16583, sliding 0.232, e −0.257; Step 7b M_r worked', { design_basis: 'AASHTO', aashto_delta: 20, aashto_ct_enable: true, aashto_ct_eh: 'zero' }, [
    ['Math.abs(R.aashtoR.ct.ee2.V_ct_min - 16583) < 1 && Math.abs(R.aashtoR.ct.ee2.sliding_dcr_ct - 0.232) < 0.001 && Math.abs(R.aashtoR.ct.ee2.e_ct + 0.257) < 0.001', 'V 16583, DCR 0.232, e −0.257'],
    ['/Resisting moment about the toe/.test(T.stability)', 'Stability Step 7b M_r']]],
  ['RWUP ACI water 2 ft below the top, triangular uplift: uplift split (toe γ_U 1.6, heel 0.9): toe M_u 9250 → 12344, heel 28267 → 27772', { wt_mode: 'depth', wt_depth: 2, uplift_mode: 'triangular' }, [
    ['Math.abs(R.Mu_toe_net - 12344.3) < 1 && R.toe_min_governs && Math.abs(R.Mu_heel_net - 27772.1) < 1 && R.tcG_up && R.tcG_up.sp.kind === "toe"', 'toe 12344 (0.9D + 1.6H), heel 27772'],
    ['/Soil reaction without the water/.test(T.footing) && /Moment of the soil reaction about the stem face/.test(T.footing) && /split out/.test(T.footing)', 'Footing Heel / Toe Step 1–2 worked'], ['/Soil reaction without the water/.test(P)', 'Report']]],
  ['RWUP ACI water 6 ft (uniform): unchanged (toe 7325, heel 19032)', { wt_mode: 'depth', wt_depth: 6 }, [
    ['Math.abs(R.Mu_toe_net - 7325) < 1 && Math.abs(R.Mu_heel_net - 19032) < 1 && R.upS', 'toe 7325, heel 19032']]],
  ['RWUP ACI no water: no split', {}, [['R.upS === null && !/Soil reaction without the water/.test(T.footing)', 'no split']]],
  ['RWUP AASHTO with water: no split', { design_basis: 'AASHTO', wt_mode: 'depth', wt_depth: 6 }, [['R.upS === null', 'no split']]],
  ['RWPL ACI default wall on 2 pile rows (x 1.5 / 11.0 ft, s 6 ft): P 47.45 / 52.04 kip (D + H + L), 32.62 / 27.08 (0.6D + H)', { fnd_type: 'pile' }, [
    ['Math.abs(R.pile.g.N - 1 / 3) < 1e-12 && Math.abs(R.pile.g.xbar - 6.25) < 1e-9 && Math.abs(R.pile.g.I - 7.520833) < 1e-5', 'N, x̄, I'],
    ['Math.abs(R.pile.comb[0].L.rows[0].P - 47.455) < 0.001 && Math.abs(R.pile.comb[0].L.rows[1].P - 52.040) < 0.001 && Math.abs(R.pile.comb[1].L.rows[0].P - 32.617) < 0.001', 'pile loads'],
    ['Math.abs(R.pile.govH.L.rows[0].h - 10.935) < 0.001 && !R.checks.pileLat.ok && R.checks.pileComp.ok && R.checks.pileUplift.ok', 'H/N 10.94 > H_a 8 (placeholder) FAIL; compression, uplift pass'],
    ['!R.checks.ot && !R.checks.sliding && !R.checks.bearing && !R.checks.ecc', 'soil checks replaced'],
    ['/Pile Step 2 — Pile Reactions and Checks/i.test(T.stability) && /Not applicable: pile-supported footing/i.test(T.stability) && /Pile Compression/i.test(T.overview) && /Pile Step 2 — Pile reactions and checks/.test(P)', 'Stability cards, N/A notes, dashboard, Report']]],
  ['RWPL AASHTO default wall on 2 pile rows: Strength I max 83.60 / 77.66 kip, φ_cR_n 195', { fnd_type: 'pile', design_basis: 'AASHTO' }, [
    ['Math.abs(R.pile.comb[0].L.rows[0].P - 83.604) < 0.001 && Math.abs(R.pile.comb[0].L.rows[1].P - 77.664) < 0.001 && Math.abs(R.pile.govC.cap.c - 195) < 1e-9', 'Strength I max'],
    ['R.checks.pileSpacing.ok && R.checks.pileEdge.ok && R.checks.pileEmbed.ok && !R.checks.eeSliding && !R.warnings.some(w => /^AASHTO bearing/.test(w))', 'detailing checks (Art. 10.7.1.2), no soil notes']]],
  ['RWPL 8d ACI t_f 36 in on piles: toe M_u 17521.6 (q 12896 at 1.5 ft), heel M_up 44434.6 (U = 0.9D + 1.6H), punching 77.38 ≤ 403.0 kip', { fnd_type: 'pile', tf: 36 }, [
    ['Math.abs(R.pileFtg.cmax.rows[0].q - 12896.05) < 0.1 && Math.abs(R.Mu_toe_net - 17521.58) < 0.1 && Math.abs(R.Vu_toe - 11681.05) < 0.1 && Math.abs(R.d_toe - 20.625) < 1e-9', 'toe from the pile row, d over the pile heads'],
    ['R.heel_min_governs && Math.abs(R.Mu_heel_up - 44434.60) < 0.1 && Math.abs(R.Mu_heel_net - 9997.40) < 0.1', 'heel'],
    ['Math.abs(R.pilePunch.dp - 20.25) < 1e-9 && Math.abs(R.pilePunch.rows[0].bo - 129) < 1e-9 && Math.abs(R.pilePunch.rows[0].phiVc - 403012.3) < 1 && R.checks.pilePunch.ok && R.checks.pileCapD.ok', 'punching, cap depth'],
    ['/Pile Cap — Punching around the Piles/i.test(T.footing) && /Factored pile reactions under the toe/i.test(T.footing) && /Pile cap — punching around the piles/.test(P)', 'Footing tab and Report']]],
  ['RWPL 8d AASHTO t_f 36 in on piles: punching φV_n = 0.90(0.126)√f\'c b_o d_v', { fnd_type: 'pile', tf: 36, design_basis: 'AASHTO' }, [
    ['R.pilePunch && Math.abs(R.pilePunch.rows[0].phiVc - 0.9 * 0.126 * Math.sqrt(4) * R.pilePunch.rows[0].bo * R.pilePunch.dvp * 1000) < 1 && !R.checks.pileCapD', 'AASHTO two-way shear; no ACI cap-depth row']]],
  ['RWPL spread footing unchanged: no pile results', {}, [['!R.pile && !(\'pile\' in R) && R.checks.bearing && R.checks.ot', 'spread footing checks, no pile field in the results']]],
  ['RWPC ACI L_t 2, L_h 3, t_f 24 (no water, e_u > B/6): soil block 3x̄ — toe 57755 → 13589, heel 5151 → 9396', { Lt: 2, Lh: 3, tf: 24 }, [
    ['Math.abs(R.Mu_toe_net - 13589.1) < 1 && Math.abs(R.Mu_heel_net - 9396) < 1 && R.tcG_up && R.tcG_up.sp.g === 0 && R.tcG_up.sp.kind === "toe"', 'toe 13589, heel 9396'],
    ['/its resultant lies outside the kern/.test(T.footing) && /partial contact: triangular block/.test(T.stability)', 'Footing Step 1 and Stability Step 7']]],
  ['RWPC AASHTO Rankine β 20° (Strength Ia beyond the kern): heel 36600 → 44966, #6 @ 7', { design_basis: 'AASHTO', beta: 20, aashto_ep_method: 'rankine' }, [
    ['Math.abs(R.Mu_heel_net - 44966.2) < 1 && R.sel_heel.label === \'#6 @ 7" o.c.\'', 'heel 44966, #6 @ 7']]],
  ['RWPC default (full contact): no block', {}, [['R.hcG_up === null && R.tcG_up === null && Math.abs(R.Mu_toe_net - 6572) < 1 && Math.abs(R.Mu_heel_net - 15533) < 1', 'unchanged']]],
  ['RWEC AASHTO unchanged by the ACI select', { design_basis: 'AASHTO', aci_ecc_limit: 'b6' }, [['R.ecc_lim_aci === null && /e=1\\.43/.test(R.checks.ecc.val)', 'AASHTO e check as before']]],
];
for (const [name, set, tests, opt] of AUD.filter(x => !process.env.RW_AUD || x[0].startsWith(process.env.RW_AUD))) {
  let ls = null;
  if (opt && opt.strip) {   // an older save: the autosave of the default project without the given fields
    const o0 = await openPage(SRC.file); await o0.p.waitForTimeout(2500);
    ls = await o0.p.evaluate(ids => { const k = Object.keys(localStorage).find(x => /^retaincalcpro\.autosave/.test(x)); const a = JSON.parse(localStorage.getItem(k)); ids.forEach(i => delete a.fields[i]); return { [k]: JSON.stringify(a) }; }, opt.strip);
    await o0.b.close();
  }
  const { b, p, errs } = await openPage(SRC.file, ls ? { ls } : {}); await p.waitForTimeout(2500);
  const o = await p.evaluate(async ({ set, tests }) => {
    for (const [k, v] of Object.entries(set)) { const e = document.getElementById(k); if (e.type === 'checkbox') e.checked = !!v; else e.value = v; e.dispatchEvent(new Event('change', { bubbles: true })); }
    if (typeof syncConditionalUI === 'function') syncConditionalUI(); if (set.design_basis) onBasisChange(); onInputChange(); await new Promise(r => setTimeout(r, 600));
    const T = {}; for (const t of ['overview', 'stability', 'stem', 'footing', 'rebar']) { document.querySelector(`.tab-btn[data-tab="${t}"]`).click(); await new Promise(r => setTimeout(r, 300)); T[t] = document.getElementById('tab-' + t).innerText; }
    document.querySelector('.tab-btn[data-tab="report"]').click(); await new Promise(r => setTimeout(r, 3000));
    const P = document.getElementById('tab-report').textContent, R = window._R;
    return tests.map(([x, l]) => { let v; try { v = !!(new Function('R', 'T', 'P', 'return (' + x + ');'))(R, T, P); } catch (e) { v = false; l += ' (' + e.message + ')'; } return [v, l]; });
  }, { set, tests });
  await b.close();
  console.log('audit: ' + name);
  for (const [v, l] of o) check(v, l);
  check(!errs.length, 'no console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
}
console.log(failures ? `${failures} FAILED` : 'all ok');
process.exit(failures ? 1 : 0);
