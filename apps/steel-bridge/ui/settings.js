/* apps/steel-bridge/ui/settings.js — the Settings window (window.SBDSettings). Classic script; display and layout only.
   SET (2026-11-26; engineer's request 2026-11-26, the approved layout mockup and the list of inputs to move): a gear button in the app header
   opens one window with the settings that hold from bridge to bridge (code and owner policy, method choices, material constants, load factors
   and limits, the office's detailing standards), in nine groups (left tabs; top tabs on a phone), the owner (DOT) at the top.

   Nothing here stores, computes or converts a value. Every setting stays the input it was, at the same path of the project, drawn by the same
   code on its input tab: after each draw of the input tabs (index.html markErrors -> sync) the row of each moved input is hidden on its tab and
   a copy of it is shown in this window. A change to a copy is handed to the original input (its value, then a change event on it), so the
   app's own handler does the edit: the same path, kind, conversion, Undo / Redo step, dirty state and autosave as an edit on the tab.
   A "Borderline" item (a setting that may differ for one bridge) is not hidden on its tab: it shows in both places and both edit the same field.
     Save:   closes the window (each edit was applied as it was made).
     Cancel, ×, Esc: puts back the project as it was when the window opened (index.html revert: the undo steps made since then are dropped).
     Reset to owner defaults: the owner card's own "Apply <DOT> defaults" button (ui/loads.js), with its message of what changed.
   Per-browser UI state only: the last group shown, key sbd2.settingsGroup_v1 (CLAUDE.md §5: this app's prefix, never a generic key). */
