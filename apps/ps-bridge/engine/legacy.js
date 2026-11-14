/* apps/ps-bridge/engine/legacy.js — "From the old app": read-only import of the old Prestressed Bridge Design data (window.PSBLegacy).
   Classic script, no DOM. Created 2026-11-13 (docs/ps-bridge-plan.md §2.4 and §5 PR 2f; docs/prestressed-rebuild-plan.md §9.2).

   READ ONLY (CLAUDE.md §5): this file reads the old app's keys with storage.getItem and never calls setItem or removeItem on any key. Every
   object it returns is a fresh copy (JSON.parse of the stored text), so nothing stored can be changed through it. The old app keeps working.

   Where the old app ("Prestressed Bridge Design.html", frozen at 8fe8650, PR 2a) keeps a girder design (the format: one inputs object of its
   DEFAULTS shape; its bridge model psbeam.bridge.v1 = { v, mode, title, spans, nGirders, S, sel, designs: { 'G<g>/S<s>': inputs }, projId }):
     - psbeam.inputs.v1            the design on screen (autosave); with it the bridge model the old app opens with it (the same rule as the
                                   old App(): psbeam.bridge.v1 when it belongs to the open shared project, else that project's psbeamBridge slice)
     - bridgeSuite.v1.projects     the shared Bridge Suite project list: { id: { name, savedAt, slices: { psbeam: inputs, psbeamBridge: bridge, … } } }
     - psbeam.projects.v1          the older project list (before the shared list): { id: { name, savedAt, inp } } (the old app copied it into the
                                   shared list once and kept it)
     - an Export JSON file         the inputs object (the old app's Export JSON); also accepted: a bridge model object
   Not read: psbeam.ui.v1, psbeam.inputTab.v1, psbeam.fold.* (screen preferences), psbeam.redirect.offered.v1, the hand-off keys.

   convert(src) builds a psb2.project from one old design so that the engine inputs of the imported project (engine/design.js inputs(P)) are
   the inputs the old app computed with (its own mergeInputs of the saved object, moved unchanged in engine/pbd-merge.js):
     base       = mergeInputs(saved) (PSBModel.baseInputs: + the PS-10 box, on at 0.75 W, the engineer's default for every psb2 project),
                  without the MIDAS demands (below)
     spans      = the old continuous unit (contUnit of the old engine): cont.spans with the design's L in its span cont.span, else [L];
                  continuity 'composite' when cont.on. The old app with cont.on and fewer than two spans assumed two equal spans [L, L]
                  (this girder in span 1): imported as those two spans, made continuous (the same numbers; the old warning is not repeated).
     xs         = nGirders girders, every bay = S, both overhangs = deck.oh, every support skew = loads.skew
     design     = the girder of the old girder label "G<n> …" when it agrees with the position, else G1 (exterior) or G2 (interior), in the span
                  above; project = the title block (name, by → designer, date, job → number)
     legacy     = { from, source, importedAt, inputs: the saved object exactly as read, bridge: the bridge model as read (every girder × span
                  design: designed from PR 3a), external: the MIDAS demands (not used until the MIDAS import of a later PR), summary }
   Every input difference that remains (a position the girder count cannot give, a negative skew, …) is listed in the summary, never dropped.
   verify(c) computes the design both ways (the old saved inputs, and the imported project) with the same engine and compares every value.
   Needs the moved engine (pbd-*.js), engine/model.js and engine/design.js loaded first. */
