// Crane Pick Analyzer (apps/crane-pick), C7: the lift-plan drawing set (ui/drawset.js, no DOM) and the multi-lift summary. Node only,
// with the SYNTHETIC fake crane of tests/smoke/crane-fake-wheeled.json (made-up values; the C4 hand-check weights of case A on its card).
//   node tests/engine/run.mjs crane
//
// The drawing set calculates nothing: every number on a sheet is an engine value, formatted. The hand cases below are the engines' own
// (C2-2 lift, C4 ground case A, C5 tandem), set up so that each sheet type shows a value that can be checked by hand:
//   Single pick (lift plan sheet): fake crane, outriggers full 360°, boom 60 ft, rotation centre (500, 2,000), heading 0 (front north);
//     pick (500, 2,030): R = 30.00 ft → L_tab 60, R_tab 30 → C = 39,000 lb; W = 20,000 + 1,000 + 1,000 = 22,000 lb → 56.41 % of chart;
//     set (500, 2,020): R 20.00 → C 58,000 → 37.93 %; governing at the pick, 56.4 %.
//   Ground (ground sheet): C4 case A weights (carrier 40,000 @ 0, upperworks 30,000 @ 0, counterweight 20,000 @ r 10, boom 6,000, e 2,
//     f_b 0.5), the hook 30 ft over the front (θ 0) at the pick: V 118,000 lb, front floats 41,083.33 lb each (case A). The swing to the
//     set moves the hook in to 20 ft over the front, which lowers the front float loads, so the largest is at the pick: 41.08 kip.
//     Timber mat 4 × 4 ft × 12 in (C4 case E: A_e = 14.231407 ft², γt = 50 psf): q_g = 41,083.33 / 14.231407 + 50 = 2,936.80 psf;
//     q_a 4,000 psf → q_g / q_a = 0.734.
//   Tandem (tandem lift plan and rigging sheets): the C5 hand case: two setups (80 ft boom, pad 100) at (1,000, 2,000) / (1,100, 2,000),
//     girder L 60, W 40,000, CG 28, hooks 10 / 50: R1 = 40,000 (50 − 28) / (50 − 10) = 22,000 lb, R2 = 18,000 lb; + 1,000 rigging +
//     1,000 block each → W1 24,000, W2 20,000 lb; governing step 0 for both cranes: R 36.06 ft, C 27,000 lb → 88.9 % / 74.1 %.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick');
const W = loadShared('steps.js', 'boussinesq.js', 'dxf.js', ...['geo', 'model', 'osha', 'cranes', 'lift', 'elev', 'cranegfx', 'clear3d', 'ground', 'tandem', 'route'].map(f => path.join(APP, 'engine', f + '.js')),
  path.join(APP, 'report', 'builders.js'), path.join(APP, 'ui', 'drawset.js'));
const K = W.CranePickCranes, LF = W.CranePickLift, M = W.CranePickModel, T = W.CranePickTandem, GR = W.CranePickGround, DS = W.CranePickDrawSet, X = W.SharedDxf;
const J = v => JSON.parse(JSON.stringify(v)), same = (a, b, m) => assert.deepEqual(J(a), J(b), m);
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', 'crane-fake-wheeled.json'), 'utf8'));
raw.app_inputs = Object.assign({}, raw.app_inputs, { ph4: { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 } });
const WH = K.parse(raw).crane;
const grp = id => K.groups(WH).find(g => Object.values(g.configs).some(x => x.id === id)).key;

