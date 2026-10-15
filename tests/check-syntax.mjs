#!/usr/bin/env node
// Syntax check of every inline script of a tool (Tier 0): classic scripts with `node --check`; text/babel (JSX) scripts transpiled
// first with the offline Babel in tests/libs (same version the tools load); GirderDetail's embedded Preliminary sizing page
// (<script type="text/plain" id="pl-src">, un-escaped as plSrc() does) is checked too. Usage: node tests/check-syntax.mjs <tool.html> [...]
import fs from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { HERE } from './lib.mjs';

const Babel = createRequire(import.meta.url)(path.join(HERE, 'libs', 'babel-standalone@7.23.5', 'babel.min.js'));
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'allstruct-syntax-'));
let bad = 0;
function check(name, html) {
  let n = 0;
  for (const m of html.matchAll(/<script([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const attrs = m[1], body = m[2];
    if (/\bsrc=/.test(attrs) || !body.trim()) continue;
    if (/type="text\/plain"/.test(attrs)) {
      if (/id="pl-src"/.test(attrs)) check(name + ' > pl-src', body.replace(/<\\(\\*)(\/script|!--)/gi, '<$1$2'));
      continue;
    }
    if (/type="(application\/json|importmap|text\/template)"/.test(attrs)) continue;
    let code = body, kind = 'js';
    if (/type="text\/babel"/.test(attrs)) { kind = 'jsx'; try { code = Babel.transform(body, { presets: ['react'], compact: false }).code; } catch (e) { bad++; console.log(`FAIL ${name} script ${n} (JSX transpile): ${e.message.slice(0, 300)}`); n++; continue; } }
    const f = path.join(dir, `s${n}.${/type="module"/.test(attrs) ? 'mjs' : 'js'}`); fs.writeFileSync(f, code);
    try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); console.log(`ok   ${name} script ${n} (${kind}, ${body.length} chars)`); }
    catch (e) { bad++; console.log(`FAIL ${name} script ${n} (${kind}): ${String(e.stderr).slice(0, 400)}`); }
    n++;
  }
}
for (const f of process.argv.slice(2)) check(path.basename(f), fs.readFileSync(f, 'utf8'));
fs.rmSync(dir, { recursive: true, force: true });
console.log(bad ? `${bad} script(s) failed` : 'all scripts pass');
process.exit(bad ? 1 : 0);
