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

## 2026-11-07 — PR: claude/ml-legal-vehicles (PR #1129: https://github.com/mlococo88/All-Structural/pull/1129) (M1: AASHTO legal, emergency and owner rating vehicles added; existing presets unchanged)
Loaded by: `Moving Load Generator.html` (preset list) and `apps/steel-bridge/index.html` (`engine/analysis.js` reads only
`presets['HL93-Truck']` and `fatigue`; unaffected).
### Problem (review 2026-11-07, M1)
- No legal, permit or owner rating vehicles: only HL-93, fatigue, HS20 / H20 and rail. They could be entered only as Custom axles.
### Where / before → after
- New helper after `HW`: `const LG=(label,axles,o={})=>HW(label,axles,Object.assign({udl:NOUDL,hwy:true,rating:true},o));`
  (highway rules of `HW`: IM 1.33 on axles, not on the uniform load, non-contributing axles neglected; no uniform load).
- New keys appended after `'ES44AC'` (original keys, order and values unchanged). Axles as [load kips, spacing from previous ft]:
| Key | Axles | Gross / length | Source (figure as reproduced) |
|---|---|---|---|
| H20-Legal | 8 · 32@14 | 40 k / 14 ft | RIDOT LRFR (Sept 2022) 4.4.1.2, H20 |
| Type3 | 16 · 17@15 · 17@4 | 50 k / 19 ft | RIDOT 4.4.1.2 (MBE Fig. D6A-1) |
| Type3S2 | 10 · 15.5@11 · 15.5@4 · 15.5@22 · 15.5@4 | 72 k / 41 ft | RIDOT 4.4.1.2 (MBE Fig. D6A-2) |
| Type3-3 | 12 · 12@15 · 12@4 · 16@15 · 14@16 · 14@4 | 80 k / 54 ft | RIDOT 4.4.1.2 (MBE Fig. D6A-3) |
| Legal-Lane | 0.75 × Type 3-3 (9, 9, 9, 12, 10.5, 10.5) + 0.2 klf lane; two vehicles, clear gap ≥ 30 ft, for −M / interior R | 60 k / 54 ft | RIDOT 4.4.1.2 (MBE Figs. D6A-4, D6A-5) |
| SU4 | 12 · 8@10 · 17@4 · 17@4 | 54 k / 18 ft | RIDOT 4.4.1.2 (MBE Fig. D6A-7) |
| SU5 | 12 · 8@10 · 8@4 · 17@4 · 17@4 | 62 k / 22 ft | same |
| SU6 | 11.5 · 8@10 · 8@4 · 17@4 · 17@4 · 8@4 | 69.5 k / 26 ft | same |
| SU7 | 11.5 · 8@10 · 8@4 · 17@4 · 17@4 · 8@4 · 8@4 | 77.5 k / 30 ft | same |
| EV2 | 24 · 33.5@15 | 57.5 k / 15 ft | RIDOT 4.4.1.2 (FAST Act emergency vehicles) |
| EV3 | 24 · 31@15 · 31@4 | 86 k / 19 ft | same |
| RIPTA | 14.6 · 27@23.25 (23'-3") | 41.6 k / 23.25 ft | RIDOT 4.4.1.2 (RIPTA bus) |
| CT-TLC | 13.5 · 18@9.6 · 22.5@4.1 · 22.5@4.5 · 63.7@18 · 64.9@14.33 · 18@24.75 · 18@3 · 38.5@6.5; IM 0 | 279.6 k / 84.78 ft | CTDOT BDM (02/24) 1.3.6 |
- The MassDOT Bridge Manual (Hundredth Anniv. Ed.) 7.2.4.1A/B rating list (H20, Type 3, 3S2, HS20 in 7.2.4.1B, SU4–SU7, EV2, EV3)
  gives tonnages only; they agree with the weights above (e.g. SU4 27 t = 54 k, EV3 43 t = 86 k). HS20 is the existing preset.
### Governing provisions
- AASHTO MBE Appendix D6A figures (as reproduced in the RIDOT LRFR Guidelines, Sept 2022, 4.4.1.2; the MBE itself was not
  available to check); CTDOT BDM (02/24) 1.3.6; MassDOT Bridge Manual 7.2.4.1 and 7.2.4.6A (IM on all rating trucks);
  AASHTO LRFD 10th Ed. (2024) Art. 3.6.2.1 (IM 33 %, not on lane loads).
### Decisions (pending engineer review)
- IM 33 % on every legal / EV / RIPTA truck (MassDOT 7.2.4.6A; LRFD 3.6.2.1), none on the 0.2 klf legal lane load; CT-TLC IM 0 (BDM 1.3.6).
- Legal lane-type D6A-5: the tool's two-vehicle case sweeps every clear gap from 30 ft up to twice the longest span (the figure shows
  30 ft); covering more positions is conservative. The 0.2 klf lane weight is labelled on D6A-4; the D6A-5 reproduction shows the
  lane load without a value and the same 0.2 klf is used.
