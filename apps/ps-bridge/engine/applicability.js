/* apps/ps-bridge/engine/applicability.js — AP-B: is the line-girder analysis with the approximate live-load distribution factors permitted for
   this girder? The ranges of applicability of the distribution factor equations, for every section family (window.PSBApplic). Classic
   script, no DOM. Created 2026-11-23 (engineer, 2026-11-23: "close the gaps vs the Steel Bridge app": the line-girder applicability check
   and the LLDF range flags; fixlog/ps-bridge.md AP-B). Mirrors the Steel Bridge app's check SA4 (apps/steel-bridge/engine/analysis.js
   applicability(), engine/lldf.js ranges(); engineer-approved 2026-11-21: a COMPUTED distribution factor outside its range of applicability
   is a FAIL that counts in the verdict; an ENTERED factor is not flagged).

   AN ENGINE ADDITION MADE APP-SIDE (CLAUDE.md §4), after computeAll, as engine/holddown.js: the moved engine (engine/pbd-*.js, verbatim,
   frozen) is not changed. No distribution factor and no other value changes: this file only tests the values the engine (or
   engine/lldf-fg.js) used against the ranges, adds R.ap and, when an item fails, one check at the end of R.checks and a design warning.

   Code (cited, not copied): AASHTO LRFD 10th Ed. (2024), Art. 4.6.2.2 (approximate methods of analysis, beam-slab bridges)
     I-girders and bulb tees, cross-section type (k); NEXT double tees, types (i) / (j) acting as a unit (the engine's equations for them):
       Table 4.6.2.2.2b-1 (moment, interior), 4.6.2.2.3a-1 (shear, interior):  3.5 ≤ S ≤ 16.0 ft,  4.5 ≤ t_s ≤ 12.0 in,  20 ≤ L ≤ 240 ft,
         N_b ≥ 4,  10,000 ≤ K_g ≤ 7,000,000 in⁴ (K_g: the moment table)
       Table 4.6.2.2.2d-1 (moment, exterior), 4.6.2.2.3b-1 (shear, exterior):  −1.0 ≤ d_e ≤ 5.5 ft
       Table 4.6.2.2.2e-1 (moment, skewed supports) and 4.6.2.2.3c-1 (shear at the obtuse corner):  θ ≤ 60° (the tables' upper limit; the
         moment reduction takes θ = 60° above it, which the engine also does for the shear correction)
     Box beams and deck slabs, types (f) / (g) (engine/lldf-fg.js, PS-35 / PS-36; its limits LIM):  35 ≤ b ≤ 60 in,  20 ≤ L ≤ 120 ft,
       5 ≤ N_b ≤ 20,  d_e ≤ 2.0 ft (exterior),  θ ≤ 60°,  17 ≤ d ≤ 60 in (shear skew correction, θ > 0);  25,000 ≤ J ≤ 610,000 and
       40,000 ≤ I ≤ 610,000 in⁴ (shear table): outside them Art. 4.6.2.2.3a lets the shear factor be taken as the moment factor, which
       lldf-fg.js does (the larger of the two): a NOTE, not a FAIL.
     Art. 4.6.3.3.2 (the skew index I_S of grid and plate analyses of steel bridges) is not a limit on a line-girder analysis and does not
       apply to concrete girders: not shown (engineer, 2026-11-23).
   Values tested (those the distribution factors were computed with): S = inputs.S (the girder line's spacing, engine/design.js lineS; NEXT:
   the beam width b_tf / 12, the engine's S for a double tee), t_s = inputs.ts (NEXT with no topping: the integral top flange, K_g not used:
   no K_g item), L = inputs.L, N_b = inputs.nGirders, K_g = R.df.Kg, d_e = inputs.loads.de (exterior), θ = inputs.loads.skew (the larger
   skew of the span's two supports, before the engine's cap at 60°).
   Levels: 'fail' (outside a range, the factor computed), 'warn' (PS-42, engineer decision 2026-11-14: a MassDOT NEDBT with no topping keeps
   the engine's type (k) factors, flagged: its t_s = 0 item stays a warning), 'note' (I, J of types (f) / (g); θ > 20°: what a line-girder
   analysis does not compute), 'ok'. Entered distribution factors (loads.dfAuto false): nothing is flagged (level 'ok', entered: true).

   of(inp, R) -> { level, entered, family: 'k' | 'next' | 'fg', kind, items: [{ key, name, sym, unit, d, value, lo, hi, ok, level, table,
     note }], extra: [{ id, level, title, val, msg }], bad: [items that fail], r (the largest exceedance ratio of the failing items,
     value / upper limit or lower limit / value; 1 + the distance for a limit that is ≤ 0), text (the warning) }
   apply(inp, R) -> R with R.ap = of(inp, R); when level is 'fail', the check NAME { v: number of items outside, lim: 0, r, pass: false }
     and the warning text. A girder inside every range: R.checks and R.warns exactly as before.
   steps(add, inp, R, h): the worked steps (kit 'ld': ids ld.ap.*; Loads & LLDF tab and Report). */
