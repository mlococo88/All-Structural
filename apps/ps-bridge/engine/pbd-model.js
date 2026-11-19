/* apps/ps-bridge/engine/pbd-model.js — the bridge-level engines window.PBD (the whole plain <script> block between the tags on lines 1901 and 2421): module registry, bridge model psbeam.bridge.v1 and its migration, cells, continuous-unit analysis (threeMoment, contFE, restraint), owner rules (OWN_RULES, ownLoads).
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 1902-2420 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): FE_CACHE, sgBeam, sgILGrid, sgLLRow, sgFatRow.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ═══ Prestressed Bridge Design — bridge-level engines (window.PBD) ═══════════════════════════════════
   PBD-D (2026-10-22). Plain JavaScript, no React: the module registry, the bridge model and its
   migration, and the girder × span cells. The UI (JSX, below) only calls these. Nothing here computes an
   engineering value: every result still comes from computeAll() of the one design on screen.

   Bridge model (key psbeam.bridge.v1; slice "psbeamBridge" of a shared Bridge Suite project):
     { v:1, mode:'pl'|'mod', title:{name,by,date,job}, spans:[L1 ft, L2, …], nGirders, S (ft),
       sel:{g,s}, designs:{ 'G<g>/S<s>': inputs, … }, src:{ migrated:ISO, from:'psbeam.inputs.v1' } }
   - The design on screen is still psbeam.inputs.v1 (unchanged key and format). designs[] keeps the
     inputs of every other girder × span cell the engineer has opened (and a copy of the active one).
   - First open with no saved model: the model is built from the saved inputs (migrate), in memory. It is
     written only when the engineer changes something at bridge level (mode, cell, bridge bar, project
     save), so opening a design never changes what is stored. psbeam.inputs.v1 is never removed.
   - Imported MIDAS demands (inputs.external): the spans are the imported member's spans and the span of
     a cell is the imported span of the same number (the existing span selection, external._selSpan).
   Modes (mirroring Steel Bridge Design):
     'pl' Preliminary designer: the bridge model drives every girder design: span length, girder spacing,
          number of girders, interior/exterior position and the title block are set from the bridge bar,
          in the open design and in every cell opened later.
     'mod' Design modules: the bridge model is the definition and the cell list only; each girder design
          keeps its own span, spacing and position (enter them, or import its MIDAS demands).
   ══════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PBD = window.PBD = window.PBD || {};
  var KEY = 'psbeam.bridge.v1', SLICE = 'psbeamBridge', V = 1;
  PBD.KEY = KEY; PBD.SLICE = SLICE;
  /* Module registry (PBD_MODS). id = the tab key, label = the tab text, grp = the module group shown in the
     module bar, when(inp) = shown only when it returns true, modes = the working modes that show it. */
  PBD.MODS = [
    { id: 'inputs', label: 'Inputs', grp: 'Girder' },
    { id: 'section', label: 'Section Props', grp: 'Girder' },
    { id: 'losses', label: 'Losses', grp: 'Girder' },
    { id: 'stresses', label: 'Stresses', grp: 'Girder' },
    { id: 'flexure', label: 'Flexure', grp: 'Girder' },
    { id: 'shear', label: 'Shear', grp: 'Girder' },
    { id: 'anchorage', label: 'Anchorage Zone', grp: 'Girder' },
    { id: 'diagrams', label: 'Diagrams', grp: 'Analysis' },
    { id: 'camber', label: 'Camber', grp: 'Analysis' },
    { id: 'handling', label: 'Handling', grp: 'Details', when: function (inp) { return !!(inp && inp.handling && inp.handling.on); } },
    { id: 'deck', label: 'Deck', grp: 'Details', when: function (inp) { return !!(inp && inp.deck && inp.deck.on); } },
    { id: 'rating', label: 'Rating', grp: 'Rating' },
    { id: 'optimize', label: 'Optimize', grp: 'Tools' },
    { id: 'compare', label: 'Compare', grp: 'Tools' },
    { id: 'nomen', label: 'Nomenclature', grp: 'Report' },
    { id: 'report', label: 'Report', grp: 'Report' }   // PSRP2 2026-11-01: the shared report viewer (SharedReportTab); the old ReportTab retired
  ];
  PBD.mods = function (inp, mode) {
    return PBD.MODS.filter(function (m) { return (!m.when || m.when(inp)) && (!m.modes || m.modes.indexOf(mode) >= 0); });
  };
  PBD.MODES = { pl: { label: 'Preliminary designer', sub: 'The bridge drives every girder design' },
                mod: { label: 'Design modules', sub: 'Bridge definition; each girder design keeps its own inputs' } };

  function num(v, d) { var n = +v; return isFinite(n) ? n : d; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function extActive(inp) { var e = inp && inp.external; return !!(e && e._schema === 'psbeam-external-demands' && Array.isArray(e.stations) && e.stations.length); }
  /* The spans of an imported member, the same rule as externalSpans() in the design code (supports, else spans,
     else the station range). Duplicated here so this block does not depend on the JSX. */
  function extSpans(ext) {
    var m = (ext && ext.member) || {};
    if (Array.isArray(m.supports) && m.supports.length >= 2)
      return m.supports.slice(0, -1).map(function (x0, i) { return { idx: i + 1, x0: x0, x1: m.supports[i + 1], len: +(m.supports[i + 1] - x0).toFixed(3) }; });
    if (Array.isArray(m.spans) && m.spans.length) { var x = 0; return m.spans.map(function (len, i) { var o = { idx: i + 1, x0: x, x1: x + len, len: len }; x += len; return o; }); }
    var xs = (ext.stations || []).map(function (s) { return s.x; }), x0 = Math.min.apply(null, xs), x1 = Math.max.apply(null, xs);
    return [{ idx: 1, x0: x0, x1: x1, len: +(x1 - x0).toFixed(3) }];
  }
  PBD.extSpans = extSpans; PBD.extActive = extActive;
  PBD.key = function (g, s) { return 'G' + g + '/S' + s; };
  PBD.isExt = function (b, g) { return g === 1 || g === b.nGirders; };
  PBD.girderLabel = function (b, g) { return 'G' + g + ' (' + (PBD.isExt(b, g) ? 'Exterior' : 'Interior') + ')'; };
  function titleOf(inp) { var p = (inp && inp.proj) || {}; return { name: p.name || '', by: p.by || '', date: p.date || '', job: p.job || '' }; }

  /* Build the bridge model from one saved design (first open). Changes nothing in the inputs. */
  PBD.migrate = function (inp, mode) {
    var ext = extActive(inp), sp = ext ? extSpans(inp.external) : null;
    var n = Math.max(2, Math.round(num(inp.nGirders, 5)) || 2);
    var cs = (!ext && inp.cont && Array.isArray(inp.cont.spans)) ? inp.cont.spans.map(Number).filter(function (v) { return v > 0; }) : [];
    var spans = ext ? sp.map(function (q) { return q.len; }) : (cs.length >= 2 ? cs : [num(inp.L, 0)]);
    var s = 1;
    if (!ext && cs.length >= 2) { s = Math.min(Math.max(1, Math.round(+inp.cont.span) || 1), cs.length); spans[s - 1] = num(inp.L, 0); }
    if (ext) { var sel = inp.external._selSpan; s = sel && sel.idx ? Math.min(Math.max(1, +sel.idx), spans.length) : 1; }
    var m = /^\s*G\s*(\d+)/i.exec(String((inp.proj && inp.proj.girderId) || '')), g;
    if (m && +m[1] >= 1 && +m[1] <= n) g = +m[1];
    else g = (inp.loads && inp.loads.pos === 'exterior') ? 1 : Math.min(2, n);
    var b = { v: V, mode: mode || (ext ? 'mod' : 'pl'), title: titleOf(inp), spans: spans, nGirders: n, S: num(inp.S, 0),
      sel: { g: g, s: s }, designs: {}, src: { migrated: new Date().toISOString(), from: 'psbeam.inputs.v1' } };
    b.designs[PBD.key(g, s)] = clone(inp);
    return b;
  };
  /* A stored model, checked; null when absent or unreadable (then the caller migrates). */
  PBD.valid = function (b) {
    return !!(b && typeof b === 'object' && b.v === V && Array.isArray(b.spans) && b.spans.length && b.nGirders >= 1 && b.sel && b.designs && typeof b.designs === 'object');
  };
  PBD.load = function () { try { var b = JSON.parse(localStorage.getItem(KEY)); return PBD.valid(b) ? b : null; } catch (e) { return null; } };
  PBD.save = function (b) { try { localStorage.setItem(KEY, JSON.stringify(b)); return true; } catch (e) { try { window.BridgeApps && window.BridgeApps.storageWarn('the bridge model', e); } catch (x) { } return false; } };
  PBD.loaded = function (b) { return !!b; };

  /* Keep the model in step with the design on screen (the engineer edits the inputs directly): the cell's
     stored copy, and in Preliminary designer the bridge values the inputs carry (span of the cell, spacing,
     girder count, title). Returns the same object when nothing changed. */
  PBD.fromInputs = function (b, inp) {
    var k = PBD.key(b.sel.g, b.sel.s), n = clone(b), ch = false;
    if (JSON.stringify(b.designs[k]) !== JSON.stringify(inp)) { n.designs[k] = clone(inp); ch = true; }
    var t = titleOf(inp); if (JSON.stringify(t) !== JSON.stringify(b.title)) { n.title = t; ch = true; }
    if (b.mode === 'pl') {
      if (!extActive(inp) && num(inp.L, 0) !== b.spans[b.sel.s - 1]) { n.spans[b.sel.s - 1] = num(inp.L, 0); ch = true; }
      if (num(inp.S, 0) !== b.S) { n.S = num(inp.S, 0); ch = true; }
      var ng = Math.max(2, Math.round(num(inp.nGirders, 5)) || 2); if (ng !== b.nGirders) { n.nGirders = ng; ch = true; if (n.sel.g > ng) n.sel.g = ng; }
    }
    if (extActive(inp)) { var sp = extSpans(inp.external).map(function (q) { return q.len; }); if (JSON.stringify(sp) !== JSON.stringify(b.spans)) { n.spans = sp; ch = true; } }
    return ch ? n : b;
  };
  /* The bridge values written into a girder design (Preliminary designer). */
  PBD.applyBridge = function (b, inp, g, s) {
    var o = clone(inp), ext = extActive(o);
    o.proj = Object.assign({}, o.proj || {}, b.title, { girderId: PBD.girderLabel(b, g) });
    if (ext) { var sp = extSpans(o.external), q = sp[Math.min(s, sp.length) - 1]; if (q) { o.external = Object.assign({}, o.external, { _selSpan: q }); o.L = q.len; } }
    else o.L = b.spans[s - 1];
    o = PBD.withSpans(o, b, s);
    o.S = b.S; o.nGirders = b.nGirders;
    var pos = PBD.isExt(b, g) ? 'exterior' : 'interior';   // a design already at this position keeps its loads as they are
    if (!o.loads || o.loads.pos !== pos) o.loads = Object.assign({}, o.loads, { pos: pos, posAuto: false });
    return o;
  };
  /* PBD-G: the span arrangement of the bridge written into a design (inputs cont.spans, cont.span), read by computeAll
     for the continuous analysis when continuity is on. Written on bridge-level actions only (cell, bridge bar), in both
     modes: the spans are the bridge definition. A design with imported MIDAS demands keeps the imported spans. */
  PBD.withSpans = function (inp, b, s) {
    if (extActive(inp)) return inp;
    var o = clone(inp); o.cont = Object.assign({}, o.cont || {}, { spans: b.spans.slice(), span: s });
    return o;
  };
  /* Open another girder × span cell. Returns { b, inp }: the model with the current design stored, and the
     inputs of the target cell (its stored design, else a copy of the current one), with the bridge values
     applied in Preliminary designer and only the girder label / imported span in Design modules. */
  PBD.select = function (b, cur, g, s) {
    var n = clone(b); n.designs[PBD.key(b.sel.g, b.sel.s)] = clone(cur);
    g = Math.min(Math.max(1, g), n.nGirders); s = Math.min(Math.max(1, s), n.spans.length);
    n.sel = { g: g, s: s };
    var base = n.designs[PBD.key(g, s)] ? clone(n.designs[PBD.key(g, s)]) : clone(cur);
    var inp, stored = !!n.designs[PBD.key(g, s)];
    if (n.mode === 'pl') inp = PBD.applyBridge(n, base, g, s);
    else {   // Design modules: the cell keeps its own inputs; a new cell gets its girder label and, with imported demands, its span
      inp = base;
      if (!stored) { inp.proj = Object.assign({}, inp.proj || {}, { girderId: PBD.girderLabel(n, g) });
        if (extActive(inp)) { var sp = extSpans(inp.external), q = sp[s - 1]; if (q) { inp.external = Object.assign({}, inp.external, { _selSpan: q }); inp.L = q.len; } } }
      inp.proj = Object.assign({}, inp.proj || {}, n.title);   // one title block for the bridge, in both modes
      inp = PBD.withSpans(inp, n, s);
    }
    n.designs[PBD.key(g, s)] = clone(inp);
    return { b: n, inp: inp };
  };
  /* Edit the bridge (bridge bar). patch: { spans?, nGirders?, S?, title? }. In Preliminary designer the open
     design follows; the stored designs of other cells follow when they are opened. */
  PBD.edit = function (b, cur, patch) {
    var n = clone(b);
    if (patch.spans && !extActive(cur)) n.spans = patch.spans.map(function (v) { return Math.max(0, num(v, 0)); });
    if (patch.nGirders != null) n.nGirders = Math.max(2, Math.round(num(patch.nGirders, n.nGirders)));
    if (patch.S != null) n.S = Math.max(0, num(patch.S, n.S));
    if (patch.title) n.title = Object.assign({}, n.title, patch.title);
    n.sel = { g: Math.min(n.sel.g, n.nGirders), s: Math.min(n.sel.s, n.spans.length) };
    var inp = n.mode === 'pl' ? PBD.applyBridge(n, cur, n.sel.g, n.sel.s) : (patch.spans ? PBD.withSpans(cur, n, n.sel.s) : cur);
    n.designs[PBD.key(n.sel.g, n.sel.s)] = clone(inp);
    return { b: n, inp: inp };
  };
  PBD.cells = function (b) { var out = []; for (var s = 1; s <= b.spans.length; s++) for (var g = 1; g <= b.nGirders; g++) out.push({ g: g, s: s, key: PBD.key(g, s), has: !!b.designs[PBD.key(g, s)] }); return out; };
})();

