#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): "Pull from SubLoads" (channel abutmentLoads, HANDOFF.md §4.5) — ABPF, 2026-11-11.
//   node tests/smoke/abutment-subloads-pull.mjs
// Fixture: abutment-subloads-pull.payload.json = SubLoads' default "Send to Abutment Calculator" payload (Example three-span
// continuous, Abut. 1, skew +15°, no SH case), frozen 2026-11-11 so SubLoads edits do not move the pinned values.
// 1. Positive skew: geometry imported (skew 15); CR/SH group offered as "set to 0" and ticked by default; after Apply the CR/SH
//    row is 0, the CR/SH share is unchanged, the source notes say so (Hand-offs card and Report).
//    Hand check (all groups ticked, wingwalls and approach slab off, as the 2026-11-11 audit): CR/SH kept (main) vs zeroed:
//    H_CR = Σ V_x · share = 5 × 1.5 × 0.50 = 3.75 kip at z = t_f + h_stem = 3 + 9.991 = 12.991 ft → M = 48.716 kip·ft; γ_CR = 1.0
//    Strength I V_l max 687.63 → 683.88, M_l max 4501.80 → 4453.08, M_l min −1030.62 → −1079.34; Service I V_l 474.32 → 470.57,
//    M_l max 2481.52 → 2432.80; P unchanged (2540.43 / 1431.84).
// 2. Negative skew (−15°): the geometry group is available (it was blocked by the 0–60° range), skew = |θ| = 15 with the sign
//    note; the BR / TU ticks equal the positive-skew dialog; every result equals the positive-skew pull.
// 3. Calculator-only geometry (e, d_sh, wingwalls) listed as kept; approach slab / elevations / earth texts; CR/SH generator on →
//    the zero group is not ticked by default; no console errors; 390 px: no page scroll, the new note rows wrap.
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const near = (a, b, tol = 0.006) => Math.abs(a - b) <= tol;
const PAY = JSON.parse(fs.readFileSync(path.join(path.dirname(new URL(import.meta.url).pathname), 'abutment-subloads-pull.payload.json'), 'utf8'));
const FILE = path.join(REPO, 'abutment_calculator.html');
const lsOf = p => ({ 'bridgeSuite.v1.abutmentLoads': JSON.stringify(p), 'bridgeSuite.v1.abutmentLoads.updatedAt': p.producedAt });

// in the page: open the dialog (optional setup first), optionally tick every group / set ticks, read it, apply, envelope
const RUN = async ([setup, mode, ticks]) => {
  if (setup) { eval('(' + setup + ')')(); migrate(); buildInputs(); recalcAll(); }
  document.getElementById('axh-pull').click();
  const dlg = () => document.getElementById('axh-dlg');
  const tick = (g, on) => { const c = dlg().querySelector(`input[data-axh-g="${g}"]`); if (c && !c.disabled && c.checked !== on) { c.checked = on; c.dispatchEvent(new Event('change', { bubbles: true })); } };
  const groups0 = Object.fromEntries([...dlg().querySelectorAll('input[data-axh-g]')].map(c => [c.getAttribute('data-axh-g'), { on: c.checked, dis: c.disabled }]));
  const text0 = dlg().innerText;
  if (mode === 'all') for (let it = 0; it < 30; it++) { const c = [...dlg().querySelectorAll('input[data-axh-g]')].find(c => !c.checked && !c.disabled); if (!c) break; tick(c.getAttribute('data-axh-g'), true); }
  Object.entries(ticks || {}).forEach(([g, on]) => tick(g, on));
  // the page itself never scrolls sideways; the dialog's own overlay scrolls (pre-existing: the long <select> options of the Choices table)
  const ov = document.getElementById('axh-ov'), notes = [...dlg().querySelectorAll('td.axh-note')], fit = document.documentElement.scrollWidth <= window.innerWidth + 1
    && notes.every(td => td.scrollWidth <= td.clientWidth + 1);
  const text = dlg().innerText;
  document.getElementById('axh-apply').click();
  const env = {};
  if (mode === 'all') { S.wing.on = false; if (S.apSlab) S.apSlab.on = false; recalcAll();
    const R = window.LAST_R, B = R.geo.B;
    ['Strength I', 'Service I'].forEach(n => { const a = []; for (const pm of R.permutations(n, true)) for (const x of [false, true]) { const e = R.comboEffects(n, pm.perm, pm.liveOn, x); a.push({ P: e.V, Ml: e.V * B / 2 - e.Mv + e.Mh, Vl: e.Hx }); }
      env[n] = Object.fromEntries(['P', 'Ml', 'Vl'].map(q => [q, [Math.max(...a.map(e => e[q])), Math.min(...a.map(e => e[q]))]])); });
    env.CR = { Hx: R.groups.CRSH.Hx, Mh: R.groups.CRSH.Mh }; env.z = R.geo.zSeat; }
  let rpt = ''; try { abrShow(); const d = document.createElement('div'); d.innerHTML = SharedReport.html(ABRP.doc, { lazy: false }); rpt = d.textContent; } catch (e) { rpt = 'ERR ' + e.message; }
  return { groups0, text0, text, fit, env, rx: S.rx.CRSH.map(x => x.Vx), shCR: S.dist.shCR, model: S.dist.model, gen: S.longit.computeCRSH, skew: S.geom.skew,
    geom: JSON.parse(JSON.stringify(S.geom)), src: JSON.parse(JSON.stringify(S.subloadsSrc || null)), card: (document.getElementById('axh-src') || {}).textContent || '', rpt };
};
async function run(pay, mode, { setup, ticks, vw = 1400 } = {}) {
  const o = await openPage(FILE, { ls: lsOf(pay), vw, vh: 900 });
  await o.p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
  const r = await o.p.evaluate(RUN, [setup ? setup.toString() : null, mode, ticks || null]);
  r.errs = o.errs; await o.b.close(); return r;
}

