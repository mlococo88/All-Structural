# Fix logs

Each tool has one log file here, named after the tool file without `.html`. For example, fixes to `Spread Footing.html` go in `fixlog/Spread Footing.md`.

The purpose is to let any fix be **re-applied by hand** to a fresh or older copy of a tool, for example if a tool is restored from a backup or re-exported from another source. Every entry therefore records:

- **Where:** the function name plus an *anchor text* (a short unique code snippet to search for). Line numbers drift, so they are given only as approximate.
- **Before / After:** the exact old and new code.
- **Problem:** what was wrong, and whether the fix makes results more or less conservative.
- **Governing provision:** spec, edition, and article/equation/table.
- **Check case:** inputs and results before and after, plus a short hand check.
- **How verified:** for example, the function run in Node, or the JSX transpiled.
- **Other copies:** other files that contain the same code and need the same fix.
- **Open items:** issues found but deliberately not changed, and the decision or information needed.

Basis used for fixes, unless a log says otherwise:

- AASHTO LRFD **10th Ed. (2024)**
- ACI 318-19
- AISC 360-16
- NDS 2018
- ASCE 7 per the edition each tool states

MassDOT-specific values are left unchanged and listed as open items.
