/* apps/crane-pick/ui/cranefig.js — the crane graphics of the Crane tab, the Report §Cranes figures and the Crane drawing sheets
   (window.CranePickCraneFig). C9 (engineer request 2026-11-17: "a crane output tab that has graphics for the crane showing what is being
   used in the analysis"). Classic script, no DOM (Node-tested: tests/engine/crane-fig.test.mjs).

   Display only (CLAUDE.md §4: no calculation here). Every number drawn is a value the engines already use, read from the same functions the
   analysis calls: engine/cranes.js planDims (+ its provenance `src`), groups / lookup / ratingBasis / interpPermitted; engine/lift.js
   footprint, chartsOf, settingsOf; engine/elev.js geomOf (+ `page`), angleAt / tipAt, padEl / padFrom, el0; engine/ground.js inputsOf,
   supports and the ground result of each lift (ev.ground / r.ground.cr[i]); the lifts' own evaluations (the page's evalPick / evalT). The
   only arithmetic is drawing geometry (positions, scales) and, for a governing point on the swing, the elevation values engine/elev.js
   itself forms there (z_tip by tipAt at that radius, the block top z_tr + H + h_r + h_bk, m = z_tip − H_hd − z_bk: its travel formulas).
   Each value carries its source: "file p.x" (the crane file, the printed page), "entered", "ASSUMED (default)" (highlighted amber),
   "chart p.x" (the chart configuration), "project setting", "terrain".

   model(P, ctx, sel) -> the model of one crane + setup (+ the chosen lift and point): { crane, u, virt, cfg, vals: { id: value }, lifts,
     pt (the chosen point), chart, ground, opts } ; sel = { craneId, setupId, group (no setup), lift ('pick:<id>' | 'tandem:<id>:<i>'),
     at ('pick' | 'set' | 'gov'), cfg (a zone chart's config id) }; ctx = { evalPick(k), evalT(t) }.
   figures: plan(m), elev(m), chart(m), weights(m) -> a primitive list (world units) with labels { v: value id, val, src };
   svg(fig, o) -> SVG text; dxf(D, fig, o) draws it with shared/dxf.js; rows(m) -> the input table; options(P) -> the picker entries;
   sheets(P, ctx) -> the Crane drawing sheets (ui/drawset.js addSheets). */
