// GirderDetail's own code, taken from the text of "Steel Bridge Design.html" and run in a Node vm, for parity tests
// (nothing of the page's UI is loaded). gdGirderSection() returns GirderDetail's Girder section module (GM.gs) with every
// top-level declaration its compute() reads, pulled in by name on demand: a ReferenceError names the missing declaration,
// it is taken from the page text (a line at column 0 starting `function NAME(` / `const NAME =` / `let` / `var`, up to
// the next line at column 0 that is not a closing bracket) and the call is retried.
// Only the global P (the page's project state) is supplied here: { df: { bridge: {} }, fa: … }, the AASHTO case (no owner rules,
// straight, unskewed, no utilities).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

let SRC = null;
function src() {
  if (SRC) return SRC;
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8');
  const a = html.indexOf('SBD-SHARED-BEGIN');
  if (a < 0) throw new Error('SBD-SHARED-BEGIN not found in Steel Bridge Design.html');
  return (SRC = html.slice(html.lastIndexOf('\n<script>', a)));
}
export function gdDecl(name) {
  const s = src(), re = new RegExp(`\\n(?:async )?(?:function\\*? ${name}\\s*\\(|const ${name}\\s*=|let ${name}\\s*=|var ${name}\\s*=)`);
  const m = re.exec(s); if (!m) return null;
  const lines = s.slice(m.index + 1).split('\n'), out = [lines[0]];
  for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (L === '' || /^[\s})\]]/.test(L)) out.push(L); else break; }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}
export function gdBlock(startAnchor, endAnchor) {
  const s = src(), a = s.indexOf(startAnchor), b = s.indexOf(endAnchor, a + 1);
  if (a < 0 || b < 0) throw new Error(`block ${startAnchor} not found`);
  return s.slice(a, b);
}

