#!/usr/bin/env node
// Bridge Substructure Loading: input check (SLIC, engineer request 2026-11-10: "invalid input must be highlighted so the user can fix it, and
// results must not be displayed", the rule of the Steel Bridge app #1283). Checks, through the page's own inputs:
//   - every invalid class (below zero, zero, blank, text, out of a bound, not whole, a load factor cell, a reaction cell, a cross check):
//     results blocked on the output tab, the Report and the strip (placeholder of the same height), the field outlined with its message,
//     the input tab and unit counts, the banner link opens the tab and focuses the field, and fixing it brings back the same result
//     (Pier 1 Strength I axial at the bottom of the footing, 3,494.2 kip for the default project);
//   - the span list: "abc", −50 and 0 in a table cell block the results (the last valid list is never used meanwhile), the link focuses the cell;
//   - an old project with a now-invalid value opens, shows the error and keeps the value (also in autosave);
//   - while blocked, Print / DXF / abutment and foundation loads sends are held (nothing written to the hand-off keys); pulls still work;
//   - 390 px: no sideways scroll with the banner;
//   - valid inputs: every computed result identical to a reference version (default --ref origin/main; --no-ref to skip): five projects
//     (default; wall pier in water with ice, debris and barge; pile bent and hammerheads with ship and vehicle collision, MassDOT, a curve
//     and an expansion joint; single span with Coulomb backfill, approach slab, Sa table, agency γEH and load factor overrides; rectangular
//     columns on individual footings with a pinned base, a joint, elastomeric rows and sidewalks): combine(k) and comboComps for every unit
//     and limit state, MODEL.C, the abutment hand-off payload, the text of every output tab for every unit, the Report text (which only
//     gains the "Input checks" note) and the strip.
//   node tests/smoke/bsl-inputcheck.mjs [--ref <git ref> | --no-ref] [--shots <dir>]
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execSync } from 'child_process';
import { openPage, REPO } from '../lib.mjs';

const FILE = path.join(REPO, 'Bridge Substructure Loading.html');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const REF = process.argv.includes('--no-ref') ? null : (arg('--ref') || 'origin/main'), SHOTS = arg('--shots');
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok  ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e && e.message).slice(0, 400)); } };
const near = (a, e, tol, m) => assert.ok(Math.abs(a - e) <= tol, `${m}: ${a} vs ${e}`);
const AXIAL = 3494.1634;   // Pier 1, Strength I maximum, axial at the bottom of the footing, default project (kip)

