#!/usr/bin/env node
// MBE4A regression (2026-11-10): Concrete Beam Capacity, ASD tab: allowables from AASHTO MBE 4th Ed. (2026).
//  - f_c,op automatic from Table 6B.5.2.4.1-1 (p. 6-174), operating column, by the f'c row (between rows: the lower row;
//    below 2,000 psi: no rule, the entry stays). Before: always the entered value (default 1,900 psi), warned above 0.60 f'c.
//  - f_s,inv / f_s,op automatic from Table 6B.5.2.3-1 (p. 6-173) by f_y: 33,000 18,000/25,000; 36,000 20,000/27,000;
//    40,000 20,000/28,000; 50,000 20,000/32,500; 60,000 24,000/36,000. Before: Gr 40 and Gr 60 only (+ Gr 50 inventory).
//  - Hand check (rectangular b = 14 in, d = 28.5 in, A_s = 4.00 in², f'c = 3,000 psi, M_DL = 100, M_LL+I = 60 kip-ft):
//    n = 9, k = 0.3440, kd = 9.805 in, z = 25.232 in, C = 0.5 b kd = 68.64 in².
//    Gr 40: inv M_steel 168.21 (RF 1.137), op M_steel 235.49 (RF 2.258)            (before = after)
//    Gr 50: op f_s 28,000 -> 32,500: M_steel 235.49 -> 273.34, RF 2.258 -> 2.889       (inventory as before)
//    Gr 60: inv M_conc 173.18 (RF 1.220), op M_conc 274.21 (RF 2.903)               (before = after)
//  - A typed value is an override and stays; a save made before MBE4A keeps a value that had no rule then as entered.
//  - The "> 0.60 f'c" warning and "MassDOT value" wording are gone; tab and Report state the table basis.
//  - MBE4B (2026-11-10, engineer): f_c,inv automatic from Table 6B.5.2.4.1-1, inventory column (800 / 1,000 / 1,200 / 1,600 /
//    2,000 psi; lower row between rows; below 2,000 psi no rule, entry kept). Before: 0.40 f'c. n stays Std. Spec. 8.15.3.4.
//    Hand check, same beam at f'c = 3,500 psi (n = 9 as at 3,000): f_c,inv 1,400 -> 1,200 psi; Gr 60 inventory M_all
//    201.85 (steel) -> 173.18 (concrete), RF 1.697 -> 1.220; Gr 40 / 50 inventory RF 1.137 (steel) unchanged.
//  - 0 console errors; no sideways scroll at 390 px.
//   node tests/smoke/cbc-asd-mbe4.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t = 0.006) => Math.abs(a - b) <= t;

