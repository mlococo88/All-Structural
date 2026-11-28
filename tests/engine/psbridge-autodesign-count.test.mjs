// apps/ps-bridge 2026-11-28 (PSAD-B, the engineer's choice of 2026-11-28, item 1): Auto design's girder count N_b (engine/autodesign.js
// vars.nb, counts, nbLock, applyLayout, layoutFor; run over several counts; apply with the layout).
//   1. absent = Lock: the run is the run before (the same result as vars.nb 'lock' entered);
//   2. counts(): Auto = the current count ± 1 with S within 3.5 … 16 ft and sLo / sHi; Range = min … max; locked for adjacent members,
//      NEXT beams, entered distribution factors / live load;
//   3. applyLayout: equal bays over W_cc, overhangs kept, the types re-assigned (the outer lines keep the exterior types), an entered b_eff
//      back to the calculated width; the engine inputs of the new layout carry the new S and N_b and the distribution factors follow;
//   4. a run over three counts (the section and the strengths locked): every candidate applied passes every check on every line, Apply
//      writes N_b, the bays and the types' lines and designs; the candidates are in the order of the total girder concrete; the default
//      choice is the count with the least concrete; candidates of different counts in two spans are refused.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  path.join(APP, 'ui/vizkit.js'), path.join(APP, 'ui/strands.js'));
const M = W.PSBModel, B = W.PSBBridge, AD = W.PSBAutoDesign, J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const CASES = Object.entries(TAB_CASES(() => M.defaultProject()));
const strip = R => J(R.spans.map(sp => sp.sections.map(e => ({ name: e.name, pass: e.pass, nb: e.nb, types: e.types.map(q => ({ why: q.res.why, best: q.res.best ? { N: q.res.best.N, nh: q.res.best.nh, rows: q.res.best.rows, harp: q.res.best.harp, fc: q.res.best.fc, fci: q.res.best.fci, gov: q.res.best.ev.gov } : null })) }))));
const FAST = { section: 'lock', conc: 'lock' };

test('Auto design, girder count: absent = Lock; the run equals the run with Lock entered', () => {
  const P = load(CASES.find(c => c[0].startsWith('AASHTO Type IV exterior'))[1]); assert.equal(AD.settings(P).vars.nb, 'lock');
  P.autodesign = { vars: FAST }; const a = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }));
  P.autodesign = { vars: Object.assign({ nb: 'lock' }, FAST) }; const b = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }));
  assert.equal(JSON.stringify(strip(a)), JSON.stringify(strip(b))); assert.deepEqual(J(a.nb.list), [P.xs.nb]); assert.equal(a.sel, undefined);
});

test('Auto design, girder count: counts() and the locks', () => {
  const P = load(M.newProject()), o = v => AD.settings({ autodesign: v });
  assert.deepEqual(J(AD.counts(P, o({ vars: { nb: 'auto' } })).list), [5, 4, 6], 'S = 12.0 and 7.2 ft');
  assert.deepEqual(J(AD.counts(P, o({ vars: { nb: 'auto' }, sLo: 8 })).list), [5, 4], 'sLo 8 ft: not 6 girders (7.2 ft)');
  assert.deepEqual(J(AD.counts(P, o({ vars: { nb: 'auto' }, sHi: 10 })).list), [5, 6], 'sHi 10 ft: not 4 girders (12 ft)');
  assert.deepEqual(J(AD.counts(P, o({ vars: { nb: 'range' }, nbMin: 4, nbMax: 7 })).list), [5, 4, 6, 7]);
  const P3 = J(P); P3.xs.nb = 3; P3.xs.bays = [3, 3]; assert.deepEqual(J(AD.counts(P3, o({ vars: { nb: 'auto' } })).list), [3], 'S = 6 / 1 = 6 ft for 2 girders: below 3 girders not tried; 4 girders S = 2 ft < 3.5 ft');
  const box = load(CASES.find(c => c[0].startsWith('box BIII-36 (39in), CTDOT plate'))[1]); assert.ok(/adjacent members/.test(AD.nbLock(box)));
  assert.deepEqual(J(AD.counts(box, o({ vars: { nb: 'auto' } })).list), [box.xs.nb]);
  const df = load(CASES.find(c => c[0].startsWith('AASHTO Type IV exterior'))[1]); assert.ok(/distribution factors entered/.test(AD.nbLock(df)));
  const ll = load(CASES.find(c => c[0] === 'simple, entered M_LL / V_LL')[1]); assert.ok(/live-load moment/.test(AD.nbLock(ll)));
  assert.equal(AD.nbLock(P), '');
});

