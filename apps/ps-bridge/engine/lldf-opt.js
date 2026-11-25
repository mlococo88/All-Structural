/* apps/ps-bridge/engine/lldf-opt.js — LL-O: the two optional live-load distribution options of the bridge (window.PSBLldfOpt). Classic
   script, no DOM. Created 2026-11-23 (engineer, 2026-11-23: "two LLDF options, both off by default, as the Steel Bridge app has them";
   fixlog/ps-bridge.md LL-O). Mirrors the Steel Bridge app (apps/steel-bridge/engine/lldf.js compute(): q.skewV 'all' | 'ext' and q.extMin;
   its project fields xs.lldf.skewV and xs.lldf.extMin, the same names and values here: P.xs.lldf, engine/model.js).

   Code (cited, not copied): AASHTO LRFD 10th Ed. (2024)
     Art. 4.6.2.2.3c, Table 4.6.2.2.3c-1   the correction of the shear distribution factor for skewed supports (the engine's c_V, df.skV);
     Art. 4.6.2.2.2d, 4.6.2.2.3b           the exterior beam's moment and shear factors; Art. 4.6.2.2.2b, 4.6.2.2.3a the interior beam's.
   Neither option is an AASHTO equation: (a) is an owner / engineer policy (a common DOT rule: an exterior girder is not given less live load
   than an interior one, so that the bridge can be widened later); (b) is the reading of 4.6.2.2.3c that corrects the exterior girders only.

   The options (both OFF by default; absent = off: every project saved before computes exactly as before):
     (a) extMin (P.xs.lldf.extMin === true): "Exterior not less than interior". For an EXTERIOR girder line:
             DF_M = max(DF_M,ext, DF_M,int),   DF_V = max(DF_V,ext, DF_V,int)
         DF_ext: the exterior factor as before (after its skew factors). DF_int: the interior girder's factor by the same equations
         (4.6.2.2.2b / 4.6.2.2.3a, × its skew factors; with option (b) on, the interior shear factor has no skew correction), computed with
         this girder type's own section, span and slab (its K_g, or I and J) and the interior girder spacing S_int = the largest spacing
         of the bridge's interior lines (engine/design.js lineS; equal bays: S). The Steel Bridge app compares with the largest interior
         factor of the region in the same way. Not raised: the fatigue factor (as the Steel Bridge app, whose policy step raises g_M and
         g_V only). A bridge with two girders has no interior line: no change. A NEXT beam: the engine gave every beam the interior
         equations, so nothing was raised; a NEXT F per stem (NX-1, engine/lldf-next.js) is compared as any other girder.
     (b) skewV 'ext' (P.xs.lldf.skewV === 'ext'): "Shear skew correction: Exterior girders only". For an INTERIOR girder line of an
         I-girder / bulb tee (type k) or a NEXT beam:   DF_V = g_V   (the correction c_V of Table 4.6.2.2.3c-1 not applied; before: c_V g_V).
         Exterior lines: unchanged. Box beams and deck slabs (types f / g, adjacent beams): NOT changed by this option (the correction
         stays on every beam; decision pending engineer review, fixlog LL-O). The moment skew reduction r_M is not touched.
   Entered distribution factors (loads.dfAuto false) and imported live load (a MIDAS file or a custom table, with its DF per effect): the
   options change nothing (the factors are the entered ones); of() returns null.

   AN ENGINE ADDITION MADE APP-SIDE (CLAUDE.md §4): the moved engine (engine/pbd-*.js, verbatim, frozen) is NOT edited. As engine/rigid.js
   and engine/lldf-fg.js, run(inp, inner) calls the engine with the global distFactors wrapped for that one call (restored after): the
   engine's own distFactors (with the type (f) / (g) factors of engine/lldf-fg.js already in it) → the rigid section on the real girder
   lines (PSBRigid.adjust) → adjust() here, last, so that the maximum of (a) is taken on the final exterior factors. The engine reads
   df.dfm and df.dfv (and, for fatigue, df.ext, lever, rigid1, m1, which are not changed), so every check, the continuous unit, the pier
   section and the load rating take the same factors. engine/design.js adds inputs.lldf = { skewV: 'ext', extMin: true, Sint } ONLY when
   an option is on: with both off the inputs, and so every result, are byte-identical to before (harness B; psbridge-lldfopt.test.mjs).

   of(inp) -> null | { skewExt, extMin, Sint }
   adjust(df, inp, g, cp, base) -> df with df.opt = { skewV, extMin, ext, fgKeep, skewOff, cV (the shear skew factor applied), dfv0, dfm0,
     int: { S, m1, m2, v1, v2, gM, gV, skM, skV (applied), skVtab, dfm, dfv }, policyM, policyV } (df.dfm, df.dfv: the factors used)
   run(inp, inner) -> the engine result (inner(inp) when no option applies)
   steps(add, inp, R, h): the worked steps (kit 'ld': ids ld.lo.*; Loads & LLDF tab and Report). label(R): the method text. */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const isNum = v => typeof v === 'number' && isFinite(v);
  /* the wording of the Steel Bridge app's two selects (apps/steel-bridge/ui/loads.js, card "Distribution") */
  const TXT = { skewV: 'Shear skew correction', all: 'All girders', ext: 'Exterior girders only', extMin: 'Exterior not less than interior' };
  /* ofProject(P): the options of the project { skewExt, extMin } (absent: both false) */
  function ofProject(P) { const q = P && P.xs && P.xs.lldf; return { skewExt: !!(q && q.skewV === 'ext'), extMin: !!(q && q.extMin === true) }; }
  /* forInputs(P, g, lineS): inputs.lldf of girder line g, or null when both options are off (engine/design.js one()) */
  function forInputs(P, g, lineS) {
    const o = ofProject(P); if (!o.skewExt && !o.extMin) return null;
    const out = {}, nb = P.xs.nb;
    if (o.skewExt) out.skewV = 'ext';
    if (o.extMin) { out.extMin = true;
      if ((g === 1 || g === nb) && nb >= 3) { let S = -Infinity; for (let j = 2; j <= nb - 1; j++) { const s = +lineS(P, j); if (isNum(s) && s > S) S = s; } if (isNum(S)) out.Sint = S; } }
    return out;
  }
  /* of(inp): the options that apply to these engine inputs, or null (off, entered factors, imported live load) */
  function of(inp) {
    const q = inp && inp.lldf; if (!q || !inp.loads || !inp.loads.dfAuto || inp.external) return null;
    const skewExt = q.skewV === 'ext', extMin = q.extMin === true; if (!skewExt && !extMin) return null;
    return { skewExt, extMin, Sint: isNum(+q.Sint) && +q.Sint > 0 ? +q.Sint : null };
  }
  /* adjust(df, inp, g, cp, base): the engine's distFactors result df (after the rigid section on the real lines) with the options;
     base(inp, g, cp): the distFactors below this wrapper (the engine's, with types (f) / (g)), for the interior girder's factors */
  function adjust(df, inp, g, cp, base) {
    const o = of(inp); if (!df || !o) return df;
    const ext = inp.loads.pos === 'exterior', fg = !!df.fg, out = Object.assign({}, df);
    const info = { skewV: o.skewExt ? 'ext' : 'all', extMin: o.extMin, ext, fgKeep: fg && o.skewExt, cV: df.skV, dfm0: df.dfm, dfv0: df.dfv };
    const noSkewInt = o.skewExt && !fg;   // (b): interior lines of types (k) and NEXT take no shear skew correction
    if (noSkewInt && !ext) { info.skewOff = true; info.cV = 1; out.dfv = df.dfvRaw; }
    if (o.extMin && ext && o.Sint && typeof base === 'function') {
      const ii = Object.assign({}, inp, { S: o.Sint, loads: Object.assign({}, inp.loads, { pos: 'interior' }) }); delete ii.rigidX; delete ii.lldf;
      const di = base(ii, g, cp);
      if (di && isNum(di.dfm) && isNum(di.dfv)) {
        const cVi = noSkewInt ? 1 : di.skV, dfvI = di.dfvRaw * cVi;
        info.int = { S: di.isNext ? di.Sf : o.Sint, m1: di.m1, m2: di.m2, v1: di.v1, v2: di.v2, gM: di.dfmRaw, gV: di.dfvRaw, skM: di.skM, skV: cVi, skVtab: di.skV, dfm: di.dfmRaw * di.skM, dfv: dfvI, fg: !!di.fg, isNext: !!di.isNext };
        if (info.int.dfm > df.dfm) { out.dfm = info.int.dfm; info.policyM = true; }
        if (info.int.dfv > df.dfv) { out.dfv = info.int.dfv; info.policyV = true; }
      }
    }
    out.opt = info; return out;
  }
  /* run(inp, inner): the engine call with the options; inner(inp) (PSBRigid.run / computeAll) when none applies */
  function run(inp, inner) {
    if (!of(inp)) return inner(inp);
    const base = W.distFactors, RG = W.PSBRigid;
    W.distFactors = function (i, g, cp) { const d0 = base(i, g, cp); return adjust(RG && i && i.rigidX ? RG.adjust(d0, i) : d0, i, g, cp, base); };
    try { return W.computeAll(inp); } finally { W.distFactors = base; }
  }
  /* label(R): what the options did to this girder's factors, for the tables ('' when nothing) */
  function label(R) {
    const q = R && R.df && R.df.opt; if (!q) return '';
    const t = [];
    if (q.skewOff) t.push('no shear skew correction (exterior girders only)');
    if (q.policyM || q.policyV) t.push(`${q.policyM && q.policyV ? 'DF_M and DF_V' : q.policyM ? 'DF_M' : 'DF_V'} raised to interior (policy)`);
    return t.join('; ');
  }
  /* noteHTML(P): the Cross-section tab's note under the two selects (HTML) */
  function noteHTML(P) {
    const o = ofProject(P);
    return `<b>${TXT.skewV}</b> (AASHTO LRFD 10th Ed. Art. 4.6.2.2.3c, Table 4.6.2.2.3c-1). <b>${TXT.all}</b> (default): the correction c<sub>V</sub> on the shear distribution factor of every girder line. <b>${TXT.ext}</b>: on the exterior girder lines only; an interior I-girder, bulb tee or NEXT beam takes DF<sub>V</sub> = g<sub>V</sub> (no correction). Box beams and deck slabs (adjacent beams, types f / g) keep the correction on every beam with either choice. `
      + `<b>${TXT.extMin}</b> (owner / engineer policy; default No): Yes: an exterior girder's DF<sub>M</sub> and DF<sub>V</sub> are not taken less than the interior girder's, computed by the interior equations (4.6.2.2.2b, 4.6.2.2.3a) with the exterior girder type's own section and the largest interior girder spacing; the fatigue factor is not raised. `
      + `Both as the Steel Bridge app (its Loads tab, Distribution). They apply to the factors this app computes: not to entered factors, nor to imported live load. Worked on the <a href="#" data-gotab="lds">Loads &amp; LLDF tab</a> (steps "Distribution factors used").`
      + (o.skewExt || o.extMin ? ` <b>On now:</b> ${[o.skewExt ? `${TXT.skewV}: ${TXT.ext}` : '', o.extMin ? TXT.extMin : ''].filter(Boolean).join('; ')}.` : '');
  }
  /* steps(add, inp, R, h): the worked steps of the options (ids ld.lo.*), placed before the two "distribution factor used" steps */
  function steps(add, inp, R, h) {
    const df = R && R.df, q = df && df.opt; if (!q) return;
    const n = h.n, ref3c = A10 + 'Art. 4.6.2.2.3c, Table 4.6.2.2.3c-1';
    if (q.skewV === 'ext') {
      if (q.fgKeep) add({ id: 'lo.cV', label: `Shear skew correction applied to this ${q.ext ? 'exterior' : 'interior'} beam (option "${TXT.ext}": adjacent beams keep it)`, sym: 'c_{V,used}', eq: 'c_{V}', sub: n(df.skV, 4), value: q.cV, unit: '', d: 4, ref: ref3c,
        note: `Option "${TXT.skewV}: ${TXT.ext}" (Cross-section tab) is on. Box beams and deck slabs (types f / g) keep the correction on every beam, so nothing changes for this beam.` }, df.skV);
      else if (q.skewOff) add({ id: 'lo.cV', label: `Shear skew correction applied to this interior girder (option "${TXT.ext}")`, sym: 'c_{V,used}', eq: '1.0', sub: '', value: q.cV, unit: '', d: 4, ref: ref3c,
        note: `Option "${TXT.skewV}: ${TXT.ext}" (Cross-section tab): the correction c_V = ${n(df.skV, 4)} of Table 4.6.2.2.3c-1 (step c_V above) goes to the exterior girder lines only; this interior girder takes 1.0. With the option off ("${TXT.all}"): DF_V = ${n(df.skV, 4)}(${n(df.dfvRaw, 4)}) = ${n(q.dfv0, 4)}.` }, 1);
      else add({ id: 'lo.cV', label: `Shear skew correction applied to this exterior girder (option "${TXT.ext}")`, sym: 'c_{V,used}', eq: 'c_{V}', sub: n(df.skV, 4), value: q.cV, unit: '', d: 4, ref: ref3c,
        note: `Option "${TXT.skewV}: ${TXT.ext}" (Cross-section tab): an exterior girder keeps the correction (no change); the interior girder lines take 1.0.` }, df.skV);
    }
    if (q.extMin) {
      const i = q.int;
      if (!q.ext) add({ id: 'lo.pol', label: `Option "${TXT.extMin}": an interior girder`, sym: 'DF', value: R.dfm, unit: 'lanes', d: 4, note: 'The option raises the exterior girder lines only: nothing changes for this interior girder.' });
      else if (!i) add({ id: 'lo.pol', label: `Option "${TXT.extMin}": no interior girder line`, sym: 'DF', value: R.dfm, unit: 'lanes', d: 4, note: 'The bridge has no interior girder line (two girders): the exterior factors are unchanged.' });
      else {
        const same = Math.abs(i.S - (df.isNext ? df.Sf : +inp.S)) <= 1e-9, tI = A10 + 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1';
        add({ id: 'lo.Sint', label: 'Interior girder spacing for the comparison (the largest spacing of the interior lines)', sym: 'S_{int}', value: i.S, unit: 'ft', d: 3, ref: A10 + 'Art. 4.6.2.2.1',
          note: `Option "${TXT.extMin}" (Cross-section tab; owner / engineer policy, as the Steel Bridge app). The interior factors below are the interior equations with this girder type's own section, span and slab and S = S_int${same ? ' (= this line\'s S: g_M1, g_M2, g_V1, g_V2 are the steps above)' : ''}.` });
        if (i.fg) {
          add({ id: 'lo.gMi', label: 'Interior beam, moment factor before skew (the interior equations, types f / g)', sym: 'g_{M,int}', eq: '\\max(g_{M1}, g_{M2})', sub: `\\max(${n(i.m1, 4)}, ${n(i.m2, 4)})`, value: i.gM, unit: '', d: 4, ref: tI }, Math.max(i.m1, i.m2));
          add({ id: 'lo.gVi', label: 'Interior beam, shear factor before skew (the interior equations, types f / g)', sym: 'g_{V,int}', value: i.gV, unit: '', d: 4, ref: tI, note: `The larger of the two shear equations (${n(i.v1, 4)}, ${n(i.v2, 4)}), and of the moment factor where I or J is outside the shear table's range (4.6.2.2.3a).` });
        } else {
          if (!same) {
            add({ id: 'lo.m1i', label: 'Interior girder at S_int: moment DF, one lane loaded', sym: 'g_{M1,int}', value: i.m1, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2b-1', note: 'The equation of step g_M1 with S = S_int.' });
            add({ id: 'lo.m2i', label: 'Interior girder at S_int: moment DF, two or more lanes loaded', sym: 'g_{M2,int}', value: i.m2, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2b-1', note: 'The equation of step g_M2 with S = S_int.' });
            add({ id: 'lo.v1i', label: 'Interior girder at S_int: shear DF, one lane loaded', sym: 'g_{V1,int}', eq: '0.36 + \\frac{S_{int}}{25}', sub: `0.36 + \\frac{${n(i.S, 3)}}{25}`, value: i.v1, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.3a-1' }, 0.36 + i.S / 25);
            add({ id: 'lo.v2i', label: 'Interior girder at S_int: shear DF, two or more lanes loaded', sym: 'g_{V2,int}', eq: '0.2 + \\frac{S_{int}}{12} - \\left(\\frac{S_{int}}{35}\\right)^{2}', sub: `0.2 + \\frac{${n(i.S, 3)}}{12} - \\left(\\frac{${n(i.S, 3)}}{35}\\right)^{2}`, value: i.v2, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.3a-1' }, 0.2 + i.S / 12 - Math.pow(i.S / 35, 2));
          }
          add({ id: 'lo.gMi', label: 'Interior girder, moment factor before skew', sym: 'g_{M,int}', eq: '\\max(g_{M1}, g_{M2})', sub: `\\max(${n(i.m1, 4)}, ${n(i.m2, 4)})`, value: i.gM, unit: '', d: 4, ref: tI }, Math.max(i.m1, i.m2));
          add({ id: 'lo.gVi', label: 'Interior girder, shear factor before skew', sym: 'g_{V,int}', eq: '\\max(g_{V1}, g_{V2})', sub: `\\max(${n(i.v1, 4)}, ${n(i.v2, 4)})`, value: i.gV, unit: '', d: 4, ref: tI }, Math.max(i.v1, i.v2));
        }
        add({ id: 'lo.dfmI', label: 'Interior girder, moment distribution factor', sym: 'DF_{M,int}', eq: 'r_{M}\\,g_{M,int}', sub: `${n(i.skM, 4)}(${n(i.gM, 4)})`, value: i.dfm, unit: 'lanes', d: 4, ref: A10 + 'Art. 4.6.2.2.2b, 4.6.2.2.2e',
          note: same || i.fg ? 'r_M: the moment skew reduction (step r_M above).' : `r_M at S_int = ${n(i.skM, 4)} (Table 4.6.2.2.2e-1, with S = S_int).` }, i.skM * i.gM);
        add({ id: 'lo.dfvI', label: 'Interior girder, shear distribution factor', sym: 'DF_{V,int}', eq: 'c_{V,int}\\,g_{V,int}', sub: `${n(i.skV, 4)}(${n(i.gV, 4)})`, value: i.dfv, unit: 'lanes', d: 4, ref: A10 + 'Art. 4.6.2.2.3a, 4.6.2.2.3c',
          note: q.skewV === 'ext' && !i.fg ? `c_V,int = 1.0: option "${TXT.skewV}: ${TXT.ext}" (the table's correction ${n(i.skVtab, 4)} is not applied to an interior girder).` : `c_V,int = ${n(i.skV, 4)}: the shear skew correction (Table 4.6.2.2.3c-1).` }, i.skV * i.gV);
        add({ id: 'lo.dfmE', label: 'Exterior girder, moment distribution factor before the option', sym: 'DF_{M,ext}', eq: 'r_{M}\\,g_{M}', sub: `${n(df.skM, 4)}(${n(df.dfmRaw, 4)})`, value: q.dfm0, unit: 'lanes', d: 4 }, df.skM * df.dfmRaw);
        add({ id: 'lo.dfvE', label: 'Exterior girder, shear distribution factor before the option', sym: 'DF_{V,ext}', eq: 'c_{V}\\,g_{V}', sub: `${n(df.skV, 4)}(${n(df.dfvRaw, 4)})`, value: q.dfv0, unit: 'lanes', d: 4 }, df.skV * df.dfvRaw);
      }
    }
  }
  /* used(inp, R, n): the last two steps' equation and substitution ("distribution factor used") with the options, or null (engine/worked.js) */
  function used(inp, R, n) {
    const df = R && R.df, q = df && df.opt; if (!q) return null;
    const i = q.ext && q.extMin ? q.int : null, o = {};
    o.m = i ? { eq: '\\max(DF_{M,ext},\\ DF_{M,int})', sub: `\\max(${n(q.dfm0, 4)}, ${n(i.dfm, 4)})`, shown: Math.max(q.dfm0, i.dfm), note: `Option "${TXT.extMin}" (§ld.lo.dfmI): ${q.policyM ? 'raised to the interior girder\'s factor (policy)' : 'the exterior factor governs, no change'}.` } : null;
    o.v = i ? { eq: '\\max(DF_{V,ext},\\ DF_{V,int})', sub: `\\max(${n(q.dfv0, 4)}, ${n(i.dfv, 4)})`, shown: Math.max(q.dfv0, i.dfv), note: `Option "${TXT.extMin}" (§ld.lo.dfvI): ${q.policyV ? 'raised to the interior girder\'s factor (policy)' : 'the exterior factor governs, no change'}.` }
      : q.skewV === 'ext' ? { eq: 'c_{V,used}\\,g_{V}', sub: `${n(q.cV, 4)}(${n(df.dfvRaw, 4)})`, shown: q.cV * df.dfvRaw, note: `Option "${TXT.skewV}: ${TXT.ext}" (§ld.lo.cV).` } : null;
    return o;
  }
  W.PSBLldfOpt = { TXT, ofProject, forInputs, of, adjust, run, label, noteHTML, steps, used };
})();
