/* apps/steel-bridge/ui/tabgraphics-b.js — mounts the graphics of engine/tabgraphics-b.js (window.SBDTabGfxB) into the output tabs Shear & stiffeners,
   Fatigue & studs, Cross-frames, Field splices, Welds and Rating (window.SBDTabGfxBUI). Classic script. Display only: each call draws the result its tab
   already built (the tab's own build() output) and, where the tab has a selection (a panel, station, detail, weld, rating row), a click on the graphic
   sets the tab's own selection and redraws the tab, so the graphic and the tables stay in step.
   Needs SBDGraphics (ui/graphics.js: mount with title, Download DXF, wheel zoom at the cursor, drag pan, pinch, double-click fit, + / − / Fit) and
   SBDTabGfxB. A tab puts an empty <div data-gfxb="NAME"></div> where the graphic goes and calls the function of its tab after it sets its HTML:
     shear(host, ctx, R, onSel)      names shear, shear-detail, shear-bearing (R = SBDShearUI.build result; onSel({ k, i }): k pan, loc, ts, bs)
     fatigue(host, ctx, R, onSel)    names fatigue, fatigue-chart       (k fa, sc)
     crossframe(host, ctx, B)        name crossframe                    (B = SBDFramingUI.build result)
     welds(host, ctx, B, sel, onSel) names welds, weld-detail           (k fw, tr)
     splice(host, ctx, s, list, sel, onSel)  names splice-strip, splice (s = one entry of the splice list, list = all, sel its index; onSel(i))
     rating(host, ctx, B, sel, onSel) name rating                       (sel = the row index; onSel({ k: 'rt', i }))
   ctx = { P, g } as the tab's render; sel is the tab's current selection ({ k, i }, or the row index for the Rating tab). */
