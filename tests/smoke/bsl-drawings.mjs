#!/usr/bin/env node
// Bridge Substructure Loading: the Drawings tab and Export DXF on shared/dxf.js (SLDW, engineer request 2026-11-11). Display and export only.
//   1. Sheets: five projects (the bsl-inputcheck set: default; wall pier in water with ice, debris and barge; pile bent and hammerheads with
//      ship and vehicle collision, MassDOT, a curve and a joint; single span with Coulomb backfill and an Sa table; rectangular columns on
//      individual footings with a joint and sidewalks) on paper D and B: every sheet built (index, plan, elevation, then per unit its
//      elevation, load diagrams, lane arrangements, and the load summaries), numbered N OF M, fits its sheet, the DXF passes
//      SharedDxf.validate, and on every sheet (title block included) no text overlaps another text and no line crosses a text
//      (tests/engine/overlap.mjs textOverlaps / textLineHits, the Steel Bridge and Abutment checks).
//   2. The tab (1440 and 390 px): between the load tabs and Manual / Report; preview (pan / zoom viewer), thumbnails, sheet and paper choice
//      kept per browser (subloads_dwgSheet_v1, subloads_dwgPaper_v1; not in P), Download DXF and Project → Export DXF save a valid file
//      with no network request (offline: no Pyodide / ezdxf), P unchanged, no sideways scroll at 390 px, 0 console errors.
//   3. Input check (#1399): an invalid input shows the error banner (links) instead of the drawings; Export DXF is held.
//   4. Results unchanged (§4): the five projects on --ref (default origin/main) and the working tree: combine / comboComps for every unit and
//      limit state, MODEL.C, the abutment hand-off, the text of every output tab for every unit and the Report text identical; the Manual
//      differs only in its drawings paragraphs.
//   node tests/smoke/bsl-drawings.mjs [--ref <git ref> | --no-ref] [--shots <dir>]
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import vm from 'vm';
import { execSync } from 'child_process';
import { openPage, REPO } from '../lib.mjs';
import { textOverlaps, textLineHits, describe, describeHit } from '../engine/overlap.mjs';

const FILE = path.join(REPO, 'Bridge Substructure Loading.html');
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const REF = process.argv.includes('--no-ref') ? null : (arg('--ref') || 'origin/main'), SHOTS = arg('--shots');
const cx = { window: {} }; vm.createContext(cx); vm.runInContext(fs.readFileSync(path.join(REPO, 'shared/dxf.js'), 'utf8'), cx); const X = cx.window.SharedDxf;
let fails = 0;
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e && e.message).slice(0, 600)); } };
const ready = p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsInputCheck);

