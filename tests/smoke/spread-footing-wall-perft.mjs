#!/usr/bin/env node
// Spread Footing: wall loads entered per foot of wall (SFWP, engineer 2026-11-11).
// Headless Chromium, file://, the pinned libraries from tests/libs:
//   1. hand check: a Wall 1 ft x 20 ft (runs along y) on a 6 x 22 ft footing, D: p = 12 kip/ft entered per foot gives the same
//      results as P = 240 kip entered as a total (R and P2 identical apart from the per-foot record R.peds[i].pf; the governing
//      bearing pressure the same); the Report works the conversion (P = p L = 12 x 20 = 240) and lists the entry mode;
//   2. the card: switching the entry to "Per foot of wall" converts the numbers with the current L (240 -> 12, M_y 30 -> 1.5,
//      M_x 50 stays 50), the unit headers read kip/ft and kip-ft/ft (M_x kip-ft), the note shows P = 12.00 x 20.00 = 240.00 and
//      the results do not change; switching back restores the totals;
//   3. a later change of b_y keeps the per-foot values (D.P stays 12, the total becomes 12 x 10 = 120);
//   4. a wall along x: M_x is per foot, M_y stays total;
//   5. wall length 0 with per-foot entry: an input error; a Wall changed to a Pedestal goes back to totals (same totals);
//   6. a foundationLoads (SubLoads) import into a wall in per-foot entry switches it to totals: the imported values are stored as
//      sent, the other rows keep their totals, and the AASHTO direct factors recognise the imported set;
//   7. 0 console errors; the 390 px phone width has no horizontal page scroll with the per-foot card.
//   node tests/smoke/spread-footing-wall-perft.mjs [--file <file or git ref>] [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, resolveFile, diff } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Spread Footing.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

const WALL = "state.geom.B=6;state.geom.L=22;state.peds=[state.peds[0]];const p=state.peds[0];p.label='Wall 1';p.elemType='wall';p.x=0;p.y=0;p.bx=1;p.by=20;p.h=3;"
  + "p.reinf.longMode='spacing';p.reinf.longSpc=12;p.wallIn.hSize='sameTie';p.loads.L.P=100;p.loads.Wx.Vx=20;p.loads.Wx.Mx=50;p.direct={P:0,Vx:0,Vy:0,Mx:0,My:0};";
const o = await openPage(SRC.file, {});
await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
await o.p.waitForTimeout(1500);
const setup = src => o.p.evaluate(src => {
  state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null;
  (new Function('state', src))(state); bindStaticInputs(); buildPedCards(); recalc();
}, src);
const snap = () => o.p.evaluate(() => {
  const js = v => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(v, (k, x) => { if (typeof x === 'function') return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return '[cyc]'; seen.add(x); } return (typeof x === 'number' && !isFinite(x)) ? String(x) : x; })); };
  const Rj = js(R); (Rj.peds || []).forEach(p => delete p.pf);
  return { R: Rj, P2: js(P2), q: R.govBear ? { name: R.govBear.cb.name, qmax: R.govBear.bear.qmax, DCR: R.govBear.DCR } : null, wall: !!(P2 && P2.bearing && P2.bearing[0] && P2.bearing[0].wall && P2.bearing[0].wall.applied) };
});
const reportText = async () => {
  await o.p.click('#tabbar button[data-tab="tab-report"]'); await o.p.waitForTimeout(1500);
  return o.p.evaluate(() => ({ text: SFRP.doc ? SharedReport.text(SFRP.doc) : '', err: /Report error/.test(document.getElementById('tab-report').innerText), katex: document.querySelectorAll('.katex-error').length }));
};

