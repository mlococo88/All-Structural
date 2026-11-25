#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), UT-N (2026-11-23): the Steel Bridge app's two noncomposite utility categories in the page: "Utility
// (noncomposite, DW factors)" (stored 'UTN') and "Future utility allowance (noncomposite, γ 1.25/0)" (stored 'UF'). Headless Chromium,
// file://, the CDN libraries from tests/libs. A made-up bridge: a new project (5 BT-72 at 9 ft, one 120 ft span).
//   1. Cross-section tab: "Add line load" (a real click), the category select offers the three utility categories (the composite one keeps
//      its stored code 'UT'); a UT row 0.10 klf and a UF row 0.05 klf at x = 16.5 ft entered by real change events are saved, the per-line
//      table gets its two rows, the note explains the two categories;
//   2. Loads & LLDF tab: the card "Utilities on the noncomposite section and the future utility allowance" with the engine's values (R.ut),
//      the present / absent table, the distribution table's rows, the worked steps ld.ut.* and dl.G2.UTN / dl.G2.UF; a § opens its step;
//      M_u at midspan + 76.5 kip-ft and the Service III bottom stress on the girder section, before / after;
//   3. Analysis, Losses, Stresses, Flexure, Shear, Camber, Rating tabs: the note with the § to the Loads & LLDF step; the Strength I steps
//      show the utility's term; the camber step takes w_DC1 − w_UF;
//   4. the check summary: the chip "Future utility allowance absent" when a check has a larger ratio with the allowance absent, opening the
//      Loads & LLDF step; the Report's loads section has the card and the steps; the keys written are psb2.* only; 0 console errors.
//   SHOT=<dir> saves the input card, the Loads & LLDF card and its worked steps.
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
const shot = async (sel, name) => { if (!SHOT) return; const el = await p.$(sel); if (el) await el.screenshot({ path: path.join(SHOT, name) }); };
const set = async (pth, v, sel) => { const q = `[data-path="${pth}"]`; if (sel) await p.selectOption(q, v); else { await p.fill(q, String(v)); await p.dispatchEvent(q, 'change'); } await p.waitForTimeout(350); await itab('xsec'); await p.waitForSelector('#card-dl'); };
const calc = () => p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, i = PSBDesign.inputs(P), R = PSBHoldDown.compute(JSON.parse(JSON.stringify(i)));
  const m = R.grid.reduce((a, r) => Math.abs(r.x - R.L / 2) < Math.abs(a.x - R.L / 2) ? r : a);
  return { ut: i.ut || null, wNC: i.loads.wNC, Mu: R.MuMid, s3: m.s3Bot, Sb: R.g.Sb, Sbc: R.cp.Sbc, A: R.g.A, e: m.e, Pe: m.Aps * R.fpe, R: R.ut ? JSON.parse(JSON.stringify(R.ut)) : null, dDK: R.cam.dDK, wh: R.cp.wdkHaunch, L: R.L, nChecks: R.checks.length, abs: R.checks.filter(c => /^UF absent: /.test(c.n)).map(c => c.n) }; });
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Noncomposite utilities smoke (made-up bridge)'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
  // 1. the Cross-section tab
  await itab('xsec'); await p.waitForSelector('#card-dl');
  const before = await calc(); assert.equal(before.ut, null); assert.equal(before.R, null);
  assert.equal(await p.$('#utnRow'), null); assert.equal(await p.$('#ufRow'), null);
  for (let k = 0; k < 2; k++) { await p.click('[data-dlact="add"]'); await p.waitForTimeout(350); await itab('xsec'); await p.waitForSelector(`[data-path="xs.dl.extra.${k}.cat"]`); }
  const opts = await p.evaluate(() => [...document.querySelectorAll('[data-path="xs.dl.extra.0.cat"] option')].map(o => [o.value, o.textContent]));
  assert.deepEqual(opts, [['DC2', 'DC2'], ['DW', 'DW'], ['DC1', 'DC1'], ['UT', 'Utility (composite, DW)'], ['UTN', 'Utility (noncomposite, DW factors)'], ['UF', 'Future utility allowance (noncomposite, γ 1.25/0)']]);
  await set('xs.dl.extra.0.name', 'Gas main'); await set('xs.dl.extra.0.cat', 'UTN', true); await set('xs.dl.extra.0.x', 16.5); await set('xs.dl.extra.0.plf', 0.10);
  await set('xs.dl.extra.1.name', 'Future utility bay'); await set('xs.dl.extra.1.cat', 'UF', true); await set('xs.dl.extra.1.x', 16.5); await set('xs.dl.extra.1.plf', 0.05);
  const c = await p.evaluate(() => ({ extra: JSON.parse(localStorage.getItem('psb2.project.current')).xs.dl.extra, utn: [...document.querySelectorAll('#utnRow td')].map(t => t.textContent), uf: [...document.querySelectorAll('#ufRow td')].map(t => t.textContent), note: document.querySelector('#utnNote').textContent,
    err: PSBInputCheck.collect(PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project).errors.length }));
  assert.equal(c.err, 0); assert.deepEqual(c.extra.map(r => [r.name, r.cat, r.x, r.plf]), [['Gas main', 'UTN', 16.5, 0.1], ['Future utility bay', 'UF', 16.5, 0.05]]);
  assert.deepEqual(c.utn.slice(1), ['0.0200', '0.0200', '0.0200', '0.0200', '0.0200']); assert.deepEqual(c.uf.slice(1), ['0.0100', '0.0100', '0.0100', '0.0100', '0.0100']);
  assert.match(c.note, /precast girder alone/); assert.match(c.note, /present \(1\.25, Service 1\.00\) or absent \(0\)/);
  ok(`Cross-section tab: the two rows saved (cat UTN, UF); per line UT ${c.utn.slice(1).join(' ')}, UF ${c.uf.slice(1).join(' ')} klf`);
  await shot('#card-dl', 'ps-ut-inputs.png');
  if (SHOT) { const t = await p.$('[data-path="xs.dl.extra.0.cat"]'); const h = await t.evaluateHandle(e => e.closest('.tscroll')); await h.asElement().screenshot({ path: path.join(SHOT, 'ps-ut-rows.png') }); }
  // 2. Loads & LLDF
  await otab('lds'); await until(() => p.evaluate(() => !!document.querySelector('#card-ut')), 60000, 'the utilities card');
  const A = await calc(), q = A.R;
  const L = await p.evaluate(() => ({ card: document.querySelector('#card-ut').textContent, steps: ['ld.ut.wUT', 'ld.ut.wUF', 'ld.ut.wNC', 'ld.ut.MUT', 'ld.ut.VUT', 'ld.ut.MUF', 'ld.ut.VUF', 'ld.ut.gUT', 'ld.ut.dMu', 'ld.ut.dVu', 'ld.ut.MuU', 'ld.ut.fb', 'ld.ut.ft', 'ld.ut.gain', 'ld.ut.cam', 'ld.ut.abs', 'dl.G2.UTN', 'dl.G2.UF', 'dl.load.u0', 'dl.G2.u0', 'dl.G2.u1'].map(id => !!document.getElementById('st-' + id)),
    tbl: [...document.querySelectorAll('.tbl tr')].filter(tr => /utilities on the noncomposite section|future utility allowance \(in w/.test(tr.textContent)).map(tr => tr.textContent), links: [...document.querySelectorAll('#card-ut a.wk')].map(a => a.getAttribute('href')),
    abs: document.querySelector('#utAbs') ? { n: +document.querySelector('#utAbs').dataset.n, rows: document.querySelectorAll('#utAbsTbl tbody tr').length, gov: [...document.querySelectorAll('#utAbsTbl tr.utAbsGov td:first-child')].map(t => t.textContent) } : null,
    lbl: (document.getElementById('st-dl.G2.u0') || {}).textContent || '' }));
  assert.ok(Math.abs(A.ut.wUT - 0.02) < 1e-15 && Math.abs(A.ut.wUF - 0.01) < 1e-15); assert.ok(Math.abs(A.wNC - before.wNC - 0.03) < 1e-15);
  assert.ok(Math.abs(q.MUT - 36) < 1e-12 && Math.abs(q.MUF - 18) < 1e-12 && Math.abs(q.MuU - 76.5) < 1e-12 && q.gUT === 1.5);
  assert.match(L.card, /0\.0200 klf/); assert.match(L.card, /0\.0100 klf/); assert.match(L.card, /36\.0 kip-ft/); assert.match(L.card, /18\.0 kip-ft/); assert.match(L.card, /76\.5 kip-ft/); assert.match(L.card, /present or absent, whichever governs/);
  assert.deepEqual(L.steps, L.steps.map(() => true), 'steps on the tab ' + L.steps); assert.equal(L.tbl.length, 2); assert.match(L.tbl[0], /0\.0200/); assert.match(L.tbl[1], /0\.0100/);
  ['#st-dl.G2.UTN', '#st-dl.G2.UF', '#st-ld.ut.wNC', '#st-ld.ut.MuU', '#st-ld.ut.fb', '#st-ld.ut.abs', '#st-ld.ut.cam'].forEach(h => assert.ok(L.links.includes(h), h));
  assert.match(L.lbl, /Utility \(noncomposite, DW factors\)/);
  assert.ok(L.abs && L.abs.rows === before.nChecks && L.abs.n === A.abs.length, JSON.stringify(L.abs)); assert.deepEqual(L.abs.gov.map(t => 'UF absent: ' + t), A.abs);
  // HDC (2026-11-25, PR claude/ps-haunch-dc1): DC1 carries the average haunch t_h + Δ_deck/3; the added noncomposite load lowers Δ_deck and so the
  // haunch weight (Δw_h < 0): its midspan moment Δw_h L²/8 (1.25 at Strength, 1.00 at Service) is added to the expected change
  const dMh = (A.wh - before.wh) * A.L * A.L / 8; assert.ok(A.wh <= before.wh, 'the haunch weight does not grow');
  assert.ok(Math.abs((A.Mu - before.Mu) / 12 - (76.5 + 1.25 * dMh)) < 1e-6, 'M_u + 1.50 M_UT + 1.25 M_UF (+ 1.25 ΔM_h)');
  assert.ok(Math.abs((A.s3 - before.s3) - (-(54 + dMh) * 12 / A.Sb + (A.Pe - before.Pe) * (1 / A.A + A.e / A.Sb))) < 1e-9, 'Service III bottom stress on the girder section');
  ok(`Loads & LLDF: w_UT ${q.wUT.toFixed(4)}, w_UF ${q.wUF.toFixed(4)} klf; M_UT ${q.MUT.toFixed(1)}, M_UF ${q.MUF.toFixed(1)} kip-ft; ${L.steps.length} worked steps on the tab; M_u ${(before.Mu / 12).toFixed(1)} → ${(A.Mu / 12).toFixed(1)} kip-ft; Service III f_bot ${before.s3.toFixed(4)} → ${A.s3.toFixed(4)} ksi (S_b ${A.Sb.toFixed(1)} in³)`);
  ok(`present / absent table: ${L.abs.rows} checks, ${L.abs.n} with a larger ratio absent (${L.abs.gov.join('; ') || 'none'})`);
  await p.evaluate(() => { document.querySelector('#card-ut a.wk[href="#st-ld.ut.MuU"]').click(); }); await p.waitForTimeout(300);
  assert.ok(await p.evaluate(() => { const s = document.getElementById('st-ld.ut.MuU'); return !!s && s.getBoundingClientRect().height > 0; }), 'the § opens the step');
  ok('a § of the utilities card opens its worked step');
  await shot('#card-ut', 'ps-ut-loads-card.png');
  if (SHOT) { const s = await p.$('#st-ld\\.ut\\.MuU'); if (s) { const t = await s.evaluateHandle(e => e.closest('details') || e.parentElement); await t.asElement().screenshot({ path: path.join(SHOT, 'ps-ut-steps.png') }); }
    const d = await p.$('#st-dl\\.G2\\.UTN'); if (d) { const t = await d.evaluateHandle(e => e.closest('details') || e.parentElement); await t.asElement().screenshot({ path: path.join(SHOT, 'ps-ut-dist-steps.png') }); } }
  // 3. the tabs that take DC1
  for (const t of ['an', 'loss', 'str', 'flex', 'shear', 'camb', 'rt']) { await otab(t); await until(() => p.evaluate(() => !!document.querySelector('#utTabNote')), 30000, 'note on ' + t);
    assert.equal(await p.evaluate(() => document.querySelector('#utTabNote a.wk').getAttribute('href')), '#st-ld.ut.wNC'); }
  await otab('flex'); await until(() => p.evaluate(() => !!document.getElementById('st-fx.Mu')), 30000, 'fx.Mu');
  assert.match(await p.evaluate(() => document.getElementById('st-fx.Mu').textContent), /§ld\.ut\.dMu|ld\.ut\.dMu/);
  await shot('#st-fx\\.Mu', 'ps-ut-flexure-step.png');
  await otab('shear'); await until(() => p.evaluate(() => !!document.getElementById('st-sh.Vu')), 30000, 'sh.Vu');
  assert.match(await p.evaluate(() => document.getElementById('st-sh.Vu').textContent), /ld\.ut\.dVu/);
  await otab('camb'); await until(() => p.evaluate(() => !!document.getElementById('st-cb.dDK')), 30000, 'cb.dDK');
  assert.match(await p.evaluate(() => document.getElementById('st-cb.dDK').textContent), /future utility allowance is not in the camber/);
  ok('Analysis, Losses, Stresses, Flexure, Shear, Camber and Rating tabs: the note with its §; M_u, V_u show the utility term; Δ_dk without the allowance');
  // 4. the check summary, the Report, the keys
  const chip = await p.evaluate(() => { const el = [...document.querySelectorAll('#sbDashCol .sdChip, #sbDashCol [data-sdgo]')].filter(e => /Future utility allowance absent/.test(e.textContent)); return { n: el.length, go: [...document.querySelectorAll('#sbDashCol [data-sdgo]')].map(e => e.dataset.sdgo).filter(g => /ld\.ut\.abs/.test(g)).length }; });
  if (A.abs.length) { assert.ok(chip.n >= 1, 'the chip'); assert.ok(chip.go >= 1, 'its link to the Loads & LLDF step'); } else assert.equal(chip.n, 0);
  ok(`check summary: ${A.abs.length ? 'the chip "Future utility allowance absent" (' + A.abs.length + ' checks), linked to §ld.ut.abs' : 'no chip (no check governed by the absence)'}`);
  await otab('rpt'); await until(() => p.evaluate(() => /Utilities on the noncomposite section/.test((document.querySelector('#rptHost') || {}).textContent || '')), 120000, 'the Report');
  const rp = await p.evaluate(() => { const t = document.querySelector('#rptHost').textContent; return { card: /Utilities on the noncomposite section and the future utility allowance/.test(t), w: /0\.0200/.test(t), step: /Strength I factored moment of the utilities at midspan/.test(t), dist: /utilities on the noncomposite section \(DW factors\)/.test(t), abs: /Future utility allowance absent/.test(t) }; });
  assert.deepEqual(rp, { card: true, w: true, step: true, dist: true, abs: true }, JSON.stringify(rp));
  ok('Report: the loads section has the utilities card, the shares, their worked steps and the present / absent statement');
  // a composite utility row keeps its stored code and its behaviour (DW + its share; no inputs.ut from it)
  const cu = await p.evaluate(() => { const P = PSBModel.newProject(), a = PSBDesign.inputs(P); P.xs.dl.extra = [{ name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }]; const i = PSBDesign.inputs(P); return { d: i.loads.wDW - a.loads.wDW, ut: i.ut || null, nc: i.loads.wNC - a.loads.wNC }; });
  assert.ok(Math.abs(cu.d - 0.012) < 1e-12); assert.equal(cu.ut, null); assert.equal(cu.nc, 0);
  ok('a composite utility row (stored UT): w_DW + 0.0120 klf, w_NC unchanged, no inputs.ut');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => k.startsWith('psb2.')), 'keys ' + keys.join(', '));
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok(`keys written: psb2.* only (${keys.length}); 0 console errors`);
  console.log(`ps-bridge-ut: ${n} checks passed`);
} finally { await b.close(); }
