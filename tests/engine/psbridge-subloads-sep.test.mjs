// SRP (2026-11-23): the pedestrian reaction and the utility reactions as SEPARATE OPTIONAL items of the superReactions hand-off from the
// PS Bridge app to Bridge Substructure Loading (apps/ps-bridge/engine/handoffs.js srParts / srPayload / srAll; HANDOFF.md §4.4 "Separate
// items"; fixlog/ps-bridge.md and fixlog/Bridge Substructure Loading.md SRP). Made-up bridges.
//   1. No pedestrian load and no utility (every project saved before): the one-line payload is the engine's bxSuperRxPayload byte for byte
//      and the whole-bridge payload has no "separate" anywhere (old payloads and new payloads of such projects are the same text).
//   2. With them: the existing totals keep their meaning (DC1 contains UT and UF, DW contains UTc: the totals move by exactly the items),
//      the items by hand (simple span; two continuous spans), the descriptor, the notes.
//   3. Imported demands: no PL and no UTc item (the imported values are used as given), UT / UF still sent.
//   4. The receiver's own reader (Bridge Substructure Loading.html check(), cut at its anchors): an old payload is read exactly as before;
//      a new payload: DC1 net of UT and UF, UT and UF as their own values, so Σ (dc1 + ut + uf) = the DC1 sent (no double count); UTc stays
//      in DW; PL read for display; a payload with both forms is refused; Steel's UT / UF form is read as before.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'handoff-store.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'lldf-opt', 'ut', 'pl', 'applicability', 'reltension', 'holddown', 'pierblock', 'rating-along', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs'].map(n => path.join(APP, `engine/${n}.js`)));
W.BridgeBeam = { get: () => null }; W.BridgeXfer = { sharedProject: () => null };
const M = W.PSBModel, D = W.PSBDesign, BR = W.PSBBridge, H = W.PSBHandoffs, DM = W.PSBDemands;
const J = v => JSON.parse(JSON.stringify(v));
const cellsOf = P => BR.results(P, inp => W.PSBHoldDown.compute(J(inp))).cells;
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const BSL = fs.readFileSync(path.join(ROOT, 'Bridge Substructure Loading.html'), 'utf8');
function cut(a, b, from) { const i = BSL.indexOf(a, from || 0), j = BSL.indexOf(b, i); assert.ok(i > 0 && j > i, 'anchor ' + a); return BSL.slice(i, j); }
const check = (() => { const s = BSL.indexOf('(function patchRxHandoff() {');
  const C = { Number, Math, String, Array, SCH: 'bridge-super-reactions' }; vm.createContext(C);
  vm.runInContext(cut('  const TOKIP = {', '  const LBL = {', s) + cut('  function check(p) {', '  /* default SubLoads support', s) + '\nthis.check = check;', C); return C.check; })();
/* the made-up bridge: a new project (5 PCI BT-72 at 9 ft, overhangs 3 ft, AASHTO equal distribution) with a 6 ft left sidewalk, PL 75 psf,
   a utility on the noncomposite section 0.10 klf, a future utility allowance 0.05 klf and a utility on the composite section 0.06 klf */
function bridge(spans, cont, items) {
  const P = M.newProject(); P.project.name = 'Mill Road over Stony Brook (made up)';
  if (spans) { P.spans = { lengths: spans, continuity: cont ? 'composite' : 'simple' }; P.xs.skews = spans.map(() => 0).concat([0]); BR.syncSpans(P); }
  if (items !== false) { P.xs.dl.swL = { w: 6, t: 9 }; P.xs.dl.ped = 75;
    P.xs.dl.extra = [{ name: 'Gas main', cat: 'UTN', x: 16.5, plf: 0.10 }, { name: 'Future utility', cat: 'UF', x: 16.5, plf: 0.05 }, { name: 'Water main', cat: 'UT', x: 25, plf: 0.06 }]; }
  return P;
}

test('SRP: no pedestrian load and no utility: the payloads are as before (no "separate" anywhere)', () => {
  for (const P of [bridge(null, false, false), bridge([100, 100], true, false)]) {
    const cells = cellsOf(P), c = cells[0], a = H.srPayload(c.inp, c.R), b = W.bxSuperRxPayload(c.inp, c.R);
    assert.equal(JSON.stringify(a), JSON.stringify(b), 'one line = the engine\'s payload'); assert.equal(H.srParts(c.inp, c.R), null);
    const r = H.srAll(P, cells); assert.ok(r.ok, r.error); assert.ok(!/"separate"/.test(JSON.stringify(r.payload))); assert.ok(!/Separate items/.test(r.sum));
    assert.ok(!('utc' in c.inp) && !('pl' in c.inp) && !('ut' in c.inp));
    const k = check(r.payload); assert.ok(!k.err && !k.sep && !k.hasU);
  }
});