test('Auto design, girder count: applyLayout (equal bays over W_cc, overhangs kept, types re-assigned, b_eff calculated); the LLDF follows', () => {
  const P = load(M.newProject()); B.setOvr(P, 0, Object.assign(B.effBase(P, 0), { beffAuto: false, beff: 100 }));
  const L4 = AD.layoutFor(P, 4).Q, L6 = AD.layoutFor(P, 6).Q;
  assert.deepEqual(J(L4.xs.bays), [12, 12, 12]); assert.deepEqual(J(L6.xs.bays), [7.2, 7.2, 7.2, 7.2, 7.2]); [L4, L6].forEach(Q => { assert.equal(Q.xs.ohL, 3); assert.equal(Q.xs.ohR, 3); });
  const ext = Q => B.types(Q).findIndex(T => /Exterior/.test(T.label));
  [L4, L6].forEach(Q => { const n = Q.xs.nb, lt = B.lineTypes(Q, 1); assert.equal(lt[1][0], ext(Q)); assert.equal(lt[n][0], ext(Q)); for (let g = 2; g < n; g++) assert.notEqual(lt[g][0], ext(Q));
    B.types(Q).forEach((T, k) => assert.notEqual(B.effBase(Q, k).beffAuto, false, 'b_eff calculated')); });
  assert.equal(B.effBase(P, 0).beffAuto, false, 'the project itself not changed');
  const R5 = W.PSBHoldDown.compute(W.PSBDesign.cellInputs(P, 0, 2)), R4 = W.PSBHoldDown.compute(W.PSBDesign.cellInputs(L4, 0, 2)), i4 = W.PSBDesign.cellInputs(L4, 0, 2);
  assert.equal(i4.S, 12); assert.equal(i4.nGirders, 4); assert.ok(R4.dfm > R5.dfm, `the moment DF follows the wider spacing (${R5.dfm} → ${R4.dfm})`);
});

test('Auto design, girder count Auto on the new project: candidates over 3 counts pass every check after Apply; the order; the default count; mixed counts refused', () => {
  const P = load(M.newProject()); P.autodesign = { vars: Object.assign({ nb: 'auto' }, FAST), topN: 3 };
  const R = AD.runSync(P, Object.assign(AD.settings(P), { fracs: [0.40, 0.44] })), sp = R.spans[0];
  assert.deepEqual(J(R.nb.list), [5, 4, 6]); assert.ok(sp.cands.length >= 2, 'candidates');
  const key = e => e.A * e.nb; sp.sections.forEach((e, i) => { if (i) assert.ok(key(sp.sections[i - 1]) <= key(e) + 1e-9, 'tried in the order of the girder concrete'); });
  sp.cands.forEach((c, i) => { const Q = J(P), A = AD.apply(Q, R, { 1: i }); assert.ok(!A.err && A.changed.length, 'applied');
    assert.equal(Q.xs.nb, c.nb); assert.ok(Q.xs.bays.every(b => Math.abs(b - 36 / (c.nb - 1)) < 1e-9));
    assert.deepEqual(J(W.PSBInputCheck.collect(Q).errors), [], 'no input error');
    B.results(Q, inp => W.PSBHoldDown.compute(J(inp))).cells.forEach(z => { assert.ok(!z.R.error); z.R.checks.forEach(q => assert.ok(q.pass, `N_b ${c.nb}: ${z.label} G${z.g}: ${q.n} ${q.r}`)); });
    assert.ok(Math.abs(c.W - B.cells(Q).reduce((a, z) => { const R1 = W.PSBHoldDown.compute(W.PSBDesign.cellInputs(Q, z.k, z.g)); return a + R1.g.wsw * (R1.L + 2 * (+B.effBase(Q, z.k).opt.endOh || 0) / 12); }, 0)) < 1e-6, 'W = the concrete of every girder'); });
  const w = n => Math.min(...sp.cands.filter(c => c.nb === n).map(c => c.W)); assert.equal(R.nb.pick, R.nb.list.filter(n => sp.cands.some(c => c.nb === n)).reduce((b, n) => w(n) < w(b) ? n : b));
  assert.equal(sp.cands[R.sel[1]].nb, R.nb.pick);
  const fake = { spans: [{ s: 1, cands: [{ nb: 4, types: [] }] }, { s: 2, cands: [{ nb: 5, types: [] }] }] }; assert.ok(AD.apply(J(P), fake, {}).err, 'mixed counts refused');
  console.log(`       (N_b Auto: ${R.runs} runs, ${(R.ms / 1000).toFixed(1)} s; candidates ${sp.cands.map(c => `N_b ${c.nb} ${c.name} ${c.types.map(q => q.res.best.N + '/' + q.res.best.nh).join(',')} W ${c.W.toFixed(1)} kip`).join('; ')}; default N_b ${R.nb.pick})`);
});
