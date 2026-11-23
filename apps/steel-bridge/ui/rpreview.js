/* apps/steel-bridge/ui/rpreview.js — review tools of the Report tab (window.SBDReportReview): contents sidebar (hide / show, sections
   only, resize), markup mode with comments anchored to report items, "Save reviewed copy", the comments appendix in print. Added
   2026-11-19 (PR #1646). 2026-11-23: the code moved unchanged to shared/report-review.js (window.SharedReportReview; CLAUDE.md §3: the
   Prestressed Bridge app uses the same tools); this file keeps the app's name for them and its two localStorage keys, which are unchanged
   (CLAUDE.md §5): sbd2.reportReview.v1 ({ <project key>: [comments] }) and sbd2.reportToc ({ hidden, compact, w }; + '.author').
   Classic script; needs shared/report-review.js loaded first. API as before: attach(host, ctx) after SharedReport.mount (ui/report.js
   render); KEY, TOC_KEY, projKey(P), load(P), save(P, list), esc, reviewedCopy. */
(function () {
  'use strict';
  window.SBDReportReview = window.SharedReportReview.create({ key: 'sbd2.reportReview.v1', tocKey: 'sbd2.reportToc', title: 'Steel Bridge Design' });
})();
