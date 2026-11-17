/* apps/crane-pick/ui/cranetab.js — the Crane output tab (window.CranePickCraneTab). C9 (engineer request 2026-11-17: "a crane output tab that
   has graphics for the crane showing what is being used in the analysis").
   Placed after Summary and before Picks (Plan · Summary · Crane · Picks · Ground …): the crane is what every lift tab below it uses, so it is
   read before the per-lift results; Summary stays the first table after the map.
   A picker (each crane of the project and each setup / configuration using it; a crane not placed: each chart group), the lift and the point
   shown (pick / set / governing; a girder lift: its first step, last step or the crane's governing step) and, for a zoned chart group, the
   zone chart. Live SVG figures from ui/cranefig.js (the engines' own values, each labelled with its source; assumed values amber): plan,
   side elevation, the load chart with the operating points, the weights and CGs of the outrigger / track loads, and the table of every crane
   input with its source and where it is used (links to the worked steps, CLAUDE.md §6). Redrawn on every drag frame while the tab is shown.
   Also: Report §Cranes figures (ui/cranes.js asks reportItems) and a Crane sheet per setup in the Drawings set (ui/drawset.js addSheets).
   The choices are view state in crane.ui (crn: { craneId, setupId, group, lift, at, cfg }; per browser, nothing in the project). */
