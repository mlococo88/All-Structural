// apps/ps-bridge PS-27 (engineer report 2026-11-13: "Look at the graphic for the NEXT beam section and make sure the strands are actually
//   within the beam webs. This was correct in the psgirder app."): the drawn strand positions of every section graphic that draws strands
//   (ui/strands.js: the strand pattern at ℄ bearing and at midspan — Girders & strands input tab, Losses tab, Report; ui/section.js: the
//   composite section — Section properties tab, Report; ui/stresses.js: the stress diagram on the section — Stresses tab, Report).
//   Each graphic is drawn with the app's own drawing kit (ui/vizkit.js), its strand circles recorded, for every shape of the library
//   (NEXT at the narrowest and widest flange) with
//     - "raw": the app's default strand pattern as it is (DEFAULTS rows and draped strands, even where it does not fit the shape),
//     - "default": the default pattern with each row (and the draped strands) cut to what fits the shape as the old app draws it,
//     - "full": every 2 in row from the soffit filled to what fits, draped strands added where they fit, debonding in the bottom row,
//   "fits" meaning: every strand centre inside the girder outline (halfPolygon mirrored, the drawing data) at least COVER = 2 in from its
//   edges (the engine's own "2″ edge cover" of its row-capacity warning) and at least 2 in clear of a void (sectionVoids).
//   Checked: (1) every graphic draws exactly the strands of PSBStrandGfx.xy (count = the engine's N per row + n_h); (2) xy = the old app's
//   strandXY ("Prestressed Bridge Design.html" @ PIN, :4877-4914, run from its text) at ℄ bearing and at midspan, positions and debonded
//   strands, for every even NEXT count (odd: PS27-D1, the count drawn = the count entered); (3) "default" and "full": every drawn strand
//   inside the concrete with the cover, none in the gap between the NEXT stems; (4) the engine is not involved: computeAll's strand values
//   are the same before and after drawing (the drawing reads R only).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { pinText } from './psbridge-source.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared(...PBD, ...['sections', 'model', 'holddown', 'design'].map(n => path.join(APP, `engine/${n}.js`)), ...['vizkit', 'strands', 'section', 'stresses'].map(n => path.join(APP, `ui/${n}.js`)));
const COVER = 2;
const GIRDERS = vm.runInContext('GIRDERS', W), DEFAULTS = vm.runInContext('DEFAULTS', W);   // the engine's const globals (not on the context object)

// the old app's strandXY, from its own text at PIN
const OLD_LINES = pinText().split('\n').slice(4876, 4914);
assert.match(OLD_LINES[0], /^function strandXY\(R,view\)/); assert.equal(OLD_LINES[OLD_LINES.length - 1], '}');
const oldXY = vm.runInContext(`(function(){ ${OLD_LINES.join('\n')}\n return strandXY; })()`, W);

// record the strand circles a graphic draws (class dt-bar / dt-bolt: the strands; dt-cc: outline and voids)
function record(fn) {
  const VK = W.PSBVizKit, s0 = VK.scene, got = [];
  VK.scene = () => { const S = s0(), c0 = S.circ; S.circ = (x, y, r, cls, o) => { if (/^dt-(bar|bolt)/.test(cls)) got.push({ x, y }); return c0(x, y, r, cls, o); }; return S; };
  try { fn(); } finally { VK.scene = s0; }
  return got;
}
const key = q => `${(+q.x).toFixed(6)},${(+q.y).toFixed(6)}`;
const bag = q => Array.from(q, key).sort();   // (an array of this realm: the app's arrays come from the vm context)
const J = v => JSON.parse(JSON.stringify(v));

// geometry of the drawing data: the closed outline, the voids
const outline = G => { const h = W.halfPolygon(G); return h.concat(h.slice().reverse().map(p => [-p[0], p[1]])); };
function inside(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
function edgeDist(poly, x, y) { let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], b = poly[(i + 1) % poly.length], dx = b[0] - a[0], dy = b[1] - a[1], L2 = dx * dx + dy * dy;
  const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return d; }