(function () {
  'use strict';
  const K = () => window.CranePickCranes, LF = () => window.CranePickLift, EL = () => window.CranePickElev, GR = () => window.CranePickGround;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rad = d => d * Math.PI / 180;
  const nC = t => t.type === 'single' ? 1 : 2;
  /* ---------- sources ---------- */
  const pg = p => p != null && p !== '' ? ' p.' + [].concat(p).join(', ') : '';
  function srcText(s) {
    if (!s) return 'not given';
    switch (s.from) {
      case 'file': return 'file' + pg(s.page);
      case 'derived': return s.page != null || s.key ? 'file' + pg(s.page) + ' (derived)' : 'derived (' + (s.note || 'from other inputs') + ')';
      case 'entered': return 'entered';
      case 'assumed': return 'ASSUMED (default)';
      case 'none': return 'not given';
      case 'chart': return 'chart' + pg(s.page);
      case 'setting': return 'project setting' + (s.dflt ? ' (= default)' : '');
      case 'terrain': return 'terrain (USGS 3DEP, preliminary)';
      case 'engine': return 'engine';
      default: return String(s.from);
    }
  }
  const assumedSrc = s => !!s && (s.from === 'assumed' || s.from === 'none');
  const SRC = { srcText, assumedSrc };

  /* ---------- the picker ---------- */
  /* options(P) -> [{ craneId, setupId, group, label, used }]: each setup of each project crane (and, for a crane not placed, each chart group) */
  function options(P) {
    const out = [];
    (P.cranes || []).forEach(c => {
      const us = (P.setups || []).filter(u => u.craneId === c.id), nm = K().name(c.def);
      us.forEach(u => { const used = (P.picks || []).some(k => k.setupId === u.id) || (P.tandems || []).some(t => t.slots.slice(0, nC(t)).includes(u.id));
        const gr = K().groups(c.def).find(g => g.key === u.group); out.push({ craneId: c.id, setupId: u.id, label: `${nm} — ${u.name}${gr ? ' — ' + gr.label : ''}${isNum(u.boom) ? ', boom ' + fmt(u.boom, 1) + ' ft' : ''}${used ? '' : ' (no lift)'}`, used }); });
      if (!us.length) K().groups(c.def).forEach(g => out.push({ craneId: c.id, setupId: '', group: g.key, label: `${nm} — not placed — ${g.label}`, used: false }));
    });
    return out;
  }
  /* the lifts that use a setup: single picks and each crane slot of a girder lift */
  function liftsOf(P, ctx, u) {
    const out = []; if (!u || !u.id) return out;
    (P.picks || []).filter(k => k.setupId === u.id).forEach(k => { const ev = ctx.evalPick ? ctx.evalPick(k) : null; if (ev) out.push({ key: 'pick:' + k.id, kind: 'pick', id: k.id, name: k.name, k, ev }); });
    (P.tandems || []).forEach(t => t.slots.slice(0, nC(t)).forEach((sid, i) => { if (sid !== u.id) return; const r = ctx.evalT ? ctx.evalT(t) : null; if (r && r.steps && r.steps.length && r.gov[i])
      out.push({ key: `tandem:${t.id}:${i}`, kind: 'tandem', id: t.id, i, name: t.name + (nC(t) > 1 ? ` (crane ${i + 1})` : ''), t, r }); }));
    return out;
  }
  const AT = { pick: 'at the pick', set: 'at the set', gov: 'governing point' };
  /* the chosen point: R, slew θ, the chart config, the heights, the load and where it is (the lift's own engine values) */
  function pointOf(c, u, L, at, g) {
    if (!L) return null;
    if (L.kind === 'pick') {
      const ev = L.ev, h = ev.elev, E = EL().el0(L.k);
      const base = { lift: L, W: ev.W, Lload: E.L, Wload: E.W };
      const fromPt = (e, hp, which) => Object.assign(base, { at: which, where: AT[which], R: e.R, theta: e.theta, cfg: e.cfg, C: e.C, pct: e.pct, cls: e.cls, look: e.look,
        ang: hp ? hp.ang : null, zTip: hp ? hp.zTip : null, zLb: hp ? hp.zLb : null, zg: hp ? hp.zg : null, H: hp ? hp.H : 0, hr: hp ? hp.hr : 0, hbk: hp ? hp.hbk : 0,
        zHk: hp ? hp.zHk : null, zBk: hp ? hp.zBk : null, m: hp ? hp.margin : null, zgFrom: (E.from || {})[which === 'set' ? 'sg' : 'pg'] || (isNum(which === 'set' ? E.sg : E.pg) ? 'entered' : 'pad') });
      if (at === 'set') return fromPt(ev.set, h && h.set, 'set');
      if (at === 'gov') {
        if (ev.govWhere === 'at the pick') return Object.assign(fromPt(ev.pick, h && h.pick, 'pick'), { at: 'gov', where: 'governing point (at the pick)' });
        if (ev.govWhere === 'at the set') return Object.assign(fromPt(ev.set, h && h.set, 'set'), { at: 'gov', where: 'governing point (at the set)' });
        const e = ev.gov, o = fromPt(e, null, 'gov'); o.where = 'governing point (' + ev.govWhere + ')';
        if (h) { const ang = EL().angleAt(c, u, e.cfg, e.R, g, 'cf', true), zTip = EL().tipAt(c, u, e.cfg, e.R, g);
          Object.assign(o, { ang, zTip, zLb: h.trav.z, zg: null, H: h.pick.H, hr: h.pick.hr, hbk: h.pick.hbk, zHk: h.trav.z + h.pick.H + h.pick.hr, zBk: h.swing.zBk, trav: true, travEntered: h.trav.entered });
          o.m = isNum(zTip) ? zTip - g.head - o.zBk : null; }
        return o;
      }
      return fromPt(ev.pick, h && h.pick, 'pick');
    }
    const r = L.r, i = L.i, j = at === 'pick' ? 0 : at === 'set' ? r.steps.length - 1 : r.gov[i].i, q = r.steps[j], cr = q.cr[i], hk = L.t.hooks[i] || {}, ob = r.sh.ob;
    const ang = cr.e && cr.e.cfg ? EL().angleAt(c, u, cr.e.cfg, cr.R, g, 'cf', true) : null;
    return { lift: L, at, where: (at === 'gov' ? 'governing step ' : 'step ') + j + ': ' + (window.CranePickTandem ? window.CranePickTandem.where(q.x) : ''), step: j, R: cr.R, theta: cr.e.theta, cfg: cr.e.cfg, C: cr.C, pct: cr.pct, cls: cr.cls, look: cr.e.look,
      W: r.sh.Wh[i], ang, zTip: cr.zTip, zLb: q.x.pose.z, zg: null, H: ob.H, hr: isNum(hk.rigH) ? hk.rigH : 0, hbk: isNum(hk.blk) ? hk.blk : 0, zHk: cr.zHk, zBk: cr.zBk, m: cr.margin, Lload: ob.L, Wload: ob.B, girder: true };
  }
  /* the operating points of every lift of this setup: (R, W, % of chart) at the pick, the set, the governing point; every tandem step */
  function opPoints(lifts) {
    const out = [];
    lifts.forEach(L => {
      if (L.kind === 'pick') { const ev = L.ev; [['P', ev.pick, 'at the pick'], ['S', ev.set, 'at the set']].forEach(([tag, e, w]) => out.push({ lift: L, tag, R: e.R, W: ev.W, C: e.C, pct: e.pct, cls: e.cls, ok: e.look.ok, cfgId: e.cfg && e.cfg.id, where: w }));
        if (ev.govWhere !== 'at the pick' && ev.govWhere !== 'at the set') out.push({ lift: L, tag: 'G', R: ev.gov.R, W: ev.W, C: ev.gov.C, pct: ev.gov.pct, cls: ev.gov.cls, ok: ev.gov.look.ok, cfgId: ev.gov.cfg && ev.gov.cfg.id, where: ev.govWhere, gov: true });
        else out.filter(p => p.lift === L && p.where === ev.govWhere).forEach(p => { p.gov = true; });
        return; }
      const r = L.r, i = L.i, gi = r.gov[i].i;
      r.steps.forEach((q, j) => { const c = q.cr[i]; if (!c) return; out.push({ lift: L, tag: j === gi ? 'G' : '', step: j, R: c.R, W: r.sh.Wh[i], C: c.C, pct: c.pct, cls: c.cls, ok: !!(c.e && c.e.look && c.e.look.ok), cfgId: c.e && c.e.cfg && c.e.cfg.id, gov: j === gi, tandem: true, single: r.single }); });
    });
    return out;
  }
  /* the chart's curves as the lookup rule gives them (sampled with engine/cranes.js lookup itself: the steps are the rule applied) */
  function curve(cfg, L, s, mode) {
    const Rs = cfg.chart.radii_ft, segs = []; let cur = null;
    const at = R => { const r = K().lookup(cfg, L, R, { interp: s.interp, mode }); return r.ok ? r.cap : null; };
    const push = (R, Cv) => { if (Cv == null) { cur = null; return; } if (!cur) { cur = []; segs.push(cur); } cur.push({ R, C: Cv }); };
    push(Rs[0], at(Rs[0]));
    for (let i = 1; i < Rs.length; i++) { const a = Rs[i - 1], b = Rs[i]; [1e-6, 0.25, 0.5, 0.75, 1].forEach(t => { const R = t === 1 ? b : a + (b - a) * t; push(R, at(R)); }); }
    return segs;
  }
  function chartModel(c, u, cfg, s, lifts, P) {
    if (!cfg || !cfg.chart) return null;
    const ch = cfg.chart, B = ch.boom_lengths_ft, Rs = ch.radii_ft, modes = ch.column_modes;
    const cols = B.map((b, j) => ({ j, L: b, mode: Array.isArray(modes) ? modes[j] : null, pts: Rs.map((r, i) => ({ R: r, C: ch.capacity_lb[i][j] })).filter(p => p.C != null) }));
    const lens = [...new Set(B)], curves = lens.map(L => ({ L, segs: curve(cfg, L, s, u.mode) }));
    const look = isNum(u.boom) ? K().lookup(cfg, u.boom, Rs[0], { interp: s.interp, mode: u.mode }) : null;
    const use = isNum(u.boom) ? { L: u.boom, Ltab: B.find(b => b >= u.boom - 1e-6), segs: curve(cfg, u.boom, s, u.mode) } : null;
    const pts = opPoints(lifts), mine = pts.filter(p => p.cfgId === cfg.id), other = pts.filter(p => p.cfgId && p.cfgId !== cfg.id);
    const thr = [{ id: 'caution', pct: s.caution, label: `caution ${fmt(s.caution, 0)} %` }];
    if (Math.abs(s.critical - s.caution) > 1e-9) thr.push({ id: 'critical', pct: s.critical, label: `critical lift ${fmt(s.critical, 0)} %` }); else thr[0].label = `caution / critical lift ${fmt(s.caution, 0)} %`;
    thr.push({ id: 'limit', pct: s.limit, label: `limit ${fmt(s.limit, 0)} %` });
    if (lifts.some(L => L.kind === 'tandem' && !L.r.single)) thr.push({ id: 'tandem', pct: (P.lift && P.lift.tandem) || 75, label: `tandem limit ${fmt((P.lift && P.lift.tandem) || 75, 0)} %` });
    const rb = K().ratingBasis(cfg, c), so = c.source || {};
    return { cfg, cols, curves, use, pts: mine, other, thr, rb, interp: s.interp && K().interpPermitted(cfg), interpSet: s.interp, look, Rmax: Rs[Rs.length - 1], Cmax: Math.max(...ch.capacity_lb.flat().filter(isNum)),
      source: { doc: so.doc || 'not stated', revision: so.revision || '—', date: so.date || '—', pages: so.pages || '', prelim: !!c.preliminary, edited: !!(c.app_inputs && c.app_inputs.edited), page: cfg.page } };
  }

  /* ---------- the model ---------- */
  function model(P, ctx, sel) {
    sel = sel || {}; ctx = ctx || {};
    const cr = (P.cranes || []).find(c => c.id === sel.craneId) || (P.cranes || [])[0]; if (!cr) return null;
    const c = cr.def, groups = K().groups(c);
    let u = (P.setups || []).find(x => x.id === sel.setupId && x.craneId === cr.id) || null, virt = false;
    if (!u && !sel.group) u = (P.setups || []).find(x => x.craneId === cr.id) || null;
    if (!u) { virt = true; const gr = groups.find(g => g.key === sel.group) || groups[0]; u = { id: '', name: 'not placed', x: 0, y: 0, heading: 0, group: gr ? gr.key : '', boom: null, mode: null, pad: null }; }
    const s = LF().settingsOf(P), chs = LF().chartsOf(c, u), pd = K().planDims(c), g = EL().geomOf(c), u0 = Object.assign({}, u, { x: 0, y: 0, heading: 0 });
    const fp = LF().footprint(c, u0), S = GR().supports(c, u), inp = GR().inputsOf(c, u), ph = (c.app_inputs || {}).ph4 || {};
    const lifts = liftsOf(P, ctx, u), L = lifts.find(x => x.key === sel.lift) || lifts[0] || null;
    const at = AT[sel.at] ? sel.at : 'gov', pt = pointOf(c, u, L, at, g);
    const cfg0 = chs.gr ? (chs.gr.configs['360'] || chs.gr.configs[chs.gr.zones[0]]) : null;
    const zcfgs = chs.gr ? chs.gr.zones.map(z => chs.gr.configs[z]) : [];
    const cfg = zcfgs.find(x => x.id === sel.cfg) || (pt && pt.cfg) || cfg0;
    const ground = L ? (L.kind === 'pick' ? L.ev.ground : (L.r.ground && L.r.ground.cr ? L.r.ground.cr[L.i] : null)) : null;
    const m = { P, crane: cr, c, name: K().name(c), u, virt, s, chs, groups, pd, g, fp, S, inp, ph, lifts, L, at, pt, cfg, zcfgs, ground, vals: {} };
    m.chart = chartModel(c, u, cfg, s, lifts, P);
    buildVals(m);
    return m;
  }
  /* every input value the analysis uses, with its source and where it is used */
  function buildVals(m) {
    const { c, u, virt, s, chs, pd, g, fp, S, inp, ph, cfg, P } = m, V = m.vals, ps = pd.src || {};
    const add = (id, grp, label, sym, v, unit, d, src, used, o) => { V[id] = Object.assign({ id, grp, label, sym, v, unit, d, src, used: used || [] }, o || {}); return V[id]; };
    const gsrc = k => ({ from: g.from[k], page: g.page && g.page[k], note: g.from[k] === 'assumed' ? (g.assumed.find(a => a.indexOf(({ footH: 'boom-foot pin height', footE: 'boom-foot pin on', head: 'head allowance', boomW: 'boom section', cwBot: 'counterweight bottom', cwTop: 'counterweight top' })[k]) === 0) || '') : '' });
    const U = { plan: 'plan clearances, map, 3D view', cap: 'chart capacity (every lift)', heights: 'heights / hook reach, 3D clearances', ground: 'outrigger / track loads (C4)', bear: 'bearing, mats, stress at depth (C4)' };
    // plan
    add('tail', 'Plan', 'Tail-swing radius', 'R_t', pd.tail, 'ft', 2, ps.tail || { from: 'none', note: 'tail-swing checks skipped' }, [U.plan, '3D counterweight cylinder', isNum(ph.cwRad) ? null : 'counterweight CG radius (not entered)'].filter(Boolean));
    add('e', 'Plan', 'Boom-foot pin ahead of the rotation centre', 'e', g.footE, 'ft', 2, gsrc('footE'), ['boom angle d_h = R − e', 'boom CG (C4)', '3D boom segment']);
    if (pd.body) { add('bodyF', 'Plan', pd.kind === 'crawler' ? 'Carbody front of the rotation centre' : 'Carrier front of the rotation centre', 'x_{front}', pd.body.front, 'ft', 2, ps['body.front'] || { from: 'none' }, [U.plan]);
      add('bodyR', 'Plan', pd.kind === 'crawler' ? 'Carbody rear of the rotation centre' : 'Carrier rear of the rotation centre', 'x_{rear}', pd.body.rear, 'ft', 2, ps['body.rear'] || { from: 'none' }, [U.plan]);
      add('bodyW', 'Plan', pd.kind === 'crawler' ? 'Carbody width' : 'Carrier width', 'b_{c}', pd.body.width, 'ft', 2, ps['body.width'] || { from: 'none' }, [U.plan]); }
    if (pd.kind === 'crawler') { const cw = pd.crawler || {};
      add('trkL', 'Plan', 'Track length', 'L_{t}', cw.length, 'ft', 2, ps['crawler.length'] || { from: 'none' }, [U.plan, U.ground, U.bear]);
      add('gauge', 'Plan', 'Track gauge (centre to centre)', 'g', cw.gauge, 'ft', 2, ps['crawler.gauge'] || { from: 'none' }, [U.plan, U.ground, U.bear]);
      add('shoe', 'Plan', 'Shoe width (drawn)', 's', isNum(cw.shoe) ? cw.shoe : 3, 'ft', 2, isNum(cw.shoe) ? (ps['crawler.shoe'] || { from: 'file' }) : { from: 'assumed', note: 'shoe 3 ft (drawing)' }, [U.plan]);
      if (S.ok) add('shoeG', 'Ground', 'Shoe width used for track pressure', 's', S.s, 'ft', 2, isNum(ph.floatFt) ? { from: 'entered' } : isNum(cw.shoe) ? (ps['crawler.shoe'] || { from: 'file' }) : { from: 'assumed', note: 'track shoe width 3 ft' }, [U.ground, U.bear]);
    } else if (pd.outr) { const o = pd.outr, key = fp.spread;
      add('xF', 'Plan', 'Front outrigger beam ahead of the rotation centre', 'x_{F}', o.xFront, 'ft', 2, ps['outr.xFront'] || { from: 'none' }, [U.plan, U.ground]);
      add('xR', 'Plan', 'Rear outrigger beam behind the rotation centre', 'x_{R}', o.xRear, 'ft', 2, ps['outr.xRear'] || { from: 'none' }, [U.plan, U.ground]);
      add('spread', 'Plan', `Outrigger spread used by the chart (${key ? key : 'support: ' + (cfg && cfg.support || '—')})`, '2b', key ? o.spreads[key] : null, 'ft', 2, key ? (ps['outr.spreads.' + key] || { from: 'file' }) : { from: 'none', note: cfg && /rubber/.test(cfg.support || '') ? 'on rubber: no outriggers' : 'spread not given for this support' }, [U.plan, U.ground]);
      add('float', 'Plan', 'Float size (drawn, plan clearances)', 'f', isNum(o.float) ? o.float : (key ? 2 : null), 'ft', 2, isNum(o.float) ? (ps['outr.float'] || { from: 'file' }) : { from: 'assumed', note: 'float 2 ft (drawing)' }, [U.plan]);
      if (S.ok) add('floatG', 'Ground', 'Float size used for bearing (diameter)', 'f', S.f, 'ft', 2, isNum(ph.floatFt) ? { from: 'entered' } : isNum(o.float) ? (ps['outr.float'] || { from: 'file' }) : { from: 'assumed', note: 'float size 2 ft' }, [U.bear]); }
    // elevation
    add('footH', 'Elevation', 'Boom-foot pin height above the pad', 'h_{f}', g.footH, 'ft', 2, gsrc('footH'), [U.heights]);
    add('head', 'Elevation', 'Head allowance (tip pin to the highest block position)', 'H_{hd}', g.head, 'ft', 2, gsrc('head'), ['hook reach margin']);
    add('boomW', 'Elevation', 'Boom section width', 'b_{w}', g.boomW, 'ft', 2, gsrc('boomW'), ['3D clearances (boom cylinder)']);
    add('cwBot', 'Elevation', 'Counterweight bottom above the pad', 'z_{cb}', g.cwBot, 'ft', 2, gsrc('cwBot'), ['3D counterweight cylinder']);
    add('cwTop', 'Elevation', 'Counterweight top above the pad', 'z_{ct}', g.cwTop, 'ft', 2, gsrc('cwTop'), ['3D counterweight cylinder'], { nullText: 'not limited' });
    add('maxAng', 'Elevation', 'Maximum boom angle', '\\theta_{max}', g.maxAng, '°', 1, g.maxAng == null ? { from: 'none', note: 'not checked' } : { from: 'file', page: g.page && g.page.maxAng }, ['boom angle check'], { nullText: 'not given (not checked)' });
    // chart
    if (cfg) { add('cfg', 'Chart', 'Chart configuration', '', cfg.label || cfg.id, '', 0, { from: 'chart', page: cfg.page }, [U.cap], { text: true });
      const rb = K().ratingBasis(cfg, c); add('rating', 'Chart', 'Rating basis (shown, not used in a calculation)', '', rb.pct, '% of tipping', 0, rb.from === 'entered' ? { from: 'entered' } : rb.from === 'notes' ? { from: 'chart', page: cfg.page, note: 'chart notes' } : { from: 'none', note: 'not stated in the notes' }, ['shown with the thresholds'], { nullText: 'not stated' });
      add('interp', 'Chart', 'Interpolation between radii', '', s.interp && K().interpPermitted(cfg) ? 'ON (notes permit, project setting)' : s.interp ? 'off (setting on, notes do not permit)' : 'off (next larger radius)', '', 0, { from: 'setting', dflt: !s.interp }, [U.cap], { text: true }); }
    add('boom', 'Chart', 'Boom length of the setup', 'L', virt ? null : u.boom, 'ft', 2, virt ? { from: 'none', note: 'not placed' } : { from: 'entered' }, [U.cap, U.heights], { nullText: virt ? 'not placed' : 'not set' });
    if (cfg && isNum(u.boom)) { const Lt = cfg.chart.boom_lengths_ft.find(b => b >= u.boom - 1e-6); add('Ltab', 'Chart', 'Next longer tabulated boom length (lookup column)', 'L_{tab}', Lt == null ? null : Lt, 'ft', 2, { from: 'chart', page: cfg.page, note: 'lookup rule' }, [U.cap], { nullText: 'longer than the chart' }); }
    if (cfg && Array.isArray(cfg.chart.column_modes)) add('mode', 'Chart', 'Telescoping mode', '', u.mode || 'not chosen (lowest column)', '', 0, u.mode ? { from: 'entered' } : { from: 'assumed', note: 'lowest of the modes' }, [U.cap], { text: true });
    if (chs.zoned) { const sec = (c.app_inputs || {}).sectors || {};
      add('secF', 'Chart', 'Over-front sector half-angle', '', isNum(sec.front) && sec.front > 0 ? sec.front : null, '°', 1, isNum(sec.front) && sec.front > 0 ? { from: 'entered' } : { from: 'none', note: 'not set: over-front chart not used' }, ['zone of each hook position'], { nullText: 'not set' });
      add('secR', 'Chart', 'Over-rear sector half-angle', '', isNum(sec.rear) && sec.rear > 0 ? sec.rear : null, '°', 1, isNum(sec.rear) && sec.rear > 0 ? { from: 'entered' } : { from: 'none', note: 'not set: over-rear chart not used' }, ['zone of each hook position'], { nullText: 'not set' }); }
    // setup
    if (!virt) { add('heading', 'Setup', 'Carrier heading (grid azimuth of the front)', '\\alpha_{front}', u.heading || 0, '°', 1, { from: 'entered', note: 'dragged / typed' }, ['slew angle θ, zones, plan']);
      const pf = EL().padFrom(u); add('pad', 'Setup', 'Crane pad elevation', 'z_{pad}', EL().padEl(u), 'ft', 2, pf === 'entered' ? { from: 'entered' } : pf === 'terrain' ? { from: 'terrain' } : { from: 'assumed', note: 'datum 0.00' }, [U.heights]); }
    // weights (C4)
    const wsrc = (k, ent) => isNum(ent) ? { from: 'entered' } : { from: 'none', note: 'not entered' };
    add('Wc', 'Weights', 'Carrier / carbody weight', 'W_{c}', inp.Wc, 'lb', 0, wsrc('Wc', inp.Wc), [U.ground], { nullText: 'not entered' });
    add('xc', 'Weights', 'Carrier / carbody CG (+ forward)', 'x_{c}', inp.xc, 'ft', 2, wsrc('xc', inp.xc), [U.ground], { nullText: 'not entered' });
    add('Wu', 'Weights', 'Upperworks weight (without counterweight)', 'W_{u}', inp.Wu, 'lb', 0, wsrc('Wu', inp.Wu), [U.ground], { nullText: 'not entered' });
    add('xu', 'Weights', 'Upperworks CG (+ toward the boom)', 'x_{u}', inp.xu, 'ft', 2, wsrc('xu', inp.xu), [U.ground], { nullText: 'not entered' });
    add('Wb', 'Weights', 'Boom weight', 'W_{b}', inp.Wb, 'lb', 0, wsrc('Wb', inp.Wb), [U.ground], { nullText: 'not entered' });
    add('fb', 'Weights', 'Boom CG (fraction of foot-to-tip)', 'f_{b}', inp.fb, '', 2, { from: inp.from.fb === 'entered' ? 'entered' : 'assumed', note: 'uniform boom 0.5' }, [U.ground]);
    add('Wcw', 'Weights', 'Counterweight', 'W_{cw}', inp.Wcw, 'lb', 0, inp.from.Wcw === 'entered' ? { from: 'entered' } : inp.from.Wcw ? { from: 'chart', page: inp.cfg && inp.cfg.page, note: 'chart configuration' } : { from: 'none' }, [U.ground], { nullText: 'not given' });
    add('rcw', 'Weights', 'Counterweight CG radius', 'r_{cw}', inp.rcw, 'ft', 2, inp.from.rcw === 'entered' ? { from: 'entered' } : inp.from.rcw === 'assumed' ? { from: 'assumed', note: 'tail-swing radius' } : { from: 'none' }, [U.ground], { nullText: 'not given' });
    const gAt = GR().fileGrossAt ? GR().fileGrossAt(c) : null;
    add('G', 'Weights', 'Gross operating weight without counterweight (estimate)', 'G', inp.G, 'lb', 0, inp.from.G === 'entered' ? { from: 'entered' } : inp.from.G === 'crane file' ? { from: 'file', page: gAt && gAt.page } : inp.from.G ? { from: 'derived', note: 'sum of the entered weights' } : { from: 'none' }, ['bounding estimate (C4)'], { nullText: 'not given' });
    add('gmode', 'Weights', 'Outrigger / track load method', '', inp.mode === 'rigid' ? 'rigid body (entered weights and CGs)' : inp.mode === 'estimate' ? 'estimate (bounding; verify with the manufacturer\'s calculator)' : 'not computed', '', 0, inp.mode === 'rigid' ? { from: 'entered' } : inp.mode === 'estimate' ? { from: 'assumed', note: 'missing: ' + inp.missing.join(', ') } : { from: 'none', note: inp.missing.join(', ') }, [U.ground], { text: true });
    // thresholds (project settings, Lifts tab)
    const D0 = LF().DEF; [['caution', 'Caution threshold'], ['critical', 'Critical-lift threshold'], ['limit', 'Limit']].forEach(([k, l]) => add('s_' + k, 'Settings', l, '', s[k], '% of chart', 0, { from: 'setting', dflt: Math.abs(s[k] - D0[k]) < 1e-9 }, ['class of each point']));
    if (m.lifts.some(L => L.kind === 'tandem' && !L.r.single)) add('s_tandem', 'Settings', 'Tandem limit per crane', '', (P.lift && P.lift.tandem) || 75, '% of chart', 0, { from: 'setting', dflt: ((P.lift && P.lift.tandem) || 75) === 75 }, ['tandem steps']);
    // the inputs that came from the file but are not used in a calculation are not listed (CLAUDE.md §6: only what the analysis uses)
    Object.values(V).forEach(x => { x.srcText = srcText(x.src); x.assumed = assumedSrc(x.src) || (x.src && x.src.from === 'derived' && /assum/i.test(x.src.note || '')); });
  }
  /* the value text of a model value */
  const valText = x => !x ? '—' : x.text ? String(x.v) : (x.v == null ? (x.nullText || 'not given') : fmt(x.v, x.d) + (x.unit ? (x.unit === '°' ? '°' : ' ' + x.unit) : ''));
  /* rows(m) -> the input table (every value with its source and use) */
  function rows(m) { return Object.values(m.vals).map(x => ({ id: x.id, grp: x.grp, label: x.label, sym: x.sym, value: valText(x), v: x.v, unit: x.unit, src: x.srcText, assumed: x.assumed, note: x.src && x.src.note || '', used: x.used })); }

  /* ---------- figures: a list of primitives in world units ---------- */
  /* prims: { t: 'line' | 'pl' | 'circle' | 'text' | 'dim' | 'arrow' | 'dot', … , c (style class) }; a label: { t: 'text', at, s, v (value id), val, src, assumed } */
  const lbl = (m, id, at, o) => { const x = m.vals[id]; if (!x) return null; o = o || {};
    return Object.assign({ t: 'text', at, s: (o.pre || (x.sym ? x.sym.replace(/[{}\\]/g, '').replace(/_/g, '') + ' = ' : x.label + ' ')) + valText(x), v: id, val: x.v, src: x.srcText, assumed: x.assumed, size: o.size || 0.9 }, o.a ? { a: o.a } : {}, o.off ? { off: o.off } : {}); };
  const txt = (at, s, o) => Object.assign({ t: 'text', at, s, size: 0.9 }, o || {});
  /* plan (crane frame, front up: world x = −y_local (to the right), world y = x_local (forward)) */
  function plan(m) {
    const F = [], { pd, fp, vals, chs, c, pt, inp, u, virt } = m, w = p => [p.x, p.y];   // footprint at heading 0, origin: grid x = −y_local, y = x_local
    const span = Math.max(isNum(pd.tail) ? pd.tail : 10, fp.dims.body ? Math.max(fp.dims.body.front, fp.dims.body.rear) : 10, (fp.dims.outr && fp.dims.outr.spreads[fp.spread] || 0) / 2, 8), d = span / 9;
    // 2026-11-17: the crane symbol (engine/cranegfx.js, the same geometry as the map, the lift plans and the DXF): carrier / tracks, axles
    // and wheels, outrigger beams and floats, the upperworks turned to the chosen point, the counterweight at the tail radius, the boom
    // (drawn in full when the hook is within 1.4 × the figure span, else the boom centre line below is cut), the hook block and the load
    const CG = window.CranePickCraneGfx, u0 = { x: 0, y: 0, heading: 0, group: u.group, boom: u.boom, mode: u.mode };
    let sym = null;
    if (CG) { const spanB = Math.max(isNum(pd.tail) ? pd.tail : 10, 8) * 1.4, th = pt && isNum(pt.theta) ? pt.theta : null, R = th != null ? pt.R : null;
      const o = th == null ? { labels: false } : R <= spanB ? { hook: { x: R * Math.sin(rad(th)), y: R * Math.cos(rad(th)) }, labels: false } : { slew: th, R, boom: false, labels: false };
      try { sym = CG.symbol(c, u0, o); } catch (e) { sym = null; } }
    if (sym) { const CLS = { carrier: 'carrier', outrigger: 'outrigger', float: 'float', upper: 'upper', cwt: 'cwt', boom: 'boom', hook: 'hook', load: 'load' };
      sym.parts.forEach(q => { if (q.g === 'cor' || !CLS[q.g]) return; F.push({ t: 'pl', pts: q.pts.map(w), closed: q.closed, c: CLS[q.g], fill: q.closed && q.g === 'carrier' && q.src === 'fp' && pd.kind === 'crawler' ? 'track' : undefined }); });
      sym.circles.forEach(q => { if (q.g === 'float') F.push({ t: 'circle', at: w(q.c), r: q.r, c: 'float' }); }); }
    else { if (fp.body) F.push({ t: 'pl', pts: fp.body.map(w), closed: true, c: 'obj' });
      fp.tracks.forEach(q => F.push({ t: 'pl', pts: q.map(w), closed: true, c: 'obj', fill: 'track' }));
      fp.beams.forEach(b => F.push({ t: 'line', a: w(b[0]), b: w(b[1]), c: 'obj' }));
      fp.floatC.forEach(q => F.push({ t: 'circle', at: w(q), r: q.r, c: 'float' })); }
    if (isNum(fp.tail)) F.push({ t: 'circle', at: [0, 0], r: fp.tail, c: 'tail' });
    F.push({ t: 'cross', at: [0, 0], r: span / 25, c: 'obj' }); F.push(txt([0, 0], 'rotation centre', { a: 2, off: [-0.8, -1.5], size: 0.75 }));
    // heading arrow (carrier front) and the boom direction at the chosen point (slew θ), the counterweight at −r_cw on it
    const ah = (fp.dims.body ? fp.dims.body.front : span * 0.6) + d * 2.2;
    F.push({ t: 'arrow', a: [0, ah - d * 1.8], b: [0, ah + d * 0.6], c: 'head' }); F.push(txt([0, ah + d * 0.9], virt ? 'carrier front' : `carrier front: heading ${fmt(u.heading || 0, 1)}° (grid)`, { a: 1, size: 0.8, v: virt ? undefined : 'heading', val: virt ? undefined : u.heading || 0, src: virt ? undefined : 'entered' }));
    if (vals.e) { F.push({ t: 'dot', at: [0, vals.e.v], c: 'boom' }); }
    if (pt && isNum(pt.theta)) { const ux = Math.sin(rad(pt.theta)), uy = Math.cos(rad(pt.theta)), Lb = Math.min(pt.R, span * 1.4);   // local û = (cos θ, −sin θ) -> world (sin θ, cos θ)
      F.push({ t: 'line', a: [ux * vals.e.v, uy * vals.e.v], b: [ux * Lb, uy * Lb], c: 'boom' }); F.push(txt([ux * Lb, uy * Lb], `boom: θ ${fmt(pt.theta, 1)}°, R ${fmt(pt.R, 2)} ft${pt.R > Lb ? ' (cut)' : ''}`, { size: 0.75, a: ux < -0.3 ? 2 : ux > 0.3 ? 0 : 1, off: [ux < -0.3 ? -0.4 : 0.4, 0.5], v: 'pt.R', val: pt.R, src: 'engine' }));
      if (isNum(inp.rcw)) { const r = inp.rcw; F.push({ t: 'pl', pts: [[-ux * r - uy * d, -uy * r + ux * d], [-ux * r + uy * d, -uy * r - ux * d], [-ux * (r - d) + uy * d, -uy * (r - d) - ux * d], [-ux * (r - d) - uy * d, -uy * (r - d) + ux * d]], closed: true, c: 'cw' });
        F.push(lbl(m, 'rcw', [-ux * r, -uy * r], { pre: 'counterweight CG r_cw = ', a: 2, off: [-1.2, 0.3], size: 0.75 })); } }
    // dimensions
    const body = fp.dims.body;
    const outX = Math.max(body ? body.width / 2 : 0, fp.dims.outr && fp.spread ? fp.dims.outr.spreads[fp.spread] / 2 + 1 : 0, pd.crawler && isNum(pd.crawler.gauge) ? pd.crawler.gauge / 2 + 2 : 0);
    if (body && vals.bodyF) { const x = outX + d * 2.2; F.push({ t: 'dim', a: [x, 0], b: [x, body.front], s: `front ${fmt(body.front, 2)} ft`, v: 'bodyF', val: body.front, src: vals.bodyF.srcText, assumed: vals.bodyF.assumed });
      F.push({ t: 'dim', a: [x, -body.rear], b: [x, 0], s: `rear ${fmt(body.rear, 2)} ft`, v: 'bodyR', val: body.rear, src: vals.bodyR.srcText, assumed: vals.bodyR.assumed });
      F.push({ t: 'dim', a: [-body.width / 2, -body.rear - d * 1.2], b: [body.width / 2, -body.rear - d * 1.2], s: `width ${fmt(body.width, 2)} ft`, v: 'bodyW', val: body.width, src: vals.bodyW.srcText, assumed: vals.bodyW.assumed }); }
    if (pd.kind === 'crawler' && fp.tracks.length) { const cw = pd.crawler, L2 = cw.length / 2, gx = cw.gauge / 2;
      F.push({ t: 'dim', a: [-gx - d * 2, -L2], b: [-gx - d * 2, L2], s: `track length ${fmt(cw.length, 2)} ft`, v: 'trkL', val: cw.length, src: vals.trkL.srcText, assumed: vals.trkL.assumed });
      F.push({ t: 'dim', a: [-gx, L2 + d * 1.2], b: [gx, L2 + d * 1.2], s: `gauge ${fmt(cw.gauge, 2)} ft`, v: 'gauge', val: cw.gauge, src: vals.gauge.srcText, assumed: vals.gauge.assumed });
      F.push(lbl(m, 'shoe', [gx, -L2], { pre: 'shoe ', off: [0.6, -1.4], size: 0.8 })); if (vals.shoeG) F.push(lbl(m, 'shoeG', [gx, -L2], { pre: 'ground calc. shoe ', off: [0.6, -2.6], size: 0.75 })); }
    if (fp.floatC.length && pd.outr) { const o = pd.outr, b = o.spreads[fp.spread] / 2, yF = o.xFront, yR = -o.xRear;
      F.push({ t: 'dim', a: [-b, yF + d * 1.4], b: [b, yF + d * 1.4], s: `spread (${fp.spread}) ${fmt(2 * b, 2)} ft`, v: 'spread', val: 2 * b, src: vals.spread.srcText, assumed: vals.spread.assumed });
      F.push({ t: 'dim', a: [-b - d * 1.6, 0], b: [-b - d * 1.6, yF], s: `x_F ${fmt(o.xFront, 2)} ft`, v: 'xF', val: o.xFront, src: vals.xF.srcText, assumed: vals.xF.assumed });
      F.push({ t: 'dim', a: [-b - d * 1.6, yR], b: [-b - d * 1.6, 0], s: `x_R ${fmt(o.xRear, 2)} ft`, v: 'xR', val: o.xRear, src: vals.xR.srcText, assumed: vals.xR.assumed });
      F.push(lbl(m, 'float', [b, yR], { pre: 'float ', off: [0.8, -1.6], size: 0.8 })); if (vals.floatG && vals.floatG.v !== vals.float.v) F.push(lbl(m, 'floatG', [b, yR], { pre: 'bearing calc. float ', off: [0.8, -2.8], size: 0.75 }));
      ['FL', 'FR', 'RL', 'RR'].forEach((id, i) => { const q = fp.floatC[[0, 1, 2, 3][i]]; if (q) F.push(txt(w(q), id, { a: 1, off: [0, 1.3], size: 0.7 })); }); }
    else if (pd.kind !== 'crawler') F.push(txt([0, -span * 0.9], vals.spread && vals.spread.src.note ? 'no outriggers drawn: ' + vals.spread.src.note : 'no outriggers drawn', { a: 1, size: 0.8, assumed: true }));
    if (isNum(fp.tail)) { const a = rad(225), p = [Math.sin(a) * fp.tail, Math.cos(a) * fp.tail]; F.push({ t: 'line', a: [0, 0], b: p, c: 'dim' }); F.push(lbl(m, 'tail', p, { pre: 'tail swing R_t = ', off: [-0.4, -1.4], a: 2, size: 0.8 })); }
    else F.push(txt([0, -span], 'tail-swing radius not given', { a: 1, size: 0.8, assumed: true }));
    if (vals.e) F.push(lbl(m, 'e', [0, vals.e.v], { pre: 'boom foot e = ', off: [0.8, -0.4], size: 0.75 }));
    // zone sectors (entered) of a zoned chart group
    if (chs.zoned) { const sec = (c.app_inputs || {}).sectors || {}, rr = (isNum(fp.tail) ? fp.tail : span) * 1.25;
      const ray = (deg, tag, id) => { const p = [Math.sin(rad(deg)) * rr, Math.cos(rad(deg)) * rr]; F.push({ t: 'line', a: [0, 0], b: p, c: 'zone' }); if (tag) F.push(lbl(m, id, p, { pre: tag, size: 0.7, off: [0.3, 0.3] })); };
      if (isNum(sec.front) && sec.front > 0) { ray(sec.front, 'over front ±', 'secF'); ray(-sec.front); }
      if (isNum(sec.rear) && sec.rear > 0) { ray(180 - sec.rear, 'over rear ±', 'secR'); ray(-(180 - sec.rear)); }
      if (!(sec.front > 0) && !(sec.rear > 0)) F.push(txt([0, -rr], 'zone charts in this group, sectors NOT SET: the 360° / over-side chart is used everywhere', { a: 1, size: 0.75, assumed: true }));
      else F.push(txt([0, -rr - d], 'outside the sectors: over side (360° chart where no over-side chart)', { a: 1, size: 0.7 })); }
    else F.push(txt([0, -(isNum(fp.tail) ? fp.tail : span) - d * 2], '360° chart (no zone charts in this configuration)', { a: 1, size: 0.75 }));
    return { prims: F.filter(Boolean), scale: true, title: 'Plan (crane frame, carrier front up; to scale)' };
  }
  /* side elevation along the boom at the chosen point (s: horizontal from the rotation centre toward the hook, z: elevation) */
  function elev(m) {
    const F = [], { g, pt, u, vals } = m; if (!pt) return null;
    const zp = EL().padEl(u), R = pt.R, tail = isNum(g.tail) ? g.tail : 10, fz = zp + g.footH, e = g.footE, d = Math.max(R, 20) / 30;
    F.push({ t: 'line', a: [-tail - 6, zp], b: [R + Math.max(8, (pt.Lload || 0) / 2 + 6), zp], c: 'ground' }); F.push(lbl(m, 'pad', [R + Math.max(8, (pt.Lload || 0) / 2 + 6), zp], { pre: 'pad el. ', a: 2, off: [0, -1.3], size: 0.8 }));
    if (isNum(pt.zg) && Math.abs(pt.zg - zp) > 1e-6) F.push({ t: 'line', a: [R - 8, pt.zg], b: [R + 8, pt.zg], c: 'ground' });
    // counterweight (bottom / top above the pad) to the tail-swing radius
    const cb = zp + g.cwBot, ct = isNum(g.cwTop) ? zp + g.cwTop : null, cx0 = -tail, cx1 = -tail * 0.55;
    F.push({ t: 'pl', pts: [[cx0, cb], [cx1, cb], [cx1, ct != null ? ct : cb + Math.max(4, tail * 0.3)], [cx0, ct != null ? ct : cb + Math.max(4, tail * 0.3)]], closed: true, c: ct != null ? 'cw' : 'cwopen' });
    F.push({ t: 'dim', a: [cx0, zp], b: [cx0, cb], side: -1, s: `z_cb ${fmt(g.cwBot, 2)} ft`, v: 'cwBot', val: g.cwBot, src: vals.cwBot.srcText, assumed: vals.cwBot.assumed });
    if (ct != null) F.push({ t: 'dim', a: [cx0 - d * 4, zp], b: [cx0 - d * 4, ct], side: -1, s: `z_ct ${fmt(g.cwTop, 2)} ft`, v: 'cwTop', val: g.cwTop, src: vals.cwTop.srcText, assumed: vals.cwTop.assumed });
    else F.push(lbl(m, 'cwTop', [cx0, cb + Math.max(4, tail * 0.3)], { pre: 'counterweight top ', off: [0, 0.6], size: 0.75 }));
    if (isNum(g.tail)) F.push({ t: 'dim', a: [-tail, zp - d * 3], b: [0, zp - d * 3], s: `R_t ${fmt(tail, 2)} ft`, v: 'tail', val: tail, src: vals.tail.srcText, assumed: vals.tail.assumed });
    F.push({ t: 'line', a: [0, zp - d], b: [0, fz + d * 4], c: 'axis' }); F.push(txt([0, fz + d * 4], 'rotation axis', { a: 1, size: 0.7, off: [0, 0.4] }));
    F.push({ t: 'dot', at: [e, fz], c: 'boom' });
    F.push({ t: 'dim', a: [e + d * 2, zp], b: [e + d * 2, fz], s: `h_f ${fmt(g.footH, 2)} ft`, v: 'footH', val: g.footH, src: vals.footH.srcText, assumed: vals.footH.assumed });
    F.push({ t: 'dim', a: [0, fz + d * 2.4], b: [e, fz + d * 2.4], s: `e ${fmt(e, 2)} ft`, v: 'e', val: e, src: vals.e.srcText, assumed: vals.e.assumed, small: true });
    F.push({ t: 'dim', a: [0, zp - d * 6], b: [R, zp - d * 6], s: `R ${fmt(R, 2)} ft (${pt.where})`, v: 'pt.R', val: R, src: 'engine' });
    if (isNum(pt.zTip)) {
      F.push({ t: 'line', a: [e, fz], b: [R, pt.zTip], c: 'boomL' });
      const mid = [(e + R) / 2, (fz + pt.zTip) / 2]; F.push(Object.assign(lbl(m, 'boom', mid, { pre: 'boom L = ', off: [-0.6, 0.6], a: 2, size: 0.85 }) || txt(mid, ''), {}));
      if (pt.ang && isNum(pt.ang.theta)) F.push({ t: 'text', at: [e, fz], s: `θ = ${fmt(pt.ang.theta, 2)}° (${pt.ang.used === 'chart' ? 'chart' : 'geometry'})`, off: [2.2, 0.5], size: 0.8, v: 'pt.theta', val: pt.ang.theta, src: pt.ang.used === 'chart' ? 'chart' : 'engine' });
      F.push({ t: 'dot', at: [R, pt.zTip], c: 'boom' }); F.push({ t: 'text', at: [R, pt.zTip], s: `tip el. ${fmt(pt.zTip, 2)}`, off: [0.6, 0.5], size: 0.85, v: 'pt.zTip', val: pt.zTip, src: 'engine' });
      if (g.head > 0 || vals.head.assumed) F.push({ t: 'text', at: [R, pt.zTip - g.head], s: `H_hd ${fmt(g.head, 2)} ft`, off: [0.6, -0.9], size: 0.75, v: 'head', val: g.head, src: vals.head.srcText, assumed: vals.head.assumed });
      F.push({ t: 'line', a: [R, pt.zTip], b: [R, pt.zBk], c: 'rope' });
    } else F.push(txt([R, zp + 10], 'the boom cannot reach this radius', { a: 1, assumed: true }));
    // hook block, rigging, load
    if (isNum(pt.zHk)) {
      F.push({ t: 'pl', pts: [[R - 0.8, pt.zHk], [R + 0.8, pt.zHk], [R + 0.8, pt.zBk], [R - 0.8, pt.zBk]], closed: true, c: 'block' });
      const hw = Math.max((pt.Lload || 0) / 2, 1), zLt = pt.zLb + pt.H;
      if (pt.zHk > zLt) { F.push({ t: 'line', a: [R, pt.zHk], b: [R - hw * 0.8, zLt], c: 'rope' }); F.push({ t: 'line', a: [R, pt.zHk], b: [R + hw * 0.8, zLt], c: 'rope' }); }
      F.push({ t: 'pl', pts: [[R - hw, pt.zLb], [R + hw, pt.zLb], [R + hw, zLt], [R - hw, zLt]], closed: true, c: 'load' });
      const x = R + hw + d * 2;
      F.push({ t: 'text', at: [x, pt.zBk], s: `block top el. ${fmt(pt.zBk, 2)} (h_bk ${fmt(pt.hbk, 2)} ft)`, size: 0.75, stack: 'hk', v: 'pt.zBk', val: pt.zBk, src: 'engine' });
      F.push({ t: 'text', at: [x, pt.zHk], s: `hook el. ${fmt(pt.zHk, 2)} (rigging h_r ${fmt(pt.hr, 2)} ft)`, size: 0.75, stack: 'hk', v: 'pt.zHk', val: pt.zHk, src: 'engine' });
      F.push({ t: 'text', at: [x, pt.zLb], s: `${pt.girder ? 'girder' : 'load'} bottom el. ${fmt(pt.zLb, 2)}${pt.trav ? (pt.travEntered ? ' (travel, entered)' : ' (travel: higher of pick / set)') : ''}, H ${fmt(pt.H, 2)} ft`, size: 0.75, stack: 'hk', v: 'pt.zLb', val: pt.zLb, src: 'engine' });
      F.push({ t: 'text', at: [R + hw + d * 2, pt.zLb], s: `W = ${fmt(pt.W, 0)} lb (load + rigging + block + other)`, stack: 'hk', size: 0.8, v: 'pt.W', val: pt.W, src: 'engine' });
      if (isNum(pt.m)) F.push({ t: 'text', at: [x, (pt.zBk + (isNum(pt.zTip) ? pt.zTip - g.head : pt.zBk)) / 2], s: `hook reach margin m = ${fmt(pt.m, 2)} ft${pt.m < 0 ? ' (CANNOT REACH)' : ''}`, size: 0.8, v: 'pt.m', val: pt.m, src: 'engine', warn: pt.m < 0 });
    }
    return { prims: F.filter(Boolean), scale: true, title: `Side elevation along the boom, ${pt.where} (to scale)` };
  }
  /* the load chart: capacity vs radius; world x = R, y = C (lb) / ky */
  function chartFig(m) {
    const ch = m.chart; if (!ch) return null;
    const F = [], kx = 100 / (ch.Rmax * 1.05), Wmax = Math.max(ch.Cmax, ...ch.pts.map(p => p.W)), ky = 62 / (Wmax * 1.08), X = R => R * kx, Y = C => C * ky;
    // axes, grid, ticks
    const xs = niceTicks(0, ch.Rmax * 1.05, 6), ys = niceTicks(0, Wmax * 1.08, 6);
    F.push({ t: 'line', a: [0, 0], b: [X(ch.Rmax * 1.05), 0], c: 'axis' }); F.push({ t: 'line', a: [0, 0], b: [0, Y(Wmax * 1.08)], c: 'axis' });
    xs.forEach(v => { F.push({ t: 'line', a: [X(v), 0], b: [X(v), Y(Wmax * 1.08)], c: 'grid' }); F.push(txt([X(v), 0], fmt(v, 0), { a: 1, off: [0, -1.3], size: 0.7 })); });
    ys.forEach(v => { F.push({ t: 'line', a: [0, Y(v)], b: [X(ch.Rmax * 1.05), Y(v)], c: 'grid' }); F.push(txt([0, Y(v)], fmt(v / 1000, 0), { a: 2, off: [-0.4, -0.3], size: 0.7 })); });
    F.push(txt([X(ch.Rmax * 1.05) / 2, 0], 'radius R from the rotation centre (ft)', { a: 1, off: [0, -2.6], size: 0.8 })); F.push(txt([0, Y(Wmax * 1.08)], 'capacity / load (kip)', { off: [0.4, 0.6], size: 0.8 }));
    // every tabulated boom length: the rule's steps (thin) and the tabulated points (markers)
    ch.curves.forEach(cv => { const inUse = ch.use && Math.abs(cv.L - ch.use.Ltab) < 1e-6; cv.segs.forEach(sg => F.push({ t: 'pl', pts: sg.map(p => [X(p.R), Y(p.C)]), c: inUse ? 'colUse' : 'col' }));
      const many = ch.curves.length > 6, ci = ch.curves.indexOf(cv), last = cv.segs.length ? cv.segs[cv.segs.length - 1].slice(-1)[0] : null;   // many columns: only the boom in use, the shortest and the longest are named
      if (last && (!many || inUse || ci === 0 || ci === ch.curves.length - 1)) F.push(txt([X(last.R), Y(last.C)], `L ${fmt(cv.L, 0)} ft`, { off: [0.4, 0.2], size: 0.65, c: inUse ? 'use' : 'mute' })); });
    ch.cols.forEach(col => col.pts.forEach(p => F.push({ t: 'mark', at: [X(p.R), Y(p.C)], c: 'tab', v: `cell.${col.j}.${p.R}`, val: p.C, L: col.L, R: p.R })));
    if (ch.use) { ch.use.segs.forEach(sg => F.push({ t: 'pl', pts: sg.map(p => [X(p.R), Y(p.C)]), c: 'use' }));
      ch.thr.forEach(th => ch.use.segs.forEach((sg, i) => { F.push({ t: 'pl', pts: sg.map(p => [X(p.R), Y(p.C * th.pct / 100)]), c: 'thr-' + th.id });
        if (i === ch.use.segs.length - 1) { const q = sg[sg.length - 1]; F.push(txt([X(q.R), Y(q.C * th.pct / 100)], th.label, { off: [0.4, -0.3], size: 0.62, c: 'thr-' + th.id, stack: 'thr' })); } })); }
    // the operating points of every lift on this chart
    ch.pts.forEach(p => { if (!isNum(p.R) || !isNum(p.W)) return; const lab = p.tandem ? (p.gov ? `${p.lift.name} step ${p.step} (governing)` : '') : `${p.lift.name} ${p.tag}`;
      F.push({ t: 'op', at: [X(p.R), Y(p.W)], cls: p.cls, small: p.tandem && !p.gov, v: `op.${p.lift.key}.${p.tandem ? p.step : p.tag}`, val: p.pct, R: p.R, W: p.W });
      if (lab) F.push({ t: 'text', at: [X(p.R), Y(p.W)], s: `${lab}: R ${fmt(p.R, 2)} ft, W ${fmt(p.W, 0)} lb, ${p.ok ? fmt(p.pct, 1) + ' % of chart' : 'not permitted'}`, off: [0.7, 0.4 + (p.tag === 'S' ? -1.3 : 0)], size: 0.68, v: `oplbl.${p.lift.key}.${p.tandem ? p.step : p.tag}`, val: p.pct, src: 'engine', warn: !p.ok || p.cls === 'over' }); });
    return { prims: F, scale: false, title: `Load chart: ${ch.cfg.label || ch.cfg.id}` };
  }
  function niceTicks(a, b, n) { const st = nice((b - a) / n), out = []; for (let v = Math.ceil(a / st) * st; v <= b + 1e-9; v += st) out.push(+v.toFixed(6)); return out; }
  function nice(v) { if (!(v > 0)) return 1; const e = Math.pow(10, Math.floor(Math.log10(v))), f = v / e; return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * e; }
  /* the weights and CGs of C4 at the governing support's slew angle: arrows along the boom line (projected), the support loads */
  function weights(m) {
    const gr = m.ground; if (!gr || gr.mode === 'none' || !gr.gov) return { prims: [txt([0, 0], gr && gr.why ? 'Outrigger / track loads not computed: ' + gr.why : 'No lift: no outrigger / track loads.', { assumed: true })], scale: false, title: 'Weights and CGs (C4)', none: true };
    const F = [], s = gr.gov.s, th = s.theta, inp = gr.inp, V = m.vals, ux = Math.cos(rad(th)), uy = -Math.sin(rad(th)), proj = (x, y) => x * ux + y * uy;
    const items = gr.mode === 'rigid' ? s.ps.map(q => ({ id: q.id, name: q.name, W: q.W, r: proj(q.x, q.y), x: q.x, y: q.y })) : [{ id: 'Q', name: 'crane without the hook load (G + W_cw), CG anywhere in the rest box', W: s.Q, r: null, box: s.box }, { id: 'h', name: 'hook load', W: gr.W, r: s.R }];
    const rs = items.filter(q => isNum(q.r)).map(q => q.r).concat(gr.S.kind === 'wheeled' ? [gr.S.xF, -gr.S.xR] : [gr.S.Lt / 2, -gr.S.Lt / 2]);
    const r0 = Math.min(...rs, 0) - 4, r1 = Math.max(...rs, 0) + 4, span = r1 - r0, Wm = Math.max(...items.map(q => q.W)), hA = span * 0.28;
    F.push({ t: 'line', a: [r0, 0], b: [r1, 0], c: 'axis' }); F.push({ t: 'cross', at: [0, 0], r: span / 60, c: 'obj' }); F.push(txt([0, 0], 'rotation centre', { a: 1, off: [0, -1.4], size: 0.7 }));
    F.push(txt([r1, 0], `boom direction at θ = ${fmt(th, 1)}° (governing slew of the ${gr.gov.name})`, { a: 2, off: [0, 0.6], size: 0.72 }));
    const srcOf = { c: ['Wc', 'xc'], u: ['Wu', 'xu'], cw: ['Wcw', 'rcw'], b: ['Wb', 'fb'] };
    items.forEach((q, i) => {
      const len = hA * (0.35 + 0.65 * q.W / Wm), yy = -1.6 - i * 1.25;
      if (isNum(q.r)) { F.push({ t: 'arrow', a: [q.r, len], b: [q.r, 0], c: q.id === 'h' ? 'hook' : 'wt' });
        const sv = srcOf[q.id], ws = sv ? `${V[sv[0]].srcText}` : 'engine', xs = sv ? V[sv[1]].srcText : 'engine';
        F.push({ t: 'text', at: [q.r, len], s: `${q.name}: ${fmt(q.W, 0)} lb [${ws}] at ${fmt(q.r, 2)} ft${q.id === 'c' ? ` (x_c ${fmt(q.x, 2)} ft along the carrier [${xs}], projected)` : q.id === 'b' ? ` (f_b ${fmt(inp.fb, 2)} [${xs}])` : q.id === 'cw' ? ` (r_cw [${xs}])` : q.id === 'u' ? ` (x_u [${xs}])` : ' (R)'}`,
          a: 1, off: [0, 0.4 + (i % 2) * 1.1], size: 0.66, v: 'w.' + q.id, val: q.W, src: ws, assumed: sv ? (V[sv[0]].assumed || V[sv[1]].assumed) : false }); }
      else { const b = q.box, a0 = Math.min(proj(b.x0, b.y0), proj(b.x1, b.y1), proj(b.x0, b.y1), proj(b.x1, b.y0)), a1 = Math.max(proj(b.x0, b.y0), proj(b.x1, b.y1), proj(b.x0, b.y1), proj(b.x1, b.y0));
        F.push({ t: 'line', a: [a0, len], b: [a1, len], c: 'wt' }); F.push({ t: 'arrow', a: [(a0 + a1) / 2, len], b: [(a0 + a1) / 2, 0], c: 'wt' });
        F.push({ t: 'text', at: [(a0 + a1) / 2, len], s: `${q.name}: Q = ${fmt(q.W, 0)} lb (G [${V.G.srcText}] + W_cw [${V.Wcw.srcText}]) — ESTIMATE`, a: 1, off: [0, 0.4], size: 0.66, v: 'w.Q', val: q.W, src: 'engine', assumed: true }); }
      void yy;
    });
    // the supports on the boom line (projected) and the largest loads
    gr.S.items.forEach(it => { const r = proj(it.lx, it.ly); F.push({ t: 'tri', at: [r, 0], r: span / 70, c: 'sup' }); F.push(txt([r, 0], it.id, { a: 1, off: [0, -2.4], size: 0.65 })); });
    const isTr = gr.S.kind === 'crawler', y0 = -hA * 0.35;
    F.push(txt([r0, y0], `${gr.mode === 'rigid' ? 'Rigid body (entered weights and CGs)' : 'ESTIMATE (bounding): verify with the manufacturer\'s outrigger calculator'}; V = ${fmt(s.V, 0)} lb at this slew${gr.mode === 'rigid' ? `, resultant X = ${fmt(s.X, 2)} ft, Y = ${fmt(s.Y, 2)} ft` : ''}`, { size: 0.72, assumed: gr.mode !== 'rigid', v: 'w.V', val: s.V, src: 'engine' }));
    gr.max.forEach((mx, i) => F.push({ t: 'text', at: [r0, y0], off: [0, -1.25 * (i + 1)], size: 0.72, s: `${mx.name} (${mx.id}): max ${isTr ? `V_t ${fmt(mx.load, 0)} lb, q_max ${fmt(mx.q, 0)} psf` : fmt(mx.load, 0) + ' lb'} at θ ${fmt(mx.theta, 1)}°, R ${fmt(mx.R, 2)} ft${mx === gr.gov ? ' (governing)' : ''}`, v: 'max.' + mx.id, val: mx.load, src: 'engine', bold: mx === gr.gov }));
    return { prims: F, scale: true, title: `Weights and CGs used for the ${isTr ? 'track' : 'outrigger'} loads (C4)` };
  }

  /* ---------- SVG renderer ---------- */
  const COL = { carrier: '#1E3A5F', outrigger: '#0E7490', upper: '#166534', cwt: '#7C3AED', load: '#DC2626', obj: '#1E3A5F', float: '#2563EB', tail: '#7C3AED', head: '#059669', boom: '#0F172A', boomL: '#0F172A', cw: '#64748B', cwopen: '#94A3B8', dim: '#475569', zone: '#DB2777', ground: '#78716C', axis: '#334155', grid: '#E2E8F0',
    rope: '#334155', block: '#334155', load: '#2563EB', col: '#94A3B8', colUse: '#94A3B8', use: '#1D4ED8', tab: '#475569', mute: '#94A3B8', wt: '#0F766E', hook: '#B91C1C', sup: '#334155',
    'thr-caution': '#D97706', 'thr-critical': '#EA580C', 'thr-limit': '#DC2626', 'thr-tandem': '#7C3AED', track: '#CBD5E1' };
  const OPC = { ok: '#059669', caution: '#D97706', critical: '#EA580C', over: '#DC2626', np: '#DC2626' };
  function bounds(prims) {
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity; const add = (x, y) => { if (!isNum(x) || !isNum(y)) return; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    prims.forEach(p => { if (p.t === 'line' || p.t === 'arrow' || p.t === 'dim') { add(...p.a); add(...p.b); } else if (p.t === 'pl') p.pts.forEach(q => add(...q)); else if (p.t === 'circle') { add(p.at[0] - p.r, p.at[1] - p.r); add(p.at[0] + p.r, p.at[1] + p.r); } else if (p.at) add(...p.at); });
    return { x0, x1, y0, y1 };
  }
  const tw = (s, fs) => String(s).length * fs * 0.58;
  /* svg(fig, o = { w, h, fs }) -> '<svg …>' (text carries data-v / data-val / data-src: the Node test reads them) */
  function svg(fig, o) {
    if (!fig) return ''; o = o || {}; const W = o.w || 640, Hmax = o.h || 460, fs0 = o.fs || 11, pad = 14;
    const b = bounds(fig.prims); if (!isFinite(b.x0)) return '';
    // two passes: the scale from the geometry, then grown to keep the labels inside
    let k = Math.min((W - 2 * pad) / Math.max(b.x1 - b.x0, 1e-6), (Hmax - 2 * pad) / Math.max(b.y1 - b.y0, 1e-6)), bb = Object.assign({}, b);
    for (let it = 0; it < 5; it++) { bb = Object.assign({}, b);
      fig.prims.forEach(p => { if (p.t !== 'text' && p.t !== 'dim') return; const fs = fs0 * (p.size || 0.9), s = p.t === 'dim' ? p.s + (p.src && p.src !== 'engine' ? ` [${p.src}]` : '') : p.s + (p.src && p.src !== 'engine' && p.v && !/^\w+\./.test(p.v) ? ` [${p.src}]` : ''), w0 = tw(s, fs) / k;
        const at = p.t === 'dim' ? [(p.a[0] + p.b[0]) / 2, (p.a[1] + p.b[1]) / 2] : p.at, ox = ((p.off && p.off[0]) || 0) * fs / k, oy = ((p.off && p.off[1]) || 0) * fs / k, a = p.t === 'dim' ? (Math.abs(p.b[0] - p.a[0]) < Math.abs(p.b[1] - p.a[1]) ? (p.side === -1 ? 2 : 0) : 1) : p.a || 0;
        const xl = at[0] + ox - (a === 1 ? w0 / 2 : a === 2 ? w0 : 0); bb.x0 = Math.min(bb.x0, xl); bb.x1 = Math.max(bb.x1, xl + w0); bb.y0 = Math.min(bb.y0, at[1] + oy - fs / k); bb.y1 = Math.max(bb.y1, at[1] + oy + fs / k); });
      k = Math.min((W - 2 * pad) / Math.max(bb.x1 - bb.x0, 1e-6), (Hmax - 2 * pad) / Math.max(bb.y1 - bb.y0, 1e-6)); }
    const Ht = Math.ceil((bb.y1 - bb.y0) * k + 2 * pad), X = x => +(pad + (x - bb.x0) * k).toFixed(1), Y = y => +(Ht - pad - (y - bb.y0) * k).toFixed(1);
    const out = [], col = c => COL[c] || '#334155';
    const stroke = c => ({ grid: 0.6, col: 0.9, colUse: 1.2, use: 2.4, boomL: 2.6, ground: 1.4, zone: 1, dim: 0.8, tail: 1, 'thr-caution': 1.1, 'thr-critical': 1.1, 'thr-limit': 1.3, 'thr-tandem': 1.1 })[c] || 1.3;
    const dash = c => ({ tail: '6 4', zone: '2 3', cwopen: '4 3', 'thr-caution': '5 3', 'thr-critical': '7 3 2 3', 'thr-limit': '8 3', 'thr-tandem': '3 3', axis: '', grid: '' })[c] || '';
    const dAttr = c => dash(c) ? ` stroke-dasharray="${dash(c)}"` : '';
    const label = (x, y, s, p, fs, anchor) => {
      const srcS = p.src && p.src !== 'engine' && (p.t === 'dim' || (p.v && !/^\w+\./.test(p.v))) ? ` [${p.src}]` : '', full = s + srcS, wpx = tw(full, fs), xa = anchor === 1 ? x - wpx / 2 : anchor === 2 ? x - wpx : x;
      const amber = p.assumed, warn = p.warn, cls = p.c && COL[p.c] ? COL[p.c] : '#0F172A';
      const data = p.v ? ` data-v="${esc(p.v)}"${p.val != null ? ` data-val="${esc(p.val)}"` : ''}${p.src ? ` data-src="${esc(p.src)}"` : ''}${amber ? ' data-assumed="1"' : ''}` : (amber ? ' data-assumed="1"' : '');
      return (amber ? `<rect x="${(xa - 2).toFixed(1)}" y="${(y - fs * 0.95).toFixed(1)}" width="${(wpx + 4).toFixed(1)}" height="${(fs * 1.3).toFixed(1)}" rx="2" fill="#FEF3C7" stroke="#F59E0B" stroke-width="0.6"/>` : '')
        + `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" font-size="${fs.toFixed(1)}"${anchor === 1 ? ' text-anchor="middle"' : anchor === 2 ? ' text-anchor="end"' : ''} fill="${warn ? '#B91C1C' : amber ? '#92400E' : cls}"${p.bold ? ' font-weight="700"' : ''}${data}>${esc(s)}${srcS ? `<tspan fill="${amber ? '#B45309' : '#64748B'}" font-size="${(fs * 0.88).toFixed(1)}">${esc(srcS)}</tspan>` : ''}</text>`;
    };
    // drawing order: grid, fills, lines, marks, labels
    const order = p => p.c === 'grid' ? 0 : p.t === 'text' ? 3 : (p.t === 'op' || p.t === 'mark') ? 2 : 1;
    fig.prims.slice().sort((a, b2) => order(a) - order(b2)).forEach(p => {
      const c = col(p.c);
      if (p.t === 'line') out.push(`<line x1="${X(p.a[0])}" y1="${Y(p.a[1])}" x2="${X(p.b[0])}" y2="${Y(p.b[1])}" stroke="${c}" stroke-width="${stroke(p.c)}"${dAttr(p.c)}/>`);
      else if (p.t === 'pl') out.push(`<${p.closed ? 'polygon' : 'polyline'} points="${p.pts.map(q => X(q[0]) + ',' + Y(q[1])).join(' ')}" fill="${p.closed ? (p.fill ? COL[p.fill] : p.c === 'load' ? 'rgba(37,99,235,.15)' : p.c === 'cw' ? 'rgba(100,116,139,.35)' : 'none') : 'none'}" stroke="${c}" stroke-width="${stroke(p.c)}"${dAttr(p.c)} stroke-linejoin="round"/>`);
      else if (p.t === 'circle') out.push(`<circle cx="${X(p.at[0])}" cy="${Y(p.at[1])}" r="${Math.max(1.5, p.r * k).toFixed(1)}" fill="${p.c === 'float' ? 'rgba(37,99,235,.2)' : 'none'}" stroke="${c}" stroke-width="${stroke(p.c)}"${dAttr(p.c)}/>`);
      else if (p.t === 'cross') { const x = X(p.at[0]), y = Y(p.at[1]), r = Math.max(5, p.r * k); out.push(`<path d="M${x - r} ${y}H${x + r}M${x} ${y - r}V${y + r}" stroke="${c}" stroke-width="1.2"/><circle cx="${x}" cy="${y}" r="${(r / 2).toFixed(1)}" fill="none" stroke="${c}"/>`); }
      else if (p.t === 'dot') out.push(`<circle cx="${X(p.at[0])}" cy="${Y(p.at[1])}" r="3" fill="${c}"/>`);
      else if (p.t === 'tri') { const x = X(p.at[0]), y = Y(p.at[1]), r = 6; out.push(`<path d="M${x} ${y}L${x - r} ${y + r * 1.4}H${x + r}Z" fill="#fff" stroke="${c}"/>`); }
      else if (p.t === 'mark') out.push(`<rect x="${X(p.at[0]) - 2.2}" y="${Y(p.at[1]) - 2.2}" width="4.4" height="4.4" fill="#fff" stroke="${c}" stroke-width="1" data-v="${esc(p.v)}" data-val="${esc(p.val)}"><title>L ${fmt(p.L, 1)} ft, R ${fmt(p.R, 1)} ft: ${fmt(p.val, 0)} lb (tabulated)</title></rect>`);
      else if (p.t === 'op') { const r = p.small ? 2.2 : 4.5; out.push(`<circle cx="${X(p.at[0])}" cy="${Y(p.at[1])}" r="${r}" fill="${OPC[p.cls] || '#334155'}" stroke="#fff" stroke-width="${p.small ? 0.5 : 1.2}" data-v="${esc(p.v)}" data-val="${esc(p.val)}" data-r="${esc(p.R)}" data-w="${esc(p.W)}"/>`); }
      else if (p.t === 'arrow') { const x1 = X(p.a[0]), y1 = Y(p.a[1]), x2 = X(p.b[0]), y2 = Y(p.b[1]), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, h = 7;
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${c}" stroke-width="1.8"/><path d="M${x2} ${y2}L${(x2 - ux * h - uy * h * 0.45).toFixed(1)} ${(y2 - uy * h + ux * h * 0.45).toFixed(1)}L${(x2 - ux * h + uy * h * 0.45).toFixed(1)} ${(y2 - uy * h - ux * h * 0.45).toFixed(1)}Z" fill="${c}"/>`); }
      else if (p.t === 'dim') { const x1 = X(p.a[0]), y1 = Y(p.a[1]), x2 = X(p.b[0]), y2 = Y(p.b[1]), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, t = 4;
        out.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${COL.dim}" stroke-width="0.8"/><path d="M${x1 - uy * t} ${y1 + ux * t}L${x1 + uy * t} ${y1 - ux * t}M${x2 - uy * t} ${y2 + ux * t}L${x2 + uy * t} ${y2 - ux * t}" stroke="${COL.dim}" stroke-width="1"/>`);
        const fs = fs0 * (p.small ? 0.72 : 0.8), vert = Math.abs(uy) > Math.abs(ux), mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
        out.push(vert ? label(mx + (p.side === -1 ? -5 : 5), my + fs / 3, p.s, p, fs, p.side === -1 ? 2 : 0) : label(mx, my - 4, p.s, p, fs, 1)); }
    });
    const tl = fig.prims.filter(p => p.t === 'text').map(p => { const fs = fs0 * (p.size || 0.9); return { p, fs, x: X(p.at[0]) + ((p.off && p.off[0]) || 0) * fs, y: Y(p.at[1]) - ((p.off && p.off[1]) || 0) * fs }; });
    // labels of one stack (values that can coincide, e.g. block top / hook / load bottom): kept 1.25 text heights apart, top down
    [...new Set(tl.filter(q => q.p.stack).map(q => q.p.stack))].forEach(sk => { let last = -Infinity; tl.filter(q => q.p.stack === sk).sort((a, b2) => a.y - b2.y).forEach(q => { q.y = Math.max(q.y, last + q.fs * 1.25); last = q.y; }); });
    tl.forEach(q => out.push(label(q.x, q.y, q.p.s, q.p, q.fs, q.p.a || 0)));
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}" role="img" aria-label="${esc(fig.title || 'crane figure')}" font-family="Segoe UI, Roboto, Arial, sans-serif" style="max-width:100%;height:auto;background:#fff">`
      + (o.legend !== false && fig.legend ? '' : '') + out.join('') + '</svg>';
  }

  /* ---------- DXF (the Crane sheet): the same primitives with shared/dxf.js ---------- */
  const asc = s => String(s == null ? '' : s).replace(/[θ]/g, 'THETA').replace(/[±]/g, '+/-').replace(/[°]/g, ' DEG').replace(/[—–]/g, '-').replace(/[·]/g, '-').replace(/[≥]/g, '>=').replace(/[≤]/g, '<=').replace(/[²]/g, '2').replace(/[^\x20-\x7E]/g, '');
  const UP = s => asc(s).toUpperCase();
  /* dxf(D, fig, o = { kx (inches per world unit), title }) draws fig at the origin; returns the bbox index range */
  function dxf(D, fig, o) {
    if (!fig) return; o = o || {}; const kx = o.kx || 12, h = D.h, X = x => x * kx, Y = y => y * kx;
    const lay = c => D.layer('CRANE-' + String(c || 'obj').toUpperCase().replace(/[^A-Z0-9]/g, '-'), ({ carrier: 5, outrigger: 4, upper: 3, cwt: 6, load: 1, obj: 5, float: 30, tail: 6, head: 3, boom: 7, boomL: 7, use: 5, col: 8, colUse: 8, grid: 9, zone: 6, 'thr-caution': 30, 'thr-critical': 30, 'thr-limit': 1, 'thr-tandem': 6, hook: 1, wt: 4, dim: 2 })[c] || 7);
    const lT = D.layer('TEXT', 7), lA = D.layer('CRANE-ASSUMED', 30);
    const lt = c => ({ tail: 'PHANTOM', zone: 'DASHED', cwopen: 'DASHED', 'thr-caution': 'DASHED', 'thr-critical': 'CENTER', 'thr-limit': 'DASHED', 'thr-tandem': 'HIDDEN' })[c];
    const stk = {};
    const T = (p, s, x, y, j, sz) => { if (p.stack) { const k0 = p.stack + ':' + Math.round(x); if (stk[k0] != null && y > stk[k0] - 1.25 * h * (sz || 0.8)) y = stk[k0] - 1.25 * h * (sz || 0.8); stk[k0] = y; }
      D.text(p.assumed ? lA : lT, x, y, h * (sz || 0.8), UP(s) + (p.src && p.src !== 'engine' && (p.t === 'dim' || (p.v && !/^\w+\./.test(p.v))) ? ` [${UP(p.src)}]` : ''), j || 0); };
    fig.prims.forEach(p => {
      if (p.t === 'line') D.line(lay(p.c), X(p.a[0]), Y(p.a[1]), X(p.b[0]), Y(p.b[1]), lt(p.c) ? D.ltype(lt(p.c)) : undefined);
      else if (p.t === 'pl') D.pline(lay(p.c), p.pts.map(q => [X(q[0]), Y(q[1])]), p.closed, lt(p.c) ? D.ltype(lt(p.c)) : undefined);
      else if (p.t === 'circle') D.circle(lay(p.c), X(p.at[0]), Y(p.at[1]), p.r * kx);
      else if (p.t === 'cross') { const x = X(p.at[0]), y = Y(p.at[1]), r = 0.6 * h; D.circle(lay(p.c), x, y, r); D.line(lay(p.c), x - 2 * r, y, x + 2 * r, y); D.line(lay(p.c), x, y - 2 * r, x, y + 2 * r); }
      else if (p.t === 'dot') D.circle(lay(p.c), X(p.at[0]), Y(p.at[1]), 0.25 * h);
      else if (p.t === 'tri') { const x = X(p.at[0]), y = Y(p.at[1]), r = 0.5 * h; D.pline(lay('sup'), [[x, y], [x - r, y - 1.4 * r], [x + r, y - 1.4 * r]], true); }
      else if (p.t === 'mark') { const x = X(p.at[0]), y = Y(p.at[1]), r = 0.2 * h; D.rect(lay('tab'), x - r, y - r, x + r, y + r); }
      else if (p.t === 'op') { const x = X(p.at[0]), y = Y(p.at[1]); D.circle(D.layer('CRANE-OP-' + String(p.cls || 'ok').toUpperCase(), ({ ok: 3, caution: 30, critical: 30, over: 1, np: 1 })[p.cls] || 7), x, y, (p.small ? 0.15 : 0.35) * h); }
      else if (p.t === 'arrow') { const x1 = X(p.a[0]), y1 = Y(p.a[1]), x2 = X(p.b[0]), y2 = Y(p.b[1]), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, a = 0.6 * h;
        D.line(lay(p.c), x1, y1, x2, y2); D.pline(lay(p.c), [[x2, y2], [x2 - ux * a - uy * a * 0.45, y2 - uy * a + ux * a * 0.45], [x2 - ux * a + uy * a * 0.45, y2 - uy * a - ux * a * 0.45]], true); }
      else if (p.t === 'dim') { const x1 = X(p.a[0]), y1 = Y(p.a[1]), x2 = X(p.b[0]), y2 = Y(p.b[1]), L = Math.hypot(x2 - x1, y2 - y1) || 1, ux = (x2 - x1) / L, uy = (y2 - y1) / L, t = 0.35 * h, l = lay('dim');
        D.line(l, x1, y1, x2, y2); D.line(l, x1 - uy * t, y1 + ux * t, x1 + uy * t, y1 - ux * t); D.line(l, x2 - uy * t, y2 + ux * t, x2 + uy * t, y2 - ux * t);
        const vert = Math.abs(uy) > Math.abs(ux); if (vert) T(p, p.s, (x1 + x2) / 2 + (p.side === -1 ? -0.4 * h : 0.4 * h), (y1 + y2) / 2, p.side === -1 ? 2 : 0, 0.7); else T(p, p.s, (x1 + x2) / 2, (y1 + y2) / 2 + 0.35 * h, 1, 0.7); }
      else if (p.t === 'text') { const sz = (p.size || 0.9) * 0.9; T(p, p.s, X(p.at[0]) + ((p.off && p.off[0]) || 0) * h * sz, Y(p.at[1]) + ((p.off && p.off[1]) || 0) * h * sz, p.a || 0, sz); }
    });
  }
  /* the input table drawn in the DXF (columns: group, value, symbol, value, source) */
  function dxfTable(D, rs, x, y) {
    const h = D.h * 0.75, rh = 1.45 * h, lT = D.layer('TEXT', 7), lA = D.layer('CRANE-ASSUMED', 30), lL = D.layer('TBL', 8);
    const cols = [['INPUT', r => r.label], ['VALUE', r => r.value], ['SOURCE', r => r.src]];   // where each is used: the Crane tab and Report §Cranes
    const cw = cols.map(([t, f]) => Math.min(48, Math.max(t.length, ...rs.map(r => UP(f(r)).length))) * h * 0.92 + 1.4 * h), W = cw.reduce((a, b) => a + b, 0);
    D.text(lT, x, y, D.h, 'CRANE INPUTS USED IN THE ANALYSIS; ASSUMED (DEFAULT) = GUESSED: CHECK. WHERE EACH IS USED: CRANE TAB, REPORT SEC. CRANES'); let yy = y - 1.8 * D.h;
    const row = (cells, l) => { let xx = x; cells.forEach((s, i) => { D.text(l || lT, xx + 0.5 * h, yy - 1.05 * h, h, UP(s).slice(0, 48)); xx += cw[i]; }); D.line(lL, x, yy - rh, x + W, yy - rh); yy -= rh; };
    D.line(lL, x, yy, x + W, yy); const top = yy; row(cols.map(c => c[0])); rs.forEach(r => row(cols.map(c => c[1](r)), r.assumed ? lA : lT));
    let xx = x; [0, ...cw].forEach(w0 => { xx += w0; D.line(lL, xx, top, xx, yy); });
  }
  /* sheets(P, ctx) -> the Crane drawing sheets (one per crane setup used by a lift): plan, elevation (governing point of its first lift),
     the load chart graphic and the input table (ui/drawset.js addSheets) */
  function sheets(P, ctx) {
    const out = [];
    options(P).filter(o => o.used).forEach(o => {
      const m = model(P, ctx, { craneId: o.craneId, setupId: o.setupId, at: 'gov' }); if (!m) return;
      out.push({ id: 'crane-' + o.setupId, title: `CRANE: ${m.u.name} (${m.name})`, kmin: 48, c: { m },
        fn: (D, C) => sheetFn(D, C.m), src: [['out', 'crane', 'Crane tab'], ['in', 'cranes', 'Cranes input tab'], ['rpt', 'crane-' + o.craneId, 'Report §Cranes']] });
    });
    return out;
  }
  function sheetFn(D, m) {
    const h = D.h, lT = D.layer('TEXT', 7), gap = 4 * h;
    const place = (fn, title) => { const i0 = D.mark(); fn(); const b = D.bbox(i0); if (!isFinite(b[0])) return null; D.text(lT, b[0], b[3] + 1.4 * h, 1.1 * h, UP(title)); return { i0, b: D.bbox(i0) }; };
    const pf = plan(m), ef = elev(m), cf = chartFig(m);
    const A1 = place(() => dxf(D, pf), 'PLAN (CARRIER FRONT UP; TO SCALE): ' + String(m.u.name).slice(0, 30));
    let xR = A1 ? A1.b[2] + gap : 0;
    if (ef) { const i0 = D.mark(); const A2 = place(() => dxf(D, ef), 'ELEVATION ALONG THE BOOM (TO SCALE): ' + String(m.pt.where).slice(0, 40)); if (A2) { D.move(i0, xR - A2.b[0], (A1 ? A1.b[3] : 0) - A2.b[3]); xR = D.bbox(i0)[2] + gap; } }
    if (cf) { const sz = A1 ? (A1.b[3] - A1.b[1]) / (62 * 12) : 1, i0 = D.mark(); const A3 = place(() => dxf(D, cf, { kx: 12 * Math.max(0.3, sz) }), 'LOAD CHART (NOT TO SCALE): ' + String(m.chart.cfg.label || m.chart.cfg.id).slice(0, 50)); if (A3) { D.move(i0, xR - A3.b[0], (A1 ? A1.b[3] : 0) - A3.b[3]); const ch = m.chart, bb = D.bbox(i0);
      const so = ch.source; [`RATING BASIS: ${ch.rb.text}`, `SOURCE: ${String(so.doc).slice(0, 60)}, REV. ${so.revision}, ${so.date}${so.page != null ? ', CHART P. ' + so.page : ''}`, ...(so.prelim || so.edited ? [`${so.prelim ? 'PRELIMINARY DOCUMENT' : ''}${so.prelim && so.edited ? '; ' : ''}${so.edited ? 'CHART EDITED IN THIS TOOL' : ''}`] : []),
        `LOOKUP: NEXT LONGER BOOM, NEXT LARGER RADIUS${ch.interp ? ' (INTERPOLATION BETWEEN RADII ON)' : '; NO INTERPOLATION'}.`, 'BOLD STEP: BOOM IN USE; DASHED: THRESHOLDS (CAPACITY X THRESHOLD); CIRCLES: OPERATING POINTS.'].forEach((t, i) => D.text(lT, bb[0], bb[1] - (1.6 + 1.3 * i) * h, 0.75 * h, UP(t))); } }
    const all = A1 ? A1.b : D.bbox(0); dxfTable(D, rows(m), all[0], all[1] - 3 * h);   // the input table under the plan (the elevation and the chart to its right)
  }
  window.CranePickCraneFig = { SRC, srcText, options, liftsOf, model, rows, valText, plan, elev, chart: chartFig, weights, svg, dxf, sheets, AT };
})();
