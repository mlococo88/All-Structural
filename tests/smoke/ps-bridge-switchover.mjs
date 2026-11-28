#!/usr/bin/env node
// PS Bridge switch-over (2026-11-28): headless Chromium, file:// (one localStorage for every tool, as Chrome / Edge).
//   1. "Prestressed Bridge Design.html?x=1#rpt" and "psbeam.html#rpt" land in apps/ps-bridge/index.html with the ?query / #hash;
//   2. a browser with no old-app design: no offer notice; no "in development" text anywhere on the page (title, header, footer, tabs);
//   3. a browser with the old app's designs (psbeam.inputs.v1, a shared Bridge Suite project with a psbeam slice, psbeam.projects.v1): the
//      notice names 3 designs; "Show them" opens the Project tab with the card listing 3; every psbeam.* / bridgeSuite.v1.projects key is
//      byte-identical, only psb2.legacyOffer.v1 added; a reload shows no notice; the card's Import (confirm) imports one, old keys unchanged;
//   4. 0 console errors.
//   node tests/smoke/ps-bridge-switchover.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const APP = path.join(REPO, 'apps/ps-bridge/index.html');
const ready = p => p.waitForFunction(() => window.PSBLegacyUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
const DESIGN = { girder: 'PCI BT-72', L: 110, S: 8, nGirders: 5, proj: { name: 'Old job' } };
const OLD = { 'psbeam.inputs.v1': JSON.stringify(DESIGN),
  'bridgeSuite.v1.projects': JSON.stringify({ p1: { name: 'Route 9', savedAt: '2026-10-30T12:00:00.000Z', slices: { psbeam: DESIGN, mct: { projectName: 'Route 9' } } } }),
  'bridgeSuite.v1.currentProjectId': 'p1', 'psbeam.projects.v1': JSON.stringify({ q: { name: 'Older', savedAt: '2026-09-01T00:00:00.000Z', inp: DESIGN } }), 'psbeam.ui.v1': '{"x":1}' };
const oldKeys = p => p.evaluate(() => { const o = {}; for (const k of Object.keys(localStorage).sort()) if (/^psbeam|^bridgeSuite\.v1\.(projects|currentProjectId)$/.test(k)) o[k] = localStorage.getItem(k); return o; });
const allErrs = [];

// 1. the redirect pages
for (const [f, q] of [['Prestressed Bridge Design.html', '?x=1#rpt'], ['psbeam.html', '#rpt']]) {
  const { b, p, errs } = await openPage(path.join(REPO, f), { hash: q });
  try {
    await p.waitForURL(/apps\/ps-bridge\/index\.html/, { timeout: 30000 }); await ready(p);
    const u = new URL(p.url()); assert.equal(u.search + u.hash, q, f); ok(`${f}${q} → apps/ps-bridge/index.html${q}`);
    allErrs.push(...errs);
  } finally { await b.close(); }
}

// 2. no old design: no notice, no pre-switch-over text
{
  const { b, p, errs } = await openPage(APP);
  try {
    await ready(p); await p.waitForTimeout(800);
    assert.equal(await p.$('#lgOffer'), null); ok('no old-app design in this browser: no offer notice');
    const txt = await p.evaluate(() => document.title + '\n' + document.body.innerText);
    assert.ok(!/in development|not for design use|use the old/i.test(txt), 'a pre-switch-over note'); ok('no "in development" / "use the old app" text (title, header, footer, tabs)');
    assert.match(await p.evaluate(() => document.getElementById('appFoot').textContent), /Prestressed Bridge Design v3\.0 ·/); ok('footer: v3.0');
    assert.ok(!(await p.evaluate(() => Object.keys(localStorage).some(k => k === 'psb2.legacyOffer.v1')))); ok('nothing recorded for an offer not shown');
    allErrs.push(...errs);
  } finally { await b.close(); }
}

// 3. the old app's designs in this browser
{
  const { b, p, errs, dialogs } = await openPage(APP, { ls: OLD });
  try {
    await ready(p); await p.waitForSelector('#lgOffer', { timeout: 30000 });
    const before = await oldKeys(p); assert.deepEqual(before, Object.fromEntries(Object.entries(OLD).sort()));
    assert.match(await p.evaluate(() => document.getElementById('lgOffer').innerText), /3 designs saved by the old single-file app/); ok('the notice names 3 old designs');
    await p.click('[data-lgoffer="go"]'); await p.waitForTimeout(600);
    assert.equal(await p.$('#lgOffer'), null);
    assert.equal(await p.evaluate(() => document.querySelector('#inTabs [data-itab="proj"]').getAttribute('aria-selected')), 'true');
    assert.equal(await p.evaluate(() => document.querySelectorAll('#lgListHost input[name="lgPick"]').length), 3); ok('"Show them": the Project tab, the card lists the 3 designs');
    assert.deepEqual(await oldKeys(p), before); assert.ok(await p.evaluate(() => !!localStorage.getItem('psb2.legacyOffer.v1'))); ok('old keys byte-identical; only psb2.legacyOffer.v1 written');
    await p.reload(); await ready(p); await p.waitForTimeout(800); assert.equal(await p.$('#lgOffer'), null); ok('reload: the notice is not shown again');
    // the import itself is the card's (unchanged): scan, pick, import (confirm)
    await p.click('#inTabs [data-itab="proj"]'); await p.click('[data-lg="scan"]'); await p.waitForTimeout(300);
    await p.evaluate(() => document.querySelector('#lgListHost input[name="lgPick"]').click()); await p.click('[data-lg="imp"]'); await p.waitForTimeout(2500);
    assert.ok(dialogs.some(d => /^Import "/.test(d)), 'confirm'); assert.ok(await p.$('#lgSum')); ok('the card imports a design (confirm, import summary)');
    assert.deepEqual(await oldKeys(p), before); ok('after the import, the old keys still byte-identical');
    allErrs.push(...errs);
  } finally { await b.close(); }
}
assert.deepEqual(allErrs, []); ok('0 console errors');
console.log(`${n} checks passed`);
