/* apps/steel-bridge/ui/vizalong.js — window.SBDVizAlong: the along-girder pieces of the "modern data-viz" graphic style (option C of the Section
   properties graphic, ui/vizkit.js), for the graphics drawn along the girder (engineer's decision 2026-11-10: restyle every on-screen CAD-style
   graphic; family (b): the elevations, ratio bands and charts over the stations). Classic script, display only: nothing here computes an
   engineering value; a graphic hands in the numbers (and the text) its tab already has. No storage. Uses SBDVizKit (css, chips, fit, print,
   niceStep, defs) and SBDGraphics (textW, download) when they are loaded; render() and staticSvg() need no DOM (the Report's figure).
   Kept in its own file, beside vizkit.js, so that the along-girder pieces stay separate from the section pieces.

   API (strings unless stated; SVG classes are scoped to svg.va, card classes to .va-card)
     VA.render(spec, W) -> R            the SVG of an along-girder figure at width W px: rows stacked on one station scale, a station axis under them
         spec = { L0, L1 (ft), sup: [ft] (support lines through the charts), rows: [row], sel: ft (the selected station line), selLabel, axis (false: none),
                  axisTitle, aria, left (px of the y scale), at(x, rowKey, y) -> [line1, line2] | null (read-out), pickX(x) -> value (click) }
         rows: { kind: 'elev', geo: { segs: [{ x0, x1, D, topT, botT }], sup, spl, cf, deck: { ts } }, fill: [{ x0, x1, cls }], stiff: [{ x, kind: cp | ts | bs }],
                   marks: [{ x, y (in from the bottom of the web; < 0 bottom flange, > D top flange), shape: circle | diamond, cls, sel, gov, reg }],
                   boxes: [{ x0, x1, cls: gov | sel }] (outlines in the web), welds (true: the flange-to-web weld lines), above: [part], below: [part] }
                 parts (from the girder outward): { t: 'flags', items: [{ x, y (as marks), text, cls, reg }] }, { t: 'dims', items: [{ x0, x1, texts: [first that fits] }] },
                   { t: 'boxes', items: [{ x0, x1, texts }] }, { t: 'cells', label, items: [{ x0, x1, cls, top, bottom, sel, reg }], note }
               { kind: 'band', label, items: [{ x0, x1, cls, text, sel, reg }], flag: { x, text, cls }, areas: [{ x0, x1, reg }] (click areas), selBox: { x0, x1 } }
               { kind: 'text', lines: [text] }
               elev also takes areas: [{ x0, x1, pad (px), reg }] (click / read-out areas over the web), webLabels: [{ x0, x1, text, cls }], marks' dx (px) and small;
               chart also takes rings: [{ x, y }] (the selected point)
               { kind: 'chart', key, label, h, series: [{ key, name, pts: [[x, y, cls]], kind: line | points, ci (colour 0..5), dash, cls }], hidden: { key: true },
                   yr, cap, fy (tick format), limits: [{ y, label }], labels: [{ x, y, text }], gov: [{ x, y, text }], links: [{ x, y0, y1 }], supNames: [text] }
         R = { svg, regs: [{ x0, y0, x1, y1, v, lab, pri }] (px; click and read-out areas), rows: [{ key, y0, y1, yv(py) }], X(ft), FT(px), top, axisY, W, H }
     VA.hbars(spec, W) -> R             category bars (one row per item, horizontal): spec = { panels: [{ label, unit, fx, items: [{ id, key, bars: [{ v, cls|ci, name }], lab }],
                                        limit: { v, label } }] }
     VA.staticSvg(spec, W)              render() with its style sheet inside the SVG (static figure: the Report, the Summary tab); prints grey / hatched
     VA.mount(slot, o) -> H             the card: title + Download DXF, optional controls, the figure fitted to the card (redrawn on resize and on
         'sbd2:panelresize', and at 760 px or more for printing), the read-out line (hover with the mouse; a tap or click shows the same and selects),
         series chips, legend, caption and notes. o = { key, title, sub, controls (html), draw(W) -> R (render or hbars), chips: () => [{ key, html, on }],
         onChip(key), onSelect(value), legend (html), caption (html), notes (html), hint, dxf() -> a graphic { D, file } (SBDGraphics.download), file }
         H = { el, redraw(), select(v) } (o.onSelect is called with the value of the area clicked, else spec.pickX(x))
     VA.legend(kind)                    'ratio' (green < 0.90, amber 0.90 to 1.00, red > 1.00 or NG; the classes of the tabs' tables), 'marks' (governing / selected)
     VA.swatch(ci, dash)                a series line sample (chips and the print legend)
     VA.sub(text)                       "M_DC1" -> SVG text with a subscript (tspans);  VA.esc(s);  VA.css()
     VA.DXF_NOTE                        the note that Download DXF is the CAD line drawing (the shaded graphic is screen and print only)
   Ratio classes: ok (< 0.90), hi (0.90 to 1.00), ng (> 1.00 or NG), na (no ratio); each graphic passes the class its old drawing used.
   Print (and the static figure in print): ok white, hi grey, ng hatched, series black with a dash pattern each, no read-out.
   Fix log: fixlog/steel-bridge.md (SBVZB, 2026-11-10). */
