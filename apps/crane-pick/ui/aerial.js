/* apps/crane-pick/ui/aerial.js — the aerial background of the plan sheets (window.CranePickAerial). 2026-11-17 (engineer request B).
   Display only: no value of any check depends on it.
   Imagery: Esri World Imagery tiles (the map's satellite base, ui/map.js), requested with crossOrigin = 'anonymous' so the canvas they are
   drawn on can be saved (the tile server sends Access-Control-Allow-Origin). The attribution required by the tile terms is printed on
   every aerial sheet and figure (ATTR). Offline, blocked, or without CORS: the sheet says "aerial not available — printed without
   background" and prints without it.
   How the image is made (render): the sheet's plan window (grid ft, grid north up) at s ft per pixel (150 dpi at the sheet's full-size
   scale, at most MAX_PX on the long side, not finer than the zoom-19 tiles); the zoom: the finest tile zoom <= 19 whose ground resolution
   is at least as fine as s, lowered until the tiles needed are <= MAX_TILES; the tiles drawn into one mosaic (Web Mercator pixels); the
   mosaic drawn into the output canvas through ONE affine map fitted at three corners of the window (grid -> latitude / longitude by
   proj4, -> Web Mercator pixels). The residual at the fourth corner and the centre (resid, ft) is reported; for a site of a few thousand
   feet it is a small fraction of a foot (Decision pending engineer review: one affine fit per image, not a per-pixel reprojection).
   World file (worldFile / pgw): six lines A, D, B, E, C, F: pixel size in x, rotation terms (0: the image is grid north up), minus the
   pixel size in y, and the centre of the upper-left pixel. Two versions: "dxf" in the DXF's own coordinates (inches, the window where
   the aerial sheet puts it: attach the PNG in CAD and it lands under the sheet's plan) and "grid" in the State Plane zone's native unit
   (GIS / civil base files).
   Cache: in memory only (per page; nothing stored). */
