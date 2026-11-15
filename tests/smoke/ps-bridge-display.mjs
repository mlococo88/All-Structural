#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), batch B (2026-11-15, display only): the steel app's formats.
// Headless Chromium, file://, the CDN libraries from tests/libs.
//   1. Summary: the Release stresses cell (0.944) amber (s-hi) with PASS; the check summary column's chip amber (sd-hi), PASS; counts unchanged;
//   2. Section properties: the graphic in a titled card ("Section graphic"), the stat tiles 3 across with the value and unit on one line and a
//      § link to a step; Download DXF: a file that passes SharedDxf.validate (the graphic as drawn);
//   3. the girder type / line picker a plain line (no box);
//   4. Flexure and Shear: the girder elevation coloured by governing ratio (bands, the governing flag) with Download DXF; every result-tab
//      graphic has Download DXF; no "DXF comes with PR 7";
//   5. 390 px: the section figure drawn at the card's width (> 250 px), no sideways scroll; 0 console errors.
//   SHOTS=<dir> node tests/smoke/ps-bridge-display.mjs   (screenshots disp-*.png when SHOTS is set)
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const SHOTS = process.env.SHOTS;
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1600, vh: 1400 });
const shot = async (nm, full) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, nm + '.png'), fullPage: !!full }); } };
const tab = async t => { await p.click(`#tabBar [data-otab="${t}"]`); await p.waitForTimeout(700); };
try {
  await p.waitForSelector('#tabBar [data-otab]');
  await p.evaluate(() => { localStorage.clear(); const P = PSBModel.newProject(); localStorage.setItem('psb2.project.current', PSBModel.exportJSON(P)); });
  await p.reload(); await p.waitForSelector('#tabBar [data-otab]');
  // 1.
  await tab('sum'); await p.waitForSelector('#sum-table', { timeout: 30000 });
  let r = await p.evaluate(() => ({ hi: [...document.querySelectorAll('#sum-table td.s-hi')].map(td => td.innerText.replace(/\s+/g, ' ')), chip: (document.querySelector('#sbDashCol [data-sdgrp="rel"]') || {}).className || '',
    cnt: document.querySelector('#sbDashCol .sdC').innerText }));
  assert.ok(r.hi.some(t => /0\.944 PASS/.test(t)), JSON.stringify(r.hi)); assert.match(r.chip, /sd-pass sd-hi/); assert.match(r.cnt, /2 FAIL.*38 PASS/s);
  ok('Summary: Release stresses 0.944 amber (s-hi) PASS; its chip amber (sd-hi); counts 2 FAIL / 38 PASS as before');
  await shot('disp-summary');
  // 2. / 3.
  await tab('sec');
  r = await p.evaluate(() => { const c = document.querySelector('#gfx_sec').closest('section.gfxCard'), tl = [...document.querySelectorAll('#secFig .vk-tile')];
    const rows = new Set(tl.map(t => Math.round(t.getBoundingClientRect().top))), one = tl.every(t => { const b = t.querySelector('b').getBoundingClientRect(), i = t.querySelector('i').getBoundingClientRect(); return Math.abs(b.bottom - i.bottom) < 6; });
    const bar = document.querySelector('.tyOut'), cs = getComputedStyle(bar);
    return { head: c && c.querySelector('.secHead').textContent, n: tl.length, rows: rows.size, one, links: tl.filter(t => t.querySelector('a.wk')).length, barBorder: cs.borderTopStyle, barBg: cs.backgroundColor, barTxt: bar.innerText }; });
  assert.equal(r.head, 'Section graphic'); assert.equal(r.n, 6); assert.equal(r.rows, 2, '3 across'); assert.ok(r.one, 'value and unit on one line'); assert.ok(r.links >= 3, 'tiles with § ' + r.links);
  assert.equal(r.barBorder, 'none'); assert.match(r.barBg, /rgba\(0, 0, 0, 0\)|transparent/); assert.match(r.barTxt, /Girder type.*on line.*checked on G2, G3, G4; every line in the Summary/s);
  ok(`Section: "Section graphic" card; 6 tiles in 2 rows of 3, value + unit on one line, ${r.links} with a § link; the type / line picker a plain line`);
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#secFig [data-vkdxf]')]);
  const txt = fs.readFileSync(await dl.path(), 'utf8'), chk = await p.evaluate(x => { const c = SharedDxf.validate(x); return { ok: c.ok, errors: c.errors, n: (x.match(/\nTEXT\r?\n/g) || []).length + (x.match(/\nPOLYLINE\r?\n/g) || []).length }; }, txt);
  assert.ok(chk.ok, chk.errors.join('; ')); assert.ok(chk.n > 20, 'entities ' + chk.n); assert.match(txt, /y_bc = 55\.69 in/);
  ok(`Section graphic Download DXF: ${dl.suggestedFilename()} valid (${chk.n} text / polyline entities, the labels as drawn)`);
  await shot('disp-section');
  // 4.
  for (const [t, id, gov] of [['flex', 'fxElev', 'Flexure 0.752'], ['shear', 'shElev', 'Shear 0.721']]) {
    await tab(t);
    r = await p.evaluate(id => { const f = document.getElementById(id); return f ? { bands: f.querySelectorAll('rect[class^="re-"]').length, txt: [...f.querySelectorAll('svg text')].map(x => x.textContent).join('|'), dxf: !!f.querySelector('[data-vkdxf]'),
      cards: [...document.querySelectorAll('#out .vk.va-card, #out .vk.vk-det')].map(c => !!c.querySelector('[data-vadxf],[data-vkdxf]')) } : null; }, id);
    assert.ok(r && r.bands >= 1 && r.txt.includes('Governs: ' + gov), JSON.stringify(r && r.txt.slice(0, 200))); assert.ok(r.dxf && r.cards.every(Boolean), 'Download DXF on every graphic');
    ok(`${t}: girder elevation coloured by governing ratio (${r.bands} bands, "Governs: ${gov}"), Download DXF on each of its ${r.cards.length} graphics`);
    await shot('disp-' + t);
  }
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.click('[data-va="sh"] [data-vadxf]')]);
  const t2 = fs.readFileSync(await dl2.path(), 'utf8'); assert.ok((await p.evaluate(x => SharedDxf.validate(x).ok, t2)), 'chart DXF valid');
  for (const t of ['lds', 'an', 'loss', 'str', 'end', 'camb', 'deck', 'rt']) { await tab(t);
    const q = await p.evaluate(() => ({ n: document.querySelectorAll('#out .vk.va-card, #out .vk.vk-det').length, d: [...document.querySelectorAll('#out .vk.va-card, #out .vk.vk-det')].every(c => !!c.querySelector('[data-vadxf],[data-vkdxf]')), pr7: /DXF comes with PR 7/.test(document.body.innerText),
      empty: [...document.querySelectorAll('#out section.gfxCard:not([hidden])')].filter(c => !c.querySelector('svg')).length })); assert.ok(q.n >= 1 && q.d && !q.pr7 && !q.empty, t + JSON.stringify(q)); }
  ok('Loads & LLDF, Analysis, Losses, Stresses, End zone, Camber, Deck, Rating: every graphic in a card with Download DXF; no empty graphic card');
  // 5.
  await p.setViewportSize({ width: 390, height: 844 }); await tab('sec'); await p.waitForTimeout(500);
  r = await p.evaluate(() => { const s = document.querySelector('#secFig .vk-fig svg'), bb = s.getBBox ? s.getBBox() : null, g = s.querySelector('polygon, path'), gb = g ? g.getBoundingClientRect() : { width: 0 };
    return { w: s.getBoundingClientRect().width, deck: Math.max(...[...s.querySelectorAll('rect')].map(x => x.getBoundingClientRect().width)), sx: document.scrollingElement.scrollWidth - document.scrollingElement.clientWidth }; });
  assert.ok(r.deck > 250, 'deck drawn ' + r.deck); assert.ok(r.sx <= 0, 'sideways ' + r.sx);
  ok(`390 px: the section's deck drawn ${Math.round(r.deck)} px wide (before about 120 px); no sideways scroll`);
  await shot('disp-390-section', true);
  assert.deepEqual(errs, [], 'console errors: ' + errs.join(' | '));
  ok('0 console errors');
  console.log(`ps-bridge-display: ${n} checks ok (0 console errors)`);
} catch (e) { console.error('FAIL', e && e.stack || e); console.error('console errors:', errs); process.exitCode = 1; }
finally { await b.close(); }
