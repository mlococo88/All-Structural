/* apps/ps-bridge/ui/handoffs.js — the Project tab's "Hand-offs" card (window.PSBHandoffUI). Created 2026-11-14 (planned item 12: the old
   app's bridgeSuite.v1.* hand-offs in the new app). The payloads are engine/handoffs.js (PSBHandoffs, the old app's code); the transport is
   ui/bridgexfer.js (BridgeXfer v1, HANDOFF.md §5, verbatim). Keys, schemas and payload formats are the old app's, unchanged (CLAUDE.md §5,
   HANDOFF.md §4), producer 'PS-Beam' as the old app, so every receiving tool reads them as before with no change:
     receive  projectMeta ("Use shared project info"), lldf ("Pull distribution factors"), dlLoads ("Pull DC2 / DW"): read only; the pull
              shows what changes and asks first (HANDOFF.md §3.1, the old app's confirm texts); it writes the girder type shown (the type
              and line chosen above the output tabs: its overrides, as an edit of that type) and the adoption marker
              bridgeSuite.v1.<channel>.adopted.psbridge (receiver id 'psbridge', this app's own).
     send     projectMeta ("Share project info"), superReactions + superReactions.by.psbeam ("Send reactions to Substructure Loading"),
              lldfGeom ("Send geometry to LL & DL"), psSection ("Send section properties"), capacity ("Send capacity to the MCT rating"),
              each with "Export hand-off (JSON)": click only (the old app re-published psSection, and capacity / lldfGeom when locked, by
              itself; here nothing is sent without a click; Decision pending engineer review, fixlog/ps-bridge.md HO-D2).
   Not here (fixlog/ps-bridge.md, Open items): the MCT demands (handoffs / latestId), designBeam / beamRoster, geometryChanges, the channel
   locks (BridgeLocks), appPaths and the shared Bridge Suite project list (switch-over). */
