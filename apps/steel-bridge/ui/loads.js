/* apps/steel-bridge/ui/loads.js — the cross-section and load inputs (the Cross-section and Loads input tabs, the support skews of the Bridge
   layout tab and w_c for E_c on the Materials tab; TABR, 2026-11-09) and the "Loads & LLDF" output tab (window.SBDUiLoads).
   Classic script. Reads window.SBDModel, SBDOwners, SBDLoads, SBDLldf, SharedSteps, SharedUnits at call time. The page (index.html)
   calls: ensure(P) before drawing the inputs; parts(P, helpers) for the input cards; onChange / onClick from its input listeners
   (true = handled, the page then saves and redraws); calc(P, g) when Calculate runs; output(R, ui, errors) for the output tab;
   onOutChange(e, ui) from the output listener. No storage of its own: the project is saved by the page (sbd2.* keys). */
(function () {
  'use strict';
  const S = () => window.SharedSteps, U = () => window.SharedUnits, O = () => window.SBDOwners, LD = () => window.SBDLoads;
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const f = (x, d) => typeof x === 'number' && isFinite(x) ? U().fmt(x, d) : '—';
  const get = (P, path) => path.split('.').reduce((o, k) => o == null ? o : o[k], P);
  const setp = (P, path, v) => { const ks = path.split('.'), last = ks.pop(), o = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), P); o[last] = v; };

  /* ensure(P): a version 1 project saved before this tab gets the default cross-section and owner (additive; nothing else changes) */
  function ensure(P) {
    if (!P.xs) P.xs = window.SBDModel.defaultXs(P);
    if (!P.ownerRules) P.ownerRules = { owner: 'AASHTO', eta: { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 } };
    if (!P.ownerRules.eta) P.ownerRules.eta = { D: 'no', R: 'auto', I: 'no', eD: 1, eR: 1, eI: 1 };
  }

  /* applyOwnerDefaults(P): the "Apply <DOT> defaults" button. The same assignments as before (deck.tsac sets the total deck thickness to t_s + the
     sacrificial thickness; xs.ws.psf also switches the wearing surface to weight mode); the inputs it changes are recorded, UI message only:
     { owner, changes: [{ tab, field, unit, from, to }], same: [{ tab, field }] } (same: already at the default). Nothing computed changes. */
  const OD_LABEL = { 'materials.concrete.fc': ['Materials', 'Concrete f′c', 'ksi'], 'deck.tdeck': ['Cross-section', 'Total deck thickness', 'in'],
    'materials.concrete.wcE': ['Materials', 'w_c for E_c only', 'kcf'], 'xs.ws.psf': ['Loads', 'Future wearing surface', 'psf'],
    'xs.ws.mode': ['Loads', 'Wearing surface entered as', ''], 'xs.dlMethod': ['Loads', 'Dead load distribution', ''] };   // the input tab of each field (TABR, 2026-11-09)
  let lastOwnDef = null;
  function odText(path, v) {
    if (v == null || (typeof v === 'number' && !isFinite(v)) || v === '') return '(blank)';
    if (path === 'xs.ws.mode') return v === 'psf' ? 'Weight (psf)' : v === 'thk' ? 'Thickness × unit weight' : String(v);
    if (path === 'xs.dlMethod') return LD().METHODS[v] || String(v);
    return String(v);
  }
  function applyOwnerDefaults(P) {
    const owner = P.ownerRules.owner, changes = [], same = [];
    const assign = (path, v) => { const old = get(P, path); setp(P, path, v); const lab = OD_LABEL[path] || ['', path, ''];
      if (old === v) same.push({ tab: lab[0], field: lab[1] }); else changes.push({ tab: lab[0], field: lab[1], unit: lab[2], from: odText(path, old), to: odText(path, v) }); };
    O().defaults(owner).forEach(d => {
      if (d.path === 'deck.tsac') assign('deck.tdeck', P.deck.ts + d.value);
      else { assign(d.path, d.value); if (d.path === 'xs.ws.psf') assign('xs.ws.mode', 'psf'); } });
    return { owner, changes, same };
  }
  /* takeOwnerDefaults(): the record of the last "Apply defaults" click (once), or null. The page shows it as a message. */
  function takeOwnerDefaults() { const r = lastOwnDef; lastOwnDef = null; return r; }

  /* ---------- inputs ---------- */
  /* ownerCard(P, h): the "Bridge owner (DOT) rules" card. The page (index.html) draws it on the Project input tab, under the Project card
     (moved from the Cross-section & loads tab, UI only: same paths ownerRules.*, same ownDef button, handled by onClick below). */
  function ownerCard(P, h) {
    const own = P.ownerRules, o = own.owner, rI = O().rule(o, 'ld.etaI'), rD = O().rule(o, 'ld.etaD'), rR = O().rule(o, 'ld.etaR');
    const yn = [['no', 'No'], ['yes', 'Yes']];
    const defs = O().defaults(o);
    return h.card('Bridge owner (DOT) rules', `${h.sel('ownerRules.owner', 'Client / owner (DOT)', O().LIST.map(k => [k, k === 'AASHTO' ? 'AASHTO (no owner rules)' : `${k} (${O().RULES.owners[k].short})`]))}
      ${o === 'AASHTO' ? `${h.num('ownerRules.eta.eD', 'η<sub>D</sub>', '')}${h.num('ownerRules.eta.eR', 'η<sub>R</sub>', '')}${h.num('ownerRules.eta.eI', 'η<sub>I</sub>', '')}`
        : `${rD && !rD.value.fixed ? h.sel('ownerRules.eta.D', 'Nonductile components (η<sub>D</sub>)', yn) : ''}${rR ? h.sel('ownerRules.eta.R', 'Nonredundant (η<sub>R</sub>)', [['auto', 'Automatic (3 girders or fewer)'], ['no', 'No'], ['yes', 'Yes']]) : ''}${rI ? h.sel('ownerRules.eta.I', esc(rI.value.q || 'η<sub>I</sub> question'), yn) : ''}`}
      <p class="note">${esc(O().RULES.owners[o].manual)}. The owner's load rules (η, design load multiplier m, haunch in the section properties) are worked on the Loads &amp; LLDF tab.</p>
      ${defs.length ? `<p class="note">${esc(o)} defaults: ${defs.map(d => `${esc(d.label)} ${esc(d.show)} (${esc(d.cite)})`).join('; ')}.</p><button type="button" data-xsact="ownDef">Apply ${esc(o)} defaults</button>` : ''}`);
  }
  /* parts(P, h): the input cards of the cross-section and the loads, apart (TABR, 2026-11-09: the input tabs reorganised, display only; the
     page puts them on the Bridge layout (skews), Cross-section, Materials (w_c for E_c) and Loads tabs; same paths, kinds and handlers) */
  function parts(P, h) {
    const x = P.xs;
    const opt = (path, label, unit, note) => `<div class="fRow"><label for="i_${path}">${label}</label><input type="number" step="any" id="i_${path}" data-path="${path}" data-kind="xopt" value="${esc(get(P, path) == null ? '' : get(P, path))}" placeholder="${esc(note || '')}"><span class="unit">${unit || ''}</span></div>`;
    const list = (path, label, unit) => `<div class="fRow"><label for="i_${path}">${label}</label><input type="text" id="i_${path}" data-path="${path}" data-kind="xlist" value="${esc((get(P, path) || []).join(', '))}" style="width:180px"><span class="unit">${unit}</span></div>`;
    const tf = [['false', 'No'], ['true', 'Yes']];
    /* SWGRP (2026-11-24, engineer: "separate the left and right sidewalk … Same with the deck edges"; display only): each side under its own
       sub-heading, the labels without the side; the side stays in the label as hidden text (screen readers, the input-check banner). Same
       ids, paths and kinds. */
    const sdh = t => `<span style="position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap">${t}: </span>`;
    const edge = sd => { const k = `xs.edges.${sd}.`, e = x.edges[sd], s = sdh(`${sd === 'L' ? 'Left' : 'Right'} deck edge`);
      return `<h4 class="sub">${sd === 'L' ? 'Left' : 'Right'} deck edge</h4>${h.sel(k + 'type', `${s}Edge type`, [['barrier', 'Barrier'], ['curb', 'Curb and railing']])}
        ${e.type === 'curb' ? `${h.num(k + 'cw', `${s}Curb width`, 'in')}${h.num(k + 'ch', `${s}Curb height`, 'in')}${h.num(k + 'rw', `${s}Railing weight`, 'klf')}${h.num(k + 'rp', `${s}Railing load point from edge`, 'ft')}${opt(k + 'rf', `${s}Railing traffic face from edge`, 'ft', 'blank = load point')}`
          : barrierRows(P, h, sd, k, e, s)}${opt(k + 'face', `${s}Edge to traffic face`, 'ft', 'optional')}`; };
    const sw = sd => { const k = `xs.sidewalks.${sd}.`, s = sdh(`${sd === 'L' ? 'Left' : 'Right'} sidewalk`);
      // RCURB (sb-ridot-curb PR, 2026-11-25; decision pending engineer review): "Mountable by vehicles" per sidewalk; absent = Automatic (the 12 in rule, as before)
      const mo = (x.sidewalks[sd] || {}).mount, mv = mo === 'yes' || mo === 'no' ? mo : 'auto';
      return `<h4 class="sub">${sd === 'L' ? 'Left' : 'Right'} sidewalk</h4>${h.num(k + 'w', `${s}Width`, 'ft')}${h.num(k + 't', `${s}Thickness`, 'in')}${h.sel(k + 'mount', `${s}Mountable by vehicles`, [['auto', 'Automatic (thinner than 12 in)'], ['yes', 'Yes, mountable'], ['no', 'No, not mountable']], mv)}${opt(k + 'fence', `${s}Railing / fence`, 'klf', 'none')}${opt(k + 'fenceX', `${s}Fence from deck edge`, 'ft', 'none')}`; };
    const cats = Object.entries(LD().CATS), dists = [['auto', 'Follows the method'], ['pilecap', 'MassDOT pile-cap'], ['equal', 'Equal (all beams)'], ['two', 'Two adjacent beams']];
    const cell = (path, kind, v, w) => `<td><input type="${kind === 'text' ? 'text' : 'number'}" step="any" data-path="${path}" data-kind="${kind}" value="${esc(v)}" style="width:${w || 62}px"></td>`;
    const scell = (path, opts, v) => `<td><select data-path="${path}" data-kind="sel" style="width:auto">${opts.map(([k, t]) => `<option value="${esc(k)}"${String(v) === String(k) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></td>`;
    const extra = `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Description</th><th>Category</th><th>x<br>ft</th><th>w<br>klf</th><th>Distribution</th><th></th></tr></thead><tbody>
      ${(x.extra || []).map((r, i) => `<tr>${cell(`xs.extra.${i}.name`, 'text', r.name, 120)}${scell(`xs.extra.${i}.cat`, cats, r.cat)}${cell(`xs.extra.${i}.x`, 'num', r.x)}${cell(`xs.extra.${i}.plf`, 'num', r.plf)}${scell(`xs.extra.${i}.dist`, dists, r.dist)}<td><button type="button" data-xsact="delExtra" data-i="${i}" title="Remove this load">×</button></td></tr>`).join('')}
      </tbody></table></div><button type="button" data-xsact="addExtra">Add line load</button><p class="note">x from the left deck edge. Utilities (UT, UF) act on the noncomposite section (MassDOT 3.5.5).</p>`;
    const ovl = `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Overlay</th><th>Entered as</th><th>psf</th><th>t<br>in</th><th>γ<br>kcf</th><th></th></tr></thead><tbody>
      ${(x.overlays || []).map((r, i) => `<tr>${cell(`xs.overlays.${i}.name`, 'text', r.name, 120)}${scell(`xs.overlays.${i}.mode`, [['psf', 'Weight (psf)'], ['thk', 'Thickness × unit weight']], r.mode)}${cell(`xs.overlays.${i}.psf`, 'xopt', r.psf == null ? '' : r.psf)}${cell(`xs.overlays.${i}.thk`, 'xopt', r.thk == null ? '' : r.thk)}${cell(`xs.overlays.${i}.gam`, 'xopt', r.gam == null ? '' : r.gam)}<td><button type="button" data-xsact="delOvl" data-i="${i}" title="Remove this overlay">×</button></td></tr>`).join('')}
      </tbody></table></div><button type="button" data-xsact="addOvl">Add overlay</button>`;
    return {
      girders: h.card('Girders and overhangs', `${h.sel('xs.spMode', 'Girder spacing', [['individual', 'Individual spacings'], ['equal', 'Equal spacing']], x.spMode === 'equal' ? 'equal' : 'individual')}${h.num('xs.nb', 'Number of girders N<sub>b</sub>', '')}${x.spMode === 'equal' ? equalRows(P, h) : list('xs.bays', 'Girder spacings', 'left to right')}${h.num('xs.ohL', 'Left overhang (girder ℄ to deck edge)', 'ft')}${h.num('xs.ohR', 'Right overhang', 'ft')}
        <p class="note">Deck thickness, haunch and deck reinforcement: Deck card below. f′c and w<sub>c</sub>: Materials tab. Support skews: Bridge layout tab. The LLDF regions take their sections from the girder selected on the Girders &amp; plates tab.</p>`),
      edges: h.card('Deck edges', `${edge('L')}${edge('R')}<p class="note">Distances from the deck edge. A curb lower than 12 in is mountable (the railing face governs); an entered edge to traffic face governs.</p>`),
      sidewalks: h.card('Sidewalks and median', `${sw('L')}${sw('R')}<h4 class="sub">Pedestrian load and median</h4>${h.num('xs.sidewalks.ped', 'Pedestrian load', 'psf')}${h.num('xs.median.w', 'Raised median width', 'ft')}${h.num('xs.median.t', 'Median thickness', 'in')}${h.sel('xs.median.joint', 'Longitudinal joint at the median', tf, String(!!x.median.joint))}${opt('xs.wcA', 'Curb / sidewalk / median concrete', 'kcf', 'blank = w_c')}
        <p class="note">A mountable sidewalk (Automatic: thinner than 12 in) does not move the live-load traffic face. Owner RIDOT, a mountable sidewalk: two live-load cases, the more severe governs (RIDOT BDM 3.4.1.1.1: lanes between the barriers without the pedestrian load; lanes curb to curb with it), Loads &amp; LLDF tab.</p>`),
      ws: h.card('Wearing surface, forms and steel', `${h.sel('xs.ws.mode', 'Wearing surface entered as', [['psf', 'Weight (psf)'], ['thk', 'Thickness × unit weight']])}${x.ws.mode === 'thk' ? `${opt('xs.ws.thk', 'Wearing surface thickness', 'in')}${opt('xs.ws.gam', 'Wearing surface unit weight', 'kcf')}` : h.num('xs.ws.psf', 'Future wearing surface', 'psf')}
        ${ovl}${h.num('xs.sip', 'Stay-in-place forms', 'psf')}${h.num('xs.allow', 'Steel detail allowance', '%')}`),
      extra: h.card('Utilities and other line loads', extra),
      dist: h.card('Distribution', `${h.sel('xs.dlMethod', 'Dead load distribution', Object.entries(LD().METHODS))}${h.num('xs.lldf.gap', 'Gap between adjacent trucks', 'ft')}
        ${h.sel('xs.lldf.kg', 'K<sub>g</sub>', [['max', 'At the region section'], ['avg', 'Length-weighted over the region'], ['simple', 'Simplified terms (Table 4.6.2.2.1-3)']])}
        ${h.sel('xs.lldf.skewV', 'Shear skew correction', [['all', 'All girders'], ['ext', 'Exterior girders only']])}
        ${h.sel('xs.lldf.skewVx', 'Shear skew correction along the girder', [['whole', 'Whole length'], ['taper', 'Tapered: full at the support, 1.0 at mid-span']], x.lldf.skewVx === 'taper' ? 'taper' : 'whole').replace('<div class="fRow">', '<div class="fRow" style="flex-wrap:wrap">').replace('<select ', '<select style="flex:1 1 100%;max-width:100%" ')}${h.sel('xs.lldf.extMin', 'Exterior not less than interior', tf, String(!!x.lldf.extMin))}
        <p class="note" id="ld-skewvx-note"><b>Shear skew correction along the girder</b> (AASHTO LRFD 10th Ed. Art. 4.6.2.2.3c). <b>Whole length</b> (default): the correction r<sub>V</sub> of Table 4.6.2.2.3c-1 on the shear distribution factor at every station of the span (the conservative reading). <b>Tapered</b>: r<sub>V</sub> in full at each support of every span, decreasing linearly to 1.0 at mid-span, r<sub>V</sub>(x) = 1 + (r<sub>V</sub> − 1)(1 − x/(L/2)); the article applies the correction between the support at the obtuse corner and mid-span and permits this linear decrease whatever the end condition (simple or continuous). An "end region only" option is not offered: the article gives no end region shorter than support to mid-span. The reactions and bearing stiffeners keep the support value; the factor at a station is worked on the <a href="#" data-gotab="an">Analysis tab</a> (steps g<sub>V</sub>(x)). An entered or pulled shear factor is not tapered.</p>`),
      skews: list('xs.skews', 'Support skews', 'one per support line'),
      wcE: opt('materials.concrete.wcE', 'w<sub>c</sub> for E<sub>c</sub> only', 'kcf', 'blank = w_c')
    };
  }
  /* BARG (2026-11-24; engineer: "RIDOT has a barrier that is a rectangle shape, not an F-shape barrier. Can I enter the barrier geometry …
     and let the app calculate the weight directly?"): per deck edge "Barrier weight from": Entered (absent: the typed width and weight, as
     before) or Geometry (bMode 'geom': the shape's inputs bShape, bDims { b, h, bt } in, bPts [[x, y]] in, bGam kcf; shared/barrier.js).
     With Geometry the width at the deck and the weight are computed, shown read-only in place of the two typed fields, worked here and on the
     Loads & LLDF tab (step dl.load.bar<L|R>), and written into bw and bwt as well (so the hand-offs and the .lga export read them). The
     engine (engine/loads.js edgeIn) computes them again from the shape; the load acts at the centroid x̄ (engineer 2026-11-24). */
  const BMODES = [['entered', 'Entered'], ['geom', 'Geometry']];
  function barrierRows(P, h, sd, k, e, s) {
    const B = window.SharedBarrier, geo = e.bMode === 'geom' && B, mode = h.sel(k + 'bMode', `${s}Barrier weight from`, BMODES, geo ? 'geom' : 'entered');
    if (!geo) return `${B ? mode : ''}${h.num(k + 'bw', `${s}Barrier width at deck`, 'ft')}${h.num(k + 'bwt', `${s}Barrier weight`, 'klf')}`;
    const sp = B.spec(e), G = B.compute(sp), v = p => { const x = get(P, k + p); return x == null || (typeof x === 'number' && !isFinite(x)) ? '' : x; };
    const gnum = (p, label, unit, ph) => `<div class="fRow"><label for="i_${k}${p}">${s}${label}</label><input type="number" step="any" id="i_${k}${p}" data-path="${k}${p}" data-kind="bgeo" value="${esc(v(p))}"${ph ? ` placeholder="${esc(ph)}"` : ''}><span class="unit">${unit}</span></div>`;
    const ro = (label, val, unit) => `<div class="fRow"><label>${s}${label}</label><input type="text" readonly tabindex="-1" value="${esc(val)}" style="background:#f1f5f9;color:#475569" title="Computed from the barrier geometry"><span class="unit">${unit}</span></div>`;
    let o = mode + h.sel(k + 'bShape', `${s}Barrier shape`, B.SHAPES, sp.shape);
    if (sp.shape === 'poly') o += `<div class="fRow"><label for="i_${k}bPts">${s}Points x, y (in)</label><input type="text" id="i_${k}bPts" data-path="${k}bPts" data-kind="bgeo" value="${esc(B.ptsText(e.bPts))}" style="width:220px" placeholder="0, 0; 12, 0; 12, 42; 0, 42"></div>
      <p class="note">In order around the outline, separated by semicolons: x from the deck edge (toward the roadway), y up from the top of the deck; at least 3 points, an edge on the deck (y = 0), not crossing itself.</p>`;
    else o += gnum('bDims.b', sp.shape === 'slope' ? 'Base width b (on the deck)' : 'Barrier width b', 'in') + (sp.shape === 'slope' ? gnum('bDims.bt', 'Top width b<sub>t</sub>', 'in') : '') + gnum('bDims.h', 'Barrier height h', 'in');
    o += gnum('bGam', 'Unit weight γ', 'kcf', `blank = ${B.GAMMA.toFixed(3)}`);
    if (!G.ok) return o + `<div class="alert">${G.errors.map(x => esc(x.msg.charAt(0).toUpperCase() + x.msg.slice(1)) + '.').join(' ')}</div>`;
    const st = B.steps(G, { prefix: 'xs', base: 'bar' + sd, wLabel: 'Barrier weight per foot' });
    const link = `<a href="#" data-gotab="loads" title="Loads &amp; LLDF tab, Barriers and wearing surface (DC2, DW), step dl.load.bar${sd}">Loads &amp; LLDF §</a>`;
    return o + ro('Barrier width at deck', f(G.bDeck, 3), 'ft') + ro('Barrier weight', f(G.w, 4), 'klf') + ro('Centroid x̄ (load point)', f(G.xc, 3), 'ft')
      + `<div style="display:flex;gap:10px;flex-wrap:wrap;align-items:flex-start"><div>${B.svg(G, { w: 170, side: sd })}</div><ul class="steps" style="flex:1 1 260px;min-width:0">${st.map(t => `<li><div class="lbl">${window.SBDSub.html(t.label)}${t.ref ? `<span class="ref">${esc(t.ref)}</span>` : ''}</div><div>${S().line(t, true)}</div>${t.note ? `<div class="nt">${window.SBDSub.html(t.note)}</div>` : ''}</li>`).join('')}</ul></div>
      <p class="note">Computed from the geometry (read-only); the DC2 line load acts at the centroid x̄ from the deck edge. Worked with the dead loads on the ${link} (step dl.load.bar${sd}).</p>`;
  }
  /* barrierChange(P, sd, key, el): an input of the barrier geometry (BARG); true = handled */
  function barrierChange(P, sd, key, el) {
    const B = window.SharedBarrier, e = P.xs.edges[sd], v = el.value, nv = () => (v.trim() === '' ? null : Number(v));
    if (key === 'bMode') { e.bMode = v === 'geom' ? 'geom' : 'entered';
      if (e.bMode === 'geom') { if (!e.bShape) e.bShape = 'rect'; if (!e.bDims) e.bDims = { b: +e.bw > 0 ? Math.round(+e.bw * 12 * 1e4) / 1e4 : null, h: null }; if (e.bGam == null) e.bGam = B ? B.GAMMA : 0.15; } }
    else if (key === 'bShape') { const prev = B ? B.outline({ ...B.spec(e) }) : null; e.bShape = ['rect', 'slope', 'poly'].includes(v) ? v : 'rect'; e.bDims = e.bDims || { b: null, h: null };
      if (e.bShape === 'slope' && e.bDims.bt == null) e.bDims.bt = e.bDims.b;
      if (e.bShape === 'poly' && !(Array.isArray(e.bPts) && e.bPts.length) && prev && prev.length >= 3 && prev.every(q => isFinite(q[0]) && isFinite(q[1]))) e.bPts = prev.map(q => [q[0], q[1]]); }
    else if (key === 'bPts') e.bPts = B ? B.parsePts(v) : [];
    else if (key === 'bGam') e.bGam = nv();
    else { e.bDims = e.bDims || {}; e.bDims[key.slice(6)] = nv(); }
    if (e.bMode === 'geom' && B) { const G = B.compute(B.spec(e)); if (G.ok) { e.bw = G.bDeck; e.bwt = G.w; } }   // the computed values in the two fields (hand-offs, .lga export)
    return true;
  }
  /* EQSP (2026-11-09; engineer's definition 2026-11-09): equal girder spacing. The engineer enters the exterior girder spacing W_cc (℄ to ℄ of
     the two exterior girders); S = W_cc / (N_b − 1) (SBDModel.equalSpacing) is written into every xs.bays entry, which everything computed
     reads as before. The overhangs stay inputs (deck width out to out = oh_L + W_cc + oh_R, shown). The S warning reuses the LLDF range of
     applicability of the Loads & LLDF tab (SBDLldf.RANGE.S, Table 4.6.2.2.2b-1); no new check. */
  function equalRows(P, h) {
    const x = P.xs, Q = window.SBDModel.equalSpacing(x), st = Q.step, Wd = +x.ohL + Q.Wcc + +x.ohR, R = window.SBDLldf && window.SBDLldf.RANGE && window.SBDLldf.RANGE.S;
    const out = R && isFinite(Q.S) && (Q.S < R[0] - 1e-9 || Q.S > R[1] + 1e-9);
    return `${h.num('xs.Wcc', 'Exterior girder spacing W<sub>cc</sub>', 'ft, ℄ to ℄ of G1 and G' + (isFinite(Q.nb) ? Q.nb : 'n'))}
      <ul class="steps"><li id="st-xs.eqS"><div class="lbl">${window.SBDSub.html(st.label)}</div><div>${S().line(st, true)}</div></li></ul>
      ${isFinite(Q.S) && !(Q.S > 0) ? '<div class="alert">The girder spacing S must be positive: enter an exterior girder spacing W<sub>cc</sub> greater than zero.</div>' : ''}
      ${out ? `<div class="alert">S = ${f(Q.S, 3)} ft is outside the range of applicability of the LLDF equations, ${f(R[0], 1)} ft ≤ S ≤ ${f(R[1], 1)} ft (Table 4.6.2.2.2b-1; as the <a href="#" data-gotab="loads">Loads &amp; LLDF tab</a> checks).</div>` : ''}
      <p class="note">All ${isFinite(Q.nb) && Q.nb >= 2 ? Q.nb - 1 : ''} bays take S; the per-bay spacings are written from it (choose Individual spacings to edit them, starting from these values). Deck width out to out = oh<sub>L</sub> + W<sub>cc</sub> + oh<sub>R</sub> = ${f(+x.ohL, 2)} + ${f(Q.Wcc, 2)} + ${f(+x.ohR, 2)} = ${f(Wd, 2)} ft.</p>`;
  }
  const applyEqual = P => { if (P.xs.spMode === 'equal') { const Q = window.SBDModel.equalSpacing(P.xs); if (Q.bays.length) P.xs.bays = Q.bays; } };
  /* onChange(el, P): the kinds this tab adds; true = handled */
  function onChange(el, P) {
    const path = el.dataset.path, k = el.dataset.kind; if (!path) return false;
    { const m = /^xs\.edges\.([LR])\.(bMode|bShape|bDims\.(?:b|bt|h)|bPts|bGam)$/.exec(path); if (m && P.xs.edges && P.xs.edges[m[1]]) return barrierChange(P, m[1], m[2], el); }   // BARG
    if (k === 'xlist') { setp(P, path, el.value.split(/[,;\s]+/).filter(Boolean).map(Number)); return true; }
    if (k === 'xopt') { setp(P, path, el.value.trim() === '' ? null : Number(el.value)); return true; }
    if (path === 'xs.nb') { const n = Math.round(Number(el.value)), B = P.xs.bays || []; P.xs.nb = n;
      if (n >= 2 && n < 100) { const last = B.length ? B[B.length - 1] : 9.5; P.xs.bays = Array.from({ length: n - 1 }, (_, i) => i < B.length ? B[i] : last); } applyEqual(P); return true; }
    if (path === 'xs.spMode') {   // EQSP: to Equal, W_cc starts at the present Σ bays (the same girder lines when the bays are equal); back to Individual keeps the bays
      P.xs.spMode = el.value === 'equal' ? 'equal' : 'individual';
      if (P.xs.spMode === 'equal') { P.xs.Wcc = Math.round((P.xs.bays || []).reduce((a, v) => a + +v, 0) * 1e6) / 1e6; applyEqual(P); } return true; }
    if ((path === 'xs.ohL' || path === 'xs.ohR') && P.xs.spMode === 'equal') { setp(P, path, el.value === '' ? NaN : Number(el.value)); return true; }   // EQSP: redraw the deck width shown
    if (path === 'xs.Wcc') { P.xs.Wcc = el.value === '' ? NaN : Number(el.value); applyEqual(P); return true; }
    if (path === 'xs.median.joint' || path === 'xs.lldf.extMin') { setp(P, path, el.value === 'true'); return true; }
    return false;
  }
  function onClick(e, P) {
    const b = e.target.closest('[data-xsact]'); if (!b) return false; const a = b.dataset.xsact, x = P.xs;
    if (a === 'addExtra') x.extra.push({ name: `Line load ${x.extra.length + 1}`, cat: 'DW', x: 0, plf: 0, dist: 'auto' });
    else if (a === 'delExtra') x.extra.splice(+b.dataset.i, 1);
    else if (a === 'addOvl') x.overlays.push({ name: `Overlay ${x.overlays.length + 1}`, mode: 'psf', psf: 0, thk: null, gam: null });
    else if (a === 'delOvl') x.overlays.splice(+b.dataset.i, 1);
    else if (a === 'ownDef') { lastOwnDef = applyOwnerDefaults(P); }
    else return false;
    return true;
  }

  /* ---------- results ---------- */
  function calc(P, gi) {
    ensure(P);
    try {
      const g = P.girders[gi] || P.girders[0], { b, p } = LD().fromModel(P, { girder: P.girders.indexOf(g) }), R = LD().compute(b, p);
      if (R.errors.length) return { errors: R.errors };
      R.steel = LD().steelWeight(g.segments, b.allow, g.id); R.girderLabel = g.label || g.id; R.girderId = g.id; R.ranges = window.SBDLldf.ranges(R, b.tsDeck, b.nb);
      // SBSW (2026-11-19, show the work of A2): haunch, SIP and DC1 with each plate segment's top flange, as the analysis takes them (display only)
      R.segDC1 = LD().segDC1(R.dead, g.segments); R.dead.steps = LD().segSteps(R.dead, g.segments);
      return R;
    } catch (e) { return { errors: [`The loads could not be computed: ${e.message}`] }; }
  }
  const stepLi = s => `<li id="st-${esc(s.id)}"><div class="lbl">${window.SBDSub.html(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${S().line(s, true)}</div>${s.note ? `<div class="nt">${window.SBDSub.html(s.note)}</div>` : ''}</li>`;
  const A = '10th Ed. Art. ', OPEN = new Set(), TPX = (...ks) => ks.map(k => window.SBDFlexureUI.TP[k]).filter(Boolean);

  /* ---------- topics of the worked steps (presentation spec A, 2026-10-31; as ui/shear.js): owner rules, geometry, dead loads, then the live-load distribution factors by sub-article ---------- */
  const TOPICS = { x: () => [
    { key: 'own', title: 'Owner load rules (η, m, haunch)', ref: '', ids: /^own\./, res: /^own\.eta$/ },
    { key: 'geo', title: 'Cross-section geometry and live-load faces', ref: A + '3.6.1.1.1, 4.6.2.2.1', ids: /^(xs\.(?!n$)|df\.geo\.)/ },
    { key: 'n', title: 'Modular ratio for the stiffness parameter', ref: A + '4.6.2.2.1', ids: /^(n\.|xs\.n$)/, res: /^n\.n$/ },
    { key: 'steel', title: 'Girder steel self-weight (DC1)', ref: A + '3.5.1', ids: /^dl\.steel\./, res: /\.avg$/ },
    { key: 'dc1', title: 'Deck, haunch and forms (DC1)', ref: A + '3.3.2, 3.5.1', ids: /^dl\.G\d+\.(trib|deck|haunch|sip|DC1)(\.b\d+)?$/, res: /\.DC1$/ },   // SBSW: .b<k> per top flange width
    { key: 'dc2', title: 'Barriers and wearing surface (DC2, DW)', ref: A + '3.3.2, 3.5.1', ids: /^dl\.(xbar|S\d+$|load\.|G\d+\.(barL|barR|ws|DC2|DW)$)/, res: /\.DW$/ },
    { key: 'kg', title: 'Longitudinal stiffness parameter', ref: A + '4.6.2.2.1', ids: /^df\.[sp]\d+\.(eg|Kg\d*|KgAvg)$/, res: /\.Kg$/ },
    { key: 'int', title: 'Interior girder equations (one and two lanes)', ref: A + '4.6.2.2.2b, 4.6.2.2.3a', ids: /^df\.[sp]\d+\.G\d+\.(S|kterm|mom\d*|shr\d*)$/ },
    { key: 'lev', title: 'Lever rule', ref: A + '4.6.2.2.2d, 4.6.2.2.3b', ids: /^df\.[sp]\d+\.G\d+\.lev\d*\./ },
    { key: 'ext', title: 'Exterior girder: correction factor e', ref: A + '4.6.2.2.2d, 4.6.2.2.3b', ids: /^df\.[sp]\d+\.G\d+\.(de|eM|eV|mE|vE)$/ },
    { key: 'rig', title: 'Rigid cross-section (special analysis)', ref: A + 'C4.6.2.2.2d', ids: /^df\.[sp]\d+\.G\d+\.rig/ },
    { key: 'skew', title: 'Skew reduction and correction', ref: A + '4.6.2.2.2e, 4.6.2.2.3c', ids: /^df\.[sp]\d+\.(scfM|scfV|rVx)$/ },
    { key: 'gov', title: 'Distribution factors used (moment, shear)', ref: A + '4.6.2.2', ids: /^df\.[sp]\d+\.G\d+\.g[MV]\d*$/, res: /\.gM$/ },
    { key: 'fat', title: 'Fatigue factors (one lane, multiple presence removed)', ref: A + '3.6.1.4, 4.6.2.2.2b', ids: /^df\.[sp]\d+\.G\d+\.fat/ },
    { key: 'def', title: 'Deflection distribution factor', ref: A + '2.5.2.6.2', ids: /^df\.[sp]\d+\.gDef$/ }] };
  const groups = (kind, list) => window.SharedSteps.group(list, TOPICS[kind || 'x'](), { strip: false });
  const stepsHtml = (list, kind) => window.SharedSteps.groupsHTML(groups(kind, list), { open: OPEN, item: stepLi });
  const wk = (id, t, sel) => `<a class="wk" href="#st-${esc(id)}"${sel && sel.lg != null ? ` data-lg="${sel.lg}"` : ''}${sel && sel.lr != null ? ` data-lr="${sel.lr}"` : ''}>${t || '§'}</a>`;
  const card = (t, b) => `<section class="sec"><div class="secHead">${t}</div><div class="secBody">${b}</div></section>`;
  /* segCard(R, lg): SBSW (2026-11-19; CLAUDE.md §6): where the plates' top flange width varies, the haunch, SIP forms and DC1 of girder lg
     per width, as the analysis takes them (A2, engine/analysis.js wetCorr; worked in steps dl.G<i>.*.b<k>). Display only. */
  function segCard(R, lg) {
    const rows = (R.segDC1 || [])[lg] || [], D = R.dead, g = `G${lg + 1}`; if (!rows.some(r => !r.base)) return '';
    const xr = r => r.xr.map(([a, b]) => `${f(a, 2)}–${f(b, 2)}`).join(', ');
    return `<p class="note" id="ld-segdc1"><b>${g}, DC1 with each plate segment's top flange (${esc(R.girderLabel)}'s plates), as the analysis takes it.</b> The table above works the haunch and the SIP forms with b<sub>f,0</sub> = ${f(D.bf * 12, 2)} in (the first region's top flange); the analysis adds the difference over each segment of another width (<a href="#" data-gotab="an">Analysis tab</a>, wet deck).</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th>b<sub>f</sub> (in)</th><th class="lft">Segments x (ft)</th><th>Haunch</th><th>SIP</th><th>DC1</th></tr></thead><tbody>${rows.map((r, k) => `<tr><td>${f(r.topB, 2)}</td><td class="lft">${xr(r)}</td><td>${f(r.haunch, 4)} ${wk(r.base ? `dl.${g}.haunch` : `dl.${g}.haunch.b${k}`, '', { lg })}</td><td>${f(r.sip, 4)} ${wk(r.base ? `dl.${g}.sip` : `dl.${g}.sip.b${k}`, '', { lg })}</td><td>${f(r.dc1, 4)} ${wk(r.base ? `dl.${g}.DC1` : `dl.${g}.DC1.b${k}`, '', { lg })}</td></tr>`).join('')}</tbody></table></div>`;
  }
  /* casesCard(R, lg) (RCURB, sb-ridot-curb PR, 2026-11-25; CLAUDE.md §4, §6): RIDOT BDM 3.4.1.1.1 with a mountable sidewalk: the two live-load
     cases (engine/loads.js cases): the faces, roadway, lanes, this girder's factors and w_PL of each, and case 2's worked steps (case 1 is the rest
     of this tab). Which case governs at each station and effect is worked on the Analysis tab (steps an.case.*). '' without cases. */
  function casesCard(R, lg) {
    const C = R.cases; if (!C) return '';
    const c2 = C.c2, sdN = sd => (sd === 'L' ? 'left' : 'right'), sp = (RR, k) => RR.regions.find(q => q.id === 's0').members[k];
    const row = (n, RR, pl) => { const m = sp(RR, lg); return `<tr><td class="lft">Case ${n}</td><td>${f(RR.ll.L.r, 2)} / ${f(RR.ll.R.r, 2)}</td><td>${f(RR.regions[0].geo.roadway, 2)} ${wk(`xs.case.w${n}`)}</td><td>${RR.regions[0].geo.NL} ${wk(`xs.case.NL${n}`)}</td><td>${f(m.gM, 4)}${n === 2 ? ` ${wk(`c2.df.s0.G${lg + 1}.gM`)}` : ` ${wk(`df.s0.G${lg + 1}.gM`)}`}</td><td>${f(m.gV, 4)}</td><td>${f(m.fatM, 4)}</td><td>${f(RR.regions.find(q => q.id === 's0').gDef, 4)}</td><td>${f(pl, 4)}</td><td class="lft">${esc(m.method)}</td></tr>`; };
    const list = LD().caseSteps(R, [lg]);
    return card(`${esc(C.cite)}: two live-load cases (mountable ${C.sides.map(sdN).join(' and ')} sidewalk${C.sides.length > 1 ? 's' : ''}), G${lg + 1}`, `<p class="note">With a sidewalk the more severe of two cases governs (RIDOT BDM 3.4.1.1.1): <b>case 1</b>, the design lanes on the whole roadway between the barriers (the mountable sidewalk part of it), no pedestrian load; <b>case 2</b>, the lanes on the curb-to-curb roadway, the pedestrian load on the sidewalks. Vehicles can mount the sidewalk, so the pedestrian load does not act with them in case 1 (AASHTO LRFD 10th Ed. Art. 3.6.1.6). The rest of this tab works case 1. At every station and for each effect the analysis takes the case with the larger factored live load (<a href="#" data-gotab="an">Analysis tab</a>, steps an.case.*).</p>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Case</th><th>Faces L / R (ft)</th><th>Roadway (ft)</th><th>N<sub>L</sub></th><th>g<sub>M</sub></th><th>g<sub>V</sub></th><th>g<sub>fat,M</sub></th><th>g<sub>Δ</sub></th><th>w<sub>PL</sub> (klf)</th><th class="lft">Method (span 1)</th></tr></thead><tbody>
      ${row(1, R, 0)}${row(2, c2, c2.dead.pl[lg] || 0)}</tbody></table></div>
      <details class="sg-t"><summary>Worked steps of the two cases (lanes; case 2: faces, geometry, the factors of G${lg + 1}, its pedestrian load)</summary><ol class="steps">${list.map(stepLi).join('')}</ol></details>`);
  }
  function output(R, ui, errors) {
    if (errors && errors.length) return `<div class="alert err"><b>Input errors.</b><ul>${errors.map(e => `<li>${esc(e.msg || e)}</li>`).join('')}</ul></div>`;
    if (!R) return '';
    if (R.errors && R.errors.length) return `<div class="alert err"><b>Loads.</b><ul>${R.errors.map(e => `<li>${esc(e)}</li>`).join('')}</ul></div>`;
    const N = R.dead.N, lg = Math.min(ui.lg || 0, N - 1), lr = Math.min(ui.lr || 0, R.regions.length - 1), g = `G${lg + 1}`, rg = R.regions[lr], L = R.lf;
    let h = `<div class="fRow"><label for="o_lg">Girder</label><select id="o_lg">${R.dead.cls.map((c, i) => `<option value="${i}"${i === lg ? ' selected' : ''}>G${i + 1} (${esc(LD().CLS[c] || c)})</option>`).join('')}</select>
      <label for="o_lr" style="min-width:0;margin-left:12px">Region</label><select id="o_lr">${R.regions.map((q, i) => `<option value="${i}"${i === lr ? ' selected' : ''}>${esc(q.label)}</option>`).join('')}</select></div>`;
    h += '<div id="gfx_ld"></div>';   // graphic (ui/gfxa.js, mounted by after())
    const ownSteps = L.steps || O().loadFactors(L.o, {}, N).steps;
    h += card('Owner load rules', `<div class="kv"><div><span>Owner</span><span>${esc(L.o || 'AASHTO')}</span></div><div><span>η (max. Strength factors)</span><span>${f(L.eta, 3)} ${wk('own.eta')}</span></div><div><span>η (min. Strength factors)</span><span>${f(L.etaN, 3)} ${wk('own.etaN')}</span></div>
      <div><span>Design load multiplier m</span><span>${f(L.m, 2)} ${wk('own.m')}</span></div><div><span>Haunch in section properties</span><span>${L.h0 ? '0 (owner rule)' : 'as entered'} ${wk('own.h0')}</span></div></div>
      <p class="note">m and η apply to the factored demands of later modules; the haunch rule applies here (K<sub>g</sub>) and to the section properties.</p>`);
    const D = R.dead, row = i => `<tr${i === lg ? ' class="sel"' : ''}><td class="lft">G${i + 1}</td><td class="lft">${esc(LD().CLS[D.cls[i]] || D.cls[i])}</td><td>${f(D.deck[i], 4)}</td><td>${f(D.haunch[i], 4)}</td><td>${f(D.sip[i], 4)}</td><td>${f(D.dc1[i], 4)} ${wk(`dl.G${i + 1}.DC1`, '', { lg: i })}</td><td>${f(D.dc2[i], 4)} ${wk(`dl.G${i + 1}.DC2`, '', { lg: i })}</td><td>${f(D.dw[i], 4)} ${wk(`dl.G${i + 1}.DW`, '', { lg: i })}</td>${D.pl.some(v => v) ? `<td>${f(D.pl[i], 4)}</td>` : ''}${D.ut ? `<td>${f(D.ut[i], 4)}</td><td>${f(D.uf[i], 4)}</td>` : ''}</tr>`;
    h += card(`Dead loads per girder (klf), ${esc(LD().METHODS[D.method])}`, `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Girder</th><th class="lft">Class</th><th>Deck</th><th>Haunch</th><th>SIP</th><th>DC1</th><th>DC2</th><th>DW</th>${D.pl.some(v => v) ? '<th>PL</th>' : ''}${D.ut ? '<th>UT</th><th>UF</th>' : ''}</tr></thead><tbody>${Array.from({ length: N }, (_, i) => row(i)).join('')}</tbody></table></div>
      <div class="kv"><div><span>Girder steel, ${esc(R.girderLabel)} (average)</span><span>${f(R.steel.avg, 4)} klf ${wk(`dl.steel.${R.girderId}.avg`)}</span></div>
      <div><span>Steel range along the girder</span><span>${f(R.steel.min, 4)} to ${f(R.steel.max, 4)} klf</span></div><div><span>Deck width</span><span>${f(D.Wd, 2)} ft</span></div><div><span>Live-load faces L / R</span><span>${f(R.ll.L.r, 2)} / ${f(R.ll.R.r, 2)} ft ${wk('xs.rL')}</span></div></div>
      ${segCard(R, lg)}
      <p class="note">DC1 excludes the girder self-weight (separate, per plate segment) and the cross-frames (point loads from the framing and the cross-frame weights, <a href="#" data-goto="framing">Framing &amp; bracing tab</a>); both are added in the analysis (Analysis tab). Line loads: ${D.per.map(q => `${esc(q.desc)} ${f(q.plf, 4)} klf at x = ${f(q.x, 2)} ft (${esc(q.cat)}, ${esc(LD().DIST[q.dist] || q.dist)}) ${wk('dl.load.' + q.id)}`).join('; ') || 'none'}.</p>`);
    const geo = R.regions[0].geo, rows = R.regions.map((q, k) => q.members.map((m, j) => `<tr${j === lg && q === rg ? ' class="sel"' : ''}><td class="lft">${esc(q.label)}</td><td class="lft">${esc(m.label)} (${m.type === 'ext' ? 'ext.' : 'int.'})</td><td>${f(m.gM, 4)} ${wk(`df.${q.id}.G${j + 1}.gM`, '', { lg: j, lr: k })}</td><td>${q.kind === 'span' ? f(m.gV, 4) : '—'}</td><td>${f(m.fatM, 4)}</td><td>${q.kind === 'span' ? f(m.fatV, 4) : '—'}</td><td class="lft">${esc(m.method)}</td></tr>`).join('')).join('');
    h += card('Live-load distribution factors (lanes per girder)', `<div class="kv"><div><span>Design lanes N<sub>L</sub></span><span>${geo.NL} ${wk('df.geo.NL')}</span></div><div><span>Roadway</span><span>${f(geo.roadway, 2)} ft ${wk('df.geo.w')}</span></div><div><span>d<sub>e</sub> left / right</span><span>${f(geo.deL, 2)} / ${f(geo.deR, 2)} ft ${wk('df.geo.deL')}</span></div><div><span>Deflection factor</span><span>${f(R.regions[0].gDef, 4)} ${wk(`df.${R.regions[0].id}.gDef`, '', { lr: 0 })}</span></div></div>
      <div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Region</th><th class="lft">Girder</th><th>g<sub>M</sub></th><th>g<sub>V</sub></th><th>g<sub>fat,M</sub></th><th>g<sub>fat,V</sub></th><th class="lft">Method</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note">Span regions: positive moment and shear (L = span); pier regions: negative moment and interior reactions (L = average of the adjacent spans). Fatigue: one lane, multiple presence 1.2 removed.</p>
      <p class="note"><b>Basis</b> (AASHTO LRFD 10th Ed.):</p><ul class="note" style="margin:4px 0 0 18px;padding:0">
      <li><b>Support skews</b> enter as their size |θ|; the sign gives only the direction (Tables 4.6.2.2.2e-1, 4.6.2.2.3c-1).</li>
      <li><b>Moment skew reduction</b> r<sub>M</sub>, judged per span: none in a span whose two support lines differ by more than 10°, and none in a pier region where either adjacent span's two support lines do (Art. 4.6.2.2.2e).</li>
      <li><b>Exterior girder fatigue factor:</b> not less than the rigid cross-section value (Art. 4.6.2.2.2d, Eq. C4.6.2.2.2d-1), one lane, ÷ 1.2 (Art. 3.6.1.4.3b).</li></ul>
      ${R.ranges.filter(q => !q.ok).length ? `<div class="alert">Outside the range of applicability (Tables 4.6.2.2.2b-1, 4.6.2.2.3a-1, 4.6.2.2.2d-1): ${R.ranges.filter(q => !q.ok).map(q => `${esc(q.region)} ${esc(q.name)} = ${f(q.value, q.key === 'Kg' ? 0 : 2)}`).join('; ')}.</div>` : ''}`);
    h += casesCard(R, lg);   // RCURB (sb-ridot-curb PR)
    const deadG = D.steps.filter(s => !/^dl\.G\d+\./.test(s.id) || s.id.startsWith(`dl.${g}.`));
    h += card(`Worked steps: ${g}, ${esc(rg.label)}`, `<p class="note">AASHTO LRFD 10th Ed. (2024). Distances from the left deck edge.</p>${stepsHtml([...ownSteps, ...R.steps, ...deadG, ...R.steel.steps, ...rg.steps, ...rg.members[lg].steps])}`);
    return h;
  }
  /* onOutClick(e, ui): a link to the steps of another girder or region selects it; returns the step element id to show, or null */
  function onOutClick(e, ui) { const a = e.target.closest('a.wk[data-lg], a.wk[data-lr]'); if (!a) return null; e.preventDefault();
    if (a.dataset.lg != null) ui.lg = +a.dataset.lg; if (a.dataset.lr != null) ui.lr = +a.dataset.lr; return a.getAttribute('href').slice(1); }
  function onOutChange(e, ui) { if (e.target.id === 'o_lg') { ui.lg = +e.target.value; return true; } if (e.target.id === 'o_lr') { ui.lr = +e.target.value; return true; } return false; }

  /* after(el, P, R, ui): the cross-section graphic of the LLDF cases (ui/gfxa.js), after the page has set the output's HTML */
  function after(el, P, R, ui) { if (R && !(R.errors && R.errors.length)) window.SharedSteps.wire(el, { onToggle: (k, open) => { if (open) OPEN.add(k); else OPEN.delete(k); } });
    const slot = el.querySelector('#gfx_ld'); if (!slot || !R || (R.errors && R.errors.length) || !window.SBDGfxA) return;
    window.SBDGfxA.loads(slot, { P, R, lg: Math.min(ui.lg || 0, R.dead.N - 1), lr: Math.min(ui.lr || 0, R.regions.length - 1) }); }
  window.SBDUiLoads = { TOPICS, groups, after, ensure, ownerCard, parts, onChange, onClick, takeOwnerDefaults, applyOwnerDefaults, calc, output, onOutChange, onOutClick };
})();
