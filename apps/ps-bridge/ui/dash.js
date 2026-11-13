/* apps/ps-bridge/ui/dash.js — the left check summary column (window.PSBDashUI). Classic script. Created 2026-11-12 (PR 1 skeleton,
   docs/ps-bridge-plan.md §2). ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): the column's head, the « / » shrink toggle, the chip
   and input-error layout follow apps/steel-bridge/ui/dash.js (window.SBDDashUI) and use the same CSS (#sbDashCol, #sbDashHead, .sdChip, …,
   copied into index.html). The steel file reads the steel modules' results (SBDSummary); this one reads the design girder's engine checks
   (computeAll R.checks, PR 2c-1; Flexure and Shear PR 2c-2; End zone & hold-down and Camber & deflection PR 2d-1; Handling, Deck PR 2d-2): one chip per check group whose tab is built (the steel dash pattern: its governing ratio and check,
   PASS / FAIL, ▸ opens each check of the group; a chip or a check opens its tab and the worked step of the value), the other groups listed
   "not run" with the PR that brings them; the input errors are listed as links. Display only: nothing is calculated here (the ratios are
   the engine's c.r, PASS = the engine's c.pass, r ≤ 1.0001). Screens 1200 px and wider (CSS); not printed. The shrunk state is the
   per-browser UI key psb2.dashCollapsed_v1 ('1' shrunk; not in the project, the autosave or the export).
   PR 2d-2: a group whose module is off for the design (Handling, Deck: no engine check) shows an "off" chip that opens its input tab.
   The Rating chip (PR 2d-2) is not an engine check: it shows the lowest HL-93 inventory rating factor of the engine (R.rating, R.shrRating,
   R.svcRating; RF ≥ 1.0 or < 1.0) and is not counted in the PASS / FAIL totals.
   Owner material limits (engineer, 2026-11-13; display only): the engine's checks of the girder f′c and the release f′ci against the owner's
   limits (RIDOT 5.2.1, MassDOT 3.7.2.1, CTDOT V2 5.9.1.2) are the chip "Materials (owner limits)" (now "Owner limits"), counted in the PASS / FAIL totals like
   every other group; its group has input: the chip and its checks open the Owner rules input tab at the rule's row of the rules table
   (ui/inputs.js, row id own-rule-<rule id>), where the limit and the engine's value, limit and ratio are shown. No chip for AASHTO.
   2026-11-13 (display; decision pending the engineer's review): the RIDOT check "Girder age at continuity (RIDOT 5.6.3.3)" (continuity on)
   joins that group, renamed "Owner limits" (it holds more than the materials); the same Owner rules row (own-rule-cont.age) and counts.

   PR 3a-2 (2026-11-13): o.all() = PSBBridge.results of every girder type × line: each chip governs over every type and line, one count per type
   per check (its worst line, SB-5), each entry naming its type and line (several cells); a click first shows that type and line (o.pick).

   init(o): o = { el, store (localStorage or null), getP(), errors() ([{ path, msg }]), result() (computeAll of the design or null),
   all() (PR 3a-2, or absent), pick(k, g), goto(tab, step), fix(i) }; refresh() after the page draws. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const KEY = 'psb2.dashCollapsed_v1';
  /* the check groups of the PS app, the output tab that works each and the engine checks (R.checks names) in it with the step of each
     (docs/ps-bridge-plan.md §2.3, §5); a group with pr is not built yet */
  const GROUPS = [
    { id: 'rel', name: 'Release stresses', tab: 'str', checks: [['Release comp', 'st.rc'], ['Release tens', 'st.rt'], ['Release tens (+M, bot)', 'st.rtb']] },
    { id: 'srv', name: 'Service stresses', tab: 'str', checks: [['Srv comp (perm)', 'st.s1'], ['Srv comp (full)', 'st.s2'], ['Srv tens (top)', 'st.s2t'], ['Srv III tens', 'st.s3'], ['Deck comp', 'st.dk'],
      ['Srv III top tens (pier, 5.12.3.3.5)', 'st.pier.s3TopN'], ['Top tens. steel (pier, 5.12.3.3.5)', 'st.pier.AsTop'], ['Srv comp (bot, −M, 5.12.3.3.5)', 'st.pier.fBot']] },
    { id: 'fat', name: 'Fatigue I', tab: 'str', checks: [['Fatigue I (strand)', 'st.fat.dfs'], ['Fatigue I (concrete, 5.5.3.1)', 'st.fat.cTop']] },
    { id: 'flex', name: 'Flexure', tab: 'flex', checks: [['Flexure', 'fx.gov'], ['Min reinf', 'fx.min.r'], ['Neg flexure (pier)', 'fx.pier.r'], ['Pos. moment connection (5.12.3.3.8)', 'fx.conn.r']] },
    { id: 'shear', name: 'Shear', tab: 'shear', checks: [['Shear', 'sh.gov'], ['Long. reinf (5.7.3.5)', 'sh.Tr'], ['Interface shear (5.7.4)', 'sh.ifr']] },
    { id: 'end', name: 'End zone & hold-down', tab: 'end', checks: [['Splitting steel (5.9.4.4)', 'ez.dc'], ['Confinement steel (5.9.4.4.2)', 'ez.conf.gov'], ['Release tens. steel (5.9.2.3.1b)', 'ez.rel.dc'],
      ['Hold-down force (MassDOT 3.7.2.2)', 'ez.hd.r'], ['Hold-down force (CTDOT 5.9.1.6)', 'ez.hd.r'], ['Hold-down force (PS-10)', 'ez.hd.r'], ['Debonded strands (CTDOT 5.9.4.3.3)', 'ez.db.r']] },
    { id: 'camb', name: 'Camber & deflection', tab: 'camb', checks: [['LL deflection', 'cb.ll.r']] },
    { id: 'hand', name: 'Handling', tab: 'hand', off: 'loads', checks: [['Lifting stress', 'hn.lift.r'], ['Lifting FS (crack, screening)', 'hn.FSl.r'], ['Hauling FS (crack, screening)', 'hn.FSh.r']] },
    { id: 'deck', name: 'Deck', tab: 'deck', off: 'dd', checks: [['Deck +M', 'dk.pos.r'], ['Deck −M', 'dk.neg.r'], ['Deck overhang', 'dk.oh.r']] },
    // the owner's limits (engine PBD-E checks): on the Owner rules input tab (input: the tab; each check's st = its row of the rules table):
    // the material limits and (2026-11-13) the RIDOT girder age at continuity
    { id: 'mat', name: 'Owner limits', tab: 'own', input: true, checks: [['Girder f′c (RIDOT 5.2.1)', 'own-rule-fc.min'], ['Girder f′c (CTDOT 5.9.1.2)', 'own-rule-fc.range'],
      ['Release strength f′ci (MassDOT 3.7.2.1)', 'own-rule-fci.max'], ['Release strength f′ci (CTDOT 5.9.1.2)', 'own-rule-fci.range'], ['Girder age at continuity (RIDOT 5.6.3.3)', 'own-rule-cont.age']] }];
  /* the Rating chip: the HL-93 inventory rating factors of the engine (not checks), the lowest governs */
  const RATING = { id: 'rt', name: 'Rating', tab: 'rt', rf: [['Flexure, inventory', R => R.rating.RFinv, 'rt.RFinv'], ['Shear, inventory', R => R.shrRating.RFinv, 'rt.RFvInv'], ['Service III', R => R.svcRating.RF, 'rt.RFs3']] };
  /* the link of a check: its output tab and step, or (a group on an input tab) the input tab and the element id */
  const go = (gp, st, cell) => (cell ? `data-sdcell="${cell.k}|${cell.g}" ` : '') + (gp.input ? `data-sdown="${gp.tab}|${st}"` : `data-sdgo="${gp.tab}|${st}"`);
  /* PR 3a-2: the girder type and line of an entry (several cells only) */
  const on = z => z && z.cell && D.many ? ` — ${z.cell.label} on G${z.cell.g}` : '';
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : v === Infinity ? '∞' : '—';
  /* the checks of a group in R (those the engine made for this design) and the governing one (largest ratio). PR 3a-2: with the results of
     every girder type × line (A = PSBBridge.results), one entry per type and check, its worst line (SB-5: one count per type per check),
     each naming its type and line (cell) */
  function grp(R, gp, A) {
    if (A) { const all = [];
      A.types.forEach(t => gp.checks.forEach(([n, st]) => { const q = t.gov[n]; if (q) all.push({ c: q.c, st, cell: q.cell }); }));
      const gov = all.reduce((b, z) => !b || z.c.r > b.c.r ? z : b, null);
      return { all, gov, st: !all.length ? 'na' : all.some(z => !z.c.pass) ? 'fail' : 'pass' }; }
    const all = gp.checks.map(([n, st]) => { const c = R.checks.find(q => q.n === n); return c ? { c, st } : null; }).filter(Boolean);
    const gov = all.reduce((b, z) => !b || z.c.r > b.c.r ? z : b, null);
    return { all, gov, st: !all.length ? 'na' : all.some(z => !z.c.pass) ? 'fail' : 'pass' };
  }
  const D = { o: null, coll: false, open: new Set() };
  const rd = k => { try { return D.o.store ? D.o.store.getItem(k) : null; } catch (e) { return null; } };
  const wr = (k, v) => { try { if (D.o.store) D.o.store.setItem(k, v); } catch (e) { /* not kept */ } };
  function setColl(v) { D.coll = !!v; document.body.classList.toggle('sbDashColl', D.coll); wr(KEY, D.coll ? '1' : '0'); draw(); }
  const head = cnt => `<div id="sbDashHead"><button type="button" id="sbDashTgl" aria-expanded="${!D.coll}" title="${D.coll ? 'Show the check summary' : 'Shrink the check summary to a strip'}">${D.coll ? '»' : '«'}</button><h2 id="sbDashTtl">Check summary</h2>${cnt}</div>`;
  function draw() {
    const o = D.o; if (!o || !o.el) return;
    const E = o.errors ? o.errors() : [];
    if (E.length) {
      o.el.innerHTML = head(`<span class="sdC"><span class="sdF">${E.length} to fix</span></span>`)
        + (D.coll ? '' : `<p class="sdNote">Input errors: no results are shown until they are fixed.</p><ul class="sdList" style="margin-left:4px">${E.map((e, i) => `<li><a href="#" class="sd-fail" data-icgo="${i}">${esc(e.msg)}</a></li>`).join('')}</ul>`);
      return;
    }
    const R = o.result ? o.result() : null, A = R && o.all ? o.all() : null;   // PR 3a-2: every girder type × line
    D.many = !!(A && A.n > 1);
    if (!R) { o.el.innerHTML = head('<span class="sdC"><span class="sdN">not run</span></span>') + (D.coll ? '' : '<p class="sdNote">The engine could not compute this design: no checks (see the output panel).</p>'); return; }
    const G = GROUPS.map(gp => gp.pr ? { gp, st: 'notrun' } : { gp, ...grp(R, gp, A) }), run = G.filter(q => q.st === 'pass' || q.st === 'fail'), nOff = G.filter(q => q.st === 'na' && q.gp.off).length;
    const nF = run.reduce((a, q) => a + q.all.filter(z => !z.c.pass).length, 0), nP = run.reduce((a, q) => a + q.all.filter(z => z.c.pass).length, 0);
    const top = run.map(q => q.gov && { ...q.gov, gp: q.gp }).filter(Boolean).reduce((b, z) => !b || z.c.r > b.c.r ? z : b, null);
    const cnt = `<span class="sdC">${nF ? `<span class="sdF">${nF} FAIL</span>` : ''}${nP ? `<span class="sdP">${nP} PASS</span>` : ''}${nOff ? `<span class="sdN">${nOff} off</span>` : ''}</span>`;
    if (D.coll) { o.el.innerHTML = head(cnt); return; }
    const LBL = { pass: 'PASS', fail: 'FAIL' };
    const chips = G.map(q => {
      const gp = q.gp;
      if (gp.pr) return `<div class="sdChip sd-notrun"><span></span><a href="#" class="sdMain" data-sdtab="${gp.tab}" title="Not built yet: comes in PR ${gp.pr} (docs/ps-bridge-plan.md §5)"><span class="sdName">${esc(gp.name)}</span><span class="sdVal">not run</span><span class="sdSt">PR ${gp.pr}</span></a></div>`;
      if (q.st === 'na') return gp.off ? `<div class="sdChip sd-notrun" data-sdgrp="${gp.id}"><span></span><a href="#" class="sdMain" data-sdin="${gp.off}" title="Off for this design: turn it on on its input tab"><span class="sdName">${esc(gp.name)}</span><span class="sdVal">off</span><span class="sdSt">input</span></a></div>` : '';
      const op = D.open.has(gp.id), g = q.gov;
      const rows = q.all.map(z => `<li><a href="#" ${go(gp, z.st, z.cell)} class="sd-${z.c.pass ? 'pass' : 'fail'}">${esc(z.c.n + on(z))}: ${fx(z.c.r, 3)}</a></li>`).join('');
      return `<div class="sdChip sd-${q.st}" data-sdgrp="${gp.id}"><button type="button" class="sdX" data-sdx="${gp.id}" aria-expanded="${op}" title="${op ? 'Hide' : 'Show'} each check">${op ? '▾' : '▸'}</button><a href="#" class="sdMain" ${go(gp, g.st, g.cell)} title="${esc(`${g.c.n}${on(g)}: ${fx(g.c.v, 3)} vs ${fx(g.c.lim, 3)} ${g.c.u}${gp.input ? ' (Owner rules tab)' : ` at x = ${fx(g.c.loc, 2)} ft`}`)}">
        <span class="sdName">${esc(gp.name)}</span><span class="sdVal">${fx(g.c.r, 3)}</span><span class="sdSt">${LBL[q.st]}</span></a>${op ? `<ul class="sdList">${rows}</ul>` : ''}</div>`;
    }).join('') + rtChip(R, A);
    const verd = nF ? 'fail' : 'pass';
    o.el.innerHTML = head(cnt)
      + `<div class="sdVerd"><b class="sd-${verd}">${nF ? 'FAIL' : 'PASS'}</b>${top ? ` · max ratio ${fx(top.c.r, 3)}` : ''}</div>${top ? `<div class="sdGov">Governing: <a href="#" ${go(top.gp, top.st, top.cell)}>${esc(top.c.n + on(top))}: ${fx(top.c.r, 3)}</a></div>` : ''}
        <div class="sdRun">${A ? `${A.types.length} girder type${A.types.length === 1 ? '' : 's'} on ${A.n} line${A.n === 1 ? '' : 's'} (every span); each counted once per check, its worst line.` : 'In development: the checks of the design girder only.'}</div>`
      + `<div id="sbDash">${chips}</div><p class="sdNote">Each chip: the governing ratio of its checks${A && A.n > 1 ? ' over every girder type and line (the type and line named)' : ''} (demand / capacity, OK ≤ 1.0), the engine's value. Click: its tab with that type and line, and the worked step of the value. Summary tab: every type and line.</p>`;
  }
  /* the Rating chip (not a check): the lowest of the HL-93 inventory rating factors; 99 = not applicable */
  function rtChip(R, A) {
    if (!R.rating) return '';
    // PR 3a-2: over every girder type × line (the lowest of each factor, its cell named)
    const src = A ? A.cells.filter(c => c.R && !c.R.error && c.R.rating) : [{ R, cell: null }];
    const all = RATING.rf.map(([n, f, st]) => src.map(c => ({ n, v: f(c.R), st, cell: A ? c : null })).filter(z => typeof z.v === 'number' && z.v < 99).reduce((b, z) => !b || z.v < b.v ? z : b, null)).filter(Boolean), gov = all.reduce((b, z) => !b || z.v < b.v ? z : b, null), op = D.open.has('rt');
    if (!gov) return '';
    const ok = gov.v >= 1, rows = all.map(z => `<li><a href="#" ${z.cell ? `data-sdcell="${z.cell.k}|${z.cell.g}" ` : ''}data-sdgo="rt|${z.st}" class="sd-${z.v >= 1 ? 'pass' : 'fail'}">${esc(z.n + on(z))}: RF ${fx(z.v, 3)}</a></li>`).join('');
    return `<div class="sdChip sd-${ok ? 'pass' : 'fail'}" data-sdgrp="rt"><button type="button" class="sdX" data-sdx="rt" aria-expanded="${op}" title="${op ? 'Hide' : 'Show'} each rating factor">${op ? '▾' : '▸'}</button><a href="#" class="sdMain" ${gov.cell ? `data-sdcell="${gov.cell.k}|${gov.cell.g}" ` : ''}data-sdgo="rt|${gov.st}" title="${esc(`Lowest HL-93 inventory rating factor: ${gov.n} RF = ${fx(gov.v, 3)} (not a check; not counted in the totals)`)}">
        <span class="sdName">Rating (RF)</span><span class="sdVal">${fx(gov.v, 3)}</span><span class="sdSt">${ok ? 'RF ≥ 1' : 'RF < 1'}</span></a>${op ? `<ul class="sdList">${rows}</ul>` : ''}</div>`;
  }
  function init(o) {
    D.o = o; const el = o.el; if (!el) return;
    D.coll = rd(KEY) === '1'; document.body.classList.toggle('sbDashColl', D.coll);
    el.addEventListener('click', e => {
      const t = e.target.closest('button, a'); if (!t) return;
      if (t.id === 'sbDashTgl') { setColl(!D.coll); return; }
      e.preventDefault();
      if (t.dataset.icgo != null) { if (o.fix) o.fix(+t.dataset.icgo); return; }
      if (t.dataset.sdx) { const k = t.dataset.sdx; if (D.open.has(k)) D.open.delete(k); else D.open.add(k); draw(); return; }
      if (t.dataset.sdcell && o.pick) { const [k, g] = t.dataset.sdcell.split('|').map(Number); o.pick(k, g); }   // PR 3a-2: that type and line first
      if (t.dataset.sdgo) { const [tab, st] = t.dataset.sdgo.split('|'); o.goto(tab, st); return; }
      if (t.dataset.sdin) { if (o.goin) o.goin(t.dataset.sdin); return; }
      if (t.dataset.sdown) { const [tab, id] = t.dataset.sdown.split('|'); if (o.goin) o.goin(tab); const el = document.getElementById(id);   // the input tab, then its row
        if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('sdFlash'); setTimeout(() => el.classList.remove('sdFlash'), 1600); } return; }
      if (t.dataset.sdtab) o.goto(t.dataset.sdtab);
    });
    draw();
  }
  window.PSBDashUI = { init, refresh: draw, KEY, GROUPS, RATING };
})();
