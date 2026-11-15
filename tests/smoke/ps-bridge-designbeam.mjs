#!/usr/bin/env node
// PS Bridge (apps/ps-bridge/index.html) batch F3 / F4 (2026-11-15), headless Chromium, file://:
//   F3 the old app's "Design beam" chip above the output tabs (read only): absent with nothing published; LL & DL's design beam B4 with a
//      roster of the same girder count -> "Show G4 (interior)"; click -> the output tabs show G4 (P.design.g 4; interior), the chip says so;
//      no shared key written. A roster of another count -> "⚠ 5≠6" and no Show button. The storage event redraws the chip.
//   F4 "Import hand-off (JSON)" of the distribution factors: a bridge-lldf-factors file -> the same confirm as the pull ("Via: file …"), the
//      type shown gets DF auto off and the factors; a file of another schema is refused (nothing changed). 0 console errors.
//   node tests/smoke/ps-bridge-designbeam.mjs [--shots <dir>]
import path from 'path';
import fs from 'fs';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const shots = (i => i > 0 ? process.argv[i + 1] : null)(process.argv.indexOf('--shots'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); }; const t0 = Date.now();
const roster = nb => ({ _schema: 'bridge-beam-roster', schemaVersion: 1, Nb: nb, producer: 'LL & DL Distribution', producedAt: '2026-11-15T12:00:00.000Z',
  beams: Array.from({ length: nb }, (_, k) => ({ i: k + 1, label: 'B' + (k + 1), type: k === 0 || k === nb - 1 ? 'ext' : 'int', ab: k === 0 || k === nb - 1 ? 'EXT' : 'INT' })) });
const sel = (i, nb) => ({ _schema: 'bridge-design-beam', schemaVersion: 1, index: i, label: 'B' + i, type: 'int', ab: 'INT', Nb: nb, setBy: 'LL & DL', setAt: '2026-11-15T12:00:00.000Z' });
const LLDF = { _schema: 'bridge-lldf-factors', schemaVersion: 1, producer: 'LL & DL Distribution', producedAt: '2026-11-15T13:00:00.000Z', project: 'Route 9', Nb: 7,
  governing: { interior: { gM: 0.612345, gV: 0.701234, fatM: 0.41234 }, exterior: { gM: 0.7123, gV: 0.6633, fatM: 0.5 } }, governingNeg: null };
const TMP = process.env.TMPDIR || '/tmp', F1 = path.join(TMP, 'psb-f4-lldf.json'), F2 = path.join(TMP, 'psb-f4-wrong.json');
fs.writeFileSync(F1, JSON.stringify(LLDF)); fs.writeFileSync(F2, JSON.stringify({ _schema: 'bridge-dl-loads', schemaVersion: 1 }));

const { b, p, errs, dialogs } = await openPage(path.join(REPO, 'apps/ps-bridge/index.html'), { vw: 1400, vh: 1000 });
try {
  const ready = () => p.waitForFunction(() => window.PSBHandoffUI && document.querySelector('#inTabs [data-itab="proj"]') && document.getElementById('out').innerText.length > 50, null, { timeout: 120000 });
  await ready();
  assert.equal(await p.locator('#dbChip').count(), 0); ok('no chip while LL & DL has published nothing');
  const nb = await p.evaluate(() => PSBModel.load(localStorage).project.xs.nb);
  await p.evaluate(([r, s]) => { localStorage.setItem('bridgeSuite.v1.beamRoster', r); localStorage.setItem('bridgeSuite.v1.designBeam', s); }, [JSON.stringify(roster(nb)), JSON.stringify(sel(4, nb))]);
  await p.reload(); await ready(); await p.waitForSelector('#dbChip');
  const k0 = await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('bridgeSuite.')).sort());
  assert.match(await p.textContent('#dbChip'), /Design beam.*B4 · INT/); assert.equal(await p.locator('#dbChip [data-mct="dbShow"]').innerText(), 'Show G4 (interior)');
  if (shots) await p.locator('#dbChip').screenshot({ path: path.join(shots, 'F3-chip.png') });
  await p.click('#dbChip [data-mct="dbShow"]'); await p.waitForTimeout(500);
  const sh = await p.evaluate(() => { const P = PSBModel.load(localStorage).project; return { d: P.design, pos: PSBDesign.inputs(P).loads.pos }; });
  assert.equal(sh.d.g, 4); assert.equal(sh.pos, 'interior'); assert.match(await p.textContent('#dbChip'), /The output tabs show G4 \(interior\)/);
  assert.deepEqual(await p.evaluate(() => Object.keys(localStorage).filter(k => k.startsWith('bridgeSuite.')).sort()), k0, 'no shared key written');
  ok('B4 with the same girder count: "Show G4 (interior)" -> the output tabs show G4; no shared key written');
  await p.evaluate(r => { localStorage.setItem('bridgeSuite.v1.beamRoster', r); window.dispatchEvent(new StorageEvent('storage', { key: 'bridgeSuite.v1.beamRoster' })); }, JSON.stringify(roster(nb + 1)));
  await p.waitForTimeout(400);
  assert.match(await p.textContent('#dbChip'), new RegExp(`⚠ ${nb}≠${nb + 1}`)); assert.equal(await p.locator('#dbChip [data-mct="dbShow"]').count(), 0);
  if (shots) await p.locator('#dbChip').screenshot({ path: path.join(shots, 'F3-chip-mismatch.png') });
  ok(`another girder count in the roster: ⚠ ${nb}≠${nb + 1}, no Show (redrawn on the storage event)`);
  // F4: lldf import
  await p.click('#inTabs [data-itab="proj"]'); await p.waitForSelector('#psbHo [data-ho="lldfFile"]');
  const t1 = await p.evaluate(() => localStorage.getItem('psb2.project.current'));
  await p.click('#psbHo [data-ho="lldfFile"]'); let d0 = dialogs.length;   // the button arms the hidden input (its file chooser is not used here)
  await p.locator('#psbHo [data-ho-file="lldf"]').setInputFiles(F2); await p.waitForTimeout(500);
  assert.match(dialogs.slice(d0).join('\n'), /Cannot import the hand-off file: wrong data type \(bridge-dl-loads\)/); assert.equal(await p.evaluate(() => localStorage.getItem('psb2.project.current')), t1);
  ok('a file of another schema: refused, nothing changed');
  await p.click('#psbHo [data-ho="lldfFile"]'); d0 = dialogs.length;
  await p.locator('#psbHo [data-ho-file="lldf"]').setInputFiles(F1); await p.waitForTimeout(800);
  const msg = dialogs.slice(d0).join('\n'); assert.match(msg, /Pull from LL & DL Distribution/); assert.match(msg, /Via: file psb-f4-lldf\.json/);
  const L = await p.evaluate(() => PSBDesign.inputs(PSBModel.load(localStorage).project).loads);
  assert.equal(L.dfAuto, false); assert.equal(L.dfm, 0.6123); assert.equal(L.dfv, 0.7012); assert.equal(L.fatM, 0.4123);
  ok(`Import hand-off (JSON): the pull's confirm (via the file), DFm ${L.dfm}, DFv ${L.dfv}, fatigue ${L.fatM}`);
  assert.deepEqual(errs, []); ok('0 console errors');
  console.log(`ps-bridge-designbeam: ${n} checks passed (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
} finally { await b.close(); }
