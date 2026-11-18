// "Concrete Beam Capacity.html", Beam Capacity tab (CBLL, 2026-11-18; CBBD diagrams, 2026-11-18): line loads per service load case (simple span or cantilever),
// cbcLlNorm / cbcLineLoads / cbcSvcTotal, taken from the text of the Beam Capacity frame (its srcdoc, decoded) and run in a Node vm
// with cbcBuildCombos (ACI 318-19 Table 5.3.1). Hand checks of the PR in the comments.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { test, ROOT } from './harness.mjs';

function load() {
  const html = fs.readFileSync(path.join(ROOT, 'Concrete Beam Capacity.html'), 'utf8');
  const a = html.indexOf('id="suite-frame-capacity" srcdoc="'), b = html.indexOf('"></iframe>', a);
  const src = html.slice(a, b).replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
  const grab = re => { const m = re.exec(src); assert.ok(m, 'declaration not found: ' + re); const lines = src.slice(m.index + 1).split('\n'), out = [lines[0]];
    for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (/^[\s})\]]/.test(L) || L === '' || L === '\r') out.push(L); else break; } return out.join('\n'); };
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext([grab(/\nconst CBC_LD_KEYS=/).replace(/^const /, 'var '), grab(/\nfunction cbcBuildCombos\(/), grab(/\nfunction cbcSvcDefault\(/),
    grab(/\nfunction cbcSvcNorm\(/), grab(/\nfunction cbcLlNorm\(/), grab(/\nfunction cbcLineLoads\(/), grab(/\nfunction cbcSvcTotal\(/),
    grab(/\nfunction cbcLlOrd\(/), grab(/\nfunction cbcLlDiag\(/)].join('\n'), ctx);
  return ctx;
}
const near = (a, b, what, tol = 1e-9) => assert.ok(Math.abs(a - b) <= tol, `${what}: ${a} vs ${b}`);
const row = (R, name) => { const r = R.find(x => x.name === name); assert.ok(r, 'row not found: ' + name); return r; };
const blank = () => { const c = {}; for (const k of ['D', 'L', 'Lr', 'S', 'R', 'W', 'E']) c[k] = { M: 0, V: 0, T: 0 }; return c; };

// Hand check 1 (engineer's case): 20 ft simple span, V at the support face.
// D: q = 100 psf × 10 ft = 1.000 klf, + w = 0.200 klf -> w_D = 1.200 klf; M_D = 1.2(20)^2/8 = 60.0 k-ft; V_D = 1.2(20/2) = 12.0 kip.
// L: q = 50 psf × 10 ft = 0.500 klf; M_L = 0.5(400)/8 = 25.0 k-ft; V_L = 0.5(10) = 5.0 kip.
// (5.3.1b) 1.2D + 1.6L + 0.5Lr: M_u = 1.2(60) + 1.6(25) = 72 + 40 = 112.0 k-ft; V_u = 1.2(12) + 1.6(5) = 14.4 + 8.0 = 22.4 kip.
// (5.3.1a) 1.4D: M_u = 84.0, V_u = 16.8.
const LL1 = { L: 20, sup: 'simple', vAt: 'face', rows: [{ k: 'D', lab: 'floor', mode: 'q', q: 100, b: 10 }, { k: 'D', lab: 'wall', mode: 'w', w: 0.2 }, { k: 'L', lab: 'office', mode: 'q', q: 50, b: 10 }] };
test('hand check 1: 20 ft simple span, D 100 psf × 10 ft + 0.2 klf, L 50 psf × 10 ft -> 1.2D + 1.6L: M_u 112.0, V_u 22.4', () => {
  const C = load(), X = C.cbcLineLoads(LL1, { d: 15.5, Ag: 216 });
  near(X.cases.D.w, 1.2, 'w_D'); near(X.cases.L.w, 0.5, 'w_L');
  near(X.cases.D.M, 60, 'M_D'); near(X.cases.D.V, 12, 'V_D'); near(X.cases.L.M, 25, 'M_L'); near(X.cases.L.V, 5, 'V_L');
  assert.equal(X.any, true); assert.equal(X.xV, 0);
  const svc = C.cbcSvcTotal({ cases: blank(), rev: { W: true, E: true }, l05: false }, X);
  const R = C.cbcBuildCombos(svc);
  near(row(R, '1.2D + 1.6L + 0.5Lr').Mu, 112, 'M_u (5.3.1b)'); near(row(R, '1.2D + 1.6L + 0.5Lr').Vu, 22.4, 'V_u (5.3.1b)');
  near(row(R, '1.4D').Mu, 84, 'M_u (5.3.1a)'); near(row(R, '1.4D').Vu, 16.8, 'V_u (5.3.1a)');
  near(R.reduce((a, r) => Math.abs(r.Mu) > Math.abs(a.Mu) ? r : a).Mu, 112, 'governing M_u');
});

test('entered M, V are added to the line loads; T unchanged', () => {
  const C = load(), X = C.cbcLineLoads(LL1, { d: 15.5, Ag: 216 }), cs = blank();
  cs.D = { M: 5, V: 2, T: 3 }; cs.L = { M: -1, V: 0.5, T: 0 };
  const svc = C.cbcSvcTotal({ cases: cs, rev: { W: true, E: true }, l05: false }, X);
  near(svc.cases.D.M, 65, 'M_D total'); near(svc.cases.D.V, 14, 'V_D total'); near(svc.cases.D.T, 3, 'T_D');
  near(svc.cases.L.M, 24, 'M_L total'); near(svc.cases.L.V, 5.5, 'V_L total');
  near(row(C.cbcBuildCombos(svc), '1.2D + 1.6L + 0.5Lr').Mu, 1.2 * 65 + 1.6 * 24, 'M_u');   // 78 + 38.4 = 116.4
});

// Hand check 2: V at d, simple span. d = 18 in = 1.5 ft: V_D = 1.2(10 − 1.5) = 10.2 kip, V_L = 0.5(8.5) = 4.25 kip; M unchanged.
// 1.2D + 1.6L: V_u = 12.24 + 6.8 = 19.04 kip.
test('hand check 2: V at d = 18 in from the support face (simple span)', () => {
  const C = load(), X = C.cbcLineLoads(Object.assign({}, LL1, { vAt: 'd' }), { d: 18, Ag: 216 });
  near(X.xV, 1.5, 'x_V'); near(X.cases.D.V, 10.2, 'V_D'); near(X.cases.L.V, 4.25, 'V_L'); near(X.cases.D.M, 60, 'M_D');
  const R = C.cbcBuildCombos(C.cbcSvcTotal({ cases: blank(), rev: { W: true, E: true }, l05: false }, X));
  near(row(R, '1.2D + 1.6L + 0.5Lr').Vu, 19.04, 'V_u');
  // d not less than L/2: V at the face (dFall)
  const Y = C.cbcLineLoads({ L: 2, vAt: 'd', rows: [{ k: 'D', mode: 'w', w: 1 }] }, { d: 12, Ag: 100 });
  assert.equal(Y.dFall, true); near(Y.cases.D.V, 1, 'V at the face');
});

// Hand check 3: cantilever L = 8 ft, D w = 1.5 klf, L q = 40 psf × 12.5 ft = 0.5 klf.
// M_D = −1.5(64)/2 = −48.0 k-ft; V_D = 1.5(8) = 12.0 kip; M_L = −0.5(64)/2 = −16.0; V_L = 4.0.
// 1.2D + 1.6L: M_u = −57.6 − 25.6 = −83.2 k-ft (hogging); V_u = 14.4 + 6.4 = 20.8 kip.
// V at d = 15 in = 1.25 ft: V_D = 1.5(6.75) = 10.125, V_L = 0.5(6.75) = 3.375 -> V_u = 12.15 + 5.4 = 17.55 kip.
test('hand check 3: 8 ft cantilever, D 1.5 klf, L 40 psf × 12.5 ft -> M_u −83.2, V_u 20.8 (17.55 at d = 15 in)', () => {
  const C = load(), ll = { L: 8, sup: 'cant', rows: [{ k: 'D', mode: 'w', w: 1.5 }, { k: 'L', mode: 'q', q: 40, b: 12.5 }] };
  const X = C.cbcLineLoads(ll, { d: 15, Ag: 216 });
  near(X.cases.D.M, -48, 'M_D'); near(X.cases.D.V, 12, 'V_D'); near(X.cases.L.M, -16, 'M_L'); near(X.cases.L.V, 4, 'V_L');
  const R = C.cbcBuildCombos(C.cbcSvcTotal({ cases: blank(), rev: { W: true, E: true }, l05: false }, X));
  near(row(R, '1.2D + 1.6L + 0.5Lr').Mu, -83.2, 'M_u'); near(row(R, '1.2D + 1.6L + 0.5Lr').Vu, 20.8, 'V_u');
  const Xd = C.cbcLineLoads(Object.assign({}, ll, { vAt: 'd' }), { d: 15, Ag: 216 });
  near(Xd.cases.D.V, 10.125, 'V_D at d'); near(Xd.cases.L.V, 3.375, 'V_L at d');
  near(row(C.cbcBuildCombos(C.cbcSvcTotal({ cases: blank(), rev: { W: true, E: true }, l05: false }, Xd)), '1.2D + 1.6L + 0.5Lr').Vu, 17.55, 'V_u at d');
});

// Hand check 4: self-weight, 12 × 18 in, γ_c 150 pcf: w_sw = 150(216)/144/1000 = 0.225 klf; 20 ft simple: M = 0.225(400)/8 = 11.25, V = 2.25.
test('hand check 4: self-weight 12 × 18 in at 150 pcf = 0.225 klf in D (off by default)', () => {
  const C = load();
  const X = C.cbcLineLoads({ L: 20, sw: true, rows: [] }, { d: 15.5, Ag: 216 });
  near(X.swW, 0.225, 'w_sw'); near(X.cases.D.w, 0.225, 'w_D'); near(X.cases.D.M, 11.25, 'M_D'); near(X.cases.D.V, 2.25, 'V_D');
  assert.equal(X.any, true);
  assert.equal(C.cbcLlNorm(null).sw, false); assert.equal(C.cbcLlNorm(null).gc, 150);
  near(C.cbcLineLoads({ L: 20, sw: true, gc: 110, rows: [] }, { Ag: 216 }).swW, 0.165, 'lightweight 110 pcf');
});

test('an older project (no svc.ll): no line loads, the cases and the combinations exactly as before; JSON round trip', () => {
  const C = load();
  const old = { cases: { D: { M: 5, V: 2, T: 0 }, L: { M: 3, V: 1.2, T: 0 }, W: { M: 2, V: 0.8, T: 0 } }, rev: { W: true, E: true }, l05: false };
  const n = C.cbcSvcNorm(JSON.parse(JSON.stringify(old)));
  assert.deepEqual(JSON.parse(JSON.stringify(n.ll)), { L: 0, sup: 'simple', vAt: 'face', sw: false, gc: 150, rows: [] });
  const X = C.cbcLineLoads(n.ll, { d: 15.5, Ag: 216 });
  assert.equal(X.any, false);
  assert.equal(C.cbcSvcTotal(n, X), n, 'no line loads: the same object');
  const before = JSON.stringify(C.cbcBuildCombos(old)), after = JSON.stringify(C.cbcBuildCombos(C.cbcSvcTotal(n, X)));
  assert.equal(after, before);
  // a save with line loads round-trips through JSON and normalisation unchanged
  const withLL = C.cbcSvcNorm(Object.assign({}, old, { ll: LL1 }));
  const again = C.cbcSvcNorm(JSON.parse(JSON.stringify(withLL)));
  assert.equal(JSON.stringify(again), JSON.stringify(withLL));
  near(C.cbcLineLoads(again.ll, { d: 15.5, Ag: 216 }).cases.D.M, 60, 'M_D after the round trip');
  // garbage in ll does not break: rows not objects dropped, unknown case -> D, numbers or 0
  const g = C.cbcLlNorm({ L: 'x', sup: 'foo', rows: [null, 5, { k: 'Z', mode: 'q', q: '20', b: '5' }] });
  assert.equal(g.L, 0); assert.equal(g.sup, 'simple'); assert.equal(g.rows.length, 1); assert.equal(g.rows[0].k, 'D'); near(g.rows[0].q * g.rows[0].b / 1000, 0.1, 'q b');
});

test('span 0 or negative: line loads add nothing', () => {
  const C = load();
  for (const L of [0, -5]) { const X = C.cbcLineLoads({ L, rows: [{ k: 'D', mode: 'w', w: 2 }] }, { d: 15, Ag: 216 });
    assert.equal(X.any, true); near(X.cases.D.M, 0, 'M'); near(X.cases.D.V, 0, 'V'); }
});

// CBBD (2026-11-18): the V and M diagram ordinates (cbcLlOrd / cbcLlDiag, the Beam Analysis card and Report Figure LL-1) equal the
// worked values at x = L/2, 0 and d. The factored diagram = Σ γ_i × the case diagram; line + entered = the combination's M_u, V_u.
const svcOf = (C, X, cs) => C.cbcSvcTotal({ cases: cs || blank(), rev: { W: true, E: true }, l05: false }, X);
test('CBBD diagrams, hand check 1: 20 ft simple span, 1.2D + 1.6L: M_u(L/2) 112.0, V_u(0) 22.4, V_u(L) −22.4; per case wL²/8, wL/2', () => {
  const C = load(), X = C.cbcLineLoads(LL1, { d: 18, Ag: 216 }), r = row(C.cbcBuildCombos(svcOf(C, X)), '1.2D + 1.6L + 0.5Lr');
  const g = C.cbcLlDiag(X, r.terms, blank());
  near(g.xM, 10, 'x of M'); near(g.Mc, 112, 'M_u at L/2'); near(g.V0, 22.4, 'V_u at 0'); near(g.VL, -22.4, 'V_u at L'); near(g.Vd, 22.4, 'V_u at the face (x_V = 0)');
  near(g.M, r.Mu, 'diagram = the combination M_u', 1e-9); near(g.V, r.Vu, 'diagram = the combination V_u', 1e-9);
  // ordinates at the ends and midspan of the polyline; M(x) = w x (L − x)/2 at x = 5: 2.24(5)(15)/2 = 84.0
  near(g.pts[0].M, 0, 'M(0)'); near(g.pts[g.pts.length - 1].M, 0, 'M(L)'); near(g.pts.find(p => Math.abs(p.x - 10) < 1e-12).M, 112, 'M(L/2) polyline');
  near(C.cbcLlOrd(X, 2.24, 5).M, 84, 'M(5 ft)');
  const D = C.cbcLlDiag(X, [{ k: 'D', f: 1, s: 1 }], blank());
  near(D.Mc, X.cases.D.M, 'case D: M(L/2) = wL²/8 = 60.0'); near(D.V0, X.cases.D.V, 'case D: V(0) = wL/2 = 12.0'); near(D.Mc, 60, 'M_D'); near(D.V0, 12, 'V_D');
});
test('CBBD diagrams, hand check 2: V at d = 18 in: V_u(d) = 19.04 = the combination V_u; V_u(0) 22.4 (face, labelled)', () => {
  const C = load(), X = C.cbcLineLoads(Object.assign({}, LL1, { vAt: 'd' }), { d: 18, Ag: 216 });
  const r = row(C.cbcBuildCombos(svcOf(C, X)), '1.2D + 1.6L + 0.5Lr'), g = C.cbcLlDiag(X, r.terms, blank());
  near(g.xV, 1.5, 'x_V'); near(g.Vd, 19.04, 'V_u at d'); near(g.V, r.Vu, 'diagram at d = the combination V_u'); near(g.V0, 22.4, 'V_u at the face'); near(g.Mc, 112, 'M_u');
  assert.ok(g.pts.some(p => Math.abs(p.x - 1.5) < 1e-12), 'the polyline has a point at x = d');
  const D = C.cbcLlDiag(X, [{ k: 'D', f: 1, s: 1 }], blank()); near(D.Vd, X.cases.D.V, 'case D at d = w(L/2 − d) = 10.2'); near(D.Vd, 10.2, 'V_D at d');
});
test('CBBD diagrams, hand check 3: 8 ft cantilever, 1.2D + 1.6L: M_u(0) −83.2, V_u(0) 20.8, free end 0; at d = 15 in 17.55', () => {
  const C = load(), ll = { L: 8, sup: 'cant', rows: [{ k: 'D', mode: 'w', w: 1.5 }, { k: 'L', mode: 'q', q: 40, b: 12.5 }] };
  const X = C.cbcLineLoads(ll, { d: 15, Ag: 216 }), r = row(C.cbcBuildCombos(svcOf(C, X)), '1.2D + 1.6L + 0.5Lr'), g = C.cbcLlDiag(X, r.terms, blank());
  near(g.xM, 0, 'x of M'); near(g.Mc, -83.2, 'M_u at the support'); near(g.V0, 20.8, 'V_u at the support'); near(g.VL, 0, 'V at the free end');
  near(g.pts[g.pts.length - 1].M, 0, 'M at the free end'); near(g.M, r.Mu, 'M_u'); near(g.V, r.Vu, 'V_u');
  const Xd = C.cbcLineLoads(Object.assign({}, ll, { vAt: 'd' }), { d: 15, Ag: 216 }), rd = row(C.cbcBuildCombos(svcOf(C, Xd)), '1.2D + 1.6L + 0.5Lr');
  const gd = C.cbcLlDiag(Xd, rd.terms, blank()); near(gd.Vd, 17.55, 'V_u at d'); near(gd.V, rd.Vu, 'V_u at d = the combination');
  const D = C.cbcLlDiag(X, [{ k: 'D', f: 1, s: 1 }], blank()); near(D.Mc, -48, 'M_D = −wL²/2'); near(D.V0, 12, 'V_D = wL');
});
test('CBBD diagrams: entered M, V are point values only (no diagram); line + entered = M_u, V_u; reversed W', () => {
  const C = load(), X = C.cbcLineLoads(Object.assign({}, LL1, { rows: LL1.rows.concat([{ k: 'W', mode: 'w', w: 0.3 }]) }), { d: 18, Ag: 216 }), cs = blank();
  cs.D = { M: 5, V: 2, T: 0 }; cs.W = { M: 1, V: 0.5, T: 0 };
  const R = C.cbcBuildCombos(svcOf(C, X, cs));
  R.forEach(r => { const g = C.cbcLlDiag(X, r.terms, cs); near(g.M, r.Mu, r.name + ' M_u', 1e-9); near(g.V, r.Vu, r.name + ' V_u', 1e-9); });
  const r = row(R, '1.2D + 1.6L + 0.5Lr'), g = C.cbcLlDiag(X, r.terms, cs);
  near(g.eM, 6, 'Σγ M entered = 1.2(5)'); near(g.Mc, 112, 'line part unchanged'); near(g.M, 118, 'M_u = 112 + 6');
  assert.ok(R.some(x => x.terms.some(t => t.k === 'W' && t.s < 0)), 'a reversed W row is checked');
});

// CBST2 (2026-11-18, engineer request): one-way slab, a pressure row q uses the slab design width as its tributary width unless a b is
// entered (override, b > 0). Hand check: 12 in strip, q = 100 psf -> b_trib = 12/12 = 1.00 ft, w = 100(1.00)/1000 = 0.100 klf (per ft strip);
// 20 ft simple span: M = 0.1(400)/8 = 5.00 k-ft, V = 0.1(10) = 1.00 kip. Actual width b = 48 in: b_trib = 4.00 ft, w = 0.400 klf.
test('CBST2 slab: q = 100 psf on a 12 in strip -> b_trib 1.00 ft (slab width), w 0.100 klf; an entered b is kept; beams unchanged', () => {
  const C = load(), ll = { L: 20, rows: [{ k: 'D', mode: 'q', q: 100, b: 0 }, { k: 'L', mode: 'q', q: 50, b: 2.5 }] };
  const X = C.cbcLineLoads(ll, { d: 6, Ag: 96, slabB: 12 });
  const rD = X.cases.D.rows[0], rL = X.cases.L.rows[0];
  assert.equal(rD.bAuto, true); near(rD.bU, 1, 'b_trib = slab width'); near(X.cases.D.w, 0.1, 'w_D'); near(X.cases.D.M, 5, 'M_D'); near(X.cases.D.V, 1, 'V_D');
  assert.equal(rL.bAuto, false); near(rL.bU, 2.5, 'entered b kept'); near(X.cases.L.w, 0.125, 'w_L (entered b)');
  near(C.cbcLineLoads(ll, { d: 6, Ag: 384, slabB: 48 }).cases.D.w, 0.4, 'actual width 48 in: 4.00 ft');
  // a beam (no slabB): b as entered, 0 gives 0 (as before)
  const B = C.cbcLineLoads(ll, { d: 15.5, Ag: 216 }); assert.equal(B.cases.D.rows[0].bAuto, false); near(B.cases.D.w, 0, 'beam, b not entered');
  near(B.cases.L.w, 0.125, 'beam, b entered');
  // the saved row is not changed (b stays 0: the override is stored only when used)
  assert.equal(C.cbcLlNorm(ll).rows[0].b, 0);
});
