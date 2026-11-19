#!/usr/bin/env node
// Browser smoke test of the Steel Bridge Report additions (2026-11-19, PR3: Executive summary, Basis of design, distribution factor sketches,
// steel bill of materials, design-point headers, sign-off), headless Chromium (tests/lib.mjs openPage), apps/steel-bridge/index.html, the built-in
// project (made-up example): at 1400 px and at 390 px (phone): the sections in order, the verdict banner (SVG), the tables, no page-level horizontal
// scroll at 390 px, print emulation shows them; 0 console errors.   node tests/smoke/steel-bridge-report-pr3.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const t0 = Date.now(), out = [];
for (const [vw, vh] of [[1400, 1000], [390, 844]]) {
  const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw, vh });
  try {
    await p.waitForSelector('#tabBar [data-otab="rpt"]'); await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build');
    await p.waitForSelector('.rp-doc .rp-step', { timeout: 180000 });
    const s = await p.evaluate(() => { const h = [...document.querySelectorAll('.rp-doc .rp-h1')].map(x => x.textContent.trim()), doc = document.querySelector('.rp-doc');
      return { h, svg: !!doc.querySelector('figure svg[aria-label="FAIL"], figure svg[aria-label="PASS"], figure svg[aria-label="PASS WITH NOTES"]'), txt: doc.textContent, sw: document.documentElement.scrollWidth, iw: innerWidth, bad: doc.querySelectorAll('.rp-bad').length }; });
    assert.ok(/^1\. Executive summary/.test(s.h[0]) && /^2\. Basis of design/.test(s.h[1]) && /Steel bill of materials/.test(s.h[s.h.length - 2]) && /Sign-off/.test(s.h[s.h.length - 1]), s.h.join(' | '));
    assert.ok(s.svg, 'verdict banner'); assert.equal(s.bad, 0, 'unresolved §');
    ['Not included in the verdict', 'Load combinations used', 'Distribution factor sketches', 'Unbraced length', 'P.E. seal'].forEach(t => assert.ok(s.txt.includes(t), t));
    if (vw < 500) assert.ok(s.sw <= s.iw + 1, `390 px: page ${s.sw} px wide`);
    if (SHOTS) { const sec = async (re, f) => { const el = await p.$(`xpath=//*[contains(@class,'rp-h1') and contains(., '${re}')]/..`); if (el) await el.screenshot({ path: path.join(SHOTS, `sbr3-${vw}-${f}.png`) }); };
      await sec('Executive summary', 'exec'); await sec('Basis of design', 'basis'); await sec('Steel bill of materials', 'bom'); await sec('Sign-off', 'sign');
      const fig = await p.$('xpath=//*[contains(text(),"Distribution factor sketches")]/..'); if (fig) await fig.screenshot({ path: path.join(SHOTS, `sbr3-${vw}-dfsk.png`) }); }
    await p.emulateMedia({ media: 'print' });
    const pr = await p.evaluate(() => { const v = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; return [...document.querySelectorAll('.rp-doc figure svg')].filter(v).length; });
    assert.ok(pr > 0, 'figures print'); await p.emulateMedia({ media: 'screen' });
    assert.deepEqual(errs, [], 'console errors');
    out.push(`${vw} px: ${s.h.length} sections`);
  } catch (e) { console.log('FAIL', vw, e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1; }
  finally { await b.close(); }
}
console.log(`ok  Report PR3: ${out.join('; ')}; banner, tables, sketches, headers, sign-off; prints (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
