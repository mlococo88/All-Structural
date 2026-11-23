#!/usr/bin/env node
// Light Pole and Sign Post: the "All load combinations / Governing combination only" switch (LPCV, 2026-11-23). Display only.
// Headless Chromium, file://, KaTeX served from tests/libs. Per case (1400 px; the default pole and the default sign also at 390 px):
//   - first visit: "All load combinations" (no key stored, no note, every bar on "All"); the bars are first on the Loading, Post,
//     Anchorage, Shaft and Report tabs, and are not printed;
//   - the switch on one tab (the Post tab) changes every tab; the choice is the per-browser key lpp_comboView_v1, is not in the
//     project state, and survives a reload;
//   - governing view: the rows shown are the engine's governing records of every check (IBC pole / sign: largest M, pole / post check,
//     base plate, shaft P–M, shaft shear, embedment, soil bearing, per post; LRFDLTS: largest Extreme I moment, member check, base
//     plate, weld, Broms embedment, shaft moment / P–M / shear / torsion, deflection and slope), each named with what it governs, and
//     every number of a shown row is the number of that row in the "all" view;
//   - a note under each reduced table gives "n of N" and a "show all" link; the link brings back the "all" view, row for row;
//   - Summary, check panel, copy summary and the Anchorage hand-off payload are identical in both views;
//   - the Report in both views: every § reference resolves, no KaTeX error; in the governing view it states "Governing combinations
//     only; N combinations checked", in the "all" view it does not;
//   - every in-app link target exists in the governing view, and the Summary's link to the combination table opens it;
//   - no horizontal page scroll at 390 px on any tab in either view; no console / page errors.
//   node tests/smoke/lightpole-combo-view.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const LP = path.join(REPO, 'Light Pole and Sign Post.html');
const args = process.argv.slice(2), shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const CASES0 = {
  default: {},
  sign1: { top: { appMode: 'sign', signPosts: 1 } },
  sign2: { inputs: { V: '130', shaftShape: 'square', signB: '16', signS: '5' }, top: { appMode: 'sign', signPosts: 2 } },
  proj_arms: { inputs: { shaftProj: '2', tIce: '1.0' }, fixtures: [{ hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70, armD: 3.5 }, { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40 }] },
  signrect: { inputs: { poleShape: 'rect', poleDiaTop: '6', poleDepthTop: '12', poleTwTop: '0.25', signB: '3', signS: '1.5', signClr: '30', V: '130', shaftProj: '1.5' }, top: { appMode: 'sign', signPosts: 1 } },
  lts_pole: { inputs: { bromsSoil: 'cohesive' }, top: { codeMode: 'lts', cablesEnabled: false } },
  lts_pole_ice: { inputs: { bromsSoil: 'cohesionless', ltsIce: '0.5', shaftProj: '1' }, top: { codeMode: 'lts', cablesEnabled: false } },
  lts_sign2: { inputs: { bromsSoil: 'cohesive' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } },
};
const ONLY = process.env.LPCV_ONLY ? process.env.LPCV_ONLY.split(',') : null, CASES = ONLY ? Object.fromEntries(Object.entries(CASES0).filter(([k]) => ONLY.includes(k))) : CASES0;
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
if (shots) fs.mkdirSync(shots, { recursive: true });

