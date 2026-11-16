/* apps/crane-pick/engine/geo.js — coordinates and plane geometry of the Crane Pick Analyzer (window.CranePickGeo). Classic script, no DOM.
   C1 (2026-11-16, engineer decisions of that date). Every function takes plain numbers and returns plain objects, so it runs in Node
   (tests/engine/crane-geo.test.mjs). proj4 is passed in (the page's window.proj4, or the copy in tests/libs in Node).

   Frames and units
     Site frame ("grid"): the State Plane grid of the project's zone, in US survey feet: x = Easting, y = Northing (ft). Every stored
       position (items, plan-sheet placements) is in this frame. A zone defined in metres (EPSG:26986) is shown and entered in metres;
       its positions are still kept in US survey feet (1 ftUS = 1200/3937 m exactly).
     Distances are grid distances (no combined scale / elevation factor; for these zones and a crane site the difference from ground
       distance is of the order of 1:10,000 or less). Bearings are grid azimuths from grid north, clockwise.
     Latitude / longitude: NAD 83, taken as WGS 84 for the map (about 1 to 1.5 m in New England; the map is for placing items, not survey).
   Zones (proj4 definitions; the EPSG parameters, the ftUS false origins converted to metres as EPSG gives them):
     EPSG:2249  NAD83 / Massachusetts Mainland (ftUS)   LCC 2SP, lat_1 42°41', lat_2 41°43', lat_0 41°00', lon_0 71°30' W,
                                                        FE 656,166.667 ftUS (200,000.0001016 m), FN 2,460,625 ftUS (750,000 m)
     EPSG:26986 NAD83 / Massachusetts Mainland (m)      the same projection, FE 200,000 m, FN 750,000 m
     EPSG:2234  NAD83 / Connecticut (ftUS)              LCC 2SP, lat_1 41°52', lat_2 41°12', lat_0 40°50', lon_0 72°45' W,
                                                        FE 1,000,000 ftUS (304,800.6096 m), FN 500,000 ftUS (152,400.3048 m)
     EPSG:3438  NAD83 / Rhode Island (ftUS)             TM, lat_0 41°05', lon_0 71°30' W, k0 0.99999375,
                                                        FE 328,083.3333 ftUS (99,999.99998984 m), FN 0
   Sheet pixels: (px, py) from the image's top-left corner, py downward. Placement { x, y, s, rot }: grid ft of pixel (0, 0), feet per
     pixel, rotation (radians, counter-clockwise from grid east) of the image's +px axis. pixel -> grid: x + s·(cos·px + sin·py),
     y + s·(sin·px − cos·py) (the image's "up" is −py). */
