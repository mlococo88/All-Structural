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
     g_V of the span of the element; reactions the larger g_V of the adjacent spans; fatigue g's of the span. N3 (2026-11-23): with
     xs.lldf.skewVx 'taper' the skew correction in g_V and g_fat,V decreases linearly to 1.0 at mid-span (4.6.2.2.3c); absent: as before.
   - pedestrian load (added 2026-10-30, sb-ped-owner PR; 3.6.1.6, GirderDetail plRow / vSec): w_PL of this girder (the loads module's
     share of the sidewalk load) on the + and − parts of each influence line (live-load stiffness): R.pl, apart from R.ll (HL-93);
     llPL(R) gives LL+IM + PL, once, to the modules; not in fatigue, deck placement or the LL deflection.
   - LL deflection (SA3, 2.5.2.6.2): g_Δ max(Δ_truck(1 + IM), 0.25 Δ_truck(1 + IM) + Δ_lane) ≤ L/limit, per span, on the bridge stiffness
     shared equally (N4, 2026-11-23: I_avg(x) = Σ I_n,j(x) / N_b over the cross-section girder lines; before: this girder's I_n); truck axles that
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
     With the girder's "Override calculated value" on (girder.loadsOverride / girder.dfOverride, added 2026-11-09; see deadOverride), an
     entered value comes before the module's (2 and 3 swap, field by field); off, the entered values are not used; absent (a project saved
     before), on exactly when the module gives none and a value is entered, so that the results are those of before.
     The construction live load (CL) is not in the loads module yet: 1 or 3 only. The cross-frame point loads (xf): 1, else, when the project
     has framing and engine/framing.js and engine/crossframes.js are loaded, every frame of the layout on this girder's cross-section line
     (SBDCrossframes.pointLoads: GirderDetail's XF1 weight, W/2 per girder at its own stations), else 3.
     Nothing entered: loads 0 and factors 1 (per lane), with a warning. */
(function () {
  'use strict';
  const ED = 'AASHTO LRFD 10th Ed.';
  const ML = () => window.SharedMovingLoad, SEC = () => window.SBDSections, St = () => window.SharedSteps, VEH = () => window.SharedVehicles;
  const CL_PSF = 20;   // construction live load (psf) when neither entered nor an owner rule (CLC, 2026-11-09; Decision pending engineer review)
  const STEEL_PLF = 490 / 144;   // lb/ft per in² of steel: 490 pcf / 144 = 3.4028 (Table 3.5.1-1; SB2-A2, 2026-10-29: GirderDetail's SA_PLF is 3.4)
  const DEF = { im: 33, imf: 15, crack: 'none', deflLimit: 800, seq: 'on', seqMod: 'n', seqCustom: '', steelAllowPct: 5, haunchInStiffness: null, deflSidewalk: 'auto' };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const n1 = x => St().n(x, 1), n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0);

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
      const j = lineOf(P, P.girders[gi]), c2 = R.cases && R.cases.c2 ? { R: R.cases.c2, G: LD.girder(R.cases.c2, j) } : null;   // RCURB: RIDOT BDM 3.4.1.1.1 case 2 (engine/loads.js cases)
      const c1 = R.cases && R.cases.c1fence ? { R: R.cases.c1 } : null;   // Q2 (2026-11-26): case 1's own faces (the fence ignored): its distribution factors
      return { j, G: LD.girder(R, j), R, allow: b.allow, lf: R.lf, ...(c2 ? { c2 } : {}), ...(c1 ? { c1 } : {}) };
    } catch (e) { return { errors: [e.message] }; }
  }

  /* loadsOf(project, g, mod): the girder's dead loads (precedence in the header).
     { DC1wet, DC2, DW, CL, UT, UF, PL, xf, steelAllowPct, src: { field: 'girder' | 'module' | 'manual' | 'none' }, source } */
  function loadsOf(P, g, mod) {
    const A = g.loads || null, M = mod && mod.G ? mod.G : null, B = g.loadsManual || null, o = { src: {} };
    const fromM = { DC1wet: M && M.DC1, DC2: M && M.DC2, DW: M && M.DW, UT: M && M.UT, UF: M && M.UF, PL: M && M.PL };
    // the dead-load override (girder.loadsOverride, added 2026-11-09, Loads tab "Override calculated value"): on, an entered value replaces the
    // calculated one field by field (a blank field keeps the calculated value); off, the entered values are not used. Absent (a project saved
    // before): on exactly when the loads module gives none and a value is entered, i.e. the entered values are used where they were before.
    const ov = deadOverride(g, M);
    o.override = ov;
    ['DC1wet', 'DC2', 'DW', 'UT', 'UF', 'PL'].forEach(k => {
      if (A && isNum(A[k])) { o[k] = A[k]; o.src[k] = 'girder'; } else if (ov && B && isNum(B[k])) { o[k] = B[k]; o.src[k] = 'manual'; }
      else if (M && isNum(fromM[k])) { o[k] = fromM[k]; o.src[k] = 'module'; } else { o[k] = 0; o.src[k] = 'none'; } });
    // construction live load (CLC, 2026-11-09): explicit; else entered with the girder's CL override on (girder.clOverride; absent: on when a
    // value is entered, as every project saved before); else calculated, w_CL = q_CL × b_trib (clOf), when the project calculates it
    // (analysis.clCalc, set on new projects); else none (a project saved before without an entry: 0, as before)
    const CLc = clOf(P, M), ovC = typeof g.clOverride === 'boolean' ? g.clOverride : !!(B && isNum(B.CL));
    o.cl = CLc; o.clOverride = ovC;
    if (A && isNum(A.CL)) { o.CL = A.CL; o.src.CL = 'girder'; } else if (ovC && B && isNum(B.CL)) { o.CL = B.CL; o.src.CL = 'manual'; }
    else if (CLc.on && isNum(CLc.w)) { o.CL = CLc.w; o.src.CL = 'calc'; } else { o.CL = 0; o.src.CL = 'none'; }
    // cross-frame point loads (XF1): explicit girder loads, else the framing and cross-frame weight (engine/framing.js, engine/crossframes.js;
    // added 2026-10-29 with the cross-frames PR, SB2-A6), else entered
    const CFm = !(A && Array.isArray(A.xf)) && P.framing && window.SBDCrossframes && window.SBDFraming ? window.SBDCrossframes.pointLoads(P, (P.girders || []).indexOf(g)) : null;
    const xf = A && Array.isArray(A.xf) ? A.xf : CFm ? CFm.pts : B && Array.isArray(B.xf) ? B.xf : [];
    o.xf = xf.filter(q => q && isNum(q.x) && isNum(q.P)).map(q => ({ x: q.x, P: q.P })); o.src.xf = A && Array.isArray(A.xf) ? 'girder' : CFm ? 'module' : B && Array.isArray(B.xf) ? 'manual' : 'none';
    if (CFm) o.xfInfo = { line: CFm.line, tot: CFm.tot, n: CFm.pts.length, kind: CFm.X.kind, allow: CFm.X.allow };
    o.steelAllowPct = allowFor(P, g, mod).pct;   // SBALLOW (2026-11-24): the same precedence as before, in allowFor
    o.source = A ? (A.source || 'girder loads') : M ? `loads module, cross-section girder G${mod.j + 1}${ov && ['DC1wet', 'DC2', 'DW', 'UT', 'UF', 'PL'].some(k => o.src[k] === 'manual') ? ', with entered overrides' : ''}` : B && g.loadsOverride !== false ? 'entered (manual)' : 'none entered';
    return o;
  }
  /* allowFor(P, g, mod) / allowOf(P, gi, mod) (SBALLOW, 2026-11-24): the girder steel detail allowance (%) the analysis of plate girder g
     (index gi) uses, loadsOf's steelAllowPct, and where it comes from: { pct, src } with src
       'girder'  the explicit girder loads, girder.loads.steelAllowPct (a hand-off);
       'module'  the loads module, xs.allow (Loads input tab, card "Wearing surface, forms and steel"; blank: 0);
       'setting' analysis.steelAllowPct (Loads input tab, Analysis settings; default 5), only when neither gives one.
     allowFor takes the loads module result mod as loadsOf does (none: no module); allowOf(P, gi) without mod computes it as
     analyzeGirder does (none when the girder has both explicit loads and factors). The Analysis settings box and the erection drawing
     (engine/sheets.js erect) show this value, so they cannot disagree with DC1 of the analysis. */
  function allowFor(P, g, mod) {
    const A = (g && g.loads) || null, M = mod && mod.G ? mod.G : null;
    if (A && isNum(A.steelAllowPct)) return { pct: A.steelAllowPct, src: 'girder' };
    if (M && isNum(mod.allow)) return { pct: mod.allow, src: 'module' };
    return { pct: settings(P).steelAllowPct, src: 'setting' };
  }
  function allowOf(P, gi, mod) {
    const g = P && P.girders ? P.girders[gi] : null; if (!g) return { pct: settings(P).steelAllowPct, src: 'setting' };
    if (mod === undefined) mod = g.loads && g.df ? null : moduleOf(P, gi);
    return allowFor(P, g, mod);
  }
  /* deadOverride(g, M) / dfOverride(g, modOk): is the girder's "Override calculated value" on for its dead loads / distribution factors
     (added 2026-11-09)? The saved flag (girder.loadsOverride / girder.dfOverride, true | false) when there is one; absent (every project
     saved before): on when the loads module gives none (M / modOk false) and a value is entered, so such a project computes as before. */
  const DEAD_K = ['DC1wet', 'DC2', 'DW', 'UT', 'UF', 'PL'], DF_K = ['gM', 'gMpier', 'gV', 'fatM', 'fatV', 'gDef'];
  function deadOverride(g, M) { if (typeof g.loadsOverride === 'boolean') return g.loadsOverride; const B = g.loadsManual || {}; return !M && DEAD_K.some(k => isNum(B[k])); }
  /* clOf(project, M): the calculated construction live load of the girder (CLC, 2026-11-09). q_CL (psf): project.analysis.qCL; blank: the
     owner's (engine/owners.js 'cll': CTDOT BDM V2 3.17CT, 50 psf), else 20 psf (AASHTO LRFD 10th Ed. Art. 3.4.2.1 gives no value; this app's
     default, as the overhang bracket construction load of the Constructibility tab, 0.020 ksf). b_trib: the girder's tributary deck width of
     the loads module (engine/loads.js dead(): half the bays either side, the overhang for an exterior girder), M = SBDLoads.girder(). w_CL =
     q_CL / 1000 × b_trib (klf). on: project.analysis.clCalc === true (new projects; a project saved before has no flag and is not calculated).
     Returns { on, q, qSrc, qCite, own (the owner's minimum, psf, or 0), trib, w (klf, NaN without the module) } */
  function clOf(P, M) {
    const a = (P && P.analysis) || {}, O = window.SBDOwners, own = P && P.ownerRules && P.ownerRules.owner, r = O && own ? O.rule(own, 'cll') : null;
    const qE = a.qCL === '' || a.qCL == null ? NaN : Number(a.qCL), entered = isFinite(qE) && qE >= 0;
    const q = entered ? qE : r && +r.value > 0 ? +r.value : CL_PSF, rm = O && own ? O.rule(own, 'cll.min') : null;
    const qSrc = entered ? 'entered' : r ? 'owner' : 'default', qCite = r ? O.cite(r) : `${ED} Art. 3.4.2.1 (no value given): this app's default`;
    const trib = M && isNum(M.trib) ? M.trib : NaN;
    return { on: a.clCalc === true, q, qSrc, qCite, own: rm && +rm.value > 0 ? +rm.value : 0, ownCite: rm ? O.cite(rm) : '', trib, w: q / 1000 * trib };
  }
  /* fmOf(project, mod, j): the finishing machine (CLC, 2026-11-09; optional): a pair of equal point loads P_fm (kip each), one on each overhang
     at e_fm (ft) from its deck edge, moving together along the bridge. Each load's share to the girders by the lever rule between the two
     nearest girders (outside the exterior girder: P(1 + a/S) on it, −Pa/S on the next; AASHTO LRFD 10th Ed. Art. 4.6.2.2.1, as the loads
     module's 'two'); P_j = the sum of the two shares on cross-section girder j. project.analysis.fm = { P, e }; absent or P ≤ 0: none.
     Returns null or { P, e, Wd, ub, sh: [left, right shares], Pj } (Pj NaN without the loads module) */
  function fmOf(P, mod, j) {
    const a = (P && P.analysis) || {}, F = a.fm || {}, Pf = Number(F.P), e = F.e === '' || F.e == null ? 0 : Number(F.e);
    if (!(Pf > 0) || !isFinite(e)) return null;
    const D = mod && mod.R && mod.R.dead; if (!D || !(j >= 0)) return { P: Pf, e, Pj: NaN };
    const ub = D.ub, N = ub.length, lever = x => { const r = ub.map(() => 0);
      if (x <= ub[0]) { const S1 = ub[1] - ub[0], d = ub[0] - x; r[0] = Pf * (1 + d / S1); r[1] = -Pf * d / S1; }
      else if (x >= ub[N - 1]) { const S1 = ub[N - 1] - ub[N - 2], d = x - ub[N - 1]; r[N - 1] = Pf * (1 + d / S1); r[N - 2] = -Pf * d / S1; }
      else { let k = 0; while (k < N - 2 && ub[k + 1] < x) k++; const t = (x - ub[k]) / (ub[k + 1] - ub[k]); r[k] = Pf * (1 - t); r[k + 1] = Pf * t; }
      return r; };
    const xL = e, xR = D.Wd - e, sL = lever(xL)[j], sR = lever(xR)[j];
    return { P: Pf, e, Wd: D.Wd, ub, xL, xR, S: [ub[1] - ub[0], ub[N - 1] - ub[N - 2]], sh: [sL, sR], Pj: sL + sR };
  }
  function dfOverride(g, modOk) { if (typeof g.dfOverride === 'boolean') return g.dfOverride; const B = g.dfManual || {}; return !modOk && DF_K.some(k => isNum(B[k])); }
  /* dfOf(project, g, ns, mod): distribution factors per span and pier (precedence in the header).
     { spans: [{ gM, gV, fatM, fatV, gDef }], piers: [{ gM }], src, manual } */
  function dfOf(P, g, ns, mod) {
    const B = dfBase(P, g, ns, mod), U = g.dfPull;
    // B2 (2026-11-01): factors pulled from LL & DL Distribution (lldf.html, channel bridgeSuite.v1.lldf; GirderDetail gdLldfApply, which fills
    // its manual factors sa.dfm and sets sa.dfSrc = 'manual'). girder.dfPull { spans: [{ gM, gV, fatM, fatV }], piers: [{ gM }], source } overlays
    // the factors above field by field (a field the payload did not have, e.g. no fatigue factors, keeps the factor from the order above, as
    // GirderDetail's mv(id, k) ?? module); gDef is not sent by lldf and is kept. Used only with the same span count. Absent: unchanged.
    if (!U || U.use === false || !Array.isArray(U.spans) || U.spans.length !== ns) return B;
    const v = (o, k) => o && isNum(o[k]) && o[k] > 0 ? o[k] : null;
    const spans = B.spans.map((s, i) => { const q = U.spans[i] || {}; return { gM: v(q, 'gM') ?? s.gM, gV: v(q, 'gV') ?? s.gV, fatM: v(q, 'fatM') ?? s.fatM, fatV: v(q, 'fatV') ?? s.fatV, gDef: s.gDef,
      rV: v(q, 'gV') == null ? s.rV : null, rVf: v(q, 'fatV') == null ? s.rVf : null, dP: s.dP }; });   // N3: a pulled g_V / g_fat,V: its skew correction is not known (no taper)
    const piers = B.piers.map((p, k) => ({ gM: v((U.piers || [])[k], 'gM') ?? p.gM }));
    const so = U.source || {}, kept = ['gM', 'gV', 'fatM', 'fatV'].filter(k => U.spans.some(q => v(q, k) == null));
    const src = `pulled from ${so.producer || 'LL & DL Distribution'} (${so.producerFile || 'lldf.html'}), produced ${so.producedAt || '?'}${so.project ? `, project "${so.project}"` : ''}; ${so.basisLbl || ''}`
      + `${kept.length ? `; ${kept.join(', ')} not in the hand-off: from ${B.src}` : ''}; deflection factor from ${B.src}`;
    return { spans, piers, src, manual: false, pulled: true, base: B.src };
  }
  function dfBase(P, g, ns, mod) {
    const D = g.df && Array.isArray(g.df.spans) && g.df.spans.length >= ns ? g.df : null;
    const rgOk = mod && mod.R && mod.R.regions && [...Array(ns)].every((_, i) => mod.R.regions.some(r => r.id === 's' + i)), ov = dfOverride(g, !!rgOk);
    const Mn = ov || (!rgOk && typeof g.dfOverride !== 'boolean') ? g.dfManual || {} : {};   // entered factors: used only with the override on (absent flag: as before)
    const man = k => isNum(Mn[k]) && Mn[k] > 0 ? Mn[k] : 1;
    if (D) {
      const M0 = g.dfManual || {}, gDef = isNum(D.gDef) ? D.gDef : isNum(M0.gDef) && M0.gDef > 0 ? M0.gDef : 1;   // explicit factors: the entered g deflection as before
      const spans = D.spans.slice(0, ns).map(s => ({ gM: s.gM, gV: s.gV, fatM: s.fatM, fatV: s.fatV, gDef: isNum(s.gDef) ? s.gDef : gDef }));
      const piers = [...Array(Math.max(0, ns - 1))].map((_, k) => { const q = (D.piers || [])[k]; return { gM: q && isNum(q.gM) ? q.gM : spans[k].gM }; });
      return { spans, piers, src: D.source || 'girder factors', manual: false };
    }
    if (mod && mod.R && mod.R.regions) {
      const rg = id => mod.R.regions.find(r => r.id === id), j = mod.j;
      if ([...Array(ns)].every((_, i) => rg('s' + i))) {
        // override on (2026-11-09): an entered factor (> 0) replaces the module's for every span; a blank one keeps the module's; the pier
        // g moment: entered, else the entered span g moment, else the module's (the entry's "blank = spans")
        const e = k => ov && isNum(Mn[k]) && Mn[k] > 0 ? Mn[k] : null, used = ov && DF_K.some(k => e(k) != null);
        const spans = [...Array(ns)].map((_, i) => { const r = rg('s' + i), m = r.members[j]; return { gM: e('gM') ?? m.gM, gV: e('gV') ?? m.gV, fatM: e('fatM') ?? m.fatM, fatV: e('fatV') ?? m.fatV, gDef: e('gDef') ?? r.gDef,
          // N3 (2026-11-23): the shear skew correction r_V contained in the module's g_V (rV) and g_fat,V (rVf), for the taper along the girder
          // (an entered factor: not known, null); N4: the parts of the module's g_Δ (N_L, m, N_b) for the worked step (an entered g_Δ: null)
          rV: e('gV') == null && isNum(m.rVg) ? m.rVg : null, rVf: e('fatV') == null && isNum(m.rV) ? m.rV : null, dP: e('gDef') == null && r.geo ? { NL: r.geo.NL, m: r.mD, Nb: r.members.length } : null }; });
        const piers = [...Array(Math.max(0, ns - 1))].map((_, k) => { const r = rg('p' + (k + 1)); return { gM: e('gMpier') ?? e('gM') ?? (r ? r.members[j].gM : spans[k].gM) }; });
        return { spans, piers, src: `loads module (LLDF), cross-section girder G${j + 1}${used ? ', with entered overrides' : ''}`, manual: false, override: used };
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
     its LLDF and DLs sidewalks), or the entered override analysis.deflSidewalk 'yes' / 'no' (C-32, engineer 2026-11-01; GirderDetail /
     Preliminary sizing limits.sidewalk, plSidewalk; absent or 'auto': the cross-section). The entered L/… (analysis.deflLimit) governs where stricter (rq = max). null for AASHTO and CTDOT
     (no rule: the entered L/…, 2.5.2.6.2 optional criterion). Returns { rule, cite, sw, swHow, req, uR, rq, pref, rep, line, ext } */
  function deflOwner(P, g, S) {
    const O = window.SBDOwners, own = P.ownerRules && P.ownerRules.owner, r = O && own ? O.rule(own, 'defl.ll') : null; if (!r) return null;
    const xs = P.xs || (window.SBDModel && window.SBDModel.defaultXs ? window.SBDModel.defaultXs(P) : null), sw = (xs && xs.sidewalks) || {}, ov = S && S.deflSidewalk, on = ov === 'yes' ? true : ov === 'no' ? false : ['L', 'R'].some(k => sw[k] && +sw[k].w > 0);
    const swHow = ov === 'yes' || ov === 'no' ? 'entered (Loads tab, Analysis settings)' : 'cross-section sidewalks';
    const v = r.value, req = on ? v.ped : v.veh, uR = +S.deflLimit > 0 ? +S.deflLimit : 0, rq = Math.max(req, uR), pref = !on && v.pref ? Math.max(v.pref, rq) : 0;
    const nb = xs ? Math.round(xs.nb) : 0, j = lineOf(P, g), ext = j === 0 || j === nb - 1;
    return { rule: r, cite: O.cite(r), sw: on, swHow, req, uR, rq, pref, rep: !!(v.intOnly && ext), line: j, ext };
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

  // deck placement sequence (saSeq): the pours from the sign of M_DC1, positive regions first (left to right), then negative.
  // A region runs from the first node of one sign to the first node of the next. Sign with a round-off tolerance (sb2-pour-sign):
  // |M| ≤ 1e-6 max |M_DC1| counts as zero, and zero counts as positive (as an exact 0 always did), so a round-off value at an
  // abutment (−1.6e-11 kip-ft) makes no sliver pour; a real contraflexure point splits exactly as before.
  function pourRegions(xs, MD) {
    const N = xs.length, tol = 1e-6 * Array.from(MD).reduce((a, v) => Math.max(a, Math.abs(v)), 0), sg = v => v < -tol ? -1 : 1, reg = []; let s = 0;
    for (let i = 1; i < N; i++) if (sg(MD[i]) !== sg(MD[i - 1]) || i === N - 1) { reg.push({ a: xs[s], b: xs[i], pos: sg(MD[Math.floor((s + i) / 2)]) > 0 }); s = i; }
    return [...reg.filter(r => r.pos), ...reg.filter(r => !r.pos)].map(r => ({ a: r.a, b: r.b }));
  }

  /* plateOfLine(P, j, nb): the plate girder (index in P.girders) of cross-section girder line j of nb: the girder type assigned to the line
     (girders[i].lines), else the one whose line it is, else the first one of the line's position (exterior / interior), else the first. The
     same rule as the Drawings and the Deflection tab (engine/drawings.js plateGirderOf), here so that the analysis needs no other engine. */
  function plateOfLine(P, j, nb) {
    const G = P.girders || [], ext = j === 0 || j === nb - 1;
    let k = G.findIndex(g => Array.isArray(g.lines) && g.lines.includes(j)); if (k >= 0) return k;
    k = G.findIndex(g => Number.isInteger(g.line) && g.line === j); if (k >= 0) return k;
    k = G.findIndex(g => !Number.isInteger(g.line) && (g.position === 'exterior') === ext); return k >= 0 ? k : 0;
  }
  /* skewTaper(c, x, a, L): N3 (2026-11-23), AASHTO LRFD 10th Ed. Art. 4.6.2.2.3c: the ratio of the shear skew correction at station x of the
     span from a to a + L (ft) to the correction c at its supports, the correction decreasing linearly from c at each support to 1.0 at
     mid-span: r_V(x)/r_V = [1 + (c − 1)(1 − x′/(L/2))]/c, x′ = the distance from the nearer support. 1 for c ≤ 1 or c not known. */
  function skewTaper(c, x, a, L) { if (!(c > 1) || !(L > 0)) return 1; const t = Math.min(1, Math.max(0, Math.min(x - a, a + L - x) / (L / 2))); return (1 + (c - 1) * (1 - t)) / c; }

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
      const Wr = window.SBDRolled ? window.SBDRolled.plf(s) : null;   // ROLL: the tabulated weight of a rolled segment (lb/ft); a plate segment has no Wr / shape field
      return { x0: s.x0, x1: s.x1, p, As: st.A, Is: st.I, I3u: c3 ? c3.I : st.I, Inu: cn ? cn.I : st.I, Icr: comp ? cr.I : st.I, c3, cn, ...(Wr != null ? { Wr, shape: window.SBDRolled.label(s) } : {}) }; });

    const LD = loadsOf(P, g, mod), DF = dfOf(P, g, ns, mod && mod.c1 ? { ...mod, R: mod.c1.R } : mod), warnings = [];   // Q2: case 1's factors from its own faces (mod.c1, the fence ignored); else the module's, as before
    /* RCURB (sb-ridot-curb PR, 2026-11-25): RIDOT BDM 3.4.1.1.1, a mountable sidewalk: two live-load cases, the more severe governs (engine/loads.js
       cases). The loads module's own result (mod, DF, LD) has case 1's lanes and factors (the roadway between the barriers, the mountable
       sidewalk part of it); case 1 takes no pedestrian load (PL1 = 0). mod.c2 is case 2: the lanes on the curb-to-curb roadway, the
       pedestrian load on the sidewalks. Below, the live
       load is worked with each case's distribution factors (and case 2's w_PL), and at every station each effect takes the case with the larger
       factored live load m·LL+IM + PL (the Strength and Service combinations both take γ_LL·m on LL+IM and γ_LL on PL); fatigue and the LL
       deflection (no pedestrian load) the larger of the two. Without a case 2 (any other owner, no mountable sidewalk): as before, bit for bit. */
    const CS = (() => { if (!mod || !mod.c2) return null; const m2 = { ...mod, R: mod.c2.R, G: mod.c2.G }, L2 = loadsOf(P, g, m2);
      return { mod2: m2, DF2: dfOf(P, g, ns, m2), PL2: L2.PL, srcPL2: L2.src.PL, info: mod.R.cases, mO: own && +own.m > 0 ? +own.m : 1 }; })();
    const PL1 = CS ? 0 : LD.PL;   // case 1: "pedestrian load on any sidewalks is ignored" (an entered PL override too)
    if (mod && mod.errors) warnings.push(`Loads module: ${mod.errors[0]} The entered loads and factors are used.`);
    if (LD.source === 'none entered') warnings.push('No dead loads for this girder: DC1 wet deck, DC2, DW and construction LL are 0 unless entered on the Loads tab (Override calculated value). Only the girder steel is computed here.');
    if (DF.manual) warnings.push(`Live load distribution factors: ${DF.src}. LL+IM is per girder only with this girder's factors.`);
    if (LD.src.CL === 'none') warnings.push(LD.cl.on ? 'Construction live load: the tributary deck width needs the loads module (complete cross-section); M_CL is 0.' : 'Construction live load not calculated (a project saved before 2026-11-09) and not entered: M_CL is 0. Loads tab: "Calculate the construction live load".');
    if (LD.src.CL === 'calc' && LD.cl.own && LD.cl.q < LD.cl.own - 1e-9) warnings.push(`Construction live load q_CL = ${LD.cl.q} psf is below the owner's minimum ${LD.cl.own} psf (${LD.cl.ownCite}).`);
    const FM = fmOf(P, mod, mod && mod.j != null ? mod.j : lineOf(P, g));
    if (FM && !isNum(FM.Pj)) warnings.push('Finishing machine: its share to this girder needs the loads module (complete cross-section); it is not applied.');
    const allow = LD.steelAllowPct, plf = isNum(opt.steelPlf) ? opt.steelPlf : STEEL_PLF, wSteel = segs.map(s => (s.Wr != null ? s.Wr : s.As * plf) / 1000 * (1 + allow / 100));   // ROLL (2026-11-23): a rolled segment weighs its tabulated W (lb/ft)
    const distSteel = segs.map((s, i) => [s.x0, s.x1, wSteel[i]]);
    const xfP = LD.xf.map(q => [q.x, q.P]);
    // A2 (2026-11-19): haunch and SIP forms with each plate segment's top flange width. The loads module works them with one b_f (the first
    // region's: span 1, its section of maximum positive moment); here each segment adds Δw = (h/12)(Δb_f/12)w_c − (q_SIP/1000)n_bays(Δb_f/12)/2,
    // Δb_f = b_f,seg − b_f,0 (the haunch over the wider flange; the SIP forms over the narrower clear bays, n_bays = 1 exterior, 2 interior).
    // Only where DC1 comes from the loads module (an entered DC1 is used as entered). Before: b_f,0 along the whole girder.
    const wetCorr = [], AJ = LD.src.DC1wet === 'module' && mod && mod.G && mod.G.adj ? mod.G.adj : null;
    if (AJ) segs.forEach(s => { const db = (s.p.topB - AJ.bf0) / 12; if (Math.abs(db) < 1e-9) return; const dh = AJ.hh / 12 * db * AJ.uc, ds = -AJ.sipq / 1000 * AJ.nAdj * db / 2;
      wetCorr.push({ x0: s.x0, x1: s.x1, topB: s.p.topB, db, dh, ds, w: dh + ds }); });
    const wetL = wetCorr.length ? { dist: [[0, Lt, LD.DC1wet], ...wetCorr.map(c => [c.x0, c.x1, c.w])] } : { w: LD.DC1wet };
    const wetIn = (a, b) => [[a, b, LD.DC1wet], ...wetCorr.map(c => [Math.max(a, c.x0), Math.min(b, c.x1), c.w]).filter(q => q[1] > q[0] + 1e-9)];
    const wetTot = LD.DC1wet * Lt + wetCorr.reduce((t, c) => t + c.w * (c.x1 - c.x0), 0);
    const SA = (sb, loads, stations) => ML().staticAnalysis({ spans, E, sb, simple: !cont, loads, stations: stations || xs });

    // cracked zones (feStages): grid elements, continuous girders only
    const sbS = sbOf(segs, 'Is');
    let crack = [];
    if (cont && comp && S.crack !== 'none') {
      const ck = new Uint8Array(N - 1);
      if (S.crack === 'dl') {
        const a = SA(sbS, { dist: [...distSteel, ...wetIn(0, Lt)], P: xfP }), b = SA(sbOf(segs, 'I3u'), { w: LD.DC2 + LD.DW });
        const Mt = a.M.map((v, i) => v + b.M[i]); for (let e = 0; e < N - 1; e++) ck[e] = Mt[e] < 0 && Mt[e + 1] < 0 ? 1 : 0;
      } else for (let k = 1; k < ns; k++) { const xp = xs[supIdx[k]], a = 0.15 * spans[k - 1], c = 0.15 * spans[k];
        for (let e = 0; e < N - 1; e++) { const xm = (xs[e] + xs[e + 1]) / 2; if (xm >= xp - a - 1e-9 && xm <= xp + c + 1e-9) ck[e] = 1; } }
      for (let e = 0; e < N - 1; e++) if (ck[e]) { const l = crack[crack.length - 1]; if (l && Math.abs(l[1] - xs[e]) < 1e-9) l[1] = xs[e + 1]; else crack.push([xs[e], xs[e + 1]]); }
    }
    const sb3 = sbOf(segs, 'I3u', crack), sbN = sbOf(segs, 'Inu', crack);
    /* bridgeEI(): N4 (2026-11-23), the bridge's live-load stiffness shared equally (2.5.2.6.2). Each cross-section girder line j takes the
       plate girder of plateOfLine (its segments and b_eff; the same deck, n and haunch rule; this girder's cracked zones). Returns null without
       a cross-section, else { nb, E, types: [{ gi, label, lines, sb }], same (every line on this girder: I_avg = I_n), sb: [[x0, x1, I_avg]],
       at(x): { x, nb, E, parts: [{ label, n (lines), I }], sumI, Iavg, Iown } }. A type whose plates do not reach a station: this girder's I there. */
    const bridgeEI = () => {
      const x0 = P.xs || (window.SBDModel && window.SBDModel.defaultXs ? window.SBDModel.defaultXs(P) : null), nb = x0 ? Math.round(x0.nb) : 0; if (!(nb > 0)) return null;
      const by = new Map(); for (let j = 0; j < nb; j++) { const k = plateOfLine(P, j, nb); if (!by.has(k)) by.set(k, []); by.get(k).push(j); }
      const IAt = (sb, x) => { const q = sb.find(r => x >= r[0] - 1e-9 && x <= r[1] + 1e-9); return q ? q[2] : null; };
      const types = [...by.entries()].map(([k, lines]) => { const gg = P.girders[k], own = k === gi;
        const sg = own ? segs : gg.segments.map(t => { const p = { D: t.D, tw: t.tw, topB: t.topB, topT: t.topT, botB: t.botB, botT: t.botT }, dk = { ...deckS, beff: gg.beff }, st0 = SEC().steelCore(p);
          return { x0: t.x0, x1: t.x1, Inu: comp ? SEC().composite(p, dk, n, 1).I : st0.I, Icr: comp ? SEC().withRebar(p, dk).I : st0.I }; });
        return { gi: k, label: gg.label || gg.id || 'G' + (k + 1), lines, sb: own ? sbN : sbOf(sg, 'Inu', crack) }; });
      const tOf = []; types.forEach((t, ti) => t.lines.forEach(j => { tOf[j] = ti; }));
      const same = types.length === 1 && types[0].gi === gi, Iof = (t, x) => { const v = IAt(t.sb, x); return v != null ? v : IAt(sbN, x); };
      const at = x => { const xe = Math.min(Math.max(x, 1e-6), Lt - 1e-6), parts = types.map(t => ({ label: t.label, n: t.lines.length, lines: t.lines, I: Iof(t, xe) }));
        let sumI = 0; for (let j = 0; j < nb; j++) sumI += parts[tOf[j]].I;   // line by line (G1 … Gn), so that the sum does not depend on how the lines are grouped in types
        return { x, nb, E, parts, sumI, Iavg: same ? IAt(sbN, xe) : sumI / nb, Iown: IAt(sbN, xe), same }; };
      let sb = sbN;
      if (!same) { const cuts = new Set(); types.forEach(t => t.sb.forEach(r => { cuts.add(+r[0].toFixed(9)); cuts.add(+r[1].toFixed(9)); })); sbN.forEach(r => { cuts.add(+r[0].toFixed(9)); cuts.add(+r[1].toFixed(9)); });
        const pts = [...cuts].filter(v => v >= -1e-9 && v <= Lt + 1e-9).sort((a, b) => a - b); sb = [];
        for (let i = 0; i < pts.length - 1; i++) if (pts[i + 1] - pts[i] > 1e-9) sb.push([pts[i], pts[i + 1], at((pts[i] + pts[i + 1]) / 2).Iavg]); }
      return { nb, E, types, same, sb, at };
    };

    // dead-load stages (staticAnalysis, loads applied exactly)
    const st = {};
    st.DC1steel = SA(sbS, { dist: distSteel, P: xfP });
    st.DC1wet = SA(sbS, wetL);
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
    const camberStages = [{ spans, E, sb: sbS, simple: !cont, loads: { dist: distSteel, P: xfP } }, { spans, E, sb: sbS, simple: !cont, loads: wetL },
      { spans, E, sb: sb3, simple: !cont, loads: { w: LD.DC2 + LD.DW } }];
    if (LD.UT) camberStages.push({ spans, E, sb: sbS, simple: !cont, loads: { w: LD.UT } });
    const cam = ML().camber(camberStages, { stations: xs });
    const camber = { x: cam.x, steel: cam.stages[0], wet: cam.stages[1], sd: cam.stages[2], ut: LD.UT ? cam.stages[3] : null, total: cam.total };

    const pick = (R, get) => {   // (hoisted from the live-load block, 2026-11-09, unchanged) envelope at the stations: M at the node, V just right of the node, V just left at the supports and the end; get(ei): { max, min } (default R.res)
      const node = x => { let lo = 0, hi = R.x.length - 1; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (R.x[md] <= x) lo = md; else hi = md; } return Math.abs(R.x[lo] - x) <= Math.abs(R.x[hi] - x) ? lo : hi; };
      const mOf = {}, vR = {}, vL = {}; R.effs.forEach((ef, ei) => { if (ef.t === 'M') { if (mOf[ef.node] === undefined) mOf[ef.node] = ei; } else if (ef.t === 'V') { if (ef.cutL) { if (vR[ef.el] === undefined) vR[ef.el] = ei; } else if (vL[ef.el + 1] === undefined) vL[ef.el + 1] = ei; } });
      const res = get || (ei => R.res[ei]), o = { Mmax: [], Mmin: [], VRmax: [], VRmin: [], VLmax: [], VLmin: [], twoM: [] };
      xs.forEach((x, i) => { const j = node(x), em = mOf[j], er = vR[j], el = vL[j];
        const rm = em !== undefined ? res(em) : { max: 0, min: 0 }; o.Mmax.push(rm.max); o.Mmin.push(rm.min); o.twoM.push(em !== undefined && !!R.effs[em].neg);
        const rr = er !== undefined ? res(er) : null, rl = el !== undefined ? res(el) : null;
        o.VRmax.push(rr ? rr.max : 0); o.VRmin.push(rr ? rr.min : 0); o.VLmax.push(rl ? rl.max : rr ? rr.max : 0); o.VLmin.push(rl ? rl.min : rr ? rr.min : 0); });
      o.R = R.effs.map((ef, ei) => { if (ef.t !== 'R') return null; const q = res(ei); return { q: ef.q, max: q.max, min: q.min, two: !!(q.maxG && /×2/.test(q.maxG.lab)) }; }).filter(Boolean).sort((a, b) => a.q - b.q);
      return o; };
    // finishing machine (CLC, 2026-11-09; fmOf): the girder's share P_j as one moving point load on the steel section I_s (the shared moving-load
    // engine, a one-axle vehicle of 1 kip, no lane, no IM, × P_j). Added to the construction live load at each station with the sign of
    // M_DC1 + M_CL,uniform (V: of V_DC1 + V_CL,uniform), so that it adds to the deck placement moment and shear; the reactions add the largest
    // one. st.CLu keeps the uniform part (its statics check); st.CL is the sum, which every module reads as M_CL, V_CL.
    let fm = null;
    if (FM && isNum(FM.Pj) && Math.abs(FM.Pj) > 1e-12) {
      const preSup = []; for (let i = 0; i < N - 1; i++) if (supIdx.includes(i + 1)) preSup.push((xs[i] + xs[i + 1]) / 2);
      const mFM = { spans, E, segs: segsOf(sbS), stdLane: null, dirs: [1, -1], llf: 1, dfM: spans.map(() => 1), dfV: spans.map(() => 1), dfNeg: 0, step: 1, hStep: 2, simple: !cont,
        scanKeys: [...xs, ...preSup], scanM: [...xs], scanV: true, negX: [], axles: [[1, 0]], short: 'Finishing machine', udl: { mode: 'none', w: 0 }, vK: 0, vMin: 0, vMax: 0, neglect: false,
        secondary: '', multi: false, mScale: 1, mHmin: 50, mFixed: 0, imp: { method: 'const', val: 1, S: 6.5, bal: false, onUdl: false } };
      const u = pick(ML().analyze(mFM, { vehicles: VEH().build().presets })), Pj = FM.Pj;
      const rng = (mx, mn) => Pj >= 0 ? [Pj * mn, Pj * mx] : [Pj * mx, Pj * mn], add = (base, mx, mn, sg) => base.map((v, i) => { const [lo, hi] = rng(mx[i], mn[i]); return v + (sg[i] >= 0 ? hi : lo); });
      const CLu = st.CL, sM = xs.map((_, i) => st.DC1steel.M[i] + st.DC1wet.M[i] + CLu.M[i]), sVR = xs.map((_, i) => st.DC1steel.VR[i] + st.DC1wet.VR[i] + CLu.VR[i]), sVL = xs.map((_, i) => st.DC1steel.VL[i] + st.DC1wet.VL[i] + CLu.VL[i]);
      st.CLu = CLu;
      st.CL = { x: CLu.x, M: add(CLu.M, u.Mmax, u.Mmin, sM), VR: add(CLu.VR, u.VRmax, u.VRmin, sVR), VL: add(CLu.VL, u.VLmax, u.VLmin, sVL), defl: CLu.defl, R: CLu.R.map((v, k) => v + (u.R[k] ? rng(u.R[k].max, u.R[k].min)[1] : 0)) };
      fm = { ...FM, unit: u, M: st.CL.M.map((v, i) => v - CLu.M[i]), R: st.CL.R.map((v, k) => v - CLu.R[k]) };
    }

    // live load (HL-93 and the fatigue truck, per lane, IM included, DF = 1 inside the engine; the factors are applied below)
    let ll = null, fat = null, lld = null, llR = null, ped = null, skV = null, bEI = null, vehRun = null;
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
      const h = pick(RH), f = pick(RF);
      // rating vehicles (legal and permit loads, 2026-11-23; ui/rating.js): R.vehicle(v) runs one vehicle on the same live-load model (stiffness,
      // mesh, stations, negative-moment regions) and returns its per-lane envelopes at the stations with IM on the axles, DF = 1 (the caller
      // applies the factors). v = { short, axles [[P, spacing]…], udl, neglect, multi { on, scale, hmin, fixed }, im (percent) }. Run only when asked,
      // kept with this analysis result (one run per vehicle and IM). at: the governing case of each envelope value (label, position, direction).
      vehRun = (() => { const memo = new Map(); return v => { const k = JSON.stringify(v); if (memo.has(k)) return memo.get(k);
        const mu = v.multi || {}, mV = { ...base, axles: v.axles.map(a => [...a]), short: v.short || 'Vehicle', udl: v.udl ? { ...v.udl } : { mode: 'none', w: 0, gap: 0, trunc: false }, vK: 0, vMin: 0, vMax: 0, neglect: !!v.neglect,
          secondary: '', multi: !!mu.on, mScale: mu.scale != null ? mu.scale : 1, mHmin: mu.hmin != null ? mu.hmin : 50, mFixed: mu.fixed || 0, imp: { method: 'const', val: 1 + (+v.im || 0) / 100, S: 6.5, bal: false, onUdl: false } };
        const RV = ML().analyze(mV, { vehicles: pre }), o = { perLane: pick(RV), at: pick(RV, ei => ({ max: RV.res[ei].maxG || null, min: RV.res[ei].minG || null })) }; memo.set(k, o); return o; }; })();
      const spR = i => spanOfX(sup, i < N - 1 ? (xs[i] + xs[i + 1]) / 2 : xs[i] - 1e-6), spL = i => spanOfX(sup, i > 0 ? (xs[i - 1] + xs[i]) / 2 : xs[i]);
      // N3 (2026-11-23, engineer's decision): the shear skew correction along the girder (xs.lldf.skewVx). 'taper': the correction contained in
      // g_V and g_fat,V (the loads module's r_V of the span) is full at each support of the span and decreases linearly to 1.0 at mid-span
      // (4.6.2.2.3c), so the factor at station x is g_V × skewTaper; 'whole' / absent: the span's g_V at every station (tp = 1: as before, bit
      // for bit). An entered or pulled g_V has no known r_V and is used over the whole span. The reactions keep the support value.
      const taper = !!(P.xs && P.xs.lldf && P.xs.lldf.skewVx === 'taper');
      const tpOf = DFx => (k, i, key) => taper ? skewTaper(DFx.spans[k][key], xs[i], sup[k], spans[k]) : 1;
      skV = taper ? { on: true, spans: DF.spans.map((q, k) => ({ k, rV: isNum(q.rV) ? q.rV : null, rVf: isNum(q.rVf) ? q.rVf : null })) } : null;
      if (skV && skV.spans.some(q => q.rV == null || q.rVf == null)) warnings.push('Shear skew correction along the girder: "tapered" is chosen, but a shear distribution factor of this girder is entered, pulled or from a hand-off, so its skew correction is not known: that factor is used over the whole span (not tapered).');
      // the HL-93 and fatigue truck effects with the distribution factors DFx (RCURB: once per live-load case; one case: as before)
      const llWith = DFx => { const gMat = i => region[i] >= 1 ? DFx.piers[region[i] - 1].gM : DFx.spans[spanOfX(sup, xs[i])].gM, tp = tpOf(DFx);
      const ll_ = { perLane: h, gM: xs.map((_, i) => gMat(i)), gVR: xs.map((_, i) => DFx.spans[spR(i)].gV * tp(spR(i), i, 'rV')), gVL: xs.map((_, i) => DFx.spans[spL(i)].gV * tp(spL(i), i, 'rV')) };
      ll_.Mpos = h.Mmax.map((v, i) => ll_.gM[i] * v); ll_.Mneg = h.Mmin.map((v, i) => ll_.gM[i] * v);
      ll_.VRpos = h.VRmax.map((v, i) => ll_.gVR[i] * v); ll_.VRneg = h.VRmin.map((v, i) => ll_.gVR[i] * v);
      ll_.VLpos = h.VLmax.map((v, i) => ll_.gVL[i] * v); ll_.VLneg = h.VLmin.map((v, i) => ll_.gVL[i] * v);
      const fat_ = { perLane: f, gM: xs.map((x) => DFx.spans[spanOfX(sup, x)].fatM), gVR: xs.map((_, i) => DFx.spans[spR(i)].fatV * tp(spR(i), i, 'rVf')), gVL: xs.map((_, i) => DFx.spans[spL(i)].fatV * tp(spL(i), i, 'rVf')) };
      fat_.Mpos = f.Mmax.map((v, i) => fat_.gM[i] * v); fat_.Mneg = f.Mmin.map((v, i) => fat_.gM[i] * v);
      fat_.VRpos = f.VRmax.map((v, i) => fat_.gVR[i] * v); fat_.VRneg = f.VRmin.map((v, i) => fat_.gVR[i] * v);
      fat_.VLpos = f.VLmax.map((v, i) => fat_.gVL[i] * v); fat_.VLneg = f.VLmin.map((v, i) => fat_.gVL[i] * v);
      const llR_ = h.R.map((r, k) => { const adj = [k - 1, k].filter(i => i >= 0 && i < ns), gV = Math.max(...adj.map(i => DFx.spans[i].gV)); return { k, gV, max: gV * r.max, min: gV * r.min, perLane: r, two: r.two }; });
      return { ll: ll_, fat: fat_, llR: llR_ }; };
      ({ ll, fat, llR } = llWith(DF));
      // pedestrian load (AASHTO LRFD 3.6.1.6; GirderDetail GM.sa.compute plRow and vSec, GD45/GD49; added 2026-10-30, sb-ped-owner PR): w_PL of
      // this girder (the loads module's share: already per girder, so no g, no IM and no multiple presence) on the parts of each influence line
      // (live-load stiffness, the same mesh as HL-93) of one sign: max = w_PL × (positive area), min = w_PL × (negative area). Reactions likewise.
      // Kept apart from R.ll (HL-93 only, which the LL deflection and the factors use); every module takes LL+IM + PL once (llPL below).
      const pedOf = wPL => {   // RCURB: a function of w_PL (case 2 has its own); the arithmetic as before
        const memo = new Map(), area = ei => { if (memo.has(ei)) return memo.get(ei); let lp = 0, ln = 0; const xr = RH.x;
          for (let j = 0; j < xr.length - 1; j++) { const hh = xr[j + 1] - xr[j], [a, b] = RH.ends(ei, j);
            if (a >= 0 && b >= 0) lp += (a + b) / 2 * hh; else if (a <= 0 && b <= 0) ln += (a + b) / 2 * hh;
            else { const t = a / (a - b), A1 = a * t * hh / 2, A2 = b * (1 - t) * hh / 2; if (a > 0) { lp += A1; ln += A2; } else { ln += A1; lp += A2; } } }
          const v = { max: wPL * lp, min: wPL * ln, ap: lp, an: ln }; memo.set(ei, v); return v; };
        const q = pick(RH, area);
        return { w: wPL, Mpos: q.Mmax, Mneg: q.Mmin, VRpos: q.VRmax, VRneg: q.VRmin, VLpos: q.VLmax, VLneg: q.VLmin, R: q.R.map((r, k) => ({ k, max: r.max, min: r.min })) };
      };
      if (PL1 > 0) ped = pedOf(PL1);
      // RCURB: case 2 (curb-to-curb lanes, the pedestrian load) and the envelope of the two cases at every station, effect by effect
      if (CS) { const c2 = llWith(CS.DF2), p2 = CS.PL2 > 0 ? pedOf(CS.PL2) : null, mO = CS.mO, Z = new Array(N).fill(0);
        const c1 = { ll, fat, llR }, P1 = ped, sc = (o, q, k, i) => mO * o[k][i] + (q ? q[k][i] : 0);
        const pk = { }, L = { perLane: h }, Q = p2 || P1 ? { w: CS.PL2 } : null, F = { perLane: f };
        // HL-93 + PL: the case with the larger factored live load (positive envelopes) or the smaller (negative); a tie keeps case 1
        [['Mpos', 1, 'gM'], ['Mneg', -1, 'gM'], ['VRpos', 1, 'gVR'], ['VRneg', -1, 'gVR'], ['VLpos', 1, 'gVL'], ['VLneg', -1, 'gVL']].forEach(([k, sg, gk]) => {
          pk[k] = xs.map((_, i) => (sg * (sc(c2.ll, p2, k, i) - sc(c1.ll, P1, k, i)) > 1e-12 ? 2 : 1));
          L[k] = xs.map((_, i) => (pk[k][i] === 2 ? c2.ll : c1.ll)[k][i]);
          L[gk + (sg < 0 ? 'n' : '')] = xs.map((_, i) => (pk[k][i] === 2 ? c2.ll : c1.ll)[gk][i]);
          if (Q) Q[k] = xs.map((_, i) => { const o = pk[k][i] === 2 ? p2 : P1; return o ? o[k][i] : 0; }); });
        // fatigue truck (no pedestrian load): the larger magnitude
        [['Mpos', 1, 'gM'], ['Mneg', -1, 'gM'], ['VRpos', 1, 'gVR'], ['VRneg', -1, 'gVR'], ['VLpos', 1, 'gVL'], ['VLneg', -1, 'gVL']].forEach(([k, sg, gk]) => {
          pk['fat.' + k] = xs.map((_, i) => (sg * (c2.fat[k][i] - c1.fat[k][i]) > 1e-12 ? 2 : 1));
          F[k] = xs.map((_, i) => (pk['fat.' + k][i] === 2 ? c2.fat : c1.fat)[k][i]);
          F[gk + (sg < 0 ? 'n' : '')] = xs.map((_, i) => (pk['fat.' + k][i] === 2 ? c2.fat : c1.fat)[gk][i]); });
        // reactions: the larger m·R_LL+IM + R_PL (maximum)
        pk.R = c1.llR.map((r, k) => (mO * c2.llR[k].max + (p2 ? p2.R[k].max : 0) - (mO * r.max + (P1 ? P1.R[k].max : 0)) > 1e-12 ? 2 : 1));
        const llR2 = c1.llR.map((r, k) => (pk.R[k] === 2 ? c2.llR[k] : r));
        if (Q) Q.R = c1.llR.map((r, k) => { const o = pk.R[k] === 2 ? p2 : P1; return o ? o.R[k] : { k, max: 0, min: 0 }; });
        CS.c = [c1, c2]; CS.p = [P1, p2]; CS.pick = pk;
        ll = L; fat = F; llR = llR2; ped = Q && (p2 || P1) ? Q : null; }
      // LL deflection (SA3): shared deflection() at the 1/20 points, truck with IM or 25 % of it + lane, per lane; × g_Δ of the span.
      // Truck axles that do not add to the deflection sought are neglected (3.6.1.3.1; GirderDetail LL8; SB2-A4, 2026-10-29: neglect).
      // The limit: the owner rule (OWN19, deflOwner) or the entered L/… (2.5.2.6.2, optional criterion).
      // N4 (2026-11-23, engineer's decision "all girders deflect equally"; 2.5.2.6.2): the deflection is worked on the BRIDGE stiffness shared
      // equally: at every station the average of the cross-section girder lines' live-load stiffness, I_avg(x) = Σ_j I_n,j(x) / N_b (each line
      // with the plates and b_eff of its girder type; in this girder's cracked zones each line's I_cr), in place of this girder's own I_n(x).
      // One lane on a girder of I_avg, × g_Δ = m N_L / N_b. Before: this girder's own I_n. Every line on one girder type (or no cross-section):
      // I_avg = I_n, the same run as before (bit for bit). The moments, shears and reactions keep this girder's own stiffness.
      bEI = bridgeEI(); let RHd = RH;
      // (the second run: the same mesh (scanKeys) and the 1/20-point sections the deflection uses, without the station scan of M and V, which it does not use)
      if (bEI && !bEI.same) RHd = ML().analyze({ ...mH, axles: H.axles.map(a => [...a]), udl: { ...H.udl }, segs: segsOf(bEI.sb), scanM: null, scanV: false, negX: [] }, { vehicles: pre });
      const DL = ML().deflection(RHd, { mode: 'lrfd', DF: 1, useIM: true, neglect: true }), OW = deflOwner(P, g, S), rq = OW ? OW.rq : S.deflLimit;
      lld = spans.map((L, k) => { let best = null;
        DL.secs.forEach((s, si) => { if (s.k !== k) return; const v = -DL.res[si].dn; if (!best || v > best.raw) best = { x: s.x, raw: v, lab: DL.res[si].dnG ? DL.res[si].dnG.lab : '' }; });
        const cD = CS && CS.DF2.spans[k].gDef > DF.spans[k].gDef + 1e-12 ? 2 : 1, DFd = cD === 2 ? CS.DF2 : DF;   // RCURB: the larger g_Δ of the two cases (no pedestrian load)
        const gD = DFd.spans[k].gDef, dd = best ? best.raw * gD : 0, lim = L * 12 / rq, limP = OW && OW.pref ? L * 12 / OW.pref : 0, ok = dd <= lim + 1e-9;
        const status = OW && OW.rep ? 'na' : !ok ? 'fail' : limP && dd > limP + 1e-9 ? 'warn' : 'pass';
        return { k, L, x: best ? best.x : null, perLane: best ? best.raw : 0, case: best ? best.lab : '', gD, d: dd, lim, ratio: rq, pref: OW ? OW.pref : 0, limP, ok, status, own: OW,
          dP: DFd.spans[k].dP || null, EI: bEI && best ? bEI.at(best.x) : null, ...(CS ? { cs: cD, gD12: [DF.spans[k].gDef, CS.DF2.spans[k].gDef] } : {}) }; });
    }

    // deck placement sequence (saSeq): continuous girders, composite deck
    let seq = null;
    if (cont && comp && S.seq !== 'off') {
      const MD = st.DC1.M; let pours = [];
      const cust = String(S.seqCustom || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => s.split('-').map(Number)).filter(q => q.length === 2 && q.every(isFinite) && q[1] > q[0]);
      if (cust.length) pours = cust.map(([a, b]) => ({ a: Math.max(0, a), b: Math.min(Lt, b) }));
      else pours = pourRegions(xs, MD);
      const k3 = S.seqMod === '3n', nrS = k3 ? 3 * n : n, key = k3 ? 'I3u' : 'Inu';
      const inP = (x, q) => x >= q.a - 1e-6 && x <= q.b + 1e-6;
      const segAt = x => segs.find(s => x >= s.x0 - 1e-9 && x <= s.x1 + 1e-9 && (x < s.x1 - 1e-9 || s === segs[segs.length - 1])) || segs[segs.length - 1];
      const secs = xs.map(x => { const s = segAt(x + 1e-6), c = SEC().composite(s.p, deckS, nrS, 1); return { yb: c.yb, I: c.I, yd: c.d + deckS.haunch + deckS.ts }; });
      const done = [], cum = new Float64Array(N), envP = new Float64Array(N).fill(-Infinity), envN = new Float64Array(N).fill(Infinity), fdk = new Float64Array(N), compN = new Uint8Array(N), stages = [];
      const M0 = st.DC1steel.M; M0.forEach((v, i) => { cum[i] = v; envP[i] = Math.max(envP[i], v); envN[i] = Math.min(envN[i], v); }); stages.push({ name: 'Steel and other noncomposite load', M: Array.from(M0) });
      pours.forEach((q, k) => {
        const sbq = sbOf(segs, 'Is').flatMap(([a, b, I]) => { const cuts = [a, b]; done.forEach(([p, r]) => [p, r].forEach(v => { if (v > a + 1e-9 && v < b - 1e-9) cuts.push(v); })); cuts.sort((u, v) => u - v);
          return cuts.slice(0, -1).map((u, i) => { const xm = (u + cuts[i + 1]) / 2, seg = segAt(xm); return [u, cuts[i + 1], done.some(([p, r]) => xm >= p && xm <= r) ? seg[key] : I]; }); });
        const M = SA(sbq, { dist: wetIn(q.a, q.b) }).M;
        for (let i = 0; i < N; i++) { cum[i] += M[i]; if (compN[i]) { const c = secs[i]; fdk[i] += -M[i] * 12 * (c.yd - c.yb) / c.I / nrS; } else { envP[i] = Math.max(envP[i], cum[i]); envN[i] = Math.min(envN[i], cum[i]); } }
        xs.forEach((x, i) => { if (inP(x, q)) compN[i] = 1; }); done.push([q.a, q.b]); stages.push({ name: `Pour ${k + 1} (${n1(q.a)} to ${n1(q.b)} ft)`, M, q }); });
      const eP = Array.from(envP).map(v => Math.max(v, 0)), eN = Array.from(envN).map(v => Math.min(v, 0));
      const fr = 0.24 * Math.sqrt(m.concrete.fc), phifr = 0.9 * fr;
      // SBTS (2026-11-10): envPr / envNr, the pour-stage envelopes before the clip at 0 (the largest / smallest noncomposite moment of the
      // stages while the station is not yet composite), for Constructibility's sign cases (6.10.8.2.3b: M_A, M_B, M_C from the envelope value
      // with the largest compression in the flange, or the smallest tension where it is never in compression). New fields; nothing else changes.
      seq = { pours, stages, cum: Array.from(cum), envP: eP, envN: eN, envPr: Array.from(envP), envNr: Array.from(envN), fdk: Array.from(fdk), nr: nrS, fr, phifr,
        MDCc: Array.from(MD).map((v, i) => v >= 0 ? Math.max(v, eP[i]) : Math.min(v, eN[i])) };
    }

    const R = { errors: [], warnings, settings: S, fc: m.concrete.fc, h0, line: mod && mod.j != null ? mod.j : null, girder: g, gi, spans, sup, supIdx, cont, Lt, x: xs, n, nr, segs, plf, wSteel, loads: CS ? { ...LD, PL: CS.PL2, src: { ...LD.src, PL: CS.srcPL2 } } : LD, df: DF, crack, sb: { s: sbS, c3: sb3, cn: sbN }, region,
      st, camber, ll, fat, llR, lld, seq, pl: ped, fm, wetCorr, wetTot, skV, cases: CS && CS.c ? casesOut(CS, DF, xs) : null, bEI: bEI ? { nb: bEI.nb, same: bEI.same, sb: bEI.sb, types: bEI.types.map(t => ({ gi: t.gi, label: t.label, lines: t.lines })) } : null };
    R.steps = steps(R);
    if (vehRun) Object.defineProperty(R, 'vehicle', { value: vehRun, enumerable: false });   // not a result: the rating vehicles' runner (above)
    return R;
  }

  /* casesOut(CS, DF1, xs) (RCURB, sb-ridot-curb PR): the two live-load cases of RIDOT BDM 3.4.1.1.1 for the result (R.cases): the loads module's
     lane steps (engine/loads.js cases), per case the distribution factors of this girder, w_PL, the per-lane effects × g, and pick[k][i] (1 | 2)
     the case taken at station i for effect k (Mpos, Mneg, VRpos, VRneg, VLpos, VLneg; 'fat.<k>' the fatigue truck; R the reactions).
     Only when the live load was run (an analysis with opt.ll false, e.g. constructibility, has R.cases null). */
  function casesOut(CS, DF1, xs) {
    const I = CS.info, cnt = k => CS.pick[k].filter(v => v === 2).length;
    return { cite: I.cite, sides: I.sides, NL: I.NL, w: I.w, mO: CS.mO, PL: [0, CS.PL2], dfs: [DF1, CS.DF2], steps: I.steps,
      c: CS.c, p: CS.p, pick: CS.pick, n2: Object.fromEntries(Object.keys(CS.pick).map(k => [k, cnt(k)])), N: xs.length };
  }

  /* steps(R): the worked steps of the key values (shared/steps.js format). Each FE value is the stiffness-method result of the
     shared engine; its work is the load, the stiffness used and the statics check, and for LL the per-lane envelope × g. */
  function steps(R) {
    const w = St().work('an'), S = R.settings, L = R.loads, kip = 'kip', kft = 'kip-ft';
    w.add({ id: 'n', label: 'Modular ratio (for the composite stiffness)', sym: 'n', eq: '\\frac{E_{s}}{E_{c}}', sub: '', value: R.n, unit: '', d: 3, ref: `${ED} Art. 6.10.1.1.1b`, note: 'Worked in Section properties (n).' });
    R.segs.forEach((s, i) => {
      if (s.Wr != null) w.add({ id: `wst${i}`, label: `Girder steel weight, segment ${i + 1} (${n1(s.x0)}–${n1(s.x1)} ft), rolled shape ${s.shape}`, sym: 'w_{s}', eq: 'W(1 + a)/1000', sub: `${n2(s.Wr)}(1 + ${n2(L.steelAllowPct / 100)})/1000`, value: R.wSteel[i], unit: 'klf', d: 4,
        ref: `${window.SharedAiscW.VERSION}, ${s.shape}`, note: 'W = the tabulated nominal weight of the rolled shape, lb/ft (fillets included), in place of the three plates at 490 pcf. a = detail allowance for stiffeners, connection plates and splices.' });
      else w.add({ id: `wst${i}`, label: `Girder steel weight, segment ${i + 1} (${n1(s.x0)}–${n1(s.x1)} ft)`, sym: 'w_{s}', eq: 'A_{s}(\\frac{490}{144}\\,\\text{lb/ft/in}^{2})(1 + a)/1000', sub: `${n2(s.As)}(${St().n(R.plf, 4)})(1 + ${n2(L.steelAllowPct / 100)})/1000`, value: R.wSteel[i], unit: 'klf', d: 4,
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
    // A2 (2026-11-19): haunch and SIP forms per plate segment (top flange width of the segment)
    if (R.wetCorr && R.wetCorr.length) { const n4 = v => St().n(v, 4);
      R.wetCorr.forEach((c, k) => w.add({ id: 'wet.s' + k, label: `DC1 wet deck, x = ${n2(c.x0)} to ${n2(c.x1)} ft: haunch and SIP forms with this segment's top flange b_f = ${n2(c.topB)} in (the loads module used b_f,0 = ${n2(c.topB - c.db * 12)} in)`,
        sym: '\\Delta w', eq: '\\frac{h}{12}\\frac{\\Delta b_{f}}{12}w_{c} - \\frac{q_{SIP}}{1000}n_{bays}\\frac{\\Delta b_{f}}{2(12)}', sub: `${n4(c.dh)} + (${n4(c.ds)})`, value: c.w, unit: 'klf', d: 4, ref: `${ED} Art. 3.5.1`,
        note: `Δb_f = ${n2(c.db * 12)} in. Added to w_DC1 over the segment (wet deck stage, camber and pour sequence); the equilibrium check below includes it.` })); }
    [['DC1wet', 'DC1 wet deck (deck, haunch, SIP, other DC1)', 'w_{DC1}'], ['DC2', 'DC2', 'w_{DC2}'], ['DW', 'DW', 'w_{DW}'], ['CL', 'construction live load', 'w_{CL}']].forEach(([k, t, sy]) => {
      const a = k === 'DC1wet' && R.wetCorr && R.wetCorr.length ? R.wetTot : L[k] * R.Lt, sk = k === 'CL' && R.st.CLu ? 'CLu' : k; w.add({ id: 'eq.' + k, label: `Equilibrium, ${t}${sk === 'CLu' ? ' (uniform part)' : ''}: ΣR = wL`, sym: '\\sum R', eq: `${sy}L`, sub: `${St().n(L[k], 4)}(${n2(R.Lt)})`, value: tot(sk), unit: kip, d: 2, ref: 'Statics', ok: Math.abs(tot(sk) - a) <= 1e-6 * Math.max(1, a),
        note: `w = ${St().n(L[k], 4)} klf (${{ girder: 'girder loads', module: 'loads module', manual: 'entered', none: 'none entered', calc: 'calculated, q_CL × b_trib' }[L.src[k]]}).` }); });
    // construction live load and finishing machine (CLC, 2026-11-09): the calculated w_CL, the machine's share and its largest moments
    if (L.src.CL === 'calc') { const C = L.cl, G = R.line != null ? `G${R.line + 1}` : 'the girder';
      w.add({ id: 'CL.q', label: `Construction live load on the deck (${C.qSrc === 'entered' ? 'entered' : C.qSrc === 'owner' ? `owner rule, ${C.qCite}` : 'default'})`, sym: 'q_{CL}', eq: '', sub: '', value: C.q, unit: 'psf', d: 1, ref: C.qSrc === 'owner' ? C.qCite : `${ED} Art. 3.4.2.1`,
        note: `AASHTO LRFD 10th Ed. Art. 3.4.2.1 requires the construction loads but gives no value.${C.qSrc === 'default' ? " 20 psf: this app's default (as the overhang bracket construction load of the Constructibility tab, 0.020 ksf)." : ''}${C.own ? ` Owner minimum ${C.own} psf (${C.ownCite}).` : ''}` });
      w.add({ id: 'CL.w', label: `Construction live load on the girder (tributary deck width of cross-section girder ${G}, worked on the Loads & LLDF tab: dl.${G}.trib)`, sym: 'w_{CL}', eq: '\\frac{q_{CL}}{1000}b_{trib}', sub: `\\frac{${n1(C.q)}}{1000}(${n3(C.trib)})`, value: C.w, unit: 'klf', d: 4, ref: `${ED} Art. 3.4.2.1` }); }
    if (R.fm) { const F = R.fm;
      w.add({ id: 'fm.Pj', label: `Finishing machine: share of the pair of loads to this girder (lever rule; loads at ${n2(F.xL)} and ${n2(F.xR)} ft from the left deck edge)`, sym: 'P_{j}', eq: 'P_{fm}(\\text{share}_{L} + \\text{share}_{R})', sub: `${n2(F.P)}(${n4(F.sh[0] / F.P)} + ${n4(F.sh[1] / F.P)})`, value: F.Pj, unit: kip, d: 3, ref: `${ED} Art. 4.6.2.2.1, 3.4.2.1`,
        note: 'Outside the exterior girder: P(1 + a/S) on it and −Pa/S on the next girder; between two girders: in proportion to the distances. Moved along the bridge on the steel section (I_s) as one point load; at each station the larger effect of the sign of M_DC1 + M_CL is added to M_CL (V likewise).' });
      for (let k = 0; k < R.spans.length; k++) { const a = R.supIdx[k], b = R.supIdx[k + 1]; let ip = a; for (let i = a; i <= b; i++) if (Math.abs(F.M[i]) > Math.abs(F.M[ip])) ip = i;
        w.add({ id: `fm.M.s${k + 1}`, label: `Finishing machine moment, span ${k + 1}, at x = ${n2(R.x[ip])} ft (added to M_CL)`, sym: 'M_{fm}', eq: 'P_{j}\\,\\eta_{M}', sub: `${n3(F.Pj)}(${n2(F.M[ip] / F.Pj)})`, value: F.M[ip], unit: kft, d: 1, ref: `${ED} Art. 3.4.2.1`, note: 'η_M: the moment influence-line ordinate (ft) at the machine\'s position, on I_s.' }); } }
    // key moments per span and pier
    const x = R.x, at = (arr, i) => arr[i];
    /* RCURB (sb-ridot-curb PR): the two live-load cases of RIDOT BDM 3.4.1.1.1, worked: the lanes of each case (the loads module's steps),
       this girder's factors in each case, and at the governing points the factored live load m·LL+IM + PL of each case and the one taken */
    const C = R.cases, cs = (lab, k, i, sym) => { if (!C || !R.ll) return; const c1 = C.c[0], c2 = C.c[1], p1 = C.p[0], p2 = C.p[1], gk = /^M/.test(k) ? 'gM' : /^VR/.test(k) ? 'gVR' : 'gVL', ks = k.replace(/(pos|neg)$/, ''), ky = k;
      const v1 = C.mO * c1.ll[ky][i] + (p1 ? p1[ky][i] : 0), v2 = C.mO * c2.ll[ky][i] + (p2 ? p2[ky][i] : 0), pc = C.pick[ky][i];
      w.add({ id: `case.${lab}`, label: `RIDOT BDM 3.4.1.1.1, the more severe live-load case: ${sym} at x = ${n2(x[i])} ft (case ${pc} governs)`, sym: `m${ks === 'M' ? 'M' : 'V'}_{LL+IM} + ${ks === 'M' ? 'M' : 'V'}_{PL}`,
        eq: `\\${/neg$/.test(k) ? 'min' : 'max'}(m\\,g_{1}${ks === 'M' ? 'M' : 'V'}_{HL93},\\ m\\,g_{2}${ks === 'M' ? 'M' : 'V'}_{HL93} + ${ks === 'M' ? 'M' : 'V'}_{PL,2})`,
        sub: `\\${/neg$/.test(k) ? 'min' : 'max'}(${n2(C.mO)}(${St().n(c1.ll[gk][i], 4)})(${n1(c1.ll[ky][i] / (c1.ll[gk][i] || 1))}),\\ ${n2(C.mO)}(${St().n(c2.ll[gk][i], 4)})(${n1(c2.ll[ky][i] / (c2.ll[gk][i] || 1))}) + ${p2 ? `(${n1(p2[ky][i])})` : '0'})`,
        value: pc === 2 ? v2 : v1, unit: ks === 'M' ? kft : kip, d: ks === 'M' ? 1 : 2, ref: `${C.cite}; ${ED} Art. 3.6.1.6, Table 3.4.1-1`,
        note: `Case 1 (lanes between the barriers, N_L = ${C.NL[0]}, no pedestrian load): ${n1(v1)}; case 2 (curb to curb, N_L = ${C.NL[1]}, pedestrian load): ${n1(v2)}. Both cases take γ_LL on LL+IM and on PL with m = ${n2(C.mO)} on LL+IM only (Strength I and Service II alike), so the larger factored live load is the more severe case for every limit state that uses it. The values used at this station: those of case ${pc}.` }); };
    if (C) { (C.steps || []).forEach(q => w.add({ ...q, id: q.id.replace(/^xs\.case\./, 'case.') }));
      w.add({ id: 'case.g', label: `This girder's distribution factors in each case (span 1; worked on the Loads & LLDF tab, case 1 and case 2)`, sym: 'g_{M},\\ g_{V},\\ g_{\\Delta}', eq: '',
        sub: `\\text{case 1: } ${St().n(C.dfs[0].spans[0].gM, 4)},\\ ${St().n(C.dfs[0].spans[0].gV, 4)},\\ ${St().n(C.dfs[0].spans[0].gDef, 4)};\\ \\text{case 2: } ${St().n(C.dfs[1].spans[0].gM, 4)},\\ ${St().n(C.dfs[1].spans[0].gV, 4)},\\ ${St().n(C.dfs[1].spans[0].gDef, 4)}`,
        value: C.PL[1], unit: 'klf', d: 4, ref: `${C.cite}; ${ED} Art. 4.6.2.2`, note: `Value: w_PL of this girder in case 2 (case 1: 0). Stations where case 2 governs (of ${C.N}): M+ ${C.n2.Mpos}, M− ${C.n2.Mneg}, V+ ${C.n2.VRpos}, V− ${C.n2.VRneg}; fatigue M ${C.n2['fat.Mpos']}; reactions ${C.n2.R}.` }); }
    for (let k = 0; k < R.spans.length; k++) {
      const a = R.supIdx[k], b = R.supIdx[k + 1]; let im = a; for (let i = a; i <= b; i++) if (R.st.DC1.M[i] > R.st.DC1.M[im]) im = i;
      w.add({ id: `M.DC1.s${k + 1}`, label: `Largest DC1 moment, span ${k + 1}, at x = ${n2(x[im])} ft`, sym: 'M_{DC1}', eq: 'M_{steel} + M_{wet}', sub: `${n1(R.st.DC1steel.M[im])} + ${n1(R.st.DC1wet.M[im])}`, value: R.st.DC1.M[im], unit: kft, d: 1, ref: `${ED} Art. 4.5.2.2, 4.6.2`, note: 'Stiffness method on I_s (shared beam engine).' });
      if (R.ll) { let ip = a; for (let i = a; i <= b; i++) if (R.ll.Mpos[i] > R.ll.Mpos[ip]) ip = i;
        cs(`M.s${k + 1}`, 'Mpos', ip, `largest positive moment, span ${k + 1}`);   // RCURB
        w.add({ id: `M.LL.s${k + 1}`, label: `Largest LL+IM moment, span ${k + 1}, at x = ${n2(x[ip])} ft`, sym: 'M_{LL+IM}', eq: 'g_{M}\\,M_{HL93}', sub: `${n3(R.ll.gM[ip])}(${n1(R.ll.perLane.Mmax[ip])})`, value: R.ll.Mpos[ip], unit: kft, d: 1,
          ref: `${ED} Art. 3.6.1.3.1, 3.6.2.1, 4.6.2.2`, note: `Per lane: design truck (rear spacing 14–30 ft) or tandem, with IM ${S.im} %, + lane 0.64 klf without IM.` }); }
      if (R.pl) { let ip = a; for (let i = a; i <= b; i++) if (R.pl.Mpos[i] > R.pl.Mpos[ip]) ip = i;
        w.add({ id: `M.PL.s${k + 1}`, label: `Largest pedestrian load moment, span ${k + 1}, at x = ${n2(x[ip])} ft`, sym: 'M_{PL}', eq: 'w_{PL}\\,A^{+}', sub: `${St().n(R.pl.w, 4)}(${n1(R.pl.Mpos[ip] / R.pl.w)})`, value: R.pl.Mpos[ip], unit: kft, d: 1,
          ref: `${ED} Art. 3.6.1.6`, note: 'A⁺: the positive area of the moment influence line (ft²; live-load stiffness). w_PL is this girder\'s share of the sidewalk load (Loads & LLDF): no distribution factor, no IM. Added to LL+IM once in every module (Strength I, Service I and II; not fatigue, deck placement or the LL deflection).' }); }
    }
    for (let k = 1; k < R.spans.length; k++) { const i = R.supIdx[k];
      w.add({ id: `M.perm.p${k}`, label: `Permanent-load moments at pier ${k} (x = ${n2(x[i])} ft)`, sym: 'M_{DC1} + M_{DC2} + M_{DW}', eq: '', sub: `${n1(R.st.DC1.M[i])} + ${n1(R.st.DC2.M[i])} + ${n1(R.st.DW.M[i])}`, value: R.st.DC1.M[i] + R.st.DC2.M[i] + R.st.DW.M[i], unit: kft, d: 1, ref: `${ED} Art. 4.6.2` });
      cs(`M.p${k}`, 'Mneg', i, `negative moment at pier ${k}`);   // RCURB
      if (R.ll) w.add({ id: `M.LL.p${k}`, label: `Negative LL+IM moment at pier ${k}`, sym: 'M_{LL+IM}^{-}', eq: 'g_{M}\\,M_{HL93}^{-}', sub: `${n3((R.ll.gMn || R.ll.gM)[i])}(${n1(R.ll.perLane.Mmin[i])})`, value: R.ll.Mneg[i], unit: kft, d: 1,
        ref: `${ED} Art. 3.6.1.3.1, 4.6.2.2`, note: R.ll.perLane.twoM[i] ? 'Includes 90 % of two design trucks (headway ≥ 50 ft) + 90 % of the lane load (negative-moment influence line).' : '' });
      if (R.pl) w.add({ id: `M.PL.p${k}`, label: `Negative pedestrian load moment at pier ${k}`, sym: 'M_{PL}^{-}', eq: 'w_{PL}\\,A^{-}', sub: `${St().n(R.pl.w, 4)}(${n1(R.pl.Mneg[i] / R.pl.w)})`, value: R.pl.Mneg[i], unit: kft, d: 1,
        ref: `${ED} Art. 3.6.1.6`, note: 'A⁻: the negative area of the moment influence line (ft²; live-load stiffness): the sidewalk loaded where it adds to the negative moment.' });
      if (R.pl && R.ll) w.add({ id: `M.LLPL.p${k}`, label: `Negative LL+IM + PL moment at pier ${k} (used by the modules)`, sym: 'M_{LL+IM+PL}^{-}', eq: 'M_{LL+IM}^{-} + M_{PL}^{-}', sub: `${n1(R.ll.Mneg[i])} + (${n1(R.pl.Mneg[i])})`, value: R.ll.Mneg[i] + R.pl.Mneg[i], unit: kft, d: 1,
        ref: `${ED} Art. 3.6.1.6, Table 3.4.1-1`, note: 'The pedestrian load acts with the vehicular live load (3.6.1.6) and takes its load factor; the owner multiplier m is not applied to it (GirderDetail GD45).' }); }
    if (C && R.ll) R.supIdx.forEach((i, k) => { const end = k === R.supIdx.length - 1; cs(`V.${k}`, end ? 'VLneg' : 'VRpos', i, `shear ${end ? 'just left of' : 'just right of'} support ${k + 1}`); });   // RCURB
    if (R.llR) R.llR.forEach(r => w.add({ id: `R.LL.${r.k}`, label: `LL+IM reaction, support ${r.k + 1}`, sym: 'R_{LL+IM}', eq: 'g_{V}\\,R_{HL93}', sub: `${n3(r.gV)}(${n2(r.perLane.max)})`, value: r.max, unit: kip, d: 2,
      ref: `${ED} Art. 3.6.1.3.1, 4.6.2.2.3a`, note: (r.two ? '90 % of two trucks + lane governs (interior support). ' : '') + 'g_V = the larger of the adjacent spans.' }));
    // N3 (2026-11-23): the shear skew correction tapered along the girder (4.6.2.2.3c): the factor at a station, shown at each span's quarter point
    if (R.skV && R.skV.on && R.ll && R.fat) R.skV.spans.forEach(q => { const k = q.k, a = R.sup[k], Ls = R.spans[k], D = R.df.spans[k]; let i = R.supIdx[k]; for (let j = R.supIdx[k]; j <= R.supIdx[k + 1]; j++) if (Math.abs(x[j] - (a + Ls / 4)) < Math.abs(x[i] - (a + Ls / 4))) i = j;
      const xp = x[i] - a, base = `${ED} Art. 4.6.2.2.3c`, why = 'The article applies the correction between the support at the obtuse corner and mid-span and permits decreasing it linearly to 1.0 at mid-span, whatever the end condition; here it is full at both supports of the span (reactions and bearing stiffeners unchanged).';
      if (q.rV != null && q.rV > 1) {
        w.add({ id: `gVx.s${k + 1}`, label: `Shear distribution factor at x = ${n2(x[i])} ft (span ${k + 1}, ${n2(xp)} ft from its support): skew correction tapered to 1.0 at mid-span`, sym: 'g_{V}(x)', eq: 'g_{V}\\,\\frac{1 + (r_{V} - 1)\\left(1 - \\frac{x}{L/2}\\right)}{r_{V}}',
          sub: `${n4(D.gV)}\\,\\frac{1 + (${n4(q.rV)} - 1)\\left(1 - \\frac{${n2(xp)}}{${n2(Ls)}/2}\\right)}{${n4(q.rV)}}`, value: R.ll.gVR[i], unit: '', d: 4, ref: base,
          note: `g_V = ${n4(D.gV)} contains the skew correction r_V = ${n4(q.rV)} (Loads & LLDF tab). r_V(x): ${n4(q.rV)} at the support, ${n4(1 + (q.rV - 1) / 2)} at the quarter point, 1.0000 at mid-span; g_V(x): ${n4(D.gV)} at the support, ${n4(D.gV / q.rV)} at mid-span. ${why} Every station's LL+IM shear (shear checks, factored diagrams, splices, rating) uses g_V(x).` });
        w.add({ id: `gVx.V.s${k + 1}`, label: `LL+IM shear at x = ${n2(x[i])} ft with the tapered skew correction`, sym: 'V_{LL+IM}', eq: 'g_{V}(x)\\,V_{HL93}', sub: `${n4(R.ll.gVR[i])}(${n2(R.ll.perLane.VRmax[i])})`, value: R.ll.VRpos[i], unit: kip, d: 2, ref: `${ED} Art. 3.6.1.3.1, 4.6.2.2.3c`,
          note: `With the correction over the whole span: ${n4(D.gV)}(${n2(R.ll.perLane.VRmax[i])}) = ${n2(D.gV * R.ll.perLane.VRmax[i])} kip.` }); }
      if (q.rVf != null && q.rVf > 1) { const rg = R.fat.perLane.VRmax[i] - R.fat.perLane.VRmin[i];
        w.add({ id: `gVx.fat.s${k + 1}`, label: `Fatigue shear range at x = ${n2(x[i])} ft with the tapered skew correction (shear connectors, V_f)`, sym: 'V_{f}', eq: 'g_{fat,V}\\,\\frac{1 + (r_{V} - 1)\\left(1 - \\frac{x}{L/2}\\right)}{r_{V}}\\,(V^{+} - V^{-})',
          sub: `${n4(D.fatV)}\\,\\frac{1 + (${n4(q.rVf)} - 1)\\left(1 - \\frac{${n2(xp)}}{${n2(Ls)}/2}\\right)}{${n4(q.rVf)}}\\,(${n2(R.fat.perLane.VRmax[i])} - (${n2(R.fat.perLane.VRmin[i])}))`, value: R.fat.VRpos[i] - R.fat.VRneg[i], unit: kip, d: 2, ref: `${ED} Art. 3.6.1.4, 4.6.2.2.3c`,
          note: `g_fat,V(x) = ${n4(R.fat.gVR[i])}. With the correction over the whole span: ${n4(D.fatV)}(${n2(rg)}) = ${n2(D.fatV * rg)} kip. Unfactored fatigue truck with IM, per girder.` }); }
      if (q.rV == null || q.rVf == null) w.add({ id: `gVx.na.s${k + 1}`, label: `Span ${k + 1}: the tapered skew correction is not applied to an entered, pulled or hand-off shear factor`, sym: 'g_{V}(x)', eq: 'g_{V}', sub: '', value: D.gV, unit: '', d: 4, ref: base,
        note: 'The skew correction contained in an entered factor is not known, so the factor is used over the whole span (the conservative reading).' }); });
    if (R.pl) R.pl.R.forEach(r => w.add({ id: `R.PL.${r.k}`, label: `Pedestrian load reaction, support ${r.k + 1}`, sym: 'R_{PL}', eq: 'w_{PL}\\,A^{+}', sub: `${St().n(R.pl.w, 4)}(${n2(r.max / R.pl.w)})`, value: r.max, unit: kip, d: 2,
      ref: `${ED} Art. 3.6.1.6`, note: 'A⁺: the positive area of the reaction influence line (ft). Added to R_LL+IM in the bearing checks.' }));
    if (R.lld) R.lld.forEach(q => { const O = q.own;
      w.add({ id: `defl.lim${q.k + 1}`, label: `LL deflection limit, span ${q.k + 1}${O ? ` (${O.cite}, mandatory)` : ''}`, sym: '\\Delta_{lim}', eq: `\\frac{12L}{${q.ratio}}`, sub: `\\frac{12(${n2(q.L)})}{${q.ratio}}`, value: q.lim, unit: 'in', d: 3,
        ref: O ? `${O.cite}; ${ED} Art. 2.5.2.6.2` : `${ED} Art. 2.5.2.6.2`, note: O ? `${O.cite}: ${O.rule.text}. Sidewalk or pedestrians: ${O.sw ? 'yes' : 'no'} (${O.swHow}), so L/${O.req}${O.uR > O.req ? `; the entered L/${O.uR} is stricter and is used` : ''}.${O.rep ? ` Applied to the typical interior beam only: this plate girder takes cross-section girder G${O.line + 1} (exterior), so it is reported, not checked.` : ''}` : 'Optional criterion (2.5.2.6.2): the L/… entered under Analysis settings.' });
      if (q.limP) w.add({ id: `defl.pref${q.k + 1}`, label: `LL deflection, preferred limit, span ${q.k + 1} (${O.cite})`, sym: '\\Delta_{pref}', eq: `\\frac{12L}{${q.pref}}`, sub: `\\frac{12(${n2(q.L)})}{${q.pref}}`, value: q.limP, unit: 'in', d: 3,
        ref: `${O.cite}`, ok: q.status !== 'warn', note: q.status === 'warn' ? 'Exceeded: a warning (preferably L/' + q.pref + ').' : '' });
      // N4 (2026-11-23): the bridge stiffness shared equally (2.5.2.6.2) and the parts of g_Δ
      if (q.EI) { const B = q.EI, many = B.parts.length > 1, big = v => Math.round(v).toLocaleString('en-US');
        w.add({ id: `defl.EI${q.k + 1}`, label: `Bridge stiffness shared equally by the ${B.nb} girders, span ${q.k + 1}, at x = ${n2(q.x)} ft`, sym: 'EI_{avg}', eq: '\\frac{\\sum_{j} E I_{n,j}}{N_{b}}',
          sub: `\\frac{${g0(B.E)}(${B.parts.map(t => `${t.n}(${g0(t.I)})`).join(' + ')})}{${B.nb}}`, value: B.E * B.Iavg, unit: 'kip-in^{2}', d: 0, ref: `${ED} Art. 2.5.2.6.2`,
          note: `ΣEI = ${big(B.E * B.sumI)} kip-in² (${B.parts.map(t => `${t.n} × ${t.label}: I_n = ${big(t.I)} in⁴ on ${t.lines.map(j => 'G' + (j + 1)).join(', ')}`).join('; ')}); I_avg = ${big(B.Iavg)} in⁴. This girder's own I_n here: ${big(B.Iown)} in⁴${many ? '' : ' (every girder line has this girder\'s plates: I_avg = I_n)'}. All design lanes loaded and all girders deflecting equally: the deflection is that of one lane on a girder of the average stiffness at every station (short-term composite I_n of each girder line, I_cr in the cracked zones), × g_Δ. The moments, shears and reactions keep this girder's own stiffness.` }); }
      if (q.dP) w.add({ id: `defl.g${q.k + 1}`, label: `Deflection distribution factor, span ${q.k + 1}: all lanes loaded, all girders equal (worked on the Loads & LLDF tab)${q.cs ? `; RIDOT BDM 3.4.1.1.1 case ${q.cs}, the larger: g_Δ = ${St().n(q.gD12[0], 4)} (case 1), ${St().n(q.gD12[1], 4)} (case 2)` : ''}`, sym: 'g_{\\Delta}', eq: '\\frac{m N_{L}}{N_{b}}', sub: `\\frac{${n2(q.dP.m)}(${q.dP.NL})}{${q.dP.Nb}}`, value: q.gD, unit: '', d: 4, ref: `${ED} Art. 2.5.2.6.2, Table 3.6.1.1.2-1`,
        note: 'N_L design lanes, m the multiple presence factor for N_L lanes, N_b girders.' });
      w.add({ id: `defl.LL${q.k + 1}`, label: `LL deflection, span ${q.k + 1}, at x = ${n2(q.x)} ft`, sym: '\\Delta_{LL}', eq: 'g_{\\Delta}\\max(\\Delta_{truck}(1 + IM),\\ 0.25\\Delta_{truck}(1 + IM) + \\Delta_{lane})', sub: `${n3(q.gD)}(${n3(q.perLane)})`, value: q.d, unit: 'in', d: 3,
        ref: `${ED} Art. 2.5.2.6.2, 3.6.1.3.2`, ok: q.status === 'na' ? undefined : q.ok, note: `${q.ok ? '≤' : '>'} Δ_lim = ${n3(q.lim)} in${q.status === 'na' ? ' (reported, not checked: exterior girder under the owner rule)' : ''}. Governing per-lane case: ${q.case || '—'}. All lanes loaded, all girders deflecting equally (g_Δ)${q.EI ? `; per lane on a girder of the bridge-average stiffness EI_avg (step an.defl.EI${q.k + 1})` : ''}. Truck axles that do not add to the deflection are neglected (3.6.1.3.1).` }); });
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
      if (!(S.im >= 0) || !(S.imf >= 0) || !(S.deflLimit > 0) || !['none', '15', 'dl'].includes(S.crack)) why.push('The analysis settings are not valid (Loads tab).');
      const mod = g.loads && g.df ? null : moduleOf(P, gi), LD = loadsOf(P, g, mod), DF = dfOf(P, g, L.length, mod);
      if (LD.source === 'none entered') why.push('No dead loads for this girder (Loads & LLDF, or entered on the Loads tab).');
      if (DF.manual && /^none entered/.test(DF.src)) why.push('No live-load distribution factors for this girder (Loads & LLDF, or entered on the Loads tab).');
    }
    const v = { ok: !why.length, why };
    if (k) readyMemo = { k, v };
    return v;
  }

  /* llPL(R): LL+IM + PL per girder at the stations, the pedestrian load counted once (added 2026-10-30, sb-ped-owner PR). Every module that
     takes this app's analysis builds its LL+IM from here (ui/rating.js, ui/shear.js, ui/fatigue.js, ui/welds.js fromAnalysis; engine/splices.js
     arraysFromAnalysis), and R.pl gives the pedestrian part (M_PL, V_PL) so that the owner multiplier m is kept off it (GD45).
     Returns { Mpos, Mneg, VRpos, VRneg, VLpos, VLneg, R: [{ max, min }], pl: R.pl } or null (no live load). */
  /* rateView(R) (RCURB Q6, engineer's answer 2026-11-26; CLAUDE.md §4): the analysis as the load rating takes it. With the RIDOT BDM 3.4.1.1.1
     two cases (R.cases), where case 2 governs the HL-93 design effect the rating uses case 1's distribution factors (the lanes over the
     mountable sidewalk, no pedestrian load), and case 1 already governs elsewhere: so the rating takes case 1 at every station: its LL+IM
     (ll, with gM, gVR, gVL), its fatigue-truck factors (fat), its reactions (llR), and no pedestrian load (pl null). Before: the case taken
     by the design envelope at each station, with case 2's w_PL where case 2 governed. Without the two cases: R itself (unchanged). */
  function rateView(R) {
    const C = R && R.cases; if (!C || !C.c || !C.c[0]) return R;
    const c1 = C.c[0]; return { ...R, ll: c1.ll, fat: c1.fat, llR: c1.llR, pl: null, rateCase: { case: 1, cite: C.cite, n2: C.n2 } };
  }
  function llPL(R) {
    if (!R || !R.ll) return null; const L = R.ll, Q = R.pl, add = k => L[k].map((v, i) => v + (Q ? Q[k][i] : 0));
    return { Mpos: add('Mpos'), Mneg: add('Mneg'), VRpos: add('VRpos'), VRneg: add('VRneg'), VLpos: add('VLpos'), VLneg: add('VLneg'),
      R: (R.llR || []).map((r, k) => ({ max: r.max + (Q ? Q.R[k].max : 0), min: r.min + (Q ? Q.R[k].min : 0) })), pl: Q };
  }

  /* applicability(P) (SA4, 2026-11-19; ported from "Steel Bridge Design.html" check SA4, anchor `// SA4: is a line-girder analysis with
     distribution factors permitted for this bridge?`): the limits of this app's line-girder analysis with the approximate distribution
     factors of 4.6.2.2, AASHTO LRFD 10th Ed. Items (level):
       skew θ_max of the bearing lines > 60° (outside the skew corrections of Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1): FAIL, refined analysis required;
       distribution factor equations outside their range of applicability (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.2d-1; SBDLldf.ranges of each
         girder type): FAIL (engineer's level, 2026-11-19; the old app's SA4 had a warning here: approved by the engineer 2026-11-21);
       skew index per span I_S = w_g tanθ / L_s (Eq. 4.6.3.3.2-2, p. 4-72; w_g = out-to-out width between the exterior girders, Σ bays; θ the larger
         skew of the span's two bearing lines; L_s the span) > 0.30: NOTE (SBIS, engineer 2026-11-19; was WARNING): 4.6.3.3.2 governs 2D grid and
         plate-and-eccentric-beam models (above 0.30 such a model must include the girders' warping rigidity) and sets no limit on a line-girder
         analysis; the note says that skew interaction is significant and that cross-frame forces and differential deflections are not computed here;
       horizontal curvature (4.6.1.2.4): this app models straight girders only (no radius input): not applicable;
       fewer than four girders: WARNING (as the old SA4);
       θ_max > 20°: NOTE listing what a line-girder analysis cannot compute (C6.10.1: cross-frame live-load forces, flange lateral bending;
         obtuse-corner reaction increase and acute-corner uplift; girder end rotations).
     A FAIL counts in the Summary verdict (as a failed SA4 item failed the old app's Structural analysis check); WARNING and NOTE never do.
     Returns { level: 'fail' | 'warn' | 'note' | 'ok', items: [{ id, level, title, val, msg, step }], th, wg, Is: [{ k, Ls, th, Is }], steps }. */
  function applicability(P) {
    const xs = P.xs || {}, nb = Math.round(+xs.nb || 0), bays = (xs.bays || []).map(Number), S0 = +xs.S || 0, n2 = v => St().n(v, 2), n3 = v => St().n(v, 3);
    const wg = bays.length === nb - 1 && bays.length && bays.every(v => v > 0) ? bays.reduce((a, b) => a + b, 0) : Math.max(nb - 1, 0) * S0;
    const spans = ((P.spans || {}).lengths || []).map(Number), sk = (xs.skews || []).map(v => Math.abs(+v || 0)), th = sk.length ? Math.max(...sk) : 0;
    const w = St().work('ap'), items = [], E = 'AASHTO LRFD 10th Ed.';
    const it = (id, level, title, val, msg, step) => items.push({ id, level, title, val, msg, step: step || null });
    w.add({ id: 'th', label: 'Largest bearing-line skew', sym: '\\theta_{max}', eq: '\\max|\\theta_{k}|', sub: sk.map(n2).join(',\\ ') || '0', value: th, unit: 'deg', d: 2, ref: `${E} Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1` });
    it('skew60', th > 60 + 1e-9 ? 'fail' : 'ok', 'Skew for the skew corrections of the distribution factors', `θ_max = ${n2(th)}°`, th > 60 + 1e-9 ? 'θ > 60°: outside the skew corrections of Tables 4.6.2.2.2e-1 and 4.6.2.2.3c-1: refined analysis required (4.6.3).' : 'θ ≤ 60°: the skew corrections apply.', 'ap.th');
    let out = null; try { const LD = window.SBDLoads, LL = window.SBDLldf; if (LD && LL) { out = []; (P.girders || []).forEach((g, gi) => { const { b, p } = LD.fromModel(P, { girder: gi }), R = LD.compute(b, p);
      if (!R.errors.length) LL.ranges(R, b.tsDeck, b.nb).forEach(q => out.push({ ...q, g: g.label || g.id })); }); } } catch (e) { out = null; }
    if (out) { const bad = out.filter(q => !q.ok); it('df', bad.length ? 'fail' : 'ok', 'Distribution factor equations, range of applicability (4.6.2.2)', bad.length ? `${bad.length} item(s) outside` : 'within range',
      bad.length ? `Outside Tables 4.6.2.2.2b-1 / 4.6.2.2.3a-1 / 4.6.2.2.2d-1: ${[...new Set(bad.map(q => `${q.g} ${q.region}: ${q.name} = ${n2(q.value)} ${q.unit || ''} (range ${q.lo} to ${q.hi})`.replace(/ +\(/, ' (')))].join('; ')}. Refined analysis required (or the lever rule where the specification permits it); see the Loads & LLDF tab.` : 'The approximate equations apply (Loads & LLDF tab).'); }
    w.add({ id: 'wg', label: 'Width between the exterior girders (out to out of the girder lines)', sym: 'w_{g}', eq: bays.length === nb - 1 && bays.length ? '\\sum S_{j}' : '(N_{b} - 1)S', sub: bays.length === nb - 1 && bays.length ? bays.map(n2).join(' + ') : `(${nb} - 1)(${n2(S0)})`, value: wg, unit: 'ft', d: 2, ref: `${E} Eq. 4.6.3.3.2-2 (w_g of I_S)` });
    const Is = spans.map((Ls, k) => { const t = Math.max(sk[k] || 0, sk[k + 1] || 0), v = Ls > 0 ? wg * Math.tan(t * Math.PI / 180) / Ls : 0;
      // SBIS (engineer 2026-11-19; AASHTO LRFD 10th Ed. Art. 4.6.3.3.2, p. 4-72, C4.6.3.3.2): I_S > 0.30 is a NOTE, not a WARNING (4.6.3.3.2 sets what a
      // 2D grid or plate-and-eccentric-beam model must include, not a limit on a line-girder analysis). Before: eq '… \le 0.30', ok: v <= 0.30, note
      // 'Above 0.30: a 2D grid analysis must include the girders' warping rigidity (4.6.3.3.2); line-girder results are approximate.', item level 'warn',
      // msg 'I_S > 0.30: line-girder results approximate; a 2D grid (with warping, 4.6.3.3.2) or 3D analysis recommended.'
      const big = v > 0.30 + 1e-9, msg = 'I_S > 0.30. Not a code limit on line-girder analysis. Skew interaction is significant: cross-frame forces and differential deflections are not captured by a line-girder analysis. If a 2D grid or plate model is used, it must include the girders\' warping rigidity (4.6.3.3.2; C4.6.3.3.2).';
      w.add({ id: 'Is' + k, label: `Skew index, span ${k + 1} (θ the larger skew of its bearing lines)`, sym: 'I_{S}', eq: '\\frac{w_{g}\\tan\\theta}{L_{s}}', sub: `\\frac{${n2(wg)}\\tan(${n2(t)}^{\\circ})}{${n2(Ls)}}`, value: v, unit: '', d: 3, ref: `${E} Eq. 4.6.3.3.2-2`,
        note: big ? msg : 'At most 0.30.' });
      it('Is' + k, big ? 'note' : 'ok', `Skew index, span ${k + 1}`, `I_S = ${n3(v)}`, big ? msg : 'I_S ≤ 0.30.', 'ap.Is' + k);
      return { k, Ls, th: t, Is: v }; });
    it('curv', 'ok', 'Horizontal curvature (4.6.1.2.4)', 'straight girders', 'This app models straight girders only: curvature not applicable.');   // SBIS: was '… (4.6.1.2.4; connectivity index I_C, Eq. 4.6.3.3.2-1)', '… I_C not applicable.'
    it('nb', nb >= 4 ? 'ok' : 'warn', 'Number of girders', `N_b = ${nb}`, nb >= 4 ? 'N_b ≥ 4.' : 'Fewer than four girders: see the distribution factor provisions for N_b = 3 and the lever rule (4.6.2.2).');
    if (th > 20 + 1e-9) it('sk20', 'note', 'Skew effects a line-girder analysis cannot compute', `θ_max = ${n2(th)}° > 20°`, 'Not computed here: cross-frame live-load forces (enter them from a refined analysis on the Cross-frames tab); flange lateral bending (estimated per C6.10.1 from the cross-frame layout); the reaction increase at obtuse corners and possible uplift at acute corners; girder end rotations about the skewed bearing lines.', 'ap.th');
    const lv = items.some(q => q.level === 'fail') ? 'fail' : items.some(q => q.level === 'warn') ? 'warn' : items.some(q => q.level === 'note') ? 'note' : 'ok';
    return { level: lv, items, th, wg, Is, steps: w.steps };
  }

  window.SBDAnalysis = { skewTaper, plateOfLine, applicability, DEF, STEEL_PLF, grid, settings, lineOf, deflOwner, moduleOf, loadsOf, allowFor, allowOf, dfOf, deadOverride, dfOverride, clOf, fmOf, sbOf, analyzeGirder, pourRegions, ready, llPL, rateView };
})();
