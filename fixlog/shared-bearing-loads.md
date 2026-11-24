# Fix log — shared/bearing-loads.js (window.SharedBearingLoads)

Loaded by: `elastomeric_design_module.html` (receiver), `apps/ps-bridge/index.html` (sender). Tests: `node tests/engine/run.mjs psbridge-bearing`.

## 2026-11-24 — BRG-HO: new file, the bearingLoads hand-off's shared part (HANDOFF.md §4.17)
PR: see the PR body (branch claude/bearing-handoff-ps).
- **What:** `SCHEMA` `bridge-bearing-loads`, `VERSION` 1, `CHANNEL` `bearingLoads`; `service(g)` (Pdl = DC1 + DC2 + DW; Pll = LL.max + PL; PllIM = LL.maxIM + PL; Pmin = DC1 + DC2 − UT − UF; kip, γ = 1.0); `check(p)` (schema, version ≤ 1, units kip / ft, factored false, every number; a sent `service` total that differs from `service()` by more than 0.002 kip is a warning); `plan(p, li, { im, pl, n, girder })` (per bearing = ÷ n; default design girder the largest P_DL + P_LL); `lineName(l)`, `summary(p)`.
- **Provisions:** none applied (sums with load factor 1.0; Service I, AASHTO LRFD 10th Ed. Table 3.4.1-1, is cited as the basis only).
- **Check case:** the SRP bridge (fixlog/ps-bridge.md BRG-HO): G2 Abut. 1 → Pdl 142.955, Pll 96.680, Pmin 130.085 kip; with `{ im: true, pl: false, n: 2 }` G1: Pll = 98.554 / 2 = 49.277 kip.
- **Saved data:** none of its own. **Other copies:** none.
