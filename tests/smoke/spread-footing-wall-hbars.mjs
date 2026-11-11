#!/usr/bin/env node
// Spread Footing: wall horizontal bars drawn, wall vertical bars entered by spacing, no wall ties (SFHB / SFWS, engineer 2026-11-11).
// Headless Chromium, file://, the pinned libraries from tests/libs:
//   1. a saved wall (the engineer's photo: 1 x 20 ft along y, h = 3 ft, #6, 2 per x-face / 10 per y-face, tie "none", cover 2 in,
//      horizontal #4 @ 12 in, longitudinal bars act as dowels, stored nTot 30 / dowelN 14) opens with the spacing that reproduces its
//      bars (26.5 in: ceil(235.25/26.5) + 1 = 10, ceil(7.25/26.5) + 1 = 2) and R / P2 identical to its stored entry (legacy layout);
//   2. hand check of the spacing rule: s_v = 12 in: n per long face = ceil(235.25/12) + 1 = 21, end faces 2, 42 bars,
//      s_v = 235.25/20 = 11.7625 in, rho_l = 2(0.44)/(11.7625 x 12) = 0.006234, the dowels follow (42 #6);
//   3. the drawings: horizontal bars at z = 6, 18, 30 in (s/2, then s, up to h - c = 34): section A-A (across the wall) 6 dots of
//      d_b = 0.5 in, section B-B (along the wall) 3 lines of l_w - 2c = 236 in, schedule row P1H #4, NO. 6, "@ 12" EF", no TIES row;
//      the callout text clear of every other text on the section sheets; DXF passes SharedDxf.validate;
//   4. the 3D view draws 6 horizontal bars (3 levels x 2 faces);
//   5. the card: tie columns hidden, s_v shown, n-per-face / entry mode hidden, the exposure label and the cover sentence name the
//      horizontal bars: c - d_b,h = 2.00 - 0.500 = 1.500 >= 1.50 in (#4, Table 20.5.1.3.1); a wall needing ties (A_st > 0.01 A_g)
//      shows the tie inputs and draws the ties;
//   6. greyed fields show the values in effect (Total qty 20, Dowel count 20) and the stored entries are kept (30, 14);
//   7. a saved wall whose bars no single spacing reproduces keeps its entry (wallSpc blank, note on the card), results unchanged;
//      a Pedestal changed to a Wall on the card starts at the exact spacing of its bars;
//   8. 0 console errors; no horizontal page scroll at 390 px with the wall card.
//   node tests/smoke/spread-footing-wall-hbars.mjs [--file <file or git ref>] [--shots <dir>]
import fs from 'fs';
import { openPage, resolveFile, diff } from '../lib.mjs';

const args = {}; const av = process.argv.slice(2);
for (let i = 0; i < av.length; i++) { if (!av[i].startsWith('--')) continue; const k = av[i].slice(2); args[k] = av[i + 1] && !av[i + 1].startsWith('--') ? av[++i] : true; }
const TOOL = 'Spread Footing.html';
const SRC = resolveFile(args.file || TOOL, TOOL);
if (args.shots) fs.mkdirSync(args.shots, { recursive: true });
let failures = 0;
const check = (ok, msg) => { if (!ok) { failures++; console.log('  FAIL ' + msg); } else console.log('  ok   ' + msg); };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t * Math.max(1, Math.abs(b));

const WALL = "state.geom.B=6;state.geom.L=22;state.peds=[state.peds[0]];const p=state.peds[0];p.label='Wall 1';p.elemType='wall';p.x=0;p.y=0;p.bx=1;p.by=20;p.h=3;"
  + "p.loads.D.P=240;p.loads.L.P=100;p.loads.Wx.Vx=20;p.loads.Wx.Mx=50;"
  + "Object.assign(p.reinf,{longSize:6,longMode:'faces',nx:2,ny:10,nTot:30,tieSize:0,tieSpc:12,cover:2,dowelLong:true,dowelN:14,dowelHook:'hook90'});p.wallIn.hSize='4';p.wallIn.hSpc=12;";
const o = await openPage(SRC.file, {});
await o.p.waitForSelector('#tabbar button[data-tab="tab-report"]');
await o.p.waitForTimeout(1500);
/* a saved project: built, stored as JSON, opened (migrateState) */
const open = (src, post) => o.p.evaluate(([src, post]) => {
  state = defaultState(); migrateState(); SEL.asd = null; SEL.lrfd = null; SEL.asdLr = null;
  (new Function('state', src))(state);
  const j = JSON.stringify(state); state = Object.assign(defaultState(), JSON.parse(j)); migrateState();
  if (post) (new Function('state', post))(state);
  bindStaticInputs(); buildPedCards(); recalc();
}, [src, post || '']);
const snap = () => o.p.evaluate(() => {
  const js = v => { const seen = new WeakSet(); return JSON.parse(JSON.stringify(v, (k, x) => { if (typeof x === 'function') return undefined; if (x && typeof x === 'object') { if (seen.has(x)) return '[cyc]'; seen.add(x); } return (typeof x === 'number' && !isFinite(x)) ? String(x) : x; })); };
  const P = js(P2); (P.pedDes || []).forEach(z => { delete z.PB; }); (P.bearing || []).forEach(z => { if (z.wall) delete z.wall.vEnt; });
  return { R: js(R), P2: P, wallSpc: state.peds[0].reinf.wallSpc };
});

