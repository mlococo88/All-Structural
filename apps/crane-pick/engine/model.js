/* apps/crane-pick/engine/model.js — the Crane Pick Analyzer project (window.CranePickModel). Classic script, no DOM. C1 (2026-11-16).

   Saved data (CLAUDE.md §5; every key starts with "crane."):
     crane.project.current   the open project (autosave, JSON of the project below; written on every change)
     crane.projects.v1       the saved-project list (shared/projects.js mapStore: { "<name>": project with savedAt })
     crane.open              the name of the saved project the open project belongs to ('' when none)
     crane.ui                the page's view choices (tabs, base map), per browser; never part of a project
     crane.library.v1        C2-1: the crane library of this browser (ui/cranes.js): { v: 1, cranes: { <key>: { def, src, at, fp } } }
     crane.libsrc            C2-1: where "Load crane library from GitHub" reads: { owner, repo, branch, folder }
     crane.syncCheck         C2-1: the last check of the Cloud sync repository's visibility: { owner, repo, private, at }
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
               pageIn: { w, h } (PDF page size, in) | null, planScale (the plan's stated scale, ft per in) | null, basis (BASIS key) }
     item  = { id, type, name, pts: [{ x, y }], ... }   type: 'obst' (polygon: height ft), 'power' (polyline: kv, le350, setFt, height),
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
     lift  = { caution: 75, critical: 75, limit: 100 (% of chart), interp: false } (project settings; engine/lift.js)    C2-2 */
(function () {
  'use strict';
  const KEYS = { current: 'crane.project.current', list: 'crane.projects.v1', open: 'crane.open', ui: 'crane.ui', idb: 'crane.sheets.v1',
    library: 'crane.library.v1', libsrc: 'crane.libsrc', syncCheck: 'crane.syncCheck' };
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
  const BASIS = { none: 'not set', plan: 'stated plan scale (PDF page size)', cal: 'calibrated (two points, known distance)', geo: 'georeferenced (two State Plane points)' };
  const UTIL_KINDS = { utility: 'Buried utility', culvert: 'Culvert', wall: 'Wall', other: 'Other' };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  function newProject(o) {
    o = o || {};
    return { schema: FORMAT, v: 1,
      title: { name: 'New crane pick', number: '', location: '', client: '', by: '', checker: '', date: today(), rev: '' },
      notes: '', site: { zone: o.zone || 'EPSG:2249' }, view: o.view || null, sheets: [], items: [], cranes: [], setups: [], picks: [],
      lift: { caution: 75, critical: 75, limit: 100, interp: false } };
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
    if (it.type === 'obst') { o.height = numOrNull(it.height); o.topEl = numOrNull(it.topEl); }
    if (it.type === 'power') { o.kv = numOrNull(it.kv); o.le350 = !!it.le350; o.setFt = numOrNull(it.setFt); o.height = numOrNull(it.height); }
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
    return { id: str(s.id) || uid('s'), name: str(s.name, 'Plan sheet'), kind: s.kind === 'pdf' ? 'pdf' : 'image', page: Math.max(1, Math.round(num(s.page, 1))),
      w: +s.w, h: +s.h, place: { x: num(pl.x, 0), y: num(pl.y, 0), s: +pl.s, rot: num(pl.rot, 0) },
      opacity: Math.max(0.05, Math.min(1, num(s.opacity, 0.8))), locked: !!s.locked, visible: s.visible !== false, cal, geo,
      pageIn: s.pageIn && num(s.pageIn.w, 0) > 0 && num(s.pageIn.h, 0) > 0 ? { w: +s.pageIn.w, h: +s.pageIn.h } : null,
      planScale: num(s.planScale, 0) > 0 ? +s.planScale : null, basis: BASIS[s.basis] ? s.basis : 'none' };
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
      group: str(u.group), boom: numOrNull(u.boom), mode: u.mode == null || u.mode === '' ? null : str(u.mode), pad: numOrNull(u.pad) };
  }
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
  function normLift(l) { l = l || {}; return { caution: numPos(l.caution, 75), critical: numPos(l.critical, 75), limit: numPos(l.limit, 100), interp: !!l.interp }; }
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
      picks: (Array.isArray(p.picks) ? p.picks : []).map(normPick).filter(Boolean), lift: normLift(p.lift) };
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
  window.CranePickModel = { KEYS, FORMAT, TYPES, UTIL_KINDS, BASIS, newProject, normalize, normItem, normSheet, normCrane, normSetup, normPick, normElev, normLift, load, save, toFile, fromFile, inputsText, uid };
})();
