/* apps/steel-bridge/ui/vizkit.js — window.SBDVizKit: the pieces of the "modern data-viz" graphic style (engineer's decision 2026-11-10, mockup option C
   of the Section properties graphic), kept here so that other tab graphics can be moved to the same style later. Classic script, display only:
   nothing here computes an engineering value; a graphic hands in the numbers its tab already has. No storage. First user: ui/gfxa.js section().

   API (all HTML / SVG is returned as strings unless stated; class names start with vk-)
     VK.css()                         adds the style sheet once (palette, controls, tiles, SVG classes, print grey + hatch, forced colours)
     VK.PAL                           the palette { steel, steelLine, deck, deckLine, rebar, comp, tens, compText, tensText, navy, accent, ink, muted, faint, line }
     VK.fx(v, d)                      v with d decimals, thousands grouped ('—' when not finite);  VK.sgn(v, d): '+1.23' / '−1.23' (U+2212; toFixed digits), 0 unsigned
     VK.esc(s)                        HTML escape;  VK.sub(base, s): SVG text with a subscript (tspans)
     VK.seg({ label, items: [[key, html]], cur })          segmented control: real buttons (data-vkseg, aria-pressed), in a role=group
     VK.chips({ label, items: [{ key, html, on, fixed, title }] })   toggle chips: buttons (data-vkchip, aria-pressed; fixed = pressed and disabled)
     VK.tiles([{ label (html), value, unit, tone: 'c' | 't' | '', link (html) }])   the stat tiles (6 across, 3 at narrow widths)
     VK.wire(root, { seg(key), chip(key) })                 clicks of the segmented control and chips inside root (bound once per root)
     VK.T(x, y, html, { a, cls, sz, w }), VK.L(x1, y1, x2, y2, cls, extra), VK.PG(points, cls, extra), VK.PL(points, cls, extra)   SVG primitives
     VK.defs(id)                      the hatch patterns (#<id>-ht print hatch, #<id>-htc screen hatch) as a <defs> string
     VK.grad(id, y0, y1, frac)        a vertical gradient (user space y0 top .. y1 bottom), compression colour above frac, tension below, faint at frac
     VK.stack(items, gap, ymax)       items [{ py }] sorted, each given ty >= its py and >= gap below the previous one (and <= ymax, pushing up)
     VK.niceStep(span, n)             1 / 2 / 5 x 10^k step for about n divisions
     VK.ruler({ x, Y, y0, y1, step, title, titleDy, ticks: [{ y, label, title, sel }], labels, labelDx })   a y ruler (scale on the left of x) with marker ticks
     VK.diagram({ segs: [{ ya, yb, fa, fb }], x0, kx, Y, yMin, yMax, grad, badges, fmt, xmin, xmax, gap })   a value diagram along y: area of each
                                      segment split at zero, gradient fill on screen, grey compression / hatched tension in print, profile line,
                                      zero line and value badges (badges: true) stacked apart per side
     VK.readout(svg, { at(y user units of the SVG) -> null | [line1, line2], x0, x1, out (element for the text, aria-live) })
                                      hover (mouse) and tap (touch, pen, click) read-out: a dashed line and a tip in the SVG, and the same text in out
     VK.fit(el, render)               calls render(width) now and again whenever el's width changes (window resize, 'sbd2:panelresize' of
                                      the splitter); stops by itself when el leaves the page
     VK.print(el, before, after)      before() on beforeprint and after() on afterprint while el is on the page
     VK.DXF_NOTE                      the note that Download DXF is the CAD line drawing (the shaded graphic is screen and print only)
   The palette, the print mode and the forced-colours rules apply inside an element of class vk (the card body of the graphic). Classes set on it
   by the graphic from its own width: vk-narrow (phone layout: tiles 3 across, segmented control full width), vk-t3 (tiles 3 across).
   Fix log: fixlog/steel-bridge.md (SECC, 2026-11-10). */
