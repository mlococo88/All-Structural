/* apps/ps-bridge/ui/rating.js — the Rating output tab (window.PSBUiRating). Classic script; display only. Created 2026-11-13 (PR 2d-2,
   docs/ps-bridge-plan.md §2.3). As the old app's Rating tab (the LRFR rating of the HL-93 design load: flexure at the governing station,
   shear at the governing shear section, Service III; φ_c φ_s; the entered legal / permit vehicles), in the steel app's layout. Every number
   is the engine's (computeAll R.rating, R.shrRating, R.svcRating, R.vehRatings), worked in engine/worked-hdr.js rating(). The graphics: the
   rating factors against 1.0 (the steel bar chart, PSBVizAlong.hbars) and the rated sections along the span (the steel detail kit).
   The MBE citations are the old app's labels (article numbers, no edition) so that the tab matches the old app (harness B); the MBE 4th
   Ed. (2026) labels come in their own PR (plan §5 PR 6, PS-14 e). The old tab's "Send capacity to MCT Rating" hand-off is not carried here
   (NOMCT, 2026-11-25: no MCT output). φ_c, φ_s and the vehicles are inputs on the Loads tab.
   E1 (2026-11-15, review finding O17; the Steel Bridge app's Rating tab, apps/steel-bridge/ui/rating.js): the rating at every analysis
   station of the girder (engine/rating-along.js, MBE 4th Ed. (2026)): flexure in positive and in negative moment (continuity on: over the
   half span next to an interior support), shear from the critical section, Service III; the governing location of each group (its worked
   steps, rt.al.*), the RF along the girder (chart, #gfx_rtal) and a table of every location (a click on a row works that location below the
   table: steps rt.sel.*, screen only). The cards of the engine's own rating at its governing sections follow, unchanged.
   RG (2026-11-25, the engineer's request; display only): in the Report (ctx.ui.rtGov, report/builders.js) the table of every location is
   replaced by the rows of its governing stations and critical sections (govRows, govCard); on the tab nothing changes.
     output(ctx) -> HTML; after(el, ctx); govRows(R). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, VK = () => window.PSBVizKit;
  const OPEN = new Set(['flex']);
  const TOPICS = [
    { key: 'cs', title: 'Condition and system factors', ref: 'MBE 6A.4.2.3, 6A.4.2.4', ids: /^rt\.phiCSv?$/ },
    { key: 'flex', title: 'Flexure rating at the governing station', ref: 'MBE 6A.4 · Strength I', ids: /^rt\.(Rn|MDC|MDW|MLL|RFinv|RFopr|RFmid)$/, res: /^rt\.RFinv$/, rf: /^rt\.RF(inv|opr)$/ },
    { key: 'shear', title: 'Shear rating at the governing shear section', ref: 'MBE 6A.5.6 · Strength I', ids: /^rt\.(phiVn|VDC|VDW|VLL|RFvInv|RFvOpr)$/, res: /^rt\.RFvInv$/, rf: /^rt\.RFv(Inv|Opr)$/ },
    { key: 's3', title: 'Service III rating (prestressed concrete)', ref: 'MBE 6A.5.4.1', ids: /^rt\.(fPS|fDC|fDW|fLL|fr|RFs3)$/, res: /^rt\.RFs3$/, rf: /^rt\.RFs3$/ },
    { key: 'veh', title: 'Legal / permit vehicles (entered factored forces)', ref: 'MBE 6A.4.4 / 6A.4.5', ids: /^rt\.veh\d+\./, rf: /^rt\.veh\d+\.RF$/ },
    // E1 (2026-11-15): the governing location of each group of the rating at every station (engine/rating-along.js)
    { key: 'alfp', title: 'Along the girder: positive flexure, governing location', ref: 'MBE 4th Ed. (2026) 6A.4.2.1 · Strength I', ids: /^rt\.al\.fp\./, res: /^rt\.al\.fp\.RFinv$/, rf: /^rt\.al\.fp\.RF(inv|opr)$/ },
    { key: 'alfn', title: 'Along the girder: negative flexure over the pier, governing location', ref: 'MBE 4th Ed. (2026) 6A.4.2.1 · Strength I', ids: /^rt\.al\.fn\./, res: /^rt\.al\.fn\.RFinv$/, rf: /^rt\.al\.fn\.RF(inv|opr)$/ },
    { key: 'alv', title: 'Along the girder: shear, governing location', ref: 'MBE 4th Ed. (2026) 6A.4.2.1, 6A.5.8 · Strength I', ids: /^rt\.al\.v\./, res: /^rt\.al\.v\.RFinv$/, rf: /^rt\.al\.v\.RF(inv|opr)$/ },
    { key: 'als3', title: 'Along the girder: Service III, governing location', ref: 'MBE 4th Ed. (2026) 6A.5.4.1', ids: /^rt\.al\.s3\./, res: /^rt\.al\.s3\.RF$/, rf: /^rt\.al\.s3\.RF$/ }];
  const SELT = [{ key: 'sel', title: 'The selected location', ref: 'MBE 4th Ed. (2026)', ids: /^rt\.sel\./, rf: /^rt\.sel\.RF(inv|opr)?$/ }];   // rf: rating-factor steps (PSBOutKit.groups: RF status, not demand / capacity; 2026-11-15)
  const rfs = v => v >= 99 ? '—' : null;
  const okT = (ok, v) => v >= 99 ? '<td class="lft">n/a</td>' : `<td class="${ok ? 'ok' : 'ngt'}">${ok ? '≥ 1.0' : '< 1.0'}</td>`;
  /* ---------- E1 (2026-11-15): the rating at every station (engine/rating-along.js) ---------- */
  const AL = () => window.PSBRatingAlong;
  const fin = v => typeof v === 'number' && isFinite(v);
  const KN = { flexP: ['Flexure, positive', 'fp', 'RFinv'], flexN: ['Flexure, negative (pier)', 'fn', 'RFinv'], shear: ['Shear', 'v', 'RFinv'], s3: ['Service III', 's3', 'RF'] };
  const SEL = { key: null, i: -1 };   // the row of the table of every location worked below it (page memory only)
  const rfCls = v => (!fin(v) ? '' : v < 1 ? 'ngt' : 'ok');
  const rfTd = v => `<td class="${rfCls(v)}">${fin(v) ? K().fx(v, 3) : '—'}</td>`;
  const dOf = q => (q.unit === 'ksi' ? 3 : 1);
  function along(ctx) {
    const k = K(), A = AL() ? AL().of(ctx.R) : null;
    if (!A) return '';
    const inRpt = !ctx.redraw, every = !inRpt || !!(ctx.ui && ctx.ui.every), wkG = q => k.wk(`rt.al.${KN[q.kind][1]}.${KN[q.kind][2]}`);
    const G = AL().GROUPS.filter(([kd]) => A.gov[kd]);
    let h = k.card('Load rating along the girder: governing (HL-93, MBE 4th Ed. (2026))', `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Group</th><th class="lft">Governing location (lowest inventory RF)</th><th>C</th><th>Unit</th><th>RF inventory</th><th>RF operating</th><th></th></tr></thead><tbody>
      ${G.map(([kd, t]) => { const q = A.gov[kd]; return `<tr${q.inv < 1 ? ' class="ng"' : ''}><td class="lft">${t}</td><td class="lft">${k.esc(q.name)}</td><td>${k.fx(q.C, dOf(q))}</td><td>${q.unit}</td>${rfTd(q.inv)}${q.kind === 's3' ? '<td>—</td>' : rfTd(q.opr)}<td>${wkG(q)}</td></tr>`; }).join('')}</tbody></table></div>`
      + `<p class="note"><b>Governing:</b> inventory RF ${A.inv ? `<b>${k.fx(A.inv.inv, 3)}</b> (${KN[A.inv.kind][0]}, ${k.esc(A.inv.name)}) ${wkG(A.inv)}` : '—'}; operating RF ${A.opr ? `<b>${k.fx(A.opr.opr, 3)}</b> (${KN[A.opr.kind][0]}, ${k.esc(A.opr.name)}) ${k.wk(`rt.al.${KN[A.opr.kind][1]}.RFopr`)}` : '—'}.</p>`
      + `<p class="note">RF = (C − γ<sub>DC</sub>DC − γ<sub>DW</sub>DW)/(γ<sub>LL</sub>(LL+IM)) (MBE 4th Ed. Eq. 6A.4.2.1-1) at every station of the engine's analysis grid (${A.rows.length} ratings; Art. 6A.4.2.1: the lowest rating factor of the limit states and load effects governs). Strength I: C = φ<sub>c</sub>φ<sub>s</sub>φR<sub>n</sub> (Eqs. 6A.4.2.1-2, -3; shear with φ<sub>s</sub> = 1.0, Art. 6A.4.2.4), γ<sub>DC</sub> 1.25, γ<sub>DW</sub> 1.50, γ<sub>LL</sub> 1.75 inventory, 1.35 operating (Table 6A.4.2.2-1), a dead load that relieves the rated moment (positive or negative) taking the LRFD minimum γ<sub>DC</sub> 0.90, γ<sub>DW</sub> 0.65 (AASHTO LRFD 10th Ed. Table 3.4.1-2; engineer decisions E1-D2, E1-D5); Service III: C = f<sub>R</sub>, γ<sub>DC</sub> = γ<sub>DW</sub> = 1.00, γ<sub>LL</sub> 0.8 (Tables 6A.4.2.2-1, 6A.4.2.2-2), inventory only (C6A.5.4.1). No load modifier η (C6A.4.2.1) and no restraint moments (Art. 6A.5.10), as the engine's rating. Every demand and capacity is the engine's at that station: φM<sub>n</sub> of the <a href="#" data-gotab="flex">Flexure tab</a>, φV<sub>n</sub> of the <a href="#" data-gotab="shear">Shear tab</a>, the moments and shears of the <a href="#" data-gotab="an">Analysis tab</a>.</p>`
      + `<p class="note">Negative moment: ${A.gov.flexN ? 'the stations of the half span next to an interior support with a negative live-load moment, C from the pier section of the continuity check (deck bars A<sub>s</sub> in tension; the same section and bars over the region, no cut-off point being an input); a dead load that relieves the negative moment takes the LRFD minimum load factor (DC 0.90, DW 0.65, AASHTO LRFD 10th Ed. Table 3.4.1-2).' : esc2(A.negNote || 'no negative live-load moment (simple span): not rated.')} Positive moment: each dead-load part (girder + DC1, DC2, DW) takes 1.25 / 1.50 where it adds to the positive moment and 0.90 / 0.65 where it relieves it (near an interior support of a continuous unit, DC2 and DW are negative; engineer decision E1-D5, 2026-11-21). Shear: from the critical section (the engine's first shear station past the bearing) to its mirror, with the engine's φV<sub>n</sub> and C = φ<sub>c</sub>φV<sub>n</sub>: φ<sub>s</sub> = 1.0 for shear (MBE 4th Ed. Art. 6A.4.2.4; engineer decision E1-D4, 2026-11-21, as the Steel Bridge app), the lower limit 0.85 kept on φ<sub>c</sub> × 1.0. The entered legal / permit vehicles have one moment and one shear each, with no station: they are rated where the engine rates them (card below).</p>`, 'card-rtal');
    h += k.gcard('Load rating: RF along the girder', 'gfx_rtal');
    const rows = A.rows, sel = SEL.key === selKey(ctx) && rows[SEL.i] ? SEL.i : (A.inv ? A.inv.i : 0);
    if (inRpt && ctx.ui && ctx.ui.rtGov) return h + govCard(ctx.R, A);   // RG (2026-11-25): the Report's condensed table (report/builders.js)
    h += k.card(`Rating factors at every location (${rows.length})`, every ? `<p class="note">C: φ<sub>c</sub>φ<sub>s</sub>φM<sub>n</sub> (flexure), φ<sub>c</sub>φ<sub>s</sub>φV<sub>n</sub> (shear) or f<sub>R</sub> (Service III); DC, DW and LL+IM unfactored, in the unit of the check (negative flexure: the hogging sense, DC the sum of the noncomposite part and DC2, each with its own load factor in the work).${inRpt ? '' : ' Click a row: its work is shown below the table.'}</p>
      <div class="tscroll" style="max-height:340px;overflow:auto"><table class="tbl rt-al"><thead><tr><th class="lft">Location</th><th class="lft">Check</th><th>C</th><th>DC</th><th>DW</th><th>LL+IM</th><th>Unit</th><th>RF inv.</th><th>RF opr.</th></tr></thead><tbody>
      ${rows.map(q => `<tr data-rti="${q.i}" class="${[q.i === sel && !inRpt ? 'sel' : '', fin(q.inv) && q.inv < 1 ? 'ng' : ''].filter(Boolean).join(' ')}"${inRpt ? '' : ' style="cursor:pointer"'}><td class="lft">${k.esc(q.name)}</td><td class="lft">${KN[q.kind][0]}</td><td>${k.fx(q.C, dOf(q))}</td><td>${k.fx(q.DC, dOf(q))}</td><td>${k.fx(q.DW, dOf(q))}</td><td>${k.fx(q.LL, dOf(q))}</td><td>${q.unit}</td>${rfTd(q.inv)}${q.kind === 's3' ? '<td>—</td>' : rfTd(q.opr)}</tr>`).join('')}</tbody></table></div>${inRpt ? '' : '<div id="rt_selwork"></div>'}`
      : `<p class="note">The ${rows.length} rating factors of every location are tabulated on the Rating tab and in this report with Detail "every station"; the governing location of each group is worked in this section's worked steps.</p>`, 'card-rtall');
    return h;
  }
  /* RG (2026-11-25, display only; the engineer's request "governing stations only" for the Report): govRows(R) -> { rows: [{ q, why }],
     n (ratings evaluated), ns (stations evaluated) } or null: the rows of the table of every location (PSBRatingAlong.of(R), nothing is
     computed here) that the Report shows by default: for each group (limit state and load effect) the row with the lowest inventory RF
     (A.gov) and, flexure and shear, the row with the lowest operating RF; and the rows at the critical sections: the bearings (x = 0 and
     L), the shear critical sections (the engine's first and last shear station past the bearings, R.shear), the tenth points, the
     transfer points (x = ℓ_t / 12 and L − ℓ_t / 12, as the engine's grid), the debond points of each debonded group and the end of
     their transfer length, and midspan, each at the rated station nearest to it (every row there); a station listed once, in x order,
     with every reason it is shown (why). Decisions pending engineer review: the operating RF counted as a second "vehicle" of the
     HL-93 rating (the legal / permit vehicles have no station); the nearest rated station for a critical section that is not one. */
  function govRows(R) {
    const A = AL() ? AL().of(R) : null; if (!A || !A.rows.length) return null;
    const rows = A.rows, L = R.L, why = new Map(), k = K();
    const add = (q, t) => { if (!q) return; const w = why.get(q.i) || []; if (!w.includes(t)) w.push(t); why.set(q.i, w); };
    AL().GROUPS.forEach(([kd]) => { const list = rows.filter(r => r.kind === kd); if (!list.length) return;
      add(A.gov[kd], kd === 's3' ? 'lowest RF' : 'lowest inventory RF');
      if (kd !== 's3') add(list.filter(r => fin(r.opr)).reduce((b, r) => (!b || r.opr < b.opr ? r : b), null), 'lowest operating RF'); });
    const crit = [], at = (x, t) => { if (fin(x) && x > -1e-9 && x < L + 1e-9) crit.push([x, t]); };
    at(0, 'bearing'); at(L, 'bearing');
    const shN = (R.shear || []).filter(q => !q.isBearing);
    if (shN.length) { const a = Math.min(...shN.map(q => q.x)), b = Math.max(...shN.map(q => q.x)); at(a, 'shear critical section'); if (b - a > 1e-6) at(b, 'shear critical section'); }
    for (let j = 1; j <= 9; j++) at(j * L / 10, j === 5 ? 'midspan' : `tenth point ${j / 10}L`);
    const lt = R.ss && R.ss.lt > 0 ? R.ss.lt / 12 : 0;
    if (lt) { at(lt, 'transfer point'); at(L - lt, 'transfer point'); }
    [...new Set(((R.ss && R.ss.groups) || []).filter(g => g.dbnd > 0).map(g => g.dbnd))].forEach(d => { at(d, 'debond point'); at(L - d, 'debond point');
      if (lt) { at(d + lt, 'debond transfer point'); at(L - d - lt, 'debond transfer point'); } });
    const xs = [...new Set(rows.map(r => r.x))];
    crit.forEach(([x, t]) => { const xn = xs.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), xs[0]);
      const lab = Math.abs(xn - x) < 1e-3 ? t : `${t} (x = ${k.fx(x, 2)} ft; nearest rated station)`;
      rows.filter(r => r.x === xn).forEach(r => add(r, lab)); });
    return { rows: rows.filter(r => why.has(r.i)).map(q => ({ q, why: why.get(q.i) })), n: rows.length, ns: xs.length };
  }
  function govCard(R, A) {
    const k = K(), G = govRows(R); if (!G) return '';
    return k.card(`Rating factors at the governing stations (${G.rows.length} of ${G.n})`, `<p class="note">${G.n} ratings were evaluated at ${G.ns} stations (every station of the engine's analysis grid, the table of every location on the Rating tab). Shown here: for each group the station with the lowest inventory RF and, flexure and shear, the lowest operating RF (HL-93), and the ratings at the critical sections: the bearings, the shear critical sections, the tenth points, the transfer and debond points and midspan, each at the nearest rated station; a station is listed once, with every reason it is shown. The governing RF of each group is the lowest of every station (card above), so this table holds it.</p>
      <div class="tscroll"><table class="tbl rt-al rt-gov"><thead><tr><th class="lft">Location</th><th class="lft">Check</th><th>C</th><th>DC</th><th>DW</th><th>LL+IM</th><th>Unit</th><th>RF inv.</th><th>RF opr.</th><th class="lft">Shown for</th></tr></thead><tbody>
      ${G.rows.map(({ q, why }) => `<tr${fin(q.inv) && q.inv < 1 ? ' class="ng"' : ''}><td class="lft">${k.esc(q.name)}</td><td class="lft">${KN[q.kind][0]}</td><td>${k.fx(q.C, dOf(q))}</td><td>${k.fx(q.DC, dOf(q))}</td><td>${k.fx(q.DW, dOf(q))}</td><td>${k.fx(q.LL, dOf(q))}</td><td>${q.unit}</td>${rfTd(q.inv)}${q.kind === 's3' ? '<td>—</td>' : rfTd(q.opr)}<td class="lft">${k.esc(why.join('; '))}</td></tr>`).join('')}</tbody></table></div>`, 'card-rtgov');
  }
  const esc2 = s => K().esc(s);
  const selKey = ctx => (ctx.ui && ctx.ui.otab ? 'tab' : 'x') + '|' + (ctx.R && ctx.R.L) + '|' + ((AL() && AL().of(ctx.R) || { rows: [] }).rows.length);
  /* the RF along the girder (the steel app's chart, apps/steel-bridge/ui/alonggfx.js rating()) and the table's row selection */
  function alongAfter(el, ctx) {
    const A = AL() ? AL().of(ctx.R) : null; if (!A) return;
    const k = K(), L = ctx.R.L, cap = 5, slot = el.querySelector('#gfx_rtal');
    const SS = [{ key: 'fpi', html: 'Flexure +, inventory', ci: 0, kind: 'flexP', w: 'inv' }, { key: 'fni', html: 'Flexure − (pier), inventory', ci: 4, kind: 'flexN', w: 'inv' }, { key: 'vi', html: 'Shear, inventory', ci: 2, kind: 'shear', w: 'inv' },
      { key: 's3', html: 'Service III', ci: 3, kind: 's3', w: 'inv' }, { key: 'fpo', html: 'Flexure +, operating', ci: 0, dash: '6 3', kind: 'flexP', w: 'opr' }, { key: 'fno', html: 'Flexure − (pier), operating', ci: 4, dash: '6 3', kind: 'flexN', w: 'opr' },
      { key: 'vo', html: 'Shear, operating', ci: 2, dash: '6 3', kind: 'shear', w: 'opr' }].filter(q => A.rows.some(r => r.kind === q.kind && fin(r[q.w])));
    const data = SS.map(q => A.rows.filter(r => r.kind === q.kind && fin(r[q.w])).map(r => [r.x, r[q.w]]));
    let ymax = 0; data.forEach(s => s.forEach(p => { ymax = Math.max(ymax, Math.min(Math.max(p[1], 0), cap)); })); ymax = Math.max(2, Math.ceil(ymax * 1.05 * 2) / 2);
    const ymin = Math.min(0, ...data.map(s => s.reduce((m, p) => Math.min(m, p[1]), 0))), y0 = ymin < 0 ? Math.floor(ymin * 2) / 2 : 0;
    const govs = [['inv', 'Inventory'], ['opr', 'Operating']].map(([w, t]) => { const q = A[w]; return q ? { x: q.x, y: Math.min(q[w], ymax), text: `${t} RF ${k.fx(q[w], 3)} at ${k.fx(q.x, 1)} ft (${KN[q.kind][0]})` } : null; }).filter(Boolean);
    const xs = [...new Set(A.rows.map(r => +r.x.toFixed(4)))].sort((a, b) => a - b);
    const lowAt = x => A.rows.filter(r => Math.abs(r.x - x) < 1e-3 && fin(r.inv)).reduce((b, r) => (!b || r.inv < b.inv ? r : b), null);
    const regs = xs.map((x, j) => { const r = lowAt(x); return r ? { x0: j ? (xs[j - 1] + x) / 2 : 0, x1: j < xs.length - 1 ? (x + xs[j + 1]) / 2 : L, v: r.i, pri: 3,
      lab: [`x = ${k.fx(x, 2)} ft: lowest ${KN[r.kind][0]}`, A.rows.filter(q => Math.abs(q.x - x) < 1e-3).map(q => `${KN[q.kind][0]} ${fin(q.inv) ? k.fx(q.inv, 2) : '—'}${q.kind !== 's3' && fin(q.opr) ? ' / ' + k.fx(q.opr, 2) : ''}`).join('; ')] } : null; }).filter(Boolean);
    if (slot && VA() && VA().mount) VA().mount(slot, { key: 'rtal', title: 'Rating factor along the girder', sub: `HL-93 design load (LRFR, MBE 4th Ed. (2026)); inventory solid, operating dashed; ${A.rows.length} ratings`,
      controls: VK().tiles([{ label: `Inventory, governing${A.inv ? ': ' + KN[A.inv.kind][0] : ''}`, value: A.inv ? k.fx(A.inv.inv, 3) : '—', unit: A.inv ? `x = ${k.fx(A.inv.x, 1)} ft` : '', tone: A.inv && A.inv.inv < 1 ? 't' : 'c' },
        { label: `Operating, governing${A.opr ? ': ' + KN[A.opr.kind][0] : ''}`, value: A.opr ? k.fx(A.opr.opr, 3) : '—', unit: A.opr ? `x = ${k.fx(A.opr.x, 1)} ft` : '', tone: A.opr && A.opr.opr < 1 ? 't' : '' },
        ...AL().GROUPS.filter(([kd]) => A.gov[kd]).map(([kd]) => ({ label: KN[kd][0], value: k.fx(A.gov[kd].inv, 3), unit: `x = ${k.fx(A.gov[kd].x, 1)} ft`, tone: A.gov[kd].inv < 1 ? 't' : '' }))]),
      draw: W => VA().render({ L0: 0, L1: L, sup: [0, L], axisTitle: 'Station x, ft (from ℄ bearing, left)', aria: 'Load rating factors along the girder', rows: [
        { kind: 'chart', key: 'rf', label: 'Rating factor RF', h: W < 600 ? 160 : 220, yr: [y0, ymax], ystep: ymax - y0 > 6 ? 1 : 0.5, cap: ymax, hidden: HIDE,
          series: SS.map((q, j) => ({ key: q.key, ci: q.ci, dash: q.dash, pts: data[j] })), limits: [{ y: 1, label: 'RF = 1.0' }], gov: govs, govLabels: govs, regs }] }, W),
      onSelect: v => { if (typeof v === 'number') selRow(el, ctx, v, true); }, chips: () => [{ label: 'Show', items: SS.map(q => ({ key: q.key, html: `${VA().swatch(q.ci, q.dash)} ${q.html}`, on: !HIDE[q.key] })) }], onChip: key => { HIDE[key] = !HIDE[key]; },
      legend: VA().legend('marks'), hint: 'Point at (or tap) the chart to read the rating factors at a station; click or tap to work its lowest rating below the table.',
      caption: `<p class="vk-cap">The rating factors of the table of every location, by group; the scale is capped at RF ${ymax} (a value above it is drawn at the top edge). RF = 1.0 marked; the governing inventory and operating ratings flagged. Display only.</p>`, file: 'rating-along' });
    const tb = el.querySelector('table.rt-al');
    if (tb) tb.addEventListener('click', e => { const tr = e.target.closest('tr[data-rti]'); if (tr) selRow(el, ctx, +tr.dataset.rti, false); });
    if (el.querySelector('#rt_selwork')) selRow(el, ctx, SEL.key === selKey(ctx) && A.rows[SEL.i] ? SEL.i : (A.inv ? A.inv.i : 0), false, true);
  }
  /* selRow: the row i worked in #rt_selwork (steps rt.sel.*), the row marked; scroll: bring the work into view */
  function selRow(el, ctx, i, scroll, quiet) {
    const A = AL().of(ctx.R), q = A && A.rows[i], box = el.querySelector('#rt_selwork'); if (!q || !box) return;
    SEL.key = selKey(ctx); SEL.i = i;
    el.querySelectorAll('table.rt-al tr[data-rti]').forEach(tr => tr.classList.toggle('sel', +tr.dataset.rti === i));
    box.innerHTML = `<h4 style="font-family:var(--font-ui);font-size:9pt;margin:10px 0 2px">Worked: ${K().esc(KN[q.kind][0])}, ${K().esc(q.name)}</h4>` + K().steps(AL().steps(A, q, 'rt.sel'), SELT, OPEN_SEL);
    K().after(box, OPEN_SEL);
    if (scroll && !quiet && box.scrollIntoView) box.scrollIntoView({ block: 'nearest' });
  }
  const OPEN_SEL = new Set(['sel']), HIDE = {};   // the series switched off (chips), page memory
  function output(ctx) {
    const { R, inp } = ctx, k = K(), ev = (p, d, u) => k.ev(R, p, d, u), wk = k.wk, rt = R.rating, sh = R.shrRating, sv = R.svcRating, md = rt.mid;
    const evRF = (p, v) => rfs(v) || ev(p, 3);
    let h = K().gcard('Load rating: rating factors', 'gfx_rt');
    h += `<p class="note">LRFR design-load rating (HL-93). The rating at every analysis station of the girder (the cards "Load rating along the girder", AASHTO MBE 4th Ed. (2026)) gives the governing rating factors; the cards after them are the engine's own rating at its governing sections (article labels as the old app: the MBE 4th Ed. labels of those cards come in their own PR) and the entered vehicles.</p>`;
    h += k.card('Condition and system factors (MBE 6A.4.2.3 / 6A.4.2.4)', k.kv([['φ<sub>c</sub> × φ<sub>s</sub> entered', `${ev('rating.phiC', 2)} × ${ev('rating.phiS', 2)} <a href="#" data-goin="loads">Loads tab</a>`],
      ['φ<sub>c</sub>φ<sub>s</sub> used, flexure (not less than 0.85, MBE Eq. 6A.4.2.1-3; not more than 1.00)', `<b>${ev('rating.phiCS', 3)}</b>${rt.phiCSfloor ? ' (floored at 0.85)' : rt.phiCScap ? ' (capped at 1.00)' : ''} ${wk('rt.phiCS')}`]]
      .concat('phiCSv' in rt ? [['φ<sub>c</sub>(1.0) used, shear (φ<sub>s</sub> = 1.0, MBE 4th Ed. Art. 6A.4.2.4)', `<b>${ev('rating.phiCSv', 3)}</b>${rt.phiCSvFloor ? ' (floored at 0.85)' : ''} ${wk('rt.phiCSv')}`]] : []))
      + `<p class="note">Applied to the flexure strength ratings and the vehicles' flexure; ${'phiCSv' in rt ? 'shear (along the girder, the engine\'s section and the vehicles) takes φ<sub>c</sub> with φ<sub>s</sub> = 1.0 (MBE 4th Ed. Art. 6A.4.2.4; engineer decision E1-D4, 2026-11-21)' : 'and to shear'}; not to the Service III rating. A blank box is taken as 1.00.</p>`, 'card-rtcs');
    h += along(ctx);
    h += k.card(`Flexure (HL-93), x = ${ev('rating.x', 2)} ft: the station with the lowest inventory RF`, k.kv([['φM<sub>n</sub>', `${ev('rating.Rn', 1, 'kip-ft')} ${wk('rt.Rn')} <a href="#" data-gotab="flex">Flexure tab</a>`],
      ['M<sub>DC</sub> / M<sub>DW</sub>', `${ev('rating.MDC', 1)} ${wk('rt.MDC')} / ${ev('rating.MDW', 1, 'kip-ft')} ${wk('rt.MDW')}`], ['M<sub>LL+IM</sub>', `${ev('rating.MLL', 1, 'kip-ft')} ${wk('rt.MLL')}`],
      ['Inventory RF (γ<sub>LL</sub> = 1.75)', `<b>${ev('rating.RFinv', 3)}</b> ${rt.okInv ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFinv')}`], ['Operating RF (γ<sub>LL</sub> = 1.35)', `<b>${ev('rating.RFopr', 3)}</b> ${rt.okOpr ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFopr')}`],
      ['At midspan (comparison)', `φM<sub>n</sub> ${ev('rating.mid.Rn', 1)}, M<sub>DC</sub> ${ev('rating.mid.MDC', 1)}, M<sub>DW</sub> ${ev('rating.mid.MDW', 1)}, M<sub>LL+IM</sub> ${ev('rating.mid.MLL', 1, 'kip-ft')}: RF<sub>inv</sub> ${ev('rating.mid.RFinv', 3)}, RF<sub>opr</sub> ${ev('rating.mid.RFopr', 3)} ${wk('rt.RFmid')}`]])
      + '<p class="note">RF = (φ<sub>c</sub>φ<sub>s</sub>φM<sub>n</sub> − 1.25 M<sub>DC</sub> − 1.50 M<sub>DW</sub>) / (γ<sub>LL</sub> M<sub>LL+IM</sub>) (MBE Eq. 6A.4.2.1-1), a dead-load part that relieves the positive moment (girder + DC1, DC2 or DW negative, near an interior support) taking 0.90 (DC) / 0.65 (DW) instead (AASHTO LRFD 10th Ed. Table 3.4.1-2; engineer decision E1-D5, 2026-11-21), at the station of the strength-check grid with the lowest inventory RF (positive live-load moment), with the same φM<sub>n</sub> as the strength check. No tonnage for HL-93 (a notional load with no gross weight).</p>', 'card-rtflex');
    h += k.card(`Shear (HL-93), x = ${ev('shrRating.x', 2)} ft: the governing shear section`, k.kv([['φV<sub>n</sub> (general procedure)', `${ev('shrRating.phiVn', 1, 'kip')} ${wk('rt.phiVn')} <a href="#" data-gotab="shear">Shear tab</a>`],
      ['V<sub>DC</sub> / V<sub>DW</sub>', `${ev('shrRating.VDC', 1)} ${wk('rt.VDC')} / ${ev('shrRating.VDW', 1, 'kip')} ${wk('rt.VDW')}`], ['V<sub>LL+IM</sub>', `${ev('shrRating.VLL', 1, 'kip')} ${wk('rt.VLL')}`],
      ['Inventory RF', `<b>${evRF('shrRating.RFinv', sh.RFinv)}</b> ${sh.RFinv >= 99 ? 'no live-load shear' : sh.okInv ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFvInv')}`], ['Operating RF', `<b>${evRF('shrRating.RFopr', sh.RFopr)}</b> ${wk('rt.RFvOpr')}`]])
      + '<p class="note">At the section where V<sub>u</sub>/φV<sub>n</sub> is greatest (the bearing face excluded), with the design\'s MCFT φV<sub>n</sub>. For prestressed girders shear can govern the operating rating. The lowest shear RF over every station is in the card "Load rating along the girder: governing" above.</p>', 'card-rtshear');
    h += k.card(`Service III (prestressed concrete), x = ${ev('svcRating.x', 2)} ft: the governing bottom-tension section`, k.kv([['f<sub>ps</sub> prestress compression, bottom', `${ev('svcRating.fPS', 3, 'ksi')} ${wk('rt.fPS')}`],
      ['f<sub>DC</sub> / f<sub>DW</sub> bottom tension', `${ev('svcRating.fDC', 3)} ${wk('rt.fDC')} / ${ev('svcRating.fDW', 3, 'ksi')} ${wk('rt.fDW')}`], ['f<sub>LL</sub> (unfactored, γ<sub>LL</sub> = 0.8)', `${ev('svcRating.fLL', 3, 'ksi')} ${wk('rt.fLL')}`],
      ['Allowable tension f<sub>r</sub>', `${ev('svcRating.fr', 3, 'ksi')} (${inp.opt.corrosion === 'severe' ? '0.0948√f′<sub>c</sub> ≤ 0.3 ksi, severe corrosion' : '0.19√f′<sub>c</sub> ≤ 0.6 ksi, moderate corrosion'}) ${wk('rt.fr')}`],
      ['Service III RF', `<b>${evRF('svcRating.RF', sv.RF)}</b> ${sv.RF >= 99 ? 'net compression: live load never governs tension (n/a)' : sv.ok ? '≥ 1.0' : '<b style="color:var(--fail)">&lt; 1.0</b>'} ${wk('rt.RFs3')}`]])
      + '<p class="note">MBE 6A.5.4.1, mandatory for prestressed members: RF = (f<sub>r</sub> + f<sub>ps</sub> − f<sub>DC</sub> − f<sub>DW</sub>) / (0.8 f<sub>LL</sub>), γ<sub>DC</sub> = γ<sub>DW</sub> = 1.0 (MBE Table 6A.4.2.2-1); f<sub>pe</sub> without the elastic gains. This card is the engine\'s section of the largest bottom tension; the lowest Service III RF over every station (where the live load gives tension) is in the card "Load rating along the girder: governing" above.</p>', 'card-rts3');
    const V = R.vehRatings || [];
    h += k.card('Legal / permit vehicles (entered factored forces, MBE 6A.4.4 / 6A.4.5)', (V.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Vehicle</th><th>Factored M<br>kip-ft</th><th>Factored V<br>kip</th><th>Weight<br>ton</th><th>RF flexure</th><th>RF shear</th><th>RF</th><th>Rated<br>ton</th><th>Status</th><th></th></tr></thead><tbody>
      ${V.map((v, i) => { const P = `vehRatings.${i}.`; return `<tr><td class="lft">${k.esc(v.name)}</td><td>${ev(P + 'M', 1)}</td><td>${ev(P + 'V', 1)}</td><td>${ev(P + 'W', 1)}</td><td>${evRF(P + 'RFm', v.RFm)}</td><td>${evRF(P + 'RFv', v.RFv)}</td><td><b>${evRF(P + 'RF', v.RF)}</b></td><td>${v.RT != null && v.RF < 99 ? ev(P + 'RT', 1) : '—'}</td>${okT(v.ok, v.RF)}<td>${wk(`rt.veh${i}.RF`)}</td></tr>`; }).join('')}</tbody></table></div>`
      : '<p class="note">No vehicles entered. Add a legal truck (Type 3, 3S2, 3-3) or a permit vehicle on the <a href="#" data-goin="loads">Loads tab</a>.</p>')
      + `<p class="note">Your factored live-load moment and shear (DF, IM, multiple presence and the LRFR live-load factor applied); the app supplies φ<sub>c</sub>φ<sub>s</sub>φM<sub>n</sub> at midspan (${ev('rating.mid.Rn', 1, 'kip-ft')}) and φ<sub>c</sub>φV<sub>n</sub> at the governing shear section (${ev('shrRating.phiVn', 1, 'kip')}; φ<sub>s</sub> = 1.0 for shear, MBE 4th Ed. Art. 6A.4.2.4), with 1.25 DC and 1.50 DW (a midspan dead-load part that relieves the moment: 0.90 / 0.65, E1-D5; M<sub>DC</sub> ${ev('rating.mid.MDC', 1)}, M<sub>DW</sub> ${ev('rating.mid.MDW', 1, 'kip-ft')}; V<sub>DC</sub> ${ev('shrRating.VDC', 1)}, V<sub>DW</sub> ${ev('shrRating.VDW', 1, 'kip')}). The governing RF is the lower of flexure and shear; the rated tons = RF × weight where a weight is entered.</p>`, 'card-rtveh');
    h += K().gcard('Load rating: rated sections along the span', 'gfx_rtx');
    h += k.card('Worked steps: load rating', `<p class="note">LRFR, MBE (article labels as the old app); resistances from AASHTO LRFD 10th Ed. (2024). Every result is the engine's value (the moved Prestressed Bridge Design engine).</p>${k.steps(ctx.W.rating.steps, TOPICS, OPEN)}`);
    void md;
    return h;
  }
  /* the span with the rated sections (flexure, shear, Service III) */
  function xFig(R, W) {
    const V = VK(), S = V.scene(), L = R.L, h = Math.max(0.06 * L, 3), rt = R.rating, sh = R.shrRating, sv = R.svcRating;
    S.rect(0, 0, L, h, 'dt-cc');
    [0, L].forEach(x => S.poly([[x, 0], [x - 0.3 * h, -0.55 * h], [x + 0.3 * h, -0.55 * h]], 'dt-brg'));
    const mk = [[rt.x, `flexure x = ${V.fx(rt.x, 2)} ft: RF_inv ${V.fx(rt.RFinv, 3)}`, '#1D4ED8', 0], [sh.x, `shear x = ${V.fx(sh.x, 2)} ft: RF_inv ${sh.RFinv >= 99 ? '—' : V.fx(sh.RFinv, 3)}`, '#B45309', 1], [sv.x, `Service III x = ${V.fx(sv.x, 2)} ft: RF ${sv.RF >= 99 ? '—' : V.fx(sv.RF, 3)}`, '#15803D', 2]];
    mk.forEach(([x, t, c, i]) => { S.line(x, -0.2 * h, x, h + 0.2 * h, 'dt-gov', { stroke: c }); S.text(x, h, t, { a: x > L * 0.6 ? 'end' : 'start', dx: x > L * 0.6 ? -4 : 4, dy: -10 - 16 * i, sz: 10.5, fill: c, halo: true });
      S.region(x - L * 0.01, 0, x + L * 0.01, h, t); });
    S.dimH(0, L, -0.55 * h, -14, `L = ${V.fx(L, 2)} ft`, { sz: 10.5 });
    return S.render({ W, maxH: 200, label: 'Rated sections along the span' }).svg;
  }
  function after(el, ctx) {
    K().after(el, OPEN);
    alongAfter(el, ctx);   // E1: the RF along the girder and the table's row selection
    const { R } = ctx, k = K(), ev = (p, d) => k.ev(R, p, d), rt = R.rating, sh = R.shrRating, sv = R.svcRating;
    const bar = (v, ci) => ({ v: v >= 99 ? 0 : Math.min(v, 4), cls: v >= 99 ? undefined : v < 1 ? 'ng' : v < 1.1 ? 'hi' : 'ok', text: v >= 99 ? 'n/a' : k.fx(v, 3) });
    const items = [{ id: 'Flexure', key: 'inv / opr', bars: [bar(rt.RFinv), bar(rt.RFopr)], lab: ['Flexure (HL-93)', `inventory ${k.fx(rt.RFinv, 3)}, operating ${k.fx(rt.RFopr, 3)} at x = ${k.fx(rt.x, 2)} ft`] },
      { id: 'Shear', key: 'inv / opr', bars: [bar(sh.RFinv), bar(sh.RFopr)], lab: ['Shear (HL-93)', `inventory ${sh.RFinv >= 99 ? 'n/a' : k.fx(sh.RFinv, 3)}, operating ${sh.RFopr >= 99 ? 'n/a' : k.fx(sh.RFopr, 3)}`] },
      { id: 'Service III', key: 'inventory', bars: [bar(sv.RF)], lab: ['Service III', sv.RF >= 99 ? 'n/a (net compression)' : k.fx(sv.RF, 3)] },
      ...(R.vehRatings || []).map(v => ({ id: v.name, key: v.gov, bars: [bar(v.RF)], lab: [v.name, v.RF >= 99 ? 'n/a' : `${k.fx(v.RF, 3)} (${v.gov})`] }))];
    const gov = Math.min(rt.RFinv, sh.RFinv, sv.RF >= 99 ? 99 : sv.RF);
    const slot = el.querySelector('#gfx_rt');
    if (slot && VA() && VA().mount) VA().mount(slot, { key: 'rt', title: 'Load rating factors (LRFR)', sub: 'HL-93 design load and the entered vehicles; RF ≥ 1.0 (bars capped at 4.0)',
      controls: VK().tiles([{ label: 'Flexure inv', value: ev('rating.RFinv', 3), unit: `opr ${k.fx(rt.RFopr, 3)}`, tone: rt.okInv ? 'c' : 't' }, { label: 'Shear inv', value: sh.RFinv >= 99 ? '—' : ev('shrRating.RFinv', 3), unit: `opr ${sh.RFopr >= 99 ? '—' : k.fx(sh.RFopr, 3)}`, tone: sh.okInv ? '' : 't' },
        { label: 'Service III', value: sv.RF >= 99 ? '—' : ev('svcRating.RF', 3), unit: sv.RF >= 99 ? 'no LL tension' : `x = ${k.fx(sv.x, 1)} ft`, tone: sv.ok ? '' : 't' }, (() => { const A = AL() ? AL().of(R) : null, g = A && A.inv ? A.inv.inv : gov; return { label: 'Governing (inventory)', value: g >= 99 ? '—' : k.fx(g, 3), unit: A && A.inv ? 'every station (card along the girder)' : 'lowest of the three', tone: g < 1 ? 't' : '' }; })(),
        { label: 'φ<sub>c</sub>φ<sub>s</sub>', value: ev('rating.phiCS', 3), unit: rt.phiCSfloor ? 'floored' : '' }, { label: 'Vehicles', value: String((R.vehRatings || []).length), unit: 'entered' }]),
      draw: W => VA().hbars({ aria: 'Rating factors', panels: [{ label: 'Rating factor (inventory, then operating)', unit: 'RF', limit: { v: 1, label: '1.0' }, items }] }, W),
      hint: 'Point at (or tap) a bar for its value.',
      caption: '<p class="vk-cap">The engine\'s rating factors (cards below). Red below 1.0, amber 1.0 to 1.1, green above. Display only.</p>' });
    const s2 = el.querySelector('#gfx_rtx');
    if (s2 && VK() && VK().detCard) VK().detCard(s2, { id: 'rtXFig', title: 'Rated sections along the span', sub: 'elevation, depth exaggerated',
      draw: W => ({ html: xFig(R, W), nar: W < 560 }), hint: 'Point at (or tap) a section line for its rating.',
      cap: '<p class="vk-cap">Where each HL-93 rating is taken: the flexure station with the lowest inventory RF, the governing shear section, the governing Service III bottom-tension section. Display only.</p>' });
  }
  window.PSBUiRating = { output, after, TOPICS, govRows };
})();
