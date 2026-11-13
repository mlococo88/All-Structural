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
//   PS-25 (engineer decision 2026-11-13): 5. the Report works each girder type on its governing line (the line with its largest ratio), or
//      every girder line: §1, §2, then §3–§14 per unit with the type and line in each heading; every number of a unit's sections is that
//      unit's engine value; every [[reference]] resolves; §1's "see §" point to the unit of that type (that line); a project with one
//      girder worked that is the girder shown builds the report of one girder as before (no unit headings).
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', 'report.js', ...PBDF,
  ...['model', 'rigid', 'holddown', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'legacy', 'worked', 'worked-stress', 'worked-strength', 'worked-end', 'worked-hdr'].map(n => path.join(APP, `engine/${n}.js`)),
  ...['inputs', 'vizkit', 'vizalong', 'outkit', 'section', 'loads', 'analysis', 'strands', 'losses', 'stresses', 'flexure', 'shear', 'endzone', 'camber', 'handling', 'deck', 'rating', 'dash', 'summary', 'bridgedl'].map(n => path.join(APP, `ui/${n}.js`)),   // bridgedl: the Loads & LLDF tab of a girder type (its DC2 / DW line table), as on the page
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
      if (!z) assert.match(t, /not checked/); else { assert.ok(t.includes(z.gov.q.r.toFixed(3)) && t.includes(z.nF ? 'FAIL' : 'PASS') && /see \[\[rs\.\w+(@u\d+)?\]\]|see \[\[rs\.own\]\]|—/.test(t), `${name}: grid G${i + 1}/S${j + 1}: ${t}`); n++; } }));
    grp.rows.forEach(r => { const c = r.cells || r, T = Mo.types.find(q => q.label === c[0]), gp = Mo.used.find(q => q.name === c[2]);
      if (!gp) { assert.equal(c[5].t, T.rf.v.toFixed(3)); return; }
      const z = T.groups[gp.id]; assert.equal(c[5].t, z.q.r.toFixed(3), `${name}: ${c[0]} ${c[2]}`); assert.equal(c[4], `G${z.g}`);
      assert.match(c[7], gp.input ? /see \[\[rs\.own\]\]|—/ : new RegExp(`see \\[\\[rs\\.${gp.tab}(@u\\d+)?\\]\\]`)); n++; });
  }
  assert.ok(n > 100, `${n} Report cells`);
});

