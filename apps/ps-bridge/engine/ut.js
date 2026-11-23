/* apps/ps-bridge/engine/ut.js — UT-N: utilities on the noncomposite section (UT) and the future utility allowance (UF) in the girder design
   (window.PSBUT). Classic script, no DOM. Created 2026-11-23 (engineer request, 2026-11-23: "add to Prestressed the two utility categories
   the Steel Bridge app has"; fixlog/ps-bridge.md UT-N). Mirrors the Steel Bridge app (apps/steel-bridge/engine/loads.js CATS UT / UF and
   dead(): the line loads and their distribution; engine/analysis.js: both on the noncomposite section; engine/flexure.js envelopeStrI /
   location: UT with the DW load factors, UF with γ_DC maximum or 0; engine/rating.js: UT with DW, UF with DC, each only where it adds; its
   fixlog entry OWN16: existing utilities in the camber, the future allowance not).

   Code (cited, not copied): AASHTO LRFD 10th Ed. (2024) Art. 3.5.1 (DW: wearing surfaces and utilities), Table 3.4.1-1 (Strength I,
   Service I / III) and Table 3.4.1-2 (γ_p: DC 1.25 / 0.90, DW 1.50 / 0.65). The noncomposite stage and the allowance's 1.25 / 0 are the
   Steel Bridge app's definitions (its basis: MassDOT LRFD Bridge Manual Part I 3.5.5.4 and 3.5.5.2), offered here for every owner as there.

   What the two loads are here (w_UT, w_UF: the girder line's shares, klf, engine/bridge-dl.js; inputs.ut = { wUT, wUF, wNC0 }):
     UT  a utility carried by the precast girder alone (hung before the deck acts): Strength I γ = 1.50 where it adds to the effect and
         0.65 where it relieves it (a negative share); Service I / III 1.00, on the girder section; a sustained load like DC1 in the
         losses (elastic gain, Δf_cd), the camber, the restraint moments and the fatigue permanent stress; in the rating with DW.
     UF  an allowance for a utility that may be installed later: the same section; Strength I γ = 1.25 or 0, Service 1.00 or 0: PRESENT
         or ABSENT, whichever governs each check; never in the camber (as the Steel Bridge app).

   HOW THEY REACH THE FROZEN ENGINE (CLAUDE.md §4; the moved engine engine/pbd-*.js is NOT edited):
     1. Both shares are added to the engine's own input for a noncomposite line load, loads.wNC ("DC1 additional": engine/design.js
        one(), as the DC1 line loads of PR 9). The engine then carries them exactly as DC1: moments and shears on the simple span, the
        stresses on the girder section, the elastic gain and Δf_cd, the restraint moments, the fatigue permanent stress, Service III
        rating, γ_DC = 1.25 at Strength I. That is already the whole of UF "present".
     2. UT needs 1.50 where the engine gives DC1 1.25. Its Strength I combinations are local expressions of computeAll that feed the
        MCFT shear iteration, the longitudinal tie and the minimum reinforcement, so a correction after the engine cannot be exact. For a
        girder WITH such a load this file therefore runs a copy of computeAll made at run time from the engine's own text, as
        engine/pl.js does for the pedestrian load, with the EDITS below: each wraps one expression in a function of terms() that returns
        its argument unchanged when there is no load (so the copy with zero loads IS the engine, bit for bit:
        tests/engine/psbridge-ut.test.mjs, every parity case at tolerance 0) and otherwise adds
          Strength I moment and shear:  + (γ_UT − 1.25) M_UT(x),  + (γ_UT − 1.25) V_UT(x)      (γ_UT = 1.50; 0.65 for a negative share)
          the Analysis table's negative envelope:  UT at its other factor and UF absent
          the engine's rating:  M_UT, V_UT moved from DC to DW (γ_DW; a negative share kept in DC at 0.65 / 1.25)
          the deck-stage deflection Δ_dk:  w_DC1 − w_UF (UF not in the camber).
        Every anchor must be found the stated number of times, else an error is thrown (no silent fallback).
     3. UF "absent": with w_UF ≠ 0 the engine is run a second time without it (run()). The results shown are those with the allowance
        present; a check whose ratio is larger with the allowance absent is added to R.checks as "UF absent: <check>" (its own value,
        limit and PASS / FAIL), so it counts in the check summary, the Summary, the Report and Auto design. Each state is computed whole
        (a load that is absent gives no elastic gain, no restraint moment, no relief), so no check relies on a load that may not be there.
   A girder WITHOUT these loads (every project saved before; no inputs.ut) runs the engine's own computeAll: nothing here is used.

   run(inp, inner) -> R with R.ut = { wUT, wUF, wNC0, L, gUT, MUT, MUF, VUT, VUF (midspan kip-ft, support kip), dMu, dVu, fb, ft, gain,
     dUT, [abs: { rows: [{ n, rP, rA, gov }], gov: [check names], warns }] }.
   steps(add, inp, R, h): the worked steps (ids ld.ut.*, Loads & LLDF tab and Report). at(R, x): the parts at a section for the other
   tabs' steps. note(K, R): the § note on every step that takes DC1. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const G_DC = 1.25, G_DW = 1.50, G_DWMIN = 0.65;
  const PRE = 'UF absent: ';
  /* the edits of the copy: [anchor, replacement, the number of times the anchor is in computeAll's text] */
  const EDITS = [
    ['  const MofW=(w,x)=>w*x*(L-x)/2*12;', '  const UT_=window.PSBUT.terms(inp,L);\n  const MofW=(w,x)=>w*x*(L-x)/2*12;', 1],
    ['Mu:eta*(1.25*(Mg+Mdk+Mdc2(x))+1.5*Mdw(x)+1.75*(mLL*Mll)+mrp)', 'Mu:eta*(UT_.aM(1.25*(Mg+Mdk+Mdc2(x))+1.5*Mdw(x)+1.75*(mLL*Mll),x)+mrp)', 1],
    ['const vdl=1.25*(Vg(x)+Vdc1(x)+Vdc2(x))+1.5*Vdw(x);', 'const vdl=UT_.aV(1.25*(Vg(x)+Vdc1(x)+Vdc2(x))+1.5*Vdw(x),x);', 2],
    ['const mStrI_p=eta*(1.25*mDC+1.5*mdw+1.75*(mLL*mllp)), mStrI_n=eta*(1.25*mDC+1.5*mdw+1.75*(mLL*mlln));',
      'const mStrI_p=eta*UT_.aMp(1.25*mDC+1.5*mdw+1.75*(mLL*mllp),x), mStrI_n=eta*UT_.aMn(1.25*mDC+1.5*mdw+1.75*(mLL*mlln),x);', 1],
    ['const vStrI_p=eta*(1.25*vDC+1.5*vdw+1.75*(mLL*vllp)), vStrI_n=eta*(1.25*vDC+1.5*vdw+1.75*(mLL*vlln));',
      'const vStrI_p=eta*UT_.aV(1.25*vDC+1.5*vdw+1.75*(mLL*vllp),x), vStrI_n=eta*UT_.aV(1.25*vDC+1.5*vdw+1.75*(mLL*vlln),x);', 1],
    ['const MDCmid=(Mg(L/2)+Mdc1(L/2)+Mdc2(L/2))/12;', 'const MDCmid=UT_.rDC((Mg(L/2)+Mdc1(L/2)+Mdc2(L/2))/12,L/2);', 1],
    ['const MDWmid=Mdw(L/2)/12;', 'const MDWmid=UT_.rDW(Mdw(L/2)/12,L/2);', 1],
    ['const V_DCr=Math.abs(Vg(vsx)+Vdc1(vsx)+Vdc2(vsx));', 'const V_DCr=Math.abs(UT_.rVDC(Vg(vsx)+Vdc1(vsx)+Vdc2(vsx),vsx));', 1],
    ['const V_DWr=Math.abs(Vdw(vsx));', 'const V_DWr=Math.abs(UT_.rVDW(Vdw(vsx),vsx));', 1],
    ['const dDK=5*(wDk/12)*Lin**4/(384*Ecf*Ig);', 'const dDK=5*(UT_.wCam(wDk)/12)*Lin**4/(384*Ecf*Ig);', 1]
  ];
  const COPIES = new Map();
  let LAST = null;   // the loads of the engine call in progress (terms()), for at() before R.ut exists (engine/rating-along.js apply runs inside the call)
  /* engine(f): the copy of f (the engine's computeAll, or engine/pl.js's copy of it when the girder also has a pedestrian load) with the
     edits; made once per source function */
  function engine(f) {
    f = f || W.computeAll;
    if (COPIES.has(f)) return COPIES.get(f);
    let src = f.toString();
    EDITS.forEach(([a, b, k0]) => { const k = src.split(a).length - 1; if (k !== k0) throw new Error(`PSBUT: the engine text has ${k} matches of an edit anchor (expected ${k0}): ${a.slice(0, 60)}`); src = src.split(a).join(b); });
    const c = (0, eval)('(' + src.replace(/^function\s+\w+\s*\(/, 'function computeAllUT(') + ')');
    COPIES.set(f, c); return c;
  }
  const num = v => (typeof v === 'number' && isFinite(v) ? v : 0);
  /* of(inp): { wUT, wUF, wNC0 } of the inputs, or null when the girder has neither load */
  function of(inp) {
    const u = inp && inp.ut; if (!u) return null;
    const wUT = num(+u.wUT), wUF = num(+u.wUF); if (wUT === 0 && wUF === 0) return null;
    return { wUT, wUF, wNC0: num(+u.wNC0) };
  }
  /* γ of UT where the effect is the one a downward load adds to (the positive moment, the dead-load shear): 1.50, or 0.65 for a negative
     share (it relieves); the other way round for the opposite effect (the negative envelope). UF: 1.25 where it adds, else absent. */
  const gAdd = w => (w >= 0 ? G_DW : G_DWMIN), gRel = w => (w >= 0 ? G_DWMIN : G_DW);
  /* terms(inp, L): the functions the copy calls (moments kip-in at the engine's stations unless noted; shears kip). No load: identities. */
  function terms(inp, L) {
    const u = of(inp), id = v => v;
    if (!u) { LAST = null; return { aM: id, aV: id, aMp: id, aMn: id, rDC: id, rDW: id, rVDC: id, rVDW: id, wCam: id }; }
    LAST = { wUT: u.wUT, wUF: u.wUF, L, gUT: gAdd(u.wUT), gUTn: gRel(u.wUT) };
    const { wUT, wUF } = u, M = (w, x) => w * x * (L - x) / 2, V = (w, x) => w * (L / 2 - x);   // kip-ft, kip (simple span, the girder alone)
    const k = gAdd(wUT) - G_DC, kn = gRel(wUT) - G_DC, kf = wUF >= 0 ? -G_DC : 0;   // negative envelope: UF absent when it relieves
    const dc = wUT >= 0 ? 1 : 1 - G_DWMIN / G_DC;   // the part of UT taken out of DC in the rating (a negative share stays, at 0.65 / 1.25)
    return {
      aM: wUT ? (v, x) => v + k * M(wUT, x) * 12 : id,                                   // Strength I moment, kip-in
      aV: wUT ? (v, x) => v + k * V(wUT, x) : id,                                        // Strength I dead-load shear, kip
      aMp: wUT ? (v, x) => v + k * M(wUT, x) : id,                                       // Analysis table, + envelope, kip-ft
      aMn: (v, x) => v + kn * M(wUT, x) + kf * M(wUF, x),                                // Analysis table, − envelope, kip-ft
      rDC: wUT ? (v, x) => v - dc * M(wUT, x) : id, rDW: wUT > 0 ? (v, x) => v + M(wUT, x) : id,       // rating, kip-ft
      rVDC: wUT ? (v, x) => v - dc * V(wUT, x) : id, rVDW: wUT > 0 ? (v, x) => v + V(wUT, x) : id,     // rating, kip
      wCam: wUF ? w => w - wUF : id                                                      // Δ_dk without the allowance, klf
    };
  }
  /* info(inp, R, u): R.ut, the values shown (midspan and support; kip-ft, kip, ksi, in) */
  function info(inp, R, u) {
    const L = R.L, { wUT, wUF, wNC0 } = u, G = R.g, lo = R.lo, ss = R.ss;
    const MUT = wUT * L * L / 8, MUF = wUF * L * L / 8, VUT = wUT * L / 2, VUF = wUF * L / 2, gUT = gAdd(wUT);
    const o = { wUT, wUF, wNC0, L, x: L / 2, gUT, gUTn: gRel(wUT), MUT, MUF, VUT, VUF, dMu: (gUT - G_DC) * MUT, dVu: (gUT - G_DC) * VUT,
      MuU: gUT * MUT + G_DC * MUF, fb: -(MUT + MUF) * 12 / G.Sb, ft: (MUT + MUF) * 12 / G.St };
    if (lo && ss && lo.Ep > 0 && lo.Ecf > 0) o.gain = lo.Ep / lo.Ecf * ((MUT + MUF) * 12 * ss.eMid / G.I);
    if (R.cp && R.cp.Ecg > 0) o.dUT = 5 * (wUT / 12) * Math.pow(L * 12, 4) / (384 * R.cp.Ecg * G.I);
    return o;
  }
  const fin = v => typeof v === 'number' && isFinite(v);
  /* merge(R, RA): the checks of the allowance-absent run RA that give a larger ratio than with it present (R): each added to R.checks as
     "UF absent: <check>" with its own value, limit and PASS / FAIL. R's own checks are unchanged. */
  function merge(R, RA) {
    const rows = [], gov = [], used = new Set();
    (R.checks || []).forEach(c => {
      const j = (RA.checks || []).findIndex((a, i) => !used.has(i) && a.n === c.n);
      if (j < 0) { rows.push({ n: c.n, rP: c.r, rA: null, gov: 'present' }); return; }
      used.add(j); const a = RA.checks[j];
      const more = (fin(a.r) && fin(c.r) && a.r > c.r * (1 + 1e-9) + 1e-12) || (!fin(a.r) && fin(c.r)) || (a.pass === false && c.pass !== false);
      rows.push({ n: c.n, rP: c.r, rA: a.r, gov: more ? 'absent' : 'present' });
      if (more) gov.push(Object.assign({}, a, { n: PRE + c.n, uf: 'absent', rP: c.r }));
    });
    (RA.checks || []).forEach((a, i) => { if (!used.has(i)) { rows.push({ n: a.n, rP: null, rA: a.r, gov: 'absent' }); gov.push(Object.assign({}, a, { n: PRE + a.n, uf: 'absent', rP: null })); } });
    gov.forEach(c => R.checks.push(c));
    const warns = (RA.warns || []).filter(w => !(R.warns || []).includes(w)).map(w => 'Future utility allowance absent: ' + w);
    if (Array.isArray(R.warns)) warns.forEach(w => R.warns.push(w));
    R.ut.abs = { rows, gov: gov.map(c => c.n), warns, n: gov.length };
  }
  const J = v => JSON.parse(JSON.stringify(v));
  /* run(inp, inner): inner(inp) (the app's engine call) with the global computeAll replaced by the copy for that call (restored after)
     when the girder has a noncomposite utility or allowance; with an allowance, also the run without it (first), merged. No such load:
     inner(inp), nothing else. */
  function run(inp, inner) {
    const u = of(inp); if (!u) return inner(inp);
    const orig = W.computeAll, f = engine(orig);
    const call = i => { W.computeAll = f; LAST = null; try { return inner(i); } finally { W.computeAll = orig; LAST = null; } };
    let RA = null;
    if (u.wUF !== 0) { const iA = J(inp); iA.loads.wNC = u.wNC0 + u.wUT; iA.ut = { wUT: u.wUT, wUF: 0, wNC0: u.wNC0 }; RA = call(iA); }
    const R = call(inp);
    if (R && !R.error) {
      R.ut = info(inp, R, u);
      if (RA && !RA.error && Array.isArray(R.checks)) merge(R, RA);
      else if (RA && RA.error && Array.isArray(R.warns)) R.warns.push('Future utility allowance: the design could not be computed with the allowance absent (' + RA.error + '); only the state with the allowance present is checked.');
    }
    return R;
  }
  /* at(R, x): the utility parts at x of the span (kip-ft, kip) for the worked steps of the other tabs, or null without them:
     { MUT, MUF, VUT, VUF, gUT, k (= γ_UT − 1.25), dM, dV } */
  function at(R, x) {
    const q = (R && R.ut) || (R && !R.error && LAST && R.L === LAST.L ? LAST : null); if (!q) return null;
    const L = q.L, M = w => w * x * (L - x) / 2, V = w => w * (L / 2 - x), k = q.gUT - G_DC;
    return { MUT: M(q.wUT), MUF: M(q.wUF), VUT: V(q.wUT), VUF: V(q.wUF), gUT: q.gUT, gUTn: q.gUTn, k, dM: k * M(q.wUT), dV: k * V(q.wUT), dc: q.wUT >= 0 ? 1 : 1 - G_DWMIN / G_DC, add: q.wUT > 0 };
  }
  /* steps(add, inp, R, h): the worked steps (kit 'ld': ids ld.ut.*); h = { n, g, par } of engine/worked.js */
  function steps(add, inp, R, h) {
    const q = R && R.ut; if (!q) return;
    const n = h.n, par = h.par, L = q.L, G = R.g, hasT = q.wUT !== 0, hasF = q.wUF !== 0, steel = 'as the Steel Bridge app';
    const refT = A10 + 'Art. 3.5.1, Table 3.4.1-2', refF = A10 + 'Table 3.4.1-2';
    if (hasT) add({ id: 'ut.wUT', label: 'Utility on the noncomposite section: this girder line\'s share', sym: 'w_{UT}', value: q.wUT, unit: 'klf', d: 4, ref: refT,
      note: 'The line\'s share of the utility line loads of category "Utility (noncomposite, DW factors)" of the Cross-section tab (the distribution steps: w_UT of the line), ' + steel + '. Carried by the precast girder alone (hung before the deck acts).' }, undefined, 'ut.wUT');
    if (hasF) add({ id: 'ut.wUF', label: 'Future utility allowance on the noncomposite section: this girder line\'s share', sym: 'w_{UF}', value: q.wUF, unit: 'klf', d: 4, ref: refF,
      note: 'The line\'s share of the line loads of category "Future utility allowance (noncomposite, γ 1.25/0)" (the distribution steps: w_UF of the line), ' + steel + '. A load that may or may not be installed: present or absent, whichever governs each check.' }, undefined, 'ut.wUF');
    add({ id: 'ut.wNC', label: 'Noncomposite line load the engine takes (DC1 additional), with the utilities', sym: 'w_{NC}', eq: `w_{NC,0}${hasT ? ' + w_{UT}' : ''}${hasF ? ' + w_{UF}' : ''}`,
      sub: `${n(q.wNC0, 4)}${hasT ? ` + ${par(q.wUT, 4)}` : ''}${hasF ? ` + ${par(q.wUF, 4)}` : ''}`, value: +inp.loads.wNC, unit: 'klf', d: 4,
      note: 'w_NC,0: the entered DC1 additional load plus the line\'s share of the DC1 line loads. The utilities act on the simple span and the girder section as DC1 does, so every "DC1" of the other tabs (w_DC1, M_DC1, V_DC1) includes them; their load factors are worked below.' },
      q.wNC0 + (hasT ? q.wUT : 0) + (hasF ? q.wUF : 0));
    const mom = (id, key, sym, w, lab) => add({ id, label: `${lab}: moment at midspan (simple span, the girder alone)`, sym: `M_{${sym}}`, eq: `\\frac{w_{${sym}}L^{2}}{8}`, sub: `\\frac{${par(w, 4)}(${n(L, 2)})^{2}}{8}`, value: q[key], unit: 'kip-ft', d: 1,
      note: `At a section x: M_${sym}(x) = w_${sym} x (L − x) / 2. Also when the spans are made continuous (a load of the noncomposite stage).` }, w * L * L / 8, 'ut.' + key);
    const shr = (id, key, sym, w, lab) => add({ id, label: `${lab}: shear at the support`, sym: `V_{${sym}}`, eq: `\\frac{w_{${sym}}L}{2}`, sub: `\\frac{${par(w, 4)}(${n(L, 2)})}{2}`, value: q[key], unit: 'kip', d: 2,
      note: `At a section x: V_${sym}(x) = w_${sym} (L/2 − x).` }, w * L / 2, 'ut.' + key);
    if (hasT) { mom('ut.MUT', 'MUT', 'UT', q.wUT, 'Utility'); shr('ut.VUT', 'VUT', 'UT', q.wUT, 'Utility'); }
    if (hasF) { mom('ut.MUF', 'MUF', 'UF', q.wUF, 'Future utility allowance'); shr('ut.VUF', 'VUF', 'UF', q.wUF, 'Future utility allowance'); }
    if (hasT) {
      add({ id: 'ut.gUT', label: 'Strength I load factor of the utility', sym: '\\gamma_{UT}', value: q.gUT, unit: '', d: 2, ref: A10 + 'Table 3.4.1-2',
        note: q.wUT >= 0 ? 'γ_DW maximum 1.50: the utility adds to the positive moment and to the dead-load shear everywhere on the simple span. Where it relieves an effect (the negative-moment rating of a continuous unit, the negative envelope of the Analysis table) it takes the minimum 0.65. Service I / III: 1.00.'
          : 'A negative share (the lever rule lifts this line): it relieves the positive moment, so it takes the minimum γ_DW 0.65; 1.50 where it adds to an effect. Service I / III: 1.00.' });
      add({ id: 'ut.dMu', label: 'Strength I: the utility\'s moment above the γ_DC the engine gives DC1, at midspan', sym: '\\Delta M_{u,UT}', eq: '(\\gamma_{UT} - 1.25)\\,M_{UT}', sub: `(${n(q.gUT, 2)} - 1.25)(${par(q.MUT, 1)})`, value: q.dMu, unit: 'kip-ft', d: 1, ref: A10 + 'Table 3.4.1-1, 3.4.1-2',
        note: 'M_DC1 holds M_UT and carries 1.25; this term brings the utility to γ_UT. It is the "+ (γ_UT − 1.25) M_UT" of M_u on the Analysis and Flexure tabs (× η).' }, (q.gUT - G_DC) * q.MUT, 'ut.dMu');
      add({ id: 'ut.dVu', label: 'Strength I: the utility\'s shear above the γ_DC the engine gives DC1, at the support', sym: '\\Delta V_{u,UT}', eq: '(\\gamma_{UT} - 1.25)\\,V_{UT}', sub: `(${n(q.gUT, 2)} - 1.25)(${par(q.VUT, 2)})`, value: q.dVu, unit: 'kip', d: 2, ref: A10 + 'Table 3.4.1-1, 3.4.1-2',
        note: 'The "+ (γ_UT − 1.25) V_UT" of V_u on the Analysis and Shear tabs, at each section with V_UT(x).' }, (q.gUT - G_DC) * q.VUT, 'ut.dVu');
    }
    add({ id: 'ut.MuU', label: 'Strength I factored moment of the utilities at midspan', sym: 'M_{u,U}', eq: `${hasT ? '\\gamma_{UT}M_{UT}' : ''}${hasT && hasF ? ' + ' : ''}${hasF ? '1.25\\,M_{UF}' : ''}`,
      sub: `${hasT ? `${n(q.gUT, 2)}(${par(q.MUT, 1)})` : ''}${hasT && hasF ? ' + ' : ''}${hasF ? `1.25(${par(q.MUF, 1)})` : ''}`, value: q.MuU, unit: 'kip-ft', d: 1, ref: A10 + 'Table 3.4.1-1, 3.4.1-2',
      note: `What the utilities add to M_u at midspan (× η), ${steel}: UT with the DW factor${hasF ? ', UF with 1.25 when present (0 when absent)' : ''}. In M_u it is 1.25 (M_UT + M_UF) inside the DC1 term${hasT ? ' plus ΔM_u,UT' : ''}.` },
      (hasT ? q.gUT * q.MUT : 0) + (hasF ? G_DC * q.MUF : 0), 'ut.MuU');
    add({ id: 'ut.fb', label: 'Service I / III: bottom-fibre stress of the utilities at midspan, on the girder section', sym: 'f_{b,U}', eq: `-\\frac{12(${hasT ? 'M_{UT}' : ''}${hasT && hasF ? ' + ' : ''}${hasF ? 'M_{UF}' : ''})}{S_{b}}`,
      sub: `-\\frac{12(${hasT ? par(q.MUT, 1) : ''}${hasT && hasF ? ' + ' : ''}${hasF ? par(q.MUF, 1) : ''})}{${n(G.Sb, 0)}}`, value: q.fb, unit: 'ksi', d: 4, ref: A10 + 'Table 3.4.1-1',
      note: 'Compression positive. γ = 1.00; S_b of the precast girder alone (§sec.g.Sb), as DC1: it is inside the (M_g + M_DC1)/S_b term of every Service I and Service III stress (Stresses tab), of the fatigue permanent stress and of the Service III rating.' + (hasF ? ' With the allowance absent the M_UF part is not there (below).' : '') },
      -((hasT ? q.MUT : 0) + (hasF ? q.MUF : 0)) * 12 / G.Sb, 'ut.fb');
    add({ id: 'ut.ft', label: 'Service I: top-fibre stress of the utilities at midspan, on the girder section', sym: 'f_{t,U}', eq: `\\frac{12(${hasT ? 'M_{UT}' : ''}${hasT && hasF ? ' + ' : ''}${hasF ? 'M_{UF}' : ''})}{S_{t}}`,
      sub: `\\frac{12(${hasT ? par(q.MUT, 1) : ''}${hasT && hasF ? ' + ' : ''}${hasF ? par(q.MUF, 1) : ''})}{${n(G.St, 0)}}`, value: q.ft, unit: 'ksi', d: 4, ref: A10 + 'Table 3.4.1-1', note: 'Compression positive; S_t of the precast girder alone (§sec.g.St).' },
      ((hasT ? q.MUT : 0) + (hasF ? q.MUF : 0)) * 12 / G.St, 'ut.ft');
    if (q.gain != null) add({ id: 'ut.gain', label: 'Losses: the utilities\' part of the elastic gain of DC1 at midspan', sym: '\\Delta f_{p,U}', eq: `\\frac{E_{p}}{E_{c}}\\,\\frac{12(${hasT ? 'M_{UT}' : ''}${hasT && hasF ? ' + ' : ''}${hasF ? 'M_{UF}' : ''})\\,e_{m}}{I}`,
      sub: `\\frac{${n(R.lo.Ep, 0)}}{${n(R.lo.Ecf, 0)}}\\,\\frac{12(${n(q.MUT + q.MUF, 1)})(${n(R.ss.eMid, 3)})}{${n(G.I, 0)}}`, value: q.gain, unit: 'ksi', d: 3, ref: A10 + '5.9.3.2.3a, 5.9.3.4.3',
      note: 'A sustained load on the girder section like DC1: it is in the elastic gain of the deck-stage loads and in Δf_cd of the creep loss (Losses tab), through M_DC1.' + (hasF ? ' The allowance gives its gain only in the state where it is present; the state with it absent is computed without it.' : '') },
      R.lo.Ep / R.lo.Ecf * ((q.MUT + q.MUF) * 12 * R.ss.eMid / G.I), 'ut.gain');
    if (hasT && q.dUT != null) add({ id: 'ut.cam', label: 'Camber: the utility\'s part of the deck-stage deflection Δ_dk', sym: '\\Delta_{UT}', eq: '\\frac{5\\,w_{UT}L^{4}}{384\\,E_{c}I_{g}}', sub: `\\frac{5(${n(q.wUT / 12, 5)})(${n(L * 12, 0)})^{4}}{384(${n(R.cp.Ecg, 0)})(${n(G.I, 0)})}`, value: q.dUT, unit: 'in', d: 3,
      note: 'Downward; inside Δ_dk (Camber & deflection tab), ' + steel + ' (existing utilities in the camber).' + (hasF ? ' The future utility allowance is NOT in the camber: Δ_dk is computed with w_DC1 − w_UF.' : '') }, 5 * (q.wUT / 12) * Math.pow(L * 12, 4) / (384 * R.cp.Ecg * G.I), 'ut.dUT');
    else if (hasF) add({ id: 'ut.cam', label: 'Camber: the future utility allowance is not in the camber', sym: 'w_{dk}', eq: 'w_{DC1} - w_{UF}', sub: `${n(R.wDk, 4)} - ${par(q.wUF, 4)}`, value: R.wDk - q.wUF, unit: 'klf', d: 4,
      note: 'The line load of the deck-stage deflection Δ_dk (Camber & deflection tab), ' + steel + '.' }, R.wDk - q.wUF);
    if (hasF) add({ id: 'ut.abs', label: 'Future utility allowance absent: checks with a larger ratio than with it present', sym: 'n_{abs}', value: q.abs ? q.abs.n : 0, unit: 'checks', d: 0, ref: refF,
      note: q.abs ? (q.abs.n ? `The design is also computed without the allowance (γ = 0). Larger ratio with it absent: ${q.abs.rows.filter(r => r.gov === 'absent').map(r => `${r.n} ${fin(r.rA) ? r.rA.toFixed(3) : '—'} (present ${fin(r.rP) ? r.rP.toFixed(3) : '—'})`).join('; ')}. Each is in the check summary as "UF absent: …"; the values worked on the tabs are with the allowance present.`
        : 'The design is also computed without the allowance (γ = 0): no check has a larger ratio with it absent, so the state with it present governs every check (the values worked on the tabs).') : 'The state with the allowance absent could not be computed (design warnings).' });
  }
  /* note(K, R): the worked steps of a tab with, on every step whose equation takes DC1, the note that DC1 includes the utilities, with the
     § of their derivation (CLAUDE.md §6). No such load: K itself. */
  const NOTE = 'DC1 here includes the noncomposite utilities of this girder line (§ld.ut.wNC, Loads & LLDF tab).';
  function note(K, R) {
    const q = R && R.ut; if (!q || !K || !Array.isArray(K.steps)) return K;
    const re = /_\{DC1\}|_\{DC\}|_\{DC,|w_\{dk\}|_\{d,nc\}|_\{dnc\}|_\{nc\}|M_\{deck\}|M_\{u\}|V_\{u\}|M_\{s,I/;
    K.steps = K.steps.map(s => (re.test(s.eq || '') || /_\{DC1\}/.test(s.sym || '')) && !/ld\.ut\./.test(s.note || '') && !/^(ld\.ut|dk|hn|dl)\./.test(s.id) && !/(^|\.)veh\d/.test(s.id) ? Object.assign({}, s, { note: (s.note ? s.note + ' ' : '') + NOTE }) : s);
    return K;
  }
  W.PSBUT = { NOTE, PRE, EDITS, G_DC, G_DW, G_DWMIN, engine, of, terms, run, at, steps, note, merge };
})();
