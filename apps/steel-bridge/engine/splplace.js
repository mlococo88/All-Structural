/* apps/steel-bridge/engine/splplace.js — field splice placement for Auto design (window.SBDSplicePlace). Classic script, no DOM.
   Created 2026-11-02 (engineer request of 2026-11-02: field splice locations as an Auto design variable). Needs SharedSteps, SBDOwners.

   The rule is the old app's, ported (Steel Bridge Design.html):
     - Preliminary sizing (pl-src) spliceLocations(R, extra, shifts): continuous units, a splice at each permanent-load point of contraflexure
       next to each interior support (R.cf: M_DC1 + M_DC2 + M_DW + M_UT of the interior girder, linear between stations), rounded to the
       nearest foot, ends within 0.5 ft dropped; simple spans, the girder ends at the piers (not field splices); splices closer than the
       minimum segment merged (the first kept); every piece longer than the shipping length divided into ceil(L/L_ship) equal pieces, an odd
       number in a simple span (no splice at midspan), or (MassDOT 3.6.5.3, owner rule spl.simple) a whole simple span at its quarter points
       when the middle half fits; a symmetric bridge placed on the left half and mirrored. And sizeForDepth's shipping loop: a piece heavier
       than the shipping weight split at its middle (in a simple span, at its third points when the middle falls within L/8 of midspan).
     - GirderDetail (gd-src) spLocSuggest() ("Suggest splice"): the same contraflexure points from the Structural analysis (DC1 + DC2 + DW,
       interior girder G2), and no splice closer than the minimum distance to a support (moved out to that distance).
   Rules added here (the engineer's request; each an input with a stated default, saved as P.autodesign.splRules):
     shipLen  maximum shipping piece length (ft): entered, else the owner's (engine/owners.js 'ship': RIDOT BDM 6.4 100 ft, CTDOT BRSDM
              V2 2.3.5.1CT 120 ft), else 120 ft (the old app's default; no owner limit: MassDOT, AASHTO). A RIDOT piece over 150 ft fails
              (6.7.2, 'ship.splice').
     shipWt   maximum shipping piece weight (kip): entered, else the owner's ('ship': RIDOT 150, CTDOT 120), else 90 kip (the old default).
     minLen   minimum piece length (ft): entered, else the shortest flange zone of the Auto design limits (minSeg, 10 ft; the merge rule).
     minSup   minimum distance of a splice from a bearing (ft): entered, else 10 ft (GirderDetail spl.minSup).
     minXf    minimum distance of a splice from an intermediate cross-frame / connection plate (ft): entered, else the Spans & framing tab's
              splice clearance (framing.spliceClear, 2 ft), MassDOT 3.6.5.5 cited (stiffeners not to coincide with the splice plates).
     minTr    minimum distance of a splice from a shop flange transition (ft): entered, else minSeg (a splice nearer leaves a flange zone
              shorter than the shortest zone allowed).
   A splice that breaks minXf or minTr is moved by 1 ft steps (up to 5 ft each way, the nearer first) to a station that keeps every rule.

   Units: ft, kip, in (plates). Every function is a plain function of its inputs. */