console.log('1. positive skew (SubLoads default payload)');
const pos = await run(PAY, 'def');
check(pos.groups0.crsh.on && !pos.groups0.crsh.dis, 'CR/SH group available and ticked by default (SubLoads sent no SH, own generator off)');
check(/CR\/SH: set to 0 \(SubLoads sent no CR\/SH case\)/.test(pos.text0), 'CR/SH group label says it is set to 0');
check(/SubLoads sent no creep\/shrinkage \(SH\) case for this abutment: the calculator's CR\/SH row is set to 0/.test(pos.text0), 'review row: SubLoads sent none');
check(!pos.groups0.br.on && !pos.groups0.tu.on && !pos.groups0.br.dis && !pos.groups0.tu.dis, 'BR / TU available, unticked by default (§4.5)');
check(!pos.groups0.geom.dis && pos.skew === 15, 'geometry imported, skew 15');
check(pos.rx.every(v => v === 0) && pos.shCR === 50 && pos.gen === false, 'CR/SH row 0 for every girder; share (50 %) and generator unchanged');
check(pos.src && (pos.src.notes || []).some(n => /CR\/SH row set to 0/.test(n)), 'S.subloadsSrc.notes records the CR/SH zero');
check(/CR\/SH row set to 0/.test(pos.card) && /CR\/SH row set to 0 \(SubLoads sent no creep\/shrinkage case\)/.test(pos.rpt), 'Hand-offs card and Report show it');
check(/wingwalls on \(panel I-13\)/.test(pos.text0), 'kept calculator-only geometry listed (wingwalls on)');
check(!/no approach slab load|uses heights, not elevations/.test(pos.text0), 'no stale approach slab / elevation texts');
check(/the calculator computes its own approach slab loads from its panel I-0b/.test(pos.text0) && /Of the SubLoads elevations only top of backwall − top of footing \(soil height\) and ground − bottom of footing \(D_f\) are used/.test(pos.text0)
  && /calculator computes EH, EV, LS, ES and water from its own soil, backfill and water inputs/.test(pos.text0), 'approach slab / elevation / earth rows say what is applied');
check(pos.errs.length === 0, 'no console errors' + (pos.errs.length ? ': ' + pos.errs.join(' | ') : ''));

console.log('1b. hand check: every group ticked, wingwalls and approach slab off (the audit case)');
const allZ = await run(PAY, 'all'), allK = await run(PAY, 'all', { ticks: { crsh: false } });
const e1 = allZ.env, e0 = allK.env;
check(near(e0.CR.Hx, 3.75, 1e-9) && near(e0.CR.Mh, 3.75 * 12.991, 1e-6) && near(e0.z, 12.991, 1e-9), `CR/SH kept: H = 5·1.5·0.50 = 3.75 kip, M = 3.75·12.991 = 48.716 (${e0.CR.Hx}, ${e0.CR.Mh})`);
check(e1.CR.Hx === 0 && e1.CR.Mh === 0, 'CR/SH zeroed: H = M = 0');
const pin = (e, n, q, i, v) => check(near(e[n][q][i], v), `${n} ${q} ${i ? 'min' : 'max'} = ${e[n][q][i].toFixed(2)} (pinned ${v})`);
pin(e0, 'Strength I', 'Vl', 0, 687.63); pin(e1, 'Strength I', 'Vl', 0, 683.88);
pin(e0, 'Strength I', 'Ml', 0, 4501.80); pin(e1, 'Strength I', 'Ml', 0, 4453.08);
pin(e0, 'Strength I', 'Ml', 1, -1030.62); pin(e1, 'Strength I', 'Ml', 1, -1079.34);
pin(e0, 'Service I', 'Vl', 0, 474.32); pin(e1, 'Service I', 'Vl', 0, 470.57);
pin(e0, 'Service I', 'Ml', 0, 2481.52); pin(e1, 'Service I', 'Ml', 0, 2432.80);
pin(e1, 'Strength I', 'P', 0, 2540.43); pin(e1, 'Strength I', 'P', 1, 1431.84);
check(near(e0['Strength I'].Vl[0] - e1['Strength I'].Vl[0], 3.75, 1e-9) && near(e0['Strength I'].Ml[0] - e1['Strength I'].Ml[0], 48.71625, 1e-6), 'difference = γ_CR (1.0) × (3.75 kip, 48.716 kip·ft)');
check(allZ.errs.length + allK.errs.length === 0, 'no console errors');

console.log('2. negative skew (−15°)');
const NEG = JSON.parse(JSON.stringify(PAY)); NEG.abutments.forEach(a => { a.skewDeg = -Math.abs(a.skewDeg); }); NEG.bridge.skews = NEG.bridge.skews.map(v => -Math.abs(v));
const neg = await run(NEG, 'def');
check(!neg.groups0.geom.dis && neg.groups0.geom.on, 'geometry group available and ticked (no 0–60° range error)');
check(['br', 'tu', 'crsh', 'layout', 'dc', 'brg'].every(g => JSON.stringify(neg.groups0[g]) === JSON.stringify(pos.groups0[g])), 'BR / TU (and other) ticks equal the positive-skew dialog');
check(/Sign: SubLoads sent θ = -15° \(signed, as entered there\); the calculator's skew is a magnitude \(0–60°\), so \|θ\| = 15° is imported\./.test(neg.text0), 'review row shows the sign conversion');
check(neg.skew === 15 && JSON.stringify(neg.geom) === JSON.stringify(pos.geom), 'skew = |θ| = 15; geometry identical to the positive pull');
check((neg.src.notes || []).some(n => /skew \|θ\| = 15° \(SubLoads sent -15°/.test(n)) && /skew \|θ\| = 15°/.test(neg.rpt), 'source notes and Report record the conversion');
const negAll = await run(NEG, 'all');
check(JSON.stringify(negAll.env) === JSON.stringify(allZ.env), 'every envelope result equals the positive-skew pull');
check(neg.errs.length + negAll.errs.length === 0, 'no console errors');

console.log('3. kept geometry, approach slab sent, own CR/SH generator on, 390 px');
const kept = await run(Object.assign({}, PAY, { abutments: PAY.abutments.map(a => Object.assign({}, a, { loadCases: Object.assign({}, a.loadCases, { approachSlab: { DC: 40, LL: 0, widthFt: 44.5, lengthFt: 20, thicknessIn: 12, shareOnAbutment: 50 } }) })) }), null,
  { setup: () => { S.apSlab.on = true; S.geom.bwOff = 10; S.geom.shD = 9; S.longit.computeCRSH = true; }, vw: 390 });
check(/Kept as they are \(calculator-only geometry, not sent by SubLoads; check them against the SubLoads abutment\): backwall offset e = 10 in \(panel I-1\); stem-shelf depth d_sh = 9 in \(panel I-1\); wingwalls on \(panel I-13\)\./.test(kept.text0), 'e, d_sh and wingwalls listed as kept');
check(/Approach slab \(reaction, width, length, thickness, share\)\s+NOT imported: the calculator computes its own approach slab loads from its panel I-0b \(Tab 1 §1.4a\), which this pull does not change — on in the calculator now/.test(kept.text0), 'approach slab sent: NOT imported, calculator\'s own slab (on)');
check(!kept.groups0.crsh.on && !kept.groups0.crsh.dis, 'own CR/SH generator on: the zero group is offered but not ticked');
check(kept.fit, '390 px: no horizontal page scroll; the new note rows wrap');
check(kept.errs.length === 0, 'no console errors');

console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
