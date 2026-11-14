// apps/ps-bridge PS-33 and PS-34 (engineer decisions 2026-11-14).
//   PS-33: the strand fit (PS-28, engine/inputcheck.js misfit) measures 1.5 in from a strand centre to a VOID face (exterior faces stay 2 in);
//   PS-39 (engineer decision 2026-11-14): 1.25 in (the MassDOT deep adjacent box beams' inner draped column, Part II dwg 10.2.8, p. 227).
//     (1) the CTDOT standard box patterns (plates 5.2.2 / 5.2.3, PDF p. 328 / 329), as far as contiguous centred rows represent them: the
//         bottom row at 2 in (16 strands, 36 series; 22, 48 series) and the second row at 4 in (14 / 20 between the webs, 16 / 22 with the
//         bottom strand of each web column) fit every box; the web columns above cannot be entered as rows (a centred row there is in the
//         void: an error), stated on the Girders & strands tab;
//     (2) the standard slab patterns (plates 5.1.3–5.1.6): the 2 in row (16 / 22 strands) fits every voided slab (SII: 1.5 in below the
//         Ø8 voids); the 4 in row has strands only between and outside the voids: a contiguous row there is an error (stated);
//     (3) the tab's note (the fit rule; the row model for boxes and slabs).
//   PS-34: the pier section's a ≤ t check against the family's thickness (engine/pierblock.js; a warning only): NEXT the stem depth h − ft,
//     box the bottom slab, voided slab the concrete below the voids, solid slab h; I-girders unchanged; no value but the warning changes.
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = n => ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', ...n, 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength'].map(f => path.join(APP, `engine/${f}.js`));
const UI = ['vizkit', 'outkit', 'strands', 'inputs', 'flexure'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG(['pierblock']), ...UI), W0 = loadShared('steps.js', ...PBD, ...ENG([]), ...UI);   // W0: without PS-34
const G = vm.runInContext('GIRDERS', W), IC = W.PSBInputCheck, J = v => JSON.parse(JSON.stringify(v));
const project = (girder, rows, harp) => { const P = W.PSBModel.newProject(); P.base.girder = girder; P.base.rows = rows.map(r => ({ nd: 0, dbnd: 0, ...r })); P.base.harp = { n: 0, yEnd: 8, yMid: 4, frac: 0.4, ...(harp || {}) };
  P.base.ts = 6; P.xs.bays = [4, 4, 4, 4]; P.spans.lengths = [60]; return P; };
const fitErrs = P => J(IC.collect(P).errors).filter(e => e.src === 'geometry' && /do not fit/.test(e.msg));
const BOXES = Object.keys(G).filter(k => G[k].box), SLABS = Object.keys(G).filter(k => G[k].deck && G[k].voids);

test('PS-33 (1): the CTDOT standard box patterns (plates 5.2.2 / 5.2.3): rows at 2 in and 4 in fit every box; the void face 1.5 in, the outer face 2 in', () => {
  assert.equal(IC.COVER, 2); assert.equal(IC.VOID, 1.25); assert.equal(BOXES.length, 8);   // PS-39
  for (const n of BOXES) {
    const s36 = G[n].w < 40, n1 = s36 ? 16 : 22, n2 = s36 ? 14 : 20;
    // bottom row: x = ±1 … ±15 (±21) in, 2.75 in from the 35.5 (47.5) in faces; second row at 4 in: 1.5 in below the void (5½ in slab)
    assert.deepEqual(fitErrs(project(n, [{ n: n1, y: 2 }, { n: n2, y: 4 }])), [], `${n}: ${n1} @ 2 in + ${n2} @ 4 in`);
    assert.deepEqual(fitErrs(project(n, [{ n: n1, y: 2 }, { n: n1, y: 4 }])), [], `${n}: ${n1} @ 2 in + ${n1} @ 4 in (with the web columns' bottom strands)`);
    // one more strand per row: 2 + 2 more on the 2 in grid = x ±17 (±23): 0.75 in from the face
    assert.match(fitErrs(project(n, [{ n: n1 + 2, y: 2 }]))[0].msg, /in from the edge of the concrete \(less than 2 in\)/, n);
    // a row at 4.5 in: 1 in below the void
    assert.match(fitErrs(project(n, [{ n: n1, y: 2 }, { n: 4, y: 4.5 }]))[0].msg, /is 1 in from a void \(less than 1\.25 in\)/, n);
    // the web columns (x = ±15 / ±21 in, from 2 in upward at 2 in) cannot be entered as centred rows: a row at 6 in is in the void
    assert.match(fitErrs(project(n, [{ n: n1, y: 2 }, { n: 2, y: 6 }]))[0].msg, /is inside a void/, n);
  }
});

