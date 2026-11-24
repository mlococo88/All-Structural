// Steel Bridge app, Diaphragms / Cross-frames tab: the failing check shown on its worked step (SBDFH, 2026-11-24; engineer, approved:
// "when a card shows red FAIL, the failing check(s) must be highlighted red in the expanded steps too"). Display only: no value or verdict changes.
//   1. A passing C15x33.9 diaphragm (made-up shallow bridge): the topic chip of "Diaphragm (intermediate bracing), CFD" is the governing item's
//      D/C (was the slenderness Kℓ/r_min = 47.153 in red, read as a ratio), the slenderness step shows its limit and is not red.
//   2. A failing one (the fit d ≤ D_0 − c): every failing item links to a step with ok false, every passing item to a step with ok not false,
//      every item (but n/a) links to a step that exists; the chip is the failing item's ratio with NG; the tab's HTML marks that step red.
//   3. Cross-frame members: the slenderness steps (CF3) carry ok and their limit; a too-slender member's step is ok false; no {,} in labels / notes.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', ...['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js', 'engine/crossframes.js', 'ui/flexure.js', 'ui/framing.js'].map(E));
const CF = W.SBDCrossframes, FUI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
// made-up bridge: 9 plate girders 17.5 in deep (web D as entered), spacing 54 in, C15x33.9 channel diaphragms, default wind 130 mph
const bridge = D => { const p = J(CF.DEF); p.dia.on = 'yes'; p.dia.shape = 'C15x33.9'; p.dg = 17.5; p.S = 54; p.h = 15;
  Object.assign(p.sb, { D, ng: 9, L: 40, Mu: 150, bc: 8, bt: 8, tc: 0.75, tt: 0.75, tw: 0.4375 }); const R = CF.compute(p, null); return { R, C: CF.checks(R) }; };
const topic = (R, C, k) => FUI.groups('x', R.steps, C).find(t => t.key === k);
const linked = (R, C) => { const m = new Map(R.steps.map(s => [s.id, s])); return C.filter(c => /^CF[DE]$/.test(c.id)).flatMap(c => c.items.filter(i => i.st !== 'na').map(i => ({ c, i, s: m.get(i.step) }))); };

test('1. passing C15x33.9: the chip is the governing D/C, not Kℓ/r; the slenderness step shows its limit', () => {
  const { R, C } = bridge(17), c = C.find(x => x.id === 'CFD'), g = c.items[c.gov];
  assert.equal(c.status, 'pass');
  const t = topic(R, C, 'dia'), sl = R.steps.find(s => s.id === 'cf.cfd.ax.sl');
  assert.ok(sl.value > 47 && sl.value < 47.3, `Kℓ/r_min ${sl.value}`);
  assert.equal(t.chip, W.SharedSteps.fmt(g.r, 3)); assert.notEqual(t.chip, W.SharedSteps.fmt(sl.value, 3)); assert.notEqual(t.cls, 'ng');
  assert.equal(t.res.id, g.step, 'the one-line result is the governing item\'s step');
  assert.match(sl.sub, /= 47\.2\\ \\le\\ 140$/); assert.match(sl.note, /^47\.15 ≤ 140: OK/); assert.equal(sl.ok, true);
  // without the check items: the slenderness is still left out of the topic's ratio
  const t0 = topic(R, null, 'dia'); assert.ok(t0.ratio < 1, `ratio without items ${t0.ratio}`); assert.notEqual(t0.res.id, 'cf.cfd.ax.sl');
  linked(R, C).forEach(({ c, i, s }) => { assert.ok(s, `${c.id} ${i.loc}: step ${i.step}`); assert.notEqual(s.ok, false, `${c.id} ${i.loc}`); });
});

test('2. failing fit: the failing item\'s step is ok false and red; the chip names it', () => {
  const { R, C } = bridge(16), c = C.find(x => x.id === 'CFD'), g = c.items[c.gov];
  assert.equal(c.status, 'fail'); assert.equal(g.step, 'cf.cfd.fit'); assert.equal(+g.r.toFixed(3), 1.071);
  linked(R, C).forEach(({ c, i, s }) => { assert.ok(s, `${c.id} ${i.loc}: step ${i.step}`);
    if (i.st === 'fail') assert.equal(s.ok, false, `${c.id} ${i.loc}`); else if (i.st === 'pass') assert.notEqual(s.ok, false, `${c.id} ${i.loc}`); });
  const t = topic(R, C, 'dia'); assert.equal(t.chip, '1.071 NG'); assert.equal(t.cls, 'ng'); assert.equal(t.res.id, 'cf.cfd.fit');
  // the check steps added for items that had none: value = the item's ratio, the same number as the check table
  const bl = c.items.find(i => /^Bolt line/.test(i.loc)), s = R.steps.find(x => x.id === bl.step);
  assert.equal(bl.step, 'cf.cfd.ck.bl'); assert.ok(Object.is(s.value, bl.r)); assert.equal(s.ok, true);
});

test('3. cross-frame members: slenderness steps carry ok and the limit; no TeX {,} in plain-text labels / notes', () => {
  const q = J(CF.DEF); q.S = 200; const R = CF.compute(q, null), C = CF.checks(R), c3 = C.find(x => x.id === 'CF3');
  c3.items.forEach(i => { const s = R.steps.find(x => x.id === i.step); assert.equal(i.st, 'fail'); assert.equal(s.ok, false, i.step); assert.match(s.sub, /\\gt\\ 140$/); });
  const ok = CF.compute(J(CF.DEF), null); ok.steps.filter(s => /^cf\.(top|bot|diag)\.sl$/.test(s.id)).forEach(s => assert.equal(s.ok, true, s.id));
  for (const D of [16, 17]) { const { R: Rd } = bridge(D); Rd.steps.forEach(s => { assert.ok(!/\{,\}/.test(s.label), s.id); assert.ok(typeof s.note !== 'string' || !/\{,\}/.test(s.note), s.id); }); }
  const { R: Rb } = bridge(16); assert.match(Rb.steps.find(s => s.id === 'cf.cfd.bT').label, /= 6EI_x\/S = \d{1,3}(,\d{3})+$/);
});
