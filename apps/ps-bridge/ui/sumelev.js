/* apps/ps-bridge/ui/sumelev.js — the Summary tab's girder elevation, one per girder type (window.PSBSumElev). Classic script; display only:
   nothing here feeds a result. Created 2026-11-14 (PS Bridge catch-up to the Steel Bridge app, item 8a; the engineer's choice, corrected the
   same day: ONE ELEVATION PER GIRDER TYPE, chosen with a picker; the Steel Bridge app's Summary elevation, apps/steel-bridge/ui/alonggfx.js
   summarySpec / summarySvg, is the reference: the governing check of each group marked where it governs).

   model(M, P, k) (no DOM; tests/engine/psbridge-sumelev.test.mjs): girder type k of the Summary model M (ui/summary.js model()) on its
   governing line (the line of the type's largest check ratio over its groups) in its span; every number is the engine's (R of that cell,
   PSBDesign.cellInputs of it):
     the girder from ℄ bearing to ℄ bearing (and past it by opt.endOh), depth h (vertical scale exaggerated);
     the strand profile: each straight row at its y (debonded lengths dashed, R.ss.rows dbnd), the draped strands from y_end at ℄ bearing to
       y_mid at the hold-down points frac × L from each ℄ bearing (PS-13), the hold-down points;
     transfer length ℓ_t (R.ss.lt) from each end of the bonded strands (and from each debond point), development lengths ℓ_d of the bonded
       strands (R.ldBonded, κ = 1.6) from the ends and of the debonded strands (R.ldDebond, κ = 2.0) from their debond points;
     the governing check of each group of the type (M.types[k].groups: the worst over its lines, the line named) at its station x
       (check loc), coloured by its ratio, each linking to its tab and worked step with that type and line (data-sumgo, the Summary's links);
       the groups with no station (the owner's input limits) listed under the figure.
   svg(m, W) -> { svg, nar }; html(M, o) -> the card (picker + slot); after(el, M, o) draws it. The type chosen: STATE.k (the page session). */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toFixed(d == null ? 2 : d) : '—';
  const fin = v => typeof v === 'number' && isFinite(v);
  const BAR = '#8A5A44', DRP = '#B45309', DB = '#DC6B2F', LT = '#0F766E', LD = '#7C3AED';
  const RC = { ok: ['#DCEFE4', '#2F6E4E'], hi: ['#FBEBC5', '#8A5A0B'], ng: ['#F7D3CD', '#A3322A'] };
  const cls = (r, pass) => pass === false || !(r <= 1 + 1e-9) ? 'ng' : r >= 0.9 ? 'hi' : 'ok';
  const STATE = { k: null };

  function model(M, P, k) {
    const T = M && M.types.find(q => q.k === k); if (!T) return { errors: ['No girder type.'] };
    const zs = Object.values(T.groups); if (!zs.length) return { errors: [`${T.label}: no check result.`] };
    const top = zs.reduce((b, z) => !b || z.q.r > b.q.r ? z : b, null), g = top.g, cell = T.lines.find(z => z.c.g === g);
    const R = cell && cell.c.R; if (!R || R.error) return { errors: [`${T.label} on G${g}: no result.`] };
    const inp = window.PSBDesign.cellInputs(P, k, g), L = +R.L, oh = (+((inp.opt && inp.opt.endOh) || 0)) / 12, ss = R.ss;
    const marks = [], other = [];
    zs.forEach(z => { const it = { name: z.gp.name, check: z.q.n, r: z.q.r, pass: z.q.pass, v: z.q.v, lim: z.q.lim, u: z.q.u || '', x: z.q.loc, g: z.g, tab: z.gp.tab,
        go: `${z.k}|${z.g}|${z.gp.tab}|${z.st}|${z.gp.input ? 1 : ''}`, cls: cls(z.q.r, z.q.pass), gov: z === top };
      if (!z.gp.input && fin(z.q.loc) && z.q.loc >= -oh - 1e-6 && z.q.loc <= L + oh + 1e-6) marks.push(it); else other.push(it); });
    marks.sort((a, b) => a.x - b.x);
    const rows = ss.rows.map(r => ({ y: +r.y, n: +r.n, nd: +r.nd || 0, dbnd: +r.dbnd || 0 }));
    const db = [...new Set(rows.filter(r => r.nd > 0 && r.dbnd > 0).map(r => r.dbnd))].sort((a, b) => a - b);
    return { errors: [], k, label: T.label, span: T.span, g, L, oh, h: +R.g.h, girder: inp.girder, rows, nh: +ss.nh || 0, hp: ss.nh > 0 ? { frac: +ss.hp.frac, a: +ss.hp.frac * L, yEnd: +ss.hp.yEnd, yMid: +ss.hp.yMid } : null,
      lt: +ss.lt / 12, ldB: +R.ldBonded / 12, ldD: +R.ldDebond / 12, db, marks, other, top, n: { N: ss.Ntot, Nbond: ss.Nbond, Ndebond: ss.Ndebond } };
  }

  function svg(m, W) {
    const V = window.PSBVizKit, S = V.scene(), nar = W < 560, sz = nar ? 9.5 : 10.5, L = m.L, H = 0.16 * L, Y = y => y / m.h * H, r2 = v => +(+v).toFixed(2);
    const x0 = -Math.max(m.oh, 0), x1 = L + Math.max(m.oh, 0);
    S.rect(x0, 0, x1, H, 'dt-cc');
    S.region(x0, 0, x1, H, `${m.label} on G${m.g}, span ${m.span}: ${m.girder}, h = ${f2(m.h, 1)} in, L = ${f2(L, 2)} ft (℄ bearing to ℄ bearing)`);
    [0, L].forEach(x => { S.line(x, -0.03 * L, x, H + 0.02 * L, 'dt-cl'); S.poly([[x, 0], [x - 0.012 * L, -0.03 * L], [x + 0.012 * L, -0.03 * L]], 'dt-brg'); });
    // strands: straight rows (debonded lengths dashed), draped strands, hold-down points
    m.rows.forEach(r => { S.line(x0, Y(r.y), x1, Y(r.y), 'dt-ol', { stroke: BAR, sw: 1.3 });
      if (r.nd > 0 && r.dbnd > 0) [[x0, r.dbnd], [L - r.dbnd, x1]].forEach(([a, b]) => S.line(a, Y(r.y), b, Y(r.y), 'dt-hid', { stroke: DB, sw: 2.4, dash: '5 3' }));
      S.region(0, Y(r.y) - 0.008 * L, L, Y(r.y) + 0.008 * L, `${r.n} straight strands at y = ${f2(r.y, 2)} in${r.nd ? `; ${r.nd} debonded ${f2(r.dbnd, 2)} ft from each end` : ''}`); });
    if (m.hp) { const a = m.hp.a, ye = Y(m.hp.yEnd), ym = Y(m.hp.yMid), sl = (ym - ye) / a;
      S.pline([[x0, ye + sl * x0], [0, ye], [a, ym], [L - a, ym], [L, ye], [x1, ye - sl * (x1 - L)]], 'dt-ol', { stroke: DRP, sw: 2 });
      [a, L - a].forEach(x => S.dot(x, ym, 4, 'dt-bolt'));
      S.region(0, ym - 0.01 * L, L, ye + 0.01 * L, `${m.nh} draped strands: y_end = ${f2(m.hp.yEnd, 2)} in at ℄ bearing, y_mid = ${f2(m.hp.yMid, 2)} in; hold-down points ${f2(a, 2)} ft (${f2(m.hp.frac, 3)} L) from each ℄ bearing`); }
    // the lengths under the girder: ℓ_t and ℓ_d of the bonded strands from each end; of the debonded strands from each debond point
    const bars = [{ a: 0, len: m.lt, col: LT, t: `ℓ_t = ${f2(m.lt * 12, 1)} in`, tip: 'Transfer length of the bonded strands (5.9.4.3.1)' },
      { a: 0, len: m.ldB, col: LD, t: `ℓ_d = ${f2(m.ldB, 2)} ft`, tip: 'Development length of the bonded strands, κ = 1.6 (5.9.4.3.2)' }];
    m.db.forEach(d => bars.push({ a: d, len: m.lt, col: LT, t: `ℓ_t from ${f2(d, 2)} ft`, tip: `Transfer length of the strands debonded ${f2(d, 2)} ft` }, { a: d, len: m.ldD, col: LD, t: `ℓ_d (debonded, κ = 2.0) = ${f2(m.ldD, 2)} ft`, tip: `Development length of the strands debonded ${f2(d, 2)} ft, κ = 2.0 (5.9.4.3.3)` }));
    bars.forEach((b, i) => S.raw(T => { const yy = T.Y(0) + 26 + i * 15, out = [];
      [[b.a, b.a + b.len], [L - b.a - b.len, L - b.a]].forEach(([p, q], j) => { const X0 = T.X(p), X1 = T.X(q);
        out.push(`<line x1="${r2(X0)}" y1="${r2(yy)}" x2="${r2(X1)}" y2="${r2(yy)}" stroke="${b.col}" stroke-width="3"/><line x1="${r2(X0)}" y1="${r2(yy - 4)}" x2="${r2(X0)}" y2="${r2(yy + 4)}" stroke="${b.col}"/><line x1="${r2(X1)}" y1="${r2(yy - 4)}" x2="${r2(X1)}" y2="${r2(yy + 4)}" stroke="${b.col}"/>`,
          `<rect x="${r2(X0)}" y="${r2(yy - 6)}" width="${r2(Math.max(8, X1 - X0))}" height="12" class="dt-reg" fill="transparent" data-dtr="${esc(`${b.tip}: ${b.t.replace('ℓ_', 'ℓ')}`)}"/>`);
        if (j === 0) out.push(`<text x="${r2(X1 + 5)}" y="${r2(yy + sz * 0.35)}" class="dt-t halo" style="font-size:${sz}px" fill="${b.col}">${V.st(b.t)}</text>`); });
      return out.join(''); }, T => [[T.X(0), T.Y(0) + 20 + i * 15], [T.X(L), T.Y(0) + 32 + i * 15]]));
    // the governing check of each group at its station: a marker and a flag (rows so that no two overlap), each linking to its tab
    S.raw(T => { const out = [], rowsEnd = [], yT = T.Y(H);
      m.marks.forEach(q => { const px = T.X(q.x), t = `${q.name} ${f2(q.r, 3)}`, w = V.TW(t, sz) + 12; let row = 0; while (rowsEnd[row] != null && rowsEnd[row] > px - w / 2 - 4) row++; rowsEnd[row] = px + w / 2;
        const ty = yT - 16 - row * 21, c = RC[q.cls];
        out.push(`<line x1="${r2(px)}" y1="${r2(ty + 5)}" x2="${r2(px)}" y2="${r2(T.Y(0))}" stroke="${c[1]}" stroke-width="${q.gov ? 1.8 : 1}" stroke-dasharray="${q.gov ? '' : '3 2'}"/>`,
          `<g class="se-mark" data-sumgo="${esc(q.go)}" style="cursor:pointer"><rect x="${r2(px - w / 2)}" y="${r2(ty - 12)}" width="${r2(w)}" height="17" rx="8" fill="${c[0]}" stroke="${c[1]}" stroke-width="${q.gov ? 2 : 1}"/>`
          + `<text x="${r2(px)}" y="${r2(ty + 0.5)}" text-anchor="middle" style="font-size:${sz}px" fill="${c[1]}"${q.gov ? ' font-weight="700"' : ''}>${esc(t)}</text>`
          + `<rect x="${r2(px - w / 2)}" y="${r2(ty - 12)}" width="${r2(w)}" height="17" class="dt-reg" fill="transparent" data-dtr="${esc(`${q.name}: ${q.check} at x = ${f2(q.x, 2)} ft on G${q.g}: ${f2(q.v, 3)} vs ${f2(q.lim, 3)} ${q.u}, ratio ${f2(q.r, 3)} (${q.pass ? 'PASS' : 'FAIL'}); click: its tab`)}"/></g>`); });
      return out.join(''); }, T => { const ends = [], yT = T.Y(H); let rows = 1; m.marks.forEach(q => { const px = T.X(q.x), w = V.TW(`${q.name} ${f2(q.r, 3)}`, sz) + 12; let row = 0; while (ends[row] != null && ends[row] > px - w / 2 - 4) row++; ends[row] = px + w / 2; rows = Math.max(rows, row + 1); });
      const xs = m.marks.map(q => T.X(q.x)), wmax = Math.max(0, ...m.marks.map(q => V.TW(`${q.name} ${f2(q.r, 3)}`, sz) + 12)) / 2;
      return [[Math.min(T.X(x0), ...xs.map(x => x - wmax)), yT - 16 - (rows - 1) * 21 - 14], [Math.max(T.X(x1), ...xs.map(x => x + wmax)), yT]]; });
    // dimensions: the span and the hold-down points
    const yd = -0.03 * L, nb = 26 + bars.length * 15;
    if (m.hp) S.dimH(0, m.hp.a, yd, -(nb + 6), `${f2(m.hp.a, 2)} ft (${f2(m.hp.frac, 3)} L) to the hold-down`, { sz });
    S.dimH(0, L, yd, -(nb + (m.hp ? 30 : 6)), `L = ${f2(L, 2)} ft (℄ bearing to ℄ bearing)`, { sz });
    S.dimV(0, H, x1, 12, `h = ${f2(m.h, 1)} in`, { sz });
    const r = S.render({ W, maxH: nar ? 360 : 420, label: `Girder elevation, ${m.label} on G${m.g}, span ${m.span}: strand profile, transfer and development lengths, the governing check of each group (vertical scale exaggerated)` });
    return { svg: r.svg, nar };
  }
  /* the default type: that of the Summary's governing check (M.top), else the first */
  const defK = M => { const t = M.top && M.types.find(T => Object.values(T.groups).some(z => z.q === M.top.c)); return t ? t.k : M.types[0] ? M.types[0].k : null; };
  function html(M, o) {
    if (typeof window === 'undefined' || !window.PSBVizKit || !M || !M.types.length) return '';
    if (STATE.k == null || !M.types.some(T => T.k === STATE.k)) STATE.k = defK(M);
    return `<section class="sec" id="sum-elev"><div class="secHead">Girder elevation of each girder type</div><div class="secBody">
      <div class="fRow"><label for="sumElevK">Girder type</label><select id="sumElevK" data-sumelev style="width:auto">${M.types.map(T => `<option value="${T.k}"${T.k === STATE.k ? ' selected' : ''}>${esc(T.label)} (span ${T.span})</option>`).join('')}</select></div>
      <div id="gfx_sumelev"></div></div></section>`;
  }
  function after(el, M, o) {
    const slot = el && el.querySelector('#gfx_sumelev'), V = window.PSBVizKit; if (!slot || !V || !M) return;
    const m = model(M, o.P, STATE.k);
    if (m.errors.length) { slot.innerHTML = `<p class="note">${esc(m.errors.join(' '))}</p>`; return; }
    const tab = q => `<a href="#" data-sumgo="${esc(q.go)}" title="Its tab and worked step with ${esc(m.label)} on G${q.g}">${esc(q.name)}</a>`;
    const list = m.marks.map(q => `<li>${tab(q)}: ${esc(q.check)} at x = ${f2(q.x, 2)} ft on G${q.g}, ratio <b class="se-${q.cls}">${f2(q.r, 3)}</b> (${q.pass ? 'PASS' : 'FAIL'})</li>`).join('')
      + m.other.map(q => `<li>${tab(q)}: ${esc(q.check)}${q.g ? ` on G${q.g}` : ''}, ratio <b class="se-${q.cls}">${f2(q.r, 3)}</b> (${q.pass ? 'PASS' : 'FAIL'}; no station)</li>`).join('');
    V.detCard(slot, { id: 'sumElevFig', title: `${esc(m.label)} on G${m.g} (its governing line), span ${m.span}`, sub: `${esc(m.girder)}: ${m.n.N} strands (${m.n.Nbond} straight${m.n.Ndebond ? `, ${m.n.Ndebond} debonded` : ''}${m.nh ? `, ${m.nh} draped` : ''})`,
      draw: W => { const q = svg(m, W); return { html: q.svg, nar: q.nar }; }, hint: 'Point at a check, a strand row, a length or the girder to read it; click a check for its tab.',
      cap: `<p class="vk-cap">Vertical scale exaggerated. Strands: straight rows brown (debonded lengths dashed orange)${m.nh ? ', draped orange with the hold-down points' : ''}. Under the girder: transfer length ℓ<sub>t</sub> (teal) and development length ℓ<sub>d</sub> (violet) from each end of the bonded strands${m.db.length ? ' and from each debond point (κ = 2.0)' : ''}. Above: the governing check of each group of ${esc(m.label)} (the worst over its lines, the line named) where it governs; green below 0.90, amber 0.90 to 1.00, red above 1.00; the type's governing check outlined. Strands and lengths: <a href="#" data-gotab="sec">Section properties</a>, <a href="#" data-gotab="shear">Shear</a> (ℓ<sub>d</sub>), <a href="#" data-gotab="end">End zone &amp; hold-down</a>; inputs: <a href="#" data-goin="gird">Girders &amp; strands tab</a>.</p><ul class="note se-list">${list}</ul>` });
  }
  function onChange(el) { if (!el || !el.matches || !el.matches('[data-sumelev]')) return false; STATE.k = +el.value; return true; }
  window.PSBSumElev = { model, svg, html, after, onChange, STATE };
})();