- The lane-type preset's single-vehicle case is applied to all effects at any span (D6A-4 is required for spans over 200 ft); the user
  picks the preset where it applies.
- LRFR / owner load factors and DFs (one-lane ÷ 1.2 for CT-TLC, BDM 1.3.6) are not set by the preset; the user enters them (hint).
### Check case (`tests/engine/moving-load.test.mjs`, "M1")
- Type 3S2, simple span 100 ft, midspan +M by hand: axle 3 on the section (lead axle at 35 ft), ordinates 17.5, 23, 25, 14, 12:
  M = 10(17.5) + 15.5(23 + 25 + 14 + 12) = 175 + 1147 = 1322 kip-ft; × 1.33 = 1758.26. Tool: 1758.26. Before: n/a (no preset).
- CT-TLC, simple span 100 ft, midspan +M: tool 3920.01 = the static maximum of a 0.01 ft brute-force search (3920.01), i.e. no IM.
- Every vehicle's gross weight and length equal the documented values (table above).
### How verified
- `node tests/engine/run.mjs moving-load`: all pass; the original presets' keys, order and values are unchanged (test adjusted to
  compare the original keys), and the 35 parity cases hash identically.
- Headless page: each new preset selected and run (see the PR), 0 console errors.
### Other copies
- `index.html` and `Stone Masonry Arch Load Rating.html` keep their own truck tables (SV-O1 / audit); not touched.
### Open items
- RIDOT annual and special-trip permit vehicles (LRFR 4.4.1.3) and the MBE NRL / HS25 / alternate military presets were not added
  (not in scope). Per-preset LRFR load factors not provided.

## 2026-11-10 — PR: claude/mbe4-vehicles (PR #TBD) — rating-vehicle comment: checked against AASHTO MBE 4th Edition (2026) Appendix D6A   [comment only; no data, result, saved key or format change]
- **Engineer (2026-11-10):** the tools follow the AASHTO Manual for Bridge Evaluation, 4th Edition (2026).
- **Where:** comment above `'H20-Legal':LG(` (anchor `// ── Rating vehicles (M1, added 2026-11-07)`). Before: `… and the CTDOT BDM (02/24) 1.3.6 (CT-TLC); the MBE` / `itself was not available. Gross weights checked …`. After: `… and the CTDOT BDM (02/24) 1.3.6 (CT-TLC). Type 3,` / `3S2, 3-3, Legal-Lane and SU4–SU7 checked against AASHTO MBE 4th Ed. (2026) Figs. D6A-1 to D6A-5 and D6A-7 (pp. 6-136 to` / `6-138), 2026-11-10. Gross weights checked …`.
- **Verified (4th Ed.):** Fig. D6A-1 Type 3 16 / 17 / 17 kip at 15, 4 ft (50 kip); D6A-2 Type 3S2 10 / 15.5 ×4 at 11, 4, 22, 4 ft (72 kip); D6A-3 Type 3-3 12 / 12 / 12 / 16 / 14 / 14 at 15, 4, 15, 16, 4 ft (80 kip); D6A-4 75 % of Type 3-3 (9 / 9 / 9 / 12 / 10.5 / 10.5) + 0.2 klf, spans > 200 ft; D6A-5 two such trucks 30 ft apart with lane load, negative moment and interior reactions; D6A-7 SU4 12 / 8 / 17 / 17, SU5 12 / 8 / 8 / 17 / 17, SU6 11.5 / 8 / 8 / 17 / 17 / 8, SU7 11.5 / 8 / 8 / 17 / 17 / 8 / 8 at 10 ft then 4 ft (54 / 62 / 69.5 / 77.5 kip). Every preset axle load and spacing matches.
- **Formulas, factors, units, data:** none changed (comment only). **Saved data:** none (§5).
- **Tools that load this file (tests run):** `Moving Load Generator.html` (project-library --tool mlg ALL PASS, phone-layout --tool mlg 390 px pass, headless probe main vs branch: text identical apart from its own note edit and the "Solved in … ms" clock); `apps/steel-bridge/index.html` (`tests/smoke/steel-bridge-report.mjs` pass, 0 console errors). `node tests/engine/run.mjs`: moving-load tests 7 passed. `check-syntax` pass.
- **Open items (for the engineer, not changed):** (1) the `H20-Legal` preset label reads "Legal H20, LRFR (MBE; RIDOT 4.4.1.2)"; the 4th Ed. Appendix D6A has no H20 vehicle (the H20 comes from the RIDOT Guidelines / MassDOT list). The label is left unchanged because preset labels appear in saved projects and outputs. (2) Fig. D6A-5 shows the two trucks 30.0 ft apart; the `Legal-Lane` preset tries every clear gap from 30 ft up (`hmin:30`), which envelopes the figure's 30 ft case. (3) The 4th Ed. Notional Rating Load (Fig. D6A-6) is not a preset.
- **Other copies:** vehicle data also in `index.html` and `Stone Masonry Arch Load Rating.html` (their own tables; checked in their MBE 4th Ed. PRs, values match).
