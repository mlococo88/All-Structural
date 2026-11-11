#!/usr/bin/env node
// Bridge Substructure Loading (SubLoads): tab graphics in the Steel Bridge "option C" style and input tooltips (SLGX, 2026-11-11; display only):
//   - Geometry tab plan, elevation and unit elevations, the Live load governing arrangement and the load diagrams are drawn with the vizkit
//     palette (svg.vk-dwg in a white .vk-dwg-box), bearings fixed orange #DC6B2F / expansion blue #2563EB, labels with a white halo;
//   - labels readable: plan and elevation text 10 px or more at 1440 px and 7.5 px or more at 390 px (the box scrolls sideways there, the page
//     does not); no two labels of the plan or the elevation overlap (bounding boxes) at either width, for the default and two other projects;
//     at 390 px every tab graphic (unit elevations, Live load arrangement, load diagrams) 7.5 px or more in its own sideways-scrolling box;
//   - the Drawings tab and the DXF unchanged: the DXF text identical to the one written before this change (sldwBuild entity hash, --ref);
//   - every input field has a tooltip (title) on every input tab and unit: at least 43 distinct tooltips, none empty;
//   - 0 console errors.
//   node tests/smoke/bsl-graphics.mjs [--ref <git ref, default origin/main>] [--shots <dir>]
import assert from 'assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = process.env.BSL_FILE || path.join(REPO, 'Bridge Substructure Loading.html'), SHOTS = arg('shots', null), REF = arg('ref', 'origin/main');
let fails = 0; const errsAll = [];
const ok = async (m, f) => { try { await f(); console.log('  ok   ' + m); } catch (e) { fails++; console.log('  FAIL ' + m + ': ' + String(e.message).slice(0, 500)); } };
const ready = p => p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G && window.SubLoadsLayout).then(() => p.waitForTimeout(700));
const PROJ = ['default', 'skew30', 'pile_ham_massdot'];
const proj = n => n === 'default' ? null : fs.readFileSync(path.join(REPO, 'tests', 'projects', 'bsl', n + '.json'), 'utf8');
// the text labels of one svg: font px and pairwise overlaps (bounding boxes, 0.5 px tolerance)
const measure = sel => `(() => { const out = []; document.querySelectorAll('${sel}').forEach((svg, si) => { const T = [...svg.querySelectorAll('text')].filter(t => t.textContent.trim()).map(t => ({ s: t.textContent, r: t.getBoundingClientRect(), fs: t.getBoundingClientRect().height }));
  let over = []; for (let i = 0; i < T.length; i++) for (let j = i + 1; j < T.length; j++) { const a = T[i].r, b = T[j].r; const ox = Math.min(a.right, b.right) - Math.max(a.left, b.left), oy = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top); if (ox > 0.5 && oy > 0.5) over.push(T[i].s + ' / ' + T[j].s); }
  const fz = [...svg.querySelectorAll('text')].map(t => parseFloat(t.getAttribute('font-size')) * svg.getScreenCTM().a);
  out.push({ si, n: T.length, minPx: Math.min(...fz), over }); }); return out; })()`;

