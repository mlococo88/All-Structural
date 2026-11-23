// apps/steel-bridge RPX (2026-11-23; the Report extras of the Prestressed Bridge app), report/builders.js, display only:
//   1. References (model.refs, shared/report.js front matter): the articles the worked steps of this report cite, as computed: every
//      AASHTO LRFD / MBE article number found in a step's ref is in the list and every number listed is in some step's ref; sorted;
//      equation / table suffixes and page notes dropped; the owner's manual when an owner is chosen; a section left out takes its
//      articles with it; the every-girder report names the two specifications.
//   2. Figures: every figure with a caption is numbered "Figure n.m" by its section, in the order printed; the verdict banner and the seal
//      box are not; a second build numbers the same (no "Figure … Figure …"); the tabs' graphics (opt.figures) are the last subsection of
//      their section, copied (the given objects unchanged); a section without graphics gets no subsection.
//   3. The 3D capture (opt.snap3d): a figure of Project and owner with its date; a stale capture carries the warning note; not a PNG: none.
//   4. No computed value changes: the model without the extras' inputs has the same sections, steps and tables as before plus refs.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const E = f => path.join(ROOT, 'apps/steel-bridge', f);
const FILES = ['units.js', 'steps.js', 'vehicles.js', 'moving-load.js', 'lldf.js', 'report.js'].concat(['engine/model.js', 'engine/sections.js', 'engine/flexure.js', 'engine/owners.js',
  'engine/lldf.js', 'engine/loads.js', 'engine/shear.js', 'engine/stiffeners.js', 'engine/analysis.js', 'engine/fatigue.js', 'engine/studs.js', 'engine/framing.js', 'engine/crossframes.js',
  'engine/constructibility.js', 'engine/splices.js', 'engine/rating.js', 'ui/flexure.js', 'ui/loads.js', 'ui/shear.js', 'ui/fatigue.js', 'ui/framing.js', 'ui/rating.js', 'ui/splices.js', 'ui/constructibility.js', 'engine/welds.js', 'ui/welds.js',
  'engine/sheets.js', 'ui/deflection.js', 'report/data.js', 'report/builders.js'].map(E));
const W = loadShared(...FILES), M = W.SBDModel, RB = W.SBDReportBuild, R = W.SharedReport;
const J = v => JSON.parse(JSON.stringify(v));
const P = M.defaultProject(); P.project.name = 'Made-up Creek Bridge'; P.ownerRules.owner = 'MassDOT';
const B = W.SBDReportData.compute(P, 0, {});
const figsOf = m => { const o = []; m.sections.forEach((s, i) => s.subs.forEach(q => q.items.forEach(it => { if (it && it.type === 'figure') o.push({ i: i + 1, sec: s.id, sub: q.id, it }); }))); return o; };
const stepRefs = m => { const o = []; m.sections.forEach(s => s.subs.forEach(q => q.items.forEach(it => { if (it && it.type === 'steps') it.steps.forEach(t => { if (t.ref) o.push(String(t.ref)); }); }))); return o; };

