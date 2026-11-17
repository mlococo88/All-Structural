/* apps/crane-pick/engine/elev.js — the lift in elevation: boom angle, boom tip, hook and load heights, hook reach (window.CranePickElev).
   Classic script, no DOM. C3-1 (2026-11-16). Uses engine/cranes.js (CranePickCranes) and engine/lift.js (CranePickLift), read at call
   time. Elevations are in ft (US customary, whatever the zone's plan unit) on the project's elevation datum; a project that enters no
   elevation works on "the crane pad = 0.00".

   Crane geometry (geomOf; each value: entered on the crane card / editor (app_inputs.geom, app_inputs.plan), else the crane file's dims,
   else the stated assumption below, listed on the card and in the Report):
     h_f   boom-foot pin height above the pad           dims.boom_foot.height_above_ground   assumed 0 (at the pad: the lowest boom)
     e     boom-foot pin ahead of the rotation centre    dims.boom_foot.ahead_of_rotation     assumed 0 (on the rotation centre)
     H_hd  head allowance: from the boom-tip (head sheave) pin down to the highest point the hook block may reach (sheaves, two-block
           clearance), from the manufacturer                                                assumed 0 (not given: flagged)
     b_w   boom section width (the boom is checked as a cylinder of radius b_w / 2 in C3-2)  assumed 0 (the centre line: flagged)
     z_cb, z_ct  counterweight bottom / top above the pad    dims.carrier_or_carbody.counterweight_ground_clearance / counterweight_top_height
           (or the highest of counterweight_heights)        assumed 0 / not limited (the tail-swing cylinder from the pad up)
     R_t   tail-swing radius (C2: dims.tail_swing_radius, app_inputs.plan.tail)
     θ_max maximum boom angle                               dims.max_boom_angle_deg            not checked when not given
   Decision (pending engineer review): the assumed values give the lowest boom and the lowest hook reach (conservative for the hook
   reach and for anything under the boom); they are not conservative for a power line above the boom, so every result that uses an
   assumed value says so.

   Formulas (CLAUDE.md §4: new calculation, stated in the PR and the fix log):
     d_h = R − e                    horizontal distance from the boom-foot pin to the hook (the chart radius R is from the rotation centre)
     θ_g = acos(d_h / L)            boom angle from the geometry (a straight, unloaded boom of length L, foot pin to tip pin)
     θ_c = the chart's printed (loaded) boom angle at (L, R) where the config prints a boom-angle table and L is one of its columns:
           read at R, or linear between the two tabulated radii around R (both printed); otherwise not available
     θ = θ_c where available (the chart governs; both are shown when they differ by more than 0.5°), else θ_g
     z_tip = z_pad + h_f + L sin θ  boom-tip (head sheave) pin elevation; the tip is taken plumb above the hook (the load line hangs
           vertically; with θ_c the drawn boom is from the foot pin to that point)
     z_lb = z_g + h_b               load bottom elevation (z_g ground at the pick / set point, h_b load bottom above that ground)
     z_lt = z_lb + H                load top (H = the load's height)
     z_hk = z_lt + h_r              hook elevation (h_r = rigging height, hook to the load top)
     z_bk = z_hk + h_bk             top of the hook block (h_bk = hook block height, hook to the block top)
     m = z_tip − H_hd − z_bk        hook reach margin; m < 0: the hook cannot reach (boom too short at this radius, or two-blocking)
     ℓ = z_tip − z_bk               load-line (hoist rope) length below the tip pin
   Travel: the load is hoisted at the pick to the travel height, swung (the C2 swing path), and lowered at the set. Travel height
     z_tr = the entered load-bottom elevation during the swing, else max(z_lb,pick, z_lb,set); the hook reach is checked at every
     point of the swing path at z_tr (the lowest tip governs). */
