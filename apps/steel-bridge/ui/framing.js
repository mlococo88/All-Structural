/* apps/steel-bridge/ui/framing.js — the "Framing & bracing" input tab (cross-frame layout with a plan sketch, cross-frame members, stability
   bracing, diaphragm, weight in DC1; the wind card is drawn on the Loads input tab and the plan again on the Bridge layout tab) and the "Cross-frames" output tab (window.SBDFramingUI), from engine/framing.js and
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
  // QA2 (2026-11-09): the check table's large values (the CF8 stiffnesses, kip-in/rad) as whole numbers with thousands separators, as the item text (16,528);
  // an infinite capacity (β_sec of a deep cross-frame) as ∞, not the next cell (the demand)
  const big = x => Math.abs(x) >= 10000 ? window.SharedUnits.fmtInt(x) : fmt(x, 2);
  const cls = r => !isFinite(r) ? '' : r > 1 + 1e-9 ? 'fx-ng' : r >= 0.9 ? 'fx-hi' : 'fx-ok';
  const S = { key: '', R: null, sel: null };

  /* ---------- input tab ---------- */
  function ensure(P) { const M = window.SBDModel; if (!P.framing) P.framing = M.defaultFraming(); if (!P.crossframes) P.crossframes = M.defaultCrossframes();
    if (!P.crossframes.userMode) P.crossframes.userMode = { StrI: 'add', Con: 'add' };   // CFRM (2026-11-01): absent in older projects = 'add', today's behaviour
    return P; }
  /* plan(L, dOn, opt): the framing plan as SVG: girders (blue), support lines (skewed), end and intermediate cross-frames, field splices (ticks).
     dOn (SBDIA): the bracing is a diaphragm: the caption and label say so (the drawing is the same).
     SKP (2026-11-10, engineer: "the bearing line skew seems off"): the plan was drawn to scale along the bridge only, its width stretched to
     a height of 60 to 260 px (2.2 times the length scale, less when capped), so a support line's drawn angle was not the skew (a 30° skew
     drew at 13° on the 360 ft built-in bridge and at 41° on a 40 ft span). Now one scale in both directions, so the bearing lines are drawn
     at the true skew, measured from the normal to the girders as engine/framing.js places the bearings (x = x_support + (y − y_c) tan θ),
     each labelled θ; the support lines run through the end bearings (extended along the line, not vertically). Display only.
     The scale: the plan 720 units wide, or wider so that the girder lines are at least 14 units apart (labels 9 units), or narrower so
     that it is at most 560 units tall. vex > 1: the width exaggerated vex times (angles not to scale; θ labels the true skew).
     opt.ui (screens): the plan in a box that scrolls sideways, at least 82 % of its drawn width (its text at least 7.4 px), and, where the
     true-scale plan is long and thin (length over width > 5), a check box "Exaggerate the width" (the choice kept for the session, not
     saved). Without opt.ui (the Report): the true-scale SVG alone, as wide as its frame. */
  const PLAN = { ex: false };
  function planSvg(L, dOn, vex, ui) {
    const FR = L.FR, m = L.m, pad = 34, ys = FR.ys, nb = ys.length, yMax = ys[nb - 1];
    const xs0 = Math.min(...FR.girders.map(g => g.x0)), xs1 = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])), Lx = Math.max(xs1 - xs0, 1);
    const bayMin = nb > 1 ? Math.min(...ys.slice(1).map((y, i) => y - ys[i])) : 1;
    let sx = Math.max((720 - 2 * pad) / Lx, nb > 1 ? 14 / Math.max(bayMin * vex, 1e-6) : 0);
    if (yMax * sx * vex > 560) sx = Math.max(560 / (yMax * vex), 1e-6);
    const sy = sx * vex, W = Math.max(2 * pad + Lx * sx, 240), t0 = 30, X = x => pad + (x - xs0) * sx, Y = y => t0 + y * sy, E = 8;
    const f1 = v => (Math.abs(v - Math.round(v)) < 0.005 ? String(Math.round(v)) : v.toFixed(2).replace(/0$/, '')).replace('-', '−');
    let o = '';
    const ends = m.sup.map((_, k) => { const ax = X(FR.xb(k, 0)), ay = Y(0), bx = X(FR.xb(k, nb - 1)), by = Y(yMax), len = Math.hypot(bx - ax, by - ay) || 1, ux = (bx - ax) / len, uy = (by - ay) / len;
      return { k, ax: ax - ux * E, ay: ay - uy * E, bx: bx + ux * E, by: by + uy * E }; });
    // θ labels under the lower ends; where two would be closer than 56 units, every other one a line lower
    let low = 0; ends.forEach((q, i) => { q.row = i && Math.abs(q.bx - ends[i - 1].bx) < 56 && !ends[i - 1].row ? 1 : 0; if (q.row) low = 1; });
    ends.forEach(q => { const k = q.k, nm = k === 0 ? 'Abut. 1' : k === m.sup.length - 1 ? 'Abut. 2' : 'Pier ' + k;
      o += `<line x1="${q.ax.toFixed(1)}" y1="${q.ay.toFixed(1)}" x2="${q.bx.toFixed(1)}" y2="${q.by.toFixed(1)}" stroke="#94a3b8" stroke-width="1.2" stroke-dasharray="5 3"/><text x="${q.ax.toFixed(1)}" y="${(q.ay - 5).toFixed(1)}" font-size="9" text-anchor="middle" fill="#475569">${nm}</text>`
        + `<text x="${q.bx.toFixed(1)}" y="${(q.by + 11 + q.row * 11).toFixed(1)}" font-size="9" text-anchor="middle" fill="#0F172A" data-skew="${k}">θ = ${f1(+m.skews[k] || 0)}°</text>`; });
    FR.frames.forEach(f => o += `<line x1="${X(f.xa).toFixed(1)}" y1="${Y(ys[f.bay]).toFixed(1)}" x2="${X(f.xc).toFixed(1)}" y2="${Y(ys[f.bay + 1]).toFixed(1)}" stroke="${f.type === 'sup' ? '#B45309' : '#16304F'}" stroke-width="${f.type === 'sup' ? 2.2 : 1.3}"/>`);
    FR.girders.forEach(g => { o += `<line x1="${X(g.x0).toFixed(1)}" y1="${Y(g.y).toFixed(1)}" x2="${X(g.x0 + g.bear[g.bear.length - 1]).toFixed(1)}" y2="${Y(g.y).toFixed(1)}" stroke="#2563EB" stroke-width="2.4"/><text x="${(pad - 6)}" y="${(Y(g.y) + 3).toFixed(1)}" font-size="9" text-anchor="end" fill="#1E3A5F">G${g.i + 1}</text>`;
      m.splices.forEach(s => { const xg = g.x0 + s; o += `<line x1="${X(xg).toFixed(1)}" y1="${(Y(g.y) - 4).toFixed(1)}" x2="${X(xg).toFixed(1)}" y2="${(Y(g.y) + 4).toFixed(1)}" stroke="#DC2626" stroke-width="1.6"/>`; }); });
    const yc = Math.max(Y(yMax) + E, ...ends.map(q => q.by)) + 11 + low * 11, H = yc + 30, bw = dOn ? 'diaphragms' : 'cross-frames';
    const cap1 = vex > 1 ? `Plan, width exaggerated ×${f1(vex)}: the angles are not to scale; θ is the true skew of each support line.` : 'Plan, true scale in both directions: each support line is drawn at its skew θ from the normal to the girders.';
    return `<svg viewBox="0 0 ${W.toFixed(0)} ${H.toFixed(0)}" style="width:100%;${ui ? `min-width:${Math.round(0.82 * W)}px;` : ''}height:auto;background:#fff;border:1px solid #e4e7eb;border-radius:4px${ui ? `;display:${(vex > 1) === PLAN.ex ? 'block' : 'none'}` : ''}" role="img" aria-label="Framing plan: girders, supports and ${bw}"${ui ? ` data-fpv="${vex > 1 ? 'x' : 't'}"` : ''}>${o}
      <text x="${pad}" y="${(yc + 12).toFixed(0)}" font-size="9" fill="#475569">${cap1}</text>
      <text x="${pad}" y="${(yc + 23).toFixed(0)}" font-size="9" fill="#475569">Blue: girders; brown: end ${bw} on the bearing lines; navy: intermediate ${bw}; red ticks: field splices.</text></svg>`;
  }
  function plan(L, dOn, opt) {
    if (!(opt && opt.ui)) return planSvg(L, dOn, 1, false);
    const FR = L.FR, ys = FR.ys, wid = ys[ys.length - 1], Lx = Math.max(...FR.girders.map(g => g.x0 + g.bear[g.bear.length - 1])) - Math.min(...FR.girders.map(g => g.x0));
    const r = wid > 0 ? Lx / wid : 0, vex = r > 5 ? Math.min(4, Math.round(r / 5 * 2) / 2 + 0.5) : 1;   // offered for a long, thin plan: about a fifth of the length tall, at most ×4
    return `<div class="fp-plan">${vex > 1 ? `<label class="fp-ex"><input type="checkbox" data-fpex${PLAN.ex ? ' checked' : ''}> Exaggerate the width ×${String(vex)} (long bridge; the angles are then not to scale)</label>` : ''}
      <div class="fp-sc">${planSvg(L, dOn, 1, true).replace('display:none', vex > 1 ? 'display:none' : 'display:block')}${vex > 1 ? planSvg(L, dOn, vex, true) : ''}</div></div>`;
  }
  if (typeof document !== 'undefined' && document.addEventListener) document.addEventListener('change', e => {   // SKP: the "Exaggerate the width" check box, every plan on the page
    const c = e.target; if (!c || !c.matches || !c.matches('[data-fpex]')) return; PLAN.ex = !!c.checked;
    document.querySelectorAll('[data-fpex]').forEach(q => { q.checked = PLAN.ex; });
    document.querySelectorAll('svg[data-fpv]').forEach(s => { s.style.display = (s.dataset.fpv === 'x') === PLAN.ex ? 'block' : 'none'; });
  });
  /* BRSEL (2026-11-09): the "Intermediate bracing" drop-down. braceOf(C): the choice shown for the saved fields: a diaphragm when
     dia.on = 'yes' (type kept underneath), 'ch' when its shape is one of CF_CH, else 'w' (CF_DIA or custom W); otherwise the frame type.
     setBrace(P, v): writes the choice back: a frame sets type and dia.on = 'no'; a diaphragm sets dia.on = 'yes' and leaves type alone;
     a change of shape family puts back the shape last used in that family in this session, else the shape CF10 recommends (cfTypeRec),
     else W21x44 / MC18x42.7. No other field is written. */
  const BRACE = [['X', 'X-frame'], ['Kb', 'K-frame (diagonals to the bottom)'], ['Kt', 'K-frame (diagonals to the top)'], ['w', 'Rolled W diaphragm'], ['ch', 'Channel diaphragm']];
  const isCh = shape => window.SBDCrossframes.CF_CH.some(s => s[0] === shape), SHP = new WeakMap();
  function braceOf(C) { const q = C.dia || {}; return q.on === 'yes' ? (isCh(q.shape) ? 'ch' : 'w') : C.type; }
  function setBrace(P, v) {
    const C = ensure(P).crossframes, CF = window.SBDCrossframes;
    if (v === 'X' || v === 'Kb' || v === 'Kt') { C.type = v; if (C.dia) C.dia.on = 'no'; return; }
    if (v !== 'w' && v !== 'ch') return;
    if (!C.dia) C.dia = window.SBDModel.defaultCrossframes().dia;
    const q = C.dia, fam = isCh(q.shape) ? 'ch' : 'w'; q.on = 'yes'; if (fam === v) { if (q.grp == null) grpFill(P, q, v); return; }
    const mem = SHP.get(C) || {}; mem[fam] = q.shape; if (q.grp != null) mem[fam + 'G'] = q.grp; SHP.set(C, mem);
    let rec = null; try { const TR = CF.cfTypeRec(CF.inputsOf(P).p, CF.envOf(P)); rec = v === 'ch' ? TR.ch : TR.w; } catch (e) { rec = null; }
    q.shape = mem[v] || rec || (v === 'ch' ? 'MC18x42.7' : 'W21x44');
    if (mem[v + 'G']) q.grp = mem[v + 'G']; else { delete q.grp; grpFill(P, q, v); }   // SB-24: the shapes per bay depth group of the new family
  }
  /* SB-24 (2026-11-13; engineer decision SB-24): the diaphragm shape per bay depth group (crossframes.dia.grp, engine/crossframes.js grpShape).
     grpRec(P, br): the section CF10 recommends for each group (cfTypeRec: SB-22's per-group section, else the one section for every bay) in
     the family br ('w' | 'ch'), { key: shape }; grpFill(P, q, v): when the bays form two or more depth groups and CF10 recommends a section per
     group (one section does not fit every bay), q.grp is prefilled with it (a group with no section of the list that fits: no entry, the Shape
     above). Only on the user's change of the Intermediate bracing choice (setBrace); a project loaded is never rewritten (absent: dia.shape). */
  function grpRec(P, br) {
    const CF = window.SBDCrossframes, out = {}; let TR = null; try { TR = CF.cfTypeRec(CF.inputsOf(P).p, CF.envOf(P)); } catch (e) { return out; }
    const GR = CF.bayGroups(P); if (!GR) return out;
    GR.forEach(g => { const k = CF.grpKey(g), t = TR.grp ? TR.grp.find(x => x.bays.join(',') === k) : null, sec = t ? (br === 'ch' ? t.ch : t.w) : null, one = br === 'ch' ? TR.ch : TR.w;
      if (t ? sec : one) out[k] = t ? sec[0] : one; }); out.TR = TR; return out;
  }
  function grpFill(P, q, v) {
    const R = grpRec(P, v); if (!R.TR || !R.TR.grp) return; const o = {}; Object.keys(R).forEach(k => { if (k !== 'TR') o[k] = R[k]; }); if (Object.keys(o).length) q.grp = o;
  }
  /* grpCard(P, C, br): the inputs of the shape per bay depth group (two or more groups; '' with one): a select per group, "Same as Shape above"
     (no entry) or a shape of the family, the one CF10 recommends marked */
  function grpCard(P, C, br) {
    const CF = window.SBDCrossframes; let GR = null; try { GR = CF.bayGroups(P); } catch (e) { GR = null; } if (!GR) return '';
    const R = grpRec(P, br), list = br === 'ch' ? CF.CF_CH.map(s => s[0]) : [...CF.CF_DIA.map(s => s[0]), 'custom'], m = C.dia.grp && typeof C.dia.grp === 'object' ? C.dia.grp : {};
    const nmS = v => (v === 'custom' ? 'Custom W' : v);
    return `<h4 class="sub">Shape per bay depth group (girder types)</h4>${GR.map(g => { const k = CF.grpKey(g), cur = list.includes(m[k]) ? m[k] : '', id = `i_dgrp_${k.replace(/\W/g, '_')}`;
      return `<div class="fRow"><label for="${id}">Bays ${g.bays.map(j => `G${j + 1}–G${j + 2}`).join(', ')} (d = ${fmt(g.dg, 2)} in, G${g.s.line + 1} ${esc(g.s.label)})</label><select id="${id}" data-dgrp="${esc(k)}" style="width:200px;max-width:100%">`
        + [['', `Same as Shape above (${nmS(C.dia.shape)})`], ...list.map(v => [v, `${nmS(v)}${R[k] === v ? ' (CF10 recommends)' : ''}`])].map(([v, t]) => `<option value="${esc(v)}"${cur === v ? ' selected' : ''}>${esc(t)}</option>`).join('') + '</select></div>'; }).join('')}
      <p class="note">Girder types: the bays form ${GR.length} depth groups (the same h and the same shallower girder depth d: the Drawings' cross-frame details). Each group's diaphragm is checked with its own shape on its own frame (CFD; CFE too when the end diaphragm takes the intermediate shape) and weighed in DC1 with it; the worst group governs (engineer decision SB-24, 2026-11-13). Turning the diaphragm on prefills the shapes CF10 recommends per group where one section does not fit every bay.</p>`;
  }
  /* CONN_HINT (SB-26, 2026-11-13; engineer decision SB-26, display only): the default diaphragm end connection (crossframes.dia nb 4, pitch
     3 in, bolt line 3.5 in from the web; DEF) is kept as a starting value; this hint, next to the connection inputs and in the Report's
     framing check notes (report/builders.js frm), says it is a placeholder to be designed. No value or input changes. */
  const CONN_HINT = 'Hint (engineer decision SB-26): the default end connection of the diaphragm (4 bolts per end in one row at 3 in pitch, the bolt line 3.5 in from the girder web, the bolt diameter and grade above) is a placeholder, not a design. It usually fails the CFD / CFE bolted connection checks as entered: design the connection (bolts, pitch, bolt line, connection plate) for the project.';
  function inputs(P, h) {
    ensure(P); const F = P.framing, C = P.crossframes, CF = window.SBDCrossframes, FRM = window.SBDFraming;
    let L = null; try { L = FRM.compute(P); } catch (e) { L = { errors: [e.message] }; }
    const ang = [...Object.keys(CF.ANGLES).map(s => [s, s]), ['custom', 'Custom angle']], grs = Object.keys(CF.GD_GR).map(k => [k, k]);
    const mem = k => `${h.sel(`crossframes.mem.${k}.sec`, { top: 'Top chord', bot: 'Bottom chord', diag: 'Diagonals' }[k], ang)}${C.mem[k].sec === 'custom' ? `${h.num(`crossframes.mem.${k}.b1`, 'Connected leg', 'in')}${h.num(`crossframes.mem.${k}.b2`, 'Outstanding leg', 'in')}${h.num(`crossframes.mem.${k}.t`, 'Thickness', 'in')}` : ''}`;
    const usr = k => `${h.num(`crossframes.user.${k}.top`, 'Top chord', 'kip')}${h.num(`crossframes.user.${k}.bot`, 'Bottom chord', 'kip')}${h.num(`crossframes.user.${k}.diag`, 'Diagonals', 'kip')}`;
    // BRSEL (2026-11-09): one "Intermediate bracing" drop-down in place of the Type select and the diaphragm switch; it maps onto the saved
    // fields (crossframes.type, crossframes.dia.on, the family of crossframes.dia.shape); only the inputs of the choice are shown
    const br = braceOf(C), dOn = br === 'w' || br === 'ch';
    const conn = `${h.sel('crossframes.conn.d', 'Bolt diameter', [['0.875', '7/8 in'], ['1', '1 in']])}${h.sel('crossframes.conn.gr', 'Grade', [['A325', 'F3125 A325'], ['A490', 'F3125 A490']])}
        ${h.sel('crossframes.conn.thr', 'Threads', [['incl', 'Included'], ['excl', 'Excluded']])}`;
    return h.card(`${dOn ? 'Diaphragm' : 'Cross-frame'} layout (6.7.4.2.1)`, `${h.num('framing.spacing', `${dOn ? 'Diaphragm' : 'Cross-frame'} spacing s, at most`, 'ft')}${h.num('framing.spPier', 'Spacing near interior supports s<sub>p</sub>', 'ft', { text: true })}${h.num('framing.pierLen', 'Pier region each side (blank: 0.25L)', 'ft', { text: true })}
        ${h.sel('framing.orient', 'Orientation', [['auto', 'Automatic: parallel to the skew where both supports ≤ 20°, else normal'], ['parallel', 'Parallel to the skew'], ['normal', 'Normal to the girders']])}
        ${h.sel('framing.arrange', 'Normal frames', [['contiguous', 'Contiguous'], ['staggered', 'Staggered'], ['stepped', 'Stepped (lines parallel to the bearings)']])}
        ${h.num('framing.supClear', 'Clear distance from the bearings', 'ft')}${h.num('framing.stagMin', 'Least offset between frames on one girder', 'ft')}
        <div class="fRow"><label for="fr_spl">Field splices</label><input type="text" id="fr_spl" data-fr="splices" value="${esc((F.splices || []).join(', '))}" style="width:180px"><span class="unit"></span></div>
        ${h.num('framing.spliceClear', 'Frames clear of splices and transitions', 'ft')}
        <p class="note">Girders and spacings: Cross-section tab; support skews: Bridge layout tab. The plates of every girder give the shop transitions. Frames normal to the girders at a support skewed more than 20° start at least max(clear, 4b<sub>f</sub>, 0.4s) from the obtuse bearing (C6.7.4.2.1); corner frames close longer panels. Owner rule xf.orient applies with the automatic orientation.</p>
        ${L && !L.errors.length ? plan(L, dOn, { ui: true }) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`}`)
      + h.card('Intermediate bracing (6.7.4.2)', `${h.sel('crossframes.type', 'Intermediate bracing', BRACE, br).replace('<select ', '<select style="width:200px;max-width:100%" ')}
        ${h.num('crossframes.dMinXF', 'Minimum girder depth for cross-frames', 'in')}${dOn ? `${h.sel('crossframes.dia.shape', 'Shape', br === 'ch' ? CF.CF_CH.map(s => [s[0], s[0]]) : [...CF.CF_DIA.map(s => [s[0], s[0]]), ['custom', 'Custom W']])}
        ${C.dia.shape === 'custom' ? `${h.num('crossframes.dia.d', 'Depth d', 'in')}${h.num('crossframes.dia.bf', 'Flange width', 'in')}${h.num('crossframes.dia.tf', 'Flange thickness', 'in')}${h.num('crossframes.dia.tw', 'Web thickness', 'in')}` : ''}
        ${h.sel('crossframes.dia.gr', 'Grade', [['36', '36'], ['50', '50']])}${grpCard(P, C, br)}
        <h4 class="sub">End connections</h4>${conn}${h.num('crossframes.dia.nb', 'Bolts per end (one row)', '')}${h.num('crossframes.dia.pitch', 'Bolt pitch', 'in')}${h.num('crossframes.dia.ecc', 'Bolt line from the girder web', 'in')}
        <p class="note">${CONN_HINT}</p>
        <h4 class="sub">End diaphragms (bearing lines)</h4>${h.sel('crossframes.dia.end', 'Jacking at the end diaphragms', [['no', 'No'], ['yes', 'Yes']])}${h.num('crossframes.dia.Rj', 'Jacking reaction R<sub>j</sub>', 'kip')}${h.num('crossframes.dia.aj', 'at a<sub>j</sub> from the girder', 'in')}
        <p class="note">The diaphragm is the intermediate bracing (checks CFD) and the end diaphragm at the bearing lines (CFE); the angle checks CF1 to CF9 and member forces entered from a refined analysis do not apply. S (largest girder spacing) and the girder depth d come from the project and the layout. On a change between a rolled W and a channel, the shape starts at the one last used in that family on this page, else the shape that check CF10 recommends for the girder depth, else W21x44 / MC18x42.7: a starting choice, checked by CFD like any other.</p>`
        : `${h.num('crossframes.h', 'Chord work-point depth h (blank: from D)', 'in', { text: true })}
        ${h.sel('crossframes.primary', 'Primary members', [['auto', 'Automatic (yes where a support is skewed > 20°)'], ['no', 'No'], ['yes', 'Yes']])}
        ${h.sel('crossframes.gA', 'Angle grade', grs)}${h.sel('crossframes.gG', 'Gusset grade', grs)}${mem('top')}${mem('bot')}${mem('diag')}
        <h4 class="sub">End connections</h4>${conn}${h.num('crossframes.conn.n', 'Bolts per member end', '')}${h.num('crossframes.conn.s', 'Pitch', 'in')}${h.num('crossframes.conn.e', 'End distance', 'in')}${h.num('crossframes.conn.tg', 'Gusset thickness', 'in')}
        <p class="note">S (largest girder spacing), the girder depth d and L<sub>b</sub> (largest unbraced length on any girder) come from the project and the layout.</p>`}`)
      + h.card('Flange lateral bending from skew (C6.10.1)', `${h.num('framing.flSkI', 'f<sub>ℓ</sub>, interior girders', 'ksi')}${h.num('framing.flSkE', 'f<sub>ℓ</sub>, exterior girders', 'ksi')}${h.num('framing.flSkG', 'Load factor on f<sub>ℓ</sub>', '')}
        <p class="note">Used where any support is skewed more than 20°, in lieu of a refined analysis (as GirderDetail): the Flexure tab takes it with a hand-off file of this bridge.</p>`)
      + h.card('Stability bracing during deck placement (6.7.4.2.2)', `${h.sel('crossframes.sb.on', 'Check stability bracing', [['yes', 'Yes'], ['no', 'No']])}${h.sel('crossframes.sb.full', 'Depth and connection plates', [['auto', 'Automatic (h ≥ 0.8D: full depth)'], ['yes', '≥ 0.8 girder depth, full-depth plates (2.4)'], ['no', 'Otherwise (3.6)']])}
        ${h.num('crossframes.sb.Mu', 'Factored deck-placement M<sub>u</sub> (blank: analysis)', 'kip-ft', { text: true })}${h.num('crossframes.sb.Cb', 'C<sub>b</sub>', '')}
        ${h.num('crossframes.sb.bs', 'Connection plate b<sub>s</sub> (no connection-plate type)', 'in')}${h.num('crossframes.sb.tsp', 'Connection plate t<sub>s</sub>', 'in')}`)
      + (dOn ? '' : h.card('Member forces from a refined analysis (optional)', `<p class="note">Factored, tension positive, per member of the angle cross-frame (not used with a diaphragm). For each group choose whether they add to the forces the tab computes or replace them.</p>
        <h4 class="sub">Strength I</h4>${usr('StrI')}${h.sel('crossframes.userMode.StrI', 'With the computed forces', [['add', 'Add to computed'], ['replace', 'Replace computed']])}
        <p class="note">${C.userMode.StrI === 'replace' ? 'The entered forces are the Strength design forces; the computed Strength III and V wind forces are not used.' : 'Strength I takes the entered forces; Strength III and V take the computed wind forces; each member is designed for the largest.'}</p>
        <h4 class="sub">Constructibility</h4>${usr('Con')}${h.sel('crossframes.userMode.Con', 'With the computed forces', [['add', 'Add to computed'], ['replace', 'Replace computed']])}
        <p class="note">${C.userMode.Con === 'replace' ? 'The entered forces are used alone; the stability bracing force is not added (CF7 not checked; CF8, the stiffness, still is).' : 'The stability bracing force from M<sub>br</sub> (6.7.4.2.2) is added to the entered forces.'}</p>
        <h4 class="sub">Fatigue ranges ΔP</h4>${usr('Fat')}<p class="note">Used alone: the tab computes no cross-frame force range (a line-girder analysis gives none).</p>
        ${h.sel('crossframes.fatCat', 'Member end detail', [['B', 'Bolted, slip-critical (B)'], ['E', 'Welded end connection (E)'], ['Ep', 'Welded, eccentric (E′)']])}`))   // angle cross-frame only (CF1 to CF9; not used with a diaphragm)
      + h.card(`${dOn ? 'Diaphragm' : 'Cross-frame'} weight in DC1`, `${h.sel('crossframes.weight.mode', 'Weight', [['auto', 'From the member sizes (or the diaphragm)'], ['ovr', 'Entered per frame'], ['off', 'Not included']])}${h.num('crossframes.weight.allow', 'Gusset plates and bolts', '%')}
        ${C.weight.mode === 'ovr' ? `${h.num('crossframes.weight.Wi', 'Intermediate frame', 'kip', { text: true })}${h.num('crossframes.weight.We', 'End frame (blank: same)', 'kip', { text: true })}` : ''}
        <p class="note">Each frame puts half its weight on each girder it connects, at that girder's own station, on the steel section (DC1; GirderDetail XF1). The Analysis tab uses these point loads.</p>`);
  }
  /* TABR (2026-11-09): the input tabs reorganised (display only). windCard(P, h): the wind card (crossframes.wind.*), drawn on the Loads input
     tab; layoutPlan(P): the framing plan of the Framing & bracing tab, drawn again on the Bridge layout tab (the skews and spans in plan). */
  function windCard(P, h) { ensure(P); return h.card('Wind on the exterior girder (3.8.1.2.1, 4.6.2.7.1)', `${h.num('crossframes.wind.V', 'Design wind speed V', 'mph')}${h.num('crossframes.wind.Kz', 'K<sub>z</sub>', '')}${h.num('crossframes.wind.G', 'Gust factor G', '')}${h.num('crossframes.wind.Cd', 'Drag coefficient C<sub>D</sub>', '')}`); }
  function layoutPlan(P) {
    ensure(P); let L = null; try { L = window.SBDFraming.compute(P); } catch (e) { L = { errors: [e.message] }; }
    const dOn = isDia(P);
    return (L && !L.errors.length ? plan(L, dOn, { ui: true }) : `<div class="alert err">${esc((L && L.errors || []).join(' '))}</div>`)
      + `<p class="note">${dOn ? 'Diaphragms' : 'Cross-frames'}, their spacing and orientation, and the field splices: <a href="#" data-itgo="framing">Framing &amp; bracing tab</a>.</p>`;
  }
  function onChange(el, P) {
    if (el.dataset && el.dataset.path === 'crossframes.type' && el.dataset.kind === 'sel') { setBrace(P, el.value); return true; }   // BRSEL
    if (el.dataset && el.dataset.dgrp != null) { const q = ensure(P).crossframes.dia, k = el.dataset.dgrp;   // SB-24: the shape of a bay depth group ('' : the Shape above, the entry removed)
      if (el.value === '') { if (q.grp && typeof q.grp === 'object') { delete q.grp[k]; if (!Object.keys(q.grp).length) delete q.grp; } }
      else { if (!q.grp || typeof q.grp !== 'object' || Array.isArray(q.grp)) q.grp = {}; q.grp[k] = el.value; } return true; }
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
    // SB-23 (2026-11-13; the engineer's request for this DXF change): the tab graphic's Download DXF draws one cross-frame per distinct bay depth,
    // as the Drawings cross-frame sheet (CF.bayGroups): each group's frame is the reported type's inputs with the group's h and d, computed and
    // checked, at the group's first bay (dxfG). One depth, or a project saved before girder types: the frame checked (B), as before for equal
    // depths. (Was SBXF dxfB: the reported girder's own depth when the governing bay's differed.)
    let dxfG; if (I.p.xfBay) { const GR = CF.bayGroups(P); if (GR) dxfG = GR.map(g => { const p = { ...I.p, h: g.h, dg: g.dg }, Rg = CF.compute(p, env);
      return { L, I: { ...I, p }, R: Rg, C: Rg.errors && !Rg.errors.length ? CF.checks(Rg) : null, line: g.bays[0], grp: g }; }); }
    return { L, I, R, C, fl, XF, br, line, G, A, dxfG };
  }
  const stepLi = s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${window.SBDSub.html(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${window.SBDSub.html(s.note)}</div>` : ''}</li>`;
  const A = '10th Ed. Art. ', OPEN = new Set(), TPX = (...ks) => ks.map(k => window.SBDFlexureUI.TP[k]).filter(Boolean);

  /* ---------- topics of the worked steps (presentation spec A, 2026-10-31; as ui/shear.js): framing layout, wind, torsional bracing, then each cross-frame member ---------- */
  const mem = (k, t) => ({ key: k, title: t, ref: A + '6.9.4.1, 6.8.2, 6.13.2.7, 6.13.2.9', ids: new RegExp('^cf\\.' + k + '\\.'), res: new RegExp('^cf\\.' + k + '\\.(Pr|Pt)$') });
  const TOPICS = { x: () => [...TPX('own', 'n', 'steel', 'c3', 'cn', 'cr'),
    { key: 'lay', title: 'Cross-frame spacing and orientation', ref: A + '6.7.4.2.1', ids: /^fr\.(s|k\d+\.)/, res: /^fr\.s$/ },
    { key: 'lb', title: 'Unbraced lengths of the girders', ref: A + '6.7.4.2.1', ids: /^fr\.g\d+\./ },
    { key: 'geo', title: 'Girder depth, spacing and connection geometry', ref: A + '6.7.4.2.1', ids: /^cf\.(xfD|h|dg|dW|type|Lb|geo)$/ },   // SBXF: xfD, h, dW (girder types); SB-22: type (the CF10 section for every bay)
    { key: 'lat', title: 'Flange lateral bending from skew', ref: A + 'C6.10.1', ids: /^flsk\./ },
    { key: 'w3', title: 'Wind on the girders, Strength III', ref: A + '3.8.1.2, 4.6.2.7', ids: /^cf\.wIII\./, res: /^cf\.wIII\.Fw$/ },
    { key: 'w5', title: 'Wind on the girders, Strength V', ref: A + '3.8.1.2, 4.6.2.7', ids: /^cf\.wV\./, res: /^cf\.wV\.Fw$/ },
    { key: 'tr', title: 'Member forces per kip of wind force (truss model)', ref: A + '4.6.2.7', ids: /^cf\.tr\d+$/ },
    { key: 'usr', title: 'Member forces entered from a refined analysis', ref: A + '6.7.4.2', ids: /^cf\.user\./ },
    { key: 'sb', title: 'Torsional bracing during deck placement', ref: A + '6.7.4.2.1, C6.7.4.2', ids: /^cf\.sb\./, res: /^cf\.sb\.bReq$/ },
    mem('top', 'Top chord'), mem('bot', 'Bottom chord'), mem('diag', 'Diagonals'),
    { key: 'dia', title: 'Diaphragm (intermediate bracing), CFD', ref: A + '6.7.4.2, 6.10.8, 6.10.9, 6.13.2', ids: /^cf\.cfd(\.|$)/ },   // SBDIA (2026-11-10): the diaphragm steps (were under "Other steps")
    { key: 'diae', title: 'End diaphragms (bearing lines), CFE', ref: A + '6.7.4.2, 6.10.8, 6.10.9, 6.13.2, 3.4.3.1', ids: /^cf\.cfe(\.|$)/ }] };
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind || 'x'](), { strip: false });
  const stepsHtml = (list, kind) => window.SharedSteps.groupsHTML(groups(kind, list), { open: OPEN, item: stepLi });
  const wk = id => id ? `<a class="wk" href="#st-${esc(id)}" data-cfgo="${esc(id)}">§</a>` : '';
  const stName = st => ({ pass: 'OK', fail: 'Fail', warn: 'Warning', adv: 'Advisory', na: 'n/a' }[st] || st);
  /* SBDIA (2026-11-10; engineer: "I have channel diaphragm selected and there is still a lot of output and failures related to cross frames"):
     isDia(P or the Cross-frames input p): a rolled or channel diaphragm is the intermediate bracing (crossframes.dia.on = 'yes'). Then the
     tab, the Report and the Summary say "Diaphragms", list only the checks the engine makes (CF10, CF11, CFD, CFE: CF1 to CF9 are not made),
     and leave out the truss model of the angle cross-frame (member forces, its elevation, its steps). Display only: no value changes.
     ckHead(C): the checks heading, as before for a cross-frame. */
  const isDia = q => !!q && window.SBDCrossframes.cfDiaOn(q.crossframes || q);
  const ckHead = (C, dOn) => dOn ? `Checks (${C.map(c => c.id).join(', ')})` : `Checks (CF1 to CF11${C.some(c => c.id === 'CFD') ? ', CFD, CFE' : ''})`;
  /* SBCKN (2026-11-13; display only, CLAUDE.md §6): the check table shows an item's demand and resistance (or its first two text cells), so
     two things the engine writes were never shown: CF10's recommendation and the bracing in use (its item's third and fourth cells: the
     cross-frame or diaphragm, which shape, by bay depth group with girder types, SB-22) and every check's note (c.note: the basis and
     assumptions of CF1 to CF11, CFD, CFE, e.g. CF10's SB-22 sentence and the owner rule). ckRec(c, it): CF10's two texts, null for any other
     item; recStep(ids): the step that works the recommendation, cf.type (SB-22, #1490: girder types, a diaphragm recommended, unequal
     depths) when the steps have it, else the girder depth d (cf.dg) it is chosen from; ckNotes(C): [{ id, note }] of the checks with a note.
     Used by the tab and the Report (report/builders.js frm); the values are those of CF.checks, unchanged. */
  const ckRec = (c, it) => c && c.id === 'CF10' && it && Array.isArray(it.cells) && it.cells.length >= 4 ? { rec: String(it.cells[2]), sel: String(it.cells[3]) } : null;
  const recStep = ids => ids.has('cf.type') ? 'cf.type' : ids.has('cf.dg') ? 'cf.dg' : null;
  const ckNotes = C => (C || []).filter(c => c && c.note).map(c => ({ id: c.id, note: String(c.note) }));
  /* diaSvg(B): a simple elevation of the intermediate diaphragm between two girders (nominal shape, centred on the girder depth, as the
     Drawings sheet), the connection plates and the bolt rows; the governing check below it. Not to scale vertically when d ≫ S. */
  function diaSvg(B) {
    // DETC (2026-11-10): in the option C style (ui/gfxdet.js SBDGfxDet.diaphragm, the same numbers); below, the former sketch (without the kit)
    if (window.SBDGfxDet && window.SBDGfxDet.diaphragm && window.SBDVizKit && window.SBDVizKit.scene) { try { return window.SBDGfxDet.diaphragm(B); } catch (e) { /* the sketch below */ } }
    const CF = window.SBDCrossframes, p = B.I.p, q = p.dia || {}, X = CF.cfDiaSec(q), g = CF.cfDiaGap(q), S = +p.S, dg = +p.dg, D = B.R.DIA && B.R.DIA.i;
    const W = 720, pad = 60, sc = (W - 2 * pad) / Math.max(S, 1), Hg = dg * sc, H = Hg + 90, X0 = pad, Y0 = 30, x = v => (X0 + v * sc).toFixed(1), y = v => (Y0 + v * sc).toFixed(1);
    const bf = 16, tfl = 1, y0 = (dg - X.d) / 2, nb = Math.max(2, Math.round(+q.nb || 2)), sp = +q.pitch || 3, ec = +q.ecc || 3.5, bs = 5;
    let o = '';
    [0, S].forEach(xg => { o += `<rect x="${x(xg - bf / 2)}" y="${y(0)}" width="${(bf * sc).toFixed(1)}" height="${(tfl * sc).toFixed(1)}" fill="#2563EB"/><rect x="${x(xg - bf / 2)}" y="${y(dg - tfl)}" width="${(bf * sc).toFixed(1)}" height="${(tfl * sc).toFixed(1)}" fill="#2563EB"/><line x1="${x(xg)}" y1="${y(0)}" x2="${x(xg)}" y2="${y(dg)}" stroke="#2563EB" stroke-width="2.4"/>`;
      const sg = xg ? -1 : 1; o += `<rect x="${x(Math.min(xg, xg + sg * bs))}" y="${y(tfl + 1)}" width="${(bs * sc).toFixed(1)}" height="${((dg - 2 * tfl - 2) * sc).toFixed(1)}" fill="none" stroke="#94a3b8" stroke-width="1"/>`; });
    o += `<rect x="${x(g)}" y="${y(y0)}" width="${((S - 2 * g) * sc).toFixed(1)}" height="${(X.d * sc).toFixed(1)}" fill="#E8EEF6" stroke="#16304F" stroke-width="1.6"/>`
      + `<line x1="${x(g)}" y1="${y(y0 + X.tf)}" x2="${x(S - g)}" y2="${y(y0 + X.tf)}" stroke="#16304F" stroke-width="0.8"/><line x1="${x(g)}" y1="${y(y0 + X.d - X.tf)}" x2="${x(S - g)}" y2="${y(y0 + X.d - X.tf)}" stroke="#16304F" stroke-width="0.8"/>`;
    [ec, S - ec].forEach(xb => { for (let i = 0; i < nb; i++) o += `<circle cx="${x(xb)}" cy="${y(dg / 2 + (i - (nb - 1) / 2) * sp)}" r="3" fill="#B45309"/>`; });
    o += `<text x="${x(S / 2)}" y="${(+y(y0) - 6).toFixed(1)}" font-size="11" text-anchor="middle" fill="#16304F" font-weight="600">${esc(X.nm_)} ${X.chS ? 'channel' : 'rolled W'} diaphragm, d = ${fmt(X.d, 2)} in</text>`
      + `<line x1="${x(0)}" y1="${(+y(dg) + 16).toFixed(1)}" x2="${x(S)}" y2="${(+y(dg) + 16).toFixed(1)}" stroke="#475569" stroke-width="0.8"/><text x="${x(S / 2)}" y="${(+y(dg) + 30).toFixed(1)}" font-size="10" text-anchor="middle" fill="#475569">S = ${fmt(S, 2)} in (largest girder spacing); girder depth d = ${fmt(dg, 2)} in</text>`
      + `<text x="${x(0)}" y="${(+y(dg) + 46).toFixed(1)}" font-size="10" fill="#475569">${nb} bolts each end at ${fmt(sp, 2)} in, ${fmt(ec, 2)} in from the web; diaphragm centred on the girder depth${D ? `; φ<tspan baseline-shift="sub" font-size="8">f</tspan>M<tspan baseline-shift="sub" font-size="8">n</tspan> = ${fmt(D.Mn, 0)} kip-in, φ<tspan baseline-shift="sub" font-size="8">v</tspan>V<tspan baseline-shift="sub" font-size="8">n</tspan> = ${fmt(D.Vn, 2)} kip` : ''}.</text>`;
    return `<svg viewBox="0 0 ${W} ${H.toFixed(0)}" style="width:100%;height:auto;max-height:60vh;background:#fff;border:1px solid #e4e7eb;border-radius:4px" role="img" aria-label="Diaphragm elevation">${o}</svg>
      <p class="note">Intermediate diaphragm looking along the girders (connection plates grey, bolts brown), nominal dimensions. Checks CFD (intermediate) and CFE (end diaphragms at the bearing lines) below; the details sheet is on the Drawings tab.</p>`;
  }
  /* SBXF (2026-11-13; engineer decision 2026-11-13, girder types): the governing bay of the frame checked, its two girders and their web
     depths (xfBayKv), and the assumption stated (xfBayNote; also the Report). '' for a project saved before girder types (no p.xfBay). */
  const bayTxt = B => { const gl = q => q ? `G${q.line + 1} ${q.label}` : 'no type'; return `G${B.j + 1}–G${B.j + 2}: ${gl(B.a)} D = ${B.a ? fmt(B.a.D, 2) : '—'} in, ${gl(B.b)} D = ${B.b ? fmt(B.b.D, 2) : '—'} in; ${B.eq ? 'equal depths' : `the shallower, G${B.s.line + 1} ${B.s.label}`}, D = ${fmt(B.D, 2)} in`; };
  // SBXF2 (SB-18, SB-20): the type's shallowest attached bay; d_W of the exterior girder
  const govLbl = B => B.scope === 'type' ? `Governing bay (shallowest attached to ${B.tl.map(j => `G${j + 1}`).join(', ')})` : 'Governing bay (shallowest)', wLbl = B => B.ext ? `exterior girder G${B.ext.q.line + 1} ${B.ext.q.label}` : B.rep;
  function xfBayKv(p) { const B = p.xfBay; return B ? `<div><span>${esc(govLbl(B))}</span><span>${esc(bayTxt(B))} ${wk('cf.xfD')}</span></div><div><span>d<sub>W</sub> (wind, ${esc(wLbl(B))})</span><span>${fmt(p.dW, 2)} in ${wk('cf.dW')}</span></div>` : ''; }
  function xfBayNote(p, bn) { const B = p.xfBay; if (!B) return '';
    return `<p class="note"><b>Assumption (engineer decision 2026-11-13):</b> each ${bn.replace(/s$/, '')} bay takes the depth of the shallower of the two girders it connects, by the girder type assigned to each line (Girders &amp; plates tab). The frame checked here is the governing bay, ${B.scope === 'type' ? `the shallowest attached to any line of ${esc(B.rep)} (engineer decision SB-18, 2026-11-13: the frames that brace this type)` : 'the shallowest'} (${esc(bayTxt(B))}), with the largest girder spacing S and the largest L<sub>b</sub> as before; the ${bn.replace(/s$/, '')} weights in DC1 take each bay's own h${B.hAuto ? '' : ' (h entered: the same in every bay)'}. ${B.ext ? `The wind acts on the exterior girder depth d<sub>W</sub>, the deeper of the girder types on G1 and the last line, whatever type is reported (engineer decision SB-20, 2026-11-13) ${wk('cf.dW')}` : 'The wind acts on the reported girder&#39;s own depth d<sub>W</sub> (no girder type on an exterior line)'}; the stability bracing check braces the reported girder (${esc(B.rep)}). ${isDia(p) ? 'The diaphragm depth (CFD, CFE) is checked in every bay against the deeper of its two girders (engineer decision SB-19, 2026-11-13). ' : ''}${wk('cf.xfD')}</p>`; }
  /* umNote(R): which way the entered member forces combine (CFRM), with a link to the input card and the worked step; '' when none is entered */
  function umNote(R) {
    const p = R.p || {}; if (isDia(p)) return '';   // SBDIA: entered member forces do not apply to a diaphragm
    const UM = R.UM || { StrI: 'add', Con: 'add' }, any = g => ['top', 'bot', 'diag'].some(k => +(((p.user || {})[g] || {})[k]) || 0) || UM[g] === 'replace';
    const part = (g, t) => any(g) ? `${t}: <b>${UM[g] === 'replace' ? 'Replace computed' : 'Add to computed'}</b> ${wk('cf.user.' + g)}` : '';
    const s = [part('StrI', 'Strength'), part('Con', 'Constructibility')].filter(Boolean);
    return s.length ? ` Entered member forces (<a href="#" data-goto="framing">Framing &amp; bracing tab</a>): ${s.join('; ')}.` : '';
  }
  function results(B) {
    const { L, R, C, fl, XF, br, line, I } = B, FR = L.FR, dOn = isDia(I.p), BN = dOn ? 'Diaphragms' : 'Cross-frames', bn = dOn ? 'diaphragms' : 'cross-frames'; let h = '';
    // governing
    let gov = null; (C || []).forEach(c => c.items.forEach(it => { if (isFinite(it.r) && (it.st === 'pass' || it.st === 'fail') && (!gov || it.r > gov.it.r)) gov = { c, it }; }));
    h += `<section class="sec"><div class="secHead">${BN}: governing</div><div class="secBody">
      ${gov ? `<p>Governing ratio <b class="${cls(gov.it.r)}">${fmt(gov.it.r, 3)}</b>: ${esc(gov.c.id)} ${window.SBDSub.html(gov.c.title)}, ${window.SBDSub.html(gov.it.loc)} ${wk(gov.it.step)}</p>` : ''}
      ${R.errors && R.errors.length ? `<div class="alert err">${R.errors.map(esc).join('<br>')}</div>` : ''}
      <div class="kv"><div><span>S (largest spacing)</span><span>${fmt(I.p.S, 2)} in</span></div><div><span>h / d</span><span>${fmt(I.p.h, 2)} / ${fmt(I.p.dg, 2)} in ${wk(I.p.xfBay ? 'cf.h' : 'cf.dg')}</span></div>${xfBayKv(I.p)}<div><span>L<sub>b</sub> (largest on any girder)</span><span>${fmt(I.p.Lb, 2)} ft ${wk('cf.Lb')}</span></div>
      <div><span>Deck placement M<sub>u</sub></span><span>${fmt(+I.p.sb.Mu, 1)} kip-ft</span></div><div><span>Stability span L, frames n</span><span>${fmt(I.p.sb.L, 2)} ft, ${I.p.sb.n}</span></div>${R.W ? `<div><span>F<sub>w</sub> Strength III / V</span><span>${fmt(R.W.III.Fw, 2)} / ${fmt(R.W.V.Fw, 2)} kip ${wk('cf.wIII.Fw')}</span></div>` : ''}</div>
      <p class="note">M<sub>u</sub>: ${window.SBDSub.html(I.src.Mu || '')}; ${window.SBDSub.html(I.src.sb || '')}.${umNote(R)}</p>${xfBayNote(I.p, bn)}</div></section>`;
    h += dOn ? `<section class="sec"><div class="secHead">Diaphragms: elevation</div><div class="secBody">${R.DIAg && R.DIAg.length ? R.DIAg.map(q => `<h4 class="sub">Bays ${q.bays.map(j => `G${j + 1}–G${j + 2}`).join(', ')}: ${esc(q.DIA.i ? q.DIA.i.nm_ : q.shape)} (d = ${fmt(q.dg, 2)} in, G${q.s.line + 1} ${esc(q.s.label)}; engineer decision SB-24)</h4>${diaSvg({ ...B, I: { ...I, p: q.p }, R: { ...R, DIA: q.DIA } })}`).join('') : diaSvg(B)}</div></section>`   // SBDIA: the diaphragm, not the X / K truss; SB-24: one per bay depth group
      : `<section class="sec"><div class="secHead">Cross-frames: elevation</div><div class="secBody"><div data-gfxb="crossframe"></div></div></section>`;   // drawn by ui/tabgraphics-b.js from the results below
    // layout
    h += `<section class="sec"><div class="secHead">Framing (6.7.4.2.1)</div><div class="secBody">${plan(L, dOn, { ui: true })}
      <div class="tscroll"><table class="tbl"><thead><tr><th>Span</th><th>Skew θ (°)</th><th class="lft">Orientation</th><th>Frames</th><th>Spacing (ft)</th><th>Conflicts</th><th></th></tr></thead><tbody>
      ${FR.orient.map(o => `<tr><td>${o.k + 1}</td><td>${fmt(o.th, 2)}</td><td class="lft">${o.o === 'normal' ? `normal, ${o.flat ? 'contiguous' : esc(o.arr)}` : 'parallel to the skew'}</td><td>${o.n}</td><td>${fmt(o.s, 3)}</td><td class="${o.conflicts ? 'fx-hi' : ''}">${o.conflicts || 0}</td><td>${wk(`fr.k${o.k}.s`)}</td></tr>`).join('')}</tbody></table></div>
      <div class="tscroll"><table class="tbl"><thead><tr><th>Girder</th><th>Intermediate frames</th><th>Largest L<sub>b</sub> (ft)</th><th class="lft">Brace points (own stations, ft)</th><th></th></tr></thead><tbody>
      ${L.girders.map(g => `<tr class="${g.i === line ? 'sel' : ''}"><td>G${g.i + 1}</td><td>${g.nInt}</td><td>${fmt(g.lb, 2)}</td><td class="lft" style="font-size:8.5pt">${g.braces.map(v => fmt(v, 2)).join(', ')}</td><td>${wk(`fr.g${g.i}.lb`)}</td></tr>`).join('')}</tbody></table></div>
      <p class="note">This plate girder takes cross-section girder G${line + 1}: its brace points (bearings and ${bn}, mapped to the analysis stations proportionally within each span) are the L<sub>b</sub> points of the Flexure tab with a hand-off file of this bridge and the ${dOn ? 'diaphragm' : 'cross-frame'} bays of the Shear &amp; stiffeners tab (${br ? br.ints.length : 0} intermediate ${dOn ? 'diaphragms' : 'frames'}).</p></div></section>`;
    // f_l and DC1
    h += `<section class="sec"><div class="secHead">Flange lateral bending and DC1</div><div class="secBody"><div class="kv">
      <div><span>f<sub>ℓ</sub> from skew, G${line + 1} (C6.10.1)</span><span>${fmt(fl.fl, 2)} ksi ${wk('flsk.fl')}</span></div>
      <div><span>${dOn ? 'Diaphragm' : 'Cross-frame'} point loads on G${line + 1}</span><span>${XF ? `${XF.pts.length}, ${fmt(XF.tot, 2)} kip` : 'not included'}</span></div>
      ${XF ? `<div><span>Weight model</span><span>${esc(XF.X.kind === 'ovr' ? 'entered per frame' : XF.X.kind === 'dia' ? 'diaphragms' : 'angles')}${XF.X.allow ? ` + ${fmt(XF.X.allow, 0)} %` : ''}</span></div>` : ''}</div>
      ${XF ? `<details><summary class="note">Point loads (x ft : P kip)</summary><p class="note">${XF.pts.map(q => `${fmt(q.x, 2)} : ${fmt(q.P, 3)}${q.end ? ' (bearing line)' : ''}`).join('; ')}</p></details>` : ''}</div></section>`;
    // checks
    const sIds = new Set((R.steps || []).map(t => t.id)), rS = recStep(sIds), sOf = id => (id === 'cf.type' && !sIds.has(id) ? rS : id);   // SBCKN: CF10's § to the step that exists
    const locH = (c, it) => { const x = ckRec(c, it); return window.SBDSub.html(it.loc) + (x ? `<div class="note">Recommended: ${window.SBDSub.html(x.rec)}. In use: ${window.SBDSub.html(x.sel)}. ${wk(rS)}</div>` : ''); };
    if (C) h += `<section class="sec"><div class="secHead">${ckHead(C, dOn)}</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th>Check</th><th class="lft">Item</th><th>Demand</th><th>Resistance / limit</th><th>Ratio</th><th>Status</th><th></th></tr></thead><tbody>
      ${C.map(c => c.items.length ? c.items.map((it, j) => `<tr>${j === 0 ? `<td rowspan="${c.items.length}" title="${esc(c.ref)}"><b>${esc(c.id)}</b><br><span class="note">${window.SBDSub.html(c.title)}</span></td>` : ''}<td class="lft">${locH(c, it)}</td><td>${isFinite(it.demand) ? big(it.demand) : esc((it.cells || [])[0] || '')}</td><td>${isFinite(it.capacity) ? big(it.capacity) : it.capacity === Infinity ? '∞' : esc((it.cells || [])[1] || '')}</td><td class="${cls(it.r)}">${isFinite(it.r) ? fmt(it.r, 3) : '—'}</td><td class="${it.st === 'fail' ? 'fx-ng' : it.st === 'warn' ? 'fx-hi' : it.st === 'na' ? 'fx-na' : 'fx-ok'}">${it.lbl ? esc(it.lbl) : stName(it.st)}</td><td>${wk(sOf(it.step))}</td></tr>`).join('')
        : `<tr><td title="${esc(c.ref)}"><b>${esc(c.id)}</b></td><td class="lft fx-na" colspan="6">${window.SBDSub.html(c.title)}: ${esc(c.naWhy || 'n/a')}</td></tr>`).join('')}</tbody></table></div>
      ${ckNotes(C).map(q => `<p class="note"><b>${esc(q.id)}:</b> ${window.SBDSub.html(q.note)}${q.id === 'CF10' ? ` ${wk(rS)}` : ''}</p>`).join('')}
      <p class="note">References: ${C.map(c => `${esc(c.id)} ${esc(c.ref)}`).join('; ')}.</p></div></section>`;
    // member forces
    if (R.frames && !dOn) h += `<section class="sec"><div class="secHead">Member forces (truss model)</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Member</th><th>Length (in)</th><th>per kip of F<sub>w</sub></th>${R.combos.map(c => `<th>${esc(c.id)} T / C (kip)</th>`).join('')}</tr></thead><tbody>
      ${R.frames.map((e, i) => `<tr><td class="lft">${esc(e.lbl)}</td><td>${fmt(e.L, 2)}</td><td>${fmt(e.unit, 3)} ${wk(`cf.tr${i}`)}</td>${R.combos.map(c => c.off ? '<td class="fx-na">not used</td>' : `<td>${fmt(c.f[i].T, 2)} / ${fmt(c.f[i].Cc, 2)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Each load combination is a separate case (AASHTO LRFD 10th Ed. Table 3.4.1-1), checked on its own; each member is designed for the largest. Strength I: the entered member forces (nothing is computed for Strength I); Strength III and V: ± |wind force| f<sub>w</sub>F<sub>w</sub> alone (not added to the Strength I forces); Constructibility: the entered forces ± brace force f<sub>br</sub>M<sub>br</sub>. The top chord work points are held by the deck.${umNote(R)}</p></div></section>`;
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
    window.SharedSteps.wire(host, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    if (!S.R.err && window.SBDTabGfxBUI && !isDia(S.R.I.p)) window.SBDTabGfxBUI.crossframe(host, ctx, S.R);   // SBDIA: not with a diaphragm (no host)   // the cross-frame elevation (ui/tabgraphics-b.js)
    host.querySelectorAll('[data-cfgo]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const t = host.querySelector('#st-' + a.dataset.cfgo.replace(/[^\w.-]/g, '').replace(/\./g, '\\.')); if (t) { t.scrollIntoView({ block: 'center' }); t.style.background = '#FFF7D6'; } }));
  }

  window.SBDFramingUI = { ensure, braceOf, setBrace, inputs, windCard, layoutPlan, onChange, onClick, render, build, plan, TOPICS, groups, isDia, ckHead, diaSvg, ckRec, recStep, ckNotes, CONN_HINT };
})();
