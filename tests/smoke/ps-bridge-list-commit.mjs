#!/usr/bin/env node
// Browser smoke test: a list-table edit of the PS Bridge app is committed before another click or change redraws the page (PSLT,
// 2026-11-15; the Steel Bridge app's copy of ui/lists.js has the same fix, PR #1568). apps/ps-bridge/index.html, new project, headless Chromium:
//   1. Bridge layout tab: span 1 typed into its row, then a click on another input tab: saved spans.lengths holds it (PR #1548's case);
//   2. Cross-section tab: bay 1 typed into its row, then "Girder spacing" changed to Equal (no blur first): the girder spacing list is not
//      drawn in Equal mode, so the edit has no input of the same id after the redraw. W_cc = Σ bays must include the typed bay (before: lost);
//   3. Bridge layout tab: a skew typed, then a click on the Undo button: the edit is committed as its own step first and Undo takes it
//      back (the list shows the old skew again, Redo brings the typed one). Before: Undo took back the step before (the spacing change of
//      2) and the deferred commit then wrote the skew after it; 0 console errors.
//   node tests/smoke/ps-bridge-list-commit.mjs [--file <html>]
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const av = process.argv.slice(2), fi = av.indexOf('--file');
const FILE = fi >= 0 ? path.resolve(av[fi + 1]) : path.join(REPO, 'apps/ps-bridge/index.html');
const saved = p => p.evaluate(() => JSON.parse(localStorage.getItem('psb2.project.current') || '{}'));
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL ' + m); } else console.log('  ok   ' + m); };
const cellSel = (id, r) => `#inPanes [id="${id}"] + [data-sli="host"] tr[data-sli-r="${r}"] input.sli-in`;

const A = await openPage(FILE, { vw: 1440, vh: 1000 });
try {
  const p = A.p;
  await p.waitForSelector('#inTabs [data-itab="layout"]'); await p.waitForTimeout(1000);
  const tab = async k => { await p.click(`#inTabs [data-itab="${k}"]`); await p.waitForTimeout(400); };
  // 1. a span, then a click on another input tab
  await tab('layout');
  const L0 = (await p.inputValue('#inPanes [id="i_spans.lengths"]')).split(/[,;\s]+/).filter(Boolean).map(Number);
  console.log('spans', JSON.stringify(L0));
  await (await p.waitForSelector(cellSel('i_spans.lengths', 0))).fill(String(L0[0] + 1)); await tab('xsec'); await p.waitForTimeout(300);
  let P = await saved(p); ok((P.spans || {}).lengths && P.spans.lengths[0] === L0[0] + 1, `1. span 1 typed, input tab clicked: saved ${JSON.stringify((P.spans || {}).lengths)}`);
  // 2. a bay, then Girder spacing -> Equal (the bay list is not drawn in Equal mode)
  const B0 = (await p.inputValue('#inPanes [id="i_xs.bays"]')).split(/[,;\s]+/).filter(Boolean).map(Number);
  console.log('bays', JSON.stringify(B0));
  await (await p.waitForSelector(cellSel('i_xs.bays', 0))).fill(String(B0[0] + 0.5));
  await p.selectOption('#inPanes [id="i_xs.spMode"]', 'equal'); await p.waitForTimeout(600);
  P = await saved(p); const want = Math.round((B0.reduce((a, b) => a + b, 0) + 0.5) * 1e6) / 1e6;
  ok(P.xs.spMode === 'equal' && P.xs.Wcc === want, `2. bay 1 typed, spacing set to Equal: saved W_cc ${P.xs.Wcc} (Σ bays with the typed one: ${want})`);
  // 3. a skew, then Undo
  await tab('layout');
  const K0 = await p.inputValue('#inPanes [id="i_xs.skews"]');
  await (await p.waitForSelector(cellSel('i_xs.skews', 0))).fill('12'); await p.click('#bUndo'); await p.waitForTimeout(600);
  P = await saved(p); const K1 = await p.inputValue('#inPanes [id="i_xs.skews"]');
  ok(K1 === K0 && JSON.stringify(P.xs.skews) === JSON.stringify(K0.split(/[,;\s]+/).filter(Boolean).map(Number)), `3. skew typed, Undo clicked: the old skews again "${K1}" (saved ${JSON.stringify(P.xs.skews)})`);
  const canRedo = !(await p.$eval('#bRedo', x => x.disabled));
  if (canRedo) { await p.click('#bRedo'); await p.waitForTimeout(600); } P = await saved(p);
  ok(canRedo && P.xs.skews[0] === 12, `3. Redo${canRedo ? '' : ' (disabled)'}: the typed skew ${JSON.stringify(P.xs.skews)}`);
  ok(A.errs.length === 0, `console errors: ${A.errs.slice(0, 3).join(' | ')}`);
} finally { await A.b.close(); }
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
