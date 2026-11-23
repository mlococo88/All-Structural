# Fix log — shared/deck.js (window.SharedDeck)

Transverse design of a concrete deck slab on girders by the strip method. Loaded by `apps/steel-bridge/index.html` (engine: `apps/steel-bridge/engine/deck.js`).
The Prestressed Bridge Design app has the same method in its own frozen engine copy (`apps/ps-bridge/engine/pbd-handling-deck.js`) and is **not** wired to this file; `tests/engine/deck-parity.test.mjs` proves the two give identical numbers.

## 2026-11-23 — PR: claude/sb-deck-design (DK) — new file: the deck strip design of the Prestressed app, written once for the Steel Bridge app   [NEW CALCULATION in Steel Bridge Design; no existing result changes]
- **Why:** engineer request 2026-11-23: the Steel tool gets the deck design the Prestressed tool has. CLAUDE.md §3: calculation code used by more than one tool lives once in `shared/`.
- **What it is:** `tableA4(S, x)`, `designSection(kind, b)`, `interior(o)`, `capacity(o)`, `overhang(o)`, `distPct(S)`, `strip(inp)` (the whole design with the Prestressed module's inputs and result names) and the worked-step writers `steps.interior / capacity / overhang / dist` (shared/steps.js format).
- **Before / After:** new file. The expressions are those of the Prestressed module's `deckTableA4`, `deckDesignSection`, `deckCalc`, operation for operation:
  - dead load, interior bay: `M_DC+ = w_DC S²/11`, `M_DC− = w_DC S²/10` (the same for DW), S = girder spacing centre to centre;
  - live load + IM: Table A4-1 (held as data, the same 45 × 9 numbers as the Prestressed module), interpolated on S (0.25 ft rows), then the negative moment on the design-section distance (0, 3, 6, 9, 12, 18, 24 in); S below 4 ft / above 15 ft uses the end row and is flagged;
  - Strength I: `M_u = η [1.25 M_DC + 1.50 M_DW + 1.75 (m M_LL)]`;
  - resistance: `A_s = 12 A_b/s`, `d = t_s − cover − d_b/2` (`d_b = √(4A_b/π)`), `a = A_s f_y /(0.85 f'c 12)`, `β1 = 0.85 − 0.05(f'c − 4)` within 0.65–0.85, `c = a/β1`, `ε_t = 0.003(d/c − 1)`, `φ = 0.75 + 0.15(ε_t − 0.002)/0.003` within 0.75–0.90, `M_n = A_s f_y (d − a/2)/12`;
  - overhang: `X = max(o_h − x_f − 1.0, 0)`, strip `45.0 + 10.0 X` in, `M_LL = 1.33 (1.20)(16) X /(strip/12)`, dead loads about the girder centreline;
  - distribution steel: `min(220/√S, 67)` percent.
- **New relative to the Prestressed module (used by Steel only; with the Prestressed inputs the results are identical):**
  - `designSection('steel', b)` = `b_f/4`, kept within 0–24 in (AASHTO LRFD 10th Ed. Art. 4.6.2.1.6, steel I-girder); the Prestressed rules (`b_tf/3 ≤ 15 in`, closed box `b/2`) are the other two kinds;
  - `overhang()` takes a list of dead loads (line loads at a position, area loads over a strip) and an optional pedestrian load instead of one barrier and one wearing surface: `M = w (o_h − x)` and `M = q[(o_h − x0)² − (o_h − x1)²]/2`; the pedestrian moment is added to the wheel inside the 1.75 term, without IM, multiple presence or the owner multiplier m. **Decision (pending engineer review):** wheel and pedestrian load taken together (the conservative choice).
- **Governing provisions:** AASHTO LRFD 10th Ed. (2024) Art. 4.6.2.1 (strip method), 4.6.2.1.6 (design section), Table A4-1, Table 3.4.1-1 (Strength I), 1.3.2.1 (η), 5.6.3.2 and 5.6.2.2 (flexural resistance), 5.5.4.2 (φ), 3.6.1.3.1 (wheel 1 ft from the face), Table 4.6.2.1.3-1 (overhang strip), 3.6.2 (IM), 3.6.1.1.2 (multiple presence), 3.6.1.6 (pedestrian load), 9.7.3.2 (distribution reinforcement).
- **Not checked (as the Prestressed module):** Extreme Event II collision cases of the overhang (A13.4), crack control (5.6.7), minimum reinforcement (5.6.3.3), temperature and shrinkage steel (5.10.6), empirical design (9.7.2), bar development.
- **Check case 1 (interior bay; made-up deck):** S = 8.5 ft, slab 8 in (dead load 8 in), w_c 0.150 kcf, w_DW 0.030 ksf, top flange 14 in, f'c 4 ksi, f_y 60 ksi, bottom #5 at 7 in (cover 1.0 in), top #5 at 6 in (cover 2.5 in).
  - x = 14/4 = 3.5 in; w_DC = 8/12(0.150) = 0.1000 ksf
  - M_DC+ = 0.1(8.5)²/11 = 0.6568; M_DW+ = 0.03(72.25)/11 = 0.1970; M_DC− = 0.7225; M_DW− = 0.2168 kip-ft/ft
  - Table A4-1, S = 8.5 ft: M_LL+ = 5.99; M_LL− = 5.82 + (4.98 − 5.82)(0.5/3) = 5.68 kip-ft/ft
  - M_u+ = 1.25(0.6568) + 1.50(0.1970) + 1.75(5.99) = 11.599; M_u− = 1.25(0.7225) + 1.50(0.2168) + 1.75(5.68) = 11.168 kip-ft/ft
  - bottom: A_s = 12(0.31)/7 = 0.5314 in²/ft; d = 8 − 1 − 0.628/2 = 6.686 in; a = 0.5314(60)/40.8 = 0.7815 in; c = 0.9194 in; ε_t = 0.0188 → φ = 0.90; M_n = 0.5314(60)(6.686 − 0.391)/12 = 16.727; φM_n = 15.054; **ratio 0.770**
  - top: A_s = 0.620; d = 8 − 2.5 − 0.314 = 5.186 in; a = 0.9118 in; ε_t = 0.0115 → φ = 0.90; M_n = 14.663; φM_n = 13.197; **ratio 0.846**
  - distribution: 220/√8.5 = 75.5 → 67 %.
- **Check case 2 (overhang; made-up):** o_h = 3.5 ft, barrier 18 in wide of 0.45 klf (centroid 0.75 ft from the edge), dead-load slab 9 in, w_DW 0.025 ksf, slab 8.5 in, top #5 at 5 in (cover 2.5 in).
  - w_DC = 9/12(0.150) = 0.1125 ksf; X = 3.5 − 1.5 − 1.0 = 1.0 ft; strip = 55 in
  - M_DC = 0.1125(3.5)²/2 + 0.45(2.75) = 1.9266; M_DW = 0.025(2.0)²/2 = 0.050; M_LL = 1.33(1.20)(16)(1.0)/(55/12) = 5.5715
  - M_u = 1.25(1.9266) + 1.50(0.050) + 1.75(5.5715) = 12.233 kip-ft/ft
  - A_s = 0.744; d = 5.686 in; a = 1.0941 in; φ = 0.90; M_n = 19.116; φM_n = 17.205; **ratio 0.711**
- **Check case 3 (overhang with a sidewalk and pedestrians, η = 1.05, m = 1.2):** tests/engine/deck.test.mjs "hand check 3": M_u = 1.05[1.25(3.05) + 1.75(1.2(7.6608) + 0.2344)] = 21.326 kip-ft/ft.
- **How verified:** `tests/engine/deck.test.mjs` (6 tests: the three hand checks above with the arithmetic written out, φ transition, design-section rules, steps = results); `tests/engine/deck-parity.test.mjs` (14 tests: Table A4-1 entry by entry; the lookup at 1,400 points; 10 made-up decks, every value of the Prestressed `deckCalc` identical with `Object.is`, no tolerance: I-girders, a closed box, entered design section, S outside the table, zero bar spacing, f'c 10 ksi, owner η and m); `tests/engine/tex.test.mjs` parses every step string with KaTeX.
- **Tools that load it:** Steel Bridge Design (`apps/steel-bridge`). Not loaded by the Prestressed app.
- **Other copies:** `apps/ps-bridge/engine/pbd-handling-deck.js` (frozen copy of the old Prestressed app's engine: `A4_1`, `deckTableA4`, `deckDesignSection`, `deckCalc`) and the same code in `Prestressed Bridge Design.html`. Keep them in step until the Prestressed app is moved onto this file (a later PR of its own: the engine copy is frozen); the parity test fails if either side changes.
- **Open items (found in the Prestressed module, mirrored here unchanged, for the engineer to decide; see fixlog/steel-bridge.md DK):**
  1. Distribution reinforcement uses S = the girder spacing centre to centre; Art. 9.7.3.2 defines S as the effective span of Art. 9.7.2.3 (shorter), which gives a larger percentage when 220/√S is below 67 % (S above about 10.8 ft). Slightly unconservative for wide spacings.
  2. φ varies between ε_t = 0.002 and 0.005 for every bar grade; Art. 5.5.4.2 / 5.6.2.1 set the compression-controlled limit ε_cl = f_y/E_s and, above 75 ksi, a different tension-controlled limit. Exact for Grade 60 only.
  3. No crack control (5.6.7), minimum reinforcement (5.6.3.3) or temperature and shrinkage (5.10.6) check, and no Extreme Event II overhang design (A13.4). Stated on the tab and in the report.
  4. Dead-load moments use the coefficients wS²/10 and wS²/11 with S centre to centre, and the negative dead-load moment is not reduced to the design section (conservative).
  5. The overhang moment is taken at the girder centreline, not at the design section of 4.6.2.1.6 (conservative), and the slab weight uses one thickness for the whole overhang.
