// PS Bridge PR 2a, Node parity harness A (docs/ps-bridge-plan.md §3.2): the moved engine (apps/ps-bridge/engine/pbd-*.js, classic scripts)
// against today's Prestressed Bridge Design page code at the pinned commit (its window.PBD script as is, its text/babel block compiled with
// babel-standalone 7.23.5, presets env + react, as the page runs it). Contexts: tests/engine/psbridge-source.mjs. Cases:
// tests/engine/psbridge-cases.mjs (the 38 recorded cases of tests/ps-compare.mjs, 600 seeded cases, the edge cases).
// Compared per case with tolerance 0 (every number by Object.is: NaN, ±Infinity and −0 kept apart; text exactly; key order too):
//   mergeInputs(saved); computeAll(inputs): the whole result (checks, warns and error included; function-valued fields compared by their
//   values at sample arguments); psbReportVals(inputs, R); bxSuperRxPayload(inputs, R); PBD.migrate (both modes; its time stamp
//   normalised), PBD.applyBridge and PBD.withSpans for the first and last girder × span cells, PBD.contFE and PBD.restraint on the case's
//   continuous unit; anything the code logs to the console. optimizeStrands and sweepDesign (span, girder, spacing) on a subset.
// A third context runs the moved files with "use strict" prepended (the old page's Babel output is strict code; the moved files are not):
// it must give the same results on the recorded cases and every 10th seeded case.
// Gate: 0 differences. A difference is reported with its path and both values (never fixed by editing the engine, plan §3.3).
// computeAll's run time (new and old) is printed: node tests/engine/run.mjs psbridge-parity
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import vm from 'node:vm';
import { test } from './harness.mjs';
import { newEngine, oldEngine, PIN } from './psbridge-source.mjs';
import { recordedCases, seededCases, edgeCases } from './psbridge-cases.mjs';

const ISO = /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z/g;
const tagNum = v => Number.isNaN(v) ? '$NaN' : v === Infinity ? '$+Inf' : v === -Infinity ? '$-Inf' : Object.is(v, -0) ? '$-0' : v;

// canon(v, L): a plain, realm-free copy; numbers tagged (tagNum), undefined kept, functions replaced by their results at sample arguments
// (each call's throw kept as its message), ISO time stamps normalised; cycles marked. Key order is kept (JSON text is compared).
function canon(v, L, stack = []) {
  if (typeof v === 'number') return tagNum(v);
  if (typeof v === 'string') return v.replace(ISO, '(time)');
  if (v === undefined) return '$undef';
  if (typeof v === 'bigint' || typeof v === 'symbol') return '$' + typeof v + ':' + String(v);
  if (typeof v === 'function') return { $fn: v.length, at: fnArgs(v.length, L).map(a => { try { return canon(v(...a), L, stack); } catch (e) { return { $throw: String(e && e.message) }; } }) };
  if (v === null || typeof v !== 'object') return v;
  if (stack.includes(v)) return '$cycle';
  const tag = Object.prototype.toString.call(v);
  if (tag === '[object Date]') return '$date';
  if (ArrayBuffer.isView(v)) return { $typed: tag, v: Array.from(v, tagNum) };
  stack.push(v);
  let out;
  if (Array.isArray(v)) out = v.map(x => canon(x, L, stack));
  else { out = {}; for (const k of Object.keys(v)) out[k] = canon(v[k], L, stack); }
  stack.pop();
  return out;
}
function fnArgs(n, L) {
  const l = +L > 0 ? +L : 100;
  if (n <= 1) return [0, 0.5, 2.5, l * 0.1, l * 0.4, l / 2, l * 0.9, l, l * 12 * 0.3].map(x => [x]);
  return [[l * 0.3, 250, 170, 1], [l / 2, 262, 160, 0.5], [-1, 0, 0, 0]].map(a => a.slice(0, n));
}
function diff(a, b, p = '', out = []) {
  if (out.length >= 12) return out;
  if (JSON.stringify(a) === JSON.stringify(b)) return out;
  if (a && b && typeof a === 'object' && typeof b === 'object' && Array.isArray(a) === Array.isArray(b)) {
    const ka = Object.keys(a), kb = Object.keys(b), keys = [...new Set([...ka, ...kb])];
    for (const k of keys) diff(a[k], b[k], p + '.' + k, out);
    if (!out.length && ka.join() !== kb.join()) out.push({ path: p || '(root)', a: 'key order ' + ka.join(), b: 'key order ' + kb.join() });
    return out;
  }
  out.push({ path: p || '(root)', a: JSON.stringify(a)?.slice(0, 200), b: JSON.stringify(b)?.slice(0, 200) });
  return out;
}

