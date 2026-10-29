/* shared/units.js — unit conversions and number formatting (window.SharedUnits).
   Classic script, no DOM. Created 2026-10-29 for apps/steel-bridge (Phase 3 of docs/REBUILD_PLAN.md); only what that
   app needs so far. Units are US customary throughout: lengths in or ft, forces kip, stresses ksi, moments kip-in or
   kip-ft, unit weights kcf or pcf.
   Conversions are exact factors (12 in/ft, 1000 lb/kip); nothing is rounded here except by the format functions. */
(function () {
  'use strict';
  // exact conversion factors
  const IN_PER_FT = 12, LB_PER_KIP = 1000;
  const C = {
    ftToIn: v => v * IN_PER_FT,             // ft -> in
    inToFt: v => v / IN_PER_FT,             // in -> ft
    kipInToKipFt: v => v / IN_PER_FT,       // kip-in -> kip-ft
    kipFtToKipIn: v => v * IN_PER_FT,       // kip-ft -> kip-in
    kcfToPcf: v => v * LB_PER_KIP,          // kip/ft^3 -> lb/ft^3
    pcfToKcf: v => v / LB_PER_KIP,          // lb/ft^3 -> kip/ft^3
    ksiToPsi: v => v * LB_PER_KIP,          // kip/in^2 -> lb/in^2
    psiToKsi: v => v / LB_PER_KIP           // lb/in^2 -> kip/in^2
  };

  /* fmt(x, d): fixed decimals d (default 2); '—' for a non-finite x; -0 and values that round to 0 print as 0. */
  function fmt(x, d) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    d = d == null ? 2 : d;
    const s = x.toFixed(d);
    return /^-0(\.0*)?$/.test(s) ? s.slice(1) : s;
  }
  /* fmtSig(x, n): n significant figures (default 4), plain notation, thousands not grouped. */
  function fmtSig(x, n) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    if (x === 0) return '0';
    n = n == null ? 4 : n;
    const e = Math.floor(Math.log10(Math.abs(x))), d = Math.max(0, n - 1 - e);
    return fmt(x, Math.min(d, 12));
  }
  /* fmtInt(x): rounded to a whole number, thousands grouped with commas (en-US). */
  function fmtInt(x) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    return (Math.round(x) || 0).toLocaleString('en-US');
  }
  /* frac(x): a plate dimension in inches as a mixed fraction to 1/16 in ("1 1/8"); decimals (3 places) if x is not a
     multiple of 1/16. Same output as GirderDetail's frac(). */
  function frac(x) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    const s16 = Math.round(x * 16);
    if (Math.abs(x * 16 - s16) > 1e-6) return x.toFixed(3);
    const w = Math.floor(s16 / 16); let n = s16 - w * 16, d = 16;
    while (n && n % 2 === 0) { n /= 2; d /= 2; }
    return n ? (w ? w + ' ' : '') + n + '/' + d : String(w);
  }
  /* parseDim(v): a number, or text such as "1 1/8", "1-1/8", "3/4", "0.875", '1.5"' -> inches as a number; NaN if
     unreadable. Same rules as GirderDetail's parseDim(). */
  function parseDim(v) {
    if (typeof v === 'number') return v;
    if (v == null) return NaN;
    const s = String(v).trim().replace(/["”]/g, '').replace(/(\d)-(\d)/g, '$1 $2').replace(/\s+/g, ' ');
    if (!s) return NaN;
    let m = s.match(/^(-?\d+(?:\.\d+)?) (\d+)\/(\d+)$/); if (m) return +m[1] + m[2] / m[3];
    m = s.match(/^(\d+)\/(\d+)$/); if (m) return m[1] / m[2];
    const n = Number(s); return isFinite(n) ? n : NaN;
  }

  window.SharedUnits = { IN_PER_FT, LB_PER_KIP, ...C, fmt, fmtSig, fmtInt, frac, parseDim };
})();
