// Steel Bridge Report (2026-11-23, engineer's request; report and display only, no computed value changes):
//   EXA   the every-girder report starts with an Executive summary: the Summary tab's verdict of the bridge (the same cells(), merge() and
//         overall() of report/summary.js), one row per limit state with the governing girder and location, the items not in the verdict;
//   BOM2  the steel bill of materials lists the stiffeners, connection plates, bearing stiffeners, field splice plates and cross-frames the
//         app sizes, each weight worked (b t ℓ × 490/1728), with girder and bridge totals;
//   CAMG  the Deflection section has a camber table and a camber diagram of each girder, and the live-load deflection check in one line
//         with the engine's own steps and note quoted.
// Made-up bridges only: the app's built-in example (three spans 110-140-110 ft) and its two-type new project, changed where stated.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'dxf.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'engine/autodesign.js', 'engine/drawings.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js',
  'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js', 'engine/sheets.js', 'ui/deflection.js', 'ui/graphics.js', 'ui/gfxa.js', 'report/data.js', 'report/builders.js', 'report/summary.js'].map(E));
const W = loadShared(...FILES);
W.SBDReportData.install();   // as index.html: one analysis per project state, girder and options
const M = W.SBDModel, S = W.SBDSummary, RB = W.SBDReportBuild, SR = W.SharedReport, J = v => JSON.parse(JSON.stringify(v));
const PCI = 490 / 1728, near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const tables = s => s.items.filter(i => i && i.type === 'table'), cellT = c => (c && typeof c === 'object' ? c.t : c);

/* the every-girder list, as ui/report.js buildAll makes it */
function listOf(P) {
  const US = S.units(P);
  return US.map(u => { const B = W.SBDReportData.compute(u.P, u.gi, { src: 'analysis' }), r = RB.govRows(B), g = u.P.girders[u.gi], many = US.filter(q => q.gi === u.gi).length > 1;
    return { gi: u.gi, j: u.j, label: (g.label || g.id) + (many ? ` on G${u.j + 1}` : ''), rows: r.rows, err: r.err, sum: r.sum, bom: r.bom }; });
}
/* the Summary tab's own path (ui/summary.js): each module of each unit run on its own, cells(), merge() per type, overall() */
function summaryOf(P) {
  const US = S.units(P), by = new Map();
  US.forEach(u => { const parts = {}; S.MODS.forEach(m => { parts[m.k] = S.run(u.P, u.gi, m.k); }); if (!by.has(u.gi)) by.set(u.gi, []); by.get(u.gi).push({ j: u.j, G: S.cells(u.P, u.gi, parts) }); });
  const types = [...by.entries()].map(([gi, us]) => S.merge(P, gi, us));
  return { types, ov: S.overall(P, types) };
}
let two = null; const getTwo = () => { if (!two) { const P = M.newProject(), list = listOf(P), A = RB.allModel(P, list), doc = SR.build(A); two = { P, list, A, doc, txt: SR.text(doc) }; } return two; };
let one = null; const getOne = () => { if (!one) { const P = M.defaultProject(), B = W.SBDReportData.compute(P, 0), Md = RB.model(B, { detail: 'gov' }), doc = SR.build(Md); one = { P, B, Md, doc, txt: SR.text(doc) }; } return one; };

test('EXA: every-girder report = Executive summary, summary of every girder, governing checks of each girder, bill of materials; every link resolves', () => {
  const { A, doc } = getTwo();
  assert.equal(A.sections.map(s => s.id).join(' '), 'exec all per bom');
  assert.deepEqual(J(doc.unresolved), []); assert.deepEqual(J(doc.dup), []);
});