/* the five projects of tests/smoke/bsl-inputcheck.mjs, built on the page (the same code in both versions) */
const PROJ = async () => {
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
  { const u = P.units[0]; fillEarth(u); Object.assign(u.earth, { method: 'coulomb', delta: 20, phi: 34, beta: 5, gamma: 0.125, hw: 3, asOn: 'yes', asW: '', asL: 25, asT: 15, asPct: 50, asLL: 'yes', esQ: 0.1, constrFill: 6, gLLc: 1.5 , lsRed: 'no' }); fillEarth(P.units[1]); }
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

console.log('1. Sheets: built, numbered, fit, valid DXF, no text overlaps and no line through a text');
{ const o = await openPage(FILE), p = o.p; await ready(p);
  const projs = await p.evaluate(PROJ); let nS = 0;
  for (const q of projs) for (const paper of ['D', 'B']) {
    const r = await p.evaluate(async ([j, paper]) => { openProject(JSON.parse(JSON.stringify(j)), 'probe'); await new Promise(z => setTimeout(z, 200));
      const B = sldwBuild(paper), t = B.D.toDXF({ ltscale: 1 }), v = SharedDxf.validate(t), nU = P.units.length;
      return { v: { ok: v.ok, errors: v.errors.slice(0, 3) }, nU, units: P.units.map(u => u.name), sheets: B.S.map(s => ({ id: s.id, title: s.title, N: s.N, over: s.over, no: s.sheetEnt.s, E: B.D.E.slice(s.i0, s.i1), nE: s.iC - s.i0 })) }; }, [q.j, paper]);
    await ok(`${q.name}, paper ${paper}: ${r.sheets.length} sheets (${r.sheets.map(s => s.id + ' 1"=' + s.N + "'").join(', ')}), numbered N OF ${r.sheets.length}, every unit drawn, DXF valid`, () => {
      assert.ok(r.v.ok, r.v.errors.join('; '));
      r.sheets.forEach((s, i) => { assert.equal(s.no, `${i + 1} OF ${r.sheets.length}`); assert.ok(!s.over, s.title + ' does not fit'); assert.ok(s.nE > 0, s.title + ' empty'); });
      assert.deepEqual(r.sheets.slice(0, 3).map(s => s.id), ['index', 'plan', 'elev']);
      r.units.forEach((u, k) => { assert.ok(r.sheets.some(s => s.title === `${u}: elevation`), `${u}: elevation`); assert.ok(r.sheets.some(s => s.title.startsWith(`${u}: factored load summary`)), `${u}: load summary`); }); });
    const bad = [];
    for (const s of r.sheets) { nS++; const D = { E: s.E }; textOverlaps(D, X).forEach(x => bad.push(`${s.title}: text over text ${describe(x)}`)); textLineHits(D, X).forEach(x => bad.push(`${s.title}: ${describeHit(x)}`)); }
    await ok(`${q.name}, paper ${paper}: no text overlaps, no line through a text (${r.sheets.length} sheets, title blocks included)`, () => assert.deepEqual(bad, [], bad.slice(0, 8).join('\n')));
  }
  console.log(`       ${nS} sheets checked`);
  await ok('console errors: 0', () => assert.deepEqual(o.errs, []));
  await o.b.close(); }

console.log('2. The Drawings tab');
for (const vw of [1440, 390]) {
  const o = await openPage(FILE, { vw, vh: 900 }), p = o.p; await ready(p); await p.waitForTimeout(300);
  const P0 = await p.evaluate(() => JSON.stringify(Object.assign({}, P, { ui: undefined })));
  await p.click('#tab-bar .tab-btn[data-tab="drawings"]'); await p.waitForSelector('#tab-drawings .sldw-box svg', { timeout: 30000 });
  const a = await p.evaluate(() => ({ order: [...document.querySelectorAll('#tab-bar .tab-btn')].map(b => b.dataset.tab), n: document.querySelectorAll('.sldw-th').length, nb: SLDW.B.S.length,
    opts: document.querySelectorAll('#sldwSheet option').length, tab: P.ui.tab, on: SLDW.on, act: document.querySelector('.tab-panel.active').id, view: !!document.querySelector('.sldw-box .sdx-view'),
    note: document.querySelector('#tab-drawings .slNL').textContent }));
  await ok(`${vw} px: the tab after Vehicle collision, before Manual and Report; preview, ${a.n} thumbnails, not stored in P.ui.tab, the schematic note`, () => {
    const o2 = a.order, i = o2.indexOf('drawings'); assert.equal(o2[i - 1], 'ct'); assert.equal(o2[i + 1], 'manual'); assert.equal(o2[i + 2], 'report');
    assert.ok(a.view && a.n === a.nb && a.opts === a.nb && a.nb >= 10 && a.on && a.act === 'tab-drawings' && a.tab !== 'drawings', JSON.stringify(a));
    assert.match(a.note, /schematic/); assert.match(a.note, /Scale:/); assert.match(a.note, /Simplifications:/); });
  if (SHOTS && vw === 1440) { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, 'drawings-tab-1440.png') }); }
  await p.selectOption('#sldwSheet', 'loads1'); await p.waitForTimeout(200);
  await p.selectOption('#sldwPaper', 'B'); await p.waitForSelector('#tab-drawings .sldw-box svg');
  const b = await p.evaluate(() => ({ cur: SLDW.cur, key: localStorage.getItem('subloads_dwgSheet_v1'), pk: localStorage.getItem('subloads_dwgPaper_v1'), paper: document.querySelector('#sldwPaper').value, head: document.querySelectorAll('#tab-drawings .card-h h2')[1].textContent,
    sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
  await ok(`${vw} px: sheet and paper kept per browser (${b.head}, paper ${b.paper}); no sideways scroll (${b.sw} <= ${b.cw})`, () => {
    assert.equal(b.key, 'loads1'); assert.equal(b.pk, 'B'); assert.equal(b.paper, 'B'); assert.match(b.head, /Pier 1: load diagrams/); assert.ok(b.sw <= b.cw); });
  if (vw === 390 && SHOTS) await p.screenshot({ path: path.join(SHOTS, 'drawings-tab-390.png') });
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#sldwDxf')]);
  const t1 = fs.readFileSync(await dl.path(), 'utf8'), v1 = X.validate(t1);
  await p.evaluate(() => { P.ui.itab = 'project'; buildSide(); });
  const [dl2] = await Promise.all([p.waitForEvent('download'), p.evaluate(() => document.getElementById('btn-dxf').click())]);
  const t2 = fs.readFileSync(await dl2.path(), 'utf8'), v2 = X.validate(t2);
  await ok(`${vw} px: Download DXF and Project → Export DXF: ${dl.suggestedFilename()} (${t1.length} chars), valid, the same file; no network request (offline)`, () => {
    assert.ok(v1.ok && v2.ok, v1.errors.concat(v2.errors).join('; ')); assert.match(dl.suggestedFilename(), /_substructure_sheets\.dxf$/); assert.equal(t1, t2);
    assert.match(t1, /AC1009/); assert.ok(v1.counts.DIMENSION > 0, 'DIMENSION entities'); assert.ok(/S-BORD/.test(t1) && /S-SUBS/.test(t1));
    assert.deepEqual([...o.blocked], []); });
  const c = await p.evaluate(() => ({ P1: JSON.stringify(Object.assign({}, P, { ui: undefined })), py: typeof window.loadPyodide, ls: Object.keys(localStorage).filter(k => /dwg/i.test(k)) }));
  await ok(`${vw} px: the project unchanged; no Pyodide; only the two per-browser keys (${c.ls.join(', ')})`, () => { assert.equal(c.P1, P0); assert.equal(c.py, 'undefined'); assert.deepEqual(c.ls.sort(), ['subloads_dwgPaper_v1', 'subloads_dwgSheet_v1']); });
  await p.click('#tab-bar .tab-btn[data-tab="combo"]'); await p.waitForTimeout(200);
  const d = await p.evaluate(() => ({ on: SLDW.on, act: document.querySelector('.tab-panel.active').id }));
  await ok(`${vw} px: back to a load tab`, () => assert.ok(!d.on && d.act === 'tab-combo', JSON.stringify(d)));
  await ok(`${vw} px: console errors: 0`, () => assert.deepEqual(o.errs, []));
  await o.b.close();
}

console.log('3. Input check: no drawings while an input needs fixing');
{ const o = await openPage(FILE), p = o.p; await ready(p); await p.waitForTimeout(300);
  await p.evaluate(() => { P.ui.itab = 'bridge'; buildSide(); });
  await p.fill('#sidebar [data-k="br.ts"]', 'abc'); await p.waitForTimeout(500);
  await p.click('#tab-bar .tab-btn[data-tab="drawings"]'); await p.waitForTimeout(300);
  const a = await p.evaluate(() => ({ banner: !!document.querySelector('#tab-drawings .ic-block'), links: document.querySelectorAll('#tab-drawings [data-icgo]').length, svg: !!document.querySelector('#tab-drawings svg'), txt: document.getElementById('tab-drawings').innerText }));
  let got = false; p.on('download', () => { got = true; });
  await p.evaluate(() => { P.ui.itab = 'project'; buildSide(); document.getElementById('btn-dxf').click(); }); await p.waitForTimeout(500);
  await ok('the banner with links instead of the sheets; Export DXF held', () => { assert.ok(a.banner && a.links > 0 && !a.svg, JSON.stringify(a)); assert.match(a.txt, /needs fixing/); assert.equal(got, false); });
  await p.evaluate(() => { P.ui.itab = 'bridge'; buildSide(); }); await p.fill('#sidebar [data-k="br.ts"]', '8'); await p.waitForTimeout(500);
  await p.click('#tab-bar .tab-btn[data-tab="drawings"]'); await p.waitForSelector('#tab-drawings .sldw-box svg', { timeout: 30000 });
  await ok('fixed: the sheets are back', async () => assert.ok(await p.evaluate(() => !document.querySelector('#tab-drawings .ic-block'))));
  await ok('console errors: 0', () => assert.deepEqual(o.errs, []));
  await o.b.close(); }

if (SHOTS) {   // a few sheets as images
  const o = await openPage(FILE, { vw: 1600, vh: 1000 }), p = o.p; await ready(p);
  for (const [paper, id] of [['D', 'plan'], ['D', 'unit1'], ['D', 'loads1'], ['D', 'll1'], ['D', 'table1'], ['B', 'unit2'], ['D', 'index']]) {
    const svg = await p.evaluate(([pa, id]) => { const B = sldwBuild(pa), s = B.S.find(q => q.id === id); return SharedDxf.sheetSVG(B.D, s, { width: 2400 }); }, [paper, id]);
    const q = await o.ctx.newPage(); await q.setViewportSize({ width: 2400, height: 1553 }); await q.setContent(`<body style="margin:0;background:#fff">${svg}</body>`); await q.screenshot({ path: path.join(SHOTS, `sheet-${paper}-${id}.png`) }); await q.close(); }
  await o.b.close(); }

console.log('4. Results unchanged (main vs this version)');
if (REF) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bsl-dw-ref-'));
  execSync(`git -C "${REPO}" archive ${REF} "Bridge Substructure Loading.html" shared | tar -x -C "${dir}"`);
  const DUMP = async j => {
    const sleep = ms => new Promise(r => setTimeout(r, ms)), jj = JSON.parse(JSON.stringify(j)); jj.ui = Object.assign({}, jj.ui, { tab: 'manual' }); openProject(jj, 'probe'); await sleep(300);
    const o = { tabs: {}, num: {} }, fl = v => JSON.stringify(v, (k, x) => (x instanceof Float64Array || Array.isArray(x)) ? Array.from(x).map(y => typeof y === 'number' ? +y.toPrecision(12) : y) : x);
    const ids = TABS.filter(t => t !== '|' && t[0] !== 'v3d').map(t => t[0]);
    for (let k = 0; k < P.units.length; k++) { P.ui.sel = k;
      for (const id of ids) { if (k && ['summary', 'geometry', 'manual'].includes(id)) continue; showTab(id); await sleep(15); o.tabs[id + '~' + k] = document.getElementById('tab-' + id).innerText; }
      try { o.num['combine' + k] = fl(combine(k)); } catch (e) { o.num['combine' + k] = 'ERR ' + e.message; }
      o.num['comps' + k] = fl(COMBOS.map(c => { try { return comboComps(k, c); } catch (e) { return 'ERR'; } })); }
    try { const a = abutHandoffPayload(); o.num.abx = fl(a.err ? a : JSON.parse(JSON.stringify(a.p, (k, v) => (/At$/.test(k) || k === 'exported' || k === 'definition' || k === 'notes') ? undefined : v))); } catch (e) { o.num.abx = 'ERR ' + e.message; }   // ABX (2026-11-11): the additive definition block and the payload notes are not compared
    o.num.C = fl(MODEL.C);
    showTab('report'); await sleep(2500); o.report = SLR.doc ? SharedReport.text(SLR.doc) : 'NO DOC'; showTab('summary'); await sleep(50);
    o.strip = document.getElementById('strip-host').innerHTML;
    return o;
  };
  const run = async file => { const { b, p } = await openPage(file); try { await p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await p.waitForTimeout(300);
    const projs = await p.evaluate(PROJ), res = []; for (const q of projs) res.push({ name: q.name, o: await p.evaluate(DUMP, q.j) }); return res; } finally { await b.close(); } };
  const A = await run(path.join(dir, 'Bridge Substructure Loading.html')), B = await run(FILE);
  let n = 0;
  // SLAL (2026-11-11): the abutment-length note (Geometry tab, Report) and its two input-check ranges are display text added after
  // this test; taken out of both sides' text (every result is still compared)
  const slal = t => typeof t !== 'string' ? t : t.replace(/\n?Abutment length: L[\s\S]*?as before this input was added\./g, '').replace(/Abutment length along the bearing line L_ab: blank or greater than 0 ft; (Footing length L_ftg: blank or greater than 0 ft; )?/g, '');
  // SLLS (2026-11-11): the approach-slab LS notes are display text new on that branch (the slab project keeps LS: lsRed 'no')
  const slls = t => typeof t !== 'string' ? t : t.replace(/(\n• *)?\n?Approach slab and LS:[^\n]*/g, '').replace(/, live-load surcharge (removed in the final state \([^)]*\)|kept \(3\.11\.6\.5 reduction not taken\))/g, '')
    .replace(/\n?[^\n]*Live-load surcharge with the approach slab[^\n]*/g, '').replace(/\n?(Final-state live-load surcharge LS removed|Live-load surcharge kept with the approach slab)[^\n]*/g, '')
    .replace(/(\n• *)?\n?Seismic earth location:[^\n]*/g, '').replace(/\n?[^\n]*Seismic earth pressure location[^\n]*/g, '').replace(/\n?\(a\) Seed & Whitman: ΔP_AE at 0\.6H[^\n]*/g, '').replace(/Combined PAE height \/ H: blank or from 0\.4 to 0\.5; /g, '')   // SLPL notes and input-check range (display text)
    .replace(/\n{3,}/g, '\n\n');
  const slgp = t => typeof t !== 'string' ? t : t.replace(/\n?Input ID: [0-9A-F]{8}-[0-9A-F]{4}/g, '');   // SLGP (2026-11-11): the Report title block's Input ID line (display)
  [...A, ...B].forEach(r => { const o = r.o; Object.keys(o.tabs).forEach(k => { o.tabs[k] = slgp(slls(slal(o.tabs[k]))); }); o.report = slgp(slls(slal(o.report))); });
  for (let i = 0; i < A.length; i++) { const a = A[i].o, bb = B[i].o;
    const keys = [...Object.keys(a.num).map(k => ['num', k]), ...Object.keys(a.tabs).filter(k => !/^manual/.test(k)).map(k => ['tabs', k])];
    const diff = keys.filter(([g, k]) => a[g][k] !== bb[g][k]).map(x => x.join('.')); n += keys.length + 2;
    const ma = (a.tabs['manual~0'] || '').split('\n'), mb = (bb.tabs['manual~0'] || '').split('\n'), mOut = ma.filter(l => !mb.includes(l)), mIn = mb.filter(l => !ma.includes(l));
    console.log(`  ${A[i].name}: ${keys.length} results and tabs compared, ${diff.length} different; Report ${a.report === bb.report ? 'identical' : 'DIFFERENT'} (${a.report.split('\n').length} lines); Manual −${mOut.length} / +${mIn.length} lines`);
    await ok(`${A[i].name}: every result, output tab, the strip and the Report identical to ${REF}; the Manual differs only in its drawings text`, () => {
      assert.deepEqual(diff, []); assert.equal(a.report, bb.report, 'Report'); assert.equal(a.strip, bb.strip, 'strip');
      [...mOut, ...mIn].forEach(l => assert.match(l, /DXF|Drawings|Sheets|sheet|Model space|Paper|Preview|Schematic|File:|Offline|Load summary|Dimensions/, 'Manual line: ' + l.slice(0, 120))); });
  }
  console.log(`  identical-results probe: ${n} items over ${A.length} projects`);
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(fails ? `\n${fails} FAILED` : '\nall passed');
process.exit(fails ? 1 : 0);
