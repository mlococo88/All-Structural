/* shared/dxf.js — one DXF R12 (AC1009) writer for the repo (window.SharedDxf). Classic script, no build step, works from file://.
   Plan: docs/REBUILD_PLAN.md §3 ("dxf.js: one DXF R12 writer"). Log: fixlog/shared-dxf.md.

   Sources (2026-10-30):
     - the file format and its tables: BasePlateAnchorDesigner.html bpDxfWriter (DX-1, #436; itself adapted from
       Gusset Plate Rating.html GPDXF.write): ASCII R12, CRLF line ends, group codes right-aligned in 3 columns, LTYPE / LAYER /
       STYLE tables, LINE, POLYLINE (VERTEX ... SEQEND), CIRCLE, TEXT, non-ASCII text as \U+XXXX;
     - text justification and rotation, scaled linetypes, linear DIMENSION entities with their anonymous geometry blocks and a
       dimension style per scale, chained dimensions and the entity list placed by groups: GirderDetail's writer class DxfW
       ("Steel Bridge Design.html", anchor `class DxfW {`), with its text clean-up dxfStr and feet-inch format dxfFI.
   Base Plate and Gusset keep their own copies for now (future users, fixlog/shared-dxf.md).

   A drawing is a display list: drawing() records entities; toDXF() writes them as a DXF file; toSVG() draws the same list as an
   SVG string (a preview that is the file). No DOM access except download().

   Units: whatever the caller draws in (the Steel Bridge app draws full size in inches). Angles in degrees, counterclockwise from +x.

   API
     SharedDxf.drawing({ prefix }) -> D
       D.h, D.k                text height and drawing scale factor used by the next text / dimension / linetype (set them per view)
       D.layer(name, color, lt) -> the layer name (prefix + name, upper case); color = AutoCAD color index (1 red, 2 yellow, 3 green,
                               4 cyan, 5 blue, 6 magenta, 7 white/black, 8, 9 grays, 30 orange)
       D.ltype(base)           -> a linetype name for base 'CENTER' | 'HIDDEN' | 'DASHED' | 'PHANTOM' scaled to D.k ('CENTER_96')
       D.line(l, x1, y1, x2, y2, lt), D.pline(l, pts, closed, lt), D.rect(l, x1, y1, x2, y2, lt), D.circle(l, x, y, r),
       D.arc(l, x, y, r, a0, a1)  (counterclockwise from a0 to a1, degrees)
       D.text(l, x, y, hh, s, j, rot)  j: 0 left, 1 center, 2 right (at the baseline); rot degrees
       D.dim(l, p1, p2, b, ang, txt)   linear dimension between p1 and p2, dimension line through b, direction ang (deg);
                               txt may contain <> for the measured value (formatted by D.fmt, default feet-inches)
       D.dimH(l, x1, x2, y, yref, txt), D.dimV(l, y1, y2, x, xref, txt), D.chainH(l, xs, y, yref), D.chainV(l, ys, x, xref)
       D.mark(), D.bbox(i0, i1), D.move(i0, dx, dy)
       D.toDXF(opt) -> the DXF text (opt.ltscale: $LTSCALE, default 1)
     SharedDxf.toSVG(D, opt) -> '<svg ...>' of entities opt.i0..opt.i1 (default all); opt: { width, pad, bg, cls, title }
     SharedDxf.viewer(host, svg, opt) (browser) the SVG in host with pan and zoom by its viewBox: wheel about the cursor, drag, pinch,
                             double-click / double-tap to fit, on-canvas + / - / Fit; returns { level, set, zoom, fit }
     SharedDxf.viewer(host, svg, opt) (browser) the SVG in host with pan and zoom by its viewBox: wheel about the cursor, drag, pinch,
                             double-click / double-tap to fit, on-canvas + / - / Fit; returns { level, set, zoom, fit }
     SharedDxf.str(s)        text as DXF R12 accepts it (degree %%d, diameter %%c, x for ×, CL for ℄, HTML tags removed)
     SharedDxf.frac(v, den), fmtIn(inch), fmtFtIn(inch)   9/16 (nearest 1/16 by default), 1 1/8", 12'-4 1/2" (nearest 1/8 in)
     SharedDxf.parse(text)   -> { pairs, sections, tables, blocks, entities } (tests; any DXF this writer makes)
     SharedDxf.validate(text) -> { ok, errors, counts, layers }: structure checks (SECTION/ENDSEC pairs, HEADER $ACADVER, ENTITIES,
                               EOF, numeric group codes, POLYLINE ... SEQEND, every layer, linetype, dimension style and block used
                               is defined)
     SharedDxf.download(text, filename)  saves the file (Blob + a[download]; works from file:// in Chrome, Edge, Firefox) */
