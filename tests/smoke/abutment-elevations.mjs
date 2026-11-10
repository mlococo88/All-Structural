#!/usr/bin/env node
// Abutment calculator (abutment_calculator.html): elevations from the beam seat elevation (ABEL, 2026-11-10). Display only.
//   1. Hand check: seat El. 52.00 with the built-in geometry (conventional, approach slab on a shelf, water behind and in front, passive
//      embedment D_f), the integral abutment, and a semi-integral one: every derived elevation equals the hand value (Tab 1 §1.1a card,
//      the panel I-1 line, the §1.1 section labels, the Drawings sheets "EL." marks, the 3D labels, the Report).
//   2. Conflicts are flagged (water above the top of the backwall, front grade above the seat, a Pile Designer tip El. not below the footing).
//   3. The calculation does not depend on the seat elevation: LAST_R and the Input ID are identical with the field blank and set.
//   4. Field blank: no card, no labels, no "EL." text, and (with a main worktree given) Tab 1, the section, the DXF and the Report
//      are identical to main; a saved project without the field opens with it blank.
//   5. 0 console errors; no horizontal scroll at 390 px with the card shown.
//   node tests/smoke/abutment-elevations.mjs [<main worktree root, for the blank-field comparison with main>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const MAIN = process.argv[2] || null;
let SAVED = null;   // a project as saved before the field (no geom.elSeat), opened in section 5
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
const near = (a, b) => typeof a === 'number' && Math.abs(a - b) < 0.005;
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const withCase = (p, setup, probe) => p.evaluate(([su, pr]) => { const st = JSON.parse(JSON.stringify(S));
  try { eval('(' + su + ')')(); if (typeof migrate === 'function') migrate(); buildInputs(); recalcAll(); return eval('(' + pr + ')')(); }
  catch (e) { return { err: String(e && e.stack || e) }; }
  finally { Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); buildInputs(); recalcAll(); } }, [setup.toString(), probe.toString()]);
const probe = () => { const E = abElev(window.LAST_R); renderTabContent('tab-loads'); const B = abdwBuild(window.LAST_R), dxf = B.D.toDXF({ ltscale: 1 });
  build3D(window.LAST_R); const l3 = []; if (typeof D3 !== 'undefined' && D3.group) D3.group.children.forEach(c => { if (c.userData && c.userData.abEl) l3.push(c.userData.abEl); });
  return { rows: E ? Object.fromEntries(E.rows.map(r => [r.k, r.el])) : null, flags: E ? E.flags : null, card: !!document.querySelector('#tab-loads [data-cid="o-elev"]'),
    cardRows: [...document.querySelectorAll('#abElevTbl tr[data-el]')].map(t => [t.dataset.el, t.children[1].textContent]),
    note: (document.getElementById('abElevNote') || {}).textContent || '', inLine: (document.getElementById('abElevIn') || {}).textContent || '',
    svg: [...document.querySelectorAll('#tab-loads svg text[data-el]')].map(t => t.textContent), dxfEl: (dxf.match(/[A-Z ()/]+ EL\. -?\d+\.\d\d/g) || []), l3, fp: window.LAST_R.fingerprint }; };

