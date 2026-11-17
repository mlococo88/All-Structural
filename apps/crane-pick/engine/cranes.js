/* apps/crane-pick/engine/cranes.js — crane definitions and chart lookup of the Crane Pick Analyzer (window.CranePickCranes). Classic
   script, no DOM. C2-1 (2026-11-16).

   Crane file: schema "crane-pick.crane.v1" (the library's SCHEMA.md: one JSON per crane, manufacturer chart data, capacities in lb,
   lengths in ft). Chart data is never part of this repository (it is public): a library is loaded from the engineer's private
   repository or from files, at run time (ui/cranes.js). The app adds one object of its own to a crane, `app_inputs` (entered in this
   tool: rating basis, zone sectors, plan dimensions, the phase-4 weights; and `edited` when the chart was changed here).

   parse(obj) -> { ok, crane, errors: [text], warnings: [text] }       structure check, never throws; the crane is a deep copy
   lookup(cfg, boom, R, o) -> the chart capacity (rule below) with its worked step
   ratingBasis(cfg, crane), interpPermitted(cfg), groups(crane), zoneOf(theta, sectors), planDims(crane), hookBlocks(crane),
   pasteChart(text, unit) -> { chart, errors, warnings }, chartText(chart), fingerprint(crane), key(crane)

   Lookup rule (Decision pending engineer review, conservative; CLAUDE.md §4: new calculation, stated in the PR and the fix log):
     no interpolation: the capacity is read at the next LONGER tabulated boom length (L_tab = smallest tabulated length ≥ L) and the
     next LARGER tabulated radius (R_tab = smallest tabulated radius ≥ R). A radius below the smallest or above the largest tabulated
     radius, a boom longer than the longest tabulated one, or a blank cell (null: no rating) is "not permitted". When L is between two
     tabulated lengths and the next SHORTER length's cell at R_tab is rated and lower, the lower value is used (some charts' notes ask for
     the lesser of the adjacent boom lengths). Columns repeated at one boom length (telescoping modes) give the lowest of them unless a
     mode is chosen. Optional (project setting, only where the chart notes are read to permit it): linear interpolation between the two
     tabulated radii around R, in the L_tab column, when both cells are rated. */
