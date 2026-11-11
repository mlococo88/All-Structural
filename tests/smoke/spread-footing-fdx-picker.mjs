#!/usr/bin/env node
// Spread Footing: project picker of the foundation-load pull (SFPK, 2026-11-11; HANDOFF.md §4.6, §5.1; shared/handoff-store.js, read only).
//   Seeded copies (synthetic payloads at the top of the footing, Cloud sync off): SubLoads per-project copies of two projects
//   (bridgeSuite.v1.foundationLoads.by.subloads.<pid>), .by.subloads (= project A's copy), .by.abutment (project A, newest), the channel key (= the abutment's).
//   1. "Pull from Abutment / SubLoads" opens the picker: "Latest sent" + one row per copy (the same payload once), both senders, project, unit,
//      "last unit sent for this project" on SubLoads project copies, newest first; preselected: the newest copy of the open project (this
//      tool's project name).
//   2. A copy older than its project's latest is flagged; "Next: review" opens the same review dialog with that copy only; Import applies it.
//   3. No open project: "Latest sent" preselected; it opens the review exactly as before (sender list).
//   4. Old data (no per-project copy): the pull opens the review at once, as before.
//   5. #1417 (SFWP): a pull through the picker into a wall in per-foot entry switches it to Total, the direct set = the sent totals.
//   6. Probe vs main (§4): the latest copy picked here, "Latest sent", and a SubLoads copy give exactly main's state and results (adoptedAt aside).
//   7. 390 px: the picker fits (no horizontal page scroll); screenshots to $PICK_SHOTS (optional); 0 console errors.
//   node tests/smoke/spread-footing-fdx-picker.mjs [--a origin/main]
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const REF = arg('a', 'origin/main'), FILE = path.join(REPO, 'Spread Footing.html'), SHOTS = process.env.PICK_SHOTS || '';
let fails = 0; const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 600)); } };

const NS = 'bridgeSuite.v1.foundationLoads';
const mk = (producer, producerFile, project, label, at, P) => ({ _schema: 'bridge-foundation-loads', schemaVersion: 1, producer, producerFile, producedAt: at, project,
  units: { force: 'kip', moment: 'kip-ft', length: 'ft' }, element: { type: 'pier', label }, location: 'top of footing', reference: { level: 'topOfFooting' },
  signConvention: 'x ahead station, y left; +My moves the resultant toward +x',
  cases: [{ name: 'Strength I max', limitState: 'Strength I', factored: true, combination: '1.25 DC + 1.75 LL', P, Vx: 12, Vy: 4, Mx: 150, My: 320 }, { name: 'Service I', limitState: 'Service I', factored: false, P: P * 0.7, Vx: 8, Vy: 3, Mx: 100, My: 210 }] });
const A = { name: 'Bridge A', bridgeId: 'B-1' }, B = { name: 'Bridge B', bridgeId: '' };
const SA = mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', A, 'Pier 1', '2026-11-11T10:00:00.000Z', 900);
const SB = mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', B, 'Pier 2', '2026-11-11T09:00:00.000Z', 700);
const AB = mk('Abutment Calculator', 'abutment_calculator.html', A, 'Abut 1', '2026-11-11T11:00:00.000Z', 1100); AB.element.type = 'abutment';
const S = JSON.stringify;
const LEGACY = { [NS]: S(AB), [NS + '.updatedAt']: AB.producedAt, [NS + '.by.abutment']: S(AB), [NS + '.by.subloads']: S(SA) };
const COPIES = { ...LEGACY, [NS + '.by.subloads.B-1~Bridge A']: S(SA), [NS + '.by.subloads.~Bridge B']: S(SB) };
const WALL = "state.geom.B=6;state.geom.L=22;state.peds=[state.peds[0]];const p=state.peds[0];p.label='Wall 1';p.elemType='wall';p.x=0;p.y=0;p.bx=1;p.by=20;p.h=3;"
  + "p.reinf.longMode='spacing';p.reinf.longSpc=12;p.wallIn.hSize='sameTie';p.loadEntry='perFt';p.loads.D.P=12;state.loadMode='type';";

