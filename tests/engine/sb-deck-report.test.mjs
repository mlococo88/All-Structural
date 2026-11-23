// apps/steel-bridge DK part 2 (2026-11-23): the deck slab design in the Report, the Summary verdict, the bill of materials and the Nomenclature.
// Made-up default bridge. Display wiring only: every number is engine/deck.js calc()'s (tests/engine/sb-deck.test.mjs, deck.test.mjs).
//   1. deck design off (every project saved before): the report model, its sections, the Summary verdict and the section list are as before;
//   2. on: a "Deck slab" section before the Rating, every link resolves, the governing rows reach the Summary section and the Executive summary;
//   3. the Summary verdict counts the deck checks once for the bridge, after a girder module has run; a failing deck fails the verdict;
//   4. bill of materials: the deck bars, hand-checked; not in the steel totals;
//   5. Nomenclature: the deck symbols listed under "Deck slab"; an input error of the deck is REVIEW, not silence.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js', 'deck.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/proportions.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/deck.js', 'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'report/summary.js', 'ui/nomen.js'].map(E));
const W = loadShared(...FILES), M = W.SBDModel, RB = W.SBDReportBuild, SM = W.SBDSummary;
const J = v => JSON.parse(JSON.stringify(v));

const P0 = M.defaultProject(); P0.project.name = 'Made-up Creek Bridge';
const B0 = W.SBDReportData.compute(P0, 0, { src: 'analysis' }), M0 = RB.model(B0, { detail: 'gov' });
const P1 = J(P0); P1.deckDesign = { on: true, sBot: 8 };
const B1 = W.SBDReportData.compute(P1, 0, { src: 'analysis' }), M1 = RB.model(B1, { detail: 'gov' });
const ids = m => [...m.sections.map(s => s.id)];

test('deck design off: no deck in the bundle, the report, the section list or the Summary verdict (as before)', () => {
  assert.equal(B0.dk, undefined); assert.equal(B0.dkOn, undefined); assert.equal(M0.sections.length, 18); assert.ok(!ids(M0).includes('dk'));
  assert.ok(!M0.gov.some(q => q.mod === 'Deck')); assert.equal(RB.sectionsOf(P0), RB.SECTIONS); assert.equal(RB.SECTIONS.length, 18);
  assert.equal(SM.deckOf(P0), null);
  const ov = SM.overall(P0, [{ gi: 0, label: 'G1', cells: { flexStr: { st: 'pass', r: 0.5, tab: 'flex' } } }]); assert.equal('deck' in ov, false); assert.equal(ov.n.pass, 1);
  assert.ok(!JSON.stringify(M0.sections.find(s => s.id === 'bom')).includes('Deck reinforcement'));
});

test('the other modules of the same bridge are not changed by switching the deck design on', () => {
  ['loads', 'an', 'sec', 'flex', 'shear', 'fat', 'cn', 'frm', 'spl', 'wd'].forEach(k => { const a = B0[k], b = B1[k]; assert.equal(JSON.stringify(a && (a.gov || a.rows || a.dead || a.C || a.list || a.cards)), JSON.stringify(b && (b.gov || b.rows || b.dead || b.C || b.list || b.cards)), k); });
  const g0 = M0.gov.map(q => [q.mod, q.check, q.r, q.rf]), g1 = M1.gov.filter(q => q.mod !== 'Deck').map(q => [q.mod, q.check, q.r, q.rf]); assert.equal(JSON.stringify(g1), JSON.stringify(g0));
});

