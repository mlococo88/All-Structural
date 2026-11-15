/* apps/ps-bridge/ui/svgdxf.js — window.PSBGraphics: "Download DXF" of the result tabs' graphics (2026-11-15, batch B; the steel app's
   Download DXF on each result-tab graphic). Classic script, display and export only: nothing here computes an engineering value.
   The steel app builds a CAD drawing for each graphic by hand (apps/steel-bridge/ui/graphics.js); this app writes the graphic as drawn: every
   line, polyline, polygon, rectangle, circle, path and text of the graphic's SVG (the figure on screen, the same numbers and labels) becomes a
   DXF R12 entity through shared/dxf.js (SharedDxf.drawing, loaded unchanged). Units: the graphic's own units (screen px, y up), not a
   drawing scale; the Drawings tab has the scaled CAD sheets. Layers by the kind of entity and the SVG class of the element (PSB-<CLASS>).
   Skipped: <defs>, clip paths, masks, patterns, markers, title / desc, the hover read-out groups (vk-hov, va-hov) and hidden elements.

   API
     PSBGraphics.fromSvg(svg, o) -> { D, file, title }   svg: an <svg> element on the page (or a container: its first svg); o = { title, file }
     PSBGraphics.fromFig(fig, o) -> the graphic of every <svg> in fig (side by side, as drawn)
     PSBGraphics.download(g, name)  validates (SharedDxf.validate) and saves <name>.dxf (as the steel app's SBDGraphics.download)
     PSBGraphics.NOTE              the note shown under a graphic with Download DXF
   Does not define textW: the charts' text widths stay the estimate they use today (no layout change). */
