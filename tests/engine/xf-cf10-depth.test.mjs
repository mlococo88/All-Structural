// SB-22 (2026-11-13; engineer decision SB-22): apps/steel-bridge engine/crossframes.js cfTypeRec — the channel or rolled W diaphragm CF10
// recommends meets the least depth of every bay (SB-19: f × the deeper of the two girders a bay connects), not only that of the shallower
// girder of the governing bay; where the one section is deeper than the web depth D_0 of the shallower girder of a bay depth group (the
// Drawings' grouping), a section per group. Projects saved before girder types and equal depths: as before (the before is re-computed here
// with the rule of origin/main: the lightest channel / first W with d ≥ frac × p.dg).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = p => path.join(ROOT, 'apps/steel-bridge', p);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'vehicles.js', 'moving-load.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/lldf.js', 'engine/loads.js',
  'engine/analysis.js', 'engine/framing.js', 'engine/crossframes.js', 'ui/framing.js'].map(E));
const M = W.SBDModel, CF = W.SBDCrossframes;
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
// three types on 6 lines: Exterior (G1, G6), Mid (G2, G5), Core (G3, G4)
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const c0 = P => { P.crossframes.dia.clr = 0; return P; };   // SB-25: the fit clearance c = 0 (the rule of #1490, d ≤ D_0)
const rec = (P, gi) => { const I = CF.inputsOf(P, { gi }), Env = CF.envOf(P); return { I, Env, TR: CF.cfTypeRec(I.p, Env) }; };
// origin/main's selection (cfTypeRec before SB-22): from frac × p.dg
const before = (p, Env) => { const r = Env.rule('dia.depth'), dg = +p.dg, f = r && dg < r.value.D - 1e-9 ? r.value.frac : 0.75, a = s => 2 * s[2] * s[3] + (s[1] - 2 * s[3]) * s[4];
  const ch = CF.CF_CH.filter(s => s[1] >= f * dg - 1e-9).sort((x, y) => a(x) - a(y))[0], w = CF.CF_DIA.find(s => s[1] >= f * dg - 1e-9); return { ch: ch && ch[0], w: w && w[0], req: f * dg }; };

test('projects saved before girder types and equal depths: the section as before, one section, no step', () => {
  const one = M.newProject(); M.setLines(one, 0, [0, 1, 2, 3, 4]);
  const sh = two(30, 30), shOne = M.newProject(); setD(shOne, 0, 30); M.setLines(shOne, 0, [0, 1, 2, 3, 4]);
  for (const P of [M.defaultProject(), M.newProject(), one, sh, shOne]) for (const gi of P.girders.map((_, i) => i)) {
    const { I, Env, TR } = rec(P, gi), b = before(I.p, Env);
    assert.equal(TR.ch, b.ch); assert.equal(TR.w, b.w); assert.ok(!TR.grp, 'one section');
    if (TR.req != null) assert.ok(Math.abs(TR.req - b.req) < 1e-12, `req ${TR.req} = ${b.req}`);
    const R = CF.compute(I.p, Env); assert.ok(!R.steps.some(s => s.id === 'cf.type'), 'equal depths: no SB-22 step'); assert.ok(!/SB-22/.test(CF.checks(R).find(c => c.id === 'CF10').note));
  }
  const { TR } = rec(sh, 0); assert.equal(TR.deep, false); assert.equal(TR.w, 'W27x84'); assert.equal(TR.rec, 'rolled diaphragm W27x84', 'equal D = 30: 0.75 × 31.88 = 23.91 in → W27x84 (W24x76 is 23.90)');
  assert.ok(!('req' in rec(M.defaultProject(), 0).TR), 'saved before girder types: no SB-22 fields');
});

test('the hand check: Interior D = 60, Exterior 66 (req 50.91 in) and 54 (46.41 in): a K-frame recommended, as before; no channel or W of the list deep enough', () => {
  for (const [De, req] of [[66, 50.91], [54, 46.41]]) for (const gi of [0, 1]) {
    const { I, Env, TR } = rec(two(60, De), gi), b = before(I.p, Env);
    assert.ok(Math.abs(TR.req - req) < 5e-3, `${De}: ${TR.req}`); assert.equal(TR.deep, true); assert.match(TR.rec, /^K \(bottom\)-frame/);
    assert.equal(TR.ch, undefined); assert.equal(TR.w, undefined); assert.equal(b.ch, undefined); assert.equal(b.w, undefined, 'before: none either (0.75 × d ≥ 41.91 in > W36x135 35.6 in)');
    const R = CF.compute(I.p, Env); assert.ok(!R.steps.some(s => s.id === 'cf.type'), 'no section recommended: no step');
  }
});

