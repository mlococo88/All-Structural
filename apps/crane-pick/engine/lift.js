/* apps/crane-pick/engine/lift.js — crane setups, picks, live capacity and plan clearances (window.CranePickLift). Classic script, no
   DOM. C2-2 (2026-11-16). Uses engine/geo.js (CranePickGeo), engine/cranes.js (CranePickCranes), engine/osha.js (CranePickOSHA), read at
   call time. Positions: the site frame (grid ft); headings and azimuths: degrees clockwise from grid north.

   setup = { id, name, craneId, x, y (centre of rotation), heading (carrier / crawler front, azimuth), group (engine/cranes.js groups()
             key), boom (ft), mode (telescoping mode or null) }
   pick  = { id, name, setupId, pick: { x, y }, set: { x, y }, load, rigging, hook, ded (lb), hookLabel, dedNote, swing: short | cw | ccw }
   settings = { caution, critical, limit (% of chart), interp (bool) }

   Capacity at a hook position (CLAUDE.md §4: new calculation, stated in the PR and the fix log):
     R = √(Δx² + Δy²) from the centre of rotation (the chart radius: rotation axis to the hook load line);
     θ = azimuth − heading (slew angle from the carrier front, −180° … 180°); zone (engine/cranes.js zoneOf) only when the setup's
       charts include zone charts; else the 360° chart;
     C = chart capacity at (L, R) by the engine/cranes.js lookup rule (next longer boom, next larger radius; outside = not permitted);
     W = W_load + W_rigging + W_hook + W_other (the chart capacities are gross: every deduction the chart notes require is entered here);
     %chart = W / C × 100; class: ≥ limit "over the chart", ≥ critical "critical lift", ≥ caution "caution".
   Swing path (Decision pending engineer review): the hook swings about the centre of rotation from the pick to the set in the chosen
     direction (shortest by default), the radius changing uniformly with the swing angle; the path is checked at every degree and at each
     zone boundary; R_max = max(R_pick, R_set) (a radius varying uniformly never exceeds the larger end); the governing point is the one
     with the highest %chart (any point not permitted governs). */
