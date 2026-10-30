/* apps/steel-bridge/engine/model.js — the Steel Bridge Design project data model, schema v1 (window.SBDModel).
   Classic script, no DOM: save/load take the storage object (window.localStorage on the page, a stand-in in tests).
   Created 2026-10-29 (docs/REBUILD_PLAN.md §5, "Project files: one versioned format").

   Saved-data rules (CLAUDE.md §5): every key this app writes starts with 'sbd2.' (KEYS below); no key of another tool
   or of the old Steel Bridge Design is read or written. A stored project that cannot be read is never overwritten:
   load() copies it to a backup key first. A later schema version adds a step to MIGRATIONS (v -> v+1) and keeps the
   old reader; nothing is discarded.

   Units: span lengths and stations ft; plates, deck and b_eff in; areas in^2; strengths ksi; unit weight kcf.

   Project (schema 'sbd2.project', version 1):
   {
     schema: 'sbd2.project', version: 1,
     project:   { name, number, owner, designer, checker, date, notes },      text
     spans:     { lengths: [ft, …], continuity: 'continuous' | 'simple' },
     materials: { steel: { top, bot, web } (grade keys of GRADES), Es (ksi),
                  concrete: { fc (ksi), wc (kcf), K1, nRule: 'exact' | 'round' }, rebar: { Fyr (ksi) } },
     deck:      { composite: true | false, ts (structural slab), tdeck (total), haunch (top of steel to bottom of slab),
                  rebar: { top: { A (in^2 per girder, within b_eff), c (centroid below top of slab) },
                           bot: { A, c (centroid above bottom of slab) } },
                  rebarInPositiveMp: false (App. D6.1: count the deck rebar in the positive plastic moment) },
     girders:   [ { id, label, position: 'interior' | 'exterior', beff (in),
                    segments: [ { x0, x1 (ft from the left end), D, tw, topB, topT, botB, botT (in) } ] } ],
     -- added 2026-10-29 (loads PR), optional: a version 1 project without them reads as defaultXs() and owner AASHTO --
     materials.concrete.wcE: unit weight for E_c only (kcf; blank = w_c; CTDOT BRSDM V2 5.4.2.4),
     ownerRules: { owner: 'AASHTO' | 'RIDOT' | 'MassDOT' | 'CTDOT', eta: { D: 'yes'|'no', R: 'auto'|'yes'|'no', I: 'yes'|'no', eD, eR, eI } },
     xs:        { nb (girders in the cross-section), bays: [ft, nb − 1], ohL, ohR (overhang, girder ℄ to deck edge, ft),
                  skews: [deg, one per support line], edges: { L, R: { type: 'barrier' | 'curb', bw (ft), bwt (klf), cw, ch (in), rw (klf),
                  rp, rf (ft; rf null = rp), face (ft; null = derived) } }, sidewalks: { L, R: { w (ft), t (in), fence (klf), fenceX (ft) }, ped (psf) },
                  median: { w (ft), t (in), joint }, wcA (appurtenance concrete, kcf; null = w_c), ws: { mode: 'psf' | 'thk', psf, thk (in), gam (kcf) },
                  overlays: [ { name, mode, psf, thk, gam } ], sip (psf), allow (steel detail allowance, %),
                  extra: [ { name, cat: 'DC1'|'DC2'|'DW'|'PL'|'UT'|'UF', x (ft), plf (klf), dist: 'auto'|'pilecap'|'equal'|'two' } ],
                  overrides: { loadId: { x, plf, dist } }, beamClass: { index: class }, dlMethod: 'massdot' | 'aashto' | 'ridot',
                  lldf: { gap (ft), kg: 'max' | 'avg' | 'simple', skewV: 'all' | 'ext', extMin: true | false } },
     -- added 2026-10-29 (shear and stiffeners PR), optional: a version 1 project without it reads as defaultStiffeners() --
     stiffeners: { layout: { web: 'stiffened' | 'unstiffened', mode: 'uniform' | 'bays', doRatio (uniform d_o/D),
                             bays: [ { g (girder number, 1-based), a, b (ft, the bay between bearings / cross-frames), n (intermediate
                                     stiffeners in the bay), e0, e1 (in, optional: an end stiffener at that distance from a / b) } ],
                             frames: { Lb (ft): intermediate cross-frames evenly in each span at most L_b apart, until the framing
                                       module exists; at: [ft, …] (optional: the stations themselves, every girder) } },
                   transverse: { gS (grade), Fexx (ksi), types: { A (intermediate stiffener), B (connection plate):
                                 { name, role: 'int' | 'cp', sides: '1' | '2', bt, tp, w (weld to web), gap (weld cutoff), wf (weld to
                                 flanges), c (clip), Fcp (kip, connection plate force) } } },
                   bearing: { gS, Fexx, ed (in, bearing ℄ to the girder end at the abutments), types: { A (abutments), B (piers):
                              { name, np (pairs), bt, tp, c, sp (pair spacing), w, conn: 'milled' | 'cjp' | 'fillet' } } } },
     -- added 2026-10-29 (fatigue and studs PR), optional: a version 1 project without them reads as defaultFatigue() / defaultStuds() --
     fatigue:   { limit: 'auto' | 'I' | 'II', ADTT (one direction, trucks/day), p (lane fraction), life (years), gam: { fI, fII },
                  catT, catB (detail category of the top / bottom flange for GS17: 'A' … "E'"), negSec: 'cracked' | 'uncracked',
                  dist: { cp: 'yes' | 'no' | 'na', lat: 'yes' | 'no', latLoc: 'flange' | 'web', latStiff: 'yes' | 'no', latDist (in), latBf (in), skew: 'yes' | 'no' } },
     studs:     { d (in: 0.75, 0.875, 1), h (in), st (transverse spacing, in), Fu (ksi), Qn10 (kip; 0 = Eq. 6.10.10.4.3-1), gamFat (γ Fatigue I),
                  skew: 'auto' | 'yes' | 'no' (F_fat = F_rc/w on skewed > 20° or curved bridges; auto: from the support skews), Frc (kip), wv (in),
                  splX ('82, 145': field splice stations, ft), splL (top splice plate length, ft), splC (clearance at each plate end, in),
                  beffMode: 'girder' (each girder its own, AASHTO 6.10.10; the default from 2026-10-29, SB2-F1) | 'bridge' (GirderDetail: one b_eff
                            for every girder, the largest-fatigue-shear girder's; kept for parity; a stored project keeps its value),
                  zones: [ { x1, x2 (ft), nr (studs per row), p (pitch, in) } ] (empty: the hand-off file's zones) },
     -- added 2026-10-29 (framing and cross-frames PR), optional: a version 1 project without them has no framing (the evenly spaced brace
        points of before) and reads the cross-frames as defaultCrossframes() --
     framing:   { spacing (s, ft), spPier (s_p near interior supports, ft; '' = none), pierLen (ft; '' = 0.25 L), orient: 'auto' | 'parallel' | 'normal',
                  arrange: 'contiguous' | 'staggered' | 'stepped', supClear (ft), stagMin (ft), spliceClear (ft), tol (ft), splices: [ft] (field splices),
                  flSkI, flSkE (ksi), flSkG (skew f_ℓ, C6.10.1) } (engine/framing.js)
     crossframes: { type: 'X' | 'Kb' | 'Kt', h (in; '' = from D), dMinXF (in), gA, gG, primary: 'auto' | 'yes' | 'no', dia: { on, shape, d, bf, tf, tw, gr, nb, pitch,
                  ecc, end, Rj, aj, eShape, eNb }, wind: { V, Kz, G, Cd }, mem: { top, bot, diag: { sec, b1, b2, t } }, conn: { d, gr, thr, n, s, e, tg },
                  user: { StrI, Con, Fat: { top, bot, diag } (kip) }, fatCat, sb: { on, full: 'auto' | 'yes' | 'no', Mu (kip-ft; '' = from the analysis), Cb,
                  bs, tsp }, weight: { mode: 'auto' | 'ovr' | 'off', allow (%), Wi, We (kip per frame) } } (engine/crossframes.js)
     -- added 2026-10-29 (analysis PR), optional, read by engine/analysis.js (absent = its defaults) --
     analysis:  { im, imf (%), crack: 'none' | '15' | 'dl', deflLimit (L/…), seq: 'on' | 'off', seqMod: 'n' | '3n', seqCustom (text),
                  steelAllowPct (%; used when xs.allow is not available), haunchInStiffness (true | false; absent = the owner rule) }
     girders[i].line: the cross-section girder (0-based, of xs.nb) whose loads and factors this plate girder takes
                  (absent: the first exterior girder for position 'exterior', else the first interior girder)
     girders[i].loadsManual: { DC1wet, DC2, DW, CL, UT, UF (klf), xf: [{ x (ft), P (kip) }] } and girders[i].dfManual: { gM, gMpier,
                  gV, fatM, fatV, gDef }: entered values, used where the loads module gives none (CL and xf: the module has none yet)
     -- added 2026-10-29 (constructibility PR), optional, read by engine/constructibility.js (absent = GirderDetail's Deck overhang defaults) --
     constr:    { oh: { a, hb (in, bracket projections), wOH, tOH (in), wc (kcf), qForm (ksf), wScreed, wRail, wWalk (klf), qCL (ksf), bCL (in),
                  Pfm (kip per bracket), Rh, Cb, gam: { dc, cl } } }: the overhang bracket loads on an exterior girder (OH1–OH5)
                constr.flC (ksi, added 2026-10-30, report wiring PR; optional, absent = 0): f_ℓ during deck placement, first order (GS14, GS15),
                  entered on the Constructibility tab
     -- added 2026-10-29 (field splices PR), optional, read by engine/splices.js (absent = defaultSplices()); the stations are framing.splices --
     splices:   { code: '10' | '8' (AASHTO LRFD edition of the design forces),
                  bolts: { d: '0.875' | '1' | '1.125', gr: 'A325' | 'A490', thr: 'excl' | 'incl', cls: 'A' | 'B', prep: 'drilled' | 'punched',
                           edge: 'cut' | 'sh', gap (in), long: 'flange' | 'both', eccS, eccV: 'incl' | 'excl', minLines, c1 (in; '' = table),
                           stitch: 'req' | 'adv' },
                  gam: { dcMax, dcMin, dwMax, dwMin, llS, llSv, fat, dc1C, clC }, clr: { cw, cv (in) }, prs: 'yes' | 'no', gP (plate grade; '' = flange),
                  auto: true | false (auto-design the plates and bolts of each splice), plates: [ { x, g (girder index; absent = every girder),
                  top, bot: { nl, g, g0, nr, s, ef, ep, bo, to, inner, bi, ti }, web: { h, t, nr, sv, nc, sh, ew, ewp } } ] (entered plates) }
     -- added 2026-10-29 (load rating PR), optional: a version 1 project without it reads as defaultRating() --
     rating:    { phiC (condition factor, MBE Table 6A.4.2.3-1), phiS (system factor, MBE Table 6A.4.2.4-1) }
     -- added 2026-10-30 (welds PR), optional: a version 1 project without it reads as defaultWelds() --
     welds:     { Fexx (ksi), w (flange-to-web fillet weld size, in; '' = the minimum of Table 6.13.3.4-1 at each location),
                  gam: { dc, dw, ll (Strength I), fat (Fatigue I) }, ground: 'yes' | 'no' (shop transition butt welds ground flush) }
   } */
