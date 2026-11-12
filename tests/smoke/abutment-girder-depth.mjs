// ABDG (2026-11-12, engineer decision): the integral / semi-integral owner screening reads the girder depth d_g of the superstructure
// inputs (geom.elGird, in) instead of its own panel I-0a entry (iab.dg, ft). A saved iab.dg is kept: d_g blank -> the saved value
// (screening unchanged); d_g entered and different -> the larger, flagged; cleared -> d_g only. New projects: iab.dg null.
// usage: node tests/smoke/abutment-girder-depth.mjs [abutment_calculator.html]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.resolve(REPO, process.argv[2] || 'abutment_calculator.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const o = await openPage(FILE, { vw: 1400, vh: 1000 });
await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });

const run = (js) => o.p.evaluate(js => {
  S = defaultState(); migrate(); eval(js); recalcAll();
  const R = window.LAST_R, row = id => (R.own.rows || []).find(x => x.r.id === id) || null, t = s => String(s || '').replace(/<[^>]+>/g, '');
  const pick = id => { const x = row(id); return x ? { st: x.st, val: t(x.val), tex: x.tex || null } : null; };
  return { geo: pick('iab.geo'), lim: pick('iab.lim'), conn: pick('iab.conn'), nFail: R.own.nFail, D: iabDg(),
    warn: WARNINGS.map(w => t(w.msg)).filter(m => /^Girder depth/.test(m)) };
}, js);

check(await o.p.evaluate(() => defaultState().iab.dg === null), 'new projects: iab.dg null (the girder input d_g is used)');

// saved RIDOT integral, d_g blank: the saved 4.00 ft, as before
let r = await run('S.own.owner="RIDOT"; S.iab.type="integral"; S.iab.dg=4.0;');
check(r.D.src === 'saved' && r.D.v === 4 && r.geo.st === 'pass' && /girder 4\.00 ft \(saved in panel I-0a/.test(r.geo.val) && !r.warn.length, 'RIDOT integral, d_g blank: saved 4.00 ft used, pass, no warning — ' + r.geo.val);
// same, d_g = 48 in: equal, no flag
r = await run('S.own.owner="RIDOT"; S.iab.type="integral"; S.iab.dg=4.0; S.geom.elGird=48;');
check(r.D.src === 'girder' && Math.abs(r.D.v - 4) < 1e-12 && !r.warn.length && r.geo.tex === 'd_{g} = 48.00/12 = 4.00\\ \\text{ft}', 'd_g 48 in = saved 4.00 ft: d_g used, no flag; tex ' + r.geo.tex);
// semi RIDOT, d_g 80 in vs saved 4.0 ft: max 6.67 ft > 6 ft -> fail, flagged
r = await run('S.own.owner="RIDOT"; S.iab.type="semi"; S.iab.dg=4.0; S.geom.elGird=80;');
check(r.D.src === 'max' && Math.abs(r.D.v - 80 / 12) < 1e-12 && r.lim.st === 'fail' && r.warn.length === 1 && /uses the larger, 6\.67 ft/.test(r.warn[0]), 'semi RIDOT d_g 80 in vs 4.00 ft: max 6.67 ft, iab.lim FAIL, flagged');
// MassDOT integral, d_g 36 in (smaller) vs saved 4.0: the larger (saved) 4.00 ft, flagged
r = await run('S.own.owner="MassDOT"; S.iab.type="integral"; S.iab.dg=4.0; S.geom.elGird=36;');
check(r.D.src === 'max' && r.D.v === 4 && r.conn.st === 'pass' && r.warn.length === 1 && r.conn.tex === 'd_{g} = \\max\\left(36.00/12,\\ 4.00\\right) = 4.00\\ \\text{ft}', 'MassDOT d_g 36 in vs saved 4.00: the larger 4.00 ft, flagged; tex ' + r.conn.tex);
// MassDOT integral, d_g 108 in, no saved value: 9.00 ft > 8 -> CHECK
r = await run('S.own.owner="MassDOT"; S.iab.type="integral"; S.iab.dg=null; S.geom.elGird=108;');
check(r.D.src === 'girder' && r.conn.st === 'warn' && /9\.00 ft/.test(r.conn.val) && !r.warn.length, 'MassDOT d_g 108 in, nothing saved: 9.00 ft > 8 ft CHECK');
// new RIDOT integral, nothing entered: not met
r = await run('S.own.owner="RIDOT"; S.iab.type="integral"; S.iab.dg=null;');
check(r.D.src === 'none' && r.geo.st === 'fail' && /girder not entered/.test(r.geo.val), 'RIDOT integral, no girder depth: iab.geo not met (not entered)');
// conventional default: no girder note
check(await o.p.evaluate(() => { S = defaultState(); migrate(); buildInputs(); recalcAll(); return !document.getElementById('abDgIn'); }), 'conventional: no I-0a girder depth note');

// UI: integral, saved 4.0 -> both rows; type d_g 60 -> max, flag; clear the saved value -> d_g only (stored null, not discarded before)
const ui = await o.p.evaluate(async () => {
  const ev = (el, v) => { el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); };
  S = defaultState(); migrate(); S.own.owner = 'RIDOT'; S.iab.type = 'integral'; S.iab.dg = 4.0; buildInputs(); recalcAll();
  const q = p => document.querySelector('#inputCol [data-path="' + p + '"]'), out = { g: !!q('geom.elGird'), d: q('iab.dg') && q('iab.dg').value, n1: document.getElementById('abDgIn').textContent };
  ev(q('geom.elGird'), '60'); await new Promise(r => setTimeout(r, 700)); out.n2 = document.getElementById('abDgIn').textContent; out.saved = S.iab.dg;
  ev(q('iab.dg'), ''); await new Promise(r => setTimeout(r, 700)); out.n3 = document.getElementById('abDgIn').textContent; out.cleared = S.iab.dg;
  S.iab.type = 'semi'; buildInputs(); out.semiN = document.querySelectorAll('#inputCol [data-path="geom.elGird"]').length; out.semiDg = !!q('iab.dg');
  return out;
});
check(ui.g && ui.d === '4' && /4\.00 ft \(saved in panel I-0a/.test(ui.n1), 'UI integral: d_g row and the saved 4.00 ft row in panel I-0a');
check(/5\.00 ft = the larger of/.test(ui.n2) && ui.saved === 4, 'UI: d_g 60 in -> 5.00 ft (larger), saved value kept');
check(/5\.00 ft \(d_?g = 60\.00 in/.test(ui.n3) && ui.cleared === null, 'UI: saved value cleared by the user -> d_g only');
check(ui.semiN === 1 && !ui.semiDg, 'UI semi: d_g only in panel I-1, no saved row after clearing');
check(!o.errs.length, 'no console errors ' + JSON.stringify(o.errs));
await o.b.close();
console.log(fails ? fails + ' FAILED' : 'all passed');
process.exit(fails ? 1 : 0);