const { b, p, errs, ctx } = await openPage(FILE);
const sleep = ms => p.waitForTimeout(ms);
try {
  await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsInputCheck);
  await sleep(300);
  const axial = () => p.evaluate(() => { const d = unitRes(1).UM.defs, q = d.findIndex(x => x.grp === 'Resultant' && /^Axial, bottom of footing/.test(x.label)); const C = combine(1); return C && C.StrI ? C.StrI.max[q] : NaN; });
  const state = () => p.evaluate(() => ({
    errs: SubLoadsInputCheck.collect(), banner: !!document.querySelector('.tab-panel.active .ic-banner'), blocked: !!document.querySelector('.tab-panel.active.ic-blocked') || !!document.querySelector('#tab-report.active .ic-banner'),
    tabText: (document.querySelector('.tab-panel.active') || {}).innerText || '', stripH: document.getElementById('strip-host').getBoundingClientRect().height,
    strip: document.getElementById('strip-host').innerText, note: document.getElementById('strip-note').innerText,
    badges: Object.fromEntries([...document.querySelectorAll('.itab')].map(b => [b.dataset.pane, (b.querySelector('.ic-n') || {}).textContent || ''])) }));
  const pane = (pn, k) => p.evaluate(([pn, k]) => { P.ui.itab = pn; if (k != null) P.ui.sel = k; buildSide(); }, [pn, k]);
  const show = id => p.evaluate(id => showTab(id), id);
  await show('summary'); await sleep(100);
  const s0 = await state(), a0 = await axial(), H0 = s0.stripH;
  await ok('default project: no input error, results shown, Pier 1 Strength I axial at the bottom of the footing 3,494.2 kip', () => {
    assert.deepEqual(s0.errs, []); assert.equal(s0.banner, false); near(a0, AXIAL, 1e-3, 'axial'); assert.ok(H0 > 100, 'strip height ' + H0); });

  /* every invalid class through the page's inputs: [what, tab, unit, path, bad value, fix value, label in the banner, expected message] */
  const CASES = [
    ['below zero (cap width)', 'units', 1, 'units.1.cap.b', '-4.5', '4.5', 'Cap width (normal to line)', /greater than 0 ft \(entered −4\.5\)/],
    ['zero (cap depth)', 'units', 1, 'units.1.cap.h', '0', '4.5', 'Cap depth', /greater than 0 ft \(entered 0\)/],
    ['blank (column diameter)', 'units', 1, 'units.1.col.D', '', '3.5', 'Column diameter', /[Ee]nter a value/],
    ['text (deck thickness)', 'bridge', null, 'br.ts', 'abc', '8', 'Deck thickness', /"abc" is not a number/],
    ['out of a bound (skew, Supports table)', 'bridge', null, 'br.skews.0', '75', '15', 'Abut. 1 skew', /greater than −60° and less than 60° \(entered 75\)/],
    ['not a whole number (number of columns)', 'units', 1, 'units.1.col.n', '2.5', '3', 'Number of columns', /whole number of 1 or more/],
    ['a fraction above 1 (Ieff / Ig)', 'bridge', null, 'br.Ifac', '1.5', '1', 'Substructure Ieff / Ig', /greater than 0 and at most 1/],
    ['a load factor cell below zero', 'bridge', null, 'br.lf.StrI.dcMax', '-1', '', 'Strength I DC max load factor', /0 or more/],
    ['a reaction cell that is not a number', 'rx', 0, 'rx.data.0.0.dc1', 'x12', '43.6', 'G1 DC1', /"x12" is not a number/],
    ['negative bearing height', 'units', 0, 'units.0.hb', '-1', '4.5', 'Bearing height', /0 in or more/],
  ];
  for (const [what, tab, k, pth, bad, fix, label, msg] of CASES) {
    await show('summary'); await pane(tab, k);
    await p.fill(`#sidebar [data-k="${pth}"]`, bad); await sleep(450);
    const s = await state(), e = s.errs.find(x => x.path === pth);
    const fld = await p.evaluate(pth => { const i = document.querySelector(`#sidebar [data-k="${pth}"]`), f = i.closest('.fld'), t = i.closest('table');
      const m = f ? f.querySelector('.ic-msg') : t && t.nextElementSibling && t.nextElementSibling.classList.contains('ic-msg') ? t.nextElementSibling : null;
      return { bad: i.classList.contains('ic-bad'), msg: m ? m.textContent : '' }; }, pth);
    await ok(`${what}: listed, results blocked (tab, Report, strip), field marked, tab count`, async () => {
      assert.ok(e, 'error listed'); assert.equal(e.label, label); assert.match(e.msg, msg);
      assert.ok(s.banner && s.blocked, 'banner on the Summary tab'); assert.doesNotMatch(s.tabText, /kip/, 'no result on the Summary tab');
      assert.match(s.tabText, /1 input needs fixing before results can be shown/); assert.ok(Math.abs(s.stripH - H0) < 1, `strip height ${s.stripH} vs ${H0}`); assert.match(s.strip, /Elevation not drawn/);
      assert.match(s.note, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))); assert.equal(s.badges[tab], '1');
      assert.ok(fld.bad, 'field outlined'); assert.match(fld.msg, msg);
      await show('report'); await sleep(200); const r = await state(); assert.ok(r.banner || /needs fixing/.test(r.tabText), 'Report blocked'); assert.doesNotMatch(r.tabText, /Calculation Report/);
      await show('combo'); await sleep(100); const c = await state(); assert.ok(c.banner); assert.doesNotMatch(c.tabText, /kip/); });
    await ok(`${what}: the banner link opens the input tab and focuses the field`, async () => {
      await show('dl'); await pane(tab === 'units' ? 'project' : 'units', 2); await sleep(50);
      await p.click('.tab-panel.active .ic-banner a[data-icgo="0"]'); await sleep(100);
      const f = await p.evaluate(() => ({ itab: P.ui.itab, sel: P.ui.sel, k: document.activeElement && document.activeElement.dataset.k }));
      assert.equal(f.itab, tab); assert.equal(f.k, pth); if (tab === 'units') assert.equal(f.sel, k); });
    await p.fill(`#sidebar [data-k="${pth}"]`, fix); await sleep(450); await show('summary'); await sleep(50);
    const s2 = await state(), a2 = await axial();
    await ok(`${what}: fixed, results back and unchanged (axial ${a2.toFixed(1)} kip)`, () => {
      assert.deepEqual(s2.errs, []); assert.equal(s2.banner, false); assert.equal(s2.badges[tab], ''); near(a2, AXIAL, 1e-3, 'axial'); assert.ok(Math.abs(s2.stripH - H0) < 1); });
  }
  await ok('cross check: backfill slope β at or above φ on an abutment is an input error (was: no earth loads, silently)', async () => {
    await pane('units', 0); await p.fill('#sidebar [data-k="units.0.earth.beta"]', '40'); await sleep(450);
    const s = await state(); assert.ok(s.errs.some(e => e.path === 'units.0.earth.beta' && /less than φ \(32°\)/.test(e.msg)));
    await p.fill('#sidebar [data-k="units.0.earth.beta"]', '0'); await sleep(450); assert.deepEqual((await state()).errs, []); });
  if (SHOTS) {   // the Units pane with a field error and the blocked Summary
    await pane('units', 1); await p.fill('#sidebar [data-k="units.1.cap.b"]', '-4.5'); await p.fill('#sidebar [data-k="units.1.col.D"]', '0'); await sleep(450); await show('summary'); await sleep(100);
    await p.screenshot({ path: path.join(SHOTS, '1-blocked-desktop.png') });
    await p.fill('#sidebar [data-k="units.1.cap.b"]', '4.5'); await p.fill('#sidebar [data-k="units.1.col.D"]', '3.5'); await sleep(450);
  }

  /* the span list table: a cell that is not valid blocks the results while it is there; the saved list is never used meanwhile */
  for (const bad of ['abc', '-50', '0']) {
    await show('summary'); await pane('bridge');
    const cell = '#sidebar #f_spans + * tr[data-sli-r="1"] input.sli-in';
    await p.fill(cell, bad); await sleep(450);
    const s = await state(), spans = await p.evaluate(() => P.br.spans.join(','));
    await ok(`span list "${bad}" in row 2: blocked while the cell is there, the cell and the field marked, the saved list unchanged`, () => {
      const e = s.errs.find(x => x.list === 'f_spans'); assert.ok(e, 'error listed'); assert.equal(e.label, 'Span length 2'); assert.equal(e.cell, 1);
      assert.ok(s.banner); assert.equal(spans, '110,140,110'); assert.equal(s.badges.bridge, '1'); });
    await p.click('#sidebar [data-k="br.ohL"]'); await sleep(450);   // focus leaves the table: the tool refuses the list (as before) and it stays blocked
    const s1 = await state();
    await ok(`span list "${bad}": still blocked after the focus leaves, the cell text kept`, async () => {
      assert.ok(s1.banner); assert.equal(await p.inputValue(cell), bad); assert.ok(await p.evaluate(() => document.querySelector('#f_spans').closest('.fld').classList.contains('bad'))); });
    await ok(`span list "${bad}": the link focuses the cell, after another tab was opened`, async () => {
      await pane('units', 1); await p.click('.tab-panel.active .ic-banner a[data-icgo="0"]'); await sleep(100);
      assert.equal(await p.evaluate(() => P.ui.itab), 'bridge'); assert.equal(await p.evaluate(() => document.activeElement && document.activeElement.value), bad); });
    if (SHOTS && bad === 'abc') { await p.setViewportSize({ width: 390, height: 900 }); await sleep(200); await p.evaluate(() => { document.querySelector('#f_spans').scrollIntoView({ block: 'center' }); }); await p.screenshot({ path: path.join(SHOTS, '3-list-390px.png') }); await p.setViewportSize({ width: 1400, height: 1000 }); await sleep(200); }
    await p.fill(cell, '140'); await p.click('#sidebar [data-k="br.ohL"]'); await sleep(450);
    const s2 = await state(), a2 = await axial();
    await ok(`span list "${bad}": fixed, results back and unchanged`, () => { assert.deepEqual(s2.errs, []); assert.equal(s2.banner, false); near(a2, AXIAL, 1e-3, 'axial'); });
  }

  await ok('while blocked: Print, DXF, Export abutments and the abutment and foundation loads sends are held; nothing reaches the hand-off keys', async () => {
    await pane('units', 1); await p.fill('#sidebar [data-k="units.1.cap.b"]', '-4.5'); await sleep(450);
    await p.evaluate(() => { localStorage.removeItem('bridgeSuite.v1.abutmentLoads'); localStorage.removeItem('bridgeSuite.v1.foundationLoads'); });
    for (const id of ['btn-abx-send', 'btn-fdx', 'btn-print', 'btn-dxf']) { await p.evaluate(id => document.getElementById(id).click(), id); await sleep(80);
      assert.match(await p.evaluate(() => document.getElementById('flash').textContent), /^Held: 1 input needs fixing/, id); }
    assert.equal(await p.evaluate(() => localStorage.getItem('bridgeSuite.v1.abutmentLoads')), null); assert.equal(await p.evaluate(() => document.getElementById('fdx-modal')), null);
    await pane('project'); assert.match(await p.evaluate(() => document.getElementById('icHoNote').textContent), /Sending is held/);
    await p.evaluate(() => document.getElementById('rx-pull') && document.getElementById('rx-pull').click()); await sleep(100);   // a pull still runs (no reactions sent here: it says so)
    await pane('units', 1); await p.fill('#sidebar [data-k="units.1.cap.b"]', '4.5'); await sleep(450);
    await p.evaluate(() => document.getElementById('btn-abx-send').click()); await sleep(80);
    assert.ok(await p.evaluate(() => !!localStorage.getItem('bridgeSuite.v1.abutmentLoads')), 'sent once valid'); });

  await ok('an old project with a now-invalid value opens, shows the error and keeps the value (and autosave keeps it)', async () => {
    const r = await p.evaluate(async () => { const j = JSON.parse(JSON.stringify(P)); j.units[1].cap.b = -4.5; j.br.ts = ''; j.ui.tab = 'summary'; openProject(j, 'old.subloads.json');
      await new Promise(r => setTimeout(r, 500)); return { b: P.units[1].cap.b, ts: P.br.ts, e: SubLoadsInputCheck.collect().map(x => x.path), saved: JSON.parse(localStorage.getItem('subloads_v1')).units[1].cap.b }; });
    assert.equal(r.b, -4.5); assert.equal(r.ts, ''); assert.equal(r.saved, -4.5); assert.deepEqual(r.e.sort(), ['br.ts', 'units.1.cap.b']);
    const s = await state(); assert.ok(s.banner); assert.match(s.tabText, /2 inputs need fixing/); assert.equal(s.badges.bridge, '1'); assert.equal(s.badges.units, '1'); });
  await ok('390 px: the banner and the Units pane fit the width (no sideways scroll)', async () => {
    await p.setViewportSize({ width: 390, height: 900 }); await sleep(300); await pane('units', 1); await show('summary'); await sleep(150);
    const w = await p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth })); assert.ok(w.sw <= w.cw + 1, JSON.stringify(w));
    if (SHOTS) { await p.evaluate(() => document.querySelector('.tab-panel.active .ic-banner').scrollIntoView({ block: 'start' })); await p.screenshot({ path: path.join(SHOTS, '2-blocked-390px.png') }); }
    await p.setViewportSize({ width: 1400, height: 1000 }); });
  await ok('the input ranges are noted on the Project tab (CLAUDE.md §6)', async () => {
    await pane('project'); const t = await p.evaluate(() => document.getElementById('icRanges').parentElement.innerText);
    assert.match(t, /Input checks: results are shown only while every input in use is valid/); assert.match(t, /Cap width \(normal to line\): greater than 0 ft/); assert.match(t, /Skew: greater than −60° and less than 60°/); });
  await ok('0 console errors', () => assert.deepEqual(errs, []));
} finally { await b.close(); }

