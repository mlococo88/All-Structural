# Stage 2: unify the differing checks, then port the ST-only features (research, 2026-10-22)

Base: origin/main 0072010. Read-only. Line numbers:
- **ST** = `stgirder.html`. The same text sits in `Steel Bridge Design.html` inside `st-src`, at **ST line + 8021** (for example, computeAll is ST 1499 and SBD 9520).
- **GD** = the host script of `Steel Bridge Design.html`.

AASHTO references are to the LRFD 10th Ed. (2024) and are article numbers only.

## How the numbers below were obtained

All runs were read-only. The scripts are in `scratchpad/sbd-merge/harness/` (`stvar.mjs`, `stvar2.mjs`, `summ.py`, `summ2.py`); the raw results are in `harness/out`, `harness/out2` and `gdout/`.

**ST variants.** I opened origin/main `stgirder.html` headless with `tests/lib.mjs` and applied each of the 108 `tests/projects/st` payloads the way `compare.mjs` does (publish, then `#gdpull`). For each payload I ran:
- `computeAll(session)` (the baseline);
- patched copies of computeAll's source, evaluated in the page:
  - `n`: n = E/E_c, no rounding;
  - `rb`: R_b = 1.0 for a composite section in positive flexure with D/t_w ≤ 150;
  - `lf`: maximum or minimum γ_DC/γ_DW chosen by sign, applied to M_u, M_un and the staged stresses;
- a post-processing variant `pierTFA`: tension-field V_n in the panels next to an interior support, and V_cr only next to an abutment.

**GD reference.** I read GD's own readouts with `compare.mjs --tool gd` (A = B = origin/main SBD) for the builtin and xsA projects under AASHTO (modules gs, sc, sa).

**Coverage caveat.** Every one of the 108 payloads is the span-1 (end-span) slice of a 3-span girder. No interior span is covered, so pier-to-pier effects (both ends of the span are piers) are not exercised. Add `--save-st` payloads with `_selSpan` = 2 before the unification PRs.

---

## Part 1: the differing checks

Summary. "Better" is the method that follows the 10th Ed. more accurately. "ST loc." gives ST line numbers.

| # | Item | Better | Governing articles | ST loc. | GD loc. | Measured change (ST to unified, 108 payloads) |
|---|---|---|---|---|---|---|
| 1 | Modular ratio n | GD (exact) | 6.10.1.1.1b (Eq. -1), 5.4.2.4 | 1519 | 13384 `modRatio` (nRule 'exact' default) | ±0.2–1.1 % on +M flexure, fatigue, stud pitch, LL deflection; 4 stud-fatigue pass/fail flips (1.004 → 0.998) |
| 2 | Load factors max/min by sign | GD | 3.4.1, Table 3.4.1-2 | 1655–1657 (M_u, M_un, V_u); stageF 1669–1690 | 15842 `gF`/`gSet`, 15848 V_u | Station moments change in 108/108; 38/108 show a moment reversal ST misses. Governing ratios: 0 changed |
| 3 | Shear: tension field vs V_cr | GD | 6.10.9.1, 6.10.9.3.2 (Eqs. -2, -8), 6.10.9.3.3 + C6.10.9.3.3 | 1840–1880, 1858 (check), 2184 (rating) | 14599 `webShear`, 15946 | Shear ratio −13.3 % (all 108); shear RF_inv +18 to +22 %; no flips |
| 4 | Negative flexure: App. A6 | GD (where permitted) | 6.10.6.2.3, 6.10.8, A6.1–A6.4 | 1543 FncNeg, 1807–1810 | 15899–15921, GS9 16025, GS22 | 0 on the test projects (GD itself finds A6 not permitted in builtin and xsA) |
| 5 | Constructibility | GD | 6.10.3.2, 6.10.3.3, 6.10.3.4.1, 3.4.2.1 | 1878–1910 | 15927 (M_c), 18457 `saSeq`, GM.oh | Not reproducible in the frame; see §5 |
| 6 | R_b | GD | 6.10.1.10.2 | 1539, `loadShedRbG` 697 | 15874 (R_b = 1 for +M), 15790 `rbFactor` | 0 (no payload has R_b < 1) |
| 7 | F_crw D_c/D floor | same in practice | 6.10.1.9.1 (Eqs. -1, -2) | `webFcrw` 1367 | 15791 `fcrw` | 0 (the floor cannot bind unless D/t_w > about 1,370) |
| 8 | LLDF | GD | 4.6.2.2.2, 4.6.2.2.3, 4.6.2.2.2d/e, 3.6.1.1.2 | `distFactorsSteel` 1265 | GM.df 17009, `dfMember` 16797 | Not used for any result with a GD payload. ST's own g_M is +3.7 to +37.7 % vs GD (exterior) and −0.5/+0.9 % (interior) |
| 9 | Studs (Z_r and the rest) | GD | 6.10.10.1.2, 6.10.10.2, Table 6.6.1.2.3-1 (Cond. 9.2), Table 6.6.1.2.5-1, 6.10.10.4 | 2085–2150 | GM.sc 14776/14800, `gdFatStud` 16504, FA_STUD 16489 | Constants identical. ST fails studs (strength 85/108, fatigue 80/108); GD passes the same girders (SC1 ≤ 0.87, SC2 ≤ 0.99) |
| 10a | LL deflection | GD | 2.5.2.6.2, 3.6.1.3.2 | 1728–1734 | SA 17917 `lld`, SA3 17937 | ST Δ is +41 % vs GD (builtin G1 0.730 vs 0.519 in; xsA G1 0.572 vs 0.407 in). No flips (L/800) |
| 10b | Camber | equivalent | 6.7.2 / C6.10.1.2 (staged sections) | 1918–1966 | SA 17916 dS/dDk/dSD/dTot | ST vs GD: builtin G1 1.435 vs 1.440 in (−0.3 %); xsA G1 1.859 vs 1.871 in (−0.6 %) |

