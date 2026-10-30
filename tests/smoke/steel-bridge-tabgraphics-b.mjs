#!/usr/bin/env node
// Browser smoke test of the tab graphics B (engine/tabgraphics-b.js, ui/tabgraphics-b.js) in apps/steel-bridge/index.html, built-in project (with one field
// splice), headless Chromium (tests/lib.mjs openPage). For each of the Shear & stiffeners, Fatigue & studs, Cross-frames, Welds, Field splices, Rating
// tabs and the Report summary: calculate, the graphic appears (SVG with text and lines), the wheel zooms, a click on the graphic selects the tab's own
// row (the table row gets class "sel"), Download DXF is a valid file with the highlight layers; 0 console errors. Screenshots (screen and print) into
// the folder SHOTS when it is set.
//   SHOTS=/path/to/folder node tests/smoke/steel-bridge-tabgraphics-b.mjs
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { loadShared } from '../engine/harness.mjs';

const SHOTS = process.env.SHOTS || '';
const W = loadShared(path.join(REPO, 'apps/steel-bridge/engine/model.js'));
const P0 = W.SBDModel.defaultProject(); P0.framing = { ...W.SBDModel.defaultFraming(), splices: [82] };
const t0 = Date.now();
const { b, p, errs, blocked } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1400, vh: 1000, ls: { 'sbd2.project.current': JSON.stringify(JSON.parse(JSON.stringify(P0))) } });
const shot = async (name, sel) => { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true });
  for (const media of ['screen', 'print']) { await p.emulateMedia({ media }); await p.waitForTimeout(150);
    const el = sel ? await p.$(sel) : null; if (el) { await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(SHOTS, `${name}-${media}.png`) }); } else await p.screenshot({ path: path.join(SHOTS, `${name}-${media}.png`) }); }
  await p.emulateMedia({ media: 'screen' }); };
