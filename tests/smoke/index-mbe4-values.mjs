#!/usr/bin/env node
// index.html (girder rating): AASHTO MBE 4th Ed. (2026) values adopted (MBE4, engineer's standing rule 2026-11-10).
//   1. Steel Service II flange-stress limit f_R (MBE 4th Ed. Art. 6A.6.4.2.2, p. 6-66): 0.95·Fyf for a composite section,
//      0.80·Rh·Fyf for a noncomposite section (was 0.95·Rh·Fyf for every section). "Section for f_R" box: by zone type
//      (default; a Composite zone is composite, every other zone noncomposite), or composite / noncomposite for every zone.
//   2. PS Service III γ_LL (MBE 4th Ed. Table 6A.4.2.2-2, p. 6-24; Art. 6A.5.4.2.2a): 1.0 with the refined losses of LRFD
//      Art. 5.9.3.4 and the elastic gain, 0.8 otherwise; legal loads 1.0. A γ_LL stored in a saved project is used as entered.
//   3. φ_s = 1.0 on shear at the strength limit state (MBE 4th Ed. Art. 6A.4.2.4, p. 6-25): C_V = φ_c·φ_v·V_n (was φ_c·φ_s·φ_v·V_n).
//   node tests/smoke/index-mbe4-values.mjs [--file index.html]
// Hand checks (seeded MIDAS rows of index-report.mjs):
//   1. sv2n (Steel Calc zone W27X94, Sx⁺ = Sx⁻ = 243 in³, Fy = 50 ksi, Rh = 1.0, LRFR Inventory, γ_LL = 1.30), node 113 (x = 50 ft), M⁺:
//      f_DC = 1.988, f_DW = 1.253, f_LL = 17.195 ksi; f_R = 0.80·1.0·50 = 40.0 ksi (was 0.95·1.0·50 = 47.5);
//      RF = (40.0 − 1.988 − 1.253) / (1.30·17.195) = 36.759 / 22.354 = 1.645 (was 44.259 / 22.354 = 1.980).
//      sv2c (the same as a Composite zone, Rh = 0.9): f_R = 0.95·50 = 47.5 ksi (was 0.95·0.9·50 = 42.75);
//      RF = (47.5 − 3.241) / 22.354 = 1.980 (was 39.509 / 22.354 = 1.767). Box "Noncomposite": f_R = 0.80·0.9·50 = 36.0 ksi.
//   2. PS zone (f'c = 6, fpe = 0.5, Sb = 12000, St = 9000): RF ∝ 1/γ_LL, so 0.8 → 1.0 gives RF × 0.8.
//   3. phis (manual zone Vn = 220 kip, φ_s = 0.85 two-girder, φ_c = φ_v = 1.0): C_V = 1.0·1.0·220 = 220.0 kip (was 0.85·220 = 187.0);
//      C_M+ = 0.85·900 = 765.0 kip-ft, unchanged.
import path from 'path';
import { open, step, subTab, CASES } from './index-report.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(arg('file', 'index.html'));

const B = CASES.base, L = CASES.lfr;
const psZone = extra => ({ id: 'capP', startX: 0, endX: 81, type: 'psconc', MnPos: 0, MnNeg: 3000, Vn: 0, Fy: 50, ZxPos: 0, ZxNeg: 0, Aw: 0, SxPos: 0, SxNeg: 0,
  aremaComps: null, outToOut: 42, fc: 6, Aps: 4.896, fpu: 270, fpy: 243, dp: 50, fpe: 0.5, b: 72, hf: 7.5, bw: 8, dv: 45, Av: 0.4, s: 12, Sb: 12000, St: 9000, ...extra });