### 1. Modular ratio n
- **ST** (`const n=Math.max(6, Math.round(nRaw))`, line 1519) rounds to the nearest integer with a minimum of 6. For the payloads, n = 6 where n_raw = 6.315 (f′c = 5) and n = 7 where n_raw = 6.798.
- **GD** (`modRatio`, 13384) uses n = E_s/E_c by default (nRule 'exact'), with a 'round' option.
- **10th Ed.:** Eq. 6.10.1.1.1b-1 is n = E/E_c, with no rounding and no minimum. The minimum of 6 is a left-over from the old table of earlier editions. **GD is more accurate.**
- **Change (ST to exact):**
  - +M Strength I ratio −0.17 to +0.30 %;
  - fatigue −0.17 to +0.30 %;
  - stud fatigue pitch −0.64 to +0.41 %;
  - LL deflection −0.66 to +1.14 %;
  - flexure RF −0.40 to +0.23 %;
  - flips: builtin28 AASHTO/CTDOT G1 and G5 stud fatigue, 1.004 to 0.998.
  - Negative flexure, Service II, shear and constructibility are unchanged (the cracked section and the steel section do not use n).
- **Unify:** in the frame, take n from the host. The payload already carries `girderDetail.materials.n`, the n of GD's nRule, so the change is a one-line shim (`n = ext GD n || nRaw`). Do not round. The ST stand-alone (no payload) path also uses n_raw.
- **Check case:** f′c = 5 ksi, w_c = 0.150, K1 = 1 → E_c = 120000(0.150²)(5^0.33) = 4,592.2 ksi → n = 29,000/4,592.2 = 6.315 (before: 6).

### 2. Load factors by sign (Strength I)
- **ST:**
  - M_u = γ_DC(M1 + M2) + γ_DW M_w + γ_LL M_LL+, and the same with M_LL− for M_un (1655–1656);
  - V_u = |γ_DC(V1 + V2) + γ_DW V_w| + γ_LL|V_LL|, where V_LL is the larger of |+| and |−| (1657);
  - stageF uses the same maximum factors (1675–1690).
- **GD:** each permanent load takes its maximum or minimum factor by sign, relative to the effect checked (`gSet`, 15842). Moment reversal is GS19.
- **10th Ed.:** 3.4.1 and Table 3.4.1-2 (DC 1.25/0.90, DW 1.50/0.65): select the factors that produce the extreme effect. **GD is more accurate.** ST is unconservative where dead load relieves.
- **Change:**
  - The station moments change in every payload. In 38/108 a +M_un (ST) becomes a negative design moment at an interior station. Worst case: def15_RIDOT G2 at x = 55 ft, M_un +30.7 → −559.7 k-ft.
  - The largest relative station change is gd_curb_RIDOT_G1.
  - No governing ratio changes on these end spans: the governing +M and −M stations have dead load and live load of the same sign.
  - Expect changes where a smaller flange zone sits in the reversal region (an interior span, or zones near the inflection point).
