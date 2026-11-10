#!/usr/bin/env node
// Steel Beam Design - AISC 15th: the Chapter H interaction uses the composite flexure ratio when composite action is on
// (SBH1C, engineer's decision 2026-11-10; closes the D11 open item). Headless, offline.
//   1. default beam (W18X50, 20 ft simple span), composite on (100 %, 4.5 in slab on 3 in deck), P_u = 50 kip on 1.2DL + 1.6LL + 0.5SL:
//      M_u = 44.0 kip-ft, composite phiMn = 810.26 kip-ft (bare steel 378.75), phiPn = 156.96 kip, B1 = 1.01274:
//      H1-1a = 0.31854 + 8/9 x 1.01274 x 44.0/810.26 = 0.3674 (was 0.4231 with the bare-steel 44.0/378.75);
//      the governing check becomes Pre-composite flexure 0.376; the note cites Commentary I7 (Interaction tab and Report);
//   2. two 20 ft spans, composite on: the negative-moment region (bare steel, Sec. I3.2b) governs, so H1 is unchanged (0.7461);
//   3. member mode, composite on, M_ux 150 kip-ft, P_u 60 kip, M_uy 5 kip-ft: H1-1a 1.195 (FAIL) -> 0.618;
//   4. composite off: the bare-steel ratio, as before (0.4231), no composite note. No console errors.
//   node tests/smoke/steel-beam-h1-composite.mjs [--file <tool html>]
import path from 'path';
import assert from 'assert/strict';
import { openPage, REPO } from '../lib.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const FILE = path.resolve(REPO, arg('file', 'Steel Beam Design - AISC 15th.html'));
let n = 0; const ok = m => { n++; console.log('  ok  ', m); };
const near = (a, b, tol, m) => assert.ok(Math.abs(a - b) <= tol, m + ': ' + a + ' vs ' + b);

const { b, p, errs } = await openPage(FILE);
await p.waitForFunction(() => typeof AN !== 'undefined' && AN && AN.design);
await p.waitForTimeout(700);
const run = cfg => p.evaluate(cfg => {
  S = defaultState();
  if (cfg.spans) { S.geom.spans = cfg.spans.map(L => ({ L })); S.geom.nodes = cfg.spans.concat([0]).map(() => ({ t: 'pin' })); }
  S.composite.on = !!cfg.comp;
  if (cfg.man) Object.assign(S.design.man, cfg.man);
  if (cfg.member) { S.mode = 'member'; S.member.L = 20; S.member.Lb = 20; S.member.rows = cfg.rows; }
  fullRebuild();
  const D = AN.design, gov = D.checks.filter(c => c.dcr != null && isFinite(c.dcr)).reduce((m, c) => (!m || c.dcr > m.dcr) ? c : m, null);
  return { comp: !!D.compActive, gov: gov && [gov.label, gov.dcr], ic: D.checks.find(c => c.label === 'Interaction').dcr,
    C: D.perCombo.map(C => ({ n: C.name, eq: C.inter.eq, v: C.inter.value, Mx: C.inter.terms.Mx, P: C.inter.terms.P, steel: C.interSteel ? C.interSteel.value : null,
      basis: C.flexGov && C.flexGov.basis || null, Mu: C.flexGov && C.flexGov.Mu, phiMn: C.flexGov && C.flexGov.phiMn, B1: C.B1 ? C.B1.B1 : null, Pc: C.phiPn || null })) };
}, cfg);
const tabText = async t => { await p.evaluate(t => [...document.querySelectorAll('#tabBar button')].find(x => x.textContent.trim() === t).click(), t);
  await p.waitForTimeout(t === 'Report' ? 2500 : 900); return p.evaluate(() => document.getElementById('tabPages').textContent); };

// 1
let r = await run({ comp: true, man: { c216: { Pu: 50 } } });
let c = r.C.find(x => x.n === '1.2DL + 1.6LL + 0.5SL');
assert.equal(r.comp, true); assert.equal(c.eq, 'H1-1a'); assert.equal(c.basis, 'composite');
near(c.Mu, 44.0, 1e-6, 'Mu'); near(c.phiMn, 810.2564, 1e-3, 'composite phiMn'); near(c.Pc, 156.9649, 1e-3, 'phiPn'); near(c.B1, 1.012738, 1e-6, 'B1');
near(c.P, 50 / 156.9649, 1e-5, 'Pr/Pc');
near(c.Mx, 1.012738 * 44 / 810.2564, 1e-5, 'Mrx/Mcx composite x B1');
near(c.v, 0.367427, 1e-5, 'H1-1a after'); near(c.steel, 0.423122, 1e-5, 'H1-1a before (bare steel)');
near(r.ic, 0.367427, 1e-5, 'Interaction check');
assert.equal(r.gov[0], 'Pre-composite flexure'); near(r.gov[1], 0.3763, 1e-3, 'governing');
let t = await tabText('Interaction');
assert.ok(t.includes('Commentary I7') && t.includes('§I3.2b') && !t.includes('bare-steel governing flexure DCR'), 'Interaction tab note');
assert.ok(t.includes('composite §I3.2a'), 'per-combination basis');
t = await tabText('Report');
assert.ok(t.includes('Commentary I7') && !t.includes('bare-steel governing flexure DCR'), 'Report note');
await tabText('Summary');
ok('composite, Pu 50 kip: H1-1a 0.4231 -> 0.3674 (Mrx/Mcx = B1 x 44.0/810.26); governing Pre-composite flexure 0.376; note on the tab and in the Report');
// 2
r = await run({ comp: true, spans: [20, 20], man: { c216: { Pu: 80 } } });
c = r.C.find(x => x.n === '1.2DL + 1.6LL + 0.5SL');
assert.equal(c.basis, 'steel'); near(c.v, c.steel, 1e-12, 'negative moment: unchanged'); near(c.v, 0.746087, 1e-5, 'H1-1a two spans');
ok('two spans, composite: the negative-moment region (bare steel) governs; H1-1a 0.7461 unchanged');
// 3
r = await run({ comp: true, member: true, rows: [{ id: 'm1', name: 'LC-1', Mux: 150, Vux: 20, Pu: 60, Muy: 5, Vuy: 0, Tu: 0 }] });
c = r.C[0];
assert.equal(c.basis, 'composite'); near(c.steel, 1.194737, 1e-5, 'member before'); near(c.v, 0.618205, 1e-5, 'member after');
ok('member mode, composite: H1-1a 1.195 (FAIL) -> 0.618');
// 4
r = await run({ comp: false, man: { c216: { Pu: 50 } } });
c = r.C.find(x => x.n === '1.2DL + 1.6LL + 0.5SL');
assert.equal(r.comp, false); assert.equal(c.steel, null); near(c.v, 0.423122, 1e-5, 'non-composite unchanged');
t = await tabText('Interaction');
assert.ok(!t.includes('Commentary I7'), 'no composite note without composite');
ok('composite off: H1-1a 0.4231 (bare steel), as before; no composite note');
assert.deepEqual(errs, [], 'console errors');
ok('no console errors');
await b.close();
console.log(n + ' checks passed');
