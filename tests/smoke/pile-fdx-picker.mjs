#!/usr/bin/env node
// Pile Designer: project picker of the foundation-load pull (PDPK, 2026-11-11; HANDOFF.md §4.6, §5.1; shared/handoff-store.js, read only).
//   Seeded copies (synthetic payloads, Cloud sync off): SubLoads per-project copies of two projects (bridgeSuite.v1.foundationLoads.by.subloads.<pid>),
//   .by.subloads (= project A's copy), .by.abutment (project A, newest) and the channel key (= the abutment's payload).
//   1. "Pull from Abutment / SubLoads" opens the picker: "Latest sent" + one row per copy (the same payload once), both senders, project, unit,
//      "last unit sent for this project" on SubLoads project copies, newest first; preselected: the newest copy of the open project.
//   2. A copy older than its project's latest is flagged; "Next: review" opens the same review dialog with that copy only; Import applies it.
//   3. No project match: "Latest sent" preselected; it opens the review exactly as before (sender list).
//   4. Old data (no per-project copy): the pull opens the review at once, as before.
//   5. Probe vs main (§4): the latest copy picked here, and "Latest sent", give exactly main's imported inputs (adoptedAt aside).
//   6. 390 px: the picker fits (no horizontal page scroll); screenshots to $PICK_SHOTS (optional); 0 console errors (Tailwind is not in the
//      test kit: its blocked load is not counted).
//   node tests/smoke/pile-fdx-picker.mjs [--a origin/main]
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('a', 'origin/main'), FILE = path.join(REPO, 'Pile Designer.html'), SHOTS = process.env.PICK_SHOTS || '';
let fails = 0; const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 600)); } };

const NS = 'bridgeSuite.v1.foundationLoads';
const mk = (producer, producerFile, project, label, at, P) => ({ _schema: 'bridge-foundation-loads', schemaVersion: 1, producer, producerFile, producedAt: at, project,
  units: { force: 'kip', moment: 'kip-ft', length: 'ft' }, element: { type: 'pier', label }, location: 'bottom of footing, centre', signConvention: 'x ahead station, y left; +My moves the resultant toward +x',
  cases: [{ name: 'Strength I max', limitState: 'Strength I', factored: true, P, Vx: 12, Vy: 4, Mx: 150, My: 320 }, { name: 'Service I', limitState: 'Service I', factored: false, P: P * 0.7, Vx: 8, Vy: 3, Mx: 100, My: 210 }] });
const A = { name: 'Bridge A', bridgeId: 'B-1' }, B = { name: 'Bridge B', bridgeId: '' };
const SA = mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', A, 'Pier 1', '2026-11-11T10:00:00.000Z', 900);
const SB = mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', B, 'Pier 2', '2026-11-11T09:00:00.000Z', 700);
const AB = mk('Abutment Calculator', 'abutment_calculator.html', A, 'Abut 1', '2026-11-11T11:00:00.000Z', 1100); AB.element.type = 'abutment';
const META = { _schema: 'bridge-project-meta', schemaVersion: 1, producer: 'test', producedAt: '2026-11-11T08:00:00.000Z', project: A, fields: { projectName: 'Bridge A', bridgeId: 'B-1' } };
const S = JSON.stringify;
const LEGACY = { [NS]: S(AB), [NS + '.updatedAt']: AB.producedAt, [NS + '.by.abutment']: S(AB), [NS + '.by.subloads']: S(SA), 'bridgeSuite.v1.projectMeta': S(META) };
const COPIES = { ...LEGACY, [NS + '.by.subloads.B-1~Bridge A']: S(SA), [NS + '.by.subloads.~Bridge B']: S(SB) };

