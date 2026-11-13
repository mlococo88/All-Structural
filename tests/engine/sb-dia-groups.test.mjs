// SB-24 (2026-11-13; engineer decision SB-24): apps/steel-bridge engine/crossframes.js diaGroups / grpShape / diaGrpChecks, pointLoads, engine/sheets.js
// cfDetail, ui/framing.js setBrace / grpCard — the diaphragm shape per bay depth group (crossframes.dia.grp). With girder types whose bays form two
// or more depth groups (bayGroups: the same h and shallower girder depth d), each group's diaphragm is checked (CFD; CFE when the end diaphragm takes
// the intermediate shape) with its own shape on its own frame (the group's h, d and bays), weighed in DC1 with it and drawn with it; the worst group
// governs. One depth group (equal depths, one type, a project saved before girder types, every bay the same shallower girder): exactly as before.
// Absent field (every project saved before): dia.shape in every group.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, CF = W.SBDCrossframes, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const dia = (P, sh, grp) => { Object.assign(P.crossframes.dia, { on: 'yes', shape: sh }); if (grp) P.crossframes.dia.grp = grp; return P; };
const run = (P, gi = 0) => { const B = FUI.build({ P: J(P), g: gi }); return { B, C: B.C, d: B.C.find(c => c.id === 'CFD'), e: B.C.find(c => c.id === 'CFE') }; };
const dep = c => c.items.filter(i => /Depth \(6\.7\.4\.2/.test(i.loc));
const sheet = P => { const G = W.SBDDrawings.model(J(P)), R = W.SBDSheets.build(G, null, { paper: 'D', only: ['cf'], date: '2026-11-13' }); return R.D.toDXF({ ltscale: 1 }); };

test('one depth group, equal depths, a project saved before girder types: no groups, a dia.grp entry has no effect (exactly as before)', () => {
  const one = M.newProject(); M.setLines(one, 0, [0, 1, 2, 3, 4]);
  for (const P0 of [two(30, 36), two(30, 30), one, M.defaultProject(), M.newProject()]) for (const gi of [0, 1]) { if (!P0.girders[gi]) continue;
    const P = dia(J(P0), 'W27x84'), Q = dia(J(P0), 'W27x84', { '0,3': 'W36x135', '1,2': 'W18x35', 0: 'W33x118' });
    assert.equal(CF.diaGroups(CF.inputsOf(P, { gi }).p), null);
    const a = run(P, gi), b = run(Q, gi); assert.equal(JSON.stringify(a.C), JSON.stringify(b.C)); assert.equal(JSON.stringify(a.B.R.steps), JSON.stringify(b.B.R.steps));
    assert.equal(JSON.stringify(a.B.XF), JSON.stringify(b.B.XF)); assert.equal(sheet(P), sheet(Q)); assert.ok(!a.d.items.some(i => /^G\d/.test(i.loc)));
  }
});

test('hand check, Exterior D = 30 / Interior 36 (two groups, both d_req = 28.41 in): W30x99 in the exterior bays, W27x84 in the interior bays', () => {
  const P = dia(two(36, 30), 'W30x99', { '1,2': 'W27x84' }), { B, d, e } = run(P, 0), D = dep(d);
  assert.deepEqual(J(CF.bayGroups(P).map(g => [g.bays, g.h, g.dg, CF.grpShape(P.crossframes.dia, g)])), [[[0, 3], 23, 31.88, 'W30x99'], [[1, 2], 28, 37.88, 'W27x84']]);
  assert.equal(D.length, 2); assert.match(D[0].loc, /^G1–G2, G4–G5 \(W30x99\): /); assert.match(D[1].loc, /^G2–G3, G3–G4 \(W27x84\): /);
  // 0.75 max(31.88, 37.88) = 28.41 in each group; W30x99 d = 29.70: 0.957 OK; W27x84 d = 26.70: 1.064 warning; the worst group governs
  assert.ok(Math.abs(D[0].demand - 28.41) < 1e-9 && D[0].capacity === 29.7 && D[0].st === 'pass'); assert.ok(Math.abs(D[1].demand - 28.41) < 1e-9 && D[1].capacity === 26.7 && D[1].st === 'warn');
  assert.equal(d.status, 'fail', 'the bolted connection of the default inputs fails in both groups (as with one shape)');
  // M_w = F_w d with each group's d: 1.808 × 31.88 = 57.64, × 37.88 = 68.49 kip-in
  const mw = J(d.items.filter(i => /flexure M_w/.test(i.loc)).map(i => +i.demand.toFixed(2))); assert.deepEqual(mw, [57.64, 68.49]);
  // CFE per group too (no end shape entered); the steps of each group, every item's step present, ids unique
  assert.ok(e.items.some(i => /^G2–G3, G3–G4 \(W27x84\): Depth/.test(i.loc)));
  const ids = B.R.steps.map(s => s.id); assert.equal(new Set(ids).size, ids.length, 'unique step ids');
  [d, e].forEach(c => c.items.forEach(i => assert.ok(!i.step || ids.includes(i.step), `${i.loc}: ${i.step}`)));
  assert.ok(ids.includes('cf.cfd.g1.dep') && ids.includes('cf.cfd.g2.dep') && ids.includes('cf.cfe.g2.dep'));
  // CF10: the bracing in use per group
  assert.equal(B.C.find(c => c.id === 'CF10').items[0].cells[3], 'by bay depth group (SB-24): G1–G2, G4–G5: rolled diaphragm W30x99; G2–G3, G3–G4: rolled diaphragm W27x84');
  // DC1: W = A(S − 2g)(0.2836/1000)(1.10), S − 2g = 114 − 4 = 110 in: W30x99 A = 28.817 in² → 0.9889 kip; W27x84 A = 24.442 in² → 0.8387 kip
  const w = J([...new Set(B.XF.pts.map(q => q.W.toFixed(4)))].sort()); assert.deepEqual(w, ['0.8387', '0.9889']);
  // the Drawings sheet: each group's detail drawn and noted with its shape
  const t = sheet(P); assert.match(t, /DIAPHRAGM W30x99 ASTM A709[^\n]*\n/); assert.match(t, /DIAPHRAGM W27x84 ASTM A709/);
});

test('absent dia.grp with two or more groups: dia.shape in every group (the migration); the checks per group, the worst governs', () => {
  const P = dia(three(30, 36, 42), 'W36x135'), { B, d } = run(P, 1), D = dep(d);
  assert.deepEqual(J(D.map(i => [i.loc.split(':')[0], +i.demand.toFixed(2), i.capacity, +i.r.toFixed(3)])), [['G1–G2, G5–G6 (W36x135)', 28.41, 35.6, 0.798], ['G2–G3, G4–G5 (W36x135)', 32.91, 35.6, 0.924], ['G3–G4 (W36x135)', 32.91, 35.6, 0.924]]);
  assert.equal(B.C.find(c => c.id === 'CF10').items[0].cells[3], 'rolled diaphragm W36x135', 'one shape: the text as before');
  assert.equal(B.XF.X.ab, undefined, 'DC1 as before (no per-bay area)');
});

test('three types 30 / 36 / 42: turning the W diaphragm on prefills the CF10 per-group sections; checks, DC1 and drawing per group', () => {
  // SB-25 (2026-11-13): with the default fit clearance c = 2 in, CF10's fit is d ≤ D_0 − 2 (W30x99 29.70 > 28, W36x135 35.60 > 34); SB-27
  // (2026-11-13): the groups with no section meeting both the depth and the fit take the nearest (the deepest that fits: W27x84, W33x118;
  // was no entry, { 2: 'W36x135' }); with c = 0 (the fit of #1490 / #1503, d ≤ D_0) the prefill of before
  { const Q = three(30, 36, 42); FUI.setBrace(Q, 'w'); assert.deepEqual(J(Q.crossframes.dia.grp), { '0,4': 'W27x84', '1,3': 'W33x118', 2: 'W36x135' }); }
  const P = three(30, 36, 42); P.crossframes.dia.clr = 0; FUI.setBrace(P, 'w'); assert.deepEqual(J(P.crossframes.dia.grp), { '0,4': 'W30x99', '1,3': 'W36x135', 2: 'W36x135' });
  const { B, d } = run(P, 1), D = dep(d);
  assert.deepEqual(J(D.map(i => [i.loc.split(':')[0], +i.demand.toFixed(2), i.capacity, +i.r.toFixed(3)])), [['G1–G2, G5–G6 (W30x99)', 28.41, 29.7, 0.957], ['G2–G3, G4–G5 (W36x135)', 32.91, 35.6, 0.924], ['G3–G4 (W36x135)', 32.91, 35.6, 0.924]]);
  assert.equal(P.crossframes.dia.shape, 'W36x135', 'SBSP: Shape set to the governing group\'s shape at the prefill');
  assert.deepEqual(J(B.XF.X.ab.map(a => a && a.nm)), ['W30x99', null, null, null, 'W30x99'], 'X.ab: the bays whose group shape differs from Shape (W36x135, SBSP); the weights as before');
  const t = sheet(P); assert.match(t, /DIAPHRAGM W30x99 ASTM/); assert.match(t, /DIAPHRAGM W36x135 ASTM/);
  // a group set back to "Same as Shape above" removes its entry; the last removes the field
  FUI.onChange({ dataset: { dgrp: '0,4' }, value: '' }, P); assert.deepEqual(J(P.crossframes.dia.grp), { '1,3': 'W36x135', 2: 'W36x135' });
  FUI.onChange({ dataset: { dgrp: '1,3' }, value: '' }, P); FUI.onChange({ dataset: { dgrp: '2' }, value: '' }, P); assert.equal(P.crossframes.dia.grp, undefined);
  FUI.onChange({ dataset: { dgrp: '2' }, value: 'W33x118' }, P); assert.deepEqual(J(P.crossframes.dia.grp), { 2: 'W33x118' });
  // an entry that is not a shape of the lists, or of a grouping that no longer exists: dia.shape, kept in the file
  P.crossframes.dia.grp = { '0,4': 'W99x999', '0,1,2': 'W30x99' }; const g = CF.bayGroups(P);
  assert.deepEqual(J(g.map(x => CF.grpShape(P.crossframes.dia, x))), ['W36x135', 'W36x135', 'W36x135']); assert.deepEqual(J(P.crossframes.dia.grp), { '0,4': 'W99x999', '0,1,2': 'W30x99' });   // SBSP: dia.shape is W36x135 since the prefill (was W21x44)
  // the input card: one select per group, the CF10 section marked
  const h = { num: () => '', sel: () => '', card: (t, b) => b, esc: s => String(s) }, html = FUI.inputs(P, h);
  assert.match(html, /data-dgrp="0,4"/); assert.match(html, /W30x99 \(CF10 recommends\)/);
});

test('one group with Interior 30 / Exterior 36: W30x99 0.957, W27x84 1.064 (as before: no groups)', () => {
  for (const [sh, r, st] of [['W30x99', 0.957, 'pass'], ['W27x84', 1.064, 'warn']]) { const D = dep(run(dia(two(30, 36), sh), 0).d);
    assert.equal(D.length, 1); assert.ok(!/^G\d/.test(D[0].loc)); assert.equal(+D[0].r.toFixed(3), r); assert.equal(D[0].st, st); }
});
