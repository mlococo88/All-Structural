# Fix log — shared/barrier.js (window.SharedBarrier)

## 2026-11-24 — PR: claude/shared-barrier-steel (PR #1697: https://github.com/mlococo88/All-Structural/pull/1697) (BARG-1) — new shared file: a barrier's area, weight, width at the deck and centroid from its geometry   [NEW CALCULATION; loaded by apps/steel-bridge/index.html; no existing result changes]
### Request (engineer, 2026-11-24)
"RIDOT has a barrier that is a rectangle shape, not an F-shape barrier. Can I enter the barrier geometry in a new section and let the app calculate the weight directly?" Then: "Use the centroid for the barrier load point. Do this for both the steel and ps apps."
### Where
- New file `shared/barrier.js` (classic script, one namespace `window.SharedBarrier`, no DOM, no state). Functions:
  - `spec(e)`: the input from an app's saved edge object `{ bShape, bDims: { b, h, bt }, bPts: [[x, y]…], bGam }` (blank `bGam`: `GAMMA` = 0.150 kcf).
  - `outline(spec)`: the polygon (in) of a shape: `rect` (0,0) (b,0) (b,h) (0,h); `slope` (sloped face, vertical back) (0,0) (b,0) (b_t,h) (0,h); `poly` the points as entered (a closing point equal to the first dropped).
  - `compute(spec)` → `{ ok, errors: [{ key, msg }], shape, pts, A, As, S, Sx, terms, w, gam, bIn, bDeck, x0In, xcIn, xc, ycIn, h, dims }`; every shape through the same shoelace arithmetic:
    c_i = x_i y_i+1 − x_i+1 y_i, A_s = ½ Σ c_i, A = |A_s|, x̄ = Σ (x_i + x_i+1) c_i / (6 A_s), ȳ likewise; w = A/144 × γ (klf); b_deck = the largest x of the outline's edges on the deck (y = 0), /12 (ft); h = max y.
    Validation: b, b_t, h > 0; γ > 0; polygon ≥ 3 numeric points, x ≥ 0 and y ≥ 0, simple (no repeated consecutive point, no edge folding back on its neighbour, no two non-adjacent edges crossing or touching), a non-zero area, at least one edge on the deck. Messages "the barrier … must …" with the field key (`b`, `bt`, `h`, `pts`, `gam`).
  - `steps(G, { prefix, base, wId, wLabel, wNote, ref })`: the worked steps (shared/steps.js format, read at call time): rect A = bh; slope A = (b + b_t)h/2; poly Σc_i (each c_i in the note), A = ½|Σc_i|, h = max y_i; then w = A/144 γ, b_deck, x̄ (rect b/24, slope (b² + bb_t + b_t²)/(3(b + b_t)·12), poly the shoelace with the terms in the note).
  - `parsePts(text)`, `ptsText(pts)`, `svg(G, o)` (a small sketch, display only).
- No owner (DOT) standard barrier shape or dimension is kept in the file: the shapes are parametric, dimensions entered by the engineer.
### Governing provisions
- AASHTO LRFD 10th Ed. (2024) Art. 3.5.1 and Table 3.5.1-1: normal-weight concrete with f′c ≤ 5.0 ksi, 0.145 kcf; Commentary C3.5.1: the unit weight of reinforced concrete is generally taken as 0.005 kcf greater than plain concrete (the 0.005 is in the commentary, not a note of the table). Default γ = 0.145 + 0.005 = 0.150 kcf, editable.
- Area and centroid: plane geometry (shoelace formula for a simple polygon).
### Check cases (hand, also in tests/engine/barrier.test.mjs)
- Rectangle b = 12 in, h = 42 in, γ = 0.150 kcf: A = 12 × 42 = 504 in²; w = 504/144 × 0.150 = 3.5 × 0.150 = 0.525 klf; b_deck = 12/12 = 1.000 ft; x̄ = 12/2 = 6 in = 0.500 ft.
- Six-point polygon (0,0) (18,0) (18,3) (9,12) (6,42) (0,42) in: c = 0·0 − 18·0 = 0; 18·3 − 18·0 = 54; 18·12 − 9·3 = 189; 9·42 − 6·12 = 306; 6·42 − 0·42 = 252; 0·0 − 0·42 = 0; Σ = 801; A = 400.5 in²; w = 400.5/144 × 0.150 = 0.41719 klf; Σ(x_i + x_i+1)c_i = 36·54 + 27·189 + 15·306 + 6·252 = 1944 + 5103 + 4590 + 1512 = 13 149 in³; x̄ = 13 149/(6 × 400.5) = 5.4719 in = 0.45599 ft; b_deck = 18 in = 1.500 ft; h = 42 in.
- Sloped face b = 15, b_t = 6, h = 42 in: A = (15 + 6)/2 × 42 = 441 in²; x̄ = (225 + 90 + 36)/(3 × 21) = 5.5714 in (= the shoelace of its outline).
### How verified
`node tests/engine/run.mjs barrier` (shared file: hand cases, closed form = shoelace, both point orders, validation, steps); `node tests/check-syntax.mjs`.
### Tools that load it
`apps/steel-bridge/index.html` (engine/loads.js `edgeIn`, ui/loads.js). Tests: `tests/engine/barrier.test.mjs`, `tests/engine/sb-barrier.test.mjs`, smoke `tests/smoke/steel-bridge-barrier.mjs`.
### Decisions (pending engineer review)
- BARG-1a. Points must have x ≥ 0 and y ≥ 0 (the barrier on the deck, inside the deck edge); a barrier part beyond the deck edge or below the top of the deck (a fascia drip, a key) is not accepted. Conservative: no part of a barrier off the deck is assumed.
- BARG-1b. The width at the deck is the deck edge to the inner toe (largest x on y = 0), the "barrier width at deck" the apps already use as the deck edge to the traffic face. For a barrier whose face leans over the roadway beyond its toe, enter "Edge to traffic face".
- BARG-1c. Templates: Rectangle and Sloped face (vertical back) only, plus Custom (polygon); an F-shape or other profile is entered as a polygon.

## 2026-11-24 — PR: claude/ps-barrier-geometry (PR #PRNUM: https://github.com/mlococo88/All-Structural/pull/PRNUM) (BARG-2) — now also loaded by apps/ps-bridge   [the file is unchanged]
### Where
`apps/ps-bridge/index.html` loads `../../shared/barrier.js` (engine/bridge-dl.js, ui/bridgedl.js; fixlog/ps-bridge.md BARG). `shared/barrier.js` itself is not changed in this PR.
### Tools that load it, and their tests (run for this PR)
- Steel Bridge Design (`apps/steel-bridge/index.html`): `tests/engine/barrier.test.mjs`, `tests/engine/sb-barrier.test.mjs`, smoke `tests/smoke/steel-bridge-barrier.mjs`.
- PS Bridge (`apps/ps-bridge/index.html`): `tests/engine/psbridge-barrier.test.mjs`, smoke `tests/smoke/ps-bridge-barrier.mjs`.
