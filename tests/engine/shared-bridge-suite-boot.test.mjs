// shared/bridge-suite-boot.js (window.SharedBridgeBoot; BSB, 2026-11-28, docs/ps-bridge-plan.md §5 row 8, CLAUDE.md §3): the Bridge Suite
// bootstrap / hand-off blocks moved out of index.html and lldf.html (and the BridgeXfer copy of apps/ps-bridge/ui/bridgexfer.js) into one file.
// A pure refactor, proven three ways:
//   1. verbatim: every part's body is the inline block of index.html, lldf.html and "Prestressed Bridge Design.html" before the move
//      (git revision PIN), byte for byte; the only text that differed between the pages (the BridgeApps.boot id) is the registry(app) argument;
//      ui/bridgexfer.js's copy at PIN = the xfer() body;
//   2. the pages now: no inline copy left, the shared file loaded once before the first call, the parts called in the old blocks' order, each
//      where its block was (the page's other scripts in between unchanged), the PS app only xfer();
//   3. behaviour: each page's old blocks (from PIN) and the new file + calls are run in two Node contexts with the same stand-ins (storage,
//      a recording DOM, fixed clock and random numbers): the same globals with the same members, and the same log of every storage write and
//      DOM call, at boot and through a scripted session (design beam, roster, project registry, app paths, locks, BridgeXfer, BXProject).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
import { isDeepStrictEqual } from 'node:util';
import { test, ROOT } from './harness.mjs';

const PIN = '656cbaca';   // origin/main before the move (the blocks inline)
const show = f => execFileSync('git', ['show', `${PIN}:${f}`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 64 << 20 });
const SHARED = fs.readFileSync(path.join(ROOT, 'shared/bridge-suite-boot.js'), 'utf8');
const BOOTLINE = "try{ window.BridgeApps.boot(app); }catch(e){}";

// each part's body as it is written in the shared file: from "function name(...) {\n" to the "\n  }\n\n" before the next part's
// header ("  /* ---- ") or the namespace line
function body(name) {
  const h = new RegExp(`\\n  function ${name}\\((?:app)?\\) \\{\\n`).exec(SHARED); assert.ok(h, name);
  const from = h.index + h[0].length, ends = ['\n  }\n\n  /* ---- ', '\n  }\n\n  window.SharedBridgeBoot = '].map(e => SHARED.indexOf(e, from)).filter(i => i >= 0);
  return SHARED.slice(from, Math.min(...ends));
}
const PARTS = ['beam', 'handoff', 'geometry', 'registry', 'xfer', 'project'];
const B = Object.fromEntries(PARTS.map(p => [p, body(p)]));
const reg = app => { assert.equal(B.registry.split(BOOTLINE).length, 2); return B.registry.replace(BOOTLINE, `try{ window.BridgeApps.boot('${app}'); }catch(e){}`); };
const block = t => `<script>\n${t}\n</script>`;
// the old inline blocks of each page, in page order (the xfer and project parts were one block; lldf.html's own glue followed in it)
const OLD = {
  'index.html': { app: 'mct', blocks: [B.beam, B.handoff, B.geometry, reg('mct'), B.xfer + '\n' + B.project] },
  'lldf.html': { app: 'lldf', blocks: [B.beam, reg('lldf'), B.xfer + '\n' + B.project] },
  'Prestressed Bridge Design.html': { app: 'psbeam', blocks: [B.beam, B.handoff, B.geometry, reg('psbeam'), B.xfer + '\n' + B.project] },
};

