// apps/ps-bridge batch G6 (2026-11-15): the Nomenclature tab (ui/nomen.js), the old app's live variable reference (O:8815-8960).
//   (1) at least 80 symbols, each with a value for the default design (an engine value at its R path, or an input); (2) each § link names a
//   worked step that exists on its tab and shows that step's own value (the row's path = the step's R path where the step has one, else the
//   step's value = R at the row's path); (3) the shown text = the value at the old tab's decimals; (4) the search text matches symbols,
//   descriptions and articles. Display only: R unchanged.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBD,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['outkit', 'nomen'].map(n => path.join(APP, `ui/${n}.js`)), ...['fromtab', 'data'].map(n => path.join(APP, `report/${n}.js`)));
const at = (o, p) => String(p).split('.').reduce((a, k) => (a == null ? a : a[k]), o);
const WTAB = { sec: 'section', ld: 'loads', an: 'analysis', ls: 'losses', st: 'stresses', fx: 'flexure', sh: 'shear', ez: 'endzone', cb: 'camber', rt: 'rating' };

test('G6: ≥ 80 symbols, each a value; each § link to a step of its tab showing the step\'s value; R unchanged', () => {
  for (const P of [W.PSBModel.defaultProject(), (() => { const P = W.PSBModel.defaultProject(); P.base.opt.lossMethod = 'approx'; return P; })()]) {
    const B = W.PSBReportData.compute(P, null); assert.equal(B.err, '');
    const R0 = JSON.stringify(B.R), ctx = { P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} }, G = W.PSBUiNomen.GROUPS;
    const rows = G.flatMap(g => g[1]); assert.ok(rows.length >= 80, 'rows ' + rows.length);
    const html = W.PSBUiNomen.output(ctx);
    assert.equal((html.match(/<tr data-nm=/g) || []).length, rows.length);
    let nLinks = 0;
    for (const e of rows) {
      const step = typeof e[4] === 'string' ? e[4] : null;
      if (step) {
        const w = B.W[WTAB[step.split('.')[0]]], s = w && w.steps.find(q => q.id === step);
        if (!s) { assert.ok(/^ls\.ref\./.test(step) && B.inp.opt.lossMethod === 'approx', 'step ' + step); continue; }   // refined-loss steps: absent with the approximate method
        nLinks++; assert.ok(html.includes(`href="#st-${step}"`), 'link ' + step);
        const p = (w.paths && w.paths[step]) || e[3], v = at(B.R, p);
        if (v === undefined && step === 'ld.eta') { assert.equal(s.value, 1); assert.ok(!B.R.own); continue; }   // no owner rule: η = 1 (the step's value shown)
        assert.ok(Object.is(s.value, v) || Math.abs(s.value - v) <= 1e-9 * Math.max(1, Math.abs(v)), `${step}: step ${s.value} vs R.${p} ${v}`);
      }
      if (e[3] && !e[3].inp) { const v = at(B.R, e[3]); if (!(step && /^ls\.ref\./.test(step) && B.inp.opt.lossMethod === 'approx')) assert.ok(typeof v === 'number' && Number.isFinite(v), `${e[1]}: R.${e[3]} = ${v}`); }
    }
    assert.ok(nLinks >= 60, 'links ' + nLinks);
    assert.equal(JSON.stringify(B.R), R0, 'R unchanged');
  }
});

test('G6: the shown text: the old tab\'s decimals (≥ 100: 0, ≥ 10: 1, else 3), moments ÷ 12 to kip-ft; inputs from the inputs', () => {
  const B = W.PSBReportData.compute(W.PSBModel.defaultProject(), null), html = W.PSBUiNomen.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });
  const f = (v, d) => v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  assert.ok(html.includes(`<span data-ev="cp.Ic" data-d="0">${f(B.R.cp.Ic, 0)}</span>`));
  assert.ok(html.includes(`<span data-ev="cp.n" data-d="3">${f(B.R.cp.n, 3)}</span>`));
  assert.ok(html.includes(`<span data-ev="MuMid" data-d="0" data-div="12">${f(B.R.MuMid / 12, 0)}</span>`), 'M_u in kip-ft');
  assert.ok(html.includes(`<td>${f(+B.inp.mat.fc, 3)}</td>`), "f'c (an input)");
});

test('G6: the search text of each row holds its symbol, description and article', () => {
  const B = W.PSBReportData.compute(W.PSBModel.defaultProject(), null), html = W.PSBUiNomen.output({ P: B.P, inp: B.inp, R: B.R, W: B.W, ui: {} });
  assert.ok(html.includes('data-nm="ℓt transfer length 5.9.4.3.1"'));
  assert.ok(html.includes('data-nm="dfm live-load distribution factor, moment 4.6.2.2.2"'));
  assert.ok(/id="o_nmQ"/.test(html));
});