test('Interior D = 30, Exterior 36: W27x84 → W30x99 (0.75 × 37.88 = 28.41 in), the CFD depth check passes with it', () => {
  // SB-25 (2026-11-13): clearance c = 0, the fit of #1490 (d ≤ D_0); the default c = 2 in: tests/engine/sb-dia-fit.test.mjs
  for (const P of [c0(two(30, 36)), c0(two(36, 30))]) for (const gi of [0, 1]) {
    const { I, Env, TR } = rec(P, gi);
    assert.equal(I.p.dg, 31.88); assert.equal(before(I.p, Env).w, 'W27x84'); assert.ok(Math.abs(TR.req - 0.75 * 37.88) < 1e-9);
    assert.equal(TR.w, 'W30x99'); assert.equal(TR.rec, 'rolled diaphragm W30x99'); assert.ok(!TR.grp, 'W30x99 (29.70 in) fits D_0 = 30 in');
    const Q = JSON.parse(JSON.stringify(P)); Object.assign(Q.crossframes.dia, { on: 'yes', shape: TR.w }); const q = rec(Q, gi), R = CF.compute(q.I.p, q.Env), C = CF.checks(R);
    const dep = C.find(c => c.id === 'CFD').items.find(i => /Depth \(6\.7\.4\.2/.test(i.loc)); assert.equal(dep.st, 'pass');   // SB-24: Exterior 30 / Interior 36 has two depth groups (items prefixed with the group); each 28.41 in assert.ok(Math.abs(dep.demand - 28.41) < 1e-9 && dep.capacity === 29.7, `${dep.demand} ${dep.capacity}`);
    const st = R.steps.find(s => s.id === 'cf.type'); assert.ok(st, 'the step'); assert.ok(Math.abs(st.value - 28.41) < 1e-9); assert.match(st.sub, /0\.75\\max\(31\.88,\\ 37\.88\)|0\.75\\max\(37\.88,\\ 31\.88\)/);
    assert.match(st.note, /engineer decision SB-22/); assert.match(st.note, /W30x99 \(d = 29\.70 in/);
    assert.match(C.find(c => c.id === 'CF10').note, /SB-22/);
  }
});

test('three types (Exterior 30, Mid 36, Core 42): W36x135 does not fit the Exterior bays (D_0 = 30), a section per bay depth group', () => {
  const P = c0(three(30, 36, 42));   // SB-25: c = 0, the fit of #1490
  for (const gi of P.girders.map((_, i) => i)) {
    const { TR } = rec(P, gi);
    assert.ok(Math.abs(TR.req - 0.75 * 43.88) < 1e-9); assert.equal(TR.w, 'W36x135', 'the one section for every bay (the Diaphragm switch default)');
    assert.equal(JSON.stringify(TR.grp.map(g => [g.bays.join(), g.top, +g.req.toFixed(2), g.w && g.w[0]])), JSON.stringify([['0,4', 30, 28.41, 'W30x99'], ['1,3', 36, 32.91, 'W36x135'], ['2', 42, 32.91, 'W36x135']]));
    assert.equal(TR.rec, 'by bay depth (one section does not fit every bay): G1–G2, G5–G6: rolled diaphragm W30x99; G2–G3, G4–G5: rolled diaphragm W36x135; G3–G4: rolled diaphragm W36x135');
  }
  // no section fits a group: the text says so
  // SB-27 (2026-11-13): no section between 31.41 and 32.00 in: the nearest, W30x99 (was "no channel or W of the list between 31.41 and 32.00 in")
  const Q = c0(three(32, 40, 40)), { TR } = rec(Q, 1); assert.ok(TR.grp); assert.match(TR.rec, /G1–G2, G5–G6: rolled diaphragm W30x99: the nearest section, FAILS the depth requirement \(no channel or W of the list meets both the least depth 31\.41 in and the fit d ≤ D_0 − c = 32\.00 − 0\.00 = 32\.00 in; the deepest that fits, d = 29\.70 in, is 1\.71 in short, ratio 1\.058; SB-27\)/);
});

test('the Diaphragm switch (ui/framing.js setBrace) takes the section that meets every bay', () => {
  const P = two(30, 36); P.crossframes.dia.on = 'no'; P.crossframes.dia.shape = 'MC18x42.7';
  W.SBDFramingUI.setBrace(P, 'w'); assert.equal(P.crossframes.dia.shape, 'W27x84', 'SB-27: the fit always applied (c = 2 in): the nearest section W27x84 (was W30x99)');
  const P0 = c0(two(30, 36)); P0.crossframes.dia.on = 'no'; P0.crossframes.dia.shape = 'MC18x42.7'; W.SBDFramingUI.setBrace(P0, 'w'); assert.equal(P0.crossframes.dia.shape, 'W30x99', 'c = 0: W30x99 meets both');
});
