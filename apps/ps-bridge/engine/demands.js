/* apps/ps-bridge/engine/demands.js — the demand source of each girder type (window.PSBDemands): this app's analysis or a custom demand
   table; a project saved with an imported demands file (schema psbeam-external-demands, the old app's MIDAS import, removed 2026-11-25:
   PS no-MCT, fixlog/ps-bridge.md NOMCT) is converted to the custom table when that is proven exact, else kept read only (migrate below).
   Classic script, no DOM.
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
   API: SCHEMA, SRC, COLS; isFile(o); spans(file); entry(P, id); srcOf(P, id); choices(P, id); pickOf(P, T); external(P, T);
   setSrc(P, id, src); tableRows(P, id); setTable(P, id, rows); anyExt(P); checks(P); describe(P, T) (the source line of the output tabs);
   convert(P, T), migrate(P, now) (NOMCT, 2026-11-25).
   NOMCT (2026-11-25, engineer's request "no MCT input or output"; decisions of 2026-11-25): the import of a file (parse, setFile, the span
   picker setSpan) is removed; 'midas' stays a source of the saved data only: a type saved so is converted at load to the custom table
   holding the same values when the engine then reads exactly the same demands (convert: proven, the conditions are checked on the two
   inputs), else it keeps computing from the stored file, read only (labelled "Imported demands (from an earlier version)"), until the
   engineer re-enters the demands or switches to this app's analysis; once switched away it is no longer offered. P.demands[id].midas is
   never deleted. */
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
  /* NOMCT (2026-11-25): parse(text, fileName), the reader of an imported demands file, is removed (no file import in this app). */
  const store = P => (P && isObj(P.demands) ? P.demands : null);
  function entry(P, id) { const s = store(P); return s && isObj(s[id]) ? s[id] : null; }
  function srcOf(P, id) { const e = entry(P, id); return e && SRC.includes(e.src) ? e.src : 'app'; }
  /* choices(P, id): the sources offered for type id: this app's analysis and the custom table; the kept read-only imported demands only
     while the type uses them (NOMCT: never chosen for a type, so once switched away it is not offered again) */
  function choices(P, id) { return srcOf(P, id) === 'midas' ? ['app', 'table', 'midas'] : ['app', 'table']; }
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
  function setSrc(P, id, src) { if (!SRC.includes(src) || src === 'midas') return; if (src === 'app' && !entry(P, id)) return; ensure(P, id).src = src; }   // NOMCT: 'midas' is never set
  function tableRows(P, id) { const e = entry(P, id); return e && isObj(e.table) && Array.isArray(e.table.rows) ? e.table.rows : []; }
  function setTable(P, id, rows) { const e = ensure(P, id); e.table = { rows: clone(rows) }; }
  /* anyExt(P): a girder type uses a custom table or kept imported demands (the Loads tab then shows the DF / m per effect) */
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
      if (src === 'midas') {   // NOMCT: the kept read-only imported demands (the same checks as before, reworded; nothing can be chosen)
        const f = e.midas && e.midas.file, RE = 're-enter the demands as a custom table or choose this app\'s analysis (Loads tab, Demands card)';
        if (!isFile(f)) { E('src', `the demands are imported demands from an earlier version, but no readable values are stored: ${RE}.`); return; }
        const sp = spans(f), i = pickOf(P, T), q = sp[i - 1];
        if (e.span === 0) { Wn('span', `the imported demands (from an earlier version) have no span chosen (an old-app design saved so): the engine reads the whole imported member from x = 0 with L of the bridge span, as the old app did; ${RE}.`); return; }
        if (!q) { E('span', `the imported demands (from an earlier version) have ${sp.length} span${sp.length > 1 ? 's' : ''} and no span ${i}: ${RE}.`); return; }
        const sel = isObj(f._selSpan) && +f._selSpan.idx === i ? f._selSpan : q;
        const n = f.stations.filter(s => +s.x >= +sel.x0 - 1e-6 && +s.x <= +sel.x1 + 1e-6).length;
        if (n < 2) { E('span', `span ${i} of the imported demands has ${n} station${n === 1 ? '' : 's'}: at least 2 are needed; ${RE}.`); return; }
        Wn('src', `the demands are imported demands kept from an earlier version (read only; they could not be converted to a custom table with exactly the same values): ${RE}.`);
        if (isNum(L) && !near(+sel.len, L)) Wn('span', `span ${i} of the imported demands is ${(+sel.len).toFixed(2)} ft long but span ${T.span} of the bridge is ${L.toFixed(2)} ft: the design uses L = ${L.toFixed(2)} ft with the imported demands of span ${i} re-zeroed to its left bearing (held at the end values past its length). Check the span lengths (Bridge layout tab).`);
        if (sp.length >= 2 && !cont) Wn('span', `the imported member is continuous (${sp.length} spans) but the bridge has simple spans: the pier negative-moment check is made only for a bridge made continuous (Bridge layout tab).`);
        if (sp.length === 1 && cont) Wn('span', 'the imported member has one span but the bridge is made continuous: the pier negative moments are the imported moments at the ends of that span.');
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
      // IMP-N (2026-11-23): imported demands are used as given: a pedestrian load / composite utility of the Cross-section tab is not added
      { const a = assumedOf(P, T); if (a) Wn('src', a.text); }
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
    const f = e.midas && e.midas.file, x = external(P, T), q = x && x._selSpan;   // NOMCT: no file name, source or producer shown
    return { src, what: 'Imported demands (from an earlier version, read only)', detail: f ? `${(f.stations || []).length} stations${q ? ` · span ${q.idx}: ${fx(q.x0, 0)}–${fx(q.x1, 0)} ft (${fx(q.len, 1)} ft)` : ''}; re-enter them as a custom table or choose this app's analysis` : 'no readable values stored' };
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
  /* IMP-N (2026-11-23, engineer's decision: "imported demands are used as given and are ASSUMED to include PL"; fixlog/ps-bridge.md IMP-N).
     A NOTE ONLY: no value is computed or changed here. What the engine does with imported demands (engine/pbd-compute.js, unchanged):
       DC2, DW and LL+IM moments and shears = the file's or the table's, so
         the pedestrian live load PL (engine/pl.js, mode 'ext')               NOT added: the imported live load must include it;
         a utility on the composite section (category UT, in the line's DW)   NOT added: the imported DW must include it (its klf is used
                                                                              for the superimposed dead-load deflection only);
       the girder self-weight and DC1 = this app's, on the precast girder alone, so
         a utility on the noncomposite section (UTN) and the future utility allowance (UF), both in w_NC   ARE applied by this app.
     noteText(a): the note; a = { pl (klf or true), utc (klf or true), wUT, wUF } (a number names the girder line's share).
     assumed(inp, R): R with R.imp = { pl, utc, wUT, wUF, text } and the note as ONE design warning (replacing engine/pl.js's own) when the
       girder has imported demands and a pedestrian load or a composite utility; any other girder: R unchanged.
     assumedOf(P, T): the same for girder type T on any of its lines (the input side: the Demands card, the input warnings), or null. */
  const A316 = 'AASHTO LRFD 10th Ed. 3.6.1.6';
  function noteText(a) {
    const k = v => (isNum(v) ? ` (${v.toFixed(4)} klf on this girder line)` : ''), t = [];
    t.push('Imported demands (a custom table, or demands kept from an earlier version) are used as given: DC2, DW and LL+IM are the imported values.');
    if (a.pl) t.push(`A pedestrian live load is entered on the Cross-section tab${k(a.pl)}: the imported live load must already include it; it is NOT added by this app (${A316}).`);
    if (a.utc) t.push(`A utility on the composite section is entered on the Cross-section tab${k(a.utc)}: the imported DW must already include it; it is NOT added by this app (its klf is used for the superimposed dead-load deflection only).`);
    if (a.wUT || a.wUF) t.push('The utilities on the noncomposite section and the future utility allowance of the Cross-section tab ARE applied by this app: they act on the precast girder alone, which this app always computes itself (not imported).');
    return t.join(' ');
  }
  function assumed(inp, R) {
    if (!R || R.error || !R.useExt || !inp) return R;
    const pl = inp.pl && +inp.pl.w > 0 ? +inp.pl.w : 0, utc = isNum(+inp.utc) && +inp.utc !== 0 ? +inp.utc : 0; if (!pl && !utc) return R;
    const u = inp.ut || {}, a = { pl, utc, wUT: +u.wUT || 0, wUF: +u.wUF || 0 }; a.text = noteText(a);
    R.imp = a;
    if (Array.isArray(R.warns)) { const PL = window.PSBPL, i = PL ? R.warns.indexOf(PL.WARN_EXT) : -1; if (i >= 0) R.warns.splice(i, 1); R.warns.push(a.text); }
    return R;
  }
  function assumedOf(P, T) {
    const B = window.PSBBridge, DL = window.PSBBridgeDL; if (!B || !DL || !T || srcOf(P, T.id) === 'app' || !P.xs || !P.xs.dl) return null;
    const k = B.types(P).indexOf(T), gs = B.hasTypes(P) ? B.typeLines(P, k) : [window.PSBDesign ? window.PSBDesign.sel(P).g : 1], a = { pl: false, utc: false, wUT: false, wUF: false };
    gs.forEach(g => { let q = null; try { q = DL.line(P, g); } catch (e) { q = null; } if (!q) return; if (q.PL > 0) a.pl = true; if (q.UT) a.utc = true; if (q.UTN) a.wUT = true; if (q.UF) a.wUF = true; });
    if (!a.pl && !a.utc) return null;
    a.text = noteText(a); return a;
  }
  /* ---- NOMCT (2026-11-25): the saved imported demands (src 'midas') at load ----
     convert(P, T): { ok, rows } when the custom table of girder type T holding rows makes the engine read exactly the same demands as the
       stored file, else { ok: false, why }. Proven on the two engine inputs themselves (no tolerance): the file's input external(P, T) and the
       table's (the rows saved and read back as JSON, the bridge's spans), each through the engine's own buildExternal and externalSpans
       (engine/pbd-external.js, unchanged): the span read (_selSpan: idx, x0, x1, len, as a whole), its length, every station of the slice
       (x from the left bearing and the eight values the engine reads: M_DC2, V_DC2, M_DW, V_DW, M_LLpos, M_LLneg, V_LLpos, V_LLneg, as
       +v || 0) and the spans of the member (the continuous unit and the interior-pier warning of the engine). Not converted: no span chosen
       (span 0, the whole member), a span of the file other than the type's own, a station outside the bridge span, fewer than 2 stations, or
       a custom table already stored for the type with other values (it is kept). The rows: x = the station − x0 of the span, the moments as
       read, the shears in this app's sign (negated, the LL branches exchanged: tableFile's rule reversed). The file's M_DC1 / V_DC1 and its
       description (liveLoadType, member key, DF / IM flags) are not held; the engine does not use them (shown only: R.ext, Loads tab "LL type").
     migrate(P, now): every type with src 'midas': converted (src 'table', table.rows, converted: { from: 'imported file', at }; midas and
       span kept as they were) or kept (unchanged). -> the load notes (NOTE_CONVERTED, NOTE_KEPT of the type labels). */
  const DKEYS = ['M_DC2', 'V_DC2', 'M_DW', 'V_DW', 'M_LLpos', 'M_LLneg', 'V_LLpos', 'V_LLneg'];
  const NOTE_CONVERTED = l => `Demands of ${l} were imported from a file; they are now a custom table with the same values (Loads tab, Demands card).`;
  const NOTE_KEPT = l => `Demands of ${l} are imported demands kept from an earlier version (read only: they cannot be converted to a custom table with exactly the same values). Re-enter them as a custom table or choose this app's analysis (Loads tab, Demands card).`;
  function convert(P, T) {
    const no = why => ({ ok: false, why }), W = window;
    const e = T ? entry(P, T.id) : null; if (!e || srcOf(P, T.id) !== 'midas') return no('not imported demands');
    const f = e.midas && e.midas.file; if (!isFile(f)) return no('no readable stored values');
    if (e.span === 0) return no('no span of the imported member chosen (the whole member)');
    if (pickOf(P, T) !== T.span) return no(`span ${pickOf(P, T)} of the imported member is used for span ${T.span} of the bridge`);
    const BE = W.buildExternal, ES = W.externalSpans; if (typeof BE !== 'function' || typeof ES !== 'function') return no('the engine is not loaded');
    const L = spanLens(P)[T.span - 1], x = external(P, T); if (!isNum(L) || !(L > 0) || !x) return no('the span or the imported demands cannot be read');
    const a = BE(x, L, { pos: 1, neg: 1, v: 1 }); if (!a) return no('fewer than 2 stations in the span');
    const g = (s, k) => +s[k] || 0;
    const rows = a.slice.map(s => ({ x: s.xr, M_DC2: g(s, 'M_DC2'), M_DW: g(s, 'M_DW'), M_LLpos: g(s, 'M_LLpos'), M_LLneg: g(s, 'M_LLneg'),
      V_DC2: -g(s, 'V_DC2') || 0, V_DW: -g(s, 'V_DW') || 0, V_LLpos: -g(s, 'V_LLneg') || 0, V_LLneg: -g(s, 'V_LLpos') || 0 }));
    if (rows.some(r => r.x < -1e-9 || r.x > L + 1e-9)) return no(`a station is outside span ${T.span} of the bridge (0 to ${L.toFixed(2)} ft)`);
    const R2 = JSON.parse(JSON.stringify(rows)), old = tableRows(P, T.id);
    if (old.length && JSON.stringify(old) !== JSON.stringify(R2)) return no('a custom table with other values is already stored for this type');
    const Q = Object.assign({}, P, { demands: Object.assign({}, P.demands, { [T.id]: { src: 'table', table: { rows: R2 } } }) }), y = external(Q, T);
    const b = y ? BE(y, L, { pos: 1, neg: 1, v: 1 }) : null; if (!b) return no('the table cannot be read');
    const same = JSON.stringify(a.sel) === JSON.stringify(b.sel) && Object.is(a.spanLen, b.spanLen) && a.slice.length === b.slice.length
      && a.slice.every((s, i) => Object.is(s.xr, b.slice[i].xr) && DKEYS.every(k => Object.is(g(s, k), g(b.slice[i], k))))
      && JSON.stringify(ES(x)) === JSON.stringify(ES(y));
    return same ? { ok: true, rows: R2 } : no('the span, its stations or the member spans differ from the bridge\'s');
  }
  function migrate(P, now) {
    const B = window.PSBBridge, notes = []; if (!B || !store(P)) return notes;
    let types = []; try { types = B.types(P); } catch (er) { return notes; }
    const conv = [], kept = [];
    types.forEach(T => {
      if (srcOf(P, T.id) !== 'midas') return;
      const r = convert(P, T);
      if (!r.ok) { kept.push(T.label); return; }
      const e = P.demands[T.id]; e.table = { rows: r.rows }; e.src = 'table'; e.converted = { from: 'imported file', at: now || new Date().toISOString() };
      conv.push(T.label);
    });
    if (conv.length) notes.push(NOTE_CONVERTED(conv.join(', ')));
    if (kept.length) notes.push(NOTE_KEPT(kept.join(', ')));
    return notes;
  }
  /* NOMCT (2026-11-25, engineer's decision "reword where shown"): the moved engine (engine/pbd-*.js, frozen byte for byte) names the old
     app's MIDAS import in a few texts it writes for imported demands (a custom table goes the same path). The app rewords them where they
     leave the engine; no number is changed:
       R.warns        "MIDAS span n: the … end … is an interior pier … (MIDAS element end, opposite sign) …" (computeAll, interior pier)
       R.cont.llSrc   "MIDAS pier moment" (the label of the worked step of the pier live-load moment)
       superReactions girderLine.source "PS-Beam DC1 + MIDAS DC2/DW", the note "MIDAS import active (span n): …" and the error "the
                      imported MIDAS demands could not be read" (bxSuperRxPayload; reworded in engine/handoffs.js srPayload: only these
                      human-readable strings, no key or value; Bridge Substructure Loading does not match on them).
     neutralText(t): t with those phrases reworded; neutral(R): R with R.warns and R.cont.llSrc reworded (imported demands only; any other
     R is returned unchanged). Called by engine/holddown.js compute. */
  const NEUTRAL = [
    [/^MIDAS span ([^:]*): /, 'Entered demands, span $1: '],
    [/\(MIDAS element end, opposite sign\)/g, '(an element end of the analysis model, opposite sign)'],
    [/^MIDAS pier moment$/, 'entered pier moment'],
    [/MIDAS import active \(span /g, 'Entered demands active (span '],
    [/PS-Beam DC1 \+ MIDAS DC2\/DW/g, 'PS-Beam DC1 + entered DC2/DW'],
    [/the imported MIDAS demands could not be read/g, 'the imported or entered demands could not be read']
  ];
  const neutralText = t => (typeof t === 'string' ? NEUTRAL.reduce((s, q) => s.replace(q[0], q[1]), t) : t);
  function neutral(R) {
    if (!R || !R.useExt) return R;
    if (Array.isArray(R.warns)) R.warns = R.warns.map(neutralText);
    if (R.cont && typeof R.cont.llSrc === 'string') R.cont.llSrc = neutralText(R.cont.llSrc);
    return R;
  }
  window.PSBDemands = { noteText, assumed, assumedOf, slice, fac, SCHEMA, SRC, COLS, isFile, spans, entry, srcOf, choices, pickOf, external, tableFile, setSrc, tableRows, setTable, anyExt, checks, describe, convert, migrate, NOTE_CONVERTED, NOTE_KEPT, neutral, neutralText };
})();
