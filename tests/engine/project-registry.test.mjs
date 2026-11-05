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
    assert.ok(new RegExp(`cloud:\\s*\\{\\s*tool:\\s*'${e.tool}',\\s*label:\\s*'${e.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}'`).test(src), `${e.tool}: ctx.cloud tool / label in ${e.href}`);
    assert.equal(R.get(e.tool).key, e.key);
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
