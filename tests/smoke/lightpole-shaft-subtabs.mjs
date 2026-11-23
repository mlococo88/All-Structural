#!/usr/bin/env node
// Light Pole and Sign Post: the Shaft output in sub-tabs that follow the load path, and the LRFDLTS Post sub-tabs (LPSS, 2026-11-23).
// Display / organisation only. Headless Chromium, file://, KaTeX served from tests/libs. Per case (1400 px; two cases also at 390 px):
//   - first visit: sub-tab 1 · Forces, no key stored; the summary strip and the bar are second on the Shaft page (after the
//     combination-view bar); IBC: four sub-tabs, LRFDLTS: three (no soil bearing check in that mode);
//   - each sub-tab shows only its own cards / blocks; every output element of the Shaft page is shown in exactly one sub-tab;
//   - the strip: the embedment depth = the engine's d (L in the LRFDLTS mode); the soil bearing D/C = that check in the check panel;
//     4 · Reinforcement (LPGD, 2026-11-23) = the largest STRENGTH D/C of the check panel (shaft flexure, shear, torsion threshold,
//     shear tie spacing of a manual cage) with its name, then "Detailing OK" or "Detailing NG (the failed limits)" for the minimum /
//     maximum steel, bar clear spacing, tie spacing and tie size; the node is marked NG when any of them fails (case detail_ng: the
//     strength checks pass and a detailing limit fails); a node opens its sub-tab;
//   - the chosen sub-tab is the per-browser key lpp_shaftSub_v1, is not in the project state and survives a reload;
//   - the "All load combinations / Governing combination only" switch works in every sub-tab and keeps the sub-tab;
//   - links: a check-panel line, a Summary link (lppGoto) and the Loading load-path strip's "Soil" step open the sub-tab of their target
//     (not remembered);
//   - two-post sign: the post selector changes the strip and the cards to that post;
//   - the Report: one "Drilled shaft" chapter in the order Forces → Embedment → Soil bearing → Reinforcement (per shaft), every
//     reference resolves, no duplicate key; nothing is hidden in print;
//   - Post tab: LRFDLTS: two sub-tabs (member check; deflection and fatigue), key lpp_postSub_v1; IBC: the single view, no bar;
//   - 390 px: no horizontal page scroll in any sub-tab; no console / page errors.
//   --base <git ref | file>: also compares, case by case, every output element of the Shaft, Post and Anchorage pages (innerHTML by
//     id), the LRFDLTS cards' text, the Summary page, the check panel, the copy summary and the Anchorage hand-off payload between
//     that version and the working tree (the cards' new names in link labels are normalised). The PR that added the sub-tabs was
//     checked this way against its parent commit: nothing differs.
//   node tests/smoke/lightpole-shaft-subtabs.mjs [--shots <dir>] [--base <ref|file>]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO } from '../lib.mjs';

const TOOL = 'Light Pole and Sign Post.html', LP = path.join(REPO, TOOL);
const args = process.argv.slice(2), opt = k => args.includes(k) ? args[args.indexOf(k) + 1] : null, shots = opt('--shots'), base = opt('--base');
const CASES0 = {
  default: {},
  sign1: { top: { appMode: 'sign', signPosts: 1 } },
  sign2: { inputs: { V: '130', shaftShape: 'square', signB: '16', signS: '5', signClr: '10', signSpacing: '8' }, top: { appMode: 'sign', signPosts: 2 } },
  proj_arms: { inputs: { shaftProj: '2', tIce: '1.0', bromsSoil: 'cohesive', bromsC: '1.2' }, fixtures: [{ hf: 30, th: 45, a: 8, epa: 2.4, aIce: 2.4, tIce: 0.5, W: 70, armD: 3.5 }, { hf: 35, th: 200, a: 4, epa: 1.2, aIce: 1.2, tIce: 0.5, W: 40 }] },
  signrect2: { inputs: { poleShape: 'rect', poleDiaTop: '6', poleDepthTop: '12', poleTwTop: '0.25', V: '130', signB: '4', signS: '2', signClr: '20', signSpacing: '3', tIce: '1.0', shaftProj: '1.5' }, top: { appMode: 'sign', signPosts: 2 } },
  detail_ng: { inputs: { rebarMode: 'manual', manTieS: '18' } },
  shaft_ng: { inputs: { V: '130', signB: '16', signS: '8', signClr: '10', b: '2', rebarMode: 'manual', manBarN: '4', manBarSize: '#4' }, top: { appMode: 'sign', signPosts: 1 } },
  lts_pole: { inputs: { bromsSoil: 'cohesive', bromsC: '1.0' }, top: { codeMode: 'lts', cablesEnabled: false } },
  lts_sign2: { inputs: { bromsSoil: 'cohesionless', bromsPhi: '30', bromsGam: '0.115', shaftProj: '1' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } },
};
const ONLY = process.env.LPSS_ONLY ? process.env.LPSS_ONLY.split(',') : null, CASES = ONLY ? Object.fromEntries(Object.entries(CASES0).filter(([k]) => ONLY.includes(k))) : CASES0;
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
if (shots) fs.mkdirSync(shots, { recursive: true });

