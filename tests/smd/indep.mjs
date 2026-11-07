// Independent continuous-beam solver for tests/smd-verify.mjs (written for the 2026-11-07 review of Shear and Moment Diagrams.html;
// shares no code with the tool). Fine-mesh Hermite beam elements, consistent loads by 8-point Gauss quadrature.
// Independent continuous-beam solver (reviewer's own): fine-mesh direct stiffness, Hermite elements,
// consistent nodal loads by 8-point Gauss quadrature, element end forces -> V, M at mesh nodes; deflection = nodal DOFs.
// Sign: loads down positive (input), V/M output in "beam convention": V = sum of upward forces left of the cut,
// M sagging positive, couple +CCW, deflection reported DOWN positive. Supports: pin|roller|fixed|free, optional
// spring k (force/len), settlement (down +), internal hinge flag at a node (moment release).
const GP = [[-0.9602898564975363,0.1012285362903763],[-0.7966664774136267,0.2223810344533745],[-0.5255324099163290,0.3137066458778873],[-0.1834346424956498,0.3626837833783620],[0.1834346424956498,0.3626837833783620],[0.5255324099163290,0.3137066458778873],[0.7966664774136267,0.2223810344533745],[0.9602898564975363,0.1012285362903763]];
function solveLin(A, b) {
  const n = b.length; A = A.map(r => r.slice()); b = b.slice();
  for (let i = 0; i < n; i++) {
    let m = i; for (let k = i + 1; k < n; k++) if (Math.abs(A[k][i]) > Math.abs(A[m][i])) m = k;
    if (Math.abs(A[m][i]) < 1e-12 * (Math.abs(A[i][i]) + 1)) throw new Error('singular');
    [A[i], A[m]] = [A[m], A[i]]; [b[i], b[m]] = [b[m], b[i]];
    for (let k = i + 1; k < n; k++) { const c = A[k][i] / A[i][i]; if (!c) continue; for (let j = i; j < n; j++) A[k][j] -= c * A[i][j]; b[k] -= c * b[i]; }
  }
  const x = new Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j]; x[i] = s / A[i][i]; }
  return x;
}
// model: {spans:[L..], sup:['pin'...], EI: number | (x)=>EI, loads:[{type:'point',x,P}|{type:'moment',x,M}|{type:'dist',x1,x2,w1,w2}]} x global, down +
export function indep(model, nPer = 120) {
  const { spans, sup } = model; const EIf = typeof model.EI === 'function' ? model.EI : () => model.EI;
  const nodeX = [0]; spans.forEach(L => nodeX.push(nodeX.at(-1) + L));
  const pts = new Set();
  spans.forEach((L, i) => { for (let k = 0; k <= nPer; k++) pts.add(+(nodeX[i] + L * k / nPer).toFixed(10)); });
  model.loads.forEach(l => { if (l.type === 'dist') { pts.add(+l.x1.toFixed(10)); pts.add(+l.x2.toFixed(10)); } else pts.add(+l.x.toFixed(10)); });
  const X = [...pts].sort((a, b) => a - b);
  const n = X.length, nd = 2 * n;
  const K = Array.from({ length: nd }, () => new Array(nd).fill(0)), F = new Array(nd).fill(0);
  const elems = [];
  for (let e = 0; e < n - 1; e++) {
    const L = X[e + 1] - X[e], EI = EIf((X[e] + X[e + 1]) / 2), a = EI / L ** 3;
    const k = [[12, 6 * L, -12, 6 * L], [6 * L, 4 * L * L, -6 * L, 2 * L * L], [-12, -6 * L, 12, -6 * L], [6 * L, 2 * L * L, -6 * L, 4 * L * L]].map(r => r.map(v => v * a));
    // consistent loads (v up positive, theta CCW); downward w -> negative
    const fe = [0, 0, 0, 0];
    model.loads.forEach(l => {
      if (l.type !== 'dist') return;
      const lo = Math.max(l.x1, X[e]), hi = Math.min(l.x2, X[e + 1]); if (hi <= lo + 1e-12) return;
      GP.forEach(([t, wt]) => {
        const x = (lo + hi) / 2 + t * (hi - lo) / 2, J = (hi - lo) / 2;
        const w = l.w1 + (l.w2 - l.w1) * (x - l.x1) / (l.x2 - l.x1), s = (x - X[e]) / L;
        const N = [1 - 3 * s * s + 2 * s ** 3, L * (s - 2 * s * s + s ** 3), 3 * s * s - 2 * s ** 3, L * (-s * s + s ** 3)];
        for (let i = 0; i < 4; i++) fe[i] += -w * N[i] * wt * J;
      });
    });
    const d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let i = 0; i < 4; i++) { F[d[i]] += fe[i]; for (let j = 0; j < 4; j++) K[d[i]][d[j]] += k[i][j]; }
    elems.push({ k, fe, d, L });
  }
  const idx = x => { let b = 0; for (let i = 0; i < n; i++) if (Math.abs(X[i] - x) < Math.abs(X[b] - x)) b = i; return b; };
  model.loads.forEach(l => { if (l.type === 'point') F[2 * idx(l.x)] -= l.P; if (l.type === 'moment') F[2 * idx(l.x) + 1] += l.M; });
  const fixedDof = new Map();
  sup.forEach((s, i) => {
    const j = idx(nodeX[i]);
    if (s === 'free') return;
    if (typeof s === 'object' && s.k) { K[2 * j][2 * j] += s.k; return; }
    const st = typeof s === 'object' ? s.t : s, set = typeof s === 'object' ? -(s.settle || 0) : 0;
    fixedDof.set(2 * j, set); if (st === 'fixed') fixedDof.set(2 * j + 1, 0);
  });
  const free = []; for (let i = 0; i < nd; i++) if (!fixedDof.has(i)) free.push(i);
  const U = new Array(nd).fill(0); fixedDof.forEach((v, k) => U[k] = v);
  const rhs = free.map(i => F[i] - [...fixedDof].reduce((s, [k, v]) => s + K[i][k] * v, 0));
  const uf = solveLin(free.map(i => free.map(j => K[i][j])), rhs); free.forEach((d, q) => U[d] = uf[q]);
  // reactions
  const R = sup.map((s, i) => { const j = idx(nodeX[i]);
    if (s === 'free') return { v: 0, m: 0 };
    const rv = K[2 * j].reduce((a, k, c) => a + k * U[c], 0) - F[2 * j], rm = K[2 * j + 1].reduce((a, k, c) => a + k * U[c], 0) - F[2 * j + 1];
    if (typeof s === 'object' && s.k) return { v: s.k * -U[2 * j], m: 0 };
    return { v: rv, m: (s === 'fixed' || s.t === 'fixed') ? rm : 0 }; });
  // element end forces: q = k u - fe ; left end: shear up q0, moment q1 (CCW on element) -> beam M at left = -q1, V = q0
  const V = [], M = [], D = [];
  elems.forEach((el, e) => {
    const u = el.d.map(i => U[i]), q = [0, 1, 2, 3].map(i => el.k[i].reduce((a, k, j) => a + k * u[j], 0) - el.fe[i]);
    V.push({ x: X[e], y: q[0] }); M.push({ x: X[e], y: -q[1] });
    V.push({ x: X[e + 1], y: -q[2] }); M.push({ x: X[e + 1], y: q[3] });
  });
  for (let i = 0; i < n; i++) D.push({ x: X[i], y: -U[2 * i] });
  return { R, V, M, D, X, nodeX };
}
export const ext = arr => ({ max: Math.max(...arr.map(p => p.y)), min: Math.min(...arr.map(p => p.y)), abs: Math.max(...arr.map(p => Math.abs(p.y))) });
export function at(arr, x) { // value at x (first match within tol, else interpolate on sorted)
  let best = null; for (const p of arr) if (Math.abs(p.x - x) < 1e-7) { best = p.y; } if (best !== null) return best;
  for (let i = 0; i < arr.length - 1; i++) if (arr[i].x <= x && arr[i + 1].x >= x) { const a = arr[i], b = arr[i + 1]; return b.x === a.x ? a.y : a.y + (b.y - a.y) * (x - a.x) / (b.x - a.x); }
  return NaN;
}
