// Shared helpers for the headless test kit (dev tooling only; the tools themselves never load anything from tests/).
// - loadPlaywright(): the playwright package from a local node_modules or the global npm root (no browser download).
// - openPage(): Chromium with every CDN library served from tests/libs (routing), Google Fonts answered empty, map tiles answered with a
//   blank tile (2026-11-16), all other
//   network requests blocked and listed; console errors, page errors and dialogs recorded; optional localStorage seed.
// - resolveFile(): a tool file from the working tree, or "<git ref>:<file>" / a bare git ref extracted with git show.
import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import zlib from 'zlib';
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
// a 256 x 256 light grey PNG (made once with zlib; the tile answer above)
const TILE = /^https:\/\/(server\.arcgisonline\.com\/ArcGIS\/rest\/services\/World_Imagery\/MapServer\/tile\/|tile\.openstreetmap\.org\/|[abc]\.tile\.openstreetmap\.org\/)/;
export const BLANK_TILE = (() => {
  const crcT = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(256, 0); ihdr.writeUInt32BE(256, 4); ihdr[8] = 8; ihdr[9] = 0;   // 8-bit greyscale
  const raw = Buffer.alloc(257 * 256); for (let y = 0; y < 256; y++) { raw[y * 257] = 0; raw.fill(0xdd, y * 257 + 1, y * 257 + 257); }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
})();
const TYPES = { '.js': 'application/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

export async function openPage(file, { ls, vw = 1400, vh = 1000, hash = '', timeout, dsf } = {}) {   // dsf: device scale factor (screenshots; default 1)   // timeout: page load, ms (default 30 s)
  const { chromium } = await loadPlaywright();
  const b = await chromium.launch({ executablePath: chromiumPath() });
  const ctx = await b.newContext({ viewport: { width: vw, height: vh }, ...(dsf ? { deviceScaleFactor: dsf } : {}) });
  const blocked = new Set();
  await ctx.route('**/*', r => {
    const u = r.request().url();
    if (/^(file|data|about|blob):/.test(u)) return r.continue();
    const f = libFor(u);
    if (f && fs.existsSync(f)) return r.fulfill({ path: f, contentType: TYPES[path.extname(f)] || 'application/octet-stream', headers: { 'Access-Control-Allow-Origin': '*' } });
    if (/^https?:\/\/fonts\.(googleapis|gstatic)\.com/.test(u)) return r.fulfill({ body: '', contentType: 'text/css' });
    // map tiles (Esri World Imagery, OpenStreetMap; the Crane Pick Analyzer's and Bridge Geometry's base maps): a blank 256 px tile, so a map opens
    // without console errors and without the network (2026-11-16). A smoke that tests the offline case routes them on its page (p.route wins).
    if (TILE.test(u)) return r.fulfill({ body: BLANK_TILE, contentType: 'image/png', headers: { 'Access-Control-Allow-Origin': '*' } });   // CORS as the real servers (the aerial sheets draw tiles into a canvas, 2026-11-17)
    blocked.add(u.slice(0, 160)); return r.abort();
  });
  const errs = [], dialogs = [];
  const p = await ctx.newPage();
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 400)); });
  p.on('pageerror', e => errs.push('pageerror: ' + e.message.slice(0, 400)));
  p.on('dialog', async d => { dialogs.push(d.message().slice(0, 400)); await d.accept(); });
  // ls: the localStorage seed, written once before the tool's first load (SEED1, 2026-11-14). The page first opens a blank file:// page (every
  // file:// page shares one localStorage origin in Chromium), the seed is written there, then the tool is opened. Before, an init script wrote
  // the seed on every load unless a sessionStorage marker survived, and Chromium sometimes drops sessionStorage across a file:// reload, so a
  // smoke that seeds and then reloads could get its seed back over the page's own later writes (PR #1555).
  if (ls) {
    const blank = path.join(os.tmpdir(), 'allstruct-tests', 'seed-blank.html');
    if (!fs.existsSync(blank)) { fs.mkdirSync(path.dirname(blank), { recursive: true }); fs.writeFileSync(blank, '<!doctype html><meta charset="utf-8"><title>seed</title>'); }
    await p.goto('file://' + blank);
    await p.evaluate(o => { for (const [k, v] of Object.entries(o)) localStorage.setItem(k, v); }, ls);
  }
  await p.goto('file://' + file + hash, timeout ? { timeout } : undefined);
  return { b, ctx, p, errs, dialogs, blocked };
}

// "Steel Bridge Design.html" (working tree), "origin/main" (bare ref: same file name as `tool`), or "abc123:stgirder.html".
// A git ref older than a file's rename is read under the file's previous name (RENAMED): GirderDetail was "Steel Bridge Beam Modules.html" until 2026-10-22.
// SBDA (2026-11-19): that file was archived as SBD_ARCHIVE_FILE; a ref older than the archiving has it as "Steel Bridge Design.html".
export { SBD_ARCHIVE_FILE } from './engine/harness.mjs';
import { SBD_ARCHIVE_FILE } from './engine/harness.mjs';
const RENAMED = { 'Steel Bridge Design.html': ['Steel Bridge Beam Modules.html'], [SBD_ARCHIVE_FILE]: ['Steel Bridge Design.html', 'Steel Bridge Beam Modules.html'] };
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
