#!/usr/bin/env node
// Browser smoke test of SBSW (2026-11-19, show the work of A2): apps/steel-bridge/index.html with the built-in project, headless Chromium
// (tests/lib.mjs openPage):
//   1. Loads & LLDF tab: the table "DC1 with each plate segment's top flange" for the selected girder line (b_f 16 and 18 in), its
//      DC1 link for 18 in opens the worked step dl.G<i>.DC1.b1 (haunch, SIP, DC1 with b_f = 18 in);
//   2. Report: the Loads section has the per-width table; 0 console errors, 0 .katex-error; at 390 px no horizontal page scroll.
//   node tests/smoke/steel-bridge-loads-segdc1.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED } from './sbd-seed.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), allErrs = [];
for (const vw of [1400, 390]) {
  const { b, p, errs } = await openPage(FILE, { vw, vh: 1000, ls: { ...SBD_SEED } });
  try {
    await p.waitForSelector('#tabBar [data-otab="loads"]');
    await p.click('#tabBar [data-otab="loads"]'); await p.waitForSelector('#out #ld-segdc1', { timeout: 120000 });
    // select the interior line G2 (the analysis's line of the interior girder type)
    await p.selectOption('#o_lg', '1'); await p.waitForSelector('#out #ld-segdc1');
    const t = await p.evaluate(() => document.getElementById('ld-segdc1').nextElementSibling.innerText);
    assert.match(t, /16\.00/); assert.match(t, /18\.00/); assert.match(t, /88\.00–128\.00, 232\.00–272\.00/);
    await p.click('#out a.wk[href="#st-dl.G2.DC1.b1"]'); await p.waitForTimeout(300);
    const st = await p.evaluate(() => { const e = document.getElementById('st-dl.G2.DC1.b1'); return e ? { vis: !!e.offsetParent, txt: e.innerText } : null; });
    assert.ok(st && st.vis, 'the worked DC1 step for b_f = 18 in is shown'); assert.match(st.txt, /b_f = 18\.00 in|18\.00 in/);
    assert.equal(await p.evaluate(() => document.querySelectorAll('#out .katex-error').length), 0, 'katex errors (Loads)');
    if (vw === 390) assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'no horizontal page scroll at 390 px');
    if (vw === 1400) {
      await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-tbl', { timeout: 600000 });
      const rpt = await p.evaluate(() => document.querySelector('.rp-doc').textContent);
      assert.match(rpt, /Haunch and SIP forms with each plate segment's top flange/); assert.match(rpt, /232\.00–272\.00/);
      assert.equal(await p.evaluate(() => document.querySelectorAll('.rp-doc .katex-error').length), 0, 'katex errors (Report)');
    }
    allErrs.push(...errs);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log('ok steel-bridge-loads-segdc1');
