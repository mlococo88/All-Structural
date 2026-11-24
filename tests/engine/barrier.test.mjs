// shared/barrier.js (window.SharedBarrier): a barrier's cross-section from its geometry (BARG, 2026-11-24). Hand cases a reviewer can redo:
//   Rectangle 12 in × 42 in, γ 0.150 kcf: A = 12(42) = 504 in², w = 504/144 × 0.150 = 0.525 klf, b_deck = 12/12 = 1.000 ft, x̄ = 12/2 = 6 in = 0.500 ft.
//   Six-point polygon (0,0) (18,0) (18,3) (9,12) (6,42) (0,42):
//     c_i = x_i y_i+1 − x_i+1 y_i = 0, 18·3 − 18·0 = 54, 18·12 − 9·3 = 189, 9·42 − 6·12 = 306, 6·42 − 0·42 = 252, 0·0 − 0·42 = 0; Σ = 801
//     A = 801/2 = 400.5 in², w = 400.5/144 × 0.150 = 0.41719 klf; Σ(x_i + x_i+1)c_i = 36·54 + 27·189 + 15·306 + 6·252 = 13 149 in³,
//     x̄ = 13 149/(6 × 400.5) = 5.4719 in = 0.45599 ft; b_deck = 18 in = 1.500 ft; h = 42 in.
//   Sloped face, vertical back, b = 15, b_t = 6, h = 42 in: A = (15 + 6)/2 × 42 = 441 in², x̄ = (225 + 90 + 36)/(3 × 21) = 5.5714 in.
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';

