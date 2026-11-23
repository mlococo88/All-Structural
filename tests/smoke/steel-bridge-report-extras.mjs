#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), RPX (2026-11-23; the Report extras of the Prestressed Bridge app), display only.
// Headless Chromium, file://:
//   1. 3D view tab: "Capture for the Report" keeps the view (the note under the view says where it goes);
//   2. Report (selected girder): the References table in the front matter (AASHTO LRFD articles as computed, MBE); every figure with a
//      caption is numbered "Figure n.m" by its section, in order, the verdict banner and the seal box aside; each result section ends with
//      "Graphics of the … tab" holding that tab's own graphics as static figures (no button, select or link inside); the 3D capture is a
//      figure of Project and owner without the stale note; 0 KaTeX errors; no reference dangles ("§?");
//   3. the tabs still draw and select as before (the Shear tab's own graphics after the report was built);
//   4. an input change and Rebuild: the 3D figure says "Captured before the last input change"; the 3D tab's note too;
//   5. 390 px: no figure is wider than the report; every-girder report: References, the verdict banner not numbered; 0 console errors.
//   node tests/smoke/steel-bridge-report-extras.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), SHOT = process.env.SBD_SHOT_DIR || '';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, ...(SHOT ? { dsf: 2 } : {}) });
try {
  await p.waitForFunction(() => window.SBDReportUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  const otab = async t => { await p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t); await p.waitForTimeout(200); };
  const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
  const shot = async (sel, name) => { if (!SHOT) return; const el = p.locator(sel).first(); await el.scrollIntoViewIfNeeded(); await p.waitForTimeout(200); await el.screenshot({ path: path.join(SHOT, name) }); };
  const build = async () => { await otab('rpt'); await p.waitForSelector('#rp_build'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc, .rp-refs', { timeout: 400000 }); await p.waitForTimeout(300);
    const ex = p.locator('.rp-bar button', { hasText: 'Expand all' }); if (await ex.count()) { await ex.first().click(); await p.waitForTimeout(500); } };
  const figs = () => p.evaluate(() => [...document.querySelectorAll('#out .rp-fig')].map(f => { const s = f.closest('[id^="rp-s"], section, .rp-sec'), c = f.querySelector('figcaption');
    return { cap: c ? c.textContent : '', vk: !!f.querySelector('.rp-vk'), img: !!f.querySelector('img'), ctl: f.querySelectorAll('button, select, input, a[href]').length, svg: f.querySelectorAll('svg').length }; }));

  // 1. the 3D view: capture
  await otab('3d'); await p.waitForSelector('#v3d_cap', { timeout: 60000 }); await p.waitForFunction(() => window.SBD3DUI && window.SBD3DUI.camera(), null, { timeout: 60000 }); await p.waitForTimeout(800);
  assert.equal(await p.evaluate(() => window.SBD3DUI.snapshot()), null); assert.equal(await p.locator('#v3d-cap').innerText(), '');
  await p.click('#v3d_cap');
  const snap = await p.evaluate(() => { const q = window.SBD3DUI.snapshot(); return { png: q.png.slice(0, 22), n: q.png.length, at: q.at, meta: q.meta }; });
  assert.equal(snap.png, 'data:image/png;base64,'); assert.ok(snap.n > 2000, `png ${snap.n}`); assert.match(snap.meta, /layers: /);
  assert.match(await p.locator('#v3d-cap').innerText(), /^Captured for the Report \(.+\): Report, Project and owner, "3D view \(captured\)"\.$/);
  await shot('#out', 'steel-report-3-3dcapture.png');
  ok(`3D view: "Capture for the Report" keeps the picture (${Math.round(snap.n / 1024)} kB PNG; ${snap.meta})`);

  // 2. the report
  await build();
  const refs = await p.evaluate(() => { const r = document.querySelector('#out .rp-refs'); return r ? [...r.querySelectorAll('tr')].map(t => [...t.children].map(c => c.textContent)) : null; });
  assert.ok(refs, 'References'); assert.equal(refs[0][0], 'AASHTO LRFD'); assert.match(refs[0][1], /Articles cited in the worked steps of this report: .*6\.10\.7\.1\.1.*6\.10\.9\.3\.1/); assert.ok(refs.some(r => r[0] === 'MBE' && /6A\.4\.2\.1/.test(r[1])));
  let F = await figs();
  const numd = F.filter(f => /^Figure \d+\.\d+: /.test(f.cap)), other = F.filter(f => !/^Figure \d+\.\d+: /.test(f.cap));
  assert.equal(other.length, 2, JSON.stringify(other.map(f => f.cap.slice(0, 40)))); assert.match(other[0].cap, /^Verdict of this girder/); assert.match(other[1].cap, /seal and signature/);
  const last = {}; numd.forEach(f => { const [, s, m] = /^Figure (\d+)\.(\d+)/.exec(f.cap); assert.equal(+m, (last[s] || 0) + 1, f.cap.slice(0, 50)); last[s] = +m; });
  const tabF = F.filter(f => f.vk); assert.ok(tabF.length >= 20, `${tabF.length} tab graphics`); tabF.forEach(f => { assert.equal(f.ctl, 0, `a control in ${f.cap.slice(0, 50)}`); assert.ok(f.svg >= 1); });
  const subs = await p.evaluate(() => [...document.querySelectorAll('#out .rp-doc h3, #out .rp h3')].map(h => h.textContent).filter(t => /Graphics of the .+ tab/.test(t)).map(t => t.replace(/^[\d.]+\s*/, '').replace(/\s*[▾▸▼▶].*$/, '').trim()));
  for (const t of ['Section properties', 'Loads & LLDF', 'Analysis', 'Flexure', 'Shear & stiffeners', 'Fatigue & studs', 'Constructibility', 'Cross-frames', 'Welds', 'Rating']) assert.ok(subs.some(q => q.includes(`Graphics of the ${t} tab`)), `Graphics of the ${t} tab (${subs.join(' | ')})`);
  for (const re of [/Girder elevation coloured by governing ratio/, /Shear and stiffener layout/, /Fatigue stress range along the girder/, /Deck pour sequence/, /Cross-frame elevation/, /Weld locations/, /Rating factor along the girder/, /Section and neutral axes/, /Girder elevation, moments and deflection/]) assert.ok(tabF.some(f => re.test(f.cap)), String(re));
  const f3 = F.find(f => f.img); assert.ok(f3 && /^Figure \d+\.1: 3D view \(captured on the 3D view tab, /.test(f3.cap), f3 && f3.cap);
  const txt = await p.evaluate(() => document.querySelector('#out .rp').innerText);
  assert.ok(!/Captured before the last input change/.test(txt)); assert.ok(!/§\?|undefined|NaN|\[object/.test(txt), (txt.match(/.{30}(§\?|undefined|NaN|\[object).{30}/) || [''])[0]);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#out .katex-error').length), 0, 'KaTeX errors');
  await shot('#out .rp-refs', 'steel-report-1-references.png');
  await shot('#out .rp-fig:has(.rp-vk)', 'steel-report-2-figure.png');
  await shot('#out .rp-fig:has(img)', 'steel-report-4-3d-in-report.png');
  ok(`Report: References (${refs.map(r => r[0]).join(', ')}; ${refs[0][1].split('; ').length} AASHTO LRFD articles); ${numd.length} figures numbered Figure n.m in ${Object.keys(last).length} sections, ${tabF.length} of them the tabs' own graphics in "Graphics of the … tab" (10 tabs), static; the 3D capture is ${f3.cap.split(':')[0]}; 0 KaTeX errors`);

  // 3. the tabs still draw as before
  await otab('shear'); await p.waitForFunction(() => document.querySelector('#out [data-gfxb="shear"] svg'), null, { timeout: 120000 });
  const hs = await p.evaluate(() => { const h = window.SBDTabGfxBUI.handles || {}; return { keys: Object.keys(h).sort(), live: !!(h.shear && document.querySelector('#out [data-gfxb="shear"] .vk-fig svg')), btn: document.querySelectorAll('#out [data-gfxb="shear"] button').length }; });
  assert.ok(hs.live && hs.btn >= 1, JSON.stringify(hs));
  ok(`the Shear tab's own graphics are drawn and interactive after the report was built (handles: ${hs.keys.join(', ')})`);

  // 4. an input change: the capture is marked
  await itab('xsec'); await p.evaluate(() => { const el = document.querySelector('[id="i_deck.haunch"]'); el.value = String(+el.value + 0.5); el.dispatchEvent(new Event('change', { bubbles: true })); }); await p.waitForTimeout(300);
  await build();
  const txt2 = await p.evaluate(() => document.querySelector('#out .rp-fig:has(img)').parentElement.textContent);
  assert.match(txt2, /Captured before the last input change: capture again on the 3D view tab/);
  await otab('3d'); await p.waitForSelector('#v3d-cap'); assert.match(await p.locator('#v3d-cap').innerText(), /captured before the last input change/);
  ok('haunch + 0.5 in and Rebuild: the 3D figure carries "Captured before the last input change: capture again on the 3D view tab"; the 3D tab says so too');

  // 5. phone width; the every-girder report
  await p.setViewportSize({ width: 390, height: 800 }); await otab('rpt'); await p.waitForSelector('#out .rp-fig', { timeout: 60000 }); await p.waitForTimeout(500);
  const wide = await p.evaluate(() => { const doc = document.querySelector('#out .rp-doc') || document.querySelector('#out .rp'), w = doc.getBoundingClientRect().right; return [...document.querySelectorAll('#out .rp-fig')].filter(f => f.offsetParent && f.getBoundingClientRect().right > w + 2).length; });
  assert.equal(wide, 0, 'figures wider than the report at 390 px');
  await shot('#out .rp-fig:has(.rp-vk)', 'steel-report-5-phone.png');
  await p.setViewportSize({ width: 1400, height: 1000 });
  await p.selectOption('#rp_scope', 'all'); await p.waitForSelector('#rp_build'); await p.click('#rp_build'); await p.waitForSelector('#out .rp-refs', { timeout: 580000 });
  const A = await p.evaluate(() => ({ refs: [...document.querySelectorAll('#out .rp-refs tr')].map(t => t.children[0].textContent), caps: [...document.querySelectorAll('#out .rp-fig figcaption')].map(c => c.textContent.slice(0, 30)) }));
  assert.deepEqual(A.refs, ['AASHTO LRFD', 'MBE']); const an = A.caps.filter(c => /^Figure \d+\.\d+: /.test(c)); assert.ok(A.caps.length >= 1 && /^Verdict of the bridge/.test(A.caps[0]), A.caps.join(' | '));   // the verdict banner keeps its caption
  ok(`390 px: no figure wider than the report; every-girder report: References (${A.refs.join(', ')}); its verdict banner is not numbered (${an.length} numbered figures)`);

  assert.deepEqual(errs, [], 'console / page errors');
  console.log(`\n${n} checks passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
