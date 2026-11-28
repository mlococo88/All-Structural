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
    ['conc', 'f′c and f′ci', '0.5 ksi steps through the entered values (PS-11), within the limits below'],
    ['nb', 'Girder count N<sub>b</sub>', 'Auto: the current count ± 1 with the spacing S = W_cc / (N_b − 1) within 3.5 to 16 ft (the LLDF range of applicability) and the limits below; Range: every count from min to max; Lock (the default): the current count. Each count: equal spacing over the present exterior girder spacing W_cc, the overhangs kept, the girder types re-assigned as on a count change (the outer lines keep the exterior types), an entered b_eff back to the calculated width; not for adjacent members or NEXT beams, entered distribution factors or live load, or a demand table']];
  function inputs(P) {
    css(); const o = AD().settings(P), a = P.autodesign || {}, v = (k, d) => a[k] !== undefined && a[k] !== '' ? a[k] : d;
    const k0 = (BR().cells(P)[0] || {}).k, C = k0 != null ? AD().conc(P, k0, Object.assign({}, o, { vars: Object.assign({}, o.vars, { conc: 'auto' }), fcLo: NaN, fcHi: NaN })) : null;
    const opt = (cur, list) => list.map(([x, t]) => `<option value="${esc(x)}"${String(cur) === String(x) ? ' selected' : ''}>${esc(t)}</option>`).join('');
    const sel = (id, lbl, cur, list) => `<div class="fRow"><label for="ad_${id}">${lbl}</label><select id="ad_${id}" data-ad="${id}">${opt(cur, list)}</select></div>`;
    const numF = (id, lbl, cur, unit, ph) => `<div class="fRow"><label for="ad_${id}">${lbl}</label><input type="text" id="ad_${id}" data-ad="${id}" value="${esc(cur)}"${ph != null ? ` placeholder="${esc(ph)}"` : ''}><span class="unit">${unit || ''}</span></div>`;
    const busy = S.running;
    return `<p class="note"><a href="#" data-adout="1">Results: Auto design output tab</a> (the candidates of each span, the governing check of each, Apply).</p>
      <section class="sec"><div class="secHead">Auto design: settings</div><div class="secBody">
      <div class="ad-grid">${sel('mode', 'Mode', o.mode, [['new', 'New design (search the sections)'], ['refine', 'Refine the entered design']])}${sel('objective', 'Objective', o.objective, [['weight', 'Lightest section'], ['depth', 'Shallowest section']])}${numF('topN', o.mode === 'refine' ? 'Designs to list per span' : 'Sections to list per span', v('topN', ''), '', String(AD().DEF.topN))}${numF('maxRatio', 'Target ratio (every check ≤)', v('maxRatio', ''), '', AD().DEF.maxRatio.toFixed(2))}${sel('pattern', 'Strand pattern (New design)', o.pattern, [['draped', 'Draped strands (entered debonding kept)'], ['straight', 'Straight strands with debonding'], ['both', 'Both, ranked together']])}${sel('uniform', 'Uniformity (New design)', o.uniform, [['none', 'None: a design per girder type'], ['types', 'One design for the girder types of a span'], ['bridge', 'One section and strand pattern for the bridge']])}</div>
      ${o.uniform !== 'none' ? `<p class="note"><b>Uniformity</b>: ${o.uniform === 'types' ? 'every girder type of a span takes one design (section, strands, drape, f′c, f′ci)' : 'every girder type of every span takes one section and one strand pattern (and f′c, f′ci)'}, judged on every line of every type it covers (the worst governs); each type keeps its other inputs. The run without uniformity is made first to show what uniformity costs (weight and strands). Not applied with Refine or with several girder counts.</p>` : ''}
      ${o.pattern !== 'draped' ? `<p class="note"><b>Straight strands with debonding</b> (no draped strand; debonding searched, AASHTO LRFD 10th Ed. Art. 5.9.4.3.3): at most 45 % of a row debonded; an even count per row (symmetric); the strands within the web width (I-girders, bulb tees) or under the webs (boxes, voided slabs) and the outermost strand each side of a row (each stem of a NEXT beam) bonded; each debonded row its own length, the lengths ⌈60 d<sub>b</sub>⌉ apart on a 1 ft grid from the ends, as short as possible, at most 4 strands ending at one section (6 when more than 10 are debonded, 4 with 0.7 in strand), the longest within min(0.20 L, L/2 − ℓ<sub>d</sub>); an engine warning on any of these rejects the design. Owners: CTDOT V2 5.9.4.3.3 at most 25 % of all strands; MassDOT 3.7.2.2 straight debonded strands preferred to draped strands for box beams, NEBT and NEDBT (Both: the straight design first); RIDOT BDM 5.6.3.2 as AASHTO. Not checked: alternate bonded and debonded positions (5.9.4.3.3(E)): the strand table has no position within a row. ${o.pattern === 'both' ? 'Both: per girder type and section the fewer strands, then the fewer draped or debonded strands, then the draped design.' : ''}</p>` : ''}
      <p class="note">${o.mode === 'refine' ? '<b>Refine</b>: the current section of each span is kept; the design nearest the entered one that passes is proposed: the entered design itself when it passes, then the fewest changes, ranked by the change in the strand count N, then in the draped strands n<sub>h</sub>, then in the drape (y<sub>end</sub>, hold-down point), then in f′c, then in f′ci. The list also shows the passing design with the fewest strands (an over-designed pattern is reduced).' : '<b>New design</b>: the sections of the family are searched, lightest (or shallowest) first, as below.'} <b>Target ratio</b>: a candidate passes only when every check's ratio is at most the target (blank: 1.00, the checks' own pass). The rules of fact (confinement detailing, the LLDF range of applicability, the hold-down force limit, the owners' f′c, f′ci, age and debonded-share rules) are not ratios of demand to capacity: they must pass, and the target does not apply to them.</p>
      <table class="ad-vars"><thead><tr><th class="lft">Variable</th><th>Auto / Lock</th><th class="lft">Searched (Auto)</th></tr></thead><tbody>
      ${VARS.map(([id, lab, nt]) => `<tr><td class="lft">${lab}</td><td><select data-ad="vars.${id}" aria-label="${esc(lab.replace(/<[^>]+>/g, ''))}: Auto or Lock">${opt(o.vars[id], id === 'nb' ? [['lock', 'Lock (the current count)'], ['auto', 'Auto'], ['range', 'Range']] : [['auto', 'Auto'], ['lock', 'Lock (as entered)']])}</select></td><td class="lft nt">${esc(nt)}</td></tr>`).join('')}
      </tbody></table>
      ${o.vars.nb !== 'lock' ? `<div class="ad-grid">${o.vars.nb === 'range' ? numF('nbMin', 'N<sub>b</sub>, fewest', v('nbMin', ''), '', String(P.xs.nb)) + numF('nbMax', 'N<sub>b</sub>, most', v('nbMax', ''), '', String(P.xs.nb)) : ''}${numF('sLo', 'Girder spacing, least (Auto)', v('sLo', ''), 'ft', fx(AD().S_LO, 1))}${numF('sHi', 'Girder spacing, most (Auto)', v('sHi', ''), 'ft', fx(AD().S_HI, 1))}</div>${(() => { const lk = AD().nbLock(P); return lk ? `<p class="note">The girder count is not searched for this bridge: ${esc(lk)}.</p>` : ''; })()}` : ''}
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
    if (path[0] === 'vars') { a.vars = Object.assign({}, a.vars || {});
      if (path[1] === 'nb') { if (el.value === 'auto' || el.value === 'range') a.vars.nb = el.value; else delete a.vars.nb; }   // PSAD-B: absent = Lock (the default)
      else a.vars[path[1]] = el.value === 'lock' ? 'lock' : 'auto'; }
    else if (id === 'objective') a.objective = el.value === 'depth' ? 'depth' : 'weight';
    else if (id === 'mode') { if (el.value === 'refine') a.mode = 'refine'; else delete a.mode; }   // PSAD-A: absent = 'new' (the default)
    else if (id === 'uniform') { if (el.value === 'types' || el.value === 'bridge') a.uniform = el.value; else delete a.uniform; }   // PSAD-D: absent = 'none'
    else if (id === 'pattern') { if (el.value === 'straight' || el.value === 'both') a.pattern = el.value; else delete a.pattern; }   // PSAD-C: absent = 'draped'
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
      if (r.done) { S.running = false; S.prog = null; S.R = r.value; if (r.value.sel) S.sel = Object.assign({}, r.value.sel); S.rev++; ctx.redraw(); return; }   // PSAD-B: the default choice of a run over several girder counts
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
  const govTxt = (g, ev, o) => !g ? '—' : `${link(g.n)} ${fx(g.r, 3)} (G${g.g})${o && o.maxRatio < 1 && ev && ev.govT ? `; target ${fx(o.maxRatio, 2)}: ${link(ev.govT.n)} ${fx(ev.govT.r, 3)} (G${ev.govT.g})` : ''}`;
  /* distTxt(b): a Refine design's change from the entered design (PSAD-A) */
  const sg = (v, d) => `${v > 0 ? '+' : '−'}${fx(Math.abs(v), d)}`;
  const distTxt = b => { if (!b || !b.delta) return ''; if (b.entered) return 'the entered design'; const d = b.delta, q = [];
    if (d.N) q.push(`N ${sg(d.N, 0)}`); if (d.nh) q.push(`n_h ${sg(d.nh, 0)}`); if (d.yEnd) q.push(`y_end ${sg(d.yEnd, 2)} in`); if (d.frac) q.push(`hold-down ${sg(d.frac, 2)} L`);
    if (d.fc) q.push(`f′c ${sg(d.fc, 1)} ksi`); if (d.fci) q.push(`f′ci ${sg(d.fci, 1)} ksi`);
    return (q.length ? q.join(', ') : 'the entered strands, rows changed') + (b.fewest ? ' (the fewest strands)' : ''); };
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
    const Q = S.Q, stale = S.key !== keyOf(P), T = BR().types(Q), multi = !!(R.nb && R.nb.list.length > 1);
    let labs = {}; const lab = k => esc((T[k] || {}).label || labs[k] || `type ${k + 1}`);
    if (stale) h += '<div class="alert">The project changed since this run: run again before applying.</div>';
    h += `<p class="note">${R.runs} engine runs in ${fx(R.ms / 1000, 1)} s${R.stopped ? ' (stopped at the run limit: the results are partial)' : ''}. Mode: ${R.o.mode === 'refine' ? 'Refine the entered design (the current section kept; the nearest passing designs first)' : 'New design'}; target ratio ${fx(R.o.maxRatio, 2)}${R.o.maxRatio < 1 ? ' (every check that is a ratio of demand to capacity at most this; the rules of fact must pass)' : ' (the checks\' own pass)'}.</p>`;
    let anyC = false;
    if (R.uni && R.uni.asked !== 'none') h += `<p class="note">Uniformity: ${R.uni.mode === 'types' ? 'one design for the girder types of each span' : R.uni.mode === 'bridge' ? 'one section and strand pattern for the bridge' : 'none'}${R.uni.why ? ` (${esc(R.uni.why)})` : ''}.${R.cost ? ' What it cost, against a design per girder type (each span\'s first candidate): ' + Object.keys(R.cost).map(s => { const c = R.cost[s]; return c.dW != null ? `span ${s}: weight ${c.dW >= 0 ? '+' : '−'}${fx(Math.abs(c.dW), 1)} kip (${fx(100 * c.pW, 1)} %; ${esc(c.base.name)} ${fx(c.base.W, 1)} → ${esc(c.uni.name)} ${fx(c.uni.W, 1)} kip), strands ${c.dN >= 0 ? '+' : '−'}${Math.abs(c.dN)} (${c.base.strands} → ${c.uni.strands}, all girders)` : `span ${s}: ${c.uni ? 'no design without uniformity' : 'no uniform design'}${c.base ? ` (without: ${esc(c.base.name)}, ${fx(c.base.W, 1)} kip)` : ''}`; }).join('; ') + '.' : ''}</p>`;
    if (R.nb) h += `<p class="note">Girder counts searched: ${esc(R.nb.why)}${multi && R.nb.pick != null ? `; the count with the least concrete in all spans: N<sub>b</sub> = ${R.nb.pick} (chosen by default)` : ''}.</p>`;
    const selNb = [...new Set(R.spans.map(sp => sp.cands[S.sel[sp.s] || 0]).filter(Boolean).map(c => c.nb != null ? c.nb : Q.xs.nb))], nbBad = selNb.length > 1;
    R.spans.forEach(sp => {
      const ks = sp.types, sel = S.sel[sp.s] || 0; labs = sp.labels || {}; if (sp.cands.length) anyC = true;
      h += `<section class="sec" id="ad-span-${sp.s}"><div class="secHead">Span ${sp.s}: candidates (${esc(ks.map(lab).join(', '))})</div><div class="secBody">
        <p class="note">Sections searched: ${esc(sp.why)}, ${R.o.objective === 'depth' ? 'shallowest' : 'lightest'} first. Current design: ${ks.map(k => `${lab(k)}: ${curTxt(Q, k, R)}`).join('; ')}.</p>
        <div class="tscroll"><table class="tbl ad-tbl"><thead><tr><th></th><th class="lft">Section</th>${multi ? '<th>N<sub>b</sub> (S, ft)</th>' : ''}<th>h (in)</th><th>A (in²)</th>${ks.map(k => `<th class="lft">${lab(k)}: strands, f′c / f′ci (ksi), governing check (ratio, line${R.o.maxRatio < 1 ? `; target ${fx(R.o.maxRatio, 2)}` : ''})${R.o.mode === 'refine' ? ', change from the entered design' : ''}</th>`).join('')}<th>Weight (kip, the span's lines${multi ? ', every girder' : ''})</th></tr></thead><tbody>
        ${sp.sections.map(e => { const ci = sp.cands.indexOf(e), cls = ci >= 0 ? (ci === sel ? 'ad-sel' : 'ad-ok') : 'ad-ng';
          return `<tr class="${cls}"><td>${ci >= 0 ? `<input type="radio" name="adsel${sp.s}" data-adsel="${sp.s}|${ci}"${ci === sel ? ' checked' : ''} aria-label="candidate ${ci + 1} of span ${sp.s}">#${ci + 1}` : ''}</td><td class="lft">${esc(e.name)}</td>${multi ? `<td>${e.nb} (${fx(e.S, 2)})</td>` : ''}<td>${fx(e.h, 2)}</td><td>${fx(e.A, 1)}</td>
            ${ks.map(k => { const q = e.types.find(z => z.k === k); if (!q) return '<td class="lft" title="another girder type of the span has no design on this section">not run</td>';
              const b = q.res.best; return b ? `<td class="lft">${b.N} (${b.pattern === 'straight' ? `straight, ${b.nDeb} debonded` : `${b.nh} draped`}), ${fx(b.fc, 1)} / ${fx(b.fci, 1)}, ${govTxt(b.ev.gov, b.ev, R.o)}${R.o.mode === 'refine' ? `; ${esc(distTxt(b))}` : ''}</td>` : `<td class="lft wrap">none: ${esc(q.res.why)}${q.res.closest ? `; closest trial: ${esc(q.res.closest.what)}, fails ${q.res.closest.fails.slice(0, 3).map(n => link(n)).join(', ')}${q.res.closest.fails.length > 3 ? ` and ${q.res.closest.fails.length - 3} more` : ''}` : ''}</td>`; }).join('')}
            <td>${ci >= 0 ? fx(e.W, 1) : '—'}</td></tr>`; }).join('')}
        </tbody></table></div>
        ${sp.cands.length ? detail(Q, sp, sp.cands[sel], lab) : `<div class="alert err">No section passes every check for every girder type of span ${sp.s}.${sp.blocked && sp.blocked.length ? ` Failing on the current design and on the closest trial of every section: ${sp.blocked.map(n => link(n)).join(', ')} (not changed by the variables searched: check those inputs).` : ''}</div>`}
        </div></section>`;
    });
    if (anyC && nbBad) h += `<div class="alert err" role="alert">The candidates chosen have different girder counts (${selNb.join(', ')}): the girder count is one for the bridge; choose candidates of one count in every span to apply.</div>`;
    if (anyC && multi && !nbBad && selNb[0] !== Q.xs.nb && R.nb.notes[selNb[0]]) h += `<p class="note">Apply also changes the layout: ${esc(R.nb.notes[selNb[0]].join('; '))}.</p>`;
    if (anyC) h += `<section class="sec"><div class="secBody"><div class="fRow"><button type="button" class="primary" id="ad_apply"${stale || nbBad ? ' disabled' : ''}>Apply the selected candidate of every span</button></div>
      <p class="note">Apply writes, for every girder type of each span with a candidate, its section, straight rows, draped strands, f′c and f′ci as the type's own inputs (Girders &amp; strands and Materials tabs); with a candidate at another girder count also the count, the bays and the girder types' lines (as a count change on the Cross-section tab) and an entered b<sub>eff</sub> back to the calculated width; nothing else is changed. It is one step of the header's Undo. The tabs then show and work every check of the applied design.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">How the search works (assumptions)</div><div class="secBody"><ul class="note">
      <li>The choice, in order: the lighter section (gross area A; or the shallower, depth h), then fewer strands, then fewer draped strands, then the lower hold-down force (the flatter drape), then the hold-down point nearest 0.40 L, then the lower f′c, then the lower f′ci.</li>
      <li>Per girder type and section: (1) the fewest straight strands that pass Strength I flexure and Service III tension with no draped strand (a lower bound); (2) from there, in pairs, n<sub>h</sub> = 0, 2, … draped strands with the flattest drape that passes every check; (3) the lowest f′c and f′ci that pass with that pattern. The strand search is run at the entered f′c / f′ci first, then at the entered f′c with the highest f′ci it allows, then at the highest f′c and f′ci.</li>
      <li>Assumption (<a href="#rp:rs.adb" data-gotab="rpt">Report, §2, Auto design basis</a>): a higher f′c or f′ci is not worse for any check; a higher y<sub>end</sub> relieves the end; the checks more strands improve are ${esc(AD().GROW.join(', '))}.</li>
      <li>${R.o.pattern === 'draped' ? 'Debonding is never added (PS-12): entered debonding is kept row by row; top strands (rows in the upper half) are kept as entered.' : `Strand pattern: ${R.o.pattern === 'straight' ? 'straight strands with debonding' : 'both draped and straight with debonding, ranked together'} (PS-12 reopened by the engineer for this option, 2026-11-28): the straight design takes no draped strand and does not keep the entered debonding; per N the fewest debonded strands (bottom rows first), then the shortest lengths; top strands kept as entered. The debonding limits are listed on the input tab.`}</li>
      <li>Refine (the Mode setting): the current section of each span is kept; the entered design is tried first; then the strand count from the entered N, fewer first (down to the fewest that passes) and, only when nothing passes at N, more; at each N the draped strands nearest the entered n<sub>h</sub>, the drape nearest the entered one and the f′c / f′ci nearest the entered values; the entered rows are changed by pairs (off the highest row, onto the lowest row they fit, then a new row on the grid). Ranked by |ΔN|, then |Δn<sub>h</sub>|, then the drape change (|Δy<sub>end</sub>|, then |Δ hold-down point|; with no draped strands entered: the flatter drape first), then |Δf′c|, then |Δf′ci|; the passing design with the fewest strands is always listed.</li>
      <li>Target ratio (${fx(R.o.maxRatio, 2)}): ${R.o.maxRatio < 1 ? 'a candidate passes only when every check that is a ratio of demand to capacity is at most the target; the rules of fact (confinement detailing, the LLDF range of applicability, the hold-down force limit, the owners\' f′c, f′ci, age and debonded-share rules) must pass.' : 'the checks\' own pass (1.00).'}</li></ul></div></section>`;
    if (R.log.length) h += `<details class="ad-log"><summary>Trial log (${R.log.length}${R.log.length >= 3000 ? ', the first 3000' : ''})</summary><div class="tscroll"><table class="tbl ad-tbl"><thead><tr><th class="lft">Type</th><th class="lft">Section</th><th class="lft">Trial</th><th>Result</th><th class="lft">Governing (ratio, line)</th></tr></thead><tbody>
      ${R.log.slice(0, 3000).map(q => `<tr><td class="lft">${lab(q.k)}</td><td class="lft">${esc(q.girder)}</td><td class="lft">${esc(q.what)}</td><td>${q.pass ? '<span class="ad-pass">PASS</span>' : `<span class="ad-fail">FAIL</span> ${esc(q.fails.join(', '))}`}</td><td class="lft">${q.gov ? `${esc(q.gov.n)} ${fx(q.gov.r, 3)} (G${q.gov.g})` : '—'}</td></tr>`).join('')}</tbody></table></div></details>`;
    host.innerHTML = h;
    const on = (s, ev, f) => host.querySelectorAll(s).forEach(el => el.addEventListener(ev, f));
    on('#ad_stop2', 'click', () => { S.stop = true; });
    on('[data-adsel]', 'change', e => { const [s, i] = e.target.dataset.adsel.split('|').map(Number); S.sel[s] = i; render(host, ctx); });
    on('#ad_apply', 'click', () => { if (S.key !== keyOf(P)) return;
      const A = AD().apply(P, R, S.sel); if (A.err) { S.err = A.err; render(host, ctx); return; } if (!A.changed.length) return;
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