test('EXA: the verdict, the counts, the governing D/C and every row are the Summary tab\'s own values (two girder types on five lines)', () => {
  const { P, A, txt, doc } = getTwo(), { types, ov } = summaryOf(P), ex = A.sections[0], it = ex.subs[0].items;
  // the same verdict and counts as ui/summary.js paint() (no applicability FAIL on this bridge)
  assert.equal(W.SBDAnalysis.applicability(P).level === 'fail', false);
  assert.equal(A.verdict, ov.verdict); assert.equal(it[0].type, 'figure'); assert.ok(it[0].svg.includes(`>${ov.verdict}<`));
  assert.ok(it[0].svg.includes(`${ov.n.fail} FAIL, ${ov.n.review} REVIEW, ${ov.n.pass} PASS`), it[0].svg.slice(-260));
  assert.deepEqual(J(A.ov.n), J(ov.n));
  // the built-in two-type project fails (Strength I flexure at the piers, Inventory RF below 1.0)
  assert.equal(ov.verdict, 'FAIL'); assert.ok(ov.n.fail >= 2);
  // the governing D/C of the bridge
  assert.ok(Object.is(A.ov.top.q.r, ov.top.q.r)); assert.equal(A.ov.top.G.label, ov.top.G.label);
  assert.ok(txt.includes(`Governing D/C: ${W.SharedUnits.fmt(ov.top.q.r, 3)} (`));
  // one row per limit state (the Summary tab's columns), each the governing girder's value
  const tb = tables(ex.subs[0])[0], rows = tb.rows.map(r => r.cells);
  assert.equal(rows.length, S.COLS.length);
  S.COLS.forEach((c, i) => { const z = ov.byCol[c.id], a = A.ov.byCol[c.id], row = rows[i];
    assert.equal(row[0], c.head); assert.equal(a.q.st, z.q.st, c.id);
    if (z.q.st === 'na' || z.q.st === 'notrun') { assert.equal(row[4], '—'); return; }
    assert.ok(Object.is(c.rf ? a.q.rf : a.q.r, c.rf ? z.q.rf : z.q.r), `${c.id}: ${a.q.r} ${z.q.r}`);
    assert.equal(a.G.label, z.G.label); assert.equal(a.q.ln, z.q.ln); assert.equal(a.q.loc, z.q.loc);
    assert.equal(row[2], `${z.G.label}${z.q.ln != null ? ` on G${z.q.ln + 1}` : ''}`); assert.equal(row[3], z.q.loc);
    assert.equal(row[4].t, c.rf ? `RF ${W.SharedUnits.fmt(z.q.rf, 2)}` : W.SharedUnits.fmt(z.q.r, 3));
    assert.equal(row[5], { pass: 'PASS', fail: 'FAIL', review: 'REVIEW' }[z.q.st]);
    // each value links to that girder's governing checks in this report (§3.k) and names the tab that works it (in-app link)
    assert.match(row[4].key, /^per\.g\d+$/); assert.match(SR.ref(doc, row[4].key), /^§3\.\d+$/);
    assert.equal(row[7], `[[tab:${c.tab}|${{ flex: 'Flexure', shear: 'Shear & stiffeners', fat: 'Fatigue & studs', cn: 'Constructibility', cf: 'Cross-frames', spl: 'Field splices', wt: 'Welds', defl: 'Deflection', rt: 'Rating' }[c.tab]} tab]]`); });
  // the counts of the rows add up to the banner's
  const sum = rows.reduce((a, r) => { const [x, y, z] = r[6].split(' / ').map(Number); return [a[0] + x, a[1] + y, a[2] + z]; }, [0, 0, 0]);
  assert.deepEqual(sum, [ov.n.fail, ov.n.review, ov.n.pass]);
  // each type's cells are the Summary's, cell by cell (status and value)
  types.forEach(T => S.COLS.forEach(c => { const mine = getTwo().list.filter(G => G.gi === T.gi).map(G => G.sum.cells[c.id]), q = T.cells[c.id];
    assert.ok(mine.some(x => x.st === q.st && Object.is(x.r, q.r) && Object.is(x.rf, q.rf)), `${T.label} ${c.id}`); }));
  // not in the verdict: the span-to-depth guidance of each type and the warnings (a limit state with no check: the made-up test below)
  const nv = tables(ex.subs[0])[1].rows; assert.ok(nv.filter(r => /Span-to-depth/.test(r[0])).length === 2); assert.ok(nv.some(r => r[0] === 'Warning (for review)'));
});

