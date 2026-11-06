#!/usr/bin/env node
// Light Pole and Sign Post: the sign views (LPSV, added 2026-11-02) — the 3D card of the Geometry tab and the sign sheets of the
// Drawings tab, monopost and two-post, IBC and LRFDLTS modes, at 1280 and 390 px. Headless Chromium (three.js r128 and KaTeX served
// from tests/libs). Checks per case: no console / page errors; the Drawings sheets build (front, side, plan, section(s), plate, notes),
// the DXF passes SharedDxf.validate and has no NaN / undefined; no text of a sheet overlaps another text (tests/engine/overlap.mjs);
// the sheet values are the tool's results (embedment d or L, bars); the 3D canvas renders (non-blank pixels) with the layer toggles,
// views and Save PNG; no horizontal page scroll; the pole mode has no 3D card. Display only: nothing here checks or changes a result.
//   node tests/smoke/lightpole-signviews.mjs [--shots <dir>]
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { openPage, REPO } from '../lib.mjs';
import { textOverlaps, describe } from '../engine/overlap.mjs';

const LP = path.join(REPO, 'Light Pole and Sign Post.html');
const args = process.argv.slice(2), shots = args.includes('--shots') ? args[args.indexOf('--shots') + 1] : null;
const X = (() => { const c = { console }; c.window = c; vm.createContext(c); vm.runInContext(fs.readFileSync(path.join(REPO, 'shared/dxf.js'), 'utf8'), c); return c.SharedDxf; })();
const CASES = {
  ibc1: { top: { appMode: 'sign', signPosts: 1 } },
  ibc2: { inputs: { signB: '16', signS: '5' }, top: { appMode: 'sign', signPosts: 2 } },
  ibc1rect: { inputs: { poleShape: 'rect', poleDiaTop: '8', poleDepthTop: '6', poleTwTop: '0.3125', shaftShape: 'square', rebarMode: 'manual', manBarN: '8' }, top: { appMode: 'sign', signPosts: 1 } },
  ibc2wide: { inputs: { signB: '40', signS: '3', signClr: '8', signSpacing: '20', poleDiaTop: '8', poleTwTop: '0.322' }, top: { appMode: 'sign', signPosts: 2 } },
  lts1: { inputs: { bromsSoil: 'cohesive', bromsC: '1.2' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 1 } },
  lts2: { inputs: { signB: '16', signS: '5', bromsSoil: 'cohesionless' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } },
  ltsNoBroms: { top: { codeMode: 'lts', appMode: 'sign', signPosts: 2 } },
  pole: {},
  // LPAS (2026-11-02): square base plate (B × B) — sign IBC two-post with square posts, LRFDLTS monopost
  ibc2sqpl: { inputs: { poleShape: 'square', poleDiaTop: '8', bpShape: 'square', bpB: '22' }, top: { appMode: 'sign', signPosts: 2 } },
  lts1sqpl: { inputs: { bromsSoil: 'cohesive', bromsC: '1.2', bpShape: 'square', bpB: '22' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 1 } },
  // LPPJ (2026-11-03): shaft projection above grade p = 2 ft (the shaft, plate and post drawn p above grade)
  ibc2proj: { inputs: { signB: '16', signS: '5', shaftProj: '2' }, top: { appMode: 'sign', signPosts: 2 } },
  lts1proj: { inputs: { bromsSoil: 'cohesive', bromsC: '1.2', shaftProj: '2' }, top: { codeMode: 'lts', appMode: 'sign', signPosts: 1 } },
};
let fails = 0; const check = (ok, m) => { console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${m}`); if (!ok) fails++; };
for (const vw of [1280, 390]) for (const [name, mut] of Object.entries(CASES)) {
  const o = await openPage(LP, { vw, vh: vw > 600 ? 900 : 844 });
  try {
    await o.p.waitForFunction(() => typeof window.applyState === 'function' && typeof window.THREE === 'object', null, { timeout: 20000 });
    await o.p.evaluate(m => { const st = JSON.parse(JSON.stringify(DEFAULT_STATE)); Object.assign(st.inputs, m.inputs || {}); Object.assign(st, m.top || {}); applyState(st); switchTab('geometry'); }, mut);
    await o.p.waitForTimeout(700);
    const tag = `${name} @${vw}`;
    const r = await o.p.evaluate(() => {
      const d = typeof lpsvData === 'function' ? lpsvData() : null, out = { sign: appMode === 'sign', card: !!document.getElementById('lp3dCard'), err: d && d.error || null };
      const cv = document.getElementById('lp3dCanvas');
      if (cv && LPSV.r) { lpsvRenderNow(); const gl = LPSV.r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4 * w * h); gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
        let n = 0; for (let i = 0; i < px.length; i += 4 * 97) if (px[i] < 240 || px[i + 1] < 240 || px[i + 2] < 240) n++; out.px = n; out.cw = cv.clientWidth; out.hostW = cv.parentElement.clientWidth;
        out.layers = Object.keys(LPSV.grp || {}).length; out.cage = LPSV.grp && LPSV.grp.cage ? LPSV.grp.cage.children.length : 0; }
      if (d && !d.error) {
        const B = lpdBuild(d), txt = B.D.toDXF({ ltscale: 1 }), v = SharedDxf.validate(txt);
        out.sheets = B.S.map(s => ({ id: s.id, k: s.k, over: s.over, E: B.D.E.slice(s.i0, s.i1) }));
        out.dxfOk = v.ok; out.dxfErr = v.errors.slice(0, 3); out.nan = /NaN|undefined|Infinity/.test(txt);
        out.d = d.stacks.map(s => s.found.d); out.bars = d.stacks.map(s => '(' + s.found.reo.long.n + ') ' + s.found.reo.long.bar.n); out.allText = B.D.E.filter(e => e.t === 'TEXT' || e.t === 'DIM').map(e => e.s).join(' | ');
      }
      return out;
    });
    if (name === 'pole') { check(!r.card, `${tag}: pole mode has no 3D card`); }
    else if (name === 'ltsNoBroms') {
      // LTS-L2 (#744, 2026-11-03): in the LRFDLTS mode a missing Broms soil model is an input error. The LTS run is blocked, so there are
      // no LTS results: the input error box names the Broms model, the output tabs are hidden, and the 3D card and the Drawings tab say
      // there are no results (before #744 the views said "select the Broms soil model" and the 3D drew the panel and posts).
      const nb = await o.p.evaluate(() => ({ box: (document.getElementById('lppInErr') || {}).innerText || '', blocked: !!document.querySelector('.lpp-blocked'),
        host: (document.getElementById('lp3dHost') || {}).innerText || '', canvas: !!document.getElementById('lp3dCanvas'), dwg: (document.getElementById('lpdHost') || {}).innerText || '' }));
      check(/Broms soil model/.test(nb.box) && nb.blocked, `${tag}: no Broms model → input error names it and the results are not shown (${nb.box.replace(/\s+/g, ' ').slice(0, 90)}…)`);
      check(/no LRFDLTS results/.test(r.err || '') && /^No 3D view/.test(nb.host) && !nb.canvas, `${tag}: 3D card shows no view (${nb.host})`);
    }
    else {
      check(r.card && r.px > 100, `${tag}: 3D canvas rendered (${r.px} sampled non-white px, ${r.layers} layer groups, ${r.cage} cage meshes)`);
      check(r.cw <= r.hostW + 1, `${tag}: 3D canvas fits its card (${r.cw} / ${r.hostW} px)`);
      check(r.sheets && r.sheets.map(s => s.id).join(',').startsWith('elev,side,plan,sec0'), `${tag}: sheets ${r.sheets && r.sheets.map(s => s.id + '@' + s.k).join(' ')}`);
      check(r.sheets && r.sheets.every(s => !s.over), `${tag}: every sheet fits at a standard scale`);
      check(r.dxfOk && !r.nan, `${tag}: DXF valid, no NaN/undefined ${r.dxfErr.join('; ')}`);
      const d0 = X.fmtFtIn(r.d[0] * 12), lbl = name.startsWith('lts') ? 'L = ' : 'd = ';
      check(r.allText.includes(lbl + d0), `${tag}: the embedment of the results is dimensioned (${lbl}${d0})`);
      check(r.allText.includes(r.bars[0].replace(/^\(\d+\) /, m => m) + ' VERT.'), `${tag}: the cage of the results is called out (${r.bars[0]})`);
      for (const s of r.sheets) { const D = { E: s.E, h: 0.1 * s.k }, ov = textOverlaps(D, X); check(!ov.length, `${tag}: sheet ${s.id}: no text overlaps${ov.length ? ' — ' + ov.slice(0, 3).map(describe).join('; ') : ''}`); }
      // views, toggles, Save PNG
      const ui = await o.p.evaluate(async () => { const h = document.getElementById('lp3dHost'); const b = k => h.querySelector(`[data-v3="${k}"]`).click();
        b('front'); const f = LPSV.orb.az; b('side'); const s = LPSV.orb.az; b('reset'); const cb = h.querySelector('[data-l3="shaft"]'); cb.click(); const vis = LPSV.grp.shaft.visible; cb.click();
        return { f, s, vis, back: LPSV.grp.shaft.visible }; });
      check(Math.abs(ui.f + Math.PI / 2) < 1e-9 && Math.abs(ui.s) < 1e-9 && ui.vis === false && ui.back === true, `${tag}: Front / Side views and the layer toggle work`);
      const [dl] = await Promise.all([o.p.waitForEvent('download', { timeout: 5000 }).catch(() => null), o.p.evaluate(() => document.querySelector('[data-v3="png"]').click())]);
      check(!!dl && /_3d\.png$/.test(dl.suggestedFilename()), `${tag}: Save PNG downloads ${dl ? dl.suggestedFilename() : '(none)'}`);
    }
    // the Drawings tab shows (both code modes) and the page does not scroll sideways
    await o.p.evaluate(() => switchTab('drawings')); await o.p.waitForTimeout(400);
    const pg = await o.p.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, dwg: !!(document.querySelector('.lpdCard') && document.querySelector('.lpdCard').offsetParent), svg: !!document.querySelector('#lpdHost svg') }));
    if (name !== 'pole' && name !== 'ltsNoBroms') check(pg.dwg && pg.svg, `${tag}: Drawings tab shows the sheet preview`);
    if (name === 'ltsNoBroms') { const t = await o.p.evaluate(() => (document.getElementById('lpdHost') || {}).innerText || ''); check(/^No drawings/.test(t) && !pg.svg, `${tag}: Drawings tab has no sheets (${t})`); }
    check(pg.sw <= pg.cw + 1, `${tag}: no horizontal page scroll (${pg.sw} / ${pg.cw})`);
    if (shots && name !== 'pole') { fs.mkdirSync(shots, { recursive: true }); await o.p.evaluate(() => switchTab('geometry')); await o.p.waitForTimeout(300);
      const c = await o.p.$('#lp3dCard'); if (c) await c.screenshot({ path: path.join(shots, `${name}-3d-${vw}.png`) }); }
    check(!o.errs.length, `${tag}: no console errors ${o.errs.slice(0, 2).join(' | ')}`);
  } finally { await o.b.close(); }
}
console.log(fails ? `\n${fails} FAILED` : '\nALL PASS');
process.exit(fails ? 1 : 0);