test('PS-33 (2): the CTDOT slab patterns (plates 5.1.3–5.1.6): the 2 in row fits every voided slab; the 4 in row (strands between the voids) is not a contiguous row', () => {
  assert.equal(SLABS.length, 6);
  for (const n of SLABS) {
    const s36 = G[n].w < 40, n1 = s36 ? 16 : 22;
    assert.deepEqual(fitErrs(project(n, [{ n: n1, y: 2 }])), [], `${n}: ${n1} @ 2 in`);
    // the gapped 4 in row entered as one contiguous row of the same count meets a void (under or beside it)
    const e = fitErrs(project(n, [{ n: n1, y: 2 }, { n: s36 ? 8 : 12, y: 4 }]));
    // PS-39 / PS-40 (2026-11-14): on the SIV-48 the 12-strand row at 4 in now fits: x = ±11 is 1.27 in from the Ø12 voids at ±14.25 (bottom
    // at 4.5 in; 1.04 in from the voids at ±14 before), and 1.5 in below the Ø10 void
    if (n === 'AASHTO SIV-48 (21in)') { assert.equal(e.length, 0, n); continue; }
    assert.equal(e.length, 1, n); assert.match(e[0].msg, /from a void \(less than 1\.25 in\)|is inside a void/, n);
  }
  // SII-36 / SII-48: the Ø8 voids are 3.5 in above the soffit: the 2 in row is exactly 1.5 in below them (2 in before PS-33: rejected)
  const s = W.girderGross(W.PSBDesign.inputs(project('AASHTO SII-48 (15in)', [{ n: 22, y: 2 }]))), hp = W.halfPolygon(s), poly = hp.concat(hp.slice().reverse().map(p => [-p[0], p[1]]));
  assert.equal(IC.misfit(s, poly, { x: 1, y: 2 }), ''); assert.equal(IC.misfit(s, poly, { x: 0, y: 2.25 }), '', 'PS-39: 1.25 in below the void: fits');
  assert.equal(IC.misfit(s, poly, { x: 0, y: 2.5 }), 'is 1 in from a void (less than 1.25 in)');
});

test('PS-33 (3): the Girders & strands tab states the fit rule; for a box or a slab the row model (gapped rows, web columns entered as contiguous rows; height and count used)', () => {
  const html = P => W.PSBInputsUI.tab ? W.PSBInputsUI.tab('gird', P) : W.PSBInputsUI.cards('gird', P);
  const tb = html(project('AASHTO BIII-36 (39in)', [{ n: 16, y: 2 }])), ti = html(project('PCI BT-72', [{ n: 10, y: 2 }])), ts = html(project('AASHTO SIV-48 (21in)', [{ n: 22, y: 2 }]));
  [tb, ti, ts].forEach(t => assert.ok(t.includes('at least 2 in from its edges (PS-28) and at least 1.25 in from the face of a void (PS-39; 1.5 in before, PS-33)'), 'the rule'));
  assert.ok(tb.includes('Box beam: the standard strand patterns (CTDOT BDM plates 5.2.2 / 5.2.3) have strands in vertical columns in the webs; enter them as the nearest contiguous rows (same height and count). The results use only each row\'s height y and count n'));
  assert.ok(ts.includes('Deck slab: the standard strand patterns (CTDOT BDM plates 5.1.3–5.1.6) have rows with strands only between and outside the voids'));
  assert.ok(!/standard strand patterns/.test(ti), 'not for an I-girder');
});

/* PS-34: a continuous two-span design, deck bars A_s at the pier */
const cont = (girder, As, extra) => { const P = project(girder, [{ n: 16, y: 2 }]); P.spans = { lengths: [80, 80], continuity: 'composite' }; P.xs.skews = [0, 0, 0];
  P.base.cont = Object.assign({}, P.base.cont, { As }); Object.assign(P.base, extra || {}); return W.PSBDesign.inputs(P); };