test('EXA: verdict rules on made-up cells: PASS, REVIEW (a Warning status or a ratio not a number), FAIL (D/C > 1, RF < 1, SA4 FAIL)', () => {
  const P = M.defaultProject(), cell = (st, r, rf) => ({ st, r: rf == null ? r : null, rf: rf == null ? null : rf, check: 'made-up check', loc: 'x = 1.00 ft', tab: 'flex' });
  const mk = over => { const cells = {}; S.COLS.forEach(c => { cells[c.id] = c.rf ? cell('pass', null, 1.5) : cell('pass', 0.5); }); Object.assign(cells, over || {});
    return [{ gi: 0, j: 1, label: 'G1', rows: [], err: {}, sum: { gi: 0, label: 'G1', cells, warn: [], notes: [], err: {}, gov: [] }, bom: { label: 'G1', stf: [], brg: [], spl: [], xf: null, miss: [] } }]; };
  const v = (over, Q) => { const A = RB.allModel(Q || P, mk(over)); return [A.verdict, A.sections[0].subs[0].items[0].svg]; };
  let [w, svg] = v(); assert.equal(w, 'PASS'); assert.ok(/stroke-width="2"/.test(svg) && !/dasharray/.test(svg));
  [w, svg] = v({ wd: { ...cell('review', 1.0), nWarn: 1 } }); assert.equal(w, 'REVIEW'); assert.ok(/dasharray/.test(svg));
  [w] = v({ shear: cell('review', Infinity) }); assert.equal(w, 'REVIEW');
  [w] = v({ shear: cell('fail', 1.02) }); assert.equal(w, 'FAIL');
  [w] = v({ rtInv: cell('fail', null, 0.97) }); assert.equal(w, 'FAIL');
  // a limit state with no check does not change the verdict and is listed
  { const A = RB.allModel(P, mk({ spl: { st: 'na', tab: 'spl', why: 'No field splice on this girder.' } })); assert.equal(A.verdict, 'PASS');
    assert.ok(tables(A.sections[0].subs[0])[1].rows.some(r => r[0] === 'Field splices: no check' && r[3] === 'No field splice on this girder.')); }
  // the line-girder analysis not applicable (made-up 65° skew: SA4 FAIL) fails the verdict although every cell passes (ui/summary.js paint())
  { const Q = M.defaultProject(); Q.xs.skews = [65, 65, 65, 65]; assert.equal(W.SBDAnalysis.applicability(Q).level, 'fail'); const [x, s2] = v(null, Q); assert.equal(x, 'FAIL'); assert.ok(s2.includes('applicability FAIL')); }
  // without the Summary cells (an older cached row set): no Executive summary, the report as before
  { const L = mk(); delete L[0].sum; delete L[0].bom; assert.equal(RB.allModel(P, L).sections.map(s => s.id).join(' '), 'all per'); }
});

test('BOM2: stiffeners, connection plates, bearing stiffeners: counts from the module rows, weights b t ℓ × 490/1728 (hand check, built-in example)', () => {
  const { B, Md, txt, doc } = getOne(), bm = Md.sections.find(s => s.id === 'bom'), it = RB.bomItems(B);
  assert.deepEqual(J(doc.unresolved), []);
  assert.equal(bm.subs.map(q => q.id).join(' '), 'b gs gp xf t');
  // counts: the Shear & stiffeners module's own rows (62 intermediate stiffeners + 15 connection plates = its 77 transverse rows; 4 supports)
  assert.equal(it.stf.reduce((a, q) => a + q.n, 0), B.shear.TS.rows.length); assert.equal(B.shear.TS.rows.length, 77);
  assert.deepEqual(J(it.stf.map(q => [q.b, q.t, q.L, q.n])), [[6, 0.5, 60, 62], [6, 0.5, 60, 15]]);
  assert.deepEqual(J(it.brg.map(q => [q.b, q.t, q.L, q.n])), [[7, 0.875, 60, 4], [8, 1, 60, 8]]);   // abutments 1 pair × 2, piers 2 pairs × 2
  // intermediate stiffener: 6(0.5)(60)(490/1728) = 51.04 lb; × 62 = 3.165 kip.  Pier bearing stiffener: 8(1)(60)(490/1728) = 136.11 lb; × 8 = 1.089 kip
  near(6 * 0.5 * 60 * PCI, 51.04, 0.005); near(62 * 51.0417 / 1000, 3.165, 0.0005); near(8 * 60 * PCI * 8 / 1000, 1.089, 0.0005);
  const t = txt.slice(txt.indexOf('Stiffeners and connection plates, girder G1'));
  assert.match(t, /Intermediate stiffener \(type A: intermediate transverse stiffener\) \| 6\.000 × 0\.5000 \| 62 \(62 locations × 1, one side of the web\) \| 60\.000 \| 51\.0 \| 3\.165/);
  assert.match(t, /Connection plate \(type B: connection plate\) \| 6\.000 × 0\.5000 \| 15 \([^)]*\) \| 60\.000 \| 51\.0 \| 0\.766/);
  assert.match(t, /Bearing stiffener, Abutment \(type A\) \| 7\.000 × 0\.8750 \| 4 \(2 supports × 2, 1 pair\) \| 60\.000 \| 104\.2 \| 0\.417/);
  assert.match(t, /Bearing stiffener, Pier \(type B\) \| 8\.000 × 1\.0000 \| 8 \(2 supports × 4, 2 pairs\) \| 60\.000 \| 136\.1 \| 1\.089/);
  assert.match(t, /Subtotal: transverse stiffeners and connection plates \|[ |]*3\.930/); assert.match(t, /Subtotal: bearing stiffeners \|[ |]*1\.506/);
  assert.match(t, /6\.000\(0\.5000\)\(60\.000\)\(490\/1728\) = 51\.0 lb; × 62 = 3\.165 kip/);   // the weight is worked in the note
  // a stiffener on both sides of the web doubles its plates (made-up change of the type)
  const B2 = { ...B, shear: { ...B.shear, TS: { ...B.shear.TS, rows: B.shear.TS.rows.map(r => (r.type === 'A' ? { ...r, t: { ...r.t, sides: 2 } } : r)) } } };
  assert.equal(RB.bomItems(B2).stf[0].n, 124);
});

