/* apps/steel-bridge/engine/rolled.js — rolled-beam (AISC W-shape) girder segments (window.SBDRolled).
   Classic script, no DOM. Needs window.SharedAiscW (shared/aisc-w.js, the AISC Shapes Database v16.0 W table) and, for the worked
   steps, window.SharedSteps (shared/steps.js). Created 2026-11-23 (engineer request: a rolled-beam girder picked from a list).

   How a rolled shape is modelled (Decision, pending engineer review; fixlog/steel-bridge.md "ROLL"):
   A plate segment may carry the OPTIONAL field  segments[i].shape  (the designation, e.g. "W36X135"). Picking a shape writes its
   EQUIVALENT THREE PLATES into the segment's existing plate fields:
       top and bottom flange  b_f × t_f          (topB = botB = b_f, topT = botT = t_f)
       web                    D = d − 2 t_f,  t_w   (the clear distance between the flanges)
   so every check of the app (section properties, flexure, shear, proportions, fatigue, stiffeners, splices, studs, cross-frame fit,
   camber, drawings, the MIDAS .lga export, the hand-offs) reads the same plate fields as before and runs unchanged. The web-to-flange
   fillets of the rolled shape are not in the three plates: the area and the moment of inertia of the three plates are the tabulated
   A and I_x less the fillets (for the 289 shapes: A between −2.7 % and +0.5 %, I_x between −4.1 % and +0.7 % of the tabulated values;
   above 0 only where the tabulated dimensions are rounded up; steps() shows both and the ratio for the shape picked).
   What differs for a rolled segment (each read through this file):
     - weight: the tabulated nominal weight W (lb/ft) in place of the three plates × 490 pcf (wtA below);
     - no flange-to-web weld (Welds tab, weld quantities of the drawings);
     - one grade of steel (hybridErr below; AASHTO LRFD 10th Ed. Art. 6.10.1.3 is for hybrid built-up sections);
     - the plate fields are read-only on the Girders tab, and the plate Auto design does not run (the W-shape search does, lightest).
   A segment is a rolled segment only while (a) its shape is in the table and (b) its stored plates are the shape's equivalent plates.
   Otherwise it is a plate segment with its stored plates, and warnings() says why (a name not in the list; plates changed after the
   pick). Nothing is rewritten on load and no stored value is dropped (CLAUDE.md §5).

   Units: in, in^2, in^4; W lb/ft; x ft. */
