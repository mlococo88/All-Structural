/* apps/steel-bridge/ui/autodesign.js — the Auto design input tab (its settings and Run; ADIN, 2026-11-09) and the Auto design output tab
   (the results) (window.SBDAutoDesignUI), from engine/autodesign.js. Classic script.
   Needs SharedSteps, SharedUnits, SBDModel, SBDAutoDesign and every module the full check runs (see engine/autodesign.js).

   One panel: the inputs (saved in the project, P.autodesign: mode, objective, the designs to list (topN), the price list, the limits, the
   change to check; the girder counts studied are the girder count variable's, in the design variables table), Run with progress and Stop (the search runs a trial at a time with setTimeout, so the page stays responsive), the ranked list of
   candidates (each passing every module on the full check), and Apply with one-step Undo (the design before Apply is kept in
   P.autodesign.undo). The result itself lives in memory for this page view.

   inputs(P) / wire(host, ctx) for the input tab; render(host, ctx) for the output tab, ctx = { P (project), g (girder index), changed(redraw)
   (the project was changed: autosave and redraw) } */
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
      .ad-spr .fRow{flex-wrap:wrap;} .ad-spr .unit{flex:1 1 220px;} .ad-cmp td,.ad-cmp th{padding:2px 8px;} .ad-cmp .ad-better{background:#e7f4ec;} .ad-cmp .ad-worse{background:#fbe1dd;}
      #inPanes .ad-vars{min-width:640px;}   /* ADIN: on the narrow input panel the variables table scrolls sideways in its .tscroll rather than squeezing the notes */
      .ad-sum{margin:4px 0;font-size:9pt;} .ad-sum b{font-weight:600;} .ad-chips{display:flex;flex-wrap:wrap;gap:3px 4px;margin:2px 0 6px;}
      .ad-chip{display:inline-block;padding:0 6px;border:1px solid #cbd5e1;border-radius:10px;font-size:8.5pt;color:#334155;text-decoration:none;background:#fff;line-height:1.6;}
      .ad-chip.m-auto{border-color:#93c5fd;background:#eff6ff;} .ad-chip.m-lock{border-color:#cbd5e1;background:#f1f5f9;} .ad-chip.m-range{border-color:#fcd34d;background:#fffbeb;} .ad-chip:hover,.ad-chip:focus{outline:2px solid #2563EB;outline-offset:1px;}
      dialog#adVarsDlg{width:min(1100px,90vw);max-width:1100px;max-height:90vh;padding:0;border:1px solid #94a3b8;border-radius:8px;box-shadow:0 12px 40px rgba(15,23,42,.35);overflow:hidden;}
      dialog#adVarsDlg[open]{display:flex;flex-direction:column;} dialog#adVarsDlg::backdrop{background:rgba(15,23,42,.45);}
      #adVarsDlg .ad-dh{display:flex;align-items:center;gap:10px;justify-content:space-between;padding:10px 14px;border-bottom:1px solid #e2e8f0;background:#f8fafc;}
      #adVarsDlg .ad-dh h2{margin:0;font-size:12pt;font-family:var(--font-ui);} #adVarsDlg .ad-db{overflow:auto;padding:8px 14px 14px;flex:1 1 auto;}
      #adVarsDlg tr.ad-hit td{background:#FFF7D6;} #adVarsDlg .ad-vars{min-width:760px;}   /* a narrow screen: the table scrolls sideways inside the dialog */
      @media (max-width:700px){ dialog#adVarsDlg{width:100vw;max-width:none;height:100dvh;max-height:none;margin:0;border-radius:0;border:none;} }
      .ad-warn{display:inline-block;background:#FEF3C7;color:#92400E;border:1px solid #F59E0B;border-radius:3px;padding:0 4px;font-weight:600;font-size:8pt;margin-left:4px;} .alert.ad-wn{border-left-color:#F59E0B;background:#FFFBEB;} .ad-ck{display:flex;gap:6px;align-items:flex-start;margin:4px 0;} .ad-ck input{width:auto;margin-top:3px;}`;
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
      ${num('topN', 'Designs to list', v(a, 'topN', D.topN), '')}
      ${s.mode === 'check' ? num('change.nb', 'Change: girder count', v(a.change, 'nb', ''), '', `now ${(P.xs || {}).nb}`) + num('change.D', 'Change: web depth D', v(a.change, 'D', ''), 'in', `now ${AD().layoutOf(P).D}`) : ''}</div>
      <p class="note"><b>Designs to list:</b> Auto design ranks every trial by the objective, then runs the full check on the best ones until this many pass every module; pick one and Apply.${s.mode === 'new' ? ` The girder counts studied are set by the <b>Girder count N<sub>b</sub></b> row of the design variables (now ${esc(AD().nbList(P, s).join(', '))}).` : ''}</p>
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
      <div class="ad-ck"><input type="checkbox" id="limits.depthWarn" data-ad="limits.depthWarn"${s.lim.depthWarn ? ' checked' : ''}><label for="limits.depthWarn">Span-to-depth guidance (AASHTO 2.5.2.6.3) as warning only<span class="note"> — default on: optional guidance in the code. A candidate shallower than Table 2.5.2.6.3-1 is listed with a WARNING, not rejected, and the depth search is not limited by it (with "Minimum depth: Not applied" it is not checked at all).</span></label></div>
      <div class="ad-ck"><input type="checkbox" id="limits.propWarn" data-ad="limits.propWarn"${s.lim.propWarn ? ' checked' : ''}><label for="limits.propWarn">6.10.2 proportion limits as warning only (D/t<sub>w</sub>, b<sub>f</sub>/2t<sub>f</sub>, b<sub>f</sub> ≥ D/6, t<sub>f</sub> ≥ 1.1t<sub>w</sub>, I<sub>yc</sub>/I<sub>yt</sub>)<span class="note"> — default off: mandatory provisions (6.10.2), enforced. When on, a candidate that misses one is listed with a WARNING, not rejected. The Flexure tab's own checks GS1–GS3 are not changed: they still report FAIL, so an applied candidate shows the failure there. The engineer is responsible for any design that does not meet 6.10.2.</span></label></div>
      <p class="note">Owner: ${esc(s.owner)}. ${Object.entries(s.cite).filter(([, c]) => c && !/default|entered/.test(c)).map(([k, c]) => `${esc(k)}: ${esc(c)}`).join('; ') || 'No owner plate rules (AASHTO).'}
        Width rules: constant in a field piece; at a field splice wide enough for the splice bolts (DT10, the Splices tab bolts and the owner's edge distance), or one gage line where that is lighter (the objective decides).</p>
      </div></section>`;
  }
  /* SB-2 PR 3 (2026-11-13): girder types (engineer decision SB-2, 2026-11-12). scopes(P): the choices of the "Design" select: 'each' (every
     type, one run after the other, each sized for its worst assigned line), 'sel' (the type selected on the Girders & plates tab only),
     'together' (one plate design on every plate girder: run(P) exactly as before girder types; offered only for a project saved before
     girder types, i.e. with no line assigned, where it is the default). scopeOf(P): this page view's choice (S.scope, not saved) when it
     is one of them, else the first. A project with one type and assigned lines: 'each' (that type on its lines), no select. */
  const scopes = P => { const n = (P.girders || []).length, typed = AD().typeScope(P) === 'each'; return typed ? (n > 1 ? ['each', 'sel'] : ['each']) : (n > 1 ? ['together', 'each', 'sel'] : ['together']); };
  const scopeOf = P => { const L = scopes(P); return L.includes(S.scope) ? S.scope : L[0]; };
  const tyLab = (P, t) => { const g = P.girders[t] || {}, M = window.SBDModel, L = M.typeLines ? M.typeLines(P, t) : []; return `${g.label || g.id}${L.length ? ` (${L.map(j => 'G' + (j + 1)).join(', ')})` : ''}`; };
  const lockLab = P => ((P.girders || []).length > 1 ? AD().TYPE_LOCK : ['nb']).map(id => (AD().VARS.find(v => v.id === id) || { label: id }).label);
  function scopeHtml(P, gi) {
    const L = scopes(P), sc = scopeOf(P), o = (v, t) => L.includes(v) ? `<option value="${v}"${sc === v ? ' selected' : ''}>${esc(t)}</option>` : '';
    const sel = L.length > 1 ? `<div class="fRow"><label for="ad_scope">Design</label><select id="ad_scope">${o('together', 'One plate design for every plate girder (as before girder types)')}${o('each', 'Every girder type, each for its worst line')}${o('sel', `The selected type only: ${tyLab(P, Math.min(gi || 0, P.girders.length - 1))}`)}</select></div>` : '';
    return sel + (sc !== 'together' ? `<p class="note" id="ad_scopeNote">Each girder type is designed on its own lines: each line a plate girder of the run with that line's loads and distribution factors, so the worst line governs every check. Locked at the current values in this mode (${(P.girders || []).length > 1 ? 'one design of the bridge for every type' : 'a new girder count would change the lines, which you assign'}): ${lockLab(P).map(l => window.SBDSub.html(l)).join('; ')}. ${(P.girders || []).length > 1 ? 'The plates (D, t<sub>w</sub>, flanges, transitions) are each type\'s own, with the locks and ranges set below; Apply writes the type\'s plates only.' : 'Every other variable as set below.'}</p>` : '');
  }
  function runBar(P, gi) {
    const IE = window.SBDInputCheck ? window.SBDInputCheck.collect(P).errors : [];   // SBINV (2026-11-10): Run is refused while an input error exists
    return `<section class="sec"><div class="secBody">${IE.length ? `<div class="alert err" id="ad_blocked">Auto design cannot run: ${IE.length} input${IE.length > 1 ? 's need' : ' needs'} fixing first (marked in red on their tabs and listed above the results).</div>` : ''}
      ${scopeHtml(P, gi)}<div class="fRow"><button type="button" class="primary" id="ad_run"${S.running || IE.length ? ' disabled' : ''}>Run Auto design</button><button type="button" id="ad_stop"${S.running ? '' : ' disabled'}>Stop</button>
</div>
      ${bar()}<p class="note">The candidates, Apply and Undo the last Apply are on the <a href="#" data-adout="1">Auto design output tab</a>.</p></div></section>`;
  }
  /* ---------- the design variables (P.autodesign.vars; engine/autodesign.js VARS): Lock / Range / Auto for every sizable input ---------- */
  const frc = v => { const n = Math.round(+v * 16), w = Math.floor(n / 16), r = n % 16; if (!isFinite(n)) return '—'; if (!r) return String(w); let a = r, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return `${w ? w + ' ' : ''}${a}/${b}`; };
  const supsOf = P => { const s = [0]; (P.spans.lengths || []).forEach(L => s.push(s[s.length - 1] + +L)); return s; };
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
      case 'trans': return `${AD().transitions(L)} per girder`;
      case 'spl': { const sp = supsOf(P), list = k == null ? L.spl : L.spl.filter(x => x > sp[k] + 1e-9 && x < sp[k + 1] - 1e-9); return list.length ? list.map(x => fmt(x, 2)).join(', ') + ' ft' : 'none'; }
      case 'splPl': return P.splices && P.splices.auto === false ? 'plates entered' : 'auto-design'; case 'tsSp': return (st.layout || {}).mode === 'bays' ? 'per bay' : `${fmt(+(st.layout || {}).doRatio || 1, 2)}`;
      case 'tsA_b': return T.A ? `${fmt(+T.A.bt, 2)} in` : ''; case 'tsA_t': return T.A ? `${frc(T.A.tp)} in` : ''; case 'tsB_b': return T.B ? `${fmt(+T.B.bt, 2)} in` : ''; case 'tsB_t': return T.B ? `${frc(T.B.tp)} in` : '';
      case 'bsA_n': return B.A ? String(B.A.np) : ''; case 'bsA_b': return B.A ? `${fmt(+B.A.bt, 2)} in` : ''; case 'bsA_t': return B.A ? `${frc(B.A.tp)} in` : '';
      case 'bsB_n': return B.B ? String(B.B.np) : ''; case 'bsB_b': return B.B ? `${fmt(+B.B.bt, 2)} in` : ''; case 'bsB_t': return B.B ? `${frc(B.B.tp)} in` : '';
      case 'scP': case 'scN': { const Z = (P.studs || {}).zones || []; return Z.length ? `${Z.length} zones entered` : 'from the analysis (span tenths)'; }
      case 'cf': return (((P.crossframes || {}).mem || {}).top || {}).sec || ''; case 'weld': return P.welds && P.welds.w !== '' && P.welds.w != null ? `${frc(P.welds.w)} in` : 'Table 6.13.3.4-1 minimum';
      default: return '';
    }
  }
  function rowsHtml(P, s) {
    const a = ensure(P), VV = a.vars || {}, L = AD().layoutOf(P), MODE = { auto: 'Auto', lock: 'Lock', range: 'Range' };
    const sel = (key, q, V, inherit) => { const e = VV[key]; if (q.forced) return `<span class="ad-lk" title="${esc(q.forced)}">Lock</span>`;
      const cur = inherit && !(e && e.mode) ? '' : q.mode;
      return `<select data-adv="${esc(key)}.mode" aria-label="${esc(V.label)}${inherit ? ' ' + key.split('#')[1] : ''}: mode">${inherit ? `<option value=""${cur === '' ? ' selected' : ''}>${V.span ? 'as all spans' : 'as all pieces'}</option>` : ''}${V.only.map(m => `<option value="${m}"${cur === m ? ' selected' : ''}>${MODE[m]}</option>`).join('')}</select>`; };
    const box = (key, k, q, V) => q.mode !== 'range' || q.forced || (key.includes('#') && !(VV[key] && VV[key].mode)) ? '<td></td>' : `<td><input type="text" data-adv="${esc(key)}.${k}" value="${esc((VV[key] || {})[k] != null ? VV[key][k] : '')}" placeholder="${k === 'step' ? 'step' : k}" aria-label="${esc(V.label)}: ${k}" size="5"></td>`;
    const winBox = (key, q, V) => V.span && !key.includes('#') && q.mode === 'range' && !q.forced ? `<div class="fRow"><label for="ad_win">Station windows</label><input type="text" id="ad_win" data-adv="${esc(key)}.win" value="${esc((VV[key] || {}).win || '')}" placeholder="e.g. 70-90, 135-150" aria-label="${esc(V.label)}: station windows" style="width:14em"><span class="unit">none: anywhere in the span</span></div>` : '';
    const row = (V, key, q, label, inherit, k) => `<tr${q.forced ? ' class="ad-fx"' : ''}><td class="lft">${esc(label)}</td><td>${sel(key, q, V, inherit)}</td>${box(key, 'min', q, V)}${box(key, 'max', q, V)}${V.step ? box(key, 'step', q, V) : '<td></td>'}<td class="lft">${esc(curVal(P, V.id, k))}</td><td class="lft nt">${esc(q.forced || (inherit ? '' : V.note || ''))}${winBox(key, q, V)}</td></tr>`;
    let grp = '', h = '';
    AD().VARS.forEach(V => { if (V.grp !== grp) { grp = V.grp; h += `<tr class="ad-grp"><th colspan="7" class="lft">${esc(grp)}</th></tr>`; }
      const q = s.V[V.id]; h += row(V, V.id, q, V.label, false);
      if (V.piece && !q.forced) h += `<tr><td colspan="7" class="lft"><details class="ad-pc"${L.web.some((p, k) => VV[`${V.id}#${k + 1}`]) ? ' open' : ''}><summary>${esc(V.label)} per field piece</summary><table class="tbl"><tbody>${L.web.map((p, k) => { const key = `${V.id}#${k + 1}`, qk = s.V[key] || { ...q, mode: q.mode };
        return row(V, key, qk, `Field piece ${k + 1} (${fmt(p.x0, 2)} to ${fmt(p.x1, 2)} ft)`, true, k); }).join('')}</tbody></table></details></td></tr>`;
      if (V.span && !q.forced && q.mode !== 'lock') { const sp = supsOf(P); h += `<tr><td colspan="7" class="lft"><details class="ad-pc"${P.spans.lengths.some((_, k) => VV[`${V.id}#${k + 1}`]) ? ' open' : ''}><summary>Field splice locations: each span on its own</summary><table class="tbl"><tbody>${P.spans.lengths.map((Ls, k) => { const key = `${V.id}#${k + 1}`, qk = s.V[key] || { ...q, mode: q.mode };
        return row(V, key, qk, `Span ${k + 1} (${fmt(sp[k], 2)} to ${fmt(sp[k + 1], 2)} ft)`, true, k); }).join('')}</tbody></table></details></td></tr>`; }
 });
    return h;
  }
  function varsHtml(P, s) {
    const a = ensure(P);
    const nA = AD().VARS.filter(V => s.V[V.id].mode === 'auto').length, nL = AD().VARS.filter(V => s.V[V.id].mode === 'lock').length, nR = AD().VARS.length - nA - nL;
    return `<section class="sec"><div class="secHead">Auto design: design variables</div><div class="secBody">
      <p class="note">Every input Auto design can size: <b>Auto</b> sizes it (within the limits above, the owner's plate rules and the code checks), <b>Lock</b> keeps the project's current value, <b>Range</b> sizes it between min and max (and on the step, where asked). ${nA} Auto, ${nL} Lock, ${nR} Range. Default Auto; Lock where the tab's own automatic choice is off (stud zones or a weld size entered, splice auto-design off); the field splice locations default to Lock (the stations entered), Auto and Range only in New design. <span class="ad-lk">Lock</span> alone: an input Auto design does not size (the note says why). Details (stiffeners, studs, cross-frames, welds, splice plates) are sized on each finalist, on its own analysis, before its full check.</p>
      <div class="fRow"><label for="ohSym">Overhangs</label><select id="ohSym" data-ad="ohSym"><option value="sym"${s.ohSym !== 'asym' ? ' selected' : ''}>Symmetric (left = right)</option><option value="asym"${s.ohSym === 'asym' ? ' selected' : ''}>Left and right sized apart</option></select><span class="unit">the right one only when a plate girder stands on the right fascia line</span></div>
      <div class="fRow"><label for="ohMin">Minimum overhang</label><input type="text" id="ohMin" data-ad="ohMin" value="${esc(a.ohMin !== undefined ? a.ohMin : s.ohMin)}" placeholder="2.5" size="5"><span class="unit">ft (saved with the project; blank 2.5 ft). Auto and Range never go below it (a Range min below it is raised to it); Lock keeps the project's overhang; the owner's limits (RIDOT 9.4.1.4, CTDOT 9.7.1.5) still apply on top.</span></div>
      ${summaryHtml(P, s)}</div></section>`;
  }
  /* ADVD (2026-11-09, engineer: "Can the auto design design variables open in a pop-up window?"): the variables table and the field splice
     placement rules are drawn in a dialog (varsDialog), not in the narrow input panel; the panel keeps a summary (one line per group and a chip
     per variable, each chip opening the dialog at its row) and the Edit buttons. Same inputs, data attributes and handlers as before: the
     dialog writes P.autodesign.vars / .splRules live, as the panel did. */
  function varsTableHtml(P, s) {
    return `<div class="tscroll"><table class="tbl ad-vars"><thead><tr><th class="lft">Variable</th><th>Mode</th><th>Min</th><th>Max</th><th>Step</th><th class="lft">Now</th><th class="lft">How it is sized</th></tr></thead><tbody>${rowsHtml(P, s)}</tbody></table></div>${splRulesBox(P, s, s.V.spl)}`;
  }
  /* the panel's summary: one line per group (its modes counted) with a chip per variable (a link to its row in the dialog), the splice rules line */
  function summaryHtml(P, s) {
    const MODE = { auto: 'Auto', lock: 'Locked', range: 'Range' }, grps = [];
    AD().VARS.forEach(V => { let g = grps.find(q => q.n === V.grp); if (!g) grps.push(g = { n: V.grp, v: [] }); g.v.push(V); });
    const cnt = vs => ['auto', 'lock', 'range'].map(m => [m, vs.filter(V => s.V[V.id].mode === m).length]).filter(q => q[1]).map(([m, n]) => `${n} ${MODE[m]}`).join(', ');
    const spr = ((P.autodesign || {}).splRules) || {}, nSet = Object.keys(spr).filter(k => spr[k] !== '' && spr[k] != null).length;
    return `<div class="ad-sum">${grps.map(g => `<div><b>${esc(g.n)}:</b> ${cnt(g.v)}</div><div class="ad-chips">${g.v.map(V => { const q = s.V[V.id], m = q.forced ? 'lock' : q.mode;
        return `<a href="#" class="ad-chip m-${m}" data-advgo="${esc(V.id)}" title="${esc(V.label)}: ${MODE[m]}${q.forced ? ' (fixed)' : ''}. Click to edit.">${window.SBDSub.html(V.label)}: ${MODE[m]}</a>`; }).join('')}</div>`).join('')}</div>
      <div class="fRow"><button type="button" class="primary" data-advgo="" id="ad_vars_edit">Edit design variables…</button></div>
      ${s.splR ? `<p class="note">Field splice placement rules: ${nSet ? `${nSet} entered, the others` : 'all'} at their defaults. <a href="#" data-advgo="#spr">Edit…</a></p>` : ''}`;
  }
  /* the field splice placement rules (P.autodesign.splRules; engine/splplace.js rules): each input with its default and where it comes from */
  function splRulesBox(P, s, q) {
    const R = s.splR; if (!R) return '';
    const a = ((P.autodesign || {}).splRules) || {}, f = (k, lbl, unit) => `<div class="fRow"><label for="spr_${k}">${lbl}</label><input type="text" id="spr_${k}" data-ad="splRules.${k}" value="${esc(a[k] != null ? a[k] : '')}" placeholder="${esc(fmt(R[k], k === 'shipWt' ? 1 : 2))}" size="5"><span class="unit">${unit}; ${esc(R.src[k] === 'entered' ? 'entered' : 'blank: ' + R.src[k])}</span></div>`;
    return `<details class="ad-pc ad-spr"${q.mode !== 'lock' ? ' open' : ''}><summary>Field splice placement rules (the splice variable's Auto and Range; blank = the default shown grey)</summary>
      ${f('shipLen', 'Maximum shipping piece length', 'ft')}${f('shipWt', 'Maximum shipping piece weight', 'kip')}${f('minLen', 'Minimum piece length', 'ft')}
      ${f('minSup', 'Minimum distance from a bearing', 'ft')}${f('minXf', 'Minimum distance from a cross-frame / connection plate', 'ft')}${f('minTr', 'Minimum distance from a flange transition', 'ft')}
      <p class="note">Owner ${esc(R.owner)}.${R.mand ? ` A piece longer than ${fmt(R.mand, 0)} ft fails (${esc(R.cite.mand)}: field splice mandatory).` : ''}${R.q != null ? ` Simple spans: splices at the quarter points (${esc(R.cite.q)}).` : ''} Location: ${esc(R.cite.loc)}. Lock keeps the stations entered and does not apply these rules.</p></details>`;
  }
  /* ADWN (2026-11-09): the amber WARNING flag of a candidate that misses a limit set to "warning only" (c.propWarns), next to its governing ratio
     (the ratio is of the enforced checks; the flag shows the largest warned ratio so it is not hidden) and in the What governs column */
  const wFlag = c => (c.propWarns || []).length ? ` <span class="ad-warn" title="${esc(c.propWarns.map(w => `${w.label}: ${fmt(w.r, 3)}`).join('; '))}">WARNING ${fmt(Math.max(...c.propWarns.map(w => w.r)), 3)}</span>` : '';
  const wTxt = c => (c.propWarns || []).length ? `; <span class="ad-warn">WARNING</span> ${c.propWarns.map(w => esc(`${w.label} ${fmt(w.r, 3)}`)).join('; ')}` : '';
  // SBDIA (2026-11-10): with a diaphragm as the intermediate bracing the module reads "diaphragms" (display only; DIA set by render)
  let DIA = false; const modTxt = m => DIA && m === 'cross-frames' ? 'diaphragms' : m;
  const govTxt = g => g ? `${esc(modTxt(g.mod))} ${esc(g.id)}${g.x != null ? `, x = ${fmt(g.x, 2)} ft` : ''}${g.gl ? `, ${esc(g.gl)}` : ''}` : '—';
const ohT = X => { const o = X && X.oh; return o ? `${fmt(o.L, 2)}${Math.abs(o.R - o.L) > 1e-9 ? ' / ' + fmt(o.R, 2) : ''}` : 'as now'; };
  /* diffFrom(c, c1): what candidate c changes against candidate #1 (c1), in words, for the list's "Differs from #1" column (2026-11-02, display
     only): girder count, depth, overhangs, field splice stations, splice gage lines, web and flange plates (thicknesses, widths, cut points),
     and each sized detail (det.rows, by label). '' = nothing listed here differs. */
  const diffFrom = (c, c1) => {
    if (!c1 || c === c1) return '';
    const A = c.L, B = c1.L, J = v => JSON.stringify(v), out = [];
    if (A.nb !== B.nb) out.push(`N_b ${A.nb}`); if (Math.abs(A.D - B.D) > 1e-9) out.push(`D ${fmt(A.D, 2)} in`);
    if (J(A.oh || null) !== J(B.oh || null)) out.push(`overhang ${ohT(A)} ft`);
    if (J(A.spl) !== J(B.spl)) out.push('splice stations');
    if ((A.minLines || null) !== (B.minLines || null)) out.push(`gage lines at the splices (${A.minLines || 'as set'} vs ${B.minLines || 'as set'})`);
    if (J(A.web.map(p => [p.x0, p.x1, p.tw])) !== J(B.web.map(p => [p.x0, p.x1, p.tw]))) out.push('web plates');
    ['top', 'bot'].forEach(f => { const za = A[f] || [], zb = B[f] || [], nm = f === 'top' ? 'top' : 'bottom';
      if (J(za.map(z => [z.x0, z.x1])) !== J(zb.map(z => [z.x0, z.x1]))) out.push(`${nm} flange transitions`);
      else if (J(za.map(z => [z.b, z.t])) !== J(zb.map(z => [z.b, z.t]))) out.push(`${nm} flange plates`); });
    const ra = (c.det && c.det.rows) || [], rb = (c1.det && c1.det.rows) || [];
    ra.forEach(r => { const q = rb.find(x => x.label === r.label); if (!q || q.value !== r.value) out.push(r.label.toLowerCase()); });
    return out.length ? out.join('; ') : 'nothing listed here (same plates and details)';
  };
  /* the weight shown (SB-2 PR 3): a run of all girders, as before; a girder type's run (S.wty = { n: its lines }): the steel of its lines,
     the run's weight (a girder line × N_b, costOf) / N_b × n (display only; the ranking is the run's own) */
  const wOf = (w, L) => S.wty && L && L.nb ? w / L.nb * S.wty.n : w, wHead = () => S.wty ? `its ${S.wty.n} line${S.wty.n > 1 ? 's' : ''}` : 'all girders';
  function resultsHtml(P, R) {
    const c0 = R.current, cls = r => r > 0.95 ? 'ad-hi' : 'ad-ok';
    let h = `<section class="sec"><div class="secHead">Candidates (ranked by ${esc({ weight: 'steel weight', depth: 'web depth', cost: 'cost' }[R.S.objective])})</div><div class="secBody">`;
    if (R.note) h += `<div class="alert">${esc(R.note)}</div>`;
    if (R.spl) h += `<p class="note"><b>Field splice layouts sized</b> (the splice variable, ${esc(R.S.V.spl.mode)}): ${R.spl.lays.map((l, i) => `${i + 1}. ${l.spl.map(x => fmt(x, 2)).join(', ') || 'none'} ft (${esc(l.how)})`).join('; ') || 'none'}. The rule's stations (contraflexure on ${esc(R.spl.gl || '')}): ${(R.spl.ref ? R.spl.ref.spl : []).map(x => fmt(x, 2)).join(', ') || 'none'} ft.</p>`;
    h += `<div class="tscroll"><table class="tbl ad-list"><thead><tr><th>#</th><th>N<sub>b</sub></th><th>D (in)</th><th>Weight (lb, ${wHead()})</th><th>Cost ($)</th><th>Transitions</th><th>Splices</th><th>Gage lines</th><th>Overhang (ft)</th><th>Governing ratio</th><th class="lft">What governs</th><th class="lft">Differs from #1 in</th></tr></thead><tbody>
      <tr class="ad-cur"><td>now</td><td>${c0.L.nb}</td><td>${fmt(c0.L.D, 2)}</td><td>${fmt(wOf(c0.cost.w, c0.L), 0)}</td><td>${fmt(c0.cost.total, 0)}</td><td>${c0.cost.nTr}</td><td>${c0.cost.nSpl}</td><td></td><td>${fmt(+(P.xs || {}).ohL, 2)}${Math.abs(+(P.xs || {}).ohR - +(P.xs || {}).ohL) > 1e-9 ? ' / ' + fmt(+(P.xs || {}).ohR, 2) : ''}</td><td>${c0.E ? fmt(c0.E.ratio, 3) : ''}</td><td class="lft">current design${c0.E && !c0.E.pass ? ' (fails the screen)' : ''}</td><td></td></tr>
      ${R.cands.map((c, i) => `<tr data-adsel="${i}"${i === S.sel ? ' class="sel"' : ''}><td>${i + 1}</td><td>${c.nb}</td><td>${fmt(c.D, 2)}</td><td>${fmt(wOf(c.cost.w, c.L), 0)}</td><td>${fmt(c.cost.total, 0)}</td><td>${c.nTr}</td><td>${c.nSpl}</td><td>${c.minLines || 'as set'}</td><td>${ohT(c.L)}</td>
        <td class="${cls(c.ratio)}">${fmt(c.ratio, 3)}${wFlag(c)}</td><td class="lft">${c.gov && c.gov.tab ? `<a href="#" data-adgo="${esc(c.gov.tab)}" title="Open the ${esc(DIA && c.gov.tab === 'cf' ? 'Diaphragms' : TABN[c.gov.tab] || '')} tab">${govTxt(c.gov)}</a>` : govTxt(c.gov)}${c.gov ? `: ${esc(c.gov.title)}` : ''}${wTxt(c)}</td><td class="lft">${i ? esc(diffFrom(c, R.cands[0])) : '—'}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">Every candidate listed passed every module on the full check (the analysis with its own stiffness; flexure, shear and stiffeners, fatigue and studs, constructibility, cross-frames, field splices, rating, welds; ${S.wty && S.wty.det ? 'the details as entered: with several girder types they are not re-sized' : 'its details sized first'})${R.cands.some(c => (c.propWarns || []).length) ? ', except the limits set to "as warning only" on the input tab: a candidate with a <span class="ad-warn">WARNING</span> misses one of them (the span-to-depth guidance, AASHTO LRFD 10th Ed. Art. 2.5.2.6.3, or a 6.10.2 proportion limit); its governing ratio is that of the checks enforced, and the flag gives the largest warned ratio' : ''}. ${R.rejected.length ? `${R.rejected.length} finalist(s) failed the full check and were dropped (below).` : ''}${(R.twins || []).length ? ` ${R.twins.length} one-gage-line design${R.twins.length > 1 ? 's' : ''} not listed: the same plates, transitions and splices as a listed design with the splices' own gage lines, and no saving in weight or cost (N<sub>b</sub> ${R.twins.map(t => `${t.nb}, D ${fmt(t.D, 2)} in`).join('; ')}).` : ''} Click a row for its plates and steps.</p></div></section>`;
    const c = R.cands[S.sel];
    if (c) {
      h += `<section class="sec"><div class="secHead">Candidate ${S.sel + 1}: plates</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>x<sub>0</sub> (ft)</th><th>x<sub>1</sub> (ft)</th><th>D</th><th>t<sub>w</sub></th><th>b<sub>t</sub></th><th>t<sub>t</sub></th><th>b<sub>b</sub></th><th>t<sub>b</sub></th></tr></thead><tbody>
        ${c.segments.map(s => `<tr><td>${fmt(s.x0, 2)}</td><td>${fmt(s.x1, 2)}</td><td>${fmt(s.D, 3)}</td><td>${fmt(s.tw, 4)}</td><td>${fmt(s.topB, 2)}</td><td>${fmt(s.topT, 4)}</td><td>${fmt(s.botB, 2)}</td><td>${fmt(s.botT, 4)}</td></tr>`).join('')}</tbody></table></div>
        <p class="note">Field splices at ${c.L.spl.map(x => fmt(x, 2)).join(', ') || '(none)'} ft${c.spl ? ` (the splice variable: ${esc(c.spl.how)}; the rule's stations ${c.spl.ref.map(x => fmt(x, 2)).join(', ') || 'none'} ft; the placement steps are in the worked steps below)` : ''}. ${c.nb !== c0.L.nb ? `Girder count ${c0.L.nb} → ${c.nb}: equal spacing over the same out-to-out girder width, b<sub>eff</sub> from the tributary width (4.6.2.6.1). ` : ''}${c.minLines === 1 ? 'One gage line each side of the web at the splices (Splices tab, minimum bolt lines = 1). ' : ''}Apply writes these plates into every girder of the project.</p>
        ${c.det && (c.det.rows.length || c.det.notes.length) ? `<p class="note"><b>Details sized</b> on this candidate (its own analysis; each the least passing the tab's checks):</p><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Detail</th><th class="lft">Chosen</th><th class="lft">How</th></tr></thead><tbody>${c.det.rows.map(r => `<tr><td class="lft">${esc(r.label)}</td><td class="lft">${esc(r.value)}</td><td class="lft">${esc(r.how)}</td></tr>`).join('')}</tbody></table></div>${c.det.notes.map(n => `<div class="alert">${esc(n)}</div>`).join('')}` : ''}
        ${c.spl && c.spl.chk ? `<p class="note"><b>Field splice placement rules</b> (this candidate's plates and cross-frames):</p><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Rule</th><th>Ratio</th><th>OK</th></tr></thead><tbody>${c.spl.chk.map(q => `<tr><td class="lft">${esc(q.id)} ${esc(q.what)}</td><td>${isFinite(q.r) ? fmt(q.r, 3) : '—'}</td><td>${q.ok ? 'yes' : '<b>no</b>'}</td></tr>`).join('')}</tbody></table></div>` : ''}
        ${(c.propWarns || []).length ? `<div class="alert ad-wn"><span class="ad-warn">WARNING</span> listed, not rejected (Auto design settings, "as warning only"): ${c.propWarns.map(w => esc(`${w.label} (${w.ref}): ratio ${fmt(w.r, 3)}`)).join('; ')}.${c.propWarns.some(w => w.id !== 'depth') ? ' The Flexure tab still reports these 6.10.2 checks as FAIL after Apply.' : ''}</div>` : ''}
        ${c.warns.length ? `<div class="alert">Warnings (not failures): ${c.warns.map(w => esc(`${w.mod} ${w.id} ${w.title}`)).join('; ')}</div>` : ''}
        <div class="fRow"><button type="button" class="primary" id="ad_apply">Apply candidate ${S.sel + 1}</button></div></div></section>
        <section class="sec"><div class="secHead">Worked steps, candidate ${S.sel + 1}</div><div class="secBody"><ol class="steps">${c.steps.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${window.SBDSub.html(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${window.SBDSub.html(s.note)}</div>` : ''}</li>`).join('')}</ol></div></section>`;
    }
    h += compareHtml(P, R);
    if ((R.blocked || []).length) h += `<section class="sec"><div class="secHead">Blocked by detail checks (not passing candidates)</div><div class="secBody"><p class="note">These designs pass every check the plates control, but fail detail checks that the current design fails too, whatever the plates: ${esc(R.blockers.join(', '))}. Fix those inputs on their tabs and run again.</p><ul>${R.blocked.map(b => `<li>N<sub>b</sub> ${b.nb}, D ${fmt(b.D, 2)} in, ${fmt(wOf(b.cost.w, b.L), 0)} lb${b.minLines === 1 ? ', 1 gage line' : ''}: ${b.fails.map(f => esc(`${f.mod} ${f.id} ${f.title}`)).join('; ')}</li>`).join('')}</ul></div></section>`;
    if (R.rejected.length) h += `<section class="sec"><div class="secHead">Dropped at the full check</div><div class="secBody"><ul>${R.rejected.map(r => `<li>N<sub>b</sub> ${r.L.nb}, D ${fmt(r.L.D, 2)} in, ${fmt(wOf(r.cost.w, r.L), 0)} lb: ${r.fails.map(f => esc(`${f.mod} ${f.id} ${f.title}${isFinite(f.r) ? ` (${fmt(f.r, 3)})` : ''}`)).join('; ')}</li>`).join('')}</ul></div></section>`;
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
      ${line(`Steel weight, ${wHead()} (lb)`, wOf(A.cost.w, A.L), wOf(B.cost.w, B.L), true, true, v => fmt(v, 0))}${line('Cost ($)', A.cost.total, B.cost.total, true, true, v => fmt(v, 0))}
      ${line('Field splices (ft)', A.L.spl.map(x => fmt(x, 2)).join(', ') || 'none', B.L.spl.map(x => fmt(x, 2)).join(', ') || 'none', false)}${line('Field splices per girder', A.cost.nSpl, B.cost.nSpl, true, true, v => String(v))}
      ${line('Flange transitions per girder', A.cost.nTr, B.cost.nTr, true, true, v => String(v))}${line('Intermediate stiffeners per girder', A.cost.nStiff, B.cost.nStiff, true, true, v => String(v))}
      ${line('Governing ratio (full check)', A.ratio, B.ratio, true, true, v => isFinite(v) ? fmt(v, 3) : '—')}${line('What governs', gl(A.gov), gl(B.gov), false)}
      <tr class="ad-grp"><th colspan="3" class="lft">Governing ratio of each module (click: the tab with its steps)</th></tr>
      ${mods.map(m => { const a = modR(A, m), b = modR(B, m), f = q => q ? `${q.tab ? `<a href="#" data-adgo="${esc(q.tab)}">` : ''}${isFinite(q.r) ? fmt(q.r, 3) : 'fail'} ${esc(q.id)}${q.tab ? '</a>' : ''}` : '—';
        const ra = a ? a.r : NaN, rb = b ? b.r : NaN, cls = (x, y) => !isFinite(x) || !isFinite(y) || Math.abs(x - y) < 1e-9 ? '' : x < y ? ' class="ad-better"' : ' class="ad-worse"';
        return `<tr><td class="lft">${esc(DIA && m === 'cross-frames' ? 'Diaphragms' : MODN[m] || m)}</td><td${cls(ra, rb)}>${f(a)}</td><td${cls(rb, ra)}>${f(b)}</td></tr>`; }).join('')}
      <tr class="ad-grp"><th colspan="3" class="lft">Details</th></tr>
      ${[...new Set([...((A.det || {}).rows || []), ...((B.det || {}).rows || [])].map(r => r.label))].map(lb => { const v = X => { const r = ((X.det || {}).rows || []).find(q => q.label === lb); return r ? esc(r.value) : X.cur ? 'as entered' : 'unchanged (as entered)'; }; return `<tr><td class="lft">${esc(lb)}</td><td>${v(A)}</td><td>${v(B)}</td></tr>`; }).join('')}
      </tbody></table></div>
      <div class="ad-grid">${[A, B].map(X => `<div><p class="note"><b>${esc(X.name)}</b>: plates</p><div class="tscroll"><table class="tbl"><thead><tr><th>x<sub>0</sub>–x<sub>1</sub> (ft)</th><th>t<sub>w</sub></th><th>b<sub>t</sub> × t<sub>t</sub></th><th>b<sub>b</sub> × t<sub>b</sub></th></tr></thead><tbody>${segs(X).map(q => `<tr><td>${fmt(q.x0, 2)}–${fmt(q.x1, 2)}</td><td>${fmt(q.tw, 4)}</td><td>${fmt(q.topB, 2)} × ${fmt(q.topT, 4)}</td><td>${fmt(q.botB, 2)} × ${fmt(q.botT, 4)}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div>
      <p class="note">Green: the better of the two (lower); red: the worse. The current design's full check is this run's (the Apply button writes the candidate chosen in the list above).</p></div></section>`;
    return h;
  }
  /* ADIN (2026-11-09): the settings (the inputs, the design variables with Auto / Lock / Range, the limits and the owner's plate rules, Run)
     are on the Auto design INPUT tab (inputs + wire); the OUTPUT tab (render) keeps the results: the candidate list and ranking, each
     candidate's plates, details, checks and steps, the splice placement table, the compare view, Apply and Undo. Same fields, same
     handlers as before (P.autodesign); nothing computed changes. A link on each tab opens the other. */
  const bar = () => S.running || S.prog ? `<div class="ad-bar"><div style="width:${Math.round(100 * ((S.prog && S.prog.f) || 0))}%"></div></div><p class="note">${esc((S.prog && S.prog.msg) || '')}</p>` : '';
  /* inputs(P): the Auto design input tab's HTML */
  function inputs(P, gi) {
    css(); S.gi = gi || 0;
    return `<p class="note"><a href="#" data-adout="1">Results: Auto design output tab</a> (candidates, ranking, full checks, Apply).</p>` + inputsHtml(P) + varsHtml(P, AD().settings(P)) + runBar(P, gi)
      + (S.err ? `<div class="alert err">${esc(S.err)}</div>` : '');
  }
  /* ---------- the design variables dialog (ADVD) ---------- */
  let CUR = null;   // { P, ctx } of the last draw of the input tab: the dialog writes there and redraws through it
  const setAdv = (P, el) => { const a = ensure(P), path = el.dataset.adv, j = path.lastIndexOf('.'), key = path.slice(0, j), fld = path.slice(j + 1), val = el.value;   // as the panel's handler (unchanged)
    a.vars = a.vars || {};
    if (fld === 'mode' && val === '') delete a.vars[key];   // a field piece "as all pieces": its own entry removed
    else { a.vars[key] = a.vars[key] || {}; a.vars[key][fld] = val; } };
  const setAd = (P, el) => { const a = ensure(P), id = el.dataset.ad, val = el.type === 'checkbox' ? String(el.checked) : el.value, path = id.split('.'); if (path.length > 1 && !a[path[0]]) a[path[0]] = {}; const o = path.length > 1 ? a[path[0]] : a, k = path[path.length - 1];
    o[k] = val === 'true' ? true : val === 'false' ? false : val; };
  function dlg() {
    let d = document.getElementById('adVarsDlg'); if (d) return d;
    d = document.createElement('dialog'); d.id = 'adVarsDlg'; d.setAttribute('aria-labelledby', 'adVarsTitle');
    d.innerHTML = '<div class="ad-dh"><h2 id="adVarsTitle">Auto design: design variables</h2><button type="button" id="adVarsClose">Close</button></div><div class="ad-db" id="adVarsBody"></div>';
    document.body.appendChild(d);
    d.querySelector('#adVarsClose').addEventListener('click', () => d.close());
    d.addEventListener('close', () => { const b = document.getElementById('ad_vars_edit'); if (b) b.focus(); });
    d.addEventListener('change', e => { if (!CUR) return; const el = e.target;
      if (el.dataset.adv) setAdv(CUR.P, el); else if (el.dataset.ad) setAd(CUR.P, el); else return;
      setTimeout(() => { if (CUR.ctx.changed) CUR.ctx.changed(true); }, 0); });   // as the panel: after the event; the input tab redraws and wire() refreshes the dialog
    return d;
  }
  /* fill(): the dialog's table, keeping the focused input, the open per-piece lists and the scroll */
  function fill() {
    const d = document.getElementById('adVarsDlg'); if (!d || !CUR) return; const body = d.querySelector('#adVarsBody'), ae = document.activeElement;
    const fk = ae && body.contains(ae) ? (ae.dataset.adv ? `[data-adv="${ae.dataset.adv}"]` : ae.id ? '#' + ae.id : null) : null, top = body.scrollTop;
    const open = new Set([...body.querySelectorAll('details[open] > summary')].map(q => q.textContent));
    body.innerHTML = `<p class="note"><b>Auto</b> sizes the variable (within the limits on the input tab, the owner's plate rules and the code checks), <b>Lock</b> keeps the project's current value, <b>Range</b> sizes it between min and max. Changes are saved as you make them (Undo / Redo as usual).</p>` + varsTableHtml(CUR.P, AD().settings(CUR.P));
    body.querySelectorAll('details > summary').forEach(q => { if (open.has(q.textContent)) q.parentElement.open = true; });
    body.scrollTop = top; if (fk) { const el = body.querySelector(fk); if (el) el.focus({ preventScroll: true }); }
  }
  /* openVars(go): opens the dialog; go = a variable id (its row is shown and its mode focused), '#spr' (the splice rules) or '' */
  function openVars(go) {
    const d = dlg(); fill(); if (!d.open) d.showModal();
    const body = d.querySelector('#adVarsBody'); let el = null;
    if (go === '#spr') { const q = body.querySelector('.ad-spr'); if (q) { q.open = true; el = q.querySelector('input'); } }
    else if (go) { el = body.querySelector(`[data-adv="${go}.mode"]`) || body.querySelector(`[data-adv^="${go}#"]`); if (!el) { const r = [...body.querySelectorAll('tr')].find(t => (t.cells[0] || {}).textContent === ((AD().VARS.find(V => V.id === go) || {}).label)); el = r && r.cells[1]; } }
    if (el) { const tr = el.closest('tr'); body.querySelectorAll('tr.ad-hit').forEach(t => t.classList.remove('ad-hit')); if (tr) tr.classList.add('ad-hit'); el.scrollIntoView({ block: 'center' }); if (el.focus) el.focus({ preventScroll: true }); }
    else { const f = body.querySelector('select,input'); if (f) f.focus({ preventScroll: true }); }
  }
  /* wire(host, ctx): the input tab's handlers, after each draw. ctx = { P (project), changed(redraw), showOut() (opens the output tab),
     done() (redraws the input tab and the output tab when a run ends) } */
  function wire(host, ctx) {
    if (!host) return; const P = ctx.P, on = (sel, ev, f) => host.querySelectorAll(sel).forEach(el => el.addEventListener(ev, f));
    CUR = { P, ctx }; { const d = document.getElementById('adVarsDlg'); if (d && d.open) fill(); }   // ADVD: the open dialog follows the project (an edit, Undo, Redo)
    on('[data-advgo]', 'click', e => { e.preventDefault(); openVars(e.currentTarget.dataset.advgo); });
    const redraw = () => { if (ctx.done) ctx.done(); };
    on('[data-ad]', 'change', e => { const a = ensure(P), id = e.target.dataset.ad, val = e.target.type === 'checkbox' ? String(e.target.checked) : e.target.value, path = id.split('.'); if (path.length > 1 && !a[path[0]]) a[path[0]] = {}; const o = path.length > 1 ? a[path[0]] : a, k = path[path.length - 1];
      o[k] = val === 'true' ? true : val === 'false' ? false : val;
      setTimeout(() => { if (ctx.changed) ctx.changed(true); }, 0); });   // after the event (a change fires on blur, while a click is under way); true: the tab is drawn again (fields that depend on the mode)
    on('[data-adv]', 'change', e => { const a = ensure(P), path = e.target.dataset.adv, j = path.lastIndexOf('.'), key = path.slice(0, j), fld = path.slice(j + 1), val = e.target.value;
      a.vars = a.vars || {};
      if (fld === 'mode' && val === '') delete a.vars[key];   // a field piece "as all pieces": its own entry removed
      else { a.vars[key] = a.vars[key] || {}; a.vars[key][fld] = val; }
      setTimeout(() => { if (ctx.changed) ctx.changed(true); }, 0); });
    on('#ad_run', 'click', () => { const IE = window.SBDInputCheck ? window.SBDInputCheck.collect(P).errors : [];   // SBINV (2026-11-10): no run while an input error exists
      if (IE.length) { alert(`Auto design cannot run: ${IE.length} input${IE.length > 1 ? 's need' : ' needs'} fixing first.\n\n${IE.slice(0, 12).map(e => '- ' + e.msg).join('\n')}`); return; }
      S.running = true; S.stop = false; S.err = ''; S.R = null; S.RT = null; S.selT = null; S.sel = 0; S.cmp = ['cur', '0']; S.prog = { f: 0, msg: 'Starting…' }; const k = key(P); redraw(); if (ctx.showOut) ctx.showOut();
      const sc = scopeOf(P);
      if (sc !== 'together') {   // SB-2 PR 3: one run per type (its own project, typeProject), one after the other
        const T = sc === 'sel' ? [Math.min(S.gi || 0, P.girders.length - 1)] : P.girders.map((_, t) => t), out = [];
        const one = i => { if (i >= T.length) { S.running = false; S.prog = null; S.RT = out; S.key = k; S.selT = out.length ? out[0].t : null; redraw(); return; }
          const t = T[i], Qt = AD().typeProject(JSON.parse(JSON.stringify(P)), t);
          AD().runChunked(JSON.parse(JSON.stringify(Qt)), AD().typeOpt(P), p => { S.prog = { ...p, f: (i + (p.f || 0)) / T.length, msg: `Type ${tyLab(P, t)} (${i + 1} of ${T.length}): ${p.msg || ''}` }; document.querySelectorAll('.ad-bar>div').forEach(b => { b.style.width = Math.round(100 * S.prog.f) + '%'; }); document.querySelectorAll('.ad-bar + .note').forEach(nt => { nt.textContent = S.prog.msg; }); }, () => S.stop)
            .then(R => { if (!R) { S.running = false; S.prog = { f: 0, msg: 'Stopped.' }; S.RT = out.length ? out : null; S.key = k; S.selT = out.length ? out[0].t : null; redraw(); return; } out.push({ t, Q: Qt, R, n: Qt.girders.filter(g => !g.adFixed).length }); one(i + 1); })
            .catch(e => { S.running = false; S.prog = null; S.err = `Auto design failed (type ${tyLab(P, t)}): ` + (e && e.message); redraw(); }); };
        one(0); return; }
      AD().runChunked(JSON.parse(JSON.stringify(P)), {}, p => { S.prog = p; document.querySelectorAll('.ad-bar>div').forEach(b => { b.style.width = Math.round(100 * (p.f || 0)) + '%'; }); document.querySelectorAll('.ad-bar + .note').forEach(nt => { nt.textContent = p.msg || ''; }); }, () => S.stop)
        .then(R => { S.running = false; S.prog = R ? null : { f: 0, msg: 'Stopped.' }; S.R = R; S.key = k; redraw(); })
        .catch(e => { S.running = false; S.prog = null; S.err = 'Auto design failed: ' + (e && e.message); redraw(); }); });
    on('#ad_stop', 'click', () => { S.stop = true; });
    on('#ad_scope', 'change', e => { S.scope = e.target.value; redraw(); });   // SB-2 PR 3: page view only (not saved)
    on('[data-adout]', 'click', e => { e.preventDefault(); if (ctx.showOut) ctx.showOut(); });
  }
  /* render(host, ctx): the Auto design output tab (the results) */
  function render(host, ctx) {
    css(); const P = ctx.P; DIA = !!(window.SBDFramingUI && window.SBDFramingUI.isDia && window.SBDFramingUI.isDia(P));
    let h = `<p class="note"><a href="#" data-adin="ad">Settings: Auto design input tab</a> (mode, objective, prices, limits, the design variables with Auto / Lock / Range, Run).</p>`;
    if (S.running || S.prog) h += `<section class="sec"><div class="secBody"><div class="fRow"><button type="button" id="ad_stop2"${S.running ? '' : ' disabled'}>Stop</button></div>${bar()}</div></section>`;
    if (S.err) h += `<div class="alert err">${esc(S.err)}</div>`;
    if (P.autodesign && P.autodesign.undo) h += '<div class="fRow"><button type="button" id="ad_undo">Undo the last Apply</button></div>';
    S.wty = null;
    if (S.RT && !S.running) {   // SB-2 PR 3: one run per girder type (S.RT: [{ t, Q (its run project), R, n (its lines) }])
      const T = S.RT, cur = T.find(q => q.t === S.selT) || T[0], best = q => q.R.cands[0], wq = (q, c) => c.cost.w / c.L.nb * q.n;
      h += (S.key !== key(P) ? '<div class="alert">The project changed since this run: run again before applying.</div>' : '')
        + `<section class="sec" id="ad_types"><div class="secHead">Girder types: the best candidate of each, sized for its worst line</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Girder type (lines)</th><th>Candidates</th><th>D (in)</th><th>Weight (lb, its lines)</th><th>Governing ratio</th><th class="lft">What governs (line)</th><th></th></tr></thead><tbody>
        ${T.map(q => { const c = best(q); return `<tr${q === cur ? ' class="sel"' : ''}><td class="lft"><a href="#" data-adty="${q.t}">${esc(tyLab(P, q.t))}</a></td><td>${q.R.cands.length}</td><td>${c ? fmt(c.D, 2) : '—'}</td><td>${c ? fmt(wq(q, c), 0) : '—'}</td><td>${c ? fmt(c.ratio, 3) : '—'}</td><td class="lft">${c && c.gov ? `${govTxt(c.gov)}${c.gov.title ? ': ' + esc(c.gov.title) : ''}${c.gov.gl ? ` (${esc(c.gov.gl)})` : ''}` : c ? '' : esc(q.R.note || 'no passing candidate')}</td><td>${c ? `<button type="button" data-adapt="${q.t}">Apply #1</button>` : ''}</td></tr>`; }).join('')}
        </tbody></table></div>${T.filter(best).length > 1 ? '<div class="fRow"><button type="button" class="primary" id="ad_applyAll">Apply #1 of every type</button></div>' : ''}
        <p class="note">Each type was run on its own lines: every line a plate girder of the run with its own loads and distribution factors, so the worst line governs each check (shown in brackets). Its weight is that of its lines. Below: the candidates of ${esc(tyLab(P, cur.t))}${T.length > 1 ? ' (click a type above for another)' : ''}. ${P.girders.length > 1 ? 'Each type was run with the other types\' current plates (the cross-frame layout and depth read every type). Apply writes the type\'s plates only (the other types and the bridge-wide details are not changed); the other types\' runs are then out of date (run again, and check the Summary). Apply #1 of every type writes each type\'s best candidate together: check the result on the Summary. Undo the last Apply puts back the plates of every type as they were before it.' : 'Apply writes the candidate as before girder types (plates, details); Undo the last Apply puts it back.'}</p></div></section>`;
      S.wty = { n: cur.n, det: P.girders.length > 1 }; h += resultsHtml(cur.Q, cur.R); S.wty = null;
    } else if (S.R && !S.running) h += (S.key !== key(P) ? '<div class="alert">The project changed since this run: run again before applying.</div>' : '') + resultsHtml(P, S.R);
    else if (!S.running && !S.RT) h += '<p class="note">No results yet: set the inputs and Run on the Auto design input tab. The results are kept for this page view.</p>';
    host.innerHTML = h;
    const redraw = () => render(host, ctx), on = (sel, ev, f) => host.querySelectorAll(sel).forEach(el => el.addEventListener(ev, f));
    on('[data-adin]', 'click', e => { e.preventDefault(); const b = document.querySelector('#inTabs [data-itab="ad"]'); if (b) b.click(); });
    on('#ad_stop2', 'click', () => { S.stop = true; });
    on('[data-adcmp]', 'change', e => { const v = e.target.value, i = +e.target.dataset.adcmp; S.cmp[i] = v; redraw(); });
    on('[data-adsel]', 'click', e => { if (e.target.closest('[data-adgo]')) return; S.sel = +e.currentTarget.dataset.adsel; redraw(); });
    on('[data-adgo]', 'click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${e.currentTarget.dataset.adgo}"]`); if (b) b.click(); });
    /* applyT(list) (SB-2 PR 3): list = [{ q (a type's run), c (its candidate) }]. More than one type: each type takes its plates
       (applyType), the plates before kept for Undo (autodesign.undo = { girders }); the runs of the other types are kept for this page
       view but out of date (their run projects held the plates before: the cross-frame model reads every type), so S.key is not renewed
       and Apply asks first. One type: as apply() before girder types (autodesign, APPLY_KEYS). */
    const applyT = list => { if (S.key !== key(P) && !confirm('The project changed since this run. Apply anyway?')) return;
      if (P.girders.length > 1) { const keep = JSON.parse(JSON.stringify(P.girders)); let G = P.girders; list.forEach(({ q, c }) => { G = AD().applyType({ ...P, girders: G }, q.t, q.Q, c).girders; });
        const a = ensure(P); P.girders = G; a.undo = { girders: keep }; a.applied = { at: new Date().toISOString(), types: list.map(({ q, c }) => ({ t: q.t, D: c.L.D, w: c.cost.w / c.L.nb * q.n })) };
        const done = new Set(list.map(({ q }) => q.t)); S.RT = S.RT.filter(q => !done.has(q.t)); if (!S.RT.length) S.RT = null; else { S.selT = S.RT[0].t; S.sel = 0; S.cmp = ['cur', '0']; } }
      else { const W = AD().applyType(P, list[0].q.t, list[0].q.Q, list[0].c); Object.entries(W).forEach(([k, v]) => { if (v === undefined) delete P[k]; else P[k] = v; }); S.RT = null; }
      if (ctx.changed) ctx.changed(true); else redraw(); };
    on('[data-adty]', 'click', e => { e.preventDefault(); S.selT = +e.currentTarget.dataset.adty; S.sel = 0; S.cmp = ['cur', '0']; redraw(); });
    on('[data-adapt]', 'click', e => { const q = (S.RT || []).find(z => z.t === +e.currentTarget.dataset.adapt); if (q && q.R.cands[0]) applyT([{ q, c: q.R.cands[0] }]); });
    on('#ad_applyAll', 'click', () => applyT((S.RT || []).filter(q => q.R.cands[0]).map(q => ({ q, c: q.R.cands[0] }))));
    on('#ad_apply', 'click', () => { if (S.RT) { const q = S.RT.find(z => z.t === S.selT) || S.RT[0], c = q && q.R.cands[S.sel]; if (c) applyT([{ q, c }]); return; }
      const c = S.R && S.R.cands[S.sel]; if (!c) return; if (S.key !== key(P) && !confirm('The project changed since this run. Apply anyway?')) return;
      const r = AD().apply(P, c); ['autodesign', ...AD().APPLY_KEYS].forEach(k => { if (r.project[k] === undefined) delete P[k]; else P[k] = r.project[k]; }); S.R = null; if (ctx.changed) ctx.changed(true); else redraw(); });
    on('#ad_undo', 'click', () => { const Q = AD().undo(P); if (!Q) return; ['autodesign', ...AD().APPLY_KEYS].forEach(k => { if (Q[k] === undefined) delete P[k]; else P[k] = Q[k]; }); if (ctx.changed) ctx.changed(true); else redraw(); });
  }
  /* lastWarns(P) (Summary tab, 2026-11-09; display only): the WARNING flags (c.propWarns) of the last Auto design run of this page view that
     is not applied: [{ i (candidate index), warns: [{ label, r }] }], stale = the project changed since the run; null when there is none */
  const lastWarns = P => (S.R && !S.running && S.R.cands ? { stale: S.key !== key(P), list: S.R.cands.map((c, i) => ({ i, warns: c.propWarns || [] })).filter(q => q.warns.length) } : null);
  window.SBDAutoDesignUI = { inputs, wire, render, diffFrom, openVars, lastWarns };
})();
