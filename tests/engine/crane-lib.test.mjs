// Crane Pick Analyzer (apps/crane-pick), C2-1: crane files and the chart lookup (engine/cranes.js). Node only.
//   node tests/engine/run.mjs crane
// Every crane here is SYNTHETIC (tests/smoke/crane-fake-wheeled.json, crane-fake-crawler.json: "FAKECO ... (FAKE TEST DATA)", made-up
// round numbers). No manufacturer chart data is in this repository (it is public); the real library is checked structurally by
// crane-library-real.test.mjs, only where CRANE_LIB_DIR points to a local copy.
//
// Lookup rule under test (Decision pending engineer review, conservative): no interpolation; the capacity is read at the next LONGER
// tabulated boom length and the next LARGER tabulated radius; outside the chart or a blank cell = not permitted; the next shorter boom
// length governs when it is rated lower at that radius; repeated columns (telescoping modes) give the lowest unless a mode is chosen;
// linear interpolation between radii only when asked AND the chart notes permit it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test, loadShared, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps', 'crane-pick', 'engine');
const W = loadShared('steps.js', path.join(APP, 'geo.js'), path.join(APP, 'cranes.js'));
const K = W.CranePickCranes;
const fake = n => JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'smoke', `crane-fake-${n}.json`), 'utf8'));
const plain = o => JSON.parse(JSON.stringify(o));
const WH = K.parse(fake('wheeled')).crane, CR = K.parse(fake('crawler')).crane;
const cfg = (c, id) => c.configs.find(g => g.id === id);

test('parse: the fake cranes load; warnings for the preliminary flag; app_inputs added', () => {
  const a = K.parse(fake('wheeled')), b = K.parse(fake('crawler'));
  assert.ok(a.ok, a.errors.join('; ')); assert.ok(b.ok, b.errors.join('; '));
  assert.ok(a.warnings.some(w => /PRELIMINARY/.test(w)));
  assert.equal(b.warnings.length, 0, b.warnings.join('; '));
  assert.deepEqual(plain(a.crane.app_inputs), {});
  assert.equal(K.key(a.crane), 'fakeco-test-at-100-fake-test-data');
  assert.equal(K.name(b.crane), 'FAKECO TEST-CR 200 (FAKE TEST DATA)');
});

test('parse: structure errors (schema, grid shape, non-numbers, order, zone, duplicate ids)', () => {
  const bad = f => { const o = fake('wheeled'); f(o); return K.parse(o); };
  assert.match(K.parse({ schema: 'x' }).errors[0], /not a crane file/);
  assert.match(K.parse(null).errors[0], /not a crane file/);
  let r = bad(o => { o.configs[0].chart.capacity_lb.pop(); }); assert.ok(!r.ok); assert.match(r.errors.join(), /one row per radius/);
  r = bad(o => { o.configs[0].chart.capacity_lb[2].push(5); }); assert.match(r.errors.join(), /row 3 .*needs 4 values/);
  r = bad(o => { o.configs[0].chart.capacity_lb[1][1] = '76,000'; }); assert.match(r.errors.join(), /neither a number nor blank/);
  r = bad(o => { o.configs[0].chart.radii_ft = [10, 15, 15, 30, 40, 50, 60, 70]; }); assert.match(r.errors.join(), /radii must be in increasing order/);
  r = bad(o => { o.configs[0].chart.boom_lengths_ft = [40, 30, 80, 100]; }); assert.match(r.errors.join(), /boom lengths must be positive and in increasing order/);
  r = bad(o => { o.configs[1].zone = 'over-top'; }); assert.match(r.errors.join(), /zone "over-top"/);
  r = bad(o => { o.configs[1].id = o.configs[0].id; }); assert.match(r.errors.join(), /duplicate config id/);
  r = bad(o => { o.configs[0].chart.capacity_lb[3][0] = 0; }); assert.match(r.errors.join(), /zero or negative/);
  r = bad(o => { delete o.make; }); assert.match(r.errors.join(), /make and model/);
});

