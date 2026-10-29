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
export function gdRun(ctx, fn, loaded) {
  for (let k = 0; k < 400; k++) {
    try { return fn(ctx); }
    catch (e) {
      const m = /^(\w+) is not defined/.exec((e && e.message) || '');
      if (!m || loaded.has(m[1])) throw e;
      const d = gdDecl(m[1]); if (!d) throw new Error(`GirderDetail declaration not found: ${m[1]}`);
      loaded.add(m[1]); vm.runInContext(d, ctx, { filename: `Steel Bridge Design.html (${m[1]})` });
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
  return GS;
}
