#!/usr/bin/env node
// CBSL (2026-11-13): Concrete Beam Capacity, Beam Capacity tab, service load cases (ACI 318-19 5.3.1, Table 5.3.1) and the
// factored mode, at 1400 and 390 px, file://, 0 console errors:
//  - a new project opens in service mode with blank cases and the Load Combinations tab;
//  - hand check typed into the fields: D M 5 V 2, L M 3 V 1.2, W M 2 V 0.8 (reverses): 11 rows, M_u / V_u as below, flexure
//    governed by (5.3.1d) 1.2D + 1.0W + 1.0L + 0.5Lr (M_u 11.00, V_u 4.40);
//  - a combination name in the input table opens its card on the Load Combinations tab; each card has the symbolic, substituted
//    and result lines; the Flexure card links back; the Report has the "Load combinations" section after Inputs, every step
//    linked from the Inputs table, no unresolved reference, no NaN;
//  - the state survives a reload (rcbeam_v2_auto: loadMode, svc);
//  - factored mode: the typed rows are used, the tab is gone; AASHTO mode uses the typed rows whatever the Loads mode;
//  - an older save (no loadMode) opens in factored mode with its rows;
//  - no sideways page scroll on any tab.
//   node tests/smoke/cbc-loads.mjs [--file <Concrete Beam Capacity.html>] [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html'))), SHOTS = arg('shots', '');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const HAND = [['1.4D', 7, 2.8], ['1.2D + 1.6L + 0.5Lr', 10.8, 4.32], ['1.2D + 1.6Lr + 1.0L', 9, 3.6], ['1.2D + 1.6Lr + 0.5W', 7, 2.8],
  ['1.2D + 1.6Lr − 0.5W', 5, 2], ['1.2D + 1.0W + 1.0L + 0.5Lr', 11, 4.4], ['1.2D − 1.0W + 1.0L + 0.5Lr', 7, 2.8],
  ['1.2D + 1.0E + 1.0L + 0.2S', 9, 3.6], ['0.9D + 1.0W', 6.5, 2.6], ['0.9D − 1.0W', 2.5, 1], ['0.9D + 1.0E', 4.5, 1.8]];
const OLD = { proj: { name: 'Old', date: '2026-11-01' }, code: 'ACI', tor: { present: false }, combos: [{ name: 'A', Mu: 120, Vu: 20, Tu: 0 }, { name: 'B', Mu: -60, Vu: 12, Tu: 5 }] };

const frameOf = async p => { const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 }); return f; };
const typeIn = async (p, f, key, s) => { await f.evaluate(k => { let e = document.querySelector(`[data-fkey="${k}"]`); const pn = e.closest('.rcbInPane');
  if (pn && !e.getClientRects().length) document.getElementById(pn.id.replace('rcbInPane_', 'rcbInTab_')).click();
  e = document.querySelector(`[data-fkey="${k}"]`); e.scrollIntoView(); e.focus(); e.select(); }, key);
  await p.keyboard.press('Control+A'); await p.keyboard.type(s); await f.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(40); };
const sideways = async f => f.evaluate(() => { const out = []; const t0 = S.ui.tab;
  TABS().forEach(([id]) => { S.ui.tab = id; refresh(); const w = document.documentElement.scrollWidth - document.documentElement.clientWidth; if (w > 1) out.push(id + ' ' + w); });
  S.ui.tab = t0; refresh(); return out; });

