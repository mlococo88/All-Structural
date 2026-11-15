/* apps/ps-bridge/engine/demands.js — the demand source of each girder type (window.PSBDemands): this app's analysis, a custom demand table,
   or a MIDAS demands file (schema psbeam-external-demands, the old app's import). Classic script, no DOM.
   Created 2026-11-15 (batch D1, the old app's MIDAS import "Prestressed Bridge Design.html" O:5862-5895, 6252-6264, 9539-9548; the Steel
   Bridge app's demand-source choice, apps/steel-bridge/ui/demands.js). No formula here: the imported or entered demands are given to the
   moved engine the way the old app gave them, as inputs.external (an object of schema psbeam-external-demands with the span chosen,
   _selSpan), which computeAll reads through its own buildExternal / externalSpans / contUnit (engine/pbd-external.js, unchanged). The DF per
   effect and the multiple presence m on the imported live load are the old app's own inputs loads.extDFpos / extDFneg / extDFv / extLLmpf
   (Loads tab; per girder type like every Loads field).

   Saved with the project (CLAUDE.md §5; a new optional field, absent in every project saved before: every type then uses this app's
   analysis, as before, so those projects are byte-identical and compute as before):
     P.demands = { '<type id>': { src: 'app' | 'table' | 'midas',
                                  midas: { file: <the psbeam-external-demands object as read>, name: <file name>, at: <ISO time read> },
                                  span: <the MIDAS span (1-based) of the file used for this type; absent: the type's own span; 0: none
                                         chosen (only an old-app design saved so: the whole member, as the old app's engine read it)>,
                                  table: { rows: [ { x, M_DC2, M_DW, M_LLpos, M_LLneg, V_DC2, V_DW, V_LLpos, V_LLneg } ] } } }
   A source other than 'app' keeps the other source's data (switching back and forth loses nothing). The MIDAS file is kept as read; an
   old-app design's demands (engine/legacy.js) are kept with their own _selSpan, so the engine inputs are the old app's exactly.
   The custom table: per girder, unfactored, the span's stations x (ft from its left bearing); moments kip-ft (sagging +), shears kip in this
   app's sign (+ at the left support under gravity load, V = dM/dx); LL+IM with the impact, and the distribution factor unless it is entered
   below (DF / m per effect, Loads tab). It is put in the file's form: shears negated (MIDAS's sign, which buildExternal negates back) and the
   LL shear branches exchanged (buildExternal takes the app's + branch from the file's −), on the bridge's own spans (supports at the span
   ends), so the engine reads the entered values exactly.
   API: SCHEMA, SRC, COLS; isFile(o); parse(text, fileName); spans(file); entry(P, id); srcOf(P, id); pickOf(P, T); external(P, T);
   setSrc(P, id, src); setFile(P, id, file, name, at); setSpan(P, id, i); tableRows(P, id); setTable(P, id, rows); anyExt(P); checks(P);
   describe(P, T) (the source line of the output tabs). */