(function () {
  'use strict';
  const VK = () => window.SBDVizKit, GR = () => window.SBDGraphics;
  const fin = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r2 = v => +(+v).toFixed(2);
  const SER = ['#1E3A5F', '#2563EB', '#0F766E', '#DC6B2F', '#7C3AED', '#64748B'];
  const PDASH = ['', '6 3', '2 2', '8 3 2 3', '1 3', '10 4'];
  const RC = { ok: ['#DCEFE4', '#5A9E7A', '#2F6E4E', '#3F8F66'], hi: ['#FBEBC5', '#C9952B', '#8A5A0B', '#D39A1E'], ng: ['#F7D3CD', '#C9584B', '#A3322A', '#C9443A'], na: ['#EEF1F4', '#A8B3C0', '#64748B', '#A8B3C0'] };
  const DXF_NOTE = 'Download DXF gives the CAD line drawing of this graphic (layers, dimensions and text in the Drawings-tab format); the shaded graphic above is for the screen and the printout only.';
  /* "M_DC1", "(DELTA F)_n": the part after _ (letters, digits, +) as a subscript */
  const SUBRE = /([A-Za-zΑ-Ωα-ωℓ)])_\{?([A-Za-z0-9ℓ]+(?:[,+][A-Za-z0-9ℓ]+)*)\}?/g;   // the rule of ui/sub.js (SBDSub): M_DC1, M_LL+IM, (DELTA F)_n
  const sub = s => esc(s).replace(SUBRE, '$1<tspan dy="3" font-size="0.8em">$2</tspan><tspan dy="-3">\u200b</tspan>');
  const plain = s => String(s == null ? '' : s).replace(/<[^>]+>/g, '');
  const tw = (s, px) => { const g = GR(); const t = plain(s).replace(/&[a-z]+;/g, 'x'); return g && g.textW ? g.textW(t, px) : t.length * px * 0.56; };
  /* the words of s in lines no wider than w px (text of size px) */
  const wrapPx = (s, w, px) => { const out = []; let cur = ''; String(s).split(/\s+/).forEach(q => { const t = cur ? cur + ' ' + q : q; if (cur && tw(t, px) > w) { out.push(cur); cur = q; } else cur = t; }); if (cur) out.push(cur); return out; };
  const T = (x, y, s, cls, a, extra) => `<text x="${r2(x)}" y="${r2(y)}"${a ? ` text-anchor="${a}"` : ''}${cls ? ` class="${cls}"` : ''}${extra || ''}>${s}</text>`;
  const L = (x1, y1, x2, y2, cls, extra) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" class="${cls}"${extra || ''}/>`;
  const R = (x, y, w, h, cls, extra) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}" class="${cls}"${extra || ''}/>`;
  const PL = (p, cls, extra) => `<polyline points="${p.map(q => r2(q[0]) + ',' + r2(q[1])).join(' ')}" class="${cls}" fill="none"${extra || ''}/>`;
  const PG = (p, cls, extra) => `<polygon points="${p.map(q => r2(q[0]) + ',' + r2(q[1])).join(' ')}" class="${cls}"${extra || ''}/>`;
  const C = (x, y, r, cls, extra) => `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(r)}" class="${cls}"${extra || ''}/>`;
  const niceStep = (span, n) => { const raw = Math.abs(span) / Math.max(1, n || 6), m = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / m; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * m; };
  const fmtT = (v, st) => { const d = st >= 1 ? 0 : st >= 0.1 ? 1 : 2, t = (+v).toFixed(d); return /^-0(\.0+)?$/.test(t) ? t.slice(1) : t.replace('-', '−'); };

  /* ---------- the style sheet (svg.va: screen and print; .va-card: the card) ---------- */
  const SVGCSS = `svg.va{display:block;width:100%;height:auto;font-family:var(--font-ui,Arial,sans-serif);touch-action:pan-x pan-y;}
svg.va text{fill:#0F172A;font-size:12px;} svg.va text.m{fill:#475569;} svg.va text.xs{font-size:10.5px;fill:#475569;} svg.va text.b{font-weight:600;} svg.va text.halo{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;}
svg.va text.t-ok{fill:${RC.ok[2]};} svg.va text.t-hi{fill:${RC.hi[2]};} svg.va text.t-ng{fill:${RC.ng[2]};} svg.va text.t-na{fill:${RC.na[2]};} svg.va text.t-gov{fill:#1E3A5F;font-weight:600;} svg.va text.t-sel{fill:#2563EB;font-weight:600;}
svg.va .gr{stroke:#EEF1F4;stroke-width:1;} svg.va .ax{stroke:#94A3B8;stroke-width:1;fill:none;} svg.va .zero{stroke:#64748B;stroke-width:1;} svg.va .sup{stroke:#CBD5E1;stroke-width:1;stroke-dasharray:3 3;}
svg.va .fl{fill:#64748B;} svg.va .web{fill:#E2E8F0;} svg.va .wo{fill:none;stroke:#94A3B8;stroke-width:.7;} svg.va .dk{fill:#ECE7DC;stroke:#C9C0AD;stroke-width:.8;} svg.va .brg{fill:#94A3B8;}
svg.va .cf{stroke:#94A3B8;stroke-width:.8;stroke-dasharray:2 2;} svg.va .pb{stroke:#fff;stroke-width:1.4;} svg.va .fs{stroke:#1E3A5F;stroke-width:1.4;stroke-dasharray:5 3;} svg.va .wl{stroke:#DC6B2F;stroke-width:1.3;}
svg.va .st-cp,svg.va .st-bs{stroke:#8A5A44;stroke-width:1.4;} svg.va .st-ts{stroke:#8A5A44;stroke-width:1.2;stroke-dasharray:3 2;} svg.va .dim{stroke:#94A3B8;stroke-width:.8;fill:none;}
svg.va .bx{fill:#F8FAFC;stroke:#94A3B8;stroke-width:.8;} svg.va .ld{stroke:#94A3B8;stroke-width:.7;fill:none;}
${Object.keys(RC).map(k => `svg.va .c-${k}{fill:${RC[k][0]};stroke:${RC[k][1]};stroke-width:.8;} svg.va .mk-${k}{fill:${RC[k][3]};stroke:#fff;stroke-width:1;}`).join(' ')}
svg.va .c-na{stroke-dasharray:3 2;} svg.va .ring-sel{fill:none;stroke:#2563EB;stroke-width:1.8;} svg.va .ring-gov{fill:none;stroke:#1E3A5F;stroke-width:1.6;} svg.va .selx{stroke:#2563EB;stroke-width:1.6;stroke-opacity:.85;}
svg.va .lim{stroke:#C9443A;stroke-width:1.2;stroke-dasharray:6 4;} svg.va .link{stroke:#94A3B8;stroke-width:1;stroke-dasharray:3 2;} svg.va .cap{stroke-width:1.2;stroke-dasharray:4 3;fill:none;} svg.va .arw{stroke:none;}
${SER.map((c, i) => `svg.va .s${i}{stroke:${c};stroke-width:1.8;fill:none;} svg.va .p${i}{fill:${c};stroke:#fff;stroke-width:1;} svg.va .f${i}{fill:${c};}`).join(' ')}
svg.va .bar0{fill:#1E3A5F;} svg.va .bar1{fill:#CBD5E1;stroke:#94A3B8;stroke-width:.8;}
svg.va .hl{stroke:#0F172A;stroke-width:.6;stroke-dasharray:3 3;} svg.va .tip{fill:#0F172A;opacity:.88;} svg.va .va-hov text{fill:#fff;font-size:11px;} svg.va .va-hov{pointer-events:none;}
@media print{svg.va text,svg.va text.m,svg.va text.xs,svg.va text[class*="t-"]{fill:#000;} svg.va .fl{fill:#9A9A9A;} svg.va .web{fill:#fff;} svg.va .wo{stroke:#000;} svg.va .dk{fill:#fff;stroke:#000;} svg.va .brg{fill:#777;}
  svg.va .c-ok{fill:#fff;stroke:#000;} svg.va .c-hi{fill:#D4D4D4;stroke:#000;} svg.va .c-ng{fill:url(#vk-ht);stroke:#000;} svg.va .c-na{fill:#fff;stroke:#777;}
  svg.va .mk-ok{fill:#fff;stroke:#000;} svg.va .mk-hi{fill:#9A9A9A;stroke:#000;} svg.va .mk-ng{fill:#000;stroke:#000;} svg.va .mk-na{fill:#fff;stroke:#777;}
  ${SER.map((c, i) => `svg.va .s${i}{stroke:#000;${PDASH[i] ? `stroke-dasharray:${PDASH[i]};` : ''}} svg.va .p${i}{fill:#000;} svg.va .f${i}{fill:#000;}`).join(' ')}
  svg.va .bar0{fill:#555;} svg.va .bar1{fill:#fff;stroke:#000;} svg.va .lim{stroke:#000;} svg.va .ring-sel,svg.va .ring-gov,svg.va .selx{stroke:#000;} svg.va .wl{stroke:#000;} svg.va .fs{stroke:#000;} svg.va .st-cp,svg.va .st-bs,svg.va .st-ts{stroke:#000;}
  svg.va .va-hov{display:none;}}
@media (forced-colors:active){svg.va text{fill:CanvasText;} svg.va .fl,svg.va .brg{fill:GrayText;} svg.va .web,svg.va .dk,svg.va .bx{fill:Canvas;stroke:CanvasText;} svg.va [class*="c-"]{stroke:CanvasText;}}`;
  function css() {
    if (typeof document === 'undefined' || document.getElementById('va-css')) return; if (VK()) VK().css();
    const st = document.createElement('style'); st.id = 'va-css';
    st.textContent = SVGCSS + `
.va-card .vk-hd h3 small{display:block;} .va-card .va-ctl{margin:0 0 6px;} .va-card .va-ctl .fRow{margin:0;}
.va-leg{display:flex;flex-wrap:wrap;gap:4px 14px;align-items:center;margin:6px 0 0;font-size:8.5pt;color:#475569;} .va-leg span{display:inline-flex;align-items:center;gap:5px;}
.va-sw{display:inline-block;width:16px;height:10px;border:1px solid;border-radius:2px;box-sizing:border-box;} ${Object.keys(RC).map(k => `.va-sw.c-${k}{background:${RC[k][0]};border-color:${RC[k][1]};}`).join(' ')} .va-sw.c-na{border-style:dashed;}
.va-dot{display:inline-block;width:10px;height:10px;border-radius:50%;box-sizing:border-box;} .va-dot.r-gov{border:2px solid #1E3A5F;} .va-dot.r-sel{border:2px solid #2563EB;} ${Object.keys(RC).map(k => `.va-dot.mk-${k}{background:${RC[k][3]};}`).join(' ')}
.va-st{display:inline-block;width:14px;height:12px;} .va-st.cp{border-left:2px solid #8A5A44;} .va-st.ts{border-left:2px dashed #8A5A44;} .va-st.bs{border-left:2px solid #8A5A44;border-right:2px solid #8A5A44;width:6px;} .va-st.wl{border-top:2px solid #DC6B2F;height:0;width:16px;}
svg.va-mini{display:inline-block;width:24px;height:8px;vertical-align:middle;} .va-card table.va-tb{border-collapse:collapse;font-size:8.5pt;margin:6px 0 0;} .va-card table.va-tb td,.va-card table.va-tb th{border:1px solid #E4E7EB;padding:2px 8px;text-align:right;font-variant-numeric:tabular-nums;} .va-card table.va-tb caption{text-align:left;color:#475569;font-size:8.5pt;}
.va-card .vk-fig svg{touch-action:pan-x pan-y;}
@media print{.va-sw.c-ok{background:#fff;border-color:#000;} .va-sw.c-hi{background:#D4D4D4;border-color:#000;} .va-sw.c-ng{background:repeating-linear-gradient(45deg,#000 0 1px,#fff 1px 4px);border-color:#000;} .va-card .va-ctl{display:none;}
  .va-dot{border-color:#000!important;} .va-dot.mk-ok{background:#fff;border:1px solid #000;} .va-dot.mk-hi{background:#9A9A9A;} .va-dot.mk-ng{background:#000;} .va-st{border-color:#000!important;} .va-card{break-inside:avoid;}}`;
    document.head.appendChild(st);
  }
  const hatchDefs = '<defs><pattern id="vk-ht" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#000" stroke-width="1"/></pattern></defs>';

  /* ---------- label placement: flags on leaders (left-aligned at their x; flipped to end at x near the right edge), rows from the girder outward;
     no label touches another in its row, no leader crosses a label of a nearer row, and no label sits on the leader of a farther one ---------- */
  function placeFlags(items, xmax, gap) {
    const placed = []; gap = gap == null ? 6 : gap;
    items.map((q, i) => i).sort((a, b) => items[b].lx - items[a].lx || a - b).forEach(i => { const q = items[i];
      if (q.lx + q.w > xmax) { q.bx0 = q.lx - q.w; q.flip = true; } else q.bx0 = q.lx; q.bx1 = q.bx0 + q.w;
      for (let r = 0; r < 60; r++) {
        const clash = placed.some(p => (p.row === r && q.bx0 < p.bx1 + gap && q.bx1 + gap > p.bx0) || (Math.abs(p.lx - q.lx) > 1 && ((p.row < r && q.lx > p.bx0 - 2 && q.lx < p.bx1 + 2) || (p.row > r && p.lx > q.bx0 - 2 && p.lx < q.bx1 + 2))));
        if (!clash) { q.row = r; placed.push(q); break; } }
      if (q.row == null) { q.row = placed.length ? Math.max(...placed.map(p => p.row)) + 1 : 0; placed.push(q); } });   // leaders at one x share their line
    return items.length ? Math.max(...items.map(q => q.row || 0)) + 1 : 0;
  }

  /* ---------- render ---------- */
  function render(sp, W, o) {
    o = o || {}; W = Math.max(280, Math.round(W || 900)); const nar = W < 600, left = sp.left != null ? sp.left : (nar ? 40 : 58), right = nar ? 8 : 16, pw = W - left - right;
    const L0 = sp.L0, L1 = sp.L1 > sp.L0 ? sp.L1 : sp.L0 + 1, X = ft => left + (ft - L0) / (L1 - L0) * pw, FT = px => L0 + (px - left) / pw * (L1 - L0);
    const out = [], regs = [], rows = [], c = { W, nar, left, right, pw, X, FT, out, regs, sp, xmax: W - 2 }; let y = 4;
    (sp.rows || []).forEach(row => { if (!row) return;
      if (row.label) { const ls = wrapPx(row.label, W - left - right, 12.6); ls.forEach((t, i) => out.push(T(left, y + 12 + i * 15, sub(t), 'm b'))); y += 18 + (ls.length - 1) * 15; }
      const q = (KIND[row.kind] || (() => ({ h: 0 })))(row, c, y); rows.push({ key: row.key || row.kind, y0: y, y1: y + q.h, yv: q.yv, top: q.top != null ? q.top : y, bot: q.bot != null ? q.bot : y + q.h }); y += q.h + (row.gap != null ? row.gap : 10); });
    const top = rows.length ? rows[0].top : 4; let axisY = y;
    if (sp.axis !== false) { const st = niceStep(L1 - L0, nar ? 4 : 8); out.push(L(X(L0), y, X(L1), y, 'ax'));
      for (let t = Math.ceil(L0 / st - 1e-9) * st; t <= L1 + 1e-9; t += st) out.push(L(X(t), y, X(t), y + 4, 'ax'), T(X(t), y + 16, fmtT(t, st), 'xs', 'middle'));
      out.push(T(X(L1), y + 31, esc(sp.axisTitle || 'Station, ft (from CL bearing, abutment 1)'), 'xs', 'end')); y += 38; }
    if (fin(sp.sel)) { const x = X(Math.max(L0, Math.min(L1, sp.sel))); out.push(L(x, top - 2, x, axisY, 'selx'));
      if (sp.selLabel) { const w = tw(sp.selLabel, 11), fl = x + 5 + w > W - 2; out.push(T(fl ? x - 5 : x + 5, top + 9, esc(sp.selLabel), 't-sel halo', fl ? 'end' : null, ' font-size="11"')); } }
    const H = Math.ceil(y + 2);
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" class="va${o.static ? ' va-static' : ''}" viewBox="0 0 ${W} ${H}"${o.static ? ` width="100%"` : ''} role="img" aria-label="${esc(sp.aria || 'Graphic along the girder')}">${o.static ? `<style>${SVGCSS}</style>` : ''}${hatchDefs}${out.join('')}</svg>`;
    return { svg, regs, rows, X, FT, top, axisY, W, H, left, right, L0, L1 };
  }
  const reg = (c, q, x0, y0, x1, y1) => { if (q && (q.v != null || q.lab)) c.regs.push({ x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1), v: q.v, lab: q.lab, pri: q.pri != null ? q.pri : 5 }); };
  const KIND = {};

  /* the girder elevation (not to scale vertically: the deepest web is webPx high; flanges and deck at least legible) */
  KIND.elev = (row, c, y0) => {
    const g = row.geo, X = c.X, nar = c.nar, webMax = row.webPx || (nar ? 40 : 56), segs = g.segs, Dmax = Math.max(...segs.map(s => s.D)), kv = webMax / Dmax;
    const fp = t => Math.max(2.5, Math.min(nar ? 5 : 7, t * kv * 2)), tmax = Math.max(...segs.map(s => fp(s.topT))), dk = g.deck ? Math.max(4, Math.min(nar ? 7 : 9, g.deck.ts * kv)) : 0;
    const hasFs = (g.spl || []).length > 0, segAt = x => segs.find(s => x >= s.x0 - 1e-9 && x <= s.x1 + 1e-9) || (x < segs[0].x0 ? segs[0] : segs[segs.length - 1]);
    // the parts above and below: heights first (flags need their rows)
    const prep = (parts, dir) => (parts || []).filter(Boolean).map(p => { const q = { p };
      if (p.t === 'flags') { p.items.forEach(it => { it.lx = X(it.x) + (it.dx || 0); it.w = tw(it.text, 11) + 4; }); q.n = placeFlags(p.items, c.xmax); q.h = q.n ? q.n * 15 + 6 : 0; }
      else if (p.t === 'dims') q.h = 22; else if (p.t === 'boxes') q.h = 26; else if (p.t === 'cells') q.h = 14 + 30 + (p.label ? 16 : 0) + (p.note ? 14 : 0); else q.h = 0; q.dir = dir; return q; });
    const ab = prep(row.above, -1), be = prep(row.below, 1), hAb = ab.reduce((s, q) => s + q.h, 0), hBe = be.reduce((s, q) => s + q.h, 0);
    const deckTop = y0 + hAb + (hasFs ? 14 : 4), yTopFl = deckTop + dk + (dk ? 2 : 0), yb = yTopFl + tmax + webMax;   // yb: the bottom of the deepest web (all webs sit on one line, as the CAD elevation)
    const yW = s => yb - s.D * kv, out = c.out, bpx = s => fp(s.botT), bmax = Math.max(...segs.map(bpx));
    const yAt = (x, yIn) => { const s = segAt(x); if (yIn === 'mid' || yIn == null) return yb - s.D * kv / 2; if (yIn === 'top') return yW(s); if (yIn < 0) return yb + bpx(s) * Math.min(1, -yIn / (s.botT || 1));
      if (yIn > s.D) return yW(s) - fp(s.topT) * Math.min(1, (yIn - s.D) / (s.topT || 1)); return yb - yIn * kv; };
    // deck, girder (web, ratio fill, flanges), plate breaks, cross-frames, stiffeners, welds, splices, supports
    if (dk) out.push(R(X(g.L0), deckTop, X(g.L1) - X(g.L0), dk, 'dk'));
    segs.forEach(s => out.push(R(X(s.x0), yW(s), X(s.x1) - X(s.x0), s.D * kv, 'web')));
    (row.fill || []).forEach(f => segs.forEach(s => { const a = Math.max(f.x0, s.x0), b = Math.min(f.x1, s.x1); if (b > a) out.push(R(X(a), yW(s), X(b) - X(a), s.D * kv, 'c-' + (f.cls || 'na'), ' stroke-width="0"')); }));
    segs.forEach(s => out.push(R(X(s.x0), yW(s), X(s.x1) - X(s.x0), s.D * kv, 'wo'), R(X(s.x0), yW(s) - fp(s.topT), X(s.x1) - X(s.x0), fp(s.topT), 'fl'), R(X(s.x0), yb, X(s.x1) - X(s.x0), bpx(s), 'fl')));
    segs.slice(1).forEach(s => out.push(L(X(s.x0), yW(s) - fp(s.topT) - 1, X(s.x0), yW(s) + 0.5, 'pb'), L(X(s.x0), yb - 0.5, X(s.x0), yb + bpx(s) + 1, 'pb')));
    (g.cf || []).forEach(x => { if (x < g.L0 - 1e-6 || x > g.L1 + 1e-6) return; const s = segAt(x); out.push(L(X(x), yW(s) + 1, X(x), yb - 1, 'cf')); });
    (row.stiff || []).forEach(q => { const s = segAt(Math.min(Math.max(q.x, g.L0 + 1e-6), g.L1 - 1e-6)), x = X(q.x);
      if (q.kind === 'bs') [-2, 2].forEach(d => out.push(L(x + d, yW(s), x + d, yb, 'st-bs'))); else out.push(L(x, yW(s), x, yb, q.kind === 'cp' ? 'st-cp' : 'st-ts')); });
    if (row.welds) segs.forEach(s => [yW(s), yb].forEach(yy => out.push(L(X(s.x0), yy, X(s.x1), yy, 'wl'))));
    (row.boxes || []).forEach(q => { const s = segAt((q.x0 + q.x1) / 2); out.push(R(X(q.x0) + 1, yW(s) + 1, X(q.x1) - X(q.x0) - 2, s.D * kv - 2, q.cls === 'gov' ? 'ring-gov' : 'ring-sel')); });
    (g.spl || []).forEach((x, k) => { const s = segAt(x); out.push(L(X(x), deckTop - 3, X(x), yb + bpx(s) + 4, 'fs'), T(X(x), deckTop - 4, `FS${k + 1}`, 'xs', 'middle')); });
    (g.sup || []).forEach((x, k) => { const s = segAt(x), yy = yb + bpx(s), xx = X(x); out.push(PG([[xx, yy], [xx - 6, yy + 9], [xx + 6, yy + 9]], 'brg'), T(xx, yy + 20, `S${k + 1}`, 'xs', 'middle')); });
    // the span lengths between the supports (the old elevation's span dimensions, SharedDxf feet-inches) and the web size of each plate segment where the text fits
    const Xd = typeof window !== 'undefined' ? window.SharedDxf : null, ftin = v => (Xd && Xd.fmtFtIn ? Xd.fmtFtIn(v * 12) : `${(+v).toFixed(2)} ft`), fr = v => (Xd && Xd.frac ? Xd.frac(v) : String(v));
    (g.sup || []).slice(1).forEach((x, k) => { const a = X(g.sup[k]), b = X(x), t = `Span ${k + 1} = ${ftin(x - g.sup[k])}`, t2 = ftin(x - g.sup[k]); const u = tw(t, 10.5) <= (b - a) - 40 ? t : tw(t2, 10.5) <= (b - a) - 30 ? t2 : '';
      if (u) out.push(T((a + b) / 2, yb + bmax + 20, esc(u), 'xs', 'middle')); });
    if (row.webText !== false) segs.forEach(s => { const t = `${fr(s.D)} × ${fr(s.tw)}`, a = X(s.x0), b = X(s.x1); if (tw(t, 10.5) <= (b - a) - 8 && s.D * kv > 16) out.push(T((a + b) / 2, yb - s.D * kv / 2 + 4, esc(t), 'xs halo', 'middle')); });
    // girder regions and the read-out of the plates: the whole girder (the builder's at(x) answers)
    // click / read-out areas over the web (panels, stiffeners: pad px each side) and texts centred in the web where they fit (a panel's ratio)
    (row.areas || []).forEach(q => { const s = segAt(Math.min(Math.max((q.x0 + q.x1) / 2, g.L0 + 1e-6), g.L1 - 1e-6)), pd = q.pad || 0; reg(c, q.reg, X(q.x0) - pd, yW(s), X(q.x1) + pd, yb); });
    (row.webLabels || []).forEach(q => { const s = segAt((q.x0 + q.x1) / 2), a = X(q.x0), b = X(q.x1); if (tw(q.text, 10.5) <= (b - a) - 4 && s.D * kv > 14) out.push(T((a + b) / 2, yb - s.D * kv * 0.3, esc(q.text), 't-' + (q.cls || 'na') + ' b halo', 'middle', ' font-size="10.5"')); });
    (row.marks || []).forEach(q => { const x = X(q.x) + (q.dx || 0), yy = yAt(q.x, q.y), cl = 'mk-' + (q.cls || 'na');
      if (q.shape === 'diamond') out.push(PG([[x, yy - 5.5], [x + 5.5, yy], [x, yy + 5.5], [x - 5.5, yy]], cl)); else out.push(C(x, yy, q.small ? 3.2 : 4.5, cl));
      if (q.gov) out.push(C(x, yy, 8, 'ring-gov')); if (q.sel) out.push(C(x, yy, q.gov ? 11 : 8.5, 'ring-sel'));
      reg(c, q.reg, x - 7, yy - 7, x + 7, yy + 7); });
    // parts above (upward from the deck / FS tags) and below (downward from the supports' labels)
    const yUp0 = deckTop - (hasFs ? 14 : 4), yDn0 = yb + bmax + 30;
    const part = (q, yNear) => { const p = q.p, d = q.dir;   // yNear: the edge of the part next to the girder
      if (p.t === 'flags') { p.items.forEach(it => { const yb2 = yNear + d * (8 + it.row * 15) + (d < 0 ? 0 : 9), ym = yAt(it.x, it.y), cls = it.cls ? 't-' + it.cls : '';
          out.push(L(it.lx, ym + d * 6, it.lx, d < 0 ? yb2 + 3 : yb2 - 10, 'ld'), T(it.flip ? it.lx - 3 : it.lx + 3, yb2, sub(it.text), cls + ' halo', it.flip ? 'end' : null, ' font-size="11"'));
          reg(c, it.reg, it.bx0, yb2 - 11, it.bx1, yb2 + 3); }); return; }
      const yy = d < 0 ? yNear - q.h : yNear;   // top of the part
      if (p.t === 'dims') p.items.forEach(it => { const a = X(it.x0), b = X(it.x1), yl = yy + 16, t = (it.texts || []).find(s => tw(s, 10.5) <= (b - a) * 0.94);
        out.push(L(a, yl, b, yl, 'dim'), L(a, yl - 4, a, yl + 4, 'dim'), L(b, yl - 4, b, yl + 4, 'dim')); if (t) out.push(T((a + b) / 2, yl - 3, esc(t), 'xs', 'middle')); });
      if (p.t === 'boxes') p.items.forEach(it => { const a = X(it.x0), b = X(it.x1), t = (it.texts || []).find(s => tw(s, 11) <= (b - a) * 0.92);
        out.push(R(a + 0.5, yy + 4, b - a - 1, 18, 'bx')); if (t) out.push(T((a + b) / 2, yy + 17, esc(t), 'm', 'middle', ' font-size="11"')); reg(c, it.reg, a, yy + 4, b, yy + 22); });
      if (p.t === 'cells') { let yc = yy; if (p.label) { out.push(T(c.left, yc + 11, esc(p.label), 'xs')); yc += 16; }
        const yC = yc + 15, all = p.items.length > 1 && p.items.every(it => it.sel);
        if (all) out.push(R(X(p.items[0].x0) - 2, yC - 2, X(p.items[p.items.length - 1].x1) - X(p.items[0].x0) + 4, 18, 'ring-sel'));
        p.items.forEach(it => { const a = X(it.x0), b = X(it.x1); out.push(R(a, yC, b - a, 14, 'c-' + (it.cls || 'na')));
          if (it.top && tw(it.top, 10.5) <= (b - a) * 0.96) out.push(T((a + b) / 2, yC - 3, esc(it.top), 'xs', 'middle'));
          if (it.bottom && tw(it.bottom, 10.5) <= (b - a) * 0.96) out.push(T((a + b) / 2, yC + 25, esc(it.bottom), 'xs', 'middle'));
          if (it.sel && !all) out.push(R(a - 1, yC - 1, b - a + 2, 16, 'ring-sel')); reg(c, it.reg, a, yC - 12, b, yC + 28); });
        if (p.note) out.push(T(c.W - c.right, yC + 42, esc(p.note), 'xs', 'end')); } };
    let yu = yUp0; ab.forEach(q => { part(q, yu); yu -= q.h; });
    let yd = yDn0; be.forEach(q => { part(q, yd); yd += q.h; });
    return { h: yd - y0, top: deckTop - (hasFs ? 14 : 0), bot: yb + bmax + 10 };
  };

  /* a band of coloured cells over the stations, with their values and one flag (the governing value) under it */
  KIND.band = (row, c, y0) => {
    const X = c.X, out = c.out, h = 18, yy = y0 + 2;
    (row.items || []).forEach(it => { const a = X(it.x0), b = X(it.x1); out.push(R(a, yy, b - a, h, 'c-' + (it.cls || 'na')));
      if (it.text && tw(it.text, 10.5) <= (b - a) - 6) out.push(T((a + b) / 2, yy + 13, esc(it.text), 't-' + (it.cls || 'na') + ' b', 'middle', ' font-size="10.5"'));
      if (it.sel) out.push(R(a - 1, yy - 2, b - a + 2, h + 4, 'ring-sel')); reg(c, it.reg, a, yy, b, yy + h); });
    (row.areas || []).forEach(q => reg(c, q.reg, X(q.x0), yy, X(q.x1), yy + h));
    if (row.selBox) out.push(R(X(row.selBox.x0) - 1, yy - 2, X(row.selBox.x1) - X(row.selBox.x0) + 2, h + 4, 'ring-sel'));
    let hh = h + 4;
    if (row.flag && fin(row.flag.x)) { const x = X(row.flag.x), w = tw(row.flag.text, 11), fl = x + 4 + w > c.xmax; out.push(L(x, yy + h, x, yy + h + 12, 'ld'), T(fl ? x - 3 : x + 3, yy + h + 22, sub(row.flag.text), 't-' + (row.flag.cls || 'gov') + ' halo', fl ? 'end' : null, ' font-size="11"')); hh += 22; }
    return { h: hh, top: yy, bot: yy + h };
  };

  /* an XY chart over the stations: grid, support lines, zero line, series (lines cut at the cap with a dashed cap and an arrow; points), limits, labels */
  KIND.chart = (row, c, y0) => {
    const X = c.X, out = c.out, nar = c.nar, h = row.h || (nar ? 130 : 170), names = row.supNames ? 16 : 0, top = y0 + 6 + names, bot = top + h, xa = c.left, xb = c.W - c.right;
    const vals = []; (row.series || []).forEach(s => s.pts.forEach(p => { if (fin(p[1])) vals.push(row.cap != null ? Math.min(p[1], row.cap) : p[1]); })); (row.limits || []).forEach(q => { if (fin(q.y)) vals.push(q.y); });
    let yr = row.yr; if (!yr) { const lo = Math.min(0, ...(vals.length ? vals : [0])), hi = Math.max(...(vals.length ? vals : [1]), lo + 1e-9), st0 = niceStep(hi - lo, nar ? 3 : 4); yr = [Math.floor(lo / st0 + 1e-9) * st0, Math.ceil(hi / st0 - 1e-9) * st0]; if (yr[1] <= yr[0]) yr = [yr[0], yr[0] + st0]; }
    const Y = v => bot - (v - yr[0]) / (yr[1] - yr[0]) * h, st = row.ystep || niceStep(yr[1] - yr[0], nar ? 3 : 4), fy = row.fy || (v => fmtT(v, st));
    for (let t = Math.ceil(yr[0] / st - 1e-9) * st; t <= yr[1] + 1e-9; t += st) out.push(L(xa, Y(t), xb, Y(t), 'gr'), T(xa - 5, Y(t) + 3.5, fy(t), 'xs', 'end'));
    out.push(L(xa, top, xa, bot, 'ax'), L(xa, bot, xb, bot, 'ax'));
    (c.sp.sup || []).forEach((x, k) => { out.push(L(X(x), top, X(x), bot, 'sup')); if (row.supNames && row.supNames[k]) { const last = k === c.sp.sup.length - 1; out.push(T(X(x), top - 5, esc(row.supNames[k]), 'xs', k === 0 ? 'start' : last ? 'end' : 'middle')); } });
    if (yr[0] < 0 && yr[1] > 0) out.push(L(xa, Y(0), xb, Y(0), 'zero'));
    (row.limits || []).forEach(q => { if (!fin(q.y) || q.y < yr[0] || q.y > yr[1]) return; out.push(L(xa, Y(q.y), xb, Y(q.y), 'lim')); if (q.label) out.push(T(xa + 4, Y(q.y) - 4, sub(q.label), 'xs halo')); });
    (row.links || []).forEach(q => { if (fin(q.y0) && fin(q.y1)) out.push(L(X(q.x), Y(Math.min(q.y0, yr[1])), X(q.x), Y(Math.min(q.y1, yr[1])), 'link')); });
    const cap = yr[1];
    (row.series || []).forEach((s, si) => { if (row.hidden && row.hidden[s.key]) return; const ci = s.ci != null ? s.ci : si % SER.length, pts = s.pts.filter(p => fin(p[0]) && fin(p[1]));
      if (s.kind === 'points') { pts.forEach(p => { const yy = Y(Math.min(p[1], cap)); if (p[2]) out.push(C(X(p[0]), yy, 4, 'mk-' + p[2])); else if (s.hollow) out.push(C(X(p[0]), yy, 4, 's' + ci, ' fill="#fff" stroke-width="1.6"')); else out.push(C(X(p[0]), yy, 4, 'p' + ci)); }); return; }
      const dash = s.dash ? ` stroke-dasharray="${s.dash}"` : '', runs = [], caps = []; let cur = [], capA = null;
      pts.forEach((p, j) => { const q = pts[j - 1], pin = p[1] <= cap, qin = j ? q[1] <= cap : null;
        if (!j) { if (pin) cur = [[X(p[0]), Y(p[1])]]; else capA = p[0]; return; }
        if (qin && pin) cur.push([X(p[0]), Y(p[1])]);
        else if (qin && !pin) { const xc = q[0] + (cap - q[1]) / (p[1] - q[1]) * (p[0] - q[0]); cur.push([X(xc), Y(cap)]); runs.push(cur); cur = []; capA = xc; }
        else if (!qin && pin) { const xc = q[0] + (cap - q[1]) / (p[1] - q[1]) * (p[0] - q[0]); caps.push([capA, xc]); capA = null; cur = [[X(xc), Y(cap)], [X(p[0]), Y(p[1])]]; } });
      if (cur.length) runs.push(cur); if (capA != null && pts.length) caps.push([capA, pts[pts.length - 1][0]]);
      runs.forEach(q => { if (q.length > 1) out.push(PL(q, 's' + ci, dash)); });
      caps.forEach(([a, b]) => { const xa2 = X(a), xb2 = X(b), xm = (xa2 + xb2) / 2; if (xb2 - xa2 > 3) out.push(L(xa2, top + 3, xb2, top + 3, 'cap s' + ci)); out.push(PG([[xm, top - 1], [xm - 4, top + 7], [xm + 4, top + 7]], 'arw f' + ci)); }); });
    // labels of points (lifted clear of each other, on a leader when lifted)
    const placed = []; (row.labels || []).slice().sort((a, b) => b.x - a.x).forEach(q => { if (!fin(q.y)) return; const x = X(q.x) + 3, w = tw(q.text, 10.5), y = Y(Math.min(q.y, cap)) - 7; let yb2 = y;
      for (let k = 0; k < 30; k++) { yb2 = y - k * 12; const bx = [x, yb2 - 10, x + w, yb2 + 2]; if (!placed.some(b => bx[2] + 2 > b[0] && bx[0] < b[2] + 2 && bx[3] > b[1] && bx[1] < b[3])) { placed.push(bx); break; } }
      if (yb2 < y - 1) out.push(L(x - 3, y + 2, x - 3, yb2 + 1, 'ld')); out.push(T(x, yb2, esc(q.text), 'xs halo')); });
    (row.rings || []).forEach(q => { if (fin(q.y)) out.push(C(X(q.x), Y(Math.max(yr[0], Math.min(q.y, cap))), 8, 'ring-sel')); });
    (row.gov || []).forEach(q => { if (!fin(q.y)) return; const x = X(q.x), yy = Y(Math.max(yr[0], Math.min(q.y, cap))); out.push(C(x, yy, 7, 'ring-gov')); });
    if (row.govLabels && row.govLabels.length) { const its = row.govLabels.map(q => ({ ...q, lx: X(q.x), w: tw(q.text, 11) + 4 })); const n = placeFlags(its, c.xmax);
      its.forEach(it => { const yb2 = top - 8 - it.row * 15 - names; out.push(L(it.lx, Y(Math.max(yr[0], Math.min(it.y, cap))) - 8, it.lx, yb2 + 3, 'ld'), T(it.flip ? it.lx - 3 : it.lx + 3, yb2, sub(it.text), 't-gov halo', it.flip ? 'end' : null, ' font-size="11"')); });
      void n; }
    (row.regs || []).forEach(q => reg(c, q, X(q.x0), fin(q.y1v) ? Math.max(top, Y(Math.min(q.y1v, cap)) - 8) : top, X(q.x1), fin(q.y0v) ? Math.min(bot, Y(q.y0v) + 8) : bot));   // y0v / y1v: the value range of the area (else the plot height)
    return { h: h + 8 + names, top, bot, yv: py => yr[0] + (bot - py) / h * (yr[1] - yr[0]) };
  };
  /* a chart with flags above it: the flags need room above the plot, so they are measured first and the plot is moved down by their rows */
  const chart0 = KIND.chart; KIND.chart = (row, c, y0) => {
    if (!row.govLabels || !row.govLabels.length) return chart0(row, c, y0);
    const its = row.govLabels.map(q => ({ lx: c.X(q.x), w: tw(q.text, 11) + 4 })), n = placeFlags(its, c.xmax), dy = n * 15 + 4, q = chart0(row, c, y0 + dy);
    return { ...q, h: q.h + dy };
  };

  /* lines of text under the rows (the checks that have no location) */
  KIND.text = (row, c, y0) => { const ls = (row.lines || []).flatMap(t => wrapPx(t, c.W - c.left - c.right, 10.5)); ls.forEach((t, i) => c.out.push(T(c.left, y0 + 12 + i * 14, sub(t), 'xs'))); return { h: ls.length * 14 + 4 }; };

  /* ---------- category bars (horizontal): one row per item, the panels side by side when there is room ---------- */
  function hbars(sp, W) {
    W = Math.max(280, Math.round(W || 900)); const nar = W < 640, ps = sp.panels.filter(p => p.items.length), cols = nar || ps.length < 2 ? 1 : 2, gapX = 28, pw = (W - (cols - 1) * gapX) / cols, out = [], regs = [];
    let yMax = 0;
    ps.forEach((p, k) => { const ox = (k % cols) * (pw + gapX), oy = cols === 1 ? yMax : 0, lw = Math.min(nar ? 92 : 120, Math.max(...p.items.map(it => Math.max(tw(it.id, 12), tw(it.key || '', 10.5)))) + 10);
      const x0 = ox + lw, x1 = ox + pw - 44, nb = Math.max(...p.items.map(it => it.bars.length)), rowH = nb > 1 ? 34 : 24, top = oy + 24;
      const vmax = Math.max(...p.items.flatMap(it => it.bars.map(b => (fin(b.v) ? b.v : 0))), p.limit ? p.limit.v : 0, 1e-9), st = niceStep(vmax, nar ? 3 : 4), hi = Math.ceil(vmax / st - 1e-9) * st, Xv = v => x0 + Math.max(0, Math.min(v, hi)) / hi * (x1 - x0);
      out.push(T(ox, oy + 12, sub(p.label), 'm b'));
      const bot = top + p.items.length * rowH;
      for (let t = 0; t <= hi + 1e-9; t += st) out.push(L(Xv(t), top - 2, Xv(t), bot, 'gr'), T(Xv(t), bot + 13, (p.fx || (v => fmtT(v, st)))(t), 'xs', 'middle'));
      out.push(L(x0, top - 2, x0, bot, 'ax'));
      if (p.unit) out.push(T(x1, bot + 26, esc(p.unit), 'xs', 'end'));
      p.items.forEach((it, i) => { const yy = top + i * rowH, bh = nb > 1 ? 11 : 14;
        out.push(T(x0 - 6, yy + (it.key ? 11 : rowH / 2 + 4), esc(it.id), '', 'end')); if (it.key) out.push(T(x0 - 6, yy + 24, esc(it.key), 'xs', 'end'));
        it.bars.forEach((b, j) => { const by = yy + 4 + j * (bh + 2), w = fin(b.v) ? Xv(b.v) - x0 : 0, cls = b.cls ? 'c-' + b.cls : 'bar' + (b.ci || 0);
          out.push(R(x0, by, w, bh, cls)); if (b.text) out.push(T(x0 + w + 4, by + bh - 2, esc(b.text), b.cls ? 't-' + b.cls + ' b' : 'xs', null, ' font-size="10.5"')); });
        regs.push({ x0: ox, y0: yy, x1: ox + pw, y1: yy + rowH, lab: it.lab, pri: 1 }); });
      if (p.limit) { const xl = Xv(p.limit.v); out.push(L(xl, top - 6, xl, bot + 2, 'lim'), T(xl + 3, top - 8, esc(p.limit.label), 'xs')); }
      if (cols === 1) yMax = bot + 40; else yMax = Math.max(yMax, bot + 34); });
    const H = Math.ceil(yMax + 4);
    return { svg: `<svg xmlns="http://www.w3.org/2000/svg" class="va" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(sp.aria || 'Bars')}">${hatchDefs}${out.join('')}</svg>`, regs, rows: [], W, H, top: 0, axisY: H, bars: true };
  }

  function staticSvg(sp, W) { return render(sp, W || 760, { static: true }).svg; }

  /* ---------- legends ---------- */
  function legend(kind) {
    if (kind === 'ratio') return `<span><i class="va-sw c-ok"></i>below 0.90</span><span><i class="va-sw c-hi"></i>0.90 to 1.00</span><span><i class="va-sw c-ng"></i>above 1.00 or NG</span>`;
    if (kind === 'marks') return `<span><i class="va-dot r-gov"></i>governing</span><span><i class="va-dot r-sel"></i>selected</span>`;
    return '';
  }
  const swatch = (ci, dash) => `<svg class="va va-mini" viewBox="0 0 24 8" aria-hidden="true"><line x1="1" y1="4" x2="23" y2="4" class="s${ci}"${dash ? ` stroke-dasharray="${dash}"` : ''}/></svg>`;

  /* ---------- the card: fitted figure, read-out, click, chips, print ---------- */
  function mount(slot, o) {
    css(); const vk = VK();
    const groups = o.chips ? o.chips() : [];   // [{ label, items: [{ key, html, on }] }]
    slot.innerHTML = `<div class="vk va-card" data-va="${esc(o.key || '')}"><div class="vk-hd"><h3>${o.title}${o.sub ? `<small>${o.sub}</small>` : ''}</h3>${o.dxf ? '<button type="button" data-vadxf title="The CAD line drawing of this graphic">Download DXF</button>' : ''}</div>`
      + (o.controls ? `<div class="va-ctl">${o.controls}</div>` : '') + `<div class="vk-fig"></div><p class="vk-read" aria-live="polite" data-hint="${esc(o.hint || 'Point at (or tap) the graphic to read the values.')}"></p>`
      + (vk ? groups.filter(q => q.items.length).map(q => vk.chips({ label: q.label || 'Show', items: q.items })).join('') : '') + (o.legend ? `<div class="va-leg">${o.legend}</div>` : '') + (o.caption || '') + (o.notes || '')
      + (o.dxf ? `<p class="vk-note">${esc(DXF_NOTE)}</p>` : '') + '</div>';
    const root = slot.querySelector('.va-card'), fig = root.querySelector('.vk-fig'), out = root.querySelector('.vk-read'); let cur = null, lastW = 0;
    const draw = w => { const W = w > 0 ? w : 900; lastW = W; cur = o.draw(W); fig.innerHTML = cur.svg; root.classList.toggle('vk-narrow', W < 600); wireSvg(fig.querySelector('svg'), cur, o, out); };
    if (vk) { vk.fit(fig, draw); vk.print(fig, () => { if (fig.clientWidth < 760) draw(760); }, () => draw(fig.clientWidth)); vk.wire(root, { chip: k => { if (o.onChip) { o.onChip(k); mount(slot, o); } } }); }
    else draw(fig.clientWidth || 900);
    const b = root.querySelector('[data-vadxf]'); if (b) b.addEventListener('click', () => { try { const g = o.dxf(); GR().download(g, o.file || g.file || 'graphic'); } catch (e) { alert('The DXF could not be made: ' + e.message); } });
    return { el: root, fig, redraw: () => draw(fig.clientWidth || lastW), get R() { return cur; } };
  }
  function wireSvg(svg, Rr, o, out) {
    if (!svg || typeof document === 'undefined') return; const ns = 'http://www.w3.org/2000/svg', g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'va-hov'); g.style.display = 'none';
    g.innerHTML = `<line class="hl"/><rect class="tip" rx="4" height="34" width="10"/><text class="t1"></text><text class="t2"></text>`; svg.appendChild(g);
    const ln = g.querySelector('line'), rc = g.querySelector('rect'), t1 = g.querySelector('.t1'), t2 = g.querySelector('.t2'), sp = o.spec || {};
    const pt = ev => { const m = svg.getScreenCTM(); if (!m) return null; const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; return p.matrixTransform(m.inverse()); };
    const hit = q => { let best = null; (Rr.regs || []).forEach(r => { if (q.x >= r.x0 && q.x <= r.x1 && q.y >= r.y0 && q.y <= r.y1) { const a = (r.x1 - r.x0) * (r.y1 - r.y0); if (!best || r.pri < best.pri || (r.pri === best.pri && a < best.a)) best = { ...r, a }; } }); return best; };
    const info = q => { const r = hit(q); if (Rr.bars) return r ? { r, lines: [].concat(r.lab || []) } : null;
      if (q.x < Rr.left - 4 || q.x > Rr.W - Rr.right + 4 || q.y < Rr.top - 20 || q.y > Rr.axisY + 4) return null;
      const x = Math.max(Rr.L0, Math.min(Rr.L1, Rr.FT(q.x))), row = (Rr.rows || []).find(w => q.y >= w.y0 - 4 && q.y <= w.y1 + 4);
      const sx = o.snap ? o.snap(x) : x, lines = r && r.lab ? [].concat(r.lab) : o.at ? o.at(x, row && row.key, row && row.yv ? row.yv(q.y) : null) : null;
      return lines ? { r, x: sx, lines } : null; };
    const hide = () => { g.style.display = 'none'; if (out) out.textContent = ''; };
    const show = ev => { const q = pt(ev); if (!q) return null; const f = info(q); if (!f) { hide(); return null; } g.style.display = '';
      if (!Rr.bars) { const xx = Rr.X(f.x); ln.setAttribute('x1', r2(xx)); ln.setAttribute('x2', r2(xx)); ln.setAttribute('y1', r2(Rr.top - 2)); ln.setAttribute('y2', r2(Rr.axisY)); } else ln.setAttribute('x2', '0');
      t1.innerHTML = sub(plain(f.lines[0] || '')); t2.innerHTML = sub(plain(f.lines[1] || ''));
      const w = Math.max(t1.getComputedTextLength ? t1.getComputedTextLength() : 100, t2.getComputedTextLength ? t2.getComputedTextLength() : 100) + 16, hh = f.lines[1] ? 34 : 20;
      const tx = Math.max(2, Math.min(Rr.W - w - 2, q.x + 12)), ty = q.y - hh - 8 < 2 ? q.y + 10 : q.y - hh - 8;
      rc.setAttribute('x', r2(tx)); rc.setAttribute('y', r2(ty)); rc.setAttribute('width', r2(w)); rc.setAttribute('height', hh); t1.setAttribute('x', r2(tx + 8)); t1.setAttribute('y', r2(ty + 14)); t2.setAttribute('x', r2(tx + 8)); t2.setAttribute('y', r2(ty + 28));
      if (out) { const t = f.lines.filter(Boolean).join(' · '); if (window.SBDSub) out.innerHTML = window.SBDSub.html(t); else out.textContent = t; } return f; };
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons) show(e); });
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('click', e => { const f = show(e); if (!o.onSelect) return; const q = pt(e); if (!q) return; const r = hit(q);
      if (r && r.v != null) o.onSelect(r.v); else if (!Rr.bars && o.pickX && f) { const v = o.pickX(Math.max(Rr.L0, Math.min(Rr.L1, Rr.FT(q.x)))); if (v != null) o.onSelect(v); } });
  }

  window.SBDVizAlong = { render, hbars, staticSvg, mount, legend, swatch, sub, esc, css, placeFlags, SER, PDASH, DXF_NOTE, SVGCSS };
})();
