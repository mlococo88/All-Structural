/* apps/ps-bridge/engine/lldf-fg.js — PS-35: the live-load distribution factors of adjacent box beams and voided slabs, AASHTO LRFD 10th Ed.
   cross-section types (f) and (g) of Table 4.6.2.2.1-1 (window.PSBLldfFG). Classic script, no DOM. Created 2026-11-14 (engineer decision
   PS-35, 2026-11-14).

   AN ENGINE CHANGE MADE APP-SIDE (CLAUDE.md §4; fixlog/ps-bridge.md PS-35), as engine/rigid.js (PS-19): the moved engine (engine/pbd-*.js,
   verbatim, frozen) is NOT edited. Its distFactors (pbd-lldf-flexure.js) gives every shape but NEXT the I-girder type (k) equations, with
   K_g / (12 L t_s³); with no topping (t_s = 0, guarded to 1e-6) that term grows without bound (BI-36, 60 ft: DF_M ≈ 1.8–2.0). For a box beam
   or a VOIDED deck slab (girderGross: isBox, or isDeck with voids and not solid) this file replaces the engine's result by the type (f)
   (precast boxes with shear keys and a cast-in-place overlay: t_s > 0) / (g) (integral concrete deck: t_s = 0) factors. I-girders, NEXT and
   the solid deck slabs keep the engine's own result, byte for byte (the old app gives the solid slabs type (k) as well: unchanged, PS35-D6).

   The equations (AASHTO LRFD 10th Ed.; b = beam width in, L = span ft, N_b = beams, I, J in⁴, d_e ft, d = beam depth in; cited, not copied):
     interior moment  Table 4.6.2.2.2b-1, (f)/(g):  k = max(2.5 N_b^−0.2, 1.5);  one lane g_M1 = k (b / 33.3 L)^0.5 (I / J)^0.25;
                      two or more g_M2 = k (b / 305)^0.6 (b / 12 L)^0.2 (I / J)^0.06;  range 35 ≤ b ≤ 60, 20 ≤ L ≤ 120, 5 ≤ N_b ≤ 20
     interior shear   Table 4.6.2.2.3a-1:  one lane g_V1 = (b / 130 L)^0.15 (I / J)^0.05;  two or more g_V2 = (b / 156)^0.4 (b / 12 L)^0.1
                      (I / J)^0.05 (b / 48), b / 48 ≥ 1.0;  range as moment plus 25,000 ≤ J ≤ 610,000, 40,000 ≤ I ≤ 610,000 (outside it
                      4.6.2.2.3a lets the shear factor be taken as the moment factor: the LARGER of the two is used here, PS35-D4)
     exterior moment  Table 4.6.2.2.2d-1:  one lane e_M1 g_M1, e_M1 = max(1.125 + d_e / 30, 1.0); two or more e_M2 g_M2,
                      e_M2 = max(1.04 + d_e / 25, 1.0); range d_e ≤ 2.0 ft. No lever rule and no rigid-section check for (f)/(g).
     exterior shear   Table 4.6.2.2.3b-1:  one lane e_V1 g_V1, e_V1 = max(1.25 + d_e / 20, 1.0); two or more e_V2 g_V2 (48 / b),
                      48 / b ≤ 1.0, e_V2 = max(1 + ((d_e + b / 12 − 2.0) / 40)^0.5, 1.0) (the root taken as 0 when its argument is negative);
                      range d_e ≤ 2.0 ft, 35 ≤ b ≤ 60
     governing        interior g = max(one lane, two or more); exterior g = max(e₁ g₁, e₂ g₂) (the multiple presence is in the equations)
     skew, moment     Table 4.6.2.2.2e-1, (f)/(g): r_M = min(1.05 − 0.25 tan θ_M, 1.0), θ ≤ 60° (θ > 60°: 60°); 4.6.2.2.2e allows it only
                      where the skews of the two supports differ by 10° or less: θ_M = the SMALLER skew (inputs.loads.skewLo, engine/design.js)
                      and none (θ_M = 0) when they differ by more than 10° (PS35-D5)
     skew, shear      Table 4.6.2.2.3c-1, (f)/(g): c_V = 1 + (12 L / 90 d) (tan θ)^0.5, θ the larger skew (as the engine), d = the precast
                      depth h; range 0 < θ ≤ 60°, 20 ≤ L ≤ 120, 17 ≤ d ≤ 60, 35 ≤ b ≤ 60, 5 ≤ N_b ≤ 20. Applied to the whole span as
                      the engine applies its own c_V.
     fatigue          the engine's interior one-lane factor is g_M1 (here the (f)/(g) one); for an exterior beam it takes max(lever, rigid1):
                      here lever = 0 and rigid1 = e_M1 g_M1 (the (f)/(g) exterior one-lane factor; the field name is the engine's).
   I and J (4.6.2.2.1: the stiffness parameters of the section to which traffic is applied, usually the composite section, PS35-D2):
     I = the composite I_c (compositeProps, the topping transformed by n) with a topping (type f), the girder's I without (type g).
     J, in order: the J entered for the girder type (inputs.loads.Jfg, "user/DOT value"), a library J (PSBSections.dotJ(name): none yet;
     the DOT sheets come later), else J computed from the drawn outline as a closed thin-walled cell, J = 4 A₀² / Σ(s / t)
     (Eq. C4.6.2.2.1-3), on the wall midlines: webs t_w (box: (w − w_void) / 2; voided slab: the concrete outside the outermost void),
     bottom wall t_b and top wall t_t (box: the slabs; voided slab: the concrete below / above the voids, the thinnest), the topping
     (type f) added to the top wall as n t_s at its own height. The voided slab is taken as one closed cell of its outer walls (the concrete
     between the voids ignored: a smaller J, conservative; PS35-D3).
   Out of range (N_b, b, L, I, J, d_e, θ, d): computed all the same (PS-35 conservative choice), each limit listed in R.lldfFG.out and as a
   design warning (R.warns: the Loads & LLDF tab, the check summary, the Report §14 warnings) and on the Loads input tab (fields.js).
   How: run(inp, inner) calls inner(inp) (PSBRigid.run / computeAll) with the global distFactors wrapped for that call (restored after), as
   engine/rigid.js does; engine/holddown.js compute uses it. isFG(g), jOutline(g, cp, ts), compute(inp, g, cp, df0), ranges(f), run. */
