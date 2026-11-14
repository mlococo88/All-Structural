// apps/ps-bridge PS-28 (engineer decision 2026-11-14, input validation): a strand pattern that does not fit the girder shape is a blocking
//   input error naming its row (engine/inputcheck.js fitOf). The positions are PSBStrandGfx.xy (ui/strands.js, the drawn positions, PS-27);
//   a strand fits when its centre is inside the concrete outline, not inside a void, and at least 2 in from every edge of the outline and of
//   every void (centre distances: the criterion of tests/engine/psbridge-strandgfx.test.mjs, fitsAt). Checked here:
//   (1) the criterion at hand-picked points; (2) collect's verdict = an independent copy of the PS-27 test's fitsAt over xy, for every shape of
//   the library (NEXT at the narrowest and widest flange), every row count up to two more than the engine's row capacity, the rows of a 2 in
//   grid, and draped strands; (3) the engineer's hand checks (AASHTO Type I with a 10-strand row; BI-36 with a row at y = 6 in); (4) the
//   defaults fit: a new project, the default project, the 19 designs of harness B; (5) a girder type's own shape (scoped error);
//   (6) an imported old-app design that does not fit opens with the error, its data kept as read; (7) nothing is written, the engine is
//   not involved (computeAll the same with and without the check loaded).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy'].map(n => path.join(APP, `engine/${n}.js`));
const W = loadShared(...PBD, ...ENG, ...['vizkit', 'strands'].map(n => path.join(APP, `ui/${n}.js`)));
const W0 = loadShared(...PBD, ...ENG);   // without ui/strands.js: the check is not made (the page always loads it, test 7)
const GIRDERS = vm.runInContext('GIRDERS', W);
const J = v => JSON.parse(JSON.stringify(v));
const IC = W.PSBInputCheck, M = W.PSBModel;
const fitErrs = P => J(IC.collect(P).errors.filter(e => /do not fit the /.test(e.msg)));

