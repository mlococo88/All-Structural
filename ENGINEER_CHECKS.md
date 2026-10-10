# Engineer checks and decisions — open list

Things only the engineer can do (check against printed specs, open files in CAD, try in a real browser) or decide. Kept here so nothing is lost; the same list is shown at the top of `tools.html` ("Open engineer checks"). **When an item is done or decided, remove it from both places** and record the outcome in the tool's fix log.

Last updated: 2026-10-10.

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

| # | Tool | Question | Recommendation |
|---|---|---|---|
| B1 | Gusset Plate Rating | Stagger search band s_b = 2√(L·d_n): rows farther than this from the Whitmore line are ignored for the Whitmore net width. Without the band, net width is smaller in 5 members of 17 custom models (worst −17.5 % tension fracture capacity; no governing RF changed). How far from the line may a row count? | Remove the band (search every hole path in the fastener group) — more conservative. |
| B2 | Gusset Plate Rating | Missing checks — which to add, in what order, and with which MBE / FHWA provisions: O1 chord splice check and combined shear + axial + moment on a plane; O2 Whitmore section clipped at adjacent members (now only a warning); O3 free-edge buckling; O4 eccentric fastener groups / unequal sharing between plates; O16 heel-joint shear plane including the normal force. | Engineer to prioritise. |
| B3 | Section Property Calculator | A plate in face contact with a rectangular HSS gives "J n/a — elements cross without a connection". Handle it? | Yes — treat like other face contacts. |
| B4 | Section Property Calculator | Shear flow in a section where a part has parallel load paths (e.g. the built-up I: web plate also bears on the flange plates) shows n/a. Is switching the bearing contacts to "not connected" (Torsion tab) the intended workflow, or a stiffness-based split? | Switch bearing contacts off (riveted-girder behaviour). |
| B5 | Section Property Calculator | Shear flow sign under combined V_x + V_y: V_x, V_y taken as force components along +x, +y (consistent with the Stresses tab). Confirm. | Keep. |
| B6 | Section Property Calculator | My sections library sits at the bottom of the Templates tab; a separate "Library" tab would need slightly narrower tabs. Keep? | Keep. |
| B7 | Section Property Calculator | Validation tab shows machine-precision differences as e.g. −2.2e-15 / 9.5e-14 %. Show them as 0 / "< 1e-12" instead? | Keep (shows exact agreement). |
| B8 | Pile Designer | Open calculation items from the audit and the 2026-10-10 review (details in `fixlog/Pile Designer.md`): O1 outer 0.85 factor and min(fyb, fyc) in structural axial; O2 casing counted in tension through threaded joints (potentially unconservative); O3 uncased flexure checked only at the casing tip (unconservative with typed-in LPILE moments); O4 CFST f′c/Ec consistency; O5 H-pile clay tip φ 0.35 vs 0.40; O6 no SVL service check; O7 multi-case LPILE import; O8 H-pile φc good driving; O9 small-group 0.80 reduction; O11 unused φV; O12 old saves with fyb = 150; O13 blank fields compute NaN in-session; O14 punching citation "5.8.4"; O16 H-pile geotech capacity 0 at defaults (no SPT N); O17 IAB eligibility shown as ratio, blank inputs fail without hint; O18 IAB equation shows raw source; O19 H-pile plot shows micropile labels; O20 φc default 0.80 vs AASHTO 6.5.4.2 0.95/0.90; O21 "UNVERIFIED φ" banner still shown. Also: proposals — output tabs, print-section chooser and print restyle, one save path, blank title-block defaults, Client/Date fields. | Decide item by item; O2 and O3 first (possibly unconservative). |
