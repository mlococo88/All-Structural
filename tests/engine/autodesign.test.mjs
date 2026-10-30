// apps/steel-bridge/engine/autodesign.js (window.SBDAutoDesign): Auto design.
//   1. Hand checks (arithmetic in the comments): weight and cost of a layout, the 6.10.2 proportion limits, the splice bolt-fit width
//      (AASHTO and CTDOT's 2 in edge distance: the DT10 design note), the depth rule.
//   2. The layout round trip: segmentsOf(layoutOf(P)) = P's plate segments.
//   3. The payload of the full check = the Fatigue & studs tab's own (ui/fatigue.js fromAnalysis): the tab's results built both ways agree.
//   4. Every candidate Auto design returns passes every module on the full check: a run (Refine, CTDOT, where every built-in splice fails
//      DT10 at the current 16 in flanges), then each candidate re-checked from scratch: evaluate(level 'full') in a fresh cache and the
//      tabs' own builders (Fatigue & studs with its own analysis, Cross-frames, Field splices); and the bolt-fit rule held at every splice.
//   5. Apply and one-step Undo.
// The parity against the legacy helpers (Suggest / Full design, ST-Girder's Optimize) on the 20 recorded projects is
// tests/engine/autodesign-parity.mjs (minutes per project; its recorded summary is checked here: every row present, see 6).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT, plain } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
export function adWindow() {
  return loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
    'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js',
    'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'engine/autodesign.js'].map(E));
}
const W = adWindow(), AD = W.SBDAutoDesign, M = W.SBDModel;
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);

test('Hand checks: weight, cost, proportion limits, bolt-fit width, depth rule', () => {
  // one field piece 100 ft, D = 60, t_w = 1/2, flanges 16 × 1 top and 18 × 1.5 bottom, 5 girders
  const L = { nb: 5, D: 60, spl: [], web: [{ x0: 0, x1: 100, tw: 0.5 }], top: [{ x0: 0, x1: 100, b: 16, t: 1 }], bot: [{ x0: 0, x1: 100, b: 18, t: 1.5 }], minLines: null };
  // A = 16(1) + 18(1.5) + 60(0.5) = 16 + 27 + 30 = 73 in²; W_line = 73 × 490/144 × 100 = 73 × 3.40278 × 100 = 24,840.3 lb; W = 5 × 24,840.3 = 124,201.4 lb
  near(AD.lineWeight(L), 73 * 490 / 144 * 100, 1e-9, 'W_line'); near(AD.lineWeight(L), 24840.28, 0.01, 'W_line hand');
  const P = M.defaultProject(); P.spans = { lengths: [100], continuity: 'simple' };
  const S = AD.settings(P), c = AD.costOf(L, S, 4);
  // C = 3.00(124,201.4) + 5(1500(0) + 6000(0) + 150(4)) = 372,604.2 + 3,000 = 375,604.2 $
  near(c.w, 124201.39, 0.01, 'W'); near(c.total, 3 * 124201.3889 + 5 * 150 * 4, 0.01, 'cost'); near(c.total, 375604.17, 0.01, 'cost hand');
  // proportions: D/t_w = 120 ≤ 150 (0.800); b/2t top = 8.0 ≤ 12 (0.667), bottom 6.0 (0.500); D/6 = 10 ≤ 16 (0.625); 1.1 t_w = 0.55 ≤ 1 (0.55);
  // I_yc/I_yt = (1)(16³)/12 / ((1.5)(18³)/12) = 341.33 / 729.0 = 0.4682 (in 0.1 … 10); depth rule (simple span) 0.033(100)(12) = 39.6 ≤ 60 + 2.5 = 62.5 (0.634)
  const pr = AD.proportions(L, P, S), r = id => pr.items.find(q => q.id === id).r;
  near(r('w1'), 0.8, 1e-12, 'D/tw'); near(r('bt1'), 8 / 12, 1e-12, 'bf/2tf top'); near(r('bb1'), 0.5, 1e-12, 'bf/2tf bot'); near(r('dt1'), 10 / 16, 1e-12, 'D/6');
  near(r('tt1'), 0.55, 1e-12, '1.1tw'); near(r('i1'), Math.max(0.1 / (341.333 / 729), (341.333 / 729) / 10), 1e-4, 'Iyc/Iyt'); near(r('depth'), 39.6 / 62.5, 1e-12, 'depth'); assert.ok(pr.ok);
  // bolt fit (engine/splices.js needB, DT10): 7/8 in bolts, cut edges (e_min 1.125 in), t_w = 0.5625, web splice plate 1/2 in, c_w 1/2 in, C_1 1.5 in, g = 3 in
  //   AASHTO: g0 = ceil¼(max(0.28125 + 0.5 + 0.5 + 1.125, 0.28125 + 0.5 + 1.5)) = ceil¼(2.40625) = 2.5; 2 lines: 2(2.5 + 3 + 1.125) = 13.25 in
  //   CTDOT (V2 6.13.6.1 edge 2 in): g0 = ceil¼(max(3.28125, 2.28125)) = 3.5; 2 lines: 2(3.5 + 3 + 2) = 17.0 in > 16 in (the DT10 note); 1 line: 2(3.5 + 2) = 11.0 in
  near(AD.boltFitWidth(P, 0.5625, 2), 13.25, 1e-12, 'AASHTO 2 lines');
  P.ownerRules.owner = 'CTDOT'; near(AD.boltFitWidth(P, 0.5625, 2), 17.0, 1e-12, 'CTDOT 2 lines'); near(AD.boltFitWidth(P, 0.5625, 1), 11.0, 1e-12, 'CTDOT 1 line');
  // CTDOT plate rules (OWN14): t_w ≥ 3/8, D in 2 in, b_f in 2 in
  const Sc = AD.settings(P); assert.equal(Sc.lim.twMin, 0.375); assert.equal(Sc.lim.Dinc, 2); assert.equal(Sc.lim.bfInc, 2);
});

