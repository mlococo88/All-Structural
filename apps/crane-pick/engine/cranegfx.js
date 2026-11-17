/* apps/crane-pick/engine/cranegfx.js — the crane's plan symbol (window.CranePickCraneGfx). Classic script, no DOM (Node-tested:
   tests/engine/crane-gfx.test.mjs). 2026-11-17 (engineer request A: "the plan / DXF output should show the crane much more accurately").
   ONE module for every plan picture of a crane: the live map (ui/place.js), the Drawings sheets and the DXF (ui/drawset.js), the aerial
   site plan (ui/aerial.js) and the Crane tab. Display only: no capacity, clearance or ground value depends on it, and it calculates
   nothing the engines use. The parts the engines do use come from them unchanged, so the picture matches the checks:
     carrier / carbody, crawler tracks, outrigger beams and floats (true size, at the chart's spread): engine/lift.js footprint();
     tail-swing radius: planDims().tail; boom-foot offset e: engine/elev.js geomOf().footE; the boom tip over the hook at the radius R
     (plan: tip pin plumb above the hook, the engines' assumption).
   The rest is schematic and drawn from the crane file where it gives a dimension, else from a stated assumption (listed in dims().assumed
   and on the crane card / Crane tab, as C2's missing plan dimensions): axles and tyres, the carrier cab, the outrigger beam width, the
   tumbler ends and shoes, the upperworks (house) outline, the operator cab, the counterweight block, the boom section width and its
   telescopic sections or lattice chords and lacing, the boom head sheaves, the hook block, the load outline.
   Frames: the carrier frame (x forward along the heading, y to the left; engine/lift.js toGrid) and the upperworks frame (a along the
   boom, b to the left of the boom), which turns with the slew: grid = toGrid({ x, y, heading: slew azimuth }, a, b).

   dims(crane) -> { kind, type, boomType ('telescopic' | 'lattice'), carrier: { front, rear, width }, axles: [x], tyre: { d, w }, carCab,
     beamW, tumbler: { r, xs }, shoePitch, upper: { width, front, rear }, cw: { width, depth, aRear, aFront }, cab: { a0, a1, b0, b1 },
     footE, boomW, sections, tail, from: { key: 'file' | 'entered' | 'engine' | 'assumed' }, assumed: [text] }
   symbol(crane, setup, o) -> { parts: [{ g, pts, closed }], circles: [{ g, c, r }], texts: [{ g, p, s, rot, size }], key, dims, assumed }
     o = { hook: { x, y } (the boom points at it; R = its distance from the rotation centre) | slew (azimuth, deg) + R, boom (default true
           when a hook or R is given), load: { L, W } (C2 load in plan, centred on the hook, L along the boom) | loadPolys: [[pt]] (C5 girder),
           detail: 'full' | 'simple' (the map at small zoom), labels (default true) }
     key = { cor, heading, slewAz, slewRel (from the carrier front, −180 … 180), R, foot, tip, floatC (engine/lift.js), tail, cwPts, fp }
     g (group) -> GROUPS[g].layer: the DXF layer (prefixed by the drawing, e.g. C-CRANE-BOOM) and its colour.
   draw(sym, out): out = { poly(g, pts, closed), circle(g, c, r), text(g, p, s, rot, size) } — the one walk every renderer uses.
   svg(sym, X, Y, k, o): SVG markup of the symbol (X, Y: grid ft -> SVG px; k: px per ft), for figures and the Crane tab. */
