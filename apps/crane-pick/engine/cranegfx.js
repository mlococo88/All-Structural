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
   symbol(crane, setup, o) -> { parts: [{ g, pts, closed, src }], circles: [{ g, c, r, src }], texts: [{ g, p, s, rot, size }], key, dims, assumed }
     o = { hook: { x, y } (the boom points at it; R = its distance from the rotation centre) | slew (azimuth, deg) + R, boom (default true
           when a hook or R is given), load: { L, W } (C2 load in plan, centred on the hook, L along the boom) | loadPolys: [[pt]] (C5 girder),
           detail: 'full' | 'simple' (the map at small zoom), labels (default true) }
     key = { cor, heading, slewAz, slewRel (from the carrier front, −180 … 180), R, foot, tip, floatC (engine/lift.js), tail, cwPts, fp }
     src 'fp': the part is engine/lift.js footprint geometry itself (carrier / carbody outline, tracks, floats; the map draws those already).
     g (group) -> GROUPS[g].layer: the DXF layer (prefixed by the drawing, e.g. C-CRANE-BOOM) and its colour.
   draw(sym, out): out = { poly(g, pts, closed), circle(g, c, r), text(g, p, s, rot, size) } — the one walk every renderer uses.
   svg(sym, X, Y, k, o): SVG markup of the symbol (X, Y: grid ft -> SVG px; k: px per ft), for figures and the Crane tab. */