const strip = R => { const o = J(R); delete o.ps34; delete o.warns; return o; };
test('PS-34: the pier block against the family thickness: box bottom slab, voided slab below the voids, solid slab h, NEXT stems; I-girders unchanged; only the warning changes', () => {
  const RE = /^Negative-moment compression block a = /;
  const run = inp => ({ R: W.PSBHoldDown.compute(J(inp)), R0: W0.PSBHoldDown.compute(J(inp)) });
  // BIII-36 (39 in): b_bf = 35.5 in; t = the 5½ in bottom slab. The engine's t_bf = d[2] = 0: it always warned.
  let { R, R0 } = run(cont('AASHTO BIII-36 (39in)', 16));
  assert.equal(R.error, null); assert.equal(R.cont.tbf, 0); assert.equal(R.cont.aOK, false, 'the engine values kept');
  assert.ok(Math.abs(R.cont.aN - R.cont.As * R.cont.fyr / (0.85 * cont('AASHTO BIII-36 (39in)', 16).mat.fc * 35.5)) < 1e-9, 'a = A_s f_y / (0.85 f′c b_bf), b_bf = 35.5 in');
  assert.deepEqual(J(R.ps34), { t: 5.5, what: 'the bottom slab', aN: R.cont.aN, aOK: R.cont.aN <= 5.5, engT: 0, engOK: false });
  assert.ok(R0.warns.some(w => RE.test(w)) && R0.warns.find(w => RE.test(w)).includes('(0.0″)'), 'before: warned against 0.0 in');
  assert.equal(R.warns.some(w => RE.test(w)), !R.ps34.aOK, 'after: warned only when a > 5.5 in');
  assert.deepEqual(strip(R), strip(R0), 'no other value changes');
  // a large A_s: a > 5.5 in: the warning names the bottom slab
  ({ R } = run(cont('AASHTO BIII-36 (39in)', 40)));
  assert.ok(R.cont.aN > 5.5); assert.ok(R.warns.some(w => /exceeds the bottom slab \(5\.5″, PS-34\)/.test(w)), R.warns.join(' | '));
  // SIV-48: the lowest void bottom 10.5 − 6 = 4.5 in; SIII-36: 9 − 5 = 4 in
  ({ R } = run(cont('AASHTO SIV-48 (21in)', 16))); assert.equal(R.ps34.t, 4.5); assert.equal(R.ps34.what, 'the concrete below the voids');
  ({ R } = run(cont('AASHTO SIII-36 (18in)', 16))); assert.equal(R.ps34.t, 4);
  // solid slab: h; NEXT 36F: 36 − 8 = 28 in (the engine: the 8 in top flange)
  ({ R } = run(cont('Deck slab 18×48 (solid)', 16))); assert.equal(R.ps34.t, 18); assert.equal(R.ps34.what, 'the slab depth h');
  ({ R, R0 } = run(cont('NEXT 36F', 16)));
  assert.equal(R.ps34.t, 28); assert.equal(R.ps34.engT, 8); assert.equal(R.ps34.what, 'the stem depth h − t_f'); assert.deepEqual(strip(R), strip(R0));
  // I-girder / bulb tee: unchanged (no ps34; the engine's own warning, if any)
  ({ R, R0 } = run(cont('PCI BT-72', 16))); assert.equal(R.ps34, undefined); assert.deepEqual(J(R), J(R0));
  ({ R, R0 } = run(cont('AASHTO Type III', 40))); assert.equal(R.ps34, undefined); assert.deepEqual(J(R.warns), J(R0.warns));
  // simple span: nothing
  const s = W.PSBHoldDown.compute(W.PSBDesign.inputs(project('AASHTO BIII-36 (39in)', [{ n: 16, y: 2 }]))); assert.equal(s.ps34, undefined);
});

test('PS-34: the Flexure tab and its worked step name the family thickness', () => {
  const inp = cont('AASHTO BIII-36 (39in)', 16), R = W.PSBHoldDown.compute(J(inp)), Wk = { flexure: W.PSBWorkedStrength.flexure(inp, R), shear: W.PSBWorkedStrength.shear(inp, R) };
  const h = W.PSBUiFlexure.output({ P: null, inp, R, W: Wk, ui: {} });
  assert.ok(h.includes('a against the bottom slab (PS-34)') && h.includes('data-ev="ps34.t"'), 'tab row');
  const st = Wk.flexure.steps.find(q => /^fx\.pier\.a$/.test(q.id));
  assert.ok(st && /a ≤ the bottom slab = 5\.50 in \(PS-34\)/.test(st.note || ''), st && st.note);
});
