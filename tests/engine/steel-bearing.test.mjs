// BRG-HO PR 2 (2026-11-24): the Steel Bridge app -> the Elastomeric Bearing Design Module (bearingLoads, HANDOFF.md §4.17), and the Steel
// Bridge app's superReactions in line with the PS Bridge app's #1683 (SRP): the pedestrian reaction as the optional separate { PL, PLmin }.
//   1. superReactions: a project without a pedestrian load has no "separate" (the payload is as before: the runs moved to runLines unchanged,
//      checked against origin/main's file by hand in the PR); with one: separate { PL, PLmin } = the analysis' pedestrian reactions R.pl.R, UT /
//      UF stay top-level (outside DC1), DC1 / DC2 / DW unchanged, the descriptor.
//   2. Bridge Substructure Loading's own reader (check(), cut from its file): the Steel form (top-level UT / UF) with separate.PL is read
//      (DC1 as sent, UT / UF as sent, PL for display: no factored value changes); UT / UF in both forms is still refused.
//   3. blPayload, continuous (the default bridge, with a sidewalk and utilities): one line per support; DC1 = R.DC1 + UT + UF (separate.UT /
//      UF inside DC1), LL maxIM / minIM = R.llR, max null; the service sums; the shared check.
//   4. blPayload, two simple spans: a back and an ahead line at the pier, each the span's end shear; back + ahead = the Analysis reaction.
//   5. The stale record: bearingLoads is an outgoing channel with the inputs hash (rxSig).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'handoff-store.js', 'handoff-stale.js', 'bearing-loads.js', ...['engine/model.js', 'engine/sections.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/hostale.js', 'ui/handoffs.js'].map(E));
const M = W.SBDModel, H = W.SBDHandoffs, AN = W.SBDAnalysis, SB = W.SharedBearingLoads;
const J = v => JSON.parse(JSON.stringify(v));
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= t, `${m}: ${a} vs ${b}`);
const BSL = fs.readFileSync(path.join(ROOT, 'Bridge Substructure Loading.html'), 'utf8');
function cut(a, b, from) { const i = BSL.indexOf(a, from || 0), j = BSL.indexOf(b, i); assert.ok(i > 0 && j > i, 'anchor ' + a); return BSL.slice(i, j); }
const check = (() => { const s = BSL.indexOf('(function patchRxHandoff() {');
  const C = { Number, Math, String, Array, SCH: 'bridge-super-reactions' }; vm.createContext(C);
  vm.runInContext(cut('  const TOKIP = {', '  const LBL = {', s) + cut('  function check(p) {', '  /* default SubLoads support', s) + '\nthis.check = check;', C); return C.check; })();
const withItems = () => { const P = M.defaultProject(); P.project.name = 'Elm Street (made up)'; P.xs.sidewalks.L = { w: 6, t: 8, fence: null, fenceX: null }; P.xs.sidewalks.ped = 75;
  P.xs.extra = [{ name: 'Utility A', cat: 'UT', x: 17.5, plf: 0.3, dist: 'two' }, { name: 'Future', cat: 'UF', x: 27, plf: 0.25, dist: 'auto' }]; return P; };
let C1 = null; const cont = () => { if (!C1) { const P = withItems(), RL = H.runLines(P); C1 = { P, RL, sr: H.srPayload(P), bl: H.blPayload(P) }; } return C1; };

test('superReactions: no pedestrian load: no "separate"; with one: separate { PL, PLmin } = R.pl.R, UT / UF top-level, the totals unchanged', () => {
  const P0 = M.defaultProject(), r0 = H.srPayload(P0); assert.ok(r0.ok, r0.error); assert.ok(!/"separate"/.test(JSON.stringify(r0.payload)));
  const { RL, sr } = cont(); assert.ok(sr.ok, sr.error); const p = sr.payload;
  p.supports.forEach((s, k) => s.girders.forEach((g, i) => { const R = RL.Rs[i];
    assert.deepEqual(J(g.separate), { PL: Math.round(R.pl.R[k].max * 1000) / 1000, PLmin: Math.round(R.pl.R[k].min * 1000) / 1000 }, `${s.id} ${g.label}`);
    near(g.DC1, R.st.DC1.R[k], 1e-3, 'DC1 without the utilities, as before'); }));
  assert.ok(p.supports.some(s => s.girders.some(g => g.UT != null)) && p.supports.some(s => s.girders.some(g => g.UF != null)), 'UT / UF top-level');
  assert.equal(p.separate.pedestrian.includedIn, null); assert.equal(p.separate.pedestrian.field, 'PL'); assert.ok(!p.separate.utilities);
  assert.ok(p.notes.some(n => /separate \{ PL, PLmin \}/.test(n)));
});

test('Substructure Loading reader: the Steel form with separate.PL is read (PL shown only); both utility forms still refused', () => {
  const p = cont().sr.payload, c = check(p); assert.ok(!c.err, c.err); assert.ok(c.hasU); assert.deepEqual(J(c.sep), { pl: true });
  c.sups.forEach((s, k) => s.girders.forEach((g, i) => { const q = p.supports[k].girders[i];
    assert.equal(g.dc1, q.DC1, 'DC1 as sent'); assert.equal(g.dc2, q.DC2); assert.equal(g.dw, q.DW); assert.equal(g.ut, q.UT); assert.equal(g.uf, q.UF); assert.equal(g.pl, q.separate.PL); }));
  // without the separate items the reading is the old one (the factored results of a Steel hand-off do not change: PL is shown only)
  const old = J(p); delete old.separate; old.supports.forEach(s => s.girders.forEach(g => { delete g.separate; }));
  const co = check(old); co.sups.forEach((s, k) => s.girders.forEach((g, i) => { const n = c.sups[k].girders[i]; ['dc1', 'dc2', 'dw', 'ut', 'uf'].forEach(f => assert.equal(g[f], n[f], f)); }));
  const both = J(p); both.supports[0].girders[0].UT = 1; both.supports[0].girders[0].separate.UT = 1; assert.match(check(both).err, /both UT \/ UF values outside DC1/);
});