test('verbatim: every part = the inline block of index.html, lldf.html and Prestressed Bridge Design.html before the move', () => {
  for (const [f, o] of Object.entries(OLD)) {
    const html = show(f);
    let at = 0;
    o.blocks.forEach((b, i) => {
      const s = f === 'lldf.html' && i === 2 ? `<script>\n${b}\n` : block(b);   // lldf.html: its title-block glue followed in the same block
      const j = html.indexOf(s, at); assert.ok(j > at, `${f}: block ${i + 1} not found in order`); at = j + s.length;
      assert.equal(html.split(s).length, 2, `${f}: block ${i + 1} once`);
    });
    // nothing else of the bootstrap was inline: every namespace the parts set is defined in those blocks only
    for (const ns of ['window.BridgeBeam=', 'window.BridgeHandoff=', 'window.BridgeGeometryChanges=', 'window.BridgeProjects=', 'window.BridgeApps=', 'window.BridgeLocks=', 'window.BridgeXfer=', 'window.BXProject='])
      assert.ok(html.split(ns).length - 1 === o.blocks.join('\n').split(ns).length - 1, `${f}: ${ns}`);
  }
  // apps/ps-bridge/ui/bridgexfer.js held the BridgeXfer block only (after its own two-line header)
  const ps = show('apps/ps-bridge/ui/bridgexfer.js').split('\n');
  assert.equal(ps.slice(2).join('\n'), B.xfer + '\n');
  // the shared file's own lines: header, one namespace, the parts; nothing else runs on load
  const ctx = { window: null }; ctx.window = ctx; vm.createContext(ctx); vm.runInContext(SHARED, ctx);
  assert.deepEqual(Object.keys(ctx).sort(), ['SharedBridgeBoot', 'window']);
  assert.deepEqual(Object.keys(ctx.SharedBridgeBoot), PARTS);
});

