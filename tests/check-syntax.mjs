#!/usr/bin/env node
// Syntax check of every inline script of a tool (Tier 0): classic scripts with `node --check`; text/babel (JSX) scripts transpiled
// first with the offline Babel in tests/libs (same version the tools load); GirderDetail's embedded Preliminary sizing page and (since 2026-10-22) ST-Girder page
// (<script type="text/plain" id="pl-src"> / id="st-src", un-escaped as plSrc() / stSrc() do) is checked too. Usage: node tests/check-syntax.mjs <tool.html|file.js> [...]
// With no arguments (since 2026-11-02): every tool HTML at the repo root, every apps/*/index.html, every apps/**/*.js and shared/*.js,
// each checked exactly as a file-specific run checks it (before, a run without arguments checked nothing and still said "all scripts pass").
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { HERE, REPO } from './lib.mjs';

const Babel = createRequire(import.meta.url)(path.join(HERE, 'libs', 'babel-standalone@7.23.5', 'babel.min.js'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allstruct-syntax-'));
let bad = 0, seq = 0, files = 0;
// srcdoc pages (an <iframe srcdoc="..."> holds a whole page, its quotes and ampersands written as entities; Concrete Beam
// Capacity embeds three): each is decoded and checked as its own page, and left out of the outer scan, whose regex would
// otherwise read the still-escaped scripts inside the attribute (added 2026-11-02).
const decodeAttr = v => v.replace(/&(quot|amp|lt|gt|apos|#\d+|#x[0-9a-f]+);/gi, (m, e) => {
  const k = e.toLowerCase();
  return k === 'quot' ? '"' : k === 'amp' ? '&' : k === 'lt' ? '<' : k === 'gt' ? '>' : k === 'apos' ? "'" : String.fromCodePoint(k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10));
});
function check(name, html) {
  let n = 0, k = 0;
  html = html.replace(/\bsrcdoc="([^"]*)"/gi, (m, v) => { check(name + ' > srcdoc ' + k++, decodeAttr(v)); return 'srcdoc=""'; });
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1], body = m[2];
    if (/\bsrc=/.test(attrs) || !body.trim()) continue;
    if (/type="text\/plain"/.test(attrs)) {
      if (/id="(pl|st)-src"/.test(attrs)) check(name + ' > ' + /id="(pl|st)-src"/.exec(attrs)[1] + '-src', body.replace(/<\\(\\*)(\/script|!--)/gi, '<$1$2'));   // st-src: the embedded ST-Girder page (Steel Bridge Design, 2026-10-22)
      continue;
    }
    if (/type="(application\/json|importmap|text\/template)"/.test(attrs)) continue;
    let code = body, kind = 'js';
    if (/type="text\/babel"/.test(attrs)) { kind = 'jsx'; try { code = Babel.transform(body, { presets: ['react'], compact: false }).code; } catch (e) { bad++; console.log(`FAIL ${name} script ${n} (JSX transpile): ${e.message.slice(0, 300)}`); n++; continue; } }
    const f = path.join(dir, `s${seq++}.${/type="module"/.test(attrs) ? 'mjs' : 'js'}`); fs.writeFileSync(f, code);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); console.log(`ok   ${name} script ${n} (${kind}, ${body.length} chars)`); }
    catch (e) { bad++; console.log(`FAIL ${name} script ${n} (${kind}): ${String(e.stderr).slice(0, 400)}`); }
    n++;
  }
}
// a plain .js file (shared/*.js, apps/**/*.js): `node --check` on the file itself
function checkJs(name, file) {
  try { execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' }); console.log(`ok   ${name} (js file)`); }
  catch (e) { bad++; console.log(`FAIL ${name} (js file): ${String(e.stderr).slice(0, 400)}`); }
}
function walkJs(d) {
  const out = [];
  for (const e of fs.readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) out.push(...walkJs(p)); else if (e.isFile() && e.name.endsWith('.js')) out.push(p);
  }
  return out;
}
function allFiles() {
  const root = fs.readdirSync(REPO).filter(n => n.endsWith('.html') && fs.statSync(path.join(REPO, n)).isFile()).sort().map(n => path.join(REPO, n));
  const apps = fs.existsSync(path.join(REPO, 'apps')) ? fs.readdirSync(path.join(REPO, 'apps')).sort().map(n => path.join(REPO, 'apps', n)) : [];
  const appHtml = apps.map(d => path.join(d, 'index.html')).filter(f => fs.existsSync(f));
  const appJs = apps.filter(d => fs.statSync(d).isDirectory()).flatMap(walkJs);
  const sharedJs = fs.existsSync(path.join(REPO, 'shared')) ? fs.readdirSync(path.join(REPO, 'shared')).filter(n => n.endsWith('.js')).sort().map(n => path.join(REPO, 'shared', n)) : [];
  return [...root, ...appHtml, ...appJs, ...sharedJs];
}
const argv = process.argv.slice(2);
const list = argv.length ? argv : allFiles();
for (const f of list) {
  const name = argv.length ? path.basename(f) : path.relative(REPO, f);
  files++;
  if (f.endsWith('.js')) checkJs(name, f); else check(name, fs.readFileSync(f, 'utf8'));
}
fs.rmSync(dir, { recursive: true, force: true });
if (!argv.length) console.log(`${files} file(s) checked (repo-root tools, apps/*/index.html, apps/**/*.js, shared/*.js)`);
console.log(bad ? `${bad} script(s) failed` : 'all scripts pass');
process.exit(bad ? 1 : 0);
