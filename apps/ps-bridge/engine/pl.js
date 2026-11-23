/* apps/ps-bridge/engine/pl.js — PL-A: the pedestrian live load in the girder design (window.PSBPL). Classic script, no DOM.
   Created 2026-11-23 (engineer, 2026-11-23: "close the gaps vs the Steel Bridge app": pedestrian live load and utilities in the analysis;
   fixlog/ps-bridge.md PL-A). Mirrors the Steel Bridge app (apps/steel-bridge/engine/loads.js dead(): the load and its distribution;
   engine/analysis.js analyzeGirder / llPL: w_PL on the + and − parts of each influence line, no distribution factor, no IM, added once to
   LL+IM in every module; not in fatigue or the live-load deflection).

   Code (cited, not copied): AASHTO LRFD 10th Ed. (2024)
     Art. 3.6.1.6    a pedestrian load of 0.075 ksf on sidewalks wider than 2.0 ft, considered together with the vehicular design live
                     load in the vehicle lane (the load and its girder shares: engine/bridge-dl.js);
     Art. 3.6.2.1    the dynamic load allowance applies to the vehicles: none on the pedestrian load;
     Table 3.4.1-1   PL takes the live-load factor: Strength I 1.75, Service I 1.00, Service III γ_LL (opt.gLLs3, 0.8 by default);
     Art. 3.6.1.4.1  fatigue: the fatigue truck only (no PL); Art. 2.5.2.6.2 the live-load deflection: the vehicular load (no PL).

   AN ENGINE ADDITION MADE APP-SIDE (CLAUDE.md §4). The moved engine (engine/pbd-*.js, verbatim, frozen) is NOT edited and has no input for
   a pedestrian load: its live load reaches every check through six functions of computeAll (pbd-compute.js "live load (per girder)":
   MLLx, VLLx, MLLpos, MLLneg, VLLpos, VLLneg) and one expression at the pier (mll). Those are local to computeAll, so they cannot be
   wrapped from outside as distFactors is (engine/rigid.js, engine/lldf-fg.js). For a girder WITH a pedestrian load (inputs.pl.w > 0)
   this file therefore runs a copy of computeAll made at run time from the engine's own text (Function.prototype.toString) with the
   EDITS below: each renames one of the six functions to <name>_0 and the copy defines <name> = <name>_0 + the pedestrian part
   (channels()), and the pier's M_LL takes the pedestrian part (pierNeg()). Every edit's anchor must be found exactly once, else an error is
   thrown (no silent fallback). A girder WITHOUT a pedestrian load (every project saved before; no inputs.pl) runs the engine's own
   computeAll, untouched: nothing here is used. tests/engine/psbridge-pl.test.mjs: the copy with w_PL = 0 gives the engine's result on
   every parity case at tolerance 0; hand checks of the pedestrian part.

   The pedestrian part (w = w_PL of the girder line, klf; no DF, no IM), per girder:
     simple span (the engine's own HL-93, or an entered M_LL / V_LL):
       M_PL(x)  = w x (L − x) / 2                       the span loaded (the + area of the moment influence line), kip-ft
       V_PL+(x) = w (L − x)² / (2 L),  V_PL−(x) = −w x² / (2 L)     the + and − areas of the shear influence line, kip
       the shear envelope takes w (L − x_m)² / (2 L), x_m = min(x, L − x)
     spans made continuous (the engine's FE unit, PBD.contFE / sgBeam): the + and − areas of each node's influence line, which the
       engine already has for its 0.64 klf lane load (lanePos, laneNeg of each node's HL-93 row): A± = lane± / 0.64 (ft² for moments, ft
       for shears); M_PL±(x) = w A_M±, V_PL±(x) = w A_V±, linear between the nodes as PBD.contFE.at; at the pier M_PL,n = −w A_M−
     imported demands (a MIDAS file or a custom table): NOT added (the file is the composite-stage analysis and is used as given: it is
       assumed to include the pedestrian load, engineer's decision 2026-11-23; the note of engine/demands.js assumed() says so on the
       input side, the output tabs and in the Report).
   The owner's design load multiplier m (RIDOT) multiplies the engine's whole live-load term, so it also multiplies PL here (conservative;
   the Steel Bridge app keeps m off PL: decision pending, fixlog). The engine's R.MLL / R.VLL (midspan / support HL-93 values) stay HL-93
   only: the live-load deflection and the Loads tab's HL-93 values are unchanged.

   run(inp, inner) -> R with R.pl = { w, mode: 'simple' | 'cont' | 'ext', L, x: L/2, Mmid, Mhl (HL-93 + IM per girder at L/2, kip-ft),
     Vsup, Vhl (at the support), [AMp, AVp (cont: the areas)], [pier: { side, A, M }] } when inputs.pl.w > 0; else inner(inp) unchanged.
   steps(add, inp, R): the worked steps (ids ld.pl.*, Loads & LLDF tab and Report). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const LANE = 0.64;   // klf, the design lane load of the engine's HL-93 rows (3.6.1.2.4): lane± / 0.64 = the influence-line areas
  const A10 = 'AASHTO LRFD 10th Ed. ';
  /* the edits of the copy: [anchor (exactly once in computeAll's text), replacement] */
  const TAIL = "  const VLLneg = useExt? ext.V_LLneg : useFE? (x)=>dfv*fe.at(x,'Vn') : (x)=>-VLL*(1-x/L);";
  const EDITS = [
    ['  const MLLx = useExt? ext.M_LL : useFE? feM', '  const MLLx_0 = useExt? ext.M_LL : useFE? feM'],
    ['  const VLLx = useExt? ext.V_LL : useFE?', '  const VLLx_0 = useExt? ext.V_LL : useFE?'],
    ['  const MLLpos = useExt? ext.M_LLpos :', '  const MLLpos_0 = useExt? ext.M_LLpos :'],
    ['  const MLLneg = useExt? ext.M_LLneg :', '  const MLLneg_0 = useExt? ext.M_LLneg :'],
    ['  const VLLpos = useExt? ext.V_LLpos :', '  const VLLpos_0 = useExt? ext.V_LLpos :'],
    [TAIL, TAIL.replace('const VLLneg =', 'const VLLneg_0 =')
      + '\n  const PL_=window.PSBPL.channels({inp,L,useExt,useFE,fe},{MLLx:MLLx_0,VLLx:VLLx_0,MLLpos:MLLpos_0,MLLneg:MLLneg_0,VLLpos:VLLpos_0,VLLneg:VLLneg_0});'
      + '\n  const MLLx=PL_.MLLx, VLLx=PL_.VLLx, MLLpos=PL_.MLLpos, MLLneg=PL_.MLLneg, VLLpos=PL_.VLLpos, VLLneg=PL_.VLLneg;'],
    ['mll=-dfm*q.nd.Mn, mrn=restr?', 'mll=-dfm*q.nd.Mn+PL_.pierNeg(q), mrn=restr?']
  ];
  let COPY = null, LAST = null;
  /* engine(): the copy of computeAll with the edits (made once; the engine's own text, so the same arithmetic everywhere else) */
  function engine() {
    if (COPY) return COPY;
    let src = W.computeAll.toString();
    EDITS.forEach(([a, b]) => { const k = src.split(a).length - 1; if (k !== 1) throw new Error(`PSBPL: the engine text has ${k} matches of an edit anchor (expected 1): ${a.slice(0, 60)}`); src = src.replace(a, () => b); });
    COPY = (0, eval)('(' + src.replace(/^function\s+computeAll\s*\(/, 'function computeAllPL(') + ')');
    return COPY;
  }
  const wOf = inp => { const w = inp && inp.pl ? +inp.pl.w : 0; return w > 0 && isFinite(w) ? w : 0; };
  /* areas(fe): per node of the span, the + and − influence-line areas of the moment and of the shear (the engine's lane rows / 0.64) */
  function areas(fe) {
    const beam = W.PBD.sgBeam(fe.spans, false), i0 = beam.sup[fe.s - 1], i1 = beam.sup[fe.s];
    return fe.nodes.map((nd, k) => { const i = i0 + k, v = i < i1 ? beam.VLLr[i] : beam.VLL[i - 1];   // the shear row PBD.contFE takes for the node
      return { x: nd.x, Mp: nd.ll.lanePos / LANE, Mn: nd.ll.laneNeg / LANE, Vp: v.lanePos / LANE, Vn: v.laneNeg / LANE }; });
  }
  /* at(nodes, x, key): linear between the nodes, as PBD.contFE's at() */
  function at(nodes, x, key) {
    if (x <= nodes[0].x) return nodes[0][key];
    for (let j = 1; j < nodes.length; j++) if (x <= nodes[j].x + 1e-12) { const p = nodes[j - 1], q = nodes[j], t = (x - p.x) / Math.max(q.x - p.x, 1e-12); return p[key] + (q[key] - p[key]) * t; }
    return nodes[nodes.length - 1][key];
  }
  /* channels(c, ch): the six live-load functions of the copy (kip-in, kip), = the engine's (ch) + the pedestrian part; w = 0: ch itself */
  function channels(c, ch) {
    const w = wOf(c.inp), L = c.L, none = { MLLx: ch.MLLx, VLLx: ch.VLLx, MLLpos: ch.MLLpos, MLLneg: ch.MLLneg, VLLpos: ch.VLLpos, VLLneg: ch.VLLneg, pierNeg: () => 0 };
    if (!(w > 0)) { LAST = null; return none; }
    if (c.useExt) { LAST = { w, mode: 'ext', L }; return none; }
    const out = { w, mode: c.useFE ? 'cont' : 'simple', L, x: L / 2 };
    let o;
    if (c.useFE) {
      const N = areas(c.fe), A = (x, k) => at(N, x, k);
      const MLLpos = x => ch.MLLpos(x) + w * A(x, 'Mp') * 12, MLLneg = x => ch.MLLneg(x) + w * A(x, 'Mn') * 12;
      const VLLpos = x => ch.VLLpos(x) + w * A(x, 'Vp'), VLLneg = x => ch.VLLneg(x) + w * A(x, 'Vn');
      o = { MLLpos, MLLneg, VLLpos, VLLneg,
        MLLx: x => { const p = MLLpos(x), n = MLLneg(x); return Math.abs(p) >= Math.abs(n) ? p : n; },   // the engine's feM rule on LL+IM + PL
        VLLx: x => Math.max(Math.abs(VLLpos(x)), Math.abs(VLLneg(x))),
        pierNeg: q => { const a = q.nd.ll.laneNeg / LANE, M = -w * a; (out.pier = out.pier || []).push({ side: q.side, A: a, M }); return M; } };
      out.AMp = A(L / 2, 'Mp'); out.AMn = A(L / 2, 'Mn'); out.AVp = N[0].Vp; out.AVn = N[0].Vn;
      out.Mmid = w * out.AMp; out.Vsup = w * Math.max(Math.abs(out.AVp), Math.abs(out.AVn));
    } else {
      const Mp = x => w * x * (L - x) / 2, Vp = x => w * (L - x) * (L - x) / (2 * L), Vn = x => -w * x * x / (2 * L);
      o = { MLLx: x => ch.MLLx(x) + Mp(x) * 12, MLLpos: x => ch.MLLpos(x) + Mp(x) * 12, MLLneg: ch.MLLneg,
        VLLx: x => { const xm = Math.min(x, L - x); return ch.VLLx(x) + Vp(xm); }, VLLpos: x => ch.VLLpos(x) + Vp(x), VLLneg: x => ch.VLLneg(x) + Vn(x), pierNeg: () => 0 };
      out.Mmid = Mp(L / 2); out.Vsup = Vp(0);
    }
    out.Mhl = ch.MLLpos(L / 2) / 12; out.Vhl = ch.VLLx(0);   // the engine's HL-93 + IM per girder at the same sections (display)
    LAST = out; return o;
  }
  // IMP-N (2026-11-23, engineer's decision): imported demands are used as given and are ASSUMED to include the pedestrian load (wording only)
  const WARN_EXT = 'Pedestrian live load: this girder type takes its composite-stage demands from an imported file or table, which are used as given. The imported live load must already include the pedestrian load of the Cross-section tab: it is NOT added by this app (AASHTO LRFD 10th Ed. 3.6.1.6).';
  /* run(inp, inner): inner(inp) (the app's engine call) with the global computeAll replaced by the copy for that call when the girder has a
     pedestrian load (restored after); R.pl = the pedestrian part. No pedestrian load: inner(inp), nothing else. */
  function run(inp, inner) {
    if (!(wOf(inp) > 0)) return inner(inp);
    const orig = W.computeAll, f = engine(); let R;
    LAST = null; W.computeAll = f;
    try { R = inner(inp); } finally { W.computeAll = orig; }
    if (R && !R.error && LAST) { R.pl = LAST; if (LAST.mode === 'ext' && Array.isArray(R.warns)) R.warns.push(WARN_EXT); }
    LAST = null; return R;
  }
  /* steps(add, inp, R, h): the worked steps of the pedestrian part (kit 'ld': ids ld.pl.*); h = { n, g, par } of engine/worked.js */
  function steps(add, inp, R, h) {
    const q = R && R.pl; if (!q) return;
    const n = h.n, L = q.L, w = q.w, ref = A10 + 'Art. 3.6.1.6';
    add({ id: 'pl.w', label: 'Pedestrian live load on this girder line', sym: 'w_{PL}', value: w, unit: 'klf', d: 4, ref,
      note: 'The girder line\'s share of the sidewalk load: 75 psf (or the value entered) on the walkable width of each sidewalk wider than 2.0 ft, distributed to the girder lines by the project\'s dead-load distribution method, as the Steel Bridge app (the distribution steps above: w_PL of the line). No distribution factor and no dynamic load allowance (3.6.2.1).' }, undefined, 'pl.w');
    if (q.mode === 'ext') { add({ id: 'pl.ext', label: 'Pedestrian live load not added: imported demands', sym: 'M_{PL}', value: 0, unit: 'kip-ft', d: 1, ref, note: WARN_EXT }); return; }
    if (q.mode === 'simple') {
      add({ id: 'pl.M', label: 'Pedestrian load moment at midspan (the span loaded)', sym: 'M_{PL}', eq: '\\frac{w_{PL}L^{2}}{8}', sub: `\\frac{${n(w, 4)}(${n(L, 2)})^{2}}{8}`, value: q.Mmid, unit: 'kip-ft', d: 1, ref,
        note: 'At a section x: M_PL(x) = w_PL x (L − x) / 2.' }, w * L * L / 8, 'pl.Mmid');
      add({ id: 'pl.V', label: 'Pedestrian load shear at the support', sym: 'V_{PL}', eq: '\\frac{w_{PL}L}{2}', sub: `\\frac{${n(w, 4)}(${n(L, 2)})}{2}`, value: q.Vsup, unit: 'kip', d: 2, ref,
        note: 'At a section x_m from the nearer support: V_PL = w_PL (L − x_m)² / (2 L) (the load on the + part of the shear influence line).' }, w * L / 2, 'pl.Vsup');
    } else {
      add({ id: 'pl.M', label: 'Pedestrian load moment at midspan (the + area of the moment influence line of the continuous unit)', sym: 'M_{PL}', eq: 'w_{PL}\\,A^{+}_{M}', sub: `${n(w, 4)}(${n(q.AMp, 1)})`, value: q.Mmid, unit: 'kip-ft', d: 1, ref,
        note: 'A⁺ (ft²): the positive area of the influence line, the area the engine loads with its 0.64 klf lane load (lane moment / 0.64); the − area gives the negative moment. As the Steel Bridge app.' }, w * q.AMp, 'pl.Mmid');
      add({ id: 'pl.V', label: 'Pedestrian load shear at the left support (the larger of the + and − areas of the shear influence line)', sym: 'V_{PL}', eq: 'w_{PL}\\max(|A^{+}_{V}|, |A^{-}_{V}|)', sub: `${n(w, 4)}\\max(${n(Math.abs(q.AVp), 2)}, ${n(Math.abs(q.AVn), 2)})`, value: q.Vsup, unit: 'kip', d: 2, ref }, w * Math.max(Math.abs(q.AVp), Math.abs(q.AVn)), 'pl.Vsup');
      (q.pier || []).forEach((p, i) => add({ id: 'pl.Mn' + i, label: `Pedestrian load negative moment at the ${p.side} pier (the − area of its influence line)`, sym: 'M_{PL,n}', eq: '-w_{PL}\\,A^{-}_{M}', sub: `-${n(w, 4)}(${h.par(p.A, 1)})`, value: p.M, unit: 'kip-ft', d: 1, ref,
        note: 'Added to the HL-93 negative moment at the pier (Flexure tab, pier section).' }, -w * p.A, `pl.pier.${i}.M`));
    }
    add({ id: 'pl.MLLPL', label: 'Live load moment at midspan the checks take: HL-93 with IM and DF, plus the pedestrian load', sym: 'M_{LL+IM+PL}', eq: 'M_{LL+IM} + M_{PL}', sub: `${n(q.Mhl, 1)} + ${n(q.Mmid, 1)}`, value: q.Mhl + q.Mmid, unit: 'kip-ft', d: 1, ref: A10 + 'Art. 3.6.1.6, Table 3.4.1-1',
      note: 'The pedestrian load acts with the vehicular live load and takes its load factor: Strength I 1.75, Service I 1.00, Service III γ_LL. In every "M_LL" / "V_LL" of the Analysis, Stresses, Flexure, Shear and Rating tabs (the Steel Bridge app also rates with PL in LL+IM). Not in the fatigue check (fatigue truck only, 3.6.1.4.1) nor in the live-load deflection (vehicular load, 2.5.2.6.2). The owner\'s design load multiplier m, where there is one, multiplies the whole term.' }, q.Mhl + q.Mmid);
    add({ id: 'pl.VLLPL', label: 'Live load shear at the support the checks take: HL-93 with IM and DF, plus the pedestrian load', sym: 'V_{LL+IM+PL}', eq: 'V_{LL+IM} + V_{PL}', sub: `${n(q.Vhl, 2)} + ${n(q.Vsup, 2)}`, value: q.Vhl + q.Vsup, unit: 'kip', d: 2, ref: A10 + 'Art. 3.6.1.6, Table 3.4.1-1' }, q.Vhl + q.Vsup);
  }
  /* note(K, R): the worked steps of a tab (kit.done()) with, on every step that takes the live load (M_LL, V_LL, f_LL in its equation or
     symbol), the note that it includes the pedestrian load, with the § of its derivation (CLAUDE.md §6). No pedestrian load: K itself. */
  const NOTE = 'LL+IM here includes the pedestrian live load (§ld.pl.MLLPL, Loads & LLDF tab).';
  function note(K, R) {
    if (W.PSBUT) K = W.PSBUT.note(K, R);   // UT-N: the steps that take DC1 also say that it includes the noncomposite utilities (engine/ut.js); none: K itself
    const q = R && R.pl; if (!q || q.mode === 'ext' || !K || !Array.isArray(K.steps)) return K;
    const re = /[MVf]_\{LL|M_\{u|V_\{u|M_\{s,I/;
    K.steps = K.steps.map(s => (re.test(s.eq || '') || /[MVf]_\{LL/.test(s.sym || '')) && !/ld\.pl\./.test(s.note || '') && !/^(ld|dk|hn)\./.test(s.id) && !/(^|\.)veh\d/.test(s.id) ? Object.assign({}, s, { note: (s.note ? s.note + ' ' : '') + NOTE }) : s);
    return K;
  }
  /* VplAt(R, x): the pedestrian part of the engine's shear envelope at x of a simple span (kip), 0 without PL (engine/worked-strength.js) */
  function VplAt(R, x) { const q = R && R.pl; if (!q || q.mode !== 'simple') return 0; const xm = Math.min(x, q.L - x); return q.w * (q.L - xm) * (q.L - xm) / (2 * q.L); }
  W.PSBPL = { NOTE, note, EDITS, LANE, WARN_EXT, engine, channels, run, steps, areas, at, wOf, VplAt };
})();