test('BOM2: field splice plates: sizes and lengths of the splice design, web plate length as the Drawings (hand check)', () => {
  const { B, txt } = getOne(), it = RB.bomItems(B), s = B.spl.list[0].R, f = s.fl;
  assert.equal(it.spl.length, 4);
  // FS1: flange plate length = gap + 2(e_f + (n_r − 1)s + e_p): top 0.5 + 2(1.75 + 2(3) + 1.75) = 19.5 in (the design's L_pl), bottom 25.5 in
  assert.equal(f.top.Lpl, 19.5); assert.equal(f.bot.Lpl, 25.5);
  // web plates: 0.5 + 2(1.75 + (2 − 1)(3) + 1.75) = 13.5 in
  const rows = it.spl[0].rows; assert.deepEqual(J(rows.map(q => [q.b, q.t, q.L, q.n])), [[16, 0.4375, 19.5, 1], [6.75, 0.5625, 19.5, 2], [16, 0.625, 25.5, 1], [6.75, 0.75, 25.5, 2], [57, 0.4375, 13.5, 2]]);
  // top outer plate: 16(0.4375)(19.5)(490/1728) = 38.71 lb; web plates: 57(0.4375)(13.5)(490/1728) = 95.46 lb each; splice: 38.71 + 2(20.99) + 72.31 + 2(36.61) + 2(95.46) = 416.6 lb
  near(16 * 0.4375 * 19.5 * PCI, 38.71, 0.005); near(57 * 0.4375 * 13.5 * PCI, 95.46, 0.005);
  const t = txt.slice(txt.indexOf('Field splice plates, girder G1'));
  assert.match(t, /FS1 at 82\.00 ft \| Top flange, outer plate \| 16\.000 × 0\.4375 \| 1 \| 19\.500 \| 38\.7 \| 0\.039/); assert.match(t, /Web plates \| 57\.000 × 0\.4375 \| 2 \| 13\.500 \| 95\.5 \| 0\.191/);
  assert.match(t, /Subtotal FS1 at 82\.00 ft \|[ |]*0\.417/); assert.match(t, /Subtotal: field splice plates \|[ |]*1\.669/);
  // bolts: counted, no weight: 2(12 + 16 + 22) = 100 per splice
  assert.equal(it.spl[0].bolts, 2 * (f.top.n + f.bot.n + s.web.nw)); assert.match(t, /Bolts \(count only; no weight in this table\): FS1 at 82\.00 ft: 100 × 0\.875 in A325/);
});