// runs in the page: what is shown now (tables, notes, bars, fingerprints of what must not change)
const SNAP = () => {
  const vis = e => !!(e && e.offsetParent), lts = codeMode === 'lts', sign = appMode === 'sign';
  const txt = c => c.textContent.trim().replace(/\s+/g, ' ');
  const rowsOf = tb => tb ? [...tb.rows].slice(1).map(r => [...r.cells].map(txt)) : null;
  const o = { lts, sign, gov: lppCvGov, key: localStorage.getItem('lpp_comboView_v1'), tabs: {} };
  o.bars = [...document.querySelectorAll('.lppCvBar')].map(b => ({ tab: b.dataset.cvtab, page: b.parentElement.id, first: b.parentElement.firstElementChild === b,
    on: [...b.querySelectorAll('button.on')].map(x => x.dataset.cv).join(','), noprint: b.classList.contains('noprint'), info: b.querySelector('.lppCvInfo').textContent }));
  // IBC tables (hidden in the LRFDLTS mode, still rendered)
  o.tbl = {}; ['comboMatrixTbl', 'sgComboTbl', 'lppLdComboL', 'lppLdComboA', 'lppLdComboL_p2', 'lppLdComboA_p2'].forEach(id => { const r = rowsOf(document.getElementById(id)); if (r && r.length) o.tbl[id] = r; });
  if (lts) { const find = (id, n, h) => { const c = document.getElementById(id); return c ? [...c.querySelectorAll('table')].find(t => t.rows.length && t.rows[0].cells.length >= n && t.rows[0].cells[0].textContent.trim() === h) : null; };
    o.tbl.ltsBa = rowsOf(find('ltsWindCard', 9, 'Limit state')); o.tbl.ltsDfl = rowsOf(find('ltsDeflCard', 5, 'Service I load case')); }
  o.notes = [...document.querySelectorAll('.lppCvNote')].map(n => ({ card: (n.closest('.card') || {}).id, t: txt(n), link: !!n.querySelector('a.lppCvAll'), prevTbl: !!(n.previousElementSibling && n.previousElementSibling.querySelector && (n.previousElementSibling.tagName === 'TABLE' || n.previousElementSibling.querySelector('table'))) || n.parentElement.classList.contains('lppCvHost') }));
  // what must not change with the view
  const ns = h => h.replace(/ style=""/g, '');   // an empty style attribute left by a mode change is not content
  o.same = { summary: document.getElementById('page-summary').innerHTML, dash: document.getElementById('lppDash').innerHTML, copy: window.__summary,
    anch: JSON.stringify((x => { if (x && x.payload) delete x.payload.producedAt; return x; })(lppAnchorPayload())),
    post: (c => { c.querySelectorAll('.lppCvBar,.lppCvNote').forEach(x => x.remove()); return lts ? '' : ns(c.innerHTML); })(document.getElementById('page-post').cloneNode(true)),
    anchors: (c => { c.querySelectorAll('.lppCvBar').forEach(x => x.remove()); return ns(c.innerHTML); })(document.getElementById('page-anchors').cloneNode(true)),
    shaft: (c => { c.querySelectorAll('.lppCvBar').forEach(x => x.remove()); return ns(c.innerHTML); })(document.getElementById('page-shaft').cloneNode(true)) };
  // the engine's governing records
  const E = {};
  if (!lts || true) { const L = LPP_LD, C = LPP_SUMCTX;
    if (L && L.mode === 'pole') { const st = C.stacks[0], f = st.found, bp = (f.bolts.byCheck && f.bolts.byCheck.BP) || f.bolts;
      E.pole = { LRFD: { 'largest M': LPP_LAST.gov.govLRFD.name, 'Pole check': st.pstress.comboName, 'Base plate': bp.comboName, 'Shaft P–M': (f.reo.long.govDem || {}).name || L.use.shaft.name, 'Shaft shear': L.use.shear.name },
        ASD: { 'largest M': LPP_LAST.gov.govASD.name, 'Embedment': st.asd.name, 'Soil bearing': f.bearing.comboName } };
      E.poleUse = L.use; E.n = L.allCombos.length; }
    if (L && L.mode === 'sign') { E.sign = L.postDesigns.map(pd => { const F = pd.found, bp = (F.bolts && F.bolts.byCheck && F.bolts.byCheck.BP) || F.bolts || {};
        return { LRFD: { 'largest M': pd.gLRFD.name, 'Post check': pd.pstress.comboName, 'Base plate': bp.comboName, 'Shaft P–M': F.shaftCombo }, ASD: { 'largest M': pd.gASD.name, 'Embedment': (pd.gASDF || pd.gASD).name, 'Soil bearing': F.bearing.comboName } }; });
      E.edge = L.sw.edge ? ', ' + lppSignEdgeLbl(L.sw) : null; E.n = L.allCombos.length; } }
  if (lts && lppLtsLast && lppLtsLast.mc) { const X = lppLtsLast, k = r => r.name + ' | ' + r.lcName, fd = X.fd, R = {};
    const add = (r, t) => { if (!r) return; (R[k(r)] = R[k(r)] || []).push(t); };
    const row = q => X.ba.rows.find(r => r.combo === q.combo && r.lc === q.lc);
    const ext = X.ba.rows.filter(r => r.combo === 'E1max' || r.combo === 'E1min'); let g = ext[0]; ext.forEach(r => { if (r.M > g.M) g = r; }); add(g, 'largest Extreme I moment');
    add(row(X.mc.gov.gov), 'Member check'); add(row(X.bp.gov), 'Base plate'); if (X.wd.gov) add(row(X.wd.gov), 'Base weld');
    if (fd && fd.gov) { add(row(fd.gov.r), 'Embedment (Broms)'); add(row(fd.gm.r), 'Largest shaft moment');
      const gd = fd.reo.long.govDem; if (gd && gd.name) add(X.ba.rows.find(r => r.name + ', ' + r.lcName === gd.name), 'Shaft P–M');
      let v = null; fd.per.forEach(q => { const V = q.gl ? q.gl.VF : q.r.V; if (!v && V === fd.Vu) v = q.r; }); add(row(v), 'Shaft shear'); }
    if (fd && fd.Tu > 0) add(X.ba.rows.find(r => Math.abs(r.T) === fd.Tu), 'Shaft torsion');
    add(X.ba.rows.find(r => r.combo === 'SV1' && r.lc === X.dfl.gov.lc), 'Deflection'); add(X.ba.rows.find(r => r.combo === 'SV1' && r.lc === X.dfl.govS.lc), 'Slope at the top');
    E.lts = R; E.ltsN = X.ba.rows.length; E.dfl = [X.dfl.gov.lcName, X.dfl.govS.lcName]; E.dflN = X.dfl.rows.length; }
  o.E = E;
  // links: every in-app target exists
  o.badLinks = [...document.querySelectorAll('a[data-lpgo]')].filter(a => !document.getElementById(a.dataset.lpgo)).map(a => a.dataset.lpgo)
    .concat([...document.querySelectorAll('a.wkA[data-k]')].filter(a => { const t = lppTgt(a.dataset.k, a.dataset.st); return t && !document.getElementById(t.id); }).map(a => 'k:' + a.dataset.k + ':' + a.dataset.st));
  o.nLinks = document.querySelectorAll('a[data-lpgo],a.wkA[data-k]').length;
  return o;
};
// runs in the page: the Report of the current view
const REPORT = async () => {
  switchTab('report', true); await new Promise(r => setTimeout(r, 700));
  const lts = codeMode === 'lts', M = lts ? ltsReportModel() : lprModel(), d = SharedReport.build(M), host = document.getElementById(lts ? 'ltsRptHost' : 'lprHost');
  const kv = M.sections[0].subs[0].items[0].rows.find(r => /Load combinations shown/.test(r[0]));
  const tables = []; M.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'table') tables.push({ sub: q.title, key: q.key || '', n: it.rows.length, head: (it.head || []).join('|') }); })));
  const sign = appMode === 'sign';
  return { stmt: kv ? kv[1] : null, unres: d.unresolved.map(x => x.key), dup: d.dup, kerr: host.querySelectorAll('.katex-error').length, len: host.textContent.length,
    shown: /Governing combinations only; \d+ combinations checked/.test(host.textContent),
    refs: lts ? [] : ['lp:rx', 'lp:basis', 'lp:src', 'lp:fac', sign ? 'lp:env:p1' : 'lp:env', sign ? 'lp:bmb:p1' : 'lp:bmb', 'lpcs:0', 'lpcs:1'].map(k => [k, SharedReport.ref(d, k)]),
    tables, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};
