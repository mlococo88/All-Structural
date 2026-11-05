/* shared/github-sync.js — copy the tools' saved projects to a PRIVATE GitHub repository (window.SharedGitHubSync). Classic script,
   no library. Added 2026-11-05 (engineer request: see the same projects on every device; GitHub chosen over Firebase).
   Setup for the engineer: docs/github-sync-setup.md.

   What it does
   - The browser's saved-project list stays the working copy. A tool works offline and with sync off exactly as before: with no
     settings saved, this file makes no request and writes nothing.
   - With sync on, each named project of the tool's list (shared/projects.js mapStore, the tool's OWN key and format, unchanged)
     is written to  projects/<tool>/<safe name>.json  in the repository, in the tool's JSON export format (importable by hand).
     Autosave is not synced.
   - Changes are found by reading the tool's list every few seconds (any save path of the tool counts: its own Save button, the
     dialog's Rename / Duplicate, a cloud download) and uploaded in the background; offline or refused uploads wait in a queue.
   - Never overwrites silently: an upload goes with the file's last known sha. When the file changed on GitHub since this browser
     last synced it (or GitHub answers 409 / 422), both are kept: ours is saved as "<name> (conflict <device> <date>)" in this
     browser and on GitHub, and the user is told.
   - Never deletes on GitHub implicitly: deleting a project in the dialog asks whether to delete the GitHub copy too, and
     GitHub-only projects have their own "Delete from GitHub" button (with a confirm).

   Storage (CLAUDE.md §5: new keys only; no tool key or format is touched)
     bridgeSuite.v1.githubSync              { owner, repo, branch, token, device }   one setup for every tool of this browser
     bridgeSuite.v1.githubSync.tool.<tool>  { v:1, base:{name:{c,l}}, seen:{name:l}, queue:[name], asked, conflicts:{name:{...}}, lock }
       c = git blob sha of the file on GitHub, l = git blob sha of this browser's file text, at the last sync.

   Security: the token is sent only in the Authorization header of requests to https://api.github.com (the only host this file
   calls), never in a URL, never logged, never shown (mask()), never part of a project file. It IS stored in this browser's
   storage (said in the dialog).

   API (Node-testable without a DOM: settings, mask, safeName, nameOf, gitSha, b64, client, engine)
     settings(storage) / saveSettings(storage, s) / forgetToken(storage) / configured(s)
     client(settings, fetch) -> { repo(), branch(), tree(dir), list(dir), meta(path), raw(path), put(path, text, sha, message), del(path, sha, message) }
     engine({ tool, label, store, storage, fetch, toFile, fromFile, space, now, device, onNotice }) -> see below
     attach(ctx) -> the hooks shared/projects-ui.js libraryDialog calls when ctx.cloud = { tool, label, toFile?, fromFile?, space? } */
