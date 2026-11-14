/* apps/ps-bridge/engine/sections.js — the corrected box beam and voided deck slab library (window.PSBSections). Classic script, no DOM.
   Created 2026-11-14 (engineer decisions PS-30, PS-31, PS-32; fixlog/ps-bridge.md). AN APP-SIDE LIBRARY CORRECTION (CLAUDE.md §4): the moved
   engine (engine/pbd-*.js) stays byte for byte the old app's (its verbatim and parity tests unchanged); this file, loaded after it, replaces
   the old library's four box beams and two voided deck slabs in GIRDERS (the engine's own table object, its entries changed in place: no
   engine file is edited) and draws the slab voids where the plates put them (a wrapper of the engine's sectionVoids, below).

   Why: the old library's box and voided slab entries were wrong (audit 2026-11-14): their depths (12 / 18 / 27 / 33 in) are not the AASHTO
   box depths, their published I exceeds the I of the SOLID h × w rectangle (impossible), and their A / I / y_b match neither the drawn
   outline nor any one standard section.

   Source (one table for both the properties and the drawn outline):
     Box beams    CTDOT Bridge Design Manual, plate 5.2.1b "Section properties, AASHTO concrete box beams" (issue 10/03; PDF p. 327) for
                  A, I, y_b, y_t, S_b, S_t, weight; plate 5.2.1a (PDF p. 326) for the outline: actual width 35.5 in (36 series) / 47.5 in
                  (48 series), top and bottom slab 5½ in, the void centred between them, webs 5 in (BI, BII: one column of draped strands)
                  or 6 in (BIII, BIV: two columns; plates 5.2.2 / 5.2.3). The plate does not say which beam has which web: it follows from
                  the plate's own areas (A = w h − (w − 2 t_w)(h − 11) + 18 (the four 3 × 3 in void chamfers) − 13.9 (keys and ¾ in chamfers)
                  reproduces every listed A to 0.1 in² with t_w = 5 in for BI / BII and 6 in for BIII / BIV).
                  Depths 27 / 33 / 39 / 42 in (BI–BIV, engineer PS-30). The plate's "Mod." beams (24 and 45 in) are not added (not in the
                  decision; its BIV-48 Mod. A = 834.6 in² is a misprint: its weight 974 lb/ft and the series give 934.6 in²).
     Voided slabs CTDOT BDM plates 5.1.1a / 5.1.1b / 5.1.1c (36 in wide; PDF p. 312–314) and 5.1.2a / 5.1.2b / 5.1.2c (48 in wide; PDF
                  p. 315–317): SII (15 in, Ø8 in voids), SIII (18 in, Ø10), SIV (21 in, Ø12; SIV-48: Ø12, Ø10, Ø12), two voids (36 series)
                  or three (48 series) on mid-depth, actual widths 35.5 / 47.5 in. The plates do not dimension the void spacing: scaled from
                  the plate drawings (centres ±7.9 in, 36 series; 0 and ±13.8 in, 48 series), taken as ±8 in and 0, ±14 in (decision
                  pending engineer review). A, I and y_b do not depend on it (the voids are on mid-depth).
   The drawn outline (the engine's halfPolygon: the w × h rectangle; sectionVoids: the void(s)) leaves out the shear keys, the ¾ in corner
   chamfers and the 3 × 3 in void chamfers. Its A, I, y_b are within 2.5 % of the plate's (tests/engine/psbridge-sections.test.mjs). The
   computation uses the PLATE's A, I, y_b (S = I / y as the engine computes them; plate S_b, S_t agree to 0.1 %), the weight A / 144 × w_c
   (plate weights: A × 0.150 / 144); the outline is used for the drawings, the strand fit (PS-28) and A_ct (5.7.3.4.2): its void without
   the 3 × 3 in chamfers is larger than the real one, conservative for both.
   Engine fields of an entry (pbd-section.js girderGrossBase): box { box, h, w, A, I, yb, bw = 2 t_w, wall = 5.5 (bottom slab; the engine puts
   the void on it, so voidH = h − 11 centres it), voidW = w − 2 t_w, voidH }; slab { deck, h, w, A, I, yb, bw = w − Σ d (solid width at
   mid-depth), voids, voidD (the largest) }; plate data in `src` (not read by the engine).

   PS-31 (saved data, CLAUDE.md §5): a project that uses an old name is migrated when it is opened (engine/model.js importJSON; the old app
   import, ui/legacy.js): the girder of the base design and of each girder type becomes the corrected standard section of the same name
   (MAP); 'Deck slab 27×48 (voided)' has none within ±3 in (the standard voided slabs stop at 21 in), so it is left as it is and is an input
   error naming it. The old library values are kept in the project: P.legacySection = { items: [{ where, label, from, to, old, now }] }
   (optional field within schema version 1). The page shows a banner (secNotice) and the Report §2 states it.
     install()        the library change (run once on load)
     migrate(P)       PS-31 on a project: '' or the note; P.legacySection recorded (idempotent)
     withLegacy(fn)   fn() with the old entries in GIRDERS again (the old app's results of an imported design; removed after)
     items(P)         P.legacySection items; text(it) the notice text of one; retiredMsg(name) the input error of an unmatched old name
     src(name)        the plate data of a corrected section (null for any other); outline(entry) A, I, y_b of the drawn outline
     tbcNote(name)    the "to be confirmed" note of a standard section (HTML; '' for any other)
     dotJ(name)       PS-35: the DOT sheet's J of a standard section ({ J, src }), or null (none listed yet: DOT_J) */