(function () {
  'use strict';
  const SCHEMA = 'crane-pick.crane.v1';
  const TYPES = ['crawler', 'all-terrain', 'rough-terrain', 'truck'];
  const ZONES = { '360': '360°', 'over-rear': 'over rear', 'over-side': 'over side', 'over-front': 'over front' };
  const EPS = 1e-6;
  const isNum = v => typeof v === 'number' && isFinite(v);
  const clone = o => JSON.parse(JSON.stringify(o));
  const fmtN = (x, d) => isNum(x) ? x.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—';
  /* TeX number (shared/steps.js style: thousands as {,}, minus as \minus) */
  const tx = (x, d) => { if (!isNum(x)) return String(x); const s = Math.abs(x).toFixed(d), [i, p] = s.split('.'); return (x < 0 && Number(s) !== 0 ? '\\minus ' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '{,}') + (p ? '.' + p : ''); };
  const dp = v => { const s = String(v); const k = s.indexOf('.'); return k < 0 ? 0 : Math.min(4, s.length - k - 1); };
  function slug(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-+|-+$/g, ''); }
  const key = c => slug((c && c.make || '') + '-' + (c && c.model || ''));
  const name = c => [c && c.make, c && c.model].filter(Boolean).join(' ') || 'Crane';
  /* fingerprint(crane): FNV-1a 32 of the crane without app_inputs (same chart data -> same text); shown so a project copy can be
     compared with the library copy */
  function canon(v) { if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']'; if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}'; return JSON.stringify(v === undefined ? null : v); }
  function fingerprint(c) { const o = Object.assign({}, c); delete o.app_inputs; const s = canon(o); let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return ('0000000' + h.toString(16)).slice(-8); }

  /* ---------- structure check ---------- */
  function checkChart(ch, where, errors, warnings) {
    if (!ch || typeof ch !== 'object') { errors.push(`${where}: no chart`); return; }
    const B = ch.boom_lengths_ft, R = ch.radii_ft, C = ch.capacity_lb;
    if (!Array.isArray(B) || !B.length || !B.every(isNum)) { errors.push(`${where}: boom_lengths_ft must be a list of numbers`); return; }
    if (!Array.isArray(R) || !R.length || !R.every(isNum)) { errors.push(`${where}: radii_ft must be a list of numbers`); return; }
    if (!B.every((b, i) => b > 0 && (!i || b >= B[i - 1]))) errors.push(`${where}: boom lengths must be positive and in increasing order`);
    if (!R.every((r, i) => r >= 0 && (!i || r > R[i - 1]))) errors.push(`${where}: radii must be in increasing order without repeats`);
    if (!Array.isArray(C) || C.length !== R.length) { errors.push(`${where}: capacity_lb needs one row per radius (${R.length})`); return; }
    let bad = 0, neg = 0;
    C.forEach((row, i) => {
      if (!Array.isArray(row) || row.length !== B.length) { errors.push(`${where}: row ${i + 1} (R = ${R[i]} ft) needs ${B.length} values (one per boom length)`); return; }
      row.forEach(v => { if (v !== null && !isNum(v)) bad++; else if (isNum(v) && v <= 0) neg++; });
    });
    if (bad) errors.push(`${where}: ${bad} cell(s) are neither a number nor blank (null)`);
    if (neg) errors.push(`${where}: ${neg} cell(s) are zero or negative`);
    if (errors.length) return;
    const inc = [], gaps = [];
    B.forEach((b, j) => {
      let prev = null, seen = false, gap = false;
      R.forEach((r, i) => {
        const v = C[i][j];
        if (v === null) { if (seen) gap = true; return; }
        if (gap) { gaps.push(`L ${b} ft at R ${r} ft`); gap = false; }
        if (prev !== null && v > prev) inc.push(`L ${b} ft: ${fmtN(prev, 0)} → ${fmtN(v, 0)} lb at R ${r} ft`);
        prev = v; seen = true;
      });
    });
    if (inc.length) warnings.push(`${where}: capacity increases with radius (${inc.length} place${inc.length > 1 ? 's' : ''}; check against the chart): ${inc.slice(0, 4).join('; ')}${inc.length > 4 ? '; …' : ''}`);
    if (gaps.length) warnings.push(`${where}: blank cells between rated cells (${gaps.length}; blanks are "no rating", never interpolated): ${gaps.slice(0, 4).join('; ')}${gaps.length > 4 ? '; …' : ''}`);
  }
  function parse(obj) {
    const errors = [], warnings = [];
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { ok: false, errors: ['not a crane file (a JSON object is expected)'], warnings };
    if (obj.schema !== SCHEMA) return { ok: false, errors: [`not a crane file: schema "${obj.schema == null ? '' : obj.schema}" (expected "${SCHEMA}")`], warnings };
    const c = clone(obj);
    if (!c.make || !c.model) errors.push('make and model are required');
    if (c.type && TYPES.indexOf(c.type) < 0) warnings.push(`type "${c.type}" is not one of ${TYPES.join(', ')}`);
    if (!c.source || typeof c.source !== 'object') { c.source = {}; warnings.push('no source document (source.doc / revision): enter it on the crane card'); }
    if (!Array.isArray(c.configs)) { errors.push('configs must be a list'); c.configs = []; }
    if (!c.dims || typeof c.dims !== 'object') c.dims = {};
    if (!c.weights || typeof c.weights !== 'object') c.weights = {};
    const ids = new Set();
    c.configs.forEach((g, k) => {
      const where = `config ${k + 1}${g && g.id ? ' (' + g.id + ')' : ''}`;
      if (!g || typeof g !== 'object') { errors.push(`${where}: not an object`); return; }
      if (!g.id) g.id = 'cfg' + (k + 1);
      if (ids.has(g.id)) errors.push(`${where}: duplicate config id`); ids.add(g.id);
      if (g.zone == null) g.zone = '360';
      if (!ZONES[g.zone]) errors.push(`${where}: zone "${g.zone}" is not one of ${Object.keys(ZONES).join(', ')}`);
      checkChart(g.chart, where, errors, warnings);
      if (Array.isArray(g.chart && g.chart.column_modes) && g.chart.column_modes.length !== (g.chart.boom_lengths_ft || []).length) errors.push(`${where}: column_modes needs one entry per boom length`);
      if (!ratingBasis(g, c).pct) warnings.push(`${where}: rating basis (% of tipping) not found in the notes: enter it on the crane card`);
    });
    if (!c.configs.length) warnings.push('no load charts in this file' + (c.configs_note ? ': ' + c.configs_note : ''));
    if (c.preliminary) warnings.push('the source document is marked PRELIMINARY');
    if (c.app_inputs && typeof c.app_inputs !== 'object') c.app_inputs = {};
    if (!errors.length && !c.app_inputs) c.app_inputs = {};
    return errors.length ? { ok: false, errors, warnings } : { ok: true, crane: c, errors, warnings };
  }

  /* ---------- notes: rating basis and interpolation ---------- */
  /* ratingBasis(cfg, crane) -> { pct, text, from: 'entered' | 'notes' | '' } (the % of tipping the chart is rated at) */
  function ratingBasis(cfg, crane) {
    const ai = crane && crane.app_inputs || {}, e = ai.rating && ai.rating[cfg && cfg.id];
    if (isNum(e) && e > 0) return { pct: e, text: `${e} % of tipping (entered)`, from: 'entered' };
    const n = String(cfg && cfg.notes || ''), m = /(\d{2}(?:\.\d+)?)\s*%\s*(?:of\s+)?(?:the\s+)?(static\s+)?tipping/i.exec(n);
    if (m) return { pct: +m[1], text: `${m[1]} % of ${m[2] ? 'static ' : ''}tipping (chart notes)`, from: 'notes' };
    return { pct: null, text: 'not stated in the extracted notes', from: '' };
  }
  /* interpPermitted(cfg): the chart notes mention interpolation and do not forbid it (read by pattern; the engineer confirms) */
  function interpPermitted(cfg) {
    const n = String(cfg && cfg.notes || '') + ' ' + String(cfg && cfg.deductions && cfg.deductions.rule || '');
    if (!/interpolat/i.test(n)) return false;
    return !/\b(no|not|never|without)\b[^.;]{0,30}interpolat|interpolat\w*\s+(is\s+|are\s+)?(not|never|prohibited)/i.test(n);
  }
  /* ---------- groups and zones ---------- */
  const modeOf = g => /pick[\s-]*(and|&)[\s-]*carry/i.test(g.label || '') ? 'pick-and-carry' : 'stationary';
  /* groups(crane) -> [{ key, label, configs: { zone: cfg } }]: the charts of one boom / counterweight / support / mode, by zone */
  function groups(c) {
    const out = [];
    (c && c.configs || []).forEach(g => {
      const k = [g.boom || 'main', g.counterweight_lb == null ? '' : g.counterweight_lb, g.counterweight_position || '', g.support || '', modeOf(g)].join('|');
      let gr = out.find(x => x.key === k);
      if (!gr) { gr = { key: k, configs: {}, label: '' }; out.push(gr); }
      if (!gr.configs[g.zone]) gr.configs[g.zone] = g;
    });
    out.forEach(gr => {
      const any = gr.configs['360'] || gr.configs[Object.keys(gr.configs)[0]];
      gr.label = String(any.label || any.id).replace(/,?\s*(360\s*(deg|°)|over[\s-](rear|side|front))\b/ig, '').replace(/\s+,/g, ',').trim();
      gr.zones = Object.keys(gr.configs);
    });
    return out;
  }
  const norm180 = a => { a = ((a % 360) + 360) % 360; return a > 180 ? a - 360 : a; };
  /* zoneOf(theta, sectors): theta = slew angle of the boom from the carrier front, degrees (0 front, ±180 rear); sectors = { front,
     rear } half-angles (deg) of the over-front / over-rear working areas (from the chart's working-area diagram); null = not set:
     that zone is then not used (conservative: the point counts as over side / 360) */
  function zoneOf(theta, sectors) {
    const t = Math.abs(norm180(theta)), s = sectors || {};
    if (isNum(s.front) && s.front > 0 && t <= s.front + EPS) return 'over-front';
    if (isNum(s.rear) && s.rear > 0 && t >= 180 - s.rear - EPS) return 'over-rear';
    return 'over-side';
  }
  /* chartFor(group, zone) -> the config used in that zone: its own chart, else the 360 chart, else none (the zone has no rating).
     'over-side' is every direction outside the front / rear sectors. */
  function chartFor(gr, zone) {
    if (!gr) return null;
    if (gr.configs[zone]) return gr.configs[zone];
    return gr.configs['360'] || null;
  }

  /* ---------- chart lookup ---------- */
  function cellFlag(cfg, R, B) {
    const hit = (f) => { const rs = Array.isArray(f.radius_ft) ? f.radius_ft : [f.radius_ft]; return Math.abs((f.boom_ft || 0) - B) < EPS && rs.some(r => Math.abs(r - R) < EPS); };
    const fl = (cfg.chart_flags || []).filter(f => f && hit(f)).map(f => String(f.flag || f.printed || 'flagged'));
    const mk = (cfg.chart_marks || []).filter(f => f && hit(f)).map(f => `${f.mark} (${f.note || 'chart mark'})`);
    return fl.concat(mk);
  }
  /* lookup(cfg, boom L, radius R, o = { interp, mode, idp, ref }) -> { ok, cap, status, why, Ltab, Rtab, i, j, notes: [], flags: [], steps } */
  function lookup(cfg, L, R, o) {
    o = o || {};
    const ch = cfg && cfg.chart, res = { ok: false, cap: null, status: 'invalid', why: '', notes: [], flags: [], steps: [], L, R };
    const ref = o.ref || (cfg ? `chart "${cfg.label || cfg.id}"${cfg.page ? ', PDF p. ' + [].concat(cfg.page).join(', ') : ''}` : '');
    const id = (o.idp || 'chart') + '.';
    if (!ch || !Array.isArray(ch.radii_ft)) { res.why = 'no chart'; return res; }
    if (!isNum(L) || L <= 0) { res.why = 'boom length not set'; return res; }
    if (!isNum(R) || R < 0) { res.why = 'radius not known'; return res; }
    const B = ch.boom_lengths_ft, Rs = ch.radii_ft, C = ch.capacity_lb, modes = ch.column_modes;
    const out = (status, why) => { res.status = status; res.why = why;
      res.steps = [{ id: id + 'C', label: `Chart capacity: ${why}`, sym: 'C_{chart}', eq: 'C(L_{tab}, R_{tab})', sub: `L = ${tx(L, dp(L))}\\,\\text{ft}, R = ${tx(R, 2)}\\,\\text{ft}`, value: 'not permitted', unit: '', d: 0, ref, note: '' }];
      return res; };
    const Ltab = B.find(b => b >= L - EPS);
    if (Ltab === undefined) return out('outside', `boom ${fmtN(L, 1)} ft is longer than the longest tabulated length (${fmtN(B[B.length - 1], 1)} ft)`);
    if (R < Rs[0] - EPS) return out('outside', `radius ${fmtN(R, 2)} ft is less than the smallest tabulated radius (${fmtN(Rs[0], 1)} ft)`);
    const i = Rs.findIndex(r => r >= R - EPS);
    if (i < 0) return out('outside', `radius ${fmtN(R, 2)} ft is beyond the largest tabulated radius (${fmtN(Rs[Rs.length - 1], 1)} ft)`);
    let cols = B.map((b, j) => j).filter(j => Math.abs(B[j] - Ltab) < EPS);
    if (o.mode != null && Array.isArray(modes)) { const m = cols.filter(j => String(modes[j]) === String(o.mode)); if (m.length) cols = m; }
    const Rtab = Rs[i];
    const vals = cols.map(j => ({ j, v: C[i][j] })).filter(x => x.v !== null);
    if (!vals.length) return out('blank', `blank chart cell at L ${fmtN(Ltab, 1)} ft, R ${fmtN(Rtab, 1)} ft (no rating)`);
    if (vals.length < cols.length) return out('blank', `a telescoping mode at L ${fmtN(Ltab, 1)} ft has no rating at R ${fmtN(Rtab, 1)} ft; choose the mode`);
    let pick = vals.reduce((a, b) => b.v < a.v ? b : a);
    if (cols.length > 1) res.notes.push(`${cols.length} columns at ${fmtN(Ltab, 1)} ft (telescoping modes${Array.isArray(modes) ? ' ' + cols.map(j => modes[j]).join(' / ') : ''}): the lowest is used${o.mode != null ? '' : ' (no mode chosen)'}.`);
    let cap = pick.v, j = pick.j, how = 'read';
    const steps = [];
    steps.push({ id: id + 'Lt', label: 'Next longer tabulated boom length', sym: 'L_{tab}', eq: '\\min\\{L_{k} \\ge L\\}', sub: `L = ${tx(L, dp(L))}\\,\\text{ft}`, value: Ltab, unit: 'ft', d: dp(Ltab), ref, note: '' });
    steps.push({ id: id + 'Rt', label: 'Next larger tabulated radius', sym: 'R_{tab}', eq: '\\min\\{R_{k} \\ge R\\}', sub: `R = ${tx(R, 2)}\\,\\text{ft}`, value: Rtab, unit: 'ft', d: dp(Rtab), ref, note: '' });
    // optional linear interpolation between radii (setting; only when the notes permit it)
    if (o.interp && interpPermitted(cfg) && i > 0 && R < Rtab - EPS && R > Rs[i - 1] + EPS) {
      const lo = C[i - 1][j];
      if (lo !== null && cols.length === 1) {
        const r0 = Rs[i - 1], v = lo + (cap - lo) * (R - r0) / (Rtab - r0);
        steps.push({ id: id + 'Ci', label: 'Linear interpolation between the tabulated radii (chart notes permit it; project setting)', sym: 'C_{chart}', eq: 'C_{1} + (C_{2} - C_{1}) \\frac{R - R_{1}}{R_{2} - R_{1}}',
          sub: `${tx(lo, 0)} + (${tx(cap, 0)} - ${tx(lo, 0)}) \\frac{${tx(R, 2)} - ${tx(r0, dp(r0))}}{${tx(Rtab, dp(Rtab))} - ${tx(r0, dp(r0))}}`, value: v, unit: 'lb', d: 0, ref, note: '' });
        cap = v; how = 'interp';
      }
    }
    if (how === 'read') steps.push({ id: id + 'C', label: 'Chart capacity at L_tab and R_tab (no interpolation)', sym: 'C_{chart}', eq: 'C(L_{tab}, R_{tab})', sub: `C(${tx(Ltab, dp(Ltab))}\\,\\text{ft}, ${tx(Rtab, dp(Rtab))}\\,\\text{ft})`, value: cap, unit: 'lb', d: 0, ref, note: '' });
    // the next shorter boom length (L between two tabulated lengths): its cell governs when rated and lower
    if (Ltab > L + EPS) {
      const Ls = B.filter(b => b < L - EPS).pop();
      if (Ls !== undefined) {
        const sc = B.map((b, k) => k).filter(k => Math.abs(B[k] - Ls) < EPS).map(k => C[i][k]).filter(v => v !== null);
        if (sc.length) { const v = Math.min(...sc);
          if (v < cap) { steps.push({ id: id + 'Cs', label: `The next shorter tabulated boom length (${fmtN(Ls, 1)} ft) is rated lower at R_tab: the lesser of the adjacent boom lengths governs`, sym: 'C_{chart}', eq: '\\min(C(L_{tab}, R_{tab}), C(L_{short}, R_{tab}))', sub: `\\min(${tx(cap, 0)}, ${tx(v, 0)})`, value: v, unit: 'lb', d: 0, ref, note: '' }); cap = v; res.notes.push(`The next shorter boom length (${fmtN(Ls, 1)} ft) is rated lower at ${fmtN(Rtab, 1)} ft; the lesser is used.`); } } }
    }
    res.flags = cellFlag(cfg, Rtab, Ltab);
    if (res.flags.some(f => /special equipment/i.test(f))) { return Object.assign(out('flagged', `the chart cell at L ${fmtN(Ltab, 1)} ft, R ${fmtN(Rtab, 1)} ft is marked "${res.flags.join('; ')}" (not a general rating)`), { flags: res.flags }); }
    return Object.assign(res, { ok: true, cap, status: 'ok', why: '', Ltab, Rtab, i, j, how, steps });
  }

  /* ---------- weights and dimensions ---------- */
  /* hookBlocks(crane) -> [{ label, lb }] from weights.hook_blocks (as listed) */
  function hookBlocks(c) {
    const hb = c && c.weights && c.weights.hook_blocks;
    return (Array.isArray(hb) ? hb : []).filter(h => h && isNum(h.lb)).map(h => ({ label: h.item || (h.capacity_lb ? fmtN(h.capacity_lb, 0) + ' lb block' : 'hook block') + (h.sheaves ? `, ${h.sheaves} sheave${h.sheaves > 1 ? 's' : ''}` : ''), lb: h.lb, page: h.page }));
  }
  const dval = v => v && typeof v === 'object' && isNum(v.value) ? v.value : (isNum(v) ? v : null);
  const dpage = v => v && typeof v === 'object' && v.page != null ? v.page : null;
  function first(o, ks) { if (!o) return null; for (const k of ks) { const v = dval(o[k]); if (v != null) return v; } return null; }
  /* firstAt(o, ks): the key and printed page of the value first() reads (provenance only; Crane tab, C9) */
  function firstAt(o, ks) { if (!o) return null; for (const k of ks) { const v = dval(o[k]); if (v != null) return { key: k, page: dpage(o[k]) }; } return null; }
  /* planDims(crane) -> the plan geometry the map draws (ft, from the centre of rotation; x forward along the carrier, y to the left):
     { kind: 'crawler' | 'wheeled', tail, boomFoot, body: { front, rear, width }, outr: { xFront, xRear, spreads: { key: ft }, float },
       crawler: { length, gauge, shoe }, assumed: [text], src }. From the file's dims where they are given; app_inputs.plan overrides any value.
     Display and plan clearance only (no capacity depends on it).
     src (C9, the Crane tab; provenance only, no value changed): { 'tail' | 'boomFoot' | 'body.front' | … | 'outr.spreads.<k>' | 'crawler.shoe':
       { from: 'file' | 'entered' | 'assumed' | 'derived', key, page, note } } for every value set (a value not set has no entry). */
  function planDims(c) {
    const d = (c && c.dims) || {}, cc = d.carrier_or_carbody || {}, o = d.outriggers || {}, cr = d.crawler || {}, cor = d.center_of_rotation || {};
    const kind = (c && c.type) === 'crawler' ? 'crawler' : 'wheeled', assumed = [], src = {};
    const fileS = (k, at) => { if (at) src[k] = { from: 'file', key: at.key, page: at.page }; };
    const p = { kind, tail: dval(d.tail_swing_radius), boomFoot: first(d.boom_foot, ['ahead_of_rotation']) || 0, body: null, outr: null, crawler: null, assumed, src };
    if (p.tail != null) src.tail = { from: 'file', key: 'tail_swing_radius', page: dpage(d.tail_swing_radius) };
    if (first(d.boom_foot, ['ahead_of_rotation']) != null) fileS('boomFoot', firstAt(d.boom_foot, ['ahead_of_rotation'])); else src.boomFoot = { from: 'assumed', note: 'boom-foot offset 0 ft (on the rotation centre)' };
    if (kind === 'crawler') {
      const len = first(cr, ['track_length_overall', 'tumbler_centres']), shoe = first(cr, ['shoe_width']);
      fileS('crawler.length', firstAt(cr, ['track_length_overall', 'tumbler_centres'])); fileS('crawler.shoe', firstAt(cr, ['shoe_width']));
      let gauge = first(cr, ['track_gauge_extended']); fileS('crawler.gauge', firstAt(cr, ['track_gauge_extended']));
      if (gauge == null && shoe != null) { const w = first(cr, ['width_over_tracks_extended', 'overall_width_outermost']); if (w != null) { gauge = w - shoe; assumed.push('track gauge = width over tracks − shoe width');
        const at = firstAt(cr, ['width_over_tracks_extended', 'overall_width_outermost']); src['crawler.gauge'] = { from: 'derived', key: at.key, page: at.page, note: 'width over tracks − shoe width' }; } }
      p.crawler = { length: len, gauge, shoe };
      if (len != null) assumed.push('crawler centred on the centre of rotation');
      const bl = first(cc, ['carbody_length']), bw = first(cc, ['carbody_width', 'upper_width']);
      if (bl != null && bw != null) { p.body = { front: bl / 2, rear: bl / 2, width: bw }; const at = firstAt(cc, ['carbody_length']);
        src['body.front'] = src['body.rear'] = { from: 'derived', key: at.key, page: at.page, note: 'carbody length / 2 (carbody centred on the rotation centre)' }; fileS('body.width', firstAt(cc, ['carbody_width', 'upper_width'])); }
    } else {
      const st = o.spread_transverse || {}, sl = o.spread_longitudinal || {}, spreads = {};
      Object.keys(st).forEach(k => { const v = dval(st[k]); if (v != null && v > 0) { spreads[k] = v; src['outr.spreads.' + k] = { from: 'file', key: 'spread_transverse.' + k, page: dpage(st[k]) }; } });
      let xF = first(sl, ['front_outrigger_to_rotation']), xR = first(sl, ['rotation_to_rear_outrigger']);
      fileS('outr.xFront', firstAt(sl, ['front_outrigger_to_rotation'])); fileS('outr.xRear', firstAt(sl, ['rotation_to_rear_outrigger']));
      if (xR == null) { xR = first(cor, ['rotation_to_rear_outrigger']); fileS('outr.xRear', firstAt(cor, ['rotation_to_rear_outrigger'])); }
      const tot = first(sl, ['total', 'total_derived', 'top_chain_total']), totAt = firstAt(sl, ['total', 'total_derived', 'top_chain_total']);
      if (tot != null && xF == null && xR != null) { xF = tot - xR; assumed.push('front outrigger position = longitudinal spread − rear distance'); src['outr.xFront'] = { from: 'derived', key: totAt.key, page: totAt.page, note: 'longitudinal spread − rear distance' }; }
      if (tot != null && xR == null && xF != null) { xR = tot - xF; assumed.push('rear outrigger position = longitudinal spread − front distance'); src['outr.xRear'] = { from: 'derived', key: totAt.key, page: totAt.page, note: 'longitudinal spread − front distance' }; }
      if (tot != null && xF == null && xR == null) { xF = xR = tot / 2; assumed.push('outrigger beams centred on the centre of rotation'); src['outr.xFront'] = src['outr.xRear'] = { from: 'assumed', key: totAt.key, page: totAt.page, note: 'outrigger beams centred on the centre of rotation (spread / 2)' }; }
      p.outr = { xFront: xF, xRear: xR, spreads, float: first(o, ['float_size']) }; fileS('outr.float', firstAt(o, ['float_size']));
      const L = first(cc, ['overall_carrier_length', 'carrier_length', 'overall_length']), W = first(cc, ['carrier_width', 'overall_width', 'carrier_width_overall']);
      if (L != null && W != null) {
        const Lat = firstAt(cc, ['overall_carrier_length', 'carrier_length', 'overall_length']);
        let rear = first(cor, ['rotation_to_rear_of_carrier']); fileS('body.rear', firstAt(cor, ['rotation_to_rear_of_carrier']));
        if (rear == null) { rear = L / 2 - ((xF != null && xR != null) ? (xF - xR) / 2 : 0); assumed.push('carrier centred between the outrigger beams'); src['body.rear'] = { from: 'assumed', key: Lat.key, page: Lat.page, note: 'carrier centred between the outrigger beams' }; }
        p.body = { front: L - rear, rear, width: W };
        src['body.front'] = { from: src['body.rear'].from === 'assumed' ? 'assumed' : 'derived', key: Lat.key, page: Lat.page, note: 'carrier length − rotation to rear of carrier' }; fileS('body.width', firstAt(cc, ['carrier_width', 'overall_width', 'carrier_width_overall']));
      }
    }
    applyGeometry(c, p);
    const ov = c && c.app_inputs && c.app_inputs.plan;
    if (ov && typeof ov === 'object') {
      ['tail', 'boomFoot'].forEach(k => { if (isNum(ov[k])) { p[k] = ov[k]; src[k] = { from: 'entered' }; } });
      ['body', 'outr', 'crawler'].forEach(k => { if (ov[k] && typeof ov[k] === 'object') { p[k] = Object.assign({}, p[k] || {}); Object.keys(ov[k]).forEach(q => { const v = ov[k][q]; if (q === 'spreads' && v && typeof v === 'object') { p[k].spreads = Object.assign({}, p[k].spreads || {}, v); Object.keys(v).forEach(sk => { if (isNum(v[sk])) src[`${k}.spreads.${sk}`] = { from: 'entered' }; }); } else if (isNum(v)) { p[k][q] = v; src[k + '.' + q] = { from: 'entered' }; } }); } });
    }
    return p;
  }
  /* geometry block (2026-11-17, crane-pick.geometry.v1: the manufacturer's dimension drawings, private library): geomVal(e) -> the value
     of an entry the CALCULATIONS may use: basis 'printed' or 'derived' only ('scaled' = measured off the drawing: drawing only, never in
     a calculation). applyGeometry(c, p) puts those values into planDims (they replace the dims values; app_inputs.plan still overrides),
     src = { from: 'file', key: 'geometry.<path>', page, basis }. Not used by the engines (drawing only, engine/cranegfx.js): the crawler's
     x_centre (the engines keep the crawler centred on the rotation centre: |x_centre| ≤ 0.13 ft in the library), per-float staggered
     positions (x_front / x_rear hold the smaller ones), front spreads that differ from the rear ones, the float shape (bearing keeps the
     round float of diameter = size: π/4·f² ≤ f², conservative), the boom-foot pin (the Heights tab offset e is unchanged). */
  const GEO_SCHEMA = 'crane-pick.geometry.v1';
  function geometryOf(c) { const g = c && c.geometry; return g && typeof g === 'object' && g.schema === GEO_SCHEMA ? g : null; }
  function geomVal(e) { return e && typeof e === 'object' && isNum(e.value) && (e.basis === 'printed' || e.basis === 'derived') ? e.value : null; }
  function applyGeometry(c, p) {
    const g = geometryOf(c); if (!g) return; p.geometry = true;
    const set = (obj, k, e, srcKey, path) => { const v = geomVal(e); if (v == null || !(v > 0) && k !== 'shoe') return false; obj[k] = v; p.src[srcKey] = { from: 'file', key: 'geometry.' + path, page: e.page, basis: e.basis, note: e.note || '' }; return true; };
    const tl = g.counterweight && g.counterweight.tail_radius; if (geomVal(tl) != null) { p.tail = geomVal(tl); p.src.tail = { from: 'file', key: 'geometry.counterweight.tail_radius', page: tl.page, basis: tl.basis }; }
    const ca = g.carrier || {};
    if (p.kind === 'crawler') {
      const cr = g.crawler || {}; p.crawler = Object.assign({}, p.crawler || {});
      set(p.crawler, 'length', cr.length, 'crawler.length', 'crawler.length'); set(p.crawler, 'shoe', cr.shoe, 'crawler.shoe', 'crawler.shoe');
      if (set(p.crawler, 'gauge', cr.gauge, 'crawler.gauge', 'crawler.gauge')) for (let i = p.assumed.length - 1; i >= 0; i--) if (/track gauge =/.test(p.assumed[i])) p.assumed.splice(i, 1);
      return;
    }
    const o = g.outriggers || {}, sp = o.spreads || {};
    if (geomVal(o.x_front) != null || geomVal(o.x_rear) != null || Object.keys(sp).length) {
      p.outr = Object.assign({ spreads: {} }, p.outr || {}); p.outr.spreads = Object.assign({}, p.outr.spreads || {});
      set(p.outr, 'xFront', o.x_front, 'outr.xFront', 'outriggers.x_front'); set(p.outr, 'xRear', o.x_rear, 'outr.xRear', 'outriggers.x_rear');
      Object.keys(sp).forEach(k => set(p.outr.spreads, k, sp[k], 'outr.spreads.' + k, 'outriggers.spreads.' + k));
      if (o.float) { set(p.outr, 'float', o.float.size, 'outr.float', 'outriggers.float.size'); if (o.float.shape === 'square' || o.float.shape === 'round') p.outr.floatShape = o.float.shape; }
    }
    const F = geomVal(ca.front), R = geomVal(ca.rear), W = geomVal(ca.width);
    if (F != null && R != null && W != null) {
      p.body = { front: F, rear: R, width: W };
      [['front', 'body.front'], ['rear', 'body.rear'], ['width', 'body.width']].forEach(([k, sk]) => { p.src[sk] = { from: 'file', key: 'geometry.carrier.' + k, page: ca[k].page, basis: ca[k].basis, note: ca[k].note || '' }; });
      for (let i = p.assumed.length - 1; i >= 0; i--) if (/carrier centred/.test(p.assumed[i])) p.assumed.splice(i, 1);
    }
  }
  /* the outrigger position a config's support names ('outriggers-full' -> 'full'), when the crane lists it */
  function spreadKey(cfg, p) { const m = /^outriggers-(.+)$/.exec(cfg && cfg.support || ''); if (!m || !p.outr) return null; return p.outr.spreads[m[1]] != null ? m[1] : null; }

  /* ---------- pasted charts (Excel: radius rows × boom-length columns) ---------- */
  /* pasteChart(text, unit 'lb' | 'kip') -> { chart: { boom_lengths_ft, radii_ft, capacity_lb }, errors, warnings }
     First row: the boom lengths (its first cell is a label or blank); each next row: the radius, then one capacity per boom length.
     Blank, '-', '—' or '*'-only cells are blanks (no rating). Numbers may have thousands commas; a trailing mark (*, #) is dropped and
     listed in the warnings. kip values are × 1,000 (exact). */
  function pasteChart(text, unit) {
    const errors = [], warnings = [], k = unit === 'kip' ? 1000 : 1, marks = [];
    const rows = String(text || '').replace(/\r/g, '').split('\n').filter(l => l.trim() !== '').map(l => l.indexOf('\t') >= 0 ? l.split('\t') : l.trim().split(/\s+/));
    if (rows.length < 2) return { chart: null, errors: ['paste at least two rows: the boom lengths, then one row per radius'], warnings };
    const cell = (s, where) => { const t = String(s == null ? '' : s).trim(); if (!t || /^[-–—*#]+$/.test(t)) return null; const m = /^([\d,]*\.?\d+)\s*([*#]+)?$/.exec(t.replace(/\s/g, '')); if (!m) { errors.push(`${where}: "${t}" is not a number`); return null; } if (m[2]) marks.push(where); return Number(m[1].replace(/,/g, '')); };
    const head = rows[0].slice(1).map((s, j) => cell(s, `boom length ${j + 1}`));
    while (head.length && head[head.length - 1] === null) head.pop();
    if (!head.length || head.some(v => v === null)) errors.push('the first row must hold the boom lengths (ft), after one label cell');
    const R = [], C = [];
    rows.slice(1).forEach((r, i) => {
      const rv = cell(r[0], `row ${i + 2} radius`); if (rv === null) { errors.push(`row ${i + 2}: the first cell must be the radius (ft)`); return; }
      const vals = head.map((b, j) => { const v = cell(r[j + 1], `R ${rv} ft, L ${b} ft`); return v === null ? null : v * k; });
      if (r.slice(head.length + 1).some(s => String(s).trim() !== '')) warnings.push(`row ${i + 2}: values beyond the last boom length were ignored`);
      R.push(rv); C.push(vals);
    });
    if (marks.length) warnings.push(`marks (* #) dropped from ${marks.length} cell(s): ${marks.slice(0, 4).join('; ')}${marks.length > 4 ? '; …' : ''}: note them in the config notes`);
    const chart = { boom_lengths_ft: head, radii_ft: R, capacity_lb: C };
    if (!errors.length) checkChart(chart, 'pasted chart', errors, warnings);
    return { chart: errors.length ? null : chart, errors, warnings };
  }
  /* chartText(chart): the chart as tab-separated text (the editor's text box; pasteChart reads it back unchanged) */
  function chartText(ch) {
    if (!ch || !Array.isArray(ch.radii_ft) || !ch.radii_ft.length) return '';
    return ['R (ft) \\ L (ft)\t' + ch.boom_lengths_ft.join('\t')].concat(ch.radii_ft.map((r, i) => r + '\t' + (ch.capacity_lb[i] || []).map(v => v == null ? '' : v).join('\t'))).join('\n');
  }
  /* a new crane (the editor's "New crane"): the schema's minimum */
  function blank(o) {
    o = o || {};
    return { schema: SCHEMA, make: o.make || 'New', model: o.model || 'crane', type: o.type || 'all-terrain', preliminary: false,
      source: { file: '', doc: '', revision: '', date: '', pages: '', terms: '' }, units: { length: 'ft', weight: 'lb' }, dims: {}, weights: {}, configs: [], app_inputs: {} };
  }
  window.CranePickCranes = { GEO_SCHEMA, geometryOf, geomVal, SCHEMA, TYPES, ZONES, parse, lookup, ratingBasis, interpPermitted, groups, zoneOf, chartFor, norm180, planDims, spreadKey,
    hookBlocks, pasteChart, chartText, fingerprint, key, name, slug, blank, modeOf, cellFlag, dval, dpage };
})();