(function () {
  'use strict';
  const RAD = Math.PI / 180, clampTh = v => Math.min(Math.max(Math.abs(+v || 0), 0), 60);
  const LIM = { b: [35, 60], L: [20, 120], Nb: [5, 20], J: [25000, 610000], I: [40000, 610000], d: [17, 60] };
  /* isFG(g): a box beam or a voided deck slab of girderGross (not NEXT, not a solid slab, not an I-girder) */
  const isFG = g => !!g && !g.isNext && !!g.box && (!!g.isBox || (!!g.isDeck && !g.box.solid && (+g.box.voids || 0) > 0 && (+g.box.voidD || 0) > 0));
  /* isFGInputs(inp): the engine inputs' girder is one (engine/design.js: the smaller skew is passed only for these) */
  function isFGInputs(inp) { try { return typeof girderGross === 'function' && isFG(girderGross(inp)); } catch (e) { return false; } }

  /* jOutline(g, cp, ts): the closed-cell J of the drawn outline (sectionVoids: the engine's voids, the plate's for a standard slab) */
  function jOutline(g, cp, ts) {
    const W = typeof window !== 'undefined' ? window : globalThis, sv = W.sectionVoids || (typeof sectionVoids === 'function' ? sectionVoids : null);
    const vs = sv ? sv(g) : [], h = +g.h, w = +g.w;
    let tw, tb, tt, kind, ov = null;
    if (g.isBox) { const v = vs.find(q => q.type === 'rect') || { x: 0, y: g.box.wall + g.box.voidH / 2, w: g.box.voidW, h: g.box.voidH };
      kind = 'box'; tw = (w - v.w) / 2 - Math.abs(v.x || 0); tb = v.y - v.h / 2; tt = h - v.y - v.h / 2; ov = v; }
    else { const c = vs.filter(q => q.type === 'circle');
      kind = 'slab'; const out = c.reduce((a, q) => (w / 2 - Math.abs(q.x) - q.d / 2 < w / 2 - Math.abs(a.x) - a.d / 2 ? q : a), c[0]);
      const lo = c.reduce((a, q) => (q.y - q.d / 2 < a.y - a.d / 2 ? q : a), c[0]), hi = c.reduce((a, q) => (h - q.y - q.d / 2 < h - a.y - a.d / 2 ? q : a), c[0]);
      tw = w / 2 - Math.abs(out.x) - out.d / 2; tb = lo.y - lo.d / 2; tt = h - hi.y - hi.d / 2; ov = { out, lo, hi }; }
    const n = cp && cp.n > 0 ? cp.n : 1, comp = ts > 0;
    const tT = comp ? tt + n * ts : tt, yT = comp ? (tt * (h - tt / 2) + n * ts * (h + ts / 2)) / tT : h - tt / 2, yB = tb / 2;
    const b0 = w - tw, h0 = yT - yB, A0 = b0 * h0, sum = b0 / tT + b0 / tb + 2 * h0 / tw, J = 4 * A0 * A0 / sum;
    return { kind, h, w, tw, tb, tt, n, ts: comp ? ts : 0, comp, tT, yT, yB, b0, h0, A0, sum, J, v: ov };
  }
  /* the J used: the girder type's entered value, a library value, or the outline's */
  const libJ = name => { const S = typeof window !== 'undefined' && window.PSBSections; return S && S.dotJ ? S.dotJ(name) : null; };

  /* compute(inp, g, cp, df0): the (f)/(g) result in the engine's distFactors shape (df0: the engine's own, kept in fg.engine) */
  function compute(inp, g, cp, df0) {
    const ld = inp.loads || {}, L = +inp.L, Nb = Math.max(2, Math.round(+inp.nGirders || 2)), b = +g.w, d = +g.h, ts = Math.max(+inp.ts || 0, 0);
    const type = ts > 0 ? 'f' : 'g', I = ts > 0 ? +cp.Ic : +g.I, jw = jOutline(g, cp, ts);
    const ue = ld.Jfg, user = ue !== '' && ue != null && isFinite(+ue) && +ue > 0, lib = user ? null : libJ(inp.girder);
    const J = user ? +ue : lib ? +lib.J : jw.J, Jsrc = user ? 'user' : lib ? 'library' : 'computed', IJ = I / J;
    const k = Math.max(2.5 * Math.pow(Nb, -0.2), 1.5);
    const m1 = k * Math.pow(b / (33.3 * L), 0.5) * Math.pow(IJ, 0.25);
    const m2 = k * Math.pow(b / 305, 0.6) * Math.pow(b / (12 * L), 0.2) * Math.pow(IJ, 0.06);
    const b48 = Math.max(b / 48, 1);
    const v1 = Math.pow(b / (130 * L), 0.15) * Math.pow(IJ, 0.05);
    const v2 = Math.pow(b / 156, 0.4) * Math.pow(b / (12 * L), 0.1) * Math.pow(IJ, 0.05) * b48;
    const ext = ld.pos === 'exterior', de = +ld.de || 0;
    const eM1 = Math.max(1.125 + de / 30, 1), eM2 = Math.max(1.04 + de / 25, 1), eV1 = Math.max(1.25 + de / 20, 1);
    const qV = (de + b / 12 - 2) / 40, eV2 = Math.max(1 + (qV > 0 ? Math.sqrt(qV) : 0), 1), f48 = Math.min(48 / b, 1);
    const gM = ext ? Math.max(eM1 * m1, eM2 * m2) : Math.max(m1, m2);
    const gVeq = ext ? Math.max(eV1 * v1, eV2 * v2 * f48) : Math.max(v1, v2);
    const IJout = I < LIM.I[0] || I > LIM.I[1] || J < LIM.J[0] || J > LIM.J[1];
    const gV = IJout ? Math.max(gVeq, gM) : gVeq;
    // skew: the moment reduction with the smaller skew of the span (none when they differ by > 10°), the shear correction with the larger
    const thV = clampTh(ld.skew), lo = ld.skewLo != null && isFinite(+ld.skewLo) ? clampTh(ld.skewLo) : thV, thM = thV - lo > 10 + 1e-9 ? 0 : lo;
    const rM = Math.min(1.05 - 0.25 * Math.tan(thM * RAD), 1), cV = 1 + 12 * L / (90 * d) * Math.sqrt(Math.tan(thV * RAD));
    const f = { type, b, L, Nb, d, ts, I, Isrc: ts > 0 ? 'composite' : 'girder', J, Jsrc, Jlib: lib, jw, IJ, k, m1, m2, v1, v2, b48, ext, de,
      eM1, eM2, eV1, eV2, qV, f48, gM, gVeq, IJout, gV, thV, thLo: lo, thM, skewDiff: thV - lo, rM, cV, rawSkew: Math.abs(+ld.skew || 0), rawSkewLo: ld.skewLo,
      engine: { dfm: df0.dfm, dfv: df0.dfv, m1: df0.m1, m2: df0.m2, v1: df0.v1, v2: df0.v2, Kg: df0.Kg, skM: df0.skM, skV: df0.skV, lever: df0.lever, rigid: df0.rigid } };
    f.out = ranges(f);
    return { fg: f, m1, m2, v1, v2, skM: rM, skV: cV, th: thV, ext, lever: 0, eM: ext ? eM2 : 0, eV: ext ? eV2 : 0, rigid: 0, rigidNL: 0,
      rigid1: ext ? eM1 * m1 : 0, dfmRaw: gM, dfvRaw: gV, dfm: gM * rM, dfv: gV * cV };
  }
  /* ranges(f): the limits of applicability outside which the equations were used: [{ key, text }] */
  function ranges(f) {
    const out = [], fx = (v, dd) => (+v).toLocaleString('en-US', { minimumFractionDigits: dd, maximumFractionDigits: dd });
    const chk = (key, v, lo, hi, sym, unit, dd, where) => { if (v < lo - 1e-9 || v > hi + 1e-9) out.push({ key, text: `${sym} = ${fx(v, dd)}${unit} is outside ${fx(lo, 0)} ≤ ${sym} ≤ ${fx(hi, 0)}${unit} (${where})` }); };
    chk('b', f.b, LIM.b[0], LIM.b[1], 'b', ' in', 1, 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1');
    chk('L', f.L, LIM.L[0], LIM.L[1], 'L', ' ft', 2, 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1');
    chk('Nb', f.Nb, LIM.Nb[0], LIM.Nb[1], 'N_b', '', 0, 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1');
    chk('J', f.J, LIM.J[0], LIM.J[1], 'J', ' in⁴', 0, 'Table 4.6.2.2.3a-1; the shear factor is taken as the larger of the shear equation and the moment factor, 4.6.2.2.3a');
    chk('I', f.I, LIM.I[0], LIM.I[1], 'I', ' in⁴', 0, 'Table 4.6.2.2.3a-1; the shear factor is taken as the larger of the shear equation and the moment factor, 4.6.2.2.3a');
    if (f.ext && f.de > 2 + 1e-9) out.push({ key: 'de', text: `d_e = ${fx(f.de, 2)} ft is above d_e ≤ 2.0 ft (Tables 4.6.2.2.2d-1, 4.6.2.2.3b-1)` });
    if (f.rawSkew > 60 + 1e-9) out.push({ key: 'th', text: `θ = ${fx(f.rawSkew, 1)}° is above 60° (Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1: θ = 60° used)` });
    if (f.thV > 0) chk('d', f.d, LIM.d[0], LIM.d[1], 'd', ' in', 1, 'Table 4.6.2.2.3c-1, the shear skew correction');
    return out;
  }
  /* warnText(f): the design warning for the out-of-range limits ('' when none) */
  const warnText = f => (f && f.out && f.out.length ? `Live load distribution, type (${f.type}) adjacent ${f.kind || 'beam'} equations (PS-35) used outside their range of applicability: ${f.out.map(o => o.text).join('; ')}. Computed all the same; check the factors (refined analysis, 4.6.3, or enter them on the Loads tab).` : '');
  /* run(inp, inner): inner(inp) with the global distFactors giving (f)/(g) for a box beam / voided slab; the out-of-range warning added */
  function run(inp, inner) {
    const W = typeof window !== 'undefined' ? window : globalThis, orig = W.distFactors;
    W.distFactors = function (i, g, cp) { const df = orig(i, g, cp); return isFG(g) ? compute(i, g, cp, df) : df; };
    let R; try { R = inner(inp); } finally { W.distFactors = orig; }
    if (R && !R.error && R.df && R.df.fg) { R.df.fg.kind = R.g && R.g.isBox ? 'box beam' : 'voided slab'; const t = warnText(R.df.fg); if (t && Array.isArray(R.warns)) R.warns.push(t); }
    return R;
  }
  /* inputNote(b, P): the Loads input tab's note (fields.js card 'fglldf'): for the entered values b on the design girder P.design, the type,
     I and J used and the limits of applicability outside which the equations are used (HTML; '' when it cannot be computed) */
  function inputNote(b, P) {
    try {
      const D = window.PSBDesign, d = D.sel(P), inp = D.one(Object.assign({}, P, { base: b, types: undefined }));
      const g = girderGross(inp); if (!isFG(g)) return '';
      const cp = compositeProps(inp, g), f = compute(inp, g, cp, distFactors(inp, g, cp)).fg, fx = (v, dd) => (+v).toLocaleString('en-US', { minimumFractionDigits: dd, maximumFractionDigits: dd });
      const src = f.Jsrc === 'user' ? 'user/DOT value' : f.Jsrc === 'library' ? 'library (DOT) value' : 'computed from outline';
      const out = f.out.length ? `<span class="alert" style="display:block"><b>Outside the range of applicability:</b> ${f.out.map(o => o.text).join('; ')}. The equations are used all the same (flagged on the Loads &amp; LLDF tab, in the design warnings and the Report).</span>`
        : 'Within the ranges of applicability of the type (f) / (g) equations (b, L, N<sub>b</sub>, I, J, d<sub>e</sub>, θ, d).';
      return `<span id="fgInNote">These inputs on G${d.g}, span ${d.s}: type (${f.type}) (${f.type === 'f' ? 'cast-in-place topping' : 'no topping'}); I = ${fx(f.I, 0)} in⁴ (${f.Isrc === 'composite' ? 'composite section' : 'girder'}), J = ${fx(f.J, 0)} in⁴ (${src}${f.Jsrc !== 'computed' ? `; the outline gives ${fx(f.jw.J, 0)} in⁴` : ''}), b = ${fx(f.b, 1)} in, L = ${fx(f.L, 2)} ft, N<sub>b</sub> = ${f.Nb}. ${out} Worked on the <a href="#" data-gout="ld">Loads &amp; LLDF tab</a>.</span>`;
    } catch (e) { return ''; }
  }
  window.PSBLldfFG = { LIM, isFG, isFGInputs, jOutline, compute, ranges, warnText, run, inputNote };
})();
