// Shared helpers for the headless test kit (dev tooling only; the tools themselves never load anything from tests/).
// - loadPlaywright(): the playwright package from a local node_modules or the global npm root (no browser download).
// - openPage(): Chromium with every CDN library served from tests/libs (routing), Google Fonts answered empty, all other
//   network requests blocked and listed; console errors, page errors and dialogs recorded; optional localStorage seed.
// - resolveFile(): a tool file from the working tree, or "<git ref>:<file>" / a bare git ref extracted with git show.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import { execFileSync } from 'child_process';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

export const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO = path.resolve(HERE, '..');
const MANIFEST = JSON.parse(fs.readFileSync(path.join(HERE, 'libs', 'MANIFEST.json'), 'utf8'));

export async function loadPlaywright() {
  try { return await import('playwright'); } catch (e) { /* not installed locally */ }
  try { const root = execFileSync('npm', ['root', '-g'], { encoding: 'utf8' }).trim(); return createRequire(path.join(root, 'noop.js'))('playwright'); }
  catch (e) { throw new Error('playwright package not found: install it with "npm i -g playwright" (no browser download needed when /opt/pw-browsers/chromium exists)'); }
}

export function chromiumPath() {
  if (process.env.PW_CHROMIUM) return process.env.PW_CHROMIUM;
  return fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined;   // undefined: playwright's own browser
}

// URL without scheme -> local file, from MANIFEST.json ("routes": exact URLs, "prefixes": a URL folder mapped to a local folder)
export function libFor(url) {
  const k = url.replace(/^https?:\/\//, '').split('?')[0];
  const exact = MANIFEST.routes[k];
  if (exact) return path.join(HERE, 'libs', exact);
  for (const [pre, dir] of Object.entries(MANIFEST.prefixes || {})) if (k.startsWith(pre)) return path.join(HERE, 'libs', dir, k.slice(pre.length));
  return null;
}
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

export async function openPage(file, { ls, vw = 1400, vh = 1000, hash = '' } = {}) {
  const { chromium } = await loadPlaywright();
  const b = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await b.newContext({ viewport: { width: vw, height: vh } });
  const blocked = new Set();
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/^(file|data|about|blob):/.test(u)) return r.continue();
    const f = libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: '', contentType: 'text/css' });
    blocked.add(u.slice(0, 160)); return r.abort();
  });
  const errs = [], dialogs = [];
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 400)));
  p.on('dialog', async d => { dialogs.push(d.message().slice(0, 400)); await d.accept(); });
  if (ls) await p.addInitScript(o => { if (!sessionStorage.getItem('__seeded')) { sessionStorage.setItem('__seeded', '1'); for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); } }, ls);
  await p.goto('file://' + file + hash);
  return { b, ctx, p, errs, dialogs, blocked };
}

// "Steel Bridge Design.html" (working tree), "origin/main" (bare ref: same file name as `tool`), or "abc123:stgirder.html".
// A git ref older than a file's rename is read under the file's previous name (RENAMED): GirderDetail was "Steel Bridge Beam Modules.html" until 2026-10-22.
const RENAMED = { 'Steel Bridge Design.html': ['Steel Bridge Beam Modules.html'] };
export function resolveFile(spec, tool) {
  const wt = path.resolve(REPO, spec);
  if (fs.existsSync(wt) && fs.statSync(wt).isFile()) { const rel = path.relative(REPO, wt); return { file: wt, label: rel.startsWith('..') ? wt : rel }; }
  const [ref, f] = spec.includes(':') ? [spec.slice(0, spec.indexOf(':')), spec.slice(spec.indexOf(':') + 1)] : [spec, tool];
  const sha = execFileSync('git', ['-C', REPO, 'rev-parse', '--short', ref], { encoding: 'utf8' }).trim();
  let buf = null, err = null, got = f;
  for (const name of [f, ...(RENAMED[f] || [])]) { try { buf = execFileSync('git', ['-C', REPO, 'show', `${sha}:${name}`], { maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'pipe'] }); got = name; break; } catch (e) { err = err || e; } }
  if (!buf) throw err;
  const dir = path.join(os.tmpdir(), 'allstruct-tests', sha); fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, path.basename(f)); fs.writeFileSync(out, buf);
  return { file: out, label: `${ref} (${sha}):${got}` };
}

export const hash = v => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex').slice(0, 12);

// leaf-by-leaf differences of two JSON values: [path, a, b]
export function diff(a, b, p = '', out = []) {
  if (a === b) return out;
  const ta = Array.isArray(a) ? 'array' : a === null ? 'null' : typeof a, tb = Array.isArray(b) ? 'array' : b === null ? 'null' : typeof b;
  if (ta !== tb || (ta !== 'object' && ta !== 'array')) { out.push([p || '(root)', a, b]); return out; }
  if (ta === 'array') { if (a.length !== b.length) out.push([p + '.length', a.length, b.length]); for (let i = 0; i < Math.min(a.length, b.length); i++) diff(a[i], b[i], `${p}[${i}]`, out); return out; }
  for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) diff(a[k], b[k], p + '.' + k, out);
  return out;
}
