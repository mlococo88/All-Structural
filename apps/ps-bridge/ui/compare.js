/* apps/ps-bridge/ui/compare.js — the Compare output tab (window.PSBUiCompare): the old app's "Design Comparison Sweep" (O:8009-8034), the full
   design of the girder type and line shown re-run over a range of spans, girder sections or girder spacings, everything else held as
   entered; per candidate the governing ratios of the core checks (engine/compare.js, the old app's sweepDesign on the page's engine call)
   in the Steel Bridge app's formats: a bar graphic of the governing D/C against 1.0 (PSBVizAlong.hbars, ratio colours) and a table.
   Created 2026-11-15 (batch G4). Classic script; display only: nothing is saved but the "Vary" choice (ui.cmpMode, the page's psb2.ui);
   the result lives in this page view's memory and is marked out of date when the inputs change.
     output(ctx) -> HTML; after(el, ctx) mounts the graphic and wires Run; onOutChange(e, ui). ctx = { P, inp, R, W, ui, redraw } */
(function () {
  'use strict';
  const K = () => window.PSBOutKit, VA = () => window.PSBVizAlong, C = () => window.PSBCompare;
  const S = { key: '', mode: '', rows: null, fit: null, ms: 0, err: '' };
  const modeOf = ui => (C().MODES.some(m => m[0] === (ui && ui.cmpMode)) ? ui.cmpMode : 'span');
  const keyOf = (ctx, mode) => JSON.stringify([ctx.inp, mode]);
  const cls = r => (!(r <= 1.0001) ? 'ng' : r >= 0.9 ? 'hi' : 'ok');
  const label = (mode, v) => (mode === 'girder' ? String(v) : K().fx(+v, mode === 'span' ? 1 : 2) + ' ft');
  const isCur = (ctx, mode, v) => (mode === 'span' ? Math.abs(v - ctx.inp.L) < 1e-9 : mode === 'girder' ? v === ctx.inp.girder : Math.abs(v - ctx.inp.S) < 1e-9);
  /* fitErrs(ctx, v): girder sweep only: the input check's strand-fit errors (PS-28 / PS-33 / PS-39: rows and draped strands) of the type
     shown with section v (the page's PSBInputCheck.collect, as engine/autodesign.js fitErrors); [] when the strands fit */
  function fitErrs(ctx, v) {
    const P = ctx.P, BR = window.PSBBridge, IC = window.PSBInputCheck; if (!IC) return [];
    const sh = BR && BR.hasTypes(P) ? BR.shown(P) : null, b = JSON.parse(JSON.stringify(sh ? BR.effBase(P, sh.k) : P.base)); b.girder = v;
    const Pv = Object.assign({}, P, { base: b, types: undefined, design: sh ? { g: sh.g, s: sh.s } : P.design });
    try { return IC.collect(Pv).errors.filter(x => /^base\.(rows|harp)(\.|$)/.test(x.path)).map(x => x.msg); } catch (e) { return []; }
  }
  function runNow(ctx) {
    const mode = modeOf(ctx.ui), t0 = Date.now(); S.err = '';
    try { const vals = C().presets(ctx.inp, mode); S.rows = C().run(ctx.inp, mode, vals); S.fit = mode === 'girder' ? vals.map(v => fitErrs(ctx, v)) : null; }
    catch (e) { S.rows = null; S.err = e.message; }
    S.key = keyOf(ctx, mode); S.mode = mode; S.ms = Date.now() - t0;
  }
  function output(ctx) {
    const k = K(), mode = modeOf(ctx.ui), M = C().MODES, vals = C().presets(ctx.inp, mode);
    const what = mode === 'span' ? 'spans' : mode === 'girder' ? 'girder sections' : 'girder spacings';
    let h = k.card('Design comparison sweep', `<div class="fRow"><label for="o_cmpMode">Vary</label><select id="o_cmpMode">${M.map(([v, t]) => `<option value="${v}"${v === mode ? ' selected' : ''}>${t}</option>`).join('')}</select>
      <button type="button" class="btn pri" id="cmpRun">Run sweep</button><span class="note" id="cmpBusy" hidden>Running…</span></div>
      <p class="note">Re-runs the whole design of the girder type shown over ${vals.length} ${what} (${mode === 'girder' ? 'every section of the library but Custom' : vals.map(v => label(mode, v)).join(', ')}), holding every other input as entered, and lists the governing demand / capacity of each: a preliminary sizing and type study, as the old app's Compare tab. The deck and handling checks are not in the governing ratio (the old app's rule).${mode === 'spacing' ? ' Spacing: the girders at equal bays of that spacing (the rigid-section factor of unequal bays is not used).' : ''}${mode === 'girder' ? ' The strand rows and draped strands are kept as entered: the Strand fit column gives the input check of each section (a section they do not fit is computed but not a usable design).' : ''}</p>
      <p class="note">Each candidate is computed by this app's engine call, the one behind every result tab (with the PS-10 hold-down check, the type (f) / (g) distribution factors and the rigid section where they apply), so its ratios match what the result tabs would show for it.</p>`, 'card-cmp');
    if (!S.rows && !S.err) return h + '<p class="note" id="cmpNone">Choose what to vary and click Run sweep.</p>';
    if (S.err) return h + `<div class="alert err" role="alert">The sweep stopped: ${k.esc(S.err)}</div>`;
    const stale = S.key !== keyOf(ctx, mode);
    if (stale) h += `<div class="alert" id="cmpStale">${S.mode !== mode ? `The results below vary the ${k.esc((M.find(m => m[0] === S.mode) || [, ''])[1].toLowerCase())}, not the ${k.esc((M.find(m => m[0] === mode) || [, ''])[1].toLowerCase())}.` : 'The inputs have changed since this sweep.'} Run the sweep again for the inputs as they are now.</div>`;
    const md = S.mode, fx = (v, d) => k.fx(v, d), nOk = S.rows.filter((r, i) => !r.error && r.pass && !(S.fit && S.fit[i].length)).length;
    h += K().gcard('Compare graphic: governing D/C of each candidate', 'gfx_cmp');
    const head = `<th class="lft">${md === 'span' ? 'Span<br>ft' : md === 'girder' ? 'Girder section' : 'Spacing<br>ft'}</th><th>Flexure</th><th>Service III<br>tension</th><th>Release<br>compression</th><th>Shear</th><th>Max D/C</th><th class="lft">Governing check</th><th>Camber<br>in</th><th>Checks</th>${S.fit ? '<th class="lft">Strand fit</th>' : ''}<th>Status</th>`;
    const rows = S.rows.map((r, i) => { const cur = isCur(ctx, md, r.v), f = S.fit ? S.fit[i] : null, nm = `${k.esc(label(md, r.v))}${cur ? ' <b>(this design)</b>' : ''}`;
      const fitC = f ? `<td class="lft${f.length ? ' ngt' : ''}"${f.length ? ` title="${k.esc(f.join(' '))}"` : ''}>${f.length ? `${f.length} error${f.length > 1 ? 's' : ''}` : 'fits'}</td>` : '';
      if (r.error) return `<tr class="ng"><td class="lft">${nm}</td><td colspan="8" class="lft">The engine could not compute it: ${k.esc(r.error)}</td>${fitC}<td class="ngt">—</td></tr>`;
      const c = (v, d) => `<td${cls(v) === 'ng' ? ' class="ngt"' : cls(v) === 'hi' ? ' style="color:var(--warn);font-weight:600"' : ''}>${fx(v, d)}</td>`, okAll = r.pass && !(f && f.length);
      return `<tr${cur ? ' class="sel"' : !okAll ? ' class="ng"' : ''}><td class="lft">${nm}</td>${c(r.flex, 2)}${c(r.s3, 2)}${c(r.rel, 2)}${c(r.shear, 2)}<td><b>${fx(r.maxDC, 2)}</b></td><td class="lft">${k.esc(r.gov)}</td><td>${fx(r.camber, 2)}</td><td>${r.nPass}/${r.nTot}</td>${fitC}<td class="${okAll ? 'ok' : 'ngt'}">${okAll ? 'PASS' : 'FAIL'}</td></tr>`; }).join('');
    h += k.card(`Results: varying the ${k.esc((M.find(m => m[0] === md) || [, ''])[1].toLowerCase())} (${S.rows.length} candidates, ${nOk} pass)`, `<div class="tscroll"><table class="tbl" id="cmpTbl"><thead><tr>${head}</tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Ratios are demand / capacity (≤ 1.00 passes; amber 0.90 to 1.00, red above 1.00), the engine's checks of the same names (Flexure, Srv III tens, Release comp, Shear; <a href="#" data-gotab="flex">Flexure</a>, <a href="#" data-gotab="str">Stresses</a>, <a href="#" data-gotab="shear">Shear</a> tabs, where each is worked for the design shown). Max D/C: the largest ratio of the core checks (every check but deck, lifting, hauling and the handling factors of safety), named in "Governing check". Camber: the engine's final camber (Camber &amp; deflection tab). Checks: core checks passing / core checks. A candidate is worked only when it is the design: to see one in full, enter it and the result tabs show it (Undo puts the design back). Computed in ${S.ms} ms.</p>`, 'card-cmpres');
    return h;
  }
  function after(el, ctx) {
    const b = el.querySelector('#cmpRun'); if (b) b.addEventListener('click', () => { const busy = el.querySelector('#cmpBusy'); if (busy) busy.hidden = false; b.disabled = true;
      setTimeout(() => { runNow(ctx); if (ctx.redraw) ctx.redraw(); }, 30); });
    const slot = el.querySelector('#gfx_cmp'); if (!slot || !S.rows || !VA() || !VA().mount) return;
    const k = K(), md = S.mode;
    const items = S.rows.map((r, i) => ({ id: label(md, r.v), key: 'c' + i, bars: r.error ? [{ v: 0, cls: 'na', text: 'error' }] : [{ v: Math.min(r.maxDC, 3), cls: cls(r.maxDC), text: k.fx(r.maxDC, 2) }],
      lab: [`${label(md, r.v)}${isCur(ctx, md, r.v) ? ' (this design)' : ''}${r.error ? '' : ': ' + r.gov}`, r.error ? 'error' : k.fx(r.maxDC, 3)] }));
    VA().mount(slot, { key: 'cmp', title: 'Governing D/C of each candidate', sub: `varying the ${k.esc((C().MODES.find(m => m[0] === md) || [, ''])[1].toLowerCase())}; bars capped at 3.0`,
      draw: W => VA().hbars({ aria: 'Governing demand / capacity of each candidate of the sweep', panels: [{ label: 'Max D/C of the core checks', unit: 'D/C', limit: { v: 1, label: '1.0' }, items }] }, W),
      hint: 'Point at (or tap) a bar for its value.', legend: VA().legend('ratio'),
      caption: '<p class="vk-cap">The largest demand / capacity ratio of the core checks of each candidate (the table below). Display only.</p>' });
  }
  function onOutChange(e, ui) { if (e.target.id === 'o_cmpMode') { ui.cmpMode = e.target.value; return true; } return false; }
  window.PSBUiCompare = { output, after, onOutChange, runNow, state: S };
})();