// The LRFDLTS report has one reference that does not resolve on main (the fillet-weld step's "§J2" text is read as a step
// reference, lts.wd/J2). It is the same in both views and is not part of this change (raised in the fix log).
const KNOWN_UNRES = ['lts.wd/J2'], unresOK = r => r.unres.every(k => KNOWN_UNRES.includes(k));
const strip = s => s.replace(/ ◄.*$/, '').replace(/ — .*$/, '');
const sameSet = (a, b) => a.length === b.length && [...a].sort().join('¦') === [...b].sort().join('¦');

for (const vw of [1400, 390]) for (const [name, mut] of Object.entries(CASES)) {
  if (vw === 390 && !['default', 'sign1'].includes(name)) continue;
  console.log(`== ${name} @ ${vw} px`);
  const o = await openPage(LP, { vw, vh: vw > 600 ? 900 : 844, ...(shots ? { dsf: 2 } : {}) });
  try {
    const ready = () => o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 30000 });
    await ready();
    await o.p.evaluate(m => { const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, m.inputs || {}); Object.assign(st, m.top || {});
      if (m.cables) st.cables = m.cables; if (m.fixtures) st.fixtures = m.fixtures; applyState(st); switchTab('loading', true); lppLdSet('combos', true); }, mut);
    await o.p.waitForTimeout(600);
    // ---- 1. first visit: all
    const A = await o.p.evaluate(SNAP), RA = await o.p.evaluate(REPORT);
    check(A.gov === false && A.key === null && A.notes.length === 0 && A.bars.every(b => b.on === 'all'), 'first visit: "All load combinations" (no key stored, no note)');
    check(A.bars.length === 5 && sameSet(A.bars.map(b => b.tab), ['loading', 'post', 'anchors', 'shaft', 'report']) && A.bars.every(b => b.page === 'page-' + b.tab && b.first && b.noprint),
      'the switch is first on the Loading, Post, Anchorage, Shaft and Report tabs (not printed): ' + A.bars.map(b => b.tab).join(', '));
    check(RA.stmt === null && !RA.shown && (A.lts ? unresOK(RA) : RA.unres.length === 0) && RA.dup.length === 0 && RA.kerr === 0 && RA.refs.every(x => !!x[1]), `Report ("all"): no view statement, every § reference resolves (${RA.tables.length} tables)`);
    if (shots && ['default', 'sign1'].includes(name)) {
      await o.p.evaluate(() => { switchTab('loading', true); lppLdSet('combos', true); const c = document.querySelector('.col-out'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); if (innerWidth > 600) document.getElementById('lppLdCombo').querySelector('table').scrollIntoView({ block: 'start' }); }); await o.p.waitForTimeout(200);
      await o.p.screenshot({ path: path.join(shots, `lpcv-${name}-combos-all-${vw}.png`), fullPage: true });
      if (vw > 600) { await o.p.evaluate(() => { switchTab('post', true); const c = document.querySelector('.col-out'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); }); await o.p.waitForTimeout(200); await o.p.screenshot({ path: path.join(shots, `lpcv-${name}-post-all-${vw}.png`) }); }
    }
    // ---- 2. the switch on the Post tab changes every tab
    await o.p.evaluate(() => { switchTab('post', true); document.querySelector('#page-post .lppCvBar button[data-cv="gov"]').click(); });
    await o.p.waitForTimeout(700);
    await o.p.evaluate(() => { switchTab('loading', true); lppLdSet('combos', true); });
    const G = await o.p.evaluate(SNAP);
    check(G.gov === true && G.key === 'gov' && G.bars.every(b => b.on === 'gov'), 'the switch on the Post tab sets every tab to "Governing combination only" (lpp_comboView_v1 = gov)');
    const inState = await o.p.evaluate(() => /comboView|lppCv/.test(JSON.stringify(captureState())) || /comboView/.test(localStorage.getItem('lpp_session_v1') || ''));
    check(!inState && Object.keys(G).length > 0, 'the choice is not in the project state or the session');
    // ---- 3. governing rows = the engine's governing records; numbers as in the "all" view
    const allRow = (id, nm) => (A.tbl[id] || []).find(r => r[0] === nm);
    const numsSame = (id, gRows, keyCol, cols) => gRows.every(g => { const a = (A.tbl[id] || []).find(r => cols.key(r) === cols.key(g)); return a && cols.idx(g).every(i => g[i] === a[i]); });
    if (G.E.pole) {
      for (const [fam, id] of [['LRFD', 'lppLdComboL'], ['ASD', 'lppLdComboA']]) { const want = [...new Set(Object.values(G.E.pole[fam]))], got = G.tbl[id].map(r => r[0]);
        check(sameSet(got, want), `pole, ${fam}: rows shown = the engine's governing combinations [${want.join(' ; ')}]` + (sameSet(got, want) ? '' : ' got [' + got.join(' ; ') + ']'));
        const lab = G.tbl[id].every(r => { const u = Object.entries(G.E.pole[fam]).filter(([, n]) => n === r[0]).map(([k]) => k), cell = r[r.length - 1]; return u.length && u.every(k => cell.includes(k)) && cell.split(' · ').length === u.length; });
        check(lab, `pole, ${fam}: each row names exactly the checks it governs`);
        check(G.tbl[id].every(g => { const a = allRow(id, g[0]); return a && g.every((c, i) => c === a[i]); }), `pole, ${fam}: every cell of a shown row equals the "all" view`);
        check(A.tbl[id].length === (fam === 'LRFD' ? 6 : 5), `pole, ${fam}: the "all" view lists every combination (${A.tbl[id].length})`); }
      const want = [...new Set(Object.values(G.E.pole.LRFD).concat(Object.values(G.E.pole.ASD)))], got = G.tbl.comboMatrixTbl.map(r => strip(r[1]));
      check(sameSet(got, want) && A.tbl.comboMatrixTbl.length === G.E.n, `pole, envelope table: ${got.length} of ${G.E.n} rows = the governing combinations of every check`);
      check(G.tbl.comboMatrixTbl.every(g => { const a = A.tbl.comboMatrixTbl.find(r => strip(r[1]) === strip(g[1])); return a && g.every((c, i) => i === 1 || c === a[i]) && g[1].startsWith(a[1]); }), 'pole, envelope table: numbers and the "◄ governs" mark as in the "all" view; the label only adds the checks');
      check(G.tbl.comboMatrixTbl.every(g => /◄/.test(g[1])), 'pole, envelope table: every row shown is labelled');
    }
    if (G.E.sign) {
      const base = new Set();
      G.E.sign.forEach((P, p) => { for (const [fam, id0] of [['LRFD', 'lppLdComboL'], ['ASD', 'lppLdComboA']]) { const id = id0 + (p ? '_p' + (p + 1) : ''), want = [...new Set(Object.values(P[fam]))], got = (G.tbl[id] || []).map(r => r[0]);
        want.forEach(n => base.add(G.E.edge ? n.replace(G.E.edge, '') : n));
        check(sameSet(got, want), `sign post ${p + 1}, ${fam}: rows shown = the engine's governing combinations [${want.join(' ; ')}]` + (sameSet(got, want) ? '' : ' got [' + got.join(' ; ') + ']'));
        check((G.tbl[id] || []).every(r => { const u = Object.entries(P[fam]).filter(([, n]) => n === r[0]).map(([k]) => k), cell = r[r.length - 1]; return u.length && u.every(k => cell.includes(k)) && cell.split(' · ').length === u.length; }), `sign post ${p + 1}, ${fam}: each row names exactly the checks it governs`);
        check((G.tbl[id] || []).every(g => { const a = allRow(id, g[0]); return a && g.every((c, i) => c === a[i]); }), `sign post ${p + 1}, ${fam}: every cell of a shown row equals the "all" view`); } });
      const got = G.tbl.sgComboTbl.map(r => strip(r[1])), marked = A.tbl.sgComboTbl.filter(r => /◄/.test(r[1])).map(r => strip(r[1]));
      const want = [...new Set([...base].concat(marked))];
      check(sameSet(got, want) && A.tbl.sgComboTbl.length === G.E.n, `sign, per-post table: ${got.length} of ${G.E.n} rows = the governing combinations of every check and post` + (sameSet(got, want) ? '' : ' want [' + want.join(' ; ') + '] got [' + got.join(' ; ') + ']'));
      check(marked.every(m => base.has(m)), 'sign, per-post table: the row the table marks "◄ governs" is one of the engine\'s governing combinations');
      check(G.tbl.sgComboTbl.every(g => { const a = A.tbl.sgComboTbl.find(r => strip(r[1]) === strip(g[1])); return a && g.every((c, i) => i === 1 || c === a[i]) && g[1].startsWith(a[1]) && / — /.test(g[1]); }), 'sign, per-post table: numbers as in the "all" view; every row labelled');
    }
    if (G.E.lts) {
      const want = Object.keys(G.E.lts), got = G.tbl.ltsBa.map(r => r[0] + ' | ' + r[1]);
      check(sameSet(got, want) && A.tbl.ltsBa.length === G.E.ltsN, `LRFDLTS base actions: ${got.length} of ${G.E.ltsN} rows = the governing rows of every check` + (sameSet(got, want) ? '' : ' want [' + want.join(' ; ') + '] got [' + got.join(' ; ') + ']'));
      check(G.tbl.ltsBa.every(g => sameSet(g[g.length - 1].split('; '), G.E.lts[g[0] + ' | ' + g[1]] || [])), 'LRFDLTS base actions: each row names exactly the checks it governs: ' + G.tbl.ltsBa.map(g => g[g.length - 1]).join(' / '));
      check(G.tbl.ltsBa.every(g => { const a = A.tbl.ltsBa.find(r => r[0] === g[0] && r[1] === g[1]); return a && a.every((c, i) => c === g[i]); }), 'LRFDLTS base actions: every number of a shown row equals the "all" view');
      const wd = [...new Set(G.E.dfl)], gd = G.tbl.ltsDfl.map(r => r[0]);
      check(sameSet(gd, wd) && A.tbl.ltsDfl.length === G.E.dflN && G.tbl.ltsDfl.every(g => { const a = A.tbl.ltsDfl.find(r => r[0] === g[0]); return a && a.every((c, i) => c === g[i]) && /largest/.test(g[g.length - 1]); }),
        `LRFDLTS deflection: ${gd.length} of ${G.E.dflN} Service I load cases = the largest Δ and slope, numbers as in the "all" view`);
    }
    // ---- 4. notes under the reduced tables
    const visNotes = await o.p.evaluate(() => [...document.querySelectorAll('.lppCvNote')].filter(n => { let e = n; while (e && e !== document.body) { if (getComputedStyle(e).display === 'none' && !e.classList.contains('lppLdPane') && !e.classList.contains('tabpage')) return false; e = e.parentElement; } return true; }).length);
    const expNotes = (G.E.pole ? 3 : 0) + (G.E.sign ? 2 * G.E.sign.length + 1 : 0) + (G.E.lts ? 2 : 0);
    check(G.notes.length === expNotes && G.notes.every(n => n.link && /^Governing combinations only: (\d+ of \d+ .* shown; all \d+ were checked, the other \d+ are hidden|all \d+ .* shown)\. show all$/.test(n.t)),
      `${G.notes.length} reduced table(s), each with a one-line note ("n of N … shown; all N were checked …") and a "show all" link (${visNotes} in the shown mode)`);
    { const m = G.notes.map(n => /(\d+) of (\d+)/.exec(n.t)).filter(Boolean), tb = G.E.pole ? [G.tbl.lppLdComboL, G.tbl.lppLdComboA, G.tbl.comboMatrixTbl] : G.E.sign ? [].concat(...G.E.sign.map((P, p) => [G.tbl['lppLdComboL' + (p ? '_p2' : '')], G.tbl['lppLdComboA' + (p ? '_p2' : '')]]), [G.tbl.sgComboTbl]) : [];
      const tl = tb.concat(G.E.lts ? [G.tbl.ltsBa, G.tbl.ltsDfl] : []);
      check(m.length === tl.length && m.every((x, i) => +x[1] === tl[i].length), 'each note\'s count is the number of rows shown: ' + m.map(x => x[1] + '/' + x[2]).join(', ')); }
    // ---- 5. nothing else changes
    const diff = Object.keys(A.same).filter(k => A.same[k] !== G.same[k]);
    check(diff.length === 0, 'Summary (verdict, ratios), check panel, copy summary, Anchorage hand-off payload, Post / Anchorage / Shaft tab content: identical in both views' + (diff.length ? ' — differ: ' + diff.join(', ') : ''));
    check(G.badLinks.length === 0 && G.nLinks > 5, `every in-app link target exists in the governing view (${G.nLinks} links)` + (G.badLinks.length ? ': ' + G.badLinks.join(', ') : ''));
    if (!G.lts) { const lk = await o.p.evaluate(async () => { switchTab('summary', true); const a = document.querySelector('#page-summary a.wkA[data-k="combo"]'); if (!a) return null; a.click(); await new Promise(r => setTimeout(r, 300));
        const t = lppTgt('combo', 0), e = document.getElementById(t.id); return { tab: document.querySelector('#tabBar button.on').dataset.tab, vis: !!(e && e.offsetParent), rows: e ? e.rows.length - 1 : 0, gov: lppCvGov }; });
      check(lk && lk.tab === 'loading' && lk.vis && lk.rows >= 2 && lk.gov, 'the Summary link to the combination table opens it in the governing view (its governing rows are shown): ' + JSON.stringify(lk)); }
    // ---- 6. Report, governing view
    const RG = await o.p.evaluate(REPORT);
    check(/^Governing combinations only; \d+ combinations checked/.test(RG.stmt || '') && RG.shown && +/(\d+) combinations checked/.exec(RG.stmt)[1] === (G.E.lts ? G.E.ltsN : G.E.n),
      'Report (governing): states "' + (RG.stmt || '').slice(0, 58) + '…"');
    check((G.lts ? unresOK(RG) : RG.unres.length === 0) && JSON.stringify(RG.unres) === JSON.stringify(RA.unres) && RG.dup.length === 0 && RG.kerr === 0 && RG.refs.every(x => !!x[1]),
      'Report (governing): every § reference resolves as in the "all" view, no KaTeX error ' + (RG.unres.length ? '(known on main, not from this change: ' + RG.unres.join(', ') + ')' : ''));
    { const red = RA.tables.filter((t, i) => RG.tables[i] && RG.tables[i].n < t.n).length, more = RA.tables.filter((t, i) => !RG.tables[i] || RG.tables[i].n > t.n).length;
      check(RA.tables.length === RG.tables.length && red >= 2 && more === 0 && RG.len < RA.len + 2000, `Report (governing): the same ${RG.tables.length} tables, ${red} of them reduced, none added or longer`); }
    if (vw === 390) { const sc = await o.p.evaluate(async () => { const out = {}; for (const t of ['loading', 'post', 'anchors', 'shaft', 'report', 'summary']) { switchTab(t, true); await new Promise(r => setTimeout(r, 250));
          const b = document.querySelector('#page-' + t + ' .lppCvBar'), r = b ? b.getBoundingClientRect() : null; out[t] = [document.documentElement.scrollWidth - document.documentElement.clientWidth, r ? Math.round(r.right) : 0, r ? Math.round(r.height) : 0]; } return out; });
      check(Object.values(sc).every(v => v[0] <= 0 && v[1] <= 390), 'governing view, 390 px: no horizontal page scroll on any tab, the switch inside the page ' + JSON.stringify(sc)); }
    if (shots && ['default', 'sign1'].includes(name)) {
      await o.p.evaluate(() => { switchTab('loading', true); lppLdSet('combos', true); const c = document.querySelector('.col-out'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); if (innerWidth > 600) document.getElementById('lppLdCombo').querySelector('table').scrollIntoView({ block: 'start' }); }); await o.p.waitForTimeout(200);
      await o.p.screenshot({ path: path.join(shots, `lpcv-${name}-combos-gov-${vw}.png`), fullPage: true });
      if (vw > 600) { await o.p.evaluate(() => { switchTab('post', true); const c = document.querySelector('.col-out'); if (c) c.scrollTop = 0; window.scrollTo(0, 0); }); await o.p.waitForTimeout(200); await o.p.screenshot({ path: path.join(shots, `lpcv-${name}-post-gov-${vw}.png`) }); }
    }
    // ---- 7. print: the bars are not printed
    await o.p.emulateMedia({ media: 'print' });
    const pr = await o.p.evaluate(() => [...document.querySelectorAll('.lppCvBar')].every(b => getComputedStyle(b).display === 'none') && [...document.querySelectorAll('a.lppCvAll')].every(a => getComputedStyle(a).display === 'none'));
    await o.p.emulateMedia({ media: 'screen' });
    check(pr, 'print: the switch and the "show all" links are not printed');
    // ---- 8. reload: remembered; then "show all" brings the "all" view back, row for row
    await o.p.reload(); await ready(); await o.p.waitForTimeout(700);
    const rl = await o.p.evaluate(() => ({ gov: lppCvGov, on: [...document.querySelectorAll('.lppCvBar button.on')].map(x => x.dataset.cv).join(','), notes: document.querySelectorAll('.lppCvNote').length }));
    check(rl.gov && /^(gov,){4}gov$/.test(rl.on) && rl.notes > 0, 'after a reload the governing view is still on (per-browser key)');
    await o.p.evaluate(m => { const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, m.inputs || {}); Object.assign(st, m.top || {});
      if (m.cables) st.cables = m.cables; if (m.fixtures) st.fixtures = m.fixtures; applyState(st); switchTab('loading', true); lppLdSet('combos', true); }, mut);
    await o.p.waitForTimeout(500);
    await o.p.evaluate(() => { const a = [...document.querySelectorAll('.lppCvNote a.lppCvAll')].find(x => x.offsetParent) || document.querySelector('.lppCvNote a.lppCvAll'); a.click(); });
    await o.p.waitForTimeout(700);
    const B = await o.p.evaluate(SNAP);
    check(B.gov === false && B.key === 'all' && B.notes.length === 0 && B.bars.every(b => b.on === 'all'), '"show all" flips the switch to "All load combinations" on every tab (lpp_comboView_v1 = all)');
    { const d2 = Object.keys(A.same).filter(k => A.same[k] !== B.same[k]);
      check(JSON.stringify(B.tbl) === JSON.stringify(A.tbl) && d2.length === 0, 'back in the "all" view every combination table is as on the first visit, row for row' + (d2.length ? ' — differ: ' + d2.join(', ') : '')); }
    if (vw === 390) { const sc = await o.p.evaluate(async () => { const out = {}; for (const t of ['loading', 'post', 'anchors', 'shaft', 'report']) { switchTab(t, true); await new Promise(r => setTimeout(r, 250)); out[t] = document.documentElement.scrollWidth - document.documentElement.clientWidth; } return out; });
      check(Object.values(sc).every(v => v <= 0), '"all" view, 390 px: no horizontal page scroll on any tab ' + JSON.stringify(sc)); }
    check(o.errs.length === 0, 'no console / page errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
    if (o.blocked.size) console.log('  note: blocked requests: ' + [...o.blocked].join(', '));
  } finally { await o.b.close(); }
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
process.exit(fails ? 1 : 0);