// 1. hand check: 240 kip total vs 12 kip/ft x 20 ft
console.log('1. hand check: p = 12 kip/ft over L = 20 ft vs P = 240 kip');
await setup(WALL + 'p.loads.D.P=240;p.loads.D.My=30;');
const T = await snap();
await setup(WALL + "p.loadEntry='perFt';p.loads.D.P=12;p.loads.D.My=1.5;p.loads.L.P=5;p.loads.Wx.Vx=1;");
const F = await snap();
check(T.wall && F.wall, 'the element is a wall by definition (l_w/t = 20 > 3) in both');
const dR = diff(T.R, F.R), dP = diff(T.P2, F.P2);
check(dR.length === 0, 'R identical (' + dR.length + ' diffs' + (dR.length ? ': ' + JSON.stringify(dR.slice(0, 3)) : '') + ')');
check(dP.length === 0, 'P2 identical (' + dP.length + ' diffs' + (dP.length ? ': ' + JSON.stringify(dP.slice(0, 3)) : '') + ')');
console.log('     governing bearing: total ' + JSON.stringify(T.q) + ' | per foot ' + JSON.stringify(F.q));
check(T.q && F.q && T.q.name === F.q.name && near(T.q.qmax, F.q.qmax) && near(+T.q.DCR, +F.q.DCR), 'governing bearing pressure and D/C the same');
const pf = await o.p.evaluate(() => ({ P: R.peds[0].loads.D.P, My: R.peds[0].loads.D.My, Mx: R.peds[0].loads.Wx.Mx, Vx: R.peds[0].loads.Wx.Vx, LP: R.peds[0].loads.L.P, st: state.peds[0].loads.D.P }));
check(pf.P === 240 && pf.My === 30 && pf.Mx === 50 && pf.Vx === 20 && pf.LP === 100 && pf.st === 12, 'totals used: D.P 240, D.My 30, L.P 100, Wx.Vx 20, Wx.Mx 50 (total, not x L); stored D.P stays 12');
{ const r = await reportText();
  check(!r.err && r.katex === 0, 'Report renders, 0 KaTeX errors');
  check(/Wall load entry: Wall 1: per foot of wall/.test(r.text), 'Report lists the entry mode');
  check(/Wall loads entered per foot/.test(r.text) && /12(\.000)?\s*[·⋅]\s*20(\.00)?/.test(r.text.replace(/\\cdot/g, '·')) && /240/.test(r.text), 'Report works P = p L = 12 · 20 = 240');
  if (args.shots) { await o.p.evaluate(() => { const e = [...document.querySelectorAll('#tab-report .rp-doc h1, #tab-report .rp-doc h2, #tab-report .rp-doc h3, #tab-report .rp-doc h4')].find(x => /Wall loads entered per foot/.test(x.textContent)); if (e) e.scrollIntoView({ block: 'start' }); }); await o.p.waitForTimeout(400); await o.p.screenshot({ path: path.join(args.shots, 'sfwp-report.png') }); } }

// 2. the card: switch total -> per foot -> total with the select
console.log('2. switching the entry on the card');
await setup(WALL + 'p.loads.D.P=240;p.loads.D.My=30;');
await o.p.evaluate(() => { if (typeof sfdSetInTab === 'function') sfdSetInTab('peds', true); });
await o.p.waitForTimeout(300);
const sel = 'select[data-path="peds.0.loadEntry"]';
check(await o.p.isVisible(sel), 'the "Wall loads entered as" select is shown for a wall');
check(await o.p.$eval(sel, e => e.value) === 'total', 'absent field reads Total');
await o.p.selectOption(sel, 'perFt'); await o.p.waitForTimeout(400);
await o.p.evaluate(() => recalc());
const c1 = await o.p.evaluate(() => ({ st: state.peds[0].loadEntry, P: state.peds[0].loads.D.P, My: state.peds[0].loads.D.My, Mx: state.peds[0].loads.Wx.Mx, Vx: state.peds[0].loads.Wx.Vx,
  inp: document.querySelector('input[data-path="peds.0.loads.D.P"]').value, units: [...document.querySelectorAll('.sfdLdU[data-ped="0"]')].map(e => e.dataset.cm + ':' + e.textContent),
  note: (document.querySelector('.sfdWpNote[data-ped="0"]') || {}).innerText || '' }));
