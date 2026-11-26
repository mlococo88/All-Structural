/* apps/ps-bridge/engine/shear-sp.js — SH-SP: the stirrup spacing check and β for a section with less than A_v,min (window.PSBShearSp).
   Classic script, no DOM. Created 2026-11-25 (engineer, §4 calculation change approved 2026-11-25; fixlog/ps-bridge.md SH-SP).

   Code (cited and paraphrased, not copied): AASHTO LRFD 10th Ed. (2024)
     Art. 5.7.2.3, Eq. 5.7.2.3-1   transverse reinforcement is required where V_u > 0.5 φ (V_c + V_p) (slabs and footings excepted);
     Art. 5.7.2.5, Eq. 5.7.2.5-1   where it is required, A_v ≥ 0.0316 λ √f′c b_v s / f_y; for a given A_v that is a largest spacing
                                   s_Av,min = A_v f_y / (0.0316 λ √f′c b_v);
     Art. 5.7.2.6, Eq. 5.7.2.6-1/-2  s ≤ s_max = 0.8 d_v ≤ 24 in (v_u < 0.125 f′c), 0.4 d_v ≤ 12 in otherwise;
     Art. 5.7.3.4.2, Eq. 5.7.3.4.2-1  β = 4.8 / (1 + 750 ε_s) for a section with at least A_v,min of 5.7.2.5;
                     Eq. 5.7.3.4.2-2  β = 4.8 / (1 + 750 ε_s) × 51 / (39 + s_xe) for a section with less than A_v,min;
                     Eq. 5.7.3.4.2-3  θ = 29 + 3500 ε_s in both cases (unchanged);
                     Eq. 5.7.3.4.2-7  s_xe = s_x × 1.38 / (a_g + 0.63), 12.0 in ≤ s_xe ≤ 80.0 in; s_x the lesser of d_v and the largest
                                      distance between layers of longitudinal crack control reinforcement; a_g the maximum aggregate size.

   WHY A COPY OF computeAll. The moved engine (engine/pbd-*.js, verbatim, frozen) computes, at each shear station, spOK (the spacing above
   s_max,gov = min(s_max, s_Av,min) where stirrups are required) for its table, but never puts it in R.checks; and it takes β by Eq. -1 at
   every station, also where A_v < A_v,min. β feeds V_c, so V_n, V_u/φV_n, the governing station (R.wShear), the 5.7.2.3 test (stirReq,
   so spOK), the shear diagram (R.shearDiag: the rating along the span) and the engine's shear rating (R.shrRating, its V_DC / V_DW at the
   governing station from the engine's local shear functions). Those are local to computeAll, so a result cannot be corrected from outside
   without repeating the engine's arithmetic. As engine/pl.js and engine/ut.js do, this file runs a COPY of computeAll made at run time from
   the engine's own text (Function.prototype.toString) with the EDITS below, each anchor found exactly once (else an error is thrown, no
   silent fallback):
     1. the station β:  β = beta(ε_s, d_v, s, A_v, f_y, f′c, b_v).beta  (Eq. -1 where A_v ≥ A_v,min, Eq. -2 where A_v < A_v,min);
     2. the station row keeps that record as bq (eq 1 | 2, beta1, AvMin, sx, sxe, ag, f);
     3. the diagram β (R.shearDiag), the same rule;
     4. one check after "Shear": "Stirrup spacing (5.7.2.5, 5.7.2.6)" (check(R.shear)).
   Everything else is the engine's text. A design with at least A_v,min at every station and no spacing above the limit where stirrups are
   required gets the engine's own values; it gains the new check (PASS).

   The spacing check (Decision pending engineer review, SH-SP-1): over the design stations from the critical section inward (the bearing row
   excluded, as the Shear check) where stirrups are required (stirReq), ratio = s_prov / s_max,gov, the largest governs (v = s_prov, lim =
   s_max,gov, loc = its x, u = in); PASS when ≤ 1.0001 (the engine's rule). No station requires stirrups: ratio 0 (PASS). why: the text
   "NG — stirrup spacing 18 in > 9.47 in at x = 13.7–16.4 ft and 38.3–41.0 ft" when it fails (each run of consecutive failing stations).
   a_g = 0.75 in and s_x = d_v (no longitudinal crack control layers counted) (Decisions pending engineer review, SH-SP-2, SH-SP-3).

   beta(es, dv, s, Av, fy, fc, bw) -> { eq, low, beta1, beta, AvMin, sMinR, s, sx, sxe, ag, f }
   check(shear) -> the check;  run(inp, inner) -> inner(inp) with the global computeAll replaced by the copy for that call (restored after);
   engine(f) -> the copy of f (computeAll, or engine/pl.js's / engine/ut.js's copy of it), made once per source function. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const NAME = 'Stirrup spacing (5.7.2.5, 5.7.2.6)';
  const AG = 0.75;   // in, maximum aggregate size a_g (Eq. 5.7.3.4.2-7); not an input (Decision pending engineer review, SH-SP-2)
  const cl = (v, a, b) => Math.max(a, Math.min(b, v));
  /* beta: β at a station, Eq. 5.7.3.4.2-1 or -2 by A_v against A_v,min of Eq. 5.7.2.5-1 at the spacing s provided there */
  function beta(es, dv, s, Av, fy, fc, bw) {
    const beta1 = 4.8 / (1 + 750 * es);                              // Eq. 5.7.3.4.2-1
    const sMinR = Av * fy / (0.0316 * Math.sqrt(fc) * bw);           // the engine's s_Av,min (same expression), λ = 1.0
    const AvMin = 0.0316 * Math.sqrt(fc) * bw * s / fy;              // Eq. 5.7.2.5-1 at s
    const low = s > sMinR + 1e-3;                                    // A_v < A_v,min (the engine's spacing tolerance)
    const sx = dv, sxe = cl(sx * 1.38 / (AG + 0.63), 12, 80), f = 51 / (39 + sxe);   // Eq. 5.7.3.4.2-7
    return { eq: low ? 2 : 1, low, beta1, beta: low ? beta1 * f : beta1, AvMin, sMinR, s, sx, sxe, ag: AG, f };   // Eq. -2: beta1 × 51/(39 + s_xe)
  }
  const f2 = v => (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, '');
  const f1 = v => (+v).toFixed(1);
  /* check(shear): the stirrup spacing check over the design stations (R.shear rows, sorted by x) */
  function check(shear) {
    const S = shear.filter(r => !r.isBearing), req = S.filter(r => r.stirReq), rat = r => r.sProv / r.sMaxGov;
    if (!req.length) { const r0 = S[0] || shear[0]; return { n: NAME, v: r0.sProv, lim: r0.sMaxGov, r: 0, loc: r0.x, u: 'in', why: 'no station requires stirrups (5.7.2.3)' }; }
    const gv = req.reduce((b, r) => (rat(r) > rat(b) ? r : b), req[0]);
    const runs = []; let cur = null;
    S.forEach(r => { if (!r.spOK) { if (cur) cur.x1 = r.x; else runs.push(cur = { x0: r.x, x1: r.x }); } else cur = null; });
    const at = runs.map(q => (q.x1 > q.x0 ? `${f1(q.x0)}–${f1(q.x1)}` : f1(q.x0))).join(', ').replace(/, ([^,]*)$/, ' and $1');
    const why = runs.length ? `NG — stirrup spacing ${f2(gv.sProv)} in > ${f2(gv.sMaxGov)} in at x = ${at} ft` : '';
    return { n: NAME, v: gv.sProv, lim: gv.sMaxGov, r: rat(gv), loc: gv.x, u: 'in', why, runs };
  }
  /* the edits of the copy: [anchor (exactly once in computeAll's text), replacement] */
  const EDITS = [
    ['const beta=4.8/(1+750*es), theta=29+3500*es;',
      'const bq=window.PSBShearSp.beta(es,dv,(Math.min(x,L-x)<=inp.opt.endZoneLen*L)?+inp.opt.sEnd:+inp.opt.sInt,Av,fy,m.fc,g.bw);\n    const beta=bq.beta, theta=29+3500*es;'],
    ['Tdem,Tcap,fpsAvail,TsMild,longOK,cot,phiVn:phiV*Vn,stirReq,sMaxGov,spOK,', 'Tdem,Tcap,fpsAvail,TsMild,longOK,cot,phiVn:phiV*Vn,stirReq,sMaxGov,spOK,bq,'],
    ['const beta=4.8/(1+750*es), theta=29+3500*es, cot=1/Math.tan(theta*Math.PI/180);',
      'const bq=window.PSBShearSp.beta(es,dv,(xm<=inp.opt.endZoneLen*L)?+inp.opt.sEnd:+inp.opt.sInt,Av,fy,m.fc,g.bw);\n    const beta=bq.beta, theta=29+3500*es, cot=1/Math.tan(theta*Math.PI/180);'],
    ["{n:'Shear',v:wShear.Vu,lim:phiV*wShear.Vn,r:wShear.dc,loc:wShear.x,u:'kip'},", "{n:'Shear',v:wShear.Vu,lim:phiV*wShear.Vn,r:wShear.dc,loc:wShear.x,u:'kip'},\n    window.PSBShearSp.check(shear),"]
  ];
  const COPIES = new Map();
  function engine(f) {
    f = f || W.computeAll;
    if (f && f.psbSP) return f;
    if (COPIES.has(f)) return COPIES.get(f);
    let src = f.toString();
    EDITS.forEach(([a, b]) => { const k = src.split(a).length - 1; if (k !== 1) throw new Error(`PSBShearSp: the engine text has ${k} matches of an edit anchor (expected 1): ${a.slice(0, 60)}`); src = src.replace(a, () => b); });
    const c = (0, eval)('(' + src.replace(/^function\s+\w+\s*\(/, 'function computeAllSP(') + ')');
    c.psbSP = true; COPIES.set(f, c); return c;
  }
  function run(inp, inner) {
    const orig = W.computeAll, f = engine(orig);
    if (f === orig) return inner(inp);
    W.computeAll = f;
    try { return inner(inp); } finally { W.computeAll = orig; }
  }
  W.PSBShearSp = { NAME, AG, EDITS, beta, check, engine, run };
})();
