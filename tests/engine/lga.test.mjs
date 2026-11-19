// apps/steel-bridge/engine/lga.js: MIDAS Line Girder Analysis (.lga) import and export (LGA, 2026-11-19).
// Made-up bridges only (no real project data): two .lga files written here to the format's 141 keys (1 span with a schedule per girder,
// 3 continuous spans with one schedule), and two app projects (1 span, 3 spans).
// 1. lga -> app -> lga: every field the import maps comes back with the same value (the unmapped MIDAS inputs too, from the file copy
//    the import keeps). Not compared: the dead-load distribution (the export writes the app's own split; the import does not map it),
//    the deck / haunch / self-weight override values (the export writes the app's own), Ec_override, use_material_overrides.
// 2. app -> lga -> app: the inputs the format carries come back; the distribution factors, n, cross-frame and stiffener stations the
//    app computes are the same before and after.
// 3. The export has all 141 keys in the format's order, midas_url empty; the import never stores midas_url; inconsistencies flagged.
import assert from 'node:assert/strict';
import path from 'node:path';
import { loadShared, test, ROOT } from './harness.mjs';

const ENG = f => path.join(ROOT, 'apps/steel-bridge/engine', f);
const W = loadShared('units.js', 'steps.js', 'vehicles.js', 'moving-load.js', ENG('model.js'), ENG('sections.js'), ENG('owners.js'), 'lldf.js', ENG('lldf.js'), ENG('loads.js'),
  ENG('flexure.js'), ENG('stiffeners.js'), ENG('framing.js'), ENG('crossframes.js'), ENG('analysis.js'), ENG('lga.js'));
const LG = W.SBDLga, M = W.SBDModel;
const J = o => JSON.parse(JSON.stringify(o));
const near = (a, b, t, m) => assert.ok(Math.abs(a - b) <= (t || 1e-9), `${m}: ${a} vs ${b}`);