(function () {
  'use strict';
  const SCHEMA = 'sbd2.project', VERSION = 1;
  const KEYS = { current: 'sbd2.project.current', backup: 'sbd2.project.unreadable.', ui: 'sbd2.ui' };   // backup + ISO time; ui: the page's tab choices
  // steel grades: F_y, F_u (ksi), as GirderDetail's GD_GR (ASTM A709)
  const GRADES = { '36': { Fy: 36, Fu: 58 }, '50': { Fy: 50, Fu: 65 }, '50W': { Fy: 50, Fu: 70 }, 'HPS50W': { Fy: 50, Fu: 70 }, 'HPS70W': { Fy: 70, Fu: 85 } };

  /* defaultProject(): a new project — 3-span continuous 110-140-110 ft, one interior girder with GirderDetail's built-in
     Girder section plates (positive region 16 × 3/4 top, 60 × 9/16 web, 16 × 1 1/8 bottom; pier region 18 × 1 1/2,
     18 × 2) and its deck (8 in slab, 2 in haunch, b_eff 114 in, A_r 6.6 / 3.2 in^2). */
  function defaultProject() {
    const pos = { D: 60, tw: 0.5625, topB: 16, topT: 0.75, botB: 16, botT: 1.125 }, neg = { D: 60, tw: 0.5625, topB: 18, topT: 1.5, botB: 18, botT: 2 };
    return {
      schema: SCHEMA, version: VERSION,
      project: { name: 'New steel bridge', number: '', owner: '', designer: '', checker: '', date: '', notes: '' },
      spans: { lengths: [110, 140, 110], continuity: 'continuous' },
      materials: { steel: { top: '50W', bot: '50W', web: '50W' }, Es: 29000, concrete: { fc: 4, wc: 0.150, K1: 1.0, nRule: 'exact' }, rebar: { Fyr: 60 } },
      deck: { composite: true, ts: 8, tdeck: 8.5, haunch: 2, rebar: { top: { A: 6.6, c: 2.5 }, bot: { A: 3.2, c: 1.75 } }, rebarInPositiveMp: false },
      girders: [{ id: 'G1', label: 'G1', position: 'interior', beff: 114, segments: [
        { x0: 0, x1: 88, ...pos }, { x0: 88, x1: 128, ...neg }, { x0: 128, x1: 232, ...pos }, { x0: 232, x1: 272, ...neg }, { x0: 272, x1: 360, ...pos }] }],
      ownerRules: { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } },
      xs: defaultXs({ spans: { lengths: [110, 140, 110] } }),
      stiffeners: defaultStiffeners(),
      fatigue: defaultFatigue(),
      studs: defaultStuds(),
      framing: defaultFraming(),
      crossframes: defaultCrossframes(),
      splices: defaultSplices(),
      welds: defaultWelds()
    };
  }
  /* defaultXs(p): GirderDetail's built-in cross-section (5 girders at 9.5 ft, 3.25 ft overhangs, 1.5 ft 0.40 klf barriers, 25 psf future
     wearing surface, 15 psf SIP forms, 5% detail allowance, MassDOT 3.5.3 distribution), unskewed, one skew per support of p's spans. */
  function defaultXs(p) {
    const ns = ((p && p.spans && p.spans.lengths) || [0]).length + 1, bar = () => ({ type: 'barrier', bw: 1.5, bwt: 0.4, cw: 12, ch: 10, rw: 0.05, rp: 0.5, rf: null, face: null });
    return { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], ohL: 3.25, ohR: 3.25, skews: new Array(ns).fill(0), edges: { L: bar(), R: bar() },
      sidewalks: { L: { w: 0, t: 8, fence: null, fenceX: null }, R: { w: 0, t: 8, fence: null, fenceX: null }, ped: 0 }, median: { w: 0, t: 8, joint: false }, wcA: null,
      ws: { mode: 'psf', psf: 25, thk: null, gam: null }, overlays: [], sip: 15, allow: 5, extra: [], overrides: {}, beamClass: {}, dlMethod: 'massdot',
      lldf: { gap: 4, kg: 'max', skewV: 'all', extMin: false } };
  }
  /* defaultStiffeners(): GirderDetail's built-in stiffener inputs (Preliminary sizing framing: stiffened web, uniform d_o = 1.0D, cross-frames
     at most 25 ft apart; Transverse stiffeners GM.ts.def types; Bearing stiffeners BS_DEFAULT types, 9 in to the girder end) */
  function defaultStiffeners() {
    return { layout: { web: 'stiffened', mode: 'uniform', doRatio: 1.0, bays: [], frames: { Lb: 25 } },
      transverse: { gS: '50W', Fexx: 70, types: { A: { name: 'Intermediate stiffener', role: 'int', sides: '1', bt: 6, tp: 0.5, w: 0.25, gap: 2.75, wf: 0.3125, c: 1, Fcp: 20 },
        B: { name: 'Connection plate', role: 'cp', sides: '1', bt: 6, tp: 0.5, w: 0.25, gap: 2.75, wf: 0.3125, c: 1, Fcp: 20 } } },
      bearing: { gS: '50W', Fexx: 70, ed: 9, types: { A: { name: 'Abutment', np: 1, bt: 7, tp: 0.875, c: 1, sp: 12, w: 0.3125, conn: 'milled' }, B: { name: 'Pier', np: 2, bt: 8, tp: 1, c: 1, sp: 12, w: 0.3125, conn: 'milled' } } } };
  }
  /* defaultFatigue(): GirderDetail's built-in Fatigue settings (GM.fa.def), Category B flanges (Girder section GM.gs.def catT, catB) */
  function defaultFatigue() {
    return { limit: 'auto', ADTT: 2000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.80 }, catT: 'B', catB: 'B', negSec: 'cracked',
      dist: { cp: 'yes', lat: 'no', latLoc: 'web', latStiff: 'yes', latDist: 10, latBf: 16, skew: 'no' } };
  }
  /* defaultStuds(): GirderDetail's built-in Shear connectors studs (GM.sc.def: 7/8 × 6 in, 4 in across, F_u 60 ksi, γ 1.75, F_rc 25 kip, w 48 in) */
  /* defaultFraming(): Preliminary sizing's built-in framing (cross-frames at most 25 ft apart, automatic orientation, contiguous, 3 ft clear of
     the bearings, 4 ft least stagger) and limits (2 ft splice clearance, 0.5 ft transition tolerance, skew f_ℓ 10 / 7.5 ksi × 1.25), and its
     built-in field splices (82, 145, 215, 278 ft, for the built-in 110-140-110 ft spans) */
  function defaultFraming() {
    return { spacing: 25, spPier: '', pierLen: '', orient: 'auto', arrange: 'contiguous', supClear: 3, stagMin: 4, spliceClear: 2, tol: 0.5, splices: [82, 145, 215, 278], flSkI: 10, flSkE: 7.5, flSkG: 1.25 };
  }
  /* defaultCrossframes(): GirderDetail's built-in Cross-frames inputs (GM.cf.def: X-frame, L5x5x3/8 angles of grade 36, gussets grade 50, two
     7/8 in A325 bolts per end, 130 mph wind, stability bracing checked), the geometry from the project, the weight in DC1 from the member sizes
     + 10 % (XF1, XF2) */
  function defaultCrossframes() {
    const A = () => ({ sec: 'L5x5x3/8', b1: 5, b2: 5, t: 0.375 }), Z = () => ({ top: 0, bot: 0, diag: 0 });
    return { type: 'X', h: '', dMinXF: 48, gA: '36', gG: '50', primary: 'auto', dia: { on: 'no', shape: 'W21x44', d: 20.7, bf: 6.5, tf: 0.45, tw: 0.35, gr: '50', nb: 4, pitch: 3, ecc: 3.5, end: 'no', Rj: 0, aj: 12, P: 0 },
      wind: { V: 130, Kz: 1.0, G: 1.0, Cd: 1.3 }, mem: { top: A(), bot: A(), diag: A() }, conn: { d: '0.875', gr: 'A325', thr: 'incl', n: 2, s: 3, e: 1.5, tg: 0.5 },
      user: { StrI: Z(), Con: Z(), Fat: Z() }, fatCat: 'B', sb: { on: 'yes', full: 'auto', Mu: '', Cb: 1, bs: 5, tsp: 0.5 }, weight: { mode: 'auto', allow: 10, Wi: '', We: '' } };
  }
  function defaultStuds() {
    return { d: 0.875, h: 6, st: 4, Fu: 60, Qn10: 0, gamFat: 1.75, skew: 'auto', Frc: 25, wv: 48, splX: '', splL: 0, splC: 3, beffMode: 'girder', zones: [] };   // beffMode 'girder' by default from 2026-10-29 (SB2-F1)
  }
  /* defaultSplices(): GirderDetail's built-in Field splice settings (GD_DEFAULT bolts, load factors, clearances), auto-design on */
  function defaultSplices() {
    return { code: '10', bolts: { d: '0.875', gr: 'A325', thr: 'excl', cls: 'B', prep: 'drilled', edge: 'cut', gap: 0.5, long: 'flange', eccS: 'incl', eccV: 'excl', minLines: 2, c1: '', stitch: 'req' },
      gam: { dcMax: 1.25, dcMin: 0.90, dwMax: 1.50, dwMin: 0.65, llS: 1.75, llSv: 1.30, fat: 1.75, dc1C: 1.25, clC: 1.50 }, clr: { cw: 0.5, cv: 1.5 }, prs: 'no', gP: '', auto: true, plates: [] };
  }
  /* defaultRating(): the load rating inputs (ST-Girder's defaults, rate: { phiC: 1.0, phiS: 1.0 }) */
  function defaultRating() { return { phiC: 1.0, phiS: 1.0 }; }
  /* defaultWelds(): GirderDetail's built-in Welds and transitions settings (GM.wt.def: E70XX, γ 1.25 / 1.50 / 1.75, Fatigue I 1.75), the weld
     size the minimum of Table 6.13.3.4-1 at each location (Preliminary sizing's rule), transitions ground flush */
  function defaultWelds() { return { Fexx: 70, w: '', gam: { dc: 1.25, dw: 1.50, ll: 1.75, fat: 1.75 }, ground: 'yes' }; }
  const OWNERS = ['AASHTO', 'RIDOT', 'MassDOT', 'CTDOT'];

  const isNum = v => typeof v === 'number' && isFinite(v);
  /* validate(p): { errors: [{ path, msg }], warnings: [{ path, msg }] }. Errors stop the calculation; warnings do not. */
  function validate(p) {
    const errors = [], warnings = [], E = (path, msg) => errors.push({ path, msg }), W = (path, msg) => warnings.push({ path, msg });
    const pos = (v, path, what) => { if (!(isNum(v) && v > 0)) E(path, `${what} must be a positive number.`); };
    const nn = (v, path, what) => { if (!(isNum(v) && v >= 0)) E(path, `${what} must be zero or a positive number.`); };
    if (!p || typeof p !== 'object') { E('', 'No project.'); return { errors, warnings }; }
    if (p.schema !== SCHEMA) E('schema', `Not a ${SCHEMA} file.`);
    if (p.version !== VERSION) E('version', `Schema version ${p.version} is not version ${VERSION}.`);
    const sp = p.spans || {}, L = Array.isArray(sp.lengths) ? sp.lengths : [];
    if (!L.length) E('spans.lengths', 'Enter at least one span.');
    L.forEach((v, i) => pos(v, `spans.lengths.${i}`, `Span ${i + 1} length`));
    if (!['continuous', 'simple'].includes(sp.continuity)) E('spans.continuity', 'Continuity must be "continuous" or "simple".');
    const total = L.reduce((a, b) => a + (isNum(b) ? b : 0), 0);
    const m = p.materials || {}, st = m.steel || {}, c = m.concrete || {};
    ['top', 'bot', 'web'].forEach(k => { if (!GRADES[st[k]]) E(`materials.steel.${k}`, `Unknown steel grade "${st[k]}".`); });
    pos(m.Es, 'materials.Es', 'E_s');
    pos(c.fc, 'materials.concrete.fc', "f'c"); pos(c.wc, 'materials.concrete.wc', 'w_c'); pos(c.K1, 'materials.concrete.K1', 'K_1');
    if (!['exact', 'round'].includes(c.nRule)) E('materials.concrete.nRule', 'Modular ratio rule must be "exact" or "round".');
    pos((m.rebar || {}).Fyr, 'materials.rebar.Fyr', 'F_yr');
    const d = p.deck || {};
    if (typeof d.composite !== 'boolean') E('deck.composite', 'Composite must be true or false.');
    pos(d.ts, 'deck.ts', 'Structural slab thickness'); pos(d.tdeck, 'deck.tdeck', 'Total deck thickness'); nn(d.haunch, 'deck.haunch', 'Haunch');
    if (isNum(d.ts) && isNum(d.tdeck) && d.tdeck < d.ts) E('deck.tdeck', 'The total deck thickness is less than the structural thickness.');
    const rb = d.rebar || {};
    ['top', 'bot'].forEach(k => { const r = rb[k] || {}; nn(r.A, `deck.rebar.${k}.A`, `${k === 'top' ? 'Top' : 'Bottom'} rebar area`); pos(r.c, `deck.rebar.${k}.c`, `${k === 'top' ? 'Top' : 'Bottom'} rebar cover to centroid`);
      if (isNum(r.c) && isNum(d.ts) && r.c >= d.ts) E(`deck.rebar.${k}.c`, 'Rebar layers must lie within the structural slab.'); });
    const G = Array.isArray(p.girders) ? p.girders : [];
    if (!G.length) E('girders', 'Enter at least one girder.');
    const ids = new Set();
    G.forEach((g, gi) => {
      const gp = `girders.${gi}`;
      if (!g || typeof g !== 'object') { E(gp, 'Girder is not an object.'); return; }
      if (!g.id || ids.has(g.id)) E(`${gp}.id`, 'Each girder needs its own id.'); ids.add(g.id);
      if (!['interior', 'exterior'].includes(g.position)) E(`${gp}.position`, 'Position must be "interior" or "exterior".');
      if (d.composite) pos(g.beff, `${gp}.beff`, 'Effective flange width');
      const S = Array.isArray(g.segments) ? g.segments : [];
      if (!S.length) E(`${gp}.segments`, `${g.label || g.id}: enter at least one plate segment.`);
      S.forEach((s, si) => {
        const sp2 = `${gp}.segments.${si}`;
        ['D', 'tw', 'topB', 'topT', 'botB', 'botT'].forEach(k => pos(s[k], `${sp2}.${k}`, `${g.label || g.id} segment ${si + 1}: ${k}`));
        if (!(isNum(s.x0) && isNum(s.x1) && s.x1 > s.x0)) E(`${sp2}.x1`, `${g.label || g.id} segment ${si + 1}: x1 must be greater than x0.`);
        const x0 = si ? S[si - 1].x1 : 0;
        if (isNum(s.x0) && isNum(x0) && Math.abs(s.x0 - x0) > 1e-6) E(`${sp2}.x0`, `${g.label || g.id} segment ${si + 1} starts at ${s.x0} ft, not at ${x0} ft (segments must be contiguous from 0).`);
        if (isNum(s.D) && isNum(s.tw) && s.D / s.tw > 150) W(`${sp2}.tw`, `${g.label || g.id} segment ${si + 1}: D/t_w = ${(s.D / s.tw).toFixed(1)} > 150 (6.10.2.1.1).`);
      });
      const last = S[S.length - 1];
      if (last && isNum(last.x1) && total > 0 && Math.abs(last.x1 - total) > 1e-6) E(`${gp}.segments`, `${g.label || g.id}: the segments end at ${last.x1} ft; the girder is ${total} ft long.`);
    });
    // added 2026-10-29 (loads PR): the optional owner rules and cross-section
    if (c.wcE != null && c.wcE !== '' && !(isNum(c.wcE) && c.wcE > 0)) E('materials.concrete.wcE', 'w_c for E_c must be positive (or blank for w_c).');
    if (p.ownerRules != null) { const o = p.ownerRules || {};
      if (!OWNERS.includes(o.owner)) E('ownerRules.owner', `Owner must be one of ${OWNERS.join(', ')}.`);
      const e = o.eta || {}; ['eD', 'eR', 'eI'].forEach(k => { if (e[k] != null && !(isNum(e[k]) && e[k] > 0)) E(`ownerRules.eta.${k}`, `η factor ${k} must be positive.`); }); }
    if (p.xs != null) { const x = p.xs || {}, xp = 'xs';
      if (!(Number.isInteger(x.nb) && x.nb >= 2)) E(`${xp}.nb`, 'Enter at least two girders (a whole number).');
      const B = Array.isArray(x.bays) ? x.bays : [];
      if (Number.isInteger(x.nb) && B.length !== x.nb - 1) E(`${xp}.bays`, `Enter ${x.nb - 1} girder spacings (one per bay); ${B.length} entered.`);
      B.forEach((v, i) => { if (!(isNum(v) && v > 0)) E(`${xp}.bays`, `Girder spacing ${i + 1} must be a positive number.`); });
      nn(x.ohL, `${xp}.ohL`, 'Left overhang'); nn(x.ohR, `${xp}.ohR`, 'Right overhang');
      const K = Array.isArray(x.skews) ? x.skews : [];
      if (K.length !== L.length + 1) E(`${xp}.skews`, `Enter ${L.length + 1} support skews (one per support line); ${K.length} entered.`);
      K.forEach((v, i) => { if (!(isNum(v) && Math.abs(v) < 90)) E(`${xp}.skews`, `Skew ${i + 1} must be a number of degrees between −90 and 90.`); });
      ['L', 'R'].forEach(sd => { const q = (x.edges || {})[sd]; if (!q || !['barrier', 'curb'].includes(q.type)) E(`${xp}.edges.${sd}.type`, `${sd === 'L' ? 'Left' : 'Right'} deck edge: choose a barrier or a curb and railing.`); });
      if (!['psf', 'thk'].includes((x.ws || {}).mode)) E(`${xp}.ws.mode`, 'Wearing surface: enter it as psf or as thickness × unit weight.');
      else if (x.ws.mode === 'psf') nn(x.ws.psf, `${xp}.ws.psf`, 'Wearing surface weight');
      nn(x.sip, `${xp}.sip`, 'SIP form weight'); nn(x.allow, `${xp}.allow`, 'Steel detail allowance');
      if (!['massdot', 'aashto', 'ridot'].includes(x.dlMethod)) E(`${xp}.dlMethod`, 'Choose a dead load distribution method.');
      const ll = x.lldf || {}; if (!(isNum(ll.gap) && ll.gap >= 4)) E(`${xp}.lldf.gap`, 'Gap between adjacent trucks must be at least 4 ft.');
      if (!['max', 'avg', 'simple'].includes(ll.kg)) E(`${xp}.lldf.kg`, 'Choose how K_g is taken.');
      if (!Array.isArray(x.extra)) E(`${xp}.extra`, 'Added loads must be a list.');
      if (isNum(x.nb) && x.nb === 3) W(`${xp}.nb`, 'N_b = 3: the special rules of Tables 4.6.2.2.2b-1 and 4.6.2.2.3a-1 apply (lever rule).'); }
    // added 2026-10-29 (shear and stiffeners PR): the optional stiffener inputs
    if (p.stiffeners != null) { const S = p.stiffeners || {}, ly = S.layout || {}, sp = 'stiffeners';
      if (!['stiffened', 'unstiffened'].includes(ly.web)) E(`${sp}.layout.web`, 'Web: choose stiffened or unstiffened.');
      if (!['uniform', 'bays'].includes(ly.mode)) E(`${sp}.layout.mode`, 'Stiffener spacing: choose uniform or per bay.');
      pos(ly.doRatio, `${sp}.layout.doRatio`, 'd_o/D');
      if (!Array.isArray(ly.bays)) E(`${sp}.layout.bays`, 'Per-bay stiffeners must be a list.');
      else ly.bays.forEach((q, i) => { if (!(isNum(q.a) && isNum(q.b) && q.b > q.a && Number.isInteger(q.g) && q.g >= 1 && Number.isInteger(q.n) && q.n >= 0)) E(`${sp}.layout.bays.${i}`, `Bay ${i + 1}: girder, a < b and a whole number of stiffeners are required.`);
        ['e0', 'e1'].forEach(k => { if (q[k] != null && !Number.isNaN(q[k]) && !(isNum(q[k]) && q[k] >= 0)) E(`${sp}.layout.bays.${i}.${k}`, `Bay ${i + 1}: ${k} must be zero or positive.`); }); });
      const fr = ly.frames || {}; if (!(isNum(fr.Lb) && fr.Lb > 0) && !Array.isArray(fr.at)) E(`${sp}.layout.frames.Lb`, 'Cross-frame spacing L_b must be a positive number.');
      [['transverse', ['bt', 'tp', 'w']], ['bearing', ['bt', 'tp', 'w']]].forEach(([k, req]) => { const q = S[k] || {}; if (!GRADES[q.gS]) E(`${sp}.${k}.gS`, `Unknown steel grade "${q.gS}".`); pos(q.Fexx, `${sp}.${k}.Fexx`, 'F_EXX');
        ['A', 'B'].forEach(t => { const ty = (q.types || {})[t]; if (!ty) { E(`${sp}.${k}.types.${t}`, `Type ${t} is missing.`); return; } req.forEach(f => pos(ty[f], `${sp}.${k}.types.${t}.${f}`, `Type ${t} ${f}`)); }); });
      nn((S.bearing || {}).ed, `${sp}.bearing.ed`, 'Distance to the girder end'); }
    // added 2026-10-29 (fatigue and studs PR): the optional fatigue and stud inputs
    if (p.fatigue != null) { const F = p.fatigue || {}, CATS = ['A', 'B', "B'", 'C', "C'", 'D', 'E', "E'"];
      if (!['auto', 'I', 'II'].includes(F.limit)) E('fatigue.limit', 'Fatigue limit state: choose by ADTT, Fatigue I or Fatigue II.');
      pos(F.ADTT, 'fatigue.ADTT', 'ADTT'); if (!(isNum(F.p) && F.p > 0 && F.p <= 1)) E('fatigue.p', 'Lane fraction p must be more than 0 and at most 1.0.');
      pos(F.life, 'fatigue.life', 'Design life'); pos((F.gam || {}).fI, 'fatigue.gam.fI', 'γ Fatigue I'); pos((F.gam || {}).fII, 'fatigue.gam.fII', 'γ Fatigue II');
      ['catT', 'catB'].forEach(k => { if (!CATS.includes(F[k])) E(`fatigue.${k}`, 'Choose a detail category.'); }); }
    if (p.studs != null) { const Q = p.studs || {};
      if (![0.75, 0.875, 1].includes(+Q.d)) E('studs.d', 'Stud diameter: 3/4, 7/8 or 1 in.');
      pos(Q.h, 'studs.h', 'Stud height'); pos(Q.st, 'studs.st', 'Transverse spacing'); pos(Q.Fu, 'studs.Fu', 'Stud F_u'); nn(Q.Qn10, 'studs.Qn10', 'Q_n entered');
      pos(Q.gamFat, 'studs.gamFat', 'γ Fatigue I'); pos(Q.Frc, 'studs.Frc', 'F_rc'); pos(Q.wv, 'studs.wv', 'w'); nn(Q.splL, 'studs.splL', 'Splice plate length'); nn(Q.splC, 'studs.splC', 'Clearance');
      if (!['bridge', 'girder'].includes(Q.beffMode)) E('studs.beffMode', 'b_eff for the studs: bridge-wide or per girder.');
      if (!Array.isArray(Q.zones)) E('studs.zones', 'Pitch zones must be a list.');
      else Q.zones.forEach((z, i) => { if (!(isNum(z.x1) && isNum(z.x2) && z.x2 > z.x1 && Number.isInteger(z.nr) && z.nr >= 1 && isNum(z.p) && z.p > 0)) E(`studs.zones.${i}`, `Zone ${i + 1}: from < to, a whole number of studs per row and a positive pitch.`); }); }
    // added 2026-10-29 (framing and cross-frames PR)
    if (p.framing != null) { const F = p.framing || {}, fp = 'framing';
      pos(F.spacing, `${fp}.spacing`, 'Cross-frame spacing');
      ['supClear', 'stagMin', 'spliceClear', 'tol'].forEach(k => nn(F[k], `${fp}.${k}`, `Framing ${k}`));
      if (F.spPier !== '' && F.spPier != null && !(isNum(F.spPier) && F.spPier > 0)) E(`${fp}.spPier`, 'Spacing near interior supports must be positive (or blank).');
      if (F.pierLen !== '' && F.pierLen != null && !(isNum(F.pierLen) && F.pierLen > 0)) E(`${fp}.pierLen`, 'Pier region length must be positive (or blank).');
      if (!['auto', 'parallel', 'normal'].includes(F.orient)) E(`${fp}.orient`, 'Orientation: automatic, parallel or normal.');
      if (!['contiguous', 'staggered', 'stepped'].includes(F.arrange)) E(`${fp}.arrange`, 'Arrangement: contiguous, staggered or stepped.');
      if (!Array.isArray(F.splices) || !F.splices.every(v => isNum(v) && v > 0 && v < total)) E(`${fp}.splices`, `Field splices: stations between 0 and ${total} ft.`); }
    if (p.crossframes != null) { const C = p.crossframes || {}, cp = 'crossframes';
      if (!['X', 'Kb', 'Kt'].includes(C.type)) E(`${cp}.type`, 'Cross-frame type: X, K (bottom) or K (top).');
      if (C.h !== '' && C.h != null && !(isNum(C.h) && C.h > 0)) E(`${cp}.h`, 'Chord work-point depth must be positive (or blank).');
      ['V', 'Kz', 'G', 'Cd'].forEach(k => nn((C.wind || {})[k], `${cp}.wind.${k}`, `Wind ${k}`));
      if (C.sb && C.sb.Mu !== '' && C.sb.Mu != null && !isNum(C.sb.Mu)) E(`${cp}.sb.Mu`, 'Deck-placement M_u must be a number (or blank: from the analysis).'); }
    // added 2026-10-29 (field splices PR): the optional field splice inputs
    if (p.splices != null) { const Q = p.splices || {}, B = Q.bolts || {};
      if (!['0.875', '1', '1.125'].includes(String(B.d))) E('splices.bolts.d', 'Bolt diameter: 7/8, 1 or 1 1/8 in.');
      if (!['A325', 'A490'].includes(B.gr)) E('splices.bolts.gr', 'Bolt grade: A325 or A490.');
      nn(B.gap, 'splices.bolts.gap', 'Gap between girder ends');
      if (!(Number.isInteger(+B.minLines) && +B.minLines >= 1)) E('splices.bolts.minLines', 'Minimum bolt lines: a whole number of at least 1.');
      Object.entries(Q.gam || {}).forEach(([k, v]) => pos(v, `splices.gam.${k}`, `Load factor ${k}`));
      Object.entries(Q.clr || {}).forEach(([k, v]) => nn(v, `splices.clr.${k}`, `Clearance ${k}`));
      if (!['10', '8'].includes(String(Q.code))) E('splices.code', 'Edition: 10th or 8th.');
      if (Q.plates != null && !Array.isArray(Q.plates)) E('splices.plates', 'Entered splice plates must be a list.'); }
    // added 2026-10-29 (load rating PR): the optional rating factors
    if (p.rating != null) { const Q = p.rating || {};
      [['phiC', 'Condition factor φ_c'], ['phiS', 'System factor φ_s']].forEach(([k, t]) => { if (!(isNum(Q[k]) && Q[k] > 0 && Q[k] <= 1)) E(`rating.${k}`, `${t} must be more than 0 and at most 1.0.`); }); }
    // added 2026-10-30 (welds PR)
    if (p.welds != null) { const Q = p.welds || {};
      pos(Q.Fexx, 'welds.Fexx', 'F_EXX'); if (Q.w !== '' && Q.w != null) pos(Q.w, 'welds.w', 'Fillet weld size');
      ['dc', 'dw', 'll', 'fat'].forEach(k => pos((Q.gam || {})[k], `welds.gam.${k}`, `Load factor ${k}`));
      if (!['yes', 'no'].includes(Q.ground)) E('welds.ground', 'Transition butt welds: ground flush yes or no.'); }
    // added 2026-10-30 (report wiring PR): the optional f_ℓ during deck placement
    if (p.constr != null && p.constr.flC != null && !isNum(p.constr.flC)) E('constr.flC', 'f_ℓ during deck placement must be a number (ksi).');
    return { errors, warnings };
  }

  /* migrate(obj): an older sbd2.project brought to VERSION (none yet: version 1 is the first). Returns the object. */
  const MIGRATIONS = {};   // e.g. MIGRATIONS[1] = p => { …; p.version = 2; return p; }
  function migrate(obj) {
    let p = obj;
    while (p && p.schema === SCHEMA && typeof p.version === 'number' && p.version < VERSION) {
      const f = MIGRATIONS[p.version]; if (!f) throw new Error(`No migration from version ${p.version}.`);
      p = f(JSON.parse(JSON.stringify(p)));
    }
    if (p && p.schema === SCHEMA && p.version > VERSION) throw new Error(`This file is schema version ${p.version}; this app reads up to version ${VERSION}. Use a newer copy of the app.`);
    return p;
  }

  /* legacyKind(obj): which older tool wrote obj, or '' (GirderDetail / Steel Bridge Design, PlateLine, ST-Girder). */
  function legacyKind(obj) {
    if (!obj || typeof obj !== 'object') return '';
    if (obj._schema === 'stgirder' || obj._schema === 'stgirder-external-demands') return 'ST-Girder';
    if (obj.app === 'SteelBridgeDesign' || obj.app === 'GirderDetail') return 'GirderDetail';
    if (obj.app === 'PlateLine' || obj.app === 'PlateLine-splices') return 'Preliminary sizing (PlateLine)';
    return '';
  }
  /* importLegacy(obj): STUB. Importing old GirderDetail, Preliminary sizing and ST-Girder projects comes in a later PR
     (docs/REBUILD_PLAN.md §5, "Project files"). Until then it reports that and changes nothing. */
  function importLegacy(obj) {
    const k = legacyKind(obj);
    return { ok: false, legacy: k, error: `${k || 'This'} project files cannot be imported yet: importing old GirderDetail, Preliminary sizing and ST-Girder projects comes in a later version of this app. The file was not changed.` };
  }

  /* exportJSON(p): the file text (pretty-printed). importJSON(text): { ok, project, errors, warnings } or { ok: false, error }. */
  function exportJSON(p) { return JSON.stringify(p, null, 2); }
  function importJSON(text) {
    let obj;
    try { obj = JSON.parse(text); } catch (e) { return { ok: false, error: `Not a JSON file: ${e.message}` }; }
    if (legacyKind(obj)) return importLegacy(obj);
    if (!obj || obj.schema !== SCHEMA) return { ok: false, error: 'Not a Steel Bridge Design (sbd2) project file.' };
    let p; try { p = migrate(obj); } catch (e) { return { ok: false, error: e.message }; }
    const v = validate(p);
    return { ok: true, project: p, errors: v.errors, warnings: v.warnings };
  }

  /* save(storage, p): writes the project to KEYS.current. Returns true, or false if storage refused (quota, privacy mode). */
  function save(storage, p) {
    try { storage.setItem(KEYS.current, exportJSON(p)); return true; } catch (e) { return false; }
  }
  /* load(storage): { project, errors, warnings, source: 'saved' | 'default', note, noAutosave }. A stored text that cannot be read
     is copied to KEYS.backup + time before the default project is returned, so the next save does not lose it. */
  function load(storage, now) {
    let raw = null;
    try { raw = storage.getItem(KEYS.current); } catch (e) { raw = null; }
    if (raw == null) { const p = defaultProject(); return { project: p, ...validate(p), source: 'default', note: '' }; }
    const r = importJSON(raw);
    if (r.ok) return { project: r.project, errors: r.errors, warnings: r.warnings, source: 'saved', note: '' };
    const bk = KEYS.backup + (now || new Date().toISOString());
    let kept = true; try { storage.setItem(bk, raw); } catch (e) { kept = false; }
    const p = defaultProject();
    // kept false (storage full): the original key is still untouched; the page must not autosave over it (noAutosave)
    return { project: p, ...validate(p), source: 'default', noAutosave: !kept,
      note: kept ? `The saved project could not be read (${r.error}). It was kept under "${bk}"; a new project was started.`
        : `The saved project could not be read (${r.error}) and could not be backed up (storage full). It is left as it was; autosave is off until you export or save.` };
  }

  window.SBDModel = { SCHEMA, VERSION, KEYS, GRADES, OWNERS, defaultProject, defaultXs, defaultStiffeners, defaultFatigue, defaultStuds, defaultFraming, defaultCrossframes, defaultSplices, defaultRating, defaultWelds, validate, migrate, legacyKind, importLegacy, exportJSON, importJSON, save, load };
})();
