// apps/ps-bridge PR 3b: the Summary tab (ui/summary.js, window.PSBSummaryUI) and the Report's §1 tables of every girder type and line
//   (report/builders.js) show engine values only (docs/ps-bridge-plan.md §5 row 3b; CLAUDE.md §6). For the test projects (the 17 designs of
//   harness B, each migrated to one girder type on its line; a new project, Interior + Exterior; one type on every line; three types with
//   their own inputs and unequal bays; three spans made continuous; two spans with a line not checked):
//   1. every number of the Summary HTML (data-sv="<k>|<g>|<R path>") = the value at that path of an independent engine run of that girder
//      type on that line (PSBHoldDown.compute(PSBDesign.cellInputs(P, k, g))), formatted at its decimals; every weight (data-sw) = w_sw
//      (L + 2 e_end/12) of that run, the type's the sum over its lines, the bridge total the sum over every line;
//   2. the grid: each girder line × span cell = the largest ratio of that run's checks (PASS / FAIL as the engine's c.pass), a line with no
//      type "not checked"; each type × check-group cell = the largest ratio of the group's checks over the type's lines, the line named;
//      the verdict's counts = one per girder type per check (its worst line, SB-5), the same as the check summary column (ui/dash.js grp);
//   3. every link (data-sumgo) names a girder type and line of the project, a check group's tab and a worked step that the tab shows for
//      that type and line (the worked steps of that run, report/data.js worked) or, for an owner limit, the Owner rules row;
//   4. the Report's §1 (several cells): the grid and the group table carry the same ratios, each group row a "see §" reference.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['model', 'rigid', 'holddown', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary'].map(n => path.join(APP, `ui/${n}.js`)),
  ...['fromtab', 'data', 'builders'].map(n => path.join(APP, `report/${n}.js`)));
const M = W.PSBModel, D = W.PSBDesign, B = W.PSBBridge, SU = W.PSBSummaryUI, DU = W.PSBDashUI;
const J = v => JSON.parse(JSON.stringify(v));
const at = (R, p) => p.split('.').reduce((o, k) => o == null ? o : o[k], R);
const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : v === Infinity ? '∞' : v === -Infinity ? '−∞' : typeof v === 'number' ? 'NaN' : '—';
const load = P => M.importJSON(M.exportJSON(P)).project;
const unesc = s => s.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const WK = { str: 'stresses', flex: 'flexure', shear: 'shear', end: 'endzone', camb: 'camber', hand: 'handling', deck: 'deck', rt: 'rating' };

/* the test projects */
function projects() {
  const out = {};
  Object.entries(TAB_CASES(() => M.defaultProject())).forEach(([n, P0]) => { out['tab: ' + n] = load(P0); });
  const nw = () => load(M.newProject());
  out['new project (Interior + Exterior)'] = nw();
  { const P = nw(); P.types = [{ id: 'T1', label: 'All S1', span: 1, lines: [1, 2, 3, 4, 5], ovr: {} }]; out['one type on every line'] = P; }
  { const P = nw(); P.xs.bays = [8, 10, 10, 8]; P.types[1].ovr = { 'mat.fc': 9 };
    const k = B.addType(P, 0, { label: 'G3 own' }); P.types[k].ovr = { 'mat.fc': 7 }; B.assignLine(P, k, 3); out['three types, own inputs, unequal bays'] = P; }
  { const P = nw(); P.spans.lengths = [100, 120, 100]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0, 0]; B.syncSpans(P); out['three spans made continuous'] = P; }
  { const P = nw(); P.spans.lengths = [90, 90]; P.spans.continuity = 'composite'; P.xs.skews = [0, 0, 0]; B.syncSpans(P); const k = P.types.findIndex(t => t.span === 2 && /Exterior/.test(t.label)); P.types[k].lines = [1]; out['two spans, G5/S2 not checked'] = P; }
  Object.entries(out).forEach(([n, P]) => assert.deepEqual(J(W.PSBInputCheck.collect(P).errors), [], n + ': no input error'));
  return out;
}
/* an independent engine run of each cell */
function indep(P) {
  const m = new Map();
  B.cells(P).forEach(c => { const inp = D.cellInputs(P, c.k, c.g); m.set(`${c.k}|${c.g}`, { c, inp, R: W.PSBHoldDown.compute(J(inp)) }); });
  return m;
}
const grpOf = n => { for (const gp of DU.GROUPS) for (const [cn, st] of gp.checks) if (cn === n) return { gp, st }; return null; };
const bad = x => typeof x !== 'number' || isNaN(x);
const worse = (a, b) => (bad(a) && !bad(b)) || (!bad(a) && !bad(b) && a > b);
const PS = projects();

