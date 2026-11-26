// apps/ps-bridge 2026-11-14 (PS Bridge catch-up item A): Auto design (engine/autodesign.js, PSBAutoDesign). Inputs only: every candidate is
// judged by the page's own engine call (PSBDesign.one = cellInputs with the candidate's inputs → PSBHoldDown.compute) and input check.
//   1. the engine inputs of a candidate equal cellInputs when the candidate is the type's own inputs (the same call, no second path);
//   2. on every harness B design (tests/engine/psbridge-tab-cases.mjs): the run ends, in reasonable time; every listed candidate, applied to a
//      copy of the project, passes every engine check of its girder types on every line (PSBBridge.results over PSBHoldDown.compute) and the
//      input check has no error; apply() writes only the types' overrides; a span with no candidate names its blocked checks;
//   3. deterministic: two runs give the same result;
//   4. exhaustive small cases: (a) an I-girder with the section and the concrete locked and two hold-down positions: no passing candidate of
//      the search space has fewer strands, or as many with fewer draped strands, or the same n_h with a flatter drape; (b) adjacent box beams
//      with the section and concrete searched: the section chosen is the lightest with any passing candidate; at it no passing pattern has
//      fewer strands at the strengths the search used; no lower f′c (with its highest f′ci) and no lower f′ci passes.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';
import { TAB_CASES } from './psbridge-tab-cases.mjs';

const APP = path.join(ROOT, 'apps/ps-bridge');
const PBDF = ['model', 'library', 'section', 'strands', 'losses-ll', 'handling-deck', 'lldf-flexure', 'external', 'compute', 'optimize', 'merge'].map(n => path.join(APP, `engine/pbd-${n}.js`));
const W = loadShared('steps.js', ...PBDF, ...['sections', 'model', 'rigid', 'lldf-fg', 'reltension', 'holddown', 'pierblock', 'design', 'bridge', 'bridge-dl', 'fields', 'inputcheck', 'autodesign'].map(n => path.join(APP, `engine/${n}.js`)),
  path.join(APP, 'ui/vizkit.js'), path.join(APP, 'ui/strands.js'));
const M = W.PSBModel, B = W.PSBBridge, AD = W.PSBAutoDesign, J = v => JSON.parse(JSON.stringify(v));
const load = P => M.importJSON(M.exportJSON(P)).project;
const CASES = Object.entries(TAB_CASES(() => M.defaultProject()));
const strip = R => J(R.spans.map(sp => ({ s: sp.s, why: sp.why, blocked: sp.blocked, sections: sp.sections.map(e => ({ name: e.name, pass: e.pass, types: e.types.map(q => ({ k: q.k, why: q.res.why, trials: q.res.trials,
  best: q.res.best ? { girder: q.res.best.girder, N: q.res.best.N, nh: q.res.best.nh, rows: q.res.best.rows, harp: q.res.best.harp, fc: q.res.best.fc, fci: q.res.best.fci } : null })) })) })));

test('Auto design: a candidate is judged by the page\'s own engine inputs (lineInputs = cellInputs for the type\'s inputs)', () => {
  const P = load(M.newProject());
  B.types(P).forEach((T, k) => B.typeLines(P, k).forEach(g => assert.equal(JSON.stringify(AD.lineInputs(P, k, g, B.effBase(P, k))), JSON.stringify(W.PSBDesign.cellInputs(P, k, g)), `type ${k} line ${g}`)));
});

