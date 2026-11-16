// Crane Pick Analyzer (apps/crane-pick), C3-1: the lift in elevation (engine/elev.js): crane geometry (entered / file / assumed),
// boom angle from the geometry and from the chart's printed boom-angle table, boom tip, load bottom, hook, block top, hook reach,
// travel height and the reach along the swing. Node only, with the SYNTHETIC cranes of tests/smoke/crane-fake-*.json (made-up values).
//   node tests/engine/run.mjs crane
//
// Hand check (fake wheeled crane, outriggers full 360°, boom L = 60 ft; rotation E 1,000 N 2,000, heading 0; pad z_pad = 100.00 ft;
// file: boom-foot pin h_f = 8 ft high, e = 2 ft ahead of rotation; head allowance entered H_hd = 3 ft):
//   pick (1,030, 2,000): R = 30 → d_h = 30 − 2 = 28 ft → θ_g = acos(28 / 60) = 62.1819°; the chart prints 61° at (60, 30) → θ = 61°;
//     z_tip = 100 + 8 + 60 sin 61° = 160.4772 ft; ground 98.00, load bottom 4.00 above → z_lb = 102.00; H 6, rigging 12, block 5 →
//     z_hk = 102 + 6 + 12 = 120.00, z_bk = 125.00; m = 160.4772 − 3 − 125 = 32.4772 ft; ℓ = 35.4772 ft;
//   set (1,000, 2,020): R = 20 → d_h = 18 → θ_g = 72.5424°, chart 72° → z_tip = 108 + 60 sin 72° = 165.0634; ground (not entered) =
//     pad 100, load bottom 20 → z_lb = 120.00, z_hk = 138.00, z_bk = 143.00, m = 19.0634 ft;
//   travel (not entered) z_tr = max(102, 120) = 120.00 → z_bk,tr = 120 + 6 + 12 + 5 = 143.00; lowest tip on the swing at R = 30
//     (160.4772) → m_tr = 160.4772 − 3 − 143 = 14.4772 ft.
//   R = 25 (between the printed radii 20 and 30): θ_c = 72 + (61 − 72)(25 − 20)/(30 − 20) = 66.5° (θ_g = acos(23/60) = 67.4596°).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', path.join(APP, 'geo.js'), path.join(APP, 'osha.js'), path.join(APP, 'cranes.js'), path.join(APP, 'lift.js'), path.join(APP, 'elev.js'));
const K = W.CranePickCranes, LF = W.CranePickLift, EL = W.CranePickElev;
const fake = n => K.parse(JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', `crane-fake-${n}.json`), 'utf8'))).crane;
const WH = fake('wheeled'), CR = fake('crawler');
const plain = o => JSON.parse(JSON.stringify(o));
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, `${m || ''}: ${a} vs ${b} (tol ${tol})`);
const grp = (c, id) => K.groups(c).find(g => Object.values(g.configs).some(x => x.id === id)).key;
const S0 = { caution: 75, critical: 75, limit: 100, interp: false };
const U = o => Object.assign({ x: 1000, y: 2000, heading: 0, group: grp(WH, 'or-full-360'), boom: 60, mode: null, pad: 100 }, o);
const PK = o => Object.assign({ pick: { x: 1030, y: 2000 }, set: { x: 1000, y: 2020 }, load: 20000, rigging: 1000, hook: 1000, ded: 0, swing: 'short',
  elev: { pg: 98, ph: 4, sg: null, sh: 20, rig: 12, blk: 5, trav: null, L: 40, W: 4, H: 6 } }, o);
const withHead = (c, h) => { const x = plain(c); x.app_inputs = Object.assign({}, x.app_inputs, { geom: { head: h } }); return x; };
const run = (c, u, k) => { const ev = LF.evaluate(c, u, k, S0, 'k'); return Object.assign(ev, { elev: EL.evaluate(c, u, k, ev, 'k.el') }); };
const rad = d => d * Math.PI / 180;