console.log('1. Hand check, seat El. 52.00');
{ const o = await openPage(path.join(REPO, 'abutment_calculator.html'), { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  await p.evaluate(() => activateTab('tab-3d')); await p.waitForFunction(() => typeof D3 !== 'undefined' && D3.group, null, { timeout: 30000 }); await p.evaluate(() => activateTab('tab-loads'));
  // conventional: h_bw 5, h_stem 14, t_f 3, h_soil 19; slab t 1.25 ft on a shelf h_S 15 in; h_w 6, h_w,f 2; passive on, D_f 3
  const want = { top: 57.00, apTop: 57.00, apSeat: 55.75, shBot: 54.50, seat: 52.00, tof: 38.00, bof: 35.00, fill: 57.00, front: 38.00, wt: 41.00, wtF: 37.00 };
  const c = await withCase(p, () => { S.geom.elSeat = 52; S.apSlab.on = true; S.geom.hw = 6; S.geom.hwFr = 2; S.fnd.usePassive = true; S.fnd.Df = 3; }, probe);
  if (c.err) check(false, c.err);
  else {
    const bad = Object.entries(want).filter(([k, v]) => !near(c.rows[k], v));
    check(!bad.length && Object.keys(c.rows).length === Object.keys(want).length, `conventional: ${Object.entries(c.rows).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ')}${bad.length ? ' — WRONG: ' + bad.map(b => b[0]).join(',') : ''}`);
    check(c.card && c.cardRows.length === Object.keys(want).length && c.cardRows.every(([k, t]) => near(+t, want[k])), `card §1.1a: ${c.cardRows.length} rows, values as the hand check`);
    check(/derived from the beam seat elevation El\. 52\.00/.test(c.note) && /no result depends on them/.test(c.note), `card note (§6): "${c.note.slice(0, 90)}…"`);
    check(/Top of the backwall El\. 57\.00/.test(c.inLine) && /Bottom of the footing El\. 35\.00/.test(c.inLine), `panel I-1 line: ${c.inLine}`);
    check(c.svg.includes('Top of backwall El. 57.00') && c.svg.includes('Beam seat El. 52.00') && c.svg.includes('Bottom of footing El. 35.00') && c.svg.includes('Approach slab seat El. 55.75'), `§1.1 section labels: ${c.svg.join(' | ')}`);
    const d = c.dxfEl.join(' | ');
    check(/APPROACH SLAB SEAT EL\. 55\.75/.test(d) && /BEAM SEAT EL\. 52\.00/.test(d) && /TOP OF FOOTING EL\. 38\.00/.test(d) && /BOTTOM OF FOOTING EL\. 35\.00/.test(d) && /WATER TABLE EL\. 41\.00|WATER BEHIND EL\. 41\.00/.test(d) && /TOP OF BACKWALL EL\. 57\.00/.test(d), `Drawings: ${c.dxfEl.length} EL. marks (${d.slice(0, 220)}…)`);
    check(c.l3.length >= 6, `3D view (dimensions on): ${c.l3.length} elevation labels`);
    check(!c.flags.length, `no conflicts (${JSON.stringify(c.flags)})`);
  }
  const rp = await withCase(p, () => { S.geom.elSeat = 52; S.apSlab.on = true; }, () => { activateTab('tab-rpt'); const t = document.getElementById('tab-rpt').textContent; activateTab('tab-loads');
    return { has: /Elevations — From the Beam Seat Elevation/.test(t), seat: /Approach slab seat \(top of the shelf\)55\.75/.test(t.replace(/\s+/g, ' ').replace(/\) 55/g, ')55')), note: /derived from the beam seat elevation El\. 52\.00/.test(t) }; });
  check(!rp.err && rp.has && rp.seat && rp.note, `Report: the elevations table and its note (${JSON.stringify(rp)})`);
  // integral: h_d 5, h_c 4, L_pile 30, D_front 4; slab t 1.25
  const wi = { top: 57.00, apTop: 57.00, apSeat: 55.75, shBot: 54.50, seat: 52.00, boc: 48.00, grade: 52.00, tip: 18.00 };
  const ci = await withCase(p, () => { S.geom.elSeat = 52; S.iab.type = 'integral'; S.apSlab.on = true; }, probe);
  if (ci.err) check(false, ci.err);
  else { const bad = Object.entries(wi).filter(([k, v]) => !near(ci.rows[k], v));
    check(!bad.length && Object.keys(ci.rows).length === Object.keys(wi).length, `integral: ${Object.entries(ci.rows).map(([k, v]) => k + ' ' + v.toFixed(2)).join(', ')}${bad.length ? ' — WRONG: ' + bad.map(b => b[0]).join(',') : ''}`);
    check(ci.card && ci.l3.length >= 4 && /PILE TIPS EL\. 18\.00/.test(ci.dxfEl.join(' ')) && ci.svg.includes('El. 48.00'), `integral: card, drawing tip mark, section label (${ci.svg.join(' | ')})`); }
  // semi-integral: the top of the end diaphragm
  const cs = await withCase(p, () => { S.geom.elSeat = 100.5; S.iab.type = 'semi'; }, probe);
  check(!cs.err && near(cs.rows.top, 105.5) && near(cs.rows.tof, 86.5) && near(cs.rows.bof, 83.5) && /TOP OF END DIAPHRAGM EL\. 105\.50/.test(cs.dxfEl.join(' ')), `semi-integral, seat El. 100.50: top of end diaphragm ${cs.rows && cs.rows.top}, footing ${cs.rows && cs.rows.tof} / ${cs.rows && cs.rows.bof}`);

  console.log('2. Conflicts');
  const f1 = await withCase(p, () => { S.geom.elSeat = 52; S.geom.hw = 24; }, probe);
  check(!f1.err && f1.flags.some(t => /above the top of the backwall El\. 57\.00/.test(t)), `water El. 59.00 above the top of the backwall: ${JSON.stringify(f1.flags)}`);
  const f2 = await withCase(p, () => { S.geom.elSeat = 52; S.fnd.usePassive = true; S.fnd.Df = 20; }, probe);
  check(!f2.err && f2.flags.some(t => /Finished grade in front El\. 55\.00 is above the beam seat/.test(t)), `front grade above the seat: ${JSON.stringify(f2.flags)}`);
  const f3 = await withCase(p, () => { S.geom.elSeat = 52; S.fnd.branch = 'pile'; S.pileRes = { geo: { minPen: { zMin: 20, tipElMin: 40, tipElCtrl: 30, ctrl: 25 } } }; }, () => abElev(window.LAST_R));
  check(!f3.err && f3.rows.some(r => r.k === 'tipElCtrl' && r.abs && near(r.el, 30)) && f3.flags.length === 1 && /minimum penetration.*El\. 40\.00 is not below the bottom of the footing El\. 35\.00/.test(f3.flags[0]),
    `Pile Designer tip El. (absolute, as sent) compared with the footing: ${JSON.stringify(f3.flags)}`);

  console.log('3. The calculation does not depend on the seat elevation');
  const inv = await p.evaluate(() => { const snap = () => JSON.stringify(window.LAST_R, (k, v) => typeof v === 'number' && !isFinite(v) ? String(v) : v);
    const out = []; for (const su of [() => {}, () => { S.apSlab.on = true; S.geom.hw = 6; }, () => { S.iab.type = 'integral'; S.apSlab.on = true; }, () => { S.fnd.branch = 'pile'; }]) {
      const st = JSON.parse(JSON.stringify(S)); su(); migrate(); S.geom.elSeat = null; recalcAll(); const a = snap(); S.geom.elSeat = 52; recalcAll(); const b = snap(); const fpB = window.LAST_R.fingerprint;
      S.geom.elSeat = null; recalcAll(); const fpA = window.LAST_R.fingerprint; out.push({ same: a.replace(/"fingerprint":"[^"]*"/, '') === b.replace(/"fingerprint":"[^"]*"/, ''), fpA, fpB, n: a.length });
      Object.keys(S).forEach(k => delete S[k]); Object.assign(S, st); recalcAll(); } return out; });
  inv.forEach((r, i) => check(r.same, `case ${i}: LAST_R (${r.n} chars) identical with the field blank and set (Input ID ${r.fpA} blank / ${r.fpB} set: the entered value is part of the input set)`));

  console.log('4. Field blank');
  const bl = await withCase(p, () => { S.geom.elSeat = null; S.apSlab.on = true; S.geom.hw = 6; }, probe);
  check(!bl.err && bl.rows === null && !bl.card && !bl.svg.length && !bl.dxfEl.length && !bl.l3.length, `blank: no card, no labels, no EL. text, no 3D labels`);
  SAVED = await p.evaluate(() => { const st = JSON.parse(JSON.stringify(S)); delete st.geom.elSeat; st.proj.name = 'Saved without elSeat'; return JSON.stringify(st); });
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 3).join(' | ')}`);
  await o.b.close();
}

// the blank-field outputs (Tab 1, the section, the DXF of every sheet, the Report text), for the comparison with main
async function blankOut(root, setup) {
  const o = await openPage(path.join(root, 'abutment_calculator.html'), { vw: 1400, vh: 1000 }), p = o.p; await ready(p);
  const r = await p.evaluate(su => { eval('(' + su + ')')(); migrate(); buildInputs(); recalcAll(); renderTabContent('tab-loads');
    const cl = document.getElementById('tab-loads').cloneNode(true); cl.querySelectorAll('.plot-container, .js-plotly-plot').forEach(x => x.remove());   // Plotly ids are random
    const tab1 = cl.innerHTML, dxf = abdwBuild(window.LAST_R).D.toDXF({ ltscale: 1 });
    activateTab('tab-rpt'); const rpt = (document.getElementById('tab-rpt').textContent || '').replace(/Printed [^·]*·/g, '');
    return { tab1, dxf, rpt, fp: window.LAST_R.fingerprint, elSeat: S.geom.elSeat === undefined ? 'undefined' : S.geom.elSeat }; }, setup.toString());
  const errs = o.errs.slice(); await o.b.close(); return { ...r, errs };
}
if (MAIN) {
  console.log('4b. Field blank: identical to main (' + MAIN + ')');
  for (const [nm, su] of [['built-in project', () => {}], ['slab + water + pile footing', () => { S.apSlab.on = true; S.geom.hw = 6; S.fnd.branch = 'pile'; }], ['integral + slab', () => { S.iab.type = 'integral'; S.apSlab.on = true; }]]) {
    const [a, b] = await Promise.all([blankOut(MAIN, su), blankOut(REPO, su)]);
    check(a.tab1 === b.tab1 && a.dxf === b.dxf && a.rpt === b.rpt && a.fp === b.fp && !b.errs.length,
      `${nm}: Tab 1 (${b.tab1.length} chars) ${a.tab1 === b.tab1 ? 'same' : 'DIFF'}, DXF (${b.dxf.length}) ${a.dxf === b.dxf ? 'same' : 'DIFF'}, Report (${b.rpt.length}) ${a.rpt === b.rpt ? 'same' : 'DIFF'}, Input ID ${a.fp} / ${b.fp}; errors ${b.errs.length}`);
  }
} else console.log('4b. (no main worktree given: the comparison with main is skipped)');

console.log('5. Saved project without the field; 390 px');
{ const o = await openPage(path.join(REPO, 'abutment_calculator.html'), { vw: 390, vh: 900, ls: { abutcalc_v1_autosave: SAVED } }), p = o.p; await ready(p);
  const a = await p.evaluate(() => ({ nm: S.proj.name, v: S.geom.elSeat, on: abElevOn(), card: !!document.querySelector('[data-cid="o-elev"]'), inp: (document.querySelector('input[data-path="geom.elSeat"]') || {}).value }));
  check(a.nm === 'Saved without elSeat' && !a.on && !a.card && a.inp === '', `saved project "${a.nm}" opens with the field blank (stored ${JSON.stringify(a.v)}), no card`);
  await p.fill('input[data-path="geom.elSeat"]', '52'); await p.waitForFunction(() => document.querySelector('#tab-loads [data-cid="o-elev"]'), null, { timeout: 20000 });
  await p.evaluate(() => { activateTab('tab-loads'); document.querySelector('[data-cid="o-elev"]').scrollIntoView(); });
  const b = await p.evaluate(() => ({ v: S.geom.elSeat, sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  check(b.v === 52 && b.sw <= b.cw, `typed 52: stored ${b.v}; no horizontal page scroll (${b.sw} <= ${b.cw})`);
  await p.fill('input[data-path="geom.elSeat"]', ''); await p.waitForFunction(() => !document.querySelector('#tab-loads [data-cid="o-elev"]'), null, { timeout: 20000 });
  check(await p.evaluate(() => S.geom.elSeat === null), 'cleared: stored null, card gone');
  check(!o.errs.length, `console errors: ${o.errs.length} ${o.errs.slice(0, 3).join(' | ')}`);
  await o.b.close(); }
console.log(fails ? `\n${fails} FAILED` : '\nall ok');
process.exit(fails ? 1 : 0);
