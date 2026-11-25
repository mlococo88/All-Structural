#!/usr/bin/env node
// Browser smoke test of the Steel Bridge app (SBLK, 2026-11-24; display only): the "§" of FA4's detailing items (Fatigue & studs tab) and of
// CF10 (Cross-frames tab) lead to a worked step. Made-up bridge: the built-in project with connection plates not attached to both flanges,
// a lateral connection plate on an unstiffened web 4 in from a 16 in flange (8 in required) and oblique welded attachments.
//   Fatigue & studs: the FA4 note has one § per item; clicking each shows the "FA4 distortion-induced fatigue detailing" steps with that step
//   (faD.cp and faD.lat red NG, faD.skew amber Warning). Cross-frames: CF10's § targets st-cf.type, a step of the worked-steps list.
//   node tests/smoke/steel-bridge-step-links.mjs [--file <index.html>] [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = k => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : null; };
const SHOTS = arg('shots'), FILE = arg('file') || path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), allErrs = [];
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const setup = P => { P.fatigue = P.fatigue || {}; P.fatigue.dist = { cp: 'no', lat: 'yes', latLoc: 'web', latStiff: 'no', latBf: 16, latDist: 4, skew: 'yes' }; };
const open = async tab => { const o = await openPage(FILE, { vw: 1440, vh: 1400, dsf: SHOTS ? 2 : undefined, timeout: 90000 });
  await o.p.evaluate(([src, tab]) => { const M = window.SBDModel, P = M.defaultProject(); (new Function('P', src))(P); P.project.name = 'Made-up bridge';
    M.save(localStorage, P); localStorage.setItem(M.KEYS.ui, JSON.stringify({ otab: tab, itab: 'proj' })); }, [`(${setup.toString()})(P)`, tab]);
  await o.p.reload(); await o.p.waitForTimeout(1500); return o; };
{ const { b, p, errs } = await open('fat');
  try {
    for (let k = 0; k < 120; k++) { const st = await p.evaluate(() => { const b = document.querySelector('#out #fa_calc'); return b && b.offsetParent ? 'btn' : document.querySelector('#out .steps li') ? 'done' : 'wait'; });
      if (st === 'done') break; if (st === 'btn') await p.click('#out #fa_calc').catch(() => {}); await p.waitForTimeout(1000); }
    const links = await p.evaluate(() => [...document.querySelectorAll('#out a[data-go^="fd:"]')].map(a => a.dataset.go.split(':')[2]));
    assert.deepEqual(links, ['faD.cp', 'faD.lat', 'faD.skew'], 'one § per FA4 item');
    const want = { 'faD.cp': 'no ng', 'faD.lat': 'no ng', 'faD.skew': 'no wn' };
    for (const id of links) {
      await p.click(`#out a[data-go="fd:0:${id}"]`); await p.waitForTimeout(1200);
      const r = await p.evaluate(id => { const li = document.getElementById('st-' + id), d = li && li.closest('details'); if (d) d.open = true;
        return li ? { cls: li.className, txt: li.innerText.replace(/\s+/g, ' '), head: [...document.querySelectorAll('#out .secHead')].map(h => h.textContent).find(t => /^Worked steps/.test(t)), kx: document.querySelectorAll('#out .katex-error').length } : null; }, id);
      assert.ok(r, `${id}: the step is shown`); assert.equal(r.head, 'Worked steps, FA4 distortion-induced fatigue detailing'); assert.equal(r.kx, 0);
      assert.ok(r.cls.split(' ').every(c => want[id].split(' ').includes(c)) && want[id].split(' ').every(c => r.cls.includes(c)), `${id}: class ${r.cls}`);
      console.log(`  ok   fat ${id}: ${r.cls} — ${r.txt.slice(0, 150)}`);
    }
    if (SHOTS) { const el = await p.$('#out [id="st-faD.lat"]'), d = await el.evaluateHandle(e => e.closest('details.sg-t') || e.closest('.steps'));
      await d.scrollIntoViewIfNeeded(); await d.screenshot({ path: path.join(SHOTS, 'link-fa4.png') }); }
    allErrs.push(...errs.map(e => `fat: ${e}`));
  } finally { await b.close(); } }
{ const { b, p, errs } = await open('cf');
  try {
    await p.waitForSelector('#out .steps li', { state: 'attached', timeout: 120000 }); await p.waitForTimeout(800);
    const r = await p.evaluate(() => { const row = [...document.querySelectorAll('#out tr')].find(tr => /CF10/.test(tr.textContent)), a = row && [...row.querySelectorAll('a[href^="#st-"]')].pop();
      const id = a ? decodeURIComponent(a.getAttribute('href').slice(4)) : null, li = id && document.getElementById('st-' + id), d = li && li.closest('details'); if (d) d.open = true;
      return { id, inSteps: !!(li && li.closest('.steps')), txt: li ? li.innerText.replace(/\s+/g, ' ') : '' }; });
    assert.equal(r.id, 'cf.type'); assert.ok(r.inSteps, 'cf.type in the worked steps'); assert.match(r.txt, /CF10.*61\.88\s*≥\s*48\.00, cross-frame/);
    console.log(`  ok   cf CF10 § → ${r.id}: ${r.txt.slice(0, 160)}`);
    allErrs.push(...errs.map(e => `cf: ${e}`));
  } finally { await b.close(); } }
assert.deepEqual(allErrs, [], 'console errors');
console.log(`steel-bridge-step-links: all checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