test('Summary: every number = the engine value of an independent run of its girder type and line; weights = w_sw (L + 2 e_end/12), summed per type and bridge', () => {
  let nv = 0, nw = 0;
  for (const [name, P] of Object.entries(PS)) {
    const A = B.results(P, inp => W.PSBHoldDown.compute(J(inp))), I = indep(P);
    const h = SU.html({ P, A, run: { ms: 1 }, shown: '' });
    for (const m of h.matchAll(/data-sv="([^"]*)">([^<]*)</g)) {
      const [k, g, p] = unesc(m[1]).split('|'), x = I.get(`${k}|${g}`); assert.ok(x, `${name}: cell ${k}|${g}`);
      const v = at(x.R, p), d = /\.loc$/.test(p) ? 2 : 3;
      assert.equal(typeof v, 'number', `${name}: ${m[1]}`);
      assert.equal(m[2], fx(v, d), `${name}: ${m[1]} shown ${m[2]}, engine ${v}`);
      assert.ok(Object.is(at(A.cells.find(c => c.k === +k && c.g === +g).R, p), v), `${name}: ${m[1]} page value = independent value exactly`);
      nv++;
    }
    const wOf = x => x.R.g.wsw * (x.inp.L + 2 * (+x.inp.opt.endOh || 0) / 12);
    for (const m of h.matchAll(/data-sw="([^"]*)">([^<]*)</g)) {
      const [k, g] = m[1].split('|');
      const xs = [...I.values()].filter(x => (k === '' || x.c.k === +k) && (g === '' || x.c.g === +g));
      assert.ok(xs.length, `${name}: weight ${m[1]}`);
      assert.equal(m[2], xs.reduce((a, x) => a + wOf(x), 0).toFixed(1), `${name}: weight ${m[1]}`);
      nw++;
    }
  }
  assert.ok(nv > 1500 && nw > 60, `${nv} values, ${nw} weights`);
});

test('Summary: the grid (girder line × span), the type × group table and the verdict counts = the engine checks of each run', () => {
  for (const [name, P] of Object.entries(PS)) {
    const A = B.results(P, inp => W.PSBHoldDown.compute(J(inp))), I = indep(P), Mo = SU.model(P, A);
    // grid
    for (let g = 1; g <= P.xs.nb; g++) for (let s = 1; s <= P.spans.lengths.length; s++) {
      const z = Mo.grid[g - 1][s - 1], x = [...I.values()].find(q => q.c.g === g && q.c.s === s);
      if (!x) { assert.equal(z, null, `${name}: G${g}/S${s} not checked`); continue; }
      const cs = x.R.checks.filter(q => grpOf(q.n)), top = cs.reduce((b, q) => !b || worse(q.r, b.r) ? q : b, null);
      assert.ok(Object.is(z.gov.q.r, top.r) && z.gov.q.n === top.n, `${name}: G${g}/S${s} governing ${z.gov.q.n} ${z.gov.q.r} vs ${top.n} ${top.r}`);
      assert.equal(z.nF, cs.filter(q => !q.pass).length, `${name}: G${g}/S${s} FAIL count`);
      assert.equal(cs.length, x.R.checks.length, `${name}: G${g}/S${s} every engine check is in a group`);
    }
    // type × group, verdict counts
    let nF = 0, nP = 0;
    Mo.types.forEach(T => {
      const xs = [...I.values()].filter(x => x.c.k === T.k), names = [...new Set(xs.flatMap(x => x.R.checks.map(q => q.n)))];
      names.forEach(n => { const w = xs.map(x => ({ q: x.R.checks.find(q => q.n === n), g: x.c.g })).filter(z => z.q).reduce((b, z) => !b || worse(z.q.r, b.q.r) ? z : b, null);
        if (w.q.pass) nP++; else nF++; });
      Mo.used.forEach(gp => {
        const all = xs.flatMap(x => x.R.checks.filter(q => gp.checks.some(([cn]) => cn === q.n)).map(q => ({ q, g: x.c.g })));
        const z = T.groups[gp.id];
        if (!all.length) { assert.equal(z, undefined, `${name}: ${T.label} ${gp.name} none`); return; }
        const top = all.reduce((b, y) => !b || worse(y.q.r, b.q.r) ? y : b, null);
        assert.ok(Object.is(z.q.r, top.q.r), `${name}: ${T.label} ${gp.name} ${z.q.r} vs ${top.q.r}`);
        assert.ok(xs.find(x => x.c.g === z.g).R.checks.some(q => q.n === z.q.n && Object.is(q.r, z.q.r)), `${name}: ${T.label} ${gp.name}: the line named G${z.g} has that ratio`);
      });
      const rfs = xs.flatMap(x => DU.RATING.rf.map(([n, f]) => f(x.R))).filter(v => typeof v === 'number' && v < 99);
      if (rfs.length) assert.equal(T.rf.v, Math.min(...rfs), `${name}: ${T.label} lowest RF`);
    });
    assert.equal(Mo.nF, nF, `${name}: FAIL count`); assert.equal(Mo.nP, nP, `${name}: PASS count`);
    // the check summary column's counts (ui/dash.js grp over every type and line)
    const G = DU.GROUPS.map(gp => DU.grp(null, gp, A)).filter(q => q.st === 'pass' || q.st === 'fail');
    assert.equal(G.reduce((a, q) => a + q.all.filter(z => !z.c.pass).length, 0), nF, `${name}: = the check summary column's FAIL count`);
    // the HTML: a line with no type shown "not checked"
    const h = SU.html({ P, A, run: {}, shown: '' }), un = B.unassigned(P);
    assert.equal((h.match(/not checked<\/td>/g) || []).length, un.length, `${name}: lines not checked`);
    if (un.length) assert.match(h, /id="sum-unassigned"/);
    assert.ok(h.includes('id="sum-grid"') && h.includes('id="sum-table"') && h.includes('id="sum-checks"'), name + ': cards');
  }
});