test('Layout round trip: segmentsOf(layoutOf(P)) = the project plates', () => {
  const P = M.defaultProject(), L = AD.layoutOf(P), segs = AD.segmentsOf(L);
  // the built-in plates change at 88, 128, 232, 272 ft; the splices (82, 145, 215, 278) do not change a plate
  assert.deepEqual(plain(segs), plain(P.girders[0].segments));
  assert.deepEqual(plain(AD.projectWith(P, L).girders[0].segments), plain(P.girders[0].segments));
});

test('The full check uses the Fatigue & studs tab\'s own payload (ui/fatigue.js fromAnalysis): same results both ways', () => {
  const P = M.defaultProject(), AR = W.SBDAnalysis.analyzeGirder(P, 0), pl = AD.payloadOf(P, 0, AR);
  const a = W.SBDFatigueUI.build({ P, g: 0 }), b = W.SBDFatigueUI.build({ P, g: 0, pl });
  const pick = R => plain({ fc: R.FC.map(c => c.items.map(i => [i.r, i.st])), sc: R.SCC.map(c => c.items.map(i => [i.r, i.st])), g17: R.gs17.map(q => q.o.items.map(i => i.r)) });
  assert.deepEqual(pick(b), pick(a));
});

function runAD(P, settings) { const it = AD.run(P, { settings, maxIt: 5, trimTries: 2 }); let s; while (!(s = it.next()).done); return s.value; }
function boltFitHeld(c, Q) {   // each flange next to a splice at least the bolt-fit width of its gage lines (DT10)
  const nl = c.minLines || 2;
  const zat = (l, x) => l.find(q => x >= q.x0 - 1e-9 && x < q.x1 - 1e-9);
  c.L.spl.forEach(x => [x - 0.01, x + 0.01].forEach(xx => ['top', 'bot'].forEach(f => { const z = zat(c.L[f], xx), tw = Math.max(zat(c.L.web, x - 0.01).tw, zat(c.L.web, x + 0.01).tw);
    assert.ok(z.b >= AD.boltFitWidth(Q, tw, nl) - 1e-9, `${f} flange at ${xx} ft: ${z.b} in < ${AD.boltFitWidth(Q, tw, nl)} in`); })));
}
test('Every candidate passes every module on the full check (Refine, the built-in project)', () => {
  const P = M.defaultProject(), R = runAD(P, { mode: 'refine', topN: 2 });
  assert.ok(R.cands.length >= 1, `no candidate: ${R.note} ${JSON.stringify(R.rejected.map(r => r.fails))}`);
  for (const c of R.cands) {
    const Q = AD.projectWith(P, c.L), E2 = AD.evaluate(Q, { level: 'full', ctx: {} });
    assert.ok(E2.pass, `candidate fails: ${JSON.stringify(E2.fails.slice(0, 3))}`);
    assert.ok(AD.proportions(c.L, Q, AD.settings(Q)).ok, '6.10.2');
    for (let g = 0; g < Q.girders.length; g++) {   // the tabs' own builders, each with its own analysis
      const F = W.SBDFatigueUI.build({ P: Q, g }); assert.ok(!F.err && F.FC.every(k => k.status !== 'fail') && F.SCC.every(k => k.status !== 'fail') && F.gs17.every(q => q.o.items.every(i => i.st !== 'fail')), 'Fatigue & studs tab');
      const X = W.SBDFramingUI.build({ P: Q, g }); assert.ok(!X.err && X.C.every(k => k.status !== 'fail'), 'Cross-frames tab');
      const AR = W.SBDAnalysis.analyzeGirder(Q, g), SPg = W.SBDSplices.girder(Q, g, AR, { env: W.SBDSplicesUI.envOf(Q) });
      assert.ok(SPg.list.length === 4 && SPg.list.every(q => q.CK && q.CK.every(k => k.status !== 'fail')), 'Field splices tab');
    }
    boltFitHeld(c, Q);
  }
});
test('CTDOT: the splice bolt fit (DT10) is a sizing constraint; details that fail whatever the plates are reported as blockers', () => {
  // CTDOT BRSDM V2 6.13.6.1: 2 in edges; the built-in 16 in flanges fail DT10 at every splice (SB2-SP7). Auto design widens the flanges at the
  // splices to 17 in (hand check above; 18 in on the 2 in increment) or uses one gage line. The built-in splices also fail CTDOT's end distance
  // (DT4: e_f, e_p 1.75 in < 2 in, inputs the plates do not change): every design is "blocked" by it, never listed as passing.
  const P = M.defaultProject(); P.ownerRules.owner = 'CTDOT';
  const R = runAD(P, { mode: 'refine', topN: 1 });
  assert.equal(R.cands.length, 0); assert.ok(R.blocked.length >= 1, R.note);
  // the narrow flanges show in the splice module as DT3 (inner plate edge, web side) and DT7 (web splice plates) on the current design
  // (engine/splices.js autoDesign leaves the splice unchanged with the GD62 note: 17 in needed, 18 in on CTDOT's 2 in width increment)
  const cur = new Set(R.current.full.fails.map(f => `${f.mod} ${f.id}`));
  assert.ok(cur.has('splices DT3') && cur.has('splices DT7'), `the current design fails the bolt fit (SB2-SP7): ${[...cur]}`);
  for (const b of R.blocked) { assert.ok(b.blockers.every(k => cur.has(k)), 'blockers fail in the current design too');
    ['splices DT3', 'splices DT7', 'splices DT10'].forEach(k => assert.ok(!b.blockers.includes(k), `${k} is not a blocker: Auto design sized the flanges for the splice bolts`));
    boltFitHeld(b, AD.projectWith(P, b.L)); }
  assert.ok(/DT4/.test(R.note), R.note);
});

