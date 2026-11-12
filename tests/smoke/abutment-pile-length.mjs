// ABPL (2026-11-12, engineer decision): the pile length L_pile (panel I-7, total incl. the embedment) in the pile checks of a pile footing:
// L_pile >= e/12 + L_u + D_f + 5 ft (dashboard "pileLen", Tab 4 section 4.4c, Report worked step); flags when the pile does not reach D_f
// and when L_s < 5T for the elastic (Matlock-Reese) lateral solution. Blank L_pile: no check, LAST_R as before.
// usage: node tests/smoke/abutment-pile-length.mjs [abutment_calculator.html]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.resolve(REPO, process.argv[2] || 'abutment_calculator.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const near = (a, b, t = 5e-4) => typeof a === 'number' && Math.abs(a - b) <= t;
const o = await openPage(FILE, { vw: 1400, vh: 1000 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const run = js => o.p.evaluate(js => {
  S = defaultState(); migrate(); eval(js); recalcAll();
  const R = window.LAST_R, d = (R.dash || []).find(x => x.id === 'pileLen') || null, t = s => String(s || '').replace(/<[^>]+>/g, '');
  return { PL: R.checks && R.checks.pileLen || null, d: d && { dc: d.dc, pass: d.pass, gov: d.gov }, nFail: R.nFail, has: !!(R.checks && 'pileLen' in R.checks),
    warn: WARNINGS.map(w => t(w.msg)).filter(m => /^Pile length/.test(m)) };
}, js);

let r = await run('S.fnd.branch="pile";');
check(!r.has && !r.d && !r.warn.length, 'pile footing, L_pile blank: no check, no R.checks.pileLen, no warning');
r = await run('S.piles.elLpile=40;');
check(!r.has && !r.d, 'spread footing with a stored L_pile: no check');

// hand check: default project on piles, HP12X53 (auto), I_w 125.355 in^4, s/D 4.25 -> group 0.4375, n_h 1.11 x 0.4375 = 0.485625 ksi/ft
// D_f = 1.8(29000 x 0.0060453 / 0.485625)^0.2 = 5.845 ft; L_req = 1 + 0 + 5.845 + 5 = 11.845 ft; L_pile 40 -> D/C 0.296; L_s 39, T_x 3.247 -> 12.01T
r = await run('S.fnd.branch="pile"; S.piles.elLpile=40;');
check(r.PL && near(r.PL.Df, 5.8449) && near(r.PL.req, 11.8449) && near(r.PL.dc, 0.29612) && r.PL.Ls === 39 && r.PL.reach && r.d && r.d.pass === true && !r.warn.length,
  `L_pile 40: D_f ${r.PL && r.PL.Df.toFixed(3)}, L_req ${r.PL && r.PL.req.toFixed(3)}, D/C ${r.d && r.d.dc.toFixed(4)} PASS`);
check(r.PL.mr && near(r.PL.mr.L.T, 3.2472) && near(r.PL.mr.L.z, 12.0105, 1e-3) && !r.PL.mr.short.length, `long-pile premise x: L_s/T = ${r.PL.mr && r.PL.mr.L.z.toFixed(2)} >= 5`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=40; S.piles.Lu=5;');
check(near(r.PL.req, 16.8449) && near(r.PL.dc, 0.42112) && r.PL.Ls === 34, `L_u 5 ft: L_req = 1 + 5 + 5.845 + 5 = ${r.PL.req.toFixed(3)}, L_s 34, D/C ${r.PL.dc.toFixed(4)}`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=15;');
check(near(r.PL.dc, 0.78966) && r.d.pass === true && r.PL.mr.short.join() === 'L' && r.warn.length === 1 && /4\.31T/.test(r.warn[0]), `L_pile 15: D/C ${r.PL.dc.toFixed(4)} PASS, L_s/T_x = 4.31 < 5 flagged (long-pile moment kept)`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=6;');
check(near(r.PL.dc, 1.97415) && r.d.pass === false && !r.PL.reach && r.warn.length === 2 && /does not reach the depth to fixity/.test(r.warn.join()), `L_pile 6: D/C ${r.PL.dc.toFixed(3)} FAIL, does not reach D_f (L_s 5.00 < 5.845), both flags`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=20; S.piles.MuPy=40;');
check(r.PL && !r.PL.mr && r.d.pass === true, 'p-y moment entered: the long-pile premise is not checked (elastic solution not used)');
r = await run('S.fnd.branch="pile"; S.piles.pileShape="square"; S.piles.elLpile=40;');
check(r.PL && r.PL.dc == null && r.d && r.d.pass === null, 'square pile: no depth to fixity, row n/a');
r = await run('S.iab.type="integral"; S.fnd.branch="pile"; S.piles.elLpile=6;');
check(!r.d && !r.warn.length, 'integral abutment: no pile-footing length row (its piles: iab.Lpile, owner rules)');

// Tab 4 section 4.4c and the Report
const ui = await o.p.evaluate(() => { S = defaultState(); migrate(); S.fnd.branch = 'pile'; S.piles.elLpile = 40; buildInputs(); recalcAll(); activateTab('tab-found');
  const c = document.querySelector('#tab-found [data-cid="o-pilelen"]'), ct = c ? c.textContent.replace(/\s+/g, ' ') : '';
  const ke = document.querySelectorAll('#tab-found .katex-error').length;
  activateTab('tab-rpt'); const t = document.getElementById('tab-rpt').textContent.replace(/\s+/g, ' ');
  const out = { card: !!c, ct: /11\.845/.test(ct) && /12\.01/.test(ct) && /engineer decision 2026-11-12/.test(ct), ke, rpt: /Pile length: depth to fixity \+ 5 ft/.test(t), echo: /the pile length check, Tab 4 §4\.4c/.test(t), rke: document.querySelectorAll('#tab-rpt .katex-error').length };
  activateTab('tab-found'); return out; });
check(ui.card && ui.ct && !ui.ke, 'Tab 4 §4.4c card with L_req 11.845 and L_s/T 12.01, no KaTeX error');
check(ui.rpt && ui.echo && !ui.rke, 'Report: worked step and the input echo row');
check(!o.errs.length, 'no console errors ' + JSON.stringify(o.errs));
await o.b.close();
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