- **Unify:** port GD's `gF` rule into ST's M_u, M_un, V_u and stageF, using η_min from `ownLFOf` (etaN). For shear, use V_LL+/V_LL− by direction (`ext.V_LLpos`/`V_LLneg` already exist) instead of the larger magnitude.
- **Check case:** def15_RIDOT_Iyes_G2, x = 55 ft. Read M1, M2, M_w and M_LL− from the station table, then compare 1.25·M_DC + 1.50·M_DW + γ_LL·M_LL− (before) with 0.90·M_DC + 0.65·M_DW + γ_LL·M_LL− (after, η = 1).

### 3. Shear: tension field vs V_cr
- **ST:**
  - Computes V_n,int (TFA) per station (`shearCalc`, 1867), but the check is V_uPeak/(φV_cr) (1858; check row 2259).
  - The rating uses φ_cφ_sV_cr (2184).
  - The panels within d_o of **both** span ends are treated as end panels, including the end at an interior pier.
  - One d_o, the largest GD spacing in the span (GD70 overlay, 1140), is used for every panel.
- **GD:** `webShear` per row and panel. The end-panel flag is set only at abutments. Interior and pier panels use Eq. 6.10.9.3.2-2 or -8. The largest V_u in the panel is taken per 6.10.9.3.1 (GS11, 16039).
- **10th Ed.:**
  - 6.10.9.3.3 limits V_n to V_cr only for end panels; C6.10.9.3.3 makes these the panels adjacent to simple supports.
  - Interior stiffened panels (d_o ≤ 3D) may use the tension field (6.10.9.3.2).
  - **GD is more accurate.**
- **Change** (ST with pier-side panels on TFA, d_o unchanged):
  - The shear ratio is −13.3 % in all 108 payloads; V_n,int/V_cr = 1.153 (d_o = 60 in, D = 60 in).
  - The maximum ratio drops from 0.621 to 0.539. Shear RF_inv rises 18–22 % (xsA G2 2.19 → 2.66).
  - GD, same girders: builtin G3 pier 0.445 vs ST 0.496; xsA G2 pier 0.511 vs ST 0.612. The remaining difference is V_u by direction (item 2) and the panel d_o.
- **Unify:**
  - (a) Use `parent.webShear(D, tw, Fyw, do, flgA, end)` per station, with `end` true only at a support whose M_un ≥ −1 (abutment).
  - (b) Later, take the panel d_o per station from `girderDetail.details.transverseStiffener.rowsBy` rather than the maximum.
  - (c) Rating shear on the same V_n.
- **Check case:** D = 60, t_w = 0.5625, F_yw = 50, d_o = 60 in.
  - k = 5 + 5/(1)² = 10; D/t_w = 106.7; 1.40√(Ek/F_yw) = 106.6, so C = 1.57/(106.7²)(29000·10/50) = 0.800.
  - V_p = 0.58(50)(60)(0.5625) = 978.8 kip; V_cr = 783 kip.
  - 2Dt_w/(b_fc t_fc + b_ft t_ft) ≤ 2.5, so V_n = V_p[C + 0.87(1 − C)/√2] = 978.8[0.800 + 0.123] = 903.6 kip (GD GS11 shows 903.55).
  - Ratio V_n/V_cr = 1.153.

### 4. Negative flexure, Appendix A6
- **ST:** 6.10.8 only (F_nc,neg 1543, ratios 1807–1810), on a prismatic L_b with C_b = 1. ST has no nonprismatic 6.10.8.2.3c and no f_ℓ.
- **GD:**
  - A6 is used where 6.10.6.2.3 permits it and the owner allows it (`useA6`, 15921; GS22 owner rule).
  - It also covers nonprismatic L_b (γ_e, App. D6.6.2 Method A).
  - GD gates A6 off when the L_b is nonprismatic. It does not test the skew ≤ 20°, contiguous-lines and holes conditions of 6.10.6.2.3; it lists them for the engineer (16246).