/* valid inputs: identical results to the reference version */
if (REF) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsl-ic-ref-'));
  execSync(`git -C "${REPO}" archive ${REF} "Bridge Substructure Loading.html" shared | tar -x -C "${dir}"`);
  const PROJ = async () => {   // the five projects, built on the page (the same code in both versions)
    const out = [], sleep = ms => new Promise(r => setTimeout(r, ms));
    const snap = async name => { recompute(); await sleep(30); out.push({ name, j: JSON.parse(JSON.stringify(P)) }); };
    P = defP(); syncSupports(); await snap('default');
    P = defP(); P.br.spans = [95, 120]; syncSupports(); P.br.skews = [-20, -20, -20]; P.br.elev = [110, 112.5, 111];
    { const u = P.units[1]; u.type = 'wall'; fillUnit(u, 1, 3); u.wall.nose = 'point'; u.topFtg = 90; u.ground = 96; syncSupports(); recompute(); fillWater(u);
      Object.assign(u.water, { on: 'yes', wse: 102, v: 6, scour: 92, wseC: 104, vC: 8, scourC: 91, angle: 10, debris: 'yes', debW: 18, debD: 5, ice: 'yes', iceT: 1.2, iceP: 20, iceZ: 101, iceA: 20, iceB: '', iceF: 12, iceStat: 2, iceVert: 15 });
      fillCol(u); Object.assign(u.cv, { on: 'yes', type: 'barge', W: 1500, Vs: 5, BB: 50, CH: 1.25, mhw: 100, chAng: 15 }); }
    [0, 2].forEach(i => { P.units[i].topFtg = 95; P.units[i].ground = 100; }); P.br.V = 115; P.br.exp = 'D'; P.br.tProc = 'B'; P.br.tMaxB = 100; P.br.tMinB = -20; P.br.mu = 0.08;
    await snap('wall-water-barge');
    P = defP(); P.br.spans = [80, 100, 100, 80]; syncSupports();
    { P.units[1].type = 'pile'; fillUnit(P.units[1], 1, 5); P.units[1].ground = 108; P.units[2].type = 'ham'; P.units[2].ham.shape = 'round'; P.units[3].type = 'ham'; syncSupports(); recompute();
      const u = P.units[2]; fillCol(u); Object.assign(u.cv, { on: 'yes', type: 'ship', DWT: 8000, Vs: 7, mhw: 104, chAng: -10 }); u.cv.daf = 1.2;
      const v = P.units[3]; fillCol(v); Object.assign(v.ct, { on: 'yes', prot: 'none', dirMode: 'road', road: 20, hit: 'ext' }); }
    P.br.owner = 'massdot'; P.br.Rc = 1500; P.br.Vd = 45; P.br.nBR = 2; P.br.traffic = 'one'; P.br.joint[2] = 'joint'; syncSupports(); P.units[2].rowOff = 1.5;
    await snap('pile-ham-ship-massdot');
    P = defP(); P.br.spans = [120]; syncSupports(); recompute();
    { const u = P.units[0]; fillEarth(u); Object.assign(u.earth, { method: 'coulomb', delta: 20, phi: 34, beta: 5, gamma: 0.125, hw: 3, asOn: 'yes', asW: '', asL: 25, asT: 15, asPct: 50, asLL: 'yes', esQ: 0.1, constrFill: 6, gLLc: 1.5 }); fillEarth(P.units[1]); }
    P.br.eqSa = [0.18, 0.182, 0.19, 0.21, 0.25, 0.29, 0.32, 0.36, 0.37, 0.36, 0.34, 0.3, 0.26, 0.19, 0.14, 0.09, 0.066, 0.042, 0.03, 0.023, 0.014, 0.0095];
    P.br.eqSiteClass = 'D'; P.br.gEQ = 0.5; P.br.ehEQmode = 'agency'; P.br.gEHEQ = 1.2; P.br.lf = P.br.lf || {}; P.br.lf.StrI = { dcMax: 1.3, ll: 1.8 }; P.br.khR = 0.6; P.br.kv = 0.1;
    await snap('abut-earth-seismic');
    P = defP(); P.br.joint[1] = 'joint'; syncSupports();
    { const u = P.units[1]; u.col.shape = 'rect'; u.col.bx = 3; u.col.by = 4; u.ftg.type = 'indiv'; u.ftg.Bi = 9; u.ftg.Wi = 11; u.base = 'pinned'; u.rows[1].brg = 'elast'; u.rowOff = 1.0; u.mu = 0.05;
      const v = P.units[2]; v.ftg.Lauto = false; v.ftg.L = 24; }
    P.br.swL = 1.5; P.br.barL = 3; P.br.swR = 4; P.br.barR = 5.5; P.br.plP = 0.09; P.br.skKg = 900000; P.br.alpha = 6.5e-6; P.br.shStrain = 0.0002; P.br.Ifac = 0.7; P.br.lat = 42.3; P.br.lon = -71.1;
    await snap('mcb-rect-indiv-joint-sidewalk');
    return out;
  };
  const DUMP = async j => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), jj = JSON.parse(JSON.stringify(j)); jj.ui = Object.assign({}, jj.ui, { tab: 'manual' }); openProject(jj, 'probe'); await sleep(300);
    const o = { tabs: {}, num: {} }, fl = v => JSON.stringify(v, (k, x) => (x instanceof Float64Array || Array.isArray(x)) ? Array.from(x).map(y => typeof y === 'number' ? +y.toPrecision(12) : y) : x);
    const ids = TABS.filter(t => t !== '|' && t[0] !== 'v3d').map(t => t[0]);
    for (let k = 0; k < P.units.length; k++) { P.ui.sel = k;
      for (const id of ids) { if (k && ['summary', 'geometry', 'manual'].includes(id)) continue; showTab(id); await sleep(15); o.tabs[id + '~' + k] = document.getElementById('tab-' + id).innerText; }
      try { o.num['combine' + k] = fl(combine(k)); } catch (e) { o.num['combine' + k] = 'ERR ' + e.message; }
      o.num['comps' + k] = fl(COMBOS.map(c => { try { return comboComps(k, c); } catch (e) { return 'ERR'; } })); }
    try { const a = abutHandoffPayload(); o.num.abx = fl(a.err ? a : JSON.parse(JSON.stringify(a.p, (k, v) => (/At$/.test(k) || k === 'exported') ? undefined : v))); } catch (e) { o.num.abx = 'ERR ' + e.message; }
    o.num.C = fl(MODEL.C);
    showTab('report'); await sleep(2500); o.report = SLR.doc ? SharedReport.text(SLR.doc) : 'NO DOC'; showTab('summary'); await sleep(50);
    o.strip = document.getElementById('strip-host').innerHTML; o.ic = window.SubLoadsInputCheck ? SubLoadsInputCheck.collect().length : 0;
    return o;
  };
  const run = async file => { const { b, p } = await openPage(file); try { await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await p.waitForTimeout(300);
    const projs = await p.evaluate(PROJ), res = []; for (const q of projs) res.push({ name: q.name, o: await p.evaluate(DUMP, q.j) }); return res; } finally { await b.close(); } };
  const A = await run(path.join(dir, 'Bridge Substructure Loading.html')), B = await run(FILE);
  let n = 0;
  // SLAL (2026-11-11): the abutment-length note (Geometry tab, Report) and its two input-check ranges are display text new on this
  // branch; taken out of both sides' text (every result is still compared)
  const slal = t => typeof t !== 'string' ? t : t.replace(/\n?Abutment length: L[\s\S]*?as before this input was added\.(?=\n|$)/g, '').replace(/Abutment length along the bearing line L_ab: blank or greater than 0 ft; (Footing length L_ftg: blank or greater than 0 ft; )?/g, '');
  [...A, ...B].forEach(r => { const o = r.o; Object.keys(o.tabs).forEach(k => { o.tabs[k] = slal(o.tabs[k]); }); o.report = slal(o.report); });
  for (let i = 0; i < A.length; i++) { const a = A[i], bb = B[i].o;
    const keys = [...Object.keys(a.o.num).map(k => ['num', k]), ...Object.keys(a.o.tabs).filter(k => !/^manual~/.test(k)).map(k => ['tabs', k])];   // the Manual (static text) is not compared (SLDW rewrote its drawings paragraphs; tests/smoke/bsl-drawings.mjs checks them)
    const diff = keys.filter(([g, k]) => a.o[g][k] !== bb[g][k]).map(x => x.join('.')); n += keys.length + 2;
    const la = a.o.report.split('\n'), lb = bb.report.split('\n'), extra = lb.filter(l => !la.includes(l)), miss = la.filter(l => !lb.includes(l));
    console.log(`  ${a.name}: ${keys.length} results and tabs compared, ${diff.length} different; Report ${la.length} → ${lb.length} lines (+${extra.length} "Input checks", −${miss.length})`);
    await ok(`valid inputs (${a.name}): every result identical to ${REF}; the Report only gains the Input checks note; no input error`, () => {
      assert.deepEqual(diff, []); assert.equal(a.o.strip, bb.strip, 'strip'); assert.deepEqual(miss, []); assert.equal(bb.ic, 0);
      assert.ok(extra.every(l => /Input checks|^• |results are shown only while/.test(l)), JSON.stringify(extra.filter(l => !/Input checks|^• |results are shown only while/.test(l))).slice(0, 300)); });
  }
  console.log(`  identical-results probe: ${n} items over ${A.length} projects`);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(fails ? `${fails} FAILED` : 'all passed');
process.exit(fails ? 1 : 0);
