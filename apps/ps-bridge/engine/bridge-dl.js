/* apps/ps-bridge/engine/bridge-dl.js — DC2 and DW distributed to each girder line by the Steel Bridge app's method (window.PSBBridgeDL).
   Classic script, no DOM. Created 2026-11-13 (docs/ps-bridge-plan.md §5 PR 3a-3; engineer decision PS-9 "unequal bays + the steel app's DL
   distribution"; a §4 change against the old app where it applies: fixlog/ps-bridge.md PR 3a-3).

   COPY, to move to shared/ later (CLAUDE.md §3): the functions dead() and deadSteps() below the DEAD-VERBATIM line are lines 116-217 of
   apps/steel-bridge/engine/loads.js at commit 58204bac99b576db79d1dc3ac8eed0b47cf70018 (blob 108476a0377878bf2155ca194a2659795e7e486e),
   byte for byte (tests/engine/psbridge-dl.test.mjs: verbatim, and the same results as window.SBDLoads.dead). The constants they read
   (ED, St, n2, n3, n4, DIST, CLS) are copied from the same file above them. Not copied: the steel module's inputs (edgeIn, xsIn, curbs,
   fences, medians, overlays, overrides, beam classes, the steel girder weight), which this app does not offer yet.

   Inputs (P.xs.dl, optional within psb2.project v1; engine/model.js):
     { mode: 'distributed' | 'entered', method: 'massdot' | 'aashto' | 'ridot',
       barL, barR: { bw (ft, barrier width at the deck edge = the traffic face), w (klf) }, swL, swR: { w (ft), t (in) } (sidewalk slab),
       fws (psf, future wearing surface between the traffic faces), extra: [{ name, cat: 'DC2' | 'DW', x (ft from the left deck edge), plf (klf) }] }
     Absent (every project saved before PR 3a-3) or mode 'entered': DC2 and DW are the values entered per girder type (base.loads.wBar /
     wDW, Loads tab), as before: no result changes. 'distributed': each line's DC2 and DW (dead().dc2[g−1], .dw[g−1]) are the engine's
     loads.wBar and loads.wDW of that line (engine/design.js one()); everything else of the engine is unchanged.
   The deck slab, haunch and girder (DC1) stay the engine's own (tributary width of the line); dead() also computes them for its steps, but
   only its DC2 / DW are used. Units: ft, in, kcf, psf, klf. */