(function () {
  'use strict';
  const API = 'https://api.github.com';
  const KEY = 'bridgeSuite.v1.githubSync';
  const DIR = 'projects';
  const NAME_RX = /^[A-Za-z0-9_.-]{1,100}$/, TOOL_RX = /^[a-z0-9][a-z0-9-]{0,60}$/, TOKEN_RX = /^[A-Za-z0-9_]{10,255}$/;

  /* ---------------- settings ---------------- */
  function readJSON(storage, k) { try { const t = storage && storage.getItem(k); if (!t) return null; const v = JSON.parse(t); return v && typeof v === 'object' ? v : null; } catch (e) { return null; } }
  function writeJSON(storage, k, v) { try { storage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } }
  function settings(storage) {
    const s = readJSON(storage, KEY) || {};
    return { owner: String(s.owner || ''), repo: String(s.repo || ''), branch: String(s.branch || 'main'), token: String(s.token || ''), device: String(s.device || '') };
  }
  const configured = s => !!(s && s.owner && s.repo && s.token);
  function validBranch(b) { return /^[A-Za-z0-9._\/-]{1,200}$/.test(b) && !/\.\.|\/\/|^\/|\/$|\.lock$|^-/.test(b); }
  /* saveSettings(storage, { owner, repo, branch, token, device }): token '' keeps the saved token. Returns { ok, message } */
  function saveSettings(storage, s) {
    const old = settings(storage);
    const n = { owner: String(s.owner || '').trim(), repo: String(s.repo || '').trim(), branch: String(s.branch || '').trim() || 'main',
      token: String(s.token || '').trim() || old.token, device: String(s.device || '').trim().slice(0, 40) };
    if (!NAME_RX.test(n.owner)) return { ok: false, message: 'Enter the GitHub account name (letters, digits, - _ .).' };
    if (!NAME_RX.test(n.repo)) return { ok: false, message: 'Enter the repository name (letters, digits, - _ .).' };
    if (!validBranch(n.branch)) return { ok: false, message: 'The branch name is not valid.' };
    if (n.token && !TOKEN_RX.test(n.token)) return { ok: false, message: 'That does not look like a GitHub token (it should start with github_pat_ and have no spaces).' };
    if (!writeJSON(storage, KEY, n)) return { ok: false, message: 'Browser storage refused the write (full, or blocked).' };
    return { ok: true };
  }
  function forgetToken(storage) { const s = settings(storage); s.token = ''; return writeJSON(storage, KEY, s); }
  /* mask(token): never the token itself; the last 4 characters only */
  function mask(t) { t = String(t || ''); return t ? (t.startsWith('github_pat_') ? 'github_pat_' : '') + '••••••••' + t.slice(-4) : ''; }

  /* ---------------- names and files ---------------- */
  const SAFE = /[A-Za-z0-9 _\-.(),+&'!~=@]/;
  function utf8(s) {   // string -> array of byte values
    const out = []; s = String(s);
    for (let i = 0; i < s.length; i++) {
      let c = s.charCodeAt(i);
      if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) { const d = s.charCodeAt(i + 1); if (d >= 0xdc00 && d <= 0xdfff) { c = 0x10000 + ((c - 0xd800) << 10) + (d - 0xdc00); i++; } }
      if (c < 0x80) out.push(c); else if (c < 0x800) out.push(0xc0 | c >> 6, 0x80 | c & 63);
      else if (c < 0x10000) out.push(0xe0 | c >> 12, 0x80 | c >> 6 & 63, 0x80 | c & 63);
      else out.push(0xf0 | c >> 18, 0x80 | c >> 12 & 63, 0x80 | c >> 6 & 63, 0x80 | c & 63);
    }
    return out;
  }
  function fromUtf8(b) {
    let s = '';
    for (let i = 0; i < b.length;) {
      const x = b[i++]; let c;
      if (x < 0x80) c = x; else if (x < 0xe0) c = (x & 31) << 6 | b[i++] & 63;
      else if (x < 0xf0) { c = (x & 15) << 12 | (b[i++] & 63) << 6; c |= b[i++] & 63; }
      else { c = (x & 7) << 18 | (b[i++] & 63) << 12; c |= (b[i++] & 63) << 6; c |= b[i++] & 63; }
      if (c > 0xffff) { c -= 0x10000; s += String.fromCharCode(0xd800 + (c >> 10), 0xdc00 + (c & 1023)); } else s += String.fromCharCode(c);
    }
    return s;
  }
  /* safeName(project name) -> file stem: letters, digits and  _-.(),+&'!~=@ and inner spaces kept; anything else as %XX (UTF-8),
     so nameOf() gives the project name back exactly. A leading / trailing space or dot is encoded too. */
  function safeName(name) {
    const s = String(name); let out = '';
    for (let i = 0; i < s.length; i++) {
      let ch = s[i]; const cc = s.charCodeAt(i);
      if (cc >= 0xd800 && cc <= 0xdbff && i + 1 < s.length) { ch += s[i + 1]; i++; }
      const edge = (i === 0 || i === s.length - 1) && (ch === ' ' || ch === '.');
      out += ch.length === 1 && SAFE.test(ch) && !edge ? ch : utf8(ch).map(b => '%' + (b < 16 ? '0' : '') + b.toString(16).toUpperCase()).join('');
    }
    return out;
  }
  function nameOf(file) {   // 'Footing%2FA.json' -> 'Footing/A'; null when not one of ours
    if (!/\.json$/.test(file)) return null;
    try { const n = decodeURIComponent(file.slice(0, -5)); return n && safeName(n) === file.slice(0, -5) ? n : null; } catch (e) { return null; }
  }

  /* gitSha(text): the git blob sha-1 of the UTF-8 text (what GitHub reports as a file's sha), so a file can be compared without
     downloading it. Plain SHA-1 (FIPS 180-4) on bytes. */
  function sha1(bytes) {
    const l = bytes.length, words = [], H = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
    for (let i = 0; i < l; i++) words[i >> 2] |= bytes[i] << (24 - (i & 3) * 8);
    words[l >> 2] |= 0x80 << (24 - (l & 3) * 8);
    const n = ((l + 8 >> 6) + 1) * 16; for (let i = 0; i < n; i++) words[i] = words[i] | 0;
    words[n - 1] = (l * 8) >>> 0; words[n - 2] = Math.floor(l / 0x20000000);
    const w = new Array(80); const rot = (x, k) => x << k | x >>> (32 - k);
    for (let i = 0; i < n; i += 16) {
      let [a, b, c, d, e] = H;
      for (let t = 0; t < 80; t++) {
        w[t] = t < 16 ? words[i + t] : rot(w[t - 3] ^ w[t - 8] ^ w[t - 14] ^ w[t - 16], 1);
        const f = t < 20 ? (b & c | ~b & d) + 0x5a827999 : t < 40 ? (b ^ c ^ d) + 0x6ed9eba1 : t < 60 ? (b & c | b & d | c & d) + 0x8f1bbcdc : (b ^ c ^ d) + 0xca62c1d6;
        const tmp = (rot(a, 5) + f + e + w[t]) | 0; e = d; d = c; c = rot(b, 30); b = a; a = tmp;
      }
      H[0] = H[0] + a | 0; H[1] = H[1] + b | 0; H[2] = H[2] + c | 0; H[3] = H[3] + d | 0; H[4] = H[4] + e | 0;
    }
    return H.map(x => (x >>> 0).toString(16).padStart(8, '0')).join('');
  }
  function gitSha(text) { const b = utf8(text); return sha1(utf8('blob ' + b.length + '\0').concat(b)); }
  const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  function b64(text) {
    const b = utf8(text); let s = '';
    for (let i = 0; i < b.length; i += 3) {
      const x = b[i] << 16 | (b[i + 1] || 0) << 8 | (b[i + 2] || 0);
      s += B64[x >> 18 & 63] + B64[x >> 12 & 63] + (i + 1 < b.length ? B64[x >> 6 & 63] : '=') + (i + 2 < b.length ? B64[x & 63] : '=');
    }
    return s;
  }
  function unb64(s) {
    s = String(s).replace(/[^A-Za-z0-9+/]/g, ''); const b = [];
    for (let i = 0; i < s.length; i += 4) {
      const x = B64.indexOf(s[i]) << 18 | B64.indexOf(s[i + 1]) << 12 | (i + 2 < s.length ? B64.indexOf(s[i + 2]) : 0) << 6 | (i + 3 < s.length ? B64.indexOf(s[i + 3]) : 0);
      b.push(x >> 16 & 255); if (i + 2 < s.length) b.push(x >> 8 & 255); if (i + 3 < s.length) b.push(x & 255);
    }
    return fromUtf8(b);
  }

  /* ---------------- REST client (api.github.com only) ---------------- */
  /* Every failure is { ok:false, status, kind, message, retryAt? }; kind: offline | auth | notfound | conflict | rate | invalid | http.
     Messages never contain the token. */
  function client(s, fetchFn) {
    const enc = p => p.split('/').map(encodeURIComponent).join('/');
    const base = `${API}/repos/${encodeURIComponent(s.owner)}/${encodeURIComponent(s.repo)}`;
    const ref = `ref=${encodeURIComponent(s.branch || 'main')}`;
    function headers(accept, json) {
      const h = { Accept: accept || 'application/vnd.github+json', Authorization: 'Bearer ' + s.token, 'X-GitHub-Api-Version': '2022-11-28' };
      if (json) h['Content-Type'] = 'application/json'; return h;
    }
    async function call(method, url, o) {
      o = o || {};
      if (url.indexOf(API + '/') !== 0) return { ok: false, kind: 'invalid', status: 0, message: 'Refused: not a GitHub API address.' };
      let r;
      try {
        r = await fetchFn(url, { method, headers: headers(o.accept, !!o.body), body: o.body ? JSON.stringify(o.body) : undefined,
          cache: 'no-store', credentials: 'omit', referrerPolicy: 'no-referrer', redirect: 'error', mode: 'cors' });
      } catch (e) { return { ok: false, kind: 'offline', status: 0, message: 'GitHub could not be reached (offline, or blocked by the network). Changes wait here and are sent later.' }; }
      const hd = k => { try { return r.headers && r.headers.get ? r.headers.get(k) : null; } catch (e) { return null; } };
      if (r.ok) {
        if (o.raw) return { ok: true, status: r.status, text: await r.text() };
        let j = null; try { j = await r.json(); } catch (e) { j = null; }
        return { ok: true, status: r.status, json: j };
      }
      let gm = ''; try { const j = await r.json(); gm = j && j.message ? String(j.message).slice(0, 200) : ''; } catch (e) { /* no body */ }
      const st = r.status, rem = hd('x-ratelimit-remaining'), reset = Number(hd('x-ratelimit-reset')), ra = Number(hd('retry-after'));
      if (st === 429 || (st === 403 && (rem === '0' || ra > 0 || /rate limit/i.test(gm)))) {
        const at = ra > 0 ? Date.now() + ra * 1000 : reset > 0 ? reset * 1000 : Date.now() + 60000;
        return { ok: false, kind: 'rate', status: st, retryAt: at, message: `GitHub rate limit reached; sync resumes after ${etTime(at)}.` };
      }
      if (st === 401) return { ok: false, kind: 'auth', status: st, message: 'GitHub refused the token (expired, revoked or mistyped). Open Cloud sync (GitHub) and paste a new token.' };
      if (st === 403) return { ok: false, kind: 'auth', status: st, message: `GitHub refused the request (403${gm ? ': ' + gm : ''}). Check that the token has Contents: Read and write on this repository.` };
      if (st === 404) return { ok: false, kind: 'notfound', status: st, message: 'Not found on GitHub (the repository or branch does not exist, or the token has no access to it).' };
      if (st === 409) return { ok: false, kind: 'conflict', status: st, message: 'The file changed on GitHub.' };
      if (st === 422) return { ok: false, kind: /sha/i.test(gm) ? 'conflict' : 'invalid', status: st, message: `GitHub did not accept the file (422${gm ? ': ' + gm : ''}).` };
      return { ok: false, kind: 'http', status: st, message: `GitHub answered ${st}${gm ? ': ' + gm : ''}.` };
    }
    return {
      repo: () => call('GET', base),
      branch: () => call('GET', `${base}/branches/${enc(s.branch || 'main')}`),
      /* list(dir) -> { ok, files: [{ name, path, sha }] } directly in dir/; a missing folder is an empty list */
      async list(dir) {
        const t = await this.tree(dir); if (!t.ok) return t;
        const files = []; t.files.forEach((sha, p) => { const n = p.slice(dir.length + 1); if (n.indexOf('/') < 0) files.push({ name: n, path: p, sha }); });
        return { ok: true, files };
      },
      /* tree(dir) -> { ok, files: Map(path -> sha) } of the files under dir/ on the branch: one request (git trees API), and no
         404 for a file that does not exist yet (a browser logs every 404 in the console). */
      async tree(dir) {
        const r = await call('GET', `${base}/git/trees/${enc(s.branch || 'main')}?recursive=1`);
        if (!r.ok) return r;
        const files = new Map(); ((r.json && r.json.tree) || []).forEach(f => { if (f && f.type === 'blob' && f.path.indexOf(dir + '/') === 0) files.set(f.path, f.sha); });
        return { ok: true, files, truncated: !!(r.json && r.json.truncated) };
      },
      /* meta(path) -> { ok, sha } (sha null when the file does not exist) */
      async meta(path) { const d = path.slice(0, path.lastIndexOf('/')); const t = await this.tree(d); if (!t.ok) return t; return { ok: true, sha: t.files.get(path) || null }; },
      raw: path => call('GET', `${base}/contents/${enc(path)}?${ref}`, { raw: true, accept: 'application/vnd.github.raw+json' }),
      async put(path, text, sha, message) {
        const body = { message, content: b64(text), branch: s.branch || 'main' }; if (sha) body.sha = sha;
        const r = await call('PUT', `${base}/contents/${enc(path)}`, { body });
        return r.ok ? { ok: true, sha: r.json && r.json.content && r.json.content.sha } : r;
      },
      del: (path, sha, message) => call('DELETE', `${base}/contents/${enc(path)}`, { body: { message, sha, branch: s.branch || 'main' } })
    };
  }

  function etTime(t) {
    try { const P = window.SharedProjects; if (P && P.etTime) return P.etTime(t); } catch (e) { /* below */ }
    return new Date(t).toISOString();
  }
  function stamp(t) {   // '2026-11-05 1432' (US Eastern), for conflict copy names
    try {
      const p = {}; new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
        .formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; });
      return `${p.year}-${p.month}-${p.day} ${p.hour}${p.minute}`;
    } catch (e) { return new Date(t).toISOString().slice(0, 16).replace('T', ' ').replace(':', ''); }
  }

  /* ---------------- sync engine (one per tool list) ----------------
     engine(o): o.tool ('spread-footing'), o.label ('Spread Footing'), o.store (SharedProjects.mapStore), o.storage, o.fetch,
       o.toFile(item, name) -> object or text in the tool's export format (default: the stored item), o.fromFile(obj, name) -> the
       state the tool's store.save takes (default: the object; it must be a JSON object), o.space (JSON indent of the file, default 1),
       o.now(), o.device (name used in conflict copies; default from settings), o.onNotice({ kind, text }).
     Methods: configured(), init(), scan(), flush(), refreshCloud(), rows(), uploadAll(), upload(name), download(name),
       useCloud(name), keepMine(name), deleteCloud(name), state(), cloud(), lastError(), pending(), notices */
  function engine(o) {
    if (!TOOL_RX.test(o.tool || '')) throw new Error('github-sync: bad tool key');
    const store = o.store, storage = o.storage, now = o.now || (() => Date.now()), space = o.space == null ? 1 : o.space;
    const SKEY = `${KEY}.tool.${o.tool}`, folder = `${DIR}/${o.tool}`, label = o.label || o.tool;
    const toFile = o.toFile || (i => i), fromFile = o.fromFile || (x => x);
    const me = Math.random().toString(36).slice(2);
    let lastRaw, busy = false, cloud = null, cloudErr = null, err = null, nextTry = 0, backoff = 0;
    const notices = [];
    const S = () => settings(storage);
    const pathOf = n => `${folder}/${safeName(n)}.json`;
    function note(kind, text) { const n = { kind, text, t: now() }; notices.push(n); if (notices.length > 20) notices.shift(); if (o.onNotice) { try { o.onNotice(n); } catch (e) { /* ignore */ } } }
    function st() { const v = readJSON(storage, SKEY); return v && v.v === 1 ? Object.assign({ base: {}, seen: {}, queue: [], conflicts: {} }, v) : null; }
    function mut(fn) { const v = st() || { v: 1, base: {}, seen: {}, queue: [], conflicts: {}, asked: false }; const r = fn(v); writeJSON(storage, SKEY, v); return r; }
    function fileText(name) {
      const it = store.item(name); if (it === undefined) return null;
      const f = toFile(JSON.parse(JSON.stringify(it)), name);
      return typeof f === 'string' ? f : JSON.stringify(f, null, space);
    }
    const localSha = name => { const t = fileText(name); return t == null ? null : gitSha(t); };
    const configured_ = () => configured(S());
    /* init(): the first time this tool runs with sync on in this browser, the projects already in the list are recorded as seen
       (not uploaded: the dialog offers "Upload all" once). Projects saved after that are uploaded. */
    function init() {
      if (!configured_() || st()) return false;
      const seen = {}; store.list().forEach(i => { const l = localSha(i.name); if (l) seen[i.name] = l; });
      writeJSON(storage, SKEY, { v: 1, base: {}, seen, queue: [], conflicts: {}, asked: !Object.keys(seen).length });
      try { lastRaw = storage.getItem(store.key); } catch (e) { lastRaw = undefined; }
      return true;
    }
    /* scan(): queue every project whose file text changed since it was last seen (new, saved, renamed, duplicated). */
    function scan(force) {
      if (!configured_()) return 0;
      init();
      let raw; try { raw = storage.getItem(store.key); } catch (e) { return 0; }
      if (raw === lastRaw && !force) return 0;
      lastRaw = raw;
      if (!store.read().ok) return 0;
      const names = store.list().map(i => i.name), shas = {}; names.forEach(n => { shas[n] = localSha(n); });
      return mut(v => {
        let q = 0;
        names.forEach(n => { if (v.seen[n] !== shas[n]) { v.seen[n] = shas[n]; if (v.queue.indexOf(n) < 0) { v.queue.push(n); q++; } } });
        Object.keys(v.seen).forEach(n => { if (names.indexOf(n) < 0) delete v.seen[n]; });
        v.queue = v.queue.filter(n => names.indexOf(n) >= 0);
        return q;
      });
    }
    function lock() {
      const v = st(); if (!v) return false;
      if (v.lock && v.lock.id !== me && v.lock.until > now()) return false;
      mut(x => { x.lock = { id: me, until: now() + 90000 }; }); return true;
    }
    const unlock = () => mut(x => { if (x.lock && x.lock.id === me) delete x.lock; });
    function failed(r) {
      err = r; const s = r.kind === 'offline' ? 30000 : 60000;
      backoff = Math.min(backoff ? backoff * 2 : s, 600000);
      nextTry = r.retryAt || now() + backoff;
    }
    function uniqueName(base) {
      let n = base, i = 2; const inCloud = x => cloud && cloud.has(x);
      while (store.has(n) || inCloud(n)) n = `${base} ${i++}`;
      return n;
    }
    /* keepBoth(name, text): ours becomes "<name> (conflict <device> <date>)" here and on GitHub; nothing is overwritten. */
    async function keepBoth(c, name, text, cloudSha) {
      const dev = (o.device || S().device || 'this device').replace(/[()]/g, '');
      const cn = uniqueName(`${name} (conflict ${dev} ${stamp(now())})`);
      const d = store.duplicate(name, cn);
      if (!d.ok) { note('error', `"${name}" changed on GitHub and here, and the copy could not be kept in this browser (${d.message || d.error}). Nothing was uploaded.`); return d; }
      const l = gitSha(text), ctext = fileText(cn), lc = gitSha(ctext);   // the copy's own file text (a tool's file may carry the name)
      const r = await c.put(pathOf(cn), ctext, null, `${label}: conflict copy "${cn}" (from ${dev})`);
      mut(v => {
        v.seen[cn] = lc; v.queue = v.queue.filter(x => x !== name && (r.ok ? x !== cn : true)); if (!r.ok && v.queue.indexOf(cn) < 0) v.queue.push(cn);
        if (r.ok) v.base[cn] = { c: r.sha, l: lc };
        v.conflicts[name] = { copy: cn, l, c: cloudSha || null, t: now() };
      });
      try { lastRaw = storage.getItem(store.key); } catch (e) { /* ignore */ }
      if (cloud && r.ok) cloud.set(cn, { sha: r.sha, path: pathOf(cn) });
      note('conflict', `"${name}" was changed on GitHub (another device) and in this browser. Both are kept: your version is saved as "${cn}"${r.ok ? ' here and on GitHub' : ' here (its upload is waiting)'}. Open Saved projects to choose which one to keep under "${name}".`);
      return r.ok ? { ok: true, conflict: cn } : r;
    }
    /* flush(): upload the queue, oldest first. Stops at the first connection / token / rate-limit error (kept for later). */
    async function flush(force) {
      if (busy || !configured_()) return { ok: true, skipped: true };
      if (!force && now() < nextTry) return { ok: true, waiting: true };
      const v0 = st(); if (!v0 || !v0.queue.length) return { ok: true, done: 0 };
      if (!lock()) return { ok: true, locked: true };
      busy = true; let done = 0;
      try {
        const c = client(S(), o.fetch);
        const t = await c.tree(folder); if (!t.ok) { failed(t); return t; }
        const shas = t.files;
        for (const name of st().queue.slice()) {
          const v = st();
          if (!store.has(name)) { mut(x => { x.queue = x.queue.filter(n => n !== name); }); continue; }
          if (v.conflicts[name]) { mut(x => { x.queue = x.queue.filter(n => n !== name); }); continue; }   // resolved in the dialog
          const text = fileText(name), l = gitSha(text), b = v.base[name], path = pathOf(name);
          if (safeName(name).length > 200) { err = { kind: 'invalid', message: `"${name}": the name is too long to be a file name on GitHub. Rename it to sync it.` }; mut(x => { x.queue = x.queue.filter(n => n !== name); }); continue; }
          const m = { sha: shas.get(path) || null };
          let r;
          if (m.sha === l) r = { ok: true, sha: l };
          else if (m.sha && !(b && b.c === m.sha)) { r = await keepBoth(c, name, text, m.sha); if (!r.ok) { failed(r); return r; } done++; continue; }
          else r = await c.put(path, text, m.sha, `${label}: save "${name}"`);
          if (!r.ok && r.kind === 'conflict') { const m2 = await c.meta(path); r = await keepBoth(c, name, text, m2.ok ? m2.sha : null); if (!r.ok) { failed(r); return r; } done++; continue; }
          if (!r.ok) { failed(r); return r; }
          shas.set(path, r.sha);
          mut(x => { x.base[name] = { c: r.sha, l }; x.queue = x.queue.filter(n => n !== name); });
          if (cloud) cloud.set(name, { sha: r.sha, path });
          done++;
        }
        err = null; backoff = 0; nextTry = 0;
        return { ok: true, done };
      } finally { busy = false; unlock(); }
    }
    /* refreshCloud(): the files on GitHub for this tool -> cloud (Map name -> { sha, path }) */
    async function refreshCloud() {
      if (!configured_()) { cloud = null; return { ok: false, kind: 'off' }; }
      const r = await client(S(), o.fetch).list(folder);
      if (!r.ok) { cloudErr = r; return r; }
      cloudErr = null; cloud = new Map();
      r.files.forEach(f => { const n = nameOf(f.name); if (n != null) cloud.set(n, { sha: f.sha, path: f.path }); });
      return { ok: true, count: cloud.size };
    }
    /* status of one name: synced | pending | local | removed | cloud | cloud-newer | conflict | unknown */
    function statusOf(name, v) {
      v = v || st() || { base: {}, queue: [], conflicts: {} };
      const isLocal = store.has(name), cf = cloud ? cloud.get(name) : undefined, b = v.base[name];
      if (!isLocal) return cf ? 'cloud' : null;
      const l = localSha(name);
      if (v.conflicts[name]) return 'conflict';
      if (!cloud) return v.queue.indexOf(name) >= 0 ? 'pending' : b && b.l === l ? 'synced' : 'unknown';
      if (!cf) return v.queue.indexOf(name) >= 0 ? 'pending' : b ? (b.l === l ? 'removed' : 'pending') : 'local';
      if (cf.sha === l || (b && b.c === cf.sha && b.l === l)) return 'synced';
      if (b && b.l === l) return 'cloud-newer';
      if (b && b.c === cf.sha) return 'pending';
      return 'conflict';
    }
    function rows() {
      const v = st(); const names = new Set(store.list().map(i => i.name)); if (cloud) cloud.forEach((x, n) => names.add(n));
      return [...names].sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })).map(n => ({ name: n, status: statusOf(n, v), conflict: v && v.conflicts[n] || null }));
    }
    async function upload(name) { scan(true); mut(v => { if (store.has(name) && v.queue.indexOf(name) < 0) v.queue.push(name); }); return flush(true); }
    async function uploadAll() { scan(true); mut(v => { v.asked = true; store.list().forEach(i => { if (v.queue.indexOf(i.name) < 0 && !(v.base[i.name] && v.base[i.name].l === v.seen[i.name])) v.queue.push(i.name); }); }); return flush(true); }
    const skipFirst = () => mut(v => { v.asked = true; });
    /* download(name, replace): the GitHub file into this browser's list (store.save of fromFile(file)). replace false refuses an existing name. */
    async function download(name, replace) {
      if (store.has(name) && !replace) return { ok: false, error: 'exists', message: `A project named "${name}" is already in this browser.` };
      const c = client(S(), o.fetch), path = pathOf(name);
      const r = await c.raw(path); if (!r.ok) { err = r; return r; }
      let obj; try { obj = JSON.parse(r.text); } catch (e) { return { ok: false, error: 'format', message: `"${name}" on GitHub is not a JSON project file.` }; }
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, error: 'format', message: `"${name}" on GitHub is not a project file of this tool.` };
      let state; try { state = fromFile(obj, name); } catch (e) { return { ok: false, error: 'format', message: `"${name}" on GitHub could not be read by this tool (${e.message}).` }; }
      if (state == null) return { ok: false, error: 'format', message: `"${name}" on GitHub is not a project file of this tool.` };
      const w = store.save(name, state); if (!w.ok) return w;
      const c2 = gitSha(r.text), l = localSha(name);
      mut(v => { v.base[name] = { c: c2, l }; v.seen[name] = l; v.queue = v.queue.filter(n => n !== name); delete v.conflicts[name]; });
      try { lastRaw = storage.getItem(store.key); } catch (e) { /* ignore */ }
      if (cloud) cloud.set(name, { sha: c2, path });
      return { ok: true, name };
    }
    /* useCloud(name): replace this browser's copy with GitHub's (after a conflict or when GitHub is newer). A local version that
       is not already kept elsewhere (synced, or kept as the conflict copy) is first kept as a conflict copy. */
    async function useCloud(name) {
      const v = st(), l = localSha(name), b = v && v.base[name], cf = v && v.conflicts[name];
      if (l && !(b && b.l === l) && !(cf && cf.l === l)) {
        const dev = (o.device || S().device || 'this device').replace(/[()]/g, ''), cn = uniqueName(`${name} (conflict ${dev} ${stamp(now())})`);
        const d = store.duplicate(name, cn); if (!d.ok) return d;
        note('conflict', `Your version of "${name}" is kept as "${cn}".`);
      }
      return download(name, true);
    }
    /* keepMine(name): replace GitHub's file with this browser's version (explicit, after a conflict or when GitHub is newer). */
    async function keepMine(name) {
      const c = client(S(), o.fetch), path = pathOf(name), text = fileText(name); if (text == null) return { ok: false, message: 'Not in this browser.' };
      const m = await c.meta(path); if (!m.ok) { err = m; return m; }
      const r = await c.put(path, text, m.sha, `${label}: save "${name}" (replacing the GitHub version)`);
      if (!r.ok) { err = r; return r; }
      const l = gitSha(text);
      mut(v => { v.base[name] = { c: r.sha, l }; v.seen[name] = l; v.queue = v.queue.filter(n => n !== name); delete v.conflicts[name]; });
      if (cloud) cloud.set(name, { sha: r.sha, path });
      return { ok: true };
    }
    /* deleteCloud(name): explicit only (the dialog asks first). The local copy is not touched. */
    async function deleteCloud(name) {
      const c = client(S(), o.fetch), path = pathOf(name);
      const m = await c.meta(path); if (!m.ok) { err = m; return m; }
      if (!m.sha) { if (cloud) cloud.delete(name); mut(v => { delete v.base[name]; }); return { ok: true }; }
      const r = await c.del(path, m.sha, `${label}: delete "${name}"`); if (!r.ok) { err = r; return r; }
      if (cloud) cloud.delete(name); mut(v => { delete v.base[name]; delete v.conflicts[name]; });
      return { ok: true };
    }
    return { tool: o.tool, label, folder, pathOf, configured: configured_, init, scan, flush, refreshCloud, rows, statusOf, upload, uploadAll, skipFirst,
      download, useCloud, keepMine, deleteCloud, notices, fileText, localSha,
      state: st, cloud: () => cloud, cloudError: () => cloudErr, lastError: () => err, nextTry: () => nextTry, busy: () => busy,
      pending: () => { const v = st(); return v ? v.queue.length : 0; }, settings: S };
  }

  /* ---------------- browser UI (used by shared/projects-ui.js) ---------------- */
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  let cssDone = false;
  function css() {
    if (cssDone || typeof document === 'undefined') return; cssDone = true;
    const s = document.createElement('style'); s.setAttribute('data-sp', 'gh-css');
    s.textContent = [
      '.spGhBar{display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center;font-size:9pt;color:#334155;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:6px 8px;margin:0 0 8px;}',
      '.spGhSt{display:inline-block;font-size:8.5pt;padding:1px 6px;border-radius:9px;border:1px solid #cbd5e1;white-space:nowrap;}',
      '.spGhSt.synced{background:#dcfce7;border-color:#86efac;color:#166534;} .spGhSt.pending,.spGhSt.local,.spGhSt.removed,.spGhSt.unknown{background:#f1f5f9;color:#334155;}',
      '.spGhSt.cloud-newer,.spGhSt.cloud{background:#e0f2fe;border-color:#7dd3fc;color:#075985;} .spGhSt.conflict{background:#fef3c7;border-color:#fcd34d;color:#92400e;}',
      '.spGhAsk{background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:6px 8px;margin:6px 0;font-size:9pt;}',
      'dialog.spGh label{display:block;margin:6px 0 2px;font-weight:600;font-size:9pt;} dialog.spGh input{font:inherit;font-size:10pt;padding:3px 6px;width:100%;box-sizing:border-box;border:1px solid #94a3b8;border-radius:4px;}',
      'dialog.spGh .spGhRes{margin:8px 0;font-size:9pt;white-space:pre-wrap;} dialog.spGh .spGhBtns{margin-top:10px;display:flex;flex-wrap:wrap;gap:6px;} dialog.spGh .spGhBtns button{margin-left:0;}',
      '.spGhToast{position:fixed;right:12px;bottom:12px;z-index:2147483000;max-width:min(420px,92vw);background:#fffbeb;color:#78350f;border:1px solid #f59e0b;border-radius:6px;padding:8px 28px 8px 10px;font:13px/1.35 system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.15);}',
      '.spGhToast button{position:absolute;top:4px;right:4px;border:0;background:none;font-size:14px;cursor:pointer;color:#78350f;}',
      '@media print{.spGhToast,dialog.spGh{display:none!important;}}'
    ].join('\n');
    document.head.appendChild(s);
  }
  function toast(text) {
    if (typeof document === 'undefined') return; css();
    const d = document.createElement('div'); d.className = 'spGhToast'; d.setAttribute('data-sp', 'gh-toast'); d.setAttribute('role', 'status');
    d.innerHTML = `<button type="button" aria-label="Close">×</button>${esc(text)}`;
    d.querySelector('button').onclick = () => d.remove();
    document.body.appendChild(d); setTimeout(() => d.remove(), 15000);
  }
  const LABEL = { synced: 'synced', pending: 'waiting to upload', local: 'this browser only', removed: 'not on GitHub (deleted there)', unknown: 'not checked yet',
    cloud: 'on GitHub only', 'cloud-newer': 'GitHub newer', conflict: 'conflict' };

  /* the Cloud sync (GitHub) settings dialog: one per page */
  let setDlg = null;
  function settingsDialog(storage, after) {
    css();
    if (!setDlg) {
      setDlg = document.createElement('dialog'); setDlg.className = 'spLib spGh'; setDlg.setAttribute('data-sp', 'gh-dialog'); setDlg.id = 'spGhDlg';
      document.body.appendChild(setDlg);
    }
    const d = setDlg, s = settings(storage);
    d.innerHTML = `<div class="spHead"><strong>Cloud sync (GitHub)</strong><span><button type="button" data-gh="close">Close</button></span></div>
      <p class="spNote">Copies the saved projects of every tool in this browser to your <b>private</b> GitHub repository, so they are on all your devices. The browser's list stays the working copy: the tools work offline as before, and changes are sent when GitHub can be reached. Autosave is not synced, only named projects. Setup steps: docs/github-sync-setup.md.</p>
      <label for="spGhOwner">GitHub account (owner)</label><input id="spGhOwner" autocomplete="off" spellcheck="false" value="${esc(s.owner || 'mlococo88')}">
      <label for="spGhRepo">Repository</label><input id="spGhRepo" autocomplete="off" spellcheck="false" value="${esc(s.repo || 'structural-projects')}">
      <label for="spGhBranch">Branch</label><input id="spGhBranch" autocomplete="off" spellcheck="false" value="${esc(s.branch || 'main')}">
      <label for="spGhToken">Fine-grained access token</label><input id="spGhToken" type="password" autocomplete="off" spellcheck="false" placeholder="${s.token ? 'saved: ' + esc(mask(s.token)) + ' (leave blank to keep it)' : 'github_pat_…'}">
      <label for="spGhDevice">This device's name (used in conflict copies)</label><input id="spGhDevice" autocomplete="off" value="${esc(s.device)}" placeholder="e.g. Work laptop">
      <p class="spNote"><b>The token is stored in this browser's storage</b> (readable by anyone who can use this browser profile). It is sent only to api.github.com, is never shown again, and is never part of a project file. Use a token limited to this one repository, with Contents read and write only. Forget it on shared computers.</p>
      <div class="spGhBtns"><button type="button" data-gh="save">Save</button><button type="button" data-gh="test">Test connection</button><button type="button" class="spDel" data-gh="forget"${s.token ? '' : ' disabled'}>Forget token on this device</button></div>
      <div class="spGhRes" role="status"></div>`;
    const res = d.querySelector('.spGhRes'), val = id => d.querySelector('#' + id).value;
    const form = () => ({ owner: val('spGhOwner'), repo: val('spGhRepo'), branch: val('spGhBranch'), token: val('spGhToken'), device: val('spGhDevice') });
    d.onclick = async e => {
      if (e.target === d) { d.close(); return; }
      const b = e.target.closest('[data-gh]'); if (!b) return;
      const a = b.dataset.gh;
      if (a === 'close') { d.close(); return; }
      if (a === 'forget') { if (!confirm('Forget the GitHub token in this browser? Sync stops on this device until a token is pasted again. Nothing is deleted.')) return; forgetToken(storage); settingsDialog(storage, after); d.querySelector('.spGhRes').textContent = 'The token was removed from this browser.'; if (after) after(); return; }
      if (a === 'save' || a === 'test') {
        const r = saveSettings(storage, form()); d.querySelector('#spGhToken').value = '';
        if (!r.ok) { res.textContent = r.message; return; }
        if (a === 'save') { settingsDialog(storage, after); d.querySelector('.spGhRes').textContent = 'Saved.' + (configured(settings(storage)) ? ' Sync is on for every tool in this browser.' : ' Paste a token to turn sync on.'); if (after) after(); return; }
        res.textContent = 'Testing…';
        const t = await testConnection(storage); settingsDialog(storage, after); d.querySelector('.spGhRes').textContent = t.message; if (after) after();
      }
    };
    if (!d.open) { if (d.showModal) d.showModal(); else d.setAttribute('open', ''); }
    return d;
  }
  /* testConnection(storage): reads the repository and the branch; never writes. */
  async function testConnection(storage, fetchFn) {
    const s = settings(storage); if (!configured(s)) return { ok: false, message: 'Enter the account, the repository and a token first.' };
    const c = client(s, fetchFn || ((u, i) => window.fetch(u, i)));
    const r = await c.repo(); if (!r.ok) return { ok: false, message: 'Not connected. ' + r.message };
    const j = r.json || {}, lines = [`Connected to ${s.owner}/${s.repo}.`];
    lines.push(j.private === false ? 'WARNING: this repository is PUBLIC. Anyone can read the projects. Make it private (Settings, Danger Zone, Change visibility) before syncing.' : 'The repository is private.');
    if (j.permissions && j.permissions.push === false) lines.push('WARNING: no write access to it. The token needs Contents: Read and write.');
    const br = await c.branch();
    if (!br.ok) lines.push(br.kind === 'notfound' ? `The branch "${s.branch}" does not exist. A new repository needs a first file (tick "Add a README file" when you create it), or use its default branch${j.default_branch ? ' "' + j.default_branch + '"' : ''}.` : br.message);
    else lines.push(`Branch "${s.branch}" found. Writing is checked on the first save.`);
    return { ok: br.ok && j.private !== false, message: lines.join('\n') };
  }

  /* attach(ctx): ctx is the libraryDialog ctx (store, storage, open, changed, cloud = { tool, label, toFile, fromFile, space }).
     Returns the hooks libraryDialog calls: decorate(body, ui), shown(ui), renamed(a, b), deleted(name), note(). Starts a 3 s check
     of the tool's list (scan + flush) that does nothing while sync is off.
     A tool with its OWN project dialog or panel (GHS2, 2026-11-05) calls attach itself (ctx = { store, storage, open, changed, cloud })
     and, each time it draws its list: statusCell(name) -> the HTML of the GitHub status of one project (badge and its buttons; '' while
     sync is off) placed in that project's row, bind(rows element) once (one click listener for those buttons), and decorate(body, ui,
     { rows: false }) with body = an empty element above the rows: the bar, the first-sync offer and the "On GitHub only" rows go there.
     Outside a Saved projects dialog the bar carries the "Cloud sync (GitHub)…" settings button itself. */
  function attach(ctx) {
    css();
    const cfg = ctx.cloud || {};
    const eng = engine({ tool: cfg.tool, label: cfg.label, toFile: cfg.toFile, fromFile: cfg.fromFile, space: cfg.space, store: ctx.store, storage: ctx.storage,
      fetch: (u, i) => window.fetch(u, i), onNotice: n => { if (n.kind === 'conflict' || n.kind === 'error') toast(n.text); } });
    let ui = null, checking = false, msg = '';
    const redraw = () => { if (ui && ui.redraw) ui.redraw(); };
    async function tick() {
      if (!eng.configured()) return;
      const q = eng.scan();
      const before = eng.lastError();
      const r = await eng.flush(q > 0 && !(before && before.kind === 'rate'));
      if (r && (r.done || r.ok === false || before !== eng.lastError())) { if (r.done && ctx.changed) ctx.changed(); redraw(); }
    }
    try { if (eng.configured()) eng.init(); } catch (e) { /* storage blocked: nothing to sync */ }   // projects in the list now = 'already here' (first-connect offer); later saves upload
    const timer = setInterval(() => { tick().catch(() => {}); }, 3000);
    if (typeof window !== 'undefined' && window.addEventListener) window.addEventListener('online', () => { tick().catch(() => {}); });
    async function shown(u) {
      ui = u; if (!eng.configured()) return;
      eng.scan(); checking = true; redraw();
      await eng.flush(true); await eng.refreshCloud(); checking = false; redraw();
    }
    async function run(p, after) {
      checking = true; redraw();
      let r; try { r = await p; } finally { checking = false; }
      msg = r && r.ok === false ? (r.message || r.error || 'Failed.') : '';
      if (after) after(r);
      if (ctx.changed) ctx.changed(); redraw(); return r;
    }
    function decorate(body, u, o) {
      ui = u;
      const dlg = body.closest('dialog'), own = !(dlg && dlg.querySelector('.spHead span'));   // own: a tool's own dialog / panel (GHS2)
      if (dlg && !own && !dlg.querySelector('[data-gh=setup]')) {
        const head = dlg.querySelector('.spHead span'); const b = document.createElement('button'); b.type = 'button'; b.setAttribute('data-gh', 'setup'); b.textContent = 'Cloud sync (GitHub)…';
        b.onclick = () => settingsDialog(ctx.storage, () => { shown(ui); });
        if (head) head.insertBefore(b, head.firstChild);
      }
      const s = eng.settings(), on = configured(s);
      const bar = document.createElement('div'); bar.className = 'spGhBar'; bar.setAttribute('data-sp', 'gh-bar');
      if (!on) {
        bar.innerHTML = `<span>Cloud sync (GitHub): <b>off</b>${s.owner && !s.token ? ' (no token on this device)' : ''}. Projects stay in this browser.</span><button type="button" data-ghx="setup">Set up…</button>`;
        body.insertBefore(bar, body.firstChild); bindBody(body); return;
      }
      const v = eng.state(), pend = v ? v.queue.length : 0, ce = eng.cloudError(), le = eng.lastError();
      bar.innerHTML = `<span>Cloud sync: <b>${esc(s.owner)}/${esc(s.repo)}</b> (${esc(s.branch)})${checking ? ' · checking GitHub…' : ''}${pend ? ` · ${pend} waiting to upload` : ''}</span>`
        + `<button type="button" data-ghx="refresh">Sync now</button>` + (own ? `<button type="button" data-ghx="setup">Cloud sync (GitHub)…</button>` : '')
        + (ce ? `<span class="spErr" style="margin:0">${esc(ce.message)}</span>` : le ? `<span class="spErr" style="margin:0">${esc(le.message)}</span>` : '')
        + (msg ? `<span class="spErr" style="margin:0">${esc(msg)}</span>` : '')
        + `<span class="spNote" style="margin:0;flex-basis:100%">Autosave is not synced, only named projects. Files: ${esc(eng.folder)}/ in the repository.</span>`;
      body.insertBefore(bar, body.firstChild);
      if (v && !v.asked) {
        const n = store().list().length;
        if (n) { const a = document.createElement('div'); a.className = 'spGhAsk'; a.setAttribute('data-sp', 'gh-ask');
          a.innerHTML = `First sync of this tool on this device: upload the ${n} project${n > 1 ? 's' : ''} saved in this browser to GitHub? Nothing in this browser is deleted or changed. <button type="button" data-ghx="upall">Upload all</button><button type="button" data-ghx="skip">Not now</button>`;
          bar.after(a); }
      }
      const rows = eng.rows(), byName = new Map(rows.map(r => [r.name, r]));
      const table = o && o.rows === false ? null : body.querySelector('table');   // rows: false: the tool placed statusCell() in its rows
      if (table) {
        const hr = table.querySelector('thead tr'); if (hr && hr.lastElementChild) { const th = document.createElement('th'); th.textContent = 'GitHub'; hr.insertBefore(th, hr.lastElementChild); }
        table.querySelectorAll('tbody tr').forEach(tr => {
          const ob = tr.querySelector('[data-spa=open]'); if (!ob) return; const name = decodeURIComponent(ob.dataset.n || ''), r = byName.get(name);
          const td = document.createElement('td'); td.innerHTML = cell(name, r ? r.status : null, r && r.conflict); tr.insertBefore(td, tr.lastElementChild);
        });
      }
      const only = rows.filter(r => r.status === 'cloud');
      if (only.length) {
        const w = document.createElement('div'); w.setAttribute('data-sp', 'gh-only'); w.className = 'spScroll';
        w.innerHTML = `<p class="spNote" style="font-weight:600;color:#075985">On GitHub only (not in this browser):</p><table><tbody>${only.map(r => `<tr><td>${esc(r.name)}</td><td>${cell(r.name, 'cloud')}</td><td class="spAct">`
          + `<button type="button" data-ghx="open" data-n="${encodeURIComponent(r.name)}">Open</button><button type="button" data-ghx="get" data-n="${encodeURIComponent(r.name)}">Download to this browser</button>`
          + `<button type="button" class="spDel" data-ghx="delcloud" data-n="${encodeURIComponent(r.name)}">Delete from GitHub</button></td></tr>`).join('')}</tbody></table>`;
        const after = body.querySelector('.spScroll') || bar; after.after(w);
      }
      bindBody(body);
    }
    function cell(name, stt, cf) {
      if (!stt) return '';
      const n = encodeURIComponent(name), B = (a, t, c) => ` <button type="button" data-ghx="${a}" data-n="${n}"${c ? ` class="${c}"` : ''}>${t}</button>`;
      let h = `<span class="spGhSt ${stt}" data-gh-status="${stt}"${cf ? ` title="Your version is kept as: ${esc(cf.copy)}"` : ''}>${LABEL[stt] || stt}</span>`;
      if (stt === 'local' || stt === 'removed') h += B('up', 'Upload');
      if (stt === 'cloud-newer') h += B('usecloud', 'Get GitHub version');
      if (stt === 'conflict') h += B('usecloud', 'Use GitHub version') + B('keepmine', 'Keep mine');
      return h;
    }
    const store = () => ctx.store;
    /* statusCell(name): the GitHub status cell of one project for a tool's own list (GHS2); '' while sync is off */
    function statusCell(name) {
      if (!eng.configured()) return '';
      const v = eng.state() || undefined, s = eng.statusOf(name, v);
      return `<span data-sp="gh-cell">${cell(name, s, v && v.conflicts[name])}</span>`;
    }
    function bindBody(body) {
      if (body.__gh) return; body.__gh = true;
      body.addEventListener('click', e => {
        const b = e.target.closest('[data-ghx]'); if (!b) return; const a = b.dataset.ghx, name = decodeURIComponent(b.dataset.n || '');
        if (a === 'setup') { settingsDialog(ctx.storage, () => { shown(ui); }); return; }
        if (a === 'refresh') { msg = ''; shown(ui); return; }
        if (a === 'upall') { run(eng.uploadAll().then(r => r.ok === false ? r : eng.refreshCloud())); return; }
        if (a === 'skip') { eng.skipFirst(); redraw(); return; }
        if (a === 'up') { run(eng.upload(name).then(r => r.ok === false ? r : eng.refreshCloud())); return; }
        if (a === 'get') { run(eng.download(name, false)); return; }
        if (a === 'open') { run(eng.download(name, false), r => { if (r && r.ok && ctx.open(name) !== false && ui && ui.close) ui.close(); }); return; }
        if (a === 'usecloud') {
          const cf = (eng.state() || { conflicts: {} }).conflicts[name];
          if (!confirm(`Replace "${name}" in this browser with the version on GitHub?${cf ? ` Your version stays in the list as "${cf.copy}".` : ' Your version in this browser is the last one synced, so it is also in the GitHub history.'}`)) return;
          run(eng.useCloud(name)); return;
        }
        if (a === 'keepmine') { if (!confirm(`Replace the GitHub version of "${name}" with the version in this browser? The GitHub version stays in the repository history only.`)) return; run(eng.keepMine(name)); return; }
        if (a === 'delcloud') { if (!confirm(`Delete "${name}" from GitHub? It is not in this browser, so after this it is only in the repository history. This affects every device.`)) return; run(eng.deleteCloud(name)); }
      });
    }
    /* after a rename / delete in the dialog: the GitHub file of the old name is deleted only when the user says so */
    function renamed(a, b) {
      if (!eng.configured()) return; eng.scan(); const cl = eng.cloud();
      if (cl && cl.has(a) && confirm(`"${a}" is also on GitHub. The new name "${b}" is uploaded. Delete the old name "${a}" from GitHub? (Cancel keeps it there.)`)) run(eng.deleteCloud(a));
      else tick().catch(() => {});
    }
    function deleted(name) {
      if (!eng.configured()) return; eng.scan(); const cl = eng.cloud();
      if (cl && cl.has(name) && confirm(`Also delete "${name}" from GitHub? This affects every device. (Cancel keeps the GitHub copy; it is listed as "on GitHub only".)`)) run(eng.deleteCloud(name));
      else redraw();
    }
    const note = () => configured(eng.settings()) ? '<p class="spNote">Saved projects are kept in this browser and copied to GitHub (see the bar above). Export JSON still makes a file you can back up.</p>' : null;
    return { engine: eng, decorate, shown, renamed, deleted, note, tick, statusCell, bind: bindBody, stop: () => clearInterval(timer) };
  }

  window.SharedGitHubSync = { API, KEY, settings, saveSettings, forgetToken, configured, mask, safeName, nameOf, gitSha, b64, unb64, client, engine,
    attach, testConnection, settingsDialog, stamp };
})();
