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
                  or three (48 series) on mid-depth, actual widths 35.5 / 47.5 in. The plates do not dimension the void spacing: PS-32 scaled
                  it from the plate drawings (±8 in; 0, ±14 in); PS-40 (engineer decision 2026-11-14) takes MassDOT's dimensioned spacing for
                  the same void sizes (Part II dwg 10.1.4 / 10.1.5, p. 193 / 194): ±7.75 in (36 series); 0, ±13.75 in (SII-48); 0, ±14.25 in
                  (SIII-48, SIV-48). A, I and y_b do not depend on it (the voids are on mid-depth); the J of the outline and the strand fit do.
   PS-38 (2026-11-14): NEXT 28F I at 144 in corrected to MassDOT Part II dwg 9.2.3 (NEXT_FIX). PS-38 / PS-40: a project saved before is told
   once on open (migrate; P.secLib, LIB).
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
  const BOXW = { 36: 35.5, 48: 47.5 }, SLAB = 5.5, R2 = v => Math.round(v * 1e6) / 1e6;
  /* plate 5.2.1b (PDF p. 327): [beam, series, h, web t_w, A, I, y_b, y_t, S_b, S_t, weight lb/ft] */
  const BOXES = [
    ['BI', 36, 27, 5, 554.6, 49495, 13.35, 13.65, 3709, 3625, 578], ['BI', 48, 27, 5, 686.6, 65085, 13.38, 13.62, 4886, 4777, 715],
    ['BII', 36, 33, 5, 614.6, 83834, 16.30, 16.70, 5144, 5019, 640], ['BII', 48, 33, 5, 746.6, 109127, 16.33, 16.67, 6681, 6548, 778],
    ['BIII', 36, 39, 6, 730.6, 132895, 19.28, 19.72, 6894, 6738, 761], ['BIII', 48, 39, 6, 862.6, 170267, 19.31, 19.69, 8817, 8648, 899],
    ['BIV', 36, 42, 6, 766.6, 161387, 20.76, 21.24, 7773, 7599, 799], ['BIV', 48, 42, 6, 898.6, 205690, 20.80, 21.20, 9890, 9701, 936]];
  /* plates 5.1.1c (p. 314) / 5.1.2c (p. 317): [slab, series, h, voids [x, d], A, I, y_b, y_t, S_b, S_t, weight lb/ft]; outline plates
     5.1.1a/b (p. 312/313), 5.1.2a/b (p. 315/316) */
  const SLABS = [
    ['SII', 36, 15, [[-7.75, 8], [7.75, 8]], 438, 9728, 7.44, 7.56, 1309, 1287, 457],
    ['SIII', 36, 18, [[-7.75, 10], [7.75, 10]], 473, 16034, 8.92, 9.08, 1798, 1766, 493],
    ['SIV', 36, 21, [[-7.75, 12], [7.75, 12]], 511, 24987, 10.40, 10.60, 2403, 2358, 532],
    ['SII', 48, 15, [[-13.75, 8], [0, 8], [13.75, 8]], 553, 12622, 7.45, 7.55, 1695, 1672, 576],
    ['SIII', 48, 18, [[-14.25, 10], [0, 10], [14.25, 10]], 611, 21376, 8.94, 9.06, 2393, 2359, 636],
    ['SIV', 48, 21, [[-14.25, 12], [0, 10], [14.25, 12]], 684, 33759, 10.43, 10.57, 3238, 3193, 713]];
  /* PS-40 (engineer decision 2026-11-14): the void spacing above is MassDOT's dimensioned spacing (the CTDOT plates do not dimension it):
     MassDOT Bridge Manual Part II dwg 10.1.4 (36 in deck beams, p. 193: 10 in from the actual edge to the first void centre, 15½ in between,
     so ±7.75 in) and dwg 10.1.5 (48 in, p. 194: 15 in deep 10 / 13¾ / 13¾ / 10 in, so 0, ±13.75 in; 18 and 21 in deep 9½ / 14¼ / 14¼ / 9½ in,
     so 0, ±14.25 in). Before (PS-32, scaled from the CTDOT plate drawings): ±8 in; 0, ±14 in. VOID_OLD: those, for the open-time notice. */
  const VOID_SRC = { 36: { dwg: '10.1.4', page: 193 }, 48: { dwg: '10.1.5', page: 194 } };
  const VOID_OLD = { 36: [-8, 8], 48: [-14, 0, 14] };
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
        outlinePage: s === 36 ? (t === 'SII' ? 312 : 313) : (t === 'SII' ? 315 : 316), wNom: s, voids: vs.map(([x, d]) => ({ x, d })), voidSrc: VOID_SRC[s], voidOld: VOID_OLD[s], yt, Sb, St, wt } };
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
  /* PS-38 (engineer decision 2026-11-14, "fix it, with notice"): NEXT 28F at the maximum width (144 in nominal): I = 92,836 in⁴, MassDOT
     Bridge Manual Part II dwg 9.2.3 (p. 124). The old library's 88,218 in⁴ is not the sheet's: the sheet's own S_b = I / y_b = 92,836 /
     18.55 = 5,005 in³ and S_t = 92,836 / 9.45 = 9,824 in³ are printed with it (88,218 would give 4,756 and 9,335). Every other NEXT F value
     of the old library (24F, 28F, 32F, 36F at 96 and 144 in: A, I, y_b, y_t, B) is the sheet's. The engine's own GIRDERS entry is changed in
     place at install (no engine file edited); withLegacy puts the old value back (the old app's results of an imported design). */
  const NEXT_FIX = [{ name: 'NEXT 28F', at: 'pMax', key: 'I', old: 88218, now: 92836, w: 144, dwg: '9.2.3', page: 124 }];
  /* LIB: the section library revision of P.secLib (optional project field, added 2026-11-14 with PS-38 / PS-40): a project opened without it
     (or below LIB) that uses a section whose values changed since (NEXT_FIX; a CTDOT voided slab's void spacing, PS-40) is told so once on
     open (migrate: a 'rev' item in P.legacySection) and P.secLib = LIB is written. It is written only on a project that uses such a section
     (stamp: on open, and when the project is written, PSBModel.exportJSON, i.e. the section was chosen with today's library), so the stored
     text of any other project is not changed by opening it; a new project has it (PSBModel.newProject). */
  const LIB = 2;

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
      if (k === 'Custom') { putBoxes(); putSlabs(); ORDER_MD.forEach(n => { GIRDERS[n] = engineOf(MD[n]); }); }   // PS-37: the MassDOT sections before Custom
      GIRDERS[k] = g;
      if (g && g.deck && g.solid && !keys.slice(i + 1).some(q => keep[q] && keep[q].deck && keep[q].solid)) putSlabs();   // after the last solid slab
    });
    putBoxes(); putSlabs();
    NEXT_FIX.forEach(f => { const e = GIRDERS[f.name]; if (e && e[f.at] && e[f.at][f.key] === f.old) e[f.at][f.key] = f.now; });   // PS-38
    installed = true;
  }

  /* the slab voids of the plates: the engine draws n equal voids evenly spaced across w (sectionVoids); a standard slab's are at the plate's
     x with its diameters. A slab of the engine's girder (girderGross) is found by its h, w, voids and voidD (each standard slab has its own). */
  const slabOf = g => { if (!g || !g.isDeck || !g.box) return null; const b = g.box;
    if (typeof g.std === 'string' && MD[g.std]) return MD[g.std].src.fam === 'slab' ? MD[g.std] : null;   // PS-37: a MassDOT deck beam, by its name
    for (const n of ORDER_SLAB) { const e = STD[n]; if (e.h === +g.h && e.w === +b.w && e.voids === +b.voids && e.voidD === +b.voidD) return e; } return null; };
  /* stdOf(g): the standard section [name, entry] of the engine's girder g (girderGross), or null */
  function stdOf(g) {
    if (g && typeof g.std === 'string' && MD[g.std]) return [g.std, MD[g.std]];   // PS-37: a MassDOT section (tagged by name)
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
    const tys = (Array.isArray(P.types) ? P.types : []).filter(T => isObj(T) && isObj(T.ovr) && 'girder' in T.ovr);
    tys.forEach(T => one('type:' + T.id, `Girder type ${T.label || T.id}`, T.ovr));
    // PS-38 / PS-40 (2026-11-14): a project opened from before this library revision that uses a section whose values changed since
    const rev = [], fresh = +P.secLib >= LIB;
    const two = (where, label, nm) => { if (fresh || typeof nm !== 'string' || found.some(q => q.where === where)) return;   // a section corrected just now (PS-31) is told once
      const f = NEXT_FIX.find(q => q.name === nm);
      if (f) rev.push({ kind: 'rev', rev: 'PS-38', where, label, from: nm, to: nm, old: { [f.key]: f.old, w: f.w }, now: { [f.key]: f.now, w: f.w } });
      const e = STD[nm]; if (e && e.deck && e.src.voidOld) rev.push({ kind: 'rev', rev: 'PS-40', where, label, from: nm, to: nm, old: { voids: e.src.voidOld.slice() }, now: { voids: e.src.voids.map(v => v.x) } }); };
    two('base', 'Base design', P.base.girder); tys.forEach(T => two('type:' + T.id, `Girder type ${T.label || T.id}`, T.ovr.girder));
    stamp(P);
    if (!found.length && !rev.length) return '';
    if (!isObj(P.legacySection) || !Array.isArray(P.legacySection.items)) P.legacySection = { decision: found.length ? 'PS-31 (engineer 2026-11-14)' : 'PS-38 / PS-40 (engineer 2026-11-14)', items: [] };
    found.concat(rev).forEach(it => { if (!P.legacySection.items.some(q => q.where === it.where && q.from === it.from && (q.rev || '') === (it.rev || ''))) P.legacySection.items.push(it); });
    const n1 = found.length ? `Girder section corrected on open (PS-31): ${found.map(it => `${it.label} "${it.from}" → ${it.to ? `"${it.to}"` : 'removed from the library (input error)'}`).join('; ')}.` : '';
    const n2 = rev.length ? `Girder section values revised since this project was saved (${[...new Set(rev.map(it => it.rev))].join(', ')}): ${rev.map(it => `${it.label} "${it.from}" (${it.rev === 'PS-38' ? 'I at 144 in' : 'void spacing'})`).join('; ')}.` : '';
    return `${[n1, n2].filter(Boolean).join(' ')} See the notice above the results.`;
  }
  /* uses(P): the project's base design or a girder type's own girder is a section revised in LIB (NEXT_FIX; a CTDOT voided slab, PS-40);
     stamp(P): P.secLib = LIB on such a project (nothing on any other) */
  const revised = nm => typeof nm === 'string' && (NEXT_FIX.some(f => f.name === nm) || !!(STD[nm] && STD[nm].src && STD[nm].src.voidOld));
  const uses = P => isObj(P) && isObj(P.base) && (revised(P.base.girder) || (Array.isArray(P.types) ? P.types : []).some(T => isObj(T) && isObj(T.ovr) && revised(T.ovr.girder)));
  function stamp(P) { if (uses(P) && !(+P.secLib >= LIB)) P.secLib = LIB; return P; }
  /* tags(P): the decisions of the project's items ('PS-31', 'PS-38', 'PS-40'), for the notice titles */
  const tags = P => [...new Set(items(P).map(it => it.rev || 'PS-31'))].join(', ');
  const items = P => (isObj(P) && isObj(P.legacySection) && Array.isArray(P.legacySection.items) ? P.legacySection.items.filter(isObj) : []);
  const cite = n => { const s = STD[n] && STD[n].src; return s ? `CTDOT BDM plate ${s.plate}, PDF p. ${s.page}` : ''; };
  const xs = v => (Array.isArray(v) ? [...new Set(v.map(x => Math.abs(+x)))].sort((a, b) => a - b).map(x => (x === 0 ? '0' : `±${(+x).toLocaleString('en-US', { maximumFractionDigits: 2 })}`)).join(', ') : '');
  /* text(it): the notice of one migrated (or unmatched) old section, or of a revised value (PS-38 / PS-40) */
  function text(it) {
    const o = it.old || {}, n = it.now;
    if (it.kind === 'rev' && it.rev === 'PS-38') {
      const f = NEXT_FIX.find(q => q.name === it.from) || NEXT_FIX[0];
      return `${it.label}: section value corrected (PS-38): "${it.from}" at the maximum width (${fx(f.w, 0)} in nominal): I ${fx(o.I, 0)} → ${fx(n && n.I, 0)} in⁴ (MassDOT Bridge Manual Part II dwg ${f.dwg}, p. ${f.page}; the sheet's S_b = I / y_b = ${fx(f.now, 0)} / 18.55 = 5,005 in³ goes with the new value). The engine interpolates I on the flange width between 96 and 144 in, so a NEXT 28F wider than 96 in has a larger I and the results change; at 96 in nothing changes. The old value is kept in the project (legacySection).`;
    }
    if (it.kind === 'rev' && it.rev === 'PS-40') {
      const s = (STD[it.from] && STD[it.from].src) || {}, vs = s.voidSrc || {};
      return `${it.label}: void spacing of "${it.from}" revised (PS-40): void centres ${xs(o.voids)} → ${xs(n && n.voids)} in from the ℄ (dimensioned on MassDOT Bridge Manual Part II dwg ${vs.dwg}, p. ${vs.page}; before, scaled from the CTDOT plate drawing). A, I and y_b do not change (the voids stay on mid-depth); the J computed from the outline for the type (f) / (g) live-load distribution (Loads & LLDF tab) and the strand fit change. The old spacing is kept in the project (legacySection).`;
    }
    const was = `h ${fx(o.h, 0)} in, A ${fx(o.A, 1)} in², I ${fx(o.I, 0)} in⁴, y_b ${fx(o.yb, 2)} in`;
    if (!it.to || !n) return `${it.label}: section "${it.from}" removed from the library (PS-31): its published values (${was}) are not possible for its shape (I greater than the solid rectangle's) and no standard voided slab (CTDOT BDM plates 5.1.1c / 5.1.2c: 15, 18, 21 in) is within ±3 in of its depth. Choose a section on the Girders & strands tab.`;
    return `${it.label}: section corrected (PS-31): "${it.from}" → "${it.to}" (${cite(it.to)}): h ${fx(o.h, 0)} → ${fx(n.h, 0)} in, A ${fx(o.A, 1)} → ${fx(n.A, 1)} in², I ${fx(o.I, 0)} → ${fx(n.I, 0)} in⁴, y_b ${fx(o.yb, 2)} → ${fx(n.yb, 2)} in (width ${fx(o.w, 1)} → ${fx(n.w, 1)} in). The old library values were wrong; the results change. The old values are kept in the project (legacySection).`;
  }
  const retiredMsg = nm => nm in LEGACY && !MAP[nm] ? `Girder section "${nm}" was removed from the library (PS-31): its published values are not possible for its shape and no standard voided slab is within ±3 in of its depth; choose a section.` : '';
  const sig = P => items(P).map(it => `${it.where}|${it.from}|${it.to}${it.rev ? '|' + it.rev : ''}`).join(';');   // PS-31 items as before (a closed notice stays closed)
  /* withLegacy(fn): fn() with the old entries in GIRDERS (only names not in it), removed again after */
  function withLegacy(fn) {
    if (typeof GIRDERS === 'undefined') return fn();
    const added = Object.keys(LEGACY).filter(k => !(k in GIRDERS)); added.forEach(k => { GIRDERS[k] = Object.assign({}, LEGACY[k]); });
    const back = NEXT_FIX.filter(f => GIRDERS[f.name] && GIRDERS[f.name][f.at] && GIRDERS[f.name][f.at][f.key] === f.now);   // PS-38: the old app's value
    back.forEach(f => { GIRDERS[f.name][f.at][f.key] = f.old; });
    try { return fn(); } finally { added.forEach(k => { delete GIRDERS[k]; }); back.forEach(f => { GIRDERS[f.name][f.at][f.key] = f.now; }); }
  }
  const src = n => (STD[n] ? STD[n].src : null);
  /* DOT_J (PS-35, engineer 2026-11-14): the St. Venant torsional constant J of a standard section from the DOT reference sheets, which the
     engineer provides later: { '<name>': { J: <in⁴>, src: '<sheet, page>' } }. A value here is used for the type (f) / (g) live-load
     distribution (engine/lldf-fg.js) in place of the J computed from the drawn outline; a J entered for a girder type (loads.Jfg) takes
     precedence over both. None yet. dotJ(name): the entry, or null. */
  const DOT_J = {};
  const dotJ = n => (Object.prototype.hasOwnProperty.call(DOT_J, n) && +DOT_J[n].J > 0 ? DOT_J[n] : null);
  /* XCHK: the MassDOT Bridge Manual Part II section of the same nominal size as each CTDOT standard section, the engineer's cross-check of
     the CTDOT values (2026-11-14): adjacent box beams dwg 10.2.4 (36 in, p. 223) / 10.2.5 (48 in, p. 224); deck beams dwg 10.1.4 (p. 193) /
     10.1.5 (p. 194). [MassDOT name, dwg, page, A, I, y_b] as printed. The MassDOT adjacent box has a 6 in bottom slab (CTDOT 5½ in): the CTDOT
     boxes come out about 2–3 % below it (A 2.5–3.2 %, I 1.5–2.2 %); the CTDOT voided slabs are 1–5 % above the MassDOT deck beams. */
  const XCHK = {
    'AASHTO BI-36 (27in)': ['B36-27', '10.2.4', 223, 573, 50267, 13.29], 'AASHTO BII-36 (33in)': ['B36-33', '10.2.4', 223, 633, 85453, 16.24],
    'AASHTO BIII-36 (39in)': ['B36-39', '10.2.4', 223, 748, 135514, 19.24], 'AASHTO BIV-36 (42in)': ['B36-42', '10.2.4', 223, 784, 164680, 20.73],
    'AASHTO BI-48 (27in)': ['B48-27', '10.2.5', 224, 711, 66201, 13.27], 'AASHTO BII-48 (33in)': ['B48-33', '10.2.5', 224, 771, 111410, 16.20],
    'AASHTO BIII-48 (39in)': ['B48-39', '10.2.5', 224, 886, 173980, 19.19], 'AASHTO BIV-48 (42in)': ['B48-42', '10.2.5', 224, 922, 210330, 20.67],
    'AASHTO SII-36 (15in)': ['S36-15', '10.1.4', 193, 419, 9419, 7.47], 'AASHTO SIII-36 (18in)': ['S36-18', '10.1.4', 193, 464, 15963, 8.96],
    'AASHTO SIV-36 (21in)': ['S36-21', '10.1.4', 193, 497, 24827, 10.45], 'AASHTO SII-48 (15in)': ['S48-15', '10.1.5', 194, 548, 12593, 7.47],
    'AASHTO SIII-48 (18in)': ['S48-18', '10.1.5', 194, 601, 21303, 8.97], 'AASHTO SIV-48 (21in)': ['S48-21', '10.1.5', 194, 670, 33597, 10.47] };
  /* xchk(name): { md, dwg, page, A, I, yb, dA, dI, dyb } (d: the CTDOT value / MassDOT − 1) or null */
  function xchk(name) {
    const e = STD[name], x = XCHK[name]; if (!e || !x) return null;
    return { md: x[0], dwg: x[1], page: x[2], A: x[3], I: x[4], yb: x[5], dA: e.A / x[3] - 1, dI: e.I / x[4] - 1, dyb: e.yb / x[5] - 1 };
  }

  /* ================= PS-37 (engineer decision 2026-11-14): the MassDOT Bridge Manual Part II (April 2024) standard sections =================
     Added to GIRDERS before 'Custom', under their own names ("MassDOT …"), grouped by owner in the girder picker (group(name)); every
     existing name and value is unchanged. A, I, y_b are the sheet's (S = I / y and the weight A × w_c as the engine computes them). Sheets
     (Part II PDF 2 of 3, its page numbers; the numeric section properties entered as data, the notes paraphrased):
       NEBT 1000–1800    dwg 9.1.4 (p. 91)    top flange 47.24 in, 3.35 in at the tip, a 1.97 in taper to the web; web 7.09 in; bottom flange
                                              31.89 in × 8.66 in, a 3.94 in taper; R 7.87 in web fillets, R 3.94 in bottom flange corners,
                                              0.79 in chamfers / radii
       NEDBT 40–80       dwg 11.1.3 (p. 253)  the NEBT web and bottom flange with a 60 in × 8 in top flange and a 2.19 in taper. NEDBT 80: the
                                              sheet's y_b 46.60 in is a misprint (its y_t 33.60 in, the depth and S_b = I / y_b = 25,944 in³ give
                                              46.40 in): 46.40 in used (PS37-D2)
       NEXT 24F–36F      dwg 9.2.3 (p. 124)   flange 4 in (the area difference of the two tabulated widths: (1,164 − 972) / 48 = 4.0 in), stems
                                              B at the bottom to 15 in at the flange, 60 in apart, R 4 in fillets, ¾ in chamfers; 96 to 144 in
                                              (the engine's interpolation on S × 12, as the old library's NEXT F)
       NEXT 28D–40D      dwg 11.2.3 (p. 295)  flange 8 in, stems as the NEXT F (dwg 11.2.8, p. 300: 15 in at the flange, R 4 in); 96 to 120 in
                                              wide; the beam width = the girder spacing − 13 in (dwg 11.2.3 note 2; the girderGrossBase wrapper)
       spread box B36 / B48, 24–48 in  dwg 9.3.4 / 9.3.5 (p. 153 / 154): 35.5 / 47.5 in wide, top slab 5½ in, bottom slab 6 in, webs 5¾ in
                                              (24–36 in deep) / 6¾ in (39–48 in), 3 × 3 in cell chamfers, ¾ in bottom chamfers. Computed as the
                                              engine's I-girder (tributary deck, haunch, type (k) live load distribution; PS37-D3); the box outline
                                              and cell drawn by the wrappers below
       adjacent box B36 / B48, 24–48 in dwg 10.2.4 / 10.2.5 (p. 223 / 224): the same slabs, webs 5 in (24–36 in) / 6 in (39–48 in), shear
                                              keys (dwg 10.2.9, p. 228; not drawn); the engine's box (types (f) / (g), engine/lldf-fg.js)
       deck beams S36 / S48, 12–21 in   dwg 10.1.4 / 10.1.5 (p. 193 / 194): S36-12 / S48-12 solid; the voided ones with the sheet's void sizes
                                              and dimensioned spacing; shear keys (dwg 10.1.9, p. 198) not drawn
     The drawn outlines are checked against the sheets' A, I, y_b in tests/engine/psbridge-massdot.test.mjs. */
  const MDW = { 36: 35.5, 48: 47.5 };
  const MD = {}, ORDER_MD = [];
  const mdAdd = (name, e) => { MD[name] = e; ORDER_MD.push(name); };
  /* [beam, h, A, I, y_b] as printed (y_t = h − y_b agrees to 0.01 in) */
  [['1000', 39.37, 746, 149196, 19.02], ['1200', 47.24, 801, 238089, 22.63], ['1400', 55.12, 857, 353169, 26.26], ['1600', 62.99, 913, 492515, 29.96], ['1800', 70.87, 969, 660691, 33.66]]
    .forEach(([b, h, A, I, yb]) => mdAdd(`MassDOT NEBT ${b}`, { h, A, I, yb, bw: 7.09, btf: 47.24, bbf: 31.89, d: [3.35, 1.97, 8.66, 3.94],
      src: { owner: 'MassDOT', fam: 'nebt', beam: `NEBT ${b}`, dwg: '9.1.4', page: 91, strands: { dwg: '9.1.6', page: 93 } } }));
  [['40', 40, 1072, 202908, 23.55], ['48', 48, 1128, 328913, 28.23], ['56', 56, 1185, 490067, 32.85], ['64', 64, 1242, 688318, 37.41], ['72', 72, 1298, 925587, 41.93], ['80', 80, 1355, 1203781, 46.40]]
    .forEach(([b, h, A, I, yb]) => mdAdd(`MassDOT NEDBT ${b}`, { h, A, I, yb, bw: 7.09, btf: 60, bbf: 31.89, d: [8, 2.19, 8.66, 3.94],
      src: Object.assign({ owner: 'MassDOT', fam: 'nedbt', beam: `NEDBT ${b}`, dwg: '11.1.3', page: 253, strands: { dwg: '11.1.7', page: 257 } }, b === '80' ? { ybPrinted: 46.60 } : {}) }));
  /* NEXT: [beam, h, B, [A, I, y_b] at the minimum width, [A, I, y_b] at the maximum, strand edge distance (dwg 9.2.5 / 11.2.7)] */
  [['24F', 24, 13.75, [972, 51905, 14.94], [1164, 60159, 16.10], '2.875'], ['28F', 28, 13.50, [1082, 80037, 17.23], [1274, 92836, 18.55], '2.75'],
    ['32F', 32, 13.25, [1190, 116036, 19.50], [1382, 134523, 20.96], '2.625'], ['36F', 36, 13.00, [1296, 160602, 21.75], [1488, 186000, 23.34], '2.5']]
    .forEach(([b, h, B, a, c, sr]) => mdAdd(`MassDOT NEXT ${b}`, { next: true, h, B, wMin: 96, wMax: 144, pMin: { A: a[0], I: a[1], yb: a[2], yt: R2(h - a[2]) },
      pMax: { A: c[0], I: c[1], yb: c[2], yt: R2(h - c[2]) }, flangeT: 4, strandRow: sr,
      src: { owner: 'MassDOT', fam: 'nextf', beam: `NEXT ${b}`, dwg: '9.2.3', page: 124, stemTop: 15, fillet: 4, strands: { dwg: '9.2.5', page: 126 } } }));
  [['28D', 28, 13.75, [1348, 85775, 18.06], [1540, 92724, 18.80], '2.875'], ['32D', 32, 13.50, [1457, 126319, 20.56], [1649, 136722, 21.43], '2.75'],
    ['36D', 36, 13.25, [1564, 176999, 23.02], [1756, 191801, 24.01], '2.625'], ['40D', 40, 13.00, [1669, 238511, 25.45], [1861, 258692, 26.54], '2.5']]
    .forEach(([b, h, B, a, c, sr]) => mdAdd(`MassDOT NEXT ${b}`, { next: true, h, B, wMin: 96, wMax: 120, pMin: { A: a[0], I: a[1], yb: a[2], yt: R2(h - a[2]) },
      pMax: { A: c[0], I: c[1], yb: c[2], yt: R2(h - c[2]) }, flangeT: 8, strandRow: sr,
      src: { owner: 'MassDOT', fam: 'nextd', beam: `NEXT ${b}`, dwg: '11.2.3', page: 295, stemTop: 15, fillet: 4, gap: 13, strands: { dwg: '11.2.7', page: 299 } } }));
  /* boxes: [h, A, I, y_b] per series, spread (dwg 9.3.4 / 9.3.5) and adjacent (dwg 10.2.4 / 10.2.5) */
  const SPREAD = {
    36: [[24, 569, 37392, 11.89], [27, 604, 51478, 13.37], [30, 638, 68281, 14.85], [33, 673, 87958, 16.33], [36, 707, 110661, 17.81], [39, 797, 140025, 19.33], [42, 837, 170514, 20.82], [45, 878, 204772, 22.31], [48, 918, 242981, 23.80]],
    48: [[24, 707, 49247, 11.86], [27, 742, 67415, 13.33], [30, 776, 88921, 14.80], [33, 811, 113920, 16.28], [36, 845, 142567, 17.76], [39, 935, 178498, 19.27], [42, 975, 216174, 20.75], [45, 1016, 258238, 22.24], [48, 1056, 304874, 23.72]] };
  const ADJ = {
    36: [[24, 543, 36609, 11.82], [27, 573, 50267, 13.29], [30, 603, 66503, 14.77], [33, 633, 85453, 16.24], [36, 663, 107251, 17.72], [39, 748, 135514, 19.24], [42, 784, 164680, 20.73], [45, 820, 197374, 22.21], [48, 856, 233759, 23.70]],
    48: [[24, 681, 48461, 11.80], [27, 711, 66201, 13.27], [30, 741, 87139, 14.73], [33, 771, 111410, 16.20], [36, 801, 139151, 17.68], [39, 886, 173980, 19.19], [42, 922, 210330, 20.67], [45, 958, 250828, 22.15], [48, 994, 295638, 23.63]] };
  const MD_TOP = 5.5, MD_BOT = 6;
  [36, 48].forEach(s => SPREAD[s].forEach(([h, A, I, yb]) => { const w = MDW[s], tw = h <= 36 ? 5.75 : 6.75;
    mdAdd(`MassDOT B${s}-${h} spread`, { h, A, I, yb, bw: 2 * tw, btf: w, bbf: w, d: [MD_TOP, 0, MD_BOT, 0],
      src: { owner: 'MassDOT', fam: 'spread', beam: `B${s}-${h}`, dwg: s === 36 ? '9.3.4' : '9.3.5', page: s === 36 ? 153 : 154, wNom: s, web: tw, top: MD_TOP, bot: MD_BOT, w,
        strands: h <= 36 ? { dwg: '9.3.7', page: 156 } : { dwg: '9.3.8', page: 157 } } }); }));
  [36, 48].forEach(s => ADJ[s].forEach(([h, A, I, yb]) => { const w = MDW[s], tw = h <= 36 ? 5 : 6;
    mdAdd(`MassDOT B${s}-${h} adj.`, { box: true, h, w, A, I, yb, bw: 2 * tw, wall: MD_BOT, voidW: w - 2 * tw, voidH: h - MD_TOP - MD_BOT,
      src: { owner: 'MassDOT', fam: 'adj', beam: `B${s}-${h}`, dwg: s === 36 ? '10.2.4' : '10.2.5', page: s === 36 ? 223 : 224, wNom: s, web: tw, top: MD_TOP, bot: MD_BOT, w, keys: { dwg: '10.2.9', page: 228 },
        strands: h <= 36 ? { dwg: '10.2.7', page: 226 } : { dwg: '10.2.8', page: 227 } } }); }));
  /* deck beams: [beam, series, h, voids [x, d] (dimensioned on the sheet), A, I, y_b] (dwg 10.1.4 / 10.1.5) */
  [['S36-12', 36, 12, [], 417, 5033, 5.98], ['S36-15', 36, 15, [[-7.75, 8], [7.75, 8]], 419, 9419, 7.47], ['S36-18', 36, 18, [[-7.75, 10], [7.75, 10]], 464, 15963, 8.96],
    ['S36-21', 36, 21, [[-7.75, 12], [7.75, 12]], 497, 24827, 10.45], ['S48-12', 48, 12, [], 561, 6761, 5.98], ['S48-15', 48, 15, [[-13.75, 8], [0, 8], [13.75, 8]], 548, 12593, 7.47],
    ['S48-18', 48, 18, [[-14.25, 10], [0, 10], [14.25, 10]], 601, 21303, 8.97], ['S48-21', 48, 21, [[-14.25, 12], [0, 10], [14.25, 12]], 670, 33597, 10.47]]
    .forEach(([b, s, h, vs, A, I, yb]) => { const w = MDW[s], ds = vs.map(v => v[1]), src = { owner: 'MassDOT', fam: vs.length ? 'slab' : 'solid', beam: b, dwg: s === 36 ? '10.1.4' : '10.1.5',
      page: s === 36 ? 193 : 194, wNom: s, w, voids: vs.map(([x, d]) => ({ x, d })), keys: { dwg: '10.1.9', page: 198 }, strands: s === 36 ? { dwg: '10.1.7', page: 196 } : { dwg: '10.1.8', page: 197 } };
      mdAdd(`MassDOT ${b}`, vs.length ? { deck: true, h, w, A, I, yb, bw: w - ds.reduce((p, q) => p + q, 0), voids: vs.length, voidD: Math.max(...ds), src }
        : { deck: true, h, w, A, I, yb, bw: w, solid: true, src }); });

  /* group(name): the girder picker's group (optgroup) of a library name, by owner (PS-37) */
  const GROUP_MD = { nebt: 'MassDOT — NEBT (dwg 9.1.4)', nedbt: 'MassDOT — NEDBT (dwg 11.1.3)', nextf: 'MassDOT — NEXT F (dwg 9.2.3)', nextd: 'MassDOT — NEXT D (dwg 11.2.3)',
    spread: 'MassDOT — spread box beams (dwg 9.3.4 / 9.3.5)', adj: 'MassDOT — adjacent box beams (dwg 10.2.4 / 10.2.5)', slab: 'MassDOT — deck beams (dwg 10.1.4 / 10.1.5)', solid: 'MassDOT — deck beams (dwg 10.1.4 / 10.1.5)' };
  function group(name) {
    if (Object.prototype.hasOwnProperty.call(MD, name)) return GROUP_MD[MD[name].src.fam];
    if (STD[name]) return STD[name].box ? 'CTDOT — box beams (BDM plate 5.2.1b)' : 'CTDOT — voided slabs (BDM plates 5.1.1c / 5.1.2c)';
    if (name === 'Custom') return 'Custom';
    const e = typeof GIRDERS !== 'undefined' ? GIRDERS[name] : null;
    if (e && e.next) return 'PCI Northeast — NEXT F (old library)';
    if (e && e.deck) return 'Solid deck slabs (old library)';
    return 'AASHTO / PCI — I-girders and bulb tees (old library)';
  }
  /* mdOf(g): the MassDOT entry [name, entry] of the engine's girder g (girderGross tags it: g.std), or null */
  const mdOf = g => (g && typeof g.std === 'string' && Object.prototype.hasOwnProperty.call(MD, g.std) ? [g.std, MD[g.std]] : null);
  /* nxW(S, e): a MassDOT NEXT's beam width from the girder spacing S (ft): NEXT D b_f = 12 S − 13 in (dwg 11.2.3 note 2), NEXT F 12 S (the
     nominal width, dwg 9.2.3 note 2), within the sheet's minimum and maximum: { S, raw, bf } */
  const nxW = (S, e) => { const raw = 12 * S - (e.src.gap || 0); return { S, gap: e.src.gap || 0, raw, bf: Math.min(e.wMax, Math.max(e.wMin, raw)) }; };

  /* roundPoly(pts, rad, seg): the polygon pts with its corner i rounded to radius rad[i] (an arc of seg chords; 0: sharp) */
  function roundPoly(pts, rad, seg) {
    const out = [], n = pts.length;
    for (let i = 0; i < n; i++) {
      const r = rad[i] || 0, p = pts[i]; if (!r) { out.push(p); continue; }
      const a = pts[(i - 1 + n) % n], b = pts[(i + 1) % n], u = [a[0] - p[0], a[1] - p[1]], v = [b[0] - p[0], b[1] - p[1]], lu = Math.hypot(u[0], u[1]), lv = Math.hypot(v[0], v[1]);
      const ux = [u[0] / lu, u[1] / lu], vx = [v[0] / lv, v[1] / lv], th = Math.acos(Math.max(-1, Math.min(1, ux[0] * vx[0] + ux[1] * vx[1])));
      const t = r / Math.tan(th / 2), p1 = [p[0] + ux[0] * t, p[1] + ux[1] * t], p2 = [p[0] + vx[0] * t, p[1] + vx[1] * t];
      const bis = [ux[0] + vx[0], ux[1] + vx[1]], lb = Math.hypot(bis[0], bis[1]), dc = r / Math.sin(th / 2), c = [p[0] + bis[0] / lb * dc, p[1] + bis[1] / lb * dc];
      const a1 = Math.atan2(p1[1] - c[1], p1[0] - c[0]); let dA = Math.atan2(p2[1] - c[1], p2[0] - c[0]) - a1; while (dA > Math.PI) dA -= 2 * Math.PI; while (dA < -Math.PI) dA += 2 * Math.PI;
      for (let k = 0; k <= seg; k++) { const q = a1 + dA * k / seg; out.push([c[0] + r * Math.cos(q), c[1] + r * Math.sin(q)]); }
    }
    return out.map(q => [R2(q[0]), R2(q[1])]);
  }
  /* mdHalf(g, e): the right half of the drawn outline (x from the ℄, y up from the soffit; from the ℄ at the soffit (NEXT: at the flange
     underside) to the ℄ at the top, as the engine's halfPolygon; callers mirror it); null: the engine's own (adjacent box, deck beams) */
  function mdHalf(g, e) {
    const f = e.src.fam, h = +g.h, c = 0.79;
    if (f === 'nebt' || f === 'nedbt') { const [tt, tt2, tb, tb2] = e.d, bw = e.bw / 2, bb = e.bbf / 2, bt = e.btf / 2;
      return roundPoly([[0, 0], [bb - c, 0], [bb, c], [bb, tb], [bw, tb + tb2], [bw, h - tt - tt2], [bt, h - tt], [bt, h], [0, h]], [0, 0, 0, 3.94, 7.87, 7.87, f === 'nebt' ? 0.79 : 0, 0, 0], 8); }
    if (f === 'nextf' || f === 'nextd') { const s = 30, B = +e.B, Bt = e.src.stemTop, ft = e.flangeT, w = +g.btf / 2, k = 0.75;
      return roundPoly([[0, h - ft], [s - Bt / 2, h - ft], [s - B / 2, k], [s - B / 2 + k, 0], [s + B / 2 - k, 0], [s + B / 2, k], [s + Bt / 2, h - ft], [w, h - ft], [w, h], [0, h]], [0, e.src.fillet, 0, 0, 0, 0, e.src.fillet, 0, 0, 0], 8); }
    if (f === 'spread') { const w = e.src.w / 2, k = 0.75; return [[0, 0], [w - k, 0], [w, k], [w, h], [0, h]]; }
    return null;
  }
  /* mdVoids(g, e): the spread box's cell (a rectangle; its 3 × 3 in chamfers not drawn) and the deck beams' voids; null: the engine's */
  function mdVoids(g, e) {
    const s = e.src;
    if (s.fam === 'spread') { const vh = +g.h - s.top - s.bot; return [{ type: 'rect', x: 0, y: s.bot + vh / 2, w: s.w - 2 * s.web, h: vh }]; }
    if (s.fam === 'slab') return s.voids.map(v => ({ type: 'circle', x: v.x, y: +g.h / 2, d: v.d }));
    if (s.fam === 'solid' || s.fam === 'nebt' || s.fam === 'nedbt' || s.fam === 'nextf' || s.fam === 'nextd') return [];
    return null;
  }
  /* wrapMD(): the engine's girderGrossBase, halfPolygon and sectionVoids wrapped for the MassDOT entries only (every other shape: the
     engine's own result, untouched): the girder object is tagged g.std = its name (and a NEXT's g.nxw); a NEXT D gets the engine's width
     from S − 13 in */
  function wrapMD() {
    const W = typeof window !== 'undefined' ? window : globalThis;
    if (typeof girderGrossBase === 'function' && !girderGrossBase.__psbMD) {
      const g0 = girderGrossBase;
      const gb = function (inp) {
        const nm = inp && inp.girder, e = typeof nm === 'string' && Object.prototype.hasOwnProperty.call(MD, nm) ? MD[nm] : null; if (!e) return g0(inp);
        const nx = e.next ? nxW(+inp.S, e) : null;
        const g = g0(nx && nx.gap && isFinite(nx.raw) ? Object.assign({}, inp, { S: nx.raw / 12 }) : inp);
        g.std = nm; if (nx) g.nxw = nx;
        return g;
      };
      Object.defineProperty(gb, '__psbMD', { value: true }); W.girderGrossBase = gb;
    }
    if (typeof halfPolygon === 'function' && !halfPolygon.__psbMD) {
      const h0 = halfPolygon;
      const hp = function (g) { const m = mdOf(g), q = m ? mdHalf(g, m[1]) : null; return q || h0(g); };
      Object.defineProperty(hp, '__psbMD', { value: true }); W.halfPolygon = hp;
    }
    if (typeof sectionVoids === 'function' && !sectionVoids.__psbMD) {
      const v0 = sectionVoids;
      const sv = function (g) { const m = mdOf(g), q = m ? mdVoids(g, m[1]) : null; return q || v0(g); };
      Object.defineProperty(sv, '__psbMD', { value: true }); Object.defineProperty(sv, '__psbSections', { value: true }); W.sectionVoids = sv;
    }
  }
  /* mdNote(g): the Section properties tab's note of a MassDOT section (HTML; '' for any other): the sheet, what is drawn, what is not */
  function mdNote(g) {
    const m = mdOf(g); if (!m) return ''; const [nm, e] = m, s = e.src, f = s.fam, f2 = v => fx(v, 2);
    const head = `${nm}: A, I and y<sub>b</sub> from MassDOT Bridge Manual Part II dwg ${s.dwg} (p. ${s.page}), ${s.beam}`;
    if (f === 'nebt' || f === 'nedbt') return `${head}${s.ybPrinted ? ` (y<sub>b</sub> = ${f2(e.yb)} in: the sheet prints ${f2(s.ybPrinted)} in, a misprint; its y<sub>t</sub> = 33.60 in, the depth and S<sub>b</sub> = I / y<sub>b</sub> = 25,944 in³ give 46.40 in)` : ''}. Drawn with the sheet's flange tapers, web fillets and corner radii.`;
    if (f === 'nextf' || f === 'nextd') { const x = g.nxw || {};
      return `${head}: interpolated on the beam width b<sub>f</sub> = ${fx(+g.btf, 2)} in between ${e.wMin} and ${e.wMax} in (worked under Gross girder section${f === 'nextd' ? `; b<sub>f</sub> = 12 S − 13 in, the girder spacing less the 13 in closure, dwg ${s.dwg} note 2` : ''}); flange ${e.flangeT} in, stems ${f2(e.B)} in at the bottom to ${s.stemTop} in at the flange with R ${s.fillet} in fillets (drawn).`; }
    if (f === 'spread') return `${head}. Computed as an I-girder (tributary deck width, haunch and the engine's type (k) live load distribution); drawn as the box: ${f2(s.w)} in wide, top slab ${s.top} in, bottom slab ${s.bot} in, webs ${f2(s.web)} in, the cell a ${f2(s.w - 2 * s.web)} × ${f2(+g.h - s.top - s.bot)} in rectangle (its 3 × 3 in chamfers not drawn: a larger void, conservative for A<sub>ct</sub> and the strand fit).`;
    if (f === 'adj') return `${head}. Webs ${f2(s.web)} in, top slab ${s.top} in, bottom slab ${s.bot} in; the cell drawn as a ${f2(e.voidW)} × ${f2(e.voidH)} in rectangle (its 3 × 3 in chamfers, the ¾ in corner chamfers and the shear keys of dwg ${s.keys.dwg} not drawn).`;
    return `${head}${s.voids.length ? `: voids ${s.voids.map(v => `Ø${fx(v.d, 0)} in at x = ${f2(v.x)} in`).join(', ')} on mid-depth (dimensioned on the sheet)` : ' (solid)'}; the shear keys of dwg ${s.keys.dwg} and the ¾ in chamfers not drawn.`;
  }

  /* PS-41 (engineer decision 2026-11-14): a MassDOT section's strand row heights (its strand pattern layout sheet): the bottom row 2¼ in above
     the soffit for the box beams and deck beams (dwg 9.3.7 / 9.3.8 spread, 10.2.7 / 10.2.8 adjacent, 10.1.7 / 10.1.8 deck beams), 2½ in for
     the NEBT, NEDBT and NEXT (dwg 9.1.6, 11.1.7, 9.2.5, 11.2.7); the rows above every 2 in (2.25 / 4.25 / 6.25 in; 2.5 / 4.5 / 6.5 in). The box
     sheets draw the 36 in box: the 48 in boxes' pattern (2¾ in to the outer face, the 2 in grid) is extrapolated from them (flagged on the
     Girders & strands tab and in the Report). CTDOT and the old library: the rows as entered (no default moves them).
       rowGrid(name)  { first, step, dwg, page, extrap } of a MassDOT section, or null
       applyRows(b)   b (the inputs of the base design or of a girder type's view) on a MassDOT section: its straight rows, in order of height,
                      moved to the grid (counts and debonding kept); '' or the notice text
       rowNote(name)  the Girders & strands tab's note (HTML; '' for any other section); extrapText(name) the 48 in box flag ('' otherwise) */
  function rowGrid(name) {
    const e = Object.prototype.hasOwnProperty.call(MD, name) ? MD[name] : null; if (!e) return null; const s = e.src, f = s.fam;
    return { first: ['nebt', 'nedbt', 'nextf', 'nextd'].includes(f) ? 2.5 : 2.25, step: 2, dwg: s.strands.dwg, page: s.strands.page, extrap: (f === 'adj' || f === 'spread') && s.wNom === 48 };
  }
  const extrapText = name => { const r = rowGrid(name); return r && r.extrap ? `The MassDOT strand pattern sheets for box beams (dwg ${r.dwg}, p. ${r.page}) draw the 36 in box: the strand pattern of this 48 in box (bottom row 2¼ in, 2¾ in to the outer face, the 2 in grid) is extrapolated from that sheet, not shown on a MassDOT sheet; to be confirmed.` : ''; };
  function applyRows(b) {
    const r = isObj(b) ? rowGrid(b.girder) : null; if (!r || !Array.isArray(b.rows) || !b.rows.length) return '';
    const idx = b.rows.map((q, i) => i).filter(i => isObj(b.rows[i])).sort((i, j) => (+b.rows[i].y || 0) - (+b.rows[j].y || 0) || i - j), ch = [];
    idx.forEach((i, k) => { const y = R2(r.first + r.step * k), q = b.rows[i]; if (+q.y !== y) { ch.push([i, `row ${i + 1} y = ${q.y} → ${y} in`]); q.y = y; } });
    if (!ch.length) return '';
    return `Strand rows moved to the MassDOT row heights of ${b.girder} (PS-41: the bottom row ${r.first} in above the soffit, then every 2 in; dwg ${r.dwg}, p. ${r.page}): ${ch.sort((p, q) => p[0] - q[0]).map(c => c[1]).join(', ')}. The counts are kept: check the strand fit on the Girders & strands tab.${r.extrap ? ' ' + extrapText(b.girder) : ''}`;
  }
  function rowNote(name) {
    const r = rowGrid(name); if (!r) return '';
    return `MassDOT strand rows (PS-41): the bottom row ${r.first} in above the soffit and the rows above every 2 in (${[0, 1, 2].map(k => R2(r.first + 2 * k)).join(' / ')} in), as on dwg ${r.dwg} (p. ${r.page}); a section chosen from this group moves the rows to these heights (counts kept).${r.extrap ? ` <b>${extrapText(name)}</b>` : ''}`;
  }

  /* tbcNote(name): the "to be confirmed" note of a standard box beam / voided slab (engineer request 2026-11-14, PR A; the one exception to
     the no-pending-in-app rule): the plate the properties come from, the old library they replace (found inconsistent), the MassDOT section
     of the same size as the cross-check (XCHK; updated 2026-11-14 with PS-38 / PS-40); voided slabs: the void spacing, dimensioned on the
     MassDOT sheets (PS-40). HTML ('' for any other shape). Shown on the Girders & strands tab (ui/inputs.js, #secTbcNote) and in the Report's
     assumptions (report/builders.js tbcNotes). */
  function tbcNote(name) {
    const e = STD[name]; if (!e) return '';
    const s = e.src, box = s.kind === 'box', x = xchk(name), pc = v => `${v >= 0 ? '+' : '−'}${fx(Math.abs(v) * 100, 1)} %`;
    return `To be confirmed: A, I and y<sub>b</sub> of ${box ? 'this box beam' : 'this voided slab'} are taken from CTDOT BDM plate ${s.plate} (PDF p. ${s.page}). `
      + 'They replace the old app\'s box beam and voided slab library, which was found inconsistent (e.g. the old "BIII-36 (27in)" gave I = 97,756 in⁴, more than a solid 36 × 27 in rectangle at 59,049 in⁴). '
      + (x ? `Cross-check: the MassDOT Bridge Manual Part II ${box ? 'adjacent box beam' : 'deck beam'} of the same size, ${x.md} (dwg ${x.dwg}, p. ${x.page}), has A = ${fx(x.A, 0)} in², I = ${fx(x.I, 0)} in⁴, y<sub>b</sub> = ${fx(x.yb, 2)} in; the CTDOT values are ${pc(x.dA)}, ${pc(x.dI)} and ${pc(x.dyb)} from it${box ? ' (the CTDOT boxes are about 2–3 % below the MassDOT adjacent boxes; MassDOT\'s bottom slab is 6 in, CTDOT\'s 5½ in)' : ''}. ` : '')
      + 'The CTDOT values are to be confirmed by the engineer.'
      + (box ? '' : ` The void spacing (void centres at ${xs(s.voids.map(v => v.x))} in from the ℄) is not dimensioned on the CTDOT plate: it is MassDOT's dimensioned spacing for this void size and width (dwg ${s.voidSrc.dwg}, p. ${s.voidSrc.page}; PS-40).`);
  }

  /* PS-42 (engineer decision 2026-11-14, PS37-D4): a MassDOT NEDBT with no cast-in-place topping (t_s = 0) keeps the engine's type (k)
     distribution factors (no calculation change) but is flagged: the Loads & LLDF tab's distribution factor card (ui/loads.js, #nedbtNoTop),
     so the Report's Loads & LLDF section, and the Girders & strands tab's shape card (ui/inputs.js, #secNoTopNote).
       noTop(inp)      true for inputs (the base design, a girder type's or a line's) on a MassDOT NEDBT with t_s = 0 whose distribution
                       factors are computed (HL-93 × DF, the AASHTO equations); false otherwise (a topping, entered DF or live load, any other shape)
       noTopText(inp)  the warning (HTML; '' when noTop is false) */
  function noTop(inp) {
    const nm = isObj(inp) ? inp.girder : null, e = typeof nm === 'string' && Object.prototype.hasOwnProperty.call(MD, nm) ? MD[nm] : null;
    return !!(e && e.src.fam === 'nedbt' && !(+inp.ts > 0) && isObj(inp.loads) && inp.loads.llAuto && inp.loads.dfAuto);
  }
  const noTopText = inp => noTop(inp) ? `No cast-in-place topping is entered for this ${inp.girder} (deck thickness t<sub>s</sub> = 0, PS-42): the type (k) distribution factor equations are evaluated with t<sub>s</sub> = 0 in their deck-slab term K<sub>g</sub> / (12 L t<sub>s</sub>³), so the moment distribution factor comes out very large and is likely very conservative. Add the topping (deck thickness t<sub>s</sub>, <a href="#" data-goin="xsec">Cross-section tab</a>) or review the distribution factor by hand (for example a refined analysis) and enter it (<a href="#" data-goin="loads">Loads tab</a>).` : '';

  install(); wrapVoids(); wrapMD();
  window.PSBSections = { STD, LEGACY, MAP, ORDER_BOX, ORDER_SLAB, NEXT_FIX, LIB, XCHK, xchk, uses, stamp, MD, ORDER_MD, group, rowGrid, applyRows, rowNote, extrapText, mdOf, mdHalf, mdVoids, mdNote, noTop, noTopText, roundPoly, nxW, install, migrate, items, tags, text, retiredMsg, sig, withLegacy, src, tbcNote, DOT_J, dotJ, outline, slabOf, stdOf, engineOf };
})();
