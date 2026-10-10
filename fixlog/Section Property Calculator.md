# Fix log — Section Property Calculator.html

Governing basis: mechanics of materials (section properties by exact area integrals), AISC Shapes Database v16.0 (rolled-shape dimensions and tabulated properties), thin-walled beam theory for torsion: AISC Design Guide 9, *Torsional Analysis of Structural Steel Members* (Seaburg & Carter, 1997) and Vlasov sectorial coordinates; Roark's *Formulas for Stress and Strain* (Young & Budynas, 7th Ed.) Table 10.7 for the solid rectangle; AISC 360-16 Eq. E4-9 form for r̄o. No design code checks (no resistance or load factors) are made by this tool.

**Thin-wall torsion results (J, Cw, shear centre) are approximations and carry a "thin-wall — verify" flag in the tool.**

## 2026-10-10 — PR: claude/section-props-p1 (PR link added after merge)

### C1. New tool: Section Property Calculator (Phase 1: properties only)   [new tool]

- **Type:** new file `Section Property Calculator.html` (single file, opens from `file://`, no build step). CDN: KaTeX 0.16.11 (pinned, `cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js` and `.css`; already used by Steel Beam Design and Timber Beam Check). Drawing is plain inline SVG. No other libraries. Without KaTeX the equations fall back to plain text.
- **Look and feel:** the CSS, header, input/result tab bars, calc-sheet blocks (`calc`, `mkSec`, `tblEl`), focus-preserving inputs and print-report pattern are copied from `Timber Beam Check.html` (which follows Steel Beam Design). The KaTeX helper block is copied unchanged from `Steel Beam Design - AISC 15th.html` (as in Timber Beam Check).
- **Storage (new keys only, prefix `spc_`):** `spc_autosave_v1` (the model), `spc_projects_v1` (map name → `{t, d}`), `spc_inputTab_v1` (selected input tab). File: JSON with `_schema: "section-property-calculator"`, `version: 1`, `app`, `savedAt`, `project`, `parts[]`, `contacts.off[]`, `settings`, `q`, `ui`. All lengths are stored in inches whatever the display units. Open file refuses another `_schema` or a newer version.
- **Hand-off:** "← All tools" link, the BridgeXfer v1 helper (verbatim, HANDOFF.md §5) and the project-info glue (`ProjMetaUI`, verbatim from Timber Beam Check) on channel `bridgeSuite.v1.projectMeta` only (receiver id `sectionProps`; field map in HANDOFF.md §4.1). No other channel in Phase 1.
- **Other copies (CLAUDE.md §3):**
  - AISC Shapes Database v16.0 block `DBVER`, `DBKEYS`, `DBKIND`, `DB` (W, M, S, HP, C, MC, HSS rectangular, HSS round, Pipe): copied unchanged from `Steel Beam Design - AISC 15th.html` (anchor `const DBVER="AISC Shapes Database v16.0";`).
  - BridgeXfer v1 helper: same as every tool that uses it (HANDOFF.md §5).
  - `ProjMetaUI` glue: same as BasePlateAnchorDesigner, Concrete Anchor, Pile Designer, Spread Footing, Timber Beam Check; only the field map `SPC_PROJ_MAP` is this tool's.
  - KaTeX helpers (`TEX_CMD` … `tex()`): same as Steel Beam Design and Timber Beam Check.

#### Data not copied from another tool — needs the engineer's acceptance

L (137 shapes), WT (289), MT (14), ST (28) and double angles 2L (639 rows: A, y, Ix, Iy for gaps 0, 3/8, 3/4 in, LLBB/SLBB) are **not in any tool in the repo**, and aisc.org could not be reached from the build environment. They were taken from the AISC Shapes Database v16.0 as transcribed in the open-source Python package **steelpy 1.1.1** (PyPI, Apache-2.0). Cross-checks made before using it:

- steelpy's W, M, S, HP, C and MC rows are **identical to Steel Beam Design's v16.0 data on every row (395 shapes) and every common field** (Wt, A, d, bf, tf, tw, kdes, Ix, Zx, Sx, rx, Iy, Zy, Sy, ry, J, Cw, rts, ho, Wno, Sw1, Qf, Qw; channels also x̄, eo).
- Its L, WT, MT and ST rows are identical to the independent **v15.0** transcription in **efficalc 1.2.7** (MIT) for every shape present in both (A, d, b/bf, t/tw/tf, Ix, Iy, Iz, J, Cw, x, y, kdes), except shapes added in v16.0 and one rounding (ST2X4.75 Cw 0.00995 vs 0.01).
- Leg dimensions and thickness are taken from the designation (e.g. L4X4X1/2 → 4, 4, 0.5); the tabulated decimal t is within 0.006 in of it.
- Stored in the tool as `DBX` / `DBX_KEYS` (comment in the file states the source). **Verify** any tabulated value used for design against the printed Manual.

#### Method as implemented (units in, in², in³, in⁴, in⁶; kip for V)

- **Geometry.** Each part = exact polygons and circles in its own frame, centred on its gross centroid; holes are separate parts with negative area. Global = (x, y) + R(rot)·M·local, M = diag(−1, 1) when mirrored. Rolled shapes are their plates: I (W, M, S, HP) a 12-vertex outline from d, bf, tf, tw; C/MC an 8-vertex outline (average tf, flange slope neglected); L two legs (heel at the corner, leg1 vertical); WT/MT/ST flange + stem; HSS rectangular a rounded tube (tdes, outside radius 2tdes, inside tdes, arcs as 24 chords — the AISC table basis as understood, **verify**); HSS round / Pipe an annulus (OD, tdes). Root fillets and toe radii are neglected.
- **Elastic.** Polygon integrals by Green's theorem: A = ½Σ(xᵢyᵢ₊₁ − xᵢ₊₁yᵢ), ∫x dA = ⅙Σ(xᵢ + xᵢ₊₁)cᵢ, ∫x² dA = ¹⁄₁₂Σ(xᵢ² + xᵢxᵢ₊₁ + xᵢ₊₁²)cᵢ, ∫xy dA = ¹⁄₂₄Σ(xᵢyᵢ₊₁ + 2xᵢyᵢ + 2xᵢ₊₁yᵢ₊₁ + xᵢ₊₁yᵢ)cᵢ, cᵢ = xᵢyᵢ₊₁ − xᵢ₊₁yᵢ; circles exact (πr⁴/4). Each part about its own centroid, then parallel axis with modulus ratio n: A = Σ nA, Ix = Σ n(Ixo + A dy²), Iy = Σ n(Iyo + A dx²), Ixy = Σ n(Ixyo + A dx dy) (Ixy = ∫xy dA). S = I/c to the extreme material fibre (top, bottom, left, right); r = √(I/A).
- **Principal axes.** I₁,₂ = (Ix + Iy)/2 ± √(((Ix − Iy)/2)² + Ixy²); θp = ½·atan2(−2Ixy, Ix − Iy) from +x to axis 1, CCW. S₁, S₂, Z₁, Z₂ about the principal axes; r_min = √(I₂/A).
- **AISC tabulated option (per rolled part).** Uses the tabulated A, Ix, Iy at the tabulated centroid (C: x̄ from the back of web; L: x, y from the heel; tee: y from the flange face), rotated with the part (I′ = T·I·Tᵀ); for angles |Ixy| = √(((Iw − Iz)/2)² − ((Ix − Iy)/2)²) with Iw = Ix + Iy − Iz, sign from the geometry. Plastic, Q and torsion keep the plate model. Default off (setting "New rolled shapes use AISC tabulated").
- **Plastic.** PNA by bisection (to 1e-13 relative) on the exact n-weighted area on one side of the line (polygons clipped by the half-plane; circles by the circular-segment formulas A = r²acos(d/r) − d√(r² − d²), first moment ⅔(r² − d²)^{3/2}); Z = A₁d₁ + A₂d₂ about the PNA. For x, y and the principal axes. Shape factors Z/S_min.
- **Q and shear flow.** Q = first moment, about the centroidal axis, of the area on one side of a full-width cut (above a horizontal / right of a vertical cut). q = V·Q/I when Ixy ≈ 0; otherwise q = Vy(Iy·Qx − Ixy·Qy)/(Ix·Iy − Ixy²) (and the x counterpart). τavg = q/b, b = material length on the cut.
- **Torsion J (thin-wall).** Centre-line elements: plates along their long side (t = short side); rolled shapes' standard centre-line model (W web hₒ = d − tf; C flanges bf − tw/2); tubes on the mid-thickness line (rect. tube corner radius r − t/2 as 6 chords, round tube 48 chords when connected). Touching parts (within the contact tolerance, default 0.001 in) are connected unless the contact is switched off on the Torsion tab: elements at an angle join at the intersection of their centre lines (extended where needed); plates in face contact are combined over the overlap into one element of thickness t₁ + t₂ on their combined mid-plane (continuous connection along both edges assumed); other contacts get a rigid link. Closed cells = interior faces of the planar centre-line graph. One cell: J = 4A_m²/∮ds/t (Bredt); several: ∮ᵢ q ds/t = 2A_m,i (Gθ = 1), J = 2ΣA_m,i qᵢ. Open branches add Σ b t³/3 (DG9); b t³/3 of cell walls not added. Separate pieces: J = Σ. Single rectangle alone: J = b t³[⅓ − 0.21(t/b)(1 − t⁴/12b⁴)] (Roark Table 10.7 case 4); solid round πd⁴/32; round tube π(D⁴ − d⁴)/32 (exact). Custom polygons, round bars connected to other parts: n/a. Holes ignored in torsion (stated on the tab). Elements with b/t < 10 are flagged.
- **Shear centre and Cw (open, one connected piece).** Sectorial coordinate ω_B over the centre-line tree, pole B = centroid of the centre-line model; xₒ = (Iy·Iωx − Ixy·Iωy)/(Ix·Iy − Ixy²), yₒ = (Ixy·Iωx − Ix·Iωy)/(Ix·Iy − Ixy²) (offsets from B; Iωx = ∫ω y t ds, Iωy = ∫ω x t ds); Cw = ∫ωₙ² t ds with ωₙ = ω_S − (1/A)∫ω_S t ds. Linear-segment integrals exact. Closed cells, separate pieces: "n/a — not computed". r̄ₒ = √(xₒ² + yₒ² + (Ix + Iy)/A).

#### Worked check cases (all reproduced live on the Validation tab, 60 checks)

1. **Rectangle 6 × 10 in:** A = 60, Ix = 6·10³/12 = 500, Iy = 180, Sx = 100, Zx = 6·10²/4 = 150, Zy = 90 in³; J (b = 10, t = 6) = 10·216·[⅓ − 0.21·0.6·(1 − 0.6⁴/12)] = 450.78 in⁴; Q at the centroid = 6·5·2.5 = 75 in³. Tool: identical (relative difference < 1e-15).
2. **W14X90 from three plates** (bf 14.5, tf 0.71, tw 0.44, d 14.0, h = 12.58): A = 2(14.5)(0.71) + 12.58(0.44) = 26.125 in²; Ix = [14.5(14)³ − 14.06(12.58)³]/12 = 983.04 in⁴; Iy = 360.84; Zx = 14.5(0.71)(13.29) + 0.44(12.58)²/4 = 154.23 in³; J = [2(14.5)(0.71)³ + 13.29(0.44)³]/3 = 3.837 in⁴; Cw = 0.71(14.5)³(13.29)²/24 = 15,929 in⁶. Tool = hand exactly; the rolled W14X90 part gives the same. vs AISC 26.5 / 999 / 362 / 157 / 4.06 / 16,000: −1.4 %, −1.6 %, −0.3 %, −1.8 %, −5.5 % (fillets), −0.4 %.
3. **2L4X4X1/2, long legs back-to-back, 3/8 gap:** single angle (plate model) A = 3.75, ȳ = x̄ = 1.1833; A = 7.50, Ix = 11.123, Iy = 2[Iy,L + 3.75(1.1833 + 0.1875)²] = 25.217 in⁴. AISC 2L table: 7.50, 11.0, 25.1 (+1.1 %, +0.5 %).
4. **Box 10 × 6 out-to-out, flanges 1/2, webs 3/8:** a = 9.625, b = 5.5, J = 2(0.5)(0.375)(9.625)²(5.5)²/(9.625·0.375 + 5.5·0.5) = 165.25 in⁴ by automatic cell detection (exact). HSS10X6X1/2: Bredt with the 1.5t centre-line corner radius 176.14 vs closed form 176.18 (arcs as chords) vs AISC 176; A 13.46 vs 13.5, Ix 171.3 vs 171.
5. **C15X50 shear centre:** b = 3.72 − 0.358 = 3.362, h = 14.35: e = 3b²tf/(6b·tf + h·tw) = 0.9425 from the web centre line, eₒ = 0.5845 in from the back of the web (AISC 0.583, +0.25 %); Cw = tf b³h²/12·(3b·tf + 2h·tw)/(6b·tf + h·tw) = 491.27 in⁶ (AISC 492).
6. **Tee, flange 8 × 1 on stem 1/2 × 8:** A = 12, A/2 = 6 lies in the flange 0.75 in below the top → PNA y = 8.25 in; Zx = 6(0.375) + 2(0.125) + 4(4.25) = 19.5 in³; Zy = 1(8)²/4 + 8(0.5)²/4 = 16.5 in³. Tool exact.
7. Rotation/mirror invariants (L8X4X1/2), 8. circles, tubes, a round hole in a plate (closed forms), 9. cover-plated W14X90 with 14.5 × 1 plates: J = [2(14.5)(1.71)³ + 14.29(0.44)³]/3 = 48.741 in⁴, Cw = 1.71(14.5)³(14.29)²/24 = 44,356 in⁶ (tool exact).

**Default example (opens on first use):** W21X62 with a C15X33.9 cap channel (web on the top flange, flanges down). W1 A = 2(8.24)(0.615) + 19.77(0.4) = 18.043; C1 A = 9.90 at y = 10.5 + 0.4 − 0.8697 = 10.030; A = 27.943 in², ȳ = 9.90 × 10.030 / 27.943 = 3.5536 in, Ix = 1310.81 + 9.84 + 227.86 + 415.28 = 1963.8 in⁴, Iy = 370.86 in⁴, Zx = 187.70 in³ (PNA y = 8.647 in), J = 4.666 in⁴, Cw = 12,658 in⁶, yₒ = +6.115 in above the centroid; Q at the centroid 105.78 in³, with V = 50 kip q = 50 × 105.78 / 1963.8 = 2.693 kip/in.

#### How verified

- `node --check` of every inline script; headless Chromium (Playwright, KaTeX 0.16.11 served locally): no console errors; Validation tab 60/60 pass.
- Independent Node script (no engine formulas reused): 60 random star-shaped polygons (1–3 parts, random rotation, mirror and n) vs a triangle-fan implementation — A, x̄, ȳ, Ix, Iy, Ixy within 1e-9; Zx and PNA vs numerical slicing (40,000 strips) within 2e-4; polygon + triangle hole + round hole exact; monosymmetric plate girder shear centre h·I₂/(I₁ + I₂) and Cw = h²I₁I₂/(I₁ + I₂) exact; Z-section Cw by direct integration exact (and the literature formula t b³h²(b + 2h)/(12(2b + h)) reproduced); symmetric two-cell box J = single outer cell; unsymmetric two-cell box vs a 2 × 2 hand solution exact; rotated + mirrored channel shear centre transforms with the part; star angle, 4-angle laced column, double channels; all 1,660 shapes run (tabulated option reproduces A, Ix, Iy exactly; plate-model differences listed below). 410 checks, 0 failures.
- Browser interaction tests (49): flip H of an angle = reflection about its own centroid; flip V; rotate 90° keeps A and swaps Ix/Iy; rotate by angle keeps I₁, I₂; mirror copy about an edge doubles A; undo/redo restore exactly; drag snaps a corner exactly onto another part's corner; arrow nudge; align / place touching; contact switch-off; box select; copy/paste/delete; polygon by clicking; all eight templates; Q-cut drag; save → open file round trip with identical results; autosave after reload; wrong `_schema` refused; named projects; Share/Use shared project info; mm units; print report.
- Screenshots at 1500 px and 400 px (no horizontal page scroll at 400 px).

#### Plate model vs AISC tables (largest differences over all shapes; informational)

A / Ix / J: W 2.7 % / 4.1 % / 18.7 % (W40X149); M 9.0 % / 9.4 % / 50 % (M3X2.9); S 1.9 / 1.1 / 27 %; HP 4.5 / 5.1 / 30 %; C 1.7 / 0.8 / 20 %; MC 1.7 / 1.6 / 16 %; L 1.6 / 2.2 / 14 %; WT 2.7 / 1.7 / 18 %; MT 4.7 / 0.9 / 29 %; ST 1.9 / 3.9 / 27 %; HSS rect 0.4 / 1.0 / 0.5 %; HSS round 0.7 / 1.9 / 1.7 %; Pipe 3.4 / 3.2 / 3.2 % (Pipe20XS). J differences come from the fillets, which add to J; the thin-wall J is lower (conservative for torsional stiffness, unconservative for warping/torsion stress estimates that use J in a denominator — verify).

#### Open items (decisions for the engineer)

- O1. Accept steelpy 1.1.1 as the source of the L, WT, MT, ST and 2L data (cross-checks above), or supply the AISC v16.0 spreadsheet.
- O2. HSS corner radius basis 2tdes (outside) / tdes (inside) — confirm against the Manual.
- O3. Face-contact plates are combined into one thicker element for J and Cw (continuous edge welds assumed). For stitch-bolted or intermittently welded plates the user must switch the contact off. Confirm this default.
- O4. J of cell walls' own b t³/3 is not added to the Bredt term (conventional); stocky open elements (b/t < 10) use b t³/3 without end correction (flagged).
- O5. Holes are ignored in torsion (gross section), with a note.
- O6. Flip/rotate of several selected parts acts about the selection's bounding-box centre (one part: about its centroid).

## 2026-10-10 — PR: claude/spc-no-overlap (PR link added after merge)

### N1. Parts may not overlap; magnetic snap to each other   [drawing behaviour — no change to any formula or computed property]

- **Engineer's request (2026-10-10):** "Don't allow overlap of elements; instead, if they get too close they should snap to each other."
- **Problem:** solid parts could be dragged, pasted, rotated or typed on top of each other. The overlap was only a warning, and the common area was counted twice in every property.
- **Change (drawing only):** with **Prevent overlap** on (default), solid parts may touch but their materials may not intersect. A hole must stay inside one solid part.
  - **Drag:** the part stops at contact and slides along the contact edge ("collide and slide"). It cannot pass through thin parts, even on a fast drag.
  - **Arrow-key nudge:** stops at contact. Pushing again into the contact shows "Not moved: … would overlap …".
  - **Paste, duplicate, mirror copy, add part / rolled shape / polygon, template "Add to drawing":** the new parts go to the nearest free position, touching the part they would have overlapped. The toast gives the shift.
  - **Rotate / flip:** if the result overlaps, it is moved to the nearest free position, touching (chosen over refusing, because it keeps the requested orientation; the toast gives the shift). If no free position exists, the action is undone with a message.
  - **Align / "place touching" (context menu) and the multi-selection "Move by":** not applied if the result would overlap. For "Move by", OK = place touching instead.
  - **Part panel (position, edges, rotation, mirror, dimensions, family/shape, hole flag, polygon vertices):** a value that would overlap is not applied. The field turns red and a box shows "Not applied: PL2 would overlap PL1" with **Place touching** (apply the value, then move to the nearest free position) and **Turn off Prevent overlap**.
  - **Holes:** a dragged hole stops at the edge of its part. Holes lying inside a moved, rotated or flipped part move with it.
  - **Magnetic snap (drag):** within the snap radius (Settings → Snap radius, default 10 px on screen), parallel edges with opposite outward normals become coincident (to round-off). Then the ends or centres of the two edges, or of the two parts' overall extents, line up along the contact if they are within the same radius (e.g. flange tip flush with the plate edge, or centred on the plate). Round bars snap tangent to edges and to other round bars. While snapping, the contact edge is drawn in magenta and the alignment as a dashed magenta guide. Corner/midpoint snapping (Phase 1) and then the grid remain as lower priorities. Alt suspends snapping.
- **Setting:** Settings → "Prevent overlap", and a "No overlap" toolbar toggle. Per browser, **not project data**: new localStorage key `spc_preventOverlap_v1` = `'1'` / `'0'` (absent = on). No existing key or file format changed. The status line shows "no overlap" or "overlap allowed".
- **Geometry (new block `NOV`, engine anchor `/* ---------------- no-overlap geometry`, after `function ptSegDistPoly`):** each part is its outer boundary minus its own void (tube interior), in the same global geometry the properties use (`partGlobal`). Overlap area is exact: polygons by convex pieces (Sutherland–Hodgman); circle ∩ polygon by circular segments; circle ∩ circle by the lens formula; inclusion–exclusion for voids. "Overlap" = common area > 1e-9 × max(0.01, smaller part area) in², so touching parts and round-off are not flagged. Collision uses exact contact times (vertex–edge, circle–edge, circle–vertex, circle–circle) and tests the overlap between consecutive contact times. The nearest free position is the exact escape distance along 24 directions plus the edge normals of the conflicting parts, taking the shortest.
- **Projects that already have overlapping parts** (saved before this change, or with the setting off): they load **unchanged** (CLAUDE.md §5). The toast says "N overlapping pair(s) (not moved)". The "Check the model" warning lists each pair with a **Fix: move apart** button, which moves the smaller part of the pair to the nearest position where it touches but overlaps nothing. Until fixed, the properties are computed as before, with the overlap counted twice.

#### Engine change: overlap warning (`overlapChecks`, anchor `function overlapChecks(R) {`)

Before:
```js
    const P = R.parts;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = P[i], b = P[j]; if (a.pt.hole || b.pt.hole) continue;
      const ba = a.G.bbox, bb = b.G.bbox; if (ba[0] >= bb[2] || bb[0] >= ba[2] || ba[1] >= bb[3] || bb[1] >= ba[3]) continue;
      let ov = 0;
      a.G.prims.forEach(pa => { if (pa.s < 0) return; b.G.prims.forEach(pb => { if (pb.s < 0) return; ov += overlapArea(primPoly(pa), primPoly(pb)); }); });
      // material removed by a part's own void (tube interior) does not count
      if (ov > 1e-6 * Math.min(Math.abs(a.geo.A), Math.abs(b.geo.A))) {
        let inVoid = 0; [a, b].forEach(x => x.G.prims.forEach(pv => { if (pv.s > 0) return; const other = x === a ? b : a; other.G.prims.forEach(po => { if (po.s > 0) inVoid += overlapArea(primPoly(pv), primPoly(po)); }); }));
        if (ov - inVoid > 1e-6 * Math.min(Math.abs(a.geo.A), Math.abs(b.geo.A))) R.warnings.push(`${a.pt.lbl} and ${b.pt.lbl} overlap (about ${(+(ov - inVoid).toPrecision(3))} in² counted twice). Move them apart or use a hole.`);
      }
    }
```
After:
```js
    const P = R.parts;
    // material overlap of solid parts: exact area common to the two materials (each part's own void excluded; circles exact)
    R.overlaps = [];
    const S = P.map(q => q.pt.hole ? null : novShape(q.pt));
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) {
      const a = S[i], b = S[j]; if (!a || !b || !bbHit(a.bbox, b.bbox)) continue;
      const ov = novInter(a, b);
      if (ov > novTol(a, b)) { R.overlaps.push({ a: a.id, b: b.id, la: P[i].pt.lbl, lb: P[j].pt.lbl, area: ov }); R.warnings.push(`${P[i].pt.lbl} and ${P[j].pt.lbl} overlap (about ${(+ov.toPrecision(3))} in² counted twice). Move them apart or use a hole.`); }
    }
```
Only the warning's area figure is affected: it was computed with circles as inscribed 64-gons and an approximate void correction, and is now exact. No property uses it. The hole-inside check below it is unchanged. `SPC` also exports `NOV`.

Check case (warning area): round bar Ø4 at (0, 0) and plate 6 × 1 centred at (1, 1.5). The common area is the circular segment above y = 1: r² acos(d/r) − d√(r² − d²) = 4 acos(0.5) − 1·√3 = 4.18879 − 1.73205 = **2.45674 in²**. Before: 2.44997 (64-gon), shown as "about 2.45 in²". After: 2.456739, shown as "about 2.46 in²". A = 12.566 + 6 = 18.566 in² (overlap counted twice) both before and after.

#### UI changes (anchors)

| Where (anchor) | Change |
|---|---|
| after `function setProjects(p)` | `LS_NOOV = 'spc_preventOverlap_v1'`, `NOOV`, `setNoOverlap()` |
| before `/* ---------- actions ---------- */` | new block `/* ---------- no overlap ---------- */`: `novShapes`, `novCarried` (holes that move with their part), `novWorld`, `novOK`, `novWhy`, `shiftParts`, `novResolve` (nearest free position), `movedTxt`, `novRefuse`, `dragTarget` (collide-and-slide, then magnetic snap, then point/grid snap), `guardEdit` / `ovEditPlace` / `renderOvEdit` / `ovEditBox` (part-panel guard), `fixOverlap` |
| `wireCanvas` pointerdown `DRAG = { mode: 'move'` | moving set = selection + carried holes; `W: novWorld(ids), cur: [0, 0]` |
| `wireCanvas` pointermove | `d = snapDelta(DRAG.movePts, d, …)` → `d = dragTarget(DRAG, d, e.altKey); DRAG.cur = d;` |
| `svgMarkup` `if (!opts.print && SNAPMARK)` | also draws `SNAPMARK.seg` (contact edge) and `SNAPMARK.guide` (alignment) |
| `nudge`, `actFlip`, `actRotate`, `actDuplicate`, `actMirrorCopy`, `paste`, `actAlign`, `addParts` / `addSimple` / `addShape`, `finishPoly`, template `run`, multi-selection "Move" | rules above |
| `numIn` / `chkIn` / `selIn` | optional `guard` (part ids) → `guardEdit`; used by the part panel |
| `buildSetPane` → Snapping and moving | "Prevent overlap" checkbox (per browser); snap-radius hint |
| `TOOLS`, `updateToolState`, `updateStatus` | "No overlap" toggle; status text |
| `warnPanel` | "Fix: move apart" button per overlapping pair (hidden in print via `.ovFix`) |
| `loadModel` | toast names the overlapping pairs; nothing is moved |

#### How verified

