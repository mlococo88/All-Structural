/* apps/steel-bridge/ui/gfxa.js — the graphics of the Section properties, Loads & LLDF, Analysis, Flexure and Constructibility tabs, in the
   Drawings-tab format (window.SBDGfxA). Classic script. Display and export only: every graphic is drawn from the results the tab's own
   tables show (the tab passes them in); nothing is recomputed. The one derived quantity is stated where it is drawn: the stress diagram of
   the Section properties tab is per 1000 kip-ft of unit moment (f = M (y − ȳ) / I with the I and ȳ of the table).
   Needs ui/graphics.js (SBDGraphics), shared/dxf.js, engine/drawings.js (SBDDrawings.model, for the plates, supports and cross-frames).

   Each function takes the element to draw into (slot) and what the tab has:
     section(slot, { P, R })                        R = the tab's results (index.html calc(): c, s, nr, lf, g)
     loads(slot, { P, R, lg, lr })                  R = SBDUiLoads.calc(); lg girder, lr region (the tab's selectors)
     analysis(slot, { P, gi, R })                   R = analyzeGirder() result kept by ui/analysis.js
     flexure(slot, { P, gi, R, sel, onSelect })     R = the Flexure tab's result (rows); sel = the selected row; onSelect(row index)
     constr(slot, { P, gi, R, sel, onSelect })      R = the Constructibility tab's result (rows, F.AR the analysis, F.oh)
   Fix log: fixlog/steel-bridge.md. */