const clickPull = p => p.evaluate(() => { const b = [...document.querySelectorAll('button')].find(x => x.textContent.trim().startsWith('Pull from Abutment / SubLoads')); if (!b) return false; b.click(); return true; });
const ready = p => p.waitForFunction(() => window.PileFoundationXfer && [...document.querySelectorAll('button')].some(x => x.textContent.trim().startsWith('Pull from Abutment / SubLoads')), null, { timeout: 30000 });
const pickRows = p => p.evaluate(() => [...document.querySelectorAll('#pfxPkOverlay tr[data-pfx-pk]')].map(tr => ({ i: +tr.getAttribute('data-pfx-pk'), on: tr.querySelector('input').checked, t: tr.innerText.replace(/\s+/g, ' ').trim() })));
const saved = p => p.evaluate(() => { const I = JSON.parse(localStorage.getItem('micropile_lrfd_inputs_v1') || 'null'); if (I && I.foundationSrc) delete I.foundationSrc.adoptedAt; return I; });
async function importNow(p) { await p.waitForSelector('#pfxGo', { timeout: 15000 }); await p.click('#pfxGo'); await p.waitForTimeout(1800); return saved(p); }
const errsAll = [];
async function session(file, ls, fn, vw = 1400) { const o = await openPage(file, { ls, vw, vh: 1000 }); try { await ready(o.p); await o.p.waitForTimeout(500); return await fn(o.p, o); } finally {
  // the test kit has no Tailwind (cdn.tailwindcss.com, blocked): its one failed load is not a page error
  const tw = [...o.blocked].every(u => /^https:\/\/cdn\.tailwindcss\.com\//.test(u));
  errsAll.push(...o.errs.filter(e => !(tw && /^Failed to load resource: net::ERR_FAILED$/.test(e))).map(e => path.basename(file) + ': ' + e)); await o.b.close(); } }

// main's tree (only what the page loads) in a temporary folder, removed at the end
const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const MDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'pdpk-main-'));
try {
  execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} "Pile Designer.html" shared | tar -x -C "${MDIR}"`]);
  const MFILE = path.join(MDIR, 'Pile Designer.html');

  // 1-2: picker, default, older flag, apply a copy
  await session(FILE, COPIES, async p => {
    assert.ok(await clickPull(p)); await p.waitForSelector('#pfxPkOverlay', { timeout: 10000 });
    const rows = await pickRows(p);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'pile-picker-1400.png') });
    await ok('picker: "Latest sent" + 3 copies (the same payload once), newest first, both senders, unit, SubLoads "last unit sent"', () => {
      assert.equal(rows.length, 4, S(rows)); assert.match(rows[0].t, /^Latest sent/);
      assert.match(rows[1].t, /Abutment Calculator B-1 — Bridge A Abut 1/); assert.match(rows[2].t, /SubLoads B-1 — Bridge A Pier 1 \(last unit sent for this project\)/);
      assert.match(rows[3].t, /SubLoads Bridge B Pier 2 \(last unit sent for this project\)/); assert.match(rows[2].t, /older/); assert.doesNotMatch(rows[1].t, /older/); });
    await ok('default: the newest copy of the open project (Abutment, Bridge A)', () => assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [0]));
    await p.click('#pfxPkOverlay tr[data-pfx-pk="1"]');
    const note = await p.evaluate(() => (document.getElementById('pfxPkOlder') || {}).innerText || '');
    await ok('an older copy of the project is flagged (latest: Abutment Calculator, Abut 1)', () => assert.match(note, /older than the latest hand-off for the same project: Abutment Calculator, .*Abut 1/));
    await p.click('#pfxPkNext'); await p.waitForSelector('#pfxGo', { timeout: 10000 });
    const dlg = await p.evaluate(() => ({ t: document.getElementById('pfxOverlay').innerText, sel: !!document.getElementById('pfxSrcSel') }));
    await ok('Next: the review dialog with the chosen copy only (SubLoads, Pier 1; no sender list)', () => { assert.match(dlg.t, /Bridge Substructure Loading/); assert.match(dlg.t, /Pier 1/); assert.equal(dlg.sel, false); });
    const I = await importNow(p);
    await ok('Import applies the chosen copy (foundationSrc: SubLoads 10:00, Pier 1; a group case P = 900)', () => {
      assert.equal(I.foundationSrc.producer, 'Bridge Substructure Loading'); assert.equal(I.foundationSrc.producedAt, SA.producedAt); assert.equal(I.foundationSrc.element.label, 'Pier 1');
      const g = (I.groupCases || []).filter(c => c._bx && c._bx.ch === 'foundationLoads'); assert.equal(g.length, 2); assert.match(g[0].name, /Strength I max/); assert.ok(S(g[0].mags).includes('900'), S(g[0].mags)); });
  });

  // 3: no project match -> "Latest sent" preselected; opens the review with the sender list (as before)
  const noMeta = { ...COPIES }; delete noMeta['bridgeSuite.v1.projectMeta'];
  await session(FILE, noMeta, async p => {
    await clickPull(p); await p.waitForSelector('#pfxPkOverlay', { timeout: 10000 });
    const rows = await pickRows(p);
    await ok('no open project: "Latest sent" preselected', () => assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [-1]));
    await p.click('#pfxPkNext'); await p.waitForSelector('#pfxGo', { timeout: 10000 });
    const sel = await p.evaluate(() => { const s = document.getElementById('pfxSrcSel'); return s ? [...s.options].map(o => o.textContent) : null; });
    await ok('"Latest sent": the review as before (sender list: Abutment Calculator first, SubLoads)', () => { assert.equal(sel.length, 2); assert.match(sel[0], /^Abutment Calculator/); assert.match(sel[1], /^Bridge Substructure Loading/); });
  });

  // 4: old data only -> no picker, the review at once
  await session(FILE, LEGACY, async p => {
    await clickPull(p); await p.waitForSelector('#pfxGo', { timeout: 10000 });
    const r = await p.evaluate(() => ({ pk: !!document.getElementById('pfxPkOverlay'), sel: !!document.getElementById('pfxSrcSel') }));
    await ok('old single-key data (no per-project copy): no picker, the review dialog at once with the sender list', () => { assert.equal(r.pk, false); assert.equal(r.sel, true); });
  });

  // 5: probe vs main: main's pull (default = newest) vs this branch's newest copy and "Latest sent"
  const M = await session(MFILE, COPIES, async p => { await clickPull(p); return importNow(p); });
  const B1 = await session(FILE, COPIES, async p => { await clickPull(p); await p.waitForSelector('#pfxPkOverlay'); await p.click('#pfxPkNext'); return importNow(p); });
  const B2 = await session(FILE, COPIES, async p => { await clickPull(p); await p.waitForSelector('#pfxPkOverlay'); await p.click('#pfxPkOverlay tr[data-pfx-pk="-1"]'); await p.click('#pfxPkNext'); return importNow(p); });
  await ok(`probe vs ${REF} (${sha}): the newest copy picked gives exactly main's imported inputs`, () => { assert.equal(M.foundationSrc.producedAt, AB.producedAt); assert.deepEqual(diff(M, B1), []); });
  await ok(`probe vs ${REF}: "Latest sent" gives exactly main's imported inputs`, () => assert.deepEqual(diff(M, B2), []));
  const SB1 = await session(FILE, COPIES, async p => { await clickPull(p); await p.waitForSelector('#pfxPkOverlay'); await p.click('#pfxPkOverlay tr[data-pfx-pk="2"]'); await p.click('#pfxPkNext'); return importNow(p); });
  const one = { ...LEGACY, [NS]: S(SB), [NS + '.by.subloads']: S(SB) }; delete one[NS + '.by.abutment'];
  const MS = await session(MFILE, one, async p => { await clickPull(p); return importNow(p); });
  await ok(`probe vs ${REF}: a SubLoads project copy gives exactly main's import of the same payload`, () => { assert.equal(MS.foundationSrc.producedAt, SB.producedAt); assert.deepEqual(diff(MS, SB1), []); });

  // 6: 390 px
  await session(FILE, COPIES, async p => {
    await clickPull(p); await p.waitForSelector('#pfxPkOverlay', { timeout: 10000 });
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, box: document.querySelector('#pfxPkOverlay [role=dialog]').getBoundingClientRect().right }));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'pile-picker-390.png') });
    await ok('390 px: the picker fits the screen (no horizontal page scroll)', () => { assert.ok(w.box <= w.cw + 0.5, S(w)); assert.ok(w.sw <= w.cw, S(w)); });
  }, 390);

  await ok('0 console errors', () => assert.deepEqual(errsAll, []));
} finally { fs.rmSync(MDIR, { recursive: true, force: true }); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