(function () {
  'use strict';
  const BASE_LT = { CONTINUOUS: [], DASHED: [0.5, -0.25], HIDDEN: [0.25, -0.125], CENTER: [1.25, -0.25, 0.25, -0.25], PHANTOM: [1.25, -0.25, 0.25, -0.25, 0.25, -0.25] };
  const LT_DESC = { CONTINUOUS: 'Solid line', DASHED: '__ __ __ __', HIDDEN: '_ _ _ _ _', CENTER: '____ _ ____ _', PHANTOM: '_____ _ _ _____' };

  /* numbers: up to 6 decimals, trailing zeros removed, never "-0" (bpDxfWriter f8) */
  function num(x) { let s = (Math.abs(x) < 5e-9 ? 0 : +x).toFixed(6); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); return s === '-0' ? '0' : s; }
  /* text clean-up (GirderDetail dxfStr, then bpDxfWriter enc for anything else that is not ASCII) */
  function str(s) {
    return String(s == null ? '' : s).replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/[°º]/g, '%%d').replace(/[⌀Ø]/g, '%%c').replace(/×/g, 'x')
      .replace(/[−–—]/g, '-').replace(/℄/g, 'CL').replace(/[′’]/g, "'").replace(/[″”“]/g, '"').replace(/±/g, '%%p').replace(/[\r\n\t]+/g, ' ')
      .replace(/[^\x20-\x7e]/g, c => '\\U+' + c.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')).slice(0, 250);
  }
  /* fractions of an inch: v to the nearest 1/den (default 1/16, as GirderDetail's frac for plate sizes), "1 1/8", "9/16" (den a power of 2) */
  function frac(v, den) {
    den = den || 16; const sg = v < 0 ? '-' : ''; let n = Math.round(Math.abs(v) * den), w = Math.floor(n / den), r = n - w * den, d = den;
    while (r && r % 2 === 0) { r /= 2; d /= 2; }
    return sg + (r ? (w ? `${w} ${r}/${d}` : `${r}/${d}`) : String(w));
  }
  /* inches to the nearest 1/8 (GirderDetail dxfIn), 7/8" */
  const fmtIn = inch => `${frac(inch, 8)}"`;
  /* feet-inches (GirderDetail dxfFI): under 12 in as inches, else 12'-4 1/2" */
  function fmtFtIn(inch) {
    const s = inch < 0 ? '-' : ''; const a = Math.round(Math.abs(inch) * 8) / 8; if (a < 12 - 1e-9) return `${s}${frac(a, 8)}"`;
    let ft = Math.floor(a / 12 + 1e-9), r = a - ft * 12; if (r >= 12 - 1e-9) { ft++; r = 0; } return `${s}${ft}'-${frac(r, 8)}"`;
  }

  /* the geometry of a linear dimension (GirderDetail DxfW._dimGeo): extension lines, dimension line, 45° ticks and the text, in world
     coordinates. e = { pts: [p1, p2, d1, d2], ang, k, hh, s (text) } */
  function dimGeo(e) {
    const [p1, p2, d1, d2] = e.pts, k = e.k, a = e.ang * Math.PI / 180, u = [Math.cos(a), Math.sin(a)], nv = [-u[1], u[0]], g = [];
    const ext = (p, d) => { const v = [d[0] - p[0], d[1] - p[1]], L = Math.hypot(v[0], v[1]); if (L < 1e-9) return; const w = [v[0] / L, v[1] / L];
      g.push({ t: 'LINE', pts: [[p[0] + w[0] * 0.06 * k, p[1] + w[1] * 0.06 * k], [d[0] + w[0] * 0.12 * k, d[1] + w[1] * 0.12 * k]] }); };
    ext(p1, d1); ext(p2, d2); g.push({ t: 'LINE', pts: [d1.slice(), d2.slice()] });
    const tk = 0.07 * k; [d1, d2].forEach(d => g.push({ t: 'LINE', pts: [[d[0] - (u[0] + nv[0]) * tk, d[1] - (u[1] + nv[1]) * tk], [d[0] + (u[0] + nv[0]) * tk, d[1] + (u[1] + nv[1]) * tk]] }));
    let rot = e.ang; if (rot > 90.001 && rot <= 270) rot -= 180;
    const m = [(d1[0] + d2[0]) / 2 + nv[0] * 0.05 * k, (d1[1] + d2[1]) / 2 + nv[1] * 0.05 * k], ra = rot * Math.PI / 180, off = [-Math.sin(ra), Math.cos(ra)];
    g.push({ t: 'TEXT', hh: e.hh, s: e.s, j: 1, rot, pts: [[m[0] + off[0] * 0.02 * k, m[1] + off[1] * 0.02 * k]] });
    return { g, m };
  }

  function drawing(opt) {
    opt = opt || {};
    const D = { E: [], L: {}, lt: {}, ds: {}, px: opt.prefix || '', h: 1, k: 1, fmt: opt.fmt || fmtFtIn };
    D.layer = (n, color, lt) => { const nm = (D.px + n).toUpperCase(); if (!D.L[nm]) D.L[nm] = { color: color == null ? 7 : color, lt: lt || 'CONTINUOUS' }; return nm; };
    D.ltype = base => { const b = String(base || 'CONTINUOUS').toUpperCase(); if (!BASE_LT[b] || b === 'CONTINUOUS') return 'CONTINUOUS';
      const nm = `${b}_${num(D.k).replace('.', 'P')}`; if (!D.lt[nm]) D.lt[nm] = BASE_LT[b].map(v => v * D.k * 0.4); return nm; };
    const dstyle = () => { const nm = `SD${num(D.k).replace('.', 'P')}`; if (!D.ds[nm]) D.ds[nm] = { k: D.k, t: D.h / D.k }; return nm; };
    D.mark = () => D.E.length;
    D.line = (l, x1, y1, x2, y2, lt) => { D.E.push({ t: 'LINE', l, lt, pts: [[x1, y1], [x2, y2]] }); };
    D.pline = (l, pts, closed, lt) => { D.E.push({ t: 'PL', l, lt, closed: !!closed, pts: pts.map(p => [p[0], p[1]]) }); };
    D.rect = (l, x1, y1, x2, y2, lt) => D.pline(l, [[x1, y1], [x2, y1], [x2, y2], [x1, y2]], true, lt);
    D.circle = (l, x, y, r) => { D.E.push({ t: 'CIRCLE', l, r, pts: [[x, y]] }); };
    D.arc = (l, x, y, r, a0, a1) => { D.E.push({ t: 'ARC', l, r, a0, a1, pts: [[x, y]] }); };
    D.text = (l, x, y, hh, s, j, rot) => { D.E.push({ t: 'TEXT', l, hh, s: str(s), j: j || 0, rot: rot || 0, pts: [[x, y]] }); };
    D.dim = (l, p1, p2, b, ang, txt) => {
      ang = ang || 0; const u = [Math.cos(ang * Math.PI / 180), Math.sin(ang * Math.PI / 180)], pr = p => { const d = (p[0] - b[0]) * u[0] + (p[1] - b[1]) * u[1]; return [b[0] + u[0] * d, b[1] + u[1] * d]; };
      const d1 = pr(p1), d2 = pr(p2), meas = Math.hypot(d2[0] - d1[0], d2[1] - d1[1]); if (meas < 1e-6) return;
      D.E.push({ t: 'DIM', l, ang, meas, s: str((txt || '<>').replace('<>', D.fmt(meas))), ds: dstyle(), k: D.k, hh: D.h, pts: [[p1[0], p1[1]], [p2[0], p2[1]], d1, d2] });
    };
    D.dimH = (l, x1, x2, y, yref, txt) => D.dim(l, [x1, yref != null ? yref : y], [x2, yref != null ? yref : y], [x1, y], 0, txt);
    D.dimV = (l, y1, y2, x, xref, txt) => D.dim(l, [xref != null ? xref : x, y1], [xref != null ? xref : x, y2], [x, y1], 90, txt);
    /* runs of equal spacing become one dimension "n@s" (GirderDetail DxfW._runs) */
    const runs = v => { const s = [...new Set(v.map(q => +q.toFixed(4)))].sort((a, b) => a - b), out = []; let i = 0;
      while (i < s.length - 1) { const d = s[i + 1] - s[i]; let j = i + 1; while (j < s.length - 1 && Math.abs((s[j + 1] - s[j]) - d) < 1e-3) j++; out.push([s[i], s[j], j - i, d]); i = j; } return out; };
    D.chainH = (l, xs, y, yref) => runs(xs).forEach(([a, b, n, d]) => D.dimH(l, a, b, y, yref, n > 1 ? `${n}@${D.fmt(d)}` : ''));
    D.chainV = (l, ys, x, xref) => runs(ys).forEach(([a, b, n, d]) => D.dimV(l, a, b, x, xref, n > 1 ? `${n}@${D.fmt(d)}` : ''));
    D.bbox = (i0, i1) => bbox(D.E, i0 || 0, i1 == null ? D.E.length : i1);
    D.move = (i0, dx, dy) => { for (let i = i0 || 0; i < D.E.length; i++) D.E[i].pts.forEach(p => { p[0] += dx; p[1] += dy; }); };
    D.toDXF = o => write(D, o || {});
    return D;
  }

  /* extents of entities i0..i1 (text by an estimated width of one height per character) */
  function bbox(E, i0, i1) {
    const b = [Infinity, Infinity, -Infinity, -Infinity], a = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; if (x < b[0]) b[0] = x; if (y < b[1]) b[1] = y; if (x > b[2]) b[2] = x; if (y > b[3]) b[3] = y; };
    const txt = e => { const w = e.s.length * e.hh * 0.9, r = (e.rot || 0) * Math.PI / 180, sh = e.j === 2 ? -w : e.j === 1 ? -w / 2 : 0, c = Math.cos(r), s = Math.sin(r), x0 = e.pts[0][0] + sh * c, y0 = e.pts[0][1] + sh * s;
      a(x0, y0); a(x0 + w * c, y0 + w * s); a(x0 - e.hh * s, y0 + e.hh * c); a(x0 + w * c - e.hh * s, y0 + w * s + e.hh * c); };
    for (let i = i0; i < i1; i++) { const e = E[i];
      if (e.t === 'TEXT') { txt(e); continue; }
      if (e.t === 'CIRCLE' || e.t === 'ARC') { const [x, y] = e.pts[0]; a(x - e.r, y - e.r); a(x + e.r, y + e.r); continue; }
      if (e.t === 'DIM') { dimGeo(e).g.forEach(q => (q.t === 'TEXT' ? txt(q) : q.pts.forEach(p => a(p[0], p[1])))); continue; }
      e.pts.forEach(p => a(p[0], p[1])); }
    return b;
  }

  /* ---------- DXF text ---------- */
  function write(D, o) {
    const out = [], g = (c, v) => out.push(String(c).padStart(3), String(v));
    const ent = (e, lay) => { const L = lay || e.l;
      if (e.t === 'LINE') { g(0, 'LINE'); g(8, L); if (e.lt) g(6, e.lt); g(10, num(e.pts[0][0])); g(20, num(e.pts[0][1])); g(30, 0); g(11, num(e.pts[1][0])); g(21, num(e.pts[1][1])); g(31, 0); return; }
      if (e.t === 'CIRCLE') { g(0, 'CIRCLE'); g(8, L); g(10, num(e.pts[0][0])); g(20, num(e.pts[0][1])); g(30, 0); g(40, num(e.r)); return; }
      if (e.t === 'ARC') { g(0, 'ARC'); g(8, L); g(10, num(e.pts[0][0])); g(20, num(e.pts[0][1])); g(30, 0); g(40, num(e.r)); g(50, num(e.a0)); g(51, num(e.a1)); return; }
      if (e.t === 'PL') { g(0, 'POLYLINE'); g(8, L); if (e.lt) g(6, e.lt); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, e.closed ? 1 : 0);
        e.pts.forEach(p => { g(0, 'VERTEX'); g(8, L); g(10, num(p[0])); g(20, num(p[1])); g(30, 0); }); g(0, 'SEQEND'); g(8, L); return; }
      if (e.t === 'TEXT') { const [x, y] = e.pts[0]; g(0, 'TEXT'); g(8, L); g(10, num(x)); g(20, num(y)); g(30, 0); g(40, num(e.hh)); g(1, e.s);
        if (e.rot) g(50, num(e.rot)); if (e.j) { g(72, e.j); g(11, num(x)); g(21, num(y)); g(31, 0); } }
    };
    const used = D.E;
    // linetypes and dimension styles actually used
    const ltUsed = new Set(['CONTINUOUS']); used.forEach(e => e.lt && ltUsed.add(e.lt)); Object.values(D.L).forEach(q => ltUsed.add(q.lt));
    const lts = [...ltUsed].map(nm => [nm, nm === 'CONTINUOUS' ? [] : (D.lt[nm] || BASE_LT[nm] || [])]);
    const dsUsed = [...new Set(used.filter(e => e.t === 'DIM').map(e => e.ds))];
    const b = bbox(used, 0, used.length), ok = isFinite(b[0]);
    // HEADER
    g(0, 'SECTION'); g(2, 'HEADER'); g(9, '$ACADVER'); g(1, 'AC1009'); g(9, '$INSBASE'); g(10, 0); g(20, 0); g(30, 0);
    g(9, '$EXTMIN'); g(10, num(ok ? b[0] : 0)); g(20, num(ok ? b[1] : 0)); g(30, 0); g(9, '$EXTMAX'); g(10, num(ok ? b[2] : 0)); g(20, num(ok ? b[3] : 0)); g(30, 0);
    g(9, '$LUNITS'); g(70, o.lunits || 4); g(9, '$LUPREC'); g(70, 3); g(9, '$LTSCALE'); g(40, num(o.ltscale || 1)); g(9, '$TEXTSTYLE'); g(7, 'STANDARD');
    g(9, '$DIMSTYLE'); g(2, 'STANDARD'); g(9, '$INSUNITS'); g(70, o.insunits || 1); g(0, 'ENDSEC');
    // TABLES
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LTYPE'); g(70, lts.length);
    lts.forEach(([nm, p]) => { const base = nm.split('_')[0]; g(0, 'LTYPE'); g(2, nm); g(70, 0); g(3, LT_DESC[base] || nm); g(72, 65); g(73, p.length); g(40, num(p.reduce((a, v) => a + Math.abs(v), 0))); p.forEach(v => g(49, num(v))); });
    g(0, 'ENDTAB');
    const lays = [['0', { color: 7, lt: 'CONTINUOUS' }], ...Object.entries(D.L).filter(([nm]) => nm !== '0')];
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, lays.length); lays.forEach(([nm, q]) => { g(0, 'LAYER'); g(2, nm); g(70, 0); g(62, q.color); g(6, q.lt); }); g(0, 'ENDTAB');
    g(0, 'TABLE'); g(2, 'STYLE'); g(70, 1); g(0, 'STYLE'); g(2, 'STANDARD'); g(70, 0); g(40, 0); g(41, 1); g(50, 0); g(71, 0); g(42, 0.2); g(3, 'txt'); g(4, ''); g(0, 'ENDTAB');
    const dss = [['STANDARD', { k: 1, t: 0.18 }], ...dsUsed.map(nm => [nm, D.ds[nm]])];
    g(0, 'TABLE'); g(2, 'DIMSTYLE'); g(70, dss.length);
    dss.forEach(([nm, q]) => { g(0, 'DIMSTYLE'); g(2, nm); g(70, 0); g(3, ''); g(4, ''); g(5, ''); g(6, ''); g(7, ''); g(40, num(q.k)); g(41, 0.07); g(42, 0.06); g(43, 0.38); g(44, 0.12);
      g(45, 0); g(46, 0); g(47, 0); g(48, 0); g(140, num(q.t)); g(141, 0.09); g(142, 0.07); g(143, 25.4); g(144, 1); g(145, 0); g(146, 1); g(147, 0.05);
      [71, 72, 73, 74, 75, 76].forEach(c => g(c, 0)); g(77, 1); g(78, 3); g(170, 0); g(171, 2); g(172, 1); [173, 174, 175, 176, 177, 178].forEach(c => g(c, 0)); });
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    // BLOCKS: one anonymous block per dimension (its geometry)
    g(0, 'SECTION'); g(2, 'BLOCKS'); let di = 0; const dimBlk = new Map();
    used.forEach(e => { if (e.t !== 'DIM') return; const G = dimGeo(e), nm = `*D${++di}`; dimBlk.set(e, { nm, G });
      g(0, 'BLOCK'); g(8, '0'); g(2, nm); g(70, 1); g(10, 0); g(20, 0); g(30, 0); g(3, nm); G.g.forEach(q => ent(q, '0')); g(0, 'ENDBLK'); g(8, '0'); });
    g(0, 'ENDSEC');
    // ENTITIES
    g(0, 'SECTION'); g(2, 'ENTITIES');
    used.forEach(e => { if (e.t !== 'DIM') { ent(e); return; } const { nm, G } = dimBlk.get(e);
      g(0, 'DIMENSION'); g(8, e.l); g(2, nm); g(3, e.ds); g(10, num(e.pts[3][0])); g(20, num(e.pts[3][1])); g(30, 0); g(11, num(G.m[0])); g(21, num(G.m[1])); g(31, 0); g(70, 0); g(1, e.s);
      g(13, num(e.pts[0][0])); g(23, num(e.pts[0][1])); g(33, 0); g(14, num(e.pts[1][0])); g(24, num(e.pts[1][1])); g(34, 0); g(50, num(e.ang)); });
    g(0, 'ENDSEC'); g(0, 'EOF');
    return out.join('\r\n') + '\r\n';
  }

  /* ---------- SVG preview of the same entities ---------- */
  const ACI = { 1: '#d22', 2: '#a07800', 3: '#1a8a3a', 4: '#08808a', 5: '#1f4fc4', 6: '#a3229a', 7: '#17212b', 8: '#6b7280', 9: '#9ca3af', 30: '#c96a10' };
  function toSVG(D, opt) {
    opt = opt || {}; const i0 = opt.i0 || 0, i1 = opt.i1 == null ? D.E.length : opt.i1, b = bbox(D.E, i0, i1);
    if (!isFinite(b[0])) return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"></svg>';
    const pad = opt.pad != null ? opt.pad : 0.02 * Math.max(b[2] - b[0], b[3] - b[1]), x0 = b[0] - pad, y1 = b[3] + pad, W = b[2] - b[0] + 2 * pad, H = b[3] - b[1] + 2 * pad;
    const X = x => +(x - x0).toFixed(3), Y = y => +(y1 - y).toFixed(3), sw = Math.max(W, H) / 1500;
    const col = l => ACI[(D.L[l] || {}).color] || ACI[7], esc = s => String(s).replace(/%%d/g, '°').replace(/%%c/g, 'Ø').replace(/%%p/g, '±').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const dash = lt => { if (!lt || lt === 'CONTINUOUS') return ''; const p = D.lt[lt] || BASE_LT[lt.split('_')[0]] || []; return p.length ? ` stroke-dasharray="${p.map(v => +Math.max(Math.abs(v), sw).toFixed(3)).join(' ')}"` : ''; };
    const anc = j => j === 1 ? ' text-anchor="middle"' : j === 2 ? ' text-anchor="end"' : '';
    const txt = (e, c) => `<text x="${X(e.pts[0][0])}" y="${Y(e.pts[0][1])}" font-size="${+e.hh.toFixed(3)}" fill="${c}"${anc(e.j)}${e.rot ? ` transform="rotate(${+(-e.rot).toFixed(3)} ${X(e.pts[0][0])} ${Y(e.pts[0][1])})"` : ''}>${esc(e.s)}</text>`;
    const parts = [];
    for (let i = i0; i < i1; i++) { const e = D.E[i], c = col(e.l), st = `stroke="${c}" stroke-width="${+sw.toFixed(4)}" fill="none"${dash(e.lt)}`;
      if (e.t === 'LINE') parts.push(`<line x1="${X(e.pts[0][0])}" y1="${Y(e.pts[0][1])}" x2="${X(e.pts[1][0])}" y2="${Y(e.pts[1][1])}" ${st}/>`);
      else if (e.t === 'PL') parts.push(`<${e.closed ? 'polygon' : 'polyline'} points="${e.pts.map(p => `${X(p[0])},${Y(p[1])}`).join(' ')}" ${st}/>`);
      else if (e.t === 'CIRCLE') parts.push(`<circle cx="${X(e.pts[0][0])}" cy="${Y(e.pts[0][1])}" r="${+e.r.toFixed(3)}" ${st}/>`);
      else if (e.t === 'ARC') { const [cx, cy] = e.pts[0], r = e.r, a0 = e.a0 * Math.PI / 180, a1 = e.a1 * Math.PI / 180, sweep = ((e.a1 - e.a0) % 360 + 360) % 360;
        parts.push(`<path d="M${X(cx + r * Math.cos(a0))} ${Y(cy + r * Math.sin(a0))}A${+r.toFixed(3)} ${+r.toFixed(3)} 0 ${sweep > 180 ? 1 : 0} 0 ${X(cx + r * Math.cos(a1))} ${Y(cy + r * Math.sin(a1))}" ${st}/>`); }
      else if (e.t === 'TEXT') parts.push(txt(e, c));
      else if (e.t === 'DIM') dimGeo(e).g.forEach(q => parts.push(q.t === 'TEXT' ? txt(q, c) : `<line x1="${X(q.pts[0][0])}" y1="${Y(q.pts[0][1])}" x2="${X(q.pts[1][0])}" y2="${Y(q.pts[1][1])}" stroke="${c}" stroke-width="${+sw.toFixed(4)}"/>`)); }
    const w = opt.width ? ` width="${opt.width}"` : '';
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${+W.toFixed(3)} ${+H.toFixed(3)}"${w}${opt.cls ? ` class="${opt.cls}"` : ''} font-family="Arial, Helvetica, sans-serif" preserveAspectRatio="xMidYMid meet">${opt.title ? `<title>${esc(opt.title)}</title>` : ''}${opt.bg ? `<rect width="100%" height="100%" fill="${opt.bg}"/>` : ''}${parts.join('')}</svg>`;
  }

  /* ---------- interactive preview (browser): pan and zoom of a toSVG() drawing ---------- */
  /* viewer(host, svg, opt) puts the SVG string svg in host with navigation by its viewBox (text stays vector at any zoom):
     wheel zooms about the cursor (the page does not scroll while the wheel is over the drawing; at fit the wheel zooms in), drag pans
     (left or middle button; one finger), two-finger pinch zooms and pans, double-click / double-tap fits; on-canvas +, − and Fit buttons.
     opt: { height (CSS, default '70vh'), level (initial zoom, 1 = fit), max (default 64), onchange(level) }.
     Returns { level(), set(level) (about the center), zoom(f, clientX, clientY), fit(), el (the svg), box }. */
  function viewer(host, svg, opt) {
    opt = opt || {}; const MAX = opt.max || 64, MIN = 0.5;
    host.innerHTML = `<div class="sdx-view" style="position:relative;overflow:hidden;height:${opt.height || '70vh'};touch-action:none;cursor:grab;user-select:none;-webkit-user-select:none;background:#fff">${svg}`
      + '<div class="sdx-btns" style="position:absolute;right:6px;top:6px;display:flex;gap:4px">'
      + ['+', '−', 'Fit'].map((t, i) => `<button type="button" data-sdx="${['in', 'out', 'fit'][i]}" aria-label="${['Zoom in', 'Zoom out', 'Zoom to fit'][i]}" style="min-width:30px;height:28px;padding:0 6px;font:600 13px system-ui,sans-serif;background:rgba(255,255,255,.92);border:1px solid #9aa4b2;border-radius:4px;cursor:pointer">${t}</button>`).join('') + '</div></div>';
    const box = host.firstElementChild, el = box.querySelector('svg');
    const v0 = (el.getAttribute('viewBox') || '0 0 10 10').split(/[\s,]+/).map(Number), v = v0.slice();
    el.setAttribute('preserveAspectRatio', 'xMidYMid meet'); el.style.width = '100%'; el.style.height = '100%'; el.style.display = 'block';
    const apply = () => { el.setAttribute('viewBox', v.map(q => +q.toFixed(4)).join(' ')); if (opt.onchange) opt.onchange(level()); };
    const level = () => v0[2] / v[2];
    /* drawing units per screen pixel, and the drawing point under client (x, y) (xMidYMid meet) */
    const geo = () => { const r = el.getBoundingClientRect(), k = Math.max(v[2] / (r.width || 1), v[3] / (r.height || 1)); return { r, k, ox: v[0] - (r.width * k - v[2]) / 2, oy: v[1] - (r.height * k - v[3]) / 2 }; };
    const at = (cx, cy) => { const g = geo(); return [g.ox + (cx - g.r.left) * g.k, g.oy + (cy - g.r.top) * g.k]; };
    function zoom(f, cx, cy) {
      const L = level(), f2 = Math.max(MIN / L, Math.min(MAX / L, f)); if (Math.abs(f2 - 1) < 1e-9) return;
      const p = cx == null ? [v[0] + v[2] / 2, v[1] + v[3] / 2] : at(cx, cy);
      v[0] = p[0] - (p[0] - v[0]) / f2; v[1] = p[1] - (p[1] - v[1]) / f2; v[2] /= f2; v[3] /= f2; apply();
    }
    const fit = () => { for (let i = 0; i < 4; i++) v[i] = v0[i]; apply(); };
    const set = L => { if (!(L > 0)) return; if (Math.abs(L - 1) < 1e-9) { fit(); return; } zoom(L / level()); };
    const pan = (dx, dy) => { const k = geo().k; v[0] -= dx * k; v[1] -= dy * k; apply(); };
    el.addEventListener('wheel', e => { e.preventDefault(); zoom(Math.exp(-Math.max(-300, Math.min(300, e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY)) * 0.0015), e.clientX, e.clientY); }, { passive: false });
    box.addEventListener('wheel', e => e.preventDefault(), { passive: false });
    const P = new Map(); let last = null, tap = 0;
    el.addEventListener('pointerdown', e => { if (e.button !== 0 && e.button !== 1) return; e.preventDefault(); el.setPointerCapture && el.setPointerCapture(e.pointerId); P.set(e.pointerId, [e.clientX, e.clientY]); last = null; box.style.cursor = 'grabbing';
      if (e.pointerType === 'touch' && P.size === 1) { const t = Date.now(); if (t - tap < 300) { fit(); tap = 0; } else tap = t; } });
    el.addEventListener('pointermove', e => { if (!P.has(e.pointerId)) return; const q = P.get(e.pointerId), dx = e.clientX - q[0], dy = e.clientY - q[1];
      if (P.size === 1) { P.set(e.pointerId, [e.clientX, e.clientY]); pan(dx, dy); return; }
      P.set(e.pointerId, [e.clientX, e.clientY]); const [a, b] = [...P.values()], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (last) { pan(m[0] - last.m[0], m[1] - last.m[1]); if (last.d > 0 && d > 0) zoom(d / last.d, m[0], m[1]); } last = { m, d }; });
    const up = e => { P.delete(e.pointerId); last = null; if (!P.size) box.style.cursor = 'grab'; };
    el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
    el.addEventListener('dblclick', e => { e.preventDefault(); fit(); });
    box.querySelectorAll('[data-sdx]').forEach(b => b.addEventListener('click', () => { const k = b.dataset.sdx; if (k === 'fit') fit(); else zoom(k === 'in' ? 1.5 : 1 / 1.5); }));
    if (opt.level && opt.level !== 1) requestAnimationFrame(() => set(opt.level));
    return { level, set, zoom, fit, el, box };
  }

  /* ---------- reading back (tests, self-checks) ---------- */
  function parse(text) {
    const ln = String(text).split(/\r?\n/); if (ln[ln.length - 1] === '') ln.pop();
    const errors = [], pairs = [];
    if (ln.length % 2) errors.push(`odd number of lines (${ln.length}): group codes and values must come in pairs`);
    for (let i = 0; i + 1 < ln.length; i += 2) { const c = ln[i].trim(); if (!/^-?\d+$/.test(c)) errors.push(`line ${i + 1}: group code "${ln[i]}" is not an integer`); pairs.push([parseInt(c, 10), ln[i + 1]]); }
    const sections = {}, order = []; let i = 0;
    while (i < pairs.length) { const [c, v] = pairs[i];
      if (c === 0 && v === 'EOF') break;
      if (c === 0 && v === 'SECTION') { const nm = pairs[i + 1] && pairs[i + 1][0] === 2 ? pairs[i + 1][1] : '?', body = []; i += 2;
        while (i < pairs.length && !(pairs[i][0] === 0 && (pairs[i][1] === 'ENDSEC' || pairs[i][1] === 'EOF' || pairs[i][1] === 'SECTION'))) body.push(pairs[i++]);
        if (!pairs[i] || pairs[i][1] !== 'ENDSEC') errors.push(`section ${nm} has no ENDSEC`); else i++;
        sections[nm] = body; order.push(nm); continue; }
      errors.push(`pair ${i}: (${c}, ${v}) outside a section`); i++; }
    // split a list of pairs into records starting at group 0
    const recs = body => { const out = []; (body || []).forEach(p => { if (p[0] === 0) out.push({ type: p[1], codes: [] }); else if (out.length) out[out.length - 1].codes.push(p); }); return out; };
    const get = (r, c) => { const p = r.codes.find(q => q[0] === c); return p ? p[1] : undefined; };
    const all = (r, c) => r.codes.filter(q => q[0] === c).map(q => q[1]);
    // tables
    const tables = {}; let cur = null; recs(sections.TABLES).forEach(r => { if (r.type === 'TABLE') { cur = get(r, 2); tables[cur] = []; } else if (r.type === 'ENDTAB') cur = null; else if (cur) tables[cur].push(r); });
    // blocks
    const blocks = {}; let bk = null; recs(sections.BLOCKS).forEach(r => { if (r.type === 'BLOCK') { bk = { name: get(r, 2), ents: [] }; blocks[bk.name] = bk; } else if (r.type === 'ENDBLK') bk = null; else if (bk) bk.ents.push(r); });
    // entities, with POLYLINE vertices folded in
    const entities = []; let pl = null;
    recs(sections.ENTITIES).forEach(r => { if (r.type === 'VERTEX' && pl) { pl.verts.push([+get(r, 10), +get(r, 20)]); return; } if (r.type === 'SEQEND') { if (!pl) errors.push('SEQEND without POLYLINE'); pl = null; return; }
      if (pl) { errors.push('POLYLINE without SEQEND'); pl = null; }
      const e = { type: r.type, layer: get(r, 8), lt: get(r, 6), codes: r.codes, get: c => get(r, c), all: c => all(r, c) }; if (r.type === 'POLYLINE') { e.verts = []; e.closed = (+get(r, 70) & 1) === 1; pl = e; } entities.push(e); });
    if (pl) errors.push('POLYLINE without SEQEND at the end of ENTITIES');
    const eof = pairs.length && pairs[pairs.length - 1][0] === 0 && pairs[pairs.length - 1][1] === 'EOF';
    return { pairs, sections, order, tables, blocks, entities, eof, errors };
  }
  function validate(text) {
    const R = parse(text), errors = R.errors.slice(), H = R.sections.HEADER || [];
    if (!R.eof) errors.push('the file does not end with 0 EOF');
    if (R.order[0] !== 'HEADER') errors.push('the first section is not HEADER');
    const iv = H.findIndex(p => p[0] === 9 && p[1] === '$ACADVER'); if (iv < 0 || !H[iv + 1] || H[iv + 1][1] !== 'AC1009') errors.push('$ACADVER is not AC1009 (R12)');
    if (!R.sections.ENTITIES) errors.push('no ENTITIES section');
    const names = t => new Set((R.tables[t] || []).map(r => (r.codes.find(q => q[0] === 2) || [])[1]));
    const lay = names('LAYER'), lts = names('LTYPE'), dss = names('DIMSTYLE');
    (R.tables.LAYER || []).forEach(r => { const lt = (r.codes.find(q => q[0] === 6) || [])[1]; if (lt && !lts.has(lt)) errors.push(`layer ${(r.codes.find(q => q[0] === 2) || [])[1]}: linetype ${lt} not defined`); });
    const counts = {};
    R.entities.forEach(e => { counts[e.type] = (counts[e.type] || 0) + 1;
      if (e.layer == null) errors.push(`${e.type} without a layer`); else if (!lay.has(e.layer)) errors.push(`${e.type} on undefined layer ${e.layer}`);
      if (e.lt && !lts.has(e.lt)) errors.push(`${e.type} with undefined linetype ${e.lt}`);
      if (e.type === 'DIMENSION') { const bn = e.get(2), ds = e.get(3); if (!R.blocks[bn]) errors.push(`DIMENSION block ${bn} not defined`); if (ds && !dss.has(ds)) errors.push(`DIMENSION style ${ds} not defined`); }
      if (e.type === 'POLYLINE' && e.verts.length < 2) errors.push('POLYLINE with fewer than 2 vertices');
      [10, 20, 11, 21, 40, 50, 51].forEach(c => { const v = e.get(c); if (v !== undefined && !isFinite(+v)) errors.push(`${e.type}: group ${c} = "${v}" is not a number`); }); });
    return { ok: !errors.length, errors, counts, layers: [...lay] };
  }

  /* ---------- saving (browser) ---------- */
  function download(text, filename) {
    const name = String(filename || 'drawing.dxf').replace(/[^\w.\- ]+/g, '_'), blob = new Blob([text], { type: 'application/dxf' });
    if (typeof navigator !== 'undefined' && navigator.msSaveOrOpenBlob) { navigator.msSaveOrOpenBlob(blob, name); return; }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = /\.dxf$/i.test(name) ? name : name + '.dxf';
    document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
  }

  window.SharedDxf = { drawing, toSVG, viewer, str, frac, fmtIn, fmtFtIn, num, dimGeo, bbox, parse, validate, download, ACI };
})();
