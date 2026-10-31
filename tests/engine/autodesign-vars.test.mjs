// Auto design PR 2 (2026-10-31): the design variables (Lock / Range / Auto, P.autodesign.vars), the detail sizing on the tabs' own checks,
// Rating and Welds in the full check, the framing fallback, saved data. engine/autodesign.js.
//   1. Saved data: a project saved before this PR (no autodesign.vars) round-trips through export / import unchanged and reads every
//      variable at its default; a vars entry is read back as entered.
//   2. Locks and ranges are honoured (Refine, the built-in project): locked plates, cross-frames and weld as they were, ranged widths,
//      stiffener spacing and stiffener thickness within their range; every candidate passes the full check.
//   3. Applying a candidate gives the tabs' ratios (Flexure, Shear & stiffeners, Fatigue & studs, Cross-frames, Field splices, Rating, Welds)
//      equal to the candidate's (one engine).
//   4. A lock no design can meet is reported: "No candidate passes with these locks and ranges: governing …".
//   5. No framing: the brace points are the stiffener layout's cross-frames (frames.at), as the Flexure tab (hand check of L_b).
//   6. Auto finds a passing design on recorded projects: the recorded parity designs (tests/projects/sbd2-autodesign/ad_*.json, re-run in this
//      PR) re-checked from scratch with their sized details.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT, plain } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/welds.js',
  'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/splices.js', 'ui/flexure.js', 'ui/rating.js', 'ui/welds.js', 'ui/constructibility.js', 'engine/autodesign.js'].map(E));
const AD = W.SBDAutoDesign, M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, what) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const runAD = (P, settings) => { const it = AD.run(P, { settings, maxIt: 5, trimTries: 2 }); let s; while (!(s = it.next()).done); return s.value; };

test('Saved data: a project without autodesign.vars round-trips unchanged and reads every variable at its default', () => {
  // as saved before this PR: the Auto design inputs of PR 1 (mode, objective, price list, limits) and an Apply's undo snapshot
  const P = M.defaultProject(); P.autodesign = { mode: 'refine', objective: 'cost', topN: 4, cost: { steel: 2.5 }, limits: { Dmax: 72, tfMax: 2.5 }, nbList: '', change: { nb: '', D: '' } };
  const txt = M.exportJSON(P), R = M.importJSON(txt);
  assert.ok(R.ok, R.error); assert.equal(JSON.stringify(R.project), JSON.stringify(P)); assert.equal(M.exportJSON(R.project), txt);
  const S = AD.settings(R.project);
  // refine: N_b, D and the transitions are held by the mode; studs (no zones entered), weld ('' = the minimum) and splices (auto) default to Auto
  assert.equal(S.V.nb.mode, 'lock'); assert.equal(S.V.D.mode, 'lock'); assert.equal(S.V.trans.mode, 'lock'); assert.equal(S.V.spl.mode, 'lock');
  ['tw', 'bt', 'tt', 'bb', 'tb', 'splPl', 'tsSp', 'tsA_b', 'tsA_t', 'tsB_b', 'tsB_t', 'bsA_n', 'bsA_b', 'bsA_t', 'bsB_n', 'bsB_b', 'bsB_t', 'scP', 'scN', 'cf', 'weld'].forEach(id => assert.equal(S.V[id].mode, 'auto', id));
  assert.equal(S.lim.Dmax, 72); assert.equal(S.cost.steel, 2.5);   // the PR 1 inputs as before
  // the defaults follow the tabs' own "automatic" switches: entered stud zones, an entered weld size, splice auto-design off → Lock
  const Q = J(P); Q.studs = { ...M.defaultStuds(), zones: [{ x1: 0, x2: 110, nr: 3, p: 12 }] }; Q.welds = { ...M.defaultWelds(), w: 0.3125 }; Q.splices = { ...M.defaultSplices(), auto: false };
  const S2 = AD.settings(Q); ['scP', 'scN', 'weld', 'splPl'].forEach(id => assert.equal(S2.V[id].mode, 'lock', id));
  // entries as saved: a variable, a field piece's own entry (overrides the variable there), a Lock-only variable stays locked
  Q.autodesign = { mode: 'new', vars: { tb: { mode: 'range', min: 1, max: 2 }, 'tb#3': { mode: 'lock' }, spl: { mode: 'auto' }, D: { mode: 'range', min: 60, max: 72, step: 2 } } };
  const S3 = AD.settings(Q);
  assert.equal(JSON.stringify([S3.V.tb.mode, S3.V.tb.min, S3.V.tb.max, S3.V['tb#3'].mode, S3.V.spl.mode, S3.V.D.step]), JSON.stringify(['range', 1, 2, 'lock', 'lock', 2]));
  const DL = AD.depthList(Q, S3, AD.layoutOf(Q)); assert.equal(DL.lo, 60); assert.equal(DL.hi, 72); assert.ok(DL.coarse.every(D => D % 2 === 0 && D >= 60 && D <= 72));
  Q.autodesign.vars.nb = { mode: 'range', min: 4, max: 6 }; assert.equal(JSON.stringify(AD.nbList(Q, AD.settings(Q))), '[4,5,6]');
  Q.autodesign.vars.nb = { mode: 'lock' }; assert.equal(JSON.stringify(AD.nbList(Q, AD.settings(Q))), '[5]');
});