(function () {
  'use strict';
  const K = () => window.CranePickCranes, LF = () => window.CranePickLift, EL = () => window.CranePickElev, G = () => window.CranePickGeo;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const dval = v => v && typeof v === 'object' && isNum(v.value) ? v.value : (isNum(v) ? v : null);
  const first = (o, ks) => { if (!o) return null; for (const k of ks) { const v = dval(o[k]); if (v != null) return v; } return null; };
  const norm180 = a => { let t = ((a + 180) % 360 + 360) % 360 - 180; return t === -180 ? 180 : t; };
  const GROUPS = {
    carrier: { layer: 'CRANE-CARRIER', aci: 5, label: 'carrier / carbody, tracks, axles, wheels, carrier cab' },
    outrigger: { layer: 'CRANE-OUTRIGGER', aci: 4, label: 'outrigger beams' },
    float: { layer: 'CRANE-FLOAT', aci: 30, label: 'outrigger floats (true size)' },
    upper: { layer: 'CRANE-UPPER', aci: 3, label: 'upperworks (house) and operator cab' },
    cwt: { layer: 'CRANE-CWT', aci: 6, label: 'counterweight' },
    boom: { layer: 'CRANE-BOOM', aci: 7, label: 'boom (sections / chords, lacing), boom head sheaves' },
    hook: { layer: 'CRANE-HOOK', aci: 1, label: 'hook block (the load line is plumb: a point in plan)' },
    load: { layer: 'CRANE-LOAD', aci: 1, label: 'load outline at the hook' },
    cor: { layer: 'CRANE', aci: 5, label: 'centre of rotation' },
    label: { layer: 'CRANE-TEXT', aci: 7, label: 'heading / slew labels' }
  };
  /* ---------- the dimensions the symbol uses ---------- */
  function dims(c) {
    const p = K().planDims(c), g = EL().geomOf(c), d = (c && c.dims) || {}, cc = d.carrier_or_carbody || {}, cor = d.center_of_rotation || {}, cr = d.crawler || {};
    const ov = (c && c.app_inputs && c.app_inputs.gfx) || {}, from = {}, assumed = [];
    const type = (c && c.type) || 'all-terrain', kind = p.kind;
    const take = (k, entered, file, dflt, why) => { if (isNum(entered) && entered > 0) { from[k] = 'entered'; return entered; } if (isNum(file) && file > 0) { from[k] = 'file'; return file; } from[k] = 'assumed'; if (why) assumed.push(why); return dflt; };
    const o = { kind, type, from, assumed, tail: isNum(p.tail) && p.tail > 0 ? p.tail : null, footE: isNum(g.footE) ? g.footE : 0 };
    from.footE = g.from && g.from.footE === 'assumed' ? 'assumed' : 'engine';
    o.boomType = ov.boomType === 'lattice' || ov.boomType === 'telescopic' ? ov.boomType : (type === 'crawler' ? 'lattice' : 'telescopic');
    from.boomType = ov.boomType ? 'entered' : 'assumed';
    if (!ov.boomType) assumed.push(`boom drawn as ${o.boomType} (from the crane type "${type}")`);
    if (kind === 'crawler') {
      const L = p.crawler && p.crawler.length, gauge = p.crawler && p.crawler.gauge, shoe = p.crawler && isNum(p.crawler.shoe) ? p.crawler.shoe : 3;
      const body = p.body || null;
      o.carrier = body ? { front: body.front, rear: body.rear, width: body.width } : { front: (L || 30) * 0.3, rear: (L || 30) * 0.3, width: Math.max(6, (gauge || 16) - shoe - 1) };
      from.carrier = body ? 'engine' : 'assumed'; if (!body) assumed.push('carbody outline: 0.6 × track length long, gauge − shoe − 1 ft wide');
      const tc = first(cr, ['tumbler_centres']), ch = first(cr, ['crawler_height']);
      const r = take('tumbler', ov.tumblerR, isNum(ch) ? ch / 2 : null, 1.75, 'tumbler radius 1.75 ft');
      o.tumbler = { r: Math.min(r, (L || 30) / 4), xs: [] };
      if (isNum(L)) { const half = isNum(tc) && tc < L ? tc / 2 : L / 2 - o.tumbler.r; o.tumbler.xs = [half, -half]; if (!(isNum(tc) && tc < L)) assumed.push('tumbler centres = track length − 2 × tumbler radius'); }
      o.shoePitch = take('shoePitch', ov.shoePitch, null, 2, 'track shoes drawn at 2 ft (schematic)');
      o.axles = []; o.tyre = null; o.carCab = null;
    } else {
      const body = p.body || null, xF = p.outr && isNum(p.outr.xFront) ? p.outr.xFront : 10, xR = p.outr && isNum(p.outr.xRear) ? p.outr.xRear : 10;
      o.carrier = body ? { front: body.front, rear: body.rear, width: body.width } : { front: xF + 3, rear: xR + 3, width: 8.5 };
      from.carrier = body ? 'engine' : 'assumed'; if (!body) assumed.push('carrier outline: 3 ft beyond the outrigger beams, 8.5 ft wide');
      const Lc = o.carrier.front + o.carrier.rear;
      const nA = Math.max(2, Math.round(isNum(ov.axles) && ov.axles >= 2 ? ov.axles : (type === 'rough-terrain' ? 2 : Math.max(2, Math.min(9, Math.round(Lc / 9))))));
      from.axles = isNum(ov.axles) ? 'entered' : 'assumed'; if (!isNum(ov.axles)) assumed.push(`${nA} axles (schematic: from the crane type and carrier length)`);
      const wb = first(cor, ['wheelbase']), rRear = first(cor, ['rotation_to_rear_axle']);
      let a0, a1;
      if (isNum(rRear) && isNum(wb) && nA === 2) { a0 = -rRear; a1 = -rRear + wb; from.axlePos = 'file'; }
      else if (isNum(rRear) && isNum(wb)) { a0 = -rRear; a1 = -rRear + wb; from.axlePos = 'file'; }
      else { a0 = -o.carrier.rear + 0.15 * Lc; a1 = o.carrier.front - (type === 'rough-terrain' ? 0.15 : 0.25) * Lc; from.axlePos = 'assumed'; assumed.push('axle positions spread over the carrier (schematic)'); }
      o.axles = Array.from({ length: nA }, (_, i) => a0 + (a1 - a0) * i / (nA - 1));
      o.tyre = { d: take('tyreD', ov.tyreD, null, type === 'rough-terrain' ? 5.5 : 4.5, `tyres ${type === 'rough-terrain' ? '5.5' : '4.5'} ft diameter`), w: take('tyreW', ov.tyreW, null, type === 'rough-terrain' ? 2.3 : 1.9, null) };
      o.carCab = type === 'rough-terrain' ? null : { a0: o.carrier.front - 6, a1: o.carrier.front, b0: 0, b1: o.carrier.width / 2 };
      if (o.carCab) assumed.push('carrier cab at the front left, 6 ft long, half the carrier width (schematic)');
      o.beamW = take('beamW', ov.beamW, null, 1.5, 'outrigger beams 1.5 ft wide');
    }
    // upperworks (turns with the slew)
    const uW = take('upperW', ov.upperW, first(cc, ['upper_width']), kind === 'crawler' ? Math.max(8, Math.min(o.carrier.width, 16)) : Math.max(7, o.carrier.width - 1),
      kind === 'crawler' ? 'upperworks width = carbody width (max 16 ft)' : 'upperworks width = carrier width − 1 ft');
    const cwW = take('cwW', ov.cwW, first(cc, ['upper_width_over_counterweight']), uW, 'counterweight width = upperworks width');
    const tail = o.tail;
    const cwD = take('cwD', ov.cwD, null, Math.max(2.5, 0.22 * (tail || 15)), 'counterweight depth 0.22 × tail-swing radius (min 2.5 ft)');
    let aRear;
    if (tail && tail > cwW / 2 + 0.01) aRear = -Math.sqrt(tail * tail - cwW * cwW / 4);   // the counterweight's rear corners on the tail-swing circle
    else { aRear = -(tail || Math.max(uW, 10)); if (!tail) assumed.push('no tail-swing radius: the counterweight is drawn at the upperworks width behind the rotation centre'); }
    o.cw = { width: Math.min(cwW, tail ? 2 * tail - 0.02 : cwW), depth: cwD, aRear, aFront: aRear + cwD };
    const upFront = take('upperFront', ov.upperFront, null, Math.max(o.footE + 3, uW * 0.55), 'upperworks front = boom-foot pin + 3 ft (min 0.55 × width)');
    o.upper = { width: uW, front: upFront, rear: o.cw.aFront };
    const side = ov.cabSide === 'right' ? -1 : 1;
    o.cab = { a0: upFront - 6.5, a1: upFront + 1.0, b0: side * (uW / 2 - 0.25), b1: side * (uW / 2 + 3.25) };
    assumed.push(`operator cab on the ${side > 0 ? 'left' : 'right'} of the boom, 3.5 × 7.5 ft (schematic)`);
    // boom
    const ent = g.from && g.from.boomW === 'entered' && isNum(g.boomW) && g.boomW > 0 ? g.boomW : null;
    o.boomW = take('boomW', ov.boomW, ent, o.boomType === 'lattice' ? 6 : 3, o.boomType === 'lattice' ? 'lattice boom 6 ft wide (drawing only: the clearance check uses the Heights tab boom width)' : 'telescopic base section 3 ft wide (drawing only: the clearance check uses the Heights tab boom width)');
    if (from.boomW === 'file' && ent) from.boomW = 'entered';   // the Heights tab value (app_inputs.geom.boomW)
    o.sections = Math.max(1, Math.round(take('sections', ov.sections, null, 5, o.boomType === 'telescopic' ? '5 telescopic sections (schematic)' : null)));
    return o;
  }
  /* ---------- the symbol ---------- */
  const upright = r => { let t = norm180(r); if (t > 90) t -= 180; else if (t <= -90) t += 180; return t; };   // text never upside down
  function rectL(a0, a1, b0, b1) { return [[a1, b1], [a1, b0], [a0, b0], [a0, b1]]; }
  function symbol(c, u, o) {
    o = o || {}; const full = o.detail !== 'simple', D = dims(c), fp = LF().footprint(c, u), parts = [], circles = [], texts = [];
    const CF = (lx, ly) => LF().toGrid(u, lx, ly), heading = isNum(u.heading) ? u.heading : 0;
    let slewAz = heading, R = null;
    if (o.hook && isNum(o.hook.x) && isNum(o.hook.y)) { R = Math.hypot(o.hook.x - u.x, o.hook.y - u.y); if (R > 1e-6) slewAz = G().azimuth(u, o.hook); }
    else if (isNum(o.slew)) { slewAz = o.slew; R = isNum(o.R) ? o.R : null; }
    const UF = { x: u.x, y: u.y, heading: slewAz }, UP = (a, b) => LF().toGrid(UF, a, b);
    const add = (g, pts, closed) => { if (pts && pts.length > 1) parts.push({ g, pts, closed: !!closed }); };
    const inC = q => q.map(([a, b]) => CF(a, b)), inU = q => q.map(([a, b]) => UP(a, b));
    // carrier / carbody (the engine footprint where it has one)
    const cw = D.carrier;
    if (fp.body) add('carrier', fp.body, true); else add('carrier', inC(rectL(-cw.rear, cw.front, -cw.width / 2, cw.width / 2)), true);
    if (D.kind === 'crawler') {
      fp.tracks.forEach(t => add('carrier', t, true));
      const p = K().planDims(c), sh = p.crawler && isNum(p.crawler.shoe) ? p.crawler.shoe : 3, g2 = p.crawler && isNum(p.crawler.gauge) ? p.crawler.gauge / 2 : null, L2 = p.crawler && isNum(p.crawler.length) ? p.crawler.length / 2 : null;
      if (g2 != null && L2 != null) [g2, -g2].forEach(y => {
        D.tumbler.xs.forEach(x => { const r = D.tumbler.r; add('carrier', inC(rectL(x - r, x + r, y - sh / 2 + 0.3, y + sh / 2 - 0.3)), true); add('carrier', inC([[x, y - sh / 2], [x, y + sh / 2]]), false); });
        if (full) { const x0 = D.tumbler.xs.length ? Math.min(...D.tumbler.xs) : -L2, x1 = D.tumbler.xs.length ? Math.max(...D.tumbler.xs) : L2;
          for (let x = x0 + D.shoePitch; x < x1 - 1e-6; x += D.shoePitch) add('carrier', inC([[x, y - sh / 2], [x, y + sh / 2]]), false); }
        add('carrier', inC([[-L2, y - sh / 2 + 0.3], [L2, y - sh / 2 + 0.3]]), false); add('carrier', inC([[-L2, y + sh / 2 - 0.3], [L2, y + sh / 2 - 0.3]]), false);
      });
    } else {
      const hw = cw.width / 2, td = D.tyre.d, tw = D.tyre.w;
      D.axles.forEach(x => { add('carrier', inC([[x, -hw + tw], [x, hw - tw]]), false); [hw - tw / 2, -hw + tw / 2].forEach(y => add('carrier', inC(rectL(x - td / 2, x + td / 2, y - tw / 2, y + tw / 2)), true)); });
      if (D.carCab) add('carrier', inC(rectL(D.carCab.a0, D.carCab.a1, D.carCab.b0, D.carCab.b1)), true);
      // outrigger beams: from the carrier side to the float centre (engine footprint beams), drawn with their width
      fp.beams.forEach(([a, b]) => { const dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy); if (L < 1e-6) return; const ux = dx / L, uy = dy / L, nx = -uy * D.beamW / 2, ny = ux * D.beamW / 2;
        const s0 = Math.min(L, hw - 0.5 > 0 ? hw - 0.5 : 0), p0 = { x: a.x + ux * s0, y: a.y + uy * s0 };
        add('outrigger', [{ x: p0.x + nx, y: p0.y + ny }, { x: b.x + nx, y: b.y + ny }, { x: b.x - nx, y: b.y - ny }, { x: p0.x - nx, y: p0.y - ny }], true); });
      fp.floatC.forEach(q => circles.push({ g: 'float', c: { x: q.x, y: q.y }, r: q.r }));
    }
    // front arrow of the carrier (heading)
    const fr = D.kind === 'crawler' ? Math.max(cw.front, (K().planDims(c).crawler || {}).length / 2 || 0) : cw.front;
    add('carrier', inC([[fr + 1, -1.2], [fr + 3, 0], [fr + 1, 1.2]]), false);
    // upperworks
    const U = D.upper, C = D.cw;
    add('upper', inU([[U.front, U.width / 2], [U.front, -U.width / 2], [U.rear, -U.width / 2], [U.rear, U.width / 2]]), true);
    add('upper', inU(rectL(D.cab.a0, D.cab.a1, Math.min(D.cab.b0, D.cab.b1), Math.max(D.cab.b0, D.cab.b1))), true);
    const cwPts = inU(rectL(C.aRear, C.aFront, -C.width / 2, C.width / 2)); add('cwt', cwPts, true);
    // boom: foot pin at e ahead of the rotation centre, the tip over the hook (plan)
    const showBoom = o.boom !== false && isNum(R) && R > D.footE + 0.5;
    let tip = null; const foot = UP(D.footE, 0);
    if (showBoom) {
      tip = UP(R, 0); const Lh = R - D.footE, W = D.boomW;
      if (D.boomType === 'telescopic') {
        const n = D.sections, w = i => W * (1 - 0.45 * i / Math.max(1, n - 1)), a = i => D.footE + Lh * i / n;
        const top = [], bot = [];
        for (let i = 0; i < n; i++) { top.push([a(i), w(i) / 2], [a(i + 1), w(i) / 2]); bot.push([a(i), -w(i) / 2], [a(i + 1), -w(i) / 2]); }
        add('boom', inU(top.concat(bot.reverse())), true);
        for (let i = 1; i < n; i++) add('boom', inU([[a(i), w(i - 1) / 2], [a(i), -w(i - 1) / 2]]), false);
        if (full) add('boom', inU([[D.footE - 0.5, W / 2], [D.footE - 0.5, -W / 2]]), false);
      } else {
        const aT = R - Math.min(4, 0.08 * Lh), wT = W * 0.55, ch = [[D.footE, W / 2], [aT, W / 2], [R, wT / 2]], cl = ch.map(([x, y]) => [x, -y]);
        add('boom', inU(ch), false); add('boom', inU(cl), false); add('boom', inU([[D.footE, W / 2], [D.footE, -W / 2]]), false);
        if (full) { const n = Math.max(2, Math.round((aT - D.footE) / Math.max(2, W))), s = (aT - D.footE) / n, z = [];
          for (let i = 0; i <= n; i++) z.push([D.footE + i * s, (i % 2 ? -1 : 1) * W / 2]);
          add('boom', inU(z), false); }
        else add('boom', inU([[D.footE, 0], [R, 0]]), false);
      }
      // boom head and its sheaves (schematic: 3 sheaves across the head)
      const hw = (D.boomType === 'lattice' ? D.boomW * 0.55 : D.boomW * 0.55) / 2;
      add('boom', inU(rectL(R - 1.2, R + 0.9, -hw, hw)), true);
      [-0.6, 0, 0.6].forEach(f => add('boom', inU([[R - 0.9, f * hw], [R + 0.9, f * hw]]), false));
      // hook block (the load line is plumb below the tip: a point in plan)
      add('hook', inU(rectL(R - 0.7, R + 0.7, -0.9, 0.9)), true); add('hook', inU([[R - 0.7, -0.9], [R + 0.7, 0.9]]), false); add('hook', inU([[R - 0.7, 0.9], [R + 0.7, -0.9]]), false);
      // the load at the hook
      if (Array.isArray(o.loadPolys) && o.loadPolys.length) o.loadPolys.forEach(q => add('load', q, q.length > 2));
      else if (o.load && isNum(o.load.L) && isNum(o.load.W) && o.load.L > 0 && o.load.W > 0) add('load', inU(rectL(R - o.load.L / 2, R + o.load.L / 2, -o.load.W / 2, o.load.W / 2)), true);
    }
    // centre of rotation
    circles.push({ g: 'cor', c: { x: u.x, y: u.y }, r: 0.75 });
    add('cor', [CF(-1.5, 0), CF(1.5, 0)], false); add('cor', [CF(0, -1.5), CF(0, 1.5)], false);
    const slewRel = norm180(slewAz - heading);
    if (o.labels !== false) {
      texts.push({ g: 'label', p: CF(fr + 4, 0), s: `HEADING ${Math.round(((heading % 360) + 360) % 360)}°`, rot: upright(90 - heading), size: 1 });
      if (showBoom) texts.push({ g: 'label', p: UP(D.footE + (R - D.footE) * 0.5, D.boomW / 2 + 1.2), s: `SLEW ${slewRel >= 0 ? '+' : ''}${Math.round(slewRel)}° FROM FRONT, R ${R.toFixed(1)} FT`, rot: upright(90 - slewAz), size: 0.8 });
    }
    return { parts, circles, texts, dims: D, assumed: D.assumed,
      key: { cor: { x: u.x, y: u.y }, heading, slewAz, slewRel, R, foot, tip, floatC: fp.floatC, tail: fp.tail, cwPts, fp } };
  }
  /* ---------- renderers ---------- */
  function draw(sym, out) {
    sym.parts.forEach(q => out.poly && out.poly(q.g, q.pts, q.closed));
    sym.circles.forEach(q => out.circle && out.circle(q.g, q.c, q.r));
    sym.texts.forEach(q => out.text && out.text(q.g, q.p, q.s, q.rot, q.size));
  }
  const COL = { carrier: '#1E3A5F', outrigger: '#0E7490', float: '#B45309', upper: '#166534', cwt: '#7C3AED', boom: '#0F172A', hook: '#DC2626', load: '#DC2626', cor: '#1E3A5F', label: '#0F172A' };
  const FILL = { carrier: ['#64748B', 0.22], outrigger: ['#0E7490', 0.35], float: ['#F59E0B', 0.7], upper: ['#22C55E', 0.18], cwt: ['#7C3AED', 0.35], boom: ['#94A3B8', 0.25], hook: ['#DC2626', 0.4], load: ['#DC2626', 0.15] };
  function svg(sym, X, Y, k, o) {
    o = o || {}; const sw = o.sw || 1, out = [];
    const d = (pts, cl) => pts.map((p, i) => (i ? 'L' : 'M') + X(p.x).toFixed(1) + ' ' + Y(p.y).toFixed(1)).join(' ') + (cl ? ' Z' : '');
    draw(sym, {
      poly: (g, pts, cl) => out.push(`<path d="${d(pts, cl)}" fill="${cl && FILL[g] ? FILL[g][0] : 'none'}"${cl && FILL[g] ? ` fill-opacity="${FILL[g][1]}"` : ''} stroke="${COL[g]}" stroke-width="${sw}"/>`),
      circle: (g, c, r) => out.push(`<circle cx="${X(c.x).toFixed(1)}" cy="${Y(c.y).toFixed(1)}" r="${Math.max(1, r * k).toFixed(1)}" fill="${FILL[g] ? FILL[g][0] : 'none'}"${FILL[g] ? ` fill-opacity="${FILL[g][1]}"` : ''} stroke="${COL[g]}" stroke-width="${sw}"/>`),
      text: o.labels === false ? null : (g, p, s, rot, size) => out.push(`<text x="${X(p.x).toFixed(1)}" y="${Y(p.y).toFixed(1)}" font-size="${(9 * (size || 1)).toFixed(1)}" fill="${COL[g]}" transform="rotate(${(-(rot || 0)).toFixed(1)} ${X(p.x).toFixed(1)} ${Y(p.y).toFixed(1)})">${String(s).replace(/[&<>]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[ch]))}</text>`)
    });
    return out.join('');
  }
  window.CranePickCraneGfx = { GROUPS, COL, FILL, dims, symbol, draw, svg };
})();