console.log('1. the photo wall, saved with n per face, opens with the exact spacing; results identical to the stored entry');
await open(WALL);
const A = await snap();
check(A.wallSpc === 26.5, 'wallSpc from the saved layout = 26.5 in (got ' + A.wallSpc + ')');
await open(WALL, "state.peds[0].reinf.wallSpc='';");
const B = await snap();
const dR = diff(A.R, B.R), dP = diff(A.P2, B.P2);
check(dR.length === 0, 'R identical to the stored n-per-face entry (' + dR.length + ' diffs' + (dR.length ? ': ' + JSON.stringify(dR.slice(0, 3)) : '') + ')');
check(dP.length === 0, 'P2 identical to the stored n-per-face entry (' + dP.length + ' diffs' + (dP.length ? ': ' + JSON.stringify(dP.slice(0, 3)) : '') + ')');
const st0 = await o.p.evaluate(() => { const r = state.peds[0].reinf; return { nx: r.nx, ny: r.ny, longMode: r.longMode, nTot: r.nTot, dowelN: r.dowelN, tieSize: r.tieSize, tieSpc: r.tieSpc }; });
check(JSON.stringify(st0) === JSON.stringify({ nx: 2, ny: 10, longMode: 'faces', nTot: 30, dowelN: 14, tieSize: 0, tieSpc: 12 }), 'stored fields untouched ' + JSON.stringify(st0));

console.log('2. hand check: s_v = 12 in');
await open(WALL, "state.peds[0].reinf.wallSpc=12;");
const H = await o.p.evaluate(() => { const w = P2.bearing[0].wall, PB = sfdPedBars(0), DB = sfdDowelBars(0); return { nx: PB.nx, ny: PB.ny, n: PB.n, sv: w.v.s, nF: w.v.nF, rho: w.v.rho, dn: DB.n, ds: DB.size, pdn: P2.pedDes[0].nBars, items: sfdWallTxt(w) }; });
check(H.ny === 21 && H.nx === 2 && H.n === 42 && H.pdn === 42, 'n per long face = ceil(235.25/12) + 1 = 21, end faces 2, 42 bars (got ' + [H.nx, H.ny, H.n, H.pdn] + ')');
check(near(H.sv, 11.7625) && H.nF === 21, 's_v = 235.25/20 = 11.7625 in (got ' + H.sv + ')');
check(near(H.rho, 2 * 0.44 / (11.7625 * 12), 1e-9), 'rho_l = 2(0.44)/(11.7625 x 12) = 0.006234 (got ' + H.rho.toFixed(6) + ')');
check(H.dn === 42 && H.ds === 6, 'the dowels follow the spacing: 42 #6 (got ' + H.dn + ' #' + H.ds + ')');
check(/ceil\(235\.25\/12\.00\) \+ 1 = 21/.test(H.items), 'Wall Design / Report statement works n = ceil(235.25/12.00) + 1 = 21');