(function () {
  'use strict';
  const K = () => window.CranePickCranes, LF = () => window.CranePickLift;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const tx = (x, d) => { if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const st = (pre, o) => Object.assign({ unit: '', d: 2, ref: '', note: '', eq: '', sub: '' }, o, { id: pre + '.' + o.id });
  const rad = d => d * Math.PI / 180, deg = r => r * 180 / Math.PI;
  const dval = v => v && typeof v === 'object' && isNum(v.value) ? v.value : (isNum(v) ? v : null);
  const FROM = { entered: 'entered', file: 'crane file', assumed: 'assumed' };
  /* geomOf(crane) -> { footH, footE, head, boomW, cwBot, cwTop, tail, maxAng, from: { key: 'entered' | 'file' | 'assumed' }, assumed: [text], page: { key: printed page } } */
  function geomOf(c) {
    const d = (c && c.dims) || {}, bf = d.boom_foot || {}, cc = d.carrier_or_carbody || {}, ai = (c && c.app_inputs) || {}, gi = ai.geom || {}, pl = ai.plan || {};
    const from = {}, assumed = [], o = {}, page = {};   // page (C9, the Crane tab; provenance only): the printed page of a value read from the file
    const pick = (k, entered, file, dflt, why, pg) => {
      if (isNum(entered)) { o[k] = entered; from[k] = 'entered'; }
      else if (isNum(file)) { o[k] = file; from[k] = 'file'; if (pg != null) page[k] = pg; }
      else { o[k] = dflt; from[k] = 'assumed'; if (why) assumed.push(why); }
    };
    const pgOf = v => v && typeof v === 'object' && v.page != null ? v.page : null;
    let cwTopFile = dval(cc.counterweight_top_height), cwTopPg = pgOf(cc.counterweight_top_height);
    if (cwTopFile == null && Array.isArray(cc.counterweight_heights)) { const vs = cc.counterweight_heights.map(x => dval(x)).filter(isNum); if (vs.length) { cwTopFile = Math.max(...vs); cwTopPg = pgOf(cc.counterweight_heights[cc.counterweight_heights.map(x => dval(x)).indexOf(cwTopFile)]); } }
    pick('footH', gi.footH, dval(bf.height_above_ground), 0, 'boom-foot pin height 0 ft (at the pad: the lowest boom)', pgOf(bf.height_above_ground));
    pick('footE', pl.boomFoot, dval(bf.ahead_of_rotation), 0, 'boom-foot pin on the rotation centre (0 ft ahead)', pgOf(bf.ahead_of_rotation));
    pick('head', gi.head, null, 0, 'head allowance 0 ft (the hook block may reach the tip pin: enter the two-block clearance)');
    pick('boomW', gi.boomW, null, 0, 'boom section width 0 ft (the boom is checked as its centre line)');
    pick('cwBot', gi.cwBot, dval(cc.counterweight_ground_clearance), 0, 'counterweight bottom at the pad (0 ft)', pgOf(cc.counterweight_ground_clearance));
    pick('cwTop', gi.cwTop, cwTopFile, null, 'counterweight top not limited (the tail-swing cylinder reaches up without limit)', cwTopPg);
    o.tail = K().planDims(c).tail; o.maxAng = dval(d.max_boom_angle_deg); if (o.maxAng != null && pgOf(d.max_boom_angle_deg) != null) page.maxAng = pgOf(d.max_boom_angle_deg);
    o.from = from; o.assumed = assumed; o.page = page;
    return o;
  }
  /* chartAngle(cfg, L, R, mode) -> { deg, how, R1, R2, a1, a2 } | null (the config's printed boom-angle table at boom L, radius R) */
  function chartAngle(cfg, L, R, mode) {
    const t = cfg && cfg.boom_angle_deg; if (!t || !Array.isArray(t.boom_lengths_ft) || !Array.isArray(t.radii_ft) || !Array.isArray(t.deg) || !isNum(L) || !isNum(R)) return null;
    let cols = t.boom_lengths_ft.map((b, j) => j).filter(j => Math.abs(t.boom_lengths_ft[j] - L) < 1e-6); if (!cols.length) return null;
    const modes = cfg.chart && cfg.chart.column_modes; if (mode != null && Array.isArray(modes)) { const m = cols.filter(j => String(modes[j]) === String(mode)); if (m.length) cols = m; }
    const Rs = t.radii_ft, at = (i, j) => (t.deg[i] || [])[j], out = [];
    cols.forEach(j => {
      const i = Rs.findIndex(r => Math.abs(r - R) < 1e-6);
      if (i >= 0) { const a = at(i, j); if (isNum(a)) out.push({ deg: a, how: 'read', R1: Rs[i], a1: a }); return; }
      const k = Rs.findIndex(r => r > R); if (k <= 0) return;
      const a1 = at(k - 1, j), a2 = at(k, j); if (!isNum(a1) || !isNum(a2)) return;
      out.push({ deg: a1 + (a2 - a1) * (R - Rs[k - 1]) / (Rs[k] - Rs[k - 1]), how: 'interp', R1: Rs[k - 1], R2: Rs[k], a1, a2 });
    });
    if (!out.length) return null;
    return out.reduce((a, b) => b.deg < a.deg ? b : a);   // telescoping modes without a mode chosen: the lowest angle (the lowest tip)
  }
  /* angleAt(crane, setup, cfg, R, g, idp) -> { ok, theta, geom, chart, used, why, dh, steps } */
  function angleAt(c, u, cfg, R, g, idp, quiet) {
    g = g || geomOf(c); const L = u.boom, e = g.footE, dh = R - e, steps = [];
    const ref = cfg && !quiet ? `${K().name(c)}, chart "${cfg.label || cfg.id}"${cfg.page ? ', PDF p. ' + [].concat(cfg.page).join(', ') : ''}` : '';
    if (!quiet) steps.push(st(idp, { id: 'dh', label: 'Horizontal distance from the boom-foot pin to the hook', sym: 'd_{h}', eq: 'R - e', sub: `${tx(R, 2)} - ${tx(e, 2)}`, value: dh, unit: 'ft',
      note: `e = boom-foot pin ahead of the rotation centre (${FROM[g.from.footE]}).` }));
    if (!isNum(L) || L <= 0) return { ok: false, why: 'boom length not set', dh, steps };
    if (dh > L + 1e-9) { if (!quiet) steps.push(st(idp, { id: 'th', label: 'Boom angle: the hook is beyond the boom\'s reach (d_h > L)', sym: '\\theta', eq: '\\text{acos}(\\frac{d_{h}}{L})', sub: `\\text{acos}(\\frac{${tx(dh, 2)}}{${tx(L, 2)}})`, value: 'not reachable', d: 0 }));
      return { ok: false, why: quiet ? 'not reachable' : `the radius is beyond the boom's reach (d_h = ${fmt(dh, 2)} ft > L = ${fmt(L, 2)} ft)`, dh, steps }; }
    const thG = deg(Math.acos(Math.max(-1, Math.min(1, dh / L))));
    if (!quiet) steps.push(st(idp, { id: 'thg', label: 'Boom angle from the geometry (straight boom, foot pin to tip pin)', sym: '\\theta_{g}', eq: '\\text{acos}(\\frac{d_{h}}{L})', sub: `\\text{acos}(\\frac{${tx(dh, 2)}}{${tx(L, 2)}})`, value: thG, unit: 'deg', d: 2 }));
    const ca = chartAngle(cfg, L, R, u.mode);
    if (ca && !quiet) steps.push(ca.how === 'read'
      ? st(idp, { id: 'thc', label: 'Loaded boom angle printed in the chart at L and R', sym: '\\theta_{c}', eq: '\\theta(L, R)', sub: `\\theta(${tx(L, 1)}\\,\\text{ft}, ${tx(R, 2)}\\,\\text{ft})`, value: ca.deg, unit: 'deg', d: 2, ref })
      : st(idp, { id: 'thc', label: 'Loaded boom angle from the chart, linear between the two tabulated radii', sym: '\\theta_{c}', eq: '\\theta_{1} + (\\theta_{2} - \\theta_{1}) \\frac{R - R_{1}}{R_{2} - R_{1}}',
        sub: `${tx(ca.a1, 1)} + (${tx(ca.a2, 1)} - ${tx(ca.a1, 1)}) \\frac{${tx(R, 2)} - ${tx(ca.R1, 1)}}{${tx(ca.R2, 1)} - ${tx(ca.R1, 1)}}`, value: ca.deg, unit: 'deg', d: 2, ref }));
    const theta = ca ? ca.deg : thG, used = ca ? 'chart' : 'geom';
    if (!quiet) steps.push(st(idp, { id: 'th', label: ca ? 'Boom angle used: the chart\'s' : 'Boom angle used: from the geometry (the chart prints no boom angle here)', sym: '\\theta', eq: ca ? '\\theta_{c}' : '\\theta_{g}', sub: '', value: theta, unit: 'deg', d: 2,
      note: ca && Math.abs(ca.deg - thG) > 0.5 ? `The chart's loaded angle differs from the geometric angle by ${fmt(ca.deg - thG, 2)}° (boom deflection, foot-pin position): the chart's is used.` : '' }));
    const out = { ok: true, theta, geom: thG, chart: ca ? ca.deg : null, used, dh, steps, why: '' };
    if (isNum(g.maxAng) && theta > g.maxAng + 1e-9) { out.ok = false; out.why = quiet ? 'above the maximum boom angle' : `the boom angle ${fmt(theta, 1)}° is above the crane's maximum ${fmt(g.maxAng, 1)}°`; }
    return out;
  }
  /* tipAt(crane, setup, cfg, R, g): z_tip (or null) without steps (the swing path, C3-2's 3D checks) */
  function tipAt(c, u, cfg, R, g) { g = g || geomOf(c); const a = angleAt(c, u, cfg, R, g, 'q', true); if (!isNum(a.theta)) return null; return padEl(u) + g.footH + u.boom * Math.sin(rad(a.theta)); }
  /* C8: the terrain provider (ui/terrain.js sets it while "use terrain" is on and a terrain grid is loaded): { pad(setup) -> ft | null (the
     levelling datum under the crane), ground(x, y) -> ft | null, depthPad(setup) -> ft | null (the lowest ground under the supports) }.
     An entered value always overrides the terrain (per item). */
  let TP = null;
  const setTerrain = p => { TP = p || null; };
  const tpv = (f, ...a) => { if (!TP || !TP[f]) return null; try { const v = TP[f](...a); return isNum(v) ? v : null; } catch (e) { return null; } };
  const padFrom = u => isNum(u && u.pad) ? 'entered' : isNum(tpv('pad', u)) ? 'terrain' : 'datum';
  const padEl = u => isNum(u && u.pad) ? u.pad : (u ? (tpv('pad', u) ?? 0) : 0);
  const el0 = k => {
    const E = Object.assign({ pg: null, ph: null, sg: null, sh: null, rig: null, blk: null, trav: null, L: null, W: null, H: null }, k && k.elev || {}), from = {};
    [['pg', 'pick'], ['sg', 'set']].forEach(([f, w]) => { if (isNum(E[f])) from[f] = 'entered'; else if (k && k[w]) { const z = tpv('ground', k[w].x, k[w].y); if (isNum(z)) { E[f] = z; from[f] = 'terrain'; } } });
    E.from = from; return E;
  };
  const TERR = 'USGS 3DEP preliminary terrain';
  /* point(crane, setup, pick, 'pick' | 'set', e (engine/lift.js evalAt result), g, idp) -> heights at that point with their steps */
  function point(c, u, k, which, e, g, idp) {
    const E = el0(k), isP = which === 'pick', zp = padEl(u), steps = [];
    const zg = isNum(isP ? E.pg : E.sg) ? (isP ? E.pg : E.sg) : zp, hb = isNum(isP ? E.ph : E.sh) ? (isP ? E.ph : E.sh) : 0;
    const H = isNum(E.H) ? E.H : 0, hr = isNum(E.rig) ? E.rig : 0, hbk = isNum(E.blk) ? E.blk : 0;
    const a = angleAt(c, u, e.cfg, e.R, g, idp);
    steps.push(...a.steps);
    const out = { which, R: e.R, ang: a, zp, zg, hb, H, hr, hbk, zTip: null, zLb: zg + hb, steps };
    if (isNum(a.theta)) {
      out.zTip = zp + g.footH + u.boom * Math.sin(rad(a.theta));
      steps.push(st(idp, { id: 'tip', label: 'Boom-tip (head sheave) pin elevation', sym: 'z_{tip}', eq: 'z_{pad} + h_{f} + L\\,\\text{sin}\\,\\theta', sub: `${tx(zp, 2)} + ${tx(g.footH, 2)} + ${tx(u.boom, 2)}\\,\\text{sin}\\,${tx(a.theta, 2)}^{\\circ}`, value: out.zTip, unit: 'ft',
        note: `z_pad: crane pad elevation (${{ entered: 'entered', terrain: TERR + ': the levelling datum under the crane, Terrain tab', datum: 'not entered: the datum, 0.00' }[padFrom(u)]}); h_f: boom-foot pin height (${FROM[g.from.footH]}).` }));
    }
    out.zLt = out.zLb + H; out.zHk = out.zLt + hr; out.zBk = out.zHk + hbk;
    steps.push(st(idp, { id: 'lb', label: `Load bottom elevation at the ${which}`, sym: 'z_{lb}', eq: 'z_{g} + h_{b}', sub: `${tx(zg, 2)} + ${tx(hb, 2)}`, value: out.zLb, unit: 'ft',
        note: `z_g: ground at the ${which} point (${(E.from || {})[isP ? 'pg' : 'sg'] === 'terrain' ? TERR : isNum(isP ? E.pg : E.sg) ? 'entered' : 'not entered: the crane pad'}); h_b: load bottom above that ground (${isNum(isP ? E.ph : E.sh) ? 'entered' : 'not entered: 0'}).` }),
      st(idp, { id: 'hk', label: 'Hook elevation (load top + rigging height)', sym: 'z_{hk}', eq: 'z_{lb} + H + h_{r}', sub: `${tx(out.zLb, 2)} + ${tx(H, 2)} + ${tx(hr, 2)}`, value: out.zHk, unit: 'ft' }),
      st(idp, { id: 'bk', label: 'Top of the hook block', sym: 'z_{bk}', eq: 'z_{hk} + h_{bk}', sub: `${tx(out.zHk, 2)} + ${tx(hbk, 2)}`, value: out.zBk, unit: 'ft' }));
    if (isNum(out.zTip)) {
      out.margin = out.zTip - g.head - out.zBk; out.line = out.zTip - out.zBk;
      steps.push(st(idp, { id: 'm', label: 'Hook reach margin (tip pin less the head allowance, above the block top)', sym: 'm', eq: 'z_{tip} - H_{hd} - z_{bk}', sub: `${tx(out.zTip, 2)} - ${tx(g.head, 2)} - ${tx(out.zBk, 2)}`, value: out.margin, unit: 'ft',
          note: (out.margin < 0 ? 'm < 0: the hook cannot reach this height with this boom at this radius (or the block two-blocks). ' : '') + `H_hd: head allowance (${FROM[g.from.head]}).`, ok: out.margin >= 0 }),
        st(idp, { id: 'ln', label: 'Load-line length below the tip pin', sym: '\\ell', eq: 'z_{tip} - z_{bk}', sub: `${tx(out.zTip, 2)} - ${tx(out.zBk, 2)}`, value: out.line, unit: 'ft' }));
    }
    return out;
  }
  /* evaluate(crane, setup, pick, ev (engine/lift.js evaluate), idp) -> { g, pick, set, trav: { z, entered, steps }, swing: { min, at, R, steps }, flags } */
  function evaluate(c, u, k, ev, idp) {
    idp = idp || 'el'; const g = geomOf(c), E = el0(k), flags = [];
    const pp = point(c, u, k, 'pick', ev.pick, g, idp + '.pick'), ps = point(c, u, k, 'set', ev.set, g, idp + '.set');
    const zTr = isNum(E.trav) ? E.trav : Math.max(pp.zLb, ps.zLb), H = pp.H, hr = pp.hr, hbk = pp.hbk;
    const trav = { z: zTr, entered: isNum(E.trav), steps: [isNum(E.trav)
      ? st(idp, { id: 'tr', label: 'Load bottom elevation during the swing (entered)', sym: 'z_{tr}', eq: '', sub: '', value: zTr, unit: 'ft' })
      : st(idp, { id: 'tr', label: 'Load bottom elevation during the swing (not entered: the higher of the pick and the set)', sym: 'z_{tr}', eq: '\\max(z_{lb,pick}, z_{lb,set})', sub: `\\max(${tx(pp.zLb, 2)}, ${tx(ps.zLb, 2)})`, value: zTr, unit: 'ft' })] };
    const zBkTr = zTr + H + hr + hbk;
    trav.steps.push(st(idp, { id: 'trbk', label: 'Top of the hook block during the swing', sym: 'z_{bk,tr}', eq: 'z_{tr} + H + h_{r} + h_{bk}', sub: `${tx(zTr, 2)} + ${tx(H, 2)} + ${tx(hr, 2)} + ${tx(hbk, 2)}`, value: zBkTr, unit: 'ft' }));
    // the hook reach along the swing at the travel height: the lowest margin over the path's check points (every degree)
    let min = null;
    (ev.path.pts || []).forEach(q => { const e = { cfg: LF().cfgAt(c, u, q, ev.chs), R: Math.hypot(q.x - u.x, q.y - u.y) }, zt = tipAt(c, u, e.cfg, e.R, g); if (!isNum(zt)) { if (!min || min.m !== -Infinity) min = { m: -Infinity, R: e.R, t: q.t, zt: null }; return; } const m = zt - g.head - zBkTr; if (!min || m < min.m) min = { m, R: e.R, t: q.t, zt }; });
    const swing = { min: min ? min.m : null, R: min ? min.R : null, t: min ? min.t : null, zTip: min ? min.zt : null, zBk: zBkTr, steps: [] };
    if (min && isNum(min.zt)) swing.steps.push(st(idp, { id: 'swm', label: `Hook reach margin during the swing (lowest along the path: at R = ${fmt(min.R, 2)} ft, where the tip is lowest)`, sym: 'm_{tr}', eq: 'z_{tip}(R) - H_{hd} - z_{bk,tr}', sub: `${tx(min.zt, 2)} - ${tx(g.head, 2)} - ${tx(zBkTr, 2)}`, value: min.m, unit: 'ft', ok: min.m >= 0,
      note: min.m < 0 ? 'm < 0: the load cannot be swung at this travel height (raise the boom angle, use a longer boom or lower the travel height).' : '' }));
    // flags (CLAUDE.md §6: each one's worked step is in the steps above)
    [pp, ps].forEach(p => {
      if (!p.ang.ok && p.ang.why) flags.push({ kind: 'elev', level: 'stop', text: `At the ${p.which}: ${p.ang.why}.` });
      else if (isNum(p.margin) && p.margin < 0) flags.push({ kind: 'elev', level: 'stop', text: `At the ${p.which}: the hook cannot reach (hook reach margin ${fmt(p.margin, 2)} ft): longer boom, smaller radius, or less rigging height.` });
      if (p.ang.used === 'chart' && Math.abs(p.ang.chart - p.ang.geom) > 0.5) flags.push({ kind: 'elev', level: 'info', text: `At the ${p.which}: the chart's loaded boom angle ${fmt(p.ang.chart, 1)}° is used (geometric ${fmt(p.ang.geom, 1)}°).` });
    });
    if (min && min.m < 0) flags.push({ kind: 'elev', level: 'stop', text: min.m === -Infinity ? 'During the swing: the boom cannot reach every point of the path.' : `During the swing: the hook block reaches above the allowed height (margin ${fmt(min.m, 2)} ft at R = ${fmt(min.R, 1)} ft).` });
    if (g.assumed.length) flags.push({ kind: 'geom', level: 'info', text: `Crane geometry assumed (not in the file, not entered): ${g.assumed.join('; ')}. Heights and 3D clearances use these values: enter the crane's own (Cranes tab).` });
    const geoSteps = [st(idp, { id: 'hf', label: 'Boom-foot pin height above the pad', sym: 'h_{f}', value: g.footH, unit: 'ft', note: FROM[g.from.footH] }),
      st(idp, { id: 'e', label: 'Boom-foot pin ahead of the rotation centre', sym: 'e', value: g.footE, unit: 'ft', note: FROM[g.from.footE] }),
      st(idp, { id: 'hd', label: 'Head allowance (tip pin to the highest block position)', sym: 'H_{hd}', value: g.head, unit: 'ft', note: FROM[g.from.head] })];
    return { g, pick: pp, set: ps, trav, swing, flags, geoSteps };
  }
  window.CranePickElev = { geomOf, chartAngle, angleAt, tipAt, point, evaluate, padEl, padFrom, el0, FROM, setTerrain, get terrain() { return TP; } };
})();
