// shared/pile-group.js (window.SharedPileGroup): rigid-cap pile-group statics (2026-11-07, Retaining Wall Designer
// Phase 8). Hand cases a reviewer can redo, and a comparison against the abutment calculator's own code (read from
// abutment_calculator.html at test time, so a later change there is caught) on equivalent inputs: identical numbers.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { test, loadShared, ROOT } from './harness.mjs';

const G = loadShared('pile-group.js').SharedPileGroup;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// The abutment calculator's pileReaction and its C-8 group-property lines AS THEY WERE before 8h (2026-11-07), frozen here verbatim
// (abutment_calculator.html at main 2c7d4b6, ABPX2): since 8h the abutment calls SharedPileGroup.reaction / groupProps, so these tests
// prove the shared code equals the abutment's former code bit for bit, and that the file now delegates to it.
const ABUT = fs.readFileSync(path.join(ROOT, 'abutment_calculator.html'), 'utf8');
const ABUT_BEFORE_REACTION = `function pileReaction(V,My,Mx,xi,yi,pi){
  const {n,Sxx,Syy}=pi, Sxy=pi.Sxy||0, D=Sxx*Syy-Sxy*Sxy;
  if(Math.abs(Sxy)>1e-9*Math.max(1,Sxx+Syy) && D>1e-9) return V/n+((My*Syy-Mx*Sxy)*xi+(Mx*Sxx-My*Sxy)*yi)/D;
  return V/n + (Sxx>1e-9? My*xi/Sxx:0) + (Syy>1e-9? Mx*yi/Syy:0);
}`;
const ABUT_BEFORE_GROUP = `const xgc=act.reduce((a,c)=>a+c.x,0)/n;         // from footing CL
      const ygc=act.reduce((a,c)=>a+c.y,0)/n;         // from abutment CL
      const xgcT=B/2+xgc;
      const Sxx=act.reduce((a,c)=>a+Math.pow(c.x-xgc,2),0); // Σ(x−xgc)² — longitudinal
      const Syy=act.reduce((a,c)=>a+Math.pow(c.y-ygc,2),0); // Σ(y−ygc)² — transverse
      const Sxy=act.reduce((a,c)=>a+(c.x-xgc)*(c.y-ygc),0); // ABPX2: Σ(x−xgc)(y−ygc) — product of inertia (0 for a symmetric layout)
      R.pile={n,xgc,ygc,xgcT,Sxx,Syy,Sxy};`;
function abutCode() {
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(ABUT_BEFORE_REACTION + '\nfunction abutGroup(act,B){ const n=act.length, R={}; ' + ABUT_BEFORE_GROUP + ' return R.pile; }', ctx);
  return ctx;
}
test('8h: the abutment calculator loads shared/pile-group.js and delegates pileReaction and the C-8 group properties to it', () => {
  assert.ok(/<script src="shared\/pile-group\.js"><\/script>/.test(ABUT), 'script tag');
  assert.ok(/function pileReaction\(V,My,Mx,xi,yi,pi\)\{ return SharedPileGroup\.reaction\(V,My,Mx,xi,yi,pi\); \}/.test(ABUT), 'pileReaction delegates');
  assert.ok(/const gp=SharedPileGroup\.groupProps\(act\);[\s\S]{0,400}R\.pile=\{n,xgc,ygc,xgcT,Sxx,Syy,Sxy\};/.test(ABUT), 'C-8 uses groupProps');
  assert.ok(!/const Sxy=act\.reduce/.test(ABUT), 'the former reductions are gone (one copy, in shared/)');
});

test('hand case: 2 rows (toe x = 1.5 ft, heel x = 8.5 ft), s = 6 ft, V = 20 kip/ft at x_R = 4.0 ft', () => {
  const g = G.rowGroup([{ x: 1.5, s: 6 }, { x: 8.5, s: 6 }]);
  assert.equal(g.ok, true);
  near(g.N, 1 / 3, 1e-15, 'N = 2/6');
  near(g.xbar, 5.0, 1e-12, 'x̄');
  near(g.I, 2 * (1 / 6) * 3.5 * 3.5, 1e-12, 'I = 2·(1/6)·3.5² = 4.08333');
  const M = G.momentAbout(20, 4.0, g.xbar); near(M, -20, 1e-12, 'M = 20(4 − 5)');
  const L = G.rowLoads(g, 20, M, 6);
  // P = 60 ± 20·3.5/4.08333 = 60 ± 17.142857
  near(L.rows[0].P, 60 + 120 / 7, 1e-9, 'P toe 77.1429');
  near(L.rows[1].P, 60 - 120 / 7, 1e-9, 'P heel 42.8571');
  near(L.rows[0].q, (60 + 120 / 7) / 6, 1e-9, 'q toe 12.857 kip/ft');
  near(L.sumQ, 20, 1e-12, 'ΣqV = V'); near(L.sumQx, 80, 1e-9, 'Σq·x = V·x_R');
  near(L.rows[0].h, 18, 1e-12, 'H per pile = 6/(1/3)'); near(L.rows[0].qh + L.rows[1].qh, 6, 1e-12, 'Σ qh = H');
  assert.equal(L.iMax, 0); assert.equal(L.iMin, 1); assert.equal(L.uplift, false); assert.equal(L.unstable, false);
});

