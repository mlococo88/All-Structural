// Text-overlap checker for the output-tab graphics (dev tooling for the tests; not loaded by the app).
// textBoxes(D, X): the text entities of a SharedDxf drawing D (TEXT and the texts of dimensions, via X.dimGeo) as oriented boxes: the advance width of
// Arial / Helvetica (the font the preview draws with) times the text height, from 0.1 of the height below the baseline (descenders) to 0.82 above (capitals and
// ascenders), shortened by 2 % of the height at each end.
// textOverlaps(D, X): the pairs of boxes that overlap (separating-axis test on the oriented rectangles), [{ a, b, depth }].
const W = { ' ': 278, '!': 278, '"': 355, '#': 556, '$': 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584, ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722, O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611, '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556, o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500, '{': 334, '|': 260, '}': 334, '~': 584 };
for (let i = 0; i < 10; i++) W[String(i)] = 556;
export const textWidth = (s, hh) => { let w = 0; for (const c of String(s).replace(/%%[dcp]/g, 'o')) w += (W[c] != null ? W[c] : 600); return w / 1000 * hh; };

function box(e, src) {
  const hh = e.hh, w = textWidth(e.s, hh), r = (e.rot || 0) * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), sh = e.j === 2 ? -w : e.j === 1 ? -w / 2 : 0, sk = 0.02 * hh;
  const ax = e.pts[0][0], ay = e.pts[0][1], P = (u, v) => [ax + u * c - v * s, ay + u * s + v * c];
  return { s: e.s, hh, src, l: e.l, poly: [P(sh + sk, -0.1 * hh), P(sh + w - sk, -0.1 * hh), P(sh + w - sk, 0.82 * hh), P(sh + sk, 0.82 * hh)], x: ax, y: ay };
}
export function textBoxes(D, X) {
  const out = [];
  D.E.forEach((e, i) => { if (e.t === 'TEXT') out.push(box(e, i)); else if (e.t === 'DIM') X.dimGeo(e).g.forEach(q => { if (q.t === 'TEXT') out.push(box(q, i)); }); });
  return out.filter(b => String(b.s).trim() && b.poly.every(p => p.every(Number.isFinite)));
}
// penetration depth of two convex polygons (0 when separated)
function depth(A, B) {
  let best = Infinity;
  for (const poly of [A, B]) for (let i = 0; i < poly.length; i++) {
    const p = poly[i], q = poly[(i + 1) % poly.length], nx = q[1] - p[1], ny = p[0] - q[0], len = Math.hypot(nx, ny); if (!len) continue;
    const pr = P => P.map(v => (v[0] * nx + v[1] * ny) / len), a = pr(A), b = pr(B), lo = Math.max(Math.min(...a), Math.min(...b)), hi = Math.min(Math.max(...a), Math.max(...b));
    if (hi <= lo) return 0; best = Math.min(best, hi - lo);
  }
  return best === Infinity ? 0 : best;
}
export function textOverlaps(D, X) {
  const bs = textBoxes(D, X), out = [];
  const ext = bs.map(b => { const xs = b.poly.map(p => p[0]), ys = b.poly.map(p => p[1]); return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]; });
  const ord = bs.map((_, i) => i).sort((i, j) => ext[i][0] - ext[j][0]);
  for (let a = 0; a < ord.length; a++) { const i = ord[a]; for (let b = a + 1; b < ord.length; b++) { const j = ord[b]; if (ext[j][0] >= ext[i][2]) break;
    if (ext[j][1] >= ext[i][3] || ext[j][3] <= ext[i][1]) continue; const d = depth(bs[i].poly, bs[j].poly); if (d > 0) out.push({ a: bs[i], b: bs[j], depth: d }); } }
  return out;
}
export const describe = o => `"${o.a.s}" (${o.a.x.toFixed(0)}, ${o.a.y.toFixed(0)}) x "${o.b.s}" (${o.b.x.toFixed(0)}, ${o.b.y.toFixed(0)})`;

// legend swatches: the small closed rectangles (up to 2.2 text heights wide, 1.6 high) on the ratio layers (and the marker legend's rectangles); a text must not run over one
export function swatchBoxes(D) {
  const out = [];
  D.E.forEach(e => { if (e.t !== 'PL' || !e.closed || e.pts.length !== 4 || !/RATIO-(OK|WARN|NG|NA)$/.test(e.l)) return; const xs = e.pts.map(p => p[0]), ys = e.pts.map(p => p[1]), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
    if (w <= 2.2 * D.h && h <= 1.6 * D.h && w > 0.5 * D.h) out.push([[Math.min(...xs), Math.min(...ys)], [Math.max(...xs), Math.min(...ys)], [Math.max(...xs), Math.max(...ys)], [Math.min(...xs), Math.max(...ys)]]); });
  return out;
}
export function swatchOverlaps(D, X) {
  const sw = swatchBoxes(D), out = []; if (!sw.length) return out;
  textBoxes(D, X).forEach(b => sw.forEach(r => { const d = depth(b.poly, r); if (d > 0.05 * b.hh) out.push({ a: b, b: { s: '[legend swatch]', x: r[0][0], y: r[0][1] }, depth: d }); }));
  return out;
}
