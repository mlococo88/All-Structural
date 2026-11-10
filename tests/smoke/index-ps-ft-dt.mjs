#!/usr/bin/env node
// index.html (girder rating): PS Conc card and Report (IXPSD, 2026-11-10, display only).
//   1. The card's Service III tension-limit line prints the coefficient the check uses (frCoeff of psServiceIIIData):
//      0.0948√f'c for Severe exposure, 0.19√f'c otherwise, with the citation LRFD Table 5.9.2.3.2b-1; the same in Report §4.
//   2. The PS card has a "Dt (in) ductility" box for the depth z.d that the PS Strength I ductility line reads (Dp ≤ 0.42·Dt);
//      blank or 0 = the line is not shown (as before), a value shows it; the box writes the zone's existing field d.
//   3. With --ref <index.html of origin/main, in a full copy of the repository>: the same seeded projects opened in both files give the
//      same localStorage, the same PS Strength I, PS Service III and Summary views, and differ on the Inputs step and the Report only
//      by the lines of 1 and 2.
//   node tests/smoke/index-ps-ft-dt.mjs [--file index.html] [--ref /tmp/main/index.html]
// Hand check (zone of the cases): f'c = 6 ksi, √6 = 2.44949; Moderate f_t = 0.19·2.44949 = 0.465 ksi, + fpe 0.5 = 0.965 ksi;
//   Severe f_t = 0.0948·2.44949 = 0.232 ksi, + 0.5 = 0.732 ksi. Aps = 4.896 in², fpu = 270, fpy = 243, dp = 50, b = 72, hf = 7.5:
//   β1 = 0.75, α1 = 0.85, k = 0.28, c = 1321.92 / (275.4 + 7.40275) = 4.674 in (a = 3.506 in < hf, rectangular);
//   Dt = 54 in: 0.42·Dt = 22.680 in, Dp = 4.674 ≤ 22.680 ✓ OK.
import path from 'path';
import { open, step, subTab, CASES } from './index-report.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', 'index.html')), REF = arg('ref', null) ? path.resolve(arg('ref')) : null;

const psZone = extra => ({ id: 'capP', startX: 0, endX: 81, type: 'psconc', MnPos: 0, MnNeg: 3000, Vn: 0, Fy: 50, ZxPos: 0, ZxNeg: 0, Aw: 0, SxPos: 0, SxNeg: 0,
  aremaComps: null, outToOut: 42, fc: 6, Aps: 4.896, fpu: 270, fpy: 243, dp: 50, fpe: 0.5, b: 72, hf: 7.5, bw: 8, dv: 45, Av: 0.4, s: 12,
  Sb: 12000, St: 9000, ...extra });
const B = CASES.base;
CASES.psmod = { ...B, cfg: { ...B.cfg, rating: { ...B.cfg.rating, structType: 'psconc', ps3Exposure: 'moderate' } }, zones: [psZone({})] };
CASES.pssev = { ...B, cfg: { ...B.cfg, rating: { ...B.cfg.rating, structType: 'psconc', ps3Exposure: 'severe' } }, zones: [psZone({ d: 54 })] };

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const text = p => p.evaluate(() => document.querySelector('#root').innerText);
// bridgeSuite.v1.appPaths records the folder the file was opened from and when: it differs between two copies by design
const ls = p => p.evaluate(() => Object.fromEntries(Object.keys(localStorage).sort().filter(k => k !== 'bridgeSuite.v1.appPaths').map(k => [k, localStorage.getItem(k)])));
const noClock = t => t.replace(/\d{1,2}\/\d{1,2}\/\d{4},? \d{1,2}:\d{2}:\d{2}( [AP]M)?/g, '<time>');

async function views(file, cs) {
  const o = await open(file, cs), p = o.p, V = {};
  V.ls = await ls(p);
  await step(p, 'AASHTO Rating'); await p.waitForTimeout(1200);
  V.inputs = await text(p);
  for (const [k, l] of [['ps1', 'PS Strength I'], ['ps3', 'PS Service III'], ['summary', 'Summary']]) { await subTab(p, l); V[k] = await text(p); }
  await subTab(p, 'Inputs & Setup');
  await step(p, 'Report'); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await p.waitForTimeout(1200);
  await p.emulateMedia({ media: 'print' });
  V.report = noClock(await p.evaluate(() => document.querySelector('#rp-print').innerText));
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(600);
  V.errs = o.errs;
  return { o, V };
}
const lines = t => t.split('\n').map(s => s.trim()).filter(Boolean);
const only = (a, b) => { const A = new Set(lines(a)); return lines(b).filter(x => !A.has(x)); };

