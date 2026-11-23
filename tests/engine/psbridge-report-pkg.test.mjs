// apps/ps-bridge report package (2026-11-23, engineer's request: the Steel Bridge report's features; display only), report/builders.js:
//   exec (Executive summary), basis (Basis of design), bom (Bill of materials), sign (Sign-off and revisions), ptSub (design-point headers).
//   1. order: exec first, then the summary, the project section, basis, the worked sections, bom, sign; every reference resolves; no NaN;
//   2. the verdict, its counts and the governing check = the Summary tab's (ui/summary.js model); one row per check group with the largest
//      ratio of an independent engine run of every girder type × line, the type and line named, a "see §" link to the step that works it;
//   3. every number recorded by the new sections = the engine value of its girder type and line (u: a worked unit, cell: another line);
//   4. one design girder (no girder types): the same rule over its own checks;
//   5. the bill of materials: V = A L_g / 144, W = w_sw L_g, strand weight = N L_g A_b 490/144, the bridge totals = the sums (the weight =
//      the Summary's bridge weight), a hand check of the default project; what is not known is listed;
//   6. the basis of design: specification, factors, η and m of the owner (RIDOT m = 1.2), the loss method, the assumptions link;
//   7. the sign-off shows the project fields and writes nothing into the project; the design-point header lists each check at its station;
//   8. a section left out leaves no broken link; building the report changes nothing in the results, the inputs or the project.
// Made-up bridges only (the test projects of psbridge-summary.test.mjs).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['sections', 'model', 'rigid', 'lldf-fg', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, BR = W.PSBBridge, SU = W.PSBSummaryUI, DU = W.PSBDashUI, RB = W.PSBReportBuild, SR = W.SharedReport, fx = W.PSBOutKit.fx;
const J = v => JSON.parse(JSON.stringify(v));
const at = (R, p) => p.split('.').reduce((o, k) => (o == null ? o : o[k]), R);
const load = P => M.importJSON(M.exportJSON(P)).project;
const bad = x => typeof x !== 'number' || isNaN(x), worse = (a, b) => (bad(a) && !bad(b)) || (!bad(a) && !bad(b) && a > b), fin = v => typeof v === 'number' && isFinite(v);
const cellsOf = r => (Array.isArray(r) ? r : r.cells), txt = c => (c && typeof c === 'object' ? c.t : c);
const sec = (Mo, id) => Mo.sections.find(s => s.id === id);
const tables = s => [].concat(...s.subs.map(q => q.items.filter(i => i.type === 'table')));

function projects() {
  const out = {}, CS = TAB_CASES(() => M.defaultProject());
  ['default (BT-72, interior, simple)', 'CTDOT, debonded rows, diaphragms, girder end 9 in past the bearing', 'handling and deck on, rating vehicles, φc φs floored', 'box BIII-36, no topping, debonded row, diaphragm, RIDOT',
    'approximate losses, transformed release, severe corrosion, bonded release steel, entered fatigue DF'].forEach(n => { assert.ok(CS[n], n); out['tab: ' + n] = load(CS[n]); });
  const nw = () => load(M.newProject());
  out['new project (Interior + Exterior)'] = nw();
  { const P = nw(); P.xs.bays = [8, 10, 10, 8]; P.types[1].ovr = { 'mat.fc': 9 }; const k = BR.addType(P, 0, { label: 'G3 own' }); P.types[k].ovr = { 'mat.fc': 7 }; BR.assignLine(P, k, 3); out['three types, own inputs, unequal bays'] = P; }
  { const P = nw(); P.spans.lengths = [90, 90]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0]; BR.syncSpans(P); const k = P.types.findIndex(t => t.span === 2 && /Exterior/.test(t.label)); P.types[k].lines = [1]; out['two spans, G5/S2 not checked'] = P; }
  Object.entries(out).forEach(([n, P]) => assert.deepEqual(J(W.PSBInputCheck.collect(P).errors), [], n + ': no input error'));
  return out;
}
const PS = projects();
const indep = P => BR.cells(P).map(c => { const inp = D.cellInputs(P, c.k, c.g); return { c, inp, R: W.PSBHoldDown.compute(J(inp)) }; });
const grpOf = n => DU.GROUPS.find(gp => gp.checks.some(([cn]) => cn === n));

