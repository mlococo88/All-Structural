#!/usr/bin/env node
// CBBS (2026-11-13): Concrete Beam Capacity, Beam Capacity tab: the header chip and a layer's bar size.
//  1. The engineer's state (one-way slab, layer T1 #5 @ 4 in, Set d 6.25 in, h 8 in, no shrinkage and temperature bars, all actions 0):
//     the layer keeps #5 (the Size select shows "#5"); A_s = 3(0.31) = 0.93 in²/ft; a = 0.93(60)/(0.85(4)(12)) = 1.368 in;
//     φM_n = 0.9(0.93)(60)(6.25 − 0.684)/12 = 23.29 kip-ft/ft. The S&T checks FAIL (none entered, as before), and the chip reads
//     "DCR ≫1 ✗" (was "NO CAPACITY ✗") with the not-entered checks named in its tooltip. With S&T #4 @ 12: no ≫1, chip "DCR … ✓".
//  2. A strength check with no capacity still reads "NO CAPACITY ✗" (slab with bottom bars only under a negative M_u).
//  3. A layer whose bar size is not a bar (an edited or imported file, size "99"): no page error, "INPUT INVALID", the blocker
//     "Layer T1: choose a bar size …", the layer's Size select outlined; choosing #6 clears it and the results return.
// 1400 and 390 px, file://, 0 console errors.
//   node tests/smoke/cbc-bar-size.mjs [--file <Concrete Beam Capacity.html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html')));
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b, t) => Math.abs(a - b) <= t;
const SLAB = { proj: { name: 'Slab' }, code: 'ACI', memberType: 'slab', loadMode: 'factored', sec: { type: 'rect', bw: 12, h: 8 }, mat: { fc: 4, fy: 60, fyt: 60 },
  tor: { present: false }, stir: { present: false, size: '4', legs: 2, s: 6 }, layers: [{ n: 3, s: 4, size: '5', face: 'tension', dMan: 6.25 }],
  combos: [{ name: 'U1', Mu: 0, Vu: 0, Tu: 0 }, { name: 'U2', Mu: 0, Vu: 0, Tu: 0 }] };
const open = async (st, vw) => {
  const o = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(st) } });
  o.f = await (await o.p.$('#suite-frame-capacity')).contentFrame();
  await o.f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && typeof VALIDATION !== 'undefined', null, { timeout: 30000 });
  await o.p.waitForTimeout(500);
  return o;
};
const chip = f => f.evaluate(() => { const c = document.getElementById('statusChip'); return { t: c.textContent, ti: c.title }; });
for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  let { b, p, f, errs } = await open(SLAB, vw);
  let r = await f.evaluate(() => ({ size: S.layers[0].size, sel: document.querySelector('[data-fkey="ls0"]').selectedOptions[0].text, As: CC.combos[0].F.As, phiMn: CC.combos[0].phiMn,
    st: CC.combos[0].det.filter(d => /^dSt/.test(d.id)).map(d => d.id + ':' + d.ok).join(' ') }));
  ok(r.size === '5' && r.sel === '#5', `the layer keeps its bar size: S.layers[0].size ${r.size}, select "${r.sel}"`);
  ok(near(r.As, 0.93, 1e-9) && near(r.phiMn, 23.294, 0.001), `A_s ${r.As.toFixed(2)} in²/ft (0.93), φM_n ${r.phiMn.toFixed(3)} kip-ft (23.294)`);
  ok(r.st === 'dStA:false dStS:false', 'shrinkage and temperature bars not entered: both checks FAIL (unchanged) ' + r.st);
  let c = await chip(f);
  ok(c.t === 'DCR ≫1 ✗' && /not entered: Shrinkage and temperature bar spacing/.test(c.ti), `chip "${c.t}" (was "NO CAPACITY ✗"), tooltip "${c.ti}"`);
  await f.evaluate(() => { const s = document.querySelector('[data-fkey="stSz"]'); s.value = '4'; s.dispatchEvent(new Event('change'));
    const i = document.querySelector('[data-fkey="stS"]'); i.value = '12'; i.dispatchEvent(new Event('input')); });
  c = await chip(f);
  ok(/^DCR \d+\.\d\d ✓$/.test(c.t) && !/not entered/.test(c.ti), `S&T #4 @ 12 entered: chip "${c.t}"`);
  await f.evaluate(() => { S.combos[0].Mu = -3; refresh(); });
  r = await f.evaluate(() => ({ dcM: CC.combos[0].dcM, phiMn: CC.combos[0].phiMn }));
  c = await chip(f);
  ok(!isFinite(r.dcM) && c.t === 'NO CAPACITY ✗', `bottom bars only, M_u = −3 kip-ft: φM_n ${r.phiMn}, D/C ${r.dcM}: chip "${c.t}" (unchanged)`);
  ok(!errs.length, '0 console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  ({ b, p, f, errs } = await open({ ...SLAB, slab: { stSize: '4', stS: 12 }, layers: [{ n: 3, s: 4, size: '99', face: 'tension', dMan: 6.25 }] }, vw));
  r = await f.evaluate(() => ({ blk: VALIDATION.blockers.map(x => x.msg), sel: document.querySelector('[data-fkey="ls0"]').selectedIndex,
    mark: document.querySelector('[data-fkey="ls0"]').classList.contains('cbcInErr'), msg: (document.querySelector('#inputPanel .cbcInErrMsg') || {}).textContent || '' }));
  c = await chip(f);
  ok(c.t === 'INPUT INVALID' && r.blk.some(m => m === 'Layer T1: choose a bar size (Reinforcement, 4. Reinforcement layers).'), `unknown size "99": chip "${c.t}", blocker "${r.blk.join(' | ')}"`);
  ok(r.sel === -1 && r.mark && /Layer T1: choose a bar size/.test(r.msg), 'the Size select shows no bar and is outlined, with the message under the layer table');
  await f.evaluate(() => { const s = document.querySelector('[data-fkey="ls0"]'); s.value = '6'; s.dispatchEvent(new Event('change')); });
  r = await f.evaluate(() => ({ blk: VALIDATION.blockers.length, As: CC && CC.combos[0].F.As }));
  c = await chip(f);
  ok(!r.blk && near(r.As, 3 * 0.44, 1e-9) && /^DCR/.test(c.t), `#6 chosen: no input error, A_s ${r.As} (1.32), chip "${c.t}"`);
  ok(!errs.length, '0 console errors (unknown size)' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
