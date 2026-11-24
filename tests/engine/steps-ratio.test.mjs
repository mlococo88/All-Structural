// shared/steps.js (SSR, 2026-11-24): which test steps are demand / capacity ratios (the number on a topic's status chip, SharedSteps.group).
// Display only: the steps (values, ok flags) are never changed; only the chip, its class and the one-line result (summary) of a topic.
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';

const S = loadShared('steps.js').SharedSteps;
const mk = (id, o) => S.step({ id, label: id, ...o });
const one = (...st) => S.group(st, [{ key: 't', title: 'T', ids: () => true }], { strip: false })[0];

test('SSR: a unitless test step is a D/C ratio only when its ok flag agrees with value <= 1.0 (or it says so)', () => {
  // real ratios, as before
  let t = one(mk('a', { value: 0.95, unit: '', ok: true }), mk('b', { value: 0.40, unit: '', ok: true }));
  assert.equal(t.chip, '0.950'); assert.equal(t.cls, 'hi'); assert.equal(t.res.id, 'a'); assert.equal(t.ratio, 0.95);
  t = one(mk('a', { value: 1.20, unit: '', ok: false }), mk('b', { value: 0.40, unit: '', ok: true }));
  assert.equal(t.chip, '1.200 NG'); assert.equal(t.cls, 'ng'); assert.equal(t.res.id, 'a');
  t = one(mk('a', { value: 1.0004, unit: '', ok: true }));   // ok within a tolerance (ratio <= 1 + 1e-9, <= 1.0001): still a ratio, as before
  assert.equal(t.chip, '1.000'); assert.equal(t.cls, 'ng');   // red above 1 + 1e-9, as before
  t = one(mk('a', { value: Infinity, unit: '', ok: false }));   // no capacity: as before
  assert.equal(t.chip, '∞ NG'); assert.equal(t.cls, 'ng');
  // the #1692 case: a slenderness Kℓ/r = 47.15 <= 140 (ok) was a red "47.153"
  t = one(mk('sl', { value: 47.153, unit: '', d: 1, ok: true, sym: '\\frac{K\\ell}{r_{min}}' }));
  assert.equal(t.chip, 'OK'); assert.equal(t.cls, 'ok'); assert.ok(Number.isNaN(t.ratio)); assert.equal(S.summary(t, false), 'sl: Kℓ/(r_(min)) = 47.2');
  // beside a real ratio, the ratio gives the number; the slenderness its ok
  t = one(mk('sl', { value: 47.153, unit: '', ok: true }), mk('ia', { value: 0.62, unit: '', ok: true }));
  assert.equal(t.chip, '0.620'); assert.equal(t.cls, 'ok'); assert.equal(t.res.id, 'ia');
  // a factor of safety / rating factor >= its limit (ok): not a ratio > 1 (was red "2.100"); below its limit (not ok): NG, no number (was "0.800 NG")
  t = one(mk('fos', { value: 2.1, unit: '', ok: true })); assert.equal(t.chip, 'OK'); assert.equal(t.cls, 'ok');
  t = one(mk('rf', { value: 0.8, unit: '', ok: false })); assert.equal(t.chip, 'NG'); assert.equal(t.cls, 'ng'); assert.equal(t.res.id, 'rf'); assert.equal(S.summary(t, false), 'rf: 0.80');
  // declared: ratio false wins (a strain ε_t = 0.039 >= 0.005 was a green "0.039"); ratio true wins (a D/C with a limit below 1.0)
  t = one(mk('et', { value: 0.039, unit: '', d: 3, ok: true, ratio: false, sym: '\\epsilon_{t}' }));
  assert.equal(t.chip, 'OK'); assert.equal(S.summary(t, false), 'et: ε_t = 0.039');
  t = one(mk('sl', { value: 200, unit: '', ok: false, ratio: false })); assert.equal(t.chip, 'NG'); assert.equal(t.cls, 'ng');
  t = one(mk('r5', { value: 0.6, unit: '', ok: false, ratio: true })); assert.equal(t.chip, '0.600 NG'); assert.equal(t.cls, 'ng');
  // unchanged: a test step with a unit or a string value is never a ratio; a topic without tests has no chip
  t = one(mk('g', { value: 2.75, unit: 'in', ok: true })); assert.equal(t.chip, 'OK');
  t = one(mk('s', { value: 'yes', ok: true })); assert.equal(t.chip, 'OK');
  t = one(mk('v', { value: 3, unit: 'kip' })); assert.equal(t.chip, ''); assert.equal(t.cls, '');
});

test('SSR: step() keeps ratio only when it is given (every other step object as before)', () => {
  assert.equal(JSON.stringify(Object.keys(mk('a', { value: 1, ok: true }))), JSON.stringify(['id', 'label', 'sym', 'eq', 'sub', 'value', 'unit', 'd', 'ref', 'note', 'ok']));
  assert.equal(mk('a', { value: 1, ok: true, ratio: false }).ratio, false);
  assert.equal('ratio' in mk('a', { value: 1, ratio: 'x' }), false);
});
