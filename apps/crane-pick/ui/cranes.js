/* apps/crane-pick/ui/cranes.js — the crane library and the project's cranes (window.CranePickCraneUI). C2-1 (2026-11-16).
   Library (this browser): localStorage crane.library.v1 = { v: 1, cranes: { <key>: { def, src, at, fp } } }. Filled by
     - "Load crane library from GitHub": the engineer's private repository (default mlococo88/Structural_References, branch crane-charts,
       folder "Crane Load Charts/library/"; editable, kept in crane.libsrc), read with the token of the Cloud sync setup
       (shared/github-sync.js settings and client: the token goes only in the Authorization header of requests to api.github.com; it is
       never in a URL, a message, a log or a file);
     - "Load crane file(s)": JSON files picked on this computer;
     - the crane editor (ui/craneedit.js: a chart pasted from Excel).
   Project: "Add to project" copies the crane into P.cranes (engine/model.js), so a saved, exported or synced project carries its chart
   data. Cloud sync copies saved projects to the repository set in Cloud sync (any repository the user names): before a project with chart
   data is saved there, its visibility is checked (crane.syncCheck) and a public (or unchecked) repository is warned about.
   Cards: source document, revision, date, preliminary flag, rating basis (% of tipping), terms, the configs, the plan dimensions, the
   phase-4 inputs (outrigger loads, C4). Report: §"Cranes". */