function project(o) {
  const P = M.newProject(); P.title = Object.assign({}, P.title, { name: 'TEST LIFT PLAN', number: 'T-7', by: 'ABC', checker: 'DEF' });
  P.cranes = [M.normCrane({ id: 'c1', def: WH, src: { from: 'file', name: 'fake' } })];
  const mat = { type: 'timber', B: 4, L: 4, t: 12, Fb: 1200, Fv: 150, E: 1.2e6 };
  P.setups = [M.normSetup({ id: 'u0', name: 'Crane A', craneId: 'c1', x: 500, y: 2000, heading: 0, group: grp('or-full-360'), boom: 60, pad: 100, ground: { mat, qa: 4000 } }),
    M.normSetup({ id: 'u1', name: 'Crane 1', craneId: 'c1', x: 1000, y: 2000, heading: 0, group: grp('or-full-360'), boom: 80, pad: 100 }),
    M.normSetup({ id: 'u2', name: 'Crane 2', craneId: 'c1', x: 1100, y: 2000, heading: 0, group: grp('or-full-360'), boom: 80, pad: 100 })];
  P.picks = [M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' })];
  P.tandems = [M.normTandem({ id: 't1', name: 'Tandem 1', type: 'tandem', slots: ['u1', 'u2'], girder: { L: 60, W: 40000, cg: 28, H: 6 },
    hooks: [{ s: 10, rig: 1000, hook: 1000, rigH: 10, blk: 4 }, { s: 50, rig: 1000, hook: 1000, rigH: 10, blk: 4 }], pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } })];
  P.lift = Object.assign({}, P.lift, { tandem: 75 });
  if (o && o.route) P.routes = [M.normRoute({ id: 'r1', name: 'Route 1', pts: [{ x: 900, y: 1700 }, { x: 1050, y: 1700 }, { x: 1050, y: 1990 }], rad: [null, 80, null], tandemId: 't1',
    veh: { type: 'semi', L1: 20, e: 1, L2: 40, Wtr: 20000, xt: 8, Wtl: 15000, xtl: 25, nS: 1, nD: 2, nR: 3, tS: 2, tD: 4, tR: 4 }, load: { r: 2, h: 6, B: 8 } })];
  return M.normalize(JSON.parse(JSON.stringify(P)));
}
/* the page's evaluation (ui/place.js evalPick0, ui/tandem.js evalT): the same engine calls */
function ctxOf(P) {
  const S = LF.settingsOf(P), su = id => P.setups.find(u => u.id === id), cr = u => P.cranes.find(c => c.id === u.craneId).def;
  const evalPick = k => { const u = su(k.setupId), c = cr(u), ev = LF.evaluate(c, u, k, S, 'k'); ev.flags = LF.clearances(c, u, ev, P.items, { skip3d: true });
    ev.elev = W.CranePickElev.evaluate(c, u, k, ev, 'k.el'); ev.flags = ev.flags.concat(ev.elev.flags); ev.c3 = W.CranePickClear.check(c, u, k, ev, P.items, S, 'k.c3'); ev.flags = ev.c3.flags.concat(ev.flags);
    ev.ground = GR.evaluate(c, u, k, P, 'k.gr'); ev.flags = ev.flags.concat(ev.ground.flags || []); return ev; };
  const evalT = t => { const us = t.slots.slice(0, t.type === 'single' ? 1 : 2).map(su); return T.evaluate(t, { setups: us, cranes: us.map(cr), items: P.items, P, s: Object.assign(LF.settingsOf(P), { tandem: P.lift.tandem || 75 }), zPad: W.CranePickElev.padEl(us[0]) }, 'tg'); };
  const evalRoute = r => W.CranePickRoute.evaluate(r, P, 'rt' + (P.routes.indexOf(r) + 1), { tev: evalT(W.CranePickRoute.tandemOf(r, P)) });
  return { evalPick, evalT, evalRoute, date: '2026-11-16', ref: key => ({ 'route-0': '§8.1', 'pick-k1': '§5.2', 'tandem-t1': '§6.3', ground: '§7', 'gr-k1': '§7.3' })[key] || null };
}
const textsOf = (B, id) => { const s = B.sheets.find(q => q.id === id); assert.ok(s, 'sheet ' + id); return B.D.E.slice(s.i0, s.i1).filter(e => e.t === 'TEXT' || e.t === 'DIM').map(e => e.s).join(' | '); };

test('multi-lift summary: one row per lift, the engine values (single pick and tandem)', () => {
  const P = project(), ctx = ctxOf(P), S = DS.summary(P, ctx);
  assert.equal(S.length, 2); same(S.map(r => [r.kind, r.name]), [['pick', 'Pick 1'], ['tandem', 'Tandem 1']]);
  const a = S[0]; near(a.cranes[0].pct, 22000 / 39000 * 100, 1e-9); assert.equal(a.cranes[0].C, 39000); assert.equal(a.cranes[0].W, 22000); assert.equal(a.cranes[0].where, 'at the pick');
  near(a.ground.load, 41083.33, 0.01, 'front float at the pick (C4 case A)'); assert.equal(a.ground.mode, 'rigid');
  near(a.ground.ratio, (41083.333333 / 14.231407 + 50) / 4000, 1e-4, 'bearing ratio with the 4 x 4 x 12 in timber mat');
  assert.equal(a.clr, null, 'no power line or obstruction: no clearance'); assert.equal(a.key, 'pick-k1');
  const b = S[1]; same(b.cranes.map(c => c.W), [24000, 20000]); near(b.cranes[0].pct, 88.888889, 1e-5); near(b.cranes[1].pct, 74.074074, 1e-5); same(b.cranes.map(c => c.step), [0, 0]);
  assert.equal(b.cranes[0].cls, 'over'); assert.ok(b.flags.stop >= 1, 'the tandem-limit flag');
  const r = ctx.evalT(P.tandems[0]); const g1 = r.ground.cr[0]; near(b.ground.load, Math.max(...r.ground.cr.map(g => Math.max(...g.max.map(m => m.load)))), 1e-9, 'max float load over both cranes');
  assert.ok(g1.mode === 'rigid');
});