(function () {
  'use strict';
  const BOXW = { 36: 35.5, 48: 47.5 }, SLAB = 5.5;
  /* plate 5.2.1b (PDF p. 327): [beam, series, h, web t_w, A, I, y_b, y_t, S_b, S_t, weight lb/ft] */
  const BOXES = [
    ['BI', 36, 27, 5, 554.6, 49495, 13.35, 13.65, 3709, 3625, 578], ['BI', 48, 27, 5, 686.6, 65085, 13.38, 13.62, 4886, 4777, 715],
    ['BII', 36, 33, 5, 614.6, 83834, 16.30, 16.70, 5144, 5019, 640], ['BII', 48, 33, 5, 746.6, 109127, 16.33, 16.67, 6681, 6548, 778],
    ['BIII', 36, 39, 6, 730.6, 132895, 19.28, 19.72, 6894, 6738, 761], ['BIII', 48, 39, 6, 862.6, 170267, 19.31, 19.69, 8817, 8648, 899],
    ['BIV', 36, 42, 6, 766.6, 161387, 20.76, 21.24, 7773, 7599, 799], ['BIV', 48, 42, 6, 898.6, 205690, 20.80, 21.20, 9890, 9701, 936]];
  /* plates 5.1.1c (p. 314) / 5.1.2c (p. 317): [slab, series, h, voids [x, d], A, I, y_b, y_t, S_b, S_t, weight lb/ft]; outline plates
     5.1.1a/b (p. 312/313), 5.1.2a/b (p. 315/316) */
  const SLABS = [
    ['SII', 36, 15, [[-8, 8], [8, 8]], 438, 9728, 7.44, 7.56, 1309, 1287, 457],
    ['SIII', 36, 18, [[-8, 10], [8, 10]], 473, 16034, 8.92, 9.08, 1798, 1766, 493],
    ['SIV', 36, 21, [[-8, 12], [8, 12]], 511, 24987, 10.40, 10.60, 2403, 2358, 532],
    ['SII', 48, 15, [[-14, 8], [0, 8], [14, 8]], 553, 12622, 7.45, 7.55, 1695, 1672, 576],
    ['SIII', 48, 18, [[-14, 10], [0, 10], [14, 10]], 611, 21376, 8.94, 9.06, 2393, 2359, 636],
    ['SIV', 48, 21, [[-14, 12], [0, 10], [14, 12]], 684, 33759, 10.43, 10.57, 3238, 3193, 713]];
  const STD = {}, ORDER_BOX = [], ORDER_SLAB = [];
  BOXES.forEach(([t, s, h, tw, A, I, yb, yt, Sb, St, wt]) => {
    const w = BOXW[s], n = `AASHTO ${t}-${s} (${h}in)`;
    STD[n] = { box: true, h, w, A, I, yb, bw: 2 * tw, wall: SLAB, voidW: w - 2 * tw, voidH: h - 2 * SLAB,
      src: { kind: 'box', beam: `${t}-${s}`, plate: '5.2.1b', page: 327, outline: '5.2.1a', outlinePage: 326, wNom: s, web: tw, slab: SLAB, yt, Sb, St, wt } };
    ORDER_BOX.push(n);
  });
  SLABS.forEach(([t, s, h, vs, A, I, yb, yt, Sb, St, wt]) => {
    const w = BOXW[s], n = `AASHTO ${t}-${s} (${h}in)`, ds = vs.map(v => v[1]);
    STD[n] = { deck: true, h, w, A, I, yb, bw: w - ds.reduce((a, b) => a + b, 0), voids: vs.length, voidD: Math.max(...ds),
      src: { kind: 'slab', beam: `${t}-${s}`, plate: s === 36 ? '5.1.1c' : '5.1.2c', page: s === 36 ? 314 : 317, outline: s === 36 ? (t === 'SII' ? '5.1.1a' : '5.1.1b') : (t === 'SII' ? '5.1.2a' : '5.1.2b'),
        outlinePage: s === 36 ? (t === 'SII' ? 312 : 313) : (t === 'SII' ? 315 : 316), wNom: s, voids: vs.map(([x, d]) => ({ x, d })), yt, Sb, St, wt } };
    ORDER_SLAB.push(n);
  });
  /* the old library's entries, byte for byte as in engine/pbd-library.js (the old app's GIRDERS; test: equal to the frozen slice) */
  const LEGACY = {
    'AASHTO BI-36 (12in)': { box: true, h: 12, w: 36, A: 560, I: 12897, yb: 6.00, bw: 10, wall: 5, voidW: 26, voidH: 5 },
    'AASHTO BII-36 (18in)': { box: true, h: 18, w: 36, A: 693, I: 36434, yb: 9.00, bw: 10, wall: 5, voidW: 26, voidH: 11 },
    'AASHTO BIII-36 (27in)': { box: true, h: 27, w: 36, A: 812, I: 97756, yb: 13.14, bw: 10, wall: 5, voidW: 26, voidH: 20 },
    'AASHTO BIV-48 (33in)': { box: true, h: 33, w: 48, A: 1097, I: 200631, yb: 16.11, bw: 10, wall: 5, voidW: 38, voidH: 26 },
    'Deck slab 21×48 (voided)': { deck: true, h: 21, w: 48, A: 807, I: 41058, yb: 10.50, bw: 24, voids: 2, voidD: 12 },
    'Deck slab 27×48 (voided)': { deck: true, h: 27, w: 48, A: 1041, I: 83743, yb: 13.50, bw: 24, voids: 2, voidD: 16 } };
  /* PS-31: the corrected standard section of the same name (21×48 voided: SIV-48, the standard 21 in voided slab 48 in wide); 27×48: none
     within ±3 in (standard voided slabs: 15, 18, 21 in) */
  const MAP = { 'AASHTO BI-36 (12in)': 'AASHTO BI-36 (27in)', 'AASHTO BII-36 (18in)': 'AASHTO BII-36 (33in)', 'AASHTO BIII-36 (27in)': 'AASHTO BIII-36 (39in)',
    'AASHTO BIV-48 (33in)': 'AASHTO BIV-48 (42in)', 'Deck slab 21×48 (voided)': 'AASHTO SIV-48 (21in)', 'Deck slab 27×48 (voided)': null };
  const engineOf = e => { const o = Object.assign({}, e); delete o.src; return o; };

  /* install(): GIRDERS with the old box / voided slab entries replaced, the order kept: I-girders, NEXT, the boxes (BI–BIV, 36 then 48 per
     type), the solid deck slabs, the voided standard slabs, Custom */
  let installed = false;
  function install() {
    if (installed || typeof GIRDERS === 'undefined') return;
    const keys = Object.keys(GIRDERS), keep = {}; keys.forEach(k => { keep[k] = GIRDERS[k]; delete GIRDERS[k]; });
    let boxes = false, slabs = false;
    const putBoxes = () => { if (!boxes) { ORDER_BOX.forEach(n => { GIRDERS[n] = engineOf(STD[n]); }); boxes = true; } };
    const putSlabs = () => { if (!slabs) { ORDER_SLAB.forEach(n => { GIRDERS[n] = engineOf(STD[n]); }); slabs = true; } };
    keys.forEach((k, i) => {
      const g = keep[k];
      if (k in LEGACY) { if (g && g.box) putBoxes(); return; }
      if (k === 'Custom') { putBoxes(); putSlabs(); }
      GIRDERS[k] = g;
      if (g && g.deck && g.solid && !keys.slice(i + 1).some(q => keep[q] && keep[q].deck && keep[q].solid)) putSlabs();   // after the last solid slab
    });
    putBoxes(); putSlabs();
    installed = true;
  }

  /* the slab voids of the plates: the engine draws n equal voids evenly spaced across w (sectionVoids); a standard slab's are at the plate's
     x with its diameters. A slab of the engine's girder (girderGross) is found by its h, w, voids and voidD (each standard slab has its own). */
  const slabOf = g => { if (!g || !g.isDeck || !g.box) return null; const b = g.box;
    for (const n of ORDER_SLAB) { const e = STD[n]; if (e.h === +g.h && e.w === +b.w && e.voids === +b.voids && e.voidD === +b.voidD) return e; } return null; };
  /* stdOf(g): the standard section [name, entry] of the engine's girder g (girderGross), or null */
  function stdOf(g) {
    if (!g || !g.box) return null; const b = g.box;
    for (const n of ORDER_BOX) { const e = STD[n]; if (g.isBox && e.h === +g.h && e.w === +b.w && e.wall === +b.wall && e.voidW === +b.voidW && e.voidH === +b.voidH) return [n, e]; }
    const e = slabOf(g); if (!e) return null; return [ORDER_SLAB.find(n => STD[n] === e), e];
  }
  function wrapVoids() {
    if (typeof sectionVoids !== 'function' || sectionVoids.__psbSections) return;
    const sv0 = sectionVoids;
    const sv = function (g) { const e = slabOf(g); return e ? e.src.voids.map(v => ({ type: 'circle', x: v.x, y: g.h / 2, d: v.d })) : sv0(g); };
    Object.defineProperty(sv, '__psbSections', { value: true });
    window.sectionVoids = sv;
  }

  /* outline(e): A, I, y_b of the drawn outline of entry e (rectangle w × h less the voids as sectionVoids draws them) */
  function outline(e) {
    const w = e.w, h = e.h; let A = w * h, Ay = A * h / 2, I0 = w * h * h * h / 12 + A * (h / 2) * (h / 2);   // about the soffit
    const vs = e.box ? [{ a: e.voidW * e.voidH, y: e.wall + e.voidH / 2, i: e.voidW * Math.pow(e.voidH, 3) / 12 }]
      : (e.src && e.src.voids ? e.src.voids : []).map(v => ({ a: Math.PI * v.d * v.d / 4, y: h / 2, i: Math.PI * Math.pow(v.d, 4) / 64 }));
    vs.forEach(v => { A -= v.a; Ay -= v.a * v.y; I0 -= v.i + v.a * v.y * v.y; });
    const yb = Ay / A; return { A, I: I0 - A * yb * yb, yb };
  }

  const fx = (v, d) => (+v).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  const propsOf = e => e ? { h: e.h, w: e.w, A: e.A, I: e.I, yb: e.yb } : null;
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  /* migrate(P): PS-31 on the project P (changed in place): the base girder and each girder type's own girder ('girder' override) */
  function migrate(P) {
    if (!isObj(P) || !isObj(P.base)) return '';
    const found = [];
    const one = (where, label, obj) => { const nm = obj.girder; if (typeof nm !== 'string' || !(nm in LEGACY)) return;
      const to = MAP[nm] || null; found.push({ where, label, from: nm, to, old: propsOf(LEGACY[nm]), now: to ? propsOf(STD[to]) : null }); if (to) obj.girder = to; };
    one('base', 'Base design', P.base);
    (Array.isArray(P.types) ? P.types : []).forEach(T => { if (isObj(T) && isObj(T.ovr) && 'girder' in T.ovr) one('type:' + T.id, `Girder type ${T.label || T.id}`, T.ovr); });
    if (!found.length) return '';
    if (!isObj(P.legacySection) || !Array.isArray(P.legacySection.items)) P.legacySection = { decision: 'PS-31 (engineer 2026-11-14)', items: [] };
    found.forEach(it => { if (!P.legacySection.items.some(q => q.where === it.where && q.from === it.from)) P.legacySection.items.push(it); });
    return `Girder section corrected on open (PS-31): ${found.map(it => `${it.label} "${it.from}" → ${it.to ? `"${it.to}"` : 'removed from the library (input error)'}`).join('; ')}. See the notice above the results.`;
  }
  const items = P => (isObj(P) && isObj(P.legacySection) && Array.isArray(P.legacySection.items) ? P.legacySection.items.filter(isObj) : []);
  const cite = n => { const s = STD[n] && STD[n].src; return s ? `CTDOT BDM plate ${s.plate}, PDF p. ${s.page}` : ''; };
  /* text(it): the notice of one migrated (or unmatched) old section */
  function text(it) {
    const o = it.old || {}, n = it.now;
    const was = `h ${fx(o.h, 0)} in, A ${fx(o.A, 1)} in², I ${fx(o.I, 0)} in⁴, y_b ${fx(o.yb, 2)} in`;
    if (!it.to || !n) return `${it.label}: section "${it.from}" removed from the library (PS-31): its published values (${was}) are not possible for its shape (I greater than the solid rectangle's) and no standard voided slab (CTDOT BDM plates 5.1.1c / 5.1.2c: 15, 18, 21 in) is within ±3 in of its depth. Choose a section on the Girders & strands tab.`;
    return `${it.label}: section corrected (PS-31): "${it.from}" → "${it.to}" (${cite(it.to)}): h ${fx(o.h, 0)} → ${fx(n.h, 0)} in, A ${fx(o.A, 1)} → ${fx(n.A, 1)} in², I ${fx(o.I, 0)} → ${fx(n.I, 0)} in⁴, y_b ${fx(o.yb, 2)} → ${fx(n.yb, 2)} in (width ${fx(o.w, 1)} → ${fx(n.w, 1)} in). The old library values were wrong; the results change. The old values are kept in the project (legacySection).`;
  }
  const retiredMsg = nm => nm in LEGACY && !MAP[nm] ? `Girder section "${nm}" was removed from the library (PS-31): its published values are not possible for its shape and no standard voided slab is within ±3 in of its depth; choose a section.` : '';
  const sig = P => items(P).map(it => `${it.where}|${it.from}|${it.to}`).join(';');
  /* withLegacy(fn): fn() with the old entries in GIRDERS (only names not in it), removed again after */
  function withLegacy(fn) {
    if (typeof GIRDERS === 'undefined') return fn();
    const added = Object.keys(LEGACY).filter(k => !(k in GIRDERS)); added.forEach(k => { GIRDERS[k] = Object.assign({}, LEGACY[k]); });
    try { return fn(); } finally { added.forEach(k => { delete GIRDERS[k]; }); }
  }
  const src = n => (STD[n] ? STD[n].src : null);
  /* DOT_J (PS-35, engineer 2026-11-14): the St. Venant torsional constant J of a standard section from the DOT reference sheets, which the
     engineer provides later: { '<name>': { J: <in⁴>, src: '<sheet, page>' } }. A value here is used for the type (f) / (g) live-load
     distribution (engine/lldf-fg.js) in place of the J computed from the drawn outline; a J entered for a girder type (loads.Jfg) takes
     precedence over both. None yet. dotJ(name): the entry, or null. */
  const DOT_J = {};
  const dotJ = n => (Object.prototype.hasOwnProperty.call(DOT_J, n) && +DOT_J[n].J > 0 ? DOT_J[n] : null);
  /* tbcNote(name): the "to be confirmed" note of a standard box beam / voided slab (engineer request 2026-11-14, PR A; the one exception to
     the no-pending-in-app rule): the plate the properties come from, the old library they replace (found inconsistent), and that the
     engineer is to confirm them against the DOT reference sheets; voided slabs: the void spacing scaled from the plate. HTML ('' for any other
     shape). Shown on the Girders & strands tab (ui/inputs.js, #secTbcNote) and in the Report's assumptions (report/builders.js tbcNotes). */
  function tbcNote(name) {
    const e = STD[name]; if (!e) return '';
    const s = e.src, box = s.kind === 'box';
    return `To be confirmed: A, I and y<sub>b</sub> of ${box ? 'this box beam' : 'this voided slab'} are taken from CTDOT BDM plate ${s.plate} (PDF p. ${s.page}). `
      + 'They replace the old app\'s box beam and voided slab library, which was found inconsistent (e.g. the old "BIII-36 (27in)" gave I = 97,756 in⁴, more than a solid 36 × 27 in rectangle at 59,049 in⁴). '
      + 'The replacement is to be confirmed by the engineer against the DOT reference sheets.'
      + (box ? '' : ` The void spacing (void centres at ${[...new Set(s.voids.map(v => Math.abs(v.x)))].sort((a, b) => a - b).map(x => x === 0 ? '0' : `±${x}`).join(', ')} in from the ℄) is scaled from the plate drawing, not dimensioned on it, and is to be confirmed.`);
  }

  install(); wrapVoids();
  window.PSBSections = { STD, LEGACY, MAP, ORDER_BOX, ORDER_SLAB, install, migrate, items, text, retiredMsg, sig, withLegacy, src, tbcNote, DOT_J, dotJ, outline, slabOf, stdOf, engineOf };
})();
