/* apps/steel-bridge/engine/lldf.js — live-load distribution factors for steel I-girders with a concrete deck, cross-section
   type (a) (window.SBDLldf). Classic script, no DOM. Needs window.SharedLLDF (shared/lldf.js), window.SharedSteps and
   window.SBDSections, loaded first.

   A thin adapter (2026-10-29, fixlog/steel-bridge.md): the distribution factors come from shared/lldf.js, the engine of lldf.html
   (the suite's verified LLDF tool): geometry, skewFactors, empiricalInterior, leverConfig, leverAll, rigidMethod, memberDF. This file
   maps the app's regions (span and pier, K_g from the girder's plates) to SharedLLDF's input, maps the results back to the fields
   the app and its tests use; the worked steps (shared/steps.js format) are written by SharedLLDF.steps (shared/lldf.js; moved
   there unchanged on 2026-11-01 so that lldf.html's Report tab uses the same writer, fixlog/shared-lldf.md LLST). What stays here, as GirderDetail has it
   (Steel Bridge Design.html, LLDF and DLs module): K_g per region (KgOf, the length-weighted option), the region list (bridgeDef),
   the shear-skew option for exterior girders only, the exterior "not less than interior" policy, the range checks (DF1).
   Skew θ in the tables is |θ| (SB2-O23, 2026-10-29; GirderDetail DFL6, as lldf.html).

   Engineer's decision 2026-10-29 (SB2-O19): the factors follow lldf.html where GirderDetail differed: (1) exterior fatigue
   factor = max(one-lane lever rule, one-lane rigid cross-section)/1.2 (4.6.2.2.2d); (2) no moment skew reduction for a span
   whose two support lines differ by more than 10° (4.6.2.2.2e, per span: SharedLLDF.momentSkewNoReduction); (3) with S > 16 ft
   or N_b = 3 the multi-lane lever rule is the governing of 2 … N_L trucks (leverMulti); (4) the lever rule also tests the exact
   kink positions.

   Units: spacings, overhangs, traffic faces, span lengths ft; slab thickness, plates, haunch in; K_g in^4; skew degrees.
   Code: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024), Art. 4.6.2.2 (approximate method), cross-section (a). */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0);
  const sum = a => a.reduce((s, x) => s + x, 0);   // GirderDetail sum()

  const SL = () => window.SharedLLDF, SS = () => window.SharedLLDF.steps;   // SS: the worked-step writer (shared/lldf.js, moved there 2026-11-01)
  /* multiple presence factor m, Table 3.6.1.1.2-1 (SharedLLDF.multiplePresence) */
  const MPF = n => SL().multiplePresence(n);
  /* ranges of applicability, Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1 (GirderDetail DF_RNG; the same limits as SharedLLDF.RANGES) */
  const RANGE = { S: [3.5, 16.0, 'ft', 'Average beam spacing S'], L: [20, 240, 'ft', 'Span length L'], ts: [4.5, 12.0, 'in', 'Slab thickness t_s'], Nb: [4, Infinity, '', 'Number of beams N_b'], Kg: [10000, 7000000, 'in⁴', 'Stiffness parameter K_g'] };
  /* simplified K_g terms, Table 4.6.2.2.1-3, type (a): (Kg/12Lts³)^0.1, (Kg/12Lts³)^0.25, (12Lts³/Kg)^0.3 (SharedLLDF.KG_SIMPLE) */
  const SIMPLE = { m: 1.02, c1: 1.03, v: 0.97 };

  /* lp(p): SharedLLDF's input (lldf.html's readInputs form) for this app's region input p: { Nb, spacings, OL, OR, rL, rR, L, ts,
     gap (ft, the same gap between every pair of trucks), simple (K_g terms of Table 4.6.2.2.1-3), thM, thV (moment and shear skew) }.
     type 'a': steel I-girders with a concrete deck. */
  const lp = p => ({ type: 'a', Nb: p.Nb, spacings: p.spacings, OL: p.OL, OR: p.OR, rL: p.rL, rR: p.rR, L: p.L, ts: p.ts,
    skew: p.thM != null ? p.thM : 0, skewV: p.thV != null ? p.thV : 0, truckGaps: new Array(64).fill(p.gap), kgSimple: !!p.simple });

  /* geometry(p): girder positions and the roadway (SharedLLDF.geometry). p: { Nb, spacings [ft], OL, OR (overhangs, ft), rL, rR
     (deck edge to the live-load traffic face, ft) }. N_L, Art. 3.6.1.1.1: INT(w/12), a 20–24 ft roadway two lanes of w/2. */
  function geometry(p) { return SL().geometry(p); }
  function geometrySteps(p, geo) { const w = St().work('df.geo'); SS().geometry(w, p, geo); return w.steps; }   // the steps: SharedLLDF.steps (moved 2026-11-01)
  const typeOf = (p, j) => (j === 0 || j === p.Nb - 1) ? 'ext' : 'int';
  const spacingOf = (p, j) => j === 0 ? p.spacings[0] : j === p.Nb - 1 ? p.spacings[p.spacings.length - 1] : (p.spacings[j - 1] + p.spacings[j]) / 2;

  /* momentSkew(rg, skews): the region's skews for Tables 4.6.2.2.2e-1 / 4.6.2.2.3c-1 (deg, signed). Moment: the smaller skew of the
     region's support lines (GirderDetail), none (4.6.2.2.2e, engineer's decisions 2026-10-29) for a span whose two support lines
     differ by more than 10° (SharedLLDF.momentSkewNoReduction) and for a pier region if either adjacent span's two support lines do
     (SharedLLDF.momentSkewNoReductionPier; skews: every support line of the bridge); shear: the larger. The tables' θ is |θ| (the sign
     only gives the direction; SB2-O23, engineer's decision 2026-10-29, as lldf.html and GirderDetail DFL6); the 10° rule compares the
     signed skews (the angle between the two support lines). */
  function momentSkew(rg, skews) {
    const skA = rg.skA, skB = rg.skB, thMin = Math.min(Math.abs(skA), Math.abs(skB)), thMax = Math.max(Math.abs(skA), Math.abs(skB)), K = Array.isArray(skews) ? skews.map(v => +v || 0) : null;
    let noRed, dTh;
    if (rg.kind === 'sup' && K && K.length > rg.i) { const pv = rg.i > 0 ? K[rg.i - 1] : null, nx = rg.i + 1 < K.length ? K[rg.i + 1] : null, pr = K[rg.i];
      noRed = SL().momentSkewNoReductionPier(pv, pr, nx); dTh = Math.max(pv != null ? Math.abs(pr - pv) : 0, nx != null ? Math.abs(nx - pr) : 0); }
    else { noRed = SL().momentSkewNoReduction(skA, skB); dTh = Math.abs(skA - skB); }
    return { thMin, noRed, dTh, thM: noRed ? 0 : thMin, thV: thMax };
  }
  /* skew(p, geo, Kg): SharedLLDF.skewFactors (beam-slab rows: moment reduction 30° ≤ θ ≤ 60° (θ > 60°: 60°), shear correction).
     p.thM, p.thV from momentSkew. Returns SharedLLDF's object plus thM, thV, tanM, noRed, dTh, thMin. */
  function skew(p, geo, Kg) {
    const s = SL().skewFactors(lp(p), geo, Kg);
    return { ...s, thM: p.thM, thV: p.thV, tanM: s.tan || 0, tanV: s.tanV || 0, noRed: !!p.noRed, dTh: p.dTh || 0, thMin: p.thMin != null ? p.thMin : p.thM };
  }
  const skewSteps = (w, p, sk, Kg) => SS().skew(w, p, sk, Kg);
  /* emp(Kg, L, ts, S, simple): the interior-girder equations (SharedLLDF.empiricalInterior). Moment, Table 4.6.2.2.2b-1; shear,
     Table 4.6.2.2.3a-1. */
  function emp(Kg, L, ts, S, simple) { return SL().empiricalInterior(Kg, L, ts, S, simple); }

  /* lever rule (SharedLLDF leverContribution, leverConfig, leverAll, leverMulti): deck hinged over the girders; a train of N trucks
     (6 ft between wheel lines, gaps ≥ 4 ft between trucks, 3.6.1.3.1), outer wheels ≥ 2 ft from the traffic faces, moved on a
     0.25 ft grid and to the exact positions where a wheel is over a girder line (the kinks of R(s)) and the end of travel.
     Each result also carries c: the influence ordinate of every wheel line at the governing position (for the worked steps). */
  const leverC = (pos, Nb, j, uw) => SL().leverContribution(pos, Nb, j, uw);
  const withC = (p, geo, j, L) => SS().withC(p, geo, j, L);
  function lever(p, geo, j, N) { const q = lp(p); return withC(q, geo, j, SL().leverConfig(q, geo, j, N)); }
  function leverAll(p, geo, j) { const q = lp(p), r = SL().leverAll(q, geo, j), cfgs = r.cfgs.map(c => withC(q, geo, j, c)); return { cfgs, gov: r.gov ? cfgs[r.cfgs.indexOf(r.gov)] : null }; }
  function leverMulti(p, geo, j) { const q = lp(p); return withC(q, geo, j, SL().leverMulti(q, geo, j)); }
  /* rigid cross-section, Eq. C4.6.2.2.2d-1: R = N_L/N_b + X_ext Σe / Σx², g = m R (SharedLLDF.rigidMethod) */
  function rigid(p, geo, side) { return SL().rigidMethod(lp(p), geo, side); }

  /* member(p, geo, Kg, sk, j): the factors of girder j (0-based): SharedLLDF.memberDF (lldf.html memberDF, type (a)), mapped to
     { j, label, type, S, emp, alt, r: { mom1, mom2, shr1, shr2 }, gM, gV, fatM, fatV, method, … }. Interior: equations (S > 16 ft:
     lever rule; N_b = 3: moment the lesser of the equation and the lever rule, shear the lever rule; multi-lane lever rule = the
     governing of 2 … N_L trucks). Exterior: one lane lever rule; two or more lanes e × interior (d_e ≥ −1.0 ft), not less than the
     rigid cross-section value. Skew factors on every value. Fatigue: one-lane value / 1.2; exterior one-lane value = max(lever
     rule, rigid cross-section with one lane) (4.6.2.2.2d). sk: skew() (with scfV = 1 for the shear-skew option). */
  function member(p, geo, Kg, sk, j, w) { return SS().member(lp(p), geo, Kg, sk, j, w); }   // SharedLLDF.steps.member: memberDF mapped, and its steps

  /* Kg(s, n, hP, ts): longitudinal stiffness parameter, Eq. 4.6.2.2.1-1: K_g = n(I + A e_g²), e_g = (d − ȳ) + haunch + t_s/2
     (GirderDetail KgOf). s: steel section { A, yb, I, d } (SBDSections steel core); hP the haunch in the composite properties
     (0 under the owner rule OWN8). */
  function Kg(s, n, hP, ts) { const eg = (s.d - s.yb) + hP + ts / 2; return { eg, Kg: n * (s.I + s.A * eg * eg) }; }
  const steelOf = sec => window.SBDSections.steelCore(sec);

  /* compute(input): every region (span and pier) and every girder.
     input: { Nb, spacings [ft], OL, OR, rL, rR (ft), ts (structural slab, in), haunchP (haunch in the composite properties, in),
              n (modular ratio), gap (ft, ≥ 4), kg: 'max' | 'avg' | 'simple', skewV: 'all' | 'ext', extMin: 'yes' | 'no',
              skews (deg, every support line, for the pier rule of 4.6.2.2.2e), regions: [{ id, i, kind: 'span' | 'sup', label, L (ft), skA, skB (support skews, deg), sec: plates { D, tw, topB, topT, botB, botT },
                          segs: [{ L, sec }] (the plate pieces of the region, for kg 'avg') }] }
     Returns { geo, regions: [{ …region, s, eg, Kg, KgAvg, pp, geo, sk, members, lever, mD, gDef, steps }], steps (geometry) }. */
  function compute(q) {
    const base = { Nb: q.Nb, spacings: q.spacings, OL: q.OL, OR: q.OR, rL: q.rL, rR: q.rR, fL: q.fL, fR: q.fR, ts: q.ts, gap: q.gap, simple: q.kg === 'simple' };
    const KgOf = s => Kg(s, q.n, q.haunchP, q.ts);
    const regions = q.regions.map(rg => {
      const s = steelOf(rg.sec), k0 = KgOf(s), eg = k0.eg; let Kgv = k0.Kg, KgAvg = null;
      if (rg.segs && rg.segs.length) { const Lt = sum(rg.segs.map(x => x.L)); KgAvg = { parts: rg.segs.map(x => ({ L: x.L, sec: x.sec, Kg: KgOf(steelOf(x.sec)).Kg })), Lt }; KgAvg.Kg = sum(KgAvg.parts.map(x => x.L * x.Kg)) / Lt; if (q.kg === 'avg') Kgv = KgAvg.Kg; }
      const ms = momentSkew(rg, q.skews), pp = { ...base, L: rg.L, skewM: ms.thMin, skewV: ms.thV, ...ms }, geo = geometry(pp), sk = skew(pp, geo, Kgv);   // ms: 4.6.2.2.2e per span / pier
      const w = St().work('df.' + rg.id);
      w.add({ id: 'eg', label: `${rg.label}: distance between the centers of gravity of the girder and the deck`, sym: 'e_{g}', eq: '(d - \\bar{y}) + h + \\frac{t_{s}}{2}', sub: `(${n3(s.d)} - ${n3(s.yb)}) + ${n2(q.haunchP)} + \\frac{${n2(q.ts)}}{2}`, value: eg, unit: 'in', d: 3, ref: `${ED} Art. 4.6.2.2.1`, note: q.haunchNote || '' });
      w.add({ id: 'Kg0', label: `${rg.label}: longitudinal stiffness parameter at the region's section`, sym: 'K_{g}', eq: 'n(I + Ae_{g}^{2})', sub: `${n3(q.n)}(${g0(s.I)} + ${n2(s.A)}(${n3(eg)})^{2})`, value: k0.Kg, unit: 'in^{4}', d: 0, ref: `${ED} Eq. 4.6.2.2.1-1` });
      if (KgAvg) w.add({ id: 'KgAvg', label: `${rg.label}: length-weighted K_g of the plate pieces`, sym: 'K_{g,avg}', eq: '\\frac{\\sum L_{i}K_{g,i}}{\\sum L_{i}}', sub: `\\frac{${KgAvg.parts.map(x => `${n2(x.L)}(${g0(x.Kg)})`).join(' + ')}}{${n2(KgAvg.Lt)}}`, value: KgAvg.Kg, unit: 'in^{4}', d: 0, ref: `${ED} Art. 4.6.2.2.1` });
      w.add({ id: 'Kg', label: `${rg.label}: K_g used`, sym: 'K_{g}', eq: q.kg === 'avg' && KgAvg ? 'K_{g,avg}' : 'K_{g}', sub: '', value: Kgv, unit: 'in^{4}', d: 0, note: q.kg === 'simple' ? 'Simplified K_g terms of Table 4.6.2.2.1-3 used in the equations.' : '' });
      skewSteps(w, { ...pp, geoSavg: geo.Savg, pier: rg.kind === 'sup' }, sk, Kgv);
      const members = []; for (let j = 0; j < q.Nb; j++) { const mw = St().work(`df.${rg.id}.G${j + 1}`);
        members.push(member(pp, geo, Kgv, q.skewV === 'ext' && typeOf(pp, j) === 'int' ? { ...sk, scfV: 1 } : sk, j, mw)); members[j].steps = mw.steps; }
      if (q.extMin === 'yes') { const ints = members.filter(m => m.type === 'int'); if (ints.length) { const iM = Math.max(...ints.map(m => m.gM)), iV = Math.max(...ints.map(m => m.gV));
        members.filter(m => m.type === 'ext').forEach(m => { if (iM > m.gM) { m.gM = iM; m.policyM = true; } if (iV > m.gV) { m.gV = iV; m.policyV = true; } if (m.policyM || m.policyV) { m.method += ', raised to interior (policy)';
          m.steps.push(St().step({ id: `df.${rg.id}.G${m.j + 1}.policy`, label: `${m.label}: exterior factors not less than the interior (owner / engineer policy)`, sym: 'g_{M}, g_{V}', eq: '\\max(g_{ext}, g_{int})', sub: '', value: `${n4(m.gM)}, ${n4(m.gV)}`, unit: '', d: 4 })); } }); } }
      const lev = members.map((m, j) => leverAll(pp, geo, j)), mD = MPF(geo.NL), gDef = geo.NL * mD / q.Nb;
      w.add({ id: 'gDef', label: `${rg.label}: deflection distribution factor (all lanes loaded, all girders equal)`, sym: 'g_{\\Delta}', eq: '\\frac{N_{L}m}{N_{b}}', sub: `\\frac{${geo.NL}(${n2(mD)})}{${q.Nb}}`, value: gDef, unit: '', d: 4, ref: `${ED} Art. 2.5.2.6.2` });
      return { ...rg, s, eg, Kg: Kgv, KgAvg, pp, geo, sk, members, lever: lev, mD, gDef, steps: w.steps };
    });
    const geo0 = regions.length ? regions[0].geo : geometry({ ...base, L: 1, skewM: 0, skewV: 0 });
    return { regions, geo: geo0, steps: geometrySteps(base, geo0) };
  }

  /* range checks (GirderDetail check DF1): [{ region, key, value, lo, hi, ok }] */
  function ranges(R, ts, Nb) {
    const out = [];
    R.regions.forEach(rg => { const g = rg.geo, v = { S: g.Savg, L: rg.L, ts, Nb, Kg: rg.Kg };
      Object.entries(RANGE).forEach(([k, [lo, hi, u, nm]]) => { const x = v[k]; out.push({ region: rg.label, key: k, name: nm, unit: u, value: x, lo, hi, ok: x >= lo - 1e-9 && x <= hi + 1e-9 }); });
      [['left', g.deL], ['right', g.deR]].forEach(([sd, de]) => out.push({ region: rg.label, key: 'de', name: `d_e ${sd}`, unit: 'ft', value: de, lo: -1.0, hi: 5.5, ok: de >= -1.0 - 1e-9 && de <= 5.5 + 1e-9 })); });
    return out;
  }

  /* regions(spans, cont, skews, segments, x): the span and pier regions of GirderDetail's bridge hand-off (Preliminary sizing
     bridgeDef): span i from support i to i + 1, its section at station x[i] (default mid-span; GirderDetail: the station of the
     largest positive moment of Preliminary sizing's analysis), its plate pieces between the supports; pier i (continuous only):
     L the average of the adjacent spans, its section at the support − 0.01 ft, its pieces from 0.2 of each adjacent span.
     segments: [{ x0, x1, D, tw, topB, topT, botB, botT }] (ft from the left end, in). */
  function regions(spans, cont, skews, segments, xs) {
    const sup = [0]; spans.forEach(L => sup.push(sup[sup.length - 1] + L));
    const secAt = x => { const s = segments.find(q => x >= q.x0 - 1e-9 && x <= q.x1 + 1e-9) || segments[segments.length - 1]; return { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }; };
    const segs = (a0, a1) => { const br = new Set([a0, a1]); segments.forEach(r => [r.x0, r.x1].forEach(v => { if (v > a0 + 1e-6 && v < a1 - 1e-6) br.add(v); }));
      const pts = [...br].sort((a, b) => a - b), out = []; for (let k = 0; k < pts.length - 1; k++) { const L = pts[k + 1] - pts[k]; if (L > 1e-6) out.push({ L: +L.toFixed(3), sec: secAt((pts[k] + pts[k + 1]) / 2) }); } return out; };
    const out = [], nSp = spans.length, sk = i => +(skews && skews[i]) || 0;
    for (let i = 0; i < nSp; i++) { const x0 = sup[i], x1 = sup[i + 1], x = xs && isFinite(xs[i]) ? xs[i] : (x0 + x1) / 2;
      out.push({ id: 's' + i, kind: 'span', i, label: `Span ${i + 1}`, L: +(x1 - x0).toFixed(3), x: +x.toFixed(2), sec: secAt(x), segs: segs(x0, x1), skA: sk(i), skB: sk(i + 1) }); }
    if (cont) for (let i = 1; i < nSp; i++) { const x = sup[i];
      out.push({ id: 'p' + i, kind: 'sup', i, label: `Pier ${i}`, L: +(((sup[i] - sup[i - 1]) + (sup[i + 1] - sup[i])) / 2).toFixed(3), x: +x.toFixed(2), sec: secAt(x - 0.01), segs: segs(x - 0.2 * (sup[i] - sup[i - 1]), x + 0.2 * (sup[i + 1] - sup[i])), skA: sk(i), skB: sk(i) }); }
    return out;
  }

  window.SBDLldf = { MPF, RANGE, SIMPLE, geometry, typeOf, spacingOf, momentSkew, skew, emp, leverC, lever, leverAll, leverMulti, rigid, member, Kg, compute, ranges, regions };
})();