(function () {
  'use strict';
  const GR = () => window.SBDGraphics, X_ = () => window.SharedDxf;
  const fin = v => typeof v === 'number' && isFinite(v);
  const nf = (v, d) => (fin(v) ? (+v).toFixed(d == null ? 2 : d) : '—');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = { secCase: 'steel', loadCase: '', anSel: 0 };

  /* a block: an optional case selector above a mounted graphic */
  function block(slot, o) {
    slot.innerHTML = `${o.cases && o.cases.length > 1 ? `<div class="fRow" style="margin:0 0 4px"><label for="${o.id}_c" style="min-width:0">${esc(o.caseLabel || 'Show')}</label><select id="${o.id}_c" style="width:auto">${o.cases.map(([v, t]) => `<option value="${esc(v)}"${v === o.cur ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>` : ''}<div class="gfx-slot"></div>`;
    const host = slot.querySelector('.gfx-slot'), sel = slot.querySelector('select');
    if (sel) sel.addEventListener('change', () => o.onCase(sel.value));
    return host;
  }
  const arrow = (D, l, x, y0, y1, h) => { D.line(l, x, y0, x, y1); const s = y1 < y0 ? 1 : -1; D.pline(l, [[x, y1], [x - 0.25 * h, y1 + s * 0.7 * h], [x + 0.25 * h, y1 + s * 0.7 * h]], true); };
  const ibeam = (D, ly, cx, y0, s, v) => { v = v || 1;   // plates of one section; y0 = bottom of the bottom flange
    const yw0 = y0 + s.botT * v, yw1 = yw0 + s.D * v, yt = yw1 + s.topT * v;
    D.rect(ly, cx - s.botB / 2, y0, cx + s.botB / 2, yw0); D.rect(ly, cx - s.tw / 2, yw0, cx + s.tw / 2, yw1); D.rect(ly, cx - s.topB / 2, yw1, cx + s.topB / 2, yt); return { yw0, yw1, yt }; };

  /* ================= Section properties ================= */
  function secGraphic(P, R, cs, seg) {
    const G = GR(), c = R.c, s = R.s, OW = window.SBDOwners, deck = P.deck, comp = c.comp, d = c.s.d;
    const hh = comp ? (OW && R.lf ? OW.haunchInProps(deck.haunch, R.lf) : deck.haunch) : 0, ts = comp ? +deck.ts : 0, be = comp ? +R.g.beff : 0, rb = deck.rebar || {};
    const W = Math.max(be, s.topB, 30), H = d + hh + ts, h = Math.max(W, H * 1.4) * 0.095, D = G.newDrawing(h), t = D.layer('ANNO-TEXT', 7), dm = D.layer('DIMS', 7);
    const ly = { g: D.layer('GRDR', 5), dk: D.layer('DECK', 7), rb: D.layer('REBAR', 1), c: D.layer('CNTR', 8) };
    const ib = ibeam(D, ly.g, 0, 0, s); if (comp && hh > 0) D.rect(ly.dk, -s.topB / 2, d, s.topB / 2, d + hh);
    if (comp) { D.rect(ly.dk, -be / 2, d + hh, be / 2, d + hh + ts);
      [['rt', rb.top, d + hh + ts - (rb.top || {}).c], ['rb', rb.bot, d + hh + (rb.bot || {}).c]].forEach(([k, q, y], i) => { if (!q || !(q.A > 0) || !fin(y)) return;
        D.line(ly.rb, -be / 2 + h, y, be / 2 - h, y, D.ltype('DASHED')); for (let x = -be / 2 + 2 * h; x < be / 2; x += Math.max(6 * h, be / 8)) D.circle(ly.rb, x, y, 0.3 * h);
        D.text(t, be / 2 + 5.5 * h, y - (i ? 1.0 : -0.1) * h, 0.8 * h, `${i ? 'BOT.' : 'TOP'} REBAR ${nf(q.A, 2)} IN2`); }); }
    D.line(ly.c, 0, -1.5 * h, 0, H + 1.5 * h, D.ltype('CENTER'));
    // dimensions: the plates and the deck
    D.dimV(dm, 0, d, -Math.max(be, s.topB) / 2 - 3 * h, -s.botB / 2, `d = ${nf(d, 3)} IN`);
    if (comp) { D.dimV(dm, d + hh, H, Math.max(be, s.topB) / 2 + 3 * h, be / 2, `t_s = ${nf(ts, 2)} IN`); D.dimH(dm, -be / 2, be / 2, H + 2.5 * h, H, `b_eff = ${nf(be, 2)} IN`); }
    // neutral axes (the lines the table gives): steel ȳ, long-term 3n, short-term n, PNA
    const axes = [[c.s.yb, 'ENA STEEL', 5, 'STEEL'], ...(comp ? [[c.c3.yb, 'ENA 3n', 30, '3N'], [c.cn.yb, 'ENA n', 6, 'N']] : []), [c.yp, `PNA (${c.region === 'pos' ? 'POS.' : 'NEG.'})`, 3, 'PNA']].filter(q => fin(q[0])).sort((a, b) => a[0] - b[0]);
    const xl = -Math.max(be, s.topB) / 2 - 6 * h; let yPrev = -1e9, xr = Math.max(be, s.topB) / 2 + 2 * h;
    axes.forEach(([y, lab, col, key]) => { const l = D.layer('NA-' + key, col); D.line(l, xl, y, xr, y, D.ltype('CENTER')); const ty = Math.max(y, yPrev + 1.3 * h); yPrev = ty;
      D.text(l, xl - 0.5 * h, ty - 0.3 * h, 0.8 * h, `${lab} ${nf(y, 3)}`, 2); if (Math.abs(ty - y) > 0.2 * h) D.line(l, xl - 0.4 * h, ty, xl, y); });
    // stress diagram for the selected load case (per 1000 kip-ft)
    const cases = { steel: { sec: c.s, f: 1, lab: 'DC1: STEEL SECTION' }, '3n': { sec: c.c3, f: 3 * R.nr.n, lab: 'DC2, DW: LONG-TERM 3n SECTION' }, n: { sec: c.cn, f: R.nr.n, lab: 'LL+IM: SHORT-TERM n SECTION' } };
    const K = cases[comp ? cs : 'steel'] || cases.steel, sc = K.sec, M = 1000, ff = y => M * 12 * (y - sc.yb) / sc.I, x0 = xr + 15 * h;
    const mx = Math.max(Math.abs(ff(0)), Math.abs(ff(d)), comp && K.f > 1 ? Math.abs(ff(H)) / K.f : 0, 1e-9), kx = Math.max(be, s.topB) * 0.4 / mx;
    const ksi = [], lc = D.layer('STRESS-C', 5), lt = D.layer('STRESS-T', 1), segs = [[0, d, 1]]; if (comp && K.f > 1) segs.push([d + hh, H, 1 / K.f]);
    D.line(t, x0, -1 * h, x0, H + 1 * h); D.text(t, x0, H + 3 * h, 1.0 * h, `STRESS, M = 1000 KIP-FT (C + / T -)`, 1);
    D.text(t, x0, H + 1.6 * h, 0.7 * h, K.lab, 1);
    segs.forEach(([ya, yb, k]) => { const pts = []; for (let i = 0; i <= 8; i++) { const y = ya + (yb - ya) * i / 8; pts.push([x0 + ff(y) * k * kx, y]); } D.pline(ff((ya + yb) / 2) >= 0 ? lc : lt, [[x0, ya], ...pts, [x0, yb]], true);
      for (let y = ya; y <= yb + 1e-9; y += 0.8 * h) { const v = ff(y) * k; D.line(v >= 0 ? lc : lt, x0, y, x0 + v * kx, y); }
      [ya, yb].forEach((y, i) => { const v = ff(y) * k, tx = x0 + (v >= 0 ? 1 : -1) * Math.max(Math.abs(v) * kx, 0) + (v >= 0 ? 0.5 : -0.5) * h; ksi.push({ x: tx, y: y + (i ? -0.9 : 0.1) * h, side: v >= 0 ? 0 : 2, s: `${nf(v, 2)} KSI` }); }); });
    // the stress values: the labels of one side are kept a line apart (a thin deck's two values would touch), moving the upper one up
    [0, 2].forEach(sd => { let yp = -Infinity; ksi.filter(q => q.side === sd).sort((a, b) => a.y - b.y).forEach(q => { q.y = Math.max(q.y, yp + 1.1 * 0.8 * h); yp = q.y; }); });
    ksi.forEach(q => D.text(t, q.x, q.y, 0.8 * h, q.s, q.side));
    G.wrap(`f = M(y - ybar)/I, I = ${nf(sc.I, 0)} IN4, ybar = ${nf(sc.yb, 3)} IN${comp && K.f > 1 ? `; DECK f / ${nf(K.f, 3)}` : ''}`, 30).forEach((q, i) => D.text(t, x0, -3 * h - i * 1.2 * h, 0.8 * h, q, 1));
    D.text(t, xl - 0.5 * h, H + 6 * h, 1.3 * h, `SECTION PROPERTIES: ${(R.g.label || R.g.id || '').toString().toUpperCase()}, SEGMENT ${seg || 1}`); void ib;
    return { D, title: 'Section and neutral axes, stress diagram', file: 'section-properties', note: `Drawn from the tab's section properties (y up from the bottom of the steel). Stress diagram: a unit moment of 1000 kip-ft on the section the load case acts on, f = M(y − ȳ)/I with the table's I and ȳ (deck stress ÷ n or 3n).` };
  }
  function section(slot, o) {
    const cur = o.R.c.comp ? S.secCase : 'steel';
    const host = block(slot, { id: 'gfx_sec', cases: o.R.c.comp ? [['steel', 'DC1: steel section'], ['3n', 'DC2, DW: long-term (3n)'], ['n', 'LL+IM: short-term (n)']] : null, cur, caseLabel: 'Stress diagram, load case', onCase: v => { S.secCase = v; section(slot, o); } });
    return GR().mount(host, () => secGraphic(o.P, o.R, cur, o.seg), { key: 'sec' });
  }

  /* ================= Loads & LLDF ================= */
  function loadsGraphic(P, R, lg, lr, cs) {
    const G = GR(), M = window.SBDDrawings.model(P); if (M.errors && M.errors.length) return { errors: M.errors };
    const rg = R.regions[lr], mem = rg.members[lg], geo = rg.geo, Wd = R.dead.Wd, ft = 12, ts = +P.deck.ts, h = Wd * ft * 0.03, D = G.newDrawing(h), t = D.layer('ANNO-TEXT', 7), dm = D.layer('DIMS', 7);
    const ly = { dk: D.layer('DECK', 7), g: D.layer('GRDR', 5), sel: D.layer('SEL', 5), ap: D.layer('DECK-BARR', 8), ln: D.layer('LANE', 3, 'DASHED'), wh: D.layer('LL-WHEEL', 1), il: D.layer('INFLUENCE', 6) };
    const nb = R.dead.N, ohL = (P.xs && +P.xs.ohL) || 0, pos = geo.pos.map(p => ohL + p), seg = M.girders[Math.min(lg, M.girders.length - 1)].segs[0], hh = +P.deck.haunch || 0, X = x => x * ft;
    const yTopFl = 0; D.rect(ly.dk, 0, yTopFl + hh, X(Wd), yTopFl + hh + ts);
    pos.forEach((x, i) => { const s = M.girders[Math.min(i, M.girders.length - 1)].segs[0]; ibeam(D, i === lg ? ly.sel : ly.g, X(x), yTopFl - s.topT - s.D - s.botT, s); D.line(ly.dk, X(x) - s.topB / 2, yTopFl, X(x) - s.topB / 2, yTopFl + hh); D.line(ly.dk, X(x) + s.topB / 2, yTopFl, X(x) + s.topB / 2, yTopFl + hh);
      D.text(t, X(x), yTopFl - s.topT - s.D - s.botT - 2.2 * h, 0.9 * h, `G${i + 1}`, 1); });
    // appurtenances: footprints from the drawings model (same as the Drawings tab's section)
    let top = 0; if (M.app) M.app.items.forEach(a => { const y0 = hh + ts + (a.y0 || 0);
      if (a.x0 != null && a.k !== 'ws' && a.k !== 'ovl') { D.rect(ly.ap, X(a.x0), y0, X(a.x1), y0 + (a.k === 'bar' ? 34 : a.h)); top = Math.max(top, (a.y0 || 0) + (a.k === 'bar' ? 34 : a.h)); const al = a.k === 'sw' ? 'SIDEWALK' : a.k === 'med' ? 'MEDIAN' : a.k === 'curb' ? 'CURB' : 'BARRIER', aw = G.textW(al, 0.6 * h), ac = X((a.x0 + a.x1) / 2), ay = y0 + (a.k === 'bar' ? 34 : a.h) + 0.4 * h;
        // the label is centred on its appurtenance; where a girder's extension line (the spacing chain's, from the deck up) would touch it, it moves to the nearer clear side of that line
        const xl = [0, ...pos.map(X), X(Wd)], hit = (c, al2) => { const l0 = al2 === 1 ? c - aw / 2 : al2 === 0 ? c : c - aw, l1 = l0 + aw; return xl.some(x => x > l0 - 0.4 * h && x < l1 + 0.4 * h); };
        let ax = ac, ah = 1; if (hit(ac, 1)) { const cs = []; xl.forEach(x => { cs.push([x + 0.5 * h, 0], [x - 0.5 * h, 2]); }); const ok = cs.filter(q => !hit(q[0], q[1])).sort((p1, p2) => Math.abs(p1[0] - ac) - Math.abs(p2[0] - ac))[0]; if (ok) { ax = ok[0]; ah = ok[1]; } }
        D.text(t, ax, ay, 0.6 * h, al, ah); }
      else if (a.x != null) { D.line(ly.ap, X(a.x), y0, X(a.x), y0 + a.h); top = Math.max(top, (a.y0 || 0) + a.h); D.text(t, X(a.x), y0 + a.h + 0.4 * h, 0.6 * h, a.k === 'rail' ? 'RAILING' : 'FENCE', 1); } });
    // roadway and lanes (stacked above the deck: wheels, lane bands, traffic faces, spacing chain, texts)
    const yd = hh + ts, yA = yd + top, deL = geo.deL, deR = geo.deR, lw = geo.laneW, NL = geo.NL, yLn = yA + 7.5 * h;
    D.line(ly.ln, X(deL), yd, X(deL), yLn + 1.5 * h); D.line(ly.ln, X(Wd - deR), yd, X(Wd - deR), yLn + 1.5 * h);
    // the traffic-face notes sit clear of the extension lines of the girder-spacing chain (only where the spacing changes: the chain's runs; they run from the deck up to the chain): a note that one would cross moves to the next gap
    const xe = [...new Set([0, ...pos.filter((x, i) => i === 0 || i === pos.length - 1 || Math.abs(x - pos[i - 1] - (pos[i + 1] - x)) > 1e-6), Wd].map(X))].sort((a, b) => a - b), tL = `TRAFFIC FACE d_e = ${nf(deL, 2)} FT`, tR = `d_e = ${nf(deR, 2)} FT`, wL = G.textW(tL, 0.7 * h), wR = G.textW(tR, 0.7 * h);
    let sL = X(deL) + 0.4 * h; xe.forEach(x => { if (x >= sL - 0.3 * h && x <= sL + wL + 0.3 * h) sL = x + 0.5 * h; });
    let eR = X(Wd - deR) - 0.4 * h; xe.slice().reverse().forEach(x => { if (x >= eR - wR - 0.3 * h && x <= eR + 0.3 * h) eR = x - 0.5 * h; });
    D.text(t, sL, yLn + 1.6 * h, 0.7 * h, tL, 0); D.text(t, eR, yLn + 1.6 * h, 0.7 * h, tR, 2);
    // cases: one lane lever rule, multi-lane lever rule, rigid cross-section
    const opts = [];
    if (mem.lever1) opts.push(['lever1', 'Lever rule, one lane (' + nf(mem.lever1.df, 4) + ')']);
    if (mem.alt && mem.alt.l2) opts.push(['lever2', `Lever rule, ${mem.alt.l2.N} trucks (${nf(mem.alt.l2.df, 4)})`]);
    if (mem.rig && mem.rig.ecc) opts.push(['rigid', `Rigid cross-section, ${mem.rig.nLoaded} lane${mem.rig.nLoaded > 1 ? 's' : ''} (${nf(mem.rig.g, 4)})`]);
    const use = opts.some(q => q[0] === cs) ? cs : (opts[0] || ['none'])[0]; let wheels = [], desc = '';
    if (use === 'lever1') { wheels = mem.lever1.wheels; desc = `ONE LANE, LEVER RULE: g = m R = ${nf(mem.lever1.m, 2)} x ${nf(mem.lever1.R, 4)} = ${nf(mem.lever1.df, 4)}`; }
    else if (use === 'lever2') { wheels = mem.alt.l2.wheels; desc = `${mem.alt.l2.N} TRUCKS, LEVER RULE: g = m R = ${nf(mem.alt.l2.m, 2)} x ${nf(mem.alt.l2.R, 4)} = ${nf(mem.alt.l2.df, 4)}`; }
    else if (use === 'rigid') { const rg2 = mem.rig, left = rg2.side !== 'R'; for (let i = 0; i < rg2.nLoaded; i++) { const e0 = left ? deL + i * lw : Wd - deR - i * lw; wheels.push(...(left ? [e0 + 2, e0 + 8] : [e0 - 2, e0 - 8])); }
      desc = `RIGID CROSS-SECTION, ${rg2.nLoaded} LANE(S) LOADED: g = m R = ${nf(rg2.m, 2)} x ${nf(rg2.R, 4)} = ${nf(rg2.g, 4)}`; }
    const side = use === 'rigid' && mem.rig ? mem.rig.side : 'L';
    for (let i = 0; i < NL; i++) { const a = side === 'R' ? Wd - deR - (i + 1) * lw : deL + i * lw, b = a + lw; D.line(ly.ln, X(a), yLn, X(b), yLn); D.line(ly.ln, X(a), yLn - 0.4 * h, X(a), yLn + 0.4 * h); D.line(ly.ln, X(b), yLn - 0.4 * h, X(b), yLn + 0.4 * h); D.text(t, X((a + b) / 2), yLn + 0.5 * h, 0.7 * h, `LANE ${i + 1}`, 1); }
    wheels.forEach(w => { const x = X(w); arrow(D, ly.wh, x, yA + 5.5 * h, yA + 0.4 * h, h); D.circle(ly.wh, x, yA + 5.9 * h, 0.4 * h); });
    // lever rule: the influence line of the girder (statics about the adjacent girder), in its own band below the girder labels: a baseline, the sloped line (1.0 at the girder,
    // 0 at the adjacent girder), thin projection lines from the baseline up to the line at each wheel, and the ordinates printed at the wheels (stacked where they would touch)
    let yBand = yTopFl - seg.topT - seg.D - seg.botT - 3.4 * h;   // the girder labels are just under the girders: the band starts below them
    if (use === 'lever1' || use === 'lever2') { const unit = 4 * h, ext = (x0, x1, v0, v1, x) => v0 + (v1 - v0) * (x - x0) / (x1 - x0);
      const f = x => { const j = lg, l = pos[j - 1], c0 = pos[j], r = pos[j + 1];
        if (x <= c0 && j > 0) return x < l ? 0 : (x - l) / (c0 - l); if (x <= c0) return nb > 1 ? ext(c0, r, 1, 0, x) : 1; if (j < nb - 1) return x > r ? 0 : (r - x) / (r - c0); return ext(l, c0, 0, 1, x); };
      const xs = [0, ...pos, Wd].sort((p, q) => p - q), vmax = Math.max(1, ...xs.map(f)), yb0 = yBand - vmax * unit - 1.2 * h, pts = xs.map(x => [X(x), yb0 + f(x) * unit]);
      D.line(ly.il, 0, yb0, X(Wd), yb0, D.ltype('DASHED')); D.pline(ly.il, pts, false);
      const lab = []; [[pos[lg], 'G' + (lg + 1)], ...(lg > 0 ? [[pos[lg - 1], 'G' + lg]] : []), ...(lg < nb - 1 ? [[pos[lg + 1], 'G' + (lg + 2)]] : [])].forEach(([x]) => { D.line(ly.il, X(x), yb0 - 0.3 * h, X(x), yb0 + 0.3 * h); });
      wheels.forEach(w => { const v = f(w); D.line(ly.il, X(w), yb0, X(w), yb0 + v * unit, D.ltype('DASHED')); D.circle(ly.il, X(w), yb0 + v * unit, 0.25 * h); lab.push({ x: X(w) + 0.5 * h, y: yb0 + v * unit + 0.5 * h, w: G.textW(nf(v, 3), 0.8 * h) + 0.4 * h, hh: 0.8 * h, txt: nf(v, 3) }); });
      [[pos[lg], 1, 'G' + (lg + 1)], ...(lg > 0 ? [[pos[lg - 1], 0, 'G' + lg]] : []), ...(lg < nb - 1 ? [[pos[lg + 1], 0, 'G' + (lg + 2)]] : [])].forEach(([x, v]) => { if (x < 0 || x > Wd) return; D.circle(ly.il, X(x), yb0 + v * unit, 0.35 * h); lab.push({ x: X(x) + 0.5 * h, y: yb0 + v * unit + 0.5 * h, w: G.textW(nf(v, 1), 0.8 * h) + 0.4 * h, hh: 0.8 * h, txt: nf(v, 1) }); });
      const by = G.declutter(lab, { gap: 0.3 * h }); lab.forEach((q, i) => D.text(t, q.x, by[i], q.hh, q.txt, 0));
      D.text(t, 0, yb0 - 1.9 * h, 0.85 * h, `INFLUENCE LINE OF G${lg + 1} (LEVER RULE: 1.0 AT G${lg + 1}, 0 AT THE ADJACENT GIRDER); ORDINATES UNDER THE WHEELS`); yBand = yb0 - 2.6 * h; }
    // dimensions of the girder spacing, then (above them) the notes, then the title
    const yDim = yLn + 5 * h; D.chainH(dm, [0, ...pos.map(X), X(Wd)], yDim, yd);
    const nch = Math.max(30, Math.floor(X(Wd) / (0.85 * h * 0.58))), notes = [...G.wrap('WHEELS 6 FT APART, OUTER WHEEL 2 FT FROM THE TRAFFIC FACE OR LANE EDGE', nch).reverse(), ...G.wrap(`N_L = ${NL} LANES OF ${nf(lw, 2)} FT; GOVERNING g_M = ${nf(mem.gM, 4)}, g_V = ${nf(mem.gV, 4)}`, nch).reverse(), ...G.wrap(desc || 'NO LEVER-RULE OR RIGID CASE FOR THIS GIRDER', nch).reverse()];
    let yN = yDim + 3.4 * h; notes.forEach(q => { D.text(t, 0, yN, 0.85 * h, q); yN += 1.35 * h; });
    D.text(t, 0, yN + 0.6 * h, 1.3 * h, `LLDF: GIRDER G${lg + 1}, ${(rg.label || '').toUpperCase()}`);
    return { D, title: 'Cross-section: lanes and wheel positions of the LLDF cases', file: 'lldf-cross-section', opts, use, note: 'Wheel and lane positions are the ones the distribution-factor worked steps use (shared/lldf.js lever rule and rigid cross-section); the rigid-section lanes are placed from the traffic face of the governing side. Appurtenances as the Drawings tab.' };
  }
  function loads(slot, o) {
    const rg = o.R.regions[o.lr], mem = rg && rg.members[o.lg]; if (!mem) { slot.innerHTML = ''; return null; }
    const g0 = loadsGraphic(o.P, o.R, o.lg, o.lr, S.loadCase); if (g0.errors) { slot.innerHTML = `<div class="note">${esc(g0.errors.join(' '))}</div>`; return null; }
    const host = block(slot, { id: 'gfx_ld', cases: g0.opts, cur: g0.use, caseLabel: 'LLDF case', onCase: v => { S.loadCase = v; loads(slot, o); } });
    return GR().mount(host, () => loadsGraphic(o.P, o.R, o.lg, o.lr, g0.use), { key: `loads${o.lg}.${o.lr}.${g0.use}` });
  }

  /* ================= elevation helpers for the girder tabs ================= */
  function elev(P, gi, title, sub) { const E = GR().elevation(P, gi); if (E.errors.length) return E; E.title(title, sub); return E; }
  const nearest = (xs, ft) => { let b = 0; xs.forEach((x, i) => { if (Math.abs(x - ft) < Math.abs(xs[b] - ft)) b = i; }); return b; };

  /* ================= Analysis ================= */
  function analysis(slot, o) {
    const R = o.R, P = o.P, G = GR(); if (!R || (R.errors && R.errors.length) || !R.x) { slot.innerHTML = ''; return null; }
    const build = () => {
      const E = elev(P, o.gi, `GIRDER ${(P.girders[o.gi].label || P.girders[o.gi].id || '').toString().toUpperCase()}: ANALYSIS`, 'ELEVATION WITH SUPPORTS (S), PLATE BREAKS, CROSS-FRAMES (CF) AND FIELD SPLICES (FS); DIAGRAMS BELOW ON THE SAME STATIONS');
      if (E.errors.length) return { errors: E.errors };
      const w = (E.L1 - E.L0) * 12, hg = Math.max(w * 0.08, 7 * E.h), x0 = E.X(E.L0), sup = R.sup || E.G.sup, s = R.st, ll = R.ll;
      const mk = (title, ser, o2) => { const top = E.alloc(hg + 12 * E.h), C = G.chart({ D: E.D, at: [x0, top - hg - 3 * E.h], w, hgt: hg, h: E.h, title, xr: [E.L0, E.L1], series: ser, vlines: sup.map(v => ({ x: v })), ...o2 }); E.band(top - hg - 3 * E.h, top - 3 * E.h); E.alloc(1.5 * E.h); return C; };
      const M = [{ name: 'M DC1', pts: R.x.map((x, i) => [x, s.DC1.M[i]]), color: 5 }, { name: 'M DC2', pts: R.x.map((x, i) => [x, s.DC2.M[i]]), color: 3 }, { name: 'M DW', pts: R.x.map((x, i) => [x, s.DW.M[i]]), color: 30 }];
      if (ll) { M.push({ name: 'M LL+IM max', pts: R.x.map((x, i) => [x, ll.Mpos[i]]), color: 1 }, { name: 'M LL+IM min', pts: R.x.map((x, i) => [x, ll.Mneg[i]]), color: 1, lt: 'DASHED' }); }
      mk('MOMENTS, KIP-FT (UNFACTORED, PER GIRDER)', M, { ylab: 'KIP-FT', fy: v => nf(v, 0) });
      const Cm = [{ name: 'TOTAL (CAMBER)', pts: R.x.map((x, i) => [x, -R.camber.total[i]]), color: 7 }, { name: 'STEEL + CF', pts: R.x.map((x, i) => [x, -R.camber.steel[i]]), color: 5 }, { name: 'WET DECK', pts: R.x.map((x, i) => [x, -R.camber.wet[i]]), color: 30 }, { name: 'DC2 + DW', pts: R.x.map((x, i) => [x, -R.camber.sd[i]]), color: 3 }];
      mk('DEAD-LOAD DEFLECTION, IN (DOWNWARD DRAWN DOWN; CAMBER = TOTAL, UPWARD)', Cm, { ylab: 'IN', fy: v => nf(v, 2) });
      return { D: E.D, title: 'Girder elevation, moments and deflection', file: 'analysis-elevation', pick: (x, y) => nearest(R.x, E.pick(x, y)), selMark: k => E.selMark(R.x[k]),
        readout: k => `x = ${nf(R.x[k], 2)} ft: M_DC1 ${nf(s.DC1.M[k], 1)}, M_DC2 ${nf(s.DC2.M[k], 1)}, M_DW ${nf(s.DW.M[k], 1)}${ll ? `, M_LL+IM ${nf(ll.Mneg[k], 0)} / ${nf(ll.Mpos[k], 0)}` : ''} kip-ft; camber ${nf(R.camber.total[k], 3)} in`, note: 'Stations, moments and deflections are the Analysis tab\'s results (the station table below); click a location to select it.' };
    };
    const opts = R.x.map((x, i) => [String(i), `x = ${nf(x, 2)} ft`]), cur = String(Math.min(S.anSel, R.x.length - 1));
    const host = block(slot, { id: 'gfx_an', cases: opts, cur, caseLabel: 'Station', onCase: v => { S.anSel = +v; analysis(slot, o); } });
    return G.mount(host, build, { key: 'an', selected: +cur, onSelect: k => { S.anSel = k; const sl = slot.querySelector('select'); if (sl) sl.value = String(k); } });
  }

  /* ================= Flexure ================= */
  function flexure(slot, o) {
    const G = GR(), R = o.R, P = o.P; if (!R || !R.rows || !R.rows.length) { slot.innerHTML = ''; return null; }
    const rows = R.rows, xr = rows.map(r => (fin(r.x) ? r.x : NaN)), sel = Math.min(o.sel || 0, rows.length - 1), r = rows[sel];
    slot.innerHTML = '<div class="gfx-a"></div><div class="gfx-b"></div><div class="gfx-c"></div>';
    const A = slot.querySelector('.gfx-a'), B = slot.querySelector('.gfx-b'), C = slot.querySelector('.gfx-c');
    const bld = () => {
      const E = elev(P, o.gi, 'FLEXURE: GOVERNING RATIO AT EACH LOCATION', 'GREEN BELOW 0.90, AMBER 0.90 TO 1.00, RED ABOVE 1.00 OR NG; RATIO = GOVERNING CHECK OF THE LOCATION (RESULTS TABLE)');
      if (E.errors.length) return { errors: E.errors };
      const items = rows.map((q, i) => ({ x: fin(q.x) ? Math.max(E.L0, Math.min(E.L1, q.x)) : E.L0, ratio: q.gov ? q.gov.ratio : NaN, ok: q.gov ? !(q.gov.ng && !fin(q.gov.ratio)) : false, label: `GOVERNS (ROW ${i + 1})` })); G.ratioLayer(E, G.mergeBands(items, { x0: E.L0, x1: E.L1 }), { what: 'FLEXURE', flag: true });
      return { D: E.D, title: 'Girder elevation coloured by governing ratio', file: 'flexure-elevation', pick: (x, y) => nearest(xr.map(v => (fin(v) ? v : 1e9)), E.pick(x, y)), selMark: k => E.selMark(xr[k]), readout: k => `${rows[k].name}: ${rows[k].gov ? `${rows[k].gov.id} ratio ${fin(rows[k].gov.ratio) ? nf(rows[k].gov.ratio, 3) : 'NG'}` : 'no check'}`, note: 'One band per location of the results table (the tributary stretch to the mid-points of its neighbours); numbers are the table rows. Click a band to select the location.' };
    };
    const H = G.mount(A, bld, { key: 'fx', selected: sel, onSelect: k => o.onSelect && o.onSelect(k) });
    // f_bu vs F_nc (and every check's demand and capacity) at the selected location
    const flangeCk = (r.checks || []).filter(q => q.unit === 'ksi' && fin(q.demand) && fin(q.capacity) && q.inUse !== false);
    G.mount(B, () => {
      const h = 6, hgt = 50, D = G.newDrawing(h), cats = flangeCk.map(q => q.id + (q.key ? ' ' + q.key.toUpperCase() : '')), mk = (name, f, col) => ({ name, kind: 'bars', color: col, pts: flangeCk.map((q, i) => [i, f(q)]) });
      const w = Math.max(150, 32 * flangeCk.length), ttl = (t, y0) => G.wrap(t, 42).forEach((q, i, a) => D.text(D.layer('ANNO-TEXT', 7), 0, y0 + hgt + 1.4 * h + (a.length - 1 - i) * 1.4 * h, 1.1 * h, q));
      G.chart({ D, at: [0, 0], w, hgt, h, cats, series: [mk('DEMAND', q => q.demand, 5), mk('CAPACITY', q => q.capacity, 3)], ylab: 'KSI', fy: v => nf(v, 0), legend: 'below' }); ttl(`STRESS CHECKS (KSI) AT ${String(r.name).toUpperCase()}: DEMAND (f_bu ...) VS CAPACITY (phi F_nc ...)`, 0);
      const rt = (r.checks || []).filter(q => fin(q.ratio)), w2 = Math.max(150, 32 * rt.length), y2 = -(hgt + 17 * h);
      G.chart({ D, at: [0, y2], w: w2, hgt, h, cats: rt.map(q => q.id + (q.key ? ' ' + q.key.toUpperCase() : '')), series: [{ name: 'RATIO', kind: 'bars', color: 5, pts: rt.map((q, i) => [i, q.ratio]) }], limits: [{ y: 1, label: 'RATIO = 1.0' }], fy: v => nf(v, 2), legend: 'below' }); ttl('CHECK RATIOS (ALL CHECKS OF THE LOCATION)', y2);
      return { D, title: `Stress checks at ${r.name}`, file: 'flexure-checks', note: 'Demand and capacity of the checks in the location table (checks in ksi); ratios of every check with 1.0 marked.' };
    }, { key: 'fxb' });
    // unbraced length (LTB) sketch
    G.mount(C, () => {
      const lt = r.lt || {}, Lb = r.Lb, sg = r.seg, h = Math.max(Lb || 20, 20) * 12 * 0.025, D = G.newDrawing(h), t = D.layer('ANNO-TEXT', 7), ly = { f: D.layer('GRDR-PLAT', 4), b: D.layer('BRNG', 8), dm: D.layer('DIMS', 7), s: D.layer('SEL', 5), a: D.layer('LTB-LP', 3), c: D.layer('LTB-LR', 30), d: D.layer('LTB-LB', 1) };
      if (!fin(Lb) || !sg) { D.text(t, 0, 0, h, 'UNBRACED LENGTH NOT AVAILABLE FOR THIS LOCATION'); return { D, title: 'Unbraced length', file: 'flexure-ltb' }; }
      const xa = 0, xb = (sg.xb - sg.xa) * 12, xm = (r.x - sg.xa) * 12, tf = h * 0.5;
      D.rect(ly.f, xa, 0, xb, tf); [xa, xb].forEach(x => D.pline(ly.b, [[x, 0], [x - h * 0.7, -h * 1.2], [x + h * 0.7, -h * 1.2]], true)); D.text(t, xa, -2.8 * h, 0.8 * h, `BRACE (STA ${nf(sg.xa, 1)} FT)`, 1); D.text(t, xb, -2.8 * h, 0.8 * h, `BRACE (STA ${nf(sg.xb, 1)} FT)`, 1);
      if (fin(xm)) { D.line(ly.s, xm, -1.6 * h, xm, tf + 1.2 * h); D.text(ly.s, xm, tf + 1.6 * h, 0.8 * h, `${String(r.name).toUpperCase()}`, 1); }
      D.dimH(ly.dm, xa, xb, 3.4 * h, tf, `L_b = <>`);
      // L_p, L_r, L_b to one scale, from the left brace
      const bars = [['L_p', lt.Lp, ly.a], ['L_r', lt.Lr, ly.c], ['L_b', Lb * 12, ly.d]].filter(q => fin(q[1])); let y = -6 * h;
      bars.forEach(([n, v, l]) => { D.rect(l, 0, y, v, y + 0.9 * h); D.text(t, v + 0.5 * h, y + 0.1 * h, 0.8 * h, `${n} = ${nf(v / 12, 2)} FT`); y -= 1.7 * h; });
      const regime = fin(lt.Lp) && fin(lt.Lr) ? (Lb * 12 <= lt.Lp ? 'L_b <= L_p: F_nc = plateau (no LTB reduction)' : Lb * 12 <= lt.Lr ? 'L_p < L_b <= L_r: inelastic LTB' : 'L_b > L_r: elastic LTB, F_cr') : '';
      D.text(t, 0, y - 0.3 * h, 0.9 * h, `C_b = ${nf(r.Cb, 3)}; F_nc: FLB ${nf(lt.FLB, 2)} KSI, LTB ${nf(lt.LTB, 2)} KSI; ${regime.toUpperCase()}`);
      D.text(t, 0, tf + 7 * h, 1.3 * h, 'UNBRACED LENGTH OF THE COMPRESSION FLANGE (LTB)');
      return { D, title: 'Unbraced length (LTB) at the selected location', file: 'flexure-ltb', note: 'L_b, C_b, L_p, L_r and F_nc are the values of the location table (worked steps below); the brace points are the Framing tab\'s.' };
    }, { key: 'fxc' });
    return H;
  }

  /* ================= Constructibility ================= */
  function constr(slot, o) {
    const G = GR(), R = o.R, P = o.P; if (!R || !R.rows || !R.rows.length) { slot.innerHTML = ''; return null; }
    const rows = R.rows, xr = rows.map(q => q.x), sel = Math.min(o.sel || 0, rows.length - 1), AR = R.F && R.F.AR, sq = AR && AR.seq;
    slot.innerHTML = '<div class="gfx-a"></div><div class="gfx-b"></div>';
    const A = slot.querySelector('.gfx-a'), B = slot.querySelector('.gfx-b');
    const H = G.mount(A, () => {
      const E = GR().elevation(P, o.gi); if (E.errors.length) return { errors: E.errors };
      const D = E.D, h = E.h, t = E.ly.t, items = rows.map((q, i) => ({ x: q.x, ratio: q.gov ? q.gov.ratio : NaN, ok: q.gov ? !(q.gov.ng && !fin(q.gov.ratio)) : false, label: `GOVERNS (ROW ${i + 1})` })), lp = D.layer('POUR', 30);
      // the pours in order over the elevation: an outlined box per pour with its number (the limits are in the sequence table below)
      if (sq) sq.pours.forEach((p, k) => { const a = E.X(p.a), b = E.X(p.b), y = E.yTop + 2.6 * h, wb = b - a, tx = `POUR ${k + 1}`; D.rect(lp, a, y, b, y + 2.2 * h);
        if (G.textW(tx, 0.9 * h) < wb * 0.94) D.text(t, (a + b) / 2, y + 0.6 * h, 0.9 * h, tx, 1); else if (G.textW(String(k + 1), 0.9 * h) < wb * 0.94) D.text(t, (a + b) / 2, y + 0.6 * h, 0.9 * h, String(k + 1), 1); });
      if (sq) E.yTop += 5.4 * h;
      E.title('CONSTRUCTIBILITY: DECK PLACEMENT SEQUENCE', sq ? 'POURS IN ORDER OVER THE ELEVATION (SEQUENCE TABLE BELOW); M_DCc ENVELOPE (NONCOMPOSITE MOMENT, KIP-FT); BANDS = GOVERNING DECK-PLACEMENT RATIO, MERGED WHERE THE COLOUR CLASS IS THE SAME' : 'NO POUR SEQUENCE (SIMPLE SPANS, NONCOMPOSITE OR THE SEQUENCE IS OFF): M_DC1 IS USED');
      G.ratioLayer(E, G.mergeBands(items, { x0: E.L0, x1: E.L1 }), { what: 'DECK PLACEMENT', flag: true });
      if (sq && AR.x) { const w = (E.L1 - E.L0) * 12, hg = Math.max(w * 0.08, 7 * E.h), top = E.alloc(hg + 10.5 * E.h);
        G.chart({ D, at: [E.X(E.L0), top - hg - 3 * E.h], w, hgt: hg, h, title: 'M_DCc ENVELOPE VS M_DC1 (KIP-FT)', xr: [E.L0, E.L1], series: [{ name: 'M_DCc (POUR SEQUENCE)', pts: AR.x.map((x, i) => [x, sq.MDCc[i]]), color: 6 }, { name: 'M_DC1 (DECK AT ONCE)', pts: AR.x.map((x, i) => [x, AR.st.DC1.M[i]]), color: 5, lt: 'DASHED' }], vlines: (AR.sup || E.G.sup).map(v => ({ x: v })), ylab: 'KIP-FT', fy: v => nf(v, 0) }); E.band(top - hg - 3 * E.h, top - 3 * E.h); E.alloc(1.5 * h); }
      E.freeze();
      if (sq && window.SBDDrawings.table) { const nr = sq.pours.length, y = E.alloc((nr + 2) * 1.5 * h + 4 * h);
        window.SBDDrawings.table(D, E.ly.t, E.X(E.L0), y - 0.5 * h, ['POUR (ORDER)', 'FROM, FT', 'TO, FT', 'LENGTH, FT'], sq.pours.map((p, k) => [String(k + 1), nf(p.a, 1), nf(p.b, 1), nf(p.b - p.a, 1)]), 'DECK PLACEMENT SEQUENCE: POURS IN THE ORDER PLACED'); }
      return { D, title: 'Deck pour sequence and moment envelope', file: 'constructibility-pours', pick: (x, y) => nearest(xr, E.pick(x, y)), selMark: k => E.selMark(xr[k]), readout: k => `${rows[k].name}: M_c = ${nf(rows[k].Mc, 1)} kip-ft; ${rows[k].gov ? `${rows[k].gov.id} ratio ${fin(rows[k].gov.ratio) ? nf(rows[k].gov.ratio, 3) : 'NG'}` : ''}`,
        note: 'Pours, M_DCc and M_DC1 are the Analysis results the checks use (Analysis tab, deck placement sequence); the band row is the governing deck-placement ratio at each location of the table.' };
    }, { key: 'cn', selected: sel, onSelect: k => o.onSelect && o.onSelect(k) });
    // overhang bracket sketch (exterior girder, project source)
    const oh = R.F && R.F.oh;
    G.mount(B, () => {
      const gg = P.girders[o.gi], sg = gg.segments[0], a = +(oh || {}).a, hb = +(oh || {}).hb, wOH = +(oh || {}).wOH, tOH = +(oh || {}).tOH;
      const h = Math.max(sg.topB, wOH || 30) * 0.05, D = G.newDrawing(h), t = D.layer('ANNO-TEXT', 7), ly = { g: D.layer('GRDR', 5), dk: D.layer('DECK', 7), br: D.layer('BRACKET', 30), ld: D.layer('LOAD', 1), dm: D.layer('DIMS', 7) };
      if (!oh || ![a, hb, wOH, tOH].every(fin)) { D.text(t, 0, 0, h, 'OVERHANG BRACKETS: EXTERIOR GIRDER, PROJECT SOURCE ONLY (INPUTS ABOVE)'); return { D, title: 'Overhang bracket', file: 'overhang-bracket' }; }
      const Dw = Math.min(+sg.D, 40), x0 = 0; D.rect(ly.g, -sg.topB / 2, -sg.topT, sg.topB / 2, 0); D.rect(ly.g, -sg.tw / 2, -sg.topT - Dw, sg.tw / 2, -sg.topT); D.line(ly.g, -sg.topB * 0.5, -sg.topT - Dw, sg.topB * 0.5, -sg.topT - Dw, D.ltype('HIDDEN'));
      const ys = 0 + (+((P.deck || {}).haunch) || 0); D.rect(ly.dk, x0, ys, x0 + wOH, ys + tOH);   // overhang slab from the girder centerline
      D.line(ly.br, x0, -hb, a, ys, D.ltype('CONTINUOUS')); D.line(ly.br, a, ys - 0.8 * h, a, ys); D.line(ly.br, x0, ys, a, ys); D.line(ly.br, x0, -hb, x0, 0);
      D.dimH(ly.dm, x0, a, -hb - 3 * h, -hb, `a = ${nf(a, 1)} IN`); D.dimV(ly.dm, -hb, ys, -sg.topB / 2 - 4 * h, x0, `h_b = ${nf(hb + ys, 1)} IN`); D.dimH(ly.dm, x0, x0 + wOH, ys + tOH + 3 * h, ys + tOH, `w_OH = ${nf(wOH, 1)} IN`); D.dimV(ly.dm, ys, ys + tOH, x0 + wOH + 3 * h, x0 + wOH, `t_OH = ${nf(tOH, 1)} IN`);
      const q = x0 + wOH * 0.5; arrow(D, ly.ld, q, ys + tOH + 2.2 * h, ys + tOH, h); D.text(t, q, ys + tOH + 2.4 * h, 0.7 * h, `DECK AND FORMS (GAMMA_DC ${nf(((oh || {}).gam || {}).dc, 2)})`, 1);
      arrow(D, ly.ld, x0 + wOH - 0.2 * h, ys + tOH + 7 * h, ys + tOH, h); D.text(t, x0 + wOH, ys + tOH + 7.2 * h, 0.7 * h, `FINISHING MACHINE ${nf(oh.Pfm, 1)} KIP; SCREED, RAIL, WALKWAY, CONSTR. LL`, 2);
      D.text(t, -sg.topB / 2, ys + tOH + 11 * h, 1.2 * h, 'OVERHANG BRACKET (EXTERIOR GIRDER), SCHEMATIC'); D.text(t, -sg.topB / 2, ys + tOH + 9.2 * h, 0.7 * h, 'DIMENSIONS ARE THE OVERHANG BRACKET INPUTS OF THE TAB; BRACKET MEMBERS SCHEMATIC (CONTRACTOR-DESIGNED)');
      return { D, title: 'Overhang bracket sketch (exterior girder)', file: 'overhang-bracket', note: 'Dimensions from the overhang-bracket inputs (a, h_b, w_OH, t_OH); loads are the tab\'s OH1–OH5 inputs. Schematic.' };
    }, { key: 'cnb' });
    return H;
  }

  window.SBDGfxA = { section, loads, analysis, flexure, constr, secGraphic, loadsGraphic };
})();
