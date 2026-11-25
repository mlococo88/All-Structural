#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html), GSUB (engineer, 2026-11-25): the Girders & strands input tab's sub-tabs (ui/girdsubs.js). Headless
// Chromium, file://, the CDN libraries from tests/libs. A new project (two girder types):
//   1. an old saved ui (psb2.ui without gsub): Girder types shown; the sub-tab row is a role=tablist of four role=tab buttons, one
//      aria-selected; a click and the arrow keys change the sub-tab, kept in psb2.ui (after a reload too), no other key written;
//   2. the scope choice ("Entered values for") above Section, Strands and Reinforcement, not on Girder types;
//   3. links from the output tabs: the Shear tab's stirrups link opens Reinforcement at the Shear reinforcement card; the Nomenclature's
//      n_h input link opens Strands with the draped-strand count focused; the Report's link to the tab (in:gird@…) opens its sub-tab;
//   4. an invalid field (splitting steel legs −1): the dot on the tab and on Reinforcement only; the input-check banner's link opens
//      Reinforcement with the field focused; fixed: no dot;
//   5. "Edit its inputs" (Girder types card): the type's scope, the Section sub-tab;
//   6. the strand pattern figure drawn on Strands; print hides the sub-tab row. 0 console errors.
//   node tests/smoke/ps-bridge-gsub.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const FILE = path.join(REPO, 'apps/ps-bridge/index.html');
const { b, p, errs } = await openPage(FILE, { vw: 1500, vh: 900, ls: { 'psb2.ui': JSON.stringify({ itab: 'gird', otab: 'sum' }) } });
const ready = () => p.waitForFunction(() => window.PSBGirdSubs && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 }).catch(e => { console.log('console errors:', errs); throw e; });
const sub = () => p.evaluate(() => { const s = document.querySelector('#gSubs [aria-selected="true"]'); return s ? s.dataset.gsub : null; });
const shown = () => p.evaluate(() => [...document.querySelectorAll('.gSub')].filter(e => !e.hidden).map(e => e.dataset.gsubpane).join());
const uiKey = () => p.evaluate(() => JSON.parse(localStorage.getItem('psb2.ui') || '{}').gsub);
const inView = sel => p.evaluate(s => { const e = document.querySelector(s), r = e && e.getBoundingClientRect(), q = document.getElementById('inputPanel').getBoundingClientRect(); return !!r && r.height > 0 && r.top >= q.top - 1 && r.top < q.bottom; }, sel);
try {
  await ready();
  // 1.
  assert.equal(await p.evaluate(() => document.querySelector('#inTabs [aria-selected="true"]').dataset.itab), 'gird');
  assert.equal(await sub(), 'types'); assert.equal(await shown(), 'types');
  const tl = await p.evaluate(() => { const r = document.getElementById('gSubs'); return { role: r.getAttribute('role'), tabs: [...r.querySelectorAll('[role="tab"]')].map(x => `${x.dataset.gsub}:${x.getAttribute('aria-selected')}:${x.getAttribute('aria-controls')}`) }; });
  assert.deepEqual(tl, { role: 'tablist', tabs: ['types:true:gsub_types', 'sec:false:gsub_sec', 'str:false:gsub_str', 'reinf:false:gsub_reinf'] });
  assert.ok(await p.isVisible('#card-types') && !(await p.isVisible('#card-shape')));
  ok('an old saved ui (no gsub): Girder types shown; a role=tablist of four role=tab buttons, aria-selected and aria-controls');
  const keys0 = await p.evaluate(() => Object.keys(localStorage).sort());
  await p.click('#gSubs [data-gsub="sec"]'); assert.equal(await sub(), 'sec'); assert.equal(await shown(), 'sec'); assert.equal(await uiKey(), 'sec');
  await p.focus('#gSubs [data-gsub="sec"]'); await p.keyboard.press('ArrowRight'); assert.equal(await sub(), 'str');
  assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.dataset.gsub), 'str', 'focus follows the arrow key');
  await p.keyboard.press('End'); assert.equal(await sub(), 'reinf'); await p.keyboard.press('ArrowRight'); assert.equal(await sub(), 'types'); await p.keyboard.press('ArrowLeft'); assert.equal(await sub(), 'reinf');
  await p.reload(); await ready(); assert.equal(await sub(), 'reinf'); assert.equal(await shown(), 'reinf');
  assert.deepEqual(await p.evaluate(() => Object.keys(localStorage).sort()), keys0, 'no new storage key');
  ok('click, arrow keys, Home/End: the sub-tab changes; kept in psb2.ui (gsub) after a reload; no new storage key');
  // 2.
  for (const k of ['types', 'sec', 'str', 'reinf']) { await p.click(`#gSubs [data-gsub="${k}"]`); assert.equal(await p.isVisible('#tyScope_gird'), k !== 'types', k); }
  ok('"Entered values for" above Section, Strands and Reinforcement, not on Girder types');
  // 3. links from the output tabs
  await p.click('#gSubs [data-gsub="types"]');
  await p.click('#tabBar [data-otab="shear"]'); await p.waitForSelector('#out a[data-goin="gird@card-stirrups"]');
  await p.click('#out a[data-goin="gird@card-stirrups"]'); await p.waitForTimeout(300);
  assert.equal(await sub(), 'reinf'); assert.ok(await inView('#card-stirrups'), 'the stirrups card scrolled into view');
  ok('Shear tab: the stirrups link opens Reinforcement at the Shear reinforcement card');
  await p.click('#gSubs [data-gsub="sec"]');
  await p.click('#tabBar [data-otab="nom"]'); await p.waitForSelector('#out a[data-goin="gird@base.harp.n"]');
  await p.click('#out a[data-goin="gird@base.harp.n"]'); await p.waitForTimeout(300);
  assert.equal(await sub(), 'str'); assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.dataset.path), 'base.harp.n');
  ok('Nomenclature: the n_h input link opens Strands with the draped-strand count focused');
  await p.click('#gSubs [data-gsub="types"]');
  await p.click('#tabBar [data-otab="rpt"]'); await p.waitForSelector('.rp-doc .rp-step', { timeout: 90000 });
  const rk = await p.evaluate(() => [...document.querySelectorAll('.rp-doc [data-rpgoto^="in:gird"]')].map(a => a.dataset.rpgoto));
  assert.ok(rk.length && rk.every(k => /^in:gird@./.test(k)), 'the Report\'s links name their target: ' + [...new Set(rk)].join(' '));
  const want = await p.evaluate(k => PSBGirdSubs.subOf(PSBGirdSubs.parse(k.slice(3)).target), rk.find(k => !/types/.test(k)) || rk[0]);
  await p.click(`.rp-doc [data-rpgoto="${rk.find(k => !/types/.test(k)) || rk[0]}"]`); await p.waitForTimeout(300);
  assert.equal(await sub(), want);
  ok(`Report: ${rk.length} links to the tab, each with its target; one opens ${want}`);
  // 4. an invalid field
  await p.click('#tabBar [data-otab="sum"]'); await p.click('#gSubs [data-gsub="reinf"]');
  await p.fill('[data-path="base.opt.splitN"]', '-1'); await p.press('[data-path="base.opt.splitN"]', 'Tab'); await p.waitForTimeout(400);
  const dots = await p.evaluate(() => ({ tab: document.querySelector('#inTabs [data-itab="gird"] .inDot').textContent, subs: [...document.querySelectorAll('#gSubs [data-gsub]')].map(x => `${x.dataset.gsub}:${x.classList.contains('has-err') ? x.querySelector('.inDot').textContent : ''}`) }));
  assert.deepEqual(dots, { tab: '1', subs: ['types:', 'sec:', 'str:', 'reinf:1'] });
  assert.ok(await p.evaluate(() => getComputedStyle(document.querySelector('#gSubs [data-gsub="reinf"] .inDot')).display !== 'none'), 'the dot shown');
  await p.click('#gSubs [data-gsub="types"]'); await p.waitForSelector('#icBanner a[data-icgo]');
  await p.click('#icBanner a[data-icgo]'); await p.waitForTimeout(300);
  assert.equal(await sub(), 'reinf'); assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.dataset.path), 'base.opt.splitN');
  if (shots) await p.screenshot({ path: path.join(shots, 'gsub-error-dot.png') });
  await p.fill('[data-path="base.opt.splitN"]', '4'); await p.press('[data-path="base.opt.splitN"]', 'Tab'); await p.waitForTimeout(400);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#gSubs .has-err').length), 0);
  ok('an invalid field: the dot on the tab and on Reinforcement only (1); the banner link opens Reinforcement, the field focused; fixed: no dot');
  // 5. "Edit its inputs"
  await p.click('#gSubs [data-gsub="types"]'); await p.click('#card-types [data-ty="edit"][data-k="1"]'); await p.waitForTimeout(300);
  assert.equal(await sub(), 'sec'); assert.equal(await p.inputValue('#tyScope_gird'), await p.evaluate(() => PSBModel.load(localStorage).project.types[1].id));
  ok('"Edit its inputs": the type in scope, its inputs from the Section sub-tab');
  await p.selectOption('#tyScope_gird', '');
  // 6. the strand pattern on Strands; print
  await p.click('#gSubs [data-gsub="str"]'); await p.waitForSelector('#gfx_strands_in svg'); await p.waitForSelector('#strandEditHost svg');
  await p.emulateMedia({ media: 'print' }); assert.equal(await p.evaluate(() => getComputedStyle(document.getElementById('gSubs')).display), 'none'); await p.emulateMedia({ media: 'screen' });
  ok('Strands: the strand pattern and the strand editor drawn; print hides the sub-tab row');
  assert.deepEqual(errs, []); ok('0 console errors');
} finally { await b.close(); }
console.log(`\nps-bridge-gsub: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
