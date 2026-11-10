// Field splice locations as an Auto design variable (2026-11-02, engineer request): engine/splplace.js (window.SBDSplicePlace) and its use
// in engine/autodesign.js (the variable 'spl': Lock / Range / Auto).
//   1. Saved data: a project saved before (no vars.spl, no splRules) reads the variable as Lock, round-trips unchanged, and its Auto design
//      result is identical to the one origin/main gave (tests/projects/sbd2-autodesign/splvar_lock_ref.json, recorded with main's code at
//      69a382b by the same quick run: New design with N_b, overhang locked and D 66–70 in, and Refine; screen only). Re-recorded
//      2026-11-10 (SBCON: Constructibility C_b / γ_e from the M_DCc the check uses): the New design candidates change (the default project's
//      false Constructibility 0.758 at x = 77 no longer drives the plates; best candidate 446,421 → 424,888 lb, governing GS7 x = 110.01
//      0.957 → GS9 x = 249.99 0.934); the Refine result is unchanged.
//   2. Hand check of the placement rule on the built-in 110-140-110 ft unit: the permanent-load points of contraflexure (interpolated) and
//      the stations (rounded to the foot); the rule's other branches on hand-made inputs (simple spans: odd equal pieces and MassDOT's
//      quarter points; the shipping weight split; the minimum distance from a support; merging; symmetry).
//   3. The rules check (piece length and weight, bearing, cross-frame and transition distances) with hand numbers.
//   4. Range (counts per span, station windows, a span locked) and Auto (the rule's layout, the current stations, the fewest).
//   5. An Auto run (full check): every candidate is on a layout that meets the rules, passes every module re-checked from scratch, and Apply
//      writes its stations to framing.splices, which the Field splices tab, the drawings and the framing read.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT, plain } from './harness.mjs';

// the Auto design window (as autodesign.test.mjs adWindow; not imported from there, which would register its tests a second time)
const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js',
  'engine/rating.js', 'engine/welds.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js', 'ui/welds.js', 'engine/splplace.js', 'engine/autodesign.js'].map(E)), AD = W.SBDAutoDesign, M = W.SBDModel, SP = W.SBDSplicePlace, J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const ctx = { ll: new Map() };

test('Saved data: an old project reads the splice variable as Lock; export / import unchanged; the Lock result equals origin/main\'s', () => {
  const P = M.defaultProject(); P.autodesign = { mode: 'new', objective: 'weight', vars: { tb: { mode: 'range', min: 1, max: 2 } } };   // as saved before (no spl, no splRules)
  const txt = M.exportJSON(P), R = M.importJSON(txt); assert.ok(R.ok, R.error); assert.equal(M.exportJSON(R.project), txt);
  const S = AD.settings(R.project); assert.equal(S.V.spl.mode, 'lock'); assert.equal(S.V.spl.forced, '');
  // the defaults of the rules (AASHTO: no owner limit)
  assert.equal(JSON.stringify([S.splR.shipLen, S.splR.shipWt, S.splR.minLen, S.splR.minSup, S.splR.minXf, S.splR.minTr]), JSON.stringify([120, 90, 30, 10, 2, 10]));   // minimum piece 30 ft (engineer decision 2026-11-02; was 10 ft)
  // Refine / Check: Lock whatever is saved
  const Q = J(P); Q.autodesign = { mode: 'refine', vars: { spl: { mode: 'auto' } } }; assert.equal(AD.settings(Q).V.spl.mode, 'lock');
  Q.autodesign.mode = 'check'; assert.equal(AD.settings(Q).V.spl.mode, 'lock');
  Q.autodesign = { mode: 'new', vars: { spl: { mode: 'range', min: 0, max: 2, win: '70-90' }, 'spl#2': { mode: 'lock' } } }; const S2 = AD.settings(Q);
  assert.equal(JSON.stringify([S2.V.spl.mode, S2.V.spl.min, S2.V.spl.max, S2.V.spl.win, S2.V['spl#2'].mode]), JSON.stringify(['range', 0, 2, '70-90', 'lock']));
  // the Lock result: the same quick runs as main's record, byte for byte
  const dig = R => ({ cands: R.cands.map(c => ({ L: c.L, w: c.cost.w, cost: c.cost.total, ratio: c.ratio, gov: c.gov && [c.gov.mod, c.gov.id, c.gov.x] })), screened: R.screened.map(o => ({ nb: o.nb, D: o.D, minLines: o.minLines, pass: o.pass, w: o.w, cost: o.cost, ratio: o.ratio })), note: R.note });
  const out = {};
  for (const [k, set] of [['new', { mode: 'new', topN: 2, vars: { nb: { mode: 'lock' }, oh: { mode: 'lock' }, D: { mode: 'range', min: 66, max: 70, step: 4 } } }], ['refine', { mode: 'refine', topN: 1 }]]) {
    const it = AD.run(M.defaultProject(), { settings: set, maxIt: 4, trimTries: 0, fullChecks: false, details: false }); let s; while (!(s = it.next()).done); out[k] = dig(s.value); }
  const ref = fs.readFileSync(path.join(ROOT, 'tests/projects/sbd2-autodesign/splvar_lock_ref.json'), 'utf8');
  assert.equal(JSON.stringify(out), ref, 'Lock: the Auto design result differs from origin/main\'s');
});

