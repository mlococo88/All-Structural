// apps/ps-bridge 2026-11-14 (PS Bridge catch-up, item 8a): the Summary's girder elevation, one per girder type (ui/sumelev.js PSBSumElev.model):
//   for every girder type of several projects the elevation is that type's governing line (the line of its largest group ratio) in its span;
//   every number drawn is the engine's of that cell: L, h, the strand rows (y, count, debonded count and length), the draped strands (y_end,
//   y_mid, the hold-down points frac × L), ℓ_t = R.ss.lt, ℓ_d = R.ldBonded (κ 1.6) and R.ldDebond (κ 2.0); each group's governing check of the
//   Summary model (the same object: name, ratio, station x = the check's loc, its line, the link to its tab and worked step) is marked at x,
//   or listed when it has no station (the owner's input limits). Display only.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['vizkit', 'dash', 'summary', 'sumelev'].map(n => path.join(APP, `ui/${n}.js`)));
const M = W.PSBModel, B = W.PSBBridge, J = v => JSON.parse(JSON.stringify(v));
const close = (a, b, msg) => assert.ok(Math.abs(a - b) <= 1e-12 * Math.max(1, Math.abs(b)), `${msg}: ${a} vs ${b}`);
const load = P => M.importJSON(M.exportJSON(P)).project;
const cellR = inp => W.PSBHoldDown.compute(J(inp));

function check(P, tag) {
  const A = B.results(P, cellR), SM = W.PSBSummaryUI.model(P, A);
  assert.ok(SM.types.length >= 1, tag);
  SM.types.forEach(T => {
    const m = W.PSBSumElev.model(SM, P, T.k), t = `${tag} / ${T.label}`; assert.deepEqual(J(m.errors), [], t);
    const zs = Object.values(T.groups), top = zs.reduce((b, z) => !b || z.q.r > b.q.r ? z : b, null);
    assert.equal(m.g, top.g, `${t}: the governing line`); assert.equal(m.span, T.span, `${t}: its span`);
    const R = cellR(W.PSBDesign.cellInputs(P, T.k, m.g)), ss = R.ss;
    close(m.L, R.L, `${t}: L`); close(m.h, R.g.h, `${t}: h`); close(m.lt * 12, ss.lt, `${t}: ℓ_t`); close(m.ldB * 12, R.ldBonded, `${t}: ℓ_d bonded`); close(m.ldD * 12, R.ldDebond, `${t}: ℓ_d debonded`);
    assert.deepEqual(J(m.rows), J(ss.rows.map(r => ({ y: +r.y, n: +r.n, nd: +r.nd || 0, dbnd: +r.dbnd || 0 }))), `${t}: strand rows`);
    if (ss.nh > 0) { close(m.hp.a, ss.hp.frac * R.L, `${t}: hold-down at frac × L`); close(m.hp.yEnd, ss.hp.yEnd, `${t}: y_end`); close(m.hp.yMid, ss.hp.yMid, `${t}: y_mid`); } else assert.equal(m.hp, null);
    assert.equal(m.marks.length + m.other.length, zs.length, `${t}: every group's governing check`);
    zs.forEach(z => { const q = m.marks.find(x => x.name === z.gp.name) || m.other.find(x => x.name === z.gp.name); assert.ok(q, `${t}: ${z.gp.name}`);
      close(q.r, z.q.r, `${t}: ${z.gp.name} ratio`); assert.equal(q.g, z.g, `${t}: ${z.gp.name} line`); assert.equal(q.go, `${z.k}|${z.g}|${z.gp.tab}|${z.st}|${z.gp.input ? 1 : ''}`, `${t}: ${z.gp.name} link`);
      if (m.marks.includes(q)) close(q.x, z.q.loc, `${t}: ${z.gp.name} at its station`); else assert.ok(z.gp.input || !isFinite(z.q.loc), `${t}: ${z.gp.name} listed (no station)`); });
    assert.ok(m.marks.some(q => q.gov) || m.other.some(q => q.gov), `${t}: the type's governing check flagged`);
    const s = W.PSBSumElev.svg(m, 760).svg; assert.match(s, /^<svg/); assert.equal((s.match(/class="se-mark"/g) || []).length, m.marks.length, `${t}: a marker per check with a station`);
  });
}
test('Summary elevation: new project (Interior / Exterior; draped strands)', () => check(load(M.newProject()), 'new'));
test('Summary elevation: three spans made continuous (pier checks), debonded rows, a third type', () => {
  const P = load(M.newProject()); P.spans.lengths = [100, 120, 100]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0, 0]; B.syncSpans(P);
  P.base.rows = [{ n: 12, y: 2, dbnd: 8, nd: 4 }, { n: 12, y: 4, dbnd: 0, nd: 0 }, { n: 4, y: 6, dbnd: 0, nd: 0 }];
  const k = B.addType(P, 0, { label: 'G3 own' }); P.types[k].ovr = { 'mat.fc': 7 }; B.assignLine(P, k, 3); check(P, 'continuous');
});
test('Summary elevation: CTDOT owner limits (no station: listed), box beams without draped strands', () => {
  const P = load(M.newProject()); P.base.owner = 'CTDOT'; P.base.mat.fci = 6.8; check(P, 'CTDOT');
  const Q = load(M.newProject()); Q.base.girder = 'AASHTO BIII-36 (39in)'; Q.base.ts = 6; Q.base.harp.n = 0; Q.base.rows = [{ n: 16, y: 2, dbnd: 0, nd: 0 }]; Q.xs.bays = [3, 3, 3, 3]; Q.xs.ohL = 1.5; Q.xs.ohR = 1.5; check(load(Q), 'box');
});
