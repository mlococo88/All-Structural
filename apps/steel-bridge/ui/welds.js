/* apps/steel-bridge/ui/welds.js — the "Welds" output tab (window.SBDWeldsUI): flange-to-web fillet welds (FW1–FW4, AASHTO LRFD 10th Ed.
   6.13.3, 6.13.5.3, 6.6.1.2) and shop flange transitions (TR1–TR4, 6.13.6.2, 6.6.1.2) of the selected girder, from engine/welds.js.
   Classic script; needs SharedSteps, SharedUnits, SBDModel, SBDOwners, SBDSections, SBDShear, SBDAnalysis, SBDWelds.

   Inputs (saved in the project, P.welds, on this tab as on the Rating tab): electrode F_EXX, fillet weld size (blank: the minimum of
   Table 6.13.3.4-1 at each location), the load factors (Strength I γ_DC, γ_DW, γ_LL; Fatigue I γ) and whether the butt welds of the
   shop transitions are ground flush (Category B) or not (Category C).
   Demands: this app's analysis of the girder (engine/analysis.js): the shears on each side of every support and plate change, the
   fatigue shear range and the fatigue moments; plates, deck (b_eff of this girder; both deck reinforcement layers) and materials of
   the project; field splices from the Framing tab (no shop transition there). Section properties: engine/sections.js (shown in the work).
   Demand source (added 2026-10-30, paths PR; as the Rating tab): "This project's analysis" (the default) or a hand-off file (schema
   stgirder-external-demands, GirderDetail → ST-Girder: engine/welds.js demandsFromPayload: its station shears, fatigue moments, plates,
   deck, materials, owner factors and splice stations; the electrode, weld size, load factors and grinding entered here); the line at the
   top of the tab names the source in use. The choice is not saved.

   render(host, ctx), ctx = { P, g, changed() }; build(ctx) (tests, the Report tab): ctx = { P, g, src: 'analysis' | 'file', pl, plName }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const fmt = (x, d) => window.SharedUnits.fmt(x, d);
  const S = { src: null, pl: null, plName: '', R: null, key: '', err: '', sel: null };   // src null: the default, this project's analysis (no example here)
  const srcOf = () => S.src || 'analysis';
  const cls = r => Number.isNaN(r) || r === Infinity ? 'fx-ng' : !isFinite(r) ? '' : r > 1 + 1e-9 ? 'fx-ng' : r >= 0.9 ? 'fx-hi' : 'fx-ok';
  const rt3 = v => Number.isNaN(v) ? 'error: ratio is NaN' : v === Infinity ? '∞' : v == null ? '—' : fmt(v, 3);
  const frac = x => { if (!(x > 0)) return '—'; const w = Math.floor(x + 1e-9), f = Math.round((x - w) * 16); if (!f) return `${w}`; let a = f, b = 16; while (a % 2 === 0) { a /= 2; b /= 2; } return w ? `${w} ${a}/${b}` : `${a}/${b}`; };

  function ensure(P) { if (!P.welds) P.welds = window.SBDModel.defaultWelds(); return P.welds; }

  /* input(P, gi): the module input of girder gi from this app's analysis (engine/welds.js fromDemands) and the owner factors env */
  function input(P, gi, pl) {
    const AN = window.SBDAnalysis, WT = window.SBDWelds, OWN = window.SBDOwners, M = window.SBDModel, Wd = ensure(P);
    if (pl) {   // a hand-off file: its demands, plates, deck, materials and owner factors; the inputs of this tab (P.welds)
      const d = WT.demandsFromPayload(pl), gen = { ...d.gen, Fexx: Wd.Fexx, gam: { ...Wd.gam } }, gd = pl.girderDetail || {};
      const p = WT.fromDemands(d.D, { gen, w: Wd.w, ground: Wd.ground });
      return { p, env: { lf: d.env.lf }, an: null, g: { id: gd.label || `G${gd.girder || ''}`, label: gd.label || `G${gd.girder || ''}` }, file: true };
    }
    if (!AN) return { err: 'The analysis module is not loaded.' };
    if (P.deck && P.deck.composite === false) return { err: 'The flange-to-web weld checks here are for a composite girder (DC2, DW and LL+IM on the composite sections). This girder is noncomposite.' };
    let R; try { R = AN.analyzeGirder(P, gi); } catch (e) { return { err: 'Analysis: ' + (e && e.message) }; }
    if (R.errors && R.errors.length) return { err: 'Analysis: ' + R.errors.join(' ') };
    if (!R.ll || !R.fat) return { err: 'Analysis: no live load results.' };
    // LL+IM with the pedestrian load added once (SBDAnalysis.llPL); PL: its part in the envelope taken (m not on it, GD45; sb-ped-owner PR)
    const g = P.girders[gi], st = R.st, ll = AN.llPL ? AN.llPL(R) : R.ll, q = R.pl, f = R.fat, abs = a => Array.from(a, v => Math.abs(v)), zero = R.x.map(() => 0);
    const side = s => { const Vp = ll['V' + s + 'pos'], Vn = ll['V' + s + 'neg'], big = i => Math.abs(Vp[i]) >= Math.abs(Vn[i]);
      return { DC1: abs(st.DC1['V' + s]), DC2: abs(st.DC2['V' + s]), DW: abs(st.DW['V' + s]), UT: st.UT ? abs(st.UT['V' + s]) : zero, UF: st.UF ? abs(st.UF['V' + s]) : zero,
        LL: Vp.map((v, i) => Math.max(Math.abs(v), Math.abs(Vn[i]))), F: f['V' + s + 'pos'].map((v, i) => v - f['V' + s + 'neg'][i]),
        ...(q ? { PL: Vp.map((_, i) => Math.abs(big(i) ? q['V' + s + 'pos'][i] : q['V' + s + 'neg'][i])) } : {}) }; };
    const segAt = x => { const s = g.segments.find(q => x >= q.x0 - 1e-9 && x < q.x1) || g.segments[g.segments.length - 1]; return { D: s.D, tw: s.tw, topB: s.topB, topT: s.topT, botB: s.botB, botT: s.botT }; };
    const fr = P.framing || {}, d = P.deck, m = P.materials, rb = d.rebar || {}, T = rb.top || { A: 0, c: 0 }, B = rb.bot || { A: 0, c: 0 }, Ar = (+T.A || 0) + (+B.A || 0);
    const layers = [[+T.A || 0, +T.c || 0], [+B.A || 0, d.ts - (+B.c || 0)]];
    const D = { x: R.x, sup: R.sup, segAt, segs: g.segments, V: { L: side('L'), R: side('R') }, PL: q ? true : undefined, MfP: Array.from(f.Mpos), MfN: Array.from(f.Mneg), splices: Array.isArray(fr.splices) ? fr.splices : [], tol: +fr.tol >= 0 ? +fr.tol : 0.5 };
    const gen = { gF: m.steel.top, gW: m.steel.web, Fexx: Wd.Fexx, gam: { ...Wd.gam }, ts: d.ts, hh: d.haunch, beff: g.beff, fc: m.concrete.fc, wc: m.concrete.wcE > 0 ? m.concrete.wcE : m.concrete.wc, K1: m.concrete.K1, nRule: m.concrete.nRule,
      Ar, dr: Ar > 0 ? layers.reduce((s, q) => s + q[0] * q[1], 0) / Ar : 0, layers };
    const p = WT.fromDemands(D, { gen, w: Wd.w, ground: Wd.ground });
    const own = P.ownerRules || { owner: 'AASHTO', eta: {} }, lf = OWN ? OWN.loadFactors(own.owner, own.eta, (P.xs && P.xs.nb) || 0) : { eta: 1, etaN: 1, m: 1, h0: false };
    return { p, env: { lf }, an: R, g };
  }
  function build(ctx) {
    const P = ctx.P, gi = ctx.g || 0, WT = window.SBDWelds, src = ctx.src || (ctx.pl ? 'file' : srcOf()), pl = src === 'file' ? (ctx.pl !== undefined ? ctx.pl : S.pl) : null, plName = ctx.plName != null ? ctx.plName : S.plName;
    if (src === 'file' && !pl) return { err: 'Choose a hand-off file (GirderDetail → ST-Girder demands, .json).' };
    const I = input(P, gi, pl); if (I.err) return I;
    const R = WT.compute(I.p, I.env); if (R.errors.length) return { err: 'Welds: ' + R.errors.join(' ') };
    const C = WT.checks(R), gov = {}; C.forEach(c => { const it = c.items[c.gov]; if (it) gov[c.id] = it; });
    const what = pl ? `${esc(plName || 'Hand-off file')}: ${(pl.stations || []).length} stations, G${esc((pl.girderDetail || {}).girder || '')}; shears, fatigue moments, plates, deck, materials, owner factors and field splice stations from the file; F<sub>EXX</sub>, weld size, load factors and grinding as entered here.`
      : `This project's analysis of ${esc(I.g.label || I.g.id)} (Analysis tab); plates, deck and materials of the project; field splices from the Framing tab.`;
    return { R, C, gov, g: I.g, lf: I.env.lf, src, what };
  }
  const key = ctx => JSON.stringify([ctx.P, ctx.g, srcOf(), S.plName]);

  function css() {
    if (document.getElementById('fx-css') || document.getElementById('fa-css') || document.getElementById('wt-css')) return;
    const st = document.createElement('style'); st.id = 'wt-css';
    st.textContent = `.fx-ok{background:#e7f4ec;} .fx-hi{background:#fdf3d8;} .fx-ng{background:#fbe1dd;font-weight:600;} .fx-list{max-height:320px;overflow:auto;} .fx-list tr{cursor:pointer;} .fx-na{color:#64748b;font-style:italic;}`;
    document.head.appendChild(st);
  }
  const stepLi = s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps.line(s, true)}</div>${s.note ? `<div class="nt">${esc(s.note)}</div>` : ''}</li>`;
  const A = '10th Ed. Art. ', OPEN = new Set(), TPX = (...ks) => ks.map(k => window.SBDFlexureUI.TP[k]).filter(Boolean);

  /* ---------- topics of the worked steps (presentation spec A, 2026-10-31; as ui/shear.js): flange-to-web welds, then the shop flange transitions ---------- */
  const TOPICS = { x: () => [...TPX('own', 'n', 'steel', 'c3', 'cn', 'cr'),
    { key: 'geo', title: 'Flange centroids above the bottom of the steel', ref: '', ids: /^wf\d+\.(yTf|yBf)$/ },
    { key: 'flow', title: 'Factored shear flow at the flange-to-web junction', ref: A + '6.13.3.4', ids: /^wf\d+\.(t\d+\.|vuT$|vuB$)/, res: /\.vuT$/ },
    { key: 'wmin', title: 'Minimum fillet weld size', ref: A + '6.13.3.4', ids: /^wf\d+\.wmin/ },
    { key: 'res', title: 'Factored weld resistance', ref: A + '6.13.3.2.4b', ids: /^wf\d+\.(Rw|Rweb)$/, res: /\.Rw$/ },
    { key: 'ffat', title: 'Fatigue shear stress range on the weld', ref: A + '6.6.1.2, 6.10.5.3', ids: /^wf\d+\.fat/ },
    { key: 'fok', title: 'Check: weld metal and web base metal (FW1, FW2)', ref: A + '6.13.3.2.4b', ids: /^wf\d+\.ok/ },
    { key: 'tfat', title: 'Fatigue at the butt splice (TR1)', ref: A + '6.6.1.2', ids: /^wt\d+\.(y|fp|fn|df|fat)$/, res: /\.fat$/ },
    { key: 'tsl', title: 'Thickness and width transitions (TR2, TR3)', ref: A + '6.13.6.2', ids: /^wt\d+\.(slT|slW)$/ },
    { key: 'tpr', title: 'Area and thickness proportions (TR4)', ref: A + '6.13.6.2', ids: /^wt\d+\.(pa|pt)$/ }] };
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind || 'x'](), { strip: false });
  const stepsHtml = (list, kind) => window.SharedSteps.groupsHTML(groups(kind, list), { open: OPEN, item: stepLi });
  const stCell = (st, r) => `<td class="${st === 'fail' ? 'fx-ng' : st === 'warn' ? 'fx-hi' : st === 'na' ? 'fx-na' : r != null ? cls(r) : 'fx-ok'}">${r != null && isFinite(r) ? fmt(r, 3) : { pass: 'OK', fail: 'Fail', warn: 'Warning', na: 'n/a' }[st] || esc(st)}</td>`;

  function render(host, ctx) {
    css();
    const P = ctx.P, Wd = ensure(P), stale = !S.R || S.key !== key(ctx), opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${t}</option>`;
    const nIn = (id, lbl, v, unit) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="number" step="any" id="${id}" value="${esc(v)}"><span class="unit">${unit}</span></div>`;
    const AUI = window.SBDAnalysisUI, AN = window.SBDAnalysis, gl = P.girders[ctx.g] || P.girders[0] || {};
    let h = (AUI && AUI.srcBar ? AUI.srcBar({ src: srcOf(), auto: !S.src, rd: AN && AN.ready ? AN.ready(P, P.girders[ctx.g] ? ctx.g : 0) : null, g: gl.label || gl.id, plName: S.plName }) : '')
      + `<section class="sec"><div class="secHead">Welds: inputs (saved in the project)</div><div class="secBody">
      <div class="fRow"><label for="wt_src">Demands</label><select id="wt_src">${opt('analysis', "This project's analysis (Analysis tab)", srcOf())}${opt('file', 'Hand-off file (GirderDetail → ST-Girder)', srcOf())}</select></div>
      ${srcOf() === 'file' ? `<div class="fRow"><label for="wt_file">File</label><input type="file" id="wt_file" accept=".json,application/json"><span class="unit">${esc(S.plName)}</span></div>` : ''}
      ${nIn('wt_Fexx', 'Electrode F<sub>EXX</sub>', Wd.Fexx, 'ksi')}
      <div class="fRow"><label for="wt_w">Flange-to-web fillet weld size</label><select id="wt_w">${opt('', 'Minimum of Table 6.13.3.4-1 at each location', Wd.w)}${[0.25, 0.3125, 0.375, 0.4375, 0.5, 0.5625, 0.625].map(v => opt(v, `${frac(v)} in`, Wd.w)).join('')}</select></div>
      ${nIn('wt_dc', 'γ<sub>DC</sub> (Strength I)', Wd.gam.dc, '')}${nIn('wt_dw', 'γ<sub>DW</sub> (Strength I)', Wd.gam.dw, '')}${nIn('wt_ll', 'γ<sub>LL</sub> (Strength I)', Wd.gam.ll, '')}${nIn('wt_fat', 'γ Fatigue I', Wd.gam.fat, '')}
      <div class="fRow"><label for="wt_gr">Shop transition butt welds</label><select id="wt_gr">${opt('yes', 'Ground flush (Category B)', Wd.ground)}${opt('no', 'Reinforcement not removed (Category C)', Wd.ground)}</select></div>
      <p class="note">Two fillet welds per flange. The demand choice is not saved. Demands from this project's analysis (Analysis tab) of the selected girder, or from the hand-off file: each side of every support and plate change; DC1 and utilities on the steel, DC2 and DW on the long-term (3n), LL+IM and the fatigue shear range on the short-term (n) composite section; owner factors η and m from the Loads tab. Shop transitions: every flange change that is not a field splice (Framing tab), tapered 1:2.5. Stiffener and connection-plate welds: Shear &amp; stiffeners tab.</p></div></section>`;
    h += `<div class="alert stale"${stale ? '' : ' hidden'}><span>Weld results are out of date: inputs changed or nothing calculated yet.</span><button type="button" class="primary" id="wt_calc">Calculate</button></div>`;
    if (S.err && !stale) h += `<div class="alert err">${esc(S.err)}</div>`;
    else if (S.R && !stale) h += results(S.R);
    host.innerHTML = h;
    window.SharedSteps.wire(host, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    const on = (id, ev, fn) => { const el = host.querySelector('#' + id); if (el) el.addEventListener(ev, fn); }, redraw = () => render(host, ctx), save = () => { if (ctx.changed) ctx.changed(); else redraw(); };
    const num = v => v === '' ? NaN : Number(v);
    on('wt_Fexx', 'change', e => { Wd.Fexx = num(e.target.value); save(); });
    on('wt_w', 'change', e => { Wd.w = e.target.value === '' ? '' : Number(e.target.value); save(); });
    ['dc', 'dw', 'll', 'fat'].forEach(k => on('wt_' + k, 'change', e => { Wd.gam[k] = num(e.target.value); save(); }));
    on('wt_gr', 'change', e => { Wd.ground = e.target.value; save(); });
    on('wt_src', 'change', e => { S.src = e.target.value; redraw(); });
    on('wt_file', 'change', e => { const f = e.target.files[0]; if (!f) return; const rd = new FileReader();
      rd.onload = () => { try { const j = JSON.parse(String(rd.result)), pl = j.payload || j; if (!pl || pl._schema !== 'stgirder-external-demands' || !Array.isArray(pl.stations)) throw new Error('not a GirderDetail → ST-Girder hand-off file (schema stgirder-external-demands)');
        S.pl = pl; S.plName = f.name; S.err = ''; } catch (er) { S.pl = null; S.plName = ''; alert('Cannot read this file: ' + er.message); } redraw(); };
      rd.readAsText(f); });
    on('wt_calc', 'click', () => { S.err = ''; S.R = null; try { const R = build(ctx); if (R.err) S.err = R.err; else { S.R = R; S.sel = defaultSel(R); } } catch (er) { S.err = 'Calculation error: ' + (er && er.message); } S.key = key(ctx); redraw(); });
    host.querySelectorAll('[data-wt]').forEach(tr => tr.addEventListener('click', () => { const [k, i] = tr.dataset.wt.split(':'); S.sel = { k, i: +i }; redraw(); const t = host.querySelector('#wt-steps'); if (t) t.scrollIntoView({ block: 'start' }); }));
    if (S.R && !stale && !S.err && window.SBDTabGfxBUI) window.SBDTabGfxBUI.welds(host, ctx, S.R, S.sel, v => { S.sel = v; redraw(); });   // the graphics (ui/tabgraphics-b.js): a click selects the same row
  }
  function defaultSel(R) {
    let b = null; R.C.forEach(c => c.items.forEach(it => { const r = typeof it.r === 'number' ? it.r : null; if (r == null || !it.step) return; if (!b || r > b.r) b = { r, step: it.step }; }));
    if (!b) return R.R.fw.length ? { k: 'fw', i: 0 } : { k: 'tr', i: 0 };
    const m = /^w([ft])(\d+)\./.exec(b.step); return { k: m[1] === 'f' ? 'fw' : 'tr', i: +m[2] };
  }
  function results(B) {
    const R = B.R, C = B.C, ck = id => C.find(c => c.id === id) || { items: [] }, WT = window.SBDWelds;
    const govRows = C.filter(c => c.items.length && c.gov >= 0).map(c => { const it = c.items[c.gov]; return `<tr><td class="lft">${esc(c.id)} ${esc(c.title)}</td><td class="lft">${esc(it.loc)}</td>${stCell(it.st, typeof it.r === 'number' ? it.r : null)}<td class="lft" style="font-size:8.5pt">${esc(c.ref)}</td></tr>`; }).join('');
    let h = `<section class="sec"><div class="secHead">Welds: governing, ${esc(B.g.label || B.g.id)}</div><div class="secBody">
      <p class="note">${B.what || ''}</p><p class="note">n = ${fmt(R.MR.n, 3)}; b<sub>eff</sub> = ${fmt(R.dk.beff, 2)} in; F<sub>u</sub> of the web ${fmt(R.Fuw, 0)} ksi; γ<sub>DC</sub> ${fmt(R.g.dc, 3)}, γ<sub>DW</sub> ${fmt(R.g.dw, 3)}, γ<sub>LL</sub> ${fmt(R.g.ll, 3)}${R.env.eta !== 1 || R.env.m !== 1 ? ` (× η ${fmt(R.env.eta, 3)}${R.env.m !== 1 ? `, m ${fmt(R.env.m, 2)}` : ''})` : ''}, γ<sub>fat</sub> ${fmt(R.g.fat, 2)}${R.env.h0 ? '; haunch 0 in the composite properties (owner rule)' : ''}.</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Check</th><th class="lft">Governing location</th><th>Ratio</th><th class="lft">Reference</th></tr></thead><tbody>${govRows}</tbody></table></div>
      ${C.filter(c => !c.items.length).map(c => `<p class="note">${esc(c.id)} ${esc(c.title)}: ${esc(c.naWhy)}</p>`).join('')}</div></section>`;
    h += `<section class="sec"><div class="secHead">Welds: graphics</div><div class="secBody"><div data-gfxb="welds"></div><div data-gfxb="weld-detail"></div></div></section>`;   // drawn by ui/tabgraphics-b.js from the results below
    h += `<section class="sec"><div class="secHead">Flange-to-web welds (FW1–FW4): ${R.fw.length} locations</div><div class="secBody"><p class="note">Click a row for its work.</p>
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Location</th><th>w (in)</th><th>v<sub>u</sub> top / bottom (kip/in)</th><th>R<sub>r</sub> (kip/in)</th><th>FW1</th><th>FW2</th><th>FW3</th><th>FW4</th></tr></thead><tbody>
      ${R.fw.map((r, i) => { const f1 = ck('FW1').items.slice(2 * i, 2 * i + 2), f2 = ck('FW2').items[i], f3 = ck('FW3').items.filter(it => it.step && it.step.startsWith(`wf${r.i}.`)), f4 = ck('FW4').items.slice(2 * i, 2 * i + 2), mx = a => a.reduce((s, it) => it.r > s ? it.r : s, -Infinity);
        return `<tr data-wt="fw:${r.i}" class="${S.sel && S.sel.k === 'fw' && S.sel.i === r.i ? 'sel' : ''}"><td class="lft">${esc(r.name)}</td><td>${frac(r.w)}</td><td>${fmt(r.vuT, 3)} / ${fmt(r.vuB, 3)}</td><td>${fmt(r.Rw, 3)}</td><td class="${cls(mx(f1))}">${rt3(mx(f1))}</td><td class="${cls(f2.r)}">${rt3(f2.r)}</td>${f3.length ? `<td class="${cls(mx(f3))}">${rt3(mx(f3))}</td>` : '<td class="fx-na">n/a</td>'}${stCell(f4.some(it => it.st === 'fail') ? 'fail' : 'pass', mx(f4))}</tr>`; }).join('')}
      </tbody></table></div></div></section>`;
    if (R.tr.length) h += `<section class="sec"><div class="secHead">Shop flange transitions (TR1–TR4): ${R.tr.length}</div><div class="secBody">
      <div class="tscroll fx-list"><table class="tbl"><thead><tr><th class="lft">Transition</th><th>Plates</th><th>Cat.</th><th>γ(Δf) (ksi)</th><th>TR1</th><th>TR2</th><th>TR3</th><th>TR4</th></tr></thead><tbody>
      ${R.tr.map(r => { const s = `wt${r.i}.`, f = id => ck(id).items.filter(it => it.step && it.step.startsWith(s)), t1 = f('TR1')[0], t2 = f('TR2')[0], t3 = f('TR3')[0], t4 = f('TR4');
        return `<tr data-wt="tr:${r.i}" class="${S.sel && S.sel.k === 'tr' && S.sel.i === r.i ? 'sel' : ''}"><td class="lft">${esc(r.name)}</td><td>${fmt(r.b1, 2)} × ${frac(r.t1)} to ${fmt(r.b2, 2)} × ${frac(r.t2)}</td><td>${r.cat}</td><td>${fmt(r.df, 2)}</td><td class="${cls(t1.r)}">${rt3(t1.r)}</td>${t2 ? `<td class="${cls(t2.r)}">${rt3(t2.r)}</td>` : '<td class="fx-na">n/a</td>'}${t3 ? stCell(t3.st, t3.r) : '<td class="fx-na">n/a</td>'}${stCell(t4.some(it => it.st === 'warn') ? 'warn' : 'pass')}</tr>`; }).join('')}
      </tbody></table></div><p class="note">TR1 is the butt splice in the smaller flange at mid-thickness; the Fatigue tab also checks the flange face at each shop transition (FA1, Category B, Fatigue I or II).</p></div></section>`;
    const sel = S.sel || { k: 'fw', i: 0 }, list = (sel.k === 'fw' ? R.fw : R.tr).find(r => r.i === sel.i);
    if (list) h += `<section class="sec" id="wt-steps"><div class="secHead">Worked steps, ${esc(list.name)}</div><div class="secBody"><p class="note">AASHTO LRFD 10th Ed. (2024). The section properties used come first; y is measured up from the bottom of the steel.</p>${stepsHtml(WT.steps(R, sel.k, sel.i))}</div></section>`;
    return h;
  }

  window.SBDWeldsUI = { ensure, input, build, render, TOPICS, groups };
})();