(function () {
  'use strict';
  const fin = v => typeof v === 'number' && isFinite(v);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fx = (v, d) => (fin(+v) && v !== null && v !== '' ? (+v).toLocaleString('en-US', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : '—');
  const sgn = (v, d) => { if (!fin(v)) return '—'; const s = Math.abs(v).toFixed(d == null ? 2 : d); return /^[0.]+$/.test(s) ? s : (v > 0 ? '+' : '−') + s; };   // toFixed: the digits of the tabs' own fmt
  const sub = (b, s) => `${b}<tspan dy="3" font-size="0.78em">${s}</tspan><tspan dy="-3"> </tspan>`;
  const PAL = { steel: '#64748B', steelLine: '#475569', deck: '#ECE7DC', deckLine: '#C9C0AD', rebar: '#8A5A44', comp: '#2563EB', tens: '#DC6B2F', compText: '#1D4ED8', tensText: '#B4541F',
    navy: '#1E3A5F', accent: '#2563EB', ink: '#0F172A', muted: '#475569', faint: '#94A3B8', line: '#E4E7EB' };
  const DXF_NOTE = 'Download DXF gives the CAD line drawing of this section (layers, dimensions, neutral axes and the stress diagram of the selected case); the shaded graphic above is for the screen and the printout only.';

  function css() {
    if (typeof document === 'undefined' || document.getElementById('vk-css')) return;
    const P = PAL, st = document.createElement('style'); st.id = 'vk-css';
    st.textContent = `.vk{--vk-steel:${P.steel};--vk-steel-l:${P.steelLine};--vk-deck:${P.deck};--vk-deck-l:${P.deckLine};--vk-rebar:${P.rebar};--vk-c:${P.comp};--vk-t:${P.tens};--vk-ct:${P.compText};--vk-tt:${P.tensText};
  --vk-navy:${P.navy};--vk-acc:${P.accent};--vk-ink:${P.ink};--vk-mut:${P.muted};--vk-faint:${P.faint};--vk-line:${P.line};color-scheme:only light;background:#fff;color:var(--vk-ink);font-family:var(--font-ui,Arial,sans-serif);font-size:9.5pt;}
.vk-hd{display:flex;flex-wrap:wrap;align-items:flex-start;gap:6px 12px;margin:0 0 8px;} .vk-hd h3{flex:1 1 240px;margin:0;font-size:10.5pt;font-weight:600;color:var(--vk-ink);} .vk-hd h3 small{display:block;font-weight:400;color:var(--vk-mut);font-size:9pt;margin-top:1px;}
.vk-hd button{font:inherit;font-size:9pt;padding:4px 10px;border:1px solid #CBD5E1;border-radius:4px;background:#fff;color:var(--vk-ink);cursor:pointer;}
.vk-seg{display:inline-flex;flex-wrap:wrap;border:1px solid #CBD5E1;border-radius:6px;overflow:hidden;margin:0 0 10px;max-width:100%;}
.vk-seg button{font:inherit;font-size:9pt;padding:5px 10px;border:0;border-right:1px solid #CBD5E1;background:#fff;color:var(--vk-mut);cursor:pointer;} .vk-seg button:last-child{border-right:0;}
.vk-seg button[aria-pressed=true]{background:var(--vk-navy);color:#fff;} .vk-seg button:focus-visible,.vk-chips button:focus-visible{outline:2px solid var(--vk-acc);outline-offset:-2px;}
.vk-tiles{display:grid;grid-template-columns:repeat(6,minmax(0,1fr));gap:8px;margin:0 0 10px;}
.vk-tile{border:1px solid var(--vk-line);border-radius:6px;padding:6px 8px;background:#FAFBFC;min-width:0;} .vk-tile span{display:block;font-size:8.5pt;color:var(--vk-mut);}
.vk-tile b{font-size:11.5pt;font-variant-numeric:tabular-nums;font-weight:600;white-space:nowrap;} .vk-tile i{font-style:normal;font-size:8.5pt;color:var(--vk-mut);margin-left:3px;} .vk-tile a.wk{margin-left:4px;}
.vk-tile.c b{color:var(--vk-ct);} .vk-tile.t b{color:var(--vk-tt);}
.vk-fig{width:100%;position:relative;} .vk-fig svg{display:block;width:100%;height:auto;touch-action:pan-x pan-y;font-family:var(--font-ui,Arial,sans-serif);}
.vk-read{min-height:1.3em;font-size:9pt;color:var(--vk-ink);margin:2px 0 0;font-variant-numeric:tabular-nums;} .vk-read:empty::before{content:attr(data-hint);color:var(--vk-mut);}
.vk-chips{display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0 0;font-size:9pt;} .vk-chips .vk-cl{color:var(--vk-mut);}
.vk-chips button{font:inherit;font-size:9pt;border:1px solid #CBD5E1;border-radius:999px;padding:3px 10px;background:#fff;cursor:pointer;color:var(--vk-ink);} .vk-chips button small{color:var(--vk-mut);}
.vk-chips button[aria-pressed=true]{background:#EEF4FF;border-color:var(--vk-acc);} .vk-chips button:disabled{background:var(--vk-acc);color:#fff;border-color:var(--vk-acc);cursor:default;} .vk-chips button:disabled small{color:#DBEAFE;}
.vk-cap{font-size:9pt;color:var(--vk-mut);margin:8px 0 0;} .vk-cap.vk-pr{display:none;} .vk-note{font-size:8.5pt;color:#556;margin:4px 0 0;}
.vk svg text{fill:var(--vk-ink);font-size:12px;} .vk svg text.m{fill:var(--vk-mut);} .vk svg text.xs{font-size:10px;fill:var(--vk-mut);} .vk svg text.halo{paint-order:stroke;stroke:#fff;stroke-width:3px;stroke-linejoin:round;}
.vk svg .stl{fill:var(--vk-steel);stroke:none;} .vk svg .dk{fill:var(--vk-deck);stroke:var(--vk-deck-l);stroke-width:.8;} .vk svg .hn{fill:var(--vk-deck);stroke:var(--vk-deck-l);stroke-width:.8;} .vk svg .rb{fill:var(--vk-rebar);stroke:none;}
.vk svg .ext{stroke:var(--vk-faint);stroke-width:.6;} .vk svg .ax0{stroke:var(--vk-ink);stroke-width:1;}
.vk svg .nat{fill:#CBD5E1;} .vk svg .nat.sel{fill:var(--vk-acc);} .vk svg text.selt{fill:var(--vk-acc);font-weight:600;}
.vk svg .nasel{stroke:var(--vk-acc);stroke-width:1.6;} .vk svg .naoth{stroke:#64748B;stroke-width:1;} .vk svg .pill{fill:var(--vk-acc);} .vk svg text.pillt{fill:#fff;font-weight:600;font-size:11px;}
.vk svg .pc,.vk svg .pt{fill:none;} .vk svg .gprof{stroke:#334155;stroke-width:1.6;fill:none;}
.vk svg .bc{fill:#EFF4FF;stroke:#BFD3FB;} .vk svg .bt{fill:#FDF1EA;stroke:#F2C7AE;} .vk svg text.vc,.vk svg text.cc{fill:var(--vk-ct);} .vk svg text.vt,.vk svg text.tt{fill:var(--vk-tt);} .vk svg text.vc,.vk svg text.vt{font-size:11px;font-weight:600;}
.vk svg .hl{stroke:var(--vk-ink);stroke-width:.6;stroke-dasharray:3 3;} .vk svg .tip{fill:var(--vk-ink);opacity:.88;} .vk svg .vk-hov text{fill:#fff;font-size:11px;} .vk svg .vk-hov{pointer-events:none;}
@media (max-width:760px){.vk-tiles{grid-template-columns:repeat(3,minmax(0,1fr));} .vk-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;} .vk-seg button{padding:5px 4px;line-height:1.25;}}
.vk.vk-narrow .vk-tiles,.vk.vk-t3 .vk-tiles{grid-template-columns:repeat(3,minmax(0,1fr));} .vk.vk-narrow .vk-tile b{font-size:10.5pt;white-space:normal;} .vk.vk-narrow .vk-seg{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));width:100%;} .vk.vk-narrow .vk-seg button{padding:5px 4px;line-height:1.25;}
@media print{.vk{--vk-steel:#9A9A9A;--vk-deck:#fff;--vk-deck-l:#000;--vk-rebar:#000;--vk-c:#000;--vk-t:#000;--vk-ct:#000;--vk-tt:#000;--vk-acc:#000;--vk-ink:#000;--vk-mut:#333;--vk-faint:#666;}
  .vk .vk-seg,.vk .vk-chips,.vk .vk-read,.vk .vk-hd button,.vk .vk-noprint{display:none!important;} .vk .vk-cap.vk-pr{display:block;} .vk-tile{background:#fff;border-color:#999;} .vk-tile a.wk{display:none;}
  .vk svg .pc{fill:#D4D4D4;} .vk svg .pt{fill:url(#vk-ht);} .vk svg .vk-gf{fill:none!important;} .vk svg .nat{fill:#777;} .vk svg .bc,.vk svg .bt{fill:#fff;stroke:#000;} .vk svg .stl{stroke:#000;stroke-width:.6;} .vk svg .vk-hov{display:none;}
  .vk{break-inside:avoid;}}
@media (forced-colors:active){.vk svg text,.vk svg text.xs,.vk svg text.m{fill:CanvasText;} .vk svg text.pillt{fill:Canvas;} .vk svg .pill,.vk svg .nat.sel{fill:Highlight;} .vk svg .stl{fill:GrayText;} .vk svg .dk,.vk svg .hn,.vk svg .bc,.vk svg .bt{fill:Canvas;stroke:CanvasText;}
  .vk svg .gprof,.vk svg .ax0,.vk svg .nasel,.vk svg .naoth,.vk svg .ext{stroke:CanvasText;} .vk-tile{border-color:CanvasText;} .vk-seg button[aria-pressed=true],.vk-chips button[aria-pressed=true]{outline:2px solid Highlight;}}`;
    document.head.appendChild(st);
  }

  /* ---------- HTML controls ---------- */
  const seg = o => `<div class="vk-seg" role="group" aria-label="${esc(o.label || 'Show')}">${o.items.map(([k, h]) => `<button type="button" data-vkseg="${esc(k)}" aria-pressed="${k === o.cur}">${h}</button>`).join('')}</div>`;
  const chips = o => `<div class="vk-chips" role="group" aria-label="${esc(o.label || 'Also show')}"><span class="vk-cl">${esc(o.label || 'Also show')}</span>${o.items.map(q => `<button type="button" data-vkchip="${esc(q.key)}" aria-pressed="${!!(q.on || q.fixed)}"${q.fixed ? ' disabled' : ''}${q.title ? ` title="${esc(q.title)}"` : ''}>${q.html}</button>`).join('')}</div>`;
  const tiles = list => `<div class="vk-tiles">${list.map(t => `<div class="vk-tile${t.tone ? ' ' + t.tone : ''}"><span>${t.label}</span><b>${t.value}</b><i>${t.unit || ''}</i>${t.link || ''}</div>`).join('')}</div>`;
  function wire(root, h) {
    root.__vkH = h; if (root.__vkW) return; root.__vkW = true;
    root.addEventListener('click', e => { const t = e.target && e.target.closest ? e.target.closest('[data-vkseg],[data-vkchip]') : null; if (!t || !root.contains(t) || t.disabled) return; const H = root.__vkH || {};
      if (t.dataset.vkseg != null && H.seg) H.seg(t.dataset.vkseg); else if (t.dataset.vkchip != null && H.chip) H.chip(t.dataset.vkchip); });
  }

  /* ---------- SVG primitives ---------- */
  const r2 = v => +(+v).toFixed(2);
  const T = (x, y, s, o) => { o = o || {}; return `<text x="${r2(x)}" y="${r2(y)}"${o.a ? ` text-anchor="${o.a}"` : ''}${o.cls ? ` class="${o.cls}"` : ''}${o.sz ? ` font-size="${o.sz}"` : ''}${o.w ? ` font-weight="${o.w}"` : ''}>${s}</text>`; };
  const L = (x1, y1, x2, y2, cls, extra) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" class="${cls}"${extra || ''}/>`;
  const pts = p => p.map(q => q.map(r2).join(',')).join(' ');
  const PG = (p, cls, extra) => `<polygon points="${pts(p)}" class="${cls}"${extra || ''}/>`;
  const PL = (p, cls, extra) => `<polyline points="${pts(p)}" class="${cls}" fill="none"${extra || ''}/>`;
  /* the print hatch (black lines on white) as #vk-ht; ids are page-wide, so one pattern serves every graphic (same content each time) */
  const defs = () => `<defs><pattern id="vk-ht" patternUnits="userSpaceOnUse" width="5" height="5" patternTransform="rotate(45)"><rect width="5" height="5" fill="#fff"/><line x1="0" y1="0" x2="0" y2="5" stroke="#000" stroke-width="1"/></pattern></defs>`;
  const grad = (id, y0, y1, f) => { const q = Math.max(0, Math.min(1, f)).toFixed(4);
    return `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${r2(y0)}" x2="0" y2="${r2(y1)}"><stop offset="0" stop-color="var(--vk-c)" stop-opacity=".85"/><stop offset="${q}" stop-color="var(--vk-c)" stop-opacity=".08"/>`
      + `<stop offset="${q}" stop-color="var(--vk-t)" stop-opacity=".08"/><stop offset="1" stop-color="var(--vk-t)" stop-opacity=".85"/></linearGradient></defs>`; };
  function stack(items, gap, ymax) {
    items.sort((a, b) => a.py - b.py); let prev = -1e9; items.forEach(q => { q.ty = Math.max(q.py, prev + gap); prev = q.ty; });
    if (ymax != null) { let nx = 1e9; for (let i = items.length - 1; i >= 0; i--) { items[i].ty = Math.min(items[i].ty, ymax, nx - gap); nx = items[i].ty; } }
    return items;
  }
  function niceStep(span, n) { const raw = Math.abs(span) / Math.max(1, n || 6), m = Math.pow(10, Math.floor(Math.log10(raw || 1))), f = raw / m; return (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * m; }

  /* a y ruler at x (line), its scale numbers on the left, each tick a small marker; o.labels: the tick labels stacked left of the scale */
  function ruler(o) {
    const Y = o.Y, x = o.x, out = [L(x, Y(o.y0), x, Y(o.y1), 'ext')], st = o.step || niceStep(o.y1 - o.y0, 7);
    for (let y = Math.ceil(o.y0 / st - 1e-9) * st; y <= o.y1 + 1e-9; y += st) out.push(L(x - 4, Y(y), x, Y(y), 'ext'), T(x - 6, Y(y) + 3.5, fx(y, st < 1 ? 1 : 0), { a: 'end', cls: 'xs' }));
    if (o.title) out.push(T(x, Y(o.y1) - (o.titleDy || 24), o.title, { a: 'middle', cls: 'xs' }));
    const tk = (o.ticks || []).filter(q => fin(q.y));
    tk.forEach(q => out.push(`<path d="M${r2(x + 1)} ${r2(Y(q.y))} l7 -4 v8 z" class="nat${q.sel ? ' sel' : ''}"><title>${esc(q.title || q.label || '')}</title></path>`));
    if (o.labels) stack(tk.map(q => ({ py: Y(q.y) + 3.5, q })), 12).forEach(s => out.push(T(x - (o.labelDx || 26), s.ty, esc(s.q.label), { a: 'end', cls: 'xs' + (s.q.sel ? ' selt' : '') })));
    return out.join('');
  }

  /* a value diagram along y (stress through a depth): each segment's area split at zero; gradient fill (screen) and grey / hatch (print) */
  function diagram(o) {
    const Y = o.Y, x0 = o.x0, kx = o.kx, fmt = o.fmt || (v => sgn(v, 2)), out = [], pieces = [];
    o.segs.forEach(s => { if (s.fa * s.fb < 0) { const y0 = s.ya + (s.yb - s.ya) * (-s.fa) / (s.fb - s.fa); pieces.push([s.ya, y0, s.fa, 0], [y0, s.yb, 0, s.fb]); } else pieces.push([s.ya, s.yb, s.fa, s.fb]); });
    pieces.forEach(([ya, yb, fa, fb]) => { const p = [[x0, Y(ya)], [x0 + fa * kx, Y(ya)], [x0 + fb * kx, Y(yb)], [x0, Y(yb)]]; if (o.grad) out.push(PG(p, 'vk-gf', ` style="fill:url(#${o.grad})"`)); out.push(PG(p, fa + fb >= 0 ? 'pc' : 'pt')); });
    o.segs.forEach(s => out.push(PL([[x0 + s.fa * kx, Y(s.ya)], [x0 + s.fb * kx, Y(s.yb)]], 'gprof')));
    if (o.zero !== false) out.push(L(x0, Y(o.yMin) + 4, x0, Y(o.yMax) - 4, 'ax0'));
    if (o.badges) { const v = []; o.segs.forEach(s => [[s.ya, s.fa], [s.yb, s.fb]].forEach(([y, f]) => v.push({ py: Y(y) + 4, f, x: x0 + f * kx + (f >= 0 ? 8 : -8), side: f >= 0 })));
      [true, false].forEach(sd => stack(v.filter(q => q.side === sd), o.gap || 18).forEach(q => { const t = fmt(q.f), w = t.length * 6.4 + 10; let bx = q.side ? q.x : q.x - w;
        if (o.xmax != null) bx = Math.min(bx, o.xmax - w); if (o.xmin != null) bx = Math.max(bx, o.xmin);
        out.push(`<rect x="${r2(bx)}" y="${r2(q.ty - 12)}" width="${r2(w)}" height="16" rx="3" class="${q.side ? 'bc' : 'bt'}"/>`, T(bx + w / 2, q.ty, t, { a: 'middle', cls: q.side ? 'vc' : 'vt' })); })); }
    return out.join('');
  }

  /* hover (mouse) and tap (touch, pen; a click with the mouse too) read-out on an SVG whose viewBox is in px. o.at(y) -> null (outside) or [line1, line2] */
  function readout(svg, o) {
    const ns = 'http://www.w3.org/2000/svg', g = document.createElementNS(ns, 'g'); g.setAttribute('class', 'vk-hov'); g.style.display = 'none';
    g.innerHTML = `<line class="hl" x1="${r2(o.x0)}" x2="${r2(o.x1)}"/><rect class="tip" rx="4" height="34" width="10"/><text class="t1"></text><text class="t2"></text>`; svg.appendChild(g);
    const ln = g.querySelector('line'), rc = g.querySelector('rect'), t1 = g.querySelector('.t1'), t2 = g.querySelector('.t2'), vb = () => svg.viewBox.baseVal;
    const hide = () => { g.style.display = 'none'; if (o.out) o.out.textContent = ''; };
    const show = ev => { const m = svg.getScreenCTM(); if (!m) return; const p = svg.createSVGPoint(); p.x = ev.clientX; p.y = ev.clientY; const q = p.matrixTransform(m.inverse());
      const r = o.at(q.y); if (!r) { hide(); return; } g.style.display = ''; ln.setAttribute('y1', r2(q.y)); ln.setAttribute('y2', r2(q.y));
      t1.textContent = r[0]; t2.textContent = r[1] || ''; const w = Math.max(t1.getComputedTextLength ? t1.getComputedTextLength() : 100, t2.getComputedTextLength ? t2.getComputedTextLength() : 100) + 16;
      const W = vb().width, tx = Math.max(2, Math.min(W - w - 2, (o.tipX != null ? o.tipX : q.x + 10))), ty = q.y - 40 < 2 ? q.y + 6 : q.y - 40;
      rc.setAttribute('x', r2(tx)); rc.setAttribute('y', r2(ty)); rc.setAttribute('width', r2(w)); t1.setAttribute('x', r2(tx + 8)); t1.setAttribute('y', r2(ty + 14)); t2.setAttribute('x', r2(tx + 8)); t2.setAttribute('y', r2(ty + 28));
      if (o.out) o.out.textContent = r[0] + (r[1] ? ' · ' + r[1] : ''); };
    svg.addEventListener('pointermove', e => { if (e.pointerType === 'mouse' && !e.buttons) show(e); });
    svg.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') hide(); });
    svg.addEventListener('click', show);   // a tap (touch, pen) or a click: the same read-out, kept until the next tap
    return { hide };
  }

  /* ---------- width and print watchers (one set of window listeners for every graphic) ---------- */
  const FITS = [], PRINTS = []; let bound = false;
  function bind() {
    if (bound || typeof window === 'undefined') return; bound = true; let raf = 0;
    const run = () => { raf = 0; for (let i = FITS.length - 1; i >= 0; i--) { const f = FITS[i]; if (!f.el.isConnected) { FITS.splice(i, 1); continue; } const w = f.el.clientWidth; if (w > 0 && w !== f.w) { f.w = w; try { f.render(w); } catch (e) { /* the next resize retries */ } } } };
    const later = () => { if (!raf) raf = requestAnimationFrame(run); };
    window.addEventListener('resize', later); window.addEventListener('sbd2:panelresize', later);
    const pr = k => () => { for (let i = PRINTS.length - 1; i >= 0; i--) { const f = PRINTS[i]; if (!f.el.isConnected) { PRINTS.splice(i, 1); continue; } try { if (f[k]) f[k](); } catch (e) { /* print as shown */ } } };
    window.addEventListener('beforeprint', pr('before')); window.addEventListener('afterprint', pr('after'));
  }
  function fit(el, render) {
    bind(); for (let i = FITS.length - 1; i >= 0; i--) if (FITS[i].el === el || !FITS[i].el.isConnected) FITS.splice(i, 1);
    const f = { el, render, w: el.clientWidth }; FITS.push(f); render(f.w || 0); return f;
  }
  function print(el, before, after) { bind(); for (let i = PRINTS.length - 1; i >= 0; i--) if (PRINTS[i].el === el || !PRINTS[i].el.isConnected) PRINTS.splice(i, 1); PRINTS.push({ el, before, after }); }

  window.SBDVizKit = { css, PAL, fx, sgn, esc, sub, seg, chips, tiles, wire, T, L, PG, PL, defs, grad, stack, niceStep, ruler, diagram, readout, fit, print, DXF_NOTE };
})();