test('hand case: 3 rows with unequal spacing (x = 1, 5, 9 ft; s = 4, 8, 8 ft), V = 10, M = +11 → P = 14, 22, 30', () => {
  const g = G.rowGroup([{ x: 1, s: 4 }, { x: 5, s: 8 }, { x: 9, s: 8 }]);
  near(g.N, 0.5, 1e-15, 'N'); near(g.xbar, 4, 1e-12, 'x̄ = (0.25 + 0.625 + 1.125)/0.5'); near(g.I, 5.5, 1e-12, 'I = 2.25 + 0.125 + 3.125');
  const L = G.rowLoads(g, 10, 11, 0);
  [14, 22, 30].forEach((p, i) => near(L.rows[i].P, p, 1e-12, 'P' + i));
  [3.5, 2.75, 3.75].forEach((q, i) => near(L.rows[i].q, q, 1e-12, 'q' + i));
  near(L.sumQ, 10, 1e-12, 'Σq');
});

test('uplift and one-row cases', () => {
  const g = G.rowGroup([{ x: 1.5, s: 6 }, { x: 8.5, s: 6 }]);
  const L = G.rowLoads(g, 10, G.momentAbout(10, 1.0, g.xbar), 0);   // resultant outside the group: heel row in tension
  near(L.rows[1].P, 30 - 40 * 3.5 / g.I, 1e-9, 'heel P'); assert.ok(L.rows[1].P < 0); assert.equal(L.uplift, true);
  const one = G.rowGroup([{ x: 3, s: 5 }]);
  near(one.I, 0, 1e-20, 'I one row (round-off only)');
  const c = G.rowLoads(one, 10, 0, 2); near(c.rows[0].P, 50, 1e-12, 'concentric: V·s'); assert.equal(c.unstable, false);
  const u = G.rowLoads(one, 10, 5, 2); assert.equal(u.unstable, true); assert.ok(Number.isNaN(u.rows[0].P));
  assert.equal(G.rowGroup([]).ok, false); assert.equal(G.rowGroup([{ x: 1, s: 0 }]).ok, false);
});

test('reaction() is the abutment calculator\'s former pileReaction: bit-identical on 2000 random inputs (Σx\'y\' = 0 and ≠ 0)', () => {
  const A = abutCode();
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < 2000; k++) {
    const pi = { n: 2 + Math.floor(rnd() * 30), Sxx: rnd() * 400, Syy: rnd() * 900, Sxy: k % 3 ? (rnd() - 0.5) * 50 : 0 };
    if (k % 7 === 0) pi.Sxx = 0; if (k % 11 === 0) pi.Syy = 0;
    const args = [(rnd() - 0.2) * 3000, (rnd() - 0.5) * 8000, (rnd() - 0.5) * 8000, (rnd() - 0.5) * 20, (rnd() - 0.5) * 60];
    const a = A.pileReaction(...args, pi), b = G.reaction(...args, pi);
    assert.ok(Object.is(a, b), `case ${k}: ${a} vs ${b}`);
  }
});

test('groupProps() equals the abutment calculator C-8 group properties (identical numbers), incl. an omitted pile', () => {
  const A = abutCode();
  const grid = []; for (const x of [-4.5, 0, 4.5]) for (const y of [-15, -7.5, 0, 7.5, 15]) grid.push({ x, y, active: true });
  const missing = grid.filter((p, i) => i !== 3);   // an omitted pile: Σx'y' ≠ 0
  for (const act of [grid, missing]) {
    const a = A.abutGroup(act, 12), b = G.groupProps(act);
    for (const k of ['n', 'xgc', 'ygc', 'Sxx', 'Syy', 'Sxy']) assert.ok(Object.is(a[k], b[k]), `${k}: ${a[k]} vs ${b[k]}`);
  }
  assert.ok(Math.abs(G.groupProps(missing).Sxy) > 1e-6, 'omitted pile gives Σx\'y\' ≠ 0');
});

test('rows per ft = the discrete group over a wall length (abutment pileReaction on the same piles)', () => {
  const A = abutCode();
  // 3 rows, spacings 4, 6, 8 ft along a 48-ft wall, piles placed symmetrically about y = 0 in every row (Σx'y' = 0)
  const rows = [{ x: 1.25, s: 4 }, { x: 5.0, s: 6 }, { x: 9.75, s: 8 }], Lw = 48;
  const piles = []; rows.forEach(r => { const m = Lw / r.s; for (let k = 0; k < m; k++) piles.push({ x: r.x, y: -Lw / 2 + r.s / 2 + k * r.s, active: true }); });
  const d = A.abutGroup(piles, 11), g = G.rowGroup(rows);
  near(d.n, g.N * Lw, 1e-9, 'n = N·L'); near(d.xgc, g.xbar, 1e-12, 'centroid'); near(d.Sxx, g.I * Lw, 1e-9, 'Σx\'² = I·L');
  near(d.Sxy, 0, 1e-9, 'Σx\'y\'');
  for (const [V, xR] of [[18.4, 4.1], [9.0, 7.7], [25.0, 0.8]]) {
    const L = G.rowLoads(g, V, G.momentAbout(V, xR, g.xbar), 0);
    rows.forEach((r, i) => {
      const pD = A.pileReaction(V * Lw, V * Lw * (xR - d.xgc), 0, r.x - d.xgc, 0, d);
      near(L.rows[i].P, pD, 1e-9 * Math.max(1, Math.abs(pD)), `row ${i} V=${V}`);
    });
  }
});
