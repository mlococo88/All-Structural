#!/usr/bin/env node
// Light Pole and Sign Post: base reactions and the base moment build-up (LPBM, 2026-11-19). Display only. Headless Chromium
// (KaTeX served from tests/libs). Per case, at 1400 and 390 px:
//   - the Base reactions card comes first on the Loading tab's Combinations sub-tab and the Base moment build-up card is on it
//     (IBC mode; LPLS 2026-11-23: the Loading tab is in sub-tabs, before that the two cards were the first two of the tab);
//   - the build-up reconciles with the envelope: LPP_BMB ok for every governing combination (and post), and the moments shown
//     (Base reactions card, build-up result line) are the text of the envelope tables (pole: the governing rows of the Load
//     combinations card; sign: the per-post demand card);
//   - the worked lines typeset (no .katex-error in the card), the "worked →" links open the step they name;
//   - the long derivations (ice t_d, n1 / G_f, fixtures) are collapsed (details.lpFold) with their content present, and open
//     for printing (beforeprint) and close again (afterprint);
//   - the Report has the Base reactions subsection first in the Design summary and the build-up in the Loading chapter (Combinations), with
//     every § reference resolved;
//   - no horizontal page scroll at 390 px; no console / page errors.
//   node tests/smoke/lightpole-basemoment.mjs [--shots <dir>]   (--shots: Loading and Report screenshots, lpb-<case>-<tab>-<vw>.png)
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const LP = path.join(REPO, 'Light Pole and Sign Post.html');
const args = process.argv.slice(2), shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const CASES = {
  default: {},
  arms: { fixtures: [{ hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70 }, { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40 }] },
  torsion: { fixtures: [{ hf: 30, th: 90, a: 10, epa: 3.0, aIce: 3.0, tIce: 0.5, W: 80, armD: 3.5 }], top: { cablesEnabled: false } },
  cable45: { cables: [{ hc: 32, th: 45, L: 80, s: 4, D: 0.75, g: 0.35 }] },
  nocable: { inputs: { poleShape: 'rect', poleDiaTop: '8', poleDepthTop: '6', poleTwTop: '0.25', V: '140', soilClass: 'custom', S1: '200' }, top: { cablesEnabled: false, isoFac: 2 } },
  stiff: { inputs: { cableMethod: 'stiff', tIce: '1.0' } },
  proj: { inputs: { shaftProj: '2' } },
  sign1: { top: { appMode: 'sign', signPosts: 1 } },
  sign2: { inputs: { V: '130', shaftShape: 'square', signB: '16', signS: '5' }, top: { appMode: 'sign', signPosts: 2 } },
  sign2bs: { inputs: { signB: '40', signS: '3', signClr: '8', signSpacing: '20', poleDiaTop: '8', poleTwTop: '0.322' }, top: { appMode: 'sign', signPosts: 2 } },
  ltspole: { top: { codeMode: 'lts' } },
};
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
if (shots) fs.mkdirSync(shots, { recursive: true });
for (const vw of [1400, 390]) for (const [name, mut] of Object.entries(CASES)) {
  if (vw === 390 && !['default', 'sign2', 'cable45'].includes(name)) continue;
  console.log(`== ${name} @ ${vw} px`);
  const o = await openPage(LP, { vw, vh: vw > 600 ? 900 : 844 });
  try {
    await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 20000 });
    await o.p.evaluate(m => { const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, m.inputs || {}); Object.assign(st, m.top || {});
      if (m.cables) st.cables = m.cables; if (m.fixtures) st.fixtures = m.fixtures; applyState(st); switchTab('loading', true); }, mut);
    await o.p.waitForTimeout(600);
    const r = await o.p.evaluate(() => {
      const lts = document.body.classList.contains('lts-mode'), B = LPP_BMB;
      if (!lts && typeof lppLdSet === 'function') lppLdSet('combos', true);   // LPLS: the two cards are on the Combinations sub-tab
      const page = lts ? document.getElementById('page-loading') : document.getElementById('lppLdPane-combos'), first = [...page.children].filter(c => c.offsetParent).map(c => c.id);
      const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
      const out = { lts, mode: B && B.mode, first, ok: [], shown: [], env: [], katexErr: document.querySelectorAll('#lppBmbCard .katex-error').length,
        katex: document.querySelectorAll('#lppBmbCard .katex').length, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
      if (!B) return out;
      const list = B.mode === 'pole' ? [B.lrfd, B.asd] : [].concat(...B.posts.map(p => [p.lrfd, p.asd]));
      out.ok = list.map(b => b.ok);
      // moments shown: the Base reactions card (bold values) and the result lines of the build-up
      out.shown = [...document.querySelectorAll('#lppBaseRx table b')].map(txt);
      out.res = [...document.querySelectorAll('#lppBmb p.eq-result')].map(txt);
      if (B.mode === 'pole') {
        const rows = [...document.querySelectorAll('#comboMatrixTbl tr')].filter(tr => /governs/.test(tr.textContent));
        out.env = rows.map(tr => ({ fam: tr.cells[0].textContent, M: tr.cells[5].textContent, N: tr.cells[7].textContent, P: tr.cells[4].textContent }));
      } else {
        out.env = B.posts.map((P, p) => ({ L: fmt(P.gL.M, 0), A: fmt(P.gA.M, 0) }));
        out.sgTbl = txt(document.getElementById('sgComboTbl'));
      }
      out.list = list.map(b => ({ name: b.name, M: fmt(b.env.M, 0), post: b.post || 0, fam: b.fam }));
      // folds: closed by default, content present; beforeprint opens, afterprint closes
      const folds = [...document.querySelectorAll('details.lpFold')].filter(d => { const c = d.closest('.card'); const pn = d.closest('.lppLdPane'), bt = pn && document.querySelector('#lppLdBar button[data-ldsub="' + pn.dataset.ldpane + '"]');
        return !(c && c.style.display === 'none') && !(bt && bt.style.display === 'none'); });   // LPLS: not the folds of the other mode's (hidden, empty) cards, nor of a sub-tab that does not apply (Cables without cables)
      out.folds = folds.length; out.foldClosed = folds.every(d => !d.open); out.foldContent = folds.every(d => d.textContent.length > 200);
      window.dispatchEvent(new Event('beforeprint')); out.foldPrintOpen = folds.every(d => d.open);
      window.dispatchEvent(new Event('afterprint')); out.foldAfter = folds.every(d => !d.open);
      if (document.body.classList.contains('rp-printing')) document.body.classList.remove('rp-printing');
      switchTab('loading', true);
      return out;
    });
    if (r.lts) {
      check(!r.first.includes('lppBaseRxCard') && !r.first.includes('lppBmbCard'), 'LRFDLTS mode: the IBC base reactions / build-up cards are hidden (the LRFDLTS cards are shown)');
    } else {
      check(r.first[0] === 'lppBaseRxCard' && r.first.includes('lppBmbCard'), 'Base reactions is the first card of the Combinations sub-tab and the build-up is on it: ' + r.first.join(', '));
      check(r.ok.length > 0 && r.ok.every(Boolean), 'build-up reconciles with the envelope for every governing combination: ' + r.ok.join(','));
      check(r.katexErr === 0 && r.katex > 0, `worked lines typeset (${r.katex} KaTeX blocks, ${r.katexErr} errors)`);
      if (r.mode === 'pole') {
        const L = r.env.find(e => e.fam === 'LRFD'), A = r.env.find(e => e.fam === 'ASD');
        check(!!L && !!A, 'envelope rows found');
        check(r.shown[0] === L.M + ' lb·ft' && r.shown[1] === A.M + ' lb·ft', `box M = envelope M (${r.shown[0]} / ${r.shown[1]} vs ${L.M} / ${A.M})`);
        check(r.shown[2] === L.P + ' lb' && r.shown[3] === A.P + ' lb' && r.shown[4] === L.N + ' lb' && r.shown[5] === A.N + ' lb', 'box V and N = envelope P and N');
        check(r.res.length === 2 && r.res[0].includes('= ' + L.M + ' lb·ft') && r.res[1].includes('= ' + A.M + ' lb·ft') && r.res.every(t => t.includes('✓')), 'result lines = envelope M: ' + r.res.map(t => t.slice(0, 60)).join(' | '));
      } else {
        check(r.list.every(b => r.sgTbl.includes(b.M)), 'every post M of the build-up is in the per-post demand table');
        check(r.res.length === r.list.length && r.res.every((t, i) => t.includes('= ' + r.list[i].M + ' lb·ft') && t.includes('✓')), 'result lines = per-post envelope M');
      }
      check(r.mode === 'sign' || (r.folds >= 2 && r.foldClosed && r.foldContent), `long derivations collapsed, content present (${r.folds} folds)`);
      check(r.foldPrintOpen && r.foldAfter, 'folds open for printing and close after');
      // links: a "worked →" link opens its step on the Loading tab
      const lk = await o.p.evaluate(async () => { const a = document.querySelector('#lppBaseRx a[data-lpgo]'); if (!a) return null; const id = a.dataset.lpgo; a.click();
        await new Promise(r => setTimeout(r, 300)); const e = document.getElementById(id); return { id, on: e && e.closest('.tabpage').classList.contains('on') }; });
      check(lk && lk.on, 'the first "worked →" link opens its target: ' + (lk && lk.id));
      // a link to another tab (B₂, pole)
      if (r.mode === 'pole') { const t = await o.p.evaluate(async () => { const a = document.querySelector('#lppBaseRx a.wkA[data-k="b2"]'); if (!a) return null; a.click(); await new Promise(r => setTimeout(r, 300));
        const on = document.querySelector('#tabBar button.on').dataset.tab; switchTab('loading', true); return on; }); check(t === 'post', 'the B₂ link opens the Post tab: ' + t); }
    }
    if (vw === 390) check(r.scroll <= 0, 'no horizontal page scroll at 390 px (' + r.scroll + ')');
    if (shots) { await o.p.evaluate(() => { const o = document.querySelector('.col-out'); if (o) o.scrollTop = 0; window.scrollTo(0, 0); }); await o.p.waitForTimeout(200);
      await o.p.screenshot({ path: path.join(shots, `lpb-${name}-loading-${vw}.png`), fullPage: vw < 600 });
      if (!r.lts) { await o.p.evaluate(() => { const e = document.getElementById('lppBmbCard'); e.scrollIntoView({ block: 'start' }); }); await o.p.waitForTimeout(200);
        await o.p.screenshot({ path: path.join(shots, `lpb-${name}-buildup-${vw}.png`) }); } }
    // Report
    const rp = await o.p.evaluate(async () => { switchTab('report', true); await new Promise(r => setTimeout(r, 600));
      const lts = document.body.classList.contains('lts-mode'); if (lts) return { lts };
      const M = lprModel(), d = SharedReport.build(M), s2 = M.sections[1], s4 = M.sections.find(s => s.title === 'Loading');
      const host = document.getElementById('lprHost');
      return { lts, unres: d.unresolved.map(x => x.key), dup: d.dup, first2: s2.subs[0].title, bmb: s4.subs.filter(q => /build-up/.test(q.title)).map(q => q.title),
        see: SharedReport.ref(d, 'lp:bmb') || SharedReport.ref(d, 'lp:bmb:p1'), katexErr: host.querySelectorAll('.katex-error').length,
        hasRx: /Base reactions/.test(host.textContent), scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
    });
    if (!rp.lts) {
      check(rp.unres.length === 0 && rp.dup.length === 0, 'Report: § references resolved, no duplicate keys ' + JSON.stringify(rp.unres) + JSON.stringify(rp.dup));
      check(/^Base reactions/.test(rp.first2) && rp.hasRx, 'Report: Base reactions first in the Design summary (' + rp.first2 + ')');
      check(rp.bmb.length >= 1 && !!rp.see, 'Report: build-up in the Loading chapter (' + rp.bmb.join('; ') + ', ' + rp.see + ')');
      check(rp.katexErr === 0, 'Report: no KaTeX errors');
      if (vw === 390) check(rp.scroll <= 0, 'Report: no horizontal page scroll at 390 px');
      if (shots) { await o.p.screenshot({ path: path.join(shots, `lpb-${name}-report-${vw}.png`) }); }
    }
    check(o.errs.length === 0, 'no console / page errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
    if (o.blocked.size) console.log('  note: blocked requests: ' + [...o.blocked].join(', '));
  } finally { await o.b.close(); }
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
process.exit(fails ? 1 : 0);