(function () {
  'use strict';
  const SCHEMA = 'psbeam-external-demands';
  const SRC = ['app', 'table', 'midas'];
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const isNum = v => typeof v === 'number' && isFinite(v);
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  /* the custom table's columns: [key, label (HTML), unit] */
  const COLS = [['x', 'x', 'ft'], ['M_DC2', 'M<sub>DC2</sub>', 'kip-ft'], ['M_DW', 'M<sub>DW</sub>', 'kip-ft'], ['M_LLpos', 'M<sub>LL+IM</sub> +', 'kip-ft'], ['M_LLneg', 'M<sub>LL+IM</sub> −', 'kip-ft'],
    ['V_DC2', 'V<sub>DC2</sub>', 'kip'], ['V_DW', 'V<sub>DW</sub>', 'kip'], ['V_LLpos', 'V<sub>LL+IM</sub> +', 'kip'], ['V_LLneg', 'V<sub>LL+IM</sub> −', 'kip']];
  /* isFile(o): an object of the MIDAS demands schema with stations (the old app's extActive) */
  const isFile = o => !!(isObj(o) && o._schema === SCHEMA && Array.isArray(o.stations) && o.stations.length);
  /* spans(file): the spans of the imported member (the old app's own rule, PBD.extSpans = externalSpans) */
  const spans = f => (isFile(f) && window.PBD && window.PBD.extSpans ? window.PBD.extSpans(f) : []);
  /* parse(text, fileName): { ok, file, spans, notes } or { ok: false, error }. The old app's import (O:9539-9548) took any object of the
     schema; added here (2026-11-15, decision pending engineer review): the stations must be readable (each x a number) and the file must
     say it is unfactored (factored: true is refused; the engine applies the load factors), each read as the old app reads it. */
  function parse(text, fileName) {
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: `Not a JSON file: ${e.message}` }; }
    const f = fileName ? `"${fileName}"` : 'The file';
    if (!isObj(o) || o._schema !== SCHEMA) {
      if (isObj(o) && o.schema === 'psb2.project') return { ok: false, error: `${f} is a project of this app, not a MIDAS demands file: open it with Import JSON (Project tab).` };
      if (isObj(o) && isFile(o.external)) return { ok: false, error: `${f} is an old-app design with MIDAS demands: import it with "From the old app" (Project tab); its demands come with it.` };
      return { ok: false, error: `${f} is not a MIDAS demands file (schema ${SCHEMA}, made by the MCT Generator's "Organize for PS-Beam tool").` };
    }
    if (!Array.isArray(o.stations) || o.stations.length < 2) return { ok: false, error: `${f} has ${Array.isArray(o.stations) ? o.stations.length : 'no'} station${Array.isArray(o.stations) && o.stations.length === 1 ? '' : 's'}: at least 2 are needed.` };
    const bad = o.stations.findIndex(s => !isObj(s) || !isNum(+s.x) || s.x === '' || s.x == null);
    if (bad >= 0) return { ok: false, error: `${f}: station ${bad + 1} has no station x (a number, ft).` };
    if (o.factored === true) return { ok: false, error: `${f} holds factored demands (factored: true). Export the components unfactored (factored: false): this app applies the LRFD load factors.` };
    const sp = spans(o), notes = [];
    if (!sp.length) return { ok: false, error: `${f}: no span could be read (member.supports, member.spans or the station range).` };
    const u = isObj(o.units) ? o.units : null;
    if (u && ((u.force && !/^kips?$/i.test(String(u.force))) || (u.length && !/^(ft|feet)$/i.test(String(u.length))))) notes.push(`The file declares units ${JSON.stringify(u)}: this app reads kip, ft and kip-ft (check the export).`);
    if (o.selfWeightExcluded === false) notes.push('The file says the girder self-weight is not excluded: this app computes the self-weight and DC1 itself and does not read them from the file (M_DC1 / V_DC1 are not used).');
    return { ok: true, file: o, spans: sp, notes };
  }
  const store = P => (P && isObj(P.demands) ? P.demands : null);
  function entry(P, id) { const s = store(P); return s && isObj(s[id]) ? s[id] : null; }
  function srcOf(P, id) { const e = entry(P, id); return e && SRC.includes(e.src) ? e.src : 'app'; }
  /* pickOf(P, T): the MIDAS span used for type T: the one chosen, else the type's own span */
  function pickOf(P, T) { const e = T ? entry(P, T.id) : null; return e && Number.isInteger(e.span) && e.span >= 1 ? e.span : (T ? T.span : 1); }
  const spanLens = P => ((P && P.spans && P.spans.lengths) || []).map(Number);
  /* tableFile(P, s, rows): the entered rows of span s in the file's form (see the header), on the bridge's spans */
  function tableFile(P, s, rows) {
    const Ls = spanLens(P), sup = [0]; Ls.forEach(v => sup.push(+(sup[sup.length - 1] + v).toFixed(6)));
    const x0 = sup[s - 1], v = (r, k) => (isNum(+r[k]) && r[k] !== '' && r[k] != null ? +r[k] : 0);
    const st = (rows || []).filter(r => isObj(r) && r.x !== '' && r.x != null && isNum(+r.x)).map(r => ({ x: +(x0 + +r.x).toFixed(6), M_DC2: v(r, 'M_DC2'), V_DC2: -v(r, 'V_DC2'), M_DW: v(r, 'M_DW'), V_DW: -v(r, 'V_DW'),
      M_LLpos: v(r, 'M_LLpos'), M_LLneg: v(r, 'M_LLneg'), V_LLpos: -v(r, 'V_LLneg'), V_LLneg: -v(r, 'V_LLpos') })).sort((a, b) => a.x - b.x);
    return { _schema: SCHEMA, _version: 1, source: 'custom table', generatedBy: 'PS Bridge app (entered on the Loads tab)', units: { force: 'kip', length: 'ft', moment: 'ft-kip' }, factored: false,
      liveLoadType: 'entered', member: { mode: 'beam', type: 'beam', supports: sup, spans: Ls, totalLength: sup[sup.length - 1] }, stationCount: st.length, stations: st };
  }
  /* external(P, T): the engine's inputs.external of girder type T (null: this app's analysis, or the source is not usable: its input error
     says why). MIDAS: the file as read with the span chosen (_selSpan: the stored one of an old-app design when it is that span, else the
     file's span from its own spans); table: the rows in the file's form, span T.span. */
  function external(P, T) {
    if (!T) return null;
    const e = entry(P, T.id), src = srcOf(P, T.id);
    if (src === 'midas') {
      const f = e.midas && e.midas.file; if (!isFile(f)) return null;
      if (e.span === 0) return clone(f);   // an old-app design saved with no span chosen: the whole member, as the old app's engine read it
      const i = pickOf(P, T), q = spans(f)[i - 1]; if (!q) return null;
      const sel = isObj(f._selSpan) && +f._selSpan.idx === i ? f._selSpan : q;
      return Object.assign(clone(f), { _selSpan: clone(sel) });
    }
    if (src === 'table') {
      const rows = tableRows(P, T.id); if (rows.length < 2) return null;
      const f = tableFile(P, T.span, rows), q = spans(f)[T.span - 1]; if (!q) return null;
      return Object.assign(f, { _selSpan: q });
    }
    return null;
  }
  function ensure(P, id) { if (!isObj(P.demands)) P.demands = {}; if (!isObj(P.demands[id])) P.demands[id] = { src: 'app' }; return P.demands[id]; }
  function setSrc(P, id, src) { if (!SRC.includes(src)) return; if (src === 'app' && !entry(P, id)) return; ensure(P, id).src = src; }
  function setFile(P, id, file, name, at) { const e = ensure(P, id); e.midas = { file: clone(file), name: String(name || ''), at: at || new Date().toISOString() }; e.src = 'midas'; delete e.span; }
  function setSpan(P, id, i) { const e = ensure(P, id); if (Number.isInteger(i) && i >= 1) e.span = i; else delete e.span; }
  function tableRows(P, id) { const e = entry(P, id); return e && isObj(e.table) && Array.isArray(e.table.rows) ? e.table.rows : []; }
  function setTable(P, id, rows) { const e = ensure(P, id); e.table = { rows: clone(rows) }; }
  /* anyExt(P): a girder type uses a MIDAS file or a custom table (the Loads tab then shows the DF / m per effect) */
  function anyExt(P) {
    const B = window.PSBBridge; if (!B || !store(P)) return false;
    return B.types(P).some(T => srcOf(P, T.id) !== 'app');
  }
  const near = (a, b) => Math.abs(a - b) <= 0.005;   // ft, the engine's own tolerance for a span of the bridge against L (contUnit warning)
  /* checks(P): { errors, warnings } E = { path, msg, scope } (scope: the type's id; the page marks the field in that type's scope) */
  function checks(P) {
    const errors = [], warnings = [], B = window.PSBBridge;
    if (!B || !store(P) || !P.spans) return { errors, warnings };
    const Ls = spanLens(P), cont = P.spans.continuity === 'composite' && Ls.length >= 2;
    B.types(P).forEach((T, k) => {
      const src = srcOf(P, T.id); if (src === 'app') return;
      if (!(B.hasTypes(P) ? B.typeLines(P, k).length : true)) return;   // a type on no line is not checked (as its other inputs)
      const E = (f, msg) => errors.push({ path: `demands.${T.id}.${f}`, msg: `Girder type ${T.label}: ${msg}`, src: 'demands', scope: T.id });
      const Wn = (f, msg) => warnings.push({ path: `demands.${T.id}.${f}`, msg: `Girder type ${T.label}: ${msg}`, src: 'demands', scope: T.id });
      const L = Ls[T.span - 1], e = entry(P, T.id);
      if (src === 'midas') {
        const f = e.midas && e.midas.file;
        if (!isFile(f)) { E('src', 'the demands come from a MIDAS file, but no readable file is loaded: choose the file (Loads tab, Demands card) or choose This app\'s analysis.'); return; }
        const sp = spans(f), i = pickOf(P, T), q = sp[i - 1];
        if (e.span === 0) { Wn('span', 'no span of the MIDAS member is chosen (an old-app design saved so): the engine reads the whole member from x = 0 with L of the bridge span, as the old app did. Choose the span (Loads tab, Demands card).'); return; }
        if (!q) { E('span', `the MIDAS member has ${sp.length} span${sp.length > 1 ? 's' : ''}: choose the span of the file used for span ${T.span} of the bridge.`); return; }
        const sel = isObj(f._selSpan) && +f._selSpan.idx === i ? f._selSpan : q;
        const n = f.stations.filter(s => +s.x >= +sel.x0 - 1e-6 && +s.x <= +sel.x1 + 1e-6).length;
        if (n < 2) { E('span', `MIDAS span ${i} has ${n} station${n === 1 ? '' : 's'} in the file: at least 2 are needed.`); return; }
        if (isNum(L) && !near(+sel.len, L)) Wn('span', `MIDAS span ${i} is ${(+sel.len).toFixed(2)} ft long but span ${T.span} of the bridge is ${L.toFixed(2)} ft: the design uses L = ${L.toFixed(2)} ft with the file's demands of span ${i} re-zeroed to its left bearing (held at the end values past its length). Check the span lengths (Bridge layout tab).`);
        if (sp.length >= 2 && !cont) Wn('span', `the MIDAS member is continuous (${sp.length} spans) but the bridge has simple spans: the pier negative-moment check is made only for a bridge made continuous (Bridge layout tab).`);
        if (sp.length === 1 && cont) Wn('span', 'the MIDAS member has one span but the bridge is made continuous: the pier negative moments are the file\'s moments at the ends of that span.');
      } else if (src === 'table') {
        const rows = tableRows(P, T.id);
        if (rows.length < 2) { E('table', 'the custom demand table needs at least 2 rows (stations), e.g. both bearings.'); return; }
        rows.forEach((r, j) => {
          if (!isObj(r) || r.x === '' || r.x == null || !isNum(+r.x)) { E(`table.${j}.x`, `custom demands row ${j + 1}: enter the station x (ft from the left bearing).`); return; }
          if (isNum(L) && (+r.x < -1e-9 || +r.x > L + 1e-9)) E(`table.${j}.x`, `custom demands row ${j + 1}: x = ${r.x} ft is outside span ${T.span} (0 to ${L.toFixed(2)} ft).`);
          COLS.slice(1).forEach(([c]) => { if (r[c] !== '' && r[c] != null && !isNum(+r[c])) E(`table.${j}.${c}`, `custom demands row ${j + 1}: ${c} must be a number.`); });
        });
        const xs = rows.map(r => +r.x).filter(isNum);
        if (new Set(xs).size !== xs.length) Wn('table', 'two custom demand rows have the same station x: the engine interpolates between neighbouring rows (enter a support twice only when the value jumps).');
      }
    });
    return { errors, warnings };
  }
  const fx = (v, d) => (isNum(+v) ? (+v).toFixed(d) : '—');
  /* describe(P, T): { src, what, detail } for the output tabs' source line */
  function describe(P, T) {
    const src = T ? srcOf(P, T.id) : 'app';
    if (src === 'app') return { src, what: 'This app\'s analysis', detail: 'DC2, DW and LL+IM computed by this app (built-in HL-93; continuous unit when made continuous)' };
    const e = entry(P, T.id);
    if (src === 'table') return { src, what: 'Custom table (entered)', detail: `${tableRows(P, T.id).length} rows of span ${T.span} for ${T.label}, Loads tab` };
    const f = e.midas && e.midas.file, x = external(P, T), q = x && x._selSpan;
    return { src, what: `MIDAS file${e.midas && e.midas.name ? ' ' + e.midas.name : ''}`, detail: f ? `${f.source || 'midas'} · ${f.generatedBy || 'export'} · project ${f.project || '—'} · ${(f.stations || []).length} stations${q ? ` · span ${q.idx}: ${fx(q.x0, 0)}–${fx(q.x1, 0)} ft (${fx(q.len, 1)} ft)` : ''} · LL type ${f.liveLoadType || '—'}` : 'no file loaded' };
  }
  /* slice(ext, L) (display only, for the worked steps and the imported-values table): the stations of the span the engine reads, re-zeroed
     to its left bearing, by buildExternal's own rule (engine/pbd-external.js: the stations within [x0, x1] of _selSpan, else of the whole
     member, x_r = x − x0, sorted; span length sel.len, else x1 − x0); at(key, x): its linear interpolation at x (clamped to the span) with
     the two stations used { v, a, b } (a = b at a station or past an end). The engine's own values are what the tabs show; these reproduce
     them for the derivation. */
  function slice(ext, L) {
    if (!isFile(ext)) return null;
    const sel = ext._selSpan || { x0: 0, x1: (ext.member && ext.member.totalLength) || L, idx: 0, len: L };
    const st = ext.stations.filter(s => s.x >= sel.x0 - 1e-6 && s.x <= sel.x1 + 1e-6).map(s => Object.assign({}, s, { xr: s.x - sel.x0 })).sort((a, b) => a.xr - b.xr);
    if (st.length < 2) return null;
    const len = sel.len || (sel.x1 - sel.x0);
    const at = (key, xf) => {
      const x = Math.min(Math.max(xf, 0), len), n = st.length;
      if (x <= st[0].xr) return { v: +st[0][key] || 0, a: st[0], b: st[0], x };
      if (x >= st[n - 1].xr) return { v: +st[n - 1][key] || 0, a: st[n - 1], b: st[n - 1], x };
      for (let i = 0; i < n - 1; i++) { const a = st[i], b = st[i + 1];
        if (x >= a.xr && x <= b.xr) { const t = (x - a.xr) / Math.max(b.xr - a.xr, 1e-9); return { v: (+a[key] || 0) + ((+b[key] || 0) - (+a[key] || 0)) * t, a, b, x }; } }
      return { v: +st[n - 1][key] || 0, a: st[n - 1], b: st[n - 1], x };
    };
    return { sel, len, st, at };
  }
  /* fac(inp): the engine's factors on the imported live load (pbd-compute.js fac1: blank = 1.0, an entered 0 kept): { dfp, dfn, dfv, m, pos, neg, v } */
  function fac(inp) {
    const f1 = v => { if (v === '' || v === null || v === undefined) return 1; const n = +v; return isFinite(n) ? n : 1; }, l = (inp && inp.loads) || {};
    const m = f1(l.extLLmpf), dfp = f1(l.extDFpos), dfn = f1(l.extDFneg), dfv = f1(l.extDFv);
    return { dfp, dfn, dfv, m, pos: dfp * m, neg: dfn * m, v: dfv * m };
  }
  window.PSBDemands = { slice, fac, SCHEMA, SRC, COLS, isFile, parse, spans, entry, srcOf, pickOf, external, tableFile, setSrc, setFile, setSpan, tableRows, setTable, anyExt, checks, describe };
})();