test('Hand check: the placement rule on the built-in 3-span unit (contraflexure of M_DC1 + M_DC2 + M_DW)', () => {
  const P = M.defaultProject(), S = AD.settings(P), L0 = AD.layoutOf(P); ctx.L0 = L0;
  const R = W.SBDAnalysis.analyzeGirder(P, 0), cf = SP.contraflexure(R), st = R.st;
  // Pier 1 back span: M(77) = 41.919 + 15.981 + 13.236 = 71.137, M(78) = −12.832 + 6.418 + 5.316 = −1.098 kip-ft (DC1 + DC2 + DW):
  //   x = 77 + (78 − 77)(71.137)/(71.137 + 1.098) = 77.985 → 78 ft
  // Pier 1 ahead span: M(143) = −21.882 + 10.429 + 8.638 = −2.815, M(144) = 29.772 + 19.573 + 16.212 = 65.557:
  //   x = 143 + 2.815/(2.815 + 65.557) = 143.041 → 143 ft; by symmetry 216.96 → 217 ft, 282.02 → 282 ft
  // (M_DC1 alone: 77 + 41.919/(41.919 + 12.832) = 77.766 and 143 + 21.882/(21.882 + 29.772) = 143.424: the same stations once rounded)
  assert.equal(JSON.stringify(cf.pts.map(c => [c.pier, c.side, c.xr])), JSON.stringify([[1, 'L', 78], [1, 'R', 143], [2, 'L', 217], [2, 'R', 282]]));
  near(cf.pts[0].x, 77 + 71.14 / (71.14 + 1.10), 2e-3, 'x_cf pier 1 back'); near(cf.pts[1].x, 143 + 2.82 / (2.82 + 65.56), 2e-3, 'x_cf pier 1 ahead');
  const X = R.x, i77 = X.indexOf(77), i78 = X.indexOf(78), dc1 = i => st.DC1.M[i];
  near(77 + dc1(i77) / (dc1(i77) - dc1(i78)), 77.766, 1e-3, 'M_DC1 alone');
  // the rule: pieces 78, 65, 74, 65, 78 ft ≤ 120 ft (no split); 32 and 33 ft from the piers ≥ 10 ft (none moved); symmetric
  const ref = SP.reference(P, cf, S.splR, AD.segmentsOf(L0), P.xs.allow);
  assert.equal(JSON.stringify(ref.spl), '[78,143,217,282]'); assert.equal(ref.notes.length, 0);
  const steps = SP.placeSteps(P, cf, ref, S.splR, 'G1'); assert.ok(steps.some(s => s.id === 'splp.cf0' && /6\.13\.6\.1\.3a/.test(s.ref)));
  // RIDOT: 100 ft pieces (BDM 6.4), the same stations (every piece ≤ 78 ft); the location cites RIDOT 6.7.2
  const PR = J(P); PR.ownerRules.owner = 'RIDOT'; const SR = AD.settings(PR); assert.equal(SR.splR.shipLen, 100); assert.equal(SR.splR.shipWt, 150); assert.equal(SR.splR.mand, 150);
  assert.match(SR.splR.cite.loc, /RIDOT BDM 6\.7\.2/); assert.equal(JSON.stringify(SP.reference(PR, cf, SR.splR, AD.segmentsOf(L0), 5).spl), '[78,143,217,282]');
  // CTDOT 120 ft / 120 kip (V2 2.3.5.1CT); MassDOT: no shipping limit (120 ft default), quarter points of simple spans (3.6.5.3)
  const PC = J(P); PC.ownerRules.owner = 'CTDOT'; const SC = AD.settings(PC).splR; assert.equal(JSON.stringify([SC.shipLen, SC.shipWt]), '[120,120]');
  const PM = J(P); PM.ownerRules.owner = 'MassDOT'; const SM = AD.settings(PM).splR; assert.equal(JSON.stringify([SM.shipLen, SM.q]), '[120,0.25]'); assert.match(SM.src.shipLen, /no owner limit/);
});

