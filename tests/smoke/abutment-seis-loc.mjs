#!/usr/bin/env node
// Abutment calculator: seismic earth pressure location, panel I-11 (SEL, 2026-11-11, engineer-approved).
//   node tests/smoke/abutment-seis-loc.mjs [file]   (default: abutment_calculator.html in this tree)
// Options (seismic.hEQmode): (a) "sw" Seed & Whitman ΔP_AE at 0.6H; (b) "static" combined P_AE at H/3 (not below the
// static resultant; new projects, engineer decision 2026-11-12); (c) "comb" combined P_AE at hAEr·H, 0.4–0.5; (d) "nonyield" combined P_AE at H/2; "ratio" = earlier option (saved).
// Hand values: default project, Extreme Event I on (A_s = 0.15, k_h = 0.5·k_h0 = 0.075, spread footing), H = 22 ft, γ = 0.120 kcf,
// φ = 32° (Rankine, K_A = tan²29° = 0.30726), L_ab = 44 ft:
//   K_AE = 0.35166, P_AE = ½γH²K_AE = 10.212 kip/ft, P_A = 8.923 kip/ft, ΔP_AE = 1.289 kip/ft, ΔP_AE·L_ab = 56.73 kip
//   (a) z̄_Δ = 0.6·22 = 13.20 ft, M = 748.86 kip-ft;  (b) z̄_Δ = 7.333 ft, M = 416.03 kip-ft
//   (c) r = 0.5 and (d): z̄_Δ = (P_AE·11 − P_A·7.333)/ΔP_AE = 36.37 ft, M = 2063.6 kip-ft;  case B: ½P_AE < P_A, no increment.
//   EE I case A (1.0 long. + 0.3 trans.): V = 1867.05 kip, M_v = 13493.6 kip-ft, M_h = 5254.83 + (M − 416.03), e = B/2 − (M_v − M_h)/V, B = 13 ft
//   stem (H_s = 19 ft): ΔP = ½ΔK_hγH_s² = 0.9617 kip/ft; M = ΔP·0.6H_s = 10.963 (a), ΔP·H_s/3 = 6.091 (b),
//   (c)/(d): (ΔK_h + K_A)γH_s²/2 · 9.5 − K_AγH_s³/6 = 7.6169·9.5 − 42.150 = 30.21 kip-ft/ft
//   backwall (h = 5 ft): ΔP = 0.0666 kip/ft at 3.00 ft (a), 1.667 ft (b), [(ΔK + K_A)·0.5 − K_A/3]/ΔK·h = 8.267 ft (c)/(d)
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.resolve(REPO, process.argv.slice(2).find(a => !a.startsWith('--')) || 'abutment_calculator.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const near = (a, b, tol) => isFinite(a) && Math.abs(a - b) <= tol;
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const allErrs = [];

const run = (p, mode, extra) => p.evaluate(([m, x]) => { S.seismic.on = true; if (m) S.seismic.hEQmode = m; Object.assign(S.seismic, x || {}); recalcAll();
  const R = LAST_R, q = R.seis, ee = R.permTables['Extreme Event I'][0], st = R.stemEQ, bw = R.bwEE && R.bwEE.ee;
  return { mode: S.seismic.hEQmode, KAE: q.KAE, PAE: q.PAE, PA: q.PaSumA, dPAE: q.dPAE, dPAEh: q.dPAEh, zEQ: q.zEQ, zEQB: q.zEQB, fB: q.fB, Mh: R.groups.EQd.Mh,
    V: ee.V, MhEE: ee.Mh, eEE: ee.e, B: R.geo.B, stM: st && st.iA.M, stV: st && st.iA.V, bwz: bw && bw.zP, bwdP: bw && bw.dP, warn: (typeof WARNINGS !== 'undefined' ? WARNINGS : []).map(w => w.msg).join(' | '),
    fp: R.fingerprint }; }, [mode, extra]);

// ---- 1. a new project: option (b) (engineer decision 2026-11-12), hAEr 0.5; the four options listed in order
{
  const o = await openPage(FILE); const p = o.p; await ready(p);
  const st = await p.evaluate(() => ({ m: S.seismic.hEQmode, r: S.seismic.hAEr }));
  check(st.m === 'static' && st.r === 0.5, `new project: location (b) combined P_AE at H/3, hAEr 0.5 (got ${st.m}, ${st.r})`);
  check(await p.evaluate(() => /Option \(b\) is the tool default for new projects/.test(eqLocNoteHTML())), 'location note: option (b) is the default for new projects');
  await p.evaluate(() => { S.seismic.on = true; buildInputs(); recalcAll(); });
  const opts = await p.evaluate(() => [...document.querySelectorAll('select[data-path="seismic.hEQmode"] option')].map(x => x.value));
  check(JSON.stringify(opts) === JSON.stringify(['sw', 'static', 'comb', 'nonyield']), 'panel I-11: options (a) to (d) in order: ' + opts.join(', '));
  check(await p.evaluate(() => /Seismic earth pressure location/.test(document.querySelector('[data-cid="in-seis"]').textContent)), 'panel I-11: the location note is shown');

  const n = await run(p, null);
  check(n.mode === 'static' && near(n.zEQ, 22 / 3, 1e-9) && near(n.Mh, 416.03, 0.02) && near(n.MhEE, 5254.83, 0.05) && near(n.eEE, 2.0873, 2e-4), `new project (b): ΔP_AE at ${n.zEQ.toFixed(3)} ft, M ${n.Mh.toFixed(2)}, EE I M_h ${n.MhEE.toFixed(2)}, e ${n.eEE.toFixed(4)} ft (hand 7.333, 416.03, 5254.83, 2.0873)`);
  const a = await run(p, 'sw');
  check(near(a.KAE, 0.35166, 5e-5) && near(a.PAE, 10.212, 2e-3) && near(a.dPAE, 1.289, 1e-3) && near(a.dPAEh, 56.73, 0.02), `K_AE ${a.KAE.toFixed(5)}, P_AE ${a.PAE.toFixed(3)}, ΔP_AE ${a.dPAE.toFixed(3)} kip/ft, ×L_ab ${a.dPAEh.toFixed(2)} kip`);
  check(near(a.zEQ, 13.2, 1e-9) && near(a.Mh, 748.86, 0.02), `(a) ΔP_AE at 0.6H = ${a.zEQ.toFixed(3)} ft, M = ${a.Mh.toFixed(2)} kip-ft (hand 13.20, 748.86)`);
  check(near(a.V, 1867.05, 0.02) && near(a.MhEE, 5587.66, 0.05) && near(a.eEE, 2.2655, 2e-4), `(a) EE I case A: M_h ${a.MhEE.toFixed(2)}, e ${a.eEE.toFixed(4)} ft (hand 5587.66, 2.2655)`);
  check(near(a.stM, 10.963, 2e-3) && near(a.bwz, 3.0, 1e-9), `(a) stem M_ΔP ${a.stM.toFixed(3)} kip-ft/ft (hand 10.963), backwall ΔP at ${a.bwz.toFixed(3)} ft (hand 3.00)`);

  const b = await run(p, 'static');
  check(near(b.zEQ, 22 / 3, 1e-9) && near(b.Mh, 416.03, 0.02) && near(b.MhEE, 5254.83, 0.05) && near(b.eEE, 2.0873, 2e-4), `(b) ΔP_AE at ${b.zEQ.toFixed(3)} ft, M ${b.Mh.toFixed(2)}, EE I e ${b.eEE.toFixed(4)} ft (hand 7.333, 416.03, 2.0873)`);
  check(near(b.stM, 6.091, 2e-3) && near(b.bwz, 5 / 3, 1e-9), `(b) stem M_ΔP ${b.stM.toFixed(3)} (hand 6.091), backwall at ${b.bwz.toFixed(3)} ft (hand 1.667)`);

  const c = await run(p, 'comb', { hAEr: 0.5 });
  const zc = (c.PAE * 11 - c.PA * 22 / 3) / c.dPAE;
  check(near(c.zEQ, 36.37, 0.01) && near(c.zEQ, zc, 1e-9) && near(c.Mh, 2063.6, 0.2), `(c) 0.5H: z̄_Δ ${c.zEQ.toFixed(2)} ft, M ${c.Mh.toFixed(1)} kip-ft (hand 36.37, 2063.6)`);
  const eHand = c.B / 2 - (13493.58 - (5254.83 - 416.03 + 2063.59)) / 1867.05;
  check(near(c.eEE, eHand, 2e-3) && c.fB === 0, `(c) EE I e ${c.eEE.toFixed(4)} ft (hand ${eHand.toFixed(4)}); case B increment 0 (½P_AE < P_A)`);
  check(near(c.stM, 30.21, 0.01) && near(c.bwz, 8.267, 2e-3), `(c) stem M_ΔP ${c.stM.toFixed(3)} (hand 30.21), backwall at ${c.bwz.toFixed(3)} ft (hand 8.267)`);
  const c45 = await run(p, 'comb', { hAEr: 0.45 });
  check(near(c45.zEQ, (c45.PAE * 0.45 * 22 - c45.PA * 22 / 3) / c45.dPAE, 1e-9), `(c) 0.45H: z̄_Δ ${c45.zEQ.toFixed(2)} ft`);
  const cBad = await run(p, 'comb', { hAEr: 0.6 });
  check(/Combined P_AE height ratio/.test(cBad.warn), '(c) ratio 0.6 is flagged as an input error (0.4 to 0.5)');

  const d = await run(p, 'nonyield', { hAEr: 0.5 });
  check(near(d.zEQ, c.zEQ, 1e-9) && near(d.Mh, c.Mh, 1e-9), `(d) H/2 = (c) at 0.5: z̄_Δ ${d.zEQ.toFixed(2)} ft`);
  check(/nonyielding wall/.test(d.warn) && /REVIEW/.test(d.warn), '(d) with k_h = 0.5·k_h0: REVIEW to use k_h = 1.0·k_h0 [11.6.5.4]');
  const d1 = await run(p, 'nonyield', { khRAuto: false, khR: 1.0 });
  check(!/location is \(d\) nonyielding/.test(d1.warn), '(d) with k_h = 1.0·k_h0: no REVIEW');

  // higher k_h: case B has an increment; in (c) it acts at its own height ((½P_AE·z̄_AE − P_A·z̄_A)/(½P_AE − P_A))
  const hi = await run(p, 'comb', { khRAuto: false, khR: 1.0, As: 0.6, hAEr: 0.5 });
  const zB = (0.5 * hi.PAE * 11 - hi.PA * 22 / 3) / (0.5 * hi.PAE - hi.PA);
  check(hi.fB > 0 && near(hi.zEQB, zB, 1e-9), `(c) A_s 0.6, k_h = k_h0: case B f_B ${hi.fB.toFixed(3)}, at ${hi.zEQB.toFixed(2)} ft (hand ${zB.toFixed(2)})`);
  const zRow = await p.evaluate(() => { const t = LAST_R.permTables['Extreme Event I'], f = nc => t.find(r => r.perm && r.perm.nc === nc && r.perm.dir === 'L' && !r.perm.rev);
    const z = nc => { const c = f(nc), row = c && LAST_R.comboRows(c).rows.find(x => x.k === 'EQd'); return row ? row.z : NaN; }; return { A: z('A'), B: z('B') }; });
  check(near(zRow.A, hi.zEQ, 1e-9) && near(zRow.B, zB, 1e-9), `free body rows: ΔP_AE at ${zRow.A.toFixed(2)} ft in case A, ${zRow.B.toFixed(2)} ft in case B`);

  // §6: Tab 3 §3.6a and the Report show the location
  await p.evaluate(() => { Object.assign(S.seismic, { hEQmode: 'sw', As: 0.15, khRAuto: true }); recalcAll(); gotoPanel('tab-stab', 'o-mo'); });
  await p.waitForTimeout(300);
  check(await p.evaluate(() => /Seed &? ?(&amp;)?\s*Whitman|Seed & Whitman/.test(document.getElementById('tab-stab').textContent)), 'Tab 3: the location is stated with the ΔP_AE work');
  await p.evaluate(() => abrShow()); await p.waitForTimeout(800);
  check(await p.evaluate(() => /Seismic earth pressure location/.test(document.getElementById('tab-rpt').textContent)), 'Report: the location row and note');
  allErrs.push(...o.errs); await o.b.close();
}

// ---- 2. saved projects keep their mode (§5): "static", "ratio" (any value), and a project saved before the mode existed
{
  const base = await (async () => { const o = await openPage(FILE); await ready(o.p); const s = await o.p.evaluate(() => JSON.stringify(defaultState())); allErrs.push(...o.errs); await o.b.close(); return JSON.parse(s); })();
  const mk = f => { const s = JSON.parse(JSON.stringify(base)); s.seismic.on = true; delete s.seismic.hAEr; f(s); return JSON.stringify(s); };
  const cases = [['sw', s => { s.seismic.hEQmode = 'sw'; }, 'sw', 13.2], ['static', s => { s.seismic.hEQmode = 'static'; }, 'static', 22 / 3],
    ['comb 0.45', s => { s.seismic.hEQmode = 'comb'; s.seismic.hAEr = 0.45; }, 'comb', r => (r.PAE * 0.45 * 22 - r.PA * 22 / 3) / r.dPAE],
    ['nonyield', s => { s.seismic.hEQmode = 'nonyield'; }, 'nonyield', r => (r.PAE * 11 - r.PA * 22 / 3) / r.dPAE], ['ratio 0.45', s => { s.seismic.hEQmode = 'ratio'; s.seismic.hEQr = 0.45; }, 'ratio', 9.9],
    ['pre-mode, 0.6', s => { delete s.seismic.hEQmode; s.seismic.hEQr = 0.6; }, 'static', 22 / 3], ['pre-mode, 0.5', s => { delete s.seismic.hEQmode; s.seismic.hEQr = 0.5; }, 'ratio', 11]];
  for (const [name, f, want, z] of cases) {
    const o = await openPage(FILE, { ls: { abutcalc_v1_autosave: mk(f) } }); await ready(o.p); await o.p.waitForTimeout(500);
    const r = await o.p.evaluate(() => { recalcAll(); return { m: S.seismic.hEQmode, z: LAST_R.seis.zEQ, PAE: LAST_R.seis.PAE, PA: LAST_R.seis.PaSumA, dPAE: LAST_R.seis.dPAE, opts: [...document.querySelectorAll('select[data-path="seismic.hEQmode"] option')].map(x => x.value) }; });
    const zw = typeof z === 'function' ? z(r) : z;
    check(r.m === want && near(r.z, zw, 1e-9), `saved (${name}): keeps "${r.m}", ΔP_AE at ${r.z.toFixed(3)} ft`);
    if (want === 'ratio') check(r.opts.includes('ratio'), `saved (${name}): the earlier option is listed`);
    allErrs.push(...o.errs); await o.b.close();
  }
}

// ---- 3. 390 px with option (c) shown
{
  const o = await openPage(FILE, { vw: 390, vh: 844 }); const p = o.p; await ready(p);
  await p.evaluate(() => { S.seismic.on = true; S.seismic.hEQmode = 'comb'; buildInputs(); recalcAll(); });
  await p.click('#abutInTab_seis'); await p.waitForTimeout(200);
  const M = await p.evaluate(() => ({ page: document.documentElement.scrollWidth <= innerWidth, ratio: !!document.querySelector('input[data-path="seismic.hAEr"]') }));
  check(M.page && M.ratio, '390 px: no horizontal page scroll; the (c) ratio input is shown');
  allErrs.push(...o.errs); await o.b.close();
}

check(allErrs.length === 0, `0 console errors${allErrs.length ? ': ' + allErrs.slice(0, 5).join(' | ') : ''}`);
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
