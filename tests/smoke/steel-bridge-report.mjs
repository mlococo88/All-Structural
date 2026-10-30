#!/usr/bin/env node
// Browser smoke test of the Steel Bridge Report tab (apps/steel-bridge/index.html, ui/report.js, shared/report.js), headless Chromium
// with KaTeX served from tests/libs (tests/lib.mjs openPage):
//   1. load the page, open the Report tab, build the report of the built-in project (governing detail): 0 console errors, 0 .katex-error,
//      every section and step rendered, a "see §" link jumps to its step, collapse / expand and search work;
//   2. detail "Every station": a lazy step list fills when opened;
//   3. print emulation: Print report (window.print stubbed) puts the whole report alone on the page (app hidden, nav and bar hidden,
//      every section open, every lazy list filled, a running header in @page) and page.pdf() prints it.
//   node tests/smoke/steel-bridge-report.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000 });
try {
  await p.waitForSelector('#tabBar [data-otab="rpt"]');
  await p.click('#tabBar [data-otab="rpt"]');
  await p.click('#rp_build');
  await p.waitForSelector('.rp-doc .rp-step', { timeout: 120000 });
  const s1 = await p.evaluate(() => ({ katex: !!window.katex, kErr: document.querySelectorAll('.rp-doc .katex-error').length, steps: document.querySelectorAll('.rp-doc .rp-step').length,
    secs: [...document.querySelectorAll('.rp-doc .rp-h1')].map(h => h.textContent.trim()), toc: document.querySelectorAll('.rp-toc a').length, bad: document.querySelectorAll('.rp-doc .rp-bad').length,
    text: document.querySelector('.rp-doc').innerText }));
  assert.ok(s1.katex, 'KaTeX loaded'); assert.equal(s1.kErr, 0, 'katex errors'); assert.equal(s1.bad, 0, 'unresolved § references');
  assert.ok(s1.steps > 1000, `${s1.steps} steps`); assert.equal(s1.secs.length, 13, s1.secs.join(' | ')); assert.ok(/^1\. Summary/.test(s1.secs[0]), s1.secs[0]);
  assert.ok(!/NaN|undefined|\[object/.test(s1.text), 'NaN / undefined in the report text');
  // a "see §" link of the summary jumps to its step
  const j = await p.evaluate(() => { const a = document.querySelector('.rp-doc .rp-see'), id = a.getAttribute('href').slice(1); a.click(); const el = document.getElementById(id), r = el.getBoundingClientRect(); return { id, txt: a.textContent, inView: r.top >= -2 && r.top < innerHeight, step: el.classList.contains('rp-step') }; });
  assert.ok(j.step && j.inView, JSON.stringify(j));
  // collapse all, expand all, search
  await p.click('[data-rpact="col"]'); assert.equal(await p.locator('.rp-doc .rp-sec.rp-closed').count(), 13);
  await p.click('[data-rpact="exp"]'); assert.equal(await p.locator('.rp-doc .rp-closed').count(), 0);
  await p.fill('.rp-q', 'bearing stiffeners'); await p.waitForTimeout(400);
  const vis = await p.evaluate(() => [...document.querySelectorAll('.rp-doc .rp-sub')].filter(x => !x.closest('.rp-hide')).length);
  assert.ok(vis > 0 && vis < 20, `search shows ${vis} subsections`); await p.fill('.rp-q', ''); await p.waitForTimeout(300);
  // 2. every station: lazy lists
  await p.selectOption('#rp_detail', 'all');
  await p.waitForSelector('.rp-doc details.rp-lz', { timeout: 120000 });
  const lz = await p.evaluate(() => { const d = document.querySelector('.rp-doc details.rp-lz'); d.open = true; return new Promise(r => setTimeout(() => r({ n: document.querySelectorAll('.rp-doc details.rp-lz').length, filled: d.querySelectorAll('.rp-step').length, kErr: document.querySelectorAll('.rp-doc .katex-error').length }), 100)); });
  assert.ok(lz.n > 1000 && lz.filled > 0 && lz.kErr === 0, JSON.stringify(lz));
  await p.selectOption('#rp_detail', 'gov'); await p.waitForSelector('.rp-doc .rp-step');
  // 3. print emulation
  await p.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; }; });
  await p.click('[data-rpact="print"]'); await p.waitForFunction(() => window.__printed > 0);
  await p.emulateMedia({ media: 'print' });
  const pr = await p.evaluate(() => { const vis = el => !!el && getComputedStyle(el).display !== 'none' && el.getBoundingClientRect().height > 0, box = document.getElementById('rp-print');
    return { box: vis(box), app: vis(document.getElementById('app')), toc: [...document.querySelectorAll('.rp-toc')].some(vis), bar: [...document.querySelectorAll('#rp-print .rp-bar')].length,
      steps: box.querySelectorAll('.rp-step').length, hiddenSteps: [...box.querySelectorAll('.rp-step')].filter(s => !vis(s)).length, closed: box.querySelectorAll('details:not([open])').length,
      page: (document.getElementById('rp-page') || {}).textContent || '', ptoc: vis(box.querySelector('.rp-ptoc')), kErr: box.querySelectorAll('.katex-error').length }; });
  assert.ok(pr.box && !pr.app && !pr.toc && pr.bar === 0, JSON.stringify(pr)); assert.equal(pr.hiddenSteps, 0); assert.equal(pr.closed, 0); assert.equal(pr.kErr, 0);
  assert.ok(pr.steps >= s1.steps, `print ${pr.steps} steps vs screen ${s1.steps}`); assert.ok(/counter\(pages\)/.test(pr.page) && /@top-left/.test(pr.page), 'running header'); assert.ok(pr.ptoc, 'printed contents');
  const pdf = await p.pdf({ format: 'Letter', preferCSSPageSize: true }), pages = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.ok(pages > 20, `${pages} printed pages`);
  await p.emulateMedia({ media: 'screen' }); await p.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  assert.equal(await p.evaluate(() => document.body.classList.contains('rp-printing')), false);
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  Report tab: ${s1.steps} steps, ${s1.toc} contents entries, sections ${s1.secs.map(s => s.split(' ')[0]).join(' ')}; jump ${j.txt} -> #${j.id}; search ${vis} subsections; every station ${lz.n} lazy lists; print ${pr.steps} steps, ${pages} pages (Letter), 0 console errors, 0 katex errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); process.exitCode = 1;
} finally { await b.close(); }
