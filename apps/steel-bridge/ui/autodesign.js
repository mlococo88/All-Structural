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
  const S = { running: false, stop: false, prog: null, R: null, key: '', sel: 0, err: '', cmp: ['cur', '0'] };   // cmp: the two designs of the compare view ('cur' or a candidate index)
  const TABN = { flex: 'Flexure', shear: 'Shear & stiffeners', fat: 'Fatigue & studs', cn: 'Constructibility', cf: 'Cross-frames', spl: 'Field splices', an: 'Analysis' };
  function css() {
    if (document.getElementById('ad-css')) return;
    const st = document.createElement('style'); st.id = 'ad-css';
    st.textContent = `.ad-list tr{cursor:pointer;} .ad-bar{height:8px;background:#e4e7eb;border-radius:4px;overflow:hidden;margin:6px 0;} .ad-bar>div{height:100%;background:#2563EB;}
      .ad-ok{background:#e7f4ec;} .ad-hi{background:#fdf3d8;} .ad-cur td{font-style:italic;color:#475569;} .ad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:2px 14px;}
      .ad-vars td,.ad-vars th{padding:2px 6px;vertical-align:top;} .ad-vars .nt{color:#475569;font-size:8.5pt;max-width:420px;} .ad-vars select{max-width:130px;} .ad-vars input{width:5em;} .ad-grp th{background:#f1f5f9;}
      .ad-lk{display:inline-block;padding:0 6px;border:1px solid #cbd5e1;border-radius:4px;color:#475569;font-size:8.5pt;} tr.ad-fx td{color:#64748b;} details.ad-pc summary{cursor:pointer;color:#2563EB;font-size:9pt;}
      .ad-cmp td,.ad-cmp th{padding:2px 8px;} .ad-cmp .ad-better{background:#e7f4ec;} .ad-cmp .ad-worse{background:#fbe1dd;}`;
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
      </div></section>`;
  }
  function runBar(P) {
    return `<section class="sec"><div class="secBody">
      <div class="fRow"><button type="button" class="primary" id="ad_run"${S.running ? ' disabled' : ''}>Run Auto design</button><button type="button" id="ad_stop"${S.running ? '' : ' disabled'}>Stop</button>
      ${P.autodesign && P.autodesign.undo ? '<button type="button" id="ad_undo">Undo the last Apply</button>' : ''}</div>
      ${S.running || S.prog ? `<div class="ad-bar"><div style="width:${Math.round(100 * ((S.prog && S.prog.f) || 0))}%"></div></div><p class="note">${esc((S.prog && S.prog.msg) || '')}</p>` : ''}</div></section>`;
  }
  /* ---------- the design variables (P.autodesign.vars; engine/autodesign.js VARS): Lock / Range / Auto for every sizable input ---------- */
  const frc = v => { const n = Math.round(+v * 16), w = Math.floor(n / 16), r = n % 16; if (!isFinite(n)) return '—'; if (!r) return String(w); let a = r, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return `${w ? w + ' ' : ''}${a}/${b}`; };
  /* the current value of a variable in the project (shown in the table: what Lock keeps) */
  function curVal(P, id, k) {
    const L = AD().layoutOf(P), st = P.stiffeners || {}, T = (st.transverse || {}).types || {}, B = (st.bearing || {}).types || {}, pc = L.web[k];
    const fl = f => (L[f] || []).filter(z => !pc || (z.x1 > pc.x0 + 1e-6 && z.x0 < pc.x1 - 1e-6)), uniq = a => [...new Set(a)].join(', ');
    switch (id) {
      case 'nb': return String((P.xs || {}).nb || ''); case 'D': return `${fmt(L.D, 2)} in`;
      case 'oh': { const x = P.xs || {}; return `${fmt(+x.ohL, 2)} / ${fmt(+x.ohR, 2)} ft (deck ${fmt(+x.ohL + (x.bays || []).reduce((a, v) => a + +v, 0) + +x.ohR, 2)} ft out to out)`; }
      case 'tw': return pc ? `${frc(pc.tw)} in` : uniq(L.web.map(p => frc(p.tw))) + ' in';
      case 'bt': return uniq(fl('top').map(z => fmt(z.b, 2))) + ' in'; case 'bb': return uniq(fl('bot').map(z => fmt(z.b, 2))) + ' in';
      case 'tt': return uniq(fl('top').map(z => frc(z.t))) + ' in'; case 'tb': return uniq(fl('bot').map(z => frc(z.t))) + ' in';
      case 'trans': return `${AD().transitions(L)} per girder`; case 'spl': return L.spl.length ? L.spl.map(x => fmt(x, 2)).join(', ') + ' ft' : 'none';
      case 'splPl': return P.splices && P.splices.auto === false ? 'plates entered' : 'auto-design'; case 'tsSp': return (st.layout || {}).mode === 'bays' ? 'per bay' : `${fmt(+(st.layout || {}).doRatio || 1, 2)}`;
      case 'tsA_b': return T.A ? `${fmt(+T.A.bt, 2)} in` : ''; case 'tsA_t': return T.A ? `${frc(T.A.tp)} in` : ''; case 'tsB_b': return T.B ? `${fmt(+T.B.bt, 2)} in` : ''; case 'tsB_t': return T.B ? `${frc(T.B.tp)} in` : '';
      case 'bsA_n': return B.A ? String(B.A.np) : ''; case 'bsA_b': return B.A ? `${fmt(+B.A.bt, 2)} in` : ''; case 'bsA_t': return B.A ? `${frc(B.A.tp)} in` : '';
      case 'bsB_n': return B.B ? String(B.B.np) : ''; case 'bsB_b': return B.B ? `${fmt(+B.B.bt, 2)} in` : ''; case 'bsB_t': return B.B ? `${frc(B.B.tp)} in` : '';
      case 'scP': case 'scN': { const Z = (P.studs || {}).zones || []; return Z.length ? `${Z.length} zones entered` : 'from the analysis (span tenths)'; }
      case 'cf': return (((P.crossframes || {}).mem || {}).top || {}).sec || ''; case 'weld': return P.welds && P.welds.w !== '' && P.welds.w != null ? `${frc(P.welds.w)} in` : 'Table 6.13.3.4-1 minimum';
      default: return '';
    }
  }
  function varsHtml(P, s) {
    const a = ensure(P), VV = a.vars || {}, L = AD().layoutOf(P), MODE = { auto: 'Auto', lock: 'Lock', range: 'Range' };
    const sel = (key, q, V, inherit) => { const e = VV[key]; if (q.forced) return `<span class="ad-lk" title="${esc(q.forced)}">Lock</span>`;
      const cur = inherit && !(e && e.mode) ? '' : q.mode;
      return `<select data-adv="${esc(key)}.mode" aria-label="${esc(V.label)}${inherit ? ' ' + key.split('#')[1] : ''}: mode">${inherit ? `<option value=""${cur === '' ? ' selected' : ''}>as all pieces</option>` : ''}${V.only.map(m => `<option value="${m}"${cur === m ? ' selected' : ''}>${MODE[m]}</option>`).join('')}</select>`; };
    const box = (key, k, q, V) => q.mode !== 'range' || q.forced || (key.includes('#') && !(VV[key] && VV[key].mode)) ? '<td></td>' : `<td><input type="text" data-adv="${esc(key)}.${k}" value="${esc((VV[key] || {})[k] != null ? VV[key][k] : '')}" placeholder="${k === 'step' ? 'step' : k}" aria-label="${esc(V.label)}: ${k}" size="5"></td>`;
    const row = (V, key, q, label, inherit, k) => `<tr${q.forced ? ' class="ad-fx"' : ''}><td class="lft">${esc(label)}</td><td>${sel(key, q, V, inherit)}</td>${box(key, 'min', q, V)}${box(key, 'max', q, V)}${V.step ? box(key, 'step', q, V) : '<td></td>'}<td class="lft">${esc(curVal(P, V.id, k))}</td><td class="lft nt">${esc(q.forced || (inherit ? '' : V.note || ''))}</td></tr>`;
    let grp = '', h = '';
    AD().VARS.forEach(V => { if (V.grp !== grp) { grp = V.grp; h += `<tr class="ad-grp"><th colspan="7" class="lft">${esc(grp)}</th></tr>`; }
      const q = s.V[V.id]; h += row(V, V.id, q, V.label, false);
      if (V.piece && !q.forced) h += `<tr><td colspan="7" class="lft"><details class="ad-pc"${L.web.some((p, k) => VV[`${V.id}#${k + 1}`]) ? ' open' : ''}><summary>${esc(V.label)} per field piece</summary><table class="tbl"><tbody>${L.web.map((p, k) => { const key = `${V.id}#${k + 1}`, qk = s.V[key] || { ...q, mode: q.mode };
        return row(V, key, qk, `Field piece ${k + 1} (${fmt(p.x0, 2)} to ${fmt(p.x1, 2)} ft)`, true, k); }).join('')}</tbody></table></details></td></tr>`; });
    const nA = AD().VARS.filter(V => s.V[V.id].mode === 'auto').length, nL = AD().VARS.filter(V => s.V[V.id].mode === 'lock').length, nR = AD().VARS.length - nA - nL;
    return `<section class="sec"><div class="secHead">Auto design: design variables</div><div class="secBody">
      <p class="note">Every input Auto design can size: <b>Auto</b> sizes it (within the limits above, the owner's plate rules and the code checks), <b>Lock</b> keeps the project's current value, <b>Range</b> sizes it between min and max (and on the step, where asked). ${nA} Auto, ${nL} Lock, ${nR} Range. Default Auto; Lock where the tab's own automatic choice is off (stud zones or a weld size entered, splice auto-design off). <span class="ad-lk">Lock</span> alone: an input Auto design does not size (the note says why). Details (stiffeners, studs, cross-frames, welds, splice plates) are sized on each finalist, on its own analysis, before its full check.</p>
      <div class="fRow"><label for="ohSym">Overhangs</label><select id="ohSym" data-ad="ohSym"><option value="sym"${s.ohSym !== 'asym' ? ' selected' : ''}>Symmetric (left = right)</option><option value="asym"${s.ohSym === 'asym' ? ' selected' : ''}>Left and right sized apart</option></select><span class="unit">the right one only when a plate girder stands on the right fascia line</span></div>
      <div class="tscroll"><table class="tbl ad-vars"><thead><tr><th class="lft">Variable</th><th>Mode</th><th>Min</th><th>Max</th><th>Step</th><th class="lft">Now</th><th class="lft">How it is sized</th></tr></thead><tbody>${h}</tbody></table></div></div></section>`;
  }
  const govTxt = g => g ? `${esc(g.mod)} ${esc(g.id)}${g.x != null ? `, x = ${fmt(g.x, 2)} ft` : ''}${g.gl ? `, ${esc(g.gl)}` : ''}` : '—';
const ohT = X => { const o = X && X.oh; return o ? `${fmt(o.L, 2)}${Math.abs(o.R - o.L) > 1e-9 ? ' / ' + fmt(o.R, 2) : ''}` : 'as now'; };
  function resultsHtml(P, R) {
    const c0 = R.current, cls = r => r > 0.95 ? 'ad-hi' : 'ad-ok';
    let h = `<section class="sec"><div class="secHead">Candidates (ranked by ${esc({ weight: 'steel weight', depth: 'web depth', cost: 'cost' }[R.S.objective])})</div><div class="secBody">`;
    if (R.note) h += `<div class="alert">${esc(R.note)}</div>`;
    h += `<div class="tscroll"><table class="tbl ad-list"><thead><tr><th>#</th><th>N<sub>b</sub></th><th>D (in)</th><th>Weight (lb, all girders)</th><th>Cost ($)</th><th>Transitions</th><th>Splices</th><th>Gage lines</th><th>Overhang (ft)</th><th>Governing ratio</th><th class="lft">What governs</th></tr></thead><tbody>
      <tr class="ad-cur"><td>now</td><td>${c0.L.nb}</td><td>${fmt(c0.L.D, 2)}</td><td>${fmt(c0.cost.w, 0)}</td><td>${fmt(c0.cost.total, 0)}</td><td>${c0.cost.nTr}</td><td>${c0.cost.nSpl}</td><td></td><td>${fmt(+(P.xs || {}).ohL, 2)}${Math.abs(+(P.xs || {}).ohR - +(P.xs || {}).ohL) > 1e-9 ? ' / ' + fmt(+(P.xs || {}).ohR, 2) : ''}</td><td>${c0.E ? fmt(c0.E.ratio, 3) : ''}</td><td class="lft">current design${c0.E && !c0.E.pass ? ' (fails the screen)' : ''}</td></tr>
      ${R.cands.map((c, i) => `<tr data-adsel="${i}"${i === S.sel ? ' class="sel"' : ''}><td>${i + 1}</td><td>${c.nb}</td><td>${fmt(c.D, 2)}</td><td>${fmt(c.cost.w, 0)}</td><td>${fmt(c.cost.total, 0)}</td><td>${c.nTr}</td><td>${c.nSpl}</td><td>${c.minLines || 'as set'}</td><td>${ohT(c.L)}</td>
        <td class="${cls(c.ratio)}">${fmt(c.ratio, 3)}</td><td class="lft">${c.gov && c.gov.tab ? `<a href="#" data-adgo="${esc(c.gov.tab)}" title="Open the ${esc(TABN[c.gov.tab] || '')} tab">${govTxt(c.gov)}</a>` : govTxt(c.gov)}${c.gov ? `: ${esc(c.gov.title)}` : ''}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Every candidate listed passed every module on the full check (the analysis with its own stiffness; flexure, shear and stiffeners, fatigue and studs, constructibility, cross-frames, field splices, rating, welds; its details sized first). ${R.rejected.length ? `${R.rejected.length} finalist(s) failed the full check and were dropped (below).` : ''} Click a row for its plates and steps.</p></div></section>`;
    const c = R.cands[S.sel];
    if (c) {
      h += `<section class="sec"><div class="secHead">Candidate ${S.sel + 1}: plates</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>x<sub>0</sub> (ft)</th><th>x<sub>1</sub> (ft)</th><th>D</th><th>t<sub>w</sub></th><th>b<sub>t</sub></th><th>t<sub>t</sub></th><th>b<sub>b</sub></th><th>t<sub>b</sub></th></tr></thead><tbody>
        ${c.segments.map(s => `<tr><td>${fmt(s.x0, 2)}</td><td>${fmt(s.x1, 2)}</td><td>${fmt(s.D, 3)}</td><td>${fmt(s.tw, 4)}</td><td>${fmt(s.topB, 2)}</td><td>${fmt(s.topT, 4)}</td><td>${fmt(s.botB, 2)}</td><td>${fmt(s.botT, 4)}</td></tr>`).join('')}</tbody></table></div>
        <p class="note">Field splices at ${c.L.spl.map(x => fmt(x, 2)).join(', ') || '(none)'} ft. ${c.nb !== c0.L.nb ? `Girder count ${c0.L.nb} → ${c.nb}: equal spacing over the same out-to-out girder width, b<sub>eff</sub> from the tributary width (4.6.2.6.1). ` : ''}${c.minLines === 1 ? 'One gage line each side of the web at the splices (Splices tab, minimum bolt lines = 1). ' : ''}Apply writes these plates into every girder of the project.</p>
        ${c.det && (c.det.rows.length || c.det.notes.length) ? `<p class="note"><b>Details sized</b> on this candidate (its own analysis; each the least passing the tab's checks):</p><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Detail</th><th class="lft">Chosen</th><th class="lft">How</th></tr></thead><tbody>${c.det.rows.map(r => `<tr><td class="lft">${esc(r.label)}</td><td class="lft">${esc(r.value)}</td><td class="lft">${esc(r.how)}</td></tr>`).join('')}</tbody></table></div>${c.det.notes.map(n => `<div class="alert">${esc(n)}</div>`).join('')}` : ''}
        ${c.warns.length ? `<div class="alert">Warnings (not failures): ${c.warns.map(w => esc(`${w.mod} ${w.id} ${w.title}`)).join('; ')}</div>` : ''}
        <div class="fRow"><button type="button" class="primary" id="ad_apply">Apply candidate ${S.sel + 1}</button></div></div></section>
        <section class="sec"><div class="secHead">Worked steps, candidate ${S.sel + 1}</div><div class="secBody"><ol class="steps">${c.steps.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol></div></section>`;
    }
    h += compareHtml(P, R);
    if ((R.blocked || []).length) h += `<section class="sec"><div class="secHead">Blocked by detail checks (not passing candidates)</div><div class="secBody"><p class="note">These designs pass every check the plates control, but fail detail checks that the current design fails too, whatever the plates: ${esc(R.blockers.join(', '))}. Fix those inputs on their tabs and run again.</p><ul>${R.blocked.map(b => `<li>N<sub>b</sub> ${b.nb}, D ${fmt(b.D, 2)} in, ${fmt(b.cost.w, 0)} lb${b.minLines === 1 ? ', 1 gage line' : ''}: ${b.fails.map(f => esc(`${f.mod} ${f.id} ${f.title}`)).join('; ')}</li>`).join('')}</ul></div></section>`;
    if (R.rejected.length) h += `<section class="sec"><div class="secHead">Dropped at the full check</div><div class="secBody"><ul>${R.rejected.map(r => `<li>N<sub>b</sub> ${r.L.nb}, D ${fmt(r.L.D, 2)} in, ${fmt(r.cost.w, 0)} lb: ${r.fails.map(f => esc(`${f.mod} ${f.id} ${f.title}${isFinite(f.r) ? ` (${fmt(f.r, 3)})` : ''}`)).join('; ')}</li>`).join('')}</ul></div></section>`;
    return h;
  }
  /* ---------- compare view: any two of the current design and the candidates, side by side ---------- */
  const MODN = { flexure: 'Flexure', shear: 'Shear', stiffeners: 'Stiffeners', fatigue: 'Fatigue', studs: 'Studs', constructibility: 'Constructibility', 'cross-frames': 'Cross-frames', splices: 'Field splices', rating: 'Rating (HL-93 inventory, 1/RF)', welds: 'Welds', analysis: 'Analysis', model: 'Inputs' };
  function compareHtml(P, R) {
    if (!R.cands.length) return '';
    const pick = k => k === 'cur' ? { name: 'Current design', L: R.current.L, cost: R.current.cost, mods: R.current.mods || [], ratio: R.current.full ? R.current.full.ratio : (R.current.E || {}).ratio, gov: R.current.full ? R.current.full.gov : null, det: null, cur: true }
      : { ...R.cands[+k], name: `Candidate ${+k + 1}` };
    const opts = cur => `<option value="cur"${cur === 'cur' ? ' selected' : ''}>Current design</option>` + R.cands.map((c, i) => `<option value="${i}"${String(cur) === String(i) ? ' selected' : ''}>Candidate ${i + 1}</option>`).join('');
    const A = pick(S.cmp[0]), B = pick(S.cmp[1] != null && (S.cmp[1] === 'cur' || R.cands[+S.cmp[1]]) ? S.cmp[1] : '0');
    if (!A || !B || (!A.cur && !A.L) || (!B.cur && !B.L)) return '';
    const cell = (a, b, lowGood, f) => { const cls = !isFinite(a) || !isFinite(b) || Math.abs(a - b) < 1e-9 ? '' : (a < b) === lowGood ? ' class="ad-better"' : ' class="ad-worse"'; return `<td${cls}>${f(a)}</td>`; };
    const line = (lbl, fa, fb, num, lowGood, f) => `<tr><td class="lft">${lbl}</td>${num ? cell(fa, fb, lowGood, f) + cell(fb, fa, lowGood, f) : `<td>${fa}</td><td>${fb}</td>`}</tr>`;
    const segs = X => AD().segmentsOf(X.L), gl = g => g ? `${esc(g.mod)} ${esc(g.id)}${g.x != null ? ` at ${fmt(g.x, 2)} ft` : ''}` : '—';
    const modR = (X, m) => { const q = (X.mods || []).find(o => o.mod === m); return q ? q : null; };
    const mods = [...new Set([...(A.mods || []), ...(B.mods || [])].map(o => o.mod))];
    let h = `<section class="sec"><div class="secHead">Compare</div><div class="secBody"><div class="fRow"><label for="ad_c0">Left</label><select id="ad_c0" data-adcmp="0">${opts(S.cmp[0])}</select><label for="ad_c1">Right</label><select id="ad_c1" data-adcmp="1">${opts(S.cmp[1])}</select></div>
      <div class="tscroll"><table class="tbl ad-cmp"><thead><tr><th class="lft"></th><th>${esc(A.name)}</th><th>${esc(B.name)}</th></tr></thead><tbody>
      ${line('Girder count N<sub>b</sub>', A.L.nb, B.L.nb, false)}${line('Overhangs (ft)', A.cur ? `${fmt(+(P.xs || {}).ohL, 2)} / ${fmt(+(P.xs || {}).ohR, 2)}` : ohT(A.L), B.cur ? `${fmt(+(P.xs || {}).ohL, 2)} / ${fmt(+(P.xs || {}).ohR, 2)}` : ohT(B.L), false)}${line('Web depth D (in)', A.L.D, B.L.D, true, true, v => fmt(v, 2))}
      ${line('Steel weight, all girders (lb)', A.cost.w, B.cost.w, true, true, v => fmt(v, 0))}${line('Cost ($)', A.cost.total, B.cost.total, true, true, v => fmt(v, 0))}
      ${line('Flange transitions per girder', A.cost.nTr, B.cost.nTr, true, true, v => String(v))}${line('Intermediate stiffeners per girder', A.cost.nStiff, B.cost.nStiff, true, true, v => String(v))}
      ${line('Governing ratio (full check)', A.ratio, B.ratio, true, true, v => isFinite(v) ? fmt(v, 3) : '—')}${line('What governs', gl(A.gov), gl(B.gov), false)}
      <tr class="ad-grp"><th colspan="3" class="lft">Governing ratio of each module (click: the tab with its steps)</th></tr>
      ${mods.map(m => { const a = modR(A, m), b = modR(B, m), f = q => q ? `${q.tab ? `<a href="#" data-adgo="${esc(q.tab)}">` : ''}${isFinite(q.r) ? fmt(q.r, 3) : 'fail'} ${esc(q.id)}${q.tab ? '</a>' : ''}` : '—';
        const ra = a ? a.r : NaN, rb = b ? b.r : NaN, cls = (x, y) => !isFinite(x) || !isFinite(y) || Math.abs(x - y) < 1e-9 ? '' : x < y ? ' class="ad-better"' : ' class="ad-worse"';
        return `<tr><td class="lft">${esc(MODN[m] || m)}</td><td${cls(ra, rb)}>${f(a)}</td><td${cls(rb, ra)}>${f(b)}</td></tr>`; }).join('')}
      <tr class="ad-grp"><th colspan="3" class="lft">Details</th></tr>
      ${[...new Set([...((A.det || {}).rows || []), ...((B.det || {}).rows || [])].map(r => r.label))].map(lb => { const v = X => { const r = ((X.det || {}).rows || []).find(q => q.label === lb); return r ? esc(r.value) : X.cur ? 'as entered' : 'unchanged (as entered)'; }; return `<tr><td class="lft">${esc(lb)}</td><td>${v(A)}</td><td>${v(B)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="ad-grid">${[A, B].map(X => `<div><p class="note"><b>${esc(X.name)}</b>: plates</p><div class="tscroll"><table class="tbl"><thead><tr><th>x<sub>0</sub>–x<sub>1</sub> (ft)</th><th>t<sub>w</sub></th><th>b<sub>t</sub> × t<sub>t</sub></th><th>b<sub>b</sub> × t<sub>b</sub></th></tr></thead><tbody>${segs(X).map(q => `<tr><td>${fmt(q.x0, 2)}–${fmt(q.x1, 2)}</td><td>${fmt(q.tw, 4)}</td><td>${fmt(q.topB, 2)} × ${fmt(q.topT, 4)}</td><td>${fmt(q.botB, 2)} × ${fmt(q.botT, 4)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div>
      <p class="note">Green: the better of the two (lower); red: the worse. The current design's full check is this run's (the Apply button writes the candidate chosen in the list above).</p></div></section>`;
    return h;
  }
  function render(host, ctx) {
    css(); const P = ctx.P;
    let h = inputsHtml(P) + varsHtml(P, AD().settings(P)) + runBar(P);
    if (S.err) h += `<div class="alert err">${esc(S.err)}</div>`;
    if (S.R && !S.running) h += (S.key !== key(P) ? '<div class="alert">The project changed since this run: run again before applying.</div>' : '') + resultsHtml(P, S.R);
    host.innerHTML = h;
    const redraw = () => render(host, ctx), on = (sel, ev, f) => host.querySelectorAll(sel).forEach(el => el.addEventListener(ev, f));
    on('[data-ad]', 'change', e => { const a = ensure(P), id = e.target.dataset.ad, val = e.target.value, path = id.split('.'), o = path.length > 1 ? a[path[0]] : a, k = path[path.length - 1];
      o[k] = val === 'true' ? true : val === 'false' ? false : val;
      setTimeout(() => { if (ctx.changed) ctx.changed(false); else redraw(); }, 0); });   // after the event (a change fires on blur, while a click is under way)
    on('#ad_run', 'click', () => { S.running = true; S.stop = false; S.err = ''; S.R = null; S.sel = 0; S.cmp = ['cur', '0']; S.prog = { f: 0, msg: 'Starting…' }; const k = key(P); redraw();
      AD().runChunked(JSON.parse(JSON.stringify(P)), {}, p => { S.prog = p; const bar = host.querySelector('.ad-bar>div'), nt = host.querySelector('.ad-bar + .note'); if (bar) bar.style.width = Math.round(100 * (p.f || 0)) + '%'; if (nt) nt.textContent = p.msg || ''; }, () => S.stop)
        .then(R => { S.running = false; S.prog = R ? null : { f: 0, msg: 'Stopped.' }; S.R = R; S.key = k; redraw(); })
        .catch(e => { S.running = false; S.prog = null; S.err = 'Auto design failed: ' + (e && e.message); redraw(); }); });
    on('[data-adv]', 'change', e => { const a = ensure(P), path = e.target.dataset.adv, j = path.lastIndexOf('.'), key = path.slice(0, j), fld = path.slice(j + 1), val = e.target.value;
      a.vars = a.vars || {};
      if (fld === 'mode' && val === '') delete a.vars[key];   // a field piece "as all pieces": its own entry removed
      else { a.vars[key] = a.vars[key] || {}; a.vars[key][fld] = val; }
      setTimeout(() => { if (ctx.changed) ctx.changed(false); else redraw(); }, 0); });
    on('[data-adcmp]', 'change', e => { const v = e.target.value, i = +e.target.dataset.adcmp; S.cmp[i] = v; redraw(); });
    on('#ad_stop', 'click', () => { S.stop = true; });
    on('[data-adsel]', 'click', e => { if (e.target.closest('[data-adgo]')) return; S.sel = +e.currentTarget.dataset.adsel; redraw(); });
    on('[data-adgo]', 'click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${e.currentTarget.dataset.adgo}"]`); if (b) b.click(); });
    on('#ad_apply', 'click', () => { const c = S.R && S.R.cands[S.sel]; if (!c) return; if (S.key !== key(P) && !confirm('The project changed since this run. Apply anyway?')) return;
      const r = AD().apply(P, c); ['autodesign', ...AD().APPLY_KEYS].forEach(k => { if (r.project[k] === undefined) delete P[k]; else P[k] = r.project[k]; }); S.R = null; if (ctx.changed) ctx.changed(true); else redraw(); });
    on('#ad_undo', 'click', () => { const Q = AD().undo(P); if (!Q) return; ['autodesign', ...AD().APPLY_KEYS].forEach(k => { if (Q[k] === undefined) delete P[k]; else P[k] = Q[k]; }); if (ctx.changed) ctx.changed(true); else redraw(); });
  }
  window.SBDAutoDesignUI = { render };
})();
