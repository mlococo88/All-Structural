/* apps/crane-pick/engine/worked.js — the worked steps of the Crane Pick Analyzer's computed values (window.CranePickWorked). Classic
   script, no DOM. C1 (2026-11-16). Steps in the shared/steps.js format ({ id, label, sym, eq, sub, value, unit, d, ref, note }); the
   values are computed here with engine/geo.js (window.CranePickGeo) and engine/osha.js (window.CranePickOSHA), read at call time, so
   the Site tab, the Report and the tests show the same numbers. Units: ft, ft², degrees; px for sheet pixels. */
(function () {
  'use strict';
  const G = () => window.CranePickGeo, O = () => window.CranePickOSHA;
  const f = (x, d) => { if (typeof x !== 'number' || !isFinite(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const deg = r => r * 180 / Math.PI;
  /* dimension (a -> b): Δx, Δy, L, azimuth, bearing */
  function dim(a, b, pre) {
    const g = G(), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), az = g.azimuth(a, b);
    return { L, az, bearing: g.bearingText(az), steps: [
      st(pre, { id: 'dx', label: 'Easting difference', sym: '\\Delta x', eq: 'x_{2} - x_{1}', sub: `${f(b.x, 2)} - ${f(a.x, 2)}`, value: dx, unit: 'ft' }),
      st(pre, { id: 'dy', label: 'Northing difference', sym: '\\Delta y', eq: 'y_{2} - y_{1}', sub: `${f(b.y, 2)} - ${f(a.y, 2)}`, value: dy, unit: 'ft' }),
      st(pre, { id: 'L', label: 'Distance (grid)', sym: 'L', eq: '\\sqrt{\\Delta x^{2} + \\Delta y^{2}}', sub: `\\sqrt{${f(dx, 2)}^{2} + ${f(dy, 2)}^{2}}`, value: L, unit: 'ft' }),
      st(pre, { id: 'az', label: 'Azimuth from grid north, clockwise', sym: '\\alpha', eq: '\\text{atan2}(\\Delta x, \\Delta y)', sub: `\\text{atan2}(${f(dx, 2)}, ${f(dy, 2)})`, value: az, unit: 'deg', d: 4,
        note: 'Bearing ' + g.bearingText(az) + ' (grid).' })
    ] };
  }
  /* polyline length, polygon area and perimeter */
  function shape(pts, closed, pre) {
    const g = G(), n = pts.length, steps = [];
    if (closed) {
      const A = g.area(pts), P = g.perimeter(pts);
      steps.push(st(pre, { id: 'A', label: `Plan area (shoelace formula, ${n} vertices)`, sym: 'A', eq: '\\frac{1}{2}|\\sum (x_{i} y_{i+1} - x_{i+1} y_{i})|', sub: `\\frac{1}{2}|${f(2 * g.signedArea(pts), 1)}|`, value: A, unit: 'ft^{2}', d: 1 }));
      steps.push(st(pre, { id: 'P', label: 'Perimeter', sym: 'P', eq: '\\sum L_{i}', sub: `\\sum_{i=1}^{${n}} L_{i}`, value: P, unit: 'ft', d: 1 }));
      return { A, P, steps };
    }
    const L = g.polyLength(pts);
    steps.push(st(pre, { id: 'L', label: `Length along the line (${n - 1} segment${n > 2 ? 's' : ''})`, sym: 'L', eq: '\\sum L_{i}', sub: n > 2 ? `\\sum_{i=1}^{${n - 1}} L_{i}` : f(L, 2), value: L, unit: 'ft', d: 1 }));
    return { L, steps };
  }
  /* sheet scale calibration: s = D / d_px */
  function cal(sheet, pre) {
    const c = sheet && sheet.cal; if (!c) return null;
    const r = G().calScale(c.p1, c.p2, c.dist), dpx = r.dpx;
    return { s: r.s, steps: [
      st(pre, { id: 'dpx', label: 'Distance between the two picked points on the sheet', sym: 'd_{px}', eq: '\\sqrt{(p_{x2} - p_{x1})^{2} + (p_{y2} - p_{y1})^{2}}',
        sub: `\\sqrt{(${f(c.p2.px, 1)} - ${f(c.p1.px, 1)})^{2} + (${f(c.p2.py, 1)} - ${f(c.p1.py, 1)})^{2}}`, value: dpx, unit: 'px', d: 1 }),
      st(pre, { id: 'D', label: 'Real distance between the points (entered)', sym: 'D', eq: '', sub: '', value: c.dist, unit: 'ft', d: 2 }),
      st(pre, { id: 's', label: 'Sheet scale', sym: 's', eq: '\\frac{D}{d_{px}}', sub: `\\frac{${f(c.dist, 2)}}{${f(dpx, 1)}}`, value: r.s, unit: 'ft/px', d: 5 })
    ] };
  }
  /* georeference from two points: scale and rotation of the sheet (zone units converted to ftUS) */
  function geo(sheet, zoneId, pre) {
    const g0 = sheet && sheet.geo; if (!g0) return null;
    const g = G(), g1 = { x: g.nativeToFt(zoneId, g0.g1.E), y: g.nativeToFt(zoneId, g0.g1.N) }, g2 = { x: g.nativeToFt(zoneId, g0.g2.E), y: g.nativeToFt(zoneId, g0.g2.N) };
    const r = g.georef(g0.p1, g0.p2, g1, g2); if (!r) return null;
    const dpx = r.dpx, Lg = r.dft, aG = Math.atan2(g2.y - g1.y, g2.x - g1.x), aP = Math.atan2(-(g0.p2.py - g0.p1.py), g0.p2.px - g0.p1.px);
    const m = g.zone(zoneId).unit === 'm';
    const steps = [];
    if (m) steps.push(st(pre, { id: 'conv', label: 'Zone coordinates in metres converted to US survey feet', sym: '1\\,\\text{ftUS}', eq: '\\frac{1200}{3937}\\,\\text{m}', sub: '', value: g.FT_US, unit: 'm', d: 10 }));
    steps.push(
      st(pre, { id: 'Lg', label: 'Grid distance between the two control points', sym: 'L_{g}', eq: '\\sqrt{(E_{2} - E_{1})^{2} + (N_{2} - N_{1})^{2}}', sub: `\\sqrt{(${f(g2.x, 2)} - ${f(g1.x, 2)})^{2} + (${f(g2.y, 2)} - ${f(g1.y, 2)})^{2}}`, value: Lg, unit: 'ft' }),
      st(pre, { id: 'dpx', label: 'Distance between the two points on the sheet', sym: 'd_{px}', eq: '\\sqrt{(p_{x2} - p_{x1})^{2} + (p_{y2} - p_{y1})^{2}}', sub: `\\sqrt{(${f(g0.p2.px, 1)} - ${f(g0.p1.px, 1)})^{2} + (${f(g0.p2.py, 1)} - ${f(g0.p1.py, 1)})^{2}}`, value: dpx, unit: 'px', d: 1 }),
      st(pre, { id: 's', label: 'Sheet scale from the georeference', sym: 's', eq: '\\frac{L_{g}}{d_{px}}', sub: `\\frac{${f(Lg, 2)}}{${f(dpx, 1)}}`, value: r.s, unit: 'ft/px', d: 5 }),
      st(pre, { id: 'rot', label: 'Sheet rotation (counter-clockwise from grid east, sheet +x axis)', sym: '\\theta', eq: '\\text{atan2}(\\Delta N, \\Delta E) - \\text{atan2}(-\\Delta p_{y}, \\Delta p_{x})', sub: `${f(deg(aG), 4)} - (${f(deg(aP), 4)})`, value: deg(r.rot), unit: 'deg', d: 4,
        note: 'Normalized to −180° … 180°. Two points fix the scale, rotation and position exactly (no check of the fit); a third known point checked on the map is recommended.' })
    );
    let chk = null;
    if (sheet.cal) { const c = cal(sheet, pre + '.cal'); if (c && isFinite(c.s)) { chk = (c.s - r.s) / r.s; steps.push(st(pre, { id: 'chk', label: 'Check against the scale calibration', sym: '\\frac{s_{cal} - s}{s}', eq: '', sub: `\\frac{${f(c.s, 5)} - ${f(r.s, 5)}}{${f(r.s, 5)}}`, value: chk * 100, unit: '\\%', d: 2 })); } }
    return { r, chk, steps };
  }
  /* sheet scale from the plan's stated scale (1 in = S ft) and the PDF page width: s = S · W_in / W_px */
  function planScale(sheet, pre) {
    if (!sheet || !(sheet.planScale > 0) || !sheet.pageIn) return null;
    const s = sheet.planScale * sheet.pageIn.w / sheet.w;
    return { s, steps: [
      st(pre, { id: 'S', label: 'Stated plan scale (entered): 1 in on the sheet', sym: 'S', eq: '', sub: '', value: sheet.planScale, unit: 'ft/in', d: 3 }),
      st(pre, { id: 'Win', label: 'Page width (PDF page size)', sym: 'W_{in}', eq: '', sub: '', value: sheet.pageIn.w, unit: 'in', d: 3 }),
      st(pre, { id: 'Wpx', label: 'Image width (rendered)', sym: 'W_{px}', eq: '', sub: '', value: sheet.w, unit: 'px', d: 0 }),
      st(pre, { id: 's', label: 'Sheet scale', sym: 's', eq: '\\frac{S \\cdot W_{in}}{W_{px}}', sub: `\\frac{${f(sheet.planScale, 3)} \\cdot ${f(sheet.pageIn.w, 3)}}{${f(sheet.w, 0)}}`, value: s, unit: 'ft/px', d: 5,
        note: 'Valid only when the PDF is at the plan\'s full size (not a reduced print); check it against a known dimension (scale calibration).' })
    ] };
  }
  /* power-line clearance (Table A) */
  function clearance(item, pre) { return O().clearance({ kv: item.kv, le350: item.le350, setFt: item.setFt }, pre); }
  window.CranePickWorked = { dim, shape, cal, geo, planScale, clearance, fmt: f };
})();