test('parse: warnings for capacity increasing with radius and blanks between rated cells', () => {
  const o = fake('wheeled'); o.configs[0].chart.capacity_lb[4][1] = 45000; o.configs[0].chart.capacity_lb[5][2] = null;
  const r = K.parse(o); assert.ok(r.ok);
  assert.ok(r.warnings.some(w => /capacity increases with radius .*L 60 ft: 39,000 → 45,000 lb at R 40 ft/.test(w)), r.warnings.join('|'));
  assert.ok(r.warnings.some(w => /blank cells between rated cells .*L 80 ft at R 60 ft/.test(w)), r.warnings.join('|'));
});

test('lookup: next longer boom length, next larger radius (no interpolation)', () => {
  const g = cfg(WH, 'or-full-360');
  let r = K.lookup(g, 60, 20); assert.equal(r.status, 'ok'); assert.equal(r.cap, 58000); assert.equal(r.Ltab, 60); assert.equal(r.Rtab, 20);
  r = K.lookup(g, 50, 17); assert.equal(r.Ltab, 60); assert.equal(r.Rtab, 20); assert.equal(r.cap, 58000, 'the 40 ft cell (60,000) is higher: 60 ft governs');
  r = K.lookup(g, 41, 30.01); assert.equal(r.Ltab, 60); assert.equal(r.Rtab, 40); assert.equal(r.cap, 28000, '40 ft has no rating at 40 ft radius: 60 ft governs');
  r = K.lookup(g, 80, 15); assert.equal(r.cap, 70000);
  // the steps: L_tab, R_tab, C
  r = K.lookup(g, 50, 17, { idp: 'p1' });
  assert.deepEqual(plain(r.steps.map(s => [s.id, s.sym, s.value])), [['p1.Lt', 'L_{tab}', 60], ['p1.Rt', 'R_{tab}', 20], ['p1.C', 'C_{chart}', 58000]]);
  assert.match(r.steps[2].sub, /C\(60\\,\\text\{ft\}, 20\\,\\text\{ft\}\)/);
  assert.match(r.steps[2].ref, /chart "Main boom, outriggers full .*", PDF p\. 1/);
});

test('lookup: the next shorter boom length governs when it is rated lower (lesser of adjacent lengths)', () => {
  const g = cfg(WH, 'or-full-360');
  const r = K.lookup(g, 90, 65, { idp: 'x' });
  assert.equal(r.Ltab, 100); assert.equal(r.Rtab, 70); assert.equal(r.cap, 10000, 'min(10,500 at 100 ft, 10,000 at 80 ft)');
  assert.equal(r.steps[r.steps.length - 1].id, 'x.Cs'); assert.match(r.steps[r.steps.length - 1].sub, /\\min\(10\{,\}500, 10\{,\}000\)/);
  assert.equal(K.lookup(g, 100, 65).cap, 10500, 'a tabulated length: its own column only');
});

test('lookup: outside the chart and blank cells are not permitted', () => {
  const g = cfg(WH, 'or-full-360');
  const no = (L, R, st, rx) => { const r = K.lookup(g, L, R); assert.equal(r.ok, false); assert.equal(r.status, st, `${L}/${R}`); assert.match(r.why, rx); assert.equal(r.steps[0].value, 'not permitted'); };
  no(60, 5, 'outside', /less than the smallest tabulated radius \(10\.0 ft\)/);
  no(60, 70.5, 'outside', /beyond the largest tabulated radius \(70\.0 ft\)/);
  no(100.5, 30, 'outside', /longer than the longest tabulated length \(100\.0 ft\)/);
  no(40, 40, 'blank', /blank chart cell at L 40\.0 ft, R 40\.0 ft/);
  no(100, 12, 'blank', /blank chart cell at L 100\.0 ft, R 15\.0 ft/);
  assert.equal(K.lookup(g, 0, 20).status, 'invalid'); assert.equal(K.lookup(g, 60, NaN).status, 'invalid');
  assert.equal(K.lookup(g, 40, 10).cap, 100000, 'the smallest radius itself is in the chart');
  assert.equal(K.lookup(g, 100, 70).cap, 10500, 'the largest radius itself is in the chart');
});

