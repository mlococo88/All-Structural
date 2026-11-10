#!/usr/bin/env node
// Abutment calculator: reaction matrix Table view, panel I-5 (ABRT, 2026-11-10; display and entry only).
//   node tests/smoke/abutment-rx-table.mjs [file] [--shots dir]   (default: abutment_calculator.html in this tree)
// 1. Default view is the existing per-load-type view; the toggle switches to Table and the choice is kept (abutcalc_rxEntry_v1) over a reload.
// 2. Table layout: one row per girder (G1…GN), 12 columns in RX_CELLS order, units (kip) in the header, Σ row.
// 3. Typing a cell writes S.rx, updates Σ, and the per-load-type view shows it; an edit there shows in the Table.
// 4. Paste a 5 × 12 block (tab-separated) at G1 DC P and a 2 × 3 CSV block mid-table: values land in S.rx.
// 5. Invalid pastes are rejected with nothing changed: text, blank cell, too many rows, too many columns, over a calculated column.
// 6. Invalid typed text marks the cell bad (class bad, aria-invalid) and the input tab, and S is unchanged.
// 7. Arrow / Enter / Tab navigation; Copy table gives the TSV.
// 8. Same results: the input fingerprint and the dashboard D/C values after table entry equal those after entering the same values
//    through the per-load-type view (data-path inputs) in a fresh page.
// 9. A saved project (autosave seeded) opens with the same state and the same fingerprint as on main's file.
// 10. Pull from SubLoads (Bridge Substructure Loading "Send to Abutment Calculator", same browser storage) fills S.rx and the Table shows it.
// 11. 390 px: no horizontal page scroll; the table scrolls inside its wrapper. 0 console errors.
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { openPage, REPO } from '../lib.mjs';

const args = process.argv.slice(2);
const shotsAt = args.indexOf('--shots'); const SHOTS = shotsAt >= 0 ? args[shotsAt + 1] : null;
const pos = args.filter((a, i) => !a.startsWith('--') && (shotsAt < 0 || i !== shotsAt + 1));
const FILE = path.resolve(REPO, pos[0] || 'abutment_calculator.html');
let fails = 0;
const check = (ok, msg) => { console.log((ok ? 'ok   ' : 'FAIL ') + msg); if (!ok) fails++; };
const ready = p => p.waitForFunction(() => window.LAST_R, null, { timeout: 60000 });
const settle = async p => { await p.waitForTimeout(500); await p.evaluate(() => recalcAll()); };
const allErrs = [];
const results = () => ({ fp: LAST_R.fingerprint, dash: LAST_R.dash.map(d => [d.name, d.dc]) });
const toTable = async p => { await p.click('#abutInTab_gird'); await p.waitForTimeout(150);
  if (await p.$('#rxGrid') === null) await p.click('[data-rxmode="table"]'); await p.waitForSelector('#rxGrid'); };

// a 5 × 12 block (DC P … WL Vy), distinct values
const BLOCK = [...Array(5)].map((_, i) => [80 + i, 11 + i, 60 + 2 * i, 3.25, 2.5 + i / 10, 1.5, 4, 1.25, 2.5, -1.5, 0.5, 1 + i]);
const TSV = BLOCK.map(r => r.join('\t')).join('\n') + '\n';
const firePaste = (p, sel, text) => p.evaluate(([s, t]) => { const el = document.querySelector(s); el.focus();
  const dt = new DataTransfer(); dt.setData('text/plain', t); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true }));
  return document.getElementById('rxgMsg').textContent; }, [sel, text]);
const cellSel = (r, c) => `#rxGrid input[data-r="${r}"][data-c="${c}"]`;

