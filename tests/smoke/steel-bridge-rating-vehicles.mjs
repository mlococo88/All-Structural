#!/usr/bin/env node
// Browser smoke test of the Steel Bridge legal-load and permit rating (apps/steel-bridge: ui/rating.js vehicle card and results, the Summary
// column "RF L/P", the Report's rating section), headless Chromium with KaTeX from tests/libs:
//   1. the built-in one-girder project, nothing ticked: Rating calculates as before (no vehicle results, the "not rated" sentence is gone), the
//      Summary has no legal / permit column;
//   2. tick Type 3 and SU4 and choose the CT-TLC permit vehicle: saved in the project (rating.veh); Calculate: the results table (3 vehicles), a click
//      on a rating factor shows that vehicle's rows, graph and worked steps (the vehicle's live-load step, γ_LL, RF, rated load), 0 KaTeX errors;
//   3. Summary: the column appears, its value is the lowest vehicle RF, its link opens the Rating tab on that vehicle's governing row;
//   4. Report: the rating section lists the vehicles and works each governing RF (0 KaTeX errors, 0 unresolved § references);
//   5. 390 px: the Rating tab with vehicles has no horizontal page scroll.
//   0 console errors.   node tests/smoke/steel-bridge-rating-vehicles.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED, SBD_DEFAULT } from './sbd-seed.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), allErrs = [];
const upToDate = p => p.waitForFunction(() => /Up to date/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 600000 });
const calc = async p => { await p.click('#tabBar [data-otab="rt"]'); await p.waitForSelector('#rt-veh'); if (await p.locator('#rt_calc').isVisible()) await p.click('#rt_calc'); await p.waitForFunction(() => { const a = document.querySelector('#out .alert.stale'); return a && a.hidden && document.querySelector('#out .rt-box'); }, null, { timeout: 600000 }); };