/* a made-up .lga: nb girders, spans, plates per span (same for all, or per label), frames, splices, stiffeners */
function lga(o) {
  const nb = o.nb, labs = Array.from({ length: nb }, (_, j) => 'G' + (j + 1)), ns = o.spans.length, per = f => Object.fromEntries(labs.map((l, j) => [l, f(l, j)]));
  const segs = (plates) => plates.map((list, k) => list.map((q, i) => ({ label: `S${k + 1}-${i + 1}`, length: q[0], tf_w: q[1], tf_t: q[2], tf_fy: 50.0, web_d: q[3], web_t: q[4], web_fy: 50.0, bf_w: q[5], bf_t: q[6], bf_fy: 50.0, haunch: o.dh })));
  const sched = j => segs(o.platesOf ? o.platesOf(j) : o.plates), byLab = j => sched(j).flat().map(q => ({ label: q.label, length: q.length, tf_w: q.tf_w, tf_t: q.tf_t, web_d: q.web_d, web_t: q.web_t, bf_w: q.bf_w, bf_t: q.bf_t, haunch: q.haunch, tf_fy: q.tf_fy, web_fy: q.web_fy, bf_fy: q.bf_fy }));
  const Lt = o.spans.reduce((a, b) => a + b, 0), road = (nb - 1) * o.S + 2 * o.oh - 2 * o.bw;
  const zone = { start_ft: 0.0, end_ft: Lt, top_bar_size: '#6', top_spacing: o.sTop, top_cover: 2.5, bot_bar_size: '#5', bot_spacing: o.sBot, bot_cover: 1.0, fy: 60.0 };
  const p = {
    project_name: 'Made-up bridge ' + ns, designer: 'A. Designer', bridge_id: 'X-1', job_number: 'J-99', client_owner: 'Some DOT', location_route: 'Route 0', checked_by: 'B. Checker', approved_by: '', pe_license: '', report_date: '2026-01-02',
    revision: '1', revision_description: 'Test', revision_history: [{ rev: '1', date: '2026-01-02', description: 'Test', by: 'AD' }], code_edition: 'AASHTO LRFD Bridge Design Specifications, 9th Ed. (2020)',
    analysis_mode: 'Line Girder', lane_position_mode: 'Auto', design_lanes: [], num_spans: ns, span_lengths: o.spans.slice(), support_restraints: ['Pinned', ...o.spans.map(() => 'Roller')],
    skew_angle: o.skew, apply_moment_skew_factor: true, apply_shear_skew_factor: true, lldf_mode: 'user',
    lldf_user_int_M_1L: 0.41, lldf_user_int_M_2L: 0.56, lldf_user_int_V_1L: 0.62, lldf_user_int_V_2L: 0.77, lldf_user_ext_M_1L: 0.45, lldf_user_ext_M_2L: 0.52, lldf_user_ext_V_1L: 0.48, lldf_user_ext_V_2L: 0.55,
    element_length: 4.0, transverse_plate_size: 5.0, transverse_orientation: 'Skew', horizontal_radius_ft: 0.0, curve_direction: 'Concave', curvature_flange_lateral_N: 10.0,
    design_locations_by_span: o.spans.map(() => []), design_locations: [], field_splice_locations: o.spl.slice(), field_splice_text: o.spl.join(', '),
    girder_field_splice_locations_by_label: per(() => o.spl.slice()), girder_field_splice_text_by_label: per(() => o.spl.join(', ')), negative_moment_regions: [],
    segments: sched(nb > 2 ? 1 : 0), girder_schedule_same_all: !o.platesOf, girder_segments_by_label: per((l, j) => byLab(j)), girder_segments_by_span: per((l, j) => sched(j).map(s => s.map(q => ({ label: q.label, length: q.length, tf_w: q.tf_w, tf_t: q.tf_t, web_d: q.web_d, web_t: q.web_t, bf_w: q.bf_w, bf_t: q.bf_t, haunch: q.haunch, tf_fy: q.tf_fy, web_fy: q.web_fy, bf_fy: q.bf_fy })))),
    girder_segments_by_span_stash: per(() => ({})), girder_design_locations_by_label: per(() => []),
    num_girders: nb, girder_spacing: o.S, deck_overhang: o.oh, roadway_width: road, barrier_width: o.bw, cross_frame_spacing: o.cfs, cross_frame_spacing_by_span: o.spans.map(() => o.cfs), cross_frame_locations: o.cf.slice(),
    t_deck: 8.5, t_wear_integral: 0.5, d_haunch: o.dh, haunch_width: 16.0, top_rebar_area: 0.44, top_rebar_spacing: o.sTop, top_rebar_cover: 2.5, fy_rebar: 60.0, bot_rebar_area: 0.31, bot_rebar_spacing: o.sBot, bot_rebar_cover: 1.0,
    Fy_steel: 50.0, fc_concrete: 4.0, wc_concrete: 0.145, use_material_overrides: true, Es_override: 29000.0, Ec_override: 3600.0, n_override: 8.0, es_override_enabled: false, ec_override_enabled: false, n_override_enabled: true,
    w_parapet: 0.45, n_parapets: 2, w_fws_ksf: 0.03, w_crossframes: 0.2, w_misc: 0.015, w_deckforms: 0.012, w_utilities: 0.02,
    girder_self_weight_apply: true, girder_self_weight_override_enabled: false, girder_self_weight_override_klf: 0.2, deck_apply: true, deck_override_enabled: false, deck_override_klf: 4.0,
    haunch_apply: true, haunch_override_enabled: false, haunch_override_klf: 0.03, barrier_apply: true, barrier_override_enabled: false, barrier_override_klf: 0.0, fws_apply: true, fws_override_enabled: false, fws_override_klf: 0.0,
    dc1_dist_mode: 'Equal', dc2_dist_mode: 'Equal', dw_dist_mode: 'Equal', dc1_dist_pct: [], dc2_dist_pct: [], dw_dist_pct: [], ADTT_SL: 1600, fatigue_detail_category: "C'",
    moving_load_entries: [
      { entry_key: 'aashto-lrfd-hl-93tdm', standard_code: 'AASHTO-LRFD', standard_display: 'AASHTO LRFD', vehicle_name: 'HL-93TDM', vehicle_type_name: 'HL-93TDM', classification: 'Inventory', dyn_load_allowance: 33.0, cent_f: false, weight_kips: 50.0, catalog_source: 'Built-in catalog', mvld_code: 2, vehicle_load_num: 1, user_load_type: '', uniform_load_klf: 0.0, axles: [] },
      { entry_key: 'aashto-lrfd-hl-93trk', standard_code: 'AASHTO-LRFD', standard_display: 'AASHTO LRFD', vehicle_name: 'HL-93TRK', vehicle_type_name: 'HL-93TRK', classification: 'Inventory', dyn_load_allowance: 33.0, cent_f: false, weight_kips: 72.0, catalog_source: 'Built-in catalog', mvld_code: 2, vehicle_load_num: 1, user_load_type: '', uniform_load_klf: 0.0, axles: [] },
      { entry_key: 'aashto-lrfd-hs20-ftg', standard_code: 'AASHTO-LRFD', standard_display: 'AASHTO LRFD', vehicle_name: 'HS20-FTG', vehicle_type_name: 'HS20-FTG', classification: 'Fatigue', dyn_load_allowance: 15.0, cent_f: false, weight_kips: 72.0, catalog_source: 'Built-in catalog', mvld_code: 2, vehicle_load_num: 1, user_load_type: '', uniform_load_klf: 0.0, axles: [] }],
    moving_load_available_entries: [], moving_load_custom_lists: {}, moving_load_active_list_label: 'AASHTO LRFD Starter', design_pt_node_target: false, design_pt_splice: false, design_pt_user: false,
    girder_design_point_types_by_label: per(() => ({ node_target: true, splice: false, user: true })),
    load_combinations: [{ name: 'Strength I', active: true, type: 'strength', dc: 1.25, dw: 1.5, ll: 1.75, ll_source: 'LL' }, { name: 'Strength III', active: true, type: 'strength', dc: 1.25, dw: 1.5, ll: 0.0, ll_source: 'LL' },
      { name: 'Service II', active: true, type: 'service', dc: 1.0, dw: 1.0, ll: 1.3, ll_source: 'LL' }, { name: 'Fatigue I', active: true, type: 'fatigue', dc: 0.0, dw: 0.0, ll: 1.75, ll_source: 'Fatigue' }, { name: 'Fatigue II', active: true, type: 'fatigue', dc: 0.0, dw: 0.0, ll: 0.8, ll_source: 'Fatigue' }],
    design_phi_y: 0.95, design_phi_u: 0.8, design_phi_c: 0.9, design_phi_f: 1.0, design_phi_v: 1.0, design_phi_sc: 0.85, design_phi_b: 1.0, design_use_appendix_a6: true,
    girder_cross_frame_locations_by_label: per(() => o.cf.slice()), girder_cross_frame_schedule_by_label: Object.fromEntries(labs.slice(1).map(l => [l, ''])),
    bracing_details: [{ name: 'Bracing-1', bracing_type: 'Bracing', element_type: 'Truss', brace_arrangement: 'X Brace', top_chord: true, top_section: 'L4x4x1/2', brace: true, brace_section: 'L4x4x3/8', bottom_chord: true, bottom_section: 'L4x4x1/2', single_beam_section: 'C15X33.9', top_gap_ft: 0.0, bottom_gap_ft: 0.0 }],
    bracing_assignment: { enabled: true, spacing_mode: 'Divisions', different_per_bay: false, stagger_enabled: false, stagger_offset_ft: 0.0, rows: [], support_bracing_enabled: true, support_different_per_support: false, support_rows: [] },
    bracing_user_sections: [], bracing_section_set: ['L4x4x1/2', 'L4x4x3/8'], deck_pour_sequence: { enabled: false, pours: [{ pour: 1, label: 'Pour 1', ranges: [[0.0, Lt]] }] },
    girder_connector_properties_by_label: per(() => ({ stud_diameter: 0.875, stud_height: 6.0, fu: 60.0, transverse_spacing: 4.5 })),
    girder_connector_zones_by_label: per(() => o.studs.map(z => ({ start_ft: z[0], end_ft: z[1], n_studs_per_row: z[2], pitch: z[3], transverse_spacing: 4.5 }))),
    girder_connector_neg_composite_by_label: per(() => false),
    girder_transverse_stiffener_zones_by_label: per(() => o.stiff.map(x => ({ location_ft: x, start_ft: x, end_ft: x, length_ft: 0.0, stiffener_role: 'Transverse', stiffener_type: 'Flat', n_stiffeners: 1, fy: 50.0, flat_b: 7.0, flat_t: 0.5, tee_h: 8.0, tee_b: 8.0, tee_tw: 0.5, tee_tf: 0.5 }))),
    girder_rebar_zones_by_label: per(() => [{ ...zone }]), girder_rebar_runs_by_label: per(() => [{ length_ft: Lt, top_bar_size: '#6', top_spacing: o.sTop, top_cover: 2.5, bot_bar_size: '#5', bot_spacing: o.sBot, bot_cover: 1.0, fy: 60.0 }]),
    midas_url: 'https://example.invalid/civil'
  };
  return { version: '1.0', app: 'Line Girder Analysis', app_version: '1.0.0', saved: '2026-01-02T00:00:00Z', project: p };
}
// 1 span, 5 girders, the exterior girders heavier (a schedule per girder)
const ONE = lga({ nb: 5, spans: [80], skew: 15, S: 9.0, oh: 3.0, bw: 1.5, dh: 3.0, sTop: 6.0, sBot: 9.0, cfs: 20, cf: [20, 40, 60], spl: [], studs: [[0, 20, 3, 9.0], [20, 60, 3, 12.0], [60, 80, 3, 9.0]], stiff: [10, 30, 50, 70],
  plates: [[[80, 16, 1.0, 42, 0.5, 18, 1.25]]], platesOf: j => j === 0 || j === 4 ? [[[80, 16, 1.25, 42, 0.5, 18, 1.5]]] : [[[80, 16, 1.0, 42, 0.5, 18, 1.25]]] });