// Run fn(ctx); on "X is not defined" add X's declaration from the page and retry.
// tag (optional): marks the scripts of one context (source comment and file name), so that V8 does not share their compiled
// code with another context's copy of the same declaration (observed: GirderDetail's steelProps, run hot in gdAnalysis's
// context first, then threw "sum is not defined" in gdGirderSection's context even after sum was added there).
export function gdRun(ctx, fn, loaded, tag = '') {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) {
      const m = /^(\w+) is not defined/.exec((e && e.message) || '');
      if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`);
      loaded.add(m[1]); vm.runInContext(tag ? `/*${tag}*/` + d : d, ctx, { filename: `Steel Bridge Design.html (${m[1]})${tag ? ' ' + tag : ''}` });
    }
  }
  throw new Error('too many missing declarations');
}

let GS = null;
export function gdGirderSection() {
  if (GS) return GS;
  const ctx = { console }; vm.createContext(ctx);
  // P.fa: fatigue settings, read by the fatigue part of compute only (not by any section property)
  vm.runInContext("var P = { df: { bridge: {} }, fa: { limit: 'auto', ADTT: 1000, p: 0.85, life: 75, gam: { fI: 1.75, fII: 0.8 } } }; var GM = {};", ctx);
  const loaded = new Set();
  const lit = gdBlock('GM.gs = {', '\n};\n') + '\n};';
  gdRun(ctx, c => vm.runInContext(lit, c, { filename: 'Steel Bridge Design.html (GM.gs)' }), loaded);
  GS = { ctx, loaded,
    compute: (p, opt) => gdRun(ctx, c => c.GM.gs.compute(p, opt), loaded),
    fn: name => gdRun(ctx, c => vm.runInContext(name, c), loaded) };
  // Warm-up: every declaration is added before the functions are called many times. Observed with Node 22: a function
  // that V8 has already optimized does not see a const added to the context afterwards by a new script (rhFactor's
  // hybrid branch, reached first after 2,000 homogeneous rows, kept throwing "f3 is not defined"). So the paths of
  // compute() used by the tests run once here: GirderDetail's built-in rows as is, hybrid, rebar in +Mp, n rounded.
  const def = () => JSON.parse(JSON.stringify(ctx.GM.gs.def));
  [{}, { gT: 'HPS70W', gB: 'HPS70W' }, { rebarMp: 'incl' }, { nRule: 'round' }].forEach(o => GS.compute({ ...def(), ...o }, { base: true }));
  // checks() once with a MassDOT bridge (GS4's owner citation and GS22, tests/engine/proportions.test.mjs, 2026-11-01): the owner functions
  // (gdOwnRules, gdOwnCite, gdOwnR, …) are added before checks() is run many times by the other tests and optimized
  { const R = GS.compute(def(), { base: true }); ctx.P.df.bridge = { owner: 'MassDOT' }; gdRun(ctx, c => c.GM.gs.checks(R), loaded); ctx.P.df.bridge = {}; }
  return GS;
}

// gdAnalysis() (added 2026-10-29 for tests/engine/analysis.test.mjs): GirderDetail's Structural analysis functions (sgBeam,
// feStages, sgLLRow, sgFatRow, feIM, feFatIM, saComp, saCracked, saStage, saSec, saSeq, steelProps, …) in their own vm
// context, each declaration pulled in on first use (as above). gdHP (owner rule OWN8: haunch 0 in the composite properties)
// is supplied as the identity: the caller passes the haunch to count. run(fn) calls fn(ctx) with the retry on missing names.
let GA = null;
export function gdAnalysis() {
  if (GA) return GA;
  const ctx = { console }; vm.createContext(ctx);
  vm.runInContext('var P = { df: { bridge: {} } }; var GM = {}; var gdHP = v => v;', ctx);
  const loaded = new Set(['gdHP']);
  GA = { ctx, loaded, run: fn => gdRun(ctx, fn, loaded, 'SA') };
  // constants first: a function that has run does not see a const added to the context later (see the warm-up note above)
  ['FE_CACHE', 'f0', 'sgBeam', 'feStages', 'feIM', 'feFatIM', 'sgLLRow', 'sgFatRow', 'steelProps', 'saComp', 'saCracked', 'saStage', 'saSec', 'saSeq']
    .forEach(name => gdRun(ctx, c => vm.runInContext(name, c), loaded, 'SA'));   // function declarations become properties of ctx
  // warm-up (see gdGirderSection): every function the tests use runs once on a small continuous girder
  GA.run(c => {
    const s = { D: 60, tw: 0.5, topB: 16, topT: 1, botB: 16, botT: 1 }, b0 = c.sgBeam([40, 50], false), N = b0.N;
    const SP = () => ({ Is: c.steelProps(60, s).I, I3u: c.saComp(s, 96, 24, 8, 2), Inu: c.saComp(s, 96, 8, 8, 2), Icr: c.saCracked(s, 6, 8, 2) });
    ['none', '15', 'dl'].forEach(k => c.feStages(b0, [40, 50], true, SP, k, new Float64Array(N).fill(1), 0.5));
    const F = c.feStages(b0, [40, 50], true, SP, 'none', new Float64Array(N).fill(1), 0.5);
    c.feIM(F.bN.MLL[5], 0.33); c.feFatIM(F.bN.MF[5], 0.15); c.sgLLRow(F.bN, F.bN.ILM.subarray(0, N)); c.saStage(s, 'c', 96, 8, 8, 2);
    const pl = { D: 60, top: [{ x0: 0, x1: 90, b: 16, t: 1 }], bot: [{ x0: 0, x1: 90, b: 16, t: 1 }], web: [{ x0: 0, x1: 90, t: 0.5 }] }; c.saSec(pl, 10);
    const M = new Float64Array(N).map((_, i) => Math.sin(i / 7) * 100);
    c.saSeq({ p: { seqOn: 'on', seqMod: 'n', seqCustom: '' }, cont: true, xs: b0.xs, trib: b0.trib, spans: [40, 50], n: 8, beff: 96, b: { tsDeck: 8, haunch: 2, plates: pl, fc: 4 }, F, MDC1: M, wSX: new Float64Array(N).fill(0.2), wDeck: 1 });
  });
  return GA;
}