function voidClear(G, x, y) { return W.sectionVoids(G).reduce((m, v) => Math.min(m, v.type === 'rect' ? Math.hypot(Math.max(Math.abs(x - v.x) - v.w / 2, 0), Math.max(Math.abs(y - v.y) - v.h / 2, 0)) * (Math.abs(x - v.x) <= v.w / 2 && Math.abs(y - v.y) <= v.h / 2 ? -1 : 1)
  : Math.hypot(x - v.x, y - v.y) - v.d / 2), Infinity); }
const fitsAt = (G, poly, q) => inside(poly, q.x, q.y) && edgeDist(poly, q.x, q.y) >= COVER - 1e-9 && voidClear(G, q.x, q.y) >= COVER - 1e-9;

// a design of the library shape with the given strands (span 60 ft; NEXT flange width from S)
function design(girder, rows, harp, S) {
  const P = W.PSBModel.defaultProject(); P.spans.lengths = [60]; if (S) P.xs.bays = P.xs.bays.map(() => S);
  Object.assign(P.base, { girder, rows: rows.map(r => ({ dbnd: 0, nd: 0, ...r })), harp: { ...P.base.harp, ...harp } });
  const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(inp); assert.equal(R.error, null, girder); return { P, inp, R };
}
const oldOk = (R, view) => { const G = R.g, poly = outline(G); return oldXY(R, view).every(q => fitsAt(G, poly, q)); };
const step = G => (G.isNext ? 2 : 1);
/* the largest count ≤ n of a row at y (the draped strands: their n_h at y_end and y_mid) that the old app draws inside with the cover */
function fitRow(girder, S, rows, y, n) { for (let m = n; m > 0; m -= 1) { const d = design(girder, [...rows, { n: m, y }], { n: 0 }, S); if (d.R.g.isNext && m % 2) continue; if (oldOk(d.R, 'mid')) return m; } return 0; }
function fitDraped(girder, S, rows, n, yEnd, yMid) { for (let m = n; m > 0; m -= 2) { const d = design(girder, rows, { n: m, yEnd, yMid, frac: 0.4 }, S); if (oldOk(d.R, 'mid') && oldOk(d.R, 'end')) return m; } return 0; }

const SHAPES = Object.keys(GIRDERS).filter(k => k !== 'Custom').flatMap(k => (GIRDERS[k].next ? [[k, 8], [k, 12]] : [[k, null]]));
const D = DEFAULTS;
function cases(girder, S) {
  const G = design(girder, D.rows, { n: 0 }, S).R.g, out = { raw: { rows: D.rows, harp: D.harp } };
  // default: the default rows and draped strands, each cut to what fits
  const rows = []; D.rows.forEach(r => { const m = fitRow(girder, S, rows, r.y, r.n); if (m) rows.push({ n: m, y: r.y }); });
  const yE = Math.min(+D.harp.yEnd, Math.round(0.6 * G.h)), yM = +D.harp.yMid;
  out.default = { rows, harp: { n: fitDraped(girder, S, rows, +D.harp.n, yE, yM), yEnd: yE, yMid: yM, frac: 0.4 } };
  // full: every 2 in row from the soffit filled (up to 6 rows), draped strands where they fit, two strands of the bottom row debonded
  const full = []; const cap = G.isNext ? 2 * (Math.floor((G.next.B - 4) / 2) + 1) : Math.floor(((G.isBox || G.isDeck ? G.w : G.bbf) - 4) / 2) + 1;
  for (let y = 2; y < G.h - 2 && full.length < 6; y += 2) { const m = fitRow(girder, S, full, y, cap); if (!m) break; full.push({ n: m, y }); }
  if (full.length && full[0].n >= 2 * step(G)) Object.assign(full[0], { dbnd: 6, nd: 2 * step(G) });
  out.full = { rows: full, harp: { n: fitDraped(girder, S, full, 16, Math.round(0.6 * G.h), Math.max(2 * full.length + 4, 8)), yEnd: Math.round(0.6 * G.h), yMid: Math.max(2 * full.length + 4, 8), frac: 0.4 } };
  return out;
}
/* every graphic's strand circles for a design: the strand pattern at ℄ bearing and midspan, the composite section, the stress diagram at
   the girder end, the hold-down point and midspan stations */
