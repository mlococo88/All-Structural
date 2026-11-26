/* apps/ps-bridge/ui/settings.js — the Settings window (window.PSBSettings). Classic script; display and layout only.
   SET (2026-11-26; engineer's request 2026-11-26, the approved layout mockup and the list of inputs to move): a gear button in the app header
   opens one window with the settings that hold from bridge to bridge (owner policy, method choices, material constants, load factors and
   limits), in eight groups (left tabs; top tabs on a phone; the Steel Bridge app's ninth group, Detailing standards, has no counterpart here),
   the owner (DOT) at the top. The window's mechanics are those of apps/steel-bridge/ui/settings.js (SBDSettings); the registry is this app's.

   Nothing here stores, computes or converts a value. Every setting stays the input it was, at the same path of the project, drawn by the same
   code on its input tab: after each draw of the input tabs (index.html markErrors -> sync) the row of each moved input is hidden on its tab and
   a copy of it is shown in this window. A change to a copy is handed to the original input (its value, then a change event on it), so the
   app's own handler does the edit: the same path, kind, girder-type scope, Undo / Redo step, dirty state and autosave as an edit on the tab.
   Values per girder type stay per type: their rows sit under a copy of the app's "Entered values for" selector, which changes the same
   ui.scope as the tabs' selector. A "Borderline" item stays on its tab too, and both edit the same field.
     Save:   closes the window (each edit was applied as it was made).
     Cancel, ×, Esc: puts back the project as it was when the window opened (index.html revert: the undo steps made since then are dropped).
     Reset to owner defaults: off here (Decision pending engineer review): this app has no "apply the owner's defaults" action; a new owner
             already sets each input still at the previous owner's default.
   Per-browser UI state only: the last group shown, key psb2.settingsGroup_v1 (CLAUDE.md §5: this app's prefix, never a generic key). */
