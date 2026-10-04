# Fix log — Concrete Anchor.html

Governing basis used for fixes: ACI 318-19 Chapter 17 (cast-in anchors), Table 19.2.4.1 (λ); plate check is the tool's existing simplified cantilever (not AISC DG1).

Units in this tool: lb, psi, in, lb-in.

## 2026-10-04 — PR: claude/fix-concrete-anchor (PR link added after merge)

The engineer asked for this tool to be **fixed fully**. The engine (everything between `// --- CONSTANTS ---` and `// --- COMPONENTS ---`) was rewritten; the full new engine block is reproduced verbatim in **Appendix A** so it can be re-applied to a fresh copy by replacing that block. The UI edits are listed individually in F23–F29 with exact before/after code.

Sign convention (now documented in the UI, Loads section): +x → Right edge (c3), +y → Top edge (c2), edge distances measured from the outermost anchors. +Nua = tension. +Vux acts toward c3, +Vuy acts toward c2. +Mux puts the top (+y) anchors in tension; +Muy puts the right (+x) anchors in tension.

### Worked example (full) — 4-anchor 3/4" F1554-36 group, h_ef = 8 in, f'c = 4000 psi

Inputs: 2×2 group, s_x = s_y = 6 in; c1 (left) = 6, c2 (top) = 10, c3 (right) = 24, c4 (bottom) = 24 in; normalweight (w_c = 150), cracked, Condition B, not seismic, heavy-hex head; N_ua = 6000 lb, M_ux = 30,000 lb-in, M_uy = 0, V_ux = −3000 lb (toward c1), V_uy = 0; plate t = 0.75 in, l_x = 2 in. New inputs at their defaults: h_a = 24 in, ψ_c,V edge reinforcement = none, plate F_y = 36,000 psi, b_eff = 4 in.

Anchor forces (unchanged elastic distribution): N/4 = 1500; M_x/(2s_y) = 2500 → top anchors 4000 lb each, bottom anchors −1000 lb. N_max = 4000 lb. Tension anchors = top row (2), ΣN_ua,g = 8000 lb.

| Limit state | Before (origin/main) | After (this PR) | Hand check of "after" |
|---|---|---|---|
| Steel tension φN_sa (per anchor) | 19,218 lb (A = 0.7854·0.75² = 0.4418, f_ut 58,000) → 4000/19,218 = **0.208** | 14,529 lb → **0.275** | 0.75 × 0.334 × min(58,000, 1.9·36,000, 125,000) = 0.75 × 0.334 × 58,000 = 14,529 |
| Tension breakout φN_cbg | A_Nc = 24×28 = 672 (all anchors), ψ_ec = 1/(1+2·5/24) = 0.706 (e'_N = M/N = 5), ψ_ed = 0.85 → N_cbg 24,042, φ 16,830; demand N_ua = 6000 → **0.357** | A_Nc = (6+6+12)×(12+10) = 24×22 = 528 (tension row only), A_Nco = 576, ψ_ec = 1.0 (e'_N = 0, both tension anchors equal), ψ_ed = 0.7+0.3·6/12 = 0.85, N_b = 34,346 → N_cbg 26,761, φ 18,733; demand 8000 → **0.427** | N_b = 24·√4000·8^1.5 = 24 × 63.246 × 22.627 = 34,346; 528/576 × 0.85 × 34,346 = 26,761; ×0.70 = 18,733; 8000/18,733 = 0.427 |
| Pullout φN_pn | 11,340 → **0.353** | 11,340 → **0.353** | 0.70 × 8 × (0.9·0.75²) × 4000 = 11,340 (unchanged) |
| Side-face blowout | not applicable (h_ef 8 ≤ 2.5·6) | not applicable | — |
| Steel shear φV_sa (per anchor, V/4 = 750) | 9993 → **0.075** | 7555 → **0.099** | 0.65 × 0.6 × 0.334 × 58,000 = 7555 |
| Shear breakout φV_cbg (toward c1, c_a1 = 6) | V_b(a) = 8541 only; A_Vc = (3·6 + s_x 6) × 9 = 216, A_Vco = 162 → V_cbg 11,388, φ 7972 → **0.376** | V_b = min(8541, 8366) = 8366; A_Vc = (s_y 6 + min(9, 24) + min(9, 10)) × min(9, h_a 24) = 24 × 9 = 216; ψ_ed,V = 1.0 (c_a2 = 10 ≥ 9); ψ_h,V = 1.0; ψ_c,V = 1.0 → V_cbg 11,154, φ 7808 → **0.384** | V_b(b) = 9 × 63.246 × 6^1.5 = 9 × 63.246 × 14.697 = 8366; 216/162 × 8366 = 11,154; ×0.70 = 7808; 3000/7808 = 0.384 |
| Pryout φV_cpg | 2 × N_cb(tension calc, incl. ψ_ec 0.706) × 0.70 = 33,659 → **0.089** | N_cpg from all 4 anchors: A_Nc 24×28 = 672, ψ_ed 0.85, ψ_ec = 1 → 34,060; φV_cpg = 0.70 × 2 × 34,060 = 47,684 → **0.063** | 672/576 × 0.85 × 34,346 = 34,060 |
| Plate t_req (b_eff 4, F_y 36,000) | 0.497 in → DCR **0.663** | 0.497 in → DCR **0.663** | √(4·4000·2/(0.9·36,000·4)) = 0.497 |
| Interaction | 0.357 + 0.376 = 0.733 ≤ 1.2 (no 0.2 cut-offs) | N 0.427, V 0.384 (both > 0.2) → 0.811 ≤ 1.2 (§17.8.3); all individual ≤ 1.0 → **OK** | — |

Net effect for this example: more conservative (breakout tension demand and A_se govern), pryout less conservative (see F21).

Other check cases (all run in node from the actual file; scripts in the session scratchpad `ca/runold.js`, `ca/runnew.js`, `ca/extra.js`, `ca/extra2.js`, `ca/smoke.js`):

- **DEFAULTS** (tool's default inputs: h_ef 6, all c = 12, s = 6, N 5000, M_x 1000, V_x 2000): before utilN 0.184, utilV 0.101, sum 0.286; after utilN 0.184 (breakout unchanged: all four anchors in tension so e'_N = M/N = 0.2 and ΣT = N), steel tension 0.092 (was 0.069), shear breakout φV_cbg 12,422 (was 19,728: V_b(b), b = s_y + 2·min(18,12) = 30 instead of 42, ψ_ed,V = 0.9) → utilV 0.161; V ≤ 0.2 so §17.8.1 → governing 0.184 ≤ 1.0, OK.
- **EX2 (side-face blowout at a corner):** 1" F1554-36, h_ef = 18, c1 = 4, c2 = 6, c3 = c4 = 30, s = 8, N = 20,000 (5000/anchor), no moment. Before: φN_sb = 0.70·160·4·√0.9·√4000 = 26,880 vs per-bolt 5000 → 0.186. After: left edge governs, c_a1 = 4, c_a2 = 6 → corner factor (1 + 6/4)/4 = 0.625; N_sb = 160·4·√0.9·1.0·√4000·0.625 = 24,000; group (2 anchors along the edge, s = 8 < 24) 1 + 8/24 = 1.333 → N_sbg = 32,000, φ = 22,400; demand = the two left anchors = 10,000 → **0.446**. Tension breakout: N_b alternate 16·√4000·18^(5/3) = 125,104 > 24-form 115,918 (alternate governs, F11); ratio 20,000/35,749 = 0.560 (before 20,000/33,124 = 0.604).
- **EX5 (h_ef reduction, three near edges):** h_ef = 12, c1 = c2 = c3 = 6, c4 = 40, s = 8, N = 30,000. Before: φN_cbg = 17,449 → 1.719. After: h'_ef = max(6/1.5, 8/3) = 4.0; A_Nco = 144; A_Nc = 20 × 20 = 400; ψ_ed = 1.0 (6 ≥ 1.5·4); N_b = 24·√4000·4^1.5 = 12,143 → N_cbg = 400/144 × 12,143 = 33,731, φ 23,612 → **1.271** (still NG). **Less conservative by ~35% in capacity** (F10).