(function () {
  'use strict';
  const T = () => window.SBDTabGfxB, GR = () => window.SBDGraphics;
  const slug = P => String((P && P.project && P.project.name) || 'steel-bridge').replace(/[^\w.-]+/g, '_');

  /* a SBDGraphics.mount build() result from an engine graphic g (D, title, note, regions): pick = the smallest region under the point */
  function wrap(g, file) {
    const regs = g.regions || [], find = v => (v ? regs.find(r => r.k === v.k && r.i === v.i) : null);
    const PRI = { bs: -1, ts: 0, fa: 0, fw: 0, tr: 0, sc: 1, loc: 2, rt: 3, pan: 4 };   // a mark on the girder wins over the panel behind it, then the smaller area
    const pick = (x, y) => { let best = null, bp = Infinity, ba = Infinity; regs.forEach(r => { if (x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1) { const p = PRI[r.k] != null ? PRI[r.k] : 5, a = (r.x1 - r.x0) * (r.y1 - r.y0); if (p < bp || (p === bp && a < ba)) { bp = p; ba = a; best = r; } } }); return best ? { k: best.k, i: best.i } : null; };
    return { D: g.D, regions: regs, title: g.title, file, note: g.note || (regs.length ? 'Click a location to select it in the tables below.' : ''), pick, readout: v => { const r = find(v); return r && r.lab ? r.lab : ''; },
      selMark: v => { const r = find(v); return r ? { x: (r.x0 + r.x1) / 2, y0: r.y0, y1: r.y1, label: '' } : null; } };
  }
  function put(host, name, ctx, make, onSel, extra) {   // extra: more SBDGraphics.mount options (maxVh, minPx, phoneZoom)
    const el = host.querySelector(`[data-gfxb="${name}"]`), GRX = GR(), TX = T(); if (!el) return null;
    if (!GRX || !TX) { el.innerHTML = '<p class="note">The graphic needs ui/graphics.js and engine/tabgraphics-b.js.</p>'; return null; }
    // the tab redraws on a selection; a double-click (fit the view) must not: the redraw waits a moment and a double-click cancels it
    let timer = null; const sel = onSel ? v => { if (!v) return; clearTimeout(timer); timer = setTimeout(() => onSel(v), 350); } : null;
    el.addEventListener('dblclick', () => clearTimeout(timer));
    const H = GRX.mount(el, () => wrap(make(TX), `${slug(ctx.P)}_${name}`), { key: `gfxb-${name}`, onSelect: sel, ...(extra || {}) });
    if (H) (window.SBDTabGfxBUI.handles = window.SBDTabGfxBUI.handles || {})[name] = H;   // the mounted graphics (tests)
    return H;
  }
  const gi = ctx => (ctx.P.girders[ctx.g] ? ctx.g : 0);
  /* SBVZB (2026-11-10): the graphics along the girder (shear, fatigue, fatigue-chart, welds, rating) on screen in the data-viz style (ui/alonggfx.js
     SBDAlongGfx[viz], ui/vizalong.js); Download DXF exports the old drawing, wrap(make(TX)), unchanged. false when the style's files are not loaded (put() is used) */
  function putC(host, name, ctx, make, viz, o2) {
    const el = host.querySelector(`[data-gfxb="${name}"]`), AG = window.SBDAlongGfx, TX = T(); if (!el) return true;
    if (!AG || !window.SBDVizAlong || !window.SBDVizKit || !TX || !GR()) return false;
    const file = `${slug(ctx.P)}_${name}`, H = AG[viz](el, { ...o2, build: () => wrap(make(TX), file), file });
    if (H) (window.SBDTabGfxBUI.handles = window.SBDTabGfxBUI.handles || {})[name] = H; return true;
  }

  function shear(host, ctx, R, sel, onSel) {
    if (!putC(host, 'shear', ctx, TX => TX.shear(R, ctx.P, { gi: gi(ctx), sel }), 'shear', { P: ctx.P, gi: gi(ctx), R, sel, onSel })) put(host, 'shear', ctx, TX => TX.shear(R, ctx.P, { gi: gi(ctx), sel }), onSel);
    // the stiffener details follow the selection: the selected transverse stiffener / bearing, else the governing one (2026-10-31)
    put(host, 'shear-detail', ctx, TX => TX.shearDetail(R, ctx.P, { i: sel && sel.k === 'ts' ? sel.i : undefined }));
    put(host, 'shear-bearing', ctx, TX => TX.shearBearing(R, ctx.P, { i: sel && sel.k === 'bs' ? sel.i : undefined }));
  }
  function fatigue(host, ctx, R, sel, onSel) {
    if (!putC(host, 'fatigue', ctx, TX => TX.fatigue(R, ctx.P, { gi: gi(ctx), sel }), 'fatigue', { P: ctx.P, gi: gi(ctx), R, sel, onSel })) put(host, 'fatigue', ctx, TX => TX.fatigue(R, ctx.P, { gi: gi(ctx), sel }), onSel);
    if (!putC(host, 'fatigue-chart', ctx, TX => TX.fatigueChart(R, ctx.P, { gi: gi(ctx), sel }), 'fatigueChart', { P: ctx.P, gi: gi(ctx), R, sel, onSel })) put(host, 'fatigue-chart', ctx, TX => TX.fatigueChart(R, ctx.P, { gi: gi(ctx), sel }), onSel);
  }
  function crossframe(host, ctx, B) { put(host, 'crossframe', ctx, TX => TX.crossframe(B, ctx.P, { dia: !!(window.SBDCrossframes && ctx.P.crossframes && window.SBDCrossframes.cfDiaOn(ctx.P.crossframes)) })); }
  function welds(host, ctx, B, sel, onSel) {
    if (!putC(host, 'welds', ctx, TX => TX.welds(B, ctx.P, { gi: gi(ctx), sel }), 'welds', { P: ctx.P, gi: gi(ctx), R: B, sel, onSel })) put(host, 'welds', ctx, TX => TX.welds(B, ctx.P, { gi: gi(ctx), sel }), onSel);
    put(host, 'weld-detail', ctx, TX => TX.weldDetail(B, ctx.P, { i: sel && sel.k === 'fw' ? sel.i : undefined }));
  }
  /* splice (SPLGFX, 2026-11-02): the location strip (all splices, the selected one boxed; a click selects) and the detail of the selected splice, its frame at most
     60 % of the window high (the drawing is wide: it fits the card width at a reading scale) */
  function splice(host, ctx, s, list, sel, onSel) {
    if (list && list.length) put(host, 'splice-strip', ctx, TX => TX.spliceStrip(list, ctx.P, { sel, narrow: window.innerWidth < 700 }), onSel ? v => { if (v && v.k === 'fs') onSel(v.i); } : null, { minPx: 60, phoneZoom: false });
    if (s) put(host, 'splice', ctx, TX => TX.splice(s, {}), null, { maxVh: 60 });
  }
  function rating(host, ctx, B, sel, onSel) { if (!putC(host, 'rating', ctx, TX => TX.ratingChart(B, ctx.P, { gi: gi(ctx), sel }), 'rating', { P: ctx.P, gi: gi(ctx), R: B, sel, onSel })) put(host, 'rating', ctx, TX => TX.ratingChart(B, ctx.P, { gi: gi(ctx), sel }), onSel); }

  window.SBDTabGfxBUI = { shear, fatigue, crossframe, welds, splice, rating, wrap };
})();