test('SRP: simple span 120 ft: the items by hand; the totals keep their meaning (DC1 contains UT + UF, DW contains UTc)', () => {
  const P = bridge(), P0 = bridge(null, false, false); P0.xs.dl.swL = { w: 6, t: 9 };   // the same bridge without the pedestrian load and the utilities
  const r = H.srAll(P, cellsOf(P)), r0 = H.srAll(P0, cellsOf(P0)); assert.ok(r.ok && r0.ok, r.error || r0.error);
  r.payload.supports.forEach((s, k) => s.girders.forEach((g, i) => { const g0 = r0.payload.supports[k].girders[i], q = g.separate;
    // AASHTO method: each added line load equally to the 5 girders: 0.10 / 5 = 0.02, 0.05 / 5 = 0.01, 0.06 / 5 = 0.012 klf; w L / 2, L = 120 ft
    assert.deepEqual(J(q), { PL: 4.05, PLmin: 0, UT: 1.2, UF: 0.6, UTc: 0.72 }, `${s.id} ${g.label}`);
    near(g.DC1 - g0.DC1, q.UT + q.UF, 1.1e-3, 'DC1 contains UT + UF'); near(g.DW - g0.DW, q.UTc, 1.1e-3, 'DW contains UTc'); assert.equal(g.DC2, g0.DC2);
    assert.deepEqual(Object.keys(g), ['label', 'position', 'DC1', 'DC2', 'DW', 'separate']); }));
  // PL: 75 psf on 6 − 1.5 = 4.5 ft walkable = 0.3375 klf, equally to 5 girders 0.0675 klf: 0.0675 (120) / 2 = 4.05 kip
  near(0.075 * 4.5 / 5 * 120 / 2, 4.05, 1e-12, 'PL by hand');
  const d = r.payload.separate; assert.equal(d.pedestrian.field, 'PL'); assert.equal(d.pedestrian.includedIn, null); assert.equal(d.pedestrian.imIncluded, false);
  assert.deepEqual(J(d.utilities.existing), { field: 'UT', includedIn: 'DC1', section: 'noncomposite (precast girder)', treatAs: 'DW', strMax: 1.5, strMin: 0.65, service: 1 });
  assert.deepEqual(J(d.utilities.future), { field: 'UF', includedIn: 'DC1', section: 'noncomposite (precast girder)', treatAs: 'DC', strMax: 1.25, strMin: 0, service: 1, serviceRelieving: 0 });
  assert.equal(d.utilities.composite.includedIn, 'DW'); assert.equal(r.payload.liveLoad, null); assert.equal(r.payload.schemaVersion, 1);
  assert.ok(r.payload.notes.some(n => /ALREADY INSIDE DC1/.test(n) && /in NO other field/.test(n))); assert.match(r.sum, /Separate items/);
  // only the items a bridge has: a pedestrian load alone
  const Pp = bridge(null, false, false); Pp.xs.dl.swL = { w: 6, t: 9 }; Pp.xs.dl.ped = 75; const rp = H.srAll(Pp, cellsOf(Pp));
  assert.deepEqual(J(rp.payload.supports[0].girders[0].separate), { PL: 4.05, PLmin: 0 }); assert.ok(!rp.payload.separate.utilities); assert.equal(rp.payload.supports[0].girders[0].DC1, r0.payload.supports[0].girders[0].DC1);
  // the one-line payload of the girder shown carries the same items
  const c = cellsOf(P).find(x => x.g === 2), one = H.srPayload(c.inp, c.R).payload;
  assert.deepEqual(J(one.supports[0].girders[0].separate), { PL: 4.05, PLmin: 0, UT: 1.2, UF: 0.6, UTc: 0.72 }); assert.ok(one.separate.pedestrian && one.liveLoad, 'the lane value stays');
  near(one.supports[0].girders[0].DC1, r.payload.supports[0].girders[1].DC1, 1e-9, 'the same DC1');
});

test('SRP: two continuous spans 100 + 100 ft: UT / UF on the simple span, UTc and PL on the continuous unit, summed at the pier', () => {
  const P = bridge([100, 100], true), r = H.srAll(P, cellsOf(P)); assert.ok(r.ok, r.error);
  const [a, pier, b] = r.payload.supports.map(s => s.girders[1].separate);
  // UT 0.02 klf, UF 0.01 klf: w L / 2 = 1.0, 0.5 at each end; the pier takes both spans: 2.0, 1.0
  assert.equal(a.UT, 1); assert.equal(a.UF, 0.5); assert.equal(pier.UT, 2); assert.equal(pier.UF, 1);
  // UTc 0.012 klf on two equal continuous spans: 0.375 w L = 0.45 at the abutment, 1.25 w L = 1.5 at the pier
  assert.equal(a.UTc, 0.45); assert.equal(pier.UTc, 1.5); assert.equal(b.UTc, 0.45);
  // PL 0.0675 klf: abutment max = the loaded span only, 7/16 w L = 2.953; min = the other span loaded, −1/16 w L = −0.422; pier 1.25 w L = 8.438
  near(a.PL, 0.0675 * 100 * 7 / 16, 2e-3, 'PL abutment'); near(a.PLmin, -0.0675 * 100 / 16, 2e-3, 'PLmin abutment'); near(pier.PL, 1.25 * 0.0675 * 100, 2e-3, 'PL pier'); near(pier.PLmin, 0, 2e-3, 'PLmin pier');
  assert.ok(r.payload.notes.some(n => /Pedestrian load at a pier/.test(n)));
});

