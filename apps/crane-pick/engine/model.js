/* apps/crane-pick/engine/model.js — the Crane Pick Analyzer project (window.CranePickModel). Classic script, no DOM. C1 (2026-11-16).

   Saved data (CLAUDE.md §5; every key starts with "crane."):
     crane.project.current   the open project (autosave, JSON of the project below; written on every change)
     crane.projects.v1       the saved-project list (shared/projects.js mapStore: { "<name>": project with savedAt })
     crane.open              the name of the saved project the open project belongs to ('' when none)
     crane.ui                the page's view choices (tabs, base map), per browser; never part of a project
     crane.library.v1        C2-1: the crane library of this browser (ui/cranes.js): { v: 1, cranes: { <key>: { def, src, at, fp } } }
     crane.libsrc            C2-1: where "Load crane library from GitHub" reads: { owner, repo, branch, folder }
     crane.syncCheck         C2-1: the last check of the Cloud sync repository's visibility: { owner, repo, private, at }
     IndexedDB crane.terrain.v1, store "grid"   C8: the fetched USGS 3DEP terrain grids of this browser (one record per fetch id:
                             { id, at, svc, x0, y0, dx, nx, ny, z (ft, NaN no data), res, zone }); a project keeps the settings and what was used
     IndexedDB crane.sheets.v1, store "img"   the plan-sheet images (one record per sheet id: { id, blob, type, name, w, h, at });
                             a project keeps the sheet's placement and calibration only, so the list stays small (ui/sheetstore.js)
   File (Export JSON, GitHub sync): { format: 'crane-pick.project', version: 1, project } (+ images: { <sheet id>: data URL } when the
   user chose to include them in an exported file; never in the GitHub copy).

   Project v1 (positions: the site frame of engine/geo.js, grid US survey ft of the project's zone):
     { schema: 'crane-pick.project', v: 1,
       title: { name, number, location, client, by, checker, date, rev }, notes,
       site: { zone },                                     the State Plane zone (geo.js ZONES id)
       view: { lat, lng, z }                               the map view (kept with the project; not an "unsaved change", not an undo step)
       sheets: [ sheet ], items: [ item ], cranes: [ crane ], setups: [ setup ], picks: [ pick ], lift: { caution, critical, limit, interp },
       savedAt? }
     sheet = { id, name, kind: 'image' | 'pdf', page, w, h (px), place: { x, y, s, rot }, opacity (0–1), locked, visible,
               cal: { p1: { px, py }, p2, dist (ft) } | null, geo: { p1, p2, g1: { E, N }, g2 (zone units) } | null,
               pageIn: { w, h } (PDF page size, in) | null, planScale (the plan's stated scale, ft per in) | null, basis (BASIS key),
               align?: { p1: { px, py }, p2, m1: { x, y }, m2 (grid ft), keep: 'pts' | 'ref' } (align to the map, 2026-11-17; optional:
               absent in older projects; keep 'ref' = the scale kept from the calibration / plan scale, rotation and position from the points) }
     item  = { id, type, name, pts: [{ x, y }], ... }   type: 'obst' (polygon: height ft, topEl, gradeEl (C3-2)), 'power' (polyline: kv,
             le350, setFt, height (lowest wire above grade), gradeEl, sag, sway (C3-2: ft)),
             'util' (polyline or polygon (closed): kind, depth ft, topEl ft, size ft), 'excl' (polygon: reason), 'label' (one point:
             text, size), 'dim' (two points: a dimension)
     crane = { id, def (the crane file, schema crane-pick.crane.v1, with its app_inputs: engine/cranes.js), src: { from: 'github' |
               'file' | 'paste' | 'library', name, repo, path, at }, fp (fingerprint of the chart data when it was added) }   C2-1:
             a copy of each crane the project uses, so a saved or exported project is self-contained (it carries the chart data)
     setup = { id, name, craneId, x, y (centre of rotation), heading (deg, carrier front, clockwise from grid north), group (the chart
               group key: engine/cranes.js groups), boom (ft), mode (telescoping mode | null), pad (crane pad elevation, ft | null:
               C3-1) }                                                                                                   C2-2
     pick  = { id, name, setupId, pick: { x, y }, set: { x, y }, load, rigging, hook, ded (lb), hookLabel, dedNote, swing: 'short' |
               'cw' | 'ccw', elev: { pg, ph, sg, sh, rig, blk, trav, L, W, H } (C3-1: heights, ft; normElev) }         C2-2
     crane.def.app_inputs.geom = { footH, head, boomW, cwBot, cwTop } (ft, C3-1: the crane's elevation geometry entered in this tool;
               engine/elev.js geomOf; the boom-foot offset and the tail radius stay in app_inputs.plan)
     setup.spread (2026-11-17): the outrigger spread key the crane is DRAWN at ('' = the chart group's spread); drawing only where the
       chart group has no chart at it (flagged).
     setup.ground (C4) = { mat: { type, B, L, t, Fb, Fv, E, Fy, gamma, k }, qa (psf), qaUnit } (normSetupGround); ground (C4, project) = { caps: { <util id>: psf } }
     lift  = { caution: 75, critical: 75, limit: 100 (% of chart), interp: false, path: 'uniform' | 'luff', obstClr: 2 (ft),
               tandem: 75 (% of chart per crane in a tandem lift, C5) }
             (project settings; engine/lift.js; path and obstClr C3-2)                                                  C2-2
     tandems: [ tandem ]  C5: girder lifts (one crane or two in tandem), engine/tandem.js (the fields there; normTandem). A project
             saved before C5 has none: normalize gives [].
     routes = [ route ], routeMarks = [ mark ]   C6: trucking routes and their marks (engine/route.js has the fields; normRoute,
             normRouteMark). A project saved before C6 has none: normalize gives [].
     terrain (C8) = { use (ground elevations from the terrain), spacing (ft), ext ('view' | 'site'), contour (ft), src: null | { id (the
             grid's key in this browser's IndexedDB crane.terrain.v1), at (fetch date, ISO), svc, x0, y0, dx, nx, ny, n, nodata, res (m),
             zmin, zmax, zone } }: the settings and what was used — the elevations themselves stay in the browser's cache (normTerrain);
             setup.lvl (C8) = { tol (%), maxBlk (ft), datum (ft), padB, padW, padEl (ft) }; route.grade (C8) = { max (%), base, hu, clr (ft) }
             (null = not entered: the engine/terrain.js defaults). A project saved before C8 has none: normalize gives the defaults. */
