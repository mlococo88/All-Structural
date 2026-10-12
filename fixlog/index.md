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
