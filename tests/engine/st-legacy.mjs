// st-legacy.mjs: ST-Girder's own code (the page text in <script type="text/plain" id="st-src"> of "Steel Bridge Design.html"; ST-Girder's only copy
// since the cut-over), run in a Node vm for parity tests (added 2026-10-30 for the Auto design parity, tests/engine/autodesign-parity.mjs).
// As pl-source.mjs: stDecl(name) is a top-level declaration (`function NAME(`, `const NAME =`, `let`, `var` at column 0) of the page
// text, unescaped as the page's plSrc() does ("<\/script" -> "</script"). ST-Girder's page is a React (JSX) page: only plain-JS
// declarations are run here (computeAll and what it reads), never a component.
// stAdopt(): the text of ST-Girder's "Pull from GirderDetail" handler (gdAdopt, a closure inside the App component, anchor
// `const gdAdopt=(p,how,auto)=>{`), so a GirderDetail hand-off payload can be turned into ST-Girder inputs exactly as the page does;
// the caller supplies the component's state (inpRef, setInp, setGdAuto, setGdNew, gdIsNew) and window.confirm.
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from './harness.mjs';

let ST = null;
export function stText() {
  if (ST) return ST;
  const html = fs.readFileSync(path.join(ROOT, 'Steel Bridge Design.html'), 'utf8');
  const a = html.indexOf('<script type="text/plain" id="st-src">'), b = html.indexOf('</script>', a);
  if (a < 0 || b < 0) throw new Error('st-src not found in Steel Bridge Design.html');
  return (ST = '\n' + html.slice(a, b).replace(/<\\(\\*)(\/script|!--)/gi, '<$1$2'));
}
export function stDecl(name) {
  const s = stText(), re = new RegExp(`\\n(?:async )?(?:function\\*? ${name}\\s*\\(|const ${name}\\s*=|let ${name}\\s*=|var ${name}\\s*=)`);
  const m = re.exec(s); if (!m) return null;
  const lines = s.slice(m.index + 1).split('\n'), out = [lines[0]];
  for (let i = 1; i < lines.length; i++) { const L = lines[i]; if (L === '' || /^[\s})\]]/.test(L)) out.push(L); else break; }
  while (out.length && out[out.length - 1].trim() === '') out.pop();
  return out.join('\n');
}
const slice = (start, end) => { const s = stText(), a = s.indexOf(start), b = s.indexOf(end, a); if (a < 0 || b < 0) throw new Error(`${start} not found in st-src`); return s.slice(a, b + end.length); };
// gdCheck (the payload test gdAdopt runs first, anchor `const gdCheck=p=>{`) and gdAdopt, both closures of the App component
export function stAdopt() {
  return slice('const gdCheck=p=>{', 'return null; };') + '\n' + slice('const gdAdopt=(p,how,auto)=>{', 'setGdNew(gdIsNew()); return true; };');
}