test('deck design on: a Deck slab section before the Rating; every reference resolves; the rows reach the Summary and the Executive summary', () => {
  assert.equal(B1.dkOn, true); assert.equal(B1.err.dk, undefined); assert.equal(M1.sections.length, 19);
  const I = ids(M1); assert.equal(I[I.indexOf('rt') - 1], 'dk'); assert.equal(I.indexOf('dk'), I.indexOf('wd') + 1);
  assert.deepEqual([...RB.sectionsOf(P1).map(s => s[0])].filter(k => k === 'dk' || k === 'rt' || k === 'wd'), ['wd', 'dk', 'rt']);
  for (const detail of ['gov', 'all']) { const Mx = RB.model(B1, { detail }), doc = W.SharedReport.build(Mx), txt = W.SharedReport.text(doc);
    assert.deepEqual(J(doc.unresolved), [], detail + ': unresolved'); assert.deepEqual(J(doc.dup), [], detail + ': duplicate keys');
    assert.ok(!/NaN|undefined|\[object|§\?/.test(txt), detail + ': text clean');
    assert.ok(txt.includes('Deck slab (transverse design)') && txt.includes('DK2 Deck negative moment, top bars (Strength I)') && txt.includes('Not checked by this module')); }
  const rows = M1.gov.filter(q => q.mod === 'Deck'); assert.equal(rows.length, 3);
  B1.dk.checks.forEach((c, i) => { assert.ok(Object.is(rows[i].r, c.r)); assert.equal(rows[i].key, c.step); assert.equal(rows[i].grp, 'Deck slab (bridge)'); });
  assert.ok(Math.abs(rows[0].r - 0.97402) < 2e-5 && Math.abs(rows[1].r - 0.91567) < 2e-5 && Math.abs(rows[2].r - 0.73273) < 2e-5, 'the hand-checked ratios');
  const cells = id => JSON.stringify(M1.sections.find(s => s.id === id));
  assert.ok(cells('sum').includes('DK1 Deck positive moment') && cells('exec').includes('Deck slab (bridge)') && cells('exec').includes('DK3 Deck overhang'));
  const dkS = M1.sections.find(s => s.id === 'dk'); assert.deepEqual([...dkS.subs.map(q => q.id)], ['gov', 'in', 'bay', 'oh', 'dist', 'steps']);
  assert.equal(dkS.subs[5].items[0].steps.length, B1.dk.steps.length);
});

test('a section not chosen: the Deck slab section left out keeps its summary rows without links', () => {
  const Mx = RB.model(B1, { detail: 'gov', include: { dk: false } }), doc = W.SharedReport.build(Mx);
  assert.ok(!ids(Mx).includes('dk')); assert.deepEqual(J(doc.unresolved), []);
  const rows = Mx.gov.filter(q => q.mod === 'Deck'); assert.equal(rows.length, 3); assert.ok(rows.every(q => q.key === null && /section not included/.test(q.loc)));
});

test('Summary verdict: the deck checks count once for the bridge, after a girder module has run; a failing deck fails it', () => {
  const d = SM.deckOf(P1); assert.equal(d.cells.length, 3); assert.equal(d.st, 'pass'); assert.ok(Object.is(d.gov.r, B1.dk.checks[0].r));
  const none = SM.overall(P1, [{ gi: 0, label: 'G1', cells: { flexStr: { st: 'notrun', tab: 'flex' } } }]); assert.equal(none.deckIn, false); assert.equal(none.n.pass, 0); assert.equal(none.verdict, '—');
  const ran = SM.overall(P1, [{ gi: 0, label: 'G1', cells: { flexStr: { st: 'pass', r: 0.5, tab: 'flex' } } }, { gi: 1, label: 'G2', cells: { flexStr: { st: 'pass', r: 0.6, tab: 'flex' } } }]);
  assert.equal(ran.deckIn, true); assert.equal(ran.n.pass, 2 + 3, 'three deck checks, once'); assert.equal(ran.verdict, 'PASS'); assert.equal(ran.top.c.id, 'deck'); assert.equal(ran.top.c.tab, 'dk'); assert.equal(ran.top.G.deck, true);
  const Pf = J(P1); Pf.deckDesign.sTop = 12; const f = SM.overall(Pf, [{ gi: 0, label: 'G1', cells: { flexStr: { st: 'pass', r: 0.5, tab: 'flex' } } }]);
  assert.equal(f.verdict, 'FAIL'); assert.ok(f.n.fail >= 1); assert.ok(f.top.q.r > 1); assert.match(f.top.q.check, /^DK2 /);
  const Pe = J(P1); Pe.deckDesign.sTop = 0; const e = SM.overall(Pe, [{ gi: 0, label: 'G1', cells: { flexStr: { st: 'pass', r: 0.5, tab: 'flex' } } }]);
  assert.equal(e.verdict, 'REVIEW'); assert.equal(e.n.review, 1); assert.match(e.deck.cells[0].loc, /Top bar spacing/);
});

test('an input error of the deck design: the report says so (REVIEW), the other sections build', () => {
  const Pe = J(P1); Pe.deckDesign.coverT = -1; const Be = W.SBDReportData.compute(Pe, 0, { src: 'analysis', want: { dk: true, loads: true, proj: true } }), Me = RB.model(Be, { detail: 'gov' });
  assert.match(Be.err.dk, /Top cover/); const s = Me.sections.find(q => q.id === 'dk'); assert.equal(s.subs[0].title, 'Not available');
  const g = Me.gov.find(q => q.mod === 'Deck'); assert.ok(Number.isNaN(g.r)); assert.match(g.loc, /Top cover/);
});

test('bill of materials: the deck bars (hand check), apart from the steel totals', () => {
  const bom = M1.sections.find(s => s.id === 'bom'), d = bom.subs.find(q => q.id === 'dk'); assert.ok(d, 'deck sub'); assert.match(d.title, /not in the steel totals/);
  const rows = d.items.find(it => it.type === 'table').rows.map(r => r.map(c => (c && typeof c === 'object' ? c.t : c)));
  // L = 110 + 140 + 110 = 360 ft; deck width = 4(9.5) + 2(3.25) = 44.5 ft; 490/144 = 3.40278 lb/ft per in^2
  // top #5 at 6 in: n = 12(360)/6 + 1 = 721; W = 721(44.5)(0.31)(3.40278) = 33,845 lb
  // bottom #5 at 8 in: n = 540 + 1 = 541; W = 541(44.5)(0.31)(3.40278) = 25,395 lb
  // distribution: 0.67(0.465) = 0.31155 in^2/ft: 0.31155(44.5)(360)(3.40278) = 16,983 lb; total 76,223 lb
  assert.deepEqual([...rows.map(r => r[2])], ['721', '541', '—', '']);
  const w = rows.map(r => +String(r[4]).replace(/,/g, '')); [33845, 25395, 16983, 76223].forEach((x, i) => assert.ok(Math.abs(w[i] - x) <= 1, `${w[i]} vs ${x}`));
  const t0 = JSON.stringify(M0.sections.find(s => s.id === 'bom').subs.find(q => q.id === 't')), t1 = JSON.stringify(bom.subs.find(q => q.id === 't')); assert.equal(t1, t0, 'steel totals unchanged');
});

test('Nomenclature: the deck symbols under "Deck slab", values the steps\' own', () => {
  const D = W.SBDNomenUI.collect(RB.model(B1, { detail: 'gov', include: { exec: false, basis: false, sum: false, bom: false, sign: false } }));
  const g = D.groups.find(q => q.id === 'dk'); assert.ok(g, 'group'); assert.equal(g.tab, 'dk'); assert.equal(g.title, 'Deck slab');
  const sym = [...g.rows.map(r => r.sym)]; ['w_{DC}', 'M_{LL,pos}', 'M_{u,neg}', 'A_{s}', '\\varepsilon_{t}', '\\phi M_{n}', 'SW_{oh}', 'p_{d}'].forEach(s => assert.ok(sym.includes(s), s));
  assert.ok(!sym.some(s => /\\le/.test(s)), 'checks are not symbols');
  const D0 = W.SBDNomenUI.collect(RB.model(B0, { detail: 'gov', include: { exec: false, basis: false, sum: false, bom: false, sign: false } })); assert.ok(!D0.groups.some(q => q.id === 'dk'));
});