test('The rule\'s other branches (hand inputs): simple spans, quarter points, weight split, support distance, merge, symmetry', () => {
  const base = M.defaultProject(), Ru0 = AD.settings(base).splR, seg = (x0, x1) => [{ x0, x1, D: 60, tw: 0.5, topB: 16, topT: 1, botB: 18, botT: 1.5 }];
  // A = 16 + 27 + 30 = 73 in² → 73(3.403) = 248.4 lb/ft
  const simple = (spans, owner) => { const P = J(base); P.spans = { lengths: spans, continuity: 'simple' }; P.xs.skews = new Array(spans.length + 1).fill(0); P.ownerRules.owner = owner || 'AASHTO'; return P; };
  const none = { pts: [] };
  // 130 + 130 ft simple: ceil(130/120) = 2 → odd: 3 equal pieces of 43.33 ft: 43.33 → 43, 86.67 → 87; 173.33 → 173, 216.67 → 217
  let P = simple([130, 130]); assert.equal(JSON.stringify(SP.reference(P, none, Ru0, seg(0, 260), 0).spl), '[43,87,173,217]');
  // MassDOT 3.6.5.3: the quarter points when the middle half (65 ft) fits: 32.5 → 33 (Math.round), 97.5 → 98; 162.5 → 163, 227.5 → 228,
  // mirrored about 130 ft: 33, 98, 162, 227
  P = simple([130, 130], 'MassDOT'); assert.equal(JSON.stringify(SP.reference(P, none, AD.settings(P).splR, seg(0, 260), 0).spl), '[33,98,162,227]');
  // one 100 ft simple span: no splice (100 ≤ 120)
  P = simple([100]); assert.equal(JSON.stringify(SP.reference(P, none, Ru0, seg(0, 100), 0).spl), '[]');
  // weight: one 100 ft span, W = 248.4(100)(1.05)/1000 = 26.08 kip > 20 kip: split at its middle 50 ft, which is within L/8 = 12.5 ft of
  // midspan, so at its third point: round(0 + 1 × 100/3) = 33 ft (mid > (x0 + x1)/2 is false: 2/3 → 67 ft; the mirror then gives 33 and 67)
  const Rw = { ...Ru0, shipWt: 20 }; const rw = SP.reference(P, none, Rw, seg(0, 100), 5);
  near(SP.pieceWt(seg(0, 100), 0, 100, 5), 73 * 490 / 144 * 100 * 1.05 / 1000, 1e-9, 'piece weight'); assert.equal(JSON.stringify(rw.spl), '[33,67]'); assert.ok(rw.notes.some(t => /26\.08 kip > 20 kip/.test(t)));
  // continuous, contraflexure 4 ft from a pier (spLocSuggest): moved out to 10 ft; two points 6 ft apart merged (minimum piece 10 ft)
  P = J(base); const cf = { pts: [{ pier: 1, side: 'L', xr: 106 }, { pier: 1, side: 'R', xr: 140 }, { pier: 1, side: 'R', xr: 146 }, { pier: 2, side: 'L', xr: 220 }, { pier: 2, side: 'R', xr: 282 }] };
  const rc = SP.reference(P, cf, Ru0, null, 0);
  // kept 106, 140 (146 merged: 6 < 10), 220, 282; symmetric bridge: left half 106, 140 mirrored to 220, 254 (the right half's own points replaced);
  // 106 is 4 ft from the pier at 110: moved to 100; 254 is 4 ft from 250: moved to 260
  assert.equal(JSON.stringify(rc.spl), '[100,140,220,260]'); assert.ok(rc.notes.some(t => /146 ft dropped/.test(t)) && rc.notes.some(t => /106 ft moved to 100 ft/.test(t)));
});