- `node --check` of every inline script.
- **Main vs branch** (headless Chromium, KaTeX served locally): default example and all 8 templates. Identical numeric results and identical text of the Properties, Calc detail, Plastic, Torsion, Q and Section tabs. The only differences are the new "No overlap" toolbar button and status text. Autosaved model identical, no warnings, Validation tab 60/60 on both, no console errors.
- **Phase 1 checks:** node cross-check 410 checks, 0 failures; Phase 1 browser interaction tests 49/49 (unchanged, including the corner-to-corner drag snap).
- **Node, new geometry** (18 checks). Overlap areas vs a 0.004 in grid for round bar/plate, two round bars, tube/plate, W/rotated L, HSS/round bar, pipe/round HSS: all within the grid error. Touching plates, and round bars tangent at 30° or 37°, give no overlap. Collide stops at contact exactly. Slide reaches (3, 1) for a target of (3, −10). Slide into an inner corner stops at both walls. A Ø2 bar drops onto a W14X90 flange to y = d/2 + r. A fast move does not tunnel through a 1/4 in plate. A hole stops at the plate edge. Nearest free position of a plate 0.2 in into another: up 0.8. Snap gives coincident edges and aligned ends. **2,303 template variants** produce no overlapping parts: every C/MC/L/W/M/S/HP shape in every template and arrangement, gaps 0, 3/8 and 3/4 in.
- **Browser interaction tests** (47 checks, 0 failures, no console errors):
  - **Drag:** drag into a plate stops at contact (y = 1 exactly). A diagonal drag slides along the contact. Undo restores the position.
  - **Snap:** within 0.5 × the snap radius the edges become coincident (0 error) and the right ends align (0 error), with the cue shown (screenshot `snap_cue.png`). A centred snap also works; beyond the radius there is no snap. A round bar snaps tangent.
  - **Nudge:** stops at contact; blocked with a message; free along the contact.
  - **Paste, duplicate, mirror copy:** paste over a part and duplicate end free and touching. Mirror copy about the part centroid is moved clear, touching.
  - **Rotate / flip:** rotate 90° on a plate moves the part up to touching. Flip V of an angle standing on a plate puts it back on the plate.
  - **Add:** a plate or angle added on the W ends free. A hole added in empty space is moved inside a solid part. Template "Add to drawing" ends free.
  - **Part panel:** typed y that would overlap is not applied (red field + message, screenshot `edit_refused.png`); "Place touching" works. Thickness 1 → 2 is refused, then placed touching.
  - **Holes:** a dragged hole stays inside; dragging the plate carries its hole; a typed hole position outside the plate is refused.
  - **Toggle off:** overlap allowed, warning shown, A counted twice. Stored only under `spc_preventOverlap_v1` (not in the autosave), and survives a reload.
  - **Legacy file** (W14X90 with a cover plate 0.3 in into the flange): loads with geometry unchanged and the warning plus Fix button (screenshot `legacy_warning.png`). A = 46.1252 in², overlap counted twice as before. Fix moves PL1 to y = 7.5, touching.

#### Open items

- N-O1. Holes inside a moved, rotated or flipped part move with it (otherwise the part could not move without leaving its hole behind). This happens only when Prevent overlap is on. Confirm. **Closed 2026-10-10: confirmed (see R1).**
- N-O2. Rotate/flip that would overlap moves the part to the nearest free position, touching, rather than refusing. Confirm. **Closed 2026-10-10: changed. A rotate or flip is applied in place with a warning (see R1).**
- N-O3. A hole must lie inside **one** solid part (same rule as the existing warning). A hole straddling two touching plates is refused. Say if that case is needed. **Closed 2026-10-10: confirmed (see R1).**

### N2. Make dimension editing obvious   [UI only — no change to any formula or computed property]

- **Engineer's feedback (2026-10-10):** "It's not clear how to update a plate dimension. Once I add a plate it drops in at the default size, and I don't see where to change the thickness or length."
- **Changes:**
  1. **After adding a part** (Plate, Flat bar, Round bar, tubes, holes, rolled shape, polygon), the part is selected and the side panel switches to **Part properties**, with the first size field focused and its value selected (plate: width b; rolled shape: the size dropdown), so typing replaces it. The toast says "— type its size". (Chosen over a popover next to the part: it shows every field of the part, and Tab moves on to the next dimension.)
  2. **Parts in the section** list: each part's key sizes are editable in its row (plate/bar b × t, round Ø, tube Ø × t, rect. tube B × H × t, rolled shape: size dropdown of its family). Same no-overlap guard as the panel. Clicking into one of these fields selects the part without rebuilding the list, so the field keeps focus and selection; the other panes are rebuilt when next shown (`PANE_STALE`).
  3. **On the drawing**, a single selected part shows its dimensions as clickable labels: plate/bar b and t with dimension lines; rect. tube B, H and t; round Ø; tube Ø and t; rolled shape its designation ▾.
     - Clicking a label opens an in-place editor: Enter or leaving the field applies, Esc cancels; a size list for rolled shapes.
     - Plates, bars and rectangular tubes get four **edge handles**. Dragging one changes that dimension while the opposite edge stays put. It snaps to other parts' edge and corner lines within the snap radius, otherwise to 1/16 in (1 mm in mm units); Alt suspends snapping. With Prevent overlap on, it stops exactly at contact (bisection; growth is monotonic).
     - Labels are kept inside the view.
  4. **Discoverability:**
     - Double-click on a part now really opens its dimensions. The browser's `dblclick` never reached the part, because the drawing is redrawn between the two clicks; it is now detected in `pointerup` (two clicks on the same part within 450 ms).
     - Right-click → **Edit dimensions…** (was "Edit…").
     - Hint under the Add buttons: "Click a part to change its size — or double-click it. …"
  5. **Plate wording:** "Width b (horizontal)" / "Thickness t (vertical)" (after a 90° turn: "vertical — part turned 90°" / "horizontal — part turned 90°"; other angles: "along / across the part"). Same for rect. tube B / H. A **⟲ Rotate 90°** button sits right under the size fields ("swaps horizontal and vertical").
- **Saved data:** none changed (no new keys; the dimension fields write the same `p.b`, `p.t`, … as before).

#### Where (anchors)

| Anchor | Change |
|---|---|
| before `/* ---- Parts tab ---- */` | new `DIM_FIRST`, `focusDims(pid)`, `orientWords(pt)`, `inlineDims(p)` |
| `buildPartsPane` → `mkSec(P, 'inAdd'` | new hint line (before "New parts go to the centre of the view.") |
| `buildPartsPane` → `mkSec(P, 'inList'` | `ovEditBox(body)`; row description cell + `inlineDims(p)`; row click ignores clicks in `.inlDims` (selects without rebuild); row dblclick → `focusDims` |
| `function inTabSelect(k, remember)` | rebuilds the panes first when `PANE_STALE` |
| `function rebuildInputs()` | `PANE_STALE = false;` |
| `buildPartPane` → `mkSec(P, 'ppDim'` | plate/bar labels `'Width b (' + o[0] + ')'`, `'Thickness t (' + o[1] + ')'` (before: `'Width b (along x)'`, `'Thickness t (along y)'`); rect. tube `'Width B (…)'`, `'Height H (…)'` (before: `(along x)`, `(along y)`); `rotRow()` button |
| `addSimple`, `addShape`, `finishPoly` | `focusDims(pt.id)` after a successful add |
| `openPartMenu` | `{ t: 'Edit…', … }` → `{ t: 'Edit dimensions…', k: 'dbl-click', f: () => focusDims(pid) }` |
| `svg.addEventListener('dblclick'` | `if (pid) { SEL = …; showInTab('part'); rebuildInputs(); drawCanvas(); }` → `if (pid) focusDims(pid);` |
| `wireCanvas` pointerup, `if (D.mode === 'move')` | double-click detection (`LASTCLICK`) → `focusDims` |
| before `let _drawQ = false;` | new `dimInfo`, `dimLabel`, `dimMarkup`, `closeDimEditor`, `openDimEditor`, `applyDim`, `resizeTo` |
| `svgMarkup` before `// hover dimensions` | `selDim` overlay; hover dimensions are skipped for the selected part |
| `wireCanvas` pointerdown after the `qcut` check | `[data-dim]` label → `openDimEditor`; `data-h="rs|…"` handle → `DRAG = { mode: 'resize', … }` |
| `wireCanvas` pointermove / pointerup | `resize` mode (`resizeTo`; toast `PL1: t = … in`, "stopped at contact") |
| CSS after `table.plist button{…}` | `.inlDims …`, `#dimEd …` |

#### How verified

- `node --check` of every inline script.
- **Main vs branch** comparison repeated after this change: still identical (default + 8 templates, all output tabs, saved model, Validation 60/60). Phase 1 node cross-check 410/0; Phase 1 browser tests 49/49; N1 tests 47/47.
- **Browser interaction tests** (35 checks, 0 failures, no console errors):
  - **Add:** adding a plate → Part properties, b focused; typing "12" → b = 12; Tab → t; typing 0.75 → A = 9 in². Labels read "horizontal / vertical" and the Rotate 90° button is there. Adding a rolled shape focuses the size dropdown; adding a round bar focuses Ø.
  - **Parts list:** b × t fields and the angle size dropdown are shown. Inline t = 1.5 → A + 5 in², and focus stays in the field. Inline angle size → L6X6X1/2. Undo restores both. An inline edit that would overlap is refused with the message.
  - **Drawing labels:** a selected plate shows "b = 10 in", "t = 1 in" and 4 handles. Clicking t opens the editor with "1" selected. Typing 0.75 + Enter → t = 0.75 and A = 11.5. Undo works. t = 8 into the plate above is refused.
  - **Handles:**
    - Top handle dragged up 0.6 in → t = 1.625 (1/16 steps) with the bottom edge fixed at y = −0.5; A updated; undo works.
    - Top handle dragged 10 in into the plate above → stops with the top edge at y = 3.5 (to 1e-9), no overlap.
    - Right handle dragged near another part's end → edge at x = 2 exactly.
  - **Discoverability:** right-click → "Edit dimensions…" focuses b. A double-click on the part focuses b. The hint text is present. After a 90° turn, b is labelled "vertical".
- Screenshots (looked at): `dim_added_panel.png` (panel after adding, labels and handles on the drawing), `dim_parts_list.png` (inline fields), `dim_drawing_selected.png`, `dim_inplace_editor.png`.

#### Follow-up (coordinator review, commit 3)

1. **Fields update live.**
   - Before (Phase 1 behaviour): the Left / Right / Bottom / Top edge fields, and the centroid fields, kept their old values until the panel was rebuilt. Example: b = 12 still showed edges −4 / 4.
   - Now every number field in the side panel follows the model whenever it changes from any source: panel field, inline list field, on-drawing label editor, resize handle (also during the drag), Rotate 90°, nudge, or drag of a part. The field being typed in is never overwritten.
   - The inline list fields and the panel fields follow each other.
   - Code:
     - `numIn`: `i._get = get; i._k = k;` after `tagField(i, key);`.
     - `refreshInputs`: re-reads every `#inputPanel input[type="number"]` that has `_get`, except `document.activeElement`.
     - Edge getter: `numIn(() => bb[i], …)` with `const bb = SPC.partGlobal(pt).bbox;` computed once → `numIn(() => SPC.partGlobal(pt).bbox[i], …)`.
     - Pointer-move of `move` and `resize` drags calls `refreshInputs()`.
2. **Dimension labels clear of the edge handles.**
   - Before: a label pulled back into the view could sit on the midpoint handle (`dim_drawing_selected.png`: "t = 1 in" on the right handle).
   - Now each label is placed at the first position that is inside the view and keeps a 4 px gap from every handle and from the other labels. The order tried is: beyond its dimension line; shifted along the line past the handle, either way; then the same on the opposite side of the part, with the dimension line drawn on that side. Only if none fit is it clamped into the view.
   - The rect. tube / tube wall-thickness tag is also shifted clear of the top handle.
   - Code: `dimInfo` gives each dimension two `sides`; `dimMarkup` places the labels (`choose`); `dimLabel` no longer clamps.

How verified (follow-up):
- New browser test (47 checks, 0 failures).
  - Typing b = 12 updates the edges to −6 / 6 live while b keeps focus; the inline list field shows 12.
  - t = 0.75 → edges ±0.375.
  - Inline t = 2 → panel t and edges ±1.
  - Typed left edge = 0 → centroid x 6, right edge 12.
  - Label editor t = 1.5 → panel, edges and inline field.
  - Resize handle → fields live during the drag and after (bottom stays at −0.75).
  - Rotate 90° → edges swap and b is labelled vertical.
  - Nudge → centroid and edges.
  - Labels vs handles at zoom ×0.25, 0.6, 1, 2.5 and 6 for: plate 10 × 1 at 0°, 30° and 90°; bar 4 × 1/4; rect. tube 6 × 8 × 3/8 at 0° and 45°. No label touches a handle (3 px gap) or another label, and labels stay inside the view when zoomed out.
- Re-run:
  - main-vs-branch parity: identical, Validation 60/60;
  - N1 no-overlap tests 47/0, N2 dimension tests 35/0;
  - Phase 1 browser tests 49/0, node cross-check 410/0, geometry 18/0;
  - 400 px: no horizontal scroll.
- Screenshots: `live_panel.png`, `dim_drawing_selected.png` (t label now above the handle), `labels_0..2.png` (plate, rotated plate, rotated rect. tube).

#### Open items

- N-O4. Resize handles are offered for plates, bars and rectangular tubes only (not holes, round parts or rolled shapes, whose sizes come from a list or a single diameter). **Closed 2026-10-10: confirmed (see R1).**


## 2026-10-10 — PR: claude/spc-dxf (PR link added after merge)

### X1. Export DXF, to check the section properties with AutoCAD MASSPROP   [new output only — no change to any formula, computed property, storage key or saved format]

