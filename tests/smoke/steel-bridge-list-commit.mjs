#!/usr/bin/env node
// Browser smoke test: a list-table edit committed by clicking an input tab is kept (SBLC, 2026-11-14; the race fixed in the PS Bridge
// app's copy of ui/lists.js by PR #1548). apps/steel-bridge/index.html with the built-in project, headless Chromium (tests/lib.mjs openPage):
//   1. Bridge layout tab: span 1 typed into its row, then (a) a click on another input tab straight from the cell, (b) Tab out of the cell
//      and a click on another input tab: the saved spans.lengths holds the new value (before the fix it was lost);
//   2. Cross-section tab: a girder spacing typed into its row, then a click on another input tab: saved xs.bays holds it;
//   3. the plain case (the focus leaves the table to another input of the same tab) still commits once; 0 console errors.
//   node tests/smoke/steel-bridge-list-commit.mjs [--file <html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const av = process.argv.slice(2), fi = av.indexOf('--file');
const FILE = fi >= 0 ? path.resolve(av[fi + 1]) : path.join(REPO, 'apps/steel-bridge/index.html');
const saved = async p => { const P = await p.evaluate(() => JSON.parse(localStorage.getItem('sbd2.project.current') || '{}')); P.spans = P.spans || {}; P.xs = P.xs || {}; P.spans.lengths = P.spans.lengths || []; P.xs.bays = P.xs.bays || []; return P; };   // nothing saved yet: empty lists
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const cellSel = (id, r) => `#inPanes [id="${id}"] + [data-sli="host"] tr[data-sli-r="${r}"] input.sli-in`;

const A = await openPage(FILE, { vw: 1440, vh: 1000 });
try {
  const p = A.p;
  await p.waitForSelector('#inTabs [data-itab="layout"]');
  const tab = async k => { await p.click(`#inTabs [data-itab="${k}"]`); await p.waitForTimeout(400); };
  await tab('layout');
  const L0 = (await p.inputValue('#inPanes #i_spans')).split(/[,;\s]+/).filter(Boolean).map(Number);
  console.log('built-in spans', JSON.stringify(L0));
  // 1a. type, then click another input tab straight from the cell
  let c = await p.waitForSelector(cellSel('i_spans', 0)); await c.fill('111'); await tab('xsec'); await p.waitForTimeout(300);
  let P = await saved(p); ok(P.spans.lengths[0] === 111, `1a. span 1 typed, input tab clicked: saved ${JSON.stringify(P.spans.lengths)}`);
  // 1b. type, Tab out of the cell, then click another input tab
  await tab('layout'); c = await p.waitForSelector(cellSel('i_spans', 0)); await c.fill('112'); await c.press('Tab'); await tab('xsec'); await p.waitForTimeout(300);
  P = await saved(p); ok(P.spans.lengths[0] === 112, `1b. span 1 typed, Tab, input tab clicked: saved ${JSON.stringify(P.spans.lengths)}`);
  // 2. a bay on the Cross-section tab, then click another input tab
  c = await p.waitForSelector(cellSel('i_xs.bays', 1)); await c.fill('9.25'); await tab('layout'); await p.waitForTimeout(300);
  P = await saved(p); ok(P.xs.bays[1] === 9.25, `2. bay 2 typed, input tab clicked: saved ${JSON.stringify(P.xs.bays)}`);
  // 3. the plain case: the focus leaves to another input on the same tab
  await tab('layout'); c = await p.waitForSelector(cellSel('i_spans', 0)); await c.fill('113');
  await p.focus('#inPanes [id="i_spans.continuity"]'); await p.waitForTimeout(500);
  P = await saved(p); ok(P.spans.lengths[0] === 113, `3. span 1 typed, focus to another input: saved ${JSON.stringify(P.spans.lengths)}`);
  ok(JSON.stringify(P.spans.lengths.slice(1)) === JSON.stringify(L0.slice(1)), `other spans unchanged ${JSON.stringify(P.spans.lengths)}`);
  ok(A.errs.length === 0, `console errors: ${A.errs.slice(0, 3).join(' | ')}`);
} finally { await A.b.close(); }
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
