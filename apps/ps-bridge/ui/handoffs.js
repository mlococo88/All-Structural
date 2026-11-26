/* apps/ps-bridge/ui/handoffs.js — the Project tab's "Hand-offs" card (window.PSBHandoffUI). Created 2026-11-14 (planned item 12: the old
   app's bridgeSuite.v1.* hand-offs in the new app). The payloads are engine/handoffs.js (PSBHandoffs, the old app's code); the transport is
   ui/bridgexfer.js (BridgeXfer v1, HANDOFF.md §5, verbatim). Keys, schemas and payload formats are the old app's, unchanged (CLAUDE.md §5,
   HANDOFF.md §4), producer 'PS-Beam' as the old app, so every receiving tool reads them as before with no change:
     receive  projectMeta ("Use shared project info"), lldf ("Pull distribution factors"), dlLoads ("Pull DC2 / DW"): read only; the pull
              shows what changes and asks first (HANDOFF.md §3.1, the old app's confirm texts); it writes the girder type shown (the type
              and line chosen above the output tabs: its overrides, as an edit of that type) and the adoption marker
              bridgeSuite.v1.<channel>.adopted.psbridge (receiver id 'psbridge', this app's own).
     send     projectMeta ("Share project info"), superReactions + superReactions.by.psbeam ("Send reactions to Substructure Loading"),
              lldfGeom ("Send geometry to LL & DL"), psSection ("Send section properties to LL & DL"), each with "Export hand-off
              (JSON)": click only (the old app re-published psSection, and lldfGeom when locked, by itself; here nothing is sent without a
              click; Decision pending engineer review, fixlog/ps-bridge.md HO-D2).
   NOMCT (2026-11-25, engineer's request "no MCT input or output"): removed here: the MCT demands hand-off received (handoffs / latestId:
   the "New analysis data available" banner, Load), the MCT geometry changes (geometryChanges: banner, review window), the capacity send
   (bridgeSuite.v1.capacity, "Send capacity to the MCT rating") and their rows of the status list. Those keys belong to other tools: this
   app no longer reads or writes them (nothing is deleted). psSection stays (LL & DL Distribution reads it); its payload and key unchanged.
   Batch F (2026-11-15): "Send to Substructure Loading" with the boxes Geometry and Reactions of every girder line, and "Export hand-off
   (JSON)", the Steel Bridge app's row (apps/steel-bridge/ui/handoffs.js subSend): superGeometry (engine sgPayload, HANDOFF.md §4.14) and
   superReactions with allGirders (engine srAll, §4.4), each published (channel key, .updatedAt), its .by copy (superGeometry.by.psbridge;
   superReactions.by.psbeam, the slot the reactions button above writes) and its per-project copy (shared/handoff-store.js, producer id
   psbridge, HANDOFF.md §5.1; uploaded with Cloud sync as the Steel Bridge app's). The one-line "Send reactions" row above is unchanged.
   Batch F3 / F4 (2026-11-15): the old app's Design beam chip above the output tabs (beamChip; designBeam / beamRoster read only, "Show
   G<i>" by click) and "Import hand-off (JSON)" of the distribution factors (lldfPull from a file, the Steel Bridge app's lldfFile).
   HO-D2 (engineer decision 2026-11-21): the hand-offs stay click only (no channel locks: nothing is sent or loaded on its own) and a stale
   banner names each channel whose data changed since this project last sent or loaded it, with a one-click Send / Load that runs the click
   action of the card (staleBar: above the output tabs, every tab; the card's #hoStale). The record of what this project last sent / loaded
   is P.handoffs (engine/hostale.js, PSBHoStale); a project without it shows no banner.
   BRG-HO (2026-11-24): "Send bearing loads to the Elastomeric Bearing module" and "Export hand-off (JSON)": bearingLoads (engine/bearing.js,
   HANDOFF.md §4.17) with its .by.psbridge and per-project copies, click only, with the stale banner (P.handoffs.sent.bearingLoads).
   Not here (fixlog/ps-bridge.md, Open items): writing designBeam / beamRoster, appPaths and the shared Bridge Suite project list
   (switch-over). */
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
    // HHO (2026-11-25): the haunch the Geometry hand-off sends (engine/handoffs.js haunchSent; the page's cached results only)
    const hS = (() => { try { const A = CTX && CTX.allNow ? CTX.allNow() : null; return A && A.cells && H() && H().haunchSent ? H().haunchSent(A.cells) : null; } catch (e) { return null; } })();
    const f2h = v => (+v).toFixed(2), shown = hS && c && hS.at.k === c.k && hS.at.g === c.g && hS.at.s === c.s;
    const hLine = hS ? `<p class="note" id="hoHaunch"><b>Haunch sent with the Geometry</b>: haunch at the CL bearings (deck.haunchBrg) ${hS.d >= 0 ? `= t<sub>h</sub> + Δ<sub>deck</sub> = ${f2h(hS.th)} + ${f2h(hS.d)} = <b>${f2h(hS.brg)} in</b>` : `= max(t<sub>h</sub> + Δ<sub>deck</sub>, 0.5) = max(${f2h(hS.th)} + (${f2h(hS.d)}), 0.5) = <b>${f2h(hS.brg)} in</b>, thinner than t<sub>h</sub>: the girder sags at deck placement (t<sub>h</sub> stays at midspan)`}, from ${esc(hS.at.label || hS.at.inp.girder)} on G${hS.at.g}, span ${hS.at.s} (the largest over every girder type and line)${shown ? ` <a class="wk" href="#st-cb.haunchBrg" data-gotab="camb" title="Worked step">§</a>` : ' (worked on the Camber &amp; deflection tab with that girder type and line shown)'}; at midspan (deck.haunchMid) ${f2h(hS.mid)} in; deck.haunch = t<sub>h</sub> = ${f2h(hS.th)} in, the entered minimum, as before. Bridge Substructure Loading takes the haunch at the bearings (superstructure depth at the supports: bearing seats, wind).${hS.sag && hS.sag.length ? ` <b style="color:var(--fail)" id="hoSag">⚠ ${hS.sag.length === 1 ? 'A girder line sags' : `${hS.sag.length} girder lines sag`} at deck placement (${hS.sag.map(c => `${esc(c.label || c.inp.girder)} on G${c.g}, span ${c.s}`).join('; ')}): the haunch at the bearings sent is thinner than t<sub>h</sub> where it sags.</b>` : ''}</p>` : '';
    return `<section class="sec" id="psbHo"><div class="secHead">Hand-offs</div><div class="secBody">
      <div id="hoStale">${cardHtml}</div>
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
      ${hLine}
      <div class="fRow">${btn('brgSend', 'Send bearing loads to the Elastomeric Bearing module', 'Every girder line at every bearing line (girder end): the unfactored DC1, DC2, DW, the live load without and with IM, the pedestrian and utility items and the service totals, for the bearing module\'s "Pull bearing loads" (bridgeSuite.v1.bearingLoads)')}${btn('brgFile', 'Export hand-off (JSON)', 'The same bearing loads hand-off as a JSON file')}</div>
      <p class="note"><b>Bearing loads</b> (to elastomeric_design_module.html): one bearing line per girder end (a pier has a back and an ahead line; the two spans are not added), per girder: DC1, DC2, DW and the separate items as the Analysis tab's reactions, the HL-93 live load reaction × DF<sub>v</sub> without and with IM, and P<sub>DL</sub>, P<sub>LL</sub>, P<sub>min</sub> (service). No end rotations (not computed here) and no thermal movement (bearing fixity and the coefficient of thermal expansion are not inputs here): enter them in the bearing module. Kept for this project as the other sends. <b>Last sent:</b> ${(() => { const bl = lastSent(P, 'bearingLoads'); return !pname ? 'not kept per project until the project has a name' : bl ? `${esc(whenL(bl.producedAt))} (project "${esc(pname)}", from this browser)` : `nothing sent yet for project "${esc(pname)}" from this browser`; })()}.</p>
      <div class="fRow">${btn('geoSend', 'Send geometry to LL &amp; DL', 'Spans, girder count and spacing, deck, skew and girder section properties for LL & DL Distribution (bridgeSuite.v1.lldfGeom)')}${btn('geoExport', 'Export (JSON)', 'The same geometry hand-off as a JSON file')}</div>
      <div class="fRow">${btn('secSend', 'Send section properties to LL &amp; DL', 'The composite section properties and outline for LL & DL Distribution (bridgeSuite.v1.psSection)')}${btn('secExport', 'Export (JSON)', 'The same section hand-off as a JSON file')}</div>
      <p class="note">Each send replaces what the old app (or another copy of this app) last sent on the same channel, as two copies of the old app would. The shared design beam is shown above the output tabs (read only; it is chosen in LL &amp; DL). Every hand-off is a click (the old app's channel locks are not used): when a channel's data changes after this project sent or loaded it, a banner names it (here and above the output tabs) with Send / Load, which is the same click as the button here.</p>
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
    HSt().setLoaded(P, 'projectMeta', { at: r.payload.producedAt || '', sig: 'same' });   // HO-D2: what this project loaded
    Object.assign(P.project, pl.upd); ctx.changed();
  }
  function pmShare(ctx) {
    const f = H().pmFields(ctx.P());
    const r = BX().publish('projectMeta', { _schema: 'bridge-project-meta', fields: f }, document.title, FILE);
    if (r.error) { say('Could not share project info: ' + r.error); return; }
    const P = ctx.P(); HSt().setSent(P, 'projectMeta', { sig: HSt().pmSig(H(), P), at: r.payload.producedAt });   // HO-D2: what this project sent
    if (HSt().loadedOf(P, 'projectMeta')) HSt().setLoaded(P, 'projectMeta', { at: r.payload.producedAt, sig: 'same' });   // the shared info is now this project's own
    say('Project info shared. Other tools can load it with "Use shared project info".'); ctx.changed();
  }
  /* the pulls write the girder type shown (its overrides); without girder types (a project not yet migrated) the base design */
  function applyLoads(ctx, fields) { H().applyLoads(ctx.P(), ctx.cell(), fields); ctx.changed(); }
  /* batch F4 (2026-11-15): raw / via given = an imported hand-off file (the Steel Bridge app's "Import hand-off (JSON)"), read as the pull */
  function lldfPull(ctx, raw0, via) {
    const rr = ctx.result(); if (!rr || !rr.inp) { say('There is no girder design to pull for.'); return; }
    const P = ctx.P(), c = ctx.cell(), inp = rr.inp, raw = raw0 != null ? raw0 : getRaw('bridgeSuite.v1.lldf');
    // the design beam of the old app = the line shown, when LL & DL has the same girder count (its beam numbers are these lines; HO-D2:
    // the same rule moved to engine/hostale.js lldfBeam, unchanged, so the stale check reads the pull as the pull does)
    const db = HSt().lldfBeam(P, c, inp, raw);
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
    HSt().setLoaded(P, 'lldf', { at: r.at, sig: HSt().sig(H().lldfFields(inp, r)), cell: cellRef(ctx), via: via || 'LL & DL' });   // HO-D2: what this design uses
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
    HSt().setLoaded(P, 'dlLoads', { at: r.at, sig: HSt().sig(H().dlTheirs(r)), cell: cellRef(ctx) });   // HO-D2: what this design uses
    applyLoads(ctx, H().dlTheirs(r));
    BX().markAdopted('dlLoads', H().RX, r.at);
  }
  /* superReactions: the old app's BXSuperRx.send / exportJSON (the same stamp, the copy by.psbeam, the same message) */
  function srBuilt(ctx) { const r = needR(ctx); if (!r) return null; const b = H().srPayload(r.inp, r.R);
    if (!b || b.error || !b.payload) { say('Cannot build the reactions hand-off: ' + ((b && b.error) || 'no results') + '.'); return null; } return b.payload; }
  function srSummary(p) {
    const L = [];
    (p.supports || []).forEach(s => { (s.girders || []).forEach(g => { L.push('  ' + s.id + ' (x = ' + f2(s.x) + ' ft), ' + g.label + ': DC1 ' + f2(g.DC1) + ', DC2 ' + f2(g.DC2) + ', DW ' + f2(g.DW) + ' kip'); }); });
    (p.supports || []).forEach(s => { (s.girders || []).forEach(g => { if (g.separate) L.push('  ' + s.id + ', ' + g.label + ', separate items (optional fields; UT and UF are inside DC1, UTc inside DW, PL in no other field): ' + Object.keys(g.separate).map(k => k + ' ' + f2(g.separate[k])).join(', ') + ' kip'); }); });   // SRP
    if (p.liveLoad && p.liveLoad.supports) L.push('  Live load per lane, no IM, no DF (information only): ' + p.liveLoad.supports.map(s => s.id + ' ' + f2(s.Rmax) + ' kip').join(', '));
    return L.join('\n');
  }
  function srSend(ctx) {
    const payload = srBuilt(ctx); if (!payload) return;
    const r = BX().publish('superReactions', payload, H().PRODUCER, FILE);
    if (r.error) { say('Could not send the reactions: ' + r.error); return; }
    write(BX().NS + 'superReactions.by.' + H().SR_ID, JSON.stringify(r.payload));
    HSt().setSent(ctx.P(), 'superReactions', { sig: HSt().sig(payload), at: r.payload.producedAt, cell: cellRef(ctx) });   // HO-D2
    say('Reactions sent to Substructure Loading (unfactored, kip, one girder line):\n\n' + srSummary(r.payload) + '\n\nIn Bridge Substructure Loading, Reactions tab, click "Pull from PS-Beam".');
    ctx.changed();
  }
  function srExport(ctx) {
    const payload = srBuilt(ctx); if (!payload) return;
    const p = Object.assign({}, payload); p.schemaVersion = p.schemaVersion || 1; p.producer = p.producer || H().PRODUCER; p.producerFile = p.producerFile || FILE;
    p.producedAt = new Date().toISOString(); if (!p.project) p.project = BX().sharedProject() || { name: '', bridgeId: '' }; if (!p.notes) p.notes = [];
    exportP('superReactions', p);
  }
  /* psSection, lldfGeom: the old app's payloads, written as the old app wrote them (the key and .updatedAt; lldfGeom the key only) */
  function secSend(ctx, exp) {
    const r = needR(ctx); if (!r) return; const p = H().psSection(r.inp, r.R, new Date().toISOString()); if (!p) { say('No section properties (input error).'); return; }
    if (exp) { exportP('psSection', p); return; }
    if (write('bridgeSuite.v1.psSection', JSON.stringify(p)) && write('bridgeSuite.v1.psSection.updatedAt', p.producedAt)) {
      HSt().setSent(ctx.P(), 'psSection', { sig: HSt().sig(p), at: p.producedAt, cell: cellRef(ctx) });   // HO-D2
      say('Section properties sent (composite I = ' + Math.round(p.Ic) + ' in⁴, ' + (p.memberKey || 'this girder') + '). LL & DL Distribution can use them.'); ctx.changed(); }
  }
  function geoSend(ctx, exp) {
    const r = needR(ctx); if (!r) return; const b = H().lldfGeom(r.inp, r.R, new Date().toISOString()); if (b.error) { say(b.error); return; }
    if (exp) { exportP('lldfGeom', b.payload); return; }
    if (write('bridgeSuite.v1.lldfGeom', JSON.stringify(b.payload))) {
      HSt().setSent(ctx.P(), 'lldfGeom', { sig: HSt().sig(b.payload), at: b.payload.producedAt, cell: cellRef(ctx) });   // HO-D2
      say('Geometry sent to LL & DL Distribution (' + b.payload.Nb + ' girders at ' + f3(b.payload.inputs.spacings[0]) + ' ft, span ' + b.payload.inputs.spans.map(f2).join(', ') + ' ft). Open LL & DL Distribution to adopt it.'); ctx.changed(); }
  }
  /* batch F: subSend(ctx, file): the Steel Bridge app's subSend. Every ticked channel is built first (nothing is sent when one fails), then
     published (channel key, .updatedAt), its .by copy and its per-project copy (and upload with Cloud sync); file: one JSON file per box. */
  async function subSend(ctx, file, only) {   // only (HO-D2, the stale banner's Send): ['geo'] or ['rx'] whatever the boxes
    const todo = (only || [SEND.geo && 'geo', SEND.rx && 'rx']).filter(Boolean);
    if (!todo.length) { say('Tick Geometry, Reactions or both.'); return; }
    const A = ctx.all ? ctx.all() : null;
    if (!A) { say(`Nothing was ${file ? 'exported' : 'sent'}: fix the inputs first (the input errors are listed above the results).`); return; }
    const P = ctx.P(), built = {}, errs = [];
    todo.forEach(k => { const r = k === 'geo' ? H().sgPayload(P, A.cells) : H().srAll(P, A.cells); if (r.error) errs.push(`${k === 'geo' ? 'Geometry' : 'Reactions'}: ${r.error}`); else built[k] = r; });
    if (errs.length) { say(`Nothing was ${file ? 'exported' : 'sent'}.\n\n${errs.join('\n')}`); return; }
    const sg = {}; todo.forEach(k => { sg[k] = HSt().sig(built[k].payload); });   // HO-D2: the sig of what is sent (before the device field)
    const dev = HS() ? HS().deviceName(localStorage) : ''; todo.forEach(k => { if (dev) built[k].payload.device = dev; });   // §5.1 optional envelope field
    const CH = { geo: { ch: 'superGeometry', by: H().GEO_ID }, rx: { ch: 'superReactions', by: H().SR_ID } };
    if (file) { todo.forEach(k => exportP(CH[k].ch, Object.assign({}, built[k].payload, { producedAt: new Date().toISOString() }))); return; }
    const out = [], pname = String((P.project || {}).name || '').trim(); let sent = 0;
    for (const k of todo) {
      const c = CH[k], w = BX().publish(c.ch, built[k].payload, H().PRODUCER, FILE);
      if (w.error) { out.push(`${k === 'geo' ? 'Geometry' : 'Reactions'}: NOT sent: ${w.error} Use "Export hand-off (JSON)" instead.`); continue; }
      write(BX().NS + c.ch + '.by.' + c.by, JSON.stringify(w.payload));   // the .by copy (§4.4, §4.14)
      HSt().setSent(P, k === 'geo' ? 'superGeometry' : 'superReactionsAll', { sig: sg[k], at: w.payload.producedAt }); sent++;   // HO-D2
      let cl = '';
      if (HS()) { const r = await HS().send({ storage: localStorage, channel: c.ch, producer: H().GEO_ID, payload: w.payload, fetch: (u, i) => window.fetch(u, i) });
        cl = !r.ok ? ` (the per-project copy was not saved: ${r.error})` : !r.pid ? '' : r.cloud && r.cloud.ok ? '; also uploaded to GitHub' : r.cloud && r.cloud.queued ? `; GitHub upload waiting (${r.cloud.error})` : ''; }
      out.push(k === 'geo' ? `Geometry sent: ${built.geo.sum}${cl}.` : `Reactions sent (unfactored, kip, DC1 / DC2 / DW of every girder line)${cl}:\n${built.rx.sum}`);
    }
    say(`${pname ? `Kept for project "${pname}".` : 'This project has no name, so the send is kept only as the latest hand-off (no project). Enter a project name on this tab to keep one copy per project.'}\n\n${out.join('\n\n')}\n\nIn Bridge Substructure Loading: Project tab, Hand-offs card, "Pull geometry from Steel Bridge Design" and "Pull from PS-Beam / GirderDetail". Each asks which project first.`);
    if (sent) ctx.changed(); else if (ctx.redrawIn) ctx.redrawIn();   // the card's "Last sent" (HO-D2: and the record of this project's sends)
  }
  /* BRG-HO (2026-11-24): bearingLoads (HANDOFF.md §4.17) to the Elastomeric Bearing Design Module: engine/bearing.js blPayload of every girder
     line, published (channel key, .updatedAt), its copy bearingLoads.by.psbridge and its per-project copy (shared/handoff-store.js, producer
     id psbridge, §5.1); file: one JSON file. Click only; recorded for the stale banner (P.handoffs.sent.bearingLoads). */
  async function brgSend(ctx, file) {
    const A = ctx.all ? ctx.all() : null, B = window.PSBBearing;
    if (!B) { say('The bearing loads hand-off is not available (engine/bearing.js not loaded).'); return; }
    if (!A) { say(`Nothing was ${file ? 'exported' : 'sent'}: fix the inputs first (the input errors are listed above the results).`); return; }
    const P = ctx.P(), r = B.blPayload(P, A.cells);
    if (r.error) { say(`Nothing was ${file ? 'exported' : 'sent'}.\n\nBearing loads: ${r.error}`); return; }
    const sg = HSt().sig(r.payload), dev = HS() ? HS().deviceName(localStorage) : ''; if (dev) r.payload.device = dev;
    if (file) { exportP('bearingLoads', Object.assign({}, r.payload, { producedAt: new Date().toISOString() })); return; }
    const w = BX().publish('bearingLoads', r.payload, H().PRODUCER, FILE);
    if (w.error) { say(`Bearing loads NOT sent: ${w.error} Use "Export hand-off (JSON)" instead.`); return; }
    write(BX().NS + 'bearingLoads.by.' + B.ID, JSON.stringify(w.payload));
    HSt().setSent(P, 'bearingLoads', { sig: sg, at: w.payload.producedAt });   // HO-D2 pattern
    let cl = '';
    if (HS()) { const q = await HS().send({ storage: localStorage, channel: 'bearingLoads', producer: B.ID, payload: w.payload, fetch: (u, i) => window.fetch(u, i) });
      cl = !q.ok ? ` (the per-project copy was not saved: ${q.error})` : !q.pid ? '' : q.cloud && q.cloud.ok ? '; also uploaded to GitHub' : q.cloud && q.cloud.queued ? `; GitHub upload waiting (${q.cloud.error})` : ''; }
    const pname = String((P.project || {}).name || '').trim();
    say(`${pname ? `Kept for project "${pname}".` : 'This project has no name, so the send is kept only as the latest hand-off (no project). Enter a project name on this tab to keep one copy per project.'}\n\nBearing loads sent${cl} (unfactored, kip, per girder end; P_DL / P_LL without IM):\n${r.sum}\n\nIn the Elastomeric Bearing Design Module: Project tab, Hand-offs, "Pull bearing loads". It asks which project and which bearing line first.`);
    ctx.changed();
  }
  function onClick(e, ctx) {
    if (onStale(e, ctx)) return true;   // HO-D2: the card's stale banners
    const b = e.target.closest('[data-ho]'); if (!b) return false;
    if (!BX() || !H()) { say('The hand-off helper is not available in this browser.'); return true; }
    const a = b.dataset.ho;
    if (a === 'subSend' || a === 'subFile') { subSend(ctx, a === 'subFile'); return true; }
    if (a === 'brgSend' || a === 'brgFile') { brgSend(ctx, a === 'brgFile'); return true; }   // BRG-HO
    if (a === 'lldfFile') { const f = b.parentNode.querySelector('[data-ho-file="lldf"]'); if (f) { f.value = ''; f.onchange = () => { const file = f.files && f.files[0]; if (!file) return;   // batch F4
      BX().importFile(file, 'bridge-lldf-factors', 1, r => { if (r.error) { say('Cannot import the hand-off file: ' + r.error); return; } lldfPull(ctx, JSON.stringify(r.payload), 'file ' + file.name); refresh(); }); }; f.click(); } return true; }   // batch F (async: the per-project copy)
    ({ pmUse, pmShare, lldfPull, dlPull, srSend, srExport, secSend: c => secSend(c, false), secExport: c => secSend(c, true),
      geoSend: c => geoSend(c, false), geoExport: c => geoSend(c, true) })[a](ctx);
    refresh();
    return true;
  }
  function refresh() { document.querySelectorAll('[data-ho-new]').forEach(s => { s.hidden = !isNew(s.dataset.hoNew); }); }
  /* ---- HO-D2 (engineer decision 2026-11-21): the stale banners (display only; each button is the card's own click action) ----
     staleItems(ctx): every channel this project has a record of (engine/hostale.js), with its state; kept while the project text, the
     result state and the stored hand-offs are the same (the payloads are rebuilt from the page's cached results only when one changes).
     staleBar(ctx): the banner above the output tabs (every tab; the channels out of date, each with Send / Load) and the card's #hoStale
     (the same banners and each recorded channel's status). ctx = hoCtx (index.html): + resultOf(k, g), allNow(), errN(), goin(). */
  const HSt = () => window.PSBHoStale;
  let CTX = null, cardHtml = '', memo = { key: null, items: [] };
  const cellRef = ctx => { const c = ctx.cell(), P = ctx.P(); return c && P.types && P.types[c.k] ? { id: P.types[c.k].id, g: c.g, label: c.label } : null; };
  const cellTxt = c => c ? ` of ${c.label} on G${c.g}` : '';
  /* cellRes(ctx, cell): { inp, R } of the girder type (id) and line recorded, { gone: true } when it is no longer in the project, null: not now */
  function cellRes(ctx, cell) {
    const P = ctx.P(), B = window.PSBBridge;
    if (!cell) { const r = ctx.result(); return r && r.R && !r.R.error ? r : null; }
    const k = (P.types || []).findIndex(t => t.id === cell.id);
    if (k < 0 || !B || !B.typeLines(P, k).includes(cell.g)) return { gone: true };
    return ctx.resultOf ? ctx.resultOf(k, cell.g) : null;
  }
  const atOf = raw => { try { const p = raw ? JSON.parse(raw) : null; return (p && p.producedAt) || ''; } catch (e) { return ''; } };
  const WATCH = ['psSection', 'lldfGeom', 'superReactions', 'superGeometry', 'bearingLoads', 'projectMeta', 'lldf', 'dlLoads'];
  function staleItems(ctx) {
    const S = HSt(), h = H(), B = window.PSBBridge; if (!S || !h || !ctx || !BX()) return [];
    const P = ctx.P(); if (!P || !P.handoffs) return [];   // nothing recorded (every project saved before): no banner
    const NS = BX().NS, raw = {}; WATCH.forEach(c => { raw[c] = getRaw(NS + c) || ''; });
    const A = !(ctx.errN && ctx.errN()) && ctx.allNow ? ctx.allNow() : null;
    const key = [JSON.stringify(P), ctx.errN ? ctx.errN() : 0, A ? 1 : 0].concat(WATCH.map(c => raw[c])).join('\u0001');
    if (memo.key === key) return memo.items;
    const it = [];
    S.OUT_IDS.forEach(id => {
      const rec = S.sentOf(P, id); if (!rec) return;
      const C = S.CH[id]; let cur = null, gone = false;
      if (C.cell) { const r = cellRes(ctx, rec.cell); if (r && r.gone) gone = true; else if (r) cur = S.cellSig(h, id, r.inp, r.R); }
      else if (id === 'projectMeta') cur = S.pmSig(h, P);
      else cur = A ? S.allSig(h, id, P, A.cells) : null;
      const st = gone ? 'gone' : S.outState(rec, cur), sh = atOf(raw[C.ch]);
      it.push({ id, dir: 'out', state: st, rec, later: sh && rec.at && sh !== rec.at ? sh : '', head: `${C.label} (${C.ch})${cellTxt(rec.cell)}`, msg: `changed since last sent to ${C.to}`, btn: 'Send' });
    });
    S.IN_IDS.forEach(id => {
      const C = S.CH[id], rec = S.loadedOf(P, C.rec || id); if (!rec) return;
      let cur = null, st;
      if (id === 'projectMetaIn') st = S.inState(rec, S.pmCur(h, P, raw.projectMeta));
      else { const r = cellRes(ctx, rec.cell);
        if (r && r.gone) st = 'gone'; else if (!r) st = 'unchecked';
        else { cur = id === 'lldf' ? S.lldfCur(h, P, rec.cell ? { g: rec.cell.g } : ctx.cell(), r.inp, raw.lldf) : S.dlCur(h, raw.dlLoads); st = S.inState(rec, cur); } }
      it.push({ id, dir: 'in', state: st, rec, head: `${C.label} (${C.ch})${cellTxt(rec.cell)}`, msg: id === 'projectMetaIn' ? 'another tool has shared newer project info than this project uses' : 'the LLDF tool has newer data than this design uses', btn: 'Load' });
    });
    memo = { key, items: it };
    return it;
  }
  const STX = { current: 'up to date', stale: 'out of date', unchecked: 'cannot be checked now (input errors, or the results are still running)', gone: 'the girder type or line is no longer in the project', none: 'the data is no longer in this browser', unknown: '' };
  const btnOf = q => `<button type="button" class="pri" data-hos="${q.id}"${q.tid ? ` data-tid="${esc(q.tid)}"` : ''}>${q.btn}</button>`;
  function cardBody(it) {
    const st = it.filter(q => q.state === 'stale');
    const ban = st.map(q => `<div class="notice hoStaleN" data-hos-ch="${q.id}${q.tid ? '.' + esc(q.tid) : ''}"><div><b>${esc(q.head)}</b>: ${esc(q.msg)}.</div><div class="nBtns">${btnOf(q)}</div></div>`).join('');
    const rows = it.map(q => `<li>${esc(q.head)}: ${q.dir === 'out' ? 'sent' : 'loaded'} ${esc(whenL(q.rec.at))}${q.rec.via && q.rec.via !== 'LL & DL' ? ` (${esc(q.rec.via)})` : ''} — <b>${esc(STX[q.state] || q.state)}</b>${q.later ? ` <span class="note">(the shared key now holds a later send, ${esc(whenL(q.later))})</span>` : ''}</li>`).join('');
    return ban + `<p class="note"><b>This project's hand-offs:</b> ${rows ? '' : 'nothing sent or loaded from this project yet (or only before this app kept a record of it), so no banner is shown.'}</p>${rows ? `<ul class="note hoStList">${rows}</ul>` : ''}`;
  }
  function staleBar(ctx) {
    ctx = ctx || CTX; let it = [];
    try { it = staleItems(ctx); } catch (e) { console.warn(e); it = []; }
    cardHtml = cardBody(it); const el = document.getElementById('hoStale'); if (el) el.innerHTML = cardHtml;
    const bar = it.filter(q => q.state === 'stale');
    if (!bar.length) return '';
    return `<div class="notice hoStaleBar" id="hoStaleBar" role="status"><div><b>Hand-offs out of date</b> (this project; nothing is sent or loaded until you click):<ul class="hoStList">${bar.map(q => `<li><b>${esc(q.head)}</b>: ${esc(q.msg)} ${btnOf(q)}</li>`).join('')}</ul></div><div class="nBtns"><button type="button" data-hos-go>Hand-offs card</button></div></div>`;
  }
  /* onStale(e, ctx): a stale banner's button = the card's click action (a girder hand-off: its girder type and line shown first, ctx.pick) */
  function onStale(e, ctx) {
    if (e.target.closest('[data-hos-go]')) { e.preventDefault(); if (ctx.goin) ctx.goin(); return true; }
    const b = e.target.closest('[data-hos]'); if (!b) return false;
    e.preventDefault(); if (!BX() || !H() || !HSt()) { say('The hand-off helper is not available in this browser.'); return true; }
    const id = b.dataset.hos, P = ctx.P(), S = HSt(), C = S.CH[id] || {}, rec = C.dir === 'out' ? S.sentOf(P, id) : S.loadedOf(P, C.rec || id);
    const show = cell => { if (!cell || !ctx.pick) return; const k = (P.types || []).findIndex(t => t.id === cell.id), sh = ctx.cell(); if (k >= 0 && (!sh || sh.k !== k || sh.g !== cell.g)) ctx.pick(k, cell.g); };
    const run = {
      psSection: c => secSend(c, false), lldfGeom: c => geoSend(c, false), superReactions: srSend,
      superReactionsAll: c => subSend(c, false, ['rx']), superGeometry: c => subSend(c, false, ['geo']), bearingLoads: c => brgSend(c, false), projectMeta: pmShare,
      lldf: c => lldfPull(c), dlLoads: dlPull, projectMetaIn: pmUse }[id];
    if (!run) return true;
    if (rec && rec.cell) show(rec.cell);
    run(ctx); refresh();
    return true;
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
        : ` <button type="button" data-hob="dbShow" data-k="${d.k}" data-g="${d.g}" title="Show girder line G${d.g} of span ${d.s} on the output tabs (its girder type; interior / exterior follows the line)">Show G${d.g} (${d.pos})</button>`;
      if (d.posWarn) act += ` <span style="color:var(--warn);font-weight:600">⚠ LL &amp; DL classes ${lbl} as ${d.theirs}; here G${d.g} is ${d.pos} (G1 and G${d.nb} are the exterior lines).</span>`;
    } else if (!s) act = ' <span class="note">no beam chosen in LL &amp; DL yet</span>';
    if (s && !d.roster) act += ' <span style="color:var(--warn);font-weight:600" title="No beam roster published yet — open the LL &amp; DL Distribution app and recalculate.">no roster</span>';
    return `<div class="note" id="dbChip" role="status"><b>Design beam</b> (LL &amp; DL Distribution, bridgeSuite.v1.designBeam): <b>${lbl}</b>${act}</div>`;
  }
  /* onBar(e, ctx): the buttons above the output tabs: the stale banner (onStale) and the design beam chip's Show G<i> (ctx: hoCtx) */
  function onBar(e, ctx) {
    if (onStale(e, ctx)) return true;   // HO-D2: the stale banner above the output tabs
    const b = e.target.closest('[data-hob]'); if (!b) return false;
    e.preventDefault();
    if (b.dataset.hob === 'dbShow') { if (ctx.pick) ctx.pick(+b.dataset.k, +b.dataset.g); return true; }   // batch F3: the design beam's line
    return true;
  }
  function init(onChange, ctx) { if (ctx) CTX = ctx; document.addEventListener('change', e => { const t = e.target; if (t && t.dataset && t.dataset.hoOpt) SEND[t.dataset.hoOpt] = !!t.checked; });   // batch F
    window.addEventListener('storage', e => { if (!e.key || /^bridgeSuite\.v1\.(lldf|dlLoads)/.test(e.key)) refresh();
    if (onChange && (!e.key || /^bridgeSuite\.v1\.(designBeam|beamRoster|lldf|dlLoads|projectMeta|psSection|superReactions|superGeometry|bearingLoads)/.test(e.key))) onChange(); }); }   // HO-D2: + every channel of the stale banners   // batch F3: + the design beam chip   // NOMCT: the MCT keys no longer read
  window.PSBHandoffUI = { card, onClick, refresh, init, onBar, beamChip, staleBar, staleItems };
})();