test('The rules check: piece length and weight, bearing, cross-frame and transition distances (hand numbers)', () => {
  const P = M.defaultProject(), Ru = { ...AD.settings(P).splR, shipLen: 70, minXf: 3, minTr: 10 }, segs = AD.segmentsOf(AD.layoutOf(P));
  // splices 82, 145, 215, 278: pieces 82, 63, 70, 63, 82 ft: the end pieces fail 82 > 70 (ratio 82/70 = 1.171)
  const C = SP.check(P, [82, 145, 215, 278], Ru, { segs, allow: 5, frames: [[80, 104, 150]], trans: [88, 128] });
  const sp1 = C.items.filter(i => i.id === 'SP1'); assert.equal(sp1.filter(i => !i.ok).length, 2); near(sp1[0].r, 82 / 70, 1e-12, 'SP1 ratio');
  // 82 ft: frame at 80 → 2 ft < 3 ft (fails, 3/2 = 1.5); transition at 88 → 6 ft < 10 ft (fails); 145: frame 150 → 5 ft ≥ 3; transition 128 → 17 ft
  const at = (id, x) => C.items.find(i => i.id === id && i.x === x);
  assert.equal(at('SP5', 82).ok, false); near(at('SP5', 82).r, 1.5, 1e-12, 'SP5'); assert.equal(at('SP6', 82).ok, false); assert.equal(at('SP5', 145).ok, true); assert.equal(at('SP6', 145).ok, true);
  // bearing: 82 is 28 ft from the pier at 110 ≥ 10 ft (ratio 10/28)
  near(at('SP4', 82).r, 10 / 28, 1e-12, 'SP4');
  // the weight of piece 1 (0–82 ft) with 5 %: the plates of the built-in G1 (16 × 3/4, 16 × 1 1/8, 60 × 9/16 to 82 ft: 63.75 in² → 216.9 lb/ft)
  const w1 = C.items.find(i => i.id === 'SP3'); near(w1.r * Ru.shipWt, 63.75 * 490 / 144 * 82 * 1.05 / 1000, 1e-6, 'SP3 weight');
  assert.equal(C.ok, false); assert.ok(C.steps.length >= C.items.length);
  // minimum piece 30 ft (default since 2026-11-02): splices at 78 and 100 ft leave a 22 ft piece: fails, ratio 30/22 = 1.364; the old 10 ft passed it
  const R30 = AD.settings(P).splR; assert.equal(R30.minLen, 30); assert.match(R30.src.minLen, /30 ft/);
  const C30 = SP.check(P, [78, 100, 260, 282], R30, {}), p2 = C30.items.find(i => i.id === 'SP2' && i.x === 78);
  assert.equal(p2.ok, false); near(p2.r, 30 / 22, 1e-12, 'SP2 30 ft');
  assert.equal(SP.check(P, [78, 100, 260, 282], { ...R30, minLen: 10 }, {}).items.find(i => i.id === 'SP2' && i.x === 78).ok, true);
});

test('Range and Auto layouts: counts per span, station windows, a span locked, the current stations', () => {
  const P = M.defaultProject(), L0 = AD.layoutOf(P); ctx.L0 = L0;
  const plan = vars => { const Q = J(P); Q.autodesign = { mode: 'new', vars }; const S = AD.settings(Q); return AD.splPlan(Q, S, ctx, L0); };
  // Auto: the rule's layout, then the stations entered (they meet every rule); no layout with fewer splices meets 120 ft pieces
  let R = plan({ spl: { mode: 'auto' } }); assert.equal(JSON.stringify(R.lays.map(l => l.spl)), '[[78,143,217,282],[82,145,215,278]]');
  // Auto, 150 ft pieces: also the fewest: 143, 217 (pieces 143, 74, 143 ft ≤ 150)
  const Q = J(P); Q.autodesign = { mode: 'new', vars: { spl: { mode: 'auto' } }, splRules: { shipLen: 150 } }; R = AD.splPlan(Q, AD.settings(Q), ctx, L0);
  assert.equal(JSON.stringify(R.lays.map(l => l.spl)), '[[78,143,217,282],[82,145,215,278],[143,217]]');
  // Range 1 … 1 per span, span 2 exactly 2, windows: 78 and 282 are in 70–90 / 270–290; 143 and 217 in 140–150 / 210–220
  R = plan({ spl: { mode: 'range', min: 1, max: 1, win: '70-90, 140-150, 210-220, 270-290' }, 'spl#2': { mode: 'range', min: 2, max: 2 } });
  assert.equal(JSON.stringify(R.lays.map(l => l.spl)), '[[78,143,217,282]]');
  // a window that does not hold the rule's station: 78 moved to the window's nearest station 80 (and 282 to 280, the mirror)
  R = plan({ spl: { mode: 'range', min: 1, max: 1, win: '80-90, 140-150, 210-220, 270-280' }, 'spl#2': { mode: 'range', min: 2, max: 2 } });
  assert.equal(JSON.stringify(R.lays.map(l => l.spl)), '[[80,143,217,280]]');
  // at most one splice per span cannot meet 120 ft pieces: no layout, and the run says so
  R = plan({ spl: { mode: 'range', min: 0, max: 1 } }); assert.equal(R.lays.length, 0);
  const it = AD.run(P, { settings: { mode: 'new', vars: { spl: { mode: 'range', min: 0, max: 1 }, nb: { mode: 'lock' }, D: { mode: 'lock' }, oh: { mode: 'lock' } } }, fullChecks: false }); let s; while (!(s = it.next()).done);
  assert.equal(s.value.cands.length, 0); assert.match(s.value.note, /No field splice layout meets the placement rules/);
  // span 2 locked (145, 215 as entered), the others Auto: 78 and 282 by the rule, the bridge symmetry not required (a span is locked)
  R = plan({ spl: { mode: 'auto' }, 'spl#2': { mode: 'lock' } }); assert.equal(JSON.stringify(R.lays[0].spl), '[78,145,215,282]');
});

