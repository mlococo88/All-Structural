// apps/steel-bridge NOM (2026-11-23; the Prestressed Bridge app's Nomenclature tab in the Steel Bridge app), ui/nomen.js, display only:
//   1. isSym: a quantity's name is a symbol; a comparison, a ratio, text or a blank sym (a check) is not;
//   2. collect(report model): one row per symbol and module, built from the steps the report works; every row's value, unit, description
//      and article are a step's own (the same object values: nothing is recomputed); the first use first, every use listed; the modules in
//      the workflow order, each with its output tab; checks are left out;
//   3. arts: the article text of a step's ref with the specification's name shortened;
//   4. match: the search finds a symbol by its name (TeX or plain), a word of its description, its unit, an article number, its module;
//   5. the list is built from the same bundle as the Report: building it changes no module result.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js', 'ui/nomen.js'].map(E));
const W = loadShared(...FILES), M = W.SBDModel, RB = W.SBDReportBuild, NM = W.SBDNomenUI;
const J = v => JSON.parse(JSON.stringify(v));

test('isSym: names of quantities; not comparisons, ratios, text or blanks', () => {
  ['I', 'D_{c}', '\\bar{y}', 'S_{top}', 'R_{h}', 'g_{V,2}', '\\eta_{D}', 'F_{crw}', '\\lambda_{rw}', '\\Delta_{LL}', '(\\Delta F)_{n}', 'V_{u}', 'RF_{inv}', "f'_{c}", '\\phi_{v}V_{n}', 'M_{u}'].forEach(s => assert.equal(NM.isSym(s), true, s));
  ['', null, '\\frac{P}{R_{r}}', 'e \\ge e_{min}', 's \\ge 3d', 'p \\le p_{max}', '4d \\le p \\le 48', '\\text{limit state}', '\\frac{b_{f} - (n - 1)s_{t} - d}{2} \\ge 1.0', 'a = b', 'V_u / V_n', 'A + B', '2D_c'].forEach(s => assert.equal(NM.isSym(s), false, String(s)));
});

test('arts: the article of a ref, the specification name shortened', () => {
  assert.equal(NM.arts('AASHTO LRFD 10th Ed. Art. 6.10.9.1'), '6.10.9.1');
  assert.equal(NM.arts('AASHTO LRFD 10th Ed. Eq. 6.10.1.9.1-1'), 'Eq. 6.10.1.9.1-1');
  assert.equal(NM.arts('AASHTO LRFD 10th Ed. C6.10.1 (p. 6-160); Table 3.4.1-1'), 'C6.10.1; Table 3.4.1-1');
  assert.equal(NM.arts('AASHTO MBE 4th Ed. (2026) Eq. 6A.4.2.1-1, Table 6A.4.2.2-1'), 'MBE Eq. 6A.4.2.1-1, Table 6A.4.2.2-1');
  assert.equal(NM.arts('Statics'), 'Statics'); assert.equal(NM.arts(''), ''); assert.equal(NM.arts(null), '');
});

const P = M.defaultProject(); P.project.name = 'Made-up Creek Bridge';
const B = W.SBDReportData.compute(P, 0, { src: 'analysis' });
const before = JSON.stringify([B.sec, B.loads.dead, B.shear && B.shear.gov, B.rating && B.rating.gov]);
const model = RB.model(B, { detail: 'gov', include: { exec: false, basis: false, sum: false, bom: false, sign: false } });
const D = NM.collect(model);

