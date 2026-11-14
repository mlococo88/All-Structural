#!/usr/bin/env node
// Spread Footing: project picker of the foundation-load pull (SFPK, 2026-11-11; HANDOFF.md §4.6, §5.1; shared/handoff-store.js, read only).
//   Seeded copies (synthetic payloads at the top of the footing, Cloud sync off): SubLoads per-project copies of two projects
//   (bridgeSuite.v1.foundationLoads.by.subloads.<pid>), .by.subloads (= project A's copy), .by.abutment (project A, newest), the channel key (= the abutment's).
//   1. "Pull from Abutment / SubLoads" opens the picker: "Latest sent" + one row per copy (the same payload once), both senders, project, unit,
//      "last unit sent for this project" on SubLoads project copies, newest first; preselected: the newest copy of the open project (this
//      tool's project name).
//   2. A copy older than the latest of its project and unit is flagged (FPU; before: of its project), a copy of another unit is not; "Next: review" opens the same review dialog with that copy only; Import applies it.
//   3. No open project: "Latest sent" preselected; it opens the review exactly as before (sender list).
//   4. Old data (no per-project copy): the pull opens the review at once, as before.
//   5. #1417 (SFWP): a pull through the picker into a wall in per-foot entry switches it to Total, the direct set = the sent totals.
//   6. Probe vs main (§4): the latest copy picked here, "Latest sent", and a SubLoads copy give exactly main's state and results (adoptedAt aside).
//   8. (FPU) per-unit copies: SubLoads units of one project and the Abutment Calculator's project copy, each its own row (no "last unit"
//      caveat); a pre-FPU project copy of the same unit flagged older; default = newest of the open project, then after a pull the unit last
//      pulled; probe vs main for a unit copy and the Abutment copy.
//   7. 390 px: the picker fits (no horizontal page scroll); screenshots to $PICK_SHOTS (optional); 0 console errors.
//   node tests/smoke/spread-footing-fdx-picker.mjs [--a origin/main]
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO, diff } from '../lib.mjs';
import { makeGitHubMock } from '../engine/gh-mock.mjs';

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
  delete st.bous;   // SFBQ (2026-11-14): the Bearing 3.5 display inputs (absent on a main before SFBQ-2; no result depends on them)
  const Rj = js(R); (Rj.peds || []).forEach(q => delete q.pf); return { state: st, R: Rj, P2: js(P2) }; });