const ps3LC = { ps3DcLC: 'DC1 - Non-composite DL', ps3DwLC: 'DW - Barrier/Overlay', ps3LLposLC: 'HL-93TRK_Suspended Span(max)', ps3LLnegLC: 'HL-93TRK_Suspended Span(min)' };
const sv2LC = { serviceIIDcLC: 'DC1 - Non-composite DL', serviceIIDwLC: 'DW - Barrier/Overlay', serviceIILLposLC: 'HL-93TRK_Suspended Span(max)', serviceIILLnegLC: 'HL-93TRK_Suspended Span(min)' };
const lrfr = { ...L.cfg.rating, method: 'LRFR', level: 'Inventory', ...sv2LC };
const qz = { ...L.zones[0], SxPos: 243, SxNeg: 243 };
CASES.sv2n = { ...L, cfg: { ...L.cfg, rating: lrfr }, zones: [qz] };
CASES.sv2c = { ...L, cfg: { ...L.cfg, rating: { ...lrfr, serviceIIRh: 0.9 } }, zones: [{ ...qz, type: 'composite', fc: 4, beff: 96, ts: 8 }] };
CASES.ps3new = { ...B, cfg: { ...B.cfg, rating: { ...B.cfg.rating, structType: 'psconc', category: 'Legal', ...ps3LC } }, zones: [psZone({})] };
CASES.ps3des = { ...B, cfg: { ...B.cfg, rating: { ...B.cfg.rating, structType: 'psconc', ...ps3LC } }, zones: [psZone({})] };
CASES.ps3saved = { ...B, cfg: { ...B.cfg, rating: { ...B.cfg.rating, structType: 'psconc', category: 'Legal', ps3GamLL: 0.8, ...ps3LC } }, zones: [psZone({})] };
CASES.phis = { ...B, cfg: { ...B.cfg, rating: { ...B.cfg.rating, sysKey: 'Welded I-beam, two-girder' } } };

let fails = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fails++; };
const text = p => p.evaluate(() => document.querySelector('#root').innerText);
const rating = p => p.evaluate(() => JSON.parse(localStorage.getItem('mct_cfg_v3')).rating);
const rowOf = (t, node) => (t.split('\n').find(l => l.startsWith(node + '\t')) || '').split('\t');
const selectNear = (p, label, v) => p.evaluate(([l, v]) => { const s = [...document.querySelectorAll('span')].find(x => x.textContent.trim() === l);
  const sel = s && s.parentElement.querySelector('select'); if (!sel) return false;
  const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, v); sel.dispatchEvent(new Event('change', { bubbles: true })); return true; }, [label, v]);
const ps3RF = t => { const m = t.match(/PS Service III\tService\t([\d.]+)\t([\d.]+)/); return m ? [+m[1], +m[2]] : null; };

async function run(cs, fn) { const o = await open(FILE, cs); try { await step(o.p, 'AASHTO Rating'); await o.p.waitForTimeout(1200); await fn(o.p); }
  finally { ok(!o.errs.length, cs + ': 0 console errors ' + JSON.stringify(o.errs.slice(0, 2))); await o.b.close(); } }