test('collect: one row per symbol and module, from the steps the report works; every value is a step\'s own; checks left out', () => {
  // every step of the report, by module
  const all = []; model.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it && it.type === 'steps') it.steps.forEach(t => all.push({ sec: s.id, sub: q.title, t })); })));
  assert.equal(D.steps, all.length); assert.ok(D.steps > 1500 && D.n > 250, `${D.steps} steps, ${D.n} symbols`);
  assert.deepEqual(J(D.groups.map(G => G.id)), ['proj', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'frm', 'spl', 'wd', 'rt']);
  assert.deepEqual(J(D.groups.map(G => G.tab)), ['loads', 'loads', 'an', 'defl', 'sec', 'flex', 'shear', 'fat', 'cn', 'cf', 'spl', 'wt', 'rt']);
  assert.equal(D.groups.reduce((a, G) => a + G.rows.length, 0), D.n);
  let uses = 0;
  D.groups.forEach(G => { const mine = all.filter(q => q.sec === G.id && NM.isSym(q.t.sym)), syms = [...new Set(mine.map(q => q.t.sym))];
    assert.deepEqual(J(G.rows.map(r => r.sym)), syms, `${G.id}: the symbols in the order first used`);
    G.rows.forEach(r => { const st = mine.filter(q => q.t.sym === r.sym); assert.equal(r.uses.length, st.length); uses += r.uses.length;
      r.uses.forEach((u, k) => { const t = st[k].t; assert.ok(Object.is(u.value, t.value), `${G.id} ${r.sym}: the step's own value`); assert.equal(u.label, String(t.label || '')); assert.equal(u.unit, t.unit || ''); assert.equal(u.ref, String(t.ref || '')); assert.equal(u.where, st[k].sub); assert.equal(u.id, t.id); }); }); });
  assert.equal(uses, all.filter(q => NM.MODS.some(m => m[0] === q.sec) && NM.isSym(q.t.sym)).length);
  // no check is listed
  D.groups.forEach(G => G.rows.forEach(r => assert.ok(!/\\(le|ge|frac|text)\b|[=<>]/.test(r.sym), r.sym)));
  // known symbols with their module values
  const row = (g, s) => D.groups.find(G => G.id === g).rows.find(r => r.sym === s);
  const n = row('an', 'n'); assert.ok(n && Math.abs(n.uses[0].value - B.sec.nr.n) < 1e-12, 'the modular ratio of the section module'); assert.match(n.uses[0].ref, /6\.10\.1\.1\.1b/);
  assert.ok(row('flex', 'D_{c}') && row('shear', 'V_{u}') && row('rt', 'RF_{inv}') && row('sec', 'I') && row('sec', 'I').uses.length > 3);
  assert.ok(Math.abs(row('rt', 'RF_{inv}').uses[0].value - 0.608) < 5e-4, 'Inventory RF of the built-in project (as the Rating tab)');
});

test('match: by symbol (TeX or plain), description, unit, article, module; every word must be found', () => {
  const G = D.groups.find(q => q.id === 'flex'), r = G.rows.find(q => q.sym === 'D_{c}'); assert.ok(r);
  ['', '  ', 'D_{c}', 'd_c', 'web compression', 'in', 'flexure', r.uses[0].label.split(' ')[0].toLowerCase()].forEach(q => assert.equal(NM.match(G, r, q), true, q));
  assert.equal(NM.match(G, r, 'web zzzz'), false); assert.equal(NM.match(G, r, 'kip-ft'), false);
  const hit = q => D.groups.reduce((a, g) => a + g.rows.filter(x => NM.match(g, x, q)).length, 0);
  assert.equal(hit(''), D.n); assert.ok(hit('6.10.9') >= 3 && hit('6.10.9') < D.n / 4); assert.ok(hit('rating') >= D.groups.find(q => q.id === 'rt').rows.length); assert.equal(hit('no-such-symbol-xyz'), 0);
});

test('display only: building the list changes no module result; a model without steps gives an empty list', () => {
  NM.collect(model); NM.collect(RB.model(B, { detail: 'gov' }));
  assert.equal(JSON.stringify([B.sec, B.loads.dead, B.shear && B.shear.gov, B.rating && B.rating.gov]), before);
  assert.deepEqual(J(NM.collect({ sections: [] })), { groups: [], n: 0, steps: 0 }); assert.deepEqual(J(NM.collect(null)), { groups: [], n: 0, steps: 0 });
  // the full report model (with the front sections) gives the same list: they hold no worked step of a module
  assert.deepEqual(J(NM.collect(RB.model(B, { detail: 'gov' })).groups.map(G => [G.id, G.rows.length])), J(D.groups.map(G => [G.id, G.rows.length])));
});
