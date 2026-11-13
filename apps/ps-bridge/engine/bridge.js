/* apps/ps-bridge/engine/bridge.js — the bridge level: girder types on the girder lines of each span (window.PSBBridge). Classic script, no DOM.
   Created 2026-11-13 (docs/ps-bridge-plan.md §5 PR 3a; engineer decisions PS-8, PS-15, PS-17), modelled on the Steel Bridge app's girder types
   (apps/steel-bridge/engine/model.js typeLines / lineTypes / setLines / addType / deleteType / renumberLines, SB-2, SB-14, SB-15; written
   for this app, not a copy: here a type belongs to one span and holds a sparse override of the base design instead of plates).

   A GIRDER TYPE is one prestressed girder design of one span (PS-8: interior and exterior design per span, the same shape for every girder
   of a span, an optional per-girder override = a type on one line), stored in the project (engine/model.js, optional field of schema v1):
     P.types = [{ id: 'T<n>', label, span (1-based), lines: [g, …] (1-based girder lines of xs.nb), ovr: { '<engine path>': value, … } }]
   ovr: the inputs of this type that differ from the base design P.base (engine paths without "base.", e.g. 'rows', 'harp.n', 'mat.fc';
   a table is one path). The type's inputs are base ⊕ ovr (effBase); the bridge then sets the line's values (engine/design.js inputs: span L,
   S, nGirders, position, overhang, skew, continuity). Each type is checked on every line assigned to it; the worst line governs (PR 3a-2).
   The shape (girder, cust.*, ovr.* of the base) is the same for every type of a span (PS-8): an edit for one type is written to every type
   of its span (sameShape) and a difference is an input error (checks).

   A project saved before the bridge level (no types) is migrated on load (migrate): its one design girder P.design = { g, s } becomes type
   T1 on that line with no override, so its results are byte-identical (tests/engine/psbridge-types.test.mjs); the other lines have no type
   until the user assigns them (never silently, as the steel app's SB-2), listed with "Assign" buttons. Malformed stored types are kept as
   P.typesBad (never discarded) and the project migrated as without types.
   Nothing here computes an engineering value. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const clone = o => o === undefined ? undefined : JSON.parse(JSON.stringify(o));
  const nbOf = P => { const n = P && P.xs ? P.xs.nb : 0; return Number.isInteger(n) && n > 0 && n < 100 ? n : 0; };
  const nsOf = P => ((P && P.spans && P.spans.lengths) || []).length;
  const isExt = (P, g) => g === 1 || g === nbOf(P);
  /* the girder shape keys of the base design (the same for every type of a span, PS-8) */
  const SHAPE = ['girder', 'cust', 'ovr'];
  const isShapeKey = k => SHAPE.some(s => k === s || k.indexOf(s + '.') === 0);
  const getK = (o, k) => k.split('.').reduce((q, p) => q == null ? q : q[p], o);
  const setK = (o, k, v) => { const ks = k.split('.'), last = ks.pop(), q = ks.reduce((a, p) => (a[p] == null || typeof a[p] !== 'object' ? (a[p] = {}) : a[p]), o); q[last] = v; };

  /* validType(t): a stored type entry is readable */
  const validType = t => !!(t && typeof t === 'object' && typeof t.id === 'string' && t.id && Number.isInteger(t.span) && t.span >= 1
    && Array.isArray(t.lines) && t.lines.every(g => Number.isInteger(g) && g >= 1) && t.ovr && typeof t.ovr === 'object' && !Array.isArray(t.ovr));
  const validTypes = a => Array.isArray(a) && a.length > 0 && a.every(validType) && new Set(a.map(t => t.id)).size === a.length;
  /* sel(P): the stored design girder (engine/design.js rule): P.design, absent G2 (G1 with one girder) in span 1 */
  function sel(P) { const nb = nbOf(P), d = (P && P.design) || {}; return { g: Number.isInteger(d.g) ? d.g : Math.min(2, Math.max(1, nb)), s: Number.isInteger(d.s) ? d.s : 1 }; }
  const posLabel = (P, g) => isExt(P, g) ? 'Exterior' : 'Interior';
  /* types(P): the girder types: P.types when stored and readable, else the one design of a project saved before the bridge level (the type
     migrate() writes; the same object each call is not promised). */
  function types(P) {
    if (validTypes(P && P.types)) return P.types;
    const d = sel(P); return [{ id: 'T1', label: `${posLabel(P, d.g)} S${d.s}`, span: d.s, lines: [d.g], ovr: {} }];
  }
  const hasTypes = P => validTypes(P && P.types);
  /* typeLines(P, k): the lines of type k, ascending, those of xs.nb only (a stored line beyond N_b is kept in the file, not checked); [] for
     a type of a span beyond the span count (kept, not checked) */
  function typeLines(P, k) {
    const T = types(P)[k], nb = nbOf(P); if (!T || !nb || T.span > nsOf(P)) return [];
    return [...new Set(T.lines.filter(g => Number.isInteger(g) && g >= 1 && g <= nb))].sort((a, b) => a - b);
  }
  /* lineTypes(P, s): for each line g = 1 … N_b of span s the types on it (index 0 unused; [] = none; two or more: an input error) */
  function lineTypes(P, s) {
    const nb = nbOf(P), out = Array.from({ length: nb + 1 }, () => []);
    types(P).forEach((T, k) => { if (T.span === s) typeLines(P, k).forEach(g => out[g].push(k)); });
    return out;
  }
  const typeAt = (P, s, g) => { const L = lineTypes(P, s); return L[g] && L[g].length ? L[g][0] : -1; };
  const spanTypes = (P, s) => types(P).map((T, k) => T.span === s ? k : -1).filter(k => k >= 0);
  /* unassigned(P): [{ s, g }] lines with no type, every span */
  function unassigned(P) {
    const out = [];
    for (let s = 1; s <= nsOf(P); s++) lineTypes(P, s).forEach((t, g) => { if (g >= 1 && !t.length) out.push({ s, g }); });
    return out;
  }
  /* cells(P): every checked type × line: [{ k, id, label, s, g }] (span, then type order, then line) */
  function cells(P) {
    const out = [], T = types(P);
    for (let s = 1; s <= nsOf(P); s++) T.forEach((t, k) => { if (t.span === s) typeLines(P, k).forEach(g => out.push({ k, id: t.id, label: t.label, s, g })); });
    return out;
  }
  /* shown(P): the cell the output tabs show: the stored design girder P.design when a type is on it, else the first cell (null: none) */
  function shown(P) {
    const d = sel(P), k = typeAt(P, d.s, d.g);
    if (k >= 0) return { k, s: d.s, g: d.g };
    const c = cells(P)[0]; return c ? { k: c.k, s: c.s, g: c.g } : null;
  }
  /* effBase(P, k): the inputs of type k before the bridge values: a copy of P.base with the type's overrides */
  function effBase(P, k) {
    const b = clone(P.base), T = types(P)[k]; if (!T || !b) return b;
    Object.keys(T.ovr || {}).forEach(key => setK(b, key, clone(T.ovr[key])));
    return b;
  }
  /* diffOvr(base, eff, keep): the overrides that make eff from base: every leaf (or array, as one value) of eff that differs from base.
     keep: the type's overrides before (an override equal to base is dropped: the field follows the base again). */
  function diffOvr(base, eff) {
    const out = {};
    (function walk(a, b, pre) {
      Object.keys(b || {}).forEach(key => {
        const p = pre ? pre + '.' + key : key, x = a == null ? undefined : a[key], y = b[key];
        if (y && typeof y === 'object' && !Array.isArray(y) && x && typeof x === 'object' && !Array.isArray(x)) walk(x, y, p);
        else if (JSON.stringify(x) !== JSON.stringify(y)) out[p] = clone(y);
      });
    })(base, eff, '');
    return out;
  }
  /* setOvr(P, k, eff): type k takes the overrides of eff (its edited inputs) against the base; its shape overrides are written to every
     type of its span (PS-8). Returns the type. */
  function setOvr(P, k, eff) {
    const T = P.types[k], o = diffOvr(P.base, eff); T.ovr = o;
    sameShape(P, k);
    return T;
  }
  /* sameShape(P, k): every type of type k's span takes k's shape overrides (or none) */
  function sameShape(P, k) {
    const T = P.types[k];
    P.types.forEach((q, j) => { if (j === k || q.span !== T.span) return;
      Object.keys(q.ovr).filter(isShapeKey).forEach(key => { delete q.ovr[key]; });
      Object.keys(T.ovr).filter(isShapeKey).forEach(key => { q.ovr[key] = clone(T.ovr[key]); }); });
  }
  /* resetKey(P, k, key): type k follows the base for key (and every key below it); a shape key for every type of the span */
  function resetKey(P, k, key) {
    const T = P.types[k], hit = q => q === key || q.indexOf(key + '.') === 0;
    Object.keys(T.ovr).filter(hit).forEach(q => { delete T.ovr[q]; });
    if (isShapeKey(key)) sameShape(P, k);
  }
  /* ovrKeyOf(path): the override key a field or table cell path (base.…) is stored under: a table (rows, loads.diaph, rateVeh) is one key */
  function ovrKeyOf(path) {
    const p = String(path || '').replace(/^base\./, '');
    const t = ['rows', 'loads.diaph', 'rateVeh'].find(x => p === x || p.indexOf(x + '.') === 0);
    return t || p;
  }

  /* ---------- assignments (a user action; P.types written) ---------- */
  const nextId = P => { const ids = new Set((P.types || []).map(t => t.id)); let n = (P.types || []).length + 1; while (ids.has('T' + n)) n++; return 'T' + n; };
  /* setLines(P, k, lines): type k takes exactly these lines of its span; each is removed from any other type of that span */
  function setLines(P, k, lines) {
    const T = P.types[k], nb = nbOf(P), want = [...new Set(lines.filter(g => Number.isInteger(g) && g >= 1 && g <= nb))].sort((a, b) => a - b);
    P.types.forEach((q, j) => { if (j !== k && q.span === T.span && q.lines.some(g => want.includes(g))) q.lines = q.lines.filter(g => !want.includes(g)); });
    T.lines = want.concat(T.lines.filter(g => g > nb)).sort((a, b) => a - b);
  }
  const assignLine = (P, k, g) => setLines(P, k, [...typeLines(P, k), g]);
  /* addType(P, src, o): a new type of type src's span, a copy of its overrides (its design); o = { label, lines, span }. Returns its index. */
  function addType(P, src, o) {
    o = o || {}; const S = P.types[src];
    const T = { id: nextId(P), label: o.label || `Type ${P.types.length + 1}`, span: o.span || S.span, lines: [], ovr: clone(S.ovr) };
    const k = P.types.push(T) - 1; if (o.lines && o.lines.length) setLines(P, k, o.lines);
    return k;
  }
  /* deleteType(P, k, to): removes type k; its lines go to type to (same span). false when k is the only type of its span. */
  function deleteType(P, k, to) {
    const T = P.types[k], U = P.types[to]; if (!T || !U || to === k || U.span !== T.span) return false;
    const L = typeLines(P, k); if (L.length) setLines(P, to, [...typeLines(P, to), ...L]);
    P.types.splice(k, 1);
    return true;
  }
  /* fill(P): every line with no type gets one (a user action, "Assign every line"): the type of its span with the same position (exterior:
     G1 and G<nb>; else interior) that has the most lines; none: a new type of that position, a copy of the span's first type (else the
     first type of the project). Returns the changes [{ s, g, label, created }]. */
  function fill(P) {
    const out = [];
    unassigned(P).forEach(({ s, g }) => {
      const want = posLabel(P, g), same = spanTypes(P, s).filter(k => typeLines(P, k).length && typeLines(P, k).every(h => posLabel(P, h) === want));
      let k = same.sort((a, b) => typeLines(P, b).length - typeLines(P, a).length)[0], created = false;
      if (k == null) { const src = spanTypes(P, s)[0] != null ? spanTypes(P, s)[0] : 0; k = addType(P, src, { label: `${want} S${s}`, span: s }); created = true; }
      assignLine(P, k, g); out.push({ s, g, label: P.types[k].label, created });
    });
    return out;
  }
  /* newTypes(P): the types of a NEW project (engineer decision PS-8; as the steel app's new project, SB-2): per span an Interior type on the
     interior lines and an Exterior type on G1 and G<nb>, no overrides (the base design); 2 girders: Exterior only. */
  function newTypes(P) {
    const nb = nbOf(P), T = [];
    for (let s = 1; s <= nsOf(P); s++) {
      if (nb > 2) T.push({ id: 'T' + (T.length + 1), label: `Interior S${s}`, span: s, lines: Array.from({ length: nb - 2 }, (_, i) => i + 2), ovr: {} });
      T.push({ id: 'T' + (T.length + 1), label: `Exterior S${s}`, span: s, lines: nb > 1 ? [1, nb] : [1], ovr: {} });
    }
    return T;
  }
  /* migrate(P): a project without girder types (saved before PR 3a): types written from its one design girder (T1 on P.design's line, no
     override: the same engine inputs, results byte-identical). Malformed stored types are kept as P.typesBad. Returns a note or ''. */
  function migrate(P) {
    if (!P || typeof P !== 'object' || !P.base || !P.xs || !P.spans) return '';
    if (hasTypes(P)) return '';
    let note = '';
    if (P.types !== undefined) { P.typesBad = P.types; note = 'The stored girder types could not be read: kept in the project as "typesBad"; the design girder was made the one girder type.'; }
    const d = sel(P); P.types = types(Object.assign({}, P, { types: undefined }));
    if (!P.design) P.design = { g: d.g, s: d.s };
    return note;
  }
  /* syncSpans(P): after the span count changed, each new span (no type of its own) gets copies of the types of the span before it (labels
     with its number); types of a span beyond the count are kept in the file, not checked (they come back if the span count grows).
     Returns the changes [{ s, labels }]. */
  function syncSpans(P) {
    const ns = nsOf(P), out = [];
    for (let s = 2; s <= ns; s++) {
      if (spanTypes(P, s).length) continue;
      let src = s - 1; while (src >= 1 && !spanTypes(P, src).length) src--; if (src < 1) continue;
      const labels = [];
      spanTypes(P, src).forEach(k => { const S = P.types[k], lab = /S\d+$/.test(S.label) ? S.label.replace(/S\d+$/, 'S' + s) : `${S.label} (S${s})`;
        P.types.push({ id: nextId(P), label: lab, span: s, lines: S.lines.slice(), ovr: clone(S.ovr) }); labels.push(lab); });
      out.push({ s, labels });
    }
    return out;
  }
  /* renumber(P, nb0, LT0): after N_b changed from nb0 (LT0[s] = lineTypes before, per span), as the steel app's renumberLines (SB-14): the
     outer lines take the types of the old outer lines (G1's on G1, the old last line's on the new last line); an inner line keeps its type
     when it was an inner line before, else takes the span's Interior type (the type on the most old inner lines, the first on ties; none:
     a new type "Interior S<s>", a copy of the old G1 type); assignments beyond N_b removed. Returns the changes [{ s, g, from, to }]. */
  function renumber(P, nb0, LT0) {
    const nb = nbOf(P), out = []; if (!nb || nb === nb0) return out;
    for (let s = 1; s <= nsOf(P); s++) {
      const L0 = LT0[s] || [], at = g => (L0[g] && L0[g].length ? L0[g][0] : -1);
      if (!spanTypes(P, s).length) continue;
      const cnt = {}; for (let g = 2; g < nb0; g++) { const k = at(g); if (k >= 0) cnt[k] = (cnt[k] || 0) + 1; }
      let inner = Object.keys(cnt).map(Number).sort((a, b) => cnt[b] - cnt[a] || a - b)[0];
      const want = {};
      for (let g = 1; g <= nb; g++) {
        let k = g === 1 ? at(1) : g === nb ? at(nb0) : (g < nb0 ? at(g) : -1);
        if (k < 0 && g !== 1 && g !== nb) {
          if (inner == null) { const src = at(1) >= 0 ? at(1) : spanTypes(P, s)[0]; inner = addType(P, src, { label: `Interior S${s}`, span: s }); }
          k = inner;
        }
        if (k >= 0) want[g] = k;
      }
      spanTypes(P, s).forEach(k => { P.types[k].lines = []; });
      Object.keys(want).forEach(g => { const k = want[g]; P.types[k].lines.push(+g); });
      for (let g = 1; g <= Math.max(nb, nb0); g++) { const a = g <= nb0 ? at(g) : -1, b = g <= nb ? (want[g] != null ? want[g] : -1) : null;
        if (b === null) { if (a >= 0) out.push({ s, g, from: P.types[a].label, to: null }); }
        else if (a !== b) out.push({ s, g, from: a >= 0 ? P.types[a].label : null, to: b >= 0 ? P.types[b].label : null }); }
    }
    return out;
  }
  /* snapshot(P): lineTypes of every span (for renumber) */
  const snapshot = P => { const o = {}; for (let s = 1; s <= nsOf(P); s++) o[s] = lineTypes(P, s); return o; };

  /* checks(P): { errors: [{ path, msg }], warnings } — the girder types (blocking input errors, the steel app's rule SB-15):
     a line of a span with two or more types; the types of one span with different shapes (PS-8); a project with no checked line. */
  function checks(P) {
    const errors = [], warnings = [], E = (path, msg) => errors.push({ path, msg });
    if (!hasTypes(P) || !nbOf(P) || !nsOf(P)) return { errors, warnings };
    const T = P.types;
    for (let s = 1; s <= nsOf(P); s++) {
      lineTypes(P, s).forEach((ks, g) => { if (ks.length > 1) E(`types.${ks[1]}.lines`, `Span ${s}, line G${g} has ${ks.length} girder types (${ks.map(k => T[k].label).join(', ')}): a line takes one girder type. Untick it in all but one (Girders & strands tab, Girder types).`); });
      const ks = spanTypes(P, s).filter(k => typeLines(P, k).length);
      if (ks.length > 1) {
        const sh = k => JSON.stringify(SHAPE.map(key => getK(effBase(P, k), key)));
        const a = sh(ks[0]), bad = ks.filter(k => sh(k) !== a);
        if (bad.length) E(`types.${bad[0]}.ovr.girder`, `Span ${s}: the girder types ${[ks[0], ...bad].map(k => T[k].label).join(', ')} have different girder shapes. Every girder of a span has the same shape (PS-8): choose the shape once for the span.`);
      }
    }
    if (!cells(P).length) E('types', 'No girder line has a girder type: assign the lines to a type (Girders & strands tab, Girder types).');
    const un = unassigned(P); if (un.length) warnings.push({ path: 'types', msg: `${un.length} girder line${un.length > 1 ? 's have' : ' has'} no girder type and ${un.length > 1 ? 'are' : 'is'} not checked: ${un.map(q => `G${q.g}/S${q.s}`).join(', ')}.` });
    return { errors, warnings };
  }

  /* results(P, resOf): every girder type on every line (PR 3a-2; the steel app's SB-2 PR 2 pattern): resOf(inputs) = the engine result
     (the page's cache of PSBHoldDown.compute, i.e. computeAll + the PS-10 check). Returns
       { cells: [{ k, id, label, s, g, inp, R, W }], types: [{ k, id, label, span, cells: [...], gov: { <check name>: { c, g } } }], W, n }
     W (kip) = the girder's weight on the line, w_sw (L + 2 e_end / 12) as engine/holddown.js (PS-10's W), per cell, per type and the
     bridge total (every checked line; SB-6). gov: each check's worst line of the type (the largest ratio; a ratio that is not a number
     first; ties keep the first line, SB-2 decision (1)). Nothing is calculated here but the sum of the weights. */
  function results(P, resOf) {
    const D = window.PSBDesign, out = { cells: [], types: [], W: 0, n: 0 };
    cells(P).forEach(c => {
      let inp, R; try { inp = D.cellInputs(P, c.k, c.g); R = resOf(inp); } catch (e) { R = { error: e.message }; }
      const W = R && !R.error && R.g ? R.g.wsw * (inp.L + 2 * (+inp.opt.endOh || 0) / 12) : NaN;
      out.cells.push(Object.assign({}, c, { inp, R, W }));
    });
    types(P).forEach((T, k) => {
      const cs = out.cells.filter(c => c.k === k); if (!cs.length) return;
      const gov = {};
      cs.forEach(c => (c.R && c.R.checks || []).forEach(q => { const b = gov[q.n], bad = x => typeof x !== 'number' || isNaN(x);
        if (!b || (bad(q.r) && !bad(b.c.r)) || (!bad(b.c.r) && q.r > b.c.r)) gov[q.n] = { c: q, g: c.g, cell: c }; }));
      const W = cs.reduce((a, c) => a + c.W, 0);
      out.types.push({ k, id: T.id, label: T.label, span: T.span, cells: cs, gov, W });
      out.W += W;
    });
    out.n = out.cells.length;
    return out;
  }

  window.PSBBridge = { results, nextId, SHAPE, isShapeKey, validTypes, hasTypes, types, typeLines, lineTypes, typeAt, spanTypes, unassigned, cells, shown, effBase, diffOvr,
    setOvr, sameShape, resetKey, ovrKeyOf, setLines, assignLine, addType, deleteType, fill, newTypes, migrate, syncSpans, renumber, snapshot, checks, posLabel, sel };
})();
