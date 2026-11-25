#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), NX-1 (2026-11-25) in the page: NEXT F live-load distribution per stem. Headless Chromium, file://,
// the CDN libraries from tests/libs. The test project of tests/engine/psbridge-lldf-next.test.mjs, built here from scratch (4 NEXT 24F at
// 10 ft, 40 ft out to out, 45 ft span, d_e 3.833 ft, mountable sidewalks, N_L 3, RIDOT).
//   1. Cross-section tab: the card "Live-load distribution of each NEXT F line" (#nxLines): every line, its rule and its DF_M / DF_V = the
//      page's engine result of that line (G1 / G4 exterior 1.0121 / 1.1163, G2 / G3 interior 0.9841 / 1.1925);
//   2. its § of G1 opens the Loads & LLDF tab with G1 shown: the per-stem card (#nxStems, #nxCand: lever 0.5200 governs), every engine
//      value of the tab (data-ev) = the page's computeAll, the worked steps ld.nx.* rendered; the Shear tab's DF_V links to ld.dfv;
//   3. the Report has the NX-1 assumption; the keys written are psb2.* only; 0 console errors. SHOT=<dir> saves ps-next-lldf.png (the
//      Loads & LLDF card) and ps-next-lldf-xsec.png (the Cross-section card).
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/ps-bridge/index.html'), SHOT = process.env.SHOT;
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1500, vh: 1100 });
const otab = t => p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t);
const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
const until = async (f, ms, w) => { const t0 = Date.now(); for (;;) { if (await f()) return; if (Date.now() - t0 > ms) throw new Error('timeout: ' + w); await new Promise(r => setTimeout(r, 200)); } };
const reload = async () => { await p.reload(); await p.waitForSelector('#tabBar [data-otab]'); await p.waitForTimeout(400); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); P.project.name = 'NEXT F per-stem LLDF smoke (made-up bridge)';
    P.spans.lengths = [45]; P.xs.nb = 4; P.xs.bays = [10, 10, 10]; P.xs.ohL = 5; P.xs.ohR = 5; P.xs.skews = [0, 0];
    P.base.girder = 'NEXT 24F'; P.base.ts = 8; P.base.harp.n = 0; P.base.loads.NL = 3; P.base.owner = 'RIDOT';
    P.base.rows = [{ n: 12, y: 2.875, nd: 2, dbnd: 5 }, { n: 12, y: 4.875, nd: 2, dbnd: 5 }]; P.base.opt.stirAv = 0.4; P.base.opt.sEnd = 9; P.base.opt.sInt = 9; P.base.opt.relAs = 4;
    P.xs.dl.barL.bw = 14 / 12; P.xs.dl.barR.bw = 14 / 12; P.xs.dl.swL = { w: 5, t: 8 }; P.xs.dl.swR = { w: 5, t: 8 }; P.types[0].lines = [2, 3]; P.types[1].lines = [1, 4]; P.design = { g: 2, s: 1 };
    localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await reload();
  // 1. the Cross-section tab card
  await itab('xsec'); await until(() => p.evaluate(() => !!document.querySelector('#nxLines')), 60000, 'the NEXT F lines card');
  const L = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project;
    const eng = PSBBridge.cells(P).map(c => { const R = PSBHoldDown.compute(JSON.parse(JSON.stringify(PSBDesign.cellInputs(P, c.k, c.g)))); return { g: c.g, dfm: R.dfm.toFixed(4), dfv: R.dfv.toFixed(4), ext: !!R.df.nx.ext }; }).sort((a, b) => a.g - b.g);
    const rows = [...document.querySelectorAll('#nxLines tbody tr')].map(r => [...r.children].map(td => td.textContent.replace('§', '').trim()));
    return { eng, rows }; });
  assert.equal(L.rows.length, 4);
  L.eng.forEach(e => { const r = L.rows.find(q => q[1].startsWith(`G${e.g} `)); assert.ok(r, 'row G' + e.g); assert.equal(r[4], e.dfm, `G${e.g} DF_M`); assert.equal(r[5], e.dfv, `G${e.g} DF_V`);
    assert.match(r[3], e.ext ? /^exterior stem/ : /^2 × interior stem/); });
  assert.deepEqual(L.eng.map(e => [e.g, e.dfm, e.dfv]), [[1, '1.0121', '1.1163'], [2, '0.9841', '1.1925'], [3, '0.9841', '1.1925'], [4, '1.0121', '1.1163']]);
  ok(`Cross-section tab: each NEXT F line's rule and factors (${L.rows.map(r => `${r[1].split(' ')[0]} ${r[4]} / ${r[5]}`).join(', ')}) = the page's engine`);
  if (SHOT) await p.locator('#card-nxlines').screenshot({ path: path.join(SHOT, 'ps-next-lldf-xsec.png') });
  // 2. the § of G1 opens the Loads & LLDF tab with G1
  await p.evaluate(() => [...document.querySelectorAll('#nxLines tbody tr')].find(r => /^G1 /.test(r.children[1].textContent)).querySelector('[data-sumgo]').click());
  await until(() => p.evaluate(() => !!document.querySelector('#nxCand')), 60000, 'the exterior candidates on the Loads & LLDF tab');
  const T = await p.evaluate(() => { const P = PSBModel.importJSON(localStorage.getItem('psb2.project.current')).project, R = PSBHoldDown.compute(PSBDesign.inputs(P));
    const at = q => q.split('.').reduce((o, k) => (o == null ? o : o[k]), R), bad = [];
    const pane = document.querySelector('#out') || document.body;
    [...pane.querySelectorAll('[data-ev]')].forEach(s => { const v = at(s.dataset.ev), d = +s.dataset.d, div = +s.dataset.div || 0; const want = typeof v === 'number' ? PSBOutKit.fx(div ? v / div : v, d) : null; if (want !== s.textContent) bad.push(`${s.dataset.ev}: ${s.textContent} vs ${want}`); });
    const cand = [...document.querySelectorAll('#nxCand tbody tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim());
    return { g: PSBDesign.sel(P).g, bad, n: pane.querySelectorAll('[data-ev]').length, cand, steps: [...document.querySelectorAll('[id^="st-ld.nx."]')].length, katexErr: document.querySelectorAll('.katex-error').length };
  });
  assert.equal(T.g, 1); assert.deepEqual(T.bad, []); assert.ok(T.n > 30); assert.ok(T.steps >= 20, 'steps ' + T.steps); assert.equal(T.katexErr, 0);
  assert.match(T.cand[0], /^Lever rule.*0\.5200.*0\.5200/); assert.match(T.cand[3], /Governing.*0\.5200.*0\.5200/);
  ok(`§ G1 → Loads & LLDF with G1: the per-stem card, the exterior candidates (lever 0.5200 governs), ${T.n} engine values = the page's computeAll, ${T.steps} ld.nx.* steps`);
  if (SHOT) { await p.locator('section.sec:has(#nxStems)').scrollIntoViewIfNeeded(); await p.locator('section.sec:has(#nxStems)').screenshot({ path: path.join(SHOT, 'ps-next-lldf.png') }); }
  await otab('shear'); await until(() => p.evaluate(() => !!document.querySelector('a[href="#st-ld.dfv"][data-gotab="lds"]')), 60000, 'the Shear tab DF_V link');
  ok('Shear tab: DF_V links to its derivation (ld.dfv, Loads & LLDF tab)');
  // 3. the Report
  await otab('rpt'); await until(() => p.evaluate(() => /Live-load distribution \(NX-1\): NEXT F, each stem a type \(k\) stringer/.test((document.querySelector('#rptHost') || {}).textContent || '')), 180000, 'the Report note');
  ok('Report: the NX-1 assumption note');
  const keys = await p.evaluate(() => Object.keys(localStorage)); assert.ok(keys.every(k => k.startsWith('psb2.')), 'keys ' + keys.join(', '));
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok(`keys written: psb2.* only (${keys.length}); 0 console errors`);
  console.log(`ps-bridge-nextlldf: ${n} checks passed`);
} finally { await b.close(); }
