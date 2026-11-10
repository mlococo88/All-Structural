// DETC (2026-11-10): the detail drawings and plans of apps/steel-bridge moved to the option C screen style (ui/gfxdet.js); their Download DXF must stay the CAD
// drawing it was, byte for byte. This test builds every CAD drawing of the families (c) details and (d) plans for the built-in project (interior and exterior
// girder, X / K frames) and two hand-off payloads, and compares the SHA-256 of each DXF text with tests/baselines/dxf-detc.json, recorded on origin/main
// before the change (RECORD_DXF=1 node tests/engine/run.mjs dxf-detc, run on main, writes it). Graphics: #6 Flexure LTB sketch (every location row),
// #8 overhang bracket, #10 transverse stiffener (every row), #11 bearing stiffener (every row), #14 cross-frame (X, Kb, Kt), #16 weld detail (every
// location), #17 splice strip, #18 field splice (every splice), #2 LLDF cross-section (every girder, region and case).
// The LTB sketch and the bracket are taken from the tab functions with SBDGraphics.mount recorded (the path main has); where the branch exports the
// builder (SBDGfxA.ltbGraphic, constrOhGraphic) its DXF is checked to be the same text.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { test, ROOT } from './harness.mjs';
import { loadShared } from './harness.mjs';
import { FILES, E } from './gfx-fixture.mjs';
import { projectFromPayload, readPayload } from './an-fixture.mjs';

const W = loadShared(...FILES, E('ui/constructibility.js'), E('ui/gfxa.js'));
const M = W.SBDModel, GA = W.SBDGfxA, GB = W.SBDTabGfxB, GR = W.SBDGraphics, J = o => JSON.parse(JSON.stringify(o));
const BASE = path.join(ROOT, 'tests/baselines/dxf-detc.json');
const h = g => crypto.createHash('sha256').update(g.D.toDXF({ ltscale: 1 })).digest('hex').slice(0, 24);
const made = []; GR.mount = (el, build) => { const g = build(); made.push(g); return { select() {}, graphic: g }; };
const slot = () => ({ _h: '', set innerHTML(v) { this._h = v; }, get innerHTML() { return this._h; }, querySelector: () => ({ addEventListener() {}, value: '', innerHTML: '' }), querySelectorAll: () => [] });
const run = (fn, a) => { made.length = 0; fn(slot(), a); return made.slice(); };

