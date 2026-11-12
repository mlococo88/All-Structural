// AB-1 (2026-11-12, engineer decision): the braking vertical couple [AASHTO LRFD 10th Ed. 3.6.4]
// P_BR = BR (h_brg + d_g + h_h + t_d + 6 ft) / L at the bearing line, with BR (gamma_LL m), uplift with BR toward the span and
// downward in the reversed permutations; not applied (REVIEW) while an elevation input is blank; an imported SubLoads BR keeps its own P.
// usage: node tests/smoke/abutment-br-couple.mjs [abutment_calculator.html]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.resolve(REPO, process.argv[2] || 'abutment_calculator.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const near = (a, b, t = 5e-4) => typeof a === 'number' && Math.abs(a - b) <= t;
const o = await openPage(FILE, { vw: 1400, vh: 1000 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const ELEV = 'S.geom.elBrgH=3; S.geom.elGird=54; S.geom.elHaunch=2; S.geom.elDeck=8;';
const IMP = 'S.rx.BR.forEach(r=>{r.P=-0.242; r.Vx=2.0; r.Vy=0.1;}); S.longit.computeBR=false; S.dist.shBR=100;';
const run = js => o.p.evaluate(js => {
  S = defaultState(); migrate(); eval(js); recalcAll();
  const R = window.LAST_R, C = R.checks, t = s => String(s || '').replace(/<[^>]+>/g, ''), T = R.permTables && R.permTables['Strength I'] || [];
  const r0 = T.find(x => !x.perm.rev && x.perm.DC === 0 && x.perm.EH === 0 && x.liveOn === 1), r1 = T.find(x => x.perm.rev && x.perm.DC === 0 && x.perm.EH === 0 && x.liveOn === 1);
  return { c: R.brCouple, BR: { V: R.groups.BR.V, Mv: R.groups.BR.Mv }, nFail: R.nFail, V0: r0 && r0.V, V1: r1 && r1.V,
    bearing: C.bearing && { dc: C.bearing.dc, V: C.bearing.V }, pc: C.pileComp && C.pileComp.P, pu: C.pileUplift && C.pileUplift.P,
    stemMu: R.stemDem && R.stemDem.Mu, seat: C.bearingSeat && C.bearingSeat.Pu,
    warn: WARNINGS.map(w => t(w.msg)).filter(m => /Braking vertical couple/.test(m)) };
}, js);

let r = await run('');
check(!r.c && r.BR.V === 0 && !r.warn.length, 'defaultState() (no BR): no couple, no warning');
// the project a new page opens with (example reactions: BR V_x 3.5 kip x 6 girders = 21 kip, table, share 50 %)
r = await run('seedExampleReactions();');
check(r.c && r.c.src === 'table' && r.c.P == null && r.BR.V === 0 && r.warn.length === 1, 'default page project, elevation inputs blank: not applied, REVIEW');
r = await run('seedExampleReactions();' + ELEV);
check(near(r.c.F, 21) && near(r.c.P, 21 * (67 / 12 + 6) / 80) && near(r.BR.V, -3.04063) && !r.warn.length, `default page project + elevations: P = 21 x 11.583 / 80 = ${r.c.P.toFixed(4)} kip`);
r = await run('S.longit.computeBR=true;');
check(r.c && r.c.P == null && r.c.miss.length === 4 && r.BR.V === 0 && r.warn.length === 1 && /^REVIEW/.test(r.warn[0]), 'BR on, elevation inputs blank: not applied, REVIEW warning');
const noC = r;
r = await run('S.longit.computeBR=true; S.geom.elBrgH=3; S.geom.elGird=54; S.geom.elDeck=8;');
check(r.c && r.c.P == null && r.c.miss.length === 1 && /haunch/.test(r.c.miss[0]), 'haunch blank: not applied (0 = no haunch must be entered)');

// hand check: BR_total = 45.90 kip (default, 3 lanes); h = (3 + 54 + 2 + 8)/12 + 6 = 11.583 ft; P = 45.90 x 11.583 / 80 = 6.646 kip
r = await run('S.longit.computeBR=true;' + ELEV);
check(r.c && near(r.c.h, 11.58333) && near(r.c.P, 6.64594) && near(r.BR.V, -6.64594) && near(r.BR.Mv, -6.64594 * 5.25) && !r.warn.length,
  `couple: h ${r.c && r.c.h.toFixed(3)} ft, P ${r.c && r.c.P.toFixed(3)} kip, V = -P (uplift) at x_brg 5.25 ft`);
check(near(r.V0 - noC.V0, -1.75 * 6.64594, 1e-3) && near(r.V1 - noC.V1, 1.75 * 6.64594, 1e-3), `Strength I: usual permutation -1.75P, reversed (BR toward the backfill) +1.75P: ${(r.V0 - noC.V0).toFixed(3)} / ${(r.V1 - noC.V1).toFixed(3)}`);
check(near(r.bearing.V, 1561.6821, 1e-3) && near(r.bearing.dc, 0.546166, 1e-5) && r.nFail === noC.nFail, `spread footing bearing: V 1573.31 -> ${r.bearing.V.toFixed(2)}, D/C 0.5490 -> ${r.bearing.dc.toFixed(4)}`);
check(r.stemMu === noC.stemMu && r.seat === noC.seat, 'stem M_u and the seat bearing P_u unchanged (couple not in the stem eccentricity / seat bearing)');
r = await run('S.longit.computeBR=true; S.dist.shBR=10;' + ELEV);
check(near(r.c.P, 6.64594), 'not x the BR share');
r = await run('S.fnd.branch="pile"; S.longit.computeBR=true;' + ELEV);
check(near(r.pc, 122.22212, 1e-3) && near(r.pu, -3.91336, 1e-3), `piles: P_max 122.92 -> ${r.pc.toFixed(2)}, P_min -3.64 -> ${r.pu.toFixed(2)} kip`);
r = await run('S.fnd.branch="pile"; S.longit.computeBR=true; S.dist.shBR=0;' + ELEV);
check(near(r.V1 - r.V0, 2 * 1.75 * 6.64594, 1e-3), 'share 0 (no H_BR here): the reversed permutations still run (P down)');

// imported SubLoads BR: its own P, nothing added
r = await run(IMP + ELEV);
check(r.c && r.c.src === 'imported' && near(r.BR.V, -1.452) && !r.warn.length, `imported BR: V = ΣP·share = ${r.BR.V.toFixed(3)} kip (6 × -0.242), no own couple`);
r = await run('S.iab.type="integral"; S.fnd.branch="pile"; S.longit.computeBR=true;' + ELEV);
check(!r.c, 'integral abutment: no couple');
r = await run('S.iab.type="semi"; S.longit.computeBR=true;' + ELEV);
check(r.c && near(r.c.P, 6.64594), 'semi-integral: applied');

// Tab 1 §1.6a and the Report
const ui = await o.p.evaluate(ELEV => { S = defaultState(); migrate(); S.longit.computeBR = true; eval(ELEV); buildInputs(); recalcAll(); activateTab('tab-loads');
  const c = document.querySelector('#tab-loads [data-cid="o-br-couple"]'), ct = c ? c.textContent.replace(/\s+/g, ' ') : '';
  const b = document.querySelector('#tab-loads [data-cid="o-longit-br"]'), bt = b ? b.textContent : '';
  const ke = document.querySelectorAll('#tab-loads .katex-error').length;
  activateTab('tab-rpt'); const t = document.getElementById('tab-rpt').textContent.replace(/\s+/g, ' ');
  const out = { card: !!c, ct: /11\.583/.test(ct) && /6\.646/.test(ct) && /engineer decision 2026-11-12/i.test(ct), br: /§1\.6a/.test(bt) && !/is not included/.test(bt), ke,
    rpt: /Braking vertical couple at the bearings/.test(t) && /6\.646/.test(t), rke: document.querySelectorAll('#tab-rpt .katex-error').length };
  activateTab('tab-loads'); return out; }, ELEV);
check(ui.card && ui.ct && ui.br && !ui.ke, 'Tab 1 §1.6a card (h, P), §1.6 note links it, no KaTeX error');
check(ui.rpt && !ui.rke, 'Report: worked step');
check(!o.errs.length, 'no console errors ' + JSON.stringify(o.errs));
await o.b.close();
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
