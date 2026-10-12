# Engineer checks and decisions — open list

Things only the engineer can do (check against printed specs, open files in CAD, try in a real browser) or decide. Kept here so nothing is lost; the same list is shown at the top of `tools.html` ("Open engineer checks"). **When an item is done or decided, remove it from both places** and record the outcome in the tool's fix log.

Last updated: 2026-10-12.

## A. Checks (engineer's own action)

| # | Tool | Check | Where it is logged |
|---|---|---|---|
| A1 | Base Plate & Anchor Designer | Type `5.5` into f'c (and a couple of other fields) in your own Edge/Chrome; it should stay 5.5. The decimal fix was tested only in headless Chromium. | `fixlog/BasePlateAnchorDesigner.md` D1 |
| A2 | Concrete Beam ASD, Concrete Anchor | Open each and check the styling looks right after pinning Tailwind Play CDN 3.4.17 (could not be viewed here, CDN blocked). | fix logs, library pins |
| A3 | Section Property Calculator | AutoCAD MASSPROP: export a 1 × 1 square with its corner at 0,0 (tool-origin basis) — Product of inertia should read XY = +0.25; note which order MASSPROP lists the principal moments in. | `fixlog/Section Property Calculator.md` X-O1 |
| A4 | Section Property Calculator | AISC 360-16 equation numbers E4-8 (H), E4-9 (r̄o²), F2-7 (r_ts) against the printed Specification. | P2a-O1 |
| A5 | Section Property Calculator | Fillet weld strength in the shear-flow check: φ = 0.75 / Ω = 2.00, 0.60 F_EXX, throat 0.707w, no directional increase (AISC 360-16 J2.4, Table J2.5). HSS corner radii 2t_des / t_des basis. | P2b, O2 |
| A6 | Timber Beam Check | NDS 2018 equation numbers in the calc sheets (3.3-2, 3.3-5, 3.3-6, 3.4-2, 3.4-3, 3.5-1, 3.10-2) and the 3.3.3 / 3.3.3.7 wording the top-edge R_B fix relies on. All built-in values with a "verify" badge (Reference values tab). | `fixlog/Timber Beam Check.md` R1-f, R5 |
| A7 | Timber Beam Check | Supply values not built in, if wanted: Southern Pine Stud (Table 4B), SPF timbers (Table 4D), Dense / Non-Dense grades, other glulam combinations. | P2-3 |
| A8 | Gusset Plate Rating | Check every "verify" value against the printed MBE / FHWA guide / AASHTO (rivet and fastener strengths, K, LFR values, etc.). | `fixlog/Gusset Plate Rating.md` O8 |
| A9 | Gusset Plate Rating | Open an exported DXF in AutoCAD and MicroStation, save it from each, and re-import it. | O13 |

## B. Decisions (engineer to choose)

Closed 2026-10-12 under the engineer's delegation: B1 Gusset stagger band removed (C13, #123); B3 SPC plate on HSS joined (H1, #124); B4–B7 SPC kept as recommended (bearing contacts switched off for parallel load paths; V_x, V_y sign as is; library on the Templates tab; machine-precision differences shown as is).

| # | Tool | Question | Recommendation |
|---|---|---|---|
| B2 | Gusset Plate Rating | Missing checks O1–O4, O16: being added 2026-10-12 under the engineer's delegation ("use your best judgment") — chord splice and Whitmore clipping as rating checks, free-edge slenderness, eccentric groups and heel combined shear + normal as advisories. Review the result when done. | — |
| B8 | Pile Designer | Open items are being worked 2026-10-12 under the engineer's delegation (O2, O3, O35, O44, O4, O5, O14, O16, O51; O50 web-direction input; UI items). Fixed so far 2026-10-10/12: O18, O19, O22–O26, O29, O31–O34, O36–O49, O52, O53 (F16–F41). See `fixlog/Pile Designer.md`; the remaining questions will be listed here when the batch is done. Also: verify AASHTO LRFD 10th Ed. Art. 10.7.3.13.4 as the Davisson & Robinson depth-to-fixity reference. | — |
