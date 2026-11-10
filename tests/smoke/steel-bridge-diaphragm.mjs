#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app with a diaphragm as the intermediate bracing (SBDIA, 2026-11-10; engineer: "I have channel
// diaphragm selected and there is still a lot of output and failures related to cross frames"), headless Chromium (tests/lib.mjs openPage),
// apps/steel-bridge/index.html, the default project with a channel diaphragm (MC18x42.7) and with a rolled W (W21x44):
//   1. The output tab reads "Diaphragms"; its cards: "Diaphragms: governing", "Diaphragms: elevation" (the diaphragm drawing, no X / K truss
//      graphic), the checks heading lists only CF10 / CF11 / CFD / CFE; no CF1 to CF9 row; no "Member forces (truss model)"; no truss steps.
//   2. The Summary column and the left check column chip read "Diaphragms"; the Report section is "Framing and diaphragms" with no truss member forces.
//   SBDX (2026-11-10): the axial items of CFD / CFE with their steps (§), the channel's 6.12.2.2.5 steps in the Report, 0 KaTeX errors.
//   3. Back to an X-frame: "Cross-frames" again, the truss card and graphic back.
//   0 console errors.   node tests/smoke/steel-bridge-diaphragm.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const shot = async (p, n) => { if (SHOTS) await p.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), allErrs = [];
const tabText = p => p.evaluate(() => ({ tab: document.querySelector('#tabBar [data-otab="cf"]').textContent, heads: [...document.querySelectorAll('#out .secHead')].map(e => e.textContent),
  gfx: !!document.querySelector('#out [data-gfxb="crossframe"]'), svg: !!document.querySelector('#out svg[aria-label="Diaphragm elevation"]'),
  rows: [...document.querySelectorAll('#out table.tbl td b')].map(e => e.textContent), steps: [...document.querySelectorAll('#out li[id^="st-cf."]')].map(e => e.id) }));

