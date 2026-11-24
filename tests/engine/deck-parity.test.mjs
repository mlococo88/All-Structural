// shared/deck.js against the Prestressed Bridge Design deck module (apps/ps-bridge/engine/pbd-handling-deck.js: deckTableA4,
// deckDesignSection, deckCalc; a frozen copy of the old app's code). Created 2026-11-23 with shared/deck.js.
// The shared file is the same method written once for the Steel Bridge app; the Prestressed app is not wired to it. This test is the proof
// that the two give the same numbers: every value deckCalc returns is compared with SharedDeck.strip on made-up decks, exactly
// (Object.is on every number: no tolerance), and Table A4-1 is compared entry by entry.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const SD = loadShared('deck.js').SharedDeck;
// the Prestressed module, run as the page runs it: its own clamp (pbd-library.js) and window.PBD.ownLoads (owner eta and m)
const ps = { console }; ps.window = ps; vm.createContext(ps);
vm.runInContext('const clamp=(v,a,b)=>Math.min(b,Math.max(a,v)); const relCfacOf=()=>0.65;', ps);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps/ps-bridge/engine/pbd-handling-deck.js'), 'utf8'), ps, { filename: 'pbd-handling-deck.js' });
ps.PBD = { ownLoads: inp => inp.__own || { eta: 1, mLL: 1 } };
const PS = { table: vm.runInContext('A4_1', ps), X: vm.runInContext('A4_1_X', ps), deckTableA4: ps.deckTableA4, deckDesignSection: ps.deckDesignSection, deckCalc: ps.deckCalc };

test('the Prestressed clamp used here is the one of its library file', () => {
  const lib = fs.readFileSync(path.join(ROOT, 'apps/ps-bridge/engine/pbd-library.js'), 'utf8');
  assert.ok(lib.includes('const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));'));
});

test('Table A4-1: the same numbers as the Prestressed module, entry by entry', () => {
  assert.equal(SD.A4.length, PS.table.length); assert.equal(SD.A4.length, 45);
  SD.A4.forEach((r, i) => { assert.equal(r.length, 9); r.forEach((v, k) => assert.ok(Object.is(v, PS.table[i][k]), `row ${i} col ${k}`)); });
  assert.deepEqual([...SD.A4_X], [...PS.X]);
});

test('Table A4-1 lookup: identical for S from 3 to 16 ft and x from 0 to 30 in (1,400 points)', () => {
  let n = 0;
  for (let S = 3; S <= 16.0001; S += 0.13) for (let x = 0; x <= 30; x += 1.1) {
    const a = SD.tableA4(S, x), b = PS.deckTableA4(S, x);
    ['Mpos', 'Mneg', 'S', 'Sused', 'x', 'xUsed', 'below', 'above', 'outOfRange', 'xClamped'].forEach(k => assert.ok(Object.is(a[k], b[k]), `${k} at S=${S}, x=${x}: ${a[k]} / ${b[k]}`)); n++;
  }
  assert.ok(n >= 1400);
});

test('design section: precast I and closed box as the Prestressed module', () => {
  [0, 12, 20, 26, 42, 48, 60, 96].forEach(b => {
    assert.ok(Object.is(SD.designSection('precast', b).x, PS.deckDesignSection({}, { btf: b }).x));
    assert.ok(Object.is(SD.designSection('box', b).x, PS.deckDesignSection({}, { btf: b, isBox: true }).x));
    assert.equal(SD.designSection('precast', b).rule, PS.deckDesignSection({}, { btf: b }).rule);
  });
});