const ready = async p => { await p.waitForSelector('#tabbar button[data-tab="tab-report"]', { timeout: 30000 }); await p.waitForFunction(() => window.bxFl && window.bxPullFoundationLoads); await p.waitForTimeout(1200); };
const setProj = (p, name) => p.evaluate(n => { state.meta.project = n; const i = document.querySelector('#titleblock [data-path="meta.project"]'); if (i) i.value = n; }, name);
const setup = (p, src) => p.evaluate(src => { state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null; (new Function('state', src))(state); bindStaticInputs(); buildPedCards(); recalc(); }, src);
const pull = p => p.evaluate(() => { document.getElementById('btnPullFoundationLoads').click(); });
const pickRows = p => p.evaluate(() => [...document.querySelectorAll('#bxFlPkOverlay tr[data-bxfl-pk]')].map(tr => ({ i: +tr.getAttribute('data-bxfl-pk'), on: tr.querySelector('input').checked, t: tr.innerText.replace(/\s+/g, ' ').trim() })));
const snap = p => p.evaluate(() => {
  const js = v => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(v, (k, x) => { if (typeof x === 'function') return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return '[cyc]'; seen.add(x); } return (typeof x === 'number' && !isFinite(x)) ? String(x) : x; })); };
  const st = js(state); if (st.bxSrc && st.bxSrc.foundationLoads) delete st.bxSrc.foundationLoads.adoptedAt;
  const Rj = js(R); (Rj.peds || []).forEach(q => delete q.pf); return { state: st, R: Rj, P2: js(P2) }; });
async function importNow(p) { await p.waitForSelector('#bxFlGo', { timeout: 15000 }); await p.click('#bxFlGo'); await p.waitForTimeout(1200); return snap(p); }
const errsAll = [];
async function session(file, ls, fn, vw = 1400) { const o = await openPage(file, { ls, vw, vh: 1000 }); try { await ready(o.p); return await fn(o.p, o); } finally { errsAll.push(...o.errs.map(e => path.basename(path.dirname(file)) + '/' + path.basename(file) + ': ' + e)); await o.b.close(); } }

