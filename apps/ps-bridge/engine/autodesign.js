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

   API
     DEF, FRACS, GROW, settings(P), family(name), sections(P, s, o), owners(P, k), conc(P, k, o)
     evalCand(P, k, eff, ctx, full)  -> { pass, fails: [names], gov: { n, r, g, loc }, lines: [{ g, R }] | null, err }
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
  const DEF = { objective: 'weight', topN: 3, vars: { section: 'auto', strands: 'auto', drape: 'auto', conc: 'auto' },
    fcLo: '', fcHi: '', fciLo: 4.0, fciHi: '', maxRuns: 20000 };
  const num = (v, d) => (v === '' || v == null || !isFinite(+v)) ? d : +v;
  /* settings(P): the run's settings (P.autodesign, optional; absent = DEF) */
  function settings(P) {
    const a = (P && P.autodesign) || {}, v = Object.assign({}, DEF.vars, a.vars || {});
    Object.keys(v).forEach(k => { if (v[k] !== 'lock') v[k] = 'auto'; });
    return { objective: a.objective === 'depth' ? 'depth' : 'weight', topN: Math.max(1, Math.min(10, Math.round(num(a.topN, DEF.topN)))), vars: v,
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
  /* evalCand(P, k, eff, ctx, full): eff on every line of type k. Not full: stops at the first failing line (that line is tried first next
     time). Returns { pass, fails, gov, lines, err, fit }. */
  function evalCand(P, k, eff, ctx, full) {
    const fit = fitErrors(P, k, eff, ctx);
    if (fit.length) return { pass: false, fails: ['strand fit (input check)'], fit, gov: null, lines: null, err: '' };
    const BR = window.PSBBridge; let L = BR.typeLines(P, k).slice();
    const first = ctx.first && ctx.first[k]; if (first && L.includes(first)) L = [first, ...L.filter(g => g !== first)];
    const out = { pass: true, fails: [], gov: null, lines: [], err: '' };
    for (const g of L) {
      const R = engineRun(lineInputs(P, k, g, eff), ctx);
      if (!R || R.error) { out.pass = false; out.err = (R && R.error) || 'no result'; out.fails.push('engine error'); if (ctx.first) ctx.first[k] = g; if (!full) return out; continue; }
      out.lines.push({ g, R });
      R.checks.forEach(c => { if (!out.gov || !(c.r <= out.gov.r)) out.gov = { n: c.n, r: c.r, g, loc: c.loc }; if (!c.pass) { out.pass = false; if (!out.fails.includes(c.n)) out.fails.push(c.n); } });
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
  /* hdOf(ev): the hold-down check of the worst line (F_hd / limit), or null */
  const hdOf = ev => { let q = null; (ev.lines || []).forEach(l => l.R.checks.forEach(c => { if (HD.test(c.n) && (!q || c.r > q.r)) q = { n: c.n, r: c.r, g: l.g }; })); return q; };

  /* evalCurrent(P, k, ctx): the current design of type k (for the comparison row) */
  function evalCurrent(P, k, ctx) { const e = window.PSBBridge.effBase(P, k); return { eff: e, ev: evalCand(P, k, e, ctx, true) }; }

  /* run(P, o): every span of the project; o = settings(P) by default. Generator: yields progress, returns
     { spans: [{ s, why, sections: [{ name, A, h, pass, types: [{ k, res }] }], cands: [section entries that pass], types: [k] }],
       cur: { k: evalCurrent }, log, runs, ms, stopped } */
  function* run(P, o) {
    o = o || settings(P); const BR = window.PSBBridge, t0 = Date.now();
    const ctx = { cache: new Map(), fit: new Map(), rows: new Map(), runs: 0, first: {}, stopped: false }, log = [];
    const out = { spans: [], cur: {}, log, runs: 0, ms: 0, stopped: false, o };
    for (let s = 1; s <= P.spans.lengths.length; s++) {
      const ks = BR.spanTypes(P, s).filter(k => BR.typeLines(P, k).length); if (!ks.length) continue;
      ks.forEach(k => { out.cur[k] = evalCurrent(P, k, ctx); });
      const S = sections(P, s, o), sp = { s, why: S.why, types: ks, sections: [], cands: [] };
      out.spans.push(sp);
      for (const sec of S.list) {
        const ent = { name: sec.name, A: sec.A, h: sec.h, pass: true, types: [] };
        sp.sections.push(ent);
        for (const k of ks) {
          const res = yield* search(P, k, sec.name, o, ctx, log);
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
    return out;
  }
  function runSync(P, o) { const it = run(P, o); let r = it.next(); while (!r.done) r = it.next(); return r.value; }

  /* apply(P, Res, choice): choice = { <span>: index into that span's cands } (default 0): every girder type of each span takes its candidate's
     section, strand rows, draped strands, f′c and f′ci as its own inputs (PSBBridge.setOvr: the override against the base design; the shape
     for every type of the span, PS-8). Other inputs are not changed. Returns { changed: [{ k, label, from, to }], note }. */
  function apply(P, Res, choice) {
    const BR = window.PSBBridge, out = [];
    Res.spans.forEach(sp => { const c = sp.cands[(choice && choice[sp.s]) || 0]; if (!c) return;
      c.types.forEach(({ k, res }) => { const T = P.types[k], b = res.best; if (!T || !b) return;
        const eff = BR.effBase(P, k), from = `${eff.girder}, ${countOf(eff)} strands (${+eff.harp.n || 0} draped), f′c ${eff.mat.fc} / f′ci ${eff.mat.fci} ksi`;
        eff.girder = b.girder; eff.rows = J(b.rows); eff.harp = J(b.harp); eff.mat = Object.assign({}, eff.mat, { fc: b.fc, fci: b.fci });
        BR.setOvr(P, k, eff);
        out.push({ k, label: T.label, from, to: `${b.girder}, ${b.N} strands (${b.nh} draped), f′c ${b.fc} / f′ci ${b.fci} ksi` }); }); });
    return { changed: out, note: out.length ? `Auto design applied: ${out.map(q => `${q.label}: ${q.from} → ${q.to}`).join('; ')}.` : '' };
  }
  const countOf = b => (Array.isArray(b.rows) ? b.rows : []).reduce((a, q) => a + (+q.n || 0), 0) + (+(b.harp || {}).n || 0);

  window.PSBAutoDesign = { DEF, FRACS, GROW, settings, family, sections, conc, rowsOf, fill, drapes, lineInputs, fitErrors, evalCand, search, run, runSync, apply, countOf, hdOf };
})();
