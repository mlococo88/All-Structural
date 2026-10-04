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