// an independent copy of the PS-27 test's criterion (tests/engine/psbridge-strandgfx.test.mjs: outline, inside, edgeDist, voidClear, fitsAt)
const COVER = 2, VOIDC = 1.25;   // PS-39 (2026-11-14; 1.5 in from PS-33): 1.25 in from a void face (strand centre); 2 in from the concrete edges
const outline = G => { const h = W.halfPolygon(G); return h.concat(h.slice().reverse().map(p => [-p[0], p[1]])); };
function inside(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function edgeDist(poly, x, y) { let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return d; }
function voidClear(G, x, y) { return W.sectionVoids(G).reduce((m, v) => Math.min(m, v.type === 'rect' ? Math.hypot(Math.max(Math.abs(x - v.x) - v.w / 2, 0), Math.max(Math.abs(y - v.y) - v.h / 2, 0)) * (Math.abs(x - v.x) <= v.w / 2 && Math.abs(y - v.y) <= v.h / 2 ? -1 : 1)
  : Math.hypot(x - v.x, y - v.y) - v.d / 2), Infinity); }
const fitsAt = (G, poly, q) => inside(poly, q.x, q.y) && edgeDist(poly, q.x, q.y) >= COVER - 1e-9 && voidClear(G, q.x, q.y) >= VOIDC - 1e-9;

/* a project of the library shape with the given strands (NEXT flange width from S) */
function project(girder, rows, harp, S) {
  const P = M.defaultProject(); if (S) P.xs.bays = P.xs.bays.map(() => S);
  Object.assign(P.base, { girder, rows: rows.map(r => ({ dbnd: 0, nd: 0, ...r })), harp: { ...P.base.harp, ...harp } }); return P;
}
/* the reference verdict: every strand xy draws for these inputs (at ℄ bearing and at midspan) fits, by the copy above */
function refFits(P) {
  const inp = W.PSBDesign.inputs(P), g = W.girderGross(inp), ss = W.strandSys(inp, g), R = { g, ss }, poly = outline(g);
  const pts = [...W.PSBStrandGfx.xy(R, ss.nh > 0 ? +ss.hp.yEnd : 0), ...W.PSBStrandGfx.xy(R, ss.nh > 0 ? +ss.hp.yMid : 0)];
  return pts.every(q => fitsAt(g, poly, q));
}
const SHAPES = Object.keys(GIRDERS).filter(k => k !== 'Custom').flatMap(k => (GIRDERS[k].next ? [[k, 8], [k, 12]] : [[k, null]]));

test('PS-28 (1): the criterion at hand-picked points (centre distances, 2 in; = 2 in fits)', () => {
  const g = n => W.girderGross(W.PSBDesign.inputs(project(n, [{ n: 1, y: 2 }], { n: 0 })));
  const T1 = g('AASHTO Type I'), p1 = outline(T1), mf = (G, p, x, y) => IC.misfit(G, p, { x, y });
  // Type I: bottom flange 16 in (x = ±8), 5 in thick, then the 3 in taper to the 6 in web
  assert.equal(mf(T1, p1, -9, 2), 'is outside the concrete outline');
  assert.equal(mf(T1, p1, -6, 2), '', 'x = −6: 2 in from the flange side (8 − 6) and 2 in above the soffit: fits');
  assert.equal(mf(T1, p1, -7, 2), 'is 1 in from the edge of the concrete (less than 2 in)');
  assert.equal(mf(T1, p1, 0, 1.5), 'is 1.5 in from the edge of the concrete (less than 2 in)');
  // PS-30 (2026-11-14): the CTDOT BI-36: 35.5 × 27 in, 5 in webs, void 25.5 × 16 in centred between the 5½ in slabs (x ±12.75, y 5.5 to 21.5 in)
  const B1 = g('AASHTO BI-36 (27in)'), pb = outline(B1);
  assert.deepEqual(J(W.sectionVoids(B1)), [{ type: 'rect', x: 0, y: 13.5, w: 25.5, h: 16 }]);
  assert.equal(mf(B1, pb, 0, 6), 'is inside a void');
  assert.equal(mf(B1, pb, 0, 4), '', 'PS-33: y = 4 (the standard second row): 1.5 in below the void: fits');
  assert.equal(mf(B1, pb, 0, 4.5), 'is 1 in from a void (less than 1.25 in)');
  assert.equal(mf(B1, pb, 0, 4.25), '', 'PS-39: 1.25 in below the void: fits');
  assert.equal(mf(B1, pb, 15, 6), '', 'in the web: 2.25 in from the void, 2.75 in from the outer face: fits');
  assert.equal(mf(B1, pb, 14, 6), '', 'PS-39: 1.25 in from the void: fits');
  assert.equal(mf(B1, pb, 14.5, 6), '', 'PS-39: 1.75 in from the void');
  assert.equal(mf(B1, pb, 13.75, 6), 'is 1 in from a void (less than 1.25 in)');
  assert.equal(mf(B1, pb, 16, 6), 'is 1.75 in from the edge of the concrete (less than 2 in)', 'the outer face keeps 2 in');
  // PS-32 / PS-40: the CTDOT SIV-48: 47.5 × 21 in, voids Ø12 / Ø10 / Ø12 at x = −14.25 / 0 / 14.25 in (PS-40; ±14 before) on mid-depth (y = 10.5 in)
  const D21 = g('AASHTO SIV-48 (21in)'), pd = outline(D21);
  assert.equal(mf(D21, pd, -14.25, 10.5), 'is inside a void');
  assert.equal(mf(D21, pd, -6.75, 10.5), '', '1.75 in from the Ø10 void (x 0), 1.5 in from the Ø12 void (x −14.25): fits');
  assert.equal(mf(D21, pd, -7, 10.5), '', 'PS-39 / PS-40: 1.25 in from the Ø12 void at −14.25 (1 in at −14 before PS-40): fits');
  assert.equal(mf(D21, pd, -7.25, 10.5), 'is 1 in from a void (less than 1.25 in)');
  assert.equal(mf(D21, pd, -6, 10.5), 'is 1 in from a void (less than 1.25 in)', 'the Ø10 void at x 0');
  assert.equal(mf(D21, pd, -14.25, 3.25), '', 'PS-39: 1.25 in below the Ø12 void (bottom at 4.5 in): fits');
  assert.equal(mf(D21, pd, -14.25, 3.5), 'is 1 in from a void (less than 1.25 in)');
  assert.equal(mf(D21, pd, 0, 4.25), '', '1.25 in below the Ø10 void (bottom at 5.5 in)');
  assert.equal(IC.COVER, 2); assert.equal(IC.VOID, 1.25);
});

test('PS-28 (2): collect\'s verdict = the PS-27 criterion over PSBStrandGfx.xy, every shape, counts and rows of a 2 in grid, draped strands', () => {
  let nCase = 0, nBad = 0;
  for (const [girder, S] of SHAPES) {
    const G = GIRDERS[girder], h = +G.h, cap = G.next ? 2 * (Math.floor((G.B - 4) / 2) + 1) : Math.floor(((G.box || G.deck ? G.w : G.bbf) - 4) / 2) + 1;
    for (let y = 1; y < h; y += (y < 12 ? 1 : 4)) for (let n = 1; n <= cap + 2; n += 1) {
      const P = project(girder, [{ n, y }], { n: 0 }, S), ref = refFits(P), e = fitErrs(P); nCase++; if (!ref) nBad++;
      assert.equal(e.length === 0, ref, `${girder} S ${S}: ${n} at y = ${y}: ${JSON.stringify(e)}`);
      if (e.length) { assert.equal(e.length, 1); assert.match(e[0].path, /^base\.rows\.0\.(n|y)$/); assert.equal(e[0].cell, 0); assert.equal(e[0].src, 'geometry');
        assert.ok(e[0].msg.startsWith(`Straight strand rows, row 1: ${n} strand${n === 1 ? '' : 's'} at y = ${y} in do not fit the ${girder}: the strand at x = `), e[0].msg);
        // the field: y where one strand (NEXT: one in each stem) does not fit at that y, else the count
        const one = refFits(project(girder, [{ n: Math.min(n, G.next ? 2 : 1), y }], { n: 0 }, S));
        assert.equal(e[0].path, `base.rows.0.${one ? 'n' : 'y'}`, `${girder} ${n} at ${y}`); }
    }
    for (const nh of [2, 4, 8, 12]) for (const yE of [4, Math.round(0.6 * h), h - 3, h - 1]) for (const yM of [2, 5, 8, 12]) {
      if (yM >= h || yE >= h) continue;
      const P = project(girder, [{ n: 2, y: 2 }], { n: nh, yEnd: yE, yMid: yM, frac: 0.4 }, S), e = fitErrs(P);
      const inp = W.PSBDesign.inputs(P), g = W.girderGross(inp), ss = W.strandSys(inp, g), poly = outline(g);
      const okAt = cg => W.PSBStrandGfx.xy({ g, ss }, cg).filter(q => q.h).every(q => fitsAt(g, poly, q));
      const want = [...(okAt(yE) ? [] : ['base.harp.yEnd']), ...(okAt(yM) ? [] : ['base.harp.yMid'])];
      const rowBad = !refFits(project(girder, [{ n: 2, y: 2 }], { n: 0 }, S)) ? ['base.rows.0.' + (refFits(project(girder, [{ n: G.next ? 2 : 1, y: 2 }], { n: 0 }, S)) ? 'n' : 'y')] : [];
      assert.deepEqual(e.map(x => x.path), [...rowBad, ...want], `${girder} S ${S}: ${nh} draped about ${yE} / ${yM}`); nCase++;
      e.filter(x => /^base\.harp/.test(x.path)).forEach(x => assert.match(x.msg, new RegExp(`^Draped strands: the ${nh} draped strands about y_(end|mid) = [\\d.]+ in \\(at (℄ bearing|midspan)\\) do not fit the `)));
    }
  }
  assert.ok(nCase > 1500 && nBad > 300, `${nCase} cases, ${nBad} that do not fit`);
});

test('PS-28 (3): the engineer\'s hand checks: AASHTO Type I with a 10-strand row; BI-36 (PS-30: the 27 in CTDOT section) with a row at y = 6 in', () => {
  // Type I, b_bf = 16 in: 10 strands on the 2 in grid about the ℄ at x = ±1, ±3, …, ±9 in: ±9 is past the flange side (8 in): error on the count
  let P = project('AASHTO Type I', [{ n: 10, y: 2 }], { n: 0 }), e = fitErrs(P);
  assert.deepEqual(e.map(x => x.path), ['base.rows.0.n']);
  assert.equal(e[0].msg, 'Straight strand rows, row 1: 10 strands at y = 2 in do not fit the AASHTO Type I: the strand at x = -9 in is outside the concrete outline; each strand centre must be inside the concrete, outside the voids, at least 2 in from the edges of the concrete and at least 1.25 in from the edges of the voids (the positions the strand pattern draws).');
  // the engine's row capacity floor((16 − 4)/2) + 1 = 7: x = ±6, 2 in from the side: fits; 8 (x = ±7, 1 in): error
  assert.deepEqual(fitErrs(project('AASHTO Type I', [{ n: 7, y: 2 }], { n: 0 })), []);
  assert.match(fitErrs(project('AASHTO Type I', [{ n: 8, y: 2 }], { n: 0 }))[0].msg, /x = -7 in is 1 in from the edge of the concrete/);
  // the error blocks: it is in collect's errors (the page shows no results while errors[] is not empty)
  assert.ok(IC.collect(P).errors.some(x => x.path === 'base.rows.0.n'));
  // BI-36 (PS-30: 27 in, the void 5.5 in to 21.5 in above the soffit): a row at y = 6 in is in it: error on y
  P = project('AASHTO BI-36 (27in)', [{ n: 10, y: 2 }, { n: 4, y: 6 }], { n: 0 }); e = fitErrs(P);
  assert.deepEqual(e.map(x => x.path), ['base.rows.1.y']); assert.equal(e[0].cell, 1);
  assert.match(e[0].msg, /^Straight strand rows, row 2: 4 strands at y = 6 in do not fit the AASHTO BI-36 \(27in\): the strand at x = -3 in is inside a void;/);
  assert.deepEqual(fitErrs(project('AASHTO BI-36 (27in)', [{ n: 10, y: 2 }, { n: 4, y: 4 }], { n: 0 })), [], 'PS-33: y = 4 in: 1.5 in below the void');
  // a row of zero strands is skipped; the rows keep their own numbers (row 3 is the third entered row)
  e = fitErrs(project('AASHTO BI-36 (27in)', [{ n: 10, y: 2 }, { n: 0, y: 4 }, { n: 4, y: 6 }], { n: 0 }));
  assert.deepEqual(e.map(x => x.path), ['base.rows.2.y']);
  // a row y outside the depth keeps its own message only (no second error on that row)
  e = J(IC.collect(project('AASHTO Type I', [{ n: 4, y: 30 }], { n: 0 })).errors).filter(x => /^base\.rows\.0/.test(x.path));
  assert.equal(e.length, 1); assert.match(e[0].msg, /is not inside the girder/);
});

test('PS-28 (4): the defaults fit: a new project, the default project (the old app\'s DEFAULTS on the PCI BT-72), the 19 designs of harness B', () => {
  assert.deepEqual(fitErrs(M.newProject()), []); assert.deepEqual(J(IC.collect(M.newProject()).errors), []);
  assert.deepEqual(fitErrs(M.defaultProject()), []); assert.equal(M.defaultProject().base.girder, 'PCI BT-72');
  const C = TAB_CASES(() => M.defaultProject()); assert.equal(Object.keys(C).length, 19);
  for (const [k, P] of Object.entries(C)) { assert.deepEqual(fitErrs(P), [], k); assert.equal(refFits(P), true, k); }
});

test('PS-28 (5): a girder type\'s own shape is checked on its own inputs: the error names the type, in its scope', () => {
  const P = M.newProject(); P.spans.lengths = [100, 120]; P.xs.skews = [0, 0, 0]; P.types = W.PSBBridge.newTypes(P); P.xs.dl = W.PSBBridgeDL.defaults(P);
  assert.deepEqual(fitErrs(P), []);
  // Type II: b_bf 18 in (8 strands at most a row), d = [6, 3, 6, 6]: the bottom flange 6 in, then the taper from (9, 6) to (3, 12): the base's
  // 10 / 10 / 8 rows at y = 2 / 4 / 6 in: rows 1 and 2 at x = ±9 (on the flange side, 0 in); row 3 at x = ±7, y = 6 in: 2 sin 45° = 1.41 in
  // from the taper
  const T = P.types.find(t => t.span === 2); T.ovr.girder = 'AASHTO Type II';
  const e = fitErrs(P);
  assert.deepEqual(e.map(x => [x.path, x.scope]), [['base.rows.0.n', T.id], ['base.rows.1.n', T.id], ['base.rows.2.n', T.id]]);
  assert.match(e[2].msg, /row 3: 8 strands at y = 6 in do not fit the AASHTO Type II: the strand at x = -7 in is 1\.41 in from the edge of the concrete/);
  assert.ok(e.every(x => x.msg.startsWith(`Girder type ${T.label}: Straight strand rows, row `) && /do not fit the AASHTO Type II/.test(x.msg)));
});

test('PS-28 (6): an imported old-app design that does not fit opens with the error; its data kept as read', () => {
  const raw = J(W.mergeInputs(null)); raw.girder = 'AASHTO Type I'; raw.rows = [{ n: 10, y: 2, dbnd: 0, nd: 0 }, { n: 4, y: 4, dbnd: 0, nd: 0 }]; raw.harp = { n: 2, yEnd: 20, yMid: 6, frac: 0.4 };
  const f = W.PSBLegacy.fromText(JSON.stringify(raw), 'old.json'); assert.equal(f.ok, true);
  const r = W.PSBLegacy.convert(f.src); assert.equal(r.ok, true);
  const e = fitErrs(r.project);
  assert.deepEqual(e.map(x => x.path), ['base.rows.0.n']);
  assert.deepEqual(J(r.project.base.rows), raw.rows, 'the rows as saved'); assert.deepEqual(J(r.project.base.harp), raw.harp);
  assert.deepEqual(J(r.project.legacy.inputs), raw, 'the old inputs kept as read');
  assert.ok(r.summary.items.some(i => i.kind === 'err' && /do not fit the AASHTO Type I/.test(i.text)), 'the import summary names it');
  // the project saved and read back: the data and the error are the same (nothing dropped)
  const back = M.importJSON(M.exportJSON(r.project)); assert.equal(back.ok, true);
  const P2 = back.project; assert.deepEqual(J(P2.base.rows), raw.rows); assert.deepEqual(fitErrs(P2).map(x => x.path), ['base.rows.0.n']);
});

test('PS-28 (7): nothing written; the engine not involved; the page loads ui/strands.js (the check needs PSBStrandGfx.xy)', () => {
  const P = project('AASHTO Type I', [{ n: 10, y: 2 }], { n: 12, yEnd: 20, yMid: 6 }), before = JSON.stringify(P);
  IC.collect(P); assert.equal(JSON.stringify(P), before);
  const Ps = [M.defaultProject(), ...Object.values(TAB_CASES(() => M.defaultProject()))];
  Ps.forEach(Q => assert.equal(JSON.stringify(W.computeAll(W.PSBDesign.inputs(Q))), JSON.stringify(W0.computeAll(W0.PSBDesign.inputs(Q)))));
  assert.deepEqual(J(W0.PSBInputCheck.collect(P).errors).filter(x => /do not fit/.test(x.msg)), [], 'without ui/strands.js: no check');
  const html = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
  assert.ok(/'ui\/strands\.js'/.test(html) && /'engine\/inputcheck\.js'/.test(html), 'both scripts in the page');
});
