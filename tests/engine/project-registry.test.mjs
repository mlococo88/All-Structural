// shared/project-registry.js (HSP, 2026-11-05): where each tool keeps its saved-project list, for the home page (tools.html).
// Checks: one entry per tool folder; each entry's page exists, and that page passes the same key, ctx.cloud tool and label (a
// drift guard: the browser test tests/smoke/home-projects.mjs checks the listed names / times against each tool's own dialog);
// list() reads only (storage unchanged) and reports an unreadable list without changing it.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const W = loadShared('projects.js', 'project-registry.js'), R = W.SharedProjectRegistry;
function mem(init) {
  const m = new Map(Object.entries(init || {}));
  return { m, getItem: k => m.has(k) ? m.get(k) : null, setItem: (k, v) => { m.set(k, String(v)); }, removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
}

test('project-registry: one entry per tool; its page passes the same key, tool and label', () => {
  const all = R.all(); assert.ok(all.length >= 14);
  assert.equal(new Set(all.map(e => e.tool)).size, all.length, 'tool folders unique');
  assert.equal(new Set(all.map(e => e.key)).size, all.length, 'keys unique');
  for (const e of all) {
    assert.match(e.tool, /^[a-z0-9][a-z0-9-]{0,60}$/);
    const file = path.join(ROOT, decodeURIComponent(e.href.split('#')[0]));
    assert.ok(fs.existsSync(file), e.href);
    const src = fs.readFileSync(e.def ? path.join(ROOT, e.def) : file, 'utf8').replace(/&quot;/g, '"');   // def (BSS): a list shared by several pages
    // a folder app with a view (Steel Bridge app): its key is defined in one of the app's own .js files (engine/model.js KEYS)
    const keySrc = e.view ? src + fs.readdirSync(path.dirname(file), { recursive: true }).filter(f => /\.js$/.test(f)).map(f => fs.readFileSync(path.join(path.dirname(file), f), 'utf8')).join('\n') : src;
    assert.ok(keySrc.includes(`'${e.key}'`) || keySrc.includes(`"${e.key}"`), `${e.tool}: key ${e.key} in ${e.href}`);
    assert.ok(new RegExp(`cloud:\\s*\\{\\s*tool:\\s*(['"])${e.tool}\\1,\\s*label:\\s*(['"])${e.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\2`).test(src), `${e.tool}: ctx.cloud tool / label in ${e.href}`);
    assert.equal(R.get(e.tool).key, e.key);
    const blk = src.slice(src.search(new RegExp(`cloud:\\s*\\{\\s*tool:\\s*['"]${e.tool}['"]`))).slice(0, 220), sp = /space:\s*(\d)/.exec(blk.split('fromFile')[0]);
    assert.equal(sp ? Number(sp[1]) : undefined, e.space, `${e.tool}: ctx.cloud space`);
    assert.equal(/toFile:/.test(blk.split('fromFile')[0]), !!e.toFile, `${e.tool}: ctx.cloud has a toFile exactly when the entry has one`);
  }
  assert.equal(R.get('nope'), null);
});

test('project-registry: list() reads only; an unreadable list is reported and kept', () => {
  const sf = R.get('spread-footing'), mlg = R.get('moving-load-generator');
  const s = mem({ sfd_projects: '{"B":{"x":1},"A":{"y":2}}', 'movingLoadGen.projects.v1': '{"old":{"savedAt":"2026-01-01T00:00:00Z"},"new":{"savedAt":"2026-11-01T00:00:00Z"}}' });
  const before = JSON.stringify([...s.m]);
  const a = R.list(sf, s); assert.equal(a.ok, true); assert.equal(a.items.map(i => i.name).join(), 'A,B'); assert.equal(a.items[0].saved, null);
  const b = R.list(mlg, s); assert.equal(b.items.map(i => i.name).join(), 'new,old'); assert.equal(b.items[0].saved, '2026-11-01T00:00:00Z');   // newest first, as the tool
  assert.equal(R.list(R.get('timber-beam-check'), s).items.length, 0);
  s.setItem('sfd_projects', '{bad'); const c = R.list(sf, s); assert.equal(c.ok, false); assert.equal(c.error, 'unreadable'); assert.equal(s.getItem('sfd_projects'), '{bad');
  s.setItem('sfd_projects', '{"B":{"x":1},"A":{"y":2}}');
  assert.equal(JSON.stringify([...s.m]), before);
  assert.equal(R.list(sf, null).items.length, 0);
});

// HSP PR 2: fileText = what the tool's own engine makes; the home page's engine and a tool's engine share the bookkeeping, so after the
// home page's Upload all a tool finds every project synced and uploads nothing.
import { makeGitHubMock } from './gh-mock.mjs';
const G2 = loadShared('projects.js', 'github-sync.js', 'project-registry.js'), R2 = G2.SharedProjectRegistry, GS = G2.SharedGitHubSync, SP2 = G2.SharedProjects;
const TOKEN = 'github_pat_TESTTOKEN0123456789abcd';

test('project-registry: fileText equals the engine file text; home Upload all then the tool engine: synced, no upload', async () => {
  const items = {
    'spread-footing': { geom: { B: 6 }, soil: {}, peds: [] }, 'gusset-plate-rating': { members: [{ pattern: 'custom' }], meta: {} },
    'light-pole-sign-post': { V: 115 }, 'retaining-wall-designer': { fields: { H: 12 }, ts: 1 }, 'base-plate-anchor': { plate: {}, anchor: {}, conc: {} },
    'abutment-calculator': { state: { geom: {}, proj: {} }, ts: 2 }, 'timber-beam-check': { t: 3, d: { b: 1 } },
    'concrete-beam-asd': { when: '2026-11-06T02:00:00.000Z', data: { loads: {}, allow: {} } }   // STDS: { when, data }, the file = data
  };
  for (const e of R2.all().filter(x => !x.view)) {   // the view entry (Steel Bridge app): its own test below
    const s = mem(); assert.equal(GS.saveSettings(s, { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN }).ok, true);
    const item = items[e.tool] || (e.toFile && /\.d\b/.test(String(e.toFile)) ? { t: 1, d: { x: 1 } } : e.toFile && /\.state\b/.test(String(e.toFile)) ? { state: { x: 1 }, ts: 1 } : { x: 1, 'ü': '✓' });
    s.setItem(e.key, JSON.stringify({ 'P 1/ü': item }));
    const gh = makeGitHubMock({ token: TOKEN });
    const home = R2.engine(e, s, gh.fetch);
    assert.equal(R2.fileText(e, item, 'P 1/ü'), home.fileText('P 1/ü'), e.tool);
    const r = await home.uploadAll(); assert.equal(r.ok, true); assert.equal(r.done, 1, e.tool);
    assert.equal(gh.files.get(`projects/${e.tool}/P 1%2F%C3%BC.json`), R2.fileText(e, item, 'P 1/ü'));
    // the tool's own engine (its ctx.cloud = the registry's toFile / space): nothing to upload, status synced
    const tool = GS.engine({ tool: e.tool, label: e.label, store: SP2.mapStore(s, e.key), storage: s, fetch: gh.fetch, toFile: e.toFile, space: e.space });
    const n0 = gh.log.length; tool.scan(); await tool.flush(true); await tool.refreshCloud();
    assert.equal(gh.log.slice(n0).filter(l => l.method !== 'GET').length, 0, e.tool);
    assert.equal(tool.statusOf('P 1/ü'), 'synced', e.tool);
    assert.equal(s.getItem(e.key), JSON.stringify({ 'P 1/ü': item }), 'the tool list unchanged');
  }
});

test('project-registry: the home engine never downloads into a tool list', async () => {
  const e = R2.get('spread-footing'), s = mem(); GS.saveSettings(s, { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN });
  const gh = makeGitHubMock({ token: TOKEN }); gh.setRemote('projects/spread-footing/X.json', '{"geom":{},"soil":{},"peds":[]}');
  const r = await R2.engine(e, s, gh.fetch).download('X'); assert.equal(r.ok, false); assert.equal(s.getItem('sfd_projects'), null);
});

// GHS2 (2026-11-05): the Steel Bridge app's list is not a mapStore (engine/library.js: items by id); the registry reads it through a
// by-name view. Its file is the stored item text; the home Upload all then the app's own engine view (same rule: newest item per name)
// finds it synced; a second item with the same name (older) is not listed; nothing is written to the app's keys.
test('project-registry: Steel Bridge app view (items by id): list, file text, home upload then synced; reads only', async () => {
  const e = R2.get('steel-bridge-app'), s = mem(); GS.saveSettings(s, { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN });
  const t1 = '{\n  "schema": "sbd2",\n  "project": {\n    "name": "Mill River"\n  }\n}', t0 = '{"schema":"sbd2","project":{"name":"Mill River","old":1}}', t2 = '{"schema":"sbd2","project":{"name":"Alt ü"}}';
  s.setItem('sbd2.lib.index', JSON.stringify({ schema: 'sbd2.library', version: 1, items: [{ id: 'pa', name: 'Mill River', saved: '2026-11-01T00:00:00Z', size: t0.length },
    { id: 'pb', name: 'Mill River', saved: '2026-11-05T00:00:00Z', size: t1.length }, { id: 'pc', name: 'Alt ü', saved: '2026-11-03T00:00:00Z', size: t2.length }] }));
  s.setItem('sbd2.lib.p.pa', t0); s.setItem('sbd2.lib.p.pb', t1); s.setItem('sbd2.lib.p.pc', t2);
  const before = JSON.stringify([...s.m].filter(([k]) => k.startsWith('sbd2.')));
  const l = R2.list(e, s); assert.equal(l.ok, true); assert.equal(l.items.map(i => i.name).join('|'), 'Mill River|Alt ü'); assert.equal(l.items[0].saved, '2026-11-05T00:00:00Z');
  assert.equal(R2.fileText(e, R2.store(e, s).item('Mill River'), 'Mill River'), t1, 'the newest item of the name, its text as stored');
  const gh = makeGitHubMock({ token: TOKEN }), home = R2.engine(e, s, gh.fetch);
  const r = await home.uploadAll(); assert.equal(r.ok, true); assert.equal(r.done, 2);
  assert.equal(gh.files.get('projects/steel-bridge-app/Mill River.json'), t1); assert.equal(gh.files.get('projects/steel-bridge-app/Alt %C3%BC.json'), t2);
  const tool = GS.engine({ tool: e.tool, label: e.label, store: R2.store(e, s), storage: s, fetch: gh.fetch, toFile: t => t });
  const n0 = gh.log.length; tool.scan(); await tool.flush(true); await tool.refreshCloud();
  assert.equal(gh.log.slice(n0).filter(x => x.method !== 'GET').length, 0); assert.equal(tool.statusOf('Mill River'), 'synced');
  // a conflict found from the home page: nothing kept, nothing uploaded (the view refuses duplicate)
  gh.setRemote('projects/steel-bridge-app/Alt %C3%BC.json', '{"other":1}'); s.setItem('sbd2.lib.p.pc', t2.replace('Alt', 'Alt '));
  const n1 = gh.log.length; home.scan(true); const f = await home.flush(true); assert.equal(f.ok, false);
  assert.equal(gh.log.slice(n1).filter(x => x.method !== 'GET').length, 0); assert.equal(gh.files.get('projects/steel-bridge-app/Alt %C3%BC.json'), '{"other":1}');
  s.setItem('sbd2.lib.p.pc', t2);
  assert.equal(JSON.stringify([...s.m].filter(([k]) => k.startsWith('sbd2.'))), before, 'the app keys unchanged');
  s.setItem('sbd2.lib.index', '{bad'); const u = R2.list(e, s); assert.equal(u.ok, false); assert.equal(u.error, 'unreadable'); assert.equal(s.getItem('sbd2.lib.index'), '{bad');
});

// BSS (2026-11-06): the Bridge Suite's shared list (bridgeSuite.v1.projects, entries by id, duplicate names): the home page's view and
// file text equal the suite's own (shared/bridge-suite-projects.js ghStore + toFile); home Upload all, then the suite's engine: synced.
test('project-registry: Bridge Suite view (entries by id): newest of a name, file text = the suite\'s own, home upload then synced; reads only', async () => {
  const W3 = loadShared('projects.js', 'github-sync.js', 'project-registry.js', 'bridge-suite-projects.js'), R3 = W3.SharedProjectRegistry, BS = W3.SharedBridgeSuite, G3 = W3.SharedGitHubSync;
  const e = R3.get('bridge-suite'), s = mem(); G3.saveSettings(s, { owner: 'mlococo88', repo: 'structural-projects', branch: 'main', token: TOKEN });
  const reg = { bp_a: { name: 'Mill River', savedAt: '2026-11-01T00:00:00.000Z', slices: { mct: { a: 1 } } },
    bp_b: { name: 'Mill River', savedAt: '2026-11-05T00:00:00.000Z', slices: { mct: { a: 2 }, lldf: { b: 'ü' } }, demands: { big: [1, 2] } },
    bp_c: { name: 'Alt', savedAt: '2026-11-03T00:00:00.000Z', slices: { psbeam: { c: 3 } } } };
  s.setItem('bridgeSuite.v1.projects', JSON.stringify(reg)); const before = s.getItem('bridgeSuite.v1.projects');
  const l = R3.list(e, s); assert.equal(l.ok, true); assert.equal(l.items.map(i => i.name).sort().join('|'), 'Alt|Mill River');
  assert.equal(l.items.find(i => i.name === 'Mill River').saved, '2026-11-05T00:00:00.000Z');
  const own = BS.store({ storage: s }).ghStore;
  const txt = R3.fileText(e, R3.store(e, s).item('Mill River'), 'Mill River');
  assert.equal(txt, JSON.stringify(BS.toFile(own.item('Mill River'), 'Mill River'), null, 1), 'the same text as the suite');
  assert.deepEqual(JSON.parse(txt), { app: 'BridgeSuite', v: 1, name: 'Mill River', savedAt: '2026-11-05T00:00:00.000Z', slices: { mct: { a: 2 }, lldf: { b: 'ü' } } }, 'the newest entry, no demands');
  const gh = makeGitHubMock({ token: TOKEN }), home = R3.engine(e, s, gh.fetch);
  const r = await home.uploadAll(); assert.equal(r.ok, true); assert.equal(r.done, 2);
  const tool = G3.engine({ tool: 'bridge-suite', label: e.label, store: own, storage: s, fetch: gh.fetch, toFile: BS.toFile, fromFile: BS.fromFile, settle: BS.SETTLE });
  const n0 = gh.log.length; tool.scan(); await tool.flush(true, true); await tool.refreshCloud();
  assert.equal(gh.log.slice(n0).filter(x => x.method !== 'GET').length, 0); assert.equal(tool.statusOf('Mill River'), 'synced'); assert.equal(tool.statusOf('Alt'), 'synced');
  assert.equal(s.getItem('bridgeSuite.v1.projects'), before, 'the suite list unchanged');
  // a file from GitHub into the suite's list: the newest entry of the name, its demands kept
  gh.setRemote('projects/bridge-suite/Mill River.json', JSON.stringify({ app: 'BridgeSuite', v: 1, name: 'Mill River', savedAt: '2026-11-06T00:00:00.000Z', slices: { mct: { a: 9 } } }, null, 1));
  await tool.refreshCloud(); const d = await tool.useCloud('Mill River'); assert.equal(d.ok, true);
  const after = JSON.parse(s.getItem('bridgeSuite.v1.projects'));
  assert.deepEqual(after.bp_b, { name: 'Mill River', savedAt: '2026-11-06T00:00:00.000Z', slices: { mct: { a: 9 } }, demands: { big: [1, 2] } });
  assert.deepEqual(after.bp_a, reg.bp_a); assert.deepEqual(after.bp_c, reg.bp_c);
  assert.throws(() => BS.fromFile({ cfg: {} }, 'x'));
});
