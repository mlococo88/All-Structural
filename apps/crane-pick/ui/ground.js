/* apps/crane-pick/ui/ground.js — ground and supports in the app (window.CranePickGroundUI). C4 (2026-11-16).
   Ground input tab: per crane setup the mat / plate under each float or track (type, size, thickness, material values, spread) and the
   allowable bearing pressure; per buried utility / culvert / wall (Site items) an optional allowable stress increase at its top.
   Ground output tab: per pick the float / track loads (largest along the swing, governing slew angle), the method ("entered data" or
   "estimate — verify with the manufacturer's outrigger calculator"), bearing pressure and ratio, mat checks, stress at depth, and the
   worked steps (CLAUDE.md §6). Map (Plan tab): the pressure colour under each float / track (and mat), with live float-load labels that
   follow every drag. Report §Ground. Values: engine/ground.js through CranePickPlace.evalPick (ev.ground), the same numbers everywhere. */
(function () {
  'use strict';
  const A = window.CranePickApp, GR = window.CranePickGround, LF = window.CranePickLift, K = window.CranePickCranes, M = window.CranePickModel, G = window.CranePickGeo, esc = A.esc;
  const PL = () => window.CranePickPlace, MP = () => window.CranePickMap, L_ = () => window.L;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const fmt = (v, d) => isNum(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : (v === Infinity ? '∞' : '—');
  const ksf = v => isNum(v) ? fmt(v / 1000, 2) : fmt(v, 2);
  let inEl = null, outEl = null, dirty = true, stepsOpen = new Set();
  const layers = new Map();   // setup id -> [layers]
  const setupOf = id => A.P.setups.find(u => u.id === id) || null;
  const craneOf = u => { const c = u && A.P.cranes.find(x => x.id === u.craneId); return c ? c.def : null; };
  const showMap = () => A.ui.grMap !== false;
  /* the ground result of a pick (memoized with the pick's other results in CranePickPlace.evalPick) */
  function groundOf(k) { const ev = PL() && PL().evalPick(k); return ev && ev.ground ? ev.ground : null; }
  /* a setup's supports: the largest over its picks (the map and the summary) */
  function setupSum(u) {
    const gs = A.P.picks.filter(k => k.setupId === u.id).map(k => ({ k, g: groundOf(k) })).filter(x => x.g && x.g.mode !== 'none');
    if (!gs.length) return null;
    const S = gs[0].g.S, tr = S.kind === 'crawler';
    const sup = S.items.map((it, i) => { let b = null; gs.forEach(x => { const m = x.g.max[i], v = tr ? m.q : m.load; if (!b || v > b.v) b = { v, m, br: x.g.bear[i], g: x.g, k: x.k }; }); return Object.assign({ it, i }, b); });
    return { S, sup, est: gs.some(x => x.g.mode === 'estimate'), qa: gs[0].g.qa, mat: gs[0].g.mat };
  }
  const RAMP = r => r == null ? null : r < 0.5 ? '#059669' : r < 0.8 ? '#65A30D' : r < 1 ? '#D97706' : '#DC2626';
  function colOf(q, qa, qref) { if (!isNum(q)) return '#DC2626'; if (qa) return RAMP(q / qa); const t = Math.max(0, Math.min(1, q / (qref || q || 1))); return `rgb(${Math.round(37 + 180 * t)},${Math.round(99 - 60 * t)},${Math.round(235 - 160 * t)})`; }
  /* ---------- map ---------- */
  function pane() { const m = MP().map; if (!m.getPane('crGround')) { const p = m.createPane('crGround'); p.style.zIndex = 450; p.style.pointerEvents = 'none'; } return 'crGround'; }
  function clearSetup(id) { (layers.get(id) || []).forEach(x => x.remove()); layers.delete(id); }
  function renderAll() {
    if (!MP() || !MP().map || !window.L) return;
    [...layers.keys()].forEach(clearSetup);
    if (!showMap()) return;
    A.P.setups.forEach(renderSetup);
  }
  function renderSetup(u) {
    clearSetup(u.id); if (!showMap() || !MP() || !MP().map) return;
    const s = setupSum(u); if (!s) return;
    const Lf = L_(), m = MP().map, pn = pane(), out = [], add = x => { x.addTo(m); out.push(x); return x; }, ll = pts => pts.map(p => MP().toLL(p));
    const rect = (cx, cy, bx, by) => [[cx + bx / 2, cy + by / 2], [cx + bx / 2, cy - by / 2], [cx - bx / 2, cy - by / 2], [cx - bx / 2, cy + by / 2]].map(([x, y]) => LF.toGrid(u, x, y));
    const qref = Math.max(...s.sup.map(x => x.br ? x.br.qg : 0).filter(isNum), 1), ba = GR.bearingArea(s.S, s.mat);
    s.sup.forEach(x => {
      const it = x.it, br = x.br || {}, col = colOf(br.qg, s.qa, qref);
      if (s.S.kind === 'wheeled') {
        if (s.mat.type !== 'none') add(Lf.polygon(ll(rect(it.lx, it.ly, ba.Bx, ba.By)), { pane: pn, color: col, weight: 1.5, fillColor: col, fillOpacity: 0.45, interactive: false, className: 'crGrArea' }));
        add(Lf.polygon(ll(LF.circle(LF.toGrid(u, it.lx, it.ly), s.S.f / 2, 20)), { pane: pn, color: '#0f172a', weight: 1, fillColor: col, fillOpacity: 0.85, interactive: false, className: 'crGrArea' }));
      } else {
        const ms = x.m.s, T = ms.bound ? ms.T[x.i] : ms.d.T[x.i], n = 12, Lt = s.S.Lt, sc = s.S.s / ba.Bx, gam = s.mat.type !== 'none' ? (s.mat.gamma || 0) * (s.mat.t || 0) / 12 : 0;
        for (let j = 0; j < n; j++) { const eta = -Lt / 2 + Lt * (j + 0.5) / n, q = T.stable ? Math.max(0, T.q0 + T.gy * eta) * sc + gam : Infinity;
          add(Lf.polygon(ll(rect(eta, it.ly, Lt / n, ba.Bx)), { pane: pn, color: colOf(q, s.qa, qref), weight: 0.5, fillColor: colOf(q, s.qa, qref), fillOpacity: 0.75, interactive: false, className: 'crGrArea' })); }
      }
      const lp = LF.toGrid(u, it.lx, it.ly), lbl = s.S.kind === 'wheeled' ? `${it.id} ${fmt(x.m.load / 1000, 1)} k · ${ksf(br.qg)} ksf` : `${it.id} ${fmt(x.m.load / 1000, 0)} k · ${ksf(br.qg)} ksf max`;
      add(Lf.marker(MP().toLL(lp), { pane: 'markerPane', interactive: false, keyboard: false, zIndexOffset: 1300, icon: Lf.divIcon({ className: 'crGrLbl', iconSize: null, iconAnchor: [-8, -6], html: `<span class="gl${br.ratio > 1 ? ' over' : ''}${s.est ? ' est' : ''}" data-gl="${esc(u.id)}:${it.id}" style="border-left-color:${col}">${esc(lbl)}${br.ratio != null ? ` (${fmt(br.ratio, 2)})` : ''}${s.est ? ' est.' : ''}</span>` }) }));
    });
    layers.set(u.id, out);
  }
  /* ---------- the Ground input tab ---------- */
  const numIn = (id, v, lbl, unit, ph, data) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" inputmode="decimal" id="${id}"${data || ''} value="${v == null ? '' : esc(String(v))}" placeholder="${esc(ph || '')}"><span class="unit">${unit}</span></div>`;
  function drawIn() {
    if (!inEl) return;
    const P = A.P, utils = P.items.filter(i => i.type === 'util'), caps = (P.ground && P.ground.caps) || {};
    inEl.innerHTML = `<div class="sec"><div class="secHead">Ground and supports</div><div class="secBody">
      <p class="note">Float / track loads along every pick's swing (1° steps): the rigid-body method when the crane's weights and CGs are entered on its card (Cranes &amp; setups tab), else the bounding <b>estimate</b> (gross operating weight + counterweight + hook load at the most unfavourable CG). Results on the <a href="#" data-gt="out">Ground tab</a>, the map and the Report.</p>
      <label class="note" style="display:block"><input type="checkbox" id="grMap"${showMap() ? ' checked' : ''}> Show the ground pressures and float loads on the map</label></div></div>
      ${P.setups.length ? P.setups.map(u => setupIn(u)).join('') : '<div class="sec"><div class="secBody"><p class="note">No crane setup yet (Cranes &amp; setups tab).</p></div></div>'}
      <div class="sec"><div class="secHead">Buried utilities, culverts, walls (${utils.length})</div><div class="secBody">
        ${utils.length ? utils.map(it => `<div class="itRow"><span class="itSum" style="flex:1 1 100%">${esc(it.name || M.UTIL_KINDS[it.kind] || 'utility')}: ${isNum(it.depth) ? 'depth to top ' + fmt(it.depth, 2) + ' ft' : isNum(it.topEl) ? 'top el. ' + fmt(it.topEl, 2) + ' ft' : '<span class="warnT">depth not entered (Site items)</span>'}</span></div>
          ${numIn('grCap_' + it.id, caps[it.id], 'Allowable stress increase at its top', 'psf', 'optional: report only', ` data-cap="${esc(it.id)}"`)}`).join('') : '<p class="note">Draw them on the Site items tab (with the depth to top or the top elevation) for the stress-at-depth checks.</p>'}</div></div>`;
  }
  function setupIn(u) {
    const g = u.ground || M.normSetupGround(null), m = g.mat, c = craneOf(u), tr = c && K.planDims(c).kind === 'crawler', id = u.id;
    const qaV = g.qa == null ? '' : g.qaUnit === 'ksf' ? g.qa / 1000 : g.qa;
    return `<div class="sec" id="grU-${esc(id)}"><div class="secHead">${esc(u.name)}</div><div class="secBody" data-gu="${esc(id)}">
      <div class="fRow"><label for="grQa_${id}">Allowable bearing pressure</label><input type="text" inputmode="decimal" id="grQa_${id}" data-f="qa" value="${qaV}" placeholder="from the geotechnical engineer"><select data-f="qaUnit" aria-label="Unit">${['psf', 'ksf'].map(x => `<option${g.qaUnit === x ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="fRow"><label for="grMt_${id}">${tr ? 'Mats under the tracks' : 'Mat / plate under each float'}</label><select id="grMt_${id}" data-f="type">${Object.keys(GR.MAT_TYPES).map(k => `<option value="${k}"${m.type === k ? ' selected' : ''}>${esc(GR.MAT_TYPES[k])}</option>`).join('')}</select></div>
      ${m.type === 'none' ? '' : `${numIn('grB_' + id, m.B, tr ? 'Mat length across the track' : 'Mat size B (along the carrier)', 'ft', '', ' data-f="B"')}${tr ? numIn('grW_' + id, m.w, 'Each mat\'s width along the track', 'ft', 'drawing only', ' data-f="w"') + numIn('grN_' + id, m.n, 'Mats per track', '', 'drawing only', ' data-f="n"') : numIn('grL_' + id, m.L, 'Mat size L (across the carrier)', 'ft', '', ' data-f="L"')}${numIn('grT_' + id, m.t, 'Thickness', 'in', '', ' data-f="t"')}
        ${m.type === 'timber' ? numIn('grFb_' + id, m.Fb, 'F<sub>b</sub>\' (adjusted)', 'psi', 'species / grade × factors', ' data-f="Fb"') + numIn('grFv_' + id, m.Fv, 'F<sub>v</sub>\' (adjusted)', 'psi', '', ' data-f="Fv"') + numIn('grE_' + id, m.E, 'E', 'psi', 'deflection (information)', ' data-f="E"')
          : numIn('grFy_' + id, m.Fy, 'F<sub>y</sub>', 'ksi', '', ' data-f="Fy"')}
        ${numIn('grG_' + id, m.gamma, 'Unit weight', 'pcf', `${GR.DEF.gamma[m.type]} (assumed)`, ' data-f="gamma"')}${numIn('grK_' + id, m.k, 'Load spread (horizontal : 1)', '', '1 (45°, assumed)', ' data-f="k"')}
        <p class="note">Effective bearing area: the load spreads from the ${tr ? 'shoe' : 'float'} edge at k : 1 through the mat, limited by the mat (Decision pending engineer review). The mat is checked as a cantilever beyond the ${tr ? 'shoe' : 'float'}.</p>`}
    </div></div>`;
  }
  function onInChange(e) {
    const t = e.target;
    if (t.id === 'grMap') { A.ui.grMap = t.checked; A.saveUi(); renderAll(); return; }
    const num = () => { if (t.value.trim() === '') return null; const v = G.parseNum(t.value); if (!isFinite(v) || v < 0) { t.classList.add('bad'); return undefined; } t.classList.remove('bad'); return v; };
    if (t.dataset.cap) { const v = num(); if (v === undefined) return; A.update(P => { P.ground = P.ground || { caps: {} }; P.ground.caps = Object.assign({}, P.ground.caps); if (v) P.ground.caps[t.dataset.cap] = v; else delete P.ground.caps[t.dataset.cap]; }, 'ground'); return; }
    const box = t.closest('[data-gu]'), u = box && setupOf(box.dataset.gu), f = t.dataset.f; if (!u || !f) return;
    let v;
    if (f === 'type' || f === 'qaUnit') v = t.value; else { v = num(); if (v === undefined) return; }
    A.update(() => { const g = M.normSetupGround(u.ground);
      if (f === 'qa') g.qa = v == null ? null : (g.qaUnit === 'ksf' ? v * 1000 : v);
      else if (f === 'qaUnit') g.qaUnit = v;
      else if (f === 'type') g.mat.type = v; else if ((f === 'w' || f === 'n') && v == null) delete g.mat[f]; else g.mat[f] = v;
      u.ground = g; }, 'ground', { id: u.id });
    if (f === 'type' || f === 'qaUnit') drawIn();
  }
  /* ---------- the Ground output tab ---------- */
  function rows() { return A.P.picks.map(k => { const u = setupOf(k.setupId), c = craneOf(u); return { k, u, c, g: u && c ? groundOf(k) : null }; }); }
  const modeChip = g => g.mode === 'rigid' ? '<span class="chip">entered data</span>' : '<span class="chip chipW">estimate — verify with the manufacturer\'s outrigger calculator</span>';
  function supTable(g) {
    const tr = g.S.kind === 'crawler';
    return `<div class="tscroll"><table class="tbl grTbl"><thead><tr><th>${tr ? 'Track' : 'Float'}</th><th>${tr ? 'V<sub>t</sub> (kip)' : 'Load (kip)'}</th>${tr ? '<th>q<sub>max</sub> track (psf)</th>' : ''}<th>Governing slew θ</th><th>R (ft)</th><th>Bearing q<sub>g</sub> (psf / ksf)</th><th>q<sub>g</sub>/q<sub>a</sub></th><th>Mat M/M<sub>a</sub></th><th>Mat V/V<sub>a</sub></th></tr></thead><tbody>
      ${g.max.map((m, i) => { const b = g.bear[i]; return `<tr${m.id === g.gov.id ? ' class="gov"' : ''}><td>${m.id} (${esc(m.name)})</td><td class="n">${fmt(m.load / 1000, 2)}</td>${tr ? `<td class="n">${fmt(m.q, 0)}</td>` : ''}<td class="n">${fmt(m.theta, 0)}°</td><td class="n">${fmt(m.R, 2)}</td><td class="n">${fmt(b.qg, 0)} / ${ksf(b.qg)}</td>
        <td class="n${b.ratio > 1 ? ' ng' : ''}">${b.ratio == null ? '—' : fmt(b.ratio, 2)}</td><td class="n${b.rM > 1 ? ' ng' : ''}">${isNum(b.rM) ? fmt(b.rM, 2) : '—'}</td><td class="n${b.rV > 1 ? ' ng' : ''}">${isNum(b.rV) ? fmt(b.rV, 2) : '—'}</td></tr>`; }).join('')}</tbody></table></div>`;
  }
  function depthTable(g) {
    if (!g.depth.length) return '<p class="note">Stress at depth: no buried utility / culvert / wall drawn (Site items).</p>';
    return `<div class="tscroll"><table class="tbl grDz"><thead><tr><th>Item</th><th>z (ft)</th><th>Δσ<sub>z</sub> (psf)</th><th>at slew θ</th><th>Allowable (psf)</th><th>Ratio</th></tr></thead><tbody>
      ${g.depth.map(d => `<tr><td>${esc(d.name)}</td>${d.none ? `<td colspan="5" class="warnT">${esc(d.none)}</td>` : `<td class="n">${fmt(d.z, 2)}</td><td class="n">${fmt(d.ds, 0)}</td><td class="n">${d.far ? '—' : fmt(d.theta, 0) + '°'}</td><td class="n">${d.cap ? fmt(d.cap, 0) : 'not entered'}</td><td class="n${d.ratio > 1 ? ' ng' : ''}">${d.ratio == null ? '—' : fmt(d.ratio, 2)}</td>`}</tr>`).join('')}</tbody></table></div>`;
  }
  const sx = l => window.CranePickSite.steps(l);
  function stepsHtml(g) {
    return `<div class="note"><b>Governing support (${esc(g.gov.name)})</b></div>${sx(g.steps)}`
      + g.max.map((m, i) => g.bear[i].steps.length ? `<div class="note"><b>${esc(m.name)}: bearing${g.mat.type !== 'none' ? ' and mat' : ''}</b></div>${sx(g.bear[i].steps)}` : '').join('')
      + g.depth.filter(d => d.steps).map(d => `<div class="note"><b>Stress at depth: ${esc(d.name)}</b></div>${sx(d.steps)}`).join('');
  }
  function inputsNote(g) {
    const i = g.inp, f = (v, d) => fmt(v, d);
    return g.mode === 'rigid' ? `Weights (lb) / CG (ft): carrier ${f(i.Wc, 0)} @ ${f(i.xc, 2)}, upperworks ${f(i.Wu, 0)} @ ${f(i.xu, 2)}, counterweight ${f(i.Wcw, 0)} @ −${f(i.rcw, 2)} (${esc(i.from.rcw)}), boom ${f(i.Wb, 0)} at e + ${f(i.fb, 2)}(R − e), e = ${f(i.e, 2)}; hook W ${f(g.W, 0)}.`
      : `Estimate: gross operating weight G ${f(i.G, 0)} lb (${esc(i.from.G)}), counterweight ${f(i.Wcw, 0)} lb (${esc(i.from.Wcw)}), hook W ${f(g.W, 0)} lb; missing for the rigid-body method: ${esc(i.missing.join(', '))}.`;
  }
  function drawOut() {
    if (!outEl) return; dirty = false;
    const R = rows();
    if (!R.length) { outEl.innerHTML = '<div class="sec"><div class="secHead">Ground</div><div class="secBody"><p class="note">No pick yet: add a crane setup (Cranes &amp; setups tab: "Add setup"), then a single pick (Lifts tab: "Add single pick").</p></div></div>'; return; }
    outEl.innerHTML = `<div class="sec"><div class="secHead">Ground and supports (${R.length} pick${R.length === 1 ? '' : 's'})</div><div class="secBody">
      <p class="note">Per pick, the largest load on each float / track along the swing (every 1°), its governing slew angle, the bearing pressure under it (with the mat when one is entered) against the allowable, the mat checks and the vertical stress increase at the buried items. <a href="#" data-gt="rpt">Report §Ground</a></p></div></div>
      ${R.map(({ k, u, g }) => `<div class="sec grPick" id="gr-${esc(k.id)}"><div class="secHead">${esc(k.name)} · ${esc(u ? u.name : '?')}</div><div class="secBody">
        ${!g ? '<p class="warnT">The setup or its crane is missing.</p>' : g.mode === 'none' ? `<p class="note warnT">Ground loads not computed: ${esc(g.why)}.</p>` : `${modeChip(g)} <span class="note">${inputsNote(g)}</span>
        ${supTable(g)}${g.qa ? `<p class="note">Allowable bearing pressure q<sub>a</sub> = ${fmt(g.qa, 0)} psf (${ksf(g.qa)} ksf). Mat: ${esc(GR.MAT_TYPES[g.mat.type])}.</p>` : '<p class="note warnT">No allowable bearing pressure entered (Ground input tab).</p>'}
        ${depthTable(g)}${g.flags.filter(f => f.level !== 'info').length ? `<ul class="lfFlags">${g.flags.filter(f => f.level !== 'info').map(f => `<li class="lf-${f.level}">${esc(f.text)}</li>`).join('')}</ul>` : ''}
        <details class="crSteps" data-gs="${esc(k.id)}"${stepsOpen.has(k.id) ? ' open' : ''}><summary>Worked steps</summary>${stepsHtml(g)}</details>`}</div></div>`).join('')}`;
  }
  /* ---------- Report ---------- */
  const BASIS = [
    ['Loads on the supports (entered data)', 'rigid-body statics: V = ΣW, resultant (X, Y) = ΣW·(x, y)/V from the carrier, upperworks, counterweight (opposite the boom at r_cw), boom (at e + f_b(R − e)) and hook load (at R); four floats on a rigid rectangle: P = V/4·(1 ± u ± v), u = (X − x̄)/a, v = Y/b; when |u| + |v| > 1 the diagonally opposite float lifts and three floats carry V (statics). Plane-of-loads method, standard statics; see CIRIA C703 (2003) "Crane stability on site" for outrigger loads (paraphrase).'],
    ['Crawler tracks', 'lateral split V(1/2 ± Y/g) about the track centre lines; along each track at e = X: linear q = V_t/(sL_t)(1 ± 6e/L_t) inside the kern (|e| ≤ L_t/6), triangular q_max = 2V_t/(sL_b), L_b = 3(L_t/2 − |e|) outside it.'],
    ['Estimate (weights / CGs not entered)', 'V = G + W_cw + W with the crane-without-load CG anywhere in the float rectangle (crawlers: within 70 % of the half track length and half gauge), the resultant in (W·h + (V − W)·box)/V ∩ the supports; the most unfavourable value of each float / track over it. It bounds the rigid-body method (tested over 8,000 random cases). Decision pending engineer review. Verify with the manufacturer\'s outrigger calculator.'],
    ['Swing', 'every degree of the swing path (as §Lifts); the largest value of each support and its slew angle.'],
    ['Mats', 'float as the equal-area square a = f√π/2; spread k : 1 (default 1 : 1) from its edge, limited by the mat: B_e, L_e; q = P/A_e, q_g = q + γt; cantilever c beyond the float face: M = qc²/2, V = qc per foot; timber: M_a = F_b\'t²/6, V_a = 2F_v\'t/3 (NDS, adjusted values entered); steel plate: M_a = F_y t²/(4·1.67), V_a = 0.60F_y t/1.50 (AISC 360-16 F11.1, J4.2(a), ASD).'],
    ['Stress at depth', 'Boussinesq, uniform rectangle by corner superposition (Newmark; FHWA GEC 6 (2002) §5.3.2, Fig. 5-11), linear / triangular track pressures integrated (shared/boussinesq.js); summed over the supports at the governing slew angles and at the pick and the set.']];
  window.CranePickReport && window.CranePickReport.add(P => {
    const R = rows().filter(r => r.g); if (!R.length) return [];
    const subs = [{ id: 'basis', key: 'ground-basis', title: 'Basis', items: [{ type: 'kv', rows: BASIS }] },
      { id: 'sum', key: 'ground-summary', title: 'Summary', items: [{ type: 'table', wide: true, head: ['Pick', 'Method', 'Governing support', 'Load (kip)', 'Slew θ', 'q_g (psf)', 'q_g / q_a', 'Mat (M, V ratios)', 'Stress at depth (max ratio)'],
        rows: R.map(({ k, g }) => { if (g.mode === 'none') return [{ t: k.name, key: 'gr-' + k.id }, 'not computed', g.why, '', '', '', '', '', '']; const i = g.gov.i, b = g.bear[i], dz = g.depth.filter(d => d.ratio != null);
          return [{ t: k.name, key: 'gr-' + k.id }, g.mode === 'rigid' ? 'entered data' : 'estimate', g.gov.name, { t: fmt(g.gov.load / 1000, 2), n: true }, { t: fmt(g.gov.theta, 0) + '°', n: true }, { t: fmt(b.qg, 0), n: true }, { t: b.ratio == null ? '—' : fmt(b.ratio, 2), n: true, cls: b.ratio > 1 ? 'ng' : 'ok' }, isNum(b.rM) ? `${fmt(b.rM, 2)}, ${fmt(b.rV, 2)}` : '—', dz.length ? fmt(Math.max(...dz.map(d => d.ratio)), 2) : (g.depth.length ? 'no allowable' : '—')]; }) }] }];
    R.forEach(({ k, u, g }) => {
      const items = [];
      if (g.mode === 'none') items.push({ type: 'note', warn: true, text: 'Not computed: ' + g.why + '.' });
      else {
        items.push({ type: 'note', warn: g.mode !== 'rigid', text: (g.mode === 'rigid' ? 'Method: rigid body, entered data. ' : 'Method: ESTIMATE — verify with the manufacturer\'s outrigger calculator. ') + inputsNote(g).replace(/<[^>]+>/g, '') + ` Lift results: [[pick-${k.id}]].` });
        items.push({ type: 'table', head: [g.S.kind === 'crawler' ? 'Track' : 'Float', 'Load (kip)', g.S.kind === 'crawler' ? 'q_max track (psf)' : 'q_max', 'Slew θ', 'R (ft)', 'q_g (psf)', 'q_g / q_a', 'M/M_a', 'V/V_a'],
          rows: g.max.map((m, i) => { const b = g.bear[i]; return [m.id + ' (' + m.name + ')', { t: fmt(m.load / 1000, 2), n: true }, { t: m.q == null ? '—' : fmt(m.q, 0), n: true }, { t: fmt(m.theta, 0) + '°', n: true }, { t: fmt(m.R, 2), n: true }, { t: fmt(b.qg, 0), n: true }, { t: b.ratio == null ? '—' : fmt(b.ratio, 2), n: true, cls: b.ratio > 1 ? 'ng' : '' }, { t: isNum(b.rM) ? fmt(b.rM, 2) : '—', n: true }, { t: isNum(b.rV) ? fmt(b.rV, 2) : '—', n: true }]; }) });
        items.push({ type: 'kv', rows: [['Allowable bearing pressure', g.qa ? `${fmt(g.qa, 0)} psf (${ksf(g.qa)} ksf)` : 'not entered'], ['Mat', GR.MAT_TYPES[g.mat.type] + (g.mat.type !== 'none' ? `: ${fmt(g.mat.B, 2)}${g.S.kind === 'crawler' ? '' : ' × ' + fmt(g.mat.L, 2)} ft, ${fmt(g.mat.t, 2)} in, spread ${fmt(g.mat.k, 2)} : 1` : '')]] });
        if (g.depth.length) items.push({ type: 'table', head: ['Item', 'z (ft)', 'Δσ_z (psf)', 'Slew θ', 'Allowable (psf)', 'Ratio'], rows: g.depth.map(d => d.none ? [d.name, d.none, '', '', '', ''] : [d.name, { t: fmt(d.z, 2), n: true }, { t: fmt(d.ds, 0), n: true }, d.far ? '—' : fmt(d.theta, 0) + '°', d.cap ? fmt(d.cap, 0) : 'not entered', { t: d.ratio == null ? '—' : fmt(d.ratio, 2), n: true, cls: d.ratio > 1 ? 'ng' : '' }]) });
        const fl = g.flags.filter(f => f.level !== 'info'); if (fl.length) items.push({ type: 'note', warn: true, text: fl.map(f => f.text).join(' ') });
        const sc = 'gr-' + k.id;
        items.push({ type: 'steps', scope: sc, title: `Governing support: ${g.gov.name}`, steps: g.steps });
        g.max.forEach((m, i) => { if (g.bear[i].steps.length) items.push({ type: 'steps', scope: sc, title: `${m.name}: bearing${g.mat.type !== 'none' ? ' and mat' : ''}`, steps: g.bear[i].steps }); });
        g.depth.filter(d => d.steps).forEach(d => items.push({ type: 'steps', scope: sc, title: 'Stress at depth: ' + d.name, steps: d.steps }));
      }
      subs.push({ id: 'g-' + k.id, key: 'gr-' + k.id, title: `${k.name} (${u.name})`, ref: g.mode === 'none' ? '' : (g.mode === 'rigid' ? 'entered data' : 'estimate'), items });
    });
    return [{ id: 'ground', key: 'ground', title: 'Ground', subs }];
  });
  function gotoReport(id) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump(id ? 'gr-' + id : 'ground'); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  /* ---------- wiring ---------- */
  function onClick(e) { const a = e.target.closest('[data-gt]'); if (!a) return; e.preventDefault(); if (a.dataset.gt === 'out') A.showOTab('ground'); else gotoReport(); }
  A.inTab({ id: 'ground', label: 'Ground', build: p => { inEl = p; p.addEventListener('change', onInChange); p.addEventListener('click', onClick); }, show: drawIn });
  A.outTab({ id: 'ground', label: 'Ground', before: 'site', build: p => { outEl = p; p.addEventListener('click', onClick); p.addEventListener('toggle', e => { const d = e.target; if (d.dataset && d.dataset.gs) { if (d.open) stepsOpen.add(d.dataset.gs); else stepsOpen.delete(d.dataset.gs); } }, true); }, show: () => { if (dirty) drawOut(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'ground') drawOut(); };
  A.on('project', () => { mark(); renderAll(); if (A.ui.itab === 'ground') drawIn(); });
  A.on('change', o => { if (o.kind === 'select' || o.kind === 'select-lift') return; mark(); setTimeout(renderAll, 0); if (A.ui.itab === 'ground' && o.kind !== 'ground') drawIn(); });
  A.on('live', o => { if (!o || (o.kind !== 'lifts' && o.kind !== 'items')) return; dirty = true; A.P.setups.forEach(u => { if (o.kind === 'items' || !o.id || u.id === o.id || A.P.picks.some(k => k.id === o.id && k.setupId === u.id)) renderSetup(u); }); });
  A.on('tab', id => { if (id === 'plan') setTimeout(renderAll, 0); });
  window.CranePickGroundUI = { renderAll, redraw: mark, gotoReport, groundOf, setupSum, supTable, depthTable, stepsHtml, modeChip, inputsNote, BASIS, get layers() { return layers; } };   // C5: the tables / steps reused by ui/tandem.js
})();