test('lookup: a cell marked "special equipment" is not a general rating (not permitted)', () => {
  const g = cfg(WH, 'or-mid-360');
  const r = K.lookup(g, 40, 10); assert.equal(r.ok, false); assert.equal(r.status, 'flagged'); assert.match(r.why, /special equipment/);
  assert.equal(K.lookup(g, 40, 11).cap, 40000);
});

test('lookup: repeated columns (telescoping modes): the lowest unless a mode is chosen', () => {
  const g = cfg(WH, 'or-full-360-modes');
  let r = K.lookup(g, 60, 20); assert.equal(r.cap, 29000); assert.match(r.notes.join(), /2 columns at 60\.0 ft .*A \/ B.*lowest/);
  assert.equal(K.lookup(g, 60, 20, { mode: 'B' }).cap, 31000);
  assert.equal(K.lookup(g, 60, 20, { mode: 'A' }).cap, 29000);
  r = K.lookup(g, 60, 30); assert.equal(r.status, 'blank'); assert.match(r.why, /choose the mode/);
  assert.equal(K.lookup(g, 60, 30, { mode: 'A' }).cap, 14000);
  assert.equal(K.lookup(g, 60, 30, { mode: 'B' }).status, 'blank');
  assert.equal(K.lookup(g, 50, 20).cap, 29000, 'next longer = the two 60 ft columns, lowest; 40 ft (30,000) is higher');
});

test('lookup: linear interpolation between radii only when asked and the notes permit it', () => {
  const g = cfg(WH, 'or-full-360');
  assert.equal(K.interpPermitted(g), true);
  assert.equal(K.interpPermitted(cfg(WH, 'or-mid-360')), false, '"No interpolation"');
  assert.equal(K.interpPermitted(cfg(WH, 'or-full-360-modes')), false, '"no interpolation"');
  assert.equal(K.interpPermitted(cfg(WH, 'rubber-360')), false, 'not mentioned');
  assert.equal(K.lookup(g, 60, 25).cap, 39000, 'default: no interpolation');
  const r = K.lookup(g, 60, 25, { interp: true, idp: 'i' });
  assert.equal(r.cap, 48500, '58,000 + (39,000 − 58,000)(25 − 20)/(30 − 20)'); assert.equal(r.how, 'interp');
  assert.ok(r.steps.some(s => s.id === 'i.Ci' && s.value === 48500));
  assert.equal(K.lookup(g, 60, 30, { interp: true }).cap, 39000, 'a tabulated radius');
  assert.equal(K.lookup(g, 40, 35, { interp: true }).status, 'blank', 'R_tab 40 is blank at 40 ft');
  assert.equal(K.lookup(cfg(WH, 'or-mid-360'), 60, 15, { interp: true }).cap, 38000, 'not permitted by the notes: next larger radius');
});

test('rating basis (% of tipping) from the notes, or entered', () => {
  assert.deepEqual(plain(K.ratingBasis(cfg(WH, 'or-full-360'), WH)), { pct: 85, text: '85 % of tipping (chart notes)', from: 'notes' });
  assert.equal(K.ratingBasis(cfg(WH, 'rubber-360'), WH).pct, 75);
  assert.equal(K.ratingBasis(cfg(CR, 'rear-150k'), CR).pct, 75);
  assert.equal(K.ratingBasis({ id: 'q', notes: 'not exceeding 75% of static tipping loads' }).text, '75 % of static tipping (chart notes)');
  const c = plain(WH); c.configs[0].notes = 'no basis given'; c.app_inputs = { rating: { 'or-full-360': 80 } };
  assert.deepEqual(plain(K.ratingBasis(c.configs[0], c)), { pct: 80, text: '80 % of tipping (entered)', from: 'entered' });
  c.app_inputs = {}; assert.equal(K.ratingBasis(c.configs[0], c).pct, null);
  const o = fake('crawler'); o.configs[0].notes = 'x'; assert.ok(K.parse(o).warnings.some(w => /rating basis .*not found/.test(w)));
});