(function () {
  'use strict';
  const FROM = 'Prestressed Bridge Design.html';
  const K = { inputs: 'psbeam.inputs.v1', bridge: 'psbeam.bridge.v1', lib: 'psbeam.projects.v1', reg: 'bridgeSuite.v1.projects', cur: 'bridgeSuite.v1.currentProjectId' };
  const SLICE = 'psbeam', BSLICE = 'psbeamBridge';
  const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
  const clone = v => v === undefined ? undefined : JSON.parse(JSON.stringify(v));
  const isNum = v => typeof v === 'number' && isFinite(v);
  const numish = v => (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(+v);
  const PBD = () => window.PBD;
  /* lt(iso): the time in the viewer's local time zone, "YYYY-MM-DD HH:MM" (the text as given when it is not a time) */
  const lt = iso => { const d = new Date(iso), z = n => String(n).padStart(2, '0'); return isNaN(d) ? String(iso || '') : `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())} ${z(d.getHours())}:${z(d.getMinutes())}`; };

  /* ---------- reading the old app's storage (getItem only) ---------- */
  function read(st, k) {
    let raw = null; try { raw = st.getItem(k); } catch (e) { raw = null; }
    if (raw == null) return { raw: null };
    try { return { raw, v: JSON.parse(raw) }; } catch (e) { return { raw, bad: e.message }; }
  }
  /* designOf(b): the inputs of the bridge model's selected cell (as the old app opens a project that has only its bridge slice), else null */
  function designOf(b) {
    if (!isObj(b) || !isObj(b.designs)) return null;
    const s = b.sel || {}, k = 'G' + s.g + '/S' + s.s;
    if (isObj(b.designs[k])) return b.designs[k];
    const ks = Object.keys(b.designs).filter(q => isObj(b.designs[q]));
    return ks.length ? b.designs[ks[0]] : null;
  }
  const validBridge = b => { try { return !!PBD().valid(b); } catch (e) { return false; } };
  const nameOf = inp => isObj(inp) && isObj(inp.proj) ? String(inp.proj.name || '') : '';
  /* scan(storage): { items, notes } — every old-app design found, newest first within each kind; nothing is written */
  function scan(st) {
    const items = [], notes = [];
    const a = read(st, K.inputs), b = read(st, K.bridge), reg = read(st, K.reg), lib = read(st, K.lib);
    let cur = null; try { cur = st.getItem(K.cur); } catch (e) { cur = null; }
    [[K.inputs, a], [K.bridge, b], [K.reg, reg], [K.lib, lib]].forEach(([k, r]) => { if (r.bad) notes.push(`${k} could not be read (${r.bad}); left as it is.`); });
    const R = isObj(reg.v) ? reg.v : {};
    if (isObj(a.v)) {
      // the old App(): the stored bridge model when it belongs to the open shared project, else that project's bridge slice
      let br = null, bk = '';
      if (validBridge(b.v) && (b.v.projId || null) === (cur || null)) { br = b.v; bk = K.bridge; }
      else if (cur && isObj(R[cur]) && isObj(R[cur].slices) && validBridge(R[cur].slices[BSLICE])) { br = Object.assign({}, R[cur].slices[BSLICE], { projId: cur }); bk = `${K.reg} › "${R[cur].name}" (slice ${BSLICE})`; }
      items.push({ id: 'autosave', kind: 'autosave', label: 'The design on screen in the old app (its autosave)', name: nameOf(a.v), savedAt: '', inputs: a.v, bridge: br,
        key: K.inputs + (bk ? ' + ' + bk : '') });
    } else if (a.raw != null && !a.bad) notes.push(`${K.inputs} is not a design (left as it is).`);
    Object.keys(R).map(id => [id, R[id]]).filter(([, e]) => isObj(e) && isObj(e.slices) && (isObj(e.slices[SLICE]) || validBridge(e.slices[BSLICE])))
      .sort((x, y) => String(y[1].savedAt || '').localeCompare(String(x[1].savedAt || '')))
      .forEach(([id, e]) => { const sl = e.slices, br = validBridge(sl[BSLICE]) ? sl[BSLICE] : null;
        items.push({ id: 'reg:' + id, kind: 'project', label: String(e.name || 'Untitled'), name: String(e.name || ''), savedAt: String(e.savedAt || ''), current: id === cur,
          apps: Object.keys(sl), inputs: isObj(sl[SLICE]) ? sl[SLICE] : null, bridge: br,
          key: `${K.reg} › "${e.name || 'Untitled'}" (slice ${isObj(sl[SLICE]) ? SLICE : ''}${isObj(sl[SLICE]) && br ? ' + ' : ''}${br ? BSLICE : ''})` }); });
    if (isObj(lib.v)) Object.keys(lib.v).map(id => [id, lib.v[id]]).filter(([, e]) => isObj(e) && isObj(e.inp))
      .sort((x, y) => String(y[1].savedAt || '').localeCompare(String(x[1].savedAt || '')))
      .forEach(([id, e]) => items.push({ id: 'lib:' + id, kind: 'library', label: String(e.name || 'Untitled'), name: String(e.name || ''), savedAt: String(e.savedAt || ''),
        inputs: e.inp, bridge: null, key: `${K.lib} › "${e.name || 'Untitled'}" (the older project list)` }));
    return { items, notes };
  }

  /* ---------- an old-app file ---------- */
  /* fromText(text, fileName): { ok, src } or { ok: false, error } — an old Export JSON (inputs) or a bridge model object */
  function fromText(text, fileName) {
    let o; try { o = JSON.parse(text); } catch (e) { return { ok: false, error: `Not a JSON file: ${e.message}` }; }
    const f = fileName ? `the file "${fileName}"` : 'the file';
    if (isObj(o) && o.schema === 'psb2.project') return { ok: false, error: 'This is a file of this app: open it with Import JSON.' };
    if (isObj(o) && o._schema === 'psbeam-external-demands') return { ok: false, error: 'This is a MIDAS demands file of the old app, not a design. The MIDAS demand import comes in a later version of this app.' };
    const kind = window.PSBModel.legacyKind(o);
    if (!kind) return { ok: false, error: 'Not a Prestressed Bridge Design (old app) file: an Export JSON of the old app holds a girder design (girder, mat, str, rows, …).' };
    if (isObj(o.designs) && (o.mode === 'pl' || o.mode === 'mod') && !(o.girder != null && Array.isArray(o.rows)))
      return { ok: true, src: { kind: 'file', label: fileName || 'old-app file', name: nameOf(designOf(o)), inputs: null, bridge: o, key: f + ' (an old-app bridge model)', fileName } };
    return { ok: true, src: { kind: 'file', label: fileName || 'old-app file', name: nameOf(o), inputs: o, bridge: null, key: f + ' (the old app\'s Export JSON)', fileName } };
  }

  /* ---------- paths ---------- */
  function leaves(o, pre, out) {   // the paths of the object's plain-object fields (arrays are values)
    Object.keys(o).forEach(k => { const p = pre ? pre + '.' + k : k; if (isObj(o[k]) && Object.keys(o[k]).length) leaves(o[k], p, out); else out.push(p); });
    return out;
  }
  const at = (o, p) => p.split('.').reduce((q, k) => q == null ? undefined : q[k], o);
  const has = (o, p) => { const ks = p.split('.'); let q = o; for (const k of ks) { if (!isObj(q) || !(k in q)) return false; q = q[k]; } return true; };
  const show = v => v === undefined ? '(none)' : typeof v === 'string' ? `"${v}"` : JSON.stringify(v);
  /* same(a, b): equal values (numbers by Object.is; a number entered as text equals the number, as the engine reads it with +) */
  function same(a, b) {
    if (typeof a === 'number' || typeof b === 'number') { if (numish(a) && numish(b)) return Object.is(+a, +b) || (+a === 0 && +b === 0 && typeof a !== typeof b); return Object.is(a, b); }
    return JSON.stringify(a) === JSON.stringify(b);
  }
  function diffs(a, b, pre, out, skip) {
    const ks = new Set([...Object.keys(isObj(a) ? a : {}), ...Object.keys(isObj(b) ? b : {})]);
    ks.forEach(k => { const p = pre ? pre + '.' + k : k; if (skip.includes(p)) return;
      const x = isObj(a) ? a[k] : undefined, y = isObj(b) ? b[k] : undefined;
      if (isObj(x) && isObj(y)) diffs(x, y, p, out, skip); else if (!same(x, y)) out.push({ path: p, old: x, now: y }); });
    return out;
  }

  /* ---------- convert ---------- */
  const LBL = { L: 'span length L', S: 'girder spacing S', nGirders: 'number of girders', 'loads.pos': 'position (interior / exterior)', 'loads.skew': 'skew θ',
    'deck.oh': 'deck overhang', 'cont.on': 'made continuous', 'cont.spans': 'spans of the continuous unit', 'cont.span': 'span of the design in the unit', 'loads.posAuto': 'position follows the shared design beam' };
  /* convert(src[, now]): src = { inputs, bridge, kind, label, key, fileName, name, savedAt } (an item of scan() or fromText().src).
     Returns { ok, project, old, summary } or { ok: false, error }. project.legacy holds what was read; summary = project.legacy.summary. */
  function convert(src, now) {
    const M = window.PSBModel, D = window.PSBDesign;
    const raw = isObj(src && src.inputs) ? src.inputs : designOf(src && src.bridge);
    if (!isObj(raw)) return { ok: false, error: 'No girder design was found in this old-app data.' };
    const items = [], add = (kind, text) => items.push({ kind, text });
    const old = clone(mergeInputs(clone(raw)));   // the inputs the old app computes with (its own merge)
    // what the old app's merge filled or moved (its own migration of older saved designs)
    const Dp = leaves(clone(mergeInputs(null)), '', []).filter(p => p !== 'external' && !/^proj\./.test(p));
    const filled = Dp.filter(p => !has(raw, p) && !(p === 'opt.longAsBot' && has(raw, 'opt.longAs')));
    const known = p => Dp.includes(p) || Dp.some(q => q.startsWith(p + '.') || p.startsWith(q + '.'));
    const unknown = leaves(clone(raw), '', []).filter(p => !known(p) && !/^proj(\.|$)/.test(p) && !/^external(\.|$)/.test(p) && !(p === 'opt.longAs' && !has(raw, 'opt.longAsBot')));
    // base: the old inputs without the MIDAS demands
    const ext = old.external != null ? clone(old.external) : null;
    const extOn = !!(ext && ext._schema === 'psbeam-external-demands' && Array.isArray(ext.stations) && ext.stations.length);
    const base = M.baseInputs(Object.assign(clone(raw), { external: null }));
    const eff = clone(old); eff.external = null;   // the old inputs as this app can hold them
    // the bridge the old design was computed on
    const L = +old.L, c = isObj(old.cont) ? old.cont : {};
    const cs = Array.isArray(c.spans) ? c.spans.map(Number).filter(v => v > 0) : [];
    let lengths, s = 1, contOn = !!c.on;
    const xsp = extOn ? PBD().extSpans(ext) : null;   // MIDAS demands (not used here): the imported member's spans, as the old bridge model takes them
    if (xsp && xsp.length) { lengths = xsp.map(q => +q.len); const q = ext._selSpan; s = q && q.idx ? Math.min(Math.max(1, +q.idx), lengths.length) : 1; lengths[s - 1] = L; }
    else if (cs.length >= 2) { s = Math.min(Math.max(1, Math.round(+c.span) || 1), cs.length); lengths = cs.slice(); lengths[s - 1] = L; }
    else if (contOn) { lengths = [L, L]; s = 1; }
    else lengths = [L];
    const nbIn = Math.round(+old.nGirders), nb = isFinite(nbIn) && nbIn >= 2 ? nbIn : Math.max(2, Math.round(+old.nGirders || 4));   // the engine's own rule (distFactors) when not 2 or more
    const pos = old.loads && old.loads.pos === 'exterior' ? 'exterior' : 'interior';
    const m = /^\s*G\s*(\d+)/i.exec(String((old.proj && old.proj.girderId) || '')), gl = m ? +m[1] : 0;
    const ext_ = g => g === 1 || g === nb;
    let g = gl >= 1 && gl <= nb && (ext_(gl) === (pos === 'exterior')) ? gl : (pos === 'exterior' ? 1 : (nb >= 3 ? 2 : 1));
    const skew = numish(old.loads && old.loads.skew) ? +old.loads.skew : 0, oh = numish(old.deck && old.deck.oh) ? +old.deck.oh : 0, S = +old.S;
    const pj = isObj(old.proj) ? old.proj : {};
    const P = M.defaultProject();
    P.project = { name: String(pj.name || src.name || src.label || 'Imported design'), number: String(pj.job || ''), owner: '', designer: String(pj.by || ''), checker: '', date: String(pj.date || ''), notes: '' };
    P.spans = { lengths, continuity: contOn ? 'composite' : 'simple' };
    P.xs = { nb, bays: Array.from({ length: nb - 1 }, () => S), ohL: oh, ohR: oh, skews: Array.from({ length: lengths.length + 1 }, () => skew) };
    P.base = base; P.design = { g, s };
    // the input differences left (engine inputs of the imported project vs the old inputs)
    // left out: proj (the title block, below), the PS-10 box (new in this app, below) and, when the old design is not made continuous over two
    // or more entered spans, cont.spans / cont.span (the engine reads them only for a continuous unit, contUnit; the one-span case is noted below)
    const inp = D.inputs(P), dif = diffs(eff, inp, '', [], ['proj', 'opt.hdCheck', 'opt.hdFrac'].concat(contOn && cs.length >= 2 && !xsp ? [] : ['cont.spans', 'cont.span']));
    // ---- summary
    const when = now || new Date().toISOString();
    const fm = v => isNum(v) ? String(+v.toFixed(4)) : show(v);
    add('src', `From ${src.key || src.label || 'the old app'}${src.savedAt ? `, saved ${lt(src.savedAt)}` : ''}; read ${lt(when)} (local time). Read only: the old app's data is not changed.`);
    add('ok', `Girder design: ${old.girder}, ${(old.rows || []).reduce((a, r) => a + (+r.n || 0), 0)} straight + ${+(old.harp && old.harp.n) || 0} draped strands, owner ${old.owner || 'AASHTO'}; every girder input of the old design is in this project's base design (Girders & strands, Materials, Diaphragms / deck, Loads, Owner rules tabs).`);
    add('ok', `Bridge: span${lengths.length > 1 ? 's' : ''} ${lengths.map(fm).join(', ')} ft (${contOn && lengths.length > 1 ? 'made continuous for composite loads' : 'simple'}), ${nb} girders at S = ${fm(S)} ft, overhangs ${fm(oh)} ft, skew ${fm(skew)}° at every support; design girder ${D.label(P, g)} in span ${s} (L = ${fm(L)} ft).`);
    add('ok', `Title block: name, designer (old "by"), date and number (old "job").`);
    if (!xsp && contOn && cs.length < 2) add('note', `The old design was made continuous with one span entered: the old app assumed two equal spans of ${fm(L)} ft (this girder in span 1) and warned about it. Imported as two spans of ${fm(L)} ft, made continuous (the same analysis and values; the old warning and the record of the assumption, cont.unit.src / assumed, are not repeated).`);
    if (!xsp && cs.length >= 2 && contOn && Math.abs(cs[Math.min(Math.max(1, Math.round(+c.span) || 1), cs.length) - 1] - L) > 0.005)
      add('diff', `The old bridge bar had span ${s} = ${fm(cs[s - 1])} ft but the design's L = ${fm(L)} ft (the old app used L and warned): imported with span ${s} = ${fm(L)} ft (the warning is not repeated).`);
    const oldLab = String(pj.girderId || ''), newLab = inp.proj && inp.proj.girderId;
    if (oldLab && oldLab !== newLab) add('note', `Girder label: old "${oldLab}", now "${newLab}" (from the girder count and position).`);
    dif.forEach(d => add('diff', `Input ${LBL[d.path] || d.path}: old ${show(d.old)}, imported ${show(d.now)}${d.path === 'loads.pos' ? ` (with ${nb} girders every girder is exterior)` : d.path === 'loads.skew' ? ' (this app takes the skew as |θ|)' : ''}.`));
    if (filled.length) add('mig', `${filled.length} input${filled.length > 1 ? 's were' : ' was'} not in the saved design and take${filled.length > 1 ? '' : 's'} the old app's default, as the old app does (its mergeInputs): ${filled.slice(0, 12).join(', ')}${filled.length > 12 ? ', …' : ''}.`);
    if (has(raw, 'opt.longAs') && !has(raw, 'opt.longAsBot')) add('mig', `Older field opt.longAs = ${show(raw.opt.longAs)} read as the bottom tie steel opt.longAsBot, as the old app does.`);
    if (unknown.length) add('kept', `Field${unknown.length > 1 ? 's' : ''} the old app's engine does not use, kept as they are in the base design: ${unknown.slice(0, 12).join(', ')}${unknown.length > 12 ? ', …' : ''}.`);
    if (ext) add(extOn ? 'diff' : 'kept', extOn ? `MIDAS demands (imported in the old app${ext.member && ext.member.name ? `, member "${ext.member.name}"` : ''}, ${ext.stations.length} stations${ext._selSpan && ext._selSpan.idx ? `, span ${ext._selSpan.idx}` : ''}): kept in the project, NOT used: this app has no MIDAS demand import yet (a later PR). The design is computed with the built-in analysis instead, so its results differ from the old app's.`
      : 'An empty or unreadable MIDAS demands object (not used by the old app either): kept in the project.');
    const br = isObj(src && src.bridge) ? src.bridge : null;
    if (br) {
      const sk = br.sel ? 'G' + br.sel.g + '/S' + br.sel.s : '', other = Object.keys(isObj(br.designs) ? br.designs : {}).filter(k => k !== sk && isObj(br.designs[k]));
      add('kept', `Old bridge model (${br.mode === 'mod' ? '"Design modules": each girder design kept its own span and spacing' : '"Preliminary designer"'}; ${(br.spans || []).length} span${(br.spans || []).length === 1 ? '' : 's'} × ${br.nGirders} girders; design on screen ${sk || '—'})${other.length ? `: ${other.length} other girder × span design${other.length > 1 ? 's' : ''} (${other.slice(0, 10).join(', ')}${other.length > 10 ? ', …' : ''}) kept in the project and restored as girder types on their lines (PS-17; listed below)` : ''}.`);
      if (Array.isArray(br.spans) && br.mode !== 'mod' && JSON.stringify(br.spans.map(Number)) !== JSON.stringify(lengths) && !extOn)
        add('note', `The old bridge bar's spans (${br.spans.join(', ')} ft) are not the spans the design was computed with (${lengths.map(fm).join(', ')} ft): imported as computed.`);
      if (isObj(src.inputs) && isObj(br.designs) && sk && isObj(br.designs[sk]) && JSON.stringify(br.designs[sk]) !== JSON.stringify(src.inputs))
        add('note', `The bridge model's copy of ${sk} is not the saved design on screen: the saved design was imported (the old app opens that one).`);
    } else add('note', 'One girder design (no old bridge model with it).');
    const ie = window.PSBInputCheck ? window.PSBInputCheck.collect(P).errors : [];
    if (ie.length) add('err', `${ie.length} input error${ie.length > 1 ? 's' : ''} in this app (results are not shown until fixed): ${ie.slice(0, 6).map(e => e.msg).join(' ')}${ie.length > 6 ? ' …' : ''}`);
    add('not', 'Not imported: the old app\'s screen preferences (tabs, folds, chart choices), its Undo / Redo history, and its hand-off links (locks, adopted hand-offs): this app sends and receives no hand-offs before the switch-over (PS-14 c).');
    const legacy = { from: FROM, source: { kind: src.kind || '', label: src.label || '', key: src.key || '', fileName: src.fileName || '', savedAt: src.savedAt || '' }, importedAt: when,
      inputs: clone(isObj(src.inputs) ? src.inputs : raw), bridge: br ? clone(br) : null, external: ext, summary: { items, results: null } };
    P.legacy = legacy;
    return { ok: true, project: P, old, summary: legacy.summary, inputDiffs: dif, extOn };
  }

  /* ---------- verify: the design computed both ways ---------- */
  /* canon(v): a text of v where every number keeps its identity (NaN, ±∞, −0); functions left out */
  function canon(v) {
    if (typeof v === 'number') return Object.is(v, -0) ? '-0' : String(v);
    if (v === null || typeof v !== 'object') return typeof v === 'function' ? '' : JSON.stringify(v);
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    return '{' + Object.keys(v).filter(k => typeof v[k] !== 'function').map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
  }
  function firstDiffs(a, b, pre, out, n) {
    if (out.length >= n) return out;
    if (a !== null && b !== null && typeof a === 'object' && typeof b === 'object') {
      const ks = new Set([...Object.keys(a), ...Object.keys(b)]);
      for (const k of ks) { if (typeof a[k] === 'function' || typeof b[k] === 'function') continue; firstDiffs(a[k], b[k], pre ? pre + '.' + k : k, out, n); if (out.length >= n) break; }
    } else if (canon(a) !== canon(b)) out.push(pre);
    return out;
  }
  /* verify(c): computes the old inputs (the old app's) and the imported project's engine inputs with the same moved engine; records in
     c.summary.results { same, values, warns, nChecks, diffs, ps10 } and returns it. Values = everything computeAll returns but its warnings. */
  function verify(c) {
    // PS-31: an old box / voided slab name is computed with the old library entry (engine/sections.js withLegacy): the comparison is of the
    // import (the old inputs and this project's, both before the section correction); the correction itself is applied after (ui/legacy.js)
    const WL = fn => (window.PSBSections ? window.PSBSections.withLegacy(fn) : fn());
    const Ro = WL(() => computeAll(clone(c.old))), inp = window.PSBDesign.inputs(c.project), Rn = WL(() => computeAll(clone(inp)));
    // the record of how the continuous unit was found (contUnit: src 'assumed' / 'bridge', assumed, Lbridge) differs where the old design had
    // one span entered or a bridge-bar span other than L (imported as computed, see convert): compared apart from the values
    const REC = ['src', 'assumed', 'Lbridge'];
    const val = R => { const o = Object.assign({}, R); delete o.warns; if (o.cont && o.cont.unit) { o.cont = Object.assign({}, o.cont, { unit: Object.assign({}, o.cont.unit) }); REC.forEach(k => delete o.cont.unit[k]); } return o; };
    const rec = R => REC.map(k => R.cont && R.cont.unit ? R.cont.unit[k] : undefined);
    const vSame = canon(val(Ro)) === canon(val(Rn)), wSame = canon(Ro.warns) === canon(Rn.warns);
    const rSame = canon(rec(Ro)) === canon(rec(Rn));
    const res = { same: vSame && wSame && rSame, values: vSame, warns: wSame, record: rSame, recDiffs: rSame ? [] : REC.filter((k, i) => canon(rec(Ro)[i]) !== canon(rec(Rn)[i])).map(k => 'cont.unit.' + k), nChecks: (Ro.checks || []).length, error: Ro.error || null,
      diffs: vSame ? [] : firstDiffs(val(Ro), val(Rn), '', [], 8), warnDiffs: wSame ? [] : (Ro.warns || []).filter(w => !(Rn.warns || []).includes(w)).concat((Rn.warns || []).filter(w => !(Ro.warns || []).includes(w))).slice(0, 4) };
    // PS-10 (PR 2d-3): the check this app adds for AASHTO / RIDOT, not in the old app
    try { const R10 = window.PSBHoldDown.apply(inp, Rn); if (R10 && R10.ps10 && !R10.ps10.off) { const k = R10.checks[R10.checks.length - 1]; res.ps10 = { r: k.r, pass: k.pass, owner: R10.ps10.owner, frac: R10.ps10.frac }; } } catch (e) { /* none */ }
    c.summary.results = res;
    return res;
  }
  /* sources(storage): scan(storage).items as short descriptions for a list: { id, kind, label, name, savedAt, key, current, apps, girder, spans, cells } */
  function describe(it) {
    const d = isObj(it.inputs) ? it.inputs : designOf(it.bridge) || {}, b = it.bridge;
    return { girder: d.girder || '', L: d.L, cells: b && isObj(b.designs) ? Object.keys(b.designs).length : 0, spans: b && Array.isArray(b.spans) ? b.spans.length : 0, nGirders: b ? b.nGirders : d.nGirders,
      ext: !!(d.external && d.external._schema === 'psbeam-external-demands') };
  }
  /* ---------- restore: the other girder × span designs of an old bridge model as girder types (PR 3a-4, engineer decision PS-17) ----------
     restore(P[, now]): a project imported from the old app with its bridge model (P.legacy.bridge) and not yet restored (no
     P.legacy.restored): every other stored cell 'G<g>/S<s>' of the old model whose line and span exist in this project becomes a girder
     line of a type of span s — its girder inputs (the old app's own mergeInputs of the stored design) minus the bridge values the line gets
     (L, S, N_b, position, skew, overhang, continuity, title: PSBDesign.DRIVEN) and the MIDAS demands are its overrides of the base design;
     cells of one span with the same overrides share a type; a cell with no override joins the span's type of the design on screen when that
     line has no type yet. Lines of the old model with no stored design and cells beyond this bridge are listed, not assigned. Each restored
     cell is computed both ways (the old app's inputs of that cell: PBD.applyBridge on the old model in "Preliminary designer", the stored
     design in "Design modules"; this project's cell inputs) and the result recorded (the same, or how it differs). P is changed (types,
     legacy.restored, legacy.summary.items); the old data as read (legacy.inputs, legacy.bridge) is not. Returns the notice text or ''. */
  function restore(P, now) {
    const BR = window.PSBBridge, D = window.PSBDesign, L = P && P.legacy;
    if (!BR || !D || !isObj(L) || !isObj(L.bridge) || L.restored || !isObj(L.bridge.designs) || !P.base) return '';
    BR.migrate(P);
    const br = L.bridge, sk = br.sel ? 'G' + br.sel.g + '/S' + br.sel.s : '', nb = P.xs.nb, ns = P.spans.lengths.length;
    const DRV = D.DRIVEN.concat(['external']), drv = k => DRV.some(q => k === q || k.indexOf(q + '.') === 0);
    const out = { at: now || new Date().toISOString(), cells: [], skipped: [], types: [] };
    const groups = new Map();
    Object.keys(br.designs).filter(k => k !== sk && isObj(br.designs[k])).forEach(k => {
      const m = /^G(\d+)\/S(\d+)$/.exec(k); if (!m) { out.skipped.push({ key: k, why: 'not a girder × span cell' }); return; }
      const g = +m[1], s = +m[2];
      if (!(g >= 1 && g <= nb && s >= 1 && s <= ns)) { out.skipped.push({ key: k, why: `beyond this bridge (${nb} girders, ${ns} span${ns > 1 ? 's' : ''})` }); return; }
      const oi = window.PSBModel.baseInputs(Object.assign(clone(br.designs[k]), { external: null }));
      const ov = BR.diffOvr(P.base, oi); Object.keys(ov).forEach(q => { if (drv(q)) delete ov[q]; });
      const pos = BR.posLabel(P, g), gk = s + '|' + pos + '|' + JSON.stringify(ov);
      if (!groups.has(gk)) groups.set(gk, { s, pos, ov, cells: [] });
      groups.get(gk).cells.push({ key: k, g, s, raw: br.designs[k] });
    });
    groups.forEach(G => {
      const free = G.cells.filter(c => BR.typeAt(P, c.s, c.g) < 0);
      G.cells.filter(c => !free.includes(c)).forEach(c => out.skipped.push({ key: c.key, why: `line G${c.g} of span ${c.s} already has a girder type` }));
      if (!free.length) return;
      let k = -1;
      // the same overrides (none) and position as a type of the span: that type (the design on screen's, as the old app's 'pl' cells shared its inputs)
      k = BR.spanTypes(P, G.s).find(j => JSON.stringify(P.types[j].ovr) === JSON.stringify(G.ov) && BR.typeLines(P, j).length && BR.typeLines(P, j).every(h => BR.posLabel(P, h) === G.pos));
      if (k == null || k < 0) {
        P.types.push({ id: BR.nextId(P), label: `${G.pos} S${G.s} (old ${free.map(c => 'G' + c.g).join(', ')})`, span: G.s, lines: [], ovr: clone(G.ov) }); k = P.types.length - 1;
        out.types.push(P.types[k].id);
      }
      free.forEach(c => { BR.assignLine(P, k, c.g); out.cells.push({ key: c.key, g: c.g, s: c.s, type: P.types[k].id }); });
    });
    // computed both ways
    out.cells.forEach(c => {
      const k = BR.typeAt(P, c.s, c.g), inp = D.cellInputs(P, k, c.g);
      let oldInp = clone(mergeInputs(clone(br.designs[c.key])));
      if (br.mode !== 'mod') oldInp = PBD().applyBridge(br, oldInp, c.g, c.s);
      oldInp.external = null;
      const val = R => { const o = Object.assign({}, R); delete o.warns; if (o.cont && o.cont.unit) { o.cont = Object.assign({}, o.cont, { unit: Object.assign({}, o.cont.unit) }); ['src', 'assumed', 'Lbridge'].forEach(q => delete o.cont.unit[q]); } return o; };
      let Ro, Rn; try { const WL = fn => (window.PSBSections ? window.PSBSections.withLegacy(fn) : fn());   // PS-31: old names with the old entries (as verify)
        Ro = WL(() => computeAll(clone(oldInp))); Rn = WL(() => computeAll(clone(inp))); } catch (e) { c.same = false; c.why = e.message; return; }
      c.same = canon(val(Ro)) === canon(val(Rn));
      if (!c.same) { const dd = diffs(Object.assign(clone(oldInp), { proj: 0, opt: Object.assign({}, oldInp.opt, { hdCheck: 0, hdFrac: 0 }) }), Object.assign(clone(inp), { proj: 0, opt: Object.assign({}, inp.opt, { hdCheck: 0, hdFrac: 0 }) }), '', [], []);
        c.why = dd.length ? dd.slice(0, 5).map(d => `${LBL[d.path] || d.path} old ${show(d.old)}, here ${show(d.now)}`).join('; ') : 'the same inputs; ' + firstDiffs(val(Ro), val(Rn), '', [], 3).join(', '); }
    });
    L.restored = out;
    const nSame = out.cells.filter(c => c.same).length, un = BR.unassigned(P);
    const text = out.cells.length
      ? `Restored from the old app's bridge model (PS-17): ${out.cells.length} more girder × span design${out.cells.length > 1 ? 's' : ''} (${out.cells.map(c => c.key).join(', ')}) as girder types on their lines${out.types.length ? ` (${out.types.length} new type${out.types.length > 1 ? 's' : ''})` : ''}; ${nSame} of ${out.cells.length} compute the same as the old app${nSame < out.cells.length ? `; different: ${out.cells.filter(c => !c.same).map(c => `${c.key} (${c.why})`).join('; ')}` : ''}.`
        + (out.skipped.length ? ` Not restored: ${out.skipped.map(q => `${q.key} (${q.why})`).join('; ')}.` : '') + (un.length ? ` Lines with no girder type (not checked): ${un.map(q => `G${q.g}/S${q.s}`).join(', ')} — Girders & strands tab, "Assign every line".` : '')
        + (L.external ? ' The MIDAS demands stay kept, not used (PS-18).' : '')
      : (out.skipped.length ? `The old bridge model's other designs were not restored: ${out.skipped.map(q => `${q.key} (${q.why})`).join('; ')}.` : '');
    if (text && L.summary && Array.isArray(L.summary.items)) L.summary.items.push({ kind: out.cells.length && nSame === out.cells.length ? 'ok' : 'note', text });
    return text;
  }
  window.PSBLegacy = { restore, FROM, KEYS: K, lt, scan, fromText, convert, verify, describe, designOf, canon };
})();
