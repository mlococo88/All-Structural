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
