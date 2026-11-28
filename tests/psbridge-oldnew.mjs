#!/usr/bin/env node
// PS Bridge switch-over comparison (docs/ps-bridge-comparison.md, docs/ps-bridge-plan.md §5 row 10): the old app ("Prestressed Bridge
// Design.html", frozen at the pin of tests/engine/psbridge-source.mjs) against the new app (apps/ps-bridge/) on every case of parity
// harness A (tests/engine/psbridge-cases.mjs: 38 recorded old saved designs, 600 seeded, 20 edge) and every design of harness B
// (tests/engine/psbridge-tab-cases.mjs, 19), each design taken into the new app the way the engineer will take it: "From the old app"
// (engine/legacy.js PSBLegacy.convert), then computed as the page computes the girder shown (PSBDesign.inputs, PSBHoldDown.compute).
// Node only (no browser). Developer tooling: nothing here is loaded by a tool.
//   Stages, so that every difference is placed where it first appears:
//     A  the old app: its own Babel-compiled engine (oldEngine), computeAll(mergeInputs(saved));
//     B  the moved engine (engine/pbd-*.js) on the same old inputs, with the old library entries (PSBSections.withLegacy): = A (harness A);
//     C  the moved engine with this app's library (engine/sections.js: PS-30 / PS-31 / PS-32 / PS-36 / PS-38 to PS-40) on the imported
//        project's inputs (PSBDesign.inputs: the corrected section of an old name, PS-31; the bridge-driven fields; one-span continuity, …);
//     D  what the new app shows: PSBHoldDown.compute (the app's engine additions after computeAll: release tension steel, LLDF (f)/(g),
//        PS-10 hold-down, pier block, the load rating along the girder, UT, PL, applicability, deck distribution steel).
//   Harness A proves A = B (0 differences); B→C is the library and the import; C→D the app's engine additions.
//   Compared per case: every check of R.checks (ratio r, pass), the governing HL-93 rating factors (R.rating RFinv / RFopr), the shear rating
//   (R.shrRating), the vehicle ratings (R.vehRatings), an error. A ratio is "changed" when |Δr| > 1e-9 · max(1, |r|).
//   node tests/psbridge-oldnew.mjs [--out <json>] [--md <markdown table file>] [--cases recorded,tab,seeded,edge]
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, ROOT } from './engine/harness.mjs';
import { oldEngine } from './engine/psbridge-source.mjs';
import { recordedCases, seededCases, edgeCases } from './engine/psbridge-cases.mjs';
import { TAB_CASES } from './engine/psbridge-tab-cases.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > 0 ? process.argv[i + 1] : d; };
const APP = path.join(ROOT, 'apps/ps-bridge');
const page = fs.readFileSync(path.join(APP, 'index.html'), 'utf8');
const list = [...page.matchAll(/^\s*'([^']+\.js)',?/gm)].map(m => m[1]).filter(f => !f.startsWith('ui/') && !f.startsWith('report/'));
const W = loadShared(...list.map(f => path.join(APP, f)));
const O = oldEngine();
const LG = W.PSBLegacy, M = W.PSBModel, D = W.PSBDesign;
const J = v => JSON.parse(JSON.stringify(v));
const tol = (a, b) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
const num = v => typeof v === 'number' && isFinite(v);