// 3 continuous spans, 6 girders, one schedule with pier sections, field splices
const THREE = lga({ nb: 6, spans: [100, 125, 100], skew: 0, S: 8.0, oh: 2.5, bw: 1.75, dh: 3.5, sTop: 5.0, sBot: 8.0, cfs: 25, cf: [25, 50, 75, 125, 150, 175, 200, 250, 275, 300], spl: [80, 245],
  studs: [[0, 80, 3, 10.0], [80, 245, 3, 8.0], [245, 325, 3, 10.0]], stiff: [12.5, 85, 95, 112.5, 212.5, 312.5],
  plates: [[[80, 16, 1.0, 54, 0.5625, 18, 1.25], [20, 18, 1.75, 54, 0.5625, 20, 2.0]], [[20, 18, 1.75, 54, 0.5625, 20, 2.0], [85, 16, 1.0, 54, 0.5625, 18, 1.25], [20, 18, 1.75, 54, 0.5625, 20, 2.0]], [[20, 18, 1.75, 54, 0.5625, 20, 2.0], [80, 16, 1.0, 54, 0.5625, 18, 1.25]]] });

const MAPPED = ['project_name', 'designer', 'job_number', 'client_owner', 'checked_by', 'report_date', 'num_spans', 'span_lengths', 'skew_angle', 'num_girders', 'girder_spacing', 'deck_overhang', 'roadway_width', 'barrier_width',
  't_deck', 't_wear_integral', 'd_haunch', 'top_rebar_area', 'top_rebar_spacing', 'top_rebar_cover', 'fy_rebar', 'bot_rebar_area', 'bot_rebar_spacing', 'bot_rebar_cover', 'Fy_steel', 'fc_concrete', 'wc_concrete',
  'n_override', 'n_override_enabled', 'w_parapet', 'n_parapets', 'w_fws_ksf', 'w_crossframes', 'w_misc', 'w_deckforms', 'w_utilities', 'ADTT_SL', 'fatigue_detail_category', 'lldf_mode',
  'lldf_user_int_M_1L', 'lldf_user_int_M_2L', 'lldf_user_int_V_1L', 'lldf_user_int_V_2L', 'lldf_user_ext_M_1L', 'lldf_user_ext_M_2L', 'lldf_user_ext_V_1L', 'lldf_user_ext_V_2L', 'apply_moment_skew_factor', 'apply_shear_skew_factor',
  'segments', 'girder_schedule_same_all', 'girder_segments_by_label', 'girder_segments_by_span', 'cross_frame_spacing', 'cross_frame_spacing_by_span', 'cross_frame_locations', 'girder_cross_frame_locations_by_label',
  'field_splice_locations', 'girder_field_splice_locations_by_label', 'girder_connector_properties_by_label', 'girder_connector_zones_by_label', 'girder_rebar_zones_by_label', 'girder_rebar_runs_by_label', 'moving_load_entries',
  // kept (not modelled): the file copy written back
  'bridge_id', 'location_route', 'revision', 'revision_description', 'revision_history', 'code_edition', 'element_length', 'design_locations_by_span', 'girder_design_point_types_by_label', 'design_use_appendix_a6',
  'design_phi_sc', 'girder_segments_by_span_stash', 'girder_connector_neg_composite_by_label', 'haunch_width', 'bracing_details'];