for (const vw of [1400, 390]) {
  const { b, p, errs } = await openPage(FILE, { hash: '#asd', vw, vh: 900 });
  await p.waitForSelector('#suite-frame-asd', { state: 'attached' });
  const f = await (await p.$('#suite-frame-asd')).contentFrame();
  await f.waitForFunction(() => typeof compute === 'function' && typeof autoAllow === 'function', null, { timeout: 30000 });
  await p.waitForTimeout(2500);   // let the Beam Capacity relay settle
  console.log('--- viewport ' + vw + ' px');
  // hand-check section, set in the ASD frame (the relay only runs when Beam Capacity recomputes)
  const run = (fc, fy, allow) => f.evaluate(([fc, fy, allow]) => {
    S.inherit = { ...S.inherit, fc, fy, shape: 'rect', b_w: 14, b_eff: 14, h_f: 0, h_total: 32, d_eff: 28.5, as: 4, d_pos: 28.5, as_pos: 4, d_neg: 28.5, as_neg: 4 };
    S.mode.momentType = 'pos'; S.mode.inv = true; S.mode.op = true; S.loads = { m_dl: 100, m_ll: 60 };
    S.allow = allow ? JSON.parse(JSON.stringify(allow)) : JSON.parse(JSON.stringify(defaultState().allow));
    refresh(); const R = compute();
    return { A: { ...S.allow }, ovr: { ...S.allow.ovr }, n: R.n, z: R.z, Cff: R.Cff, Mci: R.M_conc_inv, Msi: R.M_steel_inv, Mco: R.M_conc_op, Mso: R.M_steel_op,
      rfi: R.rf_inv, rfo: R.rf_op, ci: R.ctrl_inv, co: R.ctrl_op, text: document.body.innerText.replace(/\s+/g, ' '), html: document.body.innerHTML,
      rpt: JSON.stringify(asdRptModel()), dash: JSON.stringify(asdDashItems()) };
  }, [fc, fy, allow || null]);

  let r = await run(3000, 40000);
  ok(r.n === 9 && near(r.z, 25.232, 0.002) && near(r.Cff, 68.64, 0.01), `section: n ${r.n}, z ${r.z.toFixed(3)}, C ${r.Cff.toFixed(2)} (9, 25.232, 68.64)`);
  ok(r.A.fc_inv === 1200 && r.A.fs_inv === 20000 && r.A.fc_op === 1900 && r.A.fs_op === 28000, `Gr 40 f'c 3,000: allowables ${r.A.fc_inv}/${r.A.fs_inv}/${r.A.fc_op}/${r.A.fs_op} (1,200/20,000/1,900/28,000)`);
  ok(near(r.Msi, 168.21) && near(r.rfi, 1.137, 0.001) && near(r.Mso, 235.49) && near(r.rfo, 2.258, 0.001) && r.ci === 'Steel' && r.co === 'Steel', `Gr 40: inv ${r.Msi.toFixed(2)} RF ${r.rfi.toFixed(3)}, op ${r.Mso.toFixed(2)} RF ${r.rfo.toFixed(3)} (168.21/1.137, 235.49/2.258)`);
  ok(!/0\.60f|MassDOT value/.test(r.text + r.rpt + r.dash), 'no 0.60 f\'c warning or "MassDOT value" wording (tab, Report, checks)');
  ok(r.html.includes('Table 6B.5.2.4.1-1 (p. 6-174)') && r.html.includes('Table 6B.5.2.3-1 (p. 6-173)') && r.html.includes('50,000 psi (Gr 50) 20,000 / 32,500'), 'Allowables card: table basis note');
  ok(r.rpt.includes('Allowable stresses: AASHTO MBE 4th Ed. (2026) 6B.5.2') && r.rpt.includes('MBE Table 6B.5.2.4.1-1 (p. 6-174), operating column') && r.rpt.includes('(1,900 psi; between two rows the lower row is used)'), 'Report: allowable basis note');
  r = await run(3000, 50000);
  ok(r.A.fs_inv === 20000 && r.A.fs_op === 32500 && !r.ovr.fs_op, `Gr 50: f_s,op ${r.A.fs_op} (auto 32,500; before no rule)`);
  ok(near(r.Mso, 273.34) && near(r.rfo, 2.889, 0.001) && near(r.Msi, 168.21) && near(r.rfi, 1.137, 0.001), `Gr 50: op M ${r.Mso.toFixed(2)} RF ${r.rfo.toFixed(3)} (273.34/2.889; before 235.49/2.258); inv RF ${r.rfi.toFixed(3)}`);
  ok(!/no rule for f_y/.test(r.dash), 'Gr 50: no "no rule" notice');
  r = await run(3000, 60000);
  ok(r.A.fs_inv === 24000 && r.A.fs_op === 36000 && near(r.Mci, 173.18) && near(r.rfi, 1.220, 0.001) && near(r.Mco, 274.21) && near(r.rfo, 2.903, 0.001) && r.co === 'Concrete',
    `Gr 60: inv ${r.Mci.toFixed(2)} RF ${r.rfi.toFixed(3)}, op ${r.Mco.toFixed(2)} RF ${r.rfo.toFixed(3)} (173.18/1.220, 274.21/2.903, concrete)`);
  // MBE4B: f_c,inv from the inventory column
  r = await run(3500, 60000);
  ok(r.n === 9 && r.A.fc_inv === 1200 && !r.ovr.fc_inv && near(r.Mci, 173.18) && near(r.Msi, 201.85) && r.ci === 'Concrete' && near(r.rfi, 1.220, 0.001) && near(r.rfo, 2.903, 0.001),
    `f'c 3,500 Gr 60: f_c,inv ${r.A.fc_inv} (1,200; before 1,400), inv ${r.Mci.toFixed(2)} ${r.ci} RF ${r.rfi.toFixed(3)} (173.18 concrete, 1.220; before 201.85 steel, 1.697)`);
  r = await run(3500, 40000);
  ok(r.A.fc_inv === 1200 && near(r.Msi, 168.21) && near(r.rfi, 1.137, 0.001) && r.ci === 'Steel', `f'c 3,500 Gr 40: inv RF ${r.rfi.toFixed(3)} (1.137, unchanged)`);
  ok(r.html.includes('800 / 1,200 psi for f\'_c 2,000–2,400') && r.html.includes('Std. Spec. 8.15.3.4; MBE 6B.5.2.4 permits the Art. 8.15 method'), 'Allowables card: inventory column and n basis');
  ok(r.rpt.includes('inventory column, row of') && r.rpt.includes('= 3,500 psi (1,200 psi; between two rows') && r.rpt.includes('Modular ratio n:'), 'Report: inventory basis and n note');
  for (const [fc, v] of [[2000, 800], [2450, 800], [2500, 1000], [3000, 1200], [3950, 1200], [4000, 1600], [5000, 2000], [8000, 2000]]) {
    r = await run(fc, 60000); ok(r.A.fc_inv === v && !r.ovr.fc_inv, `f'c ${fc}: f_c,inv ${r.A.fc_inv} (${v})`); }
  r = await run(1800, 60000);
  ok(r.A.fc_inv === 1200 && r.dash.includes('Allowable f_c,inv') && r.rpt.includes('inventory $f_{c}$ = 1,200 psi is the entered value'), 'f\'c 1,800: no inventory row, entry kept (1,200), REVIEW and Report note');
  await run(3500, 60000);
  await f.evaluate(() => { const i = document.querySelector('[data-fkey="fcInv"]'); i.value = '1400'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  r = await f.evaluate(() => ({ A: { ...S.allow }, ovr: { ...S.allow.ovr }, dash: JSON.stringify(asdDashItems()), rpt: JSON.stringify(asdRptModel()) }));
  ok(r.A.fc_inv === 1400 && r.ovr.fc_inv && r.dash.includes('f_c,inv > Table value') && r.rpt.includes('inventory $f_{c}$ = 1,400 psi (entered)'), 'typed f_c,inv 1,400 at f\'c 3,500: override, REVIEW (> 1,200)');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1400, fs_inv: 24000, fc_op: 1900, fs_op: 36000 }, inherit: { ...S.inherit, fc: 3500, fy: 60000 } }); applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_inv === 1200 && !r.ovr.fc_inv, 'save without flags, f_c,inv = 0.40 f\'c (automatic then): follows the table (1,200)');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1300, fs_inv: 24000, fc_op: 1900, fs_op: 36000 }, inherit: { ...S.inherit, fc: 3500, fy: 60000 } }); applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_inv === 1300 && r.ovr.fc_inv, 'save without flags, f_c,inv entered (1,300): kept');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1400, fs_inv: 24000, fc_op: 1900, fs_op: 36000, ovr: { fc_inv: false, fs_inv: false, fs_op: false, fc_op: false } }, inherit: { ...S.inherit, fc: 3500, fy: 60000 } }); applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_inv === 1200 && !r.ovr.fc_inv, 'MBE4A save, f_c,inv automatic: follows the table (1,200)');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1400, fs_inv: 24000, fc_op: 1900, fs_op: 36000, ovr: { fc_inv: true, fs_inv: false, fs_op: false, fc_op: false } }, inherit: { ...S.inherit, fc: 3500, fy: 60000 } }); applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_inv === 1400 && r.ovr.fc_inv, 'saved f_c,inv override: kept (1,400)');
  for (const [fy, fi, fo] of [[33000, 18000, 25000], [36000, 20000, 27000]]) { r = await run(3000, fy); ok(r.A.fs_inv === fi && r.A.fs_op === fo, `f_y ${fy}: ${r.A.fs_inv}/${r.A.fs_op} (${fi}/${fo})`); }
  for (const [fc, v] of [[2000, 1200], [2450, 1200], [2500, 1500], [2900, 1500], [3950, 1900], [4000, 2400], [4900, 2400], [5000, 3000], [8000, 3000]]) {
    r = await run(fc, 60000); ok(r.A.fc_op === v && !r.ovr.fc_op, `f'c ${fc}: f_c,op ${r.A.fc_op} (${v})`); }
  r = await run(1800, 60000);
  ok(r.A.fc_op === 1900 && r.dash.includes('no row for f′c') && r.rpt.includes('below the first row'), 'f\'c 1,800: no row, entry kept (1,900), REVIEW notice and Report note');
  // typed value = override, kept when f'c changes; above the table value -> REVIEW
  await run(4000, 60000);
  await f.evaluate(() => { const i = document.querySelector('[data-fkey="fcOp"]'); i.value = '2600'; i.dispatchEvent(new Event('input', { bubbles: true })); });
  r = await f.evaluate(() => ({ A: { ...S.allow }, ovr: { ...S.allow.ovr }, dash: JSON.stringify(asdDashItems()) }));
  ok(r.A.fc_op === 2600 && r.ovr.fc_op === true && r.dash.includes('f_c,op > Table value'), 'typed f_c,op 2,600 at f\'c 4,000: override, REVIEW (> 2,400)');
  r = await f.evaluate(() => { S.inherit.fc = 5000; refresh(); return { A: { ...S.allow } }; });
  ok(r.A.fc_op === 2600, 'override kept when f\'c changes');
  r = await f.evaluate(() => { [...document.querySelectorAll('button')].find(x => /Recompute allowables/.test(x.textContent)).click(); return { A: { ...S.allow } }; });
  ok(r.A.fc_op === 3000, 'Recompute: f_c,op back to the table value (3,000 at f\'c 5,000)');
  // saves made before MBE4A
  r = await f.evaluate(() => { const st = { allow: { fc_inv: 1600, fs_inv: 20000, fc_op: 1900, fs_op: 28000, ovr: { fc_inv: false, fs_inv: false, fs_op: false } },
      inherit: { ...S.inherit, fc: 4000, fy: 50000 } }; mergeState(st); applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_op === 1900 && r.ovr.fc_op && r.A.fs_op === 28000 && r.ovr.fs_op && r.A.fs_inv === 20000 && !r.ovr.fs_inv, 'old save (flags, Gr 50, f\'c 4,000): f_c,op 1,900 and f_s,op 28,000 kept as entered');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1200, fs_inv: 24000, fc_op: 1900, fs_op: 36000, ovr: { fc_inv: false, fs_inv: false, fs_op: false } }, inherit: { ...S.inherit, fc: 3000, fy: 60000 } });
      applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_op === 1900 && !r.ovr.fc_op && !r.ovr.fs_op, 'old save equal to the table value: automatic');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1600, fs_inv: 20000, fc_op: 2000, fs_op: 30000 }, inherit: { ...S.inherit, fc: 4000, fy: 50000 } });
      applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_op === 2000 && r.ovr.fc_op && r.A.fs_op === 30000 && r.ovr.fs_op, 'older save without flags: entered values kept');
  r = await f.evaluate(() => { mergeState({ allow: { fc_inv: 1600, fs_inv: 20000, fc_op: 2400, fs_op: 32500, ovr: { fc_inv: false, fs_inv: false, fs_op: false, fc_op: false } }, inherit: { ...S.inherit, fc: 3000, fy: 50000 } });
      applyAutoAllow(); return { A: { ...S.allow }, ovr: { ...S.allow.ovr } }; });
  ok(r.A.fc_op === 1900 && !r.ovr.fc_op && r.A.fs_op === 32500, 'new save (fc_op flag false): follows the table');
  const sw = await f.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  const sw2 = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok(sw <= 0 && sw2 <= 0, `no sideways page scroll (frame ${sw}, page ${sw2})`);
  ok(errs.length === 0, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 2).join(' | ') : ''));
  await b.close();
}
console.log(fails ? fails + ' FAIL' : 'ALL PASS'); process.exit(fails ? 1 : 0);