// --base: a file, or a git ref (the tool, shared/ and apps/light-pole/ extracted next to each other, as tests/lightpole-compare.mjs does)
function baseFile(spec) {
  const wt = path.resolve(REPO, spec); if (fs.existsSync(spec) && fs.statSync(spec).isFile()) return spec; if (fs.existsSync(wt) && fs.statSync(wt).isFile()) return wt;
  const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', spec], { encoding: 'utf8' }).trim();
  const dir = path.join(os.tmpdir(), 'allstruct-tests', 'lp-' + sha); fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, TOOL), execFileSync('git', ['-C', REPO, 'show', `${sha}:${TOOL}`], { maxBuffer: 1 << 28 }));
  for (const d of ['shared', 'apps/light-pole']) { try { const tar = execFileSync('git', ['-C', REPO, 'archive', sha, d], { maxBuffer: 1 << 28, stdio: ['pipe', 'pipe', 'ignore'] }); execFileSync('tar', ['-x', '-C', dir], { input: tar }); } catch (e) { /* not at that ref */ } }
  return path.join(dir, TOOL);
}

// in the page: a new project with the case's changes
const APPLY = async mut => {
  const st = JSON.parse(JSON.stringify(DEFAULT_STATE));   // eslint-disable-line no-undef
  Object.assign(st.inputs, mut.inputs || {}); Object.assign(st, mut.top || {}); if (mut.fixtures) st.fixtures = mut.fixtures; if (mut.cables) st.cables = mut.cables;
  applyState(st); await new Promise(r => setTimeout(r, 450));   // eslint-disable-line no-undef
};
// in the page: what is shown on the Shaft page now
const SNAP = () => {
  const vis = e => !!(e && e.offsetParent), pg = document.getElementById('page-shaft'), lts = codeMode === 'lts';   // eslint-disable-line no-undef
  const kids = [...pg.children].filter(vis);
  const marked = [...pg.querySelectorAll('[data-shsub]')].filter(e => !e.closest('.sign-post-wrap') || vis(e.closest('.sign-post-wrap')) || true);
  const shown = marked.filter(vis);
  const outIds = [...pg.querySelectorAll('[data-shsub] [id]')].filter(e => !lts ? !e.closest('.ltsCard') : !!e.closest('.ltsCard'));
  const strip = [...document.querySelectorAll('#lppShStrip .lppShNode')].map(n => ({ k: n.dataset.shgo, t: n.querySelector('b').textContent, v: n.querySelector('span').textContent, on: n.classList.contains('on'), ng: n.classList.contains('ng') }));
  const items = (lppDashItems() || []).map(i => ({ name: i.name, dc: i.dc, st: i.st }));   // eslint-disable-line no-undef
  const ctx = LPP_SUMCTX, X = lppLtsLast;   // eslint-disable-line no-undef
  return { lts, sign: appMode === 'sign', posts: signPosts, sel: __selectedPost, cur: pg.getAttribute('data-shcur'), key: localStorage.getItem('lpp_shaftSub_v1'), gov: lppCvGov,   // eslint-disable-line no-undef
    order: kids.slice(0, 2).map(e => e.className.split(' ')[0]), cvVis: vis(pg.querySelector('.lppCvBar')), cvOn: [...pg.querySelectorAll('.lppCvBar button.on')].map(b => b.dataset.cv).join(','),
    bar: [...document.querySelectorAll('#lppShBar button')].map(b => ({ k: b.dataset.shgo, t: b.textContent, on: b.classList.contains('on') })), strip, lbl: (document.querySelector('#lppShStrip .lppShLbl') || {}).textContent,
    shownSubs: [...new Set(shown.map(e => e.getAttribute('data-shsub')))], shownTitles: shown.filter(e => e.matches('.card')).map(e => e.querySelector('h2').textContent),
    shownPosts: [...new Set(shown.map(e => (e.closest('.sign-post-wrap') || { dataset: {} }).dataset.post).filter(Boolean))],
    visIds: outIds.filter(vis).map(e => e.id), allIds: outIds.map(e => e.id).filter(id => { const e = document.getElementById(id); return !(e.closest('.sign-post-wrap') && e.closest('.sign-post-wrap').style.display === 'none'); }),
    hidInline: outIds.filter(e => { let a = e; while (a && a !== pg) { if (a.style && a.style.display === 'none') return true; a = a.parentElement; } return false; }).map(e => e.id),
    html: (c => { c.querySelectorAll('.lppCvBar,.lppShBox').forEach(x => x.remove()); return c.innerHTML.replace(/ style=""/g, ''); })(pg.cloneNode(true)),
    items, d: lts ? (X && X.fd && X.fd.gov ? X.fd.gov.br.L : null) : (ctx ? ctx.stacks.map(s => s.found.d) : null), sw: document.documentElement.scrollWidth - document.documentElement.clientWidth };
};
// in the page: everything that must be the same as before the sub-tabs (the --base comparison)
const FINGER = () => {
  const nm = t => String(t).replace(/Shaft structural check \(soil bearing\)/g, 'Soil bearing').replace(/Shaft structural check/g, 'Shaft reinforcement').replace(/Foundation demand &(amp;)? embedment/g, 'Forces on the shaft')
    .replace(/Foundation demand at grade \(shaft projection\)/g, 'Forces on the shaft (at grade, shaft projection)').replace(/ style=""/g, '');
  const ids = {}, skip = /^(lppSh|lppPs|lppShBar|lppShStrip|lppPsBar|lppPsStrip|sgStackContainer|flags(_sp\d)?|flagsEmb(_sp\d)?)$/;
  ['shaft', 'post', 'anchors'].forEach(t => document.querySelectorAll('#page-' + t + ' [id]').forEach(e => { if (skip.test(e.id) || e.closest('.lppCvBar') || e.closest('.lppShBox') || e.classList.contains('ltsCard')) return; ids[e.id] = nm(e.innerHTML); }));
  // the flags: before one box, now the d/b flag (#flagsEmb) and the others (#flags)
  document.querySelectorAll('#page-shaft [id^="flags"]').forEach(e => { if (/^flagsEmb/.test(e.id)) return; const s = e.id.slice(5), fe = document.getElementById('flagsEmb' + s); ids['flags*' + s] = (fe ? fe.innerHTML : '') + e.innerHTML; });
  const lts = {}; document.querySelectorAll('.ltsCard').forEach(c => { lts[c.id] = c.textContent.replace(/\s+/g, ' ').trim(); });
  const dash = (lppDashItems() || []).map(i => [i.name, i.dc, i.st, i.text, i.ref, i.where ? i.where.tab + '|' + nm(i.where.card) : '']);   // eslint-disable-line no-undef
  return { ids, lts, dash: JSON.stringify(dash), summary: nm(document.getElementById('page-summary').innerHTML), copy: window.__summary,
    anch: JSON.stringify((x => { if (x && x.payload) delete x.payload.producedAt; return x; })(lppAnchorPayload())),   // eslint-disable-line no-undef
    loading: nm((c => { c.querySelectorAll('.lppCvBar').forEach(x => x.remove()); return c.innerHTML; })(document.getElementById('page-loading').cloneNode(true))),   // without the switch bar (its buttons' attribute order depends on the view the page opened on; LPGD)
    geometry: document.getElementById('page-geometry').innerHTML.replace(/ style=""/g, '') };
};
const near = (a, b, t = 6e-3) => Math.abs(a - b) <= t;
const num = s => parseFloat(String(s).replace(/,/g, ''));

