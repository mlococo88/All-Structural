#!/usr/bin/env node
// Spread Footing: no service combination with a bearing solution (SFNB, engineer 2026-11-06).
// Regression for the crashes found 2026-11-06: renderPedCb (card 2.6) and comboSelectorBar threw when R.govBear was null, and
// the Report showed only "Report error"; recalc stopped half-way and left the later tabs with stale results and no marker.
// For each trigger below (headless Chromium, file://, the pinned libraries from tests/libs):
//   1. recalc() and the Report render with 0 console / page errors and 0 KaTeX errors;
//   2. no "Out of date" banner (.sfdOod) anywhere, no red tab button;
//   3. the dashboard Bearing chip is FAIL, the Bearing tab says FAIL and gives a reason ("resultant off the footing",
//      "net load not downward", "zero bearing capacity");
//   4. card 2.6 renders (the loads, or the "no governing combination" message);
//   5. the Report renders (no "Report error") and states the bearing result and a reason; the other checks are in it;
//   6. the Stability tab still shows overturning and sliding.
// SFNB-2 (same day): a combination with D/C = ∞ (zero capacity) governs bearing as FAIL, with the reason on the chip.
// SFNB-3 (same day): so does a combination with no bearing solution (resultant off the footing, net load not downward), also
// when other combinations have a finite D/C; the cases above that had no governing combination now govern with D/C ∞.
// Also: the default project has no banner and Bearing PASS; a renderer made to throw marks its tab "Out of date" (and only that
// tab), logs to the console, and the banner goes at the next good render.
//   node tests/smoke/spread-footing-nobear.mjs [--file <file or git ref>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, resolveFile } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Spread Footing.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } };
const WHY = /resultant off the footing|net load not downward|zero bearing capacity|could not be computed/;

// [name, state patch (runs with `state`), selection patch (runs after the patch, before recalc)]
const CASES = [
  ['direct V_y = 600 k (resultant off the footing, both brackets)', "state.loadMode='direct';state.peds[0].direct.Vy=600;"],
  ['direct V_x = 660 k (H >= V, i_q = 0)', "state.loadMode='direct';state.peds[0].direct.Vx=660;"],
  ['direct M_x = 3000 k-ft', "state.loadMode='direct';state.peds[0].direct.Mx=3000;"],
  ['direct net uplift P = -2000 k', "state.loadMode='direct';state.peds.forEach(p=>{p.direct={P:-2000,Vx:0,Vy:0,Mx:0,My:0};});"],
  ['case D.M_x = 5000 k-ft', 'state.peds[0].loads.D.Mx=5000;'],
  ['case D.V_y = 1000 k', 'state.peds[0].loads.D.Vy=1000;'],
  ['case D.P = -2000 k (net uplift)', 'state.peds.forEach(p=>{p.loads.D.P=-2000;p.loads.L.P=0;p.loads.S.P=0;});'],
  ['case pedestal at x = 20 ft', 'state.peds[0].x=20;'],
  ['case direct soil q_a = 0', "state.soil.mode='direct';state.soil.qa=0;"],
  ['case D.M_x = 5000, service combination 1 picked', 'state.peds[0].loads.D.Mx=5000;', 'SEL.asd=0;'],
  ['case D.M_x = 5000, LRFD combination 1 picked', 'state.peds[0].loads.D.Mx=5000;', 'SEL.asdLr=0;'],
  // SFNB-2: a combination with D/C = ∞ governs (H > V with c = 0: i_q = 0); before, it was left out and Bearing read PASS 0.91
  ['case B = L = 18, shear couple off, Wx.V_x = 250 k per pedestal (0.6D + 0.6Wx: H 300 > V 270.2)', "state.stab.shearCouple='off';state.geom.B=18;state.geom.L=18;state.peds.forEach(p=>{p.loads.Wx.Vx=250;});", '', 'Infinity'],
  // SFNB-3: a combination off the footing or with net uplift governs as FAIL even when the others have finite D/Cs
  ['direct V_y = 578 k (dead x0.9 bracket off the footing, x1.2 in partial contact)', "state.loadMode='direct';state.peds[0].direct.Vy=578;", '', 'Infinity'],
  ['case direct soil q_a = 15, Wx.P = -300 k per pedestal (D + 0.6(+Wx): net uplift; the rest PASS)', "state.soil.mode='direct';state.soil.qa=15;state.peds.forEach(p=>{p.loads.Wx.P=-300;});", '', 'Infinity'],
];

