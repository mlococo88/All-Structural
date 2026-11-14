/* apps/ps-bridge/ui/inputs.js — the girder design's input cards on the input tabs (window.PSBInputsUI). Classic script; display and input only.
   Created 2026-11-12 (PR 2b, docs/ps-bridge-plan.md §2.2). Draws the cards of engine/fields.js (every engine input the old app exposes, with
   its label, unit and tooltip), the table inputs (straight strand rows, diaphragms, rating vehicles), the design girder card, the owner card
   and the Project tab's assumptions. The page (index.html) calls:
     cards(tab, P, R)    the HTML of this tab's girder-design cards (after the page's own bridge-level cards); R (optional, the Owner rules
                         tab): the design's engine result, for the owner's material checks in the rules table (display only, 2026-11-13)
     onChange(el, P)     an input of these cards changed: the project is updated; true = handled (the page then saves, checks and redraws)
     onClick(e, P)       a button of these cards (add / delete a table row); true = handled
     takeNote()          the message of the last owner change (the inputs it set to the owner's defaults), once; or ''
   Every input carries data-path = its project path (the input checks mark it, ui/inputcheck.js). No storage of its own. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const F = () => window.PSBFields, D = () => window.PSBDesign, PB = () => window.PBD;
  const get = (P, path) => path.split('.').reduce((o, k) => o == null ? o : o[k], P);
  const setp = (P, path, v) => { const ks = path.split('.'), last = ks.pop(), o = ks.reduce((a, k) => (a[k] == null ? (a[k] = {}) : a[k]), P); o[last] = v; };
  const fmt = (x, d) => typeof x === 'number' && isFinite(x) ? x.toFixed(d) : String(x == null ? '—' : x);
  const card = (id, title, ref, body) => `<section class="sec" id="card-${id}"><div class="secHead">${title}${ref ? ` <span class="secRef">${esc(ref)}</span>` : ''}</div><div class="secBody">${body}</div></section>`;
  let note = '';

  /* the owner's default for an input (engine key without "base."), on the design inputs: { r, cur, own, over } or null */
  function ownDef(P, key) {
    try { const i = D().inputs(P), d = PB().ownDefaults(i).find(q => q.r.key === key); return d || null; } catch (e) { return null; }
  }
  const showV = v => v === true ? 'on' : v === false ? 'off' : v == null || v === '' ? '(blank)' : String(v);
  /* field(f, P): one input row */
  function field(f, P) {
    const v = get(P, f.p), id = 'i_' + f.p, tip = esc(f.t);
    let ctl;
    if (f.k === 'sel' || f.k === 'bool') {
      const o = typeof f.o === 'function' ? f.o() : f.o;
      ctl = `<select id="${id}" data-path="${f.p}" data-kind="${f.k}" title="${tip}">${o.map(([k, t]) => `<option value="${esc(k)}"${String(v) === String(k) ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>`;
    } else ctl = `<input type="number" step="any" id="${id}" data-path="${f.p}" data-kind="${f.k}" title="${tip}" value="${esc(v == null || (typeof v === 'number' && isNaN(v)) ? '' : v)}"${f.k === 'opt' ? ' placeholder="blank"' : ''}>`;
    const od = /^base\./.test(f.p) ? ownDef(P, f.p.slice(5)) : null;
    const hint = od ? `<span class="fHint${od.over ? ' over' : ''}">${od.over ? `overrides the ${esc(od.r.owner)} default (${esc(od.r.show)})` : `${esc(od.r.owner)} default`} · ${esc(PB().ownCite(od.r))}</span>` : '';
    return `<div class="fRow"><label for="${id}" title="${tip}">${f.l}</label>${ctl}<span class="unit">${esc(f.u)}</span>${hint}</div>`;
  }
  /* rowModelNote(b): PS-33 (2026-11-14, decision pending engineer review): for a box beam or a deck slab, the row model's limit stated where the
     rows are entered: the CTDOT standard patterns' gapped rows (slab strands between the voids) and web columns (box webs) are entered as the
     nearest contiguous rows; the results use only each row's height and count. Per-row strand positions are a later PR (plan). */
  function rowModelNote(b) {
    const G = typeof GIRDERS !== 'undefined' && b ? GIRDERS[b.girder] : null; if (!G || !(G.box || G.deck)) return '';
    return ` ${G.box ? 'Box beam' : 'Deck slab'}: the standard strand patterns (CTDOT BDM plates ${G.box ? '5.2.2 / 5.2.3' : '5.1.3–5.1.6'}) have ${G.box ? 'strands in vertical columns in the webs' : 'rows with strands only between and outside the voids'}; enter them as the nearest contiguous rows (same height and count). The results use only each row's height y and count n (the strand centroid and area); the drawn positions are used for the fit check and the graphics only.`;
  }
  /* table(tp, P): a table input (strand rows, diaphragms, rating vehicles) */
  function table(tp, P) {
    const T = F().TABLES[tp], rows = get(P, tp) || [];
    const head = T.cols.map(([, lab, u, , tip]) => `<th title="${esc(tip)}">${esc(lab)}${u ? `<br><span class="unit">${esc(u)}</span>` : ''}</th>`).join('');
    const body = rows.map((r, i) => `<tr><td>${i + 1}</td>${T.cols.map(([k, lab, , rule, tip]) => `<td><input type="${rule === 'text' ? 'text' : 'number'}" step="any" data-path="${tp}.${i}.${k}" data-kind="${rule === 'text' ? 'text' : 'num'}" value="${esc(r[k] == null ? '' : r[k])}" aria-label="${esc(`${T.title}, row ${i + 1}, ${lab}`)}" title="${esc(tip)}"${rule === 'text' ? ' style="width:110px;text-align:left"' : ''}></td>`).join('')}
      <td><button type="button" data-act="del" data-tbl="${tp}" data-i="${i}" title="Delete row ${i + 1}" aria-label="Delete row ${i + 1}"${tp === 'base.rows' && rows.length === 1 ? ' disabled' : ''}>✕</button></td></tr>`).join('');
    return `<div class="tscroll"><table class="tbl" data-tbl="${tp}"><thead><tr><th>#</th>${head}<th></th></tr></thead><tbody>${body || `<tr><td colspan="${T.cols.length + 2}" class="lft note">None.</td></tr>`}</tbody></table></div>
      <button type="button" data-act="add" data-tbl="${tp}">Add row</button>`;
  }
  /* the design girder card (Girders & strands): the girder and span designed, and the values the bridge gives it */
  function designCard(P) {
    const nb = Number.isInteger(P.xs.nb) ? P.xs.nb : 0, ns = P.spans.lengths.length, d = D().sel(P);
    const gOpts = Array.from({ length: Math.max(nb, 0) }, (_, i) => [i + 1, D().label(P, i + 1)]), sOpts = Array.from({ length: ns }, (_, i) => [i + 1, `Span ${i + 1}`]);
    const s = (path, label, opts, cur, tip) => `<div class="fRow"><label for="i_${path}" title="${esc(tip)}">${label}</label><select id="i_${path}" data-path="${path}" data-kind="int" title="${esc(tip)}">${opts.map(([v, t]) => `<option value="${v}"${v === cur ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></div>`;
    let kv = '';
    if (!D().checks(P).errors.length && !window.PSBModel.validate(P).errors.length) {
      const TABN = { layout: 'Bridge layout', xsec: 'Cross-section', gird: 'Girders & strands' };
      kv = `<div class="kv">${D().driven(P).map(q => `<div><span>${esc(q.label)}</span><span data-dv="${esc(q.key)}">${esc(fmt(q.value, q.d == null ? 2 : q.d))}${q.unit ? ' ' + esc(q.unit) : ''} <a href="#" data-goin="${q.where}" title="Entered on the ${esc(TABN[q.where])} tab">${esc(TABN[q.where])}</a></span></div>`).join('')}</div>`;
    }
    return card('design', 'Design girder', 'one design (no girder types)', `${s('design.g', 'Girder', gOpts, d.g, 'The girder line designed (G1 = left exterior). With girder types (PS-8, Girders &amp; strands tab) every type is checked on its own lines.')}
      ${s('design.s', 'Span', sOpts, d.s, 'The span designed (spans on the Bridge layout tab).')}${kv}
      <p class="note">The bridge gives the design these values (the old app's "Preliminary designer" bridge values, PBD.applyBridge, plus continuity, skew and the overhang): they are entered on the tab named. Every other girder input is on the input tabs. Girder types (interior / exterior per span, PS-8; Girders &amp; strands tab) replace this choice.</p>`);
  }
  /* the owner card (Owner rules): owner, the η questions, the design load multiplier, the sidewalk question and the rules list.
     R (when given): the owner's material checks (MAT rule ids, the engine's R.checks by the rule's check name) show the engine's value, limit
     and ratio in "Applied here", worked as ratio = value / limit (a maximum) or limit / value (a minimum), the engine's rule; each rules row
     has id own-rule-<rule id> (the check summary's Owner limits chip opens it). Display only: every number is an engine value (data-ev).
     2026-11-13: also the RIDOT girder age at continuity (cont.age, continuity on): t_d in days, the minimum 90 days, ratio = limit / t_d. */
  const MAT = ['fc.min', 'fc.range', 'fci.max', 'fci.range', 'cont.age'];
  function matCell(r, R) {
    const i = R && R.checks ? R.checks.findIndex(c => c.n === r.nm) : -1; if (i < 0) return '';
    const c = R.checks[i], K = window.PSBOutKit, age = r.id === 'cont.age', dv = age ? 0 : 2, u = age ? 'days' : 'ksi', ev = (k, d) => K.ev(R, `checks.${i}.${k}`, d);
    const sym = age ? 't<sub>d</sub> (girder age at continuity)' : /f′ci/.test(r.nm) ? 'f′<sub>ci</sub>' : 'f′<sub>c</sub>';
    const isMin = age || (Object.is(c.r, c.lim / c.v) && !Object.is(c.r, c.v / c.lim));   // the engine's ratio for a minimum is limit / value (the age: a minimum, r = 90 / t_d)
    return `<br>${sym} = ${ev('v', dv)} ${u}; governing ${isMin ? 'minimum' : 'maximum'} ${ev('lim', dv)} ${u}; ratio = ${isMin ? `${ev('lim', dv)} / ${ev('v', dv)}` : `${ev('v', dv)} / ${ev('lim', dv)}`} = <b>${ev('r', 3)}</b> ${c.pass ? 'PASS' : '<b style="color:var(--fail)">FAIL</b>'} (check summary: Owner limits)`;
  }
  function ownerCard(P, R) {
    const P_ = PB(), b = P.base, o = P_.ownerOf(b), ow = P_.OWN_RULES.owners[o] || {}, rules = P_.ownRules(o);
    let inp = null; try { inp = D().inputs(P); } catch (e) { inp = b; }
    const OL = P_.ownLoads(inp);
    const K = { 'default': 'Input default', 'shall-check': 'Check', 'should-warning': 'Warning', 'load': 'Load rule', 'report': 'Requirement reported' };
    const yn = (path, label, tip) => field({ p: path, l: label, t: tip, k: 'bool', o: [['false', 'No'], ['true', 'Yes']], u: '' }, P);
    let rows = '';
    ['D', 'R', 'I'].forEach(k => { const r = P_.ownRule(o, 'ld.eta' + k); if (r && !r.value.fixed) rows += yn('base.opt.eta' + k, `${esc(r.value.q)} (η<sub>${k}</sub> = ${fmt(r.value.f, 2)})`, `${r.text} (${P_.ownCite(r)})`); });
    const rM = P_.ownRule(o, 'ld.mult'), rD = P_.ownRule(o, 'defl.ll');
    if (rM) rows += field({ p: 'base.opt.llMult', l: 'HL-93 design load multiplier', u: '', t: `${rM.text} (${P_.ownCite(rM)}). Blank = ${rM.value}.`, k: 'opt' }, P);
    if (rD) rows += yn('base.opt.sidewalk', `Bridge with sidewalks (${esc(P_.ownCite(rD))})`, rD.text);
    const applied = r => {
      if (r.kind === 'default') { const cur = F().get(inp, r.key), over = String(cur) !== String(r.value); return over ? `<span class="own-over">Your value ${esc(showV(cur))} (owner: ${esc(r.show)})</span>` : `Owner default: ${esc(r.show)}`; }
      if (r.kind === 'load') return r.value.fixed ? `η = ${fmt(r.value.f, 2)} (fixed)` : `${esc(r.value.q)}: ${inp.opt['eta' + r.id.slice(-1)] === true ? 'yes, η = ' + fmt(r.value.f, 2) : 'no, η = 1.00'}`;
      if (r.kind === 'shall-check' && MAT.includes(r.id)) return 'Check of the design' + (R ? matCell(r, R) || ' (not made for this design)' : ' (shown when the inputs have no error)');
      if (r.kind === 'shall-check') return 'Check of the design (output tabs)';
      if (r.kind === 'should-warning') return 'Warning of the design';
      return 'Reported with the design';
    };
    const own = card('owner', 'Owner (DOT)', 'load modifiers and owner rules', `<div class="fRow"><label for="i_base.owner" title="The bridge owner's rules on top of AASHTO LRFD 10th Ed. Changing the owner sets each input still at its default to the new owner's default; values you entered are kept.">Owner</label>
      <select id="i_base.owner" data-path="base.owner" data-kind="owner">${P_.OWN_LIST.slice().reverse().map(k => `<option value="${k}"${k === o ? ' selected' : ''}>${k === 'AASHTO' ? 'AASHTO (no owner rules)' : `${k} (${esc(P_.OWN_RULES.owners[k].short)})`}</option>`).join('')}</select></div>
      ${rows}<p class="note">${esc(ow.manual || o)}${o !== 'AASHTO' ? ` (AASHTO LRFD ${esc(ow.aashto || '')} basis). ${esc(P_.OWN_RULES.note)}` : ': every input, factor and check is the tool\'s own.'} Strength I load modifier η = η<sub>D</sub>·η<sub>R</sub>·η<sub>I</sub> = ${fmt(OL.etaD, 2)} × ${fmt(OL.etaR, 2)} × ${fmt(OL.etaI, 2)} = <b>${fmt(OL.eta, 4)}</b>${rM ? `; LL+IM × <b>${fmt(OL.mLL, 2)}</b>` : ''} (worked on the Loads &amp; LLDF output tab).</p>
      ${rules.length ? `<div class="tscroll"><table class="tbl"><thead><tr><th class="lft">Section</th><th class="lft">Requirement (paraphrase)</th><th class="lft">Kind</th><th class="lft">Applied here</th></tr></thead><tbody>${rules.map(r => `<tr id="own-rule-${esc(r.id)}"><td class="lft">${esc(r.sec)}</td><td class="lft">${esc(r.text)}</td><td class="lft">${esc(K[r.kind] || r.kind)}</td><td class="lft">${applied(r)}</td></tr>`).join('')}</tbody></table></div>` : ''}`);
    return own;
  }
  /* the Project tab's assumptions (engineer rule: every assumption is a note in its tab and in the Report) */
  function assumptions(P) {
    const d = D().sel(P), nb = P.xs.nb, BR = window.PSBBridge, typed = !!(BR && BR.hasTypes(P));
    const items = typed ? [   // PR 3a-1: girder types (engine/bridge.js)
      `Girder types (Girders &amp; strands tab, PS-8): each span has its girder types (new projects: Interior and Exterior); each type is the base design with the inputs it has of its own and is checked on every girder line assigned to it. ${BR.cells(P).length} type × line cell${BR.cells(P).length === 1 ? '' : 's'}; the output tabs show the one chosen above them. A line with no type is not checked (listed on the Girders &amp; strands tab).`,
      'The bridge gives each type on each line its span length, girder spacing, number of girders, position (G1 and the last girder exterior), the support skew of its span, the deck overhang on its side and the continuity (as the old app\'s bridge bar).',
      'Unequal bays (PS-9; plan §7 item 3): each girder line takes as its spacing S the bay next to it (G1 and the last girder) or the mean of its two bays (an interior girder: its tributary width), the rule of the Steel Bridge app (shared/lldf.js); the engine then uses that S for its distribution factors, b<sub>eff</sub> and the deck weight. The exterior girder\'s rigid-section check (C4.6.2.2.2d) in the engine takes the girders at an equal spacing S (the exterior bay): with unequal bays it is an approximation (pending engineer review).',
      'Different skews at the two supports of a span: the larger |θ| (the obtuse-corner shear correction, 4.6.2.2.3c); below 30° the moment DF has no skew reduction (Table 4.6.2.2.2e-1), so one θ is exact; 30° or more with the DF computed is an input error (enter equal skews or the DF).',
      'Every girder of a span has the same shape (PS-8); the deck, the diaphragms, the owner rules and the continuity steel are entered once for the bridge.'
    ] : [
      `One girder design: G${d.g} (${d.g === 1 || d.g === nb ? 'exterior' : 'interior'}) in span ${d.s} (Girders &amp; strands tab): this project has no valid girder types. With girder types (Girders &amp; strands tab, PS-8) every type is checked on every line assigned to it.`,
      'The bridge gives the design its span length, girder spacing, number of girders, position (G1 and the last girder exterior), the support skew of its span, the deck overhang on its side and the continuity (as the old app\'s bridge bar; Girders &amp; strands tab, Design girder card).',
      'Unequal bays (PS-9): the design girder takes as its spacing S the bay next to it (exterior) or the mean of its two bays (interior); different skews at the two supports of the design span: the larger |θ| (Loads &amp; LLDF tab).'
    ];
    items.push(
      (window.PSBBridgeDL && window.PSBBridgeDL.on(P) ? 'DC2 (barriers, sidewalks, superimposed) and DW (wearing surface) are distributed to each girder line from the Cross-section tab by the Steel Bridge app\'s method (PS-9), shown per line on the Loads &amp; LLDF tab.' : 'DC2 (barrier / superimposed) and DW are entered per girder type (Loads tab; Cross-section tab: dead load distribution "Entered per girder type"); the Steel Bridge distribution to each girder line is the other choice there (PS-9).'),
      'Calculations: the old Prestressed Bridge Design engine, moved unchanged (PR 2a, 0 differences on 658 cases); AASHTO LRFD 10th Ed. (2024). Normal-weight concrete; strand f<sub>pu</sub> = 270 ksi, low relaxation.',
      'Hold-down force: F<sub>hd</sub> = 2 n<sub>h</sub> f<sub>pbt</sub> A<sub>b</sub> sin α ≤ 0.75 W, checked always for MassDOT and CTDOT (their rule) and, for AASHTO and RIDOT, when the PS-10 box is on (default on, the fraction editable; Owner rules tab). AASHTO LRFD itself sets no limit. MIDAS demand import by file: a later PR.'
    );
    return card('assume', 'Assumptions', '', `<ul class="note asm">${items.map(t => `<li>${t}</li>`).join('')}</ul>`);
  }
  /* cards(tab, P): the HTML of the tab's girder-design cards */
  function cards(tab, P, R) {
    if (!P.base) return '';
    let h = '';
    if (tab === 'proj') return assumptions(P);
    if (tab === 'gird' && !(window.PSBBridge && window.PSBBridge.hasTypes(P))) h += designCard(P);   // PR 3a-1: with girder types, ui/types.js
    if (tab === 'own') h += ownerCard(P, R);
    F().CARDS.filter(c => c.tab === tab).forEach(c => {
      if (c.when && !c.when(P.base, P)) return;
      let body = c.fields.filter(f => !f.when || f.when(P.base, P)).map(f => field(f, P)).join('');
      // PR A (engineer 2026-11-14): a standard box beam / voided slab of the CTDOT plates: the "to be confirmed" note (engine/sections.js tbcNote)
      const tbc = c.id === 'shape' && window.PSBSections && window.PSBSections.tbcNote ? window.PSBSections.tbcNote(P.base.girder) : '';
      h += card(c.id, c.title, c.ref, body + (c.note ? `<p class="note">${c.note(P.base, P)}</p>` : '') + (tbc ? `<p class="note" id="secTbcNote"><b>${tbc}</b></p>` : ''));
      if (c.id === 'shape') h += card('rows', 'Straight strand rows', 'y from the soffit; debonding entered only (auto-design never adds it, PS-12)', table('base.rows', P)
        + `<p class="note">${(P.base.rows || []).reduce((a, r) => a + (+r.n || 0), 0)} straight strands + ${+P.base.harp.n || 0} draped = ${(P.base.rows || []).reduce((a, r) => a + (+r.n || 0), 0) + (+P.base.harp.n || 0)} strands. Debonding rules (5.9.4.3.3) are checked as warnings of the design.</p>`
        + `<p class="note" id="rowsFitNote">Each row is drawn and checked as a contiguous group of strands on the 2 in grid, centred on the girder ℄. A strand centre must be inside the concrete, at least 2 in from its edges (PS-28) and at least 1.5 in from the face of a void (PS-33).${rowModelNote(P.base)}</p>`);
    });
    if (tab === 'dd') h = card('diaph', 'Diaphragms (DC1 point loads)', 'entered once (PS-14)', table('base.loads.diaph', P) + '<p class="note">Point loads on the non-composite simple span of the design girder, from the left ℄ bearing; the same diaphragms apply to every girder line (PS-14).</p>') + h;
    if (tab === 'loads') h += card('veh', 'Legal / permit vehicles', 'MBE 6A.4.4, 6A.4.5, Strength I', table('base.rateVeh', P) + '<p class="note">Fully factored live-load moment and shear per vehicle (DF, IM, MPF and the LRFR live-load factor applied, from your own analysis); the app supplies the capacity and the dead loads.</p>')
      + '<div class="ph"><b>External demands (MIDAS) by file</b> <span class="devBadge">later PR</span><ul><li>the composite-stage DC2, DW and LL+IM envelopes of a MIDAS model (schema psbeam-external-demands), with the DF and multiple presence per effect</li></ul></div>';
    return h;
  }
  /* onChange(el, P): true = handled */
  function onChange(el, P) {
    const path = el.dataset.path, k = el.dataset.kind; if (!path) return false;
    if (!/^(base|design)\./.test(path)) return false;
    const v = el.value;
    if (k === 'num') setp(P, path, v.trim() === '' ? '' : Number(v));
    else if (k === 'opt') setp(P, path, v.trim() === '' ? '' : Number(v));
    else if (k === 'bool') setp(P, path, v === 'true');
    else if (k === 'int') { P.design = Object.assign(D().sel(P), P.design || {}); setp(P, path, parseInt(v, 10)); }
    else if (k === 'owner') {
      const from = PB().ownerOf(P.base);
      const r = PB().ownApply(P.base, v, typeof DEFAULTS !== 'undefined' ? DEFAULTS : {});
      const keep = P.base.cont && P.base.cont.on;   // cont.on is the bridge's continuity (Bridge layout tab), not an owner default here
      P.base = r.inp; if (P.base.cont) P.base.cont.on = keep;
      const set = r.set.filter(q => q.key !== 'cont.on'), kept = r.kept.filter(q => q.key !== 'cont.on');
      note = `Owner ${v}.` + (set.length ? ` Set to the owner's defaults: ${set.map(q => `${q.key} ${showV(q.from)} → ${showV(q.to)}`).join('; ')}.` : '') + (kept.length ? ` Kept (your values): ${kept.map(q => `${q.key} = ${showV(q.value)} (owner: ${showV(q.own)})`).join('; ')}.` : '')
        + (window.PSBBridgeDL ? window.PSBBridgeDL.onOwner(P, from, v) : '')   // PR 3a-3 (PS-21): the DC2 / DW method follows the owner while at its default
        + (v === 'CTDOT' && P.spans.continuity === 'composite' ? ' CTDOT designs multi-span bridges as simple spans with a continuous deck (V2 5.12.1.1CT): continuity is your choice on the Bridge layout tab.' : '');
    }
    else if (k === 'text') setp(P, path, v);
    else setp(P, path, v);
    return true;
  }
  const NEW = { 'base.rows': rows => ({ n: 2, y: (rows.length ? +rows[rows.length - 1].y || 0 : 0) + 2, dbnd: 0, nd: 0 }), 'base.loads.diaph': () => ({ P: 0.66, a: 0 }), 'base.rateVeh': () => ({ name: '', M: 0, V: 0, W: 0 }) };
  function onClick(e, P) {
    const b = e.target.closest('[data-act][data-tbl]'); if (!b) return false;
    const tp = b.dataset.tbl; let rows = get(P, tp); if (!Array.isArray(rows)) { rows = []; setp(P, tp, rows); }
    if (b.dataset.act === 'add') rows.push(NEW[tp](rows));
    else if (b.dataset.act === 'del') { if (tp === 'base.rows' && rows.length <= 1) return true; rows.splice(+b.dataset.i, 1); }   // one strand row stays: the engine's mergeInputs reads an empty list as its default rows
    else return false;
    return true;
  }
  function takeNote() { const n = note; note = ''; return n; }
  window.PSBInputsUI = { cards, field, table, onChange, onClick, takeNote };
})();
