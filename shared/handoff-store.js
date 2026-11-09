/* shared/handoff-store.js — per-project copies of cross-tool hand-offs (window.SharedHandoffStore). Classic script, no library, no DOM.
   Added 2026-11-09 (HANDOFF.md §5.1; engineer decisions 2026-11-09: "All hand-offs should be per project"; sent copies also go through
   GitHub when Cloud sync is set up). Channels move onto it one at a time; the first are superGeometry (§4.14) and superReactions (§4.4).

   What it does
   - A sender keeps one sent copy PER PROJECT (project name + bridgeId) in this browser, beside the keys it already writes (the channel key,
     its .updatedAt and its .by.<producer> copy, HANDOFF.md §2 and §4.4, unchanged, so older receivers keep working).
   - With Cloud sync (shared/github-sync.js) set up, each sent copy is also uploaded to the projects repository at
       handoffs/<channel>/<producer id>/<project id>.json
     An upload that fails (offline, rate limit) waits in a small queue and is retried at the next send or pull. Without sync nothing is
     requested and no GitHub key is written.
   - A receiver lists every copy: this browser's per-project copies, the legacy single copies it names, and (with sync) the GitHub copies,
     merged and grouped by project, newest first. A copy with no project is grouped as "earlier hand-off (no project)".
   - Nothing here applies anything: the receiver decides (HANDOFF.md §3).

   Storage (CLAUDE.md §5: new keys only, no existing key or format changed)
     bridgeSuite.v1.<channel>.by.<producer id>.<project id>   the stamped payload, exactly as published (JSON)
     bridgeSuite.v1.handoffStore.pending                      [{ channel, producer, pid }] uploads waiting (only while sync is set up)
   Project id: enc(bridgeId) + '~' + enc(name), each trimmed with inner white space collapsed; enc keeps A-Z a-z 0-9 space _ - and writes
   every other character as %XX of its UTF-8 bytes, so the id holds no '.', '/' or '~' of its own; '' when both are blank (no per-project
   copy). An id longer than 120 characters is cut to 100 and ends with '~h' + the FNV-1a hash of the whole id.

   API (Node-testable: storage, fetch and the GitHub sync namespace are passed in or read at call time)
     norm(s), enc(s), fnv(text) -> 8 hex, contentHash(obj) -> 8 hex, projectOf(payload) -> { name, bridgeId }, pidOf(project) -> id
     copyKey(channel, producer, pid), cloudPath(channel, producer, pid), fileText(payload)
     write(storage, channel, producer, payload) -> { ok, pid, key } (per-project copy only; '' pid: nothing written)
     send(o) -> Promise { ok, pid, key, cloud: { ok } | { skipped } | { error, queued } }
         o = { storage, channel, producer, payload (already stamped), fetch, sync (default window.SharedGitHubSync), now }
     local(o) -> { entries, errors }   o = { storage, channel, schema, maxVersion, producers: [ids] | null, legacy: [{ key, via }] }
     cloud(o) -> Promise { ok, entries, errors } | { off: true }   GitHub copies not already identical here (git blob sha)
     list(o) -> Promise { groups, errors, cloud: 'off' | 'ok' | <message> }   (local + cloud, grouped)
     group(entries) -> [ { pid, project, noProject, label, newest, entries } ] newest first
     match(groups, open { name, bridgeId }) -> pid | null   bridgeId match first (both non-blank), else name (case-insensitive)
     flush(o) -> Promise   retry the queued uploads
     deviceName(storage, sync) -> the Cloud sync device name when sync is set up, else ''
     Channel helpers: geometryHash(p) (HANDOFF.md §4.14 contentHash), checkGeometry(p) -> { ok, errors, warnings } (§4.14 checks),
       summary(channel, p) -> the picker's one-line summary ("3 spans, 110–140–110 ft, 5 girders") */
