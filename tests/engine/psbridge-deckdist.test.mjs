// apps/ps-bridge DD (2026-11-24, engineer request "Please fix the deck distribution steel"): the deck distribution reinforcement on the
// effective span length of AASHTO LRFD 10th Ed. Art. 9.7.2.3 (engine/deckdist.js, window.PSBDeckDist, after computeAll; the moved engine is
// not edited). Made-up designs from the app's default project.
//   1. only R.deck.distPct changes (and R.deck.dd is added): the page's whole result with and without the correction, value by value;
//   2. hand check (c): PCI BT-72 at 12 ft: S_eff = 12 - 42/12 + (42 - 6)/24 = 10.0 ft -> 67 % (the engine on the girder spacing: 63.51 %);
//   3. NEXT beams and box beams: 67 % (decision pending engineer review); the deck design off: nothing changes;
//   4. the anchors in the frozen engine's deckCalc; a changed engine value is an error, not a silent second correction;
//   5. the worked steps (S_eff, the percentage, A_s,d) carry the result's values; harness B's R path of the percentage is deck.distPct.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'deck.js', ...PBD, ...['sections', 'model', 'lldf-fg', 'deckdist', 'holddown', 'pierblock', 'design', 'fields', 'inputcheck', 'worked', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const design = (f) => { const P = W.PSBModel.defaultProject(); P.base.deck.on = true; if (f) f(P); assert.deepEqual([...W.PSBInputCheck.collect(P).errors.map(e => e.msg)], []); return P; };
/* the page's result with the correction and without it (PSBDeckDist removed for the call) */
function both(P) {
  const R = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)), keep = W.PSBDeckDist;
  W.PSBDeckDist = undefined; let R0; try { R0 = W.PSBHoldDown.compute(W.PSBDesign.inputs(P)); } finally { W.PSBDeckDist = keep; }
  return { R, R0 };
}
/* every leaf of a and b, by path; numbers by Object.is; functions left out */
function diff(a, b, at = '', out = [], seen = new Set()) {
  if (typeof a === 'function' || typeof b === 'function') return out;
  if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') { if (!Object.is(a, b)) out.push(at); return out; }
  if (seen.has(a)) return out; seen.add(a);
  new Set([...Object.keys(a), ...Object.keys(b)]).forEach(k => diff(a[k], b[k], at ? `${at}.${k}` : k, out, seen));
  return out;
}

test('hand check (c): PCI BT-72 at 12 ft, interior girder: S_eff 10.0 ft, 67 % (before 63.51 %); only deck.distPct differs (and deck.dd added)', () => {
  const P = design(P => { P.xs.bays = P.xs.bays.map(() => 12); }), { R, R0 } = both(P), inp = W.PSBDesign.inputs(P);
  assert.equal(inp.S, 12); assert.equal(R.g.btf, 42); assert.equal(R.g.bw, 6);
  const dd = R.deck.dd; assert.equal(dd.kind, 'I'); assert.equal(dd.clear, 8.5); assert.equal(dd.ohF, 1.5); assert.equal(dd.Seff, 10);
  assert.equal(R.deck.distPct, 67); near(R0.deck.distPct, 63.50853, 1e-5, '220/sqrt(12)'); assert.ok(Object.is(dd.pct0, R0.deck.distPct)); assert.equal(dd.changed, true);
  assert.deepEqual(diff(R, R0).filter(p => !p.startsWith('deck.dd')), ['deck.distPct']);
  // A_s,d with the default bottom bars (#5 at 6 in: A_s 0.620 in^2/ft): 0.67(0.620) = 0.4154 (before 0.63509(0.620) = 0.39375)
  const ST = W.PSBWorkedHDR.deck(inp, R), v = id => ST.steps.find(s => s.id === 'dk.' + id);
  near(R.deck.pos.As, 0.62, 1e-12); near(v('distAs').value, 0.4154, 1e-12); near(R0.deck.distPct / 100 * 0.62, 0.393753, 1e-6);
  assert.equal(v('distSe').value, 10); assert.equal(v('dist').value, 67); assert.match(v('dist').eq, /S_\{eff\}/);
  assert.equal(ST.paths['dk.dist'], 'deck.distPct'); assert.equal(ST.paths['dk.distSe'], undefined);
  ST.pairs.forEach(p => assert.ok(Math.abs(p.shown - p.engine) <= 1e-9 * Math.max(1, Math.abs(p.engine)), `${p.id}: ${p.shown} vs ${p.engine}`));
});

test('the default design (9 ft): S_eff 7.0 ft, 67 % before and after: the whole result identical apart from deck.dd', () => {
  const { R, R0 } = both(design());
  near(R.deck.dd.Seff, 9 - 3.5 + 1.5, 1e-12); assert.equal(R.deck.distPct, 67); assert.equal(R0.deck.distPct, 67); assert.equal(R.deck.dd.changed, false);
  assert.deepEqual(diff(R, R0).filter(p => !p.startsWith('deck.dd')), []);
});

test('the deck design off: the result is identical (no deck, nothing added)', () => {
  const { R, R0 } = both(design(P => { P.base.deck.on = false; P.xs.bays = P.xs.bays.map(() => 12); }));
  assert.equal(R.deck, null); assert.deepEqual(diff(R, R0), []);
});

test('NEXT beams and box beams: the 67 % upper limit (decision pending engineer review); the step says why', () => {
  [['NEXT 36F', 11.5], ['AASHTO BIII-36 (39in)', 12]].forEach(([gn, S]) => {
    const P = design(P => { P.base.girder = gn; P.xs.bays = P.xs.bays.map(() => S); P.base.harp.n = 0; P.base.rows = [{ n: 16, y: 2, nd: 0, dbnd: 0 }]; }), { R, R0 } = both(P);
    assert.equal(R.error, null, gn); assert.ok(R0.deck.distPct < 67, `${gn}: the engine below 67 % at S = ${S} ft`);
    assert.equal(R.deck.distPct, 67, gn); assert.equal(R.deck.dd.why, 'family'); assert.notEqual(R.deck.dd.kind, 'I');
    assert.deepEqual(diff(R, R0).filter(p => !p.startsWith('deck.dd')), ['deck.distPct'], gn);
    const ST = W.PSBWorkedHDR.deck(W.PSBDesign.inputs(P), R), s = ST.steps.find(q => q.id === 'dk.dist');
    assert.equal(s.eq, '67'); assert.match(s.note, /pending engineer review/); assert.ok(!ST.steps.some(q => q.id === 'dk.distSe'));
  });
});

test('the anchors in the frozen engine (deckCalc) are found once; a changed engine value is an error; apply twice is harmless', () => {
  const src = fs.readFileSync(path.join(APP, 'engine/pbd-handling-deck.js'), 'utf8');
  W.PSBDeckDist.anchors().forEach(a => assert.equal(src.split(a).length - 1, 1, a));
  const P = design(P => { P.xs.bays = P.xs.bays.map(() => 12); }), inp = W.PSBDesign.inputs(P);
  const R = W.computeAll(inp); R.deck.distPct = 60;
  assert.throws(() => W.PSBDeckDist.apply(inp, R), /not min\(220\/sqrt\(S\), 67\)|engine changed/);
  const R2 = W.PSBHoldDown.compute(inp), v = R2.deck.distPct; W.PSBDeckDist.apply(inp, R2); assert.ok(Object.is(R2.deck.distPct, v));
});
