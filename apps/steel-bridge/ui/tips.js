/* apps/steel-bridge/ui/tips.js — help tooltips on the key inputs of Steel Bridge Design (window.SBDTips). Classic script.
   Added 2026-11-24 (engineer's choice "Key inputs only"). DISPLAY ONLY: nothing is read from or written to the project, no stored key,
   no result changes; the page works the same without this file.

   How it works: TIPS lists the inputs by element id (or a CSS selector for a group heading). A MutationObserver on the page puts a
   small "?" button at the end of each listed input's label (label[for=id]) whenever the label is drawn; the tabs re-render freely and
   the button follows. The button has no text (the "?" is CSS), so the label's text is unchanged. The help text shows in one floating
   box (position: fixed, so nothing on the page moves): on hover (mouse), on keyboard focus (Tab), and on a click or tap (stays open
   until a second click or tap, Escape, or a tap elsewhere). Each text says what the input means, its units, the default, where it is
   used, and the governing article (AASHTO LRFD 10th Ed. (2024); MBE 4th Ed. (2026)), paraphrased. Defaults and uses were read from
   engine/model.js, engine/analysis.js, engine/deck.js, ui/rating.js and the modules named in each text (fixlog/steel-bridge.md, TIP). */
(function () {
  'use strict';
  const L = 'AASHTO LRFD 10th Ed.', MBE = 'MBE 4th Ed.';
  /* each: id (the input's id) or sel (a CSS selector; the button goes at the end of that element) or after (a selector; the button goes
     right after that element); h: the name shown in bold; t: what it is; u: units; d: default; w: where it is used; r: reference */
  const TIPS = [
    // ---- live-load distribution (Loads input tab, Distribution card) ----
    { id: 'i_xs.lldf.gap', h: 'Gap between adjacent trucks', t: 'Clear transverse distance between the nearest wheels of two side-by-side design trucks (6 ft gauge each) when two or more trucks are placed side by side for the lever rule. At least 4 ft.', u: 'ft', d: '4 ft', w: 'Live-load distribution factors (Loads & LLDF tab): the lever rule with two or more trucks (exterior girders, and girders outside the equations\' range).', r: `${L} Arts. 3.6.1.3.1, 4.6.2.2.2d` },
    { id: 'i_xs.lldf.kg', h: 'K_g', t: 'Longitudinal stiffness parameter K_g = n(I + A e_g²) of each region: at the region\'s own section (default), length-weighted over the plate pieces of the region, or the simplified terms of Table 4.6.2.2.1-3 in place of the K_g terms.', u: 'in⁴', d: 'At the region section', w: 'Moment distribution factors and the skew corrections (Loads & LLDF tab).', r: `${L} Eq. 4.6.2.2.1-1, Table 4.6.2.2.1-3` },
    { id: 'i_xs.lldf.skewV', h: 'Shear skew correction', t: 'Which girders take the shear skew correction factor r_V of Table 4.6.2.2.3c-1: every girder (default; the end shear of a multi-girder bridge) or the exterior girders only.', u: '—', d: 'All girders', w: 'Shear distribution factors g_V and the fatigue shear factor (Loads & LLDF tab), then the shear, bearing stiffener and stud checks.', r: `${L} Art. 4.6.2.2.3c` },
    { id: 'i_xs.lldf.skewVx', h: 'Shear skew correction along the girder', t: 'Extent of r_V along each span: over the whole length (default, conservative) or tapered, full at each support and decreasing linearly to 1.0 at mid-span, as the article permits.', u: '—', d: 'Whole length', w: 'Shear distribution along the girder in the Analysis (shear envelopes, shear and stud checks); no effect where r_V = 1.0.', r: `${L} Art. 4.6.2.2.3c` },
    { id: 'i_xs.lldf.extMin', h: 'Exterior not less than interior', t: 'Yes raises the exterior girder\'s moment and shear distribution factors to the interior girder\'s where those are larger (an owner or engineer policy, not an AASHTO requirement).', u: '—', d: 'No', w: 'Distribution factors of the exterior girders (Loads & LLDF tab, marked "raised to interior").', r: 'Policy; the factors themselves: ' + L + ' Art. 4.6.2.2' },
    { id: 'i_xs.dlMethod', h: 'Dead load distribution', t: 'How the superimposed dead loads (barriers, sidewalks, wearing surface, utilities) are shared among the girders: MassDOT 3.5.3 (default), all girders equally, or RIDOT BDM 3.3.1.', u: '—', d: 'MassDOT 3.5.3', w: 'DC2, DW, UT and UF of each girder (Loads & LLDF tab), then the Analysis.', r: `${L} Art. 4.6.2.2.1; MassDOT LRFD BDM 3.5.3; RIDOT BDM 3.3.1` },
    { id: 'an_a_im', h: 'IM, truck and tandem', t: 'Dynamic load allowance on the design truck and tandem (not on the lane load). Blank uses 33 %.', u: '%', d: '33 %', w: 'Live-load envelopes of the Analysis, so every Strength and Service check and the HL-93 rating.', r: `${L} Table 3.6.2.1-1` },
    { id: 'an_a_imf', h: 'IM, fatigue truck', t: 'Dynamic load allowance on the fatigue truck. Blank uses 15 %.', u: '%', d: '15 %', w: 'Fatigue stress ranges (Fatigue & studs) and the stud pitch.', r: `${L} Table 3.6.2.1-1` },
    { id: 'an_a_crack', h: 'Cracked zones', t: 'Where the deck is taken as cracked (not effective) in the stiffness of the continuous-girder analysis: none, 15 % of the spans each side of each pier, or the negative dead-load moment region.', u: '—', d: 'None', w: 'Analysis stiffness (moments, shears, reactions) and the Deflection tab.', r: `${L} Art. 6.10.1.5` },
    { id: 'i_xs.allow', h: 'Steel detail allowance', t: 'Percentage added to the girder steel weight for stiffeners, connection plates, splices and other details.', u: '%', d: '5 %', w: 'Girder steel weight in DC1 (Loads & LLDF tab, Analysis), the splice shipping weight (SP3) and the shipping pieces of the erection drawing. While the loads module gives it, the Analysis settings show it read-only in place of their own detail allowance.', r: `${L} Table 3.5.1-1 (steel 0.490 kcf)` },
    // ---- pedestrian and utility loads, deflection ----
    { id: 'i_xs.sidewalks.ped', h: 'Pedestrian load', t: 'Pedestrian live load on the sidewalks (AASHTO: 75 psf on a sidewalk wider than 2 ft, with the vehicular live load). 0 = none.', u: 'psf', d: '0 psf', w: 'PL line loads on the sidewalk widths, distributed to the girders (Loads & LLDF tab), in the live-load combinations.', r: `${L} Art. 3.6.1.6` },
    { after: 'button[data-xsact="addExtra"]', h: 'Utilities and other line loads', t: 'Line loads along the bridge at x from the left deck edge, by category: DC1, DC2, DW, PL, UT (existing utilities) or UF (future utilities). UT and UF act on the noncomposite section.', u: 'x ft, w klf', d: 'None', w: 'Dead loads of each girder (Loads & LLDF tab) and the Analysis.', r: 'MassDOT LRFD BDM 3.5.5 (utilities); ' + L + ' Art. 3.5.1' },
    { id: 'an_a_deflLimit', h: 'LL deflection limit L/…', t: 'Optional live-load deflection criterion span / (this number), checked with all girders deflecting equally. The owner rule (Project tab owner) governs where it is stricter.', u: 'L/…', d: 'L/800', w: 'Deflection tab and the Summary.', r: `${L} Art. 2.5.2.6.2` },
    { id: 'an_a_deflSidewalk', h: 'Sidewalk or pedestrians (deflection)', t: 'Whether the bridge carries pedestrians for the owner\'s live-load deflection limit (e.g. L/1000 in place of L/800). Automatic: yes when the Cross-section tab has a sidewalk.', u: '—', d: 'Automatic', w: 'Owner deflection rule on the Deflection tab (OWN19); no effect for AASHTO.', r: `${L} Art. 2.5.2.6.2; owner manual` },
    // ---- owner settings (Project tab) ----
    { id: 'i_ownerRules.owner', h: 'Client / owner (DOT)', t: 'Whose design rules apply on top of AASHTO: load modifiers, design load multiplier, deflection limits, haunch rule, fatigue and bracing rules. AASHTO = no owner rules.', u: '—', d: 'AASHTO', w: 'Owner load rules (η, m, haunch) on the Loads & LLDF tab and the Report; owner checks on the tabs that have them.', r: 'Owner bridge design manual; ' + L },
    { id: 'i_ownerRules.eta.eD', h: 'η_D (ductility)', t: 'Load modifier for ductility. 1.00 for conventional designs; the product η = η_D η_R η_I multiplies the maximum load factors (its inverse the minimum ones).', u: '—', d: '1.00', w: 'Strength limit-state load factors (Loads & LLDF tab), every Strength check.', r: `${L} Arts. 1.3.2.1, 1.3.3` },
    { id: 'i_ownerRules.eta.eR', h: 'η_R (redundancy)', t: 'Load modifier for redundancy. 1.00 for conventional redundancy; larger for nonredundant members.', u: '—', d: '1.00', w: 'Strength limit-state load factors, every Strength check.', r: `${L} Arts. 1.3.2.1, 1.3.4` },
    { id: 'i_ownerRules.eta.eI', h: 'η_I (operational importance)', t: 'Load modifier for operational importance. 1.00 for typical bridges.', u: '—', d: '1.00', w: 'Strength limit-state load factors, every Strength check.', r: `${L} Arts. 1.3.2.1, 1.3.5` },
    // ---- rolled-shape picker (Girders & plates tab) ----
    { id: 'rl_type', h: 'Section type', t: 'Plate girder: the plates as entered. Rolled shape: an AISC W shape picked from the list; its equivalent three plates fill the plate fields (read-only) and the weight is the tabulated lb/ft.', u: '—', d: 'Plate girder', w: 'This segment in every check; rolled: no flange-to-web welds, one steel grade.', r: 'AISC Shapes Database v16.0; ' + L + ' Art. 6.10' },
    { id: 'rl_shape', h: 'W shape', t: 'The rolled shape of this segment. Checked as three plates b_f × t_f flanges and a web D = d − 2t_f by t_w (fillets left out); for a few shapes the flanges are taken slightly thinner so the plates are never stiffer than the table (Section properties, topic "Rolled shape").', u: 'in, lb/ft', d: 'None', w: 'Section properties and every check of the segment; the dead load and quantities use the tabulated weight.', r: 'AISC Shapes Database v16.0' },
    // ---- cross-frames and diaphragms (Framing & bracing tab) ----
    { id: 'i_framing.spacing', h: 'Cross-frame spacing s, at most', t: 'Largest distance between intermediate cross-frames (or diaphragms) along a girder; the layout places them no more than s apart in each span (closer near interior supports when s_p is entered).', u: 'ft', d: '25 ft', w: 'Framing layout, unbraced lengths L_b of the flexure and constructibility checks, cross-frame point loads in DC1.', r: `${L} Art. 6.7.4.2` },
    { id: 'i_framing.orient', h: 'Orientation', t: 'Automatic: parallel to the skew where both supports are skewed 20° or less, otherwise normal to the girders.', u: '—', d: 'Automatic', w: 'Framing layout, cross-frame lengths and forces.', r: `${L} Art. 6.7.4.2` },
    { id: 'i_crossframes.type', h: 'Intermediate bracing', t: 'X-frame, K-frame (diagonals to the bottom or to the top), or a rolled W or channel diaphragm.', u: '—', d: 'X-frame', w: 'Cross-frames tab (member forces and checks), the bracing weight in DC1, the drawings.', r: `${L} Art. 6.7.4.2` },
    { id: 'i_crossframes.dMinXF', h: 'Minimum girder depth for cross-frames', t: 'Girder depth from which the app recommends cross-frames; shallower girders get a diaphragm recommendation (about 0.75 of the girder depth). A recommendation only: the type used is the Intermediate bracing above. Owner rules may set it.', u: 'in', d: '48 in', w: 'Recommended bracing type note (Cross-frames tab).', r: 'App recommendation; owner rules OWN34–OWN36 (Project tab owner)' },
    { id: 'i_crossframes.primary', h: 'Primary members', t: 'Whether the cross-frame members are primary members, with the stricter slenderness limits (Kℓ/r ≤ 120 in compression and ℓ/r ≤ 140 in tension, against 140 and 240 for secondary members). Automatic: yes where a support is skewed more than 20°.', u: '—', d: 'Automatic', w: 'Cross-frame and diaphragm member slenderness checks (Cross-frames tab).', r: `${L} Arts. 6.8.4, 6.9.3` },
    { id: 'i_crossframes.dia.clr', h: 'Fit clearance c (diaphragm)', t: 'Total clearance kept between the diaphragm and the girder flanges: the diaphragm depth must satisfy d ≤ D_0 − c. Blank uses 2 in (1 in top and bottom for clips and welds).', u: 'in', d: '2 in', w: 'Diaphragm fit check and the recommended diaphragm section (Cross-frames tab).', r: 'App rule (no AASHTO limit)' },
    { id: 'i_crossframes.fatCat', h: 'Member end detail', t: 'Fatigue detail category of the cross-frame member end connection: bolted slip-critical (B), welded (E) or welded and eccentric (E′).', u: '—', d: 'B', w: 'Fatigue check of the angle cross-frame members (not used with a diaphragm).', r: `${L} Table 6.6.1.2.3-1` },
    { id: 'i_framing.flSkI', h: 'f_ℓ from skew, interior girders', t: 'Unfactored flange lateral bending stress from skew, used where no f_ℓ is entered on the Flexure tab (the commentary suggests about 10 ksi for interior and 7.5 ksi for exterior girders with discontinuous cross-frame lines).', u: 'ksi', d: '10 ksi (exterior 7.5 ksi)', w: 'Flexure and constructibility checks of skewed bridges.', r: `${L} C6.10.1` },
    // ---- fatigue (Fatigue & studs input tab) ----
    { id: 'i_fatigue.limit', h: 'Fatigue limit state', t: 'By ADTT (default): Fatigue I (infinite life) for a detail where ADTT_SL reaches the infinite-life equivalent of its category, else Fatigue II (finite life). Or force one for every detail.', u: '—', d: 'By ADTT', w: 'Fatigue checks (GS17, studs, cross-frames).', r: `${L} Art. 6.6.1.2.3, Table 6.6.1.2.3-2` },
    { id: 'i_fatigue.ADTT', h: 'ADTT, one direction', t: 'Average daily truck traffic in one direction over the design life. ADTT_SL = p × ADTT.', u: 'trucks/day', d: '2000', w: 'Fatigue limit state and cycles (Fatigue & studs), the stud pitch, and the Rating tab: γ_LL of the legal loads and routine permits.', r: `${L} Art. 3.6.1.4.2; ${MBE} Tables 6A.4.4.2.3a-1, 6A.4.5.4.2a-1` },
    { id: 'i_fatigue.p', h: 'Lane fraction p', t: 'Fraction of the trucks in a single lane: 1.00 with one lane available to trucks, 0.85 with two, 0.80 with three or more.', u: '—', d: '0.85', w: 'ADTT_SL of the fatigue checks.', r: `${L} Table 3.6.1.4.2-1` },
    { id: 'i_fatigue.life', h: 'Design life', t: 'Years of truck traffic for the finite-life resistance: N = 365 × life × n × ADTT_SL.', u: 'years', d: '75', w: 'Fatigue II resistance and the infinite-life threshold.', r: `${L} Eq. 6.6.1.2.5-2` },
    { id: 'i_fatigue.gam.fI', h: 'γ Fatigue I', t: 'Load factor on the fatigue truck for the infinite-life check. Also used by the studs.', u: '—', d: '1.75', w: 'Fatigue I stress ranges (girder details, studs).', r: `${L} Table 3.4.1-1` },
    { id: 'i_fatigue.catT', h: 'Top flange category', t: 'Detail category of the top flange for the flange fatigue check. B = base metal of a built-up member with continuous fillet welds; a rolled shape\'s base metal is A.', u: '—', d: 'B', w: 'Flange fatigue check GS17.', r: `${L} Table 6.6.1.2.3-1` },
    { id: 'i_fatigue.catB', h: 'Bottom flange category', t: 'Detail category of the bottom flange for the flange fatigue check. B = base metal of a built-up member with continuous fillet welds; a rolled shape\'s base metal is A.', u: '—', d: 'B', w: 'Flange fatigue check GS17.', r: `${L} Table 6.6.1.2.3-1` },
    { id: 'i_fatigue.negSec', h: 'Negative-moment section at the details', t: 'Section for the fatigue stress range in negative bending: steel plus deck reinforcement (cracked, conservative; default) or the short-term composite section with the deck effective.', u: '—', d: 'Steel + reinforcement', w: 'Fatigue stress ranges in negative-moment regions.', r: `${L} Art. 6.6.1.2.1` },
    // ---- studs ----
    { id: 'i_studs.d', h: 'Stud diameter', t: 'Shear stud diameter.', u: 'in', d: '7/8 in', w: 'Stud fatigue resistance Z_r, strength Q_n, pitch and spacing checks.', r: `${L} Art. 6.10.10` },
    { id: 'i_studs.h', h: 'Stud height h', t: 'Height of the stud after welding. h/d at least 4.0; the stud should penetrate at least 2 in into the deck.', u: 'in', d: '6 in', w: 'Stud proportion checks.', r: `${L} Arts. 6.10.10.1.1, 6.10.10.1.4` },
    { id: 'i_studs.st', h: 'Transverse spacing s_t', t: 'Center-to-center spacing of the studs across the flange: at least 4 stud diameters; clear distance to the flange edge at least 1 in.', u: 'in', d: '4 in', w: 'Number of studs per row that fit; stud spacing checks.', r: `${L} Art. 6.10.10.1.3` },
    { id: 'i_studs.Fu', h: 'Stud F_u', t: 'Specified minimum tensile strength of the stud.', u: 'ksi', d: '60 ksi', w: 'Nominal stud resistance Q_n = 0.5 A_sc √(f′c E_c) ≤ A_sc F_u.', r: `${L} Eq. 6.10.10.4.3-1` },
    { id: 'i_studs.Qn10', h: 'Q_n entered', t: 'A nominal stud resistance to use instead of the equation. 0 = computed from Eq. 6.10.10.4.3-1.', u: 'kip', d: '0 (computed)', w: 'Strength limit-state stud count.', r: `${L} Art. 6.10.10.4.3` },
    { id: 'i_studs.skew', h: 'Radial term F_fat = F_rc/w', t: 'Adds the radial fatigue shear from the cross-frame force range on skewed (more than 20°) or curved bridges. Auto: yes when a support is skewed more than 20°.', u: '—', d: 'Auto', w: 'Stud fatigue pitch.', r: `${L} Art. 6.10.10.1.2` },
    { id: 'i_studs.beffMode', h: 'b_eff for the studs', t: 'Each girder its own effective flange width (default), or one bridge-wide width as the earlier GirderDetail did.', u: '—', d: 'Each girder its own', w: 'Composite section for the stud shear flow.', r: `${L} Arts. 4.6.2.6, 6.10.10` },
    // ---- deck design (Cross-section input tab) ----
    { id: 'dk_on', h: 'Deck design (strip method)', t: 'Transverse design of the deck slab: interior bays by the strip-method table and the overhangs under gravity loads. Off: nothing is calculated and no result changes.', u: '—', d: 'Off', w: 'Deck tab and the Report.', r: `${L} Art. 4.6.2.1, Table A4-1` },
    { id: 'dk_barTop', h: 'Top transverse bars', t: 'Bar size of the top transverse layer (negative moment over the girders and in the overhangs).', u: 'in²', d: '#5 (0.31 in²)', w: 'Deck tab: negative-moment flexure and crack control.', r: `${L} Arts. 5.6.3, 5.6.7` },
    { id: 'dk_coverT', h: 'Top clear cover', t: 'Clear cover to the top transverse bars (not the longitudinal layers of the Deck card above).', u: 'in', d: '2.5 in', w: 'Deck tab: effective depth.', r: `${L} Table 5.10.1-1` },
    { id: 'dk_xnegAuto', h: 'Negative-moment design section', t: 'Automatic: one quarter of the narrowest top flange width from the girder centerline; or an entered distance.', u: 'in', d: 'Automatic (b_f/4)', w: 'Deck tab: negative design moment.', r: `${L} Art. 4.6.2.1.6` },
    // ---- load rating (Rating tab) ----
    { id: 'rt_phiC', h: 'Condition factor φ_c', t: 'Capacity reduction for the member condition: good or satisfactory 1.00, fair 0.95, poor 0.85.', u: '—', d: '1.00', w: 'Every rating factor (HL-93, legal, permit); for flexure φ_c φ_s is not taken below 0.85.', r: `${MBE} Table 6A.4.2.3-1, Eq. 6A.4.2.1-3` },
    { id: 'rt_phiS', h: 'System factor φ_s', t: 'Capacity factor for the redundancy of the superstructure system (1.00 for multi-girder bridges). Shear is rated with φ_s = 1.0.', u: '—', d: '1.00', w: 'Flexure rating factors.', r: `${MBE} Table 6A.4.2.4-1` },
    { id: 'rt_src', h: 'Demands', t: 'Where the dead and live load effects come from: this app\'s analysis (default), a hand-off file, or custom tables. The HL-93 design-load rating (Inventory and Operating) always runs; legal and permit vehicles only with this app\'s analysis.', u: '—', d: "This app's analysis", w: 'Rating tab.', r: `${MBE} Art. 6A.4.2` },
    { sel: '.rt-vg:has([data-rtveh="Type3"]) .rt-vt', h: 'AASHTO legal loads', t: 'Type 3, Type 3S2 and Type 3-3 trucks, rated at Strength I and Service II with γ_LL from the ADTT; a rating factor below 1.0 gives the posting load. None are ticked by default.', u: '—', d: 'Not rated', w: 'Rating tab, legal-load results and posting.', r: `${MBE} Arts. 6A.4.4, 6A.8.3; Figs. D6A-1 to D6A-3` },
    { sel: '.rt-vg:has([data-rtveh="Legal-Lane"]) .rt-vt', h: 'Lane-type legal load model', t: '75 % of two Type 3-3 trucks plus a 0.2 klf lane load; required for continuous spans (negative moment, interior reactions) and spans over 200 ft. No IM on the lane load.', u: '—', d: 'Not rated', w: 'Rating tab.', r: `${MBE} Art. 6A.4.4.2.1a; Figs. D6A-4, D6A-5` },
    { sel: '.rt-vg:has([data-rtveh="SU4"]) .rt-vt', h: 'Specialized hauling vehicles', t: 'SU4 to SU7 single-unit trucks, rated directly as legal loads (the Notional Rating Load is not in the vehicle list).', u: '—', d: 'Not rated', w: 'Rating tab.', r: `${MBE} Art. 6A.4.4.2.1b; Fig. D6A-7` },
    { sel: '.rt-vg:has([data-rtveh="EV2"]) .rt-vt', h: 'Emergency vehicles', t: 'EV2 and EV3, rated as legal loads at Strength I and Service II; γ_LL as chosen below. The MBE has no provision for them: the basis is the FHWA memorandum.', u: '—', d: 'Not rated', w: 'Rating tab.', r: 'FHWA memorandum 2016-11-03; ' + MBE + ' Art. 6A.4.4' },
    { id: 'rt_imL', h: 'IM, legal loads and emergency vehicles', t: 'Dynamic load allowance on the axles of the legal loads and emergency vehicles. Blank uses 33 %.', u: '%', d: '33 %', w: 'Legal-load rating factors.', r: `${MBE} Art. 6A.4.4.3` },
    { id: 'rt_evG', h: 'γ_LL, emergency vehicles', t: 'Live-load factor of the emergency vehicles: the legal-load value by ADTT (default, conservative) or 1.30 per the FHWA memorandum.', u: '—', d: 'Legal-load table by ADTT', w: 'Emergency-vehicle rating factors.', r: `${MBE} Tables 6A.4.4.2.3a-1, -3b-1; FHWA memorandum 2016-11-03` },
    { id: 'rt_pk', h: 'Permit vehicle', t: 'One permit vehicle to rate at Strength II and Service II: a vehicle of the list or an entered axle train. None by default.', u: '—', d: 'None', w: 'Rating tab, permit results.', r: `${MBE} Art. 6A.4.5` },
    { id: 'rt_pt', h: 'Permit type', t: 'Routine or annual (mixed with traffic, design distribution factor, γ_LL by ADTT and GVW/AL) or special / limited crossing (one-lane factor without the multiple presence factor, fixed γ_LL).', u: '—', d: 'Routine or annual', w: 'Permit γ_LL and distribution factor.', r: `${MBE} Table 6A.4.5.4.2a-1, Art. 6A.4.5.4.2b` },
    { id: 'rt_pg', h: 'γ_LL, permit', t: 'Live-load factor of the permit vehicle. Blank uses the table value shown as the placeholder.', u: '—', d: 'From the table', w: 'Permit rating factors.', r: `${MBE} Table 6A.4.5.4.2a-1` },
    { id: 'rt_imP', h: 'IM, permit vehicle', t: 'Dynamic load allowance on the permit vehicle. Blank uses 33 % (or the preset\'s value); 0 may be used for a crawl-speed crossing.', u: '%', d: '33 %', w: 'Permit rating factors.', r: `${MBE} Art. 6A.4.5.5` }
  ];

  const css = `.sbtip{position:relative;display:inline-block;box-sizing:border-box;width:15px;height:15px;margin:0 0 0 4px;padding:0;border:1px solid var(--accent,#1e3a5f);border-radius:50%;background:#fff;color:var(--accent,#1e3a5f);font:700 9.5px/13px var(--font-ui,system-ui,sans-serif);text-align:center;vertical-align:-2px;cursor:help;flex:none;}
  .sbtip::before{content:'?';}
  .sbtip::after{content:'';position:absolute;inset:-8px;}
  .sbtip:hover,.sbtip[aria-expanded="true"]{background:var(--accent,#1e3a5f);color:#fff;}
  .sbtip:focus-visible{outline:2px solid var(--accent,#1e3a5f);outline-offset:2px;}
  #sbTipPop{position:fixed;z-index:10000;box-sizing:border-box;max-width:min(380px,calc(100vw - 16px));padding:8px 10px;border-radius:6px;background:#0f172a;color:#f8fafc;font:9pt/1.45 var(--font-ui,system-ui,sans-serif);box-shadow:0 6px 18px rgba(15,23,42,.28);text-align:left;white-space:normal;}
  #sbTipPop[hidden]{display:none;}
  #sbTipPop b{color:#fff;} #sbTipPop .k{color:#cbd5e1;} #sbTipPop p{margin:0 0 4px;} #sbTipPop p:last-child{margin:0;}
  @media print{.sbtip,#sbTipPop{display:none !important;}}`;

  let pop = null, cur = null, pinned = false;
  const hostOf = T => {
    if (T.id) { const el = document.getElementById(T.id); if (!el) return null; return document.querySelector(`label[for="${CSS.escape(T.id)}"]`) || el.closest('label'); }
    try { return T.sel ? document.querySelector(T.sel) : document.querySelector(T.after); } catch (e) { return null; }
  };
  function button(i, T) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sbtip'; b.dataset.tip = String(i);
    b.setAttribute('aria-label', `Help: ${T.h}`); b.setAttribute('aria-expanded', 'false'); b.setAttribute('aria-controls', 'sbTipPop');
    return b;
  }
  /* decorate(): a button on every listed input drawn now that has none (idempotent) */
  function decorate() {
    TIPS.forEach((T, i) => {
      const h = hostOf(T); if (!h) return;
      if (T.after) { const n = h.nextElementSibling; if (n && n.classList.contains('sbtip')) return; h.insertAdjacentElement('afterend', button(i, T)); return; }
      if (h.querySelector(':scope > .sbtip')) return;
      h.appendChild(button(i, T));
    });
  }
  function body(T) {
    const f = document.createDocumentFragment(), p = (k, v) => { const e = document.createElement('p'); if (k) { const s = document.createElement('span'); s.className = 'k'; s.textContent = k + ': '; e.appendChild(s); } e.appendChild(document.createTextNode(v)); f.appendChild(e); };
    const t = document.createElement('p'), b = document.createElement('b'); b.textContent = T.h; t.appendChild(b); t.appendChild(document.createTextNode('. ' + T.t)); f.appendChild(t);
    if (T.u && T.u !== '—') p('Units', T.u);
    p('Default', T.d); p('Used in', T.w); if (T.r && T.r !== '—') p('Reference', T.r);
    return f;
  }
  function place(b) {
    const r = b.getBoundingClientRect(), vw = document.documentElement.clientWidth, vh = document.documentElement.clientHeight, w = pop.offsetWidth, ht = pop.offsetHeight;
    let x = Math.min(Math.max(8, r.left + r.width / 2 - 24), vw - w - 8), y = r.bottom + 6;
    if (y + ht > vh - 8 && r.top - ht - 6 >= 8) y = r.top - ht - 6;
    pop.style.left = Math.max(8, x) + 'px'; pop.style.top = Math.max(8, y) + 'px';
  }
  function show(b, pin) {
    const T = TIPS[+b.dataset.tip]; if (!T) return;
    if (cur && cur !== b) hide();
    pop.replaceChildren(body(T)); pop.hidden = false; cur = b; pinned = !!pin;
    b.setAttribute('aria-expanded', 'true'); b.setAttribute('aria-describedby', 'sbTipPop'); place(b);
  }
  function hide() {
    if (cur) { cur.setAttribute('aria-expanded', 'false'); cur.removeAttribute('aria-describedby'); }
    cur = null; pinned = false; if (pop) pop.hidden = true;
  }
  function install() {
    if (pop) return;
    const st = document.createElement('style'); st.id = 'sbtip-css'; st.textContent = css; document.head.appendChild(st);
    pop = document.createElement('div'); pop.id = 'sbTipPop'; pop.setAttribute('role', 'tooltip'); pop.hidden = true; document.body.appendChild(pop);
    const tipOf = e => (e.target && e.target.closest ? e.target.closest('.sbtip') : null);
    document.addEventListener('mouseover', e => { const b = tipOf(e); if (b && !pinned) show(b, false); });
    document.addEventListener('mouseout', e => { const b = tipOf(e); if (b && b === cur && !pinned && !b.contains(e.relatedTarget)) hide(); });
    document.addEventListener('focusin', e => { const b = tipOf(e); if (b) { if (b !== cur) show(b, false); } else if (cur && !pinned) hide(); });
    document.addEventListener('focusout', e => { const b = tipOf(e); if (b && b === cur && !pinned) hide(); });
    document.addEventListener('click', e => {
      const b = tipOf(e);
      if (b) { e.preventDefault(); e.stopPropagation(); if (b === cur && pinned) hide(); else show(b, true); return; }
      if (cur && !pop.contains(e.target)) hide();
    }, true);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && cur) hide(); });
    window.addEventListener('scroll', () => { if (cur) { if (cur.isConnected) place(cur); else hide(); } }, true);
    window.addEventListener('resize', () => { if (cur) { if (cur.isConnected) place(cur); else hide(); } });
    decorate();
    new MutationObserver(() => { decorate(); if (cur && !cur.isConnected) hide(); }).observe(document.body, { childList: true, subtree: true });
  }
  // no DOM (the engine tests load every script of the page in Node): the list only
  if (typeof document !== 'undefined') { if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', install); else install(); }
  window.SBDTips = { TIPS, decorate, show, hide };
})();