test('the pages: no inline copy left; the shared file loaded once before the parts, called in the old order where each block was', () => {
  const calls = t => [...t.matchAll(/SharedBridgeBoot\.(\w+)\(([^)]*)\)/g)].map(m => m[1] + '(' + m[2] + ')');
  const want = { 'index.html': ['beam()', 'handoff()', 'geometry()', "registry('mct')", 'xfer()', 'project()'], 'lldf.html': ['beam()', "registry('lldf')", 'xfer()', 'project()'] };
  for (const [f, w] of Object.entries(want)) {
    const html = fs.readFileSync(path.join(ROOT, f), 'utf8'), old = show(f);
    assert.deepEqual(calls(html), w, f);
    const src = '<script src="shared/bridge-suite-boot.js"></script>';
    assert.equal(html.split(src).length, 2, f); assert.ok(html.indexOf(src) < html.indexOf('SharedBridgeBoot.'), f);
    for (const ns of ['window.BridgeBeam=', 'window.BridgeApps=', 'window.BridgeXfer=', 'window.BXProject=', 'window.BridgeLocks=']) assert.ok(!html.includes(ns), `${f}: ${ns}`);
    // the rest of the page is unchanged: the old page = the new page with each call replaced by its block (and the beam block's header note)
    let back = html.replace(src + '\n', '');
    const o = OLD[f].blocks;
    if (f === 'index.html') {
      back = back.replace('<script>SharedBridgeBoot.beam();</script>', block(o[0])).replace('<script>SharedBridgeBoot.handoff();</script>', block(o[1]))
        .replace('<script>SharedBridgeBoot.geometry();</script>', block(o[2])).replace("<script>SharedBridgeBoot.registry('mct');</script>", block(o[3]))
        .replace('<script>SharedBridgeBoot.xfer(); SharedBridgeBoot.project();</script>', block(o[4]));
    } else {
      back = back.replace('<script>SharedBridgeBoot.beam();</script>', block(o[0])).replace("<script>SharedBridgeBoot.registry('lldf');</script>", block(o[1]))
        .replace('<script>SharedBridgeBoot.xfer(); SharedBridgeBoot.project();</script>\n<script>\n', `<script>\n${o[2]}\n`);
    }
    const NOTE_NEW = /     The code is in shared\/bridge-suite-boot\.js[\s\S]*?stgirder\.html was removed on 2026-10-22\.\)/;
    const NOTE_OLD = '     This block is byte-identical in index.html / Prestressed Bridge Design.html\n     (psbeam.html until 2026-10-22) / lldf.html — edit it in one place and copy it\n     to the other two. (ST-Girder left the suite on 2026-10-19; stgirder.html was\n     removed on 2026-10-22.)';
    back = back.replace(NOTE_NEW, NOTE_OLD);
    assert.ok(back === old, `${f}: differs from the page before the move outside the moved blocks`);
  }
  // the PS app: the shared file, then ui/bridgexfer.js, which installs BridgeXfer only
  const page = fs.readFileSync(path.join(ROOT, 'apps/ps-bridge/index.html'), 'utf8');
  const list = [...page.matchAll(/^\s*'([^']+\.js)',?/gm)].map(m => m[1]), i = list.indexOf('../../shared/bridge-suite-boot.js');
  assert.ok(i >= 0 && list[i + 1] === 'ui/bridgexfer.js');
  const own = list.filter(f => !f.startsWith('../../shared/bridge-suite-boot')).map(f => fs.readFileSync(path.join(ROOT, 'apps/ps-bridge', f), 'utf8')).join('\n') + page;
  assert.deepEqual(calls(own.replace(/\/\*[\s\S]*?\*\//g, '').replace(/<!--[\s\S]*?-->/g, '')), ['xfer()']);
});

/* ---- 3. behaviour: old inline blocks vs the shared file + calls, in Node, with recording stand-ins ---- */
function env(file) {
  const log = [], store = new Map();
  let seed = 12345; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  let clock = Date.parse('2026-11-28T12:00:00.000Z');
  const RealDate = Date;
  class FDate extends RealDate { constructor(...a) { super(...(a.length ? a : [clock])); } static now() { return clock; } }
  const prim = v => (v === null || ['string', 'number', 'boolean', 'undefined'].includes(typeof v)) ? v : typeof v === 'function' ? '<fn>' : '<obj>';
  // a recording DOM: every property read gives a node; every call is logged with its primitive arguments
  const node = name => new Proxy(function () {}, {
    get: (t, k) => {
      if (k === Symbol.toPrimitive) return () => ''; if (k === 'then' || typeof k === 'symbol') return undefined;
      if (k in t && k !== 'name' && k !== 'length' && k !== 'call' && k !== 'apply' && k !== 'bind') return t[k];
      if (['value', 'textContent', 'innerHTML', 'innerText', 'className', 'id', 'title', 'href', 'readyState'].includes(k)) return t['_' + k] !== undefined ? t['_' + k] : '';
      if (k === 'length') return 0; if (k === 'checked' || k === 'disabled' || k === 'open') return false;
      return node(name + '.' + String(k));
    },
    set: (t, k, v) => { log.push(['set', name + '.' + String(k), prim(v)]); t['_' + String(k)] = v; return true; },
    apply: (t, th, a) => { log.push(['call', name, Array.from(a, prim)]); return node(name + '()'); },
    construct: (t, a) => { log.push(['new', name, Array.from(a, prim)]); return node('new ' + name); },
  });
  const ctx = {
    console: { log() {}, warn() {}, error() {} }, JSON, Math: Object.assign(Object.create(Math), { random: rnd }), Date: FDate,
    setTimeout: (f, ms) => { log.push(['setTimeout', ms]); return 1; }, clearTimeout() {}, setInterval: () => 1, clearInterval() {},
    localStorage: { getItem: k => store.has(k) ? store.get(k) : null, setItem: (k, v) => { log.push(['setItem', k, String(v)]); store.set(k, String(v)); },
      removeItem: k => { log.push(['removeItem', k]); store.delete(k); }, key: i => [...store.keys()][i] ?? null, get length() { return store.size; }, clear() { store.clear(); } },
    sessionStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    location: { pathname: '/repo/' + file, href: 'file:///repo/' + file, search: '', hash: '', protocol: 'file:' },
    document: node('document'), navigator: { userAgent: 'node' },
    alert: m => { log.push(['alert', String(m)]); }, confirm: m => { log.push(['confirm', String(m)]); return true; }, prompt: () => null,
    addEventListener: (t) => { log.push(['window.addEventListener', t]); }, removeEventListener() {}, dispatchEvent() {},
    Event: function (t) { this.type = t; }, CustomEvent: function (t, o) { this.type = t; this.detail = o && o.detail; },
    Blob: function () {}, URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} }, FileReader: function () {},
  };
  ctx.window = ctx; ctx.self = ctx; ctx.top = ctx; ctx.parent = ctx;
  vm.createContext(ctx);
  return { ctx, log, store, tick: ms => { clock += ms; } };
}
const SEED = { 'bridgeSuite.v1.projects': JSON.stringify({ bp_a: { name: 'Alpha', savedAt: '2026-11-01T12:00:00.000Z', slices: { mct: { projectName: 'Alpha' }, lldf: { x: 1 } } } }),
  'bridgeSuite.v1.currentProjectId': 'bp_a', 'bridgeSuite.v1.appPaths': JSON.stringify({ psbeam: { file: 'Prestressed Bridge Design.html', dir: '/repo/' } }) };