test('groups and zones: slew angle from the carrier front; a zone chart only inside its sector', () => {
  const gw = K.groups(WH);
  assert.equal(gw.length, 4);
  const rub = gw.find(g => g.configs['over-front']); assert.deepEqual(plain(rub.zones), ['360', 'over-front']);
  assert.equal(rub.configs['360'].id, 'rubber-360');
  const gc = K.groups(CR); assert.equal(gc.length, 1); assert.deepEqual(plain(gc[0].zones), ['over-rear', 'over-side']);
  // zoneOf
  assert.equal(K.zoneOf(5, { front: 10 }), 'over-front'); assert.equal(K.zoneOf(-10, { front: 10 }), 'over-front'); assert.equal(K.zoneOf(15, { front: 10 }), 'over-side');
  assert.equal(K.zoneOf(160, { rear: 30 }), 'over-rear'); assert.equal(K.zoneOf(-155, { rear: 30 }), 'over-rear'); assert.equal(K.zoneOf(140, { rear: 30 }), 'over-side');
  assert.equal(K.zoneOf(200, { rear: 30 }), 'over-rear', '200° = −160°');
  assert.equal(K.zoneOf(0, {}), 'over-side', 'sectors not set: no front zone (conservative)'); assert.equal(K.zoneOf(180, { front: null, rear: null }), 'over-side');
  // chartFor: the zone's own chart, else the 360 chart, else none
  assert.equal(K.chartFor(rub, 'over-front').id, 'rubber-front'); assert.equal(K.chartFor(rub, 'over-side').id, 'rubber-360'); assert.equal(K.chartFor(rub, 'over-rear').id, 'rubber-360');
  assert.equal(K.chartFor(gc[0], 'over-rear').id, 'rear-150k'); assert.equal(K.chartFor(gc[0], 'over-side').id, 'side-150k');
  assert.equal(K.chartFor(gc[0], 'over-front'), null, 'no front chart and no 360 chart: no rating');
  assert.equal(K.norm180(270), -90); assert.equal(K.norm180(-190), 170);
});

test('plan dimensions from the file, overrides, outrigger position of a config', () => {
  const p = K.planDims(WH);
  assert.equal(p.kind, 'wheeled'); assert.equal(p.tail, 15); assert.equal(p.boomFoot, 2);
  assert.deepEqual(plain(p.outr), { xFront: 12, xRear: 12, spreads: { full: 24, mid: 16 }, float: 2 });
  assert.deepEqual(plain(p.body), { front: 26, rear: 14, width: 10 }); assert.deepEqual(plain(p.assumed), []);
  const q = K.planDims(CR); assert.equal(q.kind, 'crawler'); assert.deepEqual(plain(q.crawler), { length: 26, gauge: 18, shoe: 3 }); assert.deepEqual(plain(q.body), { front: 7, rear: 7, width: 12 });
  const c = plain(WH); c.app_inputs = { plan: { tail: 16, outr: { float: 2.5, spreads: { min: 10 } } } }; delete c.dims.center_of_rotation;
  const r = K.planDims(c); assert.equal(r.tail, 16); assert.equal(r.outr.float, 2.5); assert.deepEqual(plain(r.outr.spreads), { full: 24, mid: 16, min: 10 });
  assert.deepEqual(plain(r.body), { front: 20, rear: 20, width: 10 }); assert.match(r.assumed.join(), /carrier centred between the outrigger beams/);
  assert.equal(K.spreadKey(cfg(WH, 'or-full-360'), p), 'full'); assert.equal(K.spreadKey(cfg(WH, 'or-mid-360'), p), 'mid'); assert.equal(K.spreadKey(cfg(WH, 'rubber-360'), p), null);
});

test('hook blocks, fingerprint (ignores app_inputs), key', () => {
  assert.deepEqual(plain(K.hookBlocks(WH)).map(h => [h.label, h.lb]), [['FAKE 50 t block', 1000], ['FAKE hook ball', 300]]);
  const c = plain(WH); c.app_inputs = { sectors: { front: 5 } };
  assert.equal(K.fingerprint(c), K.fingerprint(WH)); assert.match(K.fingerprint(WH), /^[0-9a-f]{8}$/);
  c.configs[0].chart.capacity_lb[0][0] = 99999; assert.notEqual(K.fingerprint(c), K.fingerprint(WH));
  const d = plain(WH); d.configs.reverse(); assert.notEqual(K.fingerprint(d), K.fingerprint(WH), 'order of configs matters');
  const e = Object.fromEntries(Object.entries(plain(WH)).reverse()); assert.equal(K.fingerprint(e), K.fingerprint(WH), 'key order does not');
});