(function () {
  'use strict';
  const A = window.CranePickApp, M = window.CranePickModel, K = window.CranePickCranes, esc = A.esc;
  const GS = () => window.SharedGitHubSync;
  const DEF_SRC = { owner: 'mlococo88', repo: 'Structural_References', branch: 'crane-charts', folder: 'Crane Load Charts/library/' };
  const fmt = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  let el = null, busy = false, status = '', lastErrs = [], srcOpen = false;
  /* ---------- storage ---------- */
  const readJ = k => { try { const t = A.LS.getItem(k); return t ? JSON.parse(t) : null; } catch (e) { return null; } };
  const writeJ = (k, v) => { try { A.LS.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } };
  function lib() { const v = readJ(M.KEYS.library); return v && v.v === 1 && v.cranes && typeof v.cranes === 'object' ? v : { v: 1, cranes: {} }; }
  function libSrc() { const v = readJ(M.KEYS.libsrc) || {}; return { owner: String(v.owner || DEF_SRC.owner), repo: String(v.repo || DEF_SRC.repo), branch: String(v.branch || DEF_SRC.branch), folder: String(v.folder == null ? DEF_SRC.folder : v.folder) }; }
  /* addToLibrary(def, src) -> { ok, key, message } (replaces the same make / model) */
  function addToLibrary(def, src) {
    const L = lib(), k = K.key(def);
    L.cranes[k] = { def, src: Object.assign({ at: new Date().toISOString() }, src || {}), at: new Date().toISOString(), fp: K.fingerprint(def) };
    if (!writeJ(M.KEYS.library, L)) return { ok: false, key: k, message: 'this browser\'s storage is full or blocked: the crane was not kept in the library (it can still be added to the project)' };
    return { ok: true, key: k };
  }
  function removeFromLibrary(k) { const L = lib(); delete L.cranes[k]; writeJ(M.KEYS.library, L); }
  /* ---------- loading ---------- */
  function ingest(obj, src) {
    const r = K.parse(obj); if (!r.ok) return { ok: false, errors: r.errors, warnings: r.warnings };
    const s = addToLibrary(r.crane, src);
    return { ok: true, key: s.key, crane: r.crane, warnings: r.warnings.concat(s.ok ? [] : [s.message]) };
  }
  function loadFiles(files) {
    const list = Array.from(files || []); if (!list.length) return Promise.resolve([]);
    return Promise.all(list.map(f => new Promise(res => { const rd = new FileReader();
      rd.onload = () => { let j; try { j = JSON.parse(String(rd.result)); } catch (e) { res({ name: f.name, ok: false, errors: ['not JSON: ' + e.message] }); return; }
        res(Object.assign({ name: f.name }, ingest(j, { from: 'file', name: f.name }))); };
      rd.onerror = () => res({ name: f.name, ok: false, errors: ['the file could not be read'] }); rd.readAsText(f); })))
      .then(rs => { report(rs, 'file'); return rs; });
  }
  /* loadGitHub(fetchFn) -> results; every request goes through shared/github-sync.js client (api.github.com, Authorization header) */
  async function loadGitHub(fetchFn) {
    const G = GS(); if (!G) { say('Cloud sync (shared/github-sync.js) did not load.', 'err'); return []; }
    const s = G.settings(A.LS);
    if (!s.token) { say('No GitHub token in this browser. Set up Cloud sync first (Project tab → Save and open → Saved projects… → Cloud sync (GitHub)…): its token is used to read the crane library. The token needs Contents: Read on the library repository.', 'err'); return []; }
    const src = libSrc(), folder = src.folder.replace(/^\/+|\/+$/g, '');
    const c = G.client({ owner: src.owner, repo: src.repo, branch: src.branch, token: s.token }, fetchFn || ((u, o) => window.fetch(u, o)));
    busy = true; say(`Reading ${esc(src.owner)}/${esc(src.repo)} (${esc(src.branch)}) …`); draw();
    try {
      const t = await c.tree(folder);
      if (!t.ok) { say(`GitHub: ${esc(t.message)}${t.kind === 'notfound' ? ` Check the repository, branch and folder (Library settings), and that the Cloud sync token can read ${esc(src.owner)}/${esc(src.repo)} (Contents: Read).` : ''}`, 'err'); return []; }
      const paths = [...t.files.keys()].filter(p => p.slice(folder.length + 1).indexOf('/') < 0 && /\.json$/i.test(p)).sort();
      if (!paths.length) { say(`No .json crane files in "${esc(folder)}" on ${esc(src.owner)}/${esc(src.repo)} (${esc(src.branch)}).`, 'err'); return []; }
      const out = [];
      for (const p of paths) {
        const r = await c.raw(p); const nm = p.slice(folder.length + 1);
        if (!r.ok) { out.push({ name: nm, ok: false, errors: [r.message] }); if (r.kind === 'auth' || r.kind === 'offline' || r.kind === 'rate') break; continue; }
        let j; try { j = JSON.parse(r.text); } catch (e) { out.push({ name: nm, ok: false, errors: ['not JSON'] }); continue; }
        out.push(Object.assign({ name: nm }, ingest(j, { from: 'github', repo: `${src.owner}/${src.repo}@${src.branch}`, path: p })));
      }
      report(out, 'github'); return out;
    } finally { busy = false; draw(); }
  }
  function report(rs, how) {
    const ok = rs.filter(r => r.ok), bad = rs.filter(r => !r.ok);
    lastErrs = rs.filter(r => !r.ok || (r.warnings && r.warnings.length));
    say(`${how === 'github' ? 'GitHub library' : 'Files'}: ${ok.length} crane${ok.length === 1 ? '' : 's'} loaded into this browser's library${bad.length ? `, ${bad.length} not loaded` : ''}.`, bad.length ? 'warn' : '');
    // project copies of the same crane: offer the library copy when the chart data differ
    draw();
  }
  function say(t, kind) { status = t ? `<p class="note crStat${kind ? ' ' + kind : ''}" role="status">${t}</p>` : ''; const s = el && el.querySelector('#crStatus'); if (s) s.innerHTML = status; }
  /* ---------- the project ---------- */
  const pc = id => A.P.cranes.find(c => c.id === id) || null;
  function addToProject(k) {
    const e = lib().cranes[k]; if (!e) return null;
    const ex = A.P.cranes.find(c => K.key(c.def) === k);
    if (ex) { A.notice(`${esc(K.name(e.def))} is already in this project.`); return ex.id; }
    const c = M.normCrane({ def: e.def, src: Object.assign({}, e.src, { from: e.src && e.src.from || 'library' }), fp: K.fingerprint(e.def) });
    A.update(P => { P.cranes.push(c); }, 'cranes', { id: c.id });
    syncWarn(true); return c.id;
  }
  function addDefToProject(def, src) {
    const c = M.normCrane({ def, src, fp: K.fingerprint(def) });
    A.update(P => { const i = P.cranes.findIndex(x => K.key(x.def) === K.key(def)); if (i >= 0) P.cranes[i] = Object.assign(c, { id: P.cranes[i].id }); else P.cranes.push(c); }, 'cranes', { id: c.id });
    syncWarn(true); return c.id;
  }
  function used(id) { return (A.P.setups || []).some(s => s.craneId === id); }
  function removeFromProject(id) {
    if (used(id)) { A.notice('This crane is placed on the map: remove its setups (Lifts tab) first.', 'warn'); return; }
    A.update(P => { P.cranes = P.cranes.filter(c => c.id !== id); }, 'cranes');
  }
  function updateFromLibrary(id) {
    const c = pc(id), e = c && lib().cranes[K.key(c.def)]; if (!e) return;
    const def = JSON.parse(JSON.stringify(e.def)); def.app_inputs = Object.assign({}, e.def.app_inputs || {}, c.def.app_inputs || {}); delete def.app_inputs.edited;
    A.update(() => { c.def = def; c.src = Object.assign({}, e.src); c.fp = K.fingerprint(def); }, 'cranes', { id });
  }
  /* ---------- Cloud sync: where chart data can go ---------- */
  let checking = false, acked = {};
  function syncInfo() {
    const G = GS(); if (!G) return null; const s = G.settings(A.LS); if (!G.configured(s)) return null;
    const repo = `${s.owner}/${s.repo}`, ck = readJ(M.KEYS.syncCheck), fresh = ck && ck.owner === s.owner && ck.repo === s.repo && Date.now() - Date.parse(ck.at || 0) < 7 * 864e5;
    const named = /^all-structural$/i.test(s.repo);   // this tool's own public repository
    return { repo, s, named, priv: named ? false : fresh ? ck.private : null, at: fresh ? ck.at : null };
  }
  async function checkRepo(fetchFn) {
    const G = GS(), i = syncInfo(); if (!i || checking) return i;
    checking = true;
    try { const r = await G.client(i.s, fetchFn || ((u, o) => window.fetch(u, o))).repo();
      if (r.ok && r.json && typeof r.json.private === 'boolean') writeJ(M.KEYS.syncCheck, { owner: i.s.owner, repo: i.s.repo, private: r.json.private, at: new Date().toISOString() });
    } finally { checking = false; }
    draw(); return syncInfo();
  }
  function syncHtml() {
    const i = syncInfo(); if (!i || !A.P.cranes.length) return '';
    const bad = i.priv !== true;
    return `<div class="crOut${bad ? ' bad' : ''}" id="crSync"><b>Cloud sync: crane chart data</b><br>Saved projects are copied to <b>${esc(i.repo)}</b> with the crane charts they carry.
      ${i.priv === true ? `That repository was checked: <b>private</b> (${esc(String(i.at).slice(0, 10))}).`
        : i.priv === false ? `<b>That repository is PUBLIC${i.named ? ' (it is this tool\'s own public repository)' : ''}: the manufacturer chart data would be published.</b> Use Save as → "This browser only" for projects with cranes, or point Cloud sync to a private repository.`
        : 'Its visibility has not been checked: treat it as public until checked.'}
      <div class="goRow"><button type="button" data-ca="check"${checking ? ' disabled' : ''}>Check the repository</button></div></div>`;
  }
  function syncWarn(added) {
    const i = syncInfo(); if (!i || !A.P.cranes.length) return;
    if (i.priv === null && !checking) checkRepo().catch(() => {});
    if (added && i.priv !== true) A.notice(`This project now holds crane chart data. Cloud sync copies saved projects to <b>${esc(i.repo)}</b>${i.priv === false ? ', a <b>PUBLIC</b> repository' : ' (visibility not checked yet)'}: see the Cranes tab before saving to GitHub.`, 'warn', { id: 'crSyncNote' });
  }
  /* beforeSave(name) (ui/project.js): false = do not save. Asks once per repository and session when the repository is public or
     unchecked and the project would be uploaded (not held as "This browser only"). */
  function beforeSave(name) {
    const i = syncInfo(); if (!i || !A.P.cranes.length || i.priv === true) return true;
    let held = false; try { const t = JSON.parse(A.LS.getItem(GS().KEY + '.tool.crane-pick') || '{}'); held = !!(t.hold && t.hold[name]); } catch (e) { held = false; }
    if (held) return true;
    if (i.priv === null && acked[i.repo]) return true;
    const ok = window.confirm(i.priv === false
      ? `${i.repo} is a PUBLIC repository. Saving "${name}" uploads its crane chart data (manufacturer load charts) there.\n\nOK = save and upload anyway. Cancel = do not save (use Save as → "This browser only").`
      : `Saving "${name}" uploads its crane chart data to ${i.repo}, whose visibility has not been checked (Cranes tab → Check the repository).\n\nOK = save and upload. Cancel = do not save.`);
    if (ok && i.priv === null) acked[i.repo] = true;
    return ok;
  }
  /* ---------- the tab ---------- */
  const chip = (t, cls, tip) => `<span class="chip${cls ? ' ' + cls : ''}"${tip ? ` title="${esc(tip)}"` : ''}>${esc(t)}</span>`;
  const range = a => a && a.length ? (a[0] === a[a.length - 1] ? fmt(a[0], 1) : `${fmt(a[0], 1)}–${fmt(a[a.length - 1], 1)}`) : '—';
  function srcText(src) { if (!src) return '—'; if (src.from === 'github') return `GitHub ${src.repo || ''}: ${src.path || ''}`; if (src.from === 'file') return `file ${src.name || ''}`; if (src.from === 'paste') return 'entered / pasted in this tool'; return src.from || '—'; }
  function cardHtml(c) {
    const d = c.def, s = d.source || {}, ai = d.app_inputs || {}, p = K.planDims(d), le = lib().cranes[K.key(d)], fp = K.fingerprint(d);
    const zoned = (d.configs || []).some(g => g.zone !== '360'), ph = ai.ph4 || {};
    const num = (k, v, lbl, unit, hint) => `<div class="fRow"><label for="cr_${k}_${c.id}">${lbl}</label><input type="text" inputmode="decimal" id="cr_${k}_${c.id}" data-cr="${c.id}" data-k="${k}" value="${v == null ? '' : v}" placeholder="${esc(hint || '')}"><span class="unit">${unit}</span></div>`;
    return `<div class="shCard crCard" id="crCard-${c.id}"><div class="shHead"><b class="shName">${esc(K.name(d))}</b>${chip(d.type || 'type not set')}${d.preliminary ? chip('PRELIMINARY', 'chipW', 'The source document is marked preliminary') : ''}${ai.edited ? chip('edited here', 'chipW', 'Chart data changed in this tool: ' + (ai.edited.at || '')) : ''}</div>
      <div class="kv">${[['Source document', esc(s.doc || '—')], ['Revision', esc(s.revision || '—')], ['Date', esc(s.date || '—')], ['Pages', esc(s.pages || '—')], ['File', esc(s.file || '—')],
        ['Loaded from', esc(srcText(c.src))], ['Chart data fingerprint', `<code>${fp}</code>${le && le.fp !== fp ? ' <span class="warnT">(library copy differs)</span>' : ''}`]].map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('')}</div>
      ${s.terms ? `<p class="note"><b>Terms:</b> ${esc(s.terms)}</p>` : ''}
      ${d.preliminary ? '<p class="note warnT"><b>Preliminary document:</b> confirm every value against the final chart for the machine.</p>' : ''}
      <div class="tscroll"><table class="tbl"><thead><tr><th>Config</th><th>Support</th><th>Zone</th><th>Boom (ft)</th><th>Radius (ft)</th><th>Rating basis</th></tr></thead><tbody>
      ${(d.configs || []).map(g => { const rb = K.ratingBasis(g, d); return `<tr><td>${esc(g.label || g.id)}</td><td>${esc(g.support || '—')}</td><td>${esc(K.ZONES[g.zone] || g.zone)}</td><td class="n">${range(g.chart && g.chart.boom_lengths_ft)}</td><td class="n">${range(g.chart && g.chart.radii_ft)}</td>
        <td>${rb.from === 'notes' ? esc(rb.text) : `<input type="text" inputmode="decimal" class="crRb" aria-label="Rating basis, % of tipping, ${esc(g.id)}" data-cr="${c.id}" data-rb="${esc(g.id)}" value="${rb.from === 'entered' ? rb.pct : ''}" placeholder="% of tipping"> %${rb.from ? '' : ' <span class="warnT">not stated</span>'}`}${K.interpPermitted(g) ? '<br><span class="note">notes: interpolation between radii permitted</span>' : ''}</td></tr>`; }).join('') || '<tr><td colspan="6">No load charts in this file' + (d.configs_note ? ': ' + esc(d.configs_note) : '') + '.</td></tr>'}</tbody></table></div>
      ${zoned ? `<div class="shBlk"><div class="note"><b>Working-area zones</b> (from the chart's working-area diagram; slew angle from the carrier front). A zone chart is used only inside its sector; not set = not used (the 360° or over-side chart applies).</div>
        ${num('secF', ai.sectors && ai.sectors.front, 'Over-front half-angle', '°', 'not set')}${num('secR', ai.sectors && ai.sectors.rear, 'Over-rear half-angle', '°', 'not set')}</div>` : ''}
      <div class="shBlk"><div class="note"><b>Plan dimensions</b> (the map symbol and plan clearances): ${planText(p)}${p.assumed.length ? `<br><span class="warnT">Assumed: ${esc(p.assumed.join('; '))}.</span>` : ''} (Edit… to change)</div></div>
      ${(() => { const CG = window.CranePickCraneGfx; let q = null; try { q = CG && CG.dims(d); } catch (e) { q = null; } return q && q.assumed.length ? `<div class="shBlk"><div class="note" id="crGfxAss-${c.id}"><b>Crane symbol</b> (map, drawings, DXF; drawing only, no check uses it): ${esc(q.boomType)} boom; assumed where the file has no dimension: ${esc(q.assumed.join('; '))}.</div></div>` : ''; })()}
      ${geomHtml(c, num)}
      <div class="shBlk"><div class="note"><b>For outrigger / track loads (Ground)</b>: from the manufacturer when known. All the weights and CGs entered → rigid-body loads ("entered data"); otherwise, with the gross operating weight, the bounding estimate.</div>
        ${num('upLb', ph.upperLb, 'Upperworks weight', 'lb')}${num('upCg', ph.upperCg, 'Upperworks CG from rotation', 'ft', '+ toward the boom')}
        ${num('caLb', ph.carrierLb, d.type === 'crawler' ? 'Carbody + crawlers weight' : 'Carrier weight', 'lb')}${num('caCg', ph.carrierCg, (d.type === 'crawler' ? 'Carbody' : 'Carrier') + ' CG from rotation', 'ft', '+ toward the front')}
        ${num('boLb', ph.boomLb, 'Boom weight', 'lb', '0 = included in the upperworks')}${num('boCf', ph.boomCgF, 'Boom CG (fraction of the foot-to-tip distance)', '', '0.5 (assumed)')}
        ${num('cwLb', ph.cwLb, 'Counterweight', 'lb', (() => { const g = (d.configs || []).find(x => x.counterweight_lb != null); return g ? 'from the chart configuration' : 'not in the file'; })())}${num('cwR', ph.cwRad, 'Counterweight CG radius', 'ft', p.tail != null ? fmt(p.tail, 2) + ' (tail swing, assumed)' : '')}
        ${num('grLb', ph.grossLb, 'Gross operating weight (no counterweight)', 'lb', window.CranePickGround && window.CranePickGround.fileGross(d) ? fmt(window.CranePickGround.fileGross(d), 0) + ' (file)' : 'for the estimate')}
        ${num('flt', ph.floatFt, d.type === 'crawler' ? 'Track shoe width' : 'Float size', 'ft', d.type === 'crawler' ? (p.crawler && p.crawler.shoe != null ? String(p.crawler.shoe) + ' (file)' : '') : (p.outr && p.outr.float != null ? String(p.outr.float) + ' (file)' : ''))}</div>
      ${(d.gaps || []).length ? `<details class="crSteps"><summary>Gaps noted in the file (${d.gaps.length})</summary><ul class="note">${d.gaps.map(g => `<li>${esc(g)}</li>`).join('')}</ul></details>` : ''}
      <div class="goRow"><button type="button" data-ca="edit" data-id="${c.id}">Edit…</button>${le && le.fp !== fp ? `<button type="button" data-ca="upd" data-id="${c.id}">Use the library copy</button>` : ''}${window.CranePickPlace ? `<button type="button" data-ca="place" data-id="${c.id}">Place on the map</button>` : ''}<button type="button" class="danger" data-ca="rm" data-id="${c.id}">Remove from project</button></div></div>`;
  }
  /* C3-1: the elevation geometry (engine/elev.js geomOf): entered here (app_inputs.geom), else the file's, else the stated assumption */
  function geomHtml(c, num) {
    const EL = window.CranePickElev; if (!EL) return '';
    const g = EL.geomOf(c.def), gi = (c.def.app_inputs || {}).geom || {}, f = k => g.from[k] === 'file' ? fmt(g[k], 2) + ' (file)' : g.from[k] === 'assumed' ? 'assumed' : '';
    return `<div class="shBlk"><div class="note"><b>Elevation geometry</b> (heights, hook reach, 3D clearances; above the crane pad): boom-foot pin ${fmt(g.footE, 2)} ft ahead of rotation (${esc(EL.FROM[g.from.footE])}; Edit… to change), tail swing ${g.tail == null ? '?' : fmt(g.tail, 2)} ft${isFinite(g.maxAng) && g.maxAng != null ? `, maximum boom angle ${fmt(g.maxAng, 1)}° (file)` : ''}.</div>
      ${num('gfH', gi.footH, 'Boom-foot pin height', 'ft', f('footH'))}${num('ghd', gi.head, 'Head allowance (tip pin to the highest block position)', 'ft', f('head'))}${num('gbw', gi.boomW, 'Boom section width', 'ft', f('boomW'))}
      ${num('gcb', gi.cwBot, 'Counterweight bottom above the pad', 'ft', f('cwBot'))}${num('gct', gi.cwTop, 'Counterweight top above the pad', 'ft', g.from.cwTop === 'file' ? f('cwTop') : 'not limited')}
      ${g.assumed.length ? `<p class="note warnT" id="crGeoAss-${c.id}">Assumed (not in the file, not entered): ${esc(g.assumed.join('; '))}. Decision (pending engineer review): the lowest boom (conservative for the hook reach and for anything under the boom; not for a power line above it).</p>` : ''}</div>`;
  }
  function planText(p) {
    const f = v => v == null ? '?' : fmt(v, 2);
    const parts = [`tail swing ${f(p.tail)} ft`];
    if (p.kind === 'crawler') parts.push(p.crawler ? `crawler ${f(p.crawler.length)} ft long, gauge ${f(p.crawler.gauge)} ft, shoe ${f(p.crawler.shoe)} ft` : 'crawler not dimensioned');
    else { const o = p.outr || {}; parts.push(`outrigger beams ${f(o.xFront)} ft ahead / ${f(o.xRear)} ft behind rotation`, `spreads ${Object.keys(o.spreads || {}).map(k => `${esc(k)} ${f(o.spreads[k])}`).join(', ') || '?'} ft`, `floats ${f(o.float)} ft`); }
    if (p.body) parts.push(`body ${f(p.body.front + p.body.rear)} × ${f(p.body.width)} ft`);
    return parts.join(' · ');
  }
  function draw() {
    if (!el) return;
    const L = lib(), keys = Object.keys(L.cranes).sort(), src = libSrc(), inP = new Set(A.P.cranes.map(c => K.key(c.def)));
    el.innerHTML = `<div class="sec"><div class="secHead">Crane library (this browser)</div><div class="secBody">
        <div class="goRow"><button type="button" class="primary" data-ca="gh"${busy ? ' disabled' : ''}>Load crane library from GitHub</button><button type="button" data-ca="files">Load crane file(s)…</button><button type="button" data-ca="new">New crane (paste a chart)…</button></div>
        <input type="file" id="crFiles" accept=".json,application/json" multiple hidden>
        <details class="crSteps" id="crSrc"${srcOpen ? ' open' : ''}><summary>Library settings (GitHub)</summary>
          <div class="fRow"><label for="crSrcOwner">Owner</label><input type="text" id="crSrcOwner" value="${esc(src.owner)}" autocomplete="off" spellcheck="false"></div>
          <div class="fRow"><label for="crSrcRepo">Repository</label><input type="text" id="crSrcRepo" value="${esc(src.repo)}" autocomplete="off" spellcheck="false"></div>
          <div class="fRow"><label for="crSrcBranch">Branch</label><input type="text" id="crSrcBranch" value="${esc(src.branch)}" autocomplete="off" spellcheck="false"></div>
          <div class="fRow"><label for="crSrcFolder">Folder</label><input type="text" id="crSrcFolder" value="${esc(src.folder)}" autocomplete="off" spellcheck="false"></div>
          <div class="goRow"><button type="button" data-ca="srcSave">Save settings</button><button type="button" data-ca="srcReset">Defaults</button></div>
          <p class="note">Read with the Cloud sync token of this browser (Saved projects… → Cloud sync (GitHub)…); the token needs Contents: Read on this repository. Nothing is written to it.</p></details>
        <div id="crStatus">${status}</div>
        ${lastErrs.length ? `<details class="crSteps" id="crLoadMsgs"><summary>Messages (${lastErrs.length} file${lastErrs.length > 1 ? 's' : ''})</summary><ul class="note">${lastErrs.map(r => `<li><b>${esc(r.name)}</b>: ${esc((r.errors || []).concat(r.warnings || []).join(' · '))}</li>`).join('')}</ul></details>` : ''}
        ${keys.length ? `<div class="itGrp">${keys.map(k => { const e = L.cranes[k], d = e.def; return `<div class="itRow"><span class="itSel" title="${esc(srcText(e.src))}">${esc(K.name(d))} ${d.preliminary ? chip('PRELIM.', 'chipW') : ''}</span><span class="itSum">${(d.configs || []).length} chart${(d.configs || []).length === 1 ? '' : 's'}</span>
          ${inP.has(k) ? chip('in project', 'chipOk') : `<button type="button" class="tbBtn" data-ca="add" data-k="${esc(k)}">Add to project</button>`}<button type="button" class="itDel" data-ca="lrm" data-k="${esc(k)}" title="Remove from this browser's library" aria-label="Remove ${esc(K.name(d))} from the library">×</button></div>`; }).join('')}</div>`
          : '<p class="note">The library is empty: load it from GitHub or from files. The chart data stay in this browser and in the projects that use them.</p>'}
      </div></div>
      <div class="sec"><div class="secHead">Cranes in this project (${A.P.cranes.length})</div><div class="secBody">${syncHtml()}
        ${A.P.cranes.length ? A.P.cranes.map(cardHtml).join('') : '<p class="note">No crane yet: "Add to project" from the library. The project keeps its own copy of each crane (a saved project is self-contained).</p>'}</div></div>`;
  }
  function onClick(e) {
    const b = e.target.closest('[data-ca]'); if (!b) return; const a = b.dataset.ca;
    if (a === 'gh') loadGitHub().catch(x => say('GitHub: ' + esc(x.message), 'err'));
    else if (a === 'files') el.querySelector('#crFiles').click();
    else if (a === 'new') window.CranePickCraneEdit && window.CranePickCraneEdit.open(null);
    else if (a === 'add') addToProject(b.dataset.k);
    else if (a === 'lrm') { if (confirm('Remove this crane from this browser\'s library? Projects that use it keep their own copy.')) { removeFromLibrary(b.dataset.k); draw(); } }
    else if (a === 'rm') removeFromProject(b.dataset.id);
    else if (a === 'upd') updateFromLibrary(b.dataset.id);
    else if (a === 'edit') window.CranePickCraneEdit && window.CranePickCraneEdit.open(b.dataset.id);
    else if (a === 'place') window.CranePickPlace && window.CranePickPlace.placeCrane(b.dataset.id);
    else if (a === 'check') checkRepo().catch(() => {});
    else if (a === 'srcSave' || a === 'srcReset') {
      const v = a === 'srcReset' ? DEF_SRC : { owner: el.querySelector('#crSrcOwner').value.trim(), repo: el.querySelector('#crSrcRepo').value.trim(), branch: el.querySelector('#crSrcBranch').value.trim(), folder: el.querySelector('#crSrcFolder').value.trim() };
      if (!/^[A-Za-z0-9-]{1,39}$/.test(v.owner) || !/^[A-Za-z0-9._-]{1,100}$/.test(v.repo) || !v.branch) { say('Enter the owner, the repository and the branch.', 'err'); return; }
      writeJ(M.KEYS.libsrc, v); say('Library settings saved.'); srcOpen = true; draw();
    }
  }
  function onChange(e) {
    const t = e.target;
    if (t.id === 'crFiles') { const f = t.files; loadFiles(f).then(() => { t.value = ''; }); return; }
    const c = t.dataset.cr && pc(t.dataset.cr); if (!c) return;
    const v = t.value.trim() === '' ? null : Number(t.value.replace(/,/g, ''));
    if (v !== null && !isFinite(v)) { t.classList.add('bad'); return; } t.classList.remove('bad');
    if (t.dataset.rb) { if (v !== null && !(v > 0 && v <= 100)) { t.classList.add('bad'); return; } A.update(() => { const ai = c.def.app_inputs; ai.rating = Object.assign({}, ai.rating); if (v === null) delete ai.rating[t.dataset.rb]; else ai.rating[t.dataset.rb] = v; }, 'cranes', { id: c.id }); return; }
    const k = t.dataset.k;
    if (k === 'secF' || k === 'secR') { if (v !== null && !(v >= 0 && v <= 180)) { t.classList.add('bad'); return; } A.update(() => { const ai = c.def.app_inputs; ai.sectors = Object.assign({}, ai.sectors, { [k === 'secF' ? 'front' : 'rear']: v }); }, 'cranes', { id: c.id }); return; }
    const gk = { gfH: 'footH', ghd: 'head', gbw: 'boomW', gcb: 'cwBot', gct: 'cwTop' }[k];   // C3-1: app_inputs.geom
    if (gk) { if (v !== null && v < 0) { t.classList.add('bad'); return; } A.update(() => { const ai = c.def.app_inputs; ai.geom = Object.assign({}, ai.geom); if (v === null) delete ai.geom[gk]; else ai.geom[gk] = v; }, 'cranes', { id: c.id }); return; }
    const map = { upLb: 'upperLb', upCg: 'upperCg', caLb: 'carrierLb', caCg: 'carrierCg', flt: 'floatFt', boLb: 'boomLb', boCf: 'boomCgF', cwLb: 'cwLb', cwR: 'cwRad', grLb: 'grossLb' };   // C4: boom, counterweight, gross weight
    if (map[k]) { if (v !== null && v < 0 && !/Cg$/.test(k)) { t.classList.add('bad'); return; } A.update(() => { const ai = c.def.app_inputs; ai.ph4 = Object.assign({}, ai.ph4, { [map[k]]: v }); }, 'cranes', { id: c.id }); }
  }
  /* ---------- Report: §Cranes ---------- */
  window.CranePickReport && window.CranePickReport.add(P => {
    if (!P.cranes.length) return [];
    return [{ id: 'cranes', key: 'cranes', title: 'Cranes', subs: P.cranes.map((c, n) => {
      const d = c.def, s = d.source || {}, ph = (d.app_inputs || {}).ph4 || {}, p = K.planDims(d);
      const items = [{ type: 'kv', rows: [['Crane', K.name(d)], ['Type', d.type || '—'], ['Source document', s.doc || '—'], ['Revision', s.revision || '—'], ['Date', s.date || '—'], ['Pages', s.pages || '—'],
        ['Preliminary document', d.preliminary ? 'YES: confirm every value against the final chart' : 'no'], ['Loaded from', srcText(c.src)], ['Chart data fingerprint', K.fingerprint(d) + ((d.app_inputs || {}).edited ? ' (edited in this tool)' : '')]] }];
      if (s.terms) items.push({ type: 'note', text: 'Terms of the source: ' + s.terms });
      items.push({ type: 'table', head: ['Config', 'Support', 'Zone', 'Boom (ft)', 'Radius (ft)', 'Rating basis'], rows: (d.configs || []).map(g => [g.label || g.id, g.support || '—', K.ZONES[g.zone] || g.zone, range(g.chart.boom_lengths_ft), range(g.chart.radii_ft), K.ratingBasis(g, d).text]) });
      const sec = (d.app_inputs || {}).sectors;
      if ((d.configs || []).some(g => g.zone !== '360')) items.push({ type: 'note', text: `Working-area sectors (entered): over front ±${sec && sec.front != null ? sec.front + '°' : ' not set'}; over rear ±${sec && sec.rear != null ? sec.rear + '°' : ' not set'} about the carrier axis. A zone chart is used only inside its sector.` });
      items.push({ type: 'note', text: 'Plan dimensions: ' + planText(p).replace(/<[^>]+>/g, '') + (p.assumed.length ? '. Assumed: ' + p.assumed.join('; ') : '') + '.' });
      { const CG = window.CranePickCraneGfx; let q = null; try { q = CG && CG.dims(d); } catch (e) { q = null; }
        if (q && q.assumed.length) items.push({ type: 'note', text: `Crane symbol on the plans (drawing only; no check uses it): ${q.boomType} boom; assumed where the file has no dimension: ${q.assumed.join('; ')}.` }); }
      if (window.CranePickElev) { const g = window.CranePickElev.geomOf(d), F = window.CranePickElev.FROM, r = (k, nm) => [nm, (g[k] == null ? 'not limited' : fmt(g[k], 2)) + ' (' + F[g.from[k]] + ')'];
        items.push({ type: 'kv', rows: [r('footH', 'Boom-foot pin height above the pad (ft)'), r('footE', 'Boom-foot pin ahead of rotation (ft)'), r('head', 'Head allowance (ft)'), r('boomW', 'Boom section width (ft)'), r('cwBot', 'Counterweight bottom (ft)'), r('cwTop', 'Counterweight top (ft)'), ['Maximum boom angle', g.maxAng == null ? 'not given' : fmt(g.maxAng, 1) + '° (file)']] });
        if (g.assumed.length) items.push({ type: 'note', warn: true, text: 'Elevation geometry assumed (not in the file, not entered): ' + g.assumed.join('; ') + '. Decision (pending engineer review): the lowest boom.' }); }
      if (['upperLb', 'upperCg', 'carrierLb', 'carrierCg', 'floatFt', 'boomLb', 'boomCgF', 'cwLb', 'cwRad', 'grossLb'].some(k => ph[k] != null)) items.push({ type: 'kv', rows: [['Upperworks weight (lb)', fmt(ph.upperLb, 0)], ['Upperworks CG from rotation (ft)', fmt(ph.upperCg, 2)], ['Carrier / carbody weight (lb)', fmt(ph.carrierLb, 0)], ['Carrier / carbody CG (ft)', fmt(ph.carrierCg, 2)], ['Float / shoe size (ft)', fmt(ph.floatFt, 2)],
        ['Boom weight (lb)', fmt(ph.boomLb, 0)], ['Boom CG (fraction foot to tip)', ph.boomCgF == null ? '0.50 (assumed)' : fmt(ph.boomCgF, 2)], ['Counterweight (lb)', ph.cwLb == null ? 'chart configuration' : fmt(ph.cwLb, 0)], ['Counterweight CG radius (ft)', ph.cwRad == null ? 'tail-swing radius (assumed)' : fmt(ph.cwRad, 2)], ['Gross operating weight (lb)', fmt(ph.grossLb, 0)]] });
      if (window.CranePickCraneTab) items.push(...window.CranePickCraneTab.reportItems(P, c.id));   // C9: the Crane tab's figures and input table per setup used by a lift
      return { id: 'c' + (n + 1), key: 'crane-' + c.id, title: K.name(d), items };
    }) }];
  });
  /* ---------- wiring ---------- */
  function build(p) { el = p; p.addEventListener('click', onClick); p.addEventListener('change', onChange); p.addEventListener('toggle', e => { if (e.target.id === 'crSrc') srcOpen = e.target.open; }, true); draw(); }
  A.inTab({ id: 'cranes', label: 'Cranes', build, show: () => { draw(); syncWarn(false); } });
  A.on('project', draw); A.on('change', o => { if (o.kind === 'cranes' || o.kind === 'setups') draw(); });
  window.CranePickCraneUI = { lib, libSrc, DEF_SRC, addToLibrary, removeFromLibrary, ingest, loadFiles, loadGitHub, addToProject, addDefToProject, removeFromProject, updateFromLibrary,
    syncInfo, checkRepo, beforeSave, redraw: draw, crane: pc, srcText, planText };
})();