function drawn(d) {
  const { R, inp, P } = d, SG = W.PSBStrandGfx;
  const g = { end: record(() => SG.section(R, true, 600)), mid: record(() => SG.section(R, false, 600)), sec: record(() => W.PSBUiSection.figure({ R, inp, P }, 700)) };
  const yAt = x => { const ss = R.ss, a = +ss.hp.frac * R.L, xm = Math.min(x, R.L - x); return ss.nh > 0 ? (xm >= a ? +ss.hp.yMid : +ss.hp.yEnd + (+ss.hp.yMid - +ss.hp.yEnd) * xm / a) : 0; };
  [0, Math.round(R.grid.length * 0.2), Math.floor(R.grid.length / 2)].forEach(i => { g[`st${i}`] = record(() => W.PSBUiStresses.secFig(R, inp, i, 'rel', 700)); g[`st${i}`].yh = yAt(R.grid[i].x); });
  return g;
}

for (const [girder, S] of SHAPES) {
  const name = `${girder}${S ? ` (S = ${S} ft, flange ${Math.min(144, Math.max(96, S * 12))} in)` : ''}`;
  test(`PS-27 strand graphics: ${name}`, () => {
    const C = cases(girder, S);
    // PS-32: the CTDOT SII-48 (Ø8 voids, bottom 3.5 in above the soffit, one on the ℄) has no centred row 2 in from its voids (PS-28's 2 in;
    // the void clearance of the next PR, PS-33, admits its standard 2 in row)
    if (girder === 'AASHTO SII-48 (15in)' && !C.full.rows.length) { delete C.full; assert.equal(C.default.rows.length, 0); }
    else assert.ok(C.full.rows.length >= 1 && C.full.rows[0].n >= 2, `${name}: a full pattern ${JSON.stringify(C.full)}`);
    for (const [cn, c] of Object.entries(C)) {
      const d = design(girder, c.rows, c.harp, S), R = d.R, G = R.g, poly = outline(G), ss = R.ss, tag = `${name} ${cn}`;
      const before = JSON.stringify([ss.Ntot, ss.cgsMid, ss.eMid, ss.eEnd, ss.at(0.001), ss.at(R.L / 2), R.checks]);
      const g = drawn(d), SG = W.PSBStrandGfx;
      // (1) each graphic draws exactly xy's strands, as many as the engine has
      const cgE = ss.nh > 0 ? +ss.hp.yEnd : 0, cgM = ss.nh > 0 ? +ss.hp.yMid : 0;
      assert.deepEqual(bag(g.end), bag(SG.xy(R, cgE)), `${tag}: strand pattern at ℄ bearing = xy`);
      assert.deepEqual(bag(g.mid), bag(SG.xy(R, cgM)), `${tag}: strand pattern at midspan = xy`);
      assert.deepEqual(bag(g.sec), bag(SG.xy(R, cgM)), `${tag}: Section properties graphic = xy at midspan`);
      Object.keys(g).filter(k => /^st/.test(k)).forEach(k => assert.deepEqual(bag(g[k]), bag(SG.xy(R, g[k].yh)), `${tag}: Stresses graphic ${k} = xy`));
      assert.equal(g.mid.length, ss.Nbond + ss.nh, `${tag}: drawn count = N`);
      ss.rows.forEach((r, ri) => assert.equal(SG.xy(R, cgM).filter(q => !q.h && q.ri === ri).length, r.n, `${tag}: row ${ri + 1} count`));
      // (2) = the old app's strandXY (positions; debonded strands at ℄ bearing)
      for (const [view, cg] of [['end', cgE], ['mid', cgM]]) {
        const o = oldXY(R, view), n = SG.xy(R, cg);
        assert.deepEqual(bag(n), bag(o), `${tag}: positions = old app (${view})`);
        assert.deepEqual(bag(n.filter(q => q.db)), bag(o.filter(q => q.db)), `${tag}: debonded strands = old app (${view})`);
      }
      // (3) inside the concrete with the cover (the patterns that fit); never between the NEXT stems
      Object.entries(g).forEach(([k, pts]) => pts.forEach(q => {
        if (G.isNext) assert.ok(Math.abs(q.x) >= G.next.stemCC / 2 - G.next.B / 2, `${tag} ${k}: strand at x = ${q.x} between the stems`);
        if (cn !== 'raw') assert.ok(fitsAt(G, poly, q), `${tag} ${k}: strand at (${q.x}, ${q.y}) not inside the concrete with ${COVER} in cover`);
      }));
      if (cn !== 'raw') { const ks = Array.from(W.PSBStrandGfx.xy(R, cgM).filter(q => !q.h), key); assert.equal(new Set(ks).size, ks.length, `${tag}: no two straight strands drawn at one place`); }
      // (4) drawing does not change the engine's values
      assert.equal(JSON.stringify([ss.Ntot, ss.cgsMid, ss.eMid, ss.eEnd, ss.at(0.001), ss.at(R.L / 2), R.checks]), before, `${tag}: engine values unchanged`);
    }
  });
}