- **10th Ed.:** 6.10.6.2.3 makes A6 optional for straight bridges with skew ≤ 20°, F_y ≤ 70, a noncompact web (Eq. -1) and I_yc/I_yt ≥ 0.3. A6 is the more accurate resistance where it applies; elsewhere 6.10.8 governs. **GD is more accurate**, through A6 and the nonprismatic handling.
- **Change:**
  - A6 changes nothing on builtin or xsA: GD reports "not permitted" (nonprismatic L_b).
  - The 6.10.8 implementations still differ:
    - xsA pier 1: GD GS7 1.048 (interior) / 1.042 (exterior) vs ST 1.06–1.14;
    - builtin: 0.894/0.920 vs ST 0.888–0.940.
  - ST fails Neg flex in 29/108 payloads and Neg tens in 9/108.
- **Unify:** do not re-implement A6 in ST. Have the frame request GD's GS7/GS9 result for the girder's pier location (by message, or `parent.GM.gs` with a row built by `gsaRows` for the station). Alternatively, retire ST's −M check in favour of GD's gs any-location (gsa). One-line question to the engineer: should the 20° skew gate be enforced in GD (builtin28 has 28°)?

### 5. Constructibility
- **ST** (1878–1910):
  - M_c = 1.25·M_DC1(final, all deck at once) + 1.5·w_constr·x(L − x)/2, the simple-span construction LL even on a continuous girder;
  - V_c likewise;
  - R_b = 1;
  - no deck placement sequence, no f_ℓ.
- **GD:**
  - M_c = γ_cdc·M_DCc + γ_ccl·M_CL (15927). M_DCc is the deck-placement-sequence envelope from `saSeq` (18457, SA7), and M_CL is the continuous construction LL.
  - f_ℓ comes from the overhang brackets (GM.oh), plus C_b for deck placement and nonprismatic L_b (CB1/CB2).
- **10th Ed.:** 6.10.3.4.1 requires the deck casting sequence to be considered; 6.10.3.2.1–2 and 6.10.3.3 give the checks; C6.10.3.4 covers the overhang brackets. **GD is more accurate.**
- **Change:**
  - builtin interior: span-1 +M top flange ST 0.464 vs GD 0.389 (ST conservative, simple-span CL). Pier 1 bottom flange ST 0.353 vs GD 0.404 (ST **unconservative**, no sequence).
  - Exterior: ST 0.389/0.297 vs GD 0.324/0.340.
