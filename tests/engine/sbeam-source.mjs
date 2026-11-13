// "Steel Beam Design - AISC 15th.html": the tool's own engine functions, taken from the text of its inline scripts and run in a
// Node vm, for the engine tests (tests/engine/sbeam-*.test.mjs). Nothing of the page's UI is loaded.
// Same method as lp-source.mjs: a declaration is pulled in by name on first use (a line at column 0 starting
// `function NAME(` / `const NAME =` / `let NAME =` / `var NAME =`, up to the next line at column 0 that is not a closing
// bracket; for a data constant such as DB, also while its brackets are open), and the call is retried on "X is not defined".
// Differences from lp-source.mjs:
//   - this file declares some functions more than once (shearMajor, memberDefl, openTorsionFor, compositeFor, ...); the
//     browser runs the LAST declaration, so the last one is taken;
//   - functions the engine only calls behind a `typeof X==='function'` guard (no "not defined" error) are pulled in up front;
//   - computeAll() / computeMember() catch engine errors into AN.designError: design(code) reads a missing name from there.
// The page state `S` is the page's own `let S=defaultState();` (reset it with sb.run('S=defaultState()')).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';

export const SB_FILE = path.join(ROOT, 'Steel Beam Design - AISC 15th.html');

export function sbSourceText(file = SB_FILE) {
  const html = fs.readFileSync(file, 'utf8');
  const out = []; const re = /<script(\s[^>]*)?>([\s\S]*?)<\/script>/g; let m;
  while ((m = re.exec(html))) { if (m[1] && /\ssrc=/.test(m[1])) continue; out.push(m[2]); }
  return '\n' + out.join('\n');
}

export function sbDecl(src, name) {
  const esc = name.replace(/\$/g, '\\$');
  const re = new RegExp(`\\n(?:async )?(?:function\\*? ${esc}\\s*\\(|const ${esc}\\s*=|let ${esc}\\s*=|var ${esc}\\s*=)`, 'g');
  let m, last = null; while ((m = re.exec(src))) last = m;   // the last declaration wins, as in the browser
  if (!last) return null;
  const lines = src.slice(last.index + 1).split('\n'), out = [lines[0]];
  // a data constant (`const DB={W:[[...],` with one row per line at column 0) also continues while its brackets are open
  const data = !/^(?:async )?function/.test(lines[0]);
  const open = L => { let d = 0; for (const ch of L) { if (ch === '{' || ch === '[' || ch === '(') d++; else if (ch === '}' || ch === ']' || ch === ')') d--; } return d; };
  let depth = data ? open(lines[0]) : 0;
  for (let i = 1; i < lines.length; i++) {
    const L = lines[i];
    if (L === '' || /^[\s})\]]/.test(L) || (data && depth > 0)) { out.push(L); if (data) depth += open(L); } else break;
  }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}

// sbEngine(): a fresh context. run(code) evaluates in the context with the retry; call(name, ...args) calls a page function.
export function sbEngine(file = SB_FILE) {
  const src = sbSourceText(file);
  const ctx = { console, Math, JSON }; vm.createContext(ctx);
  vm.runInContext('var $ = () => null; var document = { getElementById: () => null, querySelectorAll: () => [], querySelector: () => null }; var window = this;', ctx);
  const loaded = new Set();
  const add = name => {
    if (loaded.has(name)) return false;
    const d = sbDecl(src, name); if (!d) throw new Error(`Steel Beam Design declaration not found: ${name}`);
    // let/const run as var: a global object property is seen by functions compiled earlier, a late global `let` is not (V8)
    loaded.add(name);
    // an initializer that calls another declaration (`let S=defaultState();`) pulls that one in first
    for (let k = 0; k < 50; k++) {
      try { vm.runInContext(d.replace(/^(?:let|const) /, 'var '), ctx, { filename: `Steel Beam Design - AISC 15th.html (${name})` }); return true; }
      catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || !add(m[1])) throw e; }
    }
    throw new Error('too many missing declarations in ' + name);
  };
  const run = code => {
    for (let k = 0; k < 600; k++) {
      try { return vm.runInContext(code, ctx); }
      catch (e) {
        const m = /^(\w+) is not defined/.exec((e && e.message) || '');
        if (!m || !add(m[1])) throw e;
      }
    }
    throw new Error('too many missing declarations');
  };
  // called behind typeof guards in designAll / memberDesignAll, so never reported as missing: load them as the page has them
  ['openTorsionFor', 'compositeFor', 'constructionStage', 'applyCompositeToRegions', 'batchExtras'].forEach(n => { try { run(n); } catch (e) { /* absent in this version */ } });
  // design(code): code that returns computeAll() / computeMember(). Those catch an engine error into AN.designError, so a
  // missing declaration is not thrown: it is read from designError, loaded, and the code run again.
  const design = code => {
    for (let k = 0; k < 600; k++) {
      const A = run(code), m = A && /^(\w+) is not defined/.exec(A.designError || '');
      if (!m) return A;
      if (!add(m[1])) return A;
    }
    throw new Error('too many missing declarations');
  };
  let n = 0;
  const call = (name, ...args) => { const k = `__a${n++}`; ctx[k] = args; try { return run(`${name}(...${k})`); } finally { delete ctx[k]; } };
  return { ctx, src, run, call, design, add, loaded };
}