const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim();
const MDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'sfpk-main-'));
try {
  execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} "Spread Footing.html" shared | tar -x -C "${MDIR}"`]);
  const MFILE = path.join(MDIR, 'Spread Footing.html');

  // 1-2
  await session(FILE, COPIES, async p => {
    await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const rows = await pickRows(p);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'spread-footing-picker-1400.png') });
    await ok('picker: "Latest sent" + 3 copies (the same payload once), newest first, both senders, unit, SubLoads "last unit sent"', () => {
      assert.equal(rows.length, 4, S(rows)); assert.match(rows[0].t, /^Latest sent/);
      assert.match(rows[1].t, /Abutment Calculator B-1 — Bridge A Abut 1/); assert.match(rows[2].t, /SubLoads B-1 — Bridge A Pier 1 \(last unit sent for this project\)/);
      assert.match(rows[3].t, /SubLoads Bridge B Pier 2 \(last unit sent for this project\)/); assert.match(rows[2].t, /older/); assert.doesNotMatch(rows[1].t, /older/); });
    await ok('default: the newest copy of the open project (this tool\'s project name "Bridge A": Abutment)', () => assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [0]));
    await p.click('#bxFlPkOverlay tr[data-bxfl-pk="1"]');
    const note = await p.evaluate(() => (document.getElementById('bxFlPkOlder') || {}).innerText || '');
    await ok('an older copy of the project is flagged (latest: Abutment Calculator, Abut 1)', () => assert.match(note, /older than the latest hand-off for the same project: Abutment Calculator, .*Abut 1/));
    await p.click('#bxFlPkNext'); await p.waitForSelector('#bxFlGo', { timeout: 10000 });
    const dlg = await p.evaluate(() => ({ t: document.getElementById('bxFlOverlay').innerText, sel: !!document.getElementById('bxFlSrcSel') }));
    await ok('Next: the review dialog with the chosen copy only (SubLoads, Pier 1; no sender list)', () => { assert.match(dlg.t, /Bridge Substructure Loading/); assert.match(dlg.t, /Pier 1/); assert.equal(dlg.sel, false); });
    const X = await importNow(p);
    await ok('Import applies the chosen copy (bxSrc: SubLoads 10:00, Pier 1, Strength I max; direct P = 900)', () => {
      const s = X.state.bxSrc.foundationLoads; assert.equal(s.producer, 'Bridge Substructure Loading'); assert.equal(s.producedAt, SA.producedAt); assert.equal(s.element.label, 'Pier 1');
      assert.equal(s.caseName, 'Strength I max'); assert.equal(X.state.peds[s.pedIndex].direct.P, 900); });
  });

  // 3
  await session(FILE, COPIES, async p => {
    await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const rows = await pickRows(p);
    await ok('no open project: "Latest sent" preselected', () => assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [-1]));
    await p.click('#bxFlPkNext'); await p.waitForSelector('#bxFlGo', { timeout: 10000 });
    const sel = await p.evaluate(() => { const s = document.getElementById('bxFlSrcSel'); return s ? [...s.options].map(o => o.textContent) : null; });
    await ok('"Latest sent": the review as before (sender list: Abutment Calculator first, SubLoads)', () => { assert.equal(sel.length, 2); assert.match(sel[0], /^Abutment Calculator/); assert.match(sel[1], /^Bridge Substructure Loading/); });
  });

  // 4
  await session(FILE, LEGACY, async p => {
    await pull(p); await p.waitForSelector('#bxFlGo', { timeout: 10000 });
    const r = await p.evaluate(() => ({ pk: !!document.getElementById('bxFlPkOverlay'), sel: !!document.getElementById('bxFlSrcSel') }));
    await ok('old single-key data (no per-project copy): no picker, the review dialog at once with the sender list', () => { assert.equal(r.pk, false); assert.equal(r.sel, true); });
  });

  // 5: per-foot wall (#1417)
  await session(FILE, COPIES, async p => {
    await setup(p, WALL); await setProj(p, 'Bridge B'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const rows = await pickRows(p);
    await ok('per-foot wall: "Bridge B" preselects its SubLoads copy', () => { assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [2]); });
    await p.click('#bxFlPkNext');
    const X = await importNow(p);
    await ok('pull through the picker into a per-foot wall switches it to Total; direct = the sent totals (P 700; My 320 − Vx·h = 320 − 12·3 = 284); D.P 12 -> 240', () => {
      const q = X.state.peds[0]; assert.equal(q.loadEntry, 'total'); assert.equal(q.direct.P, 700); assert.equal(X.state.bxSrc.foundationLoads.sent.My, 320); assert.ok(Math.abs(q.direct.My - 284) < 1e-9, String(q.direct.My));
      assert.equal(q.loads.D.P, 240); assert.equal(X.state.loadMode, 'direct'); });
  });

  // 6: probe vs main
  const M = await session(MFILE, COPIES, async p => { await pull(p); return importNow(p); });
  const B1 = await session(FILE, COPIES, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkOverlay tr[data-bxfl-pk="0"]'); await p.click('#bxFlPkNext'); return importNow(p); });
  const B2 = await session(FILE, COPIES, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkNext'); return importNow(p); });
  await ok(`probe vs ${REF} (${sha}): the newest copy picked gives exactly main's state and results`, () => { assert.equal(M.state.bxSrc.foundationLoads.producedAt, AB.producedAt); assert.deepEqual(diff(M, B1), []); });
  await ok(`probe vs ${REF}: "Latest sent" gives exactly main's state and results`, () => assert.deepEqual(diff(M, B2), []));
  const one = { ...LEGACY, [NS]: S(SB), [NS + '.by.subloads']: S(SB) }; delete one[NS + '.by.abutment'];
  const MS = await session(MFILE, one, async p => { await pull(p); return importNow(p); });
  const SB1 = await session(FILE, COPIES, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkOverlay tr[data-bxfl-pk="2"]'); await p.click('#bxFlPkNext'); return importNow(p); });
  await ok(`probe vs ${REF}: a SubLoads project copy gives exactly main's import of the same payload`, () => { assert.equal(MS.state.bxSrc.foundationLoads.producedAt, SB.producedAt); assert.deepEqual(diff(MS, SB1), []); });

  // 7: 390 px
  await session(FILE, COPIES, async p => {
    await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, box: document.querySelector('#bxFlPkOverlay [role=dialog]').getBoundingClientRect().right }));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'spread-footing-picker-390.png') });
    await ok('390 px: the picker fits the screen (no horizontal page scroll)', () => { assert.ok(w.box <= w.cw + 0.5, S(w)); assert.ok(w.sw <= w.cw, S(w)); });
  }, 390);

  await ok('0 console errors', () => assert.deepEqual(errsAll, []));
} finally { fs.rmSync(MDIR, { recursive: true, force: true }); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