(function () {
  'use strict';
  const St = () => window.SharedSteps, OW = () => window.SBDOwners;
  const ED = 'AASHTO LRFD 10th Ed.';
  const STEEL = 490 / 144;   // lb/ft per in^2 of steel (0.490 kcf)
  const r2 = v => +(+v).toFixed(2), uniq = a => [...new Set(a.map(r2))].sort((x, y) => x - y);
  const num = v => (v === '' || v == null || !isFinite(+v)) ? null : +v;
  const SHIFT = 5;   // ft: the farthest a splice is moved to clear a cross-frame or a transition

  /* rules(P, lim): the numbers in use and where each comes from. lim: Auto design's s.lim (minSeg). */
  const DFLT = { shipLen: 120, shipWt: 90, minSup: 10, minXf: 2 };
  function rules(P, lim) {
    const a = ((P && P.autodesign) || {}).splRules || {}, owner = ((P && P.ownerRules) || {}).owner || 'AASHTO', O = OW();
    const R = id => O ? O.rule(owner, id) : null, rSh = R('ship'), rMand = R('ship.splice'), rQ = R('spl.simple'), rLoc = R('spl.loc'), rXf = R('spl.xf');
    const minSeg = lim && lim.minSeg > 0 ? lim.minSeg : 10, clr = num(((P && P.framing) || {}).spliceClear);
    const out = { owner, src: {}, cite: {} };
    const pick = (k, pos, own, d, dsrc) => { const v = num(a[k]); if (v != null && (pos ? v > 0 : v >= 0)) { out[k] = v; out.src[k] = 'entered'; }
      else if (own) { out[k] = own.v; out.src[k] = own.c; } else { out[k] = d; out.src[k] = dsrc; } };
    pick('shipLen', true, rSh && +rSh.value.len > 0 ? { v: +rSh.value.len, c: O.cite(rSh) } : null, DFLT.shipLen, 'default 120 ft (the old app\'s maximum piece length; no owner limit: confirm the route with the fabricator)');
    pick('shipWt', true, rSh && +rSh.value.wt > 0 ? { v: +rSh.value.wt, c: O.cite(rSh) } : null, DFLT.shipWt, 'default 90 kip (the old app\'s maximum piece weight; no owner limit)');
    pick('minLen', true, null, minSeg, 'the shortest flange zone of the Auto design limits (the old app merges splices closer than it)');
    pick('minSup', false, null, DFLT.minSup, 'default 10 ft (the old app\'s minimum distance from a support)');
    pick('minXf', false, null, clr != null && clr >= 0 ? clr : DFLT.minXf, `the splice clearance of the Spans & framing tab${rXf ? ` (${O.cite(rXf)})` : ''}`);
    pick('minTr', false, null, minSeg, 'the shortest flange zone of the Auto design limits');
    out.mand = rMand && +rMand.value.mand > 0 ? +rMand.value.mand : null; if (rMand) out.cite.mand = O.cite(rMand);
    out.q = rQ ? +rQ.value.at : null; if (rQ) out.cite.q = O.cite(rQ);
    out.cite.loc = rLoc ? `${ED} Art. 6.13.6.1.3a; ${O.cite(rLoc)}` : `${ED} Art. 6.13.6.1.3a`;
    if (rSh) out.cite.ship = O.cite(rSh); if (rXf) out.cite.xf = O.cite(rXf);
    return out;
  }

  /* geometry of the project: spans, supports, total length, continuity, symmetry (Preliminary sizing isSym: spans and |skews| mirror) */
  function geom(P) {
    const spans = P.spans.lengths.map(Number), sup = [0]; spans.forEach(L => sup.push(r2(sup[sup.length - 1] + L)));
    const n = spans.length, sk = (((P.xs || {}).skews) || []).map(v => Math.abs(+v || 0)), cont = P.spans.continuity !== 'simple' && n > 1;
    let sym = true; for (let i = 0; i < n; i++) if (Math.abs(spans[i] - spans[n - 1 - i]) > 1e-6) sym = false;
    if (sk.length === n + 1) for (let i = 0; i <= n; i++) if (Math.abs(sk[i] - sk[n - i]) > 1e-6) sym = false;
    return { spans, sup, Lt: sup[n], n, cont, sym };
  }
  const spanOf = (G, x) => { for (let k = 0; k < G.n; k++) if (x > G.sup[k] + 1e-9 && x < G.sup[k + 1] - 1e-9) return k; return -1; };

  /* contraflexure(R): the permanent-load points of contraflexure next to each interior support, from an analysis of engine/analysis.js
     (analyzeGirder: R.x, R.supIdx, R.st). M = M_DC1 + M_DC2 + M_DW + M_UT. From the support outward, the first station whose moment has
     the other sign (or is zero), linear between it and its neighbour toward the support (GirderDetail spLocSuggest, as written there). */
  function contraflexure(R) {
    const X = R.x, st = R.st, A = (o, i) => o && o.M ? o.M[i] : 0, M = X.map((_, i) => A(st.DC1, i) + A(st.DC2, i) + A(st.DW, i) + A(st.UT, i)), out = [], S = R.supIdx || [];
    const cross = (i, j) => X[i] + (X[j] - X[i]) * M[i] / (M[i] - M[j]);
    for (let k = 1; k < S.length - 1; k++) { const ip = S[k], Mp = M[ip];
      for (let i = ip - 1; i >= S[k - 1]; i--) if (M[i] * Mp <= 0 && M[i] !== M[i + 1]) { const x = cross(i, i + 1); out.push({ pier: k, side: 'L', xa: X[i], xb: X[i + 1], Ma: M[i], Mb: M[i + 1], x, xr: Math.round(x) }); break; }
      for (let i = ip + 1; i <= S[k + 1]; i++) if (M[i] * Mp <= 0 && M[i] !== M[i - 1]) { const x = cross(i - 1, i); out.push({ pier: k, side: 'R', xa: X[i - 1], xb: X[i], Ma: M[i - 1], Mb: M[i], x, xr: Math.round(x) }); break; } }
    return { pts: out, M, X };
  }

  /* piece weight (kip) between x0 and x1 for plates `segs` (sbd2 segments), with the detail allowance (%) (Preliminary sizing sizeForDepth:
     1-ft steps, the plates at each step's middle) */
  function pieceWt(segs, x0, x1, allow) {
    const at = x => segs.find(s => x >= s.x0 - 1e-9 && x < s.x1 - 1e-9) || segs[segs.length - 1]; let w = 0;
    for (let x = x0; x < x1 - 1e-9; x += 1) { const dx = Math.min(1, x1 - x), s = at(x + dx / 2); w += (s.topB * s.topT + s.botB * s.botT + s.D * s.tw) * STEEL * dx / 1000; }
    return w * (1 + (+allow || 0) / 100);
  }
  const edgesOf = (G, spl) => uniq([0, ...spl, ...(G.cont ? [] : G.sup.slice(1, -1)), G.Lt]);

  /* reference(P, cf, Ru, segs, allow): the old app's placement (above) for the project's spans. cf: contraflexure(); Ru: rules(); segs: the
     plates for the shipping weight (the current design). Returns { spl, notes: [why], moved } */
  function reference(P, cf, Ru, segs, allow) {
    const G = geom(P), notes = [];
    let sp = G.cont ? cf.pts.map(c => c.xr) : [];
    sp = uniq(sp).filter(x => x > 0.5 && x < G.Lt - 0.5);
    const kept = []; sp.forEach(x => { if (!kept.length || x - kept[kept.length - 1] >= Ru.minLen - 1e-9) kept.push(x); else notes.push(`${x} ft dropped: within ${Ru.minLen} ft of the splice at ${kept[kept.length - 1]} ft (minimum piece length)`); });
    const isSup = x => G.sup.some(s => Math.abs(s - x) < 1e-6);
    const split = list => { const e = edgesOf(G, list), res = list.slice();
      for (let i = 0; i < e.length - 1; i++) { const a = e[i], len = e[i + 1] - a; let nP = Math.ceil(len / Ru.shipLen - 1e-9);
        if (!G.cont && nP > 1 && Ru.q != null && isSup(a) && isSup(e[i + 1]) && len * (1 - 2 * Ru.q) <= Ru.shipLen + 1e-9) {
          res.push(Math.round(a + len * Ru.q), Math.round(a + len * (1 - Ru.q))); notes.push(`span ${a}–${e[i + 1]} ft (${r2(len)} ft > ${Ru.shipLen} ft): splices at its quarter points (${Ru.cite.q})`); continue; }
        if (!G.cont && nP > 1 && nP % 2 === 0) nP++;
        if (nP > 1) notes.push(`piece ${a}–${e[i + 1]} ft (${r2(len)} ft > ${Ru.shipLen} ft): ${nP} equal pieces${!G.cont ? ' (an odd number in a simple span)' : ''}`);
        for (let k = 1; k < nP; k++) res.push(Math.round(a + len * k / nP)); }
      return uniq(res); };
    const mirror = list => { if (!G.sym) return list; const h = G.Lt / 2, left = list.filter(x => x < h - 0.25), mid = list.filter(x => Math.abs(x - h) <= 0.25);
      return uniq([...left, ...mid.map(() => h), ...left.map(x => r2(G.Lt - x))]); };
    let out = mirror(split(kept));
    // shipping weight (sizeForDepth): split the first piece over the weight at its middle, up to 8 times
    for (let it = 0; it < 8 && segs && segs.length; it++) { const e = edgesOf(G, out); let add = null;
      for (let i = 0; i < e.length - 1; i++) { const x0 = e[i], x1 = e[i + 1], len = x1 - x0, wt = pieceWt(segs, x0, x1, allow);
        if (wt > Ru.shipWt + 1e-9 && len > 2 * Ru.minLen) { let xs2 = Math.round((x0 + x1) / 2);
          if (!G.cont) { const k = Math.max(0, spanOf(G, (x0 + x1) / 2)), mid = G.sup[k] + G.spans[k] / 2; if (Math.abs(xs2 - mid) < G.spans[k] / 8) xs2 = Math.round(x0 + (mid > (x0 + x1) / 2 ? 1 : 2) * len / 3); }
          add = xs2; notes.push(`piece ${x0}–${x1} ft weighs ${r2(wt)} kip > ${Ru.shipWt} kip: split at ${xs2} ft`); break; } }
      if (add == null) break; out = mirror(uniq([...out, add, ...(G.sym && Math.abs(add - G.Lt / 2) > 0.25 ? [r2(G.Lt - add)] : [])])); }
    // the minimum distance from a support (spLocSuggest): moved out to it
    out = uniq(out.map(x => { const near = G.sup.reduce((p, q) => Math.abs(q - x) < Math.abs(p - x) ? q : p, G.sup[0]), d = Math.abs(x - near);
      if (d < Ru.minSup - 1e-9) { const nv = r2(near + (x >= near ? 1 : -1) * Ru.minSup); notes.push(`${x} ft moved to ${nv} ft (at least ${Ru.minSup} ft from the support at ${near} ft)`); return nv; } return x; })).filter(x => x > 0 && x < G.Lt);
    return { spl: out, notes };
  }

  /* check(P, spl, Ru, o): the rules for a layout. o: { segs (plates, for the weight), allow, frames: [[own stations of the intermediate
     cross-frames] per girder line] | null, trans: [stations of the shop flange transitions] }. Returns { ok, items: [{ id, what, x, r, ok }], steps } */
  function check(P, spl, Ru, o) {
    o = o || {}; const G = geom(P), w = St().work('spl'), n = St().n, items = [], e = edgesOf(G, spl);
    const add = (id, what, x, r, ok, step) => { items.push({ id, what, x, r, ok }); if (step) w.add({ ...step, id: `${id}.${items.length}`, ok }); };
    for (let i = 0; i < e.length - 1; i++) { const x0 = e[i], x1 = e[i + 1], len = x1 - x0, lab = `Piece ${i + 1} (${n(x0, 2)} to ${n(x1, 2)} ft)`;
      const lim = Ru.shipLen;
      add('SP1', `${lab}: length ${n(len, 2)} ft ≤ ${n(lim, 2)} ft`, x0, len / lim, len <= lim + 1e-9, { label: `${lab}: shipping length`, sym: 'L_{pc}', eq: `x_{1} - x_{0} \\le L_{ship}`, sub: `${n(x1, 2)} - ${n(x0, 2)} = ${n(len, 2)} \\le ${n(lim, 2)}`, value: len, unit: 'ft', d: 2, ref: Ru.cite.ship || 'shipping limit (Auto design input)', note: `L_ship: ${Ru.src.shipLen}.` });
      add('SP2', `${lab}: length ${n(len, 2)} ft ≥ ${n(Ru.minLen, 2)} ft`, x0, Ru.minLen / len, len >= Ru.minLen - 1e-9, { label: `${lab}: minimum piece length`, sym: 'L_{pc}', eq: `\\ge L_{min}`, sub: `${n(len, 2)} \\ge ${n(Ru.minLen, 2)}`, value: len, unit: 'ft', d: 2, ref: 'Auto design input', note: `L_min: ${Ru.src.minLen}.` });
      if (o.segs && o.segs.length) { const wt = pieceWt(o.segs, x0, x1, o.allow), w0 = pieceWt(o.segs, x0, x1, 0);
        add('SP3', `${lab}: weight ${n(wt, 1)} kip ≤ ${n(Ru.shipWt, 1)} kip`, x0, wt / Ru.shipWt, wt <= Ru.shipWt + 1e-9, { label: `${lab}: shipping weight (flanges and web, with the detail allowance)`, sym: 'W_{pc}', eq: '(1 + \\frac{a}{100})\\sum 3.403A_{i}L_{i} \\le W_{ship}', sub: `(1 + \\frac{${n(+o.allow || 0, 1)}}{100})(${n(w0, 2)}) = ${n(wt, 1)} \\le ${n(Ru.shipWt, 1)}`, value: wt, unit: 'kip', d: 1, ref: Ru.cite.ship || 'shipping limit (Auto design input)', note: `W_ship: ${Ru.src.shipWt}. 3.403 lb/ft per in² (0.490 kcf).` }); } }
    spl.forEach((x, j) => { const lab = `Splice ${j + 1} at ${n(x, 2)} ft`;
      const near = G.sup.reduce((p, q) => Math.abs(q - x) < Math.abs(p - x) ? q : p, G.sup[0]), d = Math.abs(x - near);
      add('SP4', `${lab}: ${n(d, 2)} ft from the bearing at ${n(near, 2)} ft ≥ ${n(Ru.minSup, 2)} ft`, x, d > 0 ? Ru.minSup / d : Infinity, d >= Ru.minSup - 1e-9, { label: `${lab}: distance from the nearest bearing`, sym: 'd_{brg}', eq: `|x - x_{brg}| \\ge c_{brg}`, sub: `|${n(x, 2)} - ${n(near, 2)}| = ${n(d, 2)} \\ge ${n(Ru.minSup, 2)}`, value: d, unit: 'ft', d: 2, ref: 'Auto design input', note: `c_brg: ${Ru.src.minSup}.` });
      if (o.frames) { let dm = Infinity, at = null; o.frames.forEach(list => list.forEach(s => { const dd = Math.abs(s - x); if (dd < dm) { dm = dd; at = s; } }));
        if (isFinite(dm)) add('SP5', `${lab}: ${n(dm, 2)} ft from the cross-frame at ${n(at, 2)} ft ≥ ${n(Ru.minXf, 2)} ft`, x, dm > 0 ? Ru.minXf / dm : Infinity, dm >= Ru.minXf - 1e-9, { label: `${lab}: distance from the nearest intermediate cross-frame / connection plate (every girder)`, sym: 'd_{xf}', eq: `|x - x_{xf}| \\ge c_{xf}`, sub: `|${n(x, 2)} - ${n(at, 2)}| = ${n(dm, 2)} \\ge ${n(Ru.minXf, 2)}`, value: dm, unit: 'ft', d: 2, ref: Ru.cite.xf || 'Auto design input', note: `c_xf: ${Ru.src.minXf}.` }); }
      if (o.trans && o.trans.length) { let dm = Infinity, at = null; o.trans.forEach(s => { const dd = Math.abs(s - x); if (dd < dm) { dm = dd; at = s; } });
        add('SP6', `${lab}: ${n(dm, 2)} ft from the flange transition at ${n(at, 2)} ft ≥ ${n(Ru.minTr, 2)} ft`, x, dm > 0 ? Ru.minTr / dm : Infinity, dm >= Ru.minTr - 1e-9, { label: `${lab}: distance from the nearest shop flange transition`, sym: 'd_{tr}', eq: `|x - x_{tr}| \\ge c_{tr}`, sub: `|${n(x, 2)} - ${n(at, 2)}| = ${n(dm, 2)} \\ge ${n(Ru.minTr, 2)}`, value: dm, unit: 'ft', d: 2, ref: 'Auto design input', note: `c_tr: ${Ru.src.minTr}.` }); } });
    if (Ru.mand) e.slice(1).forEach((x1, i) => { const len = x1 - e[i]; if (len > Ru.mand + 1e-9) add('SP1', `Piece ${i + 1}: ${n(len, 2)} ft > ${Ru.mand} ft (${Ru.cite.mand}: field splice mandatory)`, e[i], len / Ru.mand, false, null); });
    return { ok: items.every(q => q.ok), items, steps: w.steps };
  }

  /* placeSteps(P, cf, ref, Ru, gl): the worked steps of the placement rule (why each station; CLAUDE.md §6) */
  function placeSteps(P, cf, ref, Ru, gl) {
    const G = geom(P), w = St().work('splp'), n = St().n;
    if (G.cont) cf.pts.forEach((c, k) => w.add({ id: `cf${k}`, label: `Support ${c.pier + 1} (pier ${c.pier}), ${c.side === 'L' ? 'back' : 'ahead'} span: permanent-load point of contraflexure (${gl})`, sym: 'x_{cf}',
      eq: 'x_{a} + (x_{b} - x_{a})\\frac{M_{a}}{M_{a} - M_{b}}', sub: `${n(c.xa, 2)} + (${n(c.xb, 2)} - ${n(c.xa, 2)})\\frac{${n(c.Ma, 2)}}{${n(c.Ma, 2)} - (${n(c.Mb, 2)})}`, value: c.x, unit: 'ft', d: 2, ref: Ru.cite.loc,
      note: `M = M_DC1 + M_DC2 + M_DW (+ M_UT) in kip-ft at the stations either side of the sign change; rounded to ${c.xr} ft (the old app's Suggest splice).` }));
    else w.add({ id: 'simple', label: 'Simple spans: the girders end at the piers', sym: '', eq: '', sub: '', value: Ru.q != null ? `a span longer than L_ship gets splices at its quarter points (${Ru.cite.q})` : 'a span longer than L_ship is divided into an odd number of equal pieces', unit: '', d: 0, ref: Ru.cite.loc });
    w.add({ id: 'ref', label: 'Field splices by the placement rule', sym: 'x_{sp}', eq: '', sub: '', value: ref.spl.length ? ref.spl.map(x => n(x, 2)).join(', ') + ' ft' : 'none needed', unit: '', d: 0, ref: Ru.cite.loc,
      note: [`L_ship = ${n(Ru.shipLen, 2)} ft (${Ru.src.shipLen}); W_ship = ${n(Ru.shipWt, 1)} kip (${Ru.src.shipWt}); L_min = ${n(Ru.minLen, 2)} ft; c_brg = ${n(Ru.minSup, 2)} ft.`, ...ref.notes].join(' ') });
    return w.steps;
  }

  /* windows text ("120-150, 210-240") → [[a, b]] */
  function windows(t) { return String(t || '').split(/[,;]+/).map(s => s.trim()).filter(Boolean).map(s => { const m = /^(-?\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(-?\d+(?:\.\d+)?)$/.exec(s); return m ? [Math.min(+m[1], +m[2]), Math.max(+m[1], +m[2])] : null; }).filter(Boolean); }
  const combos = (a, k) => { const out = []; const rec = (s, c) => { if (c.length === k) { out.push(c.slice()); return; } for (let i = s; i < a.length; i++) { c.push(a[i]); rec(i + 1, c); c.pop(); } }; rec(0, []); return out; };

  /* layouts(P, o): the splice layouts Auto design sizes (Auto or Range). o: { cf, ref (reference()), Ru, cur (the current splices), q (the
     variable: { mode, min, max, win }), qk(k) (span k's own entry or q), segs, allow, frames(spl) → per-girder intermediate frame stations,
     trans (fixed transition stations), max (layouts kept) }.
     Each span k: Lock, its current splices; Auto, the rule's count n_k or one fewer; Range, min … max. A count n: the span's points of
     contraflexure (simple spans: the rule's points), a subset of them when fewer, the longest gap of the span halved for each more (a
     simple span with none: n + 1 equal pieces). Station windows (Range): a splice outside every window moved to the nearest window station of
     its span. Then the rules (check above, every one must hold; a cross-frame or transition conflict moved by 1 ft steps). Kept: the rule's
     layout (Auto) first, then (Auto) the current stations when they meet every rule, then the fewest splices, then the nearest the rule's
     stations; Auto keeps three at most (the rule's, the current, the fewest), Range four. Returns [{ spl, how, chk }] */
  function layouts(P, o) {
    const G = geom(P), Ru = o.Ru, ref = o.ref, q = o.q || { mode: 'auto' }, W = q.mode === 'range' ? windows(q.win) : [], qk = o.qk || (() => q);
    const inSpan = (list, k) => list.filter(x => x > G.sup[k] + 1e-9 && x < G.sup[k + 1] - 1e-9);
    const nat = k => G.cont ? inSpan(uniq(o.cf.pts.map(c => c.xr)), k) : inSpan(ref.spl, k);
    const fill = (k, pts, n) => { let p = pts.slice();
      if (!p.length && n > 0) { for (let j = 1; j <= n; j++) p.push(Math.round(G.sup[k] + G.spans[k] * j / (n + 1))); return uniq(p); }
      while (p.length < n) { const e = uniq([G.sup[k], ...p, G.sup[k + 1]]); let bi = 0; for (let i = 1; i < e.length - 1; i++) if (e[i + 1] - e[i] > e[bi + 1] - e[bi]) bi = i; p = uniq([...p, Math.round((e[bi] + e[bi + 1]) / 2)]); }
      return p; };
    const opts = G.spans.map((_, k) => { const qq = qk(k), cur = inSpan(o.cur || [], k), rk = inSpan(ref.spl, k), N = nat(k);
      if (qq.mode === 'lock') return [{ pts: cur, how: 'as entered' }];
      let lo, hi; if (qq.mode === 'range') { lo = Math.max(0, Math.round(qq.min != null ? qq.min : 0)); hi = Math.max(lo, Math.round(qq.max != null ? qq.max : Math.max(lo, rk.length))); } else { lo = Math.max(0, rk.length - 1); hi = rk.length; }
      const out = []; for (let nn = lo; nn <= Math.min(hi, 6); nn++) {
        if (qq.mode !== 'range' && nn === rk.length) { out.push({ pts: rk, how: 'the rule' }); continue; }
        const nm = G.cont ? 'contraflexure point' : 'rule point';
        if (nn <= N.length) combos(N, nn).forEach(c => out.push({ pts: c, how: nn === N.length ? `the ${nm}s` : `${nn} of the ${N.length} ${nm}(s)` }));
        else out.push({ pts: fill(k, N, nn), how: `${nn} (the ${nm}s and the longest gap halved)` }); }
      return out; });
    // the product over the spans (at most 256)
    let prod = [[]]; opts.forEach(list => { const nx = []; prod.forEach(a => list.forEach(b => { if (nx.length < 256) nx.push([...a, b]); })); prod = nx; });
    const moveWin = x => { if (!W.length || W.some(([a, b]) => x >= a - 1e-9 && x <= b + 1e-9)) return x; const k = spanOf(G, x); let best = null;
      W.forEach(([a, b]) => { const lo = Math.max(a, k >= 0 ? G.sup[k] : a), hi = Math.min(b, k >= 0 ? G.sup[k + 1] : b); if (lo > hi + 1e-9) return; const y = Math.min(hi, Math.max(lo, x)); if (best == null || Math.abs(y - x) < Math.abs(best - x)) best = y; });
      return best == null ? null : r2(Math.round(best * 100) / 100); };
    const seen = new Set(), res = [], dist = s => s.reduce((a, x) => a + Math.min(Infinity, ...ref.spl.map(y => Math.abs(y - x))), 0) + Math.abs(s.length - ref.spl.length) * 1e3;
    for (const p of prod) {
      let spl = p.flatMap(b => b.pts).map(moveWin); if (spl.some(x => x == null)) continue;
      spl = uniq(spl.map(x => { const near = G.sup.reduce((a, b) => Math.abs(b - x) < Math.abs(a - x) ? b : a, G.sup[0]); return Math.abs(x - near) < Ru.minSup - 1e-9 && qk(Math.max(0, spanOf(G, x))).mode !== 'lock' ? r2(near + (x >= near ? 1 : -1) * Ru.minSup) : x; })).filter(x => x > 0 && x < G.Lt);
      const k0 = JSON.stringify(spl); if (seen.has(k0)) continue; seen.add(k0);
      const fixed = new Set(spl.filter(x => qk(Math.max(0, spanOf(G, x))).mode === 'lock'));
      // a symmetric bridge (spans and skews) keeps a symmetric layout, as the old app mirrors its left half (unless a span is locked)
      const symOn = G.sym && !G.spans.some((_, k) => qk(k).mode === 'lock'), mir = list => uniq(list.map(x => r2(G.Lt - x)));
      if (symOn && JSON.stringify(mir(spl)) !== JSON.stringify(spl)) continue;
      let C = check(P, spl, Ru, { segs: o.segs, allow: o.allow, frames: o.frames ? o.frames(spl) : null, trans: o.trans });
      // a cross-frame or transition conflict: that splice moved 1 ft at a time (up to SHIFT each way, the nearer first) where every rule holds
      for (let it = 0; it < 4 && !C.ok; it++) { const bad = C.items.find(i => !i.ok && (i.id === 'SP5' || i.id === 'SP6') && !fixed.has(i.x)); if (!bad) break; let moved = false;
        for (let d = 1; d <= SHIFT && !moved; d++) for (const sg of [1, -1]) { const y = r2(bad.x + sg * d), ym = r2(G.Lt - y), xm = r2(G.Lt - bad.x); if (W.length && moveWin(y) !== y) continue;
          const s2 = uniq(spl.map(x => x === bad.x ? y : symOn && x === xm && Math.abs(xm - bad.x) > 0.25 ? ym : x));
          const C2 = check(P, s2, Ru, { segs: o.segs, allow: o.allow, frames: o.frames ? o.frames(s2) : null, trans: o.trans }); const nb = C2.items.filter(i => !i.ok).length;
          if (nb < C.items.filter(i => !i.ok).length && !C2.items.some(i => !i.ok && i.id !== 'SP5' && i.id !== 'SP6')) { spl = s2; C = C2; moved = true; break; } }
        if (!moved) break; }
      // every rule must hold (the shipping weight on the current plates here; on its own plates again for each candidate)
      if (!C.ok) continue;
      // isRef: the rule's layout (every span by the rule, or locked as entered)
      res.push({ spl, how: p.map((b, k) => `span ${k + 1}: ${b.how}`).join('; '), chk: C, isRef: JSON.stringify(spl) === JSON.stringify(ref.spl) || p.every(b => b.how === 'the rule' || b.how === 'as entered') });
    }
    res.sort((a, b) => (b.isRef - a.isRef) || (a.spl.length - b.spl.length) || (dist(a.spl) - dist(b.spl)));
    let keep = q.mode === 'auto' ? res.filter((r, i) => r.isRef || i === res.findIndex(z => !z.isRef)) : res;   // Auto: the rule's layout and the fewest-splice one
    // Auto: the current stations too when they meet every rule (so the objective can keep them; Auto is then never worse than Lock)
    if (q.mode === 'auto' && (o.cur || []).length) { const cu = uniq(o.cur), kc = JSON.stringify(cu);
      if (!keep.some(r => JSON.stringify(r.spl) === kc)) { const C = check(P, cu, Ru, { segs: o.segs, allow: o.allow, frames: o.frames ? o.frames(cu) : null, trans: o.trans });
        if (C.ok) keep = [...keep.filter(r => r.isRef), { spl: cu, how: 'the stations entered (they meet every rule)', chk: C, isCur: true }, ...keep.filter(r => !r.isRef)]; } }
    return keep.slice(0, o.max || (q.mode === 'auto' ? 3 : 4));
  }

  /* transitions(segs, spl, tol): the shop flange transition stations of plates segs (a change of a flange's width or thickness away from the splices) */
  function transitions(segs, spl, tol) {
    const out = []; for (let k = 1; k < segs.length; k++) { const a = segs[k - 1], c = segs[k], x = a.x1; if (spl.some(s => Math.abs(s - x) <= (tol || 0.5))) continue;
      if (a.topB !== c.topB || a.topT !== c.topT || a.botB !== c.botB || a.botT !== c.botT) out.push(r2(x)); }
    return uniq(out);
  }

  window.SBDSplicePlace = { DFLT, rules, geom, contraflexure, reference, check, placeSteps, layouts, windows, transitions, pieceWt };
})();