(function () {
  'use strict';
  const UI_KEY = 'psb2.settingsGroup_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TAB = { proj: 'Project', layout: 'Bridge layout', xsec: 'Cross-section', gird: 'Girders & strands', mat: 'Materials', dd: 'Diaphragms / deck', loads: 'Loads', own: 'Owner rules', ad: 'Auto design' };
  const GROUPS = [
    ['own', 'Owner and load modifiers', 'The owner above sets its manual’s rules; the load modifiers and the owner rules sit with it.'],
    ['mat', 'Concrete and reinforcement', 'Material constants that hold for every bridge the office designs.'],
    ['sdl', 'Superimposed dead load', 'Unit weights and allowances, and how dead load is shared between the girders.'],
    ['lldf', 'Live-load distribution', 'Method choices for the distribution factors.'],
    ['comp', 'Composite section', 'How the deck works with the girder.'],
    ['deck', 'Deck design', 'Office standards for the deck slab (the optional deck design).'],
    ['anl', 'Analysis and limit states', 'Method choices, factors and limits used in the analysis and the checks.'],   // 8 Detailing standards: Steel Bridge Design only (no such group here)
    ['ad', 'Auto design', 'Search limits and costs of Auto design.']
  ].map(([id, name, intro]) => ({ id, name, intro }));

  /* ---------- the registry: one entry per input shown here ----------
     k: the project path (data-path; error marks and links), s: the input's selector on its tab, g: group, c: card, t: the input tab it is
     drawn on, l: a short label (used when the input is not drawn now), w: when it is drawn, b: borderline (the reason; the input also stays on
     its tab). Girders & strands, Materials and Loads take values per girder type (ui/types.js SCOPED): those rows edit the girder type chosen
     in the app's own "Entered values for" selector, shown above them here (a copy of the Materials tab's), so they stay per type. */
  const E = [];
  const dp = p => `[data-path="${p}"]`;
  const add = (g, c, t, list) => list.forEach(x => E.push(Object.assign({ g, c, t, s: x.s || dp(x.k) }, x)));
  const CONT = 'with spans made continuous for composite loads (Bridge layout tab)', DD = 'with the deck design on', DIST = 'with DC2 and DW distributed to the girder lines';
  const HAND = 'with the handling checks on';

  add('own', 'Load modifiers and owner rules', 'own', [
    { k: 'base.opt.etaD', l: 'Nonductile (η<sub>D</sub>)', w: 'when the owner asks it', b: 'The answer describes this bridge.' },
    { k: 'base.opt.etaR', l: 'Nonredundant (η<sub>R</sub>)', w: 'when the owner asks it', b: 'The answer describes this bridge.' },
    { k: 'base.opt.etaI', l: 'Operationally important (η<sub>I</sub>)', w: 'when the owner asks it', b: 'The answer describes this bridge.' },
    { k: 'base.opt.llMult', l: 'HL-93 design load multiplier', w: 'when the owner has the rule' },
    { k: 'base.opt.sidewalk', l: 'Bridge with sidewalks', w: 'when the owner has the rule', b: 'Whether a bridge has sidewalks is a fact about that bridge.' },
    { k: 'base.opt.hdCheck', l: 'Check the hold-down force' }, { k: 'base.opt.hdFrac', l: 'Hold-down limit, × W', w: 'with the check on' },
    { k: 'base.opt.relCfac', l: 'Release compression limit, × f′<sub>ci</sub>' }, { k: 'base.opt.corrosion', l: 'Corrosion exposure (Service III tension limit)' }]);
  add('mat', 'Concrete', 'mat', [
    { k: 'base.mat.fcd', l: 'f′<sub>c</sub>, deck', b: 'An office standard, but one bridge can call for a different strength.' },
    { k: 'base.mat.wc', l: 'Unit weight, girder (for E<sub>c</sub>)' }, { k: 'base.mat.wcLoad', l: 'Unit weight, girder (dead load)' },
    { k: 'base.mat.wcd', l: 'Unit weight, deck (for E<sub>c</sub>)' }, { k: 'base.mat.wcdLoad', l: 'Unit weight, deck (dead load)' }]);
  add('mat', 'Prestressing strand', 'mat', [
    { k: 'base.str.size', l: 'Strand size', b: 'Standard for most girders, but some sections use 0.5 in strand.' },
    { k: 'base.str.jack', l: 'Jacking stress f<sub>pj</sub> / f<sub>pu</sub>' }, { k: 'base.str.Ep', l: 'Strand modulus E<sub>p</sub>' }]);
  add('mat', 'Reinforcing steel', 'gird', [
    { k: 'base.opt.fy', l: 'Stirrup yield strength f<sub>y</sub>' }, { k: 'base.opt.longFy', l: 'f<sub>y</sub> of the bottom bars (5.7.3.5 tie)' },
    { k: 'base.opt.relFy', l: 'f<sub>y</sub> of the release tension steel', w: 'with bonded reinforcement at release' }]);
  add('mat', 'Reinforcing steel', 'layout', [{ k: 'base.cont.fy', l: 'Deck bar yield strength f<sub>y</sub> over the pier', w: CONT }]);
  add('mat', 'Reinforcing steel', 'gird', [['splitAv', 'Splitting steel: area per leg'], ['splitN', 'Splitting steel: number of legs within h/4'], ['confBar', 'Confinement bar size (No.)'],
    ['confS', 'Confinement bar spacing'], ['confN', 'Confinement bars from the end']].map(([k, l]) => ({ k: 'base.opt.' + k, l, b: 'Often a standard detail, but end zones vary with the girder.' })));
  add('sdl', 'Unit weights and loads', 'xsec', [
    { k: 'xs.dl.barL.bGam', l: 'Left deck edge: barrier unit weight γ', w: 'with the left barrier weight from its geometry' },
    { k: 'xs.dl.barR.bGam', l: 'Right deck edge: barrier unit weight γ', w: 'with the right barrier weight from its geometry' },
    { k: 'xs.dl.wcA', l: 'Curb / sidewalk / median concrete', w: DIST }, { k: 'xs.dl.ped', l: 'Pedestrian live load PL', w: DIST },
    { k: 'xs.dl.fws', l: 'Future wearing surface (DW)', w: DIST + ', entered as a weight', b: 'The owner sets a usual value, but each bridge’s overlay can differ.' },
    { k: 'base.tsSeparate', l: 'Separate deck thickness for the dead load', b: 'Depends on the deck of this bridge.' }]);
  add('sdl', 'Sharing dead load between girders', 'xsec', [{ k: 'xs.dl.mode', l: 'DC2 and DW per girder' }, { k: 'xs.dl.method', l: 'Distribution method', w: DIST }]);
  add('lldf', 'Distribution factors', 'xsec', [{ k: 'xs.lldf.skewV', l: 'Shear skew correction' }, { k: 'xs.lldf.extMin', l: 'Exterior not less than interior' }]);
  add('lldf', 'Distribution factors', 'loads', [
    { k: 'base.loads.llAuto', l: 'Live load moment and shear', b: 'Usually computed, but a bridge with demands from the owner needs them entered.' },
    { k: 'base.loads.dfAuto', l: 'Distribution factors', w: 'with the live load computed', b: 'Usually computed, but a bridge with factors from the owner needs them entered.' }]);
  add('comp', 'Section properties', 'xsec', [{ k: 'base.beffAuto', l: 'Effective flange width b<sub>eff</sub>' }, { k: 'base.haunchInProps', l: 'Haunch in the composite section properties' }]);
  add('deck', 'Deck slab', 'dd', [
    { k: 'base.deck.on', l: 'Deck design', b: 'Some bridges reuse a standard deck, so this may be a switch on each bridge.' },
    { k: 'base.deck.wsFut', l: 'Future wearing surface (deck design)', w: DD }, { k: 'base.deck.xnegAuto', l: 'Negative-moment design section', w: DD },
    { k: 'base.deck.fyd', l: 'Deck bar yield strength f<sub>y</sub>', w: DD }, { k: 'base.deck.coverT', l: 'Top cover', w: DD }, { k: 'base.deck.coverB', l: 'Bottom cover', w: DD }]);
  add('deck', 'Load rating', 'loads', [
    { k: 'base.opt.rtPhiC', l: 'Condition factor φ<sub>c</sub>', b: 'Rarely changed, so they could live here; kept with the bridge’s rating inputs as well.' },
    { k: 'base.opt.rtPhiS', l: 'System factor φ<sub>s</sub>', b: 'Rarely changed, so they could live here; kept with the bridge’s rating inputs as well.' }]);
  add('anl', 'Service stresses', 'loads', [{ k: 'base.opt.useTrans', l: 'Release stress section' }, { k: 'base.opt.gLLs3', l: 'γ<sub>LL</sub> for Service III' }]);
  add('anl', 'Continuity', 'layout', [{ k: 'base.cont.restraint', l: 'Restraint moments (creep and shrinkage)', w: CONT }, { k: 'base.cont.topRC', l: 'Top of girder near interior supports', w: CONT }]);
  add('anl', 'Girder ends', 'gird', [
    { k: 'base.opt.endOh', l: 'Girder end past the bearing ℄', b: 'Set by the bearing detail of this bridge.' },
    { k: 'base.opt.Lpad', l: 'Bearing pad length', b: 'Set by the bearing chosen for this bridge.' }]);
  add('anl', 'Prestress losses and camber', 'mat', [
    { k: 'base.opt.lossMethod', l: 'Loss method' }, { k: 'base.opt.dfpSSauto', l: 'Deck shrinkage gain Δf<sub>pSS</sub>' },
    { k: 'base.mat.H', l: 'Relative humidity H' }, { k: 'base.mat.ti', l: 'Age at release t<sub>i</sub>' }, { k: 'base.mat.td', l: 'Age at deck placement t<sub>d</sub>' }, { k: 'base.mat.tfin', l: 'Final age t<sub>f</sub>' }]
    .concat([['psE', 'Prestress at erection'], ['swE', 'Self-weight at erection'], ['psF', 'Prestress, final'], ['swF', 'Self-weight, final'], ['dkF', 'Deck, final'], ['sdF', 'Superimposed dead load, final']]
      .map(([k, l]) => ({ k: 'base.opt.mult.' + k, l: 'PCI camber multiplier: ' + l, pfx: 'PCI camber multiplier: ' }))));
  add('anl', 'Handling and shipping', 'loads', [
    { k: 'base.handling.on', l: 'Handling checks', b: 'A switch some bridges turn off when the fabricator does the check.' },
    { k: 'base.handling.aLift', l: 'Lift point from the girder end', w: HAND, b: 'Changes with the girder length.' },
    { k: 'base.handling.aHaul', l: 'Haul support (bunk) from the end', w: HAND, b: 'Changes with the girder length.' },
    { k: 'base.handling.ei', l: 'Initial sweep e<sub>i</sub>', w: HAND }, { k: 'base.handling.hr', l: 'Roll centre height (haul)', w: HAND }, { k: 'base.handling.theta_i', l: 'Road cross slope θ<sub>i</sub>', w: HAND }]);
  const ad = (k, l, x) => Object.assign({ k: 'autodesign.' + k, s: `[data-ad="${k}"]`, l }, x || {});
  add('ad', 'Search', 'ad', [ad('topN', 'Sections to list per span')]);
  add('ad', 'Concrete strength range', 'ad', [ad('fcLo', 'f′<sub>c</sub>, lowest'), ad('fcHi', 'f′<sub>c</sub>, highest'), ad('fciLo', 'f′<sub>ci</sub>, lowest'), ad('fciHi', 'f′<sub>ci</sub>, highest (plant)')]);
  const OWNER = { k: 'base.owner', s: dp('base.owner'), t: 'own', b: 'The office’s usual owner, but a bridge for another DOT needs a different one, so each bridge keeps its own.' };
  const SCOPED = ['gird', 'mat', 'loads'];   // ui/types.js SCOPED: values per girder type

  const moved = x => !x.b && !x.info;
  const entryOf = p => { const s = String(p || ''); return E.find(x => x.re ? x.re.test(s) : x.k === s) || (s === OWNER.k ? OWNER : null); };
  /* has(path): the input of this path is moved here (hidden on its tab); a borderline input stays on its tab, so it is not "moved" */
  const has = p => { const x = entryOf(p); return !!x && x !== OWNER && moved(x); };
  const groupOf = id => GROUPS.find(G => G.id === id);

  /* ---------- the page ---------- */
  let api = null, root = null, open = false, cur = 'own', mk = null, errs = [], tBuild = 0, prevFocus = null;
  const MAP = new Map();   // copy -> original input (rebuilt with the copies)
  try { const g = localStorage.getItem(UI_KEY); if (g && groupOf(g)) cur = g; } catch (e) { /* no storage: the first group */ }
  const saveGroup = () => { try { localStorage.setItem(UI_KEY, cur); } catch (e) { /* not kept */ } };
  const panes = () => document.getElementById('inPanes');
  const rowOf = el => el.closest('.fRow') || el.closest('.ad-ck') || el.parentElement;
  /* originals(x): the input(s) of entry x drawn now on the input tabs (with the regexp match for a per-type entry) */
  function originals(x) {
    const P = panes(); if (!P || x.info) return [];
    let L; try { L = [...P.querySelectorAll(x.s)]; } catch (e) { L = []; }
    L = L.filter(el => /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
    if (x.re) return L.map(el => ({ el, m: x.re.exec(el.dataset.path || '') })).filter(q => q.m);
    return L.slice(0, 1).map(el => ({ el, m: null }));
  }
  const errCount = g => errs.filter(e => { const x = entryOf(e.path); return x && x !== OWNER && x.g === g; }).length;
  const movedErrs = () => errs.filter(e => has(e.path)).length;

  const css = () => {
    if (document.getElementById('pss-css')) return;
    const st = document.createElement('style'); st.id = 'pss-css';
    st.textContent = `
#psSet,#psSetVeil{--s-surface:#fff;--s-surface2:#F1F3F5;--s-border:#E4E7EB;--s-text:#0F172A;--s-muted:#64748B;--s-tab:#475569;--s-accent:#1E3A5F;--s-input:#fff;--s-inputb:#CBD5E1;
  --s-amber:#B45309;--s-amberbg:#FEF3C7;--s-amberfg:#92400E;--s-shadow:0 18px 48px rgba(15,23,42,.28);--s-veil:rgba(15,23,42,.42);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #psSet,:root:not([data-theme="light"]) #psSetVeil{--s-surface:#18202c;--s-surface2:#202a38;--s-border:#334155;--s-text:#E5E7EB;--s-muted:#94A3B8;--s-tab:#CBD5E1;
  --s-accent:#BFD3F2;--s-input:#0f1622;--s-inputb:#475569;--s-amber:#F59E0B;--s-amberbg:#3a2a0e;--s-amberfg:#FCD34D;--s-shadow:0 18px 48px rgba(0,0,0,.55);--s-veil:rgba(0,0,0,.55);color-scheme:dark}}
:root[data-theme="dark"] #psSet,:root[data-theme="dark"] #psSetVeil{--s-surface:#18202c;--s-surface2:#202a38;--s-border:#334155;--s-text:#E5E7EB;--s-muted:#94A3B8;--s-tab:#CBD5E1;
  --s-accent:#BFD3F2;--s-input:#0f1622;--s-inputb:#475569;--s-amber:#F59E0B;--s-amberbg:#3a2a0e;--s-amberfg:#FCD34D;--s-shadow:0 18px 48px rgba(0,0,0,.55);--s-veil:rgba(0,0,0,.55);color-scheme:dark}
.pss-hide{display:none!important}
#hdrBtns button#psGear{display:inline-flex;align-items:center;justify-content:center;gap:4px;width:auto;min-width:34px;height:28px;padding:0 7px;border-color:rgba(255,255,255,.6);background:rgba(255,255,255,.14);position:relative}
#hdrBtns button#psGear:hover{background:rgba(255,255,255,.26)} #psGear svg{width:18px;height:18px;flex:none}
#psGear .pss-dot{display:none;min-width:15px;padding:0 4px;border-radius:8px;background:var(--fail,#DC2626);color:#fff;font-size:7.5pt;font-weight:700;line-height:14px}
#psGear.has-err .pss-dot{display:inline-block}
#psSetVeil{position:fixed;inset:0;background:var(--s-veil);z-index:44}
#psSet{position:fixed;z-index:45;top:14px;bottom:14px;left:50%;transform:translateX(-50%);width:min(1000px,calc(100vw - 28px));display:flex;flex-direction:column;
  background:var(--s-surface);color:var(--s-text);border:1px solid var(--s-border);border-radius:10px;box-shadow:var(--s-shadow);overflow:hidden;font-family:var(--font-doc);font-size:10pt}
#psSet[hidden],#psSetVeil[hidden]{display:none!important}
#psSet .pss-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--navy-800,#1E3A5F);color:#fff;font-family:var(--font-ui)}
#psSet .pss-head svg{width:18px;height:18px;flex:none} #psSet .pss-head h2{margin:0;font-size:16px;font-weight:600;flex:1;min-width:0}
#psSet .pss-head .sub{font-weight:400;color:#C7D4E4;font-size:12px;margin-left:6px}
#psSet .pss-x{border:0;background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:5px} #psSet .pss-x:hover{background:rgba(255,255,255,.15)}
#psSet .pss-owner{padding:8px 14px;border-bottom:1px solid var(--s-border);background:var(--s-surface2);font-family:var(--font-ui);font-size:13px}
#psSet .pss-owner .fRow{margin:0} #psSet .pss-owner .fRow>label{font-weight:600;min-width:0}
#psSet .pss-man{color:var(--s-muted);font-size:12px}
#psSet .pss-body{flex:1;min-height:0;display:grid;grid-template-columns:240px minmax(0,1fr)}
#psSet nav.pss-side{border-right:1px solid var(--s-border);background:var(--s-surface2);overflow:auto;padding:8px 0}
#psSet nav.pss-side button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;border-left:3px solid transparent;border-radius:0;background:none;padding:9px 12px 9px 11px;font:13px var(--font-ui);color:var(--s-tab);cursor:pointer}
#psSet nav.pss-side button:hover{background:var(--s-surface)}
#psSet nav.pss-side button[aria-selected="true"]{background:var(--s-surface);color:var(--s-accent);font-weight:600;border-left-color:var(--blue-600,#2563EB)}
#psSet nav.pss-side .num{flex:none;width:18px;color:var(--s-muted);font-weight:400} #psSet nav.pss-side .cnt{margin-left:auto;font-size:11px;font-weight:400;color:var(--s-muted);white-space:nowrap}
#psSet nav.pss-side .err{margin-left:4px;min-width:15px;padding:0 4px;border-radius:8px;background:var(--fail,#DC2626);color:#fff;font-size:10px;font-weight:700;line-height:14px;text-align:center}
#psSet .pss-pane{overflow:auto;padding:6px 16px 18px;min-width:0}
#psSet .pss-pane h3{font:600 15px var(--font-ui);margin:10px 0 2px;color:var(--s-accent)} #psSet .pss-pane .intro{font:13px var(--font-ui);color:var(--s-muted);margin:0 0 4px}
#psSet .sec{background:var(--s-surface);border-color:var(--s-border)} #psSet .sec>.secHead{background:var(--s-surface2);border-color:var(--s-border);color:var(--s-tab)}
#psSet .pss-row{padding:3px 0 3px 9px;border-bottom:1px dashed var(--s-border);border-left:3px solid transparent}
#psSet .pss-row:last-child{border-bottom:0}
#psSet .pss-row.bl{border-left-color:var(--s-amber);background:linear-gradient(90deg,var(--s-amberbg),transparent 70%)}
#psSet .pss-row.hit{outline:2px solid var(--blue-600,#2563EB);outline-offset:-2px;background:rgba(37,99,235,.08)}
#psSet .pss-row .fRow>label:first-child{min-width:220px;max-width:calc(100% - 150px)}
#psSet .pss-row .ad-ck{display:flex;gap:6px;align-items:flex-start;margin:4px 0}
#psSet .pss-meta{font:11.5px var(--font-ui);color:var(--s-muted);margin:0 0 3px}
#psSet .pss-scope select{width:auto;max-width:100%}
#psSet .pss-scope{background:var(--s-surface2);border:1px solid var(--s-border);border-radius:6px;padding:6px 9px;margin:6px 0}
#psSet .pss-why{font:12px var(--font-ui);color:var(--s-amberfg);margin:0 0 3px}
#psSet .pss-badge{display:inline-block;vertical-align:1px;margin-right:6px;padding:1px 6px;border-radius:9px;background:var(--s-amberbg);color:var(--s-amberfg);border:1px solid var(--s-amber);font:600 10.5px var(--font-ui);letter-spacing:.02em}
#psSet .pss-off{font:12.5px var(--font-ui);color:var(--s-muted);padding:5px 0}
#psSet .pss-off b{font-weight:600;color:var(--s-text)}
#psSet input[type=number],#psSet input[type=text],#psSet select{background:var(--s-input);color:var(--s-text);border-color:var(--s-inputb)}
#psSet input.bad,#psSet select.bad{background:#FEF2F2;color:#0F172A}
#psSet .unit,#psSet .note{color:var(--s-muted)}
#psSet a{color:var(--s-accent)}
#psSet .pss-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--s-border);background:var(--s-surface2);font-family:var(--font-ui);font-size:13px}
#psSet .pss-fn{flex:1;min-width:180px;color:var(--s-muted);font-size:12px}
#psSet .pss-foot button{border:1px solid var(--s-inputb);background:var(--s-surface);color:var(--s-text);border-radius:6px;padding:6px 14px;cursor:pointer;font:600 13px var(--font-ui)}
#psSet .pss-foot button.primary{background:var(--navy-800,#1E3A5F);border-color:var(--navy-800,#1E3A5F);color:#fff}
#psSet .pss-foot button:disabled{opacity:.5;cursor:default}
#psSet :focus-visible{outline:2px solid var(--blue-600,#2563EB);outline-offset:2px}
.pss-ph{font-family:var(--font-ui);font-size:9pt;color:#475569;margin:4px 0;padding:3px 8px;border-left:3px solid var(--blue-600,#2563EB);background:#EFF6FF}
@media (max-width:700px){
  #psSet{top:0;bottom:0;left:0;transform:none;width:100vw;border-radius:0;border:0}
  #psSet .pss-body{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
  #psSet nav.pss-side{display:flex;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid var(--s-border);padding:0 4px}
  #psSet nav.pss-side button{width:auto;flex:none;white-space:nowrap;border-left:0;border-bottom:3px solid transparent;padding:9px 10px}
  #psSet nav.pss-side button[aria-selected="true"]{border-bottom-color:var(--blue-600,#2563EB)}
  #psSet nav.pss-side .num{width:auto} #psSet nav.pss-side .cnt{margin-left:4px}
  #psSet .pss-pane{padding:4px 12px 16px}
  #psSet .pss-row .fRow>label:first-child{min-width:0;max-width:100%;flex:1 1 100%}
  #psSet .pss-fn{display:none} #psSet .pss-owner{max-height:34vh;overflow:auto}
}
@media print{#psSet,#psSetVeil,#psGear,.pss-ph{display:none!important}}`;
    document.head.appendChild(st);
  };
  const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  function build() {
    if (!root) return;
    css();
    root.innerHTML = `<div class="pss-head">${GEAR}<h2 id="psSetTitle">Settings<span class="sub">Prestressed Bridge Design</span></h2><button type="button" class="pss-x" id="psSetX" aria-label="Close without keeping the changes (Esc)" title="Close without keeping the changes (Esc)">&times;</button></div>
      <div class="pss-owner" id="psSetOwner"></div>
      <div class="pss-body"><nav class="pss-side" id="psSetSide" role="tablist" aria-orientation="vertical" aria-label="Settings groups"></nav><div class="pss-pane" id="psSetPane" role="tabpanel" tabindex="0"></div></div>
      <div class="pss-foot"><span class="pss-fn" id="psSetFn">Each change takes effect as you make it (Undo works as on the tabs). Cancel puts back the values from when this window opened.</span>
        <button type="button" id="psSetReset">Reset to owner defaults</button><button type="button" id="psSetCancel">Cancel</button><button type="button" class="primary" id="psSetSave">Save</button></div>`;
  }
  /* copyRow(el, x, m): the copy of an input's row for this window, with ids prefixed (pss-), the live values, and the error message under it */
  function copyRow(el, x, m) {
    const row = rowOf(el), c = row.cloneNode(true), frag = document.createDocumentFragment();
    c.classList.remove('pss-hide');
    const fix = n => { if (n.id) { n.dataset.pssId = n.id; n.id = 'pss-' + n.id; } if (n.htmlFor) n.htmlFor = 'pss-' + n.htmlFor; if (n.name) n.name = 'pss-' + n.name; };
    fix(c); c.querySelectorAll('[id],label[for],[name]').forEach(fix);
    const oF = [...row.querySelectorAll('input,select,textarea')], cF = [...c.querySelectorAll('input,select,textarea')];
    oF.forEach((o, i) => { const q = cF[i]; if (!q) return; if (o.type === 'checkbox' || o.type === 'radio') q.checked = o.checked; else q.value = o.value; MAP.set(q, o); q.__orig = o; q.__tab = x.t; q.addEventListener('change', onChange); });
    const oA = [...row.querySelectorAll('a,button')], cA = [...c.querySelectorAll('a,button')];   // a girder type's "reset" link (ui/types.js mark): clicked on the original
    oA.forEach((o, i) => { if (cA[i] && o.dataset.ty) MAP.set(cA[i], o); });
    const pf = (x.pre ? x.pre(m) : '') + (x.pfx || '');
    if (pf) { const lb = c.querySelector('label'); if (lb) lb.insertAdjacentText('afterbegin', pf); }
    frag.appendChild(c);
    for (let n = row.nextElementSibling; n && n.classList.contains('ic-msg'); n = n.nextElementSibling) { const q = n.cloneNode(true); q.classList.remove('pss-hide'); frag.appendChild(q); }
    if (x.note) { const nt = panes().querySelector(x.note); if (nt) { const q = nt.cloneNode(true); q.removeAttribute('id'); q.classList.remove('pss-hide'); frag.appendChild(q); } }
    return frag;
  }
  const scopeSel = () => panes() && panes().querySelector('#tyScope_mat');   // the app's "Entered values for" selector (ui/types.js scopeBar), drawn when the project has girder types
  function rowHtml(x) {
    const tab = x.t && TAB[x.t] ? TAB[x.t] : '';
    const per = SCOPED.includes(x.t) && scopeSel() ? `<div class="pss-meta">Entered for each girder type: the type chosen in “Entered values for” above (as on the ${esc(tab)} tab).</div>` : '';
    const meta = x.b ? `<div class="pss-why"><span class="pss-badge">Borderline</span>${esc(x.b)}${x.info ? '' : ` Also on the <a href="#" data-pssit="${x.t}">${esc(tab)} tab</a>; both edit the same input.`}</div>` : '';
    return per + meta;
  }
  function renderPane() {
    const pane = root.querySelector('#psSetPane'), G = groupOf(cur), cards = [];
    pane.innerHTML = `<h3 id="psSetH">${esc(G.name)}</h3><p class="intro">${esc(G.intro)}</p>`;
    pane.setAttribute('aria-labelledby', 'pss-tab-' + G.id);
    E.filter(x => x.g === cur).forEach(x => { let c = cards.find(q => q.h === x.c); if (!c) { c = { h: x.c, L: [] }; cards.push(c); } c.L.push(x); });
    const sc = scopeSel();
    if (sc && E.some(x => x.g === cur && SCOPED.includes(x.t))) {   // per-type values: the app's own selector above them (the same ui.scope as the tabs)
      const d = document.createElement('div'); d.className = 'pss-row pss-scope'; d.appendChild(copyRow(sc, { t: 'mat' }, null)); pane.appendChild(d); }
    cards.forEach(c => {
      const sec = document.createElement('section'); sec.className = 'sec'; sec.innerHTML = `<div class="secHead">${c.h}</div><div class="secBody"></div>`;
      const body = sec.querySelector('.secBody');
      c.L.forEach(x => {
        const O = originals(x);
        if (x.info) { const d = document.createElement('div'); d.className = 'pss-row bl'; d.dataset.pssk = x.k;
          d.innerHTML = `<div class="pss-off"><b>${x.l}</b>: on the <a href="#" data-pssout="${x.info}">${x.info === 'rt' ? 'Rating' : 'Constructibility'} output tab</a>, where it is used.</div>${rowHtml(x)}`; body.appendChild(d); return; }
        if (!O.length) { const d = document.createElement('div'); d.className = 'pss-row' + (x.b ? ' bl' : ''); d.dataset.pssk = x.k;
          d.innerHTML = `<div class="pss-off"><b>${x.l}</b>: not used now; drawn ${esc(x.w || 'when its input applies')}.</div>${rowHtml(x)}`; body.appendChild(d); return; }
        O.forEach(({ el, m }) => { const d = document.createElement('div'); d.className = 'pss-row' + (x.b ? ' bl' : ''); d.dataset.pssk = x.re ? el.dataset.path : x.k;
          d.appendChild(copyRow(el, x, m)); d.insertAdjacentHTML('beforeend', rowHtml(x)); body.appendChild(d); });
      });
      pane.appendChild(sec);
    });
  }
  function renderOwner() {
    const box = root.querySelector('#psSetOwner'), O = originals(OWNER), OW = window.PBD;
    box.innerHTML = '';
    if (!O.length) return;
    const own = O[0].el.value, R0 = OW && OW.OWN_RULES && OW.OWN_RULES.owners[own], man = R0 && R0.manual ? R0.manual : '';
    const d = document.createElement('div'); d.className = 'pss-row bl'; d.dataset.pssk = OWNER.k; d.appendChild(copyRow(O[0].el, OWNER, null));
    d.insertAdjacentHTML('beforeend', `<div class="pss-man">${esc(man)}</div>${rowHtml(OWNER)}`); box.appendChild(d);
  }
  function renderNav() {
    const side = root.querySelector('#psSetSide');
    side.innerHTML = GROUPS.map((G, i) => { const n = E.filter(x => x.g === G.id).length, ne = errCount(G.id);
      return `<button type="button" role="tab" id="pss-tab-${G.id}" aria-controls="psSetPane" aria-selected="${G.id === cur}" tabindex="${G.id === cur ? 0 : -1}" data-pssg="${G.id}"><span class="num">${i + 1}</span><span>${esc(G.name)}</span><span class="cnt">${n}</span>${ne ? `<span class="err" title="${ne} input${ne > 1 ? 's' : ''} to fix">${ne}</span>` : ''}</button>`; }).join('');
    const rs = root.querySelector('#psSetReset');   // Decision (pending engineer review): this app has no "apply the owner's defaults" action of its own
    if (rs) { rs.disabled = true; rs.title = 'Not in this app yet: choosing an owner sets each input still at the previous owner’s default to the new owner’s default (entered values are kept)'; }
  }
  /* render(): the window's owner bar, groups and pane, keeping the focused input and the pane's scroll */
  function render() {
    if (!root || !open) return;
    const a = document.activeElement, inR = a && root.contains(a);
    const fk = inR ? (a.dataset.pssId ? '#pss-' + a.dataset.pssId : a.id ? '#' + a.id : null) : null;
    const pane = root.querySelector('#psSetPane'), top = pane ? pane.scrollTop : 0;
    MAP.clear(); renderOwner(); renderNav(); renderPane();
    const p2 = root.querySelector('#psSetPane'); p2.scrollTop = top;
    if (fk) { let el = null; try { el = root.querySelector(fk.replace(/^#(.*)$/, (s, id) => '#' + CSS.escape(id))); } catch (e) { el = null; } if (el && el.focus) el.focus({ preventScroll: true }); }
  }
  /* hideOnTabs(): each moved input's row hidden on its tab (with its error message), and one line in its card that says where it went */
  function hideOnTabs() {
    const P = panes(); if (!P) return;
    P.querySelectorAll('.pss-ph').forEach(n => n.remove());
    const byCard = new Map();
    E.filter(moved).forEach(x => originals(x).forEach(({ el, m }) => {
      const row = rowOf(el); row.classList.add('pss-hide');
      for (let n = row.nextElementSibling; n && n.classList.contains('ic-msg'); n = n.nextElementSibling) n.classList.add('pss-hide');
      if (x.note) { const nt = P.querySelector(x.note); if (nt) nt.classList.add('pss-hide'); }
      const sec = row.closest('.sec') || row.parentElement; if (!byCard.has(sec)) byCard.set(sec, { first: row, G: new Map() });
      const q = byCard.get(sec), lb = row.querySelector('label'); if (!q.G.has(x.g)) q.G.set(x.g, []);
      q.G.get(x.g).push((x.pre && m ? x.pre(m) : '') + (x.pfx || '') + (lb ? lb.textContent.replace(/\s+/g, ' ').trim() : x.l.replace(/<[^>]+>/g, '')));
    }));
    byCard.forEach(q => {
      const p = document.createElement('p'); p.className = 'pss-ph';
      p.innerHTML = [...q.G].map(([g, L]) => `In <a href="#" data-psset="${g}">Settings › ${esc(groupOf(g).name)}</a>: ${L.map(esc).join('; ')}.`).join('<br>');
      q.first.parentElement.insertBefore(p, q.first);
    });
  }
  function gearState() {
    const b = document.getElementById('psGear'); if (!b) return;
    const n = movedErrs(); b.classList.toggle('has-err', n > 0); const d = b.querySelector('.pss-dot'); if (d) d.textContent = n ? String(n) : '';
    b.title = n ? `Settings (${n} input${n > 1 ? 's' : ''} to fix)` : 'Settings';
  }
  /* sync(errors): after every draw of the input tabs and every error check (index.html markErrors) */
  function sync(errors) {
    if (!api) return;
    if (errors) errs = errors;
    hideOnTabs(); gearState();
    if (open) { clearTimeout(tBuild); tBuild = setTimeout(render, 0); }   // after the event: the next field keeps the focus (Tab), the tooltips are on the rows
  }
  function setGroup(g, focusTab) {
    if (!groupOf(g)) return; cur = g; saveGroup(); render();
    const p = root.querySelector('#psSetPane'); if (p) p.scrollTop = 0;
    if (focusTab) { const b = root.querySelector('#pss-tab-' + g); if (b) { b.focus(); if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }
  }
  /* openAt(target, focus): opens the window at a group, or at the group of an input (its row shown, marked and focused) */
  function openAt(target) {
    if (!api) return;
    const G = groupOf(target), x = G ? null : entryOf(target);
    if (x === OWNER) target = null;
    if (!open) {
      prevFocus = document.activeElement; mk = api.mark(); open = true;
      const app = document.getElementById('app'); if (app) app.inert = true;
      document.getElementById('psSetVeil').hidden = false; root.hidden = false;
      api.redraw();   // the Auto design inputs are drawn while the window is open (index.html panes)
    }
    clearTimeout(tBuild);
    cur = G ? G.id : x && x.g ? x.g : cur; saveGroup(); render();
    const pane = root.querySelector('#psSetPane');
    const row = x && x !== OWNER ? root.querySelector(`.pss-row[data-pssk="${CSS.escape(String(target))}"]`) : null;
    if (row) { row.classList.add('hit'); row.scrollIntoView({ block: 'center' }); const f = row.querySelector('input:not([type=hidden]),select'); if (f) f.focus({ preventScroll: true }); setTimeout(() => row.classList.remove('hit'), 2400); }
    else { pane.scrollTop = 0; const f = root.querySelector('#psSetOwner select') || root.querySelector('#pss-tab-' + cur); if (f) f.focus(); }
  }
  function close(keep) {
    if (!open) return;
    clearTimeout(tBuild); open = false;
    const app = document.getElementById('app'); if (app) app.inert = false;
    root.hidden = true; document.getElementById('psSetVeil').hidden = true; MAP.clear(); root.querySelector('#psSetPane').innerHTML = ''; root.querySelector('#psSetOwner').innerHTML = '';   // no copies left while closed (one input per path on the page)
    if (!keep && mk) api.revert(mk);
    mk = null; api.redraw();
    const g = document.getElementById('psGear'); if (g) g.focus();
  }
  /* the copies: a change is handed to the original input (the app's own handler makes the edit). The listener is on the copy itself, so a
     change made just as the window redraws (the copy already replaced) still arrives; the original is found again by its id when the tabs
     were drawn again meanwhile. */
  function onChange(e) {
    const q = e.target; let o = MAP.get(q) || q.__orig; if (!o) return;
    e.stopPropagation();
    if (!o.isConnected && o.id) o = document.getElementById(o.id) || o;
    if (!o.isConnected) { render(); return; }
    if (o.type === 'checkbox' || o.type === 'radio') o.checked = q.checked; else o.value = q.value;
    /* the app's handler sends an edit to the girder type in scope only when the input tab shown is a per-type tab (index.html: TY.SCOPED
       includes ui.itab): the edit is made as on the input's own tab (api.editOn), so a per-type value goes to the type chosen and every other
       value to the project, whichever tab is open behind the window */
    const fire = () => o.dispatchEvent(new Event('change', { bubbles: true }));
    if (api.editOn) api.editOn(q.__tab, fire); else fire();
  }
  function onClick(e) {
    const t = e.target;
    { const a = t.closest('a,button'), o = a && MAP.get(a); if (o) { e.preventDefault(); e.stopPropagation(); if (o.isConnected) o.click(); return; } }
    if (t.closest('#psSetX') || t.closest('#psSetCancel')) { close(false); return; }
    if (t.closest('#psSetSave')) { close(true); return; }
    const g = t.closest('[data-pssg]'); if (g) { setGroup(g.dataset.pssg, true); return; }
    const it = t.closest('[data-pssit]'); if (it) { e.preventDefault(); close(true); const b = document.querySelector(`#inTabs [data-itab="${it.dataset.pssit}"]`); if (b) b.click(); return; }
    const ot = t.closest('[data-pssout]'); if (ot) { e.preventDefault(); close(true); const b = document.querySelector(`#tabBar [data-otab="${ot.dataset.pssout}"]`); if (b) b.click(); return; }
    const sl = t.closest('[data-psset]'); if (sl) { e.preventDefault(); e.stopPropagation(); openAt(sl.dataset.psset); }
  }
  const focusables = () => [...root.querySelectorAll('button,select,input,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(n => !n.disabled && n.offsetParent !== null && n.tabIndex >= 0);
  function onKey(e) {
    if (e.key === 'Escape') { const tip = document.getElementById('sbTipPop'); if (tip && !tip.hidden) return; e.preventDefault(); close(false); return; }
    if (e.key === 'Tab') { const F = focusables(); if (!F.length) return; const a = document.activeElement, i = F.indexOf(a);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); F[F.length - 1].focus(); } else if (!e.shiftKey && (i === F.length - 1 || i < 0)) { e.preventDefault(); F[0].focus(); } return; }
    const g = e.target.closest && e.target.closest('[data-pssg]');
    if (g && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const i = GROUPS.findIndex(G => G.id === cur), n = GROUPS.length;
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + n) % n;
      setGroup(GROUPS[j].id, true);
    }
  }
  /* init(o): o = { redraw() (the input tabs drawn again), mark() (the undo state now), revert(mark) (back to it), scopeOf(error) (the girder
     type of a type's own error shown) }; called once by index.html */
  function init(o) {
    api = o; css();
    const veil = document.createElement('div'); veil.id = 'psSetVeil'; veil.hidden = true; document.body.appendChild(veil);
    root = document.createElement('div'); root.id = 'psSet'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'psSetTitle');
    document.body.appendChild(root); build();
    root.addEventListener('click', onClick); root.addEventListener('keydown', onKey);
    veil.addEventListener('click', () => close(false));
    const hb = document.getElementById('hdrBtns');
    if (hb) { const b = document.createElement('button'); b.type = 'button'; b.id = 'psGear'; b.setAttribute('aria-label', 'Settings'); b.title = 'Settings';
      b.setAttribute('aria-haspopup', 'dialog'); b.innerHTML = GEAR + '<span class="pss-dot"></span>'; hb.appendChild(b); b.addEventListener('click', () => openAt(null)); }
    /* links to a moved input (an output tab, a worked step, a note): data-psset="<group or path>", or the Welds tab's data-gofld="<path>" */
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target.closest('[data-psset],[data-gofld]') : null; if (!t || (root.contains(t) && !t.dataset.psset)) return;
      const v = t.dataset.psset || t.dataset.gofld; if (!t.dataset.psset && !has(v)) return;
      e.preventDefault(); e.stopPropagation(); openAt(v);
    }, true);
  }
  /* goErr(e): an error banner link to a moved input opens this window at it (true: handled) */
  const goErr = e => { if (!e || e.host || !has(e.path)) return false; if (api.scopeOf) api.scopeOf(e); openAt(e.path); return true; };
  window.PSBSettings = { GROUPS, ENTRIES: E, OWNER, init, sync, has, entryOf, open: openAt, close, goErr, isOpen: () => open, UI_KEY };
})();