/* PS-25: the worked units of a report and their references */
const keysOf = M => { const ks = new Set(); M.sections.forEach(s => { ks.add(s.key); s.subs.forEach(q => { if (q.key) ks.add(q.key); q.items.forEach(it => { if (it.type === 'steps') it.steps.forEach(t => ks.add(it.scope ? it.scope + '/' + t.id : String(t.id))); }); }); }); return ks; };
const refsOf = M => { const out = []; const walk = o => { if (typeof o === 'string') o.replace(/\[\[([^\]|]+)\]\]/g, (m, k) => { if (!/^tab:/.test(k)) out.push(k); return m; }); else if (o && typeof o === 'object') Object.values(o).forEach(walk); }; walk(M.sections); return out; };
const OKF = W.PSBOutKit.fx;
test('Report, PS-25: each girder type on its governing line (default) or every girder line — units, headings, numbering, values and references', () => {
  let nm = 0, nv = 0;
  for (const [name, P] of Object.entries(PS)) {
    for (const mode of ['gov', 'all']) {
      const B = W.PSBReportData.compute(P, null, mode), A = B.all, SM = SU.model(P, A);
      // the units: gov: per type the line with the largest governing ratio (ties: the first); all: every type × line
      const want = mode === 'all' ? SM.types.flatMap(T => T.lines.filter(z => !z.err).map(z => `${T.k}|${z.c.g}`))
        : SM.types.map(T => { let b = null; T.lines.filter(z => !z.err).forEach(z => { const r = z.c.R.checks.map(q => q.r).sort((x, y) => y - x);   // the largest ratio; a tie: the next largest
          const gt = () => { for (let i = 0; i < r.length; i++) if (r[i] !== b.r[i]) return r[i] > b.r[i]; return false; }; if (!b || gt()) b = { r, g: z.c.g }; }); return `${T.k}|${b.g}`; });
      assert.deepEqual(B.units.map(u => `${u.k}|${u.g}`), want, `${name} ${mode}: units`);
      const one = B.units.length === 1 && B.cell && B.units[0].k === B.cell.k && B.units[0].g === B.cell.g;
      assert.equal(B.multi, !one, `${name} ${mode}: several units`);
      const M = W.PSBReportBuild.model(B, {}), ks = keysOf(M);
      const bad = refsOf(M).filter(k => !ks.has(k));   // PS-26: ui/bridgedl.js loaded, so the Loads & LLDF sections (and §1's [[ld.dfm]]) are built here too
      assert.deepEqual([...new Set(bad)], [], `${name} ${mode}: every reference resolves`);
      if (!B.multi) { assert.equal(M.sections.length, 14, name); assert.ok(M.sections.every(s => !/ on G\d+, span \d+$/.test(s.title)), `${name}: one girder, no unit headings`);
        // and the model equals the one-girder model (the PS-25 code not used)
        assert.equal(JSON.stringify(M), JSON.stringify(W.PSBReportBuild.model(Object.assign({}, B, { units: null, multi: false }), {})), `${name}: one-girder report unchanged`); continue; }
      nm++;
      assert.equal(M.sections.length, 2 + 12 * B.units.length, `${name} ${mode}: sections`);
      B.units.forEach((u, i) => { const ss = M.sections.slice(2 + 12 * i, 14 + 12 * i);   // numbered per unit: §(3 + 12 i) – §(14 + 12 i)
        ss.forEach(s => { assert.ok(s.title.endsWith(`: ${u.label} on G${u.g}, span ${u.s}`), `${name}: heading ${s.title}`); assert.match(s.key, new RegExp(`@u${i}$`)); }); });
      // every number recorded: the value of its unit's engine result (sections §3+ and §1's unit tables)
      M.vals.forEach(v => { const R = v.u != null ? B.units[v.u].R : v.cell ? A.cells.find(c => `${c.k}|${c.g}` === v.cell).R : B.R, x = v.path.split('.').reduce((o, k) => o == null ? o : o[k], R);
        assert.equal(v.text, OKF(v.div ? x / v.div : x, v.d), `${name} ${mode}: ${v.sec} u${v.u} ${v.path}`); nv++; });
      assert.ok(M.vals.filter(v => v.u === B.units.length - 1).length > 300, `${name} ${mode}: the last unit's values`);
      // §1's "see §": the unit that works that type (gov) or that type × line (all)
      const all = M.sections[0].subs.find(q => q.id === 'all');
      if (all) { const [grid] = all.items.filter(i => i.type === 'table');
        grid.rows.forEach((r, i) => r.slice(1).forEach((c, j) => { const z = SM.grid[i][j]; if (!z || z.err || !z.gov || z.gov.gp.input) return;
          const ui = B.units.findIndex(u => u.k === z.c.k && (mode !== 'all' || u.g === z.c.g)); assert.ok(c.t.includes(`[[rs.${z.gov.gp.tab}@u${ui}]]`), `${name} ${mode}: grid G${i + 1}/S${j + 1} ${c.t}`); })); }
    }
  }
  assert.ok(nm >= 8 && nv > 20000, `${nm} multi-unit reports, ${nv} values`);
});
test('Report, PS-25: a section left out is left out for every unit; its references say "(section not included)"', () => {
  const P = PS['three spans made continuous'], B = W.PSBReportData.compute(P, null, 'gov'), M = W.PSBReportBuild.model(B, { include: { flex: false } });
  assert.equal(M.sections.length, 2 + 11 * B.units.length);
  assert.ok(!M.sections.some(s => /^Flexure/.test(s.title)));
  assert.deepEqual(refsOf(M).filter(k => /^(u\d+\/fx\.|rs\.flex)/.test(k)), []);
  assert.ok(JSON.stringify(M.sections).includes('(section not included)'));
});

/* PS-26 (engineer decision 2026-11-13) and the Report's links. The test projects above, each also under RIDOT, CTDOT and MassDOT, plus the
   three-type project under CTDOT with one type's f′ci above the CTDOT range (a FAIL in one type's column only). */