let RUN = null; const P0 = M.defaultProject();
const VARS = { tt: { mode: 'lock' }, tw: { mode: 'lock' }, bb: { mode: 'range', min: 16, max: 20 }, tsSp: { mode: 'range', min: 1, max: 2 }, tsA_t: { mode: 'range', min: 0.4375, max: 0.625 }, cf: { mode: 'lock' }, weld: { mode: 'lock' } };
const run = () => RUN || (RUN = runAD(P0, { mode: 'refine', topN: 1, vars: VARS }));
const zat = (l, x) => l.find(q => x >= q.x0 - 1e-9 && x < q.x1 - 1e-9) || l[l.length - 1];

test('Locks and ranges are honoured (Refine, the built-in project); the candidate passes the full check', () => {
  const R = run(), L0 = AD.layoutOf(P0);
  assert.ok(R.cands.length >= 1, `no candidate: ${R.note}`);
  for (const c of R.cands) {
    // top flange thickness locked: the zones as they were (cut points and thicknesses); web locked; bottom width 16 … 20 in
    assert.deepEqual(plain(c.L.top.map(z => [z.x0, z.x1, z.t])), plain(L0.top.map(z => [z.x0, z.x1, z.t])));
    assert.deepEqual(plain(c.L.web.map(p => p.tw)), plain(L0.web.map(p => p.tw)));
    c.L.bot.forEach(z => assert.ok(z.b >= 16 - 1e-9 && z.b <= 20 + 1e-9, `bottom width ${z.b}`));
    const I = c.det.inputs;
    assert.deepEqual(plain(I.crossframes.mem), plain(P0.crossframes.mem), 'cross-frames locked'); assert.equal(I.welds.w, P0.welds.w, 'weld locked');
    assert.ok(I.stiffeners.layout.doRatio >= 1 && I.stiffeners.layout.doRatio <= 2, `d_o/D ${I.stiffeners.layout.doRatio}`);
    const tA = I.stiffeners.transverse.types.A.tp; assert.ok(tA >= 0.4375 && tA <= 0.625, `t_p ${tA}`);
    // re-checked from scratch (a fresh cache): passes every module
    const Q = AD.projectWith(P0, c.L, c.det), E2 = AD.evaluate(Q, { level: 'full', ctx: {} });
    assert.ok(E2.pass, `candidate fails: ${JSON.stringify(E2.fails.slice(0, 3).map(f => [f.mod, f.id, f.title, f.r]))}`);
    ['flexure', 'shear', 'stiffeners', 'fatigue', 'studs', 'constructibility', 'cross-frames', 'splices', 'rating', 'welds'].forEach(m => assert.ok(c.mods.some(q => q.mod === m), `module ${m} in the full check`));
  }
});

test('Apply: the tabs\' ratios on the applied project equal the candidate\'s (one engine)', () => {
  const R = run(), c = R.cands[0], Q = AD.apply(P0, c).project, maxOf = (C, f) => Math.max(0, ...(C || []).flatMap(k => k.items.filter(it => f ? f(k) : true).map(it => it.r).filter(v => isFinite(v))));
  const got = Object.fromEntries(c.mods.map(m => [m.mod, m.r])), tab = {};
  for (let g = 0; g < Q.girders.length; g++) {
    const fx = W.SBDFlexureUI.build({ P: Q, g, src: 'analysis' }), sh = W.SBDShearUI.build({ P: Q, g, src: 'analysis' }), fa = W.SBDFatigueUI.build({ P: Q, g, src: 'analysis' });
    const cf = W.SBDFramingUI.build({ P: Q, g }), rt = W.SBDRatingUI.build({ P: Q, g, src: 'analysis' }), wt = W.SBDWeldsUI.build({ P: Q, g, src: 'analysis' }), cn = W.SBDConstrUI.build({ P: Q, g, src: 'project' });
    const AR = W.SBDAnalysis.analyzeGirder(Q, g), sp = W.SBDSplices.girder(Q, g, AR, { env: W.SBDSplicesUI.envOf(Q) });
    const up = (k, v) => { tab[k] = Math.max(tab[k] || 0, v); };
    up('flexure', Math.max(...fx.rows.flatMap(r => r.checks.filter(q => q.inUse && isFinite(q.ratio)).map(q => q.ratio))));
    up('shear', Math.max(...sh.stations.flatMap(r => r.checks.filter(q => q.inUse && isFinite(q.ratio)).map(q => q.ratio))));
    up('stiffeners', Math.max(maxOf(sh.tsC), maxOf(sh.bsC)));
    up('studs', maxOf(fa.SCC)); up('cross-frames', maxOf(cf.C)); up('welds', maxOf(wt.C)); up('splices', Math.max(...sp.list.map(s => maxOf(s.CK))));
    up('constructibility', Math.max(...cn.rows.flatMap(r => r.checks.filter(q => isFinite(q.ratio)).map(q => q.ratio)), ...((cn.oh && cn.oh.rows) || []).flatMap(r => r.checks.filter(q => isFinite(q.ratio)).map(q => q.ratio))));
    up('rating', 1 / rt.sum.gov.inv.inv);
  }
  Object.entries(tab).forEach(([k, v]) => assert.ok(Math.abs(v - got[k]) < 1e-9, `${k}: tab ${v} vs candidate ${got[k]}`));
});