const RUNS = {};
let total = 0;
test('Auto design on the harness B designs: every candidate passes every check on every line; apply writes the types\' overrides only; time', () => {
  for (const [name, P0] of CASES) {
    const P = load(P0), t = Date.now(), R = AD.runSync(P), ms = Date.now() - t; total += ms; RUNS[name] = { P, R };
    assert.ok(!R.stopped, `${name}: not stopped`);
    assert.ok(ms < 60000, `${name}: ${ms} ms`);
    R.spans.forEach(sp => {
      if (!sp.cands.length) { assert.ok(Array.isArray(sp.blocked), `${name}: blocked list`); return; }
      sp.cands.forEach((c, i) => {
        const Q = J(P), A0 = AD.apply(Q, R, { [sp.s]: i });
        assert.equal(A0.changed.length, sp.types.length, `${name}: every type of span ${sp.s} written`);
        assert.equal(JSON.stringify(Q.base), JSON.stringify(P.base), `${name}: the base design is not changed`);
        assert.deepEqual(J(Q.xs), J(P.xs), `${name}: the cross-section is not changed`);
        const ic = W.PSBInputCheck.collect(Q).errors; assert.deepEqual(J(ic), [], `${name}: no input error after Apply (${c.name})`);
        const A = B.results(Q, inp => W.PSBHoldDown.compute(J(inp)));
        A.cells.filter(z => z.s === sp.s).forEach(z => { assert.ok(!z.R.error, `${name}: ${z.label} G${z.g}: ${z.R.error}`);
          z.R.checks.forEach(q => assert.ok(q.pass, `${name}: ${c.name} ${z.label} G${z.g}: ${q.n} ${q.r}`)); });
        c.types.forEach(({ k, res }) => { const e = B.effBase(Q, k); assert.equal(e.girder, res.best.girder); assert.equal(e.mat.fc, res.best.fc); assert.equal(e.mat.fci, res.best.fci);
          assert.deepEqual(J(e.rows), J(res.best.rows)); assert.equal(+e.harp.n, res.best.nh); assert.equal(AD.countOf(e), res.best.N, `${name}: N`); });
      });
    });
  }
  console.log(`       (auto design: ${CASES.length} designs, ${(total / 1000).toFixed(1)} s in all; candidates: ${Object.values(RUNS).filter(q => q.R.spans.some(sp => sp.cands.length)).length})`);
  assert.ok(Object.values(RUNS).filter(q => q.R.spans.some(sp => sp.cands.length)).length >= 8, 'most designs have a candidate');
});

test('Auto design: deterministic (two runs, the same result)', () => {
  ['default (BT-72, interior, simple)', 'box BIII-36 (39in), CTDOT plate rows 16 + 16 strands and 4 top strands, 6 in topping, 80 ft, 10 boxes: passes'].forEach(n => {
    const P0 = CASES.find(c => c[0] === n)[1], a = AD.runSync(load(P0)), b = AD.runSync(load(P0));
    assert.equal(JSON.stringify(strip(a)), JSON.stringify(strip(b)), n);
    if (RUNS[n]) assert.equal(JSON.stringify(strip(RUNS[n].R)), JSON.stringify(strip(a)), `${n}: = the run above`);
  });
});

/* the search space of one type on one section, as the search builds it (rows, top strands, drapes, strengths) */
function space(P, k, girder, o, ctx) {
  const b0 = B.effBase(P, k), base = Object.assign(J(b0), { girder }), h = W.PSBInputCheck.depthOf(base), h0 = W.PSBInputCheck.depthOf(b0);
  const ent = b0.rows.filter(r => r && typeof r === 'object'), up = r => +r.y > h0 / 2;
  const tops = ent.filter(up).map(r => Object.assign(J(r), { y: Math.round((h - (h0 - +r.y)) * 1e6) / 1e6 }));
  const deb = ent.filter(r => !up(r)).sort((a, c) => a.y - c.y).map(r => ({ nd: +r.nd || 0, dbnd: +r.dbnd || 0 }));
  const rows = AD.rowsOf(P, k, base, ctx), capS = rows.reduce((a, q) => a + q.cap, 0);
  const mk = (rw, harp, fc, fci) => { const e = J(base); e.rows = J(rw).concat(J(tops)); e.harp = Object.assign({}, b0.harp, harp); e.mat = Object.assign({}, e.mat, { fc, fci }); return e; };
  return { b0, base, h, rows, capS: capS - (capS % 2), mk, deb, nTop: tops.reduce((a, r) => a + r.n, 0) };
}