(function () {
  'use strict';
  const FT_US = 1200 / 3937;   // m per US survey foot (exact)
  const ZONES = [
    { id: 'EPSG:2249', short: 'MA Mainland (ftUS)', name: 'NAD83 / Massachusetts Mainland (ftUS), EPSG:2249', unit: 'ftUS',
      def: '+proj=lcc +lat_0=41 +lon_0=-71.5 +lat_1=42.68333333333333 +lat_2=41.71666666666667 +x_0=200000.0001016 +y_0=750000 +ellps=GRS80 +units=us-ft +no_defs',
      home: { lat: 42.3601, lng: -71.0589 } },
    { id: 'EPSG:26986', short: 'MA Mainland (m)', name: 'NAD83 / Massachusetts Mainland (m), EPSG:26986', unit: 'm',
      def: '+proj=lcc +lat_0=41 +lon_0=-71.5 +lat_1=42.68333333333333 +lat_2=41.71666666666667 +x_0=200000 +y_0=750000 +ellps=GRS80 +units=m +no_defs',
      home: { lat: 42.3601, lng: -71.0589 } },
    { id: 'EPSG:2234', short: 'Connecticut (ftUS)', name: 'NAD83 / Connecticut (ftUS), EPSG:2234', unit: 'ftUS',
      def: '+proj=lcc +lat_0=40.83333333333334 +lon_0=-72.75 +lat_1=41.86666666666667 +lat_2=41.2 +x_0=304800.6096 +y_0=152400.3048 +ellps=GRS80 +units=us-ft +no_defs',
      home: { lat: 41.7658, lng: -72.6734 } },
    { id: 'EPSG:3438', short: 'Rhode Island (ftUS)', name: 'NAD83 / Rhode Island (ftUS), EPSG:3438', unit: 'ftUS',
      def: '+proj=tmerc +lat_0=41.08333333333334 +lon_0=-71.5 +k=0.99999375 +x_0=99999.99998984 +y_0=0 +ellps=GRS80 +units=us-ft +no_defs',
      home: { lat: 41.8240, lng: -71.4128 } }
  ];
  const WGS = '+proj=longlat +datum=WGS84 +no_defs';
  const DEFAULT_ZONE = 'EPSG:2249';
  const zone = id => ZONES.find(z => z.id === id) || ZONES[0];
  /* native (zone units) <-> US survey ft */
  const nativeToFt = (id, v) => zone(id).unit === 'm' ? v / FT_US : v;
  const ftToNative = (id, v) => zone(id).unit === 'm' ? v * FT_US : v;

  /* llToNative(proj4, id, lat, lng) -> { E, N } in the zone's own units; nativeToLl the inverse */
  function llToNative(proj4, id, lat, lng) { const r = proj4(WGS, zone(id).def, [lng, lat]); return { E: r[0], N: r[1] }; }
  function nativeToLl(proj4, id, E, N) { const r = proj4(zone(id).def, WGS, [E, N]); return { lat: r[1], lng: r[0] }; }
  /* the site frame (grid, US survey ft) */
  function llToFt(proj4, id, lat, lng) { const n = llToNative(proj4, id, lat, lng); return { x: nativeToFt(id, n.E), y: nativeToFt(id, n.N) }; }
  function ftToLl(proj4, id, x, y) { return nativeToLl(proj4, id, ftToNative(id, x), ftToNative(id, y)); }

  /* ---------- plane geometry (ft) ---------- */
  const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y });
  const dist = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
  /* azimuth (deg, 0 = grid north, clockwise, 0 <= az < 360) of the line a -> b */
  function azimuth(a, b) { let t = Math.atan2(b.x - a.x, b.y - a.y) * 180 / Math.PI; if (t < 0) t += 360; return t >= 360 ? t - 360 : t; }
  /* dms(deg) -> [d, m, s] rounded to whole seconds (carry handled) */
  function dms(v) { let t = Math.round(Math.abs(v) * 3600); const d = Math.floor(t / 3600); t -= d * 3600; const m = Math.floor(t / 60); return [d, m, t - m * 60]; }
  /* quadrant bearing text of an azimuth: 'N 45°12′30″ E' */
  function bearingText(az) {
    az = ((az % 360) + 360) % 360;
    let ns = 'N', ew = 'E', a = az;
    if (az <= 90) { a = az; } else if (az <= 180) { ns = 'S'; a = 180 - az; } else if (az <= 270) { ns = 'S'; ew = 'W'; a = az - 180; } else { ew = 'W'; a = 360 - az; }
    const [d, m, s] = dms(a); const p = n => String(n).padStart(2, '0');
    return `${ns} ${d}°${p(m)}′${p(s)}″ ${ew}`;
  }
  function polyLength(pts) { let L = 0; for (let i = 1; i < pts.length; i++) L += dist(pts[i - 1], pts[i]); return L; }
  /* signed area (ft², counter-clockwise positive) and its absolute value */
  function signedArea(pts) { let A = 0; for (let i = 0, n = pts.length; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n]; A += a.x * b.y - b.x * a.y; } return A / 2; }
  const area = pts => Math.abs(signedArea(pts));
  function perimeter(pts) { return pts.length < 2 ? 0 : polyLength(pts) + dist(pts[pts.length - 1], pts[0]); }
  /* centroid of a polygon (area centroid; the vertex mean for a degenerate one) or of a polyline (vertex mean) */
  function centroid(pts, closed) {
    const n = pts.length; if (!n) return { x: 0, y: 0 };
    const mean = () => ({ x: pts.reduce((s, p) => s + p.x, 0) / n, y: pts.reduce((s, p) => s + p.y, 0) / n });
    if (!closed || n < 3) return mean();
    const A = signedArea(pts); if (Math.abs(A) < 1e-9) return mean();
    let cx = 0, cy = 0; for (let i = 0; i < n; i++) { const a = pts[i], b = pts[(i + 1) % n], c = a.x * b.y - b.x * a.y; cx += (a.x + b.x) * c; cy += (a.y + b.y) * c; }
    return { x: cx / (6 * A), y: cy / (6 * A) };
  }
  /* distance from point p to segment a-b, and to a polyline / polygon boundary */
  function segDist(p, a, b) {
    const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    let t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0; t = Math.max(0, Math.min(1, t));
    return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
  }
  function lineDist(p, pts, closed) {
    if (pts.length === 1) return dist(p, pts[0]);
    let d = Infinity; for (let i = 1; i < pts.length; i++) d = Math.min(d, segDist(p, pts[i - 1], pts[i]));
    if (closed && pts.length > 2) d = Math.min(d, segDist(p, pts[pts.length - 1], pts[0]));
    return d;
  }
  /* point in polygon (even-odd) */
  function inside(p, pts) {
    let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j];
      if (((a.y > p.y) !== (b.y > p.y)) && (p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x)) c = !c; }
    return c;
  }
  /* bufferRings(pts, r, nArc): the plan area within r of a polyline, as rings that all turn counter-clockwise (one rectangle per
     segment and one circle per vertex). Drawn as one path with the non-zero fill rule they show as their union. */
  function bufferRings(pts, r, nArc) {
    nArc = nArc || 32; const rings = [];
    if (!(r > 0) || !pts.length) return rings;
    pts.forEach(c => { const ring = []; for (let k = 0; k < nArc; k++) { const t = 2 * Math.PI * k / nArc; ring.push({ x: c.x + r * Math.cos(t), y: c.y + r * Math.sin(t) }); } rings.push(ring); });
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1], b = pts[i], L = dist(a, b); if (L < 1e-9) continue;
      const nx = -(b.y - a.y) / L * r, ny = (b.x - a.x) / L * r;   // left normal
      rings.push([{ x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny }, { x: b.x + nx, y: b.y + ny }, { x: a.x + nx, y: a.y + ny }]);
    }
    return rings;
  }

  /* ---------- plan sheets ---------- */
  function pxToFt(pl, px, py) { const c = Math.cos(pl.rot), s = Math.sin(pl.rot); return { x: pl.x + pl.s * (c * px + s * py), y: pl.y + pl.s * (s * px - c * py) }; }
  function ftToPx(pl, x, y) { const c = Math.cos(pl.rot), s = Math.sin(pl.rot), dx = (x - pl.x) / pl.s, dy = (y - pl.y) / pl.s; return { px: c * dx + s * dy, py: s * dx - c * dy }; }
  /* scale calibration: two pixel points and the real distance between them (ft) -> feet per pixel */
  function calScale(p1, p2, realFt) { const dpx = Math.hypot(p2.px - p1.px, p2.py - p1.py); return dpx > 0 && realFt > 0 ? { dpx, s: realFt / dpx } : { dpx, s: NaN }; }
  /* the placement after a scale change about a fixed pixel (the pixel keeps its grid position) */
  function rescaleAbout(pl, s, px, py) { const at = pxToFt(pl, px, py), q = Object.assign({}, pl, { s }); const now = pxToFt(q, px, py); q.x += at.x - now.x; q.y += at.y - now.y; return q; }
  function rotateAbout(pl, rot, px, py) { const at = pxToFt(pl, px, py), q = Object.assign({}, pl, { rot }); const now = pxToFt(q, px, py); q.x += at.x - now.x; q.y += at.y - now.y; return q; }
  /* georeference: two pixel points and their grid positions (ft) -> the placement (scale, rotation, origin) that puts them there */
  function georef(p1, p2, g1, g2) {
    const u1 = { x: p1.px, y: -p1.py }, u2 = { x: p2.px, y: -p2.py };   // pixel axes with "up" positive (no reflection)
    const du = sub(u2, u1), dg = sub(g2, g1), Lu = Math.hypot(du.x, du.y), Lg = Math.hypot(dg.x, dg.y);
    if (!(Lu > 0) || !(Lg > 0)) return null;
    const s = Lg / Lu, rot = Math.atan2(dg.y, dg.x) - Math.atan2(du.y, du.x);
    const c = Math.cos(rot), sn = Math.sin(rot);
    // g1 = o + s·R(rot)·u1  ->  o = g1 − s·R·u1
    const x = g1.x - s * (c * u1.x - sn * u1.y), y = g1.y - s * (sn * u1.x + c * u1.y);
    return { x, y, s, rot: normRot(rot), dpx: Lu, dft: Lg };
  }
  const normRot = r => { const t = 2 * Math.PI; r = r % t; if (r > Math.PI) r -= t; if (r <= -Math.PI) r += t; return r; };
  /* the similarity transform (grid -> grid) that takes the placement a to the placement b: applied to drawn items when a sheet is
     georeferenced with "move the items drawn on it" */
  function placementMove(a, b) {
    return p => { const q = ftToPx(a, p.x, p.y); return pxToFt(b, q.px, q.py); };
  }
  /* drawing scale text: 1" = N ft at a given printed resolution is not shown (plans are scanned at any dpi); the sheet's ft per pixel
     and the stated plan scale (1" = S ft, the user's) give the scan resolution: dpi = S / s */

  /* ---------- parsing ---------- */
  /* parseAngle('42.3601'), ('42 21 36.4'), ('42°21′36.4″N'), ('71 03 32 W') -> decimal degrees (S / W negative), NaN if not read */
  function parseAngle(t) {
    t = String(t == null ? '' : t).trim().toUpperCase(); if (!t) return NaN;
    let sign = 1; if (/[SW]\s*$/.test(t) || /^[SW]/.test(t)) sign = -1; t = t.replace(/[NSEW]/g, ' ');
    if (/^\s*-/.test(t)) { sign = -sign; t = t.replace('-', ' '); }
    const nums = t.split(/[^0-9.]+/).filter(s => s !== ''); if (!nums.length || nums.length > 3) return NaN;
    const v = nums.map(Number); if (v.some(n => !isFinite(n))) return NaN;
    if (v.length > 1 && (v[1] >= 60 || (v[2] != null && v[2] >= 60))) return NaN;
    return sign * (v[0] + (v[1] || 0) / 60 + (v[2] || 0) / 3600);
  }
  const parseNum = t => { const s = String(t == null ? '' : t).replace(/,/g, '').trim(); if (!s) return NaN; const v = Number(s); return isFinite(v) ? v : NaN; };

  /* reproject(proj4, P, to): a copy of the project with every position moved from its zone to zone `to` through latitude / longitude
     (the same places on the ground). A sheet's placement is found again from two of its pixels (so the change of grid convergence and
     scale factor between the zones is kept); its georeference control coordinates are converted too. */
  function reproject(proj4, P, to) {
    const from = P.site && P.site.zone, Q = JSON.parse(JSON.stringify(P));
    Q.site = Object.assign({}, Q.site, { zone: to }); if (!from || from === to) return Q;
    const mv = p => { const ll = ftToLl(proj4, from, p.x, p.y), q = llToFt(proj4, to, ll.lat, ll.lng); return { x: q.x, y: q.y }; };
    (Q.items || []).forEach(it => { it.pts = (it.pts || []).map(mv); });
    (Q.sheets || []).forEach(s => {
      const a = mv(pxToFt(s.place, 0, 0)), b = mv(pxToFt(s.place, s.w, 0));
      const r = georef({ px: 0, py: 0 }, { px: s.w, py: 0 }, a, b); if (r) s.place = { x: r.x, y: r.y, s: r.s, rot: r.rot };
      if (s.geo) ['g1', 'g2'].forEach(k => { const g = s.geo[k], ll = nativeToLl(proj4, from, g.E, g.N), n = llToNative(proj4, to, ll.lat, ll.lng); s.geo[k] = { E: n.E, N: n.N }; });
    });
    return Q;
  }

  window.CranePickGeo = { FT_US, reproject, ZONES, WGS, DEFAULT_ZONE, zone, nativeToFt, ftToNative, llToNative, nativeToLl, llToFt, ftToLl,
    dist, azimuth, bearingText, dms, polyLength, signedArea, area, perimeter, centroid, segDist, lineDist, inside, bufferRings,
    pxToFt, ftToPx, calScale, rescaleAbout, rotateAbout, georef, normRot, placementMove, parseAngle, parseNum };
})();
