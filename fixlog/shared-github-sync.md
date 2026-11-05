# Fix log — shared/github-sync.js (window.SharedGitHubSync)

Loaded by: see `shared/README.md` (row `github-sync.js`). Tests: `node tests/engine/run.mjs github-sync` (Node, fetch mocked by
`tests/engine/gh-mock.mjs`) and `node tests/smoke/github-sync.mjs` (browser; api.github.com routed to the same mock).
Engineer's setup steps: `docs/github-sync-setup.md`.

## 2026-11-05 — PR: claude/github-sync (PR #808: https://github.com/mlococo88/All-Structural/pull/808) — created (new file): saved projects copied to a private GitHub repository (GHS)   [storage only; no result change]
- **Why:** engineer request 2026-11-05: see the same saved projects on every device; GitHub chosen over Firebase. A private repository
  (default `mlococo88/structural-projects`) and a fine-grained token (Contents read / write on that repository only), pasted once per device.
- **What:** `shared/github-sync.js` (classic script, no library, GitHub REST API with `fetch`):
  - `client(settings, fetch)`: `GET /repos/{o}/{r}` and `/branches/{b}` (Test connection), `GET /repos/{o}/{r}/git/trees/{branch}?recursive=1`
    (listing and file shas: one request, no 404 per missing file), `GET /contents/{path}` with `Accept: application/vnd.github.raw+json`
    (download), `PUT /contents/{path}` (create, or update with `sha`), `DELETE /contents/{path}` (with `sha`). Every call goes to
    `https://api.github.com` only (other addresses refused), with `cache: 'no-store'`, `credentials: 'omit'`, `redirect: 'error'`,
    `referrerPolicy: 'no-referrer'`. Errors are mapped to offline / auth / notfound / conflict (409, 422 "sha") / rate (403 or 429 with
    `x-ratelimit-remaining: 0` or `retry-after`) / http; messages never contain the token.
  - `engine({ tool, label, store, storage, fetch, toFile, fromFile, space })`: one per tool list (a `SharedProjects.mapStore`).
    `scan()` reads the tool's list key (only when its text changed) and queues every project whose file text is new or changed;
    `flush()` uploads the queue (offline / refused uploads stay queued, retry after 30 s doubling to 10 min, or the rate-limit reset);
    three-way status per project from git blob shas (`gitSha`, SHA-1 of `blob <bytes>\0<bytes>`, so no download is needed to compare):
    synced, waiting to upload, this browser only, not on GitHub (deleted there), on GitHub only, GitHub newer, conflict.
    `download`, `useCloud`, `keepMine`, `deleteCloud` (explicit only), `uploadAll` (first connect).
  - `attach(ctx)`: the hooks `shared/projects-ui.js` calls when a tool passes `ctx.cloud` (the GitHub column, the "On GitHub only" rows,
    the status bar, the first-connect offer, the "Cloud sync (GitHub)" settings dialog with Test connection and Forget token, a
    notice for conflicts). A 3 s timer runs scan + flush; it does nothing while sync is off.
- **Decisions (pending engineer review):**
  1. **Keys (CLAUDE.md §5: new keys only).** Settings in ONE key, `bridgeSuite.v1.githubSync` = `{ owner, repo, branch, token, device }`,
     shared by every tool (all `file://` pages share one storage origin in Chrome / Edge, so one setup covers every tool). Per-tool sync
     bookkeeping in `bridgeSuite.v1.githubSync.tool.<tool>` = `{ v:1, base:{name:{c,l}}, seen:{name:l}, queue:[names], asked, conflicts, lock }`
     (a separate key per tool so two tools open in two tabs never overwrite each other's bookkeeping). Neither key is written while sync
     is off. No tool key or format is changed.
  2. **File = the tool's Export JSON.** `projects/<tool>/<safe name>.json`; `toFile` / `fromFile` hooks per tool when the stored item
     differs from the export (default: the item; JSON indent 1, as Spread Footing's export). Safe name: letters, digits, inner spaces and
     `_-.(),+&'!~=@` kept, anything else `%XX` (UTF-8), so the file name gives the project name back exactly.
  3. **Change detection by reading the list**, not by hooking each save path: any save path of a tool (its own Save / Overwrite, the
     dialog's Rename / Duplicate) is seen within 3 s, with no change to the tool's save code.
  4. **First connect on a device:** projects already in the list are recorded, not uploaded; the dialog offers "Upload all" once
     ("Not now" leaves an Upload button on each). Projects saved after that are uploaded.
  5. **Conflict = keep both.** When GitHub's file is not the one this browser last synced (or GitHub answers 409 / 422 "sha"), ours is
     saved as `<name> (conflict <device> <yyyy-mm-dd hhmm Eastern>)` in this browser (a duplicate of the stored item) and on GitHub, a
     notice is shown, and `<name>` shows "conflict" with "Use GitHub version" / "Keep mine" (both ask first). No retry loop.
  6. **Delete is explicit:** a local delete in the dialog asks "Also delete from GitHub?" (Cancel keeps it; it is then listed under "On
     GitHub only" with "Delete from GitHub"). A rename asks whether to delete the old name on GitHub. A tool's own Delete button never
     touches GitHub.
  7. **Autosave is not synced** (said in the dialog bar and the settings dialog).
  8. **Token:** stored in this browser's storage (said in the dialog), shown masked (`github_pat_••••••••abcd`), sent only in the
     `Authorization: Bearer` header to api.github.com, never in a URL, never logged, never in a project file. "Forget token on this
     device" removes it.
  9. **Two tabs of one tool:** a lock in the per-tool key (90 s) lets one tab upload at a time; the second finds the file already
     identical (same blob sha) and marks it synced.
- **file:// and CORS:** GitHub's REST API answers browser requests from any origin (`Access-Control-Allow-Origin: *`, Authorization
  allowed in the preflight); a `file://` page sends `Origin: null`, which `*` covers because no cookies are sent (`credentials: 'omit'`).
  **Untested against the real API** (this environment cannot reach it); tested against the mock in headless Chromium from `file://`
  (the page's real `fetch`, with CORS preflights). The engineer tests it (ENGINEER_CHECKS.md).
- **Check case:** `tests/engine/github-sync.test.mjs` (12 tests): sync off makes no request and no key; file names round trip
  (`'a/b'` → `a%2Fb.json`); `gitSha('')` = `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` (git's empty blob) and agrees with node:crypto on
  70 kB / Unicode text; Upload all, save, update (PUT `sha` = the previous blob sha); conflict keeps GitHub's text and creates
  `Pier 3 (conflict Laptop 2026-11-05 1432)` with ours; 409 on the PUT; cloud-only download; offline queue and backoff; rate limit
  waits for the reset; delete only explicit; the token only in the header; Test connection reads only and warns on a public repository.
- **Formulas, factors, units, code references:** none (§4 does not apply).