test('References: the articles the worked steps cite, as computed; sorted; the owner manual; a section left out takes its articles with it', () => {
  const m = RB.model(B, { detail: 'gov' }), refs = J(m.refs), by = Object.fromEntries(refs);
  assert.deepEqual(refs.map(r => r[0]), ['AASHTO LRFD', 'MBE', 'MassDOT', 'Other']);
  assert.match(by['AASHTO LRFD'], /^AASHTO LRFD Bridge Design Specifications, 10th Ed\. \(2024\)\. Articles cited in the worked steps of this report: /);
  const list = t => t.replace(/^[^:]*: /, '').replace(/ \(each step.*$/, '').replace(/\.$/, '').split('; ');
  const L = list(by['AASHTO LRFD']), all = stepRefs(m), txt = all.join(' | ');
  assert.ok(L.length > 60, `${L.length} articles`);
  L.forEach(a => { assert.match(a, /^C?[A-D]?\d+[A-D]?(\.\d+[a-z]?)+$/, a); assert.ok(txt.includes(a), `${a} is in a step's ref`); });
  // every article a step names after "AASHTO LRFD 10th Ed. Art." is listed
  all.forEach(r => { const q = /^AASHTO LRFD 10th Ed\. Art\. (C?\d+(?:\.\d+[a-z]?)+)/.exec(r); if (q) assert.ok(L.includes(q[1]), `${q[1]} (${r})`); });
  ['6.10.7.1.1', '6.10.9.3.1', '4.6.2.2.1', '3.4.1', 'D6.1', 'C6.10.1', '6.13.6.1.3b'].forEach(a => assert.ok(L.includes(a), a));
  assert.ok(!L.some(a => /-\d+$/.test(a)), 'no equation / table suffix');
  assert.ok(L.indexOf('3.4.1') < L.indexOf('4.6.2.2.1') && L.indexOf('6.10.1.9.1') < L.indexOf('6.10.3.2.1') && L.indexOf('6.10.9.1') < L.indexOf('6.10.10.1.1') && L.indexOf('6.13.6.2') < L.indexOf('D6.1'), 'sorted by number, appendices last');
  const Mb = list(by.MBE); assert.ok(Mb.includes('6A.4.2.1') && Mb.every(a => /^6A\./.test(a)), Mb.join());
  assert.match(by.MassDOT, /MassDOT LRFD Bridge Manual/); assert.match(by.Other, /NSBA Bolted Field Splices/); assert.ok(!/Statics/.test(by.Other));
  // without the rating section: no MBE row; without the splices: no bolted-splice article
  const m2 = RB.model(B, { detail: 'gov', include: { rt: false, spl: false, bom: false, exec: false, sum: false, basis: false } }), by2 = Object.fromEntries(J(m2.refs));
  assert.equal(by2.MBE, undefined); assert.ok(!list(by2['AASHTO LRFD']).includes('6.13.6.1.3b')); assert.ok(list(by2['AASHTO LRFD']).includes('6.10.7.1.1'));
  // the viewer prints it in the front matter and in the text copy
  const doc = R.build(m); assert.equal(doc.unresolved.length, 0, JSON.stringify(doc.unresolved.slice(0, 3)));
  assert.match(R.text(doc), /References\nAASHTO LRFD: AASHTO LRFD Bridge Design Specifications, 10th Ed\. \(2024\)/);
  // AASHTO, no owner manual row
  const P0 = M.defaultProject(), m0 = RB.model({ ...B, P: P0 }, { detail: 'gov', include: { proj: false } });
  assert.ok(!J(m0.refs).some(r => r[0] === 'MassDOT'));
});

test('Figures: numbered "Figure n.m" by section in the order printed; the banner and the seal are not; the tabs\' graphics last in their section', () => {
  const m = RB.model(B, { detail: 'gov' }), F = figsOf(m);
  const num = F.filter(q => q.it.no), plain = F.filter(q => !q.it.no);
  assert.deepEqual(plain.map(q => q.sec), ['exec', 'sign']); plain.forEach(q => { assert.equal(q.it.plain, true); assert.ok(!/^Figure/.test(q.it.caption)); });
  const cnt = {}; num.forEach(q => { cnt[q.i] = (cnt[q.i] || 0) + 1; assert.equal(q.it.no, `${q.i}.${cnt[q.i]}`); assert.ok(q.it.caption.startsWith(`Figure ${q.it.no}: `), q.it.caption.slice(0, 40)); assert.ok(!/Figure .*Figure \d/.test(q.it.caption.slice(0, 30))); });
  assert.ok(num.length >= 10);
  const an = num.filter(q => q.sec === 'an'); assert.match(an[0].it.caption, /^Figure \d+\.1: Moments, unfactored/);
  // the same on a second build (fresh items each time)
  assert.deepEqual(figsOf(RB.model(B, { detail: 'gov' })).map(q => q.it.caption), F.map(q => q.it.caption));
  // the tabs' graphics: copied in, last subsection, numbered after the section's own figures
  const given = { flex: [{ caption: 'Girder elevation coloured by governing ratio', svg: '<div class="vk rp-vk"><svg></svg></div>' }, { caption: 'Stress checks', svg: '<svg></svg>' }], an: [{ caption: 'Girder elevation, moments and deflection', svg: '<svg></svg>' }], sec: [], zz: [{ caption: 'x', svg: '<svg></svg>' }] };
  const keep = JSON.stringify(given), mf = RB.model(B, { detail: 'gov', figures: given }), bySec = Object.fromEntries(mf.sections.map(s => [s.id, s]));
  assert.equal(JSON.stringify(given), keep, 'the given figures are not changed');
  const fx = bySec.flex.subs.at(-1); assert.equal(fx.id, 'fg'); assert.equal(fx.title, 'Graphics of the Flexure tab'); assert.equal(fx.items[0].type, 'note'); assert.match(fx.items[0].text, /\[\[tab:flex\|Flexure tab\]\]/);
  const nf = mf.sections.indexOf(bySec.flex) + 1; assert.deepEqual(J(fx.items.slice(1).map(i => i.caption)), [`Figure ${nf}.1: Girder elevation coloured by governing ratio`, `Figure ${nf}.2: Stress checks`]);
  const ax = bySec.an.subs.at(-1), na = mf.sections.indexOf(bySec.an) + 1, own = an.length;
  assert.equal(ax.id, 'fg'); assert.equal(ax.items.at(-1).caption, `Figure ${na}.${own + 1}: Girder elevation, moments and deflection`);
  assert.ok(!bySec.sec.subs.some(q => q.id === 'fg'), 'no graphics given: no subsection'); assert.ok(!bySec.shear.subs.some(q => q.id === 'fg'));
  // the other subsections keep their numbers (the graphics come last)
  assert.deepEqual(bySec.flex.subs.slice(0, -1).map(q => q.title), m.sections.find(s => s.id === 'flex').subs.map(q => q.title));
  const doc = R.build(mf); assert.equal(doc.unresolved.length, 0); assert.equal(doc.dup.length, 0);
  // a section left out gets no graphics
  const mx = RB.model(B, { detail: 'gov', figures: given, include: { flex: false } }); assert.ok(!mx.sections.some(s => s.id === 'flex'));
});

test('The 3D capture: a figure of Project and owner with its date; a capture before the last input change is marked; not a PNG: none', () => {
  const png = 'data:image/png;base64,iVBORw0KGgo=';
  const m = RB.model(B, { detail: 'gov', snap3d: { png, at: '11/23/2026, 2:00:00 PM', meta: 'Whole bridge; layers: girders and plates, deck', stale: false } });
  const pr = m.sections.find(s => s.id === 'proj'), v3 = pr.subs.at(-1), np = m.sections.indexOf(pr) + 1;
  assert.equal(v3.id, 'v3'); assert.equal(v3.title, '3D view (captured)');
  assert.equal(v3.items[0].caption, `Figure ${np}.1: 3D view (captured on the 3D view tab, 11/23/2026, 2:00:00 PM): Whole bridge; layers: girders and plates, deck`);
  assert.ok(v3.items[0].svg.includes(`<img src="${png}"`)); assert.equal(v3.items[1].warn, false); assert.match(v3.items[1].text, /Display only/);
  const ms = RB.model(B, { detail: 'gov', snap3d: { png, at: 't', meta: 'm', stale: true } }), n2 = ms.sections.find(s => s.id === 'proj').subs.at(-1).items[1];
  assert.equal(n2.warn, true); assert.match(n2.text, /^Captured before the last input change: capture again on the \[\[tab:3d\|3D view tab\]\]/);
  assert.ok(!RB.model(B, { detail: 'gov', snap3d: { png: 'javascript:alert(1)', at: 't' } }).sections.find(s => s.id === 'proj').subs.some(q => q.id === 'v3'));
  assert.ok(!RB.model(B, { detail: 'gov' }).sections.find(s => s.id === 'proj').subs.some(q => q.id === 'v3'));
  assert.ok(!RB.model(B, { detail: 'gov', snap3d: { png, at: 't' }, include: { proj: false } }).sections.some(s => s.id === 'proj'));
});

test('Nothing else of the report changes: the same sections, subsections, steps and tables; the every-girder report names the specifications and numbers its figures', () => {
  const m = RB.model(B, { detail: 'gov' });
  // every step and table cell is what the modules gave: the figure numbering and the References touch captions and refs only
  const strip = mm => J(mm.sections).map(s => ({ id: s.id, title: s.title, subs: s.subs.map(q => ({ id: q.id, title: q.title, items: q.items.map(it => it.type === 'figure' ? { type: 'figure', svg: it.svg.length, cap: String(it.caption).replace(/^Figure \d+\.\d+: /, '') } : it) })) }));
  const a = strip(m), b = strip(RB.model(B, { detail: 'gov', figures: {}, snap3d: null }));
  assert.deepEqual(a, b);
  assert.deepEqual(Object.keys(m).sort(), ['code', 'gov', 'head', 'info', 'refs', 'sections', 'subtitle', 'title']);
  const r = RB.govRows(B), A = RB.allModel(P, [{ gi: 0, j: 1, label: 'G1', rows: r.rows, err: r.err, sum: r.sum, bom: r.bom }]);
  assert.deepEqual(J(A.refs).map(q => q[0]), ['AASHTO LRFD', 'MBE']);
  const FA = figsOf(A); FA.filter(q => q.sec === 'exec').forEach(q => assert.equal(q.it.plain, true));
  FA.filter(q => !q.it.plain && q.it.caption).forEach(q => assert.match(q.it.caption, new RegExp(`^Figure ${q.i}\\.\\d+: `)));
  assert.equal(R.build(A).unresolved.length, 0);
});
