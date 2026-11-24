#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app, Diaphragms tab: the failing check shown on its worked step (SBDFH, 2026-11-24; display only),
// headless Chromium (tests/lib.mjs openPage), apps/steel-bridge/index.html, a made-up shallow bridge: one 40 ft simple span, 9 plate girders
// 4.5 ft apart, web 16 in (fails the fit of a C15x33.9: d = 15 in > D_0 − c = 14 in) or 17 in (fits), flanges 8 × 3/4 in, C15x33.9 channel diaphragms.
//   1. Failing: the CFD topic chip reads "1.071 NG" (the fit), the fit step is red (li.no.ng, "NG" tag), the slenderness step is not red and
//      shows its limit (the engine test sb-dia-fail-highlight checks every item against its step).
//   2. Passing: the CFD chip is the governing item's D/C (not the slenderness 47.153), no red step in the topic.
//   3. No "{,}" in the tab's text; 0 KaTeX errors; 0 console errors.   node tests/smoke/steel-bridge-dia-fail.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const ai = process.argv.indexOf('--shots'), SHOTS = ai > 0 ? process.argv[ai + 1] : null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), allErrs = [];

for (const [name, D] of [['fail', 16], ['pass', 17]]) {
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: SHOTS ? 3000 : 1000, dsf: SHOTS ? 2 : undefined });
  try {
    await p.evaluate(D => { const M = window.SBDModel, P = M.defaultProject();
      P.project.name = 'Made-up shallow bridge'; P.spans = { lengths: [40], continuity: 'simple' };
      P.girders.forEach(g => { g.segments = [{ x0: 0, x1: 40, D, tw: 0.4375, topB: 8, topT: 0.75, botB: 8, botT: 0.75 }]; });
      P.xs.nb = 9; P.xs.bays = Array(8).fill(4.5); P.xs.skews = [0, 0]; P.framing.splices = [];
      window.SBDFramingUI.ensure(P); window.SBDFramingUI.setBrace(P, 'ch'); P.crossframes.dia.shape = 'C15x33.9';
      M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: 'cf', itab: 'framing' })); }, D);
    await p.reload(); await p.waitForSelector('#out details.sg-t[data-sgk="dia"]', { state: 'attached' });
    const r = await p.evaluate(async () => { const d = document.querySelector('#out details.sg-t[data-sgk="dia"]'); d.open = true; await new Promise(z => setTimeout(z, 400));
      const ng = [...d.querySelectorAll('li.no.ng')].map(l => l.id.slice(3)), sl = d.querySelector('[id="st-cf.cfd.ax.sl"]');
      return { chip: d.querySelector('.sg-chip').textContent, cls: d.className, ng, slRed: sl.classList.contains('ng'), slTxt: sl.innerText.replace(/\s+/g, ' '),
        brace: (t => t ? t.textContent : '')(document.querySelector('[id="st-cf.cfd.bT"] .lbl')), leak: /\{,\}/.test(document.getElementById('out').innerText),
        kx: document.querySelectorAll('#out .katex-error').length };
    });
    if (name === 'fail') { assert.equal(r.chip, '1.071 NG'); assert.match(r.cls, /sg-ng/); assert.ok(r.ng.includes('cf.cfd.fit'), JSON.stringify(r.ng)); }
    else { assert.notEqual(r.chip, '47.153'); assert.doesNotMatch(r.chip, /NG/); assert.deepEqual(r.ng, [], 'no red step'); }
    assert.ok(!r.slRed, 'the slenderness step is not red'); assert.match(r.slTxt, /47\.2\s*≤\s*140/); assert.match(r.slTxt, /47\.15 ≤ 140: OK/);
    assert.match(r.brace, /= 6EIx\/S = \d{1,3}(,\d{3})+(?!\{)/); assert.ok(!r.leak, 'no {,} on the tab'); assert.equal(r.kx, 0, 'KaTeX errors');
    if (SHOTS) { const el = await p.$('#out details.sg-t[data-sgk="dia"]'); await el.scrollIntoViewIfNeeded(); await el.screenshot({ path: path.join(SHOTS, `sb-dia-${name}.png`) }); }
    console.log(`  ok   ${name} (web D = ${D} in): CFD chip "${r.chip}", red steps [${r.ng.join(', ')}], slenderness with its limit, no {,}`);
    allErrs.push(...errs);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log(`steel-bridge-dia-fail: all checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