- **Unify:**
  - Extend the hand-off with `M_DCc`/`V_DCc` (sequence envelope) and `M_CL`/`V_CL` stations (HANDOFF.md §4.9, schemaVersion 1 additive fields; a cross-tool change in one tool).
  - ST then uses them when present (old payloads keep today's path).
  - Better still, show GD's GS14–16 / oh results in the frame; f_ℓ is beyond ST.

### 6. R_b
- **ST:**
  - Positive: `loadShedRbG` with the elastic D_c of the n section, bypassed only by `compactWeb` (1539).
  - Negative: cracked D_c (1540).
  - Constructibility: 1.0.
- **GD:** R_b = 1 for +M composite (15874); `rbFactor` for −M.
- **10th Ed.:** 6.10.1.10.2: R_b = 1.0 for constructibility, and for composite +M sections with the web meeting 6.10.2.1.1 (D/t_w ≤ 150), or when Eq. -1 holds. **GD is more accurate.**
- **Change:** none on the 108 payloads (no segment has R_b < 1).
- **Unify:** a one-line rule in ST (`deck.deckOn && D/tw ≤ 150 → 1.0`), or `parent.rbFactor`. A §4 callout is still needed (formula change for slender webs).

### 7. F_crw floor
- **ST:** k = 9/max(D_c/D, 0.05)² (1368).
- **GD:** k = 9/(D_c/D)², with D_c ≥ 1e−6 at the callers (15925, 15936).
- **10th Ed.:** Eq. 6.10.1.9.1-2 has no floor. It sets k = 7.2 when both web edges are in compression, which **neither tool implements**; raise this with the engineer, do not fix it in passing.
- **Change:** none. With D_c/D < 0.05, 0.9Ek/(D/t_w)² exceeds R_hF_yc unless D/t_w > about 1,370 for 50 ksi, so the cap governs either way.
- **Unify:** `parent.fcrw`.

### 8. LLDF
- **With a GD payload**, ST does not apply its DFs (`liveLoadPerGirder`, 1576). `distFactorsSteel` only feeds:
  - the K_g/DF display;
  - the fatigue fallbacks (not used: fatImp and fatImpV are true);
  - g_Δ = mN_L/N_b (the same formula as GD, so the result is identical).
- **ST's own exterior g_M** is +3.7 to +37.7 % above GD's (two-wheel lever rule, rigid section; no lever-rule multi-lane configurations or range checks). Interior is within 1 %.
- **10th Ed.:** 4.6.2.2.2b/d/e, 4.6.2.2.3a/b/c, 3.6.1.1.2. **GD is more accurate.**
- **Unify:** in the frame, display `girderDetail.df` (spans, piers, fatM/fatV) instead of the computed DFs. There is no result change. The stand-alone ST path keeps its own.

### 9. Studs
- **Z_r constants are identical:** A = 1040e8, m = 5, (ΔF)_TH = 7.0; Z_r = (ΔF)_n A_sc (ST 2090–2096; GD FA_STUD 16489, `gdFatStud` 16504, 14800). So is Q_n = 0.70A_scF_u with φ_sc = 1.0.
- **ST** is a single-zone model:
  - one n (the largest from GD, GD70);
  - one (n_row, p): the zone with the largest p/n;
  - the Fatigue I/II crossover from a fixed 0.80/1.75;
  - strength counts the studs of that pitch over the whole length.
- **GD:** per zone, n per Table 6.6.1.2.5-1 near piers, γ_I/γ_II from the Fatigue module, V_sr including F_fat (radial), and per-region P = P_p + P_n.
- **10th Ed.:** 6.10.10.1.2 and 6.10.10.2 are per location; 6.10.10.4.2 is per region. **GD is more accurate.**
- **Change:**
  - ST: studs strength fails 85/108, studs fatigue fails 80/108.
  - GD, same projects: SC1 ≤ 0.87 and SC2 ≤ 0.99, all pass.
  - Examples: builtin G2/G3 ST 1.18/1.10 vs GD 0.99/0.87; xsA G2 ST 1.33/1.22 vs GD 0.91/0.84.
- **Unify:** show GD's SC1/SC2/SC6 per zone in the frame (payload `details.studs.zones` already present; add the per-zone results), or port the per-zone loop. The ST single-zone check becomes a stand-alone-only path.

### 10. Deflection and camber
- **LL deflection:**
  - **ST** (1728–1734): simple span L, I of the midspan n section, axles at midspan.
  - **GD SA:** continuous staged model with cracked zones; influence-line maximum per span (`lld`, 17917).
  - **10th Ed.:** 2.5.2.6.2 and 3.6.1.3.2. **GD is more accurate.**
  - **Change:** ST Δ is about 41 % higher (builtin G1 0.730 vs 0.519 in; xsA G1 0.572 vs 0.407 in). No flips at L/800. The owner limits L/1000 (MassDOT, RIDOT) could flip.
  - **Unify:** add `lld` (Δ, limit, x per span) to the payload; ST shows it when present.
- **Camber:**
  - **ST:** double integration of the imported moments with ST's own segment I (bare / 3n uncracked) within the span (1918–1966).
  - **GD:** virtual work on the whole girder, F.I3 (cracked where fe), cross-frame weights.
  - **Results:** within 0.3–0.6 %; the difference comes from the I(x) definitions and n (item 1).
  - **Unify:** use GD SA `dS`/`dDk`/`dSD`/`dU` per girder (payload field) for the camber table. ST's integration becomes a cross-check.

### Proposed unification mechanism

The frame is same-origin (srcdoc), so it can call the host directly: `window.parent.webShear`, `fcrw`, `rbFactor`, `modRatio`, `GM.gs`.

1. **Preferred:** keep `st-src` verbatim and add **ST_SHIMS** entries (anchor → `parent.SBD_A610.fn(...)` with a stand-alone fallback). `SBD_A610` is the PLAN's namespace of proven host functions.
   - Each unification is one host-only PR, so CLAUDE.md §7 holds (one tool).
   - `tests --tool sbd` then lists the expected differences against `stgirder.html`: record the new sbd baseline, and list each changed key in the PR.
2. **Data-only items** (5, 9, 10a, 10b): add fields to `gdStPayload` (13 additive keys; schemaVersion stays 1; old payloads keep today's path). Then add a shim that reads them. This also follows HANDOFF.md §4.9.
3. **Avoid** editing `stgirder.html` itself: it is retired at cut-over, and the CLAUDE.md §3 duplication rule would otherwise force double edits.

### PR order (each one a §4 PR with before/after, article and check case)

| PR | Items | Change on the payloads |
|---|---|---|
| S2-1 | n exact (1) | Every section property changes, so it goes first and later baselines include it. |
| S2-2 | R_b and F_crw via the host (6, 7) | Zero change on the payloads; a §4 callout for the edge cases. |
| S2-3 | Load factors by sign, M and V (2) | Stations change; governing ratios unchanged. |
| S2-4 | Shear TFA, end panels only at abutments, rating on the same V_n (3) | −13 % shear. |
| S2-5 | LLDF display from the payload (8) | Display only. |
| S2-6 | Studs per zone from GD (9) | Removes 85 + 80 false fails. |
| S2-7 | LL deflection and camber from GD SA via payload fields (10) | — |
| S2-8 | Constructibility with sequence, continuous CL and f_ℓ (5) | Payload schema addition. |
| S2-9 | Negative flexure from GD GS7/GS9 (4) | Needs the 20° skew question answered first. |

---

## Part 2: port the ST-only features into native GD modules

**Key fact:** ST's engine (`computeAll` and its helpers, ST 552–2296) is plain JS. Only the banner/note components between 929 and 1210 are JSX. So the calculations can be copied into the host under a namespace (`STX.*`) and checked for exact equality. The real cost is the UI and report: React → GD's `card`/`T\`\``/MathJax templates, KaTeX `Tx` → MathJax `T`.

**Common test (all features):**
- A new `--tool sbdnative` section reads `STX.computeAll(session)` in the host and the frame's `computeAll(session)` for the same applied payload, and compares the feature's object with deep equality, all 108 payloads plus builtin.
- A second section compares the numbers of each native card or report section with the frame's tab and report text (`st.tab.Deck`, `st.report.all`, …): number sequences extracted per line, exact to the printed digits.
- Run it after Part 1, so both sides use the unified methods.

### Deck slab design (ST `deckDesign` 1444, `deckTableA4` 1427, DeckTab 3800, `deckWorkedDeriv` 3769, report section 'deck')
- **Inputs:**
  - S (or per bay), t_s, t_s for dead load (sacrificial), f′c, w_c, f_y deck;
  - bar areas and spacings top/bottom, covers;
  - future wearing surface (ksf), overhang, barrier weight and base width;
  - x_neg (auto b_ft/4, 4.6.2.1.6);
  - owner Strength I factors (γ_DC, γ_DW, γ_LL × η, m).
- **Outputs:**
  - +M, −M and overhang M_u, φM_n, D/C;
  - A, d, a, c, ε_t, φ (5.5.4.2);
  - Table A4-1 interpolation flags (out of range, x clamped);
  - equivalent strip widths (reference);
  - distribution reinforcement % (9.7.3.2).
- **Report:** method, three worked cases, summary table, owner-factor callout.
- **Dependencies:** GD df.bridge (spacings, overhangs, edges/barriers), df.dl (wearing surface), gs deck (t_s, f′c, w_c), plate b_ft (from PL), `gdLF()`. New saved inputs for the rebar, under P.dk, a new key inside the existing GD project (no new localStorage key).
- **Native scope gains:**
  - per-bay S (GD has variable spacing);
  - left and right overhangs;
  - curb edges (ST declines these today).
  - Gaps to raise (do not fix while porting): crack control 5.6.7, minimum reinforcement, Extreme Event II barrier collision A13.4 (the "13.4" ref is overstated), and the dead load wS²/10 approximation.
- **Effort:** M (2 PRs: engine + card; report + DXF note).

### LRFR Inventory/Operating rating, including Service II (ST 2152–2230, RatingTab 4364, report 'rating')
- **Inputs:** φ_c, φ_s (MBE 6A.4.2.3/6A.4.2.4, floor 0.85), γ_DC 1.25, γ_DW 1.50, γ_LL 1.75/1.35, Service II γ_LL 1.30/1.00.
- **Outputs:** RF_inv and RF_opr for +M (M_p or stress basis), −M, shear, Service II flange; governing value and location; owner target line.
- **Native design:** extend GD's GS20 `gsRateCheck` (16130), which already derives RF from the module's own checks:
  - add Operating (k = 1.35/1.75 and 1.00/1.30);
  - add the φ_cφ_s factor on strength capacities (r/φ_cφ_s);
  - report per limit state, per row or station (gsa for every node).
  - This automatically uses A6, TFA, sign factors and nonprismatic L_b. So **native ≠ today's ST**: test against ST *after* S2-1 to S2-4 and S2-9, or compare only the items both compute identically (Service II, +M).
- **Dependencies:** GM.gs rows (PL) or `gsaRun` all-stations; `gdOwnRules('rate.*')`.
- **Effort:** M–L (2 PRs).

### Optimize (ST 4404)
- **What it does:** sweeps t_fb ±0.75 in by 1/8 in, recomputing every check, and tabulates and plots flexure, shear, Service II and "all pass".
- **Native:** reuse GD's Suggest/auto-design machinery (`runAutoDesign` 19092, PL Suggest), or a small sweep over `gsaRun` with the bottom-flange plate of the selected zone. Inputs: girder, zone, plate, range and step. Output: the same table and plot.
- **Test:** equality with ST's table when the native sweep calls `STX.computeAll` (port parity); then a §4 PR switches it to GD checks.
- **Effort:** S–M.

### Camber (ST 1918–1966, CamberTab 3991, `camberDeriv` 3967, report 'camber')
- **Outputs:**
  - DC1 split into steel (+ diaphragms) and wet (M1 − M_steel), DC2, DW, existing utilities;
  - total; maximum and its x;
  - per-station table; splice markers.
- **Native:** GD SA already has dS, dDk, dSD, dU, dTot per node and the DXF camber diagram. The port adds ST's breakdown table, chart and worked integration text to an SA "Camber" card. If the engineer wants ST's numbers rather than SA's, use `STX` deflShape as a cross-check column.
- **Test:** parity of `STX` deflShape with the frame (exact); SA vs ST within the item 10b band (≤ 1 %), reported rather than asserted.
- **Effort:** S.

### Nomenclature (NOMEN_ROWS 4432, tab 4445, report appendix)
- **What it is:** a static table.
- **Native:** append it to GD's manual and report appendix. The GD manual already defines most symbols; merge without duplication.
- **Test:** the row text is identical.
- **Effort:** XS.

### Also ST-only, needed before the frame can go (decide port or drop)
- stand-alone input mode with the built-in simple-span HL-93/LLDF;
- MIDAS/MCT/PS-Girder envelope imports (`buildExternal`; other producers on `girderDemands`);
- Section, Stresses, Diagrams, Fatigue, Stiffener and Connector tabs (GD modules cover these, per zone);
- PNA-below-web handling (GD has PNA-OOS);
- ST JSON export/import and undo;
- the ST CalcDoc report;
- ST keys `stgirder.*`: keep them readable for one import migration (CLAUDE.md §5).

---

## Part 3: sequence and effort to retire the ST frame

Sizes: S ≈ 1 PR, about ½–1 day including review; M ≈ 1–2 PRs; L ≈ 2–4 PRs.

1. **Payload coverage.** Add interior-span payloads (`_selSpan` 2) and owner variants for the merge test set. S.
2. **Part 1 unifications** S2-1 … S2-9 (frame shims and payload fields). About 9 PRs: S, S, M, M, S, M, M, L, M, which is roughly 10–14 days. Re-record the sbd baseline after each.
3. **Engine port** `STX` (ST computeAll and helpers copied into the host namespace, no UI) with the parity test on 108 + builtin. M (1–2 PRs). After this, every native card can read `STX` results without the frame.
4. **Native features:** Nomenclature (XS) → Camber card (S) → Deck slab module (M) → Rating extension of GS20 with Operating and φ_cφ_s (M–L) → Optimize (S–M). About 6–8 PRs.
5. **Native views of the remaining ST tabs** that GD lacks in single-girder form: the station-by-station girder sheet (Section, Stresses, Diagrams). This uses gsa (any location) and `STX`. M–L, 3–4 PRs.
6. **Decisions** (engineer):
   - drop ST stand-alone mode and the MIDAS/MCT import, or port the import into GD SA as "external demands";
   - the redirect of `stgirder.html`;
   - a one-time migration of `stgirder.session` into the SBD project file (PLAN step 4).
   S–M.
7. **Retire the frame:** remove `st-src`, ST_SHIMS, the frame bus, and React/Babel/KaTeX from SBD; update tools.html, docs and tests (`--tool st` stays for the old file until it is redirected). M.

**Total:** about 25–32 PRs, roughly 5–7 weeks of agent work at the current review cadence.

**Critical path:** S2-1…S2-4 → STX parity → Rating (it depends on the unified capacities) → retire.

**Risks:**
- Parity tests only cover end spans until step 1 is done.
- The rating will move by the Part 1 deltas (shear RF +18–22 %; −M through GD's GS7). That needs the engineer's sign-off as a §4 change, not a refactor.
