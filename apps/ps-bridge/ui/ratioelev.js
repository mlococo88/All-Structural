/* apps/ps-bridge/ui/ratioelev.js — window.PSBRatioElev: "Girder elevation coloured by governing ratio" on a check tab (2026-11-15, batch B;
   the steel app's elevation of the Flexure / Shear tabs, apps/steel-bridge/ui/alonggfx.js: one band per station of the check's table, the
   stretch to the mid-points of its neighbours, neighbouring bands of one colour class merged and labelled with their largest ratio; green
   below 0.90, amber 0.90 to 1.00, red above 1.00; a flag at the governing check). Classic script, display only: the ratios are the tab's
   own (each tab hands in its stations and the ratio its read-out or table shows, e.g. the engine's shear d/c, M_u / φM_n of the flexure
   read-out); the governing check is the engine's (R.checks: its x and ratio).
     svg(W, o) -> { svg, nar }   o = { L (ft), pts: [{ x, r }], gov: { x, r, name }, label (the band's title) }
     mount(slot, o)              a PSBVizKit.detCard (title, read-out of each band, Download DXF as every graphic) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fin = v => typeof v === 'number' && isFinite(v);
  const cls = r => !fin(r) || r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok';
  const COL = { ok: ['#E3F4EA', '#2F6E4E'], hi: ['#FEF3C7', '#8A5A0B'], ng: ['#FDE2E1', '#A3322A'] };
  const f2 = v => (fin(v) ? v.toFixed(2) : v === Infinity ? '∞' : 'NaN'), f3 = v => (fin(v) ? v.toFixed(3) : v === Infinity ? '∞' : 'NaN');
  const nice = (span, n) => { const r = span / n, p = Math.pow(10, Math.floor(Math.log10(r))), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
  /* the merged bands: [{ x0, x1, c, r (largest), i0, i1 }] */
  function bands(L, pts) {
    const P = pts.filter(q => fin(q.x)).slice().sort((a, b) => a.x - b.x), out = [];
    P.forEach((q, i) => { const x0 = i ? (P[i - 1].x + q.x) / 2 : 0, x1 = i < P.length - 1 ? (q.x + P[i + 1].x) / 2 : L, c = cls(q.r), b = out[out.length - 1];
      if (b && b.c === c) { b.x1 = x1; if (!fin(b.r) || !fin(q.r) ? !fin(q.r) : q.r > b.r) { b.r = q.r; b.xr = q.x; } b.n++; } else out.push({ x0, x1, c, r: q.r, xr: q.x, n: 1 }); });
    return out;
  }
  function svg(W, o) {
    const L = o.L, l = 14, r = 14, X = x => l + Math.max(0, Math.min(L, x)) / L * (W - l - r), nar = W < 560;
    const yG = 34, hG = 22, yB = yG + hG + 34, hB = 22, yA = yB + hB + 30, H = yA + 30;
    let s = `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || 'Girder elevation coloured by governing ratio')}" font-family="Arial,sans-serif">`;
    // the girder and its bearings
    s += `<rect class="re-g" x="${X(0)}" y="${yG}" width="${X(L) - X(0)}" height="${hG}" fill="#E2E8F0" stroke="#475569" stroke-width="1" data-dtr="Girder, ℄ bearing to ℄ bearing L = ${f2(L)} ft"/>`;
    [0, L].forEach(x => { s += `<path class="re-s" d="M${X(x)} ${yG + hG} l-6 10 h12 z" fill="#64748B"/>`; });
    s += `<text x="${(X(0) + X(L)) / 2}" y="${yG - 8}" text-anchor="middle" font-size="11" fill="#475569">Span L = ${f2(L)} ft (℄ bearing to ℄ bearing)</text>`;
    // the band
    s += `<text x="${X(0)}" y="${yB - 8}" font-size="11" fill="#0F172A">${esc(o.label || 'Governing ratio')}</text>`;
    bands(L, o.pts).forEach(b => { const [fl, st] = COL[b.c], x0 = X(b.x0), w = Math.max(1, X(b.x1) - x0);
      s += `<rect class="re-${b.c}" x="${x0.toFixed(1)}" y="${yB}" width="${w.toFixed(1)}" height="${hB}" fill="${fl}" stroke="${st}" stroke-width="0.8" data-dtr="x = ${f2(b.x0)} to ${f2(b.x1)} ft: largest ratio ${f3(b.r)} at x = ${f2(b.xr)} ft (${b.n} station${b.n === 1 ? '' : 's'}; ${b.c === 'ok' ? 'below 0.90' : b.c === 'hi' ? '0.90 to 1.00' : 'above 1.00'})"/>`;
      if (w > (nar ? 28 : 34)) s += `<text x="${(x0 + w / 2).toFixed(1)}" y="${yB + 15}" text-anchor="middle" font-size="11" font-weight="600" fill="${st}" pointer-events="none">${f2(b.r)}</text>`;
      // the same colour on the girder
      s += `<rect x="${x0.toFixed(1)}" y="${yG + 2}" width="${w.toFixed(1)}" height="${hG - 4}" fill="${fl}" opacity="0.85" pointer-events="none"/>`; });
    // the governing check
    if (o.gov && fin(o.gov.x)) { const gx = X(o.gov.x), gc = COL[cls(o.gov.r)][1], lab = `Governs: ${o.gov.name ? o.gov.name + ' ' : ''}${f3(o.gov.r)} at x = ${f2(o.gov.x)} ft`;
      s += `<line x1="${gx}" x2="${gx}" y1="${yG - 4}" y2="${yB + hB + 4}" stroke="${gc}" stroke-width="1.6"/>`;
      s += `<text x="${Math.min(Math.max(gx, l + 4), W - r - 4)}" y="${yB + hB + 18}" text-anchor="${gx > W * 0.6 ? 'end' : gx < W * 0.3 ? 'start' : 'middle'}" font-size="11" font-weight="600" fill="${gc}">${esc(lab)}</text>`; }
    // the axis
    const st = nice(L, nar ? 4 : 8); s += `<line x1="${X(0)}" x2="${X(L)}" y1="${yA}" y2="${yA}" stroke="#94A3B8"/>`;
    for (let x = 0; x <= L + 1e-9; x += st) s += `<line x1="${X(x)}" x2="${X(x)}" y1="${yA}" y2="${yA + 4}" stroke="#94A3B8"/><text x="${X(x)}" y="${yA + 15}" text-anchor="middle" font-size="10" fill="#475569">${+x.toFixed(2)}</text>`;
    s += `<text x="${X(L)}" y="${yA + 27}" text-anchor="end" font-size="10" fill="#475569">Station x, ft (from ℄ bearing, left)</text></svg>`;
    return { svg: s, nar };
  }
  const LEG = '<p class="vk-cap"><span style="display:inline-block;width:12px;height:9px;background:#E3F4EA;border:1px solid #2F6E4E"></span> below 0.90 &nbsp; <span style="display:inline-block;width:12px;height:9px;background:#FEF3C7;border:1px solid #8A5A0B"></span> 0.90 to 1.00 &nbsp; <span style="display:inline-block;width:12px;height:9px;background:#FDE2E1;border:1px solid #A3322A"></span> above 1.00</p>';
  function mount(slot, o) {
    const VK = window.PSBVizKit; if (!slot || !VK || !VK.detCard) return null;
    return VK.detCard(slot, { id: o.id, title: o.title || 'Girder elevation coloured by governing ratio', sub: o.sub || '', draw: W => { const q = svg(W, o); return { html: q.svg, nar: q.nar }; },
      hint: 'Point at (or tap) a band to read its stations and ratio.', cap: LEG + (o.cap || ''), file: o.file });
  }
  window.PSBRatioElev = { svg, mount, bands, cls };
})();