/* ═══ Continuous analysis — PBD-G (2026-10-22) ═══════════════════════════════════════════════════════════
   Simple-span precast girders made continuous for loads applied after continuity (AASHTO LRFD 10th Ed. 5.12.3.3).
   Plain JavaScript, no React; computeAll() calls these. Engines only: every value is worked in the report.
   - COPY (CLAUDE.md §3, kept duplicated): FE_CACHE, sgBeam, sgILGrid, sgLLRow and sgFatRow below are copied unchanged
     from Steel Bridge Design.html (its SBD-SHARED block: the line-girder FE model, influence lines, and the HL-93 and
     fatigue-truck envelopes of 3.6.1). Copies: Steel Bridge Design.html (one copy, shared by its Preliminary sizing page
     and its modules) and this file. sgFatRow is copied only because sgBeam calls it; this tool does not use its result.
   - PBD.threeMoment: support moments of a prismatic continuous beam from the free end rotations of its spans.
   - PBD.contFE: the composite-stage analysis of one span of the continuous unit (unit uniform load on all spans, and
     the HL-93 envelopes per lane with IM at every node of the span).
   - PBD.restraint: the restraint moments at the supports (C5.12.3.3.2: creep δ1(M_g + M_ps) + δ2 M_deck; differential
     shrinkage of deck and girder after continuity by the initial strain method).
   ══════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PBD = window.PBD = window.PBD || {};
/* Line-girder finite-element model (Euler-Bernoulli beam elements, banded Cholesky).
   EI: optional per-element flexural stiffness (any consistent unit; only ratios matter for forces).
   noLL: skip the live-load envelopes (dead-load stages). */