const NAMES = ['BridgeBeam', 'BridgeHandoff', 'BridgeGeometryChanges', 'BridgeProjects', 'BridgeApps', 'BridgeLocks', 'BridgeXfer', 'BXProject'];
function session(E) {
  const W = E.ctx, out = [];
  const tryv = (k, f) => { try { const v = f(); out.push([k, JSON.stringify(v === undefined ? null : v, (a, b) => typeof b === 'function' ? '<fn>' : b)]); } catch (e) { out.push([k, 'throws ' + e.message]); } };
  tryv('shape', () => NAMES.map(n => [n, W[n] ? Object.keys(W[n]).map(k => k + ':' + typeof W[n][k]) : null]));
  E.tick(1000);
  if (W.BridgeBeam) {
    tryv('roster', () => W.BridgeBeam.publishRoster({ Nb: 5, beams: [1, 2, 3, 4, 5].map(i => ({ i, label: 'B' + i, cls: i === 1 || i === 5 ? 'exterior' : 'interior', dl: { dc: i * 0.1 } })) }));
    tryv('set', () => W.BridgeBeam.set(2, null, 'test')); tryv('get', () => W.BridgeBeam.get()); tryv('dl', () => W.BridgeBeam.dl(2)); tryv('mismatch', () => W.BridgeBeam.mismatch(4));
  }
  E.tick(1000);
  if (W.BridgeHandoff) { tryv('ho', () => Object.keys(W.BridgeHandoff)); tryv('hoList', () => W.BridgeHandoff.list && W.BridgeHandoff.list()); tryv('hoLatest', () => W.BridgeHandoff.latestId && W.BridgeHandoff.latestId()); }
  if (W.BridgeGeometryChanges) { tryv('geoPub', () => W.BridgeGeometryChanges.publishGeometryChanges([{ field: 'L', oldVal: 100, newVal: 110 }])); tryv('geoRd', () => W.BridgeGeometryChanges.readGeometryChanges()); }
  E.tick(1000);
  const BP = W.BridgeProjects;
  if (BP) {
    tryv('bpKeys', () => Object.keys(BP)); tryv('cur', () => BP.current && BP.current()); tryv('list', () => BP.list && BP.list());
    tryv('slice', () => BP.saveSlice && BP.saveSlice(BP.current(), undefined, 'otherApp', { n: 1 }));
    tryv('read', () => BP.get && BP.get(BP.current()));
  }
  const BA = W.BridgeApps;
  if (BA) { tryv('apps', () => [BA.all && BA.all(), BA.path && BA.path('psbeam'), BA.href && BA.href('lldf'), BA.selfFile && BA.selfFile(), BA.info && BA.info('mct')]); }
  if (W.BridgeLocks) tryv('locks', () => Object.keys(W.BridgeLocks).map(k => [k, typeof W.BridgeLocks[k] === 'function' && /^(ok|all|get|state)$/.test(k) ? W.BridgeLocks[k]() : null]));
  E.tick(1000);
  const BX = W.BridgeXfer;
  if (BX) {
    tryv('pub', () => BX.publish('lldf', { _schema: 'bridge-lldf-factors', governing: { interior: { gM: 0.6 } } }, 'Test', 'x.html'));
    tryv('rd', () => BX.read('lldf', 'bridge-lldf-factors', 1)); tryv('isNew', () => BX.isNew('lldf', 'rx')); tryv('adopt', () => BX.markAdopted('lldf', 'rx')); tryv('isNew2', () => BX.isNew('lldf', 'rx'));
    tryv('bad', () => BX.read('nothing', 'x', 1)); tryv('desc', () => BX.describe && BX.describe('lldf')); tryv('sp', () => BX.sharedProject && BX.sharedProject());
  }
  if (W.BXProject) { tryv('share', () => W.BXProject.share({ projectName: 'P', date: '2026-11-28' })); tryv('use', () => W.BXProject.use({ projectName: '' }, upd => out.push(['applied', JSON.stringify(upd)]))); }
  return out;
}
function runOld(file, blocks) {
  const E = env(file); Object.entries(SEED).forEach(([k, v]) => E.store.set(k, v));
  blocks.forEach((b, i) => { try { vm.runInContext(b, E.ctx, { filename: `${file} (before) block ${i + 1}` }); } catch (e) { E.log.push(['error', e.message]); } });
  const boot = E.log.slice(); return { boot, s: session(E), log: E.log, store: [...E.store] };
}
function runNew(file, calls, extra) {
  const E = env(file); Object.entries(SEED).forEach(([k, v]) => E.store.set(k, v));
  vm.runInContext(SHARED, E.ctx, { filename: 'shared/bridge-suite-boot.js' });
  calls.forEach(c => { try { vm.runInContext('SharedBridgeBoot.' + c, E.ctx, { filename: `${file} (after) ${c}` }); } catch (e) { E.log.push(['error', e.message]); } });
  if (extra) { try { vm.runInContext(extra, E.ctx, { filename: `${file} (after) its own glue` }); } catch (e) { E.log.push(['error', e.message]); } }
  const boot = E.log.slice(); return { boot, s: session(E), log: E.log, store: [...E.store] };
}

