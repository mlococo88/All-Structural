// SKP (2026-11-10, engineer: "the bearing line skew seems off"): the framing plan sketch (apps/steel-bridge/ui/framing.js plan(), on the
// Framing & bracing and Bridge layout input tabs, the Cross-frames tab, the Summary tab and the Report) is drawn at one scale in both
// directions, so each support line is drawn at its skew. Before, the width was stretched to 60 to 260 px whatever the length (a 30° skew
// drew at 13.3° on the 360 ft built-in bridge and at 40.8° on a 40 ft span, 11 girders at 4 ft). Display only: the bearing stations come
// from engine/framing.js unchanged (checked here against x = x_support + (y − y_c) tan θ, the convention of the hand-off notes).
import assert from 'node:assert/strict';
import { test } from './harness.mjs';
import { load } from './gfx-fixture.mjs';

const W = load(), M = W.SBDModel, FRM = W.SBDFraming, UI = W.SBDFramingUI, J = o => JSON.parse(JSON.stringify(o));
function proj(spans, sk, nb = 11, bay = 4) { const P = J(M.defaultProject()); P.spans.lengths = spans; P.xs = M.defaultXs(P); P.xs.nb = nb; P.xs.bays = new Array(nb - 1).fill(bay); P.xs.skews = new Array(spans.length + 1).fill(sk); return P; }
const lines = (svg, col) => [...svg.matchAll(new RegExp(`<line x1="([-\\d.]+)" y1="([-\\d.]+)" x2="([-\\d.]+)" y2="([-\\d.]+)" stroke="${col}"`, 'g'))].map(m => m.slice(1).map(Number));

test('SKP: every support line is drawn at its skew from the normal to the girders; θ labelled; the end frames on it; bearings per engine/framing.js', () => {
  let n = 0;
  for (const spans of [[110, 140, 110], [100], [60], [40], [20, 300, 20]]) for (const sk of [0, 15, 30, 45, -15, -30, -45]) {
    const P = proj(spans, sk), L = FRM.compute(P); assert.equal(L.errors.length, 0, L.errors.join(' '));
    const FR = L.FR, ys = FR.ys, wid = ys[ys.length - 1], nb = ys.length;
    // the bearings (engine): Abut. 1 of girder i at (y_i − y_c) tan θ; G1 at y = 0 (left looking ahead station), so + skew puts G11's end ahead
    ys.forEach((y, i) => assert.ok(Math.abs(FR.xb(0, i) - (y - wid / 2) * Math.tan(sk * Math.PI / 180)) < 1e-9, `bearing G${i + 1}`));
    for (const ui of [false, true]) {
      const html = UI.plan(L, false, ui ? { ui: true } : undefined), svg = ui ? html.match(/<svg[^>]*data-fpv="t"[\s\S]*?<\/svg>/)[0] : html;
      const S = lines(svg, '#94a3b8'); assert.equal(S.length, spans.length + 1, 'support lines');
      S.forEach(([x1, y1, x2, y2], k) => { const ang = Math.atan2(x2 - x1, y2 - y1) * 180 / Math.PI;   // from the normal to the girders (the plan's vertical), + = the lower end ahead
        assert.ok(Math.abs(ang - sk) < 0.06, `${spans.join('-')} ft, ${sk}°: support ${k} drawn at ${ang.toFixed(3)}°`);
        // the end frames of this support lie on its line
        lines(svg, '#B45309').filter((_, q) => FR.frames.filter(f => f.type === 'sup')[q].k === k).forEach(([a, b, c, d]) => [[a, b], [c, d]].forEach(([px, py]) => {
          const dist = Math.abs((x2 - x1) * (py - y1) - (y2 - y1) * (px - x1)) / Math.hypot(x2 - x1, y2 - y1); assert.ok(dist < 0.15, `end frame on support ${k}: ${dist}`); })); });
      const th = [...svg.matchAll(/data-skew="(\d+)">θ = ([−\d.]+)°/g)].map(m => +m[2].replace('−', '-')); assert.deepEqual(th, new Array(spans.length + 1).fill(sk), 'θ labels');
      assert.match(svg, /true scale in both directions/);
      // the girder lines at least 14 units apart (labels 9 units)
      const gy = lines(svg, '#2563EB').map(l => l[1]); gy.slice(1).forEach((v, i) => assert.ok(v - gy[i] >= 14 - 1e-6, `girder spacing ${v - gy[i]}`));
      n++;
    }
    // the long-bridge toggle: offered where the true-scale plan is long and thin, its exaggerated plan says so
    const html = UI.plan(L, false, { ui: true }), Lx = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])) - Math.min(...FR.girders.map(g => g.x0));
    assert.equal(/data-fpex/.test(html), Lx / wid > 5, `toggle offered for L/W = ${(Lx / wid).toFixed(1)}`);
    if (Lx / wid > 5) { const sx = html.match(/<svg[^>]*data-fpv="x"[\s\S]*?<\/svg>/)[0]; assert.match(sx, /width exaggerated ×[\d.]+: the angles are not to scale; θ is the true skew/); assert.match(sx, /display:none/); }
  }
  console.log(`       ${n} plans (5 bridges × 7 skews, screen and Report): every support line within 0.06° of its skew, end frames on it, θ labels`);
});
