#!/usr/bin/env node
// CBCL regression (2026-11-10): Development & Splice tab of Concrete Beam Capacity, AASHTO compression lap splice.
//  - f'c < 3.0 ksi: m = 1.33 (AASHTO LRFD 10th Ed. 5.10.8.4.5a; before: x4/3). Hand check: #8 (d_b = 1.000 in), f_y = 60 ksi,
//    f'c = 2.5 ksi: l_c = 0.5 x 1.33 x 60 x 1.000 = 39.90 in (before 40.00 in); f_y = 80 ksi: 1.33 x (0.9 x 80 - 24) x 1.000 = 63.84 in.
//  - f'c >= 3.0 ksi (AASHTO) and ACI mode are unchanged: #8 at 3.0 ksi = 30.00 in; ACI #8 at 2,500 psi = 4/3 x 30 = 40.00 in.
//  - #14/#18: the same-size compression lap N/P banner, the Report step and the bar-schedule footnote cite 5.10.8.4.5a.
//  - Tab and Report show the basis note; 0 console errors; no sideways scroll at 390 px.
//   node tests/smoke/rebar-comp-lap.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const devF = async p => { await p.waitForSelector('#suite-frame-dev', { state: 'attached' }); const f = await (await p.$('#suite-frame-dev')).contentFrame();
  await f.waitForFunction(() => typeof computeFactors === 'function' && document.getElementById('dashboard') && document.getElementById('dashboard').textContent.length > 20, null, { timeout: 30000 }); await p.waitForTimeout(800); return f; };
const set = (f, o, tab) => f.evaluate(([o, tab]) => {
  for (const [id, v] of Object.entries(o)) { const e = document.getElementById(id); e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }
  const b = document.querySelector('.tab[data-tab="' + tab + '"]'); if (b) b.click(); else { currentTab = tab; render(); }
}, [o, tab]);
const get = f => f.evaluate(() => { const inp = readInputs(), fa = computeFactors(inp), cs = calcCompSplice(inp, fa);
  return { lsc: cs.lsc, lscCalc: cs.lsc_calc, m: cs.m, text: document.getElementById('tabcontent').textContent.replace(/\s+/g, ' '), rbr: JSON.stringify(rbrModel()) }; });
const near = (a, b) => Math.abs(a - b) < 1e-9;

for (const vw of [1400, 390]) {
  const { b, p, errs } = await openPage(FILE, { hash: '#dev', vw, vh: 900 });
  const f = await devF(p);
  console.log('--- viewport ' + vw + ' px');
  await set(f, { codeSel: 'AASHTO', barSize: '8', fy: '60000', fc: '2500' }, 'csplice'); await p.waitForTimeout(500);
  let r = await get(f);
  ok(near(r.lsc, 0.5 * 1.33 * 60 * 1.0) && Math.abs(r.lsc - 39.90) < 1e-6, `AASHTO #8 f_y 60 f'c 2.5: l_sc = ${r.lsc} (39.90; before 40.00)`);
  ok(r.m === 1.33, 'AASHTO f\'c < 3.0 ksi: m = 1.33');
  ok(r.text.includes('39.90 in') && r.text.includes('Modification factor (1.33: f\'c < 3.0 ksi)'), 'tab shows 39.90 in and m = 1.33');
  ok(r.text.includes('lists m = 1.33 where f\'c is less than 3.0 ksi'), 'tab: basis note');
  ok(r.rbr.includes('lists m = 1.33 where f\'c is less than 3.0 ksi') && r.rbr.includes('0.5\\\\times 1.33\\\\times 60.0\\\\times 1.000'), 'Report: basis note and 1.33 step');
  ok(!/×4\/3|frac\{4\}\{3\}/.test(r.text + r.rbr), 'AASHTO: no x4/3 step left on the tab or in the Report');
  await set(f, { fy: '80000' }, 'csplice'); await p.waitForTimeout(300); r = await get(f);
  ok(Math.abs(r.lsc - 63.84) < 1e-6, `AASHTO #8 f_y 80 f'c 2.5: l_sc = ${r.lsc} (63.84; before 64.00)`);
  await set(f, { fy: '60000', fc: '3000' }, 'csplice'); await p.waitForTimeout(300); r = await get(f);
  ok(r.lsc === 30 && r.m === 1.0, `AASHTO #8 f'c 3.0: l_sc = ${r.lsc} (30.00, unchanged), m = 1.0`);
  await set(f, { codeSel: 'ACI', fc: '2500' }, 'csplice'); await p.waitForTimeout(300); r = await get(f);
  ok(near(r.lsc, 40), `ACI #8 f'c 2,500 psi: l_sc = ${r.lsc} (40.00, unchanged: ACI 25.5.5.1 one-third)`);
  await set(f, { codeSel: 'AASHTO', barSize: '14', fc: '4000' }, 'csplice'); await p.waitForTimeout(300); r = await get(f);
  // (the validation notice above the tab still cites 5.10.8.4.2a: open item, not in this change)
  ok(r.text.includes('Lap splice of #14 to #14 NOT permitted (AASHTO 5.10.8.4.5a). In compression, #14 and #18 bars may be lap spliced only to #11 and smaller bars') && !r.text.includes('NOT permitted (AASHTO 5.10.8.4.2a)'), '#14 compression banner cites 5.10.8.4.5a');
  ok(r.rbr.includes('"id":"lapOK","label":"Lap splice of #14 to #14 permitted"') && r.rbr.includes('5.10.8.4.5a (#14 and #18 lap spliced in compression only to #11 and smaller)'), 'Report: compression N/P step cites 5.10.8.4.5a');
  await set(f, {}, 'batch'); await p.waitForTimeout(300); r = await get(f);
  ok(r.text.includes('in tension, lap splices are not used for bars larger than No. 11 (AASHTO 5.10.8.4.2a); in compression, #14 and #18 bars may be lap spliced only to #11 and smaller bars, so a same-size lap is not permitted (AASHTO 5.10.8.4.5a)'), 'bar schedule footnote: tension 5.10.8.4.2a, compression 5.10.8.4.5a');
  ok(r.rbr.includes('so a same-size lap is not permitted (AASHTO 5.10.8.4.5a)'), 'Report: bar schedule footnote');
  await set(f, { barSize: '8', fc: '2500' }, 'csplice'); await p.waitForTimeout(500);
  const sw = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const sw2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(sw <= 0 && sw2 <= 0, `no sideways page scroll (frame ${sw}, page ${sw2})`);
  ok(errs.length === 0, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
}
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