const ctx = loadShared('steps.js', 'barrier.js');
const B = ctx.SharedBarrier, SS = ctx.SharedSteps;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b} (tol ${tol})`);
const J = o => JSON.parse(JSON.stringify(o));
const HEX = [[0, 0], [18, 0], [18, 3], [9, 12], [6, 42], [0, 42]];

test('rectangle 12 × 42 in, γ 0.150: A 504 in², w 0.525 klf, width 1.00 ft, x̄ 0.50 ft (hand check)', () => {
  const G = B.compute(B.spec({ bShape: 'rect', bDims: { b: 12, h: 42 } }));
  assert.equal(G.ok, true); near(G.A, 504, 1e-12, 'A'); near(G.w, 0.525, 1e-15, 'w'); near(G.bDeck, 1, 1e-15, 'b_deck'); near(G.xc, 0.5, 1e-15, 'x̄'); near(G.h, 42, 0, 'h');
  near(G.gam, 0.150, 0, 'γ default'); assert.equal(B.GAMMA, 0.150);
  near(B.compute(B.spec({ bShape: 'rect', bDims: { b: 12, h: 42 }, bGam: 0.145 })).w, 504 / 144 * 0.145, 1e-15, 'γ entered');
});

test('six-point polygon: shoelace by hand (A 400.5 in², x̄ 5.4719 in, b_deck 1.5 ft); either direction; closed outline accepted', () => {
  const G = B.compute(B.spec({ bShape: 'poly', bPts: HEX }));
  assert.equal(G.ok, true); assert.deepEqual(J(G.terms), [0, 54, 189, 306, 252, 0]); near(G.S, 801, 1e-12, 'Σc'); near(G.A, 400.5, 1e-12, 'A');
  near(G.w, 400.5 / 144 * 0.15, 1e-15, 'w'); near(G.w, 0.41719, 5e-6, 'w 0.41719'); near(G.Sx, 13149, 1e-9, 'Σ(x+x)c'); near(G.xcIn, 13149 / 2403, 1e-12, 'x̄ in');
  near(G.xc, 0.45599, 5e-6, 'x̄ ft'); near(G.bDeck, 1.5, 0, 'b_deck'); near(G.h, 42, 0, 'h');
  const R = B.compute(B.spec({ bShape: 'poly', bPts: HEX.slice().reverse() })); near(R.A, G.A, 1e-12, 'A clockwise'); near(R.xcIn, G.xcIn, 1e-12, 'x̄ clockwise'); assert.ok(R.As < 0);
  const C = B.compute(B.spec({ bShape: 'poly', bPts: [...HEX, [0, 0]] })); near(C.A, G.A, 0, 'closed'); assert.equal(C.pts.length, 6);
});

test('closed forms of rect and slope = the shoelace of their outlines', () => {
  for (const [b, bt, h] of [[15, 6, 42], [9, 9, 32], [8, 14, 36], [24, 8, 54]]) {
    const G = B.compute({ shape: 'slope', b, bt, h, gam: 0.15 }), P = B.compute({ shape: 'poly', pts: B.outline({ shape: 'slope', b, bt, h }), gam: 0.15 });
    near(G.A, (b + bt) / 2 * h, 1e-9, 'trapezoid A'); near(G.xcIn, (b * b + b * bt + bt * bt) / (3 * (b + bt)), 1e-9, 'trapezoid x̄'); near(P.A, G.A, 0, 'same'); near(P.xcIn, G.xcIn, 0, 'same');
    near(G.bIn, b, 0, 'base on the deck');
  }
  const G = B.compute({ shape: 'slope', b: 15, bt: 6, h: 42, gam: 0.15 }); near(G.A, 441, 1e-12, 'A 441'); near(G.xcIn, 5.571428571, 1e-8, 'x̄ 5.5714');
});

test('validation: dimensions, γ, points (fewer than 3, not numbers, below the deck, self-intersecting, collinear, no edge on the deck)', () => {
  const er = s => J(B.compute(s).errors.map(e => e.key + ': ' + e.msg));
  assert.deepEqual(er(B.spec({ bShape: 'rect', bDims: { b: 0, h: null } })), ['b: the barrier base width must be positive (in)', 'h: the barrier height must be positive (in)']);
  assert.deepEqual(er(B.spec({ bShape: 'slope', bDims: { b: 12, h: 30 } })), ['bt: the barrier top width must be positive (in)']);
  assert.deepEqual(er(B.spec({ bShape: 'rect', bDims: { b: 12, h: 42 }, bGam: 0 })), ['gam: the barrier unit weight must be positive (kcf)']);
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 0], [1, 0]] }))[0], /at least 3 points/);
  assert.match(er(B.spec({ bShape: 'poly', bPts: B.parsePts('0,0; 12,0; x,4') }))[0], /must be numbers/);
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 0], [12, 0], [12, 42], [-1, 42]] }))[0], /x ≥ 0/);
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 0], [10, 10], [10, 0], [0, 10]] }))[0], /simple polygon \(edge 1–2 crosses/);
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 0], [12, 0], [12, 0], [0, 42]] }))[0], /repeats/);
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 0], [12, 0], [6, 0]] }))[0], /fold back|in one line/);
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 0], [12, 0], [12, 10], [6, 0.0], [0, 10]] }))[0], /simple polygon/);   // a vertex touching the deck edge
  assert.match(er(B.spec({ bShape: 'poly', bPts: [[0, 2], [12, 2], [12, 42], [0, 42]] }))[0], /edge on the deck/);
  assert.equal(B.compute(B.spec({ bShape: 'poly', bPts: [] })).ok, false);
});

test('width at the deck: the inner toe; an outer toe set back from the deck edge is noted', () => {
  const G = B.compute({ shape: 'poly', pts: [[2, 0], [14, 0], [10, 40], [2, 40]], gam: 0.15 });
  near(G.bDeck, 14 / 12, 1e-15, 'inner toe'); near(G.x0In, 2, 0, 'outer toe');
  const st = B.steps(G, { prefix: 'p', base: 'bar' }); assert.match(st.find(s => s.id === 'p.bar.b').note, /2\.00 in in from the deck edge/);
});

test('worked steps: ids, values equal the results, weight step renamed by wId; parsePts / ptsText round trip', () => {
  const G = B.compute(B.spec({ bShape: 'poly', bPts: HEX })), st = B.steps(G, { prefix: 'dl', base: 'load.barL.geo', wId: 'load.barL' });
  assert.deepEqual(J(st.map(s => s.id)), ['dl.load.barL.geo.S', 'dl.load.barL.geo.A', 'dl.load.barL.geo.h', 'dl.load.barL', 'dl.load.barL.geo.b', 'dl.load.barL.geo.xc']);
  const v = Object.fromEntries(st.map(s => [s.id, s.value])); near(v['dl.load.barL'], G.w, 0, 'w'); near(v['dl.load.barL.geo.A'], 400.5, 0, 'A'); near(v['dl.load.barL.geo.xc'], G.xc, 0, 'x̄');
  assert.match(SS.line(st[0], false), /0\.00 \+ 54\.00 \+ 189\.00 \+ 306\.00 \+ 252\.00 \+ 0\.00 = 801\.00/);
  assert.match(SS.line(st[3], false), /400\.50\/144\(0\.150\) = 0\.4172 klf/);
  const R = B.compute(B.spec({ bShape: 'rect', bDims: { b: 12, h: 42 } })), sr = B.steps(R, { prefix: 'x', base: 'b' });
  assert.deepEqual(J(sr.map(s => s.id)), ['x.b.A', 'x.b.w', 'x.b.b', 'x.b.xc']); assert.match(SS.line(sr[1], false), /504\.00\/144\(0\.150\) = 0\.5250 klf/);
  assert.deepEqual(J(B.parsePts(B.ptsText(HEX))), HEX); assert.deepEqual(J(B.parsePts('(0, 0)\n(12 0); 12,42')), [[0, 0], [12, 0], [12, 42]]);
  assert.match(B.svg(G, { side: 'R' }), /^<svg[\s\S]*<polygon points="[\d., ]+"/); assert.equal(B.svg({ ok: false }), '');
});
