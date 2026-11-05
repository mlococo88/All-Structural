// An in-memory stand-in for the parts of the GitHub REST API that shared/github-sync.js uses (repository, branch, contents
// GET / PUT / DELETE, raw downloads), for the Node tests (tests/engine/github-sync.test.mjs, through fetch) and the browser smoke
// test (tests/smoke/github-sync.mjs, through a Playwright route). Test tooling only: no tool loads it.
// File shas are real git blob shas (sha-1 of "blob <bytes>\0<bytes>"), computed here with node:crypto, so the shared file's own
// SHA-1 is checked against them.
import crypto from 'node:crypto';

export const gitBlobSha = text => { const b = Buffer.from(text, 'utf8'); return crypto.createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${b.length}\0`), b])).digest('hex'); };

export function makeGitHubMock({ owner = 'mlococo88', repo = 'structural-projects', branch = 'main', token = 'github_pat_TESTTOKEN0123456789abcd', isPrivate = true } = {}) {
  const files = new Map();   // path -> text
  const log = [];            // { method, url, auth, body }
  const m = { files, log, offline: false, rate: false, token, commits: [],
    /* edit a file "on another device" */
    setRemote(path, text) { files.set(path, text); m.commits.push({ path, message: 'remote edit' }); },
    handle(method, url, headers, bodyText) {
      headers = Object.fromEntries(Object.entries(headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
      log.push({ method, url, auth: headers.authorization || null, body: bodyText || null });
      const J = (status, obj, extra) => ({ status, headers: { 'content-type': 'application/json; charset=utf-8', 'access-control-allow-origin': '*', 'access-control-expose-headers': 'x-ratelimit-remaining, x-ratelimit-reset, retry-after', ...(extra || {}) }, body: JSON.stringify(obj) });
      if (method === 'OPTIONS') return { status: 204, headers: { 'access-control-allow-origin': '*', 'access-control-allow-methods': 'GET, PUT, DELETE', 'access-control-allow-headers': 'Authorization, Content-Type, Accept, X-GitHub-Api-Version' }, body: '' };
      if (m.rate) return J(403, { message: 'API rate limit exceeded' }, { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': String(Math.floor(Date.now() / 1000) + 600) });
      if (headers.authorization !== `Bearer ${m.token}`) return J(401, { message: 'Bad credentials' });
      const u = new URL(url);
      if (u.origin !== 'https://api.github.com') return J(400, { message: 'wrong host' });
      const pre = `/repos/${owner}/${repo}`;
      if (!u.pathname.startsWith(pre)) return J(404, { message: 'Not Found' });
      const rest = u.pathname.slice(pre.length);
      if (rest === '' && method === 'GET') return J(200, { full_name: `${owner}/${repo}`, private: isPrivate, default_branch: branch, permissions: { admin: true, push: true, pull: true } });
      if (rest.startsWith('/git/trees/') && method === 'GET') {
        if (decodeURIComponent(rest.slice(11)) !== branch) return J(404, { message: 'Not Found' });
        const tree = []; const dirs = new Set();
        for (const [p, t] of files) { const parts = p.split('/'); for (let i = 1; i < parts.length; i++) dirs.add(parts.slice(0, i).join('/')); tree.push({ path: p, mode: '100644', type: 'blob', sha: gitBlobSha(t), size: Buffer.byteLength(t) }); }
        for (const d of dirs) tree.push({ path: d, mode: '040000', type: 'tree', sha: 't' + d.length });
        return J(200, { sha: 'root', tree, truncated: false });
      }
      if (rest.startsWith('/branches/')) return decodeURIComponent(rest.slice(10)) === branch ? J(200, { name: branch }) : J(404, { message: 'Branch not found' });
      if (!rest.startsWith('/contents/')) return J(404, { message: 'Not Found' });
      const path = rest.slice(10).split('/').map(decodeURIComponent).join('/');
      if (method === 'GET') {
        if ((u.searchParams.get('ref') || branch) !== branch) return J(404, { message: 'No commit found for the ref' });
        if (files.has(path)) {
          const text = files.get(path), sha = gitBlobSha(text), name = path.split('/').pop();
          if (/raw/.test(headers.accept || '')) return { status: 200, headers: { 'content-type': 'application/vnd.github.raw', 'access-control-allow-origin': '*' }, body: text };
          return J(200, { type: 'file', name, path, sha, size: Buffer.byteLength(text), encoding: 'base64', content: Buffer.from(text, 'utf8').toString('base64').replace(/(.{60})/g, '$1\n') });
        }
        const kids = [...files.keys()].filter(p => p.startsWith(path + '/') && !p.slice(path.length + 1).includes('/'));
        if (!kids.length) return J(404, { message: 'Not Found' });
        return J(200, kids.map(p => ({ type: 'file', name: p.split('/').pop(), path: p, sha: gitBlobSha(files.get(p)), size: Buffer.byteLength(files.get(p)) })));
      }
      let body = {}; try { body = JSON.parse(bodyText || '{}'); } catch (e) { return J(400, { message: 'Problems parsing JSON' }); }
      if ((body.branch || branch) !== branch) return J(404, { message: 'Branch not found' });
      if (method === 'PUT') {
        if (typeof body.message !== 'string' || !body.message) return J(422, { message: 'Invalid request. "message" wasn\'t supplied.' });
        if (files.has(path)) {
          if (!body.sha) return J(422, { message: 'Invalid request. "sha" wasn\'t supplied.' });
          if (body.sha !== gitBlobSha(files.get(path))) return J(409, { message: `${path} does not match ${body.sha}` });
        } else if (body.sha) return J(409, { message: `${path} does not match ${body.sha}` });   // GitHub: sha given for a file that is not there
        const text = Buffer.from(body.content, 'base64').toString('utf8'); const isNew = !files.has(path);
        files.set(path, text); m.commits.push({ path, message: body.message });
        return J(isNew ? 201 : 200, { content: { name: path.split('/').pop(), path, sha: gitBlobSha(text) }, commit: { sha: 'c' + m.commits.length, message: body.message } });
      }
      if (method === 'DELETE') {
        if (!files.has(path)) return J(404, { message: 'Not Found' });
        if (body.sha !== gitBlobSha(files.get(path))) return J(409, { message: 'sha mismatch' });
        files.delete(path); m.commits.push({ path, message: body.message, deleted: true });
        return J(200, { content: null, commit: { sha: 'c' + m.commits.length } });
      }
      return J(405, { message: 'Method not allowed' });
    },
    /* fetch(url, init) for Node: offline -> TypeError like a browser */
    fetch: async (url, init = {}) => {
      if (m.offline) throw new TypeError('Failed to fetch');
      const r = m.handle(init.method || 'GET', String(url), init.headers, init.body);
      return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers });
    }
  };
  return m;
}