const done = [];
try {
  await p.waitForSelector('#tabBar [data-otab="shear"]');
  const gfx = name => `#out [data-gfxb="${name}"] svg`;
  const vb = name => p.$eval(gfx(name), s => s.getAttribute('viewBox'));
  // the drawing point (x, y of region r) on the screen, then click it
  const clickRegion = async (name, k, i) => {
    const pt = await p.evaluate(([name, k, i]) => { const H = window.SBDTabGfxBUI.handles[name], g = H.graphic, r = g.regions.find(q => q.k === k && q.i === i); if (!r) return null; const b = g.D.bbox(), pad = 0.02 * Math.max(b[2] - b[0], b[3] - b[1]), ox = b[0] - pad, oy = b[3] + pad;
      const sv = H.el, m = sv.getScreenCTM(), q = sv.createSVGPoint(); q.x = (r.x0 + r.x1) / 2 - ox; q.y = oy - (r.y0 + r.y1) / 2; const c = q.matrixTransform(m); return { x: c.x, y: c.y, vw: innerWidth, vh: innerHeight }; }, [name, k, i]);
    assert.ok(pt, `region ${k}:${i} of ${name}`); await p.evaluate(([name]) => window.SBDTabGfxBUI.handles[name].el.scrollIntoView({ block: 'center' }), [name]); await p.waitForTimeout(100);
    const pt2 = await p.evaluate(([name, k, i]) => { const H = window.SBDTabGfxBUI.handles[name], g = H.graphic, r = g.regions.find(q => q.k === k && q.i === i), b = g.D.bbox(), pad = 0.02 * Math.max(b[2] - b[0], b[3] - b[1]), ox = b[0] - pad, oy = b[3] + pad;
      const sv = H.el, m = sv.getScreenCTM(), q = sv.createSVGPoint(); q.x = (r.x0 + r.x1) / 2 - ox; q.y = oy - (r.y0 + r.y1) / 2; const c = q.matrixTransform(m); return { x: c.x, y: c.y }; }, [name, k, i]);
    await p.mouse.click(pt2.x, pt2.y); await p.waitForTimeout(700);
  };
  const common = async (tab, name, extra) => {   // zoom and DXF on the mounted graphic `name`
    await p.waitForSelector(gfx(name), { timeout: 240000 });
    const svgInfo = await p.$eval(gfx(name), s => ({ texts: s.querySelectorAll('text').length, shapes: s.querySelectorAll('line,polyline,polygon,circle').length }));
    assert.ok(svgInfo.texts > 8 && svgInfo.shapes > 20, `${tab}/${name}: drawn ${JSON.stringify(svgInfo)}`);
    await p.$eval(gfx(name), s => s.scrollIntoView({ block: 'center' })); const box = await p.locator(`#out [data-gfxb="${name}"] .sdx-view`).boundingBox(); const v0 = await vb(name);
    await p.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await p.mouse.wheel(0, -500); await p.waitForTimeout(100);
    assert.notEqual(await vb(name), v0, `${tab}/${name}: wheel zoom`); await p.mouse.dblclick(box.x + 40, box.y + 40); await p.waitForTimeout(100); assert.equal(await vb(name), v0, `${tab}/${name}: double-click fits`);
    const txt = await p.evaluate(n => window.SBDTabGfxBUI.handles[n].dxf(), name); assert.ok(/SECTION/.test(txt) && /EOF/.test(txt) && /S-GRDR|S-ANNO-TEXT/.test(txt), `${tab}/${name}: DXF`);
    const dl = await p.$(`#out [data-gfxb="${name}"] [data-sbg="dxf"]`); assert.ok(dl, 'Download DXF button'); done.push(`${tab}/${name}`); return txt;
  };
  const selRow = async (attr, val) => assert.ok(await p.$(`#out tr[${attr}="${val}"].sel`), `row ${attr}=${val} selected`);

  // ---- Shear & stiffeners
  await p.click('#tabBar [data-otab="shear"]'); await p.click('#sh_calc'); const t1 = await common('shear', 'shear'); await common('shear', 'shear-detail');
  assert.ok(/S-RATIO-OK/.test(t1) && /S-GRDR-STIF/.test(t1)); await clickRegion('shear', 'pan', 30); await selRow('data-sh', 'pan:30'); await common('shear', 'shear'); await clickRegion('shear', 'bs', 1); await selRow('data-sh', 'bs:1');
  await clickRegion('shear', 'loc', 20); await selRow('data-sh', 'loc:20'); await shot('shear', '#out section.sec:has([data-gfxb])');
  // ---- Fatigue & studs
  await p.click('#tabBar [data-otab="fat"]'); await p.click('#fa_calc'); await common('fat', 'fatigue'); await common('fat', 'fatigue-chart'); await clickRegion('fatigue', 'fa', 3); await selRow('data-fa', 'fa:3'); await clickRegion('fatigue-chart', 'fa', 5); await selRow('data-fa', 'fa:5'); await shot('fatigue', '#out section.sec:has([data-gfxb])');
  // ---- Cross-frames
  await p.click('#tabBar [data-otab="cf"]'); const tcf = await common('cf', 'crossframe'); assert.ok(/S-GOV/.test(tcf), 'the governing members are on S-GOV'); await shot('crossframes', '#out section.sec:has([data-gfxb])');
  // ---- Welds
  await p.click('#tabBar [data-otab="wt"]'); await p.click('#wt_calc'); await common('wt', 'welds'); await common('wt', 'weld-detail'); await clickRegion('welds', 'fw', 3); await selRow('data-wt', 'fw:3'); await clickRegion('welds', 'tr', 2); await selRow('data-wt', 'tr:2'); await shot('welds', '#out section.sec:has([data-gfxb])');
  // ---- Field splices
  await p.click('#tabBar [data-otab="spl"]'); await p.click('#sp_calc'); const tsp = await common('spl', 'splice'); assert.ok(/S-GOV/.test(tsp), 'the governing group is on S-GOV'); await shot('splices', '#out section.sec:has([data-gfxb])');
  // ---- Rating
  await p.click('#tabBar [data-otab="rt"]'); await p.click('#rt_calc'); await common('rt', 'rating'); const rowsN = await p.evaluate(() => window.SBDTabGfxBUI.handles.rating.graphic.regions.length);
  await clickRegion('rating', 'rt', await p.evaluate(() => window.SBDTabGfxBUI.handles.rating.graphic.regions[40].i)); assert.ok(await p.$('#out tr[data-rt].sel'), 'a rating row selected'); await shot('rating', '#out section.sec:has([data-gfxb])');
  // ---- Report: the summary section carries the figure
  await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('#out .rp-fig svg', { timeout: 240000 });
  const fig = await p.$eval('#out .rp-fig svg', s => ({ texts: s.querySelectorAll('text').length, w: s.getBoundingClientRect().width })); assert.ok(fig.texts > 10 && fig.w > 300, JSON.stringify(fig)); done.push('rpt/summary figure');
  await shot('report-summary', '#out .rp-fig');
  // phone width: the graphics fit without a horizontal page scroll
  await p.setViewportSize({ width: 390, height: 800 }); await p.click('#tabBar [data-otab="shear"]'); await p.waitForTimeout(300); const stale = await p.$('#out .alert.stale:not([hidden])'); if (stale) await p.click('#sh_calc'); await p.waitForSelector(gfx('shear')); await p.waitForTimeout(300);
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1), false, 'no horizontal scroll at phone width'); await shot('shear-phone', '#out [data-gfxb="shear"]');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`ok  tab graphics B: ${done.length} graphics (${done.join(', ')}); wheel zoom, double-click fit, click-to-select, DXF, print; ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  if (blocked.size) console.log('    blocked requests:', [...blocked].join(', '));
} catch (e) {
  console.log('FAIL', e.message, '\n console errors:', errs.slice(0, 5)); if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, 'FAIL.png') }); } process.exitCode = 1;
} finally { await b.close(); }