(function () {
  'use strict';
  // from apps/steel-bridge/engine/loads.js at 58204ba (the names dead() / deadSteps() use)
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4);
  const DIST = { pilecap: 'MassDOT pile-cap', equal: 'Equal', two: 'Two adjacent', r64: 'RIDOT 60/40' };
  const CLS = { 'ext-curb': 'Exterior safety curb beam', interior: 'Interior beam', 'first-int': '1st interior roadway beam', 'ext-sw': 'Exterior sidewalk beam', 'int-sw': 'Interior sidewalk beam', 'median-int': 'Median beam (continuous slab, interior)', 'median-ext': 'Median beam (joint, exterior)' };
  const METHODS = { massdot: 'MassDOT 3.5.3 (pile-cap for superimposed DC; wearing surface equally)', aashto: 'Typical AASHTO (all loads equally to all beams)', ridot: 'RIDOT BDM 3.3.1 (barriers and sidewalks 60% fascia beams, 40% interior beams)' };

/* ---- DEAD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
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

/* ---- end of DEAD-VERBATIM ---- */

  const isNum = v => typeof v === 'number' && isFinite(v);
  /* defaults(P): the inputs of a NEW project (PR 3a-3; decision pending engineer review): distributed, the steel app's default method
     (MassDOT pile-cap, as apps/steel-bridge defaultXs), barriers of the old app's own barrier (deck.wBar 0.30 klf, deck.bBar 18 in = 1.5 ft
     wide) on both edges, no sidewalk, a 25 psf future wearing surface (the old app's deck.wsFut 0.025 ksf = the steel app's 25 psf). */
  function defaults(P) {
    const d = (P && P.base && P.base.deck) || {}, w = isNum(+d.wBar) && +d.wBar >= 0 ? +d.wBar : 0.3, bw = isNum(+d.bBar) && +d.bBar > 0 ? +d.bBar / 12 : 1.5;
    return { mode: 'distributed', method: 'massdot', barL: { bw, w }, barR: { bw, w }, swL: { w: 0, t: 8 }, swR: { w: 0, t: 8 }, fws: 25, extra: [] };
  }
  const on = P => !!(P && P.xs && P.xs.dl && P.xs.dl.mode === 'distributed');
  /* checks(P): blocking input errors of the distribution inputs ([{ path, msg }]) */
  function checks(P) {
    const E = [], e = (path, msg) => E.push({ path, msg }); if (!on(P)) return E;
    const q = P.xs.dl, nn = (v, path, lab) => { if (!(isNum(v) && v >= 0)) e(path, `${lab} must be zero or a positive number.`); };
    if (!METHODS[q.method]) e('xs.dl.method', 'Choose a dead load distribution method.');
    ['L', 'R'].forEach(s => { const side = s === 'L' ? 'Left' : 'Right', b = q['bar' + s] || {}, w = q['sw' + s] || {};
      nn(b.bw, `xs.dl.bar${s}.bw`, `${side} barrier width`); nn(b.w, `xs.dl.bar${s}.w`, `${side} barrier weight`);
      nn(w.w, `xs.dl.sw${s}.w`, `${side} sidewalk width`); if (+w.w > 0) nn(w.t, `xs.dl.sw${s}.t`, `${side} sidewalk thickness`); });
    nn(q.fws, 'xs.dl.fws', 'Wearing surface');
    const Wd = deckWidth(P);
    (Array.isArray(q.extra) ? q.extra : []).forEach((r, i) => {
      if (!['DC2', 'DW'].includes(r.cat)) e(`xs.dl.extra.${i}.cat`, `Added line load ${i + 1}: choose DC2 or DW.`);
      if (!(isNum(r.x) && r.x >= 0 && (!isNum(Wd) || r.x <= Wd + 1e-9))) e(`xs.dl.extra.${i}.x`, `Added line load ${i + 1}: x must be from 0 to the deck width${isNum(Wd) ? ` ${Wd.toFixed(2)} ft` : ''}.`);
      nn(r.plf, `xs.dl.extra.${i}.plf`, `Added line load ${i + 1}: the line load`); });
    if (isNum(Wd) && (+(q.barL || {}).bw || 0) + (+(q.barR || {}).bw || 0) >= Wd) e('xs.dl.barL.bw', 'The two barriers are as wide as the deck.');
    return E;
  }
  function deckWidth(P) { const x = P.xs || {}, B = Array.isArray(x.bays) ? x.bays : []; return (+x.ohL || 0) + B.reduce((a, b) => a + (+b || 0), 0) + (+x.ohR || 0); }
  /* distribute(P): dead() of the steel app on this bridge: { …dead() result, wc, ts }; null when not distributed or the inputs are invalid.
     p: N_b, the left overhang, the deck thickness for the deck weight (the base's: t_s, or t_s,DL when entered separately; dead()'s DC1 is
     shown only), the traffic faces = the barrier widths; geo: the girder lines from G1 (pos) and the deck width; a: the method, the two
     barriers (DC2, at half their width from their edge), the sidewalk slabs (DC2, w_c of the deck for loads), the wearing surface (DW,
     between max(traffic face, sidewalk) on each side, always equally) and the added line loads (DC2 / DW, the method's distribution). */
  const CACHE = { key: '', R: null };
  function distribute(P) {
    if (!on(P) || checks(P).length || !P.base) return null;
    const x = P.xs, q = x.dl, b = P.base, m = b.mat || {}, wc = +m.wcdLoad || +m.wcd, ts = b.tsSeparate ? +b.tsDL : +b.ts;
    const key = JSON.stringify([x.nb, x.bays, x.ohL, x.ohR, q, wc, ts]); if (CACHE.key === key) return CACHE.R;
    const N = x.nb, pos = [0]; (x.bays || []).forEach(s => pos.push(pos[pos.length - 1] + s));
    const Wd = deckWidth(P), bL = q.barL || {}, bR = q.barR || {};
    const edges = []; if (+bL.w > 0) edges.push({ id: 'barL', desc: 'Left barrier', cat: 'DC2', side: 'L', x: +bL.bw / 2, plf: +bL.w });
    if (+bR.w > 0) edges.push({ id: 'barR', desc: 'Right barrier', cat: 'DC2', side: 'R', x: +bR.bw / 2, plf: +bR.w });
    const sw = s => { const v = q['sw' + s] || {}; return +v.w > 0 ? +v.w : 0; }, swt = s => +((q['sw' + s] || {}).t) || 0;
    const R = dead({ Nb: N, OL: +x.ohL, ts, fL: +bL.bw || 0, fR: +bR.bw || 0 }, { pos, Wdeck: Wd },
      { method: q.method, ped: 0, swL: sw('L'), swThkL: swt('L'), swR: sw('R'), swThkR: swt('R'), medW: 0, medThk: 0, fws: +q.fws || 0, uwc: wc, uwcA: null, hh: 0, sip: 0, bf: 0,
        edges, extra: (q.extra || []).map((r, i) => ({ desc: r.name || `Added line load ${i + 1}`, cat: r.cat, x: +r.x, plf: +r.plf, dist: 'auto' })), ovl: [], ovr: null, bcls: null });
    const out = Object.assign({}, R, { wc, ts, Wd });
    CACHE.key = key; CACHE.R = out; return out;
  }
  /* line(P, g): { DC2, DW } of girder line g (1-based) when distributed, else null */
  function line(P, g) { const R = distribute(P); return R ? { DC2: R.dc2[g - 1], DW: R.dw[g - 1] } : null; }
  /* stepsFor(P, g): the worked steps of the distribution that give line g its DC2 and DW (ids dl.*): x̄, Σc² (pile-cap), each line load,
     the line's share of each and its DC2 and DW sums (dead()'s DC1 steps left out: the engine's own DC1 is worked on the Loads & LLDF tab) */
  function stepsFor(P, g) {
    const R = distribute(P); if (!R) return [];
    const G = `dl.G${g}.`, keep = s => !/^dl\.G\d+\./.test(s.id) || (s.id.indexOf(G) === 0 && !/\.(trib|deck|haunch|sip|DC1)$/.test(s.id));
    return R.steps.filter(keep);
  }
  /* withSteps(Wl, P): the Loads & LLDF worked steps (engine/worked.js loads(): { steps, pairs, paths }) with the distribution's steps of the
     line shown appended, and the DC2 / DW input steps (ld.wDC2, ld.wDW) saying where their value comes from (§ link to the line's sum).
     Wl is changed and returned; nothing when not distributed. */
  function withSteps(Wl, P) {
    if (!Wl || !on(P) || !distribute(P)) return Wl;
    const g = window.PSBDesign.sel(P).g;
    Wl.steps = Wl.steps.map(s => s.id === 'ld.wDC2' || s.id === 'ld.wDW' ? Object.assign({}, s, { label: `${s.id === 'ld.wDC2' ? 'DC2 superimposed dead load' : 'DW wearing surface'} (distributed to G${g})`,
      note: `Distributed to girder line G${g} by the Steel Bridge app's method (§dl.G${g}.${s.id === 'ld.wDC2' ? 'DC2' : 'DW'}); on the composite section.` }) : s).concat(stepsFor(P, g));
    return Wl;
  }
  window.PSBBridgeDL = { withSteps, METHODS, DIST, defaults, on, checks, distribute, line, stepsFor, deckWidth, dead };
})();
