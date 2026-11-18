#!/usr/bin/env node
// CBLL (2026-11-18): Concrete Beam Capacity, Beam Capacity tab, service mode: line loads per load case (w, or q × tributary width),
// simple span / cantilever, V at the support face or at d, self-weight as D (off by default). 1400 and 390 px, file://, 0 console errors:
//  - a new project: the Line loads block in the Loads card, no rows, self-weight off; the combinations as before (7 blank rows);
//  - hand check typed into the fields: L = 20 ft simple span, D 100 psf × 10 ft + 0.2 klf, L 50 psf × 10 ft: w_D 1.200, w_L 0.500 klf,
//    M_D 60.00 / V_D 12.00, M_L 25.00 / V_L 5.00; (5.3.1b) 1.2D + 1.6L + 0.5Lr: M_u 112.00, V_u 22.40;
//  - the Load Combinations tab has the "Line Loads" card (symbolic, substituted, result; entered + line = total); the input panel links to it;
//  - the Report: the Line loads inputs, the worked steps (ll/MD …), linked from the service load cases table; no unresolved link, no NaN;
//  - reload keeps it; cantilever: M_D −240.00 (−1.2·400/2), V_D 24.00; V at d: V_D = 1.2(20 − d/12);
//  - an older service save (no svc.ll) opens with no line loads and the same 14 rows as before (hand check of cbc-loads.mjs);
//  - no sideways page scroll on any tab.
//   node tests/smoke/cbc-lineloads.mjs [--file <Concrete Beam Capacity.html>] [--shots <dir>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', path.join(REPO, 'Concrete Beam Capacity.html'))), SHOTS = arg('shots', '');
let fails = 0; const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const near = (a, b) => Math.abs(a - b) < 1e-9;
const OLDSVC = { proj: { name: 'Old service' }, code: 'ACI', loadMode: 'service', tor: { present: false },
  svc: { cases: { D: { M: 5, V: 2, T: 0 }, L: { M: 3, V: 1.2, T: 0 }, W: { M: 2, V: 0.8, T: 0 } }, rev: { W: true, E: true }, l05: false } };
const HAND = [['1.4D', 7, 2.8], ['1.2D + 1.6L + 0.5Lr', 10.8, 4.32], ['1.2D + 1.6Lr + 1.0L', 9, 3.6], ['1.2D + 1.6Lr + 0.5W', 7, 2.8],
  ['1.2D + 1.6Lr − 0.5W', 5, 2], ['1.2D + 1.6Lr − 0.5W, W omitted', 6, 2.4], ['1.2D + 1.0W + 1.0L + 0.5Lr', 11, 4.4], ['1.2D − 1.0W + 1.0L + 0.5Lr', 7, 2.8],
  ['1.2D − 1.0W + 1.0L + 0.5Lr, W omitted', 9, 3.6], ['1.2D + 1.0E + 1.0L + 0.2S', 9, 3.6], ['0.9D + 1.0W', 6.5, 2.6], ['0.9D − 1.0W', 2.5, 1],
  ['0.9D − 1.0W, W omitted', 4.5, 1.8], ['0.9D + 1.0E', 4.5, 1.8]];

const frameOf = async p => { const f = await (await p.$('#suite-frame-capacity')).contentFrame();
  await f.waitForFunction(() => typeof computeAll === 'function' && typeof CC !== 'undefined' && CC, null, { timeout: 30000 }); return f; };
const show = (f, key) => f.evaluate(k => { let e = document.querySelector(`[data-fkey="${k}"]`); const pn = e.closest('.rcbInPane');
  if (pn && !e.getClientRects().length) document.getElementById(pn.id.replace('rcbInPane_', 'rcbInTab_')).click();
  e = document.querySelector(`[data-fkey="${k}"]`); e.scrollIntoView(); return true; }, key);
const typeIn = async (p, f, key, s) => { await show(f, key); await f.evaluate(k => { const e = document.querySelector(`[data-fkey="${k}"]`); e.focus(); e.select(); }, key);
  await p.keyboard.press('Control+A'); await p.keyboard.type(s); await f.evaluate(() => document.activeElement.blur()); await p.waitForTimeout(40); };
const pick = async (f, key, v) => { await show(f, key); await f.evaluate(([k, v]) => { const s = document.querySelector(`[data-fkey="${k}"]`); s.value = v; s.dispatchEvent(new Event('change')); }, [key, v]); };
const click = async (f, txt) => f.evaluate(t => { const b = [...document.querySelectorAll('#inputPanel button')].find(x => x.textContent.trim() === t); b.click(); }, txt);
const sideways = async f => f.evaluate(() => { const out = []; const t0 = S.ui.tab;
  TABS().forEach(([id]) => { S.ui.tab = id; refresh(); const w = document.documentElement.scrollWidth - document.documentElement.clientWidth; if (w > 1) out.push(id + ' ' + w); });
  S.ui.tab = t0; refresh(); return out; });
