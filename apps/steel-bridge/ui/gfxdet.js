/* apps/steel-bridge/ui/gfxdet.js — the screen graphics of the detail drawings and plans in the data-viz style (option C of the Section properties graphic,
   engineer's decision 2026-11-10: families (c) details and (d) plans), window.SBDGfxDet. Classic script; display only. Each graphic is drawn from the
   numbers its tab already has (the same values and the same formatting as the CAD drawing of the graphic); nothing is recomputed. The CAD drawing
   itself (ui/gfxa.js, engine/tabgraphics-b.js) is unchanged and is what Download DXF exports. Needs ui/vizkit.js (SBDVizKit with its detail block),
   ui/graphics.js (SBDGraphics.download), shared/dxf.js (SharedDxf.fmtFtIn, frac: the CAD drawing's own formats), shared/units.js.

   API (each mounts a card into slot; o.dxf() builds the CAD graphic for Download DXF)
     ltb(slot, { r, dxf })                  Flexure: the unbraced length (L_b) of the selected location, L_p and L_r to one scale, the LTB regime highlighted
   Fix log: fixlog/steel-bridge.md (DETC, 2026-11-10). */
(function () {
  'use strict';
  const VK = () => window.SBDVizKit, X_ = () => window.SharedDxf;
  const fin = v => typeof v === 'number' && isFinite(v);
  const nf = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 2 : d) : '—');   // ui/gfxa.js nf: the CAD drawing's digits
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const r2 = v => +(+v).toFixed(2);
  const sb = t => (window.SBDSub ? window.SBDSub.html(t) : esc(t));
  /* px text (SVG) with subscripts; o = { a, cls, sz, w, halo } */
  const tx = (x, y, t, o) => { o = o || {}; const sz = o.sz || 12, K = VK(), P = K.DPAL;
    return `<text x="${r2(x)}" y="${r2(y)}"${o.a && o.a !== 'start' ? ` text-anchor="${o.a}"` : ''} class="${o.cls || 'dt-t'}${o.halo ? ' halo' : ''}" style="font-size:${sz}px"${o.w ? ' font-weight="600"' : ''} fill="${/dt-m/.test(o.cls || '') ? P.muted : /dt-g/.test(o.cls || '') ? P.gov : /dt-w/.test(o.cls || '') ? '#fff' : /dt-tok/.test(o.cls || '') ? P.okL : /dt-thi/.test(o.cls || '') ? P.hiL : /dt-tng/.test(o.cls || '') ? P.ngL : P.ink}">${K.st(t)}</text>`; };
  const ln = (x1, y1, x2, y2, cls, ex) => `<line x1="${r2(x1)}" y1="${r2(y1)}" x2="${r2(x2)}" y2="${r2(y2)}" class="${cls}"${ex || ''}/>`;
  const box = (x, y, w, h, cls, ex) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(Math.max(0, w))}" height="${r2(Math.max(0, h))}" class="${cls}"${ex || ''}/>`;
  const C = k => { const s = { 'dt-st': ['#64748B', 'none'], 'dt-ok': ['#DCFCE7', '#15803D'], 'dt-hi': ['#FEF3C7', '#B45309'], 'dt-ng': ['#FEE2E2', '#B91C1C'], 'dt-govf': ['#DBEAFE', '#2563EB'], 'dt-band': ['#2563EB', 'none'], 'dt-ldh': ['#1E3A5F', 'none'],
    'dt-dim': ['none', '#64748B'], 'dt-ext': ['none', '#CBD5E1'], 'dt-gov': ['none', '#2563EB'], 'dt-reg': ['transparent', 'none'], 'dt-na': ['#F1F5F9', '#94A3B8'] }[k] || ['none', '#0F172A']; return ` fill="${s[0]}" stroke="${s[1]}"`; };
  const reg = (x, y, w, h, t) => `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(w)}" height="${r2(h)}" rx="2" class="dt-reg" fill="transparent" data-dtr="${esc(t)}"><title>${esc(t)}</title></rect>`;
  const svgOpen = (W, H, label) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${Math.round(W)} ${Math.ceil(H)}" role="img" aria-label="${esc(label)}" font-family="Inter, Arial, sans-serif" style="background:#fff">${VK().defs()}`;
  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);

  /* ================= #6 Flexure: unbraced length (LTB) of the selected location =================
     The CAD drawing (ui/gfxa.js ltbGraphic) draws the compression flange between the two brace points, the location, L_b dimensioned, bars of L_p, L_r and L_b
     from the left brace, and C_b, F_nc (FLB, LTB) with the regime. Here: the same, the bars on one scale over the three LTB ranges (plateau up to L_p, inelastic
     up to L_r, elastic beyond: 6.10.8.2.3), the range of L_b highlighted. Every number is the CAD drawing's, by the same expression. */
  function ltbModel(r) {
    const lt = r.lt || {}, Lb = r.Lb, sg = r.seg; if (!fin(Lb) || !sg) return null;
    const xb = (sg.xb - sg.xa) * 12, xm = (r.x - sg.xa) * 12;
    const bars = [['L_p', lt.Lp, 'p'], ['L_r', lt.Lr, 'r'], ['L_b', Lb * 12, 'b']].filter(q => fin(q[1]));
    const zone = fin(lt.Lp) && fin(lt.Lr) ? (Lb * 12 <= lt.Lp ? 0 : Lb * 12 <= lt.Lr ? 1 : 2) : -1;
    const regime = fin(lt.Lp) && fin(lt.Lr) ? (Lb * 12 <= lt.Lp ? 'L_b <= L_p: F_nc = plateau (no LTB reduction)' : Lb * 12 <= lt.Lr ? 'L_p < L_b <= L_r: inelastic LTB' : 'L_b > L_r: elastic LTB, F_cr') : '';
    return { r, lt, Lb, sg, xb, xm, bars, zone, regime: regime.replace(/<=/g, '≤'), dimLb: X_().fmtFtIn(xb) };
  }
  function ltbSvg(m, W) {
    const nar = W < 560, ml = nar ? 10 : 16, mr = nar ? 10 : 16, sz = nar ? 11 : 12, lt = m.lt;
    const span = Math.max(m.xb, ...m.bars.map(q => q[1])), lw = nar ? 0 : 118, sx = (W - ml - mr - lw - (nar ? 0 : 10)) / span, X = v => ml + v * sx, o = [];
    // the flange between the braces, the brace symbols and the location
    const yF = nar ? 74 : 64, tf = 10;
    o.push(box(X(0), yF, m.xb * sx, tf, 'dt-st', C('dt-st')));
    [[0, m.sg.xa, 'start'], [m.xb, m.sg.xb, 'end']].forEach(([x, st, a]) => { const px = X(x); o.push(`<polygon points="${r2(px)},${yF + tf} ${r2(px - 6)},${yF + tf + 10} ${r2(px + 6)},${yF + tf + 10}" class="dt-ldh"${C('dt-ldh')}/>`, tx(px, yF + tf + 24, `Brace (sta ${nf(st, 1)} ft)`, { a, sz: sz - 1, cls: 'dt-m' })); });
    if (fin(m.xm)) { const px = X(Math.max(0, Math.min(m.xb, m.xm))), t = String(m.r.name), w = VK().TW(t, 11) + 14, bx = Math.max(2, Math.min(W - w - 2, px - w / 2));
      o.push(ln(px, yF - 6, px, yF + tf + 6, 'dt-gov', C('dt-gov') + ' stroke-width="2"'), `<rect x="${r2(bx)}" y="${yF - 46}" width="${r2(w)}" height="18" rx="9" class="pill" fill="#2563EB"/>`, tx(bx + w / 2, yF - 33, t, { a: 'middle', sz: 11, cls: 'dt-w' })); }
    // L_b dimensioned over the flange (the CAD drawing's measured text)
    const yD = yF - 14; o.push(ln(X(0), yD, X(m.xb), yD, 'dt-dim', C('dt-dim')), ln(X(0), yF - 2, X(0), yD - 4, 'dt-ext', C('dt-ext')), ln(X(m.xb), yF - 2, X(m.xb), yD - 4, 'dt-ext', C('dt-ext')),
      ln(X(0) - 3.5, yD + 3.5, X(0) + 3.5, yD - 3.5, 'dt-dim', C('dt-dim')), ln(X(m.xb) - 3.5, yD + 3.5, X(m.xb) + 3.5, yD - 3.5, 'dt-dim', C('dt-dim')));
    const dl = `L_b = ${m.dimLb}`, dw = VK().TW(dl, 11), dxm = Math.max(X(0) + dw / 2 + 4, Math.min(X(m.xb) - dw / 2 - 4, (X(0) + X(m.xb)) / 2));
    o.push(tx(fin(m.xm) && Math.abs(dxm - X(m.xm)) < dw / 2 + 50 ? X(0) + dw / 2 + 4 : dxm, yD - 4, dl, { a: 'middle', sz: 11, halo: true }));
    // the three LTB ranges and the bars, from the left brace (one scale)
    const bh = nar ? 12 : 16, lh = nar ? sz + 4 : 0, gap = 8, y0 = yF + tf + 46 + lh, nb = m.bars.length, yE = y0 + nb * (bh + gap + lh) - lh + 6;
    if (fin(lt.Lp) && fin(lt.Lr)) { const zs = [[0, lt.Lp, 'dt-ok', 'Plateau'], [lt.Lp, lt.Lr, 'dt-hi', 'Inelastic'], [lt.Lr, span, 'dt-ng', 'Elastic']];
      zs.forEach(([a, b, cls, nm], i) => { if (b <= a) return; const on = i === m.zone; o.push(box(X(a), y0 - 18 - lh, (b - a) * sx, yE - y0 + 18 + lh, cls, C(cls) + ` stroke-width="${on ? 1.4 : 0}" opacity="${on ? 1 : 0.55}"`));
        if ((b - a) * sx > VK().TW(nm, 10) + 6) o.push(tx(X(a) + 4, y0 - 6 - lh, nm, { sz: 10, cls: i === 0 ? 'dt-tok' : i === 1 ? 'dt-thi' : 'dt-tng', w: on })); }); }
    m.bars.forEach(([n, v, k], i) => { const y = y0 + i * (bh + gap + lh), cls = k === 'b' ? 'dt-band' : 'dt-st', lab = `${n} = ${nf(v / 12, 2)} ft`;
      o.push(box(X(0), y, v * sx, bh, cls, C(cls) + (k === 'b' ? '' : ' opacity=".75"')));
      o.push(nar ? tx(X(0) + 2, y - 4, lab, { sz, w: k === 'b', cls: k === 'b' ? 'dt-g' : 'dt-t', halo: true }) : tx(X(span) + 10, y + bh / 2 + sz * 0.36, lab, { sz, w: k === 'b', cls: k === 'b' ? 'dt-g' : 'dt-t' }));
      o.push(reg(X(0), y - 2, Math.max(12, v * sx), bh + 4, { p: `${lab}: the largest L_b for the plateau F_nc (6.10.8.2.3)`, r: `${lab}: the limit of inelastic LTB (6.10.8.2.3)`, b: `${lab}: the unbraced length at ${m.r.name} (brace points of the Framing & bracing tab)` }[k].replace(/_/g, ''))); });
    // C_b, F_nc and the regime (the CAD drawing's line)
    const yS = yE + 22; o.push(tx(ml, yS, `C_b = ${nf(m.r.Cb, 3)}; F_nc: FLB ${nf(lt.FLB, 2)} ksi, LTB ${nf(lt.LTB, 2)} ksi`, { sz }));
    if (m.regime) o.push(tx(ml, yS + 18, cap(m.regime), { sz, w: true, cls: m.zone === 0 ? 'dt-tok' : m.zone === 1 ? 'dt-thi' : 'dt-tng' }));
    const H = yS + (m.regime ? 30 : 12);
    return { svg: svgOpen(W, H, `Unbraced length ${m.dimLb} at ${m.r.name}, with L_p and L_r`) + o.join('') + '</svg>', nar };
  }
  function ltb(slot, o) {
    const K = VK(); let m = null; try { m = ltbModel(o.r); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">Unbraced length not available for this location.</p>'; return null; }
    return K.detCard(slot, { id: 'dt-ltb', title: 'Unbraced length (LTB) at the selected location', sub: `${esc(o.r.name)} · compression flange between its brace points`, dxf: o.dxf,
      draw: W => { const q = ltbSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) a bar to read what it is.',
      notes: [sb("L_b, C_b, L_p, L_r and F_nc are the values of the location table (worked steps below); the brace points are the Framing & bracing tab's. Shaded ranges of L_b: plateau (L_b ≤ L_p), inelastic LTB (L_p < L_b ≤ L_r), elastic LTB (L_b > L_r), AASHTO LRFD 6.10.8.2.3; the range of this location's L_b is outlined.")] });
  }

  window.SBDGfxDet = { ltb, ltbModel };
})();