- **Engineer's request (2026-10-10):** "Add a DXF output feature, this will allow me to check the section properties quickly using MASSPROP."
- **What it does:** a new header button **Export DXF** (next to Save file) opens a dialog: units shown, coordinate basis (section centroid at 0,0 — default — or the tool's own origin), warnings where MASSPROP will differ, short MASSPROP help. **Download DXF** writes an ASCII DXF R12 (AC1009, CRLF) file named after the project (`section_properties.dxf` when the project name is blank).
- **Geometry = exactly what the properties are computed from:** for every part (hole parts included) the primitives of `SPC.partGlobal(pt).prims` that `analyze` integrates: polygons as closed `POLYLINE`/`VERTEX` (flag 70 = 1), circles as `CIRCLE`. Rectangular tubes and rectangular HSS: the same 24 chords per corner that the tool integrates (`rrectPts(…, 24)`). Round bars, round tubes, round HSS and pipes: the tool integrates exact circles (`circM`), so true CIRCLEs are written. Consecutive coincident vertices (a zero-length straight between two corner arcs) are dropped; this does not change the area integrals. Coordinates are written at full precision (shortest round-trip decimal form, never rounded to the display precision, no exponent notation).
- **Units:** the display units from Settings. in: coordinates in inches, `$INSUNITS = 1`. mm: coordinates × 25.4, `$INSUNITS = 4`. The dialog and the notes state the unit.
- **Coordinate basis.** Stored per browser in the new key `spc_dxfOpts_v1` = `{"basis":"centroid"|"origin"}`. It is written only when the radio is changed, every read and write is in try/catch, and an invalid value falls back to centroid. It is not project data.
  - *centroid* (default): the tool's centroid (x̄, ȳ, as displayed) is moved to 0,0, so MASSPROP "Moments of inertia" X, Y and "Product of inertia" XY are the centroidal I<sub>x</sub>, I<sub>y</sub>, I<sub>xy</sub> directly.
  - *origin*: the tool's own origin, so MASSPROP "Centroid" = x̄, ȳ and its moments are about 0,0 (I + A·d²). The notes give both.
- **Sign convention:** axes as in the tool (+x right, +y up). Product of inertia = ∫xy dA, the sign the tool uses (`polyM`, `circM`). AutoCAD's MASSPROP product of inertia is understood to be the same ∫xy dA (positive with the area mostly in quadrants 1 and 3). **This was not checked in AutoCAD.** A one-time check is given in the Method tab (1 × 1 square, corner at 0,0 → XY = +0.25).
- **Layers:**
  - `SPC-PARTS`: material (colour 7).
  - `SPC-PARTS-N`: material of parts with n ≠ 1 (colour 3; only written when used).
  - `SPC-HOLES`: hole parts and the voids inside tubes (colour 1).
  - `SPC-CENTROID`: cross and small circle at the centroid, principal axes 1 and 2 with tags.
  - `SPC-NOTES` (TEXT):
    - project, date, units, basis, axes and sign, layers;
    - the tool's A, x̄, ȳ, I<sub>x</sub>, I<sub>y</sub>, I<sub>xy</sub>, I<sub>1</sub>, I<sub>2</sub>, θ<sub>p</sub>;
    - the **expected MASSPROP readout** of the exported geometry: Area, Centroid, Moments of inertia, Product of inertia, Radii of gyration, Principal moments with directions;
    - the REGION → UNION → SUBTRACT → MASSPROP steps, what MASSPROP does not report, the warnings and the part list.
  - `SPC-LABELS`: part labels. Written **off** (negative colour) so that REGION does not pick it up.
- **Warnings (dialog and notes):**
  - overlapping parts: UNION merges the overlap once, the tool counts it twice;
  - n ≠ 1: MASSPROP is unweighted, so the expected readout is the unweighted geometry;
  - AISC tabulated option: the DXF holds the plate model;
  - holes not inside material: SUBTRACT removes only the part inside;
  - self-intersecting polygons: REGION fails.
- **Text is ASCII only:**
  - No `^`, which is AutoCAD's caret escape: ezdxf showed "in^2" as "inp", so units are written in2 / in4.
  - × → x, Ø → `%%c`, ² → 2, dashes → `-`. Any other non-ASCII character goes through the copied `enc` (`\U+XXXX`).
  - Long note lines are wrapped at about 120 characters.
- **Not in this change:** DXF import; any change to the calculation, to existing keys or to the saved JSON.

#### Other copies (CLAUDE.md §3)

The writer helpers (`g`, `layer`, `line`, `pline`, `circle`, `text`, `enc`) and the file assembly (HEADER / TABLES / BLOCKS / ENTITIES) are copied from `GPDXF.write` in `Gusset Plate Rating.html` (anchor `/* ---------- writer: ASCII DXF R12 (AC1009), CRLF ---------- */`). Gusset Plate Rating is not changed. Differences in this copy:
- `fmt` writes full precision instead of 8 decimals;
- `$INSUNITS` is 1 or 4;
- `layer()` takes an `off` flag (negative colour);
- `text()` takes `noGrow`, so labels do not move the notes;
- the LTYPE table has CONTINUOUS only (no dashed layers here).

#### Where (anchors): before / after

1. Header button. Anchor `<button type="button" id="btnSaveHdr"`.
   - Before:
     ```html
             <button type="button" id="btnSaveHdr" title="Save the project to a file (.json)">Save file</button>
             <button type="button" id="btnPrint" class="primary" title="Build a printable calculation report">Print report</button>
     ```
   - After:
     ```html
             <button type="button" id="btnSaveHdr" title="Save the project to a file (.json)">Save file</button>
             <button type="button" id="btnDxf" title="Export the section geometry to DXF, to check the properties with AutoCAD MASSPROP">Export DXF</button>
             <button type="button" id="btnPrint" class="primary" title="Build a printable calculation report">Print report</button>
     ```
2. `wireFile()`, anchor `$('btnPrint').addEventListener('click', openPrintDialog);`. One line added before it:
   ```js
     $('btnDxf').addEventListener('click', openDxfDialog);
   ```
3. `buildManual()`: a new section before `  H('Saved data');`:
   ```js
  H('Checking with AutoCAD MASSPROP (Export DXF)');
  UL(['<b>Export DXF</b> (header) writes an ASCII DXF R12 file with exactly the geometry the properties are computed from: each part\'s polygons as closed polylines (rectangular-tube and HSS corners as the same 24 chords per corner), round bars, tubes and pipes as true circles, at full numeric precision, in the display units (in: $INSUNITS = 1; mm: $INSUNITS = 4).',
    '<b>Layers:</b> SPC-PARTS (material), SPC-PARTS-N (material of parts with n ≠ 1), SPC-HOLES (hole parts and the voids inside tubes), SPC-CENTROID (cross at the centroid, principal axes 1 and 2), SPC-NOTES (project, units, basis, the tool\'s A, x̄, ȳ, I<sub>x</sub>, I<sub>y</sub>, I<sub>xy</sub>, I<sub>1</sub>, I<sub>2</sub>, θ<sub>p</sub>, the expected MASSPROP readout and the steps), SPC-LABELS (part labels; off).',
    '<b>Coordinate basis</b> (remembered in this browser): section centroid at 0,0 (default) — MASSPROP "Moments of inertia" X, Y and "Product of inertia" XY are then the centroidal I<sub>x</sub>, I<sub>y</sub>, I<sub>xy</sub>; or the tool\'s own origin — MASSPROP "Centroid" = x̄, ȳ and its moments are about 0,0. Axes: +x right, +y up; product of inertia = ∫xy dA, the sign the tool uses and, as understood, the sign MASSPROP uses (check once: a 1 × 1 square with a corner at 0,0 in the first quadrant gives XY = +0.25).',
    '<b>Steps:</b> UCS World → REGION (select the objects on SPC-PARTS, SPC-PARTS-N, SPC-HOLES) → UNION the material regions (touching parts union cleanly; separate pieces become one composite region) → SUBTRACT the hole regions → MASSPROP. Compare Area, Centroid, Moments of inertia, Product of inertia and Principal moments.',
    '<b>Differences to expect:</b> MASSPROP is unweighted (compare with every n = 1, or use the unweighted values in the notes); rolled shapes are exported as their plate model (the AISC tabulated option is not in the geometry); overlapping parts (possible only with "Prevent overlap" off or in an older file) are merged once by UNION but counted twice by the tool — the export dialog warns. MASSPROP does not report J, C<sub>w</sub>, Z, S, the shear centre or Q.']);
   ```
   and in the Saved data list (before, then after):
   ```
   selected input tab <code>${LS_INTAB}</code>. All keys
   selected input tab <code>${LS_INTAB}</code>, DXF export options <code>${LS_DXF}</code>. All keys
   ```
4. New block, inserted immediately before the `PRINT REPORT` banner (`/* ====…` followed by `   PRINT REPORT`):
   ```js
/* =====================================================================
   DXF EXPORT — for checking the section with AutoCAD REGION / MASSPROP.
   Writes exactly the geometry the properties are computed from (each part's
   polygons and circles after mirror, rotation and placement; rectangular-tube
   corners as the same 24 chords per corner; circles as true CIRCLEs), at full
   numeric precision, in the display units. No import.
   ===================================================================== */
const LS_DXF = 'spc_dxfOpts_v1';   // per-browser export options { basis: 'centroid' | 'origin' }; not project data
function dxfOpts() { let o = null; try { o = JSON.parse(lsGet(LS_DXF) || 'null'); } catch (e) { o = null; } return { basis: (o && o.basis === 'origin') ? 'origin' : 'centroid' }; }
function dxfOptsSave(o) { try { lsSet(LS_DXF, JSON.stringify({ basis: o.basis === 'origin' ? 'origin' : 'centroid' })); } catch (e) { } }
const SPCDXF = (function () {
  /* ASCII DXF R12 (AC1009), CRLF. Writer helpers and file assembly copied from GPDXF.write in
     Gusset Plate Rating.html (CLAUDE.md §3: duplicated code stays duplicated). Changes from that copy:
     fmt writes full precision (shortest round-trip form, no rounding); $INSUNITS is 1 (in) or 4 (mm);
     a layer may be written "off" (negative colour). */
  const fmt = x => { if (!isFinite(x) || x === 0) return '0'; let s = String(x); if (/e/i.test(s)) { s = x.toFixed(20); if (s.indexOf('.') >= 0) s = s.replace(/0+$/, '').replace(/\.$/, ''); } return /^-0(\.0*)?$/.test(s) ? '0' : s; };
  function enc(s) { return String(s ?? '').replace(/[\r\n\t]+/g, ' ').replace(/[^\x20-\x7e]/g, c => { const cp = c.codePointAt(0); return '\\U+' + cp.toString(16).toUpperCase().padStart(4, '0'); }).slice(0, 250); }
  // TEXT is plain ASCII: '^' is AutoCAD's caret escape (never written); x for the multiplication sign, %%c for the diameter sign
  const asc = s => String(s ?? '').replace(/\^/g, '').replace(/\u00d7/g, 'x').replace(/[\u00d8\u2300]/g, '%%c').replace(/\u00b2/g, '2').replace(/\u2074/g, '4').replace(/[\u2013\u2014]/g, '-');
  const g6 = (v, p) => isNum(v) ? (Math.abs(v) < 1e-12 ? '0' : String(+v.toPrecision(p || 8))) : 'n/a';
  // geometry-only (unweighted, every part n = 1, plate model) properties of the exported primitives, in model units, about the given origin
  function geomProps(R, o) {
    const pr = []; R.parts.forEach(q => q.G.prims.forEach(p => pr.push(p.k === 'poly' ? { k: 'poly', s: p.s, pts: p.pts.map(v => [v[0] - o[0], v[1] - o[1]]) } : { k: 'circ', s: p.s, c: [p.c[0] - o[0], p.c[1] - o[1]], r: p.r })));
    const m = SPC.primsMoments(pr), A = m.A, cx = m.Sy / A, cy = m.Sx / A;
    const Ixc = m.Ixx - A * cy * cy, Iyc = m.Iyy - A * cx * cx, Ixyc = m.Ixy - A * cx * cy, P = SPC.principal(Ixc, Iyc, Ixyc);
    return { A, cx, cy, Ixo: m.Ixx, Iyo: m.Iyy, Ixyo: m.Ixy, Ixc, Iyc, Ixyc, I1: P.I1, I2: P.I2, th: P.th };
  }
  // warnings for the export (things that make MASSPROP differ from the tool)
  function issues(R) {
    const W = [];
    (R.overlaps || []).forEach(o => W.push(`${o.la} and ${o.lb} overlap: UNION merges the common area once, the tool counts it twice, so MASSPROP will differ. Move them apart (or switch "Prevent overlap" on).`));
    if (R.anyN) W.push('Some parts have modulus ratio n other than 1 (layer SPC-PARTS-N). MASSPROP is unweighted: it matches the tool only with every n = 1; the notes give the unweighted values it should show.');
    if (R.anyTab) W.push('Some rolled shapes use the AISC tabulated properties. The DXF holds their plate model (no fillets), so MASSPROP matches the plate model, not the tabulated values; the notes give the values it should show.');
    (R.warnings || []).forEach(w => { if (/^Hole .* not entirely inside/.test(w)) W.push(w + ' SUBTRACT removes only the part inside the material.'); else if (/self-intersecting/.test(w)) W.push(w + ' REGION cannot make a region from it.'); });
    return W;
  }
  function write(R, M, opt) {
    opt = opt || {};
    const mm = opt.units === 'mm', f = mm ? 25.4 : 1, uL = mm ? 'mm' : 'in';
    const o = opt.basis === 'origin' ? [0, 0] : [R.cx, R.cy];
    const tp = v => [(v[0] - o[0]) * f, (v[1] - o[1]) * f];
    const L = [], ent = [], bb = [Infinity, Infinity, -Infinity, -Infinity];
    const grow = (x, y) => { if (!isFinite(x) || !isFinite(y)) return; bb[0] = Math.min(bb[0], x); bb[1] = Math.min(bb[1], y); bb[2] = Math.max(bb[2], x); bb[3] = Math.max(bb[3], y); };
    const g = (c, v) => ent.push(String(c).padStart(3), String(v));
    const layer = (name, col, lt = 'CONTINUOUS', off = false) => { if (!L.some(l => l[0] === name)) L.push([name, off ? -col : col, lt]); return name; };
    const line = (ly, a, b) => { g(0, 'LINE'); g(8, ly); g(10, fmt(a[0])); g(20, fmt(a[1])); g(30, 0); g(11, fmt(b[0])); g(21, fmt(b[1])); g(31, 0); grow(a[0], a[1]); grow(b[0], b[1]); };
    const pline = (ly, pts, closed = true) => { g(0, 'POLYLINE'); g(8, ly); g(66, 1); g(10, 0); g(20, 0); g(30, 0); g(70, closed ? 1 : 0);
      pts.forEach(q => { g(0, 'VERTEX'); g(8, ly); g(10, fmt(q[0])); g(20, fmt(q[1])); g(30, 0); grow(q[0], q[1]); }); g(0, 'SEQEND'); g(8, ly); };
    const circle = (ly, c, r) => { g(0, 'CIRCLE'); g(8, ly); g(10, fmt(c[0])); g(20, fmt(c[1])); g(30, 0); g(40, fmt(r)); grow(c[0] - r, c[1] - r); grow(c[0] + r, c[1] + r); };
    const text = (ly, at, h, s, noGrow) => { g(0, 'TEXT'); g(8, ly); g(10, fmt(at[0])); g(20, fmt(at[1])); g(30, 0); g(40, fmt(h)); g(1, enc(s)); if (!noGrow) { grow(at[0], at[1]); grow(at[0] + 0.62 * h * String(s).length, at[1] + h); } };
    layer('0', 7);
    const LP = layer('SPC-PARTS', 7), LH = layer('SPC-HOLES', 1);
    // 1. the geometry, exactly as computed (holes and the voids inside tubes on SPC-HOLES)
    let nPoly = 0, nCirc = 0;
    R.parts.forEach(q => {
      const LS = Math.abs(q.n - 1) > 1e-12 ? layer('SPC-PARTS-N', 3) : LP;
      q.G.prims.forEach(pr => {
        const ly = pr.s < 0 ? LH : LS;
        if (pr.k === 'circ') { circle(ly, tp(pr.c), pr.r * f); nCirc++; return; }
        const P = []; pr.pts.forEach(v => { const w = tp(v), z = P[P.length - 1]; if (!z || Math.hypot(w[0] - z[0], w[1] - z[1]) > 1e-12 * f) P.push(w); });
        if (P.length > 2 && Math.hypot(P[0][0] - P[P.length - 1][0], P[0][1] - P[P.length - 1][1]) <= 1e-12 * f) P.pop();
        pline(ly, P); nPoly++;
      });
    });
    const gb = bb.slice(), ext = Math.max(gb[2] - gb[0], gb[3] - gb[1], 1e-9);
    // 2. centroid cross and principal axes
    const LC = layer('SPC-CENTROID', 6), c0 = tp([R.cx, R.cy]), cs = 0.06 * ext, ax = 0.45 * ext;
    line(LC, [c0[0] - cs, c0[1]], [c0[0] + cs, c0[1]]); line(LC, [c0[0], c0[1] - cs], [c0[0], c0[1] + cs]); circle(LC, c0, cs / 3);
    const u1 = R.u1, u2 = R.u2, hC = 0.025 * ext;
    line(LC, [c0[0] - ax * u1[0], c0[1] - ax * u1[1]], [c0[0] + ax * u1[0], c0[1] + ax * u1[1]]);
    line(LC, [c0[0] - ax * u2[0], c0[1] - ax * u2[1]], [c0[0] + ax * u2[0], c0[1] + ax * u2[1]]);
    text(LC, [c0[0] + ax * u1[0], c0[1] + ax * u1[1]], hC, 'axis 1 (I1)'); text(LC, [c0[0] + ax * u2[0], c0[1] + ax * u2[1]], hC, 'axis 2 (I2)');
    // 3. part labels (own layer, written "off" so it is never picked up by REGION)
    const LL = layer('SPC-LABELS', 8, 'CONTINUOUS', true);
    R.parts.forEach(q => text(LL, tp(q.geo.c), 0.03 * ext, asc((q.pt.lbl || q.pt.id) + (Math.abs(q.n - 1) > 1e-12 ? ' (n = ' + q.n + ')' : '')), true));
    // 4. notes: tool results, expected MASSPROP readout, steps
    const LN = layer('SPC-NOTES', 4), hN = Math.max(0.016 * ext, 1e-6), x0 = bb[2] + 0.08 * ext;   // right of the parts, the axes and their tags
    const GP = geomProps(R, o), fA = f * f, fI = fA * fA, p = M.project || {}, d = new Date();
    const today = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
    const u2s = uL + '2', u4s = uL + '4', deg = r => (+(r * 180 / Math.PI).toFixed(4)) + ' deg';
    const pa = SPC.principal(GP.Ixc, GP.Iyc, GP.Ixyc), d1 = [Math.cos(pa.th), Math.sin(pa.th)], d2 = [-Math.sin(pa.th), Math.cos(pa.th)];
    // round-off zeros (e.g. Ixy = 1e-14 for a symmetric section) are written as 0
    const sI = Math.max(Math.abs(GP.Ixo), Math.abs(GP.Iyo), Math.abs(R.Ix), Math.abs(R.Iy)) * fI, z = (v, sc) => Math.abs(v) < 1e-12 * sc ? 0 : v;
    const N = [];
    N.push(['SECTION PROPERTY CALCULATOR - DXF FOR CHECKING WITH AUTOCAD MASSPROP', 1.3]);
    N.push(`Project: ${p.name || '-'}   Member: ${p.member || '-'}   Job: ${p.job || '-'}   Date: ${p.date || today}   Exported: ${today}`);
    N.push(`Units: ${mm ? 'millimetres (drawing unit = 1 mm, $INSUNITS = 4)' : 'inches (drawing unit = 1 in, $INSUNITS = 1)'}. Coordinates at full precision.`);
    N.push(opt.basis === 'origin' ? 'Coordinate basis: the tool\'s own origin at (0,0). MASSPROP Centroid = the tool\'s xbar, ybar; its Moments/Product of inertia are about (0,0), not the centroid.'
      : `Coordinate basis: section centroid at (0,0) (the tool's xbar = ${g6(z(R.cx * f, ext), 10)}, ybar = ${g6(z(R.cy * f, ext), 10)} ${uL} moved to 0,0). MASSPROP Moments/Product of inertia are then centroidal.`);
    N.push('Axes as in the tool: +x right, +y up. Product of inertia Ixy = integral of x*y dA (positive with the area mostly in quadrants 1 and 3; AutoCAD MASSPROP uses the same sign, as understood).');
    N.push('Layers: SPC-PARTS = material (closed polylines, circles); SPC-PARTS-N = material of parts with n other than 1; SPC-HOLES = holes and the voids inside tubes; SPC-CENTROID; SPC-NOTES; SPC-LABELS (off).');
    N.push(`Geometry exactly as the tool computes it: ${nPoly} closed polyline${nPoly === 1 ? '' : 's'}, ${nCirc} circle${nCirc === 1 ? '' : 's'}. Rectangular tube / HSS corners are 24 straight chords per corner (as in the tool); round parts are true circles.`);
    N.push(['TOOL RESULTS (as displayed in the tool' + (R.anyN ? ', transformed with n' : '') + (R.anyTab ? ', AISC tabulated values where selected' : '') + '):', 1.1]);
    N.push(`A = ${g6(R.A * fA)} ${u2s}   xbar = ${g6(z(R.cx * f, ext))} ${uL}   ybar = ${g6(z(R.cy * f, ext))} ${uL}  (tool axes)`);
    N.push(`Ix = ${g6(R.Ix * fI)} ${u4s}   Iy = ${g6(R.Iy * fI)} ${u4s}   Ixy = ${g6(z(R.Ixy * fI, sI))} ${u4s}  (about the centroid)`);
    N.push(`I1 = ${g6(R.I1 * fI)} ${u4s}   I2 = ${g6(R.I2 * fI)} ${u4s}   theta_p = ${deg(R.thp)} (from +x to axis 1, CCW)`);
    N.push([`EXPECTED MASSPROP READOUT (this geometry, unweighted, UCS = World)${(R.anyN || R.anyTab) ? ' - differs from the tool results, see the warnings' : ''}:`, 1.1]);
    N.push(`Area: ${g6(GP.A * fA)}`);
    N.push(`Centroid: X: ${g6(z(GP.cx * f, ext))}  Y: ${g6(z(GP.cy * f, ext))}`);
    N.push(`Moments of inertia: X: ${g6(GP.Ixo * fI)}  Y: ${g6(GP.Iyo * fI)}`);
    N.push(`Product of inertia: XY: ${g6(z(GP.Ixyo * fI, sI))}`);
    N.push(`Radii of gyration: X: ${g6(Math.sqrt(GP.Ixo / GP.A) * f)}  Y: ${g6(Math.sqrt(GP.Iyo / GP.A) * f)}`);
    N.push(`Principal moments about centroid: ${g6(pa.I1 * fI)} along [${g6(d1[0], 6)} ${g6(d1[1], 6)}],  ${g6(pa.I2 * fI)} along [${g6(d2[0], 6)} ${g6(d2[1], 6)}]  (MASSPROP may list them in the other order)`);
    if (opt.basis === 'origin') N.push(`(About the centroid: Ix = ${g6(GP.Ixc * fI)}, Iy = ${g6(GP.Iyc * fI)}, Ixy = ${g6(z(GP.Ixyc * fI, sI))}; MASSPROP moments = these + A*ybar*ybar, + A*xbar*xbar, + A*xbar*ybar.)`);
    N.push(['STEPS IN AUTOCAD:', 1.1]);
    N.push('1. UCS -> World. Thaw/turn on SPC-PARTS, SPC-PARTS-N and SPC-HOLES; leave SPC-LABELS off.');
    N.push('2. REGION -> select every object on SPC-PARTS, SPC-PARTS-N and SPC-HOLES (e.g. QSELECT by layer).');
    N.push('3. UNION -> select the regions of SPC-PARTS (and SPC-PARTS-N). Parts that only touch union cleanly; separate pieces become one composite region.');
    N.push('4. SUBTRACT -> select the union, Enter, then the hole regions (SPC-HOLES), Enter.');
    N.push('5. MASSPROP -> select the region. Compare Area, Centroid, Moments of inertia, Product of inertia and Principal moments with the values above.');
    N.push('MASSPROP does not report J, Cw, Z (plastic), S (elastic moduli), the shear centre or Q: check those another way.');
    const W = issues(R);
    if (W.length) { N.push(['WARNINGS:', 1.1]); W.forEach(w => N.push('- ' + w)); }
    N.push([mm ? 'PARTS (descriptions as in the tool, sizes in inches):' : 'PARTS:', 1.1]);
    R.parts.forEach(q => N.push(`${q.pt.lbl || q.pt.id}: ${q.G.g.desc || q.pt.type}${q.pt.hole ? ' (hole)' : ''}${Math.abs(q.n - 1) > 1e-12 ? ', n = ' + q.n : ''}${q.use ? ', AISC tabulated' : ''}`));
    let y = gb[3];
    const wrap = s => { const o = []; let l = ''; String(s).split(' ').forEach(w => { if (l && (l + ' ' + w).length > 120) { o.push(l); l = '   ' + w; } else l = l ? l + ' ' + w : w; }); if (l) o.push(l); return o; };
    N.forEach(s => { const big = Array.isArray(s), hh = hN * (big ? s[1] : 1); if (big) y -= 0.6 * hN; wrap(asc(big ? s[0] : s)).forEach(t => { text(LN, [x0, y - hh], hh, t); y -= 1.6 * hh; }); });
    // assemble (as GPDXF.write)
    const out = [], h = (c, v) => out.push(String(c).padStart(3), String(v));
    h(0, 'SECTION'); h(2, 'HEADER');
    h(9, '$ACADVER'); h(1, 'AC1009'); h(9, '$INSBASE'); h(10, 0); h(20, 0); h(30, 0);
    h(9, '$EXTMIN'); h(10, fmt(bb[0])); h(20, fmt(bb[1])); h(30, 0); h(9, '$EXTMAX'); h(10, fmt(bb[2])); h(20, fmt(bb[3])); h(30, 0);
    h(9, '$LTSCALE'); h(40, 1); h(9, '$INSUNITS'); h(70, mm ? 4 : 1); h(0, 'ENDSEC');
    h(0, 'SECTION'); h(2, 'TABLES');
    h(0, 'TABLE'); h(2, 'LTYPE'); h(70, 1);
    h(0, 'LTYPE'); h(2, 'CONTINUOUS'); h(70, 0); h(3, 'Solid line'); h(72, 65); h(73, 0); h(40, 0);
    h(0, 'ENDTAB');
    h(0, 'TABLE'); h(2, 'LAYER'); h(70, L.length); L.forEach(([n, c, lt]) => { h(0, 'LAYER'); h(2, n); h(70, 0); h(62, c); h(6, lt); }); h(0, 'ENDTAB');
    h(0, 'TABLE'); h(2, 'STYLE'); h(70, 1); h(0, 'STYLE'); h(2, 'STANDARD'); h(70, 0); h(40, 0); h(41, 1); h(50, 0); h(71, 0); h(42, 0.2); h(3, 'txt'); h(4, ''); h(0, 'ENDTAB');
    h(0, 'ENDSEC');
    h(0, 'SECTION'); h(2, 'BLOCKS'); h(0, 'ENDSEC');
    h(0, 'SECTION'); h(2, 'ENTITIES'); out.push(...ent); h(0, 'ENDSEC'); h(0, 'EOF');
    return { text: out.join('\r\n') + '\r\n', warnings: W, layers: L.map(l => l[0]), expected: GP, units: uL, f };
  }
  return { write, issues, geomProps, fmt };
})();
function dxfFileName() { return ((M.project.name || '').trim() ? M.project.name.trim().replace(/[^\w\-]+/g, '_') : 'section_properties') + '.dxf'; }
function openDxfDialog() {
  const old = $('dxfOverlay'); if (old) old.remove();
  const O = dxfOpts(), mm = unitSys() === 'mm';
  const ov = el('div'); ov.id = 'dxfOverlay'; ov.style.cssText = 'position:fixed;inset:0;background:rgba(15,25,40,.45);z-index:60;display:flex;align-items:center;justify-content:center';
  const box = el('div'); box.style.cssText = 'background:#fff;border-radius:8px;padding:16px 20px;width:min(520px,92vw);max-height:86vh;overflow:auto;font-family:var(--font-ui);box-shadow:0 12px 40px rgba(0,0,0,.3)';
  box.setAttribute('role', 'dialog'); box.setAttribute('aria-label', 'Export DXF');
  box.appendChild(el('div', null, '<b style="font-size:11pt">Export DXF — check with AutoCAD MASSPROP</b>'));
  box.appendChild(el('div', 'hint', 'The DXF holds exactly the geometry the properties are computed from: each part as a closed polyline (rectangular-tube corners as the same 24 chords per corner), round parts as true circles, holes and tube voids on their own layer. ASCII DXF R12.'));
  box.appendChild(el('div', 'note', `<b>Units:</b> ${mm ? 'millimetres (1 drawing unit = 1 mm)' : 'inches (1 drawing unit = 1 in)'} — the display units from Settings.`));
  if (!R || !R.ok) { box.appendChild(el('div', 'errBox', 'There are no results (input errors): nothing to export.')); }
  const bas = el('div'); bas.style.cssText = 'margin:6px 0;font-size:9.5pt';
  bas.appendChild(el('div', null, '<b>Coordinate basis</b>'));
  const radio = (v, lbl) => { const r = el('label'); r.style.cssText = 'display:flex;gap:8px;align-items:flex-start;padding:2px 0;cursor:pointer'; const c = document.createElement('input'); c.type = 'radio'; c.name = 'dxfBasis'; c.value = v; c.checked = O.basis === v; c.addEventListener('change', () => { if (c.checked) { O.basis = v; dxfOptsSave(O); } }); r.appendChild(c); r.appendChild(el('span', null, lbl)); return r; };
  bas.appendChild(radio('centroid', 'Section centroid at 0,0 — MASSPROP "Moments of inertia" X, Y and "Product of inertia" XY are then the centroidal I<sub>x</sub>, I<sub>y</sub>, I<sub>xy</sub> directly.'));
  bas.appendChild(radio('origin', 'The tool\'s own origin at 0,0 — MASSPROP "Centroid" = x̄, ȳ; its moments are about 0,0 (= I + A·d²).'));
  box.appendChild(bas);
  if (R && R.ok) { const W = SPCDXF.issues(R); if (W.length) box.appendChild(el('div', 'warnBox', '<b>MASSPROP will differ from the tool:</b><ul style="margin:3px 0 0 16px;padding:0">' + W.map(w => '<li>' + esc(w) + '</li>').join('') + '</ul>')); }
  box.appendChild(el('div', 'hint', '<b>Checking with MASSPROP:</b> UCS World. REGION (select the objects on SPC-PARTS, SPC-PARTS-N and SPC-HOLES) → UNION the material regions → SUBTRACT the hole regions → MASSPROP. Compare Area, Centroid, Moments and Product of inertia, Principal moments with the values in the drawing notes (layer SPC-NOTES). Sign of the product of inertia: ∫xy dA, as in the tool. MASSPROP is unweighted (n = 1) and does not give J, C<sub>w</sub>, Z, S, the shear centre or Q.'));
  const row = el('div', 'btnRow'); row.style.marginTop = '10px';
  const go = el('button', 'btn primary', 'Download DXF'); go.type = 'button'; go.id = 'dxfGo'; go.disabled = !(R && R.ok); if (go.disabled) { go.style.opacity = '.45'; go.style.cursor = 'default'; }
  go.addEventListener('click', () => { ov.remove(); exportDxf(O); });
  const ca = el('button', 'btn', 'Cancel'); ca.type = 'button'; ca.addEventListener('click', () => ov.remove());
  row.appendChild(go); row.appendChild(ca); box.appendChild(row); ov.appendChild(box);
  ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
  document.body.appendChild(ov); go.focus();
}
function exportDxf(O) {
  if (!R || !R.ok) { toast('No results: nothing to export'); return; }
  let w; try { w = SPCDXF.write(R, M, { units: unitSys(), basis: (O || dxfOpts()).basis }); } catch (e) { console.error(e); alert('Could not write the DXF: ' + e.message); return; }
  const blob = new Blob([w.text], { type: 'application/dxf' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = dxfFileName();
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  toast('DXF exported' + (w.warnings.length ? ' — see the warnings in its notes' : ''));
}
   ```

#### Check case (expected MASSPROP readout, can be checked by hand)

PL 12 × 1 (b = 12, t = 1), centroid at (3, 2), units in, basis = tool origin:
- Tool: A = 12 in², x̄ = 3, ȳ = 2, I<sub>x</sub> = 12·1³/12 = 1, I<sub>y</sub> = 1·12³/12 = 144, I<sub>xy</sub> = 0 (in⁴).
- DXF: one closed polyline (−3, 1.5), (9, 1.5), (9, 2.5), (−3, 2.5).
- Expected MASSPROP:
  - Area 12; Centroid X 3, Y 2.
  - Moments of inertia X = 1 + 12·2² = **49**, Y = 144 + 12·3² = **252**.
  - Product of inertia XY = 0 + 12·3·2 = **72**.
  - Radii of gyration X = √(49/12) = 2.0207259, Y = √(252/12) = 4.5825757.
  - Principal moments about the centroid: 144 and 1.
- The DXF notes and the ezdxf rebuild give the same values.
- With basis = centroid the same model gives Centroid 0, 0 and Moments X = 1, Y = 144, XY = 0.

#### How verified

- `node --check` of every inline script.
- Headless Chromium (Playwright): 12 models × 2 bases exported through the real button, the dialog radio and **Download DXF** (24 files). No console errors. Models:
  - single plate;
  - W14X90 (plate model);
  - HSS10X6X1/2 (chords);
  - round tube D 6 × 1/2 + Pipe6STD (circles);
  - 2L4X4X1/2 back to back, 3/8 gap;
  - built-up box (4 plates);
  - plate girder with a rectangular and a round hole;
  - rotated parts: plate at 30°, mirrored L6X4X1/2 at 17°, rect. tube at 41.3°;
  - W14X90 + slab with n = 1/8;
  - plate girder + rotated angle + hole, in **mm**;
  - C15X33.9 with the AISC tabulated option, at 25°;
  - two overlapping plates.
- ezdxf 1.4.4:
  - `recover.readfile` + `doc.audit()` → **0 errors** on all 24 files; `$INSUNITS` is 1 or 4 as expected.
  - Independent rebuild: shoelace / Green's theorem on the polylines, exact circles, `SPC-HOLES` subtracted. A, centroid, I<sub>x</sub>, I<sub>y</sub>, I<sub>xy</sub> (about the centroid and about 0,0), I<sub>1</sub> and I<sub>2</sub> agree with the tool's plate-model values to **≤ 2.7e-15 relative** (worst over all files). These are the tool's own displayed values whenever every n = 1 and no tabulated option is used.
  - The expected-readout numbers written in the notes agree with the rebuild to 8 significant figures.
- Storage:
  - the export leaves `spc_autosave_v1` unchanged;
  - no new key is written until the basis radio is changed, and then only `spc_dxfOpts_v1`;
  - a corrupt stored value falls back to centroid;
  - with no results, the Download button is disabled.
- main vs branch: default example and all 8 templates. The results text of every output tab, the warnings and the saved model are identical; Validation 60/60 on both.
- 400 px wide: no horizontal scroll; the header buttons wrap.
- Screenshots looked at: `dxf_dialog.png`, `dxf_dialog_warn.png`, `method_tab.png`, `narrow_dialog.png`, and ezdxf renders of three exported files.

#### Open items

- X-O1. Not checked in AutoCAD: the sign of the MASSPROP product of inertia, and the order in which MASSPROP lists the principal moments. Both are taken from its documentation as understood. Please confirm on first use (1 × 1 square check in the Method tab).
- X-O2. MASSPROP is unweighted. With n ≠ 1, compare against the "expected MASSPROP readout" (unweighted) in the notes, or set every n = 1 before exporting.
- X-O3. Rolled shapes are exported as their plate model. With the AISC tabulated option, the tool's tabulated A and I will differ from MASSPROP by the fillet area. This is expected.
- X-O4. Units of the export (asked in the PR: display units, or always inches?). **Closed 2026-10-10: keep the display units, no change (see R2).** X-O1 (AutoCAD sign / order check) and X-O3 (AISC tabulated option) stay open.


## 2026-10-10 — PR: claude/spc-rotate-warn (PR link added after merge)

### R1. Rotate / flip under Prevent overlap: applied in place with a warning; open items N-O1 to N-O4 closed   [drawing behaviour — no change to any formula, computed property, storage key or saved format]

**Engineer's decisions (2026-10-10) on the open items of N1 / N2:**

| Item | Decision | Result |
|---|---|---|
| N-O1 | Confirmed: holes move with their part. | No code change. |
| N-O2 | **Changed.** A rotate or flip that would make the part overlap another is neither moved to the nearest free position nor refused. It is applied in place, about the same point as with Prevent overlap off, and a warning is shown: a toast naming the part(s) it now overlaps, plus the existing overlap warning in "Check the model" with its per-pair "Fix: move apart" button. Properties are computed as for any overlap (common area counted twice). Drag, nudge, paste and typed-position rules are unchanged. | Changed in this entry. |
| N-O3 | Confirmed: a hole must lie within one part. | No code change. |
| N-O4 | Confirmed: resize handles only on plates, bars and rectangular tubes. | No code change. |

- **Rotate/flip actions covered:**
  - toolbar: Flip H, Flip V, ⟲ 90°, ⟳ 90°, ∠… (angle);
  - right-click menu: Flip horizontal / vertical, Rotate 90° CCW / CW, Rotate by angle…;
  - keys H, V, R, Shift+R;
  - Part properties: Flip ↔ / Flip ↕ / ⟲ 90° / ⟳ 90° buttons, the **⟲ Rotate 90°** button under the size fields, the **Rotation (CCW)** field and the **Mirrored** box.
  - Single parts and groups.
- **Same point as with Prevent overlap off:** unchanged. A single part turns about its centroid; several parts turn about the centre of their bounding box. Holes inside the part still turn with it (N-O1), about the part centroid, so each hole keeps its place relative to its part.
- **Mirror copy (decided here):** it makes a **new** part and is not a rotate/flip of an existing part. It therefore keeps the N1 rule: the copy goes to the nearest free position, touching. The same applies to Duplicate and Paste.
- **Warning:**
  - The toast is amber (`--warn`) and stays 7 s instead of 2.2 s. Example: "Rotated 90° — now overlaps PL1 (common area counted twice). Check the model → Fix: move apart."
  - For the Rotation field / Mirrored box the toast reads "Applied to PL2 — now overlaps PL1 (…)". These two fields no longer show the "Not applied" box or turn red.
  - With Prevent overlap off, nothing changes (ordinary toast, no extra text). A rotate/flip that does not overlap gives the same toast as before.
- **Undo** restores the previous orientation and position in one step (one undo snapshot per action, as before).

#### Where (anchors) — exact before / after

1. CSS, after `#toast.show{opacity:.94}` — added:
```css
#toast.warn{background:var(--warn)}
```
2. `function toast(t)`:
```js
// before
function toast(t) { const e = $('toast'); e.textContent = t; e.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('show'), 2200); }
// after
function toast(t, warn) { const e = $('toast'); e.textContent = t; e.classList.toggle('warn', !!warn); e.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => e.classList.remove('show'), warn ? 7000 : 2200); }
```
3. New function, before `function novRefuse(what, why) {`:
```js
// rotate / flip of existing parts: applied in place even if the result overlaps (engineer's decision N-O2, 2026-10-10); the warning names the parts now overlapped
function novRotWarn(ids) {
  if (!NOOV) return '';
  const ov = SPC.NOV.overlapping(novWorld(ids), [0, 0]).map(id => (partById(id) || {}).lbl || id);
  return ov.length ? ' — now overlaps ' + ov.join(', ') + ' (common area counted twice). Check the model → Fix: move apart.' : '';
}
```
4. `function guardEdit(ids, fn, inp) {` — new second line. Ids flagged `rotWarn` are applied first, then warned:
```js
  if (ids.rotWarn) { ids = ids.filter(id => partById(id)); fn(); if (OVEDIT) { OVEDIT = null; renderOvEdit(); } const w = novRotWarn(ids); if (w) toast('Applied to ' + ids.map(id => partById(id).lbl).join(', ') + w, true); return true; }
```
5. `function actFlip(ax, ids) {`:
```js
// before
  const all = sp0.map(p => p.id).concat(novCarried(new Set(sp0.map(p => p.id)))), sp = all.map(partById), was = NOOV && novOK(all);
  …
  const res = was ? novResolve(all) : null; if (res && !res.ok) { novRefuse('Not flipped', res.why); return; }
  afterGeo(true); toast((ax === 'h' ? 'Flipped horizontally' : 'Flipped vertically') + (c0 ? ' (as a group)' : '') + movedTxt(res));
// after
  const all = sp0.map(p => p.id).concat(novCarried(new Set(sp0.map(p => p.id)))), sp = all.map(partById);
  …
  const w = novRotWarn(all);
  afterGeo(true); toast((ax === 'h' ? 'Flipped horizontally' : 'Flipped vertically') + (c0 ? ' (as a group)' : '') + w, !!w);
```
6. `function actRotate(a, about) {`: the same first-line change (`, was = NOOV && novOK(all)` removed), and
```js
// before
  const res = was ? novResolve(all) : null; if (res && !res.ok) { novRefuse('Not rotated', res.why); return; }
  afterGeo(true); toast('Rotated ' + a + '°' + (c0 ? (about ? '' : ' (as a group)') : '') + movedTxt(res));
// after
  const w = novRotWarn(all);
  afterGeo(true); toast('Rotated ' + a + '°' + (c0 ? (about ? '' : ' (as a group)') : '') + w, !!w);
```
7. `buildPartPane`:
   - `const pt = sp[0], g = SPC.partGeom(pt), GD = [pt.id];` → `const pt = sp[0], g = SPC.partGeom(pt), GD = [pt.id], GR = Object.assign([pt.id], { rotWarn: true });`
   - Rotation (CCW) field: `'pp_rot', { k: 'deg', geo: true, guard: GD }` → `guard: GR`.
   - Mirrored box: `chkIn(() => pt.mir, v => { pt.mir = v; }, 'pp_mir', true, true, GD)` → `…, GR)`.
   - All other part-panel fields keep `GD`, so typed positions and sizes are still refused with "Place touching".
8. Text:
   - Settings → Prevent overlap hint:
     - "new, pasted, copied, rotated and flipped parts go to the nearest free position;" → "new, pasted and copied parts go to the nearest free position;".
     - Added after "…are not applied.": " A rotate or flip is always applied in place; if the part then overlaps another, a warning names it (Check the model → Fix: move apart)."
   - `warnPanel` hint: "(e.g. in a project saved before overlap prevention)" → "(e.g. in a project saved before overlap prevention, or after a rotate or flip)".
   - Method → Drawing, "Flip and rotate" bullet, appended: "With "Prevent overlap" on, a rotate or flip (toolbar, right-click, keys, Rotate 90° button, Rotation field, Mirrored box) is still applied in place, about the same point; if the part then overlaps another, the message names it and Check the model lists the pair with "Fix: move apart". Until fixed, the overlap is counted twice, as for any overlap."
   - Method → Export DXF, "Differences to expect": "(possible only with "Prevent overlap" off or in an older file)" → "(possible with "Prevent overlap" off, after a rotate or flip, or in an older file)".
- `movedTxt`, `novRefuse` and `novResolve` are unchanged. Paste, duplicate, mirror copy, add, "Move by" and "Place touching" still use them.

#### Check case

Setup: PL1 plate 10 × 1 at (0, 0); PL2 plate 4 × 1 at (0, 1.5), above PL1. The bottom of PL2 is at y = 1.0 and the top of PL1 at 0.5, so the gap is 0.5. Select PL2 and press R (rotate 90° CCW). PL2 becomes 1 wide × 4 tall about its centroid, spanning y = −0.5 … 3.5.

- **Before (N1):** PL2 is moved up to touching, centroid (0, 2.5). No warning.
  - A = 10 + 4 = 14 in².
  - ȳ = 4 × 2.5 / 14 = 0.714286 in.
  - I<sub>x</sub> = 10/12 + 10 × 0.714286² + 64/12 + 4 × 1.785714² = 0.8333 + 5.1020 + 5.3333 + 12.7551 = **24.0238 in⁴**.
  - I<sub>y</sub> = 1000/12 + 4/12 = 83.667 in⁴.
- **After (R1):** PL2 stays at (0, 1.5) with rotation 90°. It overlaps PL1 over 1 × 1 = 1 in² (y −0.5 … 0.5, x −0.5 … 0.5).
  - A = 14 in² (overlap counted twice).
  - ȳ = 4 × 1.5 / 14 = 0.428571 in.
  - I<sub>x</sub> = 0.8333 + 10 × 0.428571² + 5.3333 + 4 × 1.071429² = 0.8333 + 1.8367 + 5.3333 + 4.5918 = **12.5952 in⁴**.
  - I<sub>y</sub> = 83.667 in⁴.
  - Toast: "Rotated 90° — now overlaps PL1 (common area counted twice). Check the model → Fix: move apart."
  - Warning: "PL1 and PL2 overlap (about 1 in² counted twice)", with **Fix: move apart**. Fix moves PL2 (the smaller part) to (0, 2.5), which gives the "before" values.
- Both sets of numbers were confirmed with the engine in Node (`SPC.analyze`): 24.023810 / 12.595238 in⁴.
- The "after" values are identical to what the tool gives for the same rotation with Prevent overlap off, both before and after this change.

#### How verified

- `node --check` of every inline script (4 scripts, 0 errors). The engine block (`const DBVER=` … `/* SPC-ENGINE-END */`) is byte-identical to main.
- **No-overlap browser tests** (section 6 rewritten; 70 checks, 0 failures, no console errors):
  - **Rotate 90° of PL2 above PL1:**
    - In place (0, 1.5, 90°). Geometry, A and I<sub>x</sub> are identical to the same action with Prevent overlap off.
    - Amber toast names PL1. Check the model lists PL1/PL2 with one Fix button. A = 14.
    - Undo → rotation 0 at (0, 1.5), warning gone. Redo works. Fix → PL2 to (0, 2.5). Undo of Fix works.
  - **Other rotate controls:** key R, toolbar ⟲ 90°, right-click → Rotate 90° CCW, and the Part properties ⟲ Rotate 90° button each rotate in place, with the warning and the Fix button.
  - **Rotation field = 90:** applied in place. No "Not applied" box, field not red. Toast "Applied to PL2 — now overlaps PL1 …". Undo → 0.
  - **Mirrored box** on an angle next to a plate: applied in place (same as with Prevent overlap off); the warning names PL3.
  - **Flip V (key V)** of an L4X4X1/2 standing on a plate: flipped in place about its centroid. Geometry, A, I<sub>x</sub> and I<sub>y</sub> are the same as with Prevent overlap off. The warning names PL1. Undo restores exactly. Right-click → Flip vertical gives the same result.
  - **Rotate with no overlap:** ordinary toast "Rotated 90°", no warning.
  - **Plate containing a hole, rotated:** the part stays in place; the hole is carried to its rotated position (still inside); the overlap is warned.
  - **Group rotate of two parts:** same as with Prevent overlap off; the warning names PL1.
  - **All other N1 checks** are unchanged and pass: drag, snap, nudge, paste, duplicate, mirror copy (placed free and touching), add, part-panel refusals and Place touching, holes, toggle, legacy file.
- **Main vs branch, models without overlap:**
  - Default example and all 8 templates: results of every output tab, warnings and saved model identical. Validation 60/60 on both. No console errors.
  - Default example plus six free parts (plate with a hole, L6X4X1/2, rect. tube, round tube, C10X15.3). On each part: rotate 90°, −90° and 45°, flip H, flip V, key R, Rotation field 30°, Mirrored box. Then group rotate, group flip and undo. Across these 45 states, geometry, results, warnings, toasts and autosave are **identical**.
- **Re-run:**
  - N2 dimension tests 35/0; live-field tests 47/0; Phase 1 browser tests 49/0; node geometry 18/0.
  - DXF export: 24 files and 13 UI checks; ezdxf audit 0 errors; worst relative error 2.6e-15.
  - 400 px: no horizontal scroll.
- Screenshots looked at: `rotate_warning.png` (amber toast + Check the model with Fix button), `flip_warning.png`, `rotfield_warning.png`.

#### Open items

- R-O1. The Part properties **Rotation** field and **Mirrored** box do **not** carry the holes inside the part; they change only the part's own orientation. The toolbar, menu and key actions do carry them. This was already so before this change, with Prevent overlap on or off. As a result, a hole can be left partly outside its part, and the existing "Hole … is not entirely inside one material part" warning appears. Making these two fields carry holes, as N-O1 implies, would be a further behaviour change. Say if it is wanted. **Closed 2026-10-10: yes, they carry the holes exactly as the toolbar does (see R2).**


## 2026-10-10 — PR: claude/spc-hole-carry (PR link added after merge)

### R2. Rotation field and Mirrored box carry the holes inside the part (R-O1 closed); DXF units decided (X-O4 closed)   [drawing behaviour — no change to any formula, computed property, storage key or saved format]

**Engineer's decisions (2026-10-10):**

| Item | Decision | Result |
|---|---|---|
| R-O1 | **Yes.** The Part properties **Rotation (CCW)** field and **Mirrored** box carry the holes inside the part exactly as the toolbar / menu / key rotate and flip do: same pivot, same rule for which holes are "inside the part", same behaviour with Prevent overlap on and off. | Changed in this entry. |
| X1 units | Keep the display units for the DXF export (in → in, `$INSUNITS = 1`; mm → mm, `$INSUNITS = 4`). | No code change. Recorded as X-O4, closed. X-O1 and X-O3 stay open. |

- **What the toolbar path does (the two fields now do the same):**
  - **Which holes:** `novCarried(new Set([part id]))`, i.e. holes wholly inside the part and not wholly inside any other solid part.
  - **Prevent overlap off:** `novCarried` returns nothing, so neither the toolbar nor the fields carry holes in that mode. This is unchanged and matches the toolbar, as decided.
  - **Pivot:** the part centroid (part x, y), as for a single-part toolbar rotate or flip.
  - **Rotation field, old value r₀ → new value r:** each carried hole turns by a = r − r₀ about the centroid. Its position is rotated by a and its rotation becomes norm(rot + a). This is the same arithmetic as `actRotate(a)`, so field 90 and ⟲ 90° give bit-identical geometry.
  - **Mirrored box:** toggling the mirror in the part's own frame is a reflection about the line through the centroid at angle r₀ + 90°. Each carried hole is reflected about that line:
    - position (dx, dy) → (−cos 2r₀·dx − sin 2r₀·dy, −sin 2r₀·dx + cos 2r₀·dy);
    - hole rotation → norm(2r₀ − rot);
    - hole mirror toggled.
    - With r₀ = 0 this is exactly the toolbar Flip H (x → 2c − x, rot → norm(−rot), mirror toggled).
  - **The part itself** is set exactly as before (`pt.rot = v` / `pt.mir = v`). The overlap warning (R1, `guard: GR`) is unchanged.
- **Other paths that change a part's rotation / mirror (checked):**
  - **Toolbar, menu and keys:** ⇋ Flip H, ⇵ Flip V, ⟲ 90°, ⟳ 90°, ∠…; right-click Flip / Rotate / Rotate by angle…; keys H / V / R / Shift+R. The Part properties Flip ↔ / Flip ↕ / ⟲ 90° / ⟳ 90° buttons and the ⟲ Rotate 90° button under the size fields also belong here. All of these call `actFlip` / `actRotate`, which already carry holes. Unchanged.
  - **Multi-part (group) pane:** it has only Flip / ⟲ / ⟳ buttons, which call `actFlip` / `actRotate` (group about the bounding-box centre). Unchanged; they carry holes.
  - **Parts list inline fields:** sizes only (b × t, angle size), with no rotation or mirror field. Nothing to change.
  - **Undo / redo:** whole-model snapshots. One field edit (focus to blur) or one box click is one undo step, and it restores the part and its holes together.
  - **Polygon vertex edit** (`setPolyGlobal`): resets rot / mir to 0 but keeps the world shape, so holes need not move. Unchanged.
  - **Mirror copy, Duplicate, Paste, templates:** these make new parts, and holes are not copied with them. Unchanged.
  - **Not rotation, noted only:** the Part properties **Centroid x / y** and **edge** fields move the part without its holes. Drag, nudge, "Move by" and align do carry them with Prevent overlap on. Not changed here (see R2-O1).
- **Typing digit by digit** (e.g. "4" then "45") applies each value in turn, so the holes are carried step by step (0 → 4 → 45). The end position equals the toolbar's 45° to within float rounding (1e-15).

#### Where (anchors) — exact before / after

1. `buildPartPane`, anchors `'Rotation (CCW)'` and `'pp_mir'`:
```js
// before
    fRow(body, 'Rotation (CCW)', numIn(() => pt.rot, v => { pt.rot = v; }, 'pp_rot', { k: 'deg', geo: true, guard: GR }), '°', 'About the part centroid. Mirrored = reflected left-right in the part\'s own frame before the rotation.');
    chkRow(body, 'Mirrored', chkIn(() => pt.mir, v => { pt.mir = v; }, 'pp_mir', true, true, GR));
// after
    fRow(body, 'Rotation (CCW)', numIn(() => pt.rot, v => { setOrient(pt, v, pt.mir); }, 'pp_rot', { k: 'deg', geo: true, guard: GR }), '°', 'About the part centroid. Mirrored = reflected left-right in the part\'s own frame before the rotation.');
    chkRow(body, 'Mirrored', chkIn(() => pt.mir, v => { setOrient(pt, pt.rot, v); }, 'pp_mir', true, true, GR));
```
2. New function, inserted before `function novCarriedFix(id) {`:
```js
// Rotation field / Mirrored box of the Part properties: the holes inside the part turn / reflect with it about the part centroid,
// exactly as with the toolbar rotate / flip (same rule for which holes are carried: novCarried, i.e. only with Prevent overlap on).
// Engineer's decision R-O1, 2026-10-10. Mirrored toggles the part's own frame: a reflection about the line through the centroid at rot + 90°.
function setOrient(pt, rot, mir) {
  const r0 = pt.rot || 0, c = [pt.x, pt.y], hs = novCarried(new Set([pt.id])).map(partById);
  if (!!mir !== !!pt.mir) {
    const a = 2 * r0 * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    hs.forEach(h => { const dx = h.x - c[0], dy = h.y - c[1]; h.x = c[0] - cs * dx - sn * dy; h.y = c[1] - sn * dx + cs * dy; h.rot = norm(2 * r0 - (h.rot || 0)); h.mir = !h.mir; });
  }
  if ((rot || 0) !== r0) {
    const a = (rot || 0) - r0, r = a * Math.PI / 180, cs = Math.cos(r), sn = Math.sin(r);
    hs.forEach(h => { h.rot = norm((h.rot || 0) + a); const dx = h.x - c[0], dy = h.y - c[1]; h.x = c[0] + cs * dx - sn * dy; h.y = c[1] + sn * dx + cs * dy; });
  }
  pt.rot = rot; pt.mir = mir;
}
```
3. Method → Drawing, "Flip and rotate" bullet. Appended after "…as for any overlap.": " With "Prevent overlap" on, holes that lie inside the part turn or flip with it, about the same point, with every one of these controls (Rotation field and Mirrored box included)."

#### Check case

Setup: PL1 plate b = 8, t = 4 at (0, 0). H1 is a rectangular hole 2 wide × 1 high at (2, 1), i.e. x 1…3, y 0.5…1.5, inside PL1. Prevent overlap is on. Select PL1 and type 90 in **Rotation (CCW)**. PL1 becomes 4 wide × 8 tall (x −2…2, y −4…4).

- Plate alone, rotated: A = 32 in²; about (0, 0), I<sub>x</sub> = 4·8³/12 = 170.667 in⁴ and I<sub>y</sub> = 8·4³/12 = 42.667 in⁴.
- **Before (main):** H1 stays at (2, 1), 2 wide × 1 high, half outside PL1 (x 2…3). Warning: "Hole H1 is not entirely inside one material part: the area it removes may not exist."
  - A = 32 − 2 = **30 in²**.
  - x̄ = −2·2/30 = **−0.133333 in**; ȳ = −2·1/30 = **−0.066667 in**.
  - I<sub>x</sub> = 170.667 − (2·1³/12 + 2·1²) − 30·0.066667² = 168.5 − 0.133333 = **168.366667 in⁴**.
  - I<sub>y</sub> = 42.667 − (1·2³/12 + 2·2²) − 30·0.133333² = 34.0 − 0.533333 = **33.466667 in⁴**.
  - I<sub>xy</sub> = −2·2·1 − 30·(−0.133333)(−0.066667) = **−4.266667 in⁴**.
- **After (this change):** H1 turns with PL1 about (0, 0): (2, 1) → (−1, 2), rotation 90°. It is now 1 wide × 2 high (x −1.5…−0.5, y 1…3), inside PL1. No warning.
  - A = **30 in²**.
  - x̄ = −2·(−1)/30 = **+0.066667 in**; ȳ = −2·2/30 = **−0.133333 in**.
  - I<sub>x</sub> = 170.667 − (1·2³/12 + 2·2²) − 30·0.133333² = 162.0 − 0.533333 = **161.466667 in⁴**.
  - I<sub>y</sub> = 42.667 − (2·1³/12 + 2·1²) − 30·0.066667² = 40.5 − 0.133333 = **40.366667 in⁴**.
  - I<sub>xy</sub> = −2·(−1)·2 − 30·(0.066667)(−0.133333) = **+4.266667 in⁴**.
- **Cross-check:** the unrotated model has I<sub>x</sub> = 40.366667, I<sub>y</sub> = 161.466667 and I<sub>xy</sub> = −4.266667. A 90° turn swaps I<sub>x</sub> and I<sub>y</sub> and changes the sign of I<sub>xy</sub>, which gives the "after" values. Pressing R (toolbar ⟲ 90°) gives the same result, bit for bit.
- Both sets of numbers were read from the tool in the browser (main and branch) and match the hand values to 1e-9.

#### How verified

- `node --check` of every inline script (4 scripts, 0 errors). The engine block (`const DBVER=` … `/* SPC-ENGINE-END */`) is byte-identical to main.
- **New browser tests** (28 checks, 0 failures, no console errors):
  - **Check case:** on main, the hole stays, the warning appears and the "before" values result. On the branch, the hole goes to (−1, 2) at rot 90, no warning, "after" values. Field 90 and toolbar ⟲ 90° are bit-identical.
  - **Undo / redo:** undo after the field restores the part and hole exactly, in one step; redo gives the carried state. Typing "45" key by key equals toolbar 45° within 1e-12 and is one undo step.
  - **Prevent overlap off:** field 90 = toolbar ⟲ 90°, and Mirrored box = toolbar Flip H, identical. In both cases the hole is not carried, as before.
  - **Mirrored box:**
    - Unrotated part: same as toolbar Flip H, identical (hole to (−2, 1), mirrored).
    - Part at 30°: the part and the hole are both the reflection about the line through the centroid at 120° (every vertex, to 1e-9). No warning; undo exact.
    - Mirrored part, field 30 → 75: same as toolbar +45° within 1e-12.
  - **Which holes are carried:**
    - Rectangular and round holes in PL1 are carried; a hole in another plate is untouched.
    - A hole in PL1 next to a neighbouring plate: same as the toolbar.
    - Angle L6X6X1/2 with a hole in its leg: field −120 and Mirrored box give the same hole as toolbar −120° / Flip H. (The field stores −120 for the part and the toolbar 240, as before.)
  - **Field that makes the part overlap a neighbour (R1):** applied in place, the warning toast names PL1, and the hole is carried. Same geometry as toolbar ⟲ 90°.
  - **Group:** ⟲ 90° from the multi-part pane carries holes, as before.
- **Main vs branch, models without holes in a field-rotated part:**
  - Model: default example + six free parts (plate, L6X4X1/2, rectangular tube, round tube, C10X15.3, and a plate with a hole that is not rotated).
  - On each of five parts: rotate 90°, −90°, 45°, flip H, flip V, key R, Rotation field 30°, Mirrored box. Then group rotate / flip and undo.
  - 45 states: geometry, results, warnings, toasts and autosave are **identical**.
  - Same run with a hole in a toolbar-rotated plate (toolbar actions only): 35 states identical.
- Default example and all 8 templates (every output tab, warnings, saved model): identical. Validation 60/60 on both. No console errors.
- **Re-run:** no-overlap tests 70/0; N2 dimension tests 35/0; live-field tests 47/0; Phase 1 browser tests 49/0; node geometry 18/0; DXF UI checks 13/13; smoke (KaTeX, Validation 60); 400 px: no horizontal scroll.
- Screenshots looked at: `field90_carried.png`, `field_overlap_hole.png`.

#### Open items

- R2-O1. The Part properties **Centroid x / y** and **edge** fields move a part without the holes inside it, while drag, nudge, "Move by" and align carry them (with Prevent overlap on). Not changed here, because it is not a rotate / flip path. Say if these fields should carry holes too.

## 2026-10-10 — PR: claude/spc-p2a (PR link added after merge)

### P2a. Weight and coating area, AISC E4/F2 parameters and Wagner β, stresses, kern, Mohr's circle and inertia ellipse   [new outputs — no existing formula, result, storage key or file version changed]

- **Engineer's request (2026-10-10):** "let's start tackling the easy ones" — items 1–5 of the commercial-tools list: weight and paint area; AISC torsion/buckling parameters; stress plot; kern; Mohr's circle and inertia ellipse.
- **Existing results unchanged.** `SPC.analyze` is not modified. The new values are computed on demand from its result (`ext()` cache on `R`). The default example and the 8 templates give identical results, identical text on every existing tab (Properties and Calc detail: the new sections are appended after the existing ones, so the old text is an exact prefix), identical drawing and an identical saved model (in and mm units). Validation: the 60 Phase 1 checks unchanged, 36 new checks; 96/96 pass.
- **Where the new outputs are:**
  - Properties tab (appended): 7. Mohr's circle of inertia; 8. Flexural-torsional and lateral-torsional buckling parameters (r̄o, H, r_ts, h_o, β_x); 9. Kern; 10. Weight and coating (paint) area per length.
  - Calc detail tab (appended): formulas with values and references for each (weight and coating, r̄o/H/r_ts, Wagner β, kern, ellipse).
  - New output tab **Stresses** (between Q & shear flow and Validation): inputs P, M_x, M_y with a sign-convention sketch, colour plot, neutral axis, extreme values, formula block, table per part. Also in the print report (option "Stresses", off by default).
  - Drawing overlays (Settings → Drawing): **Kern (core)** and **Inertia ellipse (Culmann)**, off by default.
  - Part properties → Material: **Density ρ** and a preset list (multi-selection: "Set density ρ for all").

#### Formulas, references and conventions

| Item | Formula as implemented | Reference | Flag |
|---|---|---|---|
| Weight | w = Σ A_i·ρ_i / 144 (A in², ρ lb/ft³ → lb/ft); A_i = the area the properties use (tabulated A when "AISC tabulated" is ticked); **n not applied**; a hole removes A·ρ of the solid part it lies in (largest overlap) | mass = area × density; typical ρ: steel 490, aluminum 169, concrete (normal weight) 150, timber 35 lb/ft³ | typical values, editable |
| Coating perimeter | exposed = Σ boundary pieces with material on exactly one side (midpoint test, offset ±tol, tol = contact tolerance 0.001 in); outside = pieces of boundary loops with positive enclosed area (material on the left) | geometry | — |
| r̄o² | x_o² + y_o² + (I_x + I_y)/A_g, x_o, y_o = thin-wall shear centre from the centroid | AISC 360-16 Eq. E4-9 | **verify** equation number |
| H | 1 − (x_o² + y_o²)/r̄o² | AISC 360-16 Eq. E4-8 | **verify** equation number |
| r_ts | √(√(I_y C_w)/S_x), x = major principal axis; only for a section doubly symmetric about its principal axes (geometric test); C_w thin-wall | AISC 360-16 Eq. F2-7 | thin-wall — verify |
| h_o | single rolled I-shape: d − t_f; three plates forming a doubly symmetric I: distance between flange centroids; otherwise n/a | — | — |
| β_x | (1/I_1)∫v(u² + v²)dA − 2v_o about the principal axes of the n-weighted plate-model geometry; v toward the **tension** side, so β_x > 0 when the larger flange is in compression; reported for "top (+v side) in compression" (= −value computed with v up) and the opposite | Trahair & Bradford; Kitipornchai & Trahair (1980); SSRC Guide; not used by AISC 360 (F4 uses I_yc/I_y) | **verify** sign convention / use |
| σ | P/A − [(M_x I_y − M_y I_xy)y + (M_y I_x − M_x I_xy)x]/(I_x I_y − I_xy²), x, y from the centroid; P > 0 tension; M_x > 0 compresses +y, M_y > 0 compresses +x (M_x = −∫σy dA, M_y = −∫σx dA); part i: n_i·σ | general flexure formula, unsymmetric bending (e.g. Boresi & Schmidt) | — |
| Kern vertex | e = −J·n/(A·d), J = [[I_y, I_xy], [I_xy, I_x]], n = outward unit normal of a convex-hull edge, d its distance from the centroid; circles as circumscribed 720-gons (kern vertices on the exact curve) | no-tension condition | — |
| Mohr's circle | centre (I_x + I_y)/2, radius √(((I_x − I_y)/2)² + I_xy²); X = (I_x, I_xy) plotted with I_xy **upward**; CCW rotation θ of the axes moves X by 2θ CCW | mechanics | — |
| Inertia ellipse | semi-axes r_1 = √(I_1/A) measured along axis 2, r_2 = √(I_2/A) along axis 1 | central (Culmann) ellipse | — |

Exact integrals: ∫x³, ∫x²y, ∫xy², ∫y³ dA over polygons by Green's theorem with 3-point Gauss–Legendre per edge (exact for these degrees); circles in closed form (∫y³ = A c_y³ + 3c_y·πr⁴/4, ∫x²y = c_y(A c_x² + πr⁴/4), …).

Units: moments are entered in kip-ft (kN·m) and stored in **kip-in**; stress ksi (MPa); density lb/ft³ (kg/m³ = × 16.018463); weight lb/ft (kg/m = × 1.4881639); coating area ft²/ft (m²/m).

#### Check cases (hand-verifiable; all reproduced on the Validation tab, groups 10–16)

1. **Weight**, plate 6 × 10 in, steel: w = 60 × 490/144 = **204.17 lb/ft** (aluminum 169: 70.42). Concrete 10 × 10 (n = 1/8) with a Ø2 hole: (100 − π) × 150/144 = 100.89 lb/ft (n not applied). W14X90 with the tabulated A = 26.5: 26.5 × 490/144 = 90.17 vs nominal 90 (+0.19 %). Default example (plate model, steel): W21X62 18.043 in² + C15X33.9 9.900 in² → 27.943 × 490/144 = **95.085 lb/ft** (tabulated weights 62 + 33.9 = 95.9; plate model has no fillets).
2. **Coating**, box of 4 plates, 10 × 6 out-to-out, flanges 1/2, webs 3/8: outside = 2(10 + 6) = **32 in**; inside = 2[(10 − 0.75) + (6 − 1)] = 28.5; exposed = **60.5 in** (the web ends against the flanges are faying, not counted). W14X90 plate model: 4b_f + 2d − 2t_w = 58 + 28 − 0.88 = **85.12 in** (= 7.093 ft²/ft). Default example: W 74.16 + C 42.80 − 2 × 8.24 (W flange on the channel web) = **100.48 in = 8.373 ft²/ft**, outside = exposed (the pocket under the channel is open).
3. **C15X50, r̄o and H** (plate model): A = 14.645 in², I_x = 402.56, I_y = 13.303 in⁴, x_o = −1.4384 in (shear centre from the centroid), r̄o² = 1.4384² + (402.56 + 13.303)/14.645 = 2.0691 + 28.396 = **30.465 in²**, r̄o = **5.519 in** (AISC 5.49, +0.5 %), H = 1 − 2.0691/30.465 = **0.9321** (AISC 0.937, −0.5 %).
4. **W14X90, r_ts** (plate model): √(√(360.84 × 15,929)/140.43) = √(2397.5/140.43) = **4.132 in** (AISC 4.10, +0.8 %); h_o = 14.0 − 0.71 = 13.29 (AISC 13.3); H = 1.
5. **β_x, monosymmetric I** (plates: top flange 12 × 1, web 20 × 1/2, bottom flange 6 × 1): A = 28, ȳ = 2.25 in above mid-web, I_x = 2177.58, I_y = 162.21 in⁴; ∫y(x² + y²)dA = Σ[ȳ_i·h b³/12 + b h(ȳ_i³ + ȳ_i h²/4)] = −7098.1 in⁵ (y up, from the centroid); shear centre h·I_2/(I_1 + I_2) = 21 × 18/(144 + 18) = 2.3333 in below the top-flange centroid (y = 10.5), so y_o = 10.5 − 2.3333 − 2.25 = 5.9167 in; β_x = −[−7098.1/2177.58 − 2 × 5.9167] = **+15.093 in** with the larger (top) flange in compression. Kitipornchai–Trahair: ρ = I_yc/(I_yc + I_yt) = 144/162 = 0.8889 (web neglected), 0.9 × 21 × (2ρ − 1)(1 − (162.21/2177.58)²) = **14.62 in** (−3.1 %). W14X90 at 30°: β_x = 0 (−1.8e-15). Default example: **+17.435 in** (cap-channel side in compression).
6. **Stress, rectangle** 6 × 10 at (3, 5), P = +30 kip, M_x = 50 kip-ft, M_y = 20 kip-ft: corner (6, 10): 30/60 − 600 × 5/500 − 240 × 3/180 = 0.5 − 6 − 4 = **−9.5 ksi**; corner (0, 0): **+10.5 ksi**. **W14X90**, P = −100 kip, M_x = 100 kip-ft, M_y = 20 kip-ft (plate model A = 26.125, I_x = 983.04, I_y = 360.84): corner (7.25, 7): −3.828 − 1200 × 7/983.04 − 240 × 7.25/360.84 = −3.828 − 8.545 − 4.822 = **−17.195 ksi**; corner (−7.25, −7): −3.828 + 8.545 + 4.822 = **+9.539 ksi**.
7. **Stress, angle L6X4X1/2** (plate model, I_xy ≠ 0), M_x = 10 kip-ft only: A = 4.75, I_x = 17.395, I_y = 6.2700, I_xy = −6.0789 in⁴, D = I_xI_y − I_xy² = 72.113 in⁸. σ = −(M_x I_y·y − M_x I_xy·x)/D = −10.434y − 10.116x (ksi, in from the centroid). Tip of the long leg (−0.4868, 4.0132): **−36.95 ksi**; heel (−0.9868, −1.9868): **+30.71 ksi**. Neutral axis: y/x = I_xy/I_y = −0.9695 → **−44.1°** from +x (not horizontal). Ignoring I_xy would give −27.68 ksi at the tip.
8. **Kern**: rectangle 6 × 10 → rhombus with vertices (0, ±10/6), (±1, 0) (b/6 = 1, h/6 = 1.667); solid Ø8 → circle of radius r/4 = 1.000 (all 720 vertices). Default example: 6 vertices, x −1.964 … 1.964, y −9.566 … 5.001 in from the centroid.
9. **Mohr**, L6X4X1/2 at 20°: I_1 + I_2 = I_x + I_y, I_1·I_2 = I_x I_y − I_xy², and the point X turned by 2θ_p lands on I_1 with zero product of inertia (exact).

#### Saved data (CLAUDE.md §5)

- **No key, schema or version changed** (`_schema` and `version: 1` as before). New **optional** fields, written only once used:
  - part `rho` (number, lb/ft³; absent = 490);
  - top-level `stress: {P, Mx, My}` (kip, kip-in, kip-in; absent = all 0);
  - `settings.showKern`, `settings.showEllipse` (absent = off);
  - `ui.outTab: 'stress'`, `ui.print.stress`.
- With the new inputs left at their defaults, the saved JSON is **identical** to main's (checked for the default and the 8 templates).
- `migrate` copies `rho` (finite, > 0) and `stress` (each value a finite number, else 0); everything else as before. Old files load unchanged.
- **The current main version opens a file saved by this version without error** (tested): unknown keys are ignored, the Stresses tab falls back to Section, results are identical. Main **drops** `rho` and `stress` if that file is then re-saved from main (it keeps the two settings), so density and loads would be lost in that round trip.

#### Where (anchors) — exact code

New engine block, inserted before `  /* ---------------- templates ----------------` (engine export list extended accordingly):

```js
  /* ---------------- Phase 2a: weight, coating perimeter, buckling / LTB parameters, Wagner β, kern, stresses ----------------
     Computed on demand from an analyze() result (they do not change any Phase 1 result). Units: in, in², kip, kip-in, ksi;
     density lb/ft³, weight lb/ft. */
  const RHO_STEEL = 490;                                   // lb/ft³, typical structural steel (default when a part has no density)
  const partRho = pt => pos(pt.rho) ? pt.rho : RHO_STEEL;
  // weight per foot = Σ A_i·ρ_i / 144 (A in in², ρ in lb/ft³). A_i is the area the properties use (AISC tabulated A when that
  // option is ticked), NOT multiplied by n. A hole removes weight at the density of the solid part it lies in.
  function weight(R) {
    const sol = R.parts.filter(q => !q.pt.hole).map(q => ({ q, S: novShape(q.pt) }));
    const rows = []; let w = 0;
    R.parts.forEach(q => {
      let rho = partRho(q.pt), host = null;
      if (q.pt.hole) {
        const h = novShape(q.pt); let best = 0;
        sol.forEach(s => { const a = bbHit(h.bbox, s.S.bbox) ? novInter(h, s.S) : 0; if (a > best) { best = a; host = s.q; } });
        if (host) rho = partRho(host.pt);
      }
      const wi = q.P.A * rho / 144; w += wi;
      rows.push({ lbl: q.pt.lbl, id: q.pt.id, A: q.P.A, rho, w: wi, hole: !!q.pt.hole, host: host ? host.pt.lbl : null, own: pos(q.pt.rho), tab: q.use });
    });
    return { w, rows, mixed: new Set(rows.filter(r => !r.hole).map(r => r.rho)).size > 1 };
  }

  /* Boundary of the material = union of the solid parts (minus their own voids) minus the holes.
     Every polygon edge and circle of every part is split where other boundaries cross or touch it; each piece is kept when
     material lies on exactly one side of it (tested at its midpoint, offset ±tol to each side). Faces where two parts touch
     (material on both sides, within the contact tolerance) drop out. Pieces are oriented with the material on the left and
     chained into closed loops: loops enclosing material (positive area) are the outside boundary; negative loops are the
     boundaries of closed cells and holes. Arcs exactly (r·Δθ); rectangular-tube corners as the tool models them (chords). */
  function coating(R, tol) {
    const eps = Math.max(pos(tol) ? tol : 0.001, 1e-9);
    const parts = R.parts.map(q => ({ hole: !!q.pt.hole, lbl: q.pt.lbl, prims: q.G.prims, bb: q.G.bbox }));
    const bbIn = (b, p, m) => p[0] >= b[0] - m && p[0] <= b[2] + m && p[1] >= b[1] - m && p[1] <= b[3] + m;
    const inPrim = (pr, p) => pr.k === 'circ' ? len(sub(p, pr.c)) < pr.r : ptInPoly(p, pr.pts);
    const solids = parts.filter(P => !P.hole), holes = parts.filter(P => P.hole);
    const inMat = p => {
      if (!solids.some(P => bbIn(P.bb, p, 0) && P.prims.reduce((s, pr) => s + (inPrim(pr, p) ? pr.s : 0), 0) > 0)) return false;
      return !holes.some(P => P.prims.some(pr => inPrim(pr, p)));
    };
    // all boundary primitives with a bounding box
    const B = [];
    parts.forEach((P, ip) => P.prims.forEach(pr => {
      if (pr.k === 'circ') B.push({ ip, pr, bb: [pr.c[0] - pr.r, pr.c[1] - pr.r, pr.c[0] + pr.r, pr.c[1] + pr.r] });
      else { let b = [Infinity, Infinity, -Infinity, -Infinity]; pr.pts.forEach(q => { b = [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[0]), Math.max(b[3], q[1])]; }); B.push({ ip, pr, bb: b }); }
    }));
    const hit = (a, b) => !(a[0] > b[2] + eps || b[0] > a[2] + eps || a[1] > b[3] + eps || b[1] > a[3] + eps);
    const pieces = [];
    const keepLine = (a, b, ip) => {
      const d = sub(b, a), L = len(d); if (L < 1e-12) return;
      const m = mul(add(a, b), 0.5), nl = [-d[1] / L, d[0] / L];
      const lf = inMat(add(m, mul(nl, eps))), rt = inMat(sub(m, mul(nl, eps)));
      if (lf === rt) return;
      const pc = lf ? { k: 'L', a, b, L, ip } : { k: 'L', a: b, b: a, L, ip };
      // the same piece from a coincident edge of another part (overlapping parts) is counted once
      if (pieces.some(q => q.k === 'L' && q.ip !== ip && ptSegDist(m, q.a, q.b) < eps / 10 && Math.abs(crs(sub(q.b, q.a), d)) < 1e-9 * q.L * L)) return;
      pieces.push(pc);
    };
    const keepArc = (c, r, a0, a1, ip) => {   // CCW from a0 to a1 (a1 > a0)
      if (a1 - a0 < 1e-12) return;
      const am = (a0 + a1) / 2, u = [Math.cos(am), Math.sin(am)];
      const ins = inMat(add(c, mul(u, Math.max(r - eps, r / 2)))), out = inMat(add(c, mul(u, r + eps)));
      if (ins === out) return;
      if (pieces.some(q => q.k === 'A' && q.ip !== ip && len(sub(q.c, c)) < eps / 10 && Math.abs(q.r - r) < eps / 10 && angIn(am, q.a0, q.a1))) return;
      pieces.push({ k: 'A', c, r, a0, a1, ccw: ins, L: r * (a1 - a0), ip });   // ccw: material inside → traverse CCW
    };
    const angIn = (a, lo, hi) => { let x = a; while (x < lo) x += 2 * PI; while (x > lo + 2 * PI) x -= 2 * PI; return x <= hi; };
    const segCirc = (a, b, c, r) => { // parameters t ∈ (0,1) where segment ab meets the circle
      const d = sub(b, a), f = sub(a, c), A2 = dot(d, d), Bq = 2 * dot(f, d), C = dot(f, f) - r * r, D = Bq * Bq - 4 * A2 * C, o = [];
      if (A2 === 0 || D < 0) return o; const s = Math.sqrt(D); [(-Bq - s) / (2 * A2), (-Bq + s) / (2 * A2)].forEach(t => { if (t > 1e-12 && t < 1 - 1e-12) o.push(t); }); return o;
    };
    B.forEach((X, ix) => {
      const near = B.filter((Y, iy) => iy !== ix && hit(X.bb, Y.bb));
      if (X.pr.k === 'poly') {
        const P = X.pr.pts, n = P.length;
        for (let i = 0; i < n; i++) {
          const a = P[i], b = P[(i + 1) % n], d = sub(b, a), L2 = dot(d, d); if (L2 < 1e-24) continue;
          const ts = [0, 1], proj = q => dot(sub(q, a), d) / L2;
          near.forEach(Y => {
            if (Y.pr.k === 'poly') {
              const Q = Y.pr.pts, m = Q.length;
              for (let j = 0; j < m; j++) {
                const c = Q[j], e = Q[(j + 1) % m];
                if (ptSegDist(c, a, b) <= eps) ts.push(proj(c));
                const den = crs(d, sub(e, c)); if (Math.abs(den) > 1e-14 * Math.sqrt(L2) * len(sub(e, c))) { const t = crs(sub(c, a), sub(e, c)) / den, u = crs(sub(c, a), d) / den; if (t > 0 && t < 1 && u >= 0 && u <= 1) ts.push(t); }
              }
            } else { segCirc(a, b, Y.pr.c, Y.pr.r).forEach(t => ts.push(t)); }
          });
          const T = [...new Set(ts.map(t => Math.min(1, Math.max(0, t))))].sort((x, y) => x - y);
          for (let k = 0; k + 1 < T.length; k++) if (T[k + 1] - T[k] > 1e-12) keepLine(add(a, mul(d, T[k])), add(a, mul(d, T[k + 1])), X.ip);
        }
      } else {
        const c = X.pr.c, r = X.pr.r, ang = [], at = q => Math.atan2(q[1] - c[1], q[0] - c[0]);
        near.forEach(Y => {
          if (Y.pr.k === 'poly') {
            const Q = Y.pr.pts, m = Q.length;
            for (let j = 0; j < m; j++) { const p = Q[j], q2 = Q[(j + 1) % m]; if (Math.abs(len(sub(p, c)) - r) <= eps) ang.push(at(p)); segCirc(p, q2, c, r).forEach(t => ang.push(at(add(p, mul(sub(q2, p), t))))); }
          } else {
            const c2 = Y.pr.c, r2 = Y.pr.r, dd = len(sub(c2, c));
            if (dd > 1e-12 && dd <= r + r2 + eps && dd >= Math.abs(r - r2) - eps) {
              const x = Math.max(-1, Math.min(1, (dd * dd + r * r - r2 * r2) / (2 * dd * r))), base = at(c2), h = Math.acos(x);
              ang.push(base - h, base + h);
            }
          }
        });
        if (!ang.length) { keepArc(c, r, 0, 2 * PI, X.ip); return; }
        const A = [...new Set(ang.map(a => { let x = a % (2 * PI); if (x < 0) x += 2 * PI; return x; }))].sort((x, y) => x - y);
        for (let k = 0; k < A.length; k++) keepArc(c, r, A[k], k + 1 < A.length ? A[k + 1] : A[0] + 2 * PI, X.ip);
      }
    });
    // chain the pieces (material on the left) into loops
    const ends = pc => pc.k === 'L' ? [pc.a, pc.b] : (pc.ccw ? [[pc.c[0] + pc.r * Math.cos(pc.a0), pc.c[1] + pc.r * Math.sin(pc.a0)], [pc.c[0] + pc.r * Math.cos(pc.a1), pc.c[1] + pc.r * Math.sin(pc.a1)]] : [[pc.c[0] + pc.r * Math.cos(pc.a1), pc.c[1] + pc.r * Math.sin(pc.a1)], [pc.c[0] + pc.r * Math.cos(pc.a0), pc.c[1] + pc.r * Math.sin(pc.a0)]]);
    const dirAt = (pc, atEnd) => { if (pc.k === 'L') return mul(sub(pc.b, pc.a), 1 / pc.L); const a = pc.ccw ? (atEnd ? pc.a1 : pc.a0) : (atEnd ? pc.a0 : pc.a1), s = pc.ccw ? 1 : -1; return [-s * Math.sin(a), s * Math.cos(a)]; };
    const area2 = pc => { // ∫(x dy − y dx) along the piece in its direction
      if (pc.k === 'L') return crs(pc.a, pc.b);
      const { c, r, a0, a1 } = pc, v = r * c[0] * (Math.sin(a1) - Math.sin(a0)) - r * c[1] * (Math.cos(a1) - Math.cos(a0)) + r * r * (a1 - a0);
      return pc.ccw ? v : -v;
    };
    const exposed = pieces.reduce((s, pc) => s + pc.L, 0);
    const full = pieces.filter(pc => pc.k === 'A' && pc.a1 - pc.a0 >= 2 * PI - 1e-12), rest = pieces.filter(pc => !(pc.k === 'A' && pc.a1 - pc.a0 >= 2 * PI - 1e-12));
    let outside = 0, inner = 0, nOut = 0, nIn = 0, ok = true;
    full.forEach(pc => { if (pc.ccw) { outside += pc.L; nOut++; } else { inner += pc.L; nIn++; } });
    // nodes: endpoints merged within eps (grid hashing)
    const E = rest.map(pc => ends(pc)), keys = new Map(), node = [], g = 4 * eps;
    const nodeOf = p => {
      const gx = Math.floor(p[0] / g), gy = Math.floor(p[1] / g);
      for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) { const L = keys.get((gx + i) + ',' + (gy + j)); if (L) for (const k of L) if (len(sub(node[k], p)) <= eps) return k; }
      node.push(p); const k = node.length - 1, key = gx + ',' + gy; if (!keys.has(key)) keys.set(key, []); keys.get(key).push(k); return k;
    };
    const S = E.map(e => nodeOf(e[0])), F = E.map(e => nodeOf(e[1]));
    const outOf = node.map(() => []); rest.forEach((pc, i) => outOf[S[i]].push(i));
    const used = new Array(rest.length).fill(false);
    for (let i0 = 0; i0 < rest.length; i0++) {
      if (used[i0]) continue;
      let i = i0, A2 = 0, Ls = 0, guard = 0; const start = S[i0];
      while (guard++ <= rest.length) {
        used[i] = true; A2 += area2(rest[i]); Ls += rest[i].L;
        const nd = F[i]; if (nd === start) break;
        const cand = outOf[nd].filter(j => !used[j]); if (!cand.length) { ok = false; break; }
        const din = dirAt(rest[i], true); let best = -1, bv = -Infinity;
        cand.forEach(j => { const dj = dirAt(rest[j], false), v = Math.atan2(crs(din, dj), dot(din, dj)); if (v > bv) { bv = v; best = j; } });   // leftmost turn
        i = best;
      }
      if (A2 > 0) { outside += Ls; nOut++; } else { inner += Ls; nIn++; }
    }
    return { exposed, outside: ok ? outside : null, inner: ok ? inner : null, nOut, nIn, ok, pieces: pieces.length, eps };
  }

  /* doubly symmetric: the weighted primitives map onto themselves under reflection about each centroidal principal axis */
  function symAbout(R, u) {   // reflection about the line through the centroid along u
    const c = [R.cx, R.cy], ext = Math.max(R.bbox[2] - R.bbox[0], R.bbox[3] - R.bbox[1]), e = 1e-7 * Math.max(ext, 1e-9);
    const rf = p => { const d = sub(p, c), a = dot(d, u); return add(c, sub(mul(u, 2 * a), d)); };
    const items = R.W.filter(x => x.w !== 0), used = new Array(items.length).fill(false);
    return items.every(x => {
      const j = items.findIndex((y, k) => !used[k] && Math.abs(y.w - x.w) <= 1e-12 * Math.abs(x.w) && y.pr.k === x.pr.k && (x.pr.k === 'circ'
        ? (Math.abs(y.pr.r - x.pr.r) <= e && len(sub(rf(x.pr.c), y.pr.c)) <= e)
        : (y.pr.pts.length === x.pr.pts.length && x.pr.pts.every(p => { const q = rf(p); return y.pr.pts.some(v => len(sub(v, q)) <= e); }))));
      if (j < 0) return false; used[j] = true; return true;
    });
  }
  /* AISC 360-16 Ch. E4 / F2 parameters and the Wagner coefficient */
  function buckling(R) {
    const T = R.tors || {}, o = { sc: !!T.sc, why: T.sc ? '' : (T.cwWhy || 'shear centre not computed') };
    if (T.sc) { o.xo = T.xo; o.yo = T.yo; o.ro2 = T.xo * T.xo + T.yo * T.yo + (R.Ix + R.Iy) / R.A; o.ro = Math.sqrt(o.ro2); o.H = 1 - (T.xo * T.xo + T.yo * T.yo) / o.ro2; }
    o.dsym = symAbout(R, R.u1) && symAbout(R, R.u2);
    if (o.dsym && fin(T.Cw)) { o.Imin = R.I2; o.Smaj = R.S1; o.rts = Math.sqrt(Math.sqrt(R.I2 * T.Cw) / R.S1); }
    // h0: single rolled I-shape, or three plates/bars forming an I (two equal flanges, web between), doubly symmetric
    if (o.dsym) {
      const P = R.parts.filter(q => !q.pt.hole);
      if (P.length === 1 && P[0].pt.type === 'shape' && P[0].G.g.kind === 'I') { const d = P[0].G.g.dims; o.h0 = d.d - d.tf; o.h0how = 'd − t_f of ' + P[0].G.g.desc; }
      else if (P.length === 3 && R.parts.length === 3 && P.every(q => q.pt.type === 'plate' || q.pt.type === 'bar')) {
        const s2 = q => dot(sub(q.geo.c, [R.cx, R.cy]), R.u2), wid = q => { const b = q.G.bbox, c = [[b[0], b[1]], [b[2], b[3]]]; let lo = Infinity, hi = -Infinity; q.G.prims[0].pts.forEach(p => { const v = dot(p, R.u1); lo = Math.min(lo, v); hi = Math.max(hi, v); }); return hi - lo; };
        const S2 = P.map(q => ({ q, s: s2(q), w: wid(q) })).sort((a, b) => a.s - b.s), ext = Math.max(R.bbox[2] - R.bbox[0], R.bbox[3] - R.bbox[1]);
        if (Math.abs(S2[1].s) < 1e-9 * ext && S2[0].w > S2[1].w && S2[2].w > S2[1].w) { o.h0 = S2[2].s - S2[0].s; o.h0how = 'distance between the centroids of ' + S2[2].q.pt.lbl + ' and ' + S2[0].q.pt.lbl; }
      }
    }
    o.wag = wagner(R);
    return o;
  }
  // ∫x³, ∫x²y, ∫xy², ∫y³ dA over a polygon (signed by orientation): Green's theorem, edges by 3-point Gauss–Legendre (exact for these degrees)
  const GL3 = [[0.5 - Math.sqrt(0.15), 5 / 18], [0.5, 8 / 18], [0.5 + Math.sqrt(0.15), 5 / 18]];
  function polyCubic(P) {
    let a30 = 0, a21 = 0, a12 = 0, a03 = 0; const n = P.length;
    for (let i = 0; i < n; i++) {
      const p = P[i], q = P[(i + 1) % n], dx = q[0] - p[0], dy = q[1] - p[1];
      GL3.forEach(([t, w]) => { const x = p[0] + t * dx, y = p[1] + t * dy; a30 += w * x ** 4 / 4 * dy; a21 += w * x ** 3 * y / 3 * dy; a12 += w * x * x * y * y / 2 * dy; a03 += w * x * y ** 3 * dy; });
    }
    return { a30, a21, a12, a03 };
  }
  function circCubic(c, r) { const A = PI * r * r, I0 = PI * r ** 4 / 4, x = c[0], y = c[1]; return { a30: A * x ** 3 + 3 * x * I0, a21: y * (A * x * x + I0), a12: x * (A * y * y + I0), a03: A * y ** 3 + 3 * y * I0 }; }
  /* Wagner coefficient (monosymmetry constant), about the centroidal principal axes of the (n-weighted) plate-model geometry:
       β_1 = (1/I_1)∫ v(u² + v²) dA − 2v_o   (u along axis 1, v along axis 2 = u1 turned 90° CCW; v_o = shear-centre ordinate)
       β_2 = (1/I_2)∫ u(u² + v²) dA − 2u_o
     Sign: as computed, for the +v side in TENSION (v measured toward the tension side, as Trahair & Bradford measure y);
     the value for the +v side in compression is −β. */
  function wagner(R) {
    const T = R.tors || {}; if (!T.sc) return { ok: false, why: T.cwWhy || 'shear centre not computed' };
    const m = { A: 0, Sx: 0, Sy: 0, Ixx: 0, Iyy: 0, Ixy: 0 };
    R.W.forEach(({ pr, w }) => { const q = primM(pr); Object.keys(m).forEach(k => { m[k] += w * q[k]; }); });
    const cx = m.Sy / m.A, cy = m.Sx / m.A, Ixc = m.Ixx - m.A * cy * cy, Iyc = m.Iyy - m.A * cx * cx, Ixyc = m.Ixy - m.A * cx * cy;
    const pr0 = principal(Ixc, Iyc, Ixyc), u1 = [Math.cos(pr0.th), Math.sin(pr0.th)], u2 = [-Math.sin(pr0.th), Math.cos(pr0.th)];
    const loc = p => { const d = [p[0] - cx, p[1] - cy]; return [dot(d, u1), dot(d, u2)]; };
    let a30 = 0, a21 = 0, a12 = 0, a03 = 0;
    R.W.forEach(({ pr, w }) => { const k = pr.k === 'poly' ? polyCubic(pr.pts.map(loc)) : circCubic(loc(pr.c), pr.r); a30 += w * k.a30; a21 += w * k.a21; a12 += w * k.a12; a03 += w * k.a03; });
    const sc = loc(T.sc), b1 = (a21 + a03) / pr0.I1 - 2 * sc[1], b2 = pr0.I2 > 0 ? (a30 + a12) / pr0.I2 - 2 * sc[0] : null;
    return { ok: true, A: m.A, c: [cx, cy], I1: pr0.I1, I2: pr0.I2, th: pr0.th, u1, u2, int1: a21 + a03, int2: a30 + a12, vo: sc[1], uo: sc[0], b1, b2 };
  }

  /* kern (core): load points (axial force) that cause no stress reversal. Each edge of the convex hull of the material
     (outward unit normal n, distance d from the centroid) gives one kern vertex e = −J·n/(A·d), J = [[I_y, I_xy], [I_xy, I_x]].
     Circles enter the hull as circumscribed 720-gons (every hull edge from a circle is a true tangent: kern vertices on the
     exact kern curve; the hull is up to 0.001 % larger near a circle, i.e. conservative). Transformed A, I when n ≠ 1. */
  function kern(R) {
    const pts = [], N = 720, rc = 1 / Math.cos(PI / N);
    R.parts.forEach(q => { if (q.pt.hole) return; q.G.prims.forEach(pr => { if (pr.s < 0) return; if (pr.k === 'poly') pr.pts.forEach(p => pts.push(p)); else for (let i = 0; i < N; i++) { const a = 2 * PI * (i + 0.5) / N; pts.push([pr.c[0] + pr.r * rc * Math.cos(a), pr.c[1] + pr.r * rc * Math.sin(a)]); } }); });
    const H = hull(pts), c = [R.cx, R.cy], V = [];
    for (let i = 0; i < H.length; i++) {
      const a = H[i], b = H[(i + 1) % H.length], e = sub(b, a), L = len(e); if (L < 1e-12) continue;
      const n = [e[1] / L, -e[0] / L], d = dot(n, sub(a, c)); if (!(d > 0)) return { ok: false, why: 'the centroid is not inside the convex hull' };
      const k = [-(R.Iy * n[0] + R.Ixy * n[1]) / (R.A * d), -(R.Ixy * n[0] + R.Ix * n[1]) / (R.A * d)];
      V.push({ e: k, p: add(c, k), n, d, a, b });
    }
    let bb = [Infinity, Infinity, -Infinity, -Infinity]; V.forEach(v => { bb = [Math.min(bb[0], v.e[0]), Math.min(bb[1], v.e[1]), Math.max(bb[2], v.e[0]), Math.max(bb[3], v.e[1])]; });
    return { ok: true, V, hull: H, ext: bb, circ: R.parts.some(q => !q.pt.hole && q.G.prims.some(pr => pr.k === 'circ' && pr.s > 0)) };
  }
  function hull(P) {   // Andrew's monotone chain, CCW, collinear points dropped
    const S = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]); if (S.length < 3) return S;
    const sc = Math.max(1e-300, ...S.map(p => Math.abs(p[0]) + Math.abs(p[1]))), z = 1e-14 * sc * sc;
    const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lo = [], up = [];
    S.forEach(p => { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= z) lo.pop(); lo.push(p); });
    for (let i = S.length - 1; i >= 0; i--) { const p = S[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= z) up.pop(); up.push(p); }
    lo.pop(); up.pop(); return lo.concat(up);
  }

  /* normal stress, unsymmetric bending (x, y from the centroid; I_x, I_y, I_xy of the (transformed) section):
       σ = P/A − [(M_x I_y − M_y I_xy)·y + (M_y I_x − M_x I_xy)·x] / (I_x I_y − I_xy²)
     P > 0 tension; M_x > 0 compresses the +y side, M_y > 0 compresses the +x side (moments about the centroidal axes,
     i.e. M_x = −∫σ y dA, M_y = −∫σ x dA). Part i (modulus ratio n_i): σ_i = n_i·σ. */
  function stress(R, P, Mx, My) {
    P = fin(P) ? P : 0; Mx = fin(Mx) ? Mx : 0; My = fin(My) ? My : 0;
    const D = R.Ix * R.Iy - R.Ixy * R.Ixy, s0 = P / R.A, ky = -(Mx * R.Iy - My * R.Ixy) / D, kx = -(My * R.Ix - Mx * R.Ixy) / D;
    const sig = p => s0 + kx * (p[0] - R.cx) + ky * (p[1] - R.cy), gn = Math.hypot(kx, ky);
    const parts = []; let mx = null, mn = null;
    R.parts.forEach(q => {
      if (q.pt.hole) return;
      const pts = [];
      q.G.prims.forEach(pr => { if (pr.s < 0) return; if (pr.k === 'poly') pr.pts.forEach(p => pts.push(p)); else { const u = gn > 0 ? [kx / gn, ky / gn] : [1, 0]; pts.push(add(pr.c, mul(u, pr.r)), sub(pr.c, mul(u, pr.r))); } });
      let hi = null, lo = null;
      pts.forEach(p => { const s = q.n * sig(p); if (!hi || s > hi.s + 1e-12 * Math.abs(s)) hi = { s, p }; if (!lo || s < lo.s - 1e-12 * Math.abs(s)) lo = { s, p }; });
      const row = { lbl: q.pt.lbl, id: q.pt.id, n: q.n, hi, lo }; parts.push(row);
      if (hi && (!mx || hi.s > mx.s)) mx = Object.assign({ lbl: q.pt.lbl }, hi);
      if (lo && (!mn || lo.s < mn.s)) mn = Object.assign({ lbl: q.pt.lbl }, lo);
    });
    const na = gn > 1e-300 ? { p: [R.cx - s0 * kx / (gn * gn), R.cy - s0 * ky / (gn * gn)], t: [-ky / gn, kx / gn], ang: Math.atan2(kx, -ky) } : null;
    return { P, Mx, My, D, s0, kx, ky, sig, parts, max: mx, min: mn, na };
  }

```

New UI block, inserted before `/* ---- Validation ---- */`:

```js
/* =====================================================================
   PHASE 2a: weight and coating area, buckling / LTB parameters, Wagner β,
   kern, Mohr's circle, inertia ellipse, stresses
   ===================================================================== */
const VFY2 = (t) => `<span class="badge vfy" title="${esc(t || 'Interpretation or reference to be verified by the engineer')}">verify</span>`;
// results computed on demand from R (cached on R; recomputed whenever R is)
function ext(k) {
  if (!R || !R.ok) return null;
  const X = R._x || (R._x = {});
  if (!(k in X)) {
    try { X[k] = k === 'w' ? SPC.weight(R) : k === 'coat' ? SPC.coating(R, M.settings.tol) : k === 'bk' ? SPC.buckling(R) : k === 'kern' ? SPC.kern(R) : null; }
    catch (e) { console.error(e); X[k] = null; }
  }
  return X[k];
}
const stressIn = () => M.stress || { P: 0, Mx: 0, My: 0 };
function setStress(k, v) { M.stress = Object.assign({ P: 0, Mx: 0, My: 0 }, M.stress || {}); M.stress[k] = isNum(v) ? v : 0; }
const stressOn = () => { const s = stressIn(); return !!(s.P || s.Mx || s.My); };

/* ---- Mohr's circle (SVG) ---- */
function mohrSVG(Ix, Iy, Ixy) {
  const W = 420, H = 300, avg = (Ix + Iy) / 2, Rr = Math.hypot((Ix - Iy) / 2, Ixy), I1 = avg + Rr, I2 = avg - Rr;
  const span = Math.max(I1, 1e-300), rad = Math.max(Rr, 0.02 * span);
  // equal scales on both axes; I axis from 0 (or I2 if negative) to I1
  const lo = Math.min(0, I2), hi = I1, sc = Math.min((W - 70) / Math.max(hi - lo, 1e-300), (H - 70) / (2 * rad));
  const X = v => 40 + (v - lo) * sc, Y = v => H / 2 - v * sc;
  const o = [`<svg class="mohr" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block" role="img" aria-label="Mohr's circle of inertia">`];
  o.push(`<rect x="0" y="0" width="${W}" height="${H}" fill="#FCFDFE"/>`);
  o.push(`<path d="M${fx(X(lo) - 10)} ${H / 2}H${W - 12}M${fx(X(0))} 12V${H - 12}" stroke="#94A3B8" stroke-width="1" fill="none"/>`);
  o.push(`<path d="M${W - 18} ${H / 2 - 4}l6 4l-6 4M${fx(X(0)) - 4} 18l4 -6l4 6" stroke="#94A3B8" fill="none"/>`);
  o.push(`<text x="${W - 14}" y="${H / 2 + 16}" font-size="11" text-anchor="end" fill="#334155">I</text><text x="${fx(X(0) + 6)}" y="20" font-size="11" fill="#334155">I<tspan font-size="8" dy="2">xy</tspan></text>`);
  const cx = X(avg), cy = Y(0), r = Rr * sc;
  if (Rr > 1e-12 * span) o.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="${fx(r)}" fill="none" stroke="#1E3A5F" stroke-width="2"/>`);
  const px = [X(Ix), Y(Ixy)], py = [X(Iy), Y(-Ixy)];
  o.push(`<path d="M${fx(px[0])} ${fx(px[1])}L${fx(py[0])} ${fx(py[1])}" stroke="#64748B" stroke-width="1" stroke-dasharray="4 3"/>`);
  // 2θp arc from X to I1
  const th = SPC.principal(Ix, Iy, Ixy).th, a0 = Math.atan2(Ixy, (Ix - Iy) / 2);
  if (Rr > 1e-12 * span && Math.abs(th) > 1e-9) {
    const ra = Math.min(r * 0.45, 40), N = 24, P = []; for (let i = 0; i <= N; i++) { const a = a0 + 2 * th * i / N; P.push(fx(cx + ra * Math.cos(a)) + ' ' + fx(cy - ra * Math.sin(a))); }
    o.push(`<path d="M${P.join('L')}" stroke="#B45309" stroke-width="1.4" fill="none"/>`);
    const am = a0 + th; o.push(`<text x="${fx(cx + (ra + 12) * Math.cos(am))}" y="${fx(cy - (ra + 12) * Math.sin(am) + 4)}" font-size="10" fill="#B45309" text-anchor="middle">2θp</text>`);
  }
  const dot = (p, col, lab, dx, dy, anc) => `<circle cx="${fx(p[0])}" cy="${fx(p[1])}" r="4.5" fill="${col}" stroke="#fff" stroke-width="1.5"/><text x="${fx(p[0] + dx)}" y="${fx(p[1] + dy)}" font-size="10" fill="#0F172A" text-anchor="${anc || 'start'}">${lab}</text>`;
  o.push(dot(px, '#C0392B', 'X (I<tspan font-size="8" dy="2">x</tspan><tspan dy="-2">, I</tspan><tspan font-size="8" dy="2">xy</tspan><tspan dy="-2">)</tspan>', 7, Ixy >= 0 ? -8 : 16));
  o.push(dot(py, '#1E8449', 'Y (I<tspan font-size="8" dy="2">y</tspan><tspan dy="-2">, −I</tspan><tspan font-size="8" dy="2">xy</tspan><tspan dy="-2">)</tspan>', 7, Ixy <= 0 ? -8 : 16));
  o.push(dot([X(I1), cy], '#1E3A5F', 'I<tspan font-size="8" dy="2">1</tspan>', 0, 18, 'middle'));
  o.push(dot([X(I2), cy], '#1E3A5F', 'I<tspan font-size="8" dy="2">2</tspan>', 0, 18, 'middle'));
  o.push(`<circle cx="${fx(cx)}" cy="${fx(cy)}" r="2.5" fill="#1E3A5F"/>`);
  o.push('</svg>');
  return o.join('');
}

/* ---- Properties tab additions ---- */
function buildPropsP2a(pg) {
  const T = R.tors || {}, bk = ext('bk') || {}, wg = bk.wag || {};
  mkSec(pg, 'pMohr', 'Mohr\'s circle of inertia (centroidal axes)', body => {
    const d = el('div'); d.innerHTML = mohrSVG(R.Ix, R.Iy, R.Ixy); body.appendChild(d);
    body.appendChild(tblEl(['Point', 'I', 'I<sub>xy</sub>', 'Unit'], [
      ['X (axis x)', nf(R.Ix, 'I'), nf(R.Ixy, 'I'), un('I')], ['Y (axis y)', nf(R.Iy, 'I'), nf(-R.Ixy, 'I'), un('I')],
      ['Centre (I<sub>x</sub> + I<sub>y</sub>)/2', nf((R.Ix + R.Iy) / 2, 'I'), '0', un('I')], ['Radius √(((I<sub>x</sub> − I<sub>y</sub>)/2)² + I<sub>xy</sub>²)', nf(Math.hypot((R.Ix - R.Iy) / 2, R.Ixy), 'I'), '', un('I')],
      ['I<sub>1</sub> (major), I<sub>2</sub> (minor)', nf(R.I1, 'I') + ', ' + nf(R.I2, 'I'), '0', un('I')], ['2θ<sub>p</sub> (from X to I<sub>1</sub>, CCW on the circle)', ang(2 * R.thp), '', '']
    ].map(r => r.map((c, i) => i === 0 ? { h: c } : c)), { left: [0] }));
    body.appendChild(el('div', 'hint', 'Sign convention: I horizontal, I<sub>xy</sub> = ∫xy dA plotted <b>upward</b>. Point X = (I<sub>x</sub>, I<sub>xy</sub>), point Y = (I<sub>y</sub>, −I<sub>xy</sub>). Turning the axes counter-clockwise by θ moves X counter-clockwise by 2θ on the circle (I<sub>x′</sub> = c + R cos(2θ + 2α), I<sub>x′y′</sub> = R sin(2θ + 2α)); X reaches I<sub>1</sub> after 2θ<sub>p</sub>. Some texts plot −I<sub>xy</sub> upward, which mirrors the figure.'));
  });
  mkSec(pg, 'pBk', 'Flexural-torsional and lateral-torsional buckling parameters', body => {
    const na = (v, k, w) => isNum(v) ? nf(v, k) : 'n/a';
    const rows = [
      ['r̄<sub>o</sub>² = x<sub>o</sub>² + y<sub>o</sub>² + (I<sub>x</sub> + I<sub>y</sub>)/A<sub>g</sub>', bk.sc ? nf(bk.ro2, 'A') : 'n/a', un('A'), { h: 'AISC 360-16 Eq. E4-9 ' + VFY2('Equation number as understood for AISC 360-16; check against the printed Specification') + (bk.sc ? '' : ' — ' + esc(bk.why)) }],
      ['r̄<sub>o</sub>', bk.sc ? nf(bk.ro, 'L') : 'n/a', un('L'), ''],
      ['H = 1 − (x<sub>o</sub>² + y<sub>o</sub>²)/r̄<sub>o</sub>²', bk.sc ? nf(bk.H, 'n', 4) : 'n/a', '', { h: 'AISC 360-16 Eq. E4-8 ' + VFY2('Equation number as understood for AISC 360-16; check against the printed Specification') }],
      ['r<sub>ts</sub> = √(√(I<sub>y</sub>C<sub>w</sub>)/S<sub>x</sub>)', isNum(bk.rts) ? nf(bk.rts, 'L') : 'n/a', un('L'), { h: 'AISC 360-16 Eq. F2-7; doubly symmetric I-shapes only. ' + (bk.dsym ? (isNum(bk.rts) ? 'x = major principal axis. Uses the thin-wall C<sub>w</sub> ' + VFY : 'C<sub>w</sub> n/a') : 'Not shown: the section is not doubly symmetric about its principal axes (or not detected as such).') }],
      ['h<sub>o</sub> (distance between flange centroids)', isNum(bk.h0) ? nf(bk.h0, 'L') : 'n/a', un('L'), { h: isNum(bk.h0) ? esc(bk.h0how) : 'Given only for a single rolled I-shape or three plates forming a doubly symmetric I (not identified for other sections).' }],
      ['β<sub>x</sub>, top (+v side) in compression', wg.ok ? nf(-wg.b1, 'L') : 'n/a', un('L'), { h: (wg.ok ? 'Wagner monosymmetry constant about the major principal axis 1; positive when the larger flange is in compression. Bottom (−v side) in compression: β<sub>x</sub> = ' + esc(nf(wg.b1, 'L')) + '. ' : esc(wg.why || '') + '. ') + 'Not used by AISC 360 (F4 uses I<sub>yc</sub>/I<sub>y</sub>); for AS 4100 / EN 1993 / SSRC methods ' + VFY2('Sign convention and use in the design standard to be confirmed') }]
    ];
    body.appendChild(tblEl(['Parameter', 'Value', 'Unit', 'Note'], rows.map(r => r.map((c, i) => i === 0 ? { h: c } : c)), { left: [0, 3] }));
    body.appendChild(el('div', 'hint', 'x<sub>o</sub>, y<sub>o</sub>: shear centre from the centroid (thin-wall model, Torsion tab). r̄<sub>o</sub> and H do not depend on the axis directions (AISC uses the principal axes). n/a when the shear centre is n/a (closed cells, separate pieces, custom polygons). v = axis 2 direction (for an unrotated section with x as the major axis, v = y, upward).'));
  });
  mkSec(pg, 'pKern', 'Kern (core) of the section', body => {
    const K = ext('kern');
    if (!K || !K.ok) { body.appendChild(el('div', 'note', 'Kern n/a' + (K && K.why ? ': ' + esc(K.why) : ''))); return; }
    const e = K.ext;
    body.appendChild(tblEl(['Kern extent from the centroid', 'Value', 'Unit'], [
      ['x: left … right', nf(e[0], 'L') + ' … ' + nf(e[2], 'L'), un('L')], ['y: bottom … top', nf(e[1], 'L') + ' … ' + nf(e[3], 'L'), un('L')]
    ], { left: [0] }));
    const many = K.V.length > 48;
    const rows = (many ? K.V.filter((v, i) => i % Math.ceil(K.V.length / 24) === 0) : K.V).map((v, i) => [String(i + 1), nf(v.e[0], 'L'), nf(v.e[1], 'L'), nf(v.p[0], 'L'), nf(v.p[1], 'L')]);
    body.appendChild(tblEl(['Vertex', 'e<sub>x</sub> (from centroid)', 'e<sub>y</sub> (from centroid)', 'x (from origin)', 'y (from origin)'], rows));
    body.appendChild(el('div', 'hint', (many ? `${K.V.length} vertices (curved boundary from round parts); every ${Math.ceil(K.V.length / 24)}th listed. ` : `${K.V.length} vertices, one per edge of the convex hull. `) + 'An axial force applied inside the kern causes no stress reversal over the section (compression only for a compressive force). Toggle "Kern" in Settings → Drawing to draw it.' + (R.anyN ? ' Transformed section (n): the kern of the transformed section.' : '')));
  });
  mkSec(pg, 'pWt', 'Weight and coating (paint) area per length', body => {
    const Wt = ext('w'), C = ext('coat');
    if (Wt) {
      const rows = Wt.rows.map(r => [r.lbl + (r.hole ? ' (hole' + (r.host ? ' in ' + r.host : '') + ')' : ''), nf(r.A, 'A'), nf(r.rho, 'rho', 4) + (r.hole ? '' : (r.own ? '' : ' (default steel)')), nf(r.w, 'wt')]);
      rows.push({ cls: 'gov', cells: [{ h: '<b>Total</b>' }, '', '', { h: '<b>' + nf(Wt.w, 'wt') + '</b>' }] });
      body.appendChild(tblEl(['Part', 'A', 'ρ (' + un('rho') + ')', 'Weight (' + un('wt') + ')'], rows, { left: [0] }));
      body.appendChild(el('div', 'hint', 'Weight = Σ A<sub>i</sub>·ρ<sub>i</sub> (net of holes; tube voids excluded). The modulus ratio n does <b>not</b> change the weight. ' + (R.anyTab ? 'Parts set to "AISC tabulated" use the tabulated A (fillets included). ' : 'Rolled shapes: plate-model A (fillets neglected; tick "Use AISC tabulated" for the tabulated A). ') + 'Densities are typical values unless entered (Part properties → Material).'));
    }
    if (C) {
      const pr = v => isNum(v) ? nf(v, 'L') : 'n/a', pa = v => isNum(v) ? nf(v, 'pa') : 'n/a';
      body.appendChild(tblEl(['Perimeter', 'Length (' + un('L') + ')', 'Area per length (' + un('pa') + ')', 'Note'], [
        ['Exposed (all boundary of the material)', pr(C.exposed), pa(C.exposed), { h: 'includes closed cells and holes; faces where parts touch excluded' }],
        ['Outside only', pr(C.outside), pa(C.outside), { h: C.ok ? 'outer boundary; closed cells and holes excluded' : 'n/a: the boundary could not be closed into loops' }],
        ['Inside (closed cells and holes)', pr(C.inner), pa(C.inner), { h: C.ok ? C.nIn + ' loop' + (C.nIn === 1 ? '' : 's') : '' }]
      ].map(r => r.map((c, i) => i === 0 ? { h: c } : c)), { left: [0, 3] }));
      body.appendChild(el('div', 'hint', 'Paint area per length = perimeter × 1 ft (' + (unitSys() === 'mm' ? 'perimeter in m × 1 m' : 'perimeter in in ÷ 12') + '). Faces closer than the contact tolerance (' + esc(nu(C.eps, 'L')) + ') to another part are treated as faying (not painted). Round parts exact (2πr); rectangular-tube and HSS corners as the 24 chords per corner the tool uses (perimeter 0.04 % short of the true arc). Rolled shapes: plate model (no fillets).'));
    }
  });
}

/* ---- Calc detail additions ---- */
function buildCalcP2a(pg) {
  const L = un('L'), bk = ext('bk') || {}, wg = bk.wag || {}, T = R.tors || {};
  mkSec(pg, 'cWt', 'Weight and coating area per length', body => {
    const Wt = ext('w'), C = ext('coat');
    if (Wt) calc(body, { title: 'Weight per length', ref: 'mass = area × density (typical densities: steel 490, aluminum 169, concrete 150, timber 35 lb/ft³)', lines: [
      TX`w=\Sigma A_i\,\rho_i\quad(\text{in}^2\times\text{lb/ft}^3\div 144=\text{lb/ft})`,
      TX`w=${Wt.rows.map(r => `${nt(r.A, 'A')}\\times ${nt(r.rho, 'rho', 4)}`).slice(0, 6).join('+')}${Wt.rows.length > 6 ? '+\\ldots' : ''}\ \text{(${un('A')}·${un('rho')})}=${nt(Wt.w, 'wt')}\ \text{${un('wt')}}`],
      result: 'w = ' + nu(Wt.w, 'wt') + ' (n not applied; holes at the density of the part they lie in)' });
    if (C) calc(body, { title: 'Coating (paint) perimeter', ref: 'geometry of the union of the parts', lines: [
      TX`p_{exposed}=\Sigma\,\text{lengths of boundary pieces with material on one side only}=${nt(C.exposed, 'L')}\ \text{${L}}`,
      C.ok ? TX`p_{outside}=\Sigma\,\text{pieces of loops enclosing material (positive area)}=${nt(C.outside, 'L')}\ \text{${L}}` : TX`p_{outside}=\text{n/a}`,
      TX`a=p\times 1\ \text{ft}=${C.ok ? nt(C.outside, 'pa') : '\\text{n/a}'}\ (\text{outside}),\quad ${nt(C.exposed, 'pa')}\ (\text{exposed})\ \text{${un('pa')}}`],
      result: `Exposed ${nu(C.exposed, 'L')}, outside ${isNum(C.outside) ? nu(C.outside, 'L') : 'n/a'}` });
  });
  mkSec(pg, 'cBk', 'Flexural-torsional buckling parameters r̄<sub>o</sub>, H and r<sub>ts</sub>', body => {
    if (!bk.sc) { body.appendChild(el('div', 'note', 'r̄<sub>o</sub>, H: n/a — the shear centre is n/a (' + esc(bk.why) + ').')); }
    else calc(body, { title: 'Polar radius of gyration about the shear centre, and flexural constant', ref: 'AISC 360-16 Eq. E4-9 and E4-8', badge: VFY2('Equation numbers as understood for AISC 360-16; shear centre from the thin-wall model'), lines: [
      TX`\bar{r}_o^2=x_o^2+y_o^2+\frac{I_x+I_y}{A_g}=\left(${nt(bk.xo, 'L')}\right)^2+\left(${nt(bk.yo, 'L')}\right)^2+\frac{${nt(R.Ix, 'I')}+${nt(R.Iy, 'I')}}{${nt(R.A, 'A')}}=${nt(bk.ro2, 'A')}\ \text{${un('A')}}`,
      TX`\bar{r}_o=${nt(bk.ro, 'L')}\ \text{${L}}`,
      TX`H=1-\frac{x_o^2+y_o^2}{\bar{r}_o^2}=1-\frac{${nt(bk.xo * bk.xo + bk.yo * bk.yo, 'A')}}{${nt(bk.ro2, 'A')}}=${nf(bk.H, 'n', 5)}`],
      result: `r̄o = ${nu(bk.ro, 'L')}, H = ${nf(bk.H, 'n', 4)} (x_o, y_o = shear centre from the centroid; invariant under rotation of the axes)` });
    if (isNum(bk.rts)) calc(body, { title: 'Effective radius of gyration for LTB (doubly symmetric I-shapes)', ref: 'AISC 360-16 Eq. F2-7', badge: VFY, lines: [
      TX`r_{ts}=\sqrt{\frac{\sqrt{I_yC_w}}{S_x}}=\sqrt{\frac{\sqrt{${nt(bk.Imin, 'I')}\times${nt(T.Cw, 'W')}}}{${nt(bk.Smaj, 'S')}}}=${nt(bk.rts, 'L')}\ \text{${L}}`],
      result: `r_ts = ${nu(bk.rts, 'L')} (x = major principal axis, y = minor; C_w thin-wall)` + (isNum(bk.h0) ? `; h_o = ${nu(bk.h0, 'L')} (${bk.h0how})` : '') });
    else body.appendChild(el('div', 'note', 'r<sub>ts</sub>: shown only for a doubly symmetric section with C<sub>w</sub> (AISC 360-16 F2 applies to doubly symmetric compact I-shapes and channels; the channel case is not covered here).'));
  });
  mkSec(pg, 'cWag', 'Wagner monosymmetry constant β<sub>x</sub>', body => {
    if (!wg.ok) { body.appendChild(el('div', 'note', 'β<sub>x</sub>: n/a — ' + esc(wg.why || 'shear centre n/a'))); return; }
    calc(body, { title: 'Monosymmetry constant about the major principal axis 1', ref: 'Trahair & Bradford; Kitipornchai & Trahair (1980); SSRC Guide', badge: VFY2('Sign convention and the standard\'s use of β to be confirmed by the engineer'), lines: [
      TX`\beta_x=\frac{1}{I_1}\int_A v\,(u^2+v^2)\,dA-2v_o\quad(u\ \text{along axis 1},\ v\ \text{along axis 2},\ \text{from the centroid})`,
      TX`\int_A v\,(u^2+v^2)\,dA=${nt(wg.int1 * uf('I') * uf('L'), 'n')}\ \text{${un('L')}}^5,\quad I_1=${nt(wg.I1, 'I')}\ \text{${un('I')}},\quad v_o=${nt(wg.vo, 'L')}\ \text{${L}}`,
      TX`\beta_{x,(+v\ \text{in tension})}=\frac{${nt(wg.int1 * uf('I') * uf('L'), 'n')}}{${nt(wg.I1, 'I')}}-2\times${nt(wg.vo, 'L')}=${nt(wg.b1, 'L')}\ \text{${L}}`,
      TX`\beta_{x,(+v\ \text{in compression})}=${nt(-wg.b1, 'L')}\ \text{${L}}`],
      result: `β_x = ${nf(-wg.b1, 'L')} ${L} with the +v (top) side in compression; ${nf(wg.b1, 'L')} ${L} with the −v (bottom) side in compression` });
    if (isNum(wg.b2)) calc(body, { title: 'About the minor principal axis 2 (for reference)', ref: 'same definition', lines: [TX`\beta_y=\frac{1}{I_2}\int_A u\,(u^2+v^2)\,dA-2u_o=\frac{${nt(wg.int2 * uf('I') * uf('L'), 'n')}}{${nt(wg.I2, 'I')}}-2\times${nt(wg.uo, 'L')}=${nt(wg.b2, 'L')}\ \text{${L}}\ (+u\ \text{in tension})`], result: '' });
    body.appendChild(el('div', 'hint', 'Sign convention: v is measured positive toward the <b>tension</b> side (as y in Trahair &amp; Bradford, where y points down for a top flange in compression), so β<sub>x</sub> &gt; 0 when the larger flange is in compression and β<sub>x</sub> = 0 for doubly symmetric sections. The area integral is exact (polygons and circles, n-weighted, plate model, about the centroid and principal axes of that geometry); v<sub>o</sub> is the thin-wall shear centre. Approximation for monosymmetric I-sections: β<sub>x</sub> ≈ 0.9h(2ρ − 1)(1 − (I<sub>y</sub>/I<sub>x</sub>)²), ρ = I<sub>yc</sub>/I<sub>y</sub> (Kitipornchai &amp; Trahair). AISC 360 does not use β<sub>x</sub> (F4 uses I<sub>yc</sub>/I<sub>y</sub>). EN 1993 (z<sub>j</sub>) and AS 4100 use related quantities with their own sign conventions — verify before use.'));
  });
  mkSec(pg, 'cKern', 'Kern (core)', body => {
    const K = ext('kern'); if (!K || !K.ok) { body.appendChild(el('div', 'note', 'n/a')); return; }
    const v = K.V[0];
    calc(body, { title: 'Kern vertex for each edge of the convex hull', ref: 'no-tension condition: σ = 0 along the hull edge', lines: [
      TX`\sigma(\mathbf{p})=N\left(\frac{1}{A}+\mathbf{p}^{T}\mathbf{J}^{-1}\mathbf{e}\right),\quad \mathbf{J}=\begin{bmatrix}I_y&I_{xy}\\I_{xy}&I_x\end{bmatrix}`,
      TX`\sigma=0\ \text{on}\ \mathbf{n}\cdot\mathbf{p}=d\ \Rightarrow\ \mathbf{e}=-\frac{\mathbf{J}\,\mathbf{n}}{A\,d}`,
      TX`\text{vertex 1: }\mathbf{n}=(${nf(v.n[0], 'n', 4)},\ ${nf(v.n[1], 'n', 4)}),\ d=${nt(v.d, 'L')}\ \Rightarrow\ \mathbf{e}=(${nt(v.e[0], 'L')},\ ${nt(v.e[1], 'L')})\ \text{${L}}`],
      result: `${K.V.length} kern vertices (Properties tab); p, e measured from the centroid; n = outward unit normal of the hull edge, d its distance from the centroid` });
    body.appendChild(el('div', 'hint', 'Check: rectangle b × h → kern rhombus with half-diagonals b/6 and h/6; solid circle radius r → circle of radius r/4 (Validation tab). Round parts enter the hull as circumscribed 720-gons (kern vertices on the exact curve).'));
  });
  mkSec(pg, 'cEll', 'Central ellipse of inertia (Culmann)', body => {
    calc(body, { title: 'Semi-axes', ref: 'central ellipse of inertia', lines: [
      TX`r_1=\sqrt{I_1/A}=${nt(R.r1, 'L')}\ \text{${L}}\ (\text{measured along axis 2}),\qquad r_2=\sqrt{I_2/A}=${nt(R.r2, 'L')}\ \text{${L}}\ (\text{along axis 1})`],
      result: 'The radius of gyration about any centroidal axis equals the distance from the centroid to the tangent of the ellipse parallel to that axis. Toggle "Inertia ellipse" in Settings → Drawing.' });
  });
}

/* ---- Stresses tab ---- */
const DIV = [[-1, [33, 102, 172]], [-0.5, [103, 169, 207]], [0, [242, 242, 242]], [0.5, [239, 138, 98]], [1, [178, 24, 43]]];
function divCol(t) { t = Math.max(-1, Math.min(1, isNum(t) ? t : 0)); let i = 0; while (i < DIV.length - 2 && t > DIV[i + 1][0]) i++; const [a, ca] = DIV[i], [b, cb] = DIV[i + 1], f = (t - a) / (b - a); return 'rgb(' + ca.map((c, k) => Math.round(c + f * (cb[k] - c))).join(',') + ')'; }
function signSketch() {
  return `<svg viewBox="0 0 230 150" width="230" height="150" role="img" aria-label="Sign convention" style="flex:0 0 auto;background:#FCFDFE;border:1px solid var(--line);border-radius:4px">
  <rect x="85" y="30" width="60" height="84" fill="#9FB3C8" fill-opacity=".55" stroke="#33475E"/>
  <path d="M115 72h24m-6 -4l6 4l-6 4" stroke="#C0392B" stroke-width="1.6" fill="none"/><text x="129" y="86" font-size="11" fill="#C0392B">x</text>
  <path d="M115 72v-30m-4 6l4 -6l4 6" stroke="#1E8449" stroke-width="1.6" fill="none"/><text x="119" y="47" font-size="11" fill="#1E8449">y</text>
  <text x="115" y="23" font-size="9" text-anchor="middle" fill="#2166AC">C (M<tspan font-size="7" dy="2">x</tspan><tspan dy="-2">&gt;0)</tspan></text><text x="115" y="126" font-size="9" text-anchor="middle" fill="#B2182B">T (M<tspan font-size="7" dy="2">x</tspan><tspan dy="-2">&gt;0)</tspan></text>
  <text x="150" y="75" font-size="9" fill="#2166AC">C (M<tspan font-size="7" dy="2">y</tspan><tspan dy="-2">&gt;0)</tspan></text><text x="80" y="75" font-size="9" text-anchor="end" fill="#B2182B">T (M<tspan font-size="7" dy="2">y</tspan><tspan dy="-2">&gt;0)</tspan></text>
  <circle cx="115" cy="72" r="3" fill="#0F172A"/><text x="4" y="145" font-size="9" fill="#334155">P &gt; 0 tension · C = compression, T = tension</text></svg>`;
}
function stressSVG(S, W, H) {
  const b = R.bbox, pad = 34, leg = 46, s = Math.min((W - 2 * pad) / Math.max(b[2] - b[0], 1e-9), (H - 2 * pad - leg) / Math.max(b[3] - b[1], 1e-9));
  const V = { s, ox: W / 2 - s * (b[0] + b[2]) / 2, oy: (H - leg) / 2 + s * (b[1] + b[3]) / 2 }, tr = p => [V.ox + V.s * p[0], V.oy - V.s * p[1]];
  VIEW_T = V;
  const mA = Math.max(Math.abs(S.max ? S.max.s : 0), Math.abs(S.min ? S.min.s : 0), 1e-300);
  const o = [`<svg class="stressSvg" viewBox="0 0 ${W} ${H}" width="100%" style="max-width:${W}px;display:block;background:#FCFDFE;border:1px solid var(--line);border-radius:4px" role="img" aria-label="Normal stress over the section">`, '<defs>'];
  const gn = Math.hypot(S.kx, S.ky), u = gn > 0 ? [S.kx / gn, S.ky / gn] : [1, 0];
  // projection range of the whole section along the stress gradient
  const cs = [[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]]].map(p => p[0] * u[0] + p[1] * u[1]), t0 = Math.min(...cs), t1 = Math.max(...cs);
  const pA = [u[0] * t0, u[1] * t0], pB = [u[0] * t1, u[1] * t1];
  const fill = {};
  R.parts.forEach((q, i) => {
    if (q.pt.hole) return;
    if (gn === 0) { fill[q.pt.id] = divCol(q.n * S.s0 / mA); return; }
    const a = tr(pA), c = tr(pB), stops = [];
    for (let k = 0; k <= 20; k++) { const f = k / 20, p = [pA[0] + f * (pB[0] - pA[0]), pA[1] + f * (pB[1] - pA[1])]; stops.push(`<stop offset="${f}" stop-color="${divCol(q.n * S.sig(p) / mA)}"/>`); }
    o.push(`<linearGradient id="sg${i}" gradientUnits="userSpaceOnUse" x1="${fx(a[0])}" y1="${fx(a[1])}" x2="${fx(c[0])}" y2="${fx(c[1])}">${stops.join('')}</linearGradient>`);
    fill[q.pt.id] = `url(#sg${i})`;
  });
  o.push('</defs>');
  const order = R.parts.filter(q => !q.pt.hole).concat(R.parts.filter(q => q.pt.hole));
  order.forEach(q => {
    const d = q.G.prims.map(pr => primPath(pr, tr)).join('');
    const sr = S.parts.find(r => r.id === q.pt.id);
    const tip = sr ? `${q.pt.lbl}: max ${nf(sr.hi.s, 'sig')} ${un('sig')}, min ${nf(sr.lo.s, 'sig')} ${un('sig')}${q.n !== 1 ? ' (n = ' + (+q.n.toPrecision(4)) + ')' : ''}` : q.pt.lbl + ' (hole)';
    if (q.pt.hole) o.push(`<path d="${d}" fill="#FFFFFF" fill-rule="evenodd" stroke="#C0392B" stroke-width="1.2" stroke-dasharray="5 3"><title>${esc(tip)}</title></path>`);
    else o.push(`<path d="${d}" fill="${fill[q.pt.id]}" fill-rule="evenodd" stroke="#33475E" stroke-width="1"><title>${esc(tip)}</title></path>`);
  });
  // neutral axis, clipped to the drawing box
  if (S.na) {
    const big = 4 * Math.max(b[2] - b[0], b[3] - b[1], 1e-9), p = S.na.p, t = S.na.t;
    const a = tr([p[0] - big * t[0], p[1] - big * t[1]]), c = tr([p[0] + big * t[0], p[1] + big * t[1]]);
    o.push(`<clipPath id="naClip"><rect x="4" y="4" width="${W - 8}" height="${H - leg - 4}"/></clipPath>`);
    o.push(`<path d="M${fx(a[0])} ${fx(a[1])}L${fx(c[0])} ${fx(c[1])}" stroke="#0F172A" stroke-width="1.4" stroke-dasharray="8 4" clip-path="url(#naClip)"/>`);
    // label where the NA crosses the section box
    const m = tr(p), lx = Math.max(30, Math.min(W - 60, m[0])), ly = Math.max(16, Math.min(H - leg - 10, m[1]));
    o.push(`<text x="${fx(lx + 6)}" y="${fx(ly - 6)}" font-size="10" fill="#0F172A" stroke="#fff" stroke-width="3" paint-order="stroke">N.A.</text>`);
  }
  // centroid
  const C = tr([R.cx, R.cy]); o.push(`<circle cx="${fx(C[0])}" cy="${fx(C[1])}" r="4" fill="#fff" stroke="#0F172A" stroke-width="1.3"/>`);
  const mark = (e, lab, col) => { if (!e) return; const p = tr(e.p); o.push(`<circle cx="${fx(p[0])}" cy="${fx(p[1])}" r="6" fill="none" stroke="${col}" stroke-width="2.2"/><circle cx="${fx(p[0])}" cy="${fx(p[1])}" r="2" fill="${col}"/>`); const right = p[0] < W / 2; o.push(`<text x="${fx(p[0] + (right ? 10 : -10))}" y="${fx(Math.max(12, p[1] - 8))}" font-size="10.5" font-weight="600" text-anchor="${right ? 'start' : 'end'}" fill="#0F172A" stroke="#fff" stroke-width="3.5" paint-order="stroke">${lab} ${esc(nf(e.s, 'sig', 4))} ${esc(un('sig'))}</text>`); };
  if (S.max && S.max.s > 0) mark(S.max, 'max tension', '#B2182B');
  if (S.min && S.min.s < 0) mark(S.min, 'max compression', '#2166AC');
  // legend
  const lx0 = 40, lx1 = W - 40, ly = H - 30, st = [];
  for (let k = 0; k <= 20; k++) st.push(`<stop offset="${k / 20}" stop-color="${divCol(-1 + 2 * k / 20)}"/>`);
  o.push(`<defs><linearGradient id="sgLeg" x1="0" x2="1" y1="0" y2="0">${st.join('')}</linearGradient></defs><rect x="${lx0}" y="${ly}" width="${lx1 - lx0}" height="10" fill="url(#sgLeg)" stroke="#94A3B8" stroke-width=".6"/>`);
  [[-1, lx0, 'start'], [0, (lx0 + lx1) / 2, 'middle'], [1, lx1, 'end']].forEach(([v, x, an]) => o.push(`<text x="${fx(x)}" y="${ly + 22}" font-size="10" text-anchor="${an}" fill="#334155">${esc((v > 0 ? '+' : '') + nf(v * mA, 'sig', 4))} ${esc(un('sig'))}</text>`));
  o.push(`<text x="${lx0}" y="${ly - 4}" font-size="9.5" fill="#2166AC">compression</text><text x="${lx1}" y="${ly - 4}" font-size="9.5" text-anchor="end" fill="#B2182B">tension</text>`);
  o.push('</svg>');
  VIEW_T = VIEW;
  return o.join('');
}
function buildStress(pg) {
  const s = stressIn();
  mkSec(pg, 'sIn', 'Loads (at the centroid; moments about the centroidal x and y axes)', body => {
    const wrap = el('div'); wrap.style.cssText = 'display:flex;gap:14px;flex-wrap:wrap;align-items:flex-start';
    const f = el('div'); f.style.cssText = 'flex:1 1 260px;min-width:0';
    fRow(f, 'Axial force P (tension +)', numIn(() => stressIn().P, v => setStress('P', v), 'st_P', { k: 'F' }), un('F'));
    fRow(f, 'Moment M<sub>x</sub> (+ compresses the +y side)', numIn(() => stressIn().Mx, v => setStress('Mx', v), 'st_Mx', { k: 'Mo' }), un('Mo'));
    fRow(f, 'Moment M<sub>y</sub> (+ compresses the +x side)', numIn(() => stressIn().My, v => setStress('My', v), 'st_My', { k: 'Mo' }), un('Mo'));
    f.appendChild(el('div', 'hint', 'Service or factored loads as you choose — no design check is made. Saved with the project.'));
    wrap.appendChild(f); const sk = el('div'); sk.innerHTML = signSketch(); wrap.appendChild(sk); body.appendChild(wrap);
  });
  if (!stressOn()) { pg.appendChild(el('div', 'note', 'Enter P, M<sub>x</sub> or M<sub>y</sub> to plot the normal stress over the section.')); return; }
  const S = SPC.stress(R, s.P, s.Mx, s.My);
  mkSec(pg, 'sPlot', 'Normal stress σ over the section', body => {
    const d = el('div'); const nar = window.innerWidth < 600 && !$('printReport'); d.innerHTML = stressSVG(S, nar ? 380 : 720, nar ? 400 : 440); body.appendChild(d);   // narrow screens: smaller drawing box, so the text stays legible
    body.appendChild(el('div', 'hint', 'Colour: σ from blue (compression) through grey (0) to red (tension), symmetric scale. Dashed: neutral axis (σ = 0). Hover a part for its extreme stresses.' + (R.anyN ? ' Transformed section: part i shows n<sub>i</sub> × the transformed-section stress, so the colour can jump at a material boundary; the neutral axis is common.' : '')));
  });
  mkSec(pg, 'sCalc', 'Stress formula (unsymmetric bending)', body => {
    const nax = S.na ? (S.na.ang * 180 / Math.PI) : null, na2 = isNum(nax) ? ((nax % 180) + 180) % 180 : null;
    calc(body, { title: 'Normal stress at a point (x, y measured from the centroid)', ref: 'general flexure formula, unsymmetric bending (e.g. Boresi & Schmidt, Advanced Mechanics of Materials)', lines: [
      TX`\sigma=\frac{P}{A}-\frac{\left(M_xI_y-M_yI_{xy}\right)y+\left(M_yI_x-M_xI_{xy}\right)x}{I_xI_y-I_{xy}^2}`,
      TX`\frac{P}{A}=\frac{${nt(S.P, 'F')}}{${nt(R.A, 'A')}}=${nt(S.s0, 'sig')}\ \text{${un('sig')}},\qquad I_xI_y-I_{xy}^2=${nt(S.D * uf('I'), 'I')}\ \text{${unitSys() === 'mm' ? 'mm⁸' : 'in⁸'}}`,
      TX`\sigma=${nt(S.s0, 'sig')}${S.kx >= 0 ? '+' : '-'}${nt(Math.abs(S.kx) * uf('sig') / uf('L'), 'n')}\,x${S.ky >= 0 ? '+' : '-'}${nt(Math.abs(S.ky) * uf('sig') / uf('L'), 'n')}\,y\quad(\sigma\ \text{in ${un('sig')}},\ x,y\ \text{in ${un('L')} from the centroid})`],
      result: `Max tension ${S.max && S.max.s > 0 ? nu(S.max.s, 'sig') + ' (' + S.max.lbl + ')' : 'none'}; max compression ${S.min && S.min.s < 0 ? nu(S.min.s, 'sig') + ' (' + S.min.lbl + ')' : 'none'}` + (isNum(na2) ? `; neutral axis at ${na2.toFixed(3)}° from +x` : '') });
    body.appendChild(el('div', 'hint', 'Sign convention: P &gt; 0 tension; M<sub>x</sub> &gt; 0 compresses the +y side and M<sub>y</sub> &gt; 0 compresses the +x side (M<sub>x</sub> = −∫σy dA, M<sub>y</sub> = −∫σx dA). σ &gt; 0 tension. With I<sub>xy</sub> ≠ 0 (e.g. an angle) the neutral axis is not parallel to the moment axis. ' + (R.anyN ? '<b>Transformed section:</b> σ in part i = n<sub>i</sub> × the transformed-section stress above. ' : '') + (R.anyTab ? 'A, I include the AISC tabulated values where selected; the extreme points are on the plate model. ' : '') + 'Elastic, plane sections; no local effects, shear lag or residual stresses.'));
  });
  mkSec(pg, 'sTab', 'Stress at each part\'s extreme points', body => {
    const pt = e => e ? `(${nf(e.p[0], 'L', 4)}, ${nf(e.p[1], 'L', 4)})` : '';
    const rows = S.parts.map(r => [r.lbl, String(+r.n.toPrecision(4)), nf(r.hi.s, 'sig'), pt(r.hi), nf(r.lo.s, 'sig'), pt(r.lo)]);
    if (S.max) rows.push({ cls: 'gov', cells: [{ h: '<b>Section</b>' }, '', { h: '<b>' + nf(S.max.s, 'sig') + '</b>' }, S.max.lbl + ' ' + pt(S.max), { h: '<b>' + nf(S.min.s, 'sig') + '</b>' }, S.min.lbl + ' ' + pt(S.min)] });
    body.appendChild(tblEl(['Part', 'n', 'σ max (' + un('sig') + ')', 'at (x, y) ' + un('L'), 'σ min (' + un('sig') + ')', 'at (x, y) ' + un('L')], rows, { left: [0, 3, 5] }));
    body.appendChild(el('div', 'hint', 'Extreme points: polygon vertices; round parts: the two points where the stress gradient is normal to the circle. Coordinates from the origin.'));
  });
}
```

New Validation checks, inserted after the last Phase 1 check (anchor `add(g, 'Cw = (tf + tp)·bf³·h_o′²/24'`):

```js
    // ---- Phase 2a ----
    const addAbs = (grp, what, tool, tolAbs, src, unit) => out.push({ grp, what, tool, ref: 0, tol: tolAbs, d: Math.abs(tool), ok: isNum(tool) && Math.abs(tool) <= tolAbs, src, unit: unit || '', abs: true });
    // 10 weight
    { const g = '10. Weight per length (P2a)', Rr = SPC.analyze(vModel([{ type: 'plate', p: { b: 6, t: 10 }, x: 3, y: 5 }])), Ra = SPC.analyze(vModel([{ type: 'plate', p: { b: 6, t: 10 }, x: 3, y: 5, rho: 169 }]));
      add(g, 'rectangle 6 × 10 in, steel 490 lb/ft³: w = 60 × 490/144 = 204.17 lb/ft', SPC.weight(Rr).w, 60 * 490 / 144, tight, 'hand calc', 'lb/ft');
      add(g, 'same, aluminum 169 lb/ft³: w = 60 × 169/144', SPC.weight(Ra).w, 60 * 169 / 144, tight, 'hand calc', 'lb/ft');
      const Rh = SPC.analyze(vModel([{ type: 'plate', p: { b: 10, t: 10 }, x: 0, y: 0, rho: 150, n: 0.125 }, { type: 'round', p: { d: 2 }, x: 2, y: 0, hole: true, n: 0.125 }]));
      add(g, '10 × 10 concrete (150 lb/ft³, n = 1/8) with a 2 in hole: w = (100 − π)·150/144 (n not applied; hole at the host density)', SPC.weight(Rh).w, (100 - Math.PI) * 150 / 144, tight, 'hand calc', 'lb/ft');
      const w = SPC.shapeRec('W', 'W14X90'), Rt = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'W', name: 'W14X90' }, x: 0, y: 0, useTab: true }]));
      add(g, 'W14X90 with the AISC tabulated A = 26.5 in²: 26.5 × 490/144 = 90.17 vs nominal 90 lb/ft', SPC.weight(Rt).w, w.Wt, 0.005, 'AISC v16.0 (nominal weight)', 'lb/ft'); }
    // 11 coating perimeters
    { const g = '11. Coating (paint) perimeter (P2a)', B = 10, H = 6, tf = 0.5, tw = 0.375, R4 = SPC.analyze(vModel(SPC.TEMPLATES.box.f({ bf: B, tf, h: H - 2 * tf, tw, bw: B }))), C4 = SPC.coating(R4, 0.001);
      add(g, 'box from 4 plates 10 × 6 (tf 1/2, tw 3/8): outside = 2(10 + 6) = 32 in', C4.outside, 32, tight, 'hand calc', 'in');
      add(g, 'same: exposed = 32 + inside 2[(10 − 0.75) + (6 − 1)] = 60.5 in (faying faces excluded)', C4.exposed, 60.5, tight, 'hand calc', 'in');
      const w = SPC.shapeRec('W', 'W14X90'), Rw = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'W', name: 'W14X90' }, x: 0, y: 0, rot: 30 }]));
      add(g, 'W14X90 plate model (rotated 30°): 4bf + 2d − 2tw = 85.12 in', SPC.coating(Rw, 0.001).exposed, 4 * w.bf + 2 * w.d - 2 * w.tw, tight, 'hand calc', 'in');
      const Rt = SPC.analyze(vModel([{ type: 'tube', p: { D: 10, t: 0.5 }, x: 0, y: 0 }])), Ct = SPC.coating(Rt, 0.001);
      add(g, 'round tube 10 × 1/2: exposed = π(10 + 9) (arcs exact)', Ct.exposed, Math.PI * 19, tight, 'closed form', 'in'); add(g, 'round tube: outside = 10π', Ct.outside, 10 * Math.PI, tight, 'closed form', 'in');
      const Rp = SPC.analyze(vModel([{ type: 'plate', p: { b: 10, t: 10 }, x: 0, y: 0 }, { type: 'round', p: { d: 2 }, x: 2, y: 0, hole: true }, { type: 'round', p: { d: 4 }, x: 0, y: 7 }]));
      add(g, '10 × 10 plate with a 2 in hole and a Ø4 bar standing on it (tangent): exposed = 40 + 2π + 4π', SPC.coating(Rp, 0.001).exposed, 40 + 6 * Math.PI, tight, 'closed form', 'in'); }
    // 12 r̄o, H, rts
    { const g = '12. AISC 360-16 E4 / F2 parameters (P2a)', c = SPC.shapeRec('C', 'C15X50'), Rc = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'C', name: 'C15X50' }, x: 0, y: 0 }])), bc = SPC.buckling(Rc);
      add(g, 'C15X50 r̄o vs AISC 5.49 (plate model, thin-wall shear centre)', bc.ro, c.ro, 0.01, 'AISC v16.0', 'in'); add(g, 'C15X50 H vs AISC 0.937', bc.H, c.Hc, 0.01, 'AISC v16.0', '');
      const xo = Rc.tors.xo, ro2 = xo * xo + (Rc.Ix + Rc.Iy) / Rc.A; add(g, 'C15X50 H = 1 − x_o²/r̄o² (y_o = 0), from the tool\'s x_o, I, A', bc.H, 1 - xo * xo / ro2, tight, 'Eq. E4-8 form', '');
      const w = SPC.shapeRec('W', 'W14X90'), Rw = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'W', name: 'W14X90' }, x: 0, y: 0 }])), bw = SPC.buckling(Rw);
      add(g, 'W14X90: H = 1 (shear centre at the centroid)', bw.H, 1, tight, 'doubly symmetric', '');
      add(g, 'W14X90 r_ts vs hand √(√(Iy·Cw)/Sx), plate model', bw.rts, Math.sqrt(Math.sqrt(Rw.Iy * Rw.tors.Cw) / (Rw.Ix / (w.d / 2))), tight, 'Eq. F2-7', 'in');
      add(g, 'W14X90 r_ts vs AISC 4.10', bw.rts, w.rts, 0.02, 'AISC v16.0', 'in'); add(g, 'W14X90 h_o = d − tf vs AISC 13.3', bw.h0, w.ho, 0.002, 'AISC v16.0', 'in'); }
    // 13 Wagner
    { const g = '13. Wagner monosymmetry constant β_x (P2a)';
      const Rw = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'W', name: 'W14X90' }, x: 0, y: 0, rot: 30 }]));
      addAbs(g, 'W14X90 (rotated 30°): β_x = 0 (doubly symmetric)', SPC.buckling(Rw).wag.b1, 1e-9, 'symmetry', 'in');
      const bt = 12, tt = 1, bb = 6, tb = 1, hw = 20, tw = 0.5, rect = [[bt, tt, hw / 2 + tt / 2], [tw, hw, 0], [bb, tb, -hw / 2 - tb / 2]];
      const Rm = SPC.analyze(vModel(rect.map(([b, h, y]) => ({ type: 'plate', p: { b, t: h }, x: 0, y }))));
      let A = 0, Sy = 0; rect.forEach(([b, h, y]) => { A += b * h; Sy += b * h * y; }); const yc = Sy / A; let Ix = 0, Iy = 0, I3 = 0;
      rect.forEach(([b, h, y]) => { const v = y - yc; Ix += b * h ** 3 / 12 + b * h * v * v; Iy += h * b ** 3 / 12; I3 += v * h * b ** 3 / 12 + b * h * (v ** 3 + v * h * h / 4); });
      const I1f = tt * bt ** 3 / 12, I2f = tb * bb ** 3 / 12, hh = hw + tt / 2 + tb / 2, yo = (hw / 2 + tt / 2) - hh * I2f / (I1f + I2f) - yc, bx = -(I3 / Ix - 2 * yo);
      add(g, 'I: top flange 12 × 1, web 20 × 1/2, bottom flange 6 × 1, top in compression: β_x = −[∫y(x² + y²)dA/Ix − 2y_o] (rectangles by hand, y_o from y_sc = h·I_2/(I_1 + I_2) below the top flange)', -SPC.buckling(Rm).wag.b1, bx, tight, 'hand calc', 'in');
      const rho = I1f / (I1f + I2f); add(g, 'same vs Kitipornchai–Trahair approximation 0.9h(2ρ − 1)(1 − (Iy/Ix)²) (an approximation: 5 %)', -SPC.buckling(Rm).wag.b1, 0.9 * hh * (2 * rho - 1) * (1 - (Iy / Ix) ** 2), 0.05, 'Kitipornchai & Trahair (1980)', 'in');
      const tr2 = [[8, 1, 8.5], [0.5, 8, 4]], Rt = SPC.analyze(vModel(tr2.map(([b, h, y]) => ({ type: 'plate', p: { b, t: h }, x: 0, y }))));
      let A2 = 0, S2 = 0; tr2.forEach(([b, h, y]) => { A2 += b * h; S2 += b * h * y; }); const y2 = S2 / A2; let Ix2 = 0, J3 = 0; tr2.forEach(([b, h, y]) => { const v = y - y2; Ix2 += b * h ** 3 / 12 + b * h * v * v; J3 += v * h * b ** 3 / 12 + b * h * (v ** 3 + v * h * h / 4); });
      add(g, 'T: flange 8 × 1 on stem 1/2 × 8, flange in compression (shear centre at the centre-line junction, y = 8.5)', -SPC.buckling(Rt).wag.b1, -(J3 / Ix2 - 2 * (8.5 - y2)), tight, 'hand calc', 'in'); }
    // 14 stress
    { const g = '14. Normal stress (P2a)', Rr = SPC.analyze(vModel([{ type: 'plate', p: { b: 6, t: 10 }, x: 3, y: 5 }])), S = SPC.stress(Rr, 30, 600, 240);
      add(g, 'rectangle 6 × 10, P = 30 kip, Mx = 50 kip-ft, My = 20 kip-ft: corner (6, 10): 0.5 − 600·5/500 − 240·3/180 = −9.5 ksi', S.sig([6, 10]), -9.5, tight, 'hand calc', 'ksi');
      add(g, 'same: max tension at (0, 0) = 0.5 + 6 + 4 = 10.5 ksi', S.max.s, 10.5, tight, 'hand calc', 'ksi'); add(g, 'same: max compression = −9.5 ksi', S.min.s, -9.5, tight, 'hand calc', 'ksi');
      const Ra = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'L', name: 'L6X4X1/2' }, x: 0, y: 0 }])), Sa = SPC.stress(Ra, 0, 120, 0);
      add(g, 'L6X4X1/2, Mx only: neutral axis slope tan α = Ixy/Iy (rotated, not horizontal)', Math.tan(Sa.na.ang), Ra.Ixy / Ra.Iy, 1e-9, 'unsymmetric bending', '');
      add(g, 'same: −∫σ·y dA = Mx (resultant check)', -(Sa.kx * Ra.Ixy + Sa.ky * Ra.Ix), 120, tight, 'equilibrium', 'kip-in');
      addAbs(g, 'same: −∫σ·x dA = My = 0 (resultant check)', -(Sa.kx * Ra.Iy + Sa.ky * Ra.Ixy), 1e-9, 'equilibrium', 'kip-in'); }
    // 15 kern
    { const g = '15. Kern (P2a)', Rr = SPC.analyze(vModel([{ type: 'plate', p: { b: 6, t: 10 }, x: 3, y: 5 }])), K = SPC.kern(Rr);
      add(g, 'rectangle 6 × 10: kern half-width b/6 = 1', K.ext[2], 1, tight, 'closed form', 'in'); add(g, 'rectangle: kern half-height h/6 = 1.667', K.ext[3], 10 / 6, tight, 'closed form', 'in'); add(g, 'rectangle: 4 kern vertices (rhombus)', K.V.length, 4, 0, 'closed form', '');
      const Rc = SPC.analyze(vModel([{ type: 'round', p: { d: 8 }, x: 1, y: 2 }])), Kc = SPC.kern(Rc), dm = Kc.V.map(v => Math.hypot(v.e[0], v.e[1]));
      add(g, 'solid circle r = 4: kern radius r/4 = 1 (largest vertex distance)', Math.max(...dm), 1, tight, 'closed form', 'in'); add(g, 'solid circle: kern radius r/4 = 1 (smallest vertex distance)', Math.min(...dm), 1, tight, 'closed form', 'in'); }
    // 16 Mohr
    { const g = '16. Mohr\'s circle (P2a)', Ra = SPC.analyze(vModel([{ type: 'shape', p: { fam: 'L', name: 'L6X4X1/2' }, x: 0, y: 0, rot: 20 }])), c = (Ra.Ix + Ra.Iy) / 2, Rm = Math.hypot((Ra.Ix - Ra.Iy) / 2, Ra.Ixy), a2 = Math.atan2(Ra.Ixy, (Ra.Ix - Ra.Iy) / 2);
      add(g, 'L6X4X1/2 at 20°: I1 + I2 = Ix + Iy', Ra.I1 + Ra.I2, Ra.Ix + Ra.Iy, tight, 'invariant', 'in⁴'); add(g, 'I1·I2 = Ix·Iy − Ixy²', Ra.I1 * Ra.I2, Ra.Ix * Ra.Iy - Ra.Ixy * Ra.Ixy, tight, 'invariant', 'in⁸');
      add(g, 'point X turned by 2θp on the circle reaches I1: c + R cos(2α + 2θp)', c + Rm * Math.cos(a2 + 2 * Ra.thp), Ra.I1, tight, 'Mohr\'s circle', 'in⁴');
      addAbs(g, 'and its product of inertia is 0: sin(2α + 2θp)', Math.sin(a2 + 2 * Ra.thp), 1e-12, 'Mohr\'s circle', ''); }
