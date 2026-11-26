// apps/ps-bridge Report, governing lines and stations (RG, 2026-11-25, the engineer's request; display only): report/builders.js linesSub,
// rtApp, appSec; ui/rating.js govRows; the option "work every girder line in full" (B.mode 'all') keeps the report as before.
//   1. a made-up 4-line NEXT 24F bridge, Interior S1 on G2–G3, Exterior S1 (own f′c) on G1, G4: each type is worked on its governing line
//      (the highest controlling D/C; a full tie: the first line): G2 and G1; §1 has "Girder lines not worked in full", one row per line,
//      the worked line first, each check group's ratio and verdict = the Summary tab's (ui/summary.js model), the governing check, a
//      link to the type's worked sections; the rule is stated; every reference resolves, no duplicate anchor, no NaN;
//   2. the Rating section shows the governing stations: for each group the row with the lowest inventory RF (= the engine's governing
//      row, PSBRatingAlong A.gov) and the lowest operating RF, and the rows at the critical sections (bearings, shear critical section,
//      tenth points, transfer and debond points, midspan), each row a row of the table of every location (the same values), once, in
//      station order; the total number of ratings and stations is stated; no appendix unless asked;
//   3. "Full rating table (appendix)": the appendix is the last section, one subsection per worked girder with every row of its table,
//      linked both ways; the section numbers, the contents and the executive summary's links stay consistent;
//   4. a line whose verdict / governing check / group verdict differs from its worked line is flagged "differs from G<n>: see values";
//   5. "every girder line in full" (mode 'all'): no line summary, the rating tables as before (no governing-stations card, no appendix even
//      when asked), so the report is the report before this change; one girder type on its lines (one worked girder): the summary too;
//   6. building the report changes nothing in the results, the inputs or the project; the values recorded are those the tabs show.
// Made-up bridges only.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr', 'rating-along'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, RB = W.PSBReportBuild, SR = W.SharedReport, SU = W.PSBSummaryUI, AL = W.PSBRatingAlong, RTU = W.PSBUiRating, fx = W.PSBOutKit.fx;
const J = v => JSON.parse(JSON.stringify(v));
const txt = c => (c && typeof c === 'object' ? c.t : c), cellsOf = r => (Array.isArray(r) ? r : r.cells);
const sec = (Mo, id) => Mo.sections.find(s => s.id === id);
/* the made-up bridge: NEXT 24F, 50 ft simple span, four lines at 8 ft, 28 strands (4 debonded 10 ft), Exterior S1 with its own f′c 9 ksi */
function next4() {
  const P = M.newProject(); P.project.name = 'NEXT 24F four-line test (made up)';
  P.xs.nb = 4; P.xs.bays = [8, 8, 8]; P.xs.ohL = 0; P.xs.ohR = 0; P.spans.lengths = [50];
  Object.assign(P.base, { girder: 'NEXT 24F', L: 50, S: 8, ts: 6, harp: { n: 0, yEnd: 16, yMid: 8, frac: 0.4 }, nGirders: 4,
    rows: [{ n: 14, y: 2, dbnd: 0, nd: 0 }, { n: 10, y: 4, dbnd: 10, nd: 4 }, { n: 4, y: 20, dbnd: 0, nd: 0 }] });
  P.base.opt.relAs = 2.5;
  P.types = [{ id: 'T1', label: 'Interior S1', span: 1, lines: [2, 3], ovr: {} }, { id: 'T2', label: 'Exterior S1', span: 1, lines: [1, 4], ovr: { 'mat.fc': 9 } }]; P.design = { g: 2, s: 1 };
  return M.importJSON(M.exportJSON(P)).project;
}
const build = (P, mode, opt) => { const B = W.PSBReportData.compute(P, null, mode); assert.equal(B.err, ''); const Mo = RB.model(B, opt || {}), doc = SR.build(Mo); return { B, Mo, doc, T: SR.text(doc) }; };
const clean = (r, tag) => { assert.deepEqual(J(r.doc.unresolved), [], tag + ': references'); assert.deepEqual(J(r.doc.dup), [], tag + ': anchors'); assert.ok(!/NaN|undefined|\[object|§\?/.test(r.T), tag + ': text'); assert.ok(!/Report error/.test(r.T), tag); };

test('RG 1: each girder type worked on its governing line; §1 "Girder lines not worked in full" = the Summary tab\'s values, linked', () => {
  const P = next4(); assert.deepEqual(J(W.PSBInputCheck.collect(P).errors), []);
  const P0 = JSON.stringify(P), r = build(P, 'gov'); clean(r, 'gov');
  assert.deepEqual(J(r.B.units.map(u => [u.label, u.g])), [['Interior S1', 2], ['Exterior S1', 1]], 'the governing lines (a full tie: the first line)');
  const SM = SU.model(P, r.B.all), s1 = sec(r.Mo, 'sum'), ln = s1.subs.find(q => q.id === 'ln'); assert.ok(ln, 'the line summary');
  assert.equal(s1.subs[0].id, 'all'); assert.equal(s1.subs[1].id, 'ln', 'after the tables of every type and line');
  assert.match(ln.items[0].text, /the line with the highest controlling D\/C/); assert.match(ln.items[0].text, /The 2 other lines are summarised here/);
  const tb = ln.items.find(i => i.type === 'table');
  assert.deepEqual(J(tb.head), ['Line', 'Girder type', ...SM.used.map(gp => gp.name), 'Governing check', 'Status', 'Worked', 'Compared with the worked line']);
  assert.deepEqual(J(tb.rows.map(q => txt(cellsOf(q)[0]))), ['G2', 'G3', 'G1', 'G4'], 'each type, its worked line first');
  const rng = { Interior: '[[rs.sec@u0]]–[[rs.rt@u0]]', Exterior: '[[rs.sec@u1]]–[[rs.rt@u1]]' };
  tb.rows.forEach(q => { const c = cellsOf(q), g = +txt(c[0]).slice(1), T = SM.types.find(t => t.label === c[1]), z = T.lines.find(l => l.c.g === g), n = SM.used.length;
    SM.used.forEach((gp, j) => { const v = z.groups[gp.id]; assert.equal(txt(c[2 + j]), `${fx(v.q.r, 3)} ${v.q.pass ? 'PASS' : 'FAIL'}`, `G${g} ${gp.name}`); });
    assert.equal(c[2 + n], `${z.gov.q.n} (${z.gov.gp.name})`); assert.equal(txt(c[3 + n]), z.nF ? `FAIL (${z.nF})` : 'PASS');
    const r0 = rng[c[1].split(' ')[0]], worked = r.B.units.some(u => u.k === T.k && u.g === g);
    assert.equal(c[4 + n], worked ? `worked in full: ${r0}` : `see ${r0} (G${r.B.units.find(u => u.k === T.k).g})`, `G${g} link`);
    assert.equal(txt(c[5 + n]), worked ? 'the governing line of the type' : `as G${g === 3 ? 2 : 1}: the same verdicts and governing check`); });
  assert.match(ln.items[2].text, /Every line not worked in full has the verdicts and the governing check/);
  // the executive summary, contents and numbering: one section per key, numbered in order; exec links resolve (clean above)
  assert.deepEqual(J(r.Mo.sections.map(s => s.id).slice(0, 4)), ['exec', 'sum', 'proj', 'basis']); assert.deepEqual(J(r.Mo.sections.map(s => s.id).slice(-2)), ['bom', 'sign']);
  assert.deepEqual(J(r.doc.toc.map(s => s.n)), J(r.Mo.sections.map((s, i) => String(i + 1))));
  assert.equal(JSON.stringify(P), P0, 'the project unchanged');
});

test('RG 2: the Rating section shows the governing stations (the rows of the table of every location, the count stated)', () => {
  const P = next4(), r = build(P, 'gov');
  r.B.units.forEach((u, i) => {
    const A = AL.of(u.R), G = RTU.govRows(u.R), rt = sec(r.Mo, `rt-u${i}`), c = rt.subs.find(q => /^Rating factors at the governing stations/.test(q.title));
    assert.ok(c && !rt.subs.some(q => /^Rating factors at every location/.test(q.title)), 'the governing card, not the table of every location');
    assert.equal(c.title, `Rating factors at the governing stations (${G.rows.length} of ${A.rows.length})`);
    assert.ok(G.rows.length < A.rows.length / 2 && G.rows.length >= 8, `${G.rows.length} of ${A.rows.length}`);
    assert.match(c.items[0].text, new RegExp(`^${A.rows.length} ratings were evaluated at ${new Set(A.rows.map(q => q.x)).size} stations`));
    const tb = c.items.find(q => q.type === 'table'); assert.equal(tb.rows.length, G.rows.length);
    // each row = its row of the table of every location (the same text), in x order, once
    G.rows.forEach(({ q, why }, j) => { const cs = cellsOf(tb.rows[j]).map(txt);
      assert.deepEqual(J(cs.slice(0, 9)), [q.name, ({ flexP: 'Flexure, positive', flexN: 'Flexure, negative (pier)', shear: 'Shear', s3: 'Service III' })[q.kind], fx(q.C, q.unit === 'ksi' ? 3 : 1), fx(q.DC, q.unit === 'ksi' ? 3 : 1), fx(q.DW, q.unit === 'ksi' ? 3 : 1), fx(q.LL, q.unit === 'ksi' ? 3 : 1), q.unit, fx(q.inv, 3), q.kind === 's3' ? '—' : fx(q.opr, 3)]);
      assert.equal(cs[9], why.join('; ')); assert.ok(A.rows[q.i] === q); });
    assert.deepEqual(J(G.rows.map(z => z.q.i)), [...new Set(G.rows.map(z => z.q.i))].sort((a, b) => a - b), 'once each, in station order');
    // the governing rows of each group (inventory = the engine's A.gov, and the lowest operating) are in it
    AL.GROUPS.forEach(([kd]) => { if (!A.gov[kd]) return; const w = G.rows.find(z => z.q === A.gov[kd]); assert.ok(w && /lowest (inventory )?RF/.test(w.why.join()), kd);
      if (kd !== 's3') { const lo = A.rows.filter(q => q.kind === kd && typeof q.opr === 'number').reduce((b, q) => (!b || q.opr < b.opr ? q : b), null); assert.ok(G.rows.some(z => z.q === lo && z.why.includes('lowest operating RF')), kd + ' operating'); } });
    // the critical sections: bearings, shear critical section, tenth points, transfer (ℓ_t = 36 in: 3 ft) and debond (10 ft, 13 ft) points, midspan
    //   (a station of the grid: L / 60 = 0.83 ft apart, plus ℓ_t; a critical section between two stations: the nearest, named in the reason)
    const at = x => G.rows.filter(z => Math.abs(z.q.x - x) < 1e-6).map(z => z.why.join('; ')).join(' | ');
    const near = (x, re) => G.rows.some(z => Math.abs(z.q.x - x) <= 50 / 120 + 1e-9 && z.why.some(w => re.test(w)));
    for (let j = 1; j <= 9; j++) assert.match(at(j * 5), j === 5 ? /midspan/ : new RegExp(`${j / 10}L`), `tenth point ${j}`);
    assert.match(at(3), /transfer point/); assert.match(at(47), /transfer point/); assert.match(at(10), /debond point/); assert.match(at(40), /debond point/);
    assert.ok(near(13, /^debond transfer point \(x = 13\.00 ft; nearest rated station\)$/) && near(37, /^debond transfer point/), 'debond transfer points');
    assert.ok(G.rows.some(z => /^bearing \(x = 0\.00 ft; nearest rated station\)/.test(z.why[0])), 'bearing at x = 0'); assert.ok(G.rows.some(z => z.why.some(w => /^shear critical section/.test(w))), 'shear critical section');
    assert.match(c.items[c.items.length - 1].text, /The table of every location is on the \[\[tab:rt\|Rating tab\]\]/);
  });
  assert.ok(!sec(r.Mo, 'rtapp'), 'no appendix unless asked');
  // the values recorded by the Rating section are those the tab shows (data-ev of its output; the governing card writes none)
  const u = r.B.units[0], html = W.PSBUiRating.output({ P: u.P, inp: u.inp, R: u.R, W: u.W, ui: {} }), shown = [...html.matchAll(/data-ev="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(J(r.Mo.vals.filter(v => v.sec === 'rt' && v.u === 0).map(v => v.path)), shown);
});

test('RG 3: "Full rating table (appendix)": the last section, a subsection per worked girder with every row, linked both ways', () => {
  const P = next4();
  for (const every of [false, true]) {
    const r = build(P, 'gov', { rtApp: true, every }), tag = every ? 'every station' : 'tab stations'; clean(r, tag);
    const ids = r.Mo.sections.map(s => s.id), ap = sec(r.Mo, 'rtapp');
    assert.equal(ids[ids.length - 1], 'rtapp', tag); assert.deepEqual(J(ids.slice(-3, -1)), ['bom', 'sign']); assert.equal(ap.title, 'Appendix: rating factors at every station');
    assert.equal(ap.subs.length, 2);
    r.B.units.forEach((u, i) => { const A = AL.of(u.R), q = ap.subs[i], tb = q.items.find(it => it.type === 'table');
      assert.equal(q.title, `Rating factors at every location (${A.rows.length}): ${u.label} on G${u.g}, span ${u.s}`); assert.equal(q.key, `rs.rtapp@u${i}`);
      assert.equal(tb.rows.length, A.rows.length, 'every row'); assert.deepEqual(J(tb.rows.map(x => txt(cellsOf(x)[0]))), J(A.rows.map(x => x.name)));
      assert.match(q.items[0].text, new RegExp(`the governing stations: see \\[\\[rs\\.rt@u${i}\\]\\]`), 'back to the Rating section');
      const rt = sec(r.Mo, `rt-u${i}`), c = rt.subs.find(x => /^Rating factors at the governing stations/.test(x.title));
      assert.ok(!rt.subs.some(x => x.app), 'moved out of the Rating section'); assert.equal(c.items[c.items.length - 1].text, `The table of every location: see [[rs.rtapp@u${i}]] (appendix).`);
      assert.equal(SR.ref(r.doc, `rs.rtapp@u${i}`), `§${ids.length}.${i + 1}`); });
    assert.equal(r.doc.toc[r.doc.toc.length - 1].n, String(ids.length), 'numbered last');
  }
});

test('RG 4: a line that differs from its type\'s worked line is flagged "differs from G<n>: see values"', () => {
  const P = next4(), B = W.PSBReportData.compute(P, null, 'gov');
  // made-up results (display test): Exterior G1 fails Flexure at 1.30; G4 passes Flexure (0.99) and fails Shear (1.10): G1 stays the governing line
  const set = (g, f) => { const c = B.all.cells.find(z => z.k === 1 && z.g === g); c.R = Object.assign({}, c.R, { checks: c.R.checks.map(q => f[q.n] ? Object.assign({}, q, { r: f[q.n], pass: f[q.n] <= 1.0001 }) : q) }); };
  set(1, { Flexure: 1.30 }); set(4, { Flexure: 0.99, Shear: 1.10 });
  B.units = W.PSBReportData.units(P, B, 'gov'); assert.deepEqual(J(B.units.map(u => u.g)), [2, 1]);
  const Mo = RB.model(B, {}), doc = SR.build(Mo); assert.deepEqual(J(doc.unresolved), []);
  const ln = sec(Mo, 'sum').subs.find(q => q.id === 'ln'), tb = ln.items.find(i => i.type === 'table'), row = tb.rows.find(q => txt(cellsOf(q)[0]) === 'G4'), c = cellsOf(row);
  assert.equal(c[c.length - 1].t, 'differs from G1: see values (governing check Shear, G1 Flexure; Flexure verdict; Shear verdict)'); assert.equal(c[c.length - 1].cls, 'hi'); assert.equal(row.cls, 'gov');
  assert.ok(ln.items[2].warn && /G4 \(Exterior S1\): governing check Shear, G1 Flexure/.test(ln.items[2].text));
  const g3 = cellsOf(tb.rows.find(q => txt(cellsOf(q)[0]) === 'G3')); assert.equal(g3[g3.length - 1], 'as G2: the same verdicts and governing check');
  // the verdict differs: G4 passes everything while G1 fails
  set(4, { Flexure: 0.99, Shear: 0.5 }); const r2 = sec(RB.model(B, {}), 'sum').subs.find(q => q.id === 'ln').items[1].rows.find(q => txt(cellsOf(q)[0]) === 'G4');
  assert.match(cellsOf(r2).slice(-1)[0].t, /^differs from G1: see values \(verdict PASS, G1 FAIL; /);
});

test('RG 5: "every girder line in full" keeps the report as before; one girder type on its lines gets the summary too', () => {
  const P = next4(), a = build(P, 'all', { rtApp: true }); clean(a, 'all');
  assert.equal(a.B.units.length, 4); assert.ok(!sec(a.Mo, 'sum').subs.some(q => q.id === 'ln'), 'no line summary'); assert.ok(!sec(a.Mo, 'rtapp'), 'no appendix');
  a.B.units.forEach((u, i) => { const rt = sec(a.Mo, `rt-u${i}`); assert.ok(rt.subs.some(q => /^Rating factors at every location/.test(q.title)) && !rt.subs.some(q => /governing stations/.test(q.title))); });
  assert.ok(!/Rating factors at the governing stations|Girder lines not worked in full|Full rating table/.test(a.T));
  // opt.full given by the page (ui/report.js: "every girder line in full" ticked on a bridge of several lines) wins over the default (the mode)
  const g = build(P, 'gov', { full: true }); assert.ok(!/Rating factors at the governing stations/.test(g.T), 'full: the rating as before');
  // one girder type on four lines, the design girder its governing line: the one-girder report, with the line summary
  const Q = next4(); Q.types = [{ id: 'T1', label: 'All S1', span: 1, lines: [1, 2, 3, 4], ovr: {} }]; Q.design = { g: 1, s: 1 };
  const B0 = W.PSBReportData.compute(Q, null, 'gov'); Q.design = { g: B0.units[0].g, s: 1 };
  const o = build(Q, 'gov'); clean(o, 'one type'); assert.equal(o.B.multi, false);
  const ln = sec(o.Mo, 'sum').subs.find(q => q.id === 'ln'), tb = ln.items.find(i => i.type === 'table');
  assert.equal(tb.rows.length, 4); assert.equal(txt(cellsOf(tb.rows[0])[0]), `G${Q.design.g}`); assert.ok(cellsOf(tb.rows[1]).some(c => /^see \[\[rs\.sec\]\]–\[\[rs\.rt\]\] \(G\d\)$/.test(txt(c))));
  assert.ok(/Rating factors at the governing stations/.test(o.T));
  // one girder line: no summary
  const one = build(M.defaultProject(), 'gov'); assert.ok(!sec(one.Mo, 'sum').subs.some(q => q.id === 'ln'));
});

test('RG 6: building the report changes nothing (results, inputs, project) in any mode', () => {
  const P = next4(), P0 = JSON.stringify(P);
  for (const [mode, opt] of [['gov', {}], ['gov', { rtApp: true, every: true }], ['all', {}]]) {
    const B = W.PSBReportData.compute(P, null, mode), R0 = B.units.map(u => JSON.stringify(u.R)), I0 = B.units.map(u => JSON.stringify(u.inp)), A0 = JSON.stringify(B.all.cells.map(c => c.R));
    RB.model(B, opt);
    assert.deepEqual(B.units.map(u => JSON.stringify(u.R)), R0); assert.deepEqual(B.units.map(u => JSON.stringify(u.inp)), I0); assert.equal(JSON.stringify(B.all.cells.map(c => c.R)), A0);
  }
  assert.equal(JSON.stringify(P), P0);
});