const FE_CACHE = new Map();
function sgBeam(spans, simple, EI, noLL) {
  const key = spans.join(',') + (simple ? 'S' : 'C') + (EI ? ':' + Array.from(EI, v => v.toPrecision(6)).join('|') : '') + (noLL ? 'n' : '');
  if (FE_CACHE.has(key)) return FE_CACHE.get(key);
  const xs = [0], sup = [0];
  spans.forEach(L => { const n = Math.max(8, Math.round(L)); const h = L / n, x0 = xs[xs.length - 1]; for (let k = 1; k <= n; k++) xs.push(x0 + k * h); sup.push(xs.length - 1); });
  const N = xs.length, nd = 2 * N, hb = 3;
  const u = Array.from({ length: nd }, () => new Float64Array(hb + 1)), ke = [];
  for (let e = 0; e < N - 1; e++) {
    const h = xs[e + 1] - xs[e], h2 = h * h, h3 = h2 * h;
    const r = EI ? EI[e] : 1, k = [[12 / h3, 6 / h2, -12 / h3, 6 / h2], [6 / h2, 4 / h, -6 / h2, 2 / h], [-12 / h3, -6 / h2, 12 / h3, -6 / h2], [6 / h2, 2 / h, -6 / h2, 4 / h]].map(row => row.map(v => v * r));
    ke.push(k); const d = [2 * e, 2 * e + 1, 2 * e + 2, 2 * e + 3];
    for (let r = 0; r < 4; r++) for (let c = r; c < 4; c++) u[d[r]][d[c] - d[r]] += k[r][c];
  }
  const kmax = Math.max(...u.map(r => r[0])); sup.forEach(s => u[2 * s][0] += kmax * 1e9);                    // pinned supports (penalty)
  for (let i = 0; i < nd; i++) {                            // banded Cholesky, A = U^T U
    let s = u[i][0]; for (let k = Math.max(0, i - hb); k < i; k++) s -= u[k][i - k] ** 2;
    u[i][0] = Math.sqrt(s);
    for (let d = 1; d <= hb && i + d < nd; d++) { const j = i + d; let t = u[i][d]; for (let k = Math.max(0, j - hb); k < i; k++) t -= u[k][i - k] * u[k][j - k]; u[i][d] = t / u[i][0]; }
  }
  const y = new Float64Array(nd), x = new Float64Array(nd);
  const solve = b => {
    for (let i = 0; i < nd; i++) { let s = b[i]; for (let k = Math.max(0, i - hb); k < i; k++) s -= u[k][i - k] * y[k]; y[i] = s / u[i][0]; }
    for (let i = nd - 1; i >= 0; i--) { let s = y[i]; for (let d = 1; d <= hb && i + d < nd; d++) s -= u[i][d] * x[i + d]; x[i] = s / u[i][0]; }
    return x;
  };
  // ILM[i*N+j]: moment at node i (sagging +) for unit downward load at node j
  // ILV[e*N+j]: shear in element e for unit downward load at node j
  const ILM = new Float64Array(N * N), ILV = new Float64Array((N - 1) * N), b = new Float64Array(nd);
  if (simple) {                                             // independent simple spans: closed-form influence lines
    for (let k = 0; k < spans.length; k++) {
      const a = xs[sup[k]], L = spans[k];
      for (let i = sup[k]; i <= sup[k + 1]; i++) for (let j = sup[k]; j <= sup[k + 1]; j++) {
        const x = xs[i] - a, xi = xs[j] - a; ILM[i * N + j] = xi <= x ? xi * (L - x) / L : x * (L - xi) / L;
      }
      for (let e = sup[k]; e < sup[k + 1]; e++) { const xm = (xs[e] + xs[e + 1]) / 2 - a;
        for (let j = sup[k]; j <= sup[k + 1]; j++) { const xi = xs[j] - a; ILV[e * N + j] = xi > xm ? (L - xi) / L : -xi / L; } }
    }
  }
  for (let j = 0; j < N && !simple; j++) {
    b.fill(0); b[2 * j] = -1; const d = solve(b);
    for (let e = 0; e < N - 1; e++) {
      const k = ke[e], v0 = d[2 * e], t0 = d[2 * e + 1], v1 = d[2 * e + 2], t1 = d[2 * e + 3];
      const f0 = k[0][0] * v0 + k[0][1] * t0 + k[0][2] * v1 + k[0][3] * t1;
      const f1 = k[1][0] * v0 + k[1][1] * t0 + k[1][2] * v1 + k[1][3] * t1;
      const f3 = k[3][0] * v0 + k[3][1] * t0 + k[3][2] * v1 + k[3][3] * t1;
      ILM[(e + 1) * N + j] = f3; if (e === 0) ILM[j] = -f1;
      ILV[e * N + j] = f0;
    }
  }
  const trib = xs.map((_, j) => ((j < N - 1 ? xs[j + 1] - xs[j] : 0) + (j > 0 ? xs[j] - xs[j - 1] : 0)) / 2);
  // 1-ft load grid, interpolation coefficients
  const Ltot = xs[N - 1], G = Math.ceil(Ltot - 1e-9), gi = [];
  for (let g = 0, e = 0; g <= G; g++) { const xg = Math.min(g, Ltot); while (e < N - 2 && xs[e + 1] < xg) e++; const t = (xg - xs[e]) / (xs[e + 1] - xs[e]); gi.push([e, Math.max(0, Math.min(1, t)), g <= Ltot + 1e-9]); }
  const beam = { xs, sup, N, ILM, ILV, trib, G, gi, Ltot, spans, EI: EI || null };
  if (noLL) { FE_CACHE.set(key, beam); if (FE_CACHE.size > 24) FE_CACHE.delete(FE_CACHE.keys().next().value); return beam; }
  // live load envelopes per unit IL row (no DF), with IM on truck/tandem
  const env = row => sgLLRow(beam, row);
  beam.MLL = []; for (let i = 0; i < N; i++) beam.MLL.push(env(ILM.subarray(i * N, (i + 1) * N)));
  beam.MF = []; for (let i = 0; i < N; i++) beam.MF.push(sgFatRow(beam, ILM.subarray(i * N, (i + 1) * N)));
  // shear (LL2, 2026-10-14): influence lines with the unit jump at the section. LL9 (2026-10-14): exact section values, no envelope.
  // Element e carries the section just right of its left node e, except an element that ends at a support (or the girder end), which
  // carries the section just left of that support. VLLr / VFr: the section just right of node e for every element (station output).
  const isSup = new Uint8Array(N); sup.forEach(s => isSup[s] = 1);
  const sec = (e, m) => { const row = ILV.subarray(e * N, (e + 1) * N), c = { e, m }; return [sgLLRow(beam, row, c), sgFatRow(beam, row, c)]; };
  beam.VLL = []; beam.VF = []; beam.VLLr = []; beam.VFr = [];
  for (let e = 0; e < N - 1; e++) { const A = sec(e, e), S = isSup[e + 1] ? sec(e, e + 1) : A; beam.VLL.push(S[0]); beam.VF.push(S[1]); beam.VLLr.push(A[0]); beam.VFr.push(A[1]); }
  FE_CACHE.set(key, beam); if (FE_CACHE.size > 24) FE_CACHE.delete(FE_CACHE.keys().next().value);
  return beam;
}
/* Influence-line ordinates on the 1-ft load grid (beam.gi), zero-padded so the sweeps need no bounds checks.
   cut (shear rows, LL2): { e, m } = the influence line of element e with its unit jump at node m (m = e: the section just right of
   node e; m = e + 1: just left of node e+1). Smooth part S_j = row_j - [j > e]; a load beyond x_m adds 1. An axle exactly at x_m is
   taken on the side that gives the extreme: vP (maxima) counts it beyond the section, vN (minima) before it. No cut: vP = vN = row.
   f(a, up): the same ordinate at any position a, for an axle placed exactly at the section when x_m is not on the 1-ft grid. */
