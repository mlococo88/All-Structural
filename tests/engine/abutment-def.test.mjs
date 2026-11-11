// shared/abutment-def.js (ABX, 2026-11-11; HANDOFF.md §4.5 definition block, §4.15 abutmentDef): the abutment definition exchanged by the
// Abutment Calculator and Bridge Substructure Loading. Node only.
// Checks: the SubLoads builder (stem / backwall heights from the elevations, heel = W − toe − t, soil height auto, D_f, the bearing +
// pedestal height); the older-payload reader (fromLoads: L_ftg from calculatorInput, else L_ab); validation (geometry refuses, a bad
// optional group is disabled with its reason); the mapping into the calculator (paths, |θ|, setback, integral keeps L_ab and w_c only,
// approach slab width 0 = L_ab·cos θ); the calculator builder (battered stem, a_f, elevations from the seat, the approach-slab share as
// the equivalent %); the mapping into SubLoads (L_ab / L_ftg / soil height stay blank when they equal the auto values, footing width =
// toe + t_bot + heel, battered-stem weight note, top-of-footing option, bridge-wide scope); the review rows; the envelope check; a round
// trip SubLoads default Abut. 1 -> calculator -> SubLoads changes no SubLoads input.
import assert from 'node:assert/strict';
import { loadShared, test } from './harness.mjs';

const W = loadShared('abutment-def.js'), D = W.SharedAbutmentDef;
const J = v => JSON.parse(JSON.stringify(v));
const get = (o, p) => p.split('.').reduce((a, k) => a == null ? a : a[k], o);
const set = (o, p, v) => { const k = p.split('.'); let x = o; for (let i = 0; i < k.length - 1; i++) { if (x[k[i]] == null) x[k[i]] = {}; x = x[k[i]]; } x[k[k.length - 1]] = v; };
const near = (a, b, t = 1e-3) => Math.abs(a - b) <= t;

// SubLoads default Abut. 1 (Example three-span continuous): deck El. 125.00, d 63 in, haunch 2, ts 8, hb 4.5 in, hp 6 in, skew 15°
const dSup = (8 + 2 + 63) / 12, seatMin = 125 - dSup - 4.5 / 12 - 0.03, stemTop = seatMin - 6 / 12;
const SL = () => ({ name: 'Abut. 1', end: 'begin', skewDeg: 15, spanL: 110, abut: { stemT: 4, brgA: 1.75, bwT: 1.5, toe: 4 }, ftg: { type: 'comb', W: 14, t: 3 },
  Lab: 44.5 / Math.cos(15 * Math.PI / 180), Lftg: 44.5 / Math.cos(15 * Math.PI / 180), stemTop, bwTop: 125, topFtg: 108, ftgBot: 105, ground: 112, deckZ: 125, hbIn: 4.5, hpIn: 6,
  br: { d: 63, haunch: 2, ts: 8, wc: 0.15, khR: 0.5, kv: 0, hEQr: 0.6 }, As: 0.15,
  earth: { asOn: 'no', asW: '', asL: 20, asT: 12, asPct: 50, asLL: 'no', method: 'rankine', gamma: 0.12, phi: 32, delta: 17, beta: 0, soilH: '', hw: 0, heq5: 4, heq10: 3, heq20: 2, esQ: 0, constrFill: 0, gLLc: 0 },
  aslW: 44.5, elast: { G: 0.15, L: 14, W: 20, hrt: 3.5 }, brgType: 'elast' });
// the calculator's default state, the parts the mapping reads
const AB = () => ({ geom: { hbw: 5, tbw: 1.5, bwOff: 0, shD: 0, hstem: 14, tst: 4.5, tsb: 4.5, brgSetback: 1.25, brgFront: 1.75, Ltoe: 3.5, Lheel: 5, tf: 3, Lab: 44, Lftg: 44, soilH: 19, beta: 0, spanL: 80, skew: 0, hw: 0,
  elSeat: null, elBrgH: null, elGird: null, elHaunch: null, elDeck: null, hwFr: null }, mat: { gc: 0.15 }, soil: { method: 'rankine', gamma: 0.12, phi: 32, delta: 17, heq5: 4, heq10: 3, heq20: 2, esQ: 0, Kmode: 'active' },
  constr: { hFill: 0, gLL: 0, qC: 0 }, fnd: { Df: 3 }, seismic: { As: 0.15, khR: 0.5, khRAuto: true, kv: 0, hEQr: 0.6, hEQmode: 'static' }, bearing: { padL: 18, padW: 24, G: 0.13, hrt: 2 },
  apSlab: { on: false, L: 16, t: 1.25, W: 0, lsRed: true }, wing: { on: true }, piles: { enabled: false } });

