# Fix log — shared/abutment-def.js (window.SharedAbutmentDef)

Loaded by: `Bridge Substructure Loading.html`, `abutment_calculator.html` (see `shared/README.md`). Spec: `HANDOFF.md` §4.5 (definition block)
and §4.15 (abutmentDef). Tests: `node tests/engine/run.mjs abutment-def` (Node).

## 2026-11-11 — PR: claude/abx-a (PR #1405: https://github.com/mlococo88/All-Structural/pull/1405) — created (new file): the abutment definition exchanged by the two tools (ABX, PR A)   [no calculation; storage: new optional fields only]
- **Why:** engineer request (2026-11-11): "The abutment app and substructure loading app should talk with each other more … pull an abutment
  from the abutment app into the substructure loading app and vice versa … make sure they all agree or have the same general input." The
  mapping is used in both directions, so it lives once here (CLAUDE.md §3) with Node tests.
- **What:** classic script, IIFE, one namespace, no DOM, no calculation. `fromSubLoads(x)` (anchor `function fromSubLoads(x)`), `fromLoads(a, p)`
  (older abutmentLoads payloads), `fromAbutment(S, ctx)`, `validate(def)` (geometry errors refuse; a bad optional group is disabled with its
  reason), `checkPayload(p)` (§4.15 envelope: units, conventional type, content hash), `toAbutment(def, ctx)` and `toSubLoads(def, ctx)`
  (items `{ path, val, lbl }` per group), `rows(items, get)` (current vs incoming), `summary(p)`, `hash(def)`. Format in the file header.
- **Governing provision:** none: input mapping only. Mapping relations used (all geometric): heel = W − toe − t_stem (SubLoads) and
  W = toe + t_bot + heel (calculator); stem height = seat − top of footing; backwall height = top of backwall − seat; bearing setback =
  t_top − a_f − t_bw; D_f = ground − bottom of footing; approach-slab share = R_DC / (w_c·t·W·L) × 100.
- **Check case:** SubLoads default Abut. 1: stem H = 117.991 − 108 = 9.991 ft, backwall h = 125 − 117.991 = 7.009 ft, heel = 14 − 4 − 4 = 6 ft,
  D_f = 112 − 105 = 7 ft, setback = 4 − 1.75 − 1.5 = 0.75 ft; round trip SubLoads → calculator (default project, default ticks) → SubLoads
  (default ticks) leaves every SubLoads input as it was (L_ab, L_ftg and soil height stay blank = auto). Calculator slab with a square far end,
  W 44, L 16, L̄ 18 ft: share = 18/32 = 56.25 %.
- **How verified:** `node tests/engine/run.mjs abutment-def` (8 tests).
- **Other copies:** none.

## 2026-11-11 — PR: claude/abx-b (PR #1407: https://github.com/mlococo88/All-Structural/pull/1407) — used by the new abutmentDef channel (ABX, PR B)   [file not changed]
- `fromAbutment`, `checkPayload`, `toSubLoads`, `rows` and `summary` are now called by the calculator's "Send abutment to SubLoads" and SubLoads' "Pull abutment from the Abutment Calculator" (HANDOFF.md §4.15). No change to this file; tests `node tests/engine/run.mjs abutment-def` pass.

## 2026-11-11 — PR: fix/abut-subloads-map (PR #1412: https://github.com/mlococo88/All-Structural/pull/1412) — LS with the approach slab and the seismic earth pressure location mapped both ways; information rows corrected (ABXM)   [mapping only; a pull can now write earth.lsRed / apSlab.lsRed and P.br.hEQmode / hAEr / seismic.hEQmode / hAEr: §4 callout in the PR]
- **Why:** after #1406 (SubLoads removes LS with a slab under AASHTO too), #1409 / #1411 (the same four seismic earth pressure locations in
  both tools) and #1410 (abutment superstructure horizontal forces at the seat in SubLoads) the exchange still sent `info.lsRed: null` and
  a row "removed only under MassDOT", a fixed `seismic.hEQmode: 'ratio'` (SubLoads) / `'static'` for every non-ratio mode (calculator),
  and a row "TU / WS / WL at the top of bearing".