test('A lock no design can meet is reported with what governs', () => {
  // the bottom flange held at most 3/4 in thick and at most 16 in wide: the pier sections cannot carry the negative moment
  const P = M.defaultProject(), R = runAD(P, { mode: 'refine', topN: 1, vars: { tb: { mode: 'range', max: 0.75 }, bb: { mode: 'range', max: 16 } } });
  assert.equal(R.cands.length, 0);
  assert.match(R.note, /^No candidate passes (the full check )?with these locks and ranges \(.*Bottom flange thickness t_b … to 0.75.*\): governing [\w-]+ [A-Z]+\d+/, R.note);
});

test('No framing: the brace points are the stiffener layout\'s cross-frames, as the Flexure tab (L_b hand check)', () => {
  // built-in 110-140-110 ft, no Spans & framing setup, cross-frames entered on the Stiffeners tab at 30, 60, 90, 130, 170, 210, 250, 290, 330 ft.
  //   x = 44 ft lies between the brace points 30 and 60 ft: L_b = 60 − 30 = 30.00 ft (before this PR: frames.Lb = 25 ft, ⌈110/25⌉ = 5 equal
  //   bays, L_b = 110/5 = 22.00 ft); x = 249.99 ft (left of Pier 2): L_b = 250 − 210 = 40.00 ft (before: 140/⌈140/25⌉ = 140/6 = 23.33 ft).
  const P = M.defaultProject(); delete P.framing; P.stiffeners.layout.frames.at = [30, 60, 90, 130, 170, 210, 250, 290, 330];
  const ev = AD.evaluate(J(P), { level: 'full' }), G = ev.mods.flex0, row = x => G.rows.find(r => Math.abs(r.x - x) < 1e-6);
  assert.equal(row(44).Lb, 30); assert.equal(row(249.99).Lb, 40);
  const FX = W.SBDFlexureUI.build({ P: J(P), g: 0, src: 'analysis' });
  assert.deepEqual(plain(G.rows.map(r => [r.x, r.Lb, r.checks.map(c => c.ratio)])), plain(FX.rows.map(r => [r.x, r.Lb, r.checks.map(c => c.ratio)])));
  // Auto design does not add a framing to such a project (its candidates keep the stiffener layout's cross-frames)
  assert.equal(AD.projectWith(P, AD.layoutOf(P)).framing, undefined);
});

test('Auto finds a passing design on recorded projects (the re-run parity designs, re-checked with their details)', async () => {
  const DIR = path.join(ROOT, 'tests/projects/sbd2-autodesign'), { plProject, loadsRec, sbd2FromPL } = await import('./ad-fixture.mjs');
  const { legacyContext } = await import('./legacy-closure.mjs'), { plDecl } = await import('./pl-source.mjs'), { gdDecl } = await import('./gd-source.mjs');
  const PLDEF = J(legacyContext(['DEFAULT'], n => plDecl(n) || gdDecl(n)).ev('DEFAULT'));
  for (const name of ['builtin_AASHTO', 'util_AASHTO']) {
    const rec = JSON.parse(fs.readFileSync(path.join(DIR, `ad_${name}.json`), 'utf8')), [pr, ow] = name.split('_');
    assert.ok(rec.ad && rec.ad.pass && rec.ad.det, `${name}: a recorded passing design with its details`);
    const P = sbd2FromPL(plProject(pr, ow, PLDEF), loadsRec(pr, ow), M), L = AD.layoutOf({ ...P, girders: [{ ...P.girders[0], segments: rec.ad.segments }] });
    L.nb = rec.ad.nb; L.minLines = rec.ad.minLines ?? null; L.oh = rec.ad.oh || null;
    const E2 = AD.evaluate(AD.projectWith(P, L, { inputs: rec.ad.det }), { level: 'full', ctx: {} });
    assert.ok(E2.pass, `${name}: ${JSON.stringify(E2.fails.slice(0, 3).map(f => [f.mod, f.id, f.title, f.r]))}`);
  }
});

