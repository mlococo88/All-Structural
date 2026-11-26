/* apps/steel-bridge/ui/deck.js — the "Deck" output tab and the Deck design input card (window.SBDDeckUI). Classic script; display and
   input only. Created 2026-11-23 (DK; engineer request 2026-11-23: the deck design of the Prestressed Bridge Design app in this app).
   Every number is engine/deck.js calc(P) (shared/deck.js, the same method as the Prestressed app's deck module); nothing is calculated here.

   The module is optional and OFF until switched on (P.deckDesign.on; a project saved before 2026-11-23 has no P.deckDesign and reads as
   off). While it is off the tab says so and links to the switch; P.deckDesign is written only when the user changes one of its inputs.
   Inputs (Cross-section input tab, card "Deck design (transverse)"): the switch, the top and bottom transverse bars (size, spacing, clear
   cover), the top and bottom longitudinal bars (size and spacing; optional, DKL 2026-11-24) and the negative-moment design section
   (automatic b_f/4, or entered). Everything else is read from the project and shown with a
   link to where it is entered: girder spacings, overhangs, deck edges, sidewalks (Cross-section tab), slab thicknesses (Cross-section tab,
   Deck), f'c, w_c, F_yr (Materials tab), wearing surface and overlays (Loads tab), owner eta and m (Project tab).

   inputs(P) -> HTML of the input card; onChange(el, P) -> true when it changed P.deckDesign;
   render(host, ctx), ctx = { P, changed(redrawInputs) }; build(ctx) -> engine/deck.js calc(P) (the Report);
   groups(kind, list) -> SharedSteps.group of the steps (the Report's worked steps); figure(R, W, P) -> the deck section as an SVG string
   (P optional: the left deck edge's sidewalk, barrier or curb and railing / fence, DKFE 2026-11-24). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const DK = () => window.SBDDeck, sb = t => (window.SBDSub ? window.SBDSub.html(t) : esc(t));
  const OPEN = new Set();
  const cls = r => !isFinite(r) ? 'dk-ng' : r > 1 + 1e-9 ? 'dk-ng' : r >= 0.9 ? 'dk-hi' : 'dk-ok';

  function css() {
    if (document.getElementById('dk-css')) return;
    const st = document.createElement('style'); st.id = 'dk-css';
    st.textContent = `.dk-ok{background:#e7f4ec;} .dk-hi{background:#fdf3d8;} .dk-ng{background:#fbe1dd;font-weight:600;} .dk-fig{max-width:100%;height:auto;display:block;margin:4px 0;}
      .dk-off{font-size:10.5pt;} .dk-ro{display:inline-block;min-width:5em;font-weight:600;}`;
    document.head.appendChild(st);
  }

  /* ---------- the input card (Cross-section input tab) ---------- */
  function inputs(P) {
    const D = DK().inputs(P), on = D.on === true;
    const opt = (v, t, cur) => `<option value="${esc(v)}"${String(cur) === String(v) ? ' selected' : ''}>${esc(t)}</option>`;
    const num = (k, lbl, unit) => `<div class="fRow"><label for="dk_${k}">${lbl}</label><input type="number" step="any" id="dk_${k}" data-dk="${k}" value="${esc(D[k])}"><span class="unit">${unit}</span></div>`;
    const bar = (k, lbl) => { const std = DK().BARS.some(q => Math.abs(q[1] - +D[k]) < 1e-9);
      return `<div class="fRow"><label for="dk_${k}">${lbl}</label><select id="dk_${k}" data-dk="${k}">${DK().BARS.map(q => opt(q[1], `${q[0]} (${fmt(q[1], 2)} in²)`, std ? +D[k] : '')).join('')}${std ? '' : opt(D[k], `A_b = ${D[k]} in²`, D[k])}</select></div>`; };
    const lbar = (k, lbl) => { const v = +D[k], has = isFinite(v) && v > 0, std = DK().BARS.some(q => Math.abs(q[1] - v) < 1e-9);   // DKL: the longitudinal bars, blank = not entered
      return `<div class="fRow"><label for="dk_${k}">${lbl}</label><select id="dk_${k}" data-dk="${k}">${opt('', '— not entered —', has ? 'x' : '')}${DK().BARS.map(q => opt(q[1], `${q[0]} (${fmt(q[1], 2)} in²)`, has && std ? v : 'x')).join('')}${has && !std ? opt(v, `A_b = ${v} in²`, v) : ''}</select></div>`; };
    const lnum = (k, lbl) => `<div class="fRow"><label for="dk_${k}">${lbl}</label><input type="number" step="any" id="dk_${k}" data-dk="${k}" value="${D[k] == null || !isFinite(+D[k]) ? '' : esc(D[k])}" placeholder="not entered"><span class="unit">in</span></div>`;
    let h = `<div class="fRow"><label for="dk_on">Deck design (strip method)</label><select id="dk_on" data-dk="on">${opt('false', 'Off', String(on))}${opt('true', 'On', String(on))}</select></div>`;
    if (on) h += `${bar('barTop', 'Top transverse bars')}${num('sTop', 'Top bar spacing', 'in')}${num('coverT', 'Top clear cover', 'in')}
      ${bar('barBot', 'Bottom transverse bars')}${num('sBot', 'Bottom bar spacing', 'in')}${num('coverB', 'Bottom clear cover', 'in')}
      <div class="fRow"><label for="dk_xnegAuto">Negative-moment design section</label><select id="dk_xnegAuto" data-dk="xnegAuto">${opt('true', 'Automatic: b_f/4 of the narrowest top flange (4.6.2.1.6)', String(D.xnegAuto !== false))}${opt('false', 'Entered', String(D.xnegAuto !== false))}</select></div>
      ${D.xnegAuto === false ? num('xneg', 'Design section from the girder ℄', 'in (0 to 24)') : ''}
      <div class="fRow"><label for="dk_exposure">Crack control exposure (5.6.7)</label><select id="dk_exposure" data-dk="exposure">${opt('1', 'Class 1, γe = 1.00 (default)', +D.exposure === 2 ? 2 : 1)}${opt('2', 'Class 2, γe = 0.75', +D.exposure === 2 ? 2 : 1)}</select></div>
      ${lbar('barLongTop', 'Top longitudinal bars')}${lnum('sLongTop', 'Top longitudinal spacing')}${lbar('barLongBot', 'Bottom longitudinal bars')}${lnum('sLongBot', 'Bottom longitudinal spacing')}`;
    h += `<p class="note">Transverse design of the slab: interior bays (AASHTO LRFD 10th Ed. Table A4-1) and the overhangs (gravity loads), as the Prestressed Bridge Design app. Optional: off until switched on${on ? '' : '; while it is off nothing is calculated and no result changes'}. Results: <a href="#" data-gotab="dk">Deck tab</a>.
      It uses what the project already holds: the girder spacings, overhangs, deck edges and sidewalks (this tab), the slab thicknesses (Deck card above), f′<sub>c</sub> (<a href="#" data-itgo="mat">Materials tab</a>), w<sub>c</sub> and F<sub>yr</sub> (<a href="#" data-sbset="mat">Settings › Concrete and reinforcement</a>), the wearing surface (<a href="#" data-itgo="loads">Loads tab</a>) and the owner's η and m (<a href="#" data-itgo="proj" data-sbset="own">Settings › Owner and load modifiers</a>).${on ? ' The covers here are the clear covers of the transverse bars; the rebar depths of the Deck card above are those of the longitudinal layers (the girder\'s composite section) and are not used here. Longitudinal bars (parallel to the girders; optional): drawn in the Deck tab\'s section inside the transverse bars; the bottom ones, where entered, are checked against the distribution reinforcement of 9.7.3.2 (DK4). The top ones are drawn and reported, not checked.' : ''}</p>`;
    return `<section class="sec" id="dkIn"><div class="secHead">Deck design (transverse)</div><div class="secBody">${h}</div></section>`;
  }
  /* onChange(el, P): an input of the card (data-dk). P.deckDesign is created on the first change (the defaults, then the change). */
  function onChange(el, P) {
    const k = el && el.dataset ? el.dataset.dk : null; if (!k) return false;
    if (!P.deckDesign || typeof P.deckDesign !== 'object') P.deckDesign = { ...DK().DEF };
    const v = el.value;
    if (/^(barLong|sLong)(Top|Bot)$/.test(k) && v === '') { delete P.deckDesign[k]; return true; }   // DKL: blank = not entered (no key, as a project saved before)
    P.deckDesign[k] = (k === 'on' || k === 'xnegAuto') ? v === 'true' : (v === '' ? NaN : Number(v));
    return true;
  }

  /* ---------- worked steps ---------- */
  /* SBNG-DK (2026-11-24; engineer, approved follow-up of #1709 SBNG): the step a failing deck check links to is red with "NG" (ui/sub.js mark;
     the deck has no warning items). marks(R) -> SBDSub.stepSt of: each check row R.checks (DK1 to DK6) that is NG, at its step (the "§" of
     the checks table); an overhang side that is NG (its row of the Overhangs table, dk.oh<L|R>.cap.r); a DK5 bar set or a DK6 section that is
     NG (its row of the DK5 / DK6 table): its test steps whose ok is false (area or spacing; bar stress or spacing). A "Not checked" row (no
     bars entered) and a step whose ok only states a case have no status: not marked (grey "no" as before). Display only. */
  const marks = R => { const S = window.SBDSub, e = [], f = step => e.push({ step, st: 'fail' }), bad = pre => (R.steps || []).filter(s => s.id.indexOf(pre) === 0 && s.ok === false).forEach(s => f(s.id));
    if (!S || !R) return null;
    (R.checks || []).forEach(c => { if (!c.ok) f(c.step); });
    ['L', 'R'].forEach(sd => { const q = R.oh && R.oh[sd]; if (q && q.cap && q.cap.ok === false) f(`dk.oh${sd}.cap.r`); });
    ((R.ts && R.ts.sets) || []).forEach(q => { if (q.on && !q.ok) bad(`dk.ts.${q.k}.`); });
    ((R.crack && R.crack.cases) || []).forEach(q => { if (q.app && !q.ok) bad(`dk.${q.key}.`); });
    return S.stepSt(e); };
  const stepLi = (s, ST) => { const k = window.SBDSub ? window.SBDSub.mark(s, ST) : { cls: s.ok === false ? 'no' : '', tag: '' };
    return `<li id="st-${esc(s.id)}"${k.cls ? ` class="${k.cls}"` : ''}><div class="lbl">${k.tag}${sb(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${sb(s.note)}</div>` : ''}</li>` };
  const groups = (kind, list) => window.SharedSteps.group(list, DK().topics(DK().metaOf(list)), { strip: /^dk\./ });
  const see = id => `<a href="#st-${esc(id)}" title="Worked step">§</a>`;

  /* ---------- the deck section over the left exterior girder and the first interior girder (true scale across; display only) ---------- */
  /* DKFE (2026-11-24, engineer: the Deck tab's section consistent with the renderers of FOB / GEOM): edgeOf(P) -> the deck-edge items of the
     left side (the side the figure shows) as the Drawings tab draws them, SBDDrawings.appOf of the Loads module's cross-section (the same
     SBDLoads.fromModel(P, { girder: 0 }) / compute that engine/deck.js reads): the sidewalk, the barrier (the schematic outline BAR_SCH of an
     entered barrier, the outline of shared/barrier.js for one entered by its geometry) or the curb, and the railing / fence with its base y0
     on the barrier or curb top (SBDDrawings.topAt) or on the sidewalk. null without P or the modules (the figure then draws the schematic
     barrier to the traffic face, as before DKFE). Display only: nothing here reaches R. */
  function edgeOf(P) {
    const LD = window.SBDLoads, DW = window.SBDDrawings; if (!P || !LD || !DW || !DW.appOf) return null;
    try { const q = LD.fromModel(P, { girder: 0 }), L = LD.compute(q.b, q.p); if (L.errors && L.errors.length) return null;
      return DW.appOf(L).items.filter(a => a.sd === 'L' && /^(sw|bar|curb|rail|fence)$/.test(a.k)); } catch (e) { return null; }
  }
  /* wrap(t, n): t in lines of at most about n characters (at the spaces) */
  const wrap = (t, n) => { const out = []; let l = ''; String(t).split(' ').forEach(wd => { if (l && (l + ' ' + wd).length > n) { out.push(l); l = wd; } else l = l ? l + ' ' + wd : wd; }); if (l) out.push(l); return out; };
  /* edgeCap(EI): the caption line of the deck-edge elements (DKFE) */
  function edgeCap(EI) {
    const f2 = v => fmt(v, 2), f1 = v => fmt(v, 1), DW = window.SBDDrawings, on = x => { const t = DW.topAt(EI, 'L', x); if (t === null) return EI.some(a => a.k === 'sw' && x >= a.x0 - 1e-9 && x <= a.x1 + 1e-9) ? 'on the sidewalk' : 'on the deck';
      const c = EI.find(a => (a.k === 'bar' || a.k === 'curb') && x >= a.x0 - 1e-9 && x <= a.x1 + 1e-9); return `on the ${c && c.k === 'curb' ? 'curb' : 'barrier'} top`; };
    const p = EI.map(a => a.k === 'sw' ? `sidewalk ${f2(a.x1 - a.x0)} ft × ${f1(a.h)} in`
      : a.k === 'bar' ? `barrier ${f2(a.x1 - a.x0)} ft at the deck${a.geo ? ` × ${f1(a.h)} in, its outline from its geometry` : ' (shape and 34 in height schematic, as the Drawings tab)'}${a.y0 > 0 ? ' on the sidewalk' : ''}`
      : a.k === 'curb' ? `curb ${f1((a.x1 - a.x0) * 12)} × ${f1(a.h)} in${a.y0 > 0 ? ' on the sidewalk' : ''}`
      : `${a.k === 'rail' ? 'railing' : 'railing or fence'} at ${f2(a.x)} ft ${on(a.x)}`);
    return `Left deck edge: ${p.length ? p.join('; ') : 'none'}.${EI.some(a => a.k === 'rail' || a.k === 'fence') ? ' Railing / fence height 42 in schematic.' : ''} Heights above the slab at a reduced scale, widths true.`;
  }
  /* figure(R, W, P): P (optional, DKFE) the project, for the deck-edge elements; without it the schematic barrier as before */
  function figure(R, W, P) {
    const q = R.oh.L, O = q.O, In = R.in, D = R.D, S = R.bays[0].S, ts = In.ts, oh = O.oh * 12, Sp = S * 12, x1 = oh + Sp + Math.min(Sp * 0.4, 30), bf = In.bf || 16;
    const EI = edgeOf(P);
    const w = Math.max(360, Math.min(W || 760, 900));
    const cap = EI ? wrap(edgeCap(EI), Math.floor((w - 20) / 5.6)) : [];   // DKFE: the deck-edge caption, wrapped to the figure width
    const m = { l: 14, r: 44, t: 58, b: 60 + 14 * cap.length }, k = (w - m.l - m.r) / x1;
    // DKFE: heights above the slab at the figure's reduced scale (the schematic barrier's 34 in drawn 26 px since DK); widths true
    const kv = Math.min(k, 26 / 34), topIn = EI ? EI.reduce((a, b) => Math.max(a, b.y0 + (b.h || 0)), 0) : 0;
    m.t = Math.max(58, Math.round(topIn * kv + 32));
    const H = Math.round(m.t + ts * k + 18 * k + m.b);
    const X = x => m.l + x * k, Y = y => m.t + (ts - y) * k;   // y up from the bottom of the slab
    const Yv = y => Y(ts) - y * kv;   // DKFE: y in above the top of the slab, at the reduced vertical scale
    const f1 = v => fmt(v, 2), gx = [oh, oh + Sp], face = O.face * 12, xw = face + 12, dbT = Math.sqrt(4 * +D.barTop / Math.PI), dbB = Math.sqrt(4 * +D.barBot / Math.PI);
    const yT = ts - +D.coverT - dbT / 2, yB = +D.coverB + dbB / 2;
    const dimH = (a, b, y, t) => `<line x1="${X(a)}" y1="${y}" x2="${X(b)}" y2="${y}" stroke="#475569" stroke-width="1"/><line x1="${X(a)}" y1="${y - 4}" x2="${X(a)}" y2="${y + 4}" stroke="#475569"/><line x1="${X(b)}" y1="${y - 4}" x2="${X(b)}" y2="${y + 4}" stroke="#475569"/><text x="${(X(a) + X(b)) / 2}" y="${y - 4}" text-anchor="middle" font-size="11" fill="#1e293b">${t}</text>`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" class="dk-fig" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="Deck section over the left exterior girder: overhang, barrier, design wheel, design sections, transverse bars (lines) and longitudinal bars (circles)"><rect width="${w}" height="${H}" fill="#fff"/>`;
    s += `<rect x="${X(0)}" y="${Y(ts)}" width="${x1 * k}" height="${ts * k}" fill="#e2e8f0" stroke="#334155"/>`;
    gx.forEach(x => { s += `<rect x="${X(x - bf / 2)}" y="${Y(0)}" width="${bf * k}" height="${Math.max(3, 1.2 * k)}" fill="#64748b"/><rect x="${X(x) - Math.max(1, 0.3 * k)}" y="${Y(0)}" width="${Math.max(2, 0.6 * k)}" height="${14 * k}" fill="#64748b"/>
      <line x1="${X(x)}" y1="${Y(ts) - 30}" x2="${X(x)}" y2="${Y(0) + 16 * k}" stroke="#0f172a" stroke-dasharray="8 3 2 3" stroke-width="0.8"/>`; });
    s += `<text x="${X(gx[0]) + 4}" y="${Y(0) + 15 * k + 12}" font-size="10.5" fill="#334155">exterior girder ℄</text>`;
    let wy = 0;   // DKFE: the wheel stands on the surface under it (the sidewalk where one is there), else on the slab as before
    if (!EI) { if (face > 0) s += `<polygon points="${X(0)},${Y(ts)} ${X(face)},${Y(ts)} ${X(face * 0.6)},${Y(ts) - 26} ${X(0)},${Y(ts) - 26}" fill="#cbd5e1" stroke="#334155"/>`; }
    else {   // DKFE: the deck-edge elements of the left side, as the Drawings tab (engine/drawings.js appDraw); the railing / fence on the top under it
      const DW = window.SBDDrawings, cx = x => X(Math.min(x, x1)), pt = (x, y) => `${X(x)},${Yv(y)}`;
      EI.forEach(a => {
        if (a.k === 'sw' || a.k === 'curb') { if (a.x0 * 12 < x1) s += `<rect data-dkedge="${a.k}" x="${X(a.x0 * 12)}" y="${Yv(a.y0 + a.h)}" width="${cx(a.x1 * 12) - X(a.x0 * 12)}" height="${a.h * kv}" fill="${a.k === 'sw' ? '#e2e8f0' : '#cbd5e1'}" stroke="#334155"/>`; }
        else if (a.k === 'bar') s += `<polygon data-dkedge="bar" points="${DW.barOutline(a).map(([u, y]) => pt(a.x0 * 12 + u, a.y0 + y)).join(' ')}" fill="#cbd5e1" stroke="#334155"/>`; });
      EI.filter(a => a.k === 'rail' || a.k === 'fence').forEach(a => { const x = X(a.x * 12), r = 3 * k;
        s += `<g data-dkedge="${a.k}" data-base="${a.y0}"><line x1="${x}" y1="${Yv(a.y0)}" x2="${x}" y2="${Yv(a.y0 + a.h)}" stroke="#7f1d1d" stroke-width="1.6"/><line x1="${x - r}" y1="${Yv(a.y0 + a.h - 1.5)}" x2="${x + r}" y2="${Yv(a.y0 + a.h - 1.5)}" stroke="#7f1d1d" stroke-width="1.3"/><line x1="${x - r}" y1="${Yv(a.y0 + a.h * 0.55)}" x2="${x + r}" y2="${Yv(a.y0 + a.h * 0.55)}" stroke="#7f1d1d" stroke-width="1.3"/></g>`; });
      const t = DW.topAt(EI, 'L', xw / 12), sw = EI.find(a => a.k === 'sw' && xw / 12 >= a.x0 - 1e-9 && xw / 12 <= a.x1 + 1e-9);
      wy = t !== null ? t : sw ? sw.h : 0; }
    const wv = wy * kv;
    if (O.Xoh > 0) s += `<line x1="${X(xw)}" y1="${Y(ts) - 34 - wv}" x2="${X(xw)}" y2="${Y(ts) - 2 - wv}" stroke="#1E3A5F" stroke-width="2"/><polygon points="${X(xw) - 4},${Y(ts) - 9 - wv} ${X(xw) + 4},${Y(ts) - 9 - wv} ${X(xw)},${Y(ts) - 1 - wv}" fill="#1E3A5F"/><text x="${X(xw) + 5}" y="${Y(ts) - 28 - wv}" font-size="10.5" fill="#1E3A5F">16 kip wheel, X = ${f1(O.Xoh)} ft</text>`;
    [gx[0] + In.xneg, gx[1] - In.xneg].forEach(x => { s += `<line x1="${X(x)}" y1="${Y(ts) - 4}" x2="${X(x)}" y2="${Y(0) + 4}" stroke="#2563EB" stroke-width="1.6"/>`; });
    s += `<text x="${X(gx[0] + In.xneg) + 4}" y="${Y(0) + 15}" font-size="10.5" fill="#2563EB">design section, x = ${f1(In.xneg)} in</text>`;
    // DKL (2026-11-24, engineer: "The deck is missing the transverse steel"): this is a section ACROSS the bridge, so the transverse bars
    // (perpendicular to traffic) are continuous lines at their cover depth, from 2 in inside the deck edge to the cut; the circles are the
    // LONGITUDINAL bars (parallel to the girders) at their spacing, inside the transverse bars (bottom ones on the bottom transverse bars, top
    // ones under the top transverse bars). Before DKL the transverse bars were drawn as circles at their spacing.
    const LB = R.long || DK().longBars(D), nm = A => esc(DK().barName(A));
    [['top', yT, dbT, '#B45309', +D.barTop, +D.sTop], ['bot', yB, dbB, '#0f766e', +D.barBot, +D.sBot]].forEach(([t, y, db, c, A, sp]) => {
      s += `<line data-dkbar="${t}-tr" x1="${X(2)}" y1="${Y(y)}" x2="${X(x1)}" y2="${Y(y)}" stroke="${c}" stroke-width="${Math.max(1.5, db * k)}" stroke-linecap="round"/>`;
      s += `<text x="${X(oh + Sp * (t === 'top' ? 0.5 : 0.62))}" y="${t === 'top' ? Y(ts) - 5 : Y(0) + 28}" text-anchor="middle" font-size="10.5" fill="${c}">${t === 'top' ? 'top' : 'bottom'} transverse ${nm(A)} @ ${f1(sp)} in</text>`; });
    const yL = { top: ts - +D.coverT - dbT, bot: +D.coverB + dbB };   // the face of the transverse bars that the longitudinal bars sit on
    [['top', '#7C2D12'], ['bot', '#134E4A']].forEach(([t, c]) => { const q = LB[t]; if (!q) return;
      const y = t === 'top' ? yL.top - q.db / 2 : yL.bot + q.db / 2;
      for (let x = 3; x < x1 - 1; x += Math.max(q.s, 3)) s += `<circle data-dkbar="${t}-long" cx="${X(x)}" cy="${Y(y)}" r="${Math.max(1.5, q.db / 2 * k)}" fill="#fff" stroke="${c}" stroke-width="1.3"/>`; });
    s += dimH(0, oh, 16, `o_h = ${f1(O.oh)} ft`) + dimH(oh, oh + Sp, 16, `S = ${f1(S)} ft`);
    s += `<text x="${X(x1) + 4}" y="${Y(ts / 2) + 4}" font-size="11" fill="#1e293b">t_s ${fmt(ts, 1)}</text>`;
    cap.forEach((t, i) => { s += `<text data-dkedgecap="${i + 1}" x="${m.l}" y="${H - 36 - 14 * (cap.length - 1 - i)}" font-size="10.5" fill="#475569">${esc(t)}</text>`; });
    s += `<text x="${m.l}" y="${H - 22}" font-size="10.5" fill="#475569">Transverse bars (lines): top ${nm(+D.barTop)} at ${f1(+D.sTop)} in (cover ${f1(+D.coverT)} in); bottom ${nm(+D.barBot)} at ${f1(+D.sBot)} in (cover ${f1(+D.coverB)} in). Girders schematic.</text>`;
    const lt = q => (q ? `${nm(q.A)} at ${f1(q.s)} in` : 'not entered');
    s += `<text data-dklong="${LB.top || LB.bot ? 'on' : 'none'}" x="${m.l}" y="${H - 8}" font-size="10.5" fill="#475569">${LB.top || LB.bot ? `Longitudinal bars (circles, inside the transverse bars): top ${lt(LB.top)}; bottom ${lt(LB.bot)}.` : 'Longitudinal bars not entered (Cross-section tab, Deck design): none drawn.'}</text>`;
    return s + '</svg>';
  }

  /* dcCells(c): the demand and capacity cells of a check row: M_u and phi M_n, else the check's own pair (dem / cap: TeX symbol, value,
     unit; DK4, DK5, DK6), else '—' */
  const dcCells = c => { if (c.Mu != null) return `<td>${fmt(c.Mu, 2)}</td><td>${fmt(c.phiMn, 2)}</td>`;
    const one = q => (q ? `<td>${window.SharedSteps.toHTML(q.sym)} ${fmt(q.v, q.unit === 'in²/ft' ? 3 : 2)}<br><span style="font-size:8.5pt">${esc(q.unit)}</span></td>` : '<td>—</td>');
    if (c.dem || c.cap) return one(c.dem) + one(c.cap);
    return c.req != null ? one({ sym: 'A_{s,d}', v: c.req, unit: c.unit || 'in²/ft' }) + one({ sym: 'A_{s,prov}', v: c.prov, unit: c.unit || 'in²/ft' }) : '<td>—</td><td>—</td>'; };
  function results(R, P) {
    const In = R.in, D = R.D, lnk = (t, tab) => `<a href="#" data-goin="${tab}">${t}</a>`, many = R.bays.length > 1;
    const st = c => `<td class="${cls(c.r)}">${isFinite(c.r) ? fmt(c.r, 3) : '∞'}</td><td class="${c.ok ? 'dk-ok' : 'dk-ng'}">${c.ok ? 'OK' : 'NG'}</td>`;
    const nF = R.checks.filter(c => !c.ok).length, gov = R.checks.reduce((a, c) => (c.r > a.r ? c : a));
    let h = `<section class="sec" id="dk-gov"><div class="secHead">Deck design: checks</div><div class="secBody">
      <p style="font-size:11pt;margin:4px 0 6px"><b>Governing:</b> ${esc(gov.id)} ${esc(gov.title)}, ${esc(gov.loc)}: ratio <span class="${cls(gov.r)}" style="padding:0 6px">${fmt(gov.r, 3)}</span> ${nF ? `<span class="dk-ng" style="padding:0 4px">${nF} check${nF > 1 ? 's' : ''} NG</span>` : 'all checks OK'}</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th class="lft">Governing location</th><th>M<sub>u</sub> (demand)<br>kip-ft/ft</th><th>φM<sub>n</sub> (capacity)<br>kip-ft/ft</th><th>Ratio</th><th>Status</th><th></th><th class="lft">Reference</th></tr></thead><tbody>
      ${R.checks.map(c => `<tr data-dkck="${c.id}"><td class="lft">${esc(c.id)} ${esc(c.title)}</td><td class="lft">${esc(c.loc)}</td>${dcCells(c)}${st(c)}<td>${see(c.step)}</td><td class="lft" style="font-size:8.5pt">${esc(c.ref)}</td></tr>`).join('')}
      ${R.checks.some(c => c.id === 'DK4') ? '' : `<tr data-dkck="DK4-none"><td class="lft">DK4 Deck distribution reinforcement, bottom longitudinal bars</td><td class="lft" colspan="6"><i>Not checked: bottom longitudinal bars not entered</i> (<a href="#" data-goin="xsec">Cross-section tab, Deck design</a>); required A<sub>s,d</sub> = ${fmt(R.dist.As, 3)} in²/ft ${see('dk.distAs')}</td><td class="lft" style="font-size:8.5pt">AASHTO LRFD 10th Ed. Art. 9.7.3.2</td></tr>`}
      </tbody></table></div>
      <p class="note">Strip method per foot of deck, AASHTO LRFD 10th Ed. (2024): the same method as the Prestressed Bridge Design app's deck module. Strength I${In.eta !== 1 || In.mLL !== 1 ? ` with the owner's η = ${fmt(In.eta, 3)}${In.mLL !== 1 ? ` and m = ${fmt(In.mLL, 2)}` : ''} (${lnk('Project tab', 'proj')})` : ''}.
      DK4 to DK6 are not moment checks: their columns show the demand and the limit of the check (areas in²/ft, spacings in, stress ksi). <a href="#dk-ts">DK5 shrinkage and temperature (5.10.6)</a>, <a href="#dk-cr">DK6 crack control (5.6.7, Service I)</a>.
      <b>Not checked here:</b> the Extreme Event II vehicular-collision cases of the overhang (A13.4; they need a barrier-specific analysis), minimum reinforcement (5.6.3.3), the maximum spacing of 5.10.3.2, bar development.</p>
      ${R.warn.map(w => `<div class="alert">${esc(w)}</div>`).join('')}</div></section>`;
    h += `<section class="sec"><div class="secHead">Deck section</div><div class="secBody"><div id="dk-fig"></div><p class="note">The left overhang and the first bay, true scale across: the left deck edge as the Drawings tab draws it (the sidewalk, the barrier or the curb, and the railing or fence on its top; heights above the slab at a reduced scale), the design wheel 1 ft inside the traffic face, the negative-moment design sections (blue), the top (brown) and bottom (green) transverse bars as lines at their covers, and the longitudinal bars, where entered, as circles at their spacings inside them (top under the top transverse bars, bottom on the bottom transverse bars). Display only.</p></div></section>`;
    const ro = (lbl, v, where) => `<div class="fRow"><label>${lbl}</label><span class="dk-ro">${v}</span><span class="unit">${where}</span></div>`;
    h += `<section class="sec"><div class="secHead">Values used (from the project)</div><div class="secBody">
      ${ro('Girder spacings S', R.bays.map(q => `${fmt(q.S, 2)} ft`).join(', '), lnk('Cross-section tab', 'xsec'))}
      ${ro('Overhangs o<sub>h</sub>, left / right', `${fmt(R.oh.L.O.oh, 2)} / ${fmt(R.oh.R.O.oh, 2)} ft`, lnk('Cross-section tab', 'xsec'))}
      ${ro('Deck edge to the traffic face, left / right', `${fmt(R.oh.L.O.face, 2)} / ${fmt(R.oh.R.O.face, 2)} ft`, `${lnk('Cross-section tab', 'xsec')} (deck edges, sidewalks), as the <a href="#" data-gotab="loads">Loads &amp; LLDF tab</a>`)}
      ${ro('Structural slab t<sub>s</sub> / total (dead load)', `${fmt(In.ts, 2)} / ${fmt(In.tL, 2)} in`, lnk('Cross-section tab, Deck', 'xsec'))}
      ${ro('f′<sub>c</sub>, w<sub>c</sub>, F<sub>yr</sub>', `${fmt(In.fc, 2)} ksi, ${fmt(In.wc, 3)} kcf, ${fmt(In.fy, 0)} ksi`, lnk('Materials tab', 'mat'))}
      ${ro('Wearing surface and overlays w<sub>DW</sub>', `${fmt(In.wDW, 4)} ksf`, lnk('Loads tab', 'loads'))}
      ${ro('Narrowest top flange b<sub>f</sub>', `${fmt(In.bf, 2)} in`, `${esc(In.bfAt)}; ${lnk('Girders &amp; plates tab', 'gird')}`)}
      ${ro('Design section x', `${fmt(In.xneg, 2)} in`, `${In.auto ? 'b<sub>f</sub>/4 (4.6.2.1.6)' : 'entered'} ${see('dk.b1.xneg')}`)}
      ${ro('Top bars / bottom bars', `${esc(DK().barName(+D.barTop))} at ${fmt(+D.sTop, 2)} in / ${esc(DK().barName(+D.barBot))} at ${fmt(+D.sBot, 2)} in`, lnk('Cross-section tab, Deck design', 'xsec'))}
      ${ro('Clear cover, top / bottom', `${fmt(+D.coverT, 2)} / ${fmt(+D.coverB, 2)} in`, lnk('Cross-section tab, Deck design', 'xsec'))}
      ${ro('Longitudinal bars, top / bottom', ['top', 'bot'].map(t => R.long && R.long[t] ? `${esc(DK().barName(R.long[t].A))} at ${fmt(R.long[t].s, 2)} in` : 'not entered').join(' / '), `${lnk('Cross-section tab, Deck design', 'xsec')}${R.long && R.long.bot ? ` (bottom: DK4 ${see('dk.distR')})` : ''}`)}</div></section>`;
    h += `<section class="sec"><div class="secHead">Interior bays: transverse moments per foot of deck</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Bays</th><th class="lft">Moment</th><th>M<sub>DC</sub></th><th>M<sub>DW</sub></th><th>M<sub>LL+IM</sub><br>Table A4-1</th><th>M<sub>u</sub><br>Strength I</th><th>φM<sub>n</sub></th><th>Ratio</th><th></th></tr></thead><tbody>
      ${R.bays.map((q, k) => { const I = q.I, b = 'dk.b' + (k + 1) + '.';
        return `<tr class="${k === R.gp ? 'sel' : ''}"><td class="lft" rowspan="2">${esc(q.name)}</td><td class="lft">Positive (midbay), bottom bars${many && k === R.gp ? ' <b>governs</b>' : ''}</td><td>${fmt(I.MDC_pos, 3)}</td><td>${fmt(I.MDW_pos, 3)}</td><td>${fmt(I.MLL_pos, 3)}</td><td><b>${fmt(I.Mu_pos, 3)}</b></td><td>${fmt(q.pos.phiMn, 2)}</td><td class="${cls(q.pos.dc)}">${fmt(q.pos.dc, 3)}</td><td>${see(b + 'Mup')}</td></tr>
          <tr class="${k === R.gn ? 'sel' : ''}"><td class="lft">Negative (design section), top bars${many && k === R.gn ? ' <b>governs</b>' : ''}</td><td>${fmt(I.MDC_neg, 3)}</td><td>${fmt(I.MDW_neg, 3)}</td><td>${fmt(I.MLL_neg, 3)}</td><td><b>${fmt(I.Mu_neg, 3)}</b></td><td>${fmt(q.neg.phiMn, 2)}</td><td class="${cls(q.neg.dc)}">${fmt(q.neg.dc, 3)}</td><td>${see(b + 'Mun')}</td></tr>`; }).join('')}
      </tbody></table></div><p class="note">kip-ft per foot of deck. Dead load by the continuous-slab coefficients wS²/11 (positive) and wS²/10 (negative), S centre to centre of the girders; w<sub>DC</sub> = ${fmt(In.wDC, 4)} ksf ${see('dk.b1.wDC')}, w<sub>DW</sub> = ${fmt(In.wDW, 4)} ksf ${see('dk.b1.wDW')}. Live load from Table A4-1, interpolated on S and on the design-section distance; the tabulated values include the multiple presence factors and the 33 % dynamic load allowance.
      Equivalent strip widths of Table 4.6.2.1.3-1 (reference only): ${R.bays.map(q => `S = ${fmt(q.S, 2)} ft: +M ${fmt(q.I.SWpos, 1)} in, −M ${fmt(q.I.SWneg, 1)} in`).join('; ')}.</p></div></section>`;
    const capRow = (nm, c, id) => `<tr><td class="lft">${nm}</td><td>${fmt(c.As, 3)}</td><td>${fmt(c.dEff, 2)}</td><td>${fmt(c.a, 3)}</td><td>${fmt(c.c, 3)}</td><td>${fmt(c.et, 4)}</td><td>${fmt(c.phi, 3)}</td><td>${fmt(c.Mn, 2)}</td><td><b>${fmt(c.phiMn, 2)}</b></td><td>${see(id)}</td></tr>`;
    h += `<section class="sec"><div class="secHead">Flexural resistance per foot (5.6.3.2)</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Bars</th><th>A<sub>s</sub><br>in²/ft</th><th>d<br>in</th><th>a<br>in</th><th>c<br>in</th><th>ε<sub>t</sub></th><th>φ</th><th>M<sub>n</sub><br>kip-ft/ft</th><th>φM<sub>n</sub><br>kip-ft/ft</th><th></th></tr></thead><tbody>
      ${capRow(`Bottom: ${esc(DK().barName(+D.barBot))} at ${fmt(+D.sBot, 2)} in (positive moment)`, R.bays[R.gp].pos, 'dk.pos.As')}${capRow(`Top: ${esc(DK().barName(+D.barTop))} at ${fmt(+D.sTop, 2)} in (negative moment, overhangs)`, R.bays[R.gn].neg, 'dk.neg.As')}
      </tbody></table></div><p class="note">Rectangular section, b = 12 in; d to the bar centroid (equivalent bar diameter √(4A<sub>b</sub>/π)); φ from the net tensile strain ε<sub>t</sub> (5.5.4.2: 0.75 compression-controlled to 0.90 tension-controlled).</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Overhangs (gravity loads)</div><div class="secBody"><div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Side</th><th>o<sub>h</sub><br>ft</th><th>X<br>ft</th><th>Strip<br>in</th><th>M<sub>DC</sub></th><th>M<sub>DW</sub></th><th>M<sub>LL+IM</sub><br>wheel</th><th>M<sub>PL</sub></th><th>M<sub>u</sub></th><th>φM<sub>n</sub></th><th>Ratio</th><th></th></tr></thead><tbody>
      ${['L', 'R'].map(sd => { const q = R.oh[sd], O = q.O; return `<tr class="${sd === R.go ? 'sel' : ''}"><td class="lft">${esc(q.name)}</td><td>${fmt(O.oh, 2)}</td><td>${fmt(O.Xoh, 3)}</td><td>${fmt(O.SWoh, 1)}</td><td>${fmt(O.MohDC, 3)}</td><td>${fmt(O.MohDW, 3)}</td><td>${fmt(O.MohLL, 3)}</td><td>${O.PL.length ? fmt(O.MohPL, 3) : '—'}</td><td><b>${fmt(O.Mu_oh, 3)}</b></td><td>${fmt(q.cap.phiMn, 2)}</td><td class="${cls(q.cap.dc)}">${fmt(q.cap.dc, 3)}</td><td>${see('dk.oh' + sd + '.Muoh')}</td></tr>`; }).join('')}
      </tbody></table></div><p class="note">kip-ft per foot, about the exterior girder ℄. Dead loads on the overhang as the Loads &amp; LLDF module holds them (slab at the total deck thickness; barrier, curb, railing, sidewalk and added line loads at their positions; wearing surface inside the traffic face). One 16 kip wheel 1 ft inside the traffic face on the strip 45 + 10X in, IM 1.33, multiple presence 1.20; a pedestrian load on a sidewalk over the overhang is taken with the wheel.
      <b>Gravity loads only:</b> the Extreme Event II vehicular-collision cases (A13.4) are not checked.</p></div></section>`;
    h += `<section class="sec"><div class="secHead">Distribution reinforcement (9.7.3.2)</div><div class="secBody">
      ${ro('Bottom bars parallel to the girders', `${fmt(R.dist.pct, 1)} % of the positive-moment steel = ${fmt(R.dist.As, 3)} in²/ft`, `${see('dk.dist')} min(220/√S<sub>eff</sub>, 67 %)`)}
      ${R.long && R.long.bot ? ro('DK4 Bottom longitudinal bars provided', `${esc(DK().barName(R.long.bot.A))} at ${fmt(R.long.bot.s, 2)} in: A<sub>s,prov</sub> = ${fmt(R.long.bot.As, 3)} in²/ft, ratio <span class="${cls(R.long.bot.r)}" style="padding:0 4px">${fmt(R.long.bot.r, 3)}</span> ${R.long.bot.ok ? 'OK' : 'NG'}`, `${see('dk.distProv')} 12 A<sub>b</sub>/s; ${see('dk.distR')} A<sub>s,d</sub> ≤ A<sub>s,prov</sub>`)
        : ro('DK4 Bottom longitudinal bars provided', 'not checked: bottom longitudinal bars not entered', lnk('Cross-section tab, Deck design', 'xsec'))}
      ${ro('Effective span length (9.7.2.3)', R.dist.E && R.dist.E.ok ? `S<sub>eff</sub> = ${fmt(R.dist.Seff, 3)} ft` : 'not available: 67 % used', R.dist.E && R.dist.E.ok ? `${see('dk.distSe')} S − b<sub>f</sub>/12 + (b<sub>f</sub> − t<sub>w</sub>)/24, S = ${fmt(R.dist.S, 2)} ft, b<sub>f</sub> = ${fmt(R.dist.bf, 2)} in, t<sub>w</sub> = ${fmt(R.dist.tw, 4)} in (${esc(R.dist.at)})` : '')}
      <p class="note">The distance between the flange tips plus one flange overhang (flange tip to the face of the web, fillets disregarded), with the smallest girder spacing and the girder segment of the largest b<sub>f</sub> + t<sub>w</sub>: the shortest effective span, the largest percentage.</p></div></section>`;
    h += tsSec(R) + crSec(R);
    h += `<section class="sec" id="dk-steps"><div class="secHead">Worked steps: deck</div><div class="secBody"><p class="note">AASHTO LRFD 10th Ed. (2024). Inputs: ${lnk('Cross-section tab', 'xsec')} (Deck design).</p>${window.SharedSteps.groupsHTML(groups('x', R.steps), { open: OPEN, item: (ST => s => stepLi(s, ST))(marks(R)) })}</div></section>`;
    return h;
  }

  /* tsSec(R) / crSec(R) (DKTS / DKCR, 2026-11-24): the DK5 and DK6 tables; every value links to its worked step */
  function tsSec(R) {
    const T = R.ts, D = R.D; if (!T) return '';
    const rows = T.sets.map(q => q.on ? `<tr data-dkts="${q.k}"><td class="lft">${esc(q.name)}</td><td class="lft">${esc(DK().barName(q.A))} at ${fmt(q.s, 2)} in</td><td>${fmt(q.As, 3)} ${see('dk.ts.' + q.k + '.As')}</td><td class="${cls(q.rA)}">${fmt(q.rA, 3)} ${see('dk.ts.' + q.k + '.rA')}</td><td class="${cls(q.rs)}">${fmt(q.rs, 3)} ${see('dk.ts.' + q.k + '.rs')}</td><td class="${q.ok ? 'dk-ok' : 'dk-ng'}">${q.ok ? 'OK' : 'NG'}</td></tr>`
      : `<tr data-dkts="${q.k}-none"><td class="lft">${esc(q.name)}</td><td class="lft" colspan="5"><i>Not checked: bars not entered</i> (<a href="#" data-goin="xsec">Cross-section tab, Deck design</a>)</td></tr>`).join('');
    return `<section class="sec" id="dk-ts"><div class="secHead">DK5 Shrinkage and temperature reinforcement (5.10.6)</div><div class="secBody">
      <p>Required on each face and in each direction: A<sub>s,T&amp;S</sub> = ${fmt(T.A, 3)} in²/ft ${see('dk.ts.A')} (1.30bh / (2(b + h)f<sub>y</sub>) = ${fmt(T.eq, 4)} ${see('dk.ts.eq')}, within 0.11 to 0.60; h = ${fmt(T.h, 2)} in ${see('dk.ts.h')}, b = ${fmt(T.b, 1)} in ${see('dk.ts.b')}, f<sub>y</sub> = ${fmt(T.fyU, 1)} ksi ${see('dk.ts.fy')}); spacing not over s<sub>max</sub> = ${fmt(T.smax, 2)} in ${see('dk.ts.smax')}.</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Bars</th><th class="lft">Size and spacing</th><th>A<sub>s</sub><br>in²/ft</th><th>A<sub>s,T&amp;S</sub>/A<sub>s</sub></th><th>s/s<sub>max</sub></th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Engineer decision 2026-11-24 (confirmed): s<sub>max</sub> = the lesser of 3.0h and 18.0 in (the 10th Ed. wording can also be read as the larger). The deck edges are the faces the article exempts; the top and bottom faces are checked.</p></div></section>`;
  }
  function crSec(R) {
    const C = R.crack; if (!C) return '';
    const rows = C.cases.map(q => { const p = 'dk.' + q.key + '.';
      return q.app ? `<tr data-dkcr="${q.key}"><td class="lft">${esc(q.name)}</td><td>${fmt(q.Ms, 3)} ${see(p + 'Ms')}</td><td>${fmt(q.fss, 2)} ${see(p + 'fss')}</td><td>${fmt(q.dc, 3)} ${see(p + 'dc')}</td><td>${fmt(q.bs, 3)} ${see(p + 'bs')}</td><td>${fmt(q.smax, 2)} ${see(p + 'smax')}</td><td>${fmt(q.s, 2)}</td><td class="${cls(q.r)}">${isFinite(q.r) ? fmt(q.r, 3) : '∞'}</td><td class="${q.ok ? 'dk-ok' : 'dk-ng'}">${q.ok ? 'OK' : 'NG'}</td></tr>`
        : `<tr data-dkcr="${q.key}"><td class="lft">${esc(q.name)}</td><td>${fmt(q.Ms, 3)} ${see(p + 'Ms')}</td><td class="lft" colspan="5"><i>Not required: f<sub>t</sub> = ${fmt(q.ft, 3)} ≤ 0.8f<sub>r</sub> = ${fmt(0.8 * C.fr, 3)} ksi</i> ${see(p + 'app')}</td><td>—</td><td class="dk-ok">OK</td></tr>`; }).join('');
    return `<section class="sec" id="dk-cr"><div class="secHead">DK6 Crack control of the transverse bars (5.6.7, Service I)</div><div class="secBody">
      <p>s ≤ 700γ<sub>e</sub>/(β<sub>s</sub>f<sub>ss</sub>) − 2d<sub>c</sub> and f<sub>ss</sub> ≤ 0.60f<sub>y</sub> = ${fmt(C.lim, 2)} ksi ${see('dk.cr.lim')}; Class ${C.cls} exposure, γ<sub>e</sub> = ${fmt(C.ge, 2)} ${see('dk.cr.ge')} (<a href="#" data-goin="xsec">Cross-section tab, Deck design</a>); n = ${fmt(C.n, 3)} ${see('dk.cr.n')}; f<sub>r</sub> = ${fmt(C.fr, 4)} ksi ${see('dk.cr.fr')}.</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Section, bars</th><th>M<sub>s</sub><br>kip-ft/ft</th><th>f<sub>ss</sub><br>ksi</th><th>d<sub>c</sub><br>in</th><th>β<sub>s</sub></th><th>s<sub>max</sub><br>in</th><th>s<br>in</th><th>Ratio</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Service I: M<sub>s</sub> = M<sub>DC</sub> + M<sub>DW</sub> + M<sub>LL+IM</sub> (the unfactored moments of DK1 to DK3, η = 1.0${C.mLL !== 1 ? `, the owner's m = ${fmt(C.mLL, 2)} on the live load (Decision pending engineer review)` : ''}). f<sub>ss</sub> from the cracked transformed 12 in strip with d and A<sub>s</sub> of DK1 to DK3. Ratio = the larger of s/s<sub>max</sub> and f<sub>ss</sub>/0.60f<sub>y</sub>. d<sub>c</sub> and h within the structural slab t<sub>s</sub>, as the Strength I depth d: top bars d<sub>c</sub> = c<sub>t</sub> + d<sub>b</sub>/2 and h = t<sub>s</sub> (Engineer decision 2026-11-24: exclude the sacrificial wearing surface); bottom bars d<sub>c</sub> = c<sub>b</sub> + d<sub>b</sub>/2 and h = t<sub>s</sub> (Decision pending engineer review, conservative); the commentary's d<sub>c</sub> limit for large covers is not used.</p></div></section>`;
  }
  /* summaryCard(deck, counted): the Summary tab's card of the bridge's deck slab checks (report/summary.js deckOf: the engine's values) */
  function summaryCard(d, counted) {
    css();
    const row = q => `<tr><td class="lft">${esc(q.check)}</td><td class="lft">${esc(q.loc)}</td>${dcCells(q)}<td class="${q.r != null ? cls(q.r) : 'dk-hi'}"><a href="#" data-sumgo="0|deck">${q.r != null && isFinite(q.r) ? fmt(q.r, 3) : '—'}</a></td><td class="${q.st === 'pass' ? 'dk-ok' : q.st === 'fail' ? 'dk-ng' : 'dk-hi'}">${{ pass: 'PASS', fail: 'FAIL', review: 'REVIEW' }[q.st] || esc(q.st)}</td></tr>`;
    return `<section class="sec" id="sum-deck"><div class="secHead">Deck slab (the bridge's deck)</div><div class="secBody">
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th class="lft">Governing location</th><th>M<sub>u</sub><br>kip-ft/ft</th><th>φM<sub>n</sub><br>kip-ft/ft</th><th>D/C</th><th>Status</th></tr></thead><tbody>${d.cells.map(row).join('')}</tbody></table></div>
      <p class="note">The transverse deck design (<a href="#" data-sumgo="0|deck">Deck tab</a>), switched on for this project on the Cross-section tab. One count per check in the verdict above${counted ? '' : ' once a girder module has run'}; it is the bridge's deck, not a column of the girder table. DK4 to DK6 show the demand and the limit of the check in place of M<sub>u</sub> and φM<sub>n</sub>. Not checked there: the Extreme Event II overhang cases (A13.4), minimum reinforcement.</p></div></section>`;
  }
  const build = ctx => DK().calc(ctx.P);
  function render(host, ctx) {
    css();
    const P = ctx.P, R = build(ctx), save = r => { if (ctx.changed) ctx.changed(r); };
    let h;
    if (!R.on) h = `<section class="sec" id="dk-off"><div class="secHead">Deck design (strip method)</div><div class="secBody"><p class="dk-off">Deck design is <b>off</b> for this project: nothing is calculated and no result, Summary verdict or report section is changed by it.</p>
      <p class="note">When on: the transverse design of the slab per foot of deck, as the Prestressed Bridge Design app: positive and negative moment of the interior bays (AASHTO LRFD 10th Ed. Table A4-1, design section 4.6.2.1.6), the overhangs under gravity loads, the distribution reinforcement (9.7.3.2), shrinkage and temperature reinforcement (5.10.6) and crack control (5.6.7), from the cross-section, slab and materials the project already holds.</p>
      <p><button type="button" class="primary" id="dk_turnOn">Turn deck design on</button> <span class="note">or on the <a href="#" data-goin="xsec">Cross-section tab</a>, card "Deck design (transverse)".</span></p></div></section>`;
    else if (R.err) h = `<div class="alert err">${esc(R.err)}</div><p class="note">Deck design inputs: <a href="#" data-goin="xsec">Cross-section tab</a>, card "Deck design (transverse)".</p>`;
    else h = results(R, P);
    host.innerHTML = h;
    window.SharedSteps.wire(host, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    const fg = host.querySelector('#dk-fig'); if (fg && R.on && !R.err) fg.innerHTML = figure(R, Math.max(360, (host.clientWidth || 800) - 40), P);   // DKFE: P for the deck-edge elements
    const b = host.querySelector('#dk_turnOn'); if (b) b.addEventListener('click', () => { if (!P.deckDesign || typeof P.deckDesign !== 'object') P.deckDesign = { ...DK().DEF }; P.deckDesign.on = true; save(true); });
    host.querySelectorAll('[data-gotab]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const t = document.querySelector(`#tabBar [data-otab="${el.dataset.gotab}"]`); if (t) t.click(); }));
    host.querySelectorAll('[data-goin]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const t = document.querySelector(`#inTabs [data-itab="${el.dataset.goin}"]`); if (t) t.click();
      const c = el.dataset.goin === 'xsec' ? document.getElementById('dkIn') : null; if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center' }); }));
  }

  window.SBDDeckUI = { inputs, onChange, render, build, groups, figure, stepLi, marks, summaryCard };
})();
