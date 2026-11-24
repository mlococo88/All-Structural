// apps/steel-bridge DKFE (2026-11-24, engineer: the Deck tab's section figure consistent with the renderers of FOB #1701 / GEOM #1705):
// ui/deck.js figure(R, W, P) draws the left deck edge as the Drawings tab (engine/drawings.js appOf): the sidewalk, the barrier (the
// schematic outline BAR_SCH of an entered barrier, the shared/barrier.js outline of one entered by its geometry) or the curb, and the
// railing / fence standing on the barrier or curb top (SBDDrawings.topAt). Display only: R (engine/deck.js calc) is the same object before
// and after drawing, and the same with and without the edge elements drawn. Made-up projects (the built-in default project).
// Hand checks (heights above the slab at kv = min(k, 26/34) px/in; widths at k = (760 - 58)/x1 px/in):
//   (a) sidewalk 6 ft x 8 in, entered barrier 1.5 ft: base 8 in, top 34 in; fence at 0.5 ft = 6 in <= 0.42 x 18 = 7.56 in: base 8 + 34 = 42 in
//   (b) curb 12 x 10 in, railing at 0.5 ft = 6 in <= 12 in: base 10 in (the curb top)
//   (c) Geometry rectangle 12 x 42 in on the 8 in sidewalk, fence at 0.5 ft: base 8 + 42 = 50 in; outline 4 points
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const W = loadShared('units.js', 'steps.js', 'lldf.js', 'dxf.js', 'barrier.js', 'deck.js', ...['engine/model.js', 'engine/owners.js', 'engine/sections.js', 'engine/lldf.js', 'engine/loads.js', 'engine/shear.js',
  'engine/stiffeners.js', 'engine/flexure.js', 'engine/framing.js', 'engine/crossframes.js', 'engine/drawings.js', 'engine/deck.js', 'ui/deck.js'].map(E));
const M = W.SBDModel, DK = W.SBDDeck, UI = W.SBDDeckUI, J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs hand ${b}`);
const base = o => { const P = J(M.defaultProject()); P.deckDesign = { on: true }; if (o) o(P); return P; };
const A = { bar: P => { P.xs.sidewalks.L = { w: 6, t: 8, fence: 0.05, fenceX: 0.5 }; P.xs.sidewalks.ped = 75; },
  curb: P => { P.xs.edges.L = { ...P.xs.edges.L, type: 'curb', cw: 12, ch: 10, rw: 0.05, rp: 0.5 }; },
  geom: P => { P.xs.edges.L = { ...P.xs.edges.L, bMode: 'geom', bShape: 'rect', bDims: { b: 12, h: 42 } }; A.bar(P); } };
// the figure's scales (ui/deck.js figure): x1 = o_h + S + min(0.4 S, 30) in
const sc = (R, topIn) => { const oh = R.oh.L.O.oh * 12, Sp = R.bays[0].S * 12, x1 = oh + Sp + Math.min(Sp * 0.4, 30), k = (760 - 58) / x1, kv = Math.min(k, 26 / 34), mt = Math.max(58, Math.round(topIn * kv + 32));
  return { k, kv, X: x => 14 + x * k, Yv: y => mt - y * kv }; };
const post = (s, kind) => { const m = s.match(new RegExp(`<g data-dkedge="${kind}" data-base="([^"]+)"><line x1="([^"]+)" y1="([^"]+)" x2="[^"]+" y2="([^"]+)"`)); assert.ok(m, kind); return { base: +m[1], x: +m[2], y1: +m[3], y2: +m[4] }; };
const poly = s => { const m = s.match(/<polygon data-dkedge="bar" points="([^"]+)"/); assert.ok(m, 'barrier polygon'); return m[1].split(' ').map(p => p.split(',').map(Number)); };

