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

- N-O1. Holes inside a moved, rotated or flipped part move with it (otherwise the part could not move without leaving its hole behind). This happens only when Prevent overlap is on. Confirm.
- N-O2. Rotate/flip that would overlap moves the part to the nearest free position, touching, rather than refusing. Confirm.
- N-O3. A hole must lie inside **one** solid part (same rule as the existing warning). A hole straddling two touching plates is refused. Say if that case is needed.

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

- N-O4. Resize handles are offered for plates, bars and rectangular tubes only (not holes, round parts or rolled shapes, whose sizes come from a list or a single diameter).
