// apps/ps-bridge batch F (2026-11-15): the PS Bridge app's hand-offs to Bridge Substructure Loading in the Steel Bridge app's formats
// (engine/handoffs.js srAll, sgPayload; HANDOFF.md §4.4 "Optional fields" allGirders, §4.14 superGeometry).
//   1. srAll: the payload has the Steel Bridge app's shape (apps/steel-bridge/ui/handoffs.js srPayload, run here on a stand-in analysis
//      so its keys can be compared without the moving-load run): the same top-level keys (its optional ownerRules / utilities aside), the
//      same support and girder entry keys, allGirders:true, labels G1…Gn, liveLoad null.
//   2. srAll values: each line's reaction at each support = the end reactions of the girder type's engine run on that line (srPayload of
//      that cell, the Analysis tab's numbers), summed over the two spans at a pier; statics: Σ DW reactions = Σ_g w_DW,g × L (one span);
//      continuous (two spans) and simple (two spans) piers; the shares in the notes; a line with no type refuses the send.
//   3. sgPayload: the Steel Bridge app's sgPayload keys (+ section.material), the shared §4.14 check passes, hand values of the new project.
//   4. The receiver's reader (Bridge Substructure Loading.html, its own code cut at anchors): the reactions check accepts both payloads
//      and takes the PS payload by girder number (allGirders); the geometry check accepts it; a concrete section is recognised.
//   5. The old app's one-line payload (srPayload) is unchanged: no allGirders.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'handoff-store.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'demands', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'handoffs'].map(n => path.join(APP, `engine/${n}.js`)));
W.BridgeBeam = { get: () => null }; W.BridgeXfer = { sharedProject: () => null };
const M = W.PSBModel, D = W.PSBDesign, BR = W.PSBBridge, H = W.PSBHandoffs;
const J = v => JSON.parse(JSON.stringify(v));
const cellsOf = P => BR.results(P, inp => W.PSBHoldDown.compute(J(inp))).cells;
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);

