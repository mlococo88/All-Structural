#!/usr/bin/env node
// Browser smoke test of the factored diagrams (SBFD, 2026-11-19): apps/steel-bridge/index.html with the built-in project, headless Chromium:
//   1. Analysis tab at 1400 px: the "Factored diagrams" card after "Diagrams"; default view Strength I and Service II (M_u envelope, M_s, V_u),
//      each chart with its governing mark, the work line (KaTeX, 0 errors) and the links to the check tabs; the plotted governing M_u equals the
//      Flexure tab's (SBDFlexureUI.build) largest M_u; the views Fatigue I and Deck placement render; the factored-reactions table;
//      a link opens the Flexure tab;
//   2. Report: the Analysis section has "Factored moment and shear diagrams", its § links resolve, 0 KaTeX errors;
//   3. 390 px: the charts scale to the card, no page-level horizontal scroll.
//   0 console errors.   node tests/smoke/steel-bridge-factored.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED } from './sbd-seed.mjs';

const av = process.argv.slice(2), shots = av.includes('--shots') ? av[av.indexOf('--shots') + 1] : null;
if (shots) fs.mkdirSync(shots, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now();
const settle = (p, t = 240000) => p.waitForFunction(() => !document.querySelector('#out .alert.stale:not([hidden])') && !/Calculating|updating/.test((document.querySelector('#autoMsg') || {}).textContent || '') && !/Calculating/.test(((document.querySelector('#out') || {}).innerText || '').slice(0, 400)), null, { timeout: t });
async function openAn(p) {
  await p.waitForSelector('#tabBar [data-otab="an"]');
  await p.click('#tabBar [data-otab="an"]');
  await p.waitForFunction(() => document.querySelector('#anCalc') || document.querySelector('#an-diag'), null, { timeout: 120000 });
  if (await p.$('#out .alert.stale:not([hidden]) #anCalc')) await p.click('#anCalc');
  await settle(p);
  await p.waitForSelector('#an-fac svg', { timeout: 240000 });
}

let { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, ls: { ...SBD_SEED } });
try {
  await openAn(p);
  const r = await p.evaluate(() => {
    const ids = [...document.querySelectorAll('#out .sec')].map(s => s.id), card = document.querySelector('#an-fac');
    const P = JSON.parse(localStorage.getItem('sbd2.project.current') || 'null') || window.SBDModel.defaultProject();
    const FX = window.SBDFlexureUI.build({ P, g: 0, src: 'analysis', method: 'auto' });
    const top = Math.max(...FX.rows.map(q => (q.pos ? q.Mu : q.Mrev)));
    return { order: ids.indexOf('an-fac') === ids.indexOf('an-diag') + 1, svgs: card.querySelectorAll('svg[role="img"]').length, marks: card.querySelectorAll('circle').length,
      text: card.textContent, kErr: card.querySelectorAll('.katex-error').length, katex: card.querySelectorAll('.fd-work .katex').length,
      links: [...card.querySelectorAll('a[data-gotab]')].map(a => a.dataset.gotab), top: window.SharedUnits.fmt(top, 1), view: card.querySelector('#an_fac').value };
  });
  assert.ok(r.order, 'the factored card is right after Diagrams'); assert.equal(r.view, 'strI'); assert.equal(r.svgs, 3, 'M_u, M_s, V_u'); assert.ok(r.marks >= 4, 'governing marks');
  assert.equal(r.kErr, 0); assert.ok(r.katex >= 3, 'work lines rendered'); assert.ok(['flex', 'shear'].every(k => r.links.includes(k)), r.links.join(','));
  assert.ok(r.text.includes(`max ${r.top} at x = `), `governing M_u ${r.top} labelled`); assert.match(r.text, /Strength I max/); assert.match(r.text, /3\.4\.1-2/);
  console.log(`  1400 px: 3 charts, ${r.marks} marks, governing M_u ${r.top} kip-ft = the Flexure tab's`);
  const shot = async (sel, name) => { await p.$eval(sel, e => e.scrollIntoView({ block: 'start' })); await p.waitForTimeout(300); await p.$eval(sel, e => e.scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(shots, name), fullPage: false }); };
  if (shots) { await shot('#an-fac', 'sbf-1400-strength.png'); await shot('#an-fac figure:nth-of-type(3)', 'sbf-1400-shear.png'); }
  for (const v of ['fatI', 'cn']) {
    await p.selectOption('#an_fac', v); await p.waitForFunction(v => document.querySelector('#an_fac') && document.querySelector('#an_fac').value === v, v);
    const q = await p.evaluate(() => { const c = document.querySelector('#an-fac'); return { svgs: c.querySelectorAll('svg[role="img"]').length, kErr: c.querySelectorAll('.katex-error').length, t: c.innerText }; });
    assert.equal(q.svgs, 2, v); assert.equal(q.kErr, 0); assert.ok(!/NaN|undefined/.test(q.t), v);
    if (shots) await shot('#an-fac', `sbf-1400-${v}.png`);
  }
  await p.selectOption('#an_fac', 'strI');
  await p.click('#an-fac a[data-gotab="flex"]'); await settle(p);
  assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), 'flex');
  // 2. Report
  await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-h1', { timeout: 300000 });
  const rp = await p.evaluate(() => { const h = [...document.querySelectorAll('.rp-doc .rp-h2')].find(x => /Factored moment and shear diagrams/.test(x.textContent));
    const doc = document.querySelector('.rp-doc'); return { h: !!h, kErr: doc.querySelectorAll('.katex-error').length, bad: /§\?/.test(doc.innerText) }; });
  assert.ok(rp.h, 'report subsection'); assert.equal(rp.kErr, 0); assert.ok(!rp.bad, 'unresolved § reference');
  if (shots) { for (let k = 0; k < 3; k++) { await p.evaluate(() => { const h = [...document.querySelectorAll('.rp-doc .rp-h2')].find(x => /Factored moment and shear diagrams/.test(x.textContent)); h.scrollIntoView({ block: 'start' }); }); await p.waitForTimeout(500); }
    await p.screenshot({ path: path.join(shots, 'sbf-1400-report.png'), fullPage: false }); }
  assert.deepEqual(errs, [], 'console errors');
} finally { await b.close(); }

// 3. phone layout: 390 px
({ b, p, errs } = await openPage(FILE, { vw: 390, vh: 844, ls: { ...SBD_SEED } }));
try {
  await openAn(p);
  const m = await p.evaluate(() => { const se = document.scrollingElement; window.scrollTo(400, 0); const c = document.querySelector('#an-fac'), cr = c.getBoundingClientRect();
    return { sw: se.scrollWidth, cw: se.clientWidth, x: window.scrollX, wide: [...c.querySelectorAll('svg[role="img"]')].filter(s => s.getBoundingClientRect().right > cr.right + 1).length, right: cr.right, vw: window.innerWidth,
      kErr: c.querySelectorAll('.katex-error').length }; });
  assert.ok(m.sw <= m.cw && m.x === 0, `page scrolls sideways at 390 px: ${JSON.stringify(m)}`); assert.equal(m.wide, 0, 'a chart wider than its card'); assert.ok(m.right <= m.vw + 1, 'card wider than the screen'); assert.equal(m.kErr, 0);
  if (shots) { await p.$eval('#an-fac', e => e.scrollIntoView()); await p.screenshot({ path: path.join(shots, 'sbf-390.png'), fullPage: false }); }
  assert.deepEqual(errs, [], 'console errors (390 px)');
} finally { await b.close(); }
console.log(`steel-bridge-factored: OK (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