// ---- 1-7
{
  const o = await openPage(FILE, { vw: 1440, vh: 900 }); const p = o.p; await ready(p);
  await p.click('#abutInTab_gird'); await p.waitForTimeout(150);
  check(await p.$('#rxGrid') === null && await p.$('select[data-path="ui.rxView"]') !== null, 'default view: the existing per-load-type view');
  await p.click('[data-rxmode="table"]'); await p.waitForSelector('#rxGrid');
  check(await p.evaluate(() => localStorage.getItem('abutcalc_rxEntry_v1')) === 'table', 'view choice kept under abutcalc_rxEntry_v1');
  await p.reload(); await ready(p); await p.click('#abutInTab_gird'); await p.waitForTimeout(150);
  check(await p.$('#rxGrid') !== null, 'Table view restored after a reload');
  if (SHOTS) { await p.evaluate(() => document.getElementById('rxGrid').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    await p.locator('.panel[data-cid="in-beams"]').screenshot({ path: path.join(SHOTS, 'table-1440-panel.png') }); await p.screenshot({ path: path.join(SHOTS, 'table-1440.png') }); }

  const L = await p.evaluate(() => { const g = document.getElementById('rxGrid');
    return { rows: g.querySelectorAll('tbody tr').length, N: S.beams.N, labels: [...g.querySelectorAll('tbody th')].map(t => t.textContent),
      cols: g.querySelectorAll('thead tr:nth-child(2) th').length, units: [...g.querySelectorAll('thead tr:nth-child(2) th')].every(t => /\(kip\)/.test(t.textContent)),
      groups: [...g.querySelectorAll('thead tr:first-child th')].map(t => t.textContent), sum: !!g.querySelector('tfoot [data-rxsum]'),
      inner: getComputedStyle(g.parentElement).overflowX === 'auto', page: document.documentElement.scrollWidth <= innerWidth,
      sticky: getComputedStyle(g.querySelector('tbody th')).position === 'sticky' }; });
  check(L.rows === L.N && L.labels.join() === [...Array(L.N)].map((_, i) => 'G' + (i + 1)).join(), `one row per girder G1…G${L.N}`);
  check(L.cols === 12 && L.units, '12 load-type columns with units (kip) in the header');
  check(L.groups.join('|') === 'Girder|DC|DW|LL+IM|BR|TU|CR/SH|WS|WL', `load-type header groups (${L.groups.join('|')})`);
  check(L.sum, 'Σ row present');
  check(L.inner && L.page && L.sticky, '1440 px: the table scrolls sideways inside its wrapper only, girder labels sticky');

  // 3. typing
  await p.click(cellSel(1, 0)); await p.keyboard.type('91.5'); await p.waitForTimeout(100);
  const T = await p.evaluate(() => ({ v: S.rx.DC[1].P, sum: document.querySelector('[data-rxsum="0"]').textContent, exp: fmt(S.rx.DC.reduce((a, r) => a + r.P, 0)) }));
  check(T.v === 91.5 && T.sum === T.exp, `typed 91.5 into G2 DC P: S.rx.DC[1].P = ${T.v}, Σ ${T.sum}`);
  await p.click('[data-rxmode="girder"]'); await p.waitForTimeout(150);
  await p.selectOption('select[data-path="ui.rxView"]', 'DC'); await p.waitForTimeout(150);
  check(await p.inputValue('input[data-path="rx.DC.1.P"]') === '91.5', 'per-load-type view shows the typed value');
  await p.fill('input[data-path="rx.DC.2.P"]', '77.25'); await p.waitForTimeout(100);
  await p.click('[data-rxmode="table"]'); await p.waitForSelector('#rxGrid');
  check(await p.inputValue(cellSel(2, 0)) === '77.25', 'Table shows a value entered in the per-load-type view');

  // 4. paste 5 × 12 TSV at G1 DC P
  const N = await p.evaluate(() => S.beams.N);
  if (N < 5) await p.evaluate(() => { S.beams.N = 5; migrate(); buildInputs(); });
  const m1 = await firePaste(p, cellSel(0, 0), TSV);
  const got = await p.evaluate(() => RXG_COLS.map(([t, c]) => S.rx[t].slice(0, 5).map(r => r[c])));
  const okBlock = BLOCK.every((row, i) => row.every((v, j) => got[j][i] === v));
  check(okBlock && /Pasted 5 × 12/.test(m1), `5 × 12 TSV block pasted at G1 DC P (${m1})`);
  check(await p.inputValue(cellSel(4, 11)) === String(BLOCK[4][11]), 'pasted values shown in the cells');
  await p.click('[data-rxmode="girder"]'); await p.waitForTimeout(150); await p.selectOption('select[data-path="ui.rxView"]', 'WS'); await p.waitForTimeout(150);
  check(await p.inputValue('input[data-path="rx.WS.3.Vy"]') === '2.5', 'per-load-type view (WS) shows the pasted values');
  await p.click('[data-rxmode="table"]'); await p.waitForSelector('#rxGrid');
  const m2 = await firePaste(p, cellSel(1, 6), '5.5, 0.75, 2\n6,1,-3\n');
  check(await p.evaluate(() => S.rx.WS[1].P === 5.5 && S.rx.WS[1].Vx === 0.75 && S.rx.WS[2].Vy === -3), `2 × 3 CSV block pasted at G2 WS P (${m2})`);

  // 5. rejected pastes
  const snap = () => p.evaluate(() => JSON.stringify(S.rx));
  for (const [name, at, text, re] of [
    ['text cell', cellSel(0, 0), '1\t2\nabc\t4', /not a number/],
    ['header line', cellSel(0, 0), 'DC\tDW\n1\t2', /not a number/],
    ['blank cell', cellSel(0, 0), '1\t\t3', /blank cell/],
    ['too many rows', cellSel(0, 0), [...Array(N + 1)].map(() => '1').join('\n'), /rows/],
    ['too many columns', cellSel(0, 10), '1\t2\t3', /columns/],
    ['number with units', cellSel(0, 0), '85 kip', /not a number/]]) {
    const before = await snap(); const m = await firePaste(p, at, text); const after = await snap();
    const err = await p.evaluate(() => document.getElementById('rxgMsg').classList.contains('err'));
    check(before === after && re.test(m) && /rejected/.test(m) && err, `invalid paste rejected, nothing changed: ${name} (${m})`);
  }
  await p.evaluate(() => { S.longit.computeBR = true; buildInputs(); });
  { const before = await snap(); const m = await firePaste(p, cellSel(0, 2), '1\t2'); const after = await snap();
    check(before === after && /calculated in panel I-6b/.test(m), `paste over a calculated BR column rejected (${m})`); }
  await p.evaluate(() => { S.longit.computeBR = false; buildInputs(); });

  // 6. bad typed text
  { const before = await snap(); await p.fill(cellSel(0, 1), '12x'); await p.waitForTimeout(100);
    const B = await p.evaluate(() => { const el = document.querySelector('#rxGrid input[data-r="0"][data-c="1"]');
      return { bad: el.classList.contains('bad'), aria: el.getAttribute('aria-invalid'), tab: document.getElementById('abutInTab_gird').classList.contains('has-err') }; });
    check(B.bad && B.aria === 'true' && B.tab && before === await snap(), 'non-numeric typed text: cell marked bad, tab marked, value not used');
    await p.fill(cellSel(0, 1), '12'); await p.waitForTimeout(100);
    check(await p.evaluate(() => S.rx.DW[0].P === 12 && !document.querySelector('#rxGrid input.bad')), 'corrected value clears the mark'); }

  // 7. keyboard and copy
  await p.click(cellSel(0, 0));
  await p.keyboard.press('ArrowDown'); const k1 = await p.evaluate(() => document.activeElement.dataset.r + ',' + document.activeElement.dataset.c);
  await p.keyboard.press('ArrowRight'); const k2 = await p.evaluate(() => document.activeElement.dataset.r + ',' + document.activeElement.dataset.c);
  await p.keyboard.press('Enter'); const k3 = await p.evaluate(() => document.activeElement.dataset.r + ',' + document.activeElement.dataset.c);
  await p.keyboard.press('Shift+Enter'); await p.keyboard.press('ArrowUp'); const k4 = await p.evaluate(() => document.activeElement.dataset.r + ',' + document.activeElement.dataset.c);
  await p.keyboard.press('ArrowLeft'); const k5 = await p.evaluate(() => document.activeElement.dataset.r + ',' + document.activeElement.dataset.c);
  await p.keyboard.press('Tab'); const k6 = await p.evaluate(() => document.activeElement.dataset.r + ',' + document.activeElement.dataset.c);
  check([k1, k2, k3, k4, k5, k6].join(' ') === '1,0 1,1 2,1 0,1 0,0 0,1', `arrows / Enter / Shift+Enter / Tab move between cells (${[k1, k2, k3, k4, k5, k6].join(' ')})`);
  const tsv = await p.evaluate(() => rxgTSV());
  const tl = tsv.trim().split('\n');
  check(tl.length === (await p.evaluate(() => S.beams.N)) + 1 && tl[0].split('\t').length === 13 && tl[0].startsWith('Girder\tDC P (kip)') && tl[1].split('\t')[1] === String(BLOCK[0][0]), 'Copy table: TSV with a header line and one line per girder');
  await p.click('#btnRxCopy'); await p.waitForTimeout(300);
  check(/Copied|blocked/.test(await p.textContent('#rxgMsg')), `Copy table button answers (${await p.textContent('#rxgMsg')})`);
  allErrs.push(...o.errs); await o.b.close();
}

// ---- 8. same results as the old way
{
  const vals = [...Array(5)].map((_, i) => [80 + i, 11 + i, 60 + 2 * i, 3.25, 2.5 + i / 10, 1.5, 4, 1.25, 2.5, -1.5, 0.5, 1 + i]);
  const a = await openPage(FILE, { vw: 1440, vh: 900 }); await ready(a.p);
  await a.p.evaluate(() => { S.beams.N = 5; migrate(); buildInputs(); recalcAll(); });
  await toTable(a.p);
  await firePaste(a.p, cellSel(0, 0), vals.map(r => r.join('\t')).join('\n'));
  await a.p.fill(cellSel(3, 2), '66.125'); await settle(a.p);
  const rA = await a.p.evaluate(results); const sA = await a.p.evaluate(() => JSON.stringify(S.rx));
  allErrs.push(...a.errs); await a.b.close();

  const b = await openPage(FILE, { vw: 1440, vh: 900 }); await ready(b.p);
  await b.p.evaluate(() => { S.beams.N = 5; migrate(); buildInputs(); recalcAll(); });
  await b.p.click('#abutInTab_gird'); await b.p.waitForTimeout(150);
  const cols = await b.p.evaluate(() => RXG_COLS);
  const lts = [...new Set(cols.map(c => c[0]))];
  for (const t of lts) {
    await b.p.selectOption('select[data-path="ui.rxView"]', t); await b.p.waitForTimeout(100);
    for (let i = 0; i < 5; i++) for (let j = 0; j < cols.length; j++) if (cols[j][0] === t) {
      const v = (t === 'LL' && i === 3) ? 66.125 : vals[i][j];
      await b.p.fill(`input[data-path="rx.${t}.${i}.${cols[j][1]}"]`, String(v)); }
  }
  await b.p.selectOption('select[data-path="ui.rxView"]', 'DC'); await settle(b.p);
  const rB = await b.p.evaluate(results); const sB = await b.p.evaluate(() => JSON.stringify(S.rx));
  allErrs.push(...b.errs); await b.b.close();
  check(sA === sB, 'S.rx identical: table entry vs per-load-type entry');
  check(rA.fp === rB.fp && JSON.stringify(rA.dash) === JSON.stringify(rB.dash), `results identical (Input ID ${rA.fp} / ${rB.fp}, ${rA.dash.length} dashboard rows)`);
}

// ---- 9. saved project opens unchanged (vs main)
{
  let mainFile = null;
  try { const src = execSync('git show origin/main:abutment_calculator.html', { cwd: REPO, maxBuffer: 64 << 20 }); mainFile = path.join(path.dirname(FILE), '.abrt-main.html'); fs.writeFileSync(mainFile, src); } catch (e) { }
  const seed = await (async () => { const o = await openPage(FILE, { vw: 1440, vh: 900 }); await ready(o.p);
    const st = await o.p.evaluate(() => { S.beams.N = 4; migrate(); S.rx.DC.forEach((r, i) => r.P = 90 + i); S.rx.WS[2].Vy = -2.75; return JSON.stringify(S); });
    await o.b.close(); return st; })();
  const open = async f => { const o = await openPage(f, { vw: 1440, vh: 900, ls: { abutcalc_v1_autosave: seed, abutcalc_rxEntry_v1: 'table' } }); await ready(o.p); await settle(o.p);
    const r = await o.p.evaluate(() => ({ rx: JSON.stringify(S.rx), fp: LAST_R.fingerprint, ui: JSON.stringify(S.ui) })); allErrs.push(...o.errs); await o.b.close(); return r; };
  const br = await open(FILE);
  check(br.rx === JSON.stringify(JSON.parse(seed).rx), 'saved project: reactions open unchanged');
  if (mainFile) { const mn = await open(mainFile); fs.unlinkSync(mainFile);
    check(br.fp === mn.fp && br.ui === mn.ui, `saved project: same Input ID as on main (${br.fp} / ${mn.fp}); S.ui unchanged (view not stored in the project)`); }
  else console.log('skip main comparison (origin/main not available)');
}

// ---- 10. Pull from SubLoads fills the table
{
  const o = await openPage(path.resolve(REPO, 'Bridge Substructure Loading.html'), { vw: 1440, vh: 900 }); const p = o.p;
  await p.waitForTimeout(2500);
  const sent = await p.evaluate(() => { const b = document.getElementById('btn-abx-send'); if (!b) return 'no button'; b.click(); return localStorage.getItem('bridgeSuite.v1.abutmentLoads') ? 'sent' : 'not sent'; });
  if (sent !== 'sent') { check(false, 'SubLoads sent abutment loads (' + sent + ')'); }
  else {
    const q = await o.ctx.newPage(); const qErr = []; q.on('pageerror', e => qErr.push(e.message)); q.on('console', m => { if (m.type() === 'error') qErr.push(m.text()); });
    await q.goto('file://' + FILE); await ready(q);
    await q.evaluate(() => { try { localStorage.setItem('abutcalc_rxEntry_v1', 'table'); } catch (e) { } });
    await q.evaluate(() => document.getElementById('axh-pull').click()); await q.waitForSelector('#axh-apply'); await q.evaluate(() => document.getElementById('axh-apply').click()); await q.waitForTimeout(400);
    await q.click('#abutInTab_gird'); await q.waitForTimeout(150);
    if (await q.$('#rxGrid') === null) await q.click('[data-rxmode="table"]');
    const P = await q.evaluate(() => { let bad = 0, n = 0; for (let i = 0; i < S.beams.N; i++) RXG_COLS.forEach(([t, c], j) => { const el = document.querySelector(`#rxGrid input[data-r="${i}"][data-c="${j}"]`); if (!el) return; n++; if (el.value !== String(S.rx[t][i][c])) bad++; });
      return { n, bad, src: !!S.subloadsSrc, dc: S.rx.DC.map(r => r.P) }; });
    check(P.src && P.n > 0 && P.bad === 0, `pulled loads (DC P ${P.dc.join(', ')}) shown in the table (${P.n} cells, ${P.bad} mismatches)`);
    allErrs.push(...qErr);
  }
  allErrs.push(...o.errs.filter(e => !/favicon/.test(e))); await o.b.close();
}

// ---- 11. 390 px
{
  const o = await openPage(FILE, { vw: 390, vh: 844 }); const p = o.p; await ready(p);
  await toTable(p);
  const M = await p.evaluate(() => { const w = document.querySelector('.rxg-wrap'); const r = w.getBoundingClientRect();
    return { page: document.documentElement.scrollWidth <= innerWidth, inner: w.scrollWidth > w.clientWidth, inView: r.left >= 0 && r.right <= innerWidth + 0.5, ox: getComputedStyle(w).overflowX }; });
  check(M.page, '390 px: no horizontal page scroll');
  check(M.inner && M.ox === 'auto' && M.inView, '390 px: the table scrolls inside its wrapper, wrapper within the screen');
  await p.click(cellSel(0, 0)); await p.keyboard.type('88'); await p.waitForTimeout(100);
  check(await p.evaluate(() => S.rx.DC[0].P === 88), '390 px: a cell can be typed into');
  if (SHOTS) { await p.evaluate(() => document.getElementById('rxGrid').scrollIntoView({ block: 'center' })); await p.waitForTimeout(200);
    await p.screenshot({ path: path.join(SHOTS, 'table-390.png') }); }
  allErrs.push(...o.errs); await o.b.close();
}

check(allErrs.length === 0, `0 console errors${allErrs.length ? ': ' + allErrs.slice(0, 5).join(' | ') : ''}`);
console.log(fails ? `\n${fails} check(s) failed` : '\nall checks pass');
process.exit(fails ? 1 : 0);
