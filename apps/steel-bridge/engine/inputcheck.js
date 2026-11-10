/* apps/steel-bridge/engine/inputcheck.js — every blocking input error of the project in one list (window.SBDInputCheck). Classic script, no DOM.
   SBINV (2026-11-10; engineer's decision 2026-11-09: "Invalid input should be highlighted so the user can fix; results should not be
   displayed"). The page (index.html) asks collect(P) after every input change: while errors[] is not empty no output tab shows results.

   collect(P) -> { errors: [E], warnings: [E], key }   E = { path, msg, src, cell?, host? }
     path: the project field (e.g. xs.sidewalks.L.fenceX); the page finds the input tab and the field from it (index.html tabOf / fieldOf).
     src:  where the check lives: 'model' (engine/model.js validate), 'loads' (engine/loads.js compute: its own input checks, message by
           message given the field they are about), 'analysis', 'stiffeners', 'crossframes', 'splices' (the input checks of those engines,
           repeated here with the engines' own messages, on the project's own entries), 'pending' (new checks, Decision pending engineer review).
     cell: the row of a list input (span lengths, girder spacings, skews) the error is about, when known.
     host: the output tab that holds the field, for the few inputs that live on an output tab (Flexure f_ℓ, Constructibility f_ℓ, Rating φ,
           Welds inputs, Custom demand tables, demand source choices).
   Nothing is computed for a result here: the checks only read the inputs. No project field is written. The engines are unchanged and keep their
   own checks (a module still refuses its own results on its errors, as before). The result is cached by the project text. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const pd = v => { const L = window.SBDLoads; if (typeof v === 'number') return v; return L && L.parseDim ? L.parseDim(v) : (v == null || v === '' ? NaN : Number(v)); };   // GirderDetail parseDim (the engines' nm / num)
  const SIDE = { Left: 'L', Right: 'R' };
  // the input fields that are on an output tab (CLAUDE.md §6: they are fixed where they are entered)
  const DEMAND_TAB = { flex: 'flex', shear: 'shear', cn: 'cn', fat: 'fat', spl: 'spl', wt: 'wt', rt: 'rt' };
  function hostOf(path) {
    const p = String(path || ''), m = p.match(/^(?:custom|demandSrc)\.(\w+)/);
    if (m) return DEMAND_TAB[m[1]] || null;
    if (/^flexure\./.test(p)) return 'flex';
    if (/^constr\./.test(p)) return 'cn';
    if (/^rating\./.test(p)) return 'rt';
    if (/^welds\./.test(p)) return 'wt';
    return null;
  }

  /* ---------- the loads module (engine/loads.js compute): its messages, each given the field it is about ---------- */
  const EDGE_KEY = { 'the barrier width': 'bw', 'the barrier weight': 'bwt', 'the curb width': 'cw', 'the curb height': 'ch', 'the railing weight': 'rw', 'the railing load point': 'rp', 'the railing traffic face': 'rf', 'the edge to traffic face': 'face' };
  const DL_KEY = { swL: 'xs.sidewalks.L.w', swThkL: 'xs.sidewalks.L.t', swR: 'xs.sidewalks.R.w', swThkR: 'xs.sidewalks.R.t', medW: 'xs.median.w', medThk: 'xs.median.t', ped: 'xs.sidewalks.ped' };
  const ROW_F = { Description: 'name', 'Location from left deck edge': 'x', 'Line load': 'plf', Weight: 'psf', Thickness: 'thk', 'Unit weight': 'gam' };
  function loadsPath(msg, P) {
    const xs = P.xs || {}, opt = v => (v == null || v === '' || (typeof v === 'number' && isNaN(v))) ? null : pd(v);
    let m;
    if (/^Appurtenance concrete unit weight/.test(msg)) return 'xs.wcA';
    if ((m = msg.match(/^(Left|Right) sidewalk railing or fence: the weight/))) return `xs.sidewalks.${SIDE[m[1]]}.fence`;
    if ((m = msg.match(/^(Left|Right) sidewalk railing or fence: its position/))) return `xs.sidewalks.${SIDE[m[1]]}.fenceX`;
    if (/^Wearing surface by thickness/.test(msg)) { const w = xs.ws || {}; return opt(w.thk) > 0 ? 'xs.ws.gam' : 'xs.ws.thk'; }
    if (/^Gap between adjacent trucks/.test(msg)) return 'xs.lldf.gap';
    if ((m = msg.match(/^Dead load "(\w+)"/))) return DL_KEY[m[1]] || 'xs';
    if ((m = msg.match(/^(Left|Right) deck edge: (?:enter )?(the [a-z ]+?) (?:\(|must)/))) return `xs.edges.${SIDE[m[1]]}.${EDGE_KEY[m[2]] || 'type'}`;
    if ((m = msg.match(/^Override of "([^"]+)": (x|the line load)/))) return `xs.overrides.${m[1]}.${m[2] === 'x' ? 'x' : 'plf'}`;
    // a row of the added line loads (Added load i) or of the overlays (Overlay i): by its name, then the field of the message
    const rows = [['xs.extra', xs.extra, 'Added load'], ['xs.overlays', xs.overlays, 'Overlay']];
    for (const [base, list, lbl] of rows) {
      const L = Array.isArray(list) ? list : [];
      for (let i = 0; i < L.length; i++) {
        const name = (L[i] && L[i].name) || `${lbl} ${i + 1}`;
        if (msg.indexOf(name + ': ') !== 0) continue;
        const f = (m = msg.slice(name.length + 2).match(/^"([^"]+)"/)) ? ROW_F[m[1]] : null;
        if (f) return `${base}.${i}.${f}`;
        if (/enter its weight in psf/.test(msg)) return `${base}.${i}.psf`;
        if (/positive thickness and unit weight/.test(msg)) return `${base}.${i}.${opt(L[i].thk) > 0 ? 'gam' : 'thk'}`;
        return `${base}.${i}`;
      }
    }
    return null;
  }
  function loadsErrors(P, add, modelPaths) {
    const LD = window.SBDLoads; if (!LD || !window.SBDLldf || !window.SBDOwners || !window.SBDModel || !(P.girders || []).length) return;
    let R;
    try { const q = LD.fromModel(P, { girder: 0 }); R = LD.compute(q.b, q.p); } catch (e) { return; }   // an exception: engine-internal, not an input error
    (R.errors || []).forEach(msg0 => { const msg = String(msg0);
      if (R.locked) { if (!modelPaths.size) add('loads', 'xs', msg); return; }   // "The bridge is incomplete …": the model checks name the fields
      const path = loadsPath(msg, P);
      if (path && modelPaths.has(path)) return;   // the same field, already in the model checks
      add('loads', path || 'xs', msg); });
  }

  /* ---------- the analysis settings (engine/analysis.js analyzeGirder, its three input checks) and the construction loads ---------- */
  function analysisErrors(P, add) {
    const AN = window.SBDAnalysis; if (!AN) return;
    const S = AN.settings(P), a = P.analysis || {};
    if (!(S.im >= 0)) add('analysis', 'analysis.im', 'Dynamic load allowance must be zero or positive.');
    if (!(S.imf >= 0)) add('analysis', 'analysis.imf', 'Dynamic load allowance must be zero or positive.');
    if (!(S.deflLimit > 0)) add('analysis', 'analysis.deflLimit', 'The live load deflection limit L/… must be positive.');
    if (!['none', '15', 'dl'].includes(S.crack)) add('analysis', 'analysis.crack', 'Cracked zones must be "none", "15" or "dl".');
    // Decision (pending engineer review): an entered q_CL below zero is not used (engine/analysis.js clOf takes the owner's or the 20 psf default
    // instead), and an entered finishing machine load below zero is not applied (fmOf): both would compute with a value the user did not choose.
    if (a.clCalc === true && a.qCL !== '' && a.qCL != null && !(isNum(+a.qCL) && +a.qCL >= 0)) add('pending', 'analysis.qCL', 'Construction live load q_CL must be zero or positive (blank: the owner\'s value or 20 psf).');
    const fm = a.fm || {}; if (fm.P !== '' && fm.P != null && !(isNum(+fm.P) && +fm.P >= 0)) add('pending', 'analysis.fm.P', 'Finishing machine load P_fm must be zero or positive (blank: none).');
  }

  /* ---------- stiffener types (engine/stiffeners.js transverse / bearing, the type checks the model does not repeat) ---------- */
  function stiffenerErrors(P, add) {
    const S = P.stiffeners; if (!S || typeof S !== 'object') return;
    const tt = (S.transverse || {}).types || {}, bt = (S.bearing || {}).types || {};
    Object.keys(tt).forEach(k => { const t = tt[k] || {};
      ['bt', 'tp', 'w', 'gap', 'wf', 'c', 'Fcp'].forEach(f => { if (!(pd(t[f]) >= 0)) add('stiffeners', `stiffeners.transverse.types.${k}.${f}`, `Type ${k}: "${f}" must be zero or positive.`); }); });
    Object.keys(bt).forEach(k => { const t = bt[k] || {}, np = +t.np, c = pd(t.c), sp = pd(t.sp), tp = pd(t.tp), b = pd(t.bt), lbl = `Type ${k} stiffener`, pp = `stiffeners.bearing.types.${k}`;
      if (!(Number.isInteger(np) && np >= 1 && np <= 3)) add('stiffeners', pp + '.np', `${lbl}: number of pairs must be 1, 2, or 3.`);
      if (!(c >= 0)) add('stiffeners', pp + '.c', `${lbl}: clip must be zero or positive.`);
      if (np > 1 && !(sp > tp)) add('stiffeners', pp + '.sp', `${lbl}: pair spacing must exceed the plate thickness.`);
      if (c >= b) add('stiffeners', pp + '.c', `${lbl}: clip must be smaller than the stiffener width.`); });
  }

  /* ---------- cross-frames (engine/crossframes.js compute: the checks of the entered members, connection and forces) ---------- */
  function crossframeErrors(P, add) {
    const CF = window.SBDCrossframes; if (!CF || !P.crossframes || typeof P.crossframes !== 'object') return;
    const c = Object.assign(CF.defaults(), P.crossframes);
    (CF.CF_MEM || []).forEach(([k, l]) => { const m = (c.mem || {})[k] || {};
      if (m.sec === 'custom') { const d = [pd(m.b1), pd(m.b2), pd(m.t)], bad = !(d[0] > 0) ? 'b1' : !(d[1] > 0) ? 'b2' : !(d[2] > 0 && d[2] < Math.min(d[0], d[1])) ? 't' : null;
        if (bad) add('crossframes', `crossframes.mem.${k}.${bad}`, `${l}: angle dimensions are invalid.`); }
      else if (!CF.ANGLES[m.sec]) add('crossframes', `crossframes.mem.${k}.sec`, `${l}: angle dimensions are invalid.`); });
    const C = c.conn || {}, n = +C.n;
    if (!(Number.isInteger(n) && n >= 1)) add('crossframes', 'crossframes.conn.n', 'Bolts per member end must be a whole number.');
    else if (n < 2) add('crossframes', 'crossframes.conn.n', 'Bolts per member end must be at least 2 (AASHTO LRFD 6.13.1; with one bolt the shear lag factor U is undefined).');
    ['s', 'e', 'tg'].forEach(k => { if (!(pd(C[k]) > 0)) add('crossframes', `crossframes.conn.${k}`, `Connection "${k}" must be positive.`); });
    if (!(pd(c.dMinXF) > 0)) add('crossframes', 'crossframes.dMinXF', 'The minimum girder depth for cross-frames must be positive.');
    ['StrI', 'Con'].forEach(g => ['top', 'bot', 'diag'].forEach(k => { if (!isFinite(pd(((c.user || {})[g] || {})[k]))) add('crossframes', `crossframes.user.${g}.${k}`, `User force ${g} ${k} must be a number.`); }));
  }

  /* ---------- entered splice plates (engine/splices.js compute: the plate and bolt checks), on the entries a station uses ---------- */
  function spliceErrors(P, add) {
    const Q = P.splices; if (!Q || !Array.isArray(Q.plates)) return;
    const xs = ((P.framing || {}).splices || []).map(Number).filter(isFinite), nG = (P.girders || []).length;
    Q.plates.forEach((q, i) => {
      if (!q || typeof q !== 'object') return;
      const k = xs.findIndex(x => Math.abs(+q.x - x) < 1e-6); if (k < 0 || (q.g != null && !(+q.g >= 0 && +q.g < nG))) return;   // an entry no station uses: not computed
      const who = `FS${k + 1} entry${q.g != null ? ` (G${+q.g + 1})` : ''}${Q.auto === false ? '' : ' (shown with Plates and bolts "Entered below")'}`, base = `splices.plates.${i}`;
      const has = (o, f) => o && o[f] !== undefined;
      ['top', 'bot'].forEach(fl => { const f = q[fl]; if (!f || typeof f !== 'object') return; const T = fl === 'top' ? 'Top' : 'Bottom';
        ['nl', 'nr'].forEach(z => { if (has(f, z) && !(Number.isInteger(+f[z]) && +f[z] >= 1)) add('splices', `${base}.${fl}.${z}`, `${who}: ${T} flange splice: "${z}" must be a whole number of at least 1.`); });
        ['g0', 'ef', 'ep', 'bo', 'to'].forEach(z => { if (has(f, z) && !(pd(f[z]) > 0)) add('splices', `${base}.${fl}.${z}`, `${who}: ${T} flange splice: "${z}" must be positive.`); });
        if (has(f, 'g') && +f.nl > 1 && !(pd(f.g) > 0)) add('splices', `${base}.${fl}.g`, `${who}: ${T} flange splice: gage g must be positive.`);
        if (has(f, 's') && +f.nr > 1 && !(pd(f.s) > 0)) add('splices', `${base}.${fl}.s`, `${who}: ${T} flange splice: pitch s must be positive.`);
        if (f.inner === true || f.inner === 'true') ['bi', 'ti'].forEach(z => { if (has(f, z) && !(pd(f[z]) > 0)) add('splices', `${base}.${fl}.${z}`, `${who}: ${T} flange splice: inner plate width and thickness must be positive.`); }); });
      const w = q.web; if (w && typeof w === 'object') {
        ['h', 't', 'sv', 'sh', 'ew', 'ewp'].forEach(z => { if (has(w, z) && !(pd(w[z]) > 0)) add('splices', `${base}.web.${z}`, `${who}: Web splice: "${z}" must be positive.`); });
        ['nr', 'nc'].forEach(z => { if (has(w, z) && !(Number.isInteger(+w[z]) && +w[z] >= 1)) add('splices', `${base}.web.${z}`, `${who}: Web splice: "${z}" must be a whole number of at least 1.`); });
        if (Number.isInteger(+w.nr) && Number.isInteger(+w.nc) && has(w, 'nr') && has(w, 'nc') && +w.nr * +w.nc < 2) add('splices', `${base}.web.nr`, `${who}: Web splice: at least two bolts are needed on each side of the splice (rows × columns ≥ 2); a one-bolt group has no polar moment of inertia.`);
      }
    });
  }

  /* the row of a list input an error is about (the model names the list only) */
  function cellOf(P, e) {
    const m = e.path.match(/^spans\.lengths\.(\d+)$/); if (m) return +m[1];
    const x = (P && P.xs) || {};
    if (e.path === 'xs.bays' && Array.isArray(x.bays)) { const r = e.msg.match(/^Girder spacing (\d+) /); if (r) return +r[1] - 1; }
    if (e.path === 'xs.skews' && Array.isArray(x.skews)) { const r = e.msg.match(/^Skew (\d+) /); if (r) return +r[1] - 1; }
    return null;
  }

  let last = { key: null, r: null };
  function collect(P) {
    let key; try { key = JSON.stringify(P); } catch (e) { key = null; }
    if (key != null && key === last.key) return last.r;
    const errors = [], warnings = [], seen = new Set();
    const add = (src, path, msg, o) => { const k = path + '|' + msg; if (seen.has(k)) return; seen.add(k); const e = { path, msg, src, ...(o || {}) }; const h = hostOf(path); if (h) e.host = h; errors.push(e); };
    const M = window.SBDModel;
    const v = M ? M.validate(P) : { errors: [], warnings: [] };
    v.errors.forEach(e => {
      if (e.path === 'demandSrc' && P.demandSrc && typeof P.demandSrc === 'object' && !Array.isArray(P.demandSrc)) {   // one entry per module choice (its own tab)
        Object.keys(P.demandSrc).forEach(k => { const s = P.demandSrc[k]; if (!['analysis', 'example', 'project', 'custom'].includes(s)) add('model', `demandSrc.${k}`, `Demand source (${k}): "${s}" is not one of analysis, example, project or custom.`); });
        return; }
      const c = cellOf(P, e); add('model', e.path, e.msg, c != null ? { cell: c } : null); });
    v.warnings.forEach(w => warnings.push({ path: w.path, msg: w.msg, src: 'model' }));
    if (P && typeof P === 'object' && P.spans && Array.isArray(P.girders)) {
      const modelPaths = new Set(errors.map(e => e.path));
      const guard = f => { try { f(); } catch (e) { /* a check that throws on a malformed project: the model checks above report it */ } };
      guard(() => loadsErrors(P, add, modelPaths));
      guard(() => analysisErrors(P, add));
      guard(() => stiffenerErrors(P, add));
      guard(() => crossframeErrors(P, add));
      guard(() => spliceErrors(P, add));
    }
    const r = { errors, warnings, key };
    last = { key, r };
    return r;
  }
  const blocked = P => collect(P).errors.length > 0;

  /* NOTE: the rule and its decisions as the user sees them (engineer rule 2026-11-10: every assumption or decision is noted in the app): the
     Project input tab, the blocked output view and the Report's Project section show this text */
  const NOTE = 'Input check: results are shown only while no blocking input error exists. While one exists, every output tab, the Report, the Drawings, '
    + 'the 3D view, the Substructure Loading send and Auto design are withheld and the errors are listed with links to their fields. Warnings (LLDF range, '
    + 'proportion limits, D/t_w > 150, N_b = 3, Auto design) do not block. A Custom demand table and the Constructibility bracket inputs are checked on their '
    + 'own tab (that module alone shows no results). An entered q_CL or finishing machine load below zero is a blocking input error.';
  window.SBDInputCheck = { collect, blocked, hostOf, loadsPath, NOTE };
})();