const deepNear = (a, b, p) => { if (typeof a === 'number' && typeof b === 'number') { near(a, b, 1e-4 * Math.max(1, Math.abs(a)), p); return; }
  if (Array.isArray(a)) { assert.ok(Array.isArray(b) && a.length === b.length, `${p}: ${JSON.stringify(a)} vs ${JSON.stringify(b)}`); a.forEach((v, i) => deepNear(v, b[i], `${p}[${i}]`)); return; }
  if (a && typeof a === 'object') { assert.ok(b && typeof b === 'object', `${p}: object expected`); Object.keys(a).forEach(k => deepNear(a[k], b[k], `${p}.${k}`)); assert.deepEqual(Object.keys(b).sort(), Object.keys(a).sort(), `${p}: keys`); return; }
  assert.equal(b, a, p); };
const imp = (f, o) => { const r = LG.fromLga(J(f), { fileName: 'test.lga', now: '2026-01-02T00:00:00Z', ...(o || {}) }); assert.ok(r.ok, r.error); return r; };
const exp = (P, o) => { const c = LG.exportCalc(P); assert.deepEqual(J(c.errors), []); const r = LG.toLga(P, o || {}, c); assert.ok(r.ok, r.error); return { ...r, calc: c }; };

for (const [nm, F] of [['1 span, schedule per girder', ONE], ['3 continuous spans', THREE]]) {
  test(`lga -> app -> lga reproduces the mapped fields (${nm})`, () => {
    const r = imp(F), P = r.project;
    assert.deepEqual(J(r.report.errors), [], 'the imported project has no input errors');
    assert.ok(!JSON.stringify(P).includes('example.invalid'), 'midas_url is not stored');
    assert.ok(!r.report.incons.some(q => q.what === 'Cross-frames'), 'the app\'s framing reproduces the stations: ' + JSON.stringify(r.report.incons));
    assert.equal(r.report.info.includes(LG.UNVERIFIED), F.project.num_spans > 1, 'multi-span note');
    const e = exp(P), out = e.file.project;
    assert.deepEqual(Object.keys(out), J(LG.KEYS), 'all 141 keys in the format order');
    assert.equal(LG.KEYS.length, 141); assert.equal(out.midas_url, '');
    // the stiffener stations come back (girder_transverse_stiffener_zones_by_label: the locations and the plate)
    Object.keys(F.project.girder_transverse_stiffener_zones_by_label).forEach(l => deepNear(F.project.girder_transverse_stiffener_zones_by_label[l].map(z => [z.location_ft, z.flat_b, z.flat_t, z.n_stiffeners, z.fy]),
      out.girder_transverse_stiffener_zones_by_label[l].map(z => [z.location_ft, z.flat_b, z.flat_t, z.n_stiffeners, z.fy]), 'stiffeners ' + l));
    MAPPED.forEach(k => {
      if (k === 'load_combinations') return;
      deepNear(F.project[k], out[k], k); });
    ['Strength I', 'Service II', 'Fatigue I', 'Fatigue II'].forEach(n => { const a = F.project.load_combinations.find(c => c.name === n), b = out.load_combinations.find(c => c.name === n); deepNear(a, b, n); });
  });
}