for (const [mode, shape] of [['ch', 'MC18x42.7'], ['w', 'W21x44']]) {
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1000 });
  try {
    await p.evaluate(m => { const M = window.SBDModel, P = M.defaultProject(); window.SBDFramingUI.ensure(P); window.SBDFramingUI.setBrace(P, m); M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: 'cf', itab: 'framing' })); }, mode);
    await p.reload(); await p.waitForSelector('#out .secHead');
    const t = await tabText(p);
    assert.equal(t.tab, 'Diaphragms'); assert.equal(t.heads[0], 'Diaphragms: governing'); assert.equal(t.heads[1], 'Diaphragms: elevation');
    assert.ok(!t.gfx && t.svg, 'the diaphragm drawing, not the truss graphic'); assert.ok(t.heads.every(h => h !== 'Member forces (truss model)'), 'no truss member forces');
    const ck = t.heads.find(h => /^Checks/.test(h)); assert.match(ck, /^Checks \((CF1[01]|CFD|CFE)(, (CF1[01]|CFD|CFE))*\)$/, ck);
    assert.deepEqual(t.rows.filter(r => /^CF[1-9]$/.test(r)), [], 'no CF1 to CF9 rows'); assert.ok(t.rows.includes('CFD') && t.rows.includes('CFE'));
    assert.deepEqual(t.steps.filter(id => /^st-cf\.(tr\d|user\.|top\.|bot\.|diag\.|geo$|sb\.bbr$|sb\.bT$)/.test(id)), [], 'no truss steps');
    assert.match(await p.evaluate(() => document.querySelector('#out svg[aria-label="Diaphragm elevation"]').textContent), new RegExp(shape.replace('.', '\\.')));
    // SBDX: the new items (axial compression, tension, slenderness, axial + flexure) in CFD / CFE, each linked (§) to its step
    const ax = await p.evaluate(() => [...document.querySelectorAll('#out table.tbl tr')].filter(tr => /axial compression P = F|axial tension P = F|Slenderness Kℓ\/r|axial and flexure \(6\.9\.2\.2/.test(tr.textContent)).map(tr => (tr.querySelector('a.wk') || {}).dataset && tr.querySelector('a.wk').dataset.cfgo));
    assert.equal(ax.length, 8, 'four new items in CFD and in CFE'); assert.ok(ax.every(id => /^cf\.cf[de]\.ax\./.test(id || '')), JSON.stringify(ax));
    assert.ok(await p.evaluate(ids => ids.every(id => document.getElementById('st-' + id)), ax), 'each § finds its step');
    // the worked steps of the tab (every group opened): the new steps are there and every TeX line renders (KaTeX)
    const kx = await p.evaluate(async () => { document.querySelectorAll('#out details').forEach(d => { d.open = true; }); await new Promise(r => setTimeout(r, 600));
      return { err: document.querySelectorAll('#out .katex-error').length, kat: document.querySelectorAll('#out .katex').length, ch: !!document.getElementById('st-cf.cfd.ch.Lr'), ax: ['ax.L', 'ax.Pe', 'ax.Pcr', 'ax.Aeff', 'ax.Pr', 'ax.Pt', 'ax.sl', 'ax.ia'].every(k => document.getElementById('st-cf.cfd.' + k)) }; });
    assert.ok(kx.kat > 0, 'TeX rendered'); assert.equal(kx.err, 0, 'KaTeX errors on the tab'); assert.ok(kx.ax, 'axial steps on the tab'); assert.equal(kx.ch, mode === 'ch', 'channel 6.12.2.2.5 steps on the tab');
    await shot(p, `dia-${mode}-tab`);
    console.log(`  ok   ${shape}: tab "Diaphragms", ${ck}, diaphragm elevation, no truss output`);
    // 2. Summary, left column, Report
    await p.click('#tabBar [data-otab="sum"]'); await p.waitForFunction(() => /Up to date/.test((document.querySelector('#out .sum-run') || {}).textContent || ''), null, { timeout: 300000 });
    const s = await p.evaluate(() => ({ th: [...document.querySelectorAll('#sum-table thead th')].map(e => e.textContent), chip: (document.querySelector('#sbDashCol [data-sdgrp="Cross-frames"] .sdName') || {}).textContent }));
    assert.ok(s.th.some(h => /^DiaphragmsCF10, CF11, CFD, CFE$/.test(h)), JSON.stringify(s.th)); assert.ok(!s.th.some(h => /^Cross-frames/.test(h)));
    assert.equal(s.chip, 'Diaphragms');
    await shot(p, `dia-${mode}-summary`);
    await p.click('#tabBar [data-otab="rpt"]'); await p.click('#rp_build'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 300000 });
    assert.equal(await p.evaluate(() => document.querySelectorAll('.rp-doc .katex-error').length), 0, 'KaTeX errors in the Report');
    const r = await p.evaluate(() => { const t = document.querySelector('.rp-doc').innerText; return { dia: /FRAMING AND DIAPHRAGMS|Framing and diaphragms/.test(t), xf: /Framing and cross-frames|FRAMING AND CROSS-FRAMES/.test(t), mf: /Member forces \(truss model\)/i.test(t) }; });
    assert.ok(r.dia && !r.xf && !r.mf, JSON.stringify(r));
    console.log(`  ok   ${shape}: Summary column and left chip "Diaphragms"; Report "Framing and diaphragms", no truss member forces`);
    if (mode === 'ch') {   // 3. back to an X-frame
      await p.click('#inTabs [data-itab="framing"]'); await p.selectOption('[data-path="crossframes.type"]', 'X'); await p.click('#tabBar [data-otab="cf"]');
      await p.waitForFunction(() => document.querySelector('#tabBar [data-otab="cf"]').textContent === 'Cross-frames' && [...document.querySelectorAll('#out .secHead')].some(e => e.textContent === 'Member forces (truss model)'), null, { timeout: 60000 });
      assert.ok(await p.evaluate(() => !!document.querySelector('#out [data-gfxb="crossframe"]')));
      console.log('  ok   back to an X-frame: "Cross-frames", the truss member forces and graphic');
    }
    allErrs.push(...errs);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log(`steel-bridge-diaphragm: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
