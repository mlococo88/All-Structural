/* apps/crane-pick/ui/tandem.js — girder lifts (one crane, or two in tandem) on the map, the Girder lifts input tab, the Picks tab rows and
   the Report's §Tandem lifts (window.CranePickTandemUI). C5 (2026-11-16). Values: engine/tandem.js (CLAUDE.md §6: every value is worked in
   the card's worked steps and in the Report).
   Map, for each girder lift: the girder drawn to scale at its pick pose (blue: on the truck) and its set pose (green: on the bearings),
   the path of its centre through the waypoints, the girder at the scrubbed step (grey, dashed) with the boom line of each crane to its
   hook and a live label at each hook (radius, chart capacity, % of chart), and each crane's governing step (red ring, G1 / G2).
   Handles (selected lift): ✥ P / S move the pick / set pose, ↻ turns it (heading of end A → end B), ◆ the CG and H1 / H2 the lifting
   points slide along the girder at the pick pose, W1… move the waypoints. Every drag updates once per animation frame and is one undo
   step when it ends. The scrubber steps along the path (the step shown on the map, in the card's elevation, and in the 3D view). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, K = window.CranePickCranes, LF = window.CranePickLift, M = window.CranePickModel, esc = A.esc;
  const T = () => window.CranePickTandem, EL = () => window.CranePickElev, MP = () => window.CranePickMap, L_ = () => window.L;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  const COLS = { ok: '#059669', caution: '#D97706', critical: '#EA580C', over: '#DC2626', np: '#DC2626' };
  let el = null, sel = null, scrub = 0, stepsOpen = false, grOpen = false, play = null, dragEnd = 0;
  const layers = new Map();
  const tOf = id => (A.P.tandems || []).find(t => t.id === id) || null;
  const setupOf = id => (A.P.setups || []).find(u => u.id === id) || null;
  const craneDef = u => { const c = u && A.P.cranes.find(x => x.id === u.craneId); return c ? c.def : null; };
  const nC = t => t.type === 'single' ? 1 : 2;
  const settings = () => Object.assign(LF.settingsOf(A.P), { tandem: (A.P.lift && A.P.lift.tandem) || 75 });
  function env(t) { const us = t.slots.slice(0, nC(t)).map(setupOf); return { setups: us, cranes: us.map(craneDef), items: A.P.items, P: A.P, s: settings(), zPad: us[0] ? EL().padEl(us[0]) : 0 }; }
  /* memo: the lift, its setups, the settings and a revision bumped by every other change */
  let rev = 0; const memo = new Map();
  function evalT(t) {
    const e = env(t), key = JSON.stringify([t, e.setups, A.P.lift, rev]); if (memo.has(key)) return memo.get(key);
    const r = T().evaluate(t, e, 'tg'); if (memo.size > 24) memo.clear(); memo.set(key, r); return r;
  }
  const stepIdx = (r, j) => Math.max(0, Math.min((r.steps.length || 1) - 1, j));
  /* ---------- creating ---------- */
  function newLift(type) {
    const c = MP() && MP().map ? MP().toFt(MP().map.getCenter()) : { x: 0, y: 0 }, n = (A.P.tandems || []).length + 1;
    const t = M.normTandem({ name: `${type === 'single' ? 'Girder lift' : 'Tandem lift'} ${n}`, type, girder: { L: 100 }, pick: { x: c.x, y: c.y - 30, h: 90 }, set: { x: c.x, y: c.y + 30, h: 90 },
      slots: [0, 1].map(i => ((A.P.setups || [])[i] || {}).id || '') });
    A.update(P => { P.tandems.push(t); }, 'tandem', { id: t.id }); sel = t.id; scrub = 0; A.showITab('tandem'); renderAll(); drawTab();
    if (MP() && MP().map) MP().fit([{ x: c.x - 90, y: c.y - 90 }, { x: c.x + 90, y: c.y + 90 }]);
    return t.id;
  }
  function defaults(c) {
    const gs = K.groups(c), gr = gs.find(g => g.configs['360'] && /outriggers-full|crawler/.test(g.configs['360'].support || '')) || gs[0];
    const cfg = gr ? (gr.configs['360'] || gr.configs[gr.zones[0]]) : null, ch = cfg && cfg.chart;
    return { group: gr ? gr.key : '', boom: ch && ch.boom_lengths_ft.length ? ch.boom_lengths_ft[0] : null };
  }
  /* placeFor(t, i, craneId): a new setup for crane slot i, 30 ft beyond its hook at the set pose (along the girder) */
  function placeFor(t, i, craneId) {
    const c = A.P.cranes.find(x => x.id === craneId); if (!c) return null;
    const sh = T().share(t), hp = T().hooks(t, t.set, sh)[i] || t.set, a = { x: Math.sin(t.set.h * Math.PI / 180), y: Math.cos(t.set.h * Math.PI / 180) }, sg = i === 0 ? -1 : 1, d = defaults(c.def);
    const u = M.normSetup({ name: `Crane ${(A.P.setups || []).length + 1}: ${K.name(c.def)}`, craneId, x: hp.x + sg * 30 * a.x, y: hp.y + sg * 30 * a.y, heading: 0, group: d.group, boom: d.boom });
    A.update(P => { P.setups.push(u); t.slots[i] = u.id; }, 'tandem', { id: t.id }); renderAll(); drawTab(); if (window.CranePickPlace) window.CranePickPlace.renderAll();
    return u.id;
  }
  function delLift(id) { A.update(P => { P.tandems = P.tandems.filter(t => t.id !== id); }, 'tandem'); if (sel === id) sel = null; renderAll(); drawTab(); }
  /* ---------- map ---------- */
  const lls = pts => pts.map(p => MP().toLL(p));
  const moving = h => h && h.dragging && h.dragging._draggable && h.dragging._draggable._moving;
  const pin = (cls, txt, tip, size) => L_().divIcon({ className: cls, html: `<span title="${esc(tip)}">${txt}</span>`, iconSize: [size || 24, size || 24], iconAnchor: [(size || 24) / 2, (size || 24) / 2] });
  function lblIcon(i, c) {
    const t = !c ? '—' : c.e.look.ok ? `R ${fmt(c.R, 1)} ft<br>C ${fmt(c.C, 0)} lb · <b>${fmt(c.pct, 1)} %</b>` : `R ${fmt(c.R, 1)} ft<br><b>not permitted</b>`;
    return L_().divIcon({ className: 'crLiftLbl tgLbl', html: `<span class="lv lv-${c ? c.cls : 'np'}"><i>C${i + 1}</i> ${t}</span>`, iconSize: null, iconAnchor: [-14, 12] });
  }
  function removeLayers(id) { const g = layers.get(id); if (!g) return; g.all.forEach(x => x.remove()); layers.delete(id); }
  function renderAll() {
    if (!MP() || !MP().map) return;
    [...layers.keys()].forEach(removeLayers);
    (A.P.tandems || []).forEach(t => layers.set(t.id, make(t)));
  }
  function make(t) {
    const Lf = L_(), m = MP().map, on = t.id === sel, g = { all: [], way: [], nWay: t.way.length }, add = x => { x.addTo(m); g.all.push(x); return x; };
    const po = (col, dash) => ({ color: col, weight: on ? 2.5 : 1.6, dashArray: dash, fillColor: col, fillOpacity: 0.18, interactive: false });
    g.path = add(Lf.polyline([], { color: '#7C3AED', weight: on ? 2.5 : 1.5, dashArray: '6 5', interactive: false }));
    g.pk = add(Lf.polygon([], po('#2563EB'))); g.st = add(Lf.polygon([], po('#059669'))); g.gh = add(Lf.polygon([], po('#475569', '4 4')));
    g.pkL = add(Lf.layerGroup()); g.stL = add(Lf.layerGroup()); g.ghL = add(Lf.layerGroup());
    g.booms = [0, 1].map(() => add(Lf.polyline([], { color: '#0F172A', weight: on ? 2.5 : 1.6, interactive: false })));
    g.lbl = [0, 1].map(() => add(Lf.marker([0, 0], { icon: Lf.divIcon({ className: 'crLiftLbl', html: '' }), interactive: false, keyboard: false, zIndexOffset: 1200 })));
    g.gov = [0, 1].map(i => add(Lf.marker([0, 0], { icon: pin('tgGov', 'G' + (i + 1), `Crane ${i + 1}: governing step`, 22), interactive: false, keyboard: false, zIndexOffset: 1050 })));
    g.c3 = add(Lf.layerGroup());
    if (on) {
      const drag = (mk, fn) => { mk.on('drag', () => { fn(MP().toFt(mk.getLatLng())); live(t); }); mk.on('dragend', () => { dragEnd = Date.now(); A.update(null, 'tandem', { id: t.id }); place(t); }); return mk; };
      const dm = (cls, txt, tip, z) => add(Lf.marker([0, 0], { icon: pin(cls, txt, tip), draggable: true, keyboard: false, zIndexOffset: z || 1100 }));
      g.pc = drag(dm('crPt crPtP tgPt', 'P', `${t.name}: girder at the pick (drag)`), f => { t.pick.x = f.x; t.pick.y = f.y; scrub = 0; });
      g.sc = drag(dm('crPt crPtS tgPt', 'S', `${t.name}: girder at the set (drag)`), f => { t.set.x = f.x; t.set.y = f.y; scrub = Infinity; });
      g.pr = drag(dm('crHandle crRot', '↻', 'Drag to turn the girder at the pick'), f => { if (G.dist(t.pick, f) > 0.5) t.pick.h = G.azimuth(t.pick, f); scrub = 0; });
      g.sr = drag(dm('crHandle crRot', '↻', 'Drag to turn the girder at the set'), f => { if (G.dist(t.set, f) > 0.5) t.set.h = G.azimuth(t.set, f); scrub = Infinity; });
      const along = f => { const L = T().object(t).L, h = t.pick.h * Math.PI / 180; return Math.max(0, Math.min(L, (f.x - t.pick.x) * Math.sin(h) + (f.y - t.pick.y) * Math.cos(h) + L / 2)); };
      g.cg = drag(dm('tgCg', '◆', 'Drag the girder CG along the girder', 1160), f => { t.girder.cg = along(f); scrub = 0; });
      g.hk = [0, 1].slice(0, nC(t)).map(i => t.type === 'single' ? null : drag(dm('tgHk', 'H' + (i + 1), `Lifting point of crane ${i + 1} (drag along the girder)`, 1150), f => { t.hooks[i].s = along(f); scrub = 0; }));
      g.way = t.way.map((w, j) => drag(dm('crPt tgWay', 'W' + (j + 1), `Waypoint ${j + 1} (drag)`), f => { w.x = f.x; w.y = f.y; }));
    }
    place(t, g);
    return g;
  }
  function ends(t, pose, L) { return [T().at(pose, L, 0, 0), T().at(pose, L, L, 0)]; }
  function drawPose(grp, poly, t, pose, ob, col) {
    const o = T().outline(t, pose, ob); poly.setLatLngs(lls(o.box)); grp.clearLayers();
    o.lines.forEach(l => L_().polyline(lls(l), { color: col, weight: 3, interactive: false }).addTo(grp));
    const [a] = ends(t, pose, ob.L); L_().circleMarker(MP().toLL(a), { radius: 3, color: col, fill: true, fillOpacity: 1, interactive: false }).addTo(grp);   // end A
  }
  function place(t, g) {
    g = g || layers.get(t.id); if (!g) return null;
    const r = evalT(t), ob = r.sh.ob, j = stepIdx(r, scrub === Infinity ? r.steps.length - 1 : scrub), q = r.steps[j];
    if (scrub === Infinity) scrub = j;
    const nodes = [t.pick].concat(t.way, [t.set]); g.path.setLatLngs(lls(nodes));
    drawPose(g.pkL, g.pk, t, t.pick, ob, '#1D4ED8'); drawPose(g.stL, g.st, t, t.set, ob, '#047857');
    if (q) drawPose(g.ghL, g.gh, t, q.x.pose, ob, '#334155'); else { g.gh.setLatLngs([]); g.ghL.clearLayers(); }
    [0, 1].forEach(i => {
      const c = q && q.cr[i], u = t.slots[i] && setupOf(t.slots[i]);
      g.booms[i].setLatLngs(c && u ? lls([u, c.p]) : []);
      if (c) { g.lbl[i].setLatLng(MP().toLL(c.p)); g.lbl[i].setIcon(lblIcon(i, c)); g.lbl[i].setOpacity(1); } else g.lbl[i].setOpacity(0);
      const gv = r.gov[i], gc = gv && r.steps[gv.i] && r.steps[gv.i].cr[i];
      if (gc) { g.gov[i].setLatLng(MP().toLL(gc.p)); g.gov[i].setOpacity(1); } else g.gov[i].setOpacity(0);
      g.booms[i].setStyle({ color: c ? COLS[c.cls] || '#0F172A' : '#0F172A' });
    });
    g.c3.clearLayers();
    r.flags.filter(f => f.p && f.level !== 'info').forEach(f => { const col = f.level === 'stop' ? '#DC2626' : '#D97706';
      L_().polyline([MP().toLL(f.p), MP().toLL(f.q)], { color: col, weight: 2, dashArray: '3 3', interactive: false }).addTo(g.c3);
      L_().marker(MP().toLL(f.p), { icon: pin('crC3 crC3-' + f.level, f.level === 'stop' ? '!' : '▲', f.text, 18), keyboard: false, zIndexOffset: 1050 }).addTo(g.c3); });
    if (g.pc) {
      const set = (mk, p) => { if (mk && !moving(mk)) mk.setLatLng(MP().toLL(p)); };
      set(g.pc, t.pick); set(g.sc, t.set); set(g.pr, T().at(t.pick, ob.L, ob.L + 6, 0)); set(g.sr, T().at(t.set, ob.L, ob.L + 6, 0));
      set(g.cg, T().at(t.pick, ob.L, ob.xcg, ob.tcg));
      (g.hk || []).forEach((mk, i) => mk && set(mk, T().at(t.pick, ob.L, r.sh.xs[i], ob.tcg)));
      g.way.forEach((mk, k) => set(mk, t.way[k]));
    }
    return r;
  }
  function live(t) { MP().raf('tandem', () => { place(t); A.live('tandem', { id: t.id }); liveCard(); }); }
  /* ---------- the tab ---------- */
  const numIn = (id, v, lbl, unit, o) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" inputmode="decimal" id="${id}" value="${v == null ? '' : esc(String(+(+v).toFixed(4)))}"${o && o.ph ? ` placeholder="${esc(o.ph)}"` : ''}><span class="unit">${unit}</span></div>`;
  const cls = c => `<span class="lv lv-${c}">${esc(T().CLS[c] || LF.CLS[c] || c)}</span>`;
  function resHtml(t) {
    const r = evalT(t), sh = r.sh, ob = sh.ob, j = stepIdx(r, scrub), q = r.steps[j], n = r.steps.length;
    const sx = window.CranePickSite ? window.CranePickSite.steps : (l => l.map(x => esc(x.label)).join('<br>'));
    const head = `<b>${esc(t.name)}: ${r.gov.length ? r.gov.map((g, i) => `crane ${i + 1} ${g.c.e.look.ok ? fmt(g.c.pct, 1) + ' %' : 'not permitted'}`).join(' · ') : 'incomplete'}</b> ${r.ok ? '' : '<span class="lv lv-over">check the flags</span>'}`;
    const shareRows = sh.R.map((R, i) => `<tr><td>Crane ${i + 1}</td><td class="n">${fmt(sh.xs[i], 2)}</td><td class="n">${fmt(R, 0)}</td><td class="n">${fmt(sh.Wh[i], 0)}</td></tr>`).join('');
    const govRows = r.gov.map((g, i) => `<tr><td>Crane ${i + 1}</td><td class="n"><a href="#" data-tgstep="${g.i}">${g.i}</a></td><td>${esc(g.where)}</td><td class="n">${fmt(g.c.R, 2)}</td><td class="n">${g.c.e.look.ok ? fmt(g.c.C, 0) : 'n.p.'}</td><td class="n">${fmt(sh.Wh[i], 0)}</td><td class="n">${g.c.e.look.ok ? fmt(g.c.pct, 1) : '—'}</td><td>${cls(g.c.cls)}</td><td class="n">${g.reach ? (g.reach.m === -Infinity ? 'not reachable' : fmt(g.reach.m, 2)) : '—'}</td></tr>`).join('');
    const stepRows = q ? q.cr.map((c, i) => c ? `<tr><td>Crane ${i + 1}</td><td class="n">${fmt(c.R, 2)}</td><td>${esc(K.ZONES[c.e.zone] || c.e.zone || '—')}</td><td class="n">${c.e.look.ok ? fmt(c.C, 0) : 'n.p.'}</td><td class="n">${c.e.look.ok ? fmt(c.pct, 1) : '—'}</td><td>${cls(c.cls)}</td><td class="n">${fmt(c.zHk, 2)}</td><td class="n">${fmt(c.zTip, 2)}</td><td class="n">${c.margin == null ? 'n.r.' : fmt(c.margin, 2)}</td></tr>` : '').join('') : '';
    return `<div class="crOut${r.ok ? '' : ' bad'}" id="tlRes">${head}
      <div class="note">W<sub>g</sub> = ${fmt(ob.Wg, 0)} lb · x<sub>cg</sub> = ${fmt(ob.xcg, 2)} ft from end A${ob.pair || ob.tcg ? ` · t<sub>cg</sub> = ${fmt(ob.tcg, 2)} ft` : ''} · L = ${fmt(ob.L, 2)} ft · ${r.single ? 'single crane: limit = the lift thresholds' : `tandem limit ${fmt(r.lim, 0)} % of chart per crane`} · ${n} steps (1 ft of hook travel / 1° of slew)</div>
      <div class="tscroll"><table class="tbl lfTbl" id="tlShare"><thead><tr><th>Load share</th><th>x (ft)</th><th>R girder (lb)</th><th>W hook (lb)</th></tr></thead><tbody>${shareRows}</tbody></table></div>
      ${r.gov.length ? `<div class="tscroll"><table class="tbl lfTbl" id="tlGov"><thead><tr><th>Governing</th><th>Step</th><th>Where</th><th>R (ft)</th><th>C (lb)</th><th>W (lb)</th><th>% chart</th><th></th><th>Hook reach min (ft)</th></tr></thead><tbody>${govRows}</tbody></table></div>` : ''}
      ${n ? `<div class="fRow" id="tlScrubRow"><label for="tlScrub">Step <b id="tlStepNo">${j}</b> / ${n - 1}</label><input type="range" id="tlScrub" min="0" max="${n - 1}" step="1" value="${j}" style="flex:1 1 140px"><button type="button" data-ta="play" id="tlPlay">${play ? 'Stop' : 'Play'}</button></div>
        <div class="note" id="tlWhere">${esc(T().where(q.x))} · centre (${fmt(q.x.pose.x, 2)}, ${fmt(q.x.pose.y, 2)}) · heading ${fmt(q.x.pose.h, 1)}° · girder bottom el. ${fmt(q.x.pose.z, 2)}</div>
        <div class="tscroll"><table class="tbl lfTbl" id="tlStep"><thead><tr><th>This step</th><th>R (ft)</th><th>Zone</th><th>C (lb)</th><th>% chart</th><th></th><th>Hook el. (ft)</th><th>Tip el. (ft)</th><th>Reach margin (ft)</th></tr></thead><tbody>${stepRows}</tbody></table></div>
        <div id="tlElev">${elevSvg(t, r, j, { w: 340, h: 220 })}</div>` : ''}
      ${r.cc ? `<div class="note" id="tlCC">Crane–crane: least ${fmt(r.cc.d, 2)} ft (crane 1 ${esc(T().COMP[r.cc.c1])} to crane 2 ${esc(T().COMP[r.cc.c2])}, ${esc(r.cc.where)})${r.level ? ` · girder level: hook heights differ by ${fmt(r.level.d, 2)} ft` : ''}</div>` : ''}
      ${groundHtml(r)}
      ${r.flags.length ? `<ul class="lfFlags" id="tlFlags">${r.flags.map(f => `<li class="lf-${f.level}">${isNum(f.step) ? `<a href="#" data-tgstep="${f.step}">step ${f.step}</a>: ` : ''}${esc(f.text)}</li>`).join('')}</ul>` : '<div class="note">No flags.</div>'}
      <details class="crSteps" id="tlSteps"${stepsOpen ? ' open' : ''}><summary>Worked steps</summary>${stepsOpen ? workedHtml(r, sx) : ''}</details>
      <div class="goRow"><a href="#" class="wk" data-ta="picksTab">Picks tab</a> <a href="#" class="wk" data-ta="rpt">worked: Report §Tandem lifts</a></div></div>`;
  }
  function workedHtml(r, sx) {
    return `<div class="note"><b>Load share</b></div>${sx(r.sh.steps)}<div class="note"><b>Path</b></div>${sx(r.path.steps)}`
      + r.gov.map((g, i) => `<div class="note"><b>Crane ${i + 1}: governing step ${g.i} (${esc(g.where)})</b></div>${sx(g.steps)}`).join('')
      + (r.level ? `<div class="note"><b>Girder level</b></div>${sx(r.level.steps)}` : '') + (r.cc ? `<div class="note"><b>Crane–crane distance</b></div>${sx(r.cc.steps)}` : '')
      + r.clr.map(c => `<div class="note"><b>Clearance: ${esc(c.name)}</b></div>${sx(c.steps)}`).join('')
      + (r.ground && window.CranePickGroundUI ? r.ground.cr.map((g, i) => g.mode === 'none' ? '' : `<div class="note"><b>Crane ${i + 1}: ground</b></div>${window.CranePickGroundUI.stepsHtml(g)}`).join('')
        + r.ground.pair.filter(d => d.steps).map(d => `<div class="note"><b>Stress at depth, both cranes: ${esc(d.name)}</b></div>${sx(d.steps)}`).join('') : '');
  }
  /* C5: ground (engine/ground.js via engine/tandem.js): each crane with its own hook load along the lift's steps; the stress at depth
     from both cranes together */
  function groundHtml(r) {
    const GU = window.CranePickGroundUI; if (!r.ground || !GU) return '';
    const per = r.ground.cr.map((g, i) => `<div class="note tgGr" data-tggr="${i}"><b>Crane ${i + 1}: ground</b> (hook load W<sub>${i + 1}</sub> = ${fmt(g.W, 0)} lb at its hook at every step)${g.mode === 'none' ? ` · <span class="warnT">not computed: ${esc(g.why)}</span>` : ` ${GU.modeChip(g)}`}</div>
      ${g.mode === 'none' ? '' : GU.supTable(g) + (g.depth.length ? GU.depthTable(g) : '')}`).join('');
    const pr = r.ground.pair, pair = pr.length ? `<div class="tscroll"><table class="tbl" id="tlGrPair"><thead><tr><th>Both cranes</th><th>Δσ<sub>z</sub> crane 1 (psf)</th><th>Δσ<sub>z</sub> crane 2 (psf)</th><th>Δσ<sub>z</sub> sum (psf)</th><th>Step</th><th>Allowable (psf)</th><th>Ratio</th></tr></thead><tbody>
      ${pr.map(d => `<tr><td>${esc(d.name)}</td>${d.none ? `<td colspan="6" class="warnT">${esc(d.none)}</td>` : d.far ? '<td colspan="6">—</td>' : `<td class="n">${fmt(d.parts[0], 0)}</td><td class="n">${fmt(d.parts[1], 0)}</td><td class="n"><b>${fmt(d.ds, 0)}</b></td><td class="n"><a href="#" data-tgstep="${d.j}">${d.j}</a></td><td class="n">${d.cap ? fmt(d.cap, 0) : 'not entered'}</td><td class="n${d.ratio > 1 ? ' ng' : ''}">${d.ratio == null ? '—' : fmt(d.ratio, 2)}</td>`}</tr>`).join('')}</tbody></table></div>` : '';
    return `<details class="crSteps" id="tlGround"${grOpen ? ' open' : ''}><summary>Ground (outrigger / track loads, bearing, stress at depth)</summary>${per}${pair}<p class="note">Values of the Ground tab's method (§Ground basis), with each crane's own hook load along its own hook path; the stress at depth from both cranes' supports summed at the same step.</p></details>`;
  }
  function liveCard() {
    if (!el) return; const t = tOf(sel), x = el.querySelector('#tlLive'); if (t && x) x.innerHTML = resHtml(t);
    if (t) { const z = A.P.site.zone, f = (id, v) => { const i = el.querySelector(id); if (i && document.activeElement !== i) i.value = v; };
      f('#tlPE', G.ftToNative(z, t.pick.x).toFixed(2)); f('#tlPN', G.ftToNative(z, t.pick.y).toFixed(2)); f('#tlPH', (+t.pick.h).toFixed(1));
      f('#tlSE', G.ftToNative(z, t.set.x).toFixed(2)); f('#tlSN', G.ftToNative(z, t.set.y).toFixed(2)); f('#tlSH', (+t.set.h).toFixed(1)); f('#tlCg', t.girder.cg == null ? '' : (+t.girder.cg).toFixed(2));
      t.hooks.forEach((h, i) => f('#tlH' + i + 's', (+h.s).toFixed(2))); }
  }
  function cardHtml(t) {
    const z = G.zone(A.P.site.zone), un = z.unit === 'm' ? 'm' : 'ft', g = t.girder, pr = g.pair, E = v => G.ftToNative(z.id, v).toFixed(2);
    const slot = i => { const u = setupOf(t.slots[i]);
      return `<div class="fRow"><label for="tlSlot${i}">Crane ${i + 1}</label><select id="tlSlot${i}"><option value="">— choose a crane setup —</option>${(A.P.setups || []).map(x => `<option value="${x.id}"${x.id === t.slots[i] ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div>
        ${A.P.cranes.length ? `<div class="goRow"><select id="tlNew${i}" aria-label="Crane to place for crane ${i + 1}">${A.P.cranes.map(c => `<option value="${c.id}">${esc(K.name(c.def))}</option>`).join('')}</select><button type="button" data-ta="place${i}">Place for crane ${i + 1}</button></div>` : ''}
        ${u ? `<p class="note">${esc(u.name)}: boom ${fmt(u.boom, 1)} ft, pad ${u.pad == null ? '0.00 (datum)' : fmt(u.pad, 2)}; chart, boom, position on the Lifts tab (<a href="#" data-tasel="${u.id}">edit setup</a>).</p>` : ''}`; };
    const hook = i => { const h = t.hooks[i], u = setupOf(t.slots[i]), c = craneDef(u), hb = c ? K.hookBlocks(c) : [], hs = hb.findIndex(b => b.lb === h.hook && b.label === h.hookLabel);
      return `<div class="itGrpH">Hook ${i + 1} (crane ${i + 1})</div>
        ${t.type === 'single' ? '<p class="note">Single crane: the hook is plumb above the CG (spreader / lifting beam to the lifting points).</p>' : numIn(`tlH${i}s`, h.s, 'Lifting point from end A', 'ft', { ph: 'or the spreader centre' })}
        ${numIn(`tlH${i}sp`, h.sp, 'Spreader / lifting beam length', 'ft', { ph: 'drawing only' })}${numIn(`tlH${i}rig`, h.rig, 'Rigging weight (slings, spreader, hardware)', 'lb')}
        <div class="fRow"><label for="tlH${i}hb">Hook block</label><select id="tlH${i}hb"><option value="">entered below</option>${hb.map((b, k) => `<option value="${k}"${k === hs ? ' selected' : ''}>${esc(b.label)} (${fmt(b.lb, 0)} lb)</option>`).join('')}</select></div>
        ${numIn(`tlH${i}hook`, h.hook, 'Hook block weight', 'lb')}${numIn(`tlH${i}ded`, h.ded, 'Other deductions', 'lb', { ph: 'per the chart notes' })}
        ${numIn(`tlH${i}rigH`, h.rigH, 'Rigging height (hook to girder top)', 'ft', { ph: '0' })}${numIn(`tlH${i}blk`, h.blk, 'Hook block height', 'ft', { ph: '0' })}`; };
    return `<div class="sec" id="tlCard"><div class="secHead">${t.type === 'single' ? 'Girder lift (one crane)' : 'Tandem lift'}: ${esc(t.name)}</div><div class="secBody">
      <div class="fRow"><label for="tlName">Name</label><input type="text" id="tlName" value="${esc(t.name)}"></div>
      <div class="fRow"><label for="tlType">Lift</label><select id="tlType"><option value="tandem"${t.type === 'tandem' ? ' selected' : ''}>tandem: two cranes</option><option value="single"${t.type === 'single' ? ' selected' : ''}>one crane</option></select></div>
      ${slot(0)}${t.type === 'tandem' ? slot(1) : ''}
      <div class="itGrpH">Girder</div>
      ${numIn('tlL', g.L, 'Length L', 'ft')}${numIn('tlW', g.W, 'Weight', 'lb')}${numIn('tlCg', g.cg, 'CG from end A', 'ft', { ph: 'mid-length' })}${numIn('tlCgT', g.cgT, 'CG offset across (+ right of A→B)', 'ft', { ph: '0' })}
      ${numIn('tlH', g.H, 'Depth H', 'ft', { ph: '0' })}${numIn('tlB', g.B, 'Width in plan (flange)', 'ft', { ph: '0: the axis line' })}
      <label class="note" style="display:block"><input type="checkbox" id="tlPair"${pr.on ? ' checked' : ''}> Paired girders with cross-frames (lifted as one object)</label>
      ${pr.on ? `${numIn('tlPs', pr.s, 'Girder spacing', 'ft')}${numIn('tlPW2', pr.W2, 'Girder 2 weight', 'lb', { ph: 'as girder 1' })}${numIn('tlPcg2', pr.cg2, 'Girder 2 CG from end A', 'ft', { ph: 'as girder 1' })}${numIn('tlPxf', pr.xf, 'Cross-frames weight', 'lb')}${numIn('tlPxfCg', pr.xfCg, 'Cross-frames CG from end A', 'ft', { ph: 'mid-length' })}` : ''}
      ${hook(0)}${t.type === 'tandem' ? hook(1) : ''}
      <div class="itGrpH">Path (pick on the truck → set on the bearings)</div>
      ${numIn('tlPE', E(t.pick.x), 'Pick centre E', un)}${numIn('tlPN', E(t.pick.y), 'Pick centre N', un)}${numIn('tlPH', (+t.pick.h).toFixed(1), 'Pick heading A→B', '° (az.)')}${numIn('tlPZ', t.pick.z, 'Girder bottom el. at the pick', 'ft', { ph: 'crane 1 pad' })}
      ${numIn('tlSE', E(t.set.x), 'Set centre E', un)}${numIn('tlSN', E(t.set.y), 'Set centre N', un)}${numIn('tlSH', (+t.set.h).toFixed(1), 'Set heading A→B', '° (az.)')}${numIn('tlSZ', t.set.z, 'Girder bottom el. at the set', 'ft', { ph: 'crane 1 pad' })}
      ${numIn('tlTr', t.trav, 'Girder bottom el. during the travel', 'ft', { ph: 'higher of pick / set' })}
      <p class="note">Between the poses the girder's centre moves in straight lines through the waypoints and its heading turns evenly (the shorter way), at the travel elevation; it is hoisted at the pick and lowered at the set. Checked at every 1 ft of hook travel or 1° of slew of either crane (the finer).</p>
      <div class="itGrp">${t.way.map((w, k) => `<div class="itRow"><span class="itSel">Waypoint ${k + 1}: ${fmt(G.ftToNative(z.id, w.x), 2)} / ${fmt(G.ftToNative(z.id, w.y), 2)} ${un}, heading ${fmt(w.h, 1)}°</span><button type="button" class="itDel" data-tadelw="${k}" aria-label="Delete waypoint ${k + 1}">×</button></div>`).join('')}</div>
      <div class="goRow"><button type="button" data-ta="addWay">Add a waypoint</button><button type="button" data-ta="zoom">Show on the map</button><button type="button" class="danger" data-ta="del">Delete lift</button></div>
      <div id="tlLive">${resHtml(t)}</div></div></div>`;
  }
  function drawTab() {
    if (!el) return; if (sel && !tOf(sel)) sel = null; const t = tOf(sel), s = settings();
    el.innerHTML = `<div class="sec"><div class="secHead">Girder lift settings (project)</div><div class="secBody">
        ${numIn('tlLimit', s.tandem, 'Tandem limit (% of chart, each crane)', '%')}
        <p class="note">A crane in a tandem lift is flagged at or above this share of its chart capacity (default 75 %); a single-crane girder lift uses the lift thresholds (Lifts tab: caution ${s.caution} %, critical ${s.critical} %, limit ${s.limit} %).</p></div></div>
      <div class="sec"><div class="secHead">Girder lifts (${(A.P.tandems || []).length})</div><div class="secBody">
        <div class="goRow"><button type="button" class="primary" data-ta="newT">New tandem lift</button><button type="button" data-ta="newS">New one-crane girder lift</button></div>
        ${(A.P.tandems || []).map(x => `<div class="itRow${x.id === sel ? ' on' : ''}"><button type="button" class="itSel" data-tasel-t="${x.id}">${esc(x.name)}</button><span class="itSum">${sumText(x)}</span><button type="button" class="itDel" data-tadel="${x.id}" aria-label="Delete ${esc(x.name)}">×</button></div>`).join('')}
        ${A.P.cranes.length ? '' : '<p class="note">Add a crane to the project first (Cranes tab).</p>'}</div></div>${t ? cardHtml(t) : ''}`;
  }
  function sumText(t) { const r = evalT(t); return r.gov.length ? r.gov.map(g => g.c.e.look.ok ? fmt(g.c.pct, 1) + ' %' : 'n.p.').join(' / ') : 'incomplete'; }
  function select(id) { sel = id; scrub = 0; renderAll(); drawTab(); A.emit('change', { kind: 'select-lift', id }); if (window.CranePickElevView) window.CranePickElevView.redraw(); }
  function setStep(j) { const t = tOf(sel); if (!t) return; const r = evalT(t); scrub = stepIdx(r, j); place(t); liveCard(); if (window.CranePickElevView) window.CranePickElevView.redraw(); }
  function onClick(e) {
    const s = e.target.closest('[data-tgstep]'); if (s) { e.preventDefault(); setStep(+s.dataset.tgstep); return; }
    const b = e.target.closest('[data-ta],[data-tasel-t],[data-tadel],[data-tasel],[data-tadelw]'); if (!b) return; const t = tOf(sel);
    if (b.dataset.taselT) { select(b.dataset.taselT); return; }
    if (b.dataset.tadel) { delLift(b.dataset.tadel); return; }
    if (b.dataset.tasel) { e.preventDefault(); if (window.CranePickPlace) window.CranePickPlace.select(b.dataset.tasel, null); return; }
    if (b.dataset.tadelw && t) { const k = +b.dataset.tadelw; A.update(() => { t.way.splice(k, 1); }, 'tandem', { id: t.id }); renderAll(); drawTab(); return; }
    const a = b.dataset.ta;
    if (a === 'newT') newLift('tandem'); else if (a === 'newS') newLift('single');
    else if (a === 'play') togglePlay();
    else if (a === 'picksTab') { e.preventDefault(); A.showOTab('picks'); }
    else if (a === 'rpt') { e.preventDefault(); gotoReport(sel); }
    else if (!t) return;
    else if (a === 'place0' || a === 'place1') { const i = +a.slice(5); placeFor(t, i, el.querySelector('#tlNew' + i).value); }
    else if (a === 'addWay') { const last = t.way.length ? t.way[t.way.length - 1] : t.pick, dh = T().norm180(t.set.h - last.h);
      A.update(() => { t.way.push({ x: (last.x + t.set.x) / 2 + 10, y: (last.y + t.set.y) / 2, h: ((last.h + dh / 2) % 360 + 360) % 360 }); }, 'tandem', { id: t.id }); renderAll(); drawTab(); }
    else if (a === 'zoom') zoomTo(t);
    else if (a === 'del') delLift(t.id);
  }
  function zoomTo(t) { if (!MP() || !MP().map) return; A.showOTab('plan'); const L = T().object(t).L, pts = [t.pick, t.set].concat(t.way, t.slots.map(setupOf).filter(Boolean)); const r = L / 2 + 30;
    MP().fit([{ x: Math.min(...pts.map(p => p.x)) - r, y: Math.min(...pts.map(p => p.y)) - r }, { x: Math.max(...pts.map(p => p.x)) + r, y: Math.max(...pts.map(p => p.y)) + r }]); }
  function togglePlay() {
    if (play) { clearInterval(play); play = null; liveCard(); return; }
    const t = tOf(sel); if (!t) return; const r = evalT(t); if (scrub >= r.steps.length - 1) scrub = 0;
    play = setInterval(() => { const t2 = tOf(sel), r2 = t2 && evalT(t2); if (!r2 || scrub >= r2.steps.length - 1) { clearInterval(play); play = null; liveCard(); return; } setStep(scrub + 1); }, 60);
    liveCard();
  }
  function onInput(e) { if (e.target.id === 'tlScrub') setStep(+e.target.value); }
  function onChange(e) {
    const tg = e.target, t = tOf(sel), z = A.P.site.zone;
    if (tg.id === 'tlScrub') return;
    const num = () => { if (tg.value.trim() === '') return null; const v = G.parseNum(tg.value); if (!isFinite(v)) { tg.classList.add('bad'); return undefined; } tg.classList.remove('bad'); return v; };
    const up = fn => { A.update(fn, 'tandem', { id: t && t.id }); renderAll(); drawTab(); };
    if (tg.id === 'tlLimit') { const v = num(); if (v == null || !(v > 0 && v <= 200)) { tg.classList.add('bad'); return; } up(P => { P.lift.tandem = v; }); return; }
    if (!t) return;
    if (tg.id === 'tlName') return up(() => { t.name = tg.value || 'Girder lift'; });
    if (tg.id === 'tlType') return up(() => { t.type = tg.value === 'single' ? 'single' : 'tandem'; });
    if (tg.id === 'tlSlot0' || tg.id === 'tlSlot1') return up(() => { t.slots[+tg.id.slice(-1)] = tg.value; });
    if (tg.id === 'tlPair') return up(() => { t.girder.pair.on = tg.checked; });
    const gk = { tlL: 'L', tlW: 'W', tlCg: 'cg', tlCgT: 'cgT', tlH: 'H', tlB: 'B' }[tg.id], pk = { tlPs: 's', tlPW2: 'W2', tlPcg2: 'cg2', tlPxf: 'xf', tlPxfCg: 'xfCg' }[tg.id];
    if (gk || pk) { const v = num(); if (v === undefined || (v !== null && v < 0 && gk !== 'cgT') || (gk === 'L' && !(v > 0))) { tg.classList.add('bad'); return; } return up(() => { if (gk) t.girder[gk] = v; else t.girder.pair[pk] = v; }); }
    const hm = /^tlH([01])(s|sp|rig|hook|ded|rigH|blk|hb)$/.exec(tg.id);
    if (hm) { const h = t.hooks[+hm[1]], f = hm[2];
      if (f === 'hb') { const c = craneDef(setupOf(t.slots[+hm[1]])), b = c && K.hookBlocks(c)[+tg.value]; if (tg.value === '' || !b) return; return up(() => { h.hook = b.lb; h.hookLabel = b.label; }); }
      const v = num(); if (v === undefined || (v !== null && v < 0) || (f === 's' && v == null)) { tg.classList.add('bad'); return; }
      return up(() => { h[f] = v; if (f === 'hook') h.hookLabel = v == null ? '' : 'entered'; }); }
    const pm = { tlPE: ['pick', 'x'], tlPN: ['pick', 'y'], tlPH: ['pick', 'h'], tlPZ: ['pick', 'z'], tlSE: ['set', 'x'], tlSN: ['set', 'y'], tlSH: ['set', 'h'], tlSZ: ['set', 'z'] }[tg.id];
    if (pm) { const v = num(); if (v === undefined || (v === null && pm[1] !== 'z')) { tg.classList.add('bad'); return; }
      return up(() => { t[pm[0]][pm[1]] = pm[1] === 'z' ? v : pm[1] === 'h' ? ((v % 360) + 360) % 360 : G.nativeToFt(z, v); }); }
    if (tg.id === 'tlTr') { const v = num(); if (v === undefined) return; return up(() => { t.trav = v; }); }
  }
  /* ---------- elevation: the vertical plane through the two cranes (one crane: through it and its hook) ---------- */
  function elevSvg(t, r, j, o) {
    o = o || {}; const q = r.steps[j]; if (!q) return '';
    const e = env(t), us = e.setups, c0 = q.cr[0]; if (!us[0] || !c0) return '';
    const a = us[0], b = us[1] && q.cr[1] ? us[1] : c0.p, L0 = Math.hypot(b.x - a.x, b.y - a.y) || 1, v = { x: (b.x - a.x) / L0, y: (b.y - a.y) / L0 }, sOf = p => (p.x - a.x) * v.x + (p.y - a.y) * v.y;
    const ob = r.sh.ob, H = ob.H, zb = q.x.pose.z, ge = ends(t, q.x.pose, ob.L), sg = ge.map(sOf), zp = EL().padEl(a);
    const zs = [zp, zb, zb + H].concat(q.cr.filter(Boolean).map(c => c.zTip || zp)), ss = [0, L0].concat(sg, q.cr.filter(Boolean).map(c => sOf(c.p)));
    const s0 = Math.min(...ss) - 15, s1 = Math.max(...ss) + 15, z0 = Math.min(...zs) - 5, z1 = Math.max(...zs) + 8, Wd = o.w || 680, Ht0 = o.h || 280;
    const k = Math.min((Wd - 20) / (s1 - s0), (Ht0 - 60) / (z1 - z0)), Ht = Math.max(160, Math.min(Ht0, (z1 - z0) * k + 60));   // 46 px on top for the title and the legend
    const X = s => (10 + (s - s0) * k).toFixed(1), Y = z => (Ht - 14 - (z - z0) * k).toFixed(1), ln = (s, z, s2, z2, sty) => `<line x1="${X(s)}" y1="${Y(z)}" x2="${X(s2)}" y2="${Y(z2)}" ${sty}/>`;
    let out = `<svg xmlns="http://www.w3.org/2000/svg" class="tgElevSvg" viewBox="0 0 ${Wd} ${Ht.toFixed(0)}" width="${Wd}" height="${Ht.toFixed(0)}" font-family="Arial, sans-serif" font-size="10"><rect width="100%" height="100%" fill="#fff" stroke="#94a3b8"/>`;
    out += `<rect x="0" y="${Y(zp)}" width="${Wd}" height="${Math.max(0, Ht - +Y(zp)).toFixed(1)}" fill="#E7E5E4"/>` + `<line x1="0" y1="${Y(zp)}" x2="${Wd}" y2="${Y(zp)}" stroke="#57534E" stroke-width="1.2"/>`;
    out += `<rect class="tgElGirder" x="${X(Math.min(...sg))}" y="${Y(zb + H)}" width="${Math.max(2, Math.abs(sg[1] - sg[0]) * k).toFixed(1)}" height="${Math.max(2, H * k).toFixed(1)}" fill="#2563EB" fill-opacity="0.35" stroke="#1E3A8A"/>`;
    const legend = [];
    q.cr.forEach((c, i) => { if (!c) return; const u = us[i], sc = sOf(u), sh = sOf(c.p), sf = sOf(c.foot);
      out += `<rect x="${X(sc - 6)}" y="${Y(zp + 6)}" width="${(12 * k).toFixed(1)}" height="${(6 * k).toFixed(1)}" fill="#94A3B8" stroke="#334155"/>`;
      if (c.tip) { out += ln(sf, c.foot.z, sh, c.tip.z, `class="tgElBoom" stroke="${COLS[c.cls] || '#0F172A'}" stroke-width="3" stroke-linecap="round"`) + ln(sh, c.tip.z, sh, c.zBk, 'stroke="#334155"');
        out += `<text x="${X(sh)}" y="${Y(c.tip.z)}" dy="-5" text-anchor="middle">C${i + 1} tip ${fmt(c.tip.z, 1)}</text>`; }
      out += `<rect x="${X(sh) - 3}" y="${Y(c.zBk)}" width="6" height="${Math.max(2, (c.zBk - c.zHk) * k).toFixed(1)}" fill="#F59E0B" stroke="#78350F"/>` + ln(sh, c.zHk, sh, zb + H, 'stroke="#78350F" stroke-dasharray="3 2"');
      out += `<text x="${X(sh)}" y="${Y(c.zHk)}" dx="6" dy="4" fill="#78350F" font-weight="bold">C${i + 1}</text>`;
      legend.push(`C${i + 1}: hook el. ${fmt(c.zHk, 2)} · R ${fmt(c.R, 2)} ft · ${c.e.look.ok ? fmt(c.C, 0) + ' lb · ' + fmt(c.pct, 1) + ' %' : 'not permitted'}`); });
    out += legend.map((l, i) => `<text x="8" y="${26 + 12 * i}" fill="#78350F">${esc(l)}</text>`).join('');
    out += `<text x="8" y="12" font-weight="bold">${esc(t.name)}, step ${j}: ${esc(T().where(q.x))} (girder bottom el. ${fmt(zb, 2)}; plane through ${us[1] && q.cr[1] ? 'both cranes' : 'the crane and its hook'}; to scale)</text></svg>`;
    return out;
  }
  /* the elevation dock under the map (ui/elev.js): the selected girder lift while the Girder lifts tab is open (or when there is no pick) */
  function active() { const t = tOf(sel); return t && (A.ui.itab === 'tandem' || !A.P.picks.length) ? t : null; }
  function dockSvg(w) { const t = active(); if (!t) return ''; const r = evalT(t); return elevSvg(t, r, stepIdx(r, scrub), { w, h: 260 }) || '<p class="note">Choose the crane setups and enter the girder (Girder lifts tab).</p>'; }
  /* ---------- 3D (ui/view3d.js calls draw3d while it builds the lift group) ---------- */
  function draw3d(h) {
    const t = tOf(sel) || (A.P.tandems || [])[0]; if (!t) return false; const r = evalT(t), j = t.id === sel ? stepIdx(r, scrub) : 0, q = r.steps[j]; if (!q) return false;
    const T3 = h.T, g = h.g, ob = r.sh.ob, H = Math.max(0.5, ob.H), o = T().outline(t, q.x.pose, ob);
    const box = o.box.length >= 3 ? o.box : (() => { const ax = q.x.pose.h * Math.PI / 180, nx = Math.cos(ax) * 0.5, ny = -Math.sin(ax) * 0.5; return [{ x: o.box[0].x - nx, y: o.box[0].y - ny }, { x: o.box[1].x - nx, y: o.box[1].y - ny }, { x: o.box[1].x + nx, y: o.box[1].y + ny }, { x: o.box[0].x + nx, y: o.box[0].y + ny }]; })();
    const gm = h.prism(T3, box, q.x.pose.z, q.x.pose.z + H, h.mat(T3, 0x2563eb, { transparent: true, opacity: 0.8 })); gm.userData.girder = true; g.add(gm);
    q.cr.forEach((c, i) => { if (!c || !c.tip) return; const b = h.rod(T3, h.W3(c.foot.x, c.foot.y, c.foot.z), h.W3(c.tip.x, c.tip.y, c.tip.z), Math.max(0.6, c.rb), h.mat(T3, i ? 0x7c2d12 : 0x0f172a)); b.userData.tboom = i + 1; g.add(b);
      g.add(h.line(T3, h.W3(c.tip.x, c.tip.y, c.tip.z), h.W3(c.p.x, c.p.y, c.zBk), 0x334155)); g.add(h.line(T3, h.W3(c.p.x, c.p.y, c.zHk), h.W3(c.p.x, c.p.y, q.x.pose.z + ob.H), 0x78350f));
      const blk = new T3.Mesh(new T3.BoxGeometry(1.5, Math.max(0.5, c.zBk - c.zHk), 1.5), h.mat(T3, 0xf59e0b)); blk.position.copy(h.W3(c.p.x, c.p.y, (c.zHk + c.zBk) / 2)); g.add(blk); });
    const cs = r.steps.map(z => h.W3(z.x.pose.x, z.x.pose.y, z.x.pose.z + ob.H)); if (cs.length > 1) g.add(h.poly(T3, cs, 0x7c3aed));
    return { x: q.x.pose.x, y: q.x.pose.y, z: q.x.pose.z, key: t.id };
  }
  /* ---------- the Picks tab rows (ui/picks.js appends them) ---------- */
  function picksHtml() {
    const ts = A.P.tandems || []; if (!ts.length) return '';
    const rows = []; ts.forEach(t => { const r = evalT(t); if (!r.gov.length) { rows.push(`<tr><td><a href="#" data-tgmap="${t.id}">${esc(t.name)}</a></td><td colspan="10" class="warnT">${esc((r.flags[0] || {}).text || 'incomplete')}</td></tr>`); return; }
      r.gov.forEach((g, i) => { const u = setupOf(t.slots[i]); rows.push(`<tr data-tg="${t.id}"><td><a href="#" data-tgmap="${t.id}">${esc(t.name)}</a></td><td>${i + 1}${r.single ? ' (one crane)' : ''}</td><td>${esc(u ? u.name : '—')}</td><td class="n">${fmt(u && u.boom, 1)}</td><td class="n">${fmt(r.sh.Wh[i], 0)}</td><td class="n">${g.i}</td><td>${esc(g.where)}</td><td class="n">${fmt(g.c.R, 2)}</td><td class="n">${g.c.e.look.ok ? fmt(g.c.C, 0) : 'n.p.'}</td><td class="n">${g.c.e.look.ok ? fmt(g.c.pct, 1) + ' %' : '—'}</td><td><span class="lv lv-${g.c.cls}">${esc(r.single ? LF.CLS[g.c.cls] : T().CLS[g.c.cls])}</span></td><td>${r.flags.filter(f => f.level !== 'info').length || '—'}</td><td><a href="#" data-tgr="${t.id}">Report</a></td></tr>`); }); });
    return `<div class="sec" id="tgPicks"><div class="secHead">Girder lifts (${ts.length})</div><div class="secBody"><p class="note">One row per crane per girder lift; tandem limit ${fmt(settings().tandem, 0)} % of chart per crane; the governing step of each crane along the path.</p>
      <div class="tscroll"><table class="tbl" id="tgTbl"><thead><tr><th>Lift</th><th>Crane</th><th>Setup</th><th>Boom (ft)</th><th>W hook (lb)</th><th>Step</th><th>Governing</th><th>R (ft)</th><th>C (lb)</th><th>% chart</th><th>Status</th><th>Flags</th><th></th></tr></thead><tbody>${rows.join('')}</tbody></table></div></div></div>`;
  }
  document.addEventListener('click', e => { const m = e.target.closest('[data-tgmap],[data-tgr]'); if (!m || !m.closest('#tgPicks')) return; e.preventDefault();
    if (m.dataset.tgmap) { A.showOTab('plan'); select(m.dataset.tgmap); A.showITab('tandem'); const t = tOf(m.dataset.tgmap); if (t) zoomTo(t); } else gotoReport(m.dataset.tgr); });
  function gotoReport(id) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump(id ? 'tandem-' + id : 'tandem'); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  /* ---------- Report §Tandem lifts ---------- */
  window.CranePickReport && window.CranePickReport.add(P => {
    const ts = P.tandems || []; if (!ts.length) return [];
    const s = settings(), C = T().COMP, rs = ts.map(t => ({ t, r: evalT(t) }));
    const subs = [{ id: 'tbasis', key: 'tandem-basis', title: 'Basis', items: [
      { type: 'kv', rows: [['Load share (hooks plumb)', 'R1 = W_g (x2 − x_cg) / (x2 − x1), R2 = W_g − R1 (statics about the girder axis); each hook W_i = R_i + rigging + hook block + other deductions; one crane: the hook plumb above the CG'],
        ['Paired girders', 'one object: W_g = W1 + W2 + W_xf; x_cg = Σ W x / W_g; t_cg = (W1 (t_c − s/2) + W2 (t_c + s/2)) / W_g'],
        ['Capacity at each step', 'the hook plumb above its lifting point; radius, zone and chart capacity by the lift rule (§Lifts, next longer boom, next larger radius); % of chart = W_i / C × 100'],
        ['Tandem limit', `${fmt(s.tandem, 0)} % of chart per crane (project setting); a one-crane girder lift uses the lift thresholds (caution ${s.caution} %, critical ${s.critical} %, limit ${s.limit} %)`],
        ['Path', 'hoist at the pick pose to the travel elevation (every 1 ft), travel through the waypoints (the centre in straight lines, the heading turning evenly the shorter way), lower at the set pose; each leg in steps of the finer of 1 ft of hook travel and 1° of slew of either crane'],
        ['Clearances', 'every step: each crane\'s boom, load line and counterweight, and the girder as a box (plan outline × depth), against power lines (D_min, 29 CFR 1926.1408), obstructions and exclusion zones; crane–crane: the least distance between the two booms / load lines (contact red, closer than the obstruction clearance amber)'],
        ['Girder level', 'the hook-height difference z_hk,1 − z_hk,2 (informational)'],
        ['Ground', 'each crane by the §Ground method with its own hook load W_i (girder share + its rigging, block, deductions) at its own hook at every step (in place of the swing path); the stress at depth at buried items from both cranes\' supports summed at the same step (superposition), each crane\'s loads at its own depth below its pad']] },
      { type: 'note', warn: true, text: 'Decisions (pending engineer review): hooks plumb (no sling angle or hook drift); the girder carried level and rigid; the path model above; the governing step = the highest % of chart (the first of equal steps); the crane–crane clearance uses the obstruction clearance setting.' }] },
      { id: 'tsum', key: 'tandem-summary', title: 'Summary', items: [{ type: 'table', wide: true, head: ['Lift', 'Crane', 'Setup', 'W hook (lb)', 'Governing step', 'Where', 'R (ft)', 'C (lb)', '% chart', 'Status'],
        rows: [].concat(...rs.map(({ t, r }) => r.gov.map((g, i) => ({ cells: [{ t: t.name, key: 'tandem-' + t.id }, String(i + 1), (setupOf(t.slots[i]) || {}).name || '—', { t: fmt(r.sh.Wh[i], 0), n: true }, { t: String(g.i), n: true }, g.where, { t: fmt(g.c.R, 2), n: true }, { t: g.c.e.look.ok ? fmt(g.c.C, 0) : 'n.p.', n: true },
          { t: g.c.e.look.ok ? fmt(g.c.pct, 1) : '—', n: true, cls: g.c.cls === 'ok' ? 'ok' : 'ng' }, r.single ? LF.CLS[g.c.cls] : T().CLS[g.c.cls]] })))) }] }];
    rs.forEach(({ t, r }) => {
      const z = G.zone(P.site.zone), un = z.unit === 'm' ? 'm' : 'ft', E = v => fmt(G.ftToNative(z.id, v), 2), ob = r.sh.ob, sc = 'tg-' + t.id;
      const items = [{ type: 'kv', rows: [['Lift', t.type === 'single' ? 'one crane' : 'tandem (two cranes)']].concat(t.slots.slice(0, nC(t)).map((id, i) => [`Crane ${i + 1}`, (setupOf(id) || {}).name || 'not chosen']), [
        ['Girder L / weight', `${fmt(ob.L, 2)} ft / ${fmt(ob.W1, 0)} lb${ob.pair ? `; paired: spacing ${fmt(ob.s, 2)} ft, girder 2 ${fmt(ob.W2, 0)} lb, cross-frames ${fmt(ob.Wx, 0)} lb` : ''}`], ['Combined W_g / x_cg / t_cg', `${fmt(ob.Wg, 0)} lb / ${fmt(ob.xcg, 2)} ft / ${fmt(ob.tcg, 2)} ft`],
        ['Depth / width (ft)', `${fmt(ob.H, 2)} / ${fmt(ob.B, 2)}`], [`Pick centre E / N (${un}), heading, bottom el.`, `${E(t.pick.x)} / ${E(t.pick.y)}, ${fmt(t.pick.h, 1)}°, ${fmt(r.path.zP, 2)} ft`],
        [`Set centre E / N (${un}), heading, bottom el.`, `${E(t.set.x)} / ${E(t.set.y)}, ${fmt(t.set.h, 1)}°, ${fmt(r.path.zS, 2)} ft`], ['Travel el. / waypoints / steps', `${fmt(r.path.zT, 2)} ft${r.path.trEntered ? '' : ' (higher of pick and set)'} / ${t.way.length} / ${r.steps.length}`]].concat(
        t.hooks.slice(0, nC(t)).map((h, i) => [`Hook ${i + 1}`, `${t.type === 'single' ? 'over the CG' : 'x = ' + fmt(h.s, 2) + ' ft'}; rigging ${fmt(h.rig || 0, 0)} lb, block ${fmt(h.hook || 0, 0)} lb${h.hookLabel ? ' (' + h.hookLabel + ')' : ''}, other ${fmt(h.ded || 0, 0)} lb; rigging height ${fmt(h.rigH || 0, 2)} ft, block ${fmt(h.blk || 0, 2)} ft`]))) }];
      if (r.flags.length) items.push({ type: 'note', warn: r.flags.some(f => f.level !== 'info'), text: 'Flags: ' + r.flags.map(f => (isNum(f.step) ? `step ${f.step}: ` : '') + f.text).join(' ') });
      items.push({ type: 'steps', scope: sc, title: 'Load share', steps: r.sh.steps }, { type: 'steps', scope: sc, title: 'Path', steps: r.path.steps });
      if (r.steps.length) {
        const every = Math.max(1, Math.ceil(r.steps.length / 40)), pick = new Set(r.gov.map(g => g.i).concat([0, r.steps.length - 1]));
        items.push({ type: 'table', wide: true, head: ['Step', 'Where', 'Bottom el. (ft)'].concat(...r.gov.map((g, i) => [`C${i + 1} R (ft)`, `C${i + 1} C (lb)`, `C${i + 1} % chart`, `C${i + 1} reach (ft)`])),
          rows: r.steps.filter((q, j) => j % every === 0 || pick.has(j)).map(q => [String(q.x.i) + (r.gov.some(g => g.i === q.x.i) ? ' (gov.)' : ''), T().where(q.x), { t: fmt(q.x.pose.z, 2), n: true }].concat(...q.cr.map(c => !c ? ['—', '—', '—', '—'] : [{ t: fmt(c.R, 2), n: true }, { t: c.e.look.ok ? fmt(c.C, 0) : 'n.p.', n: true }, { t: c.e.look.ok ? fmt(c.pct, 1) : '—', n: true, cls: c.cls === 'ok' ? '' : 'ng' }, { t: c.margin == null ? 'n.r.' : fmt(c.margin, 2), n: true }]))) },
          { type: 'note', text: `Steps along the path (${every > 1 ? `every ${every}th step, the ends and the governing steps` : 'every step'}).` });
        items.push({ type: 'figure', svg: elevSvg(t, r, r.gov[0].i, { w: 680, h: 280 }), caption: `Elevation at crane 1's governing step (${r.gov[0].where}): the cranes' booms, hooks and the girder in the vertical plane through ${nC(t) > 1 ? 'both cranes' : 'the crane and its hook'}; to scale.` });
      }
      r.gov.forEach((g, i) => items.push({ type: 'steps', scope: sc, title: `Crane ${i + 1}: governing step ${g.i} (${g.where})`, steps: g.steps }));
      if (r.level) items.push({ type: 'steps', scope: sc, title: 'Girder level', steps: r.level.steps });
      if (r.cc) items.push({ type: 'steps', scope: sc, title: 'Crane–crane distance', steps: r.cc.steps });
      if (r.clr.length) { items.push({ type: 'table', wide: true, head: ['Item', 'Required (ft)', 'Closest (ft)', 'Component', 'Where', 'Result'], rows: r.clr.map(c => [c.name, c.type === 'power' ? (isNum(c.D) ? fmt(c.D, 0) + ' (D_min)' : 'not set') : c.type === 'obst' ? fmt(c.req, 2) : 'outside', { t: fmt(c.gov.d, 2), n: true, cls: c.level === 'stop' ? 'ng' : c.level === 'warn' ? 'hi' : 'ok' }, (c.gov.crane == null ? '' : 'crane ' + (c.gov.crane + 1) + ' ') + C[c.gov.comp], c.where, c.level === 'stop' ? 'NOT OK' : c.level === 'warn' ? 'check' : 'OK']) });
        r.clr.forEach(c => items.push({ type: 'steps', scope: sc, title: 'Clearance: ' + c.name, steps: c.steps })); }
      if (r.ground) {   // C5: ground per crane, and the stress at depth from both cranes
        r.ground.cr.forEach((g, i) => {
          if (g.mode === 'none') { items.push({ type: 'note', warn: true, text: `Crane ${i + 1}, ground: not computed: ${g.why}.` }); return; }
          items.push({ type: 'note', warn: g.mode !== 'rigid', text: `Crane ${i + 1}, ground (${g.mode === 'rigid' ? 'rigid body, entered data' : 'ESTIMATE — verify with the manufacturer\'s outrigger calculator'}; method: §Ground basis): hook load W${i + 1} = ${fmt(g.W, 0)} lb at its hook at every step. ` + (window.CranePickGroundUI ? window.CranePickGroundUI.inputsNote(g).replace(/<[^>]+>/g, '') : '') });
          items.push({ type: 'table', head: [g.S.kind === 'crawler' ? 'Track' : 'Float', 'Load (kip)', 'Slew θ', 'R (ft)', 'q_g (psf)', 'q_g / q_a', 'M/M_a', 'V/V_a'],
            rows: g.max.map((m, k) => { const b = g.bear[k]; return [m.id + ' (' + m.name + ')', { t: fmt(m.load / 1000, 2), n: true }, { t: fmt(m.theta, 0) + '°', n: true }, { t: fmt(m.R, 2), n: true }, { t: fmt(b.qg, 0), n: true }, { t: b.ratio == null ? '—' : fmt(b.ratio, 2), n: true, cls: b.ratio > 1 ? 'ng' : '' }, { t: isNum(b.rM) ? fmt(b.rM, 2) : '—', n: true }, { t: isNum(b.rV) ? fmt(b.rV, 2) : '—', n: true }]; }) });
          items.push({ type: 'steps', scope: sc, title: `Crane ${i + 1}, ground: governing support ${g.gov.name}`, steps: g.steps });
          g.max.forEach((m, k) => { if (g.bear[k].steps.length) items.push({ type: 'steps', scope: sc, title: `Crane ${i + 1}, ${m.name}: bearing${g.mat.type !== 'none' ? ' and mat' : ''}`, steps: g.bear[k].steps }); });
          g.depth.filter(d => d.steps).forEach(d => items.push({ type: 'steps', scope: sc, title: `Crane ${i + 1} alone, stress at depth: ${d.name}`, steps: d.steps }));
        });
        const pr = r.ground.pair.filter(d => !d.none && !d.far);
        if (pr.length) { items.push({ type: 'table', head: ['Item (both cranes)', 'Δσ_z crane 1 (psf)', 'Δσ_z crane 2 (psf)', 'Δσ_z sum (psf)', 'Step', 'Allowable (psf)', 'Ratio'],
          rows: pr.map(d => [d.name, { t: fmt(d.parts[0], 0), n: true }, { t: fmt(d.parts[1], 0), n: true }, { t: fmt(d.ds, 0), n: true }, { t: String(d.j), n: true }, d.cap ? fmt(d.cap, 0) : 'not entered', { t: d.ratio == null ? '—' : fmt(d.ratio, 2), n: true, cls: d.ratio > 1 ? 'ng' : '' }]) });
          pr.forEach(d => items.push({ type: 'steps', scope: sc, title: 'Stress at depth, both cranes: ' + d.name, steps: d.steps })); }
      }
      subs.push({ id: 't-' + t.id, key: 'tandem-' + t.id, title: t.name, ref: r.gov.map(g => g.c.e.look.ok ? fmt(g.c.pct, 1) + ' %' : 'n.p.').join(' / '), items });
    });
    return [{ id: 'tandem', key: 'tandem', title: 'Tandem lifts', subs }];
  });
  /* ---------- wiring ---------- */
  function build(p) { el = p; p.addEventListener('click', onClick); p.addEventListener('change', onChange); p.addEventListener('input', onInput);
    p.addEventListener('toggle', e => { if (e.target.id === 'tlSteps') { stepsOpen = e.target.open; if (stepsOpen) liveCard(); } if (e.target.id === 'tlGround') grOpen = e.target.open; }, true); drawTab(); }
  A.inTab({ id: 'tandem', label: 'Girder lifts', build, show: drawTab });
  A.on('project', () => { rev++; memo.clear(); renderAll(); drawTab(); });
  A.on('change', o => { if (o.kind !== 'tandem' && o.kind !== 'select' && o.kind !== 'select-lift') rev++;
    if (['tandem', 'lifts', 'setups', 'picks', 'cranes', 'items', 'site'].indexOf(o.kind) < 0) return;
    if (o.kind === 'tandem' && Date.now() - dragEnd < 400) { drawTab(); return; }
    renderAll(); drawTab(); });
  A.on('live', o => { if (o.kind === 'items') rev++; if (o.kind === 'lifts' || o.kind === 'items') { (A.P.tandems || []).forEach(t => place(t)); liveCard(); } });
  A.on('tab', id => { if (id === 'plan') setTimeout(() => (A.P.tandems || []).forEach(t => place(t)), 0); });
  window.CranePickTandemUI = { active, dockSvg, newLift, placeFor, select, setStep, evalT, renderAll, picksHtml, elevSvg, draw3d, layers, get selected() { return sel; }, get step() { return scrub; } };
})();