test('SRP: imported demands: no PL and no UTc item (used as given), UT and UF still sent', () => {
  const P = bridge(); P.types.forEach(t => { DM.setSrc(P, t.id, 'table'); DM.setTable(P, t.id, [{ x: 0, V_DC2: 14, V_DW: 9, V_LLneg: -90 }, { x: 60, M_LLpos: 2400, M_DC2: 300, M_DW: 200 }, { x: 120, V_DC2: -14, V_DW: -9, V_LLpos: 90 }]); });
  const r = H.srAll(P, cellsOf(P)); assert.ok(r.ok, r.error); const g = r.payload.supports[0].girders[1];
  assert.deepEqual(J(g.separate), { UT: 1.2, UF: 0.6 }); assert.ok(!r.payload.separate.pedestrian && !r.payload.separate.utilities.composite);
  assert.ok(r.payload.notes.some(n => /imported demands does not get a PL item/.test(n))); assert.ok(r.payload.notes.some(n => /does not get a UTc item/.test(n)));
});

test('SRP: the receiver\'s reader: old payloads as before; new payloads without a double count; both forms refused', () => {
  const P = bridge(), P0 = bridge(null, false, false); P0.xs.dl.swL = { w: 6, t: 9 };
  const pn = H.srAll(P, cellsOf(P)).payload, po = H.srAll(P0, cellsOf(P0)).payload;
  // an old payload (no separate items): dc1, dc2, dw as sent, no utility keys
  const co = check(po); assert.ok(!co.err); assert.ok(!co.sep && !co.hasU);
  co.sups.forEach((s, k) => s.girders.forEach((g, i) => { const q = po.supports[k].girders[i]; assert.deepEqual(J(g), { label: q.label, position: q.position, dc1: q.DC1, dc2: q.DC2, dw: q.DW }); }));
  // the new payload with its separate items stripped is that same reading of its totals (an old receiver, or a receiver that ignores them)
  const stripped = J(pn); delete stripped.separate; stripped.supports.forEach(s => s.girders.forEach(g => { delete g.separate; }));
  const cs = check(stripped); cs.sups.forEach((s, k) => s.girders.forEach((g, i) => { assert.equal(g.dc1, pn.supports[k].girders[i].DC1); assert.equal(g.dw, pn.supports[k].girders[i].DW); assert.equal(g.ut, undefined); }));
  // the new payload: UT and UF out of DC1 into their own values; UTc stays in DW; PL for display
  const cn = check(pn); assert.ok(!cn.err, cn.err); assert.equal(cn.hasU, true); assert.deepEqual(J(cn.sep), { u: true, utc: true, pl: true });
  cn.sups.forEach((s, k) => s.girders.forEach((g, i) => { const q = pn.supports[k].girders[i];
    near(g.dc1, q.DC1 - 1.2 - 0.6, 1e-9, 'dc1 net'); assert.equal(g.ut, 1.2); assert.equal(g.uf, 0.6); near(g.dc1 + g.ut + g.uf, q.DC1, 1e-9, 'no double count: dc1 + ut + uf = the DC1 sent');
    assert.equal(g.dw, q.DW); assert.equal(g.utc, 0.72); assert.equal(g.dc2, q.DC2); assert.equal(g.pl, 4.05); assert.equal(g.plmin, 0);
    near(g.dc1, po.supports[k].girders[i].DC1, 1.1e-3, 'dc1 net = the DC1 of the bridge without utilities'); }));
  // the Steel Bridge app's form (UT, UF outside DC1) is read as before
  const st = J(po); st.supports.forEach(s => s.girders.forEach(g => { g.UT = 2; g.UF = 1; })); const ct = check(st);
  assert.ok(!ct.err && ct.hasU && !ct.sep); assert.equal(ct.sups[0].girders[0].dc1, po.supports[0].girders[0].DC1); assert.equal(ct.sups[0].girders[0].ut, 2);
  // both forms in one payload: refused; a bad number: refused
  const both = J(pn); both.supports[0].girders[0].UT = 1; assert.match(check(both).err, /both UT \/ UF values outside DC1 and "separate" items/);
  const bad = J(pn); bad.supports[0].girders[0].separate.PL = 'x'; assert.match(check(bad).err, /separate PL is not a valid number/);
  // kN payload: the items are converted with the totals
  const kn = J(pn); kn.units.force = 'kN'; const ck = check(kn); near(ck.sups[0].girders[0].ut, 1.2 * 0.2248089431, 1e-6, 'kN to kip');
});
