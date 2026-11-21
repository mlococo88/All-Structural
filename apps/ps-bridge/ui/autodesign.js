/* apps/ps-bridge/ui/autodesign.js — the Auto design input tab (its settings and Run) and the Auto design output tab (the candidates, Apply)
   (window.PSBAutoDesignUI). Classic script. Created 2026-11-14 (PS Bridge catch-up item A), the Steel Bridge app's Auto design tabs
   (apps/steel-bridge/ui/autodesign.js: the settings with Auto / Lock variables and Run on the input tab; the ranked candidates, the governing
   check of each, Apply as one change of the project on the output tab) written for this app: the search is engine/autodesign.js
   (PSBAutoDesign), every candidate judged by the page's own engine call; nothing is calculated here.

   Saved: the settings only, P.autodesign (optional within schema version 1; absent = the defaults, PSBAutoDesign.DEF). The run's result lives
   in this page view's memory (as the steel app's). Apply writes the chosen candidate of each span into its girder types' inputs (their
   overrides) as one change of the project: one step of the header's Undo (PR 6), offered again on the notice it shows.

   inputs(P) / onChange(el, P) / onClick(e, ctx) for the input tab; render(host, ctx) for the output tab.
   ctx = { P, changed(), toast(text, undo), gotoOut(tab), gotoStep(tab, id), goin(tab), errors() } */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fx = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d) : '—';
  const AD = () => window.PSBAutoDesign, BR = () => window.PSBBridge;
  const S = { running: false, stop: false, prog: null, R: null, key: '', sel: {}, err: '', t0: 0, ap: null, rev: 0 };   // ap, rev: ADB (basis())
  const keyOf = P => JSON.stringify(Object.assign({}, P, { design: undefined, notices: undefined, handoffs: undefined }));   // HO-D2: a send / its record is not an input change
  function css() {
    if (typeof document === 'undefined' || document.getElementById('psbad-css')) return;
    const st = document.createElement('style'); st.id = 'psbad-css';
    st.textContent = `.ad-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:2px 14px;}
.ad-bar{height:8px;background:#e4e7eb;border-radius:4px;overflow:hidden;margin:6px 0;} .ad-bar>div{height:100%;background:#2563EB;}
table.ad-tbl td,table.ad-tbl th{font-family:var(--font-ui);font-size:9pt;white-space:nowrap;} table.ad-tbl tr.ad-ok td{background:#ECFDF5;} table.ad-tbl tr.ad-ng td{color:#64748b;}
table.ad-tbl tr.ad-sel td{background:#FEF9C3;} table.ad-tbl tr.ad-cur td{font-style:italic;color:#475569;} table.ad-tbl td.wrap{white-space:normal;min-width:200px;}
.ad-pass{color:#065F46;font-weight:700;} .ad-fail{color:#991B1B;font-weight:700;} details.ad-log summary{cursor:pointer;color:#2563EB;font-size:9pt;}
.ad-vars{width:100%;border-collapse:collapse;} .ad-vars td,.ad-vars th{padding:2px 6px;vertical-align:top;font-size:9pt;text-align:left;} .ad-vars select{width:auto;} .ad-vars td.nt{color:#475569;font-size:8.5pt;}`;
    document.head.appendChild(st);
  }

  /* ---------- the input tab ---------- */
  const VARS = [['section', 'Girder section', 'the library sections of the owner and of the shape\'s family (adjacent members: of the same width), lightest (or shallowest) first; the same section for every girder type of a span (PS-8)'],
    ['strands', 'Strand count and rows', 'the straight rows bottom-up on the row grid (PS-41 for MassDOT sections), each row filled to the most strands that fit, in symmetric pairs (PS-12); top strands and entered debonding kept'],
    ['drape', 'Draped strands', 'n_h = 0, 2, 4, …; y_mid directly above the top straight row, y_end on the 2 in grid; hold-down points at 0.33 L to 0.45 L from ℄ bearing (PS-5)'],
    ['conc', 'f′c and f′ci', '0.5 ksi steps through the entered values (PS-11), within the limits below']];
  function inputs(P) {
    css(); const o = AD().settings(P), a = P.autodesign || {}, v = (k, d) => a[k] !== undefined && a[k] !== '' ? a[k] : d;
    const k0 = (BR().cells(P)[0] || {}).k, C = k0 != null ? AD().conc(P, k0, Object.assign({}, o, { vars: Object.assign({}, o.vars, { conc: 'auto' }), fcLo: NaN, fcHi: NaN })) : null;
    const opt = (cur, list) => list.map(([x, t]) => `<option value="${esc(x)}"${String(cur) === String(x) ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const sel = (id, lbl, cur, list) => `<div class="fRow"><label for="ad_${id}">${lbl}</label><select id="ad_${id}" data-ad="${id}">${opt(cur, list)}</select></div>`;
    const numF = (id, lbl, cur, unit, ph) => `<div class="fRow"><label for="ad_${id}">${lbl}</label><input type="text" id="ad_${id}" data-ad="${id}" value="${esc(cur)}"${ph != null ? ` placeholder="${esc(ph)}"` : ''}><span class="unit">${unit || ''}</span></div>`;
    const busy = S.running;
    return `<p class="note"><a href="#" data-adout="1">Results: Auto design output tab</a> (the candidates of each span, the governing check of each, Apply).</p>
      <section class="sec"><div class="secHead">Auto design: settings</div><div class="secBody">
      <div class="ad-grid">${sel('objective', 'Objective', o.objective, [['weight', 'Lightest section'], ['depth', 'Shallowest section']])}${numF('topN', 'Sections to list per span', v('topN', ''), '', String(AD().DEF.topN))}</div>
      <table class="ad-vars"><thead><tr><th class="lft">Variable</th><th>Auto / Lock</th><th class="lft">Searched (Auto)</th></tr></thead><tbody>
      ${VARS.map(([id, lab, nt]) => `<tr><td class="lft">${lab}</td><td><select data-ad="vars.${id}" aria-label="${esc(lab)}: Auto or Lock">${opt(o.vars[id], [['auto', 'Auto'], ['lock', 'Lock (as entered)']])}</select></td><td class="lft nt">${esc(nt)}</td></tr>`).join('')}
      </tbody></table>
      <p class="note"><b>Limits</b> (blank: the owner's value, shown grey${C ? `; owner ${esc(C.owner)}` : ''}):</p><div class="ad-grid">
      ${numF('fcLo', 'f′c, lowest', v('fcLo', ''), 'ksi', C ? fx(C.lo, 1) : '')}${numF('fcHi', 'f′c, highest', v('fcHi', ''), 'ksi', C ? fx(C.hi, 1) : '')}
      ${numF('fciLo', 'f′ci, lowest', v('fciLo', ''), 'ksi', fx(AD().DEF.fciLo, 1))}${numF('fciHi', 'f′ci, highest (plant)', v('fciHi', ''), 'ksi', 'f′c and the owner\'s limit')}</div>
      <p class="note">f′c limits: AASHTO LRFD 10th Ed. 5.4.2.1 (not less than 4.0 ksi for prestressed concrete; the provisions are based on up to 10.0 ksi); the owners' limits of the Owner rules tab (RIDOT 5.2.1: 5.0 to 8.0 ksi; CTDOT V2 5.9.1.2: 6.0 to 10.0 ksi, f′ci 0.70 to 0.80 f′c and at most 6.5 ksi; MassDOT 3.7.2.1: the standard 6.5 / 8.0 ksi, f′ci at most 0.80 f′c). RIDOT 5.6.1 (f′ci about 0.70 f′c, a warning in the engine) is applied as a limit.</p>
      </div></section>
      <section class="sec"><div class="secHead">Run</div><div class="secBody">
      <div class="fRow"><button type="button" class="primary" id="ad_run"${busy ? ' disabled' : ''}>Run auto design</button> <button type="button" id="ad_stop"${busy ? '' : ' disabled'}>Stop</button></div>
      ${progHtml()}
      <p class="note">Every trial is computed by the same engine as the tabs (every check on every line of the girder type, the worst line governing) and checked for strand fit as the inputs are; a candidate passes every check. Auto design only proposes inputs: nothing changes until Apply on the <a href="#" data-adout="1">Auto design output tab</a>, which is one step of Undo.</p>
      </div></section>`;
  }
  const progHtml = () => S.running || S.prog ? `<div class="ad-bar"><div style="width:${Math.round(100 * ((S.prog && S.prog.f) || 0))}%"></div></div><p class="note ad-msg">${esc((S.prog && S.prog.msg) || '')}</p>` : '';
  /* onChange(el, P): a setting changed (true: the page saves the project and redraws) */
  function onChange(el, P) {
    const id = el.dataset.ad; if (!id) return false;
    const a = P.autodesign = Object.assign({}, P.autodesign || {}), path = id.split('.');
    if (path[0] === 'vars') { a.vars = Object.assign({}, a.vars || {}); a.vars[path[1]] = el.value === 'lock' ? 'lock' : 'auto'; }
    else if (id === 'objective') a.objective = el.value === 'depth' ? 'depth' : 'weight';
    else { const t = String(el.value).trim(); if (t === '') delete a[id]; else a[id] = isFinite(+t) ? +t : t; }
    return true;
  }
  /* onClick(e, ctx): Run, Stop, the output tab link (true when handled) */
  function onClick(e, ctx) {
    const t = e.target;
    if (t.closest('[data-adout]')) { e.preventDefault(); ctx.gotoOut('ad'); return true; }
    if (t.closest('#ad_stop')) { S.stop = true; return true; }
    if (t.closest('#ad_run')) { start(ctx); return true; }
    return false;
  }
  /* start(ctx): the run on a copy of the project, a slice of trials per timer tick (the page stays responsive), progress in place */
  function start(ctx) {
    const P = ctx.P, E = ctx.errors();
    if (E.length) { S.err = `Auto design cannot run: ${E.length} input${E.length > 1 ? 's need' : ' needs'} fixing first (the check summary lists them).`; S.R = null; ctx.gotoOut('ad'); return; }
    const Q = JSON.parse(JSON.stringify(P)), o = AD().settings(Q), it = AD().run(Q, o);
    S.running = true; S.stop = false; S.err = ''; S.R = null; S.sel = {}; S.key = keyOf(P); S.prog = { f: 0, msg: 'Starting…' }; S.t0 = Date.now(); S.Q = Q;
    ctx.redraw(); ctx.gotoOut('ad');
    const put = () => { document.querySelectorAll('.ad-bar>div').forEach(b => { b.style.width = Math.round(100 * S.prog.f) + '%'; }); document.querySelectorAll('.ad-msg').forEach(n => { n.textContent = S.prog.msg; }); };
    const tick = () => {
      if (S.stop) { S.running = false; S.prog = { f: 0, msg: 'Stopped: no result (run again).' }; ctx.redraw(); return; }
      const t1 = Date.now(); let r;
      try { do { r = it.next(); } while (!r.done && Date.now() - t1 < 40); }
      catch (e) { S.running = false; S.prog = null; S.err = 'Auto design failed: ' + (e && e.message); ctx.redraw(); return; }
      if (r.done) { S.running = false; S.prog = null; S.R = r.value; S.rev++; ctx.redraw(); return; }
      const i = r.value.i || 0; S.prog = { f: Math.min(0.98, i / Math.max(400, i * 1.25)), msg: `${i} engine runs, ${((Date.now() - S.t0) / 1000).toFixed(0)} s: ${r.value.msg || ''}` }; put();
      setTimeout(tick, 0);
    };
    setTimeout(tick, 0);
  }

  /* ---------- the output tab ---------- */
  /* where(name): the check's group and step (ui/dash.js GROUPS): its tab and worked step, or an input tab row (the owner limits) */
  function where(n) { const D = window.PSBDashUI; if (D) for (const gp of D.GROUPS) for (const [cn, st] of gp.checks) if (cn === n) return { gp, st }; return null; }
  const link = (n, txt) => { const w = where(n); if (!w) return esc(txt || n);
    return w.gp.input ? `<a href="#" data-goin="${w.gp.tab}">${esc(txt || n)}</a>` : `<a href="#st-${esc(w.st)}" data-gotab="${w.gp.tab}">${esc(txt || n)}</a>`; };
  const tabName = n => { const w = where(n); return w ? w.gp.name : ''; };
  const govTxt = g => g ? `${link(g.n)} ${fx(g.r, 3)} (G${g.g})` : '—';
  const rowsTxt = rows => rows.map(r => `${r.n} at ${fx(+r.y, 2)}${+r.nd > 0 ? ` (${r.nd} debonded ${fx(+r.dbnd, 1)} ft)` : ''}`).join(', ');
  const drapeTxt = b => b.nh ? `${b.nh} draped: y<sub>end</sub> ${fx(+b.harp.yEnd, 2)} in, y<sub>mid</sub> ${fx(+b.harp.yMid, 2)} in, hold-down at ${fx(+b.harp.frac, 2)} L${b.hd ? `, F<sub>hd</sub> / limit ${fx(b.hd.r, 3)}` : ''}` : 'none';
  const curTxt = (P, k, R) => { const c = R.cur[k]; if (!c) return ''; const e = c.eff;
    return `${esc(e.girder)}, ${AD().countOf(e)} strands (${+e.harp.n || 0} draped), f′c ${fx(+e.mat.fc, 2)} / f′ci ${fx(+e.mat.fci, 2)} ksi: ${c.ev.pass ? '<span class="ad-pass">PASS</span>' : `<span class="ad-fail">FAIL</span> ${c.ev.fails.map(n => link(n)).join(', ')}`}`; };
  function render(host, ctx) {
    css(); const P = ctx.P, R = S.R;
    let h = `<p class="note"><a href="#" data-goin="ad">Settings and Run: Auto design input tab</a>. <a href="#rp:rs.adb" data-gotab="rpt">The basis of the run shown or applied: Report, §2 Project, basis and assumptions, Auto design basis</a>.</p>`;
    if (S.running || S.prog) h += `<section class="sec"><div class="secBody"><div class="fRow"><button type="button" id="ad_stop2"${S.running ? '' : ' disabled'}>Stop</button></div>${progHtml()}</div></section>`;
    if (S.err) h += `<div class="alert err" role="alert">${esc(S.err)}</div>`;
    if (!R && !S.running) { h += `<p class="note">No results yet: set the variables and Run on the <a href="#" data-goin="ad">Auto design input tab</a>. The results are kept for this page view.</p>`; host.innerHTML = h; return; }
    if (!R) { host.innerHTML = h; return; }
    const Q = S.Q, stale = S.key !== keyOf(P), T = BR().types(Q), lab = k => esc((T[k] || {}).label || `type ${k + 1}`);
    if (stale) h += '<div class="alert">The project changed since this run: run again before applying.</div>';
    h += `<p class="note">${R.runs} engine runs in ${fx(R.ms / 1000, 1)} s${R.stopped ? ' (stopped at the run limit: the results are partial)' : ''}.</p>`;
    let anyC = false;
    R.spans.forEach(sp => {
      const ks = sp.types, sel = S.sel[sp.s] || 0; if (sp.cands.length) anyC = true;
      h += `<section class="sec" id="ad-span-${sp.s}"><div class="secHead">Span ${sp.s}: candidates (${esc(ks.map(lab).join(', '))})</div><div class="secBody">
        <p class="note">Sections searched: ${esc(sp.why)}, ${R.o.objective === 'depth' ? 'shallowest' : 'lightest'} first. Current design: ${ks.map(k => `${lab(k)}: ${curTxt(Q, k, R)}`).join('; ')}.</p>
        <div class="tscroll"><table class="tbl ad-tbl"><thead><tr><th></th><th class="lft">Section</th><th>h (in)</th><th>A (in²)</th>${ks.map(k => `<th class="lft">${lab(k)}: strands, f′c / f′ci (ksi), governing check (ratio, line)</th>`).join('')}<th>Weight (kip, the span's lines)</th></tr></thead><tbody>
        ${sp.sections.map(e => { const ci = sp.cands.indexOf(e), cls = ci >= 0 ? (ci === sel ? 'ad-sel' : 'ad-ok') : 'ad-ng';
          return `<tr class="${cls}"><td>${ci >= 0 ? `<input type="radio" name="adsel${sp.s}" data-adsel="${sp.s}|${ci}"${ci === sel ? ' checked' : ''} aria-label="candidate ${ci + 1} of span ${sp.s}">#${ci + 1}` : ''}</td><td class="lft">${esc(e.name)}</td><td>${fx(e.h, 2)}</td><td>${fx(e.A, 1)}</td>
            ${ks.map(k => { const q = e.types.find(z => z.k === k); if (!q) return '<td class="lft" title="another girder type of the span has no design on this section">not run</td>';
              const b = q.res.best; return b ? `<td class="lft">${b.N} (${b.nh} draped), ${fx(b.fc, 1)} / ${fx(b.fci, 1)}, ${govTxt(b.ev.gov)}</td>` : `<td class="lft wrap">none: ${esc(q.res.why)}${q.res.closest ? `; closest trial: ${esc(q.res.closest.what)}, fails ${q.res.closest.fails.slice(0, 3).map(n => link(n)).join(', ')}${q.res.closest.fails.length > 3 ? ` and ${q.res.closest.fails.length - 3} more` : ''}` : ''}</td>`; }).join('')}
            <td>${ci >= 0 ? fx(e.W, 1) : '—'}</td></tr>`; }).join('')}
        </tbody></table></div>
        ${sp.cands.length ? detail(Q, sp, sp.cands[sel], lab) : `<div class="alert err">No section passes every check for every girder type of span ${sp.s}.${sp.blocked && sp.blocked.length ? ` Failing on the current design and on the closest trial of every section: ${sp.blocked.map(n => link(n)).join(', ')} (not changed by the variables searched: check those inputs).` : ''}</div>`}
        </div></section>`;
    });
    if (anyC) h += `<section class="sec"><div class="secBody"><div class="fRow"><button type="button" class="primary" id="ad_apply"${stale ? ' disabled' : ''}>Apply the selected candidate of every span</button></div>
      <p class="note">Apply writes, for every girder type of each span with a candidate, its section, straight rows, draped strands, f′c and f′ci as the type's own inputs (Girders &amp; strands and Materials tabs); nothing else is changed. It is one step of the header's Undo. The tabs then show and work every check of the applied design.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">How the search works (assumptions)</div><div class="secBody"><ul class="note">
      <li>The choice, in order: the lighter section (gross area A; or the shallower, depth h), then fewer strands, then fewer draped strands, then the lower hold-down force (the flatter drape), then the hold-down point nearest 0.40 L, then the lower f′c, then the lower f′ci.</li>
      <li>Per girder type and section: (1) the fewest straight strands that pass Strength I flexure and Service III tension with no draped strand (a lower bound); (2) from there, in pairs, n<sub>h</sub> = 0, 2, … draped strands with the flattest drape that passes every check; (3) the lowest f′c and f′ci that pass with that pattern. The strand search is run at the entered f′c / f′ci first, then at the entered f′c with the highest f′ci it allows, then at the highest f′c and f′ci.</li>
      <li>Assumption (<a href="#rp:rs.adb" data-gotab="rpt">Report, §2, Auto design basis</a>): a higher f′c or f′ci is not worse for any check; a higher y<sub>end</sub> relieves the end; the checks more strands improve are ${esc(AD().GROW.join(', '))}.</li>
      <li>Debonding is never added (PS-12): entered debonding is kept row by row; top strands (rows in the upper half) are kept as entered.</li></ul></div></section>`;
    if (R.log.length) h += `<details class="ad-log"><summary>Trial log (${R.log.length}${R.log.length >= 3000 ? ', the first 3000' : ''})</summary><div class="tscroll"><table class="tbl ad-tbl"><thead><tr><th class="lft">Type</th><th class="lft">Section</th><th class="lft">Trial</th><th>Result</th><th class="lft">Governing (ratio, line)</th></tr></thead><tbody>
      ${R.log.slice(0, 3000).map(q => `<tr><td class="lft">${lab(q.k)}</td><td class="lft">${esc(q.girder)}</td><td class="lft">${esc(q.what)}</td><td>${q.pass ? '<span class="ad-pass">PASS</span>' : `<span class="ad-fail">FAIL</span> ${esc(q.fails.join(', '))}`}</td><td class="lft">${q.gov ? `${esc(q.gov.n)} ${fx(q.gov.r, 3)} (G${q.gov.g})` : '—'}</td></tr>`).join('')}</tbody></table></div></details>`;
    host.innerHTML = h;
    const on = (s, ev, f) => host.querySelectorAll(s).forEach(el => el.addEventListener(ev, f));
    on('#ad_stop2', 'click', () => { S.stop = true; });
    on('[data-adsel]', 'change', e => { const [s, i] = e.target.dataset.adsel.split('|').map(Number); S.sel[s] = i; render(host, ctx); });
    on('#ad_apply', 'click', () => { if (S.key !== keyOf(P)) return;
      const A = AD().apply(P, R, S.sel); if (!A.changed.length) return;
      S.ap = { R, Q: S.Q, sel: Object.assign({}, S.sel), key: keyOf(P) }; S.rev++;   // ADB: the applied run, kept in this page view for the Report's Auto design basis
      S.R = null; S.prog = null; ctx.changed(); ctx.toast(A.note, true); });   // one step of the header's Undo (the notice's Undo is that step)
  }
  /* detail(Q, sp, c, lab): the selected candidate of a span: each type's inputs and its every check (ratio, line), linked to its tab */
  function detail(Q, sp, c, lab) {
    return c.types.map(({ k, res }) => { const b = res.best, by = {};
      b.ev.lines.forEach(l => l.R.checks.forEach(q => { const z = by[q.n]; if (!z || q.r > z.r) by[q.n] = { r: q.r, g: l.g, pass: q.pass }; }));
      return `<details class="ad-log" open><summary>${lab(k)} on ${esc(c.name)}: ${b.N} strands, f′c ${fx(b.fc, 1)} ksi, f′ci ${fx(b.fci, 1)} ksi (${esc(res.level || '')} searched first; ${res.trials} trials)</summary>
        <div class="kv"><div><span>Straight rows (count at y, in)</span><span>${esc(rowsTxt(b.rows))}</span></div><div><span>Draped strands</span><span>${drapeTxt(b)}</span></div>
        <div><span>Girder weight, the type's lines</span><span>${fx(b.W, 1)} kip</span></div></div>
        <div class="tscroll"><table class="tbl ad-tbl"><thead><tr><th class="lft">Check (worked on its tab after Apply)</th><th class="lft">Tab</th><th>Ratio (worst line)</th><th>Line</th></tr></thead><tbody>
        ${Object.entries(by).sort((x, y) => y[1].r - x[1].r).map(([n, z]) => `<tr><td class="lft">${link(n)}</td><td class="lft">${esc(tabName(n))}</td><td>${fx(z.r, 3)}</td><td>G${z.g}</td></tr>`).join('')}</tbody></table></div></details>`; }).join('');
  }
  /* basis(P) (ADB, 2026-11-15): the run the Report's Auto design basis describes: the run shown on the output tab (not applied), else the
     run last applied in this page view, else null ({ kind: 'running' } while a run is under way). stale: the project changed since that run
     (shown) or since it was applied. Memory only: nothing stored. basisKey(): changes when the run shown or applied changes. */
  function basis(P) {
    if (S.running) return { kind: 'running' };
    if (S.R) return { kind: 'shown', R: S.R, Q: S.Q, sel: Object.assign({}, S.sel), stale: S.key !== keyOf(P) };
    if (S.ap) return { kind: 'applied', R: S.ap.R, Q: S.ap.Q, sel: S.ap.sel, stale: S.ap.key !== keyOf(P) };
    return null;
  }
  const basisKey = () => `${S.rev}|${S.running ? 1 : 0}|${JSON.stringify(S.sel)}`;
  window.PSBAutoDesignUI = { inputs, onChange, onClick, render, state: () => S, basis, basisKey };
})();
