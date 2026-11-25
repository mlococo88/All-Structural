// BEFF (2026-11-25; engineer's choice "Calculated, optional override"; CLAUDE.md §4 change): apps/steel-bridge engine/model.js beffOf,
// beffOvOf, beffBridge, beffStep, migrateBeff and their use by the engines.
// 1. Per-line widths: an exterior type on G1 and G5 with unequal overhangs takes 96 in on G1 and 105 in on G5 (AASHTO LRFD 10th Ed.
//    Art. 4.6.2.6.1, tributary width); the analysis payload (deck.beff), the composite section and the flexure locations follow the line.
// 2. An interior type on lines with unequal bays: each line its own average of the adjacent spacings.
// 3. Override b_eff: the entered value on every line of the type (the rule of every project saved before).
// 4. Migration (§5), both cases: a stored b_eff within 0.5 in of every line's tributary width -> calculated (no notice); otherwise the
//    override is ticked, with a one-time notice listing the type, its entered and its calculated widths; the stored beff is never changed;
//    the exported file is still schema version 1 with girders[i].beff, and the previous version of the model (git history) reads it.
// 5. Studs, beffMode 'bridge' (as GirderDetail): one b_eff for every girder, the first exterior type's on G1.
// 6. Hash proof: a project whose stored b_eff equals the tributary width of each of its lines gives the same results calculated as with
//    the override ticked (= the rule before this change), module by module (SBDSummary.run).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES);
W.SBDReportData.install();
const M = W.SBDModel, SEC = W.SBDSections, J = o => JSON.parse(JSON.stringify(o));
export const PREV_REF = 'a598ce57e299faeec81026c2e5c3b80d5d0c67e6';   // origin/main before this change

/* newProject() with unequal overhangs: G1 3.25 ft, G5 4.00 ft (bays 9.5 ft) */
function unequalOh() { const P = M.newProject(); P.xs.ohR = 4.0; return P; }
const near = (a, b, t = 1e-9) => Math.abs(a - b) <= t;

test('per-line widths: unequal overhangs, the exterior type takes 96 in on G1 and 105 in on G5', () => {
  const P = unequalOh(), ext = 1, g = P.girders[ext];
  assert.equal(M.beffOvOf(P, g), false, 'newProject: calculated');
  assert.equal(M.beffOf(P, g, 0), 96, '12 (9.5 / 2 + 3.25) = 96 in');
  assert.equal(M.beffOf(P, g, 4), 105, '12 (9.5 / 2 + 4.00) = 105 in');
  assert.equal(M.beffOf(P, g), 96, 'the design line G1');
  const V = M.atLine(P, ext, 4); assert.equal(M.beffOf(V, V.girders[ext]), 105, 'the view of G5 reads its own width');
  assert.equal(g.beff, 96, 'the stored value is not rewritten');
  const st = M.beffStep(P, g, 4); assert.equal(st.id, 'beff.G5'); assert.equal(st.value, 105); assert.match(st.eq, /w_\{oh,R\}/); assert.match(st.sub, /9\.500.*4\.000/);
  const S = W.SharedSteps.step(st); assert.equal(S.value, 105);   // recorded for tex.test.mjs (KaTeX parse)
  W.SharedSteps.step(M.beffStep(P, g, 0)); W.SharedSteps.step(M.beffStep(P, P.girders[0], 2));
  // the composite section of each line (engine/sections.js card, as the Section properties tab and report/data.js sections)
  const s = g.segments[0], pl = { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }, mat = { Fyt: 50, Fyb: 50, Fyw: 50, Fyr: 60, fc: 4 };
  const n = SEC.modularRatio(4, 0.150, 1.0, 'exact').n, card = b => SEC.card(pl, { composite: true, ts: 8, haunch: 2, beff: b, rebar: P.deck.rebar }, mat, n, { region: 'pos' });
  const c1 = card(M.beffOf(P, g, 0)), c5 = card(M.beffOf(V, V.girders[ext]));
  assert.ok(c5.cn.I > c1.cn.I && c5.Mp > c1.Mp, 'G5 (wider) stiffer and stronger than G1');
});

