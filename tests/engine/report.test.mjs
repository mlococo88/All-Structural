// shared/report.js (the report viewer) and apps/steel-bridge/report/ (data.js, builders.js): the Steel Bridge calculation report.
//
// 1. shared/report.js on a small hand-made model: numbering §n / §n.m, step anchors (scope/id), [[key]] references, a step note's
//    "§<step id>" resolved in the item's scope (relative id) or item.see, lazy items, duplicate keys, unresolved keys, plain text.
// 2. The full report of this app's built-in project (its own analysis) and of 5 hand-off payloads (tests/projects/st), every section,
//    detail 'gov' and 'all': every cross-reference ("see §x.y", every § link) resolves to a step in the report; no duplicate anchor;
//    no 'NaN', 'undefined', '[object', '§?' in the text; every step value finite (KNOWN_NAN empty); every $…$ the builders write parses
//    in KaTeX.
// 3. The report shows the modules' own numbers: the summary's ratios are the modules' governing ratios (same objects); the analysis
//    run once for the report (memoised in data.js) is not changed by any module (its JSON equals a fresh analysis).
// 4. Sections not chosen: the summary keeps their rows without links; no reference dangles.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'report/data.js', 'report/builders.js'].map(E));
const STD = path.join(ROOT, 'tests/projects/st');
const PAYLOADS = ['gd_builtin28_AASHTO_G1.json', 'gd_xsA_CTDOT_G1.json', 'gd_util_MassDOT_G3.json', 'gd_curb_RIDOT_G5.json', 'gd_builtin_AASHTO_G2.json'];
const KNOWN_NAN = new Set([]);   // step ids allowed a non-finite value (then the report must list them); none since SB2-R2 (#487)
const J = v => JSON.parse(JSON.stringify(v));   // a copy in this realm (deepEqual compares prototypes)
const katex = (() => { const c = loadShared(path.join(ROOT, 'tests/libs/katex@0.16.9/dist/katex.min.js')); return c.katex; })();

/* ---------- 1. the viewer on a hand-made model ---------- */
test('shared/report.js: numbering, anchors, references, step-note links, lazy items, text', () => {
  const W = loadShared('units.js', 'steps.js', 'report.js'), R = W.SharedReport, ST = W.SharedSteps;
  const w = ST.work('a'); w.add({ id: 'x', label: 'Length', sym: 'L', eq: '2 \\times 3', sub: '', value: 6, unit: 'ft', d: 1 });
  w.add({ id: 'y', label: 'Twice', sym: 'y', eq: '2L', sub: '2(6.0)', value: 12, unit: 'ft', d: 1, note: 'See §x.' });   // relative id: a.x
  const v = ST.work('b'); v.add({ id: 'z', label: 'Ratio', sym: 'r', eq: '\\frac{y}{24}', sub: '\\frac{12.0}{24}', value: 0.5, unit: '', d: 3, ok: true, note: 'y: see §a.y.' });
  const M = { title: 'T', info: [['Project', 'P1']], sections: [
    { title: 'One', subs: [{ title: 'Summary', items: [{ type: 'table', head: ['Check', 'Ratio'], rows: [['r', { t: '0.500', key: 'q/b.z' }]] }, { type: 'note', text: 'Length [[s1/a.x]], ratio $r_{1}$ [[q/b.z]], [[tab:flex|Flexure tab]].' }] }] },
    { title: 'Two', subs: [{ title: 'A', items: [{ type: 'steps', scope: 's1', steps: w.steps }] }, { title: 'B', items: [{ type: 'steps', scope: 'q', steps: v.steps, see: 's1', lazy: true, title: 'Lazy' }] }] }] };
  const doc = R.build(M);
  assert.deepEqual(J(doc.toc.map(s => [s.n, s.subs.map(q => q.n)])), [['1', ['1.1']], ['2', ['2.1', '2.2']]]);
  assert.equal(R.ref(doc, 's1/a.x'), '§2.1'); assert.equal(R.ref(doc, 'q/b.z'), '§2.2'); assert.equal(doc.unresolved.length, 0); assert.equal(doc.dup.length, 0);
  assert.equal(doc.refs.length, 5, JSON.stringify(doc.refs));   // 2 in the note, 1 in the cell, the two step notes
  const txt = R.text(doc);
  assert.match(txt, /Length §2\.1, ratio r_1 §2\.2, Flexure tab\./); assert.match(txt, /0\.500 §2\.2/);
  assert.match(txt, /Twice: y = 2L = 2\(6\.0\) = 12\.0 ft \(See §2\.1\.\)/); assert.match(txt, /Ratio: r = y\/24 = 12\.0\/24 = 0\.500 OK \(y: see §2\.1\.\)/);
  const lazyH = R.html(doc, { lazy: true }), fullH = R.html(doc, { lazy: false });
  assert.ok(!/Ratio<\/div>/.test(lazyH.replace(/<[^>]*rp-d[^>]*>/g, '')) || !lazyH.includes('rp-st3'), 'lazy item not rendered');
  assert.ok(fullH.includes('id="rp-st3"') && lazyH.includes('data-rplz="0"'));
  // an unresolved key and a duplicate
  const d2 = R.build({ sections: [{ title: 'S', subs: [{ title: 'x', items: [{ type: 'note', text: '[[nope]]' }, { type: 'steps', scope: '', steps: [w.steps[0], w.steps[0]] }] }] }] });
  assert.deepEqual(J([d2.unresolved.map(u => u.key), d2.dup]), [['nope'], ['a.x']]); assert.match(R.text(d2), /§\?/);
});

