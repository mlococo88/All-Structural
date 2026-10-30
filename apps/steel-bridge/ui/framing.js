/* apps/steel-bridge/ui/framing.js — the "Framing" input tab (cross-frame layout with a plan sketch, cross-frame members, wind, stability
   bracing, diaphragm, weight in DC1) and the "Cross-frames" output tab (window.SBDFramingUI), from engine/framing.js and
   engine/crossframes.js. Classic script; needs SharedSteps, SharedUnits, SBDModel, SBDOwners, SBDSections, SBDFlexure, SBDFraming,
   SBDCrossframes; uses SBDAnalysis when loaded (the deck-placement moment of the stability bracing check).

   Inputs are saved in the project (P.framing, P.crossframes). The output tab works the layout (per span and per girder), the flange lateral
   bending from skew (C6.10.1) that the Flexure tab takes, the cross-frame weight in DC1 that the Analysis tab takes, and the member and
   connection checks CF1 to CF11 (CFD, CFE with the diaphragm), with every value linked (§) to its worked step.

   ensure(P), inputs(P, h, ui), onChange(el, P), onClick(e, P, ui) for the input tab; render(host, ctx) for the output tab, ctx = { P, g };
   build(ctx) (tests); plan(L) (the SVG). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const cls = r => !isFinite(r) ? '' : r > 1 + 1e-9 ? 'fx-ng' : r >= 0.9 ? 'fx-hi' : 'fx-ok';
  const S = { key: '', R: null, sel: null };

  /* ---------- input tab ---------- */
  function ensure(P) { const M = window.SBDModel; if (!P.framing) P.framing = M.defaultFraming(); if (!P.crossframes) P.crossframes = M.defaultCrossframes(); return P; }
  /* plan(L): the framing plan as SVG: girders (blue), support lines (skewed), end and intermediate cross-frames, field splices (ticks) */
  function plan(L) {
    const FR = L.FR, m = L.m, W = 720, pad = 34, ys = FR.ys, yMax = ys[ys.length - 1];
    const xs0 = Math.min(...FR.girders.map(g => g.x0)), xs1 = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])), sx = (W - 2 * pad) / Math.max(xs1 - xs0, 1);
    const Hp = Math.max(60, Math.min(260, yMax * sx * 2.2)), sy = Hp / Math.max(yMax, 1), X = x => pad + (x - xs0) * sx, Y = y => 22 + y * sy;
    let o = '';
    m.sup.forEach((_, k) => o += `<line x1="${X(FR.xb(k, 0)).toFixed(1)}" y1="${(Y(0) - 8).toFixed(1)}" x2="${X(FR.xb(k, ys.length - 1)).toFixed(1)}" y2="${(Y(yMax) + 8).toFixed(1)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 3"/><text x="${X(FR.xb(k, 0)).toFixed(1)}" y="12" font-size="9" text-anchor="middle" fill="#475569">${k === 0 ? 'Abut. 1' : k === m.sup.length - 1 ? 'Abut. 2' : 'Pier ' + k}</text>`);
    FR.frames.forEach(f => o += `<line x1="${X(f.xa).toFixed(1)}" y1="${Y(ys[f.bay]).toFixed(1)}" x2="${X(f.xc).toFixed(1)}" y2="${Y(ys[f.bay + 1]).toFixed(1)}" stroke="${f.type === 'sup' ? '#B45309' : '#16304F'}" stroke-width="${f.type === 'sup' ? 2.2 : 1.3}"/>`);
    FR.girders.forEach(g => { o += `<line x1="${X(g.x0).toFixed(1)}" y1="${Y(g.y).toFixed(1)}" x2="${X(g.x0 + g.bear[g.bear.length - 1]).toFixed(1)}" y2="${Y(g.y).toFixed(1)}" stroke="#2563EB" stroke-width="2.4"/><text x="${(pad - 6)}" y="${(Y(g.y) + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#1E3A5F">G${g.i + 1}</text>`;
      m.splices.forEach(s => { const xg = g.x0 + s; o += `<line x1="${X(xg).toFixed(1)}" y1="${(Y(g.y) - 4).toFixed(1)}" x2="${X(xg).toFixed(1)}" y2="${(Y(g.y) + 4).toFixed(1)}" stroke="#DC2626" stroke-width="1.6"/>`; }); });
    const H = Y(yMax) + 26;
    return `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" style="width:100%;height:auto;background:#fff;border:1px solid #e4e7eb;border-radius:4px" role="img" aria-label="Framing plan: girders, supports and cross-frames">${o}
      <text x="${pad}" y="${(H - 6).toFixed(0)}" font-size="9" fill="#475569">Plan, to scale along the bridge (vertical scale exaggerated). Blue: girders; brown: end cross-frames on the bearing lines; navy: intermediate cross-frames; red ticks: field splices.</text></svg>`;
  }
  function inputs(P, h) {
    ensure(P); const F = P.framing, C = P.crossframes, CF = window.SBDCrossframes, FRM = window.SBDFraming;
    let L = null; try { L = FRM.compute(P); } catch (e) { L = { errors: [e.message] }; }
    const ang = [...Object.keys(CF.ANGLES).map(s => [s, s]), ['custom', 'Custom angle']], grs = Object.keys(CF.GD_GR).map(k => [k, k]);
    const mem = k => `${h.sel(`crossframes.mem.${k}.sec`, { top: 'Top chord', bot: 'Bottom chord', diag: 'Diagonals' }[k], ang)}${C.mem[k].sec === 'custom' ? `${h.num(`crossframes.mem.${k}.b1`, 'Connected leg', 'in')}${h.num(`crossframes.mem.${k}.b2`, 'Outstanding leg', 'in')}${h.num(`crossframes.mem.${k}.t`, 'Thickness', 'in')}` : ''}`;
    const usr = k => `${h.num(`crossframes.user.${k}.top`, 'Top chord', 'kip')}${h.num(`crossframes.user.${k}.bot`, 'Bottom chord', 'kip')}${h.num(`crossframes.user.${k}.diag`, 'Diagonals', 'kip')}`;
    const shapes = [...CF.CF_DIA.map(s => [s[0], s[0]]), ...CF.CF_CH.map(s => [s[0], `${s[0]} (channel)`]), ['custom', 'Custom W']];
    return h.card('Cross-frame layout (6.7.4.2.1)', `${h.num('framing.spacing', 'Cross-frame spacing s, at most', 'ft')}${h.num('framing.spPier', 'Spacing near interior supports s<sub>p</sub>', 'ft', { text: true })}${h.num('framing.pierLen', 'Pier region each side (blank: 0.25L)', 'ft', { text: true })}
        ${h.sel('framing.orient', 'Orientation', [['auto', 'Automatic: parallel to the skew where both supports ≤ 20°, else normal'], ['parallel', 'Parallel to the skew'], ['normal', 'Normal to the girders']])}
        ${h.sel('framing.arrange', 'Normal frames', [['contiguous', 'Contiguous'], ['staggered', 'Staggered'], ['stepped', 'Stepped (lines parallel to the bearings)']])}
        ${h.num('framing.supClear', 'Clear distance from the bearings', 'ft')}${h.num('framing.stagMin', 'Least offset between frames on one girder', 'ft')}
        <div class="fRow"><label for="fr_spl">Field splices</label><input type="text" id="fr_spl" data-fr="splices" value="${esc((F.splices || []).join(', '))}" style="width:180px"><span class="unit">ft, comma separated</span></div>
        ${h.num('framing.spliceClear', 'Frames clear of splices and transitions', 'ft')}
        <p class="note">Girders, spacings and support skews: Cross-section &amp; loads tab. The plates of every girder give the shop transitions. Frames normal to the girders at a support skewed more than 20° start at least max(clear, 4b<sub>f</sub>, 0.4s) from the obtuse bearing (C6.7.4.2.1); corner frames close longer panels. Owner rule xf.orient applies with the automatic orientation.</p>
        ${L && !L.errors.length ? plan(L) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`}`)
      + h.card('Flange lateral bending from skew (C6.10.1)', `${h.num('framing.flSkI', 'f<sub>ℓ</sub>, interior girders', 'ksi')}${h.num('framing.flSkE', 'f<sub>ℓ</sub>, exterior girders', 'ksi')}${h.num('framing.flSkG', 'Load factor on f<sub>ℓ</sub>', '')}
        <p class="note">Used where any support is skewed more than 20°, in lieu of a refined analysis (as GirderDetail): the Flexure tab takes it with a hand-off file of this bridge.</p>`)
      + h.card('Cross-frames: geometry and members', `${h.sel('crossframes.type', 'Type', [['X', 'X-frame'], ['Kb', 'K-frame, diagonals meet at the bottom chord'], ['Kt', 'K-frame, diagonals meet at the top chord']])}
        ${h.num('crossframes.h', 'Chord work-point depth h (blank: from D)', 'in', { text: true })}${h.num('crossframes.dMinXF', 'Minimum girder depth for cross-frames', 'in')}
        ${h.sel('crossframes.primary', 'Primary members', [['auto', 'Automatic (yes where a support is skewed > 20°)'], ['no', 'No'], ['yes', 'Yes']])}
        ${h.sel('crossframes.gA', 'Angle grade', grs)}${h.sel('crossframes.gG', 'Gusset grade', grs)}${mem('top')}${mem('bot')}${mem('diag')}
        <h4 class="sub">End connections</h4>${h.sel('crossframes.conn.d', 'Bolt diameter', [['0.875', '7/8 in'], ['1', '1 in']])}${h.sel('crossframes.conn.gr', 'Grade', [['A325', 'F3125 A325'], ['A490', 'F3125 A490']])}
        ${h.sel('crossframes.conn.thr', 'Threads', [['incl', 'Included'], ['excl', 'Excluded']])}${h.num('crossframes.conn.n', 'Bolts per member end', '')}${h.num('crossframes.conn.s', 'Pitch', 'in')}${h.num('crossframes.conn.e', 'End distance', 'in')}${h.num('crossframes.conn.tg', 'Gusset thickness', 'in')}
        <p class="note">S (largest girder spacing), the girder depth d and L<sub>b</sub> (largest unbraced length on any girder) come from the project and the layout.</p>`)
      + h.card('Wind on the exterior girder (3.8.1.2.1, 4.6.2.7.1)', `${h.num('crossframes.wind.V', 'Design wind speed V', 'mph')}${h.num('crossframes.wind.Kz', 'K<sub>z</sub>', '')}${h.num('crossframes.wind.G', 'Gust factor G', '')}${h.num('crossframes.wind.Cd', 'Drag coefficient C<sub>D</sub>', '')}`)
      + h.card('Stability bracing during deck placement (6.7.4.2.2)', `${h.sel('crossframes.sb.on', 'Check stability bracing', [['yes', 'Yes'], ['no', 'No']])}${h.sel('crossframes.sb.full', 'Depth and connection plates', [['auto', 'Automatic (h ≥ 0.8D: full depth)'], ['yes', '≥ 0.8 girder depth, full-depth plates (2.4)'], ['no', 'Otherwise (3.6)']])}
        ${h.num('crossframes.sb.Mu', 'Factored deck-placement M<sub>u</sub> (blank: analysis)', 'kip-ft', { text: true })}${h.num('crossframes.sb.Cb', 'C<sub>b</sub>', '')}
        ${h.num('crossframes.sb.bs', 'Connection plate b<sub>s</sub> (no connection-plate type)', 'in')}${h.num('crossframes.sb.tsp', 'Connection plate t<sub>s</sub>', 'in')}`)
      + h.card('Member forces from a refined analysis (optional)', `<p class="note">Factored, tension positive; they add to the wind and brace forces.</p><h4 class="sub">Strength I</h4>${usr('StrI')}<h4 class="sub">Constructibility</h4>${usr('Con')}<h4 class="sub">Fatigue ranges ΔP</h4>${usr('Fat')}
        ${h.sel('crossframes.fatCat', 'Member end detail', [['B', 'Bolted, slip-critical (B)'], ['E', 'Welded end connection (E)'], ['Ep', 'Welded, eccentric (E′)']])}`)
      + h.card('Diaphragm in place of the cross-frame', `${h.sel('crossframes.dia.on', 'Intermediate bracing used', [['no', 'Cross-frame (angles)'], ['yes', 'Diaphragm: channel or rolled W']])}${C.dia.on === 'yes' ? `${h.sel('crossframes.dia.shape', 'Shape', shapes)}
        ${C.dia.shape === 'custom' ? `${h.num('crossframes.dia.d', 'Depth d', 'in')}${h.num('crossframes.dia.bf', 'Flange width', 'in')}${h.num('crossframes.dia.tf', 'Flange thickness', 'in')}${h.num('crossframes.dia.tw', 'Web thickness', 'in')}` : ''}
        ${h.sel('crossframes.dia.gr', 'Grade', [['36', '36'], ['50', '50']])}${h.num('crossframes.dia.nb', 'Bolts per end (one row)', '')}${h.num('crossframes.dia.pitch', 'Bolt pitch', 'in')}${h.num('crossframes.dia.ecc', 'Bolt line from the girder web', 'in')}
        ${h.sel('crossframes.dia.end', 'Jacking at the end diaphragms', [['no', 'No'], ['yes', 'Yes']])}${h.num('crossframes.dia.Rj', 'Jacking reaction R<sub>j</sub>', 'kip')}${h.num('crossframes.dia.aj', 'at a<sub>j</sub> from the girder', 'in')}` : ''}`)
      + h.card('Cross-frame weight in DC1', `${h.sel('crossframes.weight.mode', 'Weight', [['auto', 'From the member sizes (or the diaphragm)'], ['ovr', 'Entered per frame'], ['off', 'Not included']])}${h.num('crossframes.weight.allow', 'Gusset plates and bolts', '%')}
        ${C.weight.mode === 'ovr' ? `${h.num('crossframes.weight.Wi', 'Intermediate frame', 'kip', { text: true })}${h.num('crossframes.weight.We', 'End frame (blank: same)', 'kip', { text: true })}` : ''}
        <p class="note">Each frame puts half its weight on each girder it connects, at that girder's own station, on the steel section (DC1; GirderDetail XF1). The Analysis tab uses these point loads.</p>`);
  }
  function onChange(el, P) {
    if (el.dataset && el.dataset.fr === 'splices') { ensure(P); P.framing.splices = el.value.split(/[,;\s]+/).map(Number).filter(v => isFinite(v) && v > 0).sort((a, b) => a - b); return true; }
    return false;
  }
  function onClick() { return false; }

  /* ---------- calculation ---------- */
  function build(ctx) {
    const P = ensure(ctx.P), FRM = window.SBDFraming, CF = window.SBDCrossframes, AN = window.SBDAnalysis, gi = ctx.g || 0;
    const L = FRM.compute(P); if (L.errors.length) return { err: L.errors.join(' ') };
    let A = null; if (AN) { try { A = AN.analyzeGirder(P, gi, { ll: false }); } catch (e) { A = null; } }
    const I = CF.inputsOf(P, { L, A, gi }), env = CF.envOf(P), R = CF.compute(I.p, env);
    const C = R.errors ? (R.errors.length ? null : CF.checks(R)) : null;
    const G = P.girders[gi] || P.girders[0], line = Math.min(FRM.lineOf(P, G), L.FR.girders.length - 1), ext = line === 0 || line === L.FR.girders.length - 1;
    const fl = FRM.flSkew(L.m.skews, ext, P.framing), XF = CF.pointLoads(P, gi, { L }), br = FRM.girderBraces(P, gi, L);
    return { L, I, R, C, fl, XF, br, line, G, A };
  }
  const stepsHtml = list => `<ol class="steps">${list.map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`).join('')}</ol>`;
  const wk = id => id ? `<a class="wk" href="#st-${esc(id)}" data-cfgo="${esc(id)}">§</a>` : '';
  const stName = st => ({ pass: 'OK', fail: 'Fail', warn: 'Warning', adv: 'Advisory', na: 'n/a' }[st] || st);
  function results(B) {
    const { L, R, C, fl, XF, br, line, I } = B, FR = L.FR; let h = '';
    // governing
    let gov = null; (C || []).forEach(c => c.items.forEach(it => { if (isFinite(it.r) && (it.st === 'pass' || it.st === 'fail') && (!gov || it.r > gov.it.r)) gov = { c, it }; }));
    h += `<section class="sec"><div class="secHead">Cross-frames: governing</div><div class="secBody">
      ${gov ? `<p>Governing ratio <b class="${cls(gov.it.r)}">${fmt(gov.it.r, 3)}</b>: ${esc(gov.c.id)} ${esc(gov.c.title)}, ${esc(gov.it.loc)} ${wk(gov.it.step)}</p>` : ''}
      ${R.errors && R.errors.length ? `<div class="alert err">${R.errors.map(esc).join('<br>')}</div>` : ''}
      <div class="kv"><div><span>S (largest spacing)</span><span>${fmt(I.p.S, 2)} in</span></div><div><span>h / d</span><span>${fmt(I.p.h, 2)} / ${fmt(I.p.dg, 2)} in ${wk('cf.dg')}</span></div><div><span>L<sub>b</sub> (largest on any girder)</span><span>${fmt(I.p.Lb, 2)} ft ${wk('cf.Lb')}</span></div>
      <div><span>Deck placement M<sub>u</sub></span><span>${fmt(+I.p.sb.Mu, 1)} kip-ft</span></div><div><span>Stability span L, frames n</span><span>${fmt(I.p.sb.L, 2)} ft, ${I.p.sb.n}</span></div>${R.W ? `<div><span>F<sub>w</sub> Strength III / V</span><span>${fmt(R.W.III.Fw, 2)} / ${fmt(R.W.V.Fw, 2)} kip ${wk('cf.wIII.Fw')}</span></div>` : ''}</div>
      <p class="note">M<sub>u</sub>: ${esc(I.src.Mu || '')}; ${esc(I.src.sb || '')}.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Cross-frames: elevation</div><div class="secBody"><div data-gfxb="crossframe"></div></div></section>`;   // drawn by ui/tabgraphics-b.js from the results below
    // layout
    h += `<section class="sec"><div class="secHead">Framing (6.7.4.2.1)</div><div class="secBody">${plan(L)}
      <div class="tscroll"><table class="tbl"><thead><tr><th>Span</th><th>Skew θ (°)</th><th class="lft">Orientation</th><th>Frames</th><th>Spacing (ft)</th><th>Conflicts</th><th></th></tr></thead><tbody>
      ${FR.orient.map(o => `<tr><td>${o.k + 1}</td><td>${fmt(o.th, 2)}</td><td class="lft">${o.o === 'normal' ? `normal, ${o.flat ? 'contiguous' : esc(o.arr)}` : 'parallel to the skew'}</td><td>${o.n}</td><td>${fmt(o.s, 3)}</td><td class="${o.conflicts ? 'fx-hi' : ''}">${o.conflicts || 0}</td><td>${wk(`fr.k${o.k}.s`)}</td></tr>`).join('')}</tbody></table></div>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Girder</th><th>Intermediate frames</th><th>Largest L<sub>b</sub> (ft)</th><th class="lft">Brace points (own stations, ft)</th><th></th></tr></thead><tbody>
      ${L.girders.map(g => `<tr class="${g.i === line ? 'sel' : ''}"><td>G${g.i + 1}</td><td>${g.nInt}</td><td>${fmt(g.lb, 2)}</td><td class="lft" style="font-size:8.5pt">${g.braces.map(v => fmt(v, 2)).join(', ')}</td><td>${wk(`fr.g${g.i}.lb`)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">This plate girder takes cross-section girder G${line + 1}: its brace points (bearings and cross-frames, mapped to the analysis stations proportionally within each span) are the L<sub>b</sub> points of the Flexure tab with a hand-off file of this bridge and the cross-frame bays of the Shear &amp; stiffeners tab (${br ? br.ints.length : 0} intermediate frames).</p></div></section>`;
    // f_l and DC1
    h += `<section class="sec"><div class="secHead">Flange lateral bending and DC1</div><div class="secBody"><div class="kv">
      <div><span>f<sub>ℓ</sub> from skew, G${line + 1} (C6.10.1)</span><span>${fmt(fl.fl, 2)} ksi ${wk('flsk.fl')}</span></div>
      <div><span>Cross-frame point loads on G${line + 1}</span><span>${XF ? `${XF.pts.length}, ${fmt(XF.tot, 2)} kip` : 'not included'}</span></div>
      ${XF ? `<div><span>Weight model</span><span>${esc(XF.X.kind === 'ovr' ? 'entered per frame' : XF.X.kind === 'dia' ? 'diaphragms' : 'angles')}${XF.X.allow ? ` + ${fmt(XF.X.allow, 0)} %` : ''}</span></div>` : ''}</div>
      ${XF ? `<details><summary class="note">Point loads (x ft : P kip)</summary><p class="note">${XF.pts.map(q => `${fmt(q.x, 2)} : ${fmt(q.P, 3)}${q.end ? ' (bearing line)' : ''}`).join('; ')}</p></details>` : ''}</div></section>`;
    // checks
    if (C) h += `<section class="sec"><div class="secHead">Checks (CF1 to CF11${C.some(c => c.id === 'CFD') ? ', CFD, CFE' : ''})</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>Check</th><th class="lft">Item</th><th>Demand</th><th>Resistance / limit</th><th>Ratio</th><th>Status</th><th></th></tr></thead><tbody>
      ${C.map(c => c.items.length ? c.items.map((it, j) => `<tr>${j === 0 ? `<td rowspan="${c.items.length}" title="${esc(c.ref)}"><b>${esc(c.id)}</b><br><span class="note">${esc(c.title)}</span></td>` : ''}<td class="lft">${esc(it.loc)}</td><td>${isFinite(it.demand) ? fmt(it.demand, 2) : esc((it.cells || [])[0] || '')}</td><td>${isFinite(it.capacity) ? fmt(it.capacity, 2) : esc((it.cells || [])[1] || '')}</td><td class="${cls(it.r)}">${isFinite(it.r) ? fmt(it.r, 3) : '—'}</td><td class="${it.st === 'fail' ? 'fx-ng' : it.st === 'warn' ? 'fx-hi' : it.st === 'na' ? 'fx-na' : 'fx-ok'}">${stName(it.st)}</td><td>${wk(it.step)}</td></tr>`).join('')
        : `<tr><td title="${esc(c.ref)}"><b>${esc(c.id)}</b></td><td class="lft fx-na" colspan="6">${esc(c.title)}: ${esc(c.naWhy || 'n/a')}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">References: ${C.map(c => `${esc(c.id)} ${esc(c.ref)}`).join('; ')}.</p></div></section>`;
    // member forces
    if (R.frames) h += `<section class="sec"><div class="secHead">Member forces (truss model)</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Member</th><th>Length (in)</th><th>per kip of F<sub>w</sub></th>${R.combos.map(c => `<th>${esc(c.id)} T / C (kip)</th>`).join('')}</tr></thead><tbody>
      ${R.frames.map((e, i) => `<tr><td class="lft">${esc(e.lbl)}</td><td>${fmt(e.L, 2)}</td><td>${fmt(e.unit, 3)} ${wk(`cf.tr${i}`)}</td>${R.combos.map(c => `<td>${fmt(c.f[i].T, 2)} / ${fmt(c.f[i].Cc, 2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Analysis force ± |wind force| (Strength III, V) and ± brace force (Constructibility); the top chord work points are held by the deck.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Worked steps</div><div class="secBody"><p class="note">Every value above links here (§). AASHTO LRFD 10th Ed. (2024).</p>${stepsHtml([...L.steps, ...fl.steps, ...(R.steps || [])])}</div></section>`;
    return h;
  }
  function css() {
    if (document.getElementById('fx-css')) return;
    const st = document.createElement('style'); st.id = 'fx-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} tr.fx-gov td:first-child{box-shadow:inset 4px 0 0 #b23a2a;}
      .fx-list{max-height:340px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;}`;
    document.head.appendChild(st);
  }
  function render(host, ctx) {
    css(); const key = JSON.stringify([ctx.P, ctx.g]);
    if (key !== S.key) { S.key = key; try { S.R = build(ctx); } catch (e) { S.R = { err: 'Calculation error: ' + (e && e.message) }; } }
    host.innerHTML = S.R.err ? `<div class="alert err">${esc(S.R.err)}</div>` : results(S.R);
    if (!S.R.err && window.SBDTabGfxBUI) window.SBDTabGfxBUI.crossframe(host, ctx, S.R);   // the cross-frame elevation (ui/tabgraphics-b.js)
    host.querySelectorAll('[data-cfgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = host.querySelector('#st-' + a.dataset.cfgo.replace(/[^\w.-]/g, '').replace(/\./g, '\\.')); if (t) { t.scrollIntoView({ block: 'center' }); t.style.background = '#FFF7D6'; } }));
  }

  window.SBDFramingUI = { ensure, inputs, onChange, onClick, render, build, plan };
})();
