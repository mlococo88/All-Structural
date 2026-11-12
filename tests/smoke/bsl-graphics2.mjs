#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): the rest of the tab graphics in the SLGX style (SLGX2, 2026-11-12; display only):
//   - Seismic tab: the design response spectrum in a white .vk-dwg-box (svg.vk-chart.sl-spec) with the tab's own values marked: A_s, S_a(1.0 s),
//     max T·S_a, S_D1 and the zone, and each segment's T_m and C_sm (the Uniform load method table's values, same digits);
//   - Live load tab: the reaction influence line (svg.vk-chart.sl-il) with max / min ordinates and the positive / negative areas of the note;
//   - every label of every tab graphic (unit elevations, Live load arrangement, load diagrams, spectrum, influence line) 10 px or more at
//     1400 px and at 390 px (the box scrolls sideways there, the page does not), no two labels of a graphic overlapping, for the default
//     project with a ground motion and the bsl test projects;
//   - the Report (print media, 800 px): every figure label 7.5 px or more; 0 console errors.
//   node tests/smoke/bsl-graphics2.mjs [--shots <dir>]
import assert from 'assert/strict';
import fs from 'fs';
import path from 'path';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html'), SHOTS = arg('shots', null);
let fails = 0; const errsAll = [];
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 600)); } };
const ready = p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsLayout).then(() => p.waitForTimeout(700));
const SA = [0.18, 0.182, 0.19, 0.21, 0.25, 0.29, 0.32, 0.36, 0.37, 0.36, 0.34, 0.3, 0.26, 0.19, 0.14, 0.09, 0.066, 0.042, 0.03, 0.023, 0.014, 0.0095].map(String);
const PROJ = ['default', 'skew30', 'pile_ham_massdot', 'water_wall', 'abut_coulomb'];
const proj = n => n === 'default' ? null : fs.readFileSync(path.join(REPO, 'tests', 'projects', 'bsl', n + '.json'), 'utf8');
const setUp = (p, pn) => p.evaluate(([j, n, sa]) => { if (j) openProject(JSON.parse(j), n); else { P = defP(); syncSupports(); }
  P.br.eqSa = sa; P.br.eqSiteClass = P.br.eqSiteClass || 'D'; buildTabs(); buildSide(); recompute(); }, [proj(pn), pn + '.json', SA]);
// every svg of the tab: smallest label (text and tspan font sizes × screen scale) and overlapping label boxes
const scan = (p, tabs) => p.evaluate(async tabs => { const out = [];
  for (const t of tabs) for (let k = 0; k < P.units.length; k++) { P.ui.sel = k; showTab(t); await new Promise(r => setTimeout(r, 120));
    document.querySelectorAll(`#tab-${t} svg.vk-dwg, #tab-${t} svg.vk-chart`).forEach((svg, i) => { const m = svg.getScreenCTM().a, T = [...svg.querySelectorAll('text')].filter(x => x.textContent.trim());
      const fz = [...svg.querySelectorAll('text,tspan')].filter(x => x.getAttribute('font-size')).map(x => parseFloat(x.getAttribute('font-size')) * m);
      const R = T.map(x => ({ s: x.textContent, r: x.getBoundingClientRect() })), ov = [];
      for (let a = 0; a < R.length; a++) for (let b = a + 1; b < R.length; b++) { const A = R[a].r, B = R[b].r; if (Math.min(A.right, B.right) - Math.max(A.left, B.left) > 1 && Math.min(A.bottom, B.bottom) - Math.max(A.top, B.top) > 1) ov.push(R[a].s.slice(0, 30) + ' / ' + R[b].s.slice(0, 30)); }
      out.push({ id: `${t}/${P.units[k].name}/${i}`, min: Math.min(...fz), ov }); }); }
  return { out, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth }; }, tabs);
const TABS = ['geometry', 'll', 'earth', 'brce', 'wind', 'temp', 'water', 'ice', 'eq', 'cv', 'ct'];