test('Summary: every link opens a type and line of the project, its tab and a worked step that tab shows for it (or the Owner rules row)', () => {
  let n = 0;
  const OWNROW = new Set(DU.GROUPS.filter(gp => gp.input).flatMap(gp => gp.checks.map(([, st]) => st)));
  for (const [name, P] of Object.entries(PS)) {
    const A = B.results(P, inp => W.PSBHoldDown.compute(J(inp))), I = indep(P), h = SU.html({ P, A, run: {}, shown: '' }), wk = new Map();
    for (const m of h.matchAll(/data-sumgo="([^"]*)"/g)) {
      const [k, g, tab, st, inp] = unesc(m[1]).split('|'), x = I.get(`${k}|${g}`);
      assert.ok(x && P.types[+k] && P.types[+k].lines.includes(+g), `${name}: link ${m[1]} type and line`);
      if (inp === '1') { assert.equal(tab, 'own'); assert.ok(OWNROW.has(st), `${name}: owner row ${st}`); n++; continue; }
      assert.ok(WK[tab], `${name}: tab ${tab}`);
      if (!wk.has(x)) wk.set(x, W.PSBReportData.worked(x.inp, x.R));
      const ids = new Set((wk.get(x)[WK[tab]].steps || []).map(s => s.id));
      assert.ok(ids.has(st), `${name}: ${m[1]}: step ${st} on the ${tab} tab of that type and line`);
      n++;
    }
  }
  assert.ok(n > 500, `${n} links`);
});

test('Report §1 (several cells): the girder × span grid and the group table = the Summary values, each group with a "see §" reference', () => {
  let n = 0;
  for (const [name, P] of Object.entries(PS)) {
    if (B.cells(P).length < 2) continue;
    const Bd = W.PSBReportData.compute(P, null), Mo = SU.model(P, Bd.all), md = W.PSBReportBuild.model(Bd, {});
    const s1 = md.sections.find(s => s.id === 'sum'), all = s1.subs.find(q => q.id === 'all'); assert.ok(all, name);
    const [grid, grp] = all.items.filter(i => i.type === 'table');
    grid.rows.forEach((r, i) => r.slice(1).forEach((c, j) => { const z = Mo.grid[i][j], t = typeof c === 'string' ? c : c.t;
      if (!z) assert.match(t, /not checked/); else { assert.ok(t.includes(z.gov.q.r.toFixed(3)) && t.includes(z.nF ? 'FAIL' : 'PASS') && /see \[\[rs\.\w+\]\]|see \[\[rs\.own\]\]|—/.test(t), `${name}: grid G${i + 1}/S${j + 1}: ${t}`); n++; } }));
    grp.rows.forEach(r => { const c = r.cells || r, T = Mo.types.find(q => q.label === c[0]), gp = Mo.used.find(q => q.name === c[2]);
      if (!gp) { assert.equal(c[5].t, T.rf.v.toFixed(3)); return; }
      const z = T.groups[gp.id]; assert.equal(c[5].t, z.q.r.toFixed(3), `${name}: ${c[0]} ${c[2]}`); assert.equal(c[4], `G${z.g}`);
      assert.match(c[7], gp.input ? /see \[\[rs\.own\]\]|—/ : new RegExp(`see \\[\\[rs\\.${gp.tab}\\]\\]`)); n++; });
  }
  assert.ok(n > 100, `${n} Report cells`);
});
