#!/usr/bin/env node
// Browser smoke test (SBCOPE, 2026-11-19): coped diaphragm ends, headless Chromium (tests/lib.mjs openPage), apps/steel-bridge/index.html,
// the default project made shallow (made-up: web 22 in, flanges 14 × 2 in on every girder) with a W21x44 diaphragm, at 1400 and 390 px:
// 1. without the cope: CF10 names the coped-ends option (not applied); 2. Coped ends on: the cope inputs and hint, the coped-end items of
// CFD each linked (§) to its worked step, the steps rendered without KaTeX errors, the elevation drawn coped. 0 console errors.
//   node tests/smoke/steel-bridge-dia-cope.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), allErrs = [];
const setup = cope => { const M = window.SBDModel, P = M.defaultProject(); window.SBDFramingUI.ensure(P); window.SBDFramingUI.setBrace(P, 'w');
  P.girders.forEach(g => g.segments.forEach(s => Object.assign(s, { D: 22, topB: 14, topT: 2, botB: 14, botT: 2 })));
  Object.assign(P.crossframes.dia, { shape: 'W21x44', grp: undefined }); if (cope) P.crossframes.dia.cope = 'yes';
  M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: 'cf', itab: 'framing' })); };
for (const vw of [1400, 390]) {
  const { b, p, errs } = await openPage(FILE, { vw, vh: 1000 });
  try {
    await p.evaluate(setup, false); await p.reload(); await p.waitForSelector('#out .secHead');
    const opt = await p.evaluate(() => [...document.querySelectorAll('#out table.tbl tr')].filter(t => /Option: coped ends/.test(t.textContent)).map(t => t.textContent));
    assert.ok(opt.length && /W21x44 with coped ends/.test(opt[0]) && /not applied/.test(opt[0]), JSON.stringify(opt));
    await p.evaluate(setup, true); await p.reload(); await p.waitForSelector('#out .secHead');
    assert.ok(await p.evaluate(() => ['cT', 'cB', 'cL', 'cR'].every(k => document.querySelector(`[data-path="crossframes.dia.${k}"]`)) && /Coped ends \(an option\)/.test(document.body.innerText)));
    const el = await p.$('[data-path="crossframes.dia.cope"]'); await el.scrollIntoViewIfNeeded(); if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbcope-input-${vw}.png`) });
    const r = await p.evaluate(async () => { document.querySelectorAll('#out details').forEach(d => { d.open = true; }); await new Promise(res => setTimeout(res, 800));
      const rows = [...document.querySelectorAll('#out table.tbl tr')].filter(t => /Coped end|Cope length|Coped web|coped ends|Coped diaphragm/.test(t.textContent) && !/Option/.test(t.textContent));
      return { n: rows.length, linked: rows.filter(t => t.querySelector('a.wk')).length, steps: ['cT', 'cB', 'he', 'cL', 'S', 'V', 'bs', 'Q', 'M', 'P'].every(k => document.getElementById('st-cf.cfd.cope.' + k)), kerr: document.querySelectorAll('#out .katex-error').length,
        poly: !!document.querySelector('#out svg[aria-label="Diaphragm elevation"] polygon') }; });
    assert.ok(r.n >= 8 && r.linked === r.n, JSON.stringify(r)); assert.ok(r.steps, 'the worked steps'); assert.equal(r.kerr, 0); assert.ok(r.poly, 'coped outline');
    const st = await p.$('[id="st-cf.cfd.cope.M"]'); if (st) await st.scrollIntoViewIfNeeded(); if (SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbcope-check-${vw}.png`) });
    if (await p.evaluate(() => { const v = [...document.querySelectorAll('#out svg[aria-label="Diaphragm elevation"]')].find(e => e.getBoundingClientRect().height > 0); if (v) v.scrollIntoView({ block: 'center' }); return !!v; }) && SHOTS) await p.screenshot({ path: path.join(SHOTS, `sbcope-elev-${vw}.png`) });   // the visible one of the wide / narrow drawings
    allErrs.push(...errs); console.log(`  ok   ${vw} px: CF10 option, cope inputs, ${r.n} coped-end items linked to their steps, coped elevation`);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors'); console.log('  ok   0 console errors');
