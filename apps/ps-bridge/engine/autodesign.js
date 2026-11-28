/* apps/ps-bridge/engine/autodesign.js — Auto design: a search over the inputs of each girder type (window.PSBAutoDesign). Classic script, no DOM.
   Created 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item A; docs/ps-bridge-plan.md §4, engineer decisions PS-1, PS-5,
   PS-10 to PS-12; the Steel Bridge app's Auto design, apps/steel-bridge/engine/autodesign.js, is the pattern: settings, a generator run
   that the page steps in chunks, a ranked list of candidates that pass every check, Apply as one change of the project).

   NO NEW DESIGN FORMULA. Auto design only proposes INPUTS; every candidate is judged by the page's own engine call for every line of the
   girder type (PSBDesign.one = cellInputs with the candidate's inputs, then PSBHoldDown.compute = computeAll + the PS-10 check + the app's
   additions, exactly what the tabs, the check summary and the Summary use) and by the page's own input check (PSBInputCheck.collect: the
   strand fit of PS-28 / PS-39, the void clearance, the debond lengths). A candidate PASSES when the engine returns no error, every check of
   R.checks passes on every line of the type (the check summary's groups: stresses, fatigue, flexure, shear, end zone and hold-down, LL
   deflection, handling and deck when on, the owner limits) and the input check reports no strand-pattern error.

   The variables (each Auto or Lock, P.autodesign.vars; Lock keeps the entered value):
     section  the girder shape of the span (PS-8: every type of a span has one shape): the library sections of the owner's group and of the
              shape's family (sections()), lightest first (or shallowest first); a section property override (base.ovr.on) or a Custom
              shape locks it
     strands  the total strand count N and the straight rows: rows bottom-up on the section's row grid (PS-41 for MassDOT: 2.25 / 2.5 in,
              then every 2 in; else 2 in, then every 2 in), each row filled to its capacity in symmetric pairs (PS-12) before the next; the
              capacity of a row = the largest even count that fits (the input check's PS-28 rule); rows with a capacity below 4 are not used
     drape    the draped strands n_h = 0, 2, 4, … (rows of two at x = ±1 in, the drawn positions), at midspan directly above the top
              straight row (y_mid), at the girder end y_end = y_mid + 2 j on the grid, hold-down points at frac × L from ℄ bearing with frac
              in FRACS (0.33 to 0.45, PS-5)
     conc     f′c and f′ci on 0.5 ksi grids through the entered values (PS-11): f′c from the owner's minimum (AASHTO 4.0 ksi, 5.4.2.1;
              RIDOT 5.0; CTDOT 6.0; MassDOT 6.5, its standard) to the owner's maximum (AASHTO and CTDOT 10.0; RIDOT and MassDOT 8.0);
              f′ci ≤ f′c and within the owner's release limits (MassDOT ≤ 0.80 f′c; CTDOT 0.70 to 0.80 f′c and ≤ 6.5; RIDOT ≤ 0.70 f′c),
              from 4.0 ksi, and at most the plant's f′ci (setting); every limit editable in the settings
   Entered debonding is kept (PS-12: never added): row i (from the bottom) keeps the entered row i's debonded count (at most its count) and
   length.

   The choice (lexicographic; the first is the most important): section (the lighter: smaller gross area A, then h; or the shallower:
   smaller h, then A), then fewer strands N, then fewer draped strands n_h, then the lower hold-down force (the flatter drape:
   (y_end − y_mid) / frac, which orders F_hd = 2 n_h f_pbt A_b sin α exactly for one n_h), then frac nearest 0.40, then the lower f′c,
   then the lower f′ci. Ties keep the first in the search order (deterministic: no random step).

   The search for one girder type on one section (search()):
     1. the fewest straight strands N1 that pass Strength I flexure and Service III tension with no draped strand, at the highest f′c and
        f′ci (a lower bound: draped strands have a smaller eccentricity and a lower f′c a smaller capacity), by bisection on the count;
     2. N = N1, N1 + 2, …: for n_h = 0, 2, …: the drapes in the order of the choice above, each run until one passes; a drape whose
        hold-down force check fails ends the drapes of that n_h (a steeper one has a larger F_hd); the first passing (N, n_h, drape) is the
        strand pattern; N grows only while a trial at N failed on checks that more strands can improve (GROW) alone;
     3. at that pattern the lowest f′c that passes (with the highest f′ci it allows), then the lowest f′ci.
   One span (run()): its sections in the order of the choice; a section is a candidate when every girder type of the span (on all its lines)
   has a passing design on it; the first topN candidates are listed (the first is the proposal).
   Assumed (Decisions pending engineer review, fixlog/ps-bridge.md AD-D*): a higher f′c / f′ci is not worse for any check, more draped
   relief at the end is found by a higher y_end, and the checks in GROW are those more strands improve.

   Added 2026-11-28 (PSAD-A, engineer's choice of 2026-11-28, items 4 and 7; fixlog/ps-bridge.md PSAD-A):
     settings.mode      'new' (the search above; the default) or 'refine' (refine() below: the current section of each span kept, the design
                        nearest the entered one that passes, ranked by distance(): |ΔN|, |Δn_h|, the drape change, |Δf′c|, |Δf′ci|; the
                        entered design first when it passes; the list also holds the passing design with the fewest strands, so an
                        over-designed pattern is reduced)
     settings.maxRatio  the target ratio (default 1.00: the engine's pass, results unchanged): a candidate passes only when every check has
                        r ≤ maxRatio (+ the engine's 1e-4 tolerance), except the RULE checks (the confinement detailing, the LLDF range of
                        applicability, the hold-down force limit, the owners' f′c / f′ci / age / debonded-share rules), which must pass
                        (their own pass, as before); evalCand's govT is the governing check the target applies to.

   API
     DEF, FRACS, GROW, RULE, settings(P), family(name), sections(P, s, o), owners(P, k), conc(P, k, o)
     evalCand(P, k, eff, ctx, full)  -> { pass, fails: [names], gov: { n, r, g, loc }, govT (target < 1), lines: [{ g, R }] | null, err }
     refine(P, k, girder, o, ctx, log) generator -> as search(), with list (the designs listed, nearest first; each with dist, entered, fewest)
     run(P, o) generator (yields { i, n, msg } progress; returns the result), runSync(P, o)
     apply(P, Res, choice) -> { note } (writes the chosen candidates into the girder types' overrides; the page records it as one step)
   Nothing here is stored but by apply(); the result lives in the page's memory. */