function sgILGrid(beam, row, cut) {
  const { G, gi, N, xs, Ltot } = beam, PAD = 96, n = G + 1 + 2 * PAD, src = cut ? Float64Array.from(row, (v, j) => v - (j > cut.e ? 1 : 0)) : row;
  const c = cut ? xs[cut.m] : 0, vP = new Float64Array(n), vN = cut ? new Float64Array(n) : vP;
  for (let g = 0; g <= G; g++) { const [e, t, on] = gi[g]; if (!on) continue; const s = src[e] * (1 - t) + src[e + 1] * t;
    if (!cut) vP[g + PAD] = s; else { vP[g + PAD] = s + (g >= c - 1e-6 ? 1 : 0); vN[g + PAD] = s + (g > c + 1e-6 ? 1 : 0); } }
  const f = (a, up) => { if (a < -1e-9 || a > Ltot + 1e-9) return 0; let lo = 0, hi = N - 1; while (hi - lo > 1) { const md = (lo + hi) >> 1; if (xs[md] <= a) lo = md; else hi = md; }
    const t = Math.max(0, Math.min(1, (a - xs[lo]) / (xs[hi] - xs[lo]))), s = src[lo] * (1 - t) + src[hi] * t; return s + (up ? (a >= c - 1e-6 ? 1 : 0) : (a > c + 1e-6 ? 1 : 0)); };
  return { PAD, vP, vN, src, c, f };
}
/* HL-93 envelopes of one influence line (per lane, no DF; truck and tandem stored without IM).
   LL3 (2026-10-14), 3.6.1.3.1: axles that do not contribute to the extreme force effect are neglected, so a maximum sums only the
   positive axle effects (P) and a minimum only the negative ones (M) (truck, tandem, and each truck of the 90% two-truck case).
   The live load deflection rows (3.6.1.3.2) use the same rule (LL8, engineer's decision 2026-10-14). cut: shear rows (LL2), see sgILGrid. */
function sgLLRow(beam, row, cut) {
  const { G, trib, N, xs } = beam, I = sgILGrid(beam, row, cut), PAD = I.PAD;
  const P = I.vP.map(x => x > 0 ? x : 0), M = I.vN.map(x => x < 0 ? x : 0);
  let tMax = 0, tMin = 0, dMax = 0, dMin = 0, sMax = 14, sMin = 14;
  for (let s = 14; s <= 30; s++) for (let q = -44 + PAD; q <= G + PAD; q++) {   // rear axle spacing 14 to 30 ft in 1-ft steps (3.6.1.2.2), both directions
    const r1 = 32 * P[q] + 32 * P[q + s] + 8 * P[q + s + 14];       // front axle toward +x
    const r2 = 8 * P[q] + 32 * P[q + 14] + 32 * P[q + 14 + s];      // front axle toward -x
    const n1 = 32 * M[q] + 32 * M[q + s] + 8 * M[q + s + 14], n2 = 8 * M[q] + 32 * M[q + 14] + 32 * M[q + 14 + s];
    const hi = Math.max(r1, r2), lo = Math.min(n1, n2); if (hi > tMax) { tMax = hi; sMax = s; } if (lo < tMin) { tMin = lo; sMin = s; }
  }
  for (let q = -4 + PAD; q <= G + PAD; q++) { dMax = Math.max(dMax, 25 * P[q] + 25 * P[q + 4]); dMin = Math.min(dMin, 25 * M[q] + 25 * M[q + 4]); }
  if (cut) {   // an axle exactly at the section, on either side of the jump (needed when the section is not on the 1-ft grid)
    const sum = (Q, q0, up) => Q.reduce((t, [w, o]) => { const v = w * I.f(q0 + o, up); return t + ((up ? v > 0 : v < 0) ? v : 0); }, 0);
    for (let s = 14; s <= 30; s++) for (const Q of [[[32, 0], [32, s], [8, s + 14]], [[8, 0], [32, 14], [32, 14 + s]]]) for (const [, o] of Q) {
      const hi = sum(Q, I.c - o, true), lo = sum(Q, I.c - o, false); if (hi > tMax) { tMax = hi; sMax = s; } if (lo < tMin) { tMin = lo; sMin = s; } }
    for (const o of [0, 4]) { const Q = [[25, 0], [25, 4]]; dMax = Math.max(dMax, sum(Q, I.c - o, true)); dMin = Math.min(dMin, sum(Q, I.c - o, false)); }
  }
  // two design trucks (14 ft), min 50 ft between lead axle of one and rear axle of the other
  let two = 0, twoX = 0;
  for (const dir of [0, 1]) {
    const tn = [], tp = []; for (let q = -28 + PAD; q <= G + PAD; q++) {
      tn.push(dir ? 32 * M[q] + 32 * M[q + 14] + 8 * M[q + 28] : 8 * M[q] + 32 * M[q + 14] + 32 * M[q + 28]);
      tp.push(dir ? 32 * P[q] + 32 * P[q + 14] + 8 * P[q + 28] : 8 * P[q] + 32 * P[q + 14] + 32 * P[q + 28]); }
    let pm = Infinity, px = -Infinity;
    for (let k = 0; k < tn.length; k++) { if (k - 78 >= 0) { pm = Math.min(pm, tn[k - 78]); px = Math.max(px, tp[k - 78]); } if (pm < Infinity) { two = Math.min(two, tn[k] + pm); twoX = Math.max(twoX, tp[k] + px); } }
  }
  let lp = 0, ln = 0;
  if (!cut) for (let j = 0; j < N; j++) { const a = row[j] * trib[j] * 0.64; if (a > 0) lp += a; else ln += a; }
  else for (let j = 0; j < N - 1; j++) {   // lane on a shear influence line: element by element, jump at node m, exact positive and negative parts
    const h = xs[j + 1] - xs[j], k = j >= cut.m ? 1 : 0, a0 = I.src[j] + k, a1 = I.src[j + 1] + k;
    if (a0 >= 0 && a1 >= 0) lp += 0.32 * h * (a0 + a1); else if (a0 <= 0 && a1 <= 0) ln += 0.32 * h * (a0 + a1);
    else { const p = Math.max(a0, a1), m = Math.min(a0, a1), z = h / (p - m); lp += 0.32 * z * p * p; ln -= 0.32 * z * m * m; }
  }
  return { pos: 1.33 * Math.max(tMax, dMax) + lp, neg: 1.33 * Math.min(tMin, dMin) + ln, neg2: 0.9 * (1.33 * two + ln), pos2: 0.9 * (1.33 * twoX + lp), twoMax: twoX,
           truckMax: tMax, truckMin: tMin, tanMax: dMax, tanMin: dMin, lanePos: lp, laneNeg: ln, twoMin: two, sMax, sMin };
}

