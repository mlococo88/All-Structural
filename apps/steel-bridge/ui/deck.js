/* apps/steel-bridge/ui/deck.js — the "Deck" output tab and the Deck design input card (window.SBDDeckUI). Classic script; display and
   input only. Created 2026-11-23 (DK; engineer request 2026-11-23: the deck design of the Prestressed Bridge Design app in this app).
   Every number is engine/deck.js calc(P) (shared/deck.js, the same method as the Prestressed app's deck module); nothing is calculated here.

   The module is optional and OFF until switched on (P.deckDesign.on; a project saved before 2026-11-23 has no P.deckDesign and reads as
   off). While it is off the tab says so and links to the switch; P.deckDesign is written only when the user changes one of its inputs.
   Inputs (Cross-section input tab, card "Deck design (transverse)"): the switch, the top and bottom transverse bars (size, spacing, clear
   cover) and the negative-moment design section (automatic b_f/4, or entered). Everything else is read from the project and shown with a
   link to where it is entered: girder spacings, overhangs, deck edges, sidewalks (Cross-section tab), slab thicknesses (Cross-section tab,
   Deck), f'c, w_c, F_yr (Materials tab), wearing surface and overlays (Loads tab), owner eta and m (Project tab).

   inputs(P) -> HTML of the input card; onChange(el, P) -> true when it changed P.deckDesign;
   render(host, ctx), ctx = { P, changed(redrawInputs) }; build(ctx) -> engine/deck.js calc(P) (the Report);
   groups(kind, list) -> SharedSteps.group of the steps (the Report's worked steps); figure(R, W) -> the deck section as an SVG string. */
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
    let h = `<div class="fRow"><label for="dk_on">Deck design (strip method)</label><select id="dk_on" data-dk="on">${opt('false', 'Off', String(on))}${opt('true', 'On', String(on))}</select></div>`;
    if (on) h += `${bar('barTop', 'Top transverse bars')}${num('sTop', 'Top bar spacing', 'in')}${num('coverT', 'Top clear cover', 'in')}
      ${bar('barBot', 'Bottom transverse bars')}${num('sBot', 'Bottom bar spacing', 'in')}${num('coverB', 'Bottom clear cover', 'in')}
      <div class="fRow"><label for="dk_xnegAuto">Negative-moment design section</label><select id="dk_xnegAuto" data-dk="xnegAuto">${opt('true', 'Automatic: b_f/4 of the narrowest top flange (4.6.2.1.6)', String(D.xnegAuto !== false))}${opt('false', 'Entered', String(D.xnegAuto !== false))}</select></div>
      ${D.xnegAuto === false ? num('xneg', 'Design section from the girder ℄', 'in (0 to 24)') : ''}`;
    h += `<p class="note">Transverse design of the slab: interior bays (AASHTO LRFD 10th Ed. Table A4-1) and the overhangs (gravity loads), as the Prestressed Bridge Design app. Optional: off until switched on${on ? '' : '; while it is off nothing is calculated and no result changes'}. Results: <a href="#" data-gotab="dk">Deck tab</a>.
      It uses what the project already holds: the girder spacings, overhangs, deck edges and sidewalks (this tab), the slab thicknesses (Deck card above), f′<sub>c</sub>, w<sub>c</sub> and F<sub>yr</sub> (<a href="#" data-itgo="mat">Materials tab</a>), the wearing surface (<a href="#" data-itgo="loads">Loads tab</a>) and the owner's η and m (<a href="#" data-itgo="proj">Project tab</a>).${on ? ' The covers here are the clear covers of the transverse bars; the rebar depths of the Deck card above are those of the longitudinal layers (the girder\'s composite section) and are not used here.' : ''}</p>`;
    return `<section class="sec" id="dkIn"><div class="secHead">Deck design (transverse)</div><div class="secBody">${h}</div></section>`;
  }
  /* onChange(el, P): an input of the card (data-dk). P.deckDesign is created on the first change (the defaults, then the change). */
  function onChange(el, P) {
    const k = el && el.dataset ? el.dataset.dk : null; if (!k) return false;
    if (!P.deckDesign || typeof P.deckDesign !== 'object') P.deckDesign = { ...DK().DEF };
    const v = el.value;
    P.deckDesign[k] = (k === 'on' || k === 'xnegAuto') ? v === 'true' : (v === '' ? NaN : Number(v));
    return true;
  }

  /* ---------- worked steps ---------- */
  const stepLi = s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${sb(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${sb(s.note)}</div>` : ''}</li>`;
  const groups = (kind, list) => window.SharedSteps.group(list, DK().topics(DK().metaOf(list)), { strip: /^dk\./ });
  const see = id => `<a href="#st-${esc(id)}" title="Worked step">§</a>`;

  /* ---------- the deck section over the left exterior girder and the first interior girder (true scale across; display only) ---------- */
  function figure(R, W) {
    const q = R.oh.L, O = q.O, In = R.in, D = R.D, S = R.bays[0].S, ts = In.ts, oh = O.oh * 12, Sp = S * 12, x1 = oh + Sp + Math.min(Sp * 0.4, 30), bf = In.bf || 16;
    const w = Math.max(360, Math.min(W || 760, 900)), m = { l: 14, r: 44, t: 58, b: 46 }, k = (w - m.l - m.r) / x1, H = Math.round(m.t + ts * k + 18 * k + m.b);
    const X = x => m.l + x * k, Y = y => m.t + (ts - y) * k;   // y up from the bottom of the slab
    const f1 = v => fmt(v, 2), gx = [oh, oh + Sp], face = O.face * 12, xw = face + 12, dbT = Math.sqrt(4 * +D.barTop / Math.PI), dbB = Math.sqrt(4 * +D.barBot / Math.PI);
    const yT = ts - +D.coverT - dbT / 2, yB = +D.coverB + dbB / 2;
    const dimH = (a, b, y, t) => `<line x1="${X(a)}" y1="${y}" x2="${X(b)}" y2="${y}" stroke="#475569" stroke-width="1"/><line x1="${X(a)}" y1="${y - 4}" x2="${X(a)}" y2="${y + 4}" stroke="#475569"/><line x1="${X(b)}" y1="${y - 4}" x2="${X(b)}" y2="${y + 4}" stroke="#475569"/><text x="${(X(a) + X(b)) / 2}" y="${y - 4}" text-anchor="middle" font-size="11" fill="#1e293b">${t}</text>`;
    let s = `<svg xmlns="http://www.w3.org/2000/svg" class="dk-fig" viewBox="0 0 ${w} ${H}" width="${w}" height="${H}" role="img" aria-label="Deck section over the left exterior girder: overhang, barrier, design wheel, design sections and bars"><rect width="${w}" height="${H}" fill="#fff"/>`;
    s += `<rect x="${X(0)}" y="${Y(ts)}" width="${x1 * k}" height="${ts * k}" fill="#e2e8f0" stroke="#334155"/>`;
    gx.forEach(x => { s += `<rect x="${X(x - bf / 2)}" y="${Y(0)}" width="${bf * k}" height="${Math.max(3, 1.2 * k)}" fill="#64748b"/><rect x="${X(x) - Math.max(1, 0.3 * k)}" y="${Y(0)}" width="${Math.max(2, 0.6 * k)}" height="${14 * k}" fill="#64748b"/>
      <line x1="${X(x)}" y1="${Y(ts) - 30}" x2="${X(x)}" y2="${Y(0) + 16 * k}" stroke="#0f172a" stroke-dasharray="8 3 2 3" stroke-width="0.8"/>`; });
    s += `<text x="${X(gx[0]) + 4}" y="${Y(0) + 15 * k + 12}" font-size="10.5" fill="#334155">exterior girder ℄</text>`;
    if (face > 0) s += `<polygon points="${X(0)},${Y(ts)} ${X(face)},${Y(ts)} ${X(face * 0.6)},${Y(ts) - 26} ${X(0)},${Y(ts) - 26}" fill="#cbd5e1" stroke="#334155"/>`;
    if (O.Xoh > 0) s += `<line x1="${X(xw)}" y1="${Y(ts) - 34}" x2="${X(xw)}" y2="${Y(ts) - 2}" stroke="#1E3A5F" stroke-width="2"/><polygon points="${X(xw) - 4},${Y(ts) - 9} ${X(xw) + 4},${Y(ts) - 9} ${X(xw)},${Y(ts) - 1}" fill="#1E3A5F"/><text x="${X(xw) + 5}" y="${Y(ts) - 28}" font-size="10.5" fill="#1E3A5F">16 kip wheel, X = ${f1(O.Xoh)} ft</text>`;
    [gx[0] + In.xneg, gx[1] - In.xneg].forEach(x => { s += `<line x1="${X(x)}" y1="${Y(ts) - 4}" x2="${X(x)}" y2="${Y(0) + 4}" stroke="#2563EB" stroke-width="1.6"/>`; });
    s += `<text x="${X(gx[0] + In.xneg) + 4}" y="${Y(0) + 15}" font-size="10.5" fill="#2563EB">design section, x = ${f1(In.xneg)} in</text>`;
    for (let x = 3; x < x1 - 1; x += Math.max(+D.sTop || 6, 3)) s += `<circle cx="${X(x)}" cy="${Y(yT)}" r="${Math.max(1.5, dbT / 2 * k)}" fill="#B45309"/>`;
    for (let x = Math.max(face, 3); x < x1 - 1; x += Math.max(+D.sBot || 6, 3)) s += `<circle cx="${X(x)}" cy="${Y(yB)}" r="${Math.max(1.5, dbB / 2 * k)}" fill="#0f766e"/>`;
    s += dimH(0, oh, 16, `o_h = ${f1(O.oh)} ft`) + dimH(oh, oh + Sp, 16, `S = ${f1(S)} ft`);
    s += `<text x="${X(x1) + 4}" y="${Y(ts / 2) + 4}" font-size="11" fill="#1e293b">t_s ${fmt(ts, 1)}</text>`;
    s += `<text x="${m.l}" y="${H - 8}" font-size="10.5" fill="#475569">Top bars ${esc(DK().barName(+D.barTop))} at ${f1(+D.sTop)} in (cover ${f1(+D.coverT)} in); bottom bars ${esc(DK().barName(+D.barBot))} at ${f1(+D.sBot)} in (cover ${f1(+D.coverB)} in). Girders schematic.</text>`;
    return s + '</svg>';
  }

  function results(R, P) {
    const In = R.in, D = R.D, lnk = (t, tab) => `<a href="#" data-goin="${tab}">${t}</a>`, many = R.bays.length > 1;
    const st = c => `<td class="${cls(c.r)}">${isFinite(c.r) ? fmt(c.r, 3) : '∞'}</td><td class="${c.ok ? 'dk-ok' : 'dk-ng'}">${c.ok ? 'OK' : 'NG'}</td>`;
    const nF = R.checks.filter(c => !c.ok).length, gov = R.checks.reduce((a, c) => (c.r > a.r ? c : a));
    let h = `<section class="sec" id="dk-gov"><div class="secHead">Deck design: checks</div><div class="secBody">
      <p style="font-size:11pt;margin:4px 0 6px"><b>Governing:</b> ${esc(gov.id)} ${esc(gov.title)}, ${esc(gov.loc)}: ratio <span class="${cls(gov.r)}" style="padding:0 6px">${fmt(gov.r, 3)}</span> ${nF ? `<span class="dk-ng" style="padding:0 4px">${nF} check${nF > 1 ? 's' : ''} NG</span>` : 'all checks OK'}</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th class="lft">Governing location</th><th>M<sub>u</sub><br>kip-ft/ft</th><th>φM<sub>n</sub><br>kip-ft/ft</th><th>Ratio</th><th>Status</th><th></th><th class="lft">Reference</th></tr></thead><tbody>
      ${R.checks.map(c => `<tr data-dkck="${c.id}"><td class="lft">${esc(c.id)} ${esc(c.title)}</td><td class="lft">${esc(c.loc)}</td><td>${fmt(c.Mu, 2)}</td><td>${fmt(c.phiMn, 2)}</td>${st(c)}<td>${see(c.step)}</td><td class="lft" style="font-size:8.5pt">${esc(c.ref)}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="note">Strip method per foot of deck, AASHTO LRFD 10th Ed. (2024): the same method as the Prestressed Bridge Design app's deck module. Strength I${In.eta !== 1 || In.mLL !== 1 ? ` with the owner's η = ${fmt(In.eta, 3)}${In.mLL !== 1 ? ` and m = ${fmt(In.mLL, 2)}` : ''} (${lnk('Project tab', 'proj')})` : ''}.
      <b>Not checked here:</b> the Extreme Event II vehicular-collision cases of the overhang (A13.4; they need a barrier-specific analysis), crack control (5.6.7), minimum reinforcement (5.6.3.3), temperature and shrinkage reinforcement (5.10.6), bar development.</p>
      ${R.warn.map(w => `<div class="alert">${esc(w)}</div>`).join('')}</div></section>`;
    h += `<section class="sec"><div class="secHead">Deck section</div><div class="secBody"><div id="dk-fig"></div><p class="note">The left overhang and the first bay, true scale across: the barrier or curb to the traffic face, the design wheel 1 ft inside it, the negative-moment design sections (blue), the top bars (brown) and bottom bars (green) at their covers and spacings. Display only.</p></div></section>`;
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
      ${ro('Clear cover, top / bottom', `${fmt(+D.coverT, 2)} / ${fmt(+D.coverB, 2)} in`, lnk('Cross-section tab, Deck design', 'xsec'))}</div></section>`;
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
      ${ro('Bottom bars parallel to the girders', `${fmt(R.dist.pct, 1)} % of the positive-moment steel = ${fmt(R.dist.As, 3)} in²/ft`, `${see('dk.dist')} min(220/√S, 67 %), S = ${fmt(R.dist.S, 2)} ft`)}</div></section>`;
    h += `<section class="sec" id="dk-steps"><div class="secHead">Worked steps: deck</div><div class="secBody"><p class="note">AASHTO LRFD 10th Ed. (2024). Inputs: ${lnk('Cross-section tab', 'xsec')} (Deck design).</p>${window.SharedSteps.groupsHTML(groups('x', R.steps), { open: OPEN, item: stepLi })}</div></section>`;
    return h;
  }

  /* summaryCard(deck, counted): the Summary tab's card of the bridge's deck slab checks (report/summary.js deckOf: the engine's values) */
  function summaryCard(d, counted) {
    css();
    const row = q => `<tr><td class="lft">${esc(q.check)}</td><td class="lft">${esc(q.loc)}</td><td>${q.Mu != null ? fmt(q.Mu, 2) : '—'}</td><td>${q.phiMn != null ? fmt(q.phiMn, 2) : '—'}</td><td class="${q.r != null ? cls(q.r) : 'dk-hi'}"><a href="#" data-sumgo="0|deck">${q.r != null && isFinite(q.r) ? fmt(q.r, 3) : '—'}</a></td><td class="${q.st === 'pass' ? 'dk-ok' : q.st === 'fail' ? 'dk-ng' : 'dk-hi'}">${{ pass: 'PASS', fail: 'FAIL', review: 'REVIEW' }[q.st] || esc(q.st)}</td></tr>`;
    return `<section class="sec" id="sum-deck"><div class="secHead">Deck slab (the bridge's deck)</div><div class="secBody">
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th class="lft">Governing location</th><th>M<sub>u</sub><br>kip-ft/ft</th><th>φM<sub>n</sub><br>kip-ft/ft</th><th>D/C</th><th>Status</th></tr></thead><tbody>${d.cells.map(row).join('')}</tbody></table></div>
      <p class="note">The transverse deck design (<a href="#" data-sumgo="0|deck">Deck tab</a>), switched on for this project on the Cross-section tab. One count per check in the verdict above${counted ? '' : ' once a girder module has run'}; it is the bridge's deck, not a column of the girder table. Not checked there: the Extreme Event II overhang cases (A13.4), crack control, minimum and temperature reinforcement.</p></div></section>`;
  }
  const build = ctx => DK().calc(ctx.P);
  function render(host, ctx) {
    css();
    const P = ctx.P, R = build(ctx), save = r => { if (ctx.changed) ctx.changed(r); };
    let h;
    if (!R.on) h = `<section class="sec" id="dk-off"><div class="secHead">Deck design (strip method)</div><div class="secBody"><p class="dk-off">Deck design is <b>off</b> for this project: nothing is calculated and no result, Summary verdict or report section is changed by it.</p>
      <p class="note">When on: the transverse design of the slab per foot of deck, as the Prestressed Bridge Design app: positive and negative moment of the interior bays (AASHTO LRFD 10th Ed. Table A4-1, design section 4.6.2.1.6), the overhangs under gravity loads, and the distribution reinforcement (9.7.3.2), from the cross-section, slab and materials the project already holds.</p>
      <p><button type="button" class="primary" id="dk_turnOn">Turn deck design on</button> <span class="note">or on the <a href="#" data-goin="xsec">Cross-section tab</a>, card "Deck design (transverse)".</span></p></div></section>`;
    else if (R.err) h = `<div class="alert err">${esc(R.err)}</div><p class="note">Deck design inputs: <a href="#" data-goin="xsec">Cross-section tab</a>, card "Deck design (transverse)".</p>`;
    else h = results(R, P);
    host.innerHTML = h;
    window.SharedSteps.wire(host, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    const fg = host.querySelector('#dk-fig'); if (fg && R.on && !R.err) fg.innerHTML = figure(R, Math.max(360, (host.clientWidth || 800) - 40));
    const b = host.querySelector('#dk_turnOn'); if (b) b.addEventListener('click', () => { if (!P.deckDesign || typeof P.deckDesign !== 'object') P.deckDesign = { ...DK().DEF }; P.deckDesign.on = true; save(true); });
    host.querySelectorAll('[data-gotab]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const t = document.querySelector(`#tabBar [data-otab="${el.dataset.gotab}"]`); if (t) t.click(); }));
    host.querySelectorAll('[data-goin]').forEach(el => el.addEventListener('click', e => { e.preventDefault(); const t = document.querySelector(`#inTabs [data-itab="${el.dataset.goin}"]`); if (t) t.click();
      const c = el.dataset.goin === 'xsec' ? document.getElementById('dkIn') : null; if (c && c.scrollIntoView) c.scrollIntoView({ block: 'center' }); }));
  }

  window.SBDDeckUI = { inputs, onChange, render, build, groups, figure, stepLi, summaryCard };
})();