test('per-line widths reach the engines: the analysis payload, the flexure locations and the live-load stiffness of each line', () => {
  const P = unequalOh(), ext = 1, R = W.SBDRatingUI;
  const a1 = R.fromAnalysis(P, ext), a5 = R.fromAnalysis(M.atLine(P, ext, 4), ext);
  assert.equal(a1.pl.girderDetail.deck.beff, 96); assert.equal(a5.pl.girderDetail.deck.beff, 105);
  const F5 = W.SBDFlexureUI.build({ P: M.atLine(P, ext, 4), g: ext, src: 'analysis' }); assert.ok(!F5.err, F5.err);
  assert.ok(F5.rows.length && F5.rows.every(r => r.beff === 105), 'every flexure location of G5 at 105 in');
  // 2.5.2.6.2 average stiffness: the exterior type splits into two groups (G1 96 in, G5 105 in), the interior type one (114 in)
  const B = a1.R.bEI; assert.ok(B && !B.same); assert.deepEqual(J(B.types.map(t => [t.gi, t.lines])).sort(), [[0, [1, 2, 3]], [1, [0]], [1, [4]]].sort());
  // override: one group per type, as before
  const Q = unequalOh(); Q.girders[1].beffOv = true; const B2 = R.fromAnalysis(Q, 1).R.bEI; assert.deepEqual(J(B2.types.map(t => [t.gi, t.lines])).sort(), [[0, [1, 2, 3]], [1, [0, 4]]].sort());
});

test('an interior type on lines with unequal bays: each line its own width', () => {
  const P = M.newProject(); P.xs.bays = [9, 10, 11, 9.5]; const g = P.girders[0];
  assert.deepEqual(J(M.typeLines(P, 0)), [1, 2, 3]);
  assert.deepEqual([1, 2, 3].map(j => M.beffOf(P, g, j)), [114, 126, 123], '12 (9 + 10) / 2, 12 (10 + 11) / 2, 12 (11 + 9.5) / 2');
  assert.match(M.beffStep(P, g, 2).sub, /10\.000 \+ 11\.000/);
  assert.equal(M.validate(P).errors.length, 0);
  // the stored 114 in is within 0.5 in of G2 only: an old project (no beffOv) with these bays keeps 114 as its override
  delete g.beffOv; assert.equal(M.beffOvOf(P, g), true); assert.deepEqual([1, 2, 3].map(j => M.beffOf(P, g, j)), [114, 114, 114]);
});

test('override b_eff: the entered value on every line; validate checks it', () => {
  const P = unequalOh(), g = P.girders[1]; g.beffOv = true; g.beff = 100;
  assert.deepEqual([0, 4].map(j => M.beffOf(P, g, j)), [100, 100]);
  const st = M.beffStep(P, g, 4); assert.equal(st.value, 100); assert.match(st.label, /entered/); assert.match(st.note, /105\.00 in/);
  g.beff = NaN; assert.ok(M.validate(P).errors.some(e => e.path === 'girders.1.beff'), 'a blank override is an input error');
  g.beffOv = false; assert.ok(!M.validate(P).errors.some(e => e.path === 'girders.1.beff'), 'not used when calculated');
  g.beffOv = 'yes'; assert.ok(M.validate(P).errors.some(e => e.path === 'girders.1.beffOv'));
  const Q = M.newProject(); Q.xs.bays = [9.5, 9.5, 9.5]; assert.ok(M.validate(Q).errors.some(e => /cannot be calculated/.test(e.msg)), 'a bay list that does not match N_b');
  const a = M.addType(Q, 1, {}); assert.equal(Q.girders[a].beffOv, false, 'a copy keeps the choice');
});

