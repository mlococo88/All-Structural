/* apps/crane-pick/ui/elev.js — the elevation view along the boom (window.CranePickElevView). C3-2 (2026-11-16). C3-3: the dock also
   switches to the 3D view (ui/view3d.js).
   A section in the vertical plane through the rotation centre at the boom's azimuth, for the selected pick at the pick, the set, the
   capacity-governing point or the closest 3D clearance: ground (pad), counterweight, boom (foot pin to tip), load line, hook block,
   rigging, load, and every obstruction / power line the plane crosses (or that passes near it), with heights and clearances dimensioned.
   Drawn to scale (the same scale across and up). A dock under the map on the Plan tab (live while dragging) and a figure per pick in the
   Report. Values: engine/lift.js, engine/elev.js, engine/clear3d.js through CranePickPlace.evalPick (the same numbers as the card). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, esc = A.esc;
  const PL = () => window.CranePickPlace, EL = () => window.CranePickElev, C3 = () => window.CranePickClear, O = () => window.CranePickOSHA;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const WHICH = { pick: 'at the pick', set: 'at the set', gov: 'capacity governing point', clr: 'closest 3D clearance' };
  /* the hook position and load-bottom elevation of a view */
  function stateOf(ev, k, which) {
    const h = ev.elev;
    if (which === 'set') return { q: k.set, lb: h.set.zLb, zg: h.set.zg, where: 'at the set' };
    if (which === 'gov') { const p = ev.gov && ev.gov.p || k.pick; return { q: p, lb: ev.govWhere === 'at the pick' ? h.pick.zLb : ev.govWhere === 'at the set' ? h.set.zLb : h.trav.z, where: 'capacity governing, ' + ev.govWhere }; }
    if (which === 'clr') { const rs = (ev.c3 && ev.c3.results || []).filter(r => r.type !== 'excl'); if (rs.length) { const r = rs.reduce((a, b) => (b.gov.d - (b.D || b.req || 0)) < (a.gov.d - (a.D || a.req || 0)) ? b : a);
      return { q: { x: r.gov.pos.x, y: r.gov.pos.y }, lb: r.gov.pos.lb0, where: `closest 3D: ${r.name}, ${r.where}` }; } }
    return { q: k.pick, lb: h.pick.zLb, zg: h.pick.zg, where: 'at the pick' };
  }
  /* sections of the site items in the plane: the line c + s·v (plan), s from s0 to s1 */
  function sections(items, c, v, s0, s1, zp, near) {
    const out = [], A0 = { x: c.x + v.x * s0, y: c.y + v.y * s0 }, A1 = { x: c.x + v.x * s1, y: c.y + v.y * s1 };
    const sOf = p => (p.x - c.x) * v.x + (p.y - c.y) * v.y, lat = p => (p.x - c.x) * v.y - (p.y - c.y) * v.x;
    const cut = (a, b) => { const d1 = lat(a), d2 = lat(b); if ((d1 > 0) === (d2 > 0) || d1 === d2) return null; const t = d1 / (d1 - d2), p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }, s = sOf(p); return s >= s0 && s <= s1 ? s : null; };
    (items || []).forEach(it => {
      if (it.type === 'obst') {
        const env = C3().envelope(it, zp, 'v'); const ss = [];
        it.pts.forEach((a, i) => { const s = cut(a, it.pts[(i + 1) % it.pts.length]); if (s != null) ss.push(s); }); ss.sort((a, b) => a - b);
        for (let i = 0; i + 1 < ss.length; i += 2) out.push({ kind: 'obst', it, s0: ss[i], s1: ss[i + 1], top: env.known ? env.z1 : null, grade: env.grade });
        if (!ss.length) { const m = it.pts.reduce((b, p) => Math.abs(lat(p)) < Math.abs(lat(b)) ? p : b, it.pts[0]), s = sOf(m); if (Math.abs(lat(m)) <= near && s >= s0 && s <= s1) out.push({ kind: 'obst', it, s0: s - 0.5, s1: s + 0.5, top: env.known ? env.z1 : null, grade: env.grade, off: Math.abs(lat(m)) }); }
      } else if (it.type === 'power') {
        const env = C3().envelope(it, zp, 'v'), D = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }).ft;
        let crossed = false;
        for (let i = 0; i + 1 < it.pts.length; i++) { const s = cut(it.pts[i], it.pts[i + 1]); if (s != null) { crossed = true; out.push({ kind: 'power', it, s, zw: env.zw, z0: env.z0, D, sway: it.sway || 0 }); } }
        if (!crossed) { let best = null; for (let i = 0; i + 1 < it.pts.length; i++) for (let k = 0; k <= 20; k++) { const p = { x: it.pts[i].x + (it.pts[i + 1].x - it.pts[i].x) * k / 20, y: it.pts[i].y + (it.pts[i + 1].y - it.pts[i].y) * k / 20 }, s = sOf(p); if (s >= s0 && s <= s1 && (!best || Math.abs(lat(p)) < best.off)) best = { s, off: Math.abs(lat(p)) }; }
          if (best && best.off <= near + (isNum(D) ? D : 0)) out.push({ kind: 'power', it, s: best.s, zw: env.zw, z0: env.z0, D, sway: it.sway || 0, off: best.off }); }
      } else if (it.type === 'excl') { const ss = []; it.pts.forEach((a, i) => { const s = cut(a, it.pts[(i + 1) % it.pts.length]); if (s != null) ss.push(s); }); ss.sort((a, b) => a - b); for (let i = 0; i + 1 < ss.length; i += 2) out.push({ kind: 'excl', it, s0: ss[i], s1: ss[i + 1] }); }
    });
    void A0; void A1; return out;
  }
  /* svg(ev, k, u, crane, items, which, o) -> SVG text (no DOM) */
  function svg(ev, k, u, items, which, o) {
    o = o || {}; if (!ev || !ev.elev) return '';
    const h = ev.elev, g = h.g, zp = EL().padEl(u), E = EL().el0(k), H = isNum(E.H) ? E.H : 0, hr = h.pick.hr, hbk = h.pick.hbk, rL = Math.hypot(E.L || 0, E.W || 0) / 2;
    const S = stateOf(ev, k, which), q = S.q, R = Math.hypot(q.x - u.x, q.y - u.y), az = G.azimuth(u, q), v = { x: Math.sin(az * Math.PI / 180), y: Math.cos(az * Math.PI / 180) };
    const cr = (o.cranes || A.P.cranes).find(c => c.id === u.craneId); if (!cr) return ''; const crane = cr.def, cfg = window.CranePickLift.cfgAt(crane, u, q, ev.chs);
    const ang = EL().angleAt(crane, u, cfg, R, g, 'v', true), zTip = isNum(ang.theta) ? zp + g.footH + u.boom * Math.sin(ang.theta * Math.PI / 180) : null;
    const lb = S.lb, zLt = lb + H, zHk = zLt + hr, zBk = zHk + hbk, tail = isNum(g.tail) ? g.tail : 10, cwB = zp + g.cwBot, cwT = isNum(g.cwTop) ? zp + g.cwTop : cwB + Math.max(6, tail * 0.4);
    const s0 = -tail - 12, s1 = Math.max(R + rL, 10) + 30, sec = sections(items, u, v, s0, s1, zp, 25);
    // extents
    const zs = [zp, cwT, lb, zBk].concat(isNum(zTip) ? [zTip + 3] : [], sec.map(x => x.kind === 'obst' ? (isNum(x.top) ? x.top : zp) : x.kind === 'power' && isNum(x.zw) ? x.zw + (isNum(x.D) ? x.D : 0) : zp));
    let z0 = Math.min(...zs, zp) - 8, z1 = Math.max(...zs) + 10;
    const Wd = o.w || 760, Ht0 = o.h || 300, k0 = Math.min((Wd - 70) / (s1 - s0), (Ht0 - 40) / (z1 - z0)), Ht = Math.max(180, Math.min(Ht0, (z1 - z0) * k0 + 40));
    const X = s => (50 + (s - s0) * k0).toFixed(1), Y = z => (Ht - 22 - (z - z0) * k0).toFixed(1);
    const lineS = (a, b, sty) => `<line x1="${X(a[0])}" y1="${Y(a[1])}" x2="${X(b[0])}" y2="${Y(b[1])}" ${sty}/>`;
    const txt = (s, z, t, a, sty) => `<text x="${X(s)}" y="${Y(z)}"${a ? ` text-anchor="${a}"` : ''} ${sty || ''}>${esc(t)}</text>`;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" class="crElevSvg" viewBox="0 0 ${Wd} ${Ht.toFixed(0)}" width="${Wd}" height="${Ht.toFixed(0)}" font-family="Arial, sans-serif" font-size="10.5"><rect width="100%" height="100%" fill="#fff" stroke="#94a3b8"/>`;
    // ground (the pad) and the datum
    out += `<rect x="0" y="${Y(zp)}" width="${Wd}" height="${Math.max(0, Ht - Y(zp)).toFixed(1)}" fill="#E7E5E4"/>` + lineS([s0 - 100, zp], [s1 + 100, zp], 'stroke="#57534E" stroke-width="1.5"') + txt(s0 + 1, zp - 2.5 / k0 * 0 - 0, `pad el. ${fmt(zp, 2)}`, '', 'dy="12" fill="#57534E"');
    // site items
    sec.forEach(x => {
      if (x.kind === 'excl') { out += `<rect x="${X(x.s0)}" y="${Y(z1)}" width="${(+X(x.s1) - +X(x.s0)).toFixed(1)}" height="${(+Y(z0) - +Y(z1)).toFixed(1)}" fill="#D97706" fill-opacity="0.08" stroke="#D97706" stroke-dasharray="5 4"/>` + txt((x.s0 + x.s1) / 2, z1 - 2 / k0 * 6, `exclusion: ${x.it.name || ''}`, 'middle', 'fill="#B45309"'); return; }
      if (x.kind === 'obst') { const top = isNum(x.top) ? x.top : null, base = Math.min(isNum(x.grade) ? x.grade : zp, zp);
        if (top != null) out += `<rect class="crElObst" x="${X(x.s0)}" y="${Y(top)}" width="${Math.max(1, +X(x.s1) - +X(x.s0)).toFixed(1)}" height="${(+Y(base) - +Y(top)).toFixed(1)}" fill="#7C3AED" fill-opacity="${x.off ? 0.12 : 0.28}" stroke="#7C3AED"${x.off ? ' stroke-dasharray="4 3"' : ''}/>` + txt((x.s0 + x.s1) / 2, top, `${x.it.name || 'obstruction'}: top el. ${fmt(top, 2)}${x.off ? ` (${fmt(x.off, 1)} ft off this plane)` : ''}`, 'middle', 'dy="-4" fill="#5B21B6"');
        else out += `<rect x="${X(x.s0)}" y="${Y(z1)}" width="${Math.max(1, +X(x.s1) - +X(x.s0)).toFixed(1)}" height="${(+Y(zp) - +Y(z1)).toFixed(1)}" fill="#7C3AED" fill-opacity="0.06" stroke="#7C3AED" stroke-dasharray="2 3"/>` + txt((x.s0 + x.s1) / 2, z1, `${x.it.name || 'obstruction'}: height not entered`, 'middle', 'dy="12" fill="#5B21B6"');
        // vertical clearance of the load / boom over it
        if (top != null && isNum(zTip)) { const sm = (x.s0 + x.s1) / 2, zb = sm <= g.footE ? null : (sm >= R ? null : zp + g.footH + (zTip - zp - g.footH) * (sm - g.footE) / (R - g.footE));
          if (zb != null && zb > top) out += lineS([sm, top], [sm, zb], 'stroke="#5B21B6" stroke-dasharray="2 2"') + txt(sm, (top + zb) / 2, `boom +${fmt(zb - top, 1)}`, '', 'dx="3" fill="#5B21B6"');
          if (R + rL >= x.s0 && R - rL <= x.s1) out += lineS([R, top], [R, lb], 'stroke="#B91C1C" stroke-width="1.2"') + txt(R, (top + lb) / 2, `load ${lb >= top ? '+' : ''}${fmt(lb - top, 2)}`, '', 'dx="4" fill="#B91C1C"'); }
        return; }
      if (x.kind === 'power') { const zw = x.zw;
        if (!isNum(zw)) { out += lineS([x.s, z0], [x.s, z1], 'stroke="#DC2626" stroke-dasharray="6 3"') + txt(x.s, z1, `${x.it.name || 'power line'}: wire height not entered`, 'middle', 'dy="12" fill="#B91C1C"'); return; }
        if (isNum(x.D)) out += `<rect class="crElTube" x="${X(x.s - x.D - x.sway)}" y="${Y(zw + x.D)}" width="${(2 * (x.D + x.sway) * k0).toFixed(1)}" height="${((zw - x.z0 + 2 * x.D) * k0).toFixed(1)}" rx="${(x.D * k0).toFixed(1)}" fill="#DC2626" fill-opacity="0.08" stroke="#DC2626" stroke-dasharray="4 3"/>`;
        out += `<circle class="crElWire" cx="${X(x.s)}" cy="${Y(zw)}" r="3.5" fill="#DC2626"/>` + (x.z0 < zw ? lineS([x.s, zw], [x.s, x.z0], 'stroke="#DC2626" stroke-width="2"') : '')
          + txt(x.s, zw + (isNum(x.D) ? x.D : 0), `${x.it.name || 'power line'}: wire el. ${fmt(zw, 2)}, D_min ${isNum(x.D) ? fmt(x.D, 0) : '?'} ft${x.off ? ` (${fmt(x.off, 1)} ft off this plane)` : ''}`, 'middle', 'dy="-4" fill="#B91C1C"');
        if (isNum(zTip) && !x.off) { // distance in this plane from the wire to the boom and to the load line
          const fx = g.footE, fz = zp + g.footH, dx = R - fx, dz = zTip - fz, t = Math.max(0, Math.min(1, ((x.s - fx) * dx + (zw - fz) * dz) / (dx * dx + dz * dz || 1))), bx = fx + dx * t, bz = fz + dz * t, db = Math.hypot(x.s - bx, zw - bz) - (g.boomW || 0) / 2;
          out += lineS([x.s, zw], [bx, bz], 'stroke="#B91C1C" stroke-dasharray="2 2"') + txt((x.s + bx) / 2, (zw + bz) / 2, `${fmt(db, 1)} ft`, '', 'dx="3" dy="-2" fill="#B91C1C"'); }
      }
    });
    // counterweight, upperworks
    out += `<rect x="${X(-tail)}" y="${Y(cwT)}" width="${(tail * 0.55 * k0).toFixed(1)}" height="${((cwT - cwB) * k0).toFixed(1)}" fill="#475569" stroke="#0F172A"${isNum(g.cwTop) ? '' : ' stroke-dasharray="3 2"'}/>` + txt(-tail, cwT, `cwt R ${fmt(tail, 1)}`, '', 'dy="-3" fill="#334155"');
    out += `<rect x="${X(-tail * 0.45)}" y="${Y(zp + g.footH + 2)}" width="${((tail * 0.45 + g.footE + 1) * k0).toFixed(1)}" height="${((g.footH + 2) * k0).toFixed(1)}" fill="#94A3B8" fill-opacity="0.6" stroke="#334155"/>`;
    out += lineS([0, zp - 2], [0, Math.max(...zs)], 'stroke="#64748B" stroke-dasharray="1 4"') + txt(0, z0, 'rotation', 'middle', 'dy="-2" fill="#64748B"');
    // boom, load line, block, rigging, load
    const fz = zp + g.footH;
    if (isNum(zTip)) {
      out += lineS([g.footE, fz], [R, zTip], `class="crElBoom" stroke="#0F172A" stroke-width="${Math.max(3, (g.boomW || 0) * k0).toFixed(1)}" stroke-linecap="round" stroke-opacity="0.85"`);
      out += `<circle cx="${X(g.footE)}" cy="${Y(fz)}" r="3" fill="#fff" stroke="#0F172A"/><circle cx="${X(R)}" cy="${Y(zTip)}" r="3.5" fill="#fff" stroke="#0F172A"/>`;
      out += lineS([R, zTip], [R, zBk], 'class="crElLine" stroke="#334155" stroke-width="1.2"');
      out += txt(R, zTip, `tip el. ${fmt(zTip, 2)}`, 'end', 'dx="-6" dy="-6" font-weight="bold"') + txt(g.footE, fz, `θ ${fmt(ang.theta, 1)}°${ang.used === 'chart' ? ' (chart)' : ''}`, '', 'dx="10" dy="-6"');
    } else out += txt((s0 + s1) / 2, z1, 'the boom cannot reach this radius', 'middle', 'dy="14" fill="#B91C1C" font-weight="bold"');
    out += `<rect x="${X(R - 1)}" y="${Y(zBk)}" width="${(2 * k0).toFixed(1)}" height="${Math.max(2, hbk * k0).toFixed(1)}" fill="#F59E0B" stroke="#78350F"/>`;
    if (hr > 0) out += lineS([R, zHk], [R - Math.max(rL, 1) * 0.8, zLt], 'stroke="#78350F"') + lineS([R, zHk], [R + Math.max(rL, 1) * 0.8, zLt], 'stroke="#78350F"');
    out += `<rect class="crElLoad" x="${X(R - Math.max(rL, 0.5))}" y="${Y(zLt)}" width="${(2 * Math.max(rL, 0.5) * k0).toFixed(1)}" height="${Math.max(2, H * k0).toFixed(1)}" fill="#2563EB" fill-opacity="0.35" stroke="#1E3A8A"/>`;
    out += txt(R, lb, `load bottom el. ${fmt(lb, 2)}`, 'start', `dx="${(Math.max(rL, 0.5) * k0 + 4).toFixed(0)}" dy="0" fill="#1E3A8A"`) + txt(R, zHk, `hook el. ${fmt(zHk, 2)}`, 'start', `dx="${(Math.max(rL, 0.5) * k0 + 4).toFixed(0)}" fill="#78350F"`);
    if (isNum(S.zg) && Math.abs(S.zg - zp) > 0.005) out += lineS([R - rL - 6, S.zg], [R + rL + 6, S.zg], 'stroke="#57534E" stroke-width="2"') + txt(R + rL + 6, S.zg, `ground el. ${fmt(S.zg, 2)}`, 'start', 'dx="3" dy="4" fill="#57534E"');
    // radius dimension
    const zd = z0 + 3 / k0 * 4; out += lineS([0, zd], [R, zd], 'stroke="#0F172A" marker-start="url(#crA)" marker-end="url(#crA)"') + txt(R / 2, zd, `R ${fmt(R, 2)} ft`, 'middle', 'dy="-3"');
    out += `<defs><marker id="crA" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0 L10 5 L0 10 z" fill="#0F172A"/></marker></defs>`;
    out += `<text x="8" y="14" font-weight="bold">${esc(k.name)}: ${esc(S.where)} (section along the boom, azimuth ${fmt(az, 1)}°; to scale)</text></svg>`;
    return out;
  }
  /* ---------- the dock under the map ---------- */
  let dock = null, pending = false;
  const st = () => Object.assign({ open: true, which: 'pick', mode: '2d' }, A.ui.elev || {});
  function build() {
    const pane = document.getElementById('planPane'); if (!pane || dock) return;
    dock = document.createElement('div'); dock.id = 'elevDock'; pane.appendChild(dock);
    dock.innerHTML = `<div class="elBar"><button type="button" id="elToggle"></button><span class="elMode" role="group" aria-label="View"><button type="button" data-elmode="2d">Elevation</button><button type="button" data-elmode="3d">3D</button></span><label class="note">Boom <select id="elWhich">${Object.keys(WHICH).map(w => `<option value="${w}">${WHICH[w]}</option>`).join('')}</select></label><span class="note" id="elInfo"></span></div><div id="elSvg"></div><div id="el3d" hidden></div>`;
    dock.addEventListener('click', e => { if (e.target.id === 'elToggle') { A.ui.elev = Object.assign(st(), { open: !st().open }); A.saveUi(); draw(); }
      const m = e.target.closest('[data-elmode]'); if (m) { A.ui.elev = Object.assign(st(), { mode: m.dataset.elmode, open: true }); A.saveUi(); draw(); } });   // C3-3: Elevation / 3D
    dock.addEventListener('change', e => { if (e.target.id === 'elWhich') { A.ui.elev = Object.assign(st(), { which: e.target.value }); A.saveUi(); draw(); } });
    draw();
  }
  function current() { const sel = PL() && PL().selected, k = (sel && sel.pick && A.P.picks.find(x => x.id === sel.pick)) || A.P.picks[0]; if (!k) return null; const u = A.P.setups.find(x => x.id === k.setupId); if (!u) return null; const ev = PL().evalPick(k); return ev ? { k, u, ev } : null; }
  function draw() {
    if (!dock) return; pending = false; const s = st();
    const v3 = s.mode === '3d' && !!window.CranePickView3D;
    dock.querySelector('#elToggle').textContent = (s.open ? '▾ ' : '▸ ') + (v3 ? '3D view' : 'Elevation'); dock.querySelector('#elWhich').value = s.which; dock.classList.toggle('open', s.open); dock.classList.toggle('v3', v3 && s.open);
    dock.querySelectorAll('[data-elmode]').forEach(b => b.setAttribute('aria-pressed', String((b.dataset.elmode === '3d') === v3)));
    const TU = window.CranePickTandemUI, tg = s.open && TU && TU.active();   // C5: a girder lift selected on its tab: both cranes at its step
    const box = dock.querySelector('#elSvg'), b3 = dock.querySelector('#el3d'), c = s.open && !tg ? current() : null;
    b3.hidden = !(s.open && v3); box.hidden = !(s.open && !v3);
    if (!s.open) { box.innerHTML = ''; if (window.CranePickView3D) window.CranePickView3D.hide(); return; }
    if (v3) { box.innerHTML = ''; dock.querySelector('#elInfo').textContent = tg ? tg.name : c ? c.k.name : ''; window.CranePickView3D.show(b3, c, s.which); return; }
    if (window.CranePickView3D) window.CranePickView3D.hide();
    if (tg) { box.innerHTML = TU.dockSvg(Math.max(360, Math.min(1100, box.clientWidth || 760))); dock.querySelector('#elInfo').textContent = `${tg.name}, step ${TU.step}`; return; }
    if (!c) { box.innerHTML = '<p class="note">No pick yet: place a crane (Cranes or Lifts tab).</p>'; dock.querySelector('#elInfo').textContent = ''; return; }
    box.innerHTML = svg(c.ev, c.k, c.u, A.P.items, s.which, { w: Math.max(360, Math.min(1100, box.clientWidth || 760)), h: 260 });
    dock.querySelector('#elInfo').textContent = c.k.name;
  }
  const later = () => { if (pending || !window.CranePickMap) return; pending = true; window.CranePickMap.raf('elev', draw); };
  A.on('ready', build); A.on('project', later); A.on('change', later); A.on('live', later);
  A.on('tab', id => { if (id === 'plan') later(); });
  A.on('itab', later);   // C5: the girder lift shows in the dock while its tab is open
  /* Report: the elevation at the pick and at the set of each pick */
  window.CranePickReport && window.CranePickReport.add(P => {
    const subs = []; P.picks.forEach(k => { const u = P.setups.find(x => x.id === k.setupId); if (!u || !PL()) return; const ev = PL().evalPick(k); if (!ev || !ev.elev) return;
      subs.push({ id: 'el-' + k.id, key: 'elev-' + k.id, title: k.name, items: [{ type: 'figure', svg: svg(ev, k, u, P.items, 'pick', { w: 680, h: 280, cranes: P.cranes }), caption: `Elevation at the pick (to scale): boom, load line, load, the site items the section crosses, heights and clearances. See [[pick-${k.id}]] for the worked steps.` },
        { type: 'figure', svg: svg(ev, k, u, P.items, 'set', { w: 680, h: 280, cranes: P.cranes }), caption: 'Elevation at the set (to scale).' }] }); });
    return subs.length ? [{ id: 'elev', key: 'elev', title: 'Elevations', subs }] : [];
  });
  window.CranePickElevView = { svg, sections, stateOf, redraw: later, WHICH, current };
})();
