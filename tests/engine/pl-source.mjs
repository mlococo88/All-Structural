// Preliminary sizing's own code (the page text in <script type="text/plain" id="pl-src"> of "Steel Bridge Design.html"), run in a
// Node vm for parity tests (added 2026-10-29 with the framing and cross-frames PR). As gd-source.mjs: a top-level declaration
// (`function NAME(`, `const NAME =`, `let`, `var` at column 0) is pulled in by name when a ReferenceError names it, then the call
// is retried. Preliminary sizing's page has a placeholder where the main page's shared block (SBD-SHARED) goes at run time, so a
// name not declared in pl-src is taken from the main page (gd-source.mjs gdDecl, whose text starts at that shared block).
// The pl-src text is unescaped as the page's plSrc() does ("<\/script" → "</script").
// The owner rules table GirderDetail places in the frame (window.GD_OWN_RULES) is GirderDetail's OWN_RULES.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { ROOT } from './harness.mjs';
import { gdDecl } from './gd-source.mjs';

let PL = null;
function plText() {
  if (PL) return PL;
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8');
  const a = html.indexOf('<script type="text/plain" id="pl-src">'), b = html.indexOf('</script>', a);
  if (a < 0 || b < 0) throw new Error('pl-src not found in Steel Bridge Design.html');
  return (PL = '\n' + html.slice(a, b).replace(/<\\(\\*)(\/script|!--)/gi, '<$1$2'));
}
export function plDecl(name) {
  const s = plText(), re = new RegExp(`\\n(?:async )?(?:function\\*? ${name}\\s*\\(|const ${name}\\s*=|let ${name}\\s*=|var ${name}\\s*=)`);
  const m = re.exec(s); if (!m) return null;
  const lines = s.slice(m.index + 1).split('\n'), out = [lines[0]];
  for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (L === '' || /^[\s})\]]/.test(L)) out.push(L); else break; }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}
// plContext(names): a vm context with window, the owner table and the named declarations; run(fn) retries on a missing name.
export function plContext(names, tag = 'PL') {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  const loaded = new Set();
  const add = n => { if (loaded.has(n)) return true; const d = plDecl(n) || gdDecl(n); if (!d) return false; loaded.add(n); vm.runInContext(`/*${tag}*/` + d, ctx, { filename: `Steel Bridge Design.html (${n}) ${tag}` }); return true; };
  add('OWN_RULES'); vm.runInContext('window.GD_OWN_RULES = OWN_RULES;', ctx);
  const run = fn => { for (let k = 0; k < 400; k++) { try { return fn(ctx); } catch (e) { const m = /^(\w+) is not defined/.exec((e && e.message) || ''); if (!m || loaded.has(m[1])) throw e; if (!add(m[1])) throw new Error(`declaration not found: ${m[1]}`); } } throw new Error('too many missing declarations'); };
  (names || []).forEach(n => run(c => vm.runInContext(n, c)));
  const ev = expr => run(c => vm.runInContext(expr, c));   // a top-level const is not a property of the context: read it by name
  return { ctx, run, ev, loaded };
}