test('crane geometry: the file\'s values, entered values, and the stated assumptions', () => {
  let g = EL.geomOf(WH);
  assert.deepEqual(plain([g.footH, g.footE, g.head, g.boomW, g.cwBot, g.cwTop, g.tail, g.maxAng]), [8, 2, 0, 0, 4, 10, 15, 80]);
  assert.deepEqual(plain(g.from), { footH: 'file', footE: 'file', head: 'assumed', boomW: 'assumed', cwBot: 'file', cwTop: 'file' });
  assert.equal(g.assumed.length, 2);
  const c = plain(WH); c.app_inputs = { geom: { footH: 9, head: 3, boomW: 6 }, plan: { boomFoot: 2.5 } }; g = EL.geomOf(c);
  assert.deepEqual(plain([g.footH, g.footE, g.head, g.boomW]), [9, 2.5, 3, 6]); assert.deepEqual(plain([g.from.footH, g.from.footE, g.from.head]), ['entered', 'entered', 'entered']); assert.equal(g.assumed.length, 0);
  g = EL.geomOf(CR);   // the fake crawler lists no boom foot, counterweight heights or maximum angle
  assert.deepEqual(plain([g.footH, g.footE, g.cwBot, g.cwTop, g.maxAng]), [0, 0, 0, null, null]); assert.equal(g.assumed.length, 6);
  assert.match(g.assumed.join('; '), /boom-foot pin height 0 ft/);
});

