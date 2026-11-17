/* apps/crane-pick/ui/drawset.js — the lift-plan drawing set and the multi-lift summary of the Crane Pick Analyzer (window.CranePickDrawSet).
   C7 (2026-11-16). Classic script, no DOM (Node-tested: tests/engine/crane-dwg.test.mjs). Display and export only: every number on a sheet
   and in the summary is a value the engines already computed (engine/lift.js, elev.js, clear3d.js, ground.js, tandem.js through the
   page's evalPick / evalT), formatted; nothing is calculated here except the drawing geometry (positions, the view window, clipping).

   summary(P, ctx) -> [{ kind: 'pick' | 'tandem' | 'route', id, name, key, cranes: [{ setup, crane, W, C, pct, cls, clsText, where }], reach, clr,
     ground, flags: { stop, warn, list }, missing }]: one row per lift (single pick or girder lift): the governing % of chart per crane, the
     closest 3D clearance (the smallest margin over its requirement, as the Picks tab's "Closest 3D"), the largest float / track load and
     bearing ratio, the flags. The Summary tab, the cover sheet and Report §1 show it.
   notesModel(P, ctx) -> [{ topic, text, key }]: the general notes (sheet 2) and Report §2 Basis (one source).
   build(P, ctx, opt) -> { D, sheets: [{ n, id, title, k, W, H, ox, i0, iC, i1, over, src }], miss, errors } (shared/dxf.js display list)
     ctx = { evalPick(k) (CranePickPlace.evalPick), evalT(t) (CranePickTandemUI.evalT), evalRoute(r) (CranePickRouteUI.evalRoute, C6), sections (CranePickElevView.sections, optional: the
     site items an elevation crosses), ref(key) -> '§x.y' | null (Report numbering, optional), date }
     opt = { paper: 'D' | 'B', half (the half-size print of paper D) }.
   Sheets: cover (sheet index, lift summary, revisions), general notes, a lift plan per single pick (plan to scale, elevation at the pick
   and at the set, data table, flags), a lift plan per girder lift (plan, elevation at each crane's governing step, data table) followed by
   its rigging / load-share sheet, the ground sheet (float / track loads, mats, bearing, stress at depth, float and mat outlines in plan),
   a sheet per trucking route (C6: route, swept path, overhead clearances, axle loads, posted bridges, staging), and the sheets other
   modules add (addSheets(fn)).
   Units: full size in inches (plan: x = 12 (E − E0), y = 12 (N − N0), grid north up; elevations: x = 12 s along the section, y = 12 z).
   The sheet frame (SCALES / SCALE_NAME / TXT, sheet(), the block sheets table() / notesBlk() / headBlk() / blockPages() / pageFn()) is an
   adapted COPY of apps/ps-bridge/ui/sheets.js (itself a copy of apps/steel-bridge/engine/sheets.js and drawings.js), to move to shared/
   later (CLAUDE.md §3); keep a fix to one in step with the others. */
