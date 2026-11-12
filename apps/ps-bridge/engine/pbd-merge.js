/* apps/ps-bridge/engine/pbd-merge.js — mergeInputs (saved inputs merged onto DEFAULTS; from the old page's persistence part, used for the project's base design).
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 8796-8813 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): mergeInputs.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
// Deep-merge a saved input object onto DEFAULTS so newly-added fields in future versions
// are filled in and never come back undefined.
function mergeInputs(p){
  if(!p||typeof p!=='object') return DEFAULTS;
  return {...DEFAULTS,...p,
    proj:{...DEFAULTS.proj,...(p.proj||{})}, cust:{...DEFAULTS.cust,...(p.cust||{})},
    ovr:{...DEFAULTS.ovr,...(p.ovr||{})},
    mat:{...DEFAULTS.mat,...(p.mat||{})}, str:{...DEFAULTS.str,...(p.str||{})},
    harp:{...DEFAULTS.harp,...(p.harp||{})}, loads:{...DEFAULTS.loads,...(p.loads||{})},
    cont:{...DEFAULTS.cont,...(p.cont||{})}, handling:{...DEFAULTS.handling,...(p.handling||{})},
    rateVeh:Array.isArray(p.rateVeh)?p.rateVeh:DEFAULTS.rateVeh,
    deck:{...DEFAULTS.deck,...(p.deck||{})},
    rows:Array.isArray(p.rows)&&p.rows.length?p.rows:DEFAULTS.rows,
    external:p.external||null,
    opt:(()=>{const o={...DEFAULTS.opt,...(p.opt||{}),mult:{...DEFAULTS.opt.mult,...((p.opt||{}).mult||{})}};
      if((p.opt||{}).longAs!=null && (p.opt||{}).longAsBot==null){ o.longAsBot=+p.opt.longAs; }
      return o;})()};
}