test('drawing set: sheet list, every sheet inside its border at a listed scale, DXF valid', () => {
  const P = project(), B = DS.build(P, ctxOf(P), { paper: 'D' });
  same(B.errors, []);
  same(B.sheets.map(s => s.id), ['cover', 'notes', 'lift-k1', 'tlift-t1', 'rig-t1', 'ground']);
  same(B.sheets.map(s => s.n), [1, 2, 3, 4, 5, 6]);
  B.sheets.forEach(s => { assert.ok(!s.over, s.id + ' fits'); assert.ok(DS.SCALES.includes(s.k)); const bb = B.D.bbox(s.i0, s.i1); assert.ok(bb[0] >= s.ox - 1e-6 && bb[2] <= s.ox + s.W + 1e-6 && bb[1] >= -1e-6 && bb[3] <= s.H + 1e-6, `${s.id} inside its sheet`); });
  const txt = B.D.toDXF({ ltscale: 1 }), v = X.validate(txt); assert.ok(v.ok, v.errors.join('; ')); assert.ok(v.counts.TEXT > 100);
  ['C-SITE-POWER', 'C-CRANE', 'C-CRANE-MAT', 'C-BOOM', 'C-SWING', 'C-GIRDER', 'C-TBLK', 'C-BRDR'].forEach(l => assert.ok(v.layers.includes(l), 'layer ' + l));
  // paper B and the half-size print of paper D build the same sheets
  const Bb = DS.build(P, ctxOf(P), { paper: 'B' }); same(Bb.sheets.map(s => s.id), B.sheets.map(s => s.id)); assert.ok(X.validate(Bb.D.toDXF()).ok);
  const Bh = DS.build(P, ctxOf(P), { paper: 'D', half: true }); assert.ok(/HALF SIZE/.test(textsOf(Bh, 'lift-k1')));
});