test('lga import: the conversions (haunch, deck, rebar, n, ADTT, LLDF) and the girder types', () => {
  const r = imp(ONE), P = r.project;
  near(P.deck.ts, 8.5, 1e-12, 't_s'); near(P.deck.tdeck, 9.0, 1e-12, 'total deck');
  near(P.deck.haunch, 3.0 - 1.25, 1e-12, 'haunch above the thickest top flange');   // d_haunch 3.0 from the top of the web, thickest top flange 1.25
  near(P.deck.rebar.top.A, Math.floor(108 / 6) * 0.44, 1e-9, 'A_top'); near(P.deck.rebar.top.c, 2.5 + 0.375, 1e-12, 'c_top');   // b_eff 9 × 12 = 108 in: 18 #6
  near(P.deck.rebar.bot.A, 12 * 0.31, 1e-9, 'A_bot'); near(P.deck.rebar.bot.c, 1.3125, 1e-12, 'c_bot');   // floor(108 / 9) = 12 #5
  const n = 29000 / (120000 * P.materials.concrete.wcE ** 2 * 4 ** 0.33); near(n, 8, 1e-5, 'n through w_c for E_c');
  near(P.fatigue.ADTT, 2000, 1e-9, 'ADTT = 1600 / 0.80'); near(P.fatigue.p, 0.8, 0, 'p, 3 lanes on 39 ft');
  assert.equal(P.girders.length, 2); assert.deepEqual(J(P.girders.map(g => [g.label, g.position, g.lines])), [['Interior', 'interior', [1, 2, 3]], ['Exterior', 'exterior', [0, 4]]]);
  near(P.girders[1].beff, (4.5 + 3) * 12, 1e-9, 'exterior b_eff');
  const pu = P.girders[0].dfPull; near(pu.spans[0].gM, 0.56, 1e-12, 'g_M'); near(pu.spans[0].fatM, 0.41 / 1.2, 1e-6, 'fatigue g_M'); near(pu.spans[0].gV, 0.77, 1e-12, 'g_V');
  assert.deepEqual(J(P.stiffeners.layout.bays.filter(b => b.g === 1)), [{ g: 1, a: 0, b: 20, n: 1, e0: 120, e1: 0 }, { g: 1, a: 20, b: 40, n: 1, e0: 120, e1: 0 }, { g: 1, a: 40, b: 60, n: 1, e0: 120, e1: 0 }, { g: 1, a: 60, b: 80, n: 1, e0: 120, e1: 0 }]);
  assert.equal(P.framing.orient, 'parallel');
});