(function () {
  'use strict';
  const STEEL_PLF = 490 / 144;   // lb/ft per in² of steel (0.490 kcf, AASHTO LRFD Table 3.5.1-1), as engine/loads.js
  const KEYS = ['D', 'tw', 'topB', 'topT', 'botB', 'botT'];
  const DB = () => window.SharedAiscW;
  const St = () => window.SharedSteps;
  const r4 = v => +(+v).toFixed(4);

  /* plates(sh): the equivalent three plates of the shape sh (SharedAiscW.get): D = d − 2 t_f (rounded to 0.0001 in, clear of the
     binary noise of the subtraction), t_w, b_f × t_f both flanges */
  function plates(sh) { return { D: r4(sh.d - 2 * sh.tf), tw: sh.tw, topB: sh.bf, topT: sh.tf, botB: sh.bf, botT: sh.tf }; }

  /* state(seg): { status, name, sh, pl }
       status 'plate'   no shape on the segment (every project before 2026-11-23)
              'rolled'  the shape is in the table and the stored plates are its equivalent plates
              'unknown' a shape name that is not in the table: plate segment with the stored plates
              'edited'  the shape is in the table but the stored plates differ from its equivalent plates: plate segment, stored plates
     name: the stored name (as typed); sh: the table's shape (rolled, edited); pl: its equivalent plates */
  function state(seg) {
    const raw = seg && seg.shape;
    if (raw == null || raw === '') return { status: 'plate', name: '', sh: null, pl: null };
    const sh = DB() && typeof raw === 'string' ? DB().get(raw) : null;
    if (!sh) return { status: 'unknown', name: String(raw), sh: null, pl: null };
    const pl = plates(sh), same = KEYS.every(k => Math.abs(+seg[k] - pl[k]) <= 1e-9);
    return { status: same ? 'rolled' : 'edited', name: sh.name, sh, pl };
  }
  const shapeOf = seg => { const s = state(seg); return s.status === 'rolled' ? s.sh : null; };
  const isRolled = seg => !!shapeOf(seg);
  const label = seg => { const sh = shapeOf(seg); return sh ? sh.name : ''; };
  const girderRolled = g => !!(g && Array.isArray(g.segments) && g.segments.some(isRolled));
  const anyRolled = P => !!(P && Array.isArray(P.girders) && P.girders.some(girderRolled));

  /* apply(seg, name): writes the shape and its equivalent plates into the segment; false (segment unchanged) when the name is not
     in the table. clear(seg): back to a plate segment: the shape name is removed, the plates stay as they are (now editable). */
  function apply(seg, name) {
    const sh = DB() ? DB().get(name) : null; if (!sh || !seg) return false;
    Object.assign(seg, plates(sh)); seg.shape = sh.name; return true;
  }
  function clear(seg) { if (seg) delete seg.shape; }

  /* wtA(seg): the steel area that gives the segment's weight at 490 pcf: a rolled segment, W / (490/144) (so that A × 490/144 is the
     tabulated nominal weight W, lb/ft); a plate segment, null (the caller's own three-plate expression, unchanged). */
  function wtA(seg) { const sh = shapeOf(seg); return sh ? sh.W / STEEL_PLF : null; }
  /* plf(seg): the tabulated weight of a rolled segment, lb/ft; null for a plate segment */
  function plf(seg) { const sh = shapeOf(seg); return sh ? sh.W : null; }

  /* warnings(P): [{ path, msg }] for the segments whose shape is not used (status unknown / edited). Not errors: the stored plates
     are computed, as a plate girder. */
  function warnings(P) {
    const out = [];
    ((P && P.girders) || []).forEach((g, gi) => ((g && g.segments) || []).forEach((s, si) => {
      const q = state(s), at = `${g.label || g.id} segment ${si + 1}`;
      if (q.status === 'unknown') out.push({ path: `girders.${gi}.segments.${si}.shape`, msg: `${at}: the rolled shape "${q.name}" is not in the W-shape list (${DB() ? DB().VERSION : 'list not loaded'}). The stored plate sizes are used, as a plate girder. Pick a shape again, or set the segment to Plate girder.` });
      if (q.status === 'edited') out.push({ path: `girders.${gi}.segments.${si}.shape`, msg: `${at}: the stored plate sizes are not those of ${q.name} (they were changed after the shape was picked). The stored plate sizes are used, as a plate girder. Pick ${q.name} again to restore the shape, or set the segment to Plate girder.` });
    }));
    return out;
  }
  /* hybridErr(P): [{ path, msg }]: a project with a rolled segment needs one steel grade for the flanges and the web (a rolled shape
     is one piece of steel; the hybrid factor R_h of Art. 6.10.1.10.1 is for built-up sections with a lower-strength web). */
  function hybridErr(P) {
    const st = ((P && P.materials) || {}).steel || {};
    if (!anyRolled(P) || (st.top === st.bot && st.bot === st.web)) return [];
    return [{ path: 'materials.steel.web', msg: `A rolled shape is one grade of steel: set the top flange, bottom flange and web to the same grade (now ${st.top} / ${st.bot} / ${st.web}), or set every segment to Plate girder.` }];
  }

  /* props(sh): the three-plate values next to the tabulated ones: { pl, A3, I3, rA (A3 / A), rI (I3 / I_x), W3 (three plates at 490 pcf,
     lb/ft) } */
  function props(sh) {
    const pl = plates(sh), A3 = 2 * sh.bf * sh.tf + pl.D * sh.tw;
    const I3 = 2 * (sh.bf * sh.tf ** 3 / 12 + sh.bf * sh.tf * ((sh.d - sh.tf) / 2) ** 2) + sh.tw * pl.D ** 3 / 12;
    return { pl, A3, I3, rA: A3 / sh.A, rI: I3 / sh.Ix, W3: A3 * STEEL_PLF };
  }

  /* steps(seg): the worked steps of a rolled segment: the shape, its tabulated values and the three-plate idealisation used
     (shared/steps.js format); [] for a plate segment. */
  function steps(seg) {
    const sh = shapeOf(seg); if (!sh || !St()) return [];
    const S = St(), n = (v, d) => S.n(v, d), q = props(sh), w = S.work('rolled'), ref = `${DB().VERSION}, ${sh.name}`;
    w.add({ id: 'd', label: `Rolled shape ${sh.name}: depth (tabulated)`, sym: 'd', eq: '', sub: '', value: sh.d, unit: 'in', d: 3, ref });
    w.add({ id: 'bf', label: 'Flange width (tabulated)', sym: 'b_{f}', eq: '', sub: '', value: sh.bf, unit: 'in', d: 3, ref });
    w.add({ id: 'tf', label: 'Flange thickness (tabulated)', sym: 't_{f}', eq: '', sub: '', value: sh.tf, unit: 'in', d: 3, ref });
    w.add({ id: 'tw', label: 'Web thickness (tabulated)', sym: 't_{w}', eq: '', sub: '', value: sh.tw, unit: 'in', d: 3, ref });
    w.add({ id: 'k', label: 'Flange face to the web toe of the fillet (tabulated; not used in a check)', sym: 'k_{des}', eq: '', sub: '', value: sh.kdes, unit: 'in', d: 3, ref });
    w.add({ id: 'A', label: 'Area (tabulated, fillets included)', sym: 'A', eq: '', sub: '', value: sh.A, unit: 'in^{2}', d: 2, ref });
    w.add({ id: 'Ix', label: 'Moment of inertia (tabulated, fillets included)', sym: 'I_{x}', eq: '', sub: '', value: sh.Ix, unit: 'in^{4}', d: 0, ref });
    w.add({ id: 'W', label: 'Nominal weight (tabulated): the girder steel weight of this segment', sym: 'W', eq: '', sub: '', value: sh.W, unit: 'lb/ft', d: 1, ref,
      note: 'Used for the girder dead load and the quantities, in place of the three plates at 490 pcf.' });
    w.add({ id: 'D', label: 'Web depth of the equivalent three-plate section: the clear distance between the flanges', sym: 'D', eq: 'd - 2t_{f}', sub: `${n(sh.d, 3)} - 2(${n(sh.tf, 3)})`, value: q.pl.D, unit: 'in', d: 4,
      note: 'Decision (pending engineer review): the checks take the rolled shape as three plates, flanges b_f × t_f and web D × t_w. D is not reduced for the fillets: the larger D gives the larger web slenderness and the smaller shear buckling resistance.' });
    w.add({ id: 'A3', label: 'Area of the three plates (fillets left out)', sym: 'A_{3}', eq: '2b_{f}t_{f} + Dt_{w}', sub: `2(${n(sh.bf, 3)})(${n(sh.tf, 3)}) + ${n(q.pl.D, 4)}(${n(sh.tw, 3)})`, value: q.A3, unit: 'in^{2}', d: 2 });
    w.add({ id: 'rA', label: 'Three-plate area over the tabulated area', sym: 'A_{3}/A', eq: '', sub: `\\frac{${n(q.A3, 2)}}{${n(sh.A, 2)}}`, value: q.rA, unit: '', d: 3 });
    w.add({ id: 'I3', label: 'Moment of inertia of the three plates (fillets left out)', sym: 'I_{3}', eq: '2\\left[\\frac{b_{f}t_{f}^{3}}{12} + b_{f}t_{f}\\left(\\frac{d - t_{f}}{2}\\right)^{2}\\right] + \\frac{t_{w}D^{3}}{12}',
      sub: `2\\left[\\frac{${n(sh.bf, 3)}(${n(sh.tf, 3)})^{3}}{12} + ${n(sh.bf, 3)}(${n(sh.tf, 3)})\\left(\\frac{${n(sh.d, 3)} - ${n(sh.tf, 3)}}{2}\\right)^{2}\\right] + \\frac{${n(sh.tw, 3)}(${n(q.pl.D, 4)})^{3}}{12}`, value: q.I3, unit: 'in^{4}', d: 0 });
    w.add({ id: 'rI', label: 'Three-plate moment of inertia over the tabulated value', sym: 'I_{3}/I_{x}', eq: '', sub: `\\frac{${S.g(q.I3, 0)}}{${S.g(sh.Ix, 0)}}`, value: q.rI, unit: '', d: 3,
      note: q.rI > 1 || q.rA > 1 ? 'Above 1.0: the tabulated dimensions of this shape are rounded up, so its three plates are slightly more than the tabulated section. The checks use the three plates.'
        : 'Below 1.0: the three plates are less than the tabulated section (the fillets), so the stresses and deflections computed are slightly larger than with the tabulated properties.' });
    return w.steps;
  }

  /* candidates(o): the shapes of the table for the W-shape search, lightest first (ties: the deeper first). o: { nomMin, nomMax
     (nominal depth, in) } (optional). */
  function candidates(o) {
    o = o || {}; const A = DB(); if (!A) return [];
    return A.names().map(nm => A.get(nm)).filter(s => (!(o.nomMin > 0) || s.nom >= o.nomMin) && (!(o.nomMax > 0) || s.nom <= o.nomMax))
      .sort((a, b) => a.W - b.W || b.d - a.d);
  }
  /* withShape(P, gi, name): a copy of the project with every rolled segment of girder type gi (or, when it has none, every segment)
     set to the shape; null when the name is not in the table. */
  function withShape(P, gi, name) {
    const Q = JSON.parse(JSON.stringify(P)), g = Q.girders[gi]; if (!g) return null;
    const idx = g.segments.map((s, i) => (isRolled(s) ? i : -1)).filter(i => i >= 0), use = idx.length ? idx : g.segments.map((_, i) => i);
    for (const i of use) if (!apply(g.segments[i], name)) return null;
    return Q;
  }
  /* lightest(P, gi, passes, o): generator of the W-shape search. Tries the candidate shapes from the lightest up, each written into
     the rolled segments of girder type gi (withShape), and stops at the first that passes(Q) → { pass, ratio, gov } (the full check
     of the project, the caller's). Yields { i, n, name } before each trial; returns
     { found: { name, W, ratio, gov, project } | null, tried: [{ name, W, pass, ratio, gov, skipped }], nFull, nSkip }.
     o.screen(Q) → ratio (optional): a quick, partial check run first; a shape whose quick ratio is above o.skipAbove (default 1.25)
     is not checked in full (skipped: true, counted in nSkip). The pass decision is always the full check's.
     The weight is the only objective: the first passing shape in ascending weight is the lightest that passes. */
  function* lightest(P, gi, passes, o) {
    o = o || {}; const C = candidates(o), tried = [], lim = o.skipAbove > 0 ? o.skipAbove : 1.25; let nFull = 0, nSkip = 0;
    for (let i = 0; i < C.length; i++) {
      yield { i, n: C.length, name: C[i].name };
      const Q = withShape(P, gi, C[i].name); if (!Q) continue;
      if (o.screen) { let q = NaN; try { q = o.screen(JSON.parse(JSON.stringify(Q))); } catch (e) { q = NaN; }
        if (q > lim) { nSkip++; tried.push({ name: C[i].name, W: C[i].W, pass: false, ratio: q, gov: null, skipped: true }); continue; } }
      let r; try { r = passes(Q) || {}; } catch (e) { r = { pass: false, ratio: NaN, gov: { title: 'not computed: ' + (e && e.message) } }; }
      nFull++; tried.push({ name: C[i].name, W: C[i].W, pass: !!r.pass, ratio: r.ratio, gov: r.gov || null });
      if (r.pass) return { found: { name: C[i].name, W: C[i].W, ratio: r.ratio, gov: r.gov || null, project: Q }, tried, nFull, nSkip };
    }
    return { found: null, tried, nFull, nSkip };
  }

  window.SBDRolled = { STEEL_PLF, KEYS, plates, state, shapeOf, isRolled, label, girderRolled, anyRolled, apply, clear, wtA, plf, warnings, hybridErr, props, steps, candidates, withShape, lightest };
})();
