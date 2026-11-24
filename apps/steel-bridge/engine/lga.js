/* apps/steel-bridge/engine/lga.js — MIDAS Civil NX "Line Girder Analysis" project files (.lga): import into an sbd2 project and
   export of an sbd2 project (window.SBDLga). Classic script, no DOM, no fetch. Added 2026-11-19 (fixlog/steel-bridge.md, LGA).

   Nothing here computes a design value. The import writes inputs; the export reads inputs and, for the values MIDAS takes as inputs
   but the app computes (distribution factors, dead-load shares, n, cross-frame stations, stiffener stations), the app's own results
   through its engines (engine/loads.js, lldf.js, analysis.js, framing.js, stiffeners.js, crossframes.js; read at call time).

   The .lga file is plain JSON: { version: '1.0', app: 'Line Girder Analysis', app_version, saved, project: { the 141 keys of KEYS } }.
   Units in the file: ft (lengths, stations), in (plates, deck, cover, spacing of bars and studs), ksi, kcf, klf, ksf, in^2 (bar area).

   Import: fromLga(obj, { base, fileName, now }) -> { ok, project, report } or { ok: false, error }.
     base: the open project to import into (its inputs the file does not have are kept); absent: SBDModel.newProject().
     report = { mapped: [{ sec, lga, from, app, to, conv }], ignored: [{ lga, value, why }], incons: [{ what, detail }], info: [text],
                errors: [{ path, msg }] (SBDModel.validate of the result), file: { version, app_version, saved } }.
     The file's project object (without midas_url) is kept in project.midasLga.keep so that an export writes back the MIDAS inputs the
     app does not model (CLAUDE.md §5: nothing dropped). midas_url is never stored.
   Export: exportCalc(P) -> the app's values the export needs (or { errors }); toLga(P, opt, calc) -> { ok, file, text, name, summary }.
     opt = { lldfUser: true, nExplicit: true, dlCustom: true } (the dialog's three options, default on).
     summary = { written: [text], approx: [text], info: [text] }.

   Conversions (MIDAS -> app; the export does the reverse):
     t_deck = structural slab t_s; t_deck + t_wear_integral = total deck thickness (engineer's reading, 2026-11-19; pending review);
     d_haunch (top of WEB to deck soffit) - the thickest top flange t_f = haunch (top of STEEL to deck soffit);
     bar area A_b at spacing s within b_eff: A_r = floor(b_eff / s) A_b (whole bars; b_eff of the interior design line); centroid = cover + d_b/2;
     ADTT_SL = p ADTT (AASHTO LRFD 10th Ed. Eq. 3.6.1.4.2-1, p by the number of lanes of Table 3.6.1.4.2-1);
     n_override (or Ec_override) -> w_c for E_c with n = 29,000 / (120,000 K_1 w_cE^2 f'c^0.33) (Eq. 5.4.2.4-1, the app's n);
     user LLDF: g = max(1 lane, 2+ lanes) and fatigue = 1 lane / 1.2 (C3.6.1.1.2) -> girders[i].dfPull, per girder type;
     ksf -> psf (x 1000); per-girder klf -> bridge-total line loads (x N_b, shared equally).
   Multi-span fields (segments by span, field splices, cross-frame spacing by span, design locations, negative moment regions):
   inferred from the single-span sample's structure; unverified until a multi-span MIDAS sample is checked. */