for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  let { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900 });
  let f = await frameOf(p);
  let r = await f.evaluate(() => ({ mode: S.loadMode, svcOn: cbcSvcOn(), n: CC.combos.length, tab: TABS().some(t => t[0] === 'tabLoads'), sel: (document.querySelector('[data-fkey="ldMode"]') || {}).value, combos: S.combos.map(c => c.name) }));
  ok(r.mode === 'service' && r.svcOn && r.tab && r.sel === 'service' && r.n === 7, `new project: service mode, Load Combinations tab, 7 blank rows (${r.mode}, ${r.n})`);
  ok(JSON.stringify(r.combos) === '["Combo 1"]', `new project: one blank factored row "Combo 1" (no named zero rows): ${JSON.stringify(r.combos)}`);
  for (const [k, s] of [['svMD', '5'], ['svVD', '2'], ['svML', '3'], ['svVL', '1.2'], ['svMW', '2'], ['svVW', '0.8']]) await typeIn(p, f, k, s);
  r = await f.evaluate(() => ({ rows: CC.combos.map(x => [x.name, x.Mu, x.Vu]), gov: CC.combos[CC.govFlexIndex].name, svc: JSON.stringify(S.svc.cases) }));
  ok(r.rows.length === HAND.length && HAND.every((h, i) => r.rows[i][0] === h[0] && Math.abs(r.rows[i][1] - h[1]) < 1e-9 && Math.abs(r.rows[i][2] - h[2]) < 1e-9),
    'hand check: ' + r.rows.map(x => `${x[0]} ${x[1].toFixed(2)}/${x[2].toFixed(2)}`).join('; '));
  ok(r.gov === '1.2D + 1.0W + 1.0L + 0.5Lr', `flexure governed by ${r.gov} (M_u 11.00)`);
  // input link -> card
  await f.evaluate(() => { const a = document.querySelector('#inputPanel a.wkA[data-card="ldC5"]'); a.click(); }); await p.waitForTimeout(400);
  r = await f.evaluate(() => ({ tab: S.ui.tab, card: (document.querySelector('#ldC5') || {}).innerText || '', ann: [...document.querySelectorAll('#ldC5 annotation')].map(a => a.textContent).join(' ‖ ') }));
  ok(r.tab === 'tabLoads' && /1\.2D \+ 1\.0W \+ 1\.0L \+ 0\.5L/.test(r.card), 'input table link opens the Load Combinations tab, card of Combination 6');
  ok(r.ann.includes('U = 1.2D + 1.0W + 1.0L + 0.5L_r') && r.ann.includes('M_u = 1.2M_{D} + 1.0M_{W} + 1.0M_{L} + 0.5M_{L_r}') && r.ann.includes('M_u = 1.2(5.00) + 1.0(2.00) + 1.0(3.00) + 0.5(0.00) = 11.00') && r.ann.includes('V_u = 1.2(2.00) + 1.0(0.80) + 1.0(1.20) + 0.5(0.00) = 4.40'),
    'card: symbolic, substituted and result lines (M_u 11.00, V_u 4.40)');
  r = await f.evaluate(() => { S.ui.tab = 'tabFlex'; refresh(); return [...document.querySelectorAll('#flexC5 a.wkA')].map(a => a.dataset.tab + ':' + a.dataset.card); });
  ok(r.includes('tabLoads:ldC5'), 'Flexure card of Combination 6 links to its derivation');
  r = await f.evaluate(() => { const M = mrModel(), t = SharedReport.text(SharedReport.build(M), { legacy: true }); return { secs: M.sections.map(s => s.title), t }; });
  const iIn = r.secs.indexOf('Inputs'), iLd = r.secs.indexOf('Load combinations');
  ok(iLd === iIn + 1, `Report: "Load combinations" right after Inputs (${r.secs.join(' | ')})`);
  ok(r.t.includes('1.2(5.00) + 1.0(2.00) + 1.0(3.00) + 0.5(0.00)') && /11\.00 §\d+\.\d+/.test(r.t) && !/\[\[|NaN|undefined/.test(r.t), 'Report: worked steps, the Inputs table links to them, no unresolved link or NaN');
  const sw = await sideways(f); ok(!sw.length, 'no sideways scroll on any tab' + (sw.length ? ': ' + sw.join(', ') : ''));
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `cbc-loads-service-${vw}.png`) });
  await p.reload(); f = await frameOf(p);
  r = await f.evaluate(() => { const a = JSON.parse(localStorage.getItem('rcbeam_v2_auto')); return { mode: a.loadMode, D: a.svc.cases.D, n: CC.combos.length, mu: CC.combos[5].Mu }; });
  ok(r.mode === 'service' && r.D.M === 5 && r.n === 11 && Math.abs(r.mu - 11) < 1e-9, 'after a reload: service mode, the cases and the 11 rows kept (autosave rcbeam_v2_auto)');
  // factored mode
  r = await f.evaluate(() => { const s = document.querySelector('[data-fkey="ldMode"]'); s.value = 'factored'; s.dispatchEvent(new Event('change'));
    return { mode: S.loadMode, rows: CC.combos.map(x => x.name), tab: TABS().some(t => t[0] === 'tabLoads'), cM0: !!document.querySelector('[data-fkey="cM0"]') }; });
  ok(r.mode === 'factored' && JSON.stringify(r.rows) === '["Combo 1"]' && !r.tab && r.cM0, 'factored mode: the typed row is used, the factored table is shown, no Load Combinations tab');
  await typeIn(p, f, 'cM0', '42.5');
  r = await f.evaluate(() => ({ mu: CC.combos[0].Mu, svc: S.svc.cases.D.M }));
  ok(r.mu === 42.5 && r.svc === 5, `factored M_u typed 42.5 is used (${r.mu}); the service cases are kept (D M ${r.svc})`);
  r = await f.evaluate(() => { S.loadMode = 'service'; S.code = 'AASHTO'; refresh(); return { on: cbcSvcOn(), rows: CC.combos.map(x => x.name), note: document.getElementById('inputPanel').innerText.includes('this tool builds the ACI 318-19 combinations only') }; });
  ok(!r.on && r.note && JSON.stringify(r.rows) === '["Combo 1"]', 'AASHTO mode: the typed factored rows are used even with the Loads mode on service');
  if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `cbc-loads-aashto-${vw}.png`) });
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  // an older save: factored mode
  ({ b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(OLD) } }));
  f = await frameOf(p);
  r = await f.evaluate(() => ({ mode: S.loadMode, rows: CC.combos.map(x => [x.name, x.Mu, x.Vu, x.Tu]), sel: (document.querySelector('[data-fkey="ldMode"]') || {}).value, tab: TABS().some(t => t[0] === 'tabLoads') }));
  ok(r.mode === 'factored' && r.sel === 'factored' && !r.tab && JSON.stringify(r.rows) === '[["A",120,20,0],["B",-60,12,5]]', 'an older save (no loadMode) opens in factored mode with its rows');
  const sw2 = await sideways(f); ok(!sw2.length, 'factored mode: no sideways scroll on any tab' + (sw2.length ? ': ' + sw2.join(', ') : ''));
  ok(!errs.length, 'console errors (older save): ' + errs.length);
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