let RUN = null;
const runAuto = () => RUN || (RUN = (() => { const it = AD.run(M.defaultProject(), { settings: { mode: 'new', topN: 1, vars: { spl: { mode: 'auto' }, nb: { mode: 'lock' }, oh: { mode: 'lock' }, D: { mode: 'lock' } } }, maxIt: 4, trimTries: 2 }); let s; while (!(s = it.next()).done); return s.value; })());

test('Auto run: candidates on rule-abiding layouts pass every module from scratch; Apply moves the stations for every tab', () => {
  const R = runAuto(), P0 = M.defaultProject();
  assert.ok(R.spl && R.spl.lays.length >= 1, 'splice layouts'); assert.ok(R.cands.length >= 1, `no candidate: ${R.note}`);
  const c = R.cands[0], Ru = R.S.splR;
  assert.ok(R.spl.lays.some(l => JSON.stringify(l.spl) === JSON.stringify(c.L.spl)), 'the candidate is on one of the layouts');
  assert.ok(c.spl && c.spl.chk && c.spl.chk.every(q => q.ok), 'placement rules on the candidate');
  assert.ok(c.steps.some(s => s.id === 'splp.ref') && c.steps.some(s => /^spl\.SP1/.test(s.id)), 'the placement steps are in the candidate\'s steps');
  // cost: the splice count of the layout
  assert.equal(c.cost.nSpl, c.L.spl.length); near(c.cost.total, 3 * c.cost.w + c.nb * (1500 * c.cost.nTr + 6000 * c.cost.nSpl + 150 * c.cost.nStiff), 1e-6, 'cost');
  // flange transitions and pieces follow the stations: no transition within the shortest zone of a splice, a web piece per field piece
  const tr = SP.transitions(c.segments, c.L.spl); tr.forEach(x => c.L.spl.forEach(y => assert.ok(Math.abs(x - y) >= Ru.minTr - 1e-9, `transition ${x} vs splice ${y}`)));
  assert.equal(c.L.web.length, c.L.spl.length + 1);
  // re-checked from scratch
  const Q = AD.projectWith(P0, c.L, c.det), E = AD.evaluate(Q, { level: 'full', ctx: {} });
  assert.ok(E.pass, `fails: ${JSON.stringify(E.fails.slice(0, 3).map(f => [f.mod, f.id, f.title, f.r]))}`);
  // Apply: framing.splices = the candidate's; the Field splices tab, the framing and the drawings read them
  const A = AD.apply(P0, c).project; assert.equal(JSON.stringify(A.framing.splices), JSON.stringify(c.L.spl));
  assert.equal(JSON.stringify(W.SBDSplices.settings(A).x), JSON.stringify(c.L.spl));
  assert.equal(JSON.stringify(W.SBDFraming.modelOf(A).m.splices), JSON.stringify(c.L.spl));
  const DWW = loadShared('units.js', 'steps.js', 'lldf.js', 'dxf.js', ...['model.js', 'owners.js', 'sections.js', 'lldf.js', 'loads.js', 'shear.js', 'stiffeners.js', 'flexure.js', 'framing.js', 'crossframes.js', 'drawings.js'].map(f => path.join(ROOT, 'apps/steel-bridge/engine', f)));
  const G = DWW.SBDDrawings.model(J(A)); assert.equal(JSON.stringify(plain(G.splices)), JSON.stringify(c.L.spl));
  // Undo puts the stations back
  assert.equal(JSON.stringify(AD.undo(A).framing.splices), JSON.stringify(P0.framing.splices));
});
