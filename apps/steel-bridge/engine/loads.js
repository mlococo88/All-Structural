/* apps/steel-bridge/engine/loads.js — the cross-section and the dead loads per girder (window.SBDLoads). Classic script, no DOM.
   Needs window.SharedSteps, window.SBDSections, window.SBDOwners and window.SBDLldf, loaded first (read at call time).

   Ported 2026-10-29 from GirderDetail ("Steel Bridge Design.html"), LLDF and DLs module: GM.df.compute (whole: input checks,
   deck edges, live-load traffic faces, the regions and factors through SBDLldf, the dead loads) and the functions it calls:
   numRows, parseDim, dfOpt, dfXsIn, dfEdgeIn, dfBridgeEff, dfEdges, dfLLFace, dfDead; and the girder self-weight of the
   Structural analysis (GM.sa.compute: wSt, SA_PLF). The arithmetic is the same, operation for operation (tests/engine/loads.test.mjs).
   New here: the worked steps of every load and of each girder's share, and fromModel(), which builds the module input from
   the sbd2 project (engine/model.js).

   Units: deck positions, widths, spacings, overhangs ft (x from the left deck edge); thicknesses, curb sizes, plates in;
   unit weights kcf; area loads psf; line loads klf; point loads kip.
   Code: AASHTO LRFD 10th Ed. (2024) Art. 3.5.1 (dead loads), 4.6.2.2.1 (permanent loads distributed equally, "Typical
   AASHTO"), 3.6.1.6 (pedestrian load); MassDOT LRFD Bridge Manual Part I 3.5.3 (pile-cap distribution of superimposed
   dead loads, Fig. 3.5.3-1 beam classes), RIDOT BDM 3.3.1 (60/40), owner rules through SBDOwners.

   Module input (the shape of GirderDetail's: b the bridge, p the module's own inputs):
     b: { ok, nb, S, bays [ft], ohL, ohR, barrier (ft), barW (klf), faceL, faceR (ft), edge (null or per side { mode, … }),
          tsDeck (structural slab, in), tsac (sacrificial / integral wearing thickness, dead load only, in), haunch (in), fc (ksi), wc (kcf),
          wcE (kcf, for E_c only; optional), fws (psf), sip (psf), spans [ft], cont, skews [deg per support], regions (SBDLldf.regions),
          lf (owner load rules, SBDOwners.loadFactors) }
     p: { gap, kg, skewV, extMin, dl: { method, ped, swL, swThkL, swR, swThkR, medW, medThk, medJoint, wcA, fenceL, fenceXL, fenceR, fenceXR,
          wsMode, wsThk, wsGam }, extra: [{ name, cat, x, plf, dist }], ovl: [{ name, mode, psf, thk, gam }],
          edges: { L, R: { type, bw, bwt, cw, ch, rw, rp, rf, face } } | absent, loadOverrides: { id: { x, plf, dist } }, beamClass: { i: class } } */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4);
  const f2 = x => (typeof x === 'number' && isFinite(x) ? x : NaN).toFixed(2);   // GirderDetail f2 (text of a message)

  /* GirderDetail parseDim / nm: a number, or text such as "1 1/2" */
  function parseDim(v) { if (typeof v === 'number') return v; if (v == null) return NaN; let s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' '); if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3]; m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2]; const n = Number(s); return isFinite(n) ? n : NaN; }
  const nm = v => typeof v === 'number' ? v : parseDim(v);
  const opt = v => (v == null || v === '' || (typeof v === 'number' && isNaN(v))) ? null : nm(v);   // GirderDetail dfOpt
  function numRows(rows, spec, lbl, errors) { return (rows || []).map((r0, i) => { const r = { i, name: r0.name || `${lbl} ${i + 1}` };
    spec.forEach(([k, label, ty, o]) => { if (ty === 'text' || ty === 'sel') { r[k] = r0[k]; return; }
      if (o && o.opt && (r0[k] == null || r0[k] === '' || (typeof r0[k] === 'number' && isNaN(r0[k])))) { r[k] = null; return; }
      const v = nm(r0[k]); r[k] = v; const min = o && o.min !== undefined ? o.min : 1e-12;
      if (!isFinite(v) || v < min) errors.push(`${r.name}: "${label}" must be ${min === 0 ? 'zero or positive' : 'positive'}.`); }); return r; }); }
  // GirderDetail GM.df.rowSpec / rowSpec2 (name, label, type, options)
  const CATS = { DC2: 'DC2', DW: 'DW', DC1: 'DC1', PL: 'Pedestrian LL', UT: 'Utility (noncomposite, DW factors)', UF: 'Future utility allowance (noncomposite, γ 1.25/0)' };
  const ROW_EXTRA = [['name', 'Description', 'text'], ['cat', 'Category', 'sel'], ['x', 'Location from left deck edge', 'num', { min: 0 }], ['plf', 'Line load', 'num', { min: 0 }], ['dist', 'Distribution', 'sel']];
  const ROW_OVL = [['name', 'Description', 'text'], ['mode', 'Entered as', 'sel'], ['psf', 'Weight', 'num', { min: 0, opt: true }], ['thk', 'Thickness', 'num', { min: 0, opt: true }], ['gam', 'Unit weight', 'num', { min: 0, opt: true }]];
  const DIST = { pilecap: 'MassDOT pile-cap', equal: 'Equal', two: 'Two adjacent', r64: 'RIDOT 60/40' };
  const CLS = { 'ext-curb': 'Exterior safety curb beam', interior: 'Interior beam', 'first-int': '1st interior roadway beam', 'ext-sw': 'Exterior sidewalk beam', 'int-sw': 'Interior sidewalk beam', 'median-int': 'Median beam (continuous slab, interior)', 'median-ext': 'Median beam (joint, exterior)' };
  const METHODS = { massdot: 'MassDOT 3.5.3 (pile-cap for superimposed DC; wearing surface equally)', aashto: 'Typical AASHTO (all loads equally to all beams)', ridot: 'RIDOT BDM 3.3.1 (barriers and sidewalks 60% fascia beams, 40% interior beams)' };
  const STEEL_PLF = 3.4;   // lb per ft per in² of steel (490 pcf; GirderDetail SA_PLF: 490/144 = 3.403, taken as 3.4)

  /* optional cross-section inputs (GirderDetail dfXsIn): appurtenance concrete w_c, sidewalk fences, wearing surface by thickness, overlays */
  function xsIn(p, errors) {
    const dl = p.dl || {}, o = { wcA: null, fenceL: null, fenceXL: null, fenceR: null, fenceXR: null, wsThk: null, wsGam: null, fws: null, ovl: [] };
    const wcA = opt(dl.wcA); if (wcA !== null) { if (wcA > 0) o.wcA = wcA; else errors.push('Appurtenance concrete unit weight must be positive (or blank for the deck w_c).'); }
    ['L', 'R'].forEach(sd => { const w = opt(dl['fence' + sd]), x = opt(dl['fenceX' + sd]), sw = nm(dl['sw' + sd]) > 0 ? nm(dl['sw' + sd]) : 0, nm_ = sd === 'L' ? 'Left' : 'Right';
      if (w === null && x === null) return;
      if (w !== null && !(w >= 0)) errors.push(`${nm_} sidewalk railing or fence: the weight must be zero or positive.`);
      if (!(x > 0 && x <= sw + 1e-9)) errors.push(`${nm_} sidewalk railing or fence: its position from the deck edge must be on the ${sd === 'L' ? 'left' : 'right'} sidewalk (0 < x ≤ ${sw > 0 ? sw + ' ft' : 'the sidewalk width; no sidewalk is entered'}).`);
      o['fence' + sd] = w !== null && w > 0 ? w : 0; o['fenceX' + sd] = x; });
    if (dl.wsMode === 'thk') { const t = opt(dl.wsThk), g = opt(dl.wsGam);
      if (!(t > 0) || !(g > 0)) errors.push('Wearing surface by thickness: enter a positive thickness and unit weight.'); else { o.wsThk = t; o.wsGam = g; o.fws = t / 12 * g * 1000; } }
    const ov = numRows(Array.isArray(p.ovl) ? p.ovl : [], ROW_OVL, 'Overlay', errors);
    o.ovl = ov.map(r => { if (r.mode === 'thk') { if (!(r.thk > 0) || !(r.gam > 0)) { errors.push(`${r.name}: enter a positive thickness and unit weight.`); return null; } return { name: r.name, q: r.thk / 12 * r.gam * 1000, thk: r.thk, gam: r.gam }; }
      if (r.psf === null) { errors.push(`${r.name}: enter its weight in psf.`); return null; } return { name: r.name, q: r.psf }; }).filter(Boolean);
    return o;
  }

  /* deck edges (GirderDetail dfEdgeIn): per side a barrier (bw width at the deck ft, bwt klf) or a curb (cw, ch in) and railing (rw klf at
     rp ft; traffic face rf, blank = rp). Traffic face at the deck edge: the barrier width; a curb lower than 12 in is mountable and the railing
     face governs; 12 in or higher, the curb face (or the railing face if farther in). An entered "edge to traffic face" governs. */
  const EDGE_K = ['bw', 'bwt', 'cw', 'ch', 'rw', 'rp', 'rf', 'face'];
  const EDGE_LBL = { bw: 'the barrier width', bwt: 'the barrier weight', cw: 'the curb width', ch: 'the curb height', rw: 'the railing weight', rp: 'the railing load point', rf: 'the railing traffic face', face: 'the edge to traffic face' };
  function edgeIn(E, errors) {
    if (!E || !E.L || !E.R) return null; const o = {};
    ['L', 'R'].forEach(sd => { const e = E[sd] || {}, nm_ = sd === 'L' ? 'Left' : 'Right', q = { type: e.type === 'curb' ? 'curb' : 'barrier' };
      EDGE_K.forEach(k => { q[k] = opt(e[k]); });
      (q.type === 'curb' ? ['cw', 'ch', 'rw', 'rp'] : ['bw', 'bwt']).forEach(k => { if (!(q[k] !== null && q[k] >= 0)) errors.push(`${nm_} deck edge: enter ${EDGE_LBL[k]} (zero or positive).`); });
      ['rf', 'face'].forEach(k => { if (q[k] !== null && !(q[k] >= 0)) errors.push(`${nm_} deck edge: ${EDGE_LBL[k]} must be zero or positive (or blank).`); });
      if (q.type === 'barrier') { q.fAuto = q.bw; q.fbyAuto = 'barrier face'; }
      else { const rf = q.rf !== null ? q.rf : q.rp, cf = q.cw / 12; q.mount = !(q.ch >= 12 - 1e-9);
        if (q.mount) { q.fAuto = rf; q.fbyAuto = `railing face (the ${f2(q.ch)} in curb is mountable, < 12 in)`; }
        else if (rf > cf + 1e-9) { q.fAuto = rf; q.fbyAuto = 'railing face'; } else { q.fAuto = cf; q.fbyAuto = `curb face (${f2(q.ch)} in ≥ 12 in)`; } }
      if (q.face !== null) { q.f = q.face; q.fby = 'edge to traffic face entered'; } else { q.f = q.fAuto; q.fby = q.fbyAuto; }
      o[sd] = q; });
    return o;
  }
  /* the bridge with the module's deck edges in place of the ones sent (GirderDetail dfBridgeEff) */
  function bridgeEff(b, Ed) {
    if (!Ed) return b; const edge = {};
    ['L', 'R'].forEach(sd => { const q = Ed[sd]; edge[sd] = q.type === 'curb' ? { mode: 'curb', cw: q.cw, ch: q.ch, rp: q.rp, rw: q.rw, fby: q.fby } : { mode: 'barrier', bw: q.bw, w: q.bwt, fby: q.fby }; });
    return { ...b, edge, faceL: Ed.L.f, faceR: Ed.R.f, gdEdges: Ed };
  }
  /* edge line loads (GirderDetail dfEdges): a barrier, or a curb (cw/12 × ch/12 × w_c) plus a railing, per side; x from that side's edge */
  function edgeLoads(b, wcA) {
    const out = [];
    ['L', 'R'].forEach(sd => { const e = b.edge && b.edge[sd], nm_ = sd === 'L' ? 'Left' : 'Right';
      if (e && e.mode === 'curb') { if (e.cw > 0 && e.ch > 0) out.push({ id: 'curb' + sd, desc: `${nm_} curb`, cat: 'DC2', side: sd, x: e.cw / 24, plf: e.cw / 12 * e.ch / 12 * (wcA > 0 ? wcA : b.wc), def: { kind: 'curb', cw: e.cw, ch: e.ch, wc: wcA > 0 ? wcA : b.wc } });
        if (e.rw > 0) out.push({ id: 'rail' + sd, desc: `${nm_} railing`, cat: 'DC2', side: sd, x: e.rp, plf: e.rw }); }
      else if (e && e.mode === 'barrier') { if (e.w > 0) out.push({ id: 'bar' + sd, desc: `${nm_} barrier`, cat: 'DC2', side: sd, x: e.bw / 2, plf: e.w }); }
      else if (b.barW > 0) out.push({ id: 'bar' + sd, desc: `${nm_} barrier`, cat: 'DC2', side: sd, x: b.barrier / 2, plf: b.barW }); });
    return out;
  }
  /* live-load traffic face each side (GirderDetail dfLLFace): the innermost non-mountable element: the deck-edge face, a sidewalk
     12 in or thicker (its curb face), or a railing or fence on the sidewalk; a sidewalk thinner than 12 in is mountable and ignored */
  function llFaces(b, dl, xs, fL, fR) {
    const o = {};
    ['L', 'R'].forEach(sd => { const f = sd === 'L' ? fL : fR, sw = nm(dl['sw' + sd]) > 0 ? nm(dl['sw' + sd]) : 0, t = nm(dl['swThk' + sd]), curb = !!(b.edge && b.edge[sd] && b.edge[sd].mode === 'curb');
      const mount = sw > 0 && !(t >= 12 - 1e-9), c = [{ x: f, by: b.edge && b.edge[sd] && b.edge[sd].fby ? b.edge[sd].fby : curb ? 'curb and railing traffic face' : 'barrier face' }];
      if (sw > 0 && !mount) c.push({ x: sw, by: `sidewalk curb face (${f2(t)} in ≥ 12 in)` });
      const fx = xs && xs['fenceX' + sd]; if (sw > 0 && fx > 0) c.push({ x: fx, by: 'railing or fence on the sidewalk' });
      const g = c.reduce((a, q) => q.x > a.x + 1e-9 ? q : a);
      o[sd] = { r: g.x, by: g.by, mount, sw, t, rOld: Math.max(f, sw) }; });
    return o;
  }

  /* dead(p, geo, a): the line loads across the deck and each girder's share (GirderDetail dfDead).
     p: { Nb, OL, ts (deck thickness for the weight, in), fL, fR }; geo: SBDLldf.geometry; a: the dead-load inputs (dl with numbers,
     fws, uwc, uwcA, hh, sip, bf (top flange width, in), edges (edgeLoads), extra, fences, ws, ovl, ovr (overrides), bcls (beam classes)).
     Deck: tributary width (half bays, the overhang on the exterior girder) × t × w_c; haunch h × b_f × w_c; SIP forms on the clear bays.
     Line loads by method: 'massdot' pile-cap P/N + max(0, P e c_i / Σc²) (wearing surface equally); 'aashto' equally; 'ridot' 60/40;
     'two' the two adjacent girders (a load outside an exterior girder levered about the first interior one). */
  function dead(p, geo, a) {
    const N = p.Nb, ub = geo.pos.map(x => p.OL + x), Wd = geo.Wdeck, uc = a.uwc, ua = a.uwcA > 0 ? a.uwcA : uc, F = [];
    const swL = a.swL > 0 ? a.swL : 0, swR = a.swR > 0 ? a.swR : 0;
    (a.edges || []).forEach(E => F.push({ ...E, x: E.side === 'L' ? E.x : Wd - E.x }));
    if (swL) F.push({ id: 'swL', desc: 'Left sidewalk slab', cat: 'DC2', x: swL / 2, plf: swL * a.swThkL / 12 * ua, x0: 0, x1: swL, def: { kind: 'sw', w: swL, t: a.swThkL, wc: ua } });
    if (swR) F.push({ id: 'swR', desc: 'Right sidewalk slab', cat: 'DC2', x: Wd - swR / 2, plf: swR * a.swThkR / 12 * ua, x0: Wd - swR, x1: Wd, def: { kind: 'sw', w: swR, t: a.swThkR, wc: ua } });
    if (a.fenceL > 0) F.push({ id: 'fenceL', desc: 'Left sidewalk railing or fence', cat: 'DC2', x: a.fenceXL, plf: a.fenceL });
    if (a.fenceR > 0) F.push({ id: 'fenceR', desc: 'Right sidewalk railing or fence', cat: 'DC2', x: Wd - a.fenceXR, plf: a.fenceR });
    if (a.medW > 0) F.push({ id: 'med', desc: 'Raised median', cat: 'DC2', x: Wd / 2, plf: a.medW * a.medThk / 12 * ua, x0: Wd / 2 - a.medW / 2, x1: Wd / 2 + a.medW / 2, joint: a.medJoint === 'yes', def: { kind: 'sw', w: a.medW, t: a.medThk, wc: ua } });
    const wx0 = Math.max(p.fL, swL), wx1 = Wd - Math.max(p.fR, swR);
    if (a.fws > 0 && wx1 > wx0) F.push({ id: 'ws', desc: 'Future wearing surface', cat: 'DW', x: (wx0 + wx1) / 2, plf: a.fws / 1000 * (wx1 - wx0), x0: wx0, x1: wx1, forceEqual: true, ...(a.wsThk > 0 ? { q: a.fws, thk: a.wsThk, gam: a.wsGam } : {}), def: { kind: 'area', q: a.fws } });
    (a.ovl || []).forEach((o, k) => { if (o.q > 0 && wx1 > wx0) F.push({ id: 'ovl' + k, desc: o.name, cat: 'DW', x: (wx0 + wx1) / 2, plf: o.q / 1000 * (wx1 - wx0), x0: wx0, x1: wx1, forceEqual: true, q: o.q, thk: o.thk, gam: o.gam, def: { kind: 'area', q: o.q } }); });
    const wkL = Math.max(swL - p.fL, 0), wkR = Math.max(swR - p.fR, 0);
    if (a.ped > 0) { if (wkL) F.push({ id: 'pedL', desc: 'Left pedestrian LL', cat: 'PL', x: p.fL + wkL / 2, plf: a.ped / 1000 * wkL, def: { kind: 'ped', q: a.ped, w: wkL } }); if (wkR) F.push({ id: 'pedR', desc: 'Right pedestrian LL', cat: 'PL', x: Wd - p.fR - wkR / 2, plf: a.ped / 1000 * wkR, def: { kind: 'ped', q: a.ped, w: wkR } }); }
    (a.extra || []).forEach((u, k) => { if (u.plf) F.push({ id: 'u' + k, desc: u.desc || `Added load ${k + 1}`, cat: u.cat || 'DC2', x: u.x, plf: u.plf, dist: u.dist }); });
    const OV = a.ovr || {};
    F.forEach(L => { const o = OV[L.id]; if (!o || /^(u\d|ovl|ped)/.test(L.id)) return; const ch = [];
      if (o.x != null && isFinite(o.x)) { L.xAuto = L.x; L.x = +o.x; ch.push('x'); }
      if (o.plf != null && isFinite(o.plf)) { L.plfAuto = L.plf; L.plf = +o.plf; ch.push('plf'); }
      if (o.dist && DIST[o.dist]) { L.distAuto = L.forceEqual || a.method === 'aashto' ? 'equal' : a.method === 'ridot' ? (L.cat === 'DW' ? 'equal' : L.cat === 'PL' ? 'two' : 'r64') : 'pilecap'; L.dist = o.dist; ch.push('dist'); }
      if (ch.length) L.ovr = ch; });
    // classification (MassDOT Fig. 3.5.3-1)
    const cls = new Array(N).fill('interior'), sw = new Array(N).fill(false), inR = (x, f) => x >= f.x0 - 0.02 && x <= f.x1 + 0.02;
    F.filter(f => f.id === 'swL' || f.id === 'swR').forEach(f => { let any = false; ub.forEach((x, i) => { if (inR(x, f)) { sw[i] = true; any = true; } }); if (!any) { let bi = 0; ub.forEach((x, i) => { if (Math.abs(x - f.x) < Math.abs(ub[bi] - f.x)) bi = i; }); sw[bi] = true; } });
    F.filter(f => f.id === 'med').forEach(f => ub.forEach((x, i) => { if (inR(x, f)) cls[i] = f.joint ? 'median-ext' : 'median-int'; }));
    for (let i = 0; i < N; i++) if (sw[i] && cls[i] === 'interior') cls[i] = 'int-sw';
    const li = sw.findIndex(Boolean); if (li >= 0) cls[li] = 'ext-sw'; let ri = -1; for (let i = N - 1; i >= 0; i--) if (sw[i]) { ri = i; break; } if (ri >= 0) cls[ri] = 'ext-sw';
    [0, N - 1].forEach(e => { if (cls[e] === 'interior') cls[e] = 'ext-curb'; });
    for (let i = 0; i < N; i++) if (cls[i] === 'interior') { cls[i] = 'first-int'; break; } for (let i = N - 1; i >= 0; i--) if (cls[i] === 'interior') { cls[i] = 'first-int'; break; }
    const clsAuto = cls.slice(); if (a.bcls) Object.entries(a.bcls).forEach(([i, k]) => { if (+i >= 0 && +i < N && CLS[k]) cls[+i] = k; });
    // distribution
    const method = a.method === 'aashto' ? 'aashto' : a.method === 'ridot' ? 'ridot' : 'massdot', xbar = ub.reduce((s, x) => s + x, 0) / N, c = ub.map(x => x - xbar), S2 = c.reduce((s, ci) => s + ci * ci, 0) || 1e-9;
    const pile = (P, xL) => { const e = xL - xbar; return ub.map((x, i) => P / N + Math.max(0, P * e * c[i] / S2)); }, equal = P => ub.map(() => P / N);
    const two = (P, xL) => { const r = ub.map(() => 0);
      if (xL <= ub[0]) { const S1 = N > 1 ? ub[1] - ub[0] : 0, a = ub[0] - xL; if (S1 > 0 && a > 0) { r[0] = P * (1 + a / S1); r[1] = -P * a / S1; } else r[0] = P; }
      else if (xL >= ub[N - 1]) { const S1 = N > 1 ? ub[N - 1] - ub[N - 2] : 0, a = xL - ub[N - 1]; if (S1 > 0 && a > 0) { r[N - 1] = P * (1 + a / S1); r[N - 2] = -P * a / S1; } else r[N - 1] = P; } else { let k = 0; while (k < N - 2 && ub[k + 1] < xL) k++; const t = (xL - ub[k]) / (ub[k + 1] - ub[k]); r[k] = P * (1 - t); r[k + 1] = P * t; } return r; };
    const trib = ub.map((x, i) => (i === N - 1 ? Wd : (ub[i + 1] + x) / 2) - (i === 0 ? 0 : (ub[i - 1] + x) / 2));
    const deck = trib.map(t => t * p.ts / 12 * uc), bf = (a.bf || 0) / 12, haunch = ub.map(() => (a.hh || 0) / 12 * bf * uc);
    const bays = ub.slice(1).map((x, i) => Math.max(x - ub[i] - bf, 0)), sip = ub.map((_, i) => (a.sip || 0) / 1000 * ((i > 0 ? bays[i - 1] / 2 : 0) + (i < N - 1 ? bays[i] / 2 : 0)));
    const dc1 = deck.map((v, i) => v + haunch[i] + sip[i]), dc2 = ub.map(() => 0), dw = ub.map(() => 0), pl = ub.map(() => 0), ut = ub.map(() => 0), uf = ub.map(() => 0);
    const r64 = (L) => { const r = ub.map(() => 0), sd = /L$/.test(L.id || '') ? 0 : /R$/.test(L.id || '') ? N - 1 : null, edge = /^(bar|curb|rail|fence|sw)[LR]$/.test(L.id || '');
      let car = L.x0 != null ? ub.map((x, i) => i).filter(i => inR(ub[i], L)) : [];
      if (edge && car.length < 2) car = [sd != null ? sd : (L.x < Wd / 2 ? 0 : N - 1)];
      else if (!car.length) { if (L.x <= ub[0]) car = [0]; else if (L.x >= ub[N - 1]) car = [N - 1]; else { let k = 0; while (k < N - 2 && ub[k + 1] < L.x) k++; car = [k, k + 1]; } }
      const rest = ub.map((x, i) => i).filter(i => !car.includes(i) && (!edge || (i > 0 && i < N - 1)));
      if (!rest.length) car.forEach(i => r[i] += L.plf / car.length); else { car.forEach(i => r[i] += 0.6 * L.plf / car.length); rest.forEach(i => r[i] += 0.4 * L.plf / rest.length); }
      r.car = car; r.rest = rest; return r; };
    const rAuto = L => method === 'ridot' ? (L.cat === 'DW' ? 'equal' : L.cat === 'PL' || L.cat === 'DC1' || L.cat === 'UT' || L.cat === 'UF' ? 'two' : 'r64') : null;
    const per = F.map(L => { const dist = L.dist && L.dist !== 'auto' ? L.dist : (L.forceEqual ? 'equal' : rAuto(L) || (method === 'massdot' ? (L.dist === 'auto' && L.cat === 'DW' ? 'equal' : 'pilecap') : 'equal')), r = dist === 'equal' ? equal(L.plf) : dist === 'two' ? two(L.plf, L.x) : dist === 'r64' ? r64(L) : pile(L.plf, L.x);
      (L.cat === 'DC1' ? dc1 : L.cat === 'DW' ? dw : L.cat === 'PL' ? pl : L.cat === 'UT' ? ut : L.cat === 'UF' ? uf : dc2).forEach((_, i, arr) => arr[i] += r[i]);
      const out = { ...L, dist, ...(L.dist === 'auto' ? { byMethod: true } : {}), e: L.x - xbar, r: r.slice() }; if (r.car) { out.car = r.car; out.rest = r.rest; } return out; });
    const R = { N, ub, xbar, c, S2, trib, deck, haunch, sip, bf, bays, dc1, dc2, dw, pl, ...(ut.some(v => v !== 0) || uf.some(v => v !== 0) ? { ut, uf } : {}), cls, method, per, Wd, ...(a.bcls ? { clsAuto } : {}) };
    R.steps = deadSteps(R, p, a);
    return R;
  }

  /* the worked steps of dead(): each line load, then each girder's deck, haunch, SIP and share of each line load, and its totals */
  function deadSteps(R, p, a) {
    const w = St().work('dl'), N = R.N, ref3 = `${ED} Art. 3.5.1`;
    w.add({ id: 'xbar', label: 'Centroid of the girder lines from the left deck edge', sym: '\\bar{x}', eq: '\\frac{\\sum x_{i}}{N_{b}}', sub: `\\frac{${R.ub.map(n2).join(' + ')}}{${N}}`, value: R.xbar, unit: 'ft', d: 3 });
    if (R.method === 'massdot' || R.per.some(L => L.dist === 'pilecap')) w.add({ id: 'S2', label: 'Sum of the squared girder offsets (pile-cap method)', sym: '\\sum c^{2}', eq: '\\sum (x_{i} - \\bar{x})^{2}', sub: R.c.map(x => `(${n2(x)})^{2}`).join(' + '), value: R.S2, unit: 'ft^{2}', d: 2, ref: 'MassDOT Bridge Manual Part I 3.5.3' });
    R.per.forEach(L => {
      const d = L.def || {}, id = 'load.' + L.id, ovr = L.ovr && L.ovr.includes('plf');
      if (ovr) w.add({ id, label: `${L.desc} (${L.cat}): line load entered as an override`, sym: 'w', eq: '', sub: '', value: L.plf, unit: 'klf', d: 4, note: `Computed: ${n4(L.plfAuto)} klf.` });
      else if (d.kind === 'curb') w.add({ id, label: `${L.desc} (${L.cat})`, sym: 'w', eq: '\\frac{c_{w}}{12}\\frac{c_{h}}{12}w_{c}', sub: `\\frac{${n2(d.cw)}}{12}\\frac{${n2(d.ch)}}{12}(${n3(d.wc)})`, value: L.plf, unit: 'klf', d: 4, ref: `${ref3}, Table 3.5.1-1` });
      else if (d.kind === 'sw') w.add({ id, label: `${L.desc} (${L.cat})`, sym: 'w', eq: 'b\\frac{t}{12}w_{c}', sub: `${n2(d.w)}\\frac{${n2(d.t)}}{12}(${n3(d.wc)})`, value: L.plf, unit: 'klf', d: 4, ref: `${ref3}, Table 3.5.1-1` });
      else if (d.kind === 'area') w.add({ id, label: `${L.desc} (${L.cat}), between the curb faces`, sym: 'w', eq: '\\frac{q}{1000}(x_{1} - x_{0})', sub: `\\frac{${n2(d.q)}}{1000}(${n2(L.x1)} - ${n2(L.x0)})`, value: L.plf, unit: 'klf', d: 4, ref: ref3, note: L.thk ? `q = t/12 × γ × 1000 = ${n2(L.thk)}/12 × ${n3(L.gam)} × 1000 psf.` : '' });
      else if (d.kind === 'ped') w.add({ id, label: `${L.desc} on the walkable width`, sym: 'w', eq: '\\frac{PL}{1000}b_{walk}', sub: `\\frac{${n2(d.q)}}{1000}(${n2(d.w)})`, value: L.plf, unit: 'klf', d: 4, ref: `${ED} Art. 3.6.1.6` });
      else w.add({ id, label: `${L.desc} (${L.cat})`, sym: 'w', eq: '', sub: '', value: L.plf, unit: 'klf', d: 4, note: 'Line load as entered.' });
    });
    for (let i = 0; i < N; i++) {
      const g = `G${i + 1}`, ext = i === 0 || i === N - 1;
      w.add({ id: `${g}.trib`, label: `${g}: tributary deck width`, sym: 'b_{trib}', eq: ext ? (i === 0 ? 'o_{L} + \\frac{S_{1}}{2}' : '\\frac{S_{n}}{2} + o_{R}') : '\\frac{S_{i-1} + S_{i}}{2}', sub: '', value: R.trib[i], unit: 'ft', d: 3 });
      w.add({ id: `${g}.deck`, label: `${g}: deck slab (DC1)`, sym: 'w_{deck}', eq: 'b_{trib}\\frac{t}{12}w_{c}', sub: `${n3(R.trib[i])}\\frac{${n2(p.ts)}}{12}(${n3(a.uwc)})`, value: R.deck[i], unit: 'klf', d: 4, ref: `${ref3}, Table 3.5.1-1`, note: a.tsac > 0 ? `t = structural ${n2(p.ts - a.tsac)} in + sacrificial ${n2(a.tsac)} in (dead load only).` : '' });
      w.add({ id: `${g}.haunch`, label: `${g}: haunch (DC1), as entered (in the dead load also where the owner takes it as 0 in the section properties)`, sym: 'w_{h}', eq: '\\frac{h}{12}\\frac{b_{f}}{12}w_{c}', sub: `\\frac{${n2(a.hh || 0)}}{12}\\frac{${n2(R.bf * 12)}}{12}(${n3(a.uwc)})`, value: R.haunch[i], unit: 'klf', d: 4, ref: ref3 });
      w.add({ id: `${g}.sip`, label: `${g}: stay-in-place forms on the clear bays (DC1)`, sym: 'w_{SIP}', eq: '\\frac{q_{SIP}}{1000}\\sum\\frac{S - b_{f}}{2}', sub: `\\frac{${n2(a.sip || 0)}}{1000}(${[i > 0 ? `\\frac{${n3(R.bays[i - 1])}}{2}` : '', i < N - 1 ? `\\frac{${n3(R.bays[i])}}{2}` : ''].filter(Boolean).join(' + ')})`, value: R.sip[i], unit: 'klf', d: 4, ref: ref3 });
      R.per.forEach(L => {
        const r = L.r[i], P = n4(L.plf), base = { id: `${g}.${L.id}`, label: `${g}: share of the ${L.desc.toLowerCase()} (${L.cat}, ${DIST[L.dist] || L.dist})`, value: r, unit: 'klf', d: 4 };
        if (L.dist === 'equal') w.add({ ...base, sym: 'w', eq: '\\frac{P}{N_{b}}', sub: `\\frac{${P}}{${N}}`, ref: `${ED} Art. 4.6.2.2.1` });
        else if (L.dist === 'pilecap') w.add({ ...base, sym: 'w', eq: '\\frac{P}{N_{b}} + \\max(0, \\frac{Pec_{i}}{\\sum c^{2}})', sub: `\\frac{${P}}{${N}} + \\max(0, \\frac{${P}(${n3(L.e)})(${n3(R.c[i])})}{${n2(R.S2)}})`, ref: 'MassDOT Bridge Manual Part I 3.5.3' });
        else if (L.dist === 'r64') { const inC = (L.car || []).includes(i), inRest = (L.rest || []).includes(i), nc = (L.car || []).length, nr = (L.rest || []).length;
          w.add({ ...base, sym: 'w', eq: !nr ? (inC ? '\\frac{P}{n_{carry}}' : '0') : inC ? '\\frac{0.6P}{n_{carry}}' : inRest ? '\\frac{0.4P}{n_{rest}}' : '0', sub: !nr ? (inC ? `\\frac{${P}}{${nc}}` : '') : inC ? `\\frac{0.6(${P})}{${nc}}` : inRest ? `\\frac{0.4(${P})}{${nr}}` : '', ref: 'RIDOT BDM 3.3.1' }); }
        else w.add({ ...base, sym: 'w', eq: '\\text{lever rule between the two adjacent girders}', sub: `x = ${n2(L.x)}\\ \\text{ft}`, ref: `${ED} Art. 4.6.2.2.1` });
      });
      const sumOf = (cat, arr, extra) => { const parts = R.per.filter(L => (cat === 'DC2' ? !['DC1', 'DW', 'PL', 'UT', 'UF'].includes(L.cat) : L.cat === cat)).map(L => n4(L.r[i]));
        return (extra || []).concat(parts).join(' + ') || '0'; };
      w.add({ id: `${g}.DC1`, label: `${g}: DC1 on the steel section (deck, haunch, SIP forms, DC1 rows; girder self-weight separate)`, sym: 'w_{DC1}', eq: '\\sum w', sub: sumOf('DC1', null, [n4(R.deck[i]), n4(R.haunch[i]), n4(R.sip[i])]), value: R.dc1[i], unit: 'klf', d: 4, ref: ref3 });
      w.add({ id: `${g}.DC2`, label: `${g}: DC2 on the long-term composite section`, sym: 'w_{DC2}', eq: '\\sum w', sub: sumOf('DC2'), value: R.dc2[i], unit: 'klf', d: 4, ref: ref3 });
      w.add({ id: `${g}.DW`, label: `${g}: DW on the long-term composite section`, sym: 'w_{DW}', eq: '\\sum w', sub: sumOf('DW'), value: R.dw[i], unit: 'klf', d: 4, ref: ref3 });
      if (R.pl.some(v => v)) w.add({ id: `${g}.PL`, label: `${g}: pedestrian live load`, sym: 'w_{PL}', eq: '\\sum w', sub: sumOf('PL'), value: R.pl[i], unit: 'klf', d: 4, ref: `${ED} Art. 3.6.1.6` });
      if (R.ut) { w.add({ id: `${g}.UT`, label: `${g}: utilities on the noncomposite section (DW factors)`, sym: 'w_{UT}', eq: '\\sum w', sub: sumOf('UT'), value: R.ut[i], unit: 'klf', d: 4, ref: 'MassDOT Bridge Manual Part I 3.5.5.4' });
        w.add({ id: `${g}.UF`, label: `${g}: future utility allowance on the noncomposite section`, sym: 'w_{UF}', eq: '\\sum w', sub: sumOf('UF'), value: R.uf[i], unit: 'klf', d: 4, ref: 'MassDOT Bridge Manual Part I 3.5.5.2' }); }
    }
    return w.steps;
  }

  /* steelWeight(segments, allow): girder self-weight per plate segment, w = (b_t t_t + b_b t_b + D t_w) × 3.4 lb/ft/in² / 1000 × (1 + allow/100)
     (GirderDetail GM.sa.compute wSt), and the length-weighted average. GirderDetail's hand-off average weights its analysis nodes by their
     tributary lengths (the same integral on the analysis mesh). segments: [{ x0, x1, D, tw, topB, topT, botB, botT }]. */
  function steelWeight(segments, allow, label) {
    const w = St().work('dl.steel' + (label ? '.' + label : '')), out = segments.map((s, k) => {
      const A = s.topB * s.topT + s.botB * s.botT + s.D * s.tw, v = A * STEEL_PLF / 1000 * (1 + allow / 100);
      w.add({ id: 'w' + (k + 1), label: `Girder steel, segment ${k + 1} (x = ${n2(s.x0)} to ${n2(s.x1)} ft), flanges and web at 490 pcf with the ${n2(allow)}% detail allowance`, sym: 'w_{st}', eq: '(b_{t}t_{t} + b_{b}t_{b} + Dt_{w})\\frac{3.4}{1000}(1 + \\frac{a}{100})',
        sub: `(${n3(s.topB)}(${n4(s.topT)}) + ${n3(s.botB)}(${n4(s.botT)}) + ${n3(s.D)}(${n4(s.tw)}))\\frac{3.4}{1000}(1 + \\frac{${n2(allow)}}{100})`, value: v, unit: 'klf', d: 4, ref: `${ED} Table 3.5.1-1` });
      return { x0: s.x0, x1: s.x1, A, w: v }; });
    const Lt = out.reduce((a, q) => a + (q.x1 - q.x0), 0), avg = Lt > 0 ? out.reduce((a, q) => a + q.w * (q.x1 - q.x0), 0) / Lt : 0;
    w.add({ id: 'avg', label: 'Girder steel, length-weighted average', sym: 'w_{st,avg}', eq: '\\frac{\\sum w_{st}L}{\\sum L}', sub: `\\frac{${out.map(q => `${n4(q.w)}(${n2(q.x1 - q.x0)})`).join(' + ')}}{${n2(Lt)}}`, value: avg, unit: 'klf', d: 4 });
    return { segs: out, avg, min: Math.min(...out.map(q => q.w)), max: Math.max(...out.map(q => q.w)), steps: w.steps };
  }

  /* compute(b, p): GirderDetail GM.df.compute. Returns { errors } or { errors: [], b (with the module's edges), MR, regions, dead, base, p, ll,
     lldf (SBDLldf.compute result: regions with the factors), lf, steps (owner rules, geometry, faces) }. */
  function compute(b0, p) {
    let b = b0;
    if (!b || !b.ok) return { errors: [b && b.why ? `The bridge is not complete: ${b.why.join(' ')}` : 'The bridge is not defined.'], locked: true };
    const bad = []; if (!(b.nb >= 2)) bad.push('at least two girders'); if (!(b.S > 0)) bad.push('a positive girder spacing'); if (!(b.tsDeck > 0)) bad.push('a positive deck thickness');
    if (!(b.spans.length && b.spans.every(s => s > 0))) bad.push('positive span lengths'); if (!(b.ohL >= 0 && b.ohR >= 0 && b.barrier >= 0)) bad.push('non-negative overhangs and barrier width'); if (!(b.fc > 0 && b.wc > 0)) bad.push('positive concrete strength and unit weight');
    if (!b.regions.length) bad.push('at least one span');
    if (bad.length) return { errors: [`The bridge is incomplete: it needs ${bad.join(', ')}.`], locked: true };
    const errors = []; if (!(nm(p.gap) >= 4)) errors.push('Gap between adjacent trucks must be at least 4 ft.');
    const extra = numRows(p.extra, ROW_EXTRA, 'Added load', errors);
    ['swL', 'swThkL', 'swR', 'swThkR', 'medW', 'medThk', 'ped'].forEach(k => { if (!(nm(p.dl[k]) >= 0)) errors.push(`Dead load "${k}" must be zero or positive.`); });
    const xs = xsIn(p, errors);
    const Ed = edgeIn(p.edges, errors);
    if (errors.length) return { errors };
    b = bridgeEff(b, Ed);
    const lf = b.lf && +b.lf.m > 0 && +b.lf.eta > 0 && +b.lf.etaN > 0 ? b.lf : window.SBDOwners.LF_ONE, hP = lf.h0 ? 0 : b.haunch;   // GirderDetail gdLF, gdHP (OWN8)
    const MR = window.SBDSections.modularRatio(b.fc, b.wcE > 0 ? b.wcE : b.wc, 1.0, 'exact'), Nb = b.nb, spacings = b.bays && b.bays.length === Nb - 1 ? b.bays.slice() : new Array(Nb - 1).fill(b.S);   // OWN17: w_c for E_c
    const fL = b.faceL != null ? b.faceL : b.barrier, fR = b.faceR != null ? b.faceR : b.barrier;
    const ll = llFaces(b, p.dl, xs, fL, fR);
    const base = { Nb, spacings, OL: b.ohL, OR: b.ohR, rL: ll.L.r, rR: ll.R.r, fL, fR, ts: b.tsDeck, gap: nm(p.gap), simple: p.kg === 'simple' };
    const DF = window.SBDLldf.compute({ ...base, haunchP: hP, n: MR.n, kg: p.kg, skewV: p.skewV, extMin: p.extMin, regions: b.regions,
      haunchNote: lf.h0 ? `Haunch taken as 0 in the composite properties (${lf.cite && lf.cite.h ? lf.cite.h : lf.o}; owner rule OWN8); its weight stays in DC1.` : '' });
    const regions = DF.regions, g0 = regions[0].geo, lo = p.loadOverrides && typeof p.loadOverrides === 'object' ? p.loadOverrides : null;
    if (lo) Object.entries(lo).forEach(([id, o]) => { if (!o || typeof o !== 'object') return; if (o.x != null && !(isFinite(o.x) && o.x >= 0 && o.x <= g0.Wdeck + 1e-9)) errors.push(`Override of "${id}": x must be from 0 to the deck width ${f2(g0.Wdeck)} ft.`); if (o.plf != null && !(isFinite(o.plf) && o.plf >= 0)) errors.push(`Override of "${id}": the line load must be zero or positive.`); });
    if (errors.length) return { errors };
    const tsac = b.tsac > 0 ? b.tsac : 0;
    const D = dead({ ...base, ts: base.ts + tsac }, g0, { ...p.dl, swL: nm(p.dl.swL), swThkL: nm(p.dl.swThkL), swR: nm(p.dl.swR), swThkR: nm(p.dl.swThkR), medW: nm(p.dl.medW), medThk: nm(p.dl.medThk), ped: nm(p.dl.ped), fws: xs.fws !== null ? xs.fws : b.fws, uwc: b.wc, hh: b.haunch, sip: b.sip, bf: regions[0].sec.topB, edges: edgeLoads(b, xs.wcA), extra: extra.map(e => ({ desc: e.name, cat: e.cat, x: e.x, plf: e.plf, dist: e.dist })),
      uwcA: xs.wcA, fenceL: xs.fenceL, fenceXL: xs.fenceXL, fenceR: xs.fenceR, fenceXR: xs.fenceXR, wsThk: xs.wsThk, wsGam: xs.wsGam, ovl: xs.ovl, ovr: lo, bcls: p.beamClass && typeof p.beamClass === 'object' ? p.beamClass : null, tsac });
    const fw = St().work('xs');
    ['L', 'R'].forEach(sd => { const q = ll[sd], f = sd === 'L' ? fL : fR;
      fw.add({ id: 'f' + sd, label: `${sd === 'L' ? 'Left' : 'Right'} deck edge to its traffic face (${b.edge && b.edge[sd] && b.edge[sd].fby ? b.edge[sd].fby : 'barrier face'})`, sym: `f_{${sd}}`, eq: '', sub: '', value: f, unit: 'ft', d: 3 });
      fw.add({ id: 'r' + sd, label: `${sd === 'L' ? 'Left' : 'Right'} live-load traffic face from the deck edge: ${q.by}${q.mount ? `; the ${n2(q.t)} in sidewalk is mountable (< 12 in) and ignored` : ''}`, sym: `r_{${sd}}`, eq: q.sw > 0 ? '\\max(f, \\text{sidewalk curb}, \\text{fence})' : 'f', sub: '', value: q.r, unit: 'ft', d: 3, ref: `${ED} Art. 3.6.1.1.1` }); });
    fw.add({ id: 'n', label: 'Modular ratio for K_g (E_c from w_c' + (b.wcE > 0 ? ' for E_c, owner rule' : '') + ')', sym: 'n', eq: '\\frac{E_{s}}{E_{c}}', sub: `\\frac{29{,}000}{${St().g(MR.Ec, 0)}}`, value: MR.n, unit: '', d: 3, ref: `${ED} Eq. 5.4.2.4-1, Art. 6.10.1.1.1b` });
    return { errors: [], b, MR, regions, dead: D, base, p, ll, lf, hP, lldf: DF, steps: fw.steps.concat(DF.steps) };
  }

  /* girder(R, j): the loads of girder j (0-based) for the analysis and the cards: { label, type, cls, DC1, DC2, DW, PL, UT, UF, deck, haunch, sip,
     rows: [{ id, desc, cat, dist, w, wTotal, x }], df: per region { gM, gV, fatM, fatV } } */
  function girder(R, j) {
    const D = R.dead, rg = R.regions;
    return { j, label: `G${j + 1}`, type: j === 0 || j === D.N - 1 ? 'exterior' : 'interior', cls: D.cls[j], clsLabel: CLS[D.cls[j]] || D.cls[j],
      deck: D.deck[j], haunch: D.haunch[j], sip: D.sip[j], trib: D.trib[j], DC1: D.dc1[j], DC2: D.dc2[j], DW: D.dw[j], PL: D.pl[j], UT: D.ut ? D.ut[j] : 0, UF: D.uf ? D.uf[j] : 0,
      rows: D.per.map(L => ({ id: L.id, desc: L.desc, cat: L.cat, dist: L.dist, distLabel: DIST[L.dist] || L.dist, w: L.r[j], wTotal: L.plf, x: L.x })),
      df: rg.map(r => ({ id: r.id, kind: r.kind, label: r.label, gM: r.members[j].gM, gV: r.members[j].gV, fatM: r.members[j].fatM, fatV: r.members[j].fatV, method: r.members[j].method })) };
  }

  /* fromModel(project, opts): the module input { b, p } from the sbd2 project (engine/model.js; xs, ownerRules, deck, materials, spans,
     girders). opts.girder: the girder (index) whose plates give the regions' sections (default 0); opts.x: span stations of the sections. */
  function fromModel(P, opts) {
    const o = opts || {}, xs = P.xs || window.SBDModel.defaultXs(P), d = P.deck || {}, c = (P.materials || {}).concrete || {}, g = (P.girders || [])[o.girder || 0] || (P.girders || [])[0];
    const own = P.ownerRules || { owner: 'AASHTO' }, lf = window.SBDOwners.loadFactors(own.owner, own.eta, xs.nb);
    const spans = (P.spans || {}).lengths || [], cont = (P.spans || {}).continuity !== 'simple' && spans.length > 1;
    const regions = g ? window.SBDLldf.regions(spans, cont, xs.skews, g.segments, o.x) : [];
    const tsac = (+d.tdeck || 0) - (+d.ts || 0);
    const E = xs.edges, sw = xs.sidewalks || {}, swL = sw.L || {}, swR = sw.R || {}, med = xs.median || {}, ws = xs.ws || {};
    const bays = (xs.bays || []).slice(), S = bays.length ? bays.reduce((a, v) => a + v, 0) / bays.length : 0;
    const b = { ok: true, nb: xs.nb, S, bays, ohL: xs.ohL, ohR: xs.ohR, barrier: E && E.L && E.L.type !== 'curb' ? +E.L.bw || 0 : 0, barW: 0, faceL: null, faceR: null, edge: null,
      tsDeck: d.ts, haunch: d.haunch, fc: c.fc, wc: c.wc, ...(c.wcE > 0 ? { wcE: c.wcE } : {}), ...(tsac > 1e-9 ? { tsac } : {}), fws: ws.mode === 'thk' ? 0 : +ws.psf || 0, sip: +xs.sip || 0, allow: +xs.allow || 0,
      spans: spans.slice(), cont, skews: (xs.skews || []).slice(), regions, owner: lf.o, lf };
    const p = { gap: xs.lldf && xs.lldf.gap != null ? xs.lldf.gap : 4, kg: (xs.lldf && xs.lldf.kg) || 'max', skewV: (xs.lldf && xs.lldf.skewV) || 'all', extMin: xs.lldf && xs.lldf.extMin ? 'yes' : 'no', radius: 0,
      dl: { method: xs.dlMethod || 'massdot', ped: +sw.ped || 0, swL: +swL.w || 0, swThkL: swL.t != null ? swL.t : 8, swR: +swR.w || 0, swThkR: swR.t != null ? swR.t : 8,
        medW: +med.w || 0, medThk: med.t != null ? med.t : 8, medJoint: med.joint ? 'yes' : 'no', wcA: xs.wcA, fenceL: swL.fence, fenceXL: swL.fenceX, fenceR: swR.fence, fenceXR: swR.fenceX,
        wsMode: ws.mode === 'thk' ? 'thk' : 'psf', wsThk: ws.thk, wsGam: ws.gam },
      extra: (xs.extra || []).map(r => ({ ...r })), ovl: (xs.overlays || []).map(r => ({ ...r })), edges: E, loadOverrides: xs.overrides || null, beamClass: xs.beamClass || null };
    return { b, p };
  }

  window.SBDLoads = { STEEL_PLF, CATS, DIST, CLS, METHODS, parseDim, numRows, xsIn, edgeIn, bridgeEff, edgeLoads, llFaces, dead, steelWeight, compute, girder, fromModel };
})();
