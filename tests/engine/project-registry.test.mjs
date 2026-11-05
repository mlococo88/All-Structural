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
    const src = fs.readFileSync(file, 'utf8').replace(/&quot;/g, '"');
    assert.ok(src.includes(`'${e.key}'`) || src.includes(`"${e.key}"`), `${e.tool}: key ${e.key} in ${e.href}`);
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
    'abutment-calculator': { state: { geom: {}, proj: {} }, ts: 2 }, 'timber-beam-check': { t: 3, d: { b: 1 } }
  };
  for (const e of R2.all()) {
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