test('hand check: boom angle (chart governs, geometric shown), tip, load bottom, hook, block, hook reach, travel', () => {
  const ev = run(withHead(WH, 3), U(), PK()), h = ev.elev;
  near(h.pick.ang.geom, Math.acos(28 / 60) * 180 / Math.PI, 1e-9); near(h.pick.ang.geom, 62.1819, 1e-4); assert.equal(h.pick.ang.chart, 61); assert.equal(h.pick.ang.used, 'chart');
  near(h.pick.zTip, 108 + 60 * Math.sin(rad(61)), 1e-9); near(h.pick.zTip, 160.4772, 1e-4);
  assert.deepEqual(plain([h.pick.zLb, h.pick.zLt, h.pick.zHk, h.pick.zBk]), [102, 108, 120, 125]);
  near(h.pick.margin, 32.4772, 1e-4); near(h.pick.line, 35.4772, 1e-4);
  near(h.set.ang.geom, 72.5424, 1e-4); assert.equal(h.set.ang.theta, 72); near(h.set.zTip, 165.0634, 1e-4);
  assert.deepEqual(plain([h.set.zg, h.set.zLb, h.set.zHk, h.set.zBk]), [100, 120, 138, 143]); near(h.set.margin, 19.0634, 1e-4);
  assert.equal(h.trav.z, 120); assert.equal(h.trav.entered, false); assert.equal(h.swing.zBk, 143); near(h.swing.min, 14.4772, 1e-4); near(h.swing.R, 30, 1e-9);
  // the worked steps of the pick
  assert.deepEqual(plain(h.pick.steps.map(s => s.id.split('.').pop())), ['dh', 'thg', 'thc', 'th', 'tip', 'lb', 'hk', 'bk', 'm', 'ln']);
  const tip = h.pick.steps.find(s => /\.tip$/.test(s.id)); assert.equal(tip.sub, '100.00 + 8.00 + 60.00\\,\\text{sin}\\,61.00^{\\circ}');
  assert.match(h.pick.steps.find(s => /\.th$/.test(s.id)).note, /differs from the geometric angle by \\?-?1\.18|differs from the geometric angle by −?-?1\.18/);
  assert.ok(ev.elev.flags.some(f => f.level === 'info' && /chart's loaded boom angle 61\.0° is used \(geometric 62\.2°\)/.test(f.text)));
  // travel entered: higher → less margin
  const k2 = PK(); k2.elev = Object.assign({}, k2.elev, { trav: 130 }); const h2 = run(withHead(WH, 3), U(), k2).elev; near(h2.swing.min, 4.4772, 1e-4); assert.equal(h2.trav.entered, true);
});

test('chart boom angle: read, interpolated between radii, not where L is not a printed column; geometric fallback', () => {
  const cfg = WH.configs.find(c => c.id === 'or-full-360');
  assert.equal(EL.chartAngle(cfg, 60, 30).deg, 61);
  near(EL.chartAngle(cfg, 60, 25).deg, 66.5, 1e-12); assert.equal(EL.chartAngle(cfg, 60, 25).how, 'interp');
  assert.equal(EL.chartAngle(cfg, 50, 30), null, 'L between printed columns: no chart angle');
  assert.equal(EL.chartAngle(cfg, 40, 50), null, 'blank cell');
  const a = EL.angleAt(WH, U({ boom: 50 }), cfg, 30, null, 'a'); assert.equal(a.used, 'geom'); near(a.theta, Math.acos(28 / 50) * 180 / Math.PI, 1e-12);
  const mid = WH.configs.find(c => c.id === 'or-mid-360'); assert.equal(EL.chartAngle(mid, 60, 20), null, 'a config without a table');
});

test('not reachable, over the maximum boom angle, hook cannot reach (two-blocking): stop flags', () => {
  let h = run(WH, U(), PK({ pick: { x: 1063, y: 2000 } })).elev;   // d_h = 61 > L = 60
  assert.equal(h.pick.ang.ok, false); assert.match(h.pick.ang.why, /beyond the boom's reach/); assert.equal(h.pick.zTip, null);
  assert.ok(h.flags.some(f => f.level === 'stop' && /At the pick: the radius is beyond/.test(f.text)));
  h = run(WH, U(), PK({ pick: { x: 1010, y: 2000 } })).elev;   // R 10, L 60: the chart prints 81° > 80°
  assert.equal(h.pick.ang.theta, 81); assert.equal(h.pick.ang.ok, false); assert.ok(h.flags.some(f => /above the crane's maximum 80\.0°/.test(f.text)));
  const k = PK(); k.elev = Object.assign({}, k.elev, { sh: 60 }); h = run(withHead(WH, 3), U(), k).elev;   // set block top 183 > 165.06 − 3
  near(h.set.margin, 165.0634 - 3 - 183, 1e-4); assert.ok(h.flags.some(f => f.level === 'stop' && /At the set: the hook cannot reach/.test(f.text)));
  assert.equal(h.set.steps.find(s => /\.m$/.test(s.id)).ok, false);
  assert.ok(h.flags.some(f => /During the swing: the hook block reaches above/.test(f.text)), 'travel = 180 governs the swing too');
});

test('defaults: no heights entered = the pad is the datum 0.00; crawler with the assumed geometry (θ from the geometry)', () => {
  const k = PK(); delete k.elev; const h = run(WH, U({ pad: null }), k).elev;
  assert.deepEqual(plain([h.pick.zp, h.pick.zg, h.pick.zLb, h.pick.zHk, h.pick.zBk]), [0, 0, 0, 0, 0]); near(h.pick.zTip, 8 + 60 * Math.sin(rad(61)), 1e-9);
  const uc = { x: 0, y: 0, heading: 0, group: K.groups(CR)[0].key, boom: 100, pad: 50 };
  const ev = run(CR, uc, PK({ pick: { x: 0, y: -40 }, set: { x: 40, y: 0 }, elev: {} })), hc = ev.elev;
  assert.equal(hc.pick.ang.used, 'geom'); near(hc.pick.ang.theta, Math.acos(40 / 100) * 180 / Math.PI, 1e-12); near(hc.pick.zTip, 50 + 100 * Math.sin(Math.acos(0.4)), 1e-9);
  assert.ok(hc.flags.some(f => f.kind === 'geom' && /boom-foot pin height 0 ft/.test(f.text)));
});

test('C2 results unchanged by the C3-1 fixture additions (boom-angle table, heights): the C2-2 hand check', () => {
  const ev = LF.evaluate(WH, U(), PK(), S0, 'k');
  assert.equal(ev.W, 22000); assert.equal(ev.pick.C, 39000); assert.equal(ev.set.C, 58000); near(ev.gov.pct, 56.41025641, 1e-6); assert.equal(ev.govWhere, 'at the pick');
});

test('steps: KaTeX (strict) for every sym / eq / sub / unit of the heights; no NaN / undefined', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const k3 = PK(); k3.elev = Object.assign({}, k3.elev, { trav: 110 });
  const hs = [run(withHead(WH, 3), U(), PK()).elev, run(WH, U(), PK({ pick: { x: 1063, y: 2000 } })).elev, run(WH, U(), PK({ pick: { x: 1025, y: 2000 } })).elev, run(WH, U(), k3).elev];
  let n = 0;
  for (const h of hs) for (const s of [].concat(h.geoSteps, h.pick.steps, h.set.steps, h.trav.steps, h.swing.steps)) {
    for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); n++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); n++; }
    assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id);
  }
  assert.ok(n > 80, String(n));
});