test('abutment-def: SubLoads builder (heights from the elevations, heel, soil height auto, D_f, bearing + pedestal)', () => {
  const d = D.fromSubLoads(SL());
  assert.equal(d.v, 1); assert.equal(d.source, 'subloads');
  assert.ok(near(d.stem.H, stemTop - 108, 1e-4)); assert.ok(near(d.backwall.h, 125 - stemTop, 1e-4));
  assert.equal(d.footing.heel, 6); assert.equal(d.footing.W, 14); assert.equal(d.footing.Df, 7);
  assert.ok(near(d.lengths.Lab, 46.0698, 1e-4)); assert.equal(d.lengths.LabAuto, true); assert.equal(d.lengths.LftgAuto, true);
  assert.equal(d.soil.soilH, 17); assert.equal(d.soil.soilHAuto, true);
  assert.equal(d.superstructure.brgHIn, 10.5); assert.equal(d.seismic.hEQmode, 'ratio'); assert.equal(d.pad.L, 14);
  assert.equal(D.validate(d).ok, true);
  const x = SL(); x.earth.soilH = 15; x.abut.L = 40; x.brgType = 'steel'; const d2 = D.fromSubLoads(x);
  assert.equal(d2.soil.soilH, 15); assert.equal(d2.soil.soilHAuto, false); assert.equal(d2.lengths.LabAuto, false); assert.equal(d2.pad, null);
  const x3 = SL(); x3.As = NaN; assert.equal(D.fromSubLoads(x3).seismic.As, null); assert.equal(D.validate(D.fromSubLoads(x3)).gerr.seisset, undefined);
});

test('abutment-def: older payload (fromLoads): L_ftg from calculatorInput, else L_ab; soil height from the elevations', () => {
  const a = { name: 'Abut. 1', end: 'begin', skewDeg: -15, geometry: { stemLengthAlongSkew: 46.07, stemThickness: 4, bearingToStemFront: 1.75, backwallThickness: 1.5, backwallHeight: 7.009, stemHeight: 9.991, toe: 4, heel: 6, footingWidth: 14, footingThickness: 3,
    elevations: { deckAtCL: 125, topOfBackwall: 125, bridgeSeat: 117.991, topOfFooting: 108, bottomOfFooting: 105, ground: 112 } }, bearings: { type: 'elastomeric', padLengthIn: 14, padWidthIn: 20, shearModulusKsi: 0.15, rubberThicknessIn: 3.5 },
    calculatorInput: { geom: { spanL: 110 }, mat: { gc: 0.15 } } };
  const d = D.fromLoads(a, {}); assert.equal(d.legacy, true); assert.equal(d.lengths.Lftg, 46.07); assert.equal(d.soil.soilH, 17); assert.equal(d.footing.Df, 7); assert.equal(d.spanL, 110);
  a.calculatorInput.geom.Lftg = 50; assert.equal(D.fromLoads(a, {}).lengths.Lftg, 50);
  const T = D.toAbutment(d, {}); assert.ok(T.gerr.soil && T.gerr.aps && T.gerr.elev && T.gerr.seisset, 'the new groups need a definition block');
  assert.equal(T.groups.bridge.items.find(x => x.path === 'geom.skew').val, 15, '|θ|');
});

test('abutment-def: validation refuses bad geometry and disables a bad optional group', () => {
  const d = D.fromSubLoads(SL());
  const b1 = J(d); b1.stem.tTop = 0; assert.equal(D.validate(b1).ok, false);
  const b2 = J(d); b2.af = 5; assert.match(D.validate(b2).errors.join(), /not on the stem/);
  const b3 = J(d); b3.soil.phi = 80; const v3 = D.validate(b3); assert.equal(v3.ok, true); assert.match(v3.gerr.soil, /φ/);
  const b4 = J(d); b4.soil.beta = 40; b4.soil.phi = 35; assert.match(D.validate(b4).gerr.soil, /β/);
  const b5 = J(d); b5.v = 2; assert.equal(D.validate(b5).ok, false);
  const b6 = J(d); b6.pad.G = 2; assert.match(D.validate(b6).gerr.brg, /G/);
});

