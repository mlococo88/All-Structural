/* apps/crane-pick/ui/craneedit.js — the crane editor (window.CranePickCraneEdit). C2-1 (2026-11-16).
   A dialog over one crane: the project's copy (Edit… on its card) or a new one (New crane: a chart pasted from Excel, radius rows ×
   boom-length columns). Crane data (make, model, type, preliminary, source document, revision, date, pages, terms), plan dimensions
   (overrides of the file's dims: app_inputs.plan), the elevation geometry (C3-1: app_inputs.geom, engine/elev.js), and the configs: id, label, support, zone, counterweight, page, notes, deductions,
   and the chart as tab-separated text (Excel copy / paste) with a checked preview (blank cells, capacity increasing with radius).
   Saving checks the whole crane (engine/cranes.js parse): errors block it, warnings are listed. A changed chart is marked
   app_inputs.edited (shown on the card and in the Report). */
(function () {
  'use strict';
  const A = window.CranePickApp, K = window.CranePickCranes, esc = A.esc;
  const UI = () => window.CranePickCraneUI;
  const SUPPORTS = ['outriggers-full', 'outriggers-mid', 'outriggers-retracted', 'on-rubber', 'crawler'];
  let dlg = null, W = null, orig = null, cid = null, ci = 0, msgs = [], chartMsg = null;
  const fmt = (v, d) => (typeof v === 'number' && isFinite(v)) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '';
  function open(id) {
    const c = id ? UI().crane(id) : null;
    cid = c ? id : null; orig = c ? c.def : null;
    W = c ? JSON.parse(JSON.stringify(c.def)) : K.blank();
    if (!W.app_inputs) W.app_inputs = {};
    if (!c) W.configs.push({ id: 'cfg1', label: 'Main boom, 360 deg', boom: 'main', counterweight_lb: null, support: 'outriggers-full', zone: '360', chart: { boom_lengths_ft: [], radii_ft: [], capacity_lb: [] }, notes: '', deductions: { rule: '' }, page: null });
    ci = 0; msgs = []; chartMsg = null;
    if (!dlg) { dlg = document.createElement('dialog'); dlg.id = 'crEdit'; dlg.className = 'crDlg'; document.body.appendChild(dlg); dlg.addEventListener('click', onClick); dlg.addEventListener('change', onChange); }
    draw();
    if (!dlg.open) { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); }
  }
  const tin = (id, v, lbl, o) => `<div class="fRow"><label for="${id}">${lbl}</label><input type="text" id="${id}" value="${esc(v == null ? '' : v)}"${o && o.ph ? ` placeholder="${esc(o.ph)}"` : ''}${o && o.num ? ' inputmode="decimal"' : ''}></div>`;
  function previewHtml(ch) {
    if (!ch || !ch.radii_ft || !ch.radii_ft.length) return '<p class="note">No chart yet: paste it above and press "Read the chart".</p>';
    const B = ch.boom_lengths_ft, prev = B.map(() => null);
    return `<div class="tscroll crPrev"><table class="tbl"><thead><tr><th>R \\ L (ft)</th>${B.map((b, j) => `<th class="n">${fmt(b, String(b).split('.')[1] ? String(b).split('.')[1].length : 0)}${ch.column_modes ? `<br><small>${esc(ch.column_modes[j])}</small>` : ''}</th>`).join('')}</tr></thead><tbody>
      ${ch.radii_ft.map((r, i) => `<tr><th class="n">${r}</th>${B.map((b, j) => { const v = ch.capacity_lb[i][j]; let cls = 'n';
        if (v == null) cls += ' crBlank'; else { if (prev[j] != null && v > prev[j]) cls += ' crInc'; prev[j] = v; }
        return `<td class="${cls}"${cls.indexOf('crInc') >= 0 ? ' title="Higher than the rated cell above it: check against the chart"' : ''}>${v == null ? '' : fmt(v, 0)}</td>`; }).join('')}</tr>`).join('')}</tbody></table></div>
      <p class="note">Blank = no rating (never interpolated). <span class="crInc">Amber</span> = capacity higher than at the smaller radius above it (check). Capacities in lb.</p>`;
  }
  function draw() {
    const g = W.configs[ci], s = W.source || (W.source = {}), p0 = K.planDims(Object.assign({}, W, { app_inputs: {} })), ov = W.app_inputs.plan || {};
    const pv = (sec, k) => sec ? (ov[sec] && ov[sec][k]) : ov[k], ph = (v) => v == null ? 'not in the file' : String(+(+v).toFixed(4)) + ' (file)';
    const pnum = (id, sec, k, lbl, dv) => tin(id, pv(sec, k), lbl + ' (ft)', { ph: ph(dv), num: true });
    const gv = W.app_inputs.geom || {}, g0 = window.CranePickElev ? window.CranePickElev.geomOf(Object.assign({}, W, { app_inputs: {} })) : { from: {} };   // C3-1
    const gnum = (id, k, lbl, dv, none) => tin(id, gv[k], lbl + ' (ft)', { ph: dv == null ? none : String(+(+dv).toFixed(4)) + ' (file)', num: true });
    const spreads = ov.outr && ov.outr.spreads ? Object.keys(ov.outr.spreads).map(k => `${k}=${ov.outr.spreads[k]}`).join(', ') : '';
    dlg.innerHTML = `<div class="crDlgHead"><strong>${cid ? 'Edit crane' : 'New crane'}: ${esc(K.name(W))}</strong><button type="button" data-ce="close">Close</button></div>
      <div class="crDlgBody">
      <div class="sec"><div class="secHead">Crane</div><div class="secBody">
        ${tin('ceMake', W.make, 'Make')}${tin('ceModel', W.model, 'Model')}
        <div class="fRow"><label for="ceType">Type</label><select id="ceType">${K.TYPES.map(t => `<option${W.type === t ? ' selected' : ''}>${t}</option>`).join('')}</select></div>
        <label class="note" style="display:block"><input type="checkbox" id="cePrelim"${W.preliminary ? ' checked' : ''}> The source document is marked preliminary</label>
        ${tin('ceDoc', s.doc, 'Source document')}${tin('ceRev', s.revision, 'Revision')}${tin('ceDate', s.date, 'Date')}${tin('cePages', s.pages, 'Pages')}${tin('ceFile', s.file, 'File')}
        <div class="fRow"><label for="ceTerms">Terms</label><textarea id="ceTerms" style="min-height:48px">${esc(s.terms || '')}</textarea></div></div></div>
      <div class="sec"><div class="secHead">Plan dimensions (map symbol, plan clearances)</div><div class="secBody"><p class="note">Blank = the file's value (shown grey). From the centre of rotation; ft.</p>
        ${pnum('ceTail', null, 'tail', 'Tail swing radius', p0.tail)}${pnum('ceBf', null, 'boomFoot', 'Boom foot ahead of rotation', p0.boomFoot)}
        ${W.type === 'crawler' ? pnum('ceCrL', 'crawler', 'length', 'Crawler length', p0.crawler && p0.crawler.length) + pnum('ceCrG', 'crawler', 'gauge', 'Track gauge (c-c)', p0.crawler && p0.crawler.gauge) + pnum('ceCrS', 'crawler', 'shoe', 'Shoe width', p0.crawler && p0.crawler.shoe)
          : pnum('ceOF', 'outr', 'xFront', 'Front outrigger beam ahead of rotation', p0.outr && p0.outr.xFront) + pnum('ceOR', 'outr', 'xRear', 'Rear outrigger beam behind rotation', p0.outr && p0.outr.xRear) + pnum('ceFl', 'outr', 'float', 'Float size', p0.outr && p0.outr.float)
            + tin('ceSp', spreads, 'Spreads (c-c floats)', { ph: p0.outr ? Object.keys(p0.outr.spreads).map(k => `${k}=${p0.outr.spreads[k]}`).join(', ') + ' (file)' : 'full=24, mid=16' })}
        ${pnum('ceBF', 'body', 'front', 'Body ahead of rotation', p0.body && p0.body.front)}${pnum('ceBR', 'body', 'rear', 'Body behind rotation', p0.body && p0.body.rear)}${pnum('ceBW', 'body', 'width', 'Body width', p0.body && p0.body.width)}</div></div>
      <div class="sec"><div class="secHead">Elevation geometry (heights, 3D clearances)</div><div class="secBody"><p class="note">Blank = the file's value (grey), else the stated assumption (engine/elev.js). Above the crane pad; ft. The boom-foot offset ahead of rotation and the tail-swing radius are above.</p>
        ${gnum('ceGfH', 'footH', 'Boom-foot pin height', g0.from.footH === 'file' ? g0.footH : null, 'assumed 0')}${gnum('ceGhd', 'head', 'Head allowance (tip pin to the highest block position)', null, 'assumed 0')}
        ${gnum('ceGbw', 'boomW', 'Boom section width', null, 'assumed 0 (centre line)')}${gnum('ceGcb', 'cwBot', 'Counterweight bottom above the pad', g0.from.cwBot === 'file' ? g0.cwBot : null, 'assumed 0')}${gnum('ceGct', 'cwTop', 'Counterweight top above the pad', g0.from.cwTop === 'file' ? g0.cwTop : null, 'not limited')}</div></div>
      <div class="sec"><div class="secHead">Load charts (${W.configs.length})</div><div class="secBody">
        <div class="goRow"><select id="ceCfg" aria-label="Config">${W.configs.map((x, i) => `<option value="${i}"${i === ci ? ' selected' : ''}>${esc(x.id)}: ${esc(x.label || '')}</option>`).join('')}</select><button type="button" data-ce="cfgNew">New config</button>${g ? '<button type="button" class="danger" data-ce="cfgDel">Delete config</button>' : ''}</div>
        ${g ? `${tin('ceId', g.id, 'Config id')}${tin('ceLabel', g.label, 'Label')}
          <div class="fRow"><label for="ceSupport">Support</label><input type="text" id="ceSupport" list="ceSupList" value="${esc(g.support || '')}"><datalist id="ceSupList">${SUPPORTS.map(x => `<option value="${x}">`).join('')}</datalist></div>
          <div class="fRow"><label for="ceZone">Zone</label><select id="ceZone">${Object.keys(K.ZONES).map(z => `<option value="${z}"${g.zone === z ? ' selected' : ''}>${esc(K.ZONES[z])}</option>`).join('')}</select></div>
          ${tin('ceCw', g.counterweight_lb, 'Counterweight (lb)', { num: true })}${tin('cePage', g.page == null ? '' : [].concat(g.page).join(', '), 'PDF page(s)')}
          <div class="fRow"><label for="ceNotes">Chart notes</label><textarea id="ceNotes" style="min-height:60px" placeholder="e.g. Capacities do not exceed 75% of tipping …">${esc(g.notes || '')}</textarea></div>
          <div class="fRow"><label for="ceDed">Deductions</label><textarea id="ceDed" style="min-height:40px">${esc(g.deductions && g.deductions.rule || '')}</textarea></div>
          <div class="note"><b>Chart</b>: paste from Excel (first row: a label cell, then the boom lengths in ft; each next row: the radius in ft, then the capacities). Blank, - or — = no rating.</div>
          <textarea id="ceChart" class="crChartTxt" spellcheck="false" aria-label="Chart as tab-separated text">${esc(K.chartText(g.chart))}</textarea>
          <div class="goRow"><label class="note">Values in <select id="ceUnit"><option value="lb">lb</option><option value="kip">kip (× 1,000)</option></select></label><button type="button" class="primary" data-ce="read">Read the chart</button></div>
          ${chartMsg ? `<div class="crOut${chartMsg.errors.length ? ' bad' : ''}" id="ceChartMsg">${chartMsg.errors.length ? '<b>Not read:</b> ' + chartMsg.errors.map(esc).join('<br>') : '<b>Chart read.</b>'}${chartMsg.warnings.length ? '<br>' + chartMsg.warnings.map(w => '⚠ ' + esc(w)).join('<br>') : ''}</div>` : ''}
          ${previewHtml(g.chart)}` : '<p class="note">No config.</p>'}</div></div>
      ${msgs.length ? `<div class="crOut bad" id="ceMsgs">${msgs.map(esc).join('<br>')}</div>` : ''}
      </div><div class="crDlgFoot"><button type="button" data-ce="close">Cancel</button>${cid ? '<label class="note"><input type="checkbox" id="ceAlsoLib"> also keep in this browser\'s library</label><button type="button" class="primary" data-ce="save">Save to the project</button>' : '<button type="button" class="primary" data-ce="save">Add to the library and the project</button>'}</div>`;
  }
  const numOrNull = t => { const s = String(t).replace(/,/g, '').trim(); if (!s) return null; const v = Number(s); return isFinite(v) ? v : NaN; };
  function onChange(e) {
    const t = e.target, g = W.configs[ci], s = W.source, v = t.value;
    const plan = (sec, k) => { const n = numOrNull(v); if (Number.isNaN(n) || (n != null && n < 0)) { t.classList.add('bad'); return; } t.classList.remove('bad');
      const P = W.app_inputs.plan = Object.assign({}, W.app_inputs.plan); if (sec) { P[sec] = Object.assign({}, P[sec]); if (n == null) delete P[sec][k]; else P[sec][k] = n; } else { if (n == null) delete P[k]; else P[k] = n; } };
    switch (t.id) {
      case 'ceMake': W.make = v.trim(); break; case 'ceModel': W.model = v.trim(); break; case 'ceType': W.type = v; draw(); break;
      case 'cePrelim': W.preliminary = t.checked; break;
      case 'ceDoc': s.doc = v; break; case 'ceRev': s.revision = v; break; case 'ceDate': s.date = v; break; case 'cePages': s.pages = v; break; case 'ceFile': s.file = v; break; case 'ceTerms': s.terms = v; break;
      case 'ceGfH': case 'ceGhd': case 'ceGbw': case 'ceGcb': case 'ceGct': {   // C3-1: app_inputs.geom
        const n = numOrNull(v); if (Number.isNaN(n) || (n != null && n < 0)) { t.classList.add('bad'); break; } t.classList.remove('bad');
        const k = { ceGfH: 'footH', ceGhd: 'head', ceGbw: 'boomW', ceGcb: 'cwBot', ceGct: 'cwTop' }[t.id], G0 = W.app_inputs.geom = Object.assign({}, W.app_inputs.geom); if (n == null) delete G0[k]; else G0[k] = n; break; }
      case 'ceTail': plan(null, 'tail'); break; case 'ceBf': plan(null, 'boomFoot'); break;
      case 'ceCrL': plan('crawler', 'length'); break; case 'ceCrG': plan('crawler', 'gauge'); break; case 'ceCrS': plan('crawler', 'shoe'); break;
      case 'ceOF': plan('outr', 'xFront'); break; case 'ceOR': plan('outr', 'xRear'); break; case 'ceFl': plan('outr', 'float'); break;
      case 'ceBF': plan('body', 'front'); break; case 'ceBR': plan('body', 'rear'); break; case 'ceBW': plan('body', 'width'); break;
      case 'ceSp': { const sp = {}; let bad = false; v.split(/[,;]/).map(x => x.trim()).filter(Boolean).forEach(x => { const m = /^([\w-]+)\s*[=:]\s*([\d.]+)$/.exec(x); if (m) sp[m[1]] = +m[2]; else bad = true; });
        t.classList.toggle('bad', bad); if (bad) break; const P = W.app_inputs.plan = Object.assign({}, W.app_inputs.plan); P.outr = Object.assign({}, P.outr); if (Object.keys(sp).length) P.outr.spreads = sp; else delete P.outr.spreads; break; }
      case 'ceCfg': ci = +v; chartMsg = null; draw(); break;
      case 'ceId': if (g) g.id = v.trim(); break; case 'ceLabel': if (g) g.label = v; break; case 'ceSupport': if (g) g.support = v.trim(); break; case 'ceZone': if (g) g.zone = v; break;
      case 'ceCw': if (g) { const n = numOrNull(v); t.classList.toggle('bad', Number.isNaN(n)); if (!Number.isNaN(n)) g.counterweight_lb = n; } break;
      case 'cePage': if (g) { const ps = v.split(/[,\s]+/).filter(Boolean).map(Number).filter(isFinite); g.page = ps.length > 1 ? ps : ps.length ? ps[0] : null; } break;
      case 'ceNotes': if (g) g.notes = v; break; case 'ceDed': if (g) g.deductions = Object.assign({}, g.deductions, { rule: v }); break;
      default: break;
    }
  }
  function readChart() {
    const g = W.configs[ci]; if (!g) return;
    const r = K.pasteChart(dlg.querySelector('#ceChart').value, dlg.querySelector('#ceUnit').value);
    chartMsg = r;
    if (r.chart) { const same = g.chart && g.chart.boom_lengths_ft && g.chart.boom_lengths_ft.length === r.chart.boom_lengths_ft.length; const cm = same ? g.chart.column_modes : null;
      g.chart = r.chart; if (cm) g.chart.column_modes = cm; if (dlg.querySelector('#ceUnit').value === 'kip') g.capacity_units_as_printed = 'kip (× 1,000 to lb in this tool)'; }
    draw();
  }
  function save() {
    // the open text box may hold a chart not read yet
    const g = W.configs[ci], ta = dlg.querySelector('#ceChart');
    if (g && ta && ta.value.trim() !== K.chartText(g.chart).trim()) { readChart(); if (chartMsg && chartMsg.errors.length) { msgs = ['The chart text was not read: fix it or press Read the chart.']; draw(); return; } }
    const r = K.parse(W);
    if (!r.ok) { msgs = r.errors.map(x => 'Error: ' + x); draw(); return; }
    const def = r.crane;
    if (orig && K.fingerprint(orig) !== K.fingerprint(def)) def.app_inputs.edited = { at: new Date().toISOString(), note: 'crane or chart data changed in the Crane Pick Analyzer editor' };
    if (!orig) def.app_inputs.edited = { at: new Date().toISOString(), note: 'entered in the Crane Pick Analyzer (pasted chart)' };
    const also = !cid || (dlg.querySelector('#ceAlsoLib') && dlg.querySelector('#ceAlsoLib').checked);
    if (also) { const l = UI().addToLibrary(def, { from: 'paste' }); if (!l.ok) A.notice(esc(l.message), 'warn'); }
    if (cid) { const old = UI().crane(cid); A.update(() => { old.def = def; }, 'cranes', { id: cid }); }
    else UI().addDefToProject(def, { from: 'paste', at: new Date().toISOString() });
    if (r.warnings.length) A.notice(`${esc(K.name(def))} saved. Check: ${r.warnings.map(esc).join(' · ')}`, 'warn');
    dlg.close(); UI().redraw();
  }
  function onClick(e) {
    if (e.target === dlg) return;
    const b = e.target.closest('[data-ce]'); if (!b) return; const a = b.dataset.ce;
    if (a === 'close') dlg.close();
    else if (a === 'read') readChart();
    else if (a === 'save') save();
    else if (a === 'cfgNew') { W.configs.push({ id: 'cfg' + (W.configs.length + 1), label: 'New config', boom: 'main', counterweight_lb: null, support: W.type === 'crawler' ? 'crawler' : 'outriggers-full', zone: '360', chart: { boom_lengths_ft: [], radii_ft: [], capacity_lb: [] }, notes: '', deductions: { rule: '' }, page: null }); ci = W.configs.length - 1; chartMsg = null; draw(); }
    else if (a === 'cfgDel') { if (confirm('Delete this config from the crane (the project copy; the library is not changed unless you keep it there)?')) { W.configs.splice(ci, 1); ci = Math.max(0, ci - 1); chartMsg = null; draw(); } }
  }
  window.CranePickCraneEdit = { open, get working() { return W; } };
})();