test('(a) barrier on a sidewalk, fence over the barrier: the schematic outline (as the Drawings tab) on the sidewalk, the fence on its flat top', () => {
  const P = base(A.bar), R = DK.calc(P), r0 = J(R), s = UI.figure(R, 760, P);
  assert.deepEqual(J(R), r0, 'R unchanged by drawing');
  assert.equal((s.match(/data-dkedge="sw"/g) || []).length, 1); assert.equal((s.match(/data-dkedge="bar"/g) || []).length, 1);
  const f = post(s, 'fence'); assert.equal(f.base, 42, 'fence base 8 + 34 in');
  const g = sc(R, 84); near(f.x, g.X(6), 1e-9, 'fence at 6 in'); near(f.y1, g.Yv(42), 1e-9, 'post foot on the barrier top'); near(f.y2, g.Yv(84), 1e-9, 'post top');
  const pts = poly(s), w = 18; assert.equal(pts.length, 6);   // BAR_SCH
  W.SBDDrawings.BAR_SCH.forEach(([u, y], i) => { near(pts[i][0], g.X(u * w), 1e-9, 'u'); near(pts[i][1], g.Yv(8 + y * 34), 1e-9, 'y'); });
  assert.match(s, /Left deck edge: sidewalk 6\.00 ft × 8\.0 in; barrier 1\.50 ft at the deck \(shape and 34 in height schematic/);
  assert.match(s.replace(/<\/text><text[^>]*>/g, ' '), /railing or fence at 0\.50 ft on the barrier top/);
  // the bars, sections and longitudinal bars as without P
  assert.equal((s.match(/data-dkbar="(top|bot)-tr"/g) || []).length, 2); assert.equal((s.match(/<circle/g) || []).length, 0);
  // a fence beyond the barrier: on the sidewalk
  const Q = base(P => { A.bar(P); P.xs.sidewalks.L.fenceX = 3; }), sq = UI.figure(DK.calc(Q), 760, Q); assert.equal(post(sq, 'fence').base, 8);
});

test('(b) curb and railing: the curb drawn, the railing on the curb top', () => {
  const P = base(A.curb), R = DK.calc(P), s = UI.figure(R, 760, P);
  assert.equal((s.match(/data-dkedge="curb"/g) || []).length, 1); assert.equal((s.match(/data-dkedge="bar"/g) || []).length, 0);
  const r = post(s, 'rail'); assert.equal(r.base, 10); const g = sc(R, 52); near(r.y1, g.Yv(10), 1e-9, 'rail foot on the curb top');
  const c = s.match(/<rect data-dkedge="curb" x="([^"]+)" y="([^"]+)" width="([^"]+)" height="([^"]+)"/).slice(1).map(Number);
  near(c[0], g.X(0), 1e-9); near(c[1], g.Yv(10), 1e-9); near(c[2], 12 * g.k, 1e-9); near(c[3], 10 * g.kv, 1e-9);
  assert.match(s, /curb 12\.0 × 10\.0 in; railing at 0\.50 ft on the curb top/);
});

test('(c) Geometry-mode barrier, rectangle 12 x 42 in: its own outline, the fence on its top', () => {
  const P = base(A.geom), R = DK.calc(P), s = UI.figure(R, 760, P);
  const pts = poly(s), g = sc(R, 92); assert.equal(pts.length, 4);
  [[0, 0], [12, 0], [12, 42], [0, 42]].forEach(([u, y], i) => { near(pts[i][0], g.X(u), 1e-9); near(pts[i][1], g.Yv(8 + y), 1e-9); });
  const f = post(s, 'fence'); assert.equal(f.base, 50); near(f.y1, g.Yv(50), 1e-9);
  assert.match(s, /barrier 1\.00 ft at the deck × 42\.0 in, its outline from its geometry on the sidewalk/);
});

test('display only: R the same with and without the edge elements; without P the figure as before DKFE (schematic barrier)', () => {
  [A.bar, A.curb, A.geom, null].forEach(o => { const P = base(o), R1 = J(DK.calc(P)); UI.figure(DK.calc(P), 760, P); assert.deepEqual(J(DK.calc(P)), R1); });
  const P = base(), R = DK.calc(P), s0 = UI.figure(R, 760);
  assert.ok(!/data-dkedge/.test(s0)); assert.match(s0, /<polygon points="[^"]+" fill="#cbd5e1"/);
  // the built-in project with P: the entered barrier only, heights within the old top margin (58 px): the slab drawn where it was
  const s1 = UI.figure(R, 760, P), y = t => +t.match(/<rect x="[^"]+" y="([^"]+)" width="[^"]+" height="[^"]+" fill="#e2e8f0"/)[1];
  assert.equal(y(s1), y(s0)); assert.equal((s1.match(/data-dkedge="bar"/g) || []).length, 1); assert.ok(!/data-dkedge="(fence|rail|sw)"/.test(s1));
  // the longitudinal bars (DKL): the same circles with and without the edge elements
  const L = base(P => { A.bar(P); Object.assign(P.deckDesign, { barLongTop: 0.2, sLongTop: 12, barLongBot: 0.31, sLongBot: 9 }); }), RL = DK.calc(L);
  const cnt = t => ['top-long', 'bot-long'].map(c => (t.match(new RegExp(`data-dkbar="${c}"`, 'g')) || []).length);
  assert.deepEqual(cnt(UI.figure(RL, 760, L)), cnt(UI.figure(RL, 760))); assert.ok(cnt(UI.figure(RL, 760, L))[1] > 0);
});