test('sheet values = engine values (hand cases): cover, notes, lift plan, tandem plan, rigging, ground', () => {
  const P = project(), B = DS.build(P, ctxOf(P), { paper: 'D' });
  const cv = textsOf(B, 'cover'); assert.match(cv, /SHEET INDEX/); assert.match(cv, /LIFT PLAN: PICK 1/); assert.match(cv, /56\.4 %/); assert.match(cv, /88\.9 %/); assert.match(cv, /74\.1 %/); assert.match(cv, /41\.08 KIP \(FRONT LEFT/);
  assert.match(cv, /LIFT-PLANNING AID/); assert.match(cv, /\| 1 OF 6 \|/);
  const nt = textsOf(B, 'notes').replace(/ \| /g, ' '); assert.match(nt, /FAKECO TEST CHART TC-1 \(NOT A REAL DOCUMENT\), REVISION T1/); assert.match(nt, /PRELIMINARY DOCUMENT/); assert.match(nt, /TERMS OF THE SOURCE: FAKE TEST DATA/);
  assert.match(nt, /CAUTION >= 75 %, CRITICAL LIFT >= 75 %, LIMIT 100 %/); assert.match(nt, /TANDEM LIFTS: 75 %/); assert.match(nt, /CRANE A: ENTERED DATA/); assert.match(nt, /29 CFR 1926\.1408 TABLE A/); assert.match(nt, /NAD 83/);
  const lf = textsOf(B, 'lift-k1'); assert.match(lf, /P: R 30\.00 FT, 39,000 LB, 56\.4 %/); assert.match(lf, /S: R 20\.00 FT, 58,000 LB, 37\.9 %/); assert.match(lf, /TOTAL LOAD W \| 22,000 LB/);
  assert.match(lf, /GOVERNING \| AT THE PICK: C 39,000 LB, 56\.4 %/); assert.match(lf, /ELEVATION AT THE PICK/); assert.match(lf, /ELEVATION AT THE SET/); assert.match(lf, /REPORT SEC\. 5\.2 \(LIFT\)/); assert.match(lf, /N \(GRID\)|\| N \|/);
  assert.match(lf, /MAX 41\.08 KIP \(FRONT LEFT/); assert.match(lf, /GRID TICKS: /);
  const tl = textsOf(B, 'tlift-t1'); assert.match(tl, /CRANE 1 GOVERNING STEP 0: R 36\.06 FT, 27,000 LB, 88\.9 %/); assert.match(tl, /CRANE 2 GOVERNING STEP 0: R 36\.06 FT, 27,000 LB, 74\.1 %/);
  assert.match(tl, /HOOK LOAD W1 \| 24,000 LB \(GIRDER SHARE 22,000 LB\)/); assert.match(tl, /ELEVATION AT CRANE 1'S GOVERNING STEP 0/); assert.match(tl, /REPORT SEC\. 6\.3/);
  const rg = textsOf(B, 'rig-t1'); assert.match(rg, /R1 = 22,000 LB/); assert.match(rg, /R2 = 18,000 LB/); assert.match(rg, /W1 = 24,000 LB/); assert.match(rg, /W2 = 20,000 LB/); assert.match(rg, /W_G = 40,000 LB AT THE CG/);
  assert.match(rg, /= 22,000 LB/); assert.match(rg, /28\.00'/, 'the CG dimension from end A'); assert.match(rg, /10\.00'/); assert.match(rg, /50\.00'/);
  const gd = textsOf(B, 'ground'); assert.match(gd, /CRANE A \| FL \(FRONT LEFT\) \| 41\.08/); assert.match(gd, /2,937/); assert.match(gd, /0\.73/); assert.match(gd, /4,000 PSF \(4\.00 KSF\)/); assert.match(gd, /4\.00 X 4\.00 FT X 12\.00 IN/);
  assert.match(gd, /CRANE 1 \| FL/); assert.match(gd, /ENTERED DATA/); assert.match(gd, /REPORT SEC\. 7/);
});

test('drawing set without lifts: cover and notes only, the missing sheets listed', () => {
  const P = M.newProject(), B = DS.build(P, { evalPick: () => null, evalT: () => null });
  same(B.sheets.map(s => s.id), ['cover', 'notes']); assert.ok(B.miss.some(q => /LIFT PLAN SHEETS/.test(q[0]))); assert.ok(X.validate(B.D.toDXF()).ok);
});

test('clip (Liang–Barsky) and the hook for other modules\' sheets', () => {
  const w = { x0: 0, y0: 0, x1: 10, y1: 10 };
  same(DS.clip({ x: -5, y: 5 }, { x: 15, y: 5 }, w), [{ x: 0, y: 5 }, { x: 10, y: 5 }]); assert.equal(DS.clip({ x: -5, y: -1 }, { x: 15, y: -1 }, w), null);
  const P = project(); DS.addSheets(() => [{ id: 'route', title: 'TRUCKING ROUTE', fn: D => D.text(D.layer('TEXT', 7), 0, 0, D.h, 'ROUTE HOOK'), kmin: 120 }]);
  const B = DS.build(P, ctxOf(P)); assert.equal(B.sheets[B.sheets.length - 1].id, 'route'); assert.match(textsOf(B, 'route'), /ROUTE HOOK/);
});

// Route (C6, trucking route sheet): a semi (tractor 20,000 lb, trailer 15,000 lb) carrying the tandem lift's girder (40,000 lb, linked):
//   gross weight = 20,000 + 15,000 + 40,000 = 75,000 lb (statics: the sum of the weights); one 90° turn (T1).
test('route (C6): summary row and the route sheet (gross weight hand check, turn table, delivers to the girder lift)', () => {
  const P = project({ route: true }), ctx = ctxOf(P), S = DS.summary(P, ctx), r = S.find(x => x.kind === 'route');
  assert.ok(r && !r.missing, r && r.missing); near(r.gross, 75000, 1e-6, 'gross = tractor + trailer + girder'); assert.equal(r.to.name, 'Tandem 1'); assert.equal(r.to.key, 'tandem-t1'); assert.ok(r.otMax > 0);
  const B = DS.build(P, ctx, { paper: 'D' }); same(B.errors, []); assert.ok(B.sheets.some(s => s.id === 'route-0'));
  const rt = textsOf(B, 'route-0'); assert.match(rt, /GROSS WEIGHT \| 75,000 LB \(37\.50 T\)/); assert.match(rt, /\| T1 \|/); assert.match(rt, /DELIVERS TO \| TANDEM 1/); assert.match(rt, /REPORT SEC\. 8\.1/); assert.match(rt, /REPORT SEC\. 6\.3/);
  assert.match(textsOf(B, 'cover'), /TRUCKING ROUTES/); assert.ok(X.validate(B.D.toDXF()).ok);
});

test('2026-11-17: crane symbol layers in the DXF; aerial sheets (site + one per lift) with the attribution, the frame entity for the image', () => {
  const P = project({ route: true }), ctx = ctxOf(P), B = DS.build(P, ctx, { paper: 'D', aerial: true });
  same(B.errors, []);
  same(B.sheets.map(s => s.id).filter(id => id !== 'route'), ['cover', 'notes', 'aerial', 'lift-k1', 'aerial-k1', 'tlift-t1', 'aerial-t1', 'rig-t1', 'ground', 'route-0']);
  const txt = B.D.toDXF({ ltscale: 1 }), v = X.validate(txt); assert.ok(v.ok, v.errors.join('; '));
  ['C-CRANE-CARRIER', 'C-CRANE-OUTRIGGER', 'C-CRANE-FLOAT', 'C-CRANE-UPPER', 'C-CRANE-CWT', 'C-CRANE-BOOM', 'C-CRANE-HOOK', 'C-CRANE'].forEach(l => assert.ok(v.layers.includes(l), 'layer ' + l));
  B.sheets.filter(s => /^aerial/.test(s.id)).forEach(s => {
    assert.ok(s.aerial && s.aerial.e && s.aerial.e.t === 'PL' && s.aerial.e.pts.length === 4, s.id + ': frame entity');
    const xs = s.aerial.e.pts.map(p => p[0]), ys = s.aerial.e.pts.map(p => p[1]);
    near((Math.max(...xs) - Math.min(...xs)) / 12, s.aerial.w.x1 - s.aerial.w.x0, 1e-6, s.id + ': frame = window, 12 units per ft'); near((Math.max(...ys) - Math.min(...ys)) / 12, s.aerial.w.y1 - s.aerial.w.y0, 1e-6);
    assert.ok(Math.min(...xs) >= s.ox && Math.max(...xs) <= s.ox + s.W && Math.min(...ys) >= 0 && Math.max(...ys) <= s.H, s.id + ': frame inside its sheet');
    const t = textsOf(B, s.id); assert.match(t, /ESRI WORLD IMAGERY\. TILES \(C\) ESRI - SOURCE: ESRI, MAXAR, EARTHSTAR GEOGRAPHICS, AND THE GIS USER COMMUNITY\. IMAGERY DATE VARIES; NOT A SURVEY\./);
    assert.match(t, /WORLD FILE \(\.PGW, IN THESE DXF COORDINATES\)/); });
  // the whole-site window holds every setup, pick, girder pose and route point
  const w = B.sheets.find(s => s.id === 'aerial').aerial.w; [...P.setups, ...P.picks.map(k => k.pick), P.tandems[0].set, ...P.routes[0].pts].forEach(p => assert.ok(p.x > w.x0 && p.x < w.x1 && p.y > w.y0 && p.y < w.y1));
  // without opt.aerial the set is unchanged
  same(DS.build(P, ctx, { paper: 'D' }).sheets.map(s => s.id).filter(id => id !== 'route'), ['cover', 'notes', 'lift-k1', 'tlift-t1', 'rig-t1', 'ground', 'route-0']);
  // the lift plan's crane symbol: the upperworks turned to the pick (30 ft over the front) -> the slew label
  assert.match(textsOf(B, "lift-k1"), /SLEW \+0 DEG FROM FRONT, R 30\.0 FT/);
  const vw = DS.buildView(P, ctx, { x0: 450, x1: 650, y0: 1950, y1: 2100 }, { title: 'PLAN VIEW' }); assert.equal(vw.sheets.length, 1); assert.ok(vw.sheets[0].aerial.e);
});
