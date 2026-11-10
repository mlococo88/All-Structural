#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): two regressions (OPN + ABNF, 2026-11-10).
//   OPN: opening a project with fewer supports than the open one, with the Summary tab showing, threw in openProject (the
//        open tab was drawn from the old MODEL before recompute()); Import JSON then said "… is not a readable JSON file".
//        Checked through Import JSON (the file input), the Saved projects dialog (the same open callback as the Cloud sync
//        load), Undo / Redo, and New project; an error after a valid JSON parse is reported with its own class, not as
//        unreadable JSON.
//   ABNF: an abutment with Foundation "None": no NaN on the Earth loads tab, in its load diagram or in the Report; the
//        footing-level items are omitted; the abutment hand-off leaves that abutment out (no bottomOfFooting 0 sent);
//        hand check of the stem live load surcharge with H measured from the base of the stem.
//   0 console errors in both scenarios.
//   node tests/smoke/bsl-open-nofooting.mjs
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html');   // BSL_FILE: another copy (e.g. main, to see the test fail)
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 400)); } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ready = p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SLPL);

console.log('OPN: open a project with fewer supports while Summary is shown');
{
  const { b, p, errs } = await openPage(FILE);
  try {
    await ready(p); await sleep(800);
    const two = await p.evaluate(() => { showTab('summary'); const j = JSON.parse(JSON.stringify(P)); j.br.spans = [100]; j.br.skews = j.br.skews.slice(0, 2); j.units = [j.units[0], j.units[j.units.length - 1]]; j.meta.name = 'Two supports'; j.ui.tab = 'summary'; return j; });
    const n0 = await p.evaluate(() => P.units.length);
    assert.ok(n0 > 2, 'default has more than two supports');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bsl-opn-')), f = path.join(tmp, 'two.subloads.json');
    fs.writeFileSync(f, JSON.stringify(two));
    const flashTxt = () => p.evaluate(() => [...document.querySelectorAll('.flash, #flash, [class*=flash]')].map(e => e.textContent).join(' | '));
    await ok('Import JSON: opened, two supports, Summary drawn', async () => {
      await p.setInputFiles('#file-in', f); await sleep(800);
      const s = await p.evaluate(() => ({ n: P.units.length, sup: MODEL.G.sup.length, tab: P.ui.tab, sum: document.getElementById('tab-summary').innerText }));
      assert.equal(s.n, 2); assert.equal(s.sup, 2); assert.equal(s.tab, 'summary');
      assert.match(s.sum, /Abut\. 1/); const fl = await flashTxt(); assert.doesNotMatch(fl, /not a readable JSON/); assert.match(fl, /Opened two\.subloads\.json/);
    });
    await ok('Undo / Redo across the support count with Summary shown', async () => {
      await p.evaluate(() => SLPL.h.undo()); await sleep(500);
      assert.equal(await p.evaluate(() => P.units.length), n0);
      await p.evaluate(() => SLPL.h.redo()); await sleep(500);
      assert.equal(await p.evaluate(() => [P.units.length, MODEL.G.sup.length].join()), '2,2');
    });
    await ok('New project (more supports) with Summary shown', async () => {
      await p.evaluate(() => { SLPL.pb.setCurrent(null); }); await p.evaluate(() => { const bt = [...document.querySelectorAll('button[data-sp]')].find(x => /^New/.test(x.textContent)); if (bt) bt.click(); }); await sleep(800);
      assert.equal(await p.evaluate(() => [P.units.length, MODEL.G.sup.length].join()), `${n0},${n0}`);
    });
    await ok('Saved projects dialog Open (the callback the Cloud sync load uses): two supports', async () => {
      await p.evaluate(j => { SLPL.store.save('Two supports', j); showTab('summary'); }, two);
      await p.evaluate(() => SLPL.dlg.show()); await p.waitForSelector('dialog.spLib[open] [data-spa="open"]');
      await p.click('dialog.spLib[open] [data-spa="open"][data-n="' + encodeURIComponent('Two supports') + '"]').catch(async () => p.evaluate(() => [...document.querySelectorAll('dialog.spLib[open] [data-spa="open"]')].find(x => /Two/.test(decodeURIComponent(x.dataset.n))).click()));
      await sleep(800);
      assert.equal(await p.evaluate(() => [P.units.length, MODEL.G.sup.length, P.ui.tab].join()), '2,2,summary');
    });
    await ok('Import JSON: an error after a valid parse is not called unreadable JSON', async () => {
      await p.evaluate(() => { window.__op = openProject; openProject = () => { throw new TypeError('probe'); }; });
      const g = path.join(tmp, 'good.subloads.json'); fs.writeFileSync(g, JSON.stringify(two));
      await p.setInputFiles('#file-in', g); await sleep(500);
      const fl = await flashTxt(); await p.evaluate(() => { openProject = window.__op; });
      assert.doesNotMatch(fl, /good\.subloads\.json is not a readable JSON file/); assert.match(fl, /could not be opened \(TypeError: probe\)/);
      const bad = path.join(tmp, 'bad.subloads.json'); fs.writeFileSync(bad, '{ not json');
      await p.setInputFiles('#file-in', bad); await sleep(500); assert.match(await flashTxt(), /bad\.subloads\.json is not a readable JSON file/);
    });
    await ok('0 console errors', () => assert.deepEqual(errs, []));
  } finally { await b.close(); }
}