test('pasted chart (Excel): boom-length row, radius rows, blanks, commas, marks, kip, round trip', () => {
  const txt = 'R \\ L\t40\t60\t80\n10\t100,000\t90,000\t\n15\t80000\t76000*\t70000\n20\t60000\t-\t55000\n';
  let r = K.pasteChart(txt, 'lb');
  assert.deepEqual(plain(r.errors), []);
  assert.deepEqual(plain(r.chart), { boom_lengths_ft: [40, 60, 80], radii_ft: [10, 15, 20], capacity_lb: [[100000, 90000, null], [80000, 76000, 70000], [60000, null, 55000]] });
  assert.ok(r.warnings.some(w => /marks .*1 cell/.test(w))); assert.ok(r.warnings.some(w => /blank cells between rated cells .*L 60 ft at R 20 ft/.test(w)) === false, 'a blank at the end of a column is not between rated cells');
  r = K.pasteChart('x\t50\t70\n12\t50.5\t40\n20\t30\t41', 'kip');
  assert.deepEqual(plain(r.chart.capacity_lb), [[50500, 40000], [30000, 41000]]); assert.ok(r.warnings.some(w => /increases with radius .*L 70 ft/.test(w)));
  r = K.pasteChart('x 40 60\n10 5000 4000\n20 3000 2000', 'lb'); assert.deepEqual(plain(r.chart.radii_ft), [10, 20], 'space separated (no tabs)');
  assert.match(K.pasteChart('x\t40\n10\tabc', 'lb').errors.join(), /"abc" is not a number/);
  assert.match(K.pasteChart('only one row', 'lb').errors.join(), /at least two rows/);
  assert.match(K.pasteChart('x\t40\n20\t5\n10\t6', 'lb').errors.join(), /radii must be in increasing order/);
  const g = cfg(WH, 'or-full-360'), back = K.pasteChart(K.chartText(g.chart), 'lb');
  assert.deepEqual(plain(back.chart), plain({ boom_lengths_ft: g.chart.boom_lengths_ft, radii_ft: g.chart.radii_ft, capacity_lb: g.chart.capacity_lb }));
  assert.equal(K.chartText({ radii_ft: [], boom_lengths_ft: [], capacity_lb: [] }), '');
});

test('a new blank crane needs a chart before it passes', () => {
  const b = K.blank(); assert.ok(K.parse(b).ok, 'no configs: a warning only');
  b.configs.push({ id: 'c1', zone: '360', chart: { boom_lengths_ft: [], radii_ft: [], capacity_lb: [] } });
  assert.match(K.parse(b).errors.join(), /boom_lengths_ft must be a list of numbers/);
});

test('lookup steps: every sym / eq / sub / unit parses with KaTeX (strict); text has no NaN / undefined', async () => {
  const { createRequire } = await import('node:module');
  const katex = createRequire(import.meta.url)(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js'));
  const parse = t => katex.renderToString(t, { ...W.SharedSteps.katexOpt, throwOnError: true, strict: 'error' });
  const g = cfg(WH, 'or-full-360');
  const all = [K.lookup(g, 50, 17), K.lookup(g, 90, 65), K.lookup(g, 60, 25, { interp: true }), K.lookup(g, 60, 5), K.lookup(g, 40, 40), K.lookup(cfg(WH, 'or-mid-360'), 40, 10), K.lookup(g, 37.3, 12.25)].flatMap(r => r.steps);
  let k = 0;
  for (const s of all) { for (const f of ['sym', 'eq', 'sub']) if (s[f]) { parse(s[f]); k++; } if (s.unit) { parse(W.SharedSteps.unitTeX(s.unit)); k++; }
    assert.ok(!/NaN|undefined/.test(W.SharedSteps.toText([s])), s.id); }
  assert.ok(k > 20, String(k));
});
