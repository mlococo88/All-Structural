#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html): the Report tab's review tools (shared/report-review.js, 2026-11-23; the Steel Bridge app's tools of
// PR #1646, now one shared copy): contents sidebar (sections only / all, hide / show, drag to resize, kept per viewer), markup mode (a comment
// on a step and on a text selection; HTML in a comment stays text; a marker at the item; resolve / reopen; kept in localStorage
// psb2.reportReview.v1 for the project after a reload), "Save reviewed copy" (one HTML file with the comments numbered and an appendix), print
// (the markup UI hidden; the comments appendix when chosen). 1400 px and 390 px. A new project (made-up example). Only psb2.* keys are
// written (none of the steel app's sbd2.* keys); the project text is unchanged. 0 console errors.
//   node tests/smoke/ps-bridge-report-review.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null; if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const t0 = Date.now(), out = [], EVIL = '<img src=x onerror="window.__x=1">bad & "quoted"';
const build = async p => { await p.waitForSelector('#tabBar [data-otab="rpt"]'); await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 180000 }); await p.waitForTimeout(400); };
for (const [vw, vh] of [[1400, 1000], [390, 844]]) {
  const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw, vh });
  try {
    await p.waitForSelector('#tabBar [data-otab]');
    await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'Report review smoke (made up)'; P.project.number = 'EX-002'; localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
    await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400);
    const P0 = await p.evaluate(() => localStorage.getItem('psb2.project.current'));
    await build(p);
    // 1. contents sidebar
    assert.ok(await p.$('.rp-toc .sbr-strip') && await p.$('.rp-body .sbr-grip'), 'strip and grip');
    await p.click('.rp-toc [data-sbr="compact"]');
    assert.equal(await p.evaluate(() => [...document.querySelectorAll('.rp-toc a.rp-l2')].filter(a => a.offsetParent !== null).length), 0, 'sections only');
    await p.click('.rp-toc [data-sbr="compact"]');
    assert.ok(await p.evaluate(() => [...document.querySelectorAll('.rp-toc a.rp-l2')].some(a => a.offsetParent !== null)), 'all entries');
    if (vw > 1000) { const w0 = await p.evaluate(() => document.querySelector('.rp-toc').offsetWidth), g = await p.$('.sbr-grip'), bb = await g.boundingBox();
      await p.mouse.move(bb.x + 3, bb.y + 40); await p.mouse.down(); await p.mouse.move(bb.x + 103, bb.y + 40, { steps: 5 }); await p.mouse.up();
      const w1 = await p.evaluate(() => document.querySelector('.rp-toc').offsetWidth); assert.ok(w1 > w0 + 60, `resize ${w0} -> ${w1}`); }
    await p.click('.rp-toc [data-sbr="hide"]'); assert.equal(await p.evaluate(() => getComputedStyle(document.querySelector('.rp-toc')).display), 'none'); assert.ok(await p.isVisible('[data-sbr="show"]'));
    await p.click('[data-sbr="show"]'); assert.notEqual(await p.evaluate(() => getComputedStyle(document.querySelector('.rp-toc')).display), 'none');
    assert.ok(await p.evaluate(() => !!localStorage.getItem('psb2.reportToc')), 'sidebar kept');
    // 2. markup: a comment on a step (HTML stays text)
    await p.click('[data-sbrm]'); const sid = await p.evaluate(() => { const e = [...document.querySelectorAll('.rp-doc .rp-step[id]')].find(x => x.offsetParent !== null); return e && e.id; }); assert.ok(sid, 'a visible step'); const st = await p.$('#' + sid); await st.scrollIntoViewIfNeeded(); await st.click({ position: { x: 5, y: 5 } });
    await p.waitForSelector('.sbr-form'); await p.fill('.sbr-form .sbr-au', 'Reviewer A'); await p.fill('.sbr-form .sbr-tx', EVIL); await p.click('.sbr-form [data-sbrf="ok"]');
    const c1 = await p.evaluate(sid => ({ mk: !!document.querySelector(`#${CSS.escape(sid)} .sbr-mk`), img: document.querySelectorAll('.sbr-panel img, .rp-doc .sbr-mk img').length, x: window.__x, txt: document.querySelector('.sbr-panel').textContent,
      ls: JSON.parse(localStorage.getItem('psb2.reportReview.v1') || '{}') }), sid);
    assert.ok(c1.mk && c1.img === 0 && c1.x === undefined && c1.txt.includes('<img src=x') && c1.txt.includes('Reviewer A'), JSON.stringify(c1).slice(0, 300));
    assert.deepEqual(Object.keys(c1.ls), ['EX-002 | Report review smoke (made up)'], 'kept under the project number and name');
    const lst = Object.values(c1.ls)[0]; assert.ok(Array.isArray(lst) && lst.length === 1 && lst[0].id === sid && lst[0].status === 'open' && lst[0].text === EVIL);
    // a comment on a selection
    await p.evaluate(() => { const n = document.querySelector('.rp-doc .rp-note'), r = document.createRange(); r.selectNodeContents(n); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
    await p.click('[data-sbrc="sel"]'); await p.waitForSelector('.sbr-form'); await p.fill('.sbr-form .sbr-tx', 'Check this note'); await p.click('.sbr-form [data-sbrf="ok"]');
    assert.equal(await p.evaluate(() => document.querySelectorAll('.sbr-panel li').length), 2);
    await p.click('[data-sbrc="tog"][data-i="0"]'); assert.ok(await p.evaluate(() => document.querySelector('.sbr-panel li').classList.contains('sbr-res')), 'resolved');
    if (SHOTS) await (await p.$('.sbr-panel')).screenshot({ path: path.join(SHOTS, `ps-review-${vw}-panel.png`) });
    // 3. reviewed copy
    const [dl] = await Promise.all([p.waitForEvent('download'), p.click('[data-sbrc="save"]')]), f = await dl.path(), h = fs.readFileSync(f, 'utf8');
    assert.ok(/^<!doctype html>/.test(h) && h.includes('Review comments') && h.includes('&lt;img src=x') && !h.includes('<img src=x') && h.includes('Check this note') && h.includes('class="sbr-mk'), 'reviewed copy');
    // 4. print: the markup UI hidden; the appendix when chosen
    await p.check('[data-sbrc="print"]');
    await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; window.dispatchEvent(new Event('beforeprint')); }; });
    await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0);
    await p.emulateMedia({ media: 'print' });
    const pr = await p.evaluate(() => ({ apx: !!document.querySelector('#rp-print .sbr-apx'), ui: [...document.querySelectorAll('.sbr-panel,.sbr-strip,.sbr-grip,.sbr-bar')].some(e => getComputedStyle(e).display !== 'none') }));
    assert.ok(pr.apx && !pr.ui, JSON.stringify(pr)); await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
    if (vw < 500) assert.ok(await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '390 px: no horizontal page scroll');
    // persistence: reload, rebuild: the comments are back
    await p.reload(); await build(p); assert.equal(await p.evaluate(() => document.querySelectorAll('.sbr-panel li').length), 2, 'kept after a reload');
    const ks = await p.evaluate(() => Object.keys(localStorage)); assert.ok(ks.every(k => /^psb2\./.test(k)) && ks.includes('psb2.reportReview.v1') && ks.includes('psb2.reportToc'), 'psb2.* keys only: ' + ks.join(', '));
    assert.equal(await p.evaluate(() => localStorage.getItem('psb2.project.current')), P0, 'the project text is unchanged (comments are not in the project)');
    assert.equal(await p.evaluate(() => window.PSBReportReview.KEY + ' ' + window.PSBReportReview.TOC_KEY), 'psb2.reportReview.v1 psb2.reportToc');
    await p.evaluate(() => localStorage.removeItem('psb2.reportReview.v1'));
    assert.deepEqual(errs, [], 'console errors'); out.push(`${vw} px ok`);
  } catch (e) { console.log('FAIL', vw, e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1; }
  finally { await b.close(); }
}
console.log(`ok  PS Bridge Report review: ${out.join('; ')}; sidebar, markup (escaped), reviewed copy, print appendix, kept after reload (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
