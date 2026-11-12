// ABPL (2026-11-12, engineer decision): the pile length L_pile (panel I-7, total incl. the embedment) in the pile checks of a pile footing:
// L_pile >= e/12 + L_u + D_f + 5 ft (dashboard "pileLen", Tab 4 section 4.4c, Report worked step); flags when the pile does not reach D_f
// and when L_s < 5T for the elastic (Matlock-Reese) lateral solution. Blank L_pile: no check, LAST_R as before.
// AB-4 (2026-11-12, engineer decision): L_s < 5T (5R in clay) on an axis carrying moment is a FAILED check (dashboard "pileShort", D/C = 5T/L_s).
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
  const ds = (R.dash || []).find(x => x.id === 'pileShort') || null;   // AB-4 (2026-11-12): L_s < 5T is a failed check
  return { PL: R.checks && R.checks.pileLen || null, d: d && { dc: d.dc, pass: d.pass, gov: d.gov }, ds: ds && { dc: ds.dc, pass: ds.pass, gov: ds.gov, txt: ds.txt }, nFail: R.nFail, has: !!(R.checks && 'pileLen' in R.checks),
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
check(r.ds && near(r.ds.dc, 5 * 3.2472 / 39, 1e-3) && r.ds.pass === true && r.nFail === 0, `long-pile check row: D/C = 5T/L_s = 5 x 3.247 / 39 = ${r.ds && r.ds.dc.toFixed(4)} PASS`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=40; S.piles.Lu=5;');
check(near(r.PL.req, 16.8449) && near(r.PL.dc, 0.42112) && r.PL.Ls === 34, `L_u 5 ft: L_req = 1 + 5 + 5.845 + 5 = ${r.PL.req.toFixed(3)}, L_s 34, D/C ${r.PL.dc.toFixed(4)}`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=15;');
check(near(r.PL.dc, 0.78966) && r.d.pass === true && r.PL.mr.short.join() === 'L' && r.warn.length === 1 && /4\.31T/.test(r.warn[0]), `L_pile 15: D/C ${r.PL.dc.toFixed(4)} PASS, L_s/T_x = 4.31 < 5 flagged (long-pile moment kept)`);
// AB-4 (2026-11-12, engineer decision): L_s 14 < 5T 16.236 -> FAIL, D/C = 16.236/14 = 1.1597; nFail 0 -> 1; the pile results still shown
const r0 = await run('S.fnd.branch="pile";');
check(r.ds && near(r.ds.dc, 5 * 3.2472 / 14, 1e-3) && r.ds.pass === false && r.nFail === r0.nFail + 1 && r.PL.reach, `L_pile 15: long-pile check D/C = 5 x 3.247 / 14 = ${r.ds && r.ds.dc.toFixed(4)} FAIL (nFail ${r0.nFail} -> ${r.nFail})`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=6;');
check(near(r.PL.dc, 1.97415) && r.d.pass === false && !r.PL.reach && r.warn.length === 2 && /does not reach the depth to fixity/.test(r.warn.join()), `L_pile 6: D/C ${r.PL.dc.toFixed(3)} FAIL, does not reach D_f (L_s 5.00 < 5.845), both flags`);
check(r.ds && near(r.ds.dc, 5 * 3.2472 / 5, 1e-3) && r.ds.pass === false && r.nFail === r0.nFail + 2, `L_pile 6: long-pile check D/C ${r.ds && r.ds.dc.toFixed(3)} FAIL too (nFail ${r0.nFail} -> ${r.nFail})`);
r = await run('S.fnd.branch="pile"; S.piles.elLpile=20; S.piles.MuPy=40;');
check(r.PL && !r.PL.mr && r.d.pass === true && !r.ds, 'p-y moment entered: the long-pile premise is not checked (elastic solution not used), no row');
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
// AB-4 / AB-2 / AB-3 (2026-11-12): the failed long-pile check in Tab 4 §4.4c and the Report; the notes on the 5 ft margin and D_f
const u2 = await o.p.evaluate(() => { S = defaultState(); migrate(); S.fnd.branch = 'pile'; S.piles.elLpile = 15; buildInputs(); recalcAll(); activateTab('tab-found');
  const c = document.querySelector('#tab-found [data-cid="o-pilelen"]'), ct = c ? c.textContent.replace(/\s+/g, ' ') : '';
  const fl = c ? [...c.querySelectorAll('.checkline.fail')].length : 0, ke = document.querySelectorAll('#tab-found .katex-error').length;
  activateTab('tab-rpt'); const t = document.getElementById('tab-rpt').textContent.replace(/\s+/g, ' ');
  const out = { fl, ke, ct: /adopted from MassDOT 3\.10\.11\.2/.test(ct) && /MassDOT 3\.2\.2\.2/.test(ct) && /Pile Designer\), the one of the buckling length/.test(ct) && /FAILS/.test(ct),
    rpt: /Long-pile premise \(longitudinal H; L_s < 5T fails/.test(t) && /adopted from MassDOT 3\.10\.11\.2/.test(t), rke: document.querySelectorAll('#tab-rpt .katex-error').length };
  activateTab('tab-found'); return out; });
check(u2.fl === 1 && u2.ct && !u2.ke, `L_pile 15: Tab 4 §4.4c long-pile check line FAIL, the 5 ft / D_f notes (engineer decisions 2026-11-12), no KaTeX error ${JSON.stringify(u2)}`);
check(u2.rpt && !u2.rke, 'L_pile 15: Report long-pile D/C step and the 5 ft note');
check(!o.errs.length, 'no console errors ' + JSON.stringify(o.errs));
await o.b.close();
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