test('abutment-def: mapping into the calculator', () => {
  const d = D.fromSubLoads(SL()), T = D.toAbutment(d, { roadwayW: 41.5 }), it = (g, p) => T.groups[g].items.find(x => x.path === p);
  assert.equal(it('geom', 'geom.brgSetback').val, 0.75); assert.equal(it('geom', 'geom.Lheel').val, 6); assert.equal(it('geom', 'geom.Lftg').val, 46.07);
  assert.equal(it('geom', 'geom.soilH').val, 17); assert.equal(it('geom', 'fnd.Df').val, 7); assert.equal(it('geom', 'mat.gc').val, 0.15);
  assert.equal(it('bridge', 'geom.skew').val, 15); assert.equal(it('bridge', 'longit.roadwayW').val, 41.5);
  assert.equal(it('soil', 'soil.method').val, 'rankine'); assert.equal(it('soil', 'geom.hw').val, 0);
  assert.deepEqual(J(T.groups.aps.items.map(x => [x.path, x.val])), [['apSlab.on', false]], 'slab off: only on/off');
  assert.equal(it('elev', 'geom.elBrgH').val, 10.5); assert.equal(it('seisset', 'seismic.khRAuto').val, false);
  const x = SL(); x.earth.asOn = 'yes'; x.earth.method = 'atrest'; const T2 = D.toAbutment(D.fromSubLoads(x), {});
  assert.equal(T2.groups.aps.items.find(q => q.path === 'apSlab.W').val, 0, 'W = L_ab cos θ -> 0 (auto)');
  assert.equal(T2.groups.aps.items.find(q => q.path === 'apSlab.t').val, 1);
  assert.equal(T2.groups.soil.items[0].path, 'soil.Kmode');
  const Ti = D.toAbutment(d, { integral: true, roadwayW: 41.5 });
  assert.deepEqual(J(Ti.groups.geom.items.map(x => x.path)), ['geom.Lab', 'mat.gc']); assert.ok(!Ti.groups.bridge.items.some(x => x.path === 'longit.roadwayW')); assert.ok(Ti.gerr.elev);
});

test('abutment-def: calculator builder (battered stem, a_f, elevations from the seat, approach-slab share)', () => {
  const S = AB(); S.geom.tsb = 5.5; S.geom.elSeat = 120; S.geom.elBrgH = 10; S.geom.elGird = 60; S.geom.elHaunch = 2; S.geom.elDeck = 8;
  S.apSlab.on = true; S.apSlab.skew = 'square';
  const ap = { W: 44, L: 16, t: 1.25, RDC: 0.15 * 1.25 * 44 * 18 / 2 };   // a square far end: L̄ = 18 ft
  const d = D.fromAbutment(S, { name: 'North', ap });
  assert.equal(d.af, 1.75); assert.equal(d.footing.W, 3.5 + 5.5 + 5); assert.equal(d.info.battered, true);
  assert.equal(d.elevations.topOfFooting, 106); assert.equal(d.elevations.topOfBackwall, 125); assert.equal(d.elevations.deck, 126.6667);
  assert.equal(d.elevations.ground, 106 - 3 + 3);
  assert.equal(d.approachSlab.sharePct, 56.25, 'R_DC / (w_c t W L) = 18/32');
  assert.ok(d.info.wingwalls.length === 1);
  const d0 = D.fromAbutment(AB(), {}); assert.equal(d0.elevations, null); assert.equal(d0.superstructure, null); assert.equal(d0.approachSlab.on, false);
});

