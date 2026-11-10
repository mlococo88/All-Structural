/* apps/steel-bridge/ui/gfxdet.js — the screen graphics of the detail drawings and plans in the data-viz style (option C of the Section properties graphic,
   engineer's decision 2026-11-10: families (c) details and (d) plans), window.SBDGfxDet. Classic script; display only. Each graphic is drawn from the
   numbers its tab already has (the same values and the same formatting as the CAD drawing of the graphic); nothing is recomputed. The CAD drawing
   itself (ui/gfxa.js, engine/tabgraphics-b.js) is unchanged and is what Download DXF exports. Needs ui/vizkit.js (SBDVizKit with its detail block),
   ui/graphics.js (SBDGraphics.download), shared/dxf.js (SharedDxf.fmtFtIn, frac: the CAD drawing's own formats), shared/units.js.

   API (each mounts a card into slot; o.dxf() builds the CAD graphic for Download DXF)
     ltb(slot, { r, dxf })                  Flexure: the unbraced length (L_b) of the selected location, L_p and L_r to one scale, the LTB regime highlighted
     bracket(slot, { P, gi, oh, dxf })      Constructibility: the overhang bracket sketch (exterior girder), oh = R.F.oh (its inputs p)
     stiff(slot, { R, opt, dxf, file })     Shear & stiffeners: the transverse stiffener (R = SBDShearUI.build result; opt.i its row)
     bear(slot, { R, opt, dxf, file })      Shear & stiffeners: the bearing stiffener (opt.i its row)
     crossframe(slot, { B, opt, dxf, file }) Cross-frames: the cross-frame elevation (B = SBDFramingUI.build result; opt.dia: diaphragm in use)
     weld(slot, { B, opt, dxf, file })      Welds: the flange-to-web weld size detail (B = SBDWeldsUI.build result; opt.i the location)
     lldf(slot, { P, R, lg, lr, cs, onCase(k), dxf(use) })   Loads & LLDF: the cross-section with lanes and wheels of the LLDF case (segmented control)
     strip(slot, { list, P, sel, onSel(i), dxf, file })     Field splices: the splice locations; stripFigure(list, P, W): the Report's static figure
     diaphragm(B)                           Cross-frames (diaphragm in use): the intermediate diaphragm elevation as an HTML string (ui/framing.js diaSvg)
     splice(slot, { s, dxf, file })         Field splices: the splice detail (s = one entry of the splice list); spliceFigure(s, W): the Report's static figure (HTML string)
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

  /* ================= #8 Constructibility: overhang bracket (exterior girder) =================
     As the CAD drawing (ui/gfxa.js ohGraphic): the girder's top flange and web (broken), the overhang slab from the girder centre line, the bracket (strut, hanger,
     deck form), a, h_b, w_OH, t_OH dimensioned, the two loads. Decision (DETC, pending engineer review): the values are read from the bracket inputs the tab
     uses (R.F.oh.p: a, h_b, w_OH, t_OH, P_fm and γ_DC). SBBDXF (2026-11-10, engineer decision): the CAD drawing (Download DXF) reads the same inputs R.F.oh.p
     (it read R.F.oh.a ..., absent, and only ever drew its "inputs above" note). */
  function bracketModel(P, gi, oh) {
    const sg = P.girders[gi].segments[0], p = (oh && oh.p) || {}, a = +p.a, hb = +p.hb, wOH = +p.wOH, tOH = +p.tOH;
    if (![a, hb, wOH, tOH].every(fin)) return null;
    return { sg, a, hb, wOH, tOH, ys: 0 + (+((P.deck || {}).haunch) || 0), Dw: Math.min(+sg.D, 40), gdc: ((p.gam || {}).dc), Pfm: p.Pfm };
  }
  function bracketSvg(m, W) {
    const K = VK(), S = K.scene(), sg = m.sg, ys = m.ys, nar = W < 560;
    S.rect(-sg.topB / 2, -sg.topT, sg.topB / 2, 0, 'dt-st'); S.rect(-sg.tw / 2, -sg.topT - m.Dw, sg.tw / 2, -sg.topT, 'dt-st');
    const yb = -sg.topT - m.Dw, z = Math.max(1.2, sg.tw * 1.5); S.pline([[-sg.tw / 2 - z, yb + 0.6], [-sg.tw / 4, yb - 0.6], [sg.tw / 4, yb + 0.6], [sg.tw / 2 + z, yb - 0.6]], 'dt-ol');   // the web, broken
    S.line(0, -sg.topT - m.Dw - 4, 0, ys + m.tOH + 4, 'dt-cl');
    S.rect(0, ys, m.wOH, ys + m.tOH, 'dt-cc');
    S.line(0, -m.hb, m.a, ys, 'dt-mem'); S.line(m.a, ys - 0.06 * m.hb, m.a, ys, 'dt-mem'); S.line(0, ys, m.a, ys, 'dt-mem'); S.line(0, -m.hb, 0, 0, 'dt-mem');
    S.dot(0, -m.hb, 3, 'dt-wh', { fill: '#334155' }); S.dot(m.a, ys, 3, 'dt-wh', { fill: '#334155' });
    S.dimH(0, m.a, -m.hb, -26, `a = ${nf(m.a, 1)} in`, { yr: -m.hb });
    S.dimV(-m.hb, ys, -sg.topB / 2, -30, `h_b = ${nf(m.hb + ys, 1)} in`, { xr: 0 });
    S.dimH(0, m.wOH, ys + m.tOH, 18, `w_OH = ${nf(m.wOH, 1)} in`);
    S.dimV(ys, ys + m.tOH, m.wOH, 22, `t_OH = ${nf(m.tOH, 1)} in`);
    const yt = ys + m.tOH, q = m.wOH * 0.28; S.arrow(q, yt, 58); S.arrow(m.wOH - 0.02 * m.wOH, yt, 96);
    S.text(q, yt, `Deck and forms (γ_DC ${nf(m.gdc, 2)})`, { dx: -6, dy: -48, a: 'end', sz: 11 });
    const f1 = `Finishing machine ${nf(m.Pfm, 1)} kip;`, f2 = 'screed, rail, walkway, constr. LL';
    if (nar) { S.text(m.wOH, yt, f1, { dx: -6, dy: -100, a: 'end', sz: 11 }); S.text(m.wOH, yt, f2, { dx: -6, dy: -86, a: 'end', sz: 11 }); }
    else S.text(m.wOH, yt, `${f1} ${f2}`, { dx: 6, dy: -88, sz: 11 });
    S.callout(m.a * 0.5, -m.hb * 0.5 + ys * 0.5, nar ? 34 : 60, 18, ['Bracket (schematic,', 'contractor-designed)'], { sz: 10.5, cls: 'dt-m' });
    S.region(0, -m.hb, m.a, ys, 'Bracket: horizontal projection a, vertical projection h_b (the tab\'s inputs)'.replace(/_/g, ''));
    const R = S.render({ W, maxH: nar ? 360 : 340, label: 'Overhang bracket sketch, exterior girder' });
    return { svg: R.svg, nar };
  }
  function bracket(slot, o) {
    const K = VK(); let m = null; try { m = bracketModel(o.P, o.gi, o.oh); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">Overhang brackets: exterior girder, project source only (inputs above).</p>'; return null; }
    return K.detCard(slot, { id: 'dt-oh', title: 'Overhang bracket (exterior girder), schematic', sub: 'Dimensions are the overhang bracket inputs of the tab; bracket members schematic (contractor-designed)', dxf: o.dxf,
      draw: W => { const q = bracketSvg(m, W); return { html: q.svg, nar: q.nar }; },
      notes: [sb('Dimensions from the overhang-bracket inputs (a, h_b, w_OH, t_OH); loads are the tab\'s OH1–OH5 inputs. Schematic. The slab is drawn from the girder centre line; the web is shown broken.')] });
  }

  /* ---------- shared pieces of the detail drawings of engine/tabgraphics-b.js (the same formats: sizes to 1/16 in, toFixed digits) ---------- */
  const frac = v => X_().frac(v), dIn = v => `${frac(v)} in`, f1 = v => (+v).toFixed(1), f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  const rcls = r => (Number.isNaN(r) || r === Infinity ? 'ng' : !fin(r) ? 'na' : r > 1 + 1e-9 ? 'ng' : r >= 0.9 ? 'hi' : 'ok');   // engine/tabgraphics-b.js rcls: the tables' classes
  const RW = { ok: 'below 0.90', hi: '0.90 to 1.00', ng: 'above 1.00 or NG', na: 'no ratio' };
  const legend = () => `<p class="vk-cap" style="margin-top:4px"><span style="display:inline-block;width:10px;height:10px;background:#DCFCE7;border:1px solid #15803D;vertical-align:-1px"></span> ratio below 0.90 &nbsp;<span style="display:inline-block;width:10px;height:10px;background:#FEF3C7;border:1px solid #B45309;vertical-align:-1px"></span> 0.90 to 1.00 &nbsp;<span style="display:inline-block;width:10px;height:10px;background:#FEE2E2;border:1px solid #B91C1C;vertical-align:-1px"></span> above 1.00 or NG (the classes of the tables)</p>`;
  const zz = (S, x, y0, y1, amp, cls) => { const n = 6, p = []; for (let i = 0; i <= n; i++) p.push([x + (i % 2 ? 0.5 : -0.5) * amp * (i === 0 || i === n ? 0 : 1), y0 + (y1 - y0) * i / n]); S.pline(p, cls || 'dt-ol'); };   // a break line (as brkV)

  /* ================= #10 Shear & stiffeners: the transverse stiffener (or connection plate) at one location =================
     As engine/tabgraphics-b.js shearDetail (the same row: opt.i, else the governing row): A the two web panels beside it in elevation, to scale, each filled by its
     V_u/(φ_v V_n); B the plan section through the plate, enlarged k times in the same drawing (the CAD drawing's k). */
  function stiffModel(R, opt) {
    const rows = (R.TS && !R.TS.errors.length && R.TS.rows) || []; let i = opt.i != null && rows[opt.i] ? opt.i : R.tsGov ? R.tsGov.i : 0; if (!(i >= 0) || !rows[i]) i = 0;
    const r = rows[i]; if (!r) return null; const t = r.t;
    return { r, i, t, Dw: r.D, tw: r.tw, tfc: r.tfc || 0.75, tft: r.tft || 0.75, nm: `${r.type === 'B' ? 'CP' : 'TS'}${i + 1}`, cp: t.role === 'cp', sides: +t.sides === 2 ? 2 : 1,
      k: Math.max(1, Math.min(8, Math.round(0.45 * r.D / (2 * t.bt + r.tw)))), pan: [[0, r.do1, r.p1], [r.do1, r.do1 + r.do2, r.p2]].map(([a, b, q]) => ({ a, b, q, rr: q && q.phVn > 0 ? q.Vu / q.phVn : NaN })) };
  }
  function stiffSvg(m, W) {
    const K = VK(), S = K.scene(), nar = W < 640, r = m.r, t = m.t, Dw = m.Dw, x1 = r.do1, x2 = r.do1 + r.do2, e0 = -8, e1 = x2 + 8;
    // A: the panels (ratio fill), flanges, neighbours dashed, this stiffener solid
    m.pan.forEach((P, k) => { const c = rcls(P.rr); S.rect(P.a, 0, P.b, Dw, 'dt-' + c); const cx = (P.a + P.b) / 2;
      [`Panel ${k + 1}${P.q && P.q.end ? ' (end panel)' : ''}`, `d_o/D = ${f2((P.b - P.a) / Dw)}`, fin(P.rr) ? `V_u/φ_v V_n = ${f3(P.rr)}` : ''].filter(Boolean).forEach((q, j) => S.text(cx, Dw * 0.62, q, { a: 'middle', dy: j * (nar ? 13 : 15), sz: nar ? 9.5 : 11, w: j === 2 }));
      S.region(P.a, 0, P.b, Dw, `Panel ${k + 1}: d_o/D = ${f2((P.b - P.a) / Dw)}${fin(P.rr) ? `, Vu/(φv Vn) = ${f3(P.rr)} (${RW[c]})` : ''}`); });
    S.rect(e0, Dw, e1, Dw + m.tfc, 'dt-st'); S.rect(e0, -m.tft, e1, 0, 'dt-st'); zz(S, e0, -m.tft - 1, Dw + m.tfc + 1, 3); zz(S, e1, -m.tft - 1, Dw + m.tfc + 1, 3);
    [0, x2].forEach(x => S.rect(x - t.tp / 2, 0, x + t.tp / 2, Dw, 'dt-hid'));
    const yb = m.cp ? 0 : t.gap; S.rect(x1 - t.tp / 2, yb, x1 + t.tp / 2, Dw, 'dt-st', { sw: 0 }); S.rect(x1 - Math.max(t.tp, 0.6) / 2, yb, x1 + Math.max(t.tp, 0.6) / 2, Dw, 'dt-st');
    S.text(x1, Dw, m.nm, { dx: 4, dy: 14, sz: nar ? 10 : 11, w: true });
    S.dimH(0, x1, Dw + m.tfc, 18, `d_o1 = ${f2(r.do1)} in (${f2(r.do1 / Dw)}D)`); S.dimH(x1, x2, Dw + m.tfc, nar ? 36 : 18, `d_o2 = ${f2(r.do2)} in (${f2(r.do2 / Dw)}D)`);
    S.dimV(0, Dw, e0, -16, `D = ${dIn(Dw)}`);
    if (!m.cp && t.gap > 0) S.callout(x1 + t.tp / 2, t.gap, 34, -14, `g = ${dIn(t.gap)} (weld cutoff)`, { sz: 10.5 });
    S.text(e0, Dw + m.tfc, `A · ${r.name} (${m.nm}, type ${r.type}): web panels, elevation to scale`, { dy: nar ? -62 : -44, sz: 12, w: true, up: true, maxw: W - 20 });
    // B: plan section through the plate, enlarged k times (sizes in true inches), beside A (or under it on a phone)
    const k = m.k, sv = v => v * k, fb = Math.max(r.bfc || 0, 2 * t.bt + m.tw + 2) * k, half = 0.55 * fb, bx = nar ? (e0 + e1) / 2 : e1 + 70, by = nar ? -m.tft - 30 - fb / 2 : Dw * 0.5;
    S.rect(bx - half, by - sv(m.tw) / 2, bx + half, by + sv(m.tw) / 2, 'dt-st'); S.rect(bx - half, by - fb / 2, bx + half, by + fb / 2, 'dt-hid');
    [1, -1].slice(0, m.sides).forEach(sg => { const ya = sg > 0 ? by + sv(m.tw) / 2 : by - sv(m.tw) / 2 - sv(t.bt), yz = ya + sv(t.bt); S.rect(bx - sv(t.tp) / 2, ya, bx + sv(t.tp) / 2, yz, 'dt-st', { fill: '#475569' });
      [-1, 1].forEach(sx => { const x = bx + sx * sv(t.tp) / 2, y = sg > 0 ? by + sv(m.tw) / 2 : by - sv(m.tw) / 2, w = sv(t.w); S.poly([[x, y], [x + sx * w, y], [x, y + sg * w]], 'dt-weld'); }); });
    S.dimV(by + sv(m.tw) / 2, by + sv(m.tw) / 2 + sv(t.bt), bx + half, 16, `b_t = ${dIn(t.bt)}`, { xr: bx + sv(t.tp) / 2 });
    S.callout(bx - sv(t.tp) / 2, by + sv(m.tw) / 2 + sv(t.bt) * 0.7, nar ? -40 : -34, nar ? 10 : -2, `PL ${frac(t.bt)} × ${frac(t.tp)} (t_p = ${dIn(t.tp)})`, { sz: 10.5 });
    S.callout(bx + half * 0.7, by - sv(m.tw) / 2, 18, 22, `Web t_w = ${dIn(m.tw)}`, { sz: 10.5 });
    S.text(bx - half, by + fb / 2, `B · Plan section (enlarged ×${k})`, { dy: -14, sz: 12, w: true, up: true, maxw: W - 20 });
    S.region(bx - sv(t.tp) / 2, by - fb / 2, bx + sv(t.tp) / 2, by + fb / 2, `${m.nm}: PL ${frac(t.bt)} × ${frac(t.tp)}, ${m.sides === 2 ? 'pair' : 'one plate'}; fillet weld ${dIn(t.w)} to the web`);
    return { svg: S.render({ W, maxH: nar ? 640 : 380, label: `Transverse stiffener ${m.nm}: web panels and plan section` }).svg, nar };
  }
  function stiff(slot, o) {
    const K = VK(); let m = null; try { m = stiffModel(o.R, o.opt || {}); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">No transverse stiffener or connection plate in the layout.</p>'; return null; }
    const t = m.t, r = m.r;
    const n1 = `${m.cp ? 'Connection plate, welded to both flanges' : `Intermediate stiffener: tight fit at the compression flange, web weld stops g = ${dIn(t.gap)} short of the tension flange`}; ${m.sides === 2 ? 'pair' : 'one plate'} ${frac(t.bt)} × ${frac(t.tp)}; web ${dIn(m.Dw)} × ${dIn(m.tw)}; panels filled by V_u/(φ_v V_n) of TS4 (6.10.9.3); dashed: the neighbouring stiffeners. I_t = ${f2(r.It)} in⁴, I_req = ${f2(r.Ireq)} in⁴.`;
    const n2 = `Fillet weld ${dIn(t.w)} to the web, both sides of the plate${m.cp ? `; ${dIn(t.wf)} to the flanges` : ''}; flange outline dashed.`;
    return K.detCard(slot, { id: 'dt-ts', title: `Transverse stiffener ${m.nm}`, sub: `${esc(r.name)} · type ${esc(r.type)}`, dxf: o.dxf, file: o.file,
      draw: W => { const q = stiffSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) a panel or the plate to read its values.',
      cap: legend() + `<p class="vk-cap">${sb(n1)}</p><p class="vk-cap">B: ${sb(n2)}</p>` });
  }

  /* ================= #11 Shear & stiffeners: the bearing stiffener at one bearing =================
     As engine/tabgraphics-b.js shearBearing (the same row: opt.i, else the governing row): C the girder section at the bearing, to scale, the plates filled by the
     row's largest ratio; D the effective column of 6.10.11.2.4 in plan at mid-depth, enlarged k times in the same drawing, filled by R_u/P_r. */
  function bearModel(R, opt) {
    const rows = R.BS.rows || []; let i = opt.i != null && rows[opt.i] ? opt.i : R.bsGov ? R.bsGov.i : 0; if (!(i >= 0) || !rows[i]) i = 0;
    const r = rows[i]; if (!r) return null;
    const t = R.BS.types[r.type], Dw = R.D, sp0 = R.gm.sup || [], xs0 = R.gm.dem && sp0[i] != null ? Math.min(Math.max(sp0[i], 0.01), sp0[sp0.length - 1] - 0.01) : null;
    const tft = xs0 != null && R.gm.zAt(xs0).topT > 0 ? R.gm.zAt(xs0).topT : 0.75, h = Math.max(1.4, Math.min(4, (Dw + 6) / 30));
    const grp = (t.np - 1) * t.sp + t.tp, L0 = -(r.strip9 + grp / 2), L1 = grp / 2 + r.sEnd, k = Math.max(1, Math.min(8, Math.round(30 * h / Math.max(1, L1 - L0 + 12))));
    return { r, i, t, Dw, tw: r.tw, tfb: r.tfb || 1, bfb: r.bfb, bft: r.bft || r.bfb, tft, c: t.c || 0, nm: `BS${i + 1}`, rr: Math.max(r.Ru / r.Rsb, r.Ru / r.Pr, r.Ru / r.Rweld), cr: r.Ru / r.Pr, grp, L0, L1, k };
  }
  function bearSvg(m, W) {
    const K = VK(), S = K.scene(), nar = W < 640, r = m.r, t = m.t, Dw = m.Dw, tw = m.tw, c = m.c, cl = 'dt-' + rcls(m.rr), wmax = Math.max(m.bft, m.bfb);
    // C: the section at the bearing
    S.rect(-m.bft / 2, Dw, m.bft / 2, Dw + m.tft, 'dt-st'); S.rect(-tw / 2, 0, tw / 2, Dw, 'dt-st'); S.rect(-m.bfb / 2, -m.tfb, m.bfb / 2, 0, 'dt-st');
    S.rect(-m.bfb / 2 - 1, -m.tfb - 3, m.bfb / 2 + 1, -m.tfb, 'dt-brg');
    [1, -1].forEach(sg => { const xi = sg * tw / 2, xo = sg * (tw / 2 + t.bt); S.poly([[xi, c], [xi + sg * c, 0], [xo, 0], [xo, Dw], [xi + sg * c, Dw], [xi, Dw - c]], cl, { sw: 1 }); });
    S.region(-tw / 2 - t.bt, 0, tw / 2 + t.bt, Dw, `${m.nm}: largest ratio ${f3(m.rr)} (${RW[rcls(m.rr)]}): Ru = ${f1(r.Ru)} kip; (Rsb)r = ${f1(r.Rsb)}; Pr = ${f1(r.Pr)}; Rr welds = ${f1(r.Rweld)} kip`);
    S.dimH(tw / 2, tw / 2 + t.bt, Dw + m.tft, 18, `b_t = ${dIn(t.bt)}`, { yr: Dw });
    S.dimV(0, Dw, -wmax / 2, -16, `D = ${dIn(Dw)}`, { xr: -tw / 2 - t.bt });
    S.callout(m.bfb / 2 + 1, -m.tfb - 1.5, 22, 8, 'Bearing', { sz: 10.5 });
    S.text(-wmax / 2, Dw + m.tft, `C · ${r.name} (${m.nm}, type ${r.type}): section at the bearing, to scale`, { dy: -40, sz: 12, w: true, up: true, maxw: nar ? W - 20 : W * 0.45 });
    // D: the effective column in plan at mid-depth, enlarged k times
    const k = m.k, sv = v => v * k, L0 = m.L0, L1 = m.L1, grp = m.grp, ox = nar ? -wmax / 2 : wmax / 2 + 40, oy = nar ? -m.tfb - 3 - 40 - sv(t.bt + tw / 2) : Dw * 0.55, X = v => ox + sv(v - (L0 - 6)), Y = v => oy + sv(v);
    const xmax = r.ed > 0 ? grp / 2 - t.tp / 2 + r.ed : L1 + 6, ccl = 'dt-' + rcls(m.cr);
    S.rect(X(L0), Y(-tw / 2), X(L1), Y(tw / 2), ccl, { sw: 1 });
    S.line(X(L0 - 6), Y(-tw / 2), X(xmax), Y(-tw / 2), 'dt-ol'); S.line(X(L0 - 6), Y(tw / 2), X(xmax), Y(tw / 2), 'dt-ol'); zz(S, X(L0 - 6), Y(-tw / 2) - 4, Y(tw / 2) + 4, 3);
    if (r.ed > 0) { S.line(X(xmax), Y(-t.bt - tw / 2 - 1), X(xmax), Y(t.bt + tw / 2 + 1), 'dt-ol', { sw: 1.6 }); S.text(X(xmax), Y(t.bt + tw / 2), 'Girder end', { dx: 5, sz: 10.5, cls: 'dt-m' }); }
    else zz(S, X(xmax), Y(-tw / 2) - 4, Y(tw / 2) + 4, 3);
    for (let q = 0; q < t.np; q++) { const xc = -grp / 2 + t.tp / 2 + q * t.sp; [1, -1].forEach(sg => { const ya = sg > 0 ? tw / 2 : -tw / 2 - t.bt; S.rect(X(xc - t.tp / 2), Y(ya), X(xc + t.tp / 2), Y(ya + t.bt), ccl, { sw: 1 }); }); }
    S.region(X(L0), Y(-tw / 2 - t.bt), X(L1), Y(tw / 2 + t.bt), `Effective column (6.10.11.2.4): ${f2(r.Ltot)} in, A = ${f2(r.A)} in²; Ru/Pr = ${f3(m.cr)} (${RW[rcls(m.cr)]})`);
    const yd = Y(-tw / 2 - t.bt);
    S.dimH(X(L0), X(-grp / 2), yd, -20, `9t_w = ${f2(r.strip9)} in`, { yr: Y(-tw / 2) });
    if (t.np > 1) S.dimH(X(-grp / 2 + t.tp / 2), X(-grp / 2 + t.tp / 2 + (t.np - 1) * t.sp), yd, -42, `${t.np - 1} @ ${f2(t.sp)} in`, { yr: Y(-tw / 2 - t.bt) });
    S.dimH(X(grp / 2), X(L1), yd, nar && t.np < 2 ? -38 : -20, `${f2(r.sEnd)} in`, { yr: Y(-tw / 2) });
    S.dimH(X(L0), X(L1), yd, t.np > 1 ? -64 : nar ? -58 : -44, `Effective column ${f2(r.Ltot)} in, A = ${f2(r.A)} in^2`, { yr: Y(-tw / 2) });
    S.text(X(L0 - 6), Y(t.bt + tw / 2), `D · Effective column, plan at mid-depth (enlarged ×${k})`, { dy: -16, sz: 12, w: true, up: true, maxw: nar ? W - 20 : W * 0.45 });
    return { svg: S.render({ W, maxH: nar ? 640 : 380, label: `Bearing stiffener ${m.nm}: section at the bearing and the effective column` }).svg, nar };
  }
  function bear(slot, o) {
    const K = VK(); let m = null; try { m = bearModel(o.R, o.opt || {}); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">No bearing stiffener.</p>'; return null; }
    const t = m.t, r = m.r, conn = ({ milled: 'milled to bear on the bottom flange', cjp: 'CJP groove weld to the bottom flange', fillet: 'fillet welds to the bottom flange (not permitted)' })[t.conn] || '';
    const n1 = `${t.np} pair${t.np > 1 ? 's' : ''} of plates ${frac(t.bt)} × ${frac(t.tp)}, one each side of the web; clip ${dIn(m.c)} at the flange-to-web welds; fillet welds ${dIn(t.w)} to the web; ${conn}; web ${dIn(m.tw)}; bottom flange ${frac(m.bfb)} × ${frac(m.tfb)}.`;
    const n2 = `R_u = ${f1(r.Ru)} kip; bearing (R_sb)_r = ${f1(r.Rsb)}; column P_r = ${f1(r.Pr)}; welds R_r = ${f1(r.Rweld)} kip; largest ratio ${f3(m.rr)} (plates filled in its colour).`;
    const n3 = `D: filled, the effective column of 6.10.11.2.4 (plates and web strips), in the colour of R_u/P_r = ${f3(m.cr)}; web strips from the result (9t_w each side, s_end to the girder end).`;
    return K.detCard(slot, { id: 'dt-bs', title: `Bearing stiffener ${m.nm}`, sub: `${esc(r.name)} · type ${esc(r.type)}`, dxf: o.dxf, file: o.file,
      draw: W => { const q = bearSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) the plates or the effective column to read the values.',
      cap: legend() + `<p class="vk-cap">C: ${sb(n1)}</p><p class="vk-cap">${sb(n2)}</p><p class="vk-cap">${sb(n3)}</p>` });
  }

  /* ================= #14 Cross-frames: the cross-frame elevation =================
     As engine/tabgraphics-b.js crossframe (B = SBDFramingUI.build result): the bay between two girders looking along them, the members of the truss model at their
     work points, each numbered; the members of the governing check's group (top chord, bottom chord or diagonals) highlighted; S and h dimensioned (the CAD
     drawing's measured text); the members table (largest factored forces of the combinations) as a table under the figure. */
  function cfModel(B, opt) {
    const R = B.R, N = R.N; if (!N || !R.frames) return null;
    let gov = null; (B.C || []).forEach(c => c.items.forEach(it => { if (fin(it.r) && (it.st === 'pass' || it.st === 'fail') && (!gov || it.r > gov.it.r)) gov = { c, it }; }));
    const mg = gov && /^cf\.(top|bot|diag)\b/.exec(gov.it.step || ''), grp = mg ? mg[1] : null, I = B.I.p;
    const rows = R.frames.map((e, i) => { const mx = (R.combos || []).reduce((m, c) => ({ T: Math.max(m.T, c.f[i].T), C: Math.max(m.C, c.f[i].Cc) }), { T: 0, C: 0 });
      return { i, e, on: grp === e.k, sec: (R.mem && R.mem[e.k] && R.mem[e.k].name) || '', L: f1(e.L), T: f1(mx.T), C: f1(mx.C) }; });
    return { R, N, I, S: I.S, dg: I.dg, hw: I.h, gov, grp, rows, line: B.line || 0, dia: !!opt.dia };
  }
  function cfSvg(m, W) {
    const K = VK(), Sc = K.scene(), nar = W < 560, S = m.S, dg = m.dg, hw = m.hw, y0 = (hw - dg) / 2, fl = Math.min(8, S * 0.07), nx = n => m.N[n][0], ny = n => m.N[n][1];
    // girders (schematic I-shapes at the work-point depth's girder depth d), deck
    [0, S].forEach((x, k) => { Sc.rect(x - fl, y0 + dg, x + fl, y0 + dg + 1.1, 'dt-st'); Sc.rect(x - fl, y0 - 1.1, x + fl, y0, 'dt-st'); Sc.rect(x - 0.35, y0, x + 0.35, y0 + dg, 'dt-st');
      Sc.text(x, y0 - 1.1, `G${m.line + k + 1}`, { dy: 18, a: 'middle', sz: 12, w: true }); });
    Sc.rect(-16, y0 + dg + 1.1, S + 16, y0 + dg + 1.1 + Math.max(3, hw * 0.08), 'dt-cc');
    // the members, their numbers beside them (as the CAD drawing: chords above / below, diagonals at 0.27 of their length on the normal)
    m.rows.forEach(q => { const e = q.e, a = [nx(e.a), ny(e.a)], b = [nx(e.b), ny(e.b)]; Sc.line(a[0], a[1], b[0], b[1], q.on ? 'dt-gov' : 'dt-mem', q.on ? { sw: 3.2 } : {}); });
    m.rows.forEach(q => { const e = q.e, a = [nx(e.a), ny(e.a)], b = [nx(e.b), ny(e.b)], t = e.k === 'diag' ? 0.27 : 0.5, p = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], side = e.k === 'top' ? 1 : e.k === 'bot' ? -1 : 0;
      const ln2 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, nrm = [(b[1] - a[1]) / ln2, -(b[0] - a[0]) / ln2], sg = nrm[0] >= 0 ? 1 : -1, dx = side ? 0 : sg * nrm[0] * 16, dy = side ? -side * 14 : -sg * nrm[1] * 16;
      Sc.raw(T => { const px = T.X(p[0]) + dx, py = T.Y(p[1]) + dy; return `<circle cx="${r2(px)}" cy="${r2(py)}" r="8.5" class="${q.on ? 'dt-band' : 'dt-pl'}" fill="${q.on ? '#2563EB' : '#fff'}" stroke="${q.on ? 'none' : '#475569'}" stroke-width="1"/>${tx(px, py + 4, String(q.i + 1), { a: 'middle', sz: 11, w: true, cls: q.on ? 'dt-w' : 'dt-t' })}`
        + `<rect x="${r2(px - 11)}" y="${r2(py - 11)}" width="22" height="22" class="dt-reg" fill="transparent" data-dtr="${esc(`${q.i + 1} ${q.e.lbl} ${q.sec}: L ${q.L} in, T ${q.T} kip, C ${q.C} kip${q.on ? ' (governing group)' : ''}`)}"/>`; },
        T => { const px = T.X(p[0]) + dx, py = T.Y(p[1]) + dy; return [[px - 10, py - 10], [px + 10, py + 10]]; }); });
    Sc.dimH(0, S, y0 - 1.1, -38, `S = ${X_().fmtFtIn(S)}`, { yr: y0 - 1.1 });
    Sc.dimV(0, hw, -fl, -18, `h = ${X_().fmtFtIn(hw)}`, { xr: 0 });
    return { svg: Sc.render({ W, maxH: nar ? 300 : 340, label: 'Cross-frame elevation with the members numbered' }).svg, nar };
  }
  function crossframe(slot, o) {
    const K = VK(); let m = null; try { m = cfModel(o.B, o.opt || {}); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">No cross-frame model.</p>'; return null; }
    const g = m.gov, gl = g ? `Governing check: ${g.c.id} ${g.it.loc}, ratio ${f3(g.it.r)}${m.grp ? ' (members highlighted)' : ' (not a member check)'}` : 'No governing check';
    const tbl = `<div class="vk-tblw"><table class="vk-tbl"><caption style="text-align:left;font-size:9pt;color:var(--vk-mut);caption-side:top;padding:0 0 2px">Members (largest factored forces of the combinations)</caption><thead><tr><th>No.</th><th>Member</th><th>Section</th><th>L (in)</th><th>T (kip)</th><th>C (kip)</th><th></th></tr></thead><tbody>`
      + m.rows.map(q => `<tr${q.on ? ' class="gov"' : ''}><td>${q.i + 1}</td><td>${esc(q.e.lbl)}</td><td>${esc(q.sec)}</td><td class="n">${q.L}</td><td class="n">${q.T}</td><td class="n">${q.C}</td><td>${q.on ? 'Governs' : ''}</td></tr>`).join('') + '</tbody></table></div>';
    return K.detCard(slot, { id: 'dt-cf', title: `Cross-frame elevation, type ${esc(m.I.type)}${m.dia ? ' (diaphragm in use: see the diaphragm checks)' : ''}`, sub: sb(`Looking along the girders; work-point depth h = ${f2(m.hw)} in, girder depth d = ${f2(m.dg)} in, S = ${f2(m.S)} in.`),
      dxf: o.dxf, file: o.file, top: `<p class="vk-cap" style="margin:0 0 6px;${g && m.grp ? 'color:var(--vk-acc);font-weight:600' : ''}">${sb(gl)}</p>`,
      draw: W => { const q = cfSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) a member number to read its forces.', tbl,
      notes: ['Members at their work points (the truss model of the Cross-frames tab); girders and deck schematic. Highlighted: the members of the governing check\'s group.'] });
  }

  /* ================= #16 Welds: the flange-to-web fillet weld size detail =================
     As engine/tabgraphics-b.js weldDetail (location opt.i, else the one with the largest ratio): the T joint of each flange with the fillet weld w on both sides of the web,
     drawn 6 times larger than the plates (the CAD drawing's SC), the flange broken; the minimum size of Table 6.13.3.4-1, the demand v_u and the resistance R_r. */
  function weldModel(B, opt) {
    const R = B.R; let r = R.fw.find(q => q.i === opt.i);
    if (!r) { let best = null; B.C.forEach(c => c.items.forEach(it => { const mm = /^wf(\d+)\./.exec(it.step || ''); if (mm && typeof it.r === 'number' && (!best || it.r > best.r)) best = { r: it.r, i: +mm[1] }; })); r = R.fw.find(q => q.i === (best ? best.i : 0)) || R.fw[0]; }
    return r ? { r } : null;
  }
  function weldSvg(m, W) {
    const K = VK(), S = K.scene(), nar = W < 600, r = m.r, SC = 6;
    const part = (x0, y0, flb, flt, wmin, vu, tag, down) => {   // down: the flange below the web (bottom flange)
      const fw = 44, cx = x0 + fw / 2, tf = flt * SC, tw = r.tw * SC, w = r.w * SC, dw = 26, sg = down ? -1 : 1, yF0 = down ? y0 - tf : y0, yF1 = down ? y0 : y0 + tf;
      S.rect(x0, yF0, x0 + fw, yF1, 'dt-st'); zz(S, x0, yF0 - 1.5, yF1 + 1.5, 1.6); zz(S, x0 + fw, yF0 - 1.5, yF1 + 1.5, 1.6);
      S.rect(cx - tw / 2, down ? y0 : y0 - dw, cx + tw / 2, down ? y0 + dw : y0, 'dt-st');
      [-1, 1].forEach(sx => { const x = cx + sx * tw / 2; S.poly([[x, y0], [x + sx * w, y0], [x, y0 - sg * w]], 'dt-weld'); });
      S.region(cx - tw / 2 - w, Math.min(y0, y0 - sg * w), cx + tw / 2 + w, Math.max(y0, y0 - sg * w), `Fillet weld w = ${dIn(r.w)} each side; minimum ${dIn(wmin)} (Table 6.13.3.4-1)`);
      const yt = down ? yF0 : yF1, yb = down ? y0 + dw : y0 - dw;
      S.dimH(x0, x0 + fw, yt, down ? -18 : 18, `b_f = ${dIn(flb)} (broken)`);
      S.dimV(yF0, yF1, x0, -16, `t_f = ${dIn(flt)}`);
      S.dimH(cx - tw / 2, cx + tw / 2, yb, down ? 18 : -18, `t_w = ${dIn(r.tw)}`);
      S.callout(cx + tw / 2 + w * 0.4, y0 - sg * w * 0.4, 30, sg * 22, `w = ${dIn(r.w)}`, { sz: 11 });
      const yl = down ? yF0 : yb, dy0 = down ? 36 : 40, tl = [tag, `Min. size (Table 6.13.3.4-1): ${dIn(wmin)};`, `used w = ${dIn(r.w)}`, `v_u = ${f3(vu)} kip/in; R_r = ${f3(r.Rw)} kip/in`];
      if (!down) S.text(x0 - 4, yF1, tag, { dy: -40, sz: 12, w: true, up: true, maxw: nar ? W - 20 : W * 0.45 });
      tl.slice(down ? 0 : 1).forEach((q, i) => S.text(x0 - 4, yl, q, { dy: dy0 + i * 16, sz: i === 0 && down ? 12 : 11, w: i === 0 && down }));
    };
    part(0, 0, r.topB, r.topT, r.wminT, r.vuT, `Top flange-to-web weld, ${r.name}`, false);
    if (nar) part(0, -110, r.botB, r.botT, r.wminB, r.vuB, 'Bottom flange-to-web weld', true); else part(80, -20, r.botB, r.botT, r.wminB, r.vuB, 'Bottom flange-to-web weld', true);
    return { svg: S.render({ W, maxH: nar ? 720 : 360, label: 'Flange-to-web fillet weld size detail' }).svg, nar };
  }
  function weld(slot, o) {
    const K = VK(); let m = null; try { m = weldModel(o.B, o.opt || {}); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">No flange-to-web weld location.</p>'; return null; }
    return K.detCard(slot, { id: 'dt-wd', title: 'Weld size detail', sub: `${esc(m.r.name)} · flange-to-web fillet welds`, dxf: o.dxf, file: o.file,
      draw: W => { const q = weldSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) a weld to read its size.',
      notes: ['Two fillet welds (one each side of the web) per flange; the sketch is drawn 6 times larger than the plates (sizes as dimensioned), not to scale along the web.'] });
  }

  /* ================= #18 Field splices: the splice detail (also the Report's figure) =================
     As engine/tabgraphics-b.js splice (s = one entry of the splice list): the web splice in elevation, the top and bottom flange splices in plan, to scale in inches
     (one scale for the three views), bolts at their gauges and pitches; the plate and bolt group of the governing strength check (strGov, as the tab) highlighted. */
  function spliceGroupOf(gov) { if (!gov) return null; const id = gov.c.id, mm = /^(TF|BF|WS)/.exec(id); if (!mm) return null; const loc = gov.it.loc || ''; return { g: mm[1] === 'TF' ? 'top' : mm[1] === 'BF' ? 'bot' : 'web', inner: /inner/i.test(loc), outer: /outer/i.test(loc), id, loc, r: gov.it.r }; }
  function spliceModel(s, opt) {
    const R = s && s.R; if (!R || (R.errors && R.errors.length) || !R.fl) return null; opt = opt || {};
    const TX = window.SBDTabGfxB, gov = spliceGroupOf(opt.gov || (TX && TX.strGov ? TX.strGov(s.CK) : null)), W = R.web;
    return { s, R, gov, W, gap: R.gap, rb: (R.bolt.dh || R.bolt.d + 0.0625) / 2, Lw: 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp) + R.gap, gr: (s.p && s.p.bolts && s.p.bolts.gr) || '' };
  }
  function spliceSvg(m, W) {
    const K = VK(), S = K.scene(), nar = W < 640, R = m.R, Wb = m.W, gap = m.gap, rb = m.rb, hl = g => m.gov && m.gov.g === g, Lf = Math.max(R.fl.top.Lpl, R.fl.bot.Lpl, m.Lw), half = Lf / 2 + 2;
    const mw = nar ? W - 24 : W * 0.3, fsz = nar ? 10.5 : 11;
    const GE = { fill: '#E2E8F0', stroke: '#94A3B8', sw: 0.8 }, ends = (cx, y0, y1) => { S.rect(cx - gap / 2 - half, y0, cx - gap / 2, y1, 'dt-pl', GE); S.rect(cx + gap / 2, y0, cx + gap / 2 + half, y1, 'dt-pl', GE); };   // the girder ends: light (the splice plates are drawn over them)
    const bolt = (x, y, on) => S.circ(x, y, rb, on ? 'dt-band' : 'dt-bolt');
    // web splice, elevation (centre of the joint at x = 0, bottom of the web at y = 0)
    const D0 = R.D, onW = hl('web'), py = (D0 - Wb.hw) / 2;
    ends(0, 0, D0); S.rect(-m.Lw / 2, py, m.Lw / 2, py + Wb.hw, onW ? 'dt-govf' : 'dt-pl', onW ? {} : { fill: '#94A3B8' });
    Wb.bolts.forEach(b => [-1, 1].forEach(sd => bolt(sd * (gap / 2 + Wb.xbar) + b.dx, py + Wb.hw / 2 + b.dy, onW)));
    S.dimV(py, py + Wb.hw, -half, -14, `PL ${X_().fmtFtIn(Wb.hw)}`, { xr: -m.Lw / 2 });
    S.dimH(-m.Lw / 2, m.Lw / 2, 0, -16, X_().fmtFtIn(m.Lw), { yr: py });
    S.text(-half, D0, `Web splice (elevation)${onW ? ': governs' : ''}`, { dy: -10, sz: 12, w: true, cls: onW ? 'dt-g' : 'dt-t' });
    S.text(-half, 0, `2 PL ${frac(Wb.hw)} × ${frac(Wb.twp)}; ${Wb.nrw} rows × ${Wb.ncw} col. each side`, { dy: 40, sz: fsz, maxw: mw });
    S.region(-m.Lw / 2, py, m.Lw / 2, py + Wb.hw, `Web splice: 2 PL ${frac(Wb.hw)} × ${frac(Wb.twp)}; ${Wb.nrw} rows × ${Wb.ncw} col. each side${onW ? ' (governing group)' : ''}`);
    // the flange plans: beside the web (wide) or under it (phone); bottom plan first, top plan above it (as the CAD drawing)
    const plan = (F, key, cx, y0, tag) => {
      const fw = Math.max(F.bL, F.bR), cy = y0 + fw / 2, on = hl(key);
      S.rect(cx - gap / 2 - half, cy - F.bL / 2, cx - gap / 2, cy + F.bL / 2, 'dt-pl', GE); S.rect(cx + gap / 2, cy - F.bR / 2, cx + gap / 2 + half, cy + F.bR / 2, 'dt-pl', GE);
      S.rect(cx - F.Lpl / 2, cy - F.bo / 2, cx + F.Lpl / 2, cy + F.bo / 2, on && !m.gov.inner ? 'dt-govf' : 'dt-pl', on && !m.gov.inner ? {} : { fill: '#94A3B8' });
      if (F.inner) [-1, 1].forEach(sg => S.rect(cx - F.Lpl / 2, sg > 0 ? cy + F.yiI : cy - F.yiO, cx + F.Lpl / 2, sg > 0 ? cy + F.yiO : cy - F.yiI, on && m.gov.inner ? 'dt-gov' : 'dt-hid', on && m.gov.inner ? { dash: '4 3', sw: 1.6 } : {}));
      [-1, 1].forEach(sd => { for (let j = 0; j < F.nr; j++) for (let l = 0; l < F.nl; l++) [-1, 1].forEach(sy => bolt(cx + sd * (gap / 2 + F.ef + j * F.s), cy + sy * (F.g0 + l * F.g), on)); });
      S.line(cx - half - 3, cy, cx + half + 3, cy, 'dt-cl');
      S.dimH(cx - F.Lpl / 2, cx + F.Lpl / 2, y0, -16, X_().fmtFtIn(F.Lpl), { yr: cy - F.bo / 2 });
      S.text(cx - half, y0 + fw, tag + (on ? ': governs' : ''), { dy: -10, sz: 12, w: true, cls: on ? 'dt-g' : 'dt-t' });
      const nt = `Outer PL ${frac(F.bo)} × ${frac(F.to)}; ${F.nl} lines each side × ${F.nr} rows, ${dIn(F.s)} pitch${F.inner ? `; 2 inner PL ${frac(F.bi)} × ${frac(F.ti)}` : ''}`;
      if (nar) S.text(cx - half, y0, nt, { dy: 40, sz: fsz, maxw: mw }); else S.text(cx + half, cy, nt, { dx: 12, vc: true, sz: fsz, maxw: Math.max(160, W * 0.28) });
      S.region(cx - F.Lpl / 2, cy - F.bo / 2, cx + F.Lpl / 2, cy + F.bo / 2, `${tag}: ${nt}${on ? ' (governing group)' : ''}`);
      return fw; };
    const fwB = Math.max(R.fl.bot.bL, R.fl.bot.bR), fwT = Math.max(R.fl.top.bL, R.fl.top.bR);
    if (nar) { const yT = -40 - fwT - 30, yB = yT - 50 - fwB; plan(R.fl.top, 'top', 0, yT, 'Top flange splice (plan)'); plan(R.fl.bot, 'bot', 0, yB, 'Bottom flange splice (plan)'); }
    else { const dx = Lf + 12 + 48, yB0 = 4, yT0 = yB0 + fwB + 22; plan(R.fl.bot, 'bot', dx, yB0, 'Bottom flange splice (plan)'); plan(R.fl.top, 'top', dx, yT0, 'Top flange splice (plan)'); }
    return { svg: S.render({ W, maxH: nar ? 900 : 420, label: `${m.s.name || 'Field splice'}: web splice elevation and flange splice plans` }).svg, nar };
  }
  const spliceTexts = m => { const g = m.gov, R = m.R; return { gov: g ? `Governing strength check: ${g.id} ${g.loc}, ratio ${f3(g.r)} (highlighted)` : 'No strength check governs',
    bolts: `Bolts ${frac(R.bolt.d)} in, ${m.gr}; gap ${dIn(m.gap)} between the girder ends; sketch to scale in inches.` }; };
  function splice(slot, o) {
    const K = VK(); let m = null; try { m = spliceModel(o.s, o.opt); } catch (e) { m = null; }
    if (!m) { slot.innerHTML = '<p class="note">No splice design to draw.</p>'; return null; }
    const t = spliceTexts(m);
    return K.detCard(slot, { id: 'dt-spl', title: esc(o.s.name || 'Field splice'), sub: 'Web splice elevation and flange splice plans, to scale', dxf: o.dxf, file: o.file,
      top: `<p class="vk-cap" style="margin:0 0 6px;${m.gov ? 'color:var(--vk-acc);font-weight:600' : ''}">${sb(t.gov)}</p>`,
      draw: W => { const q = spliceSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) a splice plate to read its plates and bolts.',
      cap: `<p class="vk-cap">${esc(t.bolts)} Highlighted (blue): the plate and bolt group of the governing strength check; dashed: the inner plates.</p>` });
  }
  /* the Report's static figure of a splice (no interaction): the same SVG at a fixed width, with its texts, in a .vk box (the print style applies) */
  function spliceFigure(s, W) { const m = spliceModel(s); if (!m) return null; const t = spliceTexts(m); VK().detCss();
    return `<div class="vk vk-det" style="max-width:${W || 760}px"><p class="vk-cap" style="margin:0 0 4px">${sb(t.gov)}</p>${spliceSvg(m, W || 760).svg}<p class="vk-cap">${esc(t.bolts)}</p></div>`; }

  /* ================= (d) plans ================= */
  /* #2 Loads & LLDF: the cross-section with the lanes and the wheel positions of the selected LLDF case (as ui/gfxa.js loadsGraphic: the same cases, wheels, lanes,
     traffic faces, appurtenances of the drawings model, girder spacing chain and, for the lever rule, the influence line of the girder with its ordinates). */
  function lldfModel(P, R, lg, lr, cs) {
    const M = window.SBDDrawings.model(P); if (M.errors && M.errors.length) return { errors: M.errors };
    const rg = R.regions[lr], mem = rg.members[lg], geo = rg.geo, Wd = R.dead.Wd, ts = +P.deck.ts, nb = R.dead.N, ohL = (P.xs && +P.xs.ohL) || 0, pos = geo.pos.map(p => ohL + p), hh = +P.deck.haunch || 0;
    const opts = [];
    if (mem.lever1) opts.push(['lever1', 'Lever rule, one lane (' + nf(mem.lever1.df, 4) + ')']);
    if (mem.alt && mem.alt.l2) opts.push(['lever2', `Lever rule, ${mem.alt.l2.N} trucks (${nf(mem.alt.l2.df, 4)})`]);
    if (mem.rig && mem.rig.ecc) opts.push(['rigid', `Rigid cross-section, ${mem.rig.nLoaded} lane${mem.rig.nLoaded > 1 ? 's' : ''} (${nf(mem.rig.g, 4)})`]);
    const use = opts.some(q => q[0] === cs) ? cs : (opts[0] || ['none'])[0], deL = geo.deL, deR = geo.deR, lw = geo.laneW, NL = geo.NL; let wheels = [], desc = '';
    if (use === 'lever1') { wheels = mem.lever1.wheels; desc = `One lane, lever rule: g = m R = ${nf(mem.lever1.m, 2)} × ${nf(mem.lever1.R, 4)} = ${nf(mem.lever1.df, 4)}`; }
    else if (use === 'lever2') { wheels = mem.alt.l2.wheels; desc = `${mem.alt.l2.N} trucks, lever rule: g = m R = ${nf(mem.alt.l2.m, 2)} × ${nf(mem.alt.l2.R, 4)} = ${nf(mem.alt.l2.df, 4)}`; }
    else if (use === 'rigid') { const rg2 = mem.rig, left = rg2.side !== 'R'; for (let i = 0; i < rg2.nLoaded; i++) { const e0 = left ? deL + i * lw : Wd - deR - i * lw; wheels.push(...(left ? [e0 + 2, e0 + 8] : [e0 - 2, e0 - 8])); }
      desc = `Rigid cross-section, ${rg2.nLoaded} lane(s) loaded: g = m R = ${nf(rg2.m, 2)} × ${nf(rg2.R, 4)} = ${nf(rg2.g, 4)}`; }
    const side = use === 'rigid' && mem.rig ? mem.rig.side : 'L';
    const lanes = []; for (let i = 0; i < NL; i++) { const a = side === 'R' ? Wd - deR - (i + 1) * lw : deL + i * lw; lanes.push([a, a + lw, i]); }
    const f = x => { const j = lg, l = pos[j - 1], c0 = pos[j], r = pos[j + 1], ext = (x0, x1, v0, v1, xx) => v0 + (v1 - v0) * (xx - x0) / (x1 - x0);
      if (x <= c0 && j > 0) return x < l ? 0 : (x - l) / (c0 - l); if (x <= c0) return nb > 1 ? ext(c0, r, 1, 0, x) : 1; if (j < nb - 1) return x > r ? 0 : (r - x) / (r - c0); return ext(l, c0, 0, 1, x); };
    // the girder-spacing chain: the CAD drawing's own dimensions (SharedDxf chainH: runs n@s, its measured text)
    const Dc = X_().drawing({ prefix: 'S-' }), lc = Dc.layer('DIMS', 7); Dc.chainH(lc, [0, ...pos.map(x => x * 12), Wd * 12], 10, 0); const chain = Dc.E.filter(e => e.t === 'DIM').map(e => [e.pts[0][0], e.pts[1][0], e.s]);
    return { M, rg, mem, geo, Wd, ts, nb, pos, hh, opts, use, wheels, desc, lanes, deL, deR, lw, NL, lg, f, chain, lever: use === 'lever1' || use === 'lever2' };
  }
  function lldfSvg(m, W) {
    const K = VK(), S = K.scene(), nar = W < 600, X = x => x * 12, hh = m.hh, ts = m.ts, yd = hh + ts, Wd = m.Wd, G = m.M.girders;
    S.rect(0, hh, X(Wd), yd, 'dt-cc');
    let top = 0, yBot = 0; const sz = nar ? 10 : 11;
    m.pos.forEach((x, i) => { const s = G[Math.min(i, G.length - 1)].segs[0], cx = X(x), y0 = -s.topT - s.D - s.botT, on = i === m.lg, o = on ? { fill: '#2563EB' } : {};
      if (on) S.rect(cx - s.botB / 2 - 6, y0 - 3, cx + s.botB / 2 + 6, yd + 3, 'dt-sel', { stroke: 'none', fill: '#DBEAFE' });
      S.rect(cx - s.topB / 2, 0, cx + s.topB / 2, hh, 'dt-cc'); S.poly([[cx - s.botB / 2, y0], [cx + s.botB / 2, y0], [cx + s.botB / 2, y0 + s.botT], [cx + s.tw / 2, y0 + s.botT], [cx + s.tw / 2, -s.topT], [cx + s.topB / 2, -s.topT], [cx + s.topB / 2, 0], [cx - s.topB / 2, 0], [cx - s.topB / 2, -s.topT], [cx - s.tw / 2, -s.topT], [cx - s.tw / 2, y0 + s.botT], [cx - s.botB / 2, y0 + s.botT]], 'dt-st', o);
      S.text(cx, y0, `G${i + 1}`, { dy: 15, a: 'middle', sz: 12, w: true, cls: on ? 'dt-g' : 'dt-t' }); yBot = Math.min(yBot, y0); });
    (m.M.app ? m.M.app.items : []).forEach(a => { const y0 = yd + (a.y0 || 0);
      if (a.x0 != null && a.k !== 'ws' && a.k !== 'ovl') { const h = a.k === 'bar' ? 34 : a.h; S.rect(X(a.x0), y0, X(a.x1), y0 + h, 'dt-cc', { fill: '#D6CFC0' }); top = Math.max(top, (a.y0 || 0) + h);
        S.text(X((a.x0 + a.x1) / 2), y0 + h, a.k === 'sw' ? 'Sidewalk' : a.k === 'med' ? 'Median' : a.k === 'curb' ? 'Curb' : 'Barrier', { dy: -5, a: 'middle', sz: 10, cls: 'dt-m' }); }
      else if (a.x != null) { S.line(X(a.x), y0, X(a.x), y0 + a.h, 'dt-ol', { sw: 1.6 }); top = Math.max(top, (a.y0 || 0) + a.h); S.text(X(a.x), y0 + a.h, a.k === 'rail' ? 'Railing' : 'Fence', { dy: -5, a: 'middle', sz: 10, cls: 'dt-m' }); } });
    // traffic faces, lanes and wheels: rows in px above the top of the appurtenances
    const yA = yd + top, rW = 54, rL = rW + 26, tL = `Traffic face d_e = ${nf(m.deL, 2)} ft`, tR = `d_e = ${nf(m.deR, 2)} ft`;
    [[m.deL, tL, 'start', 4], [Wd - m.deR, tR, 'end', -4]].forEach(([x, t, a, dx]) => { S.raw(T => { const px = T.X(X(x)), y1 = T.Y(yA) - rL - 18; return `<line x1="${r2(px)}" y1="${r2(T.Y(yd))}" x2="${r2(px)}" y2="${r2(y1)}" class="dt-tf" fill="none" stroke="#15803D" stroke-width="1" stroke-dasharray="6 3"/>` + tx(px + dx, y1 + 2, t, { a, sz: 10, cls: 'dt-tok' }); },
      T => { const px = T.X(X(x)), y1 = T.Y(yA) - rL - 18, w = K.TW(t, 10); return [[a === 'end' ? px - w - 4 : px, y1 - 10], [a === 'end' ? px : px + w + 4, T.Y(yd)]]; }); });
    m.lanes.forEach(([a, b, i]) => S.raw(T => { const x0 = T.X(X(a)), x1 = T.X(X(b)), y = T.Y(yA) - rL; return `<rect x="${r2(x0 + 1)}" y="${r2(y - 9)}" width="${r2(x1 - x0 - 2)}" height="18" rx="3" class="dt-lane" fill="#EEF2F7" stroke="#CBD5E1"/>` + tx((x0 + x1) / 2, y + 4, `Lane ${i + 1}`, { a: 'middle', sz, cls: 'dt-m' })
      + `<rect x="${r2(x0)}" y="${r2(y - 9)}" width="${r2(x1 - x0)}" height="18" class="dt-reg" fill="transparent" data-dtr="${esc(`Lane ${i + 1}: ${nf(m.lw, 2)} ft`)}"/>`; }, T => [[T.X(X(a)), T.Y(yA) - rL - 10], [T.X(X(b)), T.Y(yA) - rL + 10]]));
    m.wheels.forEach(w => S.raw(T => { const px = T.X(X(w)), py = T.Y(yd), yt = T.Y(yA) - rW; return `<circle cx="${r2(px)}" cy="${r2(yt)}" r="6" class="dt-wh" fill="#0F172A"/><line x1="${r2(px)}" y1="${r2(yt + 6)}" x2="${r2(px)}" y2="${r2(py - 7)}" class="dt-ld" stroke="#1E3A5F" stroke-width="1.4"/><polygon points="${r2(px)},${r2(py)} ${r2(px - 3.5)},${r2(py - 7)} ${r2(px + 3.5)},${r2(py - 7)}" class="dt-ldh" fill="#1E3A5F"/>`; },
      T => [[T.X(X(w)) - 7, T.Y(yA) - rW - 7], [T.X(X(w)) + 7, T.Y(yd)]]));
    // the girder-spacing chain under the girders (the CAD drawing's text)
    m.chain.forEach(([a, b, t], i) => S.dimH(a, b, yBot, -46, t, { yr: yBot }));
    // lever rule: the influence line of the girder, its ordinates under the wheels and 1.0 / 0 at the girders, in a band under the chain
    if (m.lever) { const xs = [0, ...m.pos, Wd].sort((p, q) => p - q), vmax = Math.max(1, ...xs.map(m.f)), U = 56, lg = m.lg, gp = [[m.pos[lg], 1]].concat(lg > 0 ? [[m.pos[lg - 1], 0]] : [], lg < m.nb - 1 ? [[m.pos[lg + 1], 0]] : []).filter(([x]) => x >= 0 && x <= Wd);
      S.raw(T => { const y0 = T.Y(yBot) + 92 + vmax * U, Yv = v => y0 - v * U, o = [];
        o.push(`<polygon points="${xs.map(x => r2(T.X(X(x))) + ',' + r2(Yv(m.f(x)))).join(' ')} ${r2(T.X(X(Wd)))},${r2(y0)} ${r2(T.X(0))},${r2(y0)}" class="dt-ilf" fill="#F3EEFF"/>`,
          `<line x1="${r2(T.X(0))}" y1="${r2(y0)}" x2="${r2(T.X(X(Wd)))}" y2="${r2(y0)}" class="dt-ext" stroke="#CBD5E1"/>`, `<polyline points="${xs.map(x => r2(T.X(X(x))) + ',' + r2(Yv(m.f(x)))).join(' ')}" class="dt-il" fill="none" stroke="#7C3AED" stroke-width="1.4"/>`);
        gp.forEach(([x, v]) => { const px = T.X(X(x)); o.push(`<circle cx="${r2(px)}" cy="${r2(Yv(v))}" r="3.5" class="dt-pl" fill="#fff" stroke="#7C3AED"/>`, tx(px + 6, Yv(v) - 6, nf(v, 1), { sz: 10, cls: 'dt-m' })); });
        const lab = m.wheels.map(w => ({ px: T.X(X(w)), v: m.f(w) })); lab.forEach((q, i) => { o.push(`<line x1="${r2(q.px)}" y1="${r2(y0)}" x2="${r2(q.px)}" y2="${r2(Yv(q.v))}" class="dt-il" stroke="#7C3AED" stroke-width="1" stroke-dasharray="3 2"/><circle cx="${r2(q.px)}" cy="${r2(Yv(q.v))}" r="3" fill="#7C3AED" class="dt-band"/>`,
          tx(q.px + 5, Yv(q.v) + 14 + (i % 2) * 12, nf(q.v, 3), { sz: 10.5, w: true }), `<rect x="${r2(q.px - 7)}" y="${r2(Yv(q.v) - 7)}" width="14" height="14" class="dt-reg" fill="transparent" data-dtr="${esc(`Wheel: ordinate ${nf(q.v, 3)} of the G${lg + 1} influence line`)}"/>`); });
        const ilt = [`Influence line of G${lg + 1} (lever rule: 1.0 at G${lg + 1}, 0 at the adjacent girder);`, 'ordinates under the wheels']; (nar ? ilt : [ilt.join(' ')]).forEach((t, i) => o.push(tx(T.X(0), T.Y(yBot) + 78 - (nar ? 13 : 0) + i * 13, t, { sz: nar ? 9.5 : 10.5, cls: 'dt-m' })));
        return o.join(''); }, T => { const y0 = T.Y(yBot) + 92 + vmax * U; return [[T.X(0), T.Y(yBot) + 66], [T.X(X(Wd)) + 30, y0 + 30]]; }); }
    return { svg: S.render({ W, maxH: nar ? 420 : 460, label: 'Cross-section with the lanes and the wheel positions of the LLDF case' }).svg, nar };
  }
  function lldf(slot, o) {
    const K = VK(); let m = null; try { m = lldfModel(o.P, o.R, o.lg, o.lr, o.cs); } catch (e) { slot.innerHTML = `<div class="alert err">The graphic could not be drawn: ${esc(e.message)}</div>`; return null; }
    if (m.errors) { slot.innerHTML = `<div class="note">${esc(m.errors.join(' '))}</div>`; return null; }
    const notes = [m.desc || 'No lever-rule or rigid case for this girder', `N_L = ${m.NL} lanes of ${nf(m.lw, 2)} ft; governing g_M = ${nf(m.mem.gM, 4)}, g_V = ${nf(m.mem.gV, 4)}`, 'Wheels 6 ft apart, outer wheel 2 ft from the traffic face or lane edge'];
    const H = K.detCard(slot, { id: 'dt-ld', title: 'Cross-section: lanes and wheel positions of the LLDF cases', sub: `LLDF: girder G${o.lg + 1}, ${esc(m.rg.label || '')}`, dxf: () => o.dxf(m.use), file: 'lldf-cross-section',
      seg: m.opts.length ? { label: 'LLDF case', items: m.opts.map(([k, t]) => [k, esc(t)]), cur: m.use, on: k => o.onCase(k) } : null,
      top: `<p class="vk-cap" style="margin:0 0 6px;color:var(--vk-ink);font-weight:600">${sb(notes[0])}</p>`,
      draw: W => { const q = lldfSvg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at (or tap) a lane or a wheel ordinate to read it.',
      cap: `<p class="vk-cap">${sb(notes[1])}. ${esc(notes[2])}.</p>`,
      notes: [esc('Wheel and lane positions are the ones the distribution-factor worked steps use (shared/lldf.js lever rule and rigid cross-section); the rigid-section lanes are placed from the traffic face of the governing side. Appurtenances as the Drawings tab. The selected girder is blue; girders, deck and appurtenances to scale.')] });
    if (H) H.model = m; return H;
  }

  /* #17 Field splices: where the splices are on the girder (also the Report's figure): the girder as a bar (schematic depth), the supports S1…, each splice FS1… a
     marker in the colour of its governing ratio (the tab's Governing column, s.gov), the selected one in C's accent; a click selects it (onSel(i)). */
  function stripModel(list, P) { const sup = [0]; (P.spans.lengths || []).forEach(Ls => sup.push(+(sup[sup.length - 1] + +Ls).toFixed(6)));
    return { sup, L: sup[sup.length - 1], list: (list || []).map((s, i) => { const gv = s.gov, r = gv ? (gv.it.st === 'fail' && !(gv.it.r > 1) ? Infinity : gv.it.r) : NaN; return { s, i, x: s.x, gv, r, c: rcls(r) }; }) }; }
  function stripSvg(m, W, sel, interactive) {
    const nar = W < 600, ml = 18, mr = 18, X = ft => ml + ft / m.L * (W - ml - mr), yG = 50, gh = 12, o = [], FILL = { ok: ['#DCFCE7', '#15803D'], hi: ['#FEF3C7', '#B45309'], ng: ['#FEE2E2', '#B91C1C'], na: ['#F1F5F9', '#94A3B8'] };
    o.push(box(X(0), yG, X(m.L) - X(0), gh, 'dt-st', C('dt-st')));
    m.sup.forEach((x, k) => { const px = X(x); o.push(`<polygon points="${r2(px)},${yG + gh} ${r2(px - 6)},${yG + gh + 10} ${r2(px + 6)},${yG + gh + 10}" class="dt-ldh"${C('dt-ldh')}/>`, tx(px, yG + gh + 24, `S${k + 1}`, { a: 'middle', sz: 11, cls: 'dt-m' })); });
    const rows = []; let maxRow = 0;
    m.list.forEach(q => { const px = X(q.x), on = q.i === sel, lab = nar ? `FS${q.i + 1}` : `FS${q.i + 1} ${f2(q.x)} ft`, w = VK().TW(lab, 11) + 14; let row = 0; while (rows[row] != null && rows[row] > px - w / 2 - 4) row++; rows[row] = px + w / 2; maxRow = Math.max(maxRow, row);
      const ty = yG - 14 - row * 22, fc = FILL[q.c];
      o.push(ln(px, ty + 4, px, yG + gh + 3, on ? 'dt-gov' : 'dt-dim', on ? C('dt-gov') + ' stroke-width="1.6"' : C('dt-dim')), `<rect x="${r2(px - 4)}" y="${yG - 3}" width="8" height="${gh + 6}" rx="2" class="dt-${q.c}" fill="${fc[0]}" stroke="${on ? '#2563EB' : fc[1]}" stroke-width="${on ? 2 : 1.2}"/>`);
      o.push(`<rect x="${r2(px - w / 2)}" y="${r2(ty - 13)}" width="${r2(w)}" height="18" rx="9" class="${on ? 'pill' : 'dt-pl'}" fill="${on ? '#2563EB' : '#fff'}" stroke="${on ? 'none' : '#CBD5E1'}"/>`, tx(px, ty, lab, { a: 'middle', sz: 11, w: on, cls: on ? 'dt-w' : 'dt-t' }));
      if (interactive) o.push(`<rect x="${r2(px - Math.max(w / 2, 10))}" y="${r2(ty - 15)}" width="${r2(Math.max(w, 20))}" height="${r2(yG + gh + 6 - ty + 15)}" class="dt-reg" fill="transparent" data-fs="${q.i}" data-dtr="${esc(`${q.s.name}${q.gv ? `: governing ${q.gv.c.id} ${q.gv.it.loc}, ratio ${f3(q.gv.it.r)}` : ''}`)}" style="cursor:pointer"/>`); });
    const y0 = Math.min(0, yG - 14 - maxRow * 22 - 18), H = yG + gh + 32 - y0;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 ${y0} ${Math.round(W)} ${Math.ceil(H)}" role="img" aria-label="Splice locations on the girder" font-family="Inter, Arial, sans-serif" style="background:#fff">${o.join('')}</svg>`;
  }
  const STRIP_CAP = '<p class="vk-cap" style="margin-top:2px">Marker colour: the governing ratio of the splice (table below): <span style="color:#15803D">below 0.90</span>, <span style="color:#B45309">0.90 to 1.00</span>, <span style="color:#B91C1C">above 1.00 or NG</span>; the selected splice in blue. Girder schematic (not to scale vertically).</p>';
  function strip(slot, o) {
    const K = VK(), m = stripModel(o.list, o.P); let sel = o.sel;
    const H = K.detCard(slot, { id: 'dt-fs', title: 'Splice locations', sub: 'Click (or tap) a splice to select it', dxf: o.dxf, file: o.file, draw: W => ({ html: stripSvg(m, W, sel, true), nar: W < 600 }), hint: 'Point at a splice to read its governing check.', cap: STRIP_CAP });
    H.fig.addEventListener('click', e => { const t = e.target.closest && e.target.closest('[data-fs]'); if (!t) return; sel = +t.getAttribute('data-fs'); H.redraw(); if (o.onSel) o.onSel(sel); });
    H.select = v => { sel = v; H.redraw(); }; return H;
  }
  function stripFigure(list, P, W) { const m = stripModel(list, P); VK().detCss(); return `<div class="vk vk-det" style="max-width:${W || 760}px">${stripSvg(m, W || 760, -1, false)}${STRIP_CAP.replace('; the selected splice in blue', '')}</div>`; }

  /* ================= Cross-frames tab, diaphragm in use (SBDIA, #1297): the intermediate diaphragm elevation =================
     As ui/framing.js diaSvg (its own inline SVG, no DXF): the bay between two girders, the connection plates, the diaphragm (nominal shape centred on the girder
     depth), the bolt rows; the same numbers (SharedUnits.fmt digits). A static figure (the tab's HTML string): a wide and a narrow drawing, the card's width
     picks one (container query); print shows the wide one. */
  function diaphragm(B) {
    const CF = window.SBDCrossframes, U = window.SharedUnits, fmt = (v, d) => U.fmt(v, d), p = B.I.p, q = p.dia || {}, Xs = CF.cfDiaSec(q), g = CF.cfDiaGap(q), S0 = +p.S, dg = +p.dg, D = B.R.DIA && B.R.DIA.i;
    const bf = 16, tfl = 1, nb = Math.max(2, Math.round(+q.nb || 2)), sp = +q.pitch || 3, ec = +q.ecc || 3.5, bs = 5, yT = dg - (dg - Xs.d) / 2, yB = yT - Xs.d;   // y up from the bottom flange
    const draw = W => { const Sc = VK().scene(), nar = W < 560;
      [0, S0].forEach((xg, k) => { Sc.rect(xg - bf / 2, dg - tfl, xg + bf / 2, dg, 'dt-st'); Sc.rect(xg - bf / 2, 0, xg + bf / 2, tfl, 'dt-st'); Sc.rect(xg - 0.35, tfl, xg + 0.35, dg - tfl, 'dt-st');
        const sg = k ? -1 : 1; Sc.rect(Math.min(xg, xg + sg * bs), tfl + 1, Math.max(xg, xg + sg * bs), dg - tfl - 1, 'dt-pl', { fill: '#E2E8F0', stroke: '#94A3B8' }); });
      Sc.rect(g, yB, S0 - g, yT, 'dt-st'); Sc.line(g, yT - Xs.tf, S0 - g, yT - Xs.tf, 'dt-ol', { stroke: '#E2E8F0', sw: 0.8 }); Sc.line(g, yB + Xs.tf, S0 - g, yB + Xs.tf, 'dt-ol', { stroke: '#E2E8F0', sw: 0.8 });
      [ec, S0 - ec].forEach(xb => { for (let i = 0; i < nb; i++) Sc.circ(xb, dg / 2 + (i - (nb - 1) / 2) * sp, 0.5, 'dt-bolt'); });
      Sc.text(S0 / 2, yT, `${Xs.nm_} ${Xs.chS ? 'channel' : 'rolled W'} diaphragm, d = ${fmt(Xs.d, 2)} in`, { dy: -8, a: 'middle', sz: 12, w: true, maxw: nar ? W * 0.55 : W - 20, up: true });
      Sc.dimH(0, S0, 0, -22, `S = ${fmt(S0, 2)} in`); Sc.dimV(0, dg, -bf / 2, -14, `d = ${fmt(dg, 2)} in`, { xr: -bf / 2 });
      Sc.region(g, yB, S0 - g, yT, `Diaphragm ${Xs.nm_}, d = ${fmt(Xs.d, 2)} in${D ? `; φf Mn = ${fmt(D.Mn, 0)} kip-in, φv Vn = ${fmt(D.Vn, 2)} kip` : ''}`);
      return Sc.render({ W, maxH: nar ? 260 : 320, label: 'Diaphragm elevation' }).svg; };
    VK().detCss();
    const cap = `${nb} bolts each end at ${fmt(sp, 2)} in, ${fmt(ec, 2)} in from the web; diaphragm centred on the girder depth${D ? `; φ_f M_n = ${fmt(D.Mn, 0)} kip-in, φ_v V_n = ${fmt(D.Vn, 2)} kip` : ''}.`;
    if (typeof document !== 'undefined' && !document.getElementById('vk-dia-css')) { const st = document.createElement('style'); st.id = 'vk-dia-css';
      st.textContent = '.vk-dia{container-type:inline-size;} .vk-dia .dn{display:none;} @container (max-width:560px){.vk-dia .dw{display:none;} .vk-dia .dn{display:block;}} @media print{.vk-dia .dw{display:block!important;} .vk-dia .dn{display:none!important;}}'; document.head.appendChild(st); }
    return `<div class="vk vk-det vk-dia"><div class="vk-hd"><h3>Intermediate diaphragm, elevation<small>Looking along the girders; S = largest girder spacing; nominal dimensions</small></h3></div><div class="vk-fig"><div class="dw">${draw(720)}</div><div class="dn">${draw(360)}</div></div>`
      + `<p class="vk-cap">${sb(cap)}</p><p class="vk-note">Intermediate diaphragm looking along the girders (connection plates light grey, bolts amber), nominal dimensions. Checks CFD (intermediate) and CFE (end diaphragms at the bearing lines) below; the details sheet is on the Drawings tab.</p></div>`;
  }

  window.SBDGfxDet = { diaphragm, lldf, lldfModel, strip, stripModel, stripFigure, ltb, ltbModel, bracket, bracketModel, stiff, stiffModel, bear, bearModel, crossframe, cfModel, weld, weldModel, splice, spliceModel, spliceFigure,
    _svg: { lldfSvg, stripSvg, ltbSvg, bracketSvg, stiffSvg, bearSvg, cfSvg, weldSvg, spliceSvg } };   // _svg: the SVG builders (tests)
})();