// made-up decks (no project data): [name, Prestressed inputs]
const deck = (o) => ({ on: true, method: 'strip', oh: 3.0, fyd: 60, barTop: 0.31, barBot: 0.31, sTop: 6, sBot: 6, coverT: 2.5, coverB: 1.0, wsFut: 0.025, bBar: 18, wBar: 0.30, xnegAuto: true, xneg: 0, ...o });
const CASES = [
  ['A: 8 ft bays, 8 in slab, I-girder 20 in flange', { S: 8, ts: 8, mat: { fcd: 4, wcd: 0.150 }, deck: deck({}) }, { btf: 20 }],
  ['B: 9.5 ft bays, separate dead-load thickness, #5 at 5 top', { S: 9.5, ts: 8, tsSeparate: true, tsDL: 8.5, mat: { fcd: 4, wcd: 0.145, wcdLoad: 0.150 }, deck: deck({ sTop: 5, sBot: 7, oh: 3.25, wBar: 0.40 }) }, { btf: 42 }],
  ['C: 6.3 ft bays, 7.5 in slab, 5 ksi, wide flange (15 in cap)', { S: 6.3, ts: 7.5, mat: { fcd: 5, wcd: 0.150 }, deck: deck({ barTop: 0.20, sTop: 5, barBot: 0.20, sBot: 6, oh: 2.5, bBar: 15, wBar: 0.32, wsFut: 0.035 }) }, { btf: 61 }],
  ['D: 12.37 ft bays, 9 in slab, #6 bars, entered design section 7.3 in', { S: 12.37, ts: 9, mat: { fcd: 4.5, wcd: 0.150 }, deck: deck({ barTop: 0.44, sTop: 6, barBot: 0.44, sBot: 8, oh: 4.2, bBar: 19.5, wBar: 0.45, xnegAuto: false, xneg: 7.3 }) }, { btf: 30 }],
  ['E: adjacent box (closed), 4.0 ft, no wearing surface', { S: 4, ts: 6, mat: { fcd: 6, wcd: 0.150 }, deck: deck({ barTop: 0.20, sTop: 12, barBot: 0.20, sBot: 12, oh: 1.5, bBar: 12, wBar: 0.25, wsFut: 0 }) }, { btf: 48, isBox: true }],
  ['F: owner eta 1.05 and m 1.2 (as RIDOT)', { S: 10.25, ts: 8.5, mat: { fcd: 4, wcd: 0.150 }, deck: deck({ sTop: 5, sBot: 6, oh: 3.75, bBar: 17.25 }), __own: { eta: 1.05, mLL: 1.2 } }, { btf: 26 }],
  ['G: S above the table (16.2 ft), design section beyond 24 in', { S: 16.2, ts: 10, mat: { fcd: 4, wcd: 0.150 }, deck: deck({ barTop: 0.60, sTop: 6, barBot: 0.60, sBot: 6, oh: 5, xnegAuto: false, xneg: 31 }) }, { btf: 20 }],
  ['H: S below the table (3.2 ft), barrier wider than the overhang', { S: 3.2, ts: 7, mat: { fcd: 4, wcd: 0.150 }, deck: deck({ oh: 1.0, bBar: 18 }) }, { btf: 16 }],
  ['I: bar spacing 0 (no steel credited) and a heavy overlay', { S: 7.75, ts: 8, mat: { fcd: 4, wcd: 0.150 }, deck: deck({ sTop: 0, wsFut: 0.060, oh: 3.4 }) }, { btf: 24 }],
  ['J: high-strength concrete (beta_1 at 0.65), fy 75, compression-controlled top mat', { S: 11, ts: 7, mat: { fcd: 10, wcd: 0.155 }, deck: deck({ fyd: 75, barTop: 1.00, sTop: 3, coverT: 3.5, barBot: 0.79, sBot: 4, oh: 4.5, bBar: 20, wBar: 0.5 }) }, { btf: 36, isDeck: true }]];

const same = (a, b, at) => {
  if (typeof b === 'number') { assert.ok(Object.is(a, b), `${at}: shared ${a}, Prestressed ${b}`); return 1; }
  if (typeof b === 'boolean' || typeof b === 'string') { assert.equal(a, b, at); return 1; }
  let n = 0; Object.keys(b).forEach(k => { n += same(a[k], b[k], `${at}.${k}`); }); return n;
};
CASES.forEach(([name, inp, g]) => test(`parity, deck ${name}: every value of deckCalc is identical`, () => {
  const P = PS.deckCalc(inp, g, null), D = inp.deck, own = inp.__own || {};
  const kind = g.isBox || g.isDeck ? 'box' : 'precast';
  const xneg = D.xnegAuto === false ? SD.clamp(+D.xneg || 0, 0, 24) : SD.designSection(kind, g.btf).x;
  const R = SD.strip({ S: inp.S, ts: inp.ts, tsLoad: inp.tsSeparate ? (+inp.tsDL || inp.ts) : inp.ts, fc: inp.mat.fcd, fy: +D.fyd, wc: +inp.mat.wcdLoad || +inp.mat.wcd, wsFut: D.wsFut, xneg,
    barTop: D.barTop, sTop: D.sTop, coverT: D.coverT, barBot: D.barBot, sBot: D.sBot, coverB: D.coverB, oh: D.oh, bBar: D.bBar, wBar: D.wBar, eta: own.eta, mLL: own.mLL });
  const skip = new Set(['xnegAuto', 'dsRule']);   // the Prestressed section rule text (its automatic x is compared through xneg)
  let n = 0; Object.keys(P).forEach(k => { if (!skip.has(k)) n += same(R[k], P[k], k); });
  assert.ok(n >= 60, `${n} values compared`);
  assert.equal(!!R.own, !!P.own);
}));