- **Where / before → after:**
  - constants after `const isN =`: new `LOC_SL`, `LOC_AB`, `LOC_TXT`, `locTxt(m, q)`, `locStated(q)` (a definition states the location when it has an `hAEr` key and a known mode).
  - `fromSubLoads`: before `seismic: { …, hEQr: r4(nz(b.hEQr) || 0.6), hEQmode: 'ratio' }` and `info: { …, lsRed: null, … }`;
    after `hEQmode: LOC_SL.indexOf(b.hEQmode) >= 0 ? b.hEQmode : 'sw', hAEr: r4(num(b.hAEr) > 0 ? num(b.hAEr) : 0.5)`;
    `approachSlab.lsRed = lsSL` (`e.asOn === 'yes' ? (typeof x.lsRem === 'boolean' ? x.lsRem : e.lsRed !== 'no') : null`), `approachSlab.lsRule = x.lsRef`, `info.lsRed = lsSL`.
  - `fromAbutment`: before `hEQmode: sq.hEQmode === 'ratio' ? 'ratio' : 'static'`; after `hEQmode: LOC_AB.indexOf(sq.hEQmode) >= 0 ? sq.hEQmode : 'static'` (the
    calculator's `eqMode()`), `hAEr` (default 0.5); `approachSlab.lsRed / lsRule` from `ctx.lsRule` (the calculator's `apLsRule()`), else `A.lsRed !== false`.
  - `validate`: (c) with a stated location: `hAEr` 0.4 to 0.5 (C11.6.5.3), else the seismic group is disabled.
  - `toAbutment` seisset: before items khRAuto, khR, kv, hEQr and the note "The calculator's ΔP_AE height mode is not changed"; after, with
    a stated location: `seismic.hEQmode` (SubLoads (a) with hEQr 0.6 → `'sw'`; (a) with another ratio → `'ratio'` at that ratio; (b)–(d) one
    to one), `seismic.hAEr` with (c), hEQr; without: as before plus a note. aps: `apSlab.lsRed` when `approachSlab.lsRed` is a boolean (note when `ctx.lsAuto`).
  - `toSubLoads` bridgewide: + `hEQmode` (calculator (a) → `'sw'` with `hEQr` 0.6; `'ratio'` → `'sw'` with its ratio; (b)–(d) one to one), `hAEr`
    with (c); aps: + `earth.lsRed` (`'no'` kept; removed → `''` when the unit's option is blank now, else `'yes'`). Information rows: removed
    "ΔP_AE height" (now only "Seismic earth pressure location: not stated" for an earlier definition), "LS with an approach slab … removed only
    under MassDOT rules" (now only for an earlier definition without `approachSlab.lsRed`) and "Height of TU / WS / WL forces: bridge seat / top of
    bearing"; added "Height of BR (and CE)" (SubLoads: top of the bearings with the 6 ft above-deck couple; the calculator: the seat).
- **Governing provision:** AASHTO LRFD 10th Ed. C11.6.5.3, C11.6.5.4 (location options), 3.11.6.5 (LS with a structural approach slab),
  MassDOT Bridge Manual Part I 3.3.1.3; no formula changed in either tool. SubLoads' (a) applies ΔP_AE at its hEQr·H
  (`zInc`: `loc === 'sw' → hr * h`), the calculator's (a) at 0.6H (`eqZr`) and its "ratio" at hEQr·H: hence the (a)/ratio mapping.
- **Check case:** SubLoads default Abut. 1 (A_s 0.15, site D): (a) ΔP_AE at 0.6 × 20 = 12.000 ft, EE I M_l max 4210.395 kip-ft; a pull of the
  calculator's (c) 0.45 with the bridge-wide group ticked: combined P_AE at 0.45 × 20 = 9.000 ft, z_Δ = 25.148 ft, EE I M_l max 4855.820 (as
  tests/smoke/bsl-pae-loc.mjs). LS with the slab, SubLoads default Abut. 1: removed → kept (calculator lsRed false, the approach-slab group is
  ticked by default): Strength I M_l max 3202.468 → 4391.516 kip-ft (+1.75 × 679.456; LS 67.946 kip at 10 ft; tests/smoke/bsl-ls-slab.mjs).
  Calculator default project, slab on, a SubLoads `'no'` pulled with the slab group ticked: LS_h 0 → K_A·γ·h_eq·H·L = 0.30726 × 0.120 × 2 × 22 × 44
  = 71.382 kip, M_h 0 → 71.382 × 11 = 785.21 kip-ft; LS_v 0 → 0.120 × 2 × 5 × 44 = 52.8 kip.
- **How verified:** `node tests/engine/run.mjs abutment-def` (12 tests: 4 new); tests/smoke/abutment-subloads-exchange.mjs (new part C: both
  directions with the groups ticked), abutment-subloads-pull.mjs (frozen payload, unchanged), and every consumer test listed in the PR.
- **Decision (pending engineer review):** the calculator's earlier "ratio" option maps to SubLoads (a) with its ratio, and SubLoads (a) with a
  ratio other than 0.6 to the calculator's "ratio" option: both place ΔP_AE at ratio × H, so the mapping is exact (the request said map
  "ratio" to (a) only at 0.6; with SubLoads' editable (a) ratio no information row is needed). A definition from before this change (no `hAEr`)
  does not state the location: not mapped, information row / note. The LS state sent is the sender's effective rule (owner MassDOT / CTDOT:
  removed), not only its stored option.
- **Other copies:** none.
