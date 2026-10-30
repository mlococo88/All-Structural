/* apps/steel-bridge/engine/analysis.js — structural analysis of one girder line (window.SBDAnalysis).
   Classic script, no DOM. Needs (loaded first): shared/steps.js, shared/vehicles.js, shared/moving-load.js,
   engine/sections.js.

   Created 2026-10-29 (docs/REBUILD_PLAN.md §5, "Analysis"). Connects the shared beam engine (SharedMovingLoad.analyze with
   m.simple, staticAnalysis, camber, deflection) to the project model. Nothing here solves a beam: it builds the
   stiffness per stage, the loads, the stations and the distribution factors the way GirderDetail's Structural analysis
   module does ("Steel Bridge Design.html": GM.sa.compute, feStages, saSeq; anchors below), runs the shared engine and
   applies the distribution factors.

   Mirrors GirderDetail (GM.sa.compute):
   - stations: GirderDetail's node grid, each span cut into max(8, round(L)) equal parts (sgBeam);
   - stiffness per stage (feStages): DC1 on the steel section I_s; DC2 and DW on the long-term composite I_3n; LL on the
     short-term composite I_n; in the cracked zones I_3n and I_n are replaced by steel + longitudinal deck reinforcement
     (6.10.1.5). Cracked zones: 'none' (GirderDetail's default, the deck effective over the whole length, 6.10.1.5),
     '15' (15 % of each adjacent span either side of each interior support) or 'dl' (where the moment of DC1 on I_s plus
     DC2 + DW on uncracked I_3n is negative at both ends of a grid element). Continuous girders only.
   - DC1 = girder steel (plates × 490/144 = 3.4028 lb/ft per in² × (1 + detail allowance); GirderDetail SA_PLF: 3.4, SB2-A2) + cross-frame point
     loads (XF1) + the wet deck rows (deck, haunch, SIP, other DC1) — all on I_s. Construction LL (M_CL) on I_s. Existing
     (UT) and future (UF) utilities on I_s (OWN16).
   - LL: HL-93 per lane with IM on truck and tandem (3.6.1.2, 3.6.2.1), 90 % of two trucks + lane for negative moment and
     interior reactions (3.6.1.3.1); fatigue truck with IM_f (3.6.1.4.1). The distribution factor per station: the pier
     factor g_M in the region of negative permanent-load moment around each interior support, the span factor elsewhere;
     g_V of the span of the element; reactions the larger g_V of the adjacent spans; fatigue g's of the span.
   - pedestrian load (added 2026-10-30, sb-ped-owner PR; 3.6.1.6, GirderDetail plRow / vSec): w_PL of this girder (the loads module's
     share of the sidewalk load) on the + and − parts of each influence line (live-load stiffness): R.pl, apart from R.ll (HL-93);
     llPL(R) gives LL+IM + PL, once, to the modules; not in fatigue, deck placement or the LL deflection.
   - LL deflection (SA3, 2.5.2.6.2): g_Δ max(Δ_truck(1 + IM), 0.25 Δ_truck(1 + IM) + Δ_lane) ≤ L/limit, per span; truck axles that
     do not add neglected (LL8, SB2-A4); the limit from the owner rule OWN19 where there is one (deflOwner, SB2-A5).
   - camber: dead-load deflection per stage (steel, wet deck, DC2 + DW, existing utilities) and the total.
   - deck placement sequence (SA7, 6.10.3.4.1): pours from the sign of M_DC1 (positive regions first, then negative)
     or a custom list; each pour's wet deck on the girder with the earlier pours composite (n or 3n, uncracked);
     M_DCc = the noncomposite moment envelope (as GirderDetail's hand-off), deck tension in hardened pours vs φf_r.
   Differences from GirderDetail by construction (reported, not changed; see tests/engine/analysis.test.mjs): the shared
   engine applies uniform loads exactly (consistent loads) where GirderDetail lumps them at its nodes; its moving-load
   search refines truck positions to 0.1 ft and spacings to 0.5 ft (GirderDetail: the 1-ft grid, 1-ft spacings);
   deflections are exact beam deflections (GirderDetail: virtual work by the nodal rule); a pour's wet load is applied
   exactly over its length (GirderDetail loads a node on a pour boundary in both pours).

   Units: x and spans ft; plates in; I in^4; E ksi; loads klf and kip; M kip-ft; V, R kip; deflection in (down +).
   Shear sign: V = sum of the forces to the left of the section, up positive (positive at the left end of a span under
   gravity; GirderDetail's sign. The girderDemands hand-off uses the opposite, MIDAS, sign).

   Inputs read from the project (engine/model.js), all optional, with defaults:
     project.analysis = { im: 33, imf: 15 (%), crack: 'none' | '15' | 'dl', deflLimit: 800 (L/…), seq: 'on' | 'off',
                          seqMod: 'n' | '3n', seqCustom: 'a-b, c-d' (ft), steelAllowPct: 5 (when xs.allow is not available),
                          haunchInStiffness: true | false (absent: the owner rule OWN8, SBDOwners.loadFactors().h0) }
     girder.line      the cross-section girder (0-based) whose loads and factors this plate girder takes; absent: the first
                      exterior girder (position 'exterior') or the first interior girder
   Dead loads and distribution factors, in this order of precedence:
     1. girder.loads / girder.df: explicit values per girder (an imported hand-off; the parity tests)
          loads { DC1wet, DC2, DW, CL, UT, UF, PL (klf; PL: the pedestrian load on this girder), xf: [{ x (ft), P (kip) }], steelAllowPct, source }
          df    { spans: [{ gM, gV, fatM, fatV, gDef? }], piers: [{ gM }], gDef, source }
     2. the loads module (engine/loads.js + engine/lldf.js, window.SBDLoads): SBDLoads.compute(SBDLoads.fromModel(project,
        { girder })) and SBDLoads.girder(result, line): DC1 (deck, haunch, SIP, DC1 rows), DC2, DW, UT, UF, the detail allowance
        xs.allow, and per region the factors gM, gV, fatM, fatV and gDef (spans 's<i>', piers 'p<k>')
     3. girder.loadsManual / girder.dfManual, entered: the same load fields; { gM, gMpier, gV, fatM, fatV, gDef } for every span
     The construction live load (CL) is not in the loads module yet: 1 or 3 only. The cross-frame point loads (xf): 1, else, when the project
     has framing and engine/framing.js and engine/crossframes.js are loaded, every frame of the layout on this girder's cross-section line
     (SBDCrossframes.pointLoads: GirderDetail's XF1 weight, W/2 per girder at its own stations), else 3.
     Nothing entered: loads 0 and factors 1 (per lane), with a warning. */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const ML = () => window.SharedMovingLoad, SEC = () => window.SBDSections, St = () => window.SharedSteps, VEH = () => window.SharedVehicles;
  const STEEL_PLF = 490 / 144;   // lb/ft per in² of steel: 490 pcf / 144 = 3.4028 (Table 3.5.1-1; SB2-A2, 2026-10-29: GirderDetail's SA_PLF is 3.4)
  const DEF = { im: 33, imf: 15, crack: 'none', deflLimit: 800, seq: 'on', seqMod: 'n', seqCustom: '', steelAllowPct: 5, haunchInStiffness: null };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const n1 = x => St().n(x, 1), n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), g0 = x => St().g(x, 0);

  /* grid(spans): GirderDetail's node grid (sgBeam): each span in max(8, round(L)) equal parts. { xs, sup (node indices) } */
  function grid(spans) {
    const xs = [0], sup = [0];
    spans.forEach(L => { const n = Math.max(8, Math.round(L)), h = L / n, x0 = xs[xs.length - 1]; for (let k = 1; k <= n; k++) xs.push(x0 + k * h); sup.push(xs.length - 1); });
    return { xs, sup };
  }

  /* settings(project): project.analysis with the defaults filled in */
  function settings(P) { const a = (P && P.analysis) || {}, o = {}; for (const k in DEF) o[k] = a[k] !== undefined && a[k] !== null && a[k] !== '' ? a[k] : DEF[k]; return o; }

  /* lineOf(project, g): the cross-section girder of plate girder g (see the header) */
  function lineOf(P, g) {
    const xs = P.xs || (window.SBDModel && window.SBDModel.defaultXs ? window.SBDModel.defaultXs(P) : null), nb = xs ? Math.round(xs.nb) : 0;
    if (isNum(g.line) && g.line >= 0 && g.line < nb) return Math.round(g.line);
    return g.position === 'exterior' || nb < 3 ? 0 : 1;
  }
  /* moduleOf(project, gi): the loads module's result for girder gi, or null (module not loaded) or { errors } */
  function moduleOf(P, gi) {
    const LD = window.SBDLoads; if (!LD || !window.SBDLldf || !window.SBDOwners || !window.SBDModel) return null;
    try {
      const { b, p } = LD.fromModel(P, { girder: gi }), R = LD.compute(b, p);
      if (R.errors && R.errors.length) return { errors: R.errors };
      const j = lineOf(P, P.girders[gi]); return { j, G: LD.girder(R, j), R, allow: b.allow, lf: R.lf };
    } catch (e) { return { errors: [e.message] }; }
  }

  /* loadsOf(project, g, mod): the girder's dead loads (precedence in the header).
     { DC1wet, DC2, DW, CL, UT, UF, PL, xf, steelAllowPct, src: { field: 'girder' | 'module' | 'manual' | 'none' }, source } */
  function loadsOf(P, g, mod) {
    const A = g.loads || null, M = mod && mod.G ? mod.G : null, B = g.loadsManual || null, o = { src: {} };
    const fromM = { DC1wet: M && M.DC1, DC2: M && M.DC2, DW: M && M.DW, UT: M && M.UT, UF: M && M.UF };
    ['DC1wet', 'DC2', 'DW', 'CL', 'UT', 'UF'].forEach(k => {
      if (A && isNum(A[k])) { o[k] = A[k]; o.src[k] = 'girder'; } else if (M && isNum(fromM[k])) { o[k] = fromM[k]; o.src[k] = 'module'; }
      else if (B && isNum(B[k])) { o[k] = B[k]; o.src[k] = 'manual'; } else { o[k] = 0; o.src[k] = 'none'; } });
    // pedestrian load w_PL on this girder (3.6.1.6; the loads module's share of the sidewalk load, LLDF and DLs): explicit, module, entered
    // (added 2026-10-30, sb-ped-owner PR: before, only read for a warning)
    if (A && isNum(A.PL)) { o.PL = A.PL; o.src.PL = 'girder'; } else if (M && isNum(M.PL)) { o.PL = M.PL; o.src.PL = 'module'; } else if (B && isNum(B.PL)) { o.PL = B.PL; o.src.PL = 'manual'; } else { o.PL = 0; o.src.PL = 'none'; }
    // cross-frame point loads (XF1): explicit girder loads, else the framing and cross-frame weight (engine/framing.js, engine/crossframes.js;
    // added 2026-10-29 with the cross-frames PR, SB2-A6), else entered
    const CFm = !(A && Array.isArray(A.xf)) && P.framing && window.SBDCrossframes && window.SBDFraming ? window.SBDCrossframes.pointLoads(P, (P.girders || []).indexOf(g)) : null;
    const xf = A && Array.isArray(A.xf) ? A.xf : CFm ? CFm.pts : B && Array.isArray(B.xf) ? B.xf : [];
    o.xf = xf.filter(q => q && isNum(q.x) && isNum(q.P)).map(q => ({ x: q.x, P: q.P })); o.src.xf = A && Array.isArray(A.xf) ? 'girder' : CFm ? 'module' : B && Array.isArray(B.xf) ? 'manual' : 'none';
    if (CFm) o.xfInfo = { line: CFm.line, tot: CFm.tot, n: CFm.pts.length, kind: CFm.X.kind, allow: CFm.X.allow };
    o.steelAllowPct = A && isNum(A.steelAllowPct) ? A.steelAllowPct : M && isNum(mod.allow) ? mod.allow : settings(P).steelAllowPct;
    o.source = A ? (A.source || 'girder loads') : M ? `loads module, cross-section girder G${mod.j + 1}` : B ? 'entered (manual)' : 'none entered';
    return o;
  }
  /* dfOf(project, g, ns, mod): distribution factors per span and pier (precedence in the header).
     { spans: [{ gM, gV, fatM, fatV, gDef }], piers: [{ gM }], src, manual } */
  function dfOf(P, g, ns, mod) {
    const D = g.df && Array.isArray(g.df.spans) && g.df.spans.length >= ns ? g.df : null, Mn = g.dfManual || {};
    const man = k => isNum(Mn[k]) && Mn[k] > 0 ? Mn[k] : 1;
    if (D) {
      const gDef = isNum(D.gDef) ? D.gDef : man('gDef');
      const spans = D.spans.slice(0, ns).map(s => ({ gM: s.gM, gV: s.gV, fatM: s.fatM, fatV: s.fatV, gDef: isNum(s.gDef) ? s.gDef : gDef }));
      const piers = [...Array(Math.max(0, ns - 1))].map((_, k) => { const q = (D.piers || [])[k]; return { gM: q && isNum(q.gM) ? q.gM : spans[k].gM }; });
      return { spans, piers, src: D.source || 'girder factors', manual: false };
    }
    if (mod && mod.R && mod.R.regions) {
      const rg = id => mod.R.regions.find(r => r.id === id), j = mod.j;
      if ([...Array(ns)].every((_, i) => rg('s' + i))) {
        const spans = [...Array(ns)].map((_, i) => { const r = rg('s' + i), m = r.members[j]; return { gM: m.gM, gV: m.gV, fatM: m.fatM, fatV: m.fatV, gDef: r.gDef }; });
        const piers = [...Array(Math.max(0, ns - 1))].map((_, k) => { const r = rg('p' + (k + 1)); return { gM: r ? r.members[j].gM : spans[k].gM }; });
        return { spans, piers, src: `loads module (LLDF), cross-section girder G${j + 1}`, manual: false };
      }
    }
    const sp = { gM: man('gM'), gV: man('gV'), fatM: man('fatM'), fatV: man('fatV'), gDef: man('gDef') };
    return { spans: [...Array(ns)].map(() => ({ ...sp })), piers: [...Array(Math.max(0, ns - 1))].map(() => ({ gM: isNum(Mn.gMpier) && Mn.gMpier > 0 ? Mn.gMpier : sp.gM })),
      src: Object.keys(Mn).some(k => isNum(Mn[k])) ? 'entered (manual)' : 'none entered: 1.0 (per lane)', manual: true };
  }

  /* deflOwner(project, g, settings): the owner's live load deflection rule (OWN19, engine/owners.js 'defl.ll'; GirderDetail SA3 and
     Preliminary sizing A1, mandatory): RIDOT BDM 2.4.2.6 L/800, L/1000 with pedestrians; MassDOT 3.5.6.1 L/1000 with sidewalks, without
     them L/800 and preferably L/1000 (a warning), applied to the typical interior beam only (an exterior cross-section girder is
     reported, not checked). Sidewalk or pedestrians: a sidewalk in the cross-section (xs.sidewalks.L or .R width > 0; GirderDetail:
     its LLDF and DLs sidewalks). The entered L/… (analysis.deflLimit) governs where stricter (rq = max). null for AASHTO and CTDOT
     (no rule: the entered L/…, 2.5.2.6.2 optional criterion). Returns { rule, cite, sw, req, uR, rq, pref, rep, line, ext } */
  function deflOwner(P, g, S) {
    const O = window.SBDOwners, own = P.ownerRules && P.ownerRules.owner, r = O && own ? O.rule(own, 'defl.ll') : null; if (!r) return null;
    const xs = P.xs || (window.SBDModel && window.SBDModel.defaultXs ? window.SBDModel.defaultXs(P) : null), sw = (xs && xs.sidewalks) || {}, on = ['L', 'R'].some(k => sw[k] && +sw[k].w > 0);
    const v = r.value, req = on ? v.ped : v.veh, uR = +S.deflLimit > 0 ? +S.deflLimit : 0, rq = Math.max(req, uR), pref = !on && v.pref ? Math.max(v.pref, rq) : 0;
    const nb = xs ? Math.round(xs.nb) : 0, j = lineOf(P, g), ext = j === 0 || j === nb - 1;
    return { rule: r, cite: O.cite(r), sw: on, req, uR, rq, pref, rep: !!(v.intOnly && ext), line: j, ext };
  }

  /* sbOf(segs, Ikey, crackIv, IcrKey): stiffness intervals [[x0, x1, I]] for staticAnalysis / analyze: each plate segment's
     I (Ikey), with the cracked intervals given I_cr */
  function sbOf(segs, key, crack) {
    const out = [];
    segs.forEach(s => {
      const cuts = [s.x0, s.x1]; (crack || []).forEach(([a, b]) => [a, b].forEach(v => { if (v > s.x0 + 1e-9 && v < s.x1 - 1e-9) cuts.push(v); }));
      cuts.sort((a, b) => a - b);
      for (let i = 0; i < cuts.length - 1; i++) { const a = cuts[i], b = cuts[i + 1], xm = (a + b) / 2, ck = crack && crack.some(([p, q]) => xm >= p && xm <= q);
        out.push([a, b, ck ? s.Icr : s[key]]); }
    });
    return out;
  }
  const segsOf = sb => sb.map(q => ({ len: q[1] - q[0], I: q[2], bad: false }));
  const spanOfX = (sup, x) => { for (let k = 0; k < sup.length - 1; k++) if (x <= sup[k + 1] + 1e-9) return k; return sup.length - 2; };

  /* analyzeGirder(project, gi, opt): the analysis of girder gi. opt.stations overrides the station grid (tests);
     opt.ll = false skips the live loads (dead loads, camber and the pour sequence only); opt.steelPlf (tests only): the steel
     weight in lb/ft per in² (GirderDetail's 3.4 for the parity tests; default STEEL_PLF = 490/144). Returns the result described at
     the end of this function, or { errors }. */
  function analyzeGirder(P, gi, opt) {
    opt = opt || {};
    const S = settings(P), g = P.girders[gi]; if (!g) return { errors: [`No girder ${gi + 1}.`] };
    const spans = P.spans.lengths.map(Number), ns = spans.length, cont = P.spans.continuity !== 'simple' && ns > 1, E = P.materials.Es;
    const errors = [];
    if (!(S.im >= 0) || !(S.imf >= 0)) errors.push('Dynamic load allowance must be zero or positive.');
    if (!(S.deflLimit > 0)) errors.push('The live load deflection limit L/… must be positive.');
    if (!['none', '15', 'dl'].includes(S.crack)) errors.push('Cracked zones must be "none", "15" or "dl".');
    if (errors.length) return { errors };
    const sup = [0]; spans.forEach(L => sup.push(sup[sup.length - 1] + L)); const Lt = sup[ns];
    const G = grid(spans), xs = opt.stations || G.xs, N = xs.length;
    const supIdx = sup.map(v => { let b = 0; xs.forEach((x, i) => { if (Math.abs(x - v) < Math.abs(xs[b] - v)) b = i; }); return b; });

    // section stiffness per plate segment (engine/sections.js; GirderDetail saComp / saCracked / steelProps)
    const m = P.materials, d = P.deck, comp = d.composite !== false;
    const nr = SEC().modularRatio(m.concrete.fc, m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, m.concrete.K1, m.concrete.nRule), n = nr.n;   // OWN17: w_c for E_c
    const mod = g.loads && g.df ? null : moduleOf(P, gi);
    const own = window.SBDOwners && P.ownerRules ? window.SBDOwners.loadFactors(P.ownerRules.owner, P.ownerRules.eta, (P.xs || {}).nb) : null;
    const h0 = typeof S.haunchInStiffness === 'boolean' ? !S.haunchInStiffness : !!(own && own.h0);   // OWN8: haunch 0 in the composite stiffness
    const deckS = { ts: d.ts, haunch: h0 ? 0 : d.haunch, beff: g.beff, rebar: d.rebar };
    const segs = g.segments.map(s => { const p = { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }, st = SEC().steelCore(p);
      const c3 = comp ? SEC().composite(p, deckS, n, 3) : null, cn = comp ? SEC().composite(p, deckS, n, 1) : null, cr = SEC().withRebar(p, deckS);
      return { x0: s.x0, x1: s.x1, p, As: st.A, Is: st.I, I3u: c3 ? c3.I : st.I, Inu: cn ? cn.I : st.I, Icr: comp ? cr.I : st.I, c3, cn }; });

    const LD = loadsOf(P, g, mod), DF = dfOf(P, g, ns, mod), warnings = [];
    if (mod && mod.errors) warnings.push(`Loads module: ${mod.errors[0]} The entered loads and factors are used.`);
    if (LD.source === 'none entered') warnings.push('No dead loads for this girder: DC1 wet deck, DC2, DW and construction LL are 0 unless entered under Analysis settings. Only the girder steel is computed here.');
    if (DF.manual) warnings.push(`Live load distribution factors: ${DF.src}. LL+IM is per girder only with this girder's factors.`);
    if (LD.src.CL === 'none') warnings.push('Construction live load not entered (Analysis settings): M_CL is 0.');
    const allow = LD.steelAllowPct, plf = isNum(opt.steelPlf) ? opt.steelPlf : STEEL_PLF, wSteel = segs.map(s => s.As * plf / 1000 * (1 + allow / 100));
    const distSteel = segs.map((s, i) => [s.x0, s.x1, wSteel[i]]);
    const xfP = LD.xf.map(q => [q.x, q.P]);
    const SA = (sb, loads, stations) => ML().staticAnalysis({ spans, E, sb, simple: !cont, loads, stations: stations || xs });

    // cracked zones (feStages): grid elements, continuous girders only
    const sbS = sbOf(segs, 'Is');
    let crack = [];
    if (cont && comp && S.crack !== 'none') {
      const ck = new Uint8Array(N - 1);
      if (S.crack === 'dl') {
        const a = SA(sbS, { dist: [...distSteel, [0, Lt, LD.DC1wet]], P: xfP }), b = SA(sbOf(segs, 'I3u'), { w: LD.DC2 + LD.DW });
        const Mt = a.M.map((v, i) => v + b.M[i]); for (let e = 0; e < N - 1; e++) ck[e] = Mt[e] < 0 && Mt[e + 1] < 0 ? 1 : 0;
      } else for (let k = 1; k < ns; k++) { const xp = xs[supIdx[k]], a = 0.15 * spans[k - 1], c = 0.15 * spans[k];
        for (let e = 0; e < N - 1; e++) { const xm = (xs[e] + xs[e + 1]) / 2; if (xm >= xp - a - 1e-9 && xm <= xp + c + 1e-9) ck[e] = 1; } }
      for (let e = 0; e < N - 1; e++) if (ck[e]) { const l = crack[crack.length - 1]; if (l && Math.abs(l[1] - xs[e]) < 1e-9) l[1] = xs[e + 1]; else crack.push([xs[e], xs[e + 1]]); }
    }
    const sb3 = sbOf(segs, 'I3u', crack), sbN = sbOf(segs, 'Inu', crack);

    // dead-load stages (staticAnalysis, loads applied exactly)
    const st = {};
    st.DC1steel = SA(sbS, { dist: distSteel, P: xfP });
    st.DC1wet = SA(sbS, { w: LD.DC1wet });
    st.DC2 = SA(sb3, { w: LD.DC2 });
    st.DW = SA(sb3, { w: LD.DW });
    st.CL = SA(sbS, { w: LD.CL });
    if (LD.UT) st.UT = SA(sbS, { w: LD.UT });
    if (LD.UF) st.UF = SA(sbS, { w: LD.UF });
    const sumSt = (a, b) => ({ x: a.x, M: a.M.map((v, i) => v + b.M[i]), VL: a.VL.map((v, i) => v + b.VL[i]), VR: a.VR.map((v, i) => v + b.VR[i]), defl: a.defl.map((v, i) => v + b.defl[i]), R: a.R.map((v, i) => v + b.R[i]) });
    st.DC1 = sumSt(st.DC1steel, st.DC1wet);
    const UTM = st.UT ? st.UT.M : null;
    const Mperm = st.DC1.M.map((v, i) => v + st.DC2.M[i] + st.DW.M[i] + (UTM ? UTM[i] : 0));
    // pier region (GM.sa.compute 'region'): contiguous negative permanent-load moment around each interior support
    const region = new Int16Array(N).fill(-1);
    for (let k = 1; k < ns && cont; k++) { let l = supIdx[k], r = supIdx[k]; while (l > 0 && Mperm[l - 1] < 0) l--; while (r < N - 1 && Mperm[r + 1] < 0) r++; for (let i = l; i <= r; i++) region[i] = k; }

    // camber (dead-load deflection per stage): steel + cross-frames, wet deck (both on I_s), DC2 + DW (I_3n, cracked zones), existing utilities
    const camberStages = [{ spans, E, sb: sbS, simple: !cont, loads: { dist: distSteel, P: xfP } }, { spans, E, sb: sbS, simple: !cont, loads: { w: LD.DC1wet } },
      { spans, E, sb: sb3, simple: !cont, loads: { w: LD.DC2 + LD.DW } }];
    if (LD.UT) camberStages.push({ spans, E, sb: sbS, simple: !cont, loads: { w: LD.UT } });
    const cam = ML().camber(camberStages, { stations: xs });
    const camber = { x: cam.x, steel: cam.stages[0], wet: cam.stages[1], sd: cam.stages[2], ut: LD.UT ? cam.stages[3] : null, total: cam.total };

    // live load (HL-93 and the fatigue truck, per lane, IM included, DF = 1 inside the engine; the factors are applied below)
    let ll = null, fat = null, lld = null, llR = null, ped = null;
    if (opt.ll !== false) {
      // mesh keys: the stations, plus the midpoint of each station interval that ends at a support, so that the section just right of
      // the station before a support has its own element (GirderDetail VLLr); negX: the pier regions also take the 90 % two-truck case for
      // negative moment (GirderDetail LL5: tw2 = the negative permanent-load region united with the negative influence-line region)
      const preSup = []; for (let i = 0; i < N - 1; i++) if (supIdx.includes(i + 1)) preSup.push((xs[i] + xs[i + 1]) / 2);
      const negX = []; for (let k = 1; k < ns && cont; k++) { const idx = []; region.forEach((r, i) => { if (r === k) idx.push(i); }); if (idx.length) negX.push([xs[idx[0]], xs[idx[idx.length - 1]]]); }
      const segsN = segsOf(sbN), Vt = VEH().build(), pre = Vt.presets, H = pre['HL93-Truck'], F = Vt.fatigue;
      const base = { spans, E, segs: segsN, stdLane: null, dirs: [1, -1], llf: 1, dfM: spans.map(() => 1), dfV: spans.map(() => 1), dfNeg: 0, step: 1, hStep: 2, simple: !cont,
        scanKeys: [...xs, ...preSup], scanM: [...xs], scanV: true, negX };
      const mH = { ...base, axles: H.axles.map(a => [...a]), short: 'HL93-Truck', udl: { ...H.udl }, vK: H.vary.k, vMin: H.vary.min, vMax: H.vary.max, neglect: H.neglect,
        secondary: H.secondary, multi: H.multi.on, mScale: H.multi.scale, mHmin: H.multi.hmin, mFixed: H.multi.fixed, imp: { method: 'const', val: 1 + S.im / 100, S: 6.5, bal: false, onUdl: false } };
      const mF = { ...base, axles: F.axles.map(a => [...a]), short: 'Fatigue', udl: { ...F.udl }, vK: 0, vMin: 0, vMax: 0, neglect: F.neglect, secondary: '', multi: false, mScale: 1, mHmin: 50, mFixed: 0,
        imp: { method: 'const', val: 1 + S.imf / 100, S: 6.5, bal: false, onUdl: false } };
      const RH = ML().analyze(mH, { vehicles: pre }), RF = ML().analyze(mF, { vehicles: pre });
      const pick = (R, get) => {   // envelope at the stations: M at the node, V just right of the node, V just left at the supports and the end; get(ei): { max, min } (default R.res)
        const node = x => { let lo = 0, hi = R.x.length - 1; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (R.x[md] <= x) lo = md; else hi = md; } return Math.abs(R.x[lo] - x) <= Math.abs(R.x[hi] - x) ? lo : hi; };
        const mOf = {}, vR = {}, vL = {}; R.effs.forEach((ef, ei) => { if (ef.t === 'M') { if (mOf[ef.node] === undefined) mOf[ef.node] = ei; } else if (ef.t === 'V') { if (ef.cutL) { if (vR[ef.el] === undefined) vR[ef.el] = ei; } else if (vL[ef.el + 1] === undefined) vL[ef.el + 1] = ei; } });
        const res = get || (ei => R.res[ei]), o = { Mmax: [], Mmin: [], VRmax: [], VRmin: [], VLmax: [], VLmin: [], twoM: [] };
        xs.forEach((x, i) => { const j = node(x), em = mOf[j], er = vR[j], el = vL[j];
          const rm = em !== undefined ? res(em) : { max: 0, min: 0 }; o.Mmax.push(rm.max); o.Mmin.push(rm.min); o.twoM.push(em !== undefined && !!R.effs[em].neg);
          const rr = er !== undefined ? res(er) : null, rl = el !== undefined ? res(el) : null;
          o.VRmax.push(rr ? rr.max : 0); o.VRmin.push(rr ? rr.min : 0); o.VLmax.push(rl ? rl.max : rr ? rr.max : 0); o.VLmin.push(rl ? rl.min : rr ? rr.min : 0); });
        o.R = R.effs.map((ef, ei) => { if (ef.t !== 'R') return null; const q = res(ei); return { q: ef.q, max: q.max, min: q.min, two: !!(q.maxG && /×2/.test(q.maxG.lab)) }; }).filter(Boolean).sort((a, b) => a.q - b.q);
        return o; };
      const h = pick(RH), f = pick(RF);
      const gMat = i => region[i] >= 1 ? DF.piers[region[i] - 1].gM : DF.spans[spanOfX(sup, xs[i])].gM;
      const spR = i => spanOfX(sup, i < N - 1 ? (xs[i] + xs[i + 1]) / 2 : xs[i] - 1e-6), spL = i => spanOfX(sup, i > 0 ? (xs[i - 1] + xs[i]) / 2 : xs[i]);
      ll = { perLane: h, gM: xs.map((_, i) => gMat(i)), gVR: xs.map((_, i) => DF.spans[spR(i)].gV), gVL: xs.map((_, i) => DF.spans[spL(i)].gV) };
      ll.Mpos = h.Mmax.map((v, i) => ll.gM[i] * v); ll.Mneg = h.Mmin.map((v, i) => ll.gM[i] * v);
      ll.VRpos = h.VRmax.map((v, i) => ll.gVR[i] * v); ll.VRneg = h.VRmin.map((v, i) => ll.gVR[i] * v);
      ll.VLpos = h.VLmax.map((v, i) => ll.gVL[i] * v); ll.VLneg = h.VLmin.map((v, i) => ll.gVL[i] * v);
      fat = { perLane: f, gM: xs.map((x) => DF.spans[spanOfX(sup, x)].fatM), gVR: xs.map((_, i) => DF.spans[spR(i)].fatV), gVL: xs.map((_, i) => DF.spans[spL(i)].fatV) };
      fat.Mpos = f.Mmax.map((v, i) => fat.gM[i] * v); fat.Mneg = f.Mmin.map((v, i) => fat.gM[i] * v);
      fat.VRpos = f.VRmax.map((v, i) => fat.gVR[i] * v); fat.VRneg = f.VRmin.map((v, i) => fat.gVR[i] * v);
      fat.VLpos = f.VLmax.map((v, i) => fat.gVL[i] * v); fat.VLneg = f.VLmin.map((v, i) => fat.gVL[i] * v);
      llR = h.R.map((r, k) => { const adj = [k - 1, k].filter(i => i >= 0 && i < ns), gV = Math.max(...adj.map(i => DF.spans[i].gV)); return { k, gV, max: gV * r.max, min: gV * r.min, perLane: r, two: r.two }; });
      // pedestrian load (AASHTO LRFD 3.6.1.6; GirderDetail GM.sa.compute plRow and vSec, GD45/GD49; added 2026-10-30, sb-ped-owner PR): w_PL of
      // this girder (the loads module's share: already per girder, so no g, no IM and no multiple presence) on the parts of each influence line
      // (live-load stiffness, the same mesh as HL-93) of one sign: max = w_PL × (positive area), min = w_PL × (negative area). Reactions likewise.
      // Kept apart from R.ll (HL-93 only, which the LL deflection and the factors use); every module takes LL+IM + PL once (llPL below).
      if (LD.PL > 0) {
        const memo = new Map(), area = ei => { if (memo.has(ei)) return memo.get(ei); let lp = 0, ln = 0; const xr = RH.x;
          for (let j = 0; j < xr.length - 1; j++) { const hh = xr[j + 1] - xr[j], [a, b] = RH.ends(ei, j);
            if (a >= 0 && b >= 0) lp += (a + b) / 2 * hh; else if (a <= 0 && b <= 0) ln += (a + b) / 2 * hh;
            else { const t = a / (a - b), A1 = a * t * hh / 2, A2 = b * (1 - t) * hh / 2; if (a > 0) { lp += A1; ln += A2; } else { ln += A1; lp += A2; } } }
          const v = { max: LD.PL * lp, min: LD.PL * ln, ap: lp, an: ln }; memo.set(ei, v); return v; };
        const q = pick(RH, area);
        ped = { w: LD.PL, Mpos: q.Mmax, Mneg: q.Mmin, VRpos: q.VRmax, VRneg: q.VRmin, VLpos: q.VLmax, VLneg: q.VLmin, R: q.R.map((r, k) => ({ k, max: r.max, min: r.min })) };
      }
      // LL deflection (SA3): shared deflection() at the 1/20 points, truck with IM or 25 % of it + lane, per lane; × g_Δ of the span.
      // Truck axles that do not add to the deflection sought are neglected (3.6.1.3.1; GirderDetail LL8; SB2-A4, 2026-10-29: neglect).
      // The limit: the owner rule (OWN19, deflOwner) or the entered L/… (2.5.2.6.2, optional criterion).
      const DL = ML().deflection(RH, { mode: 'lrfd', DF: 1, useIM: true, neglect: true }), OW = deflOwner(P, g, S), rq = OW ? OW.rq : S.deflLimit;
      lld = spans.map((L, k) => { let best = null;
        DL.secs.forEach((s, si) => { if (s.k !== k) return; const v = -DL.res[si].dn; if (!best || v > best.raw) best = { x: s.x, raw: v, lab: DL.res[si].dnG ? DL.res[si].dnG.lab : '' }; });
        const gD = DF.spans[k].gDef, dd = best ? best.raw * gD : 0, lim = L * 12 / rq, limP = OW && OW.pref ? L * 12 / OW.pref : 0, ok = dd <= lim + 1e-9;
        const status = OW && OW.rep ? 'na' : !ok ? 'fail' : limP && dd > limP + 1e-9 ? 'warn' : 'pass';
        return { k, L, x: best ? best.x : null, perLane: best ? best.raw : 0, case: best ? best.lab : '', gD, d: dd, lim, ratio: rq, pref: OW ? OW.pref : 0, limP, ok, status, own: OW }; });
    }

    // deck placement sequence (saSeq): continuous girders, composite deck
    let seq = null;
    if (cont && comp && S.seq !== 'off') {
      const MD = st.DC1.M; let pours = [];
      const cust = String(S.seqCustom || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => s.split('-').map(Number)).filter(q => q.length === 2 && q.every(isFinite) && q[1] > q[0]);
      if (cust.length) pours = cust.map(([a, b]) => ({ a: Math.max(0, a), b: Math.min(Lt, b) }));
      else { const reg = []; let s = 0; for (let i = 1; i < N; i++) if (Math.sign(MD[i] || 1e-9) !== Math.sign(MD[i - 1] || 1e-9) || i === N - 1) { reg.push({ a: xs[s], b: xs[i], pos: MD[Math.floor((s + i) / 2)] >= 0 }); s = i; }
        pours = [...reg.filter(r => r.pos), ...reg.filter(r => !r.pos)].map(r => ({ a: r.a, b: r.b })); }
      const k3 = S.seqMod === '3n', nrS = k3 ? 3 * n : n, key = k3 ? 'I3u' : 'Inu';
      const inP = (x, q) => x >= q.a - 1e-6 && x <= q.b + 1e-6;
      const segAt = x => segs.find(s => x >= s.x0 - 1e-9 && x <= s.x1 + 1e-9 && (x < s.x1 - 1e-9 || s === segs[segs.length - 1])) || segs[segs.length - 1];
      const secs = xs.map(x => { const s = segAt(x + 1e-6), c = SEC().composite(s.p, deckS, nrS, 1); return { yb: c.yb, I: c.I, yd: c.d + deckS.haunch + deckS.ts }; });
      const done = [], cum = new Float64Array(N), envP = new Float64Array(N).fill(-Infinity), envN = new Float64Array(N).fill(Infinity), fdk = new Float64Array(N), compN = new Uint8Array(N), stages = [];
      const M0 = st.DC1steel.M; M0.forEach((v, i) => { cum[i] = v; envP[i] = Math.max(envP[i], v); envN[i] = Math.min(envN[i], v); }); stages.push({ name: 'Steel and other noncomposite load', M: Array.from(M0) });
      pours.forEach((q, k) => {
        const sbq = sbOf(segs, 'Is').flatMap(([a, b, I]) => { const cuts = [a, b]; done.forEach(([p, r]) => [p, r].forEach(v => { if (v > a + 1e-9 && v < b - 1e-9) cuts.push(v); })); cuts.sort((u, v) => u - v);
          return cuts.slice(0, -1).map((u, i) => { const xm = (u + cuts[i + 1]) / 2, seg = segAt(xm); return [u, cuts[i + 1], done.some(([p, r]) => xm >= p && xm <= r) ? seg[key] : I]; }); });
        const M = SA(sbq, { dist: [[q.a, q.b, LD.DC1wet]] }).M;
        for (let i = 0; i < N; i++) { cum[i] += M[i]; if (compN[i]) { const c = secs[i]; fdk[i] += -M[i] * 12 * (c.yd - c.yb) / c.I / nrS; } else { envP[i] = Math.max(envP[i], cum[i]); envN[i] = Math.min(envN[i], cum[i]); } }
        xs.forEach((x, i) => { if (inP(x, q)) compN[i] = 1; }); done.push([q.a, q.b]); stages.push({ name: `Pour ${k + 1} (${n1(q.a)} to ${n1(q.b)} ft)`, M, q }); });
      const eP = Array.from(envP).map(v => Math.max(v, 0)), eN = Array.from(envN).map(v => Math.min(v, 0));
      const fr = 0.24 * Math.sqrt(m.concrete.fc), phifr = 0.9 * fr;
      seq = { pours, stages, cum: Array.from(cum), envP: eP, envN: eN, fdk: Array.from(fdk), nr: nrS, fr, phifr,
        MDCc: Array.from(MD).map((v, i) => v >= 0 ? Math.max(v, eP[i]) : Math.min(v, eN[i])) };
    }

    const R = { errors: [], warnings, settings: S, fc: m.concrete.fc, h0, line: mod && mod.j != null ? mod.j : null, girder: g, gi, spans, sup, supIdx, cont, Lt, x: xs, n, nr, segs, plf, wSteel, loads: LD, df: DF, crack, sb: { s: sbS, c3: sb3, cn: sbN }, region,
      st, camber, ll, fat, llR, lld, seq, pl: ped };
    R.steps = steps(R);
    return R;
  }

  /* steps(R): the worked steps of the key values (shared/steps.js format). Each FE value is the stiffness-method result of the
     shared engine; its work is the load, the stiffness used and the statics check, and for LL the per-lane envelope × g. */
  function steps(R) {
    const w = St().work('an'), S = R.settings, L = R.loads, kip = 'kip', kft = 'kip-ft';
    w.add({ id: 'n', label: 'Modular ratio (for the composite stiffness)', sym: 'n', eq: '\\frac{E_{s}}{E_{c}}', sub: '', value: R.n, unit: '', d: 3, ref: `${ED} Art. 6.10.1.1.1b`, note: 'Worked in Section properties (n).' });
    R.segs.forEach((s, i) => {
      w.add({ id: `wst${i}`, label: `Girder steel weight, segment ${i + 1} (${n1(s.x0)}–${n1(s.x1)} ft)`, sym: 'w_{s}', eq: 'A_{s}(\\frac{490}{144}\\,\\text{lb/ft/in}^{2})(1 + a)/1000', sub: `${n2(s.As)}(${St().n(R.plf, 4)})(1 + ${n2(L.steelAllowPct / 100)})/1000`, value: R.wSteel[i], unit: 'klf', d: 4,
        ref: `${ED} Table 3.5.1-1 (steel 0.490 kcf)`, note: 'a = detail allowance for stiffeners, connection plates and splices. Steel 490 pcf: 490/144 = 3.4028 lb/ft per in² of plate (GirderDetail rounds it to 3.4).' });
      w.add({ id: `I${i}`, label: `Stiffness, segment ${i + 1}: I_s / I_3n / I_n / I_cr`, sym: 'I', eq: 'I_{s},\\ I_{3n},\\ I_{n},\\ I_{cr}', sub: `${g0(s.Is)},\\ ${g0(s.I3u)},\\ ${g0(s.Inu)},\\ ${g0(s.Icr)}`, value: s.Inu, unit: 'in^{4}', d: 0,
        ref: `${ED} Art. 6.10.1.1.1, 6.10.1.5`, note: 'DC1 on I_s, DC2 and DW on I_3n, LL on I_n; I_cr (steel + longitudinal reinforcement) replaces I_3n and I_n in the cracked zones. Worked in Section properties.' });
    });
    if (R.crack.length) w.add({ id: 'crack', label: 'Cracked zones (I_cr for DC2, DW and LL)', sym: '\\text{zones}', eq: '', sub: R.crack.map(([a, b]) => `${n1(a)}\\text{–}${n1(b)}`).join(',\\ ') + '\\ \\text{ft}', value: R.crack.length, unit: '', d: 0, ref: `${ED} Art. 6.10.1.5`,
      note: S.crack === '15' ? '15 % of each adjacent span either side of each interior support.' : 'Where the moment of DC1 (I_s) + DC2 + DW (uncracked I_3n) is negative.' });
    // statics check per stage (SA2)
    const tot = (stg, wl, pts) => { const sR = R.st[stg].R.reduce((a, b) => a + b, 0); return sR; };
    const wsTot = R.segs.reduce((a, s, i) => a + R.wSteel[i] * (s.x1 - s.x0), 0), xfTot = L.xf.reduce((a, q) => a + q.P, 0);
    w.add({ id: 'eq.DC1steel', label: 'Equilibrium, DC1 girder steel and cross-frames: ΣR = Σw_s ℓ + ΣP', sym: '\\sum R', eq: '\\sum w_{s}\\ell + \\sum P_{xf}', sub: `${n2(wsTot)} + ${n2(xfTot)}`, value: tot('DC1steel'), unit: kip, d: 2, ref: 'Statics', ok: Math.abs(tot('DC1steel') - wsTot - xfTot) <= 1e-6 * Math.max(1, wsTot + xfTot) });
    [['DC1wet', 'DC1 wet deck (deck, haunch, SIP, other DC1)', 'w_{DC1}'], ['DC2', 'DC2', 'w_{DC2}'], ['DW', 'DW', 'w_{DW}'], ['CL', 'construction live load', 'w_{CL}']].forEach(([k, t, sy]) => {
      const a = L[k] * R.Lt; w.add({ id: 'eq.' + k, label: `Equilibrium, ${t}: ΣR = wL`, sym: '\\sum R', eq: `${sy}L`, sub: `${St().n(L[k], 4)}(${n2(R.Lt)})`, value: tot(k), unit: kip, d: 2, ref: 'Statics', ok: Math.abs(tot(k) - a) <= 1e-6 * Math.max(1, a),
        note: `w = ${St().n(L[k], 4)} klf (${{ girder: 'girder loads', module: 'loads module', manual: 'entered', none: 'none entered' }[L.src[k]]}).` }); });
    // key moments per span and pier
    const x = R.x, at = (arr, i) => arr[i];
    for (let k = 0; k < R.spans.length; k++) {
      const a = R.supIdx[k], b = R.supIdx[k + 1]; let im = a; for (let i = a; i <= b; i++) if (R.st.DC1.M[i] > R.st.DC1.M[im]) im = i;
      w.add({ id: `M.DC1.s${k + 1}`, label: `Largest DC1 moment, span ${k + 1}, at x = ${n2(x[im])} ft`, sym: 'M_{DC1}', eq: 'M_{steel} + M_{wet}', sub: `${n1(R.st.DC1steel.M[im])} + ${n1(R.st.DC1wet.M[im])}`, value: R.st.DC1.M[im], unit: kft, d: 1, ref: `${ED} Art. 4.5.2.2, 4.6.2`, note: 'Stiffness method on I_s (shared beam engine).' });
      if (R.ll) { let ip = a; for (let i = a; i <= b; i++) if (R.ll.Mpos[i] > R.ll.Mpos[ip]) ip = i;
        w.add({ id: `M.LL.s${k + 1}`, label: `Largest LL+IM moment, span ${k + 1}, at x = ${n2(x[ip])} ft`, sym: 'M_{LL+IM}', eq: 'g_{M}\\,M_{HL93}', sub: `${n3(R.ll.gM[ip])}(${n1(R.ll.perLane.Mmax[ip])})`, value: R.ll.Mpos[ip], unit: kft, d: 1,
          ref: `${ED} Art. 3.6.1.3.1, 3.6.2.1, 4.6.2.2`, note: `Per lane: design truck (rear spacing 14–30 ft) or tandem, with IM ${S.im} %, + lane 0.64 klf without IM.` }); }
      if (R.pl) { let ip = a; for (let i = a; i <= b; i++) if (R.pl.Mpos[i] > R.pl.Mpos[ip]) ip = i;
        w.add({ id: `M.PL.s${k + 1}`, label: `Largest pedestrian load moment, span ${k + 1}, at x = ${n2(x[ip])} ft`, sym: 'M_{PL}', eq: 'w_{PL}\\,A^{+}', sub: `${St().n(R.pl.w, 4)}(${n1(R.pl.Mpos[ip] / R.pl.w)})`, value: R.pl.Mpos[ip], unit: kft, d: 1,
          ref: `${ED} Art. 3.6.1.6`, note: 'A⁺: the positive area of the moment influence line (ft²; live-load stiffness). w_PL is this girder\'s share of the sidewalk load (Loads & LLDF): no distribution factor, no IM. Added to LL+IM once in every module (Strength I, Service I and II; not fatigue, deck placement or the LL deflection).' }); }
    }
    for (let k = 1; k < R.spans.length; k++) { const i = R.supIdx[k];
      w.add({ id: `M.perm.p${k}`, label: `Permanent-load moments at pier ${k} (x = ${n2(x[i])} ft)`, sym: 'M_{DC1} + M_{DC2} + M_{DW}', eq: '', sub: `${n1(R.st.DC1.M[i])} + ${n1(R.st.DC2.M[i])} + ${n1(R.st.DW.M[i])}`, value: R.st.DC1.M[i] + R.st.DC2.M[i] + R.st.DW.M[i], unit: kft, d: 1, ref: `${ED} Art. 4.6.2` });
      if (R.ll) w.add({ id: `M.LL.p${k}`, label: `Negative LL+IM moment at pier ${k}`, sym: 'M_{LL+IM}^{-}', eq: 'g_{M}\\,M_{HL93}^{-}', sub: `${n3(R.ll.gM[i])}(${n1(R.ll.perLane.Mmin[i])})`, value: R.ll.Mneg[i], unit: kft, d: 1,
        ref: `${ED} Art. 3.6.1.3.1, 4.6.2.2`, note: R.ll.perLane.twoM[i] ? 'Includes 90 % of two design trucks (headway ≥ 50 ft) + 90 % of the lane load (negative-moment influence line).' : '' });
      if (R.pl) w.add({ id: `M.PL.p${k}`, label: `Negative pedestrian load moment at pier ${k}`, sym: 'M_{PL}^{-}', eq: 'w_{PL}\\,A^{-}', sub: `${St().n(R.pl.w, 4)}(${n1(R.pl.Mneg[i] / R.pl.w)})`, value: R.pl.Mneg[i], unit: kft, d: 1,
        ref: `${ED} Art. 3.6.1.6`, note: 'A⁻: the negative area of the moment influence line (ft²; live-load stiffness): the sidewalk loaded where it adds to the negative moment.' });
      if (R.pl && R.ll) w.add({ id: `M.LLPL.p${k}`, label: `Negative LL+IM + PL moment at pier ${k} (used by the modules)`, sym: 'M_{LL+IM+PL}^{-}', eq: 'M_{LL+IM}^{-} + M_{PL}^{-}', sub: `${n1(R.ll.Mneg[i])} + (${n1(R.pl.Mneg[i])})`, value: R.ll.Mneg[i] + R.pl.Mneg[i], unit: kft, d: 1,
        ref: `${ED} Art. 3.6.1.6, Table 3.4.1-1`, note: 'The pedestrian load acts with the vehicular live load (3.6.1.6) and takes its load factor; the owner multiplier m is not applied to it (GirderDetail GD45).' }); }
    if (R.llR) R.llR.forEach(r => w.add({ id: `R.LL.${r.k}`, label: `LL+IM reaction, support ${r.k + 1}`, sym: 'R_{LL+IM}', eq: 'g_{V}\\,R_{HL93}', sub: `${n3(r.gV)}(${n2(r.perLane.max)})`, value: r.max, unit: kip, d: 2,
      ref: `${ED} Art. 3.6.1.3.1, 4.6.2.2.3a`, note: (r.two ? '90 % of two trucks + lane governs (interior support). ' : '') + 'g_V = the larger of the adjacent spans.' }));
    if (R.pl) R.pl.R.forEach(r => w.add({ id: `R.PL.${r.k}`, label: `Pedestrian load reaction, support ${r.k + 1}`, sym: 'R_{PL}', eq: 'w_{PL}\\,A^{+}', sub: `${St().n(R.pl.w, 4)}(${n2(r.max / R.pl.w)})`, value: r.max, unit: kip, d: 2,
      ref: `${ED} Art. 3.6.1.6`, note: 'A⁺: the positive area of the reaction influence line (ft). Added to R_LL+IM in the bearing checks.' }));
    if (R.lld) R.lld.forEach(q => { const O = q.own;
      w.add({ id: `defl.lim${q.k + 1}`, label: `LL deflection limit, span ${q.k + 1}${O ? ` (${O.cite}, mandatory)` : ''}`, sym: '\\Delta_{lim}', eq: `\\frac{12L}{${q.ratio}}`, sub: `\\frac{12(${n2(q.L)})}{${q.ratio}}`, value: q.lim, unit: 'in', d: 3,
        ref: O ? `${O.cite}; ${ED} Art. 2.5.2.6.2` : `${ED} Art. 2.5.2.6.2`, note: O ? `${O.cite}: ${O.rule.text}. Sidewalk or pedestrians: ${O.sw ? 'yes' : 'no'} (cross-section sidewalks), so L/${O.req}${O.uR > O.req ? `; the entered L/${O.uR} is stricter and is used` : ''}.${O.rep ? ` Applied to the typical interior beam only: this plate girder takes cross-section girder G${O.line + 1} (exterior), so it is reported, not checked.` : ''}` : 'Optional criterion (2.5.2.6.2): the L/… entered under Analysis settings.' });
      if (q.limP) w.add({ id: `defl.pref${q.k + 1}`, label: `LL deflection, preferred limit, span ${q.k + 1} (${O.cite})`, sym: '\\Delta_{pref}', eq: `\\frac{12L}{${q.pref}}`, sub: `\\frac{12(${n2(q.L)})}{${q.pref}}`, value: q.limP, unit: 'in', d: 3,
        ref: `${O.cite}`, ok: q.status !== 'warn', note: q.status === 'warn' ? 'Exceeded: a warning (preferably L/' + q.pref + ').' : '' });
      w.add({ id: `defl.LL${q.k + 1}`, label: `LL deflection, span ${q.k + 1}, at x = ${n2(q.x)} ft`, sym: '\\Delta_{LL}', eq: 'g_{\\Delta}\\max(\\Delta_{truck}(1 + IM),\\ 0.25\\Delta_{truck}(1 + IM) + \\Delta_{lane})', sub: `${n3(q.gD)}(${n3(q.perLane)})`, value: q.d, unit: 'in', d: 3,
        ref: `${ED} Art. 2.5.2.6.2, 3.6.1.3.2`, ok: q.status === 'na' ? undefined : q.ok, note: `${q.ok ? '≤' : '>'} Δ_lim = ${n3(q.lim)} in${q.status === 'na' ? ' (reported, not checked: exterior girder under the owner rule)' : ''}. Governing per-lane case: ${q.case || '—'}. All lanes loaded, all girders deflecting equally (g_Δ). Truck axles that do not add to the deflection are neglected (3.6.1.3.1).` }); });
    for (let k = 0; k < R.spans.length; k++) { const a = R.supIdx[k], b = R.supIdx[k + 1]; let i = a; for (let j = a; j <= b; j++) if (R.camber.total[j] > R.camber.total[i]) i = j; const c = R.camber;
      w.add({ id: `camber.s${k + 1}`, label: `Dead-load deflection (camber), span ${k + 1}, at x = ${n2(x[i])} ft`, sym: '\\Delta_{DL}', eq: '\\Delta_{steel} + \\Delta_{wet} + \\Delta_{DC2+DW}' + (c.ut ? ' + \\Delta_{UT}' : ''),
        sub: `${n3(c.steel[i])} + ${n3(c.wet[i])} + ${n3(c.sd[i])}` + (c.ut ? ` + ${n3(c.ut[i])}` : ''), value: c.total[i], unit: 'in', d: 3, ref: `${ED} Art. 6.7.2`, note: 'Steel and wet deck on I_s, DC2 + DW on I_3n (cracked zones as used). Downward positive.' }); }
    if (R.seq) { const Q = R.seq; let i = 0; Q.MDCc.forEach((v, j) => { if (v > Q.MDCc[i]) i = j; }); let i1 = 0; R.st.DC1.M.forEach((v, j) => { if (v > R.st.DC1.M[i1]) i1 = j; });
      w.add({ id: 'seq.MDCc', label: `Largest noncomposite moment, deck placement sequence (${Q.pours.length} pours), at x = ${n2(x[i])} ft`, sym: 'M_{DCc}', eq: '\\max(M_{DC1},\\ M_{seq})', sub: `\\max(${n1(R.st.DC1.M[i])},\\ ${n1(Q.envP[i])})`, value: Q.MDCc[i], unit: kft, d: 1,
        ref: `${ED} Art. 6.10.3.4.1`, note: `Pours: ${Q.pours.map((q, k) => `${k + 1}: ${n1(q.a)}–${n1(q.b)} ft`).join('; ')}. Hardened pours act with ${S.seqMod}. Largest M_DC1 (deck at once) ${n1(R.st.DC1.M[i1])} kip-ft.` });
      const fd = Math.max(...Q.fdk);
      w.add({ id: 'seq.fr', label: 'Deck tension limit φf_r', sym: '\\phi f_{r}', eq: '0.9(0.24\\sqrt{f\\prime_{c}})', sub: `0.9(0.24\\sqrt{${n2(R.fc)}})`, value: Q.phifr, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.1.7, 5.4.2.6` });
      w.add({ id: 'seq.fdk', label: 'Largest deck tension in hardened pours', sym: 'f_{deck}', eq: '\\max\\frac{-M y_{d}}{I n}', sub: '', value: fd, unit: 'ksi', d: 3, ref: `${ED} Art. 6.10.1.7`, ok: fd <= Q.phifr,
        note: fd <= Q.phifr ? 'Below φf_r.' : 'Above φf_r: longitudinal reinforcement of at least 1 % of the deck area is required (6.10.1.7).' }); }
    return w.steps;
  }

  /* ready(project, gi): is the project complete enough for this app's analysis of girder gi to be the output tabs' default demand
     source (added 2026-10-30, report wiring PR)? Complete: the girder exists with plates, every span length is positive, the analysis
     settings are valid (as analyzeGirder checks them), and the girder has dead loads and live-load distribution factors (explicit,
     from the loads module or entered: not the "none entered" fallback of loadsOf / dfOf). Cheap (no beam analysis; the loads module,
     a few ms); the last answer is kept per project state. Returns { ok, why: [reasons it is not complete] }. Nothing is calculated
     for the results here. */
  let readyMemo = { k: null, v: null };
  function ready(P, gi) {
    let k; try { k = JSON.stringify([P, gi]); } catch (e) { k = null; }
    if (k && readyMemo.k === k) return readyMemo.v;
    const why = [], g = P && P.girders ? P.girders[gi] : null;
    if (!g) why.push(`No girder ${gi + 1}.`);
    else if (!Array.isArray(g.segments) || !g.segments.length) why.push('The girder has no plates.');
    const L = P && P.spans && Array.isArray(P.spans.lengths) ? P.spans.lengths.map(Number) : [];
    if (!L.length || !L.every(v => v > 0)) why.push('Span lengths are missing or not positive.');
    if (!why.length) {
      const S = settings(P);
      if (!(S.im >= 0) || !(S.imf >= 0) || !(S.deflLimit > 0) || !['none', '15', 'dl'].includes(S.crack)) why.push('The analysis settings are not valid (Analysis tab).');
      const mod = g.loads && g.df ? null : moduleOf(P, gi), LD = loadsOf(P, g, mod), DF = dfOf(P, g, L.length, mod);
      if (LD.source === 'none entered') why.push('No dead loads for this girder (Loads & LLDF, or Analysis settings).');
      if (DF.manual && /^none entered/.test(DF.src)) why.push('No live-load distribution factors for this girder (Loads & LLDF, or Analysis settings).');
    }
    const v = { ok: !why.length, why };
    if (k) readyMemo = { k, v };
    return v;
  }

  /* llPL(R): LL+IM + PL per girder at the stations, the pedestrian load counted once (added 2026-10-30, sb-ped-owner PR). Every module that
     takes this app's analysis builds its LL+IM from here (ui/rating.js, ui/shear.js, ui/fatigue.js, ui/welds.js fromAnalysis; engine/splices.js
     arraysFromAnalysis), and R.pl gives the pedestrian part (M_PL, V_PL) so that the owner multiplier m is kept off it (GD45).
     Returns { Mpos, Mneg, VRpos, VRneg, VLpos, VLneg, R: [{ max, min }], pl: R.pl } or null (no live load). */
  function llPL(R) {
    if (!R || !R.ll) return null; const L = R.ll, Q = R.pl, add = k => L[k].map((v, i) => v + (Q ? Q[k][i] : 0));
    return { Mpos: add('Mpos'), Mneg: add('Mneg'), VRpos: add('VRpos'), VRneg: add('VRneg'), VLpos: add('VLpos'), VLneg: add('VLneg'),
      R: (R.llR || []).map((r, k) => ({ max: r.max + (Q ? Q.R[k].max : 0), min: r.min + (Q ? Q.R[k].min : 0) })), pl: Q };
  }

  window.SBDAnalysis = { DEF, STEEL_PLF, grid, settings, lineOf, deflOwner, moduleOf, loadsOf, dfOf, sbOf, analyzeGirder, ready, llPL };
})();