test('BOM2: cross-frames: each frame the weight the analysis puts in DC1; the total equals the DC1 point loads of every girder', () => {
  const { B, P, txt } = getOne(), it = RB.bomItems(B), XF = W.SBDCrossframes, L = B.frm.L, X = B.frm.XF.X;
  // every frame of the framing plan: 4 bays × (4 supports + 13 intermediate stations) = 68
  assert.equal(it.xf.rows.reduce((a, q) => a + q.n, 0), L.xf.f.length); assert.equal(L.xf.f.length, 68);
  // one frame, S = 114 in, h = 52 in, d = √(114² + 52²) = 125.30 in, L5x5x3/8 A = 3.609 in², 10 % allowance:
  // (114(3.609 + 3.609) + 2(125.30)(3.609))(0.2836)(1.10)/1000 = 0.539 kip (engine/crossframes.js xfW)
  const d = Math.hypot(114, 52), hand = (114 * 2 * X.At + 2 * d * X.Ad) * 0.2836 * 1.1 / 1000; near(d, 125.30, 0.005); near(hand, 0.539, 0.0005);
  it.xf.rows.forEach(q => near(q.W, hand, 1e-12)); near(it.xf.tot, 68 * hand, 1e-9);
  // = the DC1 cross-frame point loads of all five girders (the engine's own distribution of the same frames)
  const G = XF.xfPts({ spans: P.spans.lengths.map(Number), xf: L.xf }, X), all = G.reduce((a, g) => a + g.reduce((b, q) => b + q.P, 0), 0); near(it.xf.tot, all, 1e-9);
  const t = txt.slice(txt.indexOf('Cross-frames (bridge)'));
  assert.match(t, /At a support \| X: top L5x5x3\/8, bottom L5x5x3\/8, 2 diagonals L5x5x3\/8 \| 16 \| 9\.50 \| 52\.00 \| 0\.539 \| 8\.622/); assert.match(t, /Intermediate \| [^|]+\| 52 \| 9\.50 \| 52\.00 \| 0\.539 \| 28\.022/);
  assert.match(t, /Subtotal: cross-frames \|[ |]*68[ |]*36\.645/);
});

test('BOM2: girder and bridge totals; what is not known is listed as not included', () => {
  const { B, Md, txt, P } = getOne(), t = txt.slice(txt.indexOf('Girder and bridge totals'));
  // girder: plates 87.077 + stiffeners 3.930 + bearing stiffeners 1.506 + splice plates 1.669 = 94.182 kip; bridge: + cross-frames 36.645 = 130.826 kip
  assert.match(t, /Girder G1 \| 87\.077 \| 3\.930 \| 1\.506 \| 1\.669 \| 94\.182 \| 1 \| 94\.182/); assert.match(t, /Cross-frames \(bridge\) \|[ |]*68 \| 36\.645/); assert.match(t, /Bridge total \|[ |]*130\.826/);
  near(87.077 + 3.930 + 1.506 + 1.669, 94.182, 0.0015); near(94.182 + 36.645, 130.826, 0.0015);
  assert.match(t, /Not included: shear studs; field splice bolts \(counted above, no weight\) and fill plates;/);
  // the plate girder table of before is unchanged (first segment 19.090 kip, girder 87.077 kip)
  assert.match(txt, /G1 \| 1 \| 0\.00–88\.00 \| [^|]+\| 63\.750 \| 216\.93 \| 88\.00 \| 19\.090/); assert.match(txt, /G1 \| 87\.077 \|/);
  // the cross-frame weight switched off (made-up): no cross-frame rows, listed as not included; a module that did not run: its items listed as not included
  const B2 = { ...B, frm: { ...B.frm, XF: null } }, i2 = RB.bomItems(B2); assert.equal(i2.xf, null); assert.ok(i2.miss.some(q => /^cross-frames or diaphragms/.test(q)));
  const M2 = RB.model({ ...B2, shear: null, err: { ...B.err, shear: 'made-up: not calculated' } }, { detail: 'gov', include: { exec: false, sum: false } }), b2 = SR.text(SR.build(M2));
  assert.match(b2, /Not included: [^\n]*transverse stiffeners and connection plates of G1 \(made-up: not calculated\); bearing stiffeners of G1 \(made-up: not calculated\); cross-frames or diaphragms/);
  assert.ok(!/Cross-frames \(bridge\)/.test(b2.slice(b2.indexOf('Steel bill of materials'))));
  // a section left out: the bill of materials says so instead of linking into it
  const M3 = RB.model(B, { detail: 'gov', include: { shear: false } }), d3 = SR.build(M3); assert.deepEqual(J(d3.unresolved), []); assert.match(SR.text(d3), /the Shear & stiffeners section is not in this report/);
  assert.equal(Md.sections.find(s => s.id === 'shear').subs.find(q => q.id === 'ts').key, 'bom.ts'); assert.match(SR.ref(SR.build(Md), 'bom.spl'), /^§\d+\.1$/); assert.equal(P.girders.length, 1);
});

