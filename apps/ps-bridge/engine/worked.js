/* apps/ps-bridge/engine/worked.js — the worked steps of the Section properties, Loads & LLDF and Analysis tabs (window.PSBWorked).
   Classic script, no DOM. Created 2026-11-12 (PR 2b-2, docs/ps-bridge-plan.md §3 "Tabs and graphics": every number on a new tab comes from
   computeAll, no second calculation; the worked steps substitute those values and a test asserts each step's result equals the engine value).
   Uses window.SharedSteps (shared/steps.js) for the step format (CLAUDE.md §6: equation symbolically → values substituted → result).

   section(inp, R), loads(inp, R), analysis(inp, R) -> { steps, pairs }
     inp: the engine inputs of the design (engine/design.js inputs(P)); R: computeAll(inp) (no error).
     steps: SharedSteps steps; each step's value IS the engine's value (R...), so the tab shows the engine's number.
     pairs: [{ id, shown, engine }]: shown = the step's expression evaluated from the substituted (full-precision) values, engine = the engine's
            value; tests/engine/psbridge-tabs.test.mjs asserts they agree (the derivation shown reproduces the engine's result).
   The expressions are those of the moved engine (engine/pbd-section.js compositeProps, pbd-lldf-flexure.js distFactors, pbd-losses-ll.js
   hl93, pbd-compute.js computeAll), written out for display. Units: in, kip, ksi, ft, klf, k-ft. Code basis AASHTO LRFD 10th Ed. (2024). */