test('lga import flags inconsistencies inside the file', () => {
  const F = J(ONE), p = F.project;
  p.roadway_width = 30; p.segments[0][0].haunch = 4.0; p.girder_segments_by_label.G2[0].haunch = 4.0; p.bot_rebar_area = 0.44;
  p.dc1_dist_mode = 'Custom'; p.dc1_dist_pct = [20, 20, 20, 20, 20]; p.moving_load_entries[2].dyn_load_allowance = 20; p.moving_load_entries[0].dyn_load_allowance = 30; p.moving_load_entries[1].dyn_load_allowance = 30;
  p.girder_segments_by_span.G2[0][0].haunch = 4.0;
  const r = imp(F), t = r.report.incons.map(q => q.what + ': ' + q.detail).join('\n');
  [/Roadway width: roadway_width = 30 ft/, /Haunch: The segments' haunch/, /Bottom layer: the project fields say 0\.44/, /DC1 distribution: MIDAS custom DC1 shares/, /HL-93 IM = 30 %/, /Fatigue IM = 20 %/].forEach(re => assert.match(t, re));
  assert.ok(r.report.ignored.some(q => q.lga === 'midas_url'), 'midas_url listed as not stored');
  assert.ok(r.report.mapped.length > 30);
});

test('lga import of a file that is not .lga, or without spans, changes nothing', () => {
  assert.equal(LG.fromLga({ app: 'Other', project: {} }).ok, false);
  const F = J(ONE); F.project.span_lengths = []; assert.equal(LG.fromLga(F).ok, false);
});

/* app -> lga -> app */
function appProject(ns) {
  const P = M.newProject();
  P.project.name = 'Round trip ' + ns;
  if (ns === 1) { P.spans.lengths = [90]; P.spans.continuity = 'simple'; }
  P.xs = M.defaultXs(P); P.xs.nb = 5; P.xs.bays = [9.5, 9.5, 9.5, 9.5]; P.xs.ohL = 3.25; P.xs.ohR = 3.25; P.xs.skews = P.xs.skews.map(() => 10); P.xs.allow = 0; P.xs.dlMethod = 'aashto'; P.xs.ws.psf = 25;
  P.girders.forEach(g => { g.line = g.position === 'exterior' ? 0 : 1; g.lines = g.position === 'exterior' ? [0, 4] : [1, 2, 3]; });
  P.girders[1].beff = M.tribBeff(P.xs, 0);
  if (ns === 1) P.girders.forEach(g => { g.segments = [{ x0: 0, x1: 90, D: 48, tw: 0.5, topB: 16, topT: 1.0, botB: 18, botT: 1.25 }]; });
  P.materials.steel = { top: '50', web: '50', bot: '50' };
  P.deck.ts = 8.0; P.deck.tdeck = 8.5; P.deck.haunch = 2.0; P.deck.rebar = { top: { A: 19 * 0.31, c: 2.5 + 0.3125 }, bot: { A: 12 * 0.31, c: 1.0 + 0.3125 } };
  P.crossframes.weight.mode = 'off'; P.framing.spacing = 22.5; P.framing.orient = 'parallel'; P.framing.splices = ns === 1 ? [] : [82, 278];
  P.fatigue.ADTT = 2500; P.fatigue.p = 0.8; P.fatigue.catT = 'C'; P.fatigue.catB = 'C';
  P.studs.zones = [{ x1: 0, x2: ns === 1 ? 90 : 360, nr: 3, p: 9 }];
  P.analysis = { ...(P.analysis || {}), im: 33, imf: 15, seq: 'off' };
  return P;
}
for (const ns of [1, 3]) {
  test(`app -> lga -> app reproduces the inputs (${ns} span${ns > 1 ? 's' : ''})`, () => {
    const P1 = appProject(ns); assert.deepEqual(J(M.validate(P1).errors), []);
    const e1 = exp(P1), r = imp(e1.file), P2 = r.project;
    assert.deepEqual(J(r.report.errors), []);
    const pick = P => ({ spans: P.spans.lengths, nb: P.xs.nb, bays: P.xs.bays, oh: [P.xs.ohL, P.xs.ohR], skews: P.xs.skews, bw: [P.xs.edges.L.bw, P.xs.edges.R.bw], bwt: [P.xs.edges.L.bwt, P.xs.edges.R.bwt],
      deck: [P.deck.ts, P.deck.tdeck, P.deck.haunch, P.deck.rebar.top.A, P.deck.rebar.top.c, P.deck.rebar.bot.A, P.deck.rebar.bot.c], steel: P.materials.steel, conc: [P.materials.concrete.fc, P.materials.concrete.wc], Fyr: P.materials.rebar.Fyr,
      girders: P.girders.map(g => [g.position, g.lines, g.beff, g.segments]), ws: P.xs.ws.psf, sip: P.xs.sip, allow: P.xs.allow, fat: [P.fatigue.ADTT, P.fatigue.p, P.fatigue.catT, P.fatigue.catB, P.fatigue.gam.fI, P.fatigue.gam.fII],
      im: [P.analysis.im, P.analysis.imf], studs: [P.studs.d, P.studs.h, P.studs.Fu, P.studs.st, P.studs.zones], framing: [P.framing.spacing, P.framing.splices] });
    deepNear(pick(P1), pick(P2), 'inputs');
    // computed values the format carries: the distribution factors, n, cross-frame and stiffener stations are the same
    const c1 = e1.calc, c2 = LG.exportCalc(P2);
    ['ext', 'int'].forEach(s => ['gM', 'gV', 'fatM', 'fatV'].forEach(k => near(c2.df[s][k], c1.df[s][k], 1e-4, `${s} ${k}`)));
    near(c2.n, c1.n, 1e-5, 'n'); deepNear(c1.frames, c2.frames, 'frames'); deepNear(c1.stiff, c2.stiff, 'stiffener stations');
    // and the second export writes the same file (but the saved time)
    const e2 = exp(P2); MAPPED.forEach(k => { if (!['bridge_id', 'location_route', 'revision', 'revision_description', 'revision_history', 'report_date', 'girder_design_point_types_by_label', 'girder_segments_by_span_stash', 'design_locations_by_span', 'element_length', 'code_edition', 'design_use_appendix_a6', 'design_phi_sc', 'girder_connector_neg_composite_by_label', 'haunch_width', 'bracing_details'].includes(k)) deepNear(e1.file.project[k], e2.file.project[k], 'second export ' + k); });
  });
}

test('export options off: auto LLDF, MIDAS n, Equal distribution', () => {
  const P = appProject(1), e = exp(P, { lldfUser: false, nExplicit: false, dlCustom: false }), o = e.file.project;
  assert.equal(o.lldf_mode, 'auto'); assert.equal(o.n_override_enabled, false); assert.equal(o.use_material_overrides, false); assert.equal(o.dc1_dist_mode, 'Equal');
  assert.ok(e.summary.approx.some(t => /LLDF not written/.test(t)));
  const e2 = exp(P), o2 = e2.file.project;
  assert.equal(o2.lldf_mode, 'user'); assert.equal(o2.dc1_dist_mode, 'Custom'); near(o2.dc1_dist_pct.reduce((a, b) => a + b, 0), 100, 1e-3, 'DC1 shares add to 100 %');
  assert.equal(o2.deck_override_enabled, true, 'integral wearing surface: the deck weight written as an override');
});

test('app -> lga -> app with the MassDOT pile-cap rule: the barrier inputs come back; MIDAS gets the app\'s DC2 per girder through the override', () => {
  const P1 = appProject(1); P1.xs.dlMethod = 'massdot';
  const e = exp(P1), o = e.file.project, c = e.calc;
  assert.equal(o.barrier_override_enabled, true); near(o.barrier_override_klf, c.dl.dc2.reduce((a, b) => a + b, 0), 1e-4, 'override = the sum of the app\'s DC2 shares');
  deepNear(o.dc2_dist_pct, c.dl.dc2.map(v => 100 * v / c.dl.dc2.reduce((a, b) => a + b, 0)), 'DC2 shares');
  const P2 = imp(e.file).project; near(P2.xs.edges.L.bwt, P1.xs.edges.L.bwt, 1e-12, 'barrier weight'); near(P2.xs.edges.R.bwt, P1.xs.edges.R.bwt, 1e-12, 'barrier weight R');
});
