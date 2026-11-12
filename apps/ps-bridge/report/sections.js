/* apps/ps-bridge/report/sections.js — the planned sections of the calculation report (window.PSBReportPlan). Classic script, no DOM.
   Created 2026-11-12 (PR 1 skeleton). The Report tab lists them until the report is built (PR 2e: steel-style builders over
   ../../shared/report.js and ../../shared/steps.js, every value from the prestressed engine, docs/ps-bridge-plan.md §5).
   Display only: nothing is calculated here. */
(function () {
  'use strict';
  const SECTIONS = [
    ['Project, basis and assumptions', 'title block, codes and editions, every assumption of the input tabs'],
    ['Bridge layout and cross-section', 'spans, continuity, girders and bays, deck, design groups'],
    ['Materials', "f′ci, f′c, strands, mild steel"],
    ['Section properties', 'gross and composite properties per design group'],
    ['Loads and live-load distribution', 'DC1, DC2, DW per girder; LLDF; live load'],
    ['Analysis', 'moment and shear envelopes; continuity and restraint moments'],
    ['Prestress losses', 'instantaneous and long-term losses'],
    ['Stresses', 'release and service stresses at every station'],
    ['Flexure', 'Strength I resistance and minimum reinforcement'],
    ['Shear', 'shear resistance, stirrups, longitudinal reinforcement'],
    ['End zone and hold-down', 'splitting, confinement, debonding, draped strands and hold-down force'],
    ['Camber and deflection', 'release, erection and final camber; live-load deflection'],
    ['Handling', 'lifting and hauling, where on'],
    ['Deck', 'strip-method deck design, where on'],
    ['Rating', 'LRFR rating factors'],
    ['Auto design basis', 'the auto-design steps and their assumptions, where run']
  ].map(([title, what]) => ({ title, what }));
  window.PSBReportPlan = { SECTIONS };
})();