{
  const { b, p, errs } = await openPage(FILE, { ls: { ...SBD_SEED }, vw: 1400, vh: 1000, dsf: SHOTS ? 2 : 1 });
  try {
    // 1. nothing ticked
    await calc(p);
    const a = await p.evaluate(() => ({ res: !!document.querySelector('#rt-vehres'), txt: document.querySelector('#out').innerText, ticks: document.querySelectorAll('#rt-veh [data-rtveh]').length, on: document.querySelectorAll('#rt-veh [data-rtveh]:checked').length,
      veh: (JSON.parse(localStorage.getItem('sbd2.project.current')).rating || {}).veh }));
    assert.ok(!a.res && a.ticks === 12 && a.on === 0, JSON.stringify([a.res, a.ticks, a.on])); assert.ok(!/not rated\./.test(a.txt) && /Legal-load and permit rating \(MBE 6A\.4\.4, 6A\.4\.5\)/.test(a.txt)); assert.equal(a.veh, undefined, 'nothing written until a vehicle input changes');
    await p.click('#tabBar [data-otab="sum"]'); await upToDate(p);
    assert.equal(await p.locator('#sum-table a[data-sumgo$="|rtVeh"]').count(), 0, 'no legal / permit column without vehicles');
    const n0 = await p.evaluate(() => window.SBDSummaryUI.state().list.map(G => Object.keys(G.cells).length));
    // 2. tick vehicles
    await p.click('#tabBar [data-otab="rt"]'); await p.waitForSelector('#rt-veh');
    for (const k of ['Type3', 'SU4']) { await p.check(`[data-rtveh="${k}"]`); await p.waitForSelector(`[data-rtveh="${k}"]:checked`); }
    await p.selectOption('#rt_pk', 'CT-TLC'); await p.waitForSelector('#rt_pt');
    await p.waitForTimeout(600);
    if (SHOTS) await p.locator('#rt-veh').screenshot({ path: path.join(SHOTS, 'sb-legal-permit-1-selection.png') });
    const saved = await p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current')).rating.veh);
    assert.deepEqual(saved.on, ['Type3', 'SU4']); assert.equal(saved.permit.key, 'CT-TLC'); assert.equal(saved.permit.type, 'routine');
    const tc = Date.now(); await calc(p); await p.waitForSelector('#rt-vehres table');
    const r = await p.evaluate(() => { const R = [...document.querySelectorAll('#rt-vehres tbody tr')].map(tr => [...tr.cells].map(c => c.innerText.trim()));
      return { R, hl: document.querySelector('#out .rt-box .n').textContent, view: document.querySelector('#rt_view').value, txt: document.querySelector('#rt-vehres').innerText }; });
    assert.equal(r.R.length, 3); assert.deepEqual(r.R.map(q => q[0]), ['Type 3', 'SU4', 'Permit: CT-TLC']); assert.deepEqual(r.R.map(q => q[1]), ['25', '27', '139.80']); assert.deepEqual(r.R.map(q => q[3]), ['1.3375', '1.3375', '1.2250'].map(s => s.replace(/(\.\d\d)0+$/, '$1')));
    r.R.forEach(q => { assert.ok(/^\d+\.\d\d$/.test(q[9]), q.join('|')); assert.ok(Math.abs(+q[11] - +q[9] * +q[1]) <= 0.06 + 0.005 * +q[1], `RT = RF × W: ${q.join('|')}`); });
    assert.ok(/No posting for this vehicle/.test(r.R[0][12])); assert.ok(/lane-type legal load model/.test(r.txt), 'the lane-type model warning (continuous spans)'); assert.equal(r.view, '');
    if (SHOTS) await p.locator('#rt-vehres').screenshot({ path: path.join(SHOTS, 'sb-legal-permit-2-table.png') });
    await p.click('#rt-vehres tbody tr:first-child td:nth-child(10) a'); await p.waitForSelector('#rt-steps');
    await p.waitForFunction(() => /Type 3/.test(document.querySelector('#rt-steps .secHead').textContent) && document.querySelector('[data-gfxb="rating"] svg'));
    await p.evaluate(() => document.querySelectorAll('#rt-steps details').forEach(d => { if (/Live-load|Rating factors|Rated load/.test(d.querySelector('summary').textContent)) d.open = true; }));
    const s = await p.evaluate(() => ({ head: document.querySelector('#rt-steps .secHead').textContent, txt: document.querySelector('#rt-steps').innerText, kErr: document.querySelectorAll('#out .katex-error').length, view: document.querySelector('#rt_view').value,
      rows: document.querySelectorAll('#out .fx-list tbody tr').length, sub: (document.querySelector('[data-gfxb="rating"]').innerText || ''), sel: !!document.querySelector('#out .fx-list tr.sel.fx-gov') }));
    assert.equal(s.view, 'Type3'); assert.equal(s.kErr, 0); assert.ok(s.rows > 300 && s.sel, JSON.stringify([s.rows, s.sel]));
    ['Type 3: LL+IM', 'Live-load factor, Strength I', 'Legal load rating factor', 'Rated load (safe load capacity in tons)', 'Table 6A.4.4.2.3a-1'].forEach(t => assert.ok(s.txt.includes(t), `worked steps: ${t}`));
    assert.ok(/Type 3, flexure/.test(s.sub), 'the graph is the vehicle\'s');
    if (SHOTS) { await p.locator('[data-gfxb="rating"]').screenshot({ path: path.join(SHOTS, 'sb-legal-permit-3-plot.png') }); await p.evaluate(() => document.querySelector('#rt-steps').scrollIntoView({ block: 'start' })); await p.waitForTimeout(400);
      await p.screenshot({ path: path.join(SHOTS, 'sb-legal-permit-4-worked.png'), fullPage: false }); }
    // back to HL-93
    await p.selectOption('#rt_view', ''); await p.waitForFunction(() => /RF along the girder$/.test(([...document.querySelectorAll('#out .secHead')].find(h => /along the girder/.test(h.textContent)) || {}).textContent || ''));
    assert.equal(r.hl, await p.evaluate(() => document.querySelector('#out .rt-box .n').textContent));
    // 3. Summary
    await p.click('#tabBar [data-otab="sum"]'); await upToDate(p);
    const sm = await p.evaluate(() => { const st = window.SBDSummaryUI.state(), a = document.querySelector('#sum-table a[data-sumgo$="|rtVeh"]'); return { v: a && a.textContent, cls: a && a.closest('td').className, cell: st.list[0].cells.rtVeh, n: st.list.map(G => Object.keys(G.cells).length), head: document.querySelector('#sum-table thead').innerText }; });
    assert.ok(sm.cell && /RF L\/P/.test(sm.head)); assert.deepEqual(sm.n, n0.map(x => x + 1));
    const low = Math.min(...r.R.map(q => +q[9])); assert.equal(sm.v, low.toFixed(2)); assert.ok(sm.cls.includes(low < 1 ? 's-fail' : 's-pass'), sm.cls);
    await p.click('#sum-table a[data-sumgo$="|rtVeh"]'); await p.waitForFunction(() => /CT-TLC/.test((document.querySelector('#rt-steps .secHead') || {}).textContent || ''), null, { timeout: 600000 });
    // 4. Report
    await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 600000 });
    const rp = await p.evaluate(() => ({ kErr: document.querySelectorAll('.rp-doc .katex-error').length, bad: document.querySelectorAll('.rp-doc .rp-bad').length, text: document.querySelector('.rp-doc').textContent }));
    assert.equal(rp.kErr, 0); assert.equal(rp.bad, 0); ['Legal-load and permit rating (3 vehicles)', 'Type 3: x =', 'Permit: CT-TLC: x =', 'Rated load (safe load capacity in tons)', 'Load rating (LRFR: design, legal and permit loads)'].forEach(t => assert.ok(rp.text.includes(t), `report: ${t}`));
    assert.ok(!/NaN|undefined|\[object/.test(rp.text.replace(/<annotation[^]*?<\/annotation>/g, '')), 'NaN / undefined in the report');
    console.log(`ok   1400 px: rating ${r.R.map(q => `${q[0]} RF ${q[9]}`).join(', ')} (Calculate ${Date.now() - tc} ms); Summary RF L/P ${sm.v}; report section built`);
  } finally { allErrs.push(...errs); await b.close(); }
}
{
  // 5. phone width, the vehicles saved in the project
  const P = JSON.parse(JSON.stringify(SBD_DEFAULT)); P.rating = { phiC: 1, phiS: 1, veh: { on: ['Type3', 'EV3'], imL: '', imP: '', evG: 'legal', permit: { key: 'custom', type: 'trip-mixed', gam: '', name: 'Crane', axles: '20, 20@5, 30@20, 30@5, 30@5' } } };
  const { b, p, errs } = await openPage(FILE, { ls: { 'sbd2.project.current': JSON.stringify(P) }, vw: 390, vh: 844, dsf: SHOTS ? 2 : 1 });
  try {
    await calc(p); await p.waitForSelector('#rt-vehres table');
    const m = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, rows: [...document.querySelectorAll('#rt-vehres tbody tr')].map(tr => tr.cells[0].innerText.trim()), warn: /not been verified/.test(document.querySelector('#rt-vehres').innerText), df: document.querySelector('#rt-vehres tbody tr:last-child').cells[4].innerText }));
    assert.ok(m.sw <= m.iw + 1, `horizontal page scroll at 390 px: ${m.sw} > ${m.iw}`); assert.deepEqual(m.rows, ['Type 3', 'EV3', 'Permit: Crane']); assert.ok(!m.warn, 'no unverified warning: the special-permit factors were read against the MBE 4th Ed. text'); assert.equal(m.df, 'one lane, no m (Service II: design)');
    await p.click('#rt-vehres tbody tr:last-child td:nth-child(10) a'); await p.waitForFunction(() => /Crane/.test((document.querySelector('#rt-steps .secHead') || {}).textContent || ''));
    const m2 = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, kErr: document.querySelectorAll('#out .katex-error').length })); assert.ok(m2.sw <= m2.iw + 1 && m2.kErr === 0, JSON.stringify(m2));
    if (SHOTS) { await p.locator('#rt-vehres').scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, 'sb-legal-permit-5-390px.png') }); }
    console.log('ok   390 px: no horizontal page scroll; entered axle train rated as a special permit (one lane, no m; Service II with the design factor)');
  } finally { allErrs.push(...errs); await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log(`all passed (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