test('PS-27: NEXT 36F, the engineer\'s case: 10 + 10 + 6 straight (2 of the top row debonded), 4 draped: every strand in a stem; hand check of x', () => {
  const d = design('NEXT 36F', [{ n: 10, y: 2 }, { n: 10, y: 4 }, { n: 6, y: 6, dbnd: 8, nd: 2 }], { n: 4, yEnd: 24, yMid: 10, frac: 0.4 }, 8), R = d.R;
  // stems at ±30 in, B = 13 in: per stem floor((13 − 4)/2) + 1 = 5 columns on 2 in: x = ±30 + {−4, −2, 0, 2, 4}
  const xs = y => J([...new Set(W.PSBStrandGfx.xy(R, 10).filter(q => q.y === y).map(q => q.x))].sort((a, b) => a - b));
  assert.deepEqual(xs(2), [-34, -32, -30, -28, -26, 26, 28, 30, 32, 34]);
  assert.deepEqual(xs(6), [-32, -30, -28, 28, 30, 32]);
  assert.deepEqual(xs(10), [-31, -29, 29, 31], 'draped: 2 in each stem at y_mid');
  assert.deepEqual(J(W.PSBStrandGfx.xy(R, 24).filter(q => q.db).map(q => q.x).sort((a, b) => a - b)), [-32, 28], 'debonded: an outermost column of each stem (the first of the two, as the old app)');
  // the stems' faces: 30 ± 6.5 in; the outermost strand 34 in: 2.5 in from the outer face
  assert.ok(W.PSBStrandGfx.xy(R, 10).every(q => Math.abs(q.x) >= 23.5 + 2 && Math.abs(q.x) <= 36.5 - 2));
});

test('PS-27 PS27-D1: an odd count in a NEXT row is drawn ⌈n/2⌉ in the left stem and ⌊n/2⌋ in the right (the old app drew round(n/2) in each)', () => {
  const d = design('NEXT 28F', [{ n: 7, y: 2, dbnd: 6, nd: 3 }], { n: 3, yEnd: 16, yMid: 8, frac: 0.4 }, 10), R = d.R, P = W.PSBStrandGfx.xy(R, 8);
  const L = P.filter(q => q.x < 0), Rt = P.filter(q => q.x > 0);
  assert.equal(L.filter(q => !q.h).length, 4); assert.equal(Rt.filter(q => !q.h).length, 3);
  assert.equal(L.filter(q => q.h).length, 2); assert.equal(Rt.filter(q => q.h).length, 1);
  assert.equal(L.filter(q => q.db).length, 2); assert.equal(Rt.filter(q => q.db).length, 1);
  assert.equal(oldXY(R, 'mid').filter(q => !q.h).length, 8, 'the old app: 8 drawn for 7');
  assert.deepEqual(J(Rt.filter(q => !q.h).map(q => q.x).sort((a, b) => a - b)), [28, 30, 32], 'right stem centred on its own 3');
});