check(c1.st === 'perFt' && c1.P === 12 && c1.My === 1.5 && c1.Vx === 1 && c1.Mx === 50, 'converted: D.P 240 -> 12, D.My 30 -> 1.5, Wx.Vx 20 -> 1, Wx.Mx 50 stays (' + JSON.stringify(c1).slice(0, 160) + ')');
check(c1.inp === '12', 'the D.P input shows 12');
check(c1.units.join(',') === 'P:kip/ft,Vx:kip/ft,Vy:kip/ft,Mx:kip-ft,My:kip-ft/ft', 'unit headers: ' + c1.units.join(','));
check(/P = 12\.00 × 20\.00 = 240\.00 kips/.test(c1.note), 'note shows P = 12.00 × 20.00 = 240.00 kips');
const S1 = await snap();
check(diff(T.R, S1.R).length === 0 && diff(T.P2, S1.P2).length === 0, 'results unchanged by the switch');
if (args.shots) { await o.p.evaluate(() => { const e = document.querySelector('select[data-path="peds.0.loadEntry"]'); e.scrollIntoView({ block: 'start' }); }); await o.p.waitForTimeout(300); await o.p.screenshot({ path: path.join(args.shots, 'sfwp-card.png') }); }
await o.p.selectOption(sel, 'total'); await o.p.waitForTimeout(400);
const c2 = await o.p.evaluate(() => ({ st: state.peds[0].loadEntry, P: state.peds[0].loads.D.P, My: state.peds[0].loads.D.My, u: document.querySelector('.sfdLdU[data-ped="0"][data-cm="P"]').textContent }));
check(c2.st === 'total' && c2.P === 240 && c2.My === 30 && c2.u === 'kips', 'switching back: D.P 240, D.My 30, unit kips');

// 3. length change keeps the per-foot values
console.log('3. b_y changed with per-foot entry');
await setup(WALL + "p.loadEntry='perFt';p.loads.D.P=12;p.by=10;");
{ const v = await o.p.evaluate(() => ({ st: state.peds[0].loads.D.P, tot: R.peds[0].loads.D.P }));
  check(v.st === 12 && v.tot === 120, 'D.P stays 12 kip/ft, total 12 x 10 = 120 kip'); }

// 4. wall along x
console.log('4. wall along x');
await setup("state.geom.B=22;state.geom.L=6;state.peds=[state.peds[0]];const p=state.peds[0];p.elemType='wall';p.x=0;p.bx=20;p.by=1;p.loadEntry='perFt';p.loads.D.P=10;p.loads.D.Mx=2;p.loads.D.My=40;p.loads.Wy.Vy=0.5;");
{ const v = await o.p.evaluate(() => ({ P: R.peds[0].loads.D.P, Mx: R.peds[0].loads.D.Mx, My: R.peds[0].loads.D.My, Vy: R.peds[0].loads.Wy.Vy, u: [...document.querySelectorAll('.sfdLdU[data-ped="0"]')].map(e => e.textContent).join(',') }));
  check(v.P === 200 && v.Mx === 40 && v.My === 40 && v.Vy === 10, 'P 10 x 20 = 200, M_x 2 x 20 = 40 (about the wall axis), M_y 40 total, V_y 0.5 x 20 = 10');
  check(v.u === 'kip/ft,kip/ft,kip/ft,kip-ft/ft,kip-ft', 'unit headers ' + v.u); }

// 5. input check and Wall -> Pedestal
console.log('5. length 0; Wall -> Pedestal');
await setup(WALL + "p.loadEntry='perFt';p.loads.D.P=12;p.bx=0;p.by=0;");
{ const w = await o.p.evaluate(() => (R.W || []).map(x => x.msg).join(' | '));
  check(/loads are entered per foot of wall, so the wall length/.test(w), 'error: wall length must be > 0');
  // a Wall with b_x = b_y = 0 draws SVG with Infinity / NaN coordinates (6 console errors) on main as well, with either entry: not this change
  const pre = o.errs.splice(0).filter(e => !/^Error: <\w+> attribute /.test(e)); check(pre.length === 0, 'no other console error with zero length' + (pre.length ? ': ' + pre[0] : '')); }
