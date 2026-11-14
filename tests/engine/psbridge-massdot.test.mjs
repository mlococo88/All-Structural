// apps/ps-bridge PS-37 (engineer decision 2026-11-14): the MassDOT Bridge Manual Part II standard sections (engine/sections.js; the moved
// engine unchanged): NEBT, NEDBT, NEXT F, NEXT D, spread and adjacent box beams B36 / B48 (24–48 in), deck beams S36 / S48 (12–21 in).
//   (1) the library = the sheets (transcribed here again: A, I, y_b, h, widths), y_t = h − y_b, S = I / y as printed; NEDBT 80 y_b 46.40 in
//       (the printed 46.60 is a misprint: S_b, y_t and the depth give 46.40); every existing entry unchanged, the MassDOT ones before Custom;
//   (2) the drawn outline (halfPolygon and sectionVoids as wrapped, integrated here) against the sheet's A, I, y_b: the deviations are the
//       ones the PR lists (shear keys and cell chamfers not drawn), and the sheet's full outline (with the chamfers) within ~1 % where the
//       sheet dimensions it (NEBT, NEDBT A 0.9–1.2 % listed, NEXT, spread boxes);
//   (3) the engine: each section computes; the live load distribution type (adjacent box / deck beam (f)/(g), spread box and the bulb tees the
//       engine's type (k), NEXT the engine's (i)/(j)); NEXT D b_f = 12 S − 13 in (96–120 in) and its worked steps reproduce the engine values;
//   (4) the picker: optgroups by owner, every name once, the existing names in the old order; the Section properties note;
//   (5) the existing shapes: girderGross byte-identical with the wrappers (every harness B design).
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBD = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const ENG = ['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`));
const UI = ['outkit', 'vizkit', 'section', 'inputs'].map(n => path.join(APP, `ui/${n}.js`));
const W = loadShared('steps.js', ...PBD, ...ENG, ...UI);
const W0 = loadShared(...PBD);   // the moved engine alone
const G = vm.runInContext('GIRDERS', W), G0 = vm.runInContext('GIRDERS', W0), D0 = vm.runInContext('DEFAULTS', W), S = W.PSBSections, J = v => JSON.parse(JSON.stringify(v));
const pc = (a, b) => (a / b - 1) * 100;

/* the sheets as printed: [name, h, A, I, y_b, y_t] (y_t printed) */
const SHEETS = [
  // NEBT dwg 9.1.4 (p. 91)
  ['MassDOT NEBT 1000', 39.37, 746, 149196, 19.02, 20.35], ['MassDOT NEBT 1200', 47.24, 801, 238089, 22.63, 24.61], ['MassDOT NEBT 1400', 55.12, 857, 353169, 26.26, 28.86],
  ['MassDOT NEBT 1600', 62.99, 913, 492515, 29.96, 33.03], ['MassDOT NEBT 1800', 70.87, 969, 660691, 33.66, 37.2],
  // NEDBT dwg 11.1.3 (p. 253); 80: y_b printed 46.60 (misprint), 46.40 used
  ['MassDOT NEDBT 40', 40, 1072, 202908, 23.55, 16.45], ['MassDOT NEDBT 48', 48, 1128, 328913, 28.23, 19.77], ['MassDOT NEDBT 56', 56, 1185, 490067, 32.85, 23.15],
  ['MassDOT NEDBT 64', 64, 1242, 688318, 37.41, 26.59], ['MassDOT NEDBT 72', 72, 1298, 925587, 41.93, 30.07], ['MassDOT NEDBT 80', 80, 1355, 1203781, 46.40, 33.60],
  // spread boxes dwg 9.3.4 / 9.3.5 (p. 153 / 154)
  ['MassDOT B36-24 spread', 24, 569, 37392, 11.89, 12.11], ['MassDOT B36-27 spread', 27, 604, 51478, 13.37, 13.63], ['MassDOT B36-30 spread', 30, 638, 68281, 14.85, 15.15],
  ['MassDOT B36-33 spread', 33, 673, 87958, 16.33, 16.67], ['MassDOT B36-36 spread', 36, 707, 110661, 17.81, 18.19], ['MassDOT B36-39 spread', 39, 797, 140025, 19.33, 19.67],
  ['MassDOT B36-42 spread', 42, 837, 170514, 20.82, 21.18], ['MassDOT B36-45 spread', 45, 878, 204772, 22.31, 22.69], ['MassDOT B36-48 spread', 48, 918, 242981, 23.80, 24.20],
  ['MassDOT B48-24 spread', 24, 707, 49247, 11.86, 12.14], ['MassDOT B48-27 spread', 27, 742, 67415, 13.33, 13.67], ['MassDOT B48-30 spread', 30, 776, 88921, 14.80, 15.20],
  ['MassDOT B48-33 spread', 33, 811, 113920, 16.28, 16.72], ['MassDOT B48-36 spread', 36, 845, 142567, 17.76, 18.24], ['MassDOT B48-39 spread', 39, 935, 178498, 19.27, 19.73],
  ['MassDOT B48-42 spread', 42, 975, 216174, 20.75, 21.25], ['MassDOT B48-45 spread', 45, 1016, 258238, 22.24, 22.76], ['MassDOT B48-48 spread', 48, 1056, 304874, 23.72, 24.28],
  // adjacent boxes dwg 10.2.4 / 10.2.5 (p. 223 / 224)
  ['MassDOT B36-24 adj.', 24, 543, 36609, 11.82, 12.18], ['MassDOT B36-27 adj.', 27, 573, 50267, 13.29, 13.71], ['MassDOT B36-30 adj.', 30, 603, 66503, 14.77, 15.23],
  ['MassDOT B36-33 adj.', 33, 633, 85453, 16.24, 16.76], ['MassDOT B36-36 adj.', 36, 663, 107251, 17.72, 18.28], ['MassDOT B36-39 adj.', 39, 748, 135514, 19.24, 19.76],
  ['MassDOT B36-42 adj.', 42, 784, 164680, 20.73, 21.27], ['MassDOT B36-45 adj.', 45, 820, 197374, 22.21, 22.79], ['MassDOT B36-48 adj.', 48, 856, 233759, 23.70, 24.30],
  ['MassDOT B48-24 adj.', 24, 681, 48461, 11.80, 12.20], ['MassDOT B48-27 adj.', 27, 711, 66201, 13.27, 13.73], ['MassDOT B48-30 adj.', 30, 741, 87139, 14.73, 15.27],
  ['MassDOT B48-33 adj.', 33, 771, 111410, 16.20, 16.80], ['MassDOT B48-36 adj.', 36, 801, 139151, 17.68, 18.32], ['MassDOT B48-39 adj.', 39, 886, 173980, 19.19, 19.81],
  ['MassDOT B48-42 adj.', 42, 922, 210330, 20.67, 21.33], ['MassDOT B48-45 adj.', 45, 958, 250828, 22.15, 22.85], ['MassDOT B48-48 adj.', 48, 994, 295638, 23.63, 24.37],
  // deck beams dwg 10.1.4 / 10.1.5 (p. 193 / 194)
  ['MassDOT S36-12', 12, 417, 5033, 5.98, 6.02], ['MassDOT S36-15', 15, 419, 9419, 7.47, 7.53], ['MassDOT S36-18', 18, 464, 15963, 8.96, 9.04], ['MassDOT S36-21', 21, 497, 24827, 10.45, 10.55],
  ['MassDOT S48-12', 12, 561, 6761, 5.98, 6.02], ['MassDOT S48-15', 15, 548, 12593, 7.47, 7.53], ['MassDOT S48-18', 18, 601, 21303, 8.97, 9.03], ['MassDOT S48-21', 21, 670, 33597, 10.47, 10.53]];
/* NEXT: [name, h, B, w_min, w_max, [A, I, y_b] min, [A, I, y_b] max] (dwg 9.2.3, p. 124; dwg 11.2.3, p. 295) */
const NEXT = [
  ['MassDOT NEXT 24F', 24, 13.75, 96, 144, [972, 51905, 14.94], [1164, 60159, 16.10]], ['MassDOT NEXT 28F', 28, 13.50, 96, 144, [1082, 80037, 17.23], [1274, 92836, 18.55]],
  ['MassDOT NEXT 32F', 32, 13.25, 96, 144, [1190, 116036, 19.50], [1382, 134523, 20.96]], ['MassDOT NEXT 36F', 36, 13.00, 96, 144, [1296, 160602, 21.75], [1488, 186000, 23.34]],
  ['MassDOT NEXT 28D', 28, 13.75, 96, 120, [1348, 85775, 18.06], [1540, 92724, 18.80]], ['MassDOT NEXT 32D', 32, 13.50, 96, 120, [1457, 126319, 20.56], [1649, 136722, 21.43]],
  ['MassDOT NEXT 36D', 36, 13.25, 96, 120, [1564, 176999, 23.02], [1756, 191801, 24.01]], ['MassDOT NEXT 40D', 40, 13.00, 96, 120, [1669, 238511, 25.45], [1861, 258692, 26.54]]];
const inpOf = (name, S_) => Object.assign(J(D0), { girder: name, S: S_ == null ? 9 : S_ });
const gOf = (name, S_) => W.girderGross(inpOf(name, S_));
/* drawn(g): A, I, y_b of the shape as drawn (the mirrored halfPolygon, shoelace; less sectionVoids: rectangles, circles) */
function drawn(g) {
  const hp = W.halfPolygon(g), P = hp.concat(hp.slice().reverse().map(p => [-p[0], p[1]]));
  let A = 0, Sy = 0, Ix = 0;
  for (let i = 0; i < P.length; i++) { const [x1, y1] = P[i], [x2, y2] = P[(i + 1) % P.length], c = x1 * y2 - x2 * y1; A += c / 2; Sy += (y1 + y2) * c / 6; Ix += (y1 * y1 + y1 * y2 + y2 * y2) * c / 12; }
  if (A < 0) { A = -A; Sy = -Sy; Ix = -Ix; }
  W.sectionVoids(g).forEach(v => { const a = v.type === 'rect' ? v.w * v.h : Math.PI * v.d * v.d / 4, i0 = v.type === 'rect' ? v.w * v.h ** 3 / 12 : Math.PI * v.d ** 4 / 64; A -= a; Sy -= a * v.y; Ix -= i0 + a * v.y * v.y; });
  const yb = Sy / A; return { A, I: Ix - A * yb * yb, yb };
}

test('PS-37 (1): the MassDOT library = the sheets; NEDBT 80 y_b 46.40 (misprint 46.60); existing entries unchanged; MassDOT before Custom', () => {
  assert.equal(S.ORDER_MD.length, SHEETS.length + NEXT.length);
  SHEETS.forEach(([n, h, A, I, yb, yt]) => {
    const e = G[n]; assert.ok(e, n); assert.deepEqual([e.h, e.A, e.I, e.yb], [h, A, I, yb], n);
    assert.ok(Math.abs(h - yb - yt) <= 0.011, `${n}: y_t = h − y_b`);
    const g = gOf(n); assert.equal(g.std, n); assert.equal(g.A, A); assert.equal(g.I, I); assert.equal(g.yb, yb);
  });
  assert.equal(S.MD['MassDOT NEDBT 80'].src.ybPrinted, 46.60); assert.ok(Math.abs(1203781 / 46.40 - 25944) < 1 && Math.abs(1203781 / 46.60 - 25944) > 100, 'S_b printed 25,944 = I / 46.40');
  NEXT.forEach(([n, h, B, w0, w1, a, c]) => { const e = G[n]; assert.ok(e && e.next, n);
    assert.deepEqual([e.h, e.B, e.wMin, e.wMax, e.pMin.A, e.pMin.I, e.pMin.yb, e.pMax.A, e.pMax.I, e.pMax.yb], [h, B, w0, w1, a[0], a[1], a[2], c[0], c[1], c[2]], n);
    assert.equal(e.flangeT, /F$/.test(n) ? 4 : 8, n + ': flange'); });
  // box / slab geometry of the engine entries (dwg: top slab 5½, bottom 6, webs 5 / 6 in adjacent, 5¾ / 6¾ in spread; widths 35.5 / 47.5)
  SHEETS.filter(r => / adj\.$/.test(r[0])).forEach(([n, h]) => { const e = G[n], w = /B36/.test(n) ? 35.5 : 47.5, tw = h <= 36 ? 5 : 6;
    assert.deepEqual([e.box, e.w, e.wall, e.voidW, e.voidH, e.bw], [true, w, 6, w - 2 * tw, h - 11.5, 2 * tw], n); });
  SHEETS.filter(r => / spread$/.test(r[0])).forEach(([n, h]) => { const e = G[n], w = /B36/.test(n) ? 35.5 : 47.5, tw = h <= 36 ? 5.75 : 6.75;
    assert.deepEqual([!!e.box, e.btf, e.bbf, e.bw, J(e.d)], [false, w, w, 2 * tw, [5.5, 0, 6, 0]], n); });
  // the existing library: every entry as before this PR (PS-30 / PS-32 / PS-38 applied), in the same order, then the MassDOT ones, then Custom
  const before = Object.keys(G).filter(k => !S.MD[k]);
  assert.equal(before[before.length - 1], 'Custom'); assert.deepEqual(J(Object.keys(G).slice(before.length - 1, -1)), J(S.ORDER_MD));
  before.forEach(k => assert.ok(!(k in S.MD), k));
  Object.keys(G0).filter(k => k in G).forEach(k => { if (k !== 'NEXT 28F') assert.deepEqual(J(G[k]), J(G0[k]), k + ' unchanged'); });
});

test('PS-37 (2): the drawn outline against the sheets (listed in the PR): NEBT, NEXT within 1 %; NEDBT A −1.2 %; boxes and deck beams: keys / chamfers not drawn', () => {
  const rows = [];
  SHEETS.forEach(([n, h, A, I, yb]) => { const d = drawn(gOf(n)); rows.push([n, pc(d.A, A), pc(d.I, I), pc(d.yb, yb)]); });
  NEXT.forEach(([n, , , w0, w1, a, c]) => [[w0, a], [w1, c]].forEach(([w, p]) => { const d = drawn(gOf(n, (w + (/D$/.test(n) ? 13 : 0)) / 12)); rows.push([`${n} @ ${w}`, pc(d.A, p[0]), pc(d.I, p[1]), pc(d.yb, p[2])]); }));
  const lim = { NEBT: [0.3, 0.3, 0.2], NEDBT: [1.2, 0.4, 0.45], NEXT: [0.6, 0.25, 0.25], spread: [3.1, 2.3, 0.25], adj: [1.85, 0.85, 0.3], S: [4.6, 2.2, 0.5] };
  rows.forEach(([n, dA, dI, dyb]) => {
    const k = /NEBT/.test(n) ? 'NEBT' : /NEDBT/.test(n) ? 'NEDBT' : /NEXT/.test(n) ? 'NEXT' : /spread/.test(n) ? 'spread' : /adj/.test(n) ? 'adj' : 'S';
    assert.ok(Math.abs(dA) <= lim[k][0] && Math.abs(dI) <= lim[k][1] && Math.abs(dyb) <= lim[k][2], `${n}: A ${dA.toFixed(2)} %, I ${dI.toFixed(2)} %, y_b ${dyb.toFixed(2)} %`);
  });
  // the outlines drawn with the sheets' tapers and fillets: within 1 % (NEDBT A: −0.9 to −1.2 %, listed)
  rows.filter(r => /NEBT|NEXT/.test(r[0]) && !/NEDBT/.test(r[0])).forEach(([n, dA, dI, dyb]) => assert.ok(Math.abs(dA) < 1 && Math.abs(dI) < 1 && Math.abs(dyb) < 1, n));
  console.log('    drawn outline vs sheet (A, I, y_b %):\n' + rows.map(r => `      ${r[0].padEnd(28)} ${r.slice(1).map(v => (v >= 0 ? '+' : '') + v.toFixed(2)).join('  ')}`).join('\n'));
  // the sheet's own outline of the spread box (with its 3 × 3 in cell chamfers and ¾ in bottom chamfers, dwg 9.3.4): within 0.1 % (the readings)
  [['MassDOT B36-24 spread', 569, 37392, 11.89], ['MassDOT B48-48 spread', 1056, 304874, 23.72]].forEach(([n, A, I, yb]) => {
    const g = gOf(n), d = drawn(g), v = W.sectionVoids(g)[0], ch = 4 * 4.5, Af = d.A + ch, ys = [v.y - v.h / 2 + 1, v.y - v.h / 2 + 1, v.y + v.h / 2 - 1, v.y + v.h / 2 - 1];
    const Sy = d.A * d.yb + 4.5 * ys.reduce((p, q) => p + q, 0), yf = Sy / Af;
    assert.ok(Math.abs(pc(Af, A)) < 0.1 && Math.abs(pc(yf, yb)) < 0.1, `${n}: A ${Af} y_b ${yf}`);
  });
});

test('PS-37 (3): every MassDOT section computes; live load distribution type by family; NEXT D b_f = 12 S − 13 in; worked steps = engine', () => {
  for (const n of S.ORDER_MD) {
    const e = S.MD[n], P = W.PSBModel.newProject(); P.base.girder = n; P.base.harp.n = 0; P.types.forEach(T => { T.ovr = {}; });
    P.base.ts = e.box || e.deck || /NEXT \d+D|NEDBT/.test(n) ? 0 : 8; P.base.rows = [{ n: e.next ? 10 : 8, y: e.next ? 2.5 : 2.25, nd: 0, dbnd: 0 }];
    P.xs.bays = Array(4).fill(e.box || e.deck ? e.w / 12 : e.next ? 9 : 8); P.spans.lengths = [e.box || e.deck ? 40 : 80];
    const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(J(inp));
    assert.equal(R.error, null, n); assert.equal(R.g.std, n);
    const f = e.src.fam;
    if (f === 'adj' || f === 'slab' || f === 'solid') assert.ok(R.df.fg && R.df.fg.type === 'g', n + ': type (g)');
    else if (f === 'nextf' || f === 'nextd') assert.ok(R.df.isNext && !R.df.fg, n + ': the engine NEXT (i)/(j)');
    else assert.ok(!R.df.fg && !R.df.isNext, n + ': the engine type (k)');
    const Wk = W.PSBWorked.section(inp, R); Wk.pairs.forEach(q => assert.ok(Math.abs(q.shown - q.engine) <= 1e-9 * Math.max(1, Math.abs(q.engine)), `${n} ${q.id}: ${q.shown} vs ${q.engine}`));
    assert.deepEqual(J(W.PSBInputCheck.collect(P).errors.map(x => x.msg)), [], n + ': no input error');
  }
  // NEXT D: S = 9.0 ft: b_f = 108 − 13 = 95 → 96 in; S = 10 ft: 107 in (t = 11 / 24); S = 11.5 ft: 125 → 120 in
  const a = gOf('MassDOT NEXT 28D', 9), b = gOf('MassDOT NEXT 28D', 10), c = gOf('MassDOT NEXT 28D', 11.5);
  assert.equal(a.btf, 96); assert.equal(b.btf, 107); assert.equal(c.btf, 120); assert.equal(a.I, 85775); assert.equal(c.I, 92724);
  assert.ok(Math.abs(b.I - (85775 + 11 / 24 * (92724 - 85775))) < 1e-9); assert.deepEqual(J(b.nxw), { S: 10, gap: 13, raw: 107, bf: 107 });
  // NEXT F (MassDOT): b_f = 12 S as the old library's NEXT F, the same properties at every width
  [8, 10, 12].forEach(s => { const m = gOf('MassDOT NEXT 28F', s), o = gOf('NEXT 28F', s); assert.equal(m.btf, o.btf); assert.equal(m.A, o.A); assert.equal(m.I, o.I); assert.equal(m.yb, o.yb); });
  // the worked width step and the interpolation on the Section properties tab
  const P = W.PSBModel.newProject(); P.base.girder = 'MassDOT NEXT 32D'; P.base.ts = 0; P.base.harp.n = 0; P.types.forEach(T => { T.ovr = {}; }); P.xs.bays = [10, 10, 10, 10];
  const inp = W.PSBDesign.inputs(P), R = W.PSBHoldDown.compute(J(inp)), Wk = W.PSBWorked.section(inp, R), st = id => Wk.steps.find(q => q.id === id);
  assert.equal(st('sec.g.bf').value, 107); assert.match(st('sec.g.bf').eq, /12\\,S - 13/); assert.ok(Math.abs(st('sec.g.A').value - (1457 + 11 / 24 * 192)) < 1e-9);
  const html = W.PSBUiSection.output({ P, inp, R, W: { section: Wk }, ui: {} });
  assert.ok(html.includes('href="#st-sec.g.bf"') && html.includes('href="#st-sec.g.A"'), 'linked');
  assert.ok(html.includes('MassDOT NEXT 32D: A, I and y<sub>b</sub> from MassDOT Bridge Manual Part II dwg 11.2.3 (p. 295)'), 'the note');
});

test('PS-37 (4): the girder picker: optgroups by owner, every library name once, existing names in their order', () => {
  const f = W.PSBFields.ALL().find(q => q.p === 'base.girder');
  const fld = f || W.PSBFields.byPath('base.girder');
  const P = W.PSBModel.newProject(); P.base.girder = 'MassDOT B36-27 adj.';
  const h = W.PSBInputsUI.field(fld, P);
  const groups = [...h.matchAll(/<optgroup label="([^"]+)">/g)].map(m => m[1]);
  assert.deepEqual(groups, ['AASHTO / PCI — I-girders and bulb tees (old library)', 'PCI Northeast — NEXT F (old library)', 'CTDOT — box beams (BDM plate 5.2.1b)', 'Solid deck slabs (old library)',
    'CTDOT — voided slabs (BDM plates 5.1.1c / 5.1.2c)', 'MassDOT — NEBT (dwg 9.1.4)', 'MassDOT — NEDBT (dwg 11.1.3)', 'MassDOT — NEXT F (dwg 9.2.3)', 'MassDOT — NEXT D (dwg 11.2.3)',
    'MassDOT — spread box beams (dwg 9.3.4 / 9.3.5)', 'MassDOT — adjacent box beams (dwg 10.2.4 / 10.2.5)', 'MassDOT — deck beams (dwg 10.1.4 / 10.1.5)', 'Custom']);
  const opts = [...h.matchAll(/<option value="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&'));
  assert.deepEqual(opts, Object.keys(G)); assert.ok(h.includes('<option value="MassDOT B36-27 adj." selected>'));
});

test('PS-37 (5): every existing shape: girderGross, the outline and the voids byte-identical with the wrappers (harness B designs and every old entry)', () => {
  const C = TAB_CASES(() => W.PSBModel.defaultProject());
  const W1 = loadShared('steps.js', ...PBD, path.join(APP, 'engine/sections.js'));   // the library module alone (its PS-30..PS-40 changes)
  Object.values(C).forEach(P => { const inp = W.PSBDesign.inputs(P), g = W.girderGross(J(inp)), g1 = W1.girderGross(J(inp)); assert.equal(g.std, undefined);
    assert.deepEqual(J(g), J(g1)); assert.deepEqual(J(W.halfPolygon(g)), J(W1.halfPolygon(g1))); assert.deepEqual(J(W.sectionVoids(g)), J(W1.sectionVoids(g1))); });
  Object.keys(G).filter(k => !S.MD[k] && k !== 'Custom').forEach(k => { const i = inpOf(k), g = W.girderGross(i); assert.equal(g.std, undefined, k);
    if (k in G0) { assert.deepEqual(J(W.halfPolygon(g)), J(W0.halfPolygon(W0.girderGross(i))), k); assert.deepEqual(J(W.sectionVoids(g)), J(W0.sectionVoids(W0.girderGross(i))), k); } });
});