test('report package: order, references, the verdict and the check-group rows = the Summary tab and an independent run; every recorded value = its engine value', () => {
  let nRows = 0, nVals = 0, nFail = 0, nPass = 0;
  for (const [name, P] of Object.entries(PS)) for (const mode of ['gov', 'all']) {
    const B = W.PSBReportData.compute(P, null, mode); assert.equal(B.err, '', name);
    const Mo = RB.model(B, {}), doc = SR.build(Mo), T = SR.text(doc), ids = Mo.sections.map(s => s.id), tag = `${name} ${mode}`;
    assert.deepEqual(J(ids.slice(0, 4)), ['exec', 'sum', 'proj', 'basis'], tag); assert.deepEqual(J(ids.slice(-2)), ['bom', 'sign'], tag);
    assert.deepEqual(J(doc.unresolved), [], tag + ': references'); assert.deepEqual(J(doc.dup), [], tag + ': anchors');
    assert.ok(!/NaN|undefined|\[object/.test(T), tag + ': text'); assert.ok(!/Report error/.test(T), tag + ': no section failed');
    // the verdict = the Summary tab's
    const SM = SU.model(P, B.all), want = SM.nF ? 'FAIL' : SM.nR ? 'REVIEW' : 'PASS', ex = sec(Mo, 'exec'), fig = ex.subs[0].items.find(i => i.type === 'figure');
    assert.ok(fig.svg.includes(`aria-label="${want}"`), `${tag}: verdict ${want}`); assert.ok(fig.svg.includes(`${SM.nF} FAIL, ${SM.nR} REVIEW, ${SM.nP} PASS`), tag + ': counts');
    if (want === 'FAIL') nFail++; else nPass++;
    // one row per check group: the largest ratio of an independent run of every type × line
    const I = indep(P), [tb] = tables(ex);
    assert.deepEqual(J(tb.rows.map(r => txt(cellsOf(r)[0]))), J(SM.used.map(gp => gp.name)), tag + ': a row per check group');
    tb.rows.forEach(r => { const c = cellsOf(r), gp = DU.GROUPS.find(g => g.name === c[0]); let b = null;
      I.forEach(z => z.R.checks.forEach(q => { if (grpOf(q.n) === gp && (!b || worse(q.r, b.q.r))) b = { q, z }; }));
      assert.equal(txt(c[4]), fx(b.q.r, 3), `${tag}: ${gp.name} ratio`); assert.equal(c[5].t, !b.q.pass ? 'FAIL' : !fin(b.q.r) ? 'REVIEW' : 'PASS');
      const m = /on G(\d+), span (\d+)$/.exec(c[2]); assert.ok(m, c[2]);
      const cz = I.find(z => `${z.c.label} on G${z.c.g}, span ${z.c.s}` === c[2]); assert.ok(cz, `${tag}: ${c[2]}`);
      assert.ok(cz.R.checks.some(q => q.n === c[1] && Object.is(q.r, b.q.r)), `${tag}: ${c[1]} is that line's check`);
      assert.match(c[6], gp.input ? /\[\[(rs\.own|tab:in:own)/ : /^see \[\[/, `${tag}: ${gp.name} link ${c[6]}`); nRows++; });
    // every recorded value of the new sections = the engine value of its girder
    Mo.vals.filter(v => ['exec', 'basis', 'bom'].includes(v.sec)).forEach(v => { const R = v.u != null ? B.units[v.u].R : v.cell ? B.all.cells.find(c => `${c.k}|${c.g}` === v.cell).R : B.R, x = at(R, v.path);
      assert.equal(typeof x, 'number', `${tag}: ${v.sec} ${v.path}`); assert.equal(v.text, fx(v.div ? x / v.div : x, v.d), `${tag}: ${v.sec} ${v.path}`); nVals++; });
    for (const id of ['exec', 'basis', 'bom']) assert.ok(Mo.vals.some(v => v.sec === id), `${tag}: ${id} values`);
  }
  assert.ok(nRows > 80 && nVals > 500 && nFail >= 1, `${nRows} rows, ${nVals} values, ${nFail} FAIL, ${nPass} PASS`);   // (a PASS verdict: the one-girder test below)
});

test('report package: one design girder (no girder types): the same rule over its own checks; a FAIL names its group and step', () => {
  const CS = TAB_CASES(() => M.defaultProject());
  for (const [name, P] of Object.entries(CS)) {
    const B = W.PSBReportData.compute(P, null); assert.equal(B.all, null, name);
    const Mo = RB.model(B, {}), doc = SR.build(Mo), ex = sec(Mo, 'exec'), fig = ex.subs[0].items.find(i => i.type === 'figure'), [tb] = tables(ex);
    const inG = B.R.checks.filter(c => grpOf(c.n)), nF = inG.filter(c => !c.pass).length, nR = inG.filter(c => c.pass && !fin(c.r)).length, want = nF ? 'FAIL' : nR ? 'REVIEW' : 'PASS';
    assert.ok(fig.svg.includes(`aria-label="${want}"`) && fig.svg.includes(`${nF} FAIL, ${nR} REVIEW, ${inG.length - nF - nR} PASS`), `${name}: ${want}`);
    assert.deepEqual(J(doc.unresolved), [], name);
    tb.rows.forEach(r => { const c = cellsOf(r), gp = DU.GROUPS.find(g => g.name === c[0]), mx = B.R.checks.filter(q => grpOf(q.n) === gp).reduce((b, q) => (!b || worse(q.r, b.r) ? q : b), null);
      assert.equal(txt(c[4]), fx(mx.r, 3), `${name}: ${gp.name}`); assert.equal(c[1], mx.n.replace(/<[^>]*>/g, '')); });
    assert.equal(tb.rows.filter(r => cellsOf(r)[5].t === 'FAIL').length, DU.GROUPS.filter(gp => B.R.checks.some(q => grpOf(q.n) === gp && !q.pass)).length, `${name}: FAIL rows`);
  }
  assert.ok(Object.values(CS).some(P => RB.model(W.PSBReportData.compute(P, null), {}).sections[0].subs[0].items[0].svg.includes('aria-label="PASS"')), 'a design with a PASS verdict');
  // the made-up design with handling and the deck on: the hold-down force fails (1.276 at x = 48.00 ft)
  const B = W.PSBReportData.compute(CS['handling and deck on, rating vehicles, φc φs floored'], null), Mo = RB.model(B, {}), ex = sec(Mo, 'exec'), T = JSON.stringify(ex);
  assert.ok(T.includes('aria-label=\\"FAIL\\"') && T.includes('Governing D/C: 1.276 (End zone & hold-down: Hold-down force (PS-10)') && T.includes('x = 48.00 ft') && T.includes('see [[ez.hd.r]]'));
  assert.ok(T.includes('Load rating: lowest HL-93 inventory rating factor') && T.includes('Hauling stresses'), 'not included in the verdict: the rating factor, the hauling stresses');
});

test('report package: bill of materials: V = A L_g / 144, W = w_sw L_g, strand N L_g A_b 490/144; totals = the sums; the weight = the Summary\'s; hand check', () => {
  for (const [name, P] of Object.entries(PS)) {
    const B = W.PSBReportData.compute(P, null), Mo = RB.model(B, {}), bm = sec(Mo, 'bom'), [g, s, , d] = tables(bm), I = indep(P);
    const Lg = z => z.R.L + 2 * (+z.inp.opt.endOh || 0) / 12;
    const V = I.reduce((a, z) => a + z.R.g.A * Lg(z) / 144, 0), Wt = I.reduce((a, z) => a + z.R.g.wsw * Lg(z), 0), sL = I.reduce((a, z) => a + z.R.ss.Ntot * Lg(z), 0), sW = I.reduce((a, z) => a + z.R.ss.Ntot * Lg(z) * z.R.ss.st.Ab * 490 / 144, 0);
    const tot = t => cellsOf(t.rows[t.rows.length - 1]).map(txt);
    assert.equal(tot(g)[9], fx(V / 27, 1), `${name}: concrete`); assert.equal(tot(g)[10], fx(Wt, 1), `${name}: weight`); assert.equal(tot(g)[10], fx(B.all.W, 1), `${name}: the Summary's bridge weight`);
    assert.equal(tot(s)[10], fx(sL, 0), `${name}: strand length`); assert.equal(tot(s)[11], fx(sW, 0), `${name}: strand weight`);
    assert.equal(g.rows.length - 1, new Set(I.map(z => z.c.k)).size, `${name}: a row per girder type`);
    // deck slab: deck width × t_s × L, the haunch per line
    const Wd = P.xs.bays.reduce((a, x) => a + +x, 0) + +P.xs.ohL + +P.xs.ohR;
    const vD = P.spans.lengths.reduce((a, L, j) => { const z = I.find(q => q.c.s === j + 1); return a + (z ? Wd * z.R.cp.tsLoad / 12 * +L : 0); }, 0), vH = I.reduce((a, z) => a + (+z.inp.th || 0) * z.R.cp.wdkHW / 144 * z.R.L, 0);
    assert.equal(tot(d)[4], fx(vD / 27, 1), `${name}: deck`); assert.equal(tot(d)[6], fx(vH / 27, 1), `${name}: haunch`);
    assert.ok(bm.subs.some(q => q.id === 'x' && /Not included in this bill of materials/.test(q.items[0].text)), name);
  }
  // hand check, the new project (made up): PCI BT-72, A = 767 in², L = 120 ft, 5 lines, 40 strands of 0.217 in²
  const P = PS['new project (Interior + Exterior)'], B = W.PSBReportData.compute(P, null), bm = sec(RB.model(B, {}), 'bom'), [g, s] = tables(bm), c0 = B.all.cells[0];
  assert.equal(c0.R.g.A, 767); assert.equal(c0.R.L, 120); assert.equal(c0.R.ss.st.Ab, 0.217);
  const r0 = cellsOf(g.rows[0]).map(txt); assert.equal(r0[5], '639.2');   // 767(120)/144 = 639.17 ft³
  assert.equal(r0[7], fx(c0.R.g.wsw * 120, 1));
  const s0 = cellsOf(s.rows[0]).map(txt), N = c0.R.ss.Ntot; assert.equal(s0[6], fx(N * 120, 0)); assert.equal(s0[7], '0.738');   // 0.217(490/144) = 0.7384 lb/ft
  assert.equal(s0[8], fx(N * 120 * 0.217 * 490 / 144, 0));
  // a line with no girder type: stated, not counted
  const T2 = JSON.stringify(sec(RB.model(W.PSBReportData.compute(PS['two spans, G5/S2 not checked'], null), {}), 'bom'));
  assert.ok(T2.includes('Girder lines with no girder type (G5/S2) are not checked and not in these quantities'));
  // the deck bars where the deck is designed
  const Pd = PS['tab: handling and deck on, rating vehicles, φc φs floored'], Bd = W.PSBReportData.compute(Pd, null), bd = sec(RB.model(Bd, {}), 'bom').subs.find(q => q.id === 'b'); assert.ok(bd, 'deck reinforcement');
  const cd = Bd.all.cells.find(c => c.R.deck), dk = cd.inp.deck, Wd = Pd.xs.bays.reduce((a, x) => a + +x, 0) + +Pd.xs.ohL + +Pd.xs.ohR, Lt = Pd.spans.lengths.reduce((a, x) => a + +x, 0), n = Math.ceil(12 * Lt / +dk.sTop) + 1;
  const top = cellsOf(bd.items.find(i => i.type === 'table').rows[0]).map(txt); assert.equal(top[2], fx(n, 0)); assert.equal(top[4], fx(n * Wd * +dk.barTop * 490 / 144, 0));
  assert.ok(!sec(RB.model(B, {}), 'bom').subs.some(q => q.id === 'b'), 'no deck design: no deck bars, listed as not included');
});

test('report package: basis of design: specification, factors, the owner\'s η and m, the loss method, the assumptions link; sign-off; design-point headers', () => {
  const Mof = n => { const P = PS[n], B = W.PSBReportData.compute(P, null), Mo = RB.model(B, {}); return { P, B, Mo, doc: SR.build(Mo), T: JSON.stringify(sec(Mo, 'basis')) }; };
  { const { B, Mo, doc, T } = Mof('new project (Interior + Exterior)');
    assert.deepEqual(J(sec(Mo, 'basis').subs.map(q => q.id)), ['spec', 'mat', 'phi', 'lc', 'll', 'an', 'loss', 'own', 'asm']);
    assert.ok(T.includes('AASHTO LRFD 10th Ed. (2024)') && T.includes('"Strength I","1.000","1.25","1.50","1.75"') && T.includes('"Service III","1.00","1.00","1.00"') && T.includes('33 % on the truck and the tandem'));
    const a = doc.index.get('rs.asm'), pj = Mo.sections.findIndex(s => s.id === 'proj'); assert.ok(a && a.n.startsWith(`${pj + 1}.`), 'the assumptions stay in the project section, linked');
    assert.ok(sec(Mo, 'proj').subs.find(q => q.key === 'rs.asm').items.length >= RB.ASSUME.length, 'the assumptions list kept');
    const u0 = B.multi ? B.units[0] : null, R = u0 ? u0.R : B.R; assert.ok(T.includes(fx(R.totalLoss, 2)) && T.includes(fx(R.cp.Ecg, 0)) && T.includes('refined estimate (Art. 5.9.3.4)')); }
  { const { B, T } = Mof('tab: box BIII-36, no topping, debonded row, diaphragm, RIDOT'), u0 = B.multi ? B.units[0] : null, OL = W.PBD.ownLoads(u0 ? u0.inp : B.inp);
    assert.equal(OL.owner, 'RIDOT'); assert.ok(T.includes(`× m = ${fx(OL.mLL, 2)}`) && T.includes('RIDOT Bridge Design Manual') && T.includes('see [[rs.own]]'), 'RIDOT: m on LL+IM, the manual, the rules link');
    assert.ok(T.includes(`= ${fx(OL.eta, 3)}`)); }
  { const { T } = Mof('tab: approximate losses, transformed release, severe corrosion, bonded release steel, entered fatigue DF'); assert.ok(T.includes('approximate estimate (Art. 5.9.3.3)') && T.includes('transformed section at release')); }
  // sign-off: the project fields; nothing written into the project
  { const P = load(M.newProject()); P.project.designer = 'A. Made-Up'; P.project.checker = 'B. Checker'; P.project.date = '2026-11-23'; const p0 = JSON.stringify(P);
    const B = W.PSBReportData.compute(P, null), r0 = JSON.stringify(B.R), i0 = JSON.stringify(B.inp), Mo = RB.model(B, {}), sg = sec(Mo, 'sign'), [a, b] = tables(sg);
    assert.deepEqual(J(a.rows), [['Designed by', 'A. Made-Up', '', '2026-11-23'], ['Checked by', 'B. Checker', '', ''], ['Approved by', '', '', '']]);
    assert.deepEqual(J(b.rows[0]), ['0', '2026-11-23', 'Issued', 'A. Made-Up', 'B. Checker']); assert.ok(sg.subs[0].items.some(i => i.type === 'figure' && /P\.E\. seal/.test(i.svg)));
    assert.equal(JSON.stringify(P), p0, 'the project unchanged (no sign-off field added)'); assert.equal(JSON.stringify(B.R), r0, 'R unchanged'); assert.equal(JSON.stringify(B.inp), i0, 'inputs unchanged'); }
  // design-point headers: each check of the section at its station, the debonded rows and hold-down points named
  { const CS = TAB_CASES(() => M.defaultProject()), P = CS['CTDOT, debonded rows, diaphragms, girder end 9 in past the bearing'], B = W.PSBReportData.compute(P, null), Mo = RB.model(B, {}), doc = SR.build(Mo);
    assert.deepEqual(J(doc.unresolved), []);
    for (const k of ['str', 'flex', 'shear', 'end', 'camb']) { const s = sec(Mo, k), i = s.subs.findIndex(q => q.id === 'pt'); assert.ok(i >= 0 && s.subs[i + 1].id === 'w', `${k}: the header before the worked steps`);
      const tb = s.subs[i].items.find(q => q.type === 'table'), gps = DU.GROUPS.filter(gp => gp.tab === k && !gp.input), cs = B.R.checks.filter(c => gps.some(gp => gp.checks.some(([n]) => n === c.n)));
      assert.equal(tb.rows.length, cs.length, k); tb.rows.forEach((r, j) => { assert.equal(r[0], cs[j].n); assert.equal(r[1].t, fx(cs[j].loc, 2)); assert.equal(r[2], `span ${B.sel.s}, x/L = ${fx(cs[j].loc / B.R.L, 3)}`); }); }
    for (const k of ['sec', 'lds', 'an', 'loss', 'hand', 'deck', 'rt']) assert.ok(!sec(Mo, k).subs.some(q => q.id === 'pt'), k);
    const T = JSON.stringify(sec(Mo, 'str').subs.find(q => q.id === 'pt'));
    assert.ok(T.includes('within the transfer length (0.75 ft from the girder end ≤ $l_{t}$ = 3.00 ft)') && T.includes('debonded here (to 8.00 ft from the girder end)') && T.includes('at or between the hold-down points (48.00 ft and 72.00 ft)'), 'transfer, debond and hold-down context');
    assert.ok(JSON.stringify(sec(Mo, 'shear').subs.find(q => q.id === 'pt')).includes('end-zone stirrup spacing'), 'stirrup zone on the shear section'); }
});

test('report package: a section left out leaves no broken link; the other sections are unchanged', () => {
  const P = PS['three types, own inputs, unequal bays'];
  for (const mode of ['gov', 'all']) {
    const full = RB.model(W.PSBReportData.compute(P, null, mode), {});
    RB.SECTIONS.forEach(([k]) => { const Mo = RB.model(W.PSBReportData.compute(P, null, mode), { include: { [k]: false } }), Mo0 = J(Mo), doc = SR.build(Mo);   // (build marks the model's items: compare the copy)
      // (open item from before this package, psbridge-summary.test.mjs: a worked step's own note "§<step id>" naming a step of the section left out)
      doc.unresolved.forEach(u => assert.ok(/Worked steps/.test(u.where), `${mode}: without ${k}: ${u.key} at ${u.where}`)); assert.ok(!Mo.sections.some(s => s.id === k || s.id.startsWith(k + '-u')), k); assert.ok(!Mo.vals.some(v => v.sec === k), `${k}: no value kept`);
      const nf = s => JSON.stringify(s).replace(/Figure \d+\.\d+/g, 'Figure n.m').replace(/"no":"\d+\.\d+"/g, '"no":"n.m"');   // the figure numbers follow the section numbers
      if (['exec', 'bom', 'sign'].includes(k)) Mo0.sections.forEach(s => assert.equal(nf(s), nf(full.sections.find(q => q.id === s.id)), `${mode} without ${k}: ${s.id} unchanged`)); });
  }
  const one = RB.model(W.PSBReportData.compute(P, null), { include: { exec: false, basis: false, bom: false, sign: false } });
  assert.ok(!one.sections.some(s => ['exec', 'basis', 'bom', 'sign'].includes(s.id))); assert.ok(!one.vals.some(v => ['exec', 'basis', 'bom'].includes(v.sec)));
});
