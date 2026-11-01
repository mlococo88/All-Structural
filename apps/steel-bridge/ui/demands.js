/* apps/steel-bridge/ui/demands.js — the custom-demand table (window.SBDCustomDemands): one component every check module uses for its
   "Custom (entered)" demand source (added 2026-11-01, custom demands PR; engineer's request: "Each module should allow me to enter forces
   directly ... I may want to check flexural against manually entered moments"). Classic script; needs SharedUnits. No formulas here: the
   entered rows are put in the shape of a hand-off file (the payload every module already takes from this project's analysis or from a
   GirderDetail file) and the module runs its own engine functions on it, exactly as on its other sources.

   Saved with the project (CLAUDE.md §5; new optional fields, absent in older projects, which load and compute as before):
     P.custom    = { <module>: { <girder id>: { mode: 'unf' | 'fac', rows: [ { x (ft), <column key>: number, … } ], sup: [ { <column key>: number } ] (one per support) } } }
                   a blank cell is absent (0 in the check); mode 'fac' only where the module's engine takes factored demands (SPECS[m].fac)
     P.demandSrc = { <module>: 'analysis' | 'example' | 'project' | 'custom' }: the demand source chosen on the module's tab (a hand-off
                   file is not saved: its choice lasts for the page view); absent: the tab's default (this project's analysis when the
                   project is complete, else the example), as before.
   Module keys: flex (Flexure), shear (Shear & stiffeners), cn (Constructibility), fat (Fatigue & studs), rt (Rating: the flex and shear
   tables themselves, SPECS.rt.uses).

   Columns are the payload's own station fields (HANDOFF.md §4: M_DC1, M_LLpos, V_DC1, …), so a row means what a hand-off station means:
   unfactored per girder, moments kip-ft (sagging +), shears kip, LL+IM with impact and the distribution factor, the pedestrian load
   in its own column (PL: added to LL+IM by the engine, the owner multiplier m kept off it, as from the analysis).

   API: SPECS; get(P, mod, g) (the girder's entry, or an empty one); srcGet(P, mod) / srcSet(P, mod, v); card(P, mod, g) (the table, HTML);
   wire(host, P, mod, g, changed) (its events: cell edits, paste from Excel, add / remove rows, mode); rowsOf(P, mod, g) (sorted, checked:
   { rows, sup, mode, err }); payload(P, g, mod) ({ pl, rows, mode, xs } or { err }); keepAt(list, xs, tol) (the locations at the entered
   stations); step(mod, E, x) (the worked step "Demands: entered (Custom)"); report(P, mod, g) (the entered table for the report). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => (window.SharedUnits ? window.SharedUnits.fmt(x, d) : String(x));
  const KM = 'kip-ft', KP = 'kip';
  /* SPECS[mod] = { name, tab (the tab key), unf: { cols, note }, fac: { cols, combo, note } (optional), sup: { cols, note } (optional: per support) };
     a column: [key, label (HTML), unit] */
  const SPECS = {
    flex: { name: 'Flexure', tab: 'flex',
      unf: { cols: [['M_DC1', 'M<sub>DC1</sub>', KM], ['M_DC2', 'M<sub>DC2</sub>', KM], ['M_DW', 'M<sub>DW</sub>', KM], ['M_LLpos', 'M<sub>LL+IM</sub> +', KM], ['M_LLneg', 'M<sub>LL+IM</sub> −', KM],
        ['M_PLpos', 'M<sub>PL</sub> +', KM], ['M_PLneg', 'M<sub>PL</sub> −', KM], ['M_UT', 'M<sub>UT</sub>', KM], ['M_UF', 'M<sub>UF</sub>', KM], ['M_FATpos', 'M<sub>FAT</sub> +', KM], ['M_FATneg', 'M<sub>FAT</sub> −', KM]],
        note: 'Unfactored moments per girder: DC1 on the steel section (noncomposite), DC2 and DW on the long-term composite (3n) section, LL+IM (HL-93 with impact and the moment distribution factor; + the positive envelope ≥ 0, − the negative ≤ 0) and the pedestrian load PL on the short-term (n) section, utilities UT (with the DW factors) and UF (γ<sub>DC</sub> / 0), the Fatigue I truck M<sub>FAT</sub> (unfactored, with IM 15% and the single-lane factor). In negative flexure the composite parts are on the steel plus deck reinforcement. The tab applies the Strength I and Service II load factors, the owner\'s η and m (Loads &amp; LLDF tab) and γ<sub>Fatigue I</sub>.' },
      fac: { cols: [['Mu_s', 'Str. I M<sub>u</sub>, steel', KM], ['Mu_l', 'Str. I M<sub>u</sub>, long-term', KM], ['Mu_n', 'Str. I M<sub>u</sub>, short-term', KM],
        ['Ms_s', 'Svc. II M<sub>s</sub>, steel', KM], ['Ms_l', 'Svc. II M<sub>s</sub>, long-term', KM], ['Ms_n', 'Svc. II M<sub>s</sub>, short-term', KM], ['Mf_p', 'Fat. I γM<sub>FAT</sub> +', KM], ['Mf_n', 'Fat. I γM<sub>FAT</sub> −', KM]],
        combo: 'Strength I (Table 3.4.1-1: the case that governs at the station, with η and m applied), Service II and Fatigue I (γ applied)',
        note: 'Factored moments as given, each on the section that carries it: "steel" = the loads on the noncomposite steel section (γDC1 + γUT + γUF), "long-term" = on the 3n composite section (γDC2 + γDW), "short-term" = on the n composite section (γ(LL+IM) incl. pedestrian); in negative flexure the composite parts are on the steel plus deck reinforcement. No load factor, η or m is applied by the tab. The region (positive or negative flexure) is the sign of the total Strength I M<sub>u</sub>. The moment-reversal check (GS19) needs the opposite envelope and is not made.' } },
    shear: { name: 'Shear & stiffeners', tab: 'shear',
      unf: { cols: [['V_DC1', 'V<sub>DC1</sub>', KP], ['V_DC2', 'V<sub>DC2</sub>', KP], ['V_DW', 'V<sub>DW</sub>', KP], ['V_LLpos', 'V<sub>LL+IM</sub> +', KP], ['V_LLneg', 'V<sub>LL+IM</sub> −', KP],
        ['V_PLpos', 'V<sub>PL</sub> +', KP], ['V_PLneg', 'V<sub>PL</sub> −', KP], ['V_UT', 'V<sub>UT</sub>', KP], ['V_UF', 'V<sub>UF</sub>', KP], ['V_CL', 'V<sub>CL</sub>', KP], ['V_FATpos', 'V<sub>FAT</sub> +', KP], ['V_FATneg', 'V<sub>FAT</sub> −', KP]],
        note: 'Unfactored shears per girder in the hand-off sign (one sign convention for every column; the checks take magnitudes, with the minimum factors where a permanent load is of the opposite sign to the live load, Table 3.4.1-2): LL+IM with the shear distribution factor (+ and − envelopes), the pedestrian load PL, utilities UT and UF, the construction live load CL (deck placement, 6.10.3.3) and the Fatigue truck V<sub>FAT</sub> (special fatigue loading 6.10.5.3). At a support enter a row just left and just right (e.g. x ± 0.005 ft). A web panel, stiffener or connection plate is checked when its panel(s) contain an entered row; each station is checked with the shear of the stiffener panel it is in.' },
      sup: { cols: [['DC1', 'R<sub>DC1</sub>', KP], ['DC2', 'R<sub>DC2</sub>', KP], ['DW', 'R<sub>DW</sub>', KP], ['LL', 'R<sub>LL+IM</sub>', KP], ['PL', 'R<sub>PL</sub>', KP], ['UT', 'R<sub>UT</sub>', KP], ['UF', 'R<sub>UF</sub>', KP]],
        note: 'Unfactored support reactions of this girder (kip, up +) for the bearing stiffeners (6.10.11.2): LL+IM the reaction envelope with the shear distribution factor, PL the pedestrian load. A support with no value entered is not checked.' } },
    cn: { name: 'Constructibility', tab: 'cn',
      unf: { cols: [['M_DC1', 'M<sub>DC1</sub>', KM], ['M_DCc', 'M<sub>DCc</sub>', KM], ['M_CL', 'M<sub>CL</sub>', KM], ['V_DC1', 'V<sub>DC1</sub> left', KP], ['V_DC1R', 'V<sub>DC1</sub> right', KP], ['V_CL', 'V<sub>CL</sub> left', KP], ['V_CLR', 'V<sub>CL</sub> right', KP]],
        note: 'Unfactored deck-placement demands per girder on the noncomposite steel section: M<sub>DC1</sub> (steel and the whole wet deck), M<sub>DCc</sub> the envelope of the deck placement sequence (leave the column blank where there is no sequence: M<sub>DC1</sub> is used, as the tab does without one), M<sub>CL</sub> the construction live load; V<sub>DC1</sub>, V<sub>CL</sub> just left and just right of the station (they differ at a support; a blank "right" is the "left" value). The tab applies 1.25 and 1.50 (3.4.2.1). An exterior girder\'s overhang checks (OH1–OH5) take the span\'s entered row with the largest 1.25M<sub>DC1</sub> + 1.50M<sub>CL</sub>.' } }
,
    fat: { name: 'Fatigue & studs', tab: 'fat',
      unf: { cols: [['M_FATpos', 'M<sub>FAT</sub> +', KM], ['M_FATneg', 'M<sub>FAT</sub> −', KM], ['V_FATpos', 'V<sub>FAT</sub> +', KP], ['V_FATneg', 'V<sub>FAT</sub> −', KP],
        ['M_DC1', 'M<sub>DC1</sub>', KM], ['M_DC2', 'M<sub>DC2</sub>', KM], ['M_DW', 'M<sub>DW</sub>', KM], ['M_LLpos', 'M<sub>LL+IM</sub> +', KM], ['M_LLneg', 'M<sub>LL+IM</sub> −', KM], ['M_PLpos', 'M<sub>PL</sub> +', KM], ['M_PLneg', 'M<sub>PL</sub> −', KM],
        ['M_UT', 'M<sub>UT</sub>', KM], ['M_UF', 'M<sub>UF</sub>', KM], ['V_DC1', 'V<sub>DC1</sub>', KP], ['V_DC2', 'V<sub>DC2</sub>', KP], ['V_DW', 'V<sub>DW</sub>', KP]],
        note: 'Unfactored per girder. The fatigue truck M<sub>FAT</sub>, V<sub>FAT</sub> (with IM 15% and the single-lane distribution factor, + and − envelopes; the stress and shear ranges are + minus −) is what the fatigue checks take; γ (Fatigue I or II) is applied by the tab. The permanent moments and LL+IM (Strength I) place the flexure regions and the stud strength regions (to the point of the largest positive moment); the permanent moments and shears enter the details\' and the web\'s stresses as in the analysis path. Fatigue details between the first and last entered rows are checked (moments linear between rows); GS17 at each entered station. Studs: the pitch zones entered on the Fatigue &amp; studs input tab, else zones made from these rows by span tenths (a tenth with no row has V<sub>f</sub> = 0).' } },
    rt: { name: 'Rating', tab: 'rt', uses: ['flex', 'shear'],
      unf: { cols: [], note: 'The rating takes the unfactored moments entered on the Flexure tab and the shears entered on the Shear &amp; stiffeners tab (Custom); edit them here or there (one table each, saved once).' } }
  };
  const gidOf = (P, g) => { const G = (P.girders || [])[g] || (P.girders || [])[0] || {}; return String(G.id || 'G' + (g + 1)); };
  function get(P, mod, g) { const E = ((P.custom || {})[mod] || {})[gidOf(P, g)]; return { mode: E && E.mode === 'fac' && SPECS[mod].fac ? 'fac' : 'unf', rows: E && Array.isArray(E.rows) ? E.rows : [], sup: E && Array.isArray(E.sup) ? E.sup : [] }; }
  function entry(P, mod, g) { if (!P.custom) P.custom = {}; if (!P.custom[mod]) P.custom[mod] = {}; const k = gidOf(P, g); if (!P.custom[mod][k]) P.custom[mod][k] = { mode: 'unf', rows: [], sup: [] };
    const E = P.custom[mod][k]; if (!Array.isArray(E.rows)) E.rows = []; if (!Array.isArray(E.sup)) E.sup = []; return E; }
  const SRC = ['analysis', 'example', 'project', 'custom'];
  function srcGet(P, mod) { const v = ((P && P.demandSrc) || {})[mod]; return SRC.includes(v) ? v : null; }
  /* srcSet(P, mod, v): saves the choice ('file' and null clear it: the default, or the page view's file) */
  function srcSet(P, mod, v) { if (SRC.includes(v)) { P.demandSrc = { ...(P.demandSrc || {}), [mod]: v }; return; } if (P.demandSrc) { delete P.demandSrc[mod]; if (!Object.keys(P.demandSrc).length) delete P.demandSrc; } }
  const supsOf = P => { const s = [0]; ((P.spans || {}).lengths || []).forEach(L => s.push(+(s[s.length - 1] + +L).toFixed(6))); return s; };
  const supName = (k, n) => k === 0 ? 'Abut. 1' : k === n - 1 ? 'Abut. 2' : `Pier ${k}`;
  const colsOf = (mod, mode) => (mode === 'fac' && SPECS[mod].fac ? SPECS[mod].fac : SPECS[mod].unf).cols;
  const isN = v => typeof v === 'number' && isFinite(v);
  const plain = l => l.replace(/<sub>(.*?)<\/sub>/g, '_$1').replace(/<[^>]+>/g, '');   // a column label as text: M_DC1, M_LL+IM +

  /* rowsOf(P, mod, g): the entered rows sorted by x and checked (x within the girder, no two rows at one x, every cell a number);
     sup: one per support (the entries beyond the supports are dropped). { rows, sup, mode, err: [text] } */
  function rowsOf(P, mod, g) {
    const E = get(P, mod, g), cols = colsOf(mod, E.mode), sup = supsOf(P), L = sup[sup.length - 1], err = [];
    const rows = E.rows.filter(r => r && (isN(r.x) || cols.some(([k]) => isN(r[k])))).map(r => ({ ...r })).sort((a, b) => (+a.x) - (+b.x));
    rows.forEach((r, i) => { if (!isN(r.x)) err.push(`Row ${i + 1}: enter x.`); else if (r.x < -1e-9 || r.x > L + 1e-9) err.push(`Row at x = ${fmt(r.x, 3)} ft: outside the girder (0 to ${fmt(L, 2)} ft).`);
      if (i && isN(r.x) && isN(rows[i - 1].x) && Math.abs(r.x - rows[i - 1].x) < 1e-6) err.push(`Two rows at x = ${fmt(r.x, 3)} ft: enter one (at a support: one just left and one just right, x ± 0.005 ft).`);
      cols.forEach(([k]) => { if (r[k] != null && r[k] !== '' && !isN(r[k])) err.push(`Row at x = ${fmt(r.x, 2)} ft: ${k} is not a number.`); }); });
    if (!rows.length) err.push(`No rows entered: enter the ${SPECS[mod].name} demands in the Custom table (or paste them from Excel).`);
    const sp = SPECS[mod].sup ? sup.map((_, k) => { const s = E.sup[k] || {}; const o = {}; SPECS[mod].sup.cols.forEach(([c]) => { if (isN(s[c])) o[c] = s[c]; }); return Object.keys(o).length ? o : null; }) : [];
    return { rows, sup: sp, mode: E.mode, err };
  }
  const num = v => (isN(+v) ? +v : 0);
  /* payload(P, g, mod): the entered rows as a hand-off-shaped object (schema 'sbd2-custom'), with this project's supports, plates, deck,
     materials, skews and owner as this project's analysis puts them (ui/rating.js, ui/fatigue.js, ui/shear.js fromAnalysis): the module then
     takes the same path as on its analysis. Stations: the entered rows (a column left blank: 0); one row alone is taken as constant over
     0.001 ft beside it (two stations, so that the engines' interpolation is defined; the value at x is the row's). 'fac' rows go in
     as entered (the module reads them with SPECS[mod].fac). reactions (shear): one per support, null where nothing is entered.
     Returns { pl, rows, mode, xs (the entered stations) } or { err }. */
  function payload(P, g, mod) {
    const RW = rowsOf(P, mod, g); if (RW.err.length) return { err: 'Custom demands: ' + RW.err.join(' ') };
    const M = window.SBDModel, OW = window.SBDOwners, AN = window.SBDAnalysis, G = (P.girders || [])[g] || P.girders[0], m = P.materials, d = P.deck, sup = supsOf(P), Lt = sup[sup.length - 1];
    const cols = colsOf(mod, RW.mode).map(c => c[0]);
    const st = RW.rows.map(r => { const o = { x: +r.x }; cols.forEach(k => { o[k] = num(r[k]); }); return o; });
    if (st.length === 1) { const q = st[0], dx = q.x + 0.001 <= Lt ? 0.001 : -0.001; st.push({ ...q, x: q.x + dx }); st.sort((a, b) => a.x - b.x); }
    const zones = G.segments.map(s => ({ startX: s.x0, endX: s.x1, web: { depth: s.D, thickness: s.tw }, topFlange: { width: s.topB, thickness: s.topT }, botFlange: { width: s.botB, thickness: s.botT } }));
    const own = (P.ownerRules || {}).owner || 'AASHTO', lf = OW ? OW.loadFactors(own, (P.ownerRules || {}).eta, (P.xs || {}).nb) : null, Sa = AN && AN.settings ? AN.settings(P) : {};
    const h0 = typeof Sa.haunchInStiffness === 'boolean' ? !Sa.haunchInStiffness : !!(lf && lf.h0), sk = ((P.xs || {}).skews || []).slice();
    const pl = { _schema: 'sbd2-custom', pedestrianInLL: false, stations: st, member: { supports: sup.slice(), spans: sup.slice(1).map((x, k) => +(x - sup[k]).toFixed(6)) }, section: { zones },
      ownerRules: { owner: own, haunchInProperties: !h0 },
      girderDetail: { label: G.label || G.id, girder: g + 1, position: G.position, materials: { Fyf: M.GRADES[m.steel.top].Fy, Fyw: M.GRADES[m.steel.web].Fy, fc: m.concrete.fc, wc: m.concrete.wc, gradeFlange: m.steel.top, gradeWeb: m.steel.web },
        deck: { ts: d.ts, haunch: d.haunch, beff: G.beff, Ar: (d.rebar.top.A || 0) + (d.rebar.bot.A || 0) }, bracing: { Lb: (P.stiffeners && P.stiffeners.layout.frames.Lb) || 25 },
        skew: { bySupport: sk, max: Math.max(0, ...sk.map(Math.abs)) }, details: {} } };
    if (SPECS[mod].sup) pl.reactions = RW.sup.map(o => (o ? { DC1: num(o.DC1), DC2: num(o.DC2), DW: num(o.DW), UT: num(o.UT), UF: num(o.UF), LL: num(o.LL) + num(o.PL), PL: num(o.PL) } : null));
    return { pl, rows: RW.rows, sup: RW.sup, mode: RW.mode, xs: RW.rows.map(r => +r.x) };
  }
  /* keepAt(list, xs, tol): the items (each with x) within tol (default 0.011 ft: both sides, ±0.01 ft, of a plate change or support) of an
     entered station */
  const keepAt = (list, xs, tol) => list.filter(o => xs.some(x => Math.abs(+o.x - x) <= (tol == null ? 0.011 : tol) + 1e-9));
  /* the entered row nearest x (the one the location takes) */
  const nearest = (rows, x) => rows.reduce((b, r) => (!b || Math.abs(r.x - x) < Math.abs(b.x - x) ? r : b), null);
  /* step(mod, C, x, o): the worked step that names the source and gives the entered values at x (the nearest entered row); o.range:
     [p, q] (a panel: every entered row in it), o.sup: k (a bearing: the reactions entered at support k) */
  function step(mod, C, x, o) {
    o = o || {};
    const SP = SPECS[mod], F = C.mode === 'fac' ? SP.fac : null, cols = colsOf(mod, C.mode), txt = (r, cs) => cs.filter(([k]) => isN(r[k]) && r[k] !== 0).map(([k, lab, u]) => `${plain(lab)} = ${fmt(r[k], 2)} ${u}`).join('; ') || 'every value 0';
    let note;
    if (o.sup != null && SP.sup) { const r = (C.sup || [])[o.sup]; note = r ? `Reactions entered at this support: ${txt(r, SP.sup.cols)}.` : 'No reactions entered at this support.'; }
    else if (o.range) { const rs = C.rows.filter(r => r.x >= Math.min(...o.range) - 1e-6 && r.x <= Math.max(...o.range) + 1e-6); note = `Rows entered in this panel (the largest magnitudes are taken): ${rs.map(r => `x = ${fmt(r.x, 3)} ft: ${txt(r, cols)}`).join(' | ') || 'none'}.`; }
    else if (!isN(x)) note = `${C.rows.length} row(s) entered (the Custom table of the tab; the report lists them).`;
    else { const r = nearest(C.rows, x); note = r ? `Row x = ${fmt(r.x, 3)} ft${Math.abs(r.x - x) > 1e-9 ? ` (this location, x = ${fmt(x, 3)} ft, is ${fmt(Math.abs(r.x - x), 3)} ft from it${mod === 'flex' ? ': linear between the entered rows' : ': the rows within 0.011 ft are taken'})` : ''}: ${txt(r, cols)}.` : ''; }
    return { id: 'cd.src', label: 'Demands: entered (Custom)', sym: '', eq: '', sub: '', value: `entered on the ${SP.name} tab, Custom demands table${F ? `, factored (${F.combo})` : ', unfactored by load case'}`, unit: '', ref: '', note };
  }

  /* ---------- the table (HTML) and its events ---------- */
  function css() {
    if (typeof document === 'undefined' || document.getElementById('cd-css')) return;
    const s = document.createElement('style'); s.id = 'cd-css';
    s.textContent = `.cd-wrap{max-height:360px;overflow:auto;} .cd-tbl td input{width:72px;} .cd-tbl td.x input{width:64px;} .cd-tbl th{font-size:8.5pt;white-space:nowrap;} .cd-tbl th .u{display:block;font-weight:normal;color:#64748b;}
      .cd-bar{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin:4px 0;} .cd-err{color:#b23a2a;font-size:9pt;margin:4px 0;} .cd-tbl td.sn{text-align:left;white-space:nowrap;}`;
    document.head.appendChild(s);
  }
  function card(P, mod, g) {
    css();
    const SP = SPECS[mod], E = get(P, mod, g), cols = colsOf(mod, E.mode), F = SP.fac, sup = supsOf(P), RW = rowsOf(P, mod, g), G = (P.girders || [])[g] || {};
    const cell = (id, v, lab) => `<input type="text" inputmode="decimal" data-cd="${id}" value="${isN(v) ? esc(String(v)) : ''}" aria-label="${esc(lab)}">`;
    const head = cols.map(([k, lab, u]) => `<th title="${esc(k)}">${lab}<span class="u">${esc(u)}</span></th>`).join('');
    const rows = E.rows.length ? E.rows : [{}];
    let h = `<section class="sec" id="cd_${mod}"><div class="secHead">Custom demands, ${esc(SP.name)}: ${esc(G.label || G.id || '')}</div><div class="secBody">
      ${F ? `<div class="fRow"><label for="cd_mode_${mod}">Values entered</label><select id="cd_mode_${mod}" data-cdmode="1" style="width:auto;max-width:100%"><option value="unf"${E.mode === 'unf' ? ' selected' : ''}>Unfactored, by load case</option><option value="fac"${E.mode === 'fac' ? ' selected' : ''}>Factored: ${esc(F.combo)}</option></select></div>` : ''}
      <p class="note">${(E.mode === 'fac' && F ? F : SP.unf).note}</p>
      <p class="note">Stations x from the left end of the girder (ft). Plates, deck, materials and brace points: this project's, at each station. Paste from Excel: copy the cells (x first, then the columns in this order; a header row is skipped) and paste into a cell (Ctrl+V): the rows fill from there. A blank cell is 0. Saved with the project for this girder.</p>
      <div class="tscroll cd-wrap"><table class="tbl cd-tbl"><thead><tr><th>#</th><th>x<span class="u">ft</span></th>${head}<th></th></tr></thead><tbody>
      ${rows.map((r, i) => `<tr><td>${i + 1}</td><td class="x">${cell(`r:${i}:x`, r.x, `row ${i + 1} x`)}</td>${cols.map(([k]) => `<td>${cell(`r:${i}:${k}`, r[k], `row ${i + 1} ${k}`)}</td>`).join('')}<td><button type="button" data-cdact="del:${i}" title="Remove this row"${E.rows.length ? '' : ' disabled'}>×</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="cd-bar"><button type="button" data-cdact="add">Add row</button><button type="button" data-cdact="sort">Sort by x</button><button type="button" data-cdact="clear"${E.rows.length ? '' : ' disabled'}>Clear rows</button><span class="note">${E.rows.length} row(s)</span></div>
      ${RW.err.length && E.rows.length ? `<div class="cd-err">${RW.err.map(esc).join('<br>')}</div>` : ''}`;
    if (SP.sup) {
      const sc = SP.sup.cols;
      h += `<h4 class="sub">Support reactions (bearing stiffeners)</h4><p class="note">${SP.sup.note}</p><div class="tscroll"><table class="tbl cd-tbl"><thead><tr><th class="lft">Support</th><th>x<span class="u">ft</span></th>${sc.map(([k, lab, u]) => `<th>${lab}<span class="u">${esc(u)}</span></th>`).join('')}</tr></thead><tbody>
        ${sup.map((x, k) => `<tr><td class="sn">${supName(k, sup.length)}</td><td>${fmt(x, 2)}</td>${sc.map(([c]) => `<td>${cell(`s:${k}:${c}`, (E.sup[k] || {})[c], `${supName(k, sup.length)} ${c}`)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    }
    return h + '</div></section>';
  }
  const parseCell = t => { const s = String(t == null ? '' : t).trim().replace(/,/g, '').replace(/^\((.*)\)$/, '-$1').replace(/[−–]/g, '-'); if (s === '') return null; const v = Number(s); return isFinite(v) ? v : NaN; };
  let refocus = null;
  /* wire(host, P, mod, g, changed): the table's events. Every edit writes P.custom (the girder's entry) and calls changed() (the page saves
     the project and redraws; the cell that had the focus gets it back) */
  function wire(host, P, mod, g, changed) {
    const root = host.querySelector('#cd_' + mod); if (!root) return;
    if (refocus) { const el = root.querySelector(`[data-cd="${refocus}"]`); refocus = null; if (el) { el.focus(); if (el.select) el.select(); } }
    const fire = () => setTimeout(() => { const a = typeof document !== 'undefined' ? document.activeElement : null; refocus = a && a.dataset && a.dataset.cd ? a.dataset.cd : null; changed(); }, 0);
    const setCell = (id, v) => { const [t, i, k] = id.split(':'), E = entry(P, mod, g), L = t === 's' ? E.sup : E.rows; while (L.length <= +i) L.push({}); const o = L[+i] || (L[+i] = {});
      if (v == null) delete o[k]; else o[k] = v; };
    root.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.cdmode) { const E = entry(P, mod, g); E.mode = t.value === 'fac' ? 'fac' : 'unf'; fire(); return; }
      if (!t.dataset.cd) return;
      const v = parseCell(t.value); if (Number.isNaN(v)) { t.setCustomValidity && t.setCustomValidity('Enter a number'); if (t.reportValidity) t.reportValidity(); return; }
      if (t.setCustomValidity) t.setCustomValidity('');
      setCell(t.dataset.cd, v); fire();
    });
    root.addEventListener('paste', e => {
      const t = e.target; if (!t.dataset || !t.dataset.cd) return;
      const txt = (e.clipboardData || (typeof window !== 'undefined' && window.clipboardData) || { getData: () => '' }).getData('text') || '';
      if (!/[\t\r\n]/.test(txt.trim())) return;   // one value: an ordinary paste
      e.preventDefault();
      const n = paste(P, mod, g, t.dataset.cd, txt);
      if (n.skipped) alert(`${n.skipped} cell(s) were not numbers and were left blank.`);
      fire();
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-cdact]'); if (!b) return; const E = entry(P, mod, g), a = b.dataset.cdact;
      if (a === 'add') { if (!E.rows.length) E.rows.push({}); E.rows.push({}); refocus = `r:${E.rows.length - 1}:x`; setTimeout(changed, 0); return; }   // an empty table shows one blank row: keep it
      if (a === 'sort') { E.rows.sort((p, q) => (isN(p.x) ? p.x : Infinity) - (isN(q.x) ? q.x : Infinity)); fire(); return; }
      if (a === 'clear') { if (typeof confirm === 'function' && !confirm('Remove every row of this table?')) return; E.rows = []; fire(); return; }
      if (a.startsWith('del:')) { E.rows.splice(+a.slice(4), 1); fire(); }
    });
  }
  /* paste(P, mod, g, at, text): tab-separated rows (Excel) into the table from cell at ('r:i:key' or 's:k:key'), rows added as needed; a
     first line that is not numbers (a header) is skipped. Returns { rows, skipped } */
  function paste(P, mod, g, at, text) {
    const [t, i0, k0] = at.split(':'), E = entry(P, mod, g), keys = t === 's' ? SPECS[mod].sup.cols.map(c => c[0]) : ['x'].concat(colsOf(mod, E.mode).map(c => c[0]));
    let lines = String(text).replace(/\r\n?/g, '\n').split('\n'); while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    const grid = lines.map(l => l.split('\t'));
    if (grid.length && grid[0].some(c => c.trim() !== '' && Number.isNaN(parseCell(c)))) grid.shift();   // a header row
    const c0 = Math.max(0, keys.indexOf(k0)); let skipped = 0;
    const L = t === 's' ? E.sup : E.rows, nMax = t === 's' ? supsOf(P).length : Infinity;
    grid.forEach((cells, r) => { const i = +i0 + r; if (i >= nMax) return; while (L.length <= i) L.push({}); const o = L[i] || (L[i] = {});
      cells.forEach((c, j) => { const k = keys[c0 + j]; if (!k) return; const v = parseCell(c); if (Number.isNaN(v)) { skipped++; delete o[k]; } else if (v == null) delete o[k]; else o[k] = v; }); });
    return { rows: grid.length, skipped };
  }

  /* report(P, mod, g): the entered table for the calculation report: { title, head, rows (cells as text), note } */
  function report(P, mod, g) {
    const E = get(P, mod, g), SP = SPECS[mod], cols = colsOf(mod, E.mode), RW = rowsOf(P, mod, g), F = E.mode === 'fac' ? SP.fac : null, sup = supsOf(P);
    const tx = l => l.replace(/<sub>(.*?)<\/sub>/g, (m, a) => `$_{${a}}$`).replace(/<[^>]+>/g, '');
    const out = { title: `Custom demands entered on the ${SP.name} tab${F ? ' (factored)' : ' (unfactored)'}`, head: ['x (ft)'].concat(cols.map(([, lab, u]) => `${tx(lab)} (${u})`)),
      rows: RW.rows.map(r => [fmt(r.x, 3)].concat(cols.map(([k]) => (isN(r[k]) ? fmt(r[k], 2) : '—')))), note: (F ? F.note : SP.unf.note).replace(/<sub>(.*?)<\/sub>/g, (m, a) => `$_{${a}}$`).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') };
    if (SP.sup) out.sup = { head: ['Support', 'x (ft)'].concat(SP.sup.cols.map(([, lab, u]) => `${tx(lab)} (${u})`)), rows: sup.map((x, k) => [supName(k, sup.length), fmt(x, 2)].concat(SP.sup.cols.map(([c]) => (RW.sup[k] && isN(RW.sup[k][c]) ? fmt(RW.sup[k][c], 2) : '—')))) };
    return out;
  }

  window.SBDCustomDemands = { SPECS, get, entry, srcGet, srcSet, rowsOf, payload, keepAt, step, card, wire, paste, report, supsOf };
})();
