#!/usr/bin/env node
// Steel Bridge Design (apps/steel-bridge/index.html), NOM (2026-11-23; the Prestressed Bridge app's Nomenclature tab), display only.
// Headless Chromium, file://:
//   1. the Nomenclature tab runs by itself when opened: the symbols of the worked steps of the girder shown, by module (13 groups),
//      each row: symbol (KaTeX), description, value, unit, article, a § link; 0 KaTeX errors; a check is not listed;
//   2. values are the tabs' own: the modular ratio n and the Inventory rating factor equal the Section properties / Rating tabs' values;
//   3. the search box filters by symbol, description, unit and article; "+ n more" lists every use;
//   4. a § link opens the output tab that works the symbol;
//   5. another girder type: the list is rebuilt for it; an input change marks it out of date and it runs again;
//   6. 390 px: no sideways page scroll;
//   7. FOOT: the page footer (name, design code, units; the design-aid statement); 0 console errors.
//   node tests/smoke/steel-bridge-nomen.mjs
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'apps/steel-bridge/index.html'), t0 = Date.now(), SHOT = process.env.SBD_SHOT_DIR || '';
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const { b, p, errs } = await openPage(FILE, { vw: 1400, vh: 1000, ...(SHOT ? { dsf: 2 } : {}) });
try {
  await p.waitForFunction(() => window.SBDNomenUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 20, null, { timeout: 120000 });
  const otab = async t => { await p.evaluate(t => document.querySelector(`#tabBar [data-otab="${t}"]`).click(), t); await p.waitForTimeout(200); };
  const itab = t => p.evaluate(t => document.querySelector(`#inTabs [data-itab="${t}"]`).click(), t);
  const ready = () => p.waitForFunction(() => { const q = document.querySelector('#out #nm_q'), a = document.querySelector('#out .alert.stale'); return q && a && a.hidden; }, null, { timeout: 400000 });
  const rows = () => p.evaluate(() => [...document.querySelectorAll('#out tr[data-nm]')].map(t => { const c = t.children, a = c[0].querySelector('annotation'); return { grp: t.closest('[data-nmgrp]').dataset.nmgrp, sym: a ? a.textContent : c[0].textContent, desc: c[1].textContent, val: c[2].textContent, unit: c[3].textContent, art: c[4].textContent, go: c[5].querySelector('a').dataset.nmgo, more: !!c[1].querySelector('details') }; }));
  const count = () => p.locator('#nm_n').innerText();
  const search = async q => { await p.fill('#nm_q', q); await p.waitForTimeout(150); };

  // 1. the tab runs by itself
  assert.equal(await p.locator('#tabBar [data-otab="nm"]').innerText(), 'Nomenclature');
  await otab('nm'); await ready();
  let R = await rows(); const tot = R.length;
  assert.ok(tot > 250, `${tot} symbols`); assert.equal(await count(), `${tot} of ${tot} symbols`);
  const grps = [...new Set(R.map(r => r.grp))]; assert.deepEqual(grps, ['proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'frm', 'spl', 'wd', 'rt']);
  assert.equal(await p.evaluate(() => document.querySelectorAll('#out .katex-error').length), 0); assert.ok(await p.evaluate(() => document.querySelectorAll('#out tr[data-nm] td.nm-s .katex').length) >= tot);
  R.forEach(r => { assert.ok(!/\\(le|ge|frac|text)\b|[=<>]/.test(r.sym), r.sym); assert.ok(r.desc.length > 2, r.sym); assert.ok(r.val.length > 0); });
  assert.ok(R.filter(r => r.art).length > tot * 0.6, 'most rows cite an article'); assert.ok(R.some(r => /^MBE /.test(r.art)));
  await p.screenshot({ path: SHOT ? path.join(SHOT, 'steel-nomen-1-tab.png') : undefined }).catch(() => {});
  ok(`Nomenclature tab: runs when opened; ${tot} symbols in ${grps.length} modules, each with description, value, unit, article and a § link; 0 KaTeX errors; no check listed`);

  // 2. the tabs' own values
  const nRow = R.find(r => r.grp === 'sec' && r.sym === 'n') || R.find(r => r.sym === 'n'), rf = R.find(r => r.grp === 'rt' && r.sym === 'RF_{inv}');
  assert.ok(nRow && rf, 'n and RF_inv listed');
  await otab('rt'); await p.waitForFunction(() => { const a = document.querySelector('#out .alert.stale'); return a && a.hidden && /Inventory/.test(document.getElementById('out').innerText); }, null, { timeout: 300000 });
  const rtTxt = await p.locator('#out').innerText(); assert.ok(rtTxt.includes(rf.val), `the Rating tab shows RF ${rf.val}`);
  await otab('sec'); await p.waitForFunction(() => { const a = document.querySelector('#out .alert.stale'); return a && a.hidden; }, null, { timeout: 120000 });
  const secTxt = await p.locator('#out').innerText(); assert.ok(secTxt.includes(nRow.val), `the Section properties tab shows n = ${nRow.val}`);
  ok(`values are the tabs' own: n = ${nRow.val} (Section properties tab), RF_inv = ${rf.val} (Rating tab)`);

  // 3. search; + n more
  await otab('nm'); await ready();
  await search('6.10.9'); let S1 = await rows(); assert.ok(S1.length >= 3 && S1.length < tot / 4, `${S1.length}`); assert.equal(await count(), `${S1.length} of ${tot} symbols`);
  await search('D_c'); const S2 = await rows(); assert.ok(S2.length >= 1); assert.ok(S2.some(r => r.sym === 'D_{c}'));
  await search('kip-ft'); const S3 = await rows(); assert.ok(S3.length >= 5 && S3.every(r => /kip-ft/.test(r.unit + r.desc + r.art) || r.more), 'by unit');
  await search('no-such-symbol-xyz'); assert.equal((await rows()).length, 0); assert.match(await p.locator('#nm_list').innerText(), /No symbol matches/);
  await search('moment of inertia'); const S4 = await rows(); assert.ok(S4.length >= 1, 'by description');
  await search(''); assert.equal((await rows()).length, tot);
  const more = await p.evaluate(() => { const d = document.querySelector('#out tr[data-nm] details'); d.open = true; return { sum: d.querySelector('summary').textContent, n: d.querySelectorAll('li').length }; });
  assert.match(more.sum, /^\+ \d+ more in /); assert.ok(more.n >= 1);
  await p.locator('#out [data-nmgrp="flex"]').first().scrollIntoViewIfNeeded(); await p.waitForTimeout(200);
  if (SHOT) await p.screenshot({ path: path.join(SHOT, 'steel-nomen-2-flexure.png') });
  await search('6.10.9'); if (SHOT) { await p.evaluate(() => { document.getElementById('outputPanel').scrollTop = 0; }); await p.screenshot({ path: path.join(SHOT, 'steel-nomen-3-search.png') }); }
  ok(`search: "6.10.9" ${S1.length}, "D_c" ${S2.length}, "kip-ft" ${S3.length}, "moment of inertia" ${S4.length} of ${tot}; none: "No symbol matches"; "${more.sum}" lists ${more.n} uses`);

  // 4. a § link opens the tab
  await search('D_c');
  const go = await p.evaluate(() => { const a = document.querySelector('#out [data-nmgrp="flex"] a[data-nmgo]'); const t = a.textContent; a.click(); return t; });
  await p.waitForTimeout(300); assert.equal(go, '§ Flexure'); assert.equal(await p.evaluate(() => document.querySelector('#tabBar [aria-selected="true"]').dataset.otab), 'flex');
  ok('"§ Flexure" of a Flexure symbol opens the Flexure tab');

  // 5. another girder type; an input change
  await otab('nm'); await ready(); await search('');
  const g0 = await p.evaluate(() => document.querySelector('#out .note b').textContent);
  await p.selectOption('#o_gt', { index: 1 }); await ready();
  const g1 = await p.evaluate(() => document.querySelector('#out .note b').textContent); assert.notEqual(g1, g0);
  const R2 = await rows(); assert.ok(R2.length > 250);
  await itab('xsec'); await p.evaluate(() => { const el = document.querySelector('[id="i_deck.haunch"]'); el.value = String(+el.value + 0.5); el.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(100); await ready();
  ok(`girder type ${g0} -> ${g1}: the list is rebuilt (${R2.length} symbols); haunch + 0.5 in: out of date, runs again`);

  // 6. phone
  await p.setViewportSize({ width: 390, height: 800 }); await otab('nm'); await ready(); await p.waitForTimeout(300);
  const ph = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, w: document.documentElement.clientWidth, rows: document.querySelectorAll('#out tr[data-nm]').length }));
  assert.ok(ph.sw <= ph.w + 1, `no sideways page scroll at 390 px: ${JSON.stringify(ph)}`); assert.ok(ph.rows > 250);
  if (SHOT) { await p.evaluate(() => document.querySelector('#out #nm_q').scrollIntoView()); await p.screenshot({ path: path.join(SHOT, 'steel-nomen-4-phone.png') }); }
  ok('390 px: the tab is drawn, no sideways page scroll (each table scrolls in its own frame)');

  // 7. FOOT: the footer (name, code, units; the design-aid statement), inside the page at both widths
  const ft = async () => p.evaluate(() => { const f = document.getElementById('appFoot'), r = f.getBoundingClientRect(); return { t: f.innerText.replace(/\s+/g, ' '), in: r.left >= 0 && r.right <= document.documentElement.clientWidth + 1, h: Math.round(r.height) }; });
  const f1 = await ft(); await p.setViewportSize({ width: 1400, height: 1000 }); await p.waitForTimeout(200); const f2 = await ft();
  for (const f of [f1, f2]) { assert.match(f.t, /STEEL BRIDGE DESIGN · AASHTO LRFD 10TH ED\. \(2024\).*UNITS: KIP, FT, IN, KSI/i); assert.match(f.t, /DESIGN AID — INDEPENDENT VERIFICATION BY A LICENSED ENGINEER REQUIRED/i); assert.ok(f.in); }
  assert.ok(f2.h <= 30, `one line at 1400 px (${f2.h} px)`);
  assert.equal(await p.evaluate(() => { const o = document.getElementById('outputPanel').getBoundingClientRect(), f = document.getElementById('appFoot').getBoundingClientRect(); return o.bottom <= f.top + 1; }), true, 'the panels end above the footer');
  ok(`footer: "${f2.t.slice(0, 60)}…", ${f2.h} px at 1400 px, ${f1.h} px at 390 px, below the panels`);

  assert.deepEqual(errs, [], 'console / page errors');
  console.log(`\n${n} checks passed, 0 console errors (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