// One case on one context: every compared output, and computeAll's time.
function runCase(c, cs) {
  c.__db = cs.env ? cs.env.db : null; c.__proj = cs.env ? cs.env.proj : null; c.__log.length = 0;
  const call = f => { try { return f(); } catch (e) { return { $throw: String(e && e.message) }; } };
  const fresh = o => c.JSON.parse(c.JSON.stringify(o));
  const merged = c.mergeInputs(cs.saved == null ? null : c.JSON.parse(JSON.stringify(cs.saved)));
  const inp = fresh(merged), L = inp.L;
  const t0 = performance.now(), R = call(() => c.computeAll(inp)), ms = performance.now() - t0;
  const out = { merged: canon(merged, L), R: canon(R, L) };
  out.rv = canon(call(() => c.psbReportVals(fresh(merged), R)), L);
  out.bx = canon(call(() => c.bxSuperRxPayload(fresh(merged), R)), L);
  const P = c.PBD, pb = {};
  for (const mode of ['pl', 'mod']) {
    const b = call(() => P.migrate(fresh(merged), mode)); pb['migrate.' + mode] = canon(b, L);
    if (b && !b.$throw) {
      const cells = [[1, 1], [b.nGirders, b.spans.length], [Math.min(2, b.nGirders), Math.ceil(b.spans.length / 2)]];
      cells.forEach(([g, s]) => { pb[`applyBridge.${mode}.${g}/${s}`] = canon(call(() => P.applyBridge(b, fresh(merged), g, s)), L);
        pb[`withSpans.${mode}.${s}`] = canon(call(() => P.withSpans(fresh(merged), b, s)), L); });
      pb['valid.' + mode] = P.valid(b);
    }
  }
  const cont = merged.cont || {}, sp = Array.isArray(cont.spans) && cont.spans.map(Number).filter(v => v > 0).length >= 2 ? cont.spans.map(Number).filter(v => v > 0) : [100, 100];   // no unit entered: a fixed one (each new span arrangement costs an FE solution, ~1 s)
  const s = Math.min(Math.max(1, Math.round(+cont.span) || 1), sp.length);
  pb.contFE = canon(call(() => P.contFE(c.JSON.parse(JSON.stringify(sp)), s)), L);
  const rs = R && R.cont && R.cont.restr;
  const ro = rs ? { spans: sp, s, wg: R.wG, wdk: R.wDk, phiPsL: rs.pL, phiPsR: rs.pR, d1: rs.d1, d2: rs.d2, kSh: rs.kSh }
    : { spans: sp, s, wg: 0.8, wdk: 0.9, phiPsL: -1200, phiPsR: -1100, d1: 1.2, d2: 0.9, kSh: 150 };
  pb.restraint = canon(call(() => P.restraint(c.JSON.parse(JSON.stringify(ro)))), L);
  pb.ownLoads = canon(call(() => P.ownLoads(fresh(merged))), L);
  out.pbd = pb;
  out.log = c.__log.slice();
  return { out, ms, cont: !!(R && R.fe) };
}
function runHeavy(c, cs) {
  const call = f => { try { return f(); } catch (e) { return { $throw: String(e && e.message) }; } };
  const inp = c.JSON.parse(c.JSON.stringify(c.mergeInputs(cs.saved == null ? null : c.JSON.parse(JSON.stringify(cs.saved))))), L = inp.L;
  return { opt: canon(call(() => c.optimizeStrands(inp)), L),
    span: canon(call(() => c.sweepDesign(inp, 'span', [+L * 0.8, +L, +L * 1.2])), L),
    girder: canon(call(() => c.sweepDesign(inp, 'girder', ['AASHTO Type IV', 'PCI BT-63', 'NEXT 32F', 'AASHTO BIII-36 (27in)'])), L),
    spacing: canon(call(() => c.sweepDesign(inp, 'spacing', [6, 9, 12])), L) };
}