test('bearingLoads, continuous girders: one line per support; DC1 with UT + UF; LL with IM = R.llR; service sums; the shared check', () => {
  const { RL, bl } = cont(); assert.ok(bl.ok, bl.error); const p = bl.payload, R0 = RL.Rs[0], ns = R0.spans.length;
  assert.equal(p._schema, 'bridge-bearing-loads'); assert.equal(p.producer, 'Steel Bridge Design'); assert.equal(p.lines.length, ns + 1);
  assert.deepEqual(J(p.lines.map(l => [l.support, l.side])), [['Abut. 1', 'ahead']].concat([...Array(ns - 1)].map((_, k) => [`Pier ${k + 1}`, 'both']), [['Abut. 2', 'back']]));
  p.lines.forEach((l, k) => l.girders.forEach((g, i) => { const R = RL.Rs[i], S = R.st, ut = R.loads.UT > 0 ? S.UT.R[k] : 0, uf = R.loads.UF > 0 ? S.UF.R[k] : 0;
    near(g.DC1, S.DC1.R[k] + ut + uf, 2e-3, 'DC1 + UT + UF'); near(g.DC2, S.DC2.R[k], 1e-3, 'DC2'); near(g.DW, S.DW.R[k], 1e-3, 'DW');
    near(g.LL.maxIM, R.llR[k].max, 1e-3, 'LL+IM'); near(g.LL.minIM, R.llR[k].min, 1e-3, 'LL+IM min'); assert.equal(g.LL.max, null);
    near(g.separate.PL, R.pl.R[k].max, 1e-3, 'PL');
    near(g.service.Pdl, g.DC1 + g.DC2 + g.DW, 1e-3, 'Pdl'); assert.equal(g.service.Pll, null); near(g.service.PllIM, g.LL.maxIM + g.separate.PL, 1e-3, 'PllIM');
    near(g.service.Pmin, g.DC1 + g.DC2 - (g.separate.UT || 0) - (g.separate.UF || 0), 1e-3, 'Pmin'); }));
  assert.equal(p.separate.utilities.existing.includedIn, 'DC1'); assert.equal(p.separate.utilities.future.includedIn, 'DC1');
  assert.equal(p.movement.material, 'steel'); assert.equal(p.movement.units.length, 1); assert.equal(p.movement.fixity, null);
  assert.deepEqual(J(SB.check(p)), { ok: true, warnings: [] });
  // the receiver's plan: no LL without IM sent: P_LL only with IM
  const a = SB.plan(p, 1, {}), b = SB.plan(p, 1, { im: true }); assert.equal(a.design.Pll, null); assert.match(a.warnings[0], /P_LL is not filled/); assert.equal(b.design.Pll, b.design.ll + b.design.PL);
});

test('bearingLoads, two simple spans: back and ahead lines at the pier, each the span\'s end shear; back + ahead = the reaction', () => {
  const P = M.defaultProject(); P.spans.continuity = 'simple'; P.spans.lengths = [80, 100]; P.xs.skews = [0, 0, 0];
  const RL = H.runLines(P), r = H.blPayload(P); assert.ok(r.ok, r.error); const p = r.payload;
  assert.deepEqual(J(p.lines.map(l => `${l.support} ${l.side} ${l.span} ${l.end}`)), ['Abut. 1 ahead 1 left', 'Pier 1 back 1 right', 'Pier 1 ahead 2 left', 'Abut. 2 back 2 right']);
  RL.Rs.forEach((R, i) => ['DC1', 'DC2', 'DW'].forEach(f => {
    near(p.lines[1].girders[i][f] + p.lines[2].girders[i][f], R.st[f].R[1], 2e-3, `G${i + 1} ${f}: back + ahead = R`);
    near(p.lines[0].girders[i][f], R.st[f].R[0], 1e-3, `G${i + 1} ${f} abutment`); near(p.lines[3].girders[i][f], R.st[f].R[2], 1e-3, `G${i + 1} ${f} abutment 2`); }));
  const R = RL.Rs[1], x = R.st.DC1.x, i80 = x.findIndex(v => Math.abs(v - 80) < 1e-6), gV = R.df.spans[0].gV;
  near(p.lines[1].girders[1].LL.maxIM, -gV * R.ll.perLane.VLmin[i80], 1e-3, 'back LL+IM = −g_V V_L,min'); near(p.lines[2].girders[1].LL.maxIM, R.df.spans[1].gV * R.ll.perLane.VRmax[i80], 1e-3, 'ahead');
  assert.equal(p.movement.units.length, 2); assert.ok(SB.check(p).ok);
});

test('the stale record: bearingLoads is an outgoing channel, signed by the inputs hash (rxSig)', () => {
  const S = W.SBDHoStale; assert.ok(S.OUT_IDS.includes('bearingLoads')); assert.equal(S.CH.bearingLoads.ch, 'bearingLoads');
  const P = M.defaultProject(); M.setRec(P, {}); W.SharedHandoffStale.setSent(P, 'bearingLoads', { sig: S.rxSig(P), at: 'x' });
  const it = S.items(H, M, P, () => '', false).find(q => q.id === 'bearingLoads'); assert.equal(it.state, 'current');
  P.spans.lengths[0] += 1; assert.equal(S.items(H, M, P, () => '', false).find(q => q.id === 'bearingLoads').state, 'stale');
});
