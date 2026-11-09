/* apps/steel-bridge/ui/deflection.js — the Deflection output tab of Steel Bridge Design (window.SBDDeflectionUI). Classic script.
   Added 2026-11-09 (DEFL; engineer: "The Steel Bridge Design app should have an output tab for deflection"). Display only: nothing is
   calculated here. Every deflection and camber value is the girder analysis' own (engine/analysis.js analyzeGirder: R.lld, R.camber,
   R.df, R.steps), through the shared analysis cache (report/data.js install), so the Analysis tab, this tab and the Report show the same
   numbers. Needs SBDAnalysis, SBDAnalysisUI (chart, groups), SBDSheets (tenths, at: the Drawings' camber-table points), SharedSteps,
   SharedUnits.
   model(R): the tab's values from an analysis result (plain data, the engine's numbers; tests/engine/deflection-tab.test.mjs compares them
     with the engine):
     ll:  per span { k, L, x, gD, perLane, case, d, lim, ratio, pref, limP, dc = d / lim, status, own } (R.lld; dc is the ratio the
          Analysis tab already showed);
     pts: the tenth points of each span (SBDSheets.tenths), each component by SBDSheets.at (the value at the station where the point
          is a station; linear between the two stations either side where it is not, as the Drawings' camber table); node = the station
          index or −1;
     max: per span the station of the largest total (as the engine's step an.camber.s<k>).
   render(el, ctx): ctx = { P, g (girder index), setG(gi) (the girder selector: the same girder as the Girders & plates tab) }. Results are
   kept until the project or the girder changes; then the tab shows them as out of date and its Calculate button (#df_calc) is pressed by
   the output-tab auto-run (index.html AUTO_BTN). */
