// BRG-HO (2026-11-24): the bearingLoads hand-off (HANDOFF.md §4.17): shared/bearing-loads.js (service, check, plan) and the PS Bridge
// sender apps/ps-bridge/engine/bearing.js (blPayload, llEnds). Made-up bridges (the SRP test's: 5 girders, 120 ft simple span, or two
// continuous 100 ft spans, with a 6 ft sidewalk PL 75 psf and three utilities).
//   1. Hand check, simple span 120 ft: LL per lane V_truck 66.4, V_tandem 49.167, V_lane 38.4 kip; × DF_v: without IM DF_v (66.4 + 38.4),
//      with IM = the engine's R.VLL = DF_v (1.33·66.4 + 38.4); DC1, DC2, DW and the separate items = the superReactions values of the
//      same girder end; the service totals P_DL = DC1 + DC2 + DW, P_LL = LL + PL, P_min = DC1 + DC2 − UT − UF.
//   2. Continuous: one bearing line per girder end (a pier has a back and an ahead line, not summed); LL with IM at the abutment end = the
//      engine's support shear R.VLL; the pier ends' DC2 / DW are each span's end shear (superReactions' pier value = their sum).
//   3. Imported demands: LL null and a note. 4. The receiver's checks: old / bad payloads, the plan (n, IM, PL, the default girder).
//   5. The stale record: bearingLoads is an outgoing channel of PSBHoStale (allSig rebuilds the payload).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'handoff-store.js', 'handoff-stale.js', 'bearing-loads.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'lldf-opt', 'ut', 'pl', 'applicability', 'holddown', 'pierblock', 'rating-along', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs', 'bearing', 'hostale'].map(n => path.join(APP, `engine/${n}.js`)));
W.BridgeBeam = { get: () => null }; W.BridgeXfer = { sharedProject: () => null };
const M = W.PSBModel, BR = W.PSBBridge, H = W.PSBHandoffs, B = W.PSBBearing, SB = W.SharedBearingLoads, DM = W.PSBDemands;
const J = v => JSON.parse(JSON.stringify(v));
const cellsOf = P => BR.results(P, inp => W.PSBHoldDown.compute(J(inp))).cells;
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
function bridge(spans, cont, items) {
  const P = M.newProject(); P.project.name = 'Mill Road over Stony Brook (made up)';
  if (spans) { P.spans = { lengths: spans, continuity: cont ? 'composite' : 'simple' }; P.xs.skews = spans.map(() => 0).concat([0]); BR.syncSpans(P); }
  if (items !== false) { P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75;
    P.xs.dl.extra = [{ name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }, { name: 'Future utility', cat: 'UF', x: 16.5, plf: 0.05 }, { name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }]; }
  return P;
}

test('BRG-HO: simple span 120 ft, hand check of the live load and the service totals', () => {
  const P = bridge(), cells = cellsOf(P), r = B.blPayload(P, cells); assert.ok(r.ok, r.error);
  const p = r.payload; assert.equal(p._schema, 'bridge-bearing-loads'); assert.equal(p.lines.length, 2); assert.deepEqual(J(p.units), { force: 'kip', length: 'ft' }); assert.equal(p.factored, false);
  assert.deepEqual(J(p.lines.map(l => [l.support, l.side, l.span, l.end, l.x])), [['Abut. 1', 'ahead', 1, 'left', 0], ['Abut. 2', 'back', 1, 'right', 120]]);
  const c = cells.find(x => x.g === 2), dfv = c.R.dfv, hl = c.R.hl;
  near(hl.Vtr, 32 + 32 * 106 / 120 + 8 * 92 / 120, 1e-9, 'V_truck'); near(hl.Vtd, 25 + 25 * 116 / 120, 1e-9, 'V_tandem'); near(hl.Vln, 0.64 * 60, 1e-9, 'V_lane');
  const g = p.lines[0].girders[1];
  near(g.LL.max, dfv * (66.4 + 38.4), 1e-3, 'LL without IM'); near(g.LL.maxIM, dfv * (1.33 * 66.4 + 38.4), 1e-3, 'LL with IM'); near(g.LL.maxIM, c.R.VLL, 1e-3, 'the engine support shear');
  assert.equal(g.LL.min, 0); assert.equal(g.LL.minIM, 0);
  const sr = H.srPayload(c.inp, c.R).payload.supports[0].girders[0];
  assert.deepEqual([g.DC1, g.DC2, g.DW], [sr.DC1, sr.DC2, sr.DW]); assert.deepEqual(J(g.separate), J(sr.separate)); assert.deepEqual(J(g.separate), { PL: 4.05, PLmin: 0, UT: 1.2, UF: 0.6, UTc: 0.72 });
  near(g.service.Pdl, g.DC1 + g.DC2 + g.DW, 1e-3, 'Pdl'); near(g.service.Pll, g.LL.max + 4.05, 1e-3, 'Pll'); near(g.service.PllIM, g.LL.maxIM + 4.05, 1e-3, 'PllIM'); near(g.service.Pmin, g.DC1 + g.DC2 - 1.8, 1e-3, 'Pmin');
  assert.deepEqual(J(p.movement), { material: 'prestressed concrete', continuity: 'simple', units: [{ spans: [1], length: 120 }], length: 120, fixity: null });
  assert.ok(p.separate.pedestrian && p.separate.utilities.existing.includedIn === 'DC1');
  assert.deepEqual(J(SB.check(p)), { ok: true, warnings: [] });
});