const rowOf = (f, name) => f.evaluate(n => { const r = CC.combos.find(x => x.name === n); return r ? [r.Mu, r.Vu] : null; }, name);

for (const vw of [1400, 390]) {
  console.log('--- viewport ' + vw + ' px');
  let { b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900 });
  let f = await frameOf(p);
  let r = await f.evaluate(() => ({ mode: S.loadMode, ll: JSON.stringify(S.svc.ll), n: CC.combos.length, blk: [...document.querySelectorAll('#inputPanel h3')].some(h => h.textContent === 'Line loads (optional)'), sw: document.querySelector('[data-fkey="llSw"]').checked }));
  ok(r.mode === 'service' && r.blk && !r.sw && r.n === 7 && r.ll === '{"L":0,"sup":"simple","vAt":"face","sw":false,"gc":150,"rows":[]}', `new project: Line loads block, no rows, self-weight off, 7 rows (${r.ll})`);
  await typeIn(p, f, 'llL', '20');
  for (let i = 0; i < 3; i++) await click(f, '+ Add line load');
  await pick(f, 'llM0', 'q'); await typeIn(p, f, 'llQ0', '100'); await typeIn(p, f, 'llB0', '10'); await typeIn(p, f, 'llN0', 'floor');
  await typeIn(p, f, 'llW1', '0.2');
  await pick(f, 'llK2', 'L'); await pick(f, 'llM2', 'q'); await typeIn(p, f, 'llQ2', '50'); await typeIn(p, f, 'llB2', '10');
  r = await f.evaluate(() => { const X = cbcLlX(); return { wD: X.cases.D.w, wL: X.cases.L.w, MD: X.cases.D.M, VD: X.cases.D.V, ML: X.cases.L.M, VL: X.cases.L.V,
    tbl: [...document.querySelectorAll('#inputPanel table.cbT')].map(t => t.innerText).join(' | '), link: !!document.querySelector('#inputPanel a.wkA[data-card="ldLine"]') }; });
  ok(near(r.wD, 1.2) && near(r.wL, 0.5) && near(r.MD, 60) && near(r.VD, 12) && near(r.ML, 25) && near(r.VL, 5), `w_D ${r.wD}, w_L ${r.wL}; M_D ${r.MD}, V_D ${r.VD}; M_L ${r.ML}, V_L ${r.VL}`);
  ok(/60\.00/.test(r.tbl) && /12\.00/.test(r.tbl) && /25\.00/.test(r.tbl) && r.link, 'input panel: the line-load M, V per case and a link to the Line Loads card');
  let u = await rowOf(f, '1.2D + 1.6L + 0.5Lr'); ok(u && near(u[0], 112) && near(u[1], 22.4), `(5.3.1b) 1.2D + 1.6L + 0.5Lr: M_u ${u && u[0]}, V_u ${u && u[1]} (112.00, 22.40)`);
  u = await rowOf(f, '1.4D'); ok(u && near(u[0], 84) && near(u[1], 16.8), `(5.3.1a) 1.4D: ${u}`);
  if (SHOTS) { await f.evaluate(() => { const e = [...document.querySelectorAll('#inputPanel h3')].find(h => h.textContent === 'Line loads (optional)'); e.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, `cb-lineloads-inputs-${vw}.png`) }); }
  // the Line Loads card
  await f.evaluate(() => document.querySelector('#inputPanel a.wkA[data-card="ldLine"]').click()); await p.waitForTimeout(400);
  r = await f.evaluate(() => ({ tab: S.ui.tab, ann: [...document.querySelectorAll('#ldLine annotation')].map(a => a.textContent).join(' ‖ '), txt: (document.querySelector('#ldLine') || {}).innerText || '',
    c7: [...document.querySelectorAll('#ldC1 annotation')].map(a => a.textContent).join(' ‖ ') }));
  ok(r.tab === 'tabLoads' && r.ann.includes('\\dfrac{(100.00\\text{ psf})(10.00\\text{ ft})}{1000} = 1.000') && r.ann.includes('w_{D} = 1.000 + 0.200 = 1.200') && r.ann.includes('\\dfrac{(1.200)(20.00)^2}{8} = 60.00')
    && r.ann.includes('= 1.200\\left(10.00\\right) = 12.00') && r.ann.includes('M_{D} = M_{D,entered} + M_{D,line} = 0.00 + 60.00 = 60.00'), 'Line Loads card: symbolic, substituted, result; entered + line = total');
  ok(/different locations/.test(r.txt), 'Line Loads card states that M (midspan) and V (support) come from different locations');
  ok(r.c7.includes('M_u = 1.2(60.00) + 1.6(25.00) + 0.5(0.00) = 112.00') && r.c7.includes('V_u = 1.2(12.00) + 1.6(5.00) + 0.5(0.00) = 22.40'), 'combination card (5.3.1b) uses the case totals: 112.00 / 22.40');
  if (SHOTS) { const c = await f.$('#ldLine'); await c.screenshot({ path: path.join(SHOTS, `cb-lineloads-worked-${vw}.png`) }); }
  r = await f.evaluate(() => { const M = mrModel(), t = SharedReport.text(SharedReport.build(M), { legacy: true }); return { t }; });
  ok(/Line loads/.test(r.t) && /floor/.test(r.t) && /60\.00 §\d+\.\d+/.test(r.t) && /12\.00 §\d+\.\d+/.test(r.t) && /different locations/.test(r.t) && !/\[\[|NaN|undefined/.test(r.t),
    'Report: line-load inputs, worked steps, the case table links to them (§), no unresolved link or NaN');
  const sw = await sideways(f); ok(!sw.length, 'no sideways scroll on any tab' + (sw.length ? ': ' + sw.join(', ') : ''));
  await p.reload(); f = await frameOf(p);
  r = await f.evaluate(() => { const a = JSON.parse(localStorage.getItem('rcbeam_v2_auto')); const c = CC.combos.find(x => x.name === '1.2D + 1.6L + 0.5Lr'); return { n: a.svc.ll.rows.length, L: a.svc.ll.L, mu: c.Mu }; });
  ok(r.n === 3 && r.L === 20 && near(r.mu, 112), 'after a reload: the line loads kept (rcbeam_v2_auto svc.ll), M_u 112.00');
  // cantilever, then V at d
  await pick(f, 'llSup', 'cant');
  r = await f.evaluate(() => { const X = cbcLlX(); return { MD: X.cases.D.M, VD: X.cases.D.V, d: X.dIn }; });
  ok(near(r.MD, -240) && near(r.VD, 24), `cantilever: M_D ${r.MD} (−240.00), V_D ${r.VD} (24.00)`);
  await pick(f, 'llVat', 'd');
  r = await f.evaluate(() => { const X = cbcLlX(); const c = CC.combos.find(x => x.name === '1.2D + 1.6L + 0.5Lr'); return { VD: X.cases.D.V, VL: X.cases.L.V, d: X.dIn, vu: c.Vu, mu: c.Mu, neg: c.Mu < 0 }; });
  ok(r.d > 0 && near(r.VD, 1.2 * (20 - r.d / 12)) && near(r.vu, 1.2 * r.VD + 1.6 * r.VL) && near(r.mu, -1.2 * 240 - 1.6 * 100), `cantilever, V at d = ${r.d.toFixed(2)} in: V_D ${r.VD.toFixed(3)}; M_u ${r.mu} (−448.00, hogging), V_u ${r.vu.toFixed(3)}`);
  ok(!errs.length, 'console errors: ' + errs.length + (errs.length ? ' ' + errs.slice(0, 3).join(' | ') : ''));
  await b.close();
  // an older service save without svc.ll
  ({ b, p, errs } = await openPage(FILE, { hash: '#capacity', vw, vh: 900, ls: { rcbeam_v2_auto: JSON.stringify(OLDSVC) } }));
  f = await frameOf(p);
  r = await f.evaluate(() => ({ rows: CC.combos.map(x => [x.name, x.Mu, x.Vu]), any: cbcLlX().any, card: !!document.querySelector('#ldLine') }));
  ok(!r.any && r.rows.length === HAND.length && HAND.every((h, i) => r.rows[i][0] === h[0] && near(r.rows[i][1], h[1]) && near(r.rows[i][2], h[2])), 'older service save (no svc.ll): no line loads, the 14 rows as before');
  r = await f.evaluate(() => { S.ui.tab = 'tabLoads'; refresh(); return { card: !!document.querySelector('#ldLine'), t: SharedReport.text(SharedReport.build(mrModel()), { legacy: true }) }; });
  ok(!r.card && !/Line loads/.test(r.t), 'older save: no Line Loads card, no line-load section in the Report');
  ok(!errs.length, 'console errors (older save): ' + errs.length);
  await b.close();
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