test('BOM2: every-girder report: each line\'s items, girders with the same items listed once, the bridge total of every line', () => {
  const { A, txt, list, P } = getTwo(), bm = A.sections.find(s => s.id === 'bom'), t = txt.slice(txt.lastIndexOf('Girder and bridge totals'));
  assert.ok(bm.subs.some(q => q.id === 'xf') && bm.subs[bm.subs.length - 1].id === 't');
  // five girders (three Interior, two Exterior) + the cross-frames; the total of the table = the sum of its rows
  const rows = tables(bm.subs[bm.subs.length - 1])[0].rows, num = c => +String(cellT(c)).replace(/,/g, ''), n = rows.slice(0, -2).reduce((a, r) => a + num(r[6]), 0);
  assert.equal(n, 5); assert.equal(list.length, 5);
  const tot = rows.slice(0, -1).reduce((a, r) => a + num(r[7]), 0); near(tot, num(rows[rows.length - 1][7]), 0.003);
  // independent: Σ over the lines of (plates + items) + cross-frames
  const plate = g => g.segments.reduce((a, s) => a + (s.D * s.tw + s.topB * s.topT + s.botB * s.botT) * 490 / 144 * (s.x1 - s.x0) / 1000, 0);
  const item = it => [...it.stf, ...it.brg, ...[].concat(...it.spl.map(s => s.rows))].reduce((a, q) => a + q.n * q.b * q.t * q.L * PCI / 1000, 0);
  const hand = list.reduce((a, G) => a + plate(P.girders[G.gi]) + item(G.bom), 0) + list[0].bom.xf.tot; near(num(rows[rows.length - 1][7]), hand, 0.0006);
  assert.match(t, /Bridge total \|/);
});

test('CAMG: Deflection section: a camber table (components at the tenth points) and a camber diagram of each girder, the report\'s own values', () => {
  const { B, Md } = getOne(), SH = W.SBDSheets, df = Md.sections.find(s => s.id === 'defl'), cg = df.subs.find(q => q.id === 'cg');
  assert.ok(cg, 'sub cg'); assert.equal(df.subs.map(q => q.id).join(' '), 'd c all cg w');
  const figs = cg.items.filter(i => i.type === 'figure'), tbs = tables(cg), ok = B.cam.filter(q => q.camber);
  assert.equal(ok.length, 5); assert.equal(figs.length, 5); assert.equal(tbs.length, 5);
  ok.forEach((q, i) => { const c = q.camber, tb = tbs[i], pts = SH.tenths(q.sup);
    assert.deepEqual(J(tb.head), ['Point', 'x (ft)', 'DC1 steel + cross-frames', 'DC1 wet deck (deck, haunch, forms)', 'DC2 + DW', 'Total camber']);
    assert.equal(tb.rows.length, pts.length); assert.match(tb.caption, new RegExp(`^Camber table, G${q.j + 1}`));
    pts.forEach((t, k) => { const r = tb.rows[k], v = ['steel', 'wet', 'sd', 'total'].map(key => SH.at(c.x, c[key], t.x));
      v.forEach((x, m) => assert.equal(r[2 + m].t, W.SharedUnits.fmt(x, 3)));   // the analysis' own arrays (the Deflection tab's), not recomputed
      near(v[0] + v[1] + v[2], v[3], 1e-9, 'components add to the total'); });
    // the diagram: one line per component and the total, the largest total of each span marked with its value
    const svg = figs[i].svg; assert.equal((svg.match(/<polyline/g) || []).length, 4); assert.ok(svg.includes(`aria-label="Camber diagram, G${q.j + 1}`));
    q.supIdx.slice(0, -1).forEach((a, k) => { let m = a; for (let j = a; j <= q.supIdx[k + 1]; j++) if (c.total[j] > c.total[m]) m = j; assert.ok(svg.includes(`>${W.SharedUnits.fmt(c.total[m], 3)}</text>`), `span ${k + 1} mark`); }); });
  // the reported girder's line: the same totals as the section's own table of this girder (sub c)
  const own = ok.find(q => q.own), tOwn = tbs[ok.indexOf(own)], tC = tables(df.subs.find(q => q.id === 'c'))[1];
  tOwn.rows.forEach((r, k) => assert.equal(r[r.length - 1].t, tC.rows[k][tC.rows[k].length - 1].t));
  // and the every-girder totals table (sub all) has the same total camber of each girder
  const tAll = tables(df.subs.find(q => q.id === 'all'))[0]; ok.forEach((q, i) => tbs[i].rows.forEach((r, k) => assert.equal(r[r.length - 1].t, tAll.rows[k][2 + i].t)));
});

