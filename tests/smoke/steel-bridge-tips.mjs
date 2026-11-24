#!/usr/bin/env node
// Browser smoke test of the input help tooltips of Steel Bridge Design (TIP, 2026-11-24; apps/steel-bridge/ui/tips.js, display only).
// apps/steel-bridge/index.html, headless Chromium (tests/lib.mjs openPage):
//   1. every entry of SBDTips.TIPS gets its "?" button once its input is drawn: each input tab opened, then the states that draw the
//      rest (rolled shape picked, deck design on, a permit vehicle chosen, a diaphragm chosen); no entry is left without a button, no
//      label has two;
//   2. the button adds no text: the label's textContent is the same with and without the button; the input does not move on the row
//      while a tip is shown (the box is position: fixed); the page does not scroll sideways at 390 px;
//   3. hover shows the box, mouse out hides it; keyboard: Tab to the button shows it (aria-expanded true, aria-describedby), Escape
//      hides it; a tap (click) pins it, a second tap or a tap elsewhere hides it; the box stays inside the window at 390 px;
//   4. nothing is saved: the stored project text is the same before and after every tooltip action; 0 console errors.
//   node tests/smoke/steel-bridge-tips.mjs [shotDir]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shotDir = process.argv[2] || '';
const FILE = path.join(REPO, 'apps/steel-bridge/index.html');
const saved = p => p.evaluate(() => localStorage.getItem('sbd2.project.current'));
const found = p => p.evaluate(() => { const T = window.SBDTips.TIPS, out = new Set(); document.querySelectorAll('.sbtip').forEach(b => out.add(+b.dataset.tip)); return [...out].map(i => T[i].id || T[i].sel || T[i].after); });
const dup = p => p.evaluate(() => [...document.querySelectorAll('label, .rt-vt')].filter(l => l.querySelectorAll(':scope > .sbtip').length > 1).length);
const errs = [];

async function run(vw, vh) {
  const A = await openPage(FILE, { vw, vh, dsf: 2 });
  const p = A.p;
  await p.waitForSelector('#tabBar [data-otab="loads"]'); await p.waitForTimeout(1500);
  assert.ok(await p.evaluate(() => !!window.SBDTips && !!document.getElementById('sbTipPop')), 'tips.js installed');
  const all = new Set();
  const take = async () => (await found(p)).forEach(k => all.add(k));
  for (const t of await p.$$eval('#inTabs [data-itab]', L => L.map(x => x.dataset.itab))) { await p.click(`#inTabs [data-itab="${t}"]`); await p.waitForTimeout(300); await take(); assert.equal(await dup(p), 0, `two buttons on a label (${t})`); }
  return { A, p, all, take };
}