test('behaviour: the old inline blocks and the shared file + calls give the same globals, storage writes and DOM calls (boot and a session)', () => {
  const cases = {
    'index.html': ['beam()', 'handoff()', 'geometry()', "registry('mct')", 'xfer()', 'project()'],
    'lldf.html': ['beam()', "registry('lldf')", 'xfer()', 'project()'],
    'Prestressed Bridge Design.html': ['beam()', 'handoff()', 'geometry()', "registry('psbeam')", 'xfer()', 'project()'],
  };
  for (const [f, calls] of Object.entries(cases)) {
    const html = show(f), blocks = OLD[f].blocks.slice();
    let extra = '';
    if (f === 'lldf.html') {   // its last block went on with the page's own title-block glue, which stays inline right after the calls
      const s = `<script>\n${blocks[2]}\n`, j = html.indexOf(s);
      blocks[2] = html.slice(j + '<script>\n'.length, html.indexOf('</script>', j));
      extra = blocks[2].slice((B.xfer + '\n' + B.project).length);
      assert.ok(/lldf title block/.test(extra) && fs.readFileSync(path.join(ROOT, f), 'utf8').includes(extra.trim()));
    }
    const a = runOld(f, blocks), b = runNew(f, calls, extra);
    assert.ok(a.boot.length > 5 && !a.log.some(x => x[0] === 'error'), `${f}: the old blocks ran`);
    const k = a.boot.findIndex((x, i) => JSON.stringify(x) !== JSON.stringify(b.boot[i]));
    assert.ok(k < 0 && a.boot.length === b.boot.length, `${f}: boot log differs at ${k}: ${JSON.stringify(a.boot[k])} vs ${JSON.stringify(b.boot[k])}`);
    assert.deepEqual(b.s, a.s, `${f}: session results`);
    const q = a.log.findIndex((x, i) => !isDeepStrictEqual(x, b.log[i]));
    assert.ok(q < 0 && a.log.length === b.log.length, `${f}: log differs at ${q} of ${a.log.length}/${b.log.length}: ${JSON.stringify(a.log[q])} vs ${JSON.stringify(b.log[q])}`);
    assert.deepEqual(b.store, a.store, `${f}: storage after`);
    assert.ok(a.s.find(x => x[0] === 'shape')[1].includes('BridgeXfer'), f);
  }
  // the PS app: shared file + ui/bridgexfer.js = its old ui/bridgexfer.js (BridgeXfer only)
  const a = env('apps/ps-bridge/index.html'), b = env('apps/ps-bridge/index.html');
  vm.runInContext(show('apps/ps-bridge/ui/bridgexfer.js'), a.ctx);
  vm.runInContext(SHARED, b.ctx); vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps/ps-bridge/ui/bridgexfer.js'), 'utf8'), b.ctx);
  const ns = c => NAMES.filter(n => c[n]);
  assert.deepEqual(ns(a.ctx), ['BridgeXfer']); assert.deepEqual(ns(b.ctx), ['BridgeXfer']);
  const sa = session(a), sb = session(b); assert.deepEqual(sb, sa); assert.deepEqual(b.log, a.log); assert.deepEqual([...b.store], [...a.store]);
});
