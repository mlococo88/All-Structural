#!/usr/bin/env node
// Browser smoke test (SB2L, 2026-11-19): the diaphragm end connection with two vertical bolt lines, headless Chromium (tests/lib.mjs openPage),
// apps/steel-bridge/index.html, the default (made-up) project with a W21x44 diaphragm, 4 bolts per line at 3 in, two lines 3 in apart,
// an 8 in connection plate, at 1400 and 390 px: the Framing & bracing inputs (the lines select, the gage row, the hint), the Diaphragms tab
// (the item "2 lines of 4 bolts", its § link to the worked step cf.cfd.bolt, the steps boltJ / boltM / bolt / boltw rendered without
// KaTeX errors, both bolt lines in the elevation). 0 console errors.   node tests/smoke/steel-bridge-dia-two-lines.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), allErrs = [];
for (const vw of [1400, 390]) {
  const { b, p, errs } = await openPage(FILE, { vw, vh: 1000 });
  try {
    await p.evaluate(() => { const M = window.SBDModel, P = M.defaultProject(); window.SBDFramingUI.ensure(P); window.SBDFramingUI.setBrace(P, 'w');
      Object.assign(P.crossframes.dia, { shape: 'W21x44', nb: 4, pitch: 3, ecc: 3.5, nl: '2', g: 3 }); P.crossframes.conn.thr = 'excl'; P.crossframes.sb.bs = 8;
      M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: 'cf', itab: 'framing' })); });
    await p.reload(); await p.waitForSelector('#out .secHead');
    const inp = await p.evaluate(() => ({ nl: (document.querySelector('[data-path="crossframes.dia.nl"]') || {}).value, g: !!document.querySelector('[data-path="crossframes.dia.g"]'), hint: /to the first line, the one nearest the web/.test(document.body.innerText) }));
    assert.deepEqual(inp, { nl: '2', g: true, hint: true });
    const el = await p.$('[data-path="crossframes.dia.nl"]'); await el.scrollIntoViewIfNeeded();
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbdia-input-${vw}.png`) });
    const r = await p.evaluate(async () => { document.querySelectorAll('#out details').forEach(d => { d.open = true; }); await new Promise(res => setTimeout(res, 800));
      const tr = [...document.querySelectorAll('#out table.tbl tr')].find(t => /Bolted connection: 2 lines of 4 bolts/.test(t.textContent)), a = tr && tr.querySelector('a.wk');
      return { row: !!tr, link: a && a.dataset ? Object.values(a.dataset).join(' ') : '', steps: ['boltJ', 'boltM', 'bolt', 'boltw'].every(k => document.getElementById('st-cf.cfd.' + k)), kerr: document.querySelectorAll('#out .katex-error').length,
        bolts: (document.querySelector('#out svg[aria-label="Diaphragm elevation"]') || { querySelectorAll: () => [] }).querySelectorAll('circle').length }; });
    assert.ok(r.row, 'the two-line bolt item'); assert.match(r.link, /cf\.cfd\.bolt/); assert.ok(r.steps, 'the worked steps'); assert.equal(r.kerr, 0); assert.ok(r.bolts >= 16, `bolts drawn ${r.bolts}`);
    const st = await p.$('[id="st-cf.cfd.bolt"]'); if (st) await st.scrollIntoViewIfNeeded();
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbdia-check-${vw}.png`) });
    if (await p.evaluate(() => { const v = [...document.querySelectorAll('#out svg[aria-label="Diaphragm elevation"]')].find(e => e.getBoundingClientRect().height > 0); if (v) v.scrollIntoView({ block: 'center' }); return !!v; }) && SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbdia-elev-${vw}.png`) });   // the visible one of the wide / narrow drawings
    allErrs.push(...errs); console.log(`  ok   ${vw} px: inputs, the two-line item linked to its steps, ${r.bolts} bolts in the elevation`);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors'); console.log('  ok   0 console errors');