function safe(f) { try { return f(); } catch (e) { return { error: 'throws: ' + e.message }; } }
function picture(R) {
  if (!R || R.error) return { error: R ? String(R.error) : 'no result' };
  const ch = {}; (R.checks || []).forEach((c, i) => { const k = ch[c.n] ? `${c.n} #${i}` : c.n; ch[k] = { r: c.r, pass: c.pass, v: c.v, lim: c.lim }; });
  const rt = R.rating ? { RFinv: R.rating.RFinv, RFopr: R.rating.RFopr } : null;
  const sr = R.shrRating ? { RFinv: R.shrRating.RFinv, RFopr: R.shrRating.RFopr } : null;
  const vr = Array.isArray(R.vehRatings) ? R.vehRatings.map(v => ({ n: v.name || v.n || v.id, RF: v.RF != null ? v.RF : v.RFopr })) : null;
  return { ch, rt, sr, vr };
}
// the differences between two pictures: [{ item, kind, a, b }]
function diff(a, b) {
  const out = [];
  if (a.error || b.error) { if (String(a.error || '') !== String(b.error || '')) out.push({ item: '(error)', kind: 'error', a: a.error || null, b: b.error || null }); return out; }
  const names = new Set([...Object.keys(a.ch), ...Object.keys(b.ch)]);
  for (const n of names) {
    const x = a.ch[n], y = b.ch[n];
    if (!x) out.push({ item: n, kind: 'added', a: null, b: y });
    else if (!y) out.push({ item: n, kind: 'removed', a: x, b: null });
    else if (x.pass !== y.pass) out.push({ item: n, kind: 'verdict', a: x, b: y });
    else if (num(x.r) && num(y.r) ? !tol(x.r, y.r) : String(x.r) !== String(y.r)) out.push({ item: n, kind: 'ratio', a: x, b: y });
  }
  for (const [k, lab] of [['rt', 'HL-93 rating'], ['sr', 'shear rating']]) for (const f of ['RFinv', 'RFopr']) {
    const x = a[k] && a[k][f], y = b[k] && b[k][f];
    if (num(x) || num(y)) { if (!(num(x) && num(y) && tol(x, y))) out.push({ item: `${lab} ${f}`, kind: 'rating', a: x, b: y }); }
  }
  if (JSON.stringify(a.vr) !== JSON.stringify(b.vr)) {
    const n = Math.max((a.vr || []).length, (b.vr || []).length);
    for (let i = 0; i < n; i++) { const x = (a.vr || [])[i], y = (b.vr || [])[i]; if (!x || !y || !(num(x.RF) && num(y.RF) ? tol(x.RF, y.RF) : x.RF === y.RF)) out.push({ item: `vehicle rating ${(x || y).n}`, kind: 'rating', a: x && x.RF, b: y && y.RF }); }
  }
  return out;
}

function cases() {
  const want = new Set(String(arg('cases', 'recorded,tab,seeded,edge')).split(','));
  const C = [];
  if (want.has('recorded')) recordedCases().forEach(c => C.push({ set: 'recorded', name: c.name, raw: c.saved == null ? {} : J(c.saved) }));
  if (want.has('tab')) Object.entries(TAB_CASES(() => M.defaultProject())).forEach(([n, P0]) => C.push({ set: 'tab', name: n, raw: J(D.inputs(P0)) }));
  if (want.has('seeded')) seededCases().forEach(c => C.push({ set: 'seeded', name: c.name, raw: c.saved == null ? {} : J(c.saved) }));
  if (want.has('edge')) edgeCases().forEach(c => C.push({ set: 'edge', name: c.name, raw: c.saved == null ? {} : J(c.saved) }));
  return C;
}

// the app's engine additions after computeAll (engine/holddown.js compute chain), by namespace, with the decision that added each
const MODS = [['PSBRigid', 'PS-19 rigid section on the real girder lines (engine/rigid.js)'], ['PSBLldfOpt', 'LL-O distribution options (engine/lldf-opt.js)'],
  ['PSBLldfFG', 'PS-35 type (f)/(g) LLDF for boxes and voided slabs (engine/lldf-fg.js)'], ['PSBRelTension', 'EZX / EZN release tension steel by parts (engine/reltension.js)'],
  ['PSBPierBlock', 'PS-34 pier compression block (engine/pierblock.js)'], ['PSBRatingAlong', 'E1 / E1-D4 / E1-D5 load rating along the girder (engine/rating-along.js)'],
  ['PSBUT', 'UT-N utilities (engine/ut.js)'], ['PSBPL', 'PL-A pedestrian load (engine/pl.js)'], ['PSBApplic', 'AP-B LLDF ranges of applicability (engine/applicability.js)'],
  ['PSBDemands', 'IMP-N / NOMCT imported demands notes (engine/demands.js)'], ['PSBDeckDist', 'DD deck distribution steel (engine/deckdist.js)']];