(function () {
  'use strict';
  const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
  const ATTR = 'Tiles (c) Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
  const NOTE = 'Aerial background: Esri World Imagery. Imagery date varies by area (the service does not state it on the tiles); not a survey. The overlays are the project\'s grid coordinates.';
  const MAX_TILES = 64, MAX_PX = 3000, ZMAX = 19, TIMEOUT = 15000, M_PER_FT = 1200 / 3937, R0 = 156543.03392804097;
  const isNum = v => typeof v === 'number' && isFinite(v);
  /* ---------- arithmetic (Node-tested) ---------- */
  function merc(lat, lng, z) { const n = 256 * Math.pow(2, z), s = Math.sin(lat * Math.PI / 180); return { x: (lng + 180) / 360 * n, y: (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * n }; }
  const res = (lat, z) => R0 * Math.cos(lat * Math.PI / 180) / Math.pow(2, z);   // m per pixel
  function pickZoom(lat, sM, zmax) { const z = Math.ceil(Math.log2(R0 * Math.cos(lat * Math.PI / 180) / sM) - 1e-9); return Math.max(0, Math.min(zmax == null ? ZMAX : zmax, z)); }
  function tiles(a, b, max) {
    const x0 = Math.floor(Math.min(a.x, b.x) / 256), x1 = Math.floor(Math.max(a.x, b.x) / 256), y0 = Math.floor(Math.min(a.y, b.y) / 256), y1 = Math.floor(Math.max(a.y, b.y) / 256);
    const n = (x1 - x0 + 1) * (y1 - y0 + 1); return { x0, x1, y0, y1, n, ok: !max || n <= max };
  }
  /* affine(src, dst) through three point pairs: T = [a, b, c, d, e, f] with x' = a x + c y + e, y' = b x + d y + f (the canvas order) */
  function affine(s, d) {
    const [[x1, y1], [x2, y2], [x3, y3]] = s, det = (x2 - x1) * (y3 - y1) - (x3 - x1) * (y2 - y1);
    const solve = (u1, u2, u3) => { const p = ((u2 - u1) * (y3 - y1) - (u3 - u1) * (y2 - y1)) / det, q = ((x2 - x1) * (u3 - u1) - (x3 - x1) * (u2 - u1)) / det; return [p, q, u1 - p * x1 - q * y1]; };
    const X = solve(d[0][0], d[1][0], d[2][0]), Y = solve(d[0][1], d[1][1], d[2][1]);
    return [X[0], Y[0], X[1], Y[1], X[2], Y[2]];
  }
  const apply = (T, p) => [T[0] * p[0] + T[2] * p[1] + T[4], T[1] * p[0] + T[3] * p[1] + T[5]];
  function invert(T) { const [a, b, c, d, e, f] = T, det = a * d - b * c; return [d / det, -b / det, -c / det, a / det, (c * f - d * e) / det, (b * e - a * f) / det]; }
  /* worldFile(w, wpx, hpx, frame, nat) -> { s, grid: [A, D, B, E, C, F], dxf | null }; frame = the window in DXF units { X0, Y0, X1, Y1 }
     (inches); nat(ft) -> the zone's native unit (default: ft) */
  function worldFile(w, wpx, hpx, frame, nat) {
    const s = (w.x1 - w.x0) / wpx, n = nat || (v => v), A = n(s);
    const grid = [A, 0, 0, -A, n(w.x0) + A / 2, n(w.y1) - A / 2];
    let dxf = null; if (frame) { const a = (frame.X1 - frame.X0) / wpx; dxf = [a, 0, 0, -a, frame.X0 + a / 2, frame.Y1 - a / 2]; }
    return { s, sy: (w.y1 - w.y0) / hpx, grid, dxf };
  }
  const pgw = a => a.map(v => (Math.abs(v) < 5e-11 ? 0 : v).toFixed(10)).join('\n') + '\n';
  /* the image size of a window at a sheet scale k (1:k at full size): 150 dpi, <= MAX_PX on the long side */
  function sizeFor(w, k, lat) {
    const W = w.x1 - w.x0, H = w.y1 - w.y0; let s = (k || 48) / 1800;
    s = Math.max(s, Math.max(W, H) / MAX_PX, isNum(lat) ? res(lat, ZMAX) / M_PER_FT : 0);
    const wpx = Math.max(1, Math.round(W / s)), hpx = Math.max(1, Math.round(H / s)); return { s: W / wpx, wpx, hpx };
  }
  /* ---------- the image (browser) ---------- */
  const cache = new Map();   // key -> state { status: 'loading' | 'ok' | 'partial' | 'fail', url, why, z, n, nOk, wpx, hpx, w, s, resid, promise }
  const keyOf = (w, zone, k) => [zone, w.x0, w.y0, w.x1, w.y1, k].map(v => typeof v === 'number' ? v.toFixed(2) : v).join('|');
  function plan(w, zone, k) {
    const G = window.CranePickGeo, p4 = window.proj4; if (!G || !p4) return { err: 'the map libraries (proj4js) did not load' };
    const ll = (x, y) => G.ftToLl(p4, zone, x, y), c = ll((w.x0 + w.x1) / 2, (w.y0 + w.y1) / 2);
    const sz = sizeFor(w, k, c.lat); let z = pickZoom(c.lat, sz.s * M_PER_FT, ZMAX), T = null, tl = null, M = null;
    const corners = [[w.x0, w.y1, 0, 0], [w.x1, w.y1, sz.wpx, 0], [w.x0, w.y0, 0, sz.hpx], [w.x1, w.y0, sz.wpx, sz.hpx]].map(([x, y, u, v]) => ({ ll: ll(x, y), u, v, x, y }));
    for (; z >= 0; z--) { M = corners.map(q => merc(q.ll.lat, q.ll.lng, z)); const xs = M.map(m => m.x), ys = M.map(m => m.y); tl = tiles({ x: Math.min(...xs), y: Math.min(...ys) }, { x: Math.max(...xs), y: Math.max(...ys) }, MAX_TILES); if (tl.ok) break; }
    const o = { x: tl.x0 * 256, y: tl.y0 * 256 };
    T = affine(corners.slice(0, 3).map(q => [q.u, q.v]), M.slice(0, 3).map(m => [m.x - o.x, m.y - o.y]));   // output px -> mosaic px
    const p4c = apply(T, [sz.wpx, sz.hpx]), mc = merc(c.lat, c.lng, z), pc = apply(T, [sz.wpx / 2, sz.hpx / 2]);
    const resid = Math.max(Math.hypot(p4c[0] - (M[3].x - o.x), p4c[1] - (M[3].y - o.y)), Math.hypot(pc[0] - (mc.x - o.x), pc[1] - (mc.y - o.y))) * res(c.lat, z) / M_PER_FT;
    return Object.assign({ z, tl, T, o, resid, lat: c.lat }, sz);
  }
  function loadTile(url) {
    return new Promise(ok => { const im = new Image(); let done = false; const fin = v => { if (!done) { done = true; ok(v); } };
      im.crossOrigin = 'anonymous'; im.onload = () => fin(im); im.onerror = () => fin(null); setTimeout(() => fin(null), TIMEOUT); im.src = url; });
  }
  /* request(w, zone, k) -> state (cached); state.promise resolves when it is done */
  function request(w, zone, k) {
    const key = keyOf(w, zone, k); if (cache.has(key)) return cache.get(key);
    const st = { key, status: 'loading', w, why: '' }; cache.set(key, st);
    st.promise = (async () => {
      try {
        if (typeof document === 'undefined') throw new Error('no browser');
        const pl = plan(w, zone, k); if (pl.err) throw new Error(pl.err);
        Object.assign(st, { z: pl.z, n: pl.tl.n, wpx: pl.wpx, hpx: pl.hpx, s: pl.s, resid: pl.resid });
        const mos = document.createElement('canvas'); mos.width = (pl.tl.x1 - pl.tl.x0 + 1) * 256; mos.height = (pl.tl.y1 - pl.tl.y0 + 1) * 256;
        const mx = mos.getContext('2d'), jobs = [];
        for (let ty = pl.tl.y0; ty <= pl.tl.y1; ty++) for (let tx = pl.tl.x0; tx <= pl.tl.x1; tx++) {
          const url = ESRI.replace('{z}', pl.z).replace('{y}', ty).replace('{x}', tx);
          jobs.push(loadTile(url).then(im => { if (im) { mx.drawImage(im, (tx - pl.tl.x0) * 256, (ty - pl.tl.y0) * 256); return 1; } return 0; }));
        }
        const got = (await Promise.all(jobs)).reduce((a, b) => a + b, 0); st.nOk = got;
        if (!got) throw new Error('no imagery tile loaded (offline, or the tile server is blocked)');
        const out = document.createElement('canvas'); out.width = pl.wpx; out.height = pl.hpx; const ox = out.getContext('2d');
        ox.fillStyle = '#fff'; ox.fillRect(0, 0, pl.wpx, pl.hpx);
        const I = invert(pl.T); ox.setTransform(I[0], I[1], I[2], I[3], I[4], I[5]); ox.imageSmoothingQuality = 'high'; ox.drawImage(mos, 0, 0); ox.setTransform(1, 0, 0, 1, 0, 0);
        try { st.url = out.toDataURL('image/png'); }
        catch (e) { throw new Error('the tile server does not allow its images to be saved from this page (CORS)'); }
        st.status = got < pl.tl.n ? 'partial' : 'ok'; if (got < pl.tl.n) st.why = `${pl.tl.n - got} of ${pl.tl.n} tiles did not load`;
      } catch (e) { st.status = 'fail'; st.why = e.message || String(e); st.url = null; }
      (st.subs || []).forEach(f => { try { f(st); } catch (e) { console.error(e); } });
      return st;
    })();
    return st;
  }
  function onDone(st, f) { if (st.status !== 'loading') { f(st); return; } (st.subs = st.subs || []).push(f); }
  /* inject(svg, sheet, st, vb): the image under the drawing of a sheet SVG (SharedDxf.toSVG / sheetSVG with the frame [ox, 0, ox + W, H]),
     placed at the aerial window's frame rectangle (sheet.aerial.e: the DXF entity, after the sheet moved it); with the status note.
     vb (optional): { x0, y1 } of the SVG when it is not a sheet frame (a figure: toSVG's own padded box). */
  function frameOf(e) { const xs = e.pts.map(p => p[0]), ys = e.pts.map(p => p[1]); return { X0: Math.min(...xs), X1: Math.max(...xs), Y0: Math.min(...ys), Y1: Math.max(...ys) }; }
  function inject(svg, sheet, st, vb) {
    if (!sheet || !sheet.aerial || !sheet.aerial.e) return svg;
    const f = frameOf(sheet.aerial.e), x0 = vb ? vb.x0 : (sheet.ox || 0), y1 = vb ? vb.y1 : sheet.H, X = x => +(x - x0).toFixed(3), Y = y => +(y1 - y).toFixed(3);
    const hh = sheet.aerial.h || 1, msg = !st ? '' : st.status === 'loading' ? 'AERIAL IMAGERY LOADING...' : st.status === 'fail' ? `AERIAL NOT AVAILABLE - PRINTED WITHOUT BACKGROUND (${st.why})` : st.status === 'partial' ? `AERIAL INCOMPLETE: ${st.why}` : '';
    let add = '';
    if (st && st.url) add += `<image href="${st.url}" x="${X(f.X0)}" y="${Y(f.Y1)}" width="${+(f.X1 - f.X0).toFixed(3)}" height="${+(f.Y1 - f.Y0).toFixed(3)}" preserveAspectRatio="none" opacity="0.85" class="crAerialImg"/>`
      + `<rect x="${X(f.X0)}" y="${Y(f.Y1)}" width="${+(f.X1 - f.X0).toFixed(3)}" height="${+(f.Y1 - f.Y0).toFixed(3)}" fill="#fff" fill-opacity="0.18"/>`;
    if (msg) add += `<text x="${X(f.X0) + hh}" y="${Y(f.Y1) + 2 * hh}" font-size="${+(1.1 * hh).toFixed(3)}" fill="${st.status === 'fail' ? '#B91C1C' : '#92400E'}" class="crAerialMsg">${msg.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))}</text>`;
    if (!add) return svg;
    const m = /<rect width="100%" height="100%" fill="[^"]*"\/>/.exec(svg);
    if (m) return svg.slice(0, m.index + m[0].length) + add + svg.slice(m.index + m[0].length);
    return svg.replace(/(<svg[^>]*>(?:<title>[^<]*<\/title>)?)/, '$1' + add);
  }
  /* the image and its world files for download: { png (data URL), pgw (DXF coordinates), pgwGrid (State Plane, native unit) } */
  function files(st, sheet, zone) {
    if (!st || !st.url || !sheet || !sheet.aerial) return null;
    const G = window.CranePickGeo, f = frameOf(sheet.aerial.e), wf = worldFile(st.w, st.wpx, st.hpx, f, v => G.ftToNative(zone, v));
    return { png: st.url, pgw: pgw(wf.dxf), pgwGrid: pgw(wf.grid), wf };
  }
  function save(href, name) { const a = document.createElement('a'); a.href = href; a.download = name; a.rel = 'noopener'; document.body.appendChild(a); a.click(); a.remove(); }
  function saveText(text, name) { const u = URL.createObjectURL(new Blob([text], { type: 'text/plain' })); save(u, name); setTimeout(() => URL.revokeObjectURL(u), 4000); }
  window.CranePickAerial = { ESRI, ATTR, NOTE, MAX_TILES, MAX_PX, ZMAX, merc, res, pickZoom, tiles, affine, apply, invert, worldFile, pgw, sizeFor, plan, request, onDone, inject, files, save, saveText, frameOf,
    get cache() { return cache; }, clear: () => cache.clear() };
})();