(function () {
  'use strict';
  const KEYS = { current: 'crane.project.current', list: 'crane.projects.v1', open: 'crane.open', ui: 'crane.ui', idb: 'crane.sheets.v1',
    library: 'crane.library.v1', libsrc: 'crane.libsrc', syncCheck: 'crane.syncCheck', terrainDb: 'crane.terrain.v1' };
  const FORMAT = 'crane-pick.project';
  const TYPES = {
    obst: { label: 'Obstruction', geom: 'polygon', min: 3 },
    power: { label: 'Power line', geom: 'polyline', min: 2 },
    util: { label: 'Buried utility / culvert / wall', geom: 'either', min: 2 },
    excl: { label: 'Exclusion zone', geom: 'polygon', min: 3 },
    label: { label: 'Text label', geom: 'point', min: 1 },
    dim: { label: 'Dimension', geom: 'polyline', min: 2, max: 2 }
  };
  /* how a sheet's scale was set: none (placed only), plan (the plan's stated scale on the PDF page size), cal (two points and a known
     distance), geo (two points with State Plane coordinates: scale, rotation and position) */
  const BASIS = { none: 'not set', plan: 'stated plan scale (PDF page size)', cal: 'calibrated (two points, known distance)', geo: 'georeferenced (two State Plane points)', align: 'aligned to the map (two points: sheet → map)' };
  const UTIL_KINDS = { utility: 'Buried utility', culvert: 'Culvert', wall: 'Wall', other: 'Other' };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function newProject(o) {
    o = o || {};
    return { schema: FORMAT, v: 1,
      title: { name: 'New crane pick', number: '', location: '', client: '', by: '', checker: '', date: today(), rev: '' },
      notes: '', site: { zone: o.zone || 'EPSG:2249' }, view: o.view || null, sheets: [], items: [], cranes: [], setups: [], picks: [], ground: { caps: {} }, tandems: [], routes: [], routeMarks: [], terrain: normTerrain(null),
      lift: { caution: 75, critical: 75, limit: 100, interp: false, path: 'uniform', obstClr: 2, tandem: 75 } };
  }
  const num = (v, d) => typeof v === 'number' && isFinite(v) ? v : d;
  const numOrNull = v => typeof v === 'number' && isFinite(v) ? v : null;
  const str = (v, d) => v == null ? (d == null ? '' : d) : String(v);
  const pt = p => p && isFinite(p.x) && isFinite(p.y) ? { x: +p.x, y: +p.y } : null;
  const pxp = p => p && isFinite(p.px) && isFinite(p.py) ? { px: +p.px, py: +p.py } : null;
  let seq = 0;
  const uid = pre => pre + Date.now().toString(36) + (seq++).toString(36) + Math.random().toString(36).slice(2, 6);
  function normItem(it) {
    if (!it || !TYPES[it.type]) return null;
    const T = TYPES[it.type], pts = (Array.isArray(it.pts) ? it.pts : []).map(pt).filter(Boolean);
    if (pts.length < T.min) return null;
    const o = { id: str(it.id) || uid('i'), type: it.type, name: str(it.name), pts: T.max ? pts.slice(0, T.max) : pts };
    if (it.type === 'obst') { o.height = numOrNull(it.height); o.topEl = numOrNull(it.topEl); o.gradeEl = numOrNull(it.gradeEl); }
    if (it.type === 'power') { o.kv = numOrNull(it.kv); o.le350 = !!it.le350; o.setFt = numOrNull(it.setFt); o.height = numOrNull(it.height); o.gradeEl = numOrNull(it.gradeEl);
      const nn = v => { const x = numOrNull(v); return x != null && x >= 0 ? x : null; }; o.sag = nn(it.sag); o.sway = nn(it.sway); }   // C3-2: ground elevation, sag / sway allowances (ft)
    if (it.type === 'util') { o.kind = UTIL_KINDS[it.kind] ? it.kind : 'utility'; o.closed = !!it.closed && pts.length >= 3; o.depth = numOrNull(it.depth); o.topEl = numOrNull(it.topEl); o.size = numOrNull(it.size); }
    if (it.type === 'excl') o.reason = str(it.reason);
    if (it.type === 'label') { o.text = str(it.text, 'Label'); o.size = Math.max(8, Math.min(48, num(it.size, 14))); }
    return o;
  }
  function normSheet(s) {
    if (!s || typeof s !== 'object') return null;
    const pl = s.place || {};
    if (!(num(pl.s, 0) > 0) || !(num(s.w, 0) > 0) || !(num(s.h, 0) > 0)) return null;
    const cal = s.cal && pxp(s.cal.p1) && pxp(s.cal.p2) && num(s.cal.dist, 0) > 0 ? { p1: pxp(s.cal.p1), p2: pxp(s.cal.p2), dist: +s.cal.dist } : null;
    const g = s.geo, gp = q => q && isFinite(q.E) && isFinite(q.N) ? { E: +q.E, N: +q.N } : null;
    const geo = g && pxp(g.p1) && pxp(g.p2) && gp(g.g1) && gp(g.g2) ? { p1: pxp(g.p1), p2: pxp(g.p2), g1: gp(g.g1), g2: gp(g.g2) } : null;
    const al = s.align, mp = q => q && isFinite(q.x) && isFinite(q.y) ? { x: +q.x, y: +q.y } : null;
    const align = al && pxp(al.p1) && pxp(al.p2) && mp(al.m1) && mp(al.m2) ? { p1: pxp(al.p1), p2: pxp(al.p2), m1: mp(al.m1), m2: mp(al.m2), keep: al.keep === 'ref' ? 'ref' : 'pts' } : null;
    return { id: str(s.id) || uid('s'), name: str(s.name, 'Plan sheet'), kind: s.kind === 'pdf' ? 'pdf' : 'image', page: Math.max(1, Math.round(num(s.page, 1))),
      w: +s.w, h: +s.h, place: { x: num(pl.x, 0), y: num(pl.y, 0), s: +pl.s, rot: num(pl.rot, 0) },
      opacity: Math.max(0.05, Math.min(1, num(s.opacity, 0.8))), locked: !!s.locked, visible: s.visible !== false, cal, geo,
      pageIn: s.pageIn && num(s.pageIn.w, 0) > 0 && num(s.pageIn.h, 0) > 0 ? { w: +s.pageIn.w, h: +s.pageIn.h } : null,
      planScale: num(s.planScale, 0) > 0 ? +s.planScale : null, basis: BASIS[s.basis] ? s.basis : 'none', ...(align ? { align } : {}) };
  }
  /* a project crane: kept as loaded (a crane file that no longer passes the check is kept too, so nothing is lost; the UI says so) */
  function normCrane(c) {
    if (!c || typeof c !== 'object' || !c.def || typeof c.def !== 'object') return null;
    const s = c.src && typeof c.src === 'object' ? c.src : {};
    const def = JSON.parse(JSON.stringify(c.def)); if (!def.app_inputs || typeof def.app_inputs !== 'object') def.app_inputs = {};
    return { id: str(c.id) || uid('c'), def, src: { from: str(s.from, 'file'), name: str(s.name), repo: str(s.repo), path: str(s.path), at: str(s.at) }, fp: str(c.fp) };
  }
  const numPos = (v, d) => typeof v === 'number' && isFinite(v) && v > 0 ? v : d;
  function normSetup(u) {
    if (!u || typeof u !== 'object' || !isFinite(u.x) || !isFinite(u.y)) return null;
    return { id: str(u.id) || uid('u'), name: str(u.name, 'Crane setup'), craneId: str(u.craneId), x: +u.x, y: +u.y, heading: ((num(u.heading, 0) % 360) + 360) % 360,
      group: str(u.group), boom: numOrNull(u.boom), mode: u.mode == null || u.mode === '' ? null : str(u.mode), pad: numOrNull(u.pad), ground: normSetupGround(u.ground), lvl: normLvl(u.lvl), spread: str(u.spread) };
  }
  /* C4: the setup's ground inputs: mat { type: 'none' | 'timber' | 'steel', B, L (ft), t (in), Fb, Fv, E (psi), Fy (ksi), gamma (pcf),
     k (spread, horizontal : 1 vertical); 2026-11-17, drawing only: crawlers w (each mat's width along the track, ft), n (mats per track) }, qa (allowable bearing pressure, psf), qaUnit ('psf' | 'ksf': how it is shown) */
  function normSetupGround(g) {
    g = g && typeof g === 'object' ? g : {}; const m = g.mat && typeof g.mat === 'object' ? g.mat : {}, mat = { type: ['timber', 'steel'].indexOf(m.type) >= 0 ? m.type : 'none' };
    ['B', 'L', 't', 'Fb', 'Fv', 'E', 'Fy', 'gamma', 'k', 'w', 'n'].forEach(k => { const v = numOrNull(m[k]); mat[k] = v != null && v >= 0 ? v : null; });
    const qa = numOrNull(g.qa); return { mat, qa: qa != null && qa > 0 ? qa : null, qaUnit: g.qaUnit === 'ksf' ? 'ksf' : 'psf' };
  }
  /* C8: terrain inputs (null = not entered). setup.lvl: level tolerance tol (%), blocking limit maxBlk (ft), levelling datum (ft; null: the
     highest support), the grading pad padB (along the carrier) × padW (ft) at padEl (ft; null: the mean ground). route.grade: max (%),
     base (grade base length, ft), hu (load / deck underside above the ground at its supports, ft), clr (ground clearance margin, ft). */
  const nnK = (o, keys, signed) => { o = o && typeof o === 'object' ? o : {}; const r = {}; keys.forEach(k => { const v = numOrNull(o[k]); r[k] = v != null && (signed.indexOf(k) >= 0 || v >= 0) ? v : null; }); return r; };
  const normLvl = l => nnK(l, ['tol', 'maxBlk', 'datum', 'padB', 'padW', 'padEl'], ['datum', 'padEl']);
  const normGrade = g => nnK(g, ['max', 'base', 'hu', 'clr'], []);
  function normTerrain(t) {
    t = t && typeof t === 'object' ? t : {}; const s = t.src && typeof t.src === 'object' ? t.src : null;
    const src = s && str(s.id) && isFinite(s.x0) && isFinite(s.y0) && num(s.dx, 0) > 0 ? { id: str(s.id), at: str(s.at), svc: str(s.svc), x0: +s.x0, y0: +s.y0, dx: +s.dx, nx: Math.round(num(s.nx, 0)), ny: Math.round(num(s.ny, 0)),
      n: Math.round(num(s.n, 0)), nodata: Math.round(num(s.nodata, 0)), res: numOrNull(s.res), zmin: numOrNull(s.zmin), zmax: numOrNull(s.zmax), zone: str(s.zone), asked: numOrNull(s.asked) } : null;
    return { use: !!t.use, spacing: numPos(t.spacing, 5), ext: t.ext === 'site' ? 'site' : 'view', contour: numPos(t.contour, 1), src };
  }
  /* C4: project ground inputs: caps { <util item id>: allowable vertical stress increase at the item, psf } */
  function normGround(g) { g = g && typeof g === 'object' ? g : {}; const caps = {}; Object.keys(g.caps || {}).forEach(k => { const v = numOrNull(g.caps[k]); if (v != null && v > 0) caps[k] = v; }); return { caps }; }
  function normPick(k) {
    if (!k || typeof k !== 'object' || !pt(k.pick) || !pt(k.set)) return null;
    const w = v => { const x = numOrNull(v); return x != null && x >= 0 ? x : null; };
    return { id: str(k.id) || uid('k'), name: str(k.name, 'Pick'), setupId: str(k.setupId), pick: pt(k.pick), set: pt(k.set), load: w(k.load), rigging: w(k.rigging), hook: w(k.hook), ded: w(k.ded),
      hookLabel: str(k.hookLabel), dedNote: str(k.dedNote), swing: ['short', 'cw', 'ccw'].indexOf(k.swing) >= 0 ? k.swing : 'short', elev: normElev(k.elev) };
  }
  /* C3-1: the pick's heights (ft): pg / sg ground elevation at the pick / set point, ph / sh load bottom above that ground, rig rigging
     height (hook to load top), blk hook block height (hook to block top), trav load-bottom elevation during the swing, L / W / H the
     load's length, width, height. null = not entered (engine/elev.js defaults). Elevations may be negative; the rest must be ≥ 0. */
  function normElev(e) {
    e = e && typeof e === 'object' ? e : {}; const o = {};
    ['pg', 'sg', 'trav'].forEach(k => { o[k] = numOrNull(e[k]); });
    ['ph', 'sh', 'rig', 'blk', 'L', 'W', 'H'].forEach(k => { const v = numOrNull(e[k]); o[k] = v != null && v >= 0 ? v : null; });
    return o;
  }
  /* C3-2: path ('uniform': the radius changes uniformly with the swing angle (C2) | 'luff': luff at the pick, then swing at the set
     radius), obstClr (ft: an obstruction closer than this is flagged amber; contact is red) */
  function normLift(l) { l = l || {}; return { caution: numPos(l.caution, 75), critical: numPos(l.critical, 75), limit: numPos(l.limit, 100), interp: !!l.interp,
    path: l.path === 'luff' ? 'luff' : 'uniform', obstClr: typeof l.obstClr === 'number' && isFinite(l.obstClr) && l.obstClr >= 0 ? l.obstClr : 2, tandem: numPos(l.tandem, 75) }; }   // tandem: C5
  /* C6: a trucking route (engine/route.js). Lengths ft, weights lb, tyre area in²; null = not entered (engine defaults). */
  const VEH_KEYS = ['L1', 'e', 'fo', 'ro', 'Wt', 'L2', 'Wb', 'dF', 'dR', 'Lj', 'ej', 'Ld', 'k', 'dmax', 'Rmin', 'hDeck', 'Wtr', 'xt', 'Wtl', 'xtl', 'Wj', 'Wd', 'nS', 'nD', 'nJ', 'nR', 'tS', 'tD', 'tJ', 'tR'];
  const VEH_SIGNED = ['e', 'ej', 'xt', 'xtl'];
  const ROUTE_VEH = ['semi', 'stretch', 'dolly', 'jeep'];
  function normRoute(r) {
    if (!r || typeof r !== 'object') return null;
    const pts = (Array.isArray(r.pts) ? r.pts : []).map(pt).filter(Boolean); if (pts.length < 2) return null;
    const nn = v => { const x = numOrNull(v); return x != null && x >= 0 ? x : null; }, v0 = r.veh && typeof r.veh === 'object' ? r.veh : {}, l0 = r.load && typeof r.load === 'object' ? r.load : {}, a0 = r.axIn && typeof r.axIn === 'object' ? r.axIn : {};
    const veh = { type: ROUTE_VEH.indexOf(v0.type) >= 0 ? v0.type : 'semi' }; VEH_KEYS.forEach(k => { veh[k] = VEH_SIGNED.indexOf(k) >= 0 ? numOrNull(v0[k]) : nn(v0[k]); });
    const load = {}; ['L', 'W', 'B', 'r', 'cg', 'h'].forEach(k => { load[k] = k === 'r' ? numOrNull(l0[k]) : nn(l0[k]); });
    const rad = pts.map((_, i) => { const x = Array.isArray(r.rad) ? nn(r.rad[i]) : null; return x != null && x > 0 ? x : null; });
    return { id: str(r.id) || uid('r'), name: str(r.name, 'Route'), pts, rad, rDef: numPos(r.rDef, 50), veh, load, tyre: { A: nn(r.tyre && r.tyre.A) },
      axIn: { on: !!a0.on, S: nn(a0.S), D: nn(a0.D), J: nn(a0.J), R: nn(a0.R) }, pickId: str(r.pickId), tandemId: str(r.tandemId), endA: r.endA === 'rear' ? 'rear' : 'front', stageTol: nn(r.stageTol), margin: nn(r.margin), at: nn(r.at), grade: normGrade(r.grade) ,
      ...normRouteFit(r) };   // 2026-11-17: the fitted alignment, its source and the lane offset (only when present: older routes are unchanged)
  }
  /* 2026-11-17: route.mode 'fit' + route.al (the fitted alignment), route.src (where the line came from: clicks, a trace, OpenStreetMap),
     route.lane (the travel-lane offset). A route without them is a legacy route ("each vertex is a turn"): nothing is added. */
  function normRouteFit(r) {
    const o = {}, nn = v => { const x = numOrNull(v); return x != null && x >= 0 ? x : null; };
    const a = r.al && typeof r.al === 'object' ? r.al : null, pis = a && Array.isArray(a.pis) ? a.pis.map(pt).filter(Boolean) : [];
    if (r.mode === 'fit' && pis.length >= 2 && pis.length === a.pis.length) {
      const fit = (Array.isArray(a.fit) ? a.fit : []), num1 = v => numOrNull(v);
      o.mode = 'fit';
      o.al = { pis, rad: pis.map((_, i) => { const x = Array.isArray(a.rad) ? nn(a.rad[i]) : null; return x != null && x > 0 && i > 0 && i < pis.length - 1 ? x : null; }),
        kind: pis.map((_, i) => i === 0 || i === pis.length - 1 ? 'end' : Array.isArray(a.kind) && a.kind[i] === 'turn' ? 'turn' : 'curve'),
        fit: pis.map((_, i) => { const f = fit[i]; return f && typeof f === 'object' ? { Rls: num1(f.Rls), rms: num1(f.rms), n: num1(f.n), Lc: num1(f.Lc), R0: num1(f.R0), atMax: !!f.atMax, corner: !!f.corner } : null; }),
        opt: {}, edited: !!a.edited };
      const op = a.opt && typeof a.opt === 'object' ? a.opt : {}; ['tol', 'win', 'Rmax', 'minDelta', 'cornerL'].forEach(k => { const x = nn(op[k]); if (x != null && x > 0) o.al.opt[k] = x; });
    } else if (r.mode === 'legacy') o.mode = 'legacy';
    const sr = r.src && typeof r.src === 'object' ? r.src : null;
    if (sr && ['click', 'trace', 'osm'].indexOf(sr.kind) >= 0) {
      const seg = l => (Array.isArray(l) ? l : []).filter(x => x && typeof x === 'object').map(x => ({ name: str(x.name, 'road'), s0: numOrNull(x.s0) || 0, s1: numOrNull(x.s1) || 0 }));
      o.src = { kind: sr.kind, at: str(sr.at), names: seg(sr.names), against: seg(sr.against), cl: Array.isArray(sr.cl) ? sr.cl.map(pt).filter(Boolean) : [],
        snaps: (Array.isArray(sr.snaps) ? sr.snaps : []).map(x => ({ d: numOrNull(x && x.d), name: str(x && x.name) })) };
    }
    if (r.lane && typeof r.lane === 'object') o.lane = { on: !!r.lane.on, w: nn(r.lane.w) };
    return o;
  }
  const MARK_TYPES = { overhead: 'Overhead clearance', haul: 'Haul road / mats', bridge: 'Posted bridge' };
  function normRouteMark(m) {
    if (!m || typeof m !== 'object' || !MARK_TYPES[m.type]) return null;
    const pts = (Array.isArray(m.pts) ? m.pts : []).map(pt).filter(Boolean); if (pts.length < (m.type === 'overhead' ? 1 : 2)) return null;
    const nn = v => { const x = numOrNull(v); return x != null && x >= 0 ? x : null; }, o = { id: str(m.id) || uid('m'), type: m.type, name: str(m.name, MARK_TYPES[m.type]), pts, w: nn(m.w) };
    if (m.type === 'overhead') o.h = nn(m.h);
    if (m.type === 'haul') { o.qa = nn(m.qa); const g = normSetupGround({ mat: m.mat }); o.mat = g.mat; }
    if (m.type === 'bridge') { const p = m.post && typeof m.post === 'object' ? m.post : {}; o.post = { gross: nn(p.gross), axle: nn(p.axle), tLabel: str(p.tLabel), tTons: nn(p.tTons) }; }
    return o;
  }
  /* C5: a girder lift (engine/tandem.js). Weights ≥ 0 (lb), lengths ft; null = not entered (engine defaults). */
  function normTandem(t) {
    if (!t || typeof t !== 'object') return null;
    const nn = v => { const x = numOrNull(v); return x != null && x >= 0 ? x : null; }, g = t.girder && typeof t.girder === 'object' ? t.girder : {}, pr = g.pair && typeof g.pair === 'object' ? g.pair : {};
    const pose = (p, d) => { p = p && typeof p === 'object' ? p : {}; return { x: num(p.x, d.x), y: num(p.y, d.y), h: ((num(p.h, d.h) % 360) + 360) % 360, z: numOrNull(p.z) }; };
    const L = numPos(g.L, 100), hk = Array.isArray(t.hooks) ? t.hooks : [];
    const hook = (h, s) => { h = h && typeof h === 'object' ? h : {}; return { s: num(h.s, s), sp: nn(h.sp), rig: nn(h.rig), hook: nn(h.hook), ded: nn(h.ded), hookLabel: str(h.hookLabel), rigH: nn(h.rigH), blk: nn(h.blk) }; };
    const pick = pose(t.pick, { x: 0, y: 0, h: 90 });
    return { id: str(t.id) || uid('t'), name: str(t.name, 'Girder lift'), type: t.type === 'single' ? 'single' : 'tandem',
      slots: [0, 1].map(i => str(Array.isArray(t.slots) ? t.slots[i] : '')),
      girder: { L, W: nn(g.W), cg: numOrNull(g.cg), cgT: numOrNull(g.cgT), cgV: nn(g.cgV), H: nn(g.H), B: nn(g.B),
        pair: { on: !!pr.on, s: nn(pr.s), W2: nn(pr.W2), cg2: numOrNull(pr.cg2), xf: nn(pr.xf), xfCg: numOrNull(pr.xfCg) } },
      hooks: [hook(hk[0], L * 0.1), hook(hk[1], L * 0.9)], pick, set: pose(t.set, pick),
      way: (Array.isArray(t.way) ? t.way : []).filter(p => p && isFinite(p.x) && isFinite(p.y)).map(p => ({ x: +p.x, y: +p.y, h: ((num(p.h, 0) % 360) + 360) % 360 })),
      trav: numOrNull(t.trav) };
  }
  /* normalize(p): a project as this version keeps it (unknown fields dropped, defaults filled; never throws) */
  function normalize(p) {
    const d = newProject(); if (!p || typeof p !== 'object') return d;
    const t = p.title || {};
    const o = { schema: FORMAT, v: 1, title: {}, notes: str(p.notes), site: { zone: (p.site && typeof p.site.zone === 'string') ? p.site.zone : d.site.zone },
      view: p.view && isFinite(p.view.lat) && isFinite(p.view.lng) ? { lat: +p.view.lat, lng: +p.view.lng, z: num(p.view.z, 17) } : null,
      sheets: (Array.isArray(p.sheets) ? p.sheets : []).map(normSheet).filter(Boolean),
      items: (Array.isArray(p.items) ? p.items : []).map(normItem).filter(Boolean),
      cranes: (Array.isArray(p.cranes) ? p.cranes : []).map(normCrane).filter(Boolean),
      setups: (Array.isArray(p.setups) ? p.setups : []).map(normSetup).filter(Boolean),
      picks: (Array.isArray(p.picks) ? p.picks : []).map(normPick).filter(Boolean), lift: normLift(p.lift), ground: normGround(p.ground),
      tandems: (Array.isArray(p.tandems) ? p.tandems : []).map(normTandem).filter(Boolean),   // C5
      routes: (Array.isArray(p.routes) ? p.routes : []).map(normRoute).filter(Boolean), routeMarks: (Array.isArray(p.routeMarks) ? p.routeMarks : []).map(normRouteMark).filter(Boolean), terrain: normTerrain(p.terrain) };   // C6; C8 terrain
    Object.keys(d.title).forEach(k => { o.title[k] = str(t[k], k === 'date' ? '' : ''); });
    if (p.savedAt) o.savedAt = str(p.savedAt);
    return o;
  }
  /* load(storage) -> { project, source: 'autosave' | 'new' } (an unreadable autosave is left in storage and a new project is opened) */
  function load(storage) {
    let raw = null; try { raw = storage.getItem(KEYS.current); } catch (e) { raw = null; }
    if (raw) { try { const j = JSON.parse(raw); if (j && j.schema === FORMAT) return { project: normalize(j), source: 'autosave' }; } catch (e) { /* below */ }
      return { project: newProject(), source: 'new', unreadable: true, noAutosave: true }; }
    return { project: newProject(), source: 'new' };
  }
  function save(storage, P) { try { storage.setItem(KEYS.current, JSON.stringify(P)); return true; } catch (e) { return false; } }
  /* the file */
  function toFile(P, images) { const f = { format: FORMAT, version: 1, project: P }; if (images && Object.keys(images).length) f.images = images; return f; }
  function fromFile(obj) {
    if (!obj || typeof obj !== 'object') throw new Error('not a Crane Pick Analyzer file');
    if (obj.format === FORMAT && obj.project) return { project: normalize(obj.project), images: obj.images && typeof obj.images === 'object' ? obj.images : {} };
    if (obj.schema === FORMAT) return { project: normalize(obj), images: {} };
    throw new Error('not a Crane Pick Analyzer file (format "' + (obj.format || obj.schema || '?') + '")');
  }
  /* text of the inputs (undo / "unsaved changes"): the project without the view and the saved time */
  function inputsText(P) { const o = Object.assign({}, P); delete o.view; delete o.savedAt; return JSON.stringify(o); }
  window.CranePickModel = { KEYS, FORMAT, TYPES, UTIL_KINDS, BASIS, newProject, normalize, normItem, normSheet, normCrane, normSetup, normPick, normElev, normLift, normSetupGround, normGround, normTandem, normRoute, normRouteMark, normTerrain, normLvl, normGrade, MARK_TYPES, ROUTE_VEH, load, save, toFile, fromFile, inputsText, uid };
})();