for (const vw of [1400, 390]) {
  const o = await openPage(FILE, { vw, vh: 1000 }), { p } = o; errsAll.push(o.errs);
  try { await ready(p);
    for (const pn of PROJ) {
      await setUp(p, pn);
      const r = await scan(p, TABS);
      await ok(`${vw} px, ${pn}: ${r.out.length} tab graphics, every label ≥ 10 px, no overlapping labels, no page scroll`, async () => {
        assert.equal(r.sw, 0, 'page scroll'); assert.ok(r.out.length >= 8, 'graphics ' + r.out.length);
        const small = r.out.filter(x => !(x.min >= 10 - 0.01)).map(x => `${x.id} ${x.min.toFixed(2)} px`), over = r.out.filter(x => x.ov.length).map(x => `${x.id}: ${x.ov.join('; ')}`);
        assert.deepEqual(small, []); assert.deepEqual(over, []); });
    }
    await setUp(p, 'default');
    await ok(`${vw} px: the spectrum marks the Seismic tab's own values (A_s, S_a(1.0), max T·S_a, S_D1, zone, T_m and C_sm of the table)`, async () => {
      const r = await p.evaluate(async () => { P.ui.sel = 1; showTab('eq'); await new Promise(r => setTimeout(r, 200));
        const svg = document.querySelector('#tab-eq .vk-dwg-box > svg.vk-chart.sl-spec'), S0 = eqSite(), SM = phase5(1).SM;
        return { ok: !!svg, txt: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent).join(' | ') : '', As: f3(S0.As), Sa1: f3(S0.Sa1), pk: f3(S0.pk.TSa), SD1: f3(S0.SD1), zone: S0.zone,
          seg: SM.segs.map(s => [f3(s.TL), f3(s.CL), f3(s.TT), f3(s.CT)]),
          tbl: [...document.querySelectorAll('#tab-eq table.tbl')].find(t => /T<sub>m<\/sub>/.test(t.tHead.innerHTML)).querySelectorAll('tbody tr').length, link: !!document.querySelector('#tab-eq .sl-spec-fig .sl-wk') }; });
      assert.ok(r.ok, 'spectrum svg'); assert.ok(r.link, 'link to the S_D1 card');
      assert.ok(r.txt.includes(`As = ${r.As}`), r.txt); assert.ok(r.txt.includes(`Sa(1.0 s) = ${r.Sa1}`), r.txt); assert.ok(r.txt.includes(`= ${r.SD1}`) && r.txt.includes(`Seismic Zone ${r.zone}`), r.txt);
      assert.ok(r.txt.includes(`max(0.90 × ${r.pk}, ${r.Sa1})`), r.txt);
      r.seg.forEach(([tl, cl, tt, ct]) => { assert.ok(r.txt.includes(`Tm = ${tl} s, Csm = ${cl}`), 'long. ' + tl); assert.ok(r.txt.includes(`Tm = ${tt} s, Csm = ${ct}`), 'trans. ' + tt); });
      if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); const el = await p.$('#tab-eq svg.sl-spec'); await el.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, `slgx2_eq_${vw}.png`) }); } });
    await ok(`${vw} px: the reaction influence line in the same style, max / min ordinates and the note's areas`, async () => {
      const r = await p.evaluate(async () => { P.ui.sel = 1; showTab('ll'); await new Promise(r => setTimeout(r, 200)); const svg = document.querySelector('#tab-ll .vk-dwg-box > svg.vk-chart.sl-il'), note = svg && svg.closest('.card-b').querySelector('p.note').textContent;
        return { ok: !!svg, txt: svg ? [...svg.querySelectorAll('text')].map(t => t.textContent).join(' | ') : '', note }; });
      assert.ok(r.ok, 'influence line svg'); assert.match(r.txt, /max 1\.000/);
      const [, A, B] = r.note.match(/Positive area (\S+) ft, negative area (\S+) ft/); assert.ok(r.txt.includes(`positive area ${A} ft`) && r.txt.includes(`negative area ${B} ft`), r.txt);
      if (SHOTS) { const el = await p.$('#tab-ll svg.sl-il'); await el.scrollIntoViewIfNeeded(); await p.screenshot({ path: path.join(SHOTS, `slgx2_il_${vw}.png`) }); } });
  } finally { await o.b.close(); }
}
{ const o = await openPage(FILE, { vw: 800, vh: 1000 }), { p } = o; errsAll.push(o.errs);
  try { await ready(p); await setUp(p, 'default');
    await p.evaluate(() => { P.ui.sel = 1; showTab('report'); }); await p.waitForTimeout(1500);
    await p.emulateMedia({ media: 'print' }); await p.evaluate(() => window.dispatchEvent(new Event('beforeprint'))); await p.waitForTimeout(800);
    await ok('Report (print, 800 px): the spectrum, influence lines and load diagrams are figures, every figure label ≥ 7.5 px', async () => {
      const r = await p.evaluate(() => { const S = [...document.querySelectorAll('#rp-print svg.vk-dwg, #rp-print svg.vk-chart')];
        return { n: S.length, spec: document.querySelectorAll('#rp-print svg.sl-spec').length, il: document.querySelectorAll('#rp-print svg.sl-il').length,
          small: S.map(svg => { const m = svg.getScreenCTM().a; return Math.min(...[...svg.querySelectorAll('text,tspan')].filter(x => x.getAttribute('font-size')).map(x => parseFloat(x.getAttribute('font-size')) * m)); }).filter(v => !(v >= 7.5)) }; });
      assert.ok(r.spec >= 1 && r.il >= 1 && r.n >= 10, JSON.stringify(r)); assert.deepEqual(r.small, []); });
  } finally { await o.b.close(); } }
await ok('0 console errors', () => assert.deepEqual(errsAll.flat(), []));
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