```

Other edits (unified diff, 1 line of context):

```diff
@@ -2933,3 +3190,3 @@ const SPC = (function () {
 
-  return { FAMS, FAM_ORDER, TYPES, shapeRec, shapeNames, dblAngle, partGeom, partGlobal, xfMat, apply, polyM, circM, primM, primsMoments, analyze, qcut, principal, Jrect, labelPrefix, fmtDim, TEMPLATES, rotTensor, plastic, sideSum, chordLen, pairKey, sectorial, partProps, triangulate, overlapArea, polyDist, primPoly, selfIntersects, ptInPoly, NOV };
+  return { FAMS, FAM_ORDER, TYPES, shapeRec, shapeNames, dblAngle, partGeom, partGlobal, xfMat, apply, polyM, circM, primM, primsMoments, analyze, qcut, principal, Jrect, labelPrefix, fmtDim, TEMPLATES, rotTensor, plastic, sideSum, chordLen, pairKey, sectorial, partProps, triangulate, overlapArea, polyDist, primPoly, selfIntersects, ptInPoly, NOV, RHO_STEEL, partRho, weight, coating, buckling, wagner, kern, hull, stress, symAbout, polyCubic };
 })();
@@ -3010,3 +3267,7 @@ const UQ = {
   F: { in: [1, 'kip'], mm: [4.4482216152605, 'kN'] }, q: { in: [1, 'kip/in'], mm: [4448.2216152605 / 25.4, 'N/mm'] }, tau: { in: [1, 'ksi'], mm: [6.894757293168, 'MPa'] },
-  deg: { in: [1, '°'], mm: [1, '°'] }, n: { in: [1, ''], mm: [1, ''] }
+  deg: { in: [1, '°'], mm: [1, '°'] }, n: { in: [1, ''], mm: [1, ''] },
+  // Phase 2a: moment (internal kip-in), normal stress, density, weight per length, coating area per length (internal: perimeter in in)
+  Mo: { in: [1 / 12, 'kip-ft'], mm: [0.11298482902761671, 'kN·m'] }, sig: { in: [1, 'ksi'], mm: [6.894757293168, 'MPa'] },
+  rho: { in: [1, 'lb/ft³'], mm: [16.018463373960138, 'kg/m³'] }, wt: { in: [1, 'lb/ft'], mm: [1.4881639435695537, 'kg/m'] },
+  pa: { in: [1 / 12, 'ft²/ft'], mm: [0.0254, 'm²/m'] }
 };
