#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app (NGREL, 2026-11-24; display only): a failing comparison step prints the relation that holds
// ("f_bu + f_ℓ/3 ≤ φ_fF_nc = 33.75 + … = 33.75 > 17.75, NG"); the symbolic requirement (≤) stays; a passing step keeps its "≤".
// Headless Chromium (tests/lib.mjs openPage), made-up "thin" bridge (the built-in project with every flange 40 % thinner and 4 in narrower,
// ≥ 12 in, and the webs 1/8 in thinner, ≥ 7/16 in): the Constructibility tab (its first failing case row selected) and the Flexure tab.
//   node tests/smoke/steel-bridge-ngrel.mjs [--file <index.html>] [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('shots'), FILE = arg('file') || path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), allErrs = [];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const thin = P => { P.girders.forEach(g => g.segments.forEach(s => { s.tw = Math.max(0.4375, s.tw - 0.125); s.botT = Math.max(0.75, s.botT * 0.6); s.topT = Math.max(0.625, s.topT * 0.6); s.botB = Math.max(12, s.botB - 4); s.topB = Math.max(12, s.topB - 4); })); };
const BTN = { flex: '#fx_calc', cn: '#cn_calc' }, SEL = { flex: 'td.fx-ng', cn: 'td.cn-ng' };
for (const tab of ['cn', 'flex']) {
  const { b, p, errs } = await openPage(FILE, { vw: 1440, vh: 1400, dsf: SHOTS ? 2 : undefined, timeout: 90000 });
  try {
    await p.evaluate(([src, tab]) => { const M = window.SBDModel, P = M.defaultProject(); (new Function('P', src))(P); P.project.name = 'Made-up bridge';
      M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: tab, itab: 'proj' })); }, [`(${thin.toString()})(P)`, tab]);
    await p.reload(); await p.waitForTimeout(1500);
    for (let k = 0; k < 120; k++) { const st = await p.evaluate(s => { const b = document.querySelector('#out ' + s); return b && b.offsetParent ? 'btn' : document.querySelector('#out .steps li') ? 'done' : 'wait'; }, BTN[tab]);
      if (st === 'done') break; if (st === 'btn') await p.click('#out ' + BTN[tab]).catch(() => {}); await p.waitForTimeout(1000); }
    await p.waitForSelector('#out .steps li', { state: 'attached', timeout: 120000 }); await p.waitForTimeout(800);
    const hit = await p.evaluate(sel => { const td = [...document.querySelectorAll('#out ' + sel)].find(c => c.closest('[data-fx],[data-cnsel]')); if (!td) return false; td.closest('[data-fx],[data-cnsel]').click(); return true; }, SEL[tab]);
    assert.ok(hit, `${tab}: a failing row`); await p.waitForTimeout(3000);
    await p.evaluate(() => document.querySelectorAll("#out details").forEach(d => { d.open = true; })); await p.waitForTimeout(500);
    const r = await p.evaluate(() => { const L = [...document.querySelectorAll('#out .steps li[id^="st-"]')], t = l => l.innerText.replace(/\s+/g, ' ');
      const ng = L.filter(l => l.classList.contains('ng')), pass = L.filter(l => !l.classList.contains('no'));
      return { ng: ng.map(l => [l.id.slice(3), t(l)]), passLe: pass.filter(l => /≤[^=]*=[^≤>]*≤/.test(t(l))).length, kx: document.querySelectorAll('#out .katex-error').length }; });
    assert.equal(r.kx, 0, `${tab}: KaTeX errors`);
    const cmp = r.ng.filter(([, x]) => /≤|≥/.test(x));
    assert.ok(cmp.length > 0, `${tab}: a failing comparison step`);
    for (const [id, x] of cmp) { assert.match(x, /[≤≥]/, `${id}: the requirement stays`); assert.match(x, /\d \s*[><]\s*[\d(]/, `${id}: the relation that holds: ${x}`); assert.ok(!/\d\s*≤\s*[\d(][^,]*, NG/.test(x) || /[><]/.test(x), `${id}: ${x}`); }
    console.log(`  ok   thin ${tab}: ${cmp.length} failing comparisons with ">" / "<" (${cmp.slice(0, 3).map(([id, x]) => `${id}: …${x.slice(x.lastIndexOf('='), x.lastIndexOf('=') + 40)}`).join('; ')}), ${r.passLe} passing steps keep "≤"`);
    if (SHOTS && tab === 'cn') { const id = (cmp.find(([i]) => i === 'cn.buck.ok') || cmp[0])[0], el = await p.$(`#out [id="st-${id}"]`);
      const d = await el.evaluateHandle(e => e.closest('details.sg-t') || e.closest('.steps')); await d.evaluate(e => { if (e.tagName === 'DETAILS') e.open = true; });
      await p.waitForTimeout(300); await d.scrollIntoViewIfNeeded(); await d.screenshot({ path: path.join(SHOTS, 'ng-gt-gs14.png') }); }
    allErrs.push(...errs.map(e => `${tab}: ${e}`));
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, [], 'console errors');
console.log(`steel-bridge-ngrel: all checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