function projects() {
  const P0 = J(M.defaultProject()); P0.framing = { ...M.defaultFraming(), splices: [82] };
  const P1 = J(P0); P1.girders[0].position = 'exterior';
  const out = [['built-in', P0, null], ['built-in exterior', P1, null]];
  [['gd_builtin28_AASHTO_G1.json', { nb: 5, bays: [9.5, 9.5, 9.5, 9.5], skews: [28, 28, 28, 28], spl: [82, 145, 215, 278] }], ['gd_xsA_AASHTO_G5.json', { nb: 3, bays: [11, 11], skews: [10, 30, 40, 25], spl: [100, 260] }]].forEach(([f, o]) => {
    const pl = readPayload(f), P = projectFromPayload(pl); P.xs = M.defaultXs(P); Object.assign(P.xs, { nb: o.nb, bays: o.bays, skews: o.skews });
    P.framing = { ...M.defaultFraming(), splices: o.spl }; P.stiffeners = M.defaultStiffeners(); P.crossframes = M.defaultCrossframes(); P.ownerRules = P.ownerRules || { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    out.push([f, P, pl]); });
  return out;
}

test('DETC: the DXF of every detail drawing and plan is unchanged from origin/main (SHA-256 of the DXF text)', () => {
  const got = {}, put = (k, g) => { assert.ok(g && g.D, k); got[k] = h(g); };
  for (const [name, P, pl] of projects()) {
    // #6 LTB sketch: every row of the Flexure tab
    const FX = W.SBDFlexureUI.build({ P, g: 0, src: pl ? 'example' : 'analysis' });
    if (!FX.err) FX.rows.forEach((r, i) => { const gs = run(GA.flexure, { P, gi: 0, R: FX, sel: i }); put(`${name}|ltb|${i}`, gs[2]); if (GA.ltbGraphic) assert.equal(GA.ltbGraphic(r).D.toDXF({ ltscale: 1 }), gs[2].D.toDXF({ ltscale: 1 }), `${name} ltb ${i}: builder = tab`); });
    // #8 overhang bracket (exterior girder)
    const CN = W.SBDConstrUI.build({ P, g: 0 }); if (!CN.err && CN.F && CN.F.oh) { const gs = run(GA.constr, { P, gi: 0, R: CN, sel: 0 }); put(`${name}|oh`, gs[1]); if (GA.ohGraphic) assert.equal(GA.ohGraphic(P, 0, CN).D.toDXF({ ltscale: 1 }), gs[1].D.toDXF({ ltscale: 1 }), `${name} oh: builder = tab`); }
    // #2 LLDF cross-section: every girder, region and case
    const LR = W.SBDUiLoads.calc(P, 0); if (!(LR.errors && LR.errors.length)) LR.regions.forEach((rg, lr) => rg.members.forEach((m, lg) => { const g0 = GA.loadsGraphic(P, LR, lg, lr, ''); put(`${name}|lldf|${lg}|${lr}|`, g0); g0.opts.forEach(([k]) => put(`${name}|lldf|${lg}|${lr}|${k}`, GA.loadsGraphic(P, LR, lg, lr, k))); }));
    // #10, #11 stiffeners
    const SR = W.SBDShearUI.build({ P, g: 0, ...(pl ? { pl } : {}) }); if (!SR.err) { (SR.TS && SR.TS.rows || []).forEach((r, i) => put(`${name}|ts|${i}`, GB.shearDetail(SR, P, { i }))); put(`${name}|ts|gov`, GB.shearDetail(SR, P, {})); SR.BS.rows.forEach((r, i) => put(`${name}|bs|${i}`, GB.shearBearing(SR, P, { i }))); }
    // #14 cross-frame: X, Kb, Kt
    ['X', 'Kb', 'Kt'].forEach(t => { const Q = J(P); Q.crossframes = Q.crossframes || M.defaultCrossframes(); Q.crossframes.type = t; const B = W.SBDFramingUI.build({ P: Q, g: 0 }); if (B && B.R && !B.err) { put(`${name}|cf|${t}`, GB.crossframe(B, Q, {})); put(`${name}|cf|${t}|dia`, GB.crossframe(B, Q, { dia: true })); } });
    // #16 weld detail: every flange-to-web weld location
    const WB = W.SBDWeldsUI.build(pl ? { P, g: 0, src: 'file', pl, plName: name } : { P, g: 0, src: 'analysis' }); if (!WB.err) { WB.R.fw.forEach(r => put(`${name}|weld|${r.i}`, GB.weldDetail(WB, P, { i: r.i }))); put(`${name}|weld|gov`, GB.weldDetail(WB, P, {})); }
    // #17, #18 field splices
    if (!pl) { const AR = W.SBDAnalysis.analyzeGirder(P, 0), Gs = W.SBDSplices.girder(P, 0, AR, { env: W.SBDSplicesUI.envOf(P) });
      Gs.list.forEach((s, i) => { put(`${name}|splice|${i}`, GB.splice(s, {})); [0, -1].forEach(sel => put(`${name}|strip|${sel}|${i}`, GB.spliceStrip(Gs.list, P, { sel: sel < 0 ? undefined : i }))); put(`${name}|strip|narrow|${i}`, GB.spliceStrip(Gs.list, P, { sel: i, narrow: true })); }); }
  }
  const n = Object.keys(got).length; assert.ok(n > 150, 'cases ' + n);
  if (process.env.RECORD_DXF) { fs.writeFileSync(BASE, JSON.stringify(got, null, 0).replace(/,"/g, ',\n"') + '\n'); console.log(`       recorded ${n} DXF hashes in ${path.relative(ROOT, BASE)}`); return; }
  const want = JSON.parse(fs.readFileSync(BASE, 'utf8')), diff = Object.keys(want).filter(k => want[k] !== got[k]), miss = Object.keys(want).filter(k => !(k in got));
  assert.deepEqual(miss, [], 'cases not built'); assert.deepEqual(diff, [], 'DXF changed'); console.log(`       ${n} DXF texts identical to origin/main`);
});