// the Steel Bridge app's senders (its own code), the analysis replaced by a stand-in with the fields srPayload reads
const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const S = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'handoff-store.js', ...['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'ui/handoffs.js'].map(E));
S.SBDAnalysis = Object.assign({}, S.SBDAnalysis, { analyzeGirder: (Q) => { const L = Q.spans.lengths.map(Number), ns = L.length, sup = [0]; L.forEach(v => sup.push(sup[sup.length - 1] + v));
  const R = () => ({ R: sup.map(() => 10) });
  return { errors: [], spans: L.map(v => ({ L: v })), df: { spans: L.map(() => ({ gV: 0.8 })) }, loads: { steelAllowPct: 3, PL: 0 }, sup, st: { DC1: R(), DC2: R(), DW: R() }, Lt: sup[ns], cont: ns > 1, llR: null, pl: null }; } });
const steelSR = S.SBDHandoffs.srPayload(S.SBDModel.defaultProject());
const steelSG = S.SBDHandoffs.sgPayload(S.SBDModel.defaultProject());

// the receiver's own code (Bridge Substructure Loading.html), cut at its anchors and run in a context of its own
const BSL = fs.readFileSync(path.join(ROOT, 'Bridge Substructure Loading.html'), 'utf8');
function cut(a, b, from) { const i = BSL.indexOf(a, from || 0), j = BSL.indexOf(b, i); assert.ok(i > 0 && j > i, 'anchor ' + a); return { code: BSL.slice(i, j), i }; }
const RXC = (() => { const s = BSL.indexOf('(function patchRxHandoff() {');
  const k = cut("  const TOKIP = {", '  const LBL = {', s).code, c = cut('  function check(p) {', '  /* default SubLoads support', s).code;
  const C = { Number, Math, String, Array, SCH: 'bridge-super-reactions' }; vm.createContext(C); vm.runInContext(k + c + '\nthis.check = check;', C); return C.check; })();
const GEOC = (() => { const s = BSL.indexOf('(function patchGeoHandoff() {');
  const cc = cut('  const concrete = p =>', '\n', s).code, c = cut('  function check(p) {', '  function depthOf', s).code;
  const C = { HS: () => W.SharedHandoffStore, Math }; vm.createContext(C); vm.runInContext(cc + '\n' + c + '\nthis.check = check; this.concrete = concrete;', C); return C; })();
const byN = (p, c) => !!p.allGirders && c.labels.length > 1 && c.labels.every(l => /^G\d+$/.test(l));   // the receiver's pickSource rule (DLG.byN)
assert.ok(BSL.includes('DLG.byN = !!p.allGirders && c.labels.length > 1 && c.labels.every(l => /^G\\d+$/.test(l));'), 'receiver byN rule as copied above');

function project(spans, cont) { const P = M.newProject(); P.project.name = 'Route 9 over Mill Brook'; if (spans) { P.spans = { lengths: spans, continuity: cont ? 'composite' : 'simple' }; P.xs.skews = spans.map(() => 0).concat([0]); BR.syncSpans(P); } return P; }
const P1 = project(), P2c = project([100, 120], true), P2s = project([100, 120], false);

test('srAll: the Steel Bridge app\'s payload shape (allGirders), labels G1…Gn, the receiver reads it by girder number', () => {
  assert.ok(steelSR.ok, steelSR.error);
  const r = H.srAll(P1, cellsOf(P1)); assert.ok(r.ok, r.error); const p = r.payload, s = steelSR.payload;
  const opt = ['ownerRules', 'utilities'];
  assert.deepEqual(Object.keys(p).sort(), Object.keys(s).filter(k => !opt.includes(k)).sort());
  assert.deepEqual(Object.keys(p.supports[0]).sort(), Object.keys(s.supports[0]).sort());
  assert.deepEqual(Object.keys(p.supports[0].girders[0]).sort(), Object.keys(s.supports[0].girders[0]).filter(k => !['UT', 'UF'].includes(k)).sort());
  assert.equal(p.allGirders, true); assert.equal(p.liveLoad, null); assert.equal(p.factored, false); assert.equal(p.producer, 'PS-Beam'); assert.equal(p.producerFile, 'apps/ps-bridge/index.html');
  assert.deepEqual(J(p.supports.map(q => q.id)), ['Abut. 1', 'Abut. 2']); assert.deepEqual(J(p.supports[0].girders.map(g => g.label)), ['G1', 'G2', 'G3', 'G4', 'G5']);
  assert.deepEqual(J(p.supports[0].girders.map(g => g.position)), ['exterior', 'interior', 'interior', 'interior', 'exterior']);
  for (const q of [p, s]) { const c = RXC(J(q)); assert.ok(!c.err, c.err); assert.equal(byN(q, c), true); }
  assert.equal(GEOC.concrete({ section: { material: 'prestressed concrete' } }), true); assert.equal(GEOC.concrete(J(steelSG.payload)), false);
});

test('srAll values: each cell\'s own end reactions (the Analysis tab), statics, piers summed (continuous and simple), shares in the notes', () => {
  for (const [nm, P] of [['one span', P1], ['two spans continuous', P2c], ['two spans simple', P2s]]) {
    const cells = cellsOf(P), r = H.srAll(P, cells); assert.ok(r.ok, nm + ': ' + r.error);
    const ns = P.spans.lengths.length, nb = P.xs.nb;
    for (let g = 1; g <= nb; g++) for (let k = 0; k <= ns; k++) {
      const parts = [k > 0 && [k, 1], k < ns && [k + 1, 0]].filter(Boolean).map(([s, e]) => { const c = cells.find(x => x.s === s && x.g === g); return H.srPayload(c.inp, c.R).payload.supports[e].girders[0]; });
      const G = r.payload.supports[k].girders[g - 1];
      for (const f of ['DC1', 'DC2', 'DW']) near(G[f], parts.reduce((a, x) => a + x[f], 0), 1.5e-3, `${nm} G${g} support ${k} ${f}`);
    }
    if (ns === 1) {   // statics: Σ_g (R_left + R_right) of DW = Σ_g w_DW,g × L
      const L = P.spans.lengths[0], tot = r.payload.supports.reduce((a, q) => a + q.girders.reduce((b, x) => b + x.DW, 0), 0);
      near(tot, cells.reduce((a, c) => a + c.R.wDW * L, 0), 0.01, 'Σ DW');
    } else {
      assert.equal(r.payload.supports[1].id, 'Pier 1'); assert.ok(r.payload.notes.some(n => /^Pier 1 \(span 1 right end \+ span 2 left end\)/.test(n)), nm + ' shares');
      assert.equal(r.payload.notes.some(n => /split it between the back and ahead bearing rows/.test(n)), P.spans.continuity !== 'composite', nm + ' split note');
    }
  }
  // hand check (one span, G2 interior): DW at Abut. 1 = w_DW × L / 2
  const c = cellsOf(P1).find(x => x.g === 2), r = H.srAll(P1, cellsOf(P1));
  near(r.payload.supports[0].girders[1].DW, c.R.wDW * P1.spans.lengths[0] / 2, 1e-3, 'G2 DW = wL/2');
  // a line with no girder type: nothing is sent
  const Q = project(); const t = Q.types.find(x => x.lines.includes(3)); t.lines = t.lines.filter(g => g !== 3);
  assert.match(H.srAll(Q, cellsOf(Q)).error, /none on G3\/S1/);
  // the old app's one-line payload: unchanged (no allGirders)
  const c0 = cellsOf(P1)[0]; assert.equal(H.srPayload(c0.inp, c0.R).payload.allGirders, undefined);
});

test('sgPayload: the Steel Bridge app\'s superGeometry shape, the shared §4.14 check, the receiver\'s check, hand values', () => {
  assert.ok(steelSG.ok, steelSG.error);
  const r = H.sgPayload(P1, cellsOf(P1)); assert.ok(r.ok, r.error); const p = r.payload, s = steelSG.payload;
  assert.deepEqual(Object.keys(p).sort(), Object.keys(s).filter(k => k !== 'ownerRules').sort());
  for (const k of ['units', 'girders', 'deck', 'basis']) assert.deepEqual(Object.keys(p[k]).sort(), Object.keys(s[k]).sort(), k);
  assert.deepEqual(Object.keys(p.supports[0]).sort(), Object.keys(s.supports[0]).sort());
  assert.deepEqual(Object.keys(p.edges.L).sort(), Object.keys(s.edges.L).sort());
  assert.deepEqual(Object.keys(p.section).sort(), Object.keys(s.section).concat(['material']).sort());
  assert.ok(W.SharedHandoffStore.checkGeometry(p).ok); const c = GEOC.check(J(p)); assert.ok(c.ok, c.errors.join('; '));
  assert.equal(p.contentHash, W.SharedHandoffStore.geometryHash(p));
  // hand values: the new project (PCI BT-72: h 72, btf 42, bbf 26, bw 6, d1 3.5, d3 6 in), its inputs
  const b = P1.base, xs = P1.xs;
  assert.deepEqual(J(p.spans), J(P1.spans.lengths)); assert.equal(p.continuity, 'simple');
  assert.equal(b.girder, 'PCI BT-72'); assert.deepEqual(J([p.section.depth, p.section.bf, p.section.tf, p.section.tw]), [72, 42, 6, 6]);
  assert.deepEqual(J(p.section.atSupports), [72, 72]); assert.equal(p.section.material, 'prestressed concrete');
  assert.deepEqual(J(p.girders), J({ count: xs.nb, spacings: xs.bays, ohL: xs.ohL, ohR: xs.ohR }));
  assert.deepEqual(J([p.deck.ts, p.deck.haunch]), [b.ts, b.th]);
  assert.equal(p.edges.L.width, W.PSBBridgeDL.edgeFace(P1, 'L').f); assert.equal(p.edges.L.type, 'barrier');
  // two spans made continuous: one joint 'continuous', simple: 'joint'
  assert.deepEqual(J(H.sgPayload(P2c, cellsOf(P2c)).payload.supports.map(q => q.joint)), ['end', 'continuous', 'end']);
  assert.deepEqual(J(H.sgPayload(P2s, cellsOf(P2s)).payload.supports.map(q => q.joint)), ['end', 'joint', 'end']);
  // secDims of a box and a voided slab (the rules stated in engine/handoffs.js)
  assert.equal(H.secDims({ isBox: true, h: 27, btf: 36, bbf: 36, bw: 10, box: { wall: 5, voidH: 20 } }).tf, 5);
  assert.equal(H.secDims({ isBox: true, h: 12, btf: 36, bbf: 36, bw: 10, box: { wall: 5, voidH: 5 } }).tf, 5);
  assert.equal(H.secDims({ isDeck: true, h: 21, btf: 48, bbf: 48, bw: 48, box: { voids: 4, voidD: 12 } }).tf, 4.5);
  // refusals: no deck edges
  const Q = project(); delete Q.xs.dl; assert.match(H.sgPayload(Q, cellsOf(Q)).error, /deck edges/);
});