(function () {
  'use strict';
  const AN = () => window.SBDAnalysis, AUI = () => window.SBDAnalysisUI, ST = () => window.SharedSteps, U = () => window.SharedUnits, SH = () => window.SBDSheets;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d) => (isFinite(x) ? U().fmt(x, d) : '—');
  const card = (title, body, id) => `<section class="sec"${id ? ` id="${id}"` : ''}><div class="secHead">${title}</div><div class="secBody">${body}</div></section>`;
  const wk = (id, t) => `<a class="wk" href="#st-${esc(id)}">${t || '§'}</a>`;
  const keyOf = (P, gi) => JSON.stringify([P, gi]);
  const S = { R: null, key: '', err: '', busy: false, view: 't10', sel: null, selFor: null, all: null };   // sel: the girder line chosen on this tab (null: the plate girder's own line); all: every line's camber
  const OPEN = new Set();
  const COMP = [['steel', 'Steel + cross-frames'], ['wet', 'Wet deck (deck, haunch, SIP forms)'], ['sd', 'DC2 + DW'], ['ut', 'Existing utilities']];
  const STATUS = { pass: ['--pass', 'PASS'], fail: ['--fail', 'FAIL'], warn: ['--warn', 'PASS (exceeds the preferred limit: warning)'], na: ['--warn', 'Reported, not checked (exterior girder under the owner rule)'] };
  const ptName = t => `Span ${t.k + 1}, ${t.q === 0 ? '0.0L' : t.q === 10 ? '1.0L' : '0.' + t.q + 'L'}`;

  /* ---------- the tab's values (no DOM) ---------- */
  function model(R) {
    if (!R || (R.errors && R.errors.length)) return null;
    const c = R.camber, comps = COMP.filter(([k]) => k !== 'ut' || c.ut).map(([k, name]) => ({ k, name, y: c[k] }));
    const ll = (R.lld || []).map(q => ({ k: q.k, L: q.L, x: q.x, gD: q.gD, perLane: q.perLane, case: q.case, d: q.d, lim: q.lim, ratio: q.ratio, pref: q.pref, limP: q.limP, dc: q.d / q.lim, status: q.status, ok: q.ok, own: q.own }));
    const at = SH().at, node = x => { const i = c.x.findIndex(v => Math.abs(v - x) < 1e-6); return i; };
    const pts = SH().tenths(R.sup).map(t => { const v = {}; comps.forEach(o => { v[o.k] = at(c.x, o.y, t.x); }); v.total = at(c.x, c.total, t.x); return { k: t.k, q: t.q, x: t.x, node: node(t.x), v }; });
    const max = R.spans.map((L, k) => { const a = R.supIdx[k], b = R.supIdx[k + 1]; let i = a; for (let j = a; j <= b; j++) if (c.total[j] > c.total[i]) i = j; return { k, i, x: c.x[i], total: c.total[i] }; });
    return { ll, comps, pts, max, x: c.x, total: c.total, sup: R.sup };
  }

  /* ---------- live load deflection ---------- */
  function llHtml(R, Mo, P, gi, j) {
    const DF = R.df, S0 = R.settings, O = Mo.ll[0] && Mo.ll[0].own, sw = (P.analysis || {}).deflSidewalk || 'auto';
    const swTxt = { auto: 'Automatic (a sidewalk on the Cross-section tab)', yes: 'Yes', no: 'No' }[sw] || esc(sw);
    const xs = P.xs || {}, swXs = ['L', 'R'].some(k => xs.sidewalks && xs.sidewalks[k] && +xs.sidewalks[k].w > 0);
    const why = O
      ? `Owner rule <b>${esc(O.cite)}</b> (OWN19, mandatory): ${esc(O.rule.text)}. Sidewalk or pedestrians: <b>${O.sw ? 'yes' : 'no'}</b> (${O.swHow === 'cross-section sidewalks' ? `automatic: ${swXs ? 'a sidewalk' : 'no sidewalk'} on the <a href="#" data-goto="xsec">Cross-section tab</a>` : 'entered on the <a href="#" data-goto="loads">Loads tab</a>, Analysis settings'}), so <b>L/${O.req}</b>${O.uR > O.req ? `; the L/${O.uR} entered on the <a href="#" data-goto="loads">Loads tab</a> is stricter and is used` : ''}.${O.pref ? ` Preferred limit L/${O.pref} (a warning when exceeded).` : ''}${O.rep ? ` Applied to the typical interior beam only: this plate girder takes cross-section girder G${O.line + 1} (exterior), so it is reported, not checked.` : ''}`
      : `No owner rule for the live load deflection (owner ${esc((P.ownerRules || {}).owner || 'AASHTO')}): the optional criterion of AASHTO LRFD 10th Ed. Art. 2.5.2.6.2, the L/${f(S0.deflLimit, 0)} entered on the <a href="#" data-goto="loads">Loads tab</a> (Analysis settings). 2.5.2.6.2 gives L/800 for vehicular load and L/1000 for vehicular and pedestrian load; with no owner rule the sidewalk setting (Loads tab: ${swTxt}${swXs ? '; the cross-section has a sidewalk' : ''}) does not change the limit, so enter 1000 there for a bridge with pedestrian use.`;
    const dfWhere = DF.manual ? 'entered: <a href="#" data-goto="loads">Loads input tab</a>' : DF.pulled ? 'pulled from LL &amp; DL Distribution: <a href="#" data-goto="loads">Loads input tab</a>'
      : `worked on the <a href="#" data-gotab="loads">Loads &amp; LLDF tab</a>${R.line != null ? ` (cross-section girder G${R.line + 1}, step g<sub>Δ</sub> of each span region)` : ''}`;
    const prefCol = !!(O && O.pref);
    const rows = Mo.ll.map(q => { const st = STATUS[q.status] || ['--ink', q.status];
      return `<tr><td>${q.k + 1}</td><td>${f(q.L, 2)}</td><td>${f(q.x, 2)}</td><td>${f(q.gD, 3)}</td><td>${f(q.perLane, 3)}</td><td class="lft">${esc(q.case || '—')}</td><td><b>${f(q.d, 3)}</b> ${wk('an.defl.LL' + (q.k + 1))}</td>
        <td>L/${q.ratio} = ${f(q.lim, 3)} ${wk('an.defl.lim' + (q.k + 1))}</td>${prefCol ? `<td>${q.limP ? `L/${q.pref} = ${f(q.limP, 3)} ${wk('an.defl.pref' + (q.k + 1))}` : '—'}</td>` : ''}<td>${f(q.dc, 3)}</td><td style="color:var(${st[0]});font-weight:600">${st[1]}</td></tr>`; }).join('');
    const work = Mo.ll.map(q => { const st = STATUS[q.status] || ['--ink', q.status];
      return `<li><b>Span ${q.k + 1}</b> (L = ${f(q.L, 2)} ft; largest at x = ${f(q.x, 2)} ft, governing per-lane case ${esc(q.case || '—')}):<br>
        Δ<sub>lim</sub> = 12L / ${q.ratio} = 12(${f(q.L, 2)}) / ${q.ratio} = <b>${f(q.lim, 3)} in</b> ${wk('an.defl.lim' + (q.k + 1))}<br>
        Δ<sub>LL</sub> = g<sub>Δ</sub> · max(Δ<sub>truck</sub>(1 + IM), 0.25Δ<sub>truck</sub>(1 + IM) + Δ<sub>lane</sub>) = ${f(q.gD, 3)} × ${f(q.perLane, 3)} = <b>${f(q.d, 3)} in</b> ${wk('an.defl.LL' + (q.k + 1))}<br>
        D/C = Δ<sub>LL</sub> / Δ<sub>lim</sub> = ${f(q.d, 3)} / ${f(q.lim, 3)} = <b>${f(q.dc, 3)}</b> → <span style="color:var(${st[0]});font-weight:600">${st[1]}</span>${q.limP ? `; preferred Δ<sub>pref</sub> = 12(${f(q.L, 2)}) / ${q.pref} = ${f(q.limP, 3)} in, Δ<sub>LL</sub> / Δ<sub>pref</sub> = ${f(q.d / q.limP, 3)}` : ''}</li>`; }).join('');
    return card(`Live load deflection, girder ${j != null ? lineName(P, j) : esc(R.girder.label || R.girder.id)} (AASHTO LRFD 10th Ed. Art. 2.5.2.6.2, 3.6.1.3.2)`, `
      <div class="tscroll"><table class="tbl"><thead><tr><th>Span</th><th>L (ft)</th><th>x (ft)</th><th>g<sub>Δ</sub></th><th>Δ per lane (in)</th><th class="lft">Governing case</th><th>Δ<sub>LL+IM</sub> (in)</th><th>Δ<sub>lim</sub> (in)</th>${prefCol ? '<th>Preferred (in)</th>' : ''}<th>D/C</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note"><b>Limit:</b> ${why}</p>
      <p class="note"><b>Loading (3.6.1.3.2):</b> the larger of the design truck alone and 25 % of the design truck with the design lane load, IM ${f(S0.im, 0)} % on the truck (not on the lane), per lane; the engine keeps the larger of the two at each section and names the governing one. Truck axles that do not add to the deflection are neglected (3.6.1.3.1). Sections at the 1/20 points of each span; stiffness: short-term composite n${R.crack.length ? ', cracked zones as below' : ''}.</p>
      <p class="note"><b>Distribution factor for deflection g<sub>Δ</sub>:</b> all design lanes loaded and all girders deflecting equally (2.5.2.6.2), multiple presence included; ${esc(DF.src)}; ${dfWhere}. By span: ${Mo.ll.map(q => `span ${q.k + 1} ${f(q.gD, 3)}`).join(', ')}.</p>
      <ul class="note" style="margin:6px 0 0 18px;padding:0">${work}</ul>`, 'df-ll');
  }

  /* ---------- dead-load deflections and camber ---------- */
  function dlHtml(R, Mo, nm) {
    const c = R.camber, sup = R.sup, chart = AUI() && AUI().chart;
    const ser = Mo.comps.map(o => ({ name: o.name, y: o.y })).concat([{ name: 'Total (camber)', y: c.total, c: '#0F172A', w: 2 }]);
    const fig = chart ? chart(c.x, ser, { title: 'Dead-load deflected shape along the girder (downward +, drawn down)', unit: 'in', sup, invert: true }) : '';
    const head = `<th class="lft">Point</th><th>x (ft)</th>${Mo.comps.map(o => `<th>${esc(o.name)}</th>`).join('')}<th>Total = camber</th>`;
    let body;
    if (S.view === 'all') body = c.x.map((x, i) => `<tr><td class="lft">${R.supIdx.includes(i) ? (i === 0 ? 'Abut. 1' : i === c.x.length - 1 ? 'Abut. 2' : 'Pier ' + R.supIdx.indexOf(i)) : ''}</td><td>${f(x, 2)}</td>${Mo.comps.map(o => `<td>${f(o.y[i], 3)}</td>`).join('')}<td><b>${f(c.total[i], 3)}</b></td></tr>`).join('');
    else body = Mo.pts.map(t => `<tr${t.q === 10 || t.q === 0 ? ' style="background:#F8FAFC"' : ''}><td class="lft">${ptName(t)}</td><td>${f(t.x, 2)}${t.node < 0 ? ' *' : ''}</td>${Mo.comps.map(o => `<td>${f(t.v[o.k], 3)}</td>`).join('')}<td><b>${f(t.v.total, 3)}</b></td></tr>`).join('');
    const anyInt = Mo.pts.some(t => t.node < 0);
    const maxRows = Mo.max.map(m => `<tr><td>${m.k + 1}</td><td>${f(m.x, 2)}</td>${Mo.comps.map(o => `<td>${f(o.y[m.i], 3)}</td>`).join('')}<td><b>${f(m.total, 3)}</b> ${wk('an.camber.s' + (m.k + 1))}</td></tr>`).join('');
    return card(`Dead-load deflections and camber, girder ${nm || esc(R.girder.label || R.girder.id)} (AASHTO LRFD 10th Ed. Art. 6.7.2)`, `${fig}
      <div class="tscroll"><table class="tbl"><thead><tr><th>Span</th><th>x of largest total (ft)</th>${Mo.comps.map(o => `<th>${esc(o.name)}</th>`).join('')}<th>Total = camber (in)</th></tr></thead><tbody>${maxRows}</tbody></table></div>
      <p class="note"><b>Camber = the total dead-load deflection = the sum of its components:</b> Δ<sub>DL</sub> = Δ<sub>steel</sub> + Δ<sub>wet</sub> + Δ<sub>DC2+DW</sub>${c.ut ? ' + Δ<sub>UT</sub>' : ''}; the girder is cambered upward by the total (plus the vertical profile, not in this app). At midspan:</p>
      <ul class="note" style="margin:2px 0 6px 18px;padding:0">${Mo.pts.filter(t => t.q === 5).map(t => `<li>Span ${t.k + 1}, 0.5L (x = ${f(t.x, 2)} ft): ${Mo.comps.map(o => f(t.v[o.k], 3)).join(' + ')} = <b>${f(t.v.total, 3)} in</b></li>`).join('')}</ul>
      <p class="note">Each span's largest value is worked in the steps below (§).</p>
      <div class="fRow"><label for="df_view">Table</label><select id="df_view"><option value="t10"${S.view !== 'all' ? ' selected' : ''}>Tenth points of each span</option><option value="all"${S.view === 'all' ? ' selected' : ''}>Every analysis station</option></select><span class="unit">in, downward +</span></div>
      <div class="tscroll" style="max-height:440px;overflow-y:auto"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>
      <p class="note">${S.view === 'all' ? `The analysis stations (${c.x.length}), the engine's values.` : `Tenth points of each span, as the Drawings' camber table.${anyInt ? ' * The tenth point falls between two analysis stations: the value is linear between them (the stations are about 1 ft apart; "Every analysis station" lists the engine values).' : ' Every tenth point is an analysis station: the values are the engine\'s.'}`} Vertical profile (grade, vertical curve): this app has no profile input, so the camber here excludes it; add the profile ordinates for the fabrication camber.</p>`, 'df-dl');
  }

  function notesHtml(R, P) {
    const S0 = R.settings, crack = R.crack.length ? `cracked zones ${R.crack.map(([a, b]) => `${f(a, 1)}–${f(b, 1)} ft`).join(', ')} (<a href="#" data-gotab="an">Analysis tab</a>, step an.crack; Loads tab setting: ${S0.crack === '15' ? '15 % of the spans either side of each pier' : 'negative dead-load moment region'})` : `no cracked zones (Loads tab setting: ${S0.crack === 'none' ? 'none' : S0.crack === '15' ? '15 % either side of each pier' : 'negative dead-load moment region'}${R.cont ? '' : '; simple spans'})`;
    const own = P.ownerRules && P.ownerRules.owner, ctx = own === 'CTDOT' ? '<li>The CTDOT extra camber of L/100 on simple spans (owner rule OWN33, BRSDM V1B): not applied by this app.</li>' : '';
    return card('What is included', `<ul class="note" style="margin:4px 0 0 18px;padding:0">
      <li><b>Steel + cross-frames:</b> girder steel A<sub>s</sub> × 490 pcf × (1 + ${f(R.loads.steelAllowPct, 1)} % detail allowance; <a href="#" data-gotab="an">Analysis tab</a>, steps an.wst*) and the cross-frame point loads, on the steel section I<sub>s</sub>.</li>
      <li><b>Wet deck:</b> deck, haunch and SIP forms (DC1 wet, ${f(R.loads.DC1wet, 4)} klf), the whole deck at once on the steel section I<sub>s</sub>.</li>
      <li><b>DC2 + DW:</b> ${f(R.loads.DC2, 4)} + ${f(R.loads.DW, 4)} klf on the long-term composite section (3n)${R.h0 ? ', haunch taken as 0 in the composite stiffness (owner rule OWN8 or the Loads tab setting)' : ''}; ${crack}.</li>
      ${R.camber.ut ? `<li><b>Existing utilities:</b> ${f(R.loads.UT, 4)} klf on the steel section I<sub>s</sub>.</li>` : ''}
      <li><b>Live load:</b> HL-93 on the short-term composite section (n), with the same cracked zones, × g<sub>Δ</sub>.</li>
      <li>Exact beam deflections of the shared beam engine (stiffness method, the stiffness of each plate segment, loads applied exactly); ${R.cont ? 'continuous spans' : 'simple spans'}. Downward positive.</li></ul>
      <p class="note" style="margin-top:6px"><b>Not included:</b></p><ul class="note" style="margin:4px 0 0 18px;padding:0">
      <li>The deck placement sequence${R.seq ? ` (${R.seq.pours.length} pours, on the Analysis tab)` : ''}: it enters the noncomposite moments M<sub>DCc</sub> only; the wet-deck camber is for the whole deck placed at once on the steel section.</li>
      <li>The future utility allowance, the construction live load, the finishing machine and the pedestrian load (not in the camber; the pedestrian load is not in the LL deflection either).</li>
      <li>Creep and shrinkage of the deck, bearing and support settlements, and the vertical profile (no profile input in this app).</li>${ctx}</ul>`, 'df-notes');
  }

  /* the worked steps of the deflection topics (the engine's steps an.defl.* and an.camber.*: the same steps as before, moved here
     from the Analysis tab, which keeps the rest) */
  const isDefl = s => /^an\.(defl\.|camber)/.test(s.id);
  function stepsHtml(R) {
    const list = R.steps.filter(isDefl), G = AUI() && AUI().groups ? AUI().groups('x', list) : null;
    const item = q => `<li id="st-${esc(q.id)}"${q.ok === false ? ' class="no"' : ''}><div class="lbl">${window.SBDSub.html(q.label)}${q.ref ? `<span class="ref">${esc(q.ref)}</span>` : ''}</div><div>${ST().line(q, true)}</div>${q.note ? `<div class="nt">${window.SBDSub.html(q.note)}</div>` : ''}</li>`;
    return card('Worked steps', `<p class="note">AASHTO LRFD 10th Ed. (2024). The engine's own steps (the same ids as before; the analysis' other steps are on the <a href="#" data-gotab="an">Analysis tab</a>: the girder steel weight, the cracked zones, the stiffness of each segment).</p>${G ? ST().groupsHTML(G, { open: OPEN, item }) : `<ul class="steps">${list.map(item).join('')}</ul>`}`, 'df-steps');
  }

  /* ---------- girder lines (DFG, 2026-11-09: every cross-section girder G1…Gn, not only the plate girders) ----------
     The project's girders P.girders are plate girders (sets of plates); each is analysed on one cross-section girder line (lineOf: its
     "Cross-section girder" choice, else the first interior / exterior line). A line with no plate girder of its own takes the plates of
     the plate girder the Drawings give it (SBDDrawings.plateGirderOf, SB2-DW1). lineRun(P, j, opt) is the analysis of line j: the same
     engine call (analyzeGirder) on that plate girder, with its "Cross-section girder" set to line j in a copy of the project, so that the
     loads module gives line j's own dead loads (deck and overhang, DC2 and DW distribution, cross-frame point loads) and factors. On a
     plate girder's own line it is the plain analyzeGirder(P, pg) (the same result and cache entry as the other tabs). Nothing else changes. */
  const nbOf = P => { const xs = P.xs || (window.SBDModel && window.SBDModel.defaultXs ? window.SBDModel.defaultXs(P) : null); return xs ? Math.round(xs.nb) : 0; };
  function plateOf(P, j) {
    const D = window.SBDDrawings; if (D && D.plateGirderOf) return D.plateGirderOf(P, j, nbOf(P));
    const k = P.girders.findIndex(g => AN().lineOf(P, g) === j); return k >= 0 ? k : 0;
  }
  const lineName = (P, j) => { const nb = nbOf(P); return `G${j + 1}${j === 0 || j === nb - 1 ? ' (exterior)' : ' (interior)'}`; };
  const pgName = (P, pg) => { const g = P.girders[pg] || {}; return esc(g.label || g.id || 'G' + (pg + 1)); };
  function lineRun(P, j, opt) {
    const nb = nbOf(P);
    if (!(nb > 0)) { const pg = 0; return { j: AN().lineOf(P, P.girders[pg]), pg, own: true, R: AN().analyzeGirder(P, pg, opt) }; }
    const pg = plateOf(P, j), g = P.girders[pg], own = AN().lineOf(P, g) === j;
    if (own) return { j, pg, own, R: AN().analyzeGirder(P, pg, opt) };
    if (g.loads && g.df) return { j, pg, own, err: `Plate girder ${g.label || g.id} carries the dead loads and factors of a hand-off for one girder line; girder line G${j + 1} cannot take them. Give G${j + 1} a plate girder of its own (Girders & plates tab).` };
    const Q = JSON.parse(JSON.stringify(P)); Q.girders[pg].line = j;
    return { j, pg, own, R: AN().analyzeGirder(Q, pg, opt) };
  }
  /* every line's camber (dead loads only: opt.ll = false gives the same camber, computed before the live load) */
  function allLines(P) {
    const nb = nbOf(P); if (!(nb > 0)) return [];
    return [...Array(nb)].map((_, j) => { let r; try { r = lineRun(P, j, { ll: false }); } catch (e) { r = { j, pg: plateOf(P, j), err: String((e && e.message) || e) }; }
      if (r.R && r.R.errors && r.R.errors.length) { r.err = r.R.errors.map(x => x.msg || x).join(' '); r.R = null; }
      return { j, pg: r.pg, own: r.own, err: r.err || '', camber: r.R ? r.R.camber : null, sup: r.R ? r.R.sup : null, supIdx: r.R ? r.R.supIdx : null }; });
  }

  function lineSel(P, j) {
    const nb = nbOf(P);
    if (!(nb > 0)) return `<div class="fRow"><label for="df_g">Girder</label><select id="df_g">${P.girders.map((g, i) => `<option value="${i}">${pgName(P, i)}</option>`).join('')}</select></div>`;
    return `<div class="fRow"><label for="df_line">Girder</label><select id="df_line">${[...Array(nb)].map((_, k) => { const pg = plateOf(P, k), own = AN().lineOf(P, P.girders[pg]) === k;
      return `<option value="${k}"${k === j ? ' selected' : ''}>${lineName(P, k)} — plates of ${pgName(P, pg)}${own ? '' : ' (no plate girder of its own)'}</option>`; }).join('')}</select><span class="unit">every girder of the cross-section; each with its own dead loads and factors</span></div>`;
  }

  /* the camber of every girder line at the tenth points (the plans' camber table); each girder's column opens it */
  function allHtml(P, A, j) {
    if (!A || !A.length) return '';
    const ok = A.find(a => a.camber); if (!ok) return card('Camber of every girder', `<div class="alert err">${A.map(a => `G${a.j + 1}: ${esc(a.err)}`).join('<br>')}</div>`, 'df-all');
    const pts = SH().tenths(ok.sup), at = SH().at;
    const head = `<th class="lft">Point</th><th>x (ft)</th>${A.map(a => `<th${a.j === j ? ' style="background:#E0ECFF"' : ''}><a href="#" data-dfline="${a.j}" title="Show girder G${a.j + 1}">G${a.j + 1}</a>${a.j === 0 || a.j === A.length - 1 ? '<br><span class="note">ext.</span>' : ''}</th>`).join('')}`;
    const rows = pts.map(t => `<tr${t.q === 0 || t.q === 10 ? ' style="background:#F8FAFC"' : ''}><td class="lft">${ptName(t)}</td><td>${f(t.x, 2)}</td>${A.map(a => `<td${a.j === j ? ' style="font-weight:600"' : ''}>${a.camber ? f(at(a.camber.x, a.camber.total, t.x), 3) : '—'}</td>`).join('')}</tr>`).join('');
    const mx = `<tr><td class="lft"><b>Largest</b></td><td></td>${A.map(a => { if (!a.camber) return '<td>—</td>'; let i = 0; a.camber.total.forEach((v, k) => { if (v > a.camber.total[i]) i = k; }); return `<td><b>${f(a.camber.total[i], 3)}</b><br><span class="note">x = ${f(a.camber.x[i], 1)}</span></td>`; }).join('')}</tr>`;
    const errs = A.filter(a => a.err).map(a => `G${a.j + 1}: ${esc(a.err)}`);
    return card('Camber of every girder (total dead-load deflection, tenth points)', `<div class="tscroll" style="max-height:440px;overflow-y:auto"><table class="tbl"><thead><tr>${head}</tr></thead><tbody>${rows}${mx}</tbody></table></div>
      ${errs.length ? `<div class="alert err">${errs.join('<br>')}</div>` : ''}
      <p class="note">in, downward +; camber = Δ<sub>steel</sub> + Δ<sub>wet</sub> + Δ<sub>DC2+DW</sub>${A.some(a => a.camber && a.camber.ut) ? ' + Δ<sub>UT</sub>' : ''} of each girder (its own dead loads: deck and overhang, DC2 and DW shares, cross-frame point loads; the plates of its plate girder). Each girder at the same fraction of its span (centerline spans). Click a girder to see its components, LL deflection and worked steps. Excludes the vertical profile.</p>`, 'df-all');
  }

  function render(el, ctx) {
    const P = ctx.P, nb = nbOf(P), gi = Math.min(ctx.g || 0, P.girders.length - 1);
    if (S.selFor !== gi) { S.sel = null; S.selFor = gi; }   // the plate girder chosen elsewhere (Girders & plates tab, Summary): its own line
    const j = nb > 0 ? (S.sel != null && S.sel < nb ? S.sel : AN().lineOf(P, P.girders[gi])) : null;
    const key = keyOf(P, gi) + '|' + j, stale = (!S.R && !S.err) || S.key !== key;
    let h = `<div class="alert stale"${stale && !S.busy ? '' : ' hidden'}><span>${S.R || S.err ? 'Deflection results are out of date: inputs changed.' : 'Not calculated yet.'} The live load takes a few seconds unless the analysis of this girder is already in the cache.</span><button type="button" class="primary" id="df_calc">Calculate</button></div>`;
    if (S.busy) h += '<div class="alert">Calculating…</div>';
    h += lineSel(P, j);
    const pg = j != null ? plateOf(P, j) : gi, own = j == null || AN().lineOf(P, P.girders[pg]) === j;
    h += `<p class="note">Live load deflection check and dead-load deflections (camber) of girder <b>${j != null ? lineName(P, j) : pgName(P, gi)}</b>${j != null ? `, with the plates of plate girder <b>${pgName(P, pg)}</b>` : ''}, from its analysis (the engine of the <a href="#" data-gotab="an">Analysis tab</a>; nothing is calculated differently here). Inputs: <a href="#" data-goto="loads">Loads tab</a> (analysis settings, L/…, sidewalk, cracked zones).</p>`;
    if (!own) { const g = P.girders[pg], ext = j === 0 || j === nb - 1;
      h += `<div class="alert">Girder ${lineName(P, j)} has no plate girder of its own: it takes the plates and the effective flange width b<sub>eff</sub> = ${f(g.beff, 1)} in of plate girder ${pgName(P, pg)} (${esc(g.position || '')}), as the Drawings do (SB2-DW1). Its dead loads and distribution factors are its own (loads module, cross-section girder G${j + 1}).${ext !== (g.position === 'exterior') ? ` An ${ext ? 'exterior' : 'interior'} girder's b<sub>eff</sub> (and so its composite stiffness) differs: add an ${ext ? 'exterior' : 'interior'} plate girder on the <a href="#" data-goto="gird">Girders &amp; plates tab</a> for its own plates and b<sub>eff</sub>.` : ''}</div>`; }
    if (!stale && S.err) h += `<div class="alert err"><b>Analysis error.</b> ${esc(S.err)}</div>`;
    else if (!stale && S.R) {
      const R = S.R, Mo = model(R);
      if (R.warnings && R.warnings.length) h += `<div class="alert">${R.warnings.map(esc).join('<br>')}</div>`;
      if (!own && ['DC1wet', 'DC2', 'DW'].some(k => R.loads.src[k] === 'manual')) h += `<div class="alert">Dead loads entered on the Loads tab for plate girder ${pgName(P, pg)} (Override calculated value) apply to every girder line that takes its plates, this one too.</div>`;
      h += allHtml(P, S.all, j) + llHtml(R, Mo, P, gi, j) + dlHtml(R, Mo, j != null ? lineName(P, j) : null) + notesHtml(R, P) + stepsHtml(R);
    }
    el.innerHTML = h;
    ST().wire(el, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    el.querySelectorAll('[data-gotab]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const b = document.querySelector(`#tabBar [data-otab="${a.dataset.gotab}"]`); if (b) b.click(); }));
    el.oninput = null;
    const pick = k => { const q = plateOf(P, k); S.sel = k;
      if (q !== gi && ctx.setG) { S.selFor = q; ctx.setG(q); } else render(el, ctx); };
    el.onchange = e => {
      if (e.target.id === 'df_view') { S.view = e.target.value; render(el, ctx); return; }
      if (e.target.id === 'df_line') { pick(Number(e.target.value)); return; }
      if (e.target.id === 'df_g' && ctx.setG) ctx.setG(Number(e.target.value));
    };
    el.onclick = e => {
      const a = e.target.closest && e.target.closest('[data-dfline]'); if (a) { e.preventDefault(); pick(Number(a.dataset.dfline)); return; }
      if (e.target.id !== 'df_calc') return; S.busy = true; render(el, ctx);
      setTimeout(() => { S.err = ''; S.R = null;
        try { const r = j != null ? lineRun(P, j) : { R: AN().analyzeGirder(P, gi) }; if (r.err) S.err = r.err; else if (r.R.errors && r.R.errors.length) S.err = r.R.errors.map(x => x.msg || x).join(' '); else S.R = r.R; } catch (err) { S.err = String((err && err.message) || err); }
        try { S.all = allLines(P); } catch (err) { S.all = null; }
        S.key = key; S.busy = false; render(el, ctx); }, 30); };
  }
  /* summary(R): the one line the Analysis tab keeps (largest live-load D/C and the largest camber), as text pieces */
  function summary(R) {
    const Mo = model(R); if (!Mo) return null;
    const chk = Mo.ll.filter(q => q.status !== 'na'), top = (chk.length ? chk : Mo.ll).reduce((a, q) => (!a || q.dc > a.dc ? q : a), null), cm = Mo.max.reduce((a, m) => (!a || m.total > a.total ? m : a), null);
    return { top, cm, ok: chk.every(q => q.status !== 'fail') };
  }
  window.SBDDeflectionUI = { render, model, summary, lineRun, allLines, plateOf, nbOf };
})();
