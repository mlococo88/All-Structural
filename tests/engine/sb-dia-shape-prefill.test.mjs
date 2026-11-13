// SBSP (2026-11-13; Decision pending engineer review: display / input consistency): apps/steel-bridge ui/framing.js grpFill / govKey — when
// the Intermediate bracing choice prefills the diaphragm shape per bay depth group (SB-24), the main Shape (dia.shape) is set at that moment to
// the governing group's shape (of the groups prefilled, the largest least depth d_req; the first in bay order on ties). Before, Shape kept its
// old value (W21x44 of a new project). Every group without an entry takes Shape, so those groups are checked with the governing shape.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const fit = P => FUI.build({ P: J(P), g: 0 }).C.find(c => c.id === 'CFD').items.filter(i => /Fit between/.test(i.loc)).map(i => `${i.loc.split(':')[0]} ${i.st}`);

test('a new project (Shape W21x44), Rolled W diaphragm: Shape becomes the governing group\'s shape at the prefill', () => {
  const t = three(30, 36, 42); assert.equal(t.crossframes.dia.shape, 'W21x44'); FUI.setBrace(t, 'w');
  // SB-27 (2026-11-13): every group prefilled, the nearest section where none meets both the depth and the fit (was { 2: 'W36x135' }, Shape W36x135)
  assert.deepEqual(J(t.crossframes.dia.grp), { '0,4': 'W27x84', '1,3': 'W33x118', 2: 'W36x135' }); assert.equal(t.crossframes.dia.shape, 'W33x118', 'G2–G3, G4–G5 and G3–G4 tie at 32.91 in: the first in bay order');
  assert.deepEqual(J(fit(t)), ['G1–G2, G5–G6 (W27x84) pass', 'G2–G3, G4–G5 (W33x118) pass', 'G3–G4 (W36x135) pass'], 'every group fits (SB-27)');
  const c0 = three(30, 36, 42); c0.crossframes.dia.clr = 0; FUI.setBrace(c0, 'w');
  assert.deepEqual(J(c0.crossframes.dia.grp), { '0,4': 'W30x99', '1,3': 'W36x135', 2: 'W36x135' }); assert.equal(c0.crossframes.dia.shape, 'W36x135', 'G2–G3, G4–G5 and G3–G4 tie at 32.91 in: the first in bay order');
  // SB-27: the exterior groups take the nearest section (W27x84, W21x44); both groups tie at d_req, the first in bay order governs Shape
  const u = two(36, 30); FUI.setBrace(u, 'w'); assert.deepEqual(J(u.crossframes.dia.grp), { '0,3': 'W27x84', '1,2': 'W30x99' }); assert.equal(u.crossframes.dia.shape, 'W27x84');
  const ct = three(24, 30, 30); ct.ownerRules = { owner: 'CTDOT' }; FUI.setBrace(ct, 'w'); assert.deepEqual(J(ct.crossframes.dia.grp), { '0,4': 'W21x44', '1,2,3': 'W27x84' }); assert.equal(ct.crossframes.dia.shape, 'W21x44');
});

test('no prefill (one depth group, equal depths, a project saved before types, channels with no fitting section): Shape as before', () => {
  for (const [P, v, sh] of [[two(30, 36), 'w', 'W21x44'], [two(30, 30), 'w', 'W21x44'], [M.defaultProject(), 'w', 'W21x44'], [two(30, 36), 'w', 'W21x44']]) {   // SB-27: the three-type channel case now prefills (below)
    FUI.setBrace(P, v); assert.equal(P.crossframes.dia.shape, sh); assert.equal(P.crossframes.dia.grp, undefined); }
  // SB-27 (2026-11-13): channels, three types 30 / 36 / 42: no section meets both the depth and the fit in G1–G2, G5–G6 and G2–G3, G4–G5, so
  // they take the nearest channel MC18x42.7 (was no prefill); G3–G4 has W36x135 meeting both, so no channel entry (Shape)
  { const P = three(30, 36, 42); FUI.setBrace(P, 'ch'); assert.equal(P.crossframes.dia.shape, 'MC18x42.7'); assert.deepEqual(J(P.crossframes.dia.grp), { '0,4': 'MC18x42.7', '1,3': 'MC18x42.7' }); }
  // a project loaded with a diaphragm on and no grp: not rewritten (only setBrace prefills)
  const L = three(30, 36, 42); Object.assign(L.crossframes.dia, { on: 'yes', shape: 'W21x44' }); FUI.build({ P: L, g: 0 }); assert.equal(L.crossframes.dia.shape, 'W21x44'); assert.equal(L.crossframes.dia.grp, undefined);
  // a later edit of a group select does not move Shape
  const E = three(30, 36, 42); FUI.setBrace(E, 'w'); FUI.onChange({ dataset: { dgrp: '0,4' }, value: 'W30x99' }, E); assert.equal(E.crossframes.dia.shape, 'W33x118');   // SB-27: Shape at the prefill W33x118
});
