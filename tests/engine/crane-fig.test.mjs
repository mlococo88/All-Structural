// Crane Pick Analyzer (apps/crane-pick), C9: the Crane tab's figures (ui/cranefig.js, no DOM). Node only, with the SYNTHETIC fake cranes of
// tests/smoke/crane-fake-wheeled.json / crane-fake-crawler.json (made-up values).
//   node tests/engine/run.mjs crane
//
// The figures calculate nothing: every label is an engine value, with its source. Checked here: the plan dimensions = engine/cranes.js
// planDims / engine/lift.js footprint (and the file's printed page), the elevation = engine/elev.js at the pick (the C3-1 hand case:
// L 60, R 30, chart angle 61°, pad 100, h_f 8: z_tip = 100 + 8 + 60 sin 61° = 160.4772), the chart markers = every rated cell of the chart,
// the step line = engine/cranes.js lookup, the operating points = the lifts' own evaluations (C2-2 hand case 56.41 %; C5 tandem 88.89 %),
// the weights = engine/ground.js (C4 case A, front float 41,083.33 lb), the assumed-value flags (head allowance, boom width, boom CG
// fraction; crawler: boom foot, heights), and that planDims / geomOf are unchanged by their new provenance fields.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick');
const W = loadShared('steps.js', 'boussinesq.js', 'dxf.js', ...['geo', 'model', 'osha', 'cranes', 'lift', 'elev', 'clear3d', 'ground', 'tandem', 'route'].map(f => path.join(APP, 'engine', f + '.js')),
  path.join(APP, 'report', 'builders.js'), path.join(APP, 'ui', 'drawset.js'), path.join(APP, 'ui', 'cranefig.js'));
