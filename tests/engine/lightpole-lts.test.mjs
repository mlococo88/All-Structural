// apps/light-pole/lts-engine.js (window.LpLts): the AASHTO LRFDLTS mode of "Light Pole and Sign Post.html", checked against
// hand-worked values from AASHTO LRFDLTS 1st Ed. (2015) with 2017 Interim Revisions (docs/lts-mode-plan.md §2, §3.5).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test, ROOT } from './harness.mjs';

export function ltsEngine() {
  const ctx = { console, Math, JSON }; ctx.globalThis = ctx; vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared/steps.js'), 'utf8').replace(/^/, 'var window = globalThis;\n'), ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps/light-pole/lts-engine.js'), 'utf8'), ctx, { filename: 'lts-engine.js' });
  return ctx.LpLts;
}

/* ---------- LTS-1: Table 3.8-1 MRI, Table 3.4-1 combinations ---------- */
test('LTS-1: MRI per Table 3.8-1 (p. 3-5): Typical 300/700/700/1700, High 1700, Low 300; roadside sign 10 yr', () => {
  const L = ltsEngine();
  assert.deepEqual(['lt100', '100to1k', '1kto10k', 'gt10k'].map(a => L.mri('typical', a, false).mri), [300, 700, 700, 1700]);
  assert.deepEqual(['lt100', '100to1k', '1kto10k', 'gt10k'].map(a => L.mri('high', a, false).mri), [1700, 1700, 1700, 1700]);
  assert.deepEqual(['lt100', '100to1k', '1kto10k', 'gt10k'].map(a => L.mri('low', a, false).mri), [300, 300, 300, 300]);
  assert.equal(L.mri('high', 'gt10k', true).mri, 10);
  assert.equal(L.mri('typical', '1kto10k', false).fig, 'Fig. 3.8-1');
  assert.equal(L.mri('typical', 'gt10k', false).fig, 'Fig. 3.8-2');
  assert.equal(L.mri('low', 'gt10k', false).fig, 'Fig. 3.8-3');
  assert.equal(L.mri('typical', 'gt10k', true).fig, 'Fig. 3.8-4');
});

test('LTS-1: Table 3.4-1 (p. 3-3) factors: Strength I 1.25DC; Extreme I 1.1/0.9DC + 1.0W; Service I 1.0DC + 1.0W', () => {
  const L = ltsEngine(), C = Object.fromEntries(L.COMBOS.map(c => [c.key, c]));
  assert.deepEqual([C.S1.DC, C.S1.W, C.S1.ICE], [1.25, 0, 1.25]);
  assert.deepEqual([C.E1max.DC, C.E1max.W, C.E1max.ICE, C.E1max.wind], [1.1, 1.0, 0, 'extreme']);
  assert.deepEqual([C.E1min.DC, C.E1min.W, C.E1min.wind], [0.9, 1.0, 'extreme']);
  assert.deepEqual([C.SV1.DC, C.SV1.W, C.SV1.wind], [1.0, 1.0, 'service']);
  assert.equal(L.comboLabel(C.E1max), '1.1DC + 1.0W');
});

test('LTS-1: the tool loads the engine with a classic relative script tag', () => {
  const html = fs.readFileSync(path.join(ROOT, 'Light Pole and Sign Post.html'), 'utf8');
  assert.ok(html.includes('<script src="apps/light-pole/lts-engine.js"></script>'));
});