const OWNERS = ['RIDOT', 'CTDOT', 'MassDOT'];
function ownProjects() {
  const out = {};
  Object.entries(PS).forEach(([n, P]) => { out[n] = P; OWNERS.forEach(o => { const Q = J(P); Q.base.owner = o; if (!W.PSBInputCheck.collect(Q).errors.length) out[`${n} [${o}]`] = Q; }); });
  { const Q = J(PS['three types, own inputs, unequal bays']); Q.base.owner = 'CTDOT'; Q.types[2].ovr['mat.fci'] = 6.8; out['three types, G3 own f′ci 6.8 ksi [CTDOT]'] = Q; }
  return out;
}
const ownTable = M => { const s = M.sections.find(x => x.id === 'proj'); if (!s) return null; const q = s.subs.find(x => x.key === 'rs.own'); return q ? { q, tb: q.items.find(i => i.type === 'table' && /^Applied here/.test(i.head[3] || '')) } : null; };
const cellsOf = r => (Array.isArray(r) ? r : r.cells);
test('Report, PS-26: §2 Owner rules — one "Applied here" column per girder type where the types differ, each its type\'s values on its governing line; one column (the same §2) otherwise', () => {
  const OP = ownProjects(), IN = W.PSBInputsUI, FT = W.PSBReportTab, matG = DU.GROUPS.find(g => g.id === 'mat');
  let nCols = 0, nOne = 0, nFail = 0;
  for (const [name, P] of Object.entries(OP)) for (const mode of ['gov', 'all']) {
    const Bn = W.PSBReportData.compute(P, null, mode); assert.equal(Bn.err, '', name);
    const M = W.PSBReportBuild.model(Bn, {}), T = ownTable(M); if (!T || !T.tb) continue;
    const types = Bn.multi ? SU.model(P, Bn.all).types.filter(t => t.lines.some(z => !z.err)) : [];
    // each type's own column, as its Owner rules tab shows it for each of its lines
    const colOf = (t, z) => { const PV = Object.assign({}, P, { design: { g: z.c.g, s: z.c.s } }), q = FT.cards(IN.cards('own', PV, z.c.R), { tab: 'proj', X: { vals: [] }, sec: 'proj', inReport: () => true }).subs.find(s => s.items.some(i => i.type === 'table'));
      return JSON.stringify(q.items.find(i => i.type === 'table').rows.map(r => cellsOf(r)[3])); };
    const perType = types.map(t => new Set(t.lines.filter(z => !z.err).map(z => colOf(t, z))));
    perType.forEach((s, i) => assert.equal(s.size, 1, `${name}: ${types[i].label}: the owner rules are the same on every line of the type`));
    const differ = types.length > 1 && new Set(perType.map(s => [...s][0])).size > 1;
    if (!differ) {   // one column: the same §2 as with no PS-26 (PSBSummaryUI hidden from §2's owner table only)
      assert.equal(T.tb.head.length, 4, `${name} ${mode}: one column`); nOne++;
      const su = W.PSBSummaryUI; let M0; W.PSBSummaryUI = undefined;   // report/builders.js ownTypes: no PSBSummaryUI, no per-type columns (§1's tables need it, §2 does not)
      try { M0 = W.PSBReportBuild.model(Bn, {}); } finally { W.PSBSummaryUI = su; }
      assert.ok(!M0.sections[0].subs.some(q => q.id === 'all') || !Bn.multi, 'PSBSummaryUI hidden');
      assert.equal(JSON.stringify(M.sections.find(s => s.id === 'proj')), JSON.stringify(M0.sections.find(s => s.id === 'proj')), `${name} ${mode}: §2 unchanged`);
      assert.ok(!M.vals.some(v => v.cell), name);
      continue;
    }
    nCols++;
    assert.equal(T.tb.head.length, 3 + types.length, `${name} ${mode}: one column per girder type`); assert.ok(T.tb.wide);
    assert.ok(T.q.items.some(i => i.type === 'note' && /One "Applied here" column per girder type/.test(i.text)), name);
    types.forEach((t, j) => {
      const h = T.tb.head[3 + j], m = /^Applied here: (.+) on G(\d+), span (\d+) \(see \[\[rs\.sec@u(\d+)\]\]–\[\[rs\.rt@u\4\]\]\)$/.exec(h);
      assert.ok(m && m[1] === t.label, `${name} ${mode}: heading ${h}`);
      const z = t.lines.find(q => q.c.g === +m[2] && q.c.s === +m[3]); assert.ok(z, `${name}: G${m[2]} is a line of ${t.label}`);
      const u = Bn.units[+m[4]]; assert.ok(u && u.k === t.k && (mode !== 'all' || u.g === +m[2]), `${name} ${mode}: ${t.label} points to its own sections (u${m[4]})`);
      assert.equal(JSON.stringify(T.tb.rows.map(r => cellsOf(r)[3 + j])), colOf(t, z), `${name} ${mode}: ${t.label}: the cells of its Owner rules tab`);
      // the governing line: no line of the type has a larger owner-limit ratio
      const top = q => Math.max(-Infinity, ...q.c.R.checks.filter(c => matG.checks.some(([n]) => n === c.n)).map(c => c.r));
      t.lines.filter(q => !q.err).forEach(q => assert.ok(top(q) <= top(z), `${name}: ${t.label} G${q.c.g} ${top(q)} > G${z.c.g} ${top(z)}`));
    });
    // the statuses of the columns = the check summary column's Owner limits entries (one per girder type per check, its worst line)
    const G = DU.grp(null, matG, Bn.all), st = { PASS: 0, FAIL: 0 };
    T.tb.rows.forEach(r => cellsOf(r).slice(3).forEach(c => { const x = /ratio = .* = ([\d.]+) (PASS|FAIL)/.exec(c.t); if (x) st[x[2]]++; }));
    if (G.all) { assert.equal(st.FAIL, G.all.filter(z => !z.c.pass).length, `${name} ${mode}: FAIL count`); assert.equal(st.PASS, G.all.filter(z => z.c.pass).length, `${name} ${mode}: PASS count`); nFail += st.FAIL; }
    // every value of §2 is its type's engine value (u: its unit; cell: a line not worked in full)
    M.vals.filter(v => v.sec === 'proj').forEach(v => { const R = v.u != null ? Bn.units[v.u].R : Bn.all.cells.find(c => `${c.k}|${c.g}` === v.cell).R;
      assert.equal(v.text, OKF(v.div ? at(R, v.path) / v.div : at(R, v.path), v.d), `${name} ${mode}: ${v.path}`); });
  }
  assert.ok(nCols >= 6 && nOne >= 40 && nFail >= 2, `${nCols} per-type tables, ${nOne} one-column tables, ${nFail} FAIL cells`);
});