const rows = [], t0 = Date.now();
for (const c of cases()) {
  const oldInp = safe(() => J(O.mergeInputs(J(c.raw))));
  const A = picture(safe(() => O.computeAll(J(oldInp))));
  const B = picture(safe(() => W.PSBSections.withLegacy(() => W.computeAll(J(oldInp)))));
  const r = safe(() => LG.convert({ inputs: J(c.raw), kind: 'file', label: c.name }));
  const ok = r && r.ok;
  // what the page does with an imported project (index.html ctx.replace): types (PS-17 restore), PS-31 section correction, demands
  if (ok) { const Q = r.project; W.PSBBridge.migrate(Q); W.PSBLegacy.restore(Q); W.PSBSections.migrate(Q); W.PSBDemands.migrate(Q); }
  const inp = ok ? safe(() => D.inputs(r.project)) : null;
  const Cc = ok ? picture(safe(() => W.computeAll(J(inp)))) : { error: 'import refused: ' + JSON.stringify(r && (r.error || r.summary && r.summary.items)) };
  const Dd = ok ? picture(safe(() => W.PSBHoldDown.compute(J(inp)))) : Cc;
  const AB = diff(A, B), BC = diff(B, Cc), CD = diff(Cc, Dd), AD = diff(A, Dd);
  // C→D: each difference put on the app module(s) whose removal alone takes it back to C (the chain reads each module at call time)
  if (ok && CD.length) {
    const key = d => d.item + '|' + d.kind;
    for (const [mod, why] of MODS) {
      const keep = W[mod]; if (!keep) continue; W[mod] = undefined;
      const Dm = picture(safe(() => W.PSBHoldDown.compute(J(inp)))); W[mod] = keep;
      const left = new Set(diff(Cc, Dm).map(key));
      CD.forEach(d => { if (!left.has(key(d))) (d.by || (d.by = [])).push(why); });
    }
    CD.forEach(d => { if (!d.by && d.item === 'Hold-down force (PS-10)') d.by = ['PS-10 hold-down check (engine/holddown.js)']; });
  }
  const inpDiff = ok ? (() => { const a = J(oldInp), b = J(inp); [a, b].forEach(o => { delete o.proj; if (o.opt) { delete o.opt.hdCheck; delete o.opt.hdFrac; } }); const d = []; const walk = (x, y, p) => { if (x && y && typeof x === 'object' && typeof y === 'object') { new Set([...Object.keys(x), ...Object.keys(y)]).forEach(k => walk(x[k], y[k], p ? p + '.' + k : k)); } else if (JSON.stringify(x) !== JSON.stringify(y)) d.push(p); }; walk(a, b, ''); return d; })() : null;
  const imp = ok ? (r.summary && r.summary.items || []).filter(i => i.kind === 'diff' || i.kind === 'err').map(i => i.text) : null;
  rows.push({ set: c.set, name: c.name, owner: oldInp && oldInp.owner, girder: oldInp && oldInp.girder, cont: !!(oldInp && oldInp.cont && oldInp.cont.on),
    verdictOld: A.error ? 'error' : Object.values(A.ch).every(x => x.pass) ? 'PASS' : 'FAIL', verdictNew: Dd.error ? 'error' : Object.values(Dd.ch).every(x => x.pass) ? 'PASS' : 'FAIL',
    AB, BC, CD, AD, inpDiff, imp });
}