test('abutment-def: mapping into SubLoads (auto values stay blank, battered note, options, bridge-wide scope)', () => {
  const S = AB(); S.geom.tsb = 5.5;
  const d = D.fromAbutment(S, {}), ctx = { Lauto: 46.0698, soilHAuto: 17, stemTop: 117.49, bwTop: 125, topFtg: 108, GWd: 44.5, ftgType: 'comb', skewDeg: 15, spanL: 110 };
  const T = D.toSubLoads(d, ctx), it = (g, p) => T.groups[g].items.find(x => x.path === p);
  assert.equal(it('geom', 'abut.L').val, 44); assert.equal(it('geom', 'abut.Lftg').val, ''); assert.equal(it('geom', 'abut.stemT').val, 4.5); assert.equal(it('geom', 'ftg.W').val, 14);
  assert.match(T.groups.geom.notes[0], /Battered stem/); assert.match(T.groups.geom.notes[0], /= 2\.04\d* kip|kip/);
  assert.equal(it('soil', 'earth.soilH').val, 19);
  assert.equal(it('ftgEl', 'topFtg').val, 103.49); assert.equal(T.groups.bridgewide.scope, 'bridge'); assert.equal(it('bridgewide', 'wc').val, 0.15);
  assert.ok(T.info.some(r => /Wingwalls/.test(r[0]) && /wingwalls on/.test(r[1])));
  const T2 = D.toSubLoads(D.fromAbutment(Object.assign(AB(), { geom: Object.assign(AB().geom, { Lab: 46.0698, soilH: 17 }) }), {}), ctx);
  assert.equal(T2.groups.geom.items[0].val, ''); assert.equal(T2.groups.soil.items.find(x => x.path === 'earth.soilH').val, '');
  const T3 = D.toSubLoads(d, Object.assign({}, ctx, { ftgType: 'none' })); assert.ok(T3.groups.geom.items.some(x => x.path === 'ftg.type' && x.val === 'comb'));
});

test('abutment-def: review rows and the envelope check', () => {
  const r = D.rows([{ path: 'a', val: 1 }, { path: 'b', val: '' }, { path: 'c', val: 'x' }, { path: 'd', val: false }, { path: 'e', val: 2 }], p => ({ a: 1.0002, b: '', c: 'y', d: false, e: '' })[p]);
  assert.deepEqual(J(r.map(x => x.chg)), [false, false, true, false, true]);
  const S = AB(), def = D.fromAbutment(S, {});
  const p = { _schema: D.SCHEMA, schemaVersion: 1, units: J(D.UNITS), abutType: 'conv', definition: def, contentHash: D.hash(def) };
  assert.equal(D.checkPayload(p).ok, true); assert.equal(D.checkPayload(p).warnings.length, 0);
  const q = J(p); q.definition.footing.toe = 5; assert.match(D.checkPayload(q).warnings[0], /hash/);
  const u = J(p); u.units.length = 'm'; assert.equal(D.checkPayload(u).ok, false);
  const t = J(p); t.abutType = 'integral'; assert.equal(D.checkPayload(t).ok, false);
  assert.match(D.summary(p), /L_ab 44 ft, stem 4\.5 × 14 ft, footing 13 × 3 ft/);
});

test('abutment-def: round trip SubLoads default Abut. 1 -> calculator (default project) -> SubLoads changes no SubLoads input', () => {
  const x = SL(), d = D.fromSubLoads(x), S = AB();
  const T = D.toAbutment(d, { roadwayW: 41.5 });
  ['geom', 'bridge', 'aps', 'elev'].forEach(g => T.groups[g].items.forEach(i => set(S, i.path, i.val)));
  S.geom.brgFront = S.geom.tst - S.geom.tbw - S.geom.brgSetback;   // the calculator's abBrgSync
  const back = D.fromAbutment(S, {});
  const ctx = { Lauto: x.Lab, soilHAuto: x.bwTop - x.topFtg, stemTop: x.stemTop, bwTop: x.bwTop, topFtg: x.topFtg, GWd: 44.5, ftgType: 'comb' };
  const U = { abut: J(x.abut), ftg: J(x.ftg), earth: J(x.earth), elast: J(x.elast) }, U0 = J(U), R = D.toSubLoads(back, ctx);
  ['geom', 'soil', 'aps'].forEach(g => R.groups[g].items.forEach(i => set(U, i.path, i.val)));   // the default ticks
  // the SubLoads unit had no abut.L / abut.Lftg (blank = auto): they stay blank
  assert.equal(U.abut.L, ''); assert.equal(U.abut.Lftg, ''); delete U.abut.L; delete U.abut.Lftg;
  assert.deepEqual(J(U), U0);
  // the review shows no changed row for those groups
  ['geom', 'soil', 'aps'].forEach(g => assert.ok(D.rows(R.groups[g].items, p => get(U0, p) == null ? '' : get(U0, p)).every(r => !r.chg), g));
});