test('Report links: no [[…]] or "§step" reference of any test project points to a missing step or section; §1 Key quantities DF_M / DF_V → the Moment distribution factor step of its unit', () => {
  const OP = ownProjects(); let n = 0, nd = 0;
  for (const [name, P] of Object.entries(OP)) for (const mode of ['gov', 'all']) {
    const Bn = W.PSBReportData.compute(P, null, mode), M = W.PSBReportBuild.model(Bn, {}), doc = W.SharedReport.build(M), ks = keysOf(M);
    assert.deepEqual(J(doc.unresolved), [], `${name} ${mode}: unresolved`); assert.deepEqual(J(doc.dup), [], `${name} ${mode}: duplicate anchors`);
    assert.deepEqual([...new Set(refsOf(M).filter(k => !ks.has(k)))], [], `${name} ${mode}: references to a missing key`);
    assert.ok(!W.SharedReport.text(doc).includes('§?'), `${name} ${mode}: §?`);
    M.sections[0].subs.filter(q => /^kq/.test(q.id)).forEach(q => { const r = q.items[0].rows.find(x => /^DF/.test(x[0])), k = /\[\[([^\]]+)\]\]/.exec(r[1])[1];
      const i = /^u(\d+)\//.exec(k), sec = M.sections.find(s => s.key === (i ? `rs.lds@u${i[1]}` : 'rs.lds'));
      const stp = [].concat(...sec.subs.map(s => s.items.filter(it => it.type === 'steps').map(it => it.steps))).flat().find(s => s.id === 'ld.dfm');
      assert.ok(k === (i ? `u${i[1]}/ld.dfm` : 'ld.dfm') && stp && stp.label === 'Moment distribution factor', `${name} ${mode}: ${q.title} → ${k}`); nd++; });
    n++;
  }
  // each section left out in turn (a three-type project, every line): the [[…]] references into it say "(section not included)", none dangles.
  // Open item (pre-existing, not changed here): a worked step's own note "§<step id>" (engine text, e.g. a Loads step's "§sec.g.wsw") that
  // names a step of the section left out has no target (shared/report.js shows §?); listed here so that it is the only kind
  const P = OP['three types, G3 own f′ci 6.8 ksi [CTDOT]'];
  W.PSBReportBuild.SECTIONS.forEach(([k]) => { const Bn = W.PSBReportData.compute(P, null, 'all'), M = W.PSBReportBuild.model(Bn, { include: { [k]: false } }), doc = W.SharedReport.build(M), ks = keysOf(M);
    assert.deepEqual([...new Set(refsOf(M).filter(x => !ks.has(x)))], [], `without ${k}: [[…]] references to a missing key`);
    const M1 = W.PSBReportBuild.model(Bn, {}), gone = new Set([...keysOf(M1)].filter(x => !ks.has(x)));
    doc.unresolved.forEach(u => assert.ok(gone.has(u.key) && /Worked steps/.test(u.where), `without ${k}: ${u.key} at ${u.where}`)); n++; });
  assert.ok(n > 150 && nd > 300, `${n} reports, ${nd} DF links`);
});