for (const vw of [1440, 390]) {
  const o = await openPage(FILE, { vw, vh: 1000 }), { p } = o; errsAll.push(o.errs);
  try { await ready(p);
    for (const pn of PROJ) {
      if (proj(pn)) await p.evaluate(([j, n]) => openProject(JSON.parse(j), n), [proj(pn), pn + '.json']);
      await p.evaluate(() => showTab('geometry')); await p.waitForTimeout(400);
      const m = await p.evaluate(measure('#tab-geometry svg.dwg-geo'));
      await ok(`${vw} px, ${pn}: plan and elevation in the option C style, labels ${vw >= 1000 ? '≥ 10' : '≥ 7.5'} px, no overlaps; no page scroll`, async () => {
        assert.equal(m.length, 2);
        const st = await p.evaluate(() => ({ vk: document.querySelectorAll('#tab-geometry .vk-dwg-box svg.vk-dwg').length, halo: document.querySelector('#tab-geometry svg.vk-dwg text').getAttribute('paint-order'),
          brg: [...document.querySelectorAll('#tab-geometry svg.dwg-geo [fill]')].map(e => e.getAttribute('fill')).filter(f => /#DC6B2F|#2563EB/i.test(f)).length, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth }));
        assert.ok(st.vk >= 2 + 4, 'vk graphics ' + st.vk); assert.equal(st.halo, 'stroke'); assert.ok(st.brg > 0, 'bearing colours'); assert.equal(st.sw, 0, 'page scroll');
        m.forEach(x => { assert.ok(x.minPx >= (vw >= 1000 ? 10 : 7.5) - 0.01, `svg ${x.si}: ${x.minPx.toFixed(2)} px`); assert.deepEqual(x.over, [], `svg ${x.si} overlaps`); });
      });
      if (SHOTS && pn === 'default') { fs.mkdirSync(SHOTS, { recursive: true }); await p.screenshot({ path: path.join(SHOTS, `slgx_geometry_${vw}.png`), fullPage: false }); }
    }
    if (vw === 390) {
      await p.evaluate(() => { P = defP(); syncSupports(); buildTabs(); buildSide(); recompute(); });
      await ok('390 px: every tab graphic (unit elevations, Live load arrangement, load diagrams) labels ≥ 7.5 px in a box that scrolls sideways; no page scroll', async () => {
        const r = await p.evaluate(async () => { const out = []; for (const t of ['geometry', 'll', 'wind', 'earth']) { P.ui.sel = t === 'earth' ? 0 : 1; showTab(t); await new Promise(r => setTimeout(r, 250));
          document.querySelectorAll(`#tab-${t} svg.vk-dwg`).forEach(svg => { const fz = [...svg.querySelectorAll('text')].map(x => parseFloat(x.getAttribute('font-size')) * svg.getScreenCTM().a); out.push([t, Math.min(...fz)]); }); }
          return { out, sw: document.documentElement.scrollWidth - document.documentElement.clientWidth }; });
        assert.equal(r.sw, 0); assert.ok(r.out.length >= 8, 'graphics ' + r.out.length); r.out.forEach(([t, v]) => assert.ok(v >= 7.5, `${t}: ${v.toFixed(2)} px`)); });
    }
    if (vw === 1440) {
      await p.evaluate(() => { P = defP(); syncSupports(); buildTabs(); buildSide(); recompute(); });
      await ok('Live load arrangement and the load diagrams in the same style', async () => {
        const r = await p.evaluate(async () => { P.ui.sel = 1; showTab('ll'); await new Promise(r => setTimeout(r, 200)); const a = document.querySelectorAll('#tab-ll .vk-dwg-box svg.vk-dwg').length; showTab('wind'); await new Promise(r => setTimeout(r, 200)); return { a, b: document.querySelectorAll('#tab-wind .vk-dwg-box svg.vk-dwg').length }; });
        assert.ok(r.a >= 1 && r.b >= 1, JSON.stringify(r)); });
      await ok('every input field has a tooltip on every input tab and unit (at least 43 distinct, none empty)', async () => {
        const r = await p.evaluate(() => { const T = new Set(), miss = [];
          for (const b of document.querySelectorAll('#itabs .itab')) for (let k = 0; k < P.units.length; k++) { P.ui.sel = k; b.click();
            document.querySelectorAll('#sidebar .fld').forEach(f => { const c = f.querySelector('[data-k], [data-list], [data-ro]'); if (!c) return; const t = f.getAttribute('title') || c.getAttribute('title') || ''; if (!t.trim()) miss.push(b.dataset.pane + ':' + (c.dataset.k || c.dataset.list || c.dataset.ro)); else T.add(t); }); }
          P.ui.sel = 1; document.querySelector('.itab[data-pane="units"]').click(); return { n: T.size, miss: [...new Set(miss)] }; });
        assert.deepEqual(r.miss, []); assert.ok(r.n >= 43, 'tooltips ' + r.n); });
      await ok(`the Drawings tab and the DXF unchanged (DXF text identical to ${REF})`, async () => {
        const dxf = async (pg) => pg.evaluate(async () => { const B = sldwBuild(); return JSON.stringify(B.S.map(s => s.id)) + '|' + (typeof sldwDxfText === 'function' ? sldwDxfText(B) : ''); });
        const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', REF], { encoding: 'utf8' }).trim(), dir = path.join(os.tmpdir(), 'allstruct-tests', 'bsl-' + sha), F0 = path.join(dir, 'Bridge Substructure Loading.html');
        if (!fs.existsSync(path.join(dir, '.done'))) { fs.mkdirSync(dir, { recursive: true }); execFileSync('sh', ['-c', `git -C "${REPO}" archive ${sha} "Bridge Substructure Loading.html" shared | tar -x -C "${dir}"`]); fs.writeFileSync(path.join(dir, '.done'), sha); }
        const o0 = await openPage(F0, { vw: 1440, vh: 1000 }); try { await o0.p.waitForFunction(() => typeof MODEL !== 'undefined' && MODEL && MODEL.G); await o0.p.waitForTimeout(700);
          const get = pg => pg.evaluate(async () => { const [dl] = await Promise.all([new Promise(res => { const a0 = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () { HTMLAnchorElement.prototype.click = a0; fetch(this.href).then(r => r.text()).then(res); }; }), Promise.resolve(sldwDownload())]); return dl; });
          const a = await get(o0.p), b = await get(p); assert.ok(a.length > 1000, 'dxf ' + a.length); assert.equal(b, a); } finally { await o0.b.close(); } });
    }
  } finally { await o.b.close(); }
}
await ok('0 console errors', () => assert.deepEqual(errsAll.flat(), []));
if (fails) { console.log(`${fails} failure(s)`); process.exit(1); }
console.log('all passed');