test('Overhang variable: the deck width closes, b_eff, LLDF, dead loads and the bracket width follow; limits; pickOh', () => {
  // the built-in cross-section: 5 girders, bays 4 × 9.5 = 38 ft, overhangs 3.25 ft: W_deck = 3.25 + 38 + 3.25 = 44.50 ft; an exterior plate girder added
  const P = M.defaultProject(); P.girders.push({ ...J(P.girders[0]), id: 'G0', label: 'G0', position: 'exterior', line: 0, beff: 12 * (9.5 / 2 + 3.25) });
  P.autodesign = { mode: 'new' }; const S = AD.settings(P), L0 = AD.layoutOf(P);
  assert.equal(S.V.oh.mode, 'auto');
  // oh = 3.5 ft both sides, N_b = 5: S = (44.50 − 2(3.5))/4 = 9.375 ft; b_eff interior 12(9.375) = 112.50 in, exterior 12(9.375/2 + 3.5) = 98.25 in;
  // bracket deck width 30 + 12(3.5 − 3.25) = 33.00 in (GirderDetail's default 30 in moved with the overhang)
  const Q = AD.projectWith(P, { ...L0, oh: { L: 3.5, R: 3.5 } });
  assert.equal(JSON.stringify(Q.xs.bays), '[9.375,9.375,9.375,9.375]'); assert.equal(Q.xs.ohL + Q.xs.bays.reduce((a, v) => a + v, 0) + Q.xs.ohR, 44.5);
  assert.equal(Q.girders[0].beff, 112.5); assert.equal(Q.girders[1].beff, 98.25); assert.equal(Q.constr.oh.wOH, 33);
  // the exterior girder's LLDF (lever rule, d_e) and dead loads come from the loads module on the new cross-section
  const AN = W.SBDAnalysis, gx = (X, k) => AN.dfOf(X, X.girders[1], 3, AN.moduleOf(X, 1)).spans[0][k], dl = X => AN.loadsOf(X, X.girders[1], AN.moduleOf(X, 1));
  assert.ok(gx(Q, 'gM') !== gx(P, 'gM'), 'exterior g_M changes with the overhang'); assert.ok(dl(Q).DC1wet !== dl(P).DC1wet, 'exterior DC1 changes');
  // limits (AASHTO: Preliminary sizing's G6, min(0.40S, 4.0 ft)): oh = 3.5: S = 9.375, 0.40S = 3.75 ≥ 3.5 in; oh = 4.0: S = 9.125, 0.40S = 3.65 < 4.0 out
  near(AD.ohLimit(P, S, 9.375, 6).hi, 3.75, 1e-12, 'AASHTO limit');
  assert.equal(JSON.stringify(AD.ohCands(P, S, L0, 5).map(o => o.L)), '[1.5,2,2.5,3,3.5]');
  // RIDOT 9.4.1.4: min(d, S/2, 4 ft; 3 ft if d < 5 ft): d = 4.9 ft → 3 ft; d = 6 ft, S = 9.375 → min(6, 4.6875, 4) = 4 ft
  const R = J(P); R.ownerRules.owner = 'RIDOT'; const SR = AD.settings(R);
  near(AD.ohLimit(R, SR, 9.375, 4.9).hi, 3, 1e-12, 'RIDOT d < 5 ft'); near(AD.ohLimit(R, SR, 9.375, 6).hi, 4, 1e-12, 'RIDOT'); assert.ok(AD.ohLimit(R, SR, 9.375, 6).shall);
  // the overhang is Lock only without an exterior plate girder (nothing would check it), and in Refine
  assert.equal(AD.settings(M.defaultProject()).V.oh.mode, 'lock');
  const Pr = J(P); Pr.autodesign = { mode: 'refine' }; assert.equal(AD.settings(Pr).V.oh.mode, 'lock');
  // pickOh: the pair with the lowest screen ratio of the starting design
  const ctx = { L0, ll: new Map() }, it = AD.pickOh(P, S, 5, ctx); let st; while (!(st = it.next()).done);
  const rs = AD.ohCands(P, S, L0, 5).map(o => [o.L, AD.evaluate(AD.projectWith(P, { ...L0, nb: 5, oh: o }), { level: 'screen', ctx }).ratio]), mn = Math.min(...rs.map(q => q[1]));
  assert.equal(st.value.L, rs.find(q => q[1] === mn)[0], JSON.stringify(rs));
});