test('Apply writes the candidate; Undo restores the design before it', () => {
  const P = M.defaultProject(), L = AD.layoutOf(P); L.bot = L.bot.map(z => ({ ...z, t: z.t + 0.125 })); L.nb = 6;
  const c = { L, cost: AD.costOf(L, AD.settings(P), 0) }, r = AD.apply(P, c);
  assert.equal(r.project.xs.nb, 6); near(r.project.xs.bays[0], 38 / 5, 1e-9, 'equal bays'); near(r.project.girders[0].beff, 12 * 38 / 5, 1e-9, 'interior b_eff = S');
  assert.deepEqual(plain(r.project.girders[0].segments.map(s => s.botT)), plain(P.girders[0].segments.map(s => s.botT + 0.125)));
  const U = AD.undo(r.project); assert.deepEqual(plain(U.girders), plain(P.girders)); assert.deepEqual(plain(U.xs), plain(P.xs)); assert.ok(!U.autodesign.undo);
});

test('Parity summary (tests/projects/sbd2-autodesign/parity.json, written by autodesign-parity.mjs): every recorded project, each difference explained', () => {
  const f = path.join(ROOT, 'tests/projects/sbd2-autodesign/parity.json');
  if (!fs.existsSync(f)) { console.log('       (no parity summary yet: node tests/engine/autodesign-parity.mjs)'); return; }
  const J = JSON.parse(fs.readFileSync(f, 'utf8'));
  assert.equal(J.rows.length, 21, 'the 20 recorded projects and the built-in project');
  J.rows.forEach(r => { assert.ok(r.ad && (r.ad.pass || (r.ad.blocked && r.why.length)), `${r.name}: Auto design candidate passes every module (or is blocked by detail checks, explained)`); if (!(r.ad.w <= r.legacyW + 1e-6)) assert.ok(r.why && r.why.length, `${r.name}: heavier than the legacy design without a reason`); });
});