/* an old file: a project saved before 2026-11-25 (no beffOv) */
function oldFile(beffI, beffE) { const P = M.newProject(); P.girders.forEach(g => delete g.beffOv); P.girders[0].beff = beffI; P.girders[1].beff = beffE; P.xs.ohR = 3.4; return M.exportJSON(P); }

test('migration, stored b_eff within 0.5 in of every line: calculated, no notice, results within the tolerance', () => {
  const txt = oldFile(114.3, 96);   // interior lines 114 in; exterior G1 96.0, G5 12 (4.75 + 3.4) = 97.8 -> 96 is 1.8 in off G5: override
  const r = M.importJSON(txt); assert.ok(r.ok);
  const [I, X] = r.project.girders;
  assert.equal(I.beffOv, false, 'interior 114.3 within 0.5 in of 114 on G2, G3, G4'); assert.equal(I.beff, 114.3, 'stored beff kept');
  assert.equal(M.beffOf(r.project, I, 2), 114, 'now the tributary width (0.3 in less than stored)');
  assert.equal(X.beffOv, true, 'exterior 96 is 1.8 in from G5 97.8'); assert.equal(X.beff, 96);
  const nt = r.notes.find(t => /b_eff is now calculated/.test(t)); assert.ok(nt); assert.match(nt, /Exterior 96\.0 in \(calculated: G1 96\.0, G5 97\.8 in\)/); assert.doesNotMatch(nt, /Interior/);
  const r2 = M.importJSON(M.exportJSON(r.project)); assert.ok(!r2.notes.some(t => /b_eff is now calculated/.test(t)), 'one-time: the flags are saved');
  assert.deepEqual(J(r2.project.girders.map(g => g.beffOv)), [false, true]);
});

test('migration, stored b_eff off the tributary width: override on, the notice, the stored value used on every line', () => {
  const r = M.importJSON(oldFile(120, 96.0)); const [I] = r.project.girders;
  assert.equal(I.beffOv, true); assert.deepEqual([1, 2, 3].map(j => M.beffOf(r.project, I, j)), [120, 120, 120]);
  assert.ok(r.notes.some(t => /Interior 120\.0 in \(calculated: G2 114\.0, G3 114\.0, G4 114\.0 in\)/.test(t)));
  // an in-memory old project (no beffOv) reads the same rule as the migration
  const P = JSON.parse(oldFile(120, 96)); assert.equal(M.beffOvOf(P, P.girders[0]), true); assert.equal(M.beffOvOf(P, P.girders[1]), true);
  const D = M.defaultProject(); assert.equal(M.beffOvOf(D, D.girders[0]), false, 'defaultProject: 114 in = the tributary width of G2'); assert.equal(M.beffOf(D, D.girders[0]), 114);  // an invalid cross-section (a negative bay): nothing written, no notice; the entered value is used until a load with a valid cross-section
  const B = JSON.parse(oldFile(114, 96)); B.xs.bays[1] = -3; const rb = M.importJSON(JSON.stringify(B));
  assert.ok(!rb.notes.some(t => /b_eff is now calculated/.test(t))); assert.ok(rb.project.girders.every(g => !('beffOv' in g)));
  assert.equal(M.beffOf(rb.project, rb.project.girders[0], 2), 114, 'the entered value');
});

test('round trip: the exported file stays version 1 with girders[i].beff, and the previous version of the model reads it', () => {
  const r = M.importJSON(oldFile(120, 96)); r.project.girders[1].beffOv = false; const txt = M.exportJSON(r.project), o = JSON.parse(txt);
  assert.equal(o.schema, 'sbd2.project'); assert.equal(o.version, 1); assert.deepEqual(J(o.girders.map(g => g.beff)), [120, 96]);
  assert.deepEqual(J(o.girders.map(g => g.beffOv)), [true, false]);
  let src; try { src = execFileSync('git', ['-C', ROOT, 'show', `${PREV_REF}:apps/steel-bridge/engine/model.js`], { encoding: 'utf8' }); } catch (e) { return; }   // no git history: the format checks above
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(src, ctx);
  const q = ctx.SBDModel.importJSON(txt); assert.ok(q.ok, q.error); assert.deepEqual(J(q.errors), []);
  assert.deepEqual(J(q.project.girders.map(g => g.beff)), [120, 96], 'the previous version reads the stored b_eff (its rule: on every line)');
  assert.equal(ctx.SBDModel.exportJSON(q.project).includes('"beffOv": false'), true, 'and keeps the new field when it saves');
});