(function () {
  'use strict';
  const KEYS = ['project_name', 'designer', 'bridge_id', 'job_number', 'client_owner', 'location_route', 'checked_by', 'approved_by', 'pe_license', 'report_date',
    'revision', 'revision_description', 'revision_history', 'code_edition', 'analysis_mode', 'lane_position_mode', 'design_lanes', 'num_spans', 'span_lengths',
    'support_restraints', 'skew_angle', 'apply_moment_skew_factor', 'apply_shear_skew_factor', 'lldf_mode', 'lldf_user_int_M_1L', 'lldf_user_int_M_2L',
    'lldf_user_int_V_1L', 'lldf_user_int_V_2L', 'lldf_user_ext_M_1L', 'lldf_user_ext_M_2L', 'lldf_user_ext_V_1L', 'lldf_user_ext_V_2L', 'element_length',
    'transverse_plate_size', 'transverse_orientation', 'horizontal_radius_ft', 'curve_direction', 'curvature_flange_lateral_N', 'design_locations_by_span',
    'design_locations', 'field_splice_locations', 'field_splice_text', 'girder_field_splice_locations_by_label', 'girder_field_splice_text_by_label',
    'negative_moment_regions', 'segments', 'girder_schedule_same_all', 'girder_segments_by_label', 'girder_segments_by_span', 'girder_segments_by_span_stash',
    'girder_design_locations_by_label', 'num_girders', 'girder_spacing', 'deck_overhang', 'roadway_width', 'barrier_width', 'cross_frame_spacing',
    'cross_frame_spacing_by_span', 'cross_frame_locations', 't_deck', 't_wear_integral', 'd_haunch', 'haunch_width', 'top_rebar_area', 'top_rebar_spacing',
    'top_rebar_cover', 'fy_rebar', 'bot_rebar_area', 'bot_rebar_spacing', 'bot_rebar_cover', 'Fy_steel', 'fc_concrete', 'wc_concrete', 'use_material_overrides',
    'Es_override', 'Ec_override', 'n_override', 'es_override_enabled', 'ec_override_enabled', 'n_override_enabled', 'w_parapet', 'n_parapets', 'w_fws_ksf',
    'w_crossframes', 'w_misc', 'w_deckforms', 'w_utilities', 'girder_self_weight_apply', 'girder_self_weight_override_enabled', 'girder_self_weight_override_klf',
    'deck_apply', 'deck_override_enabled', 'deck_override_klf', 'haunch_apply', 'haunch_override_enabled', 'haunch_override_klf', 'barrier_apply',
    'barrier_override_enabled', 'barrier_override_klf', 'fws_apply', 'fws_override_enabled', 'fws_override_klf', 'dc1_dist_mode', 'dc2_dist_mode', 'dw_dist_mode',
    'dc1_dist_pct', 'dc2_dist_pct', 'dw_dist_pct', 'ADTT_SL', 'fatigue_detail_category', 'moving_load_entries', 'moving_load_available_entries',
    'moving_load_custom_lists', 'moving_load_active_list_label', 'design_pt_node_target', 'design_pt_splice', 'design_pt_user', 'girder_design_point_types_by_label',
    'load_combinations', 'design_phi_y', 'design_phi_u', 'design_phi_c', 'design_phi_f', 'design_phi_v', 'design_phi_sc', 'design_phi_b', 'design_use_appendix_a6',
    'girder_cross_frame_locations_by_label', 'girder_cross_frame_schedule_by_label', 'bracing_details', 'bracing_assignment', 'bracing_user_sections',
    'bracing_section_set', 'deck_pour_sequence', 'girder_connector_properties_by_label', 'girder_connector_zones_by_label', 'girder_connector_neg_composite_by_label',
    'girder_transverse_stiffener_zones_by_label', 'girder_rebar_zones_by_label', 'girder_rebar_runs_by_label', 'midas_url'];
  const UNVERIFIED = 'Multi-span fields (segments and schedules by span, field splices, cross-frame spacing by span, design locations, negative moment regions, support restraints) follow the structure of a single-span MIDAS file: unverified until a multi-span MIDAS sample is checked.';
  /* ASTM A615 bars: area (in^2), nominal diameter (in) */
  const BARS = { '#3': [0.11, 0.375], '#4': [0.20, 0.5], '#5': [0.31, 0.625], '#6': [0.44, 0.75], '#7': [0.60, 0.875], '#8': [0.79, 1.0], '#9': [1.00, 1.128], '#10': [1.27, 1.27], '#11': [1.56, 1.41] };
  const CATS = ['A', 'B', "B'", 'C', "C'", 'D', 'E', "E'"];
  const STUD_D = [0.75, 0.875, 1];
  const MAPPED_PREFIX = 'MIDAS ';   // xs.extra rows written by the import (their name starts with it)

  const isNum = v => typeof v === 'number' && isFinite(v);
  const num = v => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
  const clone = o => JSON.parse(JSON.stringify(o));
  const r4 = x => Math.round(x * 1e4) / 1e4, r6 = x => Math.round(x * 1e6) / 1e6;
  const f = (x, d) => isNum(x) ? String(+x.toFixed(d == null ? 4 : d)) : String(x);
  const js = v => { const t = JSON.stringify(v); return t == null ? String(v) : t.length > 160 ? t.slice(0, 157) + '…' : t; };
  const arr = v => Array.isArray(v) ? v : [];
  const labelsOf = nb => Array.from({ length: nb }, (_, j) => 'G' + (j + 1));
  const barOfArea = A => { let best = null; Object.keys(BARS).forEach(k => { if (best == null || Math.abs(BARS[k][0] - A) < Math.abs(BARS[best][0] - A)) best = k; }); return best; };
  const gradeOf = Fy => Fy >= 69.5 ? 'HPS70W' : Fy <= 36.5 ? '36' : '50';   // Decision (pending engineer review): Fy 50 -> grade '50' (F_u 65), not 50W (F_u 70)
  const lanesOf = w => (w >= 20 && w <= 24) ? 2 : Math.max(1, Math.floor(w / 12 + 1e-9));   // AASHTO LRFD 10th Ed. Art. 3.6.1.1.1
  const pOf = nl => nl <= 1 ? 1.0 : nl === 2 ? 0.85 : 0.80;   // Table 3.6.1.4.2-1
  const supOf = spans => { const s = [0]; spans.forEach(L => s.push(+(s[s.length - 1] + +L).toFixed(6))); return s; };
  const plateKeys = ['D', 'tw', 'topB', 'topT', 'botB', 'botT'];
  const samePl = (a, b) => plateKeys.every(k => Math.abs(+a[k] - +b[k]) < 1e-9);

  /* ---------------------------------------------------------------- import ---------------------------------------------------------------- */
  function fromLga(obj, opt) {
    opt = opt || {};
    const fail = error => ({ ok: false, error });
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return fail('Not a JSON object.');
    if (obj.app !== 'Line Girder Analysis' || !obj.project || typeof obj.project !== 'object') return fail('Not a MIDAS Line Girder Analysis (.lga) file: the file has no "app": "Line Girder Analysis" and "project" object. Nothing was changed.');
    const W = typeof window !== 'undefined' ? window : {}, M = W.SBDModel;
    if (!M) return fail('engine/model.js is not loaded.');
    const L = obj.project, seen = new Set(['midas_url']);
    const R = { mapped: [], ignored: [], incons: [], info: [], errors: [], file: { version: obj.version, app_version: obj.app_version, saved: obj.saved } };
    const map = (sec, keys, from, app, to, conv) => { keys.forEach(k => seen.add(k)); R.mapped.push({ sec, lga: keys.join(', '), from: String(from), app, to: String(to), conv: conv || '' }); };
    const ign = (keys, why) => keys.forEach(k => { seen.add(k); if (k in L) R.ignored.push({ lga: k, value: js(L[k]), why }); });
    const inc = (what, detail) => R.incons.push({ what, detail });
    const info = t => R.info.push(t);
    if (obj.version !== '1.0') inc('File version', `The file says version ${js(obj.version)}; this importer was written for version "1.0". Every value read is listed below.`);

    // ---- spans and girders
    const spans = arr(L.span_lengths).map(num);
    if (!spans.length || spans.some(x => !(x > 0))) return fail('span_lengths must be a list of positive span lengths (ft). Nothing was changed.');
    const ns = spans.length, nb = Math.round(num(L.num_girders)), S = num(L.girder_spacing), oh = num(L.deck_overhang);
    if (!(nb >= 2)) return fail('num_girders must be 2 or more. Nothing was changed.');
    if (!(S > 0)) return fail('girder_spacing must be positive. Nothing was changed.');
    const P = opt.base ? clone(opt.base) : M.newProject();
    const sup = supOf(spans), Lt = sup[sup.length - 1], labels = labelsOf(nb);
    if (Math.round(num(L.num_spans)) !== ns) inc('Number of spans', `num_spans = ${js(L.num_spans)} but span_lengths lists ${ns} span(s); the span lengths are used.`);
    P.spans = { lengths: spans.slice(), continuity: ns > 1 ? 'continuous' : (P.spans && P.spans.continuity) || 'simple' };
    map('Geometry', ['num_spans', 'span_lengths'], spans.map(x => f(x, 3)).join(', ') + ' ft', 'Bridge layout › Span lengths (spans.lengths)', spans.map(x => f(x, 3)).join(', ') + ' ft',
      ns > 1 ? 'Continuous girder (MIDAS models one continuous line girder; inferred).' : '');
    ign(['support_restraints'], 'Bearing fixity (pinned / roller) does not change a vertical line-girder analysis; the app takes every support as a vertical support.');
    const xs = P.xs ? clone(P.xs) : M.defaultXs(P);
    xs.nb = nb; xs.bays = new Array(nb - 1).fill(S); xs.ohL = oh >= 0 ? oh : 0; xs.ohR = xs.ohL;
    if (xs.spMode === 'equal') xs.Wcc = S * (nb - 1);
    map('Geometry', ['num_girders'], nb, 'Cross-section › Number of girders (xs.nb)', nb);
    map('Geometry', ['girder_spacing'], f(S, 4) + ' ft', 'Cross-section › Girder spacings (xs.bays)', `${nb - 1} × ${f(S, 4)} ft`);
    map('Geometry', ['deck_overhang'], f(oh, 4) + ' ft', 'Cross-section › Overhangs left / right (xs.ohL, xs.ohR)', `${f(xs.ohL, 4)} / ${f(xs.ohR, 4)} ft`, 'Both: girder ℄ to the deck edge.');
    const sk = num(L.skew_angle);
    xs.skews = new Array(ns + 1).fill(isNum(sk) ? sk : 0);
    map('Geometry', ['skew_angle'], f(sk, 3) + '°', 'Bridge layout › Support skews (xs.skews)', `${ns + 1} × ${f(sk, 3)}°`, 'One MIDAS skew for every support line.');
    const rad = num(L.horizontal_radius_ft);
    if (rad > 0) { inc('Horizontal curvature', `horizontal_radius_ft = ${f(rad, 2)} ft: the app analyses straight girders. The curvature (and curve_direction, curvature_flange_lateral_N) is not imported; the curved-girder effects are not in the app's results.`); }
    ign(['horizontal_radius_ft', 'curve_direction', 'curvature_flange_lateral_N'], rad > 0 ? 'Curved girders are not modelled by the app (straight girders only).' : 'Straight bridge (radius 0): nothing to import.');
    ign(['element_length', 'transverse_plate_size', 'transverse_orientation'], 'MIDAS model meshing (element length, transverse plate elements): the app has no finite-element mesh.');
    ign(['analysis_mode', 'lane_position_mode', 'design_lanes'], 'MIDAS analysis options; the app places lanes by AASHTO LRFD 4.6.2.2 (Loads tab).');

    // barriers and roadway
    const bw = num(L.barrier_width), wp = num(L.w_parapet), np = Math.round(num(L.n_parapets)), barOn = L.barrier_apply !== false;
    const bar = (q, w) => ({ ...(q && q.type === 'barrier' ? q : { type: 'barrier', cw: 12, ch: 10, rw: 0.05, rp: 0.5, rf: null, face: null }), type: 'barrier', bw: bw >= 0 ? bw : 0, bwt: w, face: null });
    let wL = barOn && np >= 1 ? wp : 0, wR = barOn && np >= 2 ? wp : 0;
    if (L.barrier_override_enabled === true && isNum(num(L.barrier_override_klf)))
      inc('Barrier override', `barrier_override_enabled with ${f(num(L.barrier_override_klf), 4)} klf (a bridge total, as deck_override_klf): the app computes DC2 from its barriers (w_parapet ${f(wp, 4)} klf each) and its distribution rule; the override is not imported. (This app's own export writes it when its per-girder DC2 adds up to more than the barriers, e.g. the MassDOT pile-cap rule.)`);
    xs.edges = { L: bar(xs.edges && xs.edges.L, wL), R: bar(xs.edges && xs.edges.R, wR) };
    map('Loads', ['barrier_width'], f(bw, 3) + ' ft', 'Cross-section › Deck edges, barrier width (xs.edges.L/R.bw)', `${f(bw, 3)} ft each side`, 'Barrier width = deck edge to the traffic face, both sides (MIDAS d_e = overhang − barrier width).');
    ign(['barrier_override_enabled', 'barrier_override_klf'], L.barrier_override_enabled === true ? 'Not imported (see inconsistencies).' : 'Override not enabled.');
    map('Loads', ['w_parapet', 'n_parapets', 'barrier_apply'], `${f(wp, 4)} klf × ${np}${barOn ? '' : ' (not applied)'}`, 'Cross-section › Barrier weight (xs.edges.L/R.bwt)', `${f(wL, 4)} / ${f(wR, 4)} klf`, np !== 2 ? `n_parapets = ${np}: the app has a barrier on each deck edge; ${np < 2 ? 'the missing one weighs 0' : 'the extra ones are added as a DC2 row'}.` : '');
    if (np > 2 && barOn) (xs.extra = arr(xs.extra)).push({ name: MAPPED_PREFIX + 'extra parapets', cat: 'DC2', x: 0, plf: (np - 2) * wp, dist: 'equal' });
    const Wd = S * (nb - 1) + 2 * xs.ohL, roadApp = Wd - 2 * (bw >= 0 ? bw : 0), rw = num(L.roadway_width);
    if (isNum(rw) && Math.abs(rw - roadApp) > 0.01) inc('Roadway width', `roadway_width = ${f(rw, 3)} ft, but (N_b − 1)S + 2 × overhang − 2 × barrier width = ${f(nb - 1, 0)} × ${f(S, 4)} + 2 × ${f(xs.ohL, 3)} − 2 × ${f(bw, 3)} = ${f(roadApp, 3)} ft. MIDAS uses roadway_width for the wearing surface load and its rigid-method lanes; the app uses ${f(roadApp, 3)} ft from the geometry.`);
    map('Geometry', ['roadway_width'], f(rw, 3) + ' ft', 'derived (not an input): deck width − barriers', f(roadApp, 3) + ' ft', 'Checked against the geometry (see inconsistencies).');

    // ---- deck
    const td = num(L.t_deck), tw = num(L.t_wear_integral) || 0, dh = num(L.d_haunch);
    const D0 = P.deck ? clone(P.deck) : {};
    D0.composite = true; D0.ts = td; D0.tdeck = r6(td + (tw > 0 ? tw : 0));
    map('Deck', ['t_deck', 't_wear_integral'], `${f(td, 3)} + ${f(tw, 3)} in`, 'Materials › Structural slab t_s, Total deck thickness (deck.ts, deck.tdeck)', `t_s ${f(D0.ts, 3)} in, total ${f(D0.tdeck, 3)} in`,
      `t_s = t_deck = ${f(td, 3)} in; total = t_deck + t_wear_integral = ${f(td, 3)} + ${f(tw, 3)} = ${f(D0.tdeck, 3)} in (the wearing surface is dead load only in the app).`);
    if (tw > 0) info(`Deck thickness basis: the importer reads t_deck as the structural slab and adds t_wear_integral on top (${f(td, 3)} + ${f(tw, 3)} in). MIDAS's own reports have used t_deck as the total in its deck weight and t_deck − t_wear_integral in its section properties; check which basis the MIDAS model was meant to use.`);

    // ---- girder schedules -> girder types
    const segOf = q => ({ length: num(q.length), D: num(q.web_d), tw: num(q.web_t), topB: num(q.tf_w), topT: num(q.tf_t), botB: num(q.bf_w), botT: num(q.bf_t), haunch: num(q.haunch), fyT: num(q.tf_fy), fyW: num(q.web_fy), fyB: num(q.bf_fy), label: q.label });
    const bySpanFlat = list => { const out = Array.from({ length: ns }, () => []); arr(list).forEach(q => { const m = /^S(\d+)-/.exec(String(q.label || '')), k = m ? +m[1] - 1 : 0; (out[Math.min(Math.max(k, 0), ns - 1)] || out[0]).push(q); }); return out; };
    const sameAll = L.girder_schedule_same_all !== false;
    const schedOf = lab => {
      if (sameAll) return arr(L.segments);
      const bs = L.girder_segments_by_span && L.girder_segments_by_span[lab];
      if (Array.isArray(bs) && bs.length) return bs;
      const bl = L.girder_segments_by_label && L.girder_segments_by_label[lab];
      if (Array.isArray(bl) && bl.length) return bySpanFlat(bl);
      return arr(L.segments);
    };
    if (!arr(L.segments).length && sameAll) return fail('segments is empty: no girder plates to import. Nothing was changed.');
    const allSeg = [];
    const toApp = (bySpan, lab) => {   // MIDAS segments by span -> app segments x0/x1 from the left end; identical plates across a support merged
      const out = [];
      for (let k = 0; k < ns; k++) {
        const list = arr(bySpan[k]).map(segOf), tot = list.reduce((a, q) => a + (q.length || 0), 0);
        if (!list.length) { inc('Girder schedule', `${lab}: span ${k + 1} has no segments; the segment before it is extended.`); continue; }
        if (Math.abs(tot - spans[k]) > 0.01) inc('Girder schedule', `${lab}: the segments of span ${k + 1} add up to ${f(tot, 3)} ft; the span is ${f(spans[k], 3)} ft. The last segment is adjusted to end at the support.`);
        let x = sup[k];
        list.forEach((q, i) => { allSeg.push(q); const x1 = i === list.length - 1 ? sup[k + 1] : x + q.length;
          const s = { x0: r6(x), x1: r6(x1), D: q.D, tw: q.tw, topB: q.topB, topT: q.topT, botB: q.botB, botT: q.botT }, last = out[out.length - 1];
          if (last && i === 0 && samePl(last, s)) last.x1 = s.x1; else out.push(s); x = x1; });
      }
      if (out.length) out[out.length - 1].x1 = r6(Lt);
      return out;
    };
    const sched = labels.map(lab => toApp(schedOf(lab), lab));
    if (sched.some(s => !s.length)) return fail('A girder has no plate segments. Nothing was changed.');
    if (sameAll && L.girder_segments_by_label) {
      const diff = labels.filter(lab => { const b = L.girder_segments_by_label[lab]; return Array.isArray(b) && b.length && JSON.stringify(toAppQuiet(bySpanFlat(b))) !== JSON.stringify(sched[0]); });
      if (diff.length) inc('Girder schedule', `girder_schedule_same_all is true, but girder_segments_by_label differs from segments for ${diff.join(', ')}. The common schedule (segments) is used, as MIDAS does when the schedule is the same for all girders.`);
    }
    function toAppQuiet(bySpan) { const keep = R.incons.length, keepSeg = allSeg.length; const o = toApp(bySpan, ''); R.incons.length = keep; allSeg.length = keepSeg; return o; }
    // groups: identical plates and the same position (exterior / interior) make one girder type
    const ext = j => j === 0 || j === nb - 1, groups = [];
    labels.forEach((lab, j) => { const key = JSON.stringify(sched[j]) + '|' + ext(j); let g = groups.find(q => q.key === key); if (!g) groups.push(g = { key, lines: [], ext: ext(j) }); g.lines.push(j); });
    groups.sort((a, b) => (a.ext - b.ext) || (a.lines[0] - b.lines[0]));
    const nExt = groups.filter(g => g.ext).length, nInt = groups.length - nExt;
    xs.lldf = xs.lldf || { gap: 4, kg: 'max', skewV: 'all', extMin: false };
    P.xs = xs;
    const types = groups.map((g, k) => { const j = g.lines[0];
      return { id: 'G' + (k + 1), label: g.ext ? (nExt === 1 ? 'Exterior' : `Exterior ${labels[j]}`) : (nInt === 1 ? 'Interior' : `Interior ${labels[j]}`), position: g.ext ? 'exterior' : 'interior',
        line: j, lines: g.lines.slice(), beff: M.tribBeff(xs, j), segments: clone(sched[j]) }; });
    P.girders = types;
    map('Girders', ['segments', 'girder_schedule_same_all', 'girder_segments_by_label', 'girder_segments_by_span'], sameAll ? 'one schedule for all girders' : 'a schedule per girder',
      'Girders & plates › girder types (girders[i].segments, lines)', types.map(t => `${t.label}: ${t.lines.map(j => labels[j]).join(', ')} (${t.segments.length} segment${t.segments.length > 1 ? 's' : ''})`).join('; '),
      'web_d → D, web_t → t_w, tf_w/tf_t → top flange b × t, bf_w/bf_t → bottom flange b × t; lengths per span → stations x0/x1 from the left end. Girders with the same plates and position share one girder type; b_eff = the tributary width (Art. 4.6.2.6.1).');
    ign(['girder_segments_by_span_stash'], 'MIDAS keeps the plates of spans removed earlier here (not part of the model).');
    // steel grades
    const fyList = k => allSeg.map(q => q[k]).filter(isNum), most = a => { const c = {}; a.forEach(v => { c[v] = (c[v] || 0) + 1; }); let b = null; Object.keys(c).forEach(v => { if (b == null || c[v] > c[b]) b = v; }); return b == null ? NaN : +b; };
    const fyS = num(L.Fy_steel), fyT = most(fyList('fyT')), fyW = most(fyList('fyW')), fyB = most(fyList('fyB'));
    P.materials = P.materials ? clone(P.materials) : clone(M.defaultProject().materials);
    P.materials.steel = { top: gradeOf(isNum(fyT) ? fyT : fyS), web: gradeOf(isNum(fyW) ? fyW : fyS), bot: gradeOf(isNum(fyB) ? fyB : fyS) };
    ['fyT', 'fyW', 'fyB'].forEach(k => { const v = [...new Set(fyList(k))]; if (v.length > 1) inc('Steel grade', `${{ fyT: 'Top flange', fyW: 'Web', fyB: 'Bottom flange' }[k]} F_y varies along the girder (${v.join(', ')} ksi); the app has one grade per plate kind: ${most(fyList(k))} ksi used.`); });
    if (isNum(fyS) && [fyT, fyW, fyB].some(v => isNum(v) && v !== fyS)) inc('Steel grade', `Fy_steel = ${f(fyS, 1)} ksi, but the segments give F_y ${f(fyT, 1)} / ${f(fyW, 1)} / ${f(fyB, 1)} ksi (top / web / bottom); the segments' values are used.`);
    map('Materials', ['Fy_steel', 'segments[].tf_fy, web_fy, bf_fy'], `${f(fyT, 1)} / ${f(fyW, 1)} / ${f(fyB, 1)} ksi`, 'Materials › Steel grades (materials.steel.top/web/bot)', `${P.materials.steel.top} / ${P.materials.steel.web} / ${P.materials.steel.bot}`, 'F_y 50 → grade 50 (F_u 65 ksi), 36 → 36, 70 → HPS70W. A weathering grade (50W) is not in the file: choose it on the Materials tab if it applies.');
    // haunch: top of web -> top of steel
    const tfMax = Math.max(...P.girders.flatMap(g => g.segments.map(s => s.topT))), tfMin = Math.min(...P.girders.flatMap(g => g.segments.map(s => s.topT)));
    D0.haunch = r6(Math.max(0, (isNum(dh) ? dh : 0) - tfMax));
    map('Deck', ['d_haunch'], f(dh, 3) + ' in (top of web to deck soffit)', 'Materials › Haunch (deck.haunch, top of steel to deck soffit)', f(D0.haunch, 3) + ' in',
      `haunch = d_haunch − t_f,top = ${f(dh, 3)} − ${f(tfMax, 3)} = ${f(D0.haunch, 3)} in${tfMax !== tfMin ? ` (the thickest top flange; with the thinnest, ${f(tfMin, 3)} in, the clear haunch is ${f(dh - tfMin, 3)} in there)` : ''}.`);
    if (isNum(dh) && dh - tfMax < 0) inc('Haunch', `d_haunch ${f(dh, 3)} in is less than the top flange thickness ${f(tfMax, 3)} in; the haunch is taken as 0.`);
    const segH = [...new Set(allSeg.map(q => q.haunch).filter(isNum))];
    if (segH.some(h => Math.abs(h - dh) > 1e-6)) inc('Haunch', `The segments' haunch (${segH.map(h => f(h, 3)).join(', ')} in) differs from d_haunch (${f(dh, 3)} in). Both are measured from the top of the web; d_haunch is used. MIDAS has used the segment value in its section properties and d_haunch in K_g: check which is meant.`);
    seen.add('haunch_width'); R.ignored.push({ lga: 'haunch_width', value: js(L.haunch_width), why: 'The app takes the haunch weight over the top flange width (as MIDAS\'s own haunch load); the haunch width is not used.' });

    // ---- deck rebar
    const jDes = nb >= 3 ? 1 : 0, beffI = M.tribBeff(xs, jDes), beffE = M.tribBeff(xs, 0);
    const zonesAll = L.girder_rebar_zones_by_label || {}, zl = arr(zonesAll[labels[jDes]]);
    const zone = zl.length ? zl.slice().sort((a, b) => (num(b.end_ft) - num(b.start_ft)) - (num(a.end_ft) - num(a.start_ft)))[0] : null;
    const layer = (k) => {   // k 'top' | 'bot' -> { bar, Ab, db, s, cover, src }
      if (zone && BARS[zone[k + '_bar_size']]) { const b = zone[k + '_bar_size']; return { bar: b, Ab: BARS[b][0], db: BARS[b][1], s: num(zone[k + '_spacing']), cover: num(zone[k + '_cover']), src: 'zone' }; }
      const Ab = num(L[k + '_rebar_area']), b = barOfArea(Ab); return { bar: b, Ab, db: BARS[b][1], s: num(L[k + '_rebar_spacing']), cover: num(L[k + '_rebar_cover']), src: 'project' };
    };
    const rb = D0.rebar ? clone(D0.rebar) : { top: {}, bot: {} };
    ['top', 'bot'].forEach(k => { const q = layer(k);
      if (!(q.s > 0 && q.Ab > 0)) { inc('Deck rebar', `${k === 'top' ? 'Top' : 'Bottom'} layer: no valid bar area and spacing; the open project's value is kept.`); return; }
      const nBar = Math.floor(beffI / q.s + 1e-9), A = r6(nBar * q.Ab), c = r6(q.cover + q.db / 2);
      rb[k] = { A, c };
      map('Deck', [k + '_rebar_area', k + '_rebar_spacing', k + '_rebar_cover', 'girder_rebar_zones_by_label'], `${q.bar} (${f(q.Ab, 2)} in²) @ ${f(q.s, 3)} in, cover ${f(q.cover, 3)} in${q.src === 'zone' ? ' (rebar zone)' : ''}`,
        `Materials › ${k === 'top' ? 'Top' : 'Bottom'} layer A_r and centroid (deck.rebar.${k})`, `A ${f(A, 3)} in², centroid ${f(c, 4)} in ${k === 'top' ? 'below the top' : 'above the bottom'} of the slab`,
        `A_r = floor(b_eff / s) A_b = floor(${f(beffI, 3)} / ${f(q.s, 3)}) × ${f(q.Ab, 2)} = ${nBar} × ${f(q.Ab, 2)} = ${f(A, 3)} in² (b_eff of ${labels[jDes]}; whole bars); centroid = cover + d_b/2 = ${f(q.cover, 3)} + ${f(q.db, 3)}/2 = ${f(c, 4)} in.`);
      if (beffE !== beffI && nb >= 3) info(`Deck rebar is one value for every girder in the app (per girder, within b_eff, ${labels[jDes]}'s ${f(beffI, 2)} in). For the exterior girders (b_eff ${f(beffE, 2)} in) the same bars give ${f(Math.floor(beffE / q.s + 1e-9) * q.Ab, 3)} in² (${k} layer).`);
      if (zone) { const pa = num(L[k + '_rebar_area']), ps = num(L[k + '_rebar_spacing']), pc = num(L[k + '_rebar_cover']);
        if ((isNum(pa) && Math.abs(pa - q.Ab) > 1e-6) || (isNum(ps) && Math.abs(ps - q.s) > 1e-6) || (isNum(pc) && Math.abs(pc - q.cover) > 1e-6))
          inc('Deck rebar', `${k === 'top' ? 'Top' : 'Bottom'} layer: the project fields say ${f(pa, 2)} in² @ ${f(ps, 3)} in, cover ${f(pc, 3)} in, but the rebar zone says ${q.bar} (${f(q.Ab, 2)} in²) @ ${f(q.s, 3)} in, cover ${f(q.cover, 3)} in. The zone is used (MIDAS reports the zone bars).`); }
    });
    D0.rebar = rb;
    const zKey = z => JSON.stringify(arr(z).map(q => [q.top_bar_size, q.top_spacing, q.top_cover, q.bot_bar_size, q.bot_spacing, q.bot_cover]));
    if (zl.length > 1) inc('Deck rebar', `${labels[jDes]} has ${zl.length} rebar zones along the girder; the app has one deck reinforcement for the whole length: the longest zone (${f(num(zone.start_ft), 2)}–${f(num(zone.end_ft), 2)} ft) is used.`);
    if (labels.some(lab => zonesAll[lab] && zKey(zonesAll[lab]) !== zKey(zl))) inc('Deck rebar', 'The rebar zones differ between girders; the app has one deck reinforcement: the zones of ' + labels[jDes] + ' are used.');
    ign(['girder_rebar_runs_by_label'], 'The same bars as girder_rebar_zones_by_label, as run lengths.');
    P.deck = D0;
    const fyr = zone && isNum(num(zone.fy)) ? num(zone.fy) : num(L.fy_rebar);
    P.materials.rebar = { ...(P.materials.rebar || {}), Fyr: fyr };
    map('Materials', ['fy_rebar'], f(fyr, 1) + ' ksi', 'Materials › Rebar F_yr (materials.rebar.Fyr)', f(fyr, 1) + ' ksi');

    // ---- concrete, E and n
    const fc = num(L.fc_concrete), wc = num(L.wc_concrete), C = P.materials.concrete = { ...(P.materials.concrete || {}), fc, wc };
    if (!(C.K1 > 0)) C.K1 = 1.0; C.nRule = C.nRule || 'exact';
    map('Materials', ['fc_concrete', 'wc_concrete'], `${f(fc, 3)} ksi, ${f(wc, 4)} kcf`, 'Materials › f′c, w_c (materials.concrete)', `${f(fc, 3)} ksi, ${f(wc, 4)} kcf`);
    const ovr = L.use_material_overrides === true, EcOf = w => 120000 * C.K1 * w * w * Math.pow(fc, 0.33), wcEof = Ec => Math.sqrt(Ec / (120000 * C.K1 * Math.pow(fc, 0.33)));
    delete C.wcE;
    if (ovr && L.es_override_enabled === true && num(L.Es_override) > 0) { P.materials.Es = num(L.Es_override); map('Materials', ['Es_override', 'es_override_enabled'], f(P.materials.Es, 0) + ' ksi', 'Materials › E_s (materials.Es)', f(P.materials.Es, 0) + ' ksi', 'The app\'s modular ratio uses E_s = 29,000 ksi (Art. 6.4.1).'); }
    if (ovr && L.n_override_enabled === true && num(L.n_override) > 0) {
      const n = num(L.n_override), Ec = 29000 / n, w = wcEof(Ec); C.wcE = w; C.nRule = 'exact';
      map('Materials', ['n_override', 'n_override_enabled', 'use_material_overrides'], 'n = ' + f(n, 4), 'Loads › w_c for E_c (materials.concrete.wcE)', f(C.wcE, 6) + ' kcf',
        `E_c = 29,000 / n = 29,000 / ${f(n, 4)} = ${f(Ec, 1)} ksi; w_cE = √(E_c / (120,000 K_1 f′c^0.33)) = √(${f(Ec, 1)} / (120,000 × ${f(C.K1, 2)} × ${f(fc, 3)}^0.33)) = ${f(C.wcE, 6)} kcf, so the app's n = ${f(n, 4)} (Eq. 5.4.2.4-1).`);
      if (L.ec_override_enabled === true) inc('Modular ratio', 'Both Ec_override and n_override are enabled; n_override is used.');
    } else if (ovr && L.ec_override_enabled === true && num(L.Ec_override) > 0) {
      const Ec = num(L.Ec_override); C.wcE = wcEof(Ec);
      map('Materials', ['Ec_override', 'ec_override_enabled', 'use_material_overrides'], f(Ec, 1) + ' ksi', 'Loads › w_c for E_c (materials.concrete.wcE)', f(C.wcE, 6) + ' kcf',
        `w_cE = √(E_c / (120,000 K_1 f′c^0.33)) = √(${f(Ec, 1)} / (120,000 × ${f(C.K1, 2)} × ${f(fc, 3)}^0.33)) = ${f(C.wcE, 6)} kcf (Eq. 5.4.2.4-1 solved for w_c), n = 29,000 / ${f(Ec, 1)} = ${f(29000 / Ec, 4)}.`);
    } else {
      const nApp = 29000 / EcOf(wc);
      info(`Modular ratio: no override is enabled, so MIDAS computes its own n; the app computes n = 29,000 / E_c = ${f(nApp, 3)} (E_c by AASHTO LRFD 10th Ed. Eq. 5.4.2.4-1, n not rounded). Check the n in MIDAS's report; the two programs may differ.`);
      ign(['Es_override', 'Ec_override', 'n_override'], 'Override values not enabled (kept in the file copy only).');
    }
    ['use_material_overrides', 'es_override_enabled', 'ec_override_enabled', 'n_override_enabled', 'Es_override', 'Ec_override', 'n_override'].forEach(k => { if (!seen.has(k)) { seen.add(k); R.ignored.push({ lga: k, value: js(L[k]), why: 'Not enabled (or not used): kept in the file copy only.' }); } });

    // ---- dead loads
    xs.extra = arr(xs.extra).filter(r => !String(r.name || '').startsWith(MAPPED_PREFIX) || r.name === MAPPED_PREFIX + 'extra parapets');
    const xc = Wd / 2, row = (name, cat, plf) => xs.extra.push({ name: MAPPED_PREFIX + name, cat, x: r4(xc), plf: r6(plf), dist: 'equal' });
    const fws = num(L.w_fws_ksf), fwsOn = L.fws_apply !== false;
    xs.ws = { ...(xs.ws || {}), mode: 'psf', psf: fwsOn ? r6(fws * 1000) : 0, thk: null, gam: null };
    if (L.fws_override_enabled === true && isNum(num(L.fws_override_klf)))
      inc('Wearing surface override', `fws_override_enabled with ${f(num(L.fws_override_klf), 4)} klf (a bridge total): the app computes the wearing surface from w_fws_ksf over its roadway; the override is not imported.`);
    ign(['fws_override_enabled', 'fws_override_klf'], L.fws_override_enabled === true ? 'Not imported (see inconsistencies).' : 'Override not enabled.');
    map('Loads', ['w_fws_ksf', 'fws_apply'], `${f(fws, 4)} ksf${fwsOn ? '' : ' (not applied)'}`, 'Loads › Future wearing surface (xs.ws.psf)', f(xs.ws.psf, 3) + ' psf',
      `psf = 1000 × ksf. MIDAS applies it over roadway_width (${f(rw, 3)} ft: ${f(fws * rw, 4)} klf); the app between the traffic faces (${f(roadApp, 3)} ft: ${f(xs.ws.psf * roadApp / 1000, 4)} klf).`);
    const sip = num(L.w_deckforms); xs.sip = r6((sip || 0) * 1000);
    map('Loads', ['w_deckforms'], f(sip, 4) + ' ksf', 'Loads › SIP forms (xs.sip)', f(xs.sip, 3) + ' psf', 'psf = 1000 × ksf; both on the clear width between the top flanges.');
    const wcf = num(L.w_crossframes), wm = num(L.w_misc), wu = num(L.w_utilities);
    if (wcf > 0) row('w_crossframes (bridge total)', 'DC1', wcf);
    if (wm > 0) row('w_misc (per girder × N_b)', 'DC1', wm * nb);
    if (wu > 0) row('w_utilities (per girder × N_b)', 'DW', wu * nb);
    P.crossframes = P.crossframes ? clone(P.crossframes) : M.defaultCrossframes();
    P.crossframes.weight = { ...(P.crossframes.weight || {}), mode: 'off' };
    map('Loads', ['w_crossframes'], f(wcf, 4) + ' klf (bridge total)', 'Loads › Added loads (xs.extra), DC1, shared equally', f(wcf, 4) + ' klf',
      'The app\'s own cross-frame weight (point loads from the member sizes, Framing & bracing) is turned off (crossframes.weight.mode = off) so that the cross-frame dead load is MIDAS\'s.');
    map('Loads', ['w_misc'], f(wm, 4) + ' klf per girder', 'Loads › Added loads (xs.extra), DC1, shared equally', `${f(wm, 4)} × ${nb} = ${f(wm * nb, 4)} klf`, 'Per girder × N_b = bridge total, shared equally.');
    map('Loads', ['w_utilities'], f(wu, 4) + ' klf per girder', 'Loads › Added loads (xs.extra), DW, shared equally', `${f(wu, 4)} × ${nb} = ${f(wu * nb, 4)} klf`, 'MIDAS puts utilities in DW (composite section); so does the import.');
    xs.allow = 0;
    map('Loads', ['girder_self_weight_apply'], L.girder_self_weight_apply === false ? 'not applied' : 'applied', 'Loads › Steel detail allowance (xs.allow)', '0 %', 'MIDAS takes the steel weight as area × 490 pcf with no detail allowance.');
    [['girder_self_weight', 'Girder self-weight'], ['deck', 'Deck weight'], ['haunch', 'Haunch weight']].forEach(([k, t]) => {
      if (L[k + '_apply'] === false) inc(t, `${k}_apply is false in MIDAS: the app always includes the ${t.toLowerCase()} (it cannot be switched off).`);
      if (L[k + '_override_enabled'] === true) inc(t, `${k}_override_enabled with ${f(num(L[k + '_override_klf']), 4)} klf: the app computes the ${t.toLowerCase()} from the geometry and cannot take an override; not imported.`);
      ign([k + '_override_enabled', k + '_override_klf'], L[k + '_override_enabled'] === true ? 'Override not representable (see inconsistencies).' : 'Override not enabled (value kept in the file copy only).');
      if (k !== 'girder_self_weight') ign([k + '_apply'], L[k + '_apply'] === false ? 'Not representable (see inconsistencies).' : 'Applied in MIDAS; the app always includes it.');
    });
    const modes = ['dc1', 'dc2', 'dw'].map(k => String(L[k + '_dist_mode'] || ''));
    xs.dlMethod = 'aashto';
    map('Loads', ['dc2_dist_mode', 'dw_dist_mode'], `${modes[1] || '—'} / ${modes[2] || '—'}`, 'Loads › Dead load distribution (xs.dlMethod)', 'aashto (DC2 and DW shared equally)', 'The app\'s DC1 deck, haunch and SIP forms are always by tributary width; the DC1 rows (cross-frames, misc.) are shared equally.');
    seen.add('dc1_dist_mode'); ['dc1_dist_pct', 'dc2_dist_pct', 'dw_dist_pct'].forEach(k => seen.add(k));
    modes.forEach((m, i) => { const k = ['dc1', 'dc2', 'dw'][i];
      if (i > 0 && m && !/^equal$/i.test(m)) inc(`${k.toUpperCase()} distribution`, `${k}_dist_mode = "${m}" (${js(L[k + '_dist_pct'])}): the app shares ${k.toUpperCase()} equally (AASHTO 4.6.2.2.1); the custom shares are not representable.`);
      if (i === 0 && /^equal$/i.test(m)) inc('DC1 distribution', 'dc1_dist_mode = "Equal": MIDAS shares the whole DC1 (deck included) equally; the app takes the deck, haunch and SIP forms by tributary width.'); });

    // ---- live load, fatigue
    const ML = arr(L.moving_load_entries), hl = ML.filter(e => /^HL-?93/i.test(String(e.vehicle_name || e.vehicle_type_name || '')) && !/fatigue/i.test(String(e.classification || ''))),
      ft = ML.filter(e => /fatigue/i.test(String(e.classification || '')) || /FTG/i.test(String(e.vehicle_name || '')));
    const imV = [...new Set(hl.map(e => num(e.dyn_load_allowance)).filter(isNum))], imfV = [...new Set(ft.map(e => num(e.dyn_load_allowance)).filter(isNum))];
    P.analysis = { ...(P.analysis || {}) };
    if (imV.length) { P.analysis.im = Math.max(...imV); if (imV.length > 1) inc('Dynamic load allowance', `The HL-93 entries have different IM (${imV.join(', ')} %); the largest is used.`); }
    if (imfV.length) { P.analysis.imf = Math.max(...imfV); if (imfV.length > 1) inc('Dynamic load allowance', `The fatigue entries have different IM (${imfV.join(', ')} %); the largest is used.`); }
    if (isNum(P.analysis.im) && P.analysis.im !== 33) inc('Dynamic load allowance', `HL-93 IM = ${P.analysis.im} % (AASHTO LRFD Table 3.6.2.1-1: 33 % for all other limit states).`);
    if (isNum(P.analysis.imf) && P.analysis.imf !== 15) inc('Dynamic load allowance', `Fatigue IM = ${P.analysis.imf} % (AASHTO LRFD Table 3.6.2.1-1: 15 % for the fatigue limit states).`);
    map('Live load', ['moving_load_entries'], `HL-93 IM ${imV.join('/') || '—'} %, fatigue IM ${imfV.join('/') || '—'} %`, 'Loads › Analysis settings, IM and fatigue IM (analysis.im, analysis.imf)', `${P.analysis.im} % / ${P.analysis.imf} %`, 'The app\'s live load is HL-93 (design truck, tandem, lane) and the fatigue truck.');
    ML.filter(e => !hl.includes(e) && !ft.includes(e)).forEach(e => R.ignored.push({ lga: 'moving_load_entries', value: js(e.vehicle_name), why: 'Not an HL-93 or fatigue entry: the app designs for HL-93 (rating vehicles: Rating tab).' }));
    ign(['moving_load_available_entries', 'moving_load_custom_lists', 'moving_load_active_list_label'], 'MIDAS vehicle catalog lists (the app has its own vehicles).');
    const roadL = roadApp, NL = lanesOf(roadL), p = pOf(NL), adtt = num(L.ADTT_SL);
    P.fatigue = P.fatigue ? clone(P.fatigue) : M.defaultFatigue();
    if (adtt > 0) { P.fatigue.p = p; P.fatigue.ADTT = r4(adtt / p);
      map('Fatigue', ['ADTT_SL'], f(adtt, 0), 'Fatigue & studs › ADTT (one direction) and p (fatigue.ADTT, fatigue.p)', `ADTT ${f(P.fatigue.ADTT, 2)}, p ${p}`,
        `ADTT_SL = p × ADTT (Eq. 3.6.1.4.2-1): ADTT = ${f(adtt, 0)} / ${p} = ${f(P.fatigue.ADTT, 2)}; p = ${p} for ${NL} lane${NL > 1 ? 's' : ''} available to trucks (Table 3.6.1.4.2-1, roadway ${f(roadL, 2)} ft).`); }
    const cat = String(L.fatigue_detail_category || '').replace(/[’`]/g, "'").trim();
    if (CATS.includes(cat)) { P.fatigue.catT = cat; P.fatigue.catB = cat; map('Fatigue', ['fatigue_detail_category'], cat, 'Fatigue & studs › Detail category, top and bottom flange (fatigue.catT, catB)', cat); }
    else inc('Fatigue', `fatigue_detail_category "${cat}" is not one of ${CATS.join(', ')}; not imported.`);
    // load combinations
    const LC = arr(L.load_combinations), lc = n => LC.find(c => String(c.name || '').toLowerCase() === n);
    const f1 = lc('fatigue i'), f2 = lc('fatigue ii');
    P.fatigue.gam = { ...(P.fatigue.gam || {}) };
    if (f1 && num(f1.ll) > 0) P.fatigue.gam.fI = num(f1.ll);
    if (f2 && num(f2.ll) > 0) P.fatigue.gam.fII = num(f2.ll);
    map('Fatigue', ['load_combinations (Fatigue I, II)'], `${f1 ? f1.ll : '—'} / ${f2 ? f2.ll : '—'}`, 'Fatigue & studs › γ Fatigue I, II (fatigue.gam.fI, fII)', `${P.fatigue.gam.fI} / ${P.fatigue.gam.fII}`);
    seen.add('load_combinations');
    const want = { 'strength i': { dc: 1.25, dw: 1.5, ll: 1.75 }, 'service ii': { dc: 1.0, dw: 1.0, ll: 1.3 } };
    Object.keys(want).forEach(n => { const c = lc(n), w = want[n]; if (!c) { inc('Load combinations', `"${n}" is not in the file.`); return; }
      const d = ['dc', 'dw', 'll'].filter(k => isNum(num(c[k])) && Math.abs(num(c[k]) - w[k]) > 1e-9);
      if (d.length) inc('Load combinations', `${c.name}: ${d.map(k => `${k.toUpperCase()} ${c[k]}`).join(', ')}; the app uses ${d.map(k => `${k.toUpperCase()} ${w[k]}`).join(', ')} (AASHTO LRFD Table 3.4.1-1, times the owner's η and LL multiplier). Not imported.`);
      if (c.active === false) inc('Load combinations', `${c.name} is inactive in MIDAS; the app always checks it.`); });
    LC.filter(c => !['strength i', 'service ii', 'fatigue i', 'fatigue ii'].includes(String(c.name || '').toLowerCase())).forEach(c => R.ignored.push({ lga: 'load_combinations', value: `${c.name} (DC ${c.dc}, DW ${c.dw}, LL ${c.ll}${c.active === false ? ', inactive' : ''})`, why: 'Not used by the app\'s girder checks (it checks Strength I, Service II, Fatigue I / II and constructibility).' }));
    ign(['design_phi_y', 'design_phi_u', 'design_phi_c', 'design_phi_f', 'design_phi_v', 'design_phi_sc', 'design_phi_b'], 'The app uses its own resistance factors (AASHTO LRFD 10th Ed. Art. 6.5.4.2).');
    ign(['design_use_appendix_a6'], 'The app applies Appendix A6 where Art. 6.10.6.2.3 permits it (Flexure tab).');
    ign(['code_edition'], 'The app designs to AASHTO LRFD 10th Ed. (2024).');

    // ---- LLDF
    const mode = String(L.lldf_mode || 'auto').toLowerCase();
    const U = k => num(L['lldf_user_' + k]);
    if (mode === 'user') {
      const set = (t, side) => { const M1 = U(side + '_M_1L'), M2 = U(side + '_M_2L'), V1 = U(side + '_V_1L'), V2 = U(side + '_V_2L');
        if (![M1, M2, V1, V2].every(v => v > 0)) { inc('LLDF', `lldf_mode "user" but the ${side === 'int' ? 'interior' : 'exterior'} values are not all positive (${[M1, M2, V1, V2].map(v => f(v, 4)).join(', ')}): the app computes its own factors for ${t.label}.`); return null; }
        const q = { gM: r6(Math.max(M1, M2)), gV: r6(Math.max(V1, V2)), fatM: r6(M1 / 1.2), fatV: r6(V1 / 1.2) };
        t.dfPull = { use: true, spans: Array.from({ length: ns }, () => ({ ...q })), piers: Array.from({ length: Math.max(0, ns - 1) }, () => ({ gM: q.gM })),
          source: { producer: 'MIDAS Line Girder Analysis (.lga), user-defined LLDF', producerFile: opt.fileName || 'file.lga', producedAt: String(obj.saved || ''), project: String(L.project_name || ''),
            adoptedAt: opt.now || new Date().toISOString(), line: t.line, girder: labels[t.line], basis: 'lga-user', basisLbl: 'g = max(1 lane, 2+ lanes); fatigue = 1 lane / 1.2', fields: ['gM', 'gV', 'fatM', 'fatV'] } };
        return q; };
      P.girders.forEach(t => { const side = t.position === 'exterior' ? 'ext' : 'int', q = set(t, side);
        if (q) map('LLDF', ['lldf_mode', `lldf_user_${side}_M_1L`, `lldf_user_${side}_M_2L`, `lldf_user_${side}_V_1L`, `lldf_user_${side}_V_2L`],
          `M ${f(U(side + '_M_1L'))} / ${f(U(side + '_M_2L'))}, V ${f(U(side + '_V_1L'))} / ${f(U(side + '_V_2L'))} (1 lane / 2+ lanes)`, `Loads › ${t.label}: distribution factors pulled (girders[i].dfPull)`,
          `g_M ${f(q.gM)}, g_V ${f(q.gV)}, fatigue g_M ${f(q.fatM)}, g_V ${f(q.fatV)} (every span${ns > 1 ? ' and pier' : ''})`,
          `g = max(1 lane, 2+ lanes); fatigue = 1 lane / 1.2 (the multiple presence factor 1.2 removed, C3.6.1.1.2): ${f(U(side + '_M_1L'))} / 1.2 = ${f(q.fatM)}, ${f(U(side + '_V_1L'))} / 1.2 = ${f(q.fatV)}. The deflection factor stays the app's.`); });
      ['int', 'ext'].forEach(s => ['M_1L', 'M_2L', 'V_1L', 'V_2L'].forEach(k => seen.add(`lldf_user_${s}_${k}`)));
      if (L.apply_moment_skew_factor === true || L.apply_shear_skew_factor === true) info('User LLDF with apply_moment_skew_factor / apply_shear_skew_factor on: the app uses the user factors as written (no skew correction added). If MIDAS multiplies user factors by its skew corrections, the factors differ by those corrections.');
      ign(['apply_moment_skew_factor', 'apply_shear_skew_factor'], 'With user factors the app applies no skew correction of its own (see info).');
    } else {
      map('LLDF', ['lldf_mode'], '"auto"', 'Loads › distribution factors (the app\'s own, AASHTO LRFD 4.6.2.2)', 'computed by the app', 'MIDAS computes its own factors; compare them with the app\'s Loads tab.');
      ['int', 'ext'].forEach(s => ['M_1L', 'M_2L', 'V_1L', 'V_2L'].forEach(k => ign([`lldf_user_${s}_${k}`], 'User factors not used (lldf_mode auto).')));
      if (L.apply_moment_skew_factor === false) inc('LLDF', 'apply_moment_skew_factor is false: the app always applies the moment skew reduction of Table 4.6.2.2.2e-1 where it applies.');
      if (L.apply_shear_skew_factor === false) inc('LLDF', 'apply_shear_skew_factor is false: the app always applies the shear skew correction of Table 4.6.2.2.3c-1 (all girders or exterior only, Loads tab).');
      seen.add('apply_moment_skew_factor'); seen.add('apply_shear_skew_factor');
    }

    // ---- framing, cross-frames
    P.framing = P.framing ? clone(P.framing) : M.defaultFraming();
    const cfs = num(L.cross_frame_spacing), cfBy = arr(L.cross_frame_spacing_by_span).map(num).filter(v => v > 0);
    const near = (a, b) => Math.abs(a - b) < 0.05, notSup = x => !sup.some(s => near(s, x));
    const cfAt = [...new Set(arr(L.cross_frame_locations).map(num).filter(x => isNum(x) && x > 0 && x < Lt && notSup(x)).map(x => r6(x)))].sort((a, b) => a - b);
    const spacing = cfs > 0 ? cfs : cfBy.length ? Math.max(...cfBy) : P.framing.spacing;
    P.framing.spacing = spacing;
    if (cfBy.length > 1 && new Set(cfBy).size > 1) inc('Cross-frames', `cross_frame_spacing_by_span differs by span (${cfBy.join(', ')} ft); the app's framing has one target spacing (${f(spacing, 3)} ft, cross_frame_spacing); the stations themselves are checked below.`);
    P.stiffeners = P.stiffeners ? clone(P.stiffeners) : M.defaultStiffeners();
    P.stiffeners.layout = { ...(P.stiffeners.layout || {}), frames: { Lb: spacing, at: cfAt.slice() } };
    // field splices
    const spl = [...new Set(arr(L.field_splice_locations).map(num).filter(x => x > 0 && x < Lt))].sort((a, b) => a - b);
    P.framing.splices = spl;
    map('Splices', ['field_splice_locations'], spl.length ? spl.map(x => f(x, 3)).join(', ') + ' ft' : 'none', 'Framing & bracing › Field splices (framing.splices)', spl.length ? spl.map(x => f(x, 3)).join(', ') + ' ft' : 'none', 'Stations from the left end.');
    const splBy = L.girder_field_splice_locations_by_label || {};
    if (labels.some(lab => Array.isArray(splBy[lab]) && JSON.stringify(splBy[lab].map(num).filter(x => x > 0 && x < Lt).sort((a, b) => a - b)) !== JSON.stringify(spl))) inc('Field splices', 'girder_field_splice_locations_by_label differs between girders or from field_splice_locations; the app has one set of field splices: field_splice_locations is used.');
    ign(['girder_field_splice_locations_by_label', 'girder_field_splice_text_by_label', 'field_splice_text'], 'The same splice stations per girder / as text.');
    const FRM = W.SBDFraming, cfBy2 = L.girder_cross_frame_locations_by_label || {};
    const wantLine = j => { const v = Array.isArray(cfBy2[labels[j]]) ? cfBy2[labels[j]].map(num).filter(x => x > 0 && x < Lt && notSup(x)) : cfAt; return v.sort((a, b) => a - b); };
    const appInts = (Q, j) => { try { const b = FRM.forGirder(Q, { line: j }, sup); return b ? b.ints : null; } catch (e) { return null; } };
    const match = (a, b) => a && b && a.length === b.length && a.every((x, i) => Math.abs(x - b[i]) < 0.06);
    let orient = 'parallel', framingOk = null;
    if (FRM) {
      for (const o of ['parallel', 'normal', 'auto']) { const Q = { ...P, framing: { ...P.framing, orient: o } };
        if (labels.every((_, j) => match(appInts(Q, j), wantLine(j)))) { orient = o; framingOk = true; break; } }
      if (framingOk == null) framingOk = false;
    }
    P.framing.orient = orient;
    map('Cross-frames', ['cross_frame_spacing', 'cross_frame_spacing_by_span', 'cross_frame_locations', 'girder_cross_frame_locations_by_label'],
      `${f(spacing, 3)} ft; at ${cfAt.map(x => f(x, 2)).join(', ') || 'none'} ft`, 'Framing & bracing › Spacing, orientation (framing.spacing, orient); Stiffeners › cross-frame stations (stiffeners.layout.frames.at)',
      `${f(spacing, 3)} ft, ${orient}; stations ${cfAt.map(x => f(x, 2)).join(', ') || 'none'} ft`, framingOk ? `The app's framing (orientation ${orient}) gives the same stations on every girder as the file.` : 'See inconsistencies for the stations the app\'s framing gives.');
    if (framingOk === false) { const Q = P, d = labels.map((lab, j) => ({ lab, a: appInts(Q, j), w: wantLine(j) })).filter(q => !match(q.a, q.w));
      inc('Cross-frames', `The app's framing (spacing ${f(spacing, 3)} ft, ${orient}) does not reproduce the file's cross-frame stations on ${d.map(q => q.lab).join(', ')}: e.g. ${d[0].lab}: file ${d[0].w.map(x => f(x, 2)).join(', ')} ft, app ${(d[0].a || []).map(x => f(x, 2)).join(', ')} ft. Adjust the framing inputs (Framing & bracing tab).`); }
    const ba = L.bracing_assignment || {}, rows = arr(ba.rows);
    if (rows.length) info(`MIDAS bracing angles: intermediate ${[...new Set(rows.map(r => r.angle_type))].join(', ')}, at supports ${[...new Set(arr(ba.support_rows).map(r => r.angle_type))].join(', ') || '—'}. The app's framing orientation is set to "${orient}" so that its stations match the file's.`);
    ign(['girder_cross_frame_schedule_by_label', 'bracing_assignment', 'bracing_user_sections', 'bracing_section_set'], 'MIDAS bracing assignment (the stations are imported from cross_frame_locations).');
    const bd = arr(L.bracing_details)[0], AN = W.SBDCrossframes && W.SBDCrossframes.ANGLES;
    if (bd) {
      const sec = n => { const a = AN && AN[n]; return a ? { sec: n, b1: a[0], b2: a[1], t: a[2] } : null; }, mem = P.crossframes.mem = { ...(P.crossframes.mem || {}) }, got = [];
      [['top', bd.top_chord !== false && bd.top_section], ['bot', bd.bottom_chord !== false && bd.bottom_section], ['diag', bd.brace !== false && bd.brace_section]].forEach(([k, n]) => { if (!n) return; const s = sec(n); if (s) { mem[k] = s; got.push(`${k} ${n}`); } else inc('Cross-frame members', `${k === 'diag' ? 'brace' : k} section "${n}" is not in the app's angle list; not imported.`); });
      if (/x/i.test(String(bd.brace_arrangement || ''))) P.crossframes.type = 'X'; else if (bd.brace_arrangement) inc('Cross-frame members', `brace_arrangement "${bd.brace_arrangement}": only X bracing is mapped; choose the type on the Framing & bracing tab.`);
      map('Cross-frames', ['bracing_details'], `${bd.brace_arrangement || '—'}: ${[bd.top_section, bd.brace_section, bd.bottom_section].filter(Boolean).join(', ')}`, 'Framing & bracing › Cross-frame type and members (crossframes.type, mem)', `${P.crossframes.type}; ${got.join(', ') || 'none'}`);
      if (arr(L.bracing_details).length > 1) inc('Cross-frame members', `${L.bracing_details.length} bracing definitions; the app has one cross-frame for the bridge: the first ("${bd.name}") is used.`);
    } else seen.add('bracing_details');

    // ---- stiffeners
    const SZ = L.girder_transverse_stiffener_zones_by_label || {}, SB = W.SBDStiffeners;
    const stOf = lab => arr(SZ[lab]);
    const allSt = labels.flatMap(stOf), flats = allSt.filter(z => /flat/i.test(String(z.stiffener_type || 'Flat')));
    const ly = P.stiffeners.layout;
    if (allSt.some(z => !/flat/i.test(String(z.stiffener_type || 'Flat')))) inc('Stiffeners', 'Tee stiffeners are not modelled by the app (flat plates only); they are not imported.');
    if (allSt.some(z => num(z.length_ft) > 0)) inc('Stiffeners', 'Stiffener zones with a length (length_ft > 0) are not imported: only single stiffeners at a station are mapped.');
    if (allSt.some(z => z.stiffener_role && !/transverse/i.test(String(z.stiffener_role)))) inc('Stiffeners', 'Stiffeners with a role other than "Transverse" (e.g. bearing) are not imported: the app designs its bearing stiffeners on the Stiffeners tab.');
    if (flats.length) {
      const z0 = flats[0], A = P.stiffeners.transverse.types.A = { ...P.stiffeners.transverse.types.A, bt: num(z0.flat_b), tp: num(z0.flat_t), sides: Math.round(num(z0.n_stiffeners)) === 2 ? '2' : '1' };
      P.stiffeners.transverse.gS = gradeOf(num(z0.fy) || 50);
      if (flats.some(z => num(z.flat_b) !== A.bt || num(z.flat_t) !== A.tp || Math.round(num(z.n_stiffeners) || 1) !== Math.round(num(z0.n_stiffeners) || 1))) inc('Stiffeners', `The flat stiffeners are not all the same size; the app has one intermediate stiffener type: ${f(A.bt, 3)} × ${f(A.tp, 4)} in, ${A.sides} side(s) used.`);
      map('Stiffeners', ['girder_transverse_stiffener_zones_by_label (plate)'], `${f(A.bt, 3)} × ${f(A.tp, 4)} in, F_y ${f(num(z0.fy), 0)} ksi, ${A.sides} side(s)`, 'Stiffeners › Intermediate stiffener type A (stiffeners.transverse.types.A, gS)', `b_t ${f(A.bt, 3)} in, t_p ${f(A.tp, 4)} in, grade ${P.stiffeners.transverse.gS}`);
    }
    ly.web = flats.some(z => !(num(z.length_ft) > 0)) ? 'stiffened' : 'unstiffened'; ly.mode = 'bays'; ly.bays = [];
    const skipped = { sup: 0, frm: 0 };
    P.girders.forEach((t, gi) => {
      const j = t.line, lab = labels[j], pts = stOf(lab).filter(z => /flat/i.test(String(z.stiffener_type || 'Flat')) && !(num(z.length_ft) > 0) && (!z.stiffener_role || /transverse/i.test(String(z.stiffener_role)))).map(z => num(z.location_ft)).filter(isNum).sort((a, b) => a - b);
      if (t.lines.some(k => JSON.stringify(stOf(labels[k]).map(z => z.location_ft)) !== JSON.stringify(stOf(lab).map(z => z.location_ft)))) inc('Stiffeners', `${t.label}: the girders of this type (${t.lines.map(k => labels[k]).join(', ')}) do not all have the same stiffeners; those of ${lab} are used.`);
      const ints = (FRM && appInts(P, j)) || cfAt, br = [...new Set([...sup, ...ints])].sort((a, b) => a - b);
      const bays = br.slice(1).map((b, k) => ({ g: gi + 1, a: +br[k].toFixed(3), b: +b.toFixed(3), x: [] }));
      pts.forEach(x => { if (sup.some(s => near(s, x))) { skipped.sup++; return; } if (ints.some(s => near(s, x))) { skipped.frm++; return; }
        const B = bays.find(q => x > q.a && x < q.b); if (B) B.x.push(x); });
      bays.forEach(B => { const n = B.x.length, e = { g: B.g, a: B.a, b: B.b, n, e0: 0, e1: 0 };
        if (n >= 1) e.e0 = r4((B.x[0] - B.a) * 12);
        if (n >= 2) e.e1 = r4((B.b - B.x[n - 1]) * 12);
        if (n >= 3) { const lo = B.x[0], hi = B.x[n - 1], ok = B.x.every((x, i) => Math.abs(x - (lo + (hi - lo) * i / (n - 1))) < 0.06); if (!ok) inc('Stiffeners', `${t.label}, bay ${f(B.a, 2)}–${f(B.b, 2)} ft: the inner stiffeners (${B.x.map(x => f(x, 2)).join(', ')} ft) are not evenly spaced; the app spaces the inner ones evenly between the first and the last.`); }
        ly.bays.push(e); });
    });
    seen.add('girder_transverse_stiffener_zones_by_label');
    if (skipped.sup) info(`${skipped.sup} stiffener station(s) at a bearing line were not imported as intermediate stiffeners (the app designs bearing stiffeners on the Stiffeners tab).`);
    if (skipped.frm) info(`${skipped.frm} stiffener station(s) at a cross-frame were taken as the cross-frame's connection plate (type B).`);
    map('Stiffeners', ['girder_transverse_stiffener_zones_by_label (stations)'], `${flats.length} flat stiffener entr${flats.length === 1 ? 'y' : 'ies'}`, 'Stiffeners › per-bay layout (stiffeners.layout: mode bays, bays)', `${ly.bays.filter(b => b.n > 0).length} bay(s) with stiffeners; web ${ly.web}`,
      'Each stiffener goes in the bay (between bearings and cross-frames) that contains it: one stiffener → e0 from the bay start; two → e0 and e1 from the bay ends; more: the inner ones evenly.');

    // ---- studs
    const CP = L.girder_connector_properties_by_label || {}, CZ = L.girder_connector_zones_by_label || {}, labD = labels[jDes];
    const cp = CP[labD] || CP[labels[0]], cz = arr(CZ[labD] || CZ[labels[0]]);
    P.studs = P.studs ? clone(P.studs) : M.defaultStuds();
    if (cp) {
      const d = num(cp.stud_diameter), dd = STUD_D.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, 0.875);
      if (Math.abs(dd - d) > 1e-6) inc('Studs', `stud_diameter ${f(d, 3)} in is not 3/4, 7/8 or 1 in; ${dd} in is used.`);
      Object.assign(P.studs, { d: dd, h: num(cp.stud_height), Fu: num(cp.fu), st: num(cp.transverse_spacing) });
      map('Studs', ['girder_connector_properties_by_label'], `${f(d, 3)} × ${f(num(cp.stud_height), 3)} in, F_u ${f(num(cp.fu), 1)} ksi, ${f(num(cp.transverse_spacing), 3)} in across`, 'Fatigue & studs › Stud d, h, F_u, transverse spacing (studs.d, h, Fu, st)', `${P.studs.d} × ${P.studs.h} in, ${P.studs.Fu} ksi, ${P.studs.st} in`);
    }
    if (cz.length) {
      P.studs.zones = cz.map(z => ({ x1: num(z.start_ft), x2: num(z.end_ft), nr: Math.round(num(z.n_studs_per_row)), p: num(z.pitch) }));
      map('Studs', ['girder_connector_zones_by_label'], cz.map(z => `${f(num(z.start_ft), 2)}–${f(num(z.end_ft), 2)} ft: ${z.n_studs_per_row} @ ${f(num(z.pitch), 3)} in`).join('; '), 'Fatigue & studs › Pitch zones (studs.zones)', P.studs.zones.map(z => `${f(z.x1, 2)}–${f(z.x2, 2)} ft: ${z.nr} @ ${f(z.p, 3)} in`).join('; '));
      if (cz.some(z => isNum(num(z.transverse_spacing)) && cp && num(z.transverse_spacing) !== num(cp.transverse_spacing))) inc('Studs', 'A pitch zone\'s transverse spacing differs from the connector properties; the app has one transverse spacing: the properties\' value is used.');
    }
    const ck = o => JSON.stringify(o || null);
    if (labels.some(lab => (CP[lab] && ck(CP[lab]) !== ck(cp)) || (CZ[lab] && ck(CZ[lab]) !== ck(CZ[labD] || CZ[labels[0]])))) inc('Studs', `The studs differ between girders; the app has one stud layout for the bridge: ${labD}'s is used.`);
    seen.add('girder_connector_properties_by_label'); seen.add('girder_connector_zones_by_label');
    const negC = L.girder_connector_neg_composite_by_label || {};
    if (Object.values(negC).some(v => v === true)) inc('Studs', 'girder_connector_neg_composite_by_label is true for some girders (studs through the negative moment region, composite there): the app takes the negative moment section as steel + deck rebar (Art. 6.10.1.1.1c) whatever the studs.');
    ign(['girder_connector_neg_composite_by_label'], 'See inconsistencies when true.');

    // ---- deck pour sequence
    const ps = L.deck_pour_sequence || {};
    if (ps.enabled === true) {
      const pours = arr(ps.pours).slice().sort((a, b) => num(a.pour) - num(b.pour)), first = arr(pours[0] && pours[0].ranges).filter(r => Array.isArray(r) && r.length === 2);
      P.analysis.seq = 'on'; P.analysis.seqCustom = first.map(r => `${f(num(r[0]), 3)}-${f(num(r[1]), 3)}`).join(', ');
      map('Construction', ['deck_pour_sequence'], `${pours.length} pour(s)`, 'Loads › Deck placement sequence, pours cast first (analysis.seq, seqCustom)', P.analysis.seqCustom || '—', 'The ranges of pour 1 are the app\'s first pours; the app places the rest of the deck after them.');
      if (pours.length > 2) inc('Deck pours', `${pours.length} pours: the app models the first pours and then the rest of the deck (two stages); pours 2 to ${pours.length} are one stage in the app.`);
      if (ns === 1) info('Single span: the app\'s deck placement sequence applies to continuous girders only.');
    } else { P.analysis.seq = 'off'; map('Construction', ['deck_pour_sequence'], 'not enabled', 'Loads › Deck placement sequence (analysis.seq)', 'off'); }

    // ---- project text
    const pj = P.project = { ...(P.project || {}) };
    [['project_name', 'name'], ['job_number', 'number'], ['client_owner', 'owner'], ['designer', 'designer'], ['checked_by', 'checker'], ['report_date', 'date']].forEach(([k, a]) => {
      if (L[k] != null && L[k] !== '') { pj[a] = String(L[k]); map('Project', [k], js(L[k]), `Project › ${a} (project.${a})`, js(pj[a])); } else seen.add(k); });
    ign(['bridge_id', 'location_route', 'approved_by', 'pe_license', 'revision', 'revision_description', 'revision_history'], 'Title-block fields the app does not have (kept in the file copy and written back on export).');
    ign(['design_locations_by_span', 'design_locations', 'girder_design_locations_by_label', 'design_pt_node_target', 'design_pt_splice', 'design_pt_user', 'girder_design_point_types_by_label'], 'MIDAS design points: the app checks its own stations (every tenth point, plate changes, supports, splices).');
    ign(['negative_moment_regions'], 'The app finds the negative moment regions from its own analysis.');

    // ---- the rest: nothing silently dropped
    Object.keys(L).forEach(k => { if (!seen.has(k)) R.ignored.push({ lga: k, value: js(L[k]), why: KEYS.includes(k) ? 'Not used by the app.' : 'Not a key of the .lga format this importer knows.' }); });
    if ('midas_url' in L) R.ignored.push({ lga: 'midas_url', value: L.midas_url ? '(a URL)' : '""', why: 'Not stored (the MIDAS server address of the computer that saved the file).' });
    const missing = KEYS.filter(k => !(k in L)); if (missing.length) inc('File', `${missing.length} key(s) of the format are missing: ${missing.join(', ')}. The open project's or the app's defaults are used for them.`);
    if (ns > 1) info(UNVERIFIED);
    if (opt.base) { const kept = [];
      if (P.splices && Array.isArray(P.splices.plates) && P.splices.plates.length) kept.push('entered splice plates (Splices tab)');
      if (P.custom && Object.keys(P.custom).some(k => P.custom[k] && Object.keys(P.custom[k]).length)) kept.push('custom demands (by girder id)');
      if (opt.base.girders && opt.base.girders.some(g => g.lineOv || g.loadsManual || g.dfManual)) kept.push('the entered loads, factors and per-line overrides of the old girder types (removed with them)');
      info('Imported into the open project: every input the file does not have is kept from it (owner rules, sidewalks, overlays, bolts, welds, rating, …). The girder types are replaced by the file\'s.' + (kept.length ? ' Check: ' + kept.join('; ') + '.' : '')); }

    // ---- app-side checks that need the engines (not stored)
    try { sharesCheck(P, L, labels, inc); } catch (e) { /* the loads module not loaded: no check */ }
    const keep = clone(L); delete keep.midas_url;
    P.midasLga = { importedAt: opt.now || new Date().toISOString(), fileName: opt.fileName || '', appVersion: obj.app_version != null ? String(obj.app_version) : '', saved: obj.saved != null ? String(obj.saved) : '', keep };
    R.errors = M.validate(P).errors;
    return { ok: true, project: P, report: R };
  }
  /* sharesCheck: MIDAS custom DC shares against the app's tributary split (inconsistencies only) */
  function sharesCheck(P, L, labels, inc) {
    const W = window, LD = W.SBDLoads; if (!LD || !W.SBDLldf || !W.SBDOwners) return;
    const { b, p } = LD.fromModel(P, { girder: 0 }), R = LD.compute(b, p); if (R.errors && R.errors.length) return;
    const D = R.dead, tot = a => a.reduce((s, v) => s + v, 0);
    [['dc1', D.dc1], ['dc2', D.dc2], ['dw', D.dw]].forEach(([k, a]) => {
      if (!/^custom$/i.test(String(L[k + '_dist_mode'] || ''))) return;
      const pct = arr(L[k + '_dist_pct']).map(num), T = tot(a), Tm = tot(pct.filter(isNum));
      if (pct.length !== a.length || !(Tm > 0) || !(T > 0)) { inc(`${k.toUpperCase()} distribution`, `${k}_dist_pct has ${pct.length} values for ${a.length} girders; not compared.`); return; }
      const app = a.map(v => 100 * v / T), mid = pct.map(v => 100 * v / Tm), d = app.map((v, i) => Math.abs(v - mid[i])), mx = Math.max(...d);
      if (mx > 0.5) { const i = d.indexOf(mx);
        inc(`${k.toUpperCase()} distribution`, `MIDAS custom ${k.toUpperCase()} shares do not match the app's split by tributary width: e.g. ${labels[i]} MIDAS ${f(mid[i], 3)} %, app ${f(app[i], 3)} % (all: MIDAS ${mid.map(v => f(v, 2)).join(' / ')} %; app ${app.map(v => f(v, 2)).join(' / ')} %). The app uses its own split.`); }
    });
  }

  /* ---------------------------------------------------------------- export ---------------------------------------------------------------- */
  /* exportCalc(P): the app's computed values the export needs. { errors } when the loads module cannot run. */
  function exportCalc(P) {
    const W = window, M = W.SBDModel, LD = W.SBDLoads, AN = W.SBDAnalysis, SEC = W.SBDSections, OWN = W.SBDOwners;
    if (!M || !LD || !W.SBDLldf || !OWN || !SEC) return { errors: ['The loads module is not loaded.'] };
    const v = M.validate(P); if (v.errors.length) return { errors: v.errors.map(e => e.msg) };
    const nb = Math.round(P.xs.nb), ns = P.spans.lengths.length, sup = supOf(P.spans.lengths.map(Number));
    const typeOfLine = j => { const k = P.girders.findIndex((g, gi) => M.typeLines(P, gi).includes(j)); return k >= 0 ? k : 0; };
    const mods = {}, modOf = gi => { if (!(gi in mods)) { const { b, p } = LD.fromModel(P, { girder: gi }), R = LD.compute(b, p); mods[gi] = R.errors && R.errors.length ? { errors: R.errors } : { R }; } return mods[gi]; };
    const m0 = modOf(typeOfLine(nb >= 3 ? 1 : 0)); if (m0.errors) return { errors: m0.errors };
    const R0 = m0.R, D = R0.dead;
    // distribution factors of a line: the type's own (dfOf: pulled, entered or the module's) on its design line, else the module's
    const lineDf = j => { const gi = typeOfLine(j), g = P.girders[gi], mm = modOf(gi); if (mm.errors) return null;
      let spans, piers, pulled = null;
      if (AN && M.designLine(P, g) === j) { const mod = { j, G: LD.girder(mm.R, j), R: mm.R }, d = AN.dfOf(P, g, ns, mod); spans = d.spans; piers = d.piers; pulled = d.pulled ? (g.dfPull && g.dfPull.source) || {} : null; }
      else { spans = mm.R.regions.filter(r => r.kind === 'span').map(r => r.members[j]); piers = mm.R.regions.filter(r => r.kind === 'sup').map(r => ({ gM: r.members[j].gM })); }
      const mx = (a, k) => Math.max(...a.map(q => +q[k] || 0));
      return { gM: Math.max(mx(spans, 'gM'), piers.length ? mx(piers, 'gM') : 0), gV: mx(spans, 'gV'), fatM: mx(spans, 'fatM'), fatV: mx(spans, 'fatV'), pulled, type: g.label || g.id }; };
    const df = { ext: lineDf(0), int: lineDf(nb >= 3 ? 1 : 0) };
    const mc = P.materials.concrete, nr = SEC.modularRatio(mc.fc, mc.wcE > 0 ? mc.wcE : mc.wc, mc.K1, mc.nRule);
    const lf = OWN.loadFactors((P.ownerRules || {}).owner || 'AASHTO', (P.ownerRules || {}).eta, nb);
    // cross-frame stations per line (the framing module, else the stiffener tab's stations / L_b)
    const FRM = W.SBDFraming, SB = W.SBDStiffeners, fr = ((P.stiffeners || {}).layout || {}).frames || {};
    let FC = null; try { FC = FRM && P.framing ? FRM.compute(P) : null; if (FC && FC.errors.length) FC = null; } catch (e) { FC = null; }
    const intsOf = j => { if (FC) { try { const b = FRM.forGirder(P, { line: j }, sup); if (b) return b.ints; } catch (e) { /* below */ } }
      return Array.isArray(fr.at) ? fr.at.map(Number) : SB ? SB.framesDefault(sup, +fr.Lb || 25) : []; };
    const frames = Array.from({ length: nb }, (_, j) => intsOf(j));
    const orient = FC && FC.FR && Array.isArray(FC.FR.orient) ? FC.FR.orient.map(o => o.o) : [];
    // intermediate stiffener stations of each type (its design line's brace points)
    const stiff = P.girders.map((g, gi) => { if (!SB) return []; const ly = (P.stiffeners || {}).layout || {}; if (ly.web === 'unstiffened') return [];
      const j = M.designLine(P, g), Dm = Math.max(...g.segments.map(s => s.D)), cont = P.spans.continuity === 'continuous' && sup.length > 2;
      try { return SB.girderBays(ly, Dm, sup, cont, sup, frames[j] || [], gi + 1).flatMap(B => SB.bayX(B)).map(x => r4(x)); } catch (e) { return []; } });
    // cross-frame weight (point loads) -> klf smeared over the bridge
    let xfKlf = 0, xfNote = '';
    if (W.SBDCrossframes && P.framing && ((P.crossframes || {}).weight || {}).mode !== 'off') {
      try { let tot = 0; for (let j = 0; j < nb; j++) { const q = W.SBDCrossframes.pointLoads({ ...P, girders: [{ ...P.girders[typeOfLine(j)], line: j }] }, 0); if (q) tot += q.tot; }
        xfKlf = tot / sup[sup.length - 1]; xfNote = `the app's cross-frame point loads (${f(tot, 3)} kip on all ${nb} girder lines) smeared over ${f(sup[sup.length - 1], 2)} ft = ${f(xfKlf, 4)} klf`; } catch (e) { xfKlf = 0; }
    }
    const steel = LD.steelWeight(P.girders[typeOfLine(nb >= 3 ? 1 : 0)].segments, 0);
    return { errors: [], nb, ns, sup, Lt: sup[sup.length - 1], df, n: nr.n, Ec: nr.Ec, lf, dl: { dc1: D.dc1.slice(), dc2: D.dc2.slice(), dw: D.dw.slice(), deck: D.deck.slice(), haunch: D.haunch.slice(), Wd: D.Wd, per: D.per },
      faces: { L: R0.ll.L.r, R: R0.ll.R.r }, frames, orient, stiff, xfKlf, xfNote, steelAvg: steel.avg, typeOfLine: Array.from({ length: nb }, (_, j) => typeOfLine(j)) };
  }

  const segOut = (s, span, k, dh, grade) => ({ label: `S${span + 1}-${k + 1}`, length: r6(s.x1 - s.x0), tf_w: s.topB, tf_t: s.topT, web_d: s.D, web_t: s.tw, bf_w: s.botB, bf_t: s.botT, haunch: dh, tf_fy: grade.top, web_fy: grade.web, bf_fy: grade.bot });
  const segOrder = q => ({ label: q.label, length: q.length, tf_w: q.tf_w, tf_t: q.tf_t, tf_fy: q.tf_fy, web_d: q.web_d, web_t: q.web_t, web_fy: q.web_fy, bf_w: q.bf_w, bf_t: q.bf_t, bf_fy: q.bf_fy, haunch: q.haunch });
  /* bySpan(segments, sup): app segments split at the supports, per span */
  function bySpan(segs, sup) {
    const out = sup.slice(1).map(() => []);
    for (let k = 0; k < sup.length - 1; k++) { const a = sup[k], b = sup[k + 1];
      segs.forEach(s => { const x0 = Math.max(a, s.x0), x1 = Math.min(b, s.x1); if (x1 - x0 > 1e-6) out[k].push({ ...s, x0, x1 }); }); }
    return out;
  }
  /* schedule(xs, sup): "n@s" per span when the frames are evenly spaced, else the stations; spans joined by ", " (unverified for > 1 span) */
  function schedule(st, sup) {
    return sup.slice(1).map((b, k) => { const a = sup[k], p = [a, ...st.filter(x => x > a + 1e-6 && x < b - 1e-6), b], d = p.slice(1).map((x, i) => x - p[i]);
      return d.every(v => Math.abs(v - d[0]) < 0.01) ? `${d.length}@${f(d[0], 3)}` : st.filter(x => x > a && x < b).map(x => f(x, 3)).join(' '); }).join(', ');
  }
  function defaults(nb, ns, Lt) {
    const labs = labelsOf(nb), per = v => Object.fromEntries(labs.map(l => [l, typeof v === 'function' ? v(l) : clone(v)])), today = new Date().toISOString().slice(0, 10);
    return {
      project_name: '', designer: '', bridge_id: '', job_number: '', client_owner: '', location_route: '', checked_by: '', approved_by: '', pe_license: '', report_date: today,
      revision: '0', revision_description: 'Initial issue', revision_history: [{ rev: '0', date: today, description: 'Initial issue', by: '' }],
      code_edition: 'AASHTO LRFD Bridge Design Specifications, 9th Ed. (2020)', analysis_mode: 'Line Girder', lane_position_mode: 'Auto', design_lanes: [],
      element_length: 5.0, transverse_plate_size: 5.0, transverse_orientation: 'Skew', horizontal_radius_ft: 0.0, curve_direction: 'Concave', curvature_flange_lateral_N: 10.0,
      design_locations_by_span: Array.from({ length: ns }, () => []), design_locations: [], negative_moment_regions: [],
      girder_segments_by_span_stash: per({}), girder_design_locations_by_label: per([]), haunch_width: 16.0,
      moving_load_entries: [
        { entry_key: 'aashto-lrfd-hl-93tdm', standard_code: 'AASHTO-LRFD', standard_display: 'AASHTO LRFD', vehicle_name: 'HL-93TDM', vehicle_type_name: 'HL-93TDM', classification: 'Inventory', dyn_load_allowance: 33.0, cent_f: false, weight_kips: 50.0, catalog_source: 'Built-in catalog', mvld_code: 2, vehicle_load_num: 1, user_load_type: '', uniform_load_klf: 0.0, axles: [] },
        { entry_key: 'aashto-lrfd-hl-93trk', standard_code: 'AASHTO-LRFD', standard_display: 'AASHTO LRFD', vehicle_name: 'HL-93TRK', vehicle_type_name: 'HL-93TRK', classification: 'Inventory', dyn_load_allowance: 33.0, cent_f: false, weight_kips: 72.0, catalog_source: 'Built-in catalog', mvld_code: 2, vehicle_load_num: 1, user_load_type: '', uniform_load_klf: 0.0, axles: [] },
        { entry_key: 'aashto-lrfd-hs20-ftg', standard_code: 'AASHTO-LRFD', standard_display: 'AASHTO LRFD', vehicle_name: 'HS20-FTG', vehicle_type_name: 'HS20-FTG', classification: 'Fatigue', dyn_load_allowance: 15.0, cent_f: false, weight_kips: 72.0, catalog_source: 'Built-in catalog', mvld_code: 2, vehicle_load_num: 1, user_load_type: '', uniform_load_klf: 0.0, axles: [] }],
      moving_load_available_entries: [], moving_load_custom_lists: {}, moving_load_active_list_label: 'AASHTO LRFD Starter',
      design_pt_node_target: false, design_pt_splice: false, design_pt_user: false, girder_design_point_types_by_label: per({ node_target: true, splice: true, user: true }),
      load_combinations: [
        { name: 'Strength I', active: true, type: 'strength', dc: 1.25, dw: 1.5, ll: 1.75, ll_source: 'LL' }, { name: 'Strength III', active: true, type: 'strength', dc: 1.25, dw: 1.5, ll: 0.0, ll_source: 'LL' },
        { name: 'Strength IV', active: true, type: 'strength', dc: 1.5, dw: 1.5, ll: 0.0, ll_source: 'LL' }, { name: 'Strength V', active: true, type: 'strength', dc: 1.25, dw: 1.5, ll: 1.35, ll_source: 'LL' },
        { name: 'Service I', active: false, type: 'service', dc: 1.0, dw: 1.0, ll: 1.0, ll_source: 'LL' }, { name: 'Service II', active: true, type: 'service', dc: 1.0, dw: 1.0, ll: 1.3, ll_source: 'LL' },
        { name: 'Fatigue I', active: true, type: 'fatigue', dc: 0.0, dw: 0.0, ll: 1.75, ll_source: 'Fatigue' }, { name: 'Fatigue II', active: true, type: 'fatigue', dc: 0.0, dw: 0.0, ll: 0.8, ll_source: 'Fatigue' }],
      design_phi_y: 0.95, design_phi_u: 0.8, design_phi_c: 0.9, design_phi_f: 1.0, design_phi_v: 1.0, design_phi_sc: 0.85, design_phi_b: 1.0, design_use_appendix_a6: false,
      bracing_details: [{ name: 'Bracing-1', bracing_type: 'Bracing', element_type: 'Truss', brace_arrangement: 'X Brace', top_chord: true, top_section: 'L5x5x3/8', brace: true, brace_section: 'L5x5x3/8', bottom_chord: true, bottom_section: 'L5x5x3/8', single_beam_section: 'C15X33.9', top_gap_ft: 0.0, bottom_gap_ft: 0.0 }],
      bracing_user_sections: [], girder_connector_neg_composite_by_label: per(false), midas_url: ''
    };
  }
  /* toLga(P, opt, calc): the .lga file of project P (calc = exportCalc(P)) */
  function toLga(P, opt, calc) {
    opt = { lldfUser: true, nExplicit: true, dlCustom: true, ...(opt || {}) };
    const M = window.SBDModel;
    if (!calc || (calc.errors && calc.errors.length)) return { ok: false, error: 'The project cannot be exported: ' + ((calc && calc.errors) || ['no results']).join(' ') };
    const S = { written: [], approx: [], info: [] }, W = t => S.written.push(t), A = t => S.approx.push(t), I = t => S.info.push(t);
    const nb = calc.nb, ns = calc.ns, sup = calc.sup, Lt = calc.Lt, labs = labelsOf(nb), xs = P.xs, d = P.deck, mat = P.materials;
    const keep = P.midasLga && P.midasLga.keep && typeof P.midasLga.keep === 'object' ? P.midasLga.keep : null;
    const o = defaults(nb, ns, Lt);
    const perLab = (k, def) => { const kv = keep && keep[k] && typeof keep[k] === 'object' && !Array.isArray(keep[k]) ? keep[k] : null; return Object.fromEntries(labs.map(l => [l, kv && l in kv ? clone(kv[l]) : clone(def(l))])); };
    // unmodelled keys: the imported file's values when there is one
    const KEEP = ['bridge_id', 'location_route', 'approved_by', 'pe_license', 'revision', 'revision_description', 'revision_history', 'code_edition', 'analysis_mode', 'lane_position_mode', 'design_lanes',
      'element_length', 'transverse_plate_size', 'transverse_orientation', 'horizontal_radius_ft', 'curve_direction', 'curvature_flange_lateral_N', 'design_locations', 'haunch_width',
      'moving_load_available_entries', 'moving_load_custom_lists', 'moving_load_active_list_label', 'design_pt_node_target', 'design_pt_splice', 'design_pt_user',
      'design_phi_y', 'design_phi_u', 'design_phi_c', 'design_phi_f', 'design_phi_v', 'design_phi_sc', 'design_phi_b', 'design_use_appendix_a6', 'bracing_user_sections', 'bracing_details'];
    if (keep) { KEEP.forEach(k => { if (k in keep) o[k] = clone(keep[k]); });
      ['design_locations_by_span', 'negative_moment_regions'].forEach(k => { if (Array.isArray(keep[k]) && (k !== 'design_locations_by_span' || keep[k].length === ns)) o[k] = clone(keep[k]); });
      I(`Inputs the app does not model are written as they were in the imported file${P.midasLga.fileName ? ` "${P.midasLga.fileName}"` : ''} (title block, design points, resistance factors, MIDAS options).`); }
    o.girder_segments_by_span_stash = perLab('girder_segments_by_span_stash', () => ({}));
    o.girder_design_locations_by_label = perLab('girder_design_locations_by_label', () => []);
    o.girder_design_point_types_by_label = perLab('girder_design_point_types_by_label', () => ({ node_target: true, splice: true, user: true }));
    o.girder_connector_neg_composite_by_label = perLab('girder_connector_neg_composite_by_label', () => false);
    // project text
    const pj = P.project || {};
    Object.assign(o, { project_name: String(pj.name || ''), job_number: String(pj.number || ''), client_owner: String(M.clientName ? M.clientName(P) : pj.owner || ''), designer: String(pj.designer || ''), checked_by: String(pj.checker || ''), report_date: String(pj.date || o.report_date) });
    W('Project: name, job number, client, designer, checker, date.');
    // geometry
    const bays = xs.bays.map(Number), Sav = bays.reduce((a, b) => a + b, 0) / bays.length, ohAv = (+xs.ohL + +xs.ohR) / 2;
    Object.assign(o, { num_spans: ns, span_lengths: P.spans.lengths.map(Number), support_restraints: sup.map((_, k) => k === 0 ? 'Pinned' : 'Roller'), num_girders: nb, girder_spacing: r6(Sav), deck_overhang: r6(ohAv) });
    if (bays.some(b => Math.abs(b - Sav) > 1e-6)) A(`Girder spacings differ (${bays.join(', ')} ft): MIDAS has one spacing; their average ${f(Sav, 4)} ft is written.`);
    if (Math.abs(xs.ohL - xs.ohR) > 1e-6) A(`Overhangs differ (${xs.ohL} / ${xs.ohR} ft): MIDAS has one; the average ${f(ohAv, 4)} ft is written.`);
    if (ns > 1 && P.spans.continuity === 'simple') A('The app\'s spans are simple spans; MIDAS models one continuous line girder. Model the simple spans in MIDAS separately.');
    const sk = xs.skews.map(Number), skMax = sk.reduce((a, b) => Math.abs(b) > Math.abs(a) ? b : a, 0);
    o.skew_angle = skMax; if (sk.some(v => Math.abs(v - skMax) > 1e-9)) A(`Support skews differ (${sk.join(', ')}°): MIDAS has one skew; the largest, ${skMax}°, is written.`);
    W(`Geometry: ${ns} span(s), ${nb} girders at ${f(Sav, 4)} ft, overhang ${f(ohAv, 4)} ft, skew ${skMax}°.`);
    const faceL = calc.faces.L, faceR = calc.faces.R, road = calc.dl.Wd - faceL - faceR;
    o.barrier_width = r6((faceL + faceR) / 2); o.roadway_width = r6(road);
    if (Math.abs(faceL - faceR) > 1e-6) A(`The traffic faces differ (${f(faceL, 3)} / ${f(faceR, 3)} ft from the deck edges); MIDAS has one barrier width: the average ${f(o.barrier_width, 3)} ft.`);
    W(`Roadway ${f(road, 3)} ft = deck width ${f(calc.dl.Wd, 3)} − traffic faces ${f(faceL, 3)} − ${f(faceR, 3)} ft; barrier width ${f(o.barrier_width, 3)} ft.`);
    // girders
    const grade = { top: M.GRADES[mat.steel.top].Fy, web: M.GRADES[mat.steel.web].Fy, bot: M.GRADES[mat.steel.bot].Fy };
    const tfMax = Math.max(...P.girders.flatMap(g => g.segments.map(s => s.topT)));
    const dh = r6(+d.haunch + tfMax); o.d_haunch = dh;
    W(`Haunch: d_haunch (top of web to deck soffit) = haunch ${f(+d.haunch, 3)} + thickest top flange ${f(tfMax, 3)} = ${f(dh, 3)} in.`);
    const sched = g => bySpan(g.segments, sup).map((list, k) => list.map((s, i) => segOut(s, k, i, dh, grade)));
    const lineSched = labs.map((_, j) => sched(P.girders[calc.typeOfLine[j]]));
    const unassigned = M.unassigned ? M.unassigned(P) : [];
    if (unassigned.length) A(`Girder line(s) ${unassigned.map(j => labs[j]).join(', ')} have no girder type: the plates of the first type are written for them.`);
    const sameAll = lineSched.every(s => JSON.stringify(s) === JSON.stringify(lineSched[0]));
    o.segments = lineSched[nb >= 3 ? 1 : 0].map(l => l.map(segOrder));
    o.girder_schedule_same_all = sameAll;
    o.girder_segments_by_label = Object.fromEntries(labs.map((l, j) => [l, lineSched[j].flat().map(q => ({ label: q.label, length: q.length, tf_w: q.tf_w, tf_t: q.tf_t, web_d: q.web_d, web_t: q.web_t, bf_w: q.bf_w, bf_t: q.bf_t, haunch: q.haunch, tf_fy: q.tf_fy, web_fy: q.web_fy, bf_fy: q.bf_fy }))]));
    o.girder_segments_by_span = Object.fromEntries(labs.map((l, j) => [l, lineSched[j].map(sp => sp.map(q => ({ label: q.label, length: q.length, tf_w: q.tf_w, tf_t: q.tf_t, web_d: q.web_d, web_t: q.web_t, bf_w: q.bf_w, bf_t: q.bf_t, haunch: q.haunch, tf_fy: q.tf_fy, web_fy: q.web_fy, bf_fy: q.bf_fy })))]));
    W(`Girder plates: ${sameAll ? 'one schedule for all girders' : 'a schedule per girder line from its girder type'}; segments split at the supports (labels S<span>-<n>).`);
    { const RL = window.SBDRolled, nm = RL ? [...new Set(P.girders.flatMap(g => g.segments.map(s => RL.label(s)).filter(Boolean)))] : [];   // ROLL (2026-11-23)
      if (nm.length) A(`Rolled shapes (${nm.join(', ')}) are written as their equivalent three plates (flanges b_f × t_f, web d − 2 t_f by t_w; fillets left out; t_f reduced where needed so that A, I_x, S_x and Z_x do not exceed the tabulated values): the MIDAS girder schedule holds plate sizes only. Choose the rolled section in MIDAS if its database section is wanted; MIDAS computes the steel weight from the plates.`); }
    o.Fy_steel = grade.top; if (grade.top !== grade.web || grade.top !== grade.bot) I(`Fy_steel = ${grade.top} ksi (top flange); each segment carries its own F_y (top ${grade.top}, web ${grade.web}, bottom ${grade.bot} ksi).`);
    if (!keep) o.haunch_width = Math.max(...P.girders.flatMap(g => g.segments.map(s => s.topB)));
    // deck
    const tsac = Math.max(0, +d.tdeck - +d.ts); o.t_deck = +d.ts; o.t_wear_integral = r6(tsac);
    W(`Deck: t_deck = t_s = ${f(+d.ts, 3)} in; t_wear_integral = total − t_s = ${f(+d.tdeck, 3)} − ${f(+d.ts, 3)} = ${f(tsac, 3)} in.`);
    const beffI = M.tribBeff(xs, nb >= 3 ? 1 : 0), kz = keep && keep.girder_rebar_zones_by_label && arr(keep.girder_rebar_zones_by_label[labs[nb >= 3 ? 1 : 0]])[0];
    const rebar = k => { const A = +d.rebar[k].A, c = +d.rebar[k].c;
      const cand = kz && BARS[kz[k + '_bar_size']] ? kz[k + '_bar_size'] : null;
      if (cand && Math.abs(Math.floor(beffI / num(kz[k + '_spacing']) + 1e-9) * BARS[cand][0] - A) < 1e-4 && Math.abs(num(kz[k + '_cover']) + BARS[cand][1] / 2 - c) < 1e-4) return { bar: cand, s: num(kz[k + '_spacing']), cover: num(kz[k + '_cover']), exact: true };
      let best = null; ['#4', '#5', '#6', '#7', '#8'].forEach(b => { const n = A / BARS[b][0], e = Math.abs(n - Math.round(n)); if (Math.round(n) >= 1 && (best == null || e < best.e - 1e-9)) best = { b, n: Math.round(n), e }; });
      if (!best) best = { b: k === 'top' ? '#6' : '#5', n: 1, e: 1 };
      const s = r4(beffI / (best.n + 0.5)), cover = r4(c - BARS[best.b][1] / 2);
      return { bar: best.b, s, cover, exact: best.e < 1e-6, n: best.n }; };
    const rt = rebar('top'), rbm = rebar('bot');
    [['top', rt], ['bot', rbm]].forEach(([k, q]) => { o[k + '_rebar_area'] = BARS[q.bar][0]; o[k + '_rebar_spacing'] = q.s; o[k + '_rebar_cover'] = q.cover;
      W(`${k === 'top' ? 'Top' : 'Bottom'} rebar: ${q.bar} @ ${f(q.s, 3)} in, cover ${f(q.cover, 3)} in (${Math.floor(beffI / q.s + 1e-9)} bars in b_eff ${f(beffI, 2)} in = ${f(Math.floor(beffI / q.s + 1e-9) * BARS[q.bar][0], 3)} in²; app A_r ${f(+d.rebar[k].A, 3)} in², centroid ${f(+d.rebar[k].c, 4)} in).`);
      if (!q.exact) A(`${k === 'top' ? 'Top' : 'Bottom'} rebar: the app's A_r ${f(+d.rebar[k].A, 3)} in² is not a whole number of standard bars; ${q.n} ${q.bar} (${f(q.n * BARS[q.bar][0], 3)} in²) are written.`); });
    if (+d.rebar.top.c - BARS[rt.bar][1] / 2 <= 0 || +d.rebar.bot.c - BARS[rbm.bar][1] / 2 <= 0) A('A rebar centroid is closer to the slab face than half a bar: the written cover is not positive; check the rebar inputs.');
    o.fy_rebar = +mat.rebar.Fyr;
    const zoneOf = () => [{ start_ft: 0.0, end_ft: Lt, top_bar_size: rt.bar, top_spacing: rt.s, top_cover: rt.cover, bot_bar_size: rbm.bar, bot_spacing: rbm.s, bot_cover: rbm.cover, fy: +mat.rebar.Fyr }];
    o.girder_rebar_zones_by_label = Object.fromEntries(labs.map(l => [l, zoneOf()]));
    o.girder_rebar_runs_by_label = Object.fromEntries(labs.map(l => [l, zoneOf().map(z => ({ length_ft: z.end_ft - z.start_ft, top_bar_size: z.top_bar_size, top_spacing: z.top_spacing, top_cover: z.top_cover, bot_bar_size: z.bot_bar_size, bot_spacing: z.bot_spacing, bot_cover: z.bot_cover, fy: z.fy }))]));
    if (nb >= 3) I(`Deck rebar: the app has one area per girder (within b_eff); the same bars are written for every girder, so MIDAS's exterior girders (b_eff ${f(M.tribBeff(xs, 0), 2)} in) get fewer bars than the interior.`);
    // materials
    const c = mat.concrete; o.fc_concrete = +c.fc; o.wc_concrete = +c.wc;
    o.Es_override = +mat.Es || 29000; o.Ec_override = r4(calc.Ec); o.n_override = r6(calc.n);
    o.use_material_overrides = !!opt.nExplicit; o.es_override_enabled = false; o.ec_override_enabled = false; o.n_override_enabled = !!opt.nExplicit;
    if (opt.nExplicit) W(`Modular ratio written explicitly: n_override = ${f(calc.n, 4)} (enabled), the app's n = 29,000 / E_c with E_c = ${f(calc.Ec, 0)} ksi.`);
    else A(`n not written: MIDAS computes its own n (the app uses ${f(calc.n, 3)}).`);
    // dead loads
    const per = calc.dl.per || [], rowsBy = (pre, cat) => per.filter(L => L.cat === cat && (pre ? String(L.desc || '').startsWith(pre) : true));
    const sumPlf = a => a.reduce((s, L) => s + (+L.plf || 0), 0);
    const edges = xs.edges || {}, barE = ['L', 'R'].filter(k => edges[k] && edges[k].type === 'barrier');
    o.w_parapet = barE.length ? r6(barE.reduce((s, k) => s + (+edges[k].bwt || 0), 0) / barE.length) : 0; o.n_parapets = 2;
    const dc2T = calc.dl.dc2.reduce((a, b) => a + b, 0), dwT = calc.dl.dw.reduce((a, b) => a + b, 0);
    const dc2Diff = Math.abs(dc2T - 2 * o.w_parapet) > 1e-4;
    o.barrier_apply = true; o.barrier_override_enabled = dc2Diff; o.barrier_override_klf = dc2Diff ? r6(dc2T) : 0.0;
    if (dc2Diff) A(`The app's DC2 on all girders adds up to ${f(dc2T, 4)} klf, not 2 × w_parapet = ${f(2 * o.w_parapet, 4)} klf (curbs, sidewalks, medians or DC2 rows; or a distribution rule whose shares add up to more than the line loads, e.g. the MassDOT pile-cap rule); barrier_override_klf = ${f(dc2T, 4)} klf is written (enabled; a bridge total, as deck_override_klf) so that MIDAS's DC2 per girder is the app's.`);
    const ws = xs.ws || {}, utilRows = rowsBy(MAPPED_PREFIX + 'w_utilities', 'DW'), utilApp = sumPlf(utilRows) + sumPlf(per.filter(L => L.cat === 'DW' && /^u\d/.test(String(L.id || '')) && !utilRows.includes(L)));
    o.w_fws_ksf = ws.mode === 'thk' ? 0 : r6((+ws.psf || 0) / 1000);
    const fwsApp = dwT - utilApp, fwsMid = o.w_fws_ksf * road, fwsDiff = Math.abs(fwsApp - fwsMid) > 1e-4;
    o.fws_apply = true; o.fws_override_enabled = fwsDiff; o.fws_override_klf = fwsDiff ? r6(fwsApp) : 0.0;
    if (fwsDiff) A(`The app's DW on all girders without utilities adds up to ${f(fwsApp, 4)} klf (wearing surface${ws.mode === 'thk' ? ' by thickness' : ''}, overlays), not w_fws × roadway = ${f(fwsMid, 4)} klf; fws_override_klf = ${f(fwsApp, 4)} klf is written (enabled; a bridge total).`);
    o.w_deckforms = r6((+xs.sip || 0) / 1000);
    const cfRows = rowsBy(MAPPED_PREFIX + 'w_crossframes', 'DC1'), miscRows = rowsBy(MAPPED_PREFIX + 'w_misc', 'DC1'), otherDC1 = per.filter(L => L.cat === 'DC1' && !cfRows.includes(L) && !miscRows.includes(L) && L.plf > 0 && !/^(deck|haunch|sip)/i.test(String(L.id || '')));
    o.w_crossframes = r6(sumPlf(cfRows) + calc.xfKlf);
    if (calc.xfKlf > 0) A(`Cross-frame weight: ${calc.xfNote}, written in w_crossframes (MIDAS shares it as a uniform load).`);
    const allowKlf = (+xs.allow || 0) / 100 * calc.steelAvg;
    o.w_misc = r6(sumPlf(miscRows) / nb + sumPlf(otherDC1) / nb + allowKlf);
    if (otherDC1.length) A(`Other DC1 rows (${otherDC1.map(L => L.desc).join(', ')}: ${f(sumPlf(otherDC1), 4)} klf) are added to w_misc as ${f(sumPlf(otherDC1) / nb, 4)} klf per girder.`);
    if (allowKlf > 0) A(`Steel detail allowance ${xs.allow} % (${f(allowKlf, 4)} klf on the average girder weight ${f(calc.steelAvg, 4)} klf) added to w_misc (MIDAS takes the steel weight from the plates only).`);
    o.w_utilities = r6(utilApp / nb);
    const ptl = per.filter(L => ['PL', 'UT', 'UF'].includes(L.cat) && L.plf > 0); if (ptl.length) A(`Pedestrian load and noncomposite utility rows (${ptl.map(L => L.desc).join(', ')}) are not written: MIDAS has no field for them.`);
    W(`Dead loads: w_parapet ${f(o.w_parapet, 4)} klf × 2, FWS ${f(o.w_fws_ksf, 4)} ksf, SIP ${f(o.w_deckforms, 4)} ksf, cross-frames ${f(o.w_crossframes, 4)} klf (bridge), misc. ${f(o.w_misc, 4)} klf and utilities ${f(o.w_utilities, 4)} klf (per girder).`);
    const deckT = calc.dl.deck.reduce((a, b) => a + b, 0);
    o.girder_self_weight_apply = true; o.girder_self_weight_override_enabled = false; o.girder_self_weight_override_klf = r4(calc.steelAvg);
    o.deck_apply = true; o.deck_override_enabled = tsac > 1e-9; o.deck_override_klf = r4(deckT);
    if (tsac > 1e-9) A(`Deck weight: MIDAS computes it from t_deck alone; the app includes the integral wearing surface, so deck_override_klf = w_c × t_total/12 × deck width = ${f(deckT, 4)} klf (bridge total, enabled).`);
    o.haunch_apply = true; o.haunch_override_enabled = false; o.haunch_override_klf = r4(calc.dl.haunch[nb >= 3 ? 1 : 0]);
    const shares = a => { const T = a.reduce((s, v) => s + v, 0); return T > 0 ? a.map(v => r4(100 * v / T)) : []; };
    if (opt.dlCustom) { o.dc1_dist_mode = 'Custom'; o.dc2_dist_mode = 'Custom'; o.dw_dist_mode = 'Custom'; o.dc1_dist_pct = shares(calc.dl.dc1); o.dc2_dist_pct = shares(calc.dl.dc2); o.dw_dist_pct = shares(calc.dl.dw);
      W(`Dead-load distribution: Custom shares equal to the app's split (DC1 ${o.dc1_dist_pct.join(' / ')} %; DC2 ${o.dc2_dist_pct.join(' / ')} %; DW ${o.dw_dist_pct.join(' / ')} %).`); }
    else { o.dc1_dist_mode = 'Equal'; o.dc2_dist_mode = 'Equal'; o.dw_dist_mode = 'Equal'; o.dc1_dist_pct = []; o.dc2_dist_pct = []; o.dw_dist_pct = [];
      A('Dead-load distribution: Equal in MIDAS; the app takes the deck by tributary width, so the DC1 per girder differs.'); }
    // live load, fatigue
    const an = P.analysis || {}, im = isNum(+an.im) && an.im !== '' && an.im != null ? +an.im : 33, imf = isNum(+an.imf) && an.imf !== '' && an.imf != null ? +an.imf : 15;
    o.moving_load_entries = clone(keep && Array.isArray(keep.moving_load_entries) && keep.moving_load_entries.length ? keep.moving_load_entries : o.moving_load_entries)
      .map(e => { const fat = /fatigue/i.test(String(e.classification || '')) || /FTG/i.test(String(e.vehicle_name || '')), hl = /^HL-?93/i.test(String(e.vehicle_name || ''));
        return fat ? { ...e, dyn_load_allowance: imf } : hl ? { ...e, dyn_load_allowance: im } : e; });
    W(`Live load: HL-93 IM ${im} %, fatigue IM ${imf} %.`);
    const F = P.fatigue || {}; o.ADTT_SL = Math.round(+F.ADTT * +F.p);
    W(`ADTT_SL = p × ADTT = ${F.p} × ${F.ADTT} = ${f(+F.ADTT * +F.p, 2)} → ${o.ADTT_SL}.`);
    if (Math.abs(o.ADTT_SL - +F.ADTT * +F.p) > 1e-6) A(`ADTT_SL rounded to a whole number (${f(+F.ADTT * +F.p, 3)} → ${o.ADTT_SL}).`);
    const worse = CATS.indexOf(F.catT) >= CATS.indexOf(F.catB) ? F.catT : F.catB; o.fatigue_detail_category = worse || 'C';
    if (F.catT !== F.catB) A(`Flange detail categories differ (top ${F.catT}, bottom ${F.catB}); MIDAS has one: the more severe, ${worse}.`);
    if (F.limit && F.limit !== 'auto') I(`The app's fatigue limit state is set to Fatigue ${F.limit}; MIDAS chooses by ADTT_SL.`);
    const lf = calc.lf, eta = +lf.eta || 1, mL = +lf.m || 1;
    o.load_combinations = clone(keep && Array.isArray(keep.load_combinations) && keep.load_combinations.length ? keep.load_combinations : o.load_combinations).map(cb => {
      const n = String(cb.name || '').toLowerCase();
      if (n === 'strength i') return { ...cb, dc: r4(1.25 * eta), dw: r4(1.5 * eta), ll: r4(1.75 * mL * eta) };
      if (n === 'service ii') return { ...cb, dc: 1.0, dw: 1.0, ll: r4(1.3 * mL) };
      if (n === 'fatigue i') return { ...cb, ll: +((F.gam || {}).fI) || 1.75 };
      if (n === 'fatigue ii') return { ...cb, ll: +((F.gam || {}).fII) || 0.8 };
      return cb; });
    W(`Load combinations: Strength I DC ${r4(1.25 * eta)}, DW ${r4(1.5 * eta)}, LL ${r4(1.75 * mL * eta)}; Service II LL ${r4(1.3 * mL)}; Fatigue I ${(F.gam || {}).fI}, Fatigue II ${(F.gam || {}).fII}.`);
    if (eta !== 1 || mL !== 1) A(`The owner's load modifier η = ${f(eta, 3)} and LL multiplier m = ${f(mL, 2)} are folded into the Strength I / Service II factors (MIDAS has no η field). The minimum factors and the other combinations are not changed.`);
    // LLDF
    const dfE = calc.df.ext, dfI = calc.df.int;
    const lldfFrom = (q, side) => { o[`lldf_user_${side}_M_1L`] = r4(q.fatM * 1.2); o[`lldf_user_${side}_M_2L`] = r4(q.gM); o[`lldf_user_${side}_V_1L`] = r4(q.fatV * 1.2); o[`lldf_user_${side}_V_2L`] = r4(q.gV); };
    if (opt.lldfUser && dfE && dfI) {
      o.lldf_mode = 'user'; lldfFrom(dfI, 'int'); lldfFrom(dfE, 'ext');
      const fromLga = q => q.pulled && q.pulled.basis === 'lga-user';
      const kk = k => keep && typeof keep[k] === 'boolean' ? keep[k] : false;
      o.apply_moment_skew_factor = fromLga(dfI) && fromLga(dfE) ? kk('apply_moment_skew_factor') : false;
      o.apply_shear_skew_factor = fromLga(dfI) && fromLga(dfE) ? kk('apply_shear_skew_factor') : false;
      W(`LLDF written as user-defined (the app's factors, every span${ns > 1 ? ' and pier' : ''} enveloped): interior M ${o.lldf_user_int_M_1L} / ${o.lldf_user_int_M_2L}, V ${o.lldf_user_int_V_1L} / ${o.lldf_user_int_V_2L}; exterior M ${o.lldf_user_ext_M_1L} / ${o.lldf_user_ext_M_2L}, V ${o.lldf_user_ext_V_1L} / ${o.lldf_user_ext_V_2L} (1 lane / 2+ lanes).`);
      I('User LLDF: "1 lane" = the app\'s fatigue factor × 1.2 (its governing one-lane factor with m = 1.2: lever rule or rigid method for the exterior girder); "2+ lanes" = the app\'s governing g (all lane cases, the rigid method and any pulled or entered factor). MIDAS then governs with max(1 lane, 2+ lanes) and takes fatigue as 1 lane / 1.2, the app\'s values. The app\'s factors already include the skew corrections, so the skew flags are written off.');
      if (ns > 1) A('MIDAS has one user factor per girder position for the whole bridge: the largest of the app\'s span and pier factors is written (conservative where the app\'s factors vary by span).');
    } else {
      o.lldf_mode = 'auto'; ['int', 'ext'].forEach(s => ['M_1L', 'M_2L', 'V_1L', 'V_2L'].forEach(k => { o[`lldf_user_${s}_${k}`] = keep && isNum(keep[`lldf_user_${s}_${k}`]) ? keep[`lldf_user_${s}_${k}`] : 0.0; }));
      o.apply_moment_skew_factor = true; o.apply_shear_skew_factor = (xs.lldf || {}).skewV !== 'ext';
      A('LLDF not written: MIDAS computes its own factors (they may differ from the app\'s, e.g. the rigid method with MIDAS\'s roadway).');
    }
    // cross-frames
    const fr = calc.frames, j0 = nb >= 3 ? 1 : 0;
    o.cross_frame_locations = fr[j0].map(r4);
    o.girder_cross_frame_locations_by_label = Object.fromEntries(labs.map((l, j) => [l, fr[j].map(r4)]));
    o.cross_frame_spacing = +((P.framing || {}).spacing) || (+(((P.stiffeners || {}).layout || {}).frames || {}).Lb) || 25;
    o.cross_frame_spacing_by_span = sup.slice(1).map((b, k) => { const a = sup[k], p = [a, ...fr[j0].filter(x => x > a + 1e-6 && x < b - 1e-6), b]; return r4(Math.max(...p.slice(1).map((x, i) => x - p[i]))); });
    o.girder_cross_frame_schedule_by_label = Object.fromEntries(labs.slice(1).map((l, i) => [l, schedule(fr[i + 1], sup)]));
    if (labs.some((_, j) => JSON.stringify(fr[j]) !== JSON.stringify(fr[j0]))) I('The app\'s cross-frame stations differ between girder lines (skewed or staggered framing); each girder\'s stations are written in girder_cross_frame_locations_by_label.');
    W(`Cross-frames at ${o.cross_frame_locations.map(x => f(x, 2)).join(', ') || 'none'} ft (${labs[j0]}), spacing by span ${o.cross_frame_spacing_by_span.join(', ')} ft.`);
    const cf = P.crossframes || {}, mem = cf.mem || {};
    if (!keep || !Array.isArray(keep.bracing_details) || !keep.bracing_details.length) {
      o.bracing_details = [{ ...o.bracing_details[0], brace_arrangement: cf.type === 'X' || !cf.type ? 'X Brace' : 'K Brace', top_section: (mem.top || {}).sec || 'L5x5x3/8', brace_section: (mem.diag || {}).sec || 'L5x5x3/8', bottom_section: (mem.bot || {}).sec || 'L5x5x3/8' }];
      if (cf.type && cf.type !== 'X') A(`Cross-frame type ${cf.type} written as "K Brace" (MIDAS's name for it is unverified).`);
    }
    o.bracing_section_set = [...new Set([o.bracing_details[0].top_section, o.bracing_details[0].brace_section, o.bracing_details[0].bottom_section].filter(Boolean))];
    const ang = k => (calc.orient[k] || (P.framing || {}).orient) === 'normal' ? 'Perpendicular' : 'Skew';
    const kba = keep && keep.bracing_assignment && typeof keep.bracing_assignment === 'object' ? keep.bracing_assignment : {};
    o.bracing_assignment = { enabled: true, spacing_mode: 'Divisions', different_per_bay: false, stagger_enabled: false, stagger_offset_ft: 0.0, ...clone(kba),
      rows: labs.slice(1).map((l, i) => { const st = fr[i + 1], k1 = [sup[0], ...st.filter(x => x < sup[1] - 1e-6), sup[1]].length - 1;
        return { bay_index: i, bracing_name: o.bracing_details[0].name || 'Bracing-1', spacing_mode: 'Divisions', divisions: k1, distances: o.girder_cross_frame_schedule_by_label[l], divisions_per_span: ns > 1 ? sup.slice(1).map((b, k) => [sup[k], ...st.filter(x => x > sup[k] + 1e-6 && x < b - 1e-6), b].length - 1).join(',') : '', angle_type: ang(0), angle: 0.0 }; }),
      support_bracing_enabled: kba.support_bracing_enabled != null ? kba.support_bracing_enabled : true, support_different_per_support: false,
      support_rows: sup.map((_, k) => ({ support_index: k, bracing_name: o.bracing_details[0].name || 'Bracing-1', angle_type: 'Skew' })) };
    // field splices
    const spl = ((P.framing || {}).splices || []).map(Number).filter(x => x > 0 && x < Lt);
    o.field_splice_locations = spl; o.field_splice_text = spl.map(x => f(x, 3)).join(', ');
    o.girder_field_splice_locations_by_label = Object.fromEntries(labs.map(l => [l, spl.slice()]));
    o.girder_field_splice_text_by_label = Object.fromEntries(labs.map(l => [l, o.field_splice_text]));
    W(`Field splices: ${spl.length ? spl.map(x => f(x, 2)).join(', ') + ' ft' : 'none'}.`);
    // studs
    const Q = P.studs || {};
    o.girder_connector_properties_by_label = Object.fromEntries(labs.map(l => [l, { stud_diameter: +Q.d, stud_height: +Q.h, fu: +Q.Fu, transverse_spacing: +Q.st }]));
    o.girder_connector_zones_by_label = Object.fromEntries(labs.map(l => [l, arr(Q.zones).map(z => ({ start_ft: +z.x1, end_ft: +z.x2, n_studs_per_row: Math.round(+z.nr), pitch: +z.p, transverse_spacing: +Q.st }))]));
    if (!arr(Q.zones).length) A('No stud pitch zones are entered in the app (Fatigue & studs): girder_connector_zones_by_label is empty; enter the studs in MIDAS.');
    W(`Studs: ${Q.d} × ${Q.h} in, F_u ${Q.Fu} ksi, ${Q.st} in across; ${arr(Q.zones).length} pitch zone(s).`);
    // stiffeners
    const T = (((P.stiffeners || {}).transverse || {}).types || {}).A || {}, gS = ((P.stiffeners || {}).transverse || {}).gS, fyS = M.GRADES[gS] ? M.GRADES[gS].Fy : 50;
    const stZone = x => ({ location_ft: x, start_ft: x, end_ft: x, length_ft: 0.0, stiffener_role: 'Transverse', stiffener_type: 'Flat', n_stiffeners: T.sides === '2' ? 2 : 1, fy: fyS, flat_b: +T.bt, flat_t: +T.tp, tee_h: 8.0, tee_b: 8.0, tee_tw: 0.5, tee_tf: 0.5 });
    o.girder_transverse_stiffener_zones_by_label = Object.fromEntries(labs.map((l, j) => [l, (calc.stiff[calc.typeOfLine[j]] || []).map(stZone)]));
    W(`Transverse stiffeners: ${T.bt} × ${T.tp} in at the app's intermediate stiffener stations of each girder type (${calc.stiff.map((s, gi) => `${P.girders[gi].label || P.girders[gi].id}: ${s.length}`).join(', ')}); connection plates and bearing stiffeners are not written.`);
    // deck pours
    const sq = an.seq !== 'off' && P.spans.continuity === 'continuous' && ns > 1, cust = String(an.seqCustom || '').split(/[,;]/).map(s => s.trim()).filter(Boolean).map(s => s.split('-').map(Number)).filter(q => q.length === 2 && q.every(isFinite) && q[1] > q[0]);
    if (sq && cust.length) { const rest = []; let x = 0; cust.slice().sort((a, b) => a[0] - b[0]).forEach(([a, b]) => { if (a > x + 1e-6) rest.push([x, a]); x = Math.max(x, b); }); if (x < Lt - 1e-6) rest.push([x, Lt]);
      o.deck_pour_sequence = { enabled: true, pours: [{ pour: 1, label: 'Pour 1', ranges: cust }, ...(rest.length ? [{ pour: 2, label: 'Pour 2', ranges: rest }] : [])] }; W(`Deck pours: pour 1 ${cust.map(r => r.join('–')).join(', ')} ft, pour 2 the rest.`); }
    else { o.deck_pour_sequence = { enabled: false, pours: [{ pour: 1, label: 'Pour 1', ranges: [[0.0, Lt]] }] };
      if (sq) A('The app\'s deck placement sequence uses its own pour regions (no pours entered); MIDAS\'s pour sequence is written off.'); }
    o.midas_url = '';
    if (ns > 1) I(UNVERIFIED);
    // the file, keys in the format's order
    const project = {}; KEYS.forEach(k => { project[k] = k in o ? o[k] : null; });
    const missing = KEYS.filter(k => !(k in o)); if (missing.length) A('Not written (no value): ' + missing.join(', '));
    const file = { version: '1.0', app: 'Line Girder Analysis', app_version: (P.midasLga && P.midasLga.appVersion) || '1.0.0', saved: new Date().toISOString(), project };
    const name = (String(pj.name || '').trim() || 'steel-bridge').replace(/[^\w.-]+/g, '_') + '.lga';
    return { ok: true, file, text: JSON.stringify(file, null, 2), name, summary: S };
  }
  /* reportText(report): the import report as plain text (the dialog's download) */
  function reportText(R, title) {
    const L = [title || 'MIDAS .lga import report', ''];
    L.push('FIELDS MAPPED (MIDAS value -> app input)'); R.mapped.forEach(m => L.push(`- [${m.sec}] ${m.lga}: ${m.from} -> ${m.app}: ${m.to}${m.conv ? `\n    conversion: ${m.conv}` : ''}`));
    L.push('', 'INCONSISTENCIES IN THE FILE'); (R.incons.length ? R.incons : [{ what: '—', detail: 'none found' }]).forEach(q => L.push(`- ${q.what}: ${q.detail}`));
    L.push('', 'NOT SUPPORTED / IGNORED'); R.ignored.forEach(q => L.push(`- ${q.lga} = ${q.value}: ${q.why}`));
    L.push('', 'NOTES'); R.info.forEach(t => L.push('- ' + t));
    if (R.errors && R.errors.length) { L.push('', 'INPUT ERRORS AFTER THE IMPORT'); R.errors.forEach(e => L.push(`- ${e.path}: ${e.msg}`)); }
    return L.join('\n');
  }
  window.SBDLga = { KEYS, BARS, UNVERIFIED, MAPPED_PREFIX, fromLga, exportCalc, toLga, reportText, bySpan, schedule };
})();