(function () {
  'use strict';
  const K = () => window.CranePickCranes, LF = () => window.CranePickLift, EL = () => window.CranePickElev, G = () => window.CranePickGeo;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const dval = v => v && typeof v === 'object' && isNum(v.value) ? v.value : (isNum(v) ? v : null);
  const first = (o, ks) => { if (!o) return null; for (const k of ks) { const v = dval(o[k]); if (v != null) return v; } return null; };
  // geometry block (2026-11-17): any basis for the DRAWING (printed / derived / scaled); the engines take printed / derived only (planDims)
  const geo = c => (K().geometryOf ? K().geometryOf(c) : null);
  const gAny = e => e && typeof e === 'object' && isNum(e.value) ? e.value : null;
  const gPg = e => e && typeof e === 'object' && e.page != null ? e.page : null;
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
    label: { layer: 'CRANE-TEXT', aci: 7, label: 'heading / slew labels' },
    mat: { layer: 'CRANE-MAT', aci: 42, label: 'crane mats / plates under the floats or tracks (to scale, Ground input tab)' }
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
      const gm = geo(c), gtc = gm && gm.crawler ? gAny(gm.crawler.tumbler_centres) : null;
      const tc = gtc != null ? gtc : first(cr, ['tumbler_centres']), ch = first(cr, ['crawler_height']);
      const r = take('tumbler', ov.tumblerR, isNum(ch) ? ch / 2 : null, 1.75, 'tumbler radius 1.75 ft');
      o.tumbler = { r: Math.min(r, (L || 30) / 4), xs: [] };
      if (isNum(L)) { const half = isNum(tc) && tc < L ? tc / 2 : L / 2 - o.tumbler.r; o.tumbler.xs = [half, -half]; if (!(isNum(tc) && tc < L)) assumed.push('tumbler centres = track length − 2 × tumbler radius'); }
      o.shoePitch = take('shoePitch', ov.shoePitch, null, 2, 'track shoes drawn at 2 ft (schematic)');
      o.axles = []; o.tyre = null; o.carCab = null;
    } else {
      const gm = geo(c), gc = gm && gm.carrier || {};
      let body = p.body || null; const xF = p.outr && isNum(p.outr.xFront) ? p.outr.xFront : 10, xR = p.outr && isNum(p.outr.xRear) ? p.outr.xRear : 10;
      const gF = gAny(gc.front), gR = gAny(gc.rear), gW = gAny(gc.width);
      if (!(p.src && p.src['body.front'] && /^geometry/.test(p.src['body.front'].key || '')) && gF != null && gR != null && gW != null && !(c.app_inputs && c.app_inputs.plan && c.app_inputs.plan.body)) {
        body = { front: gF, rear: gR, width: gW }; from.carrier = 'file (scaled)'; }
      o.carrier = body ? { front: body.front, rear: body.rear, width: body.width } : { front: xF + 3, rear: xR + 3, width: 8.5 };
      if (!from.carrier) from.carrier = body ? 'engine' : 'assumed'; if (!body) assumed.push('carrier outline: 3 ft beyond the outrigger beams, 8.5 ft wide');
      const Lc = o.carrier.front + o.carrier.rear, gAx = Array.isArray(gc.axles) ? gc.axles.map(gAny).filter(isNum) : [];
      if (gAx.length >= 2 && !isNum(ov.axles)) {
        o.axles = gAx.slice().sort((a, b) => b - a); from.axles = from.axlePos = 'file';
      }
      const nA = Math.max(2, Math.round(isNum(ov.axles) && ov.axles >= 2 ? ov.axles : (type === 'rough-terrain' ? 2 : Math.max(2, Math.min(9, Math.round(Lc / 9))))));
      if (!o.axles) {
      from.axles = isNum(ov.axles) ? 'entered' : 'assumed'; if (!isNum(ov.axles)) assumed.push(`${nA} axles (schematic: from the crane type and carrier length)`);
      const wb = first(cor, ['wheelbase']), rRear = first(cor, ['rotation_to_rear_axle']);
      let a0, a1;
      if (isNum(rRear) && isNum(wb) && nA === 2) { a0 = -rRear; a1 = -rRear + wb; from.axlePos = 'file'; }
      else if (isNum(rRear) && isNum(wb)) { a0 = -rRear; a1 = -rRear + wb; from.axlePos = 'file'; }
      else { a0 = -o.carrier.rear + 0.15 * Lc; a1 = o.carrier.front - (type === 'rough-terrain' ? 0.15 : 0.25) * Lc; from.axlePos = 'assumed'; assumed.push('axle positions spread over the carrier (schematic)'); }
      o.axles = Array.from({ length: nA }, (_, i) => a0 + (a1 - a0) * i / (nA - 1));
      }
      o.tyre = { d: take('tyreD', ov.tyreD, gAny(gc.tyre_d), type === 'rough-terrain' ? 5.5 : 4.5, `tyres ${type === 'rough-terrain' ? '5.5' : '4.5'} ft diameter`), w: take('tyreW', ov.tyreW, null, type === 'rough-terrain' ? 2.3 : 1.9, null) };
      o.tyreTrack = gAny(gc.tyre_track);
      o.carCab = type === 'rough-terrain' ? null : { a0: o.carrier.front - 6, a1: o.carrier.front, b0: 0, b1: o.carrier.width / 2 };
      if (o.carCab) assumed.push('carrier cab at the front left, 6 ft long, half the carrier width (schematic)');
      o.beamW = take('beamW', ov.beamW, null, 1.5, 'outrigger beams 1.5 ft wide');
    }
    // upperworks (turns with the slew)
    const gm2 = geo(c) || {}, gu = gm2.upper || {}, gcw = gm2.counterweight || {};
    const uW = take('upperW', ov.upperW, gAny(gu.width) != null ? gAny(gu.width) : first(cc, ['upper_width']), kind === 'crawler' ? Math.max(8, Math.min(o.carrier.width, 16)) : Math.max(7, o.carrier.width - 1),
      kind === 'crawler' ? 'upperworks width = carbody width (max 16 ft)' : 'upperworks width = carrier width − 1 ft');
    const cwW = take('cwW', ov.cwW, gAny(gcw.width) != null ? gAny(gcw.width) : first(cc, ['upper_width_over_counterweight']), uW, 'counterweight width = upperworks width');
    const tail = o.tail;
    const cwD = take('cwD', ov.cwD, gAny(gcw.depth), Math.max(2.5, 0.22 * (tail || 15)), 'counterweight depth 0.22 × tail-swing radius (min 2.5 ft)');
    let aRear;
    if (tail && tail > cwW / 2 + 0.01) aRear = -Math.sqrt(tail * tail - cwW * cwW / 4);   // the counterweight's rear corners on the tail-swing circle
    else { aRear = -(tail || Math.max(uW, 10)); if (!tail) assumed.push('no tail-swing radius: the counterweight is drawn at the upperworks width behind the rotation centre'); }
    o.cw = { width: Math.min(cwW, tail ? 2 * tail - 0.02 : cwW), depth: cwD, aRear, aFront: aRear + cwD };
    const upFront = take('upperFront', ov.upperFront, gAny(gu.front), Math.max(o.footE + 3, uW * 0.55), 'upperworks front = boom-foot pin + 3 ft (min 0.55 × width)');
    o.upper = { width: uW, front: upFront, rear: o.cw.aFront };
    const gcab = gu.cab || {}, side = (ov.cabSide || gcab.side) === 'right' ? -1 : 1, ca0 = gAny(gcab.a0), ca1 = gAny(gcab.a1);
    o.cab = ca0 != null && ca1 != null ? { a0: ca0, a1: ca1, b0: side * (uW / 2 - 0.25), b1: side * (uW / 2 + 3.25) } : { a0: upFront - 6.5, a1: upFront + 1.0, b0: side * (uW / 2 - 0.25), b1: side * (uW / 2 + 3.25) };
    from.cabSide = ov.cabSide ? 'entered' : gcab.side ? 'file' : 'assumed';
    assumed.push(`operator cab on the ${side > 0 ? 'left' : 'right'} of the boom${gcab.side && !ov.cabSide ? ' (file)' : ''}, ${ca0 != null ? 'length from the file (scaled)' : '7.5 ft long'}, 3.5 ft wide (schematic)`);
    // the manufacturer's boom-foot pin (drawing only: the boom and the checks keep the engine offset e, Heights tab)
    const gbf = gm2.boom_foot || {}; o.mfrFoot = gAny(gbf.x) != null ? { x: gAny(gbf.x), z: gAny(gbf.z), page: gPg(gbf.x), basis: gbf.x.basis } : null;
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
    const add = (g, pts, closed, src) => { if (pts && pts.length > 1) parts.push(src ? { g, pts, closed: !!closed, src } : { g, pts, closed: !!closed }); };
    const inC = q => q.map(([a, b]) => CF(a, b)), inU = q => q.map(([a, b]) => UP(a, b));
    // carrier / carbody (the engine footprint where it has one)
    const cw = D.carrier;
    if (fp.body) add('carrier', fp.body, true, 'fp'); else add('carrier', inC(rectL(-cw.rear, cw.front, -cw.width / 2, cw.width / 2)), true);
    if (D.kind === 'crawler') {
      fp.tracks.forEach(t => add('carrier', t, true, 'fp'));
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
      fp.floatC.forEach((q, i) => { if (q.shape === 'square') add('float', fp.floats[i], true, 'fp'); else circles.push({ g: 'float', c: { x: q.x, y: q.y }, r: q.r, src: 'fp' }); });
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
    // crane mats (2026-11-17): to scale under each float / along each track, from the setup's Ground inputs (drawing only)
    const mt = matsOf(c, u, fp);
    mt.rects.slice().reverse().forEach(q => parts.unshift({ g: 'mat', pts: q, closed: true }));   // under everything else
    if (mt.text && o.labels !== false && mt.at) texts.push({ g: 'mat', p: mt.at, s: mt.text, rot: upright(90 - heading), size: 0.7 });
    // the manufacturer's boom-foot pin where it differs from the engine offset e (drawing only)
    if (D.mfrFoot && Math.abs(D.mfrFoot.x - D.footE) > 0.25) { const q = UP(D.mfrFoot.x, 0); circles.push({ g: 'boom', c: q, r: 0.6 }); add('boom', [UP(D.mfrFoot.x - 1, 0), UP(D.mfrFoot.x + 1, 0)], false); add('boom', [UP(D.mfrFoot.x, -1), UP(D.mfrFoot.x, 1)], false); }
    // centre of rotation
    circles.push({ g: 'cor', c: { x: u.x, y: u.y }, r: 0.75 });
    add('cor', [CF(-1.5, 0), CF(1.5, 0)], false); add('cor', [CF(0, -1.5), CF(0, 1.5)], false);
    const slewRel = norm180(slewAz - heading);
    if (o.labels !== false) {
      texts.push({ g: 'label', p: CF(fr + 4, 0), s: `HEADING ${Math.round(((heading % 360) + 360) % 360)}°`, rot: upright(90 - heading), size: 1 });
      if (showBoom) texts.push({ g: 'label', p: UP(D.footE + (R - D.footE) * 0.5, D.boomW / 2 + 1.2), s: `SLEW ${slewRel >= 0 ? '+' : ''}${Math.round(slewRel)}° FROM FRONT, R ${R.toFixed(1)} FT`, rot: upright(90 - slewAz), size: 0.8 });
    }
    return { parts, circles, texts, dims: D, assumed: D.assumed,
      key: { cor: { x: u.x, y: u.y }, heading, slewAz, slewRel, R, foot, tip, floatC: fp.floatC, tail: fp.tail, cwPts, fp, mats: mt } };
  }
  /* matsOf(crane, setup, fp) -> { rects: [grid poly], text, at, list: [{ id, B, L, n }], note } — the mats as entered on the Ground input tab
     (setup.ground.mat: B, L, t; crawlers also w = each mat's width along the track, n = mats per track). Floats: one mat B × L centred on
     each float, B along the carrier (x), L across it (y); its bearing check is symmetric in B and L (engine/ground.js). Crawlers: n mats
     B (across the track, centred on it) × w (along it), laid side by side centred on the track; n or w not entered: one strip B wide over
     the track length (drawn, flagged). */
  function matsOf(c, u, fp) {
    const g = u && u.ground && u.ground.mat, out = { rects: [], text: '', at: null, list: [], note: '' };
    if (!g || !g.type || g.type === 'none' || !(g.B > 0)) return out;
    const p = K().planDims(c), r = (x0, x1, y0, y1) => [LF().toGrid(u, x1, y1), LF().toGrid(u, x1, y0), LF().toGrid(u, x0, y0), LF().toGrid(u, x0, y1)];
    const fi = v => { const t = Math.round(v * 12), f = Math.floor(t / 12); return `${f}'-${t - 12 * f}"`; };
    if (p.kind === 'crawler') {
      const cr = p.crawler || {}; if (!isNum(cr.length) || !isNum(cr.gauge)) return out;
      const n = isNum(g.n) && g.n >= 1 ? Math.round(g.n) : null, w = isNum(g.w) && g.w > 0 ? g.w : null;
      [cr.gauge / 2, -cr.gauge / 2].forEach((y, i) => {
        if (n && w) { const L = n * w; for (let k = 0; k < n; k++) { const x0 = -L / 2 + k * w; out.rects.push(r(x0, x0 + w, y - g.B / 2, y + g.B / 2)); } }
        else out.rects.push(r(-cr.length / 2, cr.length / 2, y - g.B / 2, y + g.B / 2));
        out.list.push({ id: i ? 'TR' : 'TL', B: g.B, L: n && w ? w : cr.length, n: n && w ? n : 1 });
      });
      out.text = n && w ? `MATS ${n} PER TRACK, ${fi(g.B)} ACROSS x ${fi(w)}${isNum(g.t) ? ', ' + g.t + ' IN THICK' : ''}` : `MATS ${fi(g.B)} ACROSS THE TRACKS (COUNT / WIDTH NOT ENTERED)`;
      out.note = n && w ? '' : 'mat count / width along the track not entered: drawn as one strip per track';
      out.at = LF().toGrid(u, -cr.length / 2 - 2, cr.gauge / 2 + g.B / 2 + 1);
      return out;
    }
    if (!(g.L > 0) || !fp.floatC.length) return out;
    fp.floatC.forEach(q => { out.rects.push(r(q.lx - g.B / 2, q.lx + g.B / 2, q.ly - g.L / 2, q.ly + g.L / 2)); out.list.push({ id: q.id, B: g.B, L: g.L, n: 1 }); });
    const f0 = fp.floatC[0]; out.at = LF().toGrid(u, f0.lx + g.B / 2 + 1, f0.ly + g.L / 2 + 0.5);
    out.text = `MAT ${fi(g.B)} (ALONG CARRIER) x ${fi(g.L)}${isNum(g.t) ? ', ' + g.t + ' IN' : ''} UNDER EACH FLOAT`;
    return out;
  }
  /* floatTable(crane, setup, zone, proj4) -> [{ id, name, lx, ly, x, y, E, N, lat, lng }] — the support centres the drawing and the engines
     use: float centres (wheeled) or track centre-line ends (crawlers: TL / TR front and rear ends of the track centre lines). lx along the
     carrier (+ front), ly across (+ left), from the centre of rotation; x, y State Plane grid (US ft); E, N in the zone's unit; lat / lng
     NAD 83 (as WGS 84) when proj4 is given. */
  const FNAME = { FL: 'front left', FR: 'front right', RL: 'rear left', RR: 'rear right' };
  function floatTable(c, u, zone, proj4) {
    const fp = LF().footprint(c, u), p = K().planDims(c), rows = [];
    if (p.kind === 'crawler') { const cr = p.crawler || {}; if (isNum(cr.length) && isNum(cr.gauge)) [['TL', 1], ['TR', -1]].forEach(([id, sy]) => [['front', 1], ['rear', -1]].forEach(([e, sx]) => rows.push({ id: id + (sx > 0 ? 'f' : 'r'), name: `${sy > 0 ? 'left' : 'right'} track, ${e} end (centre line)`, lx: sx * cr.length / 2, ly: sy * cr.gauge / 2 }))); }
    else fp.floatC.forEach(q => rows.push({ id: q.id, name: FNAME[q.id] + ' float centre', lx: q.lx, ly: q.ly }));
    rows.forEach(r => { const gq = LF().toGrid(u, r.lx, r.ly); r.x = gq.x; r.y = gq.y; addCoords(r, zone, proj4); });
    return rows;
  }
  function addCoords(r, zone, proj4) {
    const g = G(); if (zone && g.ftToNative) { r.E = g.ftToNative(zone, r.x); r.N = g.ftToNative(zone, r.y); }
    if (proj4 && zone && g.ftToLl) { try { const ll = g.ftToLl(proj4, zone, r.x, r.y); r.lat = ll.lat; r.lng = ll.lng; } catch (e) { /* no lat / long */ } }
    return r;
  }
  /* stakeoutCsv(P, proj4, cranes) -> CSV text: per setup the crane centre, its float centres / track ends, and per pick its pick and set
     points (State Plane E / N in the zone's unit, lat / long, and local x / y from the crane centre for the supports) */
  function stakeoutCsv(P, proj4, craneOf) {
    const z = P.site && P.site.zone, q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"', n = (v, d) => isNum(v) ? v.toFixed(d) : '';
    const unit = G().zone ? (G().zone(z).unit === 'm' ? 'm' : 'ftUS') : 'ftUS';
    const out = [[`Point`, `Setup`, `Description`, `Easting (${unit})`, `Northing (${unit})`, 'Latitude', 'Longitude', 'Local x along carrier (ft, + front)', 'Local y across (ft, + left)'].map(q).join(',')];
    const row = (id, su, d, r) => out.push([q(id), q(su), q(d), n(r.E, 3), n(r.N, 3), n(r.lat, 8), n(r.lng, 8), n(r.lx, 3), n(r.ly, 3)].join(','));
    (P.setups || []).forEach(u => {
      const c = craneOf(u); row(u.name + ' CR', u.name, `centre of rotation (heading ${n(u.heading, 1)} deg)`, addCoords({ x: u.x, y: u.y, lx: 0, ly: 0 }, z, proj4));
      if (c) floatTable(c, u, z, proj4).forEach(r => row(u.name + ' ' + r.id, u.name, r.name, r));
      (P.picks || []).filter(k => k.setupId === u.id).forEach(k => { row(k.name + ' PICK', u.name, 'pick point (hook)', addCoords({ x: k.pick.x, y: k.pick.y }, z, proj4)); row(k.name + ' SET', u.name, 'set point (hook)', addCoords({ x: k.set.x, y: k.set.y }, z, proj4)); });
    });
    return out.join('\r\n') + '\r\n';
  }
  /* clearDims(crane, setup, items) -> [{ from ('FL' … | 'TL' / 'TR' | 'TAIL'), item, name, type, d, p (on the crane part), q (on the item) }]
     — plan distance from each float / track and from the tail-swing circle to the nearest site item (obstruction, buried utility / wall,
     exclusion zone, power line in plan; 0 = overlapping). Display only (the lift-plan sheet's clearance dimensions): the checks are
     engine/lift.js clearances() and engine/clear3d.js. */
  function closest(A, ca, B, cb) {
    const g = G(), pr = (p, a, b) => { const dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy, t = L2 ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2)) : 0; return { x: a.x + t * dx, y: a.y + t * dy }; };
    const ed = (P, cl) => { const e = []; for (let i = 0; i < P.length - (cl ? 0 : 1); i++) e.push([P[i], P[(i + 1) % P.length]]); if (P.length === 1) e.push([P[0], P[0]]); return e; };
    if (cb && B.length > 2) { const v = A.find(p => g.inside(p, B)); if (v) return { d: 0, p: v, q: v }; }
    if (ca && A.length > 2) { const v = B.find(p => g.inside(p, A)); if (v) return { d: 0, p: v, q: v }; }
    let best = { d: Infinity, p: null, q: null };
    A.forEach(p => ed(B, cb).forEach(([a, b]) => { const q = pr(p, a, b), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < best.d) best = { d, p, q }; }));
    B.forEach(q => ed(A, ca).forEach(([a, b]) => { const p = pr(q, a, b), d = Math.hypot(p.x - q.x, p.y - q.y); if (d < best.d) best = { d, p, q }; }));
    return best;
  }
  function clearDims(c, u, items) {
    const fp = LF().footprint(c, u), parts = [], out = [], its = (items || []).filter(it => ['obst', 'util', 'excl', 'power'].includes(it.type) && Array.isArray(it.pts) && it.pts.length);
    fp.floats.forEach((q, i) => parts.push({ from: (fp.floatC[i] && fp.floatC[i].id) || 'F' + (i + 1), pts: q, cl: true }));
    fp.tracks.forEach((q, i) => parts.push({ from: i ? 'TR' : 'TL', pts: q, cl: true }));
    if (isNum(fp.tail)) parts.push({ from: 'TAIL', pts: LF().circle(u, fp.tail, 96), cl: true });
    parts.forEach(pt => { let b = null; its.forEach(it => { const cl = it.type === 'obst' || it.type === 'excl' || (it.type === 'util' && it.closed && it.pts.length > 2); const r = closest(pt.pts, pt.cl, it.pts, cl); if (!b || r.d < b.d) b = Object.assign({ from: pt.from, item: it.id, name: it.name || it.type, type: it.type }, r); });
      if (b && isFinite(b.d)) out.push(b); });
    return out;
  }
  /* dimCheck(crane, setup) -> [{ item, drawn, mfr, page, basis, ok: true | false | null, note }] — each drawn dimension against the manufacturer's
     value (geometry block, else the file's dims) and its page. ok null: not given by the manufacturer (drawn from an assumption). */
  function dimCheck(c, u) {
    const D = dims(c), p = K().planDims(c), fp = LF().footprint(c, u || { x: 0, y: 0, heading: 0 }), gm = geo(c) || {}, rows = [];
    const add = (item, drawn, e, note, tol) => { const m = gAny(e); rows.push({ item, drawn, mfr: m, page: gPg(e), basis: e && e.basis || (m != null ? 'printed' : null), ok: m == null || !isNum(drawn) ? null : Math.abs(drawn - m) <= (tol || 0.01), note: note || (e && e.as_printed ? 'as printed: ' + e.as_printed : '') }); };
    const fileE = (path, at) => { const s = p.src[path]; return s && s.from === 'file' && !/^geometry/.test(s.key || '') ? { value: at, page: s.page, basis: 'printed', as_printed: 'file dims.' + s.key } : null; };
    add('Tail-swing radius', p.tail, (gm.counterweight || {}).tail_radius || fileE('tail', p.tail));
    if (p.kind === 'crawler') {
      const cr = gm.crawler || {};
      add('Track length', p.crawler && p.crawler.length, cr.length || fileE('crawler.length', p.crawler && p.crawler.length));
      add('Track gauge (centre to centre)', p.crawler && p.crawler.gauge, cr.gauge || fileE('crawler.gauge', p.crawler && p.crawler.gauge));
      add('Shoe width', p.crawler && p.crawler.shoe, cr.shoe || fileE('crawler.shoe', p.crawler && p.crawler.shoe));
      add('Tumbler centres', D.tumbler && D.tumbler.xs.length ? D.tumbler.xs[0] - D.tumbler.xs[1] : null, cr.tumbler_centres, D.tumbler && D.tumbler.xs.length && !gAny(cr.tumbler_centres) ? 'drawn: track length − 2 × tumbler radius (assumed)' : null, 0.05);
      add('Crawler centre ahead of the rotation centre', 0, cr.x_centre, 'drawn and analysed centred on the rotation centre', 0.15);
    } else {
      const go = gm.outriggers || {}, o = p.outr || {};
      add('Front float centre line ahead of the rotation centre', o.xFront, go.x_front || fileE('outr.xFront', o.xFront));
      add('Rear float centre line behind the rotation centre', o.xRear, go.x_rear || fileE('outr.xRear', o.xRear));
      Object.keys(o.spreads || {}).forEach(k => add(`Spread "${k}" (float centre to centre)${fp.spread === k ? ' — drawn' : ''}`, o.spreads[k], (go.spreads || {})[k] || fileE('outr.spreads.' + k, o.spreads[k])));
      add(`Float size (${o.floatShape || 'round'})`, o.float, (go.float || {}).size || fileE('outr.float', o.float));
      const gc = gm.carrier || {};
      add('Carrier front of the rotation centre', D.carrier.front, gc.front, null, 0.05); add('Carrier rear of the rotation centre', D.carrier.rear, gc.rear, null, 0.05); add('Carrier width', D.carrier.width, gc.width, null, 0.05);
      const gAx = Array.isArray(gc.axles) ? gc.axles : []; (D.axles || []).forEach((x, i) => add(`Axle ${i + 1} (x from the rotation centre)`, x, gAx.slice().sort((a, b) => gAny(b) - gAny(a))[i], null, 0.05));
    }
    const gcw = gm.counterweight || {}, gu = gm.upper || {};
    add('Counterweight width', D.cw.width, gcw.width, D.from.cwW === 'assumed' ? 'drawn from an assumption' : null, 0.05);
    add('Counterweight depth', D.cw.depth, gcw.depth, D.from.cwD === 'assumed' ? 'drawn from an assumption' : null, 0.05);
    add('Upperworks width', D.upper.width, gu.width, D.from.upperW === 'assumed' ? 'drawn from an assumption' : null, 0.05);
    const bf = gm.boom_foot || {};
    add('Boom-foot pin, x (+ ahead of the rotation centre)', D.footE, bf.x, D.mfrFoot && Math.abs(D.mfrFoot.x - D.footE) > 0.25 ? 'the boom and the height checks use the Heights tab offset e; the manufacturer pin is marked (⊕) on the drawing' : null, 0.05);
    return rows;
  }
  /* ---------- renderers ---------- */
  function draw(sym, out) {
    sym.parts.forEach(q => out.poly && out.poly(q.g, q.pts, q.closed));
    sym.circles.forEach(q => out.circle && out.circle(q.g, q.c, q.r));
    sym.texts.forEach(q => out.text && out.text(q.g, q.p, q.s, q.rot, q.size));
  }
  const COL = { mat: '#92400E', carrier: '#1E3A5F', outrigger: '#0E7490', float: '#B45309', upper: '#166534', cwt: '#7C3AED', boom: '#0F172A', hook: '#DC2626', load: '#DC2626', cor: '#1E3A5F', label: '#0F172A' };
  const FILL = { mat: ['#D97706', 0.18], carrier: ['#64748B', 0.22], outrigger: ['#0E7490', 0.35], float: ['#F59E0B', 0.7], upper: ['#22C55E', 0.18], cwt: ['#7C3AED', 0.35], boom: ['#94A3B8', 0.25], hook: ['#DC2626', 0.4], load: ['#DC2626', 0.15] };
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
  window.CranePickCraneGfx = { GROUPS, COL, FILL, dims, symbol, draw, svg, matsOf, floatTable, stakeoutCsv, dimCheck, clearDims };
})();
