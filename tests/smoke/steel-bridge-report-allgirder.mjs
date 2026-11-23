#!/usr/bin/env node
// Browser smoke test of the Steel Bridge Report additions of 2026-11-23 (display only): headless Chromium (tests/lib.mjs openPage),
// apps/steel-bridge/index.html, the built-in project (made-up example), at 1400 px and at 390 px (phone):
//   1. Report, selected girder: the Deflection section has a camber table and a camber diagram of each girder and the live-load deflection
//      check summary; the Steel bill of materials has the stiffeners, connection plates, splice plates, cross-frames and totals;
//   2. Report, every girder: the Executive summary is first, with the verdict banner, a row per limit state (governing girder, § link,
//      in-app link to the tab) and the items not in the verdict; the bill of materials is last; an in-app link opens its tab;
//   3. (1400 px) the banner's verdict and counts are the Summary tab's own.
// No unresolved §, no page-level horizontal scroll at 390 px, the figures print, 0 console errors.
//   node tests/smoke/steel-bridge-report-allgirder.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const t0 = Date.now(), out = [];
for (const [vw, vh] of [[1400, 1000], [390, 844]]) {
  const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw, vh });
  try {
    const subOf = t => `xpath=//*[contains(@class,'rp-h2') and contains(., '${t}')]/..`, secOf = t => `xpath=//*[contains(@class,'rp-h1') and contains(., '${t}')]/..`;
    const shot = async (sel, f) => { if (!SHOTS) return; const el = await p.$(sel); if (el) await el.screenshot({ path: path.join(SHOTS, `sbr4-${vw}-${f}.png`) }); };
    const wide = async () => { const s = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth })); if (vw < 500) assert.ok(s.sw <= s.iw + 1, `390 px: page ${s.sw} px wide`); };
    // 1. selected girder
    await p.waitForSelector('#tabBar [data-otab="rpt"]'); await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build');
    await p.waitForSelector('.rp-doc .rp-step', { timeout: 240000 });
    const s = await p.evaluate(() => { const doc = document.querySelector('.rp-doc'), nb = (doc.textContent.match(/Camber table, G\d+/g) || []).length;   // one camber table per girder line
      return { nb, txt: doc.textContent, cam: doc.querySelectorAll('figure svg[aria-label^="Camber diagram, G"]').length, bad: doc.querySelectorAll('.rp-bad').length, kErr: doc.querySelectorAll('.katex-error').length }; });
    assert.equal(s.bad, 0, 'unresolved §'); assert.equal(s.kErr, 0, 'katex errors'); assert.ok(s.nb >= 2 && s.cam === s.nb, `${s.cam} camber diagrams for ${s.nb} girders`);
    ['Camber table and diagram of each girder', 'Camber table, G1', 'Check summary, governing span', 'Stiffeners and connection plates, girder', 'Field splice plates, girder', 'Cross-frames (bridge)', 'Girder and bridge totals', 'Bridge total', 'Not included: shear studs']
      .forEach(t => assert.ok(s.txt.includes(t), t));
    assert.ok(!/NaN|undefined|\[object/.test(s.txt.slice(s.txt.indexOf('Steel bill of materials'))), 'bad text in the bill of materials');
    await wide(); await shot(subOf('Camber table and diagram of each girder'), 'camber'); await shot(secOf('Steel bill of materials'), 'bom');
    await p.emulateMedia({ media: 'print' });
    const pr = await p.evaluate(() => { const v = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0; return [...document.querySelectorAll('.rp-doc figure svg[aria-label^="Camber diagram"]')].filter(v).length; });
    assert.equal(pr, s.nb, 'the camber diagrams print'); await p.emulateMedia({ media: 'screen' });
    // 2. every girder
    await p.selectOption('#rp_scope', 'all'); await p.click('#rp_build');
    await p.waitForSelector('.rp-doc .rp-tbl', { timeout: 600000 });
    const a = await p.evaluate(() => { const doc = document.querySelector('.rp-doc'), h = [...doc.querySelectorAll('.rp-h1')].map(x => x.textContent.trim()), sv = doc.querySelector('figure svg[role="img"]'), tb = doc.querySelector('.rp-tbl');
      return { h, verdict: sv && sv.getAttribute('aria-label'), sub: sv ? sv.querySelectorAll('text')[1].textContent : '', rows: tb.querySelectorAll('tbody tr').length, see: tb.querySelectorAll('tbody a.rp-see, tbody a[href^="#"]').length,
        go: [...tb.querySelectorAll('tbody a.rp-go')].map(x => x.dataset.rpgoto), txt: doc.textContent, bad: doc.querySelectorAll('.rp-bad').length, kErr: doc.querySelectorAll('.katex-error').length }; });
    assert.match(a.h[0], /^1\. Executive summary/); assert.match(a.h[1], /Summary of every girder/); assert.match(a.h[a.h.length - 1], /Steel bill of materials/);
    assert.match(a.verdict, /^(PASS|FAIL|REVIEW)$/); assert.equal(a.rows, 14, 'one row per limit state'); assert.equal(a.bad, 0, 'unresolved §'); assert.equal(a.kErr, 0);
    assert.equal(a.go.length, 14); assert.ok(a.go.includes('flex') && a.go.includes('rt')); assert.ok(a.see >= 14, `${a.see} links in the table`);
    ['Governing D/C:', 'Not included in the verdict', 'Governing girder', 'Girder and bridge totals', 'Cross-frames (bridge)'].forEach(t => assert.ok(a.txt.includes(t), t));
    const m = /(\d+) FAIL, (\d+) REVIEW, (\d+) PASS/.exec(a.sub); assert.ok(m, a.sub);
    await wide(); await shot(secOf('Executive summary'), 'allexec'); await shot(secOf('Steel bill of materials'), 'allbom');
    // 3. the Summary tab's own verdict and counts (this project's analysis for every module: no Custom demands in the built-in project)
    if (vw > 500) {
      await p.click('.rp-doc a[data-rpgoto="sum"]'); await p.waitForFunction(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === 'sum');
      await p.waitForFunction(() => /Up to date/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 600000 });
      const v = await p.evaluate(() => ({ badge: document.querySelector('.sum-badge').textContent.trim(), cnt: document.querySelector('.sum-cnt').textContent }));
      assert.equal(a.verdict, v.badge, 'the Summary tab\'s verdict'); const c = /(\d+) FAIL\s*(\d+) REVIEW\s*(\d+) PASS/.exec(v.cnt); assert.ok(c, v.cnt);
      assert.deepEqual(m.slice(1, 4), c.slice(1, 4), `counts: report ${a.sub} | Summary tab ${v.cnt}`);
      // an in-app link of the Executive summary opens the tab that works the value
      await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-tbl a.rp-go[data-rpgoto="flex"]', { timeout: 60000 }); await p.click('.rp-doc .rp-tbl a.rp-go[data-rpgoto="flex"]');
      await p.waitForFunction(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab === 'flex', null, { timeout: 30000 });
      out.push(`1400 px: verdict ${a.verdict} (${m[0]}) = the Summary tab's`);
    } else out.push(`390 px: verdict ${a.verdict}, no page scroll`);
    assert.deepEqual(errs, [], 'console errors');
  } catch (e) { console.log('FAIL', vw, e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1; }
  finally { await b.close(); }
}
console.log(`${process.exitCode ? 'FAIL' : 'ok '} Report: every-girder executive summary, bill of materials (stiffeners, splice plates, cross-frames), camber tables and diagrams: ${out.join('; ')} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
