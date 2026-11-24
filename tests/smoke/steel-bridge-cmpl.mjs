#!/usr/bin/env node
// Browser smoke test (CMPL, 2026-11-24; shared/steps.js line()): a worked step whose eq starts with a relation reads "sym ≤ eq = sub = …",
// not "sym = ≤ eq …", with KaTeX (the CDN copy tests/libs serves) — Steel Bridge Design, built-in project:
//   1. Flexure tab, a positive-flexure location (compact, 6.10.7): step "Ductility" reads D_p ≤ 0.42D_t = … ≤ 0.42(…) = … = OK and
//      "Strength I, compact positive flexure" M_u + 1/3 f_ℓ S_xt ≤ φ_f M_n = … ≤ … = OK.
//   2. Every worked step on the Flexure (that location and the governing one), Constructibility and Cross-frames tabs: no "= ≤", "= ≥",
//      "= <", "= >" or "= ≠" (the relation right after an equals sign). 0 console errors.
//   node tests/smoke/steel-bridge-cmpl.mjs [--shot <png>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';
import { SBD_SEED } from './sbd-seed.mjs';

const si = process.argv.indexOf('--shot'), SHOT = si > 0 ? process.argv[si + 1] : null;
const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/steel-bridge/index.html'), { vw: 1440, vh: 1100, ls: { ...SBD_SEED }, dsf: SHOT ? 2 : undefined });
// the rendered text of each step line (KaTeX's hidden MathML left out), by step id
const lines = () => p.evaluate(() => [...document.querySelectorAll('#out li[id^="st-"]')].map(li => { const d = li.children[1]; if (!d) return null; const c = d.cloneNode(true);
  c.querySelectorAll('.katex-mathml').forEach(e => e.remove()); return [li.id.slice(3), c.textContent.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim(), !!d.querySelector('.katex')]; }).filter(Boolean));
const ready = () => p.waitForFunction(() => { const s = document.querySelector('#out .alert.stale'); return document.querySelector('#out li[id^="st-"]') && (!s || s.hidden); }, null, { timeout: 300000 });
const BAD = /=\s*[≤≥<>≠]/;
try {
  await p.waitForSelector('#tabBar [data-otab="flex"]');
  await p.click('#tabBar [data-otab="flex"]'); await ready();
  await p.evaluate(() => document.querySelectorAll('#out [data-sgall="1"]').forEach(x => x.click()));
  const bad = [];
  let L = await lines(); L.forEach(([id, t]) => { if (BAD.test(t)) bad.push(`flex ${id}: ${t}`); });
  // a positive-flexure location with the compact steps (6.10.7)
  const rows = await p.$$eval('#out [data-fx]', r => r.map(e => e.getAttribute('data-fx')));
  let found = null;
  for (const i of rows) {
    await p.click(`#out [data-fx="${i}"]`); await p.waitForTimeout(150);
    await p.evaluate(() => document.querySelectorAll('#out [data-sgall="1"]').forEach(x => x.click()));
    L = await lines(); L.forEach(([id, t]) => { if (BAD.test(t)) bad.push(`flex@${i} ${id}: ${t}`); });
    const d = L.find(([id]) => /duct\.ok$/.test(id)); if (d) { found = { i, d, m: L.find(([id]) => /mn\.ok$/.test(id)) }; break; }
  }
  assert.ok(found, 'a location with the ductility step');
  assert.ok(found.d[2], 'KaTeX rendered the step');
  assert.match(found.d[1], /^Dp ?≤ ?0\.42Dt ?= ?[\d.]+ ?≤ ?0\.42\([\d.]+\) ?= ?[\d.]+ ?= ?OK$/, found.d[1]);
  if (found.m) assert.match(found.m[1], /^Mu ?\+ ?31 ?fℓ ?Sxt ?≤ ?ϕf ?Mn ?= [^=]+=[^=]+≤[^=]+= OK$/, found.m[1]);
  console.log(`  ok   Flexure, location ${found.i}: "${found.d[1]}"${found.m ? ` / "${found.m[1]}"` : ''}`);
  if (SHOT) { const el = await p.$(`#out li[id="st-${found.d[0]}"]`); const ol = await el.evaluateHandle(e => e.closest('details') || e.parentElement); await ol.scrollIntoViewIfNeeded(); await ol.screenshot({ path: SHOT }); }
  for (const t of ['cn', 'cf']) {
    await p.click(`#tabBar [data-otab="${t}"]`); await ready();
    await p.evaluate(() => document.querySelectorAll('#out [data-sgall="1"]').forEach(x => x.click()));
    L = await lines(); L.forEach(([id, x]) => { if (BAD.test(x)) bad.push(`${t} ${id}: ${x}`); });
    console.log(`  ok   ${t}: ${L.length} step lines checked`);
  }
  assert.deepEqual(bad, [], 'a relation right after "="');
  assert.deepEqual(errs, [], 'console errors');
  console.log(`steel-bridge-cmpl: all passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(0)} s)`);
} finally { await b.close(); }
