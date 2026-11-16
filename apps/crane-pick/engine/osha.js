/* apps/crane-pick/engine/osha.js — power-line minimum clearance (window.CranePickOSHA). Classic script, no DOM. C1 (2026-11-16).

   Source: 29 CFR 1926.1408 "Power line safety (up to 350 kV) — equipment operations", Table A "Minimum Clearance Distances"
   (OSHA Cranes and Derricks in Construction, 75 FR 47906, Aug. 9, 2010; eCFR current text). Paraphrased, not quoted:
     voltage (nominal, kV, alternating current)    minimum clearance distance (ft)
       up to 50                                      10
       over 50 to 200                                15
       over 200 to 350                               20
       over 350 to 500                               25
       over 500 to 750                               35
       over 750 to 1,000                             45
       over 1,000                                    set by the utility owner/operator or a registered professional engineer who is a
                                                     qualified person with respect to electrical power transmission and distribution
     Table note: the value after "to" is included in its row (e.g. "over 50 to 200" includes 200 kV).
   The Table A distance is used under 1926.1408(a)(2)(iii) (Option 3), which needs the line's voltage (from the utility owner/operator).
   Without the voltage: 1926.1408(a)(2)(ii) (Option 2) keeps everything 20 ft away from a line of up to 350 kV, and 1926.1409 (lines over
   350 kV) reads 50 ft for that 20 ft. This tool: voltage unknown -> 50 ft (conservative), or 20 ft when the user states the line is
   350 kV or less (Decision, pending engineer review, 2026-11-16).
   The clearance applies to any part of the equipment, load line or load; the plan buffer drawn by the tool is the horizontal distance
   only (the line's height and the boom / load in elevation come in phase C3). */
(function () {
  'use strict';
  const REF = '29 CFR 1926.1408 Table A';
  const ROWS = [
    { over: 0, to: 50, ft: 10, band: 'up to 50 kV' },
    { over: 50, to: 200, ft: 15, band: 'over 50 to 200 kV' },
    { over: 200, to: 350, ft: 20, band: 'over 200 to 350 kV' },
    { over: 350, to: 500, ft: 25, band: 'over 350 to 500 kV' },
    { over: 500, to: 750, ft: 35, band: 'over 500 to 750 kV' },
    { over: 750, to: 1000, ft: 45, band: 'over 750 to 1,000 kV' }
  ];
  const n = (x, d) => Number(x).toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  /* row(kV) -> the Table A row, null above 1,000 kV, undefined when kV is not a positive number */
  function row(kV) {
    if (!(typeof kV === 'number' && isFinite(kV) && kV > 0)) return undefined;
    return ROWS.find(r => kV > r.over && kV <= r.to) || null;
  }
  /* clearance(line) -> { ft (NaN when none can be given), basis, ref, ok, note, steps }
     line = { kv (number or null), le350 (true: voltage not known, line stated to be 350 kV or less), setFt (ft, given by the utility /
     RPE, for over 1,000 kV) } */
  function clearance(line, idp) {
    const id = (idp || 'osha') + '.', kv = line && typeof line.kv === 'number' && isFinite(line.kv) ? line.kv : null;
    const step = (o) => Object.assign({ unit: 'ft', d: 0, ref: REF }, o, { id: id + o.id });
    if (kv == null || kv <= 0) {
      if (line && line.le350) return { ft: 20, basis: 'voltage not known, line stated ≤ 350 kV: 1926.1408(a)(2)(ii)', ref: '29 CFR 1926.1408(a)(2)(ii)', ok: true,
        note: 'Voltage not known: 20 ft (Option 2, lines up to 350 kV). Get the voltage from the utility owner/operator to use Table A.',
        steps: [step({ id: 'D', label: 'Minimum clearance, voltage not known (line stated to be 350 kV or less)', sym: 'D_{min}', eq: '\\text{Option 2 distance}', sub: '20', value: 20, ref: '29 CFR 1926.1408(a)(2)(ii)' })] };
      return { ft: 50, basis: 'voltage not known: 50 ft (1926.1409 for lines over 350 kV), conservative', ref: '29 CFR 1926.1409; 1926.1408(a)(2)(ii)', ok: true,
        note: 'Voltage not known: 50 ft is used (the Option 2 distance for lines over 350 kV, 1926.1409). Get the voltage from the utility owner/operator to use Table A.',
        steps: [step({ id: 'D', label: 'Minimum clearance, voltage not known (assumed over 350 kV)', sym: 'D_{min}', eq: '\\text{Option 2 distance, over 350 kV}', sub: '50', value: 50, ref: '29 CFR 1926.1409; 1926.1408(a)(2)(ii)' })] };
    }
    const r = row(kv);
    if (r === null) {
      const s = line && typeof line.setFt === 'number' && line.setFt > 0 ? line.setFt : NaN;
      return { ft: s, basis: 'over 1,000 kV: set by the utility owner/operator or an RPE', ref: REF, ok: isFinite(s),
        note: isFinite(s) ? `Over 1,000 kV: ${n(s, 1)} ft as set by the utility owner/operator or a registered professional engineer (entered).`
          : 'Over 1,000 kV: Table A gives no distance. Enter the clearance set by the utility owner/operator or a registered professional engineer.',
        steps: [step({ id: 'D', label: `Minimum clearance, ${n(kv, 1)} kV (over 1,000 kV: as set by the utility owner/operator or an RPE)`, sym: 'D_{min}', eq: '\\text{as set}', sub: isFinite(s) ? n(s, 1) : '\\text{not entered}', value: isFinite(s) ? s : 'not entered', d: 1 })] };
    }
    return { ft: r.ft, basis: `Table A, ${r.band}`, ref: REF, ok: true, band: r.band,
      note: `Table A: ${r.band} → ${r.ft} ft.`,
      steps: [step({ id: 'D', label: `Minimum clearance, ${n(kv, kv % 1 ? 1 : 0)} kV (${r.band})`, sym: 'D_{min}', eq: '\\text{Table A}(V)', sub: `\\text{Table A}(${n(kv, kv % 1 ? 1 : 0)}\\,\\text{kV})`, value: r.ft })] };
  }
  window.CranePickOSHA = { REF, ROWS, row, clearance };
})();
