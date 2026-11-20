/* apps/crane-pick/engine/terrain.js — preliminary terrain from USGS 3DEP (window.CranePickTerrain). Classic script, no DOM. C8 (2026-11-16).
   Engineer decision 2026-11-16: USGS 3DEP online ONLY for now (no survey import, no clicked spot elevations). Every terrain-derived value
   is labelled "preliminary terrain (USGS 3DEP, ~1–3 m)"; it is not adequate to certify crane levelness — survey data governs.

   Data (fetched in the browser by ui/terrain.js; this file builds the requests and reads the answers):
     USGS The National Map, 3DEP Elevation ImageServer, operation getSamples (ArcGIS REST API "Get Samples"):
       POST https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples
       geometry = { "points": [[lon, lat], …], "spatialReference": { "wkid": 4326 } }, geometryType = esriGeometryMultipoint,
       returnFirstValueOnly = true, interpolation = RSP_BilinearInterpolation, f = json
       answer { samples: [{ location, locationId, value: "<metres>" | "NoData", rasterId, resolution }] } (value: a string, one per band)
     fallback for a few points: EPQS https://epqs.nationalmap.gov/v1/json?x=<lon>&y=<lat>&wkid=4326&units=Feet&includeDate=false
       answer { value: <ft> | "-1000000" (no data), … }
     3DEP values are metres above NAVD 88 (CONUS); converted here to US survey feet, 1 m = 3937/1200 ftUS (the unit of the plan
     coordinates; 2 ppm from the international foot). EPQS is asked for Feet directly.

   The surface: a regular grid in the site frame (State Plane grid ftUS, engine/geo.js): node (i, j) at (x0 + i·dx, y0 + j·dx),
   z[j·nx + i] (ft, NaN = no data). Elevation at any point: bilinear interpolation in the cell (t = (x − x_i)/dx, u = (y − y_j)/dx):
     z = (1 − t)(1 − u) z00 + t(1 − u) z10 + (1 − t) u z01 + t u z11.
   Uses (each worked, CLAUDE.md §6):
     level()   ground under each float / track end, the slopes across the footprint, blocking to level, the badge
     padGrade() cut / fill of a level pad (grid method)
     profile() the route's ground profile, grades, crests / sags, the long-load ground clearance
     contours(), cellSlope() the map
   Formulas: CLAUDE.md §4 (new calculation; stated in the PR and the fix log). */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const tx = (x, d) => { if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const rad = d => d * Math.PI / 180;
  const FT_PER_M = 3937 / 1200;   // US survey feet per metre (engine/geo.js FT_US = 1200/3937 m)
  const SERVICE = 'https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/getSamples';
  const EPQS = 'https://epqs.nationalmap.gov/v1/json';
  const LABEL = 'preliminary terrain (USGS 3DEP, ~1–3 m)';
  const CERT = 'Preliminary terrain from USGS 3DEP (about 1–3 m data): not adequate to certify crane levelness or grades; survey data governs.';
  const DATUM = 'NAVD 88 (USGS 3DEP), US survey feet';
  const REF = { bil: 'bilinear interpolation on the terrain grid', lvl: 'least-squares plane through the support points (statics of a rectangle)', grid: 'grid (prismoidal cell) method', prof: 'chord between the load supports (rigid load)' };
  const LIM = { maxPts: 10000, batch: 400, epqsMax: 60 };   // request limits (Decision pending engineer review): 10,000 points per fetch, 400 per getSamples request, EPQS only for ≤ 60 points
  const DEF = { spacing: 5, tol: 1, maxBlk: 2, contour: 1, maxGrade: 8, base: 20, clr: 0.5 };
  /* ---------- the grid ---------- */
  /* gridSpec(ext {x0, y0, x1, y1}, dx, maxPts) -> { x0, y0, dx, nx, ny, n, asked, grown }: nodes on the multiples of dx (site frame)
     covering ext; dx grows (×1.25 steps) until n ≤ maxPts */
  function gridSpec(ext, dx, maxPts) {
    maxPts = maxPts || LIM.maxPts; const asked = dx = isNum(dx) && dx > 0 ? dx : DEF.spacing;
    let i0, j0, nx, ny, k = 0;
    for (;;) { i0 = Math.floor(ext.x0 / dx + 1e-9); j0 = Math.floor(ext.y0 / dx + 1e-9); nx = Math.max(2, Math.ceil(ext.x1 / dx - 1e-9) - i0 + 1); ny = Math.max(2, Math.ceil(ext.y1 / dx - 1e-9) - j0 + 1);
      if (nx * ny <= maxPts || k > 60) break; dx *= 1.25; k++; }
    return { x0: i0 * dx, y0: j0 * dx, dx, nx, ny, n: nx * ny, asked, grown: dx > asked + 1e-9 };
  }
  function nodes(spec) { const out = []; for (let j = 0; j < spec.ny; j++) for (let i = 0; i < spec.nx; i++) out.push({ i, j, x: spec.x0 + i * spec.dx, y: spec.y0 + j * spec.dx }); return out; }
  function makeGrid(spec, z, meta) {
    const g = { x0: spec.x0, y0: spec.y0, dx: spec.dx, nx: spec.nx, ny: spec.ny, z: Array.from(z, v => isNum(v) ? v : NaN), meta: meta || {} };
    let lo = Infinity, hi = -Infinity, nd = 0; g.z.forEach(v => { if (isNaN(v)) nd++; else { if (v < lo) lo = v; if (v > hi) hi = v; } });
    g.zmin = isFinite(lo) ? lo : null; g.zmax = isFinite(hi) ? hi : null; g.nodata = nd; return g;
  }
  const Z = (G, i, j) => G.z[j * G.nx + i];
  /* cell(G, x, y) -> { i, j, t, u, z00, z10, z01, z11 } | null (outside the grid) */
  function cell(G, x, y) {
    if (!G) return null; const fi = (x - G.x0) / G.dx, fj = (y - G.y0) / G.dx, e = 1e-9;
    if (fi < -e || fj < -e || fi > G.nx - 1 + e || fj > G.ny - 1 + e) return null;
    const i = Math.max(0, Math.min(G.nx - 2, Math.floor(fi))), j = Math.max(0, Math.min(G.ny - 2, Math.floor(fj)));
    return { i, j, t: Math.max(0, Math.min(1, fi - i)), u: Math.max(0, Math.min(1, fj - j)), z00: Z(G, i, j), z10: Z(G, i + 1, j), z01: Z(G, i, j + 1), z11: Z(G, i + 1, j + 1) };
  }
  const bil = c => (1 - c.t) * (1 - c.u) * c.z00 + c.t * (1 - c.u) * c.z10 + (1 - c.t) * c.u * c.z01 + c.t * c.u * c.z11;
  /* at(G, x, y) -> ground elevation (ft) | null (outside the grid or a no-data corner) */
  function at(G, x, y) { const c = cell(G, x, y); if (!c) return null; const v = bil(c); return isNum(v) ? v : null; }
  /* grad(G, x, y) -> { gx, gy } the slope of the bilinear surface (ft/ft) | null */
  function grad(G, x, y) { const c = cell(G, x, y); if (!c) return null; const gx = ((1 - c.u) * (c.z10 - c.z00) + c.u * (c.z11 - c.z01)) / G.dx, gy = ((1 - c.t) * (c.z01 - c.z00) + c.t * (c.z11 - c.z10)) / G.dx; return isNum(gx) && isNum(gy) ? { gx, gy } : null; }
  /* cellSlope(G, i, j) -> % slope of the cell at its centre (the overlay) | null */
  function cellSlope(G, i, j) { const a = Z(G, i, j), b = Z(G, i + 1, j), c = Z(G, i, j + 1), d = Z(G, i + 1, j + 1); const gx = (b - a + d - c) / (2 * G.dx), gy = (c - a + d - b) / (2 * G.dx); const s = 100 * Math.hypot(gx, gy); return isNum(s) ? s : null; }
  function bilStep(G, idp, id, label, x, y) {
    const c = cell(G, x, y); if (!c) return { z: null, step: st(idp, { id, label, sym: 'z', value: 'outside the terrain grid', note: 'Fetch terrain covering this point (Terrain tab).', ok: false }) };
    const z = bil(c);
    return { z: isNum(z) ? z : null, step: st(idp, { id, label, sym: 'z', eq: '(1 - t)(1 - u) z_{00} + t(1 - u) z_{10} + (1 - t) u z_{01} + t u z_{11}',
      sub: `(1 - ${tx(c.t, 3)})(1 - ${tx(c.u, 3)})\\,${tx(c.z00, 2)} + ${tx(c.t, 3)}(1 - ${tx(c.u, 3)})\\,${tx(c.z10, 2)} + (1 - ${tx(c.t, 3)})\\,${tx(c.u, 3)}\\,${tx(c.z01, 2)} + ${tx(c.t, 3)}\\cdot${tx(c.u, 3)}\\,${tx(c.z11, 2)}`,
      value: isNum(z) ? z : 'no data', unit: 'ft', ref: REF.bil, note: `at E ${fmt(x, 2)}, N ${fmt(y, 2)} (site frame, ftUS); cell (${c.i}, ${c.j}), spacing ${fmt(G.dx, 2)} ft; ${LABEL}.`, ok: isNum(z) }) };
  }
  /* ---------- the USGS answers ---------- */
  /* samplesBody(lls [{ lat, lng }]) -> the form body of one getSamples request (application/x-www-form-urlencoded: a CORS simple request) */
  function samplesBody(lls) {
    const geom = { points: lls.map(q => [+q.lng.toFixed(8), +q.lat.toFixed(8)]), spatialReference: { wkid: 4326 } };
    return ['geometry=' + encodeURIComponent(JSON.stringify(geom)), 'geometryType=esriGeometryMultipoint', 'returnFirstValueOnly=true', 'interpolation=RSP_BilinearInterpolation', 'f=json'].join('&');
  }
  /* parseSamples(json, n) -> { m: [metres | NaN] (by locationId, else by order), res: native resolution (m) | null, nodata } ; throws on an error answer */
  function parseSamples(j, n) {
    if (!j || typeof j !== 'object') throw new Error('not a JSON answer');
    if (j.error) throw new Error('USGS service error ' + (j.error.code || '') + ': ' + (j.error.message || '') + (j.error.details && j.error.details.length ? ' (' + j.error.details.join('; ') + ')' : ''));
    if (!Array.isArray(j.samples)) throw new Error('no "samples" in the answer');
    const m = new Array(n).fill(NaN), byId = j.samples.every(s => isNum(+s.locationId) && s.locationId !== null && s.locationId !== undefined && s.locationId !== '');
    const res = [];
    j.samples.forEach((s, k) => {
      const idx = byId ? +s.locationId : k; if (!(idx >= 0 && idx < n)) return;
      const v = parseFloat(String(s.value == null ? '' : s.value).split(',')[0]);   // "NoData" / an empty value -> NaN
      if (isNum(v) && v > -1e5 && v < 1e5) m[idx] = v;
      if (isNum(+s.resolution) && +s.resolution > 0) res.push(+s.resolution);
    });
    return { m, res: res.length ? Math.min(...res) : null, nodata: m.filter(v => isNaN(v)).length };
  }
  /* parseEpqs(json) -> ft | NaN (EPQS v1 asked with units=Feet) */
  function parseEpqs(j) {
    if (!j || typeof j !== 'object') return NaN; const v = parseFloat(j.value != null ? j.value : j.USGS_Elevation_Point_Query_Service && j.USGS_Elevation_Point_Query_Service.Elevation_Query && j.USGS_Elevation_Point_Query_Service.Elevation_Query.Elevation);
    return isNum(v) && v > -1e5 ? v : NaN;
  }
  const epqsUrl = q => `${EPQS}?x=${q.lng.toFixed(8)}&y=${q.lat.toFixed(8)}&wkid=4326&units=Feet&includeDate=false`;
  /* ---------- 1. crane levelness ---------- */
  /* support points (crane frame x forward, y left): wheeled — the four floats (engine/ground.js supports()); crawler — the four track ends */
  function supPoints(S) {
    if (!S || !S.ok) return null;
    if (S.kind === 'crawler') { const a = S.Lt / 2, b = S.g / 2; return { kind: 'crawler', a: S.Lt, b, pts: [{ id: 'LF', name: 'left track, front end', lx: a, ly: b, sx: 1, sy: 1 }, { id: 'RF', name: 'right track, front end', lx: a, ly: -b, sx: 1, sy: -1 }, { id: 'LR', name: 'left track, rear end', lx: -a, ly: b, sx: -1, sy: 1 }, { id: 'RR', name: 'right track, rear end', lx: -a, ly: -b, sx: -1, sy: -1 }] }; }
    return { kind: 'wheeled', a: S.xF + S.xR, b: S.b, pts: S.items.map(it => ({ id: it.id, name: it.name + ' float', lx: it.lx, ly: it.ly, sx: it.sx, sy: it.sy })) };
  }
  const toGrid = (u, lx, ly) => { const h = rad(u.heading || 0), fx = Math.sin(h), fy = Math.cos(h); return { x: u.x + lx * fx - ly * fy, y: u.y + lx * fy + ly * fx }; };
  /* level(S, setup, G, o { tol (%), datum (ft | null: the highest support), maxBlk (ft) }, idp) -> { ok, pts [{ id, name, x, y, z, blk }], sL, sT, sMax, tw,
       zHi, zLo, datum, status 'ok' | 'warn' | 'stop' | 'none', text, steps, flags } */
  function level(S, u, G, o, idp) {
    o = o || {}; idp = idp || 'lv'; const tol = isNum(o.tol) && o.tol > 0 ? o.tol : DEF.tol, maxBlk = isNum(o.maxBlk) && o.maxBlk > 0 ? o.maxBlk : DEF.maxBlk;
    const sp = supPoints(S), steps = [], flags = [];
    if (!sp) return { ok: false, status: 'none', text: 'supports not known' + (S && S.why ? ': ' + S.why : ''), steps, flags };
    if (!G) return { ok: false, status: 'none', text: 'no terrain fetched for this browser (Terrain tab)', steps, flags };
    const pts = sp.pts.map(q => { const g = toGrid(u, q.lx, q.ly), b = bilStep(G, idp, 'z' + q.id, `Ground under the ${q.name} (${q.id})`, g.x, g.y); steps.push(b.step); return Object.assign({}, q, g, { z: b.z }); });
    const miss = pts.filter(q => !isNum(q.z));
    if (miss.length) { const t = `Terrain missing under ${miss.map(q => q.id).join(', ')} (outside the fetched grid or no data): fetch terrain covering the crane.`; flags.push({ level: 'stop', text: t }); return { ok: false, status: 'stop', text: t, pts, steps, flags }; }
    const by = id => pts.find(q => q.id === id).z, P = sp.kind === 'crawler' ? { F: ['LF', 'RF'], R: ['LR', 'RR'], L: ['LF', 'LR'], Rt: ['RF', 'RR'] } : { F: ['FL', 'FR'], R: ['RL', 'RR'], L: ['FL', 'RL'], Rt: ['FR', 'RR'] };
    const avg = ids => (by(ids[0]) + by(ids[1])) / 2, zF = avg(P.F), zR = avg(P.R), zL = avg(P.L), zRt = avg(P.Rt);
    const sL = 100 * (zF - zR) / sp.a, sT = 100 * (zL - zRt) / (2 * sp.b), sMax = Math.hypot(sL, sT);
    const tw = (by(P.F[0]) + by(P.R[1]) - by(P.F[1]) - by(P.R[0])) / 4;   // the four points' departure from the best-fit plane (each ± tw)
    const zs = pts.map(q => q.z), zHi = Math.max(...zs), zLo = Math.min(...zs), dat = isNum(o.datum) ? o.datum : zHi, fromD = isNum(o.datum) ? 'chosen datum' : 'the highest support';
    pts.forEach(q => { q.blk = dat - q.z; });
    const longD = sp.kind === 'crawler' ? 'L_t' : 'x_F + x_R', lab = sp.kind === 'crawler' ? 'track length' : 'float base along the carrier';
    steps.push(
      st(idp, { id: 'sL', label: 'Longitudinal slope (front ends minus rear ends, along the carrier)', sym: 's_L', eq: `100\\,\\frac{(z_{${P.F[0]}} + z_{${P.F[1]}})/2 - (z_{${P.R[0]}} + z_{${P.R[1]}})/2}{${longD}}`,
        sub: `100\\,\\frac{(${tx(by(P.F[0]), 2)} + ${tx(by(P.F[1]), 2)})/2 - (${tx(by(P.R[0]), 2)} + ${tx(by(P.R[1]), 2)})/2}{${tx(sp.a, 2)}}`, value: sL, unit: '\\%', ref: REF.lvl, note: `${longD} = ${fmt(sp.a, 2)} ft (${lab}).` }),
      st(idp, { id: 'sT', label: 'Transverse slope (left minus right)', sym: 's_T', eq: `100\\,\\frac{(z_{${P.L[0]}} + z_{${P.L[1]}})/2 - (z_{${P.Rt[0]}} + z_{${P.Rt[1]}})/2}{2b}`,
        sub: `100\\,\\frac{(${tx(by(P.L[0]), 2)} + ${tx(by(P.L[1]), 2)})/2 - (${tx(by(P.Rt[0]), 2)} + ${tx(by(P.Rt[1]), 2)})/2}{${tx(2 * sp.b, 2)}}`, value: sT, unit: '\\%', ref: REF.lvl, note: `2b = ${fmt(2 * sp.b, 2)} ft (${sp.kind === 'crawler' ? 'track gauge' : 'outrigger spread'}).` }),
      st(idp, { id: 'sM', label: 'Maximum slope across the footprint (steepest direction of the plane)', sym: 's_{max}', eq: '\\sqrt{s_L^2 + s_T^2}', sub: `\\sqrt{${tx(sL, 3)}^2 + ${tx(sT, 3)}^2}`, value: sMax, unit: '\\%', ref: REF.lvl,
        note: `Level tolerance s_tol = ${fmt(tol, 2)} % (the crane manual's requirement, entered per crane; default 1 %). ${sMax <= tol ? 's_max ≤ s_tol.' : 's_max > s_tol: level the crane (blocking / cribbing or grading).'}`, ok: sMax <= tol }),
      st(idp, { id: 'tw', label: 'Twist (each support\'s departure from the best-fit plane, ±)', sym: 'w', eq: `\\frac{z_{${P.F[0]}} + z_{${P.R[1]}} - z_{${P.F[1]}} - z_{${P.R[0]}}}{4}`, sub: `\\frac{${tx(by(P.F[0]), 2)} + ${tx(by(P.R[1]), 2)} - ${tx(by(P.F[1]), 2)} - ${tx(by(P.R[0]), 2)}}{4}`, value: tw, unit: 'ft', note: 'Information.' }));
    pts.forEach(q => steps.push(st(idp, { id: 'b' + q.id, label: `Blocking / cribbing under ${q.id} to level at ${fromD}`, sym: `b_{${q.id}}`, eq: `z_{datum} - z_{${q.id}}`, sub: `${tx(dat, 2)} - ${tx(q.z, 2)}`, value: q.blk, unit: 'ft',
      note: `${fmt(q.blk * 12, 1)} in. ${q.blk < -1e-9 ? 'Negative: the datum is below the ground here — cut / grade.' : ''}`, ok: q.blk >= -1e-9 && q.blk <= maxBlk + 1e-9 })));
    const bMax = Math.max(...pts.map(q => q.blk)), bMin = Math.min(...pts.map(q => q.blk));
    let status = 'ok', text = `level within ${fmt(tol, 2)} %: s_max ${fmt(sMax, 2)} %`;
    if (sMax > tol) { status = 'warn'; text = `s_max ${fmt(sMax, 2)} % > ${fmt(tol, 2)} %: level the crane — blocking up to ${fmt(bMax * 12, 1)} in (${fromD})`; flags.push({ level: 'warn', text: `Crane levelness (${LABEL}): slope across the footprint ${fmt(sMax, 2)} % exceeds the level tolerance ${fmt(tol, 2)} %; blocking / cribbing up to ${fmt(bMax * 12, 1)} in to level at ${fromD}.` }); }
    if (bMax > maxBlk + 1e-9) { status = 'stop'; text = `blocking ${fmt(bMax * 12, 1)} in > the limit ${fmt(maxBlk * 12, 1)} in: grade the pad`; flags.push({ level: 'stop', text: `Crane levelness (${LABEL}): blocking ${fmt(bMax * 12, 1)} in under one support exceeds the blocking limit ${fmt(maxBlk * 12, 1)} in: grade a level pad.` }); }
    if (bMin < -1e-9) { if (status === 'ok') status = 'warn'; flags.push({ level: 'warn', text: `Crane levelness: the chosen datum ${fmt(dat, 2)} ft is ${fmt(-bMin, 2)} ft below the ground under a support: cut / grade there.` }); }
    return { ok: true, kind: sp.kind, pts, sL, sT, sMax, tw, zHi, zLo, datum: dat, fromD, tol, maxBlk, bMax, status, text, steps, flags };
  }
  /* ---------- 2. pad grading ---------- */
  /* padGrade(G, setup, pad { B (along the carrier), W, el (null: the mean ground over the pad) }, idp) -> { cut, fill (ft³), cutCy, fillCy, el, from, A, n, h, mean, steps, miss } */
  function padGrade(G, u, pad, idp) {
    idp = idp || 'pg'; const B = pad.B, W = pad.W, steps = []; if (!G || !(B > 0) || !(W > 0)) return null;
    const hT = Math.min(G.dx, Math.min(B, W) / 10), nB = Math.max(2, Math.ceil(B / hT)), nW = Math.max(2, Math.ceil(W / hT)), hB = B / nB, hW = W / nW, a = hB * hW;
    const z = []; let miss = 0;
    for (let i = 0; i < nB; i++) for (let j = 0; j < nW; j++) { const lx = -B / 2 + (i + 0.5) * hB, ly = -W / 2 + (j + 0.5) * hW, g = toGrid(u, lx, ly), v = at(G, g.x, g.y); if (isNum(v)) z.push(v); else miss++; }
    if (!z.length) return { miss, n: 0 };
    const mean = z.reduce((s, v) => s + v, 0) / z.length, el = isNum(pad.el) ? pad.el : mean, from = isNum(pad.el) ? 'entered' : 'not entered: the mean existing ground over the pad (cut ≈ fill)';
    let cut = 0, fill = 0; z.forEach(v => { const d = el - v; if (d > 0) fill += d * a; else cut -= d * a; });
    const A = z.length * a;
    steps.push(st(idp, { id: 'cells', label: 'Pad cells (grid method: the ground at each cell centre, bilinear on the terrain grid)', sym: 'n', eq: 'n_B \\times n_W', sub: `${nB} \\times ${nW}`, value: nB * nW, d: 0, ref: REF.grid,
      note: `Pad ${fmt(B, 2)} × ${fmt(W, 2)} ft centred on the rotation centre, along the carrier; cell ${fmt(hB, 3)} × ${fmt(hW, 3)} ft (a = ${fmt(a, 4)} ft²)${miss ? `; ${miss} cells without terrain left out (flagged)` : ''}.` }),
      st(idp, { id: 'el', label: 'Pad elevation', sym: 'z_{pad}', value: el, unit: 'ft', note: `${from}; mean existing ground z̄ = ${fmt(mean, 2)} ft.` }),
      st(idp, { id: 'fill', label: 'Fill volume', sym: 'V_{fill}', eq: '\\sum a\\,\\max(z_{pad} - z_i, 0)', sub: `${tx(a, 4)} \\times ${tx(fill / a, 3)}`, value: fill, unit: 'ft^{3}', note: `= ${fmt(fill / 27, 2)} cy (27 ft³/cy).` }),
      st(idp, { id: 'cut', label: 'Cut volume', sym: 'V_{cut}', eq: '\\sum a\\,\\max(z_i - z_{pad}, 0)', sub: `${tx(a, 4)} \\times ${tx(cut / a, 3)}`, value: cut, unit: 'ft^{3}', note: `= ${fmt(cut / 27, 2)} cy. Bank volumes: no shrink / swell; slopes outside the pad not included.` }));
    return { cut, fill, cutCy: cut / 27, fillCy: fill / 27, el, from, A, n: nB * nW, h: [hB, hW], mean, miss, B, W, steps };
  }
  /* ---------- 3. route profile ---------- */
  /* stations along the route's steer-axle path (engine/route.js path() / at()); Z(s) bilinear */
  function stations(RT, r, G, ds) {
    const pa = RT.path(r); if (!pa.ok && !(pa.segs && pa.segs.length)) return { pa, s: [] };
    const n = Math.max(2, Math.ceil(pa.L / ds) + 1), out = [];
    for (let k = 0; k < n; k++) { const s = Math.min(pa.L, k * pa.L / (n - 1)), q = RT.at(pa, s); out.push(q ? { s, x: q.x, y: q.y, z: at(G, q.x, q.y) } : { s, x: null, y: null, z: null }); }
    return { pa, s: out, ds: pa.L / (n - 1) };
  }
  function zAt(pr, s) {   // linear between stations
    const a = pr.s; if (!a.length) return null; if (s <= a[0].s) return a[0].z; if (s >= a[a.length - 1].s) return a[a.length - 1].z;
    const k = Math.min(a.length - 2, Math.floor(s / pr.ds)); const p = a[k], q = a[k + 1]; if (!isNum(p.z) || !isNum(q.z)) return null; return p.z + (q.z - p.z) * (s - p.s) / (q.s - p.s);
  }
  /* the vehicle along the path (stations behind the steer axle; off-tracking not included in the profile: Decision): hitch H (kingpin,
     or the jeep's bolster), rear group / dolly pivot R, load front f ahead of H, rear overhang r behind R */
  function vehStations(RT, r, P) {
    const v = RT.vehOf(r, P), l = RT.loadOf(r, P), jeep = RT.hasJeep(v), dH = v.L1 - v.e + (jeep ? v.Lj - v.ej : 0), f = l.L - v.L2 - l.r;
    const huDef = (v.type === 'dolly' || v.type === 'jeep') ? v.hDeck : Math.max(v.hDeck - 1, 0.5);
    return { v, l, dH, L2: v.L2, f, r: l.r, huDef, huFrom: (v.type === 'dolly' || v.type === 'jeep') ? 'default: the deck / bolster height h_deck (the load spans between the bolsters); the blocking height h_B is not added (conservative): enter h_u = h_deck + h_B to include it' : 'default: h_deck − 1 ft (deck structure, assumed)' };
  }
  /* profile(RT, r, P, G, o { maxGrade %, base ft, hu ft, clr ft }, idp) -> { st, grades, segs, crest, sag, clr, steps, flags } */
  function profile(RT, r, P, G, o, idp) {
    o = o || {}; idp = idp || 'tp'; const flags = [], steps = [];
    const maxG = isNum(o.maxGrade) && o.maxGrade > 0 ? o.maxGrade : DEF.maxGrade, base = isNum(o.base) && o.base > 0 ? o.base : DEF.base, clrM = isNum(o.clr) && o.clr >= 0 ? o.clr : DEF.clr;
    if (!G) return { ok: false, why: 'no terrain', flags, steps };
    const ds = Math.max(0.5, Math.min(2, G.dx / 2)), pr = stations(RT, r, G, ds);
    if (pr.s.length < 2) return { ok: false, why: 'route too short', flags, steps };
    const miss = pr.s.filter(q => !isNum(q.z)).length;
    if (miss) flags.push({ level: miss === pr.s.length ? 'stop' : 'warn', text: `Route "${r.name}": terrain missing at ${miss} of ${pr.s.length} profile stations (outside the fetched grid): fetch terrain covering the route.` });
    const Ltot = pr.pa.L, b2 = Math.min(base, Ltot) / 2;
    const gAt = s => { const s0 = Math.max(0, s - b2), s1 = Math.min(Ltot, s + b2); if (s1 - s0 < 1e-6) return null; const a = zAt(pr, s0), c = zAt(pr, s1); return isNum(a) && isNum(c) ? 100 * (c - a) / (s1 - s0) : null; };
    pr.s.forEach(q => { q.g = gAt(q.s); });
    // per path segment (tangent / curve): the steepest grade
    const segs = pr.pa.segs.map((sg, i) => { let best = null; pr.s.forEach(q => { if (q.s >= sg.s0 - 1e-9 && q.s <= sg.s0 + sg.L + 1e-9 && isNum(q.g) && (!best || Math.abs(q.g) > Math.abs(best.g))) best = q; });
      return { i: i + 1, type: sg.type, s0: sg.s0, s1: sg.s0 + sg.L, g: best ? best.g : null, at: best ? best.s : null, z: best ? best.z : null, over: best ? Math.abs(best.g) > maxG + 1e-9 : false }; });
    segs.filter(x => x.over).forEach(x => flags.push({ level: 'warn', text: `Route "${r.name}" ${x.type === 'arc' ? 'curve' : 'tangent'} ${x.i} (sta. ${fmt(x.s0, 0)}–${fmt(x.s1, 0)} ft): grade ${fmt(x.g, 2)} % over ${fmt(2 * b2, 0)} ft exceeds the maximum ${fmt(maxG, 2)} % (${LABEL}).` }));
    const gov = segs.filter(x => isNum(x.g)).sort((a, c) => Math.abs(c.g) - Math.abs(a.g))[0];
    if (gov) { const s0 = Math.max(0, gov.at - b2), s1 = Math.min(Ltot, gov.at + b2), za = zAt(pr, s0), zc = zAt(pr, s1);
      steps.push(st(idp, { id: 'g', label: `Steepest grade (over the base length ℓ_g, at sta. ${fmt(gov.at, 1)} ft)`, sym: 'g_{max}', eq: '100\\,\\frac{z(s + \\ell_g/2) - z(s - \\ell_g/2)}{\\ell_g}', sub: `100\\,\\frac{${tx(zc, 2)} - ${tx(za, 2)}}{${tx(s1 - s0, 2)}}`, value: gov.g, unit: '\\%',
        note: `ℓ_g = ${fmt(base, 1)} ft (input; clipped at the route ends); the maximum grade allowed ${fmt(maxG, 2)} % (input). Profile: the steer-axle path every ${fmt(pr.ds, 2)} ft, ground bilinear on the terrain grid (${LABEL}).`, ok: Math.abs(gov.g) <= maxG + 1e-9 })); }
    // crests / sags: grade breaks — the algebraic change of grade A = g(s + ℓ_g/2) − g(s − ℓ_g/2) (each over ℓ_g); a run of stations with
    // |A| ≥ A_min (2 %, Decision pending engineer review) is one crest (A < 0) or sag (A > 0), placed at its largest |A|
    const AMIN = 2, crest = [], sag = []; let run = null;
    const flush = () => { if (run) (run.A < 0 ? crest : sag).push(run); run = null; };
    pr.s.forEach(q => { const gi = gAt(q.s - b2), go = gAt(q.s + b2), Ag = isNum(gi) && isNum(go) && q.s - b2 >= 0 && q.s + b2 <= Ltot ? go - gi : null;
      if (!isNum(Ag) || Math.abs(Ag) < AMIN) { flush(); return; }
      if (run && Math.sign(Ag) !== Math.sign(run.A)) flush();
      if (!run || Math.abs(Ag) > Math.abs(run.A)) run = { s: q.s, z: q.z, x: q.x, y: q.y, A: Ag, gIn: gi, gOut: go }; });
    flush();
    // long-load ground clearance
    const V = vehStations(RT, r, P), hu = isNum(o.hu) && o.hu >= 0 ? o.hu : V.huDef, huFrom = isNum(o.hu) && o.hu >= 0 ? 'entered' : V.huFrom;
    const back = V.dH + V.L2 + Math.max(V.r, 0), clr = { min: null };
    for (let s = back; s <= Ltot + 1e-9; s += pr.ds) {
      const sH = s - V.dH, sR = sH - V.L2, zH = zAt(pr, sH), zR = zAt(pr, sR); if (!isNum(zH) || !isNum(zR)) continue;
      const lo = sR - Math.max(V.r, 0), hi = Math.min(sH + Math.max(V.f, 0), s);
      for (let sg = lo; sg <= hi + 1e-9; sg += pr.ds) { const zg = zAt(pr, sg); if (!isNum(zg)) continue; const line = zR + hu + (zH - zR) * (sg - sR) / V.L2, c = line - zg;
        if (clr.min == null || c < clr.min) Object.assign(clr, { min: c, s, sg, sH, sR, zH, zR, zg, line, where: sg > sH + 1e-9 ? 'front overhang' : sg < sR - 1e-9 ? 'rear overhang' : 'between the supports' }); }
    }
    if (clr.min != null) {
      steps.push(st(idp, { id: 'cl', label: `Least ground clearance under the load / deck (${clr.where}; steer axle at sta. ${fmt(clr.s, 1)} ft, point at sta. ${fmt(clr.sg, 1)} ft)`, sym: 'c_{min}',
        eq: 'z_R + h_u + (z_H - z_R)\\,\\frac{s - s_R}{L_2} - z(s)', sub: `${tx(clr.zR, 2)} + ${tx(hu, 2)} + (${tx(clr.zH, 2)} - ${tx(clr.zR, 2)})\\,\\frac{${tx(clr.sg - clr.sR, 2)}}{${tx(V.L2, 2)}} - ${tx(clr.zg, 2)}`, value: clr.min, unit: 'ft', ref: REF.prof,
        note: `Method: the load / deck underside is a straight line h_u above the ground at its two supports (H: ${RT.hasJeep(V.v) ? 'the jeep bolster' : 'the kingpin'} at sta. ${fmt(clr.sH, 1)}; R: the rear axle group / dolly at sta. ${fmt(clr.sR, 1)}; L_2 = ${fmt(V.L2, 2)} ft), extended over the front overhang f = ${fmt(V.f, 2)} ft and the rear overhang r = ${fmt(V.r, 2)} ft; checked at every position of the vehicle along the profile (stations every ${fmt(pr.ds, 2)} ft) — over crests between the supports and at the overhang ends over sags. h_u = ${fmt(hu, 2)} ft (${huFrom}). Off-tracking and suspension travel are not included; the tractor and the jeep are not checked. Margin ${fmt(clrM, 2)} ft (input).`, ok: clr.min >= clrM }));
      if (clr.min < 0) flags.push({ level: 'stop', text: `Route "${r.name}": the load / deck grounds (${clr.where}, clearance ${fmt(clr.min, 2)} ft at sta. ${fmt(clr.sg, 1)} ft; ${LABEL}).` });
      else if (clr.min < clrM) flags.push({ level: 'warn', text: `Route "${r.name}": ground clearance under the load / deck ${fmt(clr.min, 2)} ft (${clr.where}, sta. ${fmt(clr.sg, 1)} ft) is less than the margin ${fmt(clrM, 2)} ft (${LABEL}).` });
    }
    return { ok: true, st: pr.s, ds: pr.ds, L: Ltot, segs, gov, crest, sag, aMin: AMIN, clr, hu, huFrom, V, maxG, base, clrM, miss, steps, flags };
  }
  /* ---------- 4. the map ---------- */
  /* contours(G, dz, maxLevels) -> { levels: [{ z, major, segs: [[{x,y},{x,y}], …] }], tooMany } (marching squares, the saddle by the cell mean) */
  function contours(G, dz, maxLevels) {
    maxLevels = maxLevels || 250; if (!G || !(dz > 0) || G.zmin == null) return { levels: [] };
    const k0 = Math.ceil(G.zmin / dz - 1e-9), k1 = Math.floor(G.zmax / dz + 1e-9); if (k1 - k0 + 1 > maxLevels) return { levels: [], tooMany: k1 - k0 + 1 };
    const levels = [];
    for (let k = k0; k <= k1; k++) {
      const z0 = k * dz, segs = [];
      const P = (i, j) => ({ x: G.x0 + i * G.dx, y: G.y0 + j * G.dx });
      const lerp = (a, b, za, zb) => { const t = (z0 - za) / (zb - za); return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; };
      for (let j = 0; j < G.ny - 1; j++) for (let i = 0; i < G.nx - 1; i++) {
        const a = Z(G, i, j), b = Z(G, i + 1, j), c = Z(G, i + 1, j + 1), d = Z(G, i, j + 1); if (isNaN(a) || isNaN(b) || isNaN(c) || isNaN(d)) continue;
        const code = (a >= z0 ? 1 : 0) | (b >= z0 ? 2 : 0) | (c >= z0 ? 4 : 0) | (d >= z0 ? 8 : 0); if (code === 0 || code === 15) continue;
        const pa = P(i, j), pb = P(i + 1, j), pc = P(i + 1, j + 1), pd = P(i, j + 1);
        const e = { ab: () => lerp(pa, pb, a, b), bc: () => lerp(pb, pc, b, c), cd: () => lerp(pc, pd, c, d), da: () => lerp(pd, pa, d, a) };
        const add = (p, q) => segs.push([e[p](), e[q]()]);
        switch (code) {
          case 1: case 14: add('da', 'ab'); break; case 2: case 13: add('ab', 'bc'); break; case 3: case 12: add('da', 'bc'); break;
          case 4: case 11: add('bc', 'cd'); break; case 6: case 9: add('ab', 'cd'); break; case 7: case 8: add('cd', 'da'); break;
          case 5: case 10: { const m = (a + b + c + d) / 4, hiC = m >= z0; if ((code === 5) === hiC) { add('ab', 'bc'); add('cd', 'da'); } else { add('da', 'ab'); add('bc', 'cd'); } break; }
        }
      }
      if (segs.length) levels.push({ z: z0, major: Math.abs(k % 5) === 0, segs });
    }
    return { levels };
  }
  const SLOPE_CLASSES = [{ max: 1, col: '#16A34A', label: '< 1 %' }, { max: 2, col: '#84CC16', label: '1–2 %' }, { max: 5, col: '#FACC15', label: '2–5 %' }, { max: 10, col: '#F97316', label: '5–10 %' }, { max: Infinity, col: '#DC2626', label: '≥ 10 %' }];
  const slopeClass = s => SLOPE_CLASSES.findIndex(c => s < c.max);
  window.CranePickTerrain = { FT_PER_M, SERVICE, EPQS, LABEL, CERT, DATUM, REF, LIM, DEF, SLOPE_CLASSES, slopeClass, gridSpec, nodes, makeGrid, cell, at, grad, cellSlope, bilStep,
    samplesBody, parseSamples, parseEpqs, epqsUrl, supPoints, toGrid, level, padGrade, stations, zAt, vehStations, profile, contours };
})();