(function () {
  'use strict';
  const isNum = v => typeof v === 'number' && isFinite(v);
  const J = o => JSON.parse(JSON.stringify(o));
  const R2 = v => Math.round(v * 1e6) / 1e6;
  const FRACS = [0.33, 0.34, 0.35, 0.36, 0.37, 0.38, 0.39, 0.40, 0.41, 0.42, 0.43, 0.44, 0.45];   // PS-5: 0.33 L to 0.45 L
  /* checks that more strands improve (step 2: N grows only while a trial failed on these alone) */
  const GROW = ['Flexure', 'Srv III tens', 'Min reinf', 'Shear', 'Long. reinf (5.7.3.5)', 'Fatigue I (strand)'];
  const HD = /^Hold-down force/;
  const DEF = { mode: 'new', objective: 'weight', topN: 3, maxRatio: 1.00, vars: { section: 'auto', strands: 'auto', drape: 'auto', conc: 'auto', nb: 'lock' },
    fcLo: '', fcHi: '', fciLo: 4.0, fciHi: '', maxRuns: 20000, nbMin: '', nbMax: '', sLo: '', sHi: '', pattern: 'draped' };
  /* PSAD-B (2026-11-28, item 1): the girder count N_b (vars.nb: 'lock' the current count, the default; 'auto' the current count ± 1 with the
     spacing within the limits; 'range' every count nbMin … nbMax). Each count is a full re-layout (layoutFor): equal spacing over the
     current exterior girder spacing W_cc = Σ bays, the overhangs kept (the app's equal-spacing rule, EQSP); the girder types re-assigned
     by PSBBridge.renumber; an entered b_eff back to the calculated width; the LLDF, DC2 / DW and every line value then follow from the
     page's own engine inputs of that layout. Spacing limits (Auto): the LLDF range of applicability 3.5 ≤ S ≤ 16 ft (Table 4.6.2.2.2b-1,
     engine/applicability.js), narrowed by sLo / sHi when entered. */
  const S_LO = 3.5, S_HI = 16.0;
  /* PSAD-A (2026-11-28, items 4 and 7): mode 'new' (the search above, the default) or 'refine' (refine(): the current section kept, the
     smallest change from the entered design); maxRatio (the target ratio, default 1.00 = the engine's own pass): a candidate passes only if
     the ratio of every check is at most maxRatio, except the RULE checks (rules of fact, not demand / capacity ratios), which must pass. */
  const RULE = /^(Confinement steel|LLDF range of applicability|Hold-down force|Girder f′c|Release strength f′ci|Girder age at continuity|Debonded strands)/;
  const TOL = 1e-4;   // the engine's own pass tolerance (r ≤ 1.0001), applied to the target the same way
  const num = (v, d) => (v === '' || v == null || !isFinite(+v)) ? d : +v;
  /* settings(P): the run's settings (P.autodesign, optional; absent = DEF) */
  function settings(P) {
    const a = (P && P.autodesign) || {}, v = Object.assign({}, DEF.vars, a.vars || {});
    Object.keys(v).forEach(k => { if (k === 'nb') { if (v[k] !== 'auto' && v[k] !== 'range') v[k] = 'lock'; } else if (v[k] !== 'lock') v[k] = 'auto'; });
    const mr = num(a.maxRatio, DEF.maxRatio);
    return { pattern: a.pattern === 'straight' || a.pattern === 'both' ? a.pattern : 'draped', mode: a.mode === 'refine' ? 'refine' : 'new', maxRatio: mr > 0 && mr < 1 ? R2(mr) : 1,
      objective: a.objective === 'depth' ? 'depth' : 'weight', topN: Math.max(1, Math.min(10, Math.round(num(a.topN, DEF.topN)))), vars: v,
      nbMin: num(a.nbMin, NaN), nbMax: num(a.nbMax, NaN), sLo: num(a.sLo, NaN), sHi: num(a.sHi, NaN),
      fcLo: num(a.fcLo, NaN), fcHi: num(a.fcHi, NaN), fciLo: num(a.fciLo, DEF.fciLo), fciHi: num(a.fciHi, NaN), maxRuns: Math.max(100, num(a.maxRuns, DEF.maxRuns)),
      fracs: FRACS.slice() };   // fracs: the hold-down positions searched (the tests' exhaustive case passes a shorter list; not a page setting)
  }

  /* ---------- the library sections searched ---------- */
  /* family(name): the shape family of a library section: 'I' (I-girders, bulb tees, NEBT, NEDBT), 'next', 'spread' (spread box), 'adj'
     (adjacent box), 'slab' (deck slabs, voided or solid), 'custom'; width: the nominal width of an adjacent member (in), else null */
  function family(name) {
    const G = typeof GIRDERS !== 'undefined' ? GIRDERS[name] : null; if (!G || G.custom || name === 'Custom') return { fam: 'custom', width: null };
    const SC = window.PSBSections, md = SC && Object.prototype.hasOwnProperty.call(SC.MD, name) ? SC.MD[name] : null;
    if (G.next) return { fam: md && md.src.fam === 'nextd' ? 'nextd' : 'next', width: null };   // NEXT D (the flange is the deck) apart from NEXT F
    if (md && md.src.fam === 'spread') return { fam: 'spread', width: null };
    if (G.box) return { fam: 'adj', width: +G.w };
    if (G.deck) return { fam: 'slab', width: +G.w };
    return { fam: md && md.src.fam === 'nedbt' ? 'dbt' : 'I', width: null };   // NEDBT (a deck bulb tee) apart from the I-girders and bulb tees
  }
  const isMD = name => { const SC = window.PSBSections; return !!(SC && Object.prototype.hasOwnProperty.call(SC.MD, name)); };
  /* sections(P, s, o): the sections searched for span s: { list: [{ name, A, h }], why } — the current shape of the span first decides the
     family; MassDOT projects: the MassDOT sections; any other owner: every other library section; of the same family, and for adjacent
     members (box beams, deck slabs) of the same nominal width (their width sets the girder lines). Locked, a Custom shape or a section
     property override: the current shape only. Sorted by the objective (A then h, or h then A; then the library order). A and h are the
     engine's girderGross of the span's first line. */
  function sections(P, s, o) {
    const BR = window.PSBBridge, ks = BR.spanTypes(P, s).filter(k => BR.typeLines(P, k).length); if (!ks.length) return { list: [], why: 'no girder type with a line' };
    const k0 = ks[0], b = BR.effBase(P, k0), cur = b.girder, f = family(cur);
    const one = name => { const inp = lineInputs(P, k0, BR.typeLines(P, k0)[0], Object.assign(J(b), { girder: name })); let A = NaN, h = NaN;
      try { const g = girderGross(inp); A = +g.A; h = +g.h; } catch (e) { /* not a shape the engine can compute: left out */ }
      return { name, A, h }; };
    let why = '';
    if (o.vars.section === 'lock') why = 'locked';
    else if (f.fam === 'custom') why = 'a Custom shape';
    else if (b.ovr && b.ovr.on) why = 'a section property override (Girders & strands tab)';
    if (why) return { list: [one(cur)], why: `the current section only (${why})` };
    const owner = window.PBD && window.PBD.ownerOf ? window.PBD.ownerOf(b) : 'AASHTO';
    const names = Object.keys(GIRDERS).filter(n => { if (n === cur) return true; const q = family(n); if (q.fam !== f.fam) return false;
      if (f.width != null && Math.abs(q.width - f.width) > 1e-9) return false;
      return owner === 'MassDOT' ? isMD(n) : !isMD(n); });
    const L = names.map(one).filter(q => isNum(q.A) && isNum(q.h)), ord = n => names.indexOf(n);
    L.sort((a, c) => o.objective === 'depth' ? (a.h - c.h || a.A - c.A || ord(a.name) - ord(c.name)) : (a.A - c.A || a.h - c.h || ord(a.name) - ord(c.name)));
    return { list: L, why: `${owner === 'MassDOT' ? 'the MassDOT sections' : 'the library sections other than MassDOT\'s'} of the ${({ I: 'I-girder and bulb tee', dbt: 'deck bulb tee', next: 'NEXT F', nextd: 'NEXT D', spread: 'spread box beam', adj: 'adjacent box beam', slab: 'deck slab' })[f.fam]} family${f.width != null ? `, ${f.width} in wide (the girder lines are set by the width)` : ''}` };
  }

  /* ---------- the engine calls (the page's own) ---------- */
  /* lineInputs(P, k, g, eff): the engine inputs of girder type k on line g with its inputs eff (= PSBDesign.cellInputs with eff for the type's
     effBase: the same code, engine/design.js one()) */
  function lineInputs(P, k, g, eff) {
    const T = window.PSBBridge.types(P)[k];
    return window.PSBDesign.one(Object.assign({}, P, { base: eff, design: { g, s: T.span }, types: undefined }));
  }
  /* fitErrors(P, k, eff): the input check's errors of the strand rows and draped strands of eff (the page's PSBInputCheck.collect on the
     type's first line and span, as the page checks a type) */
  function fitErrors(P, k, eff, ctx) {
    const BR = window.PSBBridge, T = BR.types(P)[k], g = BR.typeLines(P, k)[0];
    const key = JSON.stringify([eff.girder, eff.rows, eff.harp, g, T.span]);
    if (ctx && ctx.fit.has(key)) return ctx.fit.get(key);
    const Pv = Object.assign({}, P, { base: eff, types: undefined, design: { g, s: T.span } });
    const e = window.PSBInputCheck.collect(Pv).errors.filter(x => /^base\.(rows|harp)(\.|$)/.test(x.path)).map(x => x.msg);
    if (ctx) ctx.fit.set(key, e);
    return e;
  }
  function engineRun(inp, ctx) {
    const key = JSON.stringify(inp);
    if (ctx.cache.has(key)) return ctx.cache.get(key);
    let R; try { R = window.PSBHoldDown.compute(JSON.parse(key)); } catch (e) { R = { error: e.message }; }
    ctx.runs++; ctx.cache.set(key, R); if (ctx.cache.size > 400) ctx.cache.delete(ctx.cache.keys().next().value);
    return R;
  }
  /* over(c, t): check c is above the target ratio t (t < 1 only; a RULE check is held to its own pass alone) */
  const over = (c, t) => t < 1 && !RULE.test(c.n) && !(c.r <= t + TOL);
  /* evalCand(P, k, eff, ctx, full): eff on every line of type k. Not full: stops at the first failing line (that line is tried first next
     time). Returns { pass, fails, gov, lines, err, fit }. */
  function evalCand(P, k, eff, ctx, full, deb) {
    const fit = fitErrors(P, k, eff, ctx);
    if (fit.length) return { pass: false, fails: ['strand fit (input check)'], fit, gov: null, lines: null, err: '' };
    const BR = window.PSBBridge, tgt = ctx && ctx.o ? ctx.o.maxRatio : 1; let L = BR.typeLines(P, k).slice();
    const first = ctx.first && ctx.first[k]; if (first && L.includes(first)) L = [first, ...L.filter(g => g !== first)];
    const out = { pass: true, fails: [], gov: null, lines: [], err: '' };
    for (const g of L) {
      const R = engineRun(lineInputs(P, k, g, eff), ctx);
      if (!R || R.error) { out.pass = false; out.err = (R && R.error) || 'no result'; out.fails.push('engine error'); if (ctx.first) ctx.first[k] = g; if (!full) return out; continue; }
      out.lines.push({ g, R });
      if (deb && Array.isArray(R.warns) && R.warns.some(w => DEB_W.test(w))) { out.pass = false; if (!out.fails.includes('Debonding (5.9.4.3.3)')) out.fails.push('Debonding (5.9.4.3.3)'); out.debW = R.warns.filter(w => DEB_W.test(w)); }   // PSAD-C
      R.checks.forEach(c => { if (!out.gov || !(c.r <= out.gov.r)) out.gov = { n: c.n, r: c.r, g, loc: c.loc };
        if (tgt < 1 && !RULE.test(c.n) && (!out.govT || !(c.r <= out.govT.r))) out.govT = { n: c.n, r: c.r, g, loc: c.loc };   // the governing check the target applies to
        if (!c.pass || over(c, tgt)) { out.pass = false; if (!out.fails.includes(c.n)) out.fails.push(c.n); } });
      if (!out.pass) { if (ctx.first) ctx.first[k] = g; if (!full) return out; }
    }
    return out;
  }

  /* ---------- the concrete strengths ---------- */
  const rule = (o, id) => (window.PBD && window.PBD.ownRule ? window.PBD.ownRule(o, id) : null);
  /* conc(P, k, o): the f′c and f′ci grids of type k: { fc: [ascending], fciOf(fc): [ascending], lo, hi, note } (0.5 ksi steps through the
     entered values, PS-11) */
  function conc(P, k, o) {
    const b = window.PSBBridge.effBase(P, k), m = b.mat || {}, fc0 = +m.fc, fci0 = +m.fci, owner = window.PBD.ownerOf(b);
    if (o.vars.conc === 'lock') return { fc: [fc0], fciOf: () => [fci0], lock: true, owner };
    const rMin = rule(owner, 'fc.min'), rRng = rule(owner, 'fc.range'), rMax = rule(owner, 'fc.max'), rStd = rule(owner, 'fc.std');
    const lo0 = rMin ? rMin.value.min : rRng ? rRng.value.min : rStd ? Math.min(...rStd.value.std) : 4.0;
    const hi0 = rRng ? rRng.value.max : rMax ? rMax.value.max : rStd ? Math.max(...rStd.value.std) : 10.0;
    const lo = isNum(o.fcLo) ? o.fcLo : lo0, hi = isNum(o.fcHi) ? o.fcHi : hi0;
    const grid = (x0, a, c) => { const out = []; if (!(isNum(x0) && isNum(a) && isNum(c)) || c < a - 1e-9) return out;
      const j0 = Math.ceil((a - x0) / 0.5 - 1e-9), j1 = Math.floor((c - x0) / 0.5 + 1e-9); for (let j = j0; j <= j1; j++) out.push(R2(x0 + 0.5 * j)); return out; };
    const fc = grid(fc0, lo, hi);
    const rFM = rule(owner, 'fci.max'), rFR = rule(owner, 'fci.range');
    const fciOf = f => { let a = o.fciLo, c = f; if (isNum(o.fciHi)) c = Math.min(c, o.fciHi);
      if (rFM) c = Math.min(c, rFM.value.max * f); if (rFR) { a = Math.max(a, rFR.value.min * f); c = Math.min(c, rFR.value.max * f, rFR.value.cap); }
      return grid(fci0, a, c); };
    return { fc, fciOf, lo, hi, owner, lock: false };
  }

  /* ---------- the strand patterns ---------- */
  /* rowGrid(name): the straight rows' heights: PS-41 for a MassDOT section, else 2 in then every 2 in */
  const rowGrid = name => { const r = window.PSBSections && window.PSBSections.rowGrid ? window.PSBSections.rowGrid(name) : null; return r ? { first: r.first, step: r.step } : { first: 2, step: 2 }; };
  /* rowsOf(P, k, eff, ctx): the usable straight rows of the section of eff: [{ y, cap }] bottom-up, cap = the largest even count that fits
     (the input check's strand fit), rows with cap < 4 not used (the first such row ends the list) */
  function rowsOf(P, k, eff, ctx) {
    const key = JSON.stringify(['rows', eff.girder, window.PSBBridge.typeLines(P, k)[0], window.PSBBridge.types(P)[k].span]);
    if (ctx.rows.has(key)) return ctx.rows.get(key);
    const gr = rowGrid(eff.girder), h = window.PSBInputCheck.depthOf(eff), out = [];
    const noH = Object.assign({}, eff.harp, { n: 0 });
    for (let i = 0; i < 12; i++) {
      const y = R2(gr.first + gr.step * i); if (!(y < h - 2 - 1e-9)) break;
      let cap = 0; for (let n = 2; n <= 80; n += 2) { if (fitErrors(P, k, Object.assign({}, eff, { rows: [{ n, y, dbnd: 0, nd: 0 }], harp: noH }), ctx).length) break; cap = n; }
      if (cap < 4) break;
      out.push({ y, cap });
    }
    ctx.rows.set(key, out);
    return out;
  }
  /* bundleFits(P, k, eff, nh, y): n_h draped strands about the height y fit the section (the input check's strand fit of a drape at y at
     both its ends) */
  const bundleFits = (P, k, eff, nh, y, ctx) => !fitErrors(P, k, Object.assign({}, eff, { rows: [], harp: { n: nh, yEnd: y, yMid: y, frac: 0.4 } }), ctx).length;
  /* fill(rows, Ns, deb): Ns straight strands bottom-up (each row to its capacity), with the entered debonding of row i (deb[i]) */
  function fill(rows, Ns, deb) {
    const out = []; let rem = Ns;
    for (let i = 0; i < rows.length && rem > 0; i++) { const n = Math.min(rows[i].cap, rem), d = deb[i];
      out.push({ n, y: rows[i].y, dbnd: d && d.nd > 0 ? d.dbnd : 0, nd: d && d.nd > 0 ? Math.min(d.nd, n) : 0 }); rem -= n; }
    return rem > 0 ? null : out;
  }
  const debOf = b => (Array.isArray(b.rows) ? b.rows.slice() : []).filter(r => r && typeof r === 'object').sort((a, c) => (+a.y || 0) - (+c.y || 0)).map(r => ({ nd: +r.nd || 0, dbnd: +r.dbnd || 0 }));
  /* drapes(rows, nh, h): the drapes of n_h strands above the straight rows: y_mid = top row + 2 + (rows of two − 1); y_end = y_mid + 2 j up
     to the top cover (2 in to the top strand); each with every frac; in the order of the choice (flatter first, then frac nearest 0.40) */
  function drapes(rowsUsed, nh, h, fracs) {
    const rr = Math.ceil(nh / 2), top = rowsUsed.length ? rowsUsed[rowsUsed.length - 1].y : 0, yMid = R2(top + 2 + (rr - 1)), out = [];
    for (let j = 1; ; j++) { const yEnd = R2(yMid + 2 * j); if (yEnd + (rr - 1) > h - 2 + 1e-9) break; (fracs || FRACS).forEach(frac => out.push({ n: nh, yEnd, yMid, frac, sl: (yEnd - yMid) / frac })); }
    out.sort((a, c) => a.sl - c.sl || Math.abs(a.frac - 0.4) - Math.abs(c.frac - 0.4) || a.yEnd - c.yEnd);
    return { yMid, list: out };
  }

  /* search(P, k, girder, o, ctx, log): the best design of type k on that section (steps 1-3 above) or null; yields progress */
  function* search(P, k, girder, o, ctx, log) {
    const lockS = o.vars.strands === 'lock', lockD = o.vars.drape === 'lock';
    const b0 = window.PSBBridge.effBase(P, k), base = Object.assign(J(b0), { girder }), C = conc(P, k, o);
    const res = { girder, best: null, trials: 0, closest: null, why: '', level: null };
    const h = window.PSBInputCheck.depthOf(base), h0 = window.PSBInputCheck.depthOf(b0);
    /* top strands: entered straight rows in the upper half of the girder are kept as entered (count, debonding), at the same distance below
       the top of the section searched; the rows of the lower half are the ones searched (their entered debonding kept, row by row) */
    const upper = r => isNum(+r.y) && +r.y > h0 / 2, ent = (Array.isArray(b0.rows) ? b0.rows : []).filter(r => r && typeof r === 'object');
    const tops = ent.filter(upper).map(r => Object.assign(J(r), { y: R2(h - (h0 - +r.y)) })), nTop = tops.reduce((a, r) => a + (+r.n || 0), 0);
    const deb = debOf(Object.assign({}, b0, { rows: ent.filter(r => !upper(r)) }));
    const mk = (rows, harp, fc, fci) => { const e = J(base); e.rows = J(rows).concat(lockS ? [] : J(tops)); e.harp = Object.assign({}, b0.harp, harp); e.mat = Object.assign({}, e.mat, { fc, fci }); return e; };
    const note = (what, r) => { res.trials++;
      if (r.gov && (!res.closest || r.fails.length < res.closest.fails.length || (r.fails.length === res.closest.fails.length && r.gov.r < res.closest.gov.r))) res.closest = { what, fails: r.fails.slice(), gov: r.gov };
      if (log.length < 3000) log.push({ k, girder, what, pass: r.pass, fails: r.fails.slice(0, 4), gov: r.gov ? { n: r.gov.n, r: r.gov.r, g: r.gov.g } : null });
      if (ctx.runs >= o.maxRuns) ctx.stopped = true; };
    const trial = function* (rows, harp, fc, fci, what, full) {
      const e = mk(rows, harp, fc, fci), r = evalCand(P, k, e, ctx, !!full); note(what, r);
      yield { i: ctx.runs, msg: `${girder}: ${what}` };
      return r;
    };
    const dTxt = hp => hp.n ? `, y_end ${hp.yEnd} in, y_mid ${hp.yMid} in, frac ${(+hp.frac).toFixed(2)}` : '';
    const noHD = r => r.lines && !r.err && r.fails.every(n => HD.test(n));   // passes every check but the hold-down force
    /* the strengths each strand search is run at (PS-11; the plan's steps 1-3 at most 3 times): the entered f′c / f′ci; the entered f′c
       with the highest f′ci it allows; the highest f′c with the highest f′ci it allows */
    const top = C.fc.length ? C.fc[C.fc.length - 1] : null, hiFci = f => { const q = C.fciOf(f); return q.length ? q[q.length - 1] : null; };
    const fc0 = +b0.mat.fc, fci0 = +b0.mat.fci, levels = [];
    const addL = (fc, fci, lab) => { if (fc == null || fci == null || !(fci <= fc + 1e-9)) return; if (!levels.some(q => q.fc === fc && q.fci === fci)) levels.push({ fc, fci, lab }); };
    if (C.lock) addL(fc0, fci0, 'the entered f′c / f′ci (locked)');
    else { if (C.fc.includes(R2(fc0)) && C.fciOf(R2(fc0)).includes(R2(fci0))) addL(R2(fc0), R2(fci0), 'the entered f′c / f′ci');
      if (C.fc.includes(R2(fc0))) addL(R2(fc0), hiFci(R2(fc0)), 'the entered f′c, the highest f′ci');
      addL(top, top != null ? hiFci(top) : null, 'the highest f′c and f′ci'); }
    if (!levels.length) { res.why = 'no f′c / f′ci in the ranges searched'; return res; }
    const LT = levels[levels.length - 1];
    let pat = null;   // { rows, harp, N, nh, lv }
    if (lockS) {   // the entered rows and draped strands, at each level
      for (const lv of levels) { const r = yield* trial(b0.rows, b0.harp, lv.fc, lv.fci, `entered strands, ${lv.lab}`);
        if (r.pass) { pat = { rows: J(b0.rows), harp: J(b0.harp), N: countOf(b0), nh: +b0.harp.n || 0, lv }; break; } }
    } else {
      const rows = rowsOf(P, k, base, ctx), capS = rows.reduce((a, q) => a + q.cap, 0) - (rows.reduce((a, q) => a + q.cap, 0) % 2);
      if (!rows.length) { res.why = 'no strand row fits the section'; return res; }
      const nh0 = +b0.harp.n || 0;
      { // quick reject at the highest strengths, every row full (the most capacity the section can have)
        const r = yield* trial(fill(rows, capS, deb), { n: 0 }, LT.fc, LT.fci, `every row full (${capS} straight), ${LT.lab}`, true);
        if (r.fails.includes('LL deflection')) { res.why = 'the live-load deflection fails at the highest f′c (the section\'s stiffness: no strand pattern changes it)'; return res; }
        if (!(r.lines && !r.err && !r.fails.includes('Flexure') && !r.fails.includes('Srv III tens'))) { res.why = `Strength I flexure or Service III tension fails with every row full (${capS} straight strands) at the highest f′c`; return res; } }
      for (const lv of levels) {
        // step 1: N1 by bisection: the fewest straight strands with Strength I flexure and Service III tension passing (no draped strand)
        const okS = r => r.lines && !r.err && r.fails.every(n => !(n === 'Flexure' || n === 'Srv III tens'));
        const s1 = function* (Ns) { const rw = fill(rows, Ns, deb); if (!rw) return false; const r = yield* trial(rw, { n: 0 }, lv.fc, lv.fci, `step 1: ${Ns} straight, no draped, ${lv.lab}`, true);
          return okS(r); };
        let lo = 2, hi = capS; if (!(yield* s1(hi))) continue;
        while (hi - lo > 2) { const mid = lo + 2 * Math.floor((hi - lo) / 4); if (yield* s1(mid)) hi = mid; else lo = mid; }
        const N1 = (yield* s1(lo)) ? lo : hi;
        // step 2: N = N1, N1 + 2, …; n_h = 0, 2, …; the drape of each n_h with the lowest hold-down force that passes
        outer: for (let N = N1; ; N += 2) {
          let grow = false, any = false;
          const nhs = lockD ? [nh0] : Array.from({ length: Math.floor(N / 2) }, (_, i) => 2 * i);
          for (const nh of nhs) {
            if (N - nh < 2) continue; const rw = fill(rows, N - nh, deb); if (!rw) continue;
            if (nh === 0 || lockD) { const hp = nh === 0 ? { n: 0 } : J(b0.harp), r = yield* trial(rw, hp, lv.fc, lv.fci, `N ${N} (${N - nh} straight, ${nh} draped${dTxt(hp)}), ${lv.lab}`);
              if (ctx.stopped) break outer; if (r.fit && r.fit.length) continue; any = true;
              if (r.pass) { pat = { rows: rw, harp: hp, N, nh, lv }; break outer; }
              if (r.fails.every(n => GROW.includes(n))) grow = true; continue; }
            const D = drapes(rw, nh, h, o.fracs); if (!D.list.length) break;
            // the bundle must fit at every height it passes between y_mid and y_end (a box or voided slab: not through the void), 1 in apart
            const ys = [...new Set(D.list.map(q => q.yEnd))].sort((a, c) => a - c).filter(y => { for (let z = D.yMid; z <= y + 1e-9; z = R2(z + 1)) if (!bundleFits(P, k, base, nh, z, ctx)) return false; return true; });
            if (!ys.length) { if (!bundleFits(P, k, base, nh, D.yMid, ctx)) break; continue; }
            let best = null, fitOK = false;
            /* each frac from 0.45 down: the lowest y_end at which every check but the hold-down force passes (bisection: a higher y_end
               relieves the end more), only below the flattest drape found so far; then the hold-down force at it */
            for (const frac of (o.fracs || FRACS).slice().sort((a, c) => c - a)) {
              const yl = ys.filter(y => !best || (y - D.yMid) / frac < best.sl - 1e-12 || ((y - D.yMid) / frac <= best.sl + 1e-12 && Math.abs(frac - 0.4) < Math.abs(best.frac - 0.4)));
              if (!yl.length) continue;
              const at = function* (y) { const hp = { n: nh, yEnd: y, yMid: D.yMid, frac }, r = yield* trial(rw, hp, lv.fc, lv.fci, `N ${N} (${N - nh} straight, ${nh} draped${dTxt(hp)}), ${lv.lab}`);
                if (!(r.fit && r.fit.length)) { fitOK = true; any = true; if (r.fails.length && r.fails.every(n => GROW.includes(n))) grow = true; } return r; };
              const rTop = yield* at(yl[yl.length - 1]); if (ctx.stopped) break outer;
              if (rTop.fit && rTop.fit.length && yl.length === ys.length && !fitOK) { /* the bundle does not fit: try the next frac */ continue; }
              if (!noHD(rTop)) continue;   // even the steepest drape allowed here fails a check other than the hold-down force
              let a = -1, c = yl.length - 1, rc = rTop;   // p(yl[c]) true; find the smallest index with p true
              while (c - a > 1) { const m = (a + c) >> 1, r = yield* at(yl[m]); if (ctx.stopped) break outer; if (noHD(r)) { c = m; rc = r; } else a = m; }
              if (rc.pass) best = { yEnd: yl[c], frac, sl: (yl[c] - D.yMid) / frac };
            }
            if (best) { pat = { rows: rw, harp: { n: nh, yEnd: best.yEnd, yMid: D.yMid, frac: best.frac }, N, nh, lv }; break outer; }
            if (!fitOK) break;   // n_h draped strands do not fit: a larger n_h does not either
          }
          if (!any) { if (N >= capS) { res.why = 'every row is full and no more draped strands fit'; break; } continue; }
          if (!grow) { res.why = `no strand pattern passes at N = ${N}: the checks that fail are not improved by more strands`; break; }
        }
        if (pat || ctx.stopped) break;
      }
    }
    if (!pat) { if (!res.why) res.why = ctx.stopped ? 'stopped' : 'no strand pattern passes'; return res; }
    res.level = pat.lv.lab;
    // step 3: the lowest f′c (with the highest f′ci it allows), then the lowest f′ci, at that strand pattern
    let fc = pat.lv.fc, fci = pat.lv.fci;
    if (!C.lock) {
      for (const f of C.fc) { if (f > fc + 1e-9) break; const fi = hiFci(f); if (fi == null) continue; if (f === fc && fi <= fci) break;
        const r = yield* trial(pat.rows, pat.harp, f, fi, `step 3: f′c ${f} ksi, f′ci ${fi} ksi`); if (r.pass) { fc = f; fci = fi; break; } }
      for (const fi of C.fciOf(fc)) { if (fi >= fci - 1e-9) break; const r = yield* trial(pat.rows, pat.harp, fc, fi, `step 3: f′c ${fc} ksi, f′ci ${fi} ksi`); if (r.pass) { fci = fi; break; } }
    }
    const e = mk(pat.rows, pat.harp, fc, fci), r = evalCand(P, k, e, ctx, true);
    if (!r.pass) { res.why = 'the final design does not pass (unexpected)'; return res; }
    const W = r.lines.reduce((a, q) => a + q.R.g.wsw * (q.R.L + 2 * (+e.opt.endOh || 0) / 12), 0);   // the girder weight of the type's lines (PSBBridge.results' W)
    res.best = { k, girder, N: lockS ? pat.N : pat.N + nTop, nh: pat.nh, nTop: lockS ? 0 : nTop, rows: e.rows, harp: e.harp, fc, fci, eff: e, ev: r, W, hd: hdOf(r) };
    return res;
  }
  /* ---------- Refine (PSAD-A, item 4): the smallest change from the entered design ---------- */
  /* distance(d0, b): the distance of design b from the entered design d0, compared lexicographically (cmpDist): |ΔN|, |Δn_h|, the drape
     change, |Δf′c|, |Δf′ci|. The drape change: with entered draped strands (n_h0 > 0) and draped strands in b, (|Δy_end|, |Δfrac|); with
     none entered, (the slope (y_end − y_mid)/frac, |frac − 0.40|), the order of the new-design search (the flatter first); no draped strand
     in b: (0, 0). Decision PSAD-D1 (pending engineer review). */
  function distance(d0, b) {
    const dr = !b.nh ? [0, 0] : d0.nh > 0 ? [Math.abs(+b.harp.yEnd - d0.yEnd), Math.abs(+b.harp.frac - d0.frac)] : [(+b.harp.yEnd - +b.harp.yMid) / +b.harp.frac, Math.abs(+b.harp.frac - 0.4)];
    return [Math.abs(b.N - d0.N), Math.abs(b.nh - d0.nh), R2(dr[0]), R2(dr[1]), R2(Math.abs(b.fc - d0.fc)), R2(Math.abs(b.fci - d0.fci))];
  }
  const cmpDist = (a, c) => { for (let i = 0; i < a.length; i++) if (Math.abs(a[i] - c[i]) > 1e-9) return a[i] - c[i]; return 0; };
  /* modRows(P, k, base, ent, Ns, ctx): the entered straight rows (lower half, bottom-up) changed by pairs to Ns strands: fewer: pairs off
     the highest row first (a row left with none is dropped); more: pairs onto the lowest row they fit on (the input check's strand fit),
     then a new row on the section's row grid above the top row (rowsOf). Entered debonding kept (at most the row's count). null: no fit. */
  function modRows(P, k, base, ent, Ns, ctx) {
    let rows = ent.map(r => ({ n: +r.n || 0, y: +r.y, dbnd: +r.dbnd || 0, nd: +r.nd || 0 })).filter(r => r.n > 0 && isNum(r.y)).sort((a, c) => a.y - c.y);
    let tot = rows.reduce((a, r) => a + r.n, 0); if (Ns < 2) return null;
    const noH = Object.assign({}, base.harp, { n: 0 }), fits = (n, y) => !fitErrors(P, k, Object.assign({}, base, { rows: [{ n, y, dbnd: 0, nd: 0 }], harp: noH }), ctx).length;
    while (tot > Ns) { const r = rows[rows.length - 1], d = Math.min(r.n, tot - Ns >= 2 ? 2 : tot - Ns); r.n -= d; tot -= d; if (r.nd > r.n) r.nd = r.n; if (r.n <= 0) rows.pop(); if (!rows.length) return null; }
    const grid = rowsOf(P, k, base, ctx);
    while (tot < Ns) { const add = Math.min(2, Ns - tot); let r = rows.find(q => fits(q.n + add, q.y));
      if (!r) { const top = rows.length ? rows[rows.length - 1].y : -Infinity, gq = grid.find(q => q.y > top + 1e-9 && q.cap >= add); if (!gq) return null; r = { n: 0, y: gq.y, dbnd: 0, nd: 0 }; rows.push(r); }
      r.n += add; tot += add; }
    return rows;
  }
  /* refine(P, k, girder, o, ctx, log): Refine mode for type k on its current section: { best, list (the passing designs, nearest first),
     trials, closest, why, level }. Steps:
       1. the entered design itself (strands, drape, f′c, f′ci);
       2. N = N0, then N0 − 2, N0 − 4, … (down, to reduce an over-designed pattern: stops at the first N with no passing design once one
          passed, or when every trial at N failed only on checks that more strands improve (GROW)), and, only when nothing passes at N0,
          N0 + 2, N0 + 4, … up to the first that passes (or no trial fails on GROW alone, or every row is full);
       3. at each N: n_h in the order of |Δn_h| (then the fewer); the entered rows changed by pairs (modRows); at each n_h the drape nearest
          the entered one (per frac: the passing y_end range by bisection, as the new-design search, then the y_end in it nearest the
          entered y_end), judged at the highest f′c / f′ci; the first n_h with a passing drape is the pattern for that N;
       4. at that pattern the f′c nearest the entered one that passes (with its highest f′ci), then the f′ci nearest the entered one
          (bisection; a higher strength is assumed not worse, AD-D8).
     The list: the passing designs ranked by distance(); listed: the first topN − 1 and the one with the fewest strands (so an over-designed
     pattern always shows its reduction), Decision PSAD-D2 (pending engineer review). */
  function* refine(P, k, girder, o, ctx, log) {
    const lockS = o.vars.strands === 'lock', lockD = o.vars.drape === 'lock';
    const b0 = window.PSBBridge.effBase(P, k), base = Object.assign(J(b0), { girder }), C = conc(P, k, o);
    const res = { girder, best: null, list: [], trials: 0, closest: null, why: '', level: 'the entered design (Refine)' };
    const h = window.PSBInputCheck.depthOf(base), h0 = h;
    const upper = r => isNum(+r.y) && +r.y > h0 / 2, ent = (Array.isArray(b0.rows) ? b0.rows : []).filter(r => r && typeof r === 'object');
    const tops = ent.filter(upper), low = ent.filter(r => !upper(r)), nTop = tops.reduce((a, r) => a + (+r.n || 0), 0);
    const hp0 = b0.harp || {}, d0 = { N: countOf(b0), nh: +hp0.n || 0, yEnd: +hp0.yEnd, frac: +hp0.frac, fc: +b0.mat.fc, fci: +b0.mat.fci };
    /* mk: the candidate's inputs; rows null = the entered rows exactly (the entered design, in its own row order) */
    const mk = (rows, harp, fc, fci) => { const e = J(base); e.rows = rows === null ? J(b0.rows) : J(rows).concat(lockS ? [] : J(tops)); e.harp = Object.assign({}, b0.harp, harp); e.mat = Object.assign({}, e.mat, { fc, fci }); return e; };
    const note = (what, r) => { res.trials++;
      if (r.gov && (!res.closest || r.fails.length < res.closest.fails.length || (r.fails.length === res.closest.fails.length && r.gov.r < res.closest.gov.r))) res.closest = { what, fails: r.fails.slice(), gov: r.gov };
      if (log.length < 3000) log.push({ k, girder, what, pass: r.pass, fails: r.fails.slice(0, 4), gov: r.gov ? { n: r.gov.n, r: r.gov.r, g: r.gov.g } : null });
      if (ctx.runs >= o.maxRuns) ctx.stopped = true; };
    const trial = function* (rows, harp, fc, fci, what) { const r = evalCand(P, k, mk(rows, harp, fc, fci), ctx, false); note(what, r); yield { i: ctx.runs, msg: `${girder}: ${what}` }; return r; };
    const dTxt = hp => hp.n ? `, y_end ${hp.yEnd} in, y_mid ${hp.yMid} in, frac ${(+hp.frac).toFixed(2)}` : '';
    const noHD = r => r.lines && !r.err && r.fails.every(n => HD.test(n));
    const hiFci = f => { const q = C.fciOf(f); return q.length ? q[q.length - 1] : null; };
    const fcTop = C.lock ? d0.fc : C.fc.length ? C.fc[C.fc.length - 1] : null, fciTop = C.lock ? d0.fci : fcTop != null ? hiFci(fcTop) : null;
    if (fcTop == null || fciTop == null) { res.why = 'no f′c / f′ci in the ranges searched'; return res; }
    const LT = `f′c ${fcTop} / f′ci ${fciTop} ksi${C.lock ? ' (locked)' : ', the highest'}`;
    /* concAt(rows, harp): the f′c / f′ci nearest the entered values that pass with this pattern (it passes at the highest); null if none */
    const concAt = function* (rows, harp, tag) {
      if (C.lock) { const r = yield* trial(rows, harp, d0.fc, d0.fci, `${tag}, f′c / f′ci locked`); return r.pass ? { fc: d0.fc, fci: d0.fci } : null; }
      const F = C.fc.filter(f => hiFci(f) != null), ok = function* (f, fi) { return (yield* trial(rows, harp, f, fi, `${tag}, f′c ${f} ksi, f′ci ${fi} ksi`)).pass; };
      if (!F.length) return null;
      /* near(L, x0, pass): in the ascending grid L, whose last value passes and where the passing values are those from some index T on
         (the monotone assumption, AD-D8), the passing value nearest x0: x0 itself when it is on the grid and passes, else T by bisection
         (from x0's index when it is on the grid), then the value of L[T..] nearest x0 */
      const near = function* (L, x0, pass) {
        const last = L.length - 1, j0 = L.findIndex(f => Math.abs(f - x0) < 1e-9);
        if (x0 >= L[last] - 1e-9) return L[last];
        if (j0 >= 0 && (yield* pass(L[j0]))) return L[j0];
        let a = j0, c = last; while (c - a > 1) { const m = (a + c) >> 1; if (yield* pass(L[m])) c = m; else a = m; if (ctx.stopped) return null; }
        return L.slice(c).reduce((b, f) => Math.abs(f - x0) < Math.abs(b - x0) - 1e-9 ? f : b, L[c]);
      };
      const fc = yield* near(F, d0.fc, f => ok(f, hiFci(f))); if (fc == null) return null;
      const fci = yield* near(C.fciOf(fc), d0.fci, fi => ok(fc, fi)); if (fci == null) return null;
      return { fc, fci };
    };
    const found = [];   // { N, nh, rows, harp, fc, fci }
    const finish = function* (pat) { const cc = yield* concAt(pat.rows, pat.harp, `N ${pat.N} (${pat.N - pat.nh - (lockS ? 0 : nTop)} straight, ${pat.nh} draped${dTxt(pat.harp)})`); if (cc) found.push(Object.assign({}, pat, cc)); return !!cc; };
    // 1. the entered design itself
    { const r = yield* trial(null, b0.harp, d0.fc, d0.fci, 'the entered design');
      if (r.pass) found.push({ N: d0.N, nh: d0.nh, rows: null, harp: J(b0.harp), fc: d0.fc, fci: d0.fci }); }
    if (lockS) { if (!found.length && !ctx.stopped) { const r = yield* trial(null, b0.harp, fcTop, fciTop, `the entered strands, ${LT}`); if (r.pass) yield* finish({ N: d0.N, nh: d0.nh, rows: null, harp: J(b0.harp) }); } }
    else {
      /* patternAt(N): the nearest passing (n_h, drape) at N, judged at the highest strengths: { pat } | { grow } (every trial failed on GROW
         checks alone, or on none that a pattern changes) */
      const patternAt = function* (N) {
        const Nl = N - nTop; let grow = true, anyT = false, stiff = false, nhFitMax = Infinity;
        const nhs = lockD ? [d0.nh] : Array.from({ length: Math.max(0, Math.floor((Nl - 2) / 2) + 1) }, (_, i) => 2 * i).sort((a, c) => Math.abs(a - d0.nh) - Math.abs(c - d0.nh) || a - c);
        for (const nh of nhs) {
          if (stiff) return { stiff };
          if (nh > nhFitMax || Nl - nh < 2) continue;
          const rw = modRows(P, k, base, low, Nl - nh, ctx); if (!rw) continue;
          const at = function* (hp) { const r = yield* trial(rw, hp, fcTop, fciTop, `N ${N} (${Nl - nh} straight, ${nh} draped${dTxt(hp)}), ${LT}`);
            if (!(r.fit && r.fit.length)) { anyT = true; if (!(r.fails.length && r.fails.every(n => GROW.includes(n))) && !r.pass) grow = false; if (r.fails.includes('LL deflection')) stiff = true; } return r; };
          if (nh === 0 || lockD) { const hp = nh === 0 ? { n: 0 } : J(b0.harp), r = yield* at(hp); if (ctx.stopped) return {}; if (r.pass) return { pat: { N, nh, rows: rw, harp: hp } }; continue; }
          // the entered drape first (same n_h, the entered y_end / y_mid / frac)
          if (nh === d0.nh && N === d0.N && isNum(+hp0.yEnd) && isNum(+hp0.yMid)) { const r = yield* at(J(hp0)); if (ctx.stopped) return {}; if (r.pass) return { pat: { N, nh, rows: rw, harp: Object.assign(J(hp0), { n: nh }) } }; }
          const D = drapes(rw, nh, h, o.fracs); if (!D.list.length) { nhFitMax = nh - 2; continue; }
          const ys = [...new Set(D.list.map(q => q.yEnd))].sort((a, c) => a - c).filter(y => { for (let z = D.yMid; z <= y + 1e-9; z = R2(z + 1)) if (!bundleFits(P, k, base, nh, z, ctx)) return false; return true; });
          if (!ys.length) { if (!bundleFits(P, k, base, nh, D.yMid, ctx)) nhFitMax = nh - 2; continue; }
          const yT = d0.nh > 0 && nh > 0 ? d0.yEnd : -Infinity, fT = d0.nh > 0 && isNum(d0.frac) ? d0.frac : 0.4;
          let best = null; const key = (y, f) => d0.nh > 0 ? [Math.abs(y - yT), Math.abs(f - fT)] : [(y - D.yMid) / f, Math.abs(f - 0.4)];
          for (const frac of (o.fracs || FRACS).slice().sort((a, c) => Math.abs(a - fT) - Math.abs(c - fT) || c - a)) {
            if (stiff) return { stiff };
            const hpOf = y => ({ n: nh, yEnd: y, yMid: D.yMid, frac });
            const rTop = yield* at(hpOf(ys[ys.length - 1])); if (ctx.stopped) return {};
            if (!noHD(rTop)) continue;
            let a = -1, c = ys.length - 1;   // the lowest y_end at which every check but the hold-down force passes
            while (c - a > 1) { const m = (a + c) >> 1, r = yield* at(hpOf(ys[m])); if (ctx.stopped) return {}; if (noHD(r)) c = m; else a = m; }
            // the passing y_end: from ys[c] up to the highest at which the hold-down force passes; the one nearest y_T
            let i = c; if (isFinite(yT)) { i = ys.findIndex((y, j) => j >= c && y >= yT - 1e-9); if (i < 0) i = ys.length - 1; if (i > c && Math.abs(ys[i - 1] - yT) <= Math.abs(ys[i] - yT)) i--; }
            if (best && cmpDist(key(ys[i], frac), key(best.y, best.frac)) >= 0 && cmpDist(key(ys[c], frac), key(best.y, best.frac)) >= 0) continue;
            let r = yield* at(hpOf(ys[i])); if (ctx.stopped) return {};
            if (!r.pass && i > c) { let lo = c, hi = i; const rc = yield* at(hpOf(ys[c])); if (ctx.stopped) return {}; if (!rc.pass) continue;
              while (hi - lo > 1) { const m = (lo + hi) >> 1, q = yield* at(hpOf(ys[m])); if (ctx.stopped) return {}; if (q.pass) lo = m; else hi = m; }
              i = lo; r = { pass: true }; }
            if (r.pass && (!best || cmpDist(key(ys[i], frac), key(best.y, best.frac)) < 0)) best = { y: ys[i], frac };
          }
          if (best) return { pat: { N, nh, rows: rw, harp: { n: nh, yEnd: best.y, yMid: D.yMid, frac: best.frac } } };
        }
        return { grow: anyT && grow, none: !anyT, stiff };
      };
      const capS = rowsOf(P, k, base, ctx).reduce((a, q) => a + q.cap, 0) + low.reduce((a, r) => a + (+r.n || 0), 0);
      let passN0 = found.length > 0;
      if (!passN0) { const q = yield* patternAt(d0.N); if (q.pat) passN0 = yield* finish(q.pat); }
      // down: fewer strands
      for (let N = d0.N - 2; N - nTop >= 2 && !ctx.stopped; N -= 2) { const q = yield* patternAt(N);
        if (q.pat) { if (!(yield* finish(q.pat))) break; continue; }
        if (found.length || q.grow || q.none || q.stiff) break; }
      // up: more strands, only when nothing passes at N0
      if (!passN0 && !ctx.stopped) for (let N = d0.N + 2; N - nTop <= capS && !ctx.stopped; N += 2) { const q = yield* patternAt(N);
        if (q.pat) { if (yield* finish(q.pat)) break; continue; }
        if (q.stiff) { res.why = 'the live-load deflection fails at the highest f′c (the section\'s stiffness: no strand pattern changes it)'; break; }
        if (!q.grow && !q.none) { res.why = `no strand pattern passes at N = ${N}: the checks that fail are not improved by more strands`; break; } }
    }
    if (!found.length) { if (!res.why) res.why = ctx.stopped ? 'stopped' : 'no design near the entered one passes'; return res; }
    const list = [];
    for (const f of found) { const e = mk(f.rows, f.harp, f.fc, f.fci), r = evalCand(P, k, e, ctx, true); if (!r.pass) continue;
      const W = r.lines.reduce((a, q) => a + q.R.g.wsw * (q.R.L + 2 * (+e.opt.endOh || 0) / 12), 0);
      const b = { k, girder, N: f.N, nh: f.nh, nTop: lockS ? 0 : nTop, rows: e.rows, harp: e.harp, fc: f.fc, fci: f.fci, eff: e, ev: r, W, hd: hdOf(r) };
      b.dist = distance(d0, b);
      b.delta = { N: b.N - d0.N, nh: b.nh - d0.nh, yEnd: b.nh && d0.nh ? R2(+b.harp.yEnd - d0.yEnd) : null, frac: b.nh && d0.nh ? R2(+b.harp.frac - d0.frac) : null, fc: R2(b.fc - d0.fc), fci: R2(b.fci - d0.fci) };
      if (!list.some(q => cmpDist(q.dist, b.dist) === 0 && q.N === b.N)) list.push(b); }
    if (!list.length) { res.why = 'the final design does not pass (unexpected)'; return res; }
    list.sort((a, c) => cmpDist(a.dist, c.dist));
    const fewest = list.reduce((a, q) => q.N < a.N ? q : a, list[0]);
    res.list = list.slice(0, Math.max(1, o.topN - 1)); if (o.topN > 1) { if (!res.list.includes(fewest)) res.list.push(fewest); else if (list.length > res.list.length) res.list.push(list[res.list.length]); }
    res.list.forEach(q => { q.fewest = q === fewest; q.entered = q.dist.every(x => x === 0); });
    res.best = res.list[0];
    return res;
  }
  /* ---------- straight strands with debonding (PSAD-C, item 3; PS-12 reopened by the engineer 2026-11-28 for this option only) ----------
     settings.pattern: 'draped' (the search above; the default: entered debonding kept, never added, PS-12 as before), 'straight' (no draped
     strand; debonding searched, searchStraight), 'both' (both searched for each type and section, ranked together: pickPat).
     The debonding limits, AASHTO LRFD 10th Ed. (2024) Art. 5.9.4.3.3 (paraphrased; engineer's mapping of 2026-11-28), applied as limits on
     the patterns proposed (no new formula):
       (A) per row at most 45 % of the row's strands debonded;           (D) an even count per row (symmetric about the vertical ℄);
       (B) at most 6 strands terminating at one section, 4 with 0.7 in strand or when 10 or fewer are debonded in all: each debonded row
           has its own length (staggered), at most that many strands in a row;
       (C) termination sections at least 60 d_b apart: the debond lengths of the rows step by Δ = ⌈60 d_b / 12⌉ ft on the 1 ft grid;
       (G) simple spans: the longest at most min(0.20 L, L/2 − ℓ_d) (the engine's own check, its warning rejects the candidate; a span
           made continuous: the same limit, conservatively, from the same engine values);
       (I) single-web sections (I-girders, bulb tees, deck bulb tees): the strands within the web width b_w and the outermost strand
           each side of every row stay bonded, whatever the share debonded or b_f / b_w;
       (J) box beams and voided slabs: only strands under a void (between the webs' projections) are debonded, the outermost bonded;
       (K) NEXT beams and solid slabs: the outermost strand each side (each stem) bonded, debonded strands split evenly between the stems.
     (E) (alternating bonded / debonded positions) is not checked: the model has no strand position within a row (stated in the output).
     Owner rules: CTDOT V2 5.9.4.3.3 (at most 25 % of all strands; the engine's owner check, a RULE check that must pass, and a cap on the
     count tried); MassDOT Bridge Manual 3.7.2.2 (straight debonded strands preferred over draped strands for box beams, NEBT and NEDBT:
     draped only when debonding alone does not pass; 'both' ranks the straight design first for those); RIDOT BDM 5.6.3.2: debonding as
     AASHTO LRFD (no further limit). Debond lengths on a 1 ft grid from the girder ends, as short as possible (bisection on the shortest).
     Any 5.9.4.3.3 warning of the engine (A, B, C, D, G) on a line rejects the candidate. */
  const DEB_W = /5\.9\.4\.3\.3\((A|B|C|D|G)\)|5\.9\.4\.3\.3\(G\)/;
  const RELEASE = ['Release comp', 'Release tens', 'Release tens (+M, bot)', 'Release tens. steel (5.9.2.3.1b)', 'Srv tens (top)'];
  /* debCaps(P, k, eff, rows): for each straight row the most strands that may be debonded (even), the limits above: { caps, nTerm(D), dStep } */
  function debCaps(P, k, eff, rows) {
    const BR = window.PSBBridge, inp = lineInputs(P, k, BR.typeLines(P, k)[0], Object.assign({}, eff, { rows, harp: Object.assign({}, eff.harp, { n: 0 }) }));
    let g = null; try { g = girderGross(inp); } catch (e) { g = null; }
    const st = (typeof STRANDS !== 'undefined' && STRANDS[eff.str && eff.str.size]) || { db: 0.6 }, db = +st.db, f = family(eff.girder).fam;
    const vs = g && typeof sectionVoids === 'function' ? sectionVoids(g) : [];
    const caps = rows.map(r => { const n = +r.n || 0; if (n < 4) return 0;
      let elig;
      if (g && g.isNext && g.next) { const half = Math.floor(n / 2); elig = 2 * Math.max(0, half - 2); }   // (K) per stem: the two outermost bonded
      else { const xs = [...Array(n)].map((_, i) => (i - (n - 1) / 2) * 2), xmax = Math.max(...xs.map(Math.abs));
        const inner = xs.filter(x => Math.abs(x) < xmax - 1e-9);   // the outermost each side bonded
        if (f === 'I' || f === 'dbt') elig = inner.filter(x => Math.abs(x) > (g ? +g.bw : 0) / 2 + 1e-9).length;   // (I) the web width bonded
        else if (vs.length) elig = inner.filter(x => vs.some(v => v.type === 'rect' ? Math.abs(x - v.x) < v.w / 2 - 1e-9 : Math.abs(x - v.x) < v.d / 2 - 1e-9)).length;   // (J) under a void
        else elig = inner.length; }   // (K) a solid slab
      return Math.min(2 * Math.floor(Math.floor(0.45 * n + 1e-9) / 2), 2 * Math.floor(elig / 2)); });
    return { caps, db, nTerm: D => (db >= 0.7 - 1e-9 || D <= 10) ? 4 : 6, dStep: Math.max(1, Math.ceil(60 * db / 12 - 1e-9)) };
  }
  /* debRows(rows, caps, D, nTerm): D debonded strands, bottom row first, each row up to min(cap, nTerm) (pairs); null if they do not fit */
  function debRows(rows, caps, D, nTerm) {
    const nd = rows.map(() => 0); let rem = D;
    for (let i = 0; i < rows.length && rem > 0; i++) { const c = Math.min(caps[i], 2 * Math.floor(nTerm / 2)); const t = Math.min(c, rem); nd[i] = t - (t % 2); rem -= nd[i]; }
    return rem > 0 ? null : nd;
  }
  /* withDeb(rows, nd, l0, step): the rows with nd[i] debonded; the debonded rows' lengths l0, l0 + step, … from the highest debonded row down
     (the bottom row, the most eccentric, the longest) */
  function withDeb(rows, nd, l0, step) {
    const idx = rows.map((r, i) => i).filter(i => nd[i] > 0), out = rows.map(r => Object.assign({}, r, { nd: 0, dbnd: 0 }));
    idx.slice().reverse().forEach((i, j) => { out[i].nd = nd[i]; out[i].dbnd = l0 + j * step; });
    return out;
  }
  /* searchStraight(P, k, girder, o, ctx, log): as search(), no draped strand; at each N the fewest debonded strands (then the shortest
     lengths) that pass. Steps: the strengths as search() (the entered, the entered f′c with the highest f′ci, the highest); (1) the fewest
     straight strands N1 passing Strength I flexure and Service III tension (bisection, no debonding); (2) N = N1, N1 + 2, …: no debonding,
     then D = 2, 4, … debonded strands (debRows), the shortest first length l0 (1 ft grid) at which the release checks pass (bisection,
     longer debonding relieving the end more: assumed, AD-D8 as the drape), then every check; (3) the lowest f′c / f′ci as search(). */
  function* searchStraight(P, k, girder, o, ctx, log) {
    const b0 = window.PSBBridge.effBase(P, k), base = Object.assign(J(b0), { girder }), C = conc(P, k, o);
    const res = { girder, best: null, trials: 0, closest: null, why: '', level: null, pattern: 'straight' };
    const h = window.PSBInputCheck.depthOf(base), h0 = window.PSBInputCheck.depthOf(b0);
    const upper = r => isNum(+r.y) && +r.y > h0 / 2, ent = (Array.isArray(b0.rows) ? b0.rows : []).filter(r => r && typeof r === 'object');
    const tops = ent.filter(upper).map(r => Object.assign(J(r), { y: R2(h - (h0 - +r.y)) })), nTop = tops.reduce((a, r) => a + (+r.n || 0), 0);
    const L = +lineInputs(P, k, window.PSBBridge.typeLines(P, k)[0], base).L;
    const mk = (rows, fc, fci) => { const e = J(base); e.rows = J(rows).concat(J(tops)); e.harp = Object.assign({}, b0.harp, { n: 0 }); e.mat = Object.assign({}, e.mat, { fc, fci }); return e; };
    const note = (what, r) => { res.trials++;
      if (r.gov && (!res.closest || r.fails.length < res.closest.fails.length || (r.fails.length === res.closest.fails.length && r.gov.r < res.closest.gov.r))) res.closest = { what, fails: r.fails.slice(), gov: r.gov };
      if (log.length < 3000) log.push({ k, girder, what, pass: r.pass, fails: r.fails.slice(0, 4), gov: r.gov ? { n: r.gov.n, r: r.gov.r, g: r.gov.g } : null });
      if (ctx.runs >= o.maxRuns) ctx.stopped = true; };
    const trial = function* (rows, fc, fci, what, full) { const r = evalCand(P, k, mk(rows, fc, fci), ctx, !!full, true); note(what, r); yield { i: ctx.runs, msg: `${girder}: ${what}` }; return r; };
    const dTxt = rw => { const d = rw.filter(r => r.nd > 0); return d.length ? `, debonded ${d.map(r => `${r.nd} at y ${r.y} in for ${r.dbnd} ft`).join(', ')}` : ''; };
    const top = C.fc.length ? C.fc[C.fc.length - 1] : null, hiFci = f => { const q = C.fciOf(f); return q.length ? q[q.length - 1] : null; };
    const fc0 = +b0.mat.fc, fci0 = +b0.mat.fci, levels = [];
    const addL = (fc, fci, lab) => { if (fc == null || fci == null || !(fci <= fc + 1e-9)) return; if (!levels.some(q => q.fc === fc && q.fci === fci)) levels.push({ fc, fci, lab }); };
    if (C.lock) addL(fc0, fci0, 'the entered f′c / f′ci (locked)');
    else { if (C.fc.includes(R2(fc0)) && C.fciOf(R2(fc0)).includes(R2(fci0))) addL(R2(fc0), R2(fci0), 'the entered f′c / f′ci');
      if (C.fc.includes(R2(fc0))) addL(R2(fc0), hiFci(R2(fc0)), 'the entered f′c, the highest f′ci');
      addL(top, top != null ? hiFci(top) : null, 'the highest f′c and f′ci'); }
    if (!levels.length) { res.why = 'no f′c / f′ci in the ranges searched'; return res; }
    const rows = rowsOf(P, k, base, ctx), capS = rows.reduce((a, q) => a + q.cap, 0) - (rows.reduce((a, q) => a + q.cap, 0) % 2);
    if (!rows.length) { res.why = 'no strand row fits the section'; return res; }
    const owner = window.PBD && window.PBD.ownerOf ? window.PBD.ownerOf(base) : 'AASHTO', rDb = rule(owner, 'db.max');
    { const LT = levels[levels.length - 1], r = yield* trial(fill(rows, capS, []), LT.fc, LT.fci, `straight: every row full (${capS} straight), ${LT.lab}`, true);   // the quick reject of search()
      if (r.fails.includes('LL deflection')) { res.why = 'the live-load deflection fails at the highest f′c (the section\'s stiffness: no strand pattern changes it)'; return res; }
      if (!(r.lines && !r.err && !r.fails.includes('Flexure') && !r.fails.includes('Srv III tens'))) { res.why = `Strength I flexure or Service III tension fails with every row full (${capS} straight strands) at the highest f′c`; return res; } }
    const lMax = Math.floor(Math.min(0.20 * L, L / 2) + 1e-9);   // the 1 ft grid up to 0.20 L (5.9.4.3.3(G)'s first limit; the engine checks the second)
    let pat = null;
    for (const lv of levels) {
      const okS = r => r.lines && !r.err && r.fails.every(n => !(n === 'Flexure' || n === 'Srv III tens'));
      const s1 = function* (Ns) { const rw = fill(rows, Ns, []); if (!rw) return false; return okS(yield* trial(rw, lv.fc, lv.fci, `straight, step 1: ${Ns} straight, no debonding, ${lv.lab}`, true)); };
      let lo = 2, hi = capS; if (!(yield* s1(hi))) continue;
      while (hi - lo > 2) { const mid = lo + 2 * Math.floor((hi - lo) / 4); if (yield* s1(mid)) hi = mid; else lo = mid; }
      const N1 = (yield* s1(lo)) ? lo : hi;
      outer: for (let Ns = N1; Ns <= capS; Ns += 2) {
        const rw = fill(rows, Ns, []); if (!rw) break;
        const r0 = yield* trial(rw, lv.fc, lv.fci, `straight: N ${Ns + nTop}, no debonding, ${lv.lab}`); if (ctx.stopped) break outer;
        if (r0.pass) { pat = { rows: rw, N: Ns + nTop, D: 0, lv }; break; }
        const rel = r0.fails.filter(n => !GROW.includes(n) && !RELEASE.includes(n));
        if (rel.length) { res.why = `no straight pattern passes at N = ${Ns + nTop}: ${rel.join(', ')} fails and is not changed by more strands or debonding`; break; }
        const dc = debCaps(P, k, base, rw), Dcap = dc.caps.reduce((a, c) => a + c, 0), Dmax = rDb ? Math.min(Dcap, 2 * Math.floor(rDb.value * (Ns + nTop) / 2 + 1e-9)) : Dcap;
        if (r0.fails.some(n => RELEASE.includes(n))) for (let D = 2; D <= Dmax; D += 2) {
          const nd = debRows(rw, dc.caps, D, dc.nTerm(D)); if (!nd) break;
          const nRow = nd.filter(x => x > 0).length, l1 = lMax - (nRow - 1) * dc.dStep; if (l1 < 1) break;   // every length within 0.20 L
          const at = function* (l0) { return yield* trial(withDeb(rw, nd, l0, dc.dStep), lv.fc, lv.fci, `straight: N ${Ns + nTop}${dTxt(withDeb(rw, nd, l0, dc.dStep))}, ${lv.lab}`); };
          const relOK = r => r.lines && !r.err && !r.fails.some(n => RELEASE.includes(n));
          const rT = yield* at(l1); if (ctx.stopped) break outer;
          if (!relOK(rT)) continue;   // even the longest debonding leaves a release check failing: more debonded strands
          let a = 0, c = l1, rc = rT; while (c - a > 1) { const m = (a + c) >> 1, r = yield* at(m); if (ctx.stopped) break outer; if (relOK(r)) { c = m; rc = r; } else a = m; }
          if (rc.pass) { pat = { rows: withDeb(rw, nd, c, dc.dStep), N: Ns + nTop, D, lv }; break outer; }
          // the shortest lengths pass the release checks but another check fails: longer lengths up to l1 (one pass each way, the 1 ft grid)
          let found = null; for (let l0 = c + 1; l0 <= l1 && !found; l0++) { const r = yield* at(l0); if (ctx.stopped) break outer; if (r.pass) found = l0; }
          if (found) { pat = { rows: withDeb(rw, nd, found, dc.dStep), N: Ns + nTop, D, lv }; break outer; }
        }
        if (!r0.fails.some(n => GROW.includes(n)) && !r0.fails.some(n => RELEASE.includes(n))) break;
      }
      if (pat || ctx.stopped) break;
    }
    if (!pat) { if (!res.why) res.why = ctx.stopped ? 'stopped' : 'no straight strand pattern with debonding passes'; return res; }
    res.level = pat.lv.lab;
    let fc = pat.lv.fc, fci = pat.lv.fci;
    if (!C.lock) {
      for (const f of C.fc) { if (f > fc + 1e-9) break; const fi = hiFci(f); if (fi == null) continue; if (f === fc && fi <= fci) break;
        const r = yield* trial(pat.rows, f, fi, `straight, step 3: f′c ${f} ksi, f′ci ${fi} ksi`); if (r.pass) { fc = f; fci = fi; break; } }
      for (const fi of C.fciOf(fc)) { if (fi >= fci - 1e-9) break; const r = yield* trial(pat.rows, fc, fi, `straight, step 3: f′c ${fc} ksi, f′ci ${fi} ksi`); if (r.pass) { fci = fi; break; } }
    }
    const e = mk(pat.rows, fc, fci), r = evalCand(P, k, e, ctx, true, true);
    if (!r.pass) { res.why = 'the final design does not pass (unexpected)'; return res; }
    const W = r.lines.reduce((a, q) => a + q.R.g.wsw * (q.R.L + 2 * (+e.opt.endOh || 0) / 12), 0);
    res.best = { k, girder, N: pat.N, nh: 0, nTop, rows: e.rows, harp: e.harp, fc, fci, eff: e, ev: r, W, hd: null, pattern: 'straight', nDeb: e.rows.reduce((a, q) => a + (q.dbnd > 0 ? +q.nd || 0 : 0), 0) };
    return res;
  }
  /* searchPat(P, k, girder, o, ctx, log): the design of type k on the section by the pattern setting. 'both': the draped and the straight
     design, the choice: fewer strands N, then fewer special strands (draped n_h, or debonded), then the draped (Decision PSAD-D11); MassDOT
     3.7.2.2: for box beams, NEBT and NEDBT the straight design first whenever one passes. */
  function* searchPat(P, k, girder, o, ctx, log) {
    if (o.pattern === 'straight') return yield* searchStraight(P, k, girder, o, ctx, log);
    const a = yield* search(P, k, girder, o, ctx, log); if (o.pattern !== 'both' || ctx.stopped) return a;
    const b = yield* searchStraight(P, k, girder, o, ctx, log);
    a.alt = b; b.alt = a;
    if (!b.best) return a; if (!a.best) return Object.assign(b, { trials: a.trials + b.trials });
    const md = window.PBD && window.PBD.ownerOf && window.PBD.ownerOf(window.PSBBridge.effBase(P, k)) === 'MassDOT', SC = window.PSBSections;
    const fam = SC && Object.prototype.hasOwnProperty.call(SC.MD, girder) ? SC.MD[girder].src.fam : '', mdPref = md && (family(girder).fam === 'adj' || family(girder).fam === 'spread' || fam === 'nebt' || fam === 'nedbt');
    const pick = mdPref ? b : (b.best.N < a.best.N || (b.best.N === a.best.N && b.best.nDeb < a.best.nh)) ? b : a;
    pick.trials = a.trials + b.trials; if (mdPref) pick.why = 'MassDOT 3.7.2.2: straight debonded strands preferred'; return pick;
  }

  /* hdOf(ev): the hold-down check of the worst line (F_hd / limit), or null */
  const hdOf = ev => { let q = null; (ev.lines || []).forEach(l => l.R.checks.forEach(c => { if (HD.test(c.n) && (!q || c.r > q.r)) q = { n: c.n, r: c.r, g: l.g }; })); return q; };

  /* evalCurrent(P, k, ctx): the current design of type k (for the comparison row) */
  function evalCurrent(P, k, ctx) { const e = window.PSBBridge.effBase(P, k); return { eff: e, ev: evalCand(P, k, e, ctx, true) }; }

  /* ---------- the girder count (PSAD-B, item 1) ---------- */
  /* nbLock(P): why the girder count cannot be searched ('' when it can): adjacent members and NEXT beams (their width sets the lines),
     entered distribution factors or live load, a demand table or imported demands (a count change would not change them), no
     cross-section. Decision PSAD-D5 (pending engineer review). */
  function nbLock(P) {
    const BR = window.PSBBridge, xs = P.xs || {}, nb = xs.nb;
    if (!(Number.isInteger(nb) && nb >= 2 && Array.isArray(xs.bays) && xs.bays.length === nb - 1)) return 'no cross-section of two girders or more';
    const ks = BR.types(P).map((T, k) => k).filter(k => BR.typeLines(P, k).length);
    for (const k of ks) { const b = BR.effBase(P, k), f = family(b.girder).fam;
      if (f === 'adj' || f === 'slab' || f === 'next' || f === 'nextd') return 'adjacent members and NEXT beams: their width sets the girder lines';
      if (b.loads && b.loads.dfAuto === false) return 'distribution factors entered (Loads tab)';
      if (b.loads && b.loads.llAuto === false) return 'live-load moment and shear entered (Loads tab)'; }
    const DM = window.PSBDemands; if (DM && DM.anyExt && DM.anyExt(P)) return 'a demand table or imported demands (Loads tab)';
    return '';
  }
  /* counts(P, o): { list: [N_b … searched, the current first], why } */
  function counts(P, o) {
    const xs = P.xs || {}, nb0 = xs.nb, v = o.vars.nb;
    if (v === 'lock') return { list: [nb0], why: 'locked (the current count)' };
    const lk = nbLock(P); if (lk) return { list: [nb0], why: `the current count only (${lk})` };
    const W = xs.bays.reduce((a, b) => a + +b, 0), lo = Math.max(S_LO, isNum(o.sLo) ? o.sLo : -Infinity), hi = Math.min(S_HI, isNum(o.sHi) ? o.sHi : Infinity);
    let L;
    if (v === 'range') { const a = Math.max(2, Math.round(isNum(o.nbMin) ? o.nbMin : nb0)), c = Math.round(isNum(o.nbMax) ? o.nbMax : nb0); L = []; for (let n = a; n <= c && n < 100; n++) L.push(n); if (!L.length) L = [nb0]; }
    else L = [nb0 - 1, nb0, nb0 + 1].filter(n => n >= 3 && (n === nb0 || (W / (n - 1) >= lo - 1e-9 && W / (n - 1) <= hi + 1e-9)));
    if (!L.includes(nb0) && v !== 'range') L.push(nb0);
    L = [...new Set(L)].sort((a, c) => (a === nb0 ? -1 : c === nb0 ? 1 : a - c));
    return { list: L, why: v === 'range' ? `the counts ${L.slice().sort((a, c) => a - c).join(', ')} (Range)` : `the current count ± 1 with the spacing S = W_cc / (N_b − 1) from ${fx2(lo)} to ${fx2(hi)} ft (W_cc = ${fx2(W)} ft)` };
  }
  const fx2 = v => (Math.round(v * 100) / 100).toFixed(2);
  /* applyLayout(Q, n): Q (changed in place) with n girders: every bay S = W_cc / (n − 1), W_cc = Σ bays (equal spacing: xs.Wcc = W_cc), the
     overhangs kept; the girder types re-assigned (PSBBridge.renumber, the page's rule on a count change); the design girder within N_b;
     an entered b_eff (base or a type's override) back to the calculated width (the BEFF-3 rule of the Steel Bridge app). Returns the notes. */
  function applyLayout(Q, n) {
    const BR = window.PSBBridge, xs = Q.xs, nb0 = xs.nb, notes = []; if (n === nb0) return notes;
    const W = xs.bays.reduce((a, b) => a + +b, 0), S = W / (n - 1), LT0 = BR.hasTypes(Q) ? BR.snapshot(Q) : null;
    xs.nb = n; xs.bays = new Array(n - 1).fill(S); if (xs.spMode === 'equal') xs.Wcc = W;
    notes.push(`Girder count ${nb0} → ${n}: every bay S = ${fx2(W)} / (${n} − 1) = ${fx2(S)} ft, the overhangs ${fx2(+xs.ohL)} / ${fx2(+xs.ohR)} ft kept`);
    if (LT0) { const ch = BR.renumber(Q, nb0, LT0); if (ch.length) notes.push(`the girder types' lines re-assigned: ${ch.map(q => `S${q.s} G${q.g}: ${q.from || 'no type'} → ${q.to || 'removed'}`).join('; ')}`); }
    if (Q.design && Number.isInteger(Q.design.g) && Q.design.g > n) Q.design.g = n;
    const bo = []; if (Q.base && Q.base.beffAuto === false) { Q.base.beffAuto = true; bo.push('the base design'); }
    (Array.isArray(Q.types) ? Q.types : []).forEach(T => { if (T.ovr && T.ovr.beffAuto === false) { delete T.ovr.beffAuto; if (Q.base.beffAuto === false) T.ovr.beffAuto = true; bo.push(T.label); } });
    if (bo.length) notes.push(`the entered effective flange width of ${bo.join(', ')} set back to the calculated width (it was for the old spacing)`);
    return notes;
  }
  /* layoutFor(P, n): a copy of P with n girders (applyLayout), or P itself for the current count */
  function layoutFor(P, n) { if (n === P.xs.nb) return { Q: P, notes: [] }; const Q = J(P), notes = applyLayout(Q, n); return { Q, notes }; }

  /* run(P, o): every span of the project; o = settings(P) by default. Generator: yields progress, returns
     { spans: [{ s, why, sections: [{ name, A, h, pass, types: [{ k, res }] }], cands: [section entries that pass], types: [k] }],
       cur: { k: evalCurrent }, log, runs, ms, stopped } */
  function* run(P, o) {
    o = o || settings(P); const BR = window.PSBBridge, t0 = Date.now();
    const ctx = { cache: new Map(), fit: new Map(), rows: new Map(), runs: 0, first: {}, stopped: false, o }, log = [];
    const out = { spans: [], cur: {}, log, runs: 0, ms: 0, stopped: false, o };
    // PSAD-B: the girder counts searched (one: the code before, unchanged); each count's layout and its own fit / row / line-order caches
    const NB = o.mode === 'refine' ? { list: [P.xs.nb], why: 'Refine keeps the layout (the current count)' } : counts(P, o), multi = NB.list.length > 1;
    out.nb = { list: NB.list.slice(), why: NB.why, cur: P.xs.nb, notes: {} };
    const lays = new Map(), ctxN = new Map(), useN = n => { const c = ctxN.get(n); ctx.fit = c.fit; ctx.rows = c.rows; ctx.first = c.first; };
    if (multi) NB.list.forEach(n => { const L = layoutFor(P, n); lays.set(n, L); out.nb.notes[n] = L.notes; ctxN.set(n, n === P.xs.nb ? { fit: ctx.fit, rows: ctx.rows, first: ctx.first } : { fit: new Map(), rows: new Map(), first: {} }); });
    for (let s = 1; s <= P.spans.lengths.length; s++) {
      if (multi) useN(P.xs.nb);
      const ks = BR.spanTypes(P, s).filter(k => BR.typeLines(P, k).length); if (!ks.length) continue;
      ks.forEach(k => { out.cur[k] = evalCurrent(P, k, ctx); });
      const ref = o.mode === 'refine', S = sections(P, s, ref ? Object.assign({}, o, { vars: Object.assign({}, o.vars, { section: 'lock' }) }) : o), sp = { s, why: ref ? S.why.replace(/\(locked\)/, '(Refine keeps the section)') : S.why, types: ks, sections: [], cands: [] };
      out.spans.push(sp);
      if (ref) {   // Refine: the current section; span candidate i = each type's design i of its list (its last when shorter)
        const sec = S.list[0], R = {};
        for (const k of ks) { R[k] = yield* refine(P, k, sec ? sec.name : BR.effBase(P, k).girder, o, ctx, log); if (!R[k].best || ctx.stopped) break; }
        const ok = ks.every(k => R[k] && R[k].best), n = ok ? Math.max(...ks.map(k => R[k].list.length)) : 1;
        for (let i = 0; i < n; i++) { const ent = { name: sec ? sec.name : '', A: sec ? sec.A : NaN, h: sec ? sec.h : NaN, pass: ok, ri: i, types: ks.filter(k => R[k]).map(k => ({ k, res: ok ? Object.assign({}, R[k], { best: R[k].list[Math.min(i, R[k].list.length - 1)] }) : R[k] })) };
          sp.sections.push(ent); if (ok) { ent.W = ent.types.reduce((a, q) => a + q.res.best.W, 0); sp.cands.push(ent); } }
        if (!sp.cands.length) { let bl = null; const and = f => { bl = bl ? bl.filter(n => f.includes(n)) : f.slice(); };
          ks.forEach(k => and(out.cur[k].ev.fails)); ks.forEach(k => { if (R[k] && !R[k].best) and(R[k].closest ? R[k].closest.fails : []); }); sp.blocked = bl || []; }
        if (ctx.stopped) break;
        continue;
      }
      if (multi) {   // PSAD-B: every (count, section) in the order of the objective; the first topN that pass every type of the span
        const jobs = []; NB.list.forEach((n, ni) => S.list.forEach((sec, si) => jobs.push({ n, ni, sec, si, w: sec.A * n })));
        jobs.sort((a, c) => o.objective === 'depth' ? (a.sec.h - c.sec.h || a.w - c.w || a.ni - c.ni || a.si - c.si) : (a.w - c.w || a.sec.h - c.sec.h || a.ni - c.ni || a.si - c.si));
        sp.labels = {}; const kAll = new Set(ks);
        for (const j of jobs) {
          const Q = lays.get(j.n).Q, ksn = BR.spanTypes(Q, s).filter(k => BR.typeLines(Q, k).length); useN(j.n);
          ksn.forEach(k => { kAll.add(k); if (sp.labels[k] == null) sp.labels[k] = BR.types(Q)[k].label; });
          const ent = { name: j.sec.name, A: j.sec.A, h: j.sec.h, pass: true, types: [], nb: j.n, S: Q.xs.bays[0] };
          sp.sections.push(ent);
          for (const k of ksn) { const res = o.pattern === 'draped' ? yield* search(Q, k, j.sec.name, o, ctx, log) : yield* searchPat(Q, k, j.sec.name, o, ctx, log); ent.types.push({ k, res }); if (!res.best) { ent.pass = false; break; } if (ctx.stopped) break; }
          if (ctx.stopped) { ent.pass = ent.pass && ent.types.length === ksn.length; break; }
          if (ent.pass) { ent.W = ent.types.reduce((a, q) => a + q.res.best.W, 0); sp.cands.push(ent); if (sp.cands.length >= o.topN) break; }
        }
        sp.types = [...kAll].sort((a, c) => a - c); ks.forEach(k => { if (sp.labels[k] == null) sp.labels[k] = BR.types(P)[k].label; });
        if (!sp.cands.length) { let bl = null; const and = f => { bl = bl ? bl.filter(n => f.includes(n)) : f.slice(); };
          ks.forEach(k => and(out.cur[k].ev.fails)); sp.sections.forEach(e => e.types.forEach(q => { if (!q.res.best) and(q.res.closest ? q.res.closest.fails : []); }));
          sp.blocked = bl || []; }
        if (ctx.stopped) break;
        continue;
      }
      for (const sec of S.list) {
        const ent = { name: sec.name, A: sec.A, h: sec.h, pass: true, types: [] };
        sp.sections.push(ent);
        for (const k of ks) {
          const res = o.pattern === 'draped' ? yield* search(P, k, sec.name, o, ctx, log) : yield* searchPat(P, k, sec.name, o, ctx, log);
          ent.types.push({ k, res });
          if (!res.best) { ent.pass = false; break; }   // the other types of the span need not be run on this section
          if (ctx.stopped) break;
        }
        if (ctx.stopped) { ent.pass = ent.pass && ent.types.length === ks.length; break; }
        if (ent.pass) { ent.W = ent.types.reduce((a, q) => a + q.res.best.W, 0); sp.cands.push(ent); if (sp.cands.length >= o.topN) break; }
      }
      /* no candidate: the checks that fail on the current design and on the closest trial of every girder type on every section tried
         (blocked: not changed by the variables searched) */
      if (!sp.cands.length) { let bl = null; const and = f => { bl = bl ? bl.filter(n => f.includes(n)) : f.slice(); };
        ks.forEach(k => and(out.cur[k].ev.fails)); sp.sections.forEach(e => e.types.forEach(q => { if (!q.res.best) and(q.res.closest ? q.res.closest.fails : []); }));
        sp.blocked = bl || []; }
      if (ctx.stopped) break;
    }
    out.runs = ctx.runs; out.ms = Date.now() - t0; out.stopped = ctx.stopped;
    if (multi) {   // the count every span can take with the least concrete in all (each span's lightest candidate at it); the spans' default choice
      const tot = n => { let w = 0; for (const sp of out.spans) { const c = sp.cands.filter(e => e.nb === n); if (!c.length) return Infinity; w += Math.min(...c.map(e => e.W)); } return w; };
      const pick = NB.list.reduce((b, n) => tot(n) < tot(b) - 1e-9 ? n : b, NB.list[0]);
      out.nb.pick = isFinite(tot(pick)) ? pick : null;
      out.sel = {}; out.spans.forEach(sp => { const i = sp.cands.findIndex(e => e.nb === out.nb.pick); out.sel[sp.s] = i >= 0 ? i : 0; });
    }
    return out;
  }
  function runSync(P, o) { const it = run(P, o); let r = it.next(); while (!r.done) r = it.next(); return r.value; }

  /* apply(P, Res, choice): choice = { <span>: index into that span's cands } (default 0): every girder type of each span takes its candidate's
     section, strand rows, draped strands, f′c and f′ci as its own inputs (PSBBridge.setOvr: the override against the base design; the shape
     for every type of the span, PS-8). Other inputs are not changed. Returns { changed: [{ k, label, from, to }], note }. */
  function apply(P, Res, choice) {
    const BR = window.PSBBridge, out = [], pickOf = sp => sp.cands[choice && choice[sp.s] != null ? choice[sp.s] : (Res.sel && Res.sel[sp.s]) || 0];
    // PSAD-B: a candidate at another girder count: every span's choice must have the same count; the layout first (one step with the designs)
    const nbs = [...new Set(Res.spans.map(pickOf).filter(Boolean).map(c => c.nb != null ? c.nb : P.xs.nb))];
    if (nbs.length > 1) return { changed: [], note: '', err: `The candidates chosen have different girder counts (${nbs.join(', ')}): choose candidates of one count in every span.` };
    const lay = nbs.length && nbs[0] !== P.xs.nb ? applyLayout(P, nbs[0]) : [];
    Res.spans.forEach(sp => { const c = pickOf(sp); if (!c) return;
      c.types.forEach(({ k, res }) => { const T = P.types[k], b = res.best; if (!T || !b) return;
        const eff = BR.effBase(P, k), from = `${eff.girder}, ${countOf(eff)} strands (${+eff.harp.n || 0} draped), f′c ${eff.mat.fc} / f′ci ${eff.mat.fci} ksi`;
        eff.girder = b.girder; eff.rows = J(b.rows); eff.harp = J(b.harp); eff.mat = Object.assign({}, eff.mat, { fc: b.fc, fci: b.fci });
        BR.setOvr(P, k, eff);
        out.push({ k, label: T.label, from, to: `${b.girder}, ${b.N} strands (${b.nh} draped), f′c ${b.fc} / f′ci ${b.fci} ksi` }); }); });
    return { changed: out, layout: lay, note: out.length ? `Auto design applied: ${lay.length ? lay.join('; ') + '; ' : ''}${out.map(q => `${q.label}: ${q.from} → ${q.to}`).join('; ')}.` : '' };
  }
  const countOf = b => (Array.isArray(b.rows) ? b.rows : []).reduce((a, q) => a + (+q.n || 0), 0) + (+(b.harp || {}).n || 0);

  window.PSBAutoDesign = { DEF, FRACS, GROW, RULE, settings, refine, distance, cmpDist, modRows, over, counts, nbLock, applyLayout, layoutFor, S_LO, S_HI, debCaps, debRows, withDeb, searchStraight, searchPat, DEB_W, family, sections, conc, rowsOf, fill, drapes, lineInputs, fitErrors, evalCand, search, run, runSync, apply, countOf, hdOf };
})();