/* DD (2026-11-24, engineer request "Please fix the deck distribution steel"): the corrected distribution reinforcement of the two tools.
   The raw parity above stays (deckCalc and strip() both on S = the girder spacing). The Prestressed app corrects R.deck.distPct after
   computeAll (apps/ps-bridge/engine/deckdist.js apply); the Steel app computes it in engine/deck.js calc(); both on S_eff of AASHTO LRFD
   10th Ed. Art. 9.7.2.3 with shared/deck.js distEff. Here: the Prestressed correction of every I-girder case above equals distEff with the
   same S, flange and web; and the Steel app on a bridge of the same spacing, flange and web gives the same S_eff and percentage. */
ps.SharedDeck = SD;
vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps/ps-bridge/engine/deckdist.js'), 'utf8'), ps, { filename: 'deckdist.js' });
const corr = (inp, g) => ps.PSBDeckDist.apply(inp, { g, deck: PS.deckCalc(inp, g, null) });
test('DD parity: the Prestressed correction of every case = shared distEff on the same S, flange and web (I-girders); 67 % for a box or a deck slab', () => {
  let n = 0;
  CASES.forEach(([name, inp, g0], i) => {
    const bw = [6, 6, 7, 8, 6.5][i % 5], g = { ...g0, bw };
    const R = corr(inp, g), E = SD.distEff({ S: inp.S, bf: g.btf, tw: bw }), raw = PS.deckCalc(inp, g, null).distPct;
    assert.ok(Object.is(R.deck.dd.pct0, raw), name);
    if (g.isBox || g.isDeck) { assert.equal(R.deck.distPct, 67, name); assert.equal(R.deck.dd.why, 'family'); n++; return; }
    ['Seff', 'clear', 'ohF', 'pct', 'pct0'].forEach(k => assert.ok(Object.is(R.deck.dd[k], E[k]), `${name} ${k}: ${R.deck.dd[k]} / ${E[k]}`));
    assert.ok(Object.is(R.deck.distPct, E.pct)); assert.ok(R.deck.distPct >= raw); n++;
  });
  assert.equal(n, CASES.length);
});
test('DD parity: the Steel app and the Prestressed app give the same S_eff and percentage for the same spacing, flange and web', () => {
  const E = f => path.join(ROOT, 'apps/steel-bridge', f);
  const WS = loadShared(...['units.js', 'steps.js', 'lldf.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js', 'engine/deck.js'].map(E)));
  [[9, 16, 0.5625], [11, 18, 0.5625], [12, 18, 0.5625], [12.37, 20, 0.625], [13.5, 24, 0.75], [14, 42, 6]].forEach(([S, bf, tw]) => {
    const P = WS.SBDModel.newProject(); P.deckDesign = { on: true }; P.xs.bays = P.xs.bays.map(() => S);
    P.girders.forEach(gq => gq.segments.forEach(s => { s.topB = bf; s.tw = tw; }));
    const St = WS.SBDDeck.calc(P), inp = { S, ts: 8, mat: { fcd: 4, wcd: 0.150 }, deck: deck({}) }, Pr = corr(inp, { btf: bf, bw: tw });
    assert.equal(St.err, undefined, St.err);
    assert.ok(Object.is(St.dist.Seff, Pr.deck.dd.Seff), `S_eff at S=${S}: Steel ${St.dist.Seff} / Prestressed ${Pr.deck.dd.Seff}`);
    assert.ok(Object.is(St.dist.pct, Pr.deck.distPct), `pct at S=${S}`); assert.ok(Object.is(St.dist.pct0, Pr.deck.dd.pct0), `before at S=${S}`);
  });
});