/* fatigue truck (3.6.1.4.1): 8, 32, 32 kip at 14 ft and 30 ft, IM = 15%, one lane. LL1 (2026-10-14): "one design truck or axles
   thereof", so axles that do not contribute to the extreme are neglected (as 3.6.1.3.1): a maximum sums only the positive axle
   effects (P), a minimum only the negative ones (M). cut: shear rows (LL2), see sgILGrid. */
function sgFatRow(beam, row, cut) {
  const { G } = beam, I = sgILGrid(beam, row, cut), PAD = I.PAD, P = I.vP.map(x => x > 0 ? x : 0), M = I.vN.map(x => x < 0 ? x : 0);
  let mx = 0, mn = 0;
  for (let q = -44 + PAD; q <= G + PAD; q++) {
    const r1 = 32 * P[q] + 32 * P[q + 30] + 8 * P[q + 44], r2 = 8 * P[q] + 32 * P[q + 14] + 32 * P[q + 44];
    const n1 = 32 * M[q] + 32 * M[q + 30] + 8 * M[q + 44], n2 = 8 * M[q] + 32 * M[q + 14] + 32 * M[q + 44];
    mx = Math.max(mx, r1, r2); mn = Math.min(mn, n1, n2);
  }
  if (cut) for (const Q of [[[32, 0], [32, 30], [8, 44]], [[8, 0], [32, 14], [32, 44]]]) for (const [, o] of Q) {   // an axle exactly at the section
    let hi = 0, lo = 0; for (const [w, o2] of Q) { const a = w * I.f(I.c - o + o2, true), b = w * I.f(I.c - o + o2, false); hi += a > 0 ? a : 0; lo += b < 0 ? b : 0; } mx = Math.max(mx, hi); mn = Math.min(mn, lo); }
  return { max: 1.15 * mx, min: 1.15 * mn, rawMax: mx, rawMin: mn };
}
  /* ---- end of the copy from Steel Bridge Design.html ---- */
  PBD.sgBeam = sgBeam; PBD.sgLLRow = sgLLRow;

  /* Three-moment equation (Clapeyron), prismatic beam continuous over supports 0..n, end supports pinned (M = 0).
     phiL[k], phiR[k]: EI × the free end rotations of span k as a simple span, + when the span sags (uniform load w:
     w L³/24 at each end; imposed uniform curvature κ: EI κ L/2 at each end). For support k (span k−1 on its left, span k
     on its right): M(k−1) L(k−1) + 2 M(k) (L(k−1) + L(k)) + M(k+1) L(k) = −6 [phiR(k−1) + phiL(k)].
     Returns the support moments M[0..n] (+ = sagging), units of phi / length. */
  PBD.threeMoment = function (spans, phiL, phiR) {
    var n = spans.length, M = [], k, i;
    for (k = 0; k <= n; k++) M.push(0);
    if (n < 2) return M;
    var m = n - 1, a = [], b = [], c = [], d = [];
    for (k = 1; k <= m; k++) { a.push(spans[k - 1]); b.push(2 * (spans[k - 1] + spans[k])); c.push(spans[k]); d.push(-6 * (phiR[k - 1] + phiL[k])); }
    for (i = 1; i < m; i++) { var w = a[i] / b[i - 1]; b[i] -= w * c[i - 1]; d[i] -= w * d[i - 1]; }   // tridiagonal (Thomas)
    var x = []; x[m - 1] = d[m - 1] / b[m - 1];
    for (i = m - 2; i >= 0; i--) x[i] = (d[i] - c[i] * x[i + 1]) / b[i];
    for (k = 1; k <= m; k++) M[k] = x[k - 1];
    return M;
  };

  /* Composite-stage analysis of span s (1-based) of the continuous unit `spans` (ft): constant EI (one composite girder
     section in every span), pinned supports. Dead load: a unit uniform load (1 klf) on all spans, support moments by the
     three-moment equation (M_A, M_B at the ends of span s), so M_w(x) = x(L − x)/2 + M_A(1 − x/L) + M_B x/L and
     V_w(x) = L/2 − x + (M_B − M_A)/L (k-ft and kip per klf). Live load: sgBeam's influence lines and HL-93 envelopes per
     lane with IM (3.6.1.2, 3.6.1.3; truck, tandem, lane; 90 % of two trucks plus the lane, 3.6.1.3.1, used for the
     negative moment between the points of contraflexure of the uniform load on all spans, i.e. where M_w < 0).
     Every node of the span is returned (about 1 ft apart); at(x, key) interpolates linearly. */
  PBD.contFE = function (spans, s) {
    var n = spans.length, beam = sgBeam(spans, false), L = spans[s - 1];
    var i0 = beam.sup[s - 1], i1 = beam.sup[s], x0 = beam.xs[i0];
    var phi = spans.map(function (Lk) { return Lk * Lk * Lk / 24; });
    var Mw1 = PBD.threeMoment(spans, phi, phi), MA = Mw1[s - 1], MB = Mw1[s];
    var nodes = [];
    for (var i = i0; i <= i1; i++) {
      var x = beam.xs[i] - x0, ll = beam.MLL[i], Mw = x * (L - x) / 2 + MA * (1 - x / L) + MB * x / L;
      var two = Mw < 0 && ll.neg2 < ll.neg, v = i < i1 ? beam.VLLr[i] : beam.VLL[i - 1];   // shear just right of the node (just left at the right support)
      nodes.push({ x: x, Mw: Mw, Vw: L / 2 - x + (MB - MA) / L, Mp: ll.pos, Mn: two ? ll.neg2 : ll.neg, two: two, Vp: v.pos, Vn: v.neg, ll: ll });
    }
    var at = function (x, key) {
      if (x <= nodes[0].x) return nodes[0][key];
      for (var j = 1; j < nodes.length; j++) if (x <= nodes[j].x + 1e-12) { var p = nodes[j - 1], q = nodes[j], t = (x - p.x) / Math.max(q.x - p.x, 1e-12); return p[key] + (q[key] - p[key]) * t; }
      return nodes[nodes.length - 1][key];
    };
    var mid = nodes.reduce(function (b, q) { return Math.abs(q.x - L / 2) < Math.abs(b.x - L / 2) ? q : b; }, nodes[0]);
    return { spans: spans.slice(), s: s, n: n, L: L, x0: x0, MA: MA, MB: MB, Mw1: Mw1, nodes: nodes, at: at, mid: mid,
             Mw: function (x) { return x * (L - x) / 2 + MA * (1 - x / L) + MB * x / L; }, Vw: function (x) { return L / 2 - x + (MB - MA) / L; },
             pierL: s > 1, pierR: s < n, endL: nodes[0], endR: nodes[nodes.length - 1], nEl: beam.N - 1 };
  };

  /* Restraint moments at the supports of the continuous unit (AASHTO LRFD 10th Ed. C5.12.3.3.2, initial strain method).
     o: { spans (ft), s (this span), wg, wdk (klf: girder and deck weight on the non-composite girder), phiPsL, phiPsR (k-ft²:
     −∫ P_i e (1 − x/L) dx and −∫ P_i e x/L dx over this span, the prestress as an imposed hogging curvature EIκ = −P_i e),
     d1, d2 (δ1, δ2), kSh (k-ft: EIκ of the differential shrinkage after continuity, + sagging: N_d e_d − N_g e_g) }.
     Every span of the unit is taken with this girder: w per foot as given; the prestress rotations scale with the span
     length (the same profile in fractions of the span). Each part is the support moment of a continuous beam (k-ft, + =
     sagging): M_g, M_dk (uniform load), M_ps (prestress), as if continuous when the load was applied; M_rc =
     δ1 (M_g + M_ps) + δ2 M_dk; M_sh (differential shrinkage: imposed uniform curvature kSh / EI; EI-free). M_res = M_rc + M_sh. */
  PBD.restraint = function (o) {
    var sp = o.spans;
    var uni = function (w) { var p = sp.map(function (L) { return w * L * L * L / 24; }); return PBD.threeMoment(sp, p, p); };
    var Mg = uni(o.wg), Mdk = uni(o.wdk), Ls = sp[o.s - 1];
    var Mps = PBD.threeMoment(sp, sp.map(function (L) { return o.phiPsL * L / Ls; }), sp.map(function (L) { return o.phiPsR * L / Ls; }));
    var sh = sp.map(function (L) { return o.kSh * L / 2; }), Msh = PBD.threeMoment(sp, sh, sh);
    var Mrc = Mg.map(function (v, k) { return o.d1 * (Mg[k] + Mps[k]) + o.d2 * Mdk[k]; });
    return { Mg: Mg, Mdk: Mdk, Mps: Mps, Msh: Msh, Mrc: Mrc, Mres: Mrc.map(function (v, k) { return v + Msh[k]; }) };
  };
})();