(function () {
  'use strict';
  const NS = 'bridgeSuite.v1.', DIR = 'handoffs', PEND = NS + 'handoffStore.pending';
  const ID_RX = /^[a-z][A-Za-z0-9]{0,40}$/;   // channel and producer ids: superGeometry, steelbridge, girderdetail, …

  const norm = s => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
  function utf8(s) {
    const out = [];
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c < 0x80) out.push(c); else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }
  /* enc(s): A-Z a-z 0-9 space _ - kept, every other character %XX (UTF-8); reversible with decodeURIComponent */
  function enc(s) {
    s = String(s); let out = '';
    for (let i = 0; i < s.length; i++) {
      let ch = s[i]; const cc = s.charCodeAt(i);
      if (cc >= 0xd800 && cc <= 0xdbff && i + 1 < s.length) { ch += s[i + 1]; i++; }
      out += /^[A-Za-z0-9 _-]$/.test(ch) ? ch : utf8(ch).map(b => '%' + (b < 16 ? '0' : '') + b.toString(16).toUpperCase()).join('');
    }
    return out;
  }
  /* fnv(text): FNV-1a 32-bit of the UTF-16 code units (as HANDOFF.md §4.6 contentHash), 8 hex digits */
  function fnv(text) {
    let h = 0x811c9dc5; const s = String(text);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(16).padStart(8, '0');
  }
  const contentHash = obj => fnv(JSON.stringify(obj));
  /* projectOf(payload): { name, bridgeId } from the envelope's project (object, or a plain string as older senders write) */
  function projectOf(p) {
    const q = p && p.project;
    if (q && typeof q === 'object') return { name: norm(q.name), bridgeId: norm(q.bridgeId) };
    return { name: norm(typeof q === 'string' ? q : ''), bridgeId: '' };
  }
  function pidOf(project) {
    const n = norm(project && project.name), b = norm(project && project.bridgeId);
    if (!n && !b) return '';
    const id = enc(b) + '~' + enc(n);
    return id.length > 120 ? id.slice(0, 100) + '~h' + fnv(id) : id;
  }
  function okIds(channel, producer) { return ID_RX.test(String(channel || '')) && ID_RX.test(String(producer || '')); }
  const copyKey = (channel, producer, pid) => `${NS}${channel}.by.${producer}.${pid}`;
  const cloudPath = (channel, producer, pid) => `${DIR}/${channel}/${producer}/${pid}.json`;
  const fileText = p => JSON.stringify(p, null, 1);
  function readJSON(storage, k) { try { const t = storage.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } }
  function syncOf(o) { return o.sync !== undefined ? o.sync : (typeof window !== 'undefined' ? window.SharedGitHubSync : null); }
  function settingsOf(o) { const G = syncOf(o); if (!G || !o.storage) return null; try { const s = G.settings(o.storage); return G.configured(s) ? s : null; } catch (e) { return null; } }
  function deviceName(storage, sync) { const s = settingsOf({ storage, sync }); return s ? String(s.device || '') : ''; }

  /* write(storage, channel, producer, payload): the per-project copy (the sender writes its legacy keys itself, as before) */
  function write(storage, channel, producer, payload) {
    if (!okIds(channel, producer)) return { ok: false, error: 'bad channel or producer id' };
    const pid = pidOf(projectOf(payload));
    if (!pid) return { ok: true, pid: '', key: null };
    const key = copyKey(channel, producer, pid);
    try { storage.setItem(key, JSON.stringify(payload)); } catch (e) { return { ok: false, pid, key, error: 'Could not save the per-project copy (storage full?): ' + e.message }; }
    return { ok: true, pid, key };
  }
  function pending(storage) { const v = readJSON(storage, PEND); return Array.isArray(v) ? v.filter(x => x && okIds(x.channel, x.producer) && x.pid) : []; }
  function setPending(storage, list) { try { if (list.length) storage.setItem(PEND, JSON.stringify(list)); else storage.removeItem(PEND); } catch (e) { /* retried later */ } }
  function queue(storage, item, on) {
    const l = pending(storage).filter(x => !(x.channel === item.channel && x.producer === item.producer && x.pid === item.pid));
    if (on) l.push({ channel: item.channel, producer: item.producer, pid: item.pid });
    setPending(storage, l);
  }
  /* upload one copy: read the folder's tree for the file's sha, then PUT (one retry on a conflict) */
  async function upload1(o, s, channel, producer, pid, payload) {
    const G = syncOf(o), c = G.client(s, o.fetch), path = cloudPath(channel, producer, pid), text = fileText(payload);
    for (let tries = 0; tries < 2; tries++) {
      const t = await c.tree(`${DIR}/${channel}`); if (!t.ok) return t;
      const sha = t.files.get(path) || null;
      if (sha && sha === G.gitSha(text)) return { ok: true, same: true };
      const nm = norm(projectOf(payload).name) || pid;
      const r = await c.put(path, text, sha, `Hand-off ${channel} from ${producer}: "${nm}"${s.device ? ` (from ${String(s.device).replace(/[()\r\n]/g, '')})` : ''}`);
      if (r.ok || r.kind !== 'conflict') return r;
    }
    return { ok: false, kind: 'conflict', message: 'The hand-off file changed on GitHub while it was being sent.' };
  }
  /* send(o): the per-project copy, then (sync set up) its upload and any queued uploads */
  async function send(o) {
    const w = write(o.storage, o.channel, o.producer, o.payload);
    if (!w.ok) return w;
    const s = settingsOf(o);
    if (!s || !w.pid) return { ...w, cloud: { skipped: true } };
    const r = await upload1(o, s, o.channel, o.producer, w.pid, o.payload);
    queue(o.storage, { channel: o.channel, producer: o.producer, pid: w.pid }, !r.ok);
    if (r.ok) await flush(o);
    return { ...w, cloud: r.ok ? { ok: true } : { error: r.message || 'upload failed', queued: true } };
  }
  async function flush(o) {
    const s = settingsOf(o); if (!s) return { skipped: true };
    let n = 0;
    for (const it of pending(o.storage)) {
      const p = readJSON(o.storage, copyKey(it.channel, it.producer, it.pid));
      if (!p) { queue(o.storage, it, false); continue; }
      const r = await upload1(o, s, it.channel, it.producer, it.pid, p);
      if (!r.ok) return { ok: false, sent: n, error: r.message };
      queue(o.storage, it, false); n++;
    }
    return { ok: true, sent: n };
  }

  function validate(p, schema, maxVersion) {
    if (!p || typeof p !== 'object') return 'not a hand-off object';
    if (p._schema !== schema) return `wrong data type (${p._schema || 'none'}), expected ${schema}`;
    if (!(p.schemaVersion <= (maxVersion || 1))) return `newer format (v${p.schemaVersion}) than this tool supports (v${maxVersion || 1})`;
    return null;
  }
  function keys(storage) { const out = []; try { for (let i = 0; i < storage.length; i++) { const k = storage.key(i); if (k != null) out.push(k); } } catch (e) { /* none */ } return out; }
  /* local(o): this browser's per-project copies of the channel (producers filter) and the legacy keys named in o.legacy */
  function local(o) {
    const entries = [], errors = [], pre = `${NS}${o.channel}.by.`, prods = Array.isArray(o.producers) ? o.producers : null;
    keys(o.storage).forEach(k => {
      if (k.indexOf(pre) !== 0) return; const rest = k.slice(pre.length), dot = rest.indexOf('.'); if (dot < 1) return;
      const producer = rest.slice(0, dot), pid = rest.slice(dot + 1);
      if (pid.indexOf('~') < 0 || !ID_RX.test(producer) || (prods && prods.indexOf(producer) < 0)) return;
      let p = null; try { p = JSON.parse(o.storage.getItem(k)); } catch (e) { errors.push(`${producer} copy "${pid}": stored hand-off is corrupt`); return; }
      const err = validate(p, o.schema, o.maxVersion); if (err) { errors.push(`${producer} copy "${pid}": ${err}`); return; }
      entries.push({ key: k, via: 'this browser', source: 'local', producer, pid, payload: p });
    });
    (o.legacy || []).forEach(l => {
      let t = null; try { t = o.storage.getItem(l.key); } catch (e) { t = null; }
      if (!t) return; let p = null; try { p = JSON.parse(t); } catch (e) { errors.push(`${l.via || l.key}: stored hand-off is corrupt`); return; }
      const err = validate(p, o.schema, o.maxVersion); if (err) { errors.push(`${l.via || l.key}: ${err}`); return; }
      entries.push({ key: l.key, via: l.via || 'this browser', source: 'legacy', producer: l.producer || '', pid: pidOf(projectOf(p)), payload: p });
    });
    return { entries, errors };
  }
  /* cloud(o): GitHub copies under handoffs/<channel>/; a file identical to this browser's copy (same git blob sha) is not downloaded */
  async function cloud(o) {
    const s = settingsOf(o); if (!s) return { off: true, entries: [], errors: [] };
    const G = syncOf(o), c = G.client(s, o.fetch), dir = `${DIR}/${o.channel}`, prods = Array.isArray(o.producers) ? o.producers : null;
    const t = await c.tree(dir); if (!t.ok) return { ok: false, entries: [], errors: [t.message || 'GitHub could not be read'] };
    const mine = new Map(); (o.localEntries || []).filter(e => e.source === 'local').forEach(e => mine.set(cloudPath(o.channel, e.producer, e.pid), G.gitSha(fileText(e.payload))));
    const entries = [], errors = [];
    for (const [path, sha] of t.files) {
      const parts = path.slice(dir.length + 1).split('/'); if (parts.length !== 2 || !/\.json$/.test(parts[1])) continue;
      const producer = parts[0], pid = parts[1].slice(0, -5);
      if (!ID_RX.test(producer) || pid.indexOf('~') < 0 || (prods && prods.indexOf(producer) < 0)) continue;
      if (mine.get(path) === sha) { (o.localEntries || []).forEach(e => { if (e.source === 'local' && e.producer === producer && e.pid === pid) e.synced = true; }); continue; }
      const r = await c.raw(path); if (!r.ok) { errors.push(`GitHub ${producer}/${pid}: ${r.message}`); continue; }
      let p = null; try { p = JSON.parse(r.text); } catch (e) { errors.push(`GitHub ${producer}/${pid}: not valid JSON`); continue; }
      const err = validate(p, o.schema, o.maxVersion); if (err) { errors.push(`GitHub ${producer}/${pid}: ${err}`); continue; }
      entries.push({ key: path, via: 'GitHub', source: 'github', producer, pid, payload: p });
    }
    return { ok: true, entries, errors };
  }
  const at = e => String((e && e.payload && e.payload.producedAt) || '');
  /* group(entries): one group per project id, the copies newest first; the same payload (producer + producedAt) listed once, a
     per-project copy before a legacy or GitHub copy of it */
  function group(entries) {
    const rank = { local: 0, github: 1, legacy: 2 }, by = new Map();
    entries.slice().sort((a, b) => at(b).localeCompare(at(a)) || (rank[a.source] - rank[b.source])).forEach(e => {
      const g = by.get(e.pid) || { pid: e.pid, entries: [], seen: {} };
      const id = (e.payload.producer || '') + '|' + at(e); if (g.seen[id]) return; g.seen[id] = 1;
      g.entries.push(e); by.set(e.pid, g);
    });
    const out = [...by.values()].map(g => { const n = g.entries[0], pr = projectOf(n.payload);
      return { pid: g.pid, project: pr, noProject: !g.pid, newest: n, entries: g.entries,
        label: g.pid ? [pr.bridgeId, pr.name].filter(Boolean).join(' — ') : 'earlier hand-off (no project)' }; });
    return out.sort((a, b) => at(b.newest).localeCompare(at(a.newest)));
  }
  async function list(o) {
    const L = local(o); let cl = 'off', C = { entries: [], errors: [] };
    if (settingsOf(o)) { try { await flush(o); } catch (e) { /* queued */ } C = await cloud({ ...o, localEntries: L.entries }); cl = C.ok ? 'ok' : (C.errors[0] || 'GitHub could not be read'); }
    return { groups: group(L.entries.concat(C.entries)), errors: L.errors.concat(C.errors), cloud: cl };
  }
  function match(groups, open) {
    const b = norm(open && open.bridgeId).toLowerCase(), n = norm(open && open.name).toLowerCase();
    if (b) { const g = groups.find(x => x.pid && x.project.bridgeId.toLowerCase() === b); if (g) return g.pid; }
    if (n) { const g = groups.find(x => x.pid && x.project.name.toLowerCase() === n); if (g) return g.pid; }
    return null;
  }

  /* ---------- channel helpers (HANDOFF.md §4.14, §4.4): the checks and the one-line summary the picker shows ---------- */
  const isN = v => typeof v === 'number' && isFinite(v);
  const GEO_UNITS = { length: 'ft', skew: 'deg', deck: 'in', section: 'in' };
  /* geometryHash(p): the §4.14 content hash of a superGeometry payload (its geometry only; not the envelope or the notes) */
  const geometryHash = p => contentHash({ spans: p.spans, supports: p.supports, girders: p.girders, edges: p.edges, deck: p.deck, section: p.section, ownerRules: p.ownerRules || null });
  /* checkGeometry(p): HANDOFF.md §4.14 validation -> { ok, errors: [..], warnings: [..] } (receivers add their own limits) */
  function checkGeometry(p) {
    const E = [], W = [], vErr = validate(p, 'bridge-super-geometry', 1);
    if (vErr) return { ok: false, errors: [vErr], warnings: W };
    const u = p.units || {};
    Object.keys(GEO_UNITS).forEach(k => { if (u[k] !== GEO_UNITS[k]) E.push(`unit of ${k} is "${u[k] == null ? 'not stated' : u[k]}"; expected ${GEO_UNITS[k]}`); });
    ['curb', 'height'].forEach(k => { if (u[k] != null && u[k] !== 'in') E.push(`unit of ${k} is "${u[k]}"; expected in`); });
    const sp = p.spans;
    if (!Array.isArray(sp) || !sp.length || !sp.every(v => isN(v) && v > 0)) E.push('spans: every span must be a positive number (ft)');
    const ns = Array.isArray(sp) ? sp.length : 0, S = p.supports;
    if (!Array.isArray(S) || S.length !== ns + 1) E.push(`supports: expected ${ns + 1} (one more than the spans), got ${Array.isArray(S) ? S.length : 'none'}`);
    else S.forEach((s, k) => { const id = (s && s.id) || `support ${k + 1}`;
      if (!s || !isN(s.skew) || !(Math.abs(s.skew) < 90)) E.push(`${id}: skew must be a number of degrees between −90 and 90`);
      if (s && s.x != null && !isN(s.x)) E.push(`${id}: x is not a number`);
      if (s && ['end', 'continuous', 'joint'].indexOf(s.joint) < 0) E.push(`${id}: joint must be end, continuous or joint`);
      if (s && s.depth != null && !(isN(s.depth) && s.depth > 0)) E.push(`${id}: depth must be a positive number (in)`);
      if (s && s.bearings != null) { const b = s.bearings; if (!b || ['fixed', 'expansion'].indexOf(b.long) < 0 || ['fixed', 'free'].indexOf(b.trans) < 0) E.push(`${id}: bearings must be { long: fixed | expansion, trans: fixed | free }`); } });
    const g = p.girders || {};
    if (!(Number.isInteger(g.count) && g.count >= 1)) E.push('girders.count must be a whole number of 1 or more');
    else if (!Array.isArray(g.spacings) || g.spacings.length !== g.count - 1 || !g.spacings.every(v => isN(v) && v > 0)) E.push(`girders.spacings: expected ${g.count - 1} positive spacings (ft)`);
    ['ohL', 'ohR'].forEach(k => { if (!(isN(g[k]) && g[k] >= 0)) E.push(`girders.${k} must be zero or a positive number (ft)`); });
    const ed = p.edges || {};
    ['L', 'R'].forEach(sd => { const e = ed[sd]; if (!e) { E.push(`edges.${sd} is missing`); return; }
      if (!(isN(e.width) && e.width >= 0)) E.push(`edges.${sd}.width must be zero or a positive number (ft)`);
      if (e.height != null && !(isN(e.height) && e.height > 0)) E.push(`edges.${sd}.height must be a positive number (in) or null`); });
    const d = p.deck || {};
    if (!(isN(d.ts) && d.ts > 0)) E.push('deck.ts must be a positive number (in)');
    if (!(isN(d.haunch) && d.haunch >= 0)) E.push('deck.haunch must be zero or a positive number (in)');
    const c = p.section || {};
    ['depth', 'bf', 'tf', 'tw'].forEach(k => { if (!(isN(c[k]) && c[k] > 0)) E.push(`section.${k} must be a positive number (in)`); });
    if (c.atSupports != null && (!Array.isArray(c.atSupports) || c.atSupports.length !== ns + 1 || !c.atSupports.every(v => isN(v) && v > 0))) E.push('section.atSupports: one positive depth per support (in)');
    if (c.spanMax != null && (!Array.isArray(c.spanMax) || c.spanMax.length !== ns || !c.spanMax.every(v => isN(v) && v > 0))) E.push('section.spanMax: one positive depth per span (in)');
    if (!E.length && p.contentHash != null && p.contentHash !== geometryHash(p)) W.push('The content hash does not match the geometry (the file was edited after it was sent).');
    return { ok: !E.length, errors: E, warnings: W };
  }
  const fmt = v => (Math.round(v * 100) / 100).toString();
  /* summary(channel, p): one line for the picker, e.g. "3 spans, 110–140–110 ft, 5 girders" */
  function summary(channel, p) {
    try {
      if (channel === 'superGeometry') { const n = p.spans.length, gc = p.girders && p.girders.count;
        return `${n} span${n === 1 ? '' : 's'}, ${p.spans.map(fmt).join('–')} ft${gc ? `, ${gc} girder${gc === 1 ? '' : 's'}` : ''}`; }
      if (channel === 'superReactions') { const S = p.supports || [], gl = new Set(); S.forEach(s => (s.girders || []).forEach(g => gl.add(g.label)));
        const L = p.span && isN(p.span.length) ? `, ${fmt(p.span.length)} ft` : '';
        return `reactions at ${S.length} support${S.length === 1 ? '' : 's'}${L}, ${gl.size} girder${gl.size === 1 ? '' : 's'}${p.allGirders ? '' : (p.girderLine && p.girderLine.label ? ` (${p.girderLine.label})` : '')}`; }
    } catch (e) { /* below */ }
    return '';
  }

  window.SharedHandoffStore = { NS, DIR, PEND, norm, enc, fnv, contentHash, projectOf, pidOf, copyKey, cloudPath, fileText, write, send, flush, pending,
    validate, local, cloud, group, list, match, deviceName, geometryHash, checkGeometry, summary };
})();