test('CAMG: live-load deflection check in one line: the engine\'s values, its steps of the governing span linked, its own note quoted', () => {
  const { B, Md, txt, doc } = getOne(), A = B.an, df = Md.sections.find(s => s.id === 'defl'), d = df.subs.find(q => q.id === 'd');
  const gv = A.lld.filter(q => q.status !== 'na').sort((a, b) => b.d / b.lim - a.d / a.lim)[0], F = W.SharedUnits.fmt;
  const nt = d.items.filter(i => i.type === 'note').find(i => /^Check summary, governing span/.test(i.text)); assert.ok(nt);
  assert.ok(nt.text.includes(`governing span ${gv.k + 1} (x = ${F(gv.x, 1)} ft)`)); assert.ok(nt.text.includes(`= ${F(gv.d, 3)} in against the criterion L/${gv.ratio} = ${F(gv.lim, 3)} in: D/C = ${F(gv.d / gv.lim, 3)}, OK.`));
  // every analysis step of that span (whatever the engine gives) is listed with a link, and the step's own note is quoted word for word
  const re = new RegExp(`^an\\.defl\\.[A-Za-z]+${gv.k + 1}$`), steps = A.steps.filter(q => re.test(q.id)); assert.ok(steps.length >= 2);
  steps.forEach(q => assert.ok(nt.text.includes(`[[${q.id}]]`), q.id)); assert.deepEqual(J(doc.unresolved), []);
  const main = steps.find(q => q.id === `an.defl.LL${gv.k + 1}`); assert.ok(nt.text.includes(`"${main.note}"`)); assert.ok(txt.includes(main.note));
  // a step the engine adds later for that span appears without a change here (made-up step)
  const A2 = { ...A, steps: A.steps.concat([{ ...main, id: `an.defl.ZZ${gv.k + 1}`, label: 'Made-up extra step' }]) }, M2 = RB.model({ ...B, an: A2 }, { detail: 'gov' });
  assert.ok(M2.sections.find(s => s.id === 'defl').subs[0].items.some(i => i.type === 'note' && i.text.includes(`Made-up extra step [[an.defl.ZZ${gv.k + 1}]]`)));
});

test('Display only: the governing rows and ratios of the report are not changed by the additions', () => {
  const { B, Md } = getOne(), before = JSON.stringify(B.flex.rows.map(r => r.checks.map(c => [c.id, c.ratio]))), r = RB.govRows(B);
  assert.deepEqual(J(r.rows.map(q => [q.grp, q.check, q.loc, q.r, q.rf])), J(Md.gov.map(q => [q.grp || q.mod, q.check, q.loc, q.r, q.rf])));
  assert.equal(JSON.stringify(B.flex.rows.map(q => q.checks.map(c => [c.id, c.ratio]))), before);
  // the built-in example's governing values (recorded before this change): GS7 1.229 at the pier, Inventory RF 0.61, LL deflection 0.334
  const top = Math.max(...Md.gov.filter(q => q.rf == null && isFinite(q.r)).map(q => q.r)), low = Math.min(...Md.gov.filter(q => q.rf != null).map(q => q.rf));
  near(top, 1.229, 0.0005); near(low, 0.61, 0.005); near(Md.gov.find(q => /SA3/.test(q.check)).r, 0.334, 0.0005);
});
