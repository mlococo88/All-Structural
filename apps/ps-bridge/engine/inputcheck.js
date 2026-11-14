/* apps/ps-bridge/engine/inputcheck.js — every blocking input error of the project in one list (window.PSBInputCheck). Classic script, no DOM.
   Created 2026-11-12 (PR 2b), the Steel Bridge app's pattern (apps/steel-bridge/engine/inputcheck.js, SBINV; engineer's decision 2026-11-09:
   "Invalid input should be highlighted so the user can fix; results should not be displayed"): the page asks collect(P) after every input
   change; while errors[] is not empty no output tab shows results.

   collect(P) -> { errors: [E], warnings: [E] }   E = { path, msg, src, cell? }
     path: the project field (e.g. base.mat.fc, base.rows.2.y); the page finds the input tab (PSBFields.tabOf) and the field from it.
     src:  'model' (engine/model.js validate), 'design' (engine/design.js checks: the design girder and the PR 2b limits), 'field' (the rule
           of a field of engine/fields.js), 'table' (a row of a table input), 'geometry' (a value against the girder depth or the span).
   Only inputs are read; nothing is computed for a result and no project field is written. The rules are those a calculation needs to be
   meaningful (a number, its sign, a whole count, a location inside the girder or the span); a design limit of the specification is a
   check of the engine, not an input error. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const F = () => window.PSBFields;
  const RULE = {
    pos: [v => v > 0, 'must be a positive number'], nn: [v => v >= 0, 'must be zero or a positive number'], any: [() => true, 'must be a number'],
    i0: [v => Number.isInteger(v) && v >= 0, 'must be a whole number, 0 or more'], i1: [v => Number.isInteger(v) && v >= 1, 'must be a whole number, 1 or more']
  };
  /* ruleMsg(v, f): '' when v meets the field's rule, else the message (without the label) */
  function ruleMsg(v, f) {
    if (v === '' || v == null || (typeof v === 'number' && isNaN(v))) return 'is blank: enter a value';
    if (!isNum(v)) return 'must be a number';
    const r = RULE[f.v || 'pos'] || RULE.pos;
    if (!r[0](v)) return r[1];
    if (f.min != null && v < f.min) return `must be ${f.min} or more`;
    if (f.max != null && v > f.max) return `must be ${f.max} or less`;
    if (f.minX != null && !(v > f.minX)) return `must be greater than ${f.minX}`;
    if (f.maxX != null && !(v < f.maxX)) return `must be less than ${f.maxX}`;
    return '';
  }
  /* depthOf(b): the girder depth h (in) of the base design's shape, or NaN (Custom: the entered h) */
  function depthOf(b) {
    if (!b) return NaN;
    if (b.girder === 'Custom') return +(b.cust || {}).h;
    const G = typeof GIRDERS !== 'undefined' ? GIRDERS[b.girder] : null; return G ? +G.h : NaN;
  }
  function collect(P) {
    const errors = [], warnings = [], E = (path, msg, src, cell) => errors.push(cell != null ? { path, msg, src, cell } : { path, msg, src });
    const M = window.PSBModel, v = M.validate(P);
    v.errors.forEach(e => E(e.path, e.msg, 'model')); v.warnings.forEach(w => warnings.push({ path: w.path, msg: w.msg, src: 'model' }));
    if (!P || !P.base || typeof P.base !== 'object') return { errors, warnings };
    if (window.PSBDesign && P.xs && P.spans) window.PSBDesign.checks(P).errors.forEach(e => E(e.path, e.msg, 'design'));
    const BR = window.PSBBridge;   // PR 3a-1: the girder types (engine/bridge.js): two types on one line, different shapes in a span (blocking)
    if (BR && P.xs && P.spans) { const c = BR.checks(P); c.errors.forEach(e => E(e.path, e.msg, 'types')); c.warnings.forEach(w => warnings.push({ path: w.path, msg: w.msg, src: 'types' })); }
    if (window.PSBBridgeDL && P.xs) window.PSBBridgeDL.checks(P).forEach(e => E(e.path, e.msg, 'dl'));   // PR 3a-3: the DC2 / DW distribution inputs
    const Ls = s => P.spans && Array.isArray(P.spans.lengths) ? P.spans.lengths[s - 1] : NaN;
    const lS = g => (window.PSBDesign && P.xs ? window.PSBDesign.lineS(P, g) : NaN);   // PS-28: the girder spacing of a line (a NEXT flange width)
    inputsOf(P, P.base, Ls(window.PSBDesign ? window.PSBDesign.sel(P).s : 1), E, lS(window.PSBDesign ? window.PSBDesign.sel(P).g : 1));
    /* PR 3a-1: each girder type's own inputs (the base with its overrides, on its span's length) checked by the same rules; an error the base
       does not already have is the type's: its message names the type, scope = the type's id (the page shows the field in that type's
       scope). */
    if (BR && BR.hasTypes(P)) {
      const seen = new Set(errors.map(e => e.path + '|' + e.msg));
      P.types.forEach((T, k) => {
        const tl = BR.typeLines(P, k); if (!tl.length) return;
        const Pv = Object.assign({}, P, { base: BR.effBase(P, k) });
        inputsOf(Pv, Pv.base, Ls(T.span), (path, msg, src, cell) => { if (seen.has(path + '|' + msg)) return;
          const e = { path, msg: `Girder type ${T.label}: ${msg}`, src, scope: T.id }; if (cell != null) e.cell = cell; errors.push(e); seen.add(path + '|' + msg); }, lS(tl[0]));
      });
    }
    return { errors, warnings };
  }
  /* inputsOf(P, b, L, E, S): the field, table and location rules on the inputs object b (P.base, or a girder type's effective inputs), with the
     span length L of the design (PR 2b; moved into a function in PR 3a-1, the rules unchanged); S: the girder spacing of a line of these
     inputs (ft; the NEXT flange width of the strand fit, PS-28) */
  function inputsOf(P, b, L, E, S) {
    const get = F().get, plain = F().plain;
    // the fields of the input cards (engine/fields.js), where shown
    F().CARDS.forEach(c => {
      if (c.when && !c.when(b, P)) return;
      c.fields.forEach(f => {
        if (f.when && !f.when(b, P)) return;
        const x = get(P, f.p), lab = plain(f.l);
        if (f.k === 'bool') { if (x !== undefined && typeof x !== 'boolean')   // undefined: a switch the old DEFAULTS lack (cont.topRC), read as off by the engine (!!)
          E(f.p, `${lab}: choose one of the options.`, 'field'); return; }
        if (f.k === 'sel') { const o = typeof f.o === 'function' ? f.o() : f.o;
          // PS-31: an old library section with no corrected standard (Deck slab 27×48 (voided)) is named in the message (engine/sections.js)
          const rm = f.p === 'base.girder' && window.PSBSections ? window.PSBSections.retiredMsg(x) : '';
          if (!o.some(q => String(q[0]) === String(x))) E(f.p, rm || `${lab}: choose one of the options.`, 'field'); return; }
        if (f.k === 'opt' && (x === '' || x == null)) return;
        const m = ruleMsg(x, f); if (m) E(f.p, `${lab} ${m}.`, 'field');
      });
    });
    // the table inputs
    const T = F().TABLES;
    Object.keys(T).forEach(tp => {
      const rows = get(P, tp); if (!Array.isArray(rows)) { if (tp !== 'base.loads.diaph' && tp !== 'base.rateVeh') E(tp, `${T[tp].title}: missing.`, 'table'); return; }
      rows.forEach((r, i) => T[tp].cols.forEach(([k, lab, , rule]) => {
        if (rule === 'text') return;
        const m = ruleMsg(r ? r[k] : undefined, { v: rule }); if (m) E(`${tp}.${i}.${k}`, `${T[tp].title}, row ${i + 1}: ${lab} ${m}.`, 'table', i);
      }));
    });
    // locations inside the girder and the span
    const h = depthOf(b);
    if (isNum(h) && h > 0) {
      (Array.isArray(b.rows) ? b.rows : []).forEach((r, i) => {
        if (isNum(r.y) && r.y >= h) E(`base.rows.${i}.y`, `Straight strand rows, row ${i + 1}: y = ${r.y} in is not inside the girder (h = ${h} in).`, 'geometry', i);
        if (isNum(r.nd) && isNum(r.n) && r.nd > r.n) E(`base.rows.${i}.nd`, `Straight strand rows, row ${i + 1}: ${r.nd} debonded strands is more than the ${r.n} strands of the row.`, 'geometry', i);
        if (isNum(L) && isNum(r.dbnd) && r.nd > 0 && r.dbnd >= L / 2) E(`base.rows.${i}.dbnd`, `Straight strand rows, row ${i + 1}: the debond length ${r.dbnd} ft reaches midspan (L/2 = ${L / 2} ft).`, 'geometry', i);
      });
      if (+b.harp.n > 0) ['yEnd', 'yMid'].forEach(k => { const y = b.harp[k]; if (isNum(y) && y >= h) E(`base.harp.${k}`, `Draped strand centroid y_${k === 'yEnd' ? 'end' : 'mid'} = ${y} in is not inside the girder (h = ${h} in).`, 'geometry'); });
      if (b.ovr && b.ovr.on && isNum(+b.ovr.yb) && b.ovr.yb !== '' && +b.ovr.yb >= h) E('base.ovr.yb', `y_b (override) = ${b.ovr.yb} in is not inside the girder (h = ${h} in).`, 'geometry');
    }
    fitOf(b, L, S, E);   // PS-28: every strand of the pattern inside the concrete of the shape
    if (b.girder === 'Custom' && b.cust && isNum(b.cust.yb) && isNum(b.cust.h) && b.cust.yb >= b.cust.h) E('base.cust.yb', `Custom section: y_b = ${b.cust.yb} in must be less than h = ${b.cust.h} in.`, 'geometry');
    if (isNum(L) && Array.isArray(b.loads && b.loads.diaph)) b.loads.diaph.forEach((d, i) => { if (isNum(d.a) && d.a > L) E(`base.loads.diaph.${i}.a`, `Diaphragms, row ${i + 1}: a = ${d.a} ft is beyond the span (L = ${L} ft).`, 'geometry', i); });
    const m = b.mat || {};
    if (isNum(m.ti) && isNum(m.td) && m.td <= m.ti) E('base.mat.td', `Age at deck placement t_d (${m.td} days) must be later than the age at release t_i (${m.ti} days).`, 'geometry');
    if (isNum(m.td) && isNum(m.tfin) && m.tfin <= m.td) E('base.mat.tfin', `Final age t_f (${m.tfin} days) must be later than the age at deck placement t_d (${m.td} days).`, 'geometry');
  }
  /* PS-28 (engineer decision 2026-11-14): a strand pattern that does not fit the girder shape is a blocking input error naming its row.
     The positions are the drawn ones: PSBStrandGfx.xy (ui/strands.js, the single source of the drawn strand positions: the old app's
     strandXY, PS-27) of the engine's own girder (girderGross, NEXT flange width from S) and strand system (strandSys) of these inputs.
     A strand fits when its centre is
       (1) inside the concrete outline (halfPolygon mirrored about the girder ℄),
       (2) not inside a void (sectionVoids),
       (3) at least COVER = 2 in from every edge of the outline, and
       (4) at least VOID = 1.25 in from the edge of every void (PS-39, engineer decision 2026-11-14: 1.25 in everywhere; the MassDOT deep
           adjacent box beams' inner draped column is 1.25 in from the void face, Part II dwg 10.2.8, p. 227: 6 in web, columns 2¾ and 4¾ in
           from the outer face. Before: 1.5 in, PS-33 (the CTDOT standard box pattern's 4 in row in the 5½ in bottom slab, plates 5.2.2 /
           5.2.3); 2 in until PS-33; the void faces are interior formed faces),
     each distance measured from the strand CENTRE (not from its surface; no half strand diameter taken off): the engine's "2″ grid with
     2″ edge cover" of its row-capacity warning (pbd-compute.js: floor((b − 4)/2) + 1 strands across a width b) and the criterion of
     tests/engine/psbridge-strandgfx.test.mjs (PS-27, fitsAt). Equal to 2 in fits (1e-9 in tolerance).
     Checked: each straight row at its y (an error per row: the field y when a single strand of the row (NEXT: one in each stem) does not
     fit at that y, else the count n); the draped strands about y_end (at ℄ bearing) and about y_mid (midspan; the hold-down points), the
     two sections the graphic draws (an error each: y_end, y_mid). Only where the other rules of the row pass (a whole count, y a number
     inside the depth): those have their own messages. Not checked: a Custom shape (its outline is drawn with the library's default flange
     thicknesses, not entered: PS28-D1, pending engineer review). Only inputs are read: nothing is written, so a pattern that does not fit
     (an imported old-app design too) is kept as entered and shows this error until it is fixed. */
  const COVER = 2, VOID = 1.25;   // PS-28: exterior faces 2 in; PS-39 (was 1.5 in, PS-33): void faces 1.25 in (strand centre)
  const fx = v => { const s = (Math.round(v * 100) / 100).toFixed(2).replace(/\.?0+$/, ''); return s === '-0' ? '0' : s; };
  function insidePoly(poly, x, y) { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) c = !c; } return c; }
  function edgeDist(poly, x, y) { let d = Infinity; for (let i = 0; i < poly.length; i++) { const a = poly[i], q = poly[(i + 1) % poly.length], dx = q[0] - a[0], dy = q[1] - a[1], L2 = dx * dx + dy * dy;
    const t = L2 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / L2)) : 0; d = Math.min(d, Math.hypot(x - a[0] - t * dx, y - a[1] - t * dy)); } return d; }
  /* misfit(g, poly, q): '' when the strand centre q fits (1)-(4), else why it does not */
  function misfit(g, poly, q) {
    if (!insidePoly(poly, q.x, q.y)) return 'is outside the concrete outline';
    const vs = sectionVoids(g);
    if (vs.some(v => v.type === 'rect' ? Math.abs(q.x - v.x) < v.w / 2 && Math.abs(q.y - v.y) < v.h / 2 : Math.hypot(q.x - v.x, q.y - v.y) < v.d / 2)) return 'is inside a void';
    const de = edgeDist(poly, q.x, q.y); if (de < COVER - 1e-9) return `is ${fx(de)} in from the edge of the concrete (less than ${COVER} in)`;
    const dv = vs.reduce((m, v) => Math.min(m, v.type === 'rect' ? Math.hypot(Math.max(Math.abs(q.x - v.x) - v.w / 2, 0), Math.max(Math.abs(q.y - v.y) - v.h / 2, 0)) : Math.hypot(q.x - v.x, q.y - v.y) - v.d / 2), Infinity);
    if (dv < VOID - 1e-9) return `is ${fx(dv)} in from a void (less than ${VOID} in)`;
    return '';
  }
  /* fitOf(b, L, S, E): the PS-28 errors of the inputs b (span L ft, line spacing S ft) */
  function fitOf(b, L, S, E) {
    const SG = window.PSBStrandGfx;
    if (!SG || typeof GIRDERS === 'undefined' || typeof STRANDS === 'undefined' || typeof girderGross !== 'function' || typeof strandSys !== 'function') return;
    const raw = b && b.girder !== 'Custom' ? GIRDERS[b.girder] : null; if (!raw || raw.custom) return;
    if (raw.next && !(isNum(S) && S > 0)) return;
    if (!b.str || !STRANDS[b.str.size] || !b.mat) return;
    const h = +raw.h, base = Object.assign({}, b, { S, L: isNum(L) && L > 0 ? L : 100 });
    let g, poly; try { g = girderGross(base); const hp = halfPolygon(g); poly = hp.concat(hp.slice().reverse().map(p => [-p[0], p[1]])); } catch (e) { return; }
    const pos = (rows, harp, cg) => { const inp = Object.assign({}, base, { rows, harp }); return SG.xy({ g, ss: strandSys(inp, g) }, cg); };
    const bad = pts => { for (const q of pts) { const w = misfit(g, poly, q); if (w) return { q, w }; } return null; };
    const at = q => (q.h ? `(x, y) = (${fx(q.x)}, ${fx(q.y)}) in` : `x = ${fx(q.x)} in`);
    const RULE = `each strand centre must be inside the concrete, outside the voids, at least ${COVER} in from the edges of the concrete and at least ${VOID} in from the edges of the voids (the positions the strand pattern draws)`;
    const noHarp = { n: 0, yEnd: 0, yMid: 0, frac: 0.4 };
    (Array.isArray(b.rows) ? b.rows : []).forEach((r, i) => {
      if (!r || !(Number.isInteger(r.n) && r.n > 0 && isNum(r.y) && r.y > 0 && r.y < h)) return;
      try {
        const f = bad(pos([{ n: r.n, y: r.y, dbnd: 0, nd: 0 }], noHarp, 0)); if (!f) return;
        const one = bad(pos([{ n: Math.min(r.n, raw.next ? 2 : 1), y: r.y, dbnd: 0, nd: 0 }], noHarp, 0));
        E(`base.rows.${i}.${one ? 'y' : 'n'}`, `Straight strand rows, row ${i + 1}: ${r.n} strand${r.n === 1 ? '' : 's'} at y = ${fx(r.y)} in do not fit the ${b.girder}: the strand at ${at(f.q)} ${f.w}; ${RULE}.`, 'geometry', i);
      } catch (e) { /* the engine could not place them: other rules report the inputs */ }
    });
    const hp = b.harp || {}, n = hp.n;
    if (Number.isInteger(n) && n > 0) ['yEnd', 'yMid'].forEach(k => {
      const y = hp[k]; if (!(isNum(hp.yEnd) && isNum(hp.yMid) && isNum(y) && y > 0 && y < h)) return;
      try {
        const f = bad(pos([], { n, yEnd: hp.yEnd, yMid: hp.yMid, frac: isNum(+hp.frac) && +hp.frac > 0 ? +hp.frac : 0.4 }, y).filter(q => q.h)); if (!f) return;
        E(`base.harp.${k}`, `Draped strands: the ${n} draped strands about y_${k === 'yEnd' ? 'end' : 'mid'} = ${fx(y)} in (${k === 'yEnd' ? 'at ℄ bearing' : 'at midspan'}) do not fit the ${b.girder}: the strand at ${at(f.q)} ${f.w}; ${RULE}.`, 'geometry');
      } catch (e) { /* as above */ }
    });
  }
  window.PSBInputCheck = { collect, ruleMsg, depthOf, COVER, VOID, misfit };
})();
