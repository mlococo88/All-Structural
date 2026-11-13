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
  assert.deepEqual(J(t.crossframes.dia.grp), { 2: 'W36x135' }); assert.equal(t.crossframes.dia.shape, 'W36x135', 'the only group prefilled (G3–G4)');
  assert.deepEqual(J(fit(t)), ['G1–G2, G5–G6 (W36x135) fail', 'G2–G3, G4–G5 (W36x135) fail', 'G3–G4 (W36x135) pass'], 'the groups without an entry take Shape');
  const c0 = three(30, 36, 42); c0.crossframes.dia.clr = 0; FUI.setBrace(c0, 'w');
  assert.deepEqual(J(c0.crossframes.dia.grp), { '0,4': 'W30x99', '1,3': 'W36x135', 2: 'W36x135' }); assert.equal(c0.crossframes.dia.shape, 'W36x135', 'G2–G3, G4–G5 and G3–G4 tie at 32.91 in: the first in bay order');
  const u = two(36, 30); FUI.setBrace(u, 'w'); assert.deepEqual(J(u.crossframes.dia.grp), { '1,2': 'W30x99' }); assert.equal(u.crossframes.dia.shape, 'W30x99');
  const ct = three(24, 30, 30); ct.ownerRules = { owner: 'CTDOT' }; FUI.setBrace(ct, 'w'); assert.deepEqual(J(ct.crossframes.dia.grp), { '1,2,3': 'W27x84' }); assert.equal(ct.crossframes.dia.shape, 'W27x84');
});

test('no prefill (one depth group, equal depths, a project saved before types, channels with no fitting section): Shape as before', () => {
  for (const [P, v, sh] of [[two(30, 36), 'w', 'W21x44'], [two(30, 30), 'w', 'W21x44'], [M.defaultProject(), 'w', 'W21x44'], [three(30, 36, 42), 'ch', 'MC18x42.7']]) {
    FUI.setBrace(P, v); assert.equal(P.crossframes.dia.shape, sh); assert.equal(P.crossframes.dia.grp, undefined); }
  // a project loaded with a diaphragm on and no grp: not rewritten (only setBrace prefills)
  const L = three(30, 36, 42); Object.assign(L.crossframes.dia, { on: 'yes', shape: 'W21x44' }); FUI.build({ P: L, g: 0 }); assert.equal(L.crossframes.dia.shape, 'W21x44'); assert.equal(L.crossframes.dia.grp, undefined);
  // a later edit of a group select does not move Shape
  const E = three(30, 36, 42); FUI.setBrace(E, 'w'); FUI.onChange({ dataset: { dgrp: '0,4' }, value: 'W27x84' }, E); assert.equal(E.crossframes.dia.shape, 'W36x135');
});