test('BRG-HO: two continuous spans: a bearing line per girder end, the pier not summed', () => {
  const P = bridge([100, 100], true), cells = cellsOf(P), r = B.blPayload(P, cells); assert.ok(r.ok, r.error);
  const p = r.payload; assert.equal(p.lines.length, 4); assert.deepEqual(J(p.lines.map(l => l.support + ' ' + l.side)), ['Abut. 1 ahead', 'Pier 1 back', 'Pier 1 ahead', 'Abut. 2 back']);
  const sa = H.srAll(P, cells).payload, c1 = cells.find(x => x.s === 1 && x.g === 2);
  const back = p.lines[1].girders[1], ahead = p.lines[2].girders[1];
  near(back.DC2 + ahead.DC2, sa.supports[1].girders[1].DC2, 2e-3, 'pier DC2 = the sum of the two ends'); near(back.DW + ahead.DW, sa.supports[1].girders[1].DW, 2e-3, 'pier DW');
  near(p.lines[0].girders[1].LL.maxIM, c1.R.VLL, 1e-3, 'abutment LL+IM = the engine support shear');
  assert.ok(p.lines[0].girders[1].LL.min < 0, 'uplift at the abutment with the other span loaded'); assert.ok(p.lines[0].girders[1].LL.max < p.lines[0].girders[1].LL.maxIM);
  assert.equal(p.movement.units.length, 1); assert.equal(p.movement.units[0].length, 200); assert.ok(p.lines.every(l => l.unit === 0));
  assert.ok(SB.check(p).ok);
});

test('BRG-HO: imported demands: no live load (null), a note; a project without the items has no "separate"', () => {
  const P = bridge(); P.types.forEach(t => { DM.setSrc(P, t.id, 'table'); DM.setTable(P, t.id, [{ x: 0, V_DC2: 14, V_DW: 9, V_LLneg: -90 }, { x: 60, M_LLpos: 2400, M_DC2: 300, M_DW: 200 }, { x: 120, V_DC2: -14, V_DW: -9, V_LLpos: 90 }]); });
  const r = B.blPayload(P, cellsOf(P)); assert.ok(r.ok, r.error); const g = r.payload.lines[0].girders[1];
  assert.equal(g.LL, null); assert.equal(g.service.Pll, null); assert.ok(r.payload.notes.some(n => /imported demands/.test(n) && /LL null/.test(n)));
  const P0 = bridge(null, false, false), r0 = B.blPayload(P0, cellsOf(P0)); assert.ok(r0.ok); assert.ok(!/"separate"/.test(JSON.stringify(r0.payload)));
});

test('BRG-HO: the receiver\'s checks and plan (shared/bearing-loads.js)', () => {
  const P = bridge(), p = B.blPayload(P, cellsOf(P)).payload;
  assert.match(SB.check({ _schema: 'bridge-super-reactions', schemaVersion: 1 }).error, /wrong data type/);
  assert.match(SB.check(Object.assign(J(p), { schemaVersion: 2 })).error, /newer format/);
  assert.match(SB.check(Object.assign(J(p), { units: { force: 'kN', length: 'm' } })).error, /units/);
  const bad = J(p); bad.lines[0].girders[0].DC1 = 'x'; assert.match(SB.check(bad).error, /DC1 is not a valid number/);
  const tw = J(p); tw.lines[0].girders[0].service.Pdl += 1; assert.match(SB.check(tw).warnings[0], /differs from the sum of the parts/);
  const g = p.lines[0].girders[1];
  const a = SB.plan(p, 0, {}); assert.equal(a.design.label, 'G2'); assert.equal(a.design.Pdl, g.service.Pdl); assert.equal(a.design.Pll, g.service.Pll); assert.equal(a.design.Pmin, g.service.Pmin);
  const b = SB.plan(p, 0, { im: true, pl: false, n: 2, girder: 'G1' }), g1 = p.lines[0].girders[0];
  assert.equal(b.design.label, 'G1'); near(b.design.Pll, g1.LL.maxIM / 2, 1e-3, 'LL+IM, no PL, n = 2'); near(b.design.Pdl, (g1.DC1 + g1.DC2 + g1.DW) / 2, 1e-3, 'P_DL / 2');
  const nl = J(p); nl.lines[0].girders.forEach(x => { x.LL = null; }); const c = SB.plan(nl, 0, {}); assert.equal(c.design.Pll, null); assert.match(c.warnings[0], /P_LL is not filled/);
  assert.equal(SB.lineName(p.lines[1]), 'Abut. 2 (span 1, right end)'); assert.equal(SB.summary(p), '2 bearing lines, 5 girders, 120 ft');
});

test('BRG-HO: the stale record: bearingLoads is an outgoing channel (rebuilt from every girder line)', () => {
  const S = W.PSBHoStale; assert.ok(S.OUT_IDS.includes('bearingLoads')); assert.equal(S.CH.bearingLoads.ch, 'bearingLoads');
  const P = bridge(), cells = cellsOf(P), s0 = S.allSig(H, 'bearingLoads', P, cells);
  assert.equal(s0, S.sig(B.blPayload(P, cells).payload)); S.setSent(P, 'bearingLoads', { sig: s0, at: 'x' }); assert.equal(S.outState(S.sentOf(P, 'bearingLoads'), s0), 'current');
  P.xs.dl.ped = 90; const c2 = cellsOf(P); assert.equal(S.outState(S.sentOf(P, 'bearingLoads'), S.allSig(H, 'bearingLoads', P, c2)), 'stale');
});