// 1. Service II f_R
await run('sv2n', async p => {
  await subTab(p, 'Service II'); const t = await text(p), r = rowOf(t, '113');
  ok(r[5] === 'noncomposite' && r[6] === '40' && r[11] === '1.645', 'sv2n: node 113 noncomposite, f_R = 0.80·1.0·50 = 40 ksi, RF M⁺ = 1.645 (was 47.5, 1.980) ' + JSON.stringify(r.slice(4, 12)));
  ok(t.includes('f_R = 0.95·Fyf composite (negative-moment regions included) · 0.80·Rh·Fyf noncomposite') && t.includes('MBE 4th Ed. 6A.6.4.2.2'), 'sv2n: f_R basis line on the step');
  await subTab(p, 'Summary'); ok(/Service II \(Steel\)\t—\t1\.30\t1\.645/.test(await text(p)), 'sv2n: Summary Service II RF 1.645');
  await subTab(p, 'Inputs & Setup'); ok((await text(p)).includes('Service II stress limit f_R = 0.80·Rh·Fyf (noncomposite) = 40.0 ksi'), 'sv2n: zone card f_R line');
});
await run('sv2c', async p => {
  await subTab(p, 'Service II'); let r = rowOf(await text(p), '113');
  ok(r[5] === 'composite' && r[6] === '47.5' && r[11] === '1.980', 'sv2c: node 113 composite, f_R = 0.95·50 = 47.5 ksi (Rh not applied), RF 1.980 (was 42.75, 1.767) ' + JSON.stringify(r.slice(4, 12)));
  ok(await selectNear(p, 'Section for f_R', 'noncomposite'), 'sv2c: Section box found'); await p.waitForTimeout(800);
  r = rowOf(await text(p), '113');
  ok(r[5] === 'noncomposite' && r[6] === '36', 'sv2c: box Noncomposite → f_R = 0.80·0.9·50 = 36 ksi ' + JSON.stringify(r.slice(4, 7)));
  ok((await rating(p)).serviceIISection === 'noncomposite', 'sv2c: box stored as rating.serviceIISection');
});
// 2. PS Service III γ_LL
await run('ps3new', async p => {
  await subTab(p, 'PS Service III'); const t = await text(p);
  ok(t.includes('γ_LL = 1 (MBE 4th Ed.)') && t.includes('blank = MBE 4th Ed. value 1.0'), 'ps3new (legal, no γ_LL stored): γ_LL = 1.0 (6A.5.4.2.2a)');
  ok((await rating(p)).ps3GamLL == null, 'ps3new: nothing written for γ_LL');
});
await run('ps3des', async p => {
  await subTab(p, 'Summary'); const a = ps3RF(await text(p));
  await subTab(p, 'PS Service III');
  ok((await text(p)).includes('γ_LL = 0.8 (MBE 4th Ed.)'), 'ps3des (design, losses Other): γ_LL = 0.8');
  ok(await selectNear(p, 'Prestress losses', 'refined'), 'ps3des: losses box found'); await p.waitForTimeout(800);
  ok((await text(p)).includes('γ_LL = 1 (MBE 4th Ed.)'), 'ps3des: losses Refined → γ_LL = 1.0 (Table 6A.4.2.2-2)');
  ok((await rating(p)).ps3Losses === 'refined', 'ps3des: stored as rating.ps3Losses');
  await subTab(p, 'Summary'); const b = ps3RF(await text(p));
  ok(a && b && a[0] === 0.8 && b[0] === 1 && Math.abs(b[1] - a[1] * 0.8) <= 0.0015, 'ps3des: PS Service III RF × 0.8 when γ_LL 0.8 → 1.0 ' + JSON.stringify([a, b]));
  await subTab(p, 'PS Service III');
  const box = p.locator('xpath=//span[normalize-space(text())="γ_LL (Service III)"]/following-sibling::input').first();
  await box.fill('0.9'); await box.blur(); await p.waitForTimeout(600);
  ok((await rating(p)).ps3GamLL === 0.9 && (await text(p)).includes('γ_LL = 0.9 (entered)'), 'ps3des: typed 0.9 → stored and used as entered');
  await p.evaluate(() => [...document.querySelectorAll('button')].find(b => b.textContent.trim() === 'use it').click()); await p.waitForTimeout(600);
  ok((await rating(p)).ps3GamLL == null && (await text(p)).includes('γ_LL = 1 (MBE 4th Ed.)'), 'ps3des: "use it" → back to the 4th Ed. value');
});
await run('ps3saved', async p => {
  await subTab(p, 'PS Service III'); const t = await text(p);
  ok(t.includes('γ_LL = 0.8 (entered)') && t.includes('entered; MBE 4th Ed. value 1.0'), 'ps3saved (legal, 0.8 stored): kept as entered, 4th Ed. value shown');
  ok((await rating(p)).ps3GamLL === 0.8, 'ps3saved: stored 0.8 unchanged');
});
// 3. φ_s on shear
await run('phis', async p => {
  const t = await text(p);
  ok(/C_M\+=765\.0 ft·k\s+C_M−=595\.0 ft·k\s+C_V=220\.0 kips/.test(t), 'phis: preview C_M+ = 0.85·900 = 765.0, C_M− = 0.85·700 = 595.0, C_V = 1.0·220 = 220.0 (was 187.0)');
  ok(t.includes('φ_s on shear: taken as 1.0 for shear at the strength limit state (MBE 4th Ed. Art. 6A.4.2.4, p. 6-25)'), 'phis: basis note on the step');
  await step(p, 'Report'); await p.waitForTimeout(2500);
  await p.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await p.waitForTimeout(1200);
  await p.emulateMedia({ media: 'print' });
  const rep = await p.evaluate(() => document.querySelector('#rp-print').innerText);
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint'))); await p.waitForTimeout(600);
  ok(rep.includes('φ_s on shear: taken as 1.0') && rep.includes('φ_s = 1.00 on shear, Art. 6A.4.2.4'), 'phis: Report §3 note and the C_V step state φ_s = 1.0 on shear');
});
console.log(fails ? fails + ' failure(s)' : 'all passed');
process.exit(fails ? 1 : 0);