const { A, p, all, take } = await run(1440, 1000);
try {
  const before = await saved(p);
  // states that draw the remaining inputs: rolled shape, deck design, rating vehicles and a permit, a diaphragm
  await p.click('#inTabs [data-itab="gird"]'); await p.selectOption('#rl_type', 'rolled'); await p.waitForTimeout(400); await take();
  await p.click('#inTabs [data-itab="xsec"]'); await p.selectOption('#dk_on', 'true'); await p.waitForTimeout(600); await take();
  await p.click('#tabBar [data-otab="rt"]'); await p.waitForTimeout(1500); await take();
  await p.selectOption('#rt_pk', { index: 1 }); await p.waitForTimeout(800); await take();
  await p.click('#inTabs [data-itab="framing"]'); await p.selectOption('[id="i_crossframes.type"]', 'w'); await p.waitForTimeout(600); await take();
  const T = await p.evaluate(() => window.SBDTips.TIPS.map(t => t.id || t.sel || t.after));
  const miss = T.filter(k => !all.has(k));
  assert.deepEqual(miss, [], `tips without a button: ${miss.join(', ')}`);
  assert.ok(T.length >= 40 && T.length <= 70, `${T.length} tips`);
  // undo the state changes (they are project inputs): reload the stored text from before
  await p.evaluate(t => { localStorage.setItem('sbd2.project.current', t); }, before); await p.reload(); await p.waitForSelector('#tabBar [data-otab="loads"]'); await p.waitForTimeout(1500);

  // 2-3. the Loads tab: hover, keyboard, tap
  await p.click('#inTabs [data-itab="loads"]'); await p.waitForTimeout(400);
  const lab = 'label[for="i_xs.lldf.skewVx"]', btn = `${lab} > .sbtip`, inp = '[id="i_xs.lldf.skewVx"]';
  assert.equal(await p.$eval(lab, l => l.textContent), 'Shear skew correction along the girder', 'label text unchanged by the button');
  assert.equal(await p.$eval(btn, b => b.textContent), '');
  const s0 = await saved(p), box0 = await p.$eval(inp, e => { const r = e.getBoundingClientRect(); return [r.x, r.y]; });
  await p.hover(btn); await p.waitForTimeout(150);
  assert.equal(await p.$eval('#sbTipPop', e => e.hidden), false, 'hover shows');
  const txt = await p.$eval('#sbTipPop', e => e.textContent);
  assert.match(txt, /Shear skew correction along the girder\./); assert.match(txt, /Default: Whole length/); assert.match(txt, /Reference: AASHTO LRFD 10th Ed\. Art\. 4\.6\.2\.2\.3c/);
  assert.deepEqual(await p.$eval(inp, e => { const r = e.getBoundingClientRect(); return [r.x, r.y]; }), box0, 'the input does not move while the tip shows');
  if (shotDir) { await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), lab); await p.hover(btn); await p.waitForTimeout(200);
    const r = await p.$eval(btn, b => { const q = b.getBoundingClientRect(), t = document.getElementById('sbTipPop').getBoundingClientRect(); return { x: Math.min(q.x, t.x) - 260, y: Math.min(q.y, t.y) - 30, x2: Math.max(q.right, t.right) + 20, y2: Math.max(q.bottom, t.bottom) + 20 }; });
    await p.screenshot({ path: path.join(shotDir, 'sb-tip-lldf-skew.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.x2 - Math.max(0, r.x), height: r.y2 - Math.max(0, r.y) } }); }
  await p.mouse.move(5, 5); await p.waitForTimeout(150);
  assert.equal(await p.$eval('#sbTipPop', e => e.hidden), true, 'mouse out hides');
  // keyboard
  await p.focus(inp); await p.keyboard.down('Shift'); await p.keyboard.press('Tab'); await p.keyboard.up('Shift');   // the button is just before the select
  assert.equal(await p.evaluate(() => document.activeElement.className), 'sbtip', 'the button is in the tab order');
  assert.equal(await p.$eval('#sbTipPop', e => e.hidden), false, 'focus shows');
  assert.equal(await p.$eval(btn, b => b.getAttribute('aria-expanded') + '|' + b.getAttribute('aria-describedby') + '|' + b.getAttribute('aria-label')), 'true|sbTipPop|Help: Shear skew correction along the girder');
  await p.keyboard.press('Escape'); assert.equal(await p.$eval('#sbTipPop', e => e.hidden), true, 'Escape hides');
  // tap: click pins, a second click hides; a click elsewhere hides
  await p.click(btn); await p.mouse.move(5, 5); await p.waitForTimeout(100); assert.equal(await p.$eval('#sbTipPop', e => e.hidden), false, 'click pins');
  assert.equal(await p.inputValue(inp), 'whole', 'the click does not change the input');
  await p.click(btn); assert.equal(await p.$eval('#sbTipPop', e => e.hidden), true, 'second click hides');
  await p.click(btn); await p.click('#inTabs [data-itab="loads"]'); assert.equal(await p.$eval('#sbTipPop', e => e.hidden), true, 'click elsewhere hides');
  assert.equal(await saved(p), s0, 'nothing saved by the tooltips');
  // a rating group heading (the vehicle check boxes are not toggled by the button)
  await p.click('#tabBar [data-otab="rt"]'); await p.waitForTimeout(1500);
  const vb = '.rt-vg:has([data-rtveh="Type3"]) .rt-vt > .sbtip';
  await p.click(vb); assert.match(await p.$eval('#sbTipPop', e => e.textContent), /AASHTO legal loads\..*MBE 4th Ed\. Arts\. 6A\.4\.4, 6A\.8\.3/);
  assert.equal(await p.$eval('[data-rtveh="Type3"]', e => e.checked), false);
  if (shotDir) { await p.evaluate(s => document.querySelector(s).scrollIntoView({ block: 'center' }), vb); await p.click(vb); await p.click(vb); await p.waitForTimeout(200);
    const r = await p.$eval(vb, b => { const q = b.getBoundingClientRect(), t = document.getElementById('sbTipPop').getBoundingClientRect(); return { x: Math.min(q.x, t.x) - 320, y: Math.min(q.y, t.y) - 30, x2: Math.max(q.right, t.right) + 20, y2: Math.max(q.bottom, t.bottom) + 20 }; });
    await p.screenshot({ path: path.join(shotDir, 'sb-tip-rating-legal.png'), clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: r.x2 - Math.max(0, r.x), height: r.y2 - Math.max(0, r.y) } }); }
  await p.keyboard.press('Escape');
  errs.push(...A.errs);
} finally { await A.b.close(); }

// phone width: the box stays in the window, no sideways scroll, a tap pins
{
  const B = await openPage(FILE, { vw: 390, vh: 844, dsf: 2 }), q = B.p;
  try {
    await q.waitForSelector('#tabBar [data-otab="loads"]'); await q.waitForTimeout(1500);
    await q.click('#inTabs [data-itab="fs"]'); await q.waitForTimeout(400);
    const b = 'label[for="i_fatigue.ADTT"] > .sbtip';
    await q.$eval(b, e => e.scrollIntoView({ block: 'center' })); await q.click(b); await q.waitForTimeout(150);
    const r = await q.$eval('#sbTipPop', e => { const x = e.getBoundingClientRect(); return { l: x.left, r: x.right, t: x.top, b: x.bottom, h: e.hidden, vw: document.documentElement.clientWidth, vh: document.documentElement.clientHeight }; });
    assert.equal(r.h, false, 'tap shows'); assert.ok(r.l >= 0 && r.r <= r.vw && r.t >= 0 && r.b <= r.vh, `box inside the window ${JSON.stringify(r)}`);
    assert.ok(await q.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1), 'no sideways scroll at 390 px');
    errs.push(...B.errs);
  } finally { await B.b.close(); }
}
assert.deepEqual(errs, [], errs.join('\n'));
console.log('ok   steel-bridge-tips: every listed input has its button, label text unchanged, hover / keyboard / tap, inside the window at 390 px, nothing saved; 0 console errors');
