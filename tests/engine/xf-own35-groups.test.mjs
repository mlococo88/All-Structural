// OWN35G (2026-11-13; Decision pending engineer review): apps/steel-bridge engine/crossframes.js checks CF11 — the CTDOT channel table (OWN35, V2
// Table 6.7.4.2-1: web D 21–24 in C12x20.7, 27–30 in C15x33.9, 33–36 in MC18x42.7) was read with the web depth of the one frame checked; it is now
// applied to every bay depth group (bayGroups / diaGroups) with the group's own web depth and its diaphragm shape (SB-24): every group must
// satisfy it, the worst item governs CF11. Equal depths, one depth group or a project saved before girder types: one item, as before.
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
const setD = (P, gi, D) => P.girders[gi].segments.forEach(s => { s.D = D; });
const two = (Di, De) => { const P = M.newProject(); setD(P, 0, Di); setD(P, 1, De); return P; };
const three = (De, Dm, Dc) => { const P = M.newProject(); P.xs.nb = 6; P.xs.bays = [9.5, 9.5, 9.5, 9.5, 9.5];
  M.setLines(P, 1, [0, 5]); M.setLines(P, 0, [1, 4]); P.girders[0].label = 'Mid'; setD(P, 1, De); setD(P, 0, Dm);
  const c = M.addType(P, 0, { label: 'Core', lines: [2, 3] }); setD(P, c, Dc); return P; };
const ct = (P, sh, grp) => { P.ownerRules = { ...(P.ownerRules || {}), owner: 'CTDOT' }; Object.assign(P.crossframes.dia, { on: 'yes', shape: sh }); if (grp) P.crossframes.dia.grp = grp; return P; };
const tab = (P, gi = 0) => { const C = FUI.build({ P: J(P), g: gi }).C.find(c => c.id === 'CF11'); return { c: C, it: C.items.filter(i => /Table 6\.7\.4\.2-1/.test(i.loc)) }; };

test('equal depths, one depth group, saved before girder types: one item, as before', () => {
  for (const P of [ct(two(30, 30), 'C15x33.9'), ct(two(30, 36), 'C15x33.9'), ct((() => { const P = M.defaultProject(); setD(P, 0, 30); return P; })(), 'C15x33.9')]) for (const gi of [0, 1]) { if (!P.girders[gi]) continue;
    const { it } = tab(P, gi); assert.equal(it.length, 1); assert.equal(it[0].loc, 'Intermediate channel diaphragm (Table 6.7.4.2-1)'); }
  const { it } = tab(ct(two(30, 36), 'C15x33.9')); assert.deepEqual(J(it[0].cells), ['C15x33.9', 'C15x33.9 for D = 30.00 in']); assert.equal(it[0].st, 'pass');
});

test('Exterior D = 30, Interior 36 (two groups): C15x33.9 meets the exterior bays (D = 30), not the interior (D = 36: MC18x42.7); per-group shapes satisfy both', () => {
  for (const gi of [0, 1]) {
    const { c, it } = tab(ct(two(36, 30), 'C15x33.9'), gi);
    assert.deepEqual(J(it.map(i => [i.loc, i.cells, i.st])), [
      ['Intermediate channel diaphragm (Table 6.7.4.2-1), bays G1–G2, G4–G5 (web D of G1 Exterior)', ['C15x33.9', 'C15x33.9 for D = 30.00 in'], 'pass'],
      ['Intermediate channel diaphragm (Table 6.7.4.2-1), bays G2–G3, G3–G4 (web D of G2 Interior)', ['C15x33.9', 'MC18x42.7 for D = 36.00 in'], 'adv']]);
    assert.equal(c.status, 'adv', 'the worst group governs (was pass: the frame checked, D = 30)');
    const q = tab(ct(two(36, 30), 'C15x33.9', { '1,2': 'MC18x42.7' }), gi); assert.deepEqual(J(q.it.map(i => i.st)), ['pass', 'pass']); assert.equal(q.c.status, 'pass');
  }
});

test('three types 24 / 30 / 30 (CTDOT, C15x33.9): G1–G2, G5–G6 need C12x20.7 (D = 24), the others C15x33.9', () => {
  const { it } = tab(ct(three(24, 30, 30), 'C15x33.9'), 1);
  assert.deepEqual(J(it.map(i => [i.cells[1], i.st])), [['C12x20.7 for D = 24.00 in', 'adv'], ['C15x33.9 for D = 30.00 in', 'pass']]);
});
