# Fix log — shared/handoff-stale.js (window.SharedHandoffStale)

The hand-off stale check, the part every app shares. Loaded by `apps/ps-bridge/index.html` (engine/hostale.js) and `apps/steel-bridge/index.html` (engine/hostale.js).

## 2026-11-23 — PR: claude/steel-handoff-stale (SHO) — new file, moved from apps/ps-bridge/engine/hostale.js (no change of behaviour)
- **Why:** the Steel Bridge app gets the PS Bridge app's hand-off stale banner (engineer, 2026-11-23); CLAUDE.md §3: logic used by more than one tool lives once in `shared/`.
- **What moved (text unchanged):** `VOL`, `canon`, `hash` (FNV-1a 32-bit + length), `sig` (the hash of a payload without `producedAt` / `updatedAt` / `device`), the record helpers `sentOf`, `loadedOf`, `setSent`, `setLoaded` (`put`), `carrySent`, the states `outState`, `inState`. PS-only code stays in `apps/ps-bridge/engine/hostale.js` (its channels, `noStep`, `designText`, `cellSig`, `capSig`, `allSig`, `pmSig`, `lldfBeam`, `lldfCur`, `dlCur`, `pmCur`, `mctState`, `geoState`), which now takes the moved functions from `window.SharedHandoffStale` and still exports them under the same names (`PSBHoStale.sig`, …).
- **Before / After:** in `apps/ps-bridge/engine/hostale.js` the definitions listed above are replaced by `const { canon, hash, sig } = W.SharedHandoffStale;` and `const { sentOf, loadedOf, setSent, setLoaded, carrySent, outState, inState } = W.SharedHandoffStale;`; `apps/ps-bridge/index.html` loads `../../shared/handoff-stale.js` before `engine/hostale.js`.
- **Governing provision:** none (display only; no computed value).
- **Check case:** `sig({ _schema: 'x', producedAt: '…10:00', v: 1, o: { b: 2, a: [1, 2] } })` = `sig` of the same values with another key order, another `producedAt` and a `device`; ≠ with `v: 1.0001`; `outState({ sig: 'a' }, 'b')` = 'stale'; `inState({ at: 't1', sig: 'a' }, { at: 't2', sig: 'a' })` = 'current'.
- **How verified:** `tests/engine/psbridge-hostale.test.mjs` (8 tests, unchanged but for the script list) passes on the moved code; `tests/engine/steel-hostale.test.mjs` (new); PS smoke `tests/smoke/ps-bridge-hostale.mjs`; full `node tests/engine/run.mjs`.
- **Tools that load it:** PS Bridge (`apps/ps-bridge`), Steel Bridge Design (`apps/steel-bridge`).
