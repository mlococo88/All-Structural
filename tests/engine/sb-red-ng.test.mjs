// Steel Bridge app (SBNG, 2026-11-24; engineer, approved: the failing check's step red "NG", a warning amber, on every output tab, as #1692 /
// SBDFH did on the Cross-frames / Diaphragms tab). Display only. ui/sub.js stepSt / items / rows / mark, and on a made-up failing bridge
// (the built-in project with thinner, narrower flanges and thinner webs): every failing / warning check item or row of the Flexure, Shear &
// stiffeners, Fatigue & studs, Constructibility, Field splices and Welds tabs links to a step the tab shows, so its step is marked; a step whose
// ok is false but that no failing check links to keeps the grey class "no".
import assert from 'node:assert/strict';
import { test, loadShared } from './harness.mjs';
import { FILES, E } from './gfx-fixture.mjs';
const eq = (a, b, m) => assert.equal(JSON.stringify(a), JSON.stringify(b), m);   // values from the vm context (another realm)

const W = loadShared(...FILES, E('ui/constructibility.js'), E('ui/sub.js')), SB = W.SBDSub, M = W.SBDModel, J = o => JSON.parse(JSON.stringify(o));

test('SBNG: stepSt keeps the worst status per step; rows() marks what the tab shows red; mark() classes and tags', () => {
  const ST = SB.stepSt([{ step: 'a', st: 'warn' }, { step: 'a', st: 'fail' }, { step: 'b', st: 'warn' }, { step: 'c', st: 'pass' }, { step: 'd', st: 'adv' }, { st: 'fail' }, null]);
  eq([...ST], [['a', 'fail'], ['b', 'warn']]);
  eq(SB.items([{ items: [{ st: 'fail', step: 'x' }] }, { items: [] }]), [{ step: 'x', st: 'fail' }]);
  const R = SB.rows([{ step: 's1', ratio: 1.2, inUse: true }, { step: 's2', ratio: 1.2, inUse: false }, { step: 's3', ratio: NaN, ng: 'NG' }, { step: 's4', ratio: 0.95, inUse: true },
    { step: 's5', ratio: 1 + 1e-10, inUse: true }, { step: 's6', ratio: NaN, inUse: true }]);
  eq(R.map(e => e.st), ['fail', '', 'fail', '', '', '']);
  const m = SB.stepSt(R);
  eq(SB.mark({ id: 's1', ok: false }, m), { cls: 'no ng', tag: '<span class="ngTag">NG</span> ' });
  eq(SB.mark({ id: 'b', ok: true }, ST), { cls: 'no wn', tag: '<span class="ngTag wn">Warning</span> ' });
  eq(SB.mark({ id: 'z', ok: false }, m), { cls: 'no', tag: '' }, 'a case-selection step: grey, as before');
  eq(SB.mark({ id: 'z' }, null), { cls: '', tag: '' });
});

test('SBNG: made-up thin bridge: every failing / warning item links to a shown step (the steps the tab marks)', () => {
  const P = J(M.defaultProject());
  P.girders.forEach(g => g.segments.forEach(s => { s.tw = Math.max(0.4375, s.tw - 0.125); s.botT = Math.max(0.75, s.botT * 0.6); s.topT = Math.max(0.625, s.topT * 0.6); s.botB = Math.max(12, s.botB - 4); s.topB = Math.max(12, s.topB - 4); }));
  const B = W.SBDReportData.compute(P, 0, { src: 'analysis' }), ids = l => new Set((l || []).map(s => s.id)), n = {};
  const chk = (tab, st, step, shown) => { if (st !== 'fail' && st !== 'warn') return; n[tab] = (n[tab] || 0) + 1; assert.ok(step && shown.has(step), `${tab}: ${st} item links to ${step}`); };
  B.flex.rows.forEach(r => { const S = ids(W.SBDFlexureUI.stepsOf(B.flex, r)); SB.rows(r.checks).forEach(e => chk('flex', e.st, e.step, S)); });
  B.cn.rows.forEach(r => [r, r.alt].filter(Boolean).forEach(q => { const S = ids(W.SBDConstrUI.stepsOf(B.cn, q)); SB.rows(q.checks).forEach(e => chk('cn', e.st, e.step, S)); }));
  const SH = B.shear, tsS = new Set(), bsS = new Set();
  SH.TS.rows.forEach(r => ids(W.SBDStiffeners.transverseSteps(SH.TS, r)).forEach(x => tsS.add(x))); SH.BS.rows.forEach(r => ids(W.SBDStiffeners.bearingSteps(SH.BS, r)).forEach(x => bsS.add(x)));
  SB.items(SH.tsC).forEach(e => chk('stiff', e.st, e.step, tsS)); SB.items(SH.bsC).forEach(e => chk('stiff', e.st, e.step, bsS));
  SH.stations.forEach(r => { const S = ids(W.SBDShearUI.stepsOf(SH, 'loc', r)); SB.rows(r.checks).forEach(e => chk('shear', e.st, e.step, S)); });
  const FA = B.fat, faS = new Set(); FA.FR.rows.forEach(r => ids(W.SBDFatigueUI.stepsOf(FA, 'fa', r)).forEach(x => faS.add(x)));
  ids(W.SBDFatigueUI.stepsOf(FA, 'fd')).forEach(x => faS.add(x));   // SBLK (2026-11-24): FA4's detailing steps (faD.*), shown on selection 'fd'
  SB.items(FA.FC).forEach(e => chk('fat', e.st, e.step, faS));
  SB.items(FA.SCC).forEach(e => chk('studs', e.st, e.step, ids(W.SBDFatigueUI.stepsOf(FA, 'sc'))));
  B.spl.list.forEach(s => { if (s.CK) SB.items(s.CK).forEach(e => chk('spl', e.st, e.step, ids(W.SBDSplicesUI.stepsOf(B.spl, s)))); });
  const wS = new Set(); B.wd.R.fw.forEach(r => ids(W.SBDWeldsUI.stepsOf(B.wd, 'fw', r.i)).forEach(x => wS.add(x))); B.wd.R.tr.forEach(r => ids(W.SBDWeldsUI.stepsOf(B.wd, 'tr', r.i)).forEach(x => wS.add(x)));
  SB.items(B.wd.C).forEach(e => chk('wd', e.st, e.step, wS));
  for (const k of ['flex', 'cn', 'stiff', 'fat', 'spl']) assert.ok(n[k] > 0, `${k}: the made-up bridge has failing items (${JSON.stringify(n)})`);
  console.log(`       failing / warning items linked to shown steps: ${JSON.stringify(n)}`);
});