@@ -3182,3 +3443,6 @@ function migrate(d) {
     m.parts.push({ id: typeof p.id === 'string' && p.id ? p.id : newId(), lbl: String(p.lbl || ''), type: p.type, p: (p.p && typeof p.p === 'object') ? JSON.parse(JSON.stringify(p.p)) : {}, x: +p.x || 0, y: +p.y || 0, rot: +p.rot || 0, mir: !!p.mir, n: isNum(p.n) ? p.n : 1, hole: !!p.hole, useTab: !!p.useTab });
+    if (isNum(p.rho) && p.rho > 0) m.parts[m.parts.length - 1].rho = p.rho;   // optional density, lb/ft³ (Phase 2a; absent = steel 490)
   });
+  // optional stress loads (Phase 2a): P kip (tension +), Mx, My kip-in; absent = all 0
+  if (d.stress && typeof d.stress === 'object') m.stress = { P: isNum(d.stress.P) ? d.stress.P : 0, Mx: isNum(d.stress.Mx) ? d.stress.Mx : 0, My: isNum(d.stress.My) ? d.stress.My : 0 };
   // unique ids
@@ -3537,2 +3801,6 @@ function buildPartPane(P) {
     fRow(body, 'Modulus ratio n', numIn(() => pt.n, v => { pt.n = v; }, 'pp_n', { k: 'n', min: 0, geo: true }), '', 'n = E_part / E_ref (transformed section). Use 1 for one material; e.g. a different steel grade does not change n, a concrete slab on steel does.');
+    if (!pt.hole) {
+      fRow(body, 'Density ρ', numIn(() => SPC.partRho(pt), v => { pt.rho = v; }, 'pp_rho', { k: 'rho', min: 0, geo: true }), un('rho'), 'For the weight per length only (Properties → Weight). n does not change the weight.');
+      fRow(body, 'Density preset', selIn(RHO_PRESETS(), () => '', v => { if (v) { pushUndo(); pt.rho = +v; } }, 'pp_rhoP', false), '', 'Typical values — use the actual material density where it matters.');
+    } else body.appendChild(el('div', 'hint', 'A hole removes weight at the density of the solid part it lies in.'));
     if (SPC.TYPES[pt.type].hole) chkRow(body, 'Hole / cut-out (negative area)', chkIn(() => pt.hole, v => { pt.hole = v; }, 'pp_hole', true, true, GD), 'A hole removes area from whatever it covers. Give it the same n as the part it is in.');
@@ -3553,2 +3821,4 @@ function buildPartPane(P) {
 }
+// density presets (typical values, lb/ft³; shown in the display units)
+const RHO_PRESETS = () => [['', 'preset…'], ['490', 'Steel'], ['169', 'Aluminum'], ['150', 'Concrete, normal weight'], ['35', 'Timber (typical softwood)']].map(([v, l]) => [v, v ? l + ' — typical ' + nf(+v, 'rho', 4) + ' ' + un('rho') : l]);
 function polyTable(body, pt) {
@@ -3603,2 +3873,3 @@ function buildMultiPane(P, sp) {
     fRow(body, 'Set n for all', numIn(() => null, v => { if (!(v > 0)) return; sp.forEach(p => { p.n = v; }); }, 'mv_n', { k: 'n', min: 0, blank: true, geo: true, ph: 'n' }), '');
+    fRow(body, 'Set density ρ for all', selIn(RHO_PRESETS(), () => '', v => { if (v) { pushUndo(); sp.forEach(p => { if (!p.hole) p.rho = +v; }); } }, 'mv_rhoP', false), '', 'Weight only (holes take the density of the part they lie in).');
   });
@@ -3664,2 +3935,4 @@ function buildSetPane(P) {
     chkRow(body, 'Shear centre', chkIn(() => S.showSC, v => { S.showSC = v; }, 'set_sc', false));
+    chkRow(body, 'Kern (core)', chkIn(() => S.showKern, v => { S.showKern = v; }, 'set_kern', false));
+    chkRow(body, 'Inertia ellipse (Culmann)', chkIn(() => S.showEllipse, v => { S.showEllipse = v; }, 'set_ell', false), 'Semi-axes r<sub>1</sub> = √(I<sub>1</sub>/A) measured along axis 2 and r<sub>2</sub> = √(I<sub>2</sub>/A) along axis 1.');
     chkRow(body, 'Dimensions on hover', chkIn(() => S.showDims, v => { S.showDims = v; }, 'set_dim', false));
@@ -3841,2 +4114,5 @@ function svgMarkup(W, H, V, opts) {
     o.push(`<g pointer-events="none"><circle cx="${fx(C[0])}" cy="${fx(C[1])}" r="7" fill="#fff" stroke="#0F172A" stroke-width="1.3"/><path d="M${fx(C[0])} ${fx(C[1] - 7)}A7 7 0 0 1 ${fx(C[0] + 7)} ${fx(C[1])}L${fx(C[0])} ${fx(C[1])}Z M${fx(C[0])} ${fx(C[1] + 7)}A7 7 0 0 1 ${fx(C[0] - 7)} ${fx(C[1])}L${fx(C[0])} ${fx(C[1])}Z" fill="#0F172A"/></g>`);
+    // Phase 2a overlays (Settings → Drawing): central ellipse of inertia, kern
+    if (S.showEllipse && R.I2 > 0) { const a = R.r2 * V.s, b2 = R.r1 * V.s, dg = -R.thp * 180 / Math.PI; o.push(`<g pointer-events="none"><ellipse cx="${fx(C[0])}" cy="${fx(C[1])}" rx="${fx(a)}" ry="${fx(b2)}" transform="rotate(${fx(dg)} ${fx(C[0])} ${fx(C[1])})" fill="none" stroke="#0E7490" stroke-width="1.5"/><text x="${fx(C[0] + a * Math.cos(R.thp) + 4)}" y="${fx(C[1] - a * Math.sin(R.thp) - 4)}" font-size="10" fill="#0E7490" stroke="#fff" stroke-width="3" paint-order="stroke">ellipse of inertia</text></g>`); }
+    if (S.showKern) { const K = ext('kern'); if (K && K.ok && K.V.length > 2) { const d = 'M' + K.V.map(v => { const q = tr(v.p); return fx(q[0]) + ' ' + fx(q[1]); }).join('L') + 'Z'; const top = K.V.reduce((m, v) => v.p[1] > m.p[1] ? v : m, K.V[0]), tq = tr(top.p); o.push(`<g pointer-events="none"><path d="${d}" fill="#BE185D" fill-opacity=".14" stroke="#BE185D" stroke-width="1.5"/><text x="${fx(tq[0] + 6)}" y="${fx(tq[1] - 5)}" font-size="10" fill="#BE185D" stroke="#fff" stroke-width="3" paint-order="stroke">kern</text></g>`); } }
     if (S.showSC && R.tors && R.tors.sc) { const P = tr(R.tors.sc); o.push(`<g pointer-events="none"><path d="M${fx(P[0] - 6)} ${fx(P[1] - 6)}l12 12m0 -12l-12 12" stroke="#7C3AED" stroke-width="2"/><text x="${fx(P[0] + 8)}" y="${fx(P[1] - 6)}" font-size="10" fill="#7C3AED" stroke="#fff" stroke-width="3" paint-order="stroke">SC</text></g>`); }
@@ -4489,3 +4765,3 @@ function wireKeys() {
    ===================================================================== */
-const OUT_TABS = [['sec', 'Section'], ['props', 'Properties'], ['calc', 'Calc detail'], ['plas', 'Plastic'], ['tors', 'Torsion'], ['q', 'Q & shear flow'], ['val', 'Validation'], ['man', 'Method']];
+const OUT_TABS = [['sec', 'Section'], ['props', 'Properties'], ['calc', 'Calc detail'], ['plas', 'Plastic'], ['tors', 'Torsion'], ['q', 'Q & shear flow'], ['stress', 'Stresses'], ['val', 'Validation'], ['man', 'Method']];
 function curTab() { const t = M.ui.outTab; return OUT_TABS.some(x => x[0] === t) ? t : 'sec'; }
@@ -4504,3 +4780,3 @@ function buildTabBar() {
 }
-const BUILDERS = () => ({ sec: buildSec, props: buildProps, calc: buildCalc, plas: buildPlas, tors: buildTors, q: buildQ, val: buildValid, man: buildManual });
+const BUILDERS = () => ({ sec: buildSec, props: buildProps, calc: buildCalc, plas: buildPlas, tors: buildTors, q: buildQ, stress: buildStress, val: buildValid, man: buildManual });
 function renderTab(light) {
@@ -4643,2 +4919,3 @@ function buildProps(pg) {
   mkSec(pg, 'pParts', 'Parts', body => body.appendChild(partsTable()));
+  buildPropsP2a(pg);
 }
@@ -4687,2 +4964,3 @@ function buildCalc(pg) {
   });
+  buildCalcP2a(pg);
 }
@@ -4882,3 +5484,3 @@ function buildValid(pg) {
     if (v.grp !== grp) { grp = v.grp; rows.push({ cls: 'gov', cells: [{ h: '<b>' + esc(grp) + '</b>', span: 7 }] }); }
-    rows.push([v.what, g6(v.tool), g6(v.ref), v.unit, isNum(v.d) ? (v.d * 100).toPrecision(3) + ' %' : '—', v.tol >= 1e-6 ? (v.tol * 100) + ' %' : (v.tol === 0 ? 'exact' : '1e-9'), { cls: v.ok ? 'ok' : 'ng', h: v.ok ? 'pass' : 'FAIL' }]);
+    rows.push([v.what, g6(v.tool), g6(v.ref), v.unit, v.abs ? '|Δ| = ' + g6(v.d) : isNum(v.d) ? (v.d * 100).toPrecision(3) + ' %' : '—', v.abs ? '|Δ| ≤ ' + v.tol : v.tol >= 1e-6 ? (v.tol * 100) + ' %' : (v.tol === 0 ? 'exact' : '1e-9'), { cls: v.ok ? 'ok' : 'ng', h: v.ok ? 'pass' : 'FAIL' }]);
   });
@@ -4922,2 +5524,10 @@ function buildManual(pg) {
   UL(['Q = first moment, about the centroidal axis, of the area on one side of a straight cut right across the section (above a horizontal cut, right of a vertical cut). q = V·Q/I for symmetric sections; with I<sub>xy</sub> ≠ 0 the general formula q = V<sub>y</sub>(I<sub>y</sub>Q<sub>x</sub> − I<sub>xy</sub>Q<sub>y</sub>)/(I<sub>x</sub>I<sub>y</sub> − I<sub>xy</sub>²). τ<sub>avg</sub> = q/b with b = material length on the cut.']);
+  H('Weight, coating area, buckling parameters, kern (Phase 2a)');
+  UL(['<b>Weight</b> per length = Σ A<sub>i</sub>·ρ<sub>i</sub> (Properties tab). Density per part (Part properties → Material; default steel 490 lb/ft³; presets aluminum 169, concrete 150, timber 35 lb/ft³ — typical values, editable). The modulus ratio n does not change the weight. Holes remove weight at the density of the solid part they lie in. Parts with "AISC tabulated" use the tabulated A.',
+    '<b>Coating (paint) area</b>: exposed perimeter = all boundary of the union of the material (closed cells and holes included; faces where parts touch within the contact tolerance excluded); outside perimeter = the outer boundary only. Area per length = perimeter × length. Round parts exact; rectangular-tube and HSS corners as the 24 chords the tool uses; rolled shapes as the plate model (no fillets).',
+    '<b>r̄<sub>o</sub>, H</b> (AISC 360-16 Eq. E4-9, E4-8 — equation numbers to be verified against the printed Specification) from the thin-wall shear centre; n/a when the shear centre is n/a. <b>r<sub>ts</sub></b> = √(√(I<sub>y</sub>C<sub>w</sub>)/S<sub>x</sub>) (Eq. F2-7) only when the section is doubly symmetric about its principal axes (detected geometrically: every polygon and circle maps onto one of the same weight under reflection about each principal axis); h<sub>o</sub> for a single rolled I-shape or three plates forming an I.',
+    '<b>Wagner coefficient β<sub>x</sub></b> = (1/I<sub>1</sub>)∫v(u² + v²)dA − 2v<sub>o</sub> about the principal axes (exact polygon and circle integrals; thin-wall shear centre), reported as positive when the larger flange is in compression (v toward the tension side, as Trahair &amp; Bradford). Not used by AISC 360; for AS 4100 / EN 1993 / SSRC methods — verify the sign convention of the method used.',
+    '<b>Kern</b>: one vertex per convex-hull edge, e = −J·n/(A·d) (no stress reversal for an axial force inside it). <b>Mohr\'s circle</b> (Properties tab) with I<sub>xy</sub> plotted upward; <b>central ellipse of inertia</b> with semi-axes r<sub>1</sub> (along axis 2) and r<sub>2</sub> (along axis 1). Kern and ellipse are drawing overlays (Settings → Drawing).']);
+  H('Stresses (Phase 2a)');
+  UL(['Stresses tab: P (tension +) at the centroid, M<sub>x</sub> (+ compresses the +y side) and M<sub>y</sub> (+ compresses the +x side) about the centroidal axes. σ = P/A − [(M<sub>x</sub>I<sub>y</sub> − M<sub>y</sub>I<sub>xy</sub>)y + (M<sub>y</sub>I<sub>x</sub> − M<sub>x</sub>I<sub>xy</sub>)x]/(I<sub>x</sub>I<sub>y</sub> − I<sub>xy</sub>²), x, y from the centroid. Transformed sections: σ in part i = n<sub>i</sub> × the transformed-section stress. Colour plot, neutral axis, maximum tension and compression (polygon vertices; circles at the tangent points of the stress gradient) and a table per part. No design check.']);
   H('Checking with AutoCAD MASSPROP (Export DXF)');
@@ -4929,3 +5539,3 @@ function buildManual(pg) {
   H('Saved data');
-  UL([`<b>Files:</b> Save file writes JSON with <code>_schema: "${SCHEMA}"</code>, <code>version: ${SCHEMA_VER}</code>; dimensions are always stored in inches. Open file refuses another schema or a newer version.`,
+  UL([`<b>Files:</b> Save file writes JSON with <code>_schema: "${SCHEMA}"</code>, <code>version: ${SCHEMA_VER}</code>; dimensions are always stored in inches. Open file refuses another schema or a newer version. Optional fields (Phase 2a, written only once used): a part's density <code>rho</code> (lb/ft³; absent = steel 490), the stress loads <code>stress: {P, Mx, My}</code> (kip, kip-in; absent = 0), and the overlay switches <code>settings.showKern</code>, <code>settings.showEllipse</code>.`,
     `<b>This browser:</b> autosave <code>${LS_AUTO}</code>, named projects <code>${LS_PROJ}</code>, selected input tab <code>${LS_INTAB}</code>, DXF export options <code>${LS_DXF}</code>. All keys start with <code>spc_</code>.`,
@@ -5143,4 +5753,4 @@ const PRINT_CSS = `
 }`;
-const PR_LABELS = { sum: 'Drawing and key properties', parts: 'Parts table', props: 'Properties', calc: 'Calc detail (parallel-axis table)', plas: 'Plastic', tors: 'Torsion', q: 'Q & shear flow', val: 'Validation', man: 'Method and assumptions' };
-const PR_DEFAULT = { sum: true, parts: true, props: true, calc: true, plas: true, tors: true, q: false, val: false, man: true };
+const PR_LABELS = { sum: 'Drawing and key properties', parts: 'Parts table', props: 'Properties', calc: 'Calc detail (parallel-axis table)', plas: 'Plastic', tors: 'Torsion', q: 'Q & shear flow', stress: 'Stresses', val: 'Validation', man: 'Method and assumptions' };
+const PR_DEFAULT = { sum: true, parts: true, props: true, calc: true, plas: true, tors: true, q: false, stress: false, val: false, man: true };
 function openPrintDialog() {
@@ -5202,2 +5812,3 @@ async function buildPrintReport(opts) {
     section('q', 'Q and shear flow', h => buildQ(h));
+    section('stress', 'Stresses', h => buildStress(h));
   }
@@ -5230,3 +5841,3 @@ function spcInit() {
 // test / automation hook (read-only use; not part of the saved data)
-window.SPCUI = { get model() { return M; }, get res() { return R; }, get sel() { return [...SEL]; }, set sel(a) { SEL = new Set(a); SELORD = a.slice(); rebuildInputs(); drawCanvas(); updateToolState(); }, flush, fullRebuild, load: d => loadModel(d), buildPrintReport, runValidation, actFlip, actRotate, actMirrorCopy, actDuplicate, actDelete, actAlign, undo, redo, paste, copySel, partById, fitView, nudge, addSimple, addShape, setNoOverlap, get noOverlap() { return NOOV; }, fixOverlap, get snapMark() { return SNAPMARK; }, focusDims, openDimEditor, get view() { return VIEW; }, w2s, s2w, get undoN() { return UNDO.length; } };
+window.SPCUI = { get model() { return M; }, get res() { return R; }, get sel() { return [...SEL]; }, set sel(a) { SEL = new Set(a); SELORD = a.slice(); rebuildInputs(); drawCanvas(); updateToolState(); }, flush, fullRebuild, load: d => loadModel(d), buildPrintReport, runValidation, actFlip, actRotate, actMirrorCopy, actDuplicate, actDelete, actAlign, undo, redo, paste, copySel, partById, fitView, nudge, addSimple, addShape, setNoOverlap, get noOverlap() { return NOOV; }, fixOverlap, get snapMark() { return SNAPMARK; }, focusDims, openDimEditor, get view() { return VIEW; }, w2s, s2w, get undoN() { return UNDO.length; }, ext, stressRes: () => (R && R.ok ? SPC.stress(R, stressIn().P, stressIn().Mx, stressIn().My) : null) };
 if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', spcInit); else spcInit();
```

#### How verified

- `node --check` of every inline script (4 scripts, 0 errors).
- **Main vs branch** (headless Chromium, KaTeX served locally), default example and all 8 templates, in **and** mm units: identical results (A … Z_2, J, C_w, shear centre, r̄o, warnings), identical text of the Section, Plastic, Torsion and Q tabs, the main text of Properties and Calc detail an exact prefix of the branch text, identical drawing, identical autosaved model. Validation main 60/60, branch 96/96 with the first 60 identical. No console errors.
- **Independent Node cross-checks** (858 checks, 0 failures; no engine formula reused): Wagner integrals ∫v(u² + v²), ∫u(u² + v²), I_1 and β on 60 random sections (1–3 random star polygons, rotation, mirror, n, some with a round bar) vs a Dunavant 7-point triangle quadrature on fan triangulations (polygons 1e-9; with circles drawn as 4000-gons 2e-5); coating perimeters of 120 random sets of 2–8 plates on a 1/4 in grid (touching, overlapping, enclosing cells) vs an exact cell-grid union with flood fill (exposed and outside, 1e-9), and the same sets rotated by a random angle (1e-7); plate with round and rectangular holes plus a separate bar, tangent bars, box cell, HSS (chords); kern of 40 random two-part sections (compression at each kern vertex gives σ ≤ 0 at every hull vertex and σ = 0 on the associated edge, 1e-9); stress resultants ∫σ dA = P, −∫σy dA = M_x, −∫σx dA = M_y on 30 random sections with n = 2 parts (1e-8 of the largest load).
- **Browser tests** (21 checks, 0 failures): density field shows 490 when absent; preset Aluminum → ρ = 169 and the field follows; weight changes by A·Δρ/144; undo removes the density; typed ρ stored; Stresses note with no load; M_x = 50 kip-ft stored as 600 kip-in with focus kept; σ = ∓M_x c/I_x on the default section; autosave holds `stress` and `rho`; print report contains Stresses and Mohr with no KaTeX error; branch round trip keeps the new fields; **main opens the branch file** without alert or console error; no KaTeX errors on Properties / Calc detail / Stresses for the default and 8 templates in in and mm with loads; mm units show kg/m, m²/m, kg/m³, kN·m, MPa.
- Earlier browser suites re-run on this branch: Phase 1 49/49, no-overlap 70/70, dimensions 35/35, live fields 47/47, DXF/extra 13/13; after merging origin/main (incl. R2 hole carry): R2 hole-carry tests 28/28 and all of the above re-run, 0 failures.
- Screenshots looked at (desktop 1500 px and 400 px): Mohr's circle (default, angle), buckling parameters, kern, weight/coating, calc blocks, section with kern and ellipse overlays (default, angle), Stresses tab (inputs and sketch, angle with the rotated neutral axis, formula, table), part density panel. 400 px: no horizontal scroll.
- Performance: the coating perimeter is computed only when Properties / Calc detail are shown; 8 touching HSS10X6X1/2: about 1.2 s (analyze itself 1.6 s); default example a few ms.

#### Open items

- P2a-O1. AISC 360-16 equation numbers E4-8 (H) and E4-9 (r̄o²) and F2-7 (r_ts) as understood — check against the printed Specification (shown with "verify").
- P2a-O2. β_x sign convention (positive with the larger flange in compression; v toward the tension side as Trahair & Bradford) and which value the engineer's design method needs (AS 4100, EN 1993 z_j, SSRC) — confirm.
- P2a-O3. Stress sign convention chosen: M_x > 0 compresses the +y side, M_y > 0 compresses the +x side, P > 0 tension. The brief's formula had M_x positive with tension at +y; confirm the preferred convention.
- P2a-O4. "Paint area in in/ft": reported as the perimeter in in (= in² of surface per in of length) and as ft²/ft. Say if another unit is wanted.
- P2a-O5. Holes are charged at the density of the part they lie in; faces within the contact tolerance (0.001 in) are treated as faying (not painted) — confirm.
- P2a-O6. Weight of rolled shapes uses the plate model (no fillets) unless "AISC tabulated" is ticked (then within about 0.2 % of the nominal weight). Should the nominal tabulated weight be used instead for rolled shapes?
- P2a-O7. r_ts is shown only for doubly symmetric sections (F2); h_o only for a single rolled I or a three-plate I. AISC F2 also covers channels (r_ts with c ≠ 1) — not included.
- P2a-O8. Opening a P2a file in the older main version and re-saving there drops `rho` and `stress` (no error). Acceptable?
