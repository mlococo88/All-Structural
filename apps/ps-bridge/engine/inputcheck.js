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
    const Ls = s => P.spans && Array.isArray(P.spans.lengths) ? P.spans.lengths[s - 1] : NaN;
    inputsOf(P, P.base, Ls(window.PSBDesign ? window.PSBDesign.sel(P).s : 1), E);
    /* PR 3a-1: each girder type's own inputs (the base with its overrides, on its span's length) checked by the same rules; an error the base
       does not already have is the type's: its message names the type, scope = the type's id (the page shows the field in that type's
       scope). */
    if (BR && BR.hasTypes(P)) {
      const seen = new Set(errors.map(e => e.path + '|' + e.msg));
      P.types.forEach((T, k) => {
        if (!BR.typeLines(P, k).length) return;
        const Pv = Object.assign({}, P, { base: BR.effBase(P, k) });
        inputsOf(Pv, Pv.base, Ls(T.span), (path, msg, src, cell) => { if (seen.has(path + '|' + msg)) return;
          const e = { path, msg: `Girder type ${T.label}: ${msg}`, src, scope: T.id }; if (cell != null) e.cell = cell; errors.push(e); seen.add(path + '|' + msg); });
      });
    }
    return { errors, warnings };
  }
  /* inputsOf(P, b, L, E): the field, table and location rules on the inputs object b (P.base, or a girder type's effective inputs), with the
     span length L of the design (PR 2b; moved into a function in PR 3a-1, the rules unchanged) */
  function inputsOf(P, b, L, E) {
    const get = F().get, plain = F().plain;
    // the fields of the input cards (engine/fields.js), where shown
    F().CARDS.forEach(c => {
      if (c.when && !c.when(b, P)) return;
      c.fields.forEach(f => {
        if (f.when && !f.when(b, P)) return;
        const x = get(P, f.p), lab = plain(f.l);
        if (f.k === 'bool') { if (x !== undefined && typeof x !== 'boolean')   // undefined: a switch the old DEFAULTS lack (cont.topRC), read as off by the engine (!!)
          E(f.p, `${lab}: choose one of the options.`, 'field'); return; }
        if (f.k === 'sel') { const o = typeof f.o === 'function' ? f.o() : f.o; if (!o.some(q => String(q[0]) === String(x))) E(f.p, `${lab}: choose one of the options.`, 'field'); return; }
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
    if (b.girder === 'Custom' && b.cust && isNum(b.cust.yb) && isNum(b.cust.h) && b.cust.yb >= b.cust.h) E('base.cust.yb', `Custom section: y_b = ${b.cust.yb} in must be less than h = ${b.cust.h} in.`, 'geometry');
    if (isNum(L) && Array.isArray(b.loads && b.loads.diaph)) b.loads.diaph.forEach((d, i) => { if (isNum(d.a) && d.a > L) E(`base.loads.diaph.${i}.a`, `Diaphragms, row ${i + 1}: a = ${d.a} ft is beyond the span (L = ${L} ft).`, 'geometry', i); });
    const m = b.mat || {};
    if (isNum(m.ti) && isNum(m.td) && m.td <= m.ti) E('base.mat.td', `Age at deck placement t_d (${m.td} days) must be later than the age at release t_i (${m.ti} days).`, 'geometry');
    if (isNum(m.td) && isNum(m.tfin) && m.tfin <= m.td) E('base.mat.tfin', `Final age t_f (${m.tfin} days) must be later than the age at deck placement t_d (${m.td} days).`, 'geometry');
  }
  window.PSBInputCheck = { collect, ruleMsg, depthOf };
})();