(function () {
  'use strict';
  const UI_KEY = 'sbd2.settingsGroup_v1';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const TAB = { proj: 'Project', xsec: 'Cross-section', mat: 'Materials', framing: 'Framing & bracing', loads: 'Loads', stf: 'Stiffeners', fs: 'Fatigue & studs', spl: 'Splices', ad: 'Auto design' };
  const GROUPS = [
    ['own', 'Owner and load modifiers', 'The owner above sets its manual’s rules; the load modifiers sit with it.'],
    ['mat', 'Concrete and reinforcement', 'Material constants that hold for every bridge the office designs.'],
    ['sdl', 'Superimposed dead load', 'Unit weights and allowances, and how dead load is shared between the girders.'],
    ['lldf', 'Live-load distribution', 'Method choices for the distribution factors.'],
    ['comp', 'Composite section', 'How the deck works with the girder.'],
    ['deck', 'Deck design', 'Office standards for the deck slab (the optional deck design).'],
    ['anl', 'Analysis and limit states', 'Method choices, factors and limits used in the analysis and the checks.'],
    ['det', 'Detailing standards', 'The office’s standard details: cross-frames, stiffeners, studs and field splices.'],
    ['ad', 'Auto design', 'Search limits and costs of Auto design.']
  ].map(([id, name, intro]) => ({ id, name, intro }));

  /* ---------- the registry: one entry per input shown here ----------
     k: the project path (error marks and links; data-path where the input has one), s: the input's selector on its tab, g: group, c: card,
     t: the input tab it is drawn on, l: a short label (used when the input is not drawn now), w: when it is drawn, b: borderline (the reason;
     the input also stays on its tab), re: a pattern of paths (inputs drawn once per stiffener type), info: an output-tab item (not moved). */
  const E = [];
  const dp = p => `[data-path="${p}"]`;
  const add = (g, c, t, list) => list.forEach(x => E.push(Object.assign({ g, c, t, s: x.s || dp(x.k) }, x)));
  const an = (k, l, x) => Object.assign({ k: 'analysis.' + k, s: '#an_a_' + k, l }, x || {});
  const ad = (k, l, x) => Object.assign({ k: 'autodesign.' + k, s: `[data-ad="${k}"]`, l }, x || {});
  const dk = (k, l, x) => Object.assign({ k: 'deckDesign.' + k, s: '#dk_' + k, l }, x || {});
  const DK_ON = 'with the deck design on (Cross-section tab, Deck design)';
  const AASHTO_ONLY = 'when the owner is AASHTO';

  add('own', 'Load modifiers (1.3.2)', 'proj', [
    { k: 'ownerRules.eta.eD', l: 'η<sub>D</sub>', w: AASHTO_ONLY }, { k: 'ownerRules.eta.eR', l: 'η<sub>R</sub>', w: AASHTO_ONLY }, { k: 'ownerRules.eta.eI', l: 'η<sub>I</sub>', w: AASHTO_ONLY },
    { k: 'ownerRules.eta.D', l: 'Nonductile components (η<sub>D</sub>)', w: 'when the owner asks it', b: 'The answer describes this bridge.' },
    { k: 'ownerRules.eta.R', l: 'Nonredundant (η<sub>R</sub>)', w: 'when the owner asks it', b: 'The answer describes this bridge.' },
    { k: 'ownerRules.eta.I', l: 'Operational importance (η<sub>I</sub>)', w: 'when the owner asks it', b: 'The answer describes this bridge.' }]);
  add('mat', 'Deck concrete', 'mat', [
    { k: 'materials.concrete.fc', l: 'f′<sub>c</sub>', b: 'An office standard, but one bridge can call for a different strength.' },
    { k: 'materials.concrete.wc', l: 'w<sub>c</sub>' }, { k: 'materials.concrete.wcE', l: 'w<sub>c</sub> for E<sub>c</sub> only' },
    { k: 'materials.concrete.K1', l: 'K<sub>1</sub>' }, { k: 'materials.concrete.nRule', l: 'Modular ratio n' }]);
  add('mat', 'Steel and reinforcement', 'mat', [
    { k: 'materials.Es', l: 'E<sub>s</sub>' },
    { k: 'materials.steel.top', l: 'Top flange grade', b: 'An office default, but the plates of one bridge can use another grade.' },
    { k: 'materials.steel.bot', l: 'Bottom flange grade', b: 'An office default, but the plates of one bridge can use another grade.' },
    { k: 'materials.steel.web', l: 'Web grade', b: 'An office default, but the plates of one bridge can use another grade.' },
    { k: 'materials.rebar.Fyr', l: 'Rebar F<sub>yr</sub>' }]);
  add('sdl', 'Unit weights and loads', 'xsec', [
    { k: 'xs.edges.L.bGam', l: 'Left deck edge: barrier unit weight γ', w: 'with the left barrier weight from its geometry' },
    { k: 'xs.edges.R.bGam', l: 'Right deck edge: barrier unit weight γ', w: 'with the right barrier weight from its geometry' },
    { k: 'xs.wcA', l: 'Curb / sidewalk / median concrete' }, { k: 'xs.sidewalks.ped', l: 'Pedestrian load' }]);
  add('sdl', 'Unit weights and loads', 'loads', [
    { k: 'xs.ws.psf', l: 'Future wearing surface', w: 'with the wearing surface entered as a weight', b: 'The owner sets a usual value, but each bridge’s overlay can differ.' }]);
  add('sdl', 'Steel allowances', 'loads', [{ k: 'xs.sip', l: 'Stay-in-place forms' }, { k: 'xs.allow', l: 'Steel detail allowance' }]);
  add('sdl', 'Steel allowances', 'framing', [{ k: 'crossframes.weight.mode', l: 'Cross-frame weight in DC1' }, { k: 'crossframes.weight.allow', l: 'Gusset plates and bolts' }]);
  add('sdl', 'Sharing dead load between girders', 'loads', [{ k: 'xs.dlMethod', l: 'Dead load distribution' }]);
  add('lldf', 'Distribution factors', 'loads', [
    { k: 'xs.lldf.gap', l: 'Gap between adjacent trucks' }, { k: 'xs.lldf.kg', l: 'K<sub>g</sub>' }, { k: 'xs.lldf.skewV', l: 'Shear skew correction' },
    { k: 'xs.lldf.skewVx', l: 'Shear skew correction along the girder', note: '#ld-skewvx-note' }, { k: 'xs.lldf.extMin', l: 'Exterior not less than interior' }]);
  add('lldf', 'Distribution factors', 'fs', [{ k: 'fatigue.p', l: 'Lane fraction p', b: 'Depends on the lane layout of this bridge.' }]);
  add('comp', 'Section properties', 'xsec', [{ k: 'deck.rebarInPositiveMp', l: 'Deck rebar in positive M<sub>p</sub>' }]);
  add('comp', 'Section properties', 'loads', [an('haunchInStiffness', 'Haunch in the composite stiffness'), an('seqMod', 'Hardened pours act with', { w: 'with the deck placement sequence on' })]);
  add('deck', 'Deck slab', 'xsec', [
    dk('on', 'Deck design (strip method)', { b: 'Some bridges reuse a standard deck, so this may be a switch on each bridge.' }),
    dk('xnegAuto', 'Negative-moment design section', { w: DK_ON }), dk('coverT', 'Top clear cover', { w: DK_ON }), dk('coverB', 'Bottom clear cover', { w: DK_ON }),
    dk('exposure', 'Crack control exposure (5.6.7)', { w: DK_ON, b: 'Depends on the site and on deicing salts.' })]);
  add('deck', 'Deck slab', null, [{ k: 'rating.phi', info: 'rt', l: 'Load rating resistance factors φ<sub>c</sub>, φ<sub>s</sub>', b: 'Rarely changed; kept on the Rating output tab, where they are used (not moved).' }]);
  add('anl', 'Live load', 'loads', [an('im', 'IM, truck and tandem'), an('imf', 'IM, fatigue truck'), an('clCalc', 'Calculate the construction live load'),
    an('qCL', 'Construction live load on the deck q<sub>CL</sub>', { w: 'with the construction live load calculated' })]);
  add('anl', 'Live load', null, [{ k: 'rating.vehicles', info: 'rt', l: 'Legal and permit vehicles, IM', b: 'Follows the owner’s rating vehicles; kept on the Rating output tab (not moved).' }]);
  add('anl', 'Wind on the exterior girder', 'loads', [
    { k: 'crossframes.wind.V', l: 'Design wind speed V', b: 'Comes from the wind map for the site.' },
    { k: 'crossframes.wind.Kz', l: 'K<sub>z</sub>' }, { k: 'crossframes.wind.G', l: 'Gust factor G' }, { k: 'crossframes.wind.Cd', l: 'Drag coefficient C<sub>D</sub>' }]);
  add('anl', 'Analysis model', 'loads', [an('crack', 'Cracked zones (6.10.1.5)'), an('seq', 'Deck placement sequence (6.10.3.4.1)')]);
  add('anl', 'Analysis model', 'stf', [{ k: 'stiffeners.bearing.ed', l: 'Bearing ℄ to the girder end (abutments)', b: 'Set by the bearing detail of this bridge.' }]);
  add('anl', 'Deflection', 'loads', [an('deflLimit', 'LL deflection limit L/'), an('deflSidewalk', 'Sidewalk or pedestrians, owner LL deflection limit (OWN19)')]);
  add('anl', 'Fatigue', 'fs', [
    { k: 'fatigue.limit', l: 'Fatigue limit state' }, { k: 'fatigue.life', l: 'Design life' }, { k: 'fatigue.gam.fI', l: 'γ Fatigue I' }, { k: 'fatigue.gam.fII', l: 'γ Fatigue II' },
    { k: 'fatigue.catT', l: 'Top flange category (GS17)' }, { k: 'fatigue.catB', l: 'Bottom flange category (GS17)' }, { k: 'fatigue.negSec', l: 'Negative-moment section at the details' }]
    .concat([['cp', 'Connection plates attached to both flanges'], ['skew', 'Skewed or oblique welded attachments'], ['lat', 'Lateral bracing'], ['latLoc', 'Lateral connection plates on'],
      ['latStiff', 'Web stiffened at the plate'], ['latDist', 'Vertical distance from flange'], ['latBf', 'Flange width at the plate']]
      .map(([k, l]) => ({ k: 'fatigue.dist.' + k, l: 'Distortion-induced fatigue: ' + l, w: 'when the bridge has the detail', b: 'The answers describe the framing of this bridge.' }))));
  add('anl', 'Construction', 'framing', [
    { k: 'crossframes.sb.on', l: 'Check stability bracing', b: 'Depends on the spans and framing of this bridge.' },
    { k: 'crossframes.sb.Cb', l: 'C<sub>b</sub> (stability bracing)', w: 'with the stability bracing check on', b: 'Depends on the spans and framing of this bridge.' }]);
  add('anl', 'Construction', 'loads', [
    { k: 'analysis.fm.P', s: '#an_fm_P', l: 'Finishing machine load P<sub>fm</sub>', b: 'Depends on the contractor’s equipment.' },
    { k: 'analysis.fm.e', s: '#an_fm_e', l: 'Finishing machine load from its deck edge e<sub>fm</sub>', b: 'Depends on the contractor’s equipment.' }]);
  add('anl', 'Construction', null, [{ k: 'constr.bracket', info: 'cn', l: 'Overhang bracket inputs', b: 'Depend on the contractor’s equipment; kept on the Constructibility output tab (not moved).' }]);
  add('det', 'Cross-frames and diaphragms', 'framing', [
    { k: 'framing.supClear', l: 'Clear distance from the bearings' }, { k: 'framing.stagMin', l: 'Least offset between frames on one girder' },
    { k: 'framing.spliceClear', l: 'Frames clear of splices and transitions' },
    { k: 'framing.orient', l: 'Orientation', b: 'Depends on the skew of this bridge.' }, { k: 'framing.arrange', l: 'Normal frames', w: 'with frames normal to the girders', b: 'Depends on the skew of this bridge.' },
    { k: 'crossframes.dMinXF', l: 'Minimum girder depth for cross-frames' }, { k: 'crossframes.dia.clr', l: 'Diaphragm fit clearance c', w: 'with diaphragms' },
    { k: 'crossframes.primary', l: 'Primary members', w: 'with cross-frames' }, { k: 'crossframes.gA', l: 'Angle grade', w: 'with cross-frames' },
    { k: 'crossframes.gG', l: 'Gusset grade', w: 'with cross-frames' }, { k: 'crossframes.dia.gr', l: 'Diaphragm grade', w: 'with diaphragms' },
    { k: 'crossframes.conn.d', l: 'Connection bolt diameter', pfx: 'Connection bolts: ' }, { k: 'crossframes.conn.gr', l: 'Connection bolt grade', pfx: 'Connection bolts: ' },
    { k: 'crossframes.conn.thr', l: 'Connection bolt threads', pfx: 'Connection bolts: ' },
    { k: 'crossframes.conn.n', pfx: 'Connection: ', l: 'Bolts per member end', w: 'with cross-frames', b: 'An office standard, but a deep or heavily skewed bridge may need more.' },
    { k: 'crossframes.conn.s', pfx: 'Connection: ', l: 'Pitch', w: 'with cross-frames', b: 'An office standard, but a deep or heavily skewed bridge may need more.' },
    { k: 'crossframes.conn.e', pfx: 'Connection: ', l: 'End distance', w: 'with cross-frames', b: 'An office standard, but a deep or heavily skewed bridge may need more.' },
    { k: 'crossframes.conn.tg', pfx: 'Connection: ', l: 'Gusset thickness', w: 'with cross-frames', b: 'An office standard, but a deep or heavily skewed bridge may need more.' },
    { k: 'crossframes.fatCat', l: 'Member end fatigue detail category', w: 'with cross-frames' }]);
  add('det', 'Flange lateral bending from skew, f<sub>ℓ</sub> (C6.10.1)', 'framing', [
    { k: 'framing.flSkI', l: 'f<sub>ℓ</sub>, interior girders' }, { k: 'framing.flSkE', l: 'f<sub>ℓ</sub>, exterior girders near the supports' },
    { k: 'framing.flSkE2', l: 'f<sub>ℓ</sub>, exterior girders over the whole span' }, { k: 'framing.flSkG', l: 'Load factor on f<sub>ℓ</sub>' }]);
  const tyLab = (side, k) => { const n = document.querySelector(`#inPanes [data-path="stiffeners.${side}.types.${k}.name"]`); return `${side === 'bearing' ? 'Bearing' : 'Transverse'} type ${k}${n && n.value ? ' (' + n.value + ')' : ''}: `; };
  add('det', 'Stiffeners', 'stf', [
    { k: 'stiffeners.transverse.gS', l: 'Transverse stiffener plate grade', pfx: 'Transverse stiffeners: ' }, { k: 'stiffeners.transverse.Fexx', l: 'Transverse stiffener electrode F<sub>EXX</sub>', pfx: 'Transverse stiffeners: ' },
    { k: 'stiffeners.transverse.types.*', re: /^stiffeners\.transverse\.types\.([^.]+)\.(w|gap|wf|c)$/, s: '[data-path^="stiffeners.transverse.types."]', l: 'Transverse stiffener welds and clips (per type)', pre: m => tyLab('transverse', m[1]) },
    { k: 'stiffeners.bearing.gS', l: 'Bearing stiffener plate grade', pfx: 'Bearing stiffeners: ' }, { k: 'stiffeners.bearing.Fexx', l: 'Bearing stiffener electrode F<sub>EXX</sub>', pfx: 'Bearing stiffeners: ' },
    { k: 'stiffeners.bearing.types.*', re: /^stiffeners\.bearing\.types\.([^.]+)\.(c|w|conn)$/, s: '[data-path^="stiffeners.bearing.types."]', l: 'Bearing stiffener clip, weld and bottom flange connection (per type)', pre: m => tyLab('bearing', m[1]) }]);
  add('det', 'Shear studs', 'fs', [
    { k: 'studs.d', l: 'Stud diameter' }, { k: 'studs.h', l: 'Stud height h' }, { k: 'studs.st', l: 'Transverse spacing s<sub>t</sub>' }, { k: 'studs.Fu', l: 'Stud F<sub>u</sub>' },
    { k: 'studs.Qn10', l: 'Q<sub>n</sub> entered' }, { k: 'studs.skew', l: 'Radial term F<sub>fat</sub>' }, { k: 'studs.splC', l: 'Clearance at each splice plate end' },
    { k: 'studs.beffMode', l: 'b<sub>eff</sub> for the studs' }]);
  add('det', 'Field splices', 'spl', [
    { k: 'splices.code', l: 'Design forces' }, { k: 'splices.auto', l: 'Plates and bolts' }, { k: 'splices.gP', l: 'Splice plate grade' }, { k: 'splices.prs', l: 'Deck reinforcement in the negative couple' }]
    .concat([['d', 'Diameter'], ['gr', 'Grade'], ['thr', 'Threads'], ['cls', 'Faying surface'], ['prep', 'Holes'], ['edge', 'Plate edges'], ['gap', 'Gap between girder ends'],
      ['minLines', 'Minimum bolt lines each side of the web'], ['c1', 'Wrench clearance C₁'], ['long', '0.83 long-joint reduction'], ['eccS', 'Web eccentricity, strength'],
      ['eccV', 'Web eccentricity, slip'], ['stitch', 'Stitch bolt limits (6.13.2.6.3)']].map(([k, l]) => ({ k: 'splices.bolts.' + k, l: 'Splice bolts: ' + l, pfx: ['d', 'gr', 'thr'].includes(k) ? 'Bolts: ' : '' })))
    .concat([{ k: 'splices.clr.cw', l: 'Inner plate clearance to the web plate' }, { k: 'splices.clr.cv', l: 'Web plate clearance to each flange' }]));
  const ADB = 'Chosen for each bridge’s design run.';
  add('ad', 'Search', 'ad', [ad('mode', 'Mode', { b: ADB }), ad('objective', 'Objective', { b: ADB }), ad('topN', 'Designs to list'),
    ad('limits.Dmin', 'Web depth, min.', { b: ADB }), ad('limits.Dmax', 'Web depth, max.', { b: ADB }),
    ad('limits.depthRule', 'Minimum depth (Table 2.5.2.6.3-1)'), ad('limits.depthWarn', 'Span-to-depth guidance as warning only'), ad('limits.propWarn', '6.10.2 proportion limits as warning only')]);
  add('ad', 'Costs', 'ad', [ad('cost.steel', 'Steel'), ad('cost.trans', 'Flange transition'), ad('cost.splice', 'Field splice'), ad('cost.stiff', 'Intermediate stiffener')]);
  add('ad', 'Plate sizes and limits', 'ad', [ad('limits.Dinc', 'Web depth increment'), ad('limits.twMin', 'Web thickness, min.'), ad('limits.twInc', 'Web thickness increment'),
    ad('limits.tfMin', 'Flange thickness, min.'), ad('limits.tfMax', 'Flange thickness, max.'), ad('limits.tfInc', 'Flange thickness increment'),
    ad('limits.bfMin', 'Flange width, min.'), ad('limits.bfInc', 'Flange width increment'), ad('limits.thkRatio', 'Thickness ratio at a transition, max.'),
    ad('limits.maxTrans', 'Transitions per field piece and flange'), ad('limits.minSeg', 'Shortest flange zone'), ad('limits.maxDb', 'Width change at a field splice, max.'),
    ad('limits.topConst', 'Top flange width')]);
  const OWNER = { k: 'ownerRules.owner', s: dp('ownerRules.owner'), t: 'proj', b: 'The office’s usual owner, but a bridge for another DOT needs a different one, so each bridge keeps its own.' };

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
    if (document.getElementById('sbs-css')) return;
    const st = document.createElement('style'); st.id = 'sbs-css';
    st.textContent = `
#sbSet,#sbSetVeil{--s-surface:#fff;--s-surface2:#F1F3F5;--s-border:#E4E7EB;--s-text:#0F172A;--s-muted:#64748B;--s-tab:#475569;--s-accent:#1E3A5F;--s-input:#fff;--s-inputb:#CBD5E1;
  --s-amber:#B45309;--s-amberbg:#FEF3C7;--s-amberfg:#92400E;--s-shadow:0 18px 48px rgba(15,23,42,.28);--s-veil:rgba(15,23,42,.42);color-scheme:light}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]) #sbSet,:root:not([data-theme="light"]) #sbSetVeil{--s-surface:#18202c;--s-surface2:#202a38;--s-border:#334155;--s-text:#E5E7EB;--s-muted:#94A3B8;--s-tab:#CBD5E1;
  --s-accent:#BFD3F2;--s-input:#0f1622;--s-inputb:#475569;--s-amber:#F59E0B;--s-amberbg:#3a2a0e;--s-amberfg:#FCD34D;--s-shadow:0 18px 48px rgba(0,0,0,.55);--s-veil:rgba(0,0,0,.55);color-scheme:dark}}
:root[data-theme="dark"] #sbSet,:root[data-theme="dark"] #sbSetVeil{--s-surface:#18202c;--s-surface2:#202a38;--s-border:#334155;--s-text:#E5E7EB;--s-muted:#94A3B8;--s-tab:#CBD5E1;
  --s-accent:#BFD3F2;--s-input:#0f1622;--s-inputb:#475569;--s-amber:#F59E0B;--s-amberbg:#3a2a0e;--s-amberfg:#FCD34D;--s-shadow:0 18px 48px rgba(0,0,0,.55);--s-veil:rgba(0,0,0,.55);color-scheme:dark}
.sbs-hide{display:none!important}
#hdrBtns button#sbGear{display:inline-flex;align-items:center;justify-content:center;gap:4px;width:auto;min-width:34px;height:28px;padding:0 7px;border-color:rgba(255,255,255,.6);background:rgba(255,255,255,.14);position:relative}
#hdrBtns button#sbGear:hover{background:rgba(255,255,255,.26)} #sbGear svg{width:18px;height:18px;flex:none}
#sbGear .sbs-dot{display:none;min-width:15px;padding:0 4px;border-radius:8px;background:var(--fail,#DC2626);color:#fff;font-size:7.5pt;font-weight:700;line-height:14px}
#sbGear.has-err .sbs-dot{display:inline-block}
#sbSetVeil{position:fixed;inset:0;background:var(--s-veil);z-index:44}
#sbSet{position:fixed;z-index:45;top:14px;bottom:14px;left:50%;transform:translateX(-50%);width:min(1000px,calc(100vw - 28px));display:flex;flex-direction:column;
  background:var(--s-surface);color:var(--s-text);border:1px solid var(--s-border);border-radius:10px;box-shadow:var(--s-shadow);overflow:hidden;font-family:var(--font-doc);font-size:10pt}
#sbSet[hidden],#sbSetVeil[hidden]{display:none!important}
#sbSet .sbs-head{display:flex;align-items:center;gap:10px;padding:10px 14px;background:var(--navy-800,#1E3A5F);color:#fff;font-family:var(--font-ui)}
#sbSet .sbs-head svg{width:18px;height:18px;flex:none} #sbSet .sbs-head h2{margin:0;font-size:16px;font-weight:600;flex:1;min-width:0}
#sbSet .sbs-head .sub{font-weight:400;color:#C7D4E4;font-size:12px;margin-left:6px}
#sbSet .sbs-x{border:0;background:transparent;color:#fff;font-size:22px;line-height:1;cursor:pointer;padding:2px 6px;border-radius:5px} #sbSet .sbs-x:hover{background:rgba(255,255,255,.15)}
#sbSet .sbs-owner{padding:8px 14px;border-bottom:1px solid var(--s-border);background:var(--s-surface2);font-family:var(--font-ui);font-size:13px}
#sbSet .sbs-owner .fRow{margin:0} #sbSet .sbs-owner .fRow>label{font-weight:600;min-width:0}
#sbSet .sbs-man{color:var(--s-muted);font-size:12px}
#sbSet .sbs-body{flex:1;min-height:0;display:grid;grid-template-columns:240px minmax(0,1fr)}
#sbSet nav.sbs-side{border-right:1px solid var(--s-border);background:var(--s-surface2);overflow:auto;padding:8px 0}
#sbSet nav.sbs-side button{display:flex;align-items:center;gap:8px;width:100%;text-align:left;border:0;border-left:3px solid transparent;border-radius:0;background:none;padding:9px 12px 9px 11px;font:13px var(--font-ui);color:var(--s-tab);cursor:pointer}
#sbSet nav.sbs-side button:hover{background:var(--s-surface)}
#sbSet nav.sbs-side button[aria-selected="true"]{background:var(--s-surface);color:var(--s-accent);font-weight:600;border-left-color:var(--blue-600,#2563EB)}
#sbSet nav.sbs-side .num{flex:none;width:18px;color:var(--s-muted);font-weight:400} #sbSet nav.sbs-side .cnt{margin-left:auto;font-size:11px;font-weight:400;color:var(--s-muted);white-space:nowrap}
#sbSet nav.sbs-side .err{margin-left:4px;min-width:15px;padding:0 4px;border-radius:8px;background:var(--fail,#DC2626);color:#fff;font-size:10px;font-weight:700;line-height:14px;text-align:center}
#sbSet .sbs-pane{overflow:auto;padding:6px 16px 18px;min-width:0}
#sbSet .sbs-pane h3{font:600 15px var(--font-ui);margin:10px 0 2px;color:var(--s-accent)} #sbSet .sbs-pane .intro{font:13px var(--font-ui);color:var(--s-muted);margin:0 0 4px}
#sbSet .sec{background:var(--s-surface);border-color:var(--s-border)} #sbSet .sec>.secHead{background:var(--s-surface2);border-color:var(--s-border);color:var(--s-tab)}
#sbSet .sbs-row{padding:3px 0 3px 9px;border-bottom:1px dashed var(--s-border);border-left:3px solid transparent}
#sbSet .sbs-row:last-child{border-bottom:0}
#sbSet .sbs-row.bl{border-left-color:var(--s-amber);background:linear-gradient(90deg,var(--s-amberbg),transparent 70%)}
#sbSet .sbs-row.hit{outline:2px solid var(--blue-600,#2563EB);outline-offset:-2px;background:rgba(37,99,235,.08)}
#sbSet .sbs-row .fRow>label:first-child{min-width:220px;max-width:calc(100% - 150px)}
#sbSet .sbs-row .ad-ck{display:flex;gap:6px;align-items:flex-start;margin:4px 0}
#sbSet .sbs-meta{font:11.5px var(--font-ui);color:var(--s-muted);margin:0 0 3px}
#sbSet .sbs-why{font:12px var(--font-ui);color:var(--s-amberfg);margin:0 0 3px}
#sbSet .sbs-badge{display:inline-block;vertical-align:1px;margin-right:6px;padding:1px 6px;border-radius:9px;background:var(--s-amberbg);color:var(--s-amberfg);border:1px solid var(--s-amber);font:600 10.5px var(--font-ui);letter-spacing:.02em}
#sbSet .sbs-off{font:12.5px var(--font-ui);color:var(--s-muted);padding:5px 0}
#sbSet .sbs-off b{font-weight:600;color:var(--s-text)}
#sbSet input[type=number],#sbSet input[type=text],#sbSet select{background:var(--s-input);color:var(--s-text);border-color:var(--s-inputb)}
#sbSet input.bad,#sbSet select.bad{background:#FEF2F2;color:#0F172A}
#sbSet .unit,#sbSet .note{color:var(--s-muted)}
#sbSet a{color:var(--s-accent)}
#sbSet .sbs-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--s-border);background:var(--s-surface2);font-family:var(--font-ui);font-size:13px}
#sbSet .sbs-fn{flex:1;min-width:180px;color:var(--s-muted);font-size:12px}
#sbSet .sbs-foot button{border:1px solid var(--s-inputb);background:var(--s-surface);color:var(--s-text);border-radius:6px;padding:6px 14px;cursor:pointer;font:600 13px var(--font-ui)}
#sbSet .sbs-foot button.primary{background:var(--navy-800,#1E3A5F);border-color:var(--navy-800,#1E3A5F);color:#fff}
#sbSet .sbs-foot button:disabled{opacity:.5;cursor:default}
#sbSet :focus-visible{outline:2px solid var(--blue-600,#2563EB);outline-offset:2px}
.sbs-ph{font-family:var(--font-ui);font-size:9pt;color:#475569;margin:4px 0;padding:3px 8px;border-left:3px solid var(--blue-600,#2563EB);background:#EFF6FF}
@media (max-width:700px){
  #sbSet{top:0;bottom:0;left:0;transform:none;width:100vw;border-radius:0;border:0}
  #sbSet .sbs-body{grid-template-columns:1fr;grid-template-rows:auto minmax(0,1fr)}
  #sbSet nav.sbs-side{display:flex;overflow-x:auto;overflow-y:hidden;border-right:0;border-bottom:1px solid var(--s-border);padding:0 4px}
  #sbSet nav.sbs-side button{width:auto;flex:none;white-space:nowrap;border-left:0;border-bottom:3px solid transparent;padding:9px 10px}
  #sbSet nav.sbs-side button[aria-selected="true"]{border-bottom-color:var(--blue-600,#2563EB)}
  #sbSet nav.sbs-side .num{width:auto} #sbSet nav.sbs-side .cnt{margin-left:4px}
  #sbSet .sbs-pane{padding:4px 12px 16px}
  #sbSet .sbs-row .fRow>label:first-child{min-width:0;max-width:100%;flex:1 1 100%}
  #sbSet .sbs-fn{display:none} #sbSet .sbs-owner{max-height:34vh;overflow:auto}
}
@media print{#sbSet,#sbSetVeil,#sbGear,.sbs-ph{display:none!important}}`;
    document.head.appendChild(st);
  };
  const GEAR = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';

  function build() {
    if (!root) return;
    css();
    root.innerHTML = `<div class="sbs-head">${GEAR}<h2 id="sbSetTitle">Settings<span class="sub">Steel Bridge Design</span></h2><button type="button" class="sbs-x" id="sbSetX" aria-label="Close without keeping the changes (Esc)" title="Close without keeping the changes (Esc)">&times;</button></div>
      <div class="sbs-owner" id="sbSetOwner"></div>
      <div class="sbs-body"><nav class="sbs-side" id="sbSetSide" role="tablist" aria-orientation="vertical" aria-label="Settings groups"></nav><div class="sbs-pane" id="sbSetPane" role="tabpanel" tabindex="0"></div></div>
      <div class="sbs-foot"><span class="sbs-fn" id="sbSetFn">Each change takes effect as you make it (Undo works as on the tabs). Cancel puts back the values from when this window opened.</span>
        <button type="button" id="sbSetReset">Reset to owner defaults</button><button type="button" id="sbSetCancel">Cancel</button><button type="button" class="primary" id="sbSetSave">Save</button></div>`;
  }
  /* copyRow(el, x, m): the copy of an input's row for this window, with ids prefixed (sbs-), the live values, and the error message under it */
  function copyRow(el, x, m) {
    const row = rowOf(el), c = row.cloneNode(true), frag = document.createDocumentFragment();
    c.classList.remove('sbs-hide');
    const fix = n => { if (n.id) { n.dataset.sbsId = n.id; n.id = 'sbs-' + n.id; } if (n.htmlFor) n.htmlFor = 'sbs-' + n.htmlFor; if (n.name) n.name = 'sbs-' + n.name; };
    fix(c); c.querySelectorAll('[id],label[for],[name]').forEach(fix);
    const oF = [...row.querySelectorAll('input,select,textarea')], cF = [...c.querySelectorAll('input,select,textarea')];
    oF.forEach((o, i) => { const q = cF[i]; if (!q) return; if (o.type === 'checkbox' || o.type === 'radio') q.checked = o.checked; else q.value = o.value; MAP.set(q, o); q.__orig = o; q.addEventListener('change', onChange); });
    const pf = (x.pre ? x.pre(m) : '') + (x.pfx || '');
    if (pf) { const lb = c.querySelector('label'); if (lb) lb.insertAdjacentText('afterbegin', pf); }
    frag.appendChild(c);
    for (let n = row.nextElementSibling; n && n.classList.contains('ic-msg'); n = n.nextElementSibling) { const q = n.cloneNode(true); q.classList.remove('sbs-hide'); frag.appendChild(q); }
    if (x.note) { const nt = panes().querySelector(x.note); if (nt) { const q = nt.cloneNode(true); q.removeAttribute('id'); q.classList.remove('sbs-hide'); frag.appendChild(q); } }
    return frag;
  }
  function rowHtml(x) {
    const tab = x.t && TAB[x.t] ? TAB[x.t] : '';
    const meta = x.b ? `<div class="sbs-why"><span class="sbs-badge">Borderline</span>${esc(x.b)}${x.info ? '' : ` Also on the <a href="#" data-sbsit="${x.t}">${esc(tab)} tab</a>; both edit the same input.`}</div>` : '';
    return meta;
  }
  function renderPane() {
    const pane = root.querySelector('#sbSetPane'), G = groupOf(cur), cards = [];
    pane.innerHTML = `<h3 id="sbSetH">${esc(G.name)}</h3><p class="intro">${esc(G.intro)}</p>`;
    pane.setAttribute('aria-labelledby', 'sbs-tab-' + G.id);
    E.filter(x => x.g === cur).forEach(x => { let c = cards.find(q => q.h === x.c); if (!c) { c = { h: x.c, L: [] }; cards.push(c); } c.L.push(x); });
    cards.forEach(c => {
      const sec = document.createElement('section'); sec.className = 'sec'; sec.innerHTML = `<div class="secHead">${c.h}</div><div class="secBody"></div>`;
      const body = sec.querySelector('.secBody');
      c.L.forEach(x => {
        const O = originals(x);
        if (x.info) { const d = document.createElement('div'); d.className = 'sbs-row bl'; d.dataset.sbsk = x.k;
          d.innerHTML = `<div class="sbs-off"><b>${x.l}</b>: on the <a href="#" data-sbsout="${x.info}">${x.info === 'rt' ? 'Rating' : 'Constructibility'} output tab</a>, where it is used.</div>${rowHtml(x)}`; body.appendChild(d); return; }
        if (!O.length) { const d = document.createElement('div'); d.className = 'sbs-row' + (x.b ? ' bl' : ''); d.dataset.sbsk = x.k;
          d.innerHTML = `<div class="sbs-off"><b>${x.l}</b>: not used now; drawn ${esc(x.w || 'when its input applies')}.</div>${rowHtml(x)}`; body.appendChild(d); return; }
        O.forEach(({ el, m }) => { const d = document.createElement('div'); d.className = 'sbs-row' + (x.b ? ' bl' : ''); d.dataset.sbsk = x.re ? el.dataset.path : x.k;
          d.appendChild(copyRow(el, x, m)); d.insertAdjacentHTML('beforeend', rowHtml(x)); body.appendChild(d); });
      });
      pane.appendChild(sec);
    });
  }
  function renderOwner() {
    const box = root.querySelector('#sbSetOwner'), O = originals(OWNER), OW = window.SBDOwners;
    box.innerHTML = '';
    if (!O.length) return;
    const own = O[0].el.value, man = OW && OW.RULES && OW.RULES.owners[own] ? OW.RULES.owners[own].manual : '';
    const d = document.createElement('div'); d.className = 'sbs-row bl'; d.dataset.sbsk = OWNER.k; d.appendChild(copyRow(O[0].el, OWNER, null));
    d.insertAdjacentHTML('beforeend', `<div class="sbs-man">${esc(man)}</div>${rowHtml(OWNER)}`); box.appendChild(d);
  }
  function renderNav() {
    const side = root.querySelector('#sbSetSide');
    side.innerHTML = GROUPS.map((G, i) => { const n = E.filter(x => x.g === G.id).length, ne = errCount(G.id);
      return `<button type="button" role="tab" id="sbs-tab-${G.id}" aria-controls="sbSetPane" aria-selected="${G.id === cur}" tabindex="${G.id === cur ? 0 : -1}" data-sbsg="${G.id}"><span class="num">${i + 1}</span><span>${esc(G.name)}</span><span class="cnt">${n}</span>${ne ? `<span class="err" title="${ne} input${ne > 1 ? 's' : ''} to fix">${ne}</span>` : ''}</button>`; }).join('');
    const rs = root.querySelector('#sbSetReset'), od = panes() && panes().querySelector('[data-xsact="ownDef"]');
    if (rs) { rs.disabled = !od; rs.title = od ? `${od.textContent.trim()} (the owner card's button: its message lists what changed)` : 'The owner AASHTO has no owner defaults'; }
  }
  /* render(): the window's owner bar, groups and pane, keeping the focused input and the pane's scroll */
  function render() {
    if (!root || !open) return;
    const a = document.activeElement, inR = a && root.contains(a);
    const fk = inR ? (a.dataset.sbsId ? '#sbs-' + a.dataset.sbsId : a.id ? '#' + a.id : null) : null;
    const pane = root.querySelector('#sbSetPane'), top = pane ? pane.scrollTop : 0;
    MAP.clear(); renderOwner(); renderNav(); renderPane();
    const p2 = root.querySelector('#sbSetPane'); p2.scrollTop = top;
    if (fk) { let el = null; try { el = root.querySelector(fk.replace(/^#(.*)$/, (s, id) => '#' + CSS.escape(id))); } catch (e) { el = null; } if (el && el.focus) el.focus({ preventScroll: true }); }
  }
  /* hideOnTabs(): each moved input's row hidden on its tab (with its error message), and one line in its card that says where it went */
  function hideOnTabs() {
    const P = panes(); if (!P) return;
    P.querySelectorAll('.sbs-ph').forEach(n => n.remove());
    const byCard = new Map();
    E.filter(moved).forEach(x => originals(x).forEach(({ el, m }) => {
      const row = rowOf(el); row.classList.add('sbs-hide');
      for (let n = row.nextElementSibling; n && n.classList.contains('ic-msg'); n = n.nextElementSibling) n.classList.add('sbs-hide');
      if (x.note) { const nt = P.querySelector(x.note); if (nt) nt.classList.add('sbs-hide'); }
      const sec = row.closest('.sec') || row.parentElement; if (!byCard.has(sec)) byCard.set(sec, { first: row, G: new Map() });
      const q = byCard.get(sec), lb = row.querySelector('label'); if (!q.G.has(x.g)) q.G.set(x.g, []);
      q.G.get(x.g).push((x.pre && m ? x.pre(m) : '') + (x.pfx || '') + (lb ? lb.textContent.replace(/\s+/g, ' ').trim() : x.l.replace(/<[^>]+>/g, '')));
    }));
    byCard.forEach(q => {
      const p = document.createElement('p'); p.className = 'sbs-ph';
      p.innerHTML = [...q.G].map(([g, L]) => `In <a href="#" data-sbset="${g}">Settings › ${esc(groupOf(g).name)}</a>: ${L.map(esc).join('; ')}.`).join('<br>');
      q.first.parentElement.insertBefore(p, q.first);
    });
  }
  function gearState() {
    const b = document.getElementById('sbGear'); if (!b) return;
    const n = movedErrs(); b.classList.toggle('has-err', n > 0); const d = b.querySelector('.sbs-dot'); if (d) d.textContent = n ? String(n) : '';
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
    const p = root.querySelector('#sbSetPane'); if (p) p.scrollTop = 0;
    if (focusTab) { const b = root.querySelector('#sbs-tab-' + g); if (b) { b.focus(); if (b.scrollIntoView) b.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } }
  }
  /* openAt(target, focus): opens the window at a group, or at the group of an input (its row shown, marked and focused) */
  function openAt(target) {
    if (!api) return;
    const G = groupOf(target), x = G ? null : entryOf(target);
    if (x === OWNER) target = null;
    if (!open) {
      prevFocus = document.activeElement; mk = api.mark(); open = true;
      const app = document.getElementById('app'); if (app) app.inert = true;
      document.getElementById('sbSetVeil').hidden = false; root.hidden = false;
      api.redraw();   // the Auto design inputs are drawn while the window is open (index.html panes)
    }
    clearTimeout(tBuild);
    cur = G ? G.id : x && x.g ? x.g : cur; saveGroup(); render();
    const pane = root.querySelector('#sbSetPane');
    const row = x && x !== OWNER ? root.querySelector(`.sbs-row[data-sbsk="${CSS.escape(String(target))}"]`) : null;
    if (row) { row.classList.add('hit'); row.scrollIntoView({ block: 'center' }); const f = row.querySelector('input:not([type=hidden]),select'); if (f) f.focus({ preventScroll: true }); setTimeout(() => row.classList.remove('hit'), 2400); }
    else { pane.scrollTop = 0; const f = root.querySelector('#sbSetOwner select') || root.querySelector('#sbs-tab-' + cur); if (f) f.focus(); }
  }
  function close(keep) {
    if (!open) return;
    clearTimeout(tBuild); open = false;
    const app = document.getElementById('app'); if (app) app.inert = false;
    root.hidden = true; document.getElementById('sbSetVeil').hidden = true; MAP.clear(); root.querySelector('#sbSetPane').innerHTML = ''; root.querySelector('#sbSetOwner').innerHTML = '';   // no copies left while closed (one input per path on the page)
    if (!keep && mk) api.revert(mk);
    mk = null; api.redraw();
    const g = document.getElementById('sbGear'); if (g) g.focus();
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
    o.dispatchEvent(new Event('change', { bubbles: true }));
  }
  function onClick(e) {
    const t = e.target;
    if (t.closest('#sbSetX') || t.closest('#sbSetCancel')) { close(false); return; }
    if (t.closest('#sbSetSave')) { close(true); return; }
    if (t.closest('#sbSetReset')) { const b = panes() && panes().querySelector('[data-xsact="ownDef"]'); if (b) b.click(); return; }
    const g = t.closest('[data-sbsg]'); if (g) { setGroup(g.dataset.sbsg, true); return; }
    const it = t.closest('[data-sbsit]'); if (it) { e.preventDefault(); close(true); const b = document.querySelector(`#inTabs [data-itab="${it.dataset.sbsit}"]`); if (b) b.click(); return; }
    const ot = t.closest('[data-sbsout]'); if (ot) { e.preventDefault(); close(true); const b = document.querySelector(`#tabBar [data-otab="${ot.dataset.sbsout}"]`); if (b) b.click(); return; }
    const sl = t.closest('[data-sbset]'); if (sl) { e.preventDefault(); e.stopPropagation(); openAt(sl.dataset.sbset); }
  }
  const focusables = () => [...root.querySelectorAll('button,select,input,textarea,a[href],[tabindex]:not([tabindex="-1"])')].filter(n => !n.disabled && n.offsetParent !== null && n.tabIndex >= 0);
  function onKey(e) {
    if (e.key === 'Escape') { const tip = document.getElementById('sbTipPop'); if (tip && !tip.hidden) return; e.preventDefault(); close(false); return; }
    if (e.key === 'Tab') { const F = focusables(); if (!F.length) return; const a = document.activeElement, i = F.indexOf(a);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); F[F.length - 1].focus(); } else if (!e.shiftKey && (i === F.length - 1 || i < 0)) { e.preventDefault(); F[0].focus(); } return; }
    const g = e.target.closest && e.target.closest('[data-sbsg]');
    if (g && ['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft', 'Home', 'End'].includes(e.key)) {
      e.preventDefault(); const i = GROUPS.findIndex(G => G.id === cur), n = GROUPS.length;
      const j = e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : (i + (e.key === 'ArrowDown' || e.key === 'ArrowRight' ? 1 : -1) + n) % n;
      setGroup(GROUPS[j].id, true);
    }
  }
  /* init(o): o = { redraw() (the input tabs drawn again), mark() (the undo state now), revert(mark) (back to it) }; called once by index.html */
  function init(o) {
    api = o; css();
    const veil = document.createElement('div'); veil.id = 'sbSetVeil'; veil.hidden = true; document.body.appendChild(veil);
    root = document.createElement('div'); root.id = 'sbSet'; root.hidden = true; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-labelledby', 'sbSetTitle');
    document.body.appendChild(root); build();
    root.addEventListener('click', onClick); root.addEventListener('keydown', onKey);
    veil.addEventListener('click', () => close(false));
    const hb = document.getElementById('hdrBtns');
    if (hb) { const b = document.createElement('button'); b.type = 'button'; b.id = 'sbGear'; b.setAttribute('aria-label', 'Settings'); b.title = 'Settings';
      b.setAttribute('aria-haspopup', 'dialog'); b.innerHTML = GEAR + '<span class="sbs-dot"></span>'; hb.appendChild(b); b.addEventListener('click', () => openAt(null)); }
    /* links to a moved input (an output tab, a worked step, a note): data-sbset="<group or path>", or the Welds tab's data-gofld="<path>" */
    document.addEventListener('click', e => {
      const t = e.target && e.target.closest ? e.target.closest('[data-sbset],[data-gofld]') : null; if (!t || (root.contains(t) && !t.dataset.sbset)) return;
      const v = t.dataset.sbset || t.dataset.gofld; if (!t.dataset.sbset && !has(v)) return;
      e.preventDefault(); e.stopPropagation(); openAt(v);
    }, true);
  }
  /* goErr(e): an error banner link to a moved input opens this window at it (true: handled) */
  const goErr = e => { if (!e || e.host || !has(e.path)) return false; openAt(e.path); return true; };
  window.SBDSettings = { GROUPS, ENTRIES: E, OWNER, init, sync, has, entryOf, open: openAt, close, goErr, isOpen: () => open, UI_KEY };
})();