(function () {
  'use strict';
  const S = () => window.SharedSteps;
  const A10 = 'AASHTO LRFD 10th Ed. ';
  function kit(prefix) {
    const w = S().work(prefix), pairs = [];
    /* add(o, shown): a step whose value is the engine's (o.value); shown = the expression from the substituted values (or undefined: a value
       the engine finds by a search, or an input) */
    const paths = {};
    /* path (PR 2c): where the step's value is in R (a dotted path, as the tabs' data-ev): tests/psbridge-compare.mjs compares it with the old app's */
    const add = (o, shown, path) => { const v = w.add(o), id = (prefix ? prefix + '.' : '') + o.id; if (shown !== undefined) pairs.push({ id, shown, engine: o.value }); if (path) paths[id] = path; return v; };
    return { w, add, pairs, paths, done: () => ({ steps: w.steps, pairs, paths }) };
  }
  const n = (x, d) => S().n(x, d), g = (x, d) => S().g(x, d);
  const par = (x, d) => (x < 0 ? `(${n(x, d)})` : n(x, d));
  const isI = G => !G.isNext && !G.isBox && !G.isDeck;

  /* ---------- Section properties (pbd-section.js girderGross / compositeProps, pbd-strands.js strandSys) ---------- */
  function section(inp, R) {
    const K = kit('sec'), add = K.add, G = R.g, cp = R.cp, ss = R.ss, ov = G.ovr || {};
    const ts = +inp.ts, th = +inp.th, m = inp.mat, wcL = +m.wcLoad || +m.wc, wdL = +m.wcdLoad || +m.wcd;
    // gross girder
    add({ id: 'g.yt', label: 'Distance from the centroid to the top of the girder', sym: 'y_{t}', eq: 'h - y_{b}', sub: `${n(G.h, 2)} - ${n(G.yb, 3)}`, value: G.yt, unit: 'in', d: 3 }, G.h - G.yb);
    if (ov.Sb) add({ id: 'g.Sb', label: 'Section modulus, bottom of the girder (entered override)', sym: 'S_{b}', value: G.Sb, unit: 'in^{3}', d: 0, note: 'Entered on the Girders & strands tab.' });
    else add({ id: 'g.Sb', label: 'Section modulus, bottom of the girder', sym: 'S_{b}', eq: '\\frac{I}{y_{b}}', sub: `\\frac{${g(G.I, 0)}}{${n(G.yb, 3)}}`, value: G.Sb, unit: 'in^{3}', d: 0 }, G.I / G.yb);
    if (ov.St) add({ id: 'g.St', label: 'Section modulus, top of the girder (entered override)', sym: 'S_{t}', value: G.St, unit: 'in^{3}', d: 0, note: 'Entered on the Girders & strands tab.' });
    else add({ id: 'g.St', label: 'Section modulus, top of the girder', sym: 'S_{t}', eq: '\\frac{I}{y_{t}}', sub: `\\frac{${g(G.I, 0)}}{${n(G.yt, 3)}}`, value: G.St, unit: 'in^{3}', d: 0 }, G.I / G.yt);
    if (ov.wsw) add({ id: 'g.wsw', label: 'Girder self-weight (entered override)', sym: 'w_{g}', value: G.wsw, unit: 'klf', d: 4 });
    else add({ id: 'g.wsw', label: 'Girder self-weight', sym: 'w_{g}', eq: '\\frac{A}{144}\\,w_{c,DL}', sub: `\\frac{${n(G.A, 1)}}{144}\\times ${n(wcL, 3)}`, value: G.wsw, unit: 'klf', d: 4, ref: A10 + '3.5.1' }, G.A / 144 * wcL);
    // moduli and modular ratio
    add({ id: 'Ecg', label: 'Modulus of elasticity, girder concrete', sym: 'E_{c}', eq: '120{,}000\\,K_{1}\\,w_{c}^{2}\\,f^{\\prime}_{c}{}^{0.33}', sub: `120{,}000(1.0)(${n(+m.wc, 3)})^{2}(${n(+m.fc, 2)})^{0.33}`, value: cp.Ecg, unit: 'ksi', d: 0, ref: A10 + 'Eq. 5.4.2.4-1', note: 'K_1 = 1.0; w_c for E_c (Materials tab).' }, 120000 * m.wc * m.wc * Math.pow(m.fc, 0.33));
    add({ id: 'Ecd', label: 'Modulus of elasticity, deck concrete', sym: 'E_{c,d}', eq: '120{,}000\\,K_{1}\\,w_{c,d}^{2}\\,f^{\\prime}_{c,d}{}^{0.33}', sub: `120{,}000(1.0)(${n(+m.wcd, 3)})^{2}(${n(+m.fcd, 2)})^{0.33}`, value: cp.Ecd, unit: 'ksi', d: 0, ref: A10 + 'Eq. 5.4.2.4-1' }, 120000 * m.wcd * m.wcd * Math.pow(m.fcd, 0.33));
    add({ id: 'n', label: 'Modular ratio, deck to girder', sym: 'n', eq: '\\frac{E_{c,d}}{E_{c}}', sub: `\\frac{${n(cp.Ecd, 0)}}{${n(cp.Ecg, 0)}}`, value: cp.n, unit: '', d: 4 }, cp.Ecd / cp.Ecg);
    // effective flange width
    let beffShown;
    if (G.isNext) { beffShown = G.btf; add({ id: 'beff', label: 'Effective flange width (NEXT: the flange width)', sym: 'b_{eff}', eq: 'b_{f}', sub: n(G.btf, 2), value: cp.beff, unit: 'in', d: 2, note: 'Flange width = girder spacing × 12 within the tabulated range.' }, beffShown); }
    else if (!inp.beffAuto) add({ id: 'beff', label: 'Effective flange width (entered)', sym: 'b_{eff}', value: cp.beff, unit: 'in', d: 2, note: 'Entered on the Cross-section tab.' });
    else if (G.isBox || G.isDeck) add({ id: 'beff', label: 'Effective flange width (adjacent beam: the beam width)', sym: 'b_{eff}', eq: 'w', sub: n(G.w, 2), value: cp.beff, unit: 'in', d: 2 }, G.w);
    else if (cp.extG) add({ id: 'beff', label: 'Effective flange width, exterior girder (tributary width)', sym: 'b_{eff}', eq: '12\\left(\\frac{S}{2} + o_{h}\\right)', sub: `12\\left(\\frac{${n(inp.S, 3)}}{2} + ${n(cp.ohT, 3)}\\right)`, value: cp.beff, unit: 'in', d: 2, ref: A10 + '4.6.2.6.1' }, (inp.S / 2 + cp.ohT) * 12);
    else add({ id: 'beff', label: 'Effective flange width, interior girder (tributary width)', sym: 'b_{eff}', eq: '12\\,S', sub: `12(${n(inp.S, 3)})`, value: cp.beff, unit: 'in', d: 2, ref: A10 + '4.6.2.6.1' }, inp.S * 12);
    // composite section
    const box = G.isBox || G.isDeck, inc = !!cp.incHaunch, gap = inc ? th : 0, bh = G.isNext ? cp.beff : G.btf;
    if (ts > 0) {
      const Ad = cp.beff * cp.n * ts, yd = G.h + gap + ts / 2, Ah = inc ? bh * cp.n * th : 0, yh = G.h + th / 2;
      add({ id: 'Ad', label: 'Transformed deck area', sym: 'A_{d}', eq: 'b_{eff}\\,n\\,t_{s}', sub: `${n(cp.beff, 2)}(${n(cp.n, 4)})(${n(ts, 2)})`, value: Ad, unit: 'in^{2}', d: 1 }, cp.beff * cp.n * ts);
      add({ id: 'yd', label: 'Deck centroid above the soffit', sym: 'y_{d}', eq: inc ? 'h + t_{h} + \\frac{t_{s}}{2}' : 'h + \\frac{t_{s}}{2}', sub: inc ? `${n(G.h, 2)} + ${n(th, 2)} + \\frac{${n(ts, 2)}}{2}` : `${n(G.h, 2)} + \\frac{${n(ts, 2)}}{2}`, value: yd, unit: 'in', d: 3,
        note: inc ? 'Haunch included in the section properties (Cross-section tab).' : (box ? 'Adjacent beam: the topping bears on the beam.' : 'Haunch excluded from the section properties: the deck is taken bearing on the top flange (its weight is carried in DC1).') }, G.h + gap + ts / 2);
      if (inc) add({ id: 'Ah', label: 'Transformed haunch area', sym: 'A_{h}', eq: 'b_{h}\\,n\\,t_{h}', sub: `${n(bh, 2)}(${n(cp.n, 4)})(${n(th, 2)})`, value: Ah, unit: 'in^{2}', d: 1 }, bh * cp.n * th);
      add({ id: 'Ac', label: 'Composite area (transformed)', sym: 'A_{c}', eq: inc ? 'A + A_{d} + A_{h}' : 'A + A_{d}', sub: inc ? `${n(G.A, 1)} + ${n(Ad, 1)} + ${n(Ah, 1)}` : `${n(G.A, 1)} + ${n(Ad, 1)}`, value: cp.Ac, unit: 'in^{2}', d: 1 }, G.A + Ad + Ah);
      add({ id: 'ybc', label: 'Composite centroid above the soffit', sym: 'y_{bc}', eq: inc ? '\\frac{A\\,y_{b} + A_{d}\\,y_{d} + A_{h}\\,y_{h}}{A_{c}}' : '\\frac{A\\,y_{b} + A_{d}\\,y_{d}}{A_{c}}',
        sub: `\\frac{${n(G.A, 1)}(${n(G.yb, 3)}) + ${n(Ad, 1)}(${n(yd, 3)})${inc ? ` + ${n(Ah, 1)}(${n(yh, 3)})` : ''}}{${n(cp.Ac, 1)}}`, value: cp.ybc, unit: 'in', d: 3 }, (G.A * G.yb + Ad * yd + Ah * yh) / cp.Ac);
      const t1 = G.A * (cp.ybc - G.yb) ** 2, t2 = cp.beff * cp.n * ts ** 3 / 12, t3 = Ad * (yd - cp.ybc) ** 2, t4 = inc ? bh * cp.n * th ** 3 / 12 : 0, t5 = inc ? Ah * (yh - cp.ybc) ** 2 : 0;
      add({ id: 'Ic', label: 'Composite moment of inertia (parallel axes)', sym: 'I_{c}', eq: `I + A(y_{bc} - y_{b})^{2} + \\frac{b_{eff}\\,n\\,t_{s}^{3}}{12} + A_{d}(y_{d} - y_{bc})^{2}${inc ? ' + \\frac{b_{h}\\,n\\,t_{h}^{3}}{12} + A_{h}(y_{h} - y_{bc})^{2}' : ''}`,
        sub: `${g(G.I, 0)} + ${g(t1, 0)} + ${g(t2, 0)} + ${g(t3, 0)}${inc ? ` + ${g(t4, 0)} + ${g(t5, 0)}` : ''}`, value: cp.Ic, unit: 'in^{4}', d: 0 }, G.I + t1 + t2 + t3 + t4 + t5);
      add({ id: 'hc', label: 'Composite depth', sym: 'h_{c}', eq: inc ? 'h + t_{h} + t_{s}' : 'h + t_{s}', sub: inc ? `${n(G.h, 2)} + ${n(th, 2)} + ${n(ts, 2)}` : `${n(G.h, 2)} + ${n(ts, 2)}`, value: cp.hc, unit: 'in', d: 2 }, G.h + gap + ts);
    } else {
      add({ id: 'Ac', label: 'Composite area (no deck: the girder alone)', sym: 'A_{c}', eq: 'A', sub: n(G.A, 1), value: cp.Ac, unit: 'in^{2}', d: 1, note: 't_s = 0: no composite topping.' }, G.A);
      add({ id: 'ybc', label: 'Composite centroid (no deck)', sym: 'y_{bc}', eq: 'y_{b}', sub: n(G.yb, 3), value: cp.ybc, unit: 'in', d: 3 }, G.yb);
      add({ id: 'Ic', label: 'Composite moment of inertia (no deck)', sym: 'I_{c}', eq: 'I', sub: g(G.I, 0), value: cp.Ic, unit: 'in^{4}', d: 0 }, G.I);
      add({ id: 'hc', label: 'Composite depth (no deck)', sym: 'h_{c}', eq: inc ? 'h + t_{h}' : 'h', sub: inc ? `${n(G.h, 2)} + ${n(th, 2)}` : n(G.h, 2), value: cp.hc, unit: 'in', d: 2 }, G.h + gap);
    }
    add({ id: 'Sbc', label: 'Composite section modulus, bottom of the girder', sym: 'S_{bc}', eq: '\\frac{I_{c}}{y_{bc}}', sub: `\\frac{${g(cp.Ic, 0)}}{${n(cp.ybc, 3)}}`, value: cp.Sbc, unit: 'in^{3}', d: 0 }, cp.Ic / cp.ybc);
    add({ id: 'Stg', label: 'Composite section modulus, top of the girder', sym: 'S_{tg}', eq: '\\frac{I_{c}}{h - y_{bc}}', sub: `\\frac{${g(cp.Ic, 0)}}{${n(G.h, 2)} - ${n(cp.ybc, 3)}}`, value: cp.Stg, unit: 'in^{3}', d: 0 }, cp.Ic / (G.h - cp.ybc));
    if (ts > 0) add({ id: 'Std', label: 'Composite section modulus, top of the deck (in deck stress units)', sym: 'S_{td}', eq: '\\frac{I_{c}}{n(h_{c} - y_{bc})}', sub: `\\frac{${g(cp.Ic, 0)}}{${n(cp.n, 4)}(${n(cp.hc, 2)} - ${n(cp.ybc, 3)})}`, value: cp.Std, unit: 'in^{3}', d: 0 }, cp.Ic / (cp.hc - cp.ybc) / cp.n);
    // strands
    const Ab = ss.st.Ab, Lf = inp.L, a = ss.at(Lf / 2);
    add({ id: 'N', label: 'Number of strands', sym: 'N', eq: '\\sum n_{i} + n_{h}', sub: `${ss.rows.map(r => r.n).join(' + ') || '0'} + ${ss.nh}`, value: ss.Ntot, unit: '', d: 0 }, ss.Nbond + ss.nh);
    add({ id: 'Aps', label: 'Area of prestressing steel', sym: 'A_{ps}', eq: 'N\\,A_{b}', sub: `${ss.Ntot}(${n(Ab, 3)})`, value: ss.Aps, unit: 'in^{2}', d: 3, note: `${inp.str.size} strand, A_b = ${Ab} in².` }, ss.Ntot * Ab);
    if (ss.Nbond > 0) add({ id: 'ycs', label: 'Centroid of the straight strands above the soffit', sym: 'y_{s}', eq: '\\frac{\\sum n_{i}\\,y_{i}}{\\sum n_{i}}', sub: `\\frac{${ss.rows.map(r => `${r.n}(${n(r.y, 2)})`).join(' + ')}}{${ss.Nbond}}`, value: ss.cgsStraight, unit: 'in', d: 3 }, ss.rows.reduce((s, r) => s + r.n * r.y, 0) / ss.Nbond);
    if (ss.nh > 0) {
      add({ id: 'aHd', label: 'Hold-down points from ℄ bearing', sym: 'x_{hd}', eq: '\\text{frac}\\times L', sub: `${n(+ss.hp.frac, 3)}(${n(Lf, 2)})`, value: ss.hp.frac * Lf, unit: 'ft', d: 2, note: 'Two hold-down points, one from each ℄ bearing (PS-13).' }, ss.hp.frac * Lf);
      add({ id: 'slope', label: 'Slope of the draped strands', sym: '\\tan\\psi', eq: '\\frac{y_{end} - y_{mid}}{12\\,x_{hd}}', sub: `\\frac{${n(+ss.hp.yEnd, 2)} - ${n(+ss.hp.yMid, 2)}}{12(${n(ss.hp.frac * Lf, 2)})}`, value: ss.slope, unit: '', d: 4 }, (ss.hp.yEnd - ss.hp.yMid) / (ss.hp.frac * Lf * 12));
    }
    const full = Math.abs(a.Neff - ss.Ntot) < 1e-9;
    const ym = full ? (ss.rows.reduce((s, r) => s + r.n * r.y, 0) + ss.nh * (+ss.hp.yMid)) / ss.Ntot : undefined;
    add({ id: 'cgsMid', label: 'Strand centroid at midspan above the soffit', sym: 'y_{ps}', eq: '\\frac{\\sum n_{i}\\,y_{i} + n_{h}\\,y_{mid}}{N}', sub: full ? `\\frac{${ss.rows.map(r => `${r.n}(${n(r.y, 2)})`).join(' + ')}${ss.nh ? ` + ${ss.nh}(${n(+ss.hp.yMid, 2)})` : ''}}{${ss.Ntot}}` : '',
      value: ss.cgsMid, unit: 'in', d: 3, note: full ? '' : 'Effective strands at midspan only (debonding or transfer length reaches midspan).' }, ym);
    add({ id: 'eMid', label: 'Strand eccentricity at midspan', sym: 'e_{m}', eq: 'y_{b} - y_{ps}', sub: `${n(G.yb, 3)} - ${n(ss.cgsMid, 3)}`, value: ss.eMid, unit: 'in', d: 3 }, G.yb - ss.cgsMid);
    add({ id: 'lt', label: 'Transfer length', sym: '\\ell_{t}', eq: '60\\,d_{b}', sub: `60(${n(ss.st.db, 2)})`, value: ss.lt, unit: 'in', d: 1, ref: A10 + '5.9.4.3.1' }, 60 * ss.st.db);
    return K.done();
  }

  /* PS-35 (engine/lldf-fg.js): the type (f) / (g) distribution factors of a box beam or a voided slab, worked (the values are R.df's) */
  function fgSteps(add, inp, R) {
    const df = R.df, f = df.fg, jw = f.jw, L = f.L, b = f.b, T = A10 + 'Table 4.6.2.2.';
    const tyN = f.type === 'f' ? 'type (f): precast boxes with shear keys and a cast-in-place overlay' : 'type (g): precast boxes with shear keys, integral concrete deck';
    add({ id: 'fgI', label: `Moment of inertia, ${f.ts > 0 ? 'the composite section (traffic on the topping)' : 'the girder (no topping)'}`, sym: 'I', value: f.I, unit: 'in^{4}', d: 0, ref: A10 + '4.6.2.2.1',
      note: f.ts > 0 ? `Cross-section ${tyN}; the composite I_c, worked on the Section properties tab (§sec.Ic).` : `Cross-section ${tyN}; the gross girder I (Section properties tab).` });
    // J of the drawn outline: a closed thin-walled cell on the wall midlines (Eq. C4.6.2.2.1-3)
    const box = jw.kind === 'box', v = jw.v;
    if (box) {
      add({ id: 'Jtw', label: 'J (outline): web thickness', sym: 't_{w}', eq: '\\frac{w - w_{v}}{2}', sub: `\\frac{${n(jw.w, 2)} - ${n(v.w, 2)}}{2}`, value: jw.tw, unit: 'in', d: 2, note: 'w_v: the void width (Section properties tab).' }, (jw.w - v.w) / 2);
      add({ id: 'Jtb', label: 'J (outline): bottom slab', sym: 't_{b}', eq: 'y_{v} - \\frac{h_{v}}{2}', sub: `${n(v.y, 3)} - \\frac{${n(v.h, 2)}}{2}`, value: jw.tb, unit: 'in', d: 2 }, v.y - v.h / 2);
      add({ id: 'Jtt', label: 'J (outline): top slab', sym: 't_{t}', eq: 'h - y_{v} - \\frac{h_{v}}{2}', sub: `${n(jw.h, 2)} - ${n(v.y, 3)} - \\frac{${n(v.h, 2)}}{2}`, value: jw.tt, unit: 'in', d: 2 }, jw.h - v.y - v.h / 2);
    } else {
      const o = v.out, lo = v.lo, hi = v.hi;
      add({ id: 'Jtw', label: 'J (outline): side wall, the concrete outside the outermost void', sym: 't_{w}', eq: '\\frac{w}{2} - |x_{v}| - \\frac{d_{v}}{2}', sub: `\\frac{${n(jw.w, 2)}}{2} - ${n(Math.abs(o.x), 2)} - \\frac{${n(o.d, 2)}}{2}`, value: jw.tw, unit: 'in', d: 2,
        note: 'Void positions as drawn (Section properties tab; a standard slab: the plate\'s, the spacing scaled from the plate).' }, jw.w / 2 - Math.abs(o.x) - o.d / 2);
      add({ id: 'Jtb', label: 'J (outline): bottom wall, the concrete below the voids', sym: 't_{b}', eq: 'y_{v} - \\frac{d_{v}}{2}', sub: `${n(lo.y, 3)} - \\frac{${n(lo.d, 2)}}{2}`, value: jw.tb, unit: 'in', d: 2 }, lo.y - lo.d / 2);
      add({ id: 'Jtt', label: 'J (outline): top wall, the concrete above the voids', sym: 't_{t}', eq: 'h - y_{v} - \\frac{d_{v}}{2}', sub: `${n(jw.h, 2)} - ${n(hi.y, 3)} - \\frac{${n(hi.d, 2)}}{2}`, value: jw.tt, unit: 'in', d: 2,
        note: 'The voided slab is taken as one closed cell of its outer walls (the concrete between the voids is not counted: a smaller J).' }, jw.h - hi.y - hi.d / 2);
    }
    if (jw.comp) {
      add({ id: 'JtT', label: 'J (outline): top wall with the topping (transformed by n)', sym: 't_{top}', eq: 't_{t} + n\\,t_{s}', sub: `${n(jw.tt, 2)} + ${n(jw.n, 4)}(${n(jw.ts, 2)})`, value: jw.tT, unit: 'in', d: 3, note: 'n: §sec.n (Section properties tab).' }, jw.tt + jw.n * jw.ts);
      add({ id: 'JyT', label: 'J (outline): midline of the top wall above the soffit', sym: '\\bar{y}_{top}', eq: '\\frac{t_{t}(h - t_{t}/2) + n\\,t_{s}(h + t_{s}/2)}{t_{top}}',
        sub: `\\frac{${n(jw.tt, 2)}(${n(jw.h, 2)} - ${n(jw.tt / 2, 3)}) + ${n(jw.n, 4)}(${n(jw.ts, 2)})(${n(jw.h, 2)} + ${n(jw.ts / 2, 3)})}{${n(jw.tT, 3)}}`, value: jw.yT, unit: 'in', d: 3 },
        (jw.tt * (jw.h - jw.tt / 2) + jw.n * jw.ts * (jw.h + jw.ts / 2)) / jw.tT);
    } else add({ id: 'JyT', label: 'J (outline): midline of the top wall above the soffit', sym: '\\bar{y}_{top}', eq: 'h - \\frac{t_{t}}{2}', sub: `${n(jw.h, 2)} - \\frac{${n(jw.tt, 2)}}{2}`, value: jw.yT, unit: 'in', d: 3 }, jw.h - jw.tt / 2);
    add({ id: 'Jb0', label: 'J (outline): cell width between the web midlines', sym: 'b_{0}', eq: 'w - t_{w}', sub: `${n(jw.w, 2)} - ${n(jw.tw, 2)}`, value: jw.b0, unit: 'in', d: 2 }, jw.w - jw.tw);
    add({ id: 'Jh0', label: 'J (outline): cell height between the wall midlines', sym: 'h_{0}', eq: '\\bar{y}_{top} - \\frac{t_{b}}{2}', sub: `${n(jw.yT, 3)} - \\frac{${n(jw.tb, 2)}}{2}`, value: jw.h0, unit: 'in', d: 3 }, jw.yT - jw.tb / 2);
    add({ id: 'JA0', label: 'J (outline): area enclosed by the wall midlines', sym: 'A_{0}', eq: 'b_{0}\\,h_{0}', sub: `${n(jw.b0, 2)}(${n(jw.h0, 3)})`, value: jw.A0, unit: 'in^{2}', d: 1 }, jw.b0 * jw.h0);
    add({ id: 'Jst', label: 'J (outline): sum of side length over thickness', sym: '\\sum \\frac{s}{t}', eq: `\\frac{b_{0}}{t_{${jw.comp ? 'top' : 't'}}} + \\frac{b_{0}}{t_{b}} + \\frac{2\\,h_{0}}{t_{w}}`,
      sub: `\\frac{${n(jw.b0, 2)}}{${n(jw.tT, 3)}} + \\frac{${n(jw.b0, 2)}}{${n(jw.tb, 2)}} + \\frac{2(${n(jw.h0, 3)})}{${n(jw.tw, 2)}}`, value: jw.sum, unit: '', d: 3 }, jw.b0 / jw.tT + jw.b0 / jw.tb + 2 * jw.h0 / jw.tw);
    add({ id: 'Jc', label: 'St. Venant torsional constant, computed from outline (closed thin-walled section)', sym: 'J_{outline}', eq: '\\frac{4\\,A_{0}^{2}}{\\sum s/t}', sub: `\\frac{4(${n(jw.A0, 1)})^{2}}{${n(jw.sum, 3)}}`, value: jw.J, unit: 'in^{4}', d: 0, ref: A10 + 'Eq. C4.6.2.2.1-3' }, 4 * jw.A0 * jw.A0 / jw.sum);
    if (f.Jsrc === 'user') add({ id: 'J', label: 'J used: user/DOT value', sym: 'J', value: f.J, unit: 'in^{4}', d: 0, note: 'Entered for this girder type (Loads tab, "J (override)"); the value computed from the outline above is not used.' });
    else if (f.Jsrc === 'library') add({ id: 'J', label: 'J used: library (DOT) value', sym: 'J', value: f.J, unit: 'in^{4}', d: 0, note: `The library's value for ${inp.girder}${f.Jlib && f.Jlib.src ? ` (${f.Jlib.src})` : ''}; the value computed from the outline above is not used.` });
    else add({ id: 'J', label: 'J used: computed from outline', sym: 'J', eq: 'J_{outline}', sub: n(jw.J, 0), value: f.J, unit: 'in^{4}', d: 0 }, jw.J);
    add({ id: 'IJ', label: 'Stiffness ratio', sym: '\\frac{I}{J}', eq: '\\frac{I}{J}', sub: `\\frac{${g(f.I, 0)}}{${g(f.J, 0)}}`, value: f.IJ, unit: '', d: 4,
      note: `For comparison only (not used): the simplified value of Table 4.6.2.2.1-3 for (f)/(g), 0.54 d/b + 0.16 = 0.54(${n(f.d, 2)}/${n(b, 2)}) + 0.16 = ${n(0.54 * f.d / b + 0.16, 4)} (with the Owner's concurrence, 4.6.2.2.1).` }, f.I / f.J);
    add({ id: 'k', label: 'Factor k (number of beams)', sym: 'k', eq: '\\max(2.5\\,N_{b}^{-0.2},\\ 1.5)', sub: `\\max(2.5(${f.Nb})^{-0.2},\\ 1.5)`, value: f.k, unit: '', d: 4, ref: T + '2b-1' }, Math.max(2.5 * Math.pow(f.Nb, -0.2), 1.5));
    add({ id: 'm1', label: 'Interior moment DF, one lane loaded', sym: 'g_{M1}', eq: 'k\\left(\\frac{b}{33.3\\,L}\\right)^{0.5}\\left(\\frac{I}{J}\\right)^{0.25}', sub: `${n(f.k, 4)}\\left(\\frac{${n(b, 2)}}{33.3(${n(L, 2)})}\\right)^{0.5}(${n(f.IJ, 4)})^{0.25}`, value: f.m1, unit: '', d: 4, ref: T + '2b-1, (f)/(g)' },
      f.k * Math.pow(b / (33.3 * L), 0.5) * Math.pow(f.IJ, 0.25));
    add({ id: 'm2', label: 'Interior moment DF, two or more lanes loaded', sym: 'g_{M2}', eq: 'k\\left(\\frac{b}{305}\\right)^{0.6}\\left(\\frac{b}{12\\,L}\\right)^{0.2}\\left(\\frac{I}{J}\\right)^{0.06}', sub: `${n(f.k, 4)}\\left(\\frac{${n(b, 2)}}{305}\\right)^{0.6}\\left(\\frac{${n(b, 2)}}{12(${n(L, 2)})}\\right)^{0.2}(${n(f.IJ, 4)})^{0.06}`, value: f.m2, unit: '', d: 4, ref: T + '2b-1, (f)/(g)' },
      f.k * Math.pow(b / 305, 0.6) * Math.pow(b / (12 * L), 0.2) * Math.pow(f.IJ, 0.06));
    add({ id: 'v1', label: 'Interior shear DF, one lane loaded', sym: 'g_{V1}', eq: '\\left(\\frac{b}{130\\,L}\\right)^{0.15}\\left(\\frac{I}{J}\\right)^{0.05}', sub: `\\left(\\frac{${n(b, 2)}}{130(${n(L, 2)})}\\right)^{0.15}(${n(f.IJ, 4)})^{0.05}`, value: f.v1, unit: '', d: 4, ref: T + '3a-1, (f)/(g)' },
      Math.pow(b / (130 * L), 0.15) * Math.pow(f.IJ, 0.05));
    add({ id: 'v2', label: 'Interior shear DF, two or more lanes loaded', sym: 'g_{V2}', eq: '\\left(\\frac{b}{156}\\right)^{0.4}\\left(\\frac{b}{12\\,L}\\right)^{0.1}\\left(\\frac{I}{J}\\right)^{0.05}\\max\\left(\\frac{b}{48},\\ 1.0\\right)',
      sub: `\\left(\\frac{${n(b, 2)}}{156}\\right)^{0.4}\\left(\\frac{${n(b, 2)}}{12(${n(L, 2)})}\\right)^{0.1}(${n(f.IJ, 4)})^{0.05}\\max\\left(\\frac{${n(b, 2)}}{48},\\ 1.0\\right)`, value: f.v2, unit: '', d: 4, ref: T + '3a-1, (f)/(g)' },
      Math.pow(b / 156, 0.4) * Math.pow(b / (12 * L), 0.1) * Math.pow(f.IJ, 0.05) * Math.max(b / 48, 1));
    if (f.ext) {
      const de = f.de;
      add({ id: 'eM1', label: 'Exterior correction, moment, one lane', sym: 'e_{M1}', eq: '\\max\\left(1.125 + \\frac{d_{e}}{30},\\ 1.0\\right)', sub: `\\max\\left(1.125 + \\frac{${n(de, 3)}}{30},\\ 1.0\\right)`, value: f.eM1, unit: '', d: 4, ref: T + '2d-1, (f)/(g)',
        note: 'd_e from the centreline of the exterior beam (as the engine takes it for every shape; the exterior web centreline would give a smaller d_e).' }, Math.max(1.125 + de / 30, 1));
      add({ id: 'eM2', label: 'Exterior correction, moment, two or more lanes', sym: 'e_{M2}', eq: '\\max\\left(1.04 + \\frac{d_{e}}{25},\\ 1.0\\right)', sub: `\\max\\left(1.04 + \\frac{${n(de, 3)}}{25},\\ 1.0\\right)`, value: f.eM2, unit: '', d: 4, ref: T + '2d-1, (f)/(g)' }, Math.max(1.04 + de / 25, 1));
      add({ id: 'eV1', label: 'Exterior correction, shear, one lane', sym: 'e_{V1}', eq: '\\max\\left(1.25 + \\frac{d_{e}}{20},\\ 1.0\\right)', sub: `\\max\\left(1.25 + \\frac{${n(de, 3)}}{20},\\ 1.0\\right)`, value: f.eV1, unit: '', d: 4, ref: T + '3b-1, (f)/(g)' }, Math.max(1.25 + de / 20, 1));
      add({ id: 'eV2', label: 'Exterior correction, shear, two or more lanes', sym: 'e_{V2}', eq: '\\max\\left(1 + \\left(\\frac{d_{e} + b/12 - 2.0}{40}\\right)^{0.5},\\ 1.0\\right)', sub: `\\max\\left(1 + \\left(\\frac{${n(de, 3)} + ${n(b / 12, 4)} - 2.0}{40}\\right)^{0.5},\\ 1.0\\right)`, value: f.eV2, unit: '', d: 4, ref: T + '3b-1, (f)/(g)',
        note: f.qV > 0 ? '' : 'The root\'s argument is negative: taken as 0 (e = 1.0).' }, Math.max(1 + (f.qV > 0 ? Math.sqrt(f.qV) : 0), 1));
      add({ id: 'f48', label: 'Exterior shear, two or more lanes: width factor', sym: '\\frac{48}{b}', eq: '\\min\\left(\\frac{48}{b},\\ 1.0\\right)', sub: `\\min\\left(\\frac{48}{${n(b, 2)}},\\ 1.0\\right)`, value: f.f48, unit: '', d: 4, ref: T + '3b-1, (f)/(g)' }, Math.min(48 / b, 1));
      add({ id: 'dfmRaw', label: 'Exterior moment DF before skew (larger of one lane and two or more)', sym: 'g_{M}', eq: '\\max(e_{M1}\\,g_{M1},\\ e_{M2}\\,g_{M2})', sub: `\\max(${n(f.eM1, 4)}(${n(f.m1, 4)}),\\ ${n(f.eM2, 4)}(${n(f.m2, 4)}))`, value: df.dfmRaw, unit: '', d: 4,
        note: 'No lever rule and no rigid-section check for types (f) and (g) (Table 4.6.2.2.2d-1).' }, Math.max(f.eM1 * f.m1, f.eM2 * f.m2));
      const vq = Math.max(f.eV1 * f.v1, f.eV2 * f.v2 * f.f48);
      if (f.IJout) add({ id: 'dfvRaw', label: 'Exterior shear DF before skew (I or J outside the range of Table 4.6.2.2.3a-1: the larger of the shear equations and the moment factor)', sym: 'g_{V}', eq: '\\max(e_{V1}\\,g_{V1},\\ e_{V2}\\,g_{V2}\\,\\frac{48}{b},\\ g_{M})',
        sub: `\\max(${n(f.eV1, 4)}(${n(f.v1, 4)}),\\ ${n(f.eV2, 4)}(${n(f.v2, 4)})(${n(f.f48, 4)}),\\ ${n(f.gM, 4)})`, value: df.dfvRaw, unit: '', d: 4, ref: A10 + '4.6.2.2.3a' }, Math.max(vq, f.gM));
      else add({ id: 'dfvRaw', label: 'Exterior shear DF before skew (larger of one lane and two or more)', sym: 'g_{V}', eq: '\\max(e_{V1}\\,g_{V1},\\ e_{V2}\\,g_{V2}\\,\\frac{48}{b})', sub: `\\max(${n(f.eV1, 4)}(${n(f.v1, 4)}),\\ ${n(f.eV2, 4)}(${n(f.v2, 4)})(${n(f.f48, 4)}))`, value: df.dfvRaw, unit: '', d: 4 }, vq);
    } else {
      add({ id: 'dfmRaw', label: 'Interior moment DF before skew (larger of one lane and two or more)', sym: 'g_{M}', eq: '\\max(g_{M1},\\ g_{M2})', sub: `\\max(${n(f.m1, 4)},\\ ${n(f.m2, 4)})`, value: df.dfmRaw, unit: '', d: 4 }, Math.max(f.m1, f.m2));
      if (f.IJout) add({ id: 'dfvRaw', label: 'Interior shear DF before skew (I or J outside the range of Table 4.6.2.2.3a-1: the larger of the shear equations and the moment factor)', sym: 'g_{V}', eq: '\\max(g_{V1},\\ g_{V2},\\ g_{M})', sub: `\\max(${n(f.v1, 4)},\\ ${n(f.v2, 4)},\\ ${n(f.gM, 4)})`, value: df.dfvRaw, unit: '', d: 4, ref: A10 + '4.6.2.2.3a' }, Math.max(f.v1, f.v2, f.gM));
      else add({ id: 'dfvRaw', label: 'Interior shear DF before skew (larger of one lane and two or more)', sym: 'g_{V}', eq: '\\max(g_{V1},\\ g_{V2})', sub: `\\max(${n(f.v1, 4)},\\ ${n(f.v2, 4)})`, value: df.dfvRaw, unit: '', d: 4 }, Math.max(f.v1, f.v2));
    }
    const tM = Math.tan(f.thM * Math.PI / 180), tV = Math.tan(f.thV * Math.PI / 180);
    add({ id: 'skM', label: `Skew reduction, moment (θ_M = ${n(f.thM, 1)}°)`, sym: 'r_{M}', eq: '\\min(1.05 - 0.25\\tan\\theta_{M},\\ 1.0)', sub: `\\min(1.05 - 0.25(${n(tM, 4)}),\\ 1.0)`, value: df.skM, unit: '', d: 4, ref: T + '2e-1, (f)/(g)',
      note: f.thLo < f.thV - 1e-9 ? (f.skewDiff > 10 + 1e-9 ? `The skews of the span's supports differ by more than 10° (${n(f.thLo, 1)}° and ${n(f.thV, 1)}°): no reduction (4.6.2.2.2e).` : `The smaller skew of the span's supports (${n(f.thLo, 1)}°; they differ by 10° or less, 4.6.2.2.2e).`) : (f.rawSkew > 60 ? 'θ > 60° is taken as 60°.' : '') }, Math.min(1.05 - 0.25 * tM, 1));
    add({ id: 'skV', label: `Skew correction, shear (θ = ${n(f.thV, 1)}°)`, sym: 'c_{V}', eq: '1 + \\frac{12\\,L}{90\\,d}\\sqrt{\\tan\\theta}', sub: `1 + \\frac{12(${n(L, 2)})}{90(${n(f.d, 2)})}\\sqrt{${n(tV, 4)}}`, value: df.skV, unit: '', d: 4, ref: T + '3c-1, (f)/(g)',
      note: 'd = the precast depth h; θ the larger skew of the span\'s supports; applied over the span as the engine applies its shear correction.' }, 1 + 12 * L / (90 * f.d) * Math.sqrt(tV));
  }

  /* ---------- Loads & LLDF (computeAll loads, hl93, distFactors, ownLoads) ---------- */
  function loads(inp, R) {
    const K = kit('ld'), add = K.add, G = R.g, cp = R.cp, L = R.L, hl = R.hl, df = R.df, m = inp.mat, wdL = +m.wcdLoad || +m.wcd, tsL = cp.tsLoad, th = +inp.th;
    // owner load rules
    const own = R.own || (window.PBD && window.PBD.ownLoads ? window.PBD.ownLoads(inp) : { owner: 'AASHTO', etaD: 1, etaR: 1, etaI: 1, eta: 1, mLL: 1 });
    add({ id: 'eta', label: `Load modifier, Strength I (${own.owner})`, sym: '\\eta', eq: '\\eta_{D}\\,\\eta_{R}\\,\\eta_{I}', sub: `${n(own.etaD, 2)}(${n(own.etaR, 2)})(${n(own.etaI, 2)})`, value: own.eta, unit: '', d: 4, ref: A10 + '1.3.2.1', note: own.owner === 'AASHTO' ? 'AASHTO: η = 1.0 (no owner rules).' : 'Owner questions on the Owner rules tab.' }, own.etaD * own.etaR * own.etaI);
    add({ id: 'mLL', label: 'Design load multiplier on HL-93 (LL+IM), Strength and Service', sym: 'm', value: own.mLL, unit: '', d: 2, note: own.mLL !== 1 ? 'Owner rule (RIDOT BDM 3.4.1.2); not on the deflection, fatigue or rating.' : '1.0 (no owner multiplier).' });
    // DC1
    add({ id: 'wg', label: 'DC1: girder self-weight', sym: 'w_{g}', value: R.wG, unit: 'klf', d: 4, note: 'Worked on the Section properties tab (§sec.g.wsw).' });
    if (cp.wdkDeck > 0 || +inp.ts > 0) add({ id: 'wdeck', label: 'DC1: deck slab weight', sym: 'w_{deck}', eq: '\\frac{b_{trib}\\,t_{s,DL}}{144}\\,w_{c,d,DL}', sub: `\\frac{${n(cp.wdkW, 2)}(${n(tsL, 2)})}{144}(${n(wdL, 3)})`, value: cp.wdkDeck, unit: 'klf', d: 4, ref: A10 + '3.5.1',
      note: G.isNext || G.isBox || G.isDeck ? 'Width = b_eff.' : `Tributary width ${cp.extG ? '(S/2 + overhang) × 12' : 'S × 12'} (4.6.2.6.1).` }, cp.wdkW * tsL / 144 * wdL);
    if (cp.wdkHaunch > 0) add({ id: 'whaunch', label: 'DC1: haunch weight', sym: 'w_{h}', eq: '\\frac{b_{tf}\\,t_{h}}{144}\\,w_{c,d,DL}', sub: `\\frac{${n(cp.wdkHW, 2)}(${n(th, 2)})}{144}(${n(wdL, 3)})`, value: cp.wdkHaunch, unit: 'klf', d: 4 }, cp.wdkHW * th / 144 * wdL);
    add({ id: 'wDC1', label: 'DC1 distributed on the non-composite girder (deck + haunch + additional)', sym: 'w_{DC1}', eq: 'w_{deck} + w_{h} + w_{NC}', sub: `${n(cp.wdkDeck, 4)} + ${n(cp.wdkHaunch, 4)} + ${n(+inp.loads.wNC, 4)}`, value: R.wDk, unit: 'klf', d: 4 }, cp.wdkDeck + cp.wdkHaunch + (+inp.loads.wNC));
    if (R.nDiaph) add({ id: 'Pdia', label: 'DC1 diaphragm point loads on the span', sym: '\\sum P', eq: '\\sum P_{i}', sub: (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= L).map(d => n(+d.P, 2)).join(' + '), value: R.Pdia, unit: 'kip', d: 2 }, (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= L).reduce((s, d) => s + (+d.P), 0));
    add({ id: 'wDC2', label: 'DC2 superimposed dead load (entered, per girder)', sym: 'w_{DC2}', value: R.wBar, unit: 'klf', d: 4, note: 'Loads tab; on the composite section.' });
    add({ id: 'wDW', label: 'DW wearing surface (entered, per girder)', sym: 'w_{DW}', value: R.wDW, unit: 'klf', d: 4, note: 'Loads tab; on the composite section.' });
    // HL-93 on the simple span (per lane)
    const Mtd = 25 * L / 4 + 25 * (L / 2 - 4) / 2;
    add({ id: 'Mtr', label: 'Design truck moment at midspan, per lane', sym: 'M_{tr}', value: hl.Mtr, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.2.2', note: 'Maximum over the truck positions (both orientations, 0.1 ft steps), 14 ft axle spacings.' });
    add({ id: 'Mtd', label: 'Design tandem moment at midspan, per lane', sym: 'M_{td}', eq: '\\frac{25\\,L}{4} + \\frac{25(L/2 - 4)}{2}', sub: `\\frac{25(${n(L, 2)})}{4} + \\frac{25(${n(L / 2, 2)} - 4)}{2}`, value: hl.Mtd, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.2.3' }, Mtd);
    add({ id: 'Mln', label: 'Design lane moment at midspan, per lane', sym: 'M_{ln}', eq: '\\frac{0.64\\,L^{2}}{8}', sub: `\\frac{0.64(${n(L, 2)})^{2}}{8}`, value: hl.Mln, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.2.4' }, 0.64 * L * L / 8);
    add({ id: 'M', label: 'HL-93 moment with impact, per lane', sym: 'M_{LL+IM}', eq: '1.33\\max(M_{tr}, M_{td}) + M_{ln}', sub: `1.33\\max(${n(hl.Mtr, 1)}, ${n(hl.Mtd, 1)}) + ${n(hl.Mln, 1)}`, value: hl.M, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.3.1, 3.6.2.1' }, 1.33 * Math.max(hl.Mtr, hl.Mtd) + hl.Mln);
    const Vtr = Math.max(32 + 32 * (L - 14) / L + 8 * (L - 28) / L, 32 + 32 * (L - 14) / L);
    add({ id: 'Vtr', label: 'Design truck shear at the support, per lane', sym: 'V_{tr}', eq: '32 + \\frac{32(L - 14)}{L} + \\frac{8(L - 28)}{L}', sub: `32 + \\frac{32(${n(L, 2)} - 14)}{${n(L, 2)}} + \\frac{8(${n(L, 2)} - 28)}{${n(L, 2)}}`, value: hl.Vtr, unit: 'kip', d: 2, note: L < 28 ? 'Rear axle off the span: the 8 kip term is 0.' : '' }, Vtr);
    add({ id: 'Vtd', label: 'Design tandem shear at the support, per lane', sym: 'V_{td}', eq: '25 + \\frac{25(L - 4)}{L}', sub: `25 + \\frac{25(${n(L, 2)} - 4)}{${n(L, 2)}}`, value: hl.Vtd, unit: 'kip', d: 2 }, 25 + 25 * (L - 4) / L);
    add({ id: 'Vln', label: 'Design lane shear at the support, per lane', sym: 'V_{ln}', eq: '\\frac{0.64\\,L}{2}', sub: `\\frac{0.64(${n(L, 2)})}{2}`, value: hl.Vln, unit: 'kip', d: 2 }, 0.64 * L / 2);
    add({ id: 'V', label: 'HL-93 shear with impact, per lane', sym: 'V_{LL+IM}', eq: '1.33\\max(V_{tr}, V_{td}) + V_{ln}', sub: `1.33\\max(${n(hl.Vtr, 2)}, ${n(hl.Vtd, 2)}) + ${n(hl.Vln, 2)}`, value: hl.V, unit: 'kip', d: 2 }, 1.33 * Math.max(hl.Vtr, hl.Vtd) + hl.Vln);
    // distribution factors (pbd-lldf-flexure.js distFactors; PS-35: a box beam or voided slab, types (f) / (g), engine/lldf-fg.js)
    if (df.fg) fgSteps(add, inp, R); else {
    const ts = +inp.ts, Sx = df.isNext ? df.Sf : inp.S;
    if (df.isNext) add({ id: 'Sf', label: 'NEXT beam: beam (flange) width used as S', sym: 'S', eq: '\\frac{b_{f}}{12}', sub: `\\frac{${n(G.btf, 2)}}{12}`, value: df.Sf, unit: 'ft', d: 3 }, G.btf / 12);
    if (!df.isNext || !df.kgOmitted) {
      add({ id: 'eg', label: 'Distance between the girder and deck centroids', sym: 'e_{g}', eq: 'h + t_{h} + \\frac{t_{s}}{2} - y_{b}', sub: `${n(G.h, 2)} + ${n(th, 2)} + \\frac{${n(ts, 2)}}{2} - ${n(G.yb, 3)}`, value: df.eg, unit: 'in', d: 3, ref: A10 + '4.6.2.2.1' }, G.h + th + ts / 2 - G.yb);
      const nK = cp.Ecg / cp.Ecd;
      add({ id: 'Kg', label: 'Longitudinal stiffness parameter', sym: 'K_{g}', eq: '\\frac{E_{c}}{E_{c,d}}(I + A\\,e_{g}^{2})', sub: `\\frac{${n(cp.Ecg, 0)}}{${n(cp.Ecd, 0)}}(${g(G.I, 0)} + ${n(G.A, 1)}(${n(df.eg, 3)})^{2})`, value: df.Kg, unit: 'in^{4}', d: 0, ref: A10 + 'Eq. 4.6.2.2.1-1' }, nK * (G.I + G.A * df.eg * df.eg));
    }
    const ts3 = df.isNext ? (df.kgOmitted ? 1 : ts ** 3) : Math.max(ts ** 3, 1e-6), kgt = df.isNext && df.kgOmitted ? 1 : Math.pow(df.Kg / (12 * L * ts3), 0.1);
    const kgTxt = df.isNext && df.kgOmitted ? '' : `\\left(\\frac{${g(df.Kg, 0)}}{12(${n(L, 2)})(${n(ts, 2)})^{3}}\\right)^{0.1}`;
    add({ id: 'm1', label: 'Interior moment DF, one lane loaded', sym: 'g_{M1}', eq: '0.06 + \\left(\\frac{S}{14}\\right)^{0.4}\\left(\\frac{S}{L}\\right)^{0.3}\\left(\\frac{K_{g}}{12\\,L\\,t_{s}^{3}}\\right)^{0.1}',
      sub: `0.06 + \\left(\\frac{${n(Sx, 3)}}{14}\\right)^{0.4}\\left(\\frac{${n(Sx, 3)}}{${n(L, 2)}}\\right)^{0.3}${kgTxt}`, value: df.m1, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2b-1', note: df.isNext && df.kgOmitted ? 'NEXT without a topping: the K_g term is taken as 1.0.' : '' }, 0.06 + Math.pow(Sx / 14, 0.4) * Math.pow(Sx / L, 0.3) * kgt);
    add({ id: 'm2', label: 'Interior moment DF, two or more lanes loaded', sym: 'g_{M2}', eq: '0.075 + \\left(\\frac{S}{9.5}\\right)^{0.6}\\left(\\frac{S}{L}\\right)^{0.2}\\left(\\frac{K_{g}}{12\\,L\\,t_{s}^{3}}\\right)^{0.1}',
      sub: `0.075 + \\left(\\frac{${n(Sx, 3)}}{9.5}\\right)^{0.6}\\left(\\frac{${n(Sx, 3)}}{${n(L, 2)}}\\right)^{0.2}${kgTxt}`, value: df.m2, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2b-1' }, 0.075 + Math.pow(Sx / 9.5, 0.6) * Math.pow(Sx / L, 0.2) * kgt);
    add({ id: 'v1', label: 'Interior shear DF, one lane loaded', sym: 'g_{V1}', eq: '0.36 + \\frac{S}{25}', sub: `0.36 + \\frac{${n(Sx, 3)}}{25}`, value: df.v1, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.3a-1' }, 0.36 + Sx / 25);
    add({ id: 'v2', label: 'Interior shear DF, two or more lanes loaded', sym: 'g_{V2}', eq: '0.2 + \\frac{S}{12} - \\left(\\frac{S}{35}\\right)^{2}', sub: `0.2 + \\frac{${n(Sx, 3)}}{12} - \\left(\\frac{${n(Sx, 3)}}{35}\\right)^{2}`, value: df.v2, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.3a-1' }, 0.2 + Sx / 12 - Math.pow(Sx / 35, 2));
    if (df.ext) {
      const de = +inp.loads.de || 0;
      add({ id: 'lever', label: 'Exterior girder, one lane: lever rule (m = 1.2)', sym: 'g_{lever}', eq: '1.2\\sum \\frac{0.5(S + x_{w})}{S}', sub: `1.2\\left(${[de - 2, de - 8].filter(x => x > -inp.S).map(x => `\\frac{0.5(${n(inp.S, 3)} + ${par(x, 2)})}{${n(inp.S, 3)}}`).join(' + ') || '0'}\\right)`, value: df.lever, unit: '', d: 4, ref: A10 + '4.6.2.2.2d',
        note: 'Wheels 2 ft and 8 ft inside the barrier face: x_w = d_e − 2 and d_e − 8 from the exterior girder.' }, 1.2 * [de - 2, de - 8].filter(x => x > -inp.S).reduce((s, x) => s + 0.5 * (inp.S + x) / inp.S, 0));
      add({ id: 'eM', label: 'Exterior correction factor, moment', sym: 'e_{M}', eq: '0.77 + \\frac{d_{e}}{9.1}', sub: `0.77 + \\frac{${n(de, 2)}}{9.1}`, value: df.eM, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2d-1' }, 0.77 + de / 9.1);
      add({ id: 'eV', label: 'Exterior correction factor, shear', sym: 'e_{V}', eq: '0.6 + \\frac{d_{e}}{10}', sub: `0.6 + \\frac{${n(de, 2)}}{10}`, value: df.eV, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.3b-1' }, 0.6 + de / 10);
      if (df.rigidX) {   // PS-19 (engine/rigid.js): the rigid section on the real girder lines (unequal bays)
        const q = df.rigidX, t = q.trials.find(z => z.NL === df.rigidNL) || q.trials[0], mp = [1.2, 1.0, 0.85, 0.65][t.NL - 1];
        add({ id: 'rigXbar', label: 'Rigid section: centroid of the girder lines from G1 (real positions)', sym: '\\bar{x}', eq: '\\frac{\\sum x_{i}}{N_{b}}', sub: `\\frac{${q.x.map(v => n(v, 2)).join(' + ')}}{${q.x.length}}`, value: q.xbar, unit: 'ft', d: 3, ref: A10 + 'C4.6.2.2.2d' }, q.x.reduce((a, v) => a + v, 0) / q.x.length);
        add({ id: 'rigXext', label: `Rigid section: G${q.g} from the centroid`, sym: 'X_{ext}', eq: '|x_{ext} - \\bar{x}|', sub: `|${n(q.x[q.g - 1], 2)} - ${n(q.xbar, 3)}|`, value: q.Xext, unit: 'ft', d: 3 }, Math.abs(q.x[q.g - 1] - q.xbar));
        add({ id: 'rigSx2', label: 'Rigid section: sum of the squared girder offsets', sym: '\\sum x^{2}', eq: '\\sum (x_{i} - \\bar{x})^{2}', sub: q.x.map(v => `(${n(v - q.xbar, 3)})^{2}`).join(' + '), value: q.sumX2, unit: 'ft^{2}', d: 2 }, q.x.reduce((a, v) => a + (v - q.xbar) * (v - q.xbar), 0));
        add({ id: 'rigid', label: `Exterior girder, rigid cross-section on the real girder lines (governing ${df.rigidNL} lane${df.rigidNL === 1 ? '' : 's'})`, sym: 'R', eq: 'm\\left(\\frac{N_{L}}{N_{b}} + \\frac{X_{ext}\\sum e}{\\sum x^{2}}\\right)',
          sub: `${n(mp, 2)}\\left(\\frac{${t.NL}}{${q.x.length}} + \\frac{${n(q.Xext, 3)}(${n(t.sumE, 3)})}{${n(q.sumX2, 2)}}\\right)`, value: df.rigid, unit: '', d: 4, ref: A10 + 'Eq. C4.6.2.2.2d-1',
          note: `Largest over 1 to N_L lanes (multiple presence 1.2, 1.0, 0.85, 0.65); e = X_ext + d_e − 5 − 12 j ft. Unequal bays: the girder lines from the bays (PS-19, an addition to the moved engine, which takes N_b girders at the spacing S = ${n(inp.S, 3)} ft: R = ${n(q.engine.rigid, 4)}).` }, mp * (t.NL / q.x.length + q.Xext * t.sumE / q.sumX2));
      } else add({ id: 'rigid', label: `Exterior girder, rigid cross-section (governing ${df.rigidNL} lane${df.rigidNL === 1 ? '' : 's'})`, sym: 'R', eq: 'm\\left(\\frac{N_{L}}{N_{b}} + \\frac{X_{ext}\\sum e}{\\sum x^{2}}\\right)', value: df.rigid, unit: '', d: 4, ref: A10 + 'Eq. C4.6.2.2.2d-1', note: 'Largest over 1 to N_L lanes (multiple presence 1.2, 1.0, 0.85, 0.65).' });
      add({ id: 'dfmRaw', label: 'Exterior moment DF before skew', sym: 'g_{M}', eq: '\\max(e_{M}\\,g_{M2},\\ g_{lever},\\ R)', sub: `\\max(${n(df.eM, 4)}(${n(df.m2, 4)}), ${n(df.lever, 4)}, ${n(df.rigid, 4)})`, value: df.dfmRaw, unit: '', d: 4 }, Math.max(df.eM * df.m2, df.lever, df.rigid));
      add({ id: 'dfvRaw', label: 'Exterior shear DF before skew', sym: 'g_{V}', eq: '\\max(e_{V}\\,g_{V2},\\ g_{lever},\\ R)', sub: `\\max(${n(df.eV, 4)}(${n(df.v2, 4)}), ${n(df.lever, 4)}, ${n(df.rigid, 4)})`, value: df.dfvRaw, unit: '', d: 4 }, Math.max(df.eV * df.v2, df.lever, df.rigid));
    } else {
      add({ id: 'dfmRaw', label: 'Interior moment DF before skew', sym: 'g_{M}', eq: '\\max(g_{M1}, g_{M2})', sub: `\\max(${n(df.m1, 4)}, ${n(df.m2, 4)})`, value: df.dfmRaw, unit: '', d: 4 }, Math.max(df.m1, df.m2));
      add({ id: 'dfvRaw', label: 'Interior shear DF before skew', sym: 'g_{V}', eq: '\\max(g_{V1}, g_{V2})', sub: `\\max(${n(df.v1, 4)}, ${n(df.v2, 4)})`, value: df.dfvRaw, unit: '', d: 4 }, Math.max(df.v1, df.v2));
    }
    const tanT = Math.tan(df.th * Math.PI / 180);
    const c1 = df.th < 30 ? 0 : (df.isNext && df.kgOmitted ? 0.25 : 0.25 * Math.pow(df.Kg / (12 * L * ts3), 0.25) * Math.pow(Sx / L, 0.5));
    if (df.th >= 30) add({ id: 'c1', label: 'Skew coefficient c₁', sym: 'c_{1}', eq: df.isNext && df.kgOmitted ? '0.25' : '0.25\\left(\\frac{K_{g}}{12\\,L\\,t_{s}^{3}}\\right)^{0.25}\\left(\\frac{S}{L}\\right)^{0.5}',
      sub: df.isNext && df.kgOmitted ? '' : `0.25\\left(\\frac{${g(df.Kg, 0)}}{12(${n(L, 2)})(${n(ts, 2)})^{3}}\\right)^{0.25}\\left(\\frac{${n(Sx, 3)}}{${n(L, 2)}}\\right)^{0.5}`, value: c1, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2e-1' });
    add({ id: 'skM', label: `Skew reduction, moment (θ = ${n(df.th, 1)}°)`, sym: 'r_{M}', eq: '1 - c_{1}(\\tan\\theta)^{1.5}', sub: `1 - ${n(c1, 4)}(${n(tanT, 4)})^{1.5}`, value: df.skM, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.2e-1', note: df.th < 30 ? 'θ < 30°: c_1 = 0, no reduction.' : '' }, 1 - c1 * Math.pow(tanT, 1.5));
    add({ id: 'skV', label: `Skew correction, shear (θ = ${n(df.th, 1)}°)`, sym: 'c_{V}', eq: '1 + 0.20\\left(\\frac{12\\,L\\,t_{s}^{3}}{K_{g}}\\right)^{0.3}\\tan\\theta', sub: df.isNext && df.kgOmitted ? '' : `1 + 0.20\\left(\\frac{12(${n(L, 2)})(${n(ts, 2)})^{3}}{${g(df.Kg, 0)}}\\right)^{0.3}(${n(tanT, 4)})`, value: df.skV, unit: '', d: 4, ref: A10 + 'Table 4.6.2.2.3c-1' },
      df.isNext && df.kgOmitted ? 1 + 0.2 * tanT : 1 + 0.2 * Math.pow(12 * L * ts3 / df.Kg, 0.3) * tanT);
    }
    add({ id: 'dfm', label: 'Moment distribution factor', sym: 'DF_{M}', eq: inp.loads.dfAuto ? 'r_{M}\\,g_{M}' : '', sub: inp.loads.dfAuto ? `${n(df.skM, 4)}(${n(df.dfmRaw, 4)})` : '', value: R.dfm, unit: 'lanes', d: 4, note: inp.loads.dfAuto ? '' : 'Entered on the Loads tab.' }, inp.loads.dfAuto ? df.skM * df.dfmRaw : +inp.loads.dfm);
    add({ id: 'dfv', label: 'Shear distribution factor', sym: 'DF_{V}', eq: inp.loads.dfAuto ? 'c_{V}\\,g_{V}' : '', sub: inp.loads.dfAuto ? `${n(df.skV, 4)}(${n(df.dfvRaw, 4)})` : '', value: R.dfv, unit: 'lanes', d: 4, note: inp.loads.dfAuto ? '' : 'Entered on the Loads tab.' }, inp.loads.dfAuto ? df.skV * df.dfvRaw : +inp.loads.dfv);
    const simple = !R.fe && !R.useExt;
    if (simple && inp.loads.llAuto) {
      add({ id: 'MLL', label: 'Live load moment per girder at midspan', sym: 'M_{LL+IM}', eq: 'DF_{M}\\,M_{LL+IM,lane}', sub: `${n(R.dfm, 4)}(${n(hl.M, 1)})`, value: R.MLL, unit: 'kip-ft', d: 1 }, R.dfm * hl.M);
      add({ id: 'VLL', label: 'Live load shear per girder at the support', sym: 'V_{LL+IM}', eq: 'DF_{V}\\,V_{LL+IM,lane}', sub: `${n(R.dfv, 4)}(${n(hl.V, 2)})`, value: R.VLL, unit: 'kip', d: 2 }, R.dfv * hl.V);
    } else if (simple) {
      add({ id: 'MLL', label: 'Live load moment per girder at midspan (entered)', sym: 'M_{LL+IM}', value: R.MLL, unit: 'kip-ft', d: 1, note: 'Entered on the Loads tab.' });
      add({ id: 'VLL', label: 'Live load shear per girder at the support (entered)', sym: 'V_{LL+IM}', value: R.VLL, unit: 'kip', d: 2, note: 'Entered on the Loads tab.' });
    } else {
      add({ id: 'MLL', label: 'Live load moment per girder at midspan (continuous unit)', sym: 'M_{LL+IM}', value: R.MLL, unit: 'kip-ft', d: 1, note: 'HL-93 on the continuous unit (influence lines of the FE model, Analysis tab) × DF_M.' });
      add({ id: 'VLL', label: 'Live load shear per girder at the support (continuous unit)', sym: 'V_{LL+IM}', value: R.VLL, unit: 'kip', d: 2, note: 'HL-93 on the continuous unit × DF_V (Analysis tab).' });
    }
    return K.done();
  }

  /* ---------- Analysis (computeAll diagrams, cont, restraint) ---------- */
  function analysis(inp, R) {
    const K = kit('an'), add = K.add, L = R.L, D = R.diagrams, mid = D.reduce((b, r) => Math.abs(r.x - L / 2) < Math.abs(b.x - L / 2) ? r : b, D[0]), s0 = D[0], x = mid.x, own = R.own || { eta: 1, mLL: 1 }, eta = own.eta === undefined ? 1 : own.eta, mLL = own.mLL === undefined ? 1 : own.mLL;
    const fe = R.fe, simple = !fe && !R.useExt;
    const Mw = (w) => w * x * (L - x) / 2;
    add({ id: 'Mg', label: `Girder self-weight moment at midspan (x = ${n(x, 2)} ft, simple span)`, sym: 'M_{g}', eq: '\\frac{w_{g}\\,x(L - x)}{2}', sub: `\\frac{${n(R.wG, 4)}(${n(x, 2)})(${n(L - x, 2)})}{2}`, value: mid.M_g, unit: 'kip-ft', d: 1 }, Mw(R.wG));
    const dia = (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= L);
    const Mdia = dia.reduce((s, d) => { const P = +d.P, a = +d.a, Rl = P * (L - a) / L; return s + (x <= a ? Rl * x : Rl * x - P * (x - a)); }, 0);
    add({ id: 'Mdc1', label: 'DC1 moment at midspan (simple span)', sym: 'M_{DC1}', eq: dia.length ? '\\frac{w_{DC1}\\,x(L - x)}{2} + M_{dia}' : '\\frac{w_{DC1}\\,x(L - x)}{2}', sub: `\\frac{${n(R.wDk, 4)}(${n(x, 2)})(${n(L - x, 2)})}{2}${dia.length ? ` + ${n(Mdia, 1)}` : ''}`, value: mid.M_DC1, unit: 'kip-ft', d: 1, note: dia.length ? 'M_dia: the diaphragm point loads on the simple span.' : '' }, Mw(R.wDk) + Mdia);
    if (simple) {
      add({ id: 'Mdc2', label: 'DC2 moment at midspan (simple span)', sym: 'M_{DC2}', eq: '\\frac{w_{DC2}\\,x(L - x)}{2}', sub: `\\frac{${n(R.wBar, 4)}(${n(x, 2)})(${n(L - x, 2)})}{2}`, value: mid.M_DC2, unit: 'kip-ft', d: 1 }, Mw(R.wBar));
      add({ id: 'Mdw', label: 'DW moment at midspan (simple span)', sym: 'M_{DW}', eq: '\\frac{w_{DW}\\,x(L - x)}{2}', sub: `\\frac{${n(R.wDW, 4)}(${n(x, 2)})(${n(L - x, 2)})}{2}`, value: mid.M_DW, unit: 'kip-ft', d: 1 }, Mw(R.wDW));
    } else if (fe) {
      const mw = fe.Mw(x);
      add({ id: 'Mw', label: 'Moment at midspan of the design span, unit uniform load on every span of the continuous unit', sym: 'M_{w}', value: mw, unit: 'kip-ft/klf', d: 3, ref: A10 + '5.12.3.3', note: 'Three-moment equation / FE model of the continuous unit (the old app\'s PBD.contFE).' });
      add({ id: 'Mdc2', label: 'DC2 moment at midspan (continuous)', sym: 'M_{DC2}', eq: 'w_{DC2}\\,M_{w}', sub: `${n(R.wBar, 4)}(${n(mw, 3)})`, value: mid.M_DC2, unit: 'kip-ft', d: 1 }, R.wBar * mw);
      add({ id: 'Mdw', label: 'DW moment at midspan (continuous)', sym: 'M_{DW}', eq: 'w_{DW}\\,M_{w}', sub: `${n(R.wDW, 4)}(${n(mw, 3)})`, value: mid.M_DW, unit: 'kip-ft', d: 1 }, R.wDW * mw);
    }
    add({ id: 'Mll', label: 'Live load moment (LL+IM) at midspan, positive envelope', sym: 'M_{LL+IM}', value: mid.M_LLpos, unit: 'kip-ft', d: 1,
      note: simple && inp.loads.llAuto ? 'HL-93 envelope at x: each axle placed at x, both truck orientations and the tandem, with IM = 33 % on the vehicles, plus the lane load, × DF_M (Loads & LLDF tab).' : simple ? 'Entered M_LL (parabola along the span).' : 'HL-93 on the continuous unit × DF_M.' });
    add({ id: 'Mdc', label: 'Total DC moment at midspan', sym: 'M_{DC}', eq: 'M_{g} + M_{DC1} + M_{DC2}', sub: `${n(mid.M_g, 1)} + ${n(mid.M_DC1, 1)} + ${n(mid.M_DC2, 1)}`, value: mid.M_DC, unit: 'kip-ft', d: 1 }, mid.M_g + mid.M_DC1 + mid.M_DC2);
    add({ id: 'MuS', label: 'Strength I moment at midspan', sym: 'M_{u}', eq: '\\eta(1.25\\,M_{DC} + 1.50\\,M_{DW} + 1.75\\,m\\,M_{LL+IM})', sub: `${n(eta, 4)}(1.25(${n(mid.M_DC, 1)}) + 1.50(${n(mid.M_DW, 1)}) + 1.75(${n(mLL, 2)})(${n(mid.M_LLpos, 1)}))`, value: mid.M_StrI_pos, unit: 'kip-ft', d: 1, ref: A10 + 'Table 3.4.1-1, 3.4.1-2' },
      eta * (1.25 * mid.M_DC + 1.5 * mid.M_DW + 1.75 * mLL * mid.M_LLpos));
    add({ id: 'MsI', label: 'Service I moment at midspan', sym: 'M_{s,I}', eq: 'M_{DC} + M_{DW} + m\\,M_{LL+IM}', sub: `${n(mid.M_DC, 1)} + ${n(mid.M_DW, 1)} + ${n(mLL, 2)}(${n(mid.M_LLpos, 1)})`, value: mid.M_SrvI_pos, unit: 'kip-ft', d: 1, ref: A10 + 'Table 3.4.1-1' }, mid.M_DC + mid.M_DW + mLL * mid.M_LLpos);
    const gl = +inp.opt.gLLs3;
    add({ id: 'MsIII', label: 'Service III moment at midspan', sym: 'M_{s,III}', eq: 'M_{DC} + M_{DW} + \\gamma_{LL}\\,m\\,M_{LL+IM}', sub: `${n(mid.M_DC, 1)} + ${n(mid.M_DW, 1)} + ${n(gl, 2)}(${n(mLL, 2)})(${n(mid.M_LLpos, 1)})`, value: mid.M_SrvIII_pos, unit: 'kip-ft', d: 1, ref: A10 + 'Table 3.4.1-1, 3.4.1-4' }, mid.M_DC + mid.M_DW + gl * mLL * mid.M_LLpos);
    // shear at the support
    const Vw = w => w * (L / 2 - s0.x);
    add({ id: 'Vg', label: 'Girder self-weight shear at the support', sym: 'V_{g}', eq: 'w_{g}\\left(\\frac{L}{2} - x\\right)', sub: `${n(R.wG, 4)}\\left(\\frac{${n(L, 2)}}{2} - ${n(s0.x, 2)}\\right)`, value: s0.V_g, unit: 'kip', d: 2 }, Vw(R.wG));
    add({ id: 'Vdc', label: 'Total DC shear at the support', sym: 'V_{DC}', eq: 'V_{g} + V_{DC1} + V_{DC2}', sub: `${n(s0.V_g, 2)} + ${n(s0.V_DC1, 2)} + ${n(s0.V_DC2, 2)}`, value: s0.V_DC, unit: 'kip', d: 2 }, s0.V_g + s0.V_DC1 + s0.V_DC2);
    add({ id: 'VuS', label: 'Strength I shear at the support', sym: 'V_{u}', eq: '\\eta(1.25\\,V_{DC} + 1.50\\,V_{DW} + 1.75\\,m\\,V_{LL+IM})', sub: `${n(eta, 4)}(1.25(${n(s0.V_DC, 2)}) + 1.50(${n(s0.V_DW, 2)}) + 1.75(${n(mLL, 2)})(${n(s0.V_LLpos, 2)}))`, value: s0.V_StrI_pos, unit: 'kip', d: 2, ref: A10 + 'Table 3.4.1-1' },
      eta * (1.25 * s0.V_DC + 1.5 * s0.V_DW + 1.75 * mLL * s0.V_LLpos));
    // continuity: the pier section and the restraint moments
    const c = R.cont;
    if (c) {
      add({ id: 'pier.MDC2', label: 'DC2 moment at the interior support', sym: 'M_{DC2,n}', value: c.MDC2n, unit: 'kip-ft', d: 1, note: c.extPier ? 'Imported demands.' : '−w_DC2 M_w at the pier (continuous unit).' });
      add({ id: 'pier.MDW', label: 'DW moment at the interior support', sym: 'M_{DW,n}', value: c.MDWn, unit: 'kip-ft', d: 1 });
      add({ id: 'pier.MLL', label: 'Live load moment at the interior support (negative)', sym: 'M_{LL,n}', value: c.MLLn, unit: 'kip-ft', d: 1, ref: A10 + '3.6.1.3.1', note: `Governing: ${c.llSrc}.` });
      const Mrn = c.MrnPier || 0;
      add({ id: 'pier.Mu', label: 'Strength I negative moment at the interior support', sym: 'M_{u,n}', eq: '\\eta(1.25\\,M_{DC2,n} + 1.50\\,M_{DW,n} + 1.75\\,m\\,M_{LL,n} + M_{r,n})', sub: `${n(eta, 4)}(1.25(${n(c.MDC2n, 1)}) + 1.50(${n(c.MDWn, 1)}) + 1.75(${n(mLL, 2)})(${n(c.MLLn, 1)}) + ${n(Mrn, 1)})`, value: c.MuN / 12, unit: 'kip-ft', d: 1,
        note: 'M_r,n: a negative restraint moment at the pier (γ = 1.0), 0 without restraint. Its resistance: Flexure tab (PR 2c).' }, eta * (1.25 * c.MDC2n + 1.5 * c.MDWn + 1.75 * mLL * c.MLLn + Mrn));
      const r = c.restr;
      if (r) {
        add({ id: 'restr.d1', label: 'Restraint factor δ₁ (girder creep)', sym: '\\delta_{1}', eq: '\\frac{E_{c}(\\psi_{b}(t_{f},t_{i}) - \\psi_{b}(t_{d},t_{i}))}{E_{ci}(1 + 0.7\\,\\psi_{b}(t_{f},t_{d}))}', sub: `\\frac{${n(r.EcG, 0)}(${n(r.psiBIF, 4)} - ${n(r.psiBID, 4)})}{${n(r.EciG, 0)}(1 + 0.7(${n(r.psiBDF, 4)}))}`, value: r.d1, unit: '', d: 4, ref: A10 + 'Eq. C5.12.3.3.2-1' }, r.EcG * r.dPsi / (r.EciG * (1 + 0.7 * r.psiBDF)));
        add({ id: 'restr.d2', label: 'Restraint factor δ₂ (deck weight)', sym: '\\delta_{2}', eq: '\\frac{E_{c}(\\psi_{b}(t_{f},t_{i}) - \\psi_{b}(t_{d},t_{i}))}{E_{ci}(1 + \\psi_{b}(t_{f},t_{d}))}', sub: `\\frac{${n(r.EcG, 0)}(${n(r.psiBIF, 4)} - ${n(r.psiBID, 4)})}{${n(r.EciG, 0)}(1 + ${n(r.psiBDF, 4)})}`, value: r.d2, unit: '', d: 4, ref: A10 + 'Eq. C5.12.3.3.2-2' }, r.EcG * r.dPsi / (r.EciG * (1 + r.psiBDF)));
        [['A', r.A, R.cont.unit.s > 1, 'left'], ['B', r.B, R.cont.unit.s < R.cont.unit.spans.length, 'right']].filter(q => q[2]).forEach(([k, e, , side]) => {
          add({ id: `restr.${k}.Mrc`, label: `Creep restraint moment, ${side} support of the span`, sym: `M_{rc,${k}}`, eq: '\\delta_{1}(M_{g} + M_{ps}) + \\delta_{2}\\,M_{deck}', sub: `${n(r.d1, 4)}(${par(e.Mg, 1)} + ${par(e.Mps, 1)}) + ${n(r.d2, 4)}(${par(e.Mdk, 1)})`, value: e.Mrc, unit: 'kip-ft', d: 1, ref: A10 + 'C5.12.3.3.2',
            note: 'M_g, M_ps, M_deck: the support moments of the girder weight, the prestress at transfer and the deck weight as if continuous (+ sagging).' }, r.d1 * (e.Mg + e.Mps) + r.d2 * e.Mdk);
          add({ id: `restr.${k}.Mres`, label: `Restraint moment, ${side} support of the span`, sym: `M_{res,${k}}`, eq: 'M_{rc} + M_{sh}', sub: `${par(e.Mrc, 1)} + ${par(e.Msh, 1)}`, value: e.Mres, unit: 'kip-ft', d: 1, ref: A10 + '5.12.3.3.2', note: 'M_sh: differential shrinkage (deck after continuity against the girder). Included in a combination only where it increases the effect (γ = 1.0).' }, e.Mrc + e.Msh);
        });
      }
    }
    return K.done();
  }
  window.PSBWorked = { section, loads, analysis, kit, n, g, par };   // kit, n, g, par: for the worked steps of the PR 2c tabs (engine/worked-stress.js, worked-strength.js)
})();