(function () {
  'use strict';
  const X = () => window.SharedDxf;
  const NOTE = 'Download DXF gives this graphic as drawn (its lines, outlines and text, in the graphic\'s own units, not to a drawing scale; layers by element); the scaled CAD sheets are on the Drawings tab.';
  const SKIP = new Set(['defs', 'clippath', 'mask', 'pattern', 'marker', 'title', 'desc', 'style', 'script', 'lineargradient', 'radialgradient', 'filter', 'symbol']);
  const num = v => { const n = parseFloat(v); return isFinite(n) ? n : 0; };
  const lay = (D, el, kind) => { const c = String((el.getAttribute && el.getAttribute('class')) || '').trim().split(/\s+/)[0].replace(/[^A-Za-z0-9_-]/g, '').toUpperCase().slice(0, 24);
    return D.layer('PSB-' + kind + (c ? '-' + c : ''), kind === 'TEXT' ? 7 : kind === 'FILL' ? 8 : 7); };
  /* the element's matrix: its parent's times its own transform attribute (SVG transform list, consolidated by the browser) */
  function own(el) { const t = el.transform && el.transform.baseVal; if (!t || !t.numberOfItems) return null; const m = t.consolidate().matrix; return new DOMMatrix([m.a, m.b, m.c, m.d, m.e, m.f]); }
  /* path d -> polylines (absolute points); curves sampled (8 segments), arcs to their end point */
  function pathPolys(d) {
    const tk = String(d || '').match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) || [], out = []; let i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, cur = null, px = 0, py = 0;
    const n = () => num(tk[i++]), push = (a, b) => { cur.push([a, b]); x = a; y = b; };
    const start = (a, b) => { if (cur && cur.length > 1) out.push({ pts: cur, closed: false }); cur = [[a, b]]; x = sx = a; y = sy = b; };
    while (i < tk.length) {
      if (/[a-zA-Z]/.test(tk[i])) cmd = tk[i++];
      const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), ox = rel ? x : 0, oy = rel ? y : 0;
      if (C === 'M') { start(n() + ox, n() + oy); cmd = rel ? 'l' : 'L'; }
      else if (C === 'L') push(n() + ox, n() + oy);
      else if (C === 'H') push(n() + ox, y);
      else if (C === 'V') push(x, n() + oy);
      else if (C === 'Z') { if (cur) { cur.push([sx, sy]); out.push({ pts: cur, closed: true }); cur = null; } x = sx; y = sy; }
      else if (C === 'C' || C === 'S' || C === 'Q' || C === 'T') {
        const k = C === 'C' ? 6 : C === 'S' || C === 'Q' ? 4 : 2, v = []; for (let j = 0; j < k; j++) v.push(n() + (j % 2 ? oy : ox));
        const p0 = [x, y], pe = [v[k - 2], v[k - 1]], c1 = C === 'C' ? [v[0], v[1]] : C === 'S' ? [2 * x - px, 2 * y - py] : C === 'Q' ? [v[0], v[1]] : [2 * x - px, 2 * y - py], c2 = C === 'C' ? [v[2], v[3]] : C === 'S' ? [v[0], v[1]] : null;
        if (!cur) cur = [[x, y]];
        for (let s = 1; s <= 8; s++) { const t = s / 8, u = 1 - t;
          const q = c2 ? [u * u * u * p0[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * pe[0], u * u * u * p0[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * pe[1]]
            : [u * u * p0[0] + 2 * u * t * c1[0] + t * t * pe[0], u * u * p0[1] + 2 * u * t * c1[1] + t * t * pe[1]];
          cur.push(q); }
        px = c2 ? c2[0] : c1[0]; py = c2 ? c2[1] : c1[1]; x = pe[0]; y = pe[1]; continue;
      }
      else if (C === 'A') { n(); n(); n(); n(); n(); push(n() + ox, n() + oy); }
      else { i++; continue; }
      px = x; py = y;
    }
    if (cur && cur.length > 1) out.push({ pts: cur, closed: false });
    return out;
  }
  function walk(D, el, m, root) {
    const tag = String(el.tagName || '').toLowerCase(); if (!tag || SKIP.has(tag)) return;
    const cls = String((el.getAttribute && el.getAttribute('class')) || '');
    if (/(^|\s)(vk-hov|va-hov)(\s|$)/.test(cls) || el.getAttribute('display') === 'none' || (el.style && el.style.display === 'none') || el.getAttribute('visibility') === 'hidden') return;
    const o = own(el), M = o ? m.multiply(o) : m, P = (x, y) => { const q = M.transformPoint(new DOMPoint(x, y)); return [q.x, -q.y]; };
    const A = k => num(el.getAttribute(k)), fillOnly = () => { const s = el.getAttribute('stroke'); return s === 'none' && (el.getAttribute('fill') || '') !== 'none'; };
    if (tag === 'line') D.line(lay(D, el, 'LINE'), ...P(A('x1'), A('y1')), ...P(A('x2'), A('y2')));
    else if (tag === 'polyline' || tag === 'polygon') { const v = String(el.getAttribute('points') || '').trim().split(/[\s,]+/).map(num), pts = [];
      for (let j = 0; j + 1 < v.length; j += 2) pts.push(P(v[j], v[j + 1])); if (pts.length > 1) D.pline(lay(D, el, tag === 'polygon' && fillOnly() ? 'FILL' : 'LINE'), pts, tag === 'polygon'); }
    else if (tag === 'rect') { const x = A('x'), y = A('y'), w = A('width'), h = A('height'); if (w > 0 && h > 0) D.pline(lay(D, el, fillOnly() ? 'FILL' : 'LINE'), [P(x, y), P(x + w, y), P(x + w, y + h), P(x, y + h)], true); }
    else if (tag === 'circle' || tag === 'ellipse') { const c = P(A('cx'), A('cy')), r = (tag === 'circle' ? A('r') : (A('rx') + A('ry')) / 2) * Math.hypot(M.a, M.b); if (r > 0) D.circle(lay(D, el, 'LINE'), c[0], c[1], r); }
    else if (tag === 'path') pathPolys(el.getAttribute('d')).forEach(q => D.pline(lay(D, el, 'LINE'), q.pts.map(p => P(p[0], p[1])), q.closed));
    else if (tag === 'text') {
      const s = String(el.textContent || '').replace(/\s+/g, ' ').trim(); if (!s) return;
      const fs = parseFloat((el.style && el.style.fontSize) || el.getAttribute('font-size') || (typeof getComputedStyle === 'function' ? getComputedStyle(el).fontSize : '') || '11') || 11;
      const an = el.getAttribute('text-anchor') || (typeof getComputedStyle === 'function' ? getComputedStyle(el).textAnchor : '') || 'start', j = an === 'middle' ? 1 : an === 'end' ? 2 : 0;
      const p = P(A('x'), A('y')), rot = -Math.atan2(M.b, M.a) * 180 / Math.PI;
      D.text(lay(D, el, 'TEXT'), p[0], p[1], fs * 0.8 * Math.hypot(M.a, M.b), s, j, Math.abs(rot) < 1e-6 ? 0 : rot);
      return;
    }
    if (tag === 'svg' && el !== root) { const vb = el.viewBox && el.viewBox.baseVal; const t = new DOMMatrix([1, 0, 0, 1, A('x'), A('y')]); walk2(D, el, M.multiply(t), root); return; }   // a nested svg: at its x, y (no viewBox scaling)
    walk2(D, el, M, root);
  }
  const walk2 = (D, el, M, root) => [...el.children].forEach(c => walk(D, c, M, root));
  const slug = s => String(s || 'graphic').replace(/<[^>]*>/g, '').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 60) || 'graphic';
  function fromSvg(svg, o) {
    o = o || {}; const el = svg && svg.tagName && svg.tagName.toLowerCase() === 'svg' ? svg : svg && svg.querySelector ? svg.querySelector('svg') : null;
    if (!el) throw new Error('no graphic drawn');
    const D = X().drawing({ prefix: '' }); D.h = 10; D.k = 1;
    walk2(D, el, new DOMMatrix(), el);
    return { D, file: o.file || slug(o.title), title: o.title || '' };
  }
  function fromFig(fig, o) {
    const svgs = [...(fig && fig.querySelectorAll ? fig.querySelectorAll('svg') : [])].filter(s => !s.parentElement || !s.parentElement.closest('svg'));
    if (!svgs.length) throw new Error('no graphic drawn');
    o = o || {}; const D = X().drawing({ prefix: '' }); D.h = 10; D.k = 1; let ox = 0;
    svgs.forEach(s => { const w = (s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.width) || s.clientWidth || 0, vx = (s.viewBox && s.viewBox.baseVal && s.viewBox.baseVal.x) || 0;
      walk2(D, s, new DOMMatrix([1, 0, 0, 1, ox - vx, 0]), s); ox += w + 20; });
    return { D, file: o.file || slug(o.title), title: o.title || '' };
  }
  function download(g, name) {
    const txt = g.D.toDXF({ ltscale: 1 }), chk = X().validate(txt);
    if (!chk.ok) { alert(`The DXF file failed its structure check:\n${chk.errors.slice(0, 8).join('\n')}`); return false; }
    X().download(txt, `${String(name || g.file || 'graphic').replace(/[^\w.-]+/g, '_')}.dxf`); return true;
  }
  window.PSBGraphics = { fromSvg, fromFig, download, pathPolys, NOTE };
})();