(function () {
  'use strict';
  const X_ = () => window.SharedDxf, G = () => window.CranePickGeo, K = () => window.CranePickCranes, LF = () => window.CranePickLift;
  const EL = () => window.CranePickElev, T = () => window.CranePickTandem, O = () => window.CranePickOSHA, C3 = () => window.CranePickClear, GR = () => window.CranePickGround;
  const PAPER = { D: [34, 22], B: [17, 11] };
  const SCALES = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 120, 240, 360, 480, 600, 720, 960, 1200, 2400, 4800];
  const SCALE_NAME = { 1: 'FULL SIZE', 2: '6" = 1\'-0"', 3: '4" = 1\'-0"', 4: '3" = 1\'-0"', 6: '2" = 1\'-0"', 8: '1 1/2" = 1\'-0"', 12: '1" = 1\'-0"', 16: '3/4" = 1\'-0"', 24: '1/2" = 1\'-0"',
    32: '3/8" = 1\'-0"', 48: '1/4" = 1\'-0"', 64: '3/16" = 1\'-0"', 96: '1/8" = 1\'-0"', 120: '1" = 10\'-0"', 240: '1" = 20\'-0"', 360: '1" = 30\'-0"', 480: '1" = 40\'-0"', 600: '1" = 50\'-0"',
    720: '1" = 60\'-0"', 960: '1" = 80\'-0"', 1200: '1" = 100\'-0"', 2400: '1" = 200\'-0"', 4800: '1" = 400\'-0"' };
  const TXT = 0.10;   // plotted text height, in
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '-';
  const kip = v => isNum(v) ? fmt(v / 1000, 2) : '-';
  const scaleName = k => SCALE_NAME[k] || `1:${k}`;
  const wrap = (lines, n) => [].concat(...lines.map(t => { const o = []; let cur = ''; String(t).split(' ').forEach(w => { if (cur && (cur + ' ' + w).length > n) { o.push(cur); cur = w; } else cur = cur ? cur + ' ' + w : w; }); if (cur) o.push(cur); return o; }));
  const asc = s => String(s == null ? '' : s).replace(/²/g, '2').replace(/³/g, '3').replace(/≤/g, '<=').replace(/≥/g, '>=').replace(/√/g, 'SQRT ').replace(/θ/g, 'THETA ').replace(/Δ/g, 'DELTA ')
    .replace(/σ/g, 'SIGMA').replace(/[·•]/g, '-').replace(/…/g, '...').replace(/→/g, '->').replace(/§\s*/g, 'SEC. ').replace(/[ₐ-ₜ]/g, '');
  const U = s => X_().str(asc(s)).toUpperCase();
  const setupOf = (P, id) => (P.setups || []).find(u => u.id === id) || null;
  const craneOf = (P, u) => (u && (P.cranes || []).find(c => c.id === u.craneId)) || null;
  const nC = t => t.type === 'single' ? 1 : 2;

  /* ---------- the summary of every lift ---------- */
  /* the governing 3D clearance: the smallest margin over its requirement (power D − D_min, obstruction D − clearance); exclusion zones and
     obstructions of unknown height are left out (as ui/picks.js c3Gov, the Picks tab's "Closest 3D") */
  function govClr(results) {
    const rs = (results || []).filter(r => r && r.gov && ((r.type === 'power') || (r.type === 'obst' && r.known !== false && !(r.env && r.env.known === false)))); if (!rs.length) return null;
    const req = r => r.type === 'power' ? (isNum(r.D) ? r.D : 0) : (r.req || 0), g = rs.reduce((a, b) => (b.gov.d - req(b)) < (a.gov.d - req(a)) ? b : a);
    return { name: g.name, type: g.type, d: g.gov.d, req: req(g), comp: g.gov.comp, crane: g.gov.crane, level: g.level, where: g.where };
  }
  /* clearances sorted by their margin (the data table's "closest 3D clearances") */
  function clrList(results, n) {
    const req = r => r.type === 'power' ? (isNum(r.D) ? r.D : 0) : r.type === 'obst' ? (r.req || 0) : 0;
    return (results || []).filter(r => r && r.gov && r.type !== 'excl').slice().sort((a, b) => (a.gov.d - req(a)) - (b.gov.d - req(b))).slice(0, n || 3);
  }
  const compText = (c, single) => { const C = Object.assign({}, (C3() || {}).COMP || {}, (T() || {}).COMP || {}); return (c.crane == null || single ? '' : `crane ${c.crane + 1} `) + (C[c.comp] || c.comp || ''); };
  /* the largest float / track load and bearing ratio of a list of ground results (engine/ground.js evaluate) */
  function groundSum(gs) {
    const ok = (gs || []).filter(g => g && g.mode && g.mode !== 'none');
    if (!ok.length) { const g = (gs || []).find(x => x && x.why); return g ? { none: g.why } : null; }
    let load = null, ratio = null, q = null;
    ok.forEach((g, gi) => g.max.forEach((m, i) => { if (!load || m.load > load.v) load = { v: m.load, sup: m.name, id: m.id, g: gi }; const b = g.bear[i]; if (b && isNum(b.ratio) && (!ratio || b.ratio > ratio.v)) ratio = { v: b.ratio, sup: m.name, g: gi }; if (b && isNum(b.qg) && (!q || b.qg > q.v)) q = { v: b.qg, sup: m.name }; }));
    return { load: load && load.v, sup: load && load.sup, ratio: ratio ? ratio.v : null, ratioSup: ratio && ratio.sup, qg: q && q.v, mode: ok.some(g => g.mode === 'estimate') ? 'estimate' : 'rigid', crawler: ok.some(g => g.S.kind === 'crawler') };
  }
  const flagSum = fl => ({ stop: (fl || []).filter(f => f.level === 'stop').length, warn: (fl || []).filter(f => f.level === 'warn').length, list: (fl || []).filter(f => f.level !== 'info') });
  function reachOf(ev) { const h = ev.elev; if (!h) return null; const ms = [h.pick.margin, h.set.margin, h.swing.min].filter(v => v != null); return ms.length ? Math.min(...ms) : null; }
  function summary(P, ctx) {
    const rows = [];
    (P.picks || []).forEach(k => {
      const u = setupOf(P, k.setupId), c = craneOf(P, u), ev = u && c ? ctx.evalPick(k) : null;
      if (!ev) { rows.push({ kind: 'pick', id: k.id, name: k.name, key: 'pick-' + k.id, missing: 'the setup or its crane is missing', cranes: [], flags: flagSum([]) }); return; }
      rows.push({ kind: 'pick', id: k.id, name: k.name, key: 'pick-' + k.id, grKey: ev.ground && ev.ground.mode !== 'none' ? 'gr-' + k.id : null, ev, u, c,
        cranes: [{ setup: u.name, setupId: u.id, crane: K().name(c.def), W: ev.W, C: ev.gov.look.ok ? ev.gov.C : null, pct: ev.cls === 'np' ? null : ev.gov.pct, cls: ev.cls, clsText: LF().CLS[ev.cls], where: ev.govWhere }],
        reach: reachOf(ev), clr: govClr(ev.c3 && ev.c3.results), ground: groundSum([ev.ground]), flags: flagSum(ev.flags) });
    });
    (P.tandems || []).forEach(t => {
      const r = ctx.evalT ? ctx.evalT(t) : null;
      if (!r || !r.gov.length) { rows.push({ kind: 'tandem', id: t.id, name: t.name, key: 'tandem-' + t.id, missing: r && r.flags[0] ? r.flags[0].text : 'incomplete', cranes: [], flags: flagSum(r ? r.flags : []), t, r }); return; }
      const ms = r.gov.map(g => g.reach ? g.reach.m : null).filter(v => v != null);
      rows.push({ kind: 'tandem', id: t.id, name: t.name, key: 'tandem-' + t.id, grKey: 'tandem-' + t.id, t, r, single: r.single,
        cranes: r.gov.map((g, i) => { const u = setupOf(P, t.slots[i]), c = craneOf(P, u); return { setup: u ? u.name : '-', setupId: u && u.id, crane: c ? K().name(c.def) : '-', W: r.sh.Wh[i], C: g.c.e.look.ok ? g.c.C : null, pct: g.c.e.look.ok ? g.c.pct : null, cls: g.c.cls,
          clsText: r.single ? LF().CLS[g.c.cls] : T().CLS[g.c.cls], where: `step ${g.i}: ${g.where}`, step: g.i }; }),
        reach: ms.length ? Math.min(...ms) : null, clr: govClr(r.clr), ground: groundSum(r.ground ? r.ground.cr : []), flags: flagSum(r.flags) });
    });
    // C6 routes (ctx.evalRoute: CranePickRouteUI.evalRoute): the worst flag, gross weight, largest off-tracking, the least overhead margin, the lift it delivers to
    (P.routes || []).forEach((rt, i) => {
      const ev = ctx.evalRoute ? ctx.evalRoute(rt) : null, key = 'route-' + i, k = rt.pickId && (P.picks || []).find(q => q.id === rt.pickId), t = rt.tandemId && (P.tandems || []).find(q => q.id === rt.tandemId);
      const to = t ? { name: t.name, key: 'tandem-' + t.id } : k ? { name: k.name, key: 'pick-' + k.id } : null;
      if (!ev || !ev.sim || !ev.sim.ok) { rows.push({ kind: 'route', id: rt.id, i, name: rt.name, key, to, missing: ev && ev.flags[0] ? ev.flags[0].text : 'not evaluated', cranes: [], flags: flagSum(ev ? ev.flags : []), rt, ev }); return; }
      let oh = null; (ev.oh.list || []).forEach(o => { const m = o.kind === 'power' ? (isNum(o.d) && isNum(o.DT) ? o.d - o.DT : null) : o.c; if (m == null) return;
        if (!oh || m < oh.margin) oh = { name: o.name, margin: m, text: o.kind === 'power' ? `${o.name}: ${fmt(o.d, 2)} ft vs D_T ${fmt(o.DT, 0)} ft (power line)` : `${o.name}: ${fmt(o.c, 2)} ft under it` }; });
      rows.push({ kind: 'route', id: rt.id, i, name: rt.name, key, to, rt, ev, cranes: [], worst: ev.worst, gross: ev.ax && ev.ax.gross, otMax: ev.otMax, oh, flags: flagSum(ev.flags) });
    });
    return rows;
  }
  const pctText = c => c.pct == null ? 'not permitted' : fmt(c.pct, 1) + ' %';
  const clrText = (x, single) => x ? `${x.name}: ${fmt(x.d, 2)} ft (${compText(x, single)})${x.type === 'power' ? (x.d < x.req ? ' < ' : ' >= ') + 'D_min ' + fmt(x.req, 0) + ' ft' : x.req ? ', clearance ' + fmt(x.req, 2) + ' ft' : ''}` : '-';
  const grText = g => !g ? '-' : g.none ? 'not computed' : `${kip(g.load)} kip (${g.sup})`;

  /* ---------- the general notes (sheet 2) and Report §2 Basis: one model ---------- */
  function usedCranes(P) {
    const ids = new Set(); (P.setups || []).forEach(u => { const used = (P.picks || []).some(k => k.setupId === u.id) || (P.tandems || []).some(t => t.slots.slice(0, nC(t)).includes(u.id)); if (used) ids.add(u.craneId); });
    return (P.cranes || []).filter(c => ids.has(c.id));
  }
  function notesModel(P, ctx) {
    const s = LF().settingsOf(P), tl = (P.lift && P.lift.tandem) || 75, z = G().zone(P.site.zone), out = [], R = window.CranePickReport;
    out.push({ topic: 'Lift-planning aid', text: (R && R.STATEMENT) || 'Lift-planning aid.', key: 'aid' });
    const cr = usedCranes(P);
    cr.forEach(c => { const d = c.def, so = d.source || {};
      out.push({ topic: `Crane data: ${K().name(d)}`, key: 'crane-' + c.id, text: `source ${so.doc || 'not stated'}, revision ${so.revision || '-'}, ${so.date || 'date not stated'}${so.pages ? ', pages ' + so.pages : ''}${d.preliminary ? '; PRELIMINARY document: confirm every value against the final chart for the machine' : ''}${d.app_inputs && d.app_inputs.edited ? '; chart edited in this tool' : ''}${so.terms ? '; terms of the source: ' + String(so.terms).replace(/\.\s*$/, '') : ''}.` }); });
    if (!cr.length) out.push({ topic: 'Crane data', text: 'no crane is used by a lift yet.', key: 'cranes' });
    // rating basis of each configuration the lifts use
    const cfgs = new Map();
    summary(P, ctx).forEach(row => { if (row.kind === 'pick' && row.ev) [row.ev.pick, row.ev.set, row.ev.gov].forEach(e => { if (e.cfg) cfgs.set(row.c.id + ':' + e.cfg.id, { c: row.c, g: e.cfg }); });
      if (row.kind === 'tandem' && row.r) row.r.gov.forEach((g, i) => { const c = craneOf(P, setupOf(P, row.t.slots[i])); if (c && g.c.e && g.c.e.cfg) cfgs.set(c.id + ':' + g.c.e.cfg.id, { c, g: g.c.e.cfg }); }); });
    if (cfgs.size) out.push({ topic: 'Rating basis', key: 'cranes', text: [...cfgs.values()].map(({ c, g }) => `${K().name(c.def)}, ${g.label || g.id}: ${K().ratingBasis(g, c.def).text}`).join('; ') + '.' });
    out.push({ topic: 'Chart capacity', key: 'lift-rule', text: 'the chart value at the next longer tabulated boom length and the next larger tabulated radius; no interpolation' + (s.interp ? ' (linear interpolation between radii where the chart notes permit it: ON)' : '') + '; outside the chart = not permitted; total load W = load + rigging + hook block + other deductions (the charts are gross).' });
    out.push({ topic: 'Thresholds', key: 'lift-rule', text: `single-crane lifts: caution >= ${s.caution} %, critical lift >= ${s.critical} %, limit ${s.limit} % of chart; tandem lifts: ${fmt(tl, 0)} % of chart per crane (at the limit counts as over).` });
    const meth = []; (P.setups || []).forEach(u => { const ks = (P.picks || []).filter(k => k.setupId === u.id); let g = null; ks.some(k => { const ev = ctx.evalPick(k); g = ev && ev.ground; return g; });
      if (!g) (P.tandems || []).some(t => { const i = t.slots.slice(0, nC(t)).indexOf(u.id); if (i < 0) return false; const r = ctx.evalT && ctx.evalT(t); g = r && r.ground && r.ground.cr[i]; return g; });
      if (g) meth.push(`${u.name}: ${g.mode === 'none' ? 'not computed (' + g.why + ')' : g.mode === 'rigid' ? 'entered data' : 'estimate — verify with the manufacturer\'s outrigger calculator'}`); });
    out.push({ topic: 'Outrigger / track loads', key: 'ground-basis', text: (meth.length ? meth.join('; ') : 'no crane setup') + '. Rigid-body statics with the entered weights and CGs, else the bounding estimate (Report §Ground basis).' });
    out.push({ topic: 'Power lines', key: 'items-power', text: '29 CFR 1926.1408 Table A minimum clearance D_min by the entered voltage (up to 50 kV 10 ft; over 50 to 200 kV 15 ft; over 200 to 350 kV 20 ft; over 350 to 500 kV 25 ft; over 500 to 750 kV 35 ft; over 750 to 1,000 kV 45 ft; over 1,000 kV as set by the utility or a registered professional engineer); voltage not known: 50 ft, or 20 ft where the utility says 350 kV or less; checked in 3D for the boom, load line, load and counterweight along the path.' });
    if ((P.routes || []).length) out.push({ topic: 'Trucking routes', key: 'route', text: 'swept path by the low-speed kinematic off-tracking model of the drawn steer-axle path; power lines over the route: 29 CFR 1926.1411 Table T travel clearance (applied to the haul vehicle and its load; voltage not known: 20 ft); overhead items: clearance above the load top; posted bridges against the entered postings (tons of 2,000 lb).' });
    out.push({ topic: '3D clearances', key: 'lift-rule', text: `path model ${s.path === 'luff' ? 'luff at the pick, then swing at the set radius' : 'uniform (the radius changes evenly with the swing)'}; obstruction clearance ${fmt(s.obstClr, 2)} ft (contact red, closer amber); crane to crane: the same clearance.` });
    out.push({ topic: 'Coordinate system', key: 'crs', text: `${z.name}; grid coordinates and distances (no combined scale or elevation factor); NAD 83; plan views grid north up; elevations in ft (crane pad elevation as entered, else the datum 0.00).` });
    out.push({ topic: 'Units', text: 'US customary: ft, lb (kip = 1,000 lb), psf (ksf = 1,000 psf).' });
    return out;
  }

  /* ---------- the sheet frame and the block sheets (COPY of apps/ps-bridge/ui/sheets.js, adapted: crane title block) ---------- */
  function table(D, lL, lT, x, y, cols, rows, title) {
    const h = D.h, ch = h * 0.8, rh = 1.5 * h; let yy = y;
    if (title) { D.text(lT, x, yy, h, U(title)); yy -= 1.7 * h; }
    const w = cols.map((c, i) => Math.max(U(c).length, ...rows.map(r => U(r[i]).length)) * ch * 0.95 + 2 * ch), W = w.reduce((a, b) => a + b, 0), xs = [x];
    w.forEach(v => xs.push(xs[xs.length - 1] + v));
    const top = yy + 0.2 * h; D.line(lL, x, top, x + W, top); const hy = yy - rh; cols.forEach((c, i) => D.text(lT, xs[i] + ch * 0.6, yy - 1.05 * h, ch, U(c))); D.line(lL, x, hy, x + W, hy);
    rows.forEach((r, j) => { const ry = hy - (j + 1) * rh; r.forEach((c, i) => D.text(lT, xs[i] + ch * 0.6, ry + 0.45 * h, ch, U(c))); D.line(lL, x, ry, x + W, ry); });
    const bot = hy - rows.length * rh; xs.forEach(xv => D.line(lL, xv, top, xv, bot));
    return { w: W, y: bot - 1.2 * h };
  }
  function notesBlk(D, lT, x, y, title, lines, wc, plain) {
    const h = D.h; wc = wc || 90; if (title) D.text(lT, x, y, h, U(title)); let yy = y - (title ? 1.8 * h : 0);
    lines.forEach((s, i) => { const out = wrap([asc(s).toUpperCase()], wc).map(U);
      out.forEach((ln, j) => { D.text(lT, x + (j && !plain ? 2.2 * h : 0), yy, h * 0.8, j || plain ? ln : `${i + 1}. ${ln}`); yy -= 1.35 * h; }); yy -= 0.3 * h; });
    return yy;
  }
  function headBlk(D, lT, x, y, lines) { let yy = y; lines.forEach(([sz, t]) => { D.text(lT, x, yy, sz * D.h, U(t)); yy -= (sz + 0.7) * D.h; }); return yy; }
  const blockDraw = (D, b, x, y) => { const lT = D.layer('TEXT', 7), lL = D.layer('TBL', 8);
    return b.t === 'notes' ? notesBlk(D, lT, x, y, b.title, b.lines, b.wc, b.plain) : b.t === 'head' ? headBlk(D, lT, x, y, b.lines) : table(D, lL, lT, x, y, b.cols, b.rows, b.title); };
  function blockBox(b) { const D = X_().drawing({ prefix: 'C-' }); D.k = 1; D.h = TXT; blockDraw(D, b, 0, 0); return D.bbox(0); }
  function blockPages(blocks, aw, ah) {
    const gapY = 0.25, gapX = 0.5, list = [];
    blocks.forEach(b => { if (b.t !== 'table') { list.push(b); return; } let rows = b.rows, first = true;
      if (!rows.length) { list.push(b); return; }
      while (rows.length) { let n = rows.length; const part = m => ({ ...b, page: first && b.page, title: first ? b.title : `${b.title} (CONTINUED)`, rows: rows.slice(0, m) }); const H = m => { const q = blockBox(part(m)); return q[3] - q[1]; };
        while (n > 1 && H(n) > ah) n--; list.push(part(n)); rows = rows.slice(n); first = false; } });
    const pages = [[]]; let cx = 0, cy = 0, cw = 0;
    list.forEach(b => { const q = blockBox(b), w = q[2] - q[0], hh = q[3] - q[1];
      if (b.page && pages[pages.length - 1].length) { pages.push([]); cx = 0; cy = 0; cw = 0; }
      if (cy > 0 && cy + hh > ah) { cx += cw + gapX; cy = 0; cw = 0; }
      if (cx > 0 && cx + w > aw) { pages.push([]); cx = 0; cy = 0; cw = 0; }
      pages[pages.length - 1].push({ b, x: cx - q[0], y: -cy - q[3] }); cy += hh + gapY; cw = Math.max(cw, w); });
    return pages;
  }
  const pageFn = items => (D) => items.forEach(p => blockDraw(D, p.b, p.x * D.k, p.y * D.k));
  /* sheet(D, S, ox, C): the drawing S.fn at the smallest plot scale (from S.kmin) at which it fits the drawing area, its border and title
     block (PROJECT, PROJECT NO., SHEET TITLE, SCALE, PREPARED / CHECKED, SHEET n OF N) and the lift-planning-aid line (every sheet) */
  function sheet(D, S, ox, C) {
    const [pw, ph] = PAPER[S.paper] || PAPER.D, aw = pw - 2.25, ah = ph - 4.55, i0 = D.mark(); let k = null, b = null;
    for (const kk of SCALES) { if (kk < (S.kmin || 1)) continue; D.E.length = i0; D.k = kk; D.h = TXT * kk; S.fn(D, S.c); b = D.bbox(i0); if (!isFinite(b[0])) b = [0, 0, 0, 0]; if ((b[2] - b[0]) / kk <= aw && (b[3] - b[1]) / kk <= ah) { k = kk; break; } }
    const over = !k; if (!k) k = D.k;
    const W = pw * k, H = ph * k; D.move(i0, ox + 1.25 * k - b[0], H - 1.0 * k - b[3]); const iC = D.mark();
    const t = C.P.title || {}, cells = [[0.75, 'PROJECT', t.name || ''], [9, 'PROJECT NO.', t.number || ''], [13, 'SHEET TITLE', S.title], [24, 'SCALE', (S.noScale ? 'AS NOTED' : scaleName(k)) + (S.half ? ' (HALF SIZE)' : '')], [28, 'PREPARED / CHECKED', `${t.by || '-'} / ${t.checker || '-'}`], [31, 'SHEET', `${S.n} OF ${S.of}`]];
    const tb = D.layer('TBLK', 7), bd = D.layer('BRDR', 7);
    if (!S.half) X_().sheetBorder(D, bd, ox, W, H, k); D.rect(bd, ox + 0.75 * k, 0.5 * k, ox + W - 0.5 * k, H - 0.5 * k);
    const ty = 0.5 * k, th = 2.6 * k, x1 = ox + W - 0.5 * k; D.line(tb, ox + 0.75 * k, ty + th, x1, ty + th);
    const sx = pw / 34; cells.forEach(([cx, lb, val], i) => { const xx = ox + cx * k * sx; if (i) D.line(tb, xx, ty, xx, ty + th); D.text(tb, xx + 0.15 * k, ty + th - 0.35 * k, 0.1 * k, lb); D.text(tb, xx + 0.15 * k, ty + 1.0 * k, (pw < 20 ? 0.13 : 0.18) * k, U(val).slice(0, pw < 20 && i === 2 ? 40 : 60)); });
    D.text(tb, ox + 0.9 * k, ty + 0.55 * k, 0.1 * k, 'LIFT-PLANNING AID: THE CRANE MANUFACTURER\'S LOAD CHARTS AND INSTRUCTIONS, THE LIFT PLAN AND THE SITE CHECKS GOVERN. VERIFY EVERY VALUE BEFORE THE LIFT.');
    D.text(tb, ox + 0.9 * k, ty + 0.25 * k, 0.08 * k, `GENERATED BY CRANE PICK ANALYZER ${C.date}. FULL-SIZE GEOMETRY IN INCHES (1 FT = 12 UNITS); PLOT THIS SHEET AT ${k === 1 ? 'FULL SIZE' : '1:' + k} (${scaleName(k)}).`
      + (S.half ? ` HALF-SIZE PRINT ON 11 X 17: THE SCALES SHOWN ARE FOR THE FULL-SIZE ${pw} X ${ph} SHEET; THIS PRINT IS AT 1:${2 * k}.` : ''));
    return { n: S.n, title: S.title, id: S.id, k, W, H, ox, i0, iC, i1: D.mark(), over, paper: S.paper, src: S.src || [] };
  }

  /* ---------- plan views ---------- */
  const nice = v => { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))); return [1, 2, 5, 10].map(m => m * e).filter(m => m <= v).pop() || e; };
  /* Liang–Barsky: the part of segment a–b inside the window, or null */
  function clip(a, b, w) {
    let t0 = 0, t1 = 1; const dx = b.x - a.x, dy = b.y - a.y;
    const p = [-dx, dx, -dy, dy], q = [a.x - w.x0, w.x1 - a.x, a.y - w.y0, w.y1 - a.y];
    for (let i = 0; i < 4; i++) { if (Math.abs(p[i]) < 1e-12) { if (q[i] < 0) return null; continue; } const r = q[i] / p[i]; if (p[i] < 0) { if (r > t1) return null; if (r > t0) t0 = r; } else { if (r < t0) return null; if (r < t1) t1 = r; } }
    return [{ x: a.x + t0 * dx, y: a.y + t0 * dy }, { x: a.x + t1 * dx, y: a.y + t1 * dy }];
  }
  const inWin = (p, w) => p.x >= w.x0 && p.x <= w.x1 && p.y >= w.y0 && p.y <= w.y1;
  /* the window of a plan view: the given points, padded, at least 60 ft */
  function windowOf(pts, padF) {
    const ok = pts.filter(p => p && isNum(p.x) && isNum(p.y)); if (!ok.length) return { x0: 0, y0: 0, x1: 60, y1: 60 };
    let x0 = Math.min(...ok.map(p => p.x)), x1 = Math.max(...ok.map(p => p.x)), y0 = Math.min(...ok.map(p => p.y)), y1 = Math.max(...ok.map(p => p.y));
    const span = Math.max(x1 - x0, y1 - y0, 60), pad = span * (padF == null ? 0.12 : padF), cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    const hx = Math.max((x1 - x0) / 2 + pad, 30), hy = Math.max((y1 - y0) / 2 + pad, 30);
    return { x0: cx - hx, x1: cx + hx, y0: cy - hy, y1: cy + hy };
  }
  /* a view context: model coordinates of a grid point */
  const pv = w => ({ w, X: x => (x - w.x0) * 12, Y: y => (y - w.y0) * 12 });
  function drawPoly(D, V, l, pts, closed, lt) {
    const w = V.w; if (!pts || pts.length < 2) return;
    if (pts.every(p => inWin(p, w))) { D.pline(l, pts.map(p => [V.X(p.x), V.Y(p.y)]), closed, lt); return; }
    const n = closed ? pts.length : pts.length - 1;
    for (let i = 0; i < n; i++) { const c = clip(pts[i], pts[(i + 1) % pts.length], w); if (c) D.line(l, V.X(c[0].x), V.Y(c[0].y), V.X(c[1].x), V.Y(c[1].y), lt); }
  }
  function drawCircle(D, V, l, c, r) { if (!isNum(r) || r <= 0) return; const w = V.w; if (c.x - r >= w.x0 && c.x + r <= w.x1 && c.y - r >= w.y0 && c.y + r <= w.y1) { D.circle(l, V.X(c.x), V.Y(c.y), r * 12); return; }
    drawPoly(D, V, l, LF().circle(c, r, 72), true); }
  /* the site: plan sheet outlines, site items (clipped), the power-line D_min buffers, labels */
  function siteLayer(D, V, P) {
    const h = D.h, lS = D.layer('SITE-SHEET', 8, 'DASHED'), lO = D.layer('SITE-OBST', 6), lP = D.layer('SITE-POWER', 1), lB = D.layer('SITE-POWER-DMIN', 1, 'DASHED'), lU = D.layer('SITE-UTIL', 3, 'DASHED'), lX = D.layer('SITE-EXCL', 30, 'DASHED'), lT = D.layer('TEXT', 7);
    const dsh = D.ltype('DASHED');
    (P.sheets || []).forEach(s => { if (!(s.w > 0 && s.h > 0) || !s.place) return; const c = [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]].map(([x, y]) => G().pxToFt(s.place, x, y)); drawPoly(D, V, lS, c, true, dsh);
      const m = c.find(p => inWin(p, V.w)); if (m) D.text(lT, V.X(m.x) + 0.5 * h, V.Y(m.y) - 1.2 * h, 0.7 * h, U(`PLAN SHEET: ${s.name || ''}`)); });
    (P.items || []).forEach(it => {
      const lab = (p, t) => { if (p && inWin(p, V.w)) D.text(lT, V.X(p.x) + 0.4 * h, V.Y(p.y) + 0.4 * h, 0.75 * h, U(t)); };
      if (it.type === 'obst') { drawPoly(D, V, lO, it.pts, true); lab(G().centroid(it.pts), `${it.name || 'OBSTRUCTION'}${isNum(it.topEl) ? ' TOP EL. ' + fmt(it.topEl, 2) : isNum(it.height) ? ' H ' + fmt(it.height, 1) + ' FT' : ''}`); }
      else if (it.type === 'power') { const c = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }); drawPoly(D, V, lP, it.pts, false);
        if (isNum(c.ft)) G().bufferRings(it.pts, c.ft, 36).forEach(r => drawPoly(D, V, lB, r, true, dsh));
        lab(it.pts.find(p => inWin(p, V.w)), `${it.name || 'POWER LINE'}${isNum(it.kv) ? ' ' + fmt(it.kv, 1) + ' KV' : ''} D_MIN ${isNum(c.ft) ? fmt(c.ft, 0) + ' FT' : 'NOT SET'}`); }
      else if (it.type === 'util') { drawPoly(D, V, lU, it.pts, it.pts.length > 2 && it.closed, dsh); lab(it.pts.find(p => inWin(p, V.w)), `${it.name || 'UTILITY'}${isNum(it.depth) ? ' DEPTH ' + fmt(it.depth, 1) + ' FT' : ''}`); }
      else if (it.type === 'excl') { drawPoly(D, V, lX, it.pts, true, dsh); lab(G().centroid(it.pts), `EXCLUSION: ${it.name || it.reason || ''}`); }
      else if (it.type === 'label' && it.pts[0] && inWin(it.pts[0], V.w)) D.text(lT, V.X(it.pts[0].x), V.Y(it.pts[0].y), h, U(it.text || it.name || ''), 1);
    });
  }
  /* a crane setup to scale: the crane symbol (engine/cranegfx.js, 2026-11-17: carrier / carbody with axles and wheels or tracks with
     tumblers and shoes, outrigger beams and floats at the chart's spread, the upperworks turned to o.hook with its operator cab and the
     counterweight at the tail radius, the boom with its sections / chords and head sheaves, the hook block, the load o.load (L × W) or
     o.loadPolys), one DXF layer per part (CRANE-CARRIER, CRANE-OUTRIGGER, CRANE-FLOAT, CRANE-UPPER, CRANE-CWT, CRANE-BOOM, CRANE-HOOK,
     CRANE-LOAD; polylines), the tail-swing circle, the centre of rotation, the heading / slew labels; the mats */
  function setupLayer(D, V, P, u, o) {
    o = o || {}; const c = craneOf(P, u); if (!c) return; const f = LF().footprint(c.def, u), h = D.h;
    const lC = D.layer('CRANE', 5), lF = D.layer('CRANE-FLOAT', 30), lM = D.layer('CRANE-MAT', 32), lW = D.layer('CRANE-TAIL', 6, 'PHANTOM'), lT = D.layer('TEXT', 7), ph = D.ltype('PHANTOM');
    const CG = window.CranePickCraneGfx;
    if (CG) { const sy = CG.symbol(c.def, u, { hook: o.hook, load: o.load, loadPolys: o.loadPolys, labels: true }), Ly = g => D.layer(CG.GROUPS[g].layer, CG.GROUPS[g].aci);
      CG.draw(sy, { poly: (g, pts, cl) => { if (g !== 'cor') drawPoly(D, V, Ly(g), pts, cl); }, circle: (g, q, r) => { if (g !== 'cor') drawCircle(D, V, Ly(g), q, r); },
        text: (g, p, t, rot, sz) => { if (inWin(p, V.w)) D.text(lT, V.X(p.x), V.Y(p.y), 0.6 * (sz || 1) * h, U(String(t).replace(/°/g, ' DEG')), 0, rot); } }); }
    else { if (f.body) drawPoly(D, V, lC, f.body, true); f.tracks.forEach(q => drawPoly(D, V, lC, q, true)); f.beams.forEach(b => drawPoly(D, V, lC, b, false)); f.floatC.forEach(q => drawCircle(D, V, lF, q, q.r)); }
    if (isNum(f.tail)) drawPoly(D, V, lW, LF().circle(u, f.tail, 72), true, ph);
    // mats (setup.ground): wheeled B (forward) × L (across) at each float; crawler: the mat length across each track, under its length
    const m = u.ground && u.ground.mat, S = GR() && GR().supports(c.def, u);
    if (!CG && m && m.type !== 'none' && S && S.ok && isNum(m.B) && m.B > 0) {   // 2026-11-17: with the symbol, the mats are its 'mat' group (to scale, count / orientation, size label)
      const rect = (cx, cy, bx, by) => [[cx + bx / 2, cy + by / 2], [cx + bx / 2, cy - by / 2], [cx - bx / 2, cy - by / 2], [cx - bx / 2, cy + by / 2]].map(([x, y]) => LF().toGrid(u, x, y));
      S.items.forEach(it => { if (S.kind === 'wheeled') drawPoly(D, V, lM, rect(it.lx, it.ly, m.B, isNum(m.L) && m.L > 0 ? m.L : m.B), true); else drawPoly(D, V, lM, rect(0, it.ly, S.Lt, m.B), true); });
    }
    if (inWin(u, V.w)) { const x = V.X(u.x), y = V.Y(u.y), r = 0.6 * h; D.circle(lC, x, y, r); D.line(lC, x - 2 * r, y, x + 2 * r, y); D.line(lC, x, y - 2 * r, x, y + 2 * r);
      D.text(lT, x + 1.2 * h, y - 2.2 * h, 0.85 * h, U(`${u.name}${o.tag ? ' (' + o.tag + ')' : ''}`)); D.text(lT, x + 1.2 * h, y - 3.4 * h, 0.7 * h, U(`BOOM ${fmt(u.boom, 1)} FT, HEADING ${fmt(u.heading || 0, 1)} DEG`)); }
  }
  /* the C2 load in plan at the hook (the pick's Heights inputs L × W), and a setup's first single pick (the ground sheet's upperworks) */
  const loadOf = k => { const e = k && k.elev; return e && e.L > 0 && e.W > 0 ? { L: e.L, W: e.W } : null; };
  const hookOf = (P, u) => { const k = (P.picks || []).find(x => x.setupId === u.id); return k ? { hook: k.pick, load: loadOf(k) } : {}; };
  const mark = (D, V, l, p, t, lT) => { if (!inWin(p, V.w)) return; const x = V.X(p.x), y = V.Y(p.y), r = 0.9 * D.h; D.circle(l, x, y, r); D.text(lT, x, y - 0.35 * D.h, 0.8 * D.h, t, 1); };
  /* flags of the 3D clearances (p: the closest point of the crane / load, q: of the item) */
  function flagLayer(D, V, flags) {
    const lF = D.layer('FLAG', 1), lT = D.layer('TEXT', 7), dsh = D.ltype('DASHED'); let n = 0; const out = [];
    (flags || []).filter(f => f.p && f.q && f.level !== 'info').forEach(f => { n++; const c = clip(f.p, f.q, V.w); if (c) D.line(lF, V.X(c[0].x), V.Y(c[0].y), V.X(c[1].x), V.Y(c[1].y), dsh);
      if (inWin(f.p, V.w)) { const x = V.X(f.p.x), y = V.Y(f.p.y), r = 0.8 * D.h; D.pline(lF, [[x, y + r * 1.6], [x + r * 1.4, y - r], [x - r * 1.4, y - r]], true); D.text(lT, x, y - 0.5 * r, 0.65 * D.h, `F${n}`, 1); }
      out.push(`F${n}: ${f.text}`); });
    return out;
  }
  /* the frame of the view, grid ticks with State Plane coordinates, the north arrow and a scale bar */
  function frameLayer(D, V, P, title) {
    const w = V.w, h = D.h, lG = D.layer('GRID', 8), lT = D.layer('TEXT', 7), z = G().zone(P.site.zone), nat = v => G().ftToNative(z.id, v), un = z.unit === 'm' ? 'M' : 'FT';
    const X0 = V.X(w.x0), X1 = V.X(w.x1), Y0 = V.Y(w.y0), Y1 = V.Y(w.y1); D.rect(lG, X0, Y0, X1, Y1);
    const st = nice(Math.max(w.x1 - w.x0, w.y1 - w.y0) / 5), tk = 0.8 * h;
    for (let e = Math.ceil(w.x0 / st) * st; e <= w.x1; e += st) { const x = V.X(e); D.line(lG, x, Y0, x, Y0 + tk); D.line(lG, x, Y1, x, Y1 - tk); D.text(lT, x, Y0 - 1.3 * h, 0.7 * h, `E ${fmt(nat(e), 0)}`, 1); }
    for (let n = Math.ceil(w.y0 / st) * st; n <= w.y1; n += st) { const y = V.Y(n); D.line(lG, X0, y, X0 + tk, y); D.line(lG, X1, y, X1 - tk, y); D.text(lT, X0 - 0.4 * h, y - 0.3 * h, 0.7 * h, `N ${fmt(nat(n), 0)}`, 2); }
    // north arrow (grid north) at the top right inside the frame
    const ax = X1 - 3 * h, ay = Y1 - 6 * h; D.pline(lT, [[ax, ay + 4 * h], [ax + 1.2 * h, ay], [ax, ay + 1 * h], [ax - 1.2 * h, ay]], true); D.text(lT, ax, ay - 1.4 * h, h, 'N', 1); D.text(lT, ax, ay - 2.5 * h, 0.6 * h, '(GRID)', 1);
    // scale bar at the bottom left inside the frame
    const sb = nice((w.x1 - w.x0) / 4), bx = X0 + 2 * h, by = Y0 + 2 * h, L = sb * 12;
    D.rect(lT, bx, by, bx + L, by + 0.5 * h); D.solid(D.layer('SCALEBAR', 7), [[bx, by], [bx + L / 2, by], [bx + L / 2, by + 0.5 * h], [bx, by + 0.5 * h]]);
    D.text(lT, bx, by + 0.9 * h, 0.7 * h, '0', 1); D.text(lT, bx + L / 2, by + 0.9 * h, 0.7 * h, fmt(sb / 2, 0), 1); D.text(lT, bx + L, by + 0.9 * h, 0.7 * h, `${fmt(sb, 0)} FT`, 1);
    if (title) D.text(lT, X0, Y1 + 1.2 * h, 1.3 * h, U(title));
    D.text(lT, X0, Y0 - 2.8 * h, 0.7 * h, U(`GRID TICKS: ${z.name} (${un}); TO SCALE`));
  }
  /* the plan view of one pick: site, its setup, the boom at the pick / set / governing point, the swing path, P / S / G, the flags */
  function pickPlan(D, C) {
    const { P, k, u, ev, w } = C.pick, V = pv(w), h = D.h, lB = D.layer('BOOM', 7), lBs = D.layer('BOOM-SET', 7, 'DASHED'), lBg = D.layer('BOOM-GOV', 1, 'CENTER'), lS = D.layer('SWING', 4), lT = D.layer('TEXT', 7), lP = D.layer('POINT', 5);
    siteLayer(D, V, P); setupLayer(D, V, P, u, { hook: k.pick, load: loadOf(k) });
    const seg = (l, a, b, lt) => { const c = clip(a, b, w); if (c) D.line(l, V.X(c[0].x), V.Y(c[0].y), V.X(c[1].x), V.Y(c[1].y), lt); };
    seg(lB, u, k.pick); seg(lBs, u, k.set, D.ltype('DASHED'));
    const gp = ev.gov && ev.gov.p; if (gp && ev.govWhere.indexOf('swing') >= 0) { seg(lBg, u, gp, D.ltype('CENTER')); mark(D, V, lP, gp, 'G', lT); }
    drawPoly(D, V, lS, ev.path.pts, false);
    mark(D, V, lP, k.pick, 'P', lT); mark(D, V, lP, k.set, 'S', lT);
    C.clrDims = clrDimLayer(D, V, P, u);
    [[k.pick, ev.pick, 'P'], [k.set, ev.set, 'S']].forEach(([q, e, t]) => { if (inWin(q, w)) D.text(lT, V.X(q.x) + 1.4 * h, V.Y(q.y) + 0.6 * h, 0.8 * h, U(`${t}: R ${fmt(e.R, 2)} FT, ${e.look.ok ? fmt(e.C, 0) + ' LB, ' + fmt(e.pct, 1) + ' %' : 'NOT PERMITTED'}`)); });
    C.flagText = flagLayer(D, V, ev.c3 && ev.c3.flags);
    frameLayer(D, V, P, `PLAN: ${k.name}`);
  }
  /* 2026-11-17: plan clearance dimensions from each float / track and the tail-swing circle to the nearest site item (CranePickCraneGfx
     clearDims; display only), dimensioned on the lift plan; returns the rows for the data table */
  function clrDimLayer(D, V, P, u) {
    const c = craneOf(P, u), CG = window.CranePickCraneGfx; if (!c || !CG || !CG.clearDims) return [];
    const lD = D.layer('CLR-DIM', 2), lT = D.layer('TEXT', 7), h = D.h, rows = [];
    CG.clearDims(c.def, u, P.items).forEach(r => {
      rows.push([`CLEARANCE ${r.from === 'TAIL' ? 'TAIL SWING' : r.from}`, r.d > 0 ? `${fmt(r.d, 2)} FT TO ${r.name} (${r.type})` : `OVERLAPS ${r.name} (${r.type})`]);
      if (!(r.d > 0)) return; const cc = clip(r.p, r.q, V.w); if (!cc) return;
      const x0 = V.X(cc[0].x), y0 = V.Y(cc[0].y), x1 = V.X(cc[1].x), y1 = V.Y(cc[1].y), a = Math.atan2(y1 - y0, x1 - x0), t = 0.5 * h;
      D.line(lD, x0, y0, x1, y1); [[x0, y0, 1], [x1, y1, -1]].forEach(([x, y, sg]) => { D.line(lD, x, y, x + sg * t * Math.cos(a + 0.4), y + sg * t * Math.sin(a + 0.4)); D.line(lD, x, y, x + sg * t * Math.cos(a - 0.4), y + sg * t * Math.sin(a - 0.4)); });
      let rot = a * 180 / Math.PI; if (rot > 90) rot -= 180; if (rot < -90) rot += 180;
      D.text(lT, (x0 + x1) / 2, (y0 + y1) / 2 + 0.3 * h, 0.6 * h, U(`${r.from === 'TAIL' ? 'TAIL' : r.from} ${fmt(r.d, 2)} FT`), 1, rot); });
    return rows;
  }
  /* support locations (float centres / track ends) for the sheet tables: local x / y and State Plane */
  function supportRows(P, u) {
    const c = craneOf(P, u), CG = window.CranePickCraneGfx; if (!c || !CG || !CG.floatTable) return [];
    const z = G().zone(P.site.zone), un = z.unit === 'm' ? 'M' : 'FT';
    return CG.floatTable(c.def, u, P.site.zone, null).map(r => [`${r.id} (${r.name})`, `X ${fmt(r.lx, 2)}, Y ${fmt(r.ly, 2)} FT; E ${fmt(r.E, 2)}, N ${fmt(r.N, 2)} ${un}`]);
  }
  /* the plan view of a girder lift: both setups, the girder at the pick (on the truck) and the set (on the bearings), the centre's path,
     the booms at each crane's governing step, the hooks */
  function tandemPlan(D, C) {
    const { P, t, r, w } = C.tl, V = pv(w), h = D.h, lG = D.layer('GIRDER', 4), lGs = D.layer('GIRDER-SET', 3), lPa = D.layer('PATH', 6, 'DASHED'), lB = D.layer('BOOM-GOV', 1, 'CENTER'), lT = D.layer('TEXT', 7), lP = D.layer('POINT', 5);
    siteLayer(D, V, P); t.slots.slice(0, nC(t)).forEach((id, i) => { const u = setupOf(P, id), g = r.gov[i], q = g && r.steps[g.i], cr = q && q.cr[i]; if (u) setupLayer(D, V, P, u, { tag: `CRANE ${i + 1}`, hook: cr && cr.p }); });
    const ob = r.sh.ob, pose = (q, l) => { const o = T().outline(t, q, ob); drawPoly(D, V, l, o.box, o.box.length > 2); o.lines.forEach(ln => drawPoly(D, V, l, ln, false)); };
    pose(Object.assign({ z: r.path.zP }, t.pick), lG); pose(Object.assign({ z: r.path.zS }, t.set), lGs);
    if (r.steps.length > 1) drawPoly(D, V, lPa, r.steps.map(q => ({ x: q.x.pose.x, y: q.x.pose.y })), false, D.ltype('DASHED'));
    [[t.pick, 'ON THE TRUCK (PICK)'], [t.set, 'ON THE BEARINGS (SET)']].forEach(([q, s]) => { if (inWin(q, w)) D.text(lT, V.X(q.x) + 1.2 * h, V.Y(q.y) - 2 * h, 0.75 * h, U(`GIRDER ${s}`)); });
    (t.way || []).forEach((q, i) => mark(D, V, lP, q, `W${i + 1}`, lT));
    r.gov.forEach((g, i) => { const q = r.steps[g.i], c = q && q.cr[i], u = setupOf(P, t.slots[i]); if (!c || !u) return;
      const cl = clip(u, c.p, w); if (cl) D.line(lB, V.X(cl[0].x), V.Y(cl[0].y), V.X(cl[1].x), V.Y(cl[1].y), D.ltype('CENTER'));
      mark(D, V, lP, c.p, `H${i + 1}`, lT); if (inWin(c.p, w)) D.text(lT, V.X(c.p.x) + 1.4 * h, V.Y(c.p.y) + (i ? -1.6 : 0.6) * h, 0.75 * h, U(`CRANE ${i + 1} GOVERNING STEP ${g.i}: R ${fmt(c.R, 2)} FT, ${c.e.look.ok ? fmt(c.C, 0) + ' LB, ' + fmt(c.pct, 1) + ' %' : 'NOT PERMITTED'}`)); });
    C.flagText = flagLayer(D, V, r.flags);
    frameLayer(D, V, P, `PLAN: ${t.name}`);
  }

  /* ---------- elevations (to the same scale as the plan; the values of ev.elev / the tandem step) ---------- */
  /* labels at one x, top down, at least 1.2 text heights apart (values close in height would overlap) */
  function stack(D, l, x, list) { let last = Infinity; list.slice().sort((a, b) => b[0] - a[0]).forEach(([y, t]) => { const yy = Math.min(y, last - 1.2 * D.h); D.text(l, x, yy, 0.7 * D.h, U(t)); last = yy; }); }
  function pickElev(D, C, which) {
    const { P, k, u, ev } = C.pick, h0 = ev.elev; if (!h0) return false;
    const h = D.h, e = h0[which], g = h0.g, zp = EL().padEl(u), E = EL().el0(k), H = isNum(E.H) ? E.H : 0, rL = Math.hypot(E.L || 0, E.W || 0) / 2, q = which === 'set' ? k.set : k.pick, R = (which === 'set' ? ev.set : ev.pick).R;
    const lGd = D.layer('ELEV-GROUND', 8), lB = D.layer('BOOM', 7), lL = D.layer('ELEV-LINE', 8), lLd = D.layer('ELEV-LOAD', 5), lC = D.layer('CRANE', 5), lO = D.layer('SITE-OBST', 6), lP = D.layer('SITE-POWER', 1), lPb = D.layer('SITE-POWER-DMIN', 1, 'DASHED'), lT = D.layer('TEXT', 7);
    const S = x => x * 12, Z = z => z * 12, tail = isNum(g.tail) ? g.tail : 10, cwB = zp + g.cwBot, cwT = isNum(g.cwTop) ? zp + g.cwTop : cwB + Math.max(6, tail * 0.4);
    const s0 = -tail - 12, s1 = Math.max(R + rL, 10) + 25;
    D.line(lGd, S(s0), Z(zp), S(s1), Z(zp)); D.text(lT, S(s0), Z(zp) - 1.3 * h, 0.7 * h, U(`PAD EL. ${fmt(zp, 2)}`));
    D.rect(lC, S(-tail), Z(cwB), S(-tail * 0.45), Z(cwT)); D.rect(lC, S(-tail * 0.45), Z(zp), S(g.footE + 1), Z(zp + g.footH + 2));
    // site items the section crosses (ui/elev.js sections)
    if (C.sections) { const az = G().azimuth(u, q), v = { x: Math.sin(az * Math.PI / 180), y: Math.cos(az * Math.PI / 180) };
      C.sections(P.items, u, v, s0, s1, zp, 25).forEach(x => {
        if (x.kind === 'obst' && isNum(x.top)) { D.rect(lO, S(x.s0), Z(Math.min(isNum(x.grade) ? x.grade : zp, zp)), S(Math.max(x.s1, x.s0 + 0.5)), Z(x.top)); D.text(lT, S((x.s0 + x.s1) / 2), Z(x.top) + 0.5 * h, 0.7 * h, U(`${x.it.name || 'OBSTRUCTION'} TOP EL. ${fmt(x.top, 2)}${x.off ? ` (${fmt(x.off, 1)} FT OFF THIS PLANE)` : ''}`), 1); }
        if (x.kind === 'power' && isNum(x.zw)) { D.circle(lP, S(x.s), Z(x.zw), 0.4 * h); if (isNum(x.D)) D.circle(lPb, S(x.s), Z(x.zw), x.D * 12); D.text(lT, S(x.s), Z(x.zw + (isNum(x.D) ? x.D : 0)) + 0.5 * h, 0.7 * h, U(`${x.it.name || 'POWER LINE'} WIRE EL. ${fmt(x.zw, 2)}, D_MIN ${isNum(x.D) ? fmt(x.D, 0) : '?'} FT`), 1); }
      }); }
    const fz = zp + g.footH;
    if (isNum(e.zTip)) { D.line(lB, S(g.footE), Z(fz), S(R), Z(e.zTip)); D.line(lL, S(R), Z(e.zTip), S(R), Z(e.zBk)); D.circle(lB, S(R), Z(e.zTip), 0.3 * h);
      D.text(lT, S(R) - 0.8 * h, Z(e.zTip) + 0.6 * h, 0.75 * h, U(`TIP EL. ${fmt(e.zTip, 2)}`), 2);
      D.text(lT, S(g.footE) + 1.5 * h, Z(fz) + 0.6 * h, 0.75 * h, U(`BOOM ANGLE ${e.ang && isNum(e.ang.theta) ? fmt(e.ang.theta, 1) : '-'} DEG${e.ang && e.ang.used === 'chart' ? ' (CHART)' : ''}`)); }
    else D.text(lT, S(R), Z(zp + 10), h, 'THE BOOM CANNOT REACH THIS RADIUS', 1);
    D.rect(lLd, S(R - 1), Z(e.zHk), S(R + 1), Z(e.zBk)); D.rect(lLd, S(R - Math.max(rL, 0.5)), Z(e.zLb), S(R + Math.max(rL, 0.5)), Z(e.zLb + H));
    if (e.zLt < e.zHk) { D.line(lL, S(R), Z(e.zHk), S(R - Math.max(rL, 1) * 0.8), Z(e.zLt)); D.line(lL, S(R), Z(e.zHk), S(R + Math.max(rL, 1) * 0.8), Z(e.zLt)); }
    stack(D, lT, S(R + Math.max(rL, 0.5)) + 1 * h, [[Z(e.zBk), `HOOK REACH MARGIN ${fmt(e.margin, 2)} FT (BLOCK TOP EL. ${fmt(e.zBk, 2)})`], [Z(e.zHk), `HOOK EL. ${fmt(e.zHk, 2)}`], [Z(e.zLb), `LOAD BOTTOM EL. ${fmt(e.zLb, 2)}`]]);
    const lD = D.layer('DIMS', 2); D.fmt = v => fmt(v / 12, 2) + "'"; D.dimH(lD, 0, S(R), Z(zp) - 3 * h, Z(zp), 'R = <>'); D.fmt = X_().fmtFtIn;
    D.text(lT, S(s0), Z(Math.max(isNum(e.zTip) ? e.zTip : zp, e.zBk)) + 2 * h, 1.1 * h, U(`ELEVATION AT THE ${which === 'set' ? 'SET' : 'PICK'}: ${k.name} (SECTION ALONG THE BOOM; TO SCALE)`));
    return true;
  }
  function tandemElev(D, C, ci) {
    const { P, t, r } = C.tl, g = r.gov[ci], j = g.i, q = r.steps[j]; if (!q) return false;
    const h = D.h, us = t.slots.slice(0, nC(t)).map(id => setupOf(P, id)), a = us[0], c0 = q.cr[0]; if (!a || !c0) return false;
    const b = us[1] && q.cr[1] ? us[1] : c0.p, L0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, v = { x: (b.x - a.x) / L0, y: (b.y - a.y) / L0 }, sOf = p => (p.x - a.x) * v.x + (p.y - a.y) * v.y;
    const ob = r.sh.ob, H = ob.H, zb = q.x.pose.z, ge = [T().at(q.x.pose, ob.L, 0, 0), T().at(q.x.pose, ob.L, ob.L, 0)].map(sOf), zp = EL().padEl(a);
    const S = x => x * 12, Z = z => z * 12, lGd = D.layer('ELEV-GROUND', 8), lB = D.layer('BOOM', 7), lL = D.layer('ELEV-LINE', 8), lG = D.layer('GIRDER', 4), lC = D.layer('CRANE', 5), lT = D.layer('TEXT', 7), lLd = D.layer('ELEV-LOAD', 5);
    const ss = [0, L0].concat(ge, q.cr.filter(Boolean).map(c => sOf(c.p))), s0 = Math.min(...ss) - 15, s1 = Math.max(...ss) + 15;
    D.line(lGd, S(s0), Z(zp), S(s1), Z(zp)); D.text(lT, S(s0), Z(zp) - 1.3 * h, 0.7 * h, U(`PAD EL. ${fmt(zp, 2)}`));
    D.rect(lG, S(Math.min(...ge)), Z(zb), S(Math.max(Math.max(...ge), Math.min(...ge) + 0.5)), Z(zb + Math.max(H, 0.5)));
    q.cr.forEach((c, i) => { if (!c) return; const sc = sOf(us[i]), sh = sOf(c.p), sf = sOf(c.foot);
      D.rect(lC, S(sc - 6), Z(zp), S(sc + 6), Z(zp + 6));
      if (c.tip) { D.line(lB, S(sf), Z(c.foot.z), S(sh), Z(c.tip.z)); D.line(lL, S(sh), Z(c.tip.z), S(sh), Z(c.zBk)); D.text(lT, S(sh), Z(c.tip.z) + 0.6 * h, 0.7 * h, U(`C${i + 1} TIP EL. ${fmt(c.tip.z, 2)}`), 1); }
      D.rect(lLd, S(sh - 1), Z(c.zHk), S(sh + 1), Z(c.zBk)); D.line(lL, S(sh), Z(c.zHk), S(sh), Z(zb + H));
      D.text(lT, S(sh) + 1.4 * h, Z(c.zHk), 0.7 * h, U(`C${i + 1}: HOOK EL. ${fmt(c.zHk, 2)}, R ${fmt(c.R, 2)} FT, ${c.e.look.ok ? fmt(c.C, 0) + ' LB, ' + fmt(c.pct, 1) + ' %' : 'NOT PERMITTED'}, MARGIN ${c.margin == null ? 'N.R.' : fmt(c.margin, 2)} FT`)); });
    D.text(lT, S(s0), Z(Math.max(...q.cr.filter(Boolean).map(c => c.tip ? c.tip.z : c.zBk))) + 2 * h, 1.1 * h, U(`ELEVATION AT CRANE ${ci + 1}'S GOVERNING STEP ${j} (${T().where(q.x)}; GIRDER BOTTOM EL. ${fmt(zb, 2)}; TO SCALE)`));
    return true;
  }

  /* ---------- the data tables ---------- */
  const seeRef = (C, key) => { const r = C.ref && key ? C.ref(key) : null; return r ? `REPORT ${r}` : 'REPORT'; };
  function chartOf(ev, c) { const ids = [...new Set([ev.pick, ev.set, ev.gov].map(e => e.cfg && e.cfg.id).filter(Boolean))]; return ids.map(id => { const g = c.def.configs.find(x => x.id === id); return g ? (g.label || g.id) : id; }).join(' / ') || '-'; }
  function pickRows(C) {
    const { k, u, c, ev } = C.pick, h = ev.elev, rs = clrList(ev.c3 && ev.c3.results, 3), gr = groundSum([ev.ground]), cfg = ev.pick.cfg;
    const rows = [['CRANE', K().name(c.def) + (c.def.preliminary ? ' (PRELIMINARY DOCUMENT)' : '')], ['SETUP', u.name], ['CHART (CONFIG.)', chartOf(ev, c)], ['RATING BASIS', cfg ? K().ratingBasis(cfg, c.def).text : '-'],
      ['BOOM LENGTH', fmt(u.boom, 1) + ' FT'], ['LOAD / RIGGING / HOOK / OTHER', `${fmt(k.load || 0, 0)} / ${fmt(k.rigging || 0, 0)} / ${fmt(k.hook || 0, 0)} / ${fmt(k.ded || 0, 0)} LB`], ['TOTAL LOAD W', fmt(ev.W, 0) + ' LB'],
      ['PICK: R, C, % CHART', `${fmt(ev.pick.R, 2)} FT, ${ev.pick.look.ok ? fmt(ev.pick.C, 0) + ' LB, ' + fmt(ev.pick.pct, 1) + ' %' : 'NOT PERMITTED'}`],
      ['SET: R, C, % CHART', `${fmt(ev.set.R, 2)} FT, ${ev.set.look.ok ? fmt(ev.set.C, 0) + ' LB, ' + fmt(ev.set.pct, 1) + ' %' : 'NOT PERMITTED'}`],
      ['SWING', `${fmt(Math.abs(ev.path.d), 1)} DEG ${ev.path.d >= 0 ? 'CLOCKWISE' : 'COUNTER-CLOCKWISE'}, R MAX ${fmt(ev.path.Rmax, 2)} FT`],
      ['GOVERNING', `${ev.govWhere}${ev.gov.look.ok ? ': C ' + fmt(ev.gov.C, 0) + ' LB, ' + fmt(ev.gov.pct, 1) + ' %' : ''}`], ['STATUS', LF().CLS[ev.cls]]];
    if (h) { const t = p => p.ang && isNum(p.ang.theta) ? fmt(p.ang.theta, 1) : '-'; rows.push(['BOOM ANGLE PICK / SET', `${t(h.pick)} / ${t(h.set)} DEG`], ['TIP EL. PICK / SET', `${fmt(h.pick.zTip, 2)} / ${fmt(h.set.zTip, 2)} FT`], ['HOOK REACH MARGIN (LOWEST)', `${fmt(reachOf(ev), 2)} FT`]); }
    rs.forEach((r, i) => rows.push([i ? '' : 'CLOSEST 3D CLEARANCES', clrText({ name: r.name, type: r.type, d: r.gov.d, req: r.type === 'power' ? (isNum(r.D) ? r.D : 0) : r.req || 0, comp: r.gov.comp, crane: r.gov.crane })]));
    if (!rs.length) rows.push(['CLOSEST 3D CLEARANCES', 'NO POWER LINE / OBSTRUCTION DRAWN']);
    rows.push(['GROUND', gr && !gr.none ? `${gr.mode === 'rigid' ? 'ENTERED DATA' : 'ESTIMATE - VERIFY WITH THE MANUFACTURER\'S CALCULATOR'}; MAX ${kip(gr.load)} KIP (${gr.sup})${gr.ratio != null ? ', BEARING RATIO ' + fmt(gr.ratio, 2) : ''}` : 'NOT COMPUTED']);
    supportRows(C.pick.P, u).forEach((r, i) => rows.push([(i ? '' : 'SUPPORTS (X ALONG CARRIER, Y ACROSS, FROM CR): ') + r[0], r[1]]));
    (C.clrDims || []).forEach(r => rows.push(r));
    rows.push(['WORKED', `${seeRef(C, 'pick-' + k.id)} (LIFT); ${seeRef(C, 'gr-' + k.id)} (GROUND); ${seeRef(C, 'elev-' + k.id)} (ELEVATIONS)`]);
    return rows;
  }
  function tandemRows(C) {
    const { P, t, r } = C.tl, ob = r.sh.ob, gr = groundSum(r.ground ? r.ground.cr : []);
    const rows = [['LIFT', `${t.name}: ${r.single ? 'ONE CRANE' : 'TANDEM, LIMIT ' + fmt(r.lim, 0) + ' % OF CHART PER CRANE'}`], ['GIRDER', `L ${fmt(ob.L, 2)} FT, W_G ${fmt(ob.Wg, 0)} LB, X_CG ${fmt(ob.xcg, 2)} FT FROM END A${ob.pair ? ', PAIRED' : ''}`]];
    r.gov.forEach((g, i) => { const u = setupOf(P, t.slots[i]), c = craneOf(P, u), cf = g.c.e && g.c.e.cfg;
      rows.push([`CRANE ${i + 1}`, `${u ? u.name : '-'}: ${c ? K().name(c.def) : '-'}${c && c.def.preliminary ? ' (PRELIMINARY)' : ''}, BOOM ${fmt(u && u.boom, 1)} FT`],
        [`  CHART / RATING BASIS`, `${cf ? (cf.label || cf.id) : '-'} / ${cf && c ? K().ratingBasis(cf, c.def).text : '-'}`],
        [`  HOOK LOAD W${i + 1}`, `${fmt(r.sh.Wh[i], 0)} LB (GIRDER SHARE ${fmt(r.sh.R[i], 0)} LB)`],
        [`  GOVERNING STEP ${g.i}`, `${g.where}: R ${fmt(g.c.R, 2)} FT, ${g.c.e.look.ok ? 'C ' + fmt(g.c.C, 0) + ' LB, ' + fmt(g.c.pct, 1) + ' %' : 'NOT PERMITTED'} (${r.single ? LF().CLS[g.c.cls] : T().CLS[g.c.cls]})`],
        [`  HOOK REACH MARGIN`, g.reach ? (g.reach.m === -Infinity ? 'NOT REACHABLE' : fmt(g.reach.m, 2) + ' FT') : '-']); });
    rows.push(['PATH', `${r.steps.length} STEPS; PICK EL. ${fmt(r.path.zP, 2)}, TRAVEL EL. ${fmt(r.path.zT, 2)}, SET EL. ${fmt(r.path.zS, 2)}; ${(t.way || []).length} WAYPOINT(S)`]);
    if (r.cc) rows.push(['CRANE-CRANE', `${fmt(r.cc.d, 2)} FT (${r.cc.where})`]);
    clrList(r.clr, 3).forEach((c, i) => rows.push([i ? '' : 'CLOSEST 3D CLEARANCES', clrText({ name: c.name, type: c.type, d: c.gov.d, req: c.type === 'power' ? (isNum(c.D) ? c.D : 0) : c.req || 0, comp: c.gov.comp, crane: c.gov.crane }, r.single)]));
    rows.push(['GROUND', gr && !gr.none ? `${gr.mode === 'rigid' ? 'ENTERED DATA' : 'ESTIMATE - VERIFY WITH THE MANUFACTURER\'S CALCULATOR'}; MAX ${kip(gr.load)} KIP (${gr.sup})${gr.ratio != null ? ', BEARING RATIO ' + fmt(gr.ratio, 2) : ''}` : 'NOT COMPUTED']);
    rows.push(['WORKED', `${seeRef(C, 'tandem-' + t.id)} (LIFT, LOAD SHARE, GROUND)`]);
    return rows;
  }
  /* a view sheet: the plan, the elevations under it, the data table and the flags to the right */
  function viewSheet(D, C) {
    const h = D.h, i0 = D.mark(); C.planFn(D, C); let x = D.bbox(i0)[2] + 5 * h; const top = D.bbox(i0)[3];
    // 2026-11-17 (QA: the plan was small beside two tall elevations): the elevations stacked in one column right of the plan, so the
    // sheet scale (the same for plan and elevations) grows and the crane / outriggers read clearly
    let yTop = top;
    (C.elevs || []).forEach(fn => { const j0 = D.mark(); if (!fn(D, C)) { D.E.length = j0; return; } const b = D.bbox(j0);
      if (C.stackElev) { D.move(j0, x - b[0], yTop - b[3]); yTop = D.bbox(j0)[1] - 4 * h; } else { D.move(j0, x - b[0], top - b[3]); x = D.bbox(j0)[2] + 5 * h; } });
    const ba = D.bbox(i0), t0 = D.mark(), rows = C.rowsFn(C);
    let yy = table(D, D.layer('TBL', 8), D.layer('TEXT', 7), 0, 0, ['ITEM', 'VALUE'], rows, C.tableTitle || 'LIFT DATA').y;
    const fl = (C.flagText || []).concat((C.flags || []).filter(f => f.level !== 'info' && !f.p).map(f => f.text));
    yy = notesBlk(D, D.layer('TEXT', 7), 0, yy - h, fl.length ? 'FLAGS' : 'FLAGS: NONE', fl, 90);
    notesBlk(D, D.layer('TEXT', 7), 0, yy - h, 'NOTES', C.notes || [], 90);
    const bt = D.bbox(t0); D.move(t0, ba[0] - bt[0], ba[1] - 4 * h - bt[3]);
  }
  /* ---------- the rigging / load-share sheet of a girder lift ---------- */
  const stepText = s => { const tt = x => (window.SharedSteps && window.SharedSteps.toText ? window.SharedSteps.toText(x) : String(x || '')); const v = typeof s.value === 'number' ? fmt(s.value, s.d == null ? 2 : s.d) : String(s.value);
    return `${s.label}: ${tt(s.sym)}${s.eq ? ' = ' + tt(s.eq) : ''}${s.sub ? ' = ' + tt(s.sub) : ''} = ${v}${s.unit ? ' ' + s.unit : ''}`; };
  function rigging(D, C) {
    const { t, r } = C.tl, sh = r.sh, ob = sh.ob, h = D.h, L = ob.L, H = Math.max(ob.H || 0, 1);
    const lG = D.layer('GIRDER', 4), lA = D.layer('LOADS', 1), lD = D.layer('DIMS', 2), lT = D.layer('TEXT', 7), lC = D.layer('CNTR', 1, 'CENTER');
    const S = x => x * 12, yb = 0, yt = H * 12, ar = 8 * h;
    D.rect(lG, 0, yb, S(L), yt); if (ob.pair) D.text(lT, S(L / 2), yt + 0.6 * h, 0.75 * h, U(`PAIRED GIRDERS, SPACING ${fmt(ob.s, 2)} FT, CROSS-FRAMES ${fmt(ob.Wx, 0)} LB (ONE OBJECT)`), 1);
    D.text(lT, -0.8 * h, yb + yt / 2, 0.9 * h, 'END A', 2); D.text(lT, S(L) + 0.8 * h, yb + yt / 2, 0.9 * h, 'END B', 0);
    // CG and the weight
    const xc = S(ob.xcg); D.line(lC, xc, yb - ar, xc, yt + 0.5 * h, D.ltype('CENTER')); D.circle(lA, xc, yt / 2, 0.8 * h); D.line(lA, xc, yb, xc, yb - ar); D.pline(lA, [[xc, yb - ar], [xc - 0.5 * h, yb - ar + h], [xc + 0.5 * h, yb - ar + h]], true);
    D.text(lT, xc + 0.8 * h, yb - ar + 0.3 * h, 0.85 * h, U(`W_G = ${fmt(ob.Wg, 0)} LB AT THE CG`));
    // lifting points: the girder reactions up, the hook loads above
    sh.xs.forEach((x, i) => { if (r.single && i) return; const xx = S(x); D.line(lA, xx, yt, xx, yt + ar); D.pline(lA, [[xx, yt + ar], [xx - 0.5 * h, yt + ar - h], [xx + 0.5 * h, yt + ar - h]], true);
      D.text(lT, xx, yt + ar + 0.8 * h, 0.85 * h, U(`${r.single ? 'HOOK' : 'LIFTING POINT ' + (i + 1)}: R${i + 1} = ${fmt(sh.R[i], 0)} LB`), 1);
      D.text(lT, xx, yt + ar + 2.1 * h, 0.85 * h, U(`HOOK ${i + 1}: W${i + 1} = ${fmt(sh.Wh[i], 0)} LB`), 1); });
    D.fmt = v => fmt(v / 12, 2) + "'";
    let yd = yb - ar - 2.5 * h; [ob.xcg].concat(r.single ? [] : sh.xs).concat([L]).map(x => S(x)).sort((a, b) => a - b).forEach(xx => { D.dimH(lD, 0, xx, yd, yb); yd -= 2.2 * h; });
    D.fmt = X_().fmtFtIn;
    // the worked values (engine/tandem.js share(): the same steps as the card and the Report)
    const lines = sh.steps.map(stepText); let y = yd - 2 * h;
    y = notesBlk(D, lT, 0, y, 'LOAD SHARE (HOOKS PLUMB, GIRDER LEVEL; ENGINE VALUES)', lines, 120);
    const hk = t.hooks.slice(0, nC(t)).map((q, i) => [`HOOK ${i + 1}`, r.single ? 'OVER THE CG' : fmt(q.s, 2) + ' FT', fmt(sh.R[i], 0), fmt(q.rig || 0, 0), fmt(q.hook || 0, 0) + (q.hookLabel ? ' (' + q.hookLabel + ')' : ''), fmt(q.ded || 0, 0), fmt(sh.Wh[i], 0), fmt(q.rigH || 0, 2), fmt(q.blk || 0, 2)]);
    table(D, D.layer('TBL', 8), lT, 0, y - h, ['HOOK', 'X FROM END A', 'R GIRDER (LB)', 'RIGGING (LB)', 'BLOCK (LB)', 'OTHER (LB)', 'W HOOK (LB)', 'RIGGING HT (FT)', 'BLOCK HT (FT)'], hk, `RIGGING AND HOOK LOADS. WORKED: ${seeRef(C, 'tandem-' + t.id)}`);
  }

  /* ---------- the ground sheet ---------- */
  /* every crane setup's supports over the lifts it makes (single picks and girder lifts): the largest load per float / track */
  function groundModel(P, ctx) {
    const per = new Map();   // setup id -> [{ name, g }]
    (P.picks || []).forEach(k => { const u = setupOf(P, k.setupId); if (!u || !craneOf(P, u)) return; const ev = ctx.evalPick(k); if (ev && ev.ground) (per.get(u.id) || per.set(u.id, []).get(u.id)).push({ name: k.name, key: 'gr-' + k.id, g: ev.ground }); });
    (P.tandems || []).forEach(t => { const r = ctx.evalT && ctx.evalT(t); if (!r || !r.ground) return; r.ground.cr.forEach((g, i) => { const id = t.slots[i]; if (!setupOf(P, id)) return; (per.get(id) || per.set(id, []).get(id)).push({ name: `${t.name} (crane ${i + 1})`, key: 'tandem-' + t.id, g, pair: r.ground.pair }); }); });
    const out = [];
    per.forEach((list, id) => { const u = setupOf(P, id), ok = list.filter(x => x.g.mode !== 'none');
      if (!ok.length) { out.push({ u, none: list[0].g.why, list }); return; }
      const S = ok[0].g.S, tr = S.kind === 'crawler';
      const sup = S.items.map((it, i) => { let b = null; ok.forEach(x => { const m = x.g.max[i], v = tr ? m.q : m.load; if (!b || v > b.v) b = { v, m, br: x.g.bear[i], x }; }); return Object.assign({ it, i }, b); });
      out.push({ u, S, sup, list, est: ok.some(x => x.g.mode === 'estimate'), qa: ok[0].g.qa, mat: ok[0].g.mat }); });
    return out;
  }
  /* one plan panel per setup (its floats / tracks, mats and the largest load on each, labelled outward) */
  function groundPanel(D, C, gs) {
    const { P } = C.gr, h = D.h, lT = D.layer('TEXT', 7), lF = D.layer('CRANE-FLOAT', 30), c = craneOf(P, gs.u), pts = [gs.u];
    if (c) { const f = LF().footprint(c.def, gs.u); f.floatC.forEach(q => pts.push({ x: q.x - 4, y: q.y - 4 }, { x: q.x + 4, y: q.y + 4 })); [].concat(f.body ? [f.body] : [], f.tracks).forEach(q => pts.push(...q)); }
    const w = windowOf(pts, 0.35), V = pv(w);
    siteLayer(D, V, P); setupLayer(D, V, P, gs.u, hookOf(P, gs.u));
    (gs.sup || []).forEach(x => { const p = LF().toGrid(gs.u, x.it.lx, x.it.ly); if (!inWin(p, w)) return;
      if (gs.S.kind === 'crawler') { const rect = [[gs.S.Lt / 2, x.it.ly + gs.S.s / 2], [gs.S.Lt / 2, x.it.ly - gs.S.s / 2], [-gs.S.Lt / 2, x.it.ly - gs.S.s / 2], [-gs.S.Lt / 2, x.it.ly + gs.S.s / 2]].map(([a, b]) => LF().toGrid(gs.u, a, b)); drawPoly(D, V, lF, rect, true); }
      const dx = p.x - gs.u.x, dy = p.y - gs.u.y, L = Math.hypot(dx, dy) || 1, right = dx >= 0, yo = dy >= 0 ? 1.6 * h : -2.4 * h;
      D.text(lT, V.X(p.x) + (right ? 1 : -1) * 1.2 * h, V.Y(p.y) + yo, 0.7 * h, U(`${x.it.id}: ${kip(x.m.load)} KIP`), right ? 0 : 2);
      D.text(lT, V.X(p.x) + (right ? 1 : -1) * 1.2 * h, V.Y(p.y) + yo - 1.1 * h, 0.7 * h, U(`Q_G ${fmt(x.br && x.br.qg, 0)} PSF${x.br && x.br.ratio != null ? ' (' + fmt(x.br.ratio, 2) + ')' : ''}${gs.est ? ' EST.' : ''}`), right ? 0 : 2); void L; });
    frameLayer(D, V, P, `GROUND: ${gs.u.name}`);
  }
  function groundTables(D, C) {
    const { P, gm } = C.gr, h = D.h, lL = D.layer('TBL', 8), lT = D.layer('TEXT', 7), MT = (GR() && GR().MAT_TYPES) || {};
    const rows = [], mats = [], dz = [];
    gm.forEach(s => {
      if (!s.sup) { rows.push([s.u.name, '-', 'NOT COMPUTED: ' + String(s.none || '').slice(0, 70), '', '', '', '', '', '', '', '']); return; }
      s.sup.forEach(x => rows.push([s.u.name, `${x.it.id} (${x.it.name})`, kip(x.m.load), s.S.kind === 'crawler' ? fmt(x.m.q, 0) : '-', x.x.name, fmt(x.m.theta, 0), fmt(x.m.R, 2), fmt(x.br && x.br.qg, 0), s.qa ? fmt(s.qa, 0) : 'NOT ENTERED', x.br && x.br.ratio != null ? fmt(x.br.ratio, 2) : '-',
        `${x.br && isNum(x.br.rM) ? fmt(x.br.rM, 2) : '-'} / ${x.br && isNum(x.br.rV) ? fmt(x.br.rV, 2) : '-'}`, s.est ? 'ESTIMATE' : 'ENTERED DATA']));
      const m = s.mat; mats.push([s.u.name, MT[m.type] || m.type, m.type === 'none' ? '-' : `${fmt(m.B, 2)}${s.S.kind === 'crawler' ? '' : ' X ' + fmt(m.L, 2)} FT X ${fmt(m.t, 2)} IN`,
        m.type === 'timber' ? `FB' ${fmt(m.Fb, 0)} PSI, FV' ${fmt(m.Fv, 0)} PSI` : m.type === 'steel' ? `FY ${fmt(m.Fy, 0)} KSI` : '-', m.type === 'none' ? '-' : `${fmt(m.gamma, 0)} PCF (${m.gFrom})`, m.type === 'none' ? '-' : fmt(m.k, 2) + ' : 1', s.qa ? `${fmt(s.qa, 0)} PSF (${fmt(s.qa / 1000, 2)} KSF)` : 'NOT ENTERED']);
      s.list.forEach(x => { if (x.g.mode === 'none') return; x.g.depth.forEach(d => dz.push([x.name, d.name, d.none ? '-' : fmt(d.z, 2), d.none ? String(d.none).slice(0, 50) : fmt(d.ds, 0), d.none || d.far ? '-' : fmt(d.theta, 0), d.cap ? fmt(d.cap, 0) : 'NOT ENTERED', d.ratio == null ? '-' : fmt(d.ratio, 2), 'THIS CRANE'])); });
    });
    const pairs = new Set(); gm.forEach(s => s.list.forEach(x => { if (!x.pair || pairs.has(x.key)) return; pairs.add(x.key); x.pair.filter(d => !d.none && !d.far).forEach(d => dz.push([x.name.replace(/ \(crane \d\)$/, ''), d.name, Array.isArray(d.z) ? d.z.map(v => fmt(v, 2)).join(' / ') : fmt(d.z, 2), fmt(d.ds, 0), 'STEP ' + d.j, d.cap ? fmt(d.cap, 0) : 'NOT ENTERED', d.ratio == null ? '-' : fmt(d.ratio, 2), 'BOTH CRANES (SUM)'])); }));
    let y = table(D, lL, lT, 0, 0, ['SETUP', 'FLOAT / TRACK', 'LOAD (KIP)', 'Q MAX TRACK (PSF)', 'GOVERNING LIFT', 'SLEW (DEG)', 'R (FT)', 'Q_G (PSF)', 'Q_A (PSF)', 'Q_G / Q_A', 'MAT M / V RATIOS', 'METHOD'], rows, 'FLOAT / TRACK LOADS AND BEARING (LARGEST OVER THE LIFTS OF EACH SETUP)').y;
    y = table(D, lL, lT, 0, y - h, ['SETUP', 'MAT', 'SIZE', 'MATERIAL', 'UNIT WEIGHT', 'SPREAD', 'ALLOWABLE BEARING'], mats, 'MAT SPECIFICATION AND ALLOWABLE BEARING PRESSURE').y;
    const loc = []; gm.forEach(s => supportRows(P, s.u).forEach(r => loc.push([s.u.name, r[0], r[1]])));
    if (loc.length) y = table(D, lL, lT, 0, y - h, ['SETUP', 'SUPPORT', 'LOCATION (X ALONG CARRIER, Y ACROSS, FROM THE CENTRE OF ROTATION; STATE PLANE)'], loc, 'FLOAT / TRACK LOCATIONS (STAKE-OUT)').y;
    if (dz.length) y = table(D, lL, lT, 0, y - h, ['LIFT', 'BURIED ITEM', 'Z (FT)', 'DELTA SIGMA_Z (PSF)', 'SLEW / STEP', 'ALLOWABLE (PSF)', 'RATIO', 'FROM'], dz, 'STRESS AT DEPTH (BOUSSINESQ)').y;
    notesBlk(D, lT, 0, y - h, 'NOTES', ['METHOD: "ENTERED DATA" = RIGID-BODY STATICS WITH THE WEIGHTS AND CGS ON THE CRANE CARD; "ESTIMATE" = THE BOUNDING ESTIMATE: VERIFY WITH THE MANUFACTURER\'S OUTRIGGER CALCULATOR.',
      `WORKED: ${seeRef(C, 'ground')} (SINGLE PICKS) AND ${seeRef(C, 'tandem')} (GIRDER LIFTS); BASIS ${seeRef(C, 'ground-basis')}.`, 'ALLOWABLE BEARING PRESSURES FROM THE GEOTECHNICAL ENGINEER (GROUND INPUT TAB).'], 110);
  }
  function groundSheet(D, C) {
    const h = D.h, i0 = D.mark(); let x = 0, top = null;
    C.gr.gm.forEach(gs => { const j0 = D.mark(); groundPanel(D, C, gs); const b = D.bbox(j0); if (top == null) top = b[3]; D.move(j0, x - b[0], top - b[3]); x = D.bbox(j0)[2] + 5 * h; });
    const bp = D.bbox(i0), t0 = D.mark(); groundTables(D, C); const bt = D.bbox(t0); D.move(t0, bp[0] - bt[0], bp[1] - 4 * h - bt[3]);
  }

  /* ---------- the trucking route sheet (C6: engine/route.js evaluate through CranePickRouteUI.evalRoute) ---------- */
  function routePlan(D, C) {
    const { P, rt, ev, w } = C.ro, V = pv(w), h = D.h, RT = window.CranePickRoute, lS = D.layer('ROUTE-SWEPT', 9), lP = D.layer('ROUTE-PATH', 4, 'CENTER'), lV = D.layer('ROUTE-VEHICLE', 5), lL = D.layer('ROUTE-LOAD', 1), lM = D.layer('ROUTE-MARK', 6), lT = D.layer('TEXT', 7);
    siteLayer(D, V, P);
    (P.routeMarks || []).forEach(m => { if (m.pts.length === 1) { drawCircle(D, V, lM, m.pts[0], Math.max(m.w || 2, 1)); if (inWin(m.pts[0], w)) D.text(lT, V.X(m.pts[0].x) + h, V.Y(m.pts[0].y), 0.7 * h, U(`${m.name || m.type}${isNum(m.h) ? ' H ' + fmt(m.h, 2) + ' FT' : ''}`)); }
      else { drawPoly(D, V, lM, m.pts, false); const q = m.pts.find(p => inWin(p, w)); if (q) D.text(lT, V.X(q.x) + h, V.Y(q.y) + 0.5 * h, 0.7 * h, U(`${m.type === 'bridge' ? 'POSTED BRIDGE' : m.type === 'haul' ? 'HAUL ROAD' : 'OVERHEAD'}: ${m.name || ''}`)); } });
    const sw = RT.swept(ev.sim, Math.max(2, ev.sim.pa.L / 120)); sw.rings.forEach(q => drawPoly(D, V, lS, q, true));
    drawPoly(D, V, lP, ev.sim.dense.filter(q => q.s >= 0), false, D.ltype('CENTER'));
    ev.sim.samples[ev.sim.samples.length - 1].parts.forEach(pp => drawPoly(D, V, pp.part === 'load' ? lL : lV, pp.poly, true));
    // turn labels on the outside of each curve (away from its centre: right of the path for a left turn)
    (ev.turns || []).forEach(t => { const m = RT.at(ev.sim.pa, (t.s0 + t.s1) / 2); if (!m || !inWin(m, w)) return; const sg = t.D > 0 ? -1 : 1, nx = -Math.sin(m.th) * sg, ny = Math.cos(m.th) * sg, off = 3 * h;
      D.text(lT, V.X(m.x) + nx * off, V.Y(m.y) + ny * off - 0.35 * h, 0.8 * h, t.tag ? `${t.tag} R ${fmt(t.r, 0)}` : `T${t.n}`, 1); });   // 2026-11-17: fitted alignment: C1 / T1 with the radius
    if (rt.src && rt.src.kind === 'osm') D.text(lT, V.X(w.x0) + h, V.Y(w.y0) + h, 0.7 * h, 'ROAD GEOMETRY FROM OPENSTREETMAP - NOT SURVEY. (C) OPENSTREETMAP CONTRIBUTORS, ODBL.');   // ODbL attribution on the printed sheet
    const st = ev.stage; if (st && st.cg && inWin(st.cg, w)) { const x = V.X(st.cg.x), y = V.Y(st.cg.y); D.circle(lL, x, y, 0.7 * h); D.text(lT, x + 1.2 * h, y - 0.3 * h, 0.7 * h, 'LOAD CG AT THE STOP'); }
    frameLayer(D, V, P, `PLAN: ${rt.name}`);
  }
  function routeTables(D, C) {
    const { P, rt, ev, row } = C.ro, h = D.h, lL = D.layer('TBL', 8), lT = D.layer('TEXT', 7), RT = window.CranePickRoute, v = RT.vehOf(rt, P), l = RT.loadOf(rt, P);
    let y = table(D, lL, lT, 0, 0, ['ITEM', 'VALUE'], [['VEHICLE', RT.TYPES[v.type]], ['LOAD', `${fmt(l.L, 2)} X ${fmt(l.B, 2)} FT, ${fmt(l.W, 0)} LB, HEIGHT ${fmt(l.h, 2)} FT ON A ${fmt(v.hDeck, 2)} FT DECK${ev.oh && ev.oh.hB > 0 ? ` + ${fmt(ev.oh.hB, 2)} FT BLOCKING` : ''}${ev.oh ? `: TOP ${fmt(ev.oh.LT, 2)} FT` : ''}`],
      ['DELIVERS TO', row.to ? row.to.name : '-'], ['ROUTE LENGTH', fmt(ev.sim.pa.L, 1) + ' FT'], ['MAX OFF-TRACKING', fmt(ev.otMax, 2) + ' FT'], ['GROSS WEIGHT', `${fmt(ev.ax.gross, 0)} LB (${fmt(ev.ax.gross / RT.LB_PER_TON, 2)} T)`],
      ['LEAST OVERHEAD CLEARANCE', row.oh ? row.oh.text : '-'], ['WORKED', seeRef(C, row.key)]], 'ROUTE DATA').y;
    if ((ev.turns || []).length) y = table(D, lL, lT, 0, y - h, ['TURN', 'DELTA (DEG)', 'R (FT)', 'OT MAX (FT)', 'R INSIDE (FT)', 'R OUTSIDE (FT)', 'SWEPT WIDTH (FT)'], ev.turns.map(t => [`T${t.n}`, fmt(t.D * 180 / Math.PI, 1), fmt(t.r, 1) + (t.reduced ? ' *' : ''), fmt(t.ot, 2), fmt(t.Rin, 2), fmt(t.Rout, 2), fmt(t.Rout - t.Rin, 2)]), 'TURNS (SWEPT PATH)').y;
    y = table(D, lL, lT, 0, y - h, ['AXLE GROUP', 'LOAD (LB)', 'AXLES', 'PER AXLE (LB)', 'PER TYRE (LB)'], ev.ax.groups.map(g => [g.label, fmt(g.load, 0), String(g.n), fmt(g.perAxle, 0), fmt(g.perTyre, 0)]), `AXLE LOADS (${ev.ax.mode})`).y;
    if (ev.oh.list.length) y = table(D, lL, lT, 0, y - h, ['OVERHEAD ITEM', 'KIND', 'HEIGHT (FT)', 'CLEARANCE (FT)', 'RESULT'], ev.oh.list.map(o => [o.name, o.kind === 'power' ? 'POWER LINE (TABLE T)' : 'OVERHEAD', fmt(o.kind === 'power' ? o.hw : o.h, 2), o.kind === 'power' ? `${fmt(o.d, 2)} VS D_T ${fmt(o.DT, 0)}` : fmt(o.c, 2), o.flag ? o.flag.level : 'OK']), 'OVERHEAD CLEARANCES').y;
    if (ev.br.length) y = table(D, lL, lT, 0, y - h, ['POSTED BRIDGE', 'CHECKS (VALUE / POSTING, T)', 'RESULT'], ev.br.map(b => [b.name, b.checks.length ? b.checks.map(c => `${c.what} ${fmt(c.val, 2)} / ${fmt(c.limit, 2)}`).join('; ') : 'NO POSTING ENTERED', b.ok ? 'OK' : 'SEE FLAGS']), 'POSTED BRIDGES ON THE ROUTE').y;
    const fl = ev.flags.filter(f => f.level !== 'info').map(f => f.text);
    y = notesBlk(D, lT, 0, y - h, fl.length ? 'FLAGS' : 'FLAGS: NONE', fl, 100);
    notesBlk(D, lT, 0, y - h, 'NOTES', ['SWEPT PATH: LOW-SPEED KINEMATIC OFF-TRACKING OF THE DRAWN STEER-AXLE PATH (OUTLINES OF THE TRACTOR, BODY / DOLLY AND LOAD); VEHICLE DRAWN AT THE TRUCK STOP.',
      ...(window.CranePickTruckGfx && ev.geo ? ['THE VEHICLE AND LOAD TO SCALE (PLAN, SIDE ELEVATION, DIMENSIONS, AXLE-GROUP LOADS): THE NEXT SHEET, "' + U(rt.name) + ' - VEHICLE AND LOAD".'] : []),
      `STAGING AND THE LIFT IT DELIVERS TO: ${seeRef(C, row.to && row.to.key)}. VALUES: THE APP'S ENGINE (ROUTE TAB, REPORT).`], 100);
  }
  /* 2026-11-17: the vehicle carrying its load, to scale (engine/truckgfx.js: the drawing of the map vehicle, the Route tab and the Report):
     plan and side elevation at 1 FT = 12 units with a scale bar, the geometry table */
  function routeVehSheet(D, C) {
    const { P, rt, ev, row } = C.ro, h = D.h, TG = window.CranePickTruckGfx, RT = window.CranePickRoute, lT = D.layer('TEXT', 7), lL = D.layer('TBL', 8), m = TG.model(rt, P, ev), pl = TG.plan(m), sd = TG.side(m), g = ev.geo, v = m.v, l = m.l;
    const bp = TG.bounds(pl.prims), bs = TG.bounds(sd.prims), gap = 6 * h;
    D.text(lT, bp.x0 * 12, bp.y1 * 12 + 1.5 * h, 1.1 * h, U(`PLAN: ${rt.name} - ${RT.TYPES[v.type]} (TO SCALE, FRONT TO THE RIGHT)`));
    TG.dxf(D, pl, { x0: 0, y0: 0 });
    const ys = bp.y0 * 12 - gap - bs.y1 * 12; D.text(lT, bs.x0 * 12, ys + bs.y1 * 12 + 1.5 * h, 1.1 * h, 'SIDE ELEVATION (TO SCALE)');
    TG.dxf(D, sd, { x0: 0, y0: ys });
    TG.dxfScale(D, bs.x0 * 12, ys + bs.y0 * 12 - 3 * h, bs.x1 - bs.x0);
    const rows = [['BODY WHEELBASE L2', `${fmt(v.L2, 2)} FT ${v.L2src === 'load' ? `(FROM THE LOAD: ${fmt(v.L2calc.L, 2)} - ${fmt(v.L2calc.fF, 2)} - ${fmt(v.L2calc.r, 2)})` : '(' + U(v.L2src) + ')'}`], ['LOAD FRONT AHEAD OF THE HITCH', fmt(g.f, 2) + ' FT'],
      ...(RT.steered(v) ? [] : [['DECK LENGTH', `${fmt(g.Ldeck, 2)} FT VS LOAD ${fmt(l.L, 2)} FT (OVERHANG FRONT ${fmt(g.oF, 2)}, REAR ${fmt(g.oR, 2)})`]]), ['REAR OVERHANG BEYOND THE ' + (RT.steered(v) ? 'REAR DOLLY' : 'DECK'), `${fmt(g.oRear, 2)} FT (LIMIT ${fmt(g.lim, 2)} FT)`],
      ['HITCH TO THE BACK OF THE CAB', `${fmt(g.cCab, 2)} FT${v.from.cab === 'default' ? ' (CAB POSITION ASSUMED)' : ''}`], ['LOAD TOP ABOVE THE ROAD', `${fmt(ev.oh.LT, 2)} FT = DECK ${fmt(v.hDeck, 2)} + BLOCKING ${fmt(ev.oh.hB, 2)} + LOAD ${fmt(l.h, 2)}`], ['HEIGHT FOR THE OVERHEAD CHECKS', fmt(ev.oh.Htop, 2) + ' FT'],
      ['OVERALL L X W X H', `${fmt(g.Lov, 2)} X ${fmt(g.Wov, 2)} X ${fmt(g.Hov, 2)} FT`], ['MIN. TURNING RADIUS', fmt(v.Rmin, 1) + ' FT (INPUT)'], ['WORKED', seeRef(C, row.key)]];
    const y = table(D, lL, lT, bp.x1 * 12 + gap, bp.y1 * 12, ['ITEM', 'VALUE'], rows, 'VEHICLE AND LOAD').y;
    notesBlk(D, lT, bp.x1 * 12 + gap, y - h, 'NOTES', ['OUTLINES OF THE TRACTOR, JEEP, DECK / DOLLY AND LOAD AS THE SWEPT PATH USES THEM; AXLE-GROUP LOADS FROM THE ROUTE STATICS; HEIGHTS AS THE OVERHEAD CHECKS USE THEM.',
      'SCHEMATIC: AXLES 4.5 FT APART ABOUT EACH GROUP CENTRE, TYRES 3.4 X 0.9 FT, FRAME AND CAB.'], 90);
  }
  function routeSheet(D, C) { const h = D.h, i0 = D.mark(); routePlan(D, C); const bp = D.bbox(i0), t0 = D.mark(); routeTables(D, C); const bt = D.bbox(t0); D.move(t0, bp[2] + 4 * h - bt[0], bp[3] - bt[3]); }

  /* ---------- the cover and the general notes ---------- */
  function coverBlocks(P, sum, list, miss, date) {
    const t = P.title || {};
    const head = { t: 'head', lines: [[3, t.name || 'CRANE LIFT PLAN'], [1.6, 'CRANE LIFT PLAN DRAWINGS: LIFT-PLANNING AID'], ...(t.location ? [[1, t.location]] : []), ...(t.number ? [[1, `PROJECT NO. ${t.number}`]] : []), ...(t.client ? [[1, `CLIENT / OWNER: ${t.client}`]] : []),
      [1, `${sum.filter(r => r.kind === 'pick').length} SINGLE PICK(S), ${sum.filter(r => r.kind === 'tandem').length} GIRDER LIFT(S), ${sum.filter(r => r.kind === 'route').length} TRUCKING ROUTE(S)`]] };
    const sheetOf = id => { const s = list.find(q => q[2] === id); return s ? String(s[0]) : '-'; };
    const rts = sum.filter(r => r.kind === 'route').map(r => [r.name, r.to ? r.to.name : '-', r.missing ? String(r.missing).slice(0, 60) : r.worst === 'ok' ? 'NONE' : String(r.worst).toUpperCase(), r.missing ? '-' : fmt(r.gross, 0), r.missing ? '-' : fmt(r.otMax, 2), r.oh ? r.oh.text.slice(0, 60) : '-', `${r.flags.stop} STOP / ${r.flags.warn} CHECK`, sheetOf('route-' + r.i)]);
    const rows = []; sum.filter(r => r.kind !== 'route').forEach(r => { if (r.missing) { rows.push([r.name, '-', r.missing.slice(0, 60), '', '', '', '', '', sheetOf(r.kind === 'pick' ? 'lift-' + r.id : 'tlift-' + r.id)]); return; }
      r.cranes.forEach((c, i) => rows.push([i ? '' : r.name, `${r.kind === 'pick' ? 'SINGLE' : r.single ? 'GIRDER, 1 CRANE' : 'TANDEM C' + (i + 1)}: ${c.setup}`, pctText(c), c.clsText, i ? '' : clrText(r.clr, r.single).slice(0, 70), i ? '' : grText(r.ground), i ? '' : r.ground && r.ground.ratio != null ? fmt(r.ground.ratio, 2) : '-', i ? '' : `${r.flags.stop} STOP / ${r.flags.warn} CHECK`, sheetOf(r.kind === 'pick' ? 'lift-' + r.id : 'tlift-' + r.id)])); });
    return [head, { t: 'table', title: 'SHEET INDEX', cols: ['SHEET', 'TITLE'], rows: list.map(([n, tt]) => [String(n), tt]) },
      { t: 'table', title: 'LIFT SUMMARY (GOVERNING % OF CHART PER CRANE)', cols: ['LIFT', 'TYPE: CRANE SETUP', '% CHART', 'STATUS', 'CLOSEST CLEARANCE', 'MAX FLOAT / TRACK LOAD', 'BEARING RATIO', 'FLAGS', 'SHEET'], rows: rows.length ? rows : [['NO LIFT YET', '', '', '', '', '', '', '', '']] },
      ...(rts.length ? [{ t: 'table', title: 'TRUCKING ROUTES', cols: ['ROUTE', 'DELIVERS TO', 'WORST FLAG', 'GROSS (LB)', 'MAX OFF-TRACKING (FT)', 'LEAST OVERHEAD CLEARANCE', 'FLAGS', 'SHEET'], rows: rts }] : []),
      ...(miss.length ? [{ t: 'table', title: 'DRAWINGS NOT IN THIS SET', cols: ['NOT GENERATED', 'REASON'], rows: miss.map(q => [q[0], String(q[1]).slice(0, 90)]) }] : []),
      { t: 'table', title: 'REVISIONS', cols: ['REV.', 'DATE', 'DESCRIPTION', 'BY'], rows: [[t.rev || '0', t.date || date, 'ISSUED FROM CRANE PICK ANALYZER (LIFT-PLANNING AID)', t.by || ''], ['', '', '', ''], ['', '', '', '']] }];
  }
  function notesBlocks(P, ctx) { return [{ t: 'notes', title: 'GENERAL NOTES', lines: notesModel(P, ctx).map(n => `${n.topic}: ${n.text}`), wc: 110 }]; }

  /* ---------- the aerial site plan (2026-11-17, engineer request B) ---------- */
  /* aerialPlan(D, C): the plan window C.ae.w with everything of the project in it (or of one lift, C.ae.only): plan-sheet outlines, site
     items, power-line D_min buffers (siteLayer), each crane symbol (turned to its first pick, or a girder lift's governing hook), the booms
     to the pick / set, the swing paths, P / S, the girder at the pick and the set with its path, the routes (path and swept outline), the
     frame with grid ticks, the north arrow and the scale bar, the imagery attribution and the DXF note. The image itself is not in the
     DXF (R12 has no images): ui/aerial.js draws it under the sheet's plan window (C.aerial: the frame entity, moved with the sheet). */
  function aerialPlan(D, C) {
    const { P, w, ctx, only, title } = C.ae, V = pv(w), h = D.h, lT = D.layer('TEXT', 7), lP = D.layer('POINT', 5), lS = D.layer('SWING', 4), lB = D.layer('BOOM', 7), lBs = D.layer('BOOM-SET', 7, 'DASHED');
    const has = (kind, id) => !only || (only[kind] || []).includes(id);
    siteLayer(D, V, P);
    const RT = window.CranePickRoute;
    if (RT && !only) (P.routes || []).forEach(r => { let ev = null; try { ev = ctx.evalRoute && ctx.evalRoute(r); } catch (e) { ev = null; } if (!ev || !ev.sim || !ev.sim.dense) return;
      const sw = RT.swept(ev.sim, Math.max(2, ev.sim.pa.L / 120)); sw.rings.forEach(q => drawPoly(D, V, D.layer('ROUTE-SWEPT', 9), q, true));
      drawPoly(D, V, D.layer('ROUTE-PATH', 4, 'CENTER'), ev.sim.dense.filter(q => q.s >= 0), false, D.ltype('CENTER'));
      const m = ev.sim.dense.find(q => q.s >= 0 && inWin(q, w)); if (m) D.text(lT, V.X(m.x) + h, V.Y(m.y) + 0.5 * h, 0.75 * h, U(`ROUTE: ${r.name}`)); });
    const drawn = new Set();
    (P.picks || []).forEach(k => { if (!has('picks', k.id)) return; const u = setupOf(P, k.setupId); if (!u || !craneOf(P, u)) return; let ev = null; try { ev = ctx.evalPick(k); } catch (e) { ev = null; }
      if (!drawn.has(u.id)) { drawn.add(u.id); setupLayer(D, V, P, u, { hook: k.pick, load: loadOf(k) }); }
      const seg = (l, a, b, lt) => { const c = clip(a, b, w); if (c) D.line(l, V.X(c[0].x), V.Y(c[0].y), V.X(c[1].x), V.Y(c[1].y), lt); };
      seg(lB, u, k.pick); seg(lBs, u, k.set, D.ltype('DASHED')); if (ev && ev.path) drawPoly(D, V, lS, ev.path.pts, false);
      mark(D, V, lP, k.pick, 'P', lT); mark(D, V, lP, k.set, 'S', lT); if (inWin(k.pick, w)) D.text(lT, V.X(k.pick.x) + 1.4 * h, V.Y(k.pick.y) + 0.6 * h, 0.75 * h, U(k.name)); });
    (P.tandems || []).forEach(t => { if (!has('tandems', t.id)) return; let r = null; try { r = ctx.evalT && ctx.evalT(t); } catch (e) { r = null; }
      t.slots.slice(0, nC(t)).forEach((id, i) => { const u = setupOf(P, id); if (!u || drawn.has(u.id) || !craneOf(P, u)) return; drawn.add(u.id); const g = r && r.gov && r.gov[i], q = g && r.steps[g.i], cr = q && q.cr[i]; setupLayer(D, V, P, u, { tag: `CRANE ${i + 1}`, hook: cr && cr.p }); });
      if (!r || !r.sh) return; const ob = r.sh.ob, pose = (q, l) => { const o = T().outline(t, q, ob); drawPoly(D, V, l, o.box, o.box.length > 2); o.lines.forEach(ln => drawPoly(D, V, l, ln, false)); };
      pose(Object.assign({ z: r.path.zP }, t.pick), D.layer('GIRDER', 4)); pose(Object.assign({ z: r.path.zS }, t.set), D.layer('GIRDER-SET', 3));
      if (r.steps.length > 1) drawPoly(D, V, D.layer('PATH', 6, 'DASHED'), r.steps.map(q => ({ x: q.x.pose.x, y: q.x.pose.y })), false, D.ltype('DASHED'));
      if (inWin(t.set, w)) D.text(lT, V.X(t.set.x) + 1.2 * h, V.Y(t.set.y) - 2 * h, 0.75 * h, U(`GIRDER LIFT: ${t.name}`)); });
    if (!only) (P.setups || []).forEach(u => { if (!drawn.has(u.id) && craneOf(P, u)) setupLayer(D, V, P, u); });
    const i0 = D.mark(); frameLayer(D, V, P, title || 'SITE PLAN - AERIAL'); C.aerial = { e: D.E[i0], w, h };
    const X0 = V.X(w.x0), Y0 = V.Y(w.y0), AE = window.CranePickAerial, at = AE ? AE.ATTR : 'Tiles (c) Esri - Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community';
    D.text(lT, X0, Y0 - 4.0 * h, 0.7 * h, U(`AERIAL BACKGROUND: ESRI WORLD IMAGERY. ${at}. IMAGERY DATE VARIES; NOT A SURVEY.`));
    D.text(lT, X0, Y0 - 5.1 * h, 0.7 * h, U('DXF (R12) HAS NO IMAGES: ATTACH THE AERIAL PNG WITH ITS WORLD FILE (.PGW, IN THESE DXF COORDINATES) FROM THE DRAWINGS TAB, "DOWNLOAD AERIAL IMAGE".'));
  }
  /* the windows of the aerial sheets: the whole site (every setup with its tail circle and floats, picks, swing paths, girder poses,
     routes, site items), and one per lift (the lift plan's own window) */
  function siteWindow(P, ctx) {
    const pts = [];
    (P.setups || []).forEach(u => { const c = craneOf(P, u); if (!c) return; pts.push(u); const f = LF().footprint(c.def, u); if (isNum(f.tail)) pts.push({ x: u.x - f.tail, y: u.y - f.tail }, { x: u.x + f.tail, y: u.y + f.tail }); f.floatC.forEach(q => pts.push(q)); });
    (P.picks || []).forEach(k => { pts.push(k.pick, k.set); let ev = null; try { ev = ctx.evalPick(k); } catch (e) { ev = null; } if (ev && ev.path) pts.push(...ev.path.pts); });
    (P.tandems || []).forEach(t => pts.push(t.pick, t.set));
    (P.routes || []).forEach(r => (r.pts || []).forEach(p => pts.push(p)));
    (P.items || []).forEach(it => (it.pts || []).forEach(p => pts.push(p)));
    return pts.length ? windowOf(pts, 0.08) : null;
  }
  function aerialSheet(D, C) { const h = D.h, i0 = D.mark(); aerialPlan(D, C); const ba = D.bbox(i0), t0 = D.mark(); notesBlk(D, D.layer('TEXT', 7), 0, 0, 'NOTES', C.notes || [], 110); const bt = D.bbox(t0); D.move(t0, ba[0] - bt[0], ba[1] - 2 * h - bt[3]); }
  const AERIAL_NOTES = ['PLAN TO SCALE, GRID NORTH UP, ON AN AERIAL BACKGROUND (ESRI WORLD IMAGERY; IMAGERY DATE VARIES; NOT A SURVEY: THE OVERLAYS ARE THE PROJECT\'S GRID COORDINATES).',
    'CRANES DRAWN AS SCHEMATIC SYMBOLS FROM THE CRANE FILES (ASSUMED DIMENSIONS LISTED ON THE CRANE CARDS); TAIL-SWING CIRCLE (PHANTOM); SWING PATHS; P: PICK, S: SET; POWER-LINE D_MIN BUFFERS (DASHED).'];
  /* buildView(P, ctx, w, opt): one aerial sheet of the window w (the Plan tab's "Print plan view") -> { D, sheets } */
  function buildView(P, ctx, w, opt) {
    opt = opt || {}; const D = X_().drawing({ prefix: 'C-' }), C = { P, date: (ctx && ctx.date) || new Date().toISOString().slice(0, 10) };
    const S = { id: 'view', title: opt.title || 'PLAN VIEW (AERIAL)', fn: aerialPlan, kmin: 1, c: { ...C, ae: { P, w, ctx: ctx || {}, title: opt.title || 'PLAN VIEW' } }, paper: opt.paper || 'B', n: 1, of: 1 };
    const r = sheet(D, S, 0, C); r.aerial = S.c.aerial; return { D, sheets: [r] };
  }

  /* ---------- the set ---------- */
  const EXTRA = [];   // addSheets(fn): fn(P, ctx, C) -> [{ id, title, fn(D, C), c, kmin, src }] | null (sheets of other modules, after the route sheets)
  /* (C6 merged before C7: the route sheets are drawn here, routeSheet; addSheets stays for later modules.) */
  function addSheets(fn) { if (typeof fn === 'function') EXTRA.push(fn); }
  function build(P, ctx, opt) {
    opt = opt || {}; ctx = ctx || {}; const D = X_().drawing({ prefix: 'C-' }), errors = [], miss = [];
    const C = { P, date: ctx.date || new Date().toISOString().slice(0, 10), ref: ctx.ref, sections: ctx.sections }, list = [];
    const [pw, ph] = PAPER[opt.paper] || PAPER.D, aw = pw - 2.25, ah = ph - 4.55;
    const sum = summary(P, ctx);
    // a lift plan sheet per single pick
    sum.filter(r => r.kind === 'pick').forEach(r => {
      if (r.missing) { miss.push([`LIFT PLAN: ${r.name}`, r.missing]); return; }
      const { ev, u } = r, k = (P.picks || []).find(x => x.id === r.id), f = LF().footprint(r.c.def, u), pts = [u, k.pick, k.set].concat(ev.path.pts);
      if (isNum(f.tail)) pts.push({ x: u.x - f.tail, y: u.y - f.tail }, { x: u.x + f.tail, y: u.y + f.tail }); [].concat(f.body ? [f.body] : [], f.tracks).forEach(q => pts.push(...q)); f.floatC.forEach(q => pts.push(q));
      const pick = { P, k, u, c: r.c, ev, w: windowOf(pts) };
      list.push({ id: 'lift-' + k.id, title: `LIFT PLAN: ${k.name}`, fn: viewSheet, kmin: 48, c: { ...C, pick, planFn: pickPlan, elevs: [(D2, C2) => pickElev(D2, C2, 'pick'), (D2, C2) => pickElev(D2, C2, 'set')], rowsFn: pickRows, stackElev: true, flags: ev.flags,
        notes: ['PLAN TO SCALE, GRID NORTH UP. P: PICK, S: SET, G: CAPACITY-GOVERNING POINT ON THE SWING; BOOM AT THE PICK (SOLID), THE SET (DASHED) AND THE GOVERNING POINT (CENTER LINE); SWING PATH; TAIL-SWING CIRCLE (PHANTOM); MATS WHERE ENTERED; F1...: RED / AMBER 3D CLEARANCE FLAGS (CLOSEST POINT, DASHED TO THE ITEM).',
          'ELEVATIONS ALONG THE BOOM AT THE PICK AND THE SET, TO THE SAME SCALE. VALUES: THE APP\'S ENGINE (PICKS TAB, LIFTS TAB, REPORT).'] },
        src: [['out', 'picks', 'Picks tab'], ['in', 'lifts', 'Lifts input tab'], ['rpt', 'pick-' + k.id, 'Report §Lifts']] });
      if (opt.aerial) list.push({ id: 'aerial-' + k.id, title: `SITE PLAN - AERIAL: ${k.name}`, fn: aerialSheet, kmin: 48, aerial: true, c: { ...C, ae: { P, w: pick.w, ctx, only: { picks: [k.id] }, title: `AERIAL: ${k.name}` }, notes: AERIAL_NOTES },
        src: [['in', 'lifts', 'Lifts input tab'], ['out', 'plan', 'Plan tab (map)'], ['rpt', 'aerial', 'Report §Site plan (aerial)']] });
    });
    // a lift plan sheet and a rigging sheet per girder lift
    sum.filter(r => r.kind === 'tandem').forEach(r => {
      const t = r.t; if (r.missing) { miss.push([`GIRDER LIFT: ${r.name}`, r.missing]); return; }
      const rr = r.r, pts = [t.pick, t.set].concat(t.way || [], rr.steps.map(q => ({ x: q.x.pose.x, y: q.x.pose.y })));
      t.slots.slice(0, nC(t)).forEach(id => { const u = setupOf(P, id), c = craneOf(P, u); if (!u || !c) return; pts.push(u); const f = LF().footprint(c.def, u); if (isNum(f.tail)) pts.push({ x: u.x - f.tail, y: u.y - f.tail }, { x: u.x + f.tail, y: u.y + f.tail }); f.floatC.forEach(q => pts.push(q)); });
      const ob = rr.sh.ob; [t.pick, t.set].forEach(q => T().outline(t, q, ob).box.forEach(p => pts.push(p)));
      const tl = { P, t, r: rr, w: windowOf(pts) }, govs = rr.gov.map((g, i) => i).filter((i, j, a) => !j || rr.gov[i].i !== rr.gov[0].i);
      list.push({ id: 'tlift-' + t.id, title: `${rr.single ? 'GIRDER LIFT' : 'TANDEM LIFT'} PLAN: ${t.name}`, fn: viewSheet, kmin: 48, c: { ...C, tl, planFn: tandemPlan, elevs: govs.map(i => (D2, C2) => tandemElev(D2, C2, i)), rowsFn: tandemRows, flags: rr.flags, tableTitle: 'LIFT DATA',
        notes: ['PLAN TO SCALE, GRID NORTH UP. GIRDER ON THE TRUCK (PICK) AND ON THE BEARINGS (SET), THE PATH OF ITS CENTRE (DASHED), W1...: WAYPOINTS; EACH CRANE\'S BOOM AT ITS GOVERNING STEP (CENTER LINE) TO ITS HOOK H1 / H2; F1...: 3D CLEARANCE FLAGS.',
          `ELEVATION IN THE VERTICAL PLANE THROUGH ${nC(t) > 1 ? 'BOTH CRANES' : 'THE CRANE AND ITS HOOK'}, AT THE GOVERNING STEP, TO THE SAME SCALE.`] },
        src: [['in', 'tandem', 'Girder lifts input tab'], ['out', 'picks', 'Picks tab (girder lifts)'], ['rpt', 'tandem-' + t.id, 'Report §Tandem lifts']] });
      if (opt.aerial) list.push({ id: 'aerial-' + t.id, title: `SITE PLAN - AERIAL: ${t.name}`, fn: aerialSheet, kmin: 48, aerial: true, c: { ...C, ae: { P, w: tl.w, ctx, only: { tandems: [t.id] }, title: `AERIAL: ${t.name}` }, notes: AERIAL_NOTES },
        src: [['in', 'tandem', 'Girder lifts input tab'], ['out', 'plan', 'Plan tab (map)'], ['rpt', 'aerial', 'Report §Site plan (aerial)']] });
      list.push({ id: 'rig-' + t.id, title: `RIGGING AND LOAD SHARE: ${t.name}`, fn: rigging, kmin: 24, c: { ...C, tl }, src: [['in', 'tandem', 'Girder lifts input tab (girder, hooks)'], ['rpt', 'tandem-' + t.id, 'Report §Tandem lifts (load share)']] });
    });
    // the ground sheet
    const gm = groundModel(P, ctx);
    if (gm.length) {
      list.push({ id: 'ground', title: 'GROUND: OUTRIGGER / TRACK LOADS, MATS, BEARING', fn: groundSheet, kmin: 24, c: { ...C, gr: { P, gm } }, src: [['out', 'ground', 'Ground tab'], ['in', 'ground', 'Ground input tab'], ['rpt', 'ground', 'Report §Ground']] }); }
    else if (sum.length) miss.push(['GROUND', 'NO GROUND RESULT (NO CRANE SETUP WITH A LIFT)']);
    // C6: a sheet per trucking route
    if (window.CranePickRoute) sum.filter(r => r.kind === 'route').forEach(r => {
      if (r.missing) { miss.push([`TRUCKING ROUTE: ${r.name}`, r.missing]); return; }
      const ev = r.ev, pts = [].concat(...ev.sim.samples.map(q => q.parts.map(p => p.poly).flat())); (P.routeMarks || []).forEach(m => m.pts.forEach(p => pts.push(p)));
      list.push({ id: 'route-' + r.i, title: `TRUCKING ROUTE: ${r.name}`, fn: routeSheet, kmin: 48, c: { ...C, ro: { P, rt: r.rt, ev, row: r, w: windowOf(pts, 0.06) } }, src: [['in', 'route', 'Route input tab'], ['out', 'route', 'Route tab'], ['rpt', r.key, 'Report §Route']] });
      if (window.CranePickTruckGfx && ev.geo) list.push({ id: 'routeveh-' + r.i, title: `TRUCKING ROUTE: ${r.name} - VEHICLE AND LOAD`, fn: routeVehSheet, kmin: 24, c: { ...C, ro: { P, rt: r.rt, ev, row: r } }, src: [['in', 'route', 'Route input tab (vehicle, load)'], ['out', 'route', 'Route tab (Vehicle and load)'], ['rpt', r.key, 'Report §Route']] });   // 2026-11-17
    });
    EXTRA.forEach(fn => { try { (fn(P, ctx, C) || []).forEach(s => list.push(Object.assign({ kmin: 1, c: { ...C } }, s))); } catch (e) { miss.push(['ADDED SHEET', String(e.message)]); } });
    if (!sum.length) miss.push(['LIFT PLAN SHEETS', 'NO LIFT YET (LIFTS OR GIRDER LIFTS TAB)']);
    // the general notes (second) and the cover with the sheet index (first): the cover's own sheets counted in the index
    // the aerial site plan of the whole site: first after the general notes (the per-lift aerial sheets follow each lift's plan sheet)
    const sw = opt.aerial ? siteWindow(P, ctx) : null;
    if (sw) list.unshift({ id: 'aerial', title: 'SITE PLAN - AERIAL', fn: aerialSheet, kmin: 48, aerial: true, c: { ...C, ae: { P, w: sw, ctx, title: 'SITE PLAN - AERIAL' }, notes: AERIAL_NOTES },
      src: [['out', 'plan', 'Plan tab (map)'], ['in', 'items', 'Site items input tab'], ['rpt', 'aerial', 'Report §Site plan (aerial)']] });
    const head = [], notesL = [], npg = blockPages(notesBlocks(P, ctx), aw, ah);
    npg.forEach((items, i) => notesL.push({ id: i ? `notes${i + 1}` : 'notes', title: npg.length > 1 ? `GENERAL NOTES (${i + 1} OF ${npg.length})` : 'GENERAL NOTES', fn: pageFn(items), c: { ...C }, kmin: 1, noScale: true, src: [['in', 'cranes', 'Cranes input tab'], ['in', 'lifts', 'Lifts input tab (settings)'], ['rpt', 'basis', 'Report §Basis']] }));
    let nC0 = 1, cpg = null;
    for (let it = 0; it < 5; it++) {
      const titles = [...Array.from({ length: nC0 }, (_, i) => [nC0 > 1 ? `COVER AND SHEET INDEX (${i + 1} OF ${nC0})` : 'COVER AND SHEET INDEX', i ? `cover${i + 1}` : 'cover']), ...notesL.map(q => [q.title, q.id]), ...list.map(q => [q.title, q.id])];
      cpg = blockPages(coverBlocks(P, sum, titles.map(([tt, id], i) => [i + 1, tt, id]), miss, C.date), aw, ah); if (cpg.length === nC0) break; nC0 = cpg.length;
    }
    cpg.forEach((items, i) => head.push({ id: i ? `cover${i + 1}` : 'cover', title: cpg.length > 1 ? `COVER AND SHEET INDEX (${i + 1} OF ${cpg.length})` : 'COVER AND SHEET INDEX', fn: pageFn(items), c: { ...C }, kmin: 1, noScale: true, src: [['out', 'summary', 'Summary tab'], ['in', 'proj', 'Project input tab (title block)']] }));
    const all = [...head, ...notesL, ...list];
    let ox = 0; const sheets = [];
    all.forEach((S, i) => { const m0 = D.mark(); try { const S2 = { ...S, paper: opt.paper || 'D', n: i + 1, of: all.length, half: !!opt.half }, r = sheet(D, S2, ox, C); if (S.aerial && S.c.aerial) r.aerial = S.c.aerial; sheets.push(r); ox += r.W + 2 * r.k * 12; } catch (e) { D.E.length = m0; errors.push(`${S.title}: ${e.message}`); } });
    return { D, sheets, miss, errors, summary: sum };
  }
  window.CranePickDrawSet = { PAPER, SCALES, SCALE_NAME, TXT, summary, notesModel, govClr, groundSum, groundModel, build, buildView, siteWindow, aerialPlan, addSheets, clip, windowOf, pctText, clrText, grText, stepText };
})();