test('studs, bridge-wide b_eff (as GirderDetail): the first exterior type on G1, for every girder', () => {
  const P = unequalOh(); P.studs.beffMode = 'bridge';
  assert.equal(M.beffBridge(P, P.girders[0]), 96, 'the interior type: G1 96 in');
  assert.equal(M.beffBridge(M.atLine(P, 1, 4), M.atLine(P, 1, 4).girders[1]), 96, 'G5 too: one width for the bridge');
  const F = W.SBDFatigueUI, a5 = F.fromAnalysis(M.atLine(P, 1, 4), 1);
  assert.equal(a5.pl.girderDetail.details.studs.results.beff, 96, 'the payload bridge-wide b_eff'); assert.equal(a5.pl.girderDetail.deck.beff, 105, 'the girder\'s own');
  const B = F.build({ P: M.atLine(P, 1, 4), g: 1, src: 'analysis' }); assert.ok(!B.err, B.err);
  assert.equal(B.SR.beffMode, 'bridge'); assert.equal(B.SR.dk.beff, 96); assert.equal(B.alt.beff, 105, 'the comparison line: this girder\'s own');
  const Q = unequalOh(); const G = F.build({ P: M.atLine(Q, 1, 4), g: 1, src: 'analysis' }); assert.equal(G.SR.beffMode, 'girder'); assert.equal(G.SR.dk.beff, 105);
  const O = unequalOh(); O.studs.beffMode = 'bridge'; O.girders[1].beffOv = true; O.girders[1].beff = 90; assert.equal(M.beffBridge(O, O.girders[0]), 90, 'override: the entered value, as before');
});

/* every module's result of each unit (a type on a line), as the Summary runs it; functions and the run time left out */
const SM = W.SBDSummary;
function hashAll(P) {
  const units = SM.units ? SM.units(P) : null, out = [];
  (units || P.girders.map((g, gi) => ({ gi, j: M.designLine(P, g), P }))).forEach(U => SM.MODS.forEach(m => {
    let r; try { r = SM.run(U.P, U.gi, m.k); } catch (e) { r = { err: String(e && e.message) }; }
    const seen = new WeakSet(), txt = JSON.stringify(r, function (k, v) { if (typeof v === 'function' || (this === r && k === 't') || k === 'beffOv' || k === 'key') return undefined;   // t: the run time (ms)
      if (v && typeof v === 'object') { if (seen.has(v)) return '[seen]'; seen.add(v); } return v; });   // a shared or circular object written once
    out.push([U.gi, U.j, m.k, crypto.createHash('sha1').update(txt).digest('hex')]); }));
  return out;
}
test('hash proof: stored b_eff = the tributary width of each line -> the same results calculated as with the override (the rule before)', () => {
  const cases = [['defaultProject', M.defaultProject()], ['newProject', M.newProject()]];
  cases.forEach(([nm, P]) => {
    P.girders.forEach((g, gi) => M.typeLines(P, gi).forEach(j => assert.equal(M.tribBeff(P.xs, j), g.beff, `${nm}: ${g.label} on G${j + 1}`)));
    const Q = J(P); Q.girders.forEach(g => { g.beffOv = true; });
    const a = hashAll(P), b = hashAll(Q); assert.ok(a.length > 0);
    assert.deepEqual(a, b, `${nm}: every module of every line identical`);
  });
});