(function () {
  'use strict';
  const G = () => window.CranePickGeo, K = () => window.CranePickCranes, O = () => window.CranePickOSHA;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const n0 = v => isNum(v) ? v : 0;
  const DEF = { caution: 75, critical: 75, limit: 100, interp: false };
  const tx = (x, d) => { if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const rad = d => d * Math.PI / 180;
  function settingsOf(P) { const s = Object.assign({}, DEF, P && P.lift || {}); ['caution', 'critical', 'limit'].forEach(k => { if (!isNum(s[k]) || s[k] <= 0) s[k] = DEF[k]; }); s.interp = !!s.interp; return s; }
  /* the setup's charts: { gr (group), zoned, crane } */
  function chartsOf(crane, setup) {
    const gs = K().groups(crane); const gr = gs.find(g => g.key === setup.group) || gs[0] || null;
    return { gr, zoned: !!gr && gr.zones.some(z => z !== '360') };
  }
  /* local (x forward, y left) -> grid, for a setup */
  function toGrid(setup, lx, ly) { const h = rad(setup.heading || 0), fx = Math.sin(h), fy = Math.cos(h); return { x: setup.x + lx * fx - ly * fy, y: setup.y + lx * fy + ly * fx }; }
  function cls(pct, s) { if (!isNum(pct)) return 'np'; if (pct >= s.limit - 1e-9) return 'over'; if (pct >= s.critical - 1e-9) return 'critical'; if (pct >= s.caution - 1e-9) return 'caution'; return 'ok'; }
  const CLS = { ok: 'within the chart', caution: 'caution', critical: 'critical lift', over: 'over the chart', np: 'not permitted' };
  function total(pick) { return n0(pick.load) + n0(pick.rigging) + n0(pick.hook) + n0(pick.ded); }
  /* evalAt(crane, setup, p, W, s, idp) -> { R, az, theta, zone, cfg, look, C, pct, cls, steps } */
  function evalAt(crane, setup, p, W, s, idp, chs) {
    chs = chs || chartsOf(crane, setup);
    const g = G(), dx = p.x - setup.x, dy = p.y - setup.y, R = Math.hypot(dx, dy), az = g.azimuth(setup, p), theta = K().norm180(az - (setup.heading || 0));
    const sec = crane.app_inputs && crane.app_inputs.sectors;
    const zone = chs.zoned ? K().zoneOf(theta, sec) : '360';
    const cfg = chs.gr ? (chs.zoned ? K().chartFor(chs.gr, zone) : chs.gr.configs['360'] || chs.gr.configs[Object.keys(chs.gr.configs)[0]]) : null;
    const steps = [st(idp, { id: 'R', label: 'Radius from the centre of rotation to the hook', sym: 'R', eq: '\\sqrt{\\Delta x^{2} + \\Delta y^{2}}', sub: `\\sqrt{${tx(dx, 2)}^{2} + ${tx(dy, 2)}^{2}}`, value: R, unit: 'ft' })];
    if (chs.zoned) steps.push(st(idp, { id: 'th', label: `Slew angle from the carrier front (zone: ${K().ZONES[zone] || zone})`, sym: '\\theta', eq: '\\alpha - \\alpha_{front}', sub: `${tx(az, 2)} - ${tx(setup.heading || 0, 2)}`, value: theta, unit: 'deg', d: 2,
      note: `Sectors (entered): over front ±${sec && isNum(sec.front) ? sec.front + '°' : ' not set'}, over rear ±${sec && isNum(sec.rear) ? sec.rear + '°' : ' not set'}; outside them: over side.` }));
    let look = null;
    if (!cfg) look = { ok: false, status: 'nozone', why: `no chart for the ${K().ZONES[zone] || zone} zone in this configuration`, steps: [st(idp, { id: 'C', label: `Chart capacity: no chart for the ${K().ZONES[zone] || zone} zone`, sym: 'C_{chart}', eq: '', sub: '', value: 'not permitted', d: 0 })], notes: [], flags: [] };
    else look = K().lookup(cfg, setup.boom, R, { interp: s.interp, mode: setup.mode, idp, ref: `${K().name(crane)}, chart "${cfg.label || cfg.id}"${cfg.page ? ', PDF p. ' + [].concat(cfg.page).join(', ') : ''}` });
    steps.push(...look.steps);
    const C = look.ok ? look.cap : null, pct = look.ok ? W / C * 100 : null;
    if (look.ok) steps.push(st(idp, { id: 'pct', label: 'Percent of chart', sym: '\\%_{chart}', eq: '\\frac{W}{C_{chart}} \\times 100', sub: `\\frac{${tx(W, 0)}}{${tx(C, 0)}} \\times 100`, value: pct, unit: '\\%', d: 1,
      note: `${CLS[cls(pct, s)]} (caution ≥ ${s.caution} %, critical lift ≥ ${s.critical} %, limit ${s.limit} %)` }));
    return { R, az, theta, zone, cfg, look, C, pct, cls: cls(pct, s), steps, p: { x: p.x, y: p.y } };
  }
  /* the swing: signed sweep (deg, + clockwise) from a0 to a1 */
  function sweep(a0, a1, dir) {
    const cw = ((a1 - a0) % 360 + 360) % 360;
    if (cw < 1e-9) return 0;
    if (dir === 'cw') return cw; if (dir === 'ccw') return cw - 360;
    return cw <= 180 ? cw : cw - 360;
  }
  function pathPoints(setup, a, b, dir) {
    const g = G(), r0 = g.dist(setup, a), r1 = g.dist(setup, b), a0 = g.azimuth(setup, a), a1 = g.azimuth(setup, b), d = sweep(a0, a1, dir);
    const n = Math.max(1, Math.ceil(Math.abs(d))), out = [];
    for (let k = 0; k <= n; k++) { const t = k / n, az = rad(a0 + d * t), r = r0 + (r1 - r0) * t; out.push({ x: setup.x + r * Math.sin(az), y: setup.y + r * Math.cos(az), t, az: a0 + d * t, r }); }
    return { pts: out, d, a0, a1, r0, r1 };
  }
  /* evaluate(crane, setup, pick, settings) -> { W, Wsteps, pick, set, path: { d, pts, Rmax, gov }, gov, cls } */
  function evaluate(crane, setup, pick, s, idp) {
    s = s || DEF; idp = idp || 'lift';
    const W = total(pick), chs = chartsOf(crane, setup);
    const Wsteps = [st(idp, { id: 'W', label: 'Total load on the hook (the chart capacities are gross)', sym: 'W', eq: 'W_{load} + W_{rig} + W_{hook} + W_{other}', sub: `${tx(n0(pick.load), 0)} + ${tx(n0(pick.rigging), 0)} + ${tx(n0(pick.hook), 0)} + ${tx(n0(pick.ded), 0)}`, value: W, unit: 'lb', d: 0,
      note: `Hook block: ${pick.hookLabel || (n0(pick.hook) ? 'entered' : 'none entered')}${pick.dedNote ? '; other: ' + pick.dedNote : ''}. Deduct everything the chart notes require (hook block, jib or extension stowed or erected, slings, spreader…).` })];
    const ep = evalAt(crane, setup, pick.pick, W, s, idp + '.pick', chs), es = evalAt(crane, setup, pick.set, W, s, idp + '.set', chs);
    const pp = pathPoints(setup, pick.pick, pick.set, pick.swing || 'short');
    // the path's check points: every degree, plus the zone boundaries (both sides)
    const checks = pp.pts.slice();
    if (chs.zoned) {
      const sec = crane.app_inputs && crane.app_inputs.sectors || {}, bs = [];
      if (isNum(sec.front) && sec.front > 0) bs.push(sec.front, -sec.front); if (isNum(sec.rear) && sec.rear > 0) bs.push(180 - sec.rear, -(180 - sec.rear));
      bs.forEach(b => { const azB = (setup.heading || 0) + b, rel = sweep(pp.a0, azB, pp.d >= 0 ? 'cw' : 'ccw'); if (Math.abs(rel) <= Math.abs(pp.d) && pp.d !== 0) [-1e-4, 1e-4].forEach(e => { const t = Math.min(1, Math.max(0, rel / pp.d + e)), az = rad(pp.a0 + pp.d * t), r = pp.r0 + (pp.r1 - pp.r0) * t; checks.push({ x: setup.x + r * Math.sin(az), y: setup.y + r * Math.cos(az), t, r }); }); });
    }
    let gov = null, govT = 0;
    checks.forEach(q => { const e = evalAt(crane, setup, q, W, s, idp + '.gov', chs); const worse = !gov || (gov.cls !== 'np' && (e.cls === 'np' || e.pct > gov.pct + 1e-9)); if (worse) { gov = e; govT = q.t; } });
    // a tie with an end point is reported at that end (the pick or the set), the same capacity and % of chart
    [es, ep].forEach((e, i) => { if (gov && e.cls === gov.cls && (e.cls === 'np' || Math.abs(e.pct - gov.pct) < 1e-9)) { gov = e; govT = i ? 0 : 1; } });
    const Rmax = Math.max(ep.R, es.R);
    const where = govT < 1e-6 ? 'at the pick' : govT > 1 - 1e-6 ? 'at the set' : `on the swing, ${fmt(Math.abs(pp.d) * govT, 0)}° from the pick`;
    const pathSteps = [st(idp, { id: 'sw', label: `Swing from the pick to the set (${pick.swing === 'cw' ? 'clockwise' : pick.swing === 'ccw' ? 'counter-clockwise' : 'shortest way'})`, sym: '\\Delta\\alpha', eq: '\\alpha_{set} - \\alpha_{pick}', sub: `${tx(pp.a1, 2)} - ${tx(pp.a0, 2)}`, value: pp.d, unit: 'deg', d: 1, note: '+ clockwise (plan).' }),
      st(idp, { id: 'Rmax', label: 'Largest radius along the swing path (radius changing uniformly with the swing angle)', sym: 'R_{max}', eq: '\\max(R_{pick}, R_{set})', sub: `\\max(${tx(ep.R, 2)}, ${tx(es.R, 2)})`, value: Rmax, unit: 'ft' })];
    return { W, Wsteps, pick: ep, set: es, path: { d: pp.d, pts: pp.pts, Rmax, steps: pathSteps }, gov, govWhere: where, cls: gov ? gov.cls : 'np', chs };
  }
  /* ---------- plan footprint and clearances ---------- */
  function rect(setup, x0, x1, y0, y1) { return [toGrid(setup, x1, y1), toGrid(setup, x1, y0), toGrid(setup, x0, y0), toGrid(setup, x0, y1)]; }
  function circle(c, r, n) { const out = []; n = n || 48; for (let k = 0; k < n; k++) { const a = 2 * Math.PI * k / n; out.push({ x: c.x + r * Math.sin(a), y: c.y + r * Math.cos(a) }); } return out; }
  /* footprint(crane, setup) -> { body, tracks: [poly], beams: [[a, b]], floats: [poly], floatC: [{x,y,r}], tail (radius), spread } */
  function footprint(crane, setup) {
    const p = K().planDims(crane), out = { body: null, tracks: [], beams: [], floats: [], floatC: [], tail: p.tail, spread: null, dims: p };
    if (p.body && isNum(p.body.front) && isNum(p.body.rear) && isNum(p.body.width)) out.body = rect(setup, -p.body.rear, p.body.front, -p.body.width / 2, p.body.width / 2);
    if (p.kind === 'crawler' && p.crawler && isNum(p.crawler.length) && isNum(p.crawler.gauge)) {
      const L = p.crawler.length / 2, sh = isNum(p.crawler.shoe) ? p.crawler.shoe : 3, g = p.crawler.gauge / 2;
      out.tracks = [rect(setup, -L, L, g - sh / 2, g + sh / 2), rect(setup, -L, L, -g - sh / 2, -g + sh / 2)];
    }
    const chs = chartsOf(crane, setup), any = chs.gr && (chs.gr.configs['360'] || chs.gr.configs[chs.gr.zones[0]]);
    const key = any ? K().spreadKey(any, p) : null;
    if (p.kind !== 'crawler' && key && p.outr && isNum(p.outr.xFront) && isNum(p.outr.xRear)) {
      const half = p.outr.spreads[key] / 2, f = isNum(p.outr.float) ? p.outr.float : 2; out.spread = key;
      [p.outr.xFront, -p.outr.xRear].forEach(x => [half, -half].forEach(y => {
        const c = toGrid(setup, x, y); out.beams.push([toGrid(setup, x, 0), c]); out.floatC.push({ x: c.x, y: c.y, r: f / 2 }); out.floats.push(circle(c, f / 2, 16)); }));
    }
    return out;
  }
  /* geometry helpers */
  function segSeg(a, b, c, d) {   // distance between segments ab and cd (0 if they cross)
    const cr = (p, q, r) => (q.x - p.x) * (r.y - p.y) - (q.y - p.y) * (r.x - p.x);
    const d1 = cr(c, d, a), d2 = cr(c, d, b), d3 = cr(a, b, c), d4 = cr(a, b, d);
    if (((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0))) return 0;
    const g = G(); return Math.min(g.segDist(a, c, d), g.segDist(b, c, d), g.segDist(c, a, b), g.segDist(d, a, b));
  }
  function edges(pts, closed) { const e = []; for (let i = 0; i < pts.length - (closed ? 0 : 1); i++) e.push([pts[i], pts[(i + 1) % pts.length]]); if (pts.length === 1) e.push([pts[0], pts[0]]); return e; }
  /* minDist(A, closedA, B, closedB): 0 when they overlap (a crossing, or one inside the other) */
  function minDist(A, ca, B, cb) {
    const g = G();
    if (cb && A.some(p => g.inside(p, B))) return 0;
    if (ca && B.some(p => g.inside(p, A))) return 0;
    let m = Infinity; edges(A, ca).forEach(([a, b]) => edges(B, cb).forEach(([c, d]) => { m = Math.min(m, segSeg(a, b, c, d)); }));
    return m;
  }
  /* clearances(crane, setup, ev, pick, items) -> [{ kind, level: 'stop' | 'warn' | 'info', item, text, d }] (plan only; C3 adds heights) */
  function clearances(crane, setup, ev, items) {
    const out = [], fp = footprint(crane, setup), path = ev.path.pts, sector = [{ x: setup.x, y: setup.y }].concat(path);
    const parts = [].concat(fp.body ? [fp.body] : [], fp.tracks, fp.floats), tail = isNum(fp.tail) ? circle(setup, fp.tail, 48) : null;
    (items || []).forEach(it => {
      const nm = it.name || it.type;
      if (it.type === 'power') {
        const c = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }, 'x');
        const d = minDist(sector, true, it.pts, false), D = c.ft;
        if (isNum(D) && d < D - 1e-9) out.push({ kind: 'power', level: 'stop', item: it.id, d, D, text: `Boom / load swing within D_min = ${fmt(D, 0)} ft of "${nm}" in plan (closest ${fmt(d, 1)} ft): keep the boom, load line and load outside it in 3D (heights in C3) or de-energize per 29 CFR 1926.1408.` });
        else if (!isNum(D)) out.push({ kind: 'power', level: 'stop', item: it.id, d, text: `"${nm}": clearance not set (over 1,000 kV): enter the utility / RPE distance.` });
        const df = parts.length ? Math.min(...parts.map(q => minDist(q, true, it.pts, false))) : Infinity;
        if (isNum(D) && df < D - 1e-9) out.push({ kind: 'power', level: 'stop', item: it.id, d: df, D, text: `Crane footprint within D_min = ${fmt(D, 0)} ft of "${nm}" in plan (closest ${fmt(df, 1)} ft).` });
      } else if (it.type === 'excl') {
        if (minDist(path, false, it.pts, true) === 0) out.push({ kind: 'excl', level: 'warn', item: it.id, text: `The load path crosses the exclusion zone "${nm}".` });
        else if (minDist(sector, true, it.pts, true) === 0) out.push({ kind: 'excl', level: 'warn', item: it.id, text: `The boom swings over the exclusion zone "${nm}" (plan).` });
        if (parts.some(q => minDist(q, true, it.pts, true) === 0)) out.push({ kind: 'excl', level: 'warn', item: it.id, text: `The crane footprint (body, tracks or floats) is in the exclusion zone "${nm}".` });
        else if (tail && minDist(tail, true, it.pts, true) === 0) out.push({ kind: 'excl', level: 'warn', item: it.id, text: `The tail-swing circle (${fmt(fp.tail, 1)} ft) reaches the exclusion zone "${nm}".` });
      } else if (it.type === 'obst') {
        if (parts.some(q => minDist(q, true, it.pts, true) === 0)) out.push({ kind: 'obst', level: 'stop', item: it.id, text: `The crane footprint overlaps the obstruction "${nm}".` });
        else if (tail && minDist(tail, true, it.pts, true) === 0) out.push({ kind: 'obst', level: 'warn', item: it.id, text: `The tail-swing circle (${fmt(fp.tail, 1)} ft) reaches the obstruction "${nm}": check the counterweight height against it (C3).` });
        if (minDist(sector, true, it.pts, true) === 0) out.push({ kind: 'obst', level: 'info', item: it.id, text: `The boom / load passes over the obstruction "${nm}"${isNum(it.height) ? ` (${fmt(it.height, 1)} ft high)` : ''} in plan: check the boom and load heights (C3).` });
      }
    });
    if (!isNum(fp.tail)) out.push({ kind: 'tail', level: 'info', text: 'Tail-swing radius not given: enter it (crane editor) for the tail-swing checks.' });
    return out;
  }
  window.CranePickLift = { DEF, CLS, settingsOf, chartsOf, evalAt, evaluate, sweep, pathPoints, total, cls, footprint, clearances, minDist, toGrid, circle };
})();