const o = await openPage(SRC.file, {});
await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
await o.p.waitForTimeout(1500);
const tab = async id => { await o.p.click('#tabbar button[data-tab="' + id + '"]'); await o.p.waitForTimeout(400); };
const apply = (src, sel) => o.p.evaluate(([src, sel]) => {
  state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null;
  (new Function('state', src))(state); buildPedCards(); if (sel) (new Function(sel))(); recalc();
}, [src, sel || '']);
const read = () => o.p.evaluate(() => {
  const chips = [...document.querySelectorAll('#dashboard .chip')].map(c => ({ n: c.querySelector('.cn').textContent, v: c.querySelector('.cv').textContent, s: c.className }));
  const t = id => (document.getElementById(id) || {}).innerText || '';
  return { chips, bearing: t('tab-bearing'), stab: t('tab-stab'), ped: t('o-cb-ped'), ood: document.querySelectorAll('.sfdOod').length,
    red: document.querySelectorAll('#tabbar button.sfdTabErr').length, gov: R.govBear ? R.govBear.cb.name : null,
    govDCR: R.govBear ? String(R.govBear.DCR) : null };
});
const report = async () => {
  await tab('tab-report'); await o.p.waitForTimeout(1200);
  const r = await o.p.evaluate(() => ({ err: /Report error/.test(document.getElementById('tab-report').innerText), doc: !!SFRP.doc,
    text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', katex: document.querySelectorAll('.katex-error').length }));
  await tab('tab-bearing'); return r;
};

// 0. default project
o.errs.length = 0;
await apply('');
{ const s = await read(), b = s.chips.find(c => c.n === 'Bearing (service)'), rp = await report();
  console.log('default: governing ' + s.gov + ', DCR ' + s.govDCR + ', banners ' + s.ood);
  check(s.ood === 0 && s.red === 0, 'default: an Out of date banner is shown');
  check(b && /pass/.test(b.s), 'default: Bearing chip not PASS');
  check(!rp.err && rp.doc && rp.katex === 0, 'default: Report did not render cleanly');
  check(o.errs.length === 0, 'default: console errors ' + JSON.stringify(o.errs)); }

for (const [name, src, sel, dcr] of CASES) {
  o.errs.length = 0;
  await apply(src, sel);
  const s = await read(), b = s.chips.find(c => c.n === 'Bearing (service)'), rp = await report();
  console.log(name + ': governing ' + (s.gov || 'none') + (s.govDCR ? ' (DCR ' + s.govDCR + ')' : '') + ' | chip: ' + (b ? b.v : '?'));
  check(o.errs.length === 0, name + ': console errors ' + JSON.stringify(o.errs));
  check(s.ood === 0 && s.red === 0, name + ': an Out of date banner is shown');
  check(b && /fail/.test(b.s), name + ': Bearing chip not FAIL');
  if (dcr) check(s.govDCR === dcr && /∞/.test(b.v) && WHY.test(b.v), name + ': governing D/C ' + s.govDCR + ', chip "' + (b && b.v) + '" (expected ' + dcr + ' with the reason)');
  check(/FAIL/.test(s.bearing) && WHY.test(s.bearing), name + ': Bearing tab gives no FAIL with a reason');
  check(s.ped.length > 40 && !/Cannot read/.test(s.ped), name + ': card 2.6 empty');
  check(/Overturning/.test(s.stab) && /Sliding/.test(s.stab), name + ': Stability tab missing overturning / sliding');
  check(!rp.err && rp.doc, name + ': Report error');
  check(rp.katex === 0, name + ': KaTeX errors ' + rp.katex);
  check(/Bearing: FAIL|∞/.test(rp.text) && WHY.test(rp.text), name + ': Report gives no bearing FAIL with a reason');
  check(/Overturning/.test(rp.text) && /Sliding/.test(rp.text), name + ': Report missing the stability checks');
  if (args.shots) { await tab('tab-bearing'); await o.p.screenshot({ path: path.join(args.shots, 'nobear-' + CASES.findIndex(c => c[0] === name) + '.png'), fullPage: false }); }
}

// safety net: a renderer that throws marks its own tab, and only that tab
o.errs.length = 0;
await apply('');
const net = await o.p.evaluate(() => {
  const keep = renderStability; window.renderStability = () => { throw new Error('test: renderStability fails'); };
  recalc();
  const a = { ood: [...document.querySelectorAll('.sfdOod')].map(e => e.closest('.tabpage') ? e.closest('.tabpage').id : e.parentElement.id),
    red: [...document.querySelectorAll('#tabbar button.sfdTabErr')].map(b => b.dataset.tab), stale: document.body.classList.contains('sfdStale'),
    after: !!document.querySelector('#tab-peddes .secbody') };
  window.renderStability = keep; recalc();
  a.oodAfter = document.querySelectorAll('.sfdOod').length; a.redAfter = document.querySelectorAll('#tabbar button.sfdTabErr').length;
  return a;
});
console.log('safety net: ' + JSON.stringify(net) + ' | console errors logged: ' + o.errs.length);
check(net.ood.length === 1 && net.ood[0] === 'tab-stab', 'safety net: banner not on the Stability tab only: ' + JSON.stringify(net.ood));
check(net.red.length === 1 && net.red[0] === 'tab-stab', 'safety net: tab button not marked');
check(net.after, 'safety net: the renderers after the failing one did not run');
check(net.oodAfter === 0 && net.redAfter === 0, 'safety net: banner not removed after a good render');
check(o.errs.some(e => /renderStability/.test(e)), 'safety net: the error was not logged to the console');
if (args.shots) { await apply(''); await o.p.evaluate(() => { const k = renderStability; window.renderStability = () => { throw new Error('test'); }; recalc(); window.renderStability = k; });
  await tab('tab-stab'); await o.p.screenshot({ path: path.join(args.shots, 'nobear-safetynet.png') }); }

await o.b.close();
console.log(failures ? failures + ' failure(s)' : 'all checks pass');
process.exit(failures ? 1 : 0);