for (const [name, mut] of Object.entries(CASES)) {
  for (const vw of (name === 'default' || name === 'sign2') ? [1400, 390] : [1400]) {
    console.log(`${name} @ ${vw}px`);
    const o = await openPage(LP, { vw, vh: 1000, dsf: shots ? 2 : undefined });
    try {
      await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 30000 });
      await o.p.waitForTimeout(300);
      await o.p.evaluate(APPLY, mut);
      await o.p.evaluate(() => switchTab('shaft', true));   // eslint-disable-line no-undef
      await o.p.waitForTimeout(250);
      const A = await o.p.evaluate(SNAP), lts = A.lts, subs = lts ? ['forces', 'embed', 'reo'] : ['forces', 'embed', 'bearing', 'reo'];
      check(A.gov === true && A.cvOn === 'gov', 'first visit: the combination view is "Governing combination only" (LPGD)');
      check(A.cur === 'forces' && A.key === null && A.bar.map(b => b.k).join() === subs.join() && A.bar.filter(b => b.on).map(b => b.k).join() === 'forces',
        `first visit: 1 · Forces, no key; sub-tabs ${A.bar.map(b => b.t).join(' | ')}`);
      check(A.order.join() === 'lppCvBar,lppShBox' && A.cvVis, 'the combination-view bar is first on the page, the summary strip and the sub-tab bar second');
      // every sub-tab
      const seen = {}; let okOnly = true, okNames = [];
      for (const k of subs) {
        await o.p.click(`#lppShBar button[data-shgo="${k}"]`); await o.p.waitForTimeout(150);
        const S = await o.p.evaluate(SNAP);
        if (S.cur !== k || S.shownSubs.join() !== k || S.key !== k) okOnly = false;
        S.visIds.forEach(id => { (seen[id] = seen[id] || []).push(k); }); okNames.push(`${k}: ${[...new Set(S.shownTitles)].join(', ')}${S.shownPosts.length ? ' (post ' + S.shownPosts.join() + ')' : ''}`);
        if (vw === 390) check(S.sw <= 0, `390 px, sub-tab ${k}: no horizontal page scroll (${S.sw})`);
        if (shots && vw === 1400 && (name === 'default' || name === 'sign2' || name === 'lts_pole')) await o.p.screenshot({ path: path.join(shots, `lp-shaft-${name}-${k}.png`) });
      }
      check(okOnly, 'each sub-tab shows only its own cards / blocks — ' + okNames.join(' · '));
      { const S = await o.p.evaluate(SNAP), expect = S.allIds.filter(id => !S.hidInline.includes(id));
        const multi = Object.entries(seen).filter(([, v]) => v.length !== 1).map(([id]) => id), miss = expect.filter(id => !seen[id]);
        check(expect.length >= (lts ? 4 : 20) && multi.length === 0 && miss.length === 0, `every output element (${expect.length}) is shown in exactly one sub-tab${miss.length ? ' — never shown: ' + miss.slice(0, 6).join(', ') : ''}${multi.length ? ' — in more than one: ' + multi.slice(0, 6).join(', ') : ''}`); }
      // strip values = the engine / the check panel
      { const S = await o.p.evaluate(SNAP), st = Object.fromEntries(S.strip.map(n => [n.k, n])), si = S.sign && S.posts === 2 ? S.sel - 1 : 0, lab = S.sign ? ' · P' + (si + 1) : '';
        const it = re => S.items.filter(i => re.test(i.name) && (lts || i.name.endsWith(lab) || !S.sign) && i.dc != null);
        const reo = it(/^(Shaft flexure|Shaft shear|Longitudinal steel|Bar clear spacing|Tie s|Shaft torsion ≤)/), bear = it(/^Soil bearing/);
        const dEng = lts ? S.d : S.d[si], dStrip = num((st.embed.v.match(/= ([\d.,]+) ft/) || [])[1]);
        check(near(dStrip, dEng), `strip, 2 · Embedment: "${st.embed.v}" = the engine's ${lts ? 'L' : 'd'} ${dEng.toFixed(2)} ft`);
        const g = L => L.reduce((a, b) => b.dc > a.dc ? b : a, L[0]);
        if (!lts) { const b = g(bear); check(near(num((st.bearing.v.match(/D\/C ([\d.,∞]+)/) || [])[1]), b.dc) && st.bearing.ng === (b.st === 'fail'), `strip, 3 · Soil bearing: "${st.bearing.v}" = the check panel's ${b.dc.toFixed(3)} (${b.st})`); }
        else check(!st.bearing, 'LRFDLTS: no soil bearing sub-tab (not checked in that mode)');
        // LPGD (2026-11-23): the largest STRENGTH ratio with its name, and the detailing limits as one OK / NG
        const isStr = i => /^(Shaft flexure|Shaft shear|Shaft torsion ≤|Tie spacing, shear)/.test(i.name), bare = i => i.name.replace(lab, '');
        const str = reo.filter(isStr), det = reo.filter(i => !isStr(i)), detBad = det.filter(i => i.st === 'fail').map(bare);
        const r = g(str), anyFail = reo.some(i => i.st === 'fail'), strFail = str.some(i => i.st === 'fail'), m = st.reo.v.match(/^D\/C ([\d.,∞]+) (OK|NG) · (.+?) · Detailing (OK|NG)(?: \((.+)\))?$/) || [];
        check(str.length >= 2 && det.length >= 4 && (isFinite(r.dc) ? near(num(m[1]), r.dc) : m[1] === '∞') && m[2] === (strFail ? 'NG' : 'OK') && m[3] === bare(r),
          `strip, 4 · Reinforcement: "${st.reo.v}": the largest of the ${str.length} strength checks, ${r.name} ${isFinite(r.dc) ? r.dc.toFixed(3) : '∞'} (not the largest of all ${reo.length}: ${g(reo).name} ${isFinite(g(reo).dc) ? g(reo).dc.toFixed(3) : '∞'})`);
        check(m[4] === (detBad.length ? 'NG' : 'OK') && (m[5] || '') === detBad.join('; ') && st.reo.ng === anyFail,
          `strip, 4 · Reinforcement: "Detailing ${m[4]}" for the ${det.length} detailing limits${detBad.length ? ' (failed: ' + detBad.join('; ') + ')' : ''}; the entry is ${anyFail ? '' : 'not '}marked NG (${reo.filter(i => i.st === 'fail').length} of ${reo.length} checks fail)`);
        if (name === 'detail_ng') check(!strFail && detBad.length > 0 && st.reo.ng && m[2] === 'OK' && m[4] === 'NG', 'a failed detailing limit with passing strength checks still shows NG on the strip: ' + detBad.join(', '));
        if (name === 'shaft_ng') check(anyFail && st.reo.ng, 'a failing shaft: the entry is marked NG');
        check(/M_[uF] [\d.,]+/.test(st.forces.v), `strip, 1 · Forces: "${st.forces.v}"`); }
      // a strip node opens its sub-tab; the key; not in the project
      await o.p.click('#lppShStrip .lppShNode[data-shgo="embed"]'); await o.p.waitForTimeout(150);
      { const S = await o.p.evaluate(SNAP), inState = await o.p.evaluate(() => /lpp_shaftSub|shaftSub|"embed"/.test(JSON.stringify(captureState())));   // eslint-disable-line no-undef
        check(S.cur === 'embed' && S.key === 'embed' && S.strip.find(n => n.on).k === 'embed' && !inState, 'a strip node opens its sub-tab (lpp_shaftSub_v1 = embed; not in the project state)'); }
      // the combination-view switch in every sub-tab
      { let ok = true; const notes = [];
        for (const k of subs) {
          await o.p.click(`#lppShBar button[data-shgo="${k}"]`); await o.p.waitForTimeout(100);
          await o.p.click('#page-shaft .lppCvBar button[data-cv="all"]'); await o.p.waitForTimeout(k === subs[0] ? 500 : 100);   // LPGD: the tool opens on "Governing"; start from "All"
          const a = await o.p.evaluate(SNAP);
          await o.p.click('#page-shaft .lppCvBar button[data-cv="gov"]'); await o.p.waitForTimeout(500);
          const g = await o.p.evaluate(SNAP);
          await o.p.click('#page-shaft .lppCvBar button[data-cv="all"]'); await o.p.waitForTimeout(500);
          const b = await o.p.evaluate(SNAP);
          if (process.env.LPSS_DBG && (b.html !== a.html || g.html !== a.html)) { const x = g.html !== a.html ? g.html : b.html; let i = 0; while (i < x.length && x[i] === a.html[i]) i++; console.log('    dbg ' + k + ' @' + i + ': A …' + a.html.slice(i - 80, i + 120) + '\n    B …' + x.slice(i - 80, i + 120)); }
          const good = a.cvVis && a.gov === false && g.gov === true && g.cvOn === 'gov' && g.cur === k && g.shownSubs.join() === k && b.gov === false && b.cur === k && b.html === a.html && g.html === a.html && JSON.stringify(g.strip) === JSON.stringify(a.strip);
          if (!good) { ok = false; notes.push(k); }
        }
        check(ok, 'the "All / Governing combination only" switch works in every sub-tab: the sub-tab stays, the page content and the strip are the same in both views, back to "All"' + (notes.length ? ' — failed in: ' + notes.join() : '')); }
      // links open the sub-tab of their target, not remembered
      if (!lts) {
        await o.p.evaluate(() => lppShSet('shaft', 'forces'));   // eslint-disable-line no-undef
        const r = await o.p.evaluate(async () => { const out = {}, pg = document.getElementById('page-shaft'), w = () => new Promise(r => setTimeout(r, 120));
          for (const [k, sub] of [['bearing', 'bearing'], ['flex', 'reo'], ['emb', 'embed'], ['dem', 'forces'], ['shear', 'reo']]) { switchTab('summary', true); lppGoto(k, 0); await w();   // eslint-disable-line no-undef
            const t = lppTgt(k, 0), e = document.getElementById(t.id); out[k] = { sub, cur: pg.getAttribute('data-shcur'), vis: !!(e && e.offsetParent), on: pg.classList.contains('on'), card: t.card }; }   // eslint-disable-line no-undef
          switchTab('loading', true); lppLdSet('base', true); document.querySelector('#lppLdStrip [data-ldgo="soil"]').click(); await w(); out.soil = { sub: 'embed', cur: pg.getAttribute('data-shcur'), on: pg.classList.contains('on'), vis: true };   // eslint-disable-line no-undef
          out.key = localStorage.getItem('lpp_shaftSub_v1'); return out; });
        const bad = Object.entries(r).filter(([k, v]) => k !== 'key' && !(v.cur === v.sub && v.vis && v.on)).map(([k]) => k);
        check(bad.length === 0 && r.key === 'forces', `links open their sub-tab and are not remembered: bearing → ${r.bearing.card}, flex → ${r.flex.card}, emb → ${r.emb.card}, dem → ${r.dem.card}; Loading strip "Soil" → Embedment` + (bad.length ? ' — failed: ' + bad.join() : ''));
        const dash = await o.p.evaluate(async () => { lppShSet('shaft', 'forces', true); switchTab('summary', true); const c = [...document.querySelectorAll('#lppDash .lpdCh')].find(x => /^Soil bearing/.test(x.querySelector('.lpdN').textContent)); c.click(); await new Promise(r => setTimeout(r, 150));   // eslint-disable-line no-undef
          return { cur: document.getElementById('page-shaft').getAttribute('data-shcur'), on: document.getElementById('page-shaft').classList.contains('on'), ref: c.querySelector('.lpdRef').textContent }; });
        check(dash.cur === 'bearing' && dash.on && /Shaft · (Post \d · )?Soil bearing/.test(dash.ref), `check panel "Soil bearing" opens Shaft → 3 · Soil bearing ("${dash.ref.split(' · → ').pop()}")`);
      } else {
        const r = await o.p.evaluate(async () => { lppShSet('shaft', 'forces', true); switchTab('summary', true); const c = [...document.querySelectorAll('#lppDash .lpdCh')].find(x => /^Shaft flexure/.test(x.querySelector('.lpdN').textContent)); c.click(); await new Promise(r => setTimeout(r, 150));   // eslint-disable-line no-undef
          return { on: document.getElementById('page-shaft').classList.contains('on'), card: !!document.getElementById('ltsFndCard').offsetParent }; });
        check(r.on && r.card, 'LRFDLTS: a check-panel shaft line opens the Shaft tab and its card');
      }
      // two-post sign: the post selector
      if (A.sign && A.posts === 2 && !lts) {
        await o.p.evaluate(() => { switchTab('shaft', true); lppShSet('shaft', 'embed', true); });   // eslint-disable-line no-undef
        const p1 = await o.p.evaluate(SNAP);
        await o.p.selectOption('#postSel', '2'); await o.p.waitForTimeout(200);
        const p2 = await o.p.evaluate(SNAP);
        check(/Post 1/.test(p1.lbl) && /Post 2/.test(p2.lbl) && p1.shownPosts.join() === '1' && p2.shownPosts.join() === '2' && p2.cur === 'embed' && near(num((p2.strip.find(n => n.k === 'embed').v.match(/= ([\d.,]+) ft/) || [])[1]), p2.d[1]),
          `two-post sign: the post selector shows post 2 in the strip ("${p2.lbl}" ${p2.strip.find(n => n.k === 'embed').v}) and in the cards`);
        await o.p.selectOption('#postSel', '1');
      }
      // Report
      { const R = await o.p.evaluate(async () => { switchTab('report'); await new Promise(r => setTimeout(r, 600));   // eslint-disable-line no-undef
          const lts = codeMode === 'lts', d = lts ? SharedReport.build(ltsReportModel()) : LPRP.doc, host = document.getElementById(lts ? 'ltsRptHost' : 'lprHost');   // eslint-disable-line no-undef
          const ch = d.model.sections.filter(s => /^(Drilled shaft|Foundation)/.test(s.title));
          return { lts, n: ch.length, subs: ch.length ? ch[0].subs.map(q => q.title) : [], keys: ch.length ? ch[0].subs.map(q => q.key || '') : [], unres: d.unresolved.map(x => x.key), dup: d.dup || [], kerr: host.querySelectorAll('.katex-error').length, q: (host.textContent.match(/§\?/g) || []).length,
            refs: d.refs.filter(x => /^lpcs:(5|6|6b|7)$/.test(x.key)).length }; });
        if (!R.lts) { const part = t => ['Forces', 'Embedment', 'Soil bearing', 'Reinforcement'].indexOf(t.split(' — ')[0]);
          const seq = R.subs.map(part), nSh = A.sign ? A.posts : 1; let okSeq = seq.every(x => x >= 0), resets = 0;
          for (let i = 1; i < seq.length; i++) if (seq[i] < seq[i - 1]) { resets++; if (seq[i] !== 0) okSeq = false; }
          check(R.n === 1 && okSeq && resets === nSh - 1 && seq[0] === 0 && [0, 1, 2, 3].every(x => seq.includes(x)), `Report: one "Drilled shaft" chapter, ${R.subs.length} subsections in the order Forces → Embedment → Soil bearing → Reinforcement${nSh > 1 ? ', per post' : ''}`);
          if (!A.sign) check(['lpcs:5', 'lpcs:6', 'lpcs:6b', 'lpcs:7'].every(k => R.keys.includes(k)), `Report: the former sections keep their keys (lpcs:5, 6, 6b, 7; ${R.refs} "see §" references to them)`);
        } else check(R.n === 1, 'LRFDLTS Report: the Foundation chapter as before (one subsection)');
        check(R.unres.length === 0 && R.dup.length === 0 && R.kerr === 0 && R.q === 0, 'Report: every § reference resolves, no duplicate key, no "§?", no KaTeX error' + (R.unres.length ? ' — unresolved: ' + R.unres.join(', ') : '') + (R.dup.length ? ' — duplicate: ' + R.dup.join(', ') : '')); }
      // print: nothing is hidden by the sub-tabs
      if (vw === 1400) { await o.p.evaluate(() => { switchTab('shaft', true); lppShSet('shaft', 'forces', true); });   // eslint-disable-line no-undef
        await o.p.emulateMedia({ media: 'print' });
        const pr = await o.p.evaluate(() => { const pg = document.getElementById('page-shaft'), cur = (document.querySelector('.sign-post-wrap[style*="none"]') ? null : null);
          const L = [...pg.querySelectorAll('[data-shsub]')].filter(e => (lts => lts ? !!e.closest('.ltsCard') : !e.closest('.ltsCard'))(codeMode === 'lts'));   // eslint-disable-line no-undef
          return { n: L.length, hidden: L.filter(e => e.style.display !== 'none' && getComputedStyle(e).display === 'none').length /* a pole card in the sign mode is hidden by the mode, inline */, box: getComputedStyle(document.getElementById('lppSh')).display, cur }; });
        await o.p.emulateMedia({ media: 'screen' });
        check(pr.n >= 3 && pr.hidden === 0 && pr.box === 'none', `print: none of the ${pr.n} sub-tab cards / blocks is hidden; the bar and the strip are not printed`); }
      // Post tab
      { const P = await o.p.evaluate(async () => { switchTab('post', true); await new Promise(r => setTimeout(r, 150)); const pg = document.getElementById('page-post'), box = document.getElementById('lppPs'), vis = e => !!(e && e.offsetParent);   // eslint-disable-line no-undef
          const snap = () => ({ cur: pg.getAttribute('data-shcur'), cards: [...pg.querySelectorAll('.card')].filter(vis).map(c => c.id || c.querySelector('h2').textContent) });
          const o = { box: vis(box), bar: [...box.querySelectorAll('.lppLdBar button')].map(b => b.textContent), strip: [...box.querySelectorAll('.lppShNode span')].map(s => s.textContent), a: snap() };
          if (o.bar.length) { box.querySelector('[data-shgo="defl"]').click(); await new Promise(r => setTimeout(r, 100)); o.b = snap(); o.key = localStorage.getItem('lpp_postSub_v1'); box.querySelector('[data-shgo="member"]').click(); }
          o.mc = lppLtsLast && lppLtsLast.mc ? lppLtsLast.mc.gov.gov.ratio : null; return o; });   // eslint-disable-line no-undef
        if (lts) check(P.box && P.bar.length === 2 && P.a.cur === 'member' && P.a.cards.join() === 'ltsMemberCard' && P.b.cards.join() === 'ltsDeflCard' && P.key === 'defl' && near(num((P.strip[0].match(/D\/C ([\d.,]+)/) || [])[1]), P.mc),
          `LRFDLTS Post tab: two sub-tabs (${P.bar.join(' | ')}), each shows its card; strip "${P.strip.join('" · "')}"; key lpp_postSub_v1`);
        else check(!P.box && P.bar.length === 0 && P.a.cur === null && P.a.cards.length >= 1, `IBC Post tab: the single view, no sub-tab bar (${P.a.cards.length} card${P.a.cards.length > 1 ? 's' : ''} shown)`); }
      // reload: the sub-tab is remembered
      if (name === 'default' && vw === 1400) {
        await o.p.evaluate(() => lppShSet('shaft', 'reo'));   // eslint-disable-line no-undef
        await o.p.reload(); await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 30000 }); await o.p.waitForTimeout(500);
        const S = await o.p.evaluate(() => ({ cur: document.getElementById('page-shaft').getAttribute('data-shcur'), key: localStorage.getItem('lpp_shaftSub_v1'), cv: localStorage.getItem('lpp_comboView_v1'), ld: localStorage.getItem('lpp_loadSub_v1') }));
        check(S.cur === 'reo' && S.key === 'reo', `after a reload the Shaft tab opens on 4 · Reinforcement (lpp_shaftSub_v1 = ${S.key}; lpp_comboView_v1 = ${S.cv}, lpp_loadSub_v1 = ${S.ld}: untouched)`);
      }
      check(o.errs.length === 0, 'no console / page errors' + (o.errs.length ? ': ' + o.errs.join(' | ') : ''));
    } finally { await o.b.close(); }
  }
}

