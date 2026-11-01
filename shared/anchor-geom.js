/* shared/anchor-geom.js — plan geometry for anchor groups on circles (window.SharedAnchorGeom).
   Classic script, no DOM, no state. Created 2026-11-01 for BasePlateAnchorDesigner.html (bolt-circle pattern,
   circular pier). Pure functions of plain numbers, so they are tested in Node (tests/engine/anchor-geom.test.mjs).
   Coordinates in inches, angles in degrees unless the name says Rad. Nothing here is a code provision: it is the
   exact plane geometry the ACI 318-19 Ch. 17 projected areas and edge distances need when the edge is a circle.

   circlePoints(n, BC, theta0)      n points on a bolt circle of diameter BC, the first at theta0 (deg, CCW from +x).
   rectDiscArea(x1,x2,y1,y2,cx,cy,R) exact area of the rectangle [x1,x2]×[y1,y2] inside the disc (centre cx,cy; radius R).
   unionRectsDiscArea(rects,cx,cy,R) exact area of (union of axis-aligned rectangles [x1,x2,y1,y2]) ∩ disc, by cell
                                     decomposition on the rectangles' x/y breakpoints (each cell ∩ disc in closed form).
   rayToCircle(px,py,ux,uy,cx,cy,R) distance from an interior point along the unit direction (ux,uy) to the circle.
   radialEdge(px,py,cx,cy,R)        shortest distance from an interior point to the circle, R − |p − c|.
   supportEdge(pts,ux,uy,cx,cy,R)   distance from the group to the tangent of the circle whose outward normal is (ux,uy):
                                     R + c·u − max_i(p_i·u)  (the "edge distance" of the group toward that tangent edge).
   tangentEdge(px,py,ux,uy,cx,cy,R) the tangent-edge model for shear toward a round edge: the exit point E of the ray from
                                     p along u, the outward normal n at E, and the distance from p to the tangent at E,
                                     measured along n: c = R − (p − c)·n (≤ the ray distance). */
(function () {
  'use strict';
  const D2R = Math.PI / 180;

  function circlePoints(n, BC, theta0) {
    n = Math.max(1, Math.round(n)); const R = BC / 2, a0 = (+theta0 || 0) * D2R, out = [];
    for (let k = 0; k < n; k++) {
      const a = a0 + 2 * Math.PI * k / n;
      let x = R * Math.cos(a), y = R * Math.sin(a);
      if (Math.abs(x) < 1e-12) x = 0; if (Math.abs(y) < 1e-12) y = 0;   // exact zeros on the axes
      out.push({ x, y, ang: ((a / D2R) % 360 + 360) % 360 });
    }
    return out;
  }

  /* ∫ sqrt(R² − u²) du = (u·sqrt(R² − u²) + R²·asin(u/R)) / 2, for |u| ≤ R */
  function Hint(u, R) { const v = Math.max(-R, Math.min(R, u)); return 0.5 * (v * Math.sqrt(Math.max(0, R * R - v * v)) + R * R * Math.asin(v / R)); }

  /* area of [x1,x2]×[y1,y2] ∩ disc(0,0,R): ∫ over u of the vertical overlap of [y1,y2] with [−h(u), h(u)],
     h = sqrt(R² − u²). The overlap is one of y2−y1, h−y1, y2+h, 2h or 0 on intervals between the breakpoints
     u = ±R, ±sqrt(R² − y1²), ±sqrt(R² − y2²), x1, x2; each piece integrates in closed form. */
  function rectDiscArea0(x1, x2, y1, y2, R) {
    if (!(x2 > x1) || !(y2 > y1) || !(R > 0)) return 0;
    const a = Math.max(x1, -R), b = Math.min(x2, R); if (!(b > a)) return 0;
    const br = [a, b];
    [y1, y2].forEach(y => { if (Math.abs(y) < R) { const s = Math.sqrt(R * R - y * y); br.push(s, -s); } });
    const xs = br.filter(u => u >= a && u <= b).sort((p, q) => p - q);
    let A = 0;
    for (let i = 0; i < xs.length - 1; i++) {
      const u0 = xs[i], u1 = xs[i + 1]; if (!(u1 > u0)) continue;
      const um = 0.5 * (u0 + u1), h = Math.sqrt(Math.max(0, R * R - um * um));
      const top = Math.min(y2, h), bot = Math.max(y1, -h); if (!(top > bot)) continue;
      const Hh = Hint(u1, R) - Hint(u0, R), L = u1 - u0;
      const tH = (y2 >= h), bH = (y1 <= -h);           // top is the arc / bottom is the arc on this piece
      A += (tH ? Hh : y2 * L) - (bH ? -Hh : y1 * L);
    }
    return A;
  }
  function rectDiscArea(x1, x2, y1, y2, cx, cy, R) { return rectDiscArea0(x1 - cx, x2 - cx, y1 - cy, y2 - cy, R); }

  function unionRectsDiscArea(rects, cx, cy, R) {
    const sq = (rects || []).filter(r => r[1] > r[0] && r[3] > r[2]);
    if (!sq.length) return { area: 0, rectArea: 0, cells: 0 };
    const xe = [...new Set(sq.flatMap(r => [r[0], r[1]]))].sort((a, b) => a - b);
    const ye = [...new Set(sq.flatMap(r => [r[2], r[3]]))].sort((a, b) => a - b);
    let area = 0, rectArea = 0, cells = 0;
    for (let i = 0; i < xe.length - 1; i++) for (let j = 0; j < ye.length - 1; j++) {
      const mx = 0.5 * (xe[i] + xe[i + 1]), my = 0.5 * (ye[j] + ye[j + 1]);
      if (!sq.some(r => mx > r[0] && mx < r[1] && my > r[2] && my < r[3])) continue;
      cells++; rectArea += (xe[i + 1] - xe[i]) * (ye[j + 1] - ye[j]);
      area += rectDiscArea(xe[i], xe[i + 1], ye[j], ye[j + 1], cx, cy, R);
    }
    return { area, rectArea, cells };
  }

  function rayToCircle(px, py, ux, uy, cx, cy, R) {
    const qx = px - cx, qy = py - cy, b = qx * ux + qy * uy, c = qx * qx + qy * qy - R * R;
    const disc = b * b - c; if (disc < 0) return 0;
    return Math.max(0, -b + Math.sqrt(disc));
  }
  function radialEdge(px, py, cx, cy, R) { return R - Math.hypot(px - cx, py - cy); }
  function supportEdge(pts, ux, uy, cx, cy, R) {
    let m = -Infinity; (pts || []).forEach(p => { const v = p.x * ux + p.y * uy; if (v > m) m = v; });
    return R + (cx * ux + cy * uy) - m;
  }
  function tangentEdge(px, py, ux, uy, cx, cy, R) {
    const t = rayToCircle(px, py, ux, uy, cx, cy, R);
    const ex = px + t * ux, ey = py + t * uy, nx = (ex - cx) / R, ny = (ey - cy) / R;
    const c = R - ((px - cx) * nx + (py - cy) * ny);
    return { ray: t, ex, ey, nx, ny, tx: -ny, ty: nx, c: Math.max(0, c), cosB: nx * ux + ny * uy };
  }

  window.SharedAnchorGeom = { circlePoints, rectDiscArea, unionRectsDiscArea, rayToCircle, radialEdge, supportEdge, tangentEdge };
})();