(function () {
  'use strict';
  const NAME = 'LLDF range of applicability (4.6.2.2)';
  const A10 = 'AASHTO LRFD 10th Ed. ';
  const TK = { int: 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1', kg: 'Table 4.6.2.2.2b-1', ext: 'Tables 4.6.2.2.2d-1, 4.6.2.2.3b-1', skew: 'Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1' };
  /* type (k), and (i) / (j) acting as a unit: [lo, hi] */
  const RANGE = { S: [3.5, 16.0], ts: [4.5, 12.0], L: [20, 240], Nb: [4, Infinity], Kg: [10000, 7000000], de: [-1.0, 5.5], th: [0, 60] };
  const isNum = v => typeof v === 'number' && isFinite(v);
  const inR = (x, lo, hi) => isNum(x) && x >= lo - 1e-9 && x <= hi + 1e-9;
  /* exceed(x, lo, hi): how far outside, as a ratio > 1 (1 or less: inside) */
  function exceed(x, lo, hi) {
    if (!isNum(x)) return Infinity;
    if (x > hi + 1e-9) return hi > 0 ? x / hi : 1 + (x - hi);
    if (x < lo - 1e-9) return lo > 0 && x > 0 ? lo / x : 1 + (lo - x) / Math.max(Math.abs(lo), 1);
    return hi > 0 && isFinite(hi) ? Math.max(x, 0) / hi : 0;
  }
  const rangeTxt = (q, f) => !isFinite(q.hi) ? `${q.sym} ≥ ${f(q.lo)}` : q.lo === -Infinity ? `${q.sym} ≤ ${f(q.hi)}` : `${f(q.lo)} ≤ ${q.sym} ≤ ${f(q.hi)}`;
  function of(inp, R) {
    const df = R && R.df, ld = (inp && inp.loads) || {}, out = { level: 'ok', entered: false, family: null, kind: '', items: [], extra: [], bad: [], r: 0, text: '' };
    if (!df || !R || R.error) return out;
    const fg = df.fg, next = !!df.isNext, th = Math.abs(+ld.skew || 0), items = out.items;
    out.family = fg ? 'fg' : next ? 'next' : 'k';
    out.kind = fg ? `type (${fg.type}) adjacent ${fg.kind || 'beams'}` : next ? 'NEXT double tee, types (i) / (j)' : 'I-girder / bulb tee, type (k)';
    out.entered = ld.dfAuto === false;
    const it = (key, name, sym, unit, d, value, lo, hi, table, o) => items.push(Object.assign({ key, name, sym, unit, d, value, lo, hi, ok: inR(value, lo, hi), table, level: 'fail' }, o || {}));
    if (fg) {
      const L = window.PSBLldfFG.LIM;
      it('b', 'Beam width', 'b', 'in', 1, fg.b, L.b[0], L.b[1], 'Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.3b-1');
      it('L', 'Span length', 'L', 'ft', 2, fg.L, L.L[0], L.L[1], TK.int);
      it('Nb', 'Number of beams', 'N_b', '', 0, fg.Nb, L.Nb[0], L.Nb[1], TK.int);
      it('I', 'Moment of inertia', 'I', 'in⁴', 0, fg.I, L.I[0], L.I[1], 'Table 4.6.2.2.3a-1', { level: 'note', note: 'Outside this range Art. 4.6.2.2.3a lets the shear factor be taken as the moment factor: the larger of the two is used (PS-35).' });
      it('J', 'St. Venant torsional constant', 'J', 'in⁴', 0, fg.J, L.J[0], L.J[1], 'Table 4.6.2.2.3a-1', { level: 'note', note: 'Outside this range Art. 4.6.2.2.3a lets the shear factor be taken as the moment factor: the larger of the two is used (PS-35).' });
      if (fg.ext) it('de', 'Exterior web to the barrier face', 'd_e', 'ft', 3, fg.de, -Infinity, 2.0, TK.ext);
      it('th', 'Skew of the supports', 'θ', '°', 1, isNum(fg.rawSkew) ? fg.rawSkew : th, 0, 60, TK.skew, { note: 'Above 60° the equations take θ = 60°.' });
      if (fg.thV > 0) it('d', 'Beam depth (shear skew correction)', 'd', 'in', 1, fg.d, L.d[0], L.d[1], 'Table 4.6.2.2.3c-1');
    } else {
      const noTop = !(+inp.ts > 0), SC = window.PSBSections, ps42 = !!(SC && SC.noTop && SC.noTop(inp));
      it('S', next ? 'Beam width (the spacing of the double tees)' : 'Girder spacing', 'S', 'ft', 3, next ? df.Sf : +inp.S, RANGE.S[0], RANGE.S[1], TK.int);
      if (next && noTop) it('ts', 'Slab thickness (no topping: the integral top flange)', 't_s', 'in', 2, R.g && R.g.next ? +R.g.next.ft : NaN, RANGE.ts[0], RANGE.ts[1], TK.int);
      else it('ts', 'Slab thickness', 't_s', 'in', 2, +inp.ts, RANGE.ts[0], RANGE.ts[1], TK.int, ps42 ? { level: 'warn', note: 'PS-42 (engineer decision 2026-11-14): a NEDBT without a topping keeps the engine\'s type (k) factors, flagged; the factor is likely very conservative.' } : null);
      it('L', 'Span length', 'L', 'ft', 2, +inp.L, RANGE.L[0], RANGE.L[1], TK.int);
      it('Nb', 'Number of beams', 'N_b', '', 0, Math.round(+inp.nGirders || 0), RANGE.Nb[0], RANGE.Nb[1], TK.int, { note: 'With three beams the tables take the lesser of the equation and the lever rule, which the equations here do not do.' });
      if (!(next && df.kgOmitted)) it('Kg', 'Longitudinal stiffness parameter', 'K_g', 'in⁴', 0, df.Kg, RANGE.Kg[0], RANGE.Kg[1], TK.kg);
      if (df.ext) it('de', 'Exterior web to the barrier face', 'd_e', 'ft', 3, +ld.de || 0, RANGE.de[0], RANGE.de[1], TK.ext);
      // LL-O (2026-11-23): with "Exterior not less than interior" on, the interior equations are also used at the interior girder spacing
      // S_int (engine/lldf-opt.js): tested where it differs from this line's S (the same S: the item above is that test)
      { const oi = df.opt && df.opt.int; if (oi && !next && isNum(oi.S) && Math.abs(oi.S - (+inp.S)) > 1e-9) it('Sint', 'Interior girder spacing (option "Exterior not less than interior")', 'S_int', 'ft', 3, oi.S, RANGE.S[0], RANGE.S[1], TK.int); }
      it('th', 'Skew of the supports', 'θ', '°', 1, th, RANGE.th[0], RANGE.th[1], TK.skew, { note: 'Above 60° the moment reduction takes θ = 60° (the engine also caps the shear correction at 60°): refined analysis, 4.6.3.' });
    }
    const ex = (id, level, title, val, msg) => out.extra.push({ id, level, title, val, msg });
    ex('curv', 'ok', 'Horizontal curvature (4.6.1.2.4)', 'straight girders', 'This app designs straight girders only: curvature not applicable.');
    if (th > 20 + 1e-9) ex('sk20', 'note', 'Skew effects a line-girder analysis does not compute', `θ = ${th.toFixed(1)}° > 20°`, 'Not computed here: the reaction increase at the obtuse corners and possible uplift at the acute corners, the end rotations about the skewed bearing lines and the transverse (diaphragm) forces of a skewed span.');
    if (out.entered) { out.level = out.extra.some(q => q.level === 'note') ? 'note' : 'ok'; return out; }
    out.bad = items.filter(q => !q.ok && q.level === 'fail');
    const warn = items.some(q => !q.ok && q.level === 'warn'), note = items.some(q => !q.ok && q.level === 'note') || out.extra.some(q => q.level === 'note');
    out.level = out.bad.length ? 'fail' : warn ? 'warn' : note ? 'note' : 'ok';
    out.r = out.bad.reduce((m, q) => Math.max(m, exceed(q.value, q.lo, q.hi)), 0);
    if (out.bad.length) { const f = v => String(+(+v).toFixed(3));
      out.text = `Live load distribution factors (${out.kind}) computed outside their range of applicability: ${out.bad.map(q => `${q.sym} = ${isNum(q.value) ? (+q.value).toLocaleString('en-US', { maximumFractionDigits: q.d }) : '—'}${q.unit ? ' ' + q.unit : ''} (${rangeTxt(q, f)}${q.unit ? ' ' + q.unit : ''}, ${q.table})`).join('; ')}. A line-girder analysis with these factors is not permitted (FAIL): use a refined analysis (AASHTO LRFD 10th Ed. 4.6.3) and enter its distribution factors on the Loads tab (an entered factor is not flagged), or change the layout.`; }
    return out;
  }
  function apply(inp, R) {
    if (!R || R.error || !R.df || !Array.isArray(R.checks)) return R;
    const a = of(inp, R); R.ap = a;
    if (a.level === 'fail') {
      R.checks.push({ n: NAME, v: a.bad.length, lim: 0, r: a.r, loc: 0, u: 'items outside', pass: false });
      if (Array.isArray(R.warns)) R.warns.push(a.text);
    }
    return R;
  }
  /* steps(add, inp, R, h): every range item as a worked step (the value, its range, inside or not) and the result */
  function steps(add, inp, R, h) {
    const a = R && R.ap; if (!a || !a.family) return;
    const f = v => String(+(+v).toFixed(3)), tex = s => s.replace('θ', '\\theta').replace(/_([A-Za-z]+)/, '_{$1}');
    a.items.forEach(q => { const flagged = !a.entered && !q.ok;
      add({ id: 'ap.' + q.key, label: `${q.name}: range of applicability (${q.table})`, sym: tex(q.sym), value: q.value, unit: q.unit === '°' ? 'deg' : q.unit === 'in⁴' ? 'in^{4}' : q.unit, d: q.d, ref: A10 + q.table,
        ...(a.entered ? {} : { ok: q.ok || q.level !== 'fail' }),
        note: `Range: ${rangeTxt(q, f)}${q.unit ? ' ' + q.unit : ''}. ${a.entered ? 'Distribution factors entered: not tested.' : q.ok ? 'Inside.' : q.level === 'fail' ? 'OUTSIDE: the equations do not apply (FAIL).' : q.level === 'warn' ? 'Outside (warning).' : 'Outside (note).'}${q.note && (flagged || q.key === 'Nb' && q.value === 3) ? ' ' + q.note : ''}` }); });
    add({ id: 'ap.r', label: 'Line-girder analysis with the approximate distribution factors: items outside their range', sym: 'n_{out}', value: a.entered ? 0 : a.bad.length, unit: '', d: 0, ref: A10 + 'Art. 4.6.2.2', ...(a.entered ? {} : { ok: !a.bad.length }),
      note: a.entered ? 'The distribution factors are entered (Loads tab): the ranges of the equations are not tested.' : a.bad.length ? `${a.bad.map(q => q.sym).join(', ')} outside: FAIL, counted in the verdict (as the Steel Bridge app's applicability check). Refined analysis (4.6.3), or enter the distribution factors.` : 'Every tested value is inside its range: the approximate equations apply.' }, a.entered ? 0 : a.bad.length);
  }
  window.PSBApplic = { NAME, RANGE, exceed, of, apply, steps };
})();