console.log('3. the drawings (photo wall)');
await open(WALL);
const D = await o.p.evaluate(() => {
  const B = sfdwBuild(), Dd = B.D, sh = id => B.S.find(s => s.id === id), ents = s => Dd.E.slice(s.i0, s.iv);
  const W = sfdwWallHz(0);
  const a = ents(sh('secA')), b = ents(sh('secB'));
  const dots = a.filter(e => e.t === 'CIRCLE' && Math.abs(e.r - 0.25) < 1e-9).length;
  const lines = b.filter(e => e.t === 'LINE' && Math.abs(Math.abs(e.pts[1][0] - e.pts[0][0]) - 236) < 1e-6 && Math.abs(e.pts[1][1] - e.pts[0][1]) < 1e-9).length;
  const txt = s => ents(s).filter(e => e.t === 'TEXT');
  const ovl = s => { const T = txt(s).map(e => { const i = Dd.E.indexOf(e); return { s: e.s, b: Dd.bbox(i, i + 1) }; }), bad = [];
    T.forEach((x, i) => { if (!/HORIZ/.test(x.s)) return; T.forEach((y, j) => { if (i === j) return; if (x.b[0] < y.b[2] && y.b[0] < x.b[2] && x.b[1] < y.b[3] && y.b[1] < x.b[3]) bad.push(x.s + ' | ' + y.s); }); }); return bad; };
  const dxf = Dd.toDXF({ ltscale: 1 }), v = SharedDxf.validate(dxf);
  return { zs: W.zs, off: W.off, half: W.half, dots, lines, callA: txt(sh('secA')).map(e => e.s).filter(s => /HORIZ/.test(s)), callB: txt(sh('secB')).map(e => e.s).filter(s => /HORIZ/.test(s)),
    ovA: ovl(sh('secA')), ovB: ovl(sh('secB')), sched: txt(sh('sched')).map(e => e.s), ped: txt(sh('ped0')).map(e => e.s), ok: v.ok, err: v.errors.slice(0, 3), hasH: /#4 @ 12" EF HORIZ/.test(dxf) };
});
check(JSON.stringify(D.zs) === '[6,18,30]', 'levels s/2, 3s/2, 5s/2 = 6, 18, 30 in (h - c = 34) (got ' + JSON.stringify(D.zs) + ')');
check(near(D.off, 4.25) && near(D.half, 118), 'bar centres t/2 - c + d_b,h/2 = 6 - 2 + 0.25 = 4.25 in from the wall centre line; length l_w - 2c = 236 in');
check(D.dots === 6, 'section A-A: 6 horizontal-bar dots (3 levels x 2 faces) (got ' + D.dots + ')');
check(D.lines === 3, 'section B-B: 3 horizontal-bar lines of 236 in (got ' + D.lines + ')');
check(D.callA.length === 1 && D.callB.length === 1 && D.hasH, 'callout "#4 @ 12" EF HORIZ" on both sections ' + JSON.stringify(D.callA.concat(D.callB)));
check(!D.ovA.length && !D.ovB.length, 'the callouts clear every other text ' + JSON.stringify(D.ovA.concat(D.ovB)));
const hRow = D.sched.findIndex(s => s === 'P1H');
check(hRow >= 0 && D.sched.includes('6') && D.sched.some(s => /^@ 12" EF \(3 PER FACE\)/.test(s)), 'schedule row P1H: #4, NO. 6, @ 12" EF (3 PER FACE)');
check(!D.sched.includes('P1T') && !D.sched.some(s => / TIES$/.test(s)), 'no ties row for the wall');
check(D.ped.some(s => /#4 @ 12" EF HORIZ, OUTSIDE VERT BARS/.test(s) && /NO TIES/.test(s)), 'element detail note: horizontal bars, cover to them, no ties');
check(D.ok, 'DXF structure check ' + JSON.stringify(D.err));

console.log('4. the 3D view');
await o.p.click('#tabbar button[data-tab="tab-3d"]'); await o.p.waitForTimeout(2500);
const n3 = await o.p.evaluate(() => V3D.wallHz);
check(n3 === 6, '3D: 6 horizontal bars (3 levels x 2 faces) (got ' + n3 + ')');
if (args.shots) await o.p.screenshot({ path: args.shots + '/sfhb-3d.png' });

console.log('5. the card');
await o.p.evaluate(() => sfdSetInTab('rebar')); await o.p.waitForTimeout(400);
const C = await o.p.evaluate(() => { const rb = document.querySelector('.sfdPedRb'), vis = s => [...rb.querySelectorAll(s)].some(e => e.offsetParent !== null);
  const g = p => rb.querySelector('[data-path="peds.0.reinf.' + p + '"]');
  return { tie: vis('.sfdTieCol'), ws: vis('.sfdWsCol'), n: vis('.sfdNCol'), mode: vis('.sfdModeTbl'), exp: rb.querySelector('.sfdLbW').offsetParent !== null, info: rb.querySelector('.sfdPbInfo').innerText,
    nTot: g('nTot').value, dN: g('dowelN').value, dS: g('dowelSize').value, pd: P2.pedDes[0] }; });
check(!C.tie && C.ws && !C.n && !C.mode && C.exp, 'tie columns hidden, s_v shown, n per face and entry mode hidden, exposure label for the horizontal bars');
check(/Clear cover to the horizontal bars \(#4, each face\) c − db,h = 2\.00 − 0\.500 = 1\.500 in ≥ 1\.50 in min/.test(C.info), 'cover sentence: c − d_b,h = 2.00 − 0.500 = 1.500 ≥ 1.50 in');
check(near(C.pd.tieCov, 1.5) && C.pd.tieCovMin === 1.5 && C.pd.tieCovOK && C.pd.trKind === 'horiz', 'pd: c_h = 1.500, min 1.50 (#4, weather), OK');
check(/Ties: none/.test(C.info), 'card note: no ties');
console.log('6. greyed fields');
check(C.nTot === '20' && C.dN === '20' && C.dS === '6', 'greyed Total qty 20 and Dowel count 20 (the bars in effect) (got ' + C.nTot + ', ' + C.dN + ')');
const st1 = await o.p.evaluate(() => [state.peds[0].reinf.nTot, state.peds[0].reinf.dowelN]);
check(st1[0] === 30 && st1[1] === 14, 'stored nTot 30 / dowelN 14 kept');
if (args.shots) { const rb = await o.p.$('.sfdPedRb'); await rb.screenshot({ path: args.shots + '/sfhb-card.png' }); }
// a wall needing ties (A_st > 0.01 A_g): ties shown and drawn
await open("state.geom.B=6;state.geom.L=10;state.peds=[state.peds[0]];const p=state.peds[0];p.label='W2';p.elemType='wall';p.x=0;p.y=0;p.bx=8;p.by=10/12;p.h=4;p.loads.D.P=200;Object.assign(p.reinf,{longSize:11,longMode:'faces',nx:10,ny:2,tieSize:3,tieSpc:12,cover:1.5,dowelLong:true});p.wallIn.hSize='5';p.wallIn.hSpc=12;");
const T = await o.p.evaluate(() => { const rb = document.querySelector('.sfdPedRb'); const B = sfdwBuild(), t = B.D.E.filter(e => e.t === 'TEXT').map(e => e.s);
  return { req: P2.pedDes[0].wTieReq, tie: [...rb.querySelectorAll('.sfdTieCol')].some(e => e.style.display !== 'none'), row: t.includes('P1T'), h: t.includes('P1H'), kind: P2.pedDes[0].trKind }; });
check(T.req && T.tie && T.row && T.h, 'A_st > 0.01A_g: tie inputs shown, ties and horizontal bars in the schedule (' + JSON.stringify(T) + ')');

console.log('7. legacy entry; pedestal to wall on the card');
const LEG = WALL.replace('nx:2,ny:10', 'nx:3,ny:10');
await open(LEG);
const L1 = await snap();
check(L1.wallSpc === '', 'no single spacing gives 3 / 10 bars: wallSpc blank (got ' + JSON.stringify(L1.wallSpc) + ')');
const L2 = await o.p.evaluate(() => { const rb = document.querySelector('.sfdPedRb'); return { n: [...rb.querySelectorAll('.sfdNCol')].some(e => e.style.display !== 'none'), note: /Saved wall entry kept/.test(rb.querySelector('.sfdPbInfo').innerText), nb: P2.pedDes[0].nBars }; });
check(L2.n && L2.note && L2.nb === 2 * (3 + 10) - 4, 'legacy wall: n per face shown with the note; 22 bars as saved');
await open("state.peds=[state.peds[0]];const p=state.peds[0];p.x=0;p.y=0;p.bx=1;p.by=12;p.h=3;state.geom.L=14;Object.assign(p.reinf,{longSize:6,longMode:'faces',nx:2,ny:7,cover:2});");
const PW = await o.p.evaluate(async () => { const s = document.querySelector('select[data-path="peds.0.elemType"]'); const n0 = sfdPedBars(0).n; s.value = 'wall'; s.dispatchEvent(new Event('change', { bubbles: true })); await new Promise(r => setTimeout(r, 900));
  return { n0, n1: sfdPedBars(0).n, s: state.peds[0].reinf.wallSpc, wall: !!sfdPedBars(0).wall }; });
check(PW.wall && PW.n0 === PW.n1 && PW.s > 0, 'Pedestal -> Wall: spacing ' + PW.s + ' in keeps the ' + PW.n0 + ' bars');

console.log('8. errors and phone width');
check(o.errs.length === 0, '0 console errors ' + JSON.stringify(o.errs.slice(0, 3)));
await o.b.close();
const ph = await openPage(SRC.file, { vw: 390, vh: 844 });
await ph.p.waitForSelector('#tabbar button[data-tab="tab-report"]'); await ph.p.waitForTimeout(1500);
await ph.p.evaluate(src => { state = defaultState(); migrateState(); (new Function('state', src))(state); const j = JSON.stringify(state); state = Object.assign(defaultState(), JSON.parse(j)); migrateState(); bindStaticInputs(); buildPedCards(); recalc(); sfdSetInTab('rebar'); }, WALL);
await ph.p.waitForTimeout(800);
const sw = await ph.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
check(sw.sw <= sw.cw + 1, '390 px: no horizontal page scroll (' + sw.sw + ' <= ' + sw.cw + ')');
if (args.shots) await ph.p.screenshot({ path: args.shots + '/sfhb-390.png', fullPage: false });
check(ph.errs.length === 0, '390 px: 0 console errors');
await ph.b.close();
console.log(failures ? failures + ' FAILURE(S)' : 'all checks pass');
process.exit(failures ? 1 : 0);
