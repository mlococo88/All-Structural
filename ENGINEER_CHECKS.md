# Engineer checks and decisions — open list

Things only the engineer can do (check against printed specs, open files in CAD, try in a real browser) or decide. Kept here so nothing is lost; the same list is shown at the top of `tools.html` ("Open engineer checks"). **When an item is done or decided, remove it from both places** and record the outcome in the tool's fix log.

Last updated: 2026-10-12 (after the all-tools open-item sweep, PRs #121–#160).

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

## B. Results that changed in the 2026-10-12 sweep — please review first

These changes were made under your delegation ("use your best judgment"). They are code-based and more conservative unless noted, but they change results of existing projects. Each has a before/after check case in the tool's fix log and PR.

| # | Tool | What changed | PR |
|---|---|---|---|
| B1 | Pile Designer | Micropile casing tension through threaded joints now **0 %** by default (FHWA: neglect unless joint capacity is documented); old projects too. Default tension capacity 626 → 53 kip. Enter the supplier's joint efficiency if documented. | #144 |
| B2 | Light Pole and Sign Post | Poles with n₁ < 1 Hz use the flexible gust factor G_f with damping β = 0.005 (default). A 60 ft pole: G_f ≈ 1.77, anchors 96 % → 202 %. Confirm β for your poles (0.01–0.02 also common; G_f 1.20 at 0.02). Monopost signs now check torsion (default monopost anchors NG 1.21). | #136, #138 |
| B3 | Bridge Substructure Loading | Seismic Zones 2–4: pier foundations use R/2 (Zone 2) or 1.0 (Zones 3–4), bearings R = 0.8 (AASHTO 3.10.9 / Table 3.10.7.1-2). Old Zone 2–4 projects get larger forces; a "Unit R" option restores the old numbers. | #149 |
| B4 | Abutment, SubLoads | Extreme Event I γEH = γp (1.50/0.90) for new projects; existing saves keep their stored value as "agency policy". If 1.00 is not your policy, switch old projects to γp. | #147, #152 |
| B5 | Steel Beam Design | §H3.3(c) torsion buckling added (W18X35, L_b 20 ft example 0.70 → 2.19 FAIL); axial tension now checked (§D2, H1.2); imported roof live load now gets load factors. | #153 |
| B6 | Timber Beam Check | Point loads within d of a support now count in design shear (were ignored). x/d option off by default. | #150 |
| B7 | Moving Load Generator | HS20/H20 lane loading now enveloped with the truck (pier −M 2×100 ft −1516 → −2608 kip-ft). Old HS20 saves keep it off with a warning. | #151 |
| B8 | Bridge Geometry → LL & DL | Skew sent for moment = smallest skew (absolute) (0 if adjacent supports differ > 10°); shear uses the largest. LL & DL now applies both from one hand-off. | #148, #160 |
| B9 | LL & DL | Concrete girders: n = E_c,girder/E_c,deck from f′c (was 1); d_e no longer clamped at the upper bound. | #160 |
| B10 | ST-Girder, PS-Beam | Exterior girder b_eff and deck DL use S/2 + overhang; exterior fatigue DFs by lever rule (ST exterior fatigue now FAILS in the check case); Service II rating added and governs the ST default; φc/φs inputs. | #129, #131 |
| B11 | index (MCT / rating) | Rolled-shape capacity from AASHTO App. A6/6.10.8 when plates and L_b are entered (old zones keep Fy·Zx with a red warning); composite D_p/D_t reduction; Service II/III LL scaled by g(1+IM); MBE permit γLL table. | #135 |
| B12 | Retaining Wall | Rock bearing uses linear pressure; ACI base friction default tan(⅔φ). | #128 |
| B13 | Concrete Beam Capacity / Rebar | ACI ε_t ≥ ε_ty + 0.003; #14/#18 hooks lose ψr/ψo = 1.0 (l_dh ×1.6–2.0). | #140 |
| B14 | Gusset Plate Rating | Stagger band removed; chord splice rating check added (from secondary sources — see C below). | #123, #130 |
| B15 | Spread Footing | Depth factors default Off for new projects (default DCR 0.64 → 0.70). | #142 |

## C. Questions for you (decisions and printed-spec checks)

Each item has my recommendation; the tool currently follows it. Details are in the tool's fix log.

**Pile Designer** — φt micropile tension 0.90 vs AASHTO 0.80 (verify; not changed) · φc default 0.80 → pick 0.90 (composite) or 0.95 (steel) · confirm micropile group widths (f_m on casing OD, η/block on d_h) · O50: should toggle-off Group rows follow the web direction · verify AASHTO 10.7.3.13.4 (Davisson fixity), 10.7.3.9 details (stiff-surface waiver, 0.50 ksf), 10.7.5 / GEC 12 (section loss) · typed M_max with no LPILE profile now fails the uncased check — import the profile · small: punching 0.125 vs 0.126, CFST M_r φ, Extreme φ on CFST/block factors · map Client/Date to shared project info?
**Gusset** — MBE 6A.6.12.6.9 chord splice (equation, K 0.65, KL/r 25, φ_cs 0.85, tension eccentricity); drop chord Whitmore buckling for a compression splice?; splice demand basis; O2 Whitmore at adjacent members (built per NCHRP 12-84); advisory formulas.
**Light Pole** — soil torsion for monopost shafts (add a geotech allowable torque input?) · IBC 15× cap reading and section number · anchor breakout method for a bolt circle in a round shaft (still "NOT CHECKED") · ASD embedment P-Δ (rec no).
**SubLoads / Abutment** — seismic connection force MassDOT 0.10 vs AASHTO 0.15/0.25 (rec AASHTO) · γSH 0.5 default for concrete units (rec yes for new) · Service IV 0.75V, γWS 1.00 · IM on buried footings (rec keep).
**index** — staged section moduli for Service II/III (rec yes) · HL-93 variable axle / 90 % two-truck case (rec yes) · MBE permit table values and special permits · GFS lane-load placement · bolted two-girder φs 0.85 · AREMA printed checks · φs on shear · Service III 0.6/0.3 ksi caps (rec yes) · drop index from HANDOFF §4.4 superReactions (rec).
**ST-Girder** — sign off stud fatigue change (less conservative, FAIL → PASS) · printed checks 6.10.10.4.2, Tables 4.6.2.2.2d-1/3b-1, C6.10.1, 6.10.1.10.2 · 1.3R_hM_y cap (rec keep) · R_b = 1.0 (rec yes after check).
**PS-Beam** — NEXT DFs per beam vs per stem · cracked-section strand fatigue (rec yes) · full PCI/Mast lifting (large) · φs on shear · overhang thickness · relabel "9th Ed." after printed check.
**Steel Bridge Beam Modules** — L_p coefficient 1.1 vs 1.0, C_b equation · 10th Ed. Q_n equation · 1-1/8 in hole width · 6.13.6.1.3b φc 0.95, 6.10.11.2.4b web strip · MassDOT E_c unit weight 0.145 kcf? · open once with network access.
**Base Plate / Concrete Anchor** — ASCE 7-22 snow factors · −W combos and rain slot · plate b_eff rule (rec 2l_x) · narrow-member c_a1 limit (less conservative; rec yes) · §17.6.2.1.2 interpretation · seismic §17.10 (rec warning) · inline CSS instead of Tailwind CDN (rec).
**Concrete Beam Capacity / Rebar / ASD** — sign off A_ℓ,min (9.6.4.3) and A_v,min trigger (9.6.3.1), both less conservative per 318-19 · printed checks of AASHTO 5.6.2.1, 5.4.3.1, 5.10.8.2.4b, 5.10.8.4.2a · ASD operating f_c 1,900 psi (MassDOT?) · ASD allowables for other grades · Headed Bar tab (rec yes) · relabel "9th Ed.".
**Retaining Wall** — φτ 1.00 vs MassDOT 0.80 · MassDOT collision values · φb 0.45 on rock (rec) · w_c in E_c.
**Elastomeric** — 14.7.6.3.2/14.7.6.3.5 printed check · plain-pad rotation form · MassDOT 0.03 rad / 4.75 limits · anchorage basis · 0.005 rad about each axis.
**Spread Footing** — Direct mode basis (label ASCE 7 / indicative) · seismic E load type · old saves depth factors On (rec keep) · passive on the footing face.
**Timber** — deflection transient set (rec keep) · x/d option default off · ASCE 7 edition.
**Moving Load** — Std. Spec. impact loaded length on continuous spans · old HS20 saves lane check (rec leave off).
**Steel Beam** — accept the §H3.3(c) per-stress form · blank A_n/U defaults.
**LL & DL** — f′c defaults 8/4 ksi and w_c · N_b = 3 exterior rule · negative-region K_g · MassDOT "two adjacent beams" relief.
**Bridge Geometry** — chord vs radial skew · seat haunch method · curved vs chorded girders · NAD83/WGS84 and a combined scale factor input.
**Shear & Moment** — overhang deflection l = 2 × cantilever (rec keep L).
**Suite-wide** — ASCE 7 edition per tool (7-16 vs 7-22) · converge KaTeX/Plotly versions (needs your OK, CLAUDE.md §2) · SRI hashes · which CDN hosts the work laptop reaches (inline Tailwind?) · one verified vehicle table across tools · relabel edition lines after the printed checks.