// origin/main has the SFPK picker since #1422: on main, take its preselected row when it opens
async function mainPull(p) { await pull(p); await p.waitForSelector('#bxFlPkOverlay, #bxFlGo', { timeout: 15000 }); if (await p.$('#bxFlPkOverlay')) await p.click('#bxFlPkNext'); return importNow(p); }
async function importNow(p) { await p.waitForSelector('#bxFlGo', { timeout: 15000 }); await p.click('#bxFlGo'); await p.waitForTimeout(1200); return snap(p); }
const errsAll = [];
async function session(file, ls, fn, vw = 1400) { const o = await openPage(file, { ls, vw, vh: 1000 }); try { await ready(o.p); return await fn(o.p, o); } finally {
  // FPU cloud section: with Cloud sync set up the page may ask GitHub before the test routes api.github.com to gh-mock; that blocked load is not a page error
  const gh = o.blocked.size > 0 && [...o.blocked].every(u => /^https:\/\/api\.github\.com\//.test(u));
  errsAll.push(...o.errs.filter(e => !(gh && /^Failed to load resource: net::ERR_FAILED$/.test(e))).map(e => path.basename(path.dirname(file)) + '/' + path.basename(file) + ': ' + e)); await o.b.close(); } }

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
      assert.match(rows[3].t, /SubLoads Bridge B Pier 2 \(last unit sent for this project\)/);
      // FPU (2026-11-11): "older" is per project AND unit: the newer Abutment copy (another unit) no longer flags SubLoads' Pier 1
      assert.doesNotMatch(rows[2].t, /older/); assert.doesNotMatch(rows[1].t, /older/); });
    await ok('default: the newest copy of the open project (this tool\'s project name "Bridge A": Abutment)', () => assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [0]));
    await p.click('#bxFlPkOverlay tr[data-bxfl-pk="1"]');
    const note = await p.evaluate(() => (document.getElementById('bxFlPkOlder') || {}).innerText || '');
    await ok('a copy of another unit is not flagged older (FPU: per project and unit)', () => assert.equal(note, ''));
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
  const M = await session(MFILE, COPIES, async p => mainPull(p));
  const B1 = await session(FILE, COPIES, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkOverlay tr[data-bxfl-pk="0"]'); await p.click('#bxFlPkNext'); return importNow(p); });
  const B2 = await session(FILE, COPIES, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkNext'); return importNow(p); });
  await ok(`probe vs ${REF} (${sha}): the newest copy picked gives exactly main's state and results`, () => { assert.equal(M.state.bxSrc.foundationLoads.producedAt, AB.producedAt); assert.deepEqual(diff(M, B1), []); });
  await ok(`probe vs ${REF}: "Latest sent" gives exactly main's state and results`, () => assert.deepEqual(diff(M, B2), []));
  const one = { ...LEGACY, [NS]: S(SB), [NS + '.by.subloads']: S(SB) }; delete one[NS + '.by.abutment'];
  const MS = await session(MFILE, one, async p => mainPull(p));
  const SB1 = await session(FILE, COPIES, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkOverlay tr[data-bxfl-pk="2"]'); await p.click('#bxFlPkNext'); return importNow(p); });
  await ok(`probe vs ${REF}: a SubLoads project copy gives exactly main's import of the same payload`, () => { assert.equal(MS.state.bxSrc.foundationLoads.producedAt, SB.producedAt); assert.deepEqual(diff(MS, SB1), []); });

  // 8 (FPU, 2026-11-11): per-unit copies. SubLoads project A: Abut. 1, Pier 1, Pier 2 each its own copy (.by.subloads.<pid>.support-<n>); the project
  //   copy written before this change (Pier 1 at 08:00, older data); .by.subloads = Pier 2 (listed once); the Abutment Calculator's project copy of A
  //   for its SubLoads unit "Abut. 1" (.by.abutment.<pid>.Abut%2E 1).
  const U = (lab, k, at, P) => Object.assign(mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', A, lab, at, P), { element: { type: k ? 'pier' : 'abutment', label: lab, unitIndex: k } });
  const U2old = U('Pier 1', 1, '2026-11-11T08:00:00.000Z', 880), U1 = U('Abut. 1', 0, '2026-11-11T09:30:00.000Z', 800), U2 = U('Pier 1', 1, '2026-11-11T10:00:00.000Z', 900), U3 = U('Pier 2', 2, '2026-11-11T10:30:00.000Z', 950);
  const UNITS = { ...LEGACY, [NS + '.by.subloads']: S(U3), [NS + '.by.subloads.B-1~Bridge A']: S(U2old), [NS + '.by.subloads.B-1~Bridge A.support-1']: S(U1),
    [NS + '.by.subloads.B-1~Bridge A.support-2']: S(U2), [NS + '.by.subloads.B-1~Bridge A.support-3']: S(U3), [NS + '.by.abutment.B-1~Bridge A.Abut%2E 1']: S(AB), [NS + '.by.subloads.~Bridge B']: S(SB) };
  await session(FILE, UNITS, async p => {
    await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const rows = await pickRows(p);
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'spread-footing-picker-units-1400.png') });
    await ok('per-unit copies: one row per unit (Abutment A, Pier 2, Pier 1, Abut. 1, Bridge B, A\'s pre-FPU project copy), no "last unit" caveat on unit copies', () => {
      assert.equal(rows.length, 7, S(rows));
      assert.match(rows[1].t, /Abutment Calculator B-1 — Bridge A Abut 1 .*\(unit copy\)/); assert.match(rows[2].t, /SubLoads B-1 — Bridge A Pier 2 .*\(unit copy\)/);
      assert.match(rows[3].t, /SubLoads B-1 — Bridge A Pier 1 .*\(unit copy\)/); assert.match(rows[4].t, /SubLoads B-1 — Bridge A Abut\. 1 .*\(unit copy\)/);
      assert.match(rows[5].t, /SubLoads Bridge B Pier 2 \(last unit sent for this project\)/);
      rows.slice(1, 5).forEach(r => { assert.doesNotMatch(r.t, /last unit sent|older/); });
      assert.match(rows[6].t, /SubLoads B-1 — Bridge A Pier 1 \(last unit sent for this project\) .*\(project copy\) older/); });
    await ok('per-unit default (nothing pulled yet): the newest copy of the open project (Abutment, Bridge A)', () => assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [0]));
    await p.click('#bxFlPkOverlay tr[data-bxfl-pk="5"]');
    const note = await p.evaluate(() => (document.getElementById('bxFlPkOlder') || {}).innerText || '');
    await ok('the pre-FPU Pier 1 copy is flagged older than the Pier 1 unit copy', () => assert.match(note, /older than the latest hand-off for the same project and unit: SubLoads, .*Pier 1/));
    await p.click('#bxFlPkOverlay tr[data-bxfl-pk="2"]'); await p.click('#bxFlPkNext');
    const X = await importNow(p);
    await ok('a unit copy applies exactly that unit (Pier 1, direct P = 900)', () => { const s = X.state.bxSrc.foundationLoads; assert.equal(s.producedAt, U2.producedAt); assert.equal(s.element.label, 'Pier 1'); assert.equal(X.state.peds[s.pedIndex].direct.P, 900); });
    await p.evaluate(() => { const o = document.getElementById('bxFlOverlay'); if (o) o.remove(); });
    await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const r2 = await pickRows(p), txt = await p.evaluate(() => document.getElementById('bxFlPkOverlay').innerText);
    await ok('default after a pull: the open project\'s copy of the unit last pulled (Pier 1), said so', () => { assert.deepEqual(r2.filter(r => r.on).map(r => r.i), [2]); assert.match(txt, /the copy of the unit last pulled into the open project/); });
  });
  const B3 = await session(FILE, UNITS, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkOverlay tr[data-bxfl-pk="1"]'); await p.click('#bxFlPkNext'); return importNow(p); });
  const one3 = { ...LEGACY, [NS]: S(U3), [NS + '.by.subloads']: S(U3) }; delete one3[NS + '.by.abutment'];
  const M3 = await session(MFILE, one3, async p => mainPull(p));
  await ok(`probe vs ${REF}: a SubLoads unit copy (Pier 2) gives exactly main's state and results for the same payload`, () => { assert.equal(M3.state.bxSrc.foundationLoads.producedAt, U3.producedAt); assert.deepEqual(diff(M3, B3), []); });
  const B4 = await session(FILE, UNITS, async p => { await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkOverlay tr[data-bxfl-pk="0"]'); await p.click('#bxFlPkNext'); return importNow(p); });
  const B5 = await session(FILE, UNITS, async p => { await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay'); await p.click('#bxFlPkNext'); return importNow(p); });
  const M5 = await session(MFILE, LEGACY, async p => { await setProj(p, 'Bridge A'); return mainPull(p); });
  await ok(`probe vs ${REF}: the Abutment project copy (default) gives exactly main's pull of the same payload`, () => { assert.equal(B5.state.bxSrc.foundationLoads.producedAt, AB.producedAt); assert.deepEqual(diff(M5, B5), []); assert.deepEqual(diff(M, B4), []); });
  await session(FILE, UNITS, async p => {
    await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'spread-footing-picker-units-390.png') });
    await ok('390 px, per-unit rows: no horizontal page scroll', () => assert.ok(w.sw <= w.cw, S(w)));
  }, 390);

  // 7: 390 px
  await session(FILE, COPIES, async p => {
    await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 10000 });
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, box: document.querySelector('#bxFlPkOverlay [role=dialog]').getBoundingClientRect().right }));
    if (SHOTS) await p.screenshot({ path: path.join(SHOTS, 'spread-footing-picker-390.png') });
    await ok('390 px: the picker fits the screen (no horizontal page scroll)', () => { assert.ok(w.box <= w.cw + 0.5, S(w)); assert.ok(w.sw <= w.cw, S(w)); });
  }, 390);

  // FPU with Cloud sync: unit copies sent from another device (GitHub, gh-mock) are listed as their own rows and apply exactly
  {
    const TOKEN = 'github_pat_SMOKE0000000000000000wxyz', gh = makeGitHubMock({ token: TOKEN }), F = 'handoffs/foundationLoads/subloads/B-1~Bridge A';
    const G1 = Object.assign(mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', A, 'Pier 1', '2026-11-11T12:00:00.000Z', 910), { device: 'Office PC' }); G1.element.unitIndex = 1;
    const G2 = Object.assign(mk('Bridge Substructure Loading', 'Bridge Substructure Loading.html', A, 'Pier 2', '2026-11-11T12:30:00.000Z', 960), { device: 'Office PC' }); G2.element.unitIndex = 2;
    gh.setRemote(F + '.support-2.json', JSON.stringify(G1, null, 1)); gh.setRemote(F + '.support-3.json', JSON.stringify(G2, null, 1)); gh.setRemote(F + '.json', JSON.stringify(G2, null, 1));
    const SYNC = { 'bridgeSuite.v1.githubSync': S({ owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN, device: 'Smoke' }) };
    await session(FILE, SYNC, async (p, o) => {
      await p.route('https://api.github.com/**', async r => { const q = r.request(); const res = gh.handle(q.method(), q.url(), await q.allHeaders(), q.postData()); return r.fulfill({ status: res.status, headers: res.headers, body: res.body }); });
      await setProj(p, 'Bridge A'); await pull(p); await p.waitForSelector('#bxFlPkOverlay', { timeout: 15000 });
      const rows = await pickRows(p);
      await ok('Cloud sync: the GitHub unit copies are their own rows (Pier 2, Pier 1; the project copy of Pier 2 once), device shown, no "last unit" caveat; newest of the project preselected', () => {
        assert.equal(rows.length, 3, S(rows)); assert.match(rows[1].t, /SubLoads B-1 — Bridge A Pier 2 .*Office PC \(GitHub\)/); assert.match(rows[2].t, /SubLoads B-1 — Bridge A Pier 1 .*Office PC \(GitHub\)/);
        rows.forEach(r => assert.doesNotMatch(r.t, /last unit sent|older/)); assert.deepEqual(rows.filter(r => r.on).map(r => r.i), [0]); });
      await p.click('#bxFlPkOverlay tr[data-bxfl-pk="1"]'); await p.click('#bxFlPkNext');
      const X = await importNow(p), src = X.state.bxSrc.foundationLoads;
      await ok('Cloud sync: the GitHub Pier 1 copy applies exactly that payload (producedAt 12:00, Pier 1)', () => { assert.equal(src.producedAt, G1.producedAt); assert.equal(src.element.label, 'Pier 1'); });
    });
  }

  await ok('0 console errors', () => assert.deepEqual(errsAll, []));
} finally { fs.rmSync(MDIR, { recursive: true, force: true }); }
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