/* ═══ Owner (DOT) profile — PBD-E (2026-10-22) ════════════════════════════════════════════════════════════
   OWN_RULES has the format of Steel Bridge Design's OWN_RULES (CLAUDE.md §3: copied, kept duplicated) and
   ownRule() is the same function: the owner's rule with an id. Per rule: owner, id, kind ('default': an
   input default — key = the input path, value, show = the value as shown, lbl = the input; 'shall-check': a
   pass/fail check; 'should-warning': a warning; 'load': a load modifier — value.f, value.q = the question of
   the owner's yes/no input, value.fixed = no input; 'report': a requirement reported, not designed), sec
   (manual section), value, where (what applies it), text (a short paraphrase; no manual text reproduced).
   The owner is bridge-level (inputs.owner, 'AASHTO' when absent) and AASHTO has no rule: every AASHTO result
   is computed exactly as before.
   ══════════════════════════════════════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';
  var PBD = window.PBD = window.PBD || {};
  PBD.OWN_LIST = ['RIDOT', 'MassDOT', 'CTDOT', 'AASHTO'];
  var OWN_RULES = PBD.OWN_RULES = {
    v: 1,
    note: 'The MassDOT LRFD Bridge Manual and the CTDOT BRSDM are written to AASHTO LRFD 9th Ed. (the RIDOT BDM, April 2026, to the 10th Ed.); this tool applies AASHTO LRFD 10th Ed. (2024) with the owner rules on top.',
    owners: {
      RIDOT: { manual: 'RIDOT Bridge Design Manual (April 2026)', short: 'RIDOT BDM', aashto: '10th Ed.' },
      MassDOT: { manual: 'MassDOT LRFD Bridge Manual, Part I (Hundredth Anniversary Ed.)', short: 'MassDOT Bridge Manual Part I', aashto: '9th Ed.' },
      CTDOT: { manual: 'CTDOT Bridge and Roadway Structures Design Manual (BRSDM), Release 1', short: 'CTDOT BRSDM', aashto: '9th Ed.' },
      AASHTO: { manual: 'AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024)', short: 'AASHTO LRFD', aashto: '10th Ed.', none: true }
    },
    rules: [
      // ---- Service III tension limit (input default: corrosion exposure) ----
      { owner: 'RIDOT', id: 'srv.corr', kind: 'default', key: 'opt.corrosion', value: 'severe', lbl: 'Corrosion exposure (Service III tension limit)', show: 'Severe: 0.0948√f′c ≤ 0.3 ksi', sec: '5.6.2',
        where: 'Service III tension limit: checks "Srv III tens" and "Srv tens (top)", Service III load rating', text: 'All new prestressed concrete beam designs comply with the AASHTO stress limits for severe corrosive conditions' },
      { owner: 'CTDOT', id: 'srv.corr', kind: 'default', key: 'opt.corrosion', value: 'severe', lbl: 'Corrosion exposure (Service III tension limit)', show: 'Severe: 0.0948√f′c ≤ 0.3 ksi', sec: 'V2 5.9.2.3.1b',
        where: 'Service III tension limit: checks "Srv III tens" and "Srv tens (top)", Service III load rating', text: 'Tensile stress limits at the Service III limit state after losses based on members subjected to severe corrosive conditions (de-icing materials)' },
      { owner: 'MassDOT', id: 'srv.corr', kind: 'default', key: 'opt.corrosion', value: 'severe', lbl: 'Service III tension limit', show: '0.0948√f′c (severe exposure setting)', sec: '3.7.3.2',
        where: 'Service III tension limit: checks "Srv III tens" and "Srv tens (top)", Service III load rating', text: 'No more than 0.0948√f′c ksi tension in the precompressed tensile zone at Service III after all losses; up to 0.19√f′c only when the next larger beam is the only way to reduce the tension and the structure depth is critical, and then with a Service III live load factor of 1.0' },
      { owner: 'MassDOT', id: 'srv.relax', kind: 'should-warning', value: { gLL: 1.0 }, sec: '3.7.3.2',
        where: 'Warning when the 0.19√f′c limit (moderate exposure) is used with a Service III live load factor other than 1.0', text: 'The 0.19√f′c tension limit is used with γLL = 1.0 for Service III' },
      // ---- losses ----
      { owner: 'RIDOT', id: 'mat.H', kind: 'default', key: 'mat.H', value: 80, lbl: 'Relative humidity H', show: '80 %', sec: '5.6.1',
        where: 'Prestress losses (5.9.3), deck shrinkage gain, restraint moments', text: 'Prestress losses calculated with the AASHTO equations assuming a humidity of 80 percent' },
      // ---- load rules ----
      { owner: 'RIDOT', id: 'ld.mult', kind: 'default', key: 'opt.llMult', value: 1.2, lbl: 'Design load multiplier on HL-93 (LL+IM)', show: '1.2', sec: '3.4.1.2',
        where: 'LL+IM at Strength I (flexure, shear, interface shear, longitudinal reinforcement, pier negative moment) and Service I / III (stresses, deck); not the live load deflection, fatigue or load rating', text: 'All bridges designed with a Design Load Multiplier of 1.2 at the Strength and Service limit states (HL-93 × multiplier); the live load for deflection checks and the design check load rating are without it' },
      { owner: 'RIDOT', id: 'ld.etaD', kind: 'load', sec: '1.3.1', value: { f: 1.0, fixed: true }, where: 'Strength I load modifier η', text: 'η_D = 1.00 at all limit states; nonductile components and connections are not used' },
      { owner: 'RIDOT', id: 'ld.etaR', kind: 'load', sec: '1.3.2', value: { f: 1.05, q: 'Nonredundant member (NSTM)' }, where: 'Strength I load modifier η', text: 'η_R = 1.05 for nonredundant members, Strength limit state; 1.00 for load-path redundant structures' },
      { owner: 'RIDOT', id: 'ld.etaI', kind: 'load', sec: '1.3.3', value: { f: 1.05, q: 'ADT of 5000 or greater' }, where: 'Strength I load modifier η', text: 'η_I = 1.05 for bridges with an ADT of 5000 or greater, Strength limit state; 1.00 otherwise' },
      { owner: 'MassDOT', id: 'ld.etaD', kind: 'load', sec: '3.1.4.4', value: { f: 1.05, q: 'Nonductile component or connection' }, where: 'Strength I load modifier η', text: 'η_D = 1.05 for nonductile components and connections; 1.0 for all others' },
      { owner: 'MassDOT', id: 'ld.etaR', kind: 'load', sec: '3.1.4.4', value: { f: 1.05, q: 'Nonredundant member' }, where: 'Strength I load modifier η', text: 'η_R = 1.05 for nonredundant members; 1.0 for all others' },
      { owner: 'MassDOT', id: 'ld.etaI', kind: 'load', sec: '3.1.4.4, 3.1.2', value: { f: 1.05, q: 'Critical or essential bridge (3.1.2)' }, where: 'Strength I load modifier η', text: 'η_I = 1.05 for critical or essential bridges; 1.0 for all others' },
      { owner: 'CTDOT', id: 'ld.etaD', kind: 'load', sec: 'V2 1.3.3', value: { f: 1.05, q: 'Nonductile component or connection' }, where: 'Strength I load modifier η', text: 'η_D ≥ 1.05 for nonductile components and connections (1.05 used); 1.00 otherwise' },
      { owner: 'CTDOT', id: 'ld.etaR', kind: 'load', sec: 'V2 1.3.4', value: { f: 1.05, q: 'Nonredundant member' }, where: 'Strength I load modifier η', text: 'η_R ≥ 1.05 for nonredundant members (1.05 used); 1.00 otherwise' },
      { owner: 'CTDOT', id: 'ld.etaI', kind: 'load', sec: 'V2 1.3.5', value: { f: 1.05, q: 'Critical or essential bridge (on or over an NHS route or an emergency evacuation route)' }, where: 'Strength I load modifier η', text: 'η_I ≥ 1.05 for critical or essential bridges (1.05 used); 1.00 for all other bridges' },
      // ---- strands ----
      { owner: 'MassDOT', id: 'hd.max', kind: 'shall-check', nm: 'Hold-down force (MassDOT 3.7.2.2)', value: 0.75, sec: '3.7.2.2', where: 'Check "Hold-down force (MassDOT 3.7.2.2)" (draped strands only)',
        text: 'Where draped strands are used, the total hold-down force of all draped strands for each beam shall not exceed 75% of the total beam weight' },
      { owner: 'CTDOT', id: 'hd.max', kind: 'shall-check', nm: 'Hold-down force (CTDOT 5.9.1.6)', value: 0.75, sec: 'V2 5.9.1.6', where: 'Check "Hold-down force (CTDOT 5.9.1.6)" (draped strands only)',
        text: 'The total hold-down force of all draped strands for each member shall not exceed 75% of the total weight of the member' },
      { owner: 'CTDOT', id: 'db.max', kind: 'shall-check', nm: 'Debonded strands (CTDOT 5.9.4.3.3)', value: 0.25, sec: 'V2 5.9.4.3.3', where: 'Check "Debonded strands (CTDOT 5.9.4.3.3)" (when strands are debonded)',
        text: 'No more than 25% of the total number of strands may be debonded' },
      // ---- concrete strengths ----
      { owner: 'RIDOT', id: 'fc.min', kind: 'shall-check', nm: 'Girder f′c (RIDOT 5.2.1)', value: { min: 5.0 }, sec: '5.2.1', where: 'Check "Girder f′c (RIDOT 5.2.1)"', text: 'Precast prestressed concrete: specified minimum compressive strength 5000 psi' },
      { owner: 'RIDOT', id: 'fc.max', kind: 'should-warning', value: { max: 8.0 }, sec: '5.2.1', where: 'Warning above 8.0 ksi', text: 'Strengths up to 8000 psi may be specified; higher needs State Bridge Engineer approval' },
      { owner: 'RIDOT', id: 'fci.max', kind: 'should-warning', value: { max: 0.70 }, sec: '5.6.1', where: 'Warning when f′ci > 0.70 f′c', text: 'Strength at transfer from the stress calculations, limited to approximately 70 percent of the final design strength' },
      { owner: 'MassDOT', id: 'fci.max', kind: 'shall-check', nm: 'Release strength f′ci (MassDOT 3.7.2.1)', value: { max: 0.80 }, sec: '3.7.2.1', where: 'Check "Release strength f′ci (MassDOT 3.7.2.1)"', text: 'Release strengths greater than 0.8 f′c shall not be used' },
      { owner: 'MassDOT', id: 'fc.std', kind: 'should-warning', value: { std: [6.5, 8.0], fci65: 4.5, next: { fc: 8.0, fci: 6.0 } }, sec: '3.7.2.1', where: 'Warnings on the girder f′c and f′ci',
        text: 'Deck, box, NEBT and NEDBT beams: f′c 6500 psi (8000 psi only to avoid a deeper beam; other strengths discouraged), f′ci generally 4500 psi with 6500 psi; NEXT F and NEXT D beams: f′c 8000 psi, f′ci 6000 psi' },
      { owner: 'CTDOT', id: 'fc.range', kind: 'shall-check', nm: 'Girder f′c (CTDOT 5.9.1.2)', value: { min: 6.0, max: 10.0 }, sec: 'V2 5.9.1.2', where: 'Check "Girder f′c (CTDOT 5.9.1.2)"', text: 'Design compressive strength of prestressed members between 6.0 and 10.0 ksi' },
      { owner: 'CTDOT', id: 'fci.range', kind: 'shall-check', nm: 'Release strength f′ci (CTDOT 5.9.1.2)', value: { min: 0.70, max: 0.80, cap: 6.5 }, sec: 'V2 5.9.1.2', where: 'Check "Release strength f′ci (CTDOT 5.9.1.2)"', text: 'f′ci between 0.70 f′c and 0.80 f′c, and not greater than 6.5 ksi' },
      // ---- live load deflection ----
      { owner: 'MassDOT', id: 'defl.ll', kind: 'shall-check', value: { sw: 1000, max: 800, pref: 1000, intOnly: true }, sec: '3.5.6.1', where: 'Check "LL deflection" (interior girder): L/1000 with sidewalks, else L/800 and a warning above L/1000',
        text: '(LL+IM) deflection not greater than L/1000 for all bridges with sidewalks; without sidewalks preferably L/1000 and under no circumstances greater than L/800; applied to the typical interior beam only' },
      // ---- continuity (simple spans made continuous) ----
      { owner: 'MassDOT', id: 'cont.restr', kind: 'default', key: 'cont.restraint', value: false, lbl: 'Restraint moments (continuity)', show: 'Off: neglected', sec: '3.5.1.8',
        where: 'Continuity card: restraint moments (C5.12.3.3.2)', text: 'Simple-span prestressed beams made continuous for live load are designed per AASHTO 5.12.3.3; for the standard beams the design for end restraint moment can be neglected (bottom strands extended as detailed)' },
      { owner: 'RIDOT', id: 'cont.restr', kind: 'default', key: 'cont.restraint', value: false, lbl: 'Restraint moments (continuity)', show: 'Off: zero at a girder age of 90 days or more', sec: '5.6.3.3',
        where: 'Continuity card: restraint moments (C5.12.3.3.2)', text: 'With a minimum girder age of 90 days before the continuity diaphragms and deck are placed, the positive restraint moments from girder creep and shrinkage and deck slab shrinkage may be taken as zero; no restraint moment calculation is required' },
      { owner: 'RIDOT', id: 'cont.age', kind: 'shall-check', nm: 'Girder age at continuity (RIDOT 5.6.3.3)', value: 90, sec: '5.6.3.3', where: 'Check "Girder age at continuity (RIDOT 5.6.3.3)" (continuity on): the deck / continuity age t_d of the Materials card',
        text: 'Minimum girder age before placing the continuity diaphragms and deck: 90 days, stated in the contract documents' },
      { owner: 'RIDOT', id: 'cont.pos', kind: 'report', value: 1.2, sec: '5.6.3.3', where: 'Owner requirements: the required φM_n of the positive moment connection (continuity on)',
        text: 'A positive moment connection with factored resistance φM_n not less than 1.2 M_cr; the deck reinforcement resists the negative design moments at the strength limit state' },
      { owner: 'CTDOT', id: 'cont.simple', kind: 'default', key: 'cont.on', value: false, lbl: 'Continuity for live load and SIDL', show: 'Off: simple spans with a continuous deck', sec: 'V2 5.12.1.1CT',
        where: 'Continuity card', text: 'On multi-span structures of simple spans the deck is made continuous over the piers with no positive moment connection, wherever practical; the supporting members are designed as simple spans' }
    ]
  };
  /* The owner's rule with this id (Steel Bridge Design's ownRule, same body). */
  var ownRule = PBD.ownRule = function (o, id) { return (OWN_RULES ? OWN_RULES.rules.find(function (r) { return r.owner === o && r.id === id; }) : null) || null; };
  PBD.ownRules = function (o) { return OWN_RULES.rules.filter(function (r) { return r.owner === o; }); };
  PBD.ownCite = function (r) { return ((OWN_RULES.owners[r.owner] || {}).short || r.owner) + ' ' + r.sec; };
  PBD.ownerOf = function (inp) { var o = inp && inp.owner; return OWN_RULES.owners[o] ? o : 'AASHTO'; };

  function getK(o, k) { return k.split('.').reduce(function (a, p) { return a == null ? undefined : a[p]; }, o); }
  function setK(o, k, v) { var ps = k.split('.'), t = o; for (var i = 0; i < ps.length - 1; i++) { t[ps[i]] = Object.assign({}, t[ps[i]] || {}); t = t[ps[i]]; } t[ps[ps.length - 1]] = v; }
  function same(a, b) { return (typeof a === 'number' || typeof b === 'number') ? Math.abs(+a - +b) < 1e-9 : a === b; }
  PBD.getK = getK;
  /* Every input key an owner default can set. */
  function defKeys() { var ks = []; OWN_RULES.rules.forEach(function (r) { if (r.kind === 'default' && ks.indexOf(r.key) < 0) ks.push(r.key); }); return ks; }
  /* The value an input has by default under owner o: the owner's default, else the tool's default (DEF). */
  PBD.ownDefault = function (o, key, DEF) { var r = OWN_RULES.rules.find(function (q) { return q.owner === o && q.kind === 'default' && q.key === key; }); return r ? r.value : getK(DEF, key); };
  /* Change the owner. An input still at the previous owner's default (or the tool's default) is untouched and
     takes the new owner's default; a value the engineer entered is kept (and flagged as an override).
     The η questions are reset to "no" only where the new owner has no such question. Returns
     { inp, set:[{key, from, to}], kept:[{key, value, own}] }. */
  PBD.ownApply = function (inp, o, DEF) {
    var prev = PBD.ownerOf(inp), out = JSON.parse(JSON.stringify(inp)), set = [], kept = [];
    defKeys().forEach(function (k) {
      var cur = getK(out, k), was = PBD.ownDefault(prev, k, DEF), to = PBD.ownDefault(o, k, DEF);
      if (same(cur, was)) { if (!same(cur, to)) { setK(out, k, to); set.push({ key: k, from: cur, to: to }); } }
      else if (!same(cur, to)) kept.push({ key: k, value: cur, own: to });
    });
    out.owner = o;
    return { inp: out, set: set, kept: kept };
  };
  /* The owner's default inputs with their state on screen: [{ r, cur, own, over }] (over = the engineer's value). */
  PBD.ownDefaults = function (inp) { var o = PBD.ownerOf(inp);
    return OWN_RULES.rules.filter(function (r) { return r.owner === o && r.kind === 'default'; })
      .map(function (r) { var cur = getK(inp, r.key); return { r: r, cur: cur, own: r.value, over: !same(cur, r.value) }; }); };
  /* Load rules used by computeAll: η = η_D·η_R·η_I from the owner's questions (inputs opt.etaD/etaR/etaI, true
     when answered yes; a fixed owner value applies always), and the HL-93 design load multiplier. AASHTO: 1, 1. */
  PBD.ownLoads = function (inp) {
    var o = PBD.ownerOf(inp), opt = (inp && inp.opt) || {}, e = { D: 1, R: 1, I: 1 };
    ['D', 'R', 'I'].forEach(function (k) { var r = ownRule(o, 'ld.eta' + k); if (!r) return;
      e[k] = r.value.fixed ? r.value.f : (opt['eta' + k] === true ? r.value.f : 1); });
    var m = 1, rm = ownRule(o, 'ld.mult');
    if (rm) { var v = opt.llMult; m = (v === '' || v == null || !isFinite(+v) || +v <= 0) ? rm.value : +v; }
    return { owner: o, etaD: e.D, etaR: e.R, etaI: e.I, eta: e.D * e.R * e.I, mLL: m };
  };
})();
