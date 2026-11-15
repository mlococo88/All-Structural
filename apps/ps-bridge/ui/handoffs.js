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
   Batch D3 (2026-11-15): the MCT demands (handoffs / latestId) and geometryChanges: banners above the output tabs (mctBanner), Load by click
   into a girder type (its demands, engine/demands.js), the review window of the geometry changes.
   Batch F (2026-11-15): "Send to Substructure Loading" with the boxes Geometry and Reactions of every girder line, and "Export hand-off
   (JSON)", the Steel Bridge app's row (apps/steel-bridge/ui/handoffs.js subSend): superGeometry (engine sgPayload, HANDOFF.md §4.14) and
   superReactions with allGirders (engine srAll, §4.4), each published (channel key, .updatedAt), its .by copy (superGeometry.by.psbridge;
   superReactions.by.psbeam, the slot the reactions button above writes) and its per-project copy (shared/handoff-store.js, producer id
   psbridge, HANDOFF.md §5.1; uploaded with Cloud sync as the Steel Bridge app's). The one-line "Send reactions" row above is unchanged.
   Batch F3 / F4 (2026-11-15): the old app's Design beam chip above the output tabs (beamChip; designBeam / beamRoster read only, "Show
   G<i>" by click) and "Import hand-off (JSON)" of the distribution factors (lldfPull from a file, the Steel Bridge app's lldfFile).
   Not here (fixlog/ps-bridge.md, Open items): writing designBeam / beamRoster, the channel locks (BridgeLocks; HO-D2 pending), appPaths and the
   shared Bridge Suite project list (switch-over). */
(function () {
  'use strict';
  const H = () => window.PSBHandoffs, BX = () => window.BridgeXfer;
  const FILE = 'apps/ps-bridge/index.html';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f2 = v => (+v).toFixed(2), f3 = v => (+v).toFixed(3);
  const getRaw = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const isNew = ch => { const b = BX(); return !!(b && b.isNew(ch, H().RX)); };
  const has = ch => !!getRaw('bridgeSuite.v1.' + ch);

  /* batch F: the per-project copies of this app's sends (shared/handoff-store.js, producer id psbridge; read only) */
  const HS = () => window.SharedHandoffStore, SEND = { geo: true, rx: true };   // the boxes: this page only, not saved (as the Steel Bridge app)
  const whenL = t => { const d = new Date(t); return t && isFinite(d) ? d.toLocaleString() : 'time unknown'; };
  const lastSent = (P, ch) => { try { const S = HS(); if (!S || !H()) return null; const pid = S.pidOf({ name: String((P.project || {}).name || ''), bridgeId: '' }); if (!pid) return null;
    const t = localStorage.getItem(S.copyKey(ch, H().GEO_ID, pid)); const p = t ? JSON.parse(t) : null; return p && p.producedAt ? p : null; } catch (e) { return null; } };
  /* the girder type and line the output tabs show (ctx.cell()), its label */
  function shownText(c) { return c ? `${esc(c.label)} on G${c.g}, span ${c.s}` : 'no girder type on a line'; }

  function card(P, c) {
    const pname = P && P.project && String(P.project.name || '').trim(), sg = lastSent(P, 'superGeometry'), sr = lastSent(P, 'superReactions');
    const sent = !pname ? 'not kept per project until the project has a name' : sg || sr ? [sg && `Geometry ${esc(whenL(sg.producedAt))}`, sr && `Reactions ${esc(whenL(sr.producedAt))}`].filter(Boolean).join('; ') + ` (project "${esc(pname)}", from this browser)` : `nothing sent yet for project "${esc(pname)}" from this browser`;
    const n = ch => `<span class="note" data-ho-new="${ch}"${isNew(ch) ? '' : ' hidden'}> · <b>new data</b></span>`;
    const st = ch => has(ch) ? '' : ' <span class="note">(nothing sent yet)</span>';
    const btn = (a, t, tip) => `<button type="button" data-ho="${a}" title="${esc(tip)}">${t}</button>`;
    return `<section class="sec" id="psbHo"><div class="secHead">Hand-offs</div><div class="secBody">
      <p class="note">The same hand-offs as the old Prestressed Bridge Design (same keys and formats; the other tools read them as before). Nothing is applied or sent until you click: each pull shows what changes and asks first. The girder hand-offs are for the girder type and line shown on the output tabs: <b id="hoCell">${shownText(c)}</b>. Opened as files, the tools share data in Chrome or Edge only (one folder); otherwise use the JSON files.</p>
      <p class="note"><b>Receive</b></p>
      <div class="fRow">${btn('pmUse', 'Use shared project info', 'Fill Name, Number, Client name, Designer, Checker and Date from the project info shared by another tool (asks first; never blanks a field)')}</div>
      <div class="fRow">${btn('lldfPull', 'Pull distribution factors', 'The LL & DL Distribution factors for this girder type (DF auto off, DFm, DFv, fatigue DF); asks first')}${btn('lldfFile', 'Import hand-off (JSON)', 'The same pull from a bridge-lldf-factors file LL & DL Distribution exported (asks first)')}<input type="file" data-ho-file="lldf" accept=".json,application/json" hidden>${n('lldf')}${st('lldf')}</div>
      <div class="fRow">${btn('dlPull', 'Pull DC2 / DW', 'The LL & DL Distribution dead loads DC2 and DW for this girder type; asks first')}${n('dlLoads')}${st('dlLoads')}</div>
      <p class="note">From LL &amp; DL Distribution (lldf.html). DC2 / DW are pulled only while they are entered per girder type (Cross-section tab, DC2 and DW: entered); when this app distributes them to the girder lines the pull says so and changes nothing.</p>
      <p class="note"><b>Send</b></p>
      <div class="fRow">${btn('pmShare', 'Share project info', 'Share this title block with the other tools (bridgeSuite.v1.projectMeta)')}</div>
      <div class="fRow">${btn('srSend', 'Send reactions to Substructure Loading', 'The unfactored DC1, DC2 and DW end reactions of this girder line (kip): bridgeSuite.v1.superReactions and its copy superReactions.by.psbeam')}${btn('srExport', 'Export hand-off (JSON)', 'The same reactions hand-off as a JSON file')}</div>
      <div class="fRow">${btn('subSend', 'Send to Substructure Loading', 'Every girder line: the bridge geometry (bridgeSuite.v1.superGeometry) and the reactions of every girder line G1 to Gn (bridgeSuite.v1.superReactions, allGirders), as the Steel Bridge app sends them')} <label><input type="checkbox" data-ho-opt="geo"${SEND.geo ? ' checked' : ''}> Geometry</label> <label><input type="checkbox" data-ho-opt="rx"${SEND.rx ? ' checked' : ''}> Reactions of every girder line</label> ${btn('subFile', 'Export hand-off (JSON)', 'The same hand-offs as JSON files (one per ticked box)')}</div>
      <p class="note">The row above sends the girder line shown only (the old app's hand-off). This row, as the Steel Bridge app: <b>Geometry</b>: spans, support skews and joints, girder count, spacings and overhangs, the deck edges (traffic faces), the deck and haunch, and the girder sections (largest depth, flange and web; the depth at each support and the deepest in each span), for Bridge Substructure Loading's "Pull geometry". <b>Reactions</b>: each girder line's unfactored DC1, DC2 and DW at every support (kip) from every girder type on its lines — each span's end reactions are the Analysis tab's (choose the type and line above the output tabs), a pier's the sum of its two spans' (each span's share in the hand-off notes) — for its "Pull from PS-Beam / GirderDetail". Each send is also kept for this project (${pname ? `"${esc(pname)}"` : 'enter a project name on this tab first'}). <b>Last sent:</b> ${sent}.</p>
      <div class="fRow">${btn('geoSend', 'Send geometry to LL &amp; DL', 'Spans, girder count and spacing, deck, skew and girder section properties for LL & DL Distribution (bridgeSuite.v1.lldfGeom)')}${btn('geoExport', 'Export (JSON)', 'The same geometry hand-off as a JSON file')}</div>
      <div class="fRow">${btn('secSend', 'Send section properties', 'The composite section properties and outline for the MCT generator and LL & DL (bridgeSuite.v1.psSection)')}${btn('secExport', 'Export (JSON)', 'The same section hand-off as a JSON file')}</div>
      <div class="fRow">${btn('capSend', 'Send capacity to the MCT rating', 'φMn± and φVn at every station of the girder for the MCT generator\'s AASHTO rating (bridgeSuite.v1.capacity)')}${btn('capExport', 'Export (JSON)', 'The same capacity hand-off as a JSON file')}</div>
      <p class="note">Each send replaces what the old app (or another copy of this app) last sent on the same channel, as two copies of the old app would. The shared design beam is shown above the output tabs (read only; it is chosen in LL &amp; DL). The channel locks (auto-follow) of the old app are not part of this app yet.</p>
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
  /* batch F4 (2026-11-15): raw / via given = an imported hand-off file (the Steel Bridge app's "Import hand-off (JSON)"), read as the pull */
  function lldfPull(ctx, raw0, via) {
    const rr = ctx.result(); if (!rr || !rr.inp) { say('There is no girder design to pull for.'); return; }
    const P = ctx.P(), c = ctx.cell(), inp = rr.inp, raw = raw0 != null ? raw0 : getRaw('bridgeSuite.v1.lldf');
    let nb = null; try { nb = raw ? JSON.parse(raw).Nb : null; } catch (e) { nb = null; }
    // the design beam of the old app = the line shown, when LL & DL has the same girder count (its beam numbers are these lines)
    const db = c && nb != null && +nb === +P.xs.nb ? { index: c.g, label: 'G' + c.g, clsLabel: inp.loads.pos === 'exterior' ? 'exterior' : 'interior' } : null;
    const r = H().lldfResolve(inp, raw, db);
    if (r.why) { say(r.why); return; }
    const when = (r.at || '').slice(0, 16).replace('T', ' ');
    const msg = 'Pull from LL & DL Distribution (' + when + ')' + (via ? '\nVia: ' + via : '') + '\nProject: ' + (r.project || '—') + ' · ' + r.src + '\nFor: ' + (c ? c.label + ' (G' + c.g + ', span ' + c.s + ')' : 'the design') + '\n\n'
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

  /* batch F: subSend(ctx, file): the Steel Bridge app's subSend. Every ticked channel is built first (nothing is sent when one fails), then
     published (channel key, .updatedAt), its .by copy and its per-project copy (and upload with Cloud sync); file: one JSON file per box. */
  async function subSend(ctx, file) {
    const todo = [SEND.geo && 'geo', SEND.rx && 'rx'].filter(Boolean);
    if (!todo.length) { say('Tick Geometry, Reactions or both.'); return; }
    const A = ctx.all ? ctx.all() : null;
    if (!A) { say(`Nothing was ${file ? 'exported' : 'sent'}: fix the inputs first (the input errors are listed above the results).`); return; }
    const P = ctx.P(), built = {}, errs = [];
    todo.forEach(k => { const r = k === 'geo' ? H().sgPayload(P, A.cells) : H().srAll(P, A.cells); if (r.error) errs.push(`${k === 'geo' ? 'Geometry' : 'Reactions'}: ${r.error}`); else built[k] = r; });
    if (errs.length) { say(`Nothing was ${file ? 'exported' : 'sent'}.\n\n${errs.join('\n')}`); return; }
    const dev = HS() ? HS().deviceName(localStorage) : ''; todo.forEach(k => { if (dev) built[k].payload.device = dev; });   // §5.1 optional envelope field
    const CH = { geo: { ch: 'superGeometry', by: H().GEO_ID }, rx: { ch: 'superReactions', by: H().SR_ID } };
    if (file) { todo.forEach(k => exportP(CH[k].ch, Object.assign({}, built[k].payload, { producedAt: new Date().toISOString() }))); return; }
    const out = [], pname = String((P.project || {}).name || '').trim();
    for (const k of todo) {
      const c = CH[k], w = BX().publish(c.ch, built[k].payload, H().PRODUCER, FILE);
      if (w.error) { out.push(`${k === 'geo' ? 'Geometry' : 'Reactions'}: NOT sent: ${w.error} Use "Export hand-off (JSON)" instead.`); continue; }
      write(BX().NS + c.ch + '.by.' + c.by, JSON.stringify(w.payload));   // the .by copy (§4.4, §4.14)
      let cl = '';
      if (HS()) { const r = await HS().send({ storage: localStorage, channel: c.ch, producer: H().GEO_ID, payload: w.payload, fetch: (u, i) => window.fetch(u, i) });
        cl = !r.ok ? ` (the per-project copy was not saved: ${r.error})` : !r.pid ? '' : r.cloud && r.cloud.ok ? '; also uploaded to GitHub' : r.cloud && r.cloud.queued ? `; GitHub upload waiting (${r.cloud.error})` : ''; }
      out.push(k === 'geo' ? `Geometry sent: ${built.geo.sum}${cl}.` : `Reactions sent (unfactored, kip, DC1 / DC2 / DW of every girder line)${cl}:\n${built.rx.sum}`);
    }
    say(`${pname ? `Kept for project "${pname}".` : 'This project has no name, so the send is kept only as the latest hand-off (no project). Enter a project name on this tab to keep one copy per project.'}\n\n${out.join('\n\n')}\n\nIn Bridge Substructure Loading: Project tab, Hand-offs card, "Pull geometry from Steel Bridge Design" and "Pull from PS-Beam / GirderDetail". Each asks which project first.`);
    if (ctx.redrawIn) ctx.redrawIn();   // the card's "Last sent"
  }
  function onClick(e, ctx) {
    const b = e.target.closest('[data-ho]'); if (!b) return false;
    if (!BX() || !H()) { say('The hand-off helper is not available in this browser.'); return true; }
    const a = b.dataset.ho;
    if (a === 'subSend' || a === 'subFile') { subSend(ctx, a === 'subFile'); return true; }
    if (a === 'lldfFile') { const f = b.parentNode.querySelector('[data-ho-file="lldf"]'); if (f) { f.value = ''; f.onchange = () => { const file = f.files && f.files[0]; if (!file) return;   // batch F4
      BX().importFile(file, 'bridge-lldf-factors', 1, r => { if (r.error) { say('Cannot import the hand-off file: ' + r.error); return; } lldfPull(ctx, JSON.stringify(r.payload), 'file ' + file.name); refresh(); }); }; f.click(); } return true; }   // batch F (async: the per-project copy)
    ({ pmUse, pmShare, lldfPull, dlPull, srSend, srExport, secSend: c => secSend(c, false), secExport: c => secSend(c, true),
      geoSend: c => geoSend(c, false), geoExport: c => geoSend(c, true), capSend: c => capSend(c, false), capExport: c => capSend(c, true) })[a](ctx);
    refresh();
    return true;
  }
  function refresh() { document.querySelectorAll('[data-ho-new]').forEach(s => { s.hidden = !isNew(s.dataset.hoNew); }); }
  /* ---- batch D3 (2026-11-15): the MCT demands hand-off and the MCT geometry changes (the old app's banners, O:9603-9662) ----
     mctBanner(P): the banners at the top of the output panel: "New analysis data available" (Load into a girder type / Not now) or, for a
     payload newer than this app reads, "Analysis output is newer than this app" (dismiss); "Geometry has been updated in MCT – click to
     review what changed" (the review window: the changes as the MCT Generator recorded them; Dismiss; Load the demands now). Load, the review
     window's Load and the bridge questions are one change of the project = one Undo step; nothing is applied without a click (the old app's
     lock / auto-adopt: engineer decision HO-D2 pending). The adoption markers are this app's own (bridgeSuite.v1.adopted.psbridge,
     bridgeSuite.v1.geometryChanges.adopted.psbridge); the old app's (.psbeam) are not touched. */
  const setRaw = (k, v) => { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } };
  function mctBanner(P) {
    const h = H(), D = window.PSBDemands, B = window.PSBBridge; if (!h || !h.mctPending || !D || !B) return '';
    let out = '';
    const r = h.mctPending(getRaw);
    if (r) {
      const d = h.mctDescribe(r.payload);
      if (!r.supported) out += `<div class="notice" id="mctBanner" role="status"><div><b>⚠ Analysis output is newer than this app</b>: the MCT Generator published schema <b>v${esc(r.version)}</b>; this app reads <b>v${h.MCT_VERSION}</b>. Update this app to load it, or load a matching file on the Loads tab (Demands card).</div><div class="nBtns"><button type="button" data-mct="dismiss">Dismiss</button></div></div>`;
      else {
        const T = B.types(P), sh = window.PSBDemandsUI && window.PSBDemandsUI.shownType(P), key = /^G(\d+)$/i.exec(d.member || '');
        // the default type: the one on the member's girder line in the span shown (the MCT member is a girder line), else the type shown
        let def = sh ? sh.id : (T[0] && T[0].id);
        if (key && B.hasTypes(P) && sh) { const k = B.typeAt ? B.typeAt(P, sh.span, +key[1]) : -1; if (k >= 0) def = P.types[k].id; }
        out += `<div class="notice mctNew" id="mctBanner" role="status"><div><b>New analysis data available</b> from <b>${esc(d.producer)}</b>${d.project ? ' · ' + esc(d.project) : ''}${d.member ? ' · ' + esc(d.member) : ''} · ${d.n} stations · LL: <b>${esc(d.ll)}</b>.
          Loading replaces the <b>demands of the girder type chosen</b> only (its source becomes this MIDAS member; section, strands and materials stay).
          <label for="mctType">Load into</label> <select id="mctType">${T.map(t => `<option value="${esc(t.id)}"${t.id === def ? ' selected' : ''}>${esc(t.label)} (span ${t.span})</option>`).join('')}</select>
          <span class="note">Auto-adopt (the old app's lock): not in this app yet: the hand-off is loaded only by "Load these demands".</span></div>
          <div class="nBtns"><button type="button" class="pri" data-mct="load">Load these demands</button><button type="button" data-mct="dismiss">Not now</button></div></div>`;
      }
    }
    const g = h.geomPending(getRaw);
    if (g) out += `<div class="notice mctGeo" id="mctGeoBanner" role="status"><div><a href="#" data-mct="geo">Geometry has been updated in MCT – click to review what changed</a> (${(g.changes || []).length} change${(g.changes || []).length === 1 ? '' : 's'}).</div><div class="nBtns"><button type="button" data-mct="geo">Review</button></div></div>`;
    return out;
  }
  /* geoDialog(P): the review window of the geometry changes */
  function geoDialog(P) {
    const h = H(), g = h.geomPending(getRaw); if (!g) return;
    let d = document.getElementById('mctGeoDlg'); if (d) d.remove();
    const r = h.mctPending(getRaw), can = !!(r && r.supported);
    d = document.createElement('dialog'); d.id = 'mctGeoDlg'; d.className = 'dmGuide'; d.setAttribute('aria-label', 'Geometry changes from MCT');
    d.innerHTML = `<h3>Geometry changes from MCT</h3><p class="note">A record of what moved in the analysis model (${esc(g.producer || 'MCT Generator')}, ${esc(String(g.producedAt || '').replace('T', ' ').slice(0, 16))}). The numbers themselves travel with the demands hand-off, not from here: ${can ? 'load the demands now (below), into the girder type chosen in the banner' : 're-send the demands from the MCT Generator'}. Auto-update (the old app's lock) is not in this app yet.</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Field</th><th class="lft">Current</th><th class="lft">New</th></tr></thead><tbody>${(g.changes || []).map(c => `<tr><td class="lft"><b>${esc(c.field)}</b>${c.detail ? `<br><span class="note">${esc(c.detail)}</span>` : ''}</td><td class="lft">${esc(String(c.oldVal == null || c.oldVal === '' ? '—' : c.oldVal))}</td><td class="lft">${esc(String(c.newVal == null || c.newVal === '' ? '—' : c.newVal))}</td></tr>`).join('')}</tbody></table></div>
      <div class="nBtns" style="margin-top:8px"><button type="button" data-mctg="dismiss">Dismiss</button>${can ? ' <button type="button" class="pri" data-mctg="load">Load the demands now (one Undo step)</button>' : ''} <button type="button" data-mctg="close">Close</button></div>`;
    document.body.appendChild(d);
    d.addEventListener('click', e => { const b = e.target.closest('[data-mctg]'); if (!b) { if (e.target === d) d.close(); return; }
      const a = b.dataset.mctg; if (a === 'close') { d.close(); return; }
      if (a === 'load') { if (mctLoad(d.__ctx)) { setRaw(h.MCT_K.geomAdopted, g.producedAt); d.close(); d.__ctx.redraw(); } return; }
      if (a === 'dismiss') { setRaw(h.MCT_K.geomAdopted, g.producedAt); d.close(); d.__ctx.redraw(); } });
    return d;
  }
  /* ---- batch F3 (2026-11-15): the old app's "Design beam" chip (O:8962-8984), above the output tabs, read only (click / visual):
     the beam LL & DL Distribution designs for, its class, the girder-count warning (⚠ mine ≠ roster) and "Show G<i>" (the output tabs show
     that line in the span shown, so interior / exterior follows the line, as the old app's position followed the beam). Nothing is
     written to the shared keys (the old app's chip could change the shared beam; here it is set in LL & DL); no auto-follow (HO-D2). ---- */
  function beamChip(P) {
    const h = H(); if (!h || !h.dbState) return ''; const d = h.dbState(P, getRaw); if (!d) return '';
    const s = d.sel, lbl = s ? `${esc(s.label || ('B' + s.index))}${s.ab || s.clsLabel ? ' · ' + esc(s.ab || s.clsLabel) : ''}` : '—';
    const shown = window.PSBBridge && window.PSBBridge.shown ? window.PSBBridge.shown(P) : null;
    let act = '';
    if (d.mismatch) act = ` <span style="color:var(--warn);font-weight:600" title="This app is set up for ${d.mismatch.mine} girders but the published roster has ${d.mismatch.roster}. Re-run the LL &amp; DL Distribution app on the current layout.">⚠ ${d.mismatch.mine}≠${d.mismatch.roster}</span> <span class="note">The girder counts differ: the beam numbers are not this bridge's lines (the distribution factor pull uses the interior / exterior envelope).</span>`;
    else if (d.g) {
      act = d.k < 0 ? ` <span class="note">Line G${d.g} has no girder type in span ${d.s}.</span>`
        : shown && shown.g === d.g && shown.s === d.s ? ` <span class="note">The output tabs show G${d.g} (${d.pos}).</span>`
        : ` <button type="button" data-mct="dbShow" data-k="${d.k}" data-g="${d.g}" title="Show girder line G${d.g} of span ${d.s} on the output tabs (its girder type; interior / exterior follows the line)">Show G${d.g} (${d.pos})</button>`;
      if (d.posWarn) act += ` <span style="color:var(--warn);font-weight:600">⚠ LL &amp; DL classes ${lbl} as ${d.theirs}; here G${d.g} is ${d.pos} (G1 and G${d.nb} are the exterior lines).</span>`;
    } else if (!s) act = ' <span class="note">no beam chosen in LL &amp; DL yet</span>';
    if (s && !d.roster) act += ' <span style="color:var(--warn);font-weight:600" title="No beam roster published yet — open the LL &amp; DL Distribution app and recalculate.">no roster</span>';
    return `<div class="note" id="dbChip" role="status"><b>Design beam</b> (LL &amp; DL Distribution, bridgeSuite.v1.designBeam): <b>${lbl}</b>${act}</div>`;
  }
  /* mctLoad(ctx): Load the pending hand-off into the girder type chosen in the banner (one change = one Undo step) */
  function mctLoad(ctx) {
    const h = H(), D = window.PSBDemands, B = window.PSBBridge, P = ctx.P(), r = h.mctPending(getRaw); if (!r || !r.supported) return false;
    const sel = document.getElementById('mctType'), id = sel ? sel.value : (window.PSBDemandsUI.shownType(P) || {}).id, T = B.types(P).find(t => t.id === id);
    if (!T) { say('Choose the girder type to load the demands into.'); return false; }
    const q = h.mctPlan(P, T, r.payload); if (!q.ok) { say(`The MCT hand-off cannot be loaded: ${q.error}`); return false; }
    const lines = q.lines.slice();
    D.setFile(P, T.id, q.file, `MCT hand-off ${r.id}`);
    if (q.setSpans && window.confirm(`The member's spans (${q.setSpans.map(v => v.toFixed(2)).join(', ')} ft) differ from the bridge's (${P.spans.lengths.map(v => (+v).toFixed(2)).join(', ')} ft). Set the bridge spans to the member's (as the old app set L to the span)? (Undo returns both.)`)) { P.spans.lengths = q.setSpans.slice(); lines.push('The bridge spans were set to the member\'s.'); }
    if (q.makeCont && window.confirm('The member is continuous: make the bridge continuous for composite loads (5.12.3.3; the old app turned its continuity on)? Every girder type of the bridge is affected. (Undo returns it.)')) { P.spans.continuity = 'composite'; lines.push('The bridge was made continuous for composite loads.'); }
    setRaw(h.MCT_K.adopted, r.token);
    ctx.changed(); if (ctx.toast) ctx.toast(lines.join(' '), true);
    return true;
  }
  /* onMct(e, ctx): the banners' buttons (ctx: hoCtx + toast, redraw) */
  function onMct(e, ctx) {
    const b = e.target.closest('[data-mct]'); if (!b || !H() || !H().mctPending) return false;
    e.preventDefault(); const h = H(), a = b.dataset.mct;
    if (a === 'dbShow') { if (ctx.pick) ctx.pick(+b.dataset.k, +b.dataset.g); return true; }   // batch F3: the design beam's line
    if (a === 'load') { mctLoad(ctx); return true; }
    if (a === 'dismiss') { const r = h.mctPending(getRaw); if (r) setRaw(h.MCT_K.adopted, r.token); ctx.redraw(); return true; }
    if (a === 'geo') { const d = geoDialog(ctx.P()); if (d) { d.__ctx = ctx; if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', ''); } return true; }
    return true;
  }
  function init(onMctChange) { document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.hoOpt) SEND[t.dataset.hoOpt] = !!t.checked; });   // batch F
    window.addEventListener('storage', e => { if (!e.key || /^bridgeSuite\.v1\.(lldf|dlLoads)/.test(e.key)) refresh();
    if (onMctChange && (!e.key || /^bridgeSuite\.v1\.(latestId|updatedAt|handoffs|geometryChanges|designBeam|beamRoster)/.test(e.key))) onMctChange(); }); }   // batch F3: + the design beam chip   // batch D3: the banners follow the MCT Generator's sends
  window.PSBHandoffUI = { card, onClick, refresh, init, mctBanner, onMct, mctLoad, beamChip };
})();
