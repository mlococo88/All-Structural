#!/usr/bin/env node
// Light Pole and Sign Post: the Loading tab in sub-tabs that follow the load path (LPLS, 2026-11-23). Display / organisation only.
// Headless Chromium, file://, KaTeX served from tests/libs. Per case (1400 px; the default pole and the default sign also at 390 px):
//   - every sub-tab that applies renders (button shown, pane on, a summary table, no KaTeX error); a sub-tab that does not apply is
//     hidden (Cables: sign, or no cables; Ice: t = 0);
//   - the load-path strip is shown, highlights the step of the sub-tab and navigates (loads → Wind, shaft → Forces at the base,
//     post / base plate / soil → the Post, Anchorage and Shaft tabs);
//   - the per-source rows sum to the totals: Σ γ × rows = the engine's V, N, M (T) of every combination and direction (in the page,
//     the same functions as tests/engine/lightpole-sources.test.mjs), the "Factors × rows" tables end with ✓, and in the shown table
//     each Σ row is the sum of its rows (to the rounding of the shown values);
//   - the back links on the Post, Anchorage and Shaft tabs open the Forces at the base / Combinations sub-tab; a link to a card that
//     moved (wind direction study, behind "show all directions") opens its sub-tab and the switch;
//   - the free-body sketch is drawn on Forces at the base;
//   - the chosen sub-tab and the switch are per-browser keys with the tool's prefix (lpp_loadSub_v1, lpp_loadAllDirs_v1) and are not
//     in the saved project state;
//   - the Report's Loading chapter has the seven sections in order, every § reference resolves and the earlier anchors still do;
//   - no horizontal page scroll at 390 px on any sub-tab; no console / page errors.
//   node tests/smoke/lightpole-loading-subtabs.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const LP = path.join(REPO, 'Light Pole and Sign Post.html');
const args = process.argv.slice(2), shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const CASES = {
  default: {},
  sign1: { top: { appMode: 'sign', signPosts: 1 } },
  sign2: { inputs: { V: '130', shaftShape: 'square', signB: '16', signS: '5' }, top: { appMode: 'sign', signPosts: 2 } },
  nocable_noice: { inputs: { tIce: '0' }, top: { cablesEnabled: false } },
  proj_arms: { inputs: { shaftProj: '2', tIce: '1.0' }, fixtures: [{ hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70, armD: 3.5 }, { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40 }] },
  signrect: { inputs: { poleShape: 'rect', poleDiaTop: '6', poleDepthTop: '12', poleTwTop: '0.25', signB: '3', signS: '1.5', signClr: '30', V: '130', shaftProj: '1.5' }, top: { appMode: 'sign', signPosts: 1 } },
};
const ORDER = ['Basis', 'Dead load', 'Wind', 'Ice', 'Cables', 'Forces at the base', 'Combinations'];
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
if (shots) fs.mkdirSync(shots, { recursive: true });
for (const vw of [1400, 390]) for (const [name, mut] of Object.entries(CASES)) {
  if (vw === 390 && !['default', 'sign1'].includes(name)) continue;
  console.log(`== ${name} @ ${vw} px`);
  const o = await openPage(LP, { vw, vh: vw > 600 ? 900 : 844 });
  try {
    await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 20000 });
    await o.p.evaluate(m => { const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, m.inputs || {}); Object.assign(st, m.top || {});
      if (m.cables) st.cables = m.cables; if (m.fixtures) st.fixtures = m.fixtures; applyState(st); switchTab('loading', true); }, mut);
    await o.p.waitForTimeout(600);
    const r = await o.p.evaluate(async () => {
      const L = LPP_LD, sign = L.mode === 'sign', out = { sign, subs: {}, hidden: [], scroll: {} };
      const vis = e => !!(e && e.offsetParent);
      out.def = document.querySelector('#lppLdBar button.on').dataset.ldsub;
      for (const [k] of LPP_LD_SUBS) {
        const b = document.querySelector(`#lppLdBar button[data-ldsub="${k}"]`);
        if (!vis(b)) { out.hidden.push(k); continue; }
        b.click(); await new Promise(r => setTimeout(r, 60));
        const p = document.querySelector('.lppLdPane.on'), first = p && [...p.querySelectorAll('.card')].find(vis);
        out.subs[k] = { pane: p && p.dataset.ldpane, tables: p ? [...p.querySelectorAll('table')].filter(vis).length : 0, text: p ? p.innerText.length : 0,
          kerr: p ? p.querySelectorAll('.katex-error').length : 0, firstTbl: !!(first && first.querySelector('table')), firstId: first && first.id,
          strip: [...document.querySelectorAll('#lppLdStrip .lppLdNode.on')].map(n => n.dataset.ldgo).join(','), stripN: document.querySelectorAll('#lppLdStrip .lppLdNode').length,
          stored: localStorage.getItem('lpp_loadSub_v1') };
        out.scroll[k] = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      }
      // sums: Σ γ × rows = engine, every combination and direction
      const Q = ['Vx', 'Vy', 'N', 'Mx', 'My', 'T'], near = (a, b, s) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(s === undefined ? b : s));
      let n = 0, bad = [];
      if (!sign) L.allCombos.forEach(r => r.dirs.forEach(dr => { const rows = lppSrcPole(L.inp, L.comps, L.fxs, L.pw, dr.phi), c = lppSrcComb(lppSrcTot(rows), dr.factors, lppSrcPull(dr));
        const e = { Vx: dr.Vx, Vy: dr.Vy, N: dr.axial, Mx: dr.Mx, My: dr.My, T: dr.Tz }; n++;
        Q.forEach(q => { if (!near(c[q], e[q], q[0] === 'M' || q === 'T' ? Math.max(1, dr.M) : q === 'N' ? dr.axial : Math.max(1, dr.P))) bad.push(r.name + '@' + dr.phi + ' ' + q); }); }));
      else L.allCombos.forEach(r => r.dirs.forEach(dr => dr.posts.forEach((pd, p) => { const rows = lppSrcSign(L.inp, L.sw, p, dr.phi, pd.edge ? 'A' : pd.case), c = lppSrcComb(lppSrcTot(rows), r.factors, null); n++;
        if (!(near(c.Vx, pd.P) && near(c.Mx, pd.M) && near(c.N, pd.axial) && near(c.T, pd.T, Math.max(1, pd.M)))) bad.push(r.name + '@' + dr.phi + ' P' + (p + 1)); })));
      out.sumN = n; out.sumBad = bad;
      // shown: the Factors × rows tables end with the engine row marked ✓, and their Σ row has the same shown numbers
      const num = t => { t = t.replace(/[,\s]/g, ''); return t === '—' || t === '' ? 0 : parseFloat(t); };
      out.fac = [...document.querySelectorAll('.lppLdFacTbl')].map(tb => { const R = [...tb.rows], e = R[R.length - 1], s = R[R.length - 2];
        return { ok: /✓/.test(e.cells[0].textContent), same: [...e.cells].slice(2).every((c, i) => c.textContent === s.cells[i + 2].textContent) }; });
      // shown: each Σ row of the Forces at the base table = the sum of the rows above it (rounded values: within 0.5 per row + 0.5)
      const tb = document.getElementById('lppLdBaseTbl'); out.baseSum = []; let acc = null, cnt = 0;
      [...tb.rows].slice(1).forEach(tr => { const v = [...tr.cells].slice(2).map(c => num(c.textContent));
        if (tr.classList.contains('lppLdRef')) return;
        if (tr.classList.contains('lppBmbTot')) { out.baseSum.push(v.every((x, i) => Math.abs(x - (acc ? acc[i] : 0)) <= 0.5 * cnt + 0.5)); acc = null; cnt = 0; }
        else { acc = acc ? acc.map((x, i) => x + v[i]) : v; cnt++; } });
      out.fbd = document.querySelectorAll('#lppLdBase .lppFbd svg').length; out.fbdTxt = document.querySelectorAll('#lppLdBase .lppFbd svg text').length;
      out.xfer = (document.querySelector('#lppLdBase .lppLdXfer') || {}).textContent || ''; out.p = L.sp ? L.sp.p : 0; out.tblB = !!document.getElementById('lppLdBaseTblB'); out.atTop = /top of the shaft/.test(document.querySelector('#lppLdBase .subhead2').textContent) && /top of the shaft/.test(document.querySelector('#lppLdCombo').textContent);
      { const gf = [...document.querySelectorAll('#lppLdBase details.lpFold')].find(d => /grade/.test(d.querySelector('summary').textContent)); out.gradeFold = !!gf && !gf.open; }
      // strip navigation
      const click = async sel => { const e = document.querySelector(sel); if (!e) return null; e.click(); await new Promise(r => setTimeout(r, 120)); return true; };
      const tab = () => document.querySelector('#tabBar button.on').dataset.tab, sub = () => (document.querySelector('.lppLdPane.on') || { dataset: {} }).dataset.ldpane;
      lppLdSet('basis', true);
      out.nav = {};
      await click('#lppLdStrip [data-ldgo="shaft"]'); out.nav.shaft = sub();
      await click('#lppLdStrip [data-ldgo="loads"]'); out.nav.loads = sub();
      for (const k of ['post', 'bp', 'soil']) { switchTab('loading', true); await click(`#lppLdStrip [data-ldgo="${k}"]`); out.nav[k] = tab(); }
      // back links on the Post / Anchorage / Shaft tabs
      out.back = {};
      for (const t of ['post', 'anchors', 'shaft']) for (const s of ['base', 'combos']) { switchTab(t, true); lppLdSet('basis', true);
        const ok = await click(`#page-${t} .lppLdBack a[data-lpsub="${s}"]`); out.back[t + '>' + s] = ok ? tab() + '/' + sub() : 'no link'; }
      // a link to a card behind the switch (pole: the wind direction study), and the switch itself
      switchTab('loading', true); lppLdDirs(false, true); lppLdSet('combos', true);
      const hiddenBefore = [...document.querySelectorAll('#lppLd .lppAllDirs')].every(e => !vis(e));
      if (!sign) { await click('#lppBaseRx a[data-lpgo="windDirLRFD"]'); out.dirLink = { sub: sub(), shown: vis(document.getElementById('windDirLRFD')) }; lppLdDirs(false, true); }
      lppLdSet('base', true); const chk = document.querySelector('.lppLdPane.on .lppLdDirChk'); chk.click(); await new Promise(r => setTimeout(r, 60));
      out.sw = { hiddenBefore, shown: [...document.querySelectorAll('.lppLdPane.on .lppAllDirs')].some(vis), key: localStorage.getItem('lpp_loadAllDirs_v1') };
      out.scrollAll = document.documentElement.scrollWidth - document.documentElement.clientWidth;
      chk.click();
      // storage: tool-prefixed keys only; nothing in the project state
      out.keys = Object.keys(localStorage).filter(k => /load/i.test(k)); out.inState = /loadSub|loadAllDirs|lppLd/.test(JSON.stringify(captureState()));
      // Report
      switchTab('report', true); await new Promise(r => setTimeout(r, 600));
      const M = lprModel(), d = SharedReport.build(M), ch = M.sections.find(s => s.title === 'Loading'), host = document.getElementById('lprHost');
      out.rep = { chapters: M.sections.map(s => s.title), subs: ch ? ch.subs.map(q => q.title) : [], unres: d.unresolved.map(x => x.key), dup: d.dup, kerr: host.querySelectorAll('.katex-error').length,
        refs: ['lp:rx', 'lp:basis', 'lp:dead', 'lp:wind', 'lp:src', 'lp:fac', sign ? 'lp:env:p1' : 'lp:env', sign ? 'lp:bmb:p1' : 'lp:bmb', 'lpcs:0', 'lpcs:1'].map(k => [k, SharedReport.ref(d, k)]),
        fig: host.querySelectorAll('.rp-fig svg').length, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      switchTab('loading', true); lppLdSet('base', true);
      return out;
    });
    const want = ['basis', 'dead', 'wind', 'ice', 'cables', 'base', 'combos'].filter(k => !r.hidden.includes(k));
    check(r.def === 'base', 'first visit opens "6 · Forces at the base": ' + r.def);
    const expHidden = [].concat(name === 'nocable_noice' ? ['ice'] : [], (r.sign || name === 'nocable_noice') ? ['cables'] : []);
    check(JSON.stringify(r.hidden.sort()) === JSON.stringify(expHidden.sort()), 'hidden sub-tabs: ' + (r.hidden.join(', ') || 'none') + ' (expected ' + (expHidden.join(', ') || 'none') + ')');
    for (const k of want) { const s = r.subs[k];
      check(s && s.pane === k && s.tables >= 1 && s.text > 150 && s.kerr === 0 && s.firstTbl && s.stripN === 5 && s.stored === k,
        `sub-tab ${k}: pane on, ${s && s.tables} table(s), first card ${s && s.firstId} starts with a table, strip [${s && s.strip}], remembered`); }
    check(r.subs.base.strip === 'shaft' && r.subs.combos.strip === 'shaft' && /loads/.test(r.subs.wind.strip) && r.subs.basis.strip === '', 'strip highlights the step of the sub-tab');
    check(r.sumN > 0 && r.sumBad.length === 0, `Σ γ × source rows = engine V, N, M, T for ${r.sumN} combination × direction${r.sign ? ' × post' : ''} records` + (r.sumBad.length ? ': ' + r.sumBad.slice(0, 5).join(' | ') : ''));
    check(r.fac.length >= 2 && r.fac.every(f => f.ok && f.same), `Factors × rows tables reconcile with the envelope (${r.fac.length} tables, ✓)`);
    check(r.baseSum.length >= 2 && r.baseSum.every(Boolean), `Forces at the base: each Σ row = the sum of its rows as shown (${r.baseSum.length} load cases)`);
    check(r.fbd >= 1 && r.fbdTxt >= 5, `free-body sketch drawn (${r.fbd} sketch(es), ${r.fbdTxt} labels)`);
    check(/sits directly on the top of the shaft/.test(r.xfer) && r.atTop && (r.p > 0 ? (r.gradeFold && (r.sign || r.tblB)) : !r.gradeFold), r.p > 0 ? 'forces stated at the top of the shaft; the move to grade (M + V·p) is a collapsed derivation' : 'forces stated at the top of the shaft; one line: no height between base plate and shaft top, p = 0');
    check(r.nav.shaft === 'base' && r.nav.loads === 'wind' && r.nav.post === 'post' && r.nav.bp === 'anchors' && r.nav.soil === 'shaft', 'strip navigates: ' + JSON.stringify(r.nav));
    check(['post', 'anchors', 'shaft'].every(t => r.back[t + '>base'] === 'loading/base' && r.back[t + '>combos'] === 'loading/combos'), 'Post / Anchorage / Shaft back links land on the sub-tab: ' + JSON.stringify(r.back));
    if (!r.sign) check(r.dirLink && r.dirLink.sub === 'wind' && r.dirLink.shown, '"by direction →" opens the Wind sub-tab and the all-directions block: ' + JSON.stringify(r.dirLink));
    check(r.sw.hiddenBefore && r.sw.shown && r.sw.key === '1', '"show all directions": hidden by default, shown by the switch, remembered (lpp_loadAllDirs_v1)');
    check(r.keys.every(k => /^lpp_/.test(k)) && !r.inState, 'UI keys carry the tool prefix (' + r.keys.join(', ') + '); not in the project state');
    // Report
    const idx = r.rep.subs.map(t => ORDER.findIndex(o => t === o || t.startsWith(o + ' — ') || t.startsWith(o + ' (')));
    check(idx.length > 0 && idx.every(i => i >= 0) && idx.every((v, i) => i === 0 || v >= idx[i - 1]), 'Report: the Loading chapter follows the seven sections in order (' + r.rep.subs.length + ' subsections)');
    check(want.filter(k => !(k === 'cables')).every(k => idx.includes(['basis', 'dead', 'wind', 'ice', 'cables', 'base', 'combos'].indexOf(k))), 'Report: every shown section is present');
    check(r.rep.unres.length === 0 && r.rep.dup.length === 0 && r.rep.refs.every(x => !!x[1]), 'Report: § references resolve, earlier anchors too ' + JSON.stringify(r.rep.unres) + ' ' + r.rep.refs.filter(x => !x[1]).map(x => x[0]).join(','));
    check(r.rep.kerr === 0 && r.rep.fig >= 1, 'Report: no KaTeX errors, the free-body sketch is in it');
    if (vw === 390) { check(Object.values(r.scroll).every(v => v <= 0) && r.scrollAll <= 0, 'no horizontal page scroll at 390 px on any sub-tab ' + JSON.stringify(r.scroll) + ' all-dirs ' + r.scrollAll);
      check(r.rep.scroll <= 0, 'Report: no horizontal page scroll at 390 px'); }
    if (shots) for (const k of want) { await o.p.evaluate(k => { lppLdSet(k, true); const c = document.querySelector('.col-out'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); }, k); await o.p.waitForTimeout(150);
      await o.p.screenshot({ path: path.join(shots, `lpls-${name}-${k}-${vw}.png`), fullPage: vw < 600 }); }
    check(o.errs.length === 0, 'no console / page errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
    if (o.blocked.size) console.log('  note: blocked requests: ' + [...o.blocked].join(', '));
  } finally { await o.b.close(); }
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
process.exit(fails ? 1 : 0);