console.log('ABNF: abutment with Foundation "None"');
{
  const { b, p, errs } = await openPage(FILE);
  try {
    await ready(p); await sleep(800);
    await p.evaluate(() => { P.ui.sel = 0; P.ui.itab = 'units'; buildSide(); }); await sleep(200);
    await p.selectOption('#f_units_0_ftg_type', 'none'); await sleep(600);
    const last = await p.evaluate(() => P.units.length - 1);
    await p.evaluate(k => { P.ui.sel = k; buildSide(); }, last); await sleep(200);
    await p.selectOption(`#f_units_${last}_ftg_type`, 'none'); await sleep(600);
    await ok('both abutments set to "None", no input errors', async () => assert.deepEqual(await p.evaluate(() => [P.units[0].ftg.type, P.units[P.units.length - 1].ftg.type, SubLoadsInputCheck.collect().length]), ['none', 'none', 0]));
    for (const k of [0, last]) await ok(`Earth loads tab, unit ${k}: no NaN, no footing-level items, note shown, diagram drawn`, async () => {
      const s = await p.evaluate(async k => { P.ui.sel = k; showTab('earth'); await new Promise(r => setTimeout(r, 300)); const el = document.getElementById('tab-earth'); const E = earthLoads(k).E;
        return { nan: (el.innerHTML.match(/NaN/g) || []).length, bot: E.items.filter(i => i.sec === 'bot').length, svg: el.querySelectorAll('svg').length, txt: el.innerText,
          bad: E.items.filter(i => [i.H, i.z, i.W].some(v => v != null && !isFinite(v))).length }; }, k);
      assert.equal(s.nan, 0); assert.equal(s.bad, 0); assert.equal(s.bot, 0); assert.ok(s.svg >= 1, 'diagram'); assert.match(s.txt, /No footing \(Foundation "None"\)/); assert.match(s.txt, /base of the stem to grade/);
    });
    await ok('hand check: stem LS with H = soil height 17 ft, h_eq = 2.3 ft (Table 3.11.6.4.1-1 interpolation)', async () => {
      const s = await p.evaluate(() => { const E = earthLoads(0).E, i = E.items.find(x => x.nm === 'Live load surcharge on the stem and backwall'); return { H: E.H, heq: E.heq, LS: i.H, ka: E.K.ka, L: E.L }; });
      assert.ok(Math.abs(s.H - 17) < 1e-9, 'H ' + s.H); assert.ok(Math.abs(s.heq - 2.3) < 1e-9, 'heq ' + s.heq);
      const LS = s.ka * 0.120 * 2.3 * 17 * s.L; assert.ok(Math.abs(s.LS - LS) < 1e-6 && Math.abs(s.LS - 66.417) < 0.01, 'LS ' + s.LS);
    });
    await ok('combinations finite; no bottom-of-footing resultant', async () => {
      const s = await p.evaluate(() => { const c = combine(0), d = unitRes(0).UM.defs; return { fin: Object.values(c).every(x => !x || !x.max || [...x.max, ...x.min].every(isFinite)), bot: d.some(q => /bottom of footing/.test(q.label)) }; });
      assert.equal(s.fin, true); assert.equal(s.bot, false);
    });
    await ok('abutment hand-off: the no-footing abutments are left out with a reason', async () => {
      const s = await p.evaluate(() => { const j = abutExportData(), h = abutHandoffPayload(); return { a: j.abutments.map(a => !!a.error), err: h.err || '', json: JSON.stringify(j) }; });
      assert.deepEqual(s.a, [true, true]); assert.match(s.err, /no footing to export/); assert.doesNotMatch(s.json, /NaN|"bottomOfFooting":0\b/);
    });
    await ok('Report: rendered, no NaN', async () => {
      const s = await p.evaluate(async () => { showTab('report'); await new Promise(r => setTimeout(r, 2500)); const el = document.getElementById('tab-report'); return { nan: (el.innerHTML.match(/NaN/g) || []).length, len: el.innerText.length, txt: SLR.doc ? SharedReport.text(SLR.doc) : '' }; });
      assert.equal(s.nan, 0); assert.ok(s.len > 1000); assert.match(s.txt, /No footing \(Foundation "None"\)/);
    });
    await ok('0 console errors', () => assert.deepEqual(errs, []));
  } finally { await b.close(); }
}
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