await setup(WALL + "p.loadEntry='perFt';p.loads.D.P=12;");
await o.p.evaluate(() => { if (typeof sfdSetInTab === 'function') sfdSetInTab('peds', true); });
await o.p.selectOption('select[data-path="peds.0.elemType"]', 'pedestal'); await o.p.waitForTimeout(400);
{ const v = await o.p.evaluate(() => ({ e: state.peds[0].elemType, m: state.peds[0].loadEntry, P: state.peds[0].loads.D.P }));
  check(v.e === 'pedestal' && v.m === 'total' && v.P === 240, 'Pedestal: entry Total, D.P 240 (same total)'); }

// 6. foundationLoads (SubLoads) import into a per-foot wall
console.log('6. foundationLoads import into a per-foot wall');
await setup(WALL + "p.loadEntry='perFt';p.loads.D.P=12;state.loadMode='type';");
{ const v = await o.p.evaluate(() => {
    const pay = { _schema: 'bridge-foundation-loads', schemaVersion: 1, producer: 'Bridge Substructure Loading', producedAt: '2026-11-11T00:00:00Z', location: 'top of footing',
      reference: { level: 'topOfFooting' }, units: { force: 'kip', moment: 'kip-ft' },
      cases: [{ name: 'Str I', limitState: 'Strength I', factored: true, combination: '1.25 DC + 1.75 LL', P: 500, Vx: 10, Vy: 4, Mx: 20, My: 60 }] };
    const chk = bxFl.check(pay), op = bxFl.defaults(chk); op.hCorr = false;
    const pl = bxFl.plan(pay, chk, op), r = bxFl.apply(pay, chk, op, 'test');
    buildPedCards(); recalc();
    return { err: (r.err || []).join(';'), warn: pl.warn.some(w => /entered per foot of wall/.test(w)), m: state.peds[0].loadEntry, d: state.peds[0].direct, DP: state.peds[0].loads.D.P, aash: !!sfAashtoDirect(), mode: state.loadMode };
  });
  check(!v.err, 'import applied' + (v.err ? ': ' + v.err : ''));
  check(v.warn, 'the plan warns that the wall goes to totals');
  check(v.m === 'total' && v.d.P === 500 && v.d.My === 60 && v.d.Mx === 20 && v.DP === 240, 'entry Total; direct = the sent totals (P 500, M_y 60); D.P converted 12 -> 240');
  check(v.aash && v.mode === 'direct', 'AASHTO direct factors recognise the imported set'); }

// 7. phone width
console.log('7. 390 px');
await setup(WALL + "p.loadEntry='perFt';p.loads.D.P=12;p.loads.D.My=1.5;p.loads.L.P=5;p.loads.Wx.Vx=1;");
await o.p.setViewportSize({ width: 390, height: 844 }); await o.p.waitForTimeout(600);
await o.p.evaluate(() => { if (typeof sfdSetInTab === 'function') sfdSetInTab('peds', true); });
await o.p.waitForTimeout(400);
{ const sw = await o.p.evaluate(() => ({ s: document.documentElement.scrollWidth, c: document.documentElement.clientWidth }));
  check(sw.s <= sw.c + 1, 'no horizontal page scroll at 390 px (' + sw.s + ' / ' + sw.c + ')');
  if (args.shots) { await o.p.evaluate(() => document.querySelector('select[data-path="peds.0.loadEntry"]').scrollIntoView({ block: 'start' })); await o.p.waitForTimeout(300); await o.p.screenshot({ path: path.join(args.shots, 'sfwp-390.png') }); } }

check(o.errs.length === 0, '0 console errors' + (o.errs.length ? ': ' + o.errs.slice(0, 3).join(' | ') : ''));
await o.b.close();
console.log(failures ? failures + ' FAILED' : 'all checks pass');
process.exit(failures ? 1 : 0);