### F1. Steel strength uses A_se and f_uta = min(f_ut, 1.9f_ya, 125,000 psi)   [calc change] [more conservative]
- **Where:** function `calculateSteel` (≈ line 201) and new constant `ASE_TABLE` (≈ line 82). Anchor text: `const AseN = ASE_TABLE[da];`
- **Problem:** gross area 0.7854d_a² was used for N_sa and V_sa, overstating steel strength by ~30% (3/4": 0.442 vs 0.334 in²). f_ut was not capped.
- **Governing provision:** ACI 318-19 §17.6.1.2 (Eq. 17.6.1.2, A_se,N, f_uta ≤ min(1.9f_ya, 125,000 psi)); §17.7.1.2 (Eq. 17.7.1.2b, 0.6A_se,V f_uta).
- **Before:**
  ```js
  const calculateSteel = (da, gradeKey, N_max_bolt, V_per_bolt, seismic) => {
      const grade = STEEL_GRADES[gradeKey];
      const AseN = 0.7854 * Math.pow(da, 2); 
      const Nsa_single = AseN * grade.fut;
      const phi_steel = 0.75; 
      let phiNsa_single = phi_steel * Nsa_single * (seismic ? 0.75 : 1.0);
      const Vsa_single = 0.6 * AseN * grade.fut;
      const phi_shear_steel = 0.65;
      let phiVsa_single = phi_shear_steel * Vsa_single * (seismic ? 0.75 : 1.0);
  ```
- **After:**
  ```js
  const ASE_TABLE = { 0.5: 0.142, 0.625: 0.226, 0.75: 0.334, 0.875: 0.462, 1.0: 0.606 };
  ...
  const calculateSteel = (da, gradeKey) => {
      const grade = STEEL_GRADES[gradeKey];
      const AseN = ASE_TABLE[da];
      const futa = Math.min(grade.fut, 1.9 * grade.fy, 125000);   // §17.6.1.2
      const Nsa_single = AseN * futa;
      const phi_steel = 0.75; 
      const phiNsa_single = phi_steel * Nsa_single;
      const Vsa_single = 0.6 * AseN * futa;
      const phi_shear_steel = 0.65;
      const phiVsa_single = phi_shear_steel * Vsa_single;
  ```
  (full function incl. report strings in Appendix A)
- **Check case:** 3/4" F1554-36 → before φN_sa = 0.75·0.4418·58,000 = 19,218, φV_sa = 9993; after φN_sa = 0.75·0.334·58,000 = 14,529, φV_sa = 0.65·0.6·0.334·58,000 = 7555. f_uta: F1554-36 min(58,000, 68,400, 125,000) = 58,000; F1554-55 min(75,000, 104,500, 125,000) = 75,000; F1554-105 min(125,000, 199,500, 125,000) = 125,000 — the cap does not change any grade offered.
- **How verified:** node (runold.js / runnew.js), A_se values identical to BasePlateAnchorDesigner.html `ASE_TABLE`.
- **Other copies of this code:** BasePlateAnchorDesigner.html has its own `ASE_TABLE`/`futaOf` (not shared; unchanged).

### F2. Plate check uses a separate plate F_y (default 36 ksi) and a b_eff input (default 4 in)   [calc change] [more conservative for F1554-55/105 rods; no change for F1554-36]
- **Where:** function `calculateBasePlate` (≈ line 427); call in `computeAll`; inputs in the BASE PLATE CHECK box. Anchor text: `const calculateBasePlate = (N_max, lx, fy, t_actual, beff) => {`
- **Problem:** the plate was checked with the anchor-rod F_y (F1554-105 → 105 ksi plate). b_eff = 4 in was hard-coded. The rest of the simplified check (one cantilever l_x carrying N_max over width b_eff, t_req = √(4N_max l_x / (φF_y b_eff)), DCR = t_req/t) is kept as it was — it is not an AISC DG1 check (see O2).
- **Governing provision:** n/a (tool's simplified plastic-moment cantilever; φ_b = 0.9).
- **Before:**
  ```js
  const calculateBasePlate = (N_max, lx, fy, t_actual) => {
      if (N_max <= 0) return { val: {dcr:0}, tex: { eq: "N \\le 0", res: "OK" } };
      const beff = 4; const phi = 0.9;
      const treq = Math.sqrt( (4 * N_max * lx) / (phi * fy * beff) );
  ...
  const plate = calculateBasePlate(loads.val.N_max_bolt, plateLx, steel.val.fy, plateT);
  ```
- **After:**
  ```js
  const calculateBasePlate = (N_max, lx, fy, t_actual, beff) => {
      if (N_max <= 0) return { val: { treq: 0, dcr: 0 }, tex: { treq: { eq: "N_{max} \\le 0", res: "0", unit: "in" } } };
      const phi = 0.9;
      const treq = Math.sqrt( (4 * N_max * lx) / (phi * fy * beff) );
  ...
  const plate = calculateBasePlate(N_max_bolt, plateLx, plateFy, plateT, plateBeff);
  ```
  UI (BASE PLATE CHECK grid, after the Cantilever row):
  ```jsx
  <InputRow label="Plate Fy" value={inputs.plateFy} onChange={v=>update('plateFy',v)} unit="psi" />
  <InputRow label="Width (b_eff)" value={inputs.plateBeff} onChange={v=>update('plateBeff',v)} unit="in" />
  ```
  New saved keys `plateFy` (default 36000) and `plateBeff` (default 4.0).
- **Check case:** defaults (N_max 1333, l_x 2, t 0.5): F1554-36 before/after t_req 0.287/0.287; F1554-55 0.232 → 0.287; F1554-105 0.168 → 0.287 (DCR 0.336 → 0.574).
- **How verified:** node (extra.js §14).
- **Other copies of this code:** none known.

### F3. "Cond. B" checkbox bound to `condB`   [bug fix] [no result change at default]
- **Where:** SYSTEM section checkbox (≈ line 829). Anchor text: `checked={inputs.condB}`
- **Problem:** the checkbox read/wrote `conditionB`, but every calculation reads `condB` (default true). The box showed unchecked while Condition B was used, and toggling it did nothing.
- **Governing provision:** ACI 318-19 Table 17.5.3 (φ, Condition A/B).
- **Before:**
  ```jsx
  <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={inputs.conditionB} onChange={e=>update('conditionB',e.target.checked)}/> Cond. B (No Reinf)</label>
  ```
- **After:**
  ```jsx
  <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={inputs.condB} onChange={e=>update('condB',e.target.checked)}/> Cond. B (No Reinf) — breakout/blowout φ 0.70; unchecked = Cond. A 0.75</label>
  ```
- **Saved files:** `condB` is still the saved key. Old files load unchanged; a legacy `conditionB` key (written by old files only if someone clicked the dead box) is ignored with a load note, because it never affected results (see F25).
- **Check case:** defaults, condB = false → tension breakout φN_cbg 27,158 → 29,098 (×0.75/0.70), shear breakout 12,422 → 13,310; pullout 11,340 and pryout 55,523 unchanged (F4).
- **How verified:** node (extra.js §1); server-render smoke test.
- **Other copies of this code:** none.

### F4. Pullout and pryout φ = 0.70 always   [calc change] [no change at default; more conservative under Condition A]
- **Where:** `calculatePullout` (≈ line 306), `calculatePryout` (≈ line 436). Anchor text: `const phi = 0.70;   // Table 17.5.3: pullout is always Condition B`
- **Problem:** `const phi = condB ? 0.70 : 0.75;` gave 0.75 for pullout/pryout under Condition A.
- **Governing provision:** ACI 318-19 Table 17.5.3 — for cast-in anchors, pullout and pryout use Condition B (0.70) regardless of supplementary reinforcement.
- **Before:** `const phi = condB ? 0.70 : 0.75;` (both functions)
- **After:** `const phi = 0.70;` (both functions; `condB` is no longer a parameter of these two functions)
- **Check case:** defaults with condB = false: before (old engine) pullout 12,150 / pryout 58,196; after 11,340 / 55,523 (same as Condition B).
- **How verified:** node (extra.js §1).
- **Other copies of this code:** BasePlateAnchorDesigner.html has the pryout φ bug (0.75 with shear rebar) — not touched here.

### F5. Tension breakout demand = Σ forces on the anchors in tension   [calc change] [more conservative]
- **Where:** `distributeLoads` (≈ line 188, `const tens = …`, `sumT`) and `calculateBreakoutTension` (`const ratio = sumT / phiNcb;`).
- **Problem:** the breakout check compared the total N_ua with φN_cbg. Under moment the tension-anchor sum exceeds N_ua (EX1: 8000 vs 6000), and with net compression + moment N_ua ≤ 0, so breakout was never checked.
- **Governing provision:** ACI 318-19 §17.5.2 / Table 17.5.2 (φN_cbg ≥ N_ua,g, the total factored tension on the anchors in tension), §17.6.2.1.
- **Before:** `Nua/tBreak.val.phiNcb` (inside `utilN`)
- **After:**
  ```js
  const tens = anchors.filter(a => a.N > 1e-6);
  const sumT = tens.reduce((s, a) => s + a.N, 0);
  ...
  const ratio = sumT / phiNcb;
  ```
- **Check case:** EX1 → before 6000/16,830 = 0.357; after 8000/18,733 = 0.427. EX3 (N = −4000, M_x = 60,000, all c = 24, h_ef 8): before breakout ratio negative (not checked), after top anchors 4000 each, ΣT = 8000 → 8000/30,053 = 0.266.
- **How verified:** node.
- **Other copies of this code:** none.

### F6. A_Nc and ψ_ed,N from the anchors in tension; A_Nc ≤ n·A_Nco   [calc change] [usually more conservative; can be less conservative when the near edge is on the compression side]
- **Where:** `breakoutGroup` (≈ line 226). Anchor text: `const Anc = Math.min(AncGeom, n * Anco);`
- **Problem:** A_Nc used the whole 2×2 pattern even when only one row was in tension; no n·A_Nco cap; c_a,min was the smallest of c1..c4 regardless of which anchors were in tension.
- **Governing provision:** ACI 318-19 §17.6.2.1 / §17.6.2.1.1 (A_Nc = projected area of the anchors in tension, A_Nc ≤ nA_Nco), §17.6.2.4.1 (ψ_ed,N).
- **Before:**
  ```js
  const limit = 1.5 * hef;
  const w_x = Math.min(c1, limit) + (numAnchors > 1 ? sx : 0) + Math.min(c3, limit);
  const w_y = Math.min(c2, limit) + (numAnchors > 2 ? sy : 0) + Math.min(c4, limit);
  const Anc = w_x * w_y;
  ...
  const c_min = Math.min(c1, c2, c3, c4);
  ```
- **After:** (see `breakoutGroup`, Appendix A)
  ```js
  const d = { L: xmin - g.xL, R: g.xR - xmax, T: g.yT - ymax, B: ymin - g.yB };
  ...
  const w_x = Math.min(d.L, 1.5 * hefC) + (xmax - xmin) + Math.min(d.R, 1.5 * hefC);
  const w_y = Math.min(d.B, 1.5 * hefC) + (ymax - ymin) + Math.min(d.T, 1.5 * hefC);
  const AncGeom = w_x * w_y;
  const Anc = Math.min(AncGeom, n * Anco);                       // A_Nc <= n A_Nco
  ...
  const c_min = Math.min(...dl);
  ```
  where x/y min/max are over the tension anchors only.
- **Check case:** EX1 → before A_Nc 672, after 528. Cap: s_x = s_y = 40, h_ef 6, c = 50: A_Nc geometric 3364 > 4·324 = 1296 → 1296. **Less-conservative case:** h_ef 8, c1 = c2 = c3 = 24, c4 = 5 (near edge beside the compression row), N 6000, M_x 30,000: before ψ_ed = 0.825 with c4 = 5, ψ_ec = 0.706, demand 6000 → 0.358; after tension row is 11 in from c4 → ψ_ed = 0.975, ψ_ec = 1.0, demand 8000 → **0.285**. This is the ACI result (the bottom edge is outside the tension anchors' cone influence only partially), but it is lower than before.
- **How verified:** node.
- **Other copies of this code:** BasePlateAnchorDesigner.html builds A_Nc from all anchors (known bug, not copied).

### F7. e'_N per the ACI definition, per axis   [calc change] [less or more conservative depending on load]
- **Where:** `breakoutGroup`, block `if (useEcc) { … }`. Anchor text: `const psi_ecN = psi_ecx * psi_ecy;`
- **Problem:** e'_N = M_res/N_ua (whole-pattern load eccentricity, single resultant via hypot). ACI defines e'_N as the distance from the resultant tension of the tension-loaded anchors to the centroid of those anchors, applied per axis as a product.
- **Governing provision:** ACI 318-19 §17.6.2.3.1 (Eq. 17.6.2.3.1; only the anchors in tension; biaxial → product of the two factors).
- **Before:**
  ```js
  const M_res = Math.sqrt(Mx*Mx + My*My);
  const e_prime_N = (N > 0) ? (M_res / N) : 0;
  ...
  let psi_ecN = 1.0;
  if (e_prime_N > 0) psi_ecN = 1.0 / (1.0 + (2.0 * e_prime_N) / (3.0 * hef));
  ```
- **After:**
  ```js
  const sN = set.reduce((s0, a) => s0 + a.N, 0);
  if (sN > 0) {
      const xr = set.reduce((s0, a) => s0 + a.N * a.x, 0) / sN, yr = set.reduce((s0, a) => s0 + a.N * a.y, 0) / sN;
      const xc = xs.reduce((s0, v) => s0 + v, 0) / n, yc = ys.reduce((s0, v) => s0 + v, 0) / n;
      eNx = Math.abs(xr - xc); eNy = Math.abs(yr - yc);
      ...
  const psi_ecx = 1.0 / (1.0 + (2.0 * eNx) / (3.0 * hefC));
  const psi_ecy = 1.0 / (1.0 + (2.0 * eNy) / (3.0 * hefC));
  const psi_ecN = psi_ecx * psi_ecy;
  ```
- **Check case:** biaxial, s_x 8, s_y 6, c = 24, h_ef 8, N 2000, M_x 12,000, M_y 6000: anchor forces TR 1875, TL 1125, BL −875, BR −125. Before e'_N = √(12,000²+6000²)/2000 = 6.71 → ψ_ec 0.641, A_Nc 960, demand 2000 → 0.078. After tension anchors TR+TL, resultant x = (1875·4 − 1125·4)/3000 = 1.0, e'_x = 1.0, e'_y = 0 → ψ_ec = 1/(1+2/24) = 0.923; A_Nc = 32×24 = 768; demand 3000 → 0.101. When all anchors are in tension the new e'_N equals M/N per axis (defaults: e'_y = 0.2 both ways).
- **How verified:** node (extra.js §4).
- **Other copies of this code:** none.

### F8. A_Nc ≤ n·A_Nco — implemented together with F6 (see F6 for code and check case).

### F9. f'c ≤ 10,000 psi in all Ch. 17 calculations   [calc change] [more conservative for f'c > 10,000]
- **Where:** `computeAll` (`const fcC = Math.min(fc, FC_MAX);`) — `fcC` is passed to breakout, pullout, blowout, shear breakout, pryout. Warning shown when capped.
- **Governing provision:** ACI 318-19 §17.3.1.
- **Before:** `Math.sqrt(fc)` with raw f'c.
- **After:** `const FC_MAX = 10000;` … `const fcC = Math.min(fc, FC_MAX);`
- **Check case:** f'c = 12,000 → fcC = 10,000 and warning "f'c capped …".
- **How verified:** node (extra.js §3).
- **Other copies of this code:** none.

### F10. h_ef reduction near three or more edges   [calc change] [**LESS conservative**]
- **Where:** `breakoutGroup`. Anchor text: `const hr = Math.max(caMax / 1.5, s / 3);`
- **Problem:** not implemented.
- **Governing provision:** ACI 318-19 §17.6.2.1.2 — where anchors are < 1.5h_ef from three or more edges, h_ef in A_Nc, A_Nco and Eqs. 17.6.2.1–17.6.2.4 is limited to max(c_a,max/1.5, s/3), c_a,max = largest influencing edge distance ≤ 1.5h_ef. The commentary states the unmodified method is overly conservative here, so this raises capacity.
- **Before:** none (`hef` used directly).
- **After:**
  ```js
  const near = dl.filter(v => v < 1.5 * hef);
  const s = Math.max(xmax - xmin, ymax - ymin);
  let hefC = hef, hefReduced = false, caMax = 0;
  if (near.length >= 3) {
      caMax = Math.max(...near);
      const hr = Math.max(caMax / 1.5, s / 3);
      if (hr < hef) { hefC = hr; hefReduced = true; }
  }
  ```
  Edge distances and s are taken from the anchors in tension (pryout: all anchors). See O12.
- **Check case:** EX5 (h_ef 12, c1 = c2 = c3 = 6, c4 = 40, s = 8): h'_ef = max(4.0, 2.67) = 4.0; before φN_cbg 17,449 → after 23,612 (+35%); ratio 1.719 → 1.271 (still NG).
- **How verified:** node; formula and approach match BasePlateAnchorDesigner.html `hefEffective()` (verified OK by the reviewer).
- **Other copies of this code:** BasePlateAnchorDesigner.html `hefEffective()` (independent implementation).

### F11. Alternate N_b for 11 ≤ h_ef ≤ 25 in (headed anchors)   [calc change] [**LESS conservative** for h_ef > 11.39 in]
- **Where:** `breakoutGroup`. Anchor text: `const altOK = type === 'hex' && hefC >= 11 && hefC <= 25;`
- **Governing provision:** ACI 318-19 §17.6.2.2.3 (cast-in headed studs/bolts, N_b = 16λ_a√f'c h_ef^(5/3)). Implemented as the larger of the two (as BasePlateAnchorDesigner does), i.e. treated as a permitted alternative — see O7.
- **Before:** `const Nb = CONSTANTS.kc * lambda * Math.sqrt(fc) * Math.pow(hef, 1.5);`
- **After:**
  ```js
  const Nb24 = CONSTANTS.kc * lambda * Math.sqrt(fcC) * Math.pow(hefC, 1.5);
  const altOK = type === 'hex' && hefC >= 11 && hefC <= 25;
  const Nb16 = altOK ? 16 * lambda * Math.sqrt(fcC) * Math.pow(hefC, 5/3) : 0;
  const Nb = Math.max(Nb24, Nb16);
  ```
- **Check case:** h_ef = 18, f'c 4000: 24-form 115,918, 16-form 125,104 (+7.9%) → 125,104 for HEX; L-bolt stays 115,918.
- **How verified:** node (extra.js §9).
- **Other copies of this code:** BasePlateAnchorDesigner.html (same approach).

### F12. Net compression + moment: tension anchors are checked   [bug fix] [more conservative]
- Covered by F5/F6: `tens` is built from anchor forces, so any anchor in tension is checked for steel, pullout (N_max > 0), breakout (ΣT), blowout. When no anchor is in tension the breakout box says "No anchor in tension". Check case EX3 above. Steel/pullout use `Math.max(0, N_max_bolt)`.

### F13. Shear breakout V_b = min(Eq. a, Eq. b), with λ_a   [calc change] [more conservative]
- **Where:** `shearEdge` (≈ line 371). Anchor text: `const Vb = Math.min(VbA, VbB);`
- **Governing provision:** ACI 318-19 §17.7.2.2.1 (Eqs. 17.7.2.2.1a and b, lesser governs), λ_a per §17.2.4.
- **Before:** `const Vb = 7 * Math.pow(le/da, 0.2) * Math.sqrt(da) * Math.sqrt(fc) * Math.pow(ca1_shear, 1.5);`
- **After:**
  ```js
  const le = Math.min(p.hef, 8 * p.da);
  const VbA = 7 * Math.pow(le / p.da, 0.2) * Math.sqrt(p.da) * p.lambda * Math.sqrt(p.fcC) * Math.pow(ca1, 1.5);
  const VbB = 9 * p.lambda * Math.sqrt(p.fcC) * Math.pow(ca1, 1.5);
  const Vb = Math.min(VbA, VbB);
  ```
- **Check case:** c_a1 = 12, 3/4", h_ef 6, f'c 4000: (a) 24,157, (b) 9·63.246·41.57 = 23,662 → 23,662.
- **How verified:** node.
- **Other copies of this code:** BasePlateAnchorDesigner.html (has the plain-rod exception; not copied).

### F14. ψ_ed,V, ψ_h,V (new input h_a), ψ_c,V option, ψ_ec,V   [calc change] [ψ_ed,V, ψ_h,V more conservative; ψ_c,V 1.2/1.4 option less conservative when selected]
- **Where:** `shearEdge`; inputs `ha` (GEOMETRY section) and `edgeReinf` (MEMBER & ANCHOR section); constant `EDGE_REINF`.
- **Problem:** none of ψ_ed,V, ψ_h,V, ψ_ec,V was applied; ψ_c,V was 1.0/1.4 by cracked flag only; no member thickness input.
- **Governing provision:** ACI 318-19 §17.7.2.3 (ψ_ec,V), §17.7.2.4 (ψ_ed,V = 0.7 + 0.3c_a2/1.5c_a1 ≤ 1.0), §17.7.2.5 (ψ_c,V: uncracked 1.4; cracked 1.0 / 1.2 edge bar ≥ No. 4 / 1.4 edge bar + stirrups ≤ 4 in.), §17.7.2.6 (ψ_h,V = √(1.5c_a1/h_a) ≥ 1.0).
- **Before:** `const psi_cV = cracked ? 1.0 : 1.4;` `const Vcbg = (Avc / Avco) * psi_cV * Vb;`
- **After:**
  ```js
  const ca2 = Math.min(dNeg, dPos);
  const psi_edV = parallel ? 1.0 : (ca2 >= 1.5 * ca1 ? 1.0 : 0.7 + 0.3 * ca2 / (1.5 * ca1));
  const psi_hV = p.ha < 1.5 * ca1 ? Math.sqrt(1.5 * ca1 / p.ha) : 1.0;
  const eV = 0;
  const psi_ecV = 1.0 / (1.0 + (2.0 * eV) / (3.0 * ca1));
  ...
  const Vcbg = (parallel ? 2 : 1) * (Avc / Avco) * psi_ecV * psi_edV * p.psi_cV * psi_hV * Vb;
  ```
  and in `computeAll`: `const psi_cV = cracked ? EDGE_REINF[edgeReinf].psi : 1.4;`. ψ_ec,V: loads act at the group centroid and the leading row is symmetric about it, so e'_V = 0 and ψ_ec,V = 1.0 (no torsion input exists; reported in the report line). New saved keys `ha` (default 24 in) and `edgeReinf` (default "none" = 1.0, the old cracked value).
- **Check case:** defaults: ψ_ed,V = 0.7 + 0.3·12/18 = 0.9. h_a = 10 (c_a1 12): depth = min(18, 10) = 10, ψ_h,V = √(18/10) = 1.342, V_cbg = 13,227. edgeReinf = bar: ψ_c,V = 1.2, V_cbg = 21,295 (vs 17,746).
- **How verified:** node (extra.js §8).
- **Other copies of this code:** none.

### F15. A_Vc clipped by the side edges, 1.5c_a1 and h_a; spacing along the loaded edge; A_Vc ≤ n·A_Vco   [calc change] [usually more conservative; less conservative for x-direction shear when s_y > s_x]
- **Where:** `shearEdge`. Anchor text: `const width = (aMax - aMin) + Math.min(1.5 * ca1, dNeg) + Math.min(1.5 * ca1, dPos);`
- **Problem:** width = 3c_a1 + s_x always (unclipped, and s_x even for x-direction shear where the anchors along the edge are spaced s_y); depth 1.5c_a1 not limited by h_a; no n·A_Vco cap.
- **Governing provision:** ACI 318-19 §17.7.2.1.1, Fig. R17.7.2.1b (Case 3: full shear on the row nearest the edge).
- **Before:**
  ```js
  const width = (1.5 * ca1_shear) + (numAnchors > 1 ? sx : 0) + (1.5 * ca1_shear); 
  const Avc = width * 1.5 * ca1_shear; 
  ```
- **After:**
  ```js
  const width = (aMax - aMin) + Math.min(1.5 * ca1, dNeg) + Math.min(1.5 * ca1, dPos);
  const depth = Math.min(1.5 * ca1, p.ha);
  const Avco = 4.5 * ca1 * ca1;
  const AvcGeom = width * depth;
  const Avc = Math.min(AvcGeom, nRow * Avco);
  ```
- **Check case:** s_x 12, s_y 4, V_x 2000 toward c3 = 12: width = 4 + 12 + 12 = 28 (before 18 + 12 + 18 = 48 using s_x); before V_cbg 32,210 → after 16,563. Cap: s_x 6, s_y 40, c3 = 6, other c = 24, V_x 2000 toward c3: width 40 + 9 + 9 = 58, depth 9 → 522 > 2 × 162 = 324 → A_Vc = 324. Defaults: width 30 (before 42).
- **How verified:** node (extra.js §10–11).
- **Other copies of this code:** none.

### F16. Shear direction handled per edge: perpendicular + parallel components   [calc change] [more conservative / new checks]
- **Where:** `calculateBreakoutShear` (≈ line 398).
- **Problem:** only the dominant component's edge was checked with the full resultant; edges parallel to the shear (§17.7.2.1(c)) and corner effects were never checked; the CORNER preset was therefore misleading.
- **Governing provision:** ACI 318-19 §17.7.2.1 (b) and (c) (shear parallel to an edge: 2× V_cb with ψ_ed,V = 1.0), R17.7.2.1 (anchors near a corner: check each edge).
- **Before:**
  ```js
  let ca1_shear = c1;
  if (Math.abs(Vux) >= Math.abs(Vuy)) ca1_shear = Vux >= 0 ? c3 : c1; else ca1_shear = Vuy >= 0 ? c4 : c2;
  ```
- **After:** for each edge k with outward normal n_k: V_⊥ = max(0, V·n_k), V_∥ = |V × n_k|; util_k = V_⊥/φV_cbg,⊥ + V_∥/φV_cbg,∥ (parallel per §17.7.2.1(c)); the largest util_k governs. The linear sum for inclined shear is a tool assumption (see O5).
- **Check case:** V_x 3000 only, c2 (top) = 4, others 24, h_ef 8: before only the right edge (c3 = 24) was checked; after the top edge (parallel, 2 × V_cbg = 13,661) governs with util 0.314 vs right edge 0.227. Inclined V_x = V_y = 3000 with c2 = 5, c3 = 10: top edge util 0.722 governs.
- **How verified:** node (extra.js §7).
- **Other copies of this code:** none.

### F17. λ_a applied to shear breakout and side-face blowout   [calc change] [more conservative for lightweight concrete]
- **Where:** `shearEdge` (`p.lambda`), `calculateSideFaceBlowout` (`lambda`).
- **Governing provision:** ACI 318-19 §17.2.4.1 (λ_a = λ for cast-in concrete failure modes), Eqs. 17.6.4.1, 17.7.2.2.1a/b.
- **Before:** λ only in tension breakout.
- **After:** λ_a in N_b, V_b (a and b), N_sb.
- **Check case:** w_c = 110: shear V_cbg 17,746 → 14,641 (× 0.825).
- **How verified:** node (runnew EX6).

### F18. Side-face blowout: corner factor, group factor, edge nearest the tension anchors, correct demand   [calc change] [corner factor & demand more conservative; group factor less conservative]
- **Where:** `calculateSideFaceBlowout` (≈ line 320).
- **Problem:** used min(c1..c4) for c_a1 regardless of which anchors were in tension, no (1 + c_a2/c_a1)/4 corner factor, no (1 + s/6c_a1) group factor, no λ_a, and compared per-bolt N_max with a single-anchor N_sb.
- **Governing provision:** ACI 318-19 §17.6.4.1 (h_ef > 2.5c_a1, N_sb = 160c_a1√A_brg λ_a√f'c), §17.6.4.1.1 (× (1 + c_a2/c_a1)/4 when c_a2 < 3c_a1, 1.0 ≤ c_a2/c_a1 ≤ 3.0), §17.6.4.2 (N_sbg = (1 + s/6c_a1)N_sb for s < 6c_a1), R17.6.4.2 (demand = tension on the anchors along that edge).
- **Before:**
  ```js
  const c_min = Math.min(c1, c2, c3, c4);
  const isDeep = hef > 2.5 * c_min;
  ...
  const Nsb = 160 * c_min * Math.sqrt(Abrg) * Math.sqrt(fc);
  ```
  and in `utilN`: `blowout.applicable ? loads.val.N_max_bolt/blowout.val.phiNsb : 0`
- **After:** for each edge, the row of tension anchors nearest that edge: if h_ef > 2.5c_a1 → group (s < 6c_a1, demand = row sum) or each anchor individually (demand = its force), N_sb with the corner factor; governing = largest ratio. Code in Appendix A.
- **Check case:** EX2 above: before 0.186, after 0.446 (corner 0.625 × group 1.333, demand 10,000 on the two left anchors).
- **How verified:** node; hand calc in the EX2 bullet.
- **Other copies of this code:** BasePlateAnchorDesigner.html lacks the corner factor (known bug, not copied).

### F19. Seismic 0.75 only on concrete-governed tension strengths   [calc change] [**LESS conservative** for steel tension, steel shear, shear breakout, pryout when "Seismic" is ticked]
- **Where:** `calculateSteel`, `shearEdge`/`calculateBreakoutShear`, `calculatePryout` (factor removed); kept in `calculateBreakoutTension`, `calculatePullout`, `calculateSideFaceBlowout`.
- **Problem:** 0.75 was applied to every mode (ACI 318-11 D.3.3.3 practice), not per 318-19.
- **Governing provision:** ACI 318-19 §17.10.5.4 (0.75 on φN_pn, φN_sb, φN_cb, φN_a; not on φN_sa); §17.10.6 has no 0.75 for shear.
- **Before:** e.g. `let phiNsa_single = phi_steel * Nsa_single * (seismic ? 0.75 : 1.0);`, `const phiVcbg = phi * Vcbg * (seismic ? 0.75 : 1.0);`, `let phiVcp = phi * Vcp * (seismic ? 0.75 : 1.0);`
- **After:** `const phiNsa_single = phi_steel * Nsa_single;` etc.; concrete tension keeps `* (seismic ? 0.75 : 1.0)`.
- **Check case:** defaults with seismic: ratios seismic/non-seismic: φN_sa 1.0, φV_sa 1.0, φV_cbg 1.0, φV_cp 1.0, φN_cbg 0.75, φN_pn 0.75. EX4 (seismic, h_ef 8, c = 24, N 6000, V_x 3000): before φV_cbg 38,861 (×0.75) → after 25,819 (but now with V_b(b), ψ_ed,V, ψ_h,V for h_a 24).
- A warning is shown that §17.10.5.3 / §17.10.6 ductility/Ω0 requirements are not checked, and that concrete must be assumed cracked (§17.10.5.4).
- **How verified:** node (extra.js §12).

### F20. λ per Table 19.2.4.1   [calc change] [slightly less conservative (≤ 0.01)]
- **Where:** `lambdaFromWc` (≈ line 129).
- **Governing provision:** ACI 318-19 Table 19.2.4.1(a)/(b): λ = 0.75 (w_c ≤ 100), 0.0075w_c (100 < w_c ≤ 135), 1.0 (w_c > 135).
- **Before:** `const lambda = wc >= 135 ? 1.0 : (wc <= 100 ? 0.75 : 0.75 + (wc-100)/35 * 0.25);`
- **After:** `const lambdaFromWc = (wc) => Math.min(1.0, Math.max(0.75, 0.0075 * wc));`
- **Check case:** w_c 90/100/110/120/135/150 → before 0.75/0.75/0.8214/0.8929/1/1, after 0.75/0.75/0.825/0.90/1/1.
- **How verified:** node (extra.js §13).

### F21. Pryout uses N_cpg of all anchors with ψ_ec,N = 1.0   [calc change] [**LESS conservative** in most cases]
- **Where:** `calculatePryout` (≈ line 436).
- **Problem:** pryout took N_cb from the tension calculation (whole-pattern A_Nc but with ψ_ec,N from the tension load eccentricity M/N, and seismic 0.75 afterwards). With F5–F7 the tension breakout is now based on the tension anchors only, which is not the pryout mechanism.
- **Governing provision:** ACI 318-19 §17.7.3.1 (V_cpg = k_cp N_cpg; N_cpg = N_cbg for cast-in anchors, computed for the group in shear — all anchors, no tension eccentricity; k_cp = 1.0 for h_ef < 2.5 in., 2.0 otherwise).
- **Before:** `const pryout = calculatePryout(tBreak.val.Ncb, hef, condB, seismic);` with `const kcp = hef >= 2.5 ? 2.0 : 1.0; const Vcp = kcp * Ncb_val;`
- **After:**
  ```js
  const calculatePryout = (anchors, p, hef) => {
      const b = breakoutGroup(anchors, { ...p, useEcc: false });
      const kcp = hef < 2.5 ? 1.0 : 2.0;
      const Vcp = kcp * b.Ncb;
      const phi = 0.70;
  ```
- **Check case:** EX1: before 33,659, after 47,684 (ψ_ec 0.706 no longer applied). Defaults: 54,316 → 55,523.
- **How verified:** node.

### F22. Interaction per §17.8 and headline verdict   [calc change] [0.2 cut-offs less conservative; individual-ratio gate more conservative]
- **Where:** `computeAll` (≈ line 485); headline in the centre panel; check table in report section 3; breakout cone colour.
- **Problem:** interaction = utilN + utilV ≤ 1.2 with no 0.2 cut-offs, and the headline turned green when the sum ≤ 1.2 even with an individual ratio > 1.0 (e.g. utilN 1.099 + utilV 0.025 = 1.124 → green).
- **Governing provision:** ACI 318-19 §17.8.1 (V/φV ≤ 0.2 → φN ≥ N), §17.8.2 (N/φN ≤ 0.2 → φV ≥ V), §17.8.3 (otherwise N/φN + V/φV ≤ 1.2); each individual check ≤ 1.0 (§17.5.2).
- **Before:**
  ```js
  const interaction = utilN + utilV;
  ...
  <span className={res.interaction>1.2?"text-red-500":"text-emerald-400"}>{fmt(res.interaction,2)}</span>
  <div className="text-[10px] mt-1 text-slate-500">Limit: 1.2</div>
  ```
- **After:**
  ```js
  if (utilV <= 0.2) { interaction = utilN; intLimit = 1.0; intRule = "V/φV ≤ 0.2: full tension strength, N/φN ≤ 1.0 (§17.8.1)"; }
  else if (utilN <= 0.2) { interaction = utilV; intLimit = 1.0; intRule = "N/φN ≤ 0.2: full shear strength, V/φV ≤ 1.0 (§17.8.2)"; }
  else { interaction = utilN + utilV; intLimit = 1.2; intRule = "N/φN + V/φV ≤ 1.2 (§17.8.3)"; }
  const failing = checks.filter(c => c.ratio > 1.0);
  const interactionOK = interaction <= intLimit;
  const pass = interactionOK && failing.length === 0;
  ```
  Headline keeps "utilN + utilV = sum", adds the applicable rule and an OK/NG line listing failing checks. `pass` includes the plate DCR. Cone colour uses `!results.pass` instead of `results.interaction > 1.2`.
- **Check case:** h_ef 8, c = 24, N 41,300, V_x 1000, t 1.5: before utilN 1.099 + utilV 0.025 = 1.124 → headline GREEN; after §17.8.1 applies, breakout 1.099 > 1.0 → **NG**. N 30,000, V_x 20,000: utilN 0.799, utilV 0.775, sum 1.573 > 1.2 → NG. N 4000, V_x 20,000: utilN 0.107 ≤ 0.2 → §17.8.2, 0.775 ≤ 1.0 → OK.
- **How verified:** node (extra2.js).

### F23. Shear sign mapping consistent with the anchor coordinates   [bug fix] [changes results when V_uy ≠ 0 and c2 ≠ c4]
- **Where:** `calculateBreakoutShear` (edge normals in `EDGES`), Visualization (`const angle`, V_y component line), sign note under FACTORED LOADS.
- **Problem:** anchors are plotted and loaded with +y toward the Top edge (c2) (M_x puts +y anchors in tension), but +V_uy was checked toward the Bottom edge (c4) and drawn pointing down.
- **Before:**
  ```js
  if (Math.abs(Vux) >= Math.abs(Vuy)) ca1_shear = Vux >= 0 ? c3 : c1; else ca1_shear = Vuy >= 0 ? c4 : c2;
  ...
  const angle = Math.atan2(Vuy, Vux) * 180 / Math.PI;
  ...
  {Math.abs(Vuy)>0 && <line x1={cx} y1={cy} x2={cx} y2={cy+Vuy/50} stroke="#facc15" strokeWidth="1" />}
  ```
- **After:**
  ```js
  { k: 'T', name: 'Top (c2)',    axis: 'y', sign:  1, n: [ 0, 1] },   // +Vuy pushes toward c2
  ...
  // SVG y points down; +Vuy acts toward +y (Top, c2), so negate for the drawing angle
  const angle = Math.atan2(-Vuy, Vux) * 180 / Math.PI;
  ...
  {Math.abs(Vuy)>0 && <line x1={cx} y1={cy} x2={cx} y2={cy-Vuy/50} stroke="#facc15" strokeWidth="1" />}
  ```
  UI note (after the Moment row): `Signs: +x → Right (c3), +y → Top (c2). +Nua = tension. +Vux acts toward c3, +Vuy toward c2. +Mux puts the top (+y) anchors in tension; +Muy puts the right (+x) anchors in tension.`
- **Check case:** V_uy = +2000, c2 = 6, c4 = 24: before c_a1 = 24 (bottom); after Top (c2), c_a1 = 6. V_uy = −2000 → Bottom (c4), c_a1 = 24.
- **Saved files:** a file without the new `version` field and with V_uy ≠ 0 shows a load note asking the user to verify the sign.
- **How verified:** node (extra.js §6).

### F24. Blank page when N_max ≤ 0   [bug fix] [no result change]
- **Where:** `calculateBasePlate` early return.
- **Problem:** for N_max ≤ 0 (e.g. N = −4000, no moment) the function returned `tex: { eq, res }` with no `treq`, and the report read `res.plate.tex.treq.res` → TypeError → React unmounted the page (verified by server-rendering the original file: "Cannot read properties of undefined (reading 'res')").
- **Before:** `if (N_max <= 0) return { val: {dcr:0}, tex: { eq: "N \\le 0", res: "OK" } };`
- **After:** `if (N_max <= 0) return { val: { treq: 0, dcr: 0 }, tex: { treq: { eq: "N_{max} \\le 0", res: "0", unit: "in" } } };`
- **Check case:** N = −4000, M = 0 → renders, t_req 0, DCR 0.
- **How verified:** server-render smoke test (smoke.js) on old and new transpiled code.

### F25. JSON load: try/catch, key validation, defaults for new keys   [robustness] [no result change]
- **Where:** `handleLoad` (≈ line 765), new `sanitizeLoaded` (≈ line 533), `handleSave` (adds `version: 2`), banner under the project fields.
- **Problem:** `JSON.parse` without try/catch and `setInputs(d.inputs)` without validation → a malformed/partial file blanked the page or produced NaN everywhere; re-loading the same file did nothing.
- **Before:**
  ```js
  const handleSave = () => {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({project, inputs}));
  ...
  const handleLoad = (e) => {
      const fr = new FileReader();
      fr.onload = e => { const d = JSON.parse(e.target.result); setProject(d.project); setInputs(d.inputs); };
      fr.readAsText(e.target.files[0]);
  };
  ```
- **After:** see Appendix B (`handleSave`, `handleLoad`) and Appendix A (`sanitizeLoaded`). The saved format is unchanged (`{project, inputs}`), plus an optional top-level `version: 2` and four optional `inputs` keys (`ha`, `edgeReinf`, `plateFy`, `plateBeff`). Old files load: every known key is type-checked; missing/invalid keys get defaults with a note; unknown keys (e.g. legacy `conditionB`) are dropped with a note; `condB` stays authoritative.
- **Check case:** old-format file (no new keys, `conditionB: false`, `condB: true`, V_uy 300) → loads, condB true, ha 24, plateFy 36,000, 6 notes; `null`, array, missing `inputs`, `inputs: "x"` → error message, current inputs kept; `fc: "abc"` → default 4000 with note; `grade: "X"` → loads, then shows the input error "Unknown anchor grade".
- **How verified:** node (extra2.js).

### F26. Blank / invalid inputs show errors instead of NaN; guards for s_x = 0, f'c ≤ 0, h_ef ≤ 0   [robustness] [no result change for valid input]
- **Where:** `InputRow` (≈ line 621), new `validateInputs` (≈ line 451), `computeAll`, centre/report panels (error box replaces results).
- **Before:** `<input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value))} className="input-field" />`
- **After:** `<input type="number" value={(typeof value === 'number' && !isFinite(value)) ? '' : value} onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} className="input-field" />` — blank or non-numeric fields, f'c, w_c, h_ef, c1–c4, h_a, t, F_y, b_eff ≤ 0, s_x/s_y ≤ 0 (group), l_x < 0, unknown grade/diameter/type/edge option block the calculation and are listed.
- **Check case:** f'c blank → "f'c: blank or not a number."; s_x = 0 → "Spacing X must be greater than 0."; h_ef = 0 / −2 → error; single anchor with s_x = 0 → no error. Original file with f'c blank rendered 10 "NaN" strings; new renders 0.
- **How verified:** node (extra.js §3) and smoke.js.

### F27. Warnings: §17.9 minimum spacing/edge, h_a ≤ h_ef, single-anchor moments, seismic, L-bolt   [display] [no result change]
- **Where:** `validateInputs` (warnings array), shown at the top of the report panel.
- **Provisions:** ACI 318-19 §17.9.2 (cast-in: s ≥ 4d_a not torqued / 6d_a torqued; edge ≥ 6d_a if torqued, otherwise cover per §20.5.1.3); §17.3.1; §17.6.2.1.2; §17.10.
- **Check case:** s = 2.5, c1 = 3 (3/4") → both warnings.

### F28. `fmt` returns "—" for NaN/undefined and "∞" for Infinity   [display]
- **Before:** `const fmt = (n, d=2) => n?.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) || "0";`
- **After:** `const fmt = (n, d=2) => (typeof n === 'number' && isFinite(n)) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : (n === Infinity ? "∞" : "—");`

### F29. Report shows the new intermediate values and a ratio table   [display]
- Report section 1–3 now lists f_uta, λ_a, h_ef used, A_Nco, ψ_ec,N/ψ_ed,N/ψ_c,N, N_cbg and ratio, blowout corner/group factors, shear governing edge, V_b (a)/(b), A_Vc, ψ factors, pryout basis, the plate equation, and a check table with every ratio and the §17.8 line. Code: Appendix B.

## 2026-10-04 — "All tools" link and shared project info
### F30. "← All tools" link; "Use shared project info" / "Share project info" buttons   [feature (no result change)]
- **Date:** 2026-10-04. **Type:** feature (no result change). Approved by the engineer (step 1 of the cross-tool hand-off work, HANDOFF.md §4.1).
- **What:** a small "← All tools" link to `tools.html` (`target="_top"`, because tools can be shown inside index.html's iframe), placed in the top of the left input panel header, above the "ANCHOR PRO" title row. It is hidden in print.
- **Shared project info:** two buttons under the Job # / Eng inputs, before the load-message box.
  - **Share** builds the full `fields` object (all 8 HANDOFF §4.1 fields, blank where this tool has no field) and calls `BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{name, bridgeId}, fields})`. Key: `bridgeSuite.v1.projectMeta` (+ `.updatedAt`). On Share, values equal to the sample `DEFAULT_PROJECT` ("Bridge A", "23-001", "JD") are sent as blank.
  - **Use** calls `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing the producer, time, project and every field that will change (old → new), and writes only this tool's mapped fields. A blank shared value never blanks a field. Apply path: `setProject(p => ({...p, ...patch}))`. Records `bridgeSuite.v1.projectMeta.adopted.<id>`.
- **Field mapping (shared → this tool):**

  | Shared field | Tool field | Label |
  |---|---|---|
  | `projectName` | `project.name` | Project Name |
  | `jobNo` | `project.job` | Job # |
  | `preparedBy` | `project.eng` | Eng |

  Not mapped: bridgeId, client, location, checkedBy, date.
- **Helpers added:** a plain `<script>` with BridgeXfer v1 verbatim from HANDOFF.md §5, then a plain `<script>` with `ProjMetaUI` (shown in full in the After code below) and this tool's field map. Both sit before the tool's own script (React/Babel tool: separate plain script before the app).
- **Storage:** no existing key or saved-data format changed. New keys only: `bridgeSuite.v1.projectMeta`, `.updatedAt`, `.adopted.<id>` (HANDOFF.md §2).
- **Line endings:** this file uses CRLF; the inserted lines use CRLF too.
- **Where / Before / After** (each change is an insertion; the Before text is the anchor and is kept):
  1. Anchor: `<div id="root"></div>`
     - Before:
       ```
       <div id="root"></div>

       <script type="text/babel">
       ```
     - After:
       ```
       <div id="root"></div>

       <script>
       /* BridgeXfer v1 verbatim from HANDOFF.md §5 (73 lines, starts "/* BridgeXfer v1 — cross-tool hand-off helper.", ends "})();") */
       </script>
       <script>
       /* Shared project info buttons (HANDOFF.md §4.1, channel bridgeSuite.v1.projectMeta). Uses window.BridgeXfer.
          map: [{shared:'<HANDOFF field>', key:'<this tool's field>', label:'<this tool's label>', accept:optional fn(v)->bool}]
          values: { <tool key>: <current value> } */
       (function(){
         if(window.ProjMetaUI) return;
         var FIELDS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
         function s(v){ return (v===undefined||v===null)?'':String(v); }
         function share(map, values, producer, producerFile){
           var fields={}; FIELDS.forEach(function(k){ fields[k]=''; });
           map.forEach(function(m){ fields[m.shared]=s(values[m.key]); });
           var r=window.BridgeXfer.publish('projectMeta', {_schema:'bridge-project-meta', project:{ name:fields.projectName, bridgeId:fields.bridgeId }, fields:fields}, producer, producerFile);
           if(r.error){ alert('Could not share project info: '+r.error); return r; }
           var lines=map.map(function(m){ return '  '+m.label+': '+(fields[m.shared]||'(blank)'); });
           alert('Project info shared with the other tools:\n\n'+lines.join('\n'));
           return r;
         }
         function use(map, values, receiverId){
           var r=window.BridgeXfer.read('projectMeta','bridge-project-meta',1);
           if(r.error){ alert('Shared project info: '+r.error+(r.empty?'\n\nOpen a tool that has project info and click "Share project info" first.':'')); return null; }
           var p=r.payload, f=(p.fields&&typeof p.fields==='object')?p.fields:{}, patch={}, lines=[], skipped=[];
           map.forEach(function(m){
             var v=s(f[m.shared]);
             if(v.trim()==='') return;                                   /* never blank a field */
             if(m.accept && !m.accept(v)){ skipped.push('  '+m.label+': "'+v+'" (not a valid value here)'); return; }
             if(v===s(values[m.key])) return;
             patch[m.key]=v; lines.push('  '+m.label+': "'+s(values[m.key])+'" → "'+v+'"');
           });
           if(!lines.length){ alert('Shared project info ('+window.BridgeXfer.describe(p)+') has nothing new for this tool.'+(skipped.length?'\n\nNot used:\n'+skipped.join('\n'):'')); return null; }
           if(!confirm('Use shared project info from '+window.BridgeXfer.describe(p)+'?\n\nThis will overwrite:\n'+lines.join('\n')+(skipped.length?'\n\nNot used:\n'+skipped.join('\n'):''))) return null;
           window.BridgeXfer.markAdopted('projectMeta', receiverId, p.producedAt);
           return patch;
         }
         window.ProjMetaUI={ share:share, use:use };
       })();
       /* Concrete Anchor: shared project info field map (project fields at the top of the input panel). */
       var CA_PROJ_MAP=[{shared:'projectName',key:'name',label:'Project Name'},
                        {shared:'jobNo',key:'job',label:'Job #'},
                        {shared:'preparedBy',key:'eng',label:'Eng'}];
       </script>
       <script type="text/babel">
       ```
  2. Anchor: `<div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">`
     - Before:
       ```
                           <div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
       ```
     - After:
       ```
                           <div className="p-4 border-b border-slate-800 sticky top-0 bg-slate-900 z-10">
                               <a href="tools.html" target="_top" title="Open the list of all tools" className="no-print block text-[10px] text-slate-400 hover:text-blue-400 mb-1">&larr; All tools</a>
       ```
  3. Anchor: `{loadMsg && <div className={'mt-2 p-2`
     - Before:
       ```
                               {loadMsg && <div className={`mt-2 p-2
       ```
     - After:
       ```
                               <div className="no-print flex gap-1 mt-2">
                                   <button type="button" title="Fill the project fields from project info shared by another tool" onClick={()=>{ const patch = ProjMetaUI.use(CA_PROJ_MAP, project, 'concreteAnchor'); if (patch) setProject(p => ({...p, ...patch})); }} className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded hover:bg-blue-600">Use shared project info</button>
                                   <button type="button" title="Make these project fields available to the other tools (sample defaults are shared as blank)" onClick={()=>ProjMetaUI.share(CA_PROJ_MAP, Object.fromEntries(Object.entries(project).map(([k, v]) => [k, v === DEFAULT_PROJECT[k] ? '' : v])), 'Concrete Anchor', 'Concrete Anchor.html')} className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded hover:bg-blue-600">Share project info</button>
                               </div>
                               {loadMsg && <div className={`mt-2 p-2
       ```
- **Governing provision:** none. UI and cross-tool data hand-off only (HANDOFF.md §2, §4.1, §5). No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable (no calculation touched). Functional check: Spread Footing shares {Project Name "Route 9 over Mill Brook", Project Number "J-2026-114", Calculated By "MRL", Date "2026-10-04", Checked By "JKD"}; Use in this tool fills the mapped fields; a blank shared value leaves the existing field unchanged.
- **How verified:** `node --check` on every plain inline script; text/babel blocks transpiled with @babel/standalone; page loaded in jsdom with CDN libraries stubbed (React UMD served locally); Share → Use exercised across Spread Footing, BasePlateAnchorDesigner, Pile Designer, Concrete Anchor and Timber Beam Check (Timber: plain scripts in jsdom, the same calls its onClick handlers make, since it imports React from esm.sh) with a localStorage carried between pages; `git diff --numstat` shows only insertions.
- **Other copies:** BridgeXfer v1 and `ProjMetaUI` are duplicated (CLAUDE.md §3) in Pile Designer.html, Spread Footing.html, BasePlateAnchorDesigner.html, Concrete Anchor.html and Timber Beam Check.html (this PR), plus any other tools that received BridgeXfer in their own step-1 PRs.
- **`ProjMetaUI`:** given in full in the After code of the helper insertion above; the copy is identical in every tool listed.

## Open items (not changed)
- O1. **CDN libraries** — React 18 **development** UMD builds unpinned (`react@18`, `react-dom@18`), `@babel/standalone` **unpinned**, **Tailwind Play CDN** (`cdn.tailwindcss.com`), KaTeX 0.16.9 (BasePlate uses 0.16.11). Not changed: separate task per the brief. Needs: decision to pin (e.g. react@18.3.1 production, @babel/standalone@7.x.y) and to replace Tailwind Play.
- O2. **Plate check is a simplified single-cantilever check**, not AISC DG1: no bearing/compression side, one rod's N_max over b_eff, DCR reported as t_req/t (thickness ratio — pass/fail identical to the moment ratio (t_req/t)²). b_eff is now an input but its default 4 in is the old hard-coded value, not a justified effective width (e.g. 2l_x or the anchor spacing). Needs: engineer to choose a b_eff rule or replace with a DG1 check (BasePlateAnchorDesigner does DG1).
- O3. **Load distribution** is an elastic bolt group (anchors take compression; no plate bearing / neutral-axis solution). For a base plate with large moment this underestimates tension-anchor forces. Needs: decision whether this tool is for embed plates only (state it) or should get a bearing solution.
- O4. **Pullout A_brg = 0.9d_a²** (hard-coded; conservative vs heavy-hex values) and **hooked e_h = 3d_a** (minimum of §17.6.3.2.2b). Needs: optional inputs if the engineer wants them.
- O5. **Shear breakout** uses Case 3 (full shear on the row nearest the edge) only; Fig. R17.7.2.1b Cases 1/2 are not evaluated. Inclined shear is combined per edge as V_⊥/φV_⊥ + V_∥/φV_∥ (tool assumption, conservative; ACI gives no explicit rule). No torsion input, so ψ_ec,V = 1.0 always.
- O6. **§17.7.2.1.2 narrow/thin-member c_a1 limit** not implemented. With A_Vc already clipped by the side edges and h_a, analysis shows the limit raises the computed capacity (ψ_ed,V increases), so omitting it is conservative. Needs: engineer's decision whether to implement (less conservative).
- O7. **§17.6.2.2.3 wording** — implemented as max(24-form, 16-form) for headed anchors with 11 ≤ h_ef ≤ 25 ("alternatively", as in 318-14 §17.4.2.2 and BasePlate). If 318-19 makes the 16-form mandatory, the result is slightly unconservative only for 11 ≤ h_ef < 11.39 in (< 0.7%). Needs: confirm 318-19 wording.
- O8. **Grout pad 0.80 factor** (§17.7.1.2.1) on steel shear not implemented — no grout input. Needs: add an input if base plates on grout are checked with this tool.
- O9. **Seismic §17.10.5.3 / §17.10.6** (ductile steel, attachment yield, Ω0) not implemented; a warning is shown.
- O10. There is no UI control for cracked/uncracked (`cracked` is true unless a file sets it). Left as is (cracked is conservative).
- O11. **§17.6.2.1.2 interpretation**: edge distances and s are taken from the anchors in tension (pryout: all anchors). Needs: confirm.
- O12. Only F1554 grades and 1/2–1 in diameters; the "App D: Plate Yield Line Analysis (AISC Design Guide 1)" tooltip key is unused/mislabelled; invalid CSS `rounded:` and unused `.toggle-*` styles — cosmetic, not changed.
- O13. **h_a default 24 in** is applied to new projects and to old files (with a load note). The engineer must enter the real member thickness; a non-limiting default would hide ψ_h,V.
- O14. AUDIT A9 suggested a "not for design" banner pending the fix-or-retire decision; not added (the engineer chose "fix fully").

## Appendix A — complete new engine block

Replace everything from the line `    // --- CONSTANTS ---` up to (not including) `    // --- COMPONENTS ---` with:

````js
    // --- CONSTANTS ---
    const CONSTANTS = { kc: 24, kcp: 2.0 };
    const STEEL_GRADES = {
        "F1554-36": { fut: 58000, fy: 36000 },
        "F1554-55": { fut: 75000, fy: 55000 },
        "F1554-105": { fut: 125000, fy: 105000 },
    };
    // Net tensile stress area A_se (in^2), UNC coarse threads (AISC Manual / ASME B1.1).
    // Same values as ASE_TABLE in BasePlateAnchorDesigner.html. ACI 318-19 §17.6.1.2 / §17.7.1.2.
    const ASE_TABLE = { 0.5: 0.142, 0.625: 0.226, 0.75: 0.334, 0.875: 0.462, 1.0: 0.606 };
    // ACI 318-19 §17.3.1: f'c used in Ch. 17 calculations shall not exceed 10,000 psi (cast-in anchors).
    const FC_MAX = 10000;
    // ACI 318-19 §17.7.2.5 psi_c,V for CRACKED concrete (uncracked = 1.4 always).
    const EDGE_REINF = {
        none:     { psi: 1.0, label: "No edge reinf. (1.0)" },
        bar:      { psi: 1.2, label: "Edge bar >= No.4 (1.2)" },
        stirrups: { psi: 1.4, label: "Edge bar + stirrups <= 4 in (1.4)" }
    };
    const DEFAULT_PROJECT = { name: "Bridge A", job: "23-001", eng: "JD" };
    const DEFAULT_INPUTS = {
        fc: 4000, wc: 150, cracked: true, condB: true, seismic: false,
        hef: 6.0,
        c1: 12.0, c2: 12.0, c3: 12.0, c4: 12.0,
        numAnchors: 4, sx: 6.0, sy: 6.0,
        da: 0.75, grade: "F1554-36", type: "hex",
        Nua: 5000, Vux: 2000, Vuy: 0, Mux: 1000, Muy: 0,
        plateT: 0.5, plateLx: 2.0,
        // Added fields (optional in saved files; these defaults are applied when missing)
        ha: 24.0, edgeReinf: "none", plateFy: 36000, plateBeff: 4.0
    };

    const TOOLTIPS = {
        "17.6.1.2": "Nominal Steel Strength in Tension",
        "17.5.3": "Strength Reduction Factors (phi)",
        "17.6.2.1": "Concrete Breakout Strength in Tension (group)",
        "17.6.2.1.2": "Effective embedment near three or more edges",
        "17.6.2.2": "Basic Concrete Breakout Strength",
        "17.6.2.3.1": "Modification Factor for Eccentricity",
        "17.6.3.1": "Nominal Pullout Strength",
        "17.6.4.1": "Side-Face Blowout Strength",
        "17.7.1.2": "Nominal Steel Strength in Shear",
        "17.7.2.1": "Concrete Breakout Strength in Shear (group)",
        "17.7.2.2": "Basic Concrete Breakout Strength in Shear",
        "17.7.3.1": "Nominal Pryout Strength",
        "17.8": "Tension and Shear Interaction",
        "App D": "Plate Yield Line Analysis (AISC Design Guide 1)"
    };

    const fmt = (n, d=2) => (typeof n === 'number' && isFinite(n)) ? n.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }) : (n === Infinity ? "∞" : "—");

    // --- ENGINEERING LOGIC ---
    // Coordinates: +x to the RIGHT (edge c3), +y to the TOP (edge c2). Edge distances c1..c4 are
    // measured from the outermost anchors. +Vux acts toward c3, +Vuy acts toward c2.
    // +Mux puts the +y (top) anchors in tension; +Muy puts the +x (right) anchors in tension.

    // ACI 318-19 Table 19.2.4.1(a)/(b): lambda = 0.75 (wc <= 100), 0.0075 wc (100 < wc <= 135), 1.0 (wc > 135)
    const lambdaFromWc = (wc) => Math.min(1.0, Math.max(0.75, 0.0075 * wc));

    const EDGES = [
        { k: 'L', name: 'Left (c1)',   axis: 'x', sign: -1, n: [-1, 0] },
        { k: 'R', name: 'Right (c3)',  axis: 'x', sign:  1, n: [ 1, 0] },
        { k: 'T', name: 'Top (c2)',    axis: 'y', sign:  1, n: [ 0, 1] },
        { k: 'B', name: 'Bottom (c4)', axis: 'y', sign: -1, n: [ 0,-1] }
    ];
    const edgeLines = (c1, c2, c3, c4, numAnchors, sx, sy) => {
        const dx = numAnchors > 1 ? sx/2 : 0, dy = numAnchors > 1 ? sy/2 : 0;
        return { xL: -dx - c1, xR: dx + c3, yT: dy + c2, yB: -dy - c4 };
    };
    const edgeDist = (a, g, k) => k === 'L' ? a.x - g.xL : k === 'R' ? g.xR - a.x : k === 'T' ? g.yT - a.y : a.y - g.yB;
    // anchors of `set` in the row closest to edge e
    const leadRow = (set, e) => {
        const co = a => e.axis === 'x' ? a.x : a.y;
        const lead = e.sign > 0 ? Math.max(...set.map(co)) : Math.min(...set.map(co));
        return set.filter(a => Math.abs(co(a) - lead) < 1e-6);
    };

    const distributeLoads = (N, Vx, Vy, Mx, My, numAnchors, sx, sy) => {
        const V_resultant = Math.sqrt(Vx*Vx + Vy*Vy);
        const V_per_bolt = V_resultant / numAnchors; 
        
        const anchors = [];
        let N_max_bolt = 0;

        if (numAnchors === 1) {
            anchors.push({ id: 1, x: 0, y: 0, N: N, V: V_per_bolt });
            N_max_bolt = N;
        } else {
            const dx = sx/2; 
            const dy = sy/2;
            const Ix = 4 * dy*dy; 
            const Iy = 4 * dx*dx; 
            
            const pos = [
                { id: 1, x: dx, y: dy },   // TR
                { id: 2, x: -dx, y: dy },  // TL
                { id: 3, x: -dx, y: -dy }, // BL
                { id: 4, x: dx, y: -dy }   // BR
            ];

            pos.forEach(p => {
                const axial = N / 4;
                let N_calc = axial;
                // Add My effect (X-axis arm) - +My puts the +x anchors in tension (elastic bolt group)
                if (p.x > 0) N_calc += (My / (2*sx)); else N_calc -= (My / (2*sx));
                // Add Mx effect (Y-axis arm) - +Mx puts the +y anchors in tension
                if (p.y > 0) N_calc += (Mx / (2*sy)); else N_calc -= (Mx / (2*sy));
                
                anchors.push({ id: p.id, x: p.x, y: p.y, N: N_calc, V: V_per_bolt });
            });
            
            // For design check, use max tension regardless of sign convention
            // Conservative: N/4 + |Mx|/2sy + |My|/2sx
            N_max_bolt = (N/4) + (Math.abs(My)/(2*sx)) + (Math.abs(Mx)/(2*sy)); 
        }
        // Anchors in tension (ACI 318-19 §17.6.2.1 / §17.6.2.3.1 use only these for group breakout)
        const tens = anchors.filter(a => a.N > 1e-6);
        const sumT = tens.reduce((s, a) => s + a.N, 0);

        return {
            val: { V_resultant, V_per_bolt, N_max_bolt, anchors, tens, sumT },
            tex: {
                V_res: { eq: `V_{ua} = \\sqrt{V_{ux}^2 + V_{uy}^2}`, res: fmt(V_resultant,0), unit: "lb" },
                N_dist: { eq: numAnchors===4?`N_{max} = \\frac{N}{4} + \\frac{|M_x|}{2s_y} + \\frac{|M_y|}{2s_x}`:`N_{ua,i} = N_{ua}/1`, res: fmt(N_max_bolt,0), unit: "lb" },
                N_sumT: { eq: `N_{ua,g} = \\sum N_{ua,i}\\ (${tens.length}\\ \\text{anchors in tension})`, res: fmt(sumT,0), unit: "lb" }
            }
        };
    };

    const calculateSteel = (da, gradeKey) => {
        const grade = STEEL_GRADES[gradeKey];
        const AseN = ASE_TABLE[da];
        const futa = Math.min(grade.fut, 1.9 * grade.fy, 125000);   // §17.6.1.2
        const Nsa_single = AseN * futa;
        const phi_steel = 0.75; 
        const phiNsa_single = phi_steel * Nsa_single;
        const Vsa_single = 0.6 * AseN * futa;
        const phi_shear_steel = 0.65;
        const phiVsa_single = phi_shear_steel * Vsa_single;

        return {
            val: { AseN, futa, phiNsa_single, phiVsa_single, fy: grade.fy },
            tex: {
                futa: { eq: `f_{uta} = \\min(f_{ut}, 1.9 f_{ya}, 125000)`, sub: `\\min(${grade.fut}, ${fmt(1.9*grade.fy,0)}, 125000)`, res: fmt(futa,0), unit: "psi" },
                Nsa: { eq: `N_{sa} = A_{se,N} f_{uta}`, sub: `${fmt(AseN,3)} \\cdot ${fmt(futa,0)}`, res: fmt(Nsa_single,0), unit: "lb" },
                phiNsa: { eq: `\\phi N_{sa} = \\phi A_{se,N} f_{uta}`, sub: `${phi_steel} \\cdot ${fmt(AseN,3)} \\cdot ${fmt(futa,0)}`, res: fmt(phiNsa_single,0), unit: "lb" },
                Vsa: { eq: `V_{sa} = 0.6 A_{se,V} f_{uta}`, sub: `0.6 \\cdot ${fmt(AseN,3)} \\cdot ${fmt(futa,0)}`, res: fmt(Vsa_single,0), unit: "lb" },
                phiVsa: { eq: `\\phi V_{sa} = \\phi\\, 0.6 A_{se,V} f_{uta}`, sub: `${phi_shear_steel} \\cdot 0.6 \\cdot ${fmt(AseN,3)} \\cdot ${fmt(futa,0)}`, res: fmt(phiVsa_single,0), unit: "lb" }
            }
        };
    };

    // Concrete breakout of the anchor set `set` (ACI 318-19 §17.6.2). Used for tension breakout
    // (set = anchors in tension, with psi_ec,N) and for pryout (set = all anchors, psi_ec,N = 1).
    const breakoutGroup = (set, p) => {
        const { hef, fcC, lambda, g, cracked, type, useEcc } = p;
        const n = set.length;
        const xs = set.map(a => a.x), ys = set.map(a => a.y);
        const xmin = Math.min(...xs), xmax = Math.max(...xs), ymin = Math.min(...ys), ymax = Math.max(...ys);
        const d = { L: xmin - g.xL, R: g.xR - xmax, T: g.yT - ymax, B: ymin - g.yB };
        const dl = [d.L, d.R, d.T, d.B];
        // §17.6.2.1.2: anchors < 1.5hef from three or more edges -> hef' = max(ca,max/1.5, s/3) <= hef
        const near = dl.filter(v => v < 1.5 * hef);
        const s = Math.max(xmax - xmin, ymax - ymin);
        let hefC = hef, hefReduced = false, caMax = 0;
        if (near.length >= 3) {
            caMax = Math.max(...near);
            const hr = Math.max(caMax / 1.5, s / 3);
            if (hr < hef) { hefC = hr; hefReduced = true; }
        }
        const Anco = 9 * hefC * hefC;
        const w_x = Math.min(d.L, 1.5 * hefC) + (xmax - xmin) + Math.min(d.R, 1.5 * hefC);
        const w_y = Math.min(d.B, 1.5 * hefC) + (ymax - ymin) + Math.min(d.T, 1.5 * hefC);
        const AncGeom = w_x * w_y;
        const Anc = Math.min(AncGeom, n * Anco);                       // A_Nc <= n A_Nco
        const Nb24 = CONSTANTS.kc * lambda * Math.sqrt(fcC) * Math.pow(hefC, 1.5);
        // §17.6.2.2.3: cast-in headed bolts/studs with 11 <= hef <= 25 in. (alternative Eq.)
        const altOK = type === 'hex' && hefC >= 11 && hefC <= 25;
        const Nb16 = altOK ? 16 * lambda * Math.sqrt(fcC) * Math.pow(hefC, 5/3) : 0;
        const Nb = Math.max(Nb24, Nb16);
        // §17.6.2.3.1: e'_N = distance from the resultant tension of the tension anchors to their
        // centroid, per axis; psi_ec,N = psi_ec,x * psi_ec,y
        let eNx = 0, eNy = 0;
        if (useEcc) {
            const sN = set.reduce((s0, a) => s0 + a.N, 0);
            if (sN > 0) {
                const xr = set.reduce((s0, a) => s0 + a.N * a.x, 0) / sN, yr = set.reduce((s0, a) => s0 + a.N * a.y, 0) / sN;
                const xc = xs.reduce((s0, v) => s0 + v, 0) / n, yc = ys.reduce((s0, v) => s0 + v, 0) / n;
                eNx = Math.abs(xr - xc); eNy = Math.abs(yr - yc);
                if (eNx < 1e-9) eNx = 0; if (eNy < 1e-9) eNy = 0;
            }
        }
        const psi_ecx = 1.0 / (1.0 + (2.0 * eNx) / (3.0 * hefC));
        const psi_ecy = 1.0 / (1.0 + (2.0 * eNy) / (3.0 * hefC));
        const psi_ecN = psi_ecx * psi_ecy;
        const c_min = Math.min(...dl);
        const psi_edN = c_min >= 1.5 * hefC ? 1.0 : 0.7 + 0.3 * (c_min / (1.5 * hefC));
        const psi_cN = cracked ? 1.0 : 1.25;
        const Ncb = (Anc / Anco) * psi_ecN * psi_edN * psi_cN * Nb;
        return { n, hef, hefC, hefReduced, caMax, s, nearCount: near.length, Anco, w_x, w_y, AncGeom, Anc, Nb24, Nb16, Nb, eNx, eNy, psi_ecx, psi_ecy, psi_ecN, c_min, psi_edN, psi_cN, Ncb };
    };

    const calculateBreakoutTension = (tens, p, condB, seismic, sumT) => {
        const phi = condB ? 0.70 : 0.75;
        const fSeis = seismic ? 0.75 : 1.0;     // §17.10.5.4
        if (tens.length === 0) {
            return { applicable: false, val: { phiNcb: Infinity, Ncb: 0, ratio: 0 },
                     tex: { none: { eq: `\\text{No anchor in tension} \\Rightarrow \\text{breakout not applicable}`, res: "—", unit: "" } } };
        }
        const b = breakoutGroup(tens, { ...p, useEcc: true });
        const phiNcb = phi * b.Ncb * fSeis;
        const ratio = sumT / phiNcb;
        const lam = p.lambda;
        return {
            applicable: true,
            val: { ...b, phi, phiNcb, ratio, lambda: lam },
            tex: {
                lambda: { eq: `\\lambda_a = \\lambda\\ (w_c=${p.wc}\\ \\text{pcf})`, sub: `\\min(1.0, \\max(0.75, 0.0075 w_c))`, res: fmt(lam, 3), unit: "" },
                hef: { eq: b.hefReduced ? `h'_{ef} = \\max(c_{a,max}/1.5,\\ s/3)` : `h_{ef}\\ (\\text{${b.nearCount} edge(s)} < 1.5h_{ef},\\ \\text{no reduction})`,
                       sub: b.hefReduced ? `\\max(${fmt(b.caMax,2)}/1.5,\\ ${fmt(b.s,2)}/3)` : null, res: fmt(b.hefC, 2), unit: "in" },
                Nb: { eq: b.Nb16 > b.Nb24 ? `N_b = 16 \\lambda_a \\sqrt{f'_c} h_{ef}^{5/3}\\ (\\ge 24\\lambda_a\\sqrt{f'_c}h_{ef}^{1.5} = ${fmt(b.Nb24,0)})` : `N_b = k_c \\lambda_a \\sqrt{f'_c} h_{ef}^{1.5}`,
                      sub: b.Nb16 > b.Nb24 ? `16 \\cdot ${fmt(lam,3)} \\sqrt{${fmt(p.fcC,0)}} \\cdot ${fmt(b.hefC,2)}^{5/3}` : `24 \\cdot ${fmt(lam,3)} \\sqrt{${fmt(p.fcC,0)}} \\cdot ${fmt(b.hefC,2)}^{1.5}`, res: fmt(b.Nb,0), unit: "lb" },
                Anco: { eq: `A_{Nco} = 9 h_{ef}^2`, sub: `9 \\cdot ${fmt(b.hefC,2)}^2`, res: fmt(b.Anco,1), unit: "in²" },
                Anc: { eq: `A_{Nc} = \\min(w_x w_y,\\ n A_{Nco})\\ (n=${b.n}\\ \\text{tension anchors})`, sub: `\\min(${fmt(b.w_x,2)} \\times ${fmt(b.w_y,2)},\\ ${b.n} \\cdot ${fmt(b.Anco,1)})`, res: fmt(b.Anc,1), unit: "in²" },
                psi_ec: { eq: `\\psi_{ec,N} = \\frac{1}{1+\\frac{2e'_{N,x}}{3h_{ef}}} \\cdot \\frac{1}{1+\\frac{2e'_{N,y}}{3h_{ef}}}`, sub: `e'_{N,x}=${fmt(b.eNx,2)},\\ e'_{N,y}=${fmt(b.eNy,2)}`, res: fmt(b.psi_ecN,3), unit: "" },
                psi_ed: { eq: `\\psi_{ed,N} = 0.7 + 0.3\\frac{c_{a,min}}{1.5h_{ef}} \\le 1.0`, sub: `c_{a,min} = ${fmt(b.c_min,2)}`, res: fmt(b.psi_edN,3), unit: "" },
                psi_c: { eq: `\\psi_{c,N}\\ (${p.cracked ? '\\text{cracked}' : '\\text{uncracked}'})`, res: fmt(b.psi_cN,2), unit: "" },
                Ncb: { eq: `N_{cbg} = \\frac{A_{Nc}}{A_{Nco}} \\psi_{ec,N} \\psi_{ed,N} \\psi_{c,N} \\psi_{cp,N} N_b`, sub: `\\frac{${fmt(b.Anc,1)}}{${fmt(b.Anco,1)}} \\cdot ${fmt(b.psi_ecN,3)} \\cdot ${fmt(b.psi_edN,3)} \\cdot ${fmt(b.psi_cN,2)} \\cdot 1.0 \\cdot ${fmt(b.Nb,0)}`, res: fmt(b.Ncb,0), unit: "lb" },
                phiNcb: { eq: `\\phi N_{cbg}${seismic ? '\\cdot 0.75\\ (\\S 17.10.5.4)' : ''}`, sub: `${phi} \\cdot ${fmt(b.Ncb,0)}${seismic ? ' \\cdot 0.75' : ''}`, res: fmt(phiNcb,0), unit: "lb" },
                ratio: { eq: `N_{ua,g} / \\phi N_{cbg}`, sub: `${fmt(sumT,0)} / ${fmt(phiNcb,0)}`, res: fmt(ratio,3), unit: "" }
            }
        };
    };

    const calculatePullout = (fcC, da, type, cracked, seismic) => {
        const psi_c_p = cracked ? 1.0 : 1.4;
        let Np = 0, eqStr = "";
        if (type === "hex") { const Abrg = 0.9 * da * da; Np = 8 * Abrg * fcC; eqStr = `8 A_{brg} f'_c,\\ A_{brg}=0.9d_a^2=${fmt(Abrg,3)}`; }
        else { const eh = 3 * da; Np = 0.9 * fcC * eh * da; eqStr = `0.9 f'_c e_h d_a,\\ e_h=3d_a`; }
        const Npn = Np * psi_c_p;
        const phi = 0.70;   // Table 17.5.3: pullout is always Condition B
        const phiNpn = phi * Npn * (seismic ? 0.75 : 1.0);
        return { val: { phiNpn, Npn }, tex: { Npn: { eq: `N_{pn} = \\psi_{c,P} N_p = \\psi_{c,P}\\, ${eqStr}`, res: fmt(Npn,0), unit: "lb" }, phiNpn: { eq: `\\phi N_{pn}${seismic ? '\\cdot 0.75' : ''}`, sub: `0.70 \\cdot ${fmt(Npn,0)}${seismic ? ' \\cdot 0.75' : ''}`, res: fmt(phiNpn,0), unit: "lb" } } };
    };

    // ACI 318-19 §17.6.4: checked at each edge where hef > 2.5 c_a1 for the tension anchors in the
    // row nearest that edge. Corner factor (1 + c_a2/c_a1)/4 per §17.6.4.1.1; group factor
    // (1 + s/6c_a1) per §17.6.4.2 when s < 6c_a1, else anchors checked individually.
    const calculateSideFaceBlowout = (tens, g, hef, fcC, lambda, da, type, condB, seismic) => {
        const na = { applicable: false, val: { phiNsb: Infinity, ratio: 0 } };
        if (type !== "hex" || tens.length === 0) return na;
        const Abrg = 0.9 * da * da;
        const phi = condB ? 0.70 : 0.75;
        const fSeis = seismic ? 0.75 : 1.0;
        const nsb = (ca1, ca2) => {
            const corner = ca2 < 3 * ca1 ? (1 + Math.min(3, Math.max(1, ca2 / ca1))) / 4 : 1.0;
            return { corner, Nsb: 160 * ca1 * Math.sqrt(Abrg) * lambda * Math.sqrt(fcC) * corner };
        };
        const checks = [];
        EDGES.forEach(e => {
            const row = leadRow(tens, e);
            const ca1 = edgeDist(row[0], g, e.k);
            if (!(hef > 2.5 * ca1)) return;
            const perp = e.axis === 'x' ? ['T', 'B'] : ['L', 'R'];
            const ca2Of = a => Math.min(edgeDist(a, g, perp[0]), edgeDist(a, g, perp[1]));
            const along = row.map(a => e.axis === 'x' ? a.y : a.x);
            const s = Math.max(...along) - Math.min(...along);
            if (row.length > 1 && s < 6 * ca1) {
                const ca2 = Math.min(...row.map(ca2Of));
                const b = nsb(ca1, ca2);
                const grp = 1 + s / (6 * ca1);
                const Nsbg = grp * b.Nsb;
                const Nua = row.reduce((s0, a) => s0 + a.N, 0);
                const phiNsb = phi * Nsbg * fSeis;
                checks.push({ edge: e.name, ca1, ca2, s, n: row.length, corner: b.corner, grp, Nsb: b.Nsb, Nsbg, phiNsb, Nua, ratio: Nua / phiNsb });
            } else {
                row.forEach(a => {
                    const ca2 = ca2Of(a);
                    const b = nsb(ca1, ca2);
                    const phiNsb = phi * b.Nsb * fSeis;
                    checks.push({ edge: e.name + ` (anchor ${a.id})`, ca1, ca2, s: 0, n: 1, corner: b.corner, grp: 1.0, Nsb: b.Nsb, Nsbg: b.Nsb, phiNsb, Nua: a.N, ratio: a.N / phiNsb });
                });
            }
        });
        if (!checks.length) return na;
        const gv = checks.reduce((m, c) => c.ratio > m.ratio ? c : m, checks[0]);
        return {
            applicable: true, val: { phiNsb: gv.phiNsb, ratio: gv.ratio, gov: gv, checks },
            tex: {
                Nsb: { eq: `N_{sb} = 160 c_{a1} \\sqrt{A_{brg}} \\lambda_a \\sqrt{f'_c} \\cdot \\frac{1 + c_{a2}/c_{a1}}{4}\\ [\\text{${gv.edge}}]`, sub: `160 \\cdot ${fmt(gv.ca1,2)} \\sqrt{${fmt(Abrg,3)}} \\cdot ${fmt(lambda,3)} \\sqrt{${fmt(fcC,0)}} \\cdot ${fmt(gv.corner,3)}\\ (c_{a2}=${fmt(gv.ca2,2)})`, res: fmt(gv.Nsb,0), unit: "lb" },
                Nsbg: { eq: `N_{sbg} = (1 + \\frac{s}{6c_{a1}}) N_{sb}`, sub: `${fmt(gv.grp,3)} \\cdot ${fmt(gv.Nsb,0)}\\ (s=${fmt(gv.s,2)},\\ n=${gv.n})`, res: fmt(gv.Nsbg,0), unit: "lb" },
                phiNsb: { eq: `\\phi N_{sbg}${seismic ? '\\cdot 0.75' : ''}`, sub: `${phi} \\cdot ${fmt(gv.Nsbg,0)}${seismic ? ' \\cdot 0.75' : ''}`, res: fmt(gv.phiNsb,0), unit: "lb" },
                ratio: { eq: `N_{ua,edge} / \\phi N_{sbg}`, sub: `${fmt(gv.Nua,0)} / ${fmt(gv.phiNsb,0)}`, res: fmt(gv.ratio,3), unit: "" }
            }
        };
    };

    // Shear breakout toward edge e, full shear on the row nearest that edge (Fig. R17.7.2.1b Case 3).
    // parallel = true: §17.7.2.1(c), shear parallel to edge e: psi_ed,V = 1.0 and 2x Vcbg.
    const shearEdge = (anchors, e, g, p, parallel) => {
        const row = leadRow(anchors, e);
        const nRow = row.length;
        const ca1 = edgeDist(row[0], g, e.k);
        const along = row.map(a => e.axis === 'x' ? a.y : a.x);
        const aMin = Math.min(...along), aMax = Math.max(...along);
        const dNeg = e.axis === 'x' ? aMin - g.yB : aMin - g.xL;
        const dPos = e.axis === 'x' ? g.yT - aMax : g.xR - aMax;
        const width = (aMax - aMin) + Math.min(1.5 * ca1, dNeg) + Math.min(1.5 * ca1, dPos);
        const depth = Math.min(1.5 * ca1, p.ha);
        const Avco = 4.5 * ca1 * ca1;
        const AvcGeom = width * depth;
        const Avc = Math.min(AvcGeom, nRow * Avco);
        const ca2 = Math.min(dNeg, dPos);
        const psi_edV = parallel ? 1.0 : (ca2 >= 1.5 * ca1 ? 1.0 : 0.7 + 0.3 * ca2 / (1.5 * ca1));
        const psi_hV = p.ha < 1.5 * ca1 ? Math.sqrt(1.5 * ca1 / p.ha) : 1.0;
        // Loads act at the group centroid and the leading row is symmetric about it -> e'_V = 0
        const eV = 0;
        const psi_ecV = 1.0 / (1.0 + (2.0 * eV) / (3.0 * ca1));
        const le = Math.min(p.hef, 8 * p.da);
        const VbA = 7 * Math.pow(le / p.da, 0.2) * Math.sqrt(p.da) * p.lambda * Math.sqrt(p.fcC) * Math.pow(ca1, 1.5);
        const VbB = 9 * p.lambda * Math.sqrt(p.fcC) * Math.pow(ca1, 1.5);
        const Vb = Math.min(VbA, VbB);
        const Vcbg = (parallel ? 2 : 1) * (Avc / Avco) * psi_ecV * psi_edV * p.psi_cV * psi_hV * Vb;
        return { edge: e.name, parallel, nRow, ca1, ca2, width, depth, Avco, AvcGeom, Avc, psi_edV, psi_hV, eV, psi_ecV, psi_cV: p.psi_cV, le, VbA, VbB, Vb, Vcbg };
    };

    const calculateBreakoutShear = (anchors, g, p, Vux, Vuy, condB) => {
        const phi = condB ? 0.70 : 0.75;
        const edges = EDGES.map(e => {
            const vn = Vux * e.n[0] + Vuy * e.n[1];              // component pushing toward edge e
            const vt = Math.abs(Vux * e.n[1] - Vuy * e.n[0]);    // component parallel to edge e
            const perp = vn > 1e-9 ? shearEdge(anchors, e, g, p, false) : null;
            const par = vt > 1e-9 ? shearEdge(anchors, e, g, p, true) : null;
            const util = (perp ? vn / (phi * perp.Vcbg) : 0) + (par ? vt / (phi * par.Vcbg) : 0);
            return { e, vn: Math.max(0, vn), vt, perp, par, util };
        });
        const gov = edges.reduce((m, x) => x.util > m.util ? x : m, edges[0]);
        const c = gov.perp || gov.par;
        if (!c) return { val: { ratio: 0, phiVcbg: Infinity, edges, gov: null }, tex: { none: { eq: `V_{ua} = 0`, res: "—", unit: "" } } };
        const tag = c.parallel ? `\\text{parallel to ${gov.e.name}}` : `\\text{toward ${gov.e.name}}`;
        const phiVcbg = phi * c.Vcbg;
        return {
            val: { ratio: gov.util, phiVcbg, Vb: c.Vb, Vcbg: c.Vcbg, ca1_shear: c.ca1, edges, gov, phi },
            tex: {
                gov: { eq: `\\text{Governing: ${gov.e.name}}:\\ V_{\\perp}=${fmt(gov.vn,0)},\\ V_{\\parallel}=${fmt(gov.vt,0)}\\ \\text{lb}`, res: null },
                Vb: { eq: `V_b = \\min\\left(7(\\frac{l_e}{d_a})^{0.2}\\sqrt{d_a}\\lambda_a\\sqrt{f'_c}c_{a1}^{1.5},\\ 9\\lambda_a\\sqrt{f'_c}c_{a1}^{1.5}\\right)`, sub: `\\min(${fmt(c.VbA,0)},\\ ${fmt(c.VbB,0)}),\\ c_{a1}=${fmt(c.ca1,2)},\\ l_e=${fmt(c.le,2)}`, res: fmt(c.Vb,0), unit: "lb" },
                Avc: { eq: `A_{Vc} = \\min(b \\cdot \\min(1.5c_{a1}, h_a),\\ n A_{Vco}),\\ A_{Vco}=4.5c_{a1}^2`, sub: `\\min(${fmt(c.width,2)} \\times ${fmt(c.depth,2)},\\ ${c.nRow} \\cdot ${fmt(c.Avco,1)})`, res: fmt(c.Avc,1), unit: "in²" },
                psi: { eq: `\\psi_{ec,V}\\,\\psi_{ed,V}\\,\\psi_{c,V}\\,\\psi_{h,V}`, sub: `${fmt(c.psi_ecV,3)} \\cdot ${fmt(c.psi_edV,3)} \\cdot ${fmt(c.psi_cV,2)} \\cdot ${fmt(c.psi_hV,3)}\\ (c_{a2}=${fmt(c.ca2,2)})`, res: fmt(c.psi_ecV*c.psi_edV*c.psi_cV*c.psi_hV,3), unit: "" },
                Vcbg: { eq: `V_{cbg} = ${c.parallel ? '2 \\cdot ' : ''}\\frac{A_{Vc}}{A_{Vco}} \\psi_{ec,V}\\psi_{ed,V}\\psi_{c,V}\\psi_{h,V} V_b\\ [${tag}]`, res: fmt(c.Vcbg,0), unit: "lb" },
                phiVcbg: { eq: `\\phi V_{cbg}`, sub: `${phi} \\cdot ${fmt(c.Vcbg,0)}`, res: fmt(phiVcbg,0), unit: "lb" },
                ratio: { eq: `\\frac{V_{\\perp}}{\\phi V_{cbg,\\perp}} + \\frac{V_{\\parallel}}{\\phi V_{cbg,\\parallel}}`, res: fmt(gov.util,3), unit: "" }
            }
        };
    };

    const calculateBasePlate = (N_max, lx, fy, t_actual, beff) => {
        if (N_max <= 0) return { val: { treq: 0, dcr: 0 }, tex: { treq: { eq: "N_{max} \\le 0", res: "0", unit: "in" } } };
        const phi = 0.9;
        const treq = Math.sqrt( (4 * N_max * lx) / (phi * fy * beff) );
        const dcr = treq / t_actual;
        return { val: { treq, dcr }, tex: { treq: { eq: `t_{req} = \\sqrt{\\frac{4 N_{max} l_x}{\\phi F_y b_{eff}}}`, sub: `\\sqrt{\\frac{4 \\cdot ${fmt(N_max,0)} \\cdot ${fmt(lx,2)}}{0.9 \\cdot ${fmt(fy,0)} \\cdot ${fmt(beff,2)}}}`, res: fmt(treq, 3), unit: "in" } } };
    };

    // §17.7.3: Vcpg = kcp Ncpg, Ncpg = Ncbg of ALL anchors (psi_ec,N = 1.0). Pryout phi = 0.70 always.
    const calculatePryout = (anchors, p, hef) => {
        const b = breakoutGroup(anchors, { ...p, useEcc: false });
        const kcp = hef < 2.5 ? 1.0 : 2.0;
        const Vcp = kcp * b.Ncb;
        const phi = 0.70;
        const phiVcp = phi * Vcp;
        return { val: { phiVcp, Ncpg: b.Ncb, kcp }, tex: {
            Ncp: { eq: `N_{cpg} = N_{cbg}\\ (\\text{all ${b.n} anchors},\\ \\psi_{ec,N}=1)`, sub: `\\frac{${fmt(b.Anc,1)}}{${fmt(b.Anco,1)}} \\cdot ${fmt(b.psi_edN,3)} \\cdot ${fmt(b.psi_cN,2)} \\cdot ${fmt(b.Nb,0)}`, res: fmt(b.Ncb,0), unit: "lb" },
            phiVcp: { eq: `\\phi V_{cpg} = \\phi k_{cp} N_{cpg}`, sub: `0.70 \\cdot ${kcp} \\cdot ${fmt(b.Ncb,0)}`, res: fmt(phiVcp,0), unit: "lb" } } };
    };

    // Input validation: errors block the calculation (no NaN/Infinity results); warnings are shown.
    const NUM_FIELDS = { fc: "f'c", wc: "Density wc", hef: "Embedment hef", c1: "Left c1", c2: "Top c2", c3: "Right c3", c4: "Bottom c4",
        sx: "Spacing X", sy: "Spacing Y", ha: "Member thickness ha", Nua: "Tension Nua", Vux: "Shear Vux", Vuy: "Shear Vuy",
        Mux: "Moment Mux", Muy: "Moment Muy", plateT: "Plate t", plateLx: "Plate cantilever lx", plateFy: "Plate Fy", plateBeff: "Plate b_eff" };
    const validateInputs = (inp) => {
        const errors = [], warnings = [];
        const isNum = v => typeof v === 'number' && isFinite(v);
        Object.entries(NUM_FIELDS).forEach(([k, lbl]) => {
            if ((k === 'sx' || k === 'sy') && inp.numAnchors !== 4) return;
            if (!isNum(inp[k])) errors.push(`${lbl}: blank or not a number.`);
        });
        if (!STEEL_GRADES[inp.grade]) errors.push(`Unknown anchor grade "${inp.grade}".`);
        if (ASE_TABLE[inp.da] === undefined) errors.push(`Unsupported anchor diameter "${inp.da}".`);
        if (inp.type !== 'hex' && inp.type !== 'hook') errors.push(`Unknown anchor type "${inp.type}".`);
        if (inp.numAnchors !== 1 && inp.numAnchors !== 4) errors.push(`Number of anchors must be 1 or 4.`);
        if (!EDGE_REINF[inp.edgeReinf]) errors.push(`Unknown edge reinforcement option "${inp.edgeReinf}".`);
        if (errors.length) return { errors, warnings };
        const pos = (k) => { if (!(inp[k] > 0)) errors.push(`${NUM_FIELDS[k]} must be greater than 0.`); };
        ['fc', 'wc', 'hef', 'c1', 'c2', 'c3', 'c4', 'ha', 'plateT', 'plateFy', 'plateBeff'].forEach(pos);
        if (inp.numAnchors === 4) { pos('sx'); pos('sy'); }
        if (inp.plateLx < 0) errors.push(`Plate cantilever lx must not be negative.`);
        if (errors.length) return { errors, warnings };
        if (inp.fc > FC_MAX) warnings.push(`f'c = ${inp.fc} psi > 10,000 psi: f'c capped at 10,000 psi in all Ch. 17 calculations (§17.3.1).`);
        const da = inp.da;
        if (inp.numAnchors === 4 && Math.min(inp.sx, inp.sy) < 4 * da) warnings.push(`Anchor spacing ${Math.min(inp.sx, inp.sy)} in < 4d_a = ${fmt(4*da,2)} in (§17.9.2 minimum for cast-in anchors not torqued; 6d_a if torqued).`);
        else if (inp.numAnchors === 4 && Math.min(inp.sx, inp.sy) < 6 * da) warnings.push(`Anchor spacing ${Math.min(inp.sx, inp.sy)} in < 6d_a = ${fmt(6*da,2)} in: not permitted if the anchors are torqued (§17.9.2).`);
        const cmin = Math.min(inp.c1, inp.c2, inp.c3, inp.c4);
        if (cmin < 6 * da) warnings.push(`Edge distance ${cmin} in < 6d_a = ${fmt(6*da,2)} in: not permitted if anchors are torqued; if not torqued, the cover requirements of §20.5.1.3 govern (§17.9.2).`);
        if (inp.ha <= inp.hef) warnings.push(`Member thickness h_a = ${inp.ha} in <= h_ef = ${inp.hef} in: check embedment / member thickness.`);
        if (inp.numAnchors === 1 && (inp.Mux !== 0 || inp.Muy !== 0)) warnings.push(`Single anchor: Mux/Muy are ignored (the anchor is loaded by Nua only).`);
        if (inp.seismic) {
            warnings.push(`Seismic: 0.75 applied to concrete breakout, pullout and side-face blowout in tension only (§17.10.5.4). The ductility / Ω0 / attachment-yield requirements of §17.10.5.3 and §17.10.6 are NOT checked by this tool.`);
            if (!inp.cracked) warnings.push(`Seismic: concrete shall be assumed cracked unless shown to remain uncracked (§17.10.5.4).`);
        }
        if (inp.type === 'hook') warnings.push(`L-bolt: side-face blowout not applicable (headed anchors only); pullout uses e_h = 3d_a.`);
        return { errors, warnings };
    };

    const computeAll = (inputs) => {
        const v = validateInputs(inputs);
        if (v.errors.length) return { errors: v.errors, warnings: v.warnings };
        const warnings = v.warnings;
        const { da, grade, type, numAnchors, hef, fc, wc, c1, c2, c3, c4, sx, sy, cracked, condB, seismic, Nua, Vux, Vuy, Mux, Muy, plateT, plateLx, ha, edgeReinf, plateFy, plateBeff } = inputs;
        const fcC = Math.min(fc, FC_MAX);
        const lambda = lambdaFromWc(wc);
        const g = edgeLines(c1, c2, c3, c4, numAnchors, sx, sy);
        const psi_cV = cracked ? EDGE_REINF[edgeReinf].psi : 1.4;
        const p = { hef, fcC, lambda, g, cracked, type, wc, ha, da, psi_cV };

        const loads = distributeLoads(Nua, Vux, Vuy, Mux, Muy, numAnchors, sx, sy);
        const { anchors, tens, sumT, N_max_bolt, V_per_bolt, V_resultant } = loads.val;
        const steel = calculateSteel(da, grade);
        const tBreak = calculateBreakoutTension(tens, p, condB, seismic, sumT);
        const pullout = calculatePullout(fcC, da, type, cracked, seismic);
        const blowout = calculateSideFaceBlowout(tens, g, hef, fcC, lambda, da, type, condB, seismic);
        const sBreak = calculateBreakoutShear(anchors, g, p, Vux, Vuy, condB);
        const pryout = calculatePryout(anchors, p, hef);
        const plate = calculateBasePlate(N_max_bolt, plateLx, plateFy, plateT, plateBeff);
        if (tBreak.applicable && tBreak.val.hefReduced) warnings.push(`Tension breakout: anchors within 1.5h_ef of ${tBreak.val.nearCount} edges; h_ef reduced to ${fmt(tBreak.val.hefC,2)} in (§17.6.2.1.2).`);

        const Nt = Math.max(0, N_max_bolt);
        const checks = [
            { key: 'Nsa', label: 'Steel tension (per anchor)', ref: '17.6.1', ratio: Nt / steel.val.phiNsa_single, kind: 'N' },
            { key: 'Ncb', label: 'Concrete breakout, tension (group)', ref: '17.6.2', ratio: tBreak.applicable ? tBreak.val.ratio : 0, kind: 'N' },
            { key: 'Npn', label: 'Pullout (per anchor)', ref: '17.6.3', ratio: Nt / pullout.val.phiNpn, kind: 'N' },
            { key: 'Nsb', label: 'Side-face blowout', ref: '17.6.4', ratio: blowout.applicable ? blowout.val.ratio : 0, kind: 'N', na: !blowout.applicable },
            { key: 'Vsa', label: 'Steel shear (per anchor)', ref: '17.7.1', ratio: V_per_bolt / steel.val.phiVsa_single, kind: 'V' },
            { key: 'Vcb', label: 'Concrete breakout, shear', ref: '17.7.2', ratio: sBreak.val.ratio, kind: 'V' },
            { key: 'Vcp', label: 'Pryout (group)', ref: '17.7.3', ratio: V_resultant / pryout.val.phiVcp, kind: 'V' },
            { key: 'plate', label: 'Base plate (t_req / t)', ref: 'plate', ratio: plate.val.dcr, kind: 'P' }
        ];
        const utilN = Math.max(...checks.filter(c => c.kind === 'N').map(c => c.ratio));
        const utilV = Math.max(...checks.filter(c => c.kind === 'V').map(c => c.ratio));
        // ACI 318-19 §17.8
        let interaction, intLimit, intRule;
        if (utilV <= 0.2) { interaction = utilN; intLimit = 1.0; intRule = "V/φV ≤ 0.2: full tension strength, N/φN ≤ 1.0 (§17.8.1)"; }
        else if (utilN <= 0.2) { interaction = utilV; intLimit = 1.0; intRule = "N/φN ≤ 0.2: full shear strength, V/φV ≤ 1.0 (§17.8.2)"; }
        else { interaction = utilN + utilV; intLimit = 1.2; intRule = "N/φN + V/φV ≤ 1.2 (§17.8.3)"; }
        const failing = checks.filter(c => c.ratio > 1.0);
        const interactionOK = interaction <= intLimit;
        const pass = interactionOK && failing.length === 0;

        return { errors: [], warnings, loads, steel, tBreak, pullout, blowout, sBreak, pryout, plate, checks, utilN, utilV, interaction, intLimit, intRule, interactionOK, failing, pass, fcC, lambda, cminAll: Math.min(c1, c2, c3, c4) };
    };

    // Load a saved anchor.json: validate, keep known keys only, defaults for missing keys.
    const sanitizeLoaded = (d) => {
        if (!d || typeof d !== 'object' || !d.inputs || typeof d.inputs !== 'object' || Array.isArray(d.inputs)) throw new Error('File does not contain an "inputs" object (not a file saved by this tool).');
        const inputs = { ...DEFAULT_INPUTS }, notes = [];
        Object.keys(DEFAULT_INPUTS).forEach(k => {
            const def = DEFAULT_INPUTS[k];
            if (!(k in d.inputs)) { notes.push(`"${k}" not in file; default ${def} used.`); return; }
            const v = d.inputs[k];
            if (typeof def === 'number') {
                const n = typeof v === 'number' ? v : (typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);
                if (isFinite(n)) inputs[k] = n; else notes.push(`"${k}" invalid (${JSON.stringify(v)}); default ${def} used.`);
            } else if (typeof def === 'boolean') {
                if (typeof v === 'boolean') inputs[k] = v; else notes.push(`"${k}" invalid (${JSON.stringify(v)}); default ${def} used.`);
            } else {
                if (typeof v === 'string') inputs[k] = v; else notes.push(`"${k}" invalid (${JSON.stringify(v)}); default ${def} used.`);
            }
        });
        if ('conditionB' in d.inputs) notes.push(`Legacy key "conditionB" ignored (it came from the old unbound checkbox and never affected results); "condB" = ${inputs.condB} used.`);
        if (!d.version && inputs.Vuy !== 0) notes.push(`File saved by an older version: +Vuy now acts toward the TOP edge (c2), consistent with the anchor coordinates. Older versions checked +Vuy toward the BOTTOM edge (c4). Verify the sign of Vuy.`);
        const pr = (d.project && typeof d.project === 'object') ? d.project : {};
        const project = { ...DEFAULT_PROJECT };
        ['name', 'job', 'eng'].forEach(k => { if (typeof pr[k] === 'string') project[k] = pr[k]; });
        return { inputs, project, notes };
    };
````

## Appendix B — UI changes (unified diff against origin/main, components and App; line numbers are those of the file at the time of the fix)

````diff
@@ -317,7 +621,7 @@
     const InputRow = ({ label, value, onChange, unit, help }) => (
         <div className="mb-2">
             <div className="flex justify-between text-xs text-slate-400 mb-1"><span>{label}</span>{help && <span className="text-[9px] text-slate-500">{help}</span>}</div>
-            <div className="input-wrap"><input type="number" value={value} onChange={e => onChange(parseFloat(e.target.value))} className="input-field" /><span className="unit-label">{unit}</span></div>
+            <div className="input-wrap"><input type="number" value={(typeof value === 'number' && !isFinite(value)) ? '' : value} onChange={e => onChange(e.target.value === '' ? '' : parseFloat(e.target.value))} className="input-field" /><span className="unit-label">{unit}</span></div>
         </div>
     );
 
@@ -350,7 +654,8 @@
         const coneB = Math.min(slabB, cy + gy*scale + cone);
         
         const mag = Math.sqrt(Vux*Vux + Vuy*Vuy);
-        const angle = Math.atan2(Vuy, Vux) * 180 / Math.PI;
+        // SVG y points down; +Vuy acts toward +y (Top, c2), so negate for the drawing angle
+        const angle = Math.atan2(-Vuy, Vux) * 180 / Math.PI;
 
         return (
             <div className="w-full h-full relative bg-slate-950 overflow-hidden border-b border-slate-800">
@@ -373,7 +678,7 @@
                     <rect width="100%" height="100%" fill="url(#grid)" />
                     
                     <path d={`M ${slabL} ${slabT} L ${slabR} ${slabT} L ${slabR} ${slabB} L ${slabL} ${slabB} Z`} fill="#334155" stroke="#94a3b8" strokeWidth="2" opacity="0.5" />
-                    <rect x={coneL} y={coneT} width={Math.max(0, coneR-coneL)} height={Math.max(0, coneB-coneT)} fill={results.interaction > 1.2 ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"} stroke={results.interaction > 1.2 ? "#ef4444" : "#10b981"} strokeDasharray="4,4" />
+                    <rect x={coneL} y={coneT} width={Math.max(0, coneR-coneL)} height={Math.max(0, coneB-coneT)} fill={!results.pass ? "rgba(239,68,68,0.2)" : "rgba(16,185,129,0.2)"} stroke={!results.pass ? "#ef4444" : "#10b981"} strokeDasharray="4,4" />
                     
                     {/* Axes */}
                     <line x1={0} y1={cy} x2={W} y2={cy} stroke="cyan" strokeWidth="1" strokeDasharray="5,5" opacity="0.3" />
@@ -399,7 +704,7 @@
                     {view.shear && (Math.abs(Vux)>0 || Math.abs(Vuy)>0) && (
                         <g opacity="0.3">
                             {Math.abs(Vux)>0 && <line x1={cx} y1={cy} x2={cx+Vux/50} y2={cy} stroke="#facc15" strokeWidth="1" />}
-                            {Math.abs(Vuy)>0 && <line x1={cx} y1={cy} x2={cx} y2={cy+Vuy/50} stroke="#facc15" strokeWidth="1" />}
+                            {Math.abs(Vuy)>0 && <line x1={cx} y1={cy} x2={cx} y2={cy-Vuy/50} stroke="#facc15" strokeWidth="1" />}
                         </g>
                     )}
 
@@ -439,17 +744,10 @@
     // --- MAIN APP ---
 
     const App = () => {
-        const [project, setProject] = useState({ name: "Bridge A", job: "23-001", eng: "JD" });
-        const [inputs, setInputs] = useState({
-            fc: 4000, wc: 150, cracked: true, condB: true, seismic: false,
-            hef: 6.0, 
-            c1: 12.0, c2: 12.0, c3: 12.0, c4: 12.0, 
-            numAnchors: 4, sx: 6.0, sy: 6.0,
-            da: 0.75, grade: "F1554-36", type: "hex",
-            Nua: 5000, Vux: 2000, Vuy: 0, Mux: 1000, Muy: 0,
-            plateT: 0.5, plateLx: 2.0
-        });
+        const [project, setProject] = useState({ ...DEFAULT_PROJECT });
+        const [inputs, setInputs] = useState({ ...DEFAULT_INPUTS });
         const [reportMode, setReportMode] = useState(false);
+        const [loadMsg, setLoadMsg] = useState(null);   // { kind: 'error'|'info', lines: [] }
 
         const update = (k, v) => setInputs(p => ({...p, [k]: v}));
         const updateProj = (k, v) => setProject(p => ({...p, [k]: v}));
@@ -461,33 +759,30 @@
         };
 
         const handleSave = () => {
-            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({project, inputs}));
+            const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({project, inputs, version: 2}));
             const a = document.createElement('a'); a.href = dataStr; a.download = "anchor.json"; a.click();
         };
         const handleLoad = (e) => {
+            const file = e.target.files && e.target.files[0];
+            e.target.value = '';   // allow re-loading the same file
+            if (!file) return;
             const fr = new FileReader();
-            fr.onload = e => { const d = JSON.parse(e.target.result); setProject(d.project); setInputs(d.inputs); };
-            fr.readAsText(e.target.files[0]);
+            fr.onload = ev => {
+                try {
+                    const d = JSON.parse(ev.target.result);
+                    const r = sanitizeLoaded(d);
+                    setProject(r.project); setInputs(r.inputs);
+                    setLoadMsg(r.notes.length ? { kind: 'info', lines: [`Loaded "${file.name}" with notes:`, ...r.notes] } : null);
+                } catch (err) {
+                    setLoadMsg({ kind: 'error', lines: [`Could not load "${file.name}": ${err.message}`, 'Current inputs were kept.'] });
+                }
+            };
+            fr.onerror = () => setLoadMsg({ kind: 'error', lines: [`Could not read "${file.name}".`] });
+            fr.readAsText(file);
         };
 
-        const res = useMemo(() => {
-            const { da, grade, type, numAnchors, hef, fc, wc, c1, c2, c3, c4, sx, sy, cracked, condB, seismic, Nua, Vux, Vuy, Mux, Muy, plateT, plateLx } = inputs;
-            
-            const loads = distributeLoads(Nua, Vux, Vuy, Mux, Muy, numAnchors, sx, sy);
-            const steel = calculateSteel(da, grade, loads.val.N_max_bolt, loads.val.V_per_bolt, seismic);
-            const tBreak = calculateBreakoutTension(hef, fc, wc, c1, c2, c3, c4, sx, sy, numAnchors, cracked, condB, seismic, loads.val.e_prime_N);
-            const pullout = calculatePullout(fc, da, type, cracked, condB, seismic);
-            const blowout = calculateSideFaceBlowout(hef, c1, c2, c3, c4, fc, da, type, condB, seismic);
-            const sBreak = calculateBreakoutShear(hef, fc, c1, c2, c3, c4, da, numAnchors, sx, cracked, condB, seismic, Vux, Vuy);
-            const pryout = calculatePryout(tBreak.val.Ncb, hef, condB, seismic);
-            const plate = calculateBasePlate(loads.val.N_max_bolt, plateLx, steel.val.fy, plateT);
-
-            const utilN = Math.max(loads.val.N_max_bolt/steel.val.phiNsa_single, Nua/tBreak.val.phiNcb, loads.val.N_max_bolt/pullout.val.phiNpn, blowout.applicable ? loads.val.N_max_bolt/blowout.val.phiNsb : 0);
-            const utilV = Math.max(loads.val.V_per_bolt/steel.val.phiVsa_single, loads.val.V_resultant/sBreak.val.phiVcbg, loads.val.V_resultant/pryout.val.phiVcp);
-            const interaction = utilN + utilV;
-
-            return { loads, steel, tBreak, pullout, blowout, sBreak, pryout, plate, utilN, utilV, interaction };
-        }, [inputs]);
+        const res = useMemo(() => computeAll(inputs), [inputs]);
+        const ok = res.errors.length === 0;
 
         return (
             <div className="flex h-screen w-full bg-slate-900 text-slate-200 font-sans overflow-hidden">
@@ -507,6 +802,10 @@
                             <input value={project.job} onChange={e=>updateProj('job',e.target.value)} className="w-1/2 bg-slate-800 text-xs border-b border-slate-600 pb-1 placeholder-slate-500" placeholder="Job #"/>
                             <input value={project.eng} onChange={e=>updateProj('eng',e.target.value)} className="w-1/2 bg-slate-800 text-xs border-b border-slate-600 pb-1 placeholder-slate-500" placeholder="Eng"/>
                         </div>
+                        {loadMsg && <div className={`mt-2 p-2 rounded text-[10px] border ${loadMsg.kind==='error'?'bg-red-900/40 border-red-700 text-red-200':'bg-amber-900/30 border-amber-700 text-amber-200'}`}>
+                            {loadMsg.lines.map((l,i)=><div key={i}>{l}</div>)}
+                            <button onClick={()=>setLoadMsg(null)} className="mt-1 underline">dismiss</button>
+                        </div>}
                     </div>
                     
                     <div className="p-4 space-y-6">
@@ -526,14 +825,15 @@
                                 <button onClick={()=>update('type','hex')} className={`flex-1 py-1 text-[10px] border rounded ${inputs.type==='hex'?'bg-slate-600 border-slate-500':'bg-slate-800 border-slate-700'}`}>HEX</button>
                                 <button onClick={()=>update('type','hook')} className={`flex-1 py-1 text-[10px] border rounded ${inputs.type==='hook'?'bg-slate-600 border-slate-500':'bg-slate-800 border-slate-700'}`}>L-BOLT</button>
                             </div>
-                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={inputs.seismic} onChange={e=>update('seismic',e.target.checked)}/> Seismic (0.75)</label>
-                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={inputs.conditionB} onChange={e=>update('conditionB',e.target.checked)}/> Cond. B (No Reinf)</label>
+                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={inputs.seismic} onChange={e=>update('seismic',e.target.checked)}/> Seismic (0.75 on concrete tension, §17.10.5.4)</label>
+                            <label className="flex items-center gap-2 text-xs cursor-pointer"><input type="checkbox" checked={inputs.condB} onChange={e=>update('condB',e.target.checked)}/> Cond. B (No Reinf) — breakout/blowout φ 0.70; unchecked = Cond. A 0.75</label>
                         </div>
 
                         {/* 2. GEOMETRY */}
                         <div className="space-y-2">
                             <h2 className="text-xs font-bold text-slate-500 border-b border-slate-700 pb-1">2. GEOMETRY</h2>
                             <InputRow label="Embedment (hef)" value={inputs.hef} onChange={v=>update('hef',v)} unit="in" />
+                            <InputRow label="Member thickness (ha)" value={inputs.ha} onChange={v=>update('ha',v)} unit="in" help="ψh,V / A_Vc depth" />
                             <div className="grid grid-cols-2 gap-2">
                                 <InputRow label="Left (c1)" value={inputs.c1} onChange={v=>update('c1',v)} unit="in" />
                                 <InputRow label="Right (c3)" value={inputs.c3} onChange={v=>update('c3',v)} unit="in" />
@@ -564,11 +864,19 @@
                                     <option value="1.0">1.0"</option>
                                 </select>
                             </div>
+                            <div className="mb-2">
+                                <label className="text-xs text-slate-400">Shear edge reinf. ψc,V (cracked; §17.7.2.5)</label>
+                                <select value={inputs.edgeReinf} onChange={e=>update('edgeReinf',e.target.value)} className="input-field mt-1">
+                                    {Object.entries(EDGE_REINF).map(([k, o]) => <option key={k} value={k}>{o.label}</option>)}
+                                </select>
+                            </div>
                             <div className="p-2 border border-slate-700 rounded bg-slate-800/30">
                                 <div className="text-[10px] font-bold text-slate-500 mb-2">BASE PLATE CHECK</div>
                                 <div className="grid grid-cols-2 gap-2">
                                     <InputRow label="Thick (t)" value={inputs.plateT} onChange={v=>update('plateT',v)} unit="in" />
                                     <InputRow label="Cantilever (lx)" value={inputs.plateLx} onChange={v=>update('plateLx',v)} unit="in" />
+                                    <InputRow label="Plate Fy" value={inputs.plateFy} onChange={v=>update('plateFy',v)} unit="psi" />
+                                    <InputRow label="Width (b_eff)" value={inputs.plateBeff} onChange={v=>update('plateBeff',v)} unit="in" />
                                 </div>
                             </div>
                         </div>
@@ -585,25 +893,27 @@
                                 <InputRow label="Moment X (Mux)" value={inputs.Mux} onChange={v=>update('Mux',v)} unit="lb-in" />
                                 <InputRow label="Moment Y (Muy)" value={inputs.Muy} onChange={v=>update('Muy',v)} unit="lb-in" />
                             </div>
+                            <div className="text-[10px] text-slate-500 leading-snug">Signs: +x → Right (c3), +y → Top (c2). +Nua = tension. +Vux acts toward c3, +Vuy toward c2. +Mux puts the top (+y) anchors in tension; +Muy puts the right (+x) anchors in tension.</div>
                         </div>
                     </div>
                 </div>
 
                 {/* CENTER VISUALIZATION */}
                 <div className={`flex-1 bg-black flex flex-col ${reportMode?'hidden':''}`}>
-                    <Visualization inputs={inputs} results={res} />
+                    {ok ? <Visualization inputs={inputs} results={res} /> : <div className="w-full h-full flex items-center justify-center bg-slate-950 border-b border-slate-800"><div className="p-4 bg-red-900/40 border border-red-700 rounded text-sm text-red-200 max-w-md"><div className="font-bold mb-1">Input errors — no results calculated</div>{res.errors.map((m,i)=><div key={i}>• {m}</div>)}</div></div>}
                     <div className="p-4 bg-slate-900 text-center relative z-10 border-t border-slate-800">
-                        <div className="inline-block px-6 py-2 bg-slate-800 rounded border border-slate-700 shadow-xl">
+                        {ok ? <div className="inline-block px-6 py-2 bg-slate-800 rounded border border-slate-700 shadow-xl">
                              <div className="text-xs text-slate-400 uppercase tracking-widest mb-1">Interaction Ratio</div>
                              <div className="text-3xl font-black flex gap-2 items-baseline justify-center font-mono">
                                 <span className={res.utilN > 1 ? "text-red-500" : "text-slate-300"}>{fmt(res.utilN,2)}</span>
                                 <span className="text-slate-600 text-lg">+</span>
                                 <span className={res.utilV > 1 ? "text-red-500" : "text-slate-300"}>{fmt(res.utilV,2)}</span>
                                 <span className="text-slate-600 text-lg">=</span>
-                                <span className={res.interaction>1.2?"text-red-500":"text-emerald-400"}>{fmt(res.interaction,2)}</span>
+                                <span className={(res.utilN + res.utilV)>1.2?"text-red-500":"text-emerald-400"}>{fmt(res.utilN + res.utilV,2)}</span>
                              </div>
-                             <div className="text-[10px] mt-1 text-slate-500">Limit: 1.2</div>
-                        </div>
+                             <div className="text-[10px] mt-1 text-slate-500">{res.intRule}</div>
+                             <div className={`text-sm font-bold mt-1 ${res.pass?'text-emerald-400':'text-red-500'}`}>{res.pass ? 'OK — all checks ≤ 1.0 and §17.8 satisfied' : `NG — ${[...res.failing.map(c=>c.label + ' ' + fmt(c.ratio,2)), ...(res.interactionOK ? [] : [`interaction ${fmt(res.interaction,2)} > ${res.intLimit}`])].join('; ')}`}</div>
+                        </div> : <div className="inline-block px-6 py-2 text-red-400 font-bold">NO RESULT — fix input errors</div>}
                         <button onClick={()=>setReportMode(true)} className="ml-6 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded text-sm font-bold text-white shadow-lg transition-colors">VIEW REPORT</button>
                     </div>
                 </div>
@@ -624,13 +934,19 @@
                             </div>
                         </div>
 
-                        <div className="space-y-8">
+                        {!ok && <div className="p-4 bg-red-900/40 border border-red-700 rounded text-sm text-red-200"><div className="font-bold mb-1">Input errors — no results calculated</div>{res.errors.map((m,i)=><div key={i}>• {m}</div>)}</div>}
+                        {res.warnings && res.warnings.length > 0 && <div className="mb-6 p-3 bg-amber-900/20 border border-amber-700 rounded text-xs text-amber-200 space-y-1">
+                            <div className="font-bold">Warnings / notes</div>
+                            {res.warnings.map((m,i)=><div key={i}>• {m}</div>)}
+                        </div>}
+                        {ok && <div className="space-y-8">
                             <div>
                                 <h3 className="text-blue-400 font-bold border-b border-slate-600 mb-4 pb-1 uppercase tracking-wider text-sm">1. Tension Design</h3>
-                                
+
                                 <CalcBox title="Load Distribution" data={
                                     <>
                                         <EquationLine label="Max Bolt Tension" tex={res.loads.tex.N_dist}/>
+                                        <EquationLine label="Tension on Anchors in Tension (breakout demand)" tex={res.loads.tex.N_sumT}/>
                                         {inputs.numAnchors === 4 && <div className="mt-2">
                                             <div className="text-xs text-slate-400 mb-1 font-bold">Individual Anchor Forces:</div>
                                             <AnchorTable anchors={res.loads.val.anchors} N_max={res.loads.val.N_max_bolt} />
@@ -639,16 +955,29 @@
                                 } />
 
                                 <CalcBox title="Steel & Pullout" data={<>
+                                    <EquationLine label="Capped Tensile Strength" tex={res.steel.tex.futa} refCode="17.6.1.2"/>
                                     <EquationLine label="Steel Strength" tex={res.steel.tex.phiNsa} refCode="17.6.1.2"/>
-                                    <EquationLine label="Pullout Strength" tex={res.pullout.tex.phiNpn} refCode="17.6.3.1"/>
+                                    <EquationLine label="Pullout (nominal)" tex={res.pullout.tex.Npn} refCode="17.6.3.1"/>
+                                    <EquationLine label="Pullout Strength (φ = 0.70)" tex={res.pullout.tex.phiNpn} refCode="17.6.3.1"/>
                                 </>} />
-                                <CalcBox title="Concrete Breakout" data={<>
+                                <CalcBox title="Concrete Breakout" data={res.tBreak.applicable ? <>
+                                    <EquationLine label="Lightweight Factor" tex={res.tBreak.tex.lambda} refCode="17.6.2.2"/>
+                                    <EquationLine label="Embedment Used" tex={res.tBreak.tex.hef} refCode="17.6.2.1.2"/>
                                     <EquationLine label="Basic Strength" tex={res.tBreak.tex.Nb} refCode="17.6.2.2"/>
+                                    <EquationLine label="Single-Anchor Area" tex={res.tBreak.tex.Anco} refCode="17.6.2.1"/>
                                     <EquationLine label="Projected Area" tex={res.tBreak.tex.Anc} refCode="17.6.2.1"/>
+                                    <EquationLine label="Eccentricity Factor" tex={res.tBreak.tex.psi_ec} refCode="17.6.2.3.1"/>
+                                    <EquationLine label="Edge Factor" tex={res.tBreak.tex.psi_ed} refCode="17.6.2.1"/>
+                                    <EquationLine label="Cracking Factor" tex={res.tBreak.tex.psi_c} refCode="17.6.2.1"/>
+                                    <EquationLine label="Nominal Breakout" tex={res.tBreak.tex.Ncb} refCode="17.6.2.1"/>
                                     <EquationLine label="Breakout Strength" tex={res.tBreak.tex.phiNcb} refCode="17.6.2.1"/>
-                                </>} />
+                                    <EquationLine label="Breakout Ratio" tex={res.tBreak.tex.ratio} refCode="17.6.2.1"/>
+                                </> : <EquationLine label="Breakout" tex={res.tBreak.tex.none}/>} />
                                 {res.blowout.applicable && <CalcBox title="Side-Face Blowout" data={<>
+                                    <EquationLine label="Single Anchor (with corner factor)" tex={res.blowout.tex.Nsb} refCode="17.6.4.1"/>
+                                    <EquationLine label="Group Factor" tex={res.blowout.tex.Nsbg} refCode="17.6.4.1"/>
                                     <EquationLine label="Blowout Strength" tex={res.blowout.tex.phiNsb} refCode="17.6.4.1"/>
+                                    <EquationLine label="Blowout Ratio" tex={res.blowout.tex.ratio} refCode="17.6.4.1"/>
                                 </>} />}
                             </div>
 
@@ -656,12 +985,18 @@
                                 <h3 className="text-blue-400 font-bold border-b border-slate-600 mb-4 pb-1 uppercase tracking-wider text-sm">2. Shear Design</h3>
                                 <CalcBox title="Steel & Pryout" data={<>
                                     <EquationLine label="Steel Shear" tex={res.steel.tex.phiVsa} refCode="17.7.1.2"/>
-                                    <EquationLine label="Pryout" tex={res.pryout.tex.phiVcp} refCode="17.7.3.1"/>
+                                    <EquationLine label="Pryout Breakout Basis" tex={res.pryout.tex.Ncp} refCode="17.7.3.1"/>
+                                    <EquationLine label="Pryout (φ = 0.70)" tex={res.pryout.tex.phiVcp} refCode="17.7.3.1"/>
                                 </>} />
-                                <CalcBox title="Concrete Breakout" data={<>
+                                <CalcBox title="Concrete Breakout" data={res.sBreak.val.gov ? <>
+                                    <EquationLine label="Governing Edge" tex={res.sBreak.tex.gov} refCode="17.7.2.1"/>
                                     <EquationLine label="Basic Shear" tex={res.sBreak.tex.Vb} refCode="17.7.2.2"/>
+                                    <EquationLine label="Projected Area" tex={res.sBreak.tex.Avc} refCode="17.7.2.1"/>
+                                    <EquationLine label="Modification Factors" tex={res.sBreak.tex.psi} refCode="17.7.2.1"/>
+                                    <EquationLine label="Nominal Breakout" tex={res.sBreak.tex.Vcbg} refCode="17.7.2.1"/>
                                     <EquationLine label="Shear Capacity" tex={res.sBreak.tex.phiVcbg} refCode="17.7.2.1"/>
-                                </>} />
+                                    <EquationLine label="Breakout Ratio (per edge)" tex={res.sBreak.tex.ratio} refCode="17.7.2.1"/>
+                                </> : <EquationLine label="Breakout" tex={res.sBreak.tex.none}/>} />
                             </div>
 
                             <div>
@@ -676,12 +1011,31 @@
                                     </div>
                                     <div className="bg-slate-900 p-3 rounded border border-slate-700">
                                         <div className="text-xs text-slate-500 mb-1">Min Edge Dist</div>
-                                        <div className="font-mono text-lg">{fmt(res.tBreak.val.c_min, 2)} <span className="text-xs text-slate-500">in</span></div>
+                                        <div className="font-mono text-lg">{fmt(res.cminAll, 2)} <span className="text-xs text-slate-500">in</span></div>
                                         <div className="text-xs text-slate-500 mt-1">Actual</div>
                                     </div>
                                 </div>
+                                {res.plate.tex.treq.sub && <EquationLine label="Base Plate (simplified cantilever, b_eff input)" tex={res.plate.tex.treq}/>}
+                                <table className="w-full text-xs text-left border-collapse mt-2">
+                                    <thead><tr className="text-slate-400 border-b border-slate-600"><th className="py-1">Check</th><th className="py-1">ACI 318-19</th><th className="py-1 text-right">Ratio</th></tr></thead>
+                                    <tbody>
+                                        {res.checks.map(c => (
+                                            <tr key={c.key} className="border-b border-slate-700/50">
+                                                <td className="py-1 text-slate-300">{c.label}</td>
+                                                <td className="py-1 text-slate-500">{c.ref === 'plate' ? '—' : '§' + c.ref}</td>
+                                                <td className={`py-1 text-right font-mono ${c.ratio>1?'text-red-500 font-bold':'text-slate-300'}`}>{c.na ? 'n/a' : fmt(c.ratio,3)}</td>
+                                            </tr>
+                                        ))}
+                                        <tr className="border-b border-slate-700/50">
+                                            <td className="py-1 text-slate-300">Interaction: {res.intRule}</td>
+                                            <td className="py-1 text-slate-500">§17.8</td>
+                                            <td className={`py-1 text-right font-mono ${res.interactionOK?'text-slate-300':'text-red-500 font-bold'}`}>{fmt(res.interaction,3)} / {fmt(res.intLimit,1)}</td>
+                                        </tr>
+                                    </tbody>
+                                </table>
+                                <div className={`mt-3 text-sm font-bold ${res.pass?'text-emerald-500':'text-red-500'}`}>{res.pass ? 'RESULT: OK' : 'RESULT: NG'}</div>
                             </div>
-                        </div>
+                        </div>}
 
                         {reportMode && <button onClick={()=>window.print()} className="mt-8 w-full py-4 bg-slate-700 font-bold no-print hover:bg-slate-600 text-white rounded shadow-lg">PRINT TO PDF</button>}
                     </div>
````