(function () {
  'use strict';
  const H = () => window.PSBHandoffs, BX = () => window.BridgeXfer;
  const FILE = 'apps/ps-bridge/index.html';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  const getRaw = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const isNew = ch => { const b = BX(); return !!(b && b.isNew(ch, H().RX)); };
  const has = ch => !!getRaw('bridgeSuite.v1.' + ch);

  /* the girder type and line the output tabs show (ctx.cell()), its label */
  function shownText(c) { return c ? `${esc(c.label)} on G${c.g}, span ${c.s}` : 'no girder type on a line'; }

  function card(P, c) {
    const n = ch => `<span class="note" data-ho-new="${ch}"${isNew(ch) ? '' : ' hidden'}> · <b>new data</b></span>`;
    const st = ch => has(ch) ? '' : ' <span class="note">(nothing sent yet)</span>';
    const btn = (a, t, tip) => `<button type="button" data-ho="${a}" title="${esc(tip)}">${t}</button>`;
    return `<section class="sec" id="psbHo"><div class="secHead">Hand-offs</div><div class="secBody">
      <p class="note">The same hand-offs as the old Prestressed Bridge Design (same keys and formats; the other tools read them as before). Nothing is applied or sent until you click: each pull shows what changes and asks first. The girder hand-offs are for the girder type and line shown on the output tabs: <b id="hoCell">${shownText(c)}</b>. Opened as files, the tools share data in Chrome or Edge only (one folder); otherwise use the JSON files.</p>
      <p class="note"><b>Receive</b></p>
      <div class="fRow">${btn('pmUse', 'Use shared project info', 'Fill Name, Number, Client name, Designer, Checker and Date from the project info shared by another tool (asks first; never blanks a field)')}</div>
      <div class="fRow">${btn('lldfPull', 'Pull distribution factors', 'The LL & DL Distribution factors for this girder type (DF auto off, DFm, DFv, fatigue DF); asks first')}${n('lldf')}${st('lldf')}</div>
      <div class="fRow">${btn('dlPull', 'Pull DC2 / DW', 'The LL & DL Distribution dead loads DC2 and DW for this girder type; asks first')}${n('dlLoads')}${st('dlLoads')}</div>
      <p class="note">From LL &amp; DL Distribution (lldf.html). DC2 / DW are pulled only while they are entered per girder type (Cross-section tab, DC2 and DW: entered); when this app distributes them to the girder lines the pull says so and changes nothing.</p>
      <p class="note"><b>Send</b></p>
      <div class="fRow">${btn('pmShare', 'Share project info', 'Share this title block with the other tools (bridgeSuite.v1.projectMeta)')}</div>
      <div class="fRow">${btn('srSend', 'Send reactions to Substructure Loading', 'The unfactored DC1, DC2 and DW end reactions of this girder line (kip): bridgeSuite.v1.superReactions and its copy superReactions.by.psbeam')}${btn('srExport', 'Export hand-off (JSON)', 'The same reactions hand-off as a JSON file')}</div>
      <div class="fRow">${btn('geoSend', 'Send geometry to LL &amp; DL', 'Spans, girder count and spacing, deck, skew and girder section properties for LL & DL Distribution (bridgeSuite.v1.lldfGeom)')}${btn('geoExport', 'Export (JSON)', 'The same geometry hand-off as a JSON file')}</div>
      <div class="fRow">${btn('secSend', 'Send section properties', 'The composite section properties and outline for the MCT generator and LL & DL (bridgeSuite.v1.psSection)')}${btn('secExport', 'Export (JSON)', 'The same section hand-off as a JSON file')}</div>
      <div class="fRow">${btn('capSend', 'Send capacity to the MCT rating', 'φMn± and φVn at every station of the girder for the MCT generator\'s AASHTO rating (bridgeSuite.v1.capacity)')}${btn('capExport', 'Export (JSON)', 'The same capacity hand-off as a JSON file')}</div>
      <p class="note">Each send replaces what the old app (or another copy of this app) last sent on the same channel, as two copies of the old app would. The MCT demands, the shared design beam and the channel locks (auto-follow) of the old app are not part of this app yet.</p>
    </div></section>`;
  }

  /* each action; ctx = { P(), result() -> { inp, R }, cell() -> { k, s, g, label } | null, changed() } */
  const say = m => window.alert(m);
  function needR(ctx) { const r = ctx.result(); if (!r || !r.R || r.R.error) { say('Fix the inputs first — the girder shown has an input error' + (r && r.R && r.R.error ? ': ' + r.R.error : '') + '.'); return null; } return r; }
  function exportP(ch, p) { const r = BX().exportFile(ch, p); if (r.error) say('Could not export: ' + r.error); }
  function write(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { say('Could not write to shared storage: ' + e.message); return false; } }

  function pmUse(ctx) {
    const r = BX().read('projectMeta', 'bridge-project-meta', 1);
    if (r.error) { say('No shared project info: ' + r.error); return; }
    const P = ctx.P(), pl = H().pmPlan(P, r.payload), src = BX().describe(r.payload);
    if (!pl.lines.length) { say('Shared project info (' + src + ') already matches this tool. Nothing to change.'); return; }
    if (!window.confirm('Use shared project info?\nFrom: ' + src + '\n\nThis will overwrite:\n' + pl.lines.join('\n'))) return;
    Object.assign(P.project, pl.upd); ctx.changed();
  }
  function pmShare(ctx) {
    const f = H().pmFields(ctx.P());
    const r = BX().publish('projectMeta', { _schema: 'bridge-project-meta', fields: f }, document.title, FILE);
    if (r.error) say('Could not share project info: ' + r.error); else say('Project info shared. Other tools can load it with "Use shared project info".');
  }
  /* the pulls write the girder type shown (its overrides); without girder types (a project not yet migrated) the base design */
  function applyLoads(ctx, fields) { H().applyLoads(ctx.P(), ctx.cell(), fields); ctx.changed(); }
  function lldfPull(ctx) {
    const rr = ctx.result(); if (!rr || !rr.inp) { say('There is no girder design to pull for.'); return; }
    const P = ctx.P(), c = ctx.cell(), inp = rr.inp, raw = getRaw('bridgeSuite.v1.lldf');
    let nb = null; try { nb = raw ? JSON.parse(raw).Nb : null; } catch (e) { nb = null; }
    // the design beam of the old app = the line shown, when LL & DL has the same girder count (its beam numbers are these lines)
    const db = c && nb != null && +nb === +P.xs.nb ? { index: c.g, label: 'G' + c.g, clsLabel: inp.loads.pos === 'exterior' ? 'exterior' : 'interior' } : null;
    const r = H().lldfResolve(inp, raw, db);
    if (r.why) { say(r.why); return; }
    const when = (r.at || '').slice(0, 16).replace('T', ' ');
    const msg = 'Pull from LL & DL Distribution (' + when + ')\nProject: ' + (r.project || '—') + ' · ' + r.src + '\nFor: ' + (c ? c.label + ' (G' + c.g + ', span ' + c.s + ')' : 'the design') + '\n\n'
      + '  g_M +M (moment DF)   = ' + r.gMpos.toFixed(3) + '\n'
      + '  g_M −M (pier region) = ' + r.gMneg.toFixed(3) + (r.hasNeg ? '' : '  (no continuity region → = +M)') + '\n'
      + '  g_V (shear DF)       = ' + r.gV.toFixed(3) + '\n'
      + (r.fatM > 0 ? '  fatigue DF (1 lane)  = ' + r.fatM.toFixed(3) + '\n' : '') + '\n'
      + 'Applies as manual distribution factors (DF auto off): DFm = g_M(+M), DFv = g_V' + (r.fatM > 0 ? ', fatigue DF = single-lane value.' : '.')
      + (c ? '\nIt changes the girder type ' + c.label + ' (every line of that type).' : '')
      + '\n\nApply?';
    if (!window.confirm(msg)) return;
    applyLoads(ctx, H().lldfFields(inp, r));
    BX().markAdopted('lldf', H().RX, r.at);
  }
  function dlPull(ctx) {
    const P = ctx.P(), c = ctx.cell();
    if (H().dlBlocked(P, c ? c.g : (P.design && P.design.g) || 2)) { say('This project distributes DC2 and DW to the girder lines itself (Cross-section tab, DC2 and DW: distributed), so pulled values would not be used. Nothing was changed.\n\nTo use the LL & DL values, set DC2 and DW to entered per girder type first, then pull.'); return; }
    const r = H().dlResolve(getRaw('bridgeSuite.v1.dlLoads'));
    if (r.why) { say(r.why); return; }
    const when = (r.at || '').slice(0, 16).replace('T', ' ');
    const msg = 'Pull dead loads from LL & DL Distribution (' + when + ')\nProject: ' + (r.project || '—') + ' · ' + r.src + (r.trib ? ('  ·  tributary ' + r.trib.toFixed(2) + ' ft') : '') + '\nFor: ' + (c ? c.label + ' (G' + c.g + ', span ' + c.s + ')' : 'the design') + '\n\n'
      + (r.hasBar ? '  DC2  barrier / SIDL   = ' + r.wBar.toFixed(3) + ' klf\n' : '  DC2  barrier / SIDL   — not published; your value is kept\n')
      + (r.hasDW ? '  DW   wearing surface  = ' + r.wDW.toFixed(3) + ' klf\n' : '  DW   wearing surface  — not published; your value is kept\n')
      + (r.dc1 > 0 ? '  (DC1 deck = ' + r.dc1.toFixed(3) + ' klf — NOT applied; this app computes deck + haunch itself)\n' : '')
      + (r.pl > 0 ? '  (PL pedestrian = ' + r.pl.toFixed(3) + ' klf — a live load; enter it on the LL group if it governs)\n' : '')
      + (c ? '\nIt changes the girder type ' + c.label + ' (every line of that type).\n' : '')
      + '\nApply the DC2 and DW values?';
    if (!window.confirm(msg)) return;
    applyLoads(ctx, H().dlTheirs(r));
    BX().markAdopted('dlLoads', H().RX, r.at);
  }
  /* superReactions: the old app's BXSuperRx.send / exportJSON (the same stamp, the copy by.psbeam, the same message) */
  function srBuilt(ctx) { const r = needR(ctx); if (!r) return null; const b = H().srPayload(r.inp, r.R);
    if (!b || b.error || !b.payload) { say('Cannot build the reactions hand-off: ' + ((b && b.error) || 'no results') + '.'); return null; } return b.payload; }
  function srSummary(p) {
    const L = [];
    (p.supports || []).forEach(s => { (s.girders || []).forEach(g => { L.push('  ' + s.id + ' (x = ' + f2(s.x) + ' ft), ' + g.label + ': DC1 ' + f2(g.DC1) + ', DC2 ' + f2(g.DC2) + ', DW ' + f2(g.DW) + ' kip'); }); });
    if (p.liveLoad && p.liveLoad.supports) L.push('  Live load per lane, no IM, no DF (information only): ' + p.liveLoad.supports.map(s => s.id + ' ' + f2(s.Rmax) + ' kip').join(', '));
    return L.join('\n');
  }
  function srSend(ctx) {
    const payload = srBuilt(ctx); if (!payload) return;
    const r = BX().publish('superReactions', payload, H().PRODUCER, FILE);
    if (r.error) { say('Could not send the reactions: ' + r.error); return; }
    write(BX().NS + 'superReactions.by.' + H().SR_ID, JSON.stringify(r.payload));
    say('Reactions sent to Substructure Loading (unfactored, kip, one girder line):\n\n' + srSummary(r.payload) + '\n\nIn Bridge Substructure Loading, Reactions tab, click "Pull from PS-Beam".');
  }
  function srExport(ctx) {
    const payload = srBuilt(ctx); if (!payload) return;
    const p = Object.assign({}, payload); p.schemaVersion = p.schemaVersion || 1; p.producer = p.producer || H().PRODUCER; p.producerFile = p.producerFile || FILE;
    p.producedAt = new Date().toISOString(); if (!p.project) p.project = BX().sharedProject() || { name: '', bridgeId: '' }; if (!p.notes) p.notes = [];
    exportP('superReactions', p);
  }
  /* psSection, lldfGeom, capacity: the old app's payloads, written as the old app wrote them (the key and .updatedAt; lldfGeom the key only) */
  function secSend(ctx, exp) {
    const r = needR(ctx); if (!r) return; const p = H().psSection(r.inp, r.R, new Date().toISOString()); if (!p) { say('No section properties (input error).'); return; }
    if (exp) { exportP('psSection', p); return; }
    if (write('bridgeSuite.v1.psSection', JSON.stringify(p)) && write('bridgeSuite.v1.psSection.updatedAt', p.producedAt))
      say('Section properties sent (composite I = ' + Math.round(p.Ic) + ' in⁴, ' + (p.memberKey || 'this girder') + '). The MCT generator and LL & DL Distribution can use them.');
  }
  function geoSend(ctx, exp) {
    const r = needR(ctx); if (!r) return; const b = H().lldfGeom(r.inp, r.R, new Date().toISOString()); if (b.error) { say(b.error); return; }
    if (exp) { exportP('lldfGeom', b.payload); return; }
    if (write('bridgeSuite.v1.lldfGeom', JSON.stringify(b.payload)))
      say('Geometry sent to LL & DL Distribution (' + b.payload.Nb + ' girders at ' + f3(b.payload.inputs.spacings[0]) + ' ft, span ' + b.payload.inputs.spans.map(f2).join(', ') + ' ft). Open LL & DL Distribution to adopt it.');
  }
  function capSend(ctx, exp) {
    const r = needR(ctx); if (!r) return; const b = H().capacity(r.inp, r.R, new Date().toISOString()); if (b.error) { say(b.error); return; }
    if (exp) { exportP('capacity', b.payload); return; }
    if (write('bridgeSuite.v1.capacity', JSON.stringify(b.payload)) && write('bridgeSuite.v1.capacity.updatedAt', b.payload.producedAt))
      say('Capacity published — ' + b.payload.stationCount + ' stations over ' + b.spans + ' span(s).\n\nOpen the MCT app → AASHTO Rating and apply the "Design capacity received" banner.' + (b.warns.length ? '\n\nWarnings:\n• ' + b.warns.join('\n• ') : ''));
  }

  function onClick(e, ctx) {
    const b = e.target.closest('[data-ho]'); if (!b) return false;
    if (!BX() || !H()) { say('The hand-off helper is not available in this browser.'); return true; }
    const a = b.dataset.ho;
    ({ pmUse, pmShare, lldfPull, dlPull, srSend, srExport, secSend: c => secSend(c, false), secExport: c => secSend(c, true),
      geoSend: c => geoSend(c, false), geoExport: c => geoSend(c, true), capSend: c => capSend(c, false), capExport: c => capSend(c, true) })[a](ctx);
    refresh();
    return true;
  }
  function refresh() { document.querySelectorAll('[data-ho-new]').forEach(s => { s.hidden = !isNew(s.dataset.hoNew); }); }
  function init() { window.addEventListener('storage', e => { if (!e.key || /^bridgeSuite\.v1\.(lldf|dlLoads)/.test(e.key)) refresh(); }); }
  window.PSBHandoffUI = { card, onClick, refresh, init };
})();
