/* apps/steel-bridge/ui/rating.js — the "Rating" output tab (window.SBDRatingUI): the LRFR design-load rating (HL-93 Inventory and
   Operating, Strength I flexure and shear, Service II) from engine/rating.js, with the condition and system factors as its inputs.
   Classic script; needs SharedSteps, SharedUnits, SBDModel, SBDOwners, SBDSections, SBDFlexure, SBDShear, SBDStiffeners, SBDShearUI,
   SBDAnalysis, SBDRating (SBDFatigue optional: the fatigue RF of the owner's target).

   Inputs (saved in the project, P.rating): φ_c (MBE Table 6A.4.2.3-1) and φ_s (Table 6A.4.2.4-1).
   Demands, as the Fatigue & studs tab: either
     - "This app's analysis" (default): engine/analysis.js for the selected girder, put in the shape of a hand-off (every analysis
       station), with this project's plates, deck, materials, cross-frame spacing and stiffener layout; or
     - a hand-off file (schema stgirder-external-demands, GirderDetail → ST-Girder): its stations, plates and deck; the project's
       stiffener layout (as the Shear & stiffeners tab).
   Capacities: the Flexure tab's locations and the Shear tab's stations (SBDShearUI.build: V_n with the stiffener layout). Since
   2026-10-30 (paths PR, SB2-W1, SB2-W2) the flexure is ui/flexure.js build() itself (Appendix A6 where permitted), so its brace points
   (the Framing &amp; bracing tab) and f_ℓ (entered on the Flexure tab, else from skew, C6.10.1: engine/framing.js design) are the Flexure tab's on
   both sources; before, this tab built its own: the stiffener layout's cross-frames and f_ℓ = 0 (a file: its own spacing, f_ℓ = 0).
   Needs SBDFlexureUI and SBDFraming. The demand choice is saved (P.demandSrc.rt, custom demands PR; a hand-off file is not). "Custom": the
   Flexure and Shear & stiffeners tabs' entered tables (buildCustom).

   Legal-load and permit rating (2026-11-23; engine/rating.js "legal-load and permit rating"): the vehicles ticked on this tab (saved, optional:
   P.rating.veh { on: [keys of shared/vehicles.js], imL, imP (IM percent, blank 33), evG ('legal' | 'fhwa'), permit { key, type, gam, axles, name } })
   are each run on this app's line-girder model (the analysis result's R.vehicle: one run per vehicle, kept with the cached analysis), put in
   the hand-off shape with their distribution factors (fromAnalysis(P, g, { R, ll })) and rated by the same Flexure, Shear and rating code as
   HL-93 (their own flexure build: C_b and the load-dependent capacities follow the vehicle's moments). Only with "This app's analysis", and only
   when build() is asked (ctx.veh true: this tab, the Report and the Summary; Auto design does not). Nothing ticked: no veh field, results as before.
   Needs SharedVehicles (shared/vehicles.js).

   render(host, ctx), ctx = { P, g, changed() }; build(ctx) (tests: ctx.pl gives a payload directly; ctx.src 'analysis'; ctx.veh true: the vehicles). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { src: null, pl: null, plName: '', R: null, key: '', err: '', sel: 0, view: '' };   // view: '' the HL-93 rows, else the key of the legal / permit vehicle whose rows are shown   // src null: the default, this app's analysis (no example here)
  // the saved choice (P.demandSrc.rt, custom demands PR 2026-11-01), else this app's analysis
  const srcOf = P => S.src || (window.SBDCustomDemands && P && window.SBDCustomDemands.srcGet(P, 'rt')) || 'analysis';
  const PHI_C = [[1.00, 'Good or satisfactory (1.00)'], [0.95, 'Fair (0.95)'], [0.85, 'Poor (0.85)']];
  const PHI_S = [[1.00, 'All other girder bridges and slab bridges (1.00)'], [0.85, 'Welded members in two-girder, truss or arch bridges (0.85)'], [0.90, 'Riveted members in two-girder, truss or arch bridges (0.90)'],
    [0.85, 'Three-girder bridges, girder spacing ≤ 6 ft (0.85)'], [0.95, 'Four-girder bridges, girder spacing ≤ 4 ft (0.95)'], [0.85, 'Floorbeams > 12 ft apart, noncontinuous stringers (0.85)'], [1.00, 'Redundant stringer subsystems between floorbeams (1.00)']];
  // SB2-R2: −∞ (amplification undefined, 6.10.1.6) and NaN (an error) are shown and fail; +∞ = no live-load effect (—)
  const rfTxt = v => v === -Infinity ? '−∞ (NG: f_bu ≥ F_cr, amplification undefined (6.10.1.6))' : Number.isNaN(v) ? 'error: RF is NaN' : !isFinite(v) ? '—' : fmt(v, 2),
    cls = v => v === -Infinity || Number.isNaN(v) ? 'fx-ng' : !isFinite(v) ? '' : v < 1 - 1e-9 ? 'fx-ng' : v < 1.1 ? 'fx-hi' : 'fx-ok';

  function ensure(P) { if (!P.rating) P.rating = window.SBDModel.defaultRating(); return P.rating; }

  /* fromAnalysis(P, gi): the analysis of girder gi as a hand-off-shaped object: per station the moments, and the shears of the side of the
     station with the larger permanent shear (both sides differ only at a support), LL+IM shear envelopes the larger of the two sides
     (positive and negative); plates; deck, materials, skews and the cross-frame spacing of the project. Shears in this app's sign
     (engine/analysis.js: positive at the left end of a span); shearCases uses each direction, so the sign convention does not matter. */
  function fromAnalysis(P, gi, over) {
    const AN = window.SBDAnalysis, M = window.SBDModel;
    if (!AN) return { err: 'The analysis module is not loaded.' };
    let R; if (over && over.R) R = over.R; else try { R = AN.analyzeGirder(P, gi); } catch (e) { return { err: 'Analysis: ' + (e && e.message) }; }   // over (2026-11-23): { R, ll }: the same analysis with a rating vehicle's LL+IM per girder in place of HL-93
    if (R.errors && R.errors.length) return { err: 'Analysis: ' + R.errors.join(' ') };
    if (!R.ll) return { err: 'Analysis: no live load results.' };
    // LL+IM with the pedestrian load added once (SBDAnalysis.llPL; pedestrianInLL true, M_PL / V_PL its part, as GirderDetail's hand-off; sb-ped-owner PR)
    const g = P.girders[gi], st = R.st, ll = over && over.ll ? (AN.llPL ? AN.llPL({ ll: over.ll, pl: R.pl }) : over.ll) : AN.llPL ? AN.llPL(R) : R.ll, q = R.pl, f = R.fat, Mof = (o, i) => (o ? o.M[i] : 0);
    const stations = R.x.map((x, i) => {
      const perm = k => (st.DC1[k][i] + st.DC2[k][i] + st.DW[k][i]), side = Math.abs(perm('VL')) > Math.abs(perm('VR')) ? 'VL' : 'VR', V = (o) => (o ? o[side][i] : 0);
      return { x, M_DC1: st.DC1.M[i], M_DC2: st.DC2.M[i], M_DW: st.DW.M[i], M_LLpos: ll.Mpos[i], M_LLneg: ll.Mneg[i], M_UT: Mof(st.UT, i), M_UF: Mof(st.UF, i),
        M_FATpos: f ? f.Mpos[i] : 0, M_FATneg: f ? f.Mneg[i] : 0, V_DC1: V(st.DC1), V_DC2: V(st.DC2), V_DW: V(st.DW), V_UT: V(st.UT), V_UF: V(st.UF),
        V_LLpos: Math.max(ll.VRpos[i], ll.VLpos[i]), V_LLneg: Math.min(ll.VRneg[i], ll.VLneg[i]),
        V_FATpos: f ? Math.max(f.VRpos[i], f.VLpos[i]) : 0, V_FATneg: f ? Math.min(f.VRneg[i], f.VLneg[i]) : 0,
        ...(q ? { M_PLpos: q.Mpos[i], M_PLneg: q.Mneg[i], V_PLpos: Math.max(q.VRpos[i], q.VLpos[i]), V_PLneg: Math.min(q.VRneg[i], q.VLneg[i]) } : {}) }; });
    const zones = g.segments.map(s => ({ startX: s.x0, endX: s.x1, web: { depth: s.D, thickness: s.tw }, topFlange: { width: s.topB, thickness: s.topT }, botFlange: { width: s.botB, thickness: s.botT } }));
    const m = P.materials, d = P.deck, sk = ((P.xs || {}).skews || []).slice();
    const pl = { _schema: 'sbd2-analysis', pedestrianInLL: !!q, stations, member: { supports: R.sup.slice(), spans: R.spans.slice() }, section: { zones },
      ownerRules: { owner: (P.ownerRules || {}).owner || 'AASHTO', haunchInProperties: !R.h0 },
      girderDetail: { label: g.label || g.id, girder: gi + 1, position: g.position, materials: { Fyf: M.GRADES[m.steel.top].Fy, Fyw: M.GRADES[m.steel.web].Fy, fc: m.concrete.fc, wc: m.concrete.wc },
        deck: { ts: d.ts, haunch: d.haunch, beff: g.beff, Ar: (d.rebar.top.A || 0) + (d.rebar.bot.A || 0) }, bracing: { Lb: (P.stiffeners && P.stiffeners.layout.frames.Lb) || 25 },
        skew: { bySupport: sk, max: Math.max(0, ...sk.map(Math.abs)) }, details: {} } };
    return { pl, R };
  }

  /* ---------- calculation ---------- */
  function build(ctx) {
    const P = ctx.P, M = window.SBDModel, OW = window.SBDOwners, FX = window.SBDFlexure, SH = window.SBDShear, RT = window.SBDRating, SB = window.SBDStiffeners, g = ctx.g || 0;
    const rt = ensure(P), src = ctx.src || srcOf(P);
    if (ctx.pl === undefined && src === 'custom') return buildCustom(ctx);
    let pl = ctx.pl !== undefined ? ctx.pl : src === 'file' ? S.pl : null, AR = null;
    if (ctx.pl === undefined && src === 'file' && !pl) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
    if (ctx.pl === undefined && src === 'analysis') { const A = fromAnalysis(P, g); if (A.err) return A; pl = A.pl; AR = A.R; }
    const fromAn = !!AR, own = fromAn ? (P.ownerRules || {}).owner || 'AASHTO' : (pl.ownerRules || {}).owner || 'AASHTO';
    const plR = RT.noDoublePL(pl), sup = (pl.member || {}).supports || [];
    // flexure: the Flexure module itself (ui/flexure.js build; SB2-W1, SB2-W2): its locations (every station), brace points (Framing &amp; bracing tab)
    // and f_ℓ (entered on the Flexure tab, else from skew); with this app's analysis the project's grades, deck and owner rules
    const Gr = window.SBDFlexureUI.build(fromAn ? { P, g, src: 'analysis', an: { pl, R: AR }, method: 'auto' } : { P, g, src: 'file', pl, plName: S.plName || 'hand-off', method: 'auto' });
    if (Gr.err) return { err: 'Flexure: ' + Gr.err };
    const F = { prj: Gr.prj };
    // shear: the Shear tab's stations (V_n with the stiffener layout), demands by direction
    const SHR = window.SBDShearUI.build({ P, g, pl: plR });
    if (SHR.err) return { err: 'Shear: ' + SHR.err };
    const cases = RT.shearCases(pl), ph = RT.phi(rt.phiC, rt.phiS), G = RT.factors(), opt = { G, phi: ph, mat: F.prj.mat };
    const rows = [], cap = new Map();   // cap: rating row -> the capacity location (its worked steps)
    Gr.rows.forEach(r => { RT.flexure(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); RT.service(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); });
    SHR.stations.forEach(r => { const q = RT.shear(r, { ...opt, cases: cases(r.x) }); cap.set(q, r); rows.push(q); });
    // fatigue (owner target only, GS20): 1/ratio of GS17 at every flexure location
    const T = RT.target(own);
    if (T && T.fat && window.SBDFatigue && P.fatigue) { const FA = window.SBDFatigue, set = FA.settings(P.fatigue), spans = sup.slice(1).map((x, k) => x - sup[k]), B = FA.supports({ ok: true, spans, cont: sup.length > 2 });
      if (set.ok) Gr.rows.forEach(r => { const o = FA.flange(r, { set, B, catT: P.fatigue.catT, catB: P.fatigue.catB }); (o.items || []).forEach(it => { if (it.r > 0 && isFinite(it.r)) { const q = RT.fatigue(it, r); cap.set(q, r); rows.push(q); } }); }); }
    const sum = RT.girder(rows, { owner: own });
    const bfl = `L<sub>b</sub>, C<sub>b</sub> ${Gr.frB ? `from the Framing &amp; bracing tab (G${Gr.frB.line + 1}'s bearings and cross-frames)` : fromAn ? "from the stiffener layout's cross-frames (no framing)" : "from the file's cross-frame spacing (not this project's bridge, or no framing)"}; f<sub>ℓ</sub> = ${fmt(Gr.fl, 2)} ksi ${Gr.D && Gr.D.flSrc === 'entered' ? 'as entered on the Flexure tab' : `from skew (C6.10.1; largest support skew ${fmt(Gr.flS.skMax, 1)}°)`}, as on the <a href="#" data-gotab="flex">Flexure tab</a>`;
    const what = fromAn ? `This app's analysis of ${esc(P.girders[g].label || P.girders[g].id)}: ${pl.stations.length} stations, ${sup.length - 1} span(s); the project's plates, deck, materials and stiffener layout; ${bfl}.`
      : `${esc(S.plName || 'hand-off')}: ${pl.stations.length} stations, ${sup.length - 1} span(s), G${esc((pl.girderDetail || {}).girder || '')}; plates, deck and skews from the file, the project's stiffener layout; ${bfl}.${pl.pedestrianInLL === true ? ' The pedestrian load is in its LL+IM (pedestrianInLL): not added again.' : ''}`;
    const out = { rows, sum, cap, ph, G, own, T, what, flex: Gr, shear: SHR, pl };
    if (ctx.veh && vehOn(P)) { const V = fromAn ? buildVeh(P, g, AR, ph, own) : { list: [], err: [], only: true }; if (V) out.veh = V; }   // legal and permit vehicles (2026-11-23): only when asked and ticked
    return out;
  }
  /* ---------- legal-load and permit vehicles (2026-11-23) ---------- */
  const vehOn = P => { const v = (P.rating || {}).veh; return !!v && ((Array.isArray(v.on) && v.on.length > 0) || !!(v.permit && v.permit.key)); };
  const adttOf = P => (P.fatigue && +P.fatigue.ADTT > 0 ? +P.fatigue.ADTT : null);
  /* buildVeh(P, g, AR, ph, own): every chosen vehicle rated on the analysis AR of girder g. Returns { list: [vehicle + { rows, sum, cap, flex, shear,
     pl, gov, rf, by, rated (tons), posting, tgt, ms } | { na } | { err }], err: [], adtt, ms, pedIn } */
  function buildVeh(P, g, AR, ph, own) {
    const RT = window.SBDRating, VS = window.SharedVehicles, t0 = Date.now(), adtt = adttOf(P);
    if (!VS || !RT.vehicleList) return { list: [], err: ['shared/vehicles.js is not loaded.'], adtt, ms: 0 };
    const L = RT.vehicleList(P.rating.veh, VS.build().presets, { adtt }), out = { list: [], err: L.err.slice(), adtt, ms: 0, pedIn: !!AR.pl, dfSrc: AR.df ? AR.df.src : '' };
    const n1 = x => fmt(x, 1), n2 = x => fmt(x, 2), n4 = x => fmt(x, 4), Q = AR.pl, X = AR.x;
    L.list.forEach(v => { const t1 = Date.now();
      try {
        if (!AR.vehicle) { out.list.push({ ...v, err: 'The analysis has no live-load model (R.vehicle).' }); return; }
        if (v.cat === 'lane' && !RT.laneModelNeeded(AR.spans, AR.cont)) { out.list.push({ ...v, na: 'Not applicable to this girder: no span longer than 200 ft and no continuous span (MBE Art. 6A.4.4.2.1a).' }); return; }
        const run = AR.vehicle({ short: v.short, axles: v.axles, udl: v.udl, neglect: v.neglect, multi: v.multi, im: v.im });
        // a permit vehicle: also with the 0.2 klf lane load where MBE 6A.4.5.4.1 asks for it (engine/rating.js permitLane: ADTT above 500 or unknown, not an
        // escorted permit; negative moment and the pier-region shear of a continuous girder, spans over 200 ft)
        const PL = RT.permitLane(v, adtt, AR.spans, AR.cont);
        const runL = PL.on ? AR.vehicle({ short: v.short + ' + 0.2 klf', axles: v.axles, udl: { mode: 'lane', w: 0.2, gap: 0, trunc: false }, neglect: v.neglect, multi: v.multi, im: v.im }) : null;
        const VL = RT.vehicleLL(AR, run, v, runL);
        const A = fromAnalysis(P, g, { R: AR, ll: VL.ll }), pl = A.pl;
        const Gr = window.SBDFlexureUI.build({ P, g, src: 'analysis', an: { pl, R: AR }, method: 'auto' }); if (Gr.err) { out.list.push({ ...v, err: 'Flexure: ' + Gr.err }); return; }
        // Service II of a special permit that mixes with traffic (MBV, 2026-11-23; MBE C6A.6.4.2.2): the design distribution factor, not the one-lane
        // factor of its Strength II check: the same vehicle run × the design factors and a flexure build of its own for the Service II stresses
        let VLs = null, GrS = null;
        if (v.cat === 'permit' && v.dfS && v.dfS !== v.df) { VLs = RT.vehicleLL(AR, run, { ...v, df: v.dfS }, runL);
          GrS = window.SBDFlexureUI.build({ P, g, src: 'analysis', an: { pl: fromAnalysis(P, g, { R: AR, ll: VLs.ll }).pl, R: AR }, method: 'auto' }); if (GrS.err) { out.list.push({ ...v, err: 'Flexure (Service II demands): ' + GrS.err }); return; }
          if (GrS.rows.length !== Gr.rows.length) { out.list.push({ ...v, err: 'Flexure (Service II demands): the locations differ from the Strength II build.' }); return; } }
        const SHR = window.SBDShearUI.build({ P, g, pl: RT.noDoublePL(pl) }); if (SHR.err) { out.list.push({ ...v, err: 'Shear: ' + SHR.err }); return; }
        const cases = RT.shearCases(pl), G = RT.factors(v.G), LLlabel = `${v.short}: live load with dynamic load allowance, per girder`, opt = { G, phi: ph, mat: Gr.prj.mat, lim: v.lim, LLlabel };
        const rows = [], cap = new Map();
        Gr.rows.forEach((r, k) => { RT.flexure(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); const rs = GrS ? GrS.rows[k] : r; RT.service(rs, opt).forEach(q => { cap.set(q, rs); rows.push(q); }); });
        SHR.stations.forEach(r => { const q = RT.shear(r, { ...opt, cases: cases(r.x) }); cap.set(q, r); rows.push(q); });
        // the live-load step of each row: the per-lane effect of the vehicle (IM on the axles), its governing position and the distribution factor
        const dfOne = 'the one-lane distribution factor without the multiple presence factor (g_1 / 1.2: this app\'s fatigue factor; MBE Art. 6A.4.5.4.2b)', dfDes = 'the design distribution factor (the governing of one and of two or more lanes loaded; AASHTO LRFD 10th Ed. Art. 4.6.2.2)';
        const dfT = v.df === 'one' ? dfOne : dfDes, dfTs = VLs ? `${dfDes}, used at Service II for a permit that mixes with traffic (MBE C6A.6.4.2.2; its Strength II check uses the one-lane factor)` : v.cat === 'permit' && v.df === 'one' ? `${dfOne}, also at Service II for the escorted permit (MBE C6A.6.4.2.2)` : dfT;
        const posT = a => !a ? '' : ` Governing case: ${a.lab}${Array.isArray(a.pos) && a.pos.length && !a.lane ? `, axles at x = ${a.pos.map(n2).join(', ')} ft` : ''}.`;
        const imT0 = L => `IM = ${n1(v.im)} % on the axles${(v.udl && v.udl.w > 0) || L ? ', none on the 0.2 klf lane load' : ''} (MBE Art. ${v.cat === 'permit' ? '6A.4.5.5' : '6A.4.4.3'})${L ? '; the 0.2 klf lane load is on top of the permit vehicle (MBE Art. 6A.4.5.4.1: ADTT above 500 or unknown; negative moment and the pier-region shear of a continuous girder, spans over 200 ft)' : ''}`, ngT = v.neglect ? ' Axles that relieve the effect are neglected (as the shared vehicle preset; conservative).' : '';
        const iAt = x => { let b = 0; for (let i = 1; i < X.length; i++) if (Math.abs(X[i] - x) < Math.abs(X[b] - x)) b = i; return b; };
        rows.forEach(q => { if (q.oos) return;
          q.vehParts = () => {
            if (q.kind === 'shear') { if (!q.dir) return []; const pos = q.dir > 0, c = [];
              X.forEach((x, i) => { if (Math.abs(x - q.x) > 0.011 + 1e-9) return; [['VR', pos ? 'VRmax' : 'VRmin', pos ? 'VRpos' : 'VRneg'], ['VL', pos ? 'VLmax' : 'VLmin', pos ? 'VLpos' : 'VLneg']].forEach(([gk, pk, lk]) => c.push({ i, gk, pk, lk, v: q.dir * (VL.ll[lk][i] + (Q ? Q[lk][i] : 0)) })); });
              const m = c.find(z => Math.abs(z.v - q.LL) <= 1e-6 * Math.max(1, Math.abs(q.LL))); if (!m) return [];
              const per = VL.per[m.pk][m.i], gv = VL.g[m.gk][m.i], ped = Q ? Q[m.lk][m.i] : 0, imT = imT0(VL.withLane[m.pk][m.i]);
              return [{ id: 'LLv', label: `${v.short}: LL+IM shear per girder at x = ${n2(X[m.i])} ft (${pos ? 'positive' : 'negative'} direction)`, sym: 'V_{LL+IM}', eq: `${pos ? '' : '-('}g_{V}\\,V_{lane}${ped ? ' + V_{PL}' : ''}${pos ? '' : ')'}`, sub: `${pos ? '' : '-('}${n4(gv)}(${n2(per)})${ped ? ` + (${n2(ped)})` : ''}${pos ? '' : ')'}`, value: q.dir * (gv * per + ped), unit: 'kip', d: 2,
                ref: `${RT.MBE} Art. ${v.cat === 'permit' ? '6A.4.5.4.2, 6A.4.5.5' : '6A.4.4.2, 6A.4.4.3'}; AASHTO LRFD 10th Ed. Art. 4.6.2.2.3`, note: `V_lane = ${n2(per)} kip per lane with ${imT}, on this app\'s line-girder model (Analysis tab).${posT(VL.at[m.pk][m.i])}${ngT} g_V = ${n4(gv)}: ${dfT}, worked on the Loads & LLDF tab.${ped ? ' The pedestrian load V_PL is added, as in the design-load rating.' : ''}` }]; }
            const W = q.kind === 'svc' && VLs ? VLs : VL, dfU = q.kind === 'svc' ? dfTs : dfT;   // Service II rows of a mixed-traffic special permit: the design-factor live load
            const i = iAt(q.x), pos = q.region === 'pos', pk = pos ? 'Mmax' : 'Mmin', lk = pos ? 'Mpos' : 'Mneg', per = W.per[pk][i], gm = W.g.M[i], ped = Q ? Q[lk][i] : 0, imT = imT0(W.withLane[pk][i]);
            return [{ id: 'LLv', label: `${v.short}: LL+IM moment per girder at x = ${n2(X[i])} ft (${pos ? 'positive' : 'negative'} envelope)`, sym: 'M_{LL+IM}', eq: `g_{M}\\,M_{lane}${ped ? ' + M_{PL}' : ''}`, sub: `${n4(gm)}(${n1(per)})${ped ? ` + (${n1(ped)})` : ''}`, value: W.ll[lk][i] + ped, unit: 'kip-ft', d: 1,
              ref: `${RT.MBE} Art. ${v.cat === 'permit' ? '6A.4.5.4.2, 6A.4.5.5' : '6A.4.4.2, 6A.4.4.3'}; AASHTO LRFD 10th Ed. Art. 4.6.2.2.2`, note: `M_lane = ${n1(per)} kip-ft per lane with ${imT}, on this app\'s line-girder model (Analysis tab).${posT(W.at[pk][i])}${ngT} g_M = ${n4(gm)}: ${dfU}, worked on the Loads & LLDF tab.${ped ? ' The pedestrian load M_PL is added, as in the design-load rating.' : ''}${v.cat === 'lane' && Math.abs(VL.ll[lk][i]) < 1e-12 && Math.abs(per) > 1e-9 ? ' Not used here: the lane-type model applies to negative moment, the pier regions and spans over 200 ft (MBE Art. 6A.4.4.2.1a).' : ''}` }]; }; });
        const sum = RT.girder(rows, {}), gov = sum.gov.inv, rf = gov ? gov.inv : NaN, tg = RT.vehTarget(own, v.id);
        out.list.push({ ...v, rows, sum, cap, flex: Gr, flexS: GrS, shear: SHR, pl, VL, VLs, gov, rf, by: sum.by, rated: v.tons != null && isFinite(rf) ? rf * v.tons : null, posting: v.post && gov ? RT.posting(v.tons, rf) : null,
          tgt: tg && gov ? { need: tg.need, cite: tg.cite, pass: !(rf < tg.need - 1e-9) && !Number.isNaN(rf) } : null, laneLoad: !!runL, laneWhy: PL.why, ms: Date.now() - t1 });
      } catch (e) { out.list.push({ ...v, err: 'Calculation error: ' + (e && e.message) }); }
    });
    out.laneWarn = L.list.some(v => v.cat === 'legal') && !L.list.some(v => v.cat === 'lane') && RT.laneModelNeeded(AR.spans, AR.cont);
    out.ms = Date.now() - t0; return out;
  }
  /* buildCustom(ctx) (custom demands PR, 2026-11-01): the unfactored moments entered on the Flexure tab and the shears entered on the Shear &
     stiffeners tab (their Custom tables; the Flexure and Shear modules' own builds on them), rated as build() rates the analysis */
  function buildCustom(ctx) {
    const P = ctx.P, g = ctx.g || 0, CD = window.SBDCustomDemands, RT = window.SBDRating, rt = ensure(P);
    if (!CD) return { err: 'ui/demands.js is not loaded.' };
    if (CD.get(P, 'flex', g).mode === 'fac') return { err: 'Rating needs the unfactored moments by load case: the Flexure tab\'s Custom table holds factored moments (choose "Unfactored, by load case" there).' };
    const Gr = window.SBDFlexureUI.build({ P, g, src: 'custom', method: 'auto' }); if (Gr.err) return { err: 'Flexure (Custom table of the Flexure tab): ' + Gr.err };
    const SHR = window.SBDShearUI.build({ P, g, src: 'custom' }); if (SHR.err) return { err: 'Shear (Custom table of the Shear & stiffeners tab): ' + SHR.err };
    const pl = CD.payload(P, g, 'shear').pl, own = (P.ownerRules || {}).owner || 'AASHTO', sup = pl.member.supports;
    const cases = RT.shearCases(pl), ph = RT.phi(rt.phiC, rt.phiS), G = RT.factors(), opt = { G, phi: ph, mat: Gr.prj.mat };
    const rows = [], cap = new Map();
    Gr.rows.forEach(r => { RT.flexure(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); RT.service(r, opt).forEach(q => { cap.set(q, r); rows.push(q); }); });
    SHR.stations.forEach(r => { const q = RT.shear(r, { ...opt, cases: cases(r.x) }); cap.set(q, r); rows.push(q); });
    const T = RT.target(own);
    if (T && T.fat && window.SBDFatigue && P.fatigue) { const FA = window.SBDFatigue, set = FA.settings(P.fatigue), spans = sup.slice(1).map((x, k) => x - sup[k]), B = FA.supports({ ok: true, spans, cont: sup.length > 2 });
      if (set.ok) Gr.rows.forEach(r => { const o = FA.flange(r, { set, B, catT: P.fatigue.catT, catB: P.fatigue.catB }); (o.items || []).forEach(it => { if (it.r > 0 && isFinite(it.r)) { const q = RT.fatigue(it, r); cap.set(q, r); rows.push(q); } }); }); }
    const sum = RT.girder(rows, { owner: own });
    const what = `Demands: entered (Custom), unfactored: the moments of the <a href="#" data-gotab="flex">Flexure tab</a>'s Custom table (${Gr.custom.rows.length} row(s), ${Gr.rows.length} location(s)) and the shears of the <a href="#" data-gotab="shear">Shear &amp; stiffeners tab</a>'s (${SHR.custom.rows.length} row(s), ${SHR.stations.length} station(s)) of ${esc(P.girders[g].label || P.girders[g].id)}; capacities, brace points and f<sub>ℓ</sub> as on those tabs.`;
    return { rows, sum, cap, ph, G, own, T, what, flex: Gr, shear: SHR, pl, custom: { flex: Gr.custom, shear: SHR.custom } };
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g, srcOf(ctx.P), S.plName]);

  /* ---------- output tab ---------- */
  function css() {
    if (document.getElementById('rt-css')) return;
    const st = document.createElement('style'); st.id = 'rt-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} tr.fx-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .fx-list{max-height:340px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;}
      .rt-box{display:flex;gap:10px;flex-wrap:wrap;margin:6px 0;} .rt-box>div{border:1px solid var(--line);border-radius:6px;padding:6px 10px;min-width:150px;} .rt-box .n{font-size:15pt;font-weight:600;} .rt-box .l{font-family:var(--font-ui);font-size:8.5pt;color:#475569;}
      .rt-vg{margin:6px 0;} .rt-vt{font-family:var(--font-ui);font-size:9pt;font-weight:600;color:#334155;} .rt-vl{display:flex;flex-wrap:wrap;gap:4px 14px;margin:3px 0;} .rt-vl label{font-family:var(--font-ui);font-size:9.5pt;display:inline-flex;gap:5px;align-items:center;min-height:28px;}
      .rt-ax{width:100%;max-width:520px;min-height:54px;font:inherit;}`;
    document.head.appendChild(st);
  }
  const GRP = [['flexP', 'Flexure, positive (Strength I)'], ['flexN', 'Flexure, negative (Strength I)'], ['shear', 'Shear (Strength I)'], ['svc', 'Service II (permanent deformation)'], ['fat', 'Fatigue (owner target only)']];
  function render(host, ctx) {
    css();
    const P = ctx.P, rt = ensure(P), stale = (!S.R && !S.err) || S.key !== key(ctx), opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;   // SPERR2: a run that ended in an error is current (its message shows), not out of date
    const phc = PHI_C.some(([v]) => v === +rt.phiC) ? +rt.phiC : 'other', phs = PHI_S.findIndex(([v]) => v === +rt.phiS);
    const phsSel = phs < 0 ? -1 : S.phsI != null && PHI_S[S.phsI] && PHI_S[S.phsI][0] === +rt.phiS ? S.phsI : phs;   // φ_s repeats a value: the row chosen
    const AUI = window.SBDAnalysisUI, AN = window.SBDAnalysis, gl = P.girders[ctx.g] || P.girders[0] || {};
    let h = (AUI && AUI.srcBar ? AUI.srcBar({ src: srcOf(P), auto: !S.src && !(window.SBDCustomDemands && window.SBDCustomDemands.srcGet(P, 'rt')), rd: AN && AN.ready ? AN.ready(P, P.girders[ctx.g] ? ctx.g : 0) : null, g: gl.label || gl.id, plName: S.plName }) : '')
      + `<section class="sec"><div class="secHead">Load rating: factors and demands</div><div class="secBody">
      <div class="fRow"><label for="rt_phiC">Condition factor φ<sub>c</sub></label><select id="rt_phiC">${PHI_C.map(([v, t]) => opt(v, t, phc)).join('')}${phc === 'other' ? opt('other', `Entered (${fmt(rt.phiC, 2)})`, 'other') : ''}</select><span class="unit">MBE Table 6A.4.2.3-1</span></div>
      <div class="fRow"><label for="rt_phiS">System factor φ<sub>s</sub></label><select id="rt_phiS">${PHI_S.map(([v, t], i) => opt(i, t, phsSel)).join('')}${phs < 0 ? opt(-1, `Entered (${fmt(rt.phiS, 2)})`, -1) : ''}</select><span class="unit">MBE Table 6A.4.2.4-1</span></div>
      <div class="fRow"><label for="rt_src">Demands</label><select id="rt_src">${opt('analysis', "This app's analysis (Analysis tab)", srcOf(P))}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', srcOf(P))}${window.SBDCustomDemands ? opt('custom', 'Custom (the Flexure and Shear tabs\' entered tables)', srcOf(P)) : ''}</select></div>
      ${srcOf(P) === 'file' ? `<div class="fRow"><label for="rt_file">File</label><input type="file" id="rt_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>` : ''}
      <p class="note">LRFR design-load rating, HL-93 (MBE 4th Ed. 6A.4.2): RF = (C − γ<sub>DC</sub>DC − γ<sub>DW</sub>DW ± γ<sub>P</sub>P)/(γ<sub>LL</sub>(LL+IM)); flexure C = φ<sub>c</sub>φ<sub>s</sub>φR<sub>n</sub> with φ<sub>c</sub>φ<sub>s</sub> ≥ 0.85; shear C = φ<sub>c</sub>φ<sub>v</sub>V<sub>n</sub> (φ<sub>s</sub> = 1.0 for shear, Art. 6A.4.2.4, p. 6-25); Service II C = f<sub>R</sub> = 0.95F<sub>yf</sub> composite (no R<sub>h</sub>), 0.80R<sub>h</sub>F<sub>yf</sub> noncomposite (Art. 6A.6.4.2.2, p. 6-66).
        Strength I: γ<sub>DC</sub> 1.25, γ<sub>DW</sub> 1.50, γ<sub>LL</sub> 1.75 Inventory, 1.35 Operating; Service II: γ<sub>D</sub> 1.00, γ<sub>LL</sub> 1.30 / 1.00 (Table 6A.4.2.2-1). No owner η or design load multiplier (GirderDetail GS20).
        Capacities from the <a href="#" data-gotab="flex">Flexure</a> and <a href="#" data-gotab="shear">Shear &amp; stiffeners</a> modules (AASHTO LRFD 10th Ed.). φ<sub>c</sub>, φ<sub>s</sub> and the demand choice are saved with the project (a hand-off file is not). Legal-load and permit rating (MBE 6A.4.4, 6A.4.5): the vehicles ticked under <a href="#rt-veh">Legal and permit vehicles</a> below are run on this app's analysis and rated with the same capacities.</p></div></section>`
      + vehCard(P, srcOf(P));
    if (srcOf(P) === 'custom' && window.SBDCustomDemands) h += `<p class="note">${window.SBDCustomDemands.SPECS.rt.unf.note}</p>` + window.SBDCustomDemands.card(P, 'flex', ctx.g) + window.SBDCustomDemands.card(P, 'shear', ctx.g);   // the two tables (ui/demands.js)
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Rating results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="rt_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) h += results(S.R);
    host.innerHTML = h;
    window.SharedSteps.wire(host, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    const on = (id, ev, f) => { const el = host.querySelector('#' + id); if (el) el.addEventListener(ev, f); }, redraw = () => render(host, ctx);
    const save = () => { if (ctx.changed) ctx.changed(); else redraw(); };
    on('rt_phiC', 'change', e => { if (e.target.value === 'other') return; rt.phiC = +e.target.value; save(); });
    on('rt_phiS', 'change', e => { const i = +e.target.value; if (!(i >= 0)) return; S.phsI = i; rt.phiS = PHI_S[i][0]; save(); });
    on('rt_src', 'change', e => { const v = e.target.value; S.src = v === 'file' ? 'file' : null;   // saved with the project (P.demandSrc.rt), a file for the page view
      if (window.SBDCustomDemands) window.SBDCustomDemands.srcSet(P, 'rt', v === 'file' ? null : v); if (ctx.changed && v !== 'file') ctx.changed(); else redraw(); });
    if (srcOf(P) === 'custom' && window.SBDCustomDemands) ['flex', 'shear'].forEach(m => window.SBDCustomDemands.wire(host, P, m, ctx.g, save));
    on('rt_calc', 'click', () => { S.err = ''; S.R = null; try { const R = build({ ...ctx, veh: true }); if (R.err) S.err = R.err; else { S.R = R; const D = viewOf(R); if (!D) S.view = ''; const gi = D ? D.gov : R.sum.gov.inv; S.sel = gi ? (D ? D.rows : R.rows).indexOf(gi) : 0; } } catch (er) { S.err = 'Calculation error: ' + (er && er.message); } S.key = key(ctx); redraw(); });
    on('rt_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), ck = window.SBDDemandFile.check(j); if (!ck.ok) throw new Error(ck.error); const pl = ck.pl;   // B1: GirderDetail hand-offs only (engine/demandfile.js)
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { alert('Cannot read this file: ' + er.message); /* nothing changed: the previous file, if any, stays */ } redraw(); };
      rd.readAsText(f); });
    vehWire(host, P, save, redraw);
    host.querySelectorAll('[data-gotab]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${el.dataset.gotab}"]`); if (b) b.click(); }));
    host.querySelectorAll('.fx-list').forEach(el => el.addEventListener('click', e => { const tr = e.target.closest('[data-rt]'); if (!tr) return; S.sel = +tr.dataset.rt; redraw(); }));
    host.querySelectorAll('[data-rtgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); S.view = ''; S.sel = +a.dataset.rtgo; redraw(); const t = host.querySelector('#rt-steps'); if (t) t.scrollIntoView({ block: 'start' }); }));
    if (S.R && !stale && !S.err && window.SBDTabGfxBUI) { const D = viewOf(S.R); if (D && !D.chart) D.chart = { rows: D.rows, sum: D.sum, pl: D.pl, one: D.short }; window.SBDTabGfxBUI.rating(host, ctx, D ? D.chart : S.R, S.sel, v => { S.sel = v.i; redraw(); }); }   // the graphic (ui/tabgraphics-b.js): a click selects that station's row
  }
  const stepLi = s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${window.SBDSub.html(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${window.SBDSub.html(s.note)}</div>` : ''}</li>`;
  const A = '10th Ed. Art. ', OPEN = new Set(), TPX = (...ks) => ks.map(k => window.SBDFlexureUI.TP[k]).filter(Boolean);

  /* ---------- topics of the worked steps (presentation spec A, 2026-10-31; as ui/shear.js): the rating factor from its load effects and capacity; the capacity work uses the Flexure / Shear topics ---------- */
  const TOPICS = { x: () => [
    { key: 'phi', title: 'Condition and system factors', ref: '', ids: /^rt\.phiCS$/ },
    { key: 'dc', title: 'Dead-load effects (DC, DW)', ref: '', ids: /^rt\.(DC|DW)$/, res: /^rt\.DW$/ },
    { key: 'll', title: 'Live-load effect (HL-93, LL+IM)', ref: '', ids: /^rt\.(LLv|LL)$/, res: /^rt\.LL$/ },
    { key: 'cap', title: 'Capacity', ref: '', ids: /^rt\.(Rn|Rh|F|C)$/, res: /^rt\.C$/ },
    { key: 'rf', title: 'Rating factors', ref: '', ids: /^rt\.(gLL|inv|opr|fat)/, res: /^rt\.inv/ }],
    v: () => [{ key: 'rtv', title: 'Rated load and posting', ref: '', ids: /^rtv\./ }] };   // v (2026-11-23): a legal / permit vehicle's rated load and posting (vehSteps)
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind || 'x'](), { strip: false });
  /* the capacity work of a location: the Shear or the Flexure tab's topics (the same steps as those tabs) */
  const capGroups = (q, list) => q.kind === 'shear' ? window.SBDShearUI.groups('loc', list) : window.SBDFlexureUI.groups('x', list);
  const stepsHtml = (list, G) => window.SharedSteps.groupsHTML(G || groups('x', list), { open: OPEN, item: stepLi });
  const grpOf = q => q.kind === 'flex' ? (q.region === 'pos' ? 'flexP' : 'flexN') : q.kind;
  function results(R) {
    const s = R.sum, gi = s.gov.inv, go = s.gov.opr, idx = q => R.rows.indexOf(q), lk = q => q ? ` <a class="wk" href="#rt-steps" data-rtgo="${idx(q)}">§</a>` : '';
    let h = `<section class="sec"><div class="secHead">Load rating: governing (HL-93 design load)</div><div class="secBody"><p class="note">${R.what}</p>
      <div class="rt-box"><div class="${cls(gi && gi.inv)}"><div class="l">Inventory RF (governing)</div><div class="n">${gi ? rfTxt(gi.inv) : '—'}</div><div class="l">${gi ? `${window.SBDSub.html(gi.title)}, ${esc(gi.name)}` : ''}${lk(gi)}</div></div>
        <div class="${cls(go && go.opr)}"><div class="l">Operating RF (governing)</div><div class="n">${go ? rfTxt(go.opr) : '—'}</div><div class="l">${go ? `${window.SBDSub.html(go.title)}, ${esc(go.name)}` : ''}${lk(go)}</div></div>
        ${s.target && s.tgt && s.tgt.inv ? `<div class="${s.tgt.inv.pass ? 'fx-ok' : 'fx-ng'}"><div class="l">Owner design rating target (${esc(s.target.cite)})</div><div class="n">${rfTxt(s.tgt.inv.rf)} ${s.tgt.inv.pass ? '≥' : '<'} ${fmt(s.tgt.inv.need, 2)}</div><div class="l">HL-93 Inventory; reported, the girder is not resized for it</div></div>` : ''}
        ${s.target && s.tgt && s.tgt.fat ? `<div class="${s.tgt.fat.pass ? 'fx-ok' : 'fx-ng'}"><div class="l">Owner fatigue target</div><div class="n">${rfTxt(s.tgt.fat.rf)} ${s.tgt.fat.pass ? '≥' : '<'} ${fmt(s.tgt.fat.need, 2)}</div><div class="l">1/(GS17 ratio), GirderDetail GS20${lk(s.by.fat)}</div></div>` : ''}</div>
      ${s.target && s.target.kind === 'report' ? `<p class="note">${esc(s.target.cite)}: ${esc(s.target.text)} (reported, no target).</p>` : ''}${s.target && s.target.pend.length ? `<p class="note">Owner rating vehicles: ${s.target.pend.map(t => esc(String(t).replace(/, not in this tool$/, ''))).join('; ')}. Those in the shared vehicle list (AASHTO legal loads, SU4 to SU7, EV2 / EV3, RIPTA bus, CT-TLC) are rated when ticked under <a href="#rt-veh">Legal and permit vehicles</a>; an owner vehicle that is not in that list is not rated here (a permit vehicle can be entered as an axle train).</p>` : ''}
      ${R.ph.floor ? `<div class="alert">φ<sub>c</sub>φ<sub>s</sub> = ${fmt(R.ph.prod, 3)} &lt; 0.85: 0.85 is used for flexure at the Strength limit state (MBE Eq. 6A.4.2.1-3); shear takes φ<sub>c</sub> = ${fmt(R.ph.phiC, 2)} with φ<sub>s</sub> = 1.0 (Art. 6A.4.2.4).</div>` : ''}
      <p class="note">Basis (MBE 4th Ed., 2026): ${esc(window.SBDRating.BASIS.svc)} ${esc(window.SBDRating.BASIS.shear)}</p>
      ${s.oos ? '<div class="alert">A positive-flexure location has its plastic neutral axis below the web (outside Table D6.1-1): its flexure is not rated (out of scope), as on the Flexure tab.</div>' : ''}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Group</th><th class="lft">Governing location and check</th><th>Inventory RF</th><th>Operating RF</th><th></th></tr></thead><tbody>
      ${GRP.filter(([k]) => s.by[k]).map(([k, t]) => { const q = s.by[k]; return `<tr><td class="lft">${t}</td><td class="lft">${esc(q.name)}: ${window.SBDSub.html(q.title)}</td><td class="${cls(q.inv)}">${rfTxt(q.inv)}</td><td class="${q.kind === 'fat' ? '' : cls(q.opr)}">${q.kind === 'fat' ? '—' : rfTxt(q.opr)}</td><td>${lk(q)}</td></tr>`; }).join('')}
      </tbody></table></div></div></section>`;
    if (R.veh) h += vehResults(R);
    const D = viewOf(R);
    if (D) return h + vehDetail(R, D);
    h += `<section class="sec"><div class="secHead">Load rating: RF along the girder</div><div class="secBody"><div data-gfxb="rating"></div></div></section>`;   // drawn by ui/tabgraphics-b.js from the rows below
    h += `<section class="sec"><div class="secHead">Rating factors at every location (${R.rows.length})</div><div class="secBody"><p class="note">C: φ<sub>c</sub>φ<sub>s</sub>φR<sub>n</sub> (Strength flexure), φ<sub>c</sub>φ<sub>v</sub>V<sub>n</sub> (shear, φ<sub>s</sub> = 1.0) or f<sub>R</sub> (Service II); DC, DW, LL+IM unfactored, in the unit of the check. Click a row for its work.</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th class="lft">Check</th><th>C</th><th>DC</th><th>DW</th><th>LL+IM</th><th>Unit</th><th>RF Inv.</th><th>RF Opr.</th></tr></thead><tbody>
      ${R.rows.map((q, i) => q.oos ? `<tr data-rt="${i}"><td class="lft">${esc(q.name)}</td><td class="lft fx-na" colspan="8">${window.SBDSub.html(q.title)}</td></tr>`
        : `<tr data-rt="${i}" class="${i === S.sel ? 'sel' : ''}${q === gi ? ' fx-gov' : ''}"><td class="lft">${esc(q.name)}</td><td class="lft">${window.SBDSub.html(q.title)}</td><td>${q.kind === 'fat' ? '' : fmt(q.C, q.unit === 'ksi' ? 2 : 1)}</td><td>${q.kind === 'fat' ? '' : fmt(q.DC, q.unit === 'ksi' ? 2 : 1)}</td><td>${q.kind === 'fat' ? '' : fmt(q.DW, q.unit === 'ksi' ? 2 : 1)}</td><td>${q.kind === 'fat' ? '' : fmt(q.LL, q.unit === 'ksi' ? 2 : 1)}</td><td style="white-space:nowrap">${esc(q.unit || '')}</td><td class="${cls(q.inv)}">${rfTxt(q.inv)}</td><td class="${q.kind === 'fat' ? '' : cls(q.opr)}">${q.kind === 'fat' ? '—' : rfTxt(q.opr)}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
    const q = R.rows[S.sel] || gi;
    if (q && !q.oos) { const r = R.cap.get(q), cst = r ? (q.kind === 'shear' ? window.SBDShearUI.stepsOf(R.shear, 'loc', r) : window.SBDFlexureUI.stepsOf(R.flex, r)) : [];   // with custom demands their step first
      h += `<section class="sec" id="rt-steps"><div class="secHead">Worked steps, ${esc(q.name)}: ${window.SBDSub.html(q.title)}</div><div class="secBody"><p class="note">The rating first (${esc(window.SBDRating.MBE)}), then the ${q.kind === 'shear' ? 'shear' : 'flexure'} work of this location (the same steps as the ${q.kind === 'shear' ? 'Shear &amp; stiffeners' : 'Flexure'} tab), where R<sub>n</sub> is worked. AASHTO LRFD 10th Ed. (2024).</p>
        ${stepsHtml(q.steps)}${cst && cst.length ? `<h4 class="sub" style="font-family:var(--font-ui);font-size:9pt;margin:10px 0 2px">${q.kind === 'shear' ? 'Shear' : 'Flexure'} at ${esc(r.name)}</h4>${stepsHtml(cst, capGroups(q, cst))}` : ''}</div></section>`; }
    return h;
  }

  /* ---------- legal and permit vehicles: inputs, results, the rows of one vehicle (2026-11-23) ---------- */
  const VDEF = () => ({ on: [], imL: '', imP: '', evG: 'legal', permit: { key: '', type: 'routine', gam: '', axles: '', name: '' } });
  const vehGet = P => { const v = (P.rating || {}).veh || {}, d = VDEF(); return { ...d, ...v, on: Array.isArray(v.on) ? v.on.slice() : [], permit: { ...d.permit, ...(v.permit || {}) } }; };
  const vehSet = (P, f) => { const rt = ensure(P), v = vehGet(P); f(v); rt.veh = v; };   // written only when the engineer changes a vehicle input
  const viewOf = R => (S.view && R && R.veh ? R.veh.list.find(v => v.key === S.view && v.rows) || null : null);
  const tonsT = v => (v.tons != null ? fmt(v.tons, 2).replace(/\.00$/, '') : '—');
  /* dfCell(v): the distribution-factor text of a rated vehicle (table cell, plain text) */
  const dfCell = v => (v.df === 'one' ? (v.dfS === 'multi' ? 'one lane, no m (Service II: design)' : 'one lane, no m') : 'design');
  function vehCard(P, src) {
    const RT = window.SBDRating, VS = window.SharedVehicles; if (!VS || !RT.VEH_GROUPS) return '';
    const pre = VS.build().presets, v = vehGet(P), adtt = adttOf(P), gL = RT.gammaLegal(adtt), W = k => pre[k].axles.reduce((a, q) => a + q[0], 0), sp = P.spans.lengths.map(Number), cont = P.spans.continuity !== 'simple' && sp.length > 1;
    const o = (val, t, cur) => `<option value="${esc(val)}"${String(cur) === String(val) ? ' selected' : ''}>${esc(t)}</option>`, need = RT.laneModelNeeded(sp, cont);
    const ck = k => `<label><input type="checkbox" data-rtveh="${esc(k)}"${v.on.includes(k) ? ' checked' : ''}> ${esc(RT.VEH_SHORT[k] || k)}${k === 'Legal-Lane' ? ' (75 % of Type 3-3 + 0.2 klf)' : ` (${fmt(W(k) / 2, 2).replace(/\.00$/, '')} tons)`}</label>`;
    const NOTE = { lane: `Required by MBE Art. 6A.4.4.2.1a with the AASHTO legal loads for negative moment and interior reactions of continuous spans (two trucks; the MBE spaces them 30 ft, this app searches 30 ft and more, which includes that case) and for spans longer than 200 ft; no IM on the lane load. Rated load and posting with W = 80 kip (40 tons; MBE Arts. 6A.4.4.4, 6A.8.3). This girder: ${need ? '<b>applies</b>' : 'does not apply (simple spans of 200 ft or less)'}. Its run takes the longest (the headway search). Where the ADTT is below 500 the MBE lets the Engineer leave the lane load out and take the full Type 3-3: that alternative is not offered here (the lane-type model as above is the conservative one).`,
      shv: 'MBE Art. 6A.4.4.2.1b rates specialized hauling vehicles with the Notional Rating Load (NRL, Fig. D6A-6) first and uses SU4 to SU7 for posting when the NRL does not rate. The NRL is not in the shared vehicle list: rate SU4 to SU7 directly.',
      ev: 'γ<sub>LL</sub> by the choice below; rated at Strength I and Service II as a legal load, the design distribution factor. The MBE 4th Ed. has no provision for these vehicles: the basis is the FHWA memorandum.', owner: 'Rated as legal loads. The Legal H20 label is the shared list\'s (RIDOT LRFR Guidelines 4.4.1.2); MBE Appendix D6A has no H20.' };
    const pm = v.permit, wr = pm.key && pm.key !== 'custom' && pre[pm.key] ? RT.weightRatio(pre[pm.key].axles) : pm.key === 'custom' && !RT.parseAxles(pm.axles).err ? RT.weightRatio(RT.parseAxles(pm.axles).axles) : null, gp = wr ? RT.gammaPermit(pm.type, adtt, wr.wr) : null;
    return `<section class="sec" id="rt-veh"><div class="secHead">Legal and permit vehicles (optional)</div><div class="secBody">
      <p class="note">Tick the vehicles to rate (MBE 4th Ed. 6A.4.4 legal loads, 6A.4.5 permit loads). Each one is run on this app's line-girder model (the <a href="#" data-gotab="an">Analysis tab</a>'s live-load stiffness and stations) and rated at Strength I (legal) or Strength II (permit) flexure and shear and at Service II, with the capacities, φ<sub>c</sub>, φ<sub>s</sub> and the f<sub>ℓ</sub> of the design-load rating; fatigue is not rated for these loads. Nothing ticked: the HL-93 rating only, as before. The choices are saved with the project. Each vehicle adds about 1 to 2 s to Calculate (the lane-type model about 10 s).</p>
      ${src !== 'analysis' ? '<div class="alert">Legal and permit vehicles are run only with "This app\'s analysis" as the demands: with a hand-off file or Custom demands they are not rated.</div>' : ''}
      ${RT.VEH_GROUPS.map(G => `<div class="rt-vg"><div class="rt-vt">${esc(G.title)}</div><div class="rt-vl">${G.keys.filter(k => pre[k]).map(ck).join('')}</div>${NOTE[G.id] ? `<p class="note" style="margin:0">${NOTE[G.id]}</p>` : ''}</div>`).join('')}
      <div class="fRow"><label for="rt_imL">IM, legal loads and emergency vehicles</label><input type="number" step="any" min="0" id="rt_imL" value="${esc(v.imL)}" placeholder="33"><span class="unit">% on the axles (MBE 6A.4.4.3; blank: 33)</span></div>
      <div class="fRow"><label for="rt_evG">γ<sub>LL</sub>, emergency vehicles</label><select id="rt_evG">${o('legal', `Legal-load table by ADTT (${fmt(gL, 4)}; conservative default)`, v.evG)}${o('fhwa', '1.30 (FHWA memorandum, 2016-11-03)', v.evG)}</select></div>
      <p class="note">Legal loads: γ<sub>LL</sub> = ${fmt(gL, 4)} from MBE Tables 6A.4.4.2.3a-1 and 6A.4.4.2.3b-1 at ADTT = ${adtt == null ? 'unknown' : fmt(adtt, 0)} trucks/day, one direction (1.30 at ADTT ≤ 1000, 1.45 at ADTT ≥ 5000 or unknown, linear between); the ADTT is taken from the <a href="#" data-goto="fs">Fatigue &amp; studs inputs</a>. Service II: γ<sub>LL</sub> 1.30 legal, 1.00 permit (Table 6A.4.2.2-1). Distribution factors: the design factors of the <a href="#" data-gotab="loads">Loads &amp; LLDF tab</a> (the governing of one and of two or more lanes loaded).</p>
      <div class="rt-vg"><div class="rt-vt">Permit vehicle (MBE Art. 6A.4.5)</div></div>
      <div class="fRow"><label for="rt_pk">Permit vehicle</label><select id="rt_pk">${o('', 'None', pm.key)}${RT.PERMIT_KEYS.filter(k => pre[k]).map(k => o(k, `${RT.VEH_SHORT[k] || k} (${fmt(W(k) / 2, 2).replace(/\.00$/, '')} tons)`, pm.key)).join('')}${o('custom', 'Entered axle train', pm.key)}</select></div>
      ${pm.key === 'custom' ? `<div class="fRow"><label for="rt_pn">Name</label><input type="text" id="rt_pn" value="${esc(pm.name)}" placeholder="Permit vehicle"></div>
      <div class="fRow"><label for="rt_pa">Axle train: load@spacing from the axle before, …</label><textarea id="rt_pa" class="rt-ax" placeholder="12@0, 20@12, 20@4.5, 20@30, 20@4.5">${esc(pm.axles)}</textarea><span class="unit">kip @ ft</span></div>
      ${pm.axles && RT.parseAxles(pm.axles).err ? `<div class="alert err">${esc(RT.parseAxles(pm.axles).err)}</div>` : ''}` : ''}
      ${pm.key ? `<div class="fRow"><label for="rt_pt">Permit type (Table 6A.4.5.4.2a-1)</label><select id="rt_pt">${RT.PERMIT_TYPES.map(t => o(t.id, t.label, pm.type)).join('')}</select></div>
      <div class="fRow"><label for="rt_pg">γ<sub>LL</sub>, permit (blank: the table)</label><input type="number" step="any" min="0" id="rt_pg" value="${esc(pm.gam)}" placeholder="${gp ? fmt(gp.g, 4) : ''}"><span class="unit">${wr && wr.wr != null ? `GVW/AL = ${fmt(wr.gvw, 1)}/${fmt(wr.AL, 2)} = ${fmt(wr.wr, 2)} kip/ft` : ''}</span></div>
      <div class="fRow"><label for="rt_imP">IM, permit vehicle</label><input type="number" step="any" min="0" id="rt_imP" value="${esc(v.imP)}" placeholder="${pm.key !== 'custom' && pre[pm.key] && pre[pm.key].imp.val === 1 ? '0 (preset)' : '33'}"><span class="unit">% (MBE 6A.4.5.5; blank: 33, or the preset's; 0 for a crossing at 10 mph or less)</span></div>
      <p class="note">Routine or annual permits: the design distribution factor and γ<sub>LL</sub> by ADTT and GVW/AL (the whole vehicle; the column is not interpolated). Special or limited-crossing permits: at Strength II the one-lane distribution factor with the multiple presence factor 1.2 removed (MBE Art. 6A.4.5.4.2b; this app's fatigue factors g<sub>1</sub>/1.2) and γ<sub>LL</sub> 1.40 / 1.20 / 1.10 by type; at Service II (γ<sub>LL</sub> 1.00, an optional check in MBE Table 6A.4.2.2-1) the design distribution factor when the permit mixes with traffic and the one-lane factor only for the escorted permit (MBE C6A.6.4.2.2). A 0.2 klf lane load is added on top of the permit vehicle where the ADTT (one direction) is above 500 or unknown and the permit is not escorted: for negative moment and the pier-region shear of a continuous girder and for every effect in spans longer than 200 ft (MBE Art. 6A.4.5.4.1). The permit factors are meant for a girder whose rating factor for the AASHTO legal loads is 1.0 or more (special permits: for the legal loads or the design load; MBE Arts. 6A.4.5.4.2, 6A.4.5.4.2b). More than 100 crossings: rate as a routine permit (MBE C6A.4.5.3.2). These provisions were read against the MBE 4th Ed. (2026) text.</p>` : ''}
      </div></section>`;
  }
  function vehWire(host, P, save, redraw) {
    host.querySelectorAll('[data-rtveh]').forEach(el => el.addEventListener('change', () => { vehSet(P, v => { const k = el.dataset.rtveh; v.on = v.on.filter(q => q !== k); if (el.checked) v.on.push(k); }); save(); }));
    const on = (id, f) => { const el = host.querySelector('#' + id); if (el) el.addEventListener('change', e => { vehSet(P, v => f(v, e.target.value)); save(); }); };
    const num = t => (t === '' || !(+t >= 0) ? '' : +t);
    on('rt_imL', (v, t) => { v.imL = num(t); }); on('rt_imP', (v, t) => { v.imP = num(t); }); on('rt_evG', (v, t) => { v.evG = t === 'fhwa' ? 'fhwa' : 'legal'; });
    on('rt_pk', (v, t) => { v.permit.key = t; }); on('rt_pt', (v, t) => { v.permit.type = t; }); on('rt_pg', (v, t) => { v.permit.gam = t === '' || !(+t > 0) ? '' : +t; });
    on('rt_pn', (v, t) => { v.permit.name = t; }); on('rt_pa', (v, t) => { v.permit.axles = t; });
    const vw = host.querySelector('#rt_view'); if (vw) vw.addEventListener('change', () => { S.view = vw.value; const D = viewOf(S.R), gi = D ? D.gov : S.R && S.R.sum.gov.inv; S.sel = gi ? (D ? D.rows : S.R.rows).indexOf(gi) : 0; redraw(); });
    host.querySelectorAll('[data-rtv]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); S.view = a.dataset.rtv; const D = viewOf(S.R); S.sel = D && a.dataset.rtvrow != null ? +a.dataset.rtvrow : 0; redraw(); const t = host.querySelector('#rt-steps'); if (t) t.scrollIntoView({ block: 'start' }); }));
    host.querySelectorAll('a[href="#rt-veh"]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = host.querySelector('#rt-veh'); if (t) t.scrollIntoView({ block: 'start' }); }));
  }
  const VGRP = [['flexP', 'Flexure +'], ['flexN', 'Flexure −'], ['shear', 'Shear'], ['svc', 'Service II']];
  /* postText(v): the posting or acceptance statement of a rated vehicle (plain text) */
  function postText(v) {
    const t = [], ng = v.rf < 1 - 1e-9 || Number.isNaN(v.rf);
    if (v.posting) t.push(v.posting.st === 'ok' ? 'No posting for this vehicle (RF ≥ 1.0)' : v.posting.st === 'post' ? `Safe posting load ${fmt(v.posting.P, 1)} tons (MBE Eq. 6A.8.3-1)` : 'RF ≤ 0.3: Eq. 6A.8.3-1 does not apply; consider closing the bridge (MBE Art. 6A.8.3)');
    else if (ng) t.push(v.cat === 'permit' ? 'RF < 1.0: the permit vehicle is not acceptable on this girder' : 'RF < 1.0: restriction by the owner\'s or FHWA\'s procedure (MBE Art. 6A.8); a posting load is not computed for this vehicle');
    else t.push(v.cat === 'permit' ? 'Permit acceptable (RF ≥ 1.0)' : 'RF ≥ 1.0');
    if (v.tgt) t.push(`owner target RF ≥ ${fmt(v.tgt.need, 2)}: ${v.tgt.pass ? 'met' : 'NOT met'} (${v.tgt.cite}; reported)`);
    return t.join('; ');
  }
  /* vehSteps(v): rated tonnage and posting of a rated vehicle, worked (shared/steps.js) */
  function vehSteps(v) {
    const w = window.SharedSteps.work('rtv'), MBE = window.SBDRating.MBE, n = (x, d) => window.SharedSteps.n(x, d);
    if (v.tons == null || !v.gov) return [];
    if (v.Weq) w.add({ id: 'W', label: `${v.short}: equivalent truck weight`, sym: 'W', eq: '\\frac{W_{eq}}{2}', sub: `\\frac{${n(v.Weq, 0)}}{2}`, value: v.tons, unit: 'tons', d: 2, ref: `${MBE} Arts. 6A.4.4.4, 6A.8.3`, note: `Where the lane-type legal load model governs, the weight used for the rated load and in the posting equation is ${n(v.Weq, 0)} kip (the full Type 3-3), not the sum of its 75 % axles; 1 ton = 2 kip.` });
    else w.add({ id: 'W', label: `${v.short}: gross weight`, sym: 'W', eq: '\\frac{\\sum P}{2}', sub: `\\frac{${v.axles.map(a => n(a[0], 2).replace(/\.?0+$/, '')).join(' + ')}}{2}`, value: v.tons, unit: 'tons', d: 2, ref: '', note: `Axle loads in kip; 1 ton = 2 kip. ${v.cat === 'permit' && v.id === 'custom' ? 'The entered axle train.' : 'From the shared vehicle list (MBE Appendix D6A figures and the owner documents it names).'}` });
    w.add({ id: 'RT', label: 'Rated load (safe load capacity in tons)', sym: 'RT', eq: 'RF \\times W', sub: `${n(v.rf, 3)}(${n(v.tons, 2)})`, value: v.rated, unit: 'tons', d: 1, ref: `${MBE} Art. 6A.4.4.4`, note: `RF: the governing rating factor of this vehicle (${v.gov.name}: ${v.gov.title}), worked in the steps of that row.` });
    if (v.posting && v.posting.st === 'post') w.add({ id: 'post', label: 'Safe posting load', sym: 'P_{post}', eq: '\\frac{W}{0.7}(RF - 0.3)', sub: `\\frac{${n(v.tons, 2)}}{0.7}(${n(v.rf, 3)} - 0.3)`, value: v.posting.P, unit: 'tons', d: 1, ref: `${MBE} Eq. 6A.8.3-1`, ok: false, note: 'For 0.3 < RF < 1.0 of a legal load. The posting decision and sign are the owner\'s (MBE Art. 6A.8).' });
    return w.steps;
  }
  function vehResults(R) {
    const V = R.veh, RT = window.SBDRating, ok = V.list.filter(v => v.rows), sub = t => window.SBDSub.html(t);
    if (V.only) return `<section class="sec"><div class="secHead">Legal-load and permit rating</div><div class="secBody"><div class="alert">Legal and permit vehicles are run only with "This app's analysis" as the demands: not rated with this demand choice.</div></div></section>`;
    const idx = (v, q) => v.rows.indexOf(q), cell = (v, q) => q ? `<td class="${cls(q.inv)}"><a href="#rt-steps" data-rtv="${esc(v.key)}" data-rtvrow="${idx(v, q)}">${rfTxt(q.inv)}</a></td>` : '<td>—</td>';
    let h = `<section class="sec" id="rt-vehres"><div class="secHead">Legal-load and permit rating (${ok.length} vehicle${ok.length === 1 ? '' : 's'})</div><div class="secBody">
      <p class="note">Each vehicle run on this app's analysis of this girder (${fmt(V.ms / 1000, 1)} s for the vehicles), rated by ${esc(RT.MBE)} Eq. 6A.4.2.1-1 with the capacities, φ<sub>c</sub>, φ<sub>s</sub>, γ<sub>DC</sub> 1.25 and γ<sub>DW</sub> 1.50 of the design-load rating: one rating factor per vehicle. ADTT (one direction) = ${V.adtt == null ? 'unknown' : fmt(V.adtt, 0)}. Rated load RT = RF × W (MBE Art. 6A.4.4.4).${V.pedIn ? ' The pedestrian load is added to each vehicle\'s live load, as in the design-load rating.' : ''} Distribution factors: ${esc(V.dfSrc || '')}. A rating factor below 1.0 counts as FAIL in the <a href="#" data-gotab="sum">Summary</a> verdict, as the HL-93 rating factors do. Click a rating factor for its worked steps.</p>
      ${V.err.map(e => `<div class="alert err">${esc(e)}</div>`).join('')}
      ${V.laneWarn ? '<div class="alert">MBE Art. 6A.4.4.2.1a calls for the lane-type legal load model on this girder (a continuous span or a span longer than 200 ft) together with the AASHTO legal loads: it is not ticked, so negative moment and the interior reactions (and spans over 200 ft) are rated for the single trucks only.</div>' : ''}
      ${V.list.filter(v => v.cat === 'permit' && v.rows).map(v => `<p class="note">${esc(v.short)}: ${esc(v.laneWhy || '')}${v.VLs ? ' Service II is rated with the design distribution factor (the permit mixes with traffic; MBE C6A.6.4.2.2); Strength II with the one-lane factor.' : ''}</p>`).join('')}
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Vehicle</th><th>W (tons)</th><th>IM (%)</th><th>γ<sub>LL</sub></th><th class="lft">DF</th>${VGRP.map(([, t]) => `<th>${t}</th>`).join('')}<th>Governing RF</th><th class="lft" style="min-width:170px">Governing check and location</th><th>RT = RF × W (tons)</th><th class="lft" style="min-width:150px">Posting / acceptance</th></tr></thead><tbody>
      ${V.list.map(v => v.rows ? `<tr${S.view === v.key ? ' class="sel"' : ''}><td class="lft"><a href="#rt-steps" data-rtv="${esc(v.key)}"${v.gov ? ` data-rtvrow="${idx(v, v.gov)}"` : ''}>${esc(v.short)}</a></td><td>${tonsT(v)}</td><td>${fmt(v.im, 0)}</td><td title="${esc(v.gRef)}">${fmt(v.gam, 4).replace(/(\.\d\d)0+$/, '$1')}</td><td class="lft">${dfCell(v)}</td>${VGRP.map(([k]) => cell(v, v.by[k])).join('')}
          <td class="${cls(v.rf)}"><b>${v.gov ? `<a href="#rt-steps" data-rtv="${esc(v.key)}" data-rtvi="${V.list.indexOf(v)}" data-rtvrow="${idx(v, v.gov)}">${rfTxt(v.rf)}</a>` : '—'}</b></td><td class="lft">${v.gov ? `${sub(v.gov.title)}, ${esc(v.gov.name)} (${esc(v.gov.lim)})` : 'no live-load effect'}</td><td>${v.rated != null ? fmt(v.rated, 1) : '—'}</td><td class="lft">${esc(postText(v))}</td></tr>`
        : `<tr><td class="lft">${esc(v.short)}</td><td>${tonsT(v)}</td><td class="lft fx-na" colspan="${8 + VGRP.length}">${esc(v.na || v.err || '')}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note">γ<sub>LL</sub>: ${[...new Set(ok.map(v => `${v.short}: ${v.gRef}`))].map(esc).join('. ')}. Flexure and shear at ${[...new Set(ok.map(v => v.lim))].join(' / ')}; Service II with γ<sub>LL</sub> 1.30 (legal) or 1.00 (permit). Posting: MBE Art. 6A.8.3 for the AASHTO legal loads, the lane-type model (W = 80 kip) and the specialized hauling vehicles (Eq. 6A.8.3-1 when 0.3 &lt; RF &lt; 1.0); not computed for the emergency and owner vehicles (the MBE lets Eq. 6A.8.3-1 be used for a state legal load with its own gross weight: the owner's choice).</p>
      ${ok.length ? `<div class="fRow"><label for="rt_view">Rows, graph and worked steps shown below</label><select id="rt_view"><option value="">HL-93 design load</option>${ok.map(v => `<option value="${esc(v.key)}"${S.view === v.key ? ' selected' : ''}>${esc(v.short)}</option>`).join('')}</select></div>` : ''}
      </div></section>`;
    return h;
  }
  /* vehDetail(R, D): the rows of vehicle D along the girder, at every location, and the worked steps of the selected row (as the HL-93 sections) */
  function vehDetail(R, D) {
    const gi = D.gov, u = q => (q.unit === 'ksi' ? 2 : 1);
    let h = `<section class="sec"><div class="secHead">${esc(D.short)}: RF along the girder</div><div class="secBody"><div data-gfxb="rating"></div></div></section>`;
    h += `<section class="sec"><div class="secHead">${esc(D.short)}: rating factors at every location (${D.rows.length})</div><div class="secBody"><p class="note">${esc(D.label)}. C: φ<sub>c</sub>φ<sub>s</sub>φR<sub>n</sub> (Strength flexure), φ<sub>c</sub>φ<sub>v</sub>V<sub>n</sub> (shear, φ<sub>s</sub> = 1.0) or f<sub>R</sub> (Service II); DC, DW, LL+IM unfactored, in the unit of the check; γ<sub>LL</sub> = ${fmt(D.gam, 4)} (${esc(D.lim)}), ${fmt(D.gamS, 2)} (Service II). Click a row for its work.</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th class="lft">Check</th><th>C</th><th>DC</th><th>DW</th><th>LL+IM</th><th>Unit</th><th>RF</th></tr></thead><tbody>
      ${D.rows.map((q, i) => q.oos ? `<tr data-rt="${i}"><td class="lft">${esc(q.name)}</td><td class="lft fx-na" colspan="7">${window.SBDSub.html(q.title)}</td></tr>`
        : `<tr data-rt="${i}" class="${i === S.sel ? 'sel' : ''}${q === gi ? ' fx-gov' : ''}"><td class="lft">${esc(q.name)}</td><td class="lft">${window.SBDSub.html(q.title)}</td><td>${fmt(q.C, u(q))}</td><td>${fmt(q.DC, u(q))}</td><td>${fmt(q.DW, u(q))}</td><td>${fmt(q.LL, u(q))}</td><td style="white-space:nowrap">${esc(q.unit || '')}</td><td class="${cls(q.inv)}">${rfTxt(q.inv)}</td></tr>`).join('')}
      </tbody></table></div></div></section>`;
    const q = D.rows[S.sel] || gi;
    if (q && !q.oos) { const r = D.cap.get(q), cst = r ? (q.kind === 'shear' ? window.SBDShearUI.stepsOf(D.shear, 'loc', r) : window.SBDFlexureUI.stepsOf(D.flex, r)) : [], ts = vehSteps(D);
      h += `<section class="sec" id="rt-steps"><div class="secHead">Worked steps, ${esc(D.short)}, ${esc(q.name)}: ${window.SBDSub.html(q.title)}</div><div class="secBody"><p class="note">The rating first (${esc(window.SBDRating.MBE)}): the vehicle's live load from this app's line-girder model (<a href="#" data-gotab="an">Analysis tab</a>: stiffness and stations; distribution factors on the <a href="#" data-gotab="loads">Loads &amp; LLDF tab</a>), then the ${q.kind === 'shear' ? 'shear' : 'flexure'} work of this location with this vehicle's demands, where R<sub>n</sub> is worked (the method of the ${q.kind === 'shear' ? '<a href="#" data-gotab="shear">Shear &amp; stiffeners</a>' : '<a href="#" data-gotab="flex">Flexure</a>'} tab). AASHTO LRFD 10th Ed. (2024).</p>
        ${stepsHtml(q.steps)}${q === gi && ts.length ? `<h4 class="sub" style="font-family:var(--font-ui);font-size:9pt;margin:10px 0 2px">Rated load${D.posting && D.posting.st === 'post' ? ' and posting' : ''}, ${esc(D.short)}</h4>${stepsHtml(ts, groups('v', ts))}` : q !== gi && gi ? `<p class="note">The rated load of ${esc(D.short)} is worked with its governing row: <a href="#rt-steps" data-rtv="${esc(D.key)}" data-rtvrow="${D.rows.indexOf(gi)}">${esc(gi.name)}</a>.</p>` : ''}
        ${cst && cst.length ? `<h4 class="sub" style="font-family:var(--font-ui);font-size:9pt;margin:10px 0 2px">${q.kind === 'shear' ? 'Shear' : 'Flexure'} at ${esc(r.name)}</h4>${stepsHtml(cst, capGroups(q, cst))}` : ''}</div></section>`; }
    return h;
  }

  window.SBDRatingUI = { ensure, fromAnalysis, build, render, TOPICS, groups, capGroups, vehOn, vehGet, vehSteps, postText, dfCell, VGRP };
})();
