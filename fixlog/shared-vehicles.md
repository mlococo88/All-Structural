# Fix log — shared/vehicles.js (window.SharedVehicles)

Vehicle presets and their live-load rules. Loaded by: `Moving Load Generator.html`.

## 2026-10-29 — PR: pilot-moving-load — created by moving the presets out of Moving Load Generator.html (refactor, no value change)
### Where
- `build()` holds the page's preset block verbatim (anchors `const E80=[[40,0],[80,8]`, `const HW=(label,axles,o={})=>`, `const P={`) and the fatigue truck from `P['Fatigue']=HW('LRFD Fatigue Truck (30 ft)',[[8,0],[32,14],[32,30]],…)`. It returns fresh objects each call: `{presets, fatigue, NOSL}`.
- Presets (key order unchanged): HL93-Truck, HL93-Tandem, HS20, H20, E80, E80-Alt, F40PH, HSP46, 286K, 315K, ES44AC; plus Fatigue (added by the page after start-up, as before).
### Governing provision
- None changed. HL-93 truck/tandem/lane: AASHTO LRFD 10th Ed. 3.6.1.2; fatigue truck 3.6.1.4.1; HS20/H20 and lane loading: AASHTO Std. Spec. 17th Ed. 3.7, Fig. 3.7.6B; Cooper E80 / alternate: AREMA Ch. 8/15 (edition to be verified, as the page states); rail equipment as the page had it.
### Check case
- HL-93 truck axles `[[8,0],[32,14],[32,14]]`, variable 3rd spacing 14–30 ft, lane 0.64 k/ft, IM 1.33 on axles only, two-truck case 0.9 × 2 trucks with headway ≥ 50 ft and 14 ft spacing — same before and after (test "vehicle presets: same keys, order and values").
### How verified
- `node tests/engine/run.mjs moving-load`: the presets equal the original page's `P` (JSON, key order included), and 35 engine cases are bit-identical.
### Other copies
- `index.html` and `Stone Masonry Arch Load Rating.html` have their own truck tables (not shared yet; the audit found wrong legal trucks there). Not touched.
### Open items
- SV-O1. The rail equipment (F40PH, HSP46, 286K, 315K, ES44AC) and E80 data are not yet checked against a cited source and edition; a verified library needs each vehicle's source, edition and axle table recorded here before other tools load it.
