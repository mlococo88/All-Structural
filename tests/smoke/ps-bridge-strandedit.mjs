#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch G5 (2026-11-15), headless Chromium, file://: strand editing by clicking the section (Girders &
//   strands tab, "Edit strands on the section"): a strand clicked opens its row; debond → the table's n_d and length; Undo puts it back;
//   "+ Add strands" shows grid slots, one clicked adds a strand to that row; a move refused when it would not fit (message, nothing changed);
//   the edit log lists the edits; "↺ Revert strand edits" puts the rows back as before the first edit (one Undo step); the table's
//   "Clear debonding on this row" sets n_d and the length to 0 in one click. 0 console errors.
//   node tests/smoke/ps-bridge-strandedit.mjs [--shots <dir>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const { b, p, errs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
const rows = () => p.evaluate(() => PSBModel.load(localStorage).project.base.rows.map(r => ({ n: r.n, y: r.y, nd: r.nd, dbnd: r.dbnd })));
p.on('dialog', d => d.accept());
try {
  await p.waitForFunction(() => window.PSBStrandEdit && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await p.click('#inTabs [data-itab="gird"]'); await p.waitForSelector('#strandEditHost svg');
  const r0 = await rows(), i0 = r0.findIndex(r => r.y === 2);
  await p.click(`#strandEditHost circle[data-se="pick"][data-ri="${i0}"]`); await p.waitForSelector('#seRow');
  assert.match(await p.textContent('#seRow'), new RegExp(`Row ${i0 + 1}: ${r0[i0].n} strands at y = 2 in`)); ok('a strand clicked: its row opens');
  if (shots) await p.locator('#card-strandEdit').screenshot({ path: path.join(shots, 'G5-row-selected.png') });
  await p.click('#seRow [data-se="debond"]'); await p.waitForTimeout(400);
  let r1 = await rows(); assert.equal(r1[i0].nd, 1); assert.equal(r1[i0].dbnd, Math.round(0.1 * (await p.evaluate(() => PSBDesign.inputs(PSBModel.load(localStorage).project).L))));
  assert.equal(await p.inputValue(`#inPanes [data-path="base.rows.${i0}.nd"]`), '1'); assert.ok(await p.isEnabled('#bUndo'));
  ok(`debond: n_d 1, length ${r1[i0].dbnd} ft (10 % L) in the table; Undo enabled`);
  await p.click('#bUndo'); await p.waitForTimeout(400); assert.deepEqual(await rows(), r0); ok('Undo: the rows as before');
  await p.click('#strandEditHost [data-se="mode"]'); await p.waitForSelector('#strandEditHost circle[data-se="add"]');
  const sl = await p.$$eval('#strandEditHost circle[data-se="add"]', c => c.map(x => +x.dataset.y));
  const yAdd = sl[0], iA = r0.findIndex(r => r.y === yAdd);
  if (shots) await p.locator('#card-strandEdit').screenshot({ path: path.join(shots, 'G5-add-mode.png') });
  await p.click(`#strandEditHost circle[data-se="add"][data-y="${yAdd}"]`); await p.waitForTimeout(400);
  r1 = await rows(); assert.equal(iA >= 0 ? r1[iA].n : r1.find(r => r.y === yAdd).n, iA >= 0 ? r0[iA].n + 1 : 1);
  ok(`+ Add strands: ${sl.length} slots (y = ${[...new Set(sl)].join(', ')} in); one clicked adds a strand at y = ${yAdd} in`);
  // a move refused: the bottom row down to 1 in puts strands within 2 in of the soffit
  await p.click(`#strandEditHost circle[data-se="pick"][data-ri="${i0}"]`); await p.waitForSelector('#seRow');
  const before = JSON.stringify(await rows()); await p.click('#seRow [data-se="down"]'); await p.waitForSelector('#seErr');
  assert.match(await p.textContent('#seErr'), /Not changed: moved the row to y = 1 in would put a strand outside the input check's strand fit/); assert.equal(JSON.stringify(await rows()), before);
  ok('a move that would not fit: refused with the reason, nothing changed');
  assert.match(await p.textContent('#seLog'), /Strand edits from the graphic \(1\)[\s\S]*Added 1 strand at y = /); ok('the edit log lists the edit');
  await p.click('#strandEditHost [data-se="revert"]'); await p.waitForTimeout(400);
  assert.deepEqual(await rows(), r0); ok('↺ Revert strand edits: the rows as before the first edit');
  if (shots) await p.locator('#card-strandEdit').screenshot({ path: path.join(shots, 'G5-reverted.png') });
  await p.click('#bUndo'); await p.waitForTimeout(400); assert.notDeepEqual(await rows(), r0); ok('the revert is one Undo step');
  // the table's Clear debonding button
  await p.fill(`#inPanes [data-path="base.rows.${i0}.nd"]`, '2'); await p.press(`#inPanes [data-path="base.rows.${i0}.nd"]`, 'Tab');
  await p.fill(`#inPanes [data-path="base.rows.${i0}.dbnd"]`, '10'); await p.press(`#inPanes [data-path="base.rows.${i0}.dbnd"]`, 'Tab'); await p.waitForTimeout(300);
  await p.click(`#inPanes [data-act="clrdb"][data-i="${i0}"]`); await p.waitForTimeout(400);
  r1 = await rows(); assert.equal(r1[i0].nd, 0); assert.equal(r1[i0].dbnd, 0); ok('"Clear debonding on this row": n_d and the length 0 in one click');
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-strandedit: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
