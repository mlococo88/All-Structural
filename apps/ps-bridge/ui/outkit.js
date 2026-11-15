/* apps/ps-bridge/ui/outkit.js — the pieces the output tabs share (window.PSBOutKit). Classic script; display only. Created 2026-11-12 (PR 2b-2).
   The steel app's output-tab style (apps/steel-bridge/ui/loads.js: cards, key-value grids, tables, worked steps grouped in topics with
   SharedSteps.groupsHTML, "§" links to a step), written for this app (not a copy of a steel file).
     ev(R, path, d, unit, div)  an engine value (÷ div for a unit change, e.g. 12: kip-in shown as kip-ft) on the tab: <span data-ev="path" data-d="d"> with the value of R at path, d decimals (thousands
                           grouped); tests/smoke/ps-bridge-skeleton.mjs checks every data-ev against computeAll on the page (values = engine values)
     val(R, path)          the value of R at a dotted path ('cp.Ic', 'diagrams.30.M_DC')
     fx(v, d)              the number as shown;  card(title, body, id);  kv(rows [[label, html]]);  wk(id, text, tab) a link to step id (on tab)
     groups(list, topics)  SharedSteps.group with the rating-factor topics (topic rf: RegExp) given an RF status (2026-11-15)
     steps(list, topics, open)  the worked steps in topics (SharedSteps.group / groupsHTML), each step <li id="st-<id>">
     after(el, open)       wires the topics (expand / collapse, § links) after the tab's HTML is set */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = () => window.SharedSteps;
  const val = (R, path) => String(path).split('.').reduce((o, k) => o == null ? o : o[k], R);
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d }).replace(/^-(0(\.0*)?)$/, '$1') : '—';
  const ev = (R, path, d, unit, div) => `<span data-ev="${esc(path)}" data-d="${d}"${div ? ` data-div="${div}"` : ''}>${fx(div ? val(R, path) / div : val(R, path), d)}</span>${unit ? ' ' + unit : ''}`;   // div: a unit change (12: kip-in shown in kip-ft)
  const card = (title, body, id) => `<section class="sec"${id ? ` id="${esc(id)}"` : ''}><div class="secHead">${title}</div><div class="secBody">${body}</div></section>`;
  const kv = rows => `<div class="kv">${rows.map(([l, h]) => `<div><span>${l}</span><span>${h}</span></div>`).join('')}</div>`;
  const wk = (id, text, tab) => `<a class="wk" href="#st-${esc(id)}"${tab ? ` data-gotab="${esc(tab)}"` : ''} title="Worked step">${text || '§'}</a>`;
  const stepLi = s => `<li id="st-${esc(s.id)}"><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${S().line(s, true)}</div>${s.note ? `<div class="nt">${esc(S().noteText(s.note))}</div>` : ''}</li>`;
  /* groups(list, topics): SharedSteps.group, then (2026-11-15, batch A) each topic with rf: RegExp (step ids of rating factors, e.g. the Rating
     tab) gets the status of a rating factor, not of a demand / capacity ratio: its result step and chip the lowest RF of those steps (99, the
     engine's "not applicable", left out: chip —), 'ng' when one is < 1.0 (its ok false), else 'ok'. group() itself reads a unitless step with
     an ok flag as demand / capacity (largest governs, > 1 red), which is wrong for an RF. Display only (shared/steps.js unchanged). */
  const groups = (list, topics) => S().group(list, topics, { strip: false }).map(t => {
    const d = (topics || []).find(q => q.key === t.key), rs = d && d.rf ? t.steps.filter(s => d.rf.test(String(s.id)) && typeof s.value === 'number') : [];
    if (!rs.length) return t;
    const live = rs.filter(s => s.value < 99), lo = live.reduce((a, b) => (b.value < a.value ? b : a), live[0] || null), ng = rs.some(s => s.ok === false);
    return Object.assign({}, t, { res: lo || rs[0], ratio: NaN, cls: ng ? 'ng' : 'ok', chip: lo ? 'RF ' + fx(lo.value, 3) + (ng ? ' NG' : '') : 'RF —' });
  });
  const steps = (list, topics, open) => S().groupsHTML(groups(list, topics), { open, item: stepLi });
  const after = (el, open) => S().wire(el, { onToggle: (k, on) => { if (on) open.add(k); else open.delete(k); } });
  /* tileLinker(el, ctx) -> path => the § link of the value at R path (2026-11-15, batch B: the stat tiles of the graphics, as the steel app's):
     the § the tab writes next to the same value (a data-ev span outside the graphics followed by a.wk); else the step whose engine path it
     is (ctx.W[*].paths, on its tab); else, a check ratio checks.<i>.r, the step of that check (ui/dash.js GROUPS). '' when none. */
  const WTAB = { section: 'sec', loads: 'lds', analysis: 'an', losses: 'loss', stresses: 'str', flexure: 'flex', shear: 'shear', endzone: 'end', camber: 'camb', handling: 'hand', deck: 'deck', rating: 'rt' };
  const tileLinker = (el, ctx) => path => {
    const here = ctx && ctx.ui ? ctx.ui.otab : null, lk = (id, tab) => wk(id, '§', tab && tab !== here ? tab : null);
    if (el && el.querySelectorAll) for (const sp of el.querySelectorAll('[data-ev]')) { if (sp.getAttribute('data-ev') !== path || (sp.closest && sp.closest('.vk'))) continue;
      const a = sp.nextElementSibling; if (a && a.matches && a.matches('a.wk')) return a.outerHTML; }
    for (const [k, w] of Object.entries((ctx && ctx.W) || {})) for (const [id, p] of Object.entries((w && w.paths) || {})) if (p === path) return lk(id, WTAB[k]);
    const m = /^checks\.(\d+)\.r$/.exec(path), c = m && ctx && ctx.R && ctx.R.checks ? ctx.R.checks[+m[1]] : null, GR = window.PSBDashUI && window.PSBDashUI.GROUPS;
    if (c && GR) for (const gp of GR) { if (gp.input) continue; const q = gp.checks.find(z => z[0] === c.n); if (q) return lk(q[1], gp.tab); }
    return '';
  };
  /* gcard(title, id): a result graphic's slot #id in a titled card (2026-11-15, batch B: the steel app's "SECTION GRAPHIC" cards); class gfxCard:
     report/fromtab.js reads it as the slot alone (the Report unchanged); the page hides a gfxCard left empty (no graphic for the design) */
  const gcard = (title, id) => `<section class="sec gfxCard"><div class="secHead">${title}</div><div class="secBody"><div id="${esc(id)}"></div></div></section>`;
  window.PSBOutKit = { esc, val, fx, ev, card, kv, wk, stepLi, groups, steps, after, tileLinker, gcard };
})();