let RES = null;
function parity() {
  if (RES) return RES;
  const NEW = newEngine(), OLD = oldEngine(), STR = newEngine({ strict: true });
  const rec = recordedCases(), seed = seededCases(600), edge = edgeCases(), all = [...rec, ...seed, ...edge];
  const res = { n: { recorded: rec.length, seeded: seed.length, edge: edge.length }, diffs: [], strictDiffs: [], heavyDiffs: [], tNew: [], tOld: [], tNewC: [], tOldC: [],
    errors: 0, checks: 0, warns: 0, heavy: 0, strict: 0 };
  all.forEach((cs, i) => {
    const a = runCase(OLD, cs), b = runCase(NEW, cs);
    if (b.cont) { res.tOldC.push(a.ms); res.tNewC.push(b.ms); } else if (i >= 5) { res.tOld.push(a.ms); res.tNew.push(b.ms); }
    const R = b.out.R; if (R && typeof R === 'object') { if (R.error && R.error !== '$undef') res.errors++; res.checks += (R.checks || []).length || 0; res.warns += (R.warns || []).length || 0; }
    const d = diff(a.out, b.out); if (d.length) res.diffs.push({ name: cs.name, d });
    if (i < rec.length || i % 10 === 0 || i >= rec.length + seed.length) {
      res.strict++; const s = runCase(STR, cs), ds = diff(b.out, s.out); if (ds.length) res.strictDiffs.push({ name: cs.name, d: ds });
    }
    if (['defaults', 'debond_harp', 'cont_3span', 'next_skew', 'owner_MassDOT_cont', 'midas_3span', 'shape_AASHTO_Type_III', 'shape_Custom'].includes(cs.name)
      || (i >= rec.length && i < rec.length + seed.length && (i - rec.length) % 75 === 0)) {
      res.heavy++; const ha = runHeavy(OLD, cs), hb = runHeavy(NEW, cs), dh = diff(ha, hb); if (dh.length) res.heavyDiffs.push({ name: cs.name, d: dh });
    }
  });
  const st = t => { const s = [...t].sort((x, y) => x - y), sum = s.reduce((p, q) => p + q, 0); return { mean: sum / s.length, median: s[s.length >> 1], p95: s[Math.floor(s.length * 0.95)], max: s[s.length - 1] }; };
  res.time = { new: st(res.tNew), old: st(res.tOld), newC: st(res.tNewC), oldC: st(res.tOldC) };   // simple spans (first 5 calls, compilation, left out); continuous units
  const f = v => v.toFixed(2);
  console.log(`       psbridge parity @${PIN.slice(0, 7)}: ${rec.length} recorded + ${seed.length} seeded + ${edge.length} edge = ${all.length} cases; ` +
    `${res.checks} checks, ${res.warns} warnings, ${res.errors} input errors compared; strict variant on ${res.strict} cases; optimizer / sweeps on ${res.heavy} cases`);
  console.log(`       differences: ${res.diffs.length} (strict variant ${res.strictDiffs.length}, optimizer / sweeps ${res.heavyDiffs.length})`);
  console.log(`       computeAll ms per call, new (native): mean ${f(res.time.new.mean)}, median ${f(res.time.new.median)}, p95 ${f(res.time.new.p95)}, max ${f(res.time.new.max)}; ` +
    `old (Babel ES5): mean ${f(res.time.old.mean)}, median ${f(res.time.old.median)}, p95 ${f(res.time.old.p95)}, max ${f(res.time.old.max)} (${res.tNew.length} simple-span cases)`);
  console.log(`       computeAll ms, continuous unit (${res.tNewC.length} cases; the first case of a span arrangement solves its FE model, ~1-2.5 s, later ones reuse it): ` +
    `new median ${f(res.time.newC.median)}, max ${f(res.time.newC.max)}; old median ${f(res.time.oldC.median)}, max ${f(res.time.oldC.max)}`);
  [...res.diffs, ...res.strictDiffs, ...res.heavyDiffs].slice(0, 10).forEach(x => console.log(`       DIFF ${x.name}: ${JSON.stringify(x.d.slice(0, 3))}`));
  return (RES = res);
}

const show = list => list.slice(0, 5).map(x => `${x.name}: ${x.d.map(d => `${d.path} old ${d.a} new ${d.b}`).join('; ')}`).join('\n');
test('parity A: 38 recorded + 600 seeded + edge cases, every output identical (tolerance 0)', () => {
  const r = parity();
  assert.equal(r.n.recorded, 38); assert.equal(r.n.seeded, 600);
  assert.ok(r.checks > 12000, 'checks compared: ' + r.checks);
  assert.equal(r.diffs.length, 0, show(r.diffs));
});
test('parity A: the moved files give the same results in strict mode (as the old page\'s Babel output runs)', () => {
  const r = parity(); assert.ok(r.strict >= 100); assert.equal(r.strictDiffs.length, 0, show(r.strictDiffs));
});
test('parity A: optimizeStrands and sweepDesign (span, girder, spacing) identical on a subset', () => {
  const r = parity(); assert.ok(r.heavy >= 12); assert.equal(r.heavyDiffs.length, 0, show(r.heavyDiffs));
});
test('the cases exercise the engine: most compute, some are refused (input errors), continuity, MIDAS, owners and draping all reached', () => {
  const r = parity(), all = [...recordedCases(), ...seededCases(600)], names = all.map(c => c.name).join(' ');
  ['cont2', 'cont3', 'cont4', 'MassDOT', 'CTDOT', 'RIDOT', 'midas1', 'midas3', 'approx', 'debond', 'rate', 'hand', 'deck', 'ext', 'h16@', 'h0@', '@0.3', '@0.5']
    .forEach(t => assert.ok(names.includes(t), 'case tag not reached: ' + t));
  assert.ok(r.errors < r.n.seeded / 4, 'too many refused cases: ' + r.errors);
});
test('the harness sees a change: one girder property moved by 1e-9 (or a −0 for a 0) is reported', () => {
  const cs = recordedCases().find(c => c.name === 'defaults'), A = runCase(newEngine(), cs).out;
  const B1 = newEngine(); vm.runInContext("GIRDERS['PCI BT-72'].A += 1e-9;", B1);
  assert.ok(diff(A, runCase(B1, cs).out).length > 0);
  assert.equal(diff({ x: canon(0) }, { x: canon(-0) }).length, 1);   // 0 and −0 are told apart
  assert.equal(diff({ x: canon(NaN) }, { x: canon(NaN) }).length, 0);
});
