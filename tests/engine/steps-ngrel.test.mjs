// shared/steps.js NGREL (2026-11-24; Steel Bridge Design, engineer-approved; display only): with SharedSteps.opt.ngRel on (the Steel Bridge
// app turns it on in ui/sub.js; every other tool leaves it off), a failing test step's substituted line prints the relation that holds:
// "33.75 \le 17.75" -> "33.75 \gt 17.75". Only one top-level \le / \ge between two plain numbers that violate it; the eq (the requirement),
// the value, the ok flag and the step object are never changed. Off: line() exactly as before.
import assert from 'node:assert/strict';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';
import { FILES, E } from './gfx-fixture.mjs';

const katex = (() => { const c = loadShared(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js')); return c.katex; })();

test('NGREL: ngRel() flips only a single violated top-level relation between plain numbers', () => {
  const S = loadShared('steps.js').SharedSteps, f = S.ngRel;
  assert.equal(f('35.05 + \\frac{0.00}{3} = 35.05 \\le 19.09'), '35.05 + \\frac{0.00}{3} = 35.05 \\gt 19.09');
  assert.equal(f('50.67 \\le 0.95(1.000)(50.00) = 47.50'), '50.67 \\gt 0.95(1.000)(50.00) = 47.50');
  assert.equal(f('0.80 \\ge 1.00'), '0.80 \\lt 1.00');
  assert.equal(f('1{,}200 \\le 1{,}100\\ \\text{kip}'), '1{,}200 \\gt 1{,}100\\ \\text{kip}');
  assert.equal(f('1.20 ≤ 1.00'), '1.20 > 1.00');
  assert.equal(f('5\\le4'), '5\\gt4');
  for (const t of ['10 \\le 20', '17.75 \\le 17.75', '2 + 3 \\le 4', '5 \\le 0.42D', '5 \\le 3;\\ 2 \\le 1', '1.75 \\le 2.75 \\le 2.63', '\\max(1,\\ 3 \\le 2)',
    '\\text{skew } 30° \\le 20°: no', '1.13 \\gt 0.00 \\le 5.00', '47.15 \\gt 40', '3 \\ne 2', '\\frac{3 \\le 2}{1}'])
    assert.equal(f(t), t, t);
});

test('NGREL: line() — off by default (unchanged), on only for a failing step; eq and the step object unchanged', () => {
  const S = loadShared('steps.js').SharedSteps;
  const s = { sym: 'f_{bu}', eq: '\\le \\phi_{f}F_{nc}', sub: '33.75 \\le 17.75', value: 'NG', ok: false }, c = JSON.stringify(s);
  assert.equal(S.opt.ngRel, false);
  assert.equal(S.line(s, false), 'f_(bu) ≤ φ_fF_(nc) = 33.75 ≤ 17.75, NG');
  S.opt.ngRel = true;
  assert.equal(S.line(s, false), 'f_(bu) ≤ φ_fF_(nc) = 33.75 > 17.75, NG');
  assert.match(S.line(s, true), /33\.75 (?:&gt;|>) 17\.75/);
  assert.equal(S.line({ ...s, ok: true }, false), 'f_(bu) ≤ φ_fF_(nc) = 33.75 ≤ 17.75, NG', 'not a failing step: as written');
  assert.equal(S.line({ ...s, ok: undefined }, false), 'f_(bu) ≤ φ_fF_(nc) = 33.75 ≤ 17.75, NG');
  assert.equal(JSON.stringify(s), c, 'the step object is not modified');
  assert.equal(S.line({ sym: 'D_{p}', eq: '\\le 0.42D_{t}', sub: '12.00 \\le 0.42(25.00) = 10.50', value: 12, d: 3, ok: false }, false), 'D_p ≤ 0.42D_t = 12.00 > 0.42(25.00) = 10.50 = 12.000');
});

test('NGREL: the Steel Bridge app turns it on (ui/sub.js); a made-up thin bridge: every failing comparison flipped parses in KaTeX', () => {
  const W = loadShared(...FILES, E('ui/constructibility.js'), E('ui/sub.js')), S = W.SharedSteps, all = [];
  assert.equal(S.opt.ngRel, true, 'ui/sub.js sets it');
  const s0 = S.step, w0 = S.work; S.step = o => { const s = s0(o); all.push(s); return s; };
  S.work = p => { const w = w0(p), a0 = w.add; w.add = o => { const v = a0(o); all.push(w.steps[w.steps.length - 1]); return v; }; return w; };
  const P = JSON.parse(JSON.stringify(W.SBDModel.defaultProject()));
  P.girders.forEach(g => g.segments.forEach(s => { s.tw = Math.max(0.4375, s.tw - 0.125); s.botT = Math.max(0.75, s.botT * 0.6); s.topT = Math.max(0.625, s.topT * 0.6); s.botB = Math.max(12, s.botB - 4); s.topB = Math.max(12, s.topB - 4); }));
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }); W.SBDReportBuild.model(B, { detail: 'all' });
  B.cn.rows.forEach(r => [r, r.alt].filter(Boolean).forEach(q => W.SBDConstrUI.stepsOf(B.cn, q)));   // the Constructibility tab's case steps
  const ids = new Set(); let n = 0;
  all.filter(s => s.ok === false && s.sub).forEach(s => { const t = S.ngRel(s.sub); if (t === s.sub) return; n++; ids.add(s.id.replace(/\d+/g, '#'));
    assert.ok(/\\gt|\\lt|[<>]/.test(t)); katex.renderToString(t, { throwOnError: true, macros: { '\\minus': '-' } }); });
  assert.ok(n > 50, `flipped ${n}`);
  for (const k of ['fx.fnc.ok', 'fx.svt.ok', 'fx.svb.ok', 'cn.buck.ok']) assert.ok(ids.has(k), k);
  console.log(`       ${n} failing comparisons flipped (${[...ids].sort().join(', ')})`);
});
