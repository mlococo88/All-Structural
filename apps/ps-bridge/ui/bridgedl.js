/* apps/ps-bridge/ui/bridgedl.js — the Cross-section tab's card "Barriers, sidewalks and wearing surface (DC2, DW to each girder)" and the
   Loads & LLDF tab's table of every line (window.PSBBridgeDLUI). Classic script; display and input only. Created 2026-11-13 (PR 3a-3, PS-9).
   The inputs are P.xs.dl (engine/bridge-dl.js); every number in the line table is dead()'s (PSBBridgeDL.distribute), worked in its steps
   (ids dl.*, on the Loads & LLDF tab and in the Report).
     card(P)               the input card (the mode, the method, the barriers, the sidewalks, the wearing surface, the added line loads)
     lineTable(P, g)       the table of DC2 and DW of every girder line (the line g shown marked), with the step links
     onChange(el, P) / onClick(e, P)  → true when handled (the page then saves and redraws) */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const DL = () => window.PSBBridgeDL;
  const get = (o, p) => p.split('.').reduce((q, k) => q == null ? q : q[k], o);
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : '—';
  const box = (id, title, ref, body) => `<section class="sec" id="card-${id}"><div class="secHead">${title}${ref ? ` <span class="secRef">${esc(ref)}</span>` : ''}</div><div class="secBody">${body}</div></section>`;
  const num = (P, path, label, unit, tip) => { const v = get(P, path); return `<div class="fRow"><label for="i_${path}" title="${esc(tip || '')}">${label}</label><input type="number" step="any" id="i_${path}" data-path="${path}" data-dl="num" value="${esc(v == null || (typeof v === 'number' && isNaN(v)) ? '' : v)}" title="${esc(tip || '')}"><span class="unit">${unit}</span></div>`; };
  const sel = (P, path, label, opts, tip) => `<div class="fRow"><label for="i_${path}" title="${esc(tip || '')}">${label}</label><select id="i_${path}" data-path="${path}" data-dl="sel" title="${esc(tip || '')}">${opts.map(([v, t]) => `<option value="${esc(v)}"${String(get(P, path)) === String(v) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
  /* PR 9: optional inputs (blank = none / computed) and the steel app's input groups (apps/steel-bridge/ui/loads.js parts(): Deck edges,
     Sidewalks and median, Wearing surface, Utilities and other line loads, Distribution) */
  const opt = (P, path, label, unit, ph, tip) => { const v = get(P, path); return `<div class="fRow"><label for="i_${path}" title="${esc(tip || '')}">${label}</label><input type="number" step="any" id="i_${path}" data-path="${path}" data-dl="opt" value="${esc(v == null || (typeof v === 'number' && isNaN(v)) ? '' : v)}" placeholder="${esc(ph || '')}" title="${esc(tip || '')}"><span class="unit">${unit}</span></div>`; };
  const sub = t => `<div class="dlSub" style="font-weight:600;margin:10px 0 4px">${t}</div>`;
  /* SWGRP (2026-11-24, engineer: "separate the left and right sidewalk … Same with the deck edges"; display only): each side under its own
     sub-heading, the labels without the side; the side stays in the label as hidden text (screen readers, the input-check banner). Same
     ids, paths and kinds. */
  const sdh = t => `<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">${t}: </span>`;
  const XD = [['auto', 'Follows the method'], ['pilecap', 'MassDOT pile-cap'], ['equal', 'Equal (all beams)'], ['two', 'Two adjacent beams']];
  // PL-A: UT, a utility line load (DW, 3.5.1) on the composite section. UT-N (2026-11-23): its label names the section, and the Steel Bridge
  // app's two noncomposite categories: UTN (the steel app's UT) and UF (stored codes; the labels are the steel app's)
  const XC = [['DC2', 'DC2'], ['DW', 'DW'], ['DC1', 'DC1'], ['UT', 'Utility (composite, DW)'], ['UTN', 'Utility (noncomposite, DW factors)'], ['UF', 'Future utility allowance (noncomposite, γ 1.25/0)']];
  const catN = L => (L.cat0 ? DL().CATN[L.cat0] : L.cat);
  /* BARG (2026-11-24; engineer: "RIDOT has a barrier that is a rectangle shape … Can I enter the barrier geometry … and let the app
     calculate the weight directly?"; "Use the centroid for the barrier load point. Do this for both the steel and ps apps."): per deck edge
     "Barrier weight from": Entered (absent: the typed weight and width, as before) or Geometry (bMode 'geom': bShape, bDims { b, h, bt } in,
     bPts [[x, y]] in, bGam kcf; shared/barrier.js, the Steel Bridge app's keys). With Geometry the width at the deck, the weight and the
     centroid are shown read-only, worked here and on the Loads & LLDF tab (step dl.load.bar<L|R>), and written into w and bw as well (the
     drawings, the 3D view, the sheets and the hand-offs read them); engine/bridge-dl.js computes them again from the shape. */
  const BMODES = [['entered', 'Entered'], ['geom', 'Geometry']];
  function barrierRows(P, s, k, b, x) {
    const B = window.SharedBarrier, geo = b.bMode === 'geom' && B;
    const mode = `<div class="fRow"><label for="i_${k}bMode">${x}Barrier weight from</label><select id="i_${k}bMode" data-path="${k}bMode" data-dl="bgeo">${BMODES.map(([v, t]) => `<option value="${v}"${(geo ? 'geom' : 'entered') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`;
    if (!geo) return (B ? mode : '') + num(P, k + 'w', `${x}Barrier weight`, 'klf', 'DC2 line load at half the barrier width from the deck edge') + num(P, k + 'bw', `${x}Barrier width (deck edge to traffic face)`, 'ft', 'Also the start of the wearing surface');
    const sp = B.spec(b), G = B.compute(sp), v = p => { const y = get(P, k + p); return y == null || (typeof y === 'number' && !isFinite(y)) ? '' : y; };
    const gnum = (p, label, unit, ph) => `<div class="fRow"><label for="i_${k}${p}">${x}${label}</label><input type="number" step="any" id="i_${k}${p}" data-path="${k}${p}" data-dl="bgeo" value="${esc(v(p))}"${ph ? ` placeholder="${esc(ph)}"` : ''}><span class="unit">${unit}</span></div>`;
    const ro = (label, val, unit) => `<div class="fRow"><label>${x}${label}</label><input type="text" readonly tabindex="-1" value="${esc(val)}" style="background:#f1f5f9;color:#475569" title="Computed from the barrier geometry"><span class="unit">${unit}</span></div>`;
    let o = mode + `<div class="fRow"><label for="i_${k}bShape">${x}Barrier shape</label><select id="i_${k}bShape" data-path="${k}bShape" data-dl="bgeo">${B.SHAPES.map(([vv, t]) => `<option value="${vv}"${sp.shape === vv ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
    if (sp.shape === 'poly') o += `<div class="fRow"><label for="i_${k}bPts">${x}Points x, y (in)</label><input type="text" id="i_${k}bPts" data-path="${k}bPts" data-dl="bgeo" value="${esc(B.ptsText(b.bPts))}" style="width:220px" placeholder="0, 0; 12, 0; 12, 42; 0, 42"></div>
      <p class="note">In order around the outline, separated by semicolons: x from the deck edge (toward the roadway), y up from the top of the deck; at least 3 points, an edge on the deck (y = 0), not crossing itself.</p>`;
    else o += gnum('bDims.b', sp.shape === 'slope' ? 'Base width b (on the deck)' : 'Barrier width b', 'in') + (sp.shape === 'slope' ? gnum('bDims.bt', 'Top width b<sub>t</sub>', 'in') : '') + gnum('bDims.h', 'Barrier height h', 'in');
    o += gnum('bGam', 'Unit weight γ', 'kcf', `blank = ${B.GAMMA.toFixed(3)}`);
    if (!G.ok) return o + `<div class="alert">${G.errors.map(e => esc(e.msg.charAt(0).toUpperCase() + e.msg.slice(1)) + '.').join(' ')}</div>`;
    const S = window.SharedSteps, st = B.steps(G, { prefix: 'xs', base: 'bar' + s, wLabel: 'Barrier weight per foot' });
    return o + ro('Barrier weight', fx(G.w, 4), 'klf') + ro('Barrier width at deck (traffic face)', fx(G.bDeck, 3), 'ft') + ro('Centroid x̄ (load point)', fx(G.xc, 3), 'ft')
      + `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start"><div>${B.svg(G, { w: 170, side: s })}</div><ul class="steps" style="flex:1 1 260px;min-width:0">${st.map(t => `<li><div class="lbl">${esc(t.label)}${t.ref ? `<span class="ref">${esc(t.ref)}</span>` : ''}</div><div>${S ? S.line(t, true) : ''}</div>${t.note ? `<div class="nt">${esc(t.note)}</div>` : ''}</li>`).join('')}</ul></div>
      <p class="note">Computed from the geometry (read-only); the DC2 line load acts at the centroid x̄ from the deck edge. Worked with the other line loads on the <a href="#st-dl.load.bar${s}" data-gotab="lds">Loads &amp; LLDF tab §</a> (step dl.load.bar${s}).</p>`;
  }
  /* barrierChange(P, s, key, el): an input of the barrier geometry (BARG); true = handled */
  function barrierChange(P, s, key, el) {
    const B = window.SharedBarrier, q = P.xs.dl, e = q['bar' + s] = q['bar' + s] || {}, v = el.value, nv = () => (v.trim() === '' ? null : Number(v));
    if (key === 'bMode') { e.bMode = v === 'geom' ? 'geom' : 'entered';
      if (e.bMode === 'geom') { if (!e.bShape) e.bShape = 'rect'; if (!e.bDims) e.bDims = { b: +e.bw > 0 ? Math.round(+e.bw * 12 * 1e4) / 1e4 : null, h: null }; if (e.bGam == null) e.bGam = B ? B.GAMMA : 0.15; } }
    else if (key === 'bShape') { const prev = B ? B.outline(B.spec(e)) : null; e.bShape = ['rect', 'slope', 'poly'].includes(v) ? v : 'rect'; e.bDims = e.bDims || { b: null, h: null };
      if (e.bShape === 'slope' && e.bDims.bt == null) e.bDims.bt = e.bDims.b;
      if (e.bShape === 'poly' && !(Array.isArray(e.bPts) && e.bPts.length) && prev && prev.length >= 3 && prev.every(p => isFinite(p[0]) && isFinite(p[1]))) e.bPts = prev.map(p => [p[0], p[1]]); }
    else if (key === 'bPts') e.bPts = B ? B.parsePts(v) : [];
    else if (key === 'bGam') e.bGam = nv();
    else { e.bDims = e.bDims || {}; e.bDims[key.slice(6)] = nv(); }
    if (e.bMode === 'geom' && B) { const G = B.compute(B.spec(e)); if (G.ok) { e.bw = G.bDeck; e.w = G.w; } }   // the computed values in the two fields (figures, sheets, hand-offs)
    return true;
  }
  function card(P) {
    const q = (P.xs && P.xs.dl) || {}, on = DL().on(P);
    let h = `<div class="fRow"><label for="i_xs.dl.mode" title="Distributed: DC2 and DW of each girder line from the loads below (the Steel Bridge app's method). Entered: the values entered per girder type on the Loads tab (the old app's way).">DC2 and DW per girder</label><select id="i_xs.dl.mode" data-path="xs.dl.mode" data-dl="mode">
      <option value="distributed"${on ? ' selected' : ''}>Distributed to each girder line (below)</option><option value="entered"${on ? '' : ' selected'}>Entered per girder type (Loads tab)</option></select></div>`;
    if (!on) return box('dl', 'Barriers, sidewalks and wearing surface (DC2, DW)', 'AASHTO LRFD 10th Ed. 3.5.1, 4.6.2.2.1', h + '<p class="note">DC2 and DW are the values entered per girder type on the <a href="#" data-goin="loads">Loads tab</a> (as the old app). "Distributed" computes them for each girder line from the barriers, sidewalks and wearing surface (the Steel Bridge app\'s method, PS-9).</p>');
    h += sel(P, 'xs.dl.method', 'Distribution method', Object.entries(DL().METHODS), 'How the barrier, sidewalk and added DC2 loads go to the girders; the wearing surface always equally (the Steel Bridge app).');
    // PR 9: deck edges (the steel app's "Deck edges": a barrier, or a curb and railing; an entered edge to traffic face governs)
    ['L', 'R'].forEach(s => { const side = s === 'L' ? 'Left' : 'Right', b = q['bar' + s] || {}, k = `xs.dl.bar${s}.`, F = DL().edgeFace(P, s), x = sdh(`${side} deck edge`);
      h += sub(`${side} deck edge`);
      h += sel(P, k + 'type', `${x}Edge type`, [['barrier', 'Barrier'], ['curb', 'Curb and railing']], 'A curb lower than 12 in is mountable (the railing face is the traffic face)').replace(`data-path="${k}type" data-dl="sel"`, `data-path="${k}type" data-dl="type"`);
      if (b.type === 'curb') h += num(P, k + 'cw', `${x}Curb width`, 'in', 'DC2 line load c_w/12 × c_h/12 × w_c at c_w/2 from the deck edge') + num(P, k + 'ch', `${x}Curb height`, 'in', '') + num(P, k + 'rw', `${x}Railing weight`, 'klf', 'DC2 line load at its load point') + num(P, k + 'rp', `${x}Railing load point from edge`, 'ft', '') + opt(P, k + 'rf', `${x}Railing traffic face from edge`, 'ft', 'blank = load point');
      else h += barrierRows(P, s, k, b, x);   // BARG: "Barrier weight from" Entered (the two fields, as before) / Geometry
      h += opt(P, k + 'face', `${x}Edge to traffic face`, 'ft', 'optional', 'Blank: computed from the barrier or curb and railing');
      if (F && (b.type === 'curb' || b.face != null && b.face !== '' && !(typeof b.face === 'number' && isNaN(b.face)))) h += `<p class="note">${side} traffic face ${fx(F.f, 3)} ft from the deck edge (${esc(F.by)}).</p>`; });
    // PR 9: sidewalks and median (the steel app's "Sidewalks and median"). PL-A (2026-11-23): + the pedestrian live load (3.6.1.6)
    ['L', 'R'].forEach(s => { const side = s === 'L' ? 'Left' : 'Right', k = `xs.dl.sw${s}.`, on2 = +((q['sw' + s] || {}).w) > 0, x = sdh(`${side} sidewalk`);
      h += sub(`${side} sidewalk`) + num(P, k + 'w', `${x}Width`, 'ft', 'Sidewalk slab from the deck edge (DC2, deck concrete for loads); 0 = none') + (on2 ? num(P, k + 't', `${x}Thickness`, 'in', '') + opt(P, k + 'fence', `${x}Railing / fence`, 'klf', 'none') + opt(P, k + 'fenceX', `${x}Fence from deck edge`, 'ft', 'none') : ''); });
    h += sub('Pedestrian load and median');
    h += opt(P, 'xs.dl.ped', 'Pedestrian live load PL', 'psf', '0 = none; 75 (3.6.1.6)', 'AASHTO LRFD 10th Ed. 3.6.1.6: 75 psf on sidewalks wider than 2.0 ft, with the vehicular live load. On the walkable width (sidewalk − the deck edge\'s barrier or curb), distributed to the girder lines by the distribution method (the Steel Bridge app). Blank or 0: none.');
    { const sws = ['L', 'R'].filter(s => +((q['sw' + s] || {}).w) > 0), pq = DL().pl(P), pedOn = +q.ped > 0;   // PL-A: what the pedestrian load does here
      if (sws.length && !pedOn) h += '<p class="note" id="plOff"><b>No pedestrian live load is applied</b> to the sidewalk' + (sws.length > 1 ? 's' : '') + ': enter 75 psf (AASHTO LRFD 10th Ed. 3.6.1.6) to add it to the live load of the girder design.</p>';
      else if (pedOn && pq) h += `<p class="note" id="plOn">Pedestrian live load ${fx(pq.q, 1)} psf (3.6.1.6): ${pq.per.length ? pq.per.map(L => `${esc(L.desc.replace(' pedestrian LL', '').toLowerCase())} sidewalk ${fx(L.def.w, 2)} ft walkable × ${fx(pq.q / 1000, 3)} ksf = ${fx(L.plf, 4)} klf`).join('; ') + ', to the girder lines by the distribution method (table below), added to LL+IM in Strength I and Service I / III and the rating; not in fatigue or the live-load deflection. Worked on the Loads &amp; LLDF tab.' : 'no sidewalk wider than 2.0 ft: none applied.'}${pq.narrow.length ? ` ${pq.narrow.map(s => s === 'L' ? 'Left' : 'Right').join(' and ')} sidewalk 2.0 ft or narrower: no pedestrian load (3.6.1.6).` : ''}</p>`;
      else if (pedOn) h += '<p class="note">Pedestrian live load: applied to a sidewalk wider than 2.0 ft (none entered).</p>'; }
    { const DM = window.PSBDemands, BR = window.PSBBridge;   // IMP-N (2026-11-23): girder types on imported demands: PL and a composite utility are not added to them
      const ts = DM && DM.assumedOf && BR ? BR.types(P).map(T => ({ T, a: DM.assumedOf(P, T) })).filter(z => z.a) : [];
      if (ts.length) h += `<div class="alert" id="impAssume" role="status"><b>Imported demands (${ts.map(z => esc(z.T.label)).join(', ')}):</b> ${esc(ts[0].a.text)} Demand source: <a href="#" data-goin="loads">Loads tab, Demands card</a>.</div>`; }
    h += num(P, 'xs.dl.med.w', 'Raised median width', 'ft', 'At the deck centre (DC2); 0 = none');
    if (+((q.med || {}).w) > 0) h += num(P, 'xs.dl.med.t', 'Median thickness', 'in', '') + `<div class="fRow"><label for="i_xs.dl.med.joint">Longitudinal joint at the median</label><select id="i_xs.dl.med.joint" data-path="xs.dl.med.joint" data-dl="bool"><option value="false"${(q.med || {}).joint ? '' : ' selected'}>No</option><option value="true"${(q.med || {}).joint ? ' selected' : ''}>Yes</option></select></div>`;
    h += opt(P, 'xs.dl.wcA', 'Curb / sidewalk / median concrete', 'kcf', 'blank = w_c');
    h += '<p class="note">A sidewalk thinner than 12 in is mountable and does not move the live-load traffic face (d<sub>e</sub>).</p>';
    // PR 9: wearing surface and overlays (DW, between the traffic faces, equally)
    h += sub('Wearing surface');
    h += sel(P, 'xs.dl.wsMode', 'Wearing surface entered as', [['psf', 'Weight (psf)'], ['thk', 'Thickness × unit weight']]);
    h += q.wsMode === 'thk' ? opt(P, 'xs.dl.wsThk', 'Wearing surface thickness', 'in') + opt(P, 'xs.dl.wsGam', 'Wearing surface unit weight', 'kcf')
      : num(P, 'xs.dl.fws', 'Future wearing surface (DW)', 'psf', 'Between the traffic faces (barrier or sidewalk), distributed equally to every girder');
    const oc = (path, v) => `<td><input type="number" step="any" data-path="${path}" data-dl="opt" value="${esc(v == null || (typeof v === 'number' && isNaN(v)) ? '' : v)}" style="width:62px" aria-label="${esc(path)}"></td>`;
    const ovl = (q.ovl || []).map((r, i) => `<tr><td><input type="text" data-path="xs.dl.ovl.${i}.name" data-dl="text" value="${esc(r.name || '')}" style="width:110px;text-align:left" aria-label="Overlay ${i + 1}, name"></td>
      <td><select data-path="xs.dl.ovl.${i}.mode" data-dl="sel" aria-label="Overlay ${i + 1}, entered as">${[['psf', 'Weight (psf)'], ['thk', 'Thickness × unit weight']].map(([v, t]) => `<option value="${v}"${(r.mode === 'thk' ? 'thk' : 'psf') === v ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
      ${oc(`xs.dl.ovl.${i}.psf`, r.psf)}${oc(`xs.dl.ovl.${i}.thk`, r.thk)}${oc(`xs.dl.ovl.${i}.gam`, r.gam)}<td><button type="button" data-dlact="delOvl" data-i="${i}" aria-label="Delete overlay ${i + 1}">✕</button></td></tr>`).join('');
    h += `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Overlay</th><th>Entered as</th><th>psf</th><th>t<br><span class="unit">in</span></th><th>γ<br><span class="unit">kcf</span></th><th></th></tr></thead><tbody>${ovl || '<tr><td colspan="6" class="lft note">None.</td></tr>'}</tbody></table></div>
      <button type="button" data-dlact="addOvl">Add overlay</button>`;
    // utilities and other line loads (the steel app's table; categories DC2, DW, DC1; the distribution per row)
    h += sub('Utilities and other line loads');
    const rows = (q.extra || []).map((r, i) => `<tr><td>${i + 1}</td><td><input type="text" data-path="xs.dl.extra.${i}.name" data-dl="text" value="${esc(r.name || '')}" style="width:110px;text-align:left" aria-label="Added line load ${i + 1}, name"></td>
      <td><select data-path="xs.dl.extra.${i}.cat" data-dl="sel" aria-label="Added line load ${i + 1}, category" title="${esc((XC.find(c => c[0] === r.cat) || ['', ''])[1])}">${XC.map(([c, t]) => `<option value="${c}"${r.cat === c ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
      <td><input type="number" step="any" data-path="xs.dl.extra.${i}.x" data-dl="num" value="${esc(r.x)}" aria-label="Added line load ${i + 1}, x"></td><td><input type="number" step="any" data-path="xs.dl.extra.${i}.plf" data-dl="num" value="${esc(r.plf)}" aria-label="Added line load ${i + 1}, w"></td>
      <td><select data-path="xs.dl.extra.${i}.dist" data-dl="sel" aria-label="Added line load ${i + 1}, distribution">${XD.map(([v, t]) => `<option value="${v}"${(r.dist || 'auto') === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>
      <td><button type="button" data-dlact="del" data-i="${i}" aria-label="Delete added line load ${i + 1}">✕</button></td></tr>`).join('');
    h += `<div class="tscroll"><table class="tbl"><thead><tr><th>#</th><th>Added line load</th><th>Category</th><th>x from the left deck edge<br><span class="unit">ft</span></th><th>w<br><span class="unit">klf</span></th><th>Distribution</th><th></th></tr></thead><tbody>${rows || '<tr><td colspan="7" class="lft note">None.</td></tr>'}</tbody></table></div>
      <button type="button" data-dlact="add">Add line load</button><p class="note">DC1 line loads act on the bare girder: each line's share is added to its w<sub>NC</sub> (DC1 additional). Utility (composite, DW): a utility line load, DW (AASHTO LRFD 10th Ed. 3.5.1), added to the line's DW on the composite section. <span id="utnNote">Utility (noncomposite, DW factors): a utility carried by the precast girder alone (hung before the deck acts): on the girder section like DC1, with the DW load factors (Strength I 1.50, 0.65 where it relieves; Service 1.00), in the losses, the camber and the rating. Future utility allowance (noncomposite, γ 1.25/0): a utility that may be installed later: on the girder section, present (1.25, Service 1.00) or absent (0), whichever governs each check; not in the camber. Both as the Steel Bridge app; worked on the Loads &amp; LLDF tab.</span> The pedestrian live load is entered with the sidewalks above.</p>`;
    const R = DL().distribute(P);
    if (R) h += `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Line</th>${R.dc2.map((_, i) => `<th>G${i + 1}</th>`).join('')}</tr></thead><tbody>
      <tr><td class="lft">DC2 (klf)</td>${R.dc2.map(v => `<td>${fx(v, 4)}</td>`).join('')}</tr><tr><td class="lft">DW (klf)</td>${R.dc2.map((_, i) => `<td>${fx(DL().line(P, i + 1).DW, 4)}</td>`).join('')}</tr>${R.ped && !R.ped.none ? `<tr id="plRow"><td class="lft">PL pedestrian (klf)</td>${R.ped.pl.map(v => `<td>${fx(v, 4)}</td>`).join('')}</tr>` : ''}${R.xu && R.xu.hasN ? `<tr id="utnRow"><td class="lft">UT utility, noncomposite (klf)</td>${R.xu.utn.map(v => `<td>${fx(v, 4)}</td>`).join('')}</tr>` : ''}${R.xu && R.xu.hasF ? `<tr id="ufRow"><td class="lft">UF future utility allowance (klf)</td>${R.xu.uf.map(v => `<td>${fx(v, 4)}</td>`).join('')}</tr>` : ''}</tbody></table></div>`;
    return box('dl', 'Barriers, sidewalks and wearing surface (DC2, DW to each girder)', 'AASHTO LRFD 10th Ed. 3.5.1, 4.6.2.2.1; the Steel Bridge app\'s method', h
      + '<p class="note">Each girder line\'s DC2 and DW (the table) are its engine inputs, worked step by step on the Loads &amp; LLDF tab (§ links) and in the Report. The deck slab and haunch (DC1) stay the girder\'s tributary width. The deck design (Diaphragms / deck tab) keeps its own barrier weight and wearing surface.</p>');
  }
  /* stemTable(R, per, g, k): NX-O2 (engineer 2026-11-26): a NEXT bridge distributes each line load to the 2 N_b stems (each stem a stringer,
     MassDOT 3.5.4.2), each beam the sum of its two stems (engine/bridge-dl.js fold): the stems' shares (L.rSt) and totals, the beam shown
     outlined; its beam sums are in the table above and worked as dl.G<g>.* (= stem 1 + stem 2) */
  function stemTable(R, per, g, k) {
    const S = R.stems, N = S.N, inG = i => Math.floor(i / 2) + 1 === g, lab = i => `G${Math.floor(i / 2) + 1}${i % 2 ? 'R' : 'L'}`;
    const head = `<tr><th class="lft">Load (per stem)</th>${S.ub.map((x, i) => `<th${inG(i) ? ' class="tyG"' : ''}>${lab(i)}<br><span class="unit">${fx(x, 2)} ft</span></th>`).join('')}</tr>`;
    const rows = per.filter(L => L.rSt).map(L => `<tr><td class="lft">${esc(L.desc)} (${esc(catN(L))})</td>${L.rSt.map((v, i) => `<td${inG(i) ? ' class="tyG"' : ''}>${fx(v, 4)}</td>`).join('')}</tr>`).join('');
    const tot = (lab_, a) => `<tr><td class="lft"><b>${lab_}</b></td>${a.map((v, i) => `<td${inG(i) ? ' class="tyG"' : ''}><b>${fx(v, 4)}</b></td>`).join('')}</tr>`;
    return `<div class="tscroll" id="nxStemDL"><table class="tbl"><thead>${head}</thead><tbody>${rows}${tot('DC2', S.dc2)}${tot('DW', S.dw)}${R.ped && R.ped.plSt ? tot('PL', R.ped.plSt) : ''}</tbody></table></div>
      <p class="note">NEXT beams, dead loads per stem (NX-O2, engineer 2026-11-26; MassDOT Bridge Manual Part I 3.5.4.2): each of the ${N} stems (L / R of each beam, at the beam line ± ${fx(R.nx.c, 2)} ft) is a stringer of the distribution above (x̄ = ${fx(S.xbar, 3)} ft${R.method === 'massdot' ? `, Σc² = ${fx(S.S2, 2)} ft² over the stems` : ''}); each beam takes the sum of its two stems (the table above, worked as stem 1 + stem 2: G${g} DC2 ${k.wk(`dl.G${g}.DC2`)}). The deck slab (DC1) of a NEXT beam is on its two stems' tributary width ${k.wk('ld.wdeck')}.</p>`;
  }
  function lineTable(P, g, k) {
    const R = DL().distribute(P); if (!R) return '';
    const xu = R.xu, per = R.per.concat(R.ped ? R.ped.per : []), ut = xu ? xu.hasC : R.ut && R.per.some(L => L.cat === 'UT');   // PL-A: + the pedestrian line loads; UT-N: the composite utilities only
    const utc = xu ? xu.utc : R.ut;
    const head = `<tr><th class="lft">Load (category, distribution)</th><th>w (klf)</th>${R.dc2.map((_, i) => `<th${i + 1 === g ? ' class="tyG"' : ''}>G${i + 1}</th>`).join('')}</tr>`;
    const rows = per.map(L => `<tr><td class="lft">${esc(L.desc)} (${esc(catN(L))}, ${esc(DL().DIST[L.dist] || L.dist)})</td><td>${fx(L.plf, 4)} ${k.wk('dl.load.' + L.id)}</td>${L.r.map((v, i) => `<td${i + 1 === g ? ' class="tyG"' : ''}>${fx(v, 4)}</td>`).join('')}</tr>`).join('');
    const tot = (lab, a, id) => `<tr><td class="lft"><b>${lab}</b></td><td></td>${a.map((v, i) => `<td${i + 1 === g ? ' class="tyG"' : ''}><b>${fx(v, 4)}</b>${i + 1 === g ? ' ' + k.wk(`dl.G${g}.${id}`) : ''}</td>`).join('')}</tr>`;
    return k.card(`DC2 and DW distributed to every girder line (${esc(DL().METHODS[P.xs.dl.method] || P.xs.dl.method)})`, `<div class="tscroll"><table class="tbl"><thead>${head}</thead><tbody>${rows}${tot('DC2', R.dc2, 'DC2')}${tot(ut ? 'DW (wearing surface, overlays)' : 'DW', R.dw, 'DW')}${ut ? tot('UT utilities (DW)', utc, 'UT') + tot('DW the design takes (DW + UT)', R.dw.map((v, i) => v + utc[i]), 'DWt') : ''}${xu && xu.hasN ? tot('UT utilities on the noncomposite section (in w<sub>NC</sub>, DW factors)', xu.utn, 'UTN') : ''}${xu && xu.hasF ? tot('UF future utility allowance (in w<sub>NC</sub>, γ 1.25 / 0)', xu.uf, 'UF') : ''}${R.ped && !R.ped.none ? tot('PL pedestrian live load', R.ped.pl, 'PL') : ''}${per.some(L => L.cat === 'DC1') ? tot('DC1 line loads (added to w<sub>NC</sub>)', R.dc2.map((_, i) => per.filter(L => L.cat === 'DC1').reduce((a, L) => a + L.r[i], 0)), 'DC1x') : ''}</tbody></table></div>
      <p class="note">The Steel Bridge app's dead-load distribution (PS-9): each line load from the <a href="#" data-goin="xsec">Cross-section tab</a> to the girders by the method (the wearing surface equally), x̄ = ${fx(R.xbar, 3)} ft from the left deck edge. The girder shown, G${g}, takes DC2 = ${fx(R.dc2[g - 1], 4)} klf and DW = ${fx(DL().line(P, g).DW, 4)} klf as its engine inputs (worked below).${R.ped && !R.ped.none ? ` Pedestrian live load (AASHTO LRFD 10th Ed. 3.6.1.6): w<sub>PL</sub> = ${fx(R.ped.pl[g - 1], 4)} klf on G${g}, distributed as the Steel Bridge app distributes it (the method above; RIDOT: the two adjacent beams), added to LL+IM (card "Pedestrian live load" below).` : ''}${xu && (xu.hasN || xu.hasF) ? ` Noncomposite utilities on G${g}:${xu.hasN ? ` w<sub>UT</sub> = ${fx(xu.utn[g - 1], 4)} klf` : ''}${xu.hasN && xu.hasF ? ',' : ''}${xu.hasF ? ` w<sub>UF</sub> = ${fx(xu.uf[g - 1], 4)} klf` : ''}, distributed as the Steel Bridge app distributes them (the method above; RIDOT: the two adjacent beams), added to w<sub>NC</sub> on the precast girder alone (card "Utilities on the noncomposite section" below).` : ''}</p>${R.stems ? stemTable(R, per, g, k) : ''}`);
  }
  function onChange(el, P) {
    const t = el.dataset.dl; if (!t) return false;
    const path = el.dataset.path;
    { const m = /^xs\.dl\.bar([LR])\.(bMode|bShape|bDims\.(?:b|bt|h)|bPts|bGam)$/.exec(path || ''); if (m && P.xs.dl) return barrierChange(P, m[1], m[2], el); }   // BARG
    if (t === 'type') { const q = P.xs.dl, s = path.split('.')[2]; q[s] = Object.assign({}, q[s], { type: el.value === 'curb' ? 'curb' : 'barrier' }); return true; }   // PR 9: a curb's sizes are entered (blank until then: a blocking input error names them)
    if (t === 'mode') { if (el.value === 'distributed') { if (!P.xs.dl) P.xs.dl = DL().defaults(P); P.xs.dl.mode = 'distributed'; } else if (P.xs.dl) P.xs.dl.mode = 'entered'; return true; }
    const ks = path.split('.'), last = ks.pop(), o = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), P);
    o[last] = t === 'num' ? (el.value.trim() === '' ? NaN : Number(el.value)) : t === 'opt' ? (el.value.trim() === '' ? null : Number(el.value)) : t === 'bool' ? el.value === 'true' : el.value;   // PR 9: opt (blank = null), bool
    return true;
  }
  function onClick(e, P) {
    const b = e.target.closest('[data-dlact]'); if (!b || !P.xs.dl) return false;
    const a = b.dataset.dlact;
    if (a === 'addOvl' || a === 'delOvl') { const O = P.xs.dl.ovl = Array.isArray(P.xs.dl.ovl) ? P.xs.dl.ovl : [];   // PR 9: overlays
      if (a === 'addOvl') O.push({ name: `Overlay ${O.length + 1}`, mode: 'psf', psf: 0, thk: null, gam: null }); else O.splice(+b.dataset.i, 1); return true; }
    const L = P.xs.dl.extra = Array.isArray(P.xs.dl.extra) ? P.xs.dl.extra : [];
    if (b.dataset.dlact === 'add') L.push({ name: `Added load ${L.length + 1}`, cat: 'DC2', x: 0, plf: 0 }); else L.splice(+b.dataset.i, 1);
    return true;
  }
  window.PSBBridgeDLUI = { card, lineTable, onChange, onClick };
})();
