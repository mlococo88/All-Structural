/* apps/steel-bridge/ui/autodesign.js — the Auto design output tab (window.SBDAutoDesignUI), from engine/autodesign.js. Classic script.
   Needs SharedSteps, SharedUnits, SBDModel, SBDAutoDesign and every module the full check runs (see engine/autodesign.js).

   One panel: the inputs (saved in the project, P.autodesign: mode, objective, the price list, the limits, the girder counts, the change to
   check), Run with progress and Stop (the search runs a trial at a time with setTimeout, so the page stays responsive), the ranked list of
   candidates (each passing every module on the full check), and Apply with one-step Undo (the design before Apply is kept in
   P.autodesign.undo). The result itself lives in memory for this page view.

   render(host, ctx): ctx = { P (project), g (girder index), changed(redraw) (the project was changed: autosave and redraw) } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d), AD = () => window.SBDAutoDesign;
  const S = { running: false, stop: false, prog: null, R: null, key: '', sel: 0, err: '' };
  const TABN = { flex: 'Flexure', shear: 'Shear & stiffeners', fat: 'Fatigue & studs', cn: 'Constructibility', cf: 'Cross-frames', spl: 'Field splices', an: 'Analysis' };
  function css() {
    if (document.getElementById('ad-css')) return;
    const st = document.createElement('style'); st.id = 'ad-css';
    st.textContent = `.ad-list tr{cursor:pointer;} .ad-bar{height:8px;background:#e4e7eb;border-radius:4px;overflow:hidden;margin:6px 0;} .ad-bar>div{height:100%;background:#2563EB;}
      .ad-ok{background:#e7f4ec;} .ad-hi{background:#fdf3d8;} .ad-cur td{font-style:italic;color:#475569;} .ad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px 14px;}`;
    document.head.appendChild(st);
  }
  const ensure = P => { if (!P.autodesign) P.autodesign = {}; const a = P.autodesign; a.cost = a.cost || {}; a.limits = a.limits || {}; a.change = a.change || {}; return a; };
  const key = P => JSON.stringify([P.spans, P.girders, P.xs, P.materials, P.deck, P.framing, P.splices, P.stiffeners, P.fatigue, P.studs, P.crossframes, P.ownerRules, P.analysis, P.constr, { ...(P.autodesign || {}), undo: null, applied: null }]);

  function inputsHtml(P) {
    const a = ensure(P), s = AD().settings(P), D = AD().DEF, v = (o, k, d) => o[k] !== undefined ? o[k] : d;
    const opt = (cur, list) => list.map(([x, t]) => `<option value="${esc(x)}"${String(cur) === String(x) ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const sel = (id, lbl, cur, list) => `<div class="fRow"><label for="${id}">${lbl}</label><select id="${id}" data-ad="${id}">${opt(cur, list)}</select></div>`;
    const num = (id, lbl, cur, unit, ph) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" id="${id}" data-ad="${id}" value="${esc(cur)}"${ph != null ? ` placeholder="${esc(ph)}"` : ''}><span class="unit">${unit || ''}</span></div>`;
    const L = a.limits, C = a.cost, lim = s.lim;
    return `<section class="sec"><div class="secHead">Auto design: inputs</div><div class="secBody">
      <div class="ad-grid">${sel('mode', 'Mode', s.mode, [['new', 'New design (girder count, depth, plates, transitions)'], ['refine', 'Refine current design (keep the zones)'], ['check', 'Check one change']])}
      ${sel('objective', 'Objective', s.objective, [['weight', 'Lightest steel'], ['depth', 'Shallowest depth'], ['cost', 'Lowest cost']])}
      ${num('topN', 'Candidates to keep', v(a, 'topN', D.topN), '')}
      ${s.mode === 'new' ? num('nbList', 'Girder counts to study', v(a, 'nbList', ''), '', `blank: ${AD().nbList(P, s).join(', ')}`) : ''}
      ${s.mode === 'check' ? num('change.nb', 'Change: girder count', v(a.change, 'nb', ''), '', `now ${(P.xs || {}).nb}`) + num('change.D', 'Change: web depth D', v(a.change, 'D', ''), 'in', `now ${AD().layoutOf(P).D}`) : ''}</div>
      <p class="note"><b>Price list</b> (lowest cost; per girder line, × the girder count):</p><div class="ad-grid">
      ${num('cost.steel', 'Steel', v(C, 'steel', D.cost.steel), '$/lb')}${num('cost.trans', 'Flange transition', v(C, 'trans', D.cost.trans), '$ each')}
      ${num('cost.splice', 'Field splice', v(C, 'splice', D.cost.splice), '$ each')}${num('cost.stiff', 'Intermediate stiffener', v(C, 'stiff', D.cost.stiff), '$ each')}</div>
      <p class="note"><b>Limits</b> (blank: the owner's rule or Preliminary sizing's default, shown grey):</p><div class="ad-grid">
      ${num('limits.Dmin', 'Web depth, min.', v(L, 'Dmin', ''), 'in', 'L/36')}${num('limits.Dmax', 'Web depth, max.', v(L, 'Dmax', ''), 'in', 'L/18')}
      ${num('limits.Dinc', 'Web depth increment', v(L, 'Dinc', ''), 'in', lim.Dinc)}${num('limits.twMin', 'Web thickness, min.', v(L, 'twMin', ''), 'in', lim.twMin)}
      ${num('limits.tfMin', 'Flange thickness, min.', v(L, 'tfMin', ''), 'in', lim.tfMin)}${num('limits.bfMin', 'Flange width, min.', v(L, 'bfMin', ''), 'in', lim.bfMin)}
      ${num('limits.bfInc', 'Flange width increment', v(L, 'bfInc', ''), 'in', lim.bfInc)}${num('limits.tfInc', 'Flange thickness increment', v(L, 'tfInc', D.limits.tfInc), 'in')}
      ${num('limits.twInc', 'Web thickness increment', v(L, 'twInc', D.limits.twInc), 'in')}${num('limits.tfMax', 'Flange thickness, max.', v(L, 'tfMax', D.limits.tfMax), 'in')}
      ${num('limits.thkRatio', 'Thickness ratio at a transition, max.', v(L, 'thkRatio', ''), '', lim.thkRatio)}${num('limits.maxTrans', 'Transitions per field piece and flange', v(L, 'maxTrans', D.limits.maxTrans), '')}
      ${num('limits.minSeg', 'Shortest flange zone', v(L, 'minSeg', D.limits.minSeg), 'ft')}${num('limits.maxDb', 'Width change at a field splice, max.', v(L, 'maxDb', D.limits.maxDb), 'in')}
      ${sel('limits.topConst', 'Top flange width', String(v(L, 'topConst', true)), [['true', 'Constant along the girder'], ['false', 'May change at field splices']])}
      ${sel('limits.depthRule', 'Minimum depth (Table 2.5.2.6.3-1)', String(v(L, 'depthRule', true)), [['true', 'Applied'], ['false', 'Not applied']])}</div>
      <p class="note">Owner: ${esc(s.owner)}. ${Object.entries(s.cite).filter(([, c]) => c && !/default|entered/.test(c)).map(([k, c]) => `${esc(k)}: ${esc(c)}`).join('; ') || 'No owner plate rules (AASHTO).'}
        Width rules: constant in a field piece; at a field splice wide enough for the splice bolts (DT10, the Splices tab bolts and the owner's edge distance), or one gage line where that is lighter (the objective decides).</p>
      <div class="fRow"><button type="button" class="primary" id="ad_run"${S.running ? ' disabled' : ''}>Run Auto design</button><button type="button" id="ad_stop"${S.running ? '' : ' disabled'}>Stop</button>
      ${P.autodesign && P.autodesign.undo ? '<button type="button" id="ad_undo">Undo the last Apply</button>' : ''}</div>
      ${S.running || S.prog ? `<div class="ad-bar"><div style="width:${Math.round(100 * ((S.prog && S.prog.f) || 0))}%"></div></div><p class="note">${esc((S.prog && S.prog.msg) || '')}</p>` : ''}</div></section>`;
  }
  const govTxt = g => g ? `${esc(g.mod)} ${esc(g.id)}${g.x != null ? `, x = ${fmt(g.x, 2)} ft` : ''}${g.gl ? `, ${esc(g.gl)}` : ''}` : '—';
  function resultsHtml(P, R) {
    const c0 = R.current, cls = r => r > 0.95 ? 'ad-hi' : 'ad-ok';
    let h = `<section class="sec"><div class="secHead">Candidates (ranked by ${esc({ weight: 'steel weight', depth: 'web depth', cost: 'cost' }[R.S.objective])})</div><div class="secBody">`;
    if (R.note) h += `<div class="alert">${esc(R.note)}</div>`;
    h += `<div class="tscroll"><table class="tbl ad-list"><thead><tr><th>#</th><th>N<sub>b</sub></th><th>D (in)</th><th>Weight (lb, all girders)</th><th>Cost ($)</th><th>Transitions</th><th>Splices</th><th>Gage lines</th><th>Governing ratio</th><th class="lft">What governs</th></tr></thead><tbody>
      <tr class="ad-cur"><td>now</td><td>${c0.L.nb}</td><td>${fmt(c0.L.D, 2)}</td><td>${fmt(c0.cost.w, 0)}</td><td>${fmt(c0.cost.total, 0)}</td><td>${c0.cost.nTr}</td><td>${c0.cost.nSpl}</td><td></td><td>${c0.E ? fmt(c0.E.ratio, 3) : ''}</td><td class="lft">current design${c0.E && !c0.E.pass ? ' (fails the screen)' : ''}</td></tr>
      ${R.cands.map((c, i) => `<tr data-adsel="${i}"${i === S.sel ? ' class="sel"' : ''}><td>${i + 1}</td><td>${c.nb}</td><td>${fmt(c.D, 2)}</td><td>${fmt(c.cost.w, 0)}</td><td>${fmt(c.cost.total, 0)}</td><td>${c.nTr}</td><td>${c.nSpl}</td><td>${c.minLines || 'as set'}</td>
        <td class="${cls(c.ratio)}">${fmt(c.ratio, 3)}</td><td class="lft">${c.gov && c.gov.tab ? `<a href="#" data-adgo="${esc(c.gov.tab)}" title="Open the ${esc(TABN[c.gov.tab] || '')} tab">${govTxt(c.gov)}</a>` : govTxt(c.gov)}${c.gov ? `: ${esc(c.gov.title)}` : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Every candidate listed passed every module on the full check (the analysis with its own stiffness; flexure, shear and stiffeners, fatigue and studs, constructibility, cross-frames, field splices). ${R.rejected.length ? `${R.rejected.length} finalist(s) failed the full check and were dropped (below).` : ''} Click a row for its plates and steps.</p></div></section>`;
    const c = R.cands[S.sel];
    if (c) {
      h += `<section class="sec"><div class="secHead">Candidate ${S.sel + 1}: plates</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>x<sub>0</sub> (ft)</th><th>x<sub>1</sub> (ft)</th><th>D</th><th>t<sub>w</sub></th><th>b<sub>t</sub></th><th>t<sub>t</sub></th><th>b<sub>b</sub></th><th>t<sub>b</sub></th></tr></thead><tbody>
        ${c.segments.map(s => `<tr><td>${fmt(s.x0, 2)}</td><td>${fmt(s.x1, 2)}</td><td>${fmt(s.D, 3)}</td><td>${fmt(s.tw, 4)}</td><td>${fmt(s.topB, 2)}</td><td>${fmt(s.topT, 4)}</td><td>${fmt(s.botB, 2)}</td><td>${fmt(s.botT, 4)}</td></tr>`).join('')}</tbody></table></div>
        <p class="note">Field splices at ${c.L.spl.map(x => fmt(x, 2)).join(', ') || '(none)'} ft. ${c.nb !== c0.L.nb ? `Girder count ${c0.L.nb} → ${c.nb}: equal spacing over the same out-to-out girder width, b<sub>eff</sub> from the tributary width (4.6.2.6.1). ` : ''}${c.minLines === 1 ? 'One gage line each side of the web at the splices (Splices tab, minimum bolt lines = 1). ' : ''}Apply writes these plates into every girder of the project.</p>
        ${c.warns.length ? `<div class="alert">Warnings (not failures): ${c.warns.map(w => esc(`${w.mod} ${w.id} ${w.title}`)).join('; ')}</div>` : ''}
        <div class="fRow"><button type="button" class="primary" id="ad_apply">Apply candidate ${S.sel + 1}</button></div></div></section>
        <section class="sec"><div class="secHead">Worked steps, candidate ${S.sel + 1}</div><div class="secBody"><ol class="steps">${c.steps.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol></div></section>`;
    }
    if ((R.blocked || []).length) h += `<section class="sec"><div class="secHead">Blocked by detail checks (not passing candidates)</div><div class="secBody"><p class="note">These designs pass every check the plates control, but fail detail checks that the current design fails too, whatever the plates: ${esc(R.blockers.join(', '))}. Fix those inputs on their tabs and run again.</p><ul>${R.blocked.map(b => `<li>N<sub>b</sub> ${b.nb}, D ${fmt(b.D, 2)} in, ${fmt(b.cost.w, 0)} lb${b.minLines === 1 ? ', 1 gage line' : ''}: ${b.fails.map(f => esc(`${f.mod} ${f.id} ${f.title}`)).join('; ')}</li>`).join('')}</ul></div></section>`;
    if (R.rejected.length) h += `<section class="sec"><div class="secHead">Dropped at the full check</div><div class="secBody"><ul>${R.rejected.map(r => `<li>N<sub>b</sub> ${r.L.nb}, D ${fmt(r.L.D, 2)} in, ${fmt(r.cost.w, 0)} lb: ${r.fails.map(f => esc(`${f.mod} ${f.id} ${f.title}${isFinite(f.r) ? ` (${fmt(f.r, 3)})` : ''}`)).join('; ')}</li>`).join('')}</ul></div></section>`;
    return h;
  }
  function render(host, ctx) {
    css(); const P = ctx.P;
    let h = inputsHtml(P);
    if (S.err) h += `<div class="alert err">${esc(S.err)}</div>`;
    if (S.R && !S.running) h += (S.key !== key(P) ? '<div class="alert">The project changed since this run: run again before applying.</div>' : '') + resultsHtml(P, S.R);
    host.innerHTML = h;
    const redraw = () => render(host, ctx), on = (sel, ev, f) => host.querySelectorAll(sel).forEach(el => el.addEventListener(ev, f));
    on('[data-ad]', 'change', e => { const a = ensure(P), id = e.target.dataset.ad, val = e.target.value, path = id.split('.'), o = path.length > 1 ? a[path[0]] : a, k = path[path.length - 1];
      o[k] = val === 'true' ? true : val === 'false' ? false : val;
      setTimeout(() => { if (ctx.changed) ctx.changed(false); else redraw(); }, 0); });   // after the event (a change fires on blur, while a click is under way)
    on('#ad_run', 'click', () => { S.running = true; S.stop = false; S.err = ''; S.R = null; S.sel = 0; S.prog = { f: 0, msg: 'Starting…' }; const k = key(P); redraw();
      AD().runChunked(JSON.parse(JSON.stringify(P)), {}, p => { S.prog = p; const bar = host.querySelector('.ad-bar>div'), nt = host.querySelector('.ad-bar + .note'); if (bar) bar.style.width = Math.round(100 * (p.f || 0)) + '%'; if (nt) nt.textContent = p.msg || ''; }, () => S.stop)
        .then(R => { S.running = false; S.prog = R ? null : { f: 0, msg: 'Stopped.' }; S.R = R; S.key = k; redraw(); })
        .catch(e => { S.running = false; S.prog = null; S.err = 'Auto design failed: ' + (e && e.message); redraw(); }); });
    on('#ad_stop', 'click', () => { S.stop = true; });
    on('[data-adsel]', 'click', e => { if (e.target.closest('[data-adgo]')) return; S.sel = +e.currentTarget.dataset.adsel; redraw(); });
    on('[data-adgo]', 'click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${e.currentTarget.dataset.adgo}"]`); if (b) b.click(); });
    on('#ad_apply', 'click', () => { const c = S.R && S.R.cands[S.sel]; if (!c) return; if (S.key !== key(P) && !confirm('The project changed since this run. Apply anyway?')) return;
      const r = AD().apply(P, c); ['autodesign', ...AD().APPLY_KEYS].forEach(k => { if (r.project[k] === undefined) delete P[k]; else P[k] = r.project[k]; }); S.R = null;   /* with the sized details and the overhang (Auto design PR 2) */ if (ctx.changed) ctx.changed(true); else redraw(); });
    on('#ad_undo', 'click', () => { const Q = AD().undo(P); if (!Q) return; ['autodesign', ...AD().APPLY_KEYS].forEach(k => { if (Q[k] === undefined) delete P[k]; else P[k] = Q[k]; }); if (ctx.changed) ctx.changed(true); else redraw(); });
  }
  window.SBDAutoDesignUI = { render };
})();