// the summary: per stage and item, the number of cases, verdict changes and the largest relative ratio change
const sum = {};
for (const row of rows) for (const st of ['AB', 'BC', 'CD']) for (const d of row[st]) {
  const by = (d.by || []).join(' + '), k = `${st}|${d.item.replace(/ #\d+$/, '')}|${d.kind}|${by}`, s = sum[k] || (sum[k] = { stage: st, item: d.item.replace(/ #\d+$/, ''), kind: d.kind, by, n: 0, sets: {}, flipsToFail: 0, flipsToPass: 0, maxRel: 0, ex: null });
  s.n++; s.sets[row.set] = (s.sets[row.set] || 0) + 1;
  if (d.kind === 'verdict') { if (d.a.pass && !d.b.pass) s.flipsToFail++; else s.flipsToPass++; }
  const ra = d.a && typeof d.a === 'object' ? d.a.r : d.a, rb = d.b && typeof d.b === 'object' ? d.b.r : d.b;
  if (num(ra) && num(rb)) { const rel = Math.abs(rb - ra) / Math.max(1e-12, Math.abs(ra)); if (rel > s.maxRel) { s.maxRel = rel; s.ex = { case: row.name, a: ra, b: rb }; } }
  else if (!s.ex) s.ex = { case: row.name, a: ra == null ? null : ra, b: rb == null ? null : rb };
}
const total = rows.length, same = rows.filter(r => !r.AD.length).length;
const flips = rows.filter(r => r.verdictOld !== r.verdictNew);
const out = { at: new Date().toISOString(), seconds: (Date.now() - t0) / 1000, total, same, bySet: Object.fromEntries(['recorded', 'tab', 'seeded', 'edge'].map(s => [s, { n: rows.filter(r => r.set === s).length, same: rows.filter(r => r.set === s && !r.AD.length).length }])),
  verdictFlips: flips.map(r => ({ set: r.set, name: r.name, old: r.verdictOld, now: r.verdictNew, items: r.AD.filter(d => d.kind === 'verdict' || d.kind === 'added' && d.b && !d.b.pass || d.kind === 'error').map(d => d.item) })),
  summary: Object.values(sum).sort((a, b) => a.stage.localeCompare(b.stage) || b.n - a.n), inputPaths: (() => { const m = {}; rows.forEach(r => (r.inpDiff || []).forEach(p => { m[p] = (m[p] || 0) + 1; })); return m; })(), rows };
if (arg('out')) fs.writeFileSync(arg('out'), JSON.stringify(out, null, 1));
console.log(`${total} cases in ${out.seconds.toFixed(0)} s: ${same} identical old → new, ${total - same} with a difference; verdict changed in ${flips.length}`);
for (const [s, v] of Object.entries(out.bySet)) console.log(`  ${s}: ${v.n} cases, ${v.same} identical`);
const fx = v => v == null ? '—' : typeof v === 'number' ? (Math.abs(v) >= 100 ? v.toFixed(1) : v.toFixed(4)) : String(v);
const md = ['| Stage | Item | Kind | Cause (C→D: the module whose removal takes it back) | Cases (recorded / tab / seeded / edge) | → FAIL | → PASS | Largest change (case: old → new) |', '|---|---|---|---|---|---|---|---|'];
for (const s of out.summary) md.push(`| ${s.stage} | ${s.item} | ${s.kind} | ${s.by || ''} | ${s.n} (${['recorded', 'tab', 'seeded', 'edge'].map(k => s.sets[k] || 0).join(' / ')}) | ${s.flipsToFail || ''} | ${s.flipsToPass || ''} | ${s.ex ? `${s.ex.case}: ${fx(s.ex.a)} → ${fx(s.ex.b)}${s.maxRel ? ` (${(100 * s.maxRel).toFixed(2)} %)` : ''}` : ''} |`);
if (arg('md')) fs.writeFileSync(arg('md'), md.join('\n') + '\n');
else console.log(md.join('\n'));