(function () {
  'use strict';
  const A = window.CranePickApp, esc = A.esc, F = () => window.CranePickCraneFig, MP = () => window.CranePickMap;
  let el = null, dirty = true;
  const ctx = () => ({ evalPick: k => (window.CranePickPlace ? window.CranePickPlace.evalPick(k) : null), evalT: t => (window.CranePickTandemUI ? window.CranePickTandemUI.evalT(t) : null) });
  const st = () => { A.ui.crn = Object.assign({}, A.ui.crn || {}); return A.ui.crn; };
  function gotoReport(key) { A.showOTab('rpt'); const j = () => { const v = window.CranePickReportUI && window.CranePickReportUI.view; if (v && v.jump) v.jump(key); }; setTimeout(j, 60); setTimeout(j, 160); setTimeout(j, 420); }
  const optKey = o => o.craneId + '|' + (o.setupId || '') + '|' + (o.group || '');
  /* the links of a row: where the value is worked / entered */
  function workLinks(r, m) {
    const L = m.L, out = [];
    const pk = L && L.kind === 'pick' ? L : null, tl = L && L.kind === 'tandem' ? L : null;
    if (['Plan', 'Elevation', 'Chart', 'Setup', 'Settings'].includes(r.grp)) { if (pk) out.push(`<a href="#" data-cg="pick" data-id="${esc(pk.id)}">worked: ${esc(pk.name)}</a>`); if (tl) out.push(`<a href="#" data-cg="tandem" data-id="${esc(tl.id)}">worked: ${esc(tl.name)}</a>`); }
    if (['Weights', 'Ground'].includes(r.grp) || (r.grp === 'Plan' && /outrigger|spread|track|gauge/i.test(r.label))) { if (pk) out.push(`<a href="#" data-cg="ground" data-id="${esc(pk.id)}">ground: ${esc(pk.name)}</a>`); if (tl) out.push(`<a href="#" data-cg="tandem" data-id="${esc(tl.id)}">ground: ${esc(tl.name)}</a>`); }
    if (['Plan', 'Elevation', 'Weights', 'Chart', 'Ground'].includes(r.grp)) out.push(`<a href="#" data-cg="cranes">Cranes &amp; setups tab</a>`);
    if (r.grp === 'Setup' || r.id === 'boom' || r.grp === 'Settings') out.push(`<a href="#" data-cg="${r.grp === 'Settings' ? 'lifts' : 'setup'}" data-id="${esc(m.u ? m.u.id : '')}">${r.grp === 'Settings' ? 'Lifts tab (settings)' : 'edit setup (Cranes &amp; setups tab)'}</a>`);
    return out.join(' · ');
  }
  function legend() { return '<p class="note crnLeg">Each value is labelled with its source: <span class="crnS">[file p.x]</span> the crane file (printed page) · <span class="crnS">[chart p.x]</span> the chart configuration · <span class="crnS">[entered]</span> entered in this tool · <span class="crnA">[ASSUMED (default)]</span> / <span class="crnA">not given</span>: guessed by the app, check it · values without a tag are the engine\'s results at the point shown.</p>'; }
  function draw() {
    if (!el || !F()) return; dirty = false;
    const P = A.P, opts = F().options(P);
    if (!opts.length) { el.innerHTML = '<div class="sec"><div class="secHead">Crane</div><div class="secBody"><p class="note">No crane in the project yet: load one and add it on the Cranes &amp; setups tab.</p></div></div>'; return; }
    const s = st(); let o = opts.find(x => optKey(x) === optKey(s)) || opts.find(x => x.used) || opts[0];
    let m; try { m = F().model(P, ctx(), { craneId: o.craneId, setupId: o.setupId, group: o.group, lift: s.lift, at: s.at, cfg: s.cfg }); } catch (e) { console.error(e); el.innerHTML = `<div class="sec"><div class="secBody"><p class="warnT">The crane could not be drawn: ${esc(e.message)}</p></div></div>`; return; }
    if (!m) return;
    const d = m.c, so = d.source || {}, ch = m.chart, rs = F().rows(m), nA = rs.filter(r => r.assumed).length;
    const liftSel = m.lifts.length ? `<label for="crnLift">Lift</label><select id="crnLift">${m.lifts.map(L => `<option value="${esc(L.key)}"${m.L === L ? ' selected' : ''}>${esc(L.name)}</option>`).join('')}</select>
      <label for="crnAt">Point</label><select id="crnAt">${[['pick', m.L && m.L.kind === 'tandem' ? 'first step (pick)' : 'at the pick'], ['set', m.L && m.L.kind === 'tandem' ? 'last step (set)' : 'at the set'], ['gov', 'governing']].map(([k, l]) => `<option value="${k}"${m.at === k ? ' selected' : ''}>${l}</option>`).join('')}</select>` : '<span class="note">no lift uses this setup: the chart and the plan only</span>';
    const zSel = m.zcfgs.length > 1 ? `<label for="crnCfg">Chart</label><select id="crnCfg">${m.zcfgs.map(c => `<option value="${esc(c.id)}"${m.cfg === c ? ' selected' : ''}>${esc(window.CranePickCranes.ZONES[c.zone] || c.zone)}</option>`).join('')}</select>` : '';
    const pt = m.pt, svgP = F().svg(F().plan(m), { w: 620, h: 560 }), ef = F().elev(m), svgE = ef ? F().svg(ef, { w: 640, h: 520 }) : '', cf = F().chart(m), svgC = cf ? F().svg(cf, { w: 680, h: 440 }) : '', wf = F().weights(m), svgW = F().svg(wf, { w: 680, h: 360 });
    const ptLine = pt ? `<p class="note crnPt" id="crnPtLine">${esc(pt.lift.name)}, ${esc(pt.where)}: R = <b>${fmtN(pt.R, 2)} ft</b>, W = <b>${fmtN(pt.W, 0)} lb</b>, C = ${pt.look && pt.look.ok ? fmtN(pt.C, 0) + ' lb' : 'not permitted'}${pt.look && pt.look.ok ? `, <b>${fmtN(pt.pct, 1)} % of chart</b>` : ''}${isFinite(pt.m) && pt.m != null ? `, hook reach margin ${fmtN(pt.m, 2)} ft` : ''}.</p>` : '';
    el.innerHTML = `<div class="sec"><div class="secHead">Crane used in the analysis</div><div class="secBody">
      <div class="crnBar"><label for="crnSel">Crane / setup</label><select id="crnSel">${opts.map(x => `<option value="${esc(optKey(x))}"${x === o ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>${liftSel}${zSel}</div>
      <p class="note"><b>${esc(m.name)}</b>${m.virt ? ' (not placed)' : ` · setup <b>${esc(m.u.name)}</b>`} · ${esc(m.chs.gr ? m.chs.gr.label : 'no chart')} · source: ${esc(so.doc || 'not stated')}, rev. ${esc(so.revision || '—')}, ${esc(so.date || '—')}${d.preliminary ? ' · <span class="crnA">PRELIMINARY document</span>' : ''}${d.app_inputs && d.app_inputs.edited ? ' · <span class="crnA">chart edited in this tool</span>' : ''} · <a href="#" data-cg="cranes">edit on the Cranes &amp; setups tab</a> · <a href="#" data-cg="rpt" data-key="crane-${esc(m.crane.id)}">Report §Cranes</a>${m.virt ? '' : ` · <a href="#" data-cg="dwg" data-sheet="crane-${esc(m.u.id)}">drawing</a>`}</p>
      ${nA ? `<p class="note"><span class="crnA">${nA} value${nA > 1 ? 's' : ''} assumed or not given</span>: highlighted in the figures and the table; enter the crane's own on the Cranes &amp; setups tab.</p>` : ''}
      ${legend()}${ptLine}</div></div>
      <div class="crnGrid">
        <div class="sec"><div class="secHead">1. Plan (crane frame, carrier front up; to scale)</div><div class="secBody crnFig" id="crnPlan">${svgP}
          <p class="note">Carrier / carbody, ${m.pd.kind === 'crawler' ? 'tracks' : 'outrigger beams and floats at the spread the chart uses'}, the rotation centre, the boom-foot pin, the tail-swing circle (dashed), the counterweight CG on the boom line at the point shown, the carrier heading, zone sectors where the chart group has zone charts. Values: engine/lift.js footprint and engine/cranes.js planDims, as the map and the plan clearances use them.</p></div></div>
        <div class="sec"><div class="secHead">2. Side elevation along the boom${pt ? ' (' + esc(pt.where) + ')' : ''}</div><div class="secBody crnFig" id="crnElev">${svgE || '<p class="note">No lift uses this setup: no elevation.</p>'}
          <p class="note">Foot pin, boom at the chart's loaded boom angle where printed (else the geometry), tip, head allowance, hook block, rigging, load, counterweight and tail radius, pad. Values: engine/elev.js (as the Picks tab's heights steps).</p></div></div>
        <div class="sec"><div class="secHead">3. Load chart${ch ? ': ' + esc(ch.cfg.label || ch.cfg.id) : ''}</div><div class="secBody crnFig" id="crnChart">${svgC || '<p class="note">No chart.</p>'}
          ${ch ? `<p class="note" id="crnChartNote">Rating basis: <b>${esc(ch.rb.text)}</b>${ch.rb.from ? '' : ' <span class="crnA">not stated</span>'}. Source: ${esc(ch.source.doc)}, rev. ${esc(ch.source.revision)}, ${esc(ch.source.date)}${ch.source.page != null ? ', chart PDF p. ' + esc([].concat(ch.source.page).join(', ')) : ''}${ch.source.prelim ? ' · <span class="crnA">PRELIMINARY</span>' : ''}${ch.source.edited ? ' · <span class="crnA">edited here</span>' : ''}.
            Squares: the tabulated points; thin steps: each tabulated boom length as the lookup reads it (next larger radius${ch.interp ? '; linear between radii: the notes permit it and the setting is on' : ', no interpolation'}); bold blue step: the boom in use (${ch.use ? fmtN(ch.use.L, 1) + ' ft → column ' + fmtN(ch.use.Ltab, 1) + ' ft' : 'not set'}${ch.use && ch.use.Ltab > ch.use.L + 1e-6 ? ', the lesser of the adjacent lengths where lower' : ''}); dashed: capacity × threshold (${ch.thr.map(t => esc(t.label)).join(', ')}); dots: the operating points (W at R) of every lift on this chart, coloured by status${ch.other.length ? ` (${ch.other.length} point${ch.other.length > 1 ? 's' : ''} rated on another zone chart: choose it above)` : ''}.</p>` : ''}</div></div>
        <div class="sec"><div class="secHead">4. Weights and CGs for the ${m.pd.kind === 'crawler' ? 'track' : 'outrigger'} loads (C4)</div><div class="secBody crnFig" id="crnWts">${wf.none ? `<p class="note"><span class="crnA">${esc(wf.prims[0].s)}</span></p>` : svgW}
          <p class="note">Each weight as an arrow at its CG radius projected on the boom line at the governing slew angle, its value and source (entered, or the bounding estimate); the largest float / track loads along the swing (engine/ground.js, worked on the Ground tab${m.L && m.L.kind === 'pick' ? `: <a href="#" data-cg="ground" data-id="${esc(m.L.id)}">${esc(m.L.name)}</a>` : ''}).</p></div></div>
      </div>
      <div class="sec"><div class="secHead">5. Crane inputs used in the analysis (${rs.length})</div><div class="secBody"><div class="tscroll"><table class="tbl" id="crnTbl"><thead><tr><th>Group</th><th>Input</th><th>Value</th><th>Source</th><th>Used in</th><th>Worked / entered</th></tr></thead><tbody>
        ${rs.map(r => `<tr data-v="${esc(r.id)}"${r.assumed ? ' class="crnRowA"' : ''}><td>${esc(r.grp)}</td><td>${esc(r.label)}</td><td class="n">${esc(r.value)}</td><td>${r.assumed ? `<span class="crnA">${esc(r.src)}</span>` : esc(r.src)}${r.note ? `<br><span class="note">${esc(r.note)}</span>` : ''}</td><td>${esc(r.used.join('; '))}</td><td>${workLinks(r, m)}</td></tr>`).join('')}
      </tbody></table></div></div></div>${dimHtml(m)}`;
  }
  /* 2026-11-17 (engineer: "I need to see exactly where the outriggers sit"): 6. Dimension check (each drawn dimension against the
     manufacturer's value and page: engine/cranegfx.js dimCheck) and 7. support locations (float centres / track ends: local x / y and
     State Plane, cranegfx floatTable), with the stake-out CSV. A project copy of a crane without the manufacturer geometry block, while the
     library copy has one, is flagged (Cranes & setups tab: "Use the library copy"). */
  function libHasGeo(c) {
    try { const K = window.CranePickCranes, v = JSON.parse(localStorage.getItem(window.CranePickModel.KEYS.library) || 'null'), e = v && v.cranes && v.cranes[K.key(c)];
      const d = e && (e.def || e.crane || e); return !!(d && K.geometryOf(d)); } catch (e) { return false; }
  }
  function dimHtml(m) {
    const CG = window.CranePickCraneGfx, K = window.CranePickCranes; if (!CG || !CG.dimCheck) return '';
    const c = m.c, has = !!K.geometryOf(c), u = m.u || { x: 0, y: 0, heading: 0 };
    let rows = [], fl = []; try { rows = CG.dimCheck(c, u); fl = m.virt ? [] : CG.floatTable(c, u, A.P.site.zone, window.proj4); } catch (e) { console.error(e); }
    const fp = window.CranePickLift.footprint(c, u), d = v => fmtN(v, 2), z = window.CranePickGeo.zone(A.P.site.zone), un = z.unit === 'm' ? 'm' : 'ft';
    const flag = has ? '' : `<p class="note"><span class="crnA">This crane's project copy has no manufacturer geometry block</span>${libHasGeo(c) ? ': the library copy has one: <b>Cranes &amp; setups tab → Use the library copy</b> to draw it (and place the floats) from the manufacturer\'s dimension drawings.' : ': the floats and outline are drawn from the file\'s dimensions and the assumptions listed below.'}</p>`;
    const ok = r => r.ok === true ? '<span class="ok">matches</span>' : r.ok === false ? '<span class="crnA">differs</span>' : r.mfr == null ? '<span class="crnA">not given</span>' : '—';
    const spr = fp.drawOnly ? `<p class="note"><span class="crnA">Outriggers drawn at "${esc(fp.spread)}"</span>: the chart group has no chart at this spread: the capacities and the ground loads use the "${esc(fp.chartSpread || '—')}" chart. Not valid for this setup until a chart for this spread is used.</p>` : '';
    return `<div class="sec" id="crnDim"><div class="secHead">6. Dimension check: drawn vs manufacturer</div><div class="secBody">${flag}${spr}
      <p class="note">Each dimension the plan drawing uses, against the manufacturer's value and its page (basis: printed, derived from printed values, or scaled off the drawing ±0.5 ft — scaled values are drawn only, never used in a calculation). Units ft, from the centre of rotation.</p>
      <div class="tscroll"><table class="tbl" id="crnDimTbl"><thead><tr><th>Dimension</th><th>Drawn</th><th>Manufacturer</th><th>Page</th><th>Basis</th><th>Check</th><th>Note</th></tr></thead><tbody>
      ${rows.map(r => `<tr${r.ok === false ? ' class="crnRowA"' : ''}><td>${esc(r.item)}</td><td class="n">${d(r.drawn)}</td><td class="n">${d(r.mfr)}</td><td>${r.page != null ? 'p. ' + esc(String(r.page)) : '—'}</td><td>${esc(r.basis || '—')}</td><td>${ok(r)}</td><td class="note">${esc(r.note || '')}</td></tr>`).join('')}
      </tbody></table></div></div></div>
      ${fl.length ? `<div class="sec" id="crnFloats"><div class="secHead">7. ${fp.floatC.length ? 'Float centres' : 'Track centre-line ends'}: where they sit (setup ${esc(u.name || '')})</div><div class="secBody">
      <p class="note">Local x along the carrier (+ toward the front), y across (+ left), from the centre of rotation; State Plane ${esc(z.short || z.id)} (${un}); latitude / longitude NAD 83. ${fp.spread ? `Spread "${esc(fp.spread)}".` : ''}</p>
      <div class="tscroll"><table class="tbl" id="crnFloatTbl"><thead><tr><th>Support</th><th>x (ft)</th><th>y (ft)</th><th>Easting (${un})</th><th>Northing (${un})</th><th>Latitude</th><th>Longitude</th></tr></thead><tbody>
      ${fl.map(r => `<tr><td>${esc(r.id)} — ${esc(r.name)}</td><td class="n">${d(r.lx)}</td><td class="n">${d(r.ly)}</td><td class="n">${fmtN(r.E, 2)}</td><td class="n">${fmtN(r.N, 2)}</td><td class="n">${fmtN(r.lat, 7)}</td><td class="n">${fmtN(r.lng, 7)}</td></tr>`).join('')}
      </tbody></table></div><div class="goRow"><button type="button" data-cg="csv">Download stake-out CSV</button></div></div></div>` : ''}`;
  }
  function stakeout() {
    const CG = window.CranePickCraneGfx, P = A.P; if (!CG) return;
    const byId = id => (P.cranes || []).find(c => c.id === id), craneOf = u => { const c = byId(u.craneId); return c ? c.def : null; };
    const txt = CG.stakeoutCsv(P, window.proj4, craneOf), b = new Blob([txt], { type: 'text/csv' }), a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = ((P.name || 'crane-pick').replace(/[^\w.-]+/g, '_')) + '-stakeout.csv'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }
  const fmtN = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  function onChange(e) {
    const t = e.target, s = st();
    if (t.id === 'crnSel') { const [craneId, setupId, group] = t.value.split('|'); Object.assign(s, { craneId, setupId, group, lift: null, cfg: null }); }
    else if (t.id === 'crnLift') { s.lift = t.value; s.cfg = null; }
    else if (t.id === 'crnAt') { s.at = t.value; s.cfg = null; }
    else if (t.id === 'crnCfg') s.cfg = t.value;
    else return;
    A.saveUi(); draw();
  }
  function onClick(e) {
    const a = e.target.closest('[data-cg]'); if (!a) return; e.preventDefault(); const k = a.dataset.cg, id = a.dataset.id;
    if (k === 'csv') return stakeout();
    if (k === 'cranes') return A.showITab('cranes');
    if (k === 'lifts') return A.showITab('lifts');
    if (k === 'setup') { const sid = id; if (sid && window.CranePickPlace && A.P.setups.some(u => u.id === sid)) return window.CranePickPlace.select(sid, null); return A.showITab('cranes'); }   // 2026-11-17: the setups are on the Cranes & setups tab
    if (k === 'rpt') return gotoReport(a.dataset.key);
    if (k === 'dwg') return window.CranePickDrawingsUI && window.CranePickDrawingsUI.show(a.dataset.sheet);
    if (k === 'pick') { A.showOTab('picks'); setTimeout(() => { const d = document.getElementById('pk-' + id); if (d) { d.open = true; d.scrollIntoView({ block: 'start' }); } }, 30); return; }
    if (k === 'ground') { A.showOTab('ground'); setTimeout(() => { const d = document.getElementById('gr-' + id); if (d) { if (d.tagName === 'DETAILS') d.open = true; d.scrollIntoView({ block: 'start' }); } }, 30); return; }
    if (k === 'tandem') { A.showITab('lifts'); if (window.CranePickTandemUI) window.CranePickTandemUI.select(id); }
  }
  /* ---------- Report §Cranes: the figures of each setup of a crane used by a lift (ui/cranes.js adds them to the crane's subsection) ---------- */
  function reportItems(P, craneId) {
    if (!F()) return [];
    const items = [];
    F().options(P).filter(o => o.craneId === craneId && o.used).forEach(o => {
      let m; try { m = F().model(P, ctx(), { craneId, setupId: o.setupId, at: 'gov' }); } catch (e) { console.error(e); return; } if (!m) return;
      const rs = F().rows(m), ch = m.chart, pt = m.pt;
      items.push({ type: 'note', text: `Setup "${m.u.name}"${pt ? `: figures at the ${pt.where} of ${pt.lift.name}` : ''}. Every value is the engines' own, labelled with its source (file p.x, chart p.x, entered, ASSUMED (default)); the Crane tab shows any lift and point. Worked steps: see [[${pt && pt.lift.kind === 'pick' ? 'pick-' + pt.lift.id : pt ? 'tandem-' + pt.lift.id : 'cranes'}]].` });
      items.push({ type: 'figure', svg: F().svg(F().plan(m), { w: 620, h: 520 }), caption: `${m.u.name}: plan in the crane frame (carrier front up; to scale), every dimension with its source; assumed values highlighted.` });
      const ef = F().elev(m); if (ef) items.push({ type: 'figure', svg: F().svg(ef, { w: 640, h: 480 }), caption: `${m.u.name}: side elevation along the boom, ${pt.where} (to scale).` });
      const cf = F().chart(m); if (cf) items.push({ type: 'figure', svg: F().svg(cf, { w: 660, h: 420 }), caption: `${m.u.name}: load chart "${ch.cfg.label || ch.cfg.id}" (rating basis ${ch.rb.text}; ${ch.source.doc}, rev. ${ch.source.revision}${ch.source.prelim ? ', PRELIMINARY' : ''}): the tabulated points, each boom length as the lookup reads it${ch.interp ? '' : ' (no interpolation)'}, the boom in use bold, capacity × threshold dashed, the operating points of every lift on this chart.` });
      const wf = F().weights(m); if (!wf.none) items.push({ type: 'figure', svg: F().svg(wf, { w: 660, h: 340 }), caption: `${m.u.name}: weights and CGs of the ${m.pd.kind === 'crawler' ? 'track' : 'outrigger'} loads at the governing slew angle and the largest support loads${pt ? ` (see [[${pt.lift.kind === 'pick' ? 'gr-' + pt.lift.id : 'tandem-' + pt.lift.id}]])` : ''}.` });
      items.push({ type: 'table', caption: `${m.u.name}: crane inputs used in the analysis`, head: ['Group', 'Input', 'Value', 'Source', 'Used in'], rows: rs.map(r => [r.grp, r.label, { t: r.value, n: true }, r.assumed ? { t: r.src + (r.note ? ' (' + r.note + ')' : ''), cls: 'hi' } : r.src + (r.note ? ' (' + r.note + ')' : ''), r.used.join('; ')]) });
    });
    return items;
  }
  /* ---------- wiring ---------- */
  const mark = () => { dirty = true; if (A.ui.otab === 'crane') draw(); };
  A.outTab({ id: 'crane', label: 'Crane', before: 'picks', build: p => { el = p; p.addEventListener('change', onChange); p.addEventListener('click', onClick); }, show: () => { if (dirty) draw(); } });
  A.on('project', mark); A.on('change', o => { if (o.kind !== 'select' && o.kind !== 'select-lift') mark(); });
  A.on('live', o => { if (!o || (o.kind !== 'lifts' && o.kind !== 'items' && o.kind !== 'tandem')) return; dirty = true; if (A.ui.otab !== 'crane') return; const fr = MP() && MP().raf; if (fr) fr('craneTab', draw); else draw(); });
  if (window.CranePickDrawSet) window.CranePickDrawSet.addSheets((P, c) => F() ? F().sheets(P, c) : []);
  window.CranePickCraneTab = { stakeout, redraw: mark, draw, reportItems, get state() { return st(); } };
})();
