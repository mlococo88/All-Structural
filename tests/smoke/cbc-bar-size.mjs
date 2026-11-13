#!/usr/bin/env node
// CBBS (2026-11-13): Concrete Beam Capacity, Beam Capacity tab: the header chip and a layer's bar size.
//  1. The engineer's state (one-way slab, layer T1 #5 @ 4 in, Set d 6.25 in, h 8 in, no shrinkage and temperature bars, all actions 0):
//     the layer keeps #5 (the Size select shows "#5"); A_s = 3(0.31) = 0.93 in²/ft; a = 0.93(60)/(0.85(4)(12)) = 1.368 in;
//     φM_n = 0.9(0.93)(60)(6.25 − 0.684)/12 = 23.29 kip-ft/ft. The S&T checks FAIL (none entered, as before), and the chip reads
//     "DCR ≫1 ✗" (was "NO CAPACITY ✗") with those checks named in its tooltip ("provided = 0 or not entered: …"). With S&T #4 @ 12: no ≫1, chip "DCR … ✓".
//  2. Under M_u = −3 with no top bars, A_s,min FAILs with A_s = 0 (D/C need/1e-12): the chip reads "DCR ≫1 ✗" (was "DCR 172800000000.00 ✗").
//     A strength check with no capacity (torsion with no stirrups: V+T stirrup adequacy unbounded) still reads "NO CAPACITY ✗".
//  3. A layer whose bar size is not a bar (an edited or imported file, size "99"): no page error, "INPUT INVALID", the blocker
//     "Layer T1: choose a bar size …", the layer's Size select outlined; choosing #6 clears it and the results return.
//  4. CBBZ (engineer decision CB-15): a saved / imported layer whose size is blank ("" or no size) opens with the data kept and the size
//     still blank (was: #5 without a word): the same input error, the Size select blank and outlined, the autosave keeps "";
//     choosing #5 gives the results (A_s 0.93 in²/ft). Stirrups present with a blank or unknown size (was: a page error), and an unknown
//     shrinkage and temperature or skin bar size (was: taken as none): an input error naming the field, its select outlined.
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
    st: CC.combos[0].det.filter(d => /^dSt[AS]$/.test(d.id)).map(d => d.id + ':' + d.ok).join(' ') }));
  ok(r.size === '5' && r.sel === '#5', `the layer keeps its bar size: S.layers[0].size ${r.size}, select "${r.sel}"`);
  ok(near(r.As, 0.93, 1e-9) && near(r.phiMn, 23.294, 0.001), `A_s ${r.As.toFixed(2)} in²/ft (0.93), φM_n ${r.phiMn.toFixed(3)} kip-ft (23.294)`);
  ok(r.st === 'dStA:false dStS:false', 'shrinkage and temperature bars not entered: both checks FAIL (unchanged) ' + r.st);
  let c = await chip(f);
  ok(c.t === 'DCR ≫1 ✗' && /provided = 0 or not entered: Shrinkage and temperature reinforcement ratio; Shrinkage and temperature bar spacing/.test(c.ti), `chip "${c.t}" (was "NO CAPACITY ✗"), tooltip "${c.ti}"`);
  await f.evaluate(() => { const s = document.querySelector('[data-fkey="stSz"]'); s.value = '4'; s.dispatchEvent(new Event('change'));
    const i = document.querySelector('[data-fkey="stS"]'); i.value = '12'; i.dispatchEvent(new Event('input')); });
  c = await chip(f);
  ok(/^DCR \d+\.\d\d ✓$/.test(c.t) && !/provided = 0 or not entered/.test(c.ti), `S&T #4 @ 12 entered: chip "${c.t}"`);
  await f.evaluate(() => { S.combos[0].Mu = -3; refresh(); });
  r = await f.evaluate(() => ({ dcM: CC.combos[0].dcM, d: CC.combos[0].det.find(d => d.id === 'dAsMin') }));
  c = await chip(f);
  ok(c.t === 'DCR ≫1 ✗' && /provided = 0 or not entered: Minimum flexural reinforcement/.test(c.ti) && r.d && !r.d.ok, `no top bars, M_u = −3 kip-ft: A_s,min FAILs with A_s = 0 (unchanged); chip "${c.t}" (was "DCR 172800000000.00 ✗"), tooltip "${c.ti}"`);
  ok(!errs.length, '0 console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
  await b.close();
  ({ b, p, f, errs } = await open({ ...SLAB, memberType: 'beam', sec: { type: 'rect', bw: 14, h: 24 }, layers: [{ n: 3, size: '8', face: 'tension', dMan: null }, { n: 2, size: '5', face: 'compression', dMan: null }],
    tor: { present: true, Al: 1.2 }, combos: [{ name: 'U', Mu: 100, Vu: 30, Tu: 15 }] }, vw));
  r = await f.evaluate(() => allChecks().filter(c => !c.na && c.dcr != null && !isFinite(c.dcr)).map(c => c.label));
  c = await chip(f);
  ok(r.length && c.t === 'NO CAPACITY ✗', `beam with torsion and no stirrups: unbounded strength D/C (${r.join('; ')}): chip "${c.t}" (unchanged)`);
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
  // CBBZ: blank layer size (""), and a layer saved without a size
  for (const [nm, L0] of [['blank ""', { n: 3, s: 4, size: '', face: 'tension', dMan: 6.25 }], ['no size key', { n: 3, s: 4, face: 'tension', dMan: 6.25 }]]) {
    ({ b, p, f, errs } = await open({ ...SLAB, slab: { stSize: '4', stS: 12 }, layers: [L0] }, vw));
    r = await f.evaluate(() => { const s = document.querySelector('[data-fkey="ls0"]'); return { L: S.layers[0], blk: VALIDATION.blockers.map(x => x.msg), sel: s.selectedIndex, val: s.value, mark: s.classList.contains('cbcInErr'),
      saved: JSON.parse(localStorage.getItem('rcbeam_v2_auto') || '{}').layers }; });
    c = await chip(f);
    ok(r.L.size === '' && r.L.n === 3 && r.L.s === 4 && r.L.dMan === 6.25 && r.L.face === 'tension', `${nm}: the layer opens with its data and the size blank (was #5) ${JSON.stringify(r.L)}`);
    ok(c.t === 'INPUT INVALID' && r.blk.includes('Layer T1: choose a bar size (Reinforcement, 4. Reinforcement layers).') && r.sel === -1 && r.val === '' && r.mark,
      `${nm}: "INPUT INVALID", "Layer T1: choose a bar size …", the Size select blank and outlined`);
    ok(r.saved && r.saved[0].size === '', `${nm}: the autosave keeps the blank size (no data changed)`);
    await f.evaluate(() => { const s = document.querySelector('[data-fkey="ls0"]'); s.value = '5'; s.dispatchEvent(new Event('change')); });
    r = await f.evaluate(() => ({ blk: VALIDATION.blockers.length, As: CC && CC.combos[0].F.As }));
    ok(!r.blk && near(r.As, 0.93, 1e-9), `${nm}: #5 chosen: results, A_s ${r.As}`);
    ok(!errs.length, '0 console errors' + (errs.length ? ': ' + errs.join(' | ') : ''));
    await b.close();
  }
  // CBBZ: stirrups present with a blank or unknown size; unknown S&T and skin sizes
  const BEAM = { ...SLAB, memberType: 'beam', sec: { type: 'rect', bw: 14, h: 24 }, layers: [{ n: 3, size: '8', face: 'tension', dMan: null }], combos: [{ name: 'U', Mu: 100, Vu: 30, Tu: 0 }] };
  for (const [nm, st, key, msg] of [
    ['stirrup size ""', { ...BEAM, stir: { present: true, size: '', legs: 2, s: 6 } }, 'ss', 'Stirrups: choose a bar size (Reinforcement, Transverse reinforcement).'],
    ['stirrup size "99"', { ...BEAM, stir: { present: true, size: '99', legs: 2, s: 6 } }, 'ss', 'Stirrups: choose a bar size (Reinforcement, Transverse reinforcement).'],
    ['skin size "99"', { ...BEAM, stir: { present: true, size: '4', legs: 2, s: 6 }, skin: { size: '99', s: 6 } }, 'skz', 'Skin bars: choose a bar size or None (Reinforcement, Transverse reinforcement).'],
    ['S&T size "99"', { ...SLAB, slab: { stSize: '99', stS: 12 } }, 'stSz', 'Shrinkage and temperature bars: choose a bar size or None entered (Reinforcement, Shrinkage & Temperature).']]) {
    ({ b, p, f, errs } = await open(st, vw));
    r = await f.evaluate(k => { const s = document.querySelector(`[data-fkey="${k}"]`); return { blk: VALIDATION.blockers.map(x => x.msg), sel: s && s.selectedIndex, mark: s && s.classList.contains('cbcInErr') }; }, key);
    c = await chip(f);
    ok(c.t === 'INPUT INVALID' && r.blk.includes(msg) && r.sel === -1 && r.mark && !errs.length, `${nm}: "${msg}", select blank and outlined, no page error ${errs.join(' | ')}`);
    await f.evaluate(k => { const s = document.querySelector(`[data-fkey="${k}"]`); s.value = '4'; s.dispatchEvent(new Event('change')); }, key);
    r = await f.evaluate(() => ({ blk: VALIDATION.blockers.length, cc: !!CC }));
    ok(!r.blk && r.cc, `${nm}: #4 chosen: no input error, results shown`);
    await b.close();
  }
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