/* ---------- 2–4. the Steel Bridge report ---------- */
function checkReport(W, B, name) {
  const out = {};
  for (const detail of ['gov', 'all']) {
    const M = W.SBDReportBuild.model(B, { detail }), doc = W.SharedReport.build(M), txt = W.SharedReport.text(doc);
    assert.equal(M.sections.length, 13, `${name} ${detail}: sections`); assert.equal(M.sections[0].id, 'sum');
    assert.deepEqual(J(doc.unresolved), [], `${name} ${detail}: unresolved references`);
    assert.deepEqual(J(doc.dup), [], `${name} ${detail}: duplicate step keys`);
    const nums = new Set(doc.toc.flatMap(s => s.subs.map(q => q.n)));
    const sees = txt.match(/§[^\s.,;:)]*(?:\.\d+)?/g) || [];
    sees.forEach(s => assert.ok(nums.has(s.slice(1)), `${name} ${detail}: "${s}" is not a subsection of the report`));
    const bad = txt.split('\n').filter(l => /NaN|undefined|\[object|§\?/.test(l));
    assert.deepEqual(bad.slice(0, 5), [], `${name} ${detail}: bad text`);
    // step values
    const nf = [];
    M.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(st => { if (typeof st.value === 'number' && !isFinite(st.value)) nf.push(st.id); }); })));
    const unknown = nf.filter(id => !KNOWN_NAN.has(id)); assert.deepEqual(unknown, [], `${name} ${detail}: non-finite step values`);
    if (nf.length) assert.match(txt, /Not evaluated \(ratio not a number\)/, `${name}: the SB2-R2 locations are listed`);
    // every $…$ the builders write is valid KaTeX
    const tex = new Set(); const grab = t => String(t == null ? '' : t).replace(/\$([^$]+)\$/g, (m, x) => { tex.add(x); return m; });
    M.sections.forEach(s => { grab(s.title); grab(s.note); s.subs.forEach(q => { grab(q.title); q.items.forEach(it => { grab(it.text); grab(it.caption); grab(it.title);
      (it.head || []).forEach(c => grab(c && c.t !== undefined ? c.t : c)); (it.rows || []).forEach(r => (Array.isArray(r) ? r : r.cells || r).forEach(c => grab(c && typeof c === 'object' ? c.t : c))); }); }); });
    tex.forEach(t => assert.doesNotThrow(() => katex.renderToString(t, { throwOnError: true, strict: 'ignore', macros: { '\\minus': '-' } }), `${name}: KaTeX "${t}"`));
    out[detail] = { M, doc, txt, steps: doc.index.size, refs: doc.refs.length, nf: nf.length };
  }
  return out;
}

test('Steel Bridge report: the built-in project (its own analysis), every section, both detail levels', () => {
  const W = loadShared(...FILES), P = W.SBDModel.defaultProject();
  const B = W.SBDReportData.compute(P, 0);
  assert.equal(JSON.stringify(B.err), '{}', 'module errors');
  const o = checkReport(W, B, 'built-in');
  // the summary quotes the modules' own governing values, each linked to the step of that check
  const g = o.gov.M.gov, row = m => g.find(q => q.mod === m);
  assert.equal(row('Flexure').r, B.flex.gov.gov.ratio); assert.ok(row('Flexure').key.endsWith('/' + B.flex.gov.gov.step));
  assert.equal(row('Constructibility').r, B.cn.govAll.ratio);
  assert.equal(g.find(q => /^Inventory/.test(q.check)).rf, B.rating.sum.gov.inv.inv);
  assert.ok(g.every(q => q.key && o.gov.doc.index.has(q.key)), 'every summary row links to its step');
  // the memoised analysis was not changed by the modules: equal to a fresh run
  const fresh = W.SBDAnalysis.analyzeGirder(P, 0), memo = B.memo.get('0|{}');
  assert.ok(memo === B.an); assert.equal(JSON.stringify(memo), JSON.stringify(fresh), 'the analysis result was modified by a module');
  const fresh2 = W.SBDAnalysis.analyzeGirder(P, 0, { ll: false }); assert.equal(JSON.stringify(B.memo.get('0|{"ll":false}')), JSON.stringify(fresh2));
  // sections not chosen: no dangling reference, the summary rows stay unlinked
  const M3 = W.SBDReportBuild.model(B, { detail: 'gov', include: { flex: false, an: false, sec: false } }), d3 = W.SharedReport.build(M3);
  assert.deepEqual(J(d3.unresolved), []); assert.equal(M3.sections.length, 10); assert.ok(M3.gov.find(q => q.mod === 'Flexure' && q.key === null && /not included/.test(q.loc)));
  console.log(`       built-in: gov ${o.gov.steps} steps, ${o.gov.refs} references; all ${o.all.steps} steps, ${o.all.refs} references; all resolve; non-finite steps ${o.gov.nf}`);
});

test('Steel Bridge report: 5 hand-off payloads, every section, both detail levels', () => {
  const W = loadShared(...FILES), P = W.SBDModel.defaultProject();
  PAYLOADS.forEach(f => {
    const j = JSON.parse(fs.readFileSync(path.join(STD, f), 'utf8')), B = W.SBDReportData.compute(P, 0, { src: 'file', pl: j.payload || j, plName: f });
    assert.equal(JSON.stringify(B.err), '{}', `${f}: module errors`);
    const o = checkReport(W, B, f);
    assert.match(o.gov.txt, /Field splices[\s\S]*Not in this report/, `${f}: splices need this project's analysis`);
    console.log(`       ${f}: gov ${o.gov.steps} steps / ${o.gov.refs} refs, all ${o.all.steps} / ${o.all.refs}: all resolve`);
  });
});