// ---- --base: every output of before, element by element ----
if (base) {
  const bf = baseFile(base); console.log(`before / after: ${base} (${bf}) vs the working tree`);
  const get = async file => { const o = await openPage(file, { vw: 1400, vh: 1000 }); const out = {};
    try { await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.renderMathInElement === 'function', null, { timeout: 30000 }); await o.p.waitForTimeout(300);
      // like for like (LPGD, 2026-11-23): both versions in the "all" view, whatever each opens on (not stored)
      await o.p.evaluate(() => { if (typeof lppCvSet === 'function') lppCvSet(false, true); });   // eslint-disable-line no-undef
      for (const [name, mut] of Object.entries(CASES)) { await o.p.evaluate(APPLY, mut); out[name] = await o.p.evaluate(FINGER); }
      out.__errs = o.errs.slice(); } finally { await o.b.close(); }
    return out; };
  const A = await get(bf), B = await get(LP); let nItems = 0, nDiff = 0;
  for (const name of Object.keys(CASES)) { const a = A[name], b = B[name], diffs = [];
    const idsA = Object.keys(a.ids), idsB = Object.keys(b.ids);
    idsA.forEach(id => { nItems++; if (!(id in b.ids)) diffs.push('missing #' + id); else if (a.ids[id] !== b.ids[id]) diffs.push('#' + id); });
    idsB.filter(id => !(id in a.ids)).forEach(id => diffs.push('new #' + id));
    Object.keys(a.lts).forEach(id => { nItems++; if (a.lts[id] !== b.lts[id]) diffs.push('LRFDLTS card ' + id); });
    ['dash', 'summary', 'copy', 'anch', 'loading', 'geometry'].forEach(k => { nItems++; if (a[k] !== b[k]) diffs.push(k); });
    nDiff += diffs.length;
    check(diffs.length === 0, `${name}: ${idsA.length} output elements of the Shaft, Post and Anchorage pages${Object.keys(a.lts).length ? ', ' + Object.keys(a.lts).length + ' LRFDLTS cards' : ''}, Summary, check panel, copy summary, hand-off payload, Loading and Geometry pages identical` + (diffs.length ? ' — differ: ' + diffs.slice(0, 8).join(', ') : '')); }
  check(A.__errs.length === 0 && B.__errs.length === 0, `before / after: ${nItems} items compared, ${nDiff} differ; no console errors`);
}
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASS');
process.exit(fails ? 1 : 0);