for (const cs of ['psmod', 'pssev']) {
  const sev = cs === 'pssev';
  const { o, V } = await views(FILE, cs);
  const p = o.p;
  ok(V.inputs.includes(sev ? "f_t = 0.0948√f'c = 0.232 ksi (Severe exposure; tension limit of LRFD Table 5.9.2.3.2b-1, not f_r)" : "f_t = 0.19√f'c = 0.465 ksi (Moderate exposure; tension limit of LRFD Table 5.9.2.3.2b-1, not f_r)"), cs + ': card f_t line with the coefficient the check uses');
  ok(V.inputs.includes('limit = f_t+fpe = ' + (sev ? '0.732' : '0.965') + ' ksi'), cs + ': card limit f_t + fpe');
  ok(!sev || !V.inputs.includes("0.19√f'c = 0.465"), cs + ': no 0.19 value printed for Severe');
  ok(V.inputs.includes('Dt (in) ductility') && V.inputs.includes('Dt (in), optional:') && V.inputs.includes('Blank or 0: the line is not shown'), cs + ': Dt box, label and note on the PS card');
  ok(sev ? /Ductility: Dp=4\.674 in · 0\.42·Dt=22\.68 in · ✓ OK/.test(V.ps1) : !/Ductility: Dp=/.test(V.ps1), cs + ': PS Strength I ductility line ' + (sev ? 'shown (Dt = 54)' : 'not shown (Dt blank)'));
  ok(V.report.includes(sev ? 'f_t = 0.0948√f′c = 0.0948√6.00 = 0.232 ksi (Severe exposure' : 'f_t = 0.19√f′c = 0.19√6.00 = 0.465 ksi (Moderate exposure'), cs + ': Report §4 f_t note');
  ok(V.report.includes(sev ? 'Dt = 54.00 in: the PS Strength I ductility line checks Dp = c ≤ 0.42·Dt = 22.680 in.' : 'Dt blank: the PS Strength I ductility line is not shown.'), cs + ': Report §4 Dt note');
  ok(!V.errs.length, cs + ': 0 console errors ' + JSON.stringify(V.errs.slice(0, 2)));
  if (!sev) {
    // the box: typing 54 stores d = 54 on the zone and shows the line; clearing it stores 0 and hides it again
    await step(p, 'AASHTO Rating'); await subTab(p, 'Inputs & Setup');
    const box = () => p.locator('xpath=//div[normalize-space(text())="Dt (in) ductility"]/following-sibling::input').first();
    ok(await box().inputValue() === '', cs + ': box blank for a saved zone without d');
    await box().fill('54'); await p.waitForTimeout(600);
    const z1 = JSON.parse(await p.evaluate(() => localStorage.getItem('mct_cap_zones_v1')))[0];
    ok(z1.d === 54, cs + ': typed 54 → zone d = 54');
    await subTab(p, 'PS Strength I');
    ok(/Ductility: Dp=4\.674 in · 0\.42·Dt=22\.68 in · ✓ OK/.test(await text(p)), cs + ': line shown after typing Dt');
    await subTab(p, 'Inputs & Setup'); await box().fill(''); await p.waitForTimeout(600);
    const z2 = JSON.parse(await p.evaluate(() => localStorage.getItem('mct_cap_zones_v1')))[0];
    ok(z2.d === 0, cs + ': cleared → zone d = 0');
    await subTab(p, 'PS Strength I');
    ok(!/Ductility: Dp=/.test(await text(p)), cs + ': line hidden again after clearing');
  }
  await o.b.close();
  if (REF) {
    const { o: oa, V: A } = await views(REF, cs); await oa.b.close();
    const lsd = Object.keys({ ...A.ls, ...V.ls }).filter(k => A.ls[k] !== V.ls[k]);
    ok(!lsd.length, cs + ' probe: localStorage after load identical to main ' + JSON.stringify(lsd.map(k => [k, String(A.ls[k]).slice(0, 120), String(V.ls[k]).slice(0, 120)])));
    for (const k of ['ps1', 'ps3', 'summary']) ok(A[k] === V[k], cs + ' probe: ' + k + ' view identical to main');
    const inB = only(A.inputs, V.inputs), inA = only(V.inputs, A.inputs);
    ok(inA.every(x => /^f_t = 0\.19√f'c/.test(x)) && inB.every(x => /^f_t = |^Dt \(in\)/.test(x) || x === 'blank' || x === '54'), cs + ' probe: Inputs differ only by the f_t line and the Dt box\n     main only: ' + JSON.stringify(inA) + '\n     branch only: ' + JSON.stringify(inB.map(x => x.slice(0, 90))));
    const rB = only(A.report, V.report), rA = only(V.report, A.report);
    ok(!rA.length && rB.every(x => /^PS Conc zones, as on|^• Zone 1 \(|^• Dt: Dt \(in\)/.test(x)), cs + ' probe: Report differs only by the §4 PS notes\n     main only: ' + JSON.stringify(rA.slice(0, 5)) + '\n     branch only: ' + JSON.stringify(rB.map(x => x.slice(0, 90))));
  }
}
{  // 390 px: the PS card (with the Dt box and its note) adds no sideways scroll; compared with main where --ref is given
  const over = async file => { const o = await open(file, 'pssev', { vw: 390, vh: 844 }); await step(o.p, 'AASHTO Rating'); await o.p.waitForTimeout(1200);
    const r = await o.p.evaluate(() => { const e = document.scrollingElement; const box = [...document.querySelectorAll('div')].find(d => d.textContent.trim() === 'Dt (in) ductility');
      const row = box && box.parentElement.parentElement, rr = row && row.getBoundingClientRect();
      return { page: e.scrollWidth - e.clientWidth, row: rr ? Math.round(rr.right - row.parentElement.getBoundingClientRect().right) : null }; });
    await o.b.close(); return r; };
  const b = await over(FILE), a = REF ? await over(REF) : null;
  ok((a ? b.page <= a.page : b.page <= 1) && (b.row === null || b.row <= 1), '390 px: page sideways scroll ' + b.page + 'px' + (a ? ' (main ' + a.page + 'px)' : '') + ', Dt row inside its card (' + b.row + 'px)');
}
if (REF) {   // a project without PS zones: the Inputs step and the Report identical to main
  const { o: ob, V } = await views(FILE, 'base'); await ob.b.close();
  const { o: oa, V: A } = await views(REF, 'base'); await oa.b.close();
  for (const k of ['ls', 'inputs', 'ps1', 'ps3', 'summary', 'report']) ok(JSON.stringify(A[k]) === JSON.stringify(V[k]), 'base probe: ' + k + ' identical to main');
}
console.log(fails ? fails + ' failure(s)' : 'all passed');
process.exit(fails ? 1 : 0);