const K = W.CranePickCranes, LF = W.CranePickLift, M = W.CranePickModel, T = W.CranePickTandem, GR = W.CranePickGround, EL = W.CranePickElev, F = W.CranePickCraneFig, DS = W.CranePickDrawSet;
const J = v => JSON.parse(JSON.stringify(v)), same = (a, b, m) => assert.deepEqual(J(a), J(b), m);
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const rd = f => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', f), 'utf8'));
const rawW = rd('crane-fake-wheeled.json'); rawW.app_inputs = { ph4: { carrierLb: 40000, carrierCg: 0, upperLb: 30000, upperCg: 0, boomLb: 6000, cwRad: 10 } };
const WH = K.parse(rawW).crane, CW = K.parse(rd('crane-fake-crawler.json')).crane;
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
function project() {
  const P = M.newProject(); P.cranes = [M.normCrane({ id: 'c1', def: WH, src: { from: 'file' } }), M.normCrane({ id: 'c2', def: CW, src: { from: 'file' } })];
  P.setups = [M.normSetup({ id: 'u0', name: 'Crane A', craneId: 'c1', x: 500, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 60, pad: 100 }),
    M.normSetup({ id: 'u1', name: 'Crane 1', craneId: 'c1', x: 1000, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 80, pad: 100 }),
    M.normSetup({ id: 'u2', name: 'Crane 2', craneId: 'c1', x: 1100, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 80, pad: 100 })];
  P.picks = [M.normPick({ id: 'k1', name: 'Pick 1', setupId: 'u0', pick: { x: 500, y: 2030 }, set: { x: 500, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short' })];
  P.tandems = [M.normTandem({ id: 't1', name: 'Tandem 1', type: 'tandem', slots: ['u1', 'u2'], girder: { L: 60, W: 40000, cg: 28, H: 6 },
    hooks: [{ s: 10, rig: 1000, hook: 1000, rigH: 10, blk: 4 }, { s: 50, rig: 1000, hook: 1000, rigH: 10, blk: 4 }], pick: { x: 1050, y: 1980, h: 90, z: 105 }, set: { x: 1050, y: 2000, h: 90, z: 120 } })];
  return M.normalize(JSON.parse(JSON.stringify(P)));
}
function ctxOf(P) {
  const S = LF.settingsOf(P), su = id => P.setups.find(u => u.id === id), cr = u => P.cranes.find(c => c.id === u.craneId).def;
  return { evalPick: k => { const u = su(k.setupId), c = cr(u), ev = LF.evaluate(c, u, k, S, 'k'); ev.elev = EL.evaluate(c, u, k, ev, 'k.el'); ev.ground = GR.evaluate(c, u, k, P, 'k.gr'); return ev; },
    evalT: t => { const us = t.slots.slice(0, 2).map(su); return T.evaluate(t, { setups: us, cranes: us.map(cr), items: P.items, P, s: Object.assign(LF.settingsOf(P), { tandem: P.lift.tandem || 75 }), zPad: EL.padEl(us[0]) }, 'tg'); } };
}
/* the labels of an SVG: data-v -> { val, src, assumed, text } */
function labelsOf(svg) {
  const out = {}; const re = /<(text|rect|circle)\b([^>]*)>([\s\S]*?)(?=<(?:text|rect|circle|line|path|polygon|polyline|\/svg)\b|$)/g; let m;
  while ((m = re.exec(svg))) { const at = m[2], v = /data-v="([^"]*)"/.exec(at); if (!v) continue; const g = k => { const x = new RegExp(`data-${k}="([^"]*)"`).exec(at); return x ? x[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&') : null; };
    out[v[1]] = { val: g('val'), src: g('src'), assumed: /data-assumed="1"/.test(at), text: m[3].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&') }; }
  return out;
}
const num = x => +x.val;

test('crane figures: plan dimensions and sources = planDims / footprint (file pages); planDims and geomOf values unchanged by the provenance fields', () => {
  const P = project(), m = F.model(P, ctxOf(P), { craneId: 'c1', setupId: 'u0', at: 'pick' }), pd = K.planDims(WH), L = labelsOf(F.svg(F.plan(m)));
  assert.equal(num(L.tail), pd.tail); assert.equal(L.tail.src, 'file p.1'); assert.match(L.tail.text, /tail swing R_t = 15\.00 ft/);
  assert.equal(num(L.spread), 24); assert.equal(L.spread.src, 'file p.1'); assert.equal(num(L.xF), pd.outr.xFront); assert.equal(num(L.xR), pd.outr.xRear);
  assert.equal(num(L.bodyF), pd.body.front); assert.equal(num(L.bodyR), pd.body.rear); assert.equal(num(L.bodyW), pd.body.width); assert.equal(L.bodyF.src, 'file p.1 (derived)');
  assert.equal(num(L.float), 2); assert.equal(num(L.e), 2); assert.equal(num(L.rcw), 10); assert.equal(L.rcw.src, 'entered');
  const fp = LF.footprint(WH, Object.assign({}, P.setups[0], { x: 0, y: 0, heading: 0 })); assert.equal(fp.floatC.length, 4); assert.equal(fp.spread, 'full');
  // provenance only: a planDims / geomOf without src / page equals the values the C2 / C3 tests check
  const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.src; delete c.page; return c; };
  same(strip(pd), { kind: 'wheeled', tail: 15, boomFoot: 2, body: { front: 26, rear: 14, width: 10 }, outr: { xFront: 12, xRear: 12, spreads: { full: 24, mid: 16 }, float: 2 }, crawler: null, assumed: [] });
  const g = strip(EL.geomOf(WH)); same([g.footH, g.footE, g.head, g.boomW, g.cwBot, g.cwTop, g.maxAng], [8, 2, 0, 0, 4, 10, 80]);
});

test('crane figures: elevation at the pick = engine/elev.js (C3-1 hand case z_tip 160.4772), assumed values flagged', () => {
  const P = project(), ctx = ctxOf(P), m = F.model(P, ctx, { craneId: 'c1', setupId: 'u0', at: 'pick' }), ev = ctx.evalPick(P.picks[0]), L = labelsOf(F.svg(F.elev(m)));
  near(num(L['pt.R']), 30, 1e-9); near(num(L['pt.zTip']), 100 + 8 + 60 * Math.sin(61 * Math.PI / 180), 1e-9, 'z_tip'); near(num(L['pt.zTip']), ev.elev.pick.zTip, 1e-12);
  near(num(L['pt.theta']), 61, 1e-9); near(num(L['pt.m']), ev.elev.pick.margin, 1e-12); near(num(L['pt.W']), 22000, 0);
  assert.equal(num(L.footH), 8); assert.equal(L.footH.src, 'file p.1'); assert.equal(num(L.cwBot), 4); assert.equal(num(L.cwTop), 10); assert.equal(num(L.pad), 100); assert.equal(L.pad.src, 'entered');
  assert.ok(L.head.assumed, 'head allowance: assumed (amber)'); assert.equal(L.head.src, 'ASSUMED (default)'); assert.equal(num(L.boom), 60);
  const rs = Object.fromEntries(F.rows(m).map(r => [r.id, r])); assert.ok(rs.head.assumed && rs.boomW.assumed && rs.fb.assumed); assert.ok(!rs.tail.assumed && !rs.footH.assumed);
  assert.equal(rs.Wcw.value, '20,000 lb'); assert.equal(rs.Wcw.src, 'chart p.1'); assert.equal(rs.rating.value, '85 % of tipping'); assert.equal(rs.Ltab.value, '60.00 ft');
  // the governing point of a pick on the swing uses the travel height (engine/elev.js trav / swing): a swing whose governing point is not an end
  const P2 = project(); P2.picks[0].set = { x: 470, y: 2000 }; P2.picks[0].pick = { x: 500, y: 2020 };   // pick R 20 (front), set R 30 (side): the larger radius governs at the set
  const m2 = F.model(P2, ctxOf(P2), { craneId: 'c1', setupId: 'u0', at: 'gov' }); assert.match(m2.pt.where, /governing point/);
});

test('crane figures: load chart = every rated cell, the lookup step of the boom in use, operating points (single pick 56.41 %, tandem 88.89 %)', () => {
  const P = project(), ctx = ctxOf(P), m = F.model(P, ctx, { craneId: 'c1', setupId: 'u0' }), cfg = m.chart.cfg, ch = cfg.chart, L = labelsOf(F.svg(F.chart(m)));
  const cells = Object.keys(L).filter(k => /^cell\./.test(k)); let n = 0;
  ch.capacity_lb.forEach((row, i) => row.forEach((v, j) => { if (v == null) return; n++; assert.equal(num(L[`cell.${j}.${ch.radii_ft[i]}`]), v, `cell L ${ch.boom_lengths_ft[j]} R ${ch.radii_ft[i]}`); }));
  assert.equal(cells.length, n); assert.equal(n, 23);
  // the bold step of the boom in use is the lookup itself: between radii 20 and 30 the next larger radius (30 ft) governs
  m.chart.use.segs.flat().forEach(q => { const r = K.lookup(cfg, 60, q.R, {}); assert.ok(r.ok); assert.equal(q.C, r.cap); });
  const at25 = m.chart.use.segs.flat().filter(q => q.R > 20 && q.R <= 30); assert.ok(at25.length && at25.every(q => q.C === 39000), 'next larger radius: 39,000 between 20 and 30 ft');
  near(num(L['op.pick:k1.P']), 22000 / 39000 * 100, 1e-9, 'pick'); near(num(L['op.pick:k1.S']), 22000 / 58000 * 100, 1e-9, 'set'); assert.match(L['oplbl.pick:k1.P'].text, /R 30\.00 ft, W 22,000 lb, 56\.4 % of chart/);
  same(m.chart.thr.map(t => t.pct), [75, 100]); assert.equal(m.chart.rb.pct, 85); assert.equal(m.chart.source.prelim, true);
  const mt = F.model(P, ctx, { craneId: 'c1', setupId: 'u1' }), r = ctx.evalT(P.tandems[0]), Lt = labelsOf(F.svg(F.chart(mt)));
  assert.equal(Object.keys(Lt).filter(k => /^op\.tandem:t1:0\./.test(k)).length, r.steps.length, 'one point per step');
  near(num(Lt[`op.tandem:t1:0.${r.gov[0].i}`]), 88.888889, 1e-5); same(mt.chart.thr.map(t => t.id), ['caution', 'limit', 'tandem']);
  assert.equal(mt.chart.use.Ltab, 80);
});

test('crane figures: weights and CGs = engine/ground.js (C4 case A: front floats 41,083.33 lb); estimate and crawler flags', () => {
  const P = project(), ctx = ctxOf(P), m = F.model(P, ctx, { craneId: 'c1', setupId: 'u0' }), L = labelsOf(F.svg(F.weights(m))), g = ctx.evalPick(P.picks[0]).ground;
  near(num(L['max.FL']), 41083.333333, 1e-5); near(num(L['max.FR']), g.max[1].load, 1e-9); assert.equal(num(L['w.c']), 40000); assert.equal(num(L['w.cw']), 20000); assert.equal(num(L['w.h']), 22000); near(num(L['w.V']), 118000, 1e-9);
  assert.ok(L['w.b'].assumed, 'boom CG fraction assumed: the boom arrow is flagged');
  // the crawler (no weights, no geometry): every elevation value assumed; the method "not computed"
  const P2 = project(); P2.setups.push(M.normSetup({ id: 'u9', name: 'Crawler', craneId: 'c2', x: 0, y: 0, heading: 30, group: K.groups(CW)[0].key, boom: K.groups(CW)[0].configs[Object.keys(K.groups(CW)[0].configs)[0]].chart.boom_lengths_ft[0] }));
  const mc = F.model(P2, ctxOf(P2), { craneId: 'c2', setupId: 'u9' }), rs = Object.fromEntries(F.rows(mc).map(r => [r.id, r])), pd = K.planDims(CW);
  assert.equal(rs.trkL.v, pd.crawler.length); assert.equal(rs.gauge.v, pd.crawler.gauge); assert.equal(rs.trkL.src, 'file p.1');
  ['footH', 'e', 'head', 'boomW', 'cwBot'].forEach(k => assert.ok(rs[k].assumed, k + ' assumed')); assert.ok(rs.gmode.assumed);
  const Lp = labelsOf(F.svg(F.plan(mc))); assert.equal(num(Lp.trkL), pd.crawler.length); assert.equal(num(Lp.gauge), pd.crawler.gauge);
  assert.ok(F.weights(mc).none);
});

test('crane figures: picker options, the Crane drawing sheets (inside the border, DXF valid)', () => {
  const P = project(), ctx = ctxOf(P);
  same(F.options(P).map(o => [o.setupId, o.used]), [['u0', true], ['u1', true], ['u2', true], ...K.groups(CW).map(() => ['', false])]);
  const DS2 = DS; const extra = (P2, c2) => F.sheets(P2, c2); DS2.addSheets(extra);
  const B = DS2.build(P, ctx, { paper: 'D' }), cs = B.sheets.filter(s => /^crane-/.test(s.id));
  same(cs.map(s => s.id), ['crane-u0', 'crane-u1', 'crane-u2']); same(B.errors, []);
  cs.forEach(s => { assert.ok(!s.over, s.id + ' fits'); const bb = B.D.bbox(s.i0, s.i1); assert.ok(bb[0] >= s.ox - 1e-6 && bb[2] <= s.ox + s.W + 1e-6, s.id + ' inside'); });
  const t = B.D.E.slice(cs[0].i0, cs[0].i1).filter(e => e.t === 'TEXT').map(e => e.s).join(' | ');
  assert.match(t, /TIP EL\. 160\.48/); assert.match(t, /SPREAD \(FULL\) 24\.00 FT \[FILE P\.1\]/); assert.match(t, /RATING BASIS: 85 % OF TIPPING/); assert.match(t, /HEAD ALLOWANCE \(TIP PIN[^|]*\| 0\.00 FT \| ASSUMED \(DEFAULT\)/);
  const v = W.SharedDxf.validate(B.D.toDXF({ ltscale: 1 })); assert.ok(v.ok, v.errors.join('; '));
});
