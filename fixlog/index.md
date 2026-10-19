# Fix log — index.html

Governing basis used for fixes: AASHTO LRFD 10th Ed. (2024) Table 3.4.1-1 (fatigue load factors); AASHTO MBE (3rd Ed. with interims) Eq. 6A.4.2.1-3, Tables 6A.4.2.3-1 / 6A.4.2.4-1, Appendix D6A legal/posting vehicles; FHWA FAST Act emergency-vehicle load-rating memo (Nov. 2016) for EV2/EV3; AISC Shapes Database v16.0 for rolled-shape dimensions.

## 2026-10-04 — PR: claude/fix-index-mct (PR link added after merge)

Line numbers are those of the fixed file. Every fix lists anchor text to search for.

### F1. `ROLLED_SHAPES` dimensions corrected to AISC Shapes Database v16.0   [calc change] [mostly less conservative — see note]
- **Where:** `const ROLLED_SHAPES` (≈ line 1509). Anchor text: `const ROLLED_SHAPES = {`
- **Problem:** many entries carried tw in the tf slot, or plain wrong values (e.g. W21X55 tf 0.375 / tw 0.315; W36X150 tf 0.625 / tw 0.405; W14X48 d 14.50). `convertRolledToBuiltUp` builds the AREMA "rolled" equivalent section and the MCT equivalent section directly from d/bf/tf/tw, so flange area and Sx were 20–45 % light for most shapes (W14X48 was 4 % heavy because d was 0.7 in too deep).
- **Governing provision:** AISC Shapes Database v16.0 (d, bf, tf, tw). Cross-checked against the in-file `W_SHAPE_PROPS` (d, tw, Zx, Sx): after the fix the plate-model Zx of every W entry is within 1–2.5 % of the tabulated Zx (fillets account for the rest), and every tw now equals `W_SHAPE_PROPS` tw.
- **Rule used:** a field was changed only if it differed from v16.0 by more than the v16.0 rounding (d: 0.05 in; bf < 10 in: 0.01 in; bf ≥ 10 in: 0.05 in; tf/tw: 0.0005 in). Fields already equal to v16.0 at its precision (e.g. d = 13.74 for 13.7) were left alone.
- **Changed shapes / fields (34 of 36 entries):**

  | Shape | Changes |
  |---|---|
  | W14X22 | bf 5.04→5, tf 0.23→0.335 |
  | W14X26 | bf 5.73→5.03, tf 0.255→0.42 |
  | W14X30 | tf 0.285→0.385 |
  | W14X38 | tf 0.313→0.515, tw 0.313→0.31 |
  | W14X48 | d 14.5→13.8 |
  | W16X26 | tf 0.25→0.345 |
  | W16X40 | tf 0.305→0.505 |
  | W16X50 | tf 0.38→0.63 |
  | W16X67 | d 16.54→16.3, bf 8.25→10.2, tf 0.395→0.665 |
  | W18X35 | d 17.61→17.7, tf 0.3→0.425 |
  | W18X50 | tf 0.355→0.57, tw 0.3→0.355 |
  | W18X65 | tf 0.45→0.75 |
  | W21X44 | tf 0.35→0.45 |
  | W21X55 | bf 8.27→8.22, tf 0.375→0.522, tw 0.315→0.375 |
  | W21X68 | tf 0.43→0.685 |
  | W24X55 | tf 0.395→0.505 |
  | W24X68 | bf 8.99→8.97, tf 0.415→0.585, tw 0.385→0.415 |
  | W24X76 | tf 0.44→0.68, tw 0.385→0.44 |
  | W24X94 | tf 0.516→0.875, tw 0.516→0.515 |
  | W27X84 | tf 0.475→0.64, tw 0.29→0.46 |
  | W27X94 | tf 0.49→0.745 |
  | W27X102 | d 26.92→27.1, bf 9.9→10, tf 0.515→0.83, tw 0.315→0.515 |
  | W27X114 | tf 0.57→0.93 |
  | W30X90 | d 29.65→29.5, bf 10.33→10.4, tf 0.47→0.61 |
  | W30X108 | tf 0.545→0.76, tw 0.315→0.545 |
  | W30X124 | tf 0.625→0.93, tw 0.625→0.585 |
  | W36X135 | tf 0.6→0.79 |
  | W36X150 | d 36.19→35.9, bf 11.84→12, tf 0.625→0.94, tw 0.405→0.625 |
  | W36X170 | d 36.41→36.2, tf 0.68→1.1 |
  | W36X194 | d 36.69→36.5, tf 0.765→1.26 |
  | S12X31.8 | bf 5.08→5, tf 0.391→0.544, tw 0.26→0.35 |
  | S15X42.9 | tf 0.411→0.622, tw 0.311→0.411 |
  | S18X54.7 | tf 0.461→0.691, tw 0.359→0.461 |
  | S24X79.9 | bf 6.5→7, tf 0.5→0.87, tw 0.425→0.5 |
  - **Not changed:** `S30X118` and `S36X150` — there are no S30 or S36 shapes in AISC v16.0 (largest S shape is S24), so they cannot be verified. See O1.
- **Before:**
  ```js
    'W14X22': {d:13.74, bf:5.04, tf:0.230, tw:0.230, Fy:50},
    'W14X26': {d:13.91, bf:5.73, tf:0.255, tw:0.255, Fy:50},
    'W14X30': {d:13.84, bf:6.73, tf:0.285, tw:0.270, Fy:50},
    'W14X38': {d:14.10, bf:6.77, tf:0.313, tw:0.313, Fy:50},
    'W14X48': {d:14.50, bf:8.03, tf:0.595, tw:0.340, Fy:50},
    'W16X26': {d:15.69, bf:5.50, tf:0.250, tw:0.250, Fy:50},
    'W16X40': {d:16.01, bf:6.99, tf:0.305, tw:0.305, Fy:50},
    'W16X50': {d:16.26, bf:7.07, tf:0.380, tw:0.380, Fy:50},
    'W16X67': {d:16.54, bf:8.25, tf:0.395, tw:0.395, Fy:50},
    'W18X35': {d:17.61, bf:6.00, tf:0.300, tw:0.300, Fy:50},
    'W18X50': {d:17.99, bf:7.50, tf:0.355, tw:0.300, Fy:50},
    'W18X65': {d:18.35, bf:7.59, tf:0.450, tw:0.450, Fy:50},
    'W21X44': {d:20.66, bf:6.50, tf:0.350, tw:0.350, Fy:50},
    'W21X55': {d:20.84, bf:8.27, tf:0.375, tw:0.315, Fy:50},
    'W21X68': {d:21.13, bf:8.27, tf:0.430, tw:0.430, Fy:50},
    'W24X55': {d:23.57, bf:7.01, tf:0.395, tw:0.395, Fy:50},
    'W24X68': {d:23.73, bf:8.99, tf:0.415, tw:0.385, Fy:50},
    'W24X76': {d:23.92, bf:8.99, tf:0.440, tw:0.385, Fy:50},
    'W24X94': {d:24.31, bf:9.07, tf:0.516, tw:0.516, Fy:50},
    'W27X84': {d:26.71, bf:9.96, tf:0.475, tw:0.290, Fy:50},
    'W27X94': {d:26.92, bf:9.99, tf:0.490, tw:0.490, Fy:50},
    'W27X102': {d:26.92, bf:9.90, tf:0.515, tw:0.315, Fy:50},
    'W27X114': {d:27.29, bf:10.07, tf:0.570, tw:0.570, Fy:50},
    'W30X90': {d:29.65, bf:10.33, tf:0.470, tw:0.470, Fy:50},
    'W30X108': {d:29.83, bf:10.48, tf:0.545, tw:0.315, Fy:50},
    'W30X124': {d:30.17, bf:10.54, tf:0.625, tw:0.625, Fy:50},
    'W36X135': {d:35.55, bf:11.95, tf:0.600, tw:0.600, Fy:50},
    'W36X150': {d:36.19, bf:11.84, tf:0.625, tw:0.405, Fy:50},
    'W36X170': {d:36.41, bf:12.03, tf:0.680, tw:0.680, Fy:50},
    'W36X194': {d:36.69, bf:12.12, tf:0.765, tw:0.765, Fy:50},
    'S12X31.8': {d:12.00, bf:5.08, tf:0.391, tw:0.260, Fy:36},
    'S15X42.9': {d:15.00, bf:5.50, tf:0.411, tw:0.311, Fy:36},
    'S18X54.7': {d:18.00, bf:6.00, tf:0.461, tw:0.359, Fy:36},
    'S24X79.9': {d:24.00, bf:6.50, tf:0.500, tw:0.425, Fy:36},
  ```
- **After:**
  ```js
    'W14X22': {d:13.74, bf:5.00, tf:0.335, tw:0.230, Fy:50},
    'W14X26': {d:13.91, bf:5.03, tf:0.420, tw:0.255, Fy:50},
    'W14X30': {d:13.84, bf:6.73, tf:0.385, tw:0.270, Fy:50},
    'W14X38': {d:14.10, bf:6.77, tf:0.515, tw:0.310, Fy:50},
    'W14X48': {d:13.80, bf:8.03, tf:0.595, tw:0.340, Fy:50},
    'W16X26': {d:15.69, bf:5.50, tf:0.345, tw:0.250, Fy:50},
    'W16X40': {d:16.01, bf:6.99, tf:0.505, tw:0.305, Fy:50},
    'W16X50': {d:16.26, bf:7.07, tf:0.630, tw:0.380, Fy:50},
    'W16X67': {d:16.30, bf:10.20, tf:0.665, tw:0.395, Fy:50},
    'W18X35': {d:17.70, bf:6.00, tf:0.425, tw:0.300, Fy:50},
    'W18X50': {d:17.99, bf:7.50, tf:0.570, tw:0.355, Fy:50},
    'W18X65': {d:18.35, bf:7.59, tf:0.750, tw:0.450, Fy:50},
    'W21X44': {d:20.66, bf:6.50, tf:0.450, tw:0.350, Fy:50},
    'W21X55': {d:20.84, bf:8.22, tf:0.522, tw:0.375, Fy:50},
    'W21X68': {d:21.13, bf:8.27, tf:0.685, tw:0.430, Fy:50},
    'W24X55': {d:23.57, bf:7.01, tf:0.505, tw:0.395, Fy:50},
    'W24X68': {d:23.73, bf:8.97, tf:0.585, tw:0.415, Fy:50},
    'W24X76': {d:23.92, bf:8.99, tf:0.680, tw:0.440, Fy:50},
    'W24X94': {d:24.31, bf:9.07, tf:0.875, tw:0.515, Fy:50},
    'W27X84': {d:26.71, bf:9.96, tf:0.640, tw:0.460, Fy:50},
    'W27X94': {d:26.92, bf:9.99, tf:0.745, tw:0.490, Fy:50},
    'W27X102': {d:27.10, bf:10.00, tf:0.830, tw:0.515, Fy:50},
    'W27X114': {d:27.29, bf:10.07, tf:0.930, tw:0.570, Fy:50},
    'W30X90': {d:29.50, bf:10.40, tf:0.610, tw:0.470, Fy:50},
    'W30X108': {d:29.83, bf:10.48, tf:0.760, tw:0.545, Fy:50},
    'W30X124': {d:30.17, bf:10.54, tf:0.930, tw:0.585, Fy:50},
    'W36X135': {d:35.55, bf:11.95, tf:0.790, tw:0.600, Fy:50},
    'W36X150': {d:35.90, bf:12.00, tf:0.940, tw:0.625, Fy:50},
    'W36X170': {d:36.20, bf:12.03, tf:1.100, tw:0.680, Fy:50},
    'W36X194': {d:36.50, bf:12.12, tf:1.260, tw:0.765, Fy:50},
    'S12X31.8': {d:12.00, bf:5.00, tf:0.544, tw:0.350, Fy:36},
    'S15X42.9': {d:15.00, bf:5.50, tf:0.622, tw:0.411, Fy:36},
    'S18X54.7': {d:18.00, bf:6.00, tf:0.691, tw:0.461, Fy:36},
    'S24X79.9': {d:24.00, bf:7.00, tf:0.870, tw:0.500, Fy:36},
  ```
- **Check case (run in node: `convertRolledToBuiltUp` → `computeAremaSection(z,false)`, actual app functions):**
  - W21X55: before web h = 20.090 in, tw 0.315, flanges 8.27×0.375 → Sx = 82.8 in³; after web h = 19.796, tw 0.375, flanges 8.22×0.522 → **Sx = 108.3 in³** (AISC Sx = 110; hand: I = bf·d³/12 − (bf−tw)·h³/12 = 8.22·20.84³/12 − 7.845·19.796³/12 = 6200 − 5072 = 1128 in⁴, S = 1128/10.42 = 108.3).
  - W36X150: Sx 338.2 → **498.4 in³** (AISC 504). W14X48: Sx 73.0 → **68.6 in³** (AISC 70.2; this one goes DOWN — more conservative). S24X79.9: Sx 110.7 → **174.1 in³** (AISC S24X80 Sx 175).
- **Less conservative:** yes for 33 of 34 shapes — AREMA rolled-section capacities and the MCT equivalent-section stiffness increase (the old values were wrong-light). W14X48 decreases.
- **Existing projects:** a rolled section that was already converted and saved in a project keeps the dimensions stored in that project (`cfg.aremaSection.sectionLibrary`). Re-select / re-convert the shape to pick up the corrected dimensions.
- **How verified:** node run of the real functions (before/after), Babel transpile.
- **Other copies of this code:** none known (`W_SHAPE_PROPS` in the same file was already correct and is not changed).

### F2. AASHTO legal / posting vehicles corrected to MBE Appendix D6A   [calc change] [more conservative for posting tonnage; load model changes]
- **Where:** `VEHICLE_GROUPS` → group "AASHTO Legal / Posting" (≈ lines 1237–1276); `VEHICLE_TONS` (≈ line 9775). Anchor text: `name:"AASHTO Legal Type 3-3"`, `const VEHICLE_TONS = {`
- **Problem:** Type 3-3, 3S2 and SU4–SU7 had wrong axle weights/spacings (3S2 and 3-3 were marked "Approximate… verify"); SU5/SU6/SU7 GVWs were 70/87/105 k instead of 62/69.5/77.5 k, so `RF × tons` posting tonnages were overstated 13–35 % (unconservative) and the MCT analysed the wrong trucks. Type 3 was already correct (unchanged).
- **Governing provision:** AASHTO MBE Appendix D6A figures (AASHTO legal loads Type 3, 3S2, 3-3; specialized hauling vehicles SU4–SU7); MBE 6A.4.4.2.1.
- **Before → after (axle loads k @ spacings ft; GVW):**
  - Type 3-3: 10, 15.5, 15.5, 15.5, 15.5, 8 @ 15, 4, 16, 4, 11 (80 k) → **12, 12, 12, 16, 14, 14 @ 15, 4, 15, 16, 4 (80 k = 40 T)**
  - Type 3S2: 10, 15.5×4 @ 15, 4, 24, 4 (72 k) → **10, 15.5×4 @ 11, 4, 22, 4 (72 k = 36 T)**
  - SU4: 10, 11, 11, 22 @ 11, 5.5, 4 (54 k) → **12, 8, 17, 17 @ 10, 4, 4 (54 k = 27 T)**
  - SU5: 12, 12, 11.5, 11.5, 23 @ 11.5, 5.5, 4, 4 (70 k = 35 T) → **12, 8, 8, 17, 17 @ 10, 4, 4, 4 (62 k = 31 T)**
  - SU6: … (87 k = 43.5 T) → **11.5, 8, 8, 17, 17, 8 @ 10, 4, 4, 4, 4 (69.5 k = 34.75 T)**
  - SU7: … (105 k = 52.5 T) → **11.5, 8, 8, 17, 17, 8, 8 @ 10, 4, 4, 4, 4, 4 (77.5 k = 38.75 T)**
  - `VEHICLE_TONS`: SU5 35 → 31, SU6 43.5 → 34.75, SU7 52.5 → 38.75 (Type 3 / 3-3 / 3S2 / SU4 unchanged at 25 / 40 / 36 / 27).
- **Before (exact code):**
  ```js
      { name:"AASHTO Legal Type 3-3",   label:"Legal Type 3-3", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:80, description:'MBE Appendix D — 6-axle combination truck · 80k GVW = 40T',
        axles:[{load:10,dist:0},{load:15.5,dist:15},{load:15.5,dist:19},
               {load:15.5,dist:35},{load:15.5,dist:39},{load:8,dist:50}],
        trailingLoad:0, trailingNote:'Approximate axle positions — verify against MBE Appendix D',
      },
      { name:"AASHTO Legal Type 3S2",   label:"Legal Type 3S2", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:72, description:'MBE Appendix D — 5-axle tractor-semitrailer · 72k GVW = 36T',
        axles:[{load:10,dist:0},{load:15.5,dist:15},{load:15.5,dist:19},
               {load:15.5,dist:43},{load:15.5,dist:47}],
        trailingLoad:0, trailingNote:'Approximate axle positions — verify against MBE Appendix D',
      },
      { name:"AASHTO Posting load SU4", label:"Posting SU4", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:33,
        gvwKips:54, description:'AASHTO posting vehicle — 4-axle SU truck · 54k GVW = 27T',
        axles:[{load:10,dist:0},{load:11,dist:11},{load:11,dist:16.5},{load:22,dist:20.5}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU5", label:"Posting SU5", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:70, description:'AASHTO posting vehicle — 5-axle SU truck · 70k GVW = 35T',
        axles:[{load:12,dist:0},{load:12,dist:11.5},{load:11.5,dist:17},{load:11.5,dist:21},{load:23,dist:25}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU6", label:"Posting SU6", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:87, description:'AASHTO posting vehicle — 6-axle SU truck · 87k GVW = 43.5T',
        axles:[{load:12,dist:0},{load:12,dist:11.5},{load:12.5,dist:17},{load:12.5,dist:21},{load:19,dist:25},{load:19,dist:29}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU7", label:"Posting SU7", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:105, description:'AASHTO posting vehicle — 7-axle SU truck · 105k GVW = 52.5T',
        axles:[{load:12,dist:0},{load:12,dist:11.5},{load:12.5,dist:17},{load:12.5,dist:21},
               {load:19,dist:25},{load:19,dist:29},{load:18,dist:33}],
  ```
- **After:**
  ```js
      { name:"AASHTO Legal Type 3-3",   label:"Legal Type 3-3", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:80, description:'MBE Appendix D6A — 6-axle combination truck · 12k, 12k, 12k, 16k, 14k, 14k @ 15\', 4\', 15\', 16\', 4\' · 80k GVW = 40T',
        axles:[{load:12,dist:0},{load:12,dist:15},{load:12,dist:19},
               {load:16,dist:34},{load:14,dist:50},{load:14,dist:54}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Legal Type 3S2",   label:"Legal Type 3S2", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:72, description:'MBE Appendix D6A — 5-axle tractor-semitrailer · 10k, 15.5k, 15.5k, 15.5k, 15.5k @ 11\', 4\', 22\', 4\' · 72k GVW = 36T',
        axles:[{load:10,dist:0},{load:15.5,dist:11},{load:15.5,dist:15},
               {load:15.5,dist:37},{load:15.5,dist:41}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU4", label:"Posting SU4", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:33,
        gvwKips:54, description:'MBE Appendix D6A posting vehicle — 4-axle SU truck · 12k, 8k, 17k, 17k @ 10\', 4\', 4\' · 54k GVW = 27T',
        axles:[{load:12,dist:0},{load:8,dist:10},{load:17,dist:14},{load:17,dist:18}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU5", label:"Posting SU5", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:62, description:'MBE Appendix D6A posting vehicle — 5-axle SU truck · 12k, 8k, 8k, 17k, 17k @ 10\', 4\', 4\', 4\' · 62k GVW = 31T',
        axles:[{load:12,dist:0},{load:8,dist:10},{load:8,dist:14},{load:17,dist:18},{load:17,dist:22}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU6", label:"Posting SU6", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:69.5, description:'MBE Appendix D6A posting vehicle — 6-axle SU truck · 11.5k, 8k, 8k, 17k, 17k, 8k @ 10\', 4\', 4\', 4\', 4\' · 69.5k GVW = 34.75T',
        axles:[{load:11.5,dist:0},{load:8,dist:10},{load:8,dist:14},{load:17,dist:18},{load:17,dist:22},{load:8,dist:26}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"AASHTO Posting load SU7", label:"Posting SU7", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
        gvwKips:77.5, description:'MBE Appendix D6A posting vehicle — 7-axle SU truck · 11.5k, 8k, 8k, 17k, 17k, 8k, 8k @ 10\', 4\', 4\', 4\', 4\', 4\' · 77.5k GVW = 38.75T',
        axles:[{load:11.5,dist:0},{load:8,dist:10},{load:8,dist:14},{load:17,dist:18},
               {load:17,dist:22},{load:8,dist:26},{load:8,dist:30}],
  ```
- **Check case (node, `ALL_VEHICLES` / `VEHICLE_TONS` read from the app):** SU6 before: axles [12@0, 12@11.5, 12.5@17, 12.5@21, 19@25, 19@29], Σ = 87 k, tons 43.5 → after: [11.5@0, 8@10, 8@14, 17@18, 17@22, 8@26], Σ = 69.5 k, tons 34.75. With a governing RF of 1.20 the displayed posting capacity goes from 1.20 × 43.5 = 52.2 T to 1.20 × 34.75 = 41.7 T (note the RF itself also changes because MIDAS must be re-run with the corrected truck).
- **Not changed:** `defaultDLA` values (SU4 has 33, the other legal/posting trucks 0) — see O7. Rating tonnage already saved in a project (`rating.vehicleTon`) is not rewritten; re-select the rating vehicle to pick up the corrected tons.
- **How verified:** node (axle sums / spacings printed from the app's `ALL_VEHICLES`), Babel transpile.
- **Other copies of this code:** vehicle tables also exist in `Stone Masonry Arch Load Rating.html`, `Moving Load Generator.html`, `Bridge Substructure Loading.html`, `Steel Bridge Beam Modules.html` (AUDIT D4) — not changed here (one tool per PR).

### F3. FAST Act emergency vehicles EV2 / EV3 corrected   [calc change] [more conservative for posting tonnage; load model changes]
- **Where:** `VEHICLE_GROUPS` → group "FAST Act EV Loads" (≈ line 1277); `VEHICLE_TONS`. Anchor text: `name:"Type EV2"`
- **Problem:** EV2 was a 3-axle 108 k truck and EV3 a 4-axle 147 k truck; both were also labelled "Electric Vehicle" and cited LRFD 3.6.1.2.4 (that is the design lane load).
- **Governing provision:** FHWA memorandum "Load Rating for the FAST Act's Emergency Vehicles" (Nov. 3, 2016) / 23 U.S.C. 127(r); incorporated in the AASHTO MBE (2018 interim revisions) as EV2 and EV3.
- **Before → after:** EV2: 22.5, 52.5, 33 k @ 15, 6 ft (108 k = 54 T) → **24 k steer + 33.5 k rear @ 15 ft (57.5 k = 28.75 T)**; EV3: 22.5, 52.5, 33, 39 k @ 15, 6, 4 ft (147 k = 73.5 T) → **24 + 31 + 31 k @ 15, 4 ft (86 k = 43 T)**. Labels "Electric Vehicle" → "Emergency Vehicle". `defaultDLA` 33 unchanged.
- **Before:**
  ```js
      { name:"Type EV2", label:"EV2 Electric Vehicle", code:"FAST ACT EV LOADS", defaultDLA:33,
        gvwKips:108, description:'FAST Act §1411 — 3-axle EV · 108k GVW = 54T · AASHTO LRFD 3.6.1.2.4',
        axles:[{load:22.5,dist:0},{load:52.5,dist:15},{load:33,dist:21}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"Type EV3", label:"EV3 Electric Vehicle", code:"FAST ACT EV LOADS", defaultDLA:33,
        gvwKips:147, description:'FAST Act §1411 — 4-axle EV · 147k GVW = 73.5T · AASHTO LRFD 3.6.1.2.4',
        axles:[{load:22.5,dist:0},{load:52.5,dist:15},{load:33,dist:21},{load:39,dist:25}],
        trailingLoad:0, trailingNote:'Verify axle configuration against latest AASHTO LRFD',
  ```
- **After:**
  ```js
      { name:"Type EV2", label:"EV2 Emergency Vehicle", code:"FAST ACT EV LOADS", defaultDLA:33,
        gvwKips:57.5, description:'FAST Act emergency vehicle (FHWA EV load-rating memo, 2016) — 2-axle EV · 24k steer + 33.5k rear @ 15\' · 57.5k GVW = 28.75T',
        axles:[{load:24,dist:0},{load:33.5,dist:15}],
        trailingLoad:0, trailingNote:'',
      },
      { name:"Type EV3", label:"EV3 Emergency Vehicle", code:"FAST ACT EV LOADS", defaultDLA:33,
        gvwKips:86, description:'FAST Act emergency vehicle (FHWA EV load-rating memo, 2016) — 3-axle EV · 24k steer + 31k + 31k tandem @ 15\', 4\' · 86k GVW = 43T',
        axles:[{load:24,dist:0},{load:31,dist:15},{load:31,dist:19}],
        trailingLoad:0, trailingNote:'',
  ```
- **Check case (node):** EV3 Σ axles before 147 k, after 86 k; `VEHICLE_TONS['Type EV3']` 73.5 → 43. An RF of 1.10 now reports 47.3 T instead of 80.9 T.
- **How verified:** node, Babel transpile.
- **Other copies of this code:** see F2.

### F4. HL-93 design tandem tonnage 27.5 → 25 T   [display] [more conservative]
- **Where:** `VEHICLE_TONS` (≈ line 9776). Anchor text: `'HL-93TRK':36,'HL-93TDM':`
- **Problem:** the tandem is 2 × 25 k = 50 k = 25 T; 27.5 T overstated `RF × tons` by 10 %.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.6.1.2.3 (design tandem, two 25.0-kip axles 4.0 ft apart).
- **Before:** `  'HL-93TRK':36,'HL-93TDM':27.5,'H20-44':20,'HS20-44':36,`
- **After:** `  'HL-93TRK':36,'HL-93TDM':25,'H20-44':20,'HS20-44':36,`
- **Check case:** RF = 1.30 → before 1.30 × 27.5 = 35.75 T; after 1.30 × 25 = 32.5 T. Hand check: 50 k / 2 = 25 T.
- **How verified:** node (VEHICLE_TONS read from app).
- **Other copies of this code:** none known.

### F5. Fatigue I / II load factors 1.50 / 0.75 → 1.75 / 0.80   [calc change] [more conservative]
- **Where:** `AASHTO_PRESETS` (`id:'fat1'`, `id:'fat2'`, ≈ line 7293); `LRFR_FACTORS.LRFR['Fatigue I'|'Fatigue II']` (≈ line 9815); `FATIGUE_GAMMA` (≈ line 9876, used by the fatigue rating); rating summary table rows (`gam:` for Fatigue I/II, ≈ line 15185); explanatory texts (≈ lines 11826, 15779, 15984).
- **Problem:** values were the pre-2016 (LRFD 4th–7th Ed.) factors; fatigue load was understated by 14 % (Fatigue I) and 6 % (Fatigue II).
- **Governing provision:** AASHTO LRFD 10th Ed. (2024) Table 3.4.1-1 — Fatigue I γLL = 1.75, Fatigue II γLL = 0.80.
- **Before:**
  ```js
  {id:'fat1', ... llFactor:1.50, ...}   {id:'fat2', ... llFactor:0.75, ...}
      'Fatigue I': { Any:{ DC:0,DW:0,LL:1.50 } },
      'Fatigue II':{ Any:{ DC:0,DW:0,LL:0.75 } },
  const FATIGUE_GAMMA = { 'I':1.5, 'II':0.75 };
  {ls:'Fatigue I',  level:'Infinite Life', gam:1.5,
  {ls:'Fatigue II', level:'Finite Life',   gam:0.75,
  // Fatigue I: ... where γ_I = 1.5    // Fatigue II: ... where γ_II = 0.75
  Fatigue I: RF = (ΔF)_TH / (1.5·Δf) · Fatigue II: RF = (ΔF)_n / (0.75·Δf)
  Fatigue I γ=1.5 · Fatigue II γ=0.75 · N=
  ```
- **After:**
  ```js
  {id:'fat1', ... llFactor:1.75, ...}   {id:'fat2', ... llFactor:0.80, ...}
      'Fatigue I': { Any:{ DC:0,DW:0,LL:1.75 } },   // AASHTO LRFD 10th Ed. Table 3.4.1-1
      'Fatigue II':{ Any:{ DC:0,DW:0,LL:0.80 } },
  const FATIGUE_GAMMA = { 'I':1.75, 'II':0.80 };   // AASHTO LRFD 10th Ed. Table 3.4.1-1
  {ls:'Fatigue I',  level:'Infinite Life', gam:FATIGUE_GAMMA['I'],
  {ls:'Fatigue II', level:'Finite Life',   gam:FATIGUE_GAMMA['II'],
  // Fatigue I: ... where γ_I = 1.75   // Fatigue II: ... where γ_II = 0.80
  Fatigue I: RF = (ΔF)_TH / (1.75·Δf) · Fatigue II: RF = (ΔF)_n / (0.80·Δf)
  Fatigue I γ=1.75 · Fatigue II γ=0.80 · N=
  ```
- **Check case (node, app's `FATIGUE_GAMMA`):** ΔM = 400 ft·k, Sx = 500 in³ → Δf = 400·12/500 = 9.600 ksi. Category C: (ΔF)TH = 10 ksi; ADTT = 1000, 1 lane (p = 1.0), n = 1 → N = 365·75·1000 = 2.7375×10⁷, (ΔF)n = (44×10⁸/N)^(1/3) = 5.4371 ksi.
  Before: RF_I = 10/(1.5·9.6) = **0.6944**, RF_II = 5.4371/(0.75·9.6) = **0.7552**. After: RF_I = 10/(1.75·9.6) = **0.5952**, RF_II = 5.4371/(0.80·9.6) = **0.7080**.
- **Existing projects:** load combinations already saved in a project keep the factor they were saved with (they are user data). Re-apply the "Fatigue I/II" presets in the Combos step to pick up 1.75/0.80.
- **How verified:** node, Babel transpile.
- **Other copies of this code:** fatigue factors also appear in `stgirder.html`, `psbeam.html`, `Steel Bridge Beam Modules.html` (not checked here).

### F6. `mctCarriesImpact` made GFS-aware and per vehicle   [calc change] [more conservative]
- **Where:** `function mctCarriesImpact` (≈ line 10866); its use for the main rating (`const mctCarriesIM`, ≈ line 11541) and the multi-vehicle rating (`const vLLScale`, ≈ line 12552). Anchor text: `function mctCarriesImpact(cfg, lcName){`
- **Problem:** (a) returned true whenever any selected vehicle had DLA > 0, ignoring `geomMode`. The GFS MCT (`generateGFS_MCT`) writes a fixed VL scale of 0.5 with no (1+IM/100), so in GFS mode the rating silently dropped IM (33 % unconservative for highway vehicles). (b) In beam mode, a DLA-0 legal/posting truck analysed together with HL-93 was rated as if its MIDAS results already contained IM.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 3.6.2.1 (IM = 33 %); MBE 6A.4.4.3 (dynamic load allowance for legal loads). (Logic fix — no formula changed.)
- **Before:**
  ```js
  function mctCarriesImpact(cfg){
    const sel = cfg?.selectedVehicles || [];
    if(!sel.length) return false;
    const dlaOf = n => cfg.useGlobalDLA
      ? (+cfg.globalDLA||0)
      : (+(cfg.vehicleDLA?.[n] ?? ALL_VEHICLES.find(v=>v.name===n)?.defaultDLA ?? 0)||0);
    return sel.some(n=>dlaOf(n)>0);
  }
  ...
    const mctCarriesIM = useMemo(()=>mctCarriesImpact(cfg),
      [JSON.stringify(cfg.selectedVehicles),JSON.stringify(cfg.vehicleDLA),cfg.useGlobalDLA,cfg.globalDLA]);
  ...
        const inv = computeNodeRF(p, gamDC, gamDW, vGamLLinv, ratingLLScale, ratingLLScaleMn, ratingLLScaleV);
        const op  = computeNodeRF(p, gamDC, gamDW, vGamLLop,  ratingLLScale, ratingLLScaleMn, ratingLLScaleV);
  ```
- **After:**
  ```js
  function mctCarriesImpact(cfg, lcName){
    if((cfg?.geomMode||'beam')==='gfs') return false;
    const sel = cfg?.selectedVehicles || [];
    if(!sel.length) return false;
    const dlaOf = n => cfg.useGlobalDLA
      ? (+cfg.globalDLA||0)
      : (+(cfg.vehicleDLA?.[n] ?? ALL_VEHICLES.find(v=>v.name===n)?.defaultDLA ?? 0)||0);
    const nm = typeof lcName==='string' ? lcName.trim() : '';
    if(nm){
      const hit = sel.filter(n=>nm===n || nm.includes(n+'_')).sort((a,b)=>b.length-a.length)[0];
      if(hit) return dlaOf(hit)>0;
    }
    return sel.every(n=>dlaOf(n)>0);
  }
  ...
    const mctCarriesIM = useMemo(()=>mctCarriesImpact(cfg, ratingLLposLC),
      [JSON.stringify(cfg.selectedVehicles),JSON.stringify(cfg.vehicleDLA),cfg.useGlobalDLA,cfg.globalDLA,cfg.geomMode,ratingLLposLC]);
  ...
        const vLLScale = ratingLLScaleOf(ratingLLFactors, mctCarriesImpact(cfg, veh.name));
        const vIMr     = ratingLLScale>0 ? vLLScale/ratingLLScale : 1;
  ...
        const inv = computeNodeRF(p, gamDC, gamDW, vGamLLinv, ratingLLScale*vIMr, ratingLLScaleMn*vIMr, ratingLLScaleV*vIMr);
        const op  = computeNodeRF(p, gamDC, gamDW, vGamLLop,  ratingLLScale*vIMr, ratingLLScaleMn*vIMr, ratingLLScaleV*vIMr);
  ```
  (plus `ratingLLFactors, cfg.geomMode, cfg.vehicleDLA, cfg.useGlobalDLA, cfg.globalDLA` added to the multi-vehicle `useMemo` dependency list.)
- **Check case (node, app functions):** selected = HL-93TRK, HL-93TDM (DLA 33), Legal Type 3 (DLA 0); rating LL factors g = 0.6 and IM = 33 % enabled.
  - Beam, LL case `HL-93TRK_Lane 1(max)`: before true / after true (unchanged, scale 0.600).
  - Beam, LL case `AASHTO Legal Type 3_Lane 1(max)`: before true (scale 0.600) / after false (scale 0.6·1.33 = 0.798). With C = 1700, DC = 600, DW = 100 ft·k, LL = 300 ft·k, γLL = 1.45: RF = (1700 − 1.25·600 − 1.5·100)/(1.45·300·s) → before 800/261.0 = **3.0651**, after 800/347.1 = **2.3046**.
  - GFS, `HL-93TRK_GFS(max)`: before true (scale 0.600) / after false (scale 0.798). Same C/DC/DW/LL, γLL = 1.75: before **2.5397**, after **1.9095**.
- **How verified:** node run of `mctCarriesImpact` / `ratingLLScaleOf` / `mbeRF` from the app (before/after); Babel transpile.
- **Other copies of this code:** none known.

### F7. MBE φc·φs ≥ 0.85 floor   [calc change] [LESS conservative]
- **Where:** rating component, `const phiCSfloored` / `const phiS` (≈ line 11622). Anchor text: `const phiSsel = ratingSysKey==='Custom'`
- **Problem:** C = φc·φs·φ·Rn had no lower bound; Poor condition (0.85) × two-girder (0.85) gave 0.7225.
- **Governing provision:** AASHTO MBE Eq. 6A.4.2.1-3, φc·φs ≥ 0.85.
- **Implementation:** the floor is applied through the *effective* φs (`phiS = 0.85/φc` rounded up at 6 decimals when φc·φs < 0.85), so every existing `phiC*phiS*…` product (rating table, multi-vehicle, previews, popup report) uses the floored value without touching each call site. A visible amber note appears in the Resistance Factors panel when the floor is active, and the report row is labelled "φ_s (system; effective, φ_c·φ_s ≥ 0.85…)".
- **Before:**
  ```js
    const phiS = ratingSysKey==='Custom' ? ratingPhiSCustom : (PHI_SYSTEM[ratingSysKey]??1.0);
  ```
- **After:**
  ```js
    const phiSsel = ratingSysKey==='Custom' ? ratingPhiSCustom : (PHI_SYSTEM[ratingSysKey]??1.0);
    const phiCSfloored = phiC>0 && phiC*phiSsel < 0.85;
    const phiS = phiCSfloored ? Math.ceil(0.85/phiC*1e6)/1e6 : phiSsel;
  ```
  and in the Resistance Factors summary box:
  ```jsx
  {phiCSfloored&&<div style={{color:'#b45309',fontWeight:600,marginBottom:'3px'}}>
    ⚠ φ_c·φ_s = {phiC}·{phiSsel} = {(phiC*phiSsel).toFixed(3)} &lt; 0.85 → floored at 0.85 (MBE Eq. 6A.4.2.1-3); effective φ_s = {phiS}
  </div>}
  ```
- **Check case (node):** φc = 0.85 (Poor), φs = 0.85, φf = 1.0, Mn = 2000 ft·k → before C = 0.7225·2000 = **1445.0**, after C = 0.85·2000 = **1700.0**. With DC = 600, DW = 100, LL = 500 ft·k, γ 1.25/1.50/1.75: RF before (1445 − 750 − 150)/875 = **0.6229**, after (1700 − 900)/875 = **0.9143**. φc = 0.95, φs = 0.85: C 1615.0 → 1700.0 (effective φs 0.894737). φc = 1.0, φs = 0.85 and φc = 0.95, φs = 0.90: unchanged.
- **Less conservative:** yes — only when φc·φs < 0.85; this is what the MBE requires.
- **How verified:** node, Babel transpile.
- **Other copies of this code:** none known.

### F8. φc / φs table numbers corrected   [display / code reference]   [no result change]
- **Where:** comments above `PHI_SYSTEM` / `PHI_CONDITION` (≈ lines 9823, 9832) and the two selector labels (≈ lines 13692, 13701). Anchor text: `System factor φ_s`, `Condition Factor (MBE Table`
- **Problem:** φs was cited as MBE Table 6A.4.2.3-1 and φc as 6A.4.2.3-2 (swapped / non-existent numbering).
- **Governing provision:** AASHTO MBE Table 6A.4.2.3-1 (condition factor φc), Table 6A.4.2.4-1 (system factor φs).
- **Before:** `// MBE Table 6A.4.2.3-1 — System factor φ_s` · `// MBE Table 6A.4.2.3-2 — Condition factor φ_c` · `φ_c — Condition Factor (MBE Table 6A.4.2.3-2)` · `φ_s — System Factor (MBE Table 6A.4.2.3-1)`
- **After:** `// MBE Table 6A.4.2.4-1 — System factor φ_s` · `// MBE Table 6A.4.2.3-1 — Condition factor φ_c` · `φ_c — Condition Factor (MBE Table 6A.4.2.3-1)` · `φ_s — System Factor (MBE Table 6A.4.2.4-1)`
- **Check case:** n/a (labels only; no numeric value changed). The "Bolted I-girder, two-girder 0.85" value is NOT changed — see O3.
- **How verified:** Babel transpile.
- **Other copies of this code:** none known.

### F9. AREMA longitudinal-force reference span: 0 / blank now means "use span"   [bug fix] [LESS conservative]
- **Where:** AREMA params, `const long_L_ref` (≈ line 12222). Anchor text: `const long_L_ref = Math.max(1,`
- **Problem:** the saved default `arema_long_L_ref:0` is not caught by `??`, so `Math.max(1, 0)` made the reference span 1 ft and the longitudinal (braking/traction) LC results were multiplied by F(L)/F(1 ft) — 3.83× at L = 50 ft, 5.93× at 120 ft. The input's own onChange already treats blank as "span".
- **Governing provision:** n/a (logic bug); force formulas (AREMA Ch. 15 braking 45 + 1.2L, traction 25√L) unchanged.
- **Before:**
  ```js
      const long_L_ref = Math.max(1, +(R2.arema_long_L_ref ?? span));  // reference span in MIDAS LC (ft)
  ```
- **After:**
  ```js
      const long_L_ref = Math.max(1, (+R2.arema_long_L_ref > 0 ? +R2.arema_long_L_ref : span));  // reference span in MIDAS LC (ft)
  ```
- **Check case (node, exact expressions):** span = 50 ft, L_ref saved 0 → before L_ref = 1, F_ref = max(45 + 1.2, 25·1) = 46.2 k, F_act = max(105, 176.8) = 176.8 k, mult = **3.8263**; after L_ref = 50, mult = **1.0000**. L_ref = 100 (vehicle refSpan) → 0.7071 both before and after.
- **Less conservative:** yes — removes a spurious 2–6× amplification of the longitudinal-force effects when no reference span was entered.
- **How verified:** node, Babel transpile.
- **Other copies of this code:** none known.

### F10. RIDOT vehicles with no axles blocked from MCT generation   [bug fix] [no result change for valid vehicles]
- **Where:** helper `vehicleHasAxles` (≈ line 2823); `generateMCT` `const activeVehicles` (≈ line 3138); `generateGFS_MCT` vehicle block (≈ line 4109); `validateModel` WARNING scan (≈ line 9080); Moving Loads vehicle card notice (≈ line 7148). Anchor text: `function vehicleHasAxles(v)`
- **Problem:** RIDOT OP1–3 / BP1–4 have no `axles`; selecting one wrote `NAME=RI Operating load OP1, 2, NO, 0, 0, 0, 0, 0, NO` with no axle data, plus a moving-load case and combos referencing it — a malformed MCT.
- **Before:**
  ```js
    const activeVehicles  = ALL_VEHICLES.filter(v=>selectedVehicles.includes(v.name));
  ```
  GFS: `p('*VEHICLE    ; Vehicles');` written unconditionally, every `selVehs` entry written.
- **After:**
  ```js
  function vehicleHasAxles(v){ return !!(v && Array.isArray(v.axles) && v.axles.length); }
  ...
    const activeVehicles  = ALL_VEHICLES.filter(v=>selectedVehicles.includes(v.name)&&vehicleHasAxles(v));
    ALL_VEHICLES.filter(v=>selectedVehicles.includes(v.name)&&!vehicleHasAxles(v)).forEach(v=>
      p(`; WARNING: vehicle "${v.name}" has no axle data in this tool - NOT written to the MCT (no *VEHICLE, no moving load case). Define its axles before analysing it.`));
  ```
  GFS: the same filter (in place, with the same WARNING comment) after the E80 default; `*VEHICLE`, `*MVLDCASE` and `*MOVE-CTRL` are only written when at least one vehicle remains. `validateModel` reads every `; WARNING:` line of the generated MCT and lists the blocked-vehicle ones as **errors** on the Generate tab; the selected-vehicle card shows a red "No axle data — NOT written to the MCT" notice. RIDOT `gvwKips` / `VEHICLE_TONS` untouched.
- **Check case (node):** beam cfg with HL-93TRK + RIDOT OP1 → before: `NAME=RI Operating load OP1, 2, NO, …` (no axle line), MV case and combos for it; after: only the WARNING comment; `validateModel` → `[{level:'error',area:'Vehicles',msg:'vehicle "RI Operating load OP1" has no axle data …'}]`. GFS with only RIDOT BP1 → no `*VEHICLE`/`*MVLDCASE`/`*MOVE-CTRL` block.
- **How verified:** node, Babel transpile; default beam and GFS MCTs are byte-identical before/after.
- **Other copies of this code:** none known.

### F11. Lane-name mismatch that dropped PS-Beam LL combos   [bug fix] [no result change]
- **Where:** helper `mctLaneName` (≈ line 2820); `buildPSBeamCombos` (≈ line 7389); `StepCombos` `availableMV` (≈ line 7439); `generateMCT` MV-term handling (≈ line 3247). Anchor text: `function mctLaneName(cfg)`
- **Problem:** the builders named MV cases `${vn}_${cfg.laneName||'Lane'}` while `generateMCT` writes `${vn}_${(laneName||'').trim()||'Lane 1'}`; with a blank (or space-padded) lane name every PS-Beam LL passthrough combo term failed the name check and was silently dropped.
- **Before:**
  ```js
      const lc = isGFS ? `${vn}_GFS` : `${vn}_${cfg.laneName||'Lane'}`;
  ...
      return {lc:`${vn}_${cfg.laneName||'Lane'}`, label:veh?.label||vn, cat:'LL'};
  ...
          if(t.type==='MV'){ if(activeMVNames.has(lc)) mvParts.push(`MV, ${lc}, ${t.factor}`); }
          else if(activeLCs.includes(lc)) stParts.push(`ST, ${lc}, ${t.factor}`);
  ```
- **After:**
  ```js
  function mctLaneName(cfg){ return ((cfg&&cfg.laneName)||'').trim() || 'Lane 1'; }
  ...
      const lc = isGFS ? `${vn}_GFS` : `${vn}_${mctLaneName(cfg)}`;
  ...
      return {lc:`${vn}_${mctLaneName(cfg)}`, label:veh?.label||vn, cat:'LL'};
  ...
          if(t.type==='MV'){
            if(activeMVNames.has(lc)) mvParts.push(`MV, ${lc}, ${t.factor}`);
            else {
              const v = activeVehicles.filter(v=>lc.startsWith(v.name+'_')).sort((a,b)=>b.name.length-a.name.length)[0];
              if(v){
                p(`; WARNING: combo "${cleanLCName(combo.name)}" term "${lc}" mapped to moving case "${v.name}_${safeLaneName}" (lane name differs).`);
                mvParts.push(`MV, ${v.name}_${safeLaneName}, ${t.factor}`);
              } else p(`; WARNING: combo "${cleanLCName(combo.name)}" term "${lc}" is not a moving load case in this MCT - term dropped.`);
            }
          }
          else if(activeLCs.includes(lc)) stParts.push(`ST, ${lc}, ${t.factor}`);
          else p(`; WARNING: combo "${cleanLCName(combo.name)}" term "${lc}" is not a static load case in this MCT - term dropped.`);
  ```
  The beam model has a single lane, so each vehicle has exactly one moving case; a combo term saved under an older lane name is mapped to it (with a WARNING), so projects saved before this fix also recover their LL combos. Terms that still cannot be matched are reported instead of silently dropped (shown on the Generate tab via `validateModel`).
- **Check case (node):** laneName = '' + PS-Beam combos → before the builder produced `HL-93TRK_Lane` / `HL-93TDM_Lane`, which the MCT (writing `HL-93TRK_Lane 1`) dropped, so `LL_HL93TRK` / `LL_HL93TDM` were not written; after the builder produces `HL-93TRK_Lane 1` and the MCT writes `NAME=LL_HL93TRK … MV, HL-93TRK_Lane 1, 1`. Stale saved terms (`HL-93TRK_Lane`) are mapped to `HL-93TRK_Lane 1` with a WARNING comment.
- **How verified:** node, Babel transpile; default MCT byte-identical.
- **Other copies of this code:** none known.

### F12. Crash on blank `materialGrade` / `projectUser`   [bug fix] [no result change]
- **Where:** `generateMCT` (≈ line 2838); `downloadMCT` (≈ line 20589). Anchor text: `const materialGrade = (cfg.materialGrade||'').trim() || 'A36';`, `_Bridge_Model.mct`
- **Before:**
  ```js
    const { projectUser,projectDate,version,spans,elemsPerSpan,materialGrade,
  ...
      a.download=`${cfg.projectUser.replace(/\s+/g,'_')}_Bridge_Model.mct`;a.click();
  ```
- **After:**
  ```js
    const { projectUser,projectDate,version,spans,elemsPerSpan,
  ...
    const materialGrade = (cfg.materialGrade||'').trim() || 'A36';
  ...
      a.download=`${(cfg.projectUser||'project').replace(/\s+/g,'_')}_Bridge_Model.mct`;a.click();
  ```
- **Check case (node):** cfg without `materialGrade`/`projectUser` → before `TypeError: Cannot read properties of undefined (reading 'padEnd')`; after the material line `1, STEEL, A36 …` (same A36 fallback the GFS generator already uses).
- **How verified:** node, Babel transpile.
- **Other copies of this code:** none known.

### F13. `nidOf` silent node 101 → nearest node + warning   [robustness] [no result change for valid models]
- **Where:** `generateMCT` `const nidOf` (≈ line 2945). Anchor text: `const nidOf=x=>{`
- **Before:**
  ```js
    const nidOf=x=>{
      const idx=finalXs.findIndex(fx=>Math.abs(fx-x)<TOL);
      return 101+(idx>=0?idx:0);
    };
  ```
- **After:**
  ```js
    const nidOf=x=>{
      let idx=finalXs.findIndex(fx=>Math.abs(fx-x)<TOL);
      if(idx<0){
        idx=finalXs.reduce((bi,fx,i)=>Math.abs(fx-x)<Math.abs(finalXs[bi]-x)?i:bi,0);
        p(`; WARNING: no node at x = ${(+x).toFixed(4)} ft - snapped to nearest node ${101+idx} at x = ${finalXs[idx].toFixed(4)} ft. Check the support locations.`);
      }
      return 101+idx;
    };
  ```
- **Check case:** default model (span boundaries are always nodes) → no WARNING lines, MCT byte-identical. The fallback is defensive; it now never places a support at the left end silently.
- **How verified:** node, Babel transpile.
- **Other copies of this code:** none known.

### F14. MIDAS paste parser column shift on empty cells   [bug fix] [no result change for complete rows]
- **Where:** `function parseBeamResults` (≈ line 9256). Anchor text: `const raw   = line.trim().split('\t')`
- **Before:**
  ```js
      const parts = line.trim().split('\t').map(s=>s.trim()).filter(Boolean);
  ```
- **After:**
  ```js
      const raw   = line.trim().split('\t').map(s=>s.trim());
      const parts = (raw.length >= 9 && /^\d+$/.test(raw[0]) && /^[IJ]/.test(raw[2]))
        ? raw : raw.filter(Boolean);
  ```
  Positional parse is used only when the row is intact (integer element, I/J part in column 3); otherwise the old drop-empties parse is kept, so every row that parsed before parses the same way.
- **Check case (node):** row `101⇥HL⇥I[101]⇥0.5⇥1.0⇥⇥0.3⇥150.0⇥2.0` (blank Shear-z) → before: row discarded (only 8 cells left) — or, with an extra trailing column, every field after Shear-y shifted one place; after: shearZ = 0, torsion 0.3, momentY 150, momentZ 2. Complete rows and rows with doubled tab separators: identical before/after.
- **How verified:** node, Babel transpile.
- **Other copies of this code:** none known.

### F15. Combo-name truncation collisions made unique   [bug fix] [no result change]
- **Where:** helper `uniqueComboName` (≈ line 2807); four `NAME=` writes in `generateMCT` / `generateGFS_MCT`. Anchor text: `function uniqueComboName(baseName, vehName, used)`
- **Before:**
  ```js
          p(`   NAME=${midasComboName(combo.name, vehName)}, STEEL, ${kind}, 0, 0, , 0, 0, 0, 1`);
  ...
        p(`   NAME=${midasComboName(combo.name)}, STEEL, ${kind}, 0, 0, , 0, 0, 0, 1`);
  ```
- **After:**
  ```js
  function uniqueComboName(baseName, vehName, used){
    let n = midasComboName(baseName, vehName), k = 2;
    while(used.has(n.toUpperCase())){
      const tag    = shortVehTag(vehName);
      const suffix = tag ? '-'+tag : '';
      const num    = '_'+(k++);
      n = cleanLCName(baseName||'').slice(0, Math.max(0, MIDAS_COMBO_NAME_MAX - suffix.length - num.length)) + num + suffix;
    }
    used.add(n.toUpperCase());
    return n;
  }
  ...
    const usedComboNames = new Set();      // one per *LOADCOMB block (beam and GFS)
  ...
          p(`   NAME=${uniqueComboName(combo.name, vehName, usedComboNames)}, STEEL, ${kind}, 0, 0, , 0, 0, 0, 1`);
  ...
        p(`   NAME=${uniqueComboName(combo.name, '', usedComboNames)}, STEEL, ${kind}, 0, 0, , 0, 0, 0, 1`);
  ```
- **Check case (node):** combos "Strength I (max) Inventory" and "Strength I (max) Operating" with HL-93 truck + tandem → before: `Strength I (max)-TRK`, `-TDM`, `-TRK`, `-TDM` (two duplicates); after: `Strength I (max)-TRK`, `Strength I (max)-TDM`, `Strength I (ma_2-TRK`, `Strength I (ma_2-TDM`. Names that were already unique are unchanged (default MCT byte-identical).
- **How verified:** node, Babel transpile.
- **Other copies of this code:** none known.

### F16. Visible warning for the PS `MnNeg ‖ 0.7·MnPos` placeholder   [display] [no result change]
- **Where:** `capAt` psconc branch (comment only, ≈ line 11335); `const psNegPlaceholder` (≈ line 11629); Resistance Factors summary box; PS-conc zone card (≈ line 14788). Anchor text: `const psNegPlaceholder`
- **Problem:** with no Mn⁻ entered, a PS zone's hogging capacity silently became 0.7·Mn⁺.
- **Before:** (no warning) `return { MnPos, MnNeg: z.MnNeg||MnPos*0.7, Vn, …` — behaviour kept unchanged.
- **After:**
  ```js
    const psNegPlaceholder = capZones.filter(z=>z.type==='psconc'&&!z.MnNeg);
  ```
  ```jsx
  {psNegPlaceholder.length>0&&<div style={{color:'#b91c1c',fontWeight:600,marginBottom:'3px'}}>
    ⚠ PS Conc zone{psNegPlaceholder.length>1?'s':''} {psNegPlaceholder.map(z=>capZones.indexOf(z)+1).join(', ')}: no Mn⁻ entered — the negative-moment rating uses a PLACEHOLDER Mn⁻ = 0.7·Mn⁺, not a computed capacity. Enter Mn⁻ for any hogging region.
  </div>}
  ...
  {!z.MnNeg&&<div style={{color:'#b91c1c',fontWeight:600,marginTop:'3px'}}>
    ⚠ Mn⁻ not entered — rating uses placeholder Mn⁻ = 0.7·Mn⁺ = {(0.7*MnPos).toFixed(1)} ft·k (not a computed capacity)
  </div>}
  ```
- **Check case:** n/a (no numeric change; the warning uses the same `!z.MnNeg` test as `capAt`).
- **How verified:** Babel transpile.
- **Other copies of this code:** none known.

## Open items (not changed)
- O1. `ROLLED_SHAPES` `S30X118` and `S36X150` — no such shapes in AISC v16.0 (largest S shape is S24); dimensions cannot be verified. Decide: delete them (would break any saved project that references them — needs a migration) or keep them labelled as non-AISC.
- O2. `W_SHAPE_PROPS['W24X55']` Zx = 131 in³; AISC v16.0 lists Zx = 134 in³ (Sx 114 matches). Out of scope for this PR (the brief said W_SHAPE_PROPS is the reference); confirm and fix separately.
- O3. φs "Bolted I-girder, two-girder 0.85": MBE Table 6A.4.2.4-1 gives **riveted** members in two-girder bridges 0.90 and welded 0.85; it does not list bolted. Changing the value (and renaming the saved selector key) needs your decision; the key is stored in saved projects (`rating.sysKey`), so a rename needs a migration.
- O4. AREMA `Fb_N = max(formula, 0.10·Fy)` floor and the `span ≤ 175 ? 16 + 600/(L−30) : 16 %` impact cut-off — not confident of the current AREMA Ch. 15 text (Table 15-1-11 / Art. 1.3.5). Not changed. Question: does the edition you use have a lower bound on Fb and any span limit on the 16 + 600/(L−30) impact?
- O5. AREMA verify items (unchanged): `AREMA_SFT` fatigue thresholds {A:14,B:10,C:8,D:6,E:4,F:3}; wind on LL 0.200 k/ft at 8 ft; rocking 0.20·g·d/Σd² vs 100/S %; Maximum-rating shear 0.75K = 0.60Fy; "arema" cap-zone mixing ASD allowables with LRFR factors.
- O6. Service II / PS Service III: no DF·IM scaling of LL and a single section modulus for all load stages (LRFD 6.10.4.2; 5.9.2.3.2b) — needs a design decision on staged S inputs.
- O7. Legal/posting `defaultDLA`: SU4 has 33, the other legal/posting trucks 0. MBE 6A.4.4.3 applies IM (33 % unless reduced per C6A.4.4.3) to legal loads. Not changed; confirm the intended default (and whether the MCT or the rating should carry it).
- O8. HL-93 in the MCT: fixed 14 ft rear-axle spacing (LRFD 3.6.1.2.2 varies 14–30 ft) and no 90 % two-truck + lane case for negative moment / pier reactions (3.6.1.3.1). Needs a MIDAS-modelling decision.
- O9. Permit γLL = 1.10 flat (MBE Table 6A.4.5.4.2a-1 varies by permit type and ADTT).
- O10. PS fps uses the ACI-style approximate equation with mixed γp/k and ignores T-section behaviour (`bw` unused) — labelled AASHTO 5.6.3.1.1.
- O11. GFS MCT writes no HL-93 lane load and no IM (fixed VL scale 0.5). F6 makes the rating apply IM for GFS results; the missing lane load remains.
- O12. Demands hand-off payload has no `imIncluded` / `dfIncluded` flags and the steel/PS flavours share `_schema` (multi-file change: index/psbeam/stgirder). Also the PS-Beam combo note says "LL envelope per MIDAS (DF and IM applied)" although DF is never applied in the MCT.
- O13. `lldfGeom.inputs.type` is hard-coded `'a'` even for PS girders.
- O14. Fatigue rating: no fatigue truck in the library, IM 15 % vs 33 %, no g/1.2 distribution (AUDIT A22 second half) — not in this PR's scope list.
- O15. Rolled-shape dimensions, vehicle tons and fatigue preset factors already stored in saved projects are user data and are not rewritten; users must re-convert the shape / re-select the vehicle / re-apply the preset.

## 2026-10-04 — PR: claude/step1-group1 (PR link added after merge)

Feature (no result change): "← All tools" link to `tools.html` (`target="_top"`, hidden in print) and the shared project info buttons. No formula, factor, unit, storage key or saved format changed. New storage written only on "Share project info": `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt` (HANDOFF.md §2/§4.1). The BridgeLocks registry already lists the `project` channel → `.projectMeta`; the payload carries a top-level `producedAt`, which `BridgeLocks.producedAt()` / `hasData()` read (checked in jsdom). The bridgeSuite bootstrap blocks are unchanged.

Field mapping: projectName ↔ Project Name (`cfg.projectName`), bridgeId ↔ Bridge Name / Structure ID (`cfg.projectBridgeId`), client ↔ Client / Owner (`cfg.projectClient`), location ↔ Address / Location (`cfg.projectAddress`), preparedBy ↔ Engineer / User Initials (`cfg.projectUser`), date ↔ Date (`cfg.projectDate`; YYYY/M/D here, exchanged as YYYY-MM-DD when in that form). jobNo, checkedBy: not in this tool (sent as ""). Writes go through the existing `set()` → `cfg` → `mct_cfg_v3` autosave.

### S1. Print rule for the new link and buttons   [feature (no result change)]
- **Where:** top `<style>` block (≈ line 28). Anchor text: `button:active{transform:translateY(1px);}`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```css
    button:active{transform:translateY(1px);}
  </style>
  ```
- **After:**
  ```css
    button:active{transform:translateY(1px);}
    @media print{.bx-alltools,.bx-projbtns{display:none!important;}}
  </style>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S2. BridgeXfer v1 + BXProject glue (plain script before the app)   [feature (no result change)]
- **Where:** new `<script>` just before `<script type="text/babel">` (≈ line 1203). Anchor text: `<script type="text/babel">`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```html

  <script type="text/babel">
  ```
- **After:**
  ```html

  <script>
  /* BridgeXfer v1 verbatim from HANDOFF.md §5 (73 lines, not repeated here) */
  /* Shared project info (HANDOFF.md §4.1): glue for the "Use shared project info" and
     "Share project info" buttons. Uses BridgeXfer above. Duplicated per tool (CLAUDE.md §3).
     share(own): own = {sharedKey: value} for the fields this tool has; the rest are sent as ''.
     use(cur, apply): cur = {sharedKey: current value} for the fields this tool has. Shows what
     will be overwritten, then calls apply(upd) with only the non-empty shared values that differ. */
  (function(){
    if(window.BXProject) return;
    var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
    var LABELS={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
                preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
    function str(v){ return v==null?'':String(v); }
    function share(own){
      if(!window.BridgeXfer){ alert('Shared project info is not available in this browser.'); return null; }
      var f={}; KEYS.forEach(function(k){ f[k]=str(own&&own[k]); });
      var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f});
      if(r.error) alert('Could not share project info: '+r.error);
      else alert('Project info shared. Other tools can load it with "Use shared project info".');
      return r;
    }
    function use(cur, apply){
      if(!window.BridgeXfer){ alert('Shared project info is not available in this browser.'); return false; }
      var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
      if(r.error){ alert('No shared project info: '+r.error); return false; }
      var f=r.payload.fields||{}, upd={}, lines=[], n=0;
      Object.keys(cur||{}).forEach(function(k){
        var v=str(f[k]); if(!v.trim()) return;          // never blank a field from an empty shared value
        var c=str(cur[k]); if(v===c) return;
        upd[k]=v; n++;
        lines.push('  '+(LABELS[k]||k)+': "'+(c||'(blank)')+'" → "'+v+'"');
      });
      var src=BridgeXfer.describe(r.payload);
      if(!n){ alert('Shared project info ('+src+') already matches this tool. Nothing to change.'); return false; }
      if(!confirm('Use shared project info?\nFrom: '+src+'\n\nThis will overwrite:\n'+lines.join('\n'))) return false;
      apply(upd);
      return true;
    }
    window.BXProject={ KEYS:KEYS, share:share, use:use };
  })();
  </script>
  <script type="text/babel">
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S3. Shared project info handlers and the "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Where:** `StepProject()`: handlers after the `SH` style, buttons under the step header (≈ line 3649). Anchor text: `borderBottom:'1px solid #f3f4f6'};`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```jsx
      borderBottom:'1px solid #f3f4f6'};

    return (<div><StepHeader icon="📋" title="Project Information" sub="Project metadata, bridge identification, and MCT file header fields"/>
      <div style={{display:'flex',gap:'28px',flexWrap:'wrap',maxWidth:'860px'}}>
  ```
- **After:**
  ```jsx
      borderBottom:'1px solid #f3f4f6'};
    /* Shared project info (HANDOFF.md §4.1). Date is kept as YYYY/M/D here (MIDAS *PROJINFO) and
       exchanged as YYYY-MM-DD when it is in that form; anything else passes through unchanged. */
    const bxToIso=d=>{const m=/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/.exec(String(d||'').trim());
      return m?`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`:(d||'');};
    const bxFromIso=d=>{const m=/^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(String(d||'').trim());
      return m?`${m[1]}/${+m[2]}/${+m[3]}`:d;};
    const BX_MAP={projectName:'projectName',bridgeId:'projectBridgeId',client:'projectClient',
      location:'projectAddress',preparedBy:'projectUser',date:'projectDate'};
    const bxOwn=()=>{const o={};Object.keys(BX_MAP).forEach(k=>{o[k]=cfg[BX_MAP[k]]||'';});o.date=bxToIso(o.date);return o;};
    const bxShare=()=>{ if(window.BXProject) window.BXProject.share(bxOwn()); };
    const bxUse=()=>{ if(window.BXProject) window.BXProject.use(bxOwn(),upd=>{
      Object.keys(upd).forEach(k=>set(BX_MAP[k],k==='date'?bxFromIso(upd[k]):upd[k])); }); };
    const BXB={background:'#fff',border:'1px solid #d1d5db',borderRadius:'5px',padding:'5px 10px',
      cursor:'pointer',fontSize:'12px',color:'#374151',whiteSpace:'nowrap'};

    return (<div><StepHeader icon="📋" title="Project Information" sub="Project metadata, bridge identification, and MCT file header fields"/>
      <div className="bx-projbtns" style={{display:'flex',gap:'8px',flexWrap:'wrap',maxWidth:'860px',marginBottom:'6px'}}>
        <button style={BXB} onClick={bxUse} title="Fill these fields from the project info shared by another tool (asks first; never blanks a field)">Use shared project info</button>
        <button style={BXB} onClick={bxShare} title="Share this project's name, bridge ID, client, location, engineer and date with the other tools">Share project info</button>
      </div>
      <div style={{display:'flex',gap:'28px',flexWrap:'wrap',maxWidth:'860px'}}>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

### S4. "← All tools" link in the app header   [feature (no result change)]
- **Where:** `App()` render, `<header>` (≈ line 21079). Anchor text: `<div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'12px'}}>`
- **Problem:** none (feature). Approved step 1 of the cross-tool work: "← All tools" link and shared project info (HANDOFF.md §4.1).
- **Governing provision:** n/a (no calculation, factor, unit or code reference touched).
- **Before:**
  ```jsx
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'12px'}}>
  ```
- **After:**
  ```jsx
          </div>
          <a className="bx-alltools" href="tools.html" target="_top" title="Open the list of all tools"
            style={{fontSize:'11.5px',color:'#6b7280',textDecoration:'none',border:'1px solid #e5e7eb',
              borderRadius:'6px',padding:'4px 10px',whiteSpace:'nowrap'}}>← All tools</a>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:'12px'}}>
  ```
- **Check case:** n/a, no computed value changes. Functional check: see How verified.
- **How verified:** `node --check` on every plain inline script and @babel/standalone transpile of the text/babel block; BridgeXfer copy compared byte-for-byte with HANDOFF.md §5; whole page loaded in jsdom (React/ReactDOM/Babel from npm, other CDN scripts blocked); Share → Use round trip between lldf, Moving Load Generator, psbeam, stgirder and index with one shared localStorage; `git diff` shows only additions apart from the one header line that received the link.
- **Other copies:** BridgeXfer v1 and the `BXProject` glue are also in index.html, lldf.html, psbeam.html, stgirder.html and Moving Load Generator.html (this PR).

## 2026-10-04 — PR: claude/conn-reactions-subloads (PR link added after merge)

No code change in this file.

- **OPEN (superReactions sender, HANDOFF.md §4.4):** index.html (MCT) is listed as a sender of `superReactions`, but its results do not contain support reactions per load case (it writes the MIDAS model and imports member force envelopes; no reaction table is read). It was therefore not connected in this PR. Needed: a MIDAS reaction-table import (DC1/DC2/DW per support per girder) before index.html can send reactions.

## 2026-10-12 — PR: claude/sweep-index (open-item sweep; PR link added after merge)

Works through every open item for index.html in the 2026-10-12 inventory (section 1, IDs IDX-…) under the engineer's instruction of 2026-10-12 ("continue making updates and fixes until it's completed; use your best judgment; note what absolutely needs my input"). Basis: AASHTO LRFD 10th Ed. (2024), MBE 3rd Ed. (with interims), AISC Shapes Database v16.0. Article numbers marked "verify" were not checked against the printed edition.

Line numbers are those of the fixed file (≈). Every entry lists its anchor text; the hunks under each entry are the exact before/after code (context lines included). The shared `bridgeSuite.v1.*` bootstrap / hand-off blocks at the top of the file are not touched.

Saved data (CLAUDE.md §5): no key renamed, no format changed. New optional fields only — capacity zones: `Lb`, `Cb`, `do` (Steel Calc and Composite), `d`, `tw`, `bfTop`, `tfTop`, `bfBot`, `tfBot` (Steel Calc; Composite already had them), `hf`, `dsp` (PS Conc); rating: `fatigueDF`; vehicle library: `selectDLA` (code only, not saved); demands hand-off payload: `imIncluded`, `dfIncluded`. No new storage key. Old projects load unchanged.

### SW1. Composite Mn⁺: 6.10.7.1.2 Dp/Dt reduction (IDX-A2)   [calc change] [MORE conservative]
- **Where:** `compPlasticPos(z)` (≈ line 10170), anchor `const yc = Math.min(y, ts), Cc = cDeck*yc;`; new constant `STEEL_E` before `compN`; the Composite zone live preview (≈ line 14590), anchor `const pp    = compPlasticPos(z);`.
- **Problem:** the composite positive-moment capacity was the full plastic moment Mp at every Dp/Dt. LRFD 6.10.7.1.2 reduces it to Mp·(1.07 − 0.7·Dp/Dt) once the PNA is deeper than 0.1·Dt. The ductility limit Dp ≤ 0.42·Dt (6.10.7.3) and the web compactness of 6.10.6.2.2 are now reported as warnings (see SW2 for where warnings show); neither changes the number.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.7.1.2 (Eq. 6.10.7.1.2-2), 6.10.7.3, 6.10.6.2.2. Dp = top of deck to the PNA; Dt = deck + haunch + steel depth.
- **Before:** `Mn = Mp`. **After:** `Mn = Mp` if Dp ≤ 0.1·Dt, else `Mn = Mp·(1.07 − 0.7·Dp/Dt)`.
- **Check case:** Composite zone, Fy 50, f'c 4, beff 96, ts 8, th 2, d 36, tw 0.5, top flange 12 × 0.75, bottom flange 14 × 1.25. As = 9 + 17 + 17.5 = 43.5 in²; Ps = 2175 k; Pc = 0.85·4·96·8 = 2611 k > Ps, so the PNA is in the deck at Dp = 8·2175/2611 = 6.664 in. Steel centroid 21.246 in below the top of steel = 31.246 in below the top of deck. Mp = 2175·(31.246 − 6.664/2) = 60,713 k·in = 5059.4 k·ft. Dt = 8 + 2 + 36 = 46 in; Dp/Dt = 0.1449 > 0.1 → factor 1.07 − 0.7·0.1449 = 0.9686.
  - Before: Mn⁺ = 5059.4 k·ft. After: Mn⁺ = 4900.5 k·ft (−3.1 %).
- **How verified:** function evaluated in the page (headless Chromium, local copies of the pinned libraries) on main and branch; numbers above reproduced.
- **Other copies:** none (stgirder has its own 6.10.7.1.2 implementation).
- **Open items:** the continuous-span limit Mn ≤ 1.3·Rh·My (6.10.7.1.2) and the noncompact-section resistance of 6.10.7.2 need the staged yield moment My, which the zone does not have; not applied (see "Needs engineer" N7).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 10083* (const AREMA_SFT = { A:14, B:10, C:8, D:6, E:4, F:3 };)

    Before:
    ```js
    
    // Modular ratio n from fc (AASHTO Table 6.10.1.1.1b-1)
    ```
    After:
    ```js
    
    // Modulus of elasticity of structural steel, ksi (AASHTO LRFD 6.4.1)
    const STEEL_E = 29000;
    
    // Modular ratio n from fc (AASHTO Table 6.10.1.1.1b-1)
    ```
  - *Hunk at ≈ line 10186* (function compPlasticPos(z) {)

    Before:
    ```js
      const M = Cc*(y - yc/2) + compSteelMoment(layers, y, Fy);
      return { Mn: Math.max(0, +(M/12).toFixed(1)), yPNA:+y.toFixed(3),
               inDeck: y <= ts + 1e-6, derived: st.derived,
    ```
    After:
    ```js
      const M = Cc*(y - yc/2) + compSteelMoment(layers, y, Fy);
      // AASHTO LRFD 10th Ed. 6.10.7.1.2: Mn = Mp when Dp <= 0.1·Dt, otherwise
      // Mn = Mp·(1.07 − 0.7·Dp/Dt). Dp = top of deck to the PNA, Dt = total depth of the
      // composite section (deck + haunch + steel). Ductility 6.10.7.3: Dp <= 0.42·Dt.
      const Mp = Math.max(0, +(M/12).toFixed(1));
      const Dt = yTop + (+z.d||0), Dp = y;
      const red = Dt>0 && Dp > 0.1*Dt ? (1.07 - 0.7*Dp/Dt) : 1;
      // Web compactness of the composite section, 6.10.6.2.2 (shown, not applied: a
      // noncompact section needs 6.10.7.2, which this zone cannot evaluate).
      const Lw = layers[1];
      const Dcp = Math.max(0, Math.min(y, Lw.y1) - Lw.y0);
      const twc = +z.tw||0, Dweb = Lw.y1 - Lw.y0;
      const webCompact = !(twc>0) || (2*Dcp/twc <= 3.76*Math.sqrt(STEEL_E/Fy) && Dweb/twc <= 150);
      return { Mn: Math.max(0, +(Mp*red).toFixed(1)), Mp, yPNA:+y.toFixed(3),
               Dp:+Dp.toFixed(3), Dt:+Dt.toFixed(3), redDpDt:+red.toFixed(4),
               ductOK: Dp <= 0.42*Dt + 1e-9, webCompact, Dcp:+Dcp.toFixed(3),
               inDeck: y <= ts + 1e-6, derived: st.derived,
    ```
  - *Hunk at ≈ line 14603* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                                <br/>
                                Mn⁺ = {MnPos.toFixed(1)} ft·k &nbsp;·&nbsp; Mn⁻ = {MnNeg.toFixed(1)} ft·k &nbsp;·&nbsp; Vn = {Vn.toFixed(1)} kips
    ```
    After:
    ```js
                                <br/>
                                Mp = {pp.Mp.toFixed(1)} ft·k · Dp/Dt = {pp.Dp.toFixed(2)}/{pp.Dt.toFixed(2)} = {(pp.Dt>0?pp.Dp/pp.Dt:0).toFixed(3)}
                                {pp.redDpDt<1?<> → Mn⁺ = Mp·(1.07 − 0.7·Dp/Dt) = Mp·{pp.redDpDt.toFixed(3)}</>:<> ≤ 0.1 → Mn⁺ = Mp</>} (6.10.7.1.2)
                                <br/>
                                Mn⁺ = {MnPos.toFixed(1)} ft·k &nbsp;·&nbsp; Mn⁻ = {MnNeg.toFixed(1)} ft·k &nbsp;·&nbsp; Vn = {Vn.toFixed(1)} kips
    ```

### SW2. Steel Calc zone: AASHTO flexure (App. A6 / 6.10.8) and shear (6.10.9) (IDX-A1)   [calc change] [MORE conservative once plates and Lb are entered; old zones keep the old numbers with a warning]
- **Where:** new functions after `computeCompositeMnNeg` (≈ line 10240): `steelPlateSection`, `steelPlastic`, `steelIFlexure`, `steelIVn`, `capLbKnown`, `steelZoneCaps`, `compNegPlasticGate`; `capAt()` quickcalc branch (anchor `if (z.type==='quickcalc') {`); new `steelCapWarn` (anchor `const psNegPlaceholder`); the warning lines in the Resistance Factors box (anchor `{steelCapWarn.map(`); the Steel Calc inputs and preview (anchor `{/* Steel Calc: plates, bracing and stiffener spacing`); the report capacity table (anchor `Fy=${z.Fy}ksi Zx+=`).
- **Problem:** the Steel Calc zone used Mn = Fy·Zx and Vn = 0.6·Fy·Aw for any section: a compact, fully braced section with C = 1 was assumed whatever the plates and bracing were (unconservative for any unbraced length beyond Lp, noncompact flanges or slender webs; 0.6·Fy·d·tw also overstates 0.58·Fy·D·tw).
- **Fix:** new optional inputs d, tw, bf/tf top and bottom (in), Lb (ft, unbraced length of the compression flange; blank = unknown, never "braced"), Cb (default 1.0) and do (in, stiffener spacing; blank = unstiffened). With the plates and Lb entered:
  - Flexure: App. A6 when 6.10.6.2.3 allows it (Fy ≤ 70 ksi, 2Dc/tw < 5.7√(E/Fyc), Iyc/Iyt ≥ 0.3): web plastification factors Rpc/Rpt (A6.2.1/A6.2.2), FLB (A6.3.2), LTB (A6.3.3), tension-flange yielding (A6.4). Otherwise 6.10.8: Fnc from FLB (6.10.8.2.2) and LTB (6.10.8.2.3) with Rb (6.10.1.10.2), Mn = min(Fnc·Sxc, Fyt·Sxt). Mp = Fy·Zx when Zx is entered (tabulated, includes fillets), else the plate Mp. Positive moment: top flange in compression; negative: bottom.
  - Shear: 6.10.9.2/6.10.9.3.2 — Vn = C·Vp, Vp = 0.58·Fyw·D·tw, k = 5 (unstiffened) or 5 + 5/(do/D)² with the stiffened interior-panel equations when do ≤ 3D. Shear needs only the plates.
  - Without plates or Lb nothing is assumed: the zone keeps Fy·Zx / 0.6·Fy·Aw and shows a red warning on the zone card, in the Resistance Factors box and in the printed capacity table, together with the basis used ("App. A6 (LTB)", "6.10.8 (FLB)", "Fy·Zx⁺ (not checked)", …). Saved Steel Calc zones have no Lb, so their numbers do not change until the plates and Lb are entered.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.6.2.3, App. A6 (A6.1–A6.4), 6.10.8.1–6.10.8.3, 6.10.1.10.2, 6.10.9.2, 6.10.9.3.2 (Eqs. 6.10.9.3.2-2/-8, verify the stiffened-panel equation numbering against the printed 10th Ed.); D6.3.1/D6.3.2 for Dc/Dcp. E = 29,000 ksi, Rh = 1 (homogeneous).
- **Before:** `MnPos = Fy·ZxPos/12`, `MnNeg = Fy·ZxNeg/12`, `Vn = 0.6·Fy·Aw`. **After:** as above (A6 or 6.10.8; 6.10.9).
- **Check case:** W24X76 (AISC v16: d 23.92, tw 0.440, bf 8.99, tf 0.680, Zx 200, Sx 176), Fy 50, Lb = 10 ft, Cb = 1.
  - Plate section: D = 22.56 in; Ix = 2072.3 in⁴; Sxc = Sxt = 173.27 in³; J = (22.56·0.44³ + 2·8.99·0.68³·(1 − 0.63·0.68/8.99))/3 = 2.435 in⁴; Dc = Dcp = 11.28 in.
  - A6 applies (2Dc/tw = 51.3 < 137.3; Iyc/Iyt = 1). λpw(Dcp) = √(E/Fy)/(0.54·Mp/My − 0.09)² with Mp = 50·200 = 10,000 k·in, My = 50·173.27 = 8663.6 → 24.08/(0.5333)² = 84.7 ≥ 2Dcp/tw = 51.3 → compact web, Rpc = Mp/Myc = 1.1543.
  - FLB: λf = 8.99/1.36 = 6.61 ≤ λpf = 0.38·24.08 = 9.15 → no reduction.
  - LTB: rt = 8.99/√(12·(1 + 11.28·0.44/(3·8.99·0.68))) = 2.302 in; Lp = 2.302·24.08 = 55.4 in = 4.62 ft; FL = 0.7·50 = 35 ksi; Lr = 1.95·rt·(E/FL)·√(J/(Sxc·h))·√(1 + √(1 + 6.76·(FL·Sxc·h/(E·J))²)) with h = 23.24 in → 229.3 in = 19.11 ft. Mnc = [1 − (1 − 35·173.27/10,000)·(10 − 4.62)/(19.11 − 4.62)]·10,000 = [1 − 0.3935·0.3713]·10,000 = 8538.8 k·in.
  - Shear: D/tw = 51.27 ≤ 1.12·√(29000·5/50) = 60.3 → C = 1; Vp = 0.58·50·22.56·0.44 = 287.9 k.
  - Before: Mn⁺ = Mn⁻ = 833.3 k·ft, Vn = 0.6·50·10.52 = 315.6 k. After: Mn⁺ = Mn⁻ = 711.6 k·ft (−14.6 %), Vn = 287.9 k (−8.8 %). With Lb = 0: Mn = 833.3 k·ft (= Mp, unchanged). Rating check (synthetic 4 × 20.25 ft model, node 136: M_DC 30, M_DW 5, M_LL 155 k·ft): RF = (711.6 − 1.25·30 − 1.5·5)/(1.75·155) = 2.458 (was 2.906).
  - 6.10.8 path: plate girder d 74, tw 0.5, flanges 18 × 1, Lb 25 ft: 2Dc/tw = 144 > 137.3 → 6.10.8; awc = 2.0, Rb = 1 − 2/1800·(144 − 137.27) = 0.9925; rt = 4.50, Lp = 9.03 ft, Lr = π·4.5·√(29000/35) = 33.91 ft; Fnc = [1 − 0.3·(300 − 108.4)/(406.9 − 108.4)]·0.9925·50 = 40.07 ksi; Mn = 40.07·1716.6 = 68,788 k·in = 5732.3 k·ft. Vn: D/tw = 144 > 75.4 → C = 1.57·2900/144² = 0.2196, Vn = 0.2196·1044 = 229.2 k.
- **How verified:** functions evaluated in the page on the cases above (and A6 noncompact-web, stiffened shear and Lb > Lr cases); rating tab rendered main vs branch with seeded results (scenario "steel": zone 1 without plates is unchanged and warned; zone 2 with plates gives the numbers above). No console errors.
- **Other copies:** none in this file; stgirder.html has its own (separate) 6.10.8/A6 code.
- **Open items:** hybrid sections (Rh < 1) and Fyw ≠ Fyf are not modelled (one Fy per zone). Stiffener spacing applies to interior panels only (end panels: leave do blank).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 10240* (function computeCompositeMnNeg(z) {)

    Before:
    ```js
    
    function psGammaP(fpu, fpy) {
    ```
    After:
    ```js
    
    /* ── Steel I-section flexure and shear — AASHTO LRFD 10th Ed. ─────────────────
       Replaces Mn = Fy·Zx and Vn = 0.6·Fy·Aw in the "Steel Calc" and "Composite" zones,
       which assumed a compact, fully braced section with C = 1 whatever the plates or
       the bracing were. Needs the plates (d, tw, bf/tf top and bottom, in) and the
       unbraced length Lb of the compression flange (ft). Without them the zone falls
       back to the old formulas and says so (capWarn). Homogeneous section, Rh = 1.
         Flexure: App. A6 when 6.10.6.2.3 allows it (Fy <= 70 ksi, 2Dc/tw < 5.7√(E/Fyc),
                  Iyc/Iyt >= 0.3), else 6.10.8 (Fnc·Sxc with Rb, and Fyt·Sxt).
         Shear:   6.10.9 — Vn = C·Vp (unstiffened, k = 5), or the stiffened interior-panel
                  equations when a stiffener spacing do <= 3D is entered.            */
    function steelPlateSection(z) {
      const d=+z.d||0, tw=+z.tw||0, bft=+z.bfTop||0, tft=+z.tfTop||0, bfb=+z.bfBot||0, tfb=+z.tfBot||0;
      if (!(d>0 && tw>0 && bft>0 && tft>0 && bfb>0 && tfb>0 && d>tft+tfb)) return null;
      const D = d-tft-tfb;
      const parts = [{A:bft*tft, y:tft/2,   I0:bft*tft*tft*tft/12},
                     {A:tw*D,    y:tft+D/2, I0:tw*D*D*D/12},
                     {A:bfb*tfb, y:d-tfb/2, I0:bfb*tfb*tfb*tfb/12}];
      const A = parts.reduce((s,p)=>s+p.A,0);
      const ybar = parts.reduce((s,p)=>s+p.A*p.y,0)/A;                 // from top of steel
      const Ix = parts.reduce((s,p)=>s+p.I0+p.A*(p.y-ybar)*(p.y-ybar),0);
      const layers = [{a:bft*tft, y0:0, y1:tft}, {a:tw*D, y0:tft, y1:d-tfb}, {a:bfb*tfb, y0:d-tfb, y1:d}];
      const J = (D*tw*tw*tw + bft*tft*tft*tft*(1-0.63*tft/bft) + bfb*tfb*tfb*tfb*(1-0.63*tfb/bfb))/3;
      return { d, tw, bft, tft, bfb, tfb, D, A, ybar, Ix, Stop:Ix/ybar, Sbot:Ix/(d-ybar), J, layers };
    }
    
    // Plastic moment (kip·in) and plastic neutral axis (from top of steel) of the bare steel.
    function steelPlastic(s, Fy) {
      const net = y => Fy*(2*compAreaAbove(s.layers, y) - s.A);
      const y = compSolvePNA(net, 0, s.d);
      return { Mp: compSteelMoment(s.layers, y, Fy), yp: y };
    }
    
    // Nominal flexural resistance (kip·in) of a steel I-section with the compression flange
    // 'top' or 'bot'. o = {Fy, comp, Lb (in), Cb, Mp (kip·in, optional: tabulated Fy·Zx)}.
    function steelIFlexure(s, o) {
      const E = STEEL_E, Fy = +o.Fy||50, Rh = 1, top = o.comp !== 'bot';
      const bfc = top?s.bft:s.bfb, tfc = top?s.tft:s.tfb, bftn = top?s.bfb:s.bft, tftn = top?s.tfb:s.tft;
      const Sxc = top?s.Stop:s.Sbot, Sxt = top?s.Sbot:s.Stop;
      const pl = steelPlastic(s, Fy);
      const Mp = (+o.Mp>0) ? +o.Mp : pl.Mp;
      const webTop = s.tft, webBot = s.d - s.tfb;
      const clampD = v => Math.min(Math.max(v,0), s.D);
      const Dc  = clampD(top ? s.ybar - webTop : webBot - s.ybar);      // elastic, D6.3.1
      const Dcp = clampD(top ? pl.yp - webTop  : webBot - pl.yp);       // plastic, D6.3.2
      const Myc = Fy*Sxc, Myt = Fy*Sxt, My = Math.min(Myc, Myt);
      const lamRw = 5.7*Math.sqrt(E/Fy);
      const Iyc = tfc*bfc*bfc*bfc/12, Iyt = tftn*bftn*bftn*bftn/12;
      const lamF = bfc/(2*tfc), lamPf = 0.38*Math.sqrt(E/Fy);
      const rt = bfc/Math.sqrt(12*(1 + Dc*s.tw/(3*bfc*tfc)));
      const Lb = Math.max(0, +o.Lb||0), Cb = (+o.Cb>0) ? +o.Cb : 1;
      const a6 = Fy <= 70 && 2*Dc/s.tw < lamRw && Iyc/Iyt >= 0.3;       // 6.10.6.2.3
      if (a6) {
        // App. A6 — web plastification factors (A6.2), FLB (A6.3.2), LTB (A6.3.3), TFY (A6.4)
        const base = 0.54*Mp/(Rh*My) - 0.09;
        let lamPwDcp = Math.sqrt(E/Fy)/(base*base);
        if (Dc > 0) lamPwDcp = Math.min(lamPwDcp, lamRw*Dcp/Dc);
        const webCompact = 2*Dcp/s.tw <= lamPwDcp;
        let Rpc = Mp/Myc, Rpt = Mp/Myt;
        if (!webCompact) {
          const lamW = 2*Dc/s.tw, lamPwDc = Math.min(Dcp>0 ? lamPwDcp*Dc/Dcp : lamRw, lamRw);
          const f = lamRw > lamPwDc ? (lamW - lamPwDc)/(lamRw - lamPwDc) : 1;
          Rpc = Math.min((1 - (1 - Rh*Myc/Mp)*f)*Mp/Myc, Mp/Myc);
          Rpt = Math.min((1 - (1 - Rh*Myt/Mp)*f)*Mp/Myt, Mp/Myt);
        }
        const FL = Sxt/Sxc >= 0.7 ? 0.7*Fy : Math.max(Rh*Fy*Sxt/Sxc, 0.5*Fy);
        const kc = Math.min(Math.max(4/Math.sqrt(s.D/s.tw), 0.35), 0.76);
        const lamRf = 0.95*Math.sqrt(E*kc/FL);
        const RM = Rpc*Myc, red = 1 - FL*Sxc/RM;
        const Mflb = lamF <= lamPf ? RM : (1 - red*(lamF-lamPf)/(lamRf-lamPf))*RM;
        const h = s.d - tfc/2 - tftn/2;
        const Lp = rt*Math.sqrt(E/Fy);
        const Lr = 1.95*rt*(E/FL)*Math.sqrt(s.J/(Sxc*h))*Math.sqrt(1 + Math.sqrt(1 + 6.76*Math.pow(FL*Sxc*h/(E*s.J),2)));
        let Mltb;
        if (Lb <= Lp) Mltb = RM;
        else if (Lb <= Lr) Mltb = Math.min(Cb*(1 - red*(Lb-Lp)/(Lr-Lp))*RM, RM);
        else { const Fcr = Cb*Math.PI*Math.PI*E/Math.pow(Lb/rt,2)*Math.sqrt(1 + 0.078*s.J/(Sxc*h)*Math.pow(Lb/rt,2));
               Mltb = Math.min(Fcr*Sxc, RM); }
        const Mnt = Rpt*Myt;
        const Mn = Math.max(0, Math.min(Mflb, Mltb, Mnt));
        return { Mn, method:'A6', webCompact, Rpc, Rpt, Lp, Lr, rt, Dc, Dcp, Mp, Myc,
                 gov: Mn >= 0.9999*Mp ? 'Mp' : Mn===Mnt ? 'TFY' : Mn===Mflb ? 'FLB' : 'LTB' };
      }
      // 6.10.8 — compression flange (6.10.8.2) and tension flange yielding (6.10.8.3)
      const Fyr = Math.max(Math.min(0.7*Fy, Rh*Fy*Sxt/Sxc, Fy), 0.5*Fy);
      const awc = 2*Dc*s.tw/(bfc*tfc);
      const Rb = 2*Dc/s.tw <= lamRw ? 1 : Math.min(1, 1 - awc/(1200+300*awc)*(2*Dc/s.tw - lamRw));
      const lamRf = 0.56*Math.sqrt(E/Fyr);
      const Fmax = Rb*Rh*Fy, red = 1 - Fyr/(Rh*Fy);
      const Fflb = lamF <= lamPf ? Fmax : (1 - red*(lamF-lamPf)/(lamRf-lamPf))*Fmax;
      const Lp = rt*Math.sqrt(E/Fy), Lr = Math.PI*rt*Math.sqrt(E/Fyr);
      let Fltb;
      if (Lb <= Lp) Fltb = Fmax;
      else if (Lb <= Lr) Fltb = Math.min(Cb*(1 - red*(Lb-Lp)/(Lr-Lp))*Fmax, Fmax);
      else Fltb = Math.min(Cb*Rb*Math.PI*Math.PI*E/Math.pow(Lb/rt,2), Fmax);
      const Mnc = Math.min(Fflb, Fltb)*Sxc, Mnt = Rh*Fy*Sxt;
      const Mn = Math.max(0, Math.min(Mnc, Mnt));
      return { Mn, method:'6.10.8', Rb, Lp, Lr, rt, Dc, Dcp, Mp, Myc,
               gov: Mn===Mnt ? 'TFY' : Fflb<=Fltb ? 'FLB' : 'LTB' };
    }
    
    // Nominal shear resistance (kips), AASHTO 6.10.9. doIn = transverse stiffener spacing (in);
    // blank/0 or > 3D = unstiffened. End panels (6.10.9.3.3) are C·Vp: leave do blank there.
    function steelIVn(s, Fy, doIn) {
      const E = STEEL_E, D = s.D, tw = s.tw, dO = +doIn||0;
      const stiff = dO > 0 && dO <= 3*D;
      const k = stiff ? 5 + 5/((dO/D)*(dO/D)) : 5;
      const r = D/tw, lim = Math.sqrt(E*k/Fy);
      const C = r <= 1.12*lim ? 1 : r <= 1.40*lim ? 1.12*lim/r : 1.57*E*k/(Fy*r*r);
      const Vp = 0.58*Fy*D*tw;
      let Vn = C*Vp;
      if (stiff) {
        const q = dO/D, ratio = 2*D*tw/(s.bft*s.tft + s.bfb*s.tfb);
        Vn = ratio <= 2.5 ? Vp*(C + 0.87*(1-C)/Math.sqrt(1+q*q))
                          : Vp*(C + 0.87*(1-C)/(Math.sqrt(1+q*q) + q));
      }
      return { Vn, C, Vp, k, stiff };
    }
    
    // Unbraced length entered? Blank means unknown (not "braced"): the AASHTO path needs it.
    function capLbKnown(z) { return z.Lb!=null && z.Lb!=='' && isFinite(+z.Lb) && +z.Lb >= 0; }
    
    /* Capacities of a 'quickcalc' or 'composite' zone: {MnPos, MnNeg (ft·k), Vn (k),
       basis:{pos,neg,v}, warn:[...]}. Old zones without plates/Lb keep the old numbers
       and carry a warning instead; nothing is assumed in place of a missing input. */
    function steelZoneCaps(z) {
      const Fy = +z.Fy||50, warn = [], basis = {};
      const s = steelPlateSection(z), lbOK = capLbKnown(z), Lb = lbOK ? +z.Lb*12 : 0, Cb = +z.Cb||1;
      const need = !s ? 'enter d, tw and the four flange plates' + (lbOK ? '' : ' and Lb')
                      : 'enter Lb (unbraced length of the compression flange)';
      const flex = (comp, Zx) => {
        const r = steelIFlexure(s, {Fy, comp, Lb, Cb, Mp: Zx>0 ? Fy*Zx : 0});
        return { Mn: +(r.Mn/12).toFixed(1), txt: (r.method==='A6'?'App. A6':'6.10.8')+' ('+r.gov+')' };
      };
      let MnPos, MnNeg, Vn;
      if (z.type === 'composite') {
        const pp = compPlasticPos(z);
        MnPos = pp ? pp.Mn : 0;
        basis.pos = pp ? ('6.10.7.1.2 Mp'+(pp.redDpDt<1 ? '·(1.07−0.7Dp/Dt)='+pp.redDpDt.toFixed(3) : ' (Dp ≤ 0.1Dt)')) : '—';
        if (pp && !pp.ductOK) warn.push('Mn⁺: Dp = '+pp.Dp+'" > 0.42·Dt = '+(0.42*pp.Dt).toFixed(2)+'" — fails the 6.10.7.3 ductility requirement');
        if (pp && !pp.webCompact) warn.push('Mn⁺: web is not compact (6.10.6.2.2) — Mn⁺ needs 6.10.7.2 (not computed here); the plastic value is unconservative');
        // Negative moment
        const gate = (z.useCompNeg && s && lbOK) ? compNegPlasticGate(z, s, Lb) : null;
        if (z.useCompNeg && gate && gate.ok) {
          MnNeg = computeCompositeMnNeg(z); basis.neg = 'App. A6 — composite Mp (steel + rebar)';
        } else if (s && lbOK) {
          const f = flex('bot', +z.ZxNeg||0); MnNeg = f.Mn; basis.neg = f.txt+' — steel only';
          if (z.useCompNeg) warn.push('Mn⁻: composite plastic moment not used — '+(gate?gate.why:'')+'; steel section only');
        } else {
          MnNeg = z.ZxNeg>0 ? Fy*z.ZxNeg/12 : (z.MnNeg||0);
          basis.neg = z.ZxNeg>0 ? 'Fy·Zx⁻ (not checked)' : 'entered';
          if (z.ZxNeg>0 || z.useCompNeg) warn.push('Mn⁻ = Fy·Zx⁻ assumes a compact, braced section — '+need+' for App. A6 / 6.10.8'
            +(z.useCompNeg ? ' (composite Mn⁻ needs them too)' : ''));
        }
      } else {
        if (s && lbOK) {
          const fp = flex('top', +z.ZxPos||0), fn = flex('bot', +z.ZxNeg||0);
          MnPos = fp.Mn; basis.pos = fp.txt; MnNeg = fn.Mn; basis.neg = fn.txt;
        } else {
          MnPos = z.ZxPos>0 ? Fy*z.ZxPos/12 : z.MnPos;
          MnNeg = z.ZxNeg>0 ? Fy*z.ZxNeg/12 : z.MnNeg;
          basis.pos = z.ZxPos>0 ? 'Fy·Zx⁺ (not checked)' : 'entered';
          basis.neg = z.ZxNeg>0 ? 'Fy·Zx⁻ (not checked)' : 'entered';
          if (z.ZxPos>0 || z.ZxNeg>0) warn.push('Mn = Fy·Zx assumes a compact, fully braced section — '+need+' for App. A6 / 6.10.8');
        }
      }
      if (s) {
        const v = steelIVn(s, Fy, z.do); Vn = +v.Vn.toFixed(1);
        basis.v = '6.10.9 C='+v.C.toFixed(3)+(v.stiff?' (stiffened)':' (unstiffened)');
      } else {
        Vn = z.Aw>0 ? 0.6*Fy*z.Aw : (z.Vn||0);
        basis.v = z.Aw>0 ? '0.6·Fy·Aw (not checked)' : 'entered';
        if (z.Aw>0) warn.push('Vn = 0.6·Fy·Aw assumes C = 1 — enter d, tw and the flange plates for 6.10.9 (Vn = C·0.58·Fy·D·tw)');
      }
      return { MnPos, MnNeg, Vn, basis, warn };
    }
    
    /* App. A6 gate for the optional composite plastic Mn⁻ (steel + deck rebar). Allowed only
       when the section qualifies for A6 (6.10.6.2.3), the web is compact (A6.2.1), the
       compression flange is compact (A6.3.2) and Lb <= Lp (A6.3.3) — then A6 gives Mn = Mp.
       Dc uses steel + longitudinal rebar (D6.3.1). My for λpw is the bare-steel yield moment,
       a lower bound on the staged composite My, which makes the web test stricter. */
    function compNegPlasticGate(z, s, LbIn) {
      const E = STEEL_E, Fy = +z.Fy||50, ts = +z.ts||8, th = +z.th||0, yTop = ts+th;
      const Asr = +z.Asr||0, dsr = (+z.dsr||0)>0 ? +z.dsr : ts/2;
      const pn = compPlasticNeg(z);
      if (!pn) return {ok:false, why:'plastic Mn⁻ cannot be computed'};
      const webBot = yTop + s.d - s.tfb, webTop = yTop + s.tft;
      const ybar = (s.A*(yTop + s.ybar) + Asr*dsr)/(s.A + Asr);
      const clampD = v => Math.min(Math.max(v,0), s.D);
      const Dc = clampD(webBot - Math.max(ybar, webTop));
      const Dcp = clampD(webBot - Math.max(pn.yPNA, webTop));
      const Mp = pn.Mn*12, My = Fy*Math.min(s.Stop, s.Sbot);
      const lamRw = 5.7*Math.sqrt(E/Fy);
      if (Fy > 70) return {ok:false, why:'Fy > 70 ksi (6.10.6.2.3)'};
      if (!(2*Dc/s.tw < lamRw)) return {ok:false, why:'2Dc/tw ≥ 5.7√(E/Fyc) (6.10.6.2.3)'};
      if (!((s.tfb*Math.pow(s.bfb,3))/(s.tft*Math.pow(s.bft,3)) >= 0.3)) return {ok:false, why:'Iyc/Iyt < 0.3 (6.10.6.2.3)'};
      const base = 0.54*Mp/My - 0.09;
      let lamPw = Math.sqrt(E/Fy)/(base*base);
      if (Dc > 0) lamPw = Math.min(lamPw, lamRw*Dcp/Dc);
      if (!(2*Dcp/s.tw <= lamPw)) return {ok:false, why:'web not compact, 2Dcp/tw = '+(2*Dcp/s.tw).toFixed(1)+' > λpw = '+lamPw.toFixed(1)+' (A6.2.1)'};
      if (!(s.bfb/(2*s.tfb) <= 0.38*Math.sqrt(E/Fy))) return {ok:false, why:'bottom flange not compact (A6.3.2)'};
      const rt = s.bfb/Math.sqrt(12*(1 + Dc*s.tw/(3*s.bfb*s.tfb)));
      const Lp = rt*Math.sqrt(E/Fy);
      if (!(LbIn <= Lp)) return {ok:false, why:'Lb = '+(LbIn/12).toFixed(2)+' ft > Lp = '+(Lp/12).toFixed(2)+' ft (A6.3.3)'};
      return {ok:true, why:'', Dc, Dcp, Lp};
    }
    
    function psGammaP(fpu, fpy) {
    ```
  - *Hunk at ≈ line 11802* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
        if (z.type==='quickcalc') {
          return {
            MnPos: z.ZxPos>0 ? z.Fy*z.ZxPos/12 : z.MnPos,
            MnNeg: z.ZxNeg>0 ? z.Fy*z.ZxNeg/12 : z.MnNeg,
            Vn:    z.Aw>0    ? 0.6*z.Fy*z.Aw   : z.Vn,
            SxPos: z.SxPos||0, SxNeg: z.SxNeg||0,
          };
    ```
    After:
    ```js
        if (z.type==='quickcalc') {
          // AASHTO A6 / 6.10.8 / 6.10.9 when the plates and Lb are entered; otherwise the
          // old Fy·Zx and 0.6·Fy·Aw with a warning (steelZoneCaps, sweep IDX-A1).
          const c = steelZoneCaps(z);
          return {
            MnPos: c.MnPos, MnNeg: c.MnNeg, Vn: c.Vn,
            SxPos: z.SxPos||0, SxNeg: z.SxNeg||0, _basis:c.basis, _warn:c.warn,
          };
    ```
  - *Hunk at ≈ line 12119* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      const psNegPlaceholder = capZones.filter(z=>z.type==='psconc'&&!z.MnNeg);
    
    ```
    After:
    ```js
      const psNegPlaceholder = capZones.filter(z=>z.type==='psconc'&&!z.MnNeg);
      // Steel Calc / Composite zones still on the unchecked Fy·Zx / 0.6·Fy·Aw (no plates or Lb).
      const steelCapWarn = capZones.map((z,i)=>({i, w:(z.type==='quickcalc'||z.type==='composite') ? steelZoneCaps(z).warn : []}))
        .filter(x=>x.w.length);
    
    ```
  - *Hunk at ≈ line 14242* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                  </div>}
                  {phiCSfloored&&<div style={{color:'#b45309',fontWeight:600,marginBottom:'3px'}}>
    ```
    After:
    ```js
                  </div>}
                  {steelCapWarn.map(x=><div key={'scw'+x.i} style={{color:'#b91c1c',fontWeight:600,marginBottom:'3px'}}>
                    ⚠ Zone {x.i+1}: {x.w.join(' · ')}
                  </div>)}
                  {phiCSfloored&&<div style={{color:'#b45309',fontWeight:600,marginBottom:'3px'}}>
    ```
  - *Hunk at ≈ line 14425* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                          </div>
                          <div style={{fontSize:'10px',fontFamily:'monospace',color:'#6b7280'}}>
                            → Mn⁺ = {(z.ZxPos>0?z.Fy*(z.ZxPos||0)/12:z.MnPos||0).toFixed(1)} ft·k &nbsp;
                               Mn⁻ = {(z.ZxNeg>0?z.Fy*(z.ZxNeg||0)/12:z.MnNeg||0).toFixed(1)} ft·k &nbsp;
                               Vn = {(z.Aw>0?0.6*(z.Fy||0)*(z.Aw||0):z.Vn||0).toFixed(1)} kips
                          </div>
    ```
    After:
    ```js
                          </div>
                          {/* Steel Calc: plates, bracing and stiffener spacing for App. A6 / 6.10.8 / 6.10.9 */}
                          {z.type==='quickcalc'&&(
                            <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px',marginBottom:'6px'}}>
                              {[['d (in)','d'],['tw (in)','tw'],['bf top (in)','bfTop'],['tf top (in)','tfTop'],['bf bot (in)','bfBot'],
                                ['tf bot (in)','tfBot'],['Lb (ft)','Lb'],['Cb','Cb'],['do (in) stiff.','do']].map(([lbl,field])=>(
                                <div key={field}>
                                  <div style={{fontSize:'9.5px',fontFamily:'monospace',color:'#6b7280',marginBottom:'3px'}}>{lbl}</div>
                                  <input type="number" step="0.01" style={{...INP2,fontFamily:'monospace',fontWeight:'600',fontSize:'12px'}}
                                    value={z[field]??''} placeholder={field==='Cb'?'1.0':field==='do'?'unstiff.':'—'}
                                    onChange={e=>updateCapZone(z.id,field,e.target.value===''?null:(parseFloat(e.target.value)||0))}/>
                                </div>
                              ))}
                            </div>
                          )}
                          <div style={{fontSize:'10px',fontFamily:'monospace',color:'#6b7280'}}>
                            → Mn⁺ = {(+cap.MnPos||0).toFixed(1)} ft·k &nbsp;
                               Mn⁻ = {(+cap.MnNeg||0).toFixed(1)} ft·k &nbsp;
                               Vn = {(+cap.Vn||0).toFixed(1)} kips
                            {cap._basis&&<div style={{color:'#9ca3af',marginTop:'2px'}}>
                              basis: Mn⁺ {cap._basis.pos} · Mn⁻ {cap._basis.neg} · Vn {cap._basis.v}
                            </div>}
                            {(cap._warn||[]).map((w,k)=><div key={k} style={{color:'#b91c1c',fontWeight:600,marginTop:'2px'}}>⚠ {w}</div>)}
                          </div>
    ```
  - *Hunk at ≈ line 19921* (function generateReportHTML({ cfg, mctOutput, rows, nodePositions, rat…)

    Before:
    ```js
                <td class="mono">${parseFloat(z.endX).toFixed(3)}</td>
                <td>${z.type==='quickcalc'?`Fy=${z.Fy}ksi Zx+=${z.ZxPos} Zx-=${z.ZxNeg} Aw=${z.Aw}`:'Manual'}</td>
                <td class="mono">${cap.MnPos.toFixed(1)}</td>
    ```
    After:
    ```js
                <td class="mono">${parseFloat(z.endX).toFixed(3)}</td>
                <td>${z.type==='quickcalc'?`Fy=${z.Fy}ksi Zx+=${z.ZxPos} Zx-=${z.ZxNeg} Aw=${z.Aw}`:'Manual'}${cap._basis?`<br/><span style="font-size:8pt;color:#6b7280">Mn⁺ ${cap._basis.pos} · Mn⁻ ${cap._basis.neg} · Vn ${cap._basis.v}</span>`:''}${(cap._warn||[]).map(w=>`<br/><span style="font-size:8pt;color:#b91c1c">⚠ ${w}</span>`).join('')}</td>
                <td class="mono">${cap.MnPos.toFixed(1)}</td>
    ```

### SW3. Composite zone: Mn⁻ only behind the App. A6 gate; Vn per 6.10.9 (IDX-A3)   [calc change] [MORE conservative]
- **Where:** `capAt()` composite branch (anchor `if (z.type==='composite') {`), `steelZoneCaps` / `compNegPlasticGate` (SW2), Composite inputs (anchor `Lb = unbraced length of the bottom (compression) flange`), live preview (anchor `const cc    = steelZoneCaps(z);`).
- **Problem:** with "Use composite Mn⁻" ticked, Mn⁻ was the plastic moment of steel + deck rebar for any section. 6.10.8 governs negative flexure unless App. A6 applies, and A6 gives Mp only for a compact web, a compact compression flange and Lb ≤ Lp. Unticked, Mn⁻ = Fy·Zx⁻ (same issue as SW2). Vn = 0.6·Fy·Aw (C = 1).
- **Fix:** the composite plastic Mn⁻ is used only when (6.10.6.2.3) Fy ≤ 70, 2Dc/tw < 5.7√(E/Fyc), Iyc/Iyt ≥ 0.3, and (A6.2.1) 2Dcp/tw ≤ λpw(Dcp), and (A6.3.2) bfc/2tfc ≤ 0.38√(E/Fyc), and (A6.3.3) Lb ≤ Lp — then A6 gives Mn = Mp. Dc uses steel + longitudinal rebar (D6.3.1). For λpw the bare-steel yield moment is used as My: a lower bound on the staged composite My, so the web test is stricter (conservative; the staged My needs the DC1 moment). Otherwise, with plates and Lb: the steel section alone per SW2 (rebar ignored, conservative), with the reason shown. Without plates or Lb: Fy·Zx⁻ (or the entered Mn⁻) with a warning — the composite plastic value is no longer used. Vn per 6.10.9 when the plates are entered, else 0.6·Fy·Aw with a warning. New inputs Lb, Cb, do.
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.6.2.3, A6.2.1, A6.3.2, A6.3.3, D6.1, D6.3.1/D6.3.2, 6.10.8, 6.10.9.
- **Before:** `MnNeg = useCompNeg ? computeCompositeMnNeg(z) : Fy·ZxNeg/12`; `Vn = 0.6·Fy·Aw`. **After:** as above.
- **Check case 1 (saved zone, no plates):** Fy 50, f'c 4, beff 96, ts 8, th 2, d 36, tw 0.5, Zx⁻ 900, Aw 18, Asr 6, "use composite Mn⁻" ticked. Before: Mn⁻ = 4137.9 k·ft (plastic, steel backed out of Zx⁻ + rebar). After: Mn⁻ = Fy·Zx⁻ = 50·900/12 = 3750.0 k·ft with the warning (−9.4 %). Vn unchanged at 0.6·50·18 = 540 k with a warning.
- **Check case 2 (plates, gate fails):** same deck, plates 12 × 0.75 / 14 × 1.25, Lb 15 ft. Composite plastic Mn⁻ = 3247.8 k·ft; gate: 2Dcp/tw = 62.8 > λpw = 31.4 → not compact → steel only, App. A6 (LTB) Mn⁻ = 2210.7 k·ft. Vn: D = 34, D/tw = 68 > 60.3 → C = 1.12·53.85/68 = 0.887; Vp = 0.58·50·34·0.5 = 493 k → Vn = 437.3 k (was 540).
- **Check case 3 (plates, gate passes):** Fy 50, d 30, tw 0.75, top 14 × 1.5, bottom 16 × 2, ts 8, th 2, Asr 3, Lb 3 ft: Dc = 11.94 in, Dcp = 8.32 in, Lp = 8.87 ft; all checks pass → Mn⁻ = composite Mp = 3908.8 k·ft (before: the same 3908.8).
- **How verified:** as SW2; rating tab scenarios "comp" and "comp2" main vs branch.
- **Other copies:** none.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 11811* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
        if (z.type==='composite') {
          const MnPos = computeCompositeMnPos(z);
          const MnNeg = z.useCompNeg ? computeCompositeMnNeg(z) : (z.ZxNeg>0 ? z.Fy*z.ZxNeg/12 : z.MnNeg||0);
          const Vn    = z.Aw>0 ? 0.6*z.Fy*z.Aw : z.Vn||0;
          return { MnPos, MnNeg, Vn, SxPos: z.SxPos||0, SxNeg: z.SxNeg||0, _zone:z };
        }
    ```
    After:
    ```js
        if (z.type==='composite') {
          // Mn⁺ with the 6.10.7.1.2 Dp/Dt reduction; Mn⁻ and Vn as for the steel zone, the
          // composite plastic Mn⁻ only behind the App. A6 gate (sweep IDX-A2/A3).
          const c = steelZoneCaps(z);
          return { MnPos:c.MnPos, MnNeg:c.MnNeg, Vn:c.Vn, SxPos: z.SxPos||0, SxNeg: z.SxNeg||0, _zone:z,
                   _basis:c.basis, _warn:c.warn };
        }
    ```
  - *Hunk at ≈ line 14504* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                          </div>
                          <div style={{marginTop:'4px',fontSize:'8.5px',fontFamily:'monospace',color:'#9ca3af'}}>
                            Zx⁻ = plastic section modulus of steel for negative moment zones ·
    ```
    After:
    ```js
                          </div>
                          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'5px',marginTop:'5px'}}>
                            {[["Lb (ft) unbraced",'Lb','—'],["Cb",'Cb','1.0'],["do (in) stiffeners",'do','unstiff.']
                            ].map(([lbl,field,ph])=>(
                              <div key={field}>
                                <div style={STYLES.monoTiny2}>{lbl}</div>
                                <input type="number" step="0.01" style={{...INP2,fontFamily:'monospace',fontWeight:'600',fontSize:'11px'}}
                                  value={z[field]??''} placeholder={ph}
                                  onChange={e=>updateCapZone(z.id,field,e.target.value===''?null:(parseFloat(e.target.value)||0))}/>
                              </div>
                            ))}
                          </div>
                          <div style={{marginTop:'4px',fontSize:'8.5px',fontFamily:'monospace',color:'#9ca3af'}}>
                            Lb = unbraced length of the bottom (compression) flange in the negative-moment region · do = transverse
                            stiffener spacing for 6.10.9 interior panels (blank = unstiffened web; leave blank for end panels) ·
                            Zx⁻ = plastic section modulus of steel for negative moment zones ·
    ```
  - *Hunk at ≈ line 14590* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                          const pp    = compPlasticPos(z);
                          const MnPos = pp ? pp.Mn : 0;
                          const MnNeg = z.useCompNeg ? computeCompositeMnNeg(z) : (z.ZxNeg>0?z.Fy*z.ZxNeg/12:z.MnNeg||0);
                          const Vn    = z.Aw>0 ? 0.6*(z.Fy||50)*z.Aw : (z.Vn||0);
                          return (
    ```
    After:
    ```js
                          const pp    = compPlasticPos(z);
                          const cc    = steelZoneCaps(z);
                          const MnPos = cc.MnPos;
                          const MnNeg = cc.MnNeg;
                          const Vn    = cc.Vn;
                          return (
    ```

### SW4. "↓ From <shape>" import kept only Aw   [bug fix] [result change only when the button is used]
- **Where:** `importFromSectionProps` (≈ line 11763), anchor `const [d,,Zx,Sx] = props;`.
- **Problem:** found while doing SW2. The import called `updateCapZone` five times; each call maps the same (stale) `capZones`, so only the last field, Aw, was stored — Zx⁺/Zx⁻/Sx⁺/Sx⁻ were never imported. Now one update; it also fills d, tw and (when the shape is in `ROLLED_SHAPES`) the flange plates for SW2. Lb is never filled.
- **Governing provision:** n/a (data entry). **Check case:** W24X76 zone, click import: before, ZxPos stays 0 and only Aw = 10.52 is set; after, ZxPos = ZxNeg = 200, SxPos = SxNeg = 176, Aw = 10.52, d 23.92, tw 0.44, flanges 8.99 × 0.68.
- **How verified:** code reading (React state setter called with a value, not an updater) and the page.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 11763* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
        const Aw = +(d*props[1]).toFixed(2);
        updateCapZone(zoneId,'ZxPos',Zx);
        updateCapZone(zoneId,'ZxNeg',Zx);
        updateCapZone(zoneId,'SxPos',Sx);
        updateCapZone(zoneId,'SxNeg',Sx);
        updateCapZone(zoneId,'Aw',Aw);
      };
    ```
    After:
    ```js
        const Aw = +(d*props[1]).toFixed(2);
        // One update, not five: each updateCapZone() maps the same stale capZones, so only
        // the last field (Aw) used to survive. Plates come from ROLLED_SHAPES when it has
        // the shape (for the AASHTO A6 / 6.10.8 / 6.10.9 check); Lb is never guessed.
        const rs = ROLLED_SHAPES[secZone.name];
        const plates = rs ? {d:rs.d, tw:rs.tw, bfTop:rs.bf, tfTop:rs.tf, bfBot:rs.bf, tfBot:rs.tf}
                          : {d, tw:props[1]};
        setCapZones(capZones.map(q=>q.id===zoneId?{...q, ZxPos:Zx, ZxNeg:Zx, SxPos:Sx, SxNeg:Sx, Aw, ...plates}:q));
      };
    ```
  - *Hunk at ≈ line 14361* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                          <button onClick={()=>importFromSectionProps(z.id)}
                            title={`Import Zx and Aw from ${matchSec.name}`}
                            style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'4px',
    ```
    After:
    ```js
                          <button onClick={()=>importFromSectionProps(z.id)}
                            title={`Import Zx, Sx, Aw, d, tw (and flange plates when listed) from ${matchSec.name}`}
                            style={{background:'#eff6ff',border:'1px solid #bfdbfe',borderRadius:'4px',
    ```

### SW5. Service II: LL scale (g·IM·m·F) and the MBE γLL per level (IDX-O6, part)   [calc change] [N — MORE conservative when the model has no IM; LESS when g < 1 is entered or at Operating/Permit]
- **Where:** `StepResults`, before `const serviceIIData = useMemo` (anchor `// γLL for Service II, MBE Table 6A.4.2.2-1`), inside it (anchors `const Mllp = (llp?.momentY || 0) * serviceIIScale;`, `serviceIIGamLL`), and the Service II tab text / summary row.
- **Problem:** the Service II check used the raw MIDAS LL moment (no distribution factor, no IM when the MCT does not carry it, no m/F), while Strength I scales LL by g·(1+IM)·m·F₁·F₂; and γLL was 1.30 at every level, though MBE Table 6A.4.2.2-1 gives Operating 1.00 and Permit 1.00.
- **Fix:** f_LL is scaled exactly as Strength I scales its LL: `ratingLLScaleOf(ratingLLFactors, mctCarriesImpact(cfg, <Service II LL case>))`, with the hogging check on the negative-moment g (`dfNeg`) like Strength I. γLL = 1.30 (design Inventory, legal), 1.00 (design Operating, permit). The default (Inventory) keeps 1.30. The staged section modulus part of O6 is not changed (N1).
- **Governing provision:** AASHTO LRFD 10th Ed. 6.10.4.2.2; MBE 3rd Ed. 6A.4.2.1, Table 6A.4.2.2-1 (steel, Service II).
- **Before:** `f_LL = M_LL·12/Sx`, γLL = 1.3. **After:** `f_LL = M_LL·scale·12/Sx`, γLL = 1.30/1.00 as above.
- **Check case (synthetic model, node 136, Sx⁺ 150, Fy 50):** f_DC = 30·12/150 = 2.4, f_DW = 0.4, raw f_LL = 155·12/150 = 12.4 ksi, limit 0.95·50 = 47.5.
  - Before: RF = (47.5 − 2.4 − 0.4)/(1.3·12.4) = 2.773 (every case).
  - After, IM in the MCT, g off (scale 1.0): RF = 2.773 (unchanged). After, g = 0.6 and IM 33 % not in the MCT (scale 0.6·1.33 = 0.798): f_LL = 9.895 → RF = 44.7/(1.3·9.895) = 3.475. After, Operating (γLL 1.00, scale 1.0): RF = 44.7/12.4 = 3.605.
- **How verified:** rating tab rendered main vs branch (scenarios "manual", "manualdf", "manualop"): Strength I rows identical; Service II rows change exactly as above.
- **Other copies:** none.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 12239* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      // Sx is taken from cap zone SxPos/SxNeg fields; Fyf from zone Fy field
      const serviceIIData = useMemo(()=>{
    ```
    After:
    ```js
      // Sx is taken from cap zone SxPos/SxNeg fields; Fyf from zone Fy field
      // γLL for Service II, MBE Table 6A.4.2.2-1 (steel): design Inventory 1.30, design
      // Operating 1.00, legal 1.30, permit 1.00 (was 1.30 for every level, sweep IDX-O6).
      const serviceIIGamLL = ratingMethod!=='LRFR' ? SERVICE_II_FACTORS.LL
        : ratingCategory==='Permit' ? 1.00 : ratingCategory==='Legal' ? 1.30
        : (ratingLevel==='Operating' ? 1.00 : 1.30);
      // Live-load scale g·(1+IM)·m·F1·F2 for Service II, as Strength I applies it: IM is
      // dropped when the MCT already carries it for this LL case; the hogging check uses
      // the negative-moment g (sweep IDX-O6).
      const serviceIICarriesIM = useMemo(()=>mctCarriesImpact(cfg, serviceIILLposLC),
        [JSON.stringify(cfg.selectedVehicles),JSON.stringify(cfg.vehicleDLA),cfg.useGlobalDLA,cfg.globalDLA,cfg.geomMode,serviceIILLposLC]);
      const serviceIIScale    = ratingLLScaleOf(ratingLLFactors, serviceIICarriesIM);
      const serviceIIScaleNeg = (dfOn && dfNeg>0) ? serviceIIScale*(dfNeg/dfBase) : serviceIIScale;
      const serviceIIData = useMemo(()=>{
    ```
  - *Hunk at ≈ line 12277* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
          const Mdw  = dw?.momentY  || 0;
          const Mllp = llp?.momentY || 0;
          const Mlln = -hoggingMag(lln?.momentY);
    
    ```
    After:
    ```js
          const Mdw  = dw?.momentY  || 0;
          const Mllp = (llp?.momentY || 0) * serviceIIScale;
          const Mlln = -hoggingMag(lln?.momentY) * serviceIIScaleNeg;
    
    ```
  - *Hunk at ≈ line 12284* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
          const fLLpos  = toStress(Math.max(0,Mllp), SxPos);
          const demPos  = fDCpos!=null&&fLLpos!=null ? fDCpos+(fDWpos||0)+SERVICE_II_FACTORS.LL*fLLpos : null;
          // MBE 6A.4.2.1: RF = (C − γDC·fDC − γDW·fDW) / (γLL·fLL). Dead load comes
    ```
    After:
    ```js
          const fLLpos  = toStress(Math.max(0,Mllp), SxPos);
          const demPos  = fDCpos!=null&&fLLpos!=null ? fDCpos+(fDWpos||0)+serviceIIGamLL*fLLpos : null;
          // MBE 6A.4.2.1: RF = (C − γDC·fDC − γDW·fDW) / (γLL·fLL). Dead load comes
    ```
  - *Hunk at ≈ line 12293* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                                                SERVICE_II_FACTORS.DW, fDWpos||0,
                                                SERVICE_II_FACTORS.LL, fLLpos) : null;
          const rfPos   = _rfPos!=null ? +_rfPos.toFixed(4) : null;
    ```
    After:
    ```js
                                                SERVICE_II_FACTORS.DW, fDWpos||0,
                                                serviceIIGamLL, fLLpos) : null;
          const rfPos   = _rfPos!=null ? +_rfPos.toFixed(4) : null;
    ```
  - *Hunk at ≈ line 12300* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
          const fLLneg  = toStress(Math.abs(Mlln), SxNeg);
          const demNeg  = fDCneg!=null&&fLLneg!=null&&fLLneg>0 ? fDCneg+(fDWneg||0)+SERVICE_II_FACTORS.LL*fLLneg : null;
          const _rfNeg  = fDCneg!=null&&fLLneg!=null ? mbeRF(limit, SERVICE_II_FACTORS.DC, fDCneg,
                                                            SERVICE_II_FACTORS.DW, fDWneg||0,
                                                            SERVICE_II_FACTORS.LL, fLLneg) : null;
          const rfNeg   = _rfNeg!=null ? +_rfNeg.toFixed(4) : null;
    ```
    After:
    ```js
          const fLLneg  = toStress(Math.abs(Mlln), SxNeg);
          const demNeg  = fDCneg!=null&&fLLneg!=null&&fLLneg>0 ? fDCneg+(fDWneg||0)+serviceIIGamLL*fLLneg : null;
          const _rfNeg  = fDCneg!=null&&fLLneg!=null ? mbeRF(limit, SERVICE_II_FACTORS.DC, fDCneg,
                                                            SERVICE_II_FACTORS.DW, fDWneg||0,
                                                            serviceIIGamLL, fLLneg) : null;
          const rfNeg   = _rfNeg!=null ? +_rfNeg.toFixed(4) : null;
    ```
  - *Hunk at ≈ line 12324* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      },[origRows, capZones, nodePositions, serviceIIDcLC, serviceIIDwLC,
         serviceIILLposLC, serviceIILLnegLC, serviceIIRh]);
    
    ```
    After:
    ```js
      },[origRows, capZones, nodePositions, serviceIIDcLC, serviceIIDwLC,
         serviceIILLposLC, serviceIILLnegLC, serviceIIRh, serviceIIGamLL, serviceIIScale, serviceIIScaleNeg]);
    
    ```
  - *Hunk at ≈ line 15736* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                             gov:govOperating, hasTons:true},
                            ...(serviceIIData.length?[{ls:'Service II (Steel)',level:'—',gam:1.3,
                              gov:govServiceII,hasTons:false}]:[]),
    ```
    After:
    ```js
                             gov:govOperating, hasTons:true},
                            ...(serviceIIData.length?[{ls:'Service II (Steel)',level:'—',gam:serviceIIGamLL,
                              gov:govServiceII,hasTons:false}]:[]),
    ```
  - *Hunk at ≈ line 16214* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                      padding:'7px 10px',background:'#f0f9ff',border:'1px solid #bfdbfe',borderRadius:'5px'}}>
                      AASHTO LRFD 6.10.4.2 · f_DC + f_DW + 1.3·f_LL ≤ 0.95·Rh·Fyf · f = M·12/Sx (ksi)
                      <br/>MBE 6A.4.2.1 · RF = (0.95·Rh·Fyf − f_DC − f_DW) / (1.3·f_LL)
                      &nbsp;·&nbsp; <strong>Sx must be entered in the Capacity Zones above</strong>
    ```
    After:
    ```js
                      padding:'7px 10px',background:'#f0f9ff',border:'1px solid #bfdbfe',borderRadius:'5px'}}>
                      AASHTO LRFD 6.10.4.2 · f_DC + f_DW + γ_LL·f_LL ≤ 0.95·Rh·Fyf · f = M·12/Sx (ksi)
                      <br/>MBE 6A.4.2.1 · RF = (0.95·Rh·Fyf − f_DC − f_DW) / (γ_LL·f_LL) · γ_LL = {serviceIIGamLL} (MBE Table 6A.4.2.2-1: Inv 1.30 · Op 1.00 · Legal 1.30 · Permit 1.00)
                      <br/>f_LL = M_LL × {serviceIIScale.toFixed(4)} (g·(1+IM)·m·F₁·F₂ from the Inputs tab{serviceIICarriesIM?'; IM already in the MCT':''}){Math.abs(serviceIIScaleNeg-serviceIIScale)>1e-6?<> · hogging × {serviceIIScaleNeg.toFixed(4)} (g⁻)</>:null}
                      &nbsp;·&nbsp; <strong>Sx must be entered in the Capacity Zones above</strong>
    ```
  - *Hunk at ≈ line 16322* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        fontSize:'9.5px',fontFamily:'monospace',color:'#9ca3af'}}>
                        γ_DC=1.0 · γ_DW=1.0 · γ_LL=1.3 · Rh={serviceIIRh} · limit = 0.95·Rh·Fyf · f = M·12/Sx
                      </div>
    ```
    After:
    ```js
                        fontSize:'9.5px',fontFamily:'monospace',color:'#9ca3af'}}>
                        γ_DC=1.0 · γ_DW=1.0 · γ_LL={serviceIIGamLL} · LL × {serviceIIScale.toFixed(4)} · Rh={serviceIIRh} · limit = 0.95·Rh·Fyf · f = M·12/Sx
                      </div>
    ```

### SW6. PS Service III: LL scale (g·IM·m·F) (IDX-O6, part)   [calc change] [N — as SW5]
- **Where:** before `const psServiceIIIData = useMemo` (anchor `// LL scale g·(1+IM)·m·F1·F2 for PS Service III`) and inside it (anchor `const MLLp = Math.max(0, llp?.momentY||0) * ps3Scale;`); tab text.
- **Problem / fix:** as SW5 — the PS Service III tension check used the raw MIDAS LL moment. Now scaled by g·(1+IM)·m·F₁·F₂ (IM dropped when the MCT carries it), the top-fibre check by the negative-moment g. γLL stays the user input (default 0.8, MBE Table 6A.4.2.2-1).
- **Governing provision:** MBE 3rd Ed. 6A.5.4.2.2 (verify), Table 6A.4.2.2-1; LRFD 10th Ed. Table 5.9.2.3.2b-1.
- **Check case (top fibre over a pier, scenario "ps"):** St 9000 in³, f'c 6 → f_t = 0.19·√6 = 0.465 ksi, fpe(top) 0; M_DC −30, M_DW −5 k·ft → f = −0.040, −0.0067 ksi; hogging M_LL 70 k·ft → raw f_LL = 70·12/9000 = 0.0933 ksi; γLL 0.8; HL-93 DLA 0 in the MCT, IM 33 % on, g off → scale 1.33.
  - Before: RF = (0.465 + 0.0467)/(0.8·0.0933) = 6.858. After: f_LL = 0.1241 ksi, RF = 0.5121/(0.8·0.1241) = 5.156 (MORE conservative). With IM in the MCT and g off: unchanged.
- **How verified:** scenario "ps" main vs branch.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 12405* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      // RF = (fr + fpe - fDC - fDW) / (γ_LL · fLL)
      const psServiceIIIData = useMemo(()=>{
    ```
    After:
    ```js
      // RF = (fr + fpe - fDC - fDW) / (γ_LL · fLL)
      // LL scale g·(1+IM)·m·F1·F2 for PS Service III, as for Strength I (sweep IDX-O6).
      const ps3CarriesIM = useMemo(()=>mctCarriesImpact(cfg, ps3LLposLC),
        [JSON.stringify(cfg.selectedVehicles),JSON.stringify(cfg.vehicleDLA),cfg.useGlobalDLA,cfg.globalDLA,cfg.geomMode,ps3LLposLC]);
      const ps3Scale    = ratingLLScaleOf(ratingLLFactors, ps3CarriesIM);
      const ps3ScaleNeg = (dfOn && dfNeg>0) ? ps3Scale*(dfNeg/dfBase) : ps3Scale;
      const psServiceIIIData = useMemo(()=>{
    ```
  - *Hunk at ≈ line 12448* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
          const MDW  = dw?.momentY  || 0;
          const MLLp = Math.max(0, llp?.momentY||0);  // positive envelope
          const MLLn = Math.abs(Math.min(0, lln?.momentY||0)); // negative envelope magnitude
    
    ```
    After:
    ```js
          const MDW  = dw?.momentY  || 0;
          const MLLp = Math.max(0, llp?.momentY||0) * ps3Scale;  // positive envelope × LL scale
          const MLLn = Math.abs(Math.min(0, lln?.momentY||0)) * ps3ScaleNeg; // negative envelope magnitude × LL scale
    
    ```
  - *Hunk at ≈ line 12501* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      },[origRows, capZones, nodePositions, ps3DcLC, ps3DwLC, ps3LLposLC, ps3LLnegLC,
         ps3GamLL, ps3Exposure]);
    
    ```
    After:
    ```js
      },[origRows, capZones, nodePositions, ps3DcLC, ps3DwLC, ps3LLposLC, ps3LLnegLC,
         ps3GamLL, ps3Exposure, ps3Scale, ps3ScaleNeg]);
    
    ```
  - *Hunk at ≈ line 16738* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                      padding:'7px 10px',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:'5px'}}>
                      AASHTO MBE 6A.5.4.2 · Bottom fiber: f_DC/Sb + f_DW/Sb + γ_LL·f_LL/Sb ≤ fr + fpe
                      &nbsp;·&nbsp; RF = (fr + fpe − fDC − fDW) / (γ_LL · fLL) &nbsp;·&nbsp;
                      <strong>Requires PS Concrete zones with Sb, St, fpe defined above</strong>
    ```
    After:
    ```js
                      padding:'7px 10px',background:'#f5f3ff',border:'1px solid #ddd6fe',borderRadius:'5px'}}>
                      AASHTO MBE 6A.5.4.2 · Bottom fiber: f_DC/Sb + f_DW/Sb + γ_LL·f_LL/Sb ≤ f_t + fpe
                      &nbsp;·&nbsp; RF = (f_t + fpe − fDC − fDW) / (γ_LL · fLL) &nbsp;·&nbsp; f_t = concrete tension limit (LRFD Table 5.9.2.3.2b-1), not the modulus of rupture
                      &nbsp;·&nbsp; f_LL = M_LL × {ps3Scale.toFixed(4)} (g·(1+IM)·m·F₁·F₂{ps3CarriesIM?'; IM already in the MCT':''}) &nbsp;·&nbsp;
                      <strong>Requires PS Concrete zones with Sb, St, fpe defined above</strong>
    ```

### SW7. Legal / posting trucks: IM 33 % written into new models (IDX-O7)   [MCT change for newly selected trucks] [no rating change: the Rating tab already applied IM for these trucks]
- **Where:** `VEHICLE_GROUPS` "AASHTO Legal / Posting" (anchor `{ group:"AASHTO Legal / Posting"`), `StepMovingLoads` `applySelectDLA` / `toggleV` / `toggleGroup` / the "All" button.
- **Problem:** Legal Type 3, 3-3, 3S2 and posting SU5–SU7 had defaultDLA 0 (SU4 33). MBE 6A.4.4.3 applies IM = 33 % to legal loads. The Rating tab already added (1+IM) for these trucks through its IM factor (mctCarriesImpact = false at DLA 0), so ratings were right by default, but the MCT models (and any other use of their results) carried no IM, and switching the rating IM factor off silently dropped it.
- **Fix:** defaultDLA is kept at 0 — changing it would make every saved project think its existing MIDAS results (run at scale 1.0) already carry IM, so the Rating tab would drop IM: 1/1.33 unconservative. Instead a new library field `selectDLA: 33` is written into `cfg.vehicleDLA` when one of these trucks is selected in Step 5 (only if no per-vehicle DLA is set). New models get the 1.33 scale in the MCT, the Rating tab then does not apply IM again; saved projects are untouched.
- **Governing provision:** MBE 3rd Ed. 6A.4.4.3 (C6A.4.4.3 for reduced IM: edit the per-vehicle DLA).
- **Check case:** select "Legal Type 3" in Step 5 on a new model → DLA column 33 → MCT line `VL, AASHTO Legal Type 3, 1.33, 0, 1, <lane>` (was `1`). Rating of the new results: RF = C − … / (γLL·1.33·M) both before (IM applied in the rating) and after (IM in the model) — identical. A saved project with the truck already selected: MCT and rating identical to before (verified, scenario "manual" and the MCT comparison `beam_legal`).
- **How verified:** MCT generated main vs branch for the saved-config case (identical); selection code read; rating tab scenarios unchanged for legal trucks.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 1357* (const VEHICLE_GROUPS = [)

    Before:
    ```js
      ]},
      { group:"AASHTO Legal / Posting", color:"#6d28d9", vehicles:[
        { name:"AASHTO Legal Type 3",     label:"Legal Type 3",   code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
          gvwKips:50, description:'MBE Appendix D — 3-axle SU truck · 16k front + 17k + 17k tandem (4\' spacing) · 50k GVW = 25T',
    ```
    After:
    ```js
      ]},
      // MBE 6A.4.4.3 applies IM = 33 % to legal loads (sweep IDX-O7). defaultDLA stays 0 so a saved
      // project keeps the MCT its MIDAS results came from (the Rating tab adds IM for these trucks
      // through its IM factor). selectDLA = 33 is written into cfg.vehicleDLA when the truck is
      // SELECTED in Step 5, so new models carry the IM in the *MVLDCASE scale (C6A.4.4.3 reductions:
      // edit the per-vehicle DLA). SU4 already had defaultDLA 33.
      { group:"AASHTO Legal / Posting", color:"#6d28d9", vehicles:[
        { name:"AASHTO Legal Type 3",     label:"Legal Type 3",   code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0, selectDLA:33,
          gvwKips:50, description:'MBE Appendix D — 3-axle SU truck · 16k front + 17k + 17k tandem (4\' spacing) · 50k GVW = 25T',
    ```
  - *Hunk at ≈ line 1368* (const VEHICLE_GROUPS = [)

    Before:
    ```js
        },
        { name:"AASHTO Legal Type 3-3",   label:"Legal Type 3-3", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
          gvwKips:80, description:'MBE Appendix D6A — 6-axle combination truck · 12k, 12k, 12k, 16k, 14k, 14k @ 15\', 4\', 15\', 16\', 4\' · 80k GVW = 40T',
    ```
    After:
    ```js
        },
        { name:"AASHTO Legal Type 3-3",   label:"Legal Type 3-3", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0, selectDLA:33,
          gvwKips:80, description:'MBE Appendix D6A — 6-axle combination truck · 12k, 12k, 12k, 16k, 14k, 14k @ 15\', 4\', 15\', 16\', 4\' · 80k GVW = 40T',
    ```
  - *Hunk at ≈ line 1374* (const VEHICLE_GROUPS = [)

    Before:
    ```js
        },
        { name:"AASHTO Legal Type 3S2",   label:"Legal Type 3S2", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
          gvwKips:72, description:'MBE Appendix D6A — 5-axle tractor-semitrailer · 10k, 15.5k, 15.5k, 15.5k, 15.5k @ 11\', 4\', 22\', 4\' · 72k GVW = 36T',
    ```
    After:
    ```js
        },
        { name:"AASHTO Legal Type 3S2",   label:"Legal Type 3S2", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0, selectDLA:33,
          gvwKips:72, description:'MBE Appendix D6A — 5-axle tractor-semitrailer · 10k, 15.5k, 15.5k, 15.5k, 15.5k @ 11\', 4\', 22\', 4\' · 72k GVW = 36T',
    ```
  - *Hunk at ≈ line 1385* (const VEHICLE_GROUPS = [)

    Before:
    ```js
        },
        { name:"AASHTO Posting load SU5", label:"Posting SU5", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
          gvwKips:62, description:'MBE Appendix D6A posting vehicle — 5-axle SU truck · 12k, 8k, 8k, 17k, 17k @ 10\', 4\', 4\', 4\' · 62k GVW = 31T',
    ```
    After:
    ```js
        },
        { name:"AASHTO Posting load SU5", label:"Posting SU5", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0, selectDLA:33,
          gvwKips:62, description:'MBE Appendix D6A posting vehicle — 5-axle SU truck · 12k, 8k, 8k, 17k, 17k @ 10\', 4\', 4\', 4\' · 62k GVW = 31T',
    ```
  - *Hunk at ≈ line 1390* (const VEHICLE_GROUPS = [)

    Before:
    ```js
        },
        { name:"AASHTO Posting load SU6", label:"Posting SU6", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
          gvwKips:69.5, description:'MBE Appendix D6A posting vehicle — 6-axle SU truck · 11.5k, 8k, 8k, 17k, 17k, 8k @ 10\', 4\', 4\', 4\', 4\' · 69.5k GVW = 34.75T',
    ```
    After:
    ```js
        },
        { name:"AASHTO Posting load SU6", label:"Posting SU6", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0, selectDLA:33,
          gvwKips:69.5, description:'MBE Appendix D6A posting vehicle — 6-axle SU truck · 11.5k, 8k, 8k, 17k, 17k, 8k @ 10\', 4\', 4\', 4\', 4\' · 69.5k GVW = 34.75T',
    ```
  - *Hunk at ≈ line 1395* (const VEHICLE_GROUPS = [)

    Before:
    ```js
        },
        { name:"AASHTO Posting load SU7", label:"Posting SU7", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0,
          gvwKips:77.5, description:'MBE Appendix D6A posting vehicle — 7-axle SU truck · 11.5k, 8k, 8k, 17k, 17k, 8k, 8k @ 10\', 4\', 4\', 4\', 4\', 4\' · 77.5k GVW = 38.75T',
    ```
    After:
    ```js
        },
        { name:"AASHTO Posting load SU7", label:"Posting SU7", code:"AASHTO LEGAL/PERMIT LOAD", defaultDLA:0, selectDLA:33,
          gvwKips:77.5, description:'MBE Appendix D6A posting vehicle — 7-axle SU truck · 11.5k, 8k, 8k, 17k, 17k, 8k, 8k @ 10\', 4\', 4\', 4\', 4\', 4\' · 77.5k GVW = 38.75T',
    ```
  - *Hunk at ≈ line 7065* (function StepMovingLoads({cfg,set}) {)

    Before:
    ```js
      const isGFS = (cfg.geomMode||'beam')==='gfs';
      const toggleV=name=>{
    ```
    After:
    ```js
      const isGFS = (cfg.geomMode||'beam')==='gfs';
      // Newly selected vehicles with a selectDLA (legal / posting trucks, MBE 6A.4.4.3) get that
      // DLA written explicitly, unless a per-vehicle value is already set (sweep IDX-O7).
      const applySelectDLA=added=>{
        const patch={};
        added.forEach(n=>{ const v=ALL_VEHICLES.find(x=>x.name===n);
          if(v&&v.selectDLA!=null&&(cfg.vehicleDLA||{})[n]===undefined) patch[n]=v.selectDLA; });
        if(Object.keys(patch).length) set('vehicleDLA',{...(cfg.vehicleDLA||{}),...patch});
      };
      const toggleV=name=>{
    ```
  - *Hunk at ≈ line 7076* (function StepMovingLoads({cfg,set}) {)

    Before:
    ```js
        set('selectedVehicles',cur.includes(name)?cur.filter(v=>v!==name):[...cur,name]);
      };
    ```
    After:
    ```js
        set('selectedVehicles',cur.includes(name)?cur.filter(v=>v!==name):[...cur,name]);
        if(!cur.includes(name)) applySelectDLA([name]);
      };
    ```
  - *Hunk at ≈ line 7083* (function StepMovingLoads({cfg,set}) {)

    Before:
    ```js
        set('selectedVehicles',allSel?cfg.selectedVehicles.filter(n=>!names.includes(n)):[...new Set([...cfg.selectedVehicles,...names])]);
      };
    ```
    After:
    ```js
        set('selectedVehicles',allSel?cfg.selectedVehicles.filter(n=>!names.includes(n)):[...new Set([...cfg.selectedVehicles,...names])]);
        if(!allSel) applySelectDLA(names.filter(n=>!cfg.selectedVehicles.includes(n)));
      };
    ```
  - *Hunk at ≈ line 7151* (function StepMovingLoads({cfg,set}) {)

    Before:
    ```js
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>set('selectedVehicles',ALL_VEHICLES.map(v=>v.name))}
                  style={{background:'#fff',border:'1px solid #d1d5db',borderRadius:'5px',color:'#374151',padding:'4px 10px',cursor:'pointer',fontSize:'11px'}}>All</button>
    ```
    After:
    ```js
              <div style={{display:'flex',gap:'6px'}}>
                <button onClick={()=>{ set('selectedVehicles',ALL_VEHICLES.map(v=>v.name));
                    applySelectDLA(ALL_VEHICLES.map(v=>v.name).filter(n=>!cfg.selectedVehicles.includes(n))); }}
                  style={{background:'#fff',border:'1px solid #d1d5db',borderRadius:'5px',color:'#374151',padding:'4px 10px',cursor:'pointer',fontSize:'11px'}}>All</button>
    ```

### SW8. Permit γLL: MBE Table 6A.4.5.4.2a-1 instead of a flat 1.10 (IDX-O9)   [calc change] [MORE conservative per vehicle; main-tab Permit category see below]
- **Where:** new `PERMIT_GAMLL_ROUTINE`, `permitWeightRatio`, `permitLLfactor` (anchor `// Permit live-load factor — MBE (3rd Ed.) Table 6A.4.5.4.2a-1`); `vehicleGamLL(…, vehicleName)`; the vehicle-map auto-populate effect (anchor `const keep = existing.customGam;`); `autoFactors` / `opFactors` (anchor `if (ratingCategory==='Permit'&&ratingLimitState==='Strength I')`); `LRFR_FACTORS.LRFR['Strength I'].Permit`; ADTT input shown for Permit too.
- **Problem:** per-vehicle Permit γLL was 1.10 for every permit, ADTT and weight. In the main Inputs tab the Permit category silently used the design Inventory/Operating factor (1.75/1.35).
- **Fix:** routine/annual permit row of MBE Table 6A.4.5.4.2a-1 (mixed with traffic, two or more lanes), by permit weight ratio GVW/AL (kip/ft) ≤ 2.0 | 2.0–3.0 | ≥ 3.0 and ADTT ≥ 5000 | 1000 | ≤ 100: 1.40/1.35/1.30, 1.35/1.25/1.20, 1.30/1.20/1.15; linear in ADTT; no interpolation across the weight-ratio columns (the lower-ratio column, which has the higher factor, is used — conservative); unknown ADTT → the ≥ 5000 row; GVW/AL from the vehicle's axles (no axles → the ≤ 2.0 column). The main-tab Permit category (Strength I only) now uses the same lookup with the "Vehicle for Rating Tonnage". Per-vehicle factors the engineer typed (customGam) are kept; auto factors stored by an older build are refreshed to the table (that is how the stored 1.10 goes away). Special / limited-crossing permits are not tabulated — override γLL for those vehicles (N3).
- **Governing provision:** MBE 3rd Ed. Table 6A.4.5.4.2a-1 (values to verify against the printed edition — N3).
- **Before / after values:** per-vehicle Permit: 1.10 → 1.15–1.40. Main tab Permit at Inventory: 1.75 → table (LESS conservative); at Operating: 1.35 → table (more conservative where the table exceeds 1.35).
- **Check case:** Legal Type 3S2 rated as a Permit vehicle, ADTT 5000: GVW 72 k, AL 41 ft → 1.756 ≤ 2.0 → γLL 1.40 (before 1.10). RF (multi-vehicle tab, synthetic model) 2.508 → 1.971 = 2.508·1.10/1.40. ADTT 3000, GVW/AL 2.7: 1.25 + (1.35 − 1.25)·2000/4000 = 1.30.
- **How verified:** `vehicleGamLL` evaluated main vs branch for 3 categories × 7 ADTT × 5 vehicles (only Permit rows change); multi-vehicle tab main vs branch.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 9994* (const LRFR_FACTORS = {)

    Before:
    ```js
          Legal:    { DC:1.25,DW:1.50,LL:null }, // LL from ADTT
          Permit:   { DC:1.25,DW:1.50,LL:1.10 },
        },
    ```
    After:
    ```js
          Legal:    { DC:1.25,DW:1.50,LL:null }, // LL from ADTT
          Permit:   { DC:1.25,DW:1.50,LL:null }, // LL from permitLLfactor (Table 6A.4.5.4.2a-1)
        },
    ```
  - *Hunk at ≈ line 11263* (function legalLLfactor(adtt) {)

    Before:
    ```js
    
    // Determine MBE rating category for a vehicle based on its group
    ```
    After:
    ```js
    
    // Permit live-load factor — MBE (3rd Ed.) Table 6A.4.5.4.2a-1, ROUTINE / ANNUAL permits
    // (unlimited crossings, mixed with traffic, two or more lanes loaded). Columns are the
    // permit weight ratio GVW/AL (kip/ft): <= 2.0 | 2.0–3.0 | >= 3.0; rows ADTT (one direction)
    // >= 5000 | 1000 | <= 100, linear between ADTT rows. Not interpolated across the weight-ratio
    // columns (the factor falls as GVW/AL rises, so taking the lower column is conservative).
    // VERIFY against the printed MBE edition in use. Special / limited-crossing permits
    // (escorted single trip, single trip or < 100 crossings mixed with traffic) are not
    // tabulated here: override γLL for those vehicles. Replaces the flat 1.10 (sweep IDX-O9).
    const PERMIT_GAMLL_ROUTINE = [[5000,[1.40,1.35,1.30]],[1000,[1.35,1.25,1.20]],[100,[1.30,1.20,1.15]]];
    function permitWeightRatio(vehicleNameOrLabel) {
      const v = ALL_VEHICLES.find(x=>x.name===vehicleNameOrLabel||x.label===vehicleNameOrLabel);
      const ax = (v&&v.axles)||[];
      if (ax.length<2) return null;
      const gvw = ax.reduce((s,a)=>s+(+a.load||0),0);
      const AL = Math.max(...ax.map(a=>+a.dist||0)) - Math.min(...ax.map(a=>+a.dist||0));
      return AL>0 ? gvw/AL : null;
    }
    function permitLLfactor(adtt, wr) {
      const col = (wr==null || !(wr>2.0)) ? 0 : (wr<3.0 ? 1 : 2);
      const T = PERMIT_GAMLL_ROUTINE.map(([a,f])=>[a,f[col]]);
      const A = (adtt==null || !(adtt>=0)) ? 5000 : +adtt;       // unknown ADTT -> highest row
      if (A >= T[0][0]) return T[0][1];
      if (A <= T[2][0]) return T[2][1];
      const [hi,lo] = A >= T[1][0] ? [T[0],T[1]] : [T[1],T[2]];
      return +(lo[1] + (hi[1]-lo[1])*(A-lo[0])/(hi[0]-lo[0])).toFixed(4);
    }
    
    // Determine MBE rating category for a vehicle based on its group
    ```
  - *Hunk at ≈ line 11301* (function defaultVehicleCategory(vehicleName) {)

    Before:
    ```js
    // Return { inv, op } γ_LL for a vehicle per MBE Table 6A.4.2.2-1
    function vehicleGamLL(category, limitState, method, adtt) {
      if (method === 'LFR') {
    ```
    After:
    ```js
    // Return { inv, op } γ_LL for a vehicle per MBE Table 6A.4.2.2-1
    function vehicleGamLL(category, limitState, method, adtt, vehicleName) {
      if (method === 'LFR') {
    ```
  - *Hunk at ≈ line 11311* (function vehicleGamLL(category, limitState, method, adtt) {)

    Before:
    ```js
      if (category === 'Permit') {
        return { inv: ls.Permit?.LL ?? 1.10, op: ls.Permit?.LL ?? 1.10 };
      }
    ```
    After:
    ```js
      if (category === 'Permit') {
        const g = permitLLfactor(adtt, permitWeightRatio(vehicleName));
        return { inv: g, op: g };
      }
    ```
  - *Hunk at ≈ line 11982* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
            const { inv: gamLLinv, op: gamLLop } = vehicleGamLL(
              category, ratingLimitState, ratingMethod, ratingAdtt
            );
            next[vn] = {
    ```
    After:
    ```js
            const { inv: gamLLinv, op: gamLLop } = vehicleGamLL(
              category, ratingLimitState, ratingMethod, ratingAdtt, vn
            );
            // A value the engineer typed (customGam) is kept; an auto value follows the table,
            // so a stored factor from an older build (e.g. the flat permit 1.10) is refreshed.
            const keep = existing.customGam;
            next[vn] = {
    ```
  - *Hunk at ≈ line 11990* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
              category,
              gamLLinv:  existing.gamLLinv  !== undefined ? existing.gamLLinv  : +gamLLinv.toFixed(4),
              gamLLop:   existing.gamLLop   !== undefined ? existing.gamLLop   : +gamLLop.toFixed(4),
              customGam: existing.customGam || false,
    ```
    After:
    ```js
              category,
              gamLLinv:  keep && existing.gamLLinv !== undefined ? existing.gamLLinv : +gamLLinv.toFixed(4),
              gamLLop:   keep && existing.gamLLop  !== undefined ? existing.gamLLop  : +gamLLop.toFixed(4),
              customGam: existing.customGam || false,
    ```
  - *Hunk at ≈ line 12019* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
        if (ratingCategory==='Legal') return {...(ls.Legal||{DC:1.25,DW:1.50}), LL:legalLLfactor(ratingAdtt)};
        return ls[ratingLevel]||ls.Any||{DC:1.25,DW:1.50,LL:1.75};
      },[ratingMethod,ratingLevel,ratingLimitState,ratingCategory,ratingAdtt]);
    
    ```
    After:
    ```js
        if (ratingCategory==='Legal') return {...(ls.Legal||{DC:1.25,DW:1.50}), LL:legalLLfactor(ratingAdtt)};
        // Permit: MBE Table 6A.4.5.4.2a-1 (routine), not the design Inventory/Operating factor.
        if (ratingCategory==='Permit'&&ratingLimitState==='Strength I') return {DC:1.25, DW:1.50, LL:permitLLfactor(ratingAdtt, permitWeightRatio(ratingVehicleName))};
        return ls[ratingLevel]||ls.Any||{DC:1.25,DW:1.50,LL:1.75};
      },[ratingMethod,ratingLevel,ratingLimitState,ratingCategory,ratingAdtt,ratingVehicleName]);
    
    ```
  - *Hunk at ≈ line 12216* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
        if (ratingCategory==='Legal') return {...(ls.Legal||{DC:1.25,DW:1.50}), LL:legalLLfactor(ratingAdtt)};
        return ls['Operating']||ls.Any||{DC:1.25,DW:1.50,LL:1.35};
      },[ratingMethod,ratingLimitState,ratingCategory,ratingAdtt]);
    
    ```
    After:
    ```js
        if (ratingCategory==='Legal') return {...(ls.Legal||{DC:1.25,DW:1.50}), LL:legalLLfactor(ratingAdtt)};
        if (ratingCategory==='Permit'&&ratingLimitState==='Strength I') return {DC:1.25, DW:1.50, LL:permitLLfactor(ratingAdtt, permitWeightRatio(ratingVehicleName))};
        return ls['Operating']||ls.Any||{DC:1.25,DW:1.50,LL:1.35};
      },[ratingMethod,ratingLimitState,ratingCategory,ratingAdtt,ratingVehicleName]);
    
    ```
  - *Hunk at ≈ line 13862* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                    ))}
                    {ratingCategory==='Legal'&&(
                      <div style={{display:'flex',alignItems:'center',gap:'5px',marginLeft:'6px'}}>
    ```
    After:
    ```js
                    ))}
                    {(ratingCategory==='Legal'||ratingCategory==='Permit')&&(
                      <div style={{display:'flex',alignItems:'center',gap:'5px',marginLeft:'6px'}}>
    ```
  - *Hunk at ≈ line 13887* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                  {label:'γ_DW (wearing surf.)',val:gamDW,set:setRatingGamDW,hint:'Future overlay / utilities'},
                  {label:'γ_LL (live load)',val:gamLL,set:setRatingGamLL,hint:ratingCategory==='Legal'?`Legal @ ADTT ${ratingAdtt}`:`${ratingMethod} ${ratingLevel}`},
                  {label:'η Load Modifier',val:ratingEta,set:setRatingEta,hint:'MBE 6A.4.1 — typically 1.0'},
                ].map(({label,val,set:setter,hint})=>(
    ```
    After:
    ```js
                  {label:'γ_DW (wearing surf.)',val:gamDW,set:setRatingGamDW,hint:'Future overlay / utilities'},
                  {label:'γ_LL (live load)',val:gamLL,set:setRatingGamLL,hint:ratingCategory==='Legal'?`Legal @ ADTT ${ratingAdtt}`:ratingCategory==='Permit'&&ratingMethod==='LRFR'?`Routine permit @ ADTT ${ratingAdtt} (Table 6A.4.5.4.2a-1)`:`${ratingMethod} ${ratingLevel}`},
                  {label:'η Load Modifier',val:ratingEta,set:setRatingEta,hint:'Not used — MBE 6A LRFR has no η (RF is not multiplied by it)'},
                ].map(({label,val,set:setter,hint})=>(
    ```
  - *Hunk at ≈ line 15922* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        // Recompute default gamLL when category changes
                        const defaultGam = vehicleGamLL(cat, ratingLimitState, ratingMethod, ratingAdtt);
                        return (
    ```
    After:
    ```js
                        // Recompute default gamLL when category changes
                        const defaultGam = vehicleGamLL(cat, ratingLimitState, ratingMethod, ratingAdtt, vn);
                        return (
    ```
  - *Hunk at ≈ line 15961* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                                const newCat = e.target.value;
                                const newGam = vehicleGamLL(newCat, ratingLimitState, ratingMethod, ratingAdtt);
                                setVehicleLCMap(prev=>({...prev,[vn]:{
    ```
    After:
    ```js
                                const newCat = e.target.value;
                                const newGam = vehicleGamLL(newCat, ratingLimitState, ratingMethod, ratingAdtt, vn);
                                setVehicleLCMap(prev=>({...prev,[vn]:{
    ```
  - *Hunk at ≈ line 16000* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                                <button onClick={()=>{
                                  const g=vehicleGamLL(cat,ratingLimitState,ratingMethod,ratingAdtt);
                                  setVehicleLCMap(prev=>({...prev,[vn]:{...(prev[vn]||{}),
    ```
    After:
    ```js
                                <button onClick={()=>{
                                  const g=vehicleGamLL(cat,ratingLimitState,ratingMethod,ratingAdtt,vn);
                                  setVehicleLCMap(prev=>({...prev,[vn]:{...(prev[vn]||{}),
    ```

### SW9. PS flexure: AASHTO 5.6.3.1.1 fps with the T-section case (IDX-O10)   [calc change] [MORE conservative when a > hf; small change otherwise]
- **Where:** `psAlpha1`, `computePSfps`, `computePSMn` (anchor `// Compute fps (stress in PS steel at nominal resistance) — AASHTO LRFD 10th Ed. 5.6.3.1.1`); PS Conc inputs (new hf, ds'); PS Strength I capacity card (rectangular/T label, hf warning).
- **Problem:** fps used the ACI approximate equation with k = γp/β1 and ignored bw, though labelled AASHTO 5.6.3.1.1; when the stress block leaves the flange (a > hf) the rectangular assumption overstates Mn. Mild steel counted without its depth (ds = 0 gave a negative lever arm; As' counted with ds' = 0, an input that did not exist).
- **Fix:** fps = fpu(1 − k·c/dp), k = 2(1.04 − fpy/fpu); rectangular c = (Aps·fpu + As·fy − A's·fy)/(α1·f'c·β1·b + k·Aps·fpu/dp); if a = β1·c > hf: c = (Aps·fpu + As·fy − A's·fy − α1·f'c·(b − bw)·hf)/(α1·f'c·β1·bw + k·Aps·fpu/dp) and Mn adds α1·f'c·(b − bw)·hf·(a/2 − hf/2). α1 per 5.6.2.2 (0.85 up to 10 ksi). Mild steel counts only with its depth (new input ds'). hf blank → rectangular, with a red warning on the PS card. Ported from psbeam.html `flexure()` (verified), which uses the same a > hf test.
- **Governing provision:** AASHTO LRFD 10th Ed. 5.6.3.1.1 (Eqs. 5.6.3.1.1-1 to -4), 5.6.3.2.2, 5.6.2.2.
- **Check case (T):** f'c 6 (β1 0.75, α1 0.85), b 48, hf 6, bw 8, Aps 6.12, fpu 270, fpy 243 (k 0.28), dp 50. Rectangular c = 1652.4/(0.85·6·0.75·48 + 0.28·6.12·270/50) = 8.57 in, a = 6.43 > 6 → T: c = (1652.4 − 0.85·6·40·6)/(0.85·6·0.75·8 + 9.25) = 10.75 in, a = 8.06 in; fps = 270·(1 − 0.28·10.75/50) = 253.7 ksi; Mn = 6.12·253.7·(50 − 4.03) + 0.85·6·40·6·(4.03 − 3.0) = 72,648 k·in = 6054.1 k·ft.
  - Before: ρp = 6.12/(48·50) = 0.00255; fps = 270·(1 − (0.28/0.75)·0.00255·270/6) = 258.4 ksi; a = 6.12·258.4/(0.85·6·48) = 6.46 in; Mn = 6.12·258.4·(50 − 3.23)/12 = 6164.3 k·ft. After: 6054.1 k·ft (−1.8 %).
  - Rectangular check (b 96, hf 8): before 6515.0 → after 6494.7 k·ft (−0.3 %, the k·c/dp form). Extreme T (b 24, hf 4, Aps 4.896, dp 40): 3531.6 → 2900.9 k·ft.
- **How verified:** functions evaluated main vs branch on four sections; scenario "ps" rating tab.
- **Open items:** the β1 input on the PS card is shown but never used by the calculation (β1 is always from f'c) — N9. The "Ductility check" line reads `z.d`, which the PS card has no input for, so it never shows — N9.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 10460* (function psBeta1(fc) {)

    Before:
    ```js
    
    // Compute fps (stress in PS steel at nominal resistance) — AASHTO 5.6.3.1.1
    function computePSfps(z) {
      const { Aps=0, fpu=270, fpy=243, dp=0, fc=5, b=48, bw=7,
              As=0, Asp=0, fy=60, ds=0, dsp=0 } = z;
      if (!Aps || !dp || !fc || !b) return { fps:0, a:0, c:0 };
      const beta1 = psBeta1(fc);
      const gamP  = psGammaP(fpu, fpy);
      const rhop  = Aps / (b * dp);
      const omg   = As  > 0 && ds  > 0 ? (As /(b*ds)) *(fy /fc) : 0;
      const omgp  = Asp > 0 && dsp > 0 ? (Asp/(b*dsp))*(fy /fc) : 0;
      const k     = gamP / beta1;
      const fps   = fpu * (1 - k * (rhop*(fpu/fc) + (ds/dp||0)*(omg - omgp)));
      // Depth of stress block
      const a = (Aps*fps + As*fy - Asp*fy) / (0.85 * fc * b);
      const c = a / beta1;
      return { fps: Math.max(0, Math.min(fps, fpu)), a: Math.max(0,a), c: Math.max(0,c) };
    }
    
    // Compute Mn (ft-kips) from PS zone — AASHTO 5.6.3.2
    function computePSMn(z) {
      const { Aps=0, dp=0, As=0, fy=60, ds=0, Asp=0, dsp=0 } = z;
      const { fps, a } = computePSfps(z);
      const Mn = (Aps*fps*(dp - a/2) + As*fy*(ds - a/2) - Asp*fy*(dsp - a/2)) / 12;
      return Math.max(0, Mn); // ft-kips
    }
    ```
    After:
    ```js
    
    // α1 — AASHTO LRFD 10th Ed. 5.6.2.2: 0.85 up to f'c = 10 ksi, −0.02 per ksi above, ≥ 0.75
    function psAlpha1(fc) { return fc <= 10 ? 0.85 : Math.max(0.75, 0.85 - 0.02*(fc - 10)); }
    
    // Compute fps (stress in PS steel at nominal resistance) — AASHTO LRFD 10th Ed. 5.6.3.1.1
    //   fps = fpu·(1 − k·c/dp), k = 2·(1.04 − fpy/fpu)                  (Eq. 5.6.3.1.1-1, -2)
    //   rectangular: c = (Aps·fpu + As·fs − A's·f's) / (α1·f'c·β1·b + k·Aps·fpu/dp)      (-4)
    //   T-section when a = β1·c > hf (5.6.3.2.2):
    //                c = (Aps·fpu + As·fs − A's·f's − α1·f'c·(b − bw)·hf) / (α1·f'c·β1·bw + k·Aps·fpu/dp)  (-3)
    // fs = fy and f's = fy are assumed; mild steel counts only with its depth (ds, ds') entered.
    // hf = compression flange (deck) thickness; blank = rectangular behaviour assumed (warned).
    // Replaces the ACI-style approximate fps with mixed γp/k that ignored bw (sweep IDX-O10).
    function computePSfps(z) {
      const { Aps=0, fpu=270, fpy=243, dp=0, fc=5, b=48, bw=7, hf=0,
              As=0, Asp=0, fy=60, ds=0, dsp=0 } = z;
      if (!Aps || !dp || !fc || !b) return { fps:0, a:0, c:0, rect:true };
      const beta1 = psBeta1(fc), a1 = psAlpha1(fc);
      const k   = 2*(1.04 - (fpy||0.9*fpu)/fpu);
      const AsF = As>0 && ds>0 ? As*fy : 0;
      const AspF = Asp>0 && dsp>0 ? Asp*fy : 0;
      let c = (Aps*fpu + AsF - AspF) / (a1*fc*beta1*b + k*Aps*fpu/dp);
      let rect = true;
      if (hf>0 && bw>0 && bw<b && beta1*c > hf) {
        rect = false;
        c = (Aps*fpu + AsF - AspF - a1*fc*(b-bw)*hf) / (a1*fc*beta1*bw + k*Aps*fpu/dp);
      }
      c = Math.max(0, c);
      const fps = fpu*(1 - k*c/dp);
      const a = beta1*c;
      return { fps: Math.max(0, Math.min(fps, fpu)), a, c, rect, k };
    }
    
    // Compute Mn (ft-kips) from PS zone — AASHTO 5.6.3.2.2 (flanged) / 5.6.3.2.3 (rectangular)
    function computePSMn(z) {
      const { Aps=0, dp=0, As=0, fy=60, ds=0, Asp=0, dsp=0, fc=5, b=48, bw=7, hf=0 } = z;
      const { fps, a, rect } = computePSfps(z);
      let Mn = Aps*fps*(dp - a/2)
             + (As>0 && ds>0 ? As*fy*(ds - a/2) : 0)
             - (Asp>0 && dsp>0 ? Asp*fy*(dsp - a/2) : 0);
      if (rect === false) Mn += psAlpha1(fc)*fc*(b - bw)*hf*(a/2 - hf/2);
      return Math.max(0, Mn/12); // ft-kips
    }
    ```
  - *Hunk at ≈ line 14627* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        {/* Row 1: Concrete + section geometry */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px'}}>
                          {[["f'c (ksi)",'fc',5,0.5],["β₁",'beta1',0,'auto'],["b (in) flange",'b',48,1],
                            ["bw (in) web",'bw',7,0.5],["dv (in) eff. shear",'dv',0,0.5]
                          ].map(([lbl,field,def,step])=>(
    ```
    After:
    ```js
                        {/* Row 1: Concrete + section geometry */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'6px'}}>
                          {[["f'c (ksi)",'fc',5,0.5],["β₁",'beta1',0,'auto'],["b (in) flange",'b',48,1],
                            ["hf (in) flange thk",'hf',0,0.25],["bw (in) web",'bw',7,0.5],["dv (in) eff. shear",'dv',0,0.5]
                          ].map(([lbl,field,def,step])=>(
    ```
  - *Hunk at ≈ line 14665* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        {/* Row 3: Non-prestressed steel */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'6px'}}>
                          {[["As (in²) tension",'As',0,0.01],["fy (ksi)",'fy',60,1],
                            ["ds (in)",'ds',0,0.5],["As' (in²) comp.",'Asp',0,0.01]
                          ].map(([lbl,field,def,step])=>(
    ```
    After:
    ```js
                        {/* Row 3: Non-prestressed steel */}
                        <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'6px'}}>
                          {[["As (in²) tension",'As',0,0.01],["fy (ksi)",'fy',60,1],
                            ["ds (in)",'ds',0,0.5],["As' (in²) comp.",'Asp',0,0.01],["ds' (in)",'dsp',0,0.25]
                          ].map(([lbl,field,def,step])=>(
    ```
  - *Hunk at ≈ line 16591* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                          {capZones.filter(z=>z.type==='psconc').map((z,i)=>{
                            const {fps,a,c} = computePSfps(z);
                            const Mn  = computePSMn(z);
    ```
    After:
    ```js
                          {capZones.filter(z=>z.type==='psconc').map((z,i)=>{
                            const {fps,a,c,rect,k} = computePSfps(z);
                            const Mn  = computePSMn(z);
    ```
  - *Hunk at ≈ line 16619* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                                  border:'1px solid #bfdbfe',borderRadius:'4px',fontSize:'10px',fontFamily:'monospace',color:'#1d4ed8'}}>
                                  fps = {fps.toFixed(2)} ksi &nbsp;·&nbsp; a = {a.toFixed(3)} in &nbsp;·&nbsp; c = {c.toFixed(3)} in
                                </div>
                                <div style={{marginTop:'4px',padding:'5px 8px',background:'#f0fdf4',
    ```
    After:
    ```js
                                  border:'1px solid #bfdbfe',borderRadius:'4px',fontSize:'10px',fontFamily:'monospace',color:'#1d4ed8'}}>
                                  fps = fpu(1 − k·c/dp) = {fps.toFixed(2)} ksi (k = {(k||0).toFixed(2)}) &nbsp;·&nbsp; a = {a.toFixed(3)} in &nbsp;·&nbsp; c = {c.toFixed(3)} in
                                  &nbsp;·&nbsp; {rect?'rectangular':'T-section (a > hf)'} — AASHTO 5.6.3.1.1
                                </div>
                                {!(z.hf>0)&&(+z.Aps>0)&&<div style={{marginTop:'4px',fontSize:'9.5px',fontFamily:'monospace',color:'#b91c1c',fontWeight:600}}>
                                  ⚠ hf (compression flange thickness) not entered — rectangular behaviour assumed; enter hf for the T-section check (5.6.3.2.2)
                                </div>}
                                <div style={{marginTop:'4px',padding:'5px 8px',background:'#f0fdf4',
    ```

### SW10. GFS model: HL-93 design lane load added (IDX-O11)   [MCT change] [MORE conservative]
- **Where:** `generateGFS_MCT`, vehicle and moving-load-case blocks (anchor `// HL-93 design lane load (LRFD 3.6.1.2.4) as its own zero-axle vehicle`).
- **Problem:** the GFS (girder–floorbeam–stringer) MCT wrote HL-93 truck/tandem cases with no 0.64 k/ft lane load.
- **Fix:** as the beam generator: a zero-axle `HL-93LANE` user vehicle with W = 0.64 k/ft, added as a second VL line in each HL-93 case, case type COMBINED (truck and lane together, 3.6.1.3.1), at the same 0.5 wheel-line scale as the truck on every stringer lane. Only written when a selected vehicle has a lane load (AREMA / transit / legal GFS models unchanged). No IM in the GFS MCT (unchanged); the rating applies IM to the whole GFS LL result, including the lane (conservative; 3.6.2.1 exempts the lane).
- **Governing provision:** AASHTO LRFD 10th Ed. 3.6.1.2.4, 3.6.1.3.1.
- **Check case:** default GFS model with HL-93 truck + tandem: before `NAME=HL-93TRK_GFS, … INDEPENDENT` with one VL line; after `COMBINED` with `VL, HL-93TRK, 0.5, …` and `VL, HL-93LANE, 0.5, 0, 1, Stringer 1 Lane, Stringer 2 Lane`, plus `NAME=HL-93LANE, 2, NO, 0.64, 0, 0, 0, 0, NO`. Per stringer lane: 0.5·0.64 = 0.32 k/ft.
- **How verified:** MCT text main vs branch for the default GFS model, GFS + HL-93 + E80 (only these lines differ), beam models (identical).
- **Open items:** confirm how MIDAS places a COMBINED case whose two VL lines each list all stringer lanes (N4).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 4279* (function generateGFS_MCT(cfg) {)

    Before:
    ```js
      });
      p('');
    ```
    After:
    ```js
      });
      // HL-93 design lane load (LRFD 3.6.1.2.4) as its own zero-axle vehicle, exactly as the
      // beam generator writes it, so a GFS model with the HL-93 truck/tandem carries the
      // 0.64 k/ft too (it used to be missing, sweep IDX-O11). Only written when a selected
      // vehicle has a lane load, so AREMA / transit / legal models are unchanged.
      const gfsLaneLoad=Math.max(0,...selVehs.map(v=>+v.laneLoad||0));
      const gfsLaneVeh=gfsLaneLoad>0?'HL-93LANE':'';
      if(gfsLaneVeh) p(`   NAME=${gfsLaneVeh}, 2, NO, ${gfsLaneLoad}, 0, 0, 0, 0, NO`);
      p('');
    ```
  - *Hunk at ≈ line 4295* (function generateGFS_MCT(cfg) {)

    Before:
    ```js
        const caseName=`${v.name}_GFS`;
        p(`   NAME=${caseName}, 0, 1, 1, 1, 1, 1, 1, INDEPENDENT, , 0, NO, 0`);
        p(`        1, 1, 1, 1, 1, 0.5, 0.25`);
        p(`        VL, ${v.name}, 0.5, 0, 1, ${laneList}`);
      });
    ```
    After:
    ```js
        const caseName=`${v.name}_GFS`;
        const wLane=(+v.laneLoad||0)>0 && !!gfsLaneVeh;
        // COMBINED: truck and lane act together (LRFD 3.6.1.3.1). Both at the same 0.5 wheel-line
        // scale as the truck. No IM here: GFS writes none, the rating applies it (to the lane too,
        // which is conservative — LRFD 3.6.2.1 exempts the lane load).
        p(`   NAME=${caseName}, 0, 1, 1, 1, 1, 1, 1, ${wLane?'COMBINED':'INDEPENDENT'}, , 0, NO, 0`);
        p(`        1, 1, 1, 1, 1, 0.5, 0.25`);
        p(`        VL, ${v.name}, 0.5, 0, 1, ${laneList}`);
        if(wLane) p(`        VL, ${gfsLaneVeh}, 0.5, 0, 1, ${laneList}`);
      });
    ```

### SW11. Fatigue: fatigue truck in the library, IM 15 %, optional g_fat (IDX-O14)   [calc change] [LESS conservative when the MCT carries 33 %; MORE when it carries none]
- **Where:** `VEHICLE_GROUPS` (new `LRFD-FATIGUE`), `mctImpactPct` and `FATIGUE_IM` (after `mctCarriesImpact`), `fatigueDF` input, `fatigueScale` (anchor `// Fatigue LL scale: IM brought to 15 %`), `dM` in `fatigueData`, and the Fatigue tab.
- **Problem:** the fatigue rating used the raw MIDAS moment range: no fatigue truck to analyse, IM whatever the MCT carried (33 % for HL-93, none for a DLA-0 vehicle), no distribution factor.
- **Fix:** new vehicle "LRFD Fatigue Truck" (8 + 32 + 32 k at 14 ft and a fixed 30 ft, no lane load, DLA 15). ΔM = ΔM_MIDAS × (1.15)/(1 + IM carried by the MCT for that case) × g_fat. g_fat is a new optional input (one-lane g ÷ 1.2), blank = not applied (the girder-line result as before), with a button that takes `fatM` from the LL & DL Distribution app when published.
- **Governing provision:** AASHTO LRFD 10th Ed. 3.6.1.4.1, Table 3.6.2.1-1 (IM 15 % fatigue), 3.6.1.1.2 / 3.6.1.4.3b (one-lane DF without m); MBE 3rd Ed. 6A.6.4.
- **Before:** `ΔM = |Mmax − Mmin|`. **After:** `ΔM = |Mmax − Mmin| × 1.15/(1 + IM_MCT/100) × (g_fat or 1)`.
- **Check case:** fatigue case from the fatigue truck at DLA 15: scale 1.000, RF unchanged. From an HL-93 case at DLA 33: scale 1.15/1.33 = 0.8647, RF × 1.157 (LESS conservative). From a DLA-0 vehicle with g_fat 0.4: scale 1.15·0.4 = 0.46; synthetic model node 136: Fatigue II RF 0.454 → 0.987, Fatigue I 0.618 → 1.344 (= 0.454/0.46, 0.618/0.46).
- **How verified:** rating tab scenarios "manual" (unchanged) and "manualdf" main vs branch.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 1337* (const VEHICLE_GROUPS = [)

    Before:
    ```js
        },
      ]},
    ```
    After:
    ```js
        },
        // Fatigue truck (sweep IDX-O14): one design truck, constant 30 ft between the 32-kip axles,
        // no lane load, IM = 15 % (LRFD 10th Ed. 3.6.1.4.1, Table 3.6.2.1-1).
        { name:"LRFD-FATIGUE", label:"LRFD Fatigue Truck", code:"AASHTO-LRFD", defaultDLA:15,
          gvwKips:72, description:'AASHTO LRFD 3.6.1.4.1 — fatigue truck · 8k + 32k + 32k @ 14\', 30\' (fixed) · no lane load · IM 15 % (Table 3.6.2.1-1)',
          axles:[{load:8,dist:0},{load:32,dist:14},{load:32,dist:44}],
          trailingLoad:0, trailingNote:'',
        },
      ]},
    ```
  - *Hunk at ≈ line 11344* (function mctCarriesImpact(cfg, lcName){)

    Before:
    ```js
    }
    // LL multiplier: g × (1+IM/100) × m × F1 × F2, with IM dropped when it is already
    ```
    After:
    ```js
    }
    // The dynamic load allowance (%) the MCT carries for an LL case: the DLA of the traced
    // vehicle, 0 when the case is not carrying IM; for a case not traceable to one vehicle,
    // the smallest DLA of the selected vehicles (all of them must carry one, as above).
    function mctImpactPct(cfg, lcName){
      if(!mctCarriesImpact(cfg, lcName)) return 0;
      const sel = cfg?.selectedVehicles || [];
      const dlaOf = n => cfg.useGlobalDLA
        ? (+cfg.globalDLA||0)
        : (+(cfg.vehicleDLA?.[n] ?? ALL_VEHICLES.find(v=>v.name===n)?.defaultDLA ?? 0)||0);
      const nm = typeof lcName==='string' ? lcName.trim() : '';
      const hit = nm ? sel.filter(n=>nm===n || nm.includes(n+'_')).sort((a,b)=>b.length-a.length)[0] : null;
      return hit ? dlaOf(hit) : Math.min(...sel.map(dlaOf));
    }
    // Fatigue IM, LRFD 10th Ed. Table 3.6.2.1-1 (all other components, fatigue limit state).
    const FATIGUE_IM = 15;
    // LL multiplier: g × (1+IM/100) × m × F1 × F2, with IM dropped when it is already
    ```
  - *Hunk at ≈ line 11672* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      const fatigueZoneCategories = R.fatigueZoneCategories ?? {};
    
    ```
    After:
    ```js
      const fatigueZoneCategories = R.fatigueZoneCategories ?? {};
      // Fatigue distribution factor g_fat (one-lane g ÷ 1.2, LRFD 3.6.1.1.2 / 3.6.1.4.3b);
      // blank = not applied (the MIDAS girder-line result is used as is). Sweep IDX-O14.
      const fatigueDF         = R.fatigueDF          ?? null;
    
    ```
  - *Hunk at ≈ line 12335* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
      // (ΔF)_n = (A/N)^(1/3), N = 365·75·n·p·ADTT_SL
      const fatigueData = useMemo(()=>{
    ```
    After:
    ```js
      // (ΔF)_n = (A/N)^(1/3), N = 365·75·n·p·ADTT_SL
      // Fatigue LL scale: IM brought to 15 % — (1.15)/(1 + IM carried by the MCT) — times g_fat
      // when entered (sweep IDX-O14). The old code used the raw MIDAS moment range.
      const fatigueImPct = useMemo(()=>mctImpactPct(cfg, fatigueLCpos),
        [JSON.stringify(cfg.selectedVehicles),JSON.stringify(cfg.vehicleDLA),cfg.useGlobalDLA,cfg.globalDLA,cfg.geomMode,fatigueLCpos]);
      const fatigueScale = (1+FATIGUE_IM/100)/(1+fatigueImPct/100) * ((+fatigueDF>0) ? +fatigueDF : 1);
      const fatigueData = useMemo(()=>{
    ```
  - *Hunk at ≈ line 12368* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
          const Mmin = lln?.momentY ?? 0;
          const dM   = Math.abs(Mmax - Mmin); // moment range, ft-kips
          const Sx   = Mmax >= 0 ? SxPos : SxNeg; // use appropriate Sx
    ```
    After:
    ```js
          const Mmin = lln?.momentY ?? 0;
          const dM   = Math.abs(Mmax - Mmin) * fatigueScale; // moment range × IM/g scale, ft-kips
          const Sx   = Mmax >= 0 ? SxPos : SxNeg; // use appropriate Sx
    ```
  - *Hunk at ≈ line 12393* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
         fatigueAdtt, fatigueLanes, fatigueCyclesN, fatigueCategory,
         fatigueZoneCategories, fatigueLimitState]);
    
    ```
    After:
    ```js
         fatigueAdtt, fatigueLanes, fatigueCyclesN, fatigueCategory,
         fatigueZoneCategories, fatigueLimitState, fatigueScale]);
    
    ```
  - *Hunk at ≈ line 16393* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        </div>
                      </div>
    ```
    After:
    ```js
                        </div>
                        {/* Fatigue LL scale: IM 15 % and g_fat (sweep IDX-O14) */}
                        <div style={{display:'grid',gridTemplateColumns:'140px 1fr',gap:'8px',alignItems:'start'}}>
                          <div>
                            <div style={STYLES.monoSmall}>g_fat (one-lane g ÷ 1.2)</div>
                            <input type="number" step="0.001" min="0" value={fatigueDF??''} placeholder="not applied"
                              onChange={e=>setRating('fatigueDF', e.target.value===''?null:(parseFloat(e.target.value)||0))}
                              style={{...INP2,fontFamily:'monospace',fontWeight:'600',fontSize:'12px'}}/>
                            {(()=>{ const d=lldfFeed&&lldfFeed.d; const g=d&&d.governing; const c=g?['interior','exterior'].map(k=>g[k]).filter(o=>o&&o.fatM!=null):[];
                              const f=c.length?Math.max(...c.map(o=>+o.fatM||0)):0;
                              return f>0?<button onClick={()=>setRating('fatigueDF',+f.toFixed(4))}
                                style={{marginTop:'3px',fontSize:'9px',fontFamily:'monospace',background:'#eff6ff',border:'1px solid #bfdbfe',
                                  borderRadius:'4px',color:'#1d4ed8',cursor:'pointer',padding:'2px 6px'}}>use LL &amp; DL fatM = {f.toFixed(4)}</button>:null; })()}
                          </div>
                          <div style={{fontSize:'9.5px',fontFamily:'monospace',color:'#374151',padding:'6px 9px',background:'#fdf4ff',border:'1px solid #e9d5ff',borderRadius:'5px',lineHeight:1.5}}>
                            ΔM = ΔM_MIDAS × (1 + {FATIGUE_IM}/100)/(1 + {fatigueImPct}/100) {(+fatigueDF>0)?<>× g_fat {(+fatigueDF).toFixed(4)}</>:<>(g_fat not applied)</>} = ΔM_MIDAS × <b>{fatigueScale.toFixed(4)}</b>
                            <br/>IM for fatigue = 15 % (LRFD Table 3.6.2.1-1); the MCT carries {fatigueImPct} % for this case.
                            Use the <b>LRFD Fatigue Truck</b> (30 ft rear spacing, 3.6.1.4.1) results — the HL-93 truck overstates the range.
                          </div>
                        </div>
                      </div>
    ```

### SW12. `W_SHAPE_PROPS['W24X55']` Zx 131 → 134 in³ (IDX-O2)   [calc change] [LESS conservative]
- **Where:** `const W_SHAPE_PROPS` (≈ line 9580), anchor `'W24X55':[`.
- **Governing provision:** AISC Shapes Database v16.0: W24X55 Zx = 134 in³ (Sx 114 already matched).
- **Check case:** Steel Calc zone imported from W24X55, Fy 50, no plates/Lb: Mn = 50·131/12 = 545.8 → 50·134/12 = 558.3 k·ft (+2.3 %).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 9580* (const W_SHAPE_PROPS = {)

    Before:
    ```js
      'W21X73':[21.2,0.455,172,151],'W21X83':[21.4,0.515,196,171],'W21X93':[21.6,0.580,221,192],
      'W24X55':[23.6,0.395,131,114],'W24X62':[23.7,0.430,153,131],'W24X68':[23.7,0.415,177,154],
      'W24X76':[23.9,0.440,200,176],'W24X84':[24.1,0.470,224,196],'W24X94':[24.3,0.515,254,222],
    ```
    After:
    ```js
      'W21X73':[21.2,0.455,172,151],'W21X83':[21.4,0.515,196,171],'W21X93':[21.6,0.580,221,192],
      'W24X55':[23.6,0.395,134,114],'W24X62':[23.7,0.430,153,131],'W24X68':[23.7,0.415,177,154],
      'W24X76':[23.9,0.440,200,176],'W24X84':[24.1,0.470,224,196],'W24X94':[24.3,0.515,254,222],
    ```

### SW13. System factor φs: the missing MBE rows (IDX-O3, part)   [new choices only] [no result change for saved projects]
- **Where:** `const PHI_SYSTEM` (anchor `'Single load path structure':      0.85,`) and the φs selector.
- **Fix:** added the MBE Table 6A.4.2.4-1 rows that were missing: riveted members two-girder/truss/arch 0.90, multiple eyebar truss 0.90, three-girder (S ≤ 6 ft) 0.85, four-girder (S ≤ 4 ft) 0.95, floorbeams > 12 ft with noncontinuous stringers 0.85, redundant stringer subsystems 1.00. Existing keys (saved as `rating.sysKey`) are unchanged; "Bolted I-girder, two-girder" keeps 0.85 and is labelled "(not an MBE row; welded value)". Whether bolted two-girder should take the riveted 0.90 is N5.
- **Governing provision:** MBE 3rd Ed. Table 6A.4.2.4-1.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 10015* (const PHI_SYSTEM = {)

    Before:
    ```js
      'Single load path structure':      0.85,
      'Custom':                          null,
    ```
    After:
    ```js
      'Single load path structure':      0.85,
      // Rows of MBE Table 6A.4.2.4-1 that were missing (sweep IDX-O3). New keys only: the keys
      // above are saved in projects (rating.sysKey) and are not renamed. "Bolted ... two-girder"
      // is not an MBE row (the table lists riveted 0.90 and welded 0.85); it keeps 0.85.
      'Riveted members, two-girder / truss / arch': 0.90,
      'Multiple eyebar members, truss':             0.90,
      'Three-girder bridge, girder spacing ≤ 6 ft':  0.85,
      'Four-girder bridge, girder spacing ≤ 4 ft':   0.95,
      'Floorbeams spaced > 12 ft, noncontinuous stringers': 0.85,
      'Redundant stringer subsystem between floorbeams':    1.00,
      'Custom':                          null,
    ```
  - *Hunk at ≈ line 14220* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                      {Object.entries(PHI_SYSTEM).map(([k,v])=>(
                        <option key={k} value={k}>{k}{v!==null?' → φ_s = '+v:''}</option>
                      ))}
    ```
    After:
    ```js
                      {Object.entries(PHI_SYSTEM).map(([k,v])=>(
                        <option key={k} value={k}>{k}{k==='Bolted I-girder, two-girder'?' (not an MBE row; welded value)':''}{v!==null?' → φ_s = '+v:''}</option>
                      ))}
    ```

### SW14. S30X118 / S36X150 labelled as non-AISC (IDX-O1)   [display]
- **Where:** `ROLLED_SHAPES` comment; rolled-shape picker (anchor `filter(k => k.startsWith('S'))`). Kept (saved projects reference them), shown as "— not an AISC v16 shape (unverified dims)".
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 1669* (const ROLLED_SHAPES = {)

    Before:
    ```js
      'S24X79.9': {d:24.00, bf:7.00, tf:0.870, tw:0.500, Fy:36},
      'S30X118': {d:30.00, bf:8.00, tf:0.625, tw:0.625, Fy:36},
    ```
    After:
    ```js
      'S24X79.9': {d:24.00, bf:7.00, tf:0.870, tw:0.500, Fy:36},
      // S30X118 / S36X150: no S30 or S36 in AISC v16.0 (largest S is S24) — kept for saved projects,
      // labelled "not an AISC v16 shape" in the picker (sweep IDX-O1).
      'S30X118': {d:30.00, bf:8.00, tf:0.625, tw:0.625, Fy:36},
    ```
  - *Hunk at ≈ line 5157* (function AremaLibraryEditor({AS, setAS, totalLen, customRolledShapes =…)

    Before:
    ```js
                {Object.keys(ROLLED_SHAPES).filter(k => k.startsWith('S')).map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
    ```
    After:
    ```js
                {Object.keys(ROLLED_SHAPES).filter(k => k.startsWith('S')).map(name => (
                  <option key={name} value={name}>{name}{(name==='S30X118'||name==='S36X150')?' — not an AISC v16 shape (unverified dims)':''}</option>
                ))}
    ```

### SW15. η shown as "not used" (IDX-A4)   [display] [no result change]
- **Where:** γ input cards (anchor `{label:'η Load Modifier'`), RF formula line, report card, printed report.
- **Problem:** η was an input and printed in the RF formula and the report, but never applied. MBE 6A LRFR has no η. The input is now disabled with "Not used — MBE 6A LRFR has no η", and the formula/report say "η not used". The saved `rating.eta` field is kept.
- **Governing provision:** MBE 3rd Ed. 6A.4.2.1 (Eq. 6A.4.2.1-1 has no η).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 13887* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                  {label:'γ_DW (wearing surf.)',val:gamDW,set:setRatingGamDW,hint:'Future overlay / utilities'},
                  {label:'γ_LL (live load)',val:gamLL,set:setRatingGamLL,hint:ratingCategory==='Legal'?`Legal @ ADTT ${ratingAdtt}`:`${ratingMethod} ${ratingLevel}`},
                  {label:'η Load Modifier',val:ratingEta,set:setRatingEta,hint:'MBE 6A.4.1 — typically 1.0'},
                ].map(({label,val,set:setter,hint})=>(
    ```
    After:
    ```js
                  {label:'γ_DW (wearing surf.)',val:gamDW,set:setRatingGamDW,hint:'Future overlay / utilities'},
                  {label:'γ_LL (live load)',val:gamLL,set:setRatingGamLL,hint:ratingCategory==='Legal'?`Legal @ ADTT ${ratingAdtt}`:ratingCategory==='Permit'&&ratingMethod==='LRFR'?`Routine permit @ ADTT ${ratingAdtt} (Table 6A.4.5.4.2a-1)`:`${ratingMethod} ${ratingLevel}`},
                  {label:'η Load Modifier',val:ratingEta,set:setRatingEta,hint:'Not used — MBE 6A LRFR has no η (RF is not multiplied by it)'},
                ].map(({label,val,set:setter,hint})=>(
    ```
  - *Hunk at ≈ line 13894* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                      fontWeight:'700',color:'#111827',background:ratingCustomFact?'#fff':'#f3f4f6'}}
                      value={val} disabled={!ratingCustomFact&&label!=='η Load Modifier'}
                      onChange={e=>setter(parseFloat(e.target.value)||0)}/>
    ```
    After:
    ```js
                      fontWeight:'700',color:'#111827',background:ratingCustomFact?'#fff':'#f3f4f6'}}
                      value={val} disabled={!ratingCustomFact||label==='η Load Modifier'}
                      onChange={e=>setter(parseFloat(e.target.value)||0)}/>
    ```
  - *Hunk at ≈ line 14066* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
              <div style={{marginTop:'12px',padding:'8px 12px',background:'#f0f9ff',border:'1px solid #bfdbfe',borderRadius:'5px',fontSize:'11.5px',fontFamily:'monospace',color:'#1e40af'}}>
                RF = (φ_c·φ_s·φ·Rn − {gamDC}·DC − {gamDW}·DW) / ({gamLL} · LL · ×{ratingLLScale.toFixed(4)}) · η={ratingEta}
              </div>
    ```
    After:
    ```js
              <div style={{marginTop:'12px',padding:'8px 12px',background:'#f0f9ff',border:'1px solid #bfdbfe',borderRadius:'5px',fontSize:'11.5px',fontFamily:'monospace',color:'#1e40af'}}>
                RF = (φ_c·φ_s·φ·Rn − {gamDC}·DC − {gamDW}·DW) / ({gamLL} · LL · ×{ratingLLScale.toFixed(4)}) · η not used (MBE 6A)
              </div>
    ```
  - *Hunk at ≈ line 18885* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                            {[['γ_DC',gamDC],['γ_DW',gamDW],['γ_LL (Inv)',gamLL],['γ_LL (Op)',gamLL_op.toFixed(2)],['LL Scale',ratingLLScale.toFixed(4)],
                              ['φ_c',phiC],['φ_s',phiS],['φ_f',ratingPhiF],['φ_v',ratingPhiV],['η',ratingEta]
                            ].map(([l,v])=>(
    ```
    After:
    ```js
                            {[['γ_DC',gamDC],['γ_DW',gamDW],['γ_LL (Inv)',gamLL],['γ_LL (Op)',gamLL_op.toFixed(2)],['LL Scale',ratingLLScale.toFixed(4)],
                              ['φ_c',phiC],['φ_s',phiS],['φ_f',ratingPhiF],['φ_v',ratingPhiV],['η','not used']
                            ].map(([l,v])=>(
    ```
  - *Hunk at ≈ line 19886* (function generateReportHTML({ cfg, mctOutput, rows, nodePositions, rat…)

    Before:
    ```js
                <tr><td>LL Scale — shear</td><td class="mono">×${(ratingLLScaleV||ratingLLScale||1).toFixed(4)}</td></tr>`:''}
                <tr><td>η Load Modifier</td><td class="mono">${ratingEta||1.0}</td></tr>
                <tr><td>φ_c (condition)</td><td class="mono">${phiC}</td></tr>
    ```
    After:
    ```js
                <tr><td>LL Scale — shear</td><td class="mono">×${(ratingLLScaleV||ratingLLScale||1).toFixed(4)}</td></tr>`:''}
                <tr><td>η Load Modifier</td><td class="mono">not used (MBE 6A LRFR has no η)</td></tr>
                <tr><td>φ_c (condition)</td><td class="mono">${phiC}</td></tr>
    ```

### SW16. PS Service III "fr" relabelled as the tension limit f_t (IDX-A5)   [display] [no result change]
- **Where:** comment in `psServiceIIIData`, PS card limit line, Service III tab header, exposure buttons, KPI tile, table footer. 0.19√f'c / 0.0948√f'c are the LRFD Table 5.9.2.3.2b-1 tension limits, not the modulus of rupture (5.4.2.6). Internal field name `fr` kept.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 12419* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
    
        // Modulus of rupture — AASHTO 5.4.2.6
        // Moderate exposure: fr = 0.19·√f'c (ksi)
        // Severe exposure:   fr = 0.0948·√f'c (ksi)  [cracked section allowed]
        const frCoeff = ps3Exposure==='severe' ? 0.0948 : 0.19;
    ```
    After:
    ```js
    
        // Concrete TENSION LIMIT f_t (stored as `fr`), AASHTO LRFD Table 5.9.2.3.2b-1 — not the
        // modulus of rupture of 5.4.2.6 (sweep IDX-A5: label only, no value change).
        // Moderate exposure: f_t = 0.19·√f'c (ksi)
        // Severe exposure:   f_t = 0.0948·√f'c (ksi)
        const frCoeff = ps3Exposure==='severe' ? 0.0948 : 0.19;
    ```
  - *Hunk at ≈ line 14726* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                            <div style={{marginTop:'4px',fontSize:'8px',fontFamily:'monospace',color:'#9ca3af'}}>
                              fr = {(0.19*Math.sqrt(z.fc||5)).toFixed(3)} ksi &nbsp;·&nbsp; limit = fr+fpe = {((0.19*Math.sqrt(z.fc||5))+(z.fpe||0)).toFixed(3)} ksi
                            </div>
    ```
    After:
    ```js
                            <div style={{marginTop:'4px',fontSize:'8px',fontFamily:'monospace',color:'#9ca3af'}}>
                              f_t = 0.19√f'c = {(0.19*Math.sqrt(z.fc||5)).toFixed(3)} ksi (tension limit, not f_r) &nbsp;·&nbsp; limit = f_t+fpe = {((0.19*Math.sqrt(z.fc||5))+(z.fpe||0)).toFixed(3)} ksi
                            </div>
    ```
  - *Hunk at ≈ line 16786* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        <div style={{display:'flex',borderRadius:'5px',overflow:'hidden',border:'1px solid #e5e7eb'}}>
                          {[['moderate','Moderate (fr=0.19√f\'c)'],['severe','Severe (fr=0.0948√f\'c)']].map(([v,lbl])=>(
                            <button key={v} onClick={()=>setRating('ps3Exposure',v)}
    ```
    After:
    ```js
                        <div style={{display:'flex',borderRadius:'5px',overflow:'hidden',border:'1px solid #e5e7eb'}}>
                          {[['moderate','Moderate (f_t=0.19√f\'c)'],['severe','Severe (f_t=0.0948√f\'c)']].map(([v,lbl])=>(
                            <button key={v} onClick={()=>setRating('ps3Exposure',v)}
    ```
  - *Hunk at ≈ line 16815* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                          {label:'Controls',  value:govPS3?.governs??'—', color:'#7c3aed'},
                          {label:'fr + fpe limit', value:govPS3?`${govPS3.limit.toFixed(3)} ksi`:'—', color:'#059669'},
                        ].map(({label,value,color})=>(
    ```
    After:
    ```js
                          {label:'Controls',  value:govPS3?.governs??'—', color:'#7c3aed'},
                          {label:'f_t + fpe limit', value:govPS3?`${govPS3.limit.toFixed(3)} ksi`:'—', color:'#059669'},
                        ].map(({label,value,color})=>(
    ```
  - *Hunk at ≈ line 16896* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
                        fontSize:'9.5px',fontFamily:'monospace',color:'#9ca3af'}}>
                        γ_LL={ps3GamLL} · fr=0.19√f'c ({ps3Exposure}) · limit=fr+fpe · all stresses in ksi · f=M·12/Sb
                        &nbsp;·&nbsp; MBE 6A.5.4.2
    ```
    After:
    ```js
                        fontSize:'9.5px',fontFamily:'monospace',color:'#9ca3af'}}>
                        γ_LL={ps3GamLL} · LL × {ps3Scale.toFixed(4)} · f_t={ps3Exposure==='severe'?'0.0948':'0.19'}√f'c tension limit ({ps3Exposure}) · limit=f_t+fpe · all stresses in ksi · f=M·12/Sb
                        &nbsp;·&nbsp; MBE 6A.5.4.2
    ```

### SW17. LL & DL geometry hand-off: type 'k' for PS members (IDX-O13)   [hand-off payload] [no result change]
- **Where:** `buildLLDFGeom` (anchor `const isPS=!!((cfg.ps&&cfg.ps.enabled)`). `inputs.type` is 'k' (Table 4.6.2.2.1-1, precast concrete I / bulb-tee) when the member is prestressed concrete (Sections "Prestressed concrete member", or rating structure type PS), else 'a'. lldf.html strips `type` on receipt (its `applyGeom` deletes it), so this is informational; no receiver change needed.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 20683* (function App() {)

    Before:
    ```js
        if(!spans.length && isGFS && +g.span>0) spans=[+g.span];
        const inputs={type:'a', spans};                            // 'a' = steel I-girder (MCT builds steel)
        let Nb;
    ```
    After:
    ```js
        if(!spans.length && isGFS && +g.span>0) spans=[+g.span];
        // Table 4.6.2.2.1-1 type: 'k' (precast concrete I / bulb-tee) when the member is
        // prestressed concrete here, else 'a' (steel). Was always 'a' (sweep IDX-O13); LL & DL
        // keeps its own classification and ignores this field, so it is informational.
        const isPS=!!((cfg.ps&&cfg.ps.enabled)||(cfg.rating&&cfg.rating.structType==='psconc'));
        const inputs={type:isPS?'k':'a', spans};
        let Nb;
    ```

### SW18. Demands hand-off: `imIncluded` / `dfIncluded`; PS combo note corrected (IDX-O12, part)   [hand-off payload: new optional fields] [no result change]
- **Where:** `buildPSBeamExport` return object (anchor `imIncluded: llEnvCases.length>0`); `buildPSBeamCombos` LL note.
- **Fix:** new optional fields: `imIncluded` (every LL case in the envelope carries the DLA in the MCT scale, per `mctCarriesImpact`), `dfIncluded` (true in GFS mode, where the grillage distributes the load; false for a girder-line model). The PS-Beam LL combo note said "DF and IM applied"; DF is never applied in the MCT — now "LL per MIDAS (IM per Step 5 DLA; no DF in a beam-line model)". The note is written only when the PS-Beam combos are (re)built. Receivers do not read the flags yet; the separate steel `_schema` / `handoffId` live in the shared hand-off block and the receivers (remaining item R1).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 1990* (function buildPSBeamExport({cfg, origRows, nodePositions, isGFS, gfsMe…)

    Before:
    ```js
        selfWeightExcluded:excludeSelfweight,  // true ⇒ DC1 has NO member self-weight; PS-Beam adds concrete girder wt
        member:{ mode:isGFS?'gfs':'beam', key:gfsMember||'',
    ```
    After:
    ```js
        selfWeightExcluded:excludeSelfweight,  // true ⇒ DC1 has NO member self-weight; PS-Beam adds concrete girder wt
        // New optional flags (sweep IDX-O12), informational until the receivers read them:
        // imIncluded = every LL case in the envelope carries the DLA in the MCT *MVLDCASE scale;
        // dfIncluded = lateral distribution is in the analysis (GFS grillage), not in a beam-line model.
        imIncluded: llEnvCases.length>0 && llEnvCases.every(lc=>mctCarriesImpact(cfg, lc)),
        dfIncluded: !!isGFS,
        member:{ mode:isGFS?'gfs':'beam', key:gfsMember||'',
    ```
  - *Hunk at ≈ line 7576* (function buildPSBeamCombos(cfg) {)

    Before:
    ```js
        out.push({id:'psb_ll_'+i, name:'LL_'+vn.replace(/[^A-Za-z0-9]+/g,''), kind:'SERVICE', active:true,
                  note:note+' - LL envelope per MIDAS (DF and IM applied)',
                  terms:[{lc, type:'MV', factor:1, _key:'psb_ll_'+i}]});
    ```
    After:
    ```js
        out.push({id:'psb_ll_'+i, name:'LL_'+vn.replace(/[^A-Za-z0-9]+/g,''), kind:'SERVICE', active:true,
                  note:note+' - LL per MIDAS (IM per Step 5 DLA; no DF in a beam-line model)',
                  terms:[{lc, type:'MV', factor:1, _key:'psb_ll_'+i}]});
    ```

### SW19. psSection and LLDF payloads checked for `_schema` / `schemaVersion` (IDX-S6)   [robustness] [no result change for valid payloads]
- **Where:** `readPSSectionRaw` → new `readPSSectionChecked` (anchor `function readPSSectionChecked(){`), "Auto-fill from PS-Beam" (alerts the reason), `lldfResolveMCT` (anchor `d._schema!=='bridge-lldf-factors'`). Only `bridge-ps-section` v1 and `bridge-lldf-factors` v1 are accepted (both senders have always written these schemas).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 6242* (function psLibShape(key,wOverride){)

    Before:
    ```js
    function readPSSectionRaw(){
      try{ const raw=localStorage.getItem('bridgeSuite.v1.psSection'); return raw?JSON.parse(raw):null; }
      catch(e){ return null; }
    }
    ```
    After:
    ```js
    function readPSSectionRaw(){
      return readPSSectionChecked().d;
    }
    // bridgeSuite.v1.psSection with its _schema / schemaVersion checked (sweep IDX-S6): anything
    // that is not a v1 'bridge-ps-section' payload is refused, with the reason in `why`.
    function readPSSectionChecked(){
      let raw=null, d=null;
      try{ raw=localStorage.getItem('bridgeSuite.v1.psSection'); }catch(e){}
      if(!raw) return {d:null, why:''};
      try{ d=JSON.parse(raw); }catch(e){ return {d:null, why:'The PS-Beam section data could not be read: '+((e&&e.message)||e)}; }
      if(!d||d._schema!=='bridge-ps-section') return {d:null, why:'The shared section data is not a PS-Beam section payload (_schema "'+(d&&d._schema)+'"). Nothing was changed.'};
      if((d.schemaVersion||1)>1) return {d:null, why:'The PS-Beam section data is v'+d.schemaVersion+'; this MCT build supports v1. Update the MCT app.'};
      return {d, why:''};
    }
    ```
  - *Hunk at ≈ line 6366* (function StepSections({cfg,set}) {)

    Before:
    ```js
                const P=cfg.ps||{}; const setP=patch=>set('ps',{...P,...patch});
                const readPS=()=>{ try{ const raw=localStorage.getItem('bridgeSuite.v1.psSection'); return raw?JSON.parse(raw):null; }catch(e){ return null; } };
                const autofill=()=>{ const d=readPS();
                  if(!d||!d.Ic){ alert('No composite section is available yet.\n\nOpen the PS-Beam app, select or enter the member you want, and let it compute — it publishes the composite section here automatically. Then click “Auto-fill from PS-Beam” again.'); return; }
    ```
    After:
    ```js
                const P=cfg.ps||{}; const setP=patch=>set('ps',{...P,...patch});
                const readPS=()=>readPSSectionChecked().d;
                const autofill=()=>{ const chk=readPSSectionChecked(); const d=chk.d;
                  if(chk.why){ alert(chk.why); return; }
                  if(!d||!d.Ic){ alert('No composite section is available yet.\n\nOpen the PS-Beam app, select or enter the member you want, and let it compute — it publishes the composite section here automatically. Then click “Auto-fill from PS-Beam” again.'); return; }
    ```
  - *Hunk at ≈ line 6824* (function lldfResolveMCT(){)

    Before:
    ```js
      let d; try{ d=JSON.parse(raw); }catch(e){ return {why:'Could not read the LLDF payload: '+((e&&e.message)||e)}; }
      if((d.schemaVersion||1)>1) return {why:'The LL & DL Distribution data is v'+d.schemaVersion+'; this MCT build supports v1. Update the MCT app.'};
    ```
    After:
    ```js
      let d; try{ d=JSON.parse(raw); }catch(e){ return {why:'Could not read the LLDF payload: '+((e&&e.message)||e)}; }
      if(!d||d._schema!=='bridge-lldf-factors') return {why:'The published distribution data is not an LL & DL factors payload (_schema "'+(d&&d._schema)+'"). Nothing was applied.'};
      if((d.schemaVersion||1)>1) return {why:'The LL & DL Distribution data is v'+d.schemaVersion+'; this MCT build supports v1. Update the MCT app.'};
    ```

### SW20. "embed" postMessage accepted only from a framed sibling app (IDX-S10)   [robustness]
- **Where:** `App()` message handler (anchor `// Only a sibling app framed by this window may switch the frame`). The `embed` request is honoured only when `e.source` is the contentWindow of one of this window's app frames. The `whois` responder in the shared bootstrap block is not changed (R2).
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 20777* (function App() {)

    Before:
    ```js
          if(!d||d.source!=='bridge-suite') return;
          if('embed' in d){ openEmbed(d.embed||null); return; }
          if(d.hello){
    ```
    After:
    ```js
          if(!d||d.source!=='bridge-suite') return;
          // Only a sibling app framed by this window may switch the frame (sweep IDX-S10):
          // a message from any other window or origin is ignored.
          if('embed' in d){
            let ours=false;
            Object.keys(frameRefs.current).forEach(a=>{ const el=frameRefs.current[a];
              try{ if(el&&el.contentWindow&&el.contentWindow===e.source) ours=true; }catch(err){} });
            if(ours) openEmbed(d.embed||null);
            return; }
          if(d.hello){
    ```

### SW21. Title-block defaults: blank engineer, today's date (IDX-C6)   [defaults] [no result change]
- **Where:** `DEFAULT_CFG` (anchor `// Title-block defaults: blank engineer and today's date`); `generateGFS_MCT` destructuring default. Was `projectUser:'HDR'`, `projectDate:'2026/4/15'`. Saved projects keep their own values (they are spread over the defaults). The MIDAS version default 9.5.5 is unchanged.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 3875* (function generateGFS_MCT(cfg) {)

    Before:
    ```js
      if(!geo) return ';ERROR\n*ENDDATA';
      const {projectName='',projectUser='HDR',projectClient='',projectBridgeId='',projectDate='',projectRevision='0',projectAddress='',version='9.5.5',materialGrade='A36'}=cfg;
      const span=geo.span, width=geo.width, nG=geo.nG, Y=geo.Y;
    ```
    After:
    ```js
      if(!geo) return ';ERROR\n*ENDDATA';
      const {projectName='',projectUser='',projectClient='',projectBridgeId='',projectDate='',projectRevision='0',projectAddress='',version='9.5.5',materialGrade='A36'}=cfg;
      const span=geo.span, width=geo.width, nG=geo.nG, Y=geo.Y;
    ```
  - *Hunk at ≈ line 19487* (function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, s…)

    Before:
    ```js
    
    const DEFAULT_CFG = {
      projectUser:'HDR',projectDate:'2026/4/15',version:'9.5.5',
      projectName:'',projectBridgeId:'',projectClient:'',
    ```
    After:
    ```js
    
    // Title-block defaults: blank engineer and today's date (YYYY/M/D, the MIDAS *PROJINFO form);
    // were a hard-coded firm name and a fixed date (sweep IDX-C6). Saved projects keep their own.
    const DEFAULT_CFG = {
      projectUser:'',projectDate:(()=>{ const t=new Date(); return t.getFullYear()+'/'+(t.getMonth()+1)+'/'+t.getDate(); })(),version:'9.5.5',
      projectName:'',projectBridgeId:'',projectClient:'',
    ```

### SW22. One-time notice for stale library data in a loaded project (IDX-O15)   [UI] [no result change]
- **Where:** new `staleProjectNotes(cfg)` before `function App()`; `staleNotes` / `staleDismissed` in `App()`; banner above the step content.
- **Fix:** on load, lists (dismissible, per session, nothing changed automatically): a rating tonnage that differs from the library value for the selected rating vehicle (F2/F3); FATIGUE combinations with the old LL factors 1.5 / 0.75 (F5); rolled-shape conversions whose plates differ from the corrected `ROLLED_SHAPES` (F1). No new storage key.
- **Before / after code** (exact; one block pair per changed place):
  - *Hunk at ≈ line 20641* (function EmbedTrouble({app,name,health,onUse,onClose}){)

    Before:
    ```js
    
    function App() {
    ```
    After:
    ```js
    
    /* Project data saved by an older build that the 2026-10-04 library corrections (F1, F2, F5)
       could not rewrite, because it is user data (sweep IDX-O15). Returns one line per item;
       shown once per load as a dismissible notice. Nothing is changed automatically. */
    function staleProjectNotes(cfg){
      const out=[];
      try{
        const R=cfg.rating||{};
        const vt=VEHICLE_TONS[R.vehicleName];
        if(vt!=null && R.vehicleTon!=null && Math.abs(+R.vehicleTon-vt)>1e-6)
          out.push('Rating tonnage W = '+R.vehicleTon+' t for '+R.vehicleName+'; the vehicle library now gives '+vt+' t. Re-select the vehicle (AASHTO Rating → Vehicle for Rating Tonnage) unless the value was entered on purpose.');
        (cfg.loadCombos||[]).forEach(c=>{
          if(c.kind!=='FATIGUE') return;
          if(+c.llFactor===1.5 || +c.llFactor===0.75)
            out.push('Combination "'+c.name+'" has the old fatigue LL factor '+c.llFactor+' (LRFD 10th Ed. Table 3.4.1-1: Fatigue I 1.75, Fatigue II 0.80). Re-apply the preset in Combos.');
        });
        ((cfg.aremaSection&&cfg.aremaSection.sectionLibrary)||[]).forEach(sec=>{
          if(sec.type!=='rolled' || !sec.rolledName) return;
          const r=ROLLED_SHAPES[sec.rolledName]; if(!r) return;
          const cp=(sec.aremaComps||[]).find(c=>c.id==='tcp'), w=(sec.aremaComps||[]).find(c=>c.id==='web');
          const off=(a,b)=>Math.abs((+a||0)-(+b||0))>5e-4;
          if((cp&&(off(cp.w,r.bf)||off(cp.t,r.tf))) || (w&&(off(w.w,r.tw)||off(w.h,r.d-2*r.tf))))
            out.push('Section "'+(sec.name||sec.rolledName)+'" was converted from '+sec.rolledName+' with dimensions that differ from the corrected AISC v16.0 table (bf '+r.bf+', tf '+r.tf+', tw '+r.tw+', d '+r.d+'). Re-convert the shape unless the plates were edited on purpose.');
        });
      }catch(e){}
      return out;
    }
    
    function App() {
    ```
  - *Hunk at ≈ line 21542* (function App() {)

    Before:
    ```js
      };
      const steps=[<StepProject cfg={cfg} set={set}/>,<StepGeometry cfg={cfg} set={set}/>,
    ```
    After:
    ```js
      };
      // One-time notice for stale library data in the loaded project (sweep IDX-O15).
      const staleNotes=useMemo(()=>staleProjectNotes(cfg),[cfg.rating&&cfg.rating.vehicleName,cfg.rating&&cfg.rating.vehicleTon,cfg.loadCombos,cfg.aremaSection]);
      const [staleDismissed,setStaleDismissed]=useState(false);
      const steps=[<StepProject cfg={cfg} set={set}/>,<StepGeometry cfg={cfg} set={set}/>,
    ```
  - *Hunk at ≈ line 21803* (function App() {)

    Before:
    ```js
              <div style={{flex:1,overflowY:'auto',padding:'24px 32px'}}>
                <StepErrorBoundary key={step}>{steps[step]}</StepErrorBoundary>
    ```
    After:
    ```js
              <div style={{flex:1,overflowY:'auto',padding:'24px 32px'}}>
                {!staleDismissed&&staleNotes.length>0&&(
                  <div style={{margin:'0 0 14px',padding:'10px 14px',borderRadius:'8px',border:'1px solid #fde68a',
                    borderLeft:'4px solid #d97706',background:'#fffbeb',fontSize:'12px',color:'#92400e',lineHeight:1.5}}>
                    <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                      <b>⚠ This project holds data from an older version of the libraries</b>
                      <button onClick={()=>setStaleDismissed(true)} style={{marginLeft:'auto',background:'#fff',border:'1px solid #fcd34d',
                        borderRadius:'5px',color:'#92400e',padding:'3px 10px',cursor:'pointer',fontSize:'11px'}}>Dismiss</button>
                    </div>
                    <ul style={{margin:'6px 0 0 18px'}}>{staleNotes.map((t,i)=><li key={i}>{t}</li>)}</ul>
                  </div>
                )}
                <StepErrorBoundary key={step}>{steps[step]}</StepErrorBoundary>
    ```

### Status of the open items logged on 2026-10-04 (O1–O15 above, and the superReactions note)
O1 → SW14 · O2 → SW12 · O3 → SW13 (+ N5) · O4, O5 → N6 · O6 → SW5, SW6 (+ N1) · O7 → SW7 · O8 → N2 · O9 → SW8 (+ N3) · O10 → SW9 · O11 → SW10 (+ N4) · O12 → SW18 (+ R1) · O13 → SW17 · O14 → SW11 · O15 → SW22 · superReactions sender → N11. AUDIT items IDX-A1 → SW2, IDX-A2 → SW1, IDX-A3 → SW3, IDX-A4 → SW15, IDX-A5 → SW16, IDX-S6 → SW19, IDX-S10 → SW20 (+ R2), IDX-C6 → SW21.

### Closed / not changed
- IDX-O13 is informational only (lldf strips the field) — fixed anyway (SW17).
- IDX-O8, IDX-O4, IDX-O5, IDX-R1: need the engineer (below); no code change.

### Needs engineer (questions, each with a recommendation)
- **N1 (IDX-O6, staged S).** Service II and PS Service III use one section modulus for all loads. Add three moduli per zone (non-composite, long-term 3n, short-term n) and split DC1 / DC2+DW / LL? Recommendation: yes, as new optional zone fields with the single S kept as the fallback.
- **N2 (IDX-O8).** HL-93 in the MCT: rear-axle spacing fixed at 14 ft and no 90 % two-truck + lane case for negative moment and pier reactions. Model the 14–30 ft spacing as several vehicles (14, 18, 22, 26, 30 ft) enveloped, and add a "HL-93 dual truck" vehicle at 0.9 with 50–ft minimum headway for the hogging/pier case? Recommendation: yes to both, as extra vehicle definitions (MIDAS has no variable spacing for user vehicles).
- **N3 (IDX-O9).** Confirm the permit factors against the printed MBE edition in use (routine row 1.40/1.35/1.30, 1.35/1.25/1.20, 1.30/1.20/1.15 by GVW/AL ≤ 2 / 2–3 / ≥ 3 and ADTT ≥ 5000 / 1000 / ≤ 100), and give the special/limited-crossing values you use (escorted single trip, single trip mixed with traffic, < 100 crossings). Recommendation: add the special rows as a "permit type" selector once confirmed.
- **N4 (IDX-O11).** GFS lane load: confirm that a COMBINED MIDAS case with truck and lane each listing every stringer lane is the intended placement (MIDAS may put the truck and the lane on different stringer lines). Recommendation: keep, and check one MIDAS run against a hand placement.
- **N5 (IDX-O3).** "Bolted I-girder, two-girder" φs: keep 0.85 (welded value, conservative) or use the riveted 0.90? Recommendation: 0.90 is defensible for bolted (non-welded, internally redundant connections) but MBE does not list it; keep 0.85 unless your agency says otherwise.
- **N6 (IDX-O4, IDX-O5).** AREMA Ch. 15: does your edition have the Fb lower bound 0.10·Fy and the 175-ft limit on the 16 + 600/(L − 30) impact; and the `AREMA_SFT` thresholds, wind on LL 0.200 k/ft at 8 ft, rocking, Max-rating Fs = 0.60·Fy, mixed ASD/LRFR cap zone? Needs the printed AREMA text; nothing changed.
- **N7 (new, composite Mn⁺).** Apply Mn ≤ 1.3·Rh·My (continuous spans, 6.10.7.1.2) and 6.10.7.2 for noncompact composite sections? Both need the staged My (DC1 on steel, DC2 on 3n, LL on n). Recommendation: add the staged moments as optional inputs with N1.
- **N8 (new, φs for shear).** The rating applies φs to shear as well (C_V = φc·φs·φv·Vn). MBE 6A.4.2.4 (verify) applies the system factor to flexural and axial effects; for shear φs = 1.0 is commonly used. Conservative as is; change? Recommendation: confirm against the printed MBE and, if so, drop φs from C_V.
- **N9 (new, PS card).** The β1 input on the PS Conc card is displayed but never used (β1 always from f'c), and the PS "Ductility check" reads `z.d`, which has no input. Remove the β1 input or honour it; drop the ductility line (c/de ≤ 0.42 is no longer an LRFD limit) or replace it with the 5.6.2.1 tension-controlled check? Recommendation: honour β1 only as a display, drop the ductility line.
- **N10 (new, PS Service III).** LRFD Table 5.9.2.3.2b-1 caps the tension limits at 0.6 ksi (moderate) / 0.3 ksi (severe); the cap is not applied (affects f'c > 10 ksi only). Apply it? Recommendation: yes.
- **N11 (IDX-R1).** index.html cannot send `superReactions` without a MIDAS reaction-table import. Add the import (DC1/DC2/DW per support per girder) or drop index from HANDOFF.md §4.4? Recommendation: drop it from §4.4 until a reaction import is wanted.

### Remaining open items (not changed in this PR)
- **R1 (IDX-O12 rest).** Separate `_schema` / `handoffId` for the steel demands payload, and receivers that read `imIncluded` / `dfIncluded`: the wrapper is in the shared `bridgeSuite.v1.*` hand-off block (same in index/lldf/psbeam/stgirder) and the receivers are psbeam.html / stgirder.html — needs a cross-tool PR (HANDOFF.md exception).
- **R2 (IDX-S10 rest).** The `whois` responder in the shared bootstrap block (`BridgeApps.announce`) answers any window; `e.source` check belongs in the shared block (all four files).
- **R3.** Service II reads `origRows` only, so a "Computed Combos" case chosen for Service II finds no rows (it silently drops out). Pre-existing; noted only.
- **R4.** The printed capacity table labels Composite / PS / AREMA zones "Manual" in the Type column (the basis line from SW2 now follows it). Display only.

## 2026-10-12 — PR: claude/bootstrap-sync (shared `bridgeSuite.v1.*` bootstrap; PR link added after merge)

Cross-tool sync of the shared bootstrap blocks. The same change is in index.html, lldf.html, psbeam.html and stgirder.html (CLAUDE.md §3). No engineering formula, factor, unit or code reference changed; no computed value changes. Storage keys and saved formats are unchanged (the hand-off map keeps its key and entry format; it only loses old entries).

This closes **R2** (IDX-S10 rest) of the 2026-10-12 sweep entry above.

### XS1. `whois` responder answers only the framing page, the opener, or an own frame (X-S10, IDX-S10 R2)   [robustness] [no result change]
- **Where:** `BridgeApps.announce()` in the "SHARED APP PATHS" block. Anchor: `d.source==='bridge-suite'&&d.whois`.
- **Before:**
  ```js
    try{ window.addEventListener('message',function(e){
      var d=e&&e.data; if(d&&d.source==='bridge-suite'&&d.whois) send();
    }); }catch(e){}
  ```
- **After:**
  ```js
    // Only the page framing this one, the window that opened it, or a frame
    // this window holds may ask (X-S10; same rule as the abutment / EDM links).
    var asker=function(src){
      if(!src) return false;
      try{
        if(window.parent!==window&&src===window.parent) return true;
        if(window.opener&&src===window.opener) return true;
        for(var i=0;i<window.frames.length;i++) if(window.frames[i]===src) return true;
      }catch(x){}
      return false;
    };
    try{ window.addEventListener('message',function(e){
      var d=e&&e.data; if(d&&d.source==='bridge-suite'&&d.whois&&asker(e.source)) send();
    }); }catch(e){}
  ```
- **Problem:** any window (e.g. a sibling frame) could make the app post its hello. Low risk; the reply only names the app. Same approach as abutment F10 / EDM S4.
- **Check:** host page framing lldf.html plus a sibling frame. Sibling sends `{source:'bridge-suite',whois:true}` to the lldf frame: main 1 hello reaches the host, branch 0. Host (parent) sends the same ping: 1 hello on both. The boot burst is unchanged.

### XS2. Hand-off map pruned on publish (X-S8)   [storage] [no result change]
- **Where:** `BridgeHandoff` block (index.html, psbeam.html, stgirder.html; lldf.html has no copy of this block). Anchors: `function prune(map,keep)`, `map=prune(map,[p.handoffId,localStorage.getItem(K_LATEST)]);`.
- **Before:** `publish()` added the entry to `bridgeSuite.v1.handoffs` and never removed any.
- **After:** new constants `var KEEP_N=20, KEEP_DAYS=30;` and
  ```js
  function prune(map,keep){
    var ids=Object.keys(map), cutoff=Date.now()-KEEP_DAYS*864e5, out={};
    ids.sort(function(a,b){ return String((map[b]||{}).producedAt||'').localeCompare(String((map[a]||{}).producedAt||'')); });
    ids.forEach(function(id,i){
      var t=Date.parse((map[id]||{}).producedAt||''), fresh=isNaN(t)||t>=cutoff;
      if(keep.indexOf(id)>=0||(i<KEEP_N&&fresh)) out[id]=map[id];
    });
    return out;
  }
  ```
  called in `publish()` right after `map[p.handoffId]=p;`. Rule: keep the newest 20 entries that are at most 30 days old; always keep the entry being published and the entry the `latestId` pointer named before this publish (the design apps read only the latest entry, so that is the one a receiver may not have pulled yet).
- **Check:** map seeded with 25 entries (m0–m14 aged 0–14 days, m15–m24 aged 55–64 days, `latestId`=m24) plus one entry with no date; publish `p/new`. Main: 27 entries kept. Branch: 17 (m0–m14, m24, new); `latestId` = `p__new` on both.

### XS3. Storage-full writes in the shared blocks are shown (X-S8)   [UI] [no result change]
- **Where:** "SHARED APP PATHS" block: new `isQuota()` / `storageWarn(what,e)` after `function now()`, exported as `BridgeApps.storageWarn`; called from `write()` (app paths), `BridgeProjects` `writeReg()` and `BridgeHandoff` `publish()` catch blocks. Anchor: `id='bridgeStorageWarn'`.
- **Before (examples):**
  ```js
  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ return false; } }
  function writeReg(r){ try{localStorage.setItem(K_PROJ,JSON.stringify(r));return true;}catch(e){return false;} }
  ```
- **After:**
  ```js
  function write(o){ try{ localStorage.setItem(KEY,JSON.stringify(o)); return true; }catch(e){ storageWarn('the app-path record',e); return false; } }
  function writeReg(r){ try{localStorage.setItem(K_PROJ,JSON.stringify(r));return true;}
    catch(e){ try{ if(window.BridgeApps&&window.BridgeApps.storageWarn) window.BridgeApps.storageWarn('the shared project',e); }catch(x){} return false;} }
  ```
  and in `publish()`'s catch: `window.BridgeApps.storageWarn('the analysis hand-off',e)`. `storageWarn` acts only on a quota error (`QuotaExceededError`, `NS_ERROR_DOM_QUOTA_REACHED`, code 22 / 1014, or "quota" in the message), so a browser that blocks storage outright is not nagged. It shows one fixed red banner per page (id `bridgeStorageWarn`, dismissable), one line per item: "⚠ Browser storage is full: <item> was not saved. Export your work as JSON now, then delete old projects to free space." Return values are unchanged (`false` / `null` / `{ok:false}`).
- **Check:** index.html with `setItem` for `bridgeSuite.v1.projects` / `.handoffs` throwing `QuotaExceededError`: `publish()` → `ok:false`, `saveSlice()` → `null` on both; main shows nothing, branch shows the banner with both lines (screenshot `quota_banner_br.png`).

### XS4. Shared blocks byte-identical (AUDIT S3)
- The `BridgeApps` block was already the same in all four files (stgirder F1, 2026-10-04); AUDIT S3 is closed by that entry. The `BridgeHandoff` block differed in formatting and comments between index.html and psbeam/stgirder.html; it is now the index.html text (plus XS2/XS3) in all three. The file-header comments above each block are per-file and were not touched.
- **Proof:** extracted blocks compared after the change (md5): `BridgeApps` block identical in the four files; `BridgeProjects` block identical in the four; `BridgeHandoff` block identical in index/psbeam/stgirder; `BridgeLocks` block unchanged and identical.

### How verified
- `node --check` on every plain `<script>` that holds the shared blocks, all four files.
- Headless Chromium, main vs branch, same steps: index publishes the PS demands payload → psbeam shows "New analysis data available", "Load these demands" adopts it (adopted token `test__beam@2026-10-12T10:00:00.000Z`); index publishes the steel payload → stgirder banner and adoption; lldf boots and resolves `BridgeApps.path('psbeam')`. Same results and the same storage keys on both; key values differ only in timestamps. No page errors (only Babel's "deoptimised styling" notes).
- **Other copies:** index.html, lldf.html, psbeam.html, stgirder.html (all changed in this PR; lldf.html has no `BridgeHandoff` block, so XS2 and the hand-off call of XS3 are not in it).

## 2026-10-12 — PR: claude/lldf-receivers (cross-tool: lldf DF payload `perFootStrip` / `skewShear` receivers; PR link added after merge)

Cross-tool connection PR (CLAUDE.md §7 exception): receivers of the `bridgeSuite.v1.lldf` payload honour lldf's new optional fields (fixlog/lldf.md 2026-10-12 SW3 `skewShear`, SW6 `perFootStrip`), and Bridge Geometry's skew note is softened. Tools changed: index.html, psbeam.html, stgirder.html, Moving Load Generator.html, Steel Bridge Beam Modules.html, Bridge Geometry.html; HANDOFF.md §4.2 / §4.3. The shared `bridgeSuite.v1.*` bootstrap blocks are not touched. No formula, factor, unit or code reference changed. Payloads without the new fields give the same results as before (checked).

### LR1. CIP slab DFs (`perFootStrip`) refused by the MCT rating DF pull   [hand-off] [no result change for girder payloads]
- **Where:** `lldfResolveMCT()`. Anchor: `if(d.perFootStrip===true) return {why:`.
- **Before:** (no check; after the `schemaVersion` line the slab factors were used as the girder g.)
- **After** (inserted after `if((d.schemaVersion||1)>1) return {why:'The LL & DL Distribution data is v'…`):
  ```js
  // CIP slab (lldf perFootStrip): the factors are per 1-ft strip of slab width, not per
  // girder, so they cannot scale a girder-line rating. Refused, never converted (HANDOFF.md §4.3).
  if(d.perFootStrip===true) return {why:'The published distribution factors are for a cast-in-place slab: they are per 1-ft strip of slab width (AASHTO LRFD 4.6.2.3), not per girder. They cannot be used as the girder distribution factor here, so nothing was applied.\n\nIf this MIDAS model is a 1-ft slab strip, enter the strip factor by hand.'};
  ```
- **Problem:** a slab payload's g ≈ 0.076 lanes per 1-ft strip was applied as the girder-line LL factor: the rating LL would be scaled by about 1/13 of a girder value (very unconservative if the MIDAS model is a girder line).
- **Skew:** this tool does not read the payload skew; g_V already includes lldf's shear correction (at θ_V when `skewShear` is sent). Nothing to change.
- **Check case:** lldf type "Cast-in-place concrete slab", 1 span 120 ft, default inputs → payload `perFootStrip:true`, interior gM = gV = 0.076 (per 1-ft strip), fatM = fatV = 0.045. Before: g = 0.076, g_V = 0.076 applied to the rating (B2). After: refused with the message above; nothing applied. Girder payload (type a, θ = 30°, θ_V = 40°: gM 0.7128, gV 1.0582, fatM 0.4019, fatV 0.7075): identical before and after.
- **Governing provision:** AASHTO LRFD 10th Ed. Art. 4.6.2.3 (equivalent strip widths for slab-type bridges: the slab DF is per unit width, not per girder). No formula changed.
- **How verified:** headless Chromium, main vs branch: lldf "Send DFs" for the slab and the girder case, then the resolver called on this tool (`lldfResolveMCT()`). Slab: main applied, branch refused. Girder: identical results (only `producedAt` differs). No page errors.

## 2026-10-18 — PR: claude/index-d11-report (PR link added after merge)

Display only (AUDIT.md D11 and CLAUDE.md §6). No formula, factor, unit, code reference or computed result changed; no saved-data key or format changed. The shared `bridgeSuite.v1.*` bootstrap blocks at the top of the file are not touched.

### D11: calculation-sheet format for both reports (Gusset Plate Rating / ST-Girder format) (Tier 1, display only)
- **Engineer request:** 2026-10-14 / 2026-10-18 (AUDIT.md D11). This tool had two report builders, neither in the house format: **Generate Report** (`generateReportHTML`, sidebar) and **Print AREMA Report** (`generateAremaReport`, AREMA Rating step). Both now go through one post-processor. The one-page "Rating Report Card" print (AASHTO Rating → Report Card) is a summary card, not a calculation report, and is unchanged.
- **New block** (≈ line 19711), immediately before `// ── Report Generator ──`, anchor `/* D11 (2026-10-18): calculation-sheet report in the Gusset Plate Rating / ST-Girder format.`: `IDX_REFS_MBE`, `IDX_REFS_AREMA`, `idxEsc()`, `idxTex()` (KaTeX → HTML string, as `generateAremaReport`'s own `tex()`), `idxPageCSS(tb,tool)`, `IDX_CR_CSS`, `idxResultBlock(rows)`, `idxCalcSheet(html,o)`. To re-apply by hand, copy that block from this version.
- **`idxCalcSheet(html,o)`** parses the finished report HTML (`DOMParser`) and:
  - removes elements marked `data-cr-drop` (the old cover and the old contents) and the `.page-break` divs;
  - numbers every `h2` "n." and every `h3` under it "n.k" (the builder's own leading numbers, e.g. "8.2 " or "2b. ", are replaced), gives them ids and the house heading style, and starts each section on a new page;
  - puts in front a cover (title, project, codes, title block, project information, governing result) and a front page with the references table and a numbered table of contents with links (sections and subsections);
  - replaces the first `[data-cr-results]` placeholder (lowest value) with the "Results — Rating factors" block, one line per check: "<check>: RF = x.xxx (<ref>; <location>; see §n.k) PASS/FAIL" (PASS = RF ≥ 1.0, the tool's own rule);
  - rewrites `a.cr-see[data-see=<cid>]` to "see §n.k" with a link to the heading carrying `data-cid=<cid>`, or "worked section not in this printout";
  - adds the house CSS and the print page CSS (`@media print { @page { size: letter …; @top-left "Project No / Description", @top-center "Computed By / Checked By", @top-right "Date / Date", @bottom-left "<project> (MIDAS Civil MCT Generator)", @bottom-right "Page X of Y" } }`), so the margin boxes apply only while printing.
- **Title block** (no field added, no saved key changed): Project = `cfg.projectName` (else `projectBridgeId`); **Project No. = `cfg.rating.arema_reportProjectNum`** (the tool's only project-number field, from the AREMA report settings; "—" when blank); Computed by = `cfg.projectUser` (AREMA report: `arema_reportInspector`, else `projectUser`); Date = `cfg.projectDate` (AREMA: `arema_reportRatingDate`, else `projectDate`); **Checked by / Checked date: no fields in this tool, printed "—"**. The rest of the old cover (Bridge ID, client, revision, address, MIDAS version, report time, rating method, description; AREMA: owner, rating date) is on the new cover.
- **References** (only what the tool cites; "Edition: verify" where the tool states none): `IDX_REFS_MBE` — AASHTO MBE 6A.4.2.1 (Eq. 6A.4.2.1-3), Tables 6A.4.2.2-1 / 6A.4.2.3-1 / 6A.4.2.4-1, 6A.8, Section 6B; AASHTO LRFD 3.6.1.2.2 / 3.6.1.2.3, 3.6.2.1, 4.6.2.2, Table 3.4.1-1 ("10th Ed. where the tool states one; otherwise edition: verify"); MIDAS Civil (pasted results). `IDX_REFS_AREMA` — AREMA Ch. 15 §7.3, Tables 15-1-11 and 15-7-1, §1.3.1 / §1.3.3 / §1.3.4 / §1.3.6 / §1.3.7, §1.5.8, §1.7, §1.12.3, edition: verify; MIDAS Civil.
- **`generateReportHTML`** (Generate Report):
  - New parameter `ratingLLScaleExpr`. The `@page{size:A4 portrait;margin:18mm 14mm 18mm 14mm}` rule is removed (the page is letter now, from `idxPageCSS`). The KaTeX 0.16.9 CSS link (same pinned version as the tool's own tag) is added to the report head.
  - `secProject` (the old cover div) is replaced by the array `projMeta` (anchor `// ── SECTION: Project Info ── (D11: printed on the calculation-sheet cover by idxCalcSheet)`); it is no longer in the body.
  - Targets: `<h2 data-cid="rinp">9. Rating — Inputs & Method</h2>`, `<h3 data-cid="rmeth">Method & Load Factors</h3>`, `<h3 data-cid="rcap">Capacity Zones</h3>`, `<h2 data-cid="rres">… Rating Factor Results</h2>`.
  - New subsection "Live-Load Scale Factor" (`data-cid="rscale"`, before Capacity Zones): s = <the product exactly as the Inputs & Setup panel writes it> = ratingLLScale, plus s(M⁺), s(M⁻), s(V) when the actions have their own g. The LL Scale row of the method table gets "(see §9.k)".
  - New `secWorked` (anchor `// D11 (2026-10-18): each rated action worked at the node where its RF is lowest`), printed after the RF chart and before "Critical Locations": for M⁺, M⁻ and V, at the node where that action's RF is lowest (ties → last node, as `govRating`): the unfactored values used (load-case names), C = φc·φs·φ·Rn with Rn from `capAt(x)` and C = the tool's `CmnPos` / `CmnNeg` / `Cvn`, and RF = (C − γDC·DC − γDW·DW)/(γLL·s·LL) with values substituted and the tool's `rfMpos` / `rfMneg` / `rfV`. No value is recomputed. An action with no live load of that sense at any node says so (its line reads "RF = n/a … N/A").
  - "AASHTO Rating RF x.xxx: see §10.k" line under the governing tiles; `<div data-cr-results="1"></div>` after the Critical Locations table. Result lines: M⁺, M⁻, V and "Governing rating factor … → tons (vehicle, weight; node)", labelled with the limit state and level, ref "MBE 6A.4.2.1" (LFR: "MBE Section 6B (LFR)").
  - `return \`<!DOCTYPE html>…\`` → `const html = \`…\`` and `return idxCalcSheet(html,{…})`.
- **`generateAremaReport`** (Print AREMA Report):
  - `'@page{margin:0.75in;size:letter}',` removed from `reportCSS`.
  - `Sec()` / `Sub()` take an optional `cid` (written as `data-cid`). Before: `` const Sec = (title,{color='#1d4ed8',bg='#eff6ff',br=false}={})=> `${br?'<div class="pb">':''}<h2 style=…` `` After: `` const Sec = (title,{color='#1d4ed8',bg='#eff6ff',br=false,cid=''}={})=> `${br?'<div class="pb">':''}<h2${cid?` data-cid="${cid}"`:''} style=…` `` (same for `Sub` with `<h3`).
  - cids: "Vertical Load Parameters" `avlp`, §5 Lateral Force `alat`, §6 Summary `asum`, §8 Detailed Calculations `acalc`, the per-case calc headings `ac8.2` … `ac8.4` (from `mkCalcDetail`'s label) and fatigue `ac8.5`.
  - The old cover div and the old (unlinked, fixed-list) contents div get `data-cr-drop`. The report-settings "Cover" / "TOC" switches still decide whether the new cover / contents print.
  - `mkCalcDetail` adds a line under its table: "(1+I) = …, DF = …: see §n.k (Vertical Load Parameters) · CF factor and lateral effects: see §n (Lateral Force Calculations)". The Rating Results — Summary section gets "Normal RF …: see §n.k · Maximum … · Modified … · Fatigue …" (the detailed-calculation subsections) and `<div data-cr-results="2"></div>`; Detailed Calculations ends with `<div data-cr-results="1"></div>` (so the result block prints at the end of the detailed calculations, or of the summary when they are switched off). In the AREMA check case these read §4.1, §5 and §9.2–§9.5 (the duplicate §4 is renumbered, so the old §8 is §9).
  - Result lines: Normal / Maximum / Modified / Fatigue, "RF = x.xxx (E-xx.x) (AREMA Ch. 15 §7.3; N… @ … ft; controls; see §n.k) PASS/FAIL" from `govN.gN`, `govX.gX`, `govM.gM`, `govFat.rfFat`.
  - `return \`<!DOCTYPE html>…\`` → `const html = \`…\`` and `return idxCalcSheet(html,{…})`.
- **App:** `generateReport()` passes `ratingLLScaleExpr: rs.ratingLLScaleExpr || ''`; the rating step's `onReportState({…})` adds `ratingLLScaleExpr: ratingLLFactors.filter(llFactorActive).map(f=>f.id==='im'?\`(1+${f.value}/100)\`:f.value).join(' × ')||'1'` (the same string the Inputs & Setup "LL scale" line shows). In-memory state only; the hand-off payloads do not read it (checked, see below).
- **Before:** Generate Report: an A4 page, a coloured cover with Engineer/Date (no Project No., no Checked by), sections numbered 1–10 by hand with no contents, no references, no worked rating calculation (tables only), no result lines, no page header or page numbers. Print AREMA Report: an unlinked fixed-list contents, two sections both numbered "4.", "2b." for section loss, `@page{margin:0.75in}` with no header/footer.
- **After:** both reports: cover with the title block, references, numbered linked contents, sections n / subsections n.k each section on a new page, worked equations symbolic → substituted → result, the result block, letter pages with the house header/footer and "Page X of Y".
- **Fixed along the way (display only):**
  1. **AREMA report "Project / Bridge ID" printed the engineer's name** (`cfg.projectUser`) in §1 (both the beam and the GFS variant). Before: `['Project / Bridge ID',cfg?.projectUser||'—']`. After: `['Project / Bridge ID',[cfg?.projectName,cfg?.projectBridgeId].filter(Boolean).join(' / ')||'—']`. The old cover also printed `projectUser` as the report title; the new cover uses the project name.
  2. **AREMA report numbering:** "4. Rating Parameters" and "4. Load Configuration" (two §4) and "2b. Section Loss" now number in sequence; the fixed contents list (which could name sections not printed) is replaced by the generated one.
  3. **Generate Report had no page numbers, header or Project No.** (see above).
- **Provision:** none. No formula, factor, unit, code reference or result changed.
- **Saved data:** none. `mct_cfg_v3`, `mct_cap_zones_v1`, `mct_results_*`, IndexedDB `mct_idb_v1`, the JSON export and every `bridgeSuite.v1.*` key/payload are untouched (compared, below).
- **Check case:** 4-span default model (4 × 20.25 ft), synthetic MIDAS rows (load cases DC, DW, LL(max), LL(min)), one manual capacity zone Mn⁺ 900, Mn⁻ 700 ft·k, Vn 220 k, LRFR Strength I Inventory, γ 1.25 / 1.50 / 1.75, φc = φs = φ = 1, s = 1 (IM already in the MCT):
  - §10.1 M⁺ at node 136 (x = 70.88 ft): C = 1 × 1 × 1 × 900.0 = 900 ft·k; RF = (900 − 1.25 × 43.06 − 1.5 × 8.97)/(1.75 × 1.0000 × 450.06) = 832.7/787.6 = 1.057 PASS.
  - §10.2 M⁻ at node 131 (x = 60.75 ft): RF = (700 − 1.25 × 36.91 − 1.5 × 7.69)/(1.75 × 1.0000 × 410.07) = 642.3/717.6 = 0.895 FAIL — governing, 32.2 tons (HL-93 36 t), equal to the "AASHTO Rating RF" tile and the table.
  - §10.3 V at node 111 (x = 20.25 ft): RF = (220 − 1.25 × 13.97 − 1.5 × 2.91)/(1.75 × 1.0000 × 101.25) = 198.2/177.2 = 1.118 PASS.
  - Quick-calc zone case (Fy 50, Zx 126, Poor φc 0.85, g 0.55, IM 33 % applied, m 1.2, Operating γLL 1.35): s = 0.55 × (1 + 33/100) × 1.2 = 0.8778; M⁺: C = 0.85 × 1 × 1 × 525.0 = 446.3 ft·k, RF = (446.3 − 1.25 × 69.81 − 1.5 × 12.69)/(1.35 × 0.8778 × 414.15) = 0.693.
  - Pages (letter): default project (no results) 14 — 6 sections, 1 subsection; check case above 21 — 10 sections, 11 subsections; AREMA case 17 — 10 sections, 15 subsections.

### D11 links: quoted values link to where they are worked (CLAUDE.md §6) (Tier 1, display only)
- **New** (after `idxCalcSheet`, anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`): component `IdxWorkedIn({items, sx})` ("Worked in: <value> → <Step · Panel>") and `idxGotoEl(id)` (waits for the element, scrolls the nearest scrolling panel — or the page — so it is at the top, flashes it). CSS in the head `<style>` (anchor `/* D11 links (CLAUDE.md §6)`): `.idx-wkFlash` outline flash; `.idx-wk` hidden in print. The Report Card's own print window hides `.idx-wk` too (`.idx-wk{display:none}` added to its inline style).
- **Targets** (an `id` added to an existing container, no layout change): `idx-ll-scale` (AASHTO Inputs & Setup, "⚙ Live Load Scale Factors" block), `idx-arema-calc` ("📐 AREMA ASD Calculation Sheet"), `idx-arema-llf` ("📐 Live Load Factors — Distribution, Impact (incl. Rocking) & Centrifugal Force").
- **Links:**
  1. AASHTO Rating → Report Card, under the load-factor tiles: "LL scale ×s → AASHTO Rating · Inputs & Setup · Live Load Scale Factors" (switches the sub-tab, opens the collapsed panel).
  2. AASHTO Rating → Report Card, AREMA box: "Normal RF x (N…) → AREMA Rating · AREMA ASD Calculation Sheet" (switches to the AREMA step). Shown only when no user rating location is set, so the sheet shows that governing node.
  3. AREMA Rating, NORMAL governing card: "RF → AREMA ASD Calculation Sheet" (same condition).
  4. AREMA ASD Calculation Sheet, under the dM row: "1 + I, DF, 1 + CF → AREMA Rating · Live Load Factors — Distribution, Impact & Centrifugal Force" (opens the collapsed panel).
- **In the reports** the equivalent references are the "see §n.k" lines listed in the D11 entry above (Generate Report: governing RF → worked subsection, LL scale → §9.k, capacity → Capacity Zones; AREMA report: (1+I)/DF → Vertical Load Parameters, CF/lateral → Lateral Force Calculations, summary RFs → the detailed-calculation subsections).
- **Not linked:** the AASHTO Summary / Multi-Vehicle / Report Card RF values. The app has no on-screen worked AASHTO rating factor (only the equation with the factors, Inputs & Setup); the report works them (§10.k). Adding an in-app worked panel would be a UI change beyond this item.
- **Provision:** none. **Saved data:** none.

### How verified (both entries)
- `node tests/check-syntax.mjs index.html`: all 7 scripts pass (JSX transpiled).
- `node tests/compare.mjs --tool page --file index.html`: page.text and page.storage identical (only the usual Babel "deoptimised styling" note on both sides).
- Main (origin/main, same index.html as the branch base) vs branch, headless Chromium, same sibling files (psbeam/stgirder/lldf) on both sides, five cases: (1) built-in default project, no results; (2) the check case above with the title block filled; (3) 2 spans 40 + 50 ft, LFR Operating, g 0.6, g_V 0.72, g_M⁻ 0.66; (4) 3 spans 30/36/30 ft, global DLA 0 (IM applied in the rating), quick-calc zone, Poor condition, Operating; (5) 2 × 30 ft with an AREMA built-up zone. Each case imported through "⬇ Import JSON" (Export JSON format). Compared exactly: the text of every AASHTO Rating sub-tab (Inputs, Summary, Multi-Vehicle, D/C, Service II, Fatigue, PS Strength I, PS Service III, Report Card; "Worked in" lines removed), the AREMA Rating, Results and Generate steps, every table cell, tile value and the MCT block of Generate Report ("(see §n.k)" removed), every table cell of Print AREMA Report, the `bridgeSuite.v1.handoffs` / `demandsKind` written by both design hand-off buttons (PS-Beam and steel payloads), and all localStorage. Result: all 91 sections identical. 0 console errors.
- Report PDFs (Playwright `page.pdf`, print media, `preferCSSPageSize`): all five cases; pages looked at: covers, references/contents, §9 inputs with the LL-scale subsection, §10 worked M⁺/M⁻/V, the result block, AREMA §9 detailed calculations and its result block, header/footer boxes. pdftotext: no raw TeX; "see §" targets resolve; 0 broken internal links in the report DOM.
- In-app click test: each of links 1–4 lands on its target (sub-tab or step switched, collapsed panel opened, target scrolled to the top and flashed).
- **Other copies:** none (the report builders and the link helper are specific to this tool; the shared `bridgeSuite.v1.*` blocks are not touched).

### Open items (not changed)
- **Project No. / Checked by / Checked date.** Project No. comes from the AREMA report setting "Project No." (`cfg.rating.arema_reportProjectNum`) for both reports; there are no checker fields, so they print "—". Add optional `projectNo` / `projectChecker` / `projectCheckDate` (new keys in `cfg`, absent in old files), or keep as is? Engineer to decide.
- **Posting tonnage (calculation, raised not fixed).** The "Load Posting Required — MBE §6A.8" box in Generate Report (and the rating step) prints RF_gov × weight for Type 3, Type 3-3 and Type 3S2 using the RF of the *rated* vehicle (e.g. HL-93). MBE posting uses each legal vehicle's own RF. Display of an existing value; not changed.
- **Charts section never printed.** `generateReportHTML` builds `secCharts` (the captured Results charts) but never puts it in the page; only the RF chart prints (inside the rating section). Include it, or remove the dead code?
- **AREMA report settings.** The "Cover" and "TOC" switches still drop the cover / contents. The house format always has them; keep the switches?
- **AREMA in-app calc sheet:** the "1 + I" row shows the base impact formula while the value includes rocking (the note says "incl. rocking"). Wording only; not changed.

## 2026-10-19 — PR: claude/index-posting (PR link added after merge)

### Load posting from each legal vehicle's own rating, MBE Eq. 6A.8.3-1 (Tier 2: result change in one module)
- **Problem (raised in the D11 open items, engineer asked to fix 2026-10-18):** the "⚠ Load Posting Required — MBE Section 6A.8" box (AASHTO Rating → Inputs & Setup, under the RF chart; and the same box in Generate Report §"Rating Factor Results") gave posting tons for Type 3, Type 3-3 and Type 3S2 from the **rated** vehicle's RF (e.g. HL-93), not from each legal vehicle's own legal-load rating. The two places did not even agree:
  - In the app: the rated vehicle's LL was scaled by W_v/W_rated, so RF_v = RF_rated·W_rated/W_v and the tonnage RF_v·W_v = RF_rated·W_rated was the **same for every truck** (4-span check case: 32.2 T for all three; Type 3 shown "✓ Adequate", RF 1.289).
  - In the report: RF_gov(rated) × W_v (check case: 22.4 / 35.8 / 32.2 T).
  - Neither used the legal vehicles' own MIDAS results, the legal γLL (MBE Table 6A.4.4.2.3a-1) or the posting equation (MBE Eq. 6A.8.3-1). Unconservative or conservative depending on the truck's geometry relative to HL-93.
- **What the tool already had (so no new rating method):** the AASHTO Legal Type 3 / 3-3 / 3S2 vehicles (and SU4–SU7, EV2/EV3) in the vehicle library, their moving-load cases in the MCT, the per-vehicle result-case mapping (`vehicleLCMap`, Multi-Vehicle tab, auto-detected), category Legal by default (`defaultVehicleCategory`) with γLL = `legalLLfactor(ADTT)` (MBE Table 6A.4.4.2.3a-1: 1.30 at ADTT ≤ 1000, 1.45 at ≥ 5000 or unknown, linear between), per-vehicle IM (`mctCarriesImpact(cfg, vehicleName)`) and the per-vehicle RF from that vehicle's own forces (`multiVehicleData`: Inventory and Operating columns, governing over nodes and M⁺ / M⁻ / V). The posting now reads those RFs.
- **§4 callout — before / after:**
  - Before (app): RF_v = min over nodes of (C − γDC·DC − γDW·DW)/(γLL·s·LL_rated·W_v/W_rated) (γLL = rating-level factor, e.g. 1.75 Inventory) = RF_rated·W_rated/W_v; tons = RF_v·W_v = RF_rated·W_rated.
  - Before (report): tons_v = RF_gov(rated) × W_v.
  - After (both): RF_v = the vehicle's governing **Operating-column** RF in the Multi-Vehicle rating (its own MIDAS result case; γLL = that vehicle's Op γLL, for category Legal = MBE Table 6A.4.4.2.3a-1 at the rating ADTT; DC/DW factors and capacities as the rating step). Then
    - 0.3 < RF_v < 1.0: **Posting = (W/0.7)·[(RF_v) − 0.3]** (MBE Eq. 6A.8.3-1), W = 25 / 40 / 36 T;
    - RF_v ≥ 1.0: "No posting" for that vehicle;
    - RF_v ≤ 0.3: no tonnage; "Eq. 6A.8.3-1 does not apply; consider closing the bridge (MBE 6A.8.3)";
    - method LFR: no tonnage; "Eq. 6A.8.3-1 is an LRFR provision; LFR posting (MBE Section 6B or owner method) is not implemented" (RF still shown and worked);
    - no result case assigned to the vehicle: "not computed — no MIDAS result case" (select the vehicle, run MIDAS, assign its case);
    - vehicle category set to Design or Permit: "not computed — rated as …, not Legal".
  - The rated-vehicle card stays (RF_gov × W_rated, unchanged value) and is labelled "RF × W, not a posting". Box title "Load Posting Required" → "Load Posting" (a legal truck may need none). When the box shows is unchanged (rated vehicle's governing RF < 1).
  - Operating column: MBE 6A.4.4.1 puts the legal-load rating at about the operating reliability level; for a Legal-category vehicle the tool's Inventory and Operating γLL are the same value (`vehicleGamLL` returns `{inv: ll, op: ll}`), so the columns differ only when the engineer typed different γLL values.
- **Governing provision:** AASHTO MBE 6A.8.3, Eq. 6A.8.3-1 (posting); 6A.4.4 / Table 6A.4.4.2.3a-1 (legal-load rating and γLL). The tool states no MBE edition ("Edition: verify" in its references; the permit table comment says 3rd Ed.). **Edition: verify.** No owner posting rule is cited anywhere in the tool (no MassDOT / RIDOT / CTDOT posting convention), so MBE Eq. 6A.8.3-1 is used.
- **Shown worked (CLAUDE.md §6):** app box: for each truck, "RF = (C − γ_DC·DC − γ_DW·DW)/(γ_LL·s·LL) = (values) = RF → Posting = (W/0.7)·(RF − 0.3) = (values) = P T" at the governing node with the result case, action, node, category and γLL, and "Worked in: Legal-vehicle RFs → AASHTO Rating · Multi-Vehicle" (switches the sub-tab). Report box: the same two equations in KaTeX (symbolic → substituted → result) with the case/node/γLL line and the outcome. The report box stays a `div` (no new heading), so the §-numbering of the report is unchanged.
- **References row** (`IDX_REFS_MBE`, printed in Generate Report): before `… Table 6A.4.2.4-1 (system factor φs), 6A.8 (posting), Section 6B (LFR). Edition: verify` → after `… Table 6A.4.2.4-1 (system factor φs), 6A.4.4 (legal-load rating; Table 6A.4.4.2.3a-1, legal γLL), 6A.8 (posting; Eq. 6A.8.3-1), Section 6B (LFR). Edition: verify`.

#### Where / before / after code
1. **New helper** after `function legalLLfactor(adtt)` (anchor `const IDX_POST_VEH=`):
```js
// Load posting from each AASHTO legal vehicle's OWN legal-load rating (2026-10-18).
// MBE 6A.8.3, Eq. 6A.8.3-1: Posting = (W/0.7)·[(RF) − 0.3] for 0.3 < RF < 1.0, where RF is the
// legal-load rating factor of that vehicle (MBE 6A.4.4) and W its weight (tons). RF ≥ 1.0: no
// posting for that vehicle. RF ≤ 0.3: the equation does not apply (MBE 6A.8.3: consider closing).
// RF = the vehicle's governing Operating-column RF of the Multi-Vehicle rating (its own MIDAS
// result case; Legal category → γLL per MBE Table 6A.4.4.2.3a-1). Replaces "rated vehicle's RF ×
// legal weight". Not computed for LFR (Eq. 6A.8.3-1 is an LRFR provision; MBE Section 6B posting
// or an owner method is not implemented) nor when the vehicle has no result case.
const IDX_POST_VEH=[['AASHTO Legal Type 3','Type 3',25],['AASHTO Legal Type 3-3','Type 3-3',40],['AASHTO Legal Type 3S2','Type 3S2',36]];
function idxLegalPosting(mv, method){
  return IDX_POST_VEH.map(([name,label,W0])=>{
    const v=(mv||[]).find(r=>r.name===name);
    const W=(v&&v.tons)||W0;
    if(!v) return {name,label,W,st:'none'};
    const o={name,label,W,RF:v.opRF,v};
    if(method==='LFR') return {...o,st:'lfr'};
    if(v.category!=='Legal') return {...o,st:'cat'};
    if(o.RF>=1) return {...o,st:'ok'};
    if(!(o.RF>0.3)) return {...o,st:'close'};
    return {...o,st:'post',P:W/0.7*(o.RF-0.3)};
  });
}
```
2. **`multiVehicleData`** (`StepResults`, anchor `// ── Multi-vehicle rating — uses ACTUAL result rows per vehicle`) keeps the values behind each vehicle's Operating RF (no RF changes). In `nodeList.map`, before:
```js
        return { node, pos:xPos, inv, op, CmnPos:+CmnPos.toFixed(1), CmnNeg:+CmnNeg.toFixed(1), Cvn:+Cvn.toFixed(1) };
```
after:
```js
        return { node, pos:xPos, inv, op, CmnPos:+CmnPos.toFixed(1), CmnNeg:+CmnNeg.toFixed(1), Cvn:+Cvn.toFixed(1),
                 p, sc:[ratingLLScale*vIMr, ratingLLScaleMn*vIMr, ratingLLScaleV*vIMr] };
```
and in the returned row, after `opNode: govOp.node, opPos: govOp.pos,` (before `nodeCount: nodeResults.length,`):
```js
        // values behind opRF at its node (shown worked with the load posting, MBE 6A.8.3)
        opWk: (()=>{ const g=govOp.op.governs, q=govOp.p, k=g==='M+'?0:g==='M-'?1:2;
          return { act:g, rf:[govOp.op.rfMpos,govOp.op.rfMneg,govOp.op.rfV][k], C:[q.CmnPos,q.CmnNeg,q.Cvn][k], DC:[q.Mdc,q.Mdc,q.Vdc][k],
                   DW:[q.Mdw,q.Mdw,q.Vdw][k], LL:[q.Mllpos,q.Mllneg,q.Vll][k], s:govOp.sc[k] }; })(),
```
3. **Report state** (`onReportState({…})` in `StepResults`): after the `ratingLLScaleExpr: …` line add
```js
      // Load posting (MBE 6A.8.3) from each legal vehicle's own Multi-Vehicle rating
      legalPosting: idxLegalPosting(multiVehicleData, ratingMethod),
```
and the effect's dependency list `},[ratingData, nodePositions, gfsMember]);` → `},[ratingData, nodePositions, gfsMember, multiVehicleData]);`. In `App`'s `generateReport`, after `ratingLLScaleExpr: rs.ratingLLScaleExpr || '',` add `legalPosting:     rs.legalPosting     || [],`; `generateReportHTML({… chartImages, ratingLLScaleExpr })` → `generateReportHTML({… chartImages, ratingLLScaleExpr, legalPosting })`.
4. **App box** (`StepResults`, from `{/* ── Posting Check ── */}` to just before `{/* ── Top Locations Table ── */}`). Before:
```jsx
          {/* ── Posting Check ── */}
          {govRating&&govRating.rfGov<1&&(()=>{
            // Per MBE §6A.8: posting RF for each vehicle must use that vehicle's own LL demands.
            // Since we only have one LL result case (from the rated vehicle), we scale LL demand
            // proportionally by gross weight: LL_v ≈ LL_rated × (W_v / W_rated).
            // RF_v = (C − γDC·DC − γDW·DW) / (γLL · LL_v · LLscale)
            // This is an approximation valid when vehicle geometry is similar; note accordingly.
            const POSTING_VEHICLES = [
              {label:'Type 3',   W:25},
              {label:'Type 3-3', W:40},
              {label:'Type 3S2', W:36},
            ];
            const W_rated = ratingVehicleTon || 36;

            // Per-node posting RFs (take governing node's demands)
            const gn = govRating;
            // Rebuild numerator for governing node (consistent with RF formula)
            // RF_rated = num / (gamLL * LL_rated * LLscale)  → num = RF_rated * gamLL * LL_rated * LLscale
            // RF_v = num / (gamLL * LL_v * LLscale) = RF_rated * LL_rated / LL_v = RF_rated * W_rated / W_v
            // → posting tons = RF_v * W_v = RF_rated * W_rated  (same for all! — the constant is C-DC-DW work)
            // More accurately for individual vehicles, also recompute per-node worst:
            const computePostRF = (W_v) => {
              if (!ratingData.length || W_rated<=0) return null;
              // Scale LL demands by weight ratio at each node, find governing RF
              const scaled = ratingData.map(p=>{
                const ratio = W_v / W_rated;
                const MllposV = p.Mllpos * ratio;
                const MllnegV = p.Mllneg * ratio;
                const VllV    = p.Vll    * ratio;
                const rfMpos = MllposV>0.001 ? (p.CmnPos - gamDC*Math.abs(p.Mdc) - gamDW*Math.abs(p.Mdw)) / (gamLL*MllposV*ratingLLScale) : null;
                const rfMneg = MllnegV>0.001 ? (p.CmnNeg - gamDC*Math.abs(p.Mdc) - gamDW*Math.abs(p.Mdw)) / (gamLL*MllnegV*ratingLLScaleMn) : null;
                const rfV    = VllV>0.001    ? (p.Cvn    - gamDC*Math.abs(p.Vdc||0) - gamDW*Math.abs(p.Vdw||0)) / (gamLL*VllV*ratingLLScaleV) : null;
                return Math.min(...[rfMpos,rfMneg,rfV].filter(v=>v!==null&&isFinite(v)));
              }).filter(isFinite);
              return scaled.length ? Math.min(...scaled) : null;
            };

            return (
              <div style={{background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:'8px',padding:'14px 16px',marginBottom:'14px'}}>
                <div style={{fontSize:'13px',fontWeight:'700',color:'#dc2626',marginBottom:'4px'}}>⚠ Load Posting Required — MBE Section 6A.8</div>
                <div style={{fontSize:'10.5px',color:'#dc2626',fontFamily:'monospace',marginBottom:'10px',opacity:0.8}}>
                  Operating rating RF and tonnage computed for each posting vehicle by scaling LL demands proportionally to gross weight.
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:'8px'}}>
                  {POSTING_VEHICLES.map(({label,W})=>{
                    const rfV = computePostRF(W);
                    const postTons = rfV!==null ? rfV*W : null;
                    return (
                      <div key={label} style={{background:'#fff',border:'1px solid #fecaca',borderRadius:'6px',padding:'8px 12px'}}>
                        <div style={{fontSize:'10px',fontFamily:'monospace',color:'#9ca3af',marginBottom:'2px'}}>{label} · {W} T GVW</div>
                        <div style={{fontSize:'18px',fontWeight:'700',color:postTons!==null&&postTons>=W?'#059669':'#dc2626',fontFamily:'monospace'}}>
                          {postTons!==null?postTons.toFixed(1)+' T':'—'}
                        </div>
                        <div style={{fontSize:'9px',color:'#9ca3af',fontFamily:'monospace',marginTop:'1px'}}>
                          RF={rfV!==null?rfV.toFixed(3):'—'} · {postTons!==null&&postTons>=W?'✓ Adequate':'❌ Post'}
                        </div>
                      </div>
                    );
                  })}
                  {/* Also show rated vehicle for reference */}
                  <div style={{background:'#fff',border:'1px dashed #fca5a5',borderRadius:'6px',padding:'8px 12px'}}>
                    <div style={{fontSize:'10px',fontFamily:'monospace',color:'#9ca3af',marginBottom:'2px'}}>
                      {ratingVehicleName?.replace('AASHTO ','').slice(0,22)||'Rated Vehicle'} (rated)
                    </div>
                    <div style={{fontSize:'18px',fontWeight:'700',color:'#dc2626',fontFamily:'monospace'}}>
                      {govRating.rfTons.toFixed(1)} T
                    </div>
                    <div style={{fontSize:'9px',color:'#9ca3af',fontFamily:'monospace',marginTop:'1px'}}>
                      RF={govRating.rfGov.toFixed(3)} · {W_rated} T GVW
                    </div>
                  </div>
                </div>
                <div style={{marginTop:'8px',fontSize:'10.5px',color:'#92400e',fontFamily:'monospace',
                  background:'#fffbeb',padding:'6px 10px',borderRadius:'4px',border:'1px solid #fde68a'}}>
                  ⚠ Posting based on proportional LL scaling from rated vehicle demands. For definitive posting values,
                  run separate MIDAS analyses with each posting vehicle as the live load case.
                </div>
              </div>
            );
          })()}
```
After:
```jsx
          {/* ── Posting Check ── */}
          {govRating&&govRating.rfGov<1&&(()=>{
            // MBE 6A.8.3 (2026-10-18): posting from each AASHTO legal vehicle's OWN legal-load
            // rating — the Multi-Vehicle RF from that vehicle's MIDAS result case (Operating column,
            // Legal γLL per MBE Table 6A.4.4.2.3a-1) — with Eq. 6A.8.3-1. See idxLegalPosting.
            // Before: the rated vehicle's LL scaled by weight (gave RF_rated × W_rated for every truck).
            const legalPost = idxLegalPosting(multiVehicleData, ratingMethod);
            const W_rated = ratingVehicleTon || 36;
            const f2 = v=>Math.abs(+v||0).toFixed(2);
            const why = x=>({
              none:'not computed — no MIDAS result case',
              lfr:'not computed — LFR (Eq. 6A.8.3-1 is LRFR)',
              cat:`not computed — rated as ${x.v&&x.v.category}, not Legal`,
              ok:'RF ≥ 1.0 → no posting',
              close:'RF ≤ 0.3 → consider closing',
              post:'❌ Post',
            })[x.st];

            return (
              <div style={{background:'#fef2f2',border:'2px solid #fca5a5',borderRadius:'8px',padding:'14px 16px',marginBottom:'14px'}}>
                <div style={{fontSize:'13px',fontWeight:'700',color:'#dc2626',marginBottom:'4px'}}>⚠ Load Posting — MBE Section 6A.8</div>
                <div style={{fontSize:'10.5px',color:'#dc2626',fontFamily:'monospace',marginBottom:'10px',opacity:0.8}}>
                  Posting per MBE Eq. 6A.8.3-1, Posting = (W/0.7)·[(RF) − 0.3] for 0.3 &lt; RF &lt; 1.0, with RF = each legal vehicle's own legal-load rating (Multi-Vehicle tab: its own MIDAS result case, Operating column).
                </div>
                <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(165px,1fr))',gap:'8px'}}>
                  {legalPost.map(x=>{
                    const isPost = x.st==='post', isOk = x.st==='ok';
                    return (
                      <div key={x.label} style={{background:'#fff',border:'1px solid #fecaca',borderRadius:'6px',padding:'8px 12px'}}>
                        <div style={{fontSize:'10px',fontFamily:'monospace',color:'#9ca3af',marginBottom:'2px'}}>{x.label} · {x.W} T GVW</div>
                        <div style={{fontSize:'18px',fontWeight:'700',color:isOk?'#059669':(isPost||x.st==='close')?'#dc2626':'#9ca3af',fontFamily:'monospace'}}>
                          {isPost?x.P.toFixed(1)+' T':isOk?'No posting':'—'}
                        </div>
                        <div style={{fontSize:'9px',color:'#9ca3af',fontFamily:'monospace',marginTop:'1px'}}>
                          RF={x.RF!=null?x.RF.toFixed(3):'—'} · {why(x)}
                        </div>
                      </div>
                    );
                  })}
                  {/* Also show rated vehicle for reference */}
                  <div style={{background:'#fff',border:'1px dashed #fca5a5',borderRadius:'6px',padding:'8px 12px'}}>
                    <div style={{fontSize:'10px',fontFamily:'monospace',color:'#9ca3af',marginBottom:'2px'}}>
                      {ratingVehicleName?.replace('AASHTO ','').slice(0,22)||'Rated Vehicle'} (rated)
                    </div>
                    <div style={{fontSize:'18px',fontWeight:'700',color:'#dc2626',fontFamily:'monospace'}}>
                      {govRating.rfTons.toFixed(1)} T
                    </div>
                    <div style={{fontSize:'9px',color:'#9ca3af',fontFamily:'monospace',marginTop:'1px'}}>
                      RF={govRating.rfGov.toFixed(3)} · {W_rated} T GVW · RF × W, not a posting
                    </div>
                  </div>
                </div>
                {/* Worked: legal-load RF at its governing node, then Eq. 6A.8.3-1 (CLAUDE.md §6) */}
                <div style={{marginTop:'8px',fontSize:'10px',color:'#374151',fontFamily:'monospace',background:'#fff',
                  padding:'6px 10px',borderRadius:'4px',border:'1px solid #fecaca',lineHeight:1.6}}>
                  {legalPost.map(x=>{
                    const v=x.v, w=v&&v.opWk;
                    if (!v) return <div key={x.label}>{x.label}: not computed — no MIDAS result case assigned. Select the vehicle in Vehicles, run MIDAS, assign its case in Multi-Vehicle.</div>;
                    return (
                      <div key={x.label}>
                        <strong>{x.label}</strong> ({v.posLC}, {w.act==='M+'?'M⁺':w.act==='M-'?'M⁻':'V'} at N{v.opNode} · {v.opPos.toFixed(2)} ft, {v.category}, γ_LL = {v.gamLLop}):{' '}
                        RF = (C − γ_DC·DC − γ_DW·DW)/(γ_LL·s·LL) = ({(+w.C).toFixed(1)} − {gamDC}×{f2(w.DC)} − {gamDW}×{f2(w.DW)})/({v.gamLLop}×{(+w.s).toFixed(4)}×{f2(w.LL)}) = {w.rf!=null?w.rf.toFixed(3):'—'}
                        {x.st==='post'&&<> → Posting = (W/0.7)·(RF − 0.3) = ({x.W}/0.7)×({x.RF.toFixed(3)} − 0.3) = <strong>{x.P.toFixed(1)} T</strong></>}
                        {x.st==='ok'&&<> → RF ≥ 1.0: no posting for this vehicle</>}
                        {x.st==='close'&&<> → RF ≤ 0.3: Eq. 6A.8.3-1 does not apply; consider closing the bridge (MBE 6A.8.3)</>}
                        {x.st==='lfr'&&<> → posting not computed: Eq. 6A.8.3-1 is an LRFR provision; LFR posting (MBE Section 6B or owner method) is not implemented</>}
                        {x.st==='cat'&&<> → posting not computed: the vehicle is rated as {v.category}; set its category to Legal (γ_LL per MBE Table 6A.4.4.2.3a-1) in Multi-Vehicle</>}
                      </div>
                    );
                  })}
                </div>
                <IdxWorkedIn items={[{txt:'Legal-vehicle RFs', label:'AASHTO Rating · Multi-Vehicle',
                  go:()=>{ setRatingSubTab('table'); }}]}/>
              </div>
            );
          })()}
```
5. **Report box** (`generateReportHTML`, after the `cr-see-line` "AASHTO Rating RF …" line, up to `${chartImages?.rating?`). Before:
```js
    ${govRating.rfGov<1?`
    <div style="margin-bottom:14px;padding:10px 14px;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px">
      <strong style="color:#991b1b">⚠ Load Posting Required — MBE §6A.8</strong><br/>
      <div style="margin-top:6px;display:flex;gap:16px;font-size:9.5pt">
        ${[['Type 3',25],['Type 3-3',40],['Type 3S2',36],[ratingVehicleName||'Rated Vehicle',ratingVehicleTon||36]]
          .filter((v,i,a)=>a.findIndex(x=>x[0]===v[0])===i)
          .map(([v,w])=>`<span><strong>${(govRating.rfGov*w).toFixed(1)} T</strong> — ${v}</span>`).join('')}
      </div>
    </div>`:''}` : ''}
```
After:
```js
    ${govRating.rfGov<1?`
    <div style="margin-bottom:14px;padding:10px 14px;background:#fee2e2;border:1px solid #fca5a5;border-radius:6px">
      <strong style="color:#991b1b">⚠ Load Posting — MBE §6A.8</strong><br/>
      <div style="margin-top:4px;font-size:9pt">Posting per MBE Eq. 6A.8.3-1 from each legal vehicle's own legal-load rating (MBE 6A.4.4; its own MIDAS result case, legal γ<sub>LL</sub> per MBE Table 6A.4.4.2.3a-1). Rated vehicle (${idxEsc(ratingVehicleName||'Rated Vehicle')}, ${ratingVehicleTon||36} T): RF × W = ${govRating.rfTons.toFixed(1)} T (rating tonnage, not a posting).</div>
      ${(legalPosting||[]).map(x=>{
        const v=x.v, w=v&&v.opWk, f2=t=>Math.abs(+t||0).toFixed(2);
        if(!v) return `<div style="margin-top:6px;font-size:9.5pt"><strong>${idxEsc(x.label)} (${x.W} T):</strong> not computed — no MIDAS result case assigned to this vehicle.</div>`;
        const eqR=`RF = \\frac{C-\\gamma_{DC}\\,DC-\\gamma_{DW}\\,DW}{\\gamma_{LL}\\,s\\,LL} = \\frac{${(+w.C).toFixed(1)}-${gamDC}\\times ${f2(w.DC)}-${gamDW}\\times ${f2(w.DW)}}{${v.gamLLop}\\times ${(+w.s).toFixed(4)}\\times ${f2(w.LL)}} = ${w.rf!=null?w.rf.toFixed(3):'—'}`;
        const eqP=x.st==='post'?`\\text{Posting} = \\frac{W}{0.7}\\,[RF-0.3] = \\frac{${x.W}}{0.7}\\times(${x.RF.toFixed(3)}-0.3) = ${x.P.toFixed(1)}\\ \\text{T}`:'';
        const res={post:`Posting = ${x.P!=null?x.P.toFixed(1):''} T (MBE Eq. 6A.8.3-1)`, ok:'RF ≥ 1.0: no posting for this vehicle',
          close:'RF ≤ 0.3: Eq. 6A.8.3-1 does not apply; consider closing the bridge (MBE 6A.8.3)',
          lfr:'posting not computed: Eq. 6A.8.3-1 is an LRFR provision; LFR posting (MBE Section 6B or owner method) is not implemented',
          cat:`posting not computed: the vehicle is rated as ${idxEsc(v.category)}, not Legal`}[x.st];
        return `<div style="margin-top:6px;font-size:9.5pt"><strong>${idxEsc(x.label)} (${x.W} T):</strong> ${idxEsc(v.posLC)}, ${w.act==='M+'?'M⁺':w.act==='M-'?'M⁻':'V'} at node ${v.opNode} (x = ${v.opPos.toFixed(2)} ft), ${idxEsc(v.category)}, γ<sub>LL</sub> = ${v.gamLLop}, RF = ${x.RF.toFixed(3)}
          <table class="cr-wk"><tbody><tr><td>${idxTex(eqR,true)}</td></tr>${eqP?`<tr><td>${idxTex(eqP,true)}</td></tr>`:''}</tbody></table>
          <div><strong>${res}</strong></div></div>`;
      }).join('')}
    </div>`:''}` : ''}
```
6. **`IDX_REFS_MBE`**: the AASHTO MBE row as quoted above.

#### Check cases (synthetic MIDAS rows, the D11 harness: 4 × 20.25 ft, manual zone Mn⁺ 900, Mn⁻ 700 ft·k, Vn 220 k, φc = φs = φ = 1, LRFR Strength I Inventory, γDC 1.25, γDW 1.50, ADTT 5000)
- **A. The D11 4-span check case as is** (HL-93 truck + tandem selected, only the HL-93 result cases): HL-93 RF = 0.895 (M⁻, node 131).
  - Before: report 22.4 / 35.8 / 32.2 T (0.895 × 25 / 40 / 36); app 32.2 / 32.2 / 32.2 T (RF 1.289 "✓ Adequate" / 0.806 / 0.895).
  - After: Type 3, 3-3, 3S2 "— · not computed — no MIDAS result case" (app and report); rated-vehicle card 32.2 T "RF × W, not a posting" (unchanged value).
- **B. Same model with Legal Type 3, 3-3 and 3S2 selected and their own result cases** (`AASHTO Legal Type 3_L1(max)/(min)` etc.; legal trucks have DLA 0 in the MCT, so IM 33 % is applied in their rating: s = 1.33; γLL = 1.45 at ADTT 5000). Every truck governs in M⁻ at node 131 (x = 60.75 ft): C = 1 × 1 × 1 × 700.0 = 700.0 ft·k, DC = 36.91, DW = 7.69 ft·k; numerator = 700.0 − 1.25 × 36.91 − 1.50 × 7.69 = 700.0 − 46.14 − 11.54 = 642.33.
  - Type 3-3 (W = 40 T), LL = 384.44 ft·k: RF = 642.33 / (1.45 × 1.33 × 384.44) = 642.33 / 741.39 = **0.866**; Posting = (40/0.7) × (0.866 − 0.3) = 57.14 × 0.566 = **32.3 T**.
  - Type 3 (W = 25 T), LL = 307.56: RF = 642.33 / 593.13 = **1.083** ≥ 1.0 → **no posting**.
  - Type 3S2 (W = 36 T), LL = 1025.17: RF = 642.33 / 1977.04 = **0.325**; Posting = (36/0.7) × (0.325 − 0.3) = 51.43 × 0.025 = **1.3 T**.
  - Before (this case; the HL-93 RF here is 0.673 because the synthetic case name "LL(max)" is not traceable to one vehicle, so the rating applies IM conservatively — `mctCarriesImpact`, unchanged): app 24.2 / 24.2 / 24.2 T (RF 0.969 / 0.606 / 0.673); report 16.8 / 26.9 / 24.2 T. Multi-Vehicle table identical before and after (Type 3 / 3-3 / 3S2 Op RF 1.083 / 0.866 / 0.325, γLL 1.45).
- **C. LFR Operating, 2 spans 40 + 50 ft, legal trucks with their own cases** (HL-93 RF 0.381): before app 13.7 T for all three, report 9.5 / 15.2 / 13.7 T. After: no tonnage, "not computed — LFR"; RFs worked, e.g. Type 3: (1500.0 − 1.3 × 224.69 − 1.3 × 67.41)/(1.3 × 0.7980 × 629.84) = 1.715.
- **D. 3 spans 30/36/30, global DLA 0, quick-calc zone, Poor condition, Operating** (HL-93 only, RF 0.591): before report 14.8 / 23.6 / 21.3 T, app 21.3 T for all three; after "not computed — no MIDAS result case".

#### How verified
- `node tests/check-syntax.mjs index.html`: all 7 scripts pass (JSX transpiled).
- `node tests/compare.mjs --tool page --file index.html`: page.text and page.storage identical (only the usual Babel "deoptimised styling" note on both sides).
- Main vs branch, headless Chromium, same sibling files, six cases (built-in default with no results, A, B, C, D, and C with the HL-93 RF ≥ 1 so no box shows), each imported through "⬇ Import JSON": compared the text of every AASHTO Rating sub-tab (Inputs, Summary, Multi-Vehicle, D/C, Service II, Fatigue, PS Strength I, PS Service III, Report Card), the AREMA Rating, Results and Generate steps, every table cell, tile value and the MCT block of Generate Report, Print AREMA Report, the `bridgeSuite.v1.handoffs` / `demandsKind` payloads written by both design hand-off buttons, and all localStorage. **Only** the posting box text (Inputs & Setup sub-tab and the report) and the report's MBE references row differ; every RF, table, payload and stored key is identical. 0 console errors.
- Report posting box rendered from the saved report HTML (KaTeX CSS loaded) and looked at; in-app box screenshot looked at; the "Worked in … Multi-Vehicle" link switches to the Multi-Vehicle sub-tab.
- **Saved data:** none changed. `mct_cfg_v3` (incl. `rating.vehicleLCMap`), `mct_results_*`, the JSON export and every `bridgeSuite.v1.*` key/payload are untouched (compared). The new `opWk` / `p` / `sc` fields and `legalPosting` live in memory only (the Multi-Vehicle CSV writes explicit columns, unchanged).
- **Other copies:** none (rating code is specific to this tool; the shared `bridgeSuite.v1.*` blocks are not touched).

#### Open items (not changed)
- **Auto-detect can map Type 3 to the wrong case.** The auto-populate effect and "↺ Auto-detect LCs" use `lc.includes(vn)`; "AASHTO Legal Type 3" is a prefix of "AASHTO Legal Type 3-3" and "…3S2", so when a 3-3 or 3S2 case comes first in the pasted results, Type 3 is rated (and now posted) with the other truck's forces. The worked line shows the case used. Matching `vn + '_'` (as `mctCarriesImpact` does) is a result change: engineer to decide.
- **Which posting vehicles.** The box covers the three trucks it listed before. SU4–SU7 (and EV2/EV3) are in the library and rated in Multi-Vehicle but are not posted here. Add them?
- **LFR posting** is not computed (MBE Section 6B / owner method). Which rule?
- **Owner conventions** (rounding, minimum posting, single vs per-vehicle sign, Service II for steel at legal loads): none are cited in the tool. Owner to confirm.
- **When the box shows:** still only when the rated vehicle's governing RF < 1. A legal truck with RF < 1 while the rated vehicle passes is visible in Multi-Vehicle but gets no posting box.
- **Edition:** MBE edition unstated in the tool (verify against the printed edition in use).

## 2026-10-19 — PR: claude/index-legal-match (PR link added after merge)

### Vehicle → MIDAS result-case auto-detect matches whole vehicle names (Tier 2: result change in one module)
- **Problem (open item 1 of the claude/index-posting entry; engineer approved the fix 2026-10-19):** the auto-detect that maps each selected vehicle to its MIDAS result cases (`vehicleLCMap`, AASHTO Rating → Multi-Vehicle) used `lc.includes(vn)`. "AASHTO Legal Type 3" is a prefix of "AASHTO Legal Type 3-3" and "AASHTO Legal Type 3S2" (and "WORKCONSIST-I" of "-II", "-III", "-IV"), so when the pasted results list a 3-3 or 3S2 case before the Type 3 case, Type 3 got the other truck's case. It was then rated, and since claude/index-posting also posted, with the other truck's forces. The error can go either way: the 3-3 forces are larger in the check case below (posting too low), but a shorter truck's forces would make it unconservative.
- **Where:** new functions `idxLcIsVehicle(lc, vn)` and `idxVehicleLCs(loadedLCs, vn)` after `function idxLegalPosting` (anchor `function idxLcIsVehicle(lc, vn){`). Used at the two places that had the substring match, both in `StepResults`:
  1. the auto-populate effect (anchor `// Auto-populate vehicleLCMap when rows or selected vehicles change`), and
  2. the "↺ Auto-detect LCs" button on the Multi-Vehicle tab (anchor `// Re-run auto-detection, clearing manual overrides`).
  No other place matches vehicle names inside case names this way. `mctCarriesImpact` already matches `vn + '_'`, longest name first, and is unchanged.
- **Case names:** the MCT writes `*MVLDCASE NAME=<vehicle>_<lane>` (`${v.name}_${safeLaneName}`). MIDAS returns the moving-load results under that name with a "(max)" / "(min)" / "(all)" tag, which the tool already uses to group cases (`groupedLCs`). After the vehicle name comes "_" (or "(", a space, or the end of the name).
- **Rule:** the case belongs to vehicle `vn` when its name **equals** `vn`, or `vn` occurs in it with the **next character not `[0-9A-Za-z-]`**. The vehicle's cases keep their order in the pasted results, except that an exact-name case comes first. The max/min choice is as before: the first case containing "(max)"/"max" (else the first case) for LL Max, and the first containing "(min)"/"min" for LL Min.
- **Hand-set mappings are kept:** the auto-populate effect still fills a vehicle's case only when `existing.posLC` is empty, and LL Min only when `existing.negLC` is undefined (unchanged lines). "↺ Auto-detect LCs" still clears overrides when clicked, as before. It now uses the whole-name match.
- **Before (effect):**
```js
        const posLC = existing.posLC || (
          loadedLCs.find(lc=>lc.includes(vn)&&(lc.includes('(max)')||lc.includes('max')))
          || loadedLCs.find(lc=>lc.includes(vn))
        );
        const negLC = existing.negLC !== undefined ? existing.negLC : (
          loadedLCs.find(lc=>lc.includes(vn)&&(lc.includes('(min)')||lc.includes('min'))) || ''
        );
```
- **After (effect):**
```js
        const vLCs = idxVehicleLCs(loadedLCs, vn);   // whole-name match (Type 3 ≠ Type 3-3)
        const posLC = existing.posLC || (
          vLCs.find(lc=>lc.includes('(max)')||lc.includes('max'))
          || vLCs[0]
        );
        const negLC = existing.negLC !== undefined ? existing.negLC : (
          vLCs.find(lc=>lc.includes('(min)')||lc.includes('min')) || ''
        );
```
- **Before ("↺ Auto-detect LCs" button):**
```js
                      const posLC = loadedLCs.find(lc=>lc.includes(vn)&&(lc.includes('(max)')||lc.includes('max')))
                                 || loadedLCs.find(lc=>lc.includes(vn));
                      const negLC = loadedLCs.find(lc=>lc.includes(vn)&&(lc.includes('(min)')||lc.includes('min')));
```
- **After (button):**
```js
                      const vLCs = idxVehicleLCs(loadedLCs, vn);   // whole-name match (Type 3 ≠ Type 3-3)
                      const posLC = vLCs.find(lc=>lc.includes('(max)')||lc.includes('max'))
                                 || vLCs[0];
                      const negLC = vLCs.find(lc=>lc.includes('(min)')||lc.includes('min'));
```
- **New code:**
```js
function idxLcIsVehicle(lc, vn){
  if (typeof lc!=='string' || !vn) return false;
  if (lc===vn) return true;
  for (let i=lc.indexOf(vn); i>=0; i=lc.indexOf(vn,i+1)){
    const c = lc.charAt(i+vn.length);
    if (c==='' || !/[0-9A-Za-z-]/.test(c)) return true;
  }
  return false;
}
// Cases of vehicle vn in loadedLCs (order kept), the exact-name case first.
function idxVehicleLCs(loadedLCs, vn){
  const m = (loadedLCs||[]).filter(lc=>idxLcIsVehicle(lc,vn));
  return [...m.filter(lc=>lc===vn), ...m.filter(lc=>lc!==vn)];
}
```
- **§4 callout:** no formula, factor, unit or code reference changes. Only *which result case* a vehicle is auto-assigned changes, and that changes that vehicle's Multi-Vehicle RF and its posting. The provisions involved are unchanged: MBE 6A.4.4 (legal-load rating, Table 6A.4.4.2.3a-1) and MBE 6A.8.3, Eq. 6A.8.3-1 (posting). Edition: verify (the tool states none).
- **Name collisions in the vehicle library** (every `name:` checked against every other): "AASHTO Legal Type 3" ⊂ "…Type 3-3", "…Type 3S2"; "WORKCONSIST-I" ⊂ "WORKCONSIST-II", "-III", "-IV"; "WORKCONSIST-II" ⊂ "WORKCONSIST-III". All are prefixes followed by "-", "S", "I" or "V", so the new rule rejects them all. Unit test of `idxLcIsVehicle` (13 cases, all pass): "AASHTO Legal Type 3" matches "…Type 3_Lane 1(max)", "…Type 3", "…Type 3(max)" and does not match "…Type 3-3_Lane 1(max)" or "…Type 3S2_Lane 1(max)". "WORKCONSIST-I" does not match "WORKCONSIST-II_L(max)". "Type EV2" does not match "Type EV23_L". "AASHTO Posting load SU4" does not match "…SU45_L". "HL-93TRK" matches "HL-93TRK_Lane 1(max)" and "HL-93TRK Lane 1 (max)".

#### Check case: the pasted results list Type 3-3 and 3S2 before Type 3
Model as in the claude/index-posting check case B: 4 × 20.25 ft, Mn⁻ 700 ft·k, φc = φs = φ = 1, LRFR Strength I, γDC 1.25, γDW 1.50, ADTT 5000 → legal γLL 1.45, s = 1.33. Legal Type 3 / 3-3 / 3S2 are selected, and the results are pasted in the order 3-3, 3S2, Type 3. All govern in M⁻ at node 131: C = 700.0, DC = 36.91, DW = 7.69 ft·k; numerator = 700.0 − 1.25 × 36.91 − 1.50 × 7.69 = 642.33.
- **Before:** Type 3 → "AASHTO Legal Type 3-3_L1(max)" / "(min)" (the first case containing "AASHTO Legal Type 3"), so LL = 384.44 (the 3-3 forces). RF = 642.33 / (1.45 × 1.33 × 384.44) = 642.33 / 741.39 = **0.866**. Posting = (25/0.7) × (0.866 − 0.3) = 35.71 × 0.566 = **20.2 T**. Multi-Vehicle: 0.866, 21.7 T.
- **After:** Type 3 → "AASHTO Legal Type 3_L1(max)" / "(min)", LL = 307.56. RF = 642.33 / (1.45 × 1.33 × 307.56) = 642.33 / 593.13 = **1.083** ≥ 1.0 → **no posting**. Multi-Vehicle: 1.083, 27.1 T. This is the same as when Type 3 is pasted first.
- Type 3-3 (0.866 → 32.3 T) and Type 3S2 (0.325 → 1.3 T) are unchanged.

#### Saved data
- No key or format change: `mct_cfg_v3.rating.vehicleLCMap` keeps its shape.
- **A saved project can hold a wrong mapping.** An auto-detected mapping is stored in `vehicleLCMap` exactly like a hand-set one (nothing marks it as automatic), and the effect never overwrites a stored `posLC`. A project saved by an earlier build with the 3-3 / 3S2 case first therefore keeps Type 3 on the wrong case after this fix, until the engineer clicks "↺ Auto-detect LCs" or picks the case by hand. This shows on the Multi-Vehicle tab ("LL Result Case" column) and in the posting box's worked line (case name).
- **Proposed migration (not implemented, engineer to decide).** It would run once on opening, without overwriting silently. For each selected vehicle whose stored `posLC` (or `negLC`) fails `idxLcIsVehicle(case, vn)` but whole-matches another selected vehicle whose name starts with `vn`, while a case that whole-matches `vn` exists in the results:
  - show a notice on the Multi-Vehicle tab, e.g. "Type 3 is mapped to 'AASHTO Legal Type 3-3_L1(max)', a Type 3-3 case (auto-detect before 2026-10-19). Use 'AASHTO Legal Type 3_L1(max)'?", with one button to re-map;
  - or re-map automatically and list what changed in the notice.
  - A deliberate hand-set cross-mapping cannot be told apart from an old auto-detect, which is why a confirm button is proposed rather than a silent change.

#### How verified
- `node tests/check-syntax.mjs index.html`: all 7 scripts pass.
- `node tests/compare.mjs --tool page --file index.html`: page.text and page.storage identical (only the usual Babel note on both sides).
- Main (f35f938) vs branch, headless, same sibling files, eight cases with the claude/index-posting readout (every AASHTO Rating sub-tab, AREMA, Results, Generate, report tables/tiles/MCT/posting box, AREMA report, `bridgeSuite.v1.*` hand-off payloads, all localStorage):
  - Built-in default, the 4-span check case, check case + legal trucks (Type 3 first), LFR with legal trucks (box shown), LFR with legal trucks (no box), 3-span quick-calc/IM: **all identical**.
  - **Reordered results (3-3, 3S2 before Type 3):** only Type 3's mapping and its results differ. These are the Multi-Vehicle row (case, RF 0.866 → 1.083, tons 21.7 → 27.1), the posting card and worked line (20.2 T → no posting), the report posting box, and `mct_cfg_v3.rating.vehicleLCMap["AASHTO Legal Type 3"].posLC/negLC` (3-3 cases → Type 3 cases). Everything else is identical, including the `bridgeSuite.v1.*` payloads.
  - **Hand-set mapping kept:** the reordered case with `vehicleLCMap["AASHTO Legal Type 3"]` saved pointing at the 3-3 cases gives identical results (the stored mapping is not touched).
    - One run showed `bridgeSuite.v1.migrated.stgirder` present on main and absent on the branch: a timing artifact of the embedded ST-Girder page, with the sibling files identical on both sides. A re-run was all identical.
- **Other copies:** none. The shared `bridgeSuite.v1.*` blocks are not touched.

#### Open items
- The saved-project migration above (engineer to decide).
- **"↺ Auto-detect LCs" drops category and γLL (pre-existing, not changed).** The button writes `{posLC, negLC}` only, so a vehicle's stored category and γLL are dropped. Until the auto-populate effect runs again (new results, vehicle selection, limit state, method or ADTT), `multiVehicleData` falls back to category "Design" and the rating-level γLL. A legal truck is then rated, and its posting reported as "not computed — rated as Design", at the design γLL. Keep category/γLL in the button (a result change)? Engineer to decide.

## 2026-10-19 — PR: claude/index-legal-remap (PR link added after merge)

### Notice and "Re-map" for result cases stored by the old auto-detect (Tier 1: display + user-initiated change)
- **Problem (saved-data item of the claude/index-legal-match entry; engineer approved the proposed fix 2026-10-19):** a project saved before the whole-name match can hold `vehicleLCMap["AASHTO Legal Type 3"].posLC/negLC` = a Type 3-3 or 3S2 case. The auto-detect never overwrites a stored case, so after the fix such a project still rates and posts Type 3 with the other truck's forces. An old auto-detected mapping cannot be told apart from a deliberate hand-set one, so nothing is changed silently.
- **What it does:**
  - **Detection.** When the project has results, flag each selected vehicle whose stored `posLC` / `negLC` meets all three conditions:
    - (a) it is not this vehicle's case (`idxLcIsVehicle` fails);
    - (b) it is the case of another selected vehicle whose name is longer and starts with this vehicle's name;
    - (c) a case of this vehicle itself exists in the results (`idxVehicleLCs` not empty).
  - **Proposal.** The proposed case is the one the auto-detect would choose now: LL Max = the first own case containing "(max)"/"max", else the first own case; LL Min = the first own case containing "(min)"/"min", else "same as max".
  - **Notice.** "⚠ Result case mapped to another vehicle" is shown at the top of the Multi-Vehicle tab and just above the posting box (AASHTO Rating → Inputs & Setup, under the RF chart). It lists each vehicle as `LL Max: "stored" → "proposed"` and `LL Min: …`.
  - **Re-map** writes only `posLC` / `negLC` of the listed vehicles. The rest of each entry is spread over unchanged, so `category`, `gamLLinv`, `gamLLop` and `customGam` are kept.
  - **Dismiss** hides the notice for this session (React state only). It shows again on the next load.
  - Nothing is written until Re-map is clicked.
- **Not flagged:** a cross-mapping when the vehicle has no case of its own in the results (deliberate use of another truck's case), and a case of an unrelated vehicle (no name prefix).
- **Storage:** no new key, no format change. Re-map writes the existing `mct_cfg_v3.rating.vehicleLCMap` through the existing `setVehicleLCMap`.
- **§4:** no formula, factor, unit or code reference changes. Results change only when the engineer clicks Re-map, and then they are the results of the vehicle's own case (MBE 6A.4.4 legal-load rating, MBE 6A.8.3 Eq. 6A.8.3-1 posting; edition: verify).
- **Where:**
  1. `StepResults`, inserted just before `// ── Multi-vehicle rating table ────` (anchor `// ── Old auto-detected mappings (2026-10-19)`):
```jsx
  // ── Old auto-detected mappings (2026-10-19) ──────────────────────────────
  // Before the whole-name match (idxLcIsVehicle), the auto-detect could store a longer-named
  // vehicle's case for a vehicle (e.g. Type 3 → "AASHTO Legal Type 3-3_…"), and a stored case is
  // never overwritten. Flag a stored posLC / negLC that is not this vehicle's case but is the case
  // of a selected vehicle whose name starts with this one, when this vehicle's own case exists.
  // Display only: nothing changes until the engineer clicks "Re-map" (keeps category and γLL).
  const [lcRemapDismissed, setLcRemapDismissed] = useState(false);
  const lcRemap = useMemo(()=>{
    const sel = cfg?.selectedVehicles||[];
    if (!origRows.length || !sel.length) return [];
    const loadedLCs = [...new Set(origRows.map(r=>r.load))];
    const out = [];
    sel.forEach(vn=>{
      const a = vehicleLCMap[vn]; if (!a) return;
      const own = idxVehicleLCs(loadedLCs, vn);
      if (!own.length) return;
      const other = lc => sel.some(o=>o!==vn && o.length>vn.length && o.startsWith(vn) && idxLcIsVehicle(lc,o));
      const bad = lc => !!lc && !idxLcIsVehicle(lc,vn) && other(lc);
      const r = { vn, label:(ALL_VEHICLES.find(v=>v.name===vn)||{}).label||vn };
      if (bad(a.posLC)) { const p = own.find(lc=>lc.includes('(max)')||lc.includes('max')) || own[0]; if (p!==a.posLC) r.pos = [a.posLC, p]; }
      if (bad(a.negLC)) { const n = own.find(lc=>lc.includes('(min)')||lc.includes('min')) || ''; if (n!==a.negLC) r.neg = [a.negLC, n]; }
      if (r.pos || r.neg) out.push(r);
    });
    return out;
  },[origRows, vehicleLCMap, JSON.stringify(cfg?.selectedVehicles)]);
  const applyLcRemap = () => setVehicleLCMap(prev=>{
    const next = {...prev};
    lcRemap.forEach(r=>{ next[r.vn] = {...(prev[r.vn]||{}),            // category, γLL, customGam kept
      ...(r.pos?{posLC:r.pos[1]}:{}), ...(r.neg?{negLC:r.neg[1]}:{}) }; });
    return next;
  });
  const lcRemapNotice = (lcRemap.length>0 && !lcRemapDismissed) ? (
    <div data-idx-remap="1" style={{background:'#fffbeb',border:'2px solid #f59e0b',borderRadius:'8px',padding:'10px 14px',marginBottom:'14px',fontSize:'11px',fontFamily:'monospace',color:'#92400e'}}>
      <div style={{fontSize:'12.5px',fontWeight:'700',marginBottom:'4px'}}>⚠ Result case mapped to another vehicle</div>
      <div style={{marginBottom:'6px'}}>These vehicles use a case of a vehicle whose name starts with theirs (auto-detect before 2026-10-19). Their RF and posting use the other vehicle's forces until re-mapped:</div>
      {lcRemap.map(r=>(
        <div key={r.vn} style={{marginLeft:'8px'}}>
          <strong>{r.label}</strong>
          {r.pos&&<div style={{marginLeft:'12px'}}>LL Max: "{r.pos[0]}" → "{r.pos[1]}"</div>}
          {r.neg&&<div style={{marginLeft:'12px'}}>LL Min: "{r.neg[0]}" → "{r.neg[1]||'— same as max —'}"</div>}
        </div>
      ))}
      <div style={{display:'flex',gap:'8px',marginTop:'8px'}}>
        <button onClick={applyLcRemap} style={{background:'#f59e0b',border:'none',borderRadius:'5px',color:'#fff',padding:'5px 14px',cursor:'pointer',fontSize:'12px',fontWeight:'600'}}>Re-map</button>
        <button onClick={()=>setLcRemapDismissed(true)} style={{background:'#fff',border:'1px solid #fcd34d',borderRadius:'5px',color:'#92400e',padding:'5px 14px',cursor:'pointer',fontSize:'12px'}}>Dismiss</button>
      </div>
    </div>
  ) : null;
```
  2. Just above the posting box. Before:
```jsx
          {/* ── Posting Check ── */}
```
     After:
```jsx
          {lcRemapNotice}
          {/* ── Posting Check ── */}
```
  3. Top of the Multi-Vehicle sub-tab. Before:
```jsx
            {ratingSubTab==='table'&&(<div>
```
     After:
```jsx
            {ratingSubTab==='table'&&(<div>
              {lcRemapNotice}
```

#### Check case: old-style saved project
Model as in the claude/index-posting check case B: Mn⁻ 700, γLL 1.45, s = 1.33. Results are pasted in the order 3-3, 3S2, Type 3, and the saved `vehicleLCMap["AASHTO Legal Type 3"]` = `{posLC: "AASHTO Legal Type 3-3_L1(max)", negLC: "AASHTO Legal Type 3-3_L1(min)", category: "Legal", γLL 1.45, customGam: true}`. Numerator = 700.0 − 1.25 × 36.91 − 1.50 × 7.69 = 642.33.
- **On open:** the notice lists Legal Type 3: LL Max "AASHTO Legal Type 3-3_L1(max)" → "AASHTO Legal Type 3_L1(max)", LL Min "…3-3_L1(min)" → "…Type 3_L1(min)". It appears on the Multi-Vehicle tab and above the posting box. Type 3 still uses the 3-3 forces: RF = 642.33 / (1.45 × 1.33 × 384.44) = 0.866 → posting (25/0.7) × 0.566 = 20.2 T (same as main).
- **Re-map:** the stored cases become the Type 3 cases, with category Legal, γLL 1.45 and customGam true unchanged. RF = 642.33 / (1.45 × 1.33 × 307.56) = **1.083** → **no posting**. The notice disappears.
  - Same project with an engineer-typed γLL 1.40: after Re-map γLL stays 1.40 and RF = 642.33 / (1.40 × 1.33 × 307.56) = 1.122.
- **Dismiss:** the notice hides; `vehicleLCMap` is unchanged (still the 3-3 cases) and Type 3 stays 0.866 / 20.2 T.

#### How verified
- `node tests/check-syntax.mjs index.html`: all 7 scripts pass.
- `node tests/compare.mjs --tool page --file index.html`: page.text and page.storage identical (only the usual Babel note on both sides).
- Headless, branch only (clicking the buttons): the old-style project above shows the notice on both tabs; Re-map and Dismiss behave as described (stored map read back from `mct_cfg_v3`); the γLL 1.40 variant keeps 1.40. 0 console errors.
- **Deliberate cross-map not flagged:** Type 3 and 3-3 are selected, the results hold only 3-3 cases, and Type 3 is stored on the 3-3 cases. No notice; identical to main.
- **Main (a12f566) vs branch** with the claude/index-posting readout (every AASHTO Rating sub-tab, AREMA, Results, Generate, reports, `bridgeSuite.v1.*` hand-off payloads, all localStorage), ten cases:
  - Correct or absent mappings: built-in default, 4-span check case, check case + legal trucks, LFR with legal trucks (box / no box), 3-span quick-calc/IM, reordered results, cross-map with no own case. **All identical.**
  - The two stored-wrong-mapping cases (old-style project; Type 3 → 3-3 with own cases present): the only difference is the 7 notice lines on Inputs & Setup and Multi-Vehicle. With those lines removed the text is identical. `mct_cfg_v3` and the payloads are identical: nothing changes until Re-map.
  - Some runs differed in keys written by the embedded ST-Girder / PS-Beam pages (`bridgeSuite.v1.migrated.stgirder`, `bridgeSuite.v1.appPaths.stgirder`, `psbeam.inputs.v1`, `bridgeSuite.v1.psSection`) or in the order of the hand-off keys (same values). These differences moved between sides and between runs (sibling files identical), and a re-run cleared them. They are timing artifacts, not this change.
- **Other copies:** none. The shared `bridgeSuite.v1.*` blocks are not touched.

#### Open items
- The "↺ Auto-detect LCs" button still drops category and γLL (pre-existing, see the claude/index-legal-match entry). Re-map does not use it.


## 2026-10-19 — PR: claude/stgirder-disconnect-others (STDISC: ST-Girder removed from the bridge suite on the other tools' side; engineer decision 2026-10-19; cross-tool PR with index.html, psbeam.html, lldf.html, Bridge Substructure Loading.html, tools.html, HANDOFF.md, AUDIT.md, CLAUDE.md §3; ST-Girder's side is claude/stgirder-disconnect; PR link added after merge)

### STDISC. MCT Generator: ST-Girder embed and steel demands hand-off removed; ST-Girder capacity no longer received, saved ST-Girder zones kept as flagged manual zones   [no result change: ratings identical; Tier 1]
- **Engineer decision (2026-10-19):** ST-Girder (`stgirder.html`) is completely disconnected from every other bridge tool except GirderDetail (`Steel Bridge Beam Modules.html`): no MIDAS / MCT demands into ST-Girder, MCT's steel rating no longer uses ST-Girder's capacity (it falls back to MCT's own capacity inputs), ST-Girder removed from MCT's combined saved project, no ST-Girder links in the other tools; Substructure Loading reactions from GirderDetail are a later, separate change. CLAUDE.md §3 updated: the shared bootstrap block is now in index.html, lldf.html and psbeam.html only.
- **Engineer decision (2026-10-19, on review of this PR):** a saved ST-Girder capacity zone is NOT reset; it becomes an ordinary MCT manual zone with the same numbers, flagged "formerly from ST-Girder (<date/project>), no longer updated — check and edit as needed"; ratings stay exactly as before. (The first version of this branch replaced it by MCT's default 500 / 500 / 150 zone; that was withdrawn before merge.)
- **Shared bootstrap block (CLAUDE.md §3; changed identically in index.html, psbeam.html, lldf.html):** the `stgirder` entries are removed from `BridgeApps` `DEF` and `NAMES`, `BridgeLocks` `APPS` and `LOG_APPS`; the comments now say the block is byte-identical in the three files ("edit all three"), the project registry lists slices `{mct,psbeam,lldf}` (older projects may still hold a `stgirder` slice; nothing reads it), the app-path note drops "PS-Beam opens stgirder.html in a tab", the demands-channel note reads "MCT -> PS-Beam" and the `drives()` note "any app may publish capacity; MCT and PS-Beam for geometry". Nothing else in the block changed. Effects: `BridgeApps.register/set` no longer accept `stgirder` (only ST-Girder registered itself; its reduced record in stgirder.html still writes `appPaths.stgirder`, and every other app keeps that entry when it writes the object back, so GirderDetail's open-now still finds ST-Girder); `BridgeApps.all()` and the sync drawer no longer list ST-Girder; an old `syncLog.stgirder` shard is no longer merged into the change log. Verified byte-identical: `diff` of the BridgeBeam script and of the big block between the three files shows only each file's own `BridgeApps.boot('<app>')` line, as before.
- **Removed / changed in index.html:**
  - `function buildSteelBeamExport` (anchor `// Steel-beam export — same force-effect demands as the PS-Beam export, PLUS`): the steelbeam demands payload for ST-Girder. `publishToDesign` builds `buildPSBeamExport` only, targets PS-Beam only (`target='psbeam'`), drops the "no section makeup" steel warning, and stores `demandsKind='psbeam'`; `demandsKind()` always returns `'psbeam'` (a stored `'steel'` from before, or a lock taken by ST-Girder, no longer sends steel demands); the demands lock log texts name PS-Beam only.
  - Sidebar "Design Hand-off": the `{k:'steel', label:'Composite Steel Design App'}` button is removed (PS-Beam's stays).
  - Embedded apps: `EMBED_META.stgirder`, the "ST-Girder →" switch button in the embedded-app bar, `EmbedTrouble` `NAMES.stgirder` and the `embedApp` comment.
  - Texts: "Save to Bridge Project (shared with PS-Beam / LLDF)", "One project shared across MCT, PS-Beam and LLDF", the PS-Beam combos button title ("required by the PS-Beam design module"), "re-send it from PS-Beam to restore", the handoff comment ("the design app psbeam.html").
  - **Capacity (MCT steel rating):** `capFromST(p)` (new, module scope): a `bridge-design-capacity` payload with `producer` "ST-Girder" (or `producerFile` stgirder.html) is not offered ("Design capacity received" banner) and not adopted under a capacity lock (`checkCapFeed` returns before the token / lock test). `capDropST(zones, where)` (new): a saved zone `{type:'design', producer:'ST-Girder'}` becomes `{...zone, type:'manual', fromST:{producer, producedAt, project, memberKey}, MnPos, MnNeg, Vn}`: every field is kept (span `startX`/`endX`, the per-station `stations` table φMn⁺/φMn⁻/φVn/Sx/fServLim, `Fy`, `basis`, …); `MnPos`/`MnNeg`/`Vn` are pre-filled with the table's smallest φMn⁺, |φMn⁻|, φVn for the manual inputs. Applied where saved zones are loaded: the initial state from `mct_cap_zones_v1`, Import JSON (bundle `ratingCapZones`) and a restored History entry. `capZoneTab(z)` (new) = a design zone, or a manual zone with `fromST` that still has its table; `capAt()` (Strength), the Service II block (`zDes`) and the fatigue block (`zDesF`) use `capZoneTab(z)` where they used `z.type==='design'`, so the kept zone is interpolated exactly as before (φ already included, rating φf/φv neutralized). `updateCapZone`: entering Mn⁺, Mn⁻ or Vn on such a zone drops its table (`stations:null`), after which the values entered govern like any manual zone. The zone card shows the flag (`stCapFlag`: "formerly from ST-Girder (G3, sent 2026-09-03 12:00, project "Old bridge"), no longer updated — check and edit as needed") and says whether the table is still used; the printed report's capacity-zone table adds the same flag. A notice (key `mct_stcap_notice_v1`, until "Dismiss"): "⚠ Capacity from ST-Girder is no longer updated (engineer decision 2026-10-19). ST-Girder is now connected to GirderDetail only, so MCT no longer receives its capacity. Capacity zones that came from ST-Girder were kept with the same values as MCT manual zones (ratings unchanged); check and edit them in AASHTO Rating as needed:" + one line per zone ("… The values were kept: it is now an ordinary MCT manual zone with the same numbers (the same per-station table over the same span, so the rating is unchanged), flagged …"). Zones fed by PS-Beam, and every other zone type, are unchanged.
- **Saved data (CLAUDE.md §5):** `mct_cap_zones_v1`, exported bundles and History entries keep their format; an ST-Girder design zone keeps all its fields and gains `fromST` (additive) with `type` 'manual'. Opened in an older MCT, such a zone would rate as a plain manual zone with the pre-filled minima (older builds do not know `fromST`). New key `mct_stcap_notice_v1` (tool-prefixed). `bridgeSuite.v1.demandsKind` may still hold `'steel'`; it is ignored. Shared projects keep any `stgirder` slice (not read, not deleted).
- **§4 callout:** no formula, factor, unit or code reference changed, and no rating result changes. Governing provision as before: AASHTO MBE 3rd Ed. 6A.4.2.1, RF = (C − γ_DC·DC − γ_DW·DW) / (γ_LL·(LL+IM)). In a zone kept from ST-Girder, C = φc·φs·φf·(φMn(x)/φf) = φc·φs·φMn(x) interpolated from the same table, before and after. Worked check (one node, φc = φs = φf = 1.0, Inventory γ_DC = 1.25, γ_DW = 1.50, γ_LL = 1.75; DC = 1500, DW = 200, LL+IM = 1000 ft·k; table φMn⁺ = 5000 ft·k): before RF = (5000 − 1875 − 300)/1750 = **1.614**; after **1.614** (unchanged). The only change is that the zone is now manual (flagged) and can be edited; once the engineer enters Mn⁺, Mn⁻ or Vn, those values govern.
- **How verified:** `node tests/check-syntax.mjs index.html psbeam.html lldf.html "Bridge Substructure Loading.html" tools.html` (all pass); `node tests/compare.mjs --tool page --file <each>` against main (bcbd913): psbeam, lldf, SubLoads and tools storage identical, page text differs only by the removed ST-Girder controls and the reworded ST-Girder mentions (psbeam: the "ST-Girder ↗" button; lldf: the "ST ↗" button and the self-weight notes; tools: the ST-Girder card), no console errors; index.html with a longer load timeout (scratch script): page text identical apart from the removed "🅢 Composite Steel Design App ↗" hand-off button, no console errors, the embedded-app bar lists only "PS-Beam →" / "LL & DL"; a saved ST-Girder capacity zone is replaced and the notice shown, a PS-Beam zone kept; lldf with an old ST-Girder `lldfGeom`: nothing offered; SubLoads with old ST-Girder copies: "Pull from PS-Beam" lists only PS-Beam, the short note is shown, no new-data marker for ST-Girder. ST-Girder's own checks: branch claude/stgirder-disconnect.
- **Rating equivalence check (scratch script, main 6e641a1 vs branch):** the default 4-span MCT model with synthetic unfactored DC / DW / LL+ / LL− results imported as a JSON bundle together with a capacity zone from ST-Girder (6 stations, φMn⁺ 1500–2250, φMn⁻ 1200–1650 ft·k, φVn 300–400 kip): main keeps it as a design zone, the branch converts it; every number on the AASHTO Rating Summary (governing Inventory RF 0.407 at N107, 12.15 ft, M⁻; the per-node RF table), Multi-Vehicle, Demand vs. Cap, Service II, Fatigue and Report Card sub-tabs is identical; the Inputs sub-tab differs only by the design-zone card's range display; the branch zone is `type:'manual'` with `fromST` and the 6-station table, and shows the flag and the notice. `node tests/check-syntax.mjs index.html`: pass.
- **Other files (same PR):** tools.html (the ST-Girder card reads "Connected to GirderDetail only (demands from Steel Bridge Beam Modules); not linked to the MCT, PS-Girder, LL &amp; DL or Substructure tools."; tools.html has no fix log of its own), HANDOFF.md (channel table, note under it, §3.7, §4.2–§4.4), AUDIT.md (§1.2, §1.3 and a note), CLAUDE.md §3.
- **Open items:** none.
- **Diff (main → branch, `git diff -U0`; runs of more than 30 deleted lines and hunks that only delete are summarised by their first and last line):**
```diff
diff --git a/index.html b/index.html
index 4402d55..4d6f8bd 100644
--- a/index.html
+++ b/index.html
@@ -45,2 +45,3 @@
-     This block is byte-identical in index.html / psbeam.html / stgirder.html /
-     lldf.html — edit it in one place and copy it to the other three.
+     This block is byte-identical in index.html / psbeam.html / lldf.html — edit
+     it in one place and copy it to the other two. (ST-Girder, stgirder.html, left
+     the suite on 2026-10-19 and no longer carries it.)
@@ -120 +121,2 @@ var st=document.createElement('style'); st.textContent=css;
-     analysis app (this file) and the two design apps (psbeam.html, stgirder.html).
+     analysis app (this file) and the design app psbeam.html (ST-Girder, stgirder.html,
+     no longer reads it: engineer decision 2026-10-19).
@@ -235 +237 @@ var st=document.createElement('style'); st.textContent=css;
-     four apps; each app owns a "slice". Same-origin localStorage; identical in
+     three apps; each app owns a "slice". Same-origin localStorage; identical in
@@ -237 +239,2 @@ var st=document.createElement('style'); st.textContent=css;
-     Keys: bridgeSuite.v1.projects  { id:{name,savedAt,slices:{mct,psbeam,stgirder,lldf},demands} }
+     Keys: bridgeSuite.v1.projects  { id:{name,savedAt,slices:{mct,psbeam,lldf},demands} }
+           (projects saved before 2026-10-19 may also hold a "stgirder" slice; no app reads it now)
@@ -301,3 +304,2 @@ var st=document.createElement('style'); st.textContent=css;
-   The four apps link to each other by bare file name: MCT embeds "psbeam.html"
-   in an iframe, PS-Beam opens "stgirder.html" in a tab, every app's back link
-   points at "index.html". That works only while each file is named exactly what
+   The three apps link to each other by bare file name: MCT embeds "psbeam.html"
+   in an iframe, every app's back link points at "index.html". That works only while each file is named exactly what
@@ -321,2 +323,3 @@ var st=document.createElement('style'); st.textContent=css;
-   This block is byte-identical in index.html / psbeam.html / stgirder.html /
-   lldf.html. Edit one, edit all four.
+   This block is byte-identical in index.html / psbeam.html / lldf.html. Edit
+   one, edit all three. (ST-Girder left the suite on 2026-10-19; stgirder.html
+   keeps only a reduced app-path record of its own, which GirderDetail reads.)
@@ -326,2 +329,2 @@ var st=document.createElement('style'); st.textContent=css;
-  var DEF={mct:'index.html', psbeam:'psbeam.html', stgirder:'stgirder.html', lldf:'lldf.html'};
-  var NAMES={mct:'MCT Generator', psbeam:'PS-Beam', stgirder:'ST-Girder', lldf:'LL & DL Distribution'};
+  var DEF={mct:'index.html', psbeam:'psbeam.html', lldf:'lldf.html'};
+  var NAMES={mct:'MCT Generator', psbeam:'PS-Beam', lldf:'LL & DL Distribution'};
@@ -496 +499 @@ try{ window.BridgeApps.boot('mct'); }catch(e){}
-   Lock state is shared across all four apps — locking the distribution-factor
+   Lock state is shared across all three apps — locking the distribution-factor
@@ -507 +510 @@ try{ window.BridgeApps.boot('mct'); }catch(e){}
-   This block is byte-identical in all four apps. Edit it in one place and
+   This block is byte-identical in all three apps. Edit it in one place and
@@ -548 +551,2 @@ try{ window.BridgeApps.boot('mct'); }catch(e){}
-    /* The analysis hand-off, MCT -> the two design apps. `key` is the whole
+    /* The analysis hand-off, MCT -> PS-Beam (ST-Girder no longer reads it,
+       2026-10-19). `key` is the whole
@@ -560 +564 @@ try{ window.BridgeApps.boot('mct'); }catch(e){}
-  var APPS={mct:'MCT', psbeam:'PS-Beam', stgirder:'ST-Girder', lldf:'LL & DL'};
+  var APPS={mct:'MCT', psbeam:'PS-Beam', lldf:'LL & DL'};
@@ -591 +595 @@ try{ window.BridgeApps.boot('mct'); }catch(e){}
-     (PS-Beam and ST-Girder for capacity; MCT and both design apps for
+     (any app may publish capacity; MCT and PS-Beam for
@@ -635 +639 @@ try{ window.BridgeApps.boot('mct'); }catch(e){}
-  var LOG_APPS=['mct','psbeam','stgirder','lldf'];
+  var LOG_APPS=['mct','psbeam','lldf'];
-2074,110 +2077,0  [deleted 110 lines: first "// ─────────────────────────────────────────────────────────────────────────────" ... last ""]
@@ -8155 +8049 @@ function StepCombos({cfg,set}) {
-        title="Sets the load combinations required by the PS-Beam and ST-Girder design modules: HL-93 truck + tandem at 33% impact, plus passthrough combos (DC1, DC2, DW, LL) at factor 1.0. Replaces the vehicle selection and the psb_ combos; keeps your other combos."
+        title="Sets the load combinations required by the PS-Beam design module: HL-93 truck + tandem at 33% impact, plus passthrough combos (DC1, DC2, DW, LL) at factor 1.0. Replaces the vehicle selection and the psb_ combos; keeps your other combos."
@@ -11881 +11775,3 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-  const updateCapZone = (id, field, val) => setCapZones(capZones.map(z=>z.id===id?{...z,[field]:val}:z));
+  const updateCapZone = (id, field, val) => setCapZones(capZones.map(z=>z.id!==id?z:
+    // A manual zone kept from ST-Girder (STDISC): entering Mn+, Mn- or Vn replaces its station table by the values entered.
+    (z.fromST&&Array.isArray(z.stations)&&['MnPos','MnNeg','Vn'].includes(field))?{...z,[field]:val,stations:null}:{...z,[field]:val}));
@@ -11911 +11807 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-  // ── Design-app capacity zone: interpolate the per-station table published by PS-Beam / ST-Girder ──
+  // ── Design-app capacity zone: interpolate the per-station table published by PS-Beam ──
@@ -11932 +11828 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-    if (z.type==='design') {
+    if (capZoneTab(z)) {   // design-app zone, or a manual zone kept from ST-Girder with its station table (STDISC)
@@ -11980 +11876 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-  // ── Design-app capacity feed (PS-Beam / ST-Girder → this rating) ──────────
+  // ── Design-app capacity feed (PS-Beam → this rating; ST-Girder's capacity is no longer used, 2026-10-19) ──
@@ -12001,0 +11898,2 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
+      // ST-Girder's capacity is not offered or adopted (engineer decision 2026-10-19, fixlog/index.md STDISC).
+      if(capFromST(p)){ setCapFeed(null); return; }
@@ -12406 +12304 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-      const zDes  = z&&z.type==='design' ? designCapAt(z,xPos) : null;   // per-node Sx/Fy from the design app
+      const zDes  = capZoneTab(z) ? designCapAt(z,xPos) : null;   // per-node Sx/Fy from the design app
@@ -12498 +12396 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-      const zDesF  = z&&z.type==='design' ? designCapAt(z,xPos) : null;  // per-node Sx from the design app
+      const zDesF  = capZoneTab(z) ? designCapAt(z,xPos) : null;  // per-node Sx from the design app
@@ -13347,3 +13245,4 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-  // the sidebar design buttons (publishToDesign) now build the SAME payload via
-  // buildPSBeamExport / buildSteelBeamExport, publish it to shared storage, and open the
-  // embedded design app. Each design app also keeps its own Import JSON for portable files.
+  // the sidebar design button (publishToDesign) now builds the SAME payload via
+  // buildPSBeamExport, publishes it to shared storage, and opens the embedded PS-Beam app.
+  // PS-Beam also keeps its own Import JSON for portable files. (The steel-beam payload for
+  // ST-Girder was removed on 2026-10-19: ST-Girder takes demands from GirderDetail only.)
@@ -14598 +14497 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-                      <button onClick={()=>{ if(window.confirm('Revert to a manual capacity zone? The design-app station data is discarded (re-send it from PS/ST to restore).')) setCapZones([{...defaultCapZone(), startX:0, endX:z.endX}]); }}
+                      <button onClick={()=>{ if(window.confirm('Revert to a manual capacity zone? The design-app station data is discarded (re-send it from PS-Beam to restore).')) setCapZones([{...defaultCapZone(), startX:0, endX:z.endX}]); }}
@@ -14602 +14501,5 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-                  :z.type==='manual'?(
+                  :z.type==='manual'?(<div>
+                    {z.fromST&&<div style={{fontSize:'10.5px',color:'#92400e',lineHeight:1.55,background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'5px',padding:'7px 10px',marginBottom:'8px'}}>
+                      <b>{stCapFlag(z.fromST)}.</b>
+                      {capZoneTab(z)?<span> The rating still uses the per-station table this zone held ({z.stations.length} stations, interpolated linearly; φ already included, so the rating φ<sub>f</sub>/φ<sub>v</sub> are neutralized for this zone). Mn⁺, Mn⁻ and Vn below show its smallest values; entering one of them replaces the table by the values entered.</span>:<span> Its station table was replaced by the values entered below.</span>}
+                    </div>}
@@ -14612 +14515 @@ function StepResults({ cfg, set, setStep, mctOutput, rows: origRows, setRows, ra
-                  ):(
+                  </div>):(
@@ -20291 +20194 @@ function generateReportHTML({ cfg, mctOutput, rows, nodePositions, ratingData,
-            <td>${z.type==='quickcalc'?`Fy=${z.Fy}ksi Zx+=${z.ZxPos} Zx-=${z.ZxNeg} Aw=${z.Aw}`:'Manual'}${cap._basis?`<br/><span style="font-size:8pt;color:#6b7280">Mn⁺ ${cap._basis.pos} · Mn⁻ ${cap._basis.neg} · Vn ${cap._basis.v}</span>`:''}${(cap._warn||[]).map(w=>`<br/><span style="font-size:8pt;color:#b91c1c">⚠ ${w}</span>`).join('')}</td>
+            <td>${z.type==='quickcalc'?`Fy=${z.Fy}ksi Zx+=${z.ZxPos} Zx-=${z.ZxNeg} Aw=${z.Aw}`:'Manual'}${z.fromST?`<br/><span style="font-size:8pt;color:#92400e">${stCapFlag(z.fromST)}${capZoneTab(z)?'; per-station table kept':''}</span>`:''}${cap._basis?`<br/><span style="font-size:8pt;color:#6b7280">Mn⁺ ${cap._basis.pos} · Mn⁻ ${cap._basis.neg} · Vn ${cap._basis.v}</span>`:''}${(cap._warn||[]).map(w=>`<br/><span style="font-size:8pt;color:#b91c1c">⚠ ${w}</span>`).join('')}</td>
@@ -20597 +20500 @@ function SavesModal({ cfg, onLoad, onClose,
-      if (entry.ratingCapZones && setRatingCapZones) setRatingCapZones(entry.ratingCapZones);
+      if (entry.ratingCapZones && setRatingCapZones) setRatingCapZones(capDropST(entry.ratingCapZones,'Restored history entry'));
@@ -21033 +20936 @@ function EmbedTrouble({app,name,health,onUse,onClose}){
-  const NAMES={mct:'the MCT Generator', psbeam:'PS-Beam', stgirder:'ST-Girder', lldf:'LL & DL Distribution'};
+  const NAMES={mct:'the MCT Generator', psbeam:'PS-Beam', lldf:'LL & DL Distribution'};
@@ -21080,0 +20984,36 @@ function EmbedTrouble({app,name,health,onUse,onClose}){
+/* ST-Girder capacity (engineer decisions 2026-10-19, fixlog/index.md STDISC). MCT no longer receives capacity
+   from ST-Girder: such a payload is not offered or adopted (capFromST). A saved capacity zone fed by ST-Girder
+   (type 'design', producer 'ST-Girder') becomes an ordinary MCT manual zone that KEEPS every value it held
+   (same span, the per-station phiMn+ / phiMn- / phiVn table and all other fields), flagged z.fromST
+   ("formerly from ST-Girder, no longer updated"). capZoneTab() treats it exactly like the design zone, so the
+   rating is unchanged; Mn+ / Mn- / Vn are pre-filled with the table's smallest values, and editing one of
+   them drops the table (the values entered then govern). Each conversion is listed in a notice kept in
+   mct_stcap_notice_v1 until it is dismissed. Zones fed by PS-Beam are unchanged. */
+const MCT_STCAP_KEY='mct_stcap_notice_v1';
+function capFromST(p){ return !!(p&&(p.producer==='ST-Girder'||p.producerFile==='stgirder.html')); }
+function stCapRead(){ try{ const a=JSON.parse(localStorage.getItem(MCT_STCAP_KEY)||'[]'); return Array.isArray(a)?a:[]; }catch(e){ return []; } }
+function stCapAdd(notes){ if(!notes||!notes.length) return;
+  try{ localStorage.setItem(MCT_STCAP_KEY,JSON.stringify(stCapRead().concat(notes))); }catch(e){}
+  try{ window.dispatchEvent(new Event('mct-stcap')); }catch(e){} }
+/* The zone interpolates a per-station capacity table: a design-app zone, or a manual zone kept from ST-Girder. */
+function capZoneTab(z){ return !!z&&(z.type==='design'||(z.type==='manual'&&!!z.fromST&&Array.isArray(z.stations)&&z.stations.length>0)); }
+function stCapFlag(f){ f=f||{}; return 'formerly from ST-Girder'+[f.memberKey,f.producedAt?'sent '+String(f.producedAt).slice(0,16).replace('T',' '):'',f.project?'project "'+f.project+'"':''].filter(Boolean).map((t,i)=>(i?', ':' (')+t).join('')+(f.memberKey||f.producedAt||f.project?')':'')+', no longer updated \u2014 check and edit as needed'; }
+function capDropST(zones,where){
+  if(!Array.isArray(zones)||!zones.some(z=>z&&z.type==='design'&&capFromST(z))) return zones;
+  const notes=[];
+  const out=zones.map((z,i)=>{
+    if(!(z&&z.type==='design'&&capFromST(z))) return z;
+    const st=Array.isArray(z.stations)?z.stations:[], n=st.length;
+    const mn=(k,abs)=>n?Math.min.apply(null,st.map(s=>abs?Math.abs(+s[k]||0):(+s[k]||0))):0;
+    const fromST={producer:z.producer||'ST-Girder', producedAt:z.producedAt||'', project:z.project||'', memberKey:z.memberKey||''};
+    notes.push((where?where+': ':'')+'capacity zone '+(i+1)+' ('+(+z.startX||0)+' to '+(+z.endX||0)+' ft) held the \u03c6Mn / \u03c6Vn envelope from ST-Girder'
+      +(z.memberKey?' ('+z.memberKey+')':'')+(z.producedAt?', sent '+String(z.producedAt).slice(0,16).replace('T',' '):'')+', '+n+' station'+(n===1?'':'s')
+      +'. The values were kept: it is now an ordinary MCT manual zone with the same numbers (the same per-station table over the same span, so the rating is unchanged), flagged \u201c'+stCapFlag(fromST)+'\u201d.');
+    // every field kept; only the type changes and the provenance flag is added
+    return {...z, type:'manual', fromST,
+      MnPos:+mn('phiMn_pos').toFixed(1), MnNeg:+mn('phiMn_neg',true).toFixed(1), Vn:+mn('phiVn').toFixed(1)};
+  });
+  stCapAdd(notes);
+  return out;
+}
+
@@ -21111 +21050 @@ function App() {
-  const [embedApp,setEmbedApp]=useState(null);                  // null | 'lldf' | 'psbeam' | 'stgirder'
+  const [embedApp,setEmbedApp]=useState(null);                  // null | 'lldf' | 'psbeam'
@@ -21265,2 +21204 @@ function App() {
-    psbeam:{title:'PS-Beam · Prestressed Concrete Girder Design',color:'#0e7490'},
-    stgirder:{title:'ST-Girder · Composite Steel Plate Girder Design',color:'#3b4a5a'} };
+    psbeam:{title:'PS-Beam · Prestressed Concrete Girder Design',color:'#0e7490'} };
@@ -21320 +21258,4 @@ function App() {
-  const [ratingCapZones,    setRatingCapZones]      = useState(()=>{ try { const s=localStorage.getItem('mct_cap_zones_v1'); return s?JSON.parse(s):[]; } catch(e){ return []; }});
+  const [ratingCapZones,    setRatingCapZones]      = useState(()=>{ try { const s=localStorage.getItem('mct_cap_zones_v1'); return s?capDropST(JSON.parse(s)):[]; } catch(e){ return []; }});
+  // STDISC (2026-10-19): notice for capacity zones from ST-Girder replaced on load (kept until dismissed)
+  const [stCapNotes,setStCapNotes]=useState(()=>stCapRead());
+  useEffect(()=>{ const h=()=>setStCapNotes(stCapRead()); window.addEventListener('mct-stcap',h); return ()=>window.removeEventListener('mct-stcap',h); },[]);
@@ -21381 +21322 @@ function App() {
-    const name=window.prompt('Save to Bridge Project (shared with PS-Beam / ST-Girder / LLDF):', suggested);
+    const name=window.prompt('Save to Bridge Project (shared with PS-Beam / LLDF):', suggested);
@@ -21505 +21446 @@ function App() {
-    // MCT, PS-Beam and ST-Girder can all publish geometry. Only the app
+    // MCT and PS-Beam can both publish geometry. Only the app
@@ -21626,2 +21567,3 @@ function App() {
-            setRatingCapZones(loaded.ratingCapZones);
-            try{localStorage.setItem('mct_cap_zones_v1',JSON.stringify(loaded.ratingCapZones));}catch(e){}
+            const capZ=capDropST(loaded.ratingCapZones,'Imported file '+file.name);
+            setRatingCapZones(capZ);
+            try{localStorage.setItem('mct_cap_zones_v1',JSON.stringify(capZ));}catch(e){}
@@ -21716,2 +21658,3 @@ function App() {
-  // Reuses the SAME builders as the JSON export (buildPSBeamExport / buildSteelBeamExport). The design
-  // apps read it from localStorage on load (banner-prompted). JSON export/import stays as the fallback.
+  // Reuses the SAME builder as the JSON export (buildPSBeamExport). PS-Beam reads it from localStorage
+  // on load (banner-prompted). JSON export/import stays as the fallback. Since 2026-10-19 there is no
+  // steel flavour: ST-Girder takes demands from GirderDetail only (fixlog/index.md STDISC).
@@ -21722,2 +21665,2 @@ function App() {
-    const target = kind==='steel' ? 'stgirder' : 'psbeam';
-    const targetName = kind==='steel' ? 'ST-Girder' : 'PS-Beam';
+    const target = 'psbeam';
+    const targetName = 'PS-Beam';
@@ -21742 +21685 @@ function App() {
-      const payload = kind==='steel' ? buildSteelBeamExport(args) : buildPSBeamExport(args);
+      const payload = buildPSBeamExport(args);
@@ -21748,5 +21691,3 @@ function App() {
-      const noZones = kind==='steel' && !(payload.section&&payload.section.zones&&payload.section.zones.length);
-      const mustConfirm = warns.some(w=>w.startsWith('LIVE LOAD')) || noZones;
-      if(warns.length || noZones){
-        const extra = noZones ? '\n\n• No section makeup found — enable the section library (Sections tab) so the steel app receives plate dimensions.' : '';
-        const msg='Design hand-off warnings:\n\n• '+(warns.join('\n\n• ')||'(none)')+extra+(mustConfirm?'\n\nSend anyway?':'');
+      const mustConfirm = warns.some(w=>w.startsWith('LIVE LOAD'));
+      if(warns.length){
+        const msg='Design hand-off warnings:\n\n• '+(warns.join('\n\n• ')||'(none)')+(mustConfirm?'\n\nSend anyway?':'');
@@ -21771 +21712 @@ function App() {
-        try{ localStorage.setItem('bridgeSuite.v1.demandsKind',kind); }catch(e){}
+        try{ localStorage.setItem('bridgeSuite.v1.demandsKind','psbeam'); }catch(e){}
@@ -21773 +21714 @@ function App() {
-        if(!silent) openEmbed(kind==='steel' ? 'stgirder' : 'psbeam');
+        if(!silent) openEmbed('psbeam');
@@ -21921,12 +21862,3 @@ function App() {
-  const demandsKind=()=>{
-    // Which design app a locked republish should build for. If the lock was
-    // taken from one of the design apps, that app's own choice wins -- locking
-    // from ST-Girder means "keep ST-Girder fed". Otherwise use whichever
-    // flavour was last sent from here.
-    try{
-      const i=BL&&BL.lockInfo('demands');
-      if(i&&i.by==='stgirder') return 'steel';
-      if(i&&i.by==='psbeam')   return 'psbeam';
-      return localStorage.getItem('bridgeSuite.v1.demandsKind')||'psbeam';
-    }catch(e){ return 'psbeam'; }
-  };
+  // Which design app a locked republish builds for: PS-Beam only since 2026-10-19 (a stored
+  // 'steel' kind from before, when ST-Girder was fed from here, is no longer used).
+  const demandsKind=()=>'psbeam';
@@ -21949 +21881 @@ function App() {
-          text:'republished analysis demands to '+(k==='steel'?'ST-Girder':'PS-Beam')});
+          text:'republished analysis demands to PS-Beam'});
@@ -21963 +21895 @@ function App() {
-        text:'auto-send ON \u2014 '+(k==='steel'?'ST-Girder':'PS-Beam')+' now follows this analysis'
+        text:'auto-send ON \u2014 PS-Beam now follows this analysis'
@@ -22092,3 +22024,2 @@ function App() {
-          {[{k:'psbeam',label:'Prestressed Concrete Beam Design',icon:'🅿',accent:'#0e7490',light:'#ecfeff',border:'#a5f3fc'},
-            {k:'steel', label:'Composite Steel Design App',       icon:'🅢',accent:'#3b4a5a',light:'#f1f5f9',border:'#cbd5e1'}].map(b=>{
-            const appId=b.k==='steel'?'stgirder':'psbeam';
+          {[{k:'psbeam',label:'Prestressed Concrete Beam Design',icon:'🅿',accent:'#0e7490',light:'#ecfeff',border:'#a5f3fc'}].map(b=>{
+            const appId='psbeam';
@@ -22184 +22115 @@ function App() {
-                  <span>Bridge Project</span><span title="One project shared across MCT, PS-Beam, ST-Girder and LLDF">shared ⇄</span></div>
+                  <span>Bridge Project</span><span title="One project shared across MCT, PS-Beam and LLDF">shared ⇄</span></div>
@@ -22255,0 +22187,12 @@ function App() {
+            {stCapNotes.length>0&&(
+              <div style={{margin:'0 0 14px',padding:'10px 14px',borderRadius:'8px',border:'1px solid #fde68a',
+                borderLeft:'4px solid #d97706',background:'#fffbeb',fontSize:'12px',color:'#92400e',lineHeight:1.5}}>
+                <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
+                  <b>⚠ Capacity from ST-Girder is no longer updated (engineer decision 2026-10-19)</b>
+                  <button onClick={()=>{ try{ localStorage.removeItem(MCT_STCAP_KEY); }catch(e){} setStCapNotes([]); }} style={{marginLeft:'auto',background:'#fff',border:'1px solid #fcd34d',
+                    borderRadius:'5px',color:'#92400e',padding:'3px 10px',cursor:'pointer',fontSize:'11px'}}>Dismiss</button>
+                </div>
+                <div style={{marginTop:'4px'}}>ST-Girder is now connected to GirderDetail only, so MCT no longer receives its capacity. Capacity zones that came from ST-Girder were kept with the same values as MCT manual zones (ratings unchanged); check and edit them in AASHTO Rating as needed:</div>
+                <ul style={{margin:'6px 0 0 18px'}}>{stCapNotes.map((t,i)=><li key={i}>{t}</li>)}</ul>
+              </div>
+            )}
@@ -22290 +22233 @@ function App() {
-            {['lldf','psbeam','stgirder'].filter(a=>a!==embedApp).map(a=>(
+            {['lldf','psbeam'].filter(a=>a!==embedApp).map(a=>(
@@ -22294 +22237 @@ function App() {
-                {a==='lldf'?'LL & DL':a==='psbeam'?'PS-Beam':'ST-Girder'} →</button>))}
+                {a==='lldf'?'LL & DL':'PS-Beam'} →</button>))}
```
- **tools.html diff:** see fixlog/Bridge Substructure Loading.md (same PR), last hunk.