test('Auto design, exhaustive (a): I-girder, section and concrete locked, frac 0.40 / 0.45, n_h ≤ 6: no passing candidate has fewer strands, fewer draped or a flatter drape', () => {
  const P = load(CASES.find(c => c[0].startsWith('AASHTO Type IV exterior'))[1]);
  P.autodesign = { vars: { section: 'lock', conc: 'lock' } };
  const o = Object.assign(AD.settings(P), { fracs: [0.40, 0.45] }), k = B.cells(P)[0].k;
  const R = AD.runSync(P, o), best = R.spans[0].sections[0].types[0].res.best; assert.ok(best, 'the search finds a design');
  const ctx = { cache: new Map(), fit: new Map(), rows: new Map(), runs: 0, first: {}, stopped: false };
  const S = space(P, k, best.girder, o, ctx), fc = +S.b0.mat.fc, fci = +S.b0.mat.fci, pass = [];
  for (let Ns = 2; Ns <= S.capS; Ns += 2) { const rw = AD.fill(S.rows, Ns, S.deb); if (!rw) continue;
    for (const nh of [0, 2, 4, 6]) { const list = nh ? AD.drapes(rw, nh, S.h, o.fracs).list : [{ n: 0 }];
      for (const hp of list) { const harp = hp.n ? { n: nh, yEnd: hp.yEnd, yMid: hp.yMid, frac: hp.frac } : { n: 0 };
        const e = S.mk(rw, harp, fc, fci); let thru = true;
        if (nh) for (let z = hp.yMid; z <= hp.yEnd + 1e-9; z += 1) if (AD.fitErrors(P, k, Object.assign({}, S.base, { rows: [], harp: { n: nh, yEnd: z, yMid: z, frac: 0.4 } }), ctx).length) { thru = false; break; }
        if (!thru) continue;
        const r = AD.evalCand(P, k, e, ctx, false); if (r.pass) pass.push({ N: Ns + nh + S.nTop, nh, sl: nh ? (hp.yEnd - hp.yMid) / hp.frac : 0 }); } } }
  assert.ok(pass.length, 'the exhaustive space has passing candidates');
  const m = pass.reduce((a, q) => !a || q.N < a.N || (q.N === a.N && (q.nh < a.nh || (q.nh === a.nh && q.sl < a.sl - 1e-12))) ? q : a, null);
  const sl = best.nh ? (best.harp.yEnd - best.harp.yMid) / best.harp.frac : 0;
  console.log(`       (exhaustive (a): ${ctx.runs} engine runs, ${pass.length} passing; best N ${m.N}, n_h ${m.nh}; search N ${best.N}, n_h ${best.nh})`);
  assert.equal(best.N, m.N, 'strands'); assert.equal(best.nh, m.nh, 'draped strands'); assert.ok(sl <= m.sl + 1e-12, `drape slope ${sl} vs ${m.sl}`);
});

test('Auto design, exhaustive (b): adjacent box beams, sections and concrete searched: the lightest section with a passing candidate; fewest strands; lowest f′c, then f′ci', () => {
  const P = load(CASES.find(c => c[0].startsWith('box BIII-36 (39in), CTDOT plate'))[1]), o = Object.assign(AD.settings(P), { topN: 1 }), k = B.cells(P)[0].k;
  const R = AD.runSync(P, o), sp = R.spans[0], c = sp.cands[0]; assert.ok(c, 'a candidate'); const best = c.types[0].res.best;
  const ctx = { cache: new Map(), fit: new Map(), rows: new Map(), runs: 0, first: {}, stopped: false }, C = AD.conc(P, k, o);
  const top = C.fc[C.fc.length - 1], hi = f => C.fciOf(f).slice(-1)[0], b0 = B.effBase(P, k);
  const levels = [[b0.mat.fc, b0.mat.fci], [b0.mat.fc, hi(b0.mat.fc)], [top, hi(top)]];
  const secs = AD.sections(P, 1, o).list, passAt = (name, lv) => { const S = space(P, k, name, o, ctx), out = [];
    for (let Ns = 2; Ns <= S.capS; Ns += 2) { const rw = AD.fill(S.rows, Ns, S.deb); if (!rw) continue; if (AD.evalCand(P, k, S.mk(rw, { n: 0 }, lv[0], lv[1]), ctx, false).pass) out.push(Ns + S.nTop); }
    return out; };
  const lightest = secs.find(q => levels.some(lv => passAt(q.name, lv).length));
  assert.equal(c.name, lightest.name, 'the lightest section with a passing candidate');
  const lv = levels.find(l => passAt(c.name, l).length), Nmin = Math.min(...passAt(c.name, lv));
  assert.equal(best.N, Nmin, `fewest strands at the strengths searched first (${lv})`);
  const S = space(P, k, c.name, o, ctx), rw = best.rows.filter(r => r.y <= S.h / 2);
  C.fc.filter(f => f < best.fc - 1e-9).forEach(f => assert.ok(!AD.evalCand(P, k, S.mk(rw, { n: 0 }, f, hi(f)), ctx, false).pass, `f′c ${f} fails`));
  C.fciOf(best.fc).filter(f => f < best.fci - 1e-9).forEach(f => assert.ok(!AD.evalCand(P, k, S.mk(rw, { n: 0 }, best.fc, f), ctx, false).pass, `f′ci ${f} fails`));
  console.log(`       (exhaustive (b): ${ctx.runs} engine runs; ${c.name}, N ${best.N}, f′c ${best.fc}, f′ci ${best.fci})`);
});
