/* apps/ps-bridge/ui/dash.js — the left check summary column (window.PSBDashUI). Classic script. Created 2026-11-12 (PR 1 skeleton,
   docs/ps-bridge-plan.md §2). ADAPTED COPY, to move to shared/ later (CLAUDE.md §3): the column's head, the « / » shrink toggle, the chip
   and input-error layout follow apps/steel-bridge/ui/dash.js (window.SBDDashUI) and use the same CSS (#sbDashCol, #sbDashHead, .sdChip, …,
   copied into index.html). The steel file reads the steel modules' results (SBDSummary); this one reads the design girder's engine checks
   (computeAll R.checks, PR 2c-1; Flexure and Shear PR 2c-2): one chip per check group whose tab is built (the steel dash pattern: its governing ratio and check,
   PASS / FAIL, ▸ opens each check of the group; a chip or a check opens its tab and the worked step of the value), the other groups listed
   "not run" with the PR that brings them; the input errors are listed as links. Display only: nothing is calculated here (the ratios are
   the engine's c.r, PASS = the engine's c.pass, r ≤ 1.0001). Screens 1200 px and wider (CSS); not printed. The shrunk state is the
   per-browser UI key psb2.dashCollapsed_v1 ('1' shrunk; not in the project, the autosave or the export).

   init(o): o = { el, store (localStorage or null), getP(), errors() ([{ path, msg }]), result() (computeAll of the design or null),
   goto(tab, step), fix(i) }; refresh() after the page draws. */
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
    { id: 'end', name: 'End zone & hold-down', tab: 'end', pr: '2d' }, { id: 'camb', name: 'Camber & deflection', tab: 'camb', pr: '2d' },
    { id: 'hand', name: 'Handling', tab: 'hand', pr: '2d' }, { id: 'deck', name: 'Deck', tab: 'deck', pr: '2d' }, { id: 'rt', name: 'Rating', tab: 'rt', pr: '2d' }];
  const fx = (v, d) => typeof v === 'number' && isFinite(v) ? v.toFixed(d) : v === Infinity ? '∞' : '—';
  /* the checks of a group in R (those the engine made for this design) and the governing one (largest ratio) */
  function grp(R, gp) {
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
    const R = o.result ? o.result() : null;
    if (!R) { o.el.innerHTML = head('<span class="sdC"><span class="sdN">not run</span></span>') + (D.coll ? '' : '<p class="sdNote">The engine could not compute this design: no checks (see the output panel).</p>'); return; }
    const G = GROUPS.map(gp => gp.pr ? { gp, st: 'notrun' } : { gp, ...grp(R, gp) }), run = G.filter(q => q.st === 'pass' || q.st === 'fail');
    const nF = run.reduce((a, q) => a + q.all.filter(z => !z.c.pass).length, 0), nP = run.reduce((a, q) => a + q.all.filter(z => z.c.pass).length, 0);
    const top = run.map(q => q.gov).filter(Boolean).reduce((b, z) => !b || z.c.r > b.c.r ? z : b, null);
    const cnt = `<span class="sdC">${nF ? `<span class="sdF">${nF} FAIL</span>` : ''}${nP ? `<span class="sdP">${nP} PASS</span>` : ''}<span class="sdN">${G.length - run.length} not built</span></span>`;
    if (D.coll) { o.el.innerHTML = head(cnt); return; }
    const LBL = { pass: 'PASS', fail: 'FAIL' }, tabOf = st => GROUPS.find(gp => gp.checks && gp.checks.some(q => q[1] === st)).tab;
    const chips = G.map(q => {
      const gp = q.gp;
      if (gp.pr) return `<div class="sdChip sd-notrun"><span></span><a href="#" class="sdMain" data-sdtab="${gp.tab}" title="Not built yet: comes in PR ${gp.pr} (docs/ps-bridge-plan.md §5)"><span class="sdName">${esc(gp.name)}</span><span class="sdVal">not run</span><span class="sdSt">PR ${gp.pr}</span></a></div>`;
      if (q.st === 'na') return '';
      const op = D.open.has(gp.id), g = q.gov;
      const rows = q.all.map(z => `<li><a href="#" data-sdgo="${gp.tab}|${z.st}" class="sd-${z.c.pass ? 'pass' : 'fail'}">${esc(z.c.n)}: ${fx(z.c.r, 3)}</a></li>`).join('');
      return `<div class="sdChip sd-${q.st}" data-sdgrp="${gp.id}"><button type="button" class="sdX" data-sdx="${gp.id}" aria-expanded="${op}" title="${op ? 'Hide' : 'Show'} each check">${op ? '▾' : '▸'}</button><a href="#" class="sdMain" data-sdgo="${gp.tab}|${g.st}" title="${esc(`${g.c.n}: ${fx(g.c.v, 3)} vs ${fx(g.c.lim, 3)} ${g.c.u} at x = ${fx(g.c.loc, 2)} ft`)}">
        <span class="sdName">${esc(gp.name)}</span><span class="sdVal">${fx(g.c.r, 3)}</span><span class="sdSt">${LBL[q.st]}</span></a>${op ? `<ul class="sdList">${rows}</ul>` : ''}</div>`;
    }).join('');
    const verd = nF ? 'fail' : 'pass';
    o.el.innerHTML = head(cnt)
      + `<div class="sdVerd"><b class="sd-${verd}">${nF ? 'FAIL' : 'PASS'}</b>${top ? ` · max ratio ${fx(top.c.r, 3)}` : ''}</div>${top ? `<div class="sdGov">Governing: <a href="#" data-sdgo="${tabOf(top.st)}|${top.st}">${esc(top.c.n)}: ${fx(top.c.r, 3)}</a></div>` : ''}
        <div class="sdRun">In development: the checks of the tabs built so far (PR 2c), the design girder only; the others follow (PR 2d).</div>`
      + `<div id="sbDash">${chips}</div><p class="sdNote">Each chip: the governing ratio of its checks for the design girder (demand / capacity, OK ≤ 1.0), the engine's value. Click: its tab and the worked step of the value. The bridge-level Summary (every girder and span) comes with PR 3b.</p>`;
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
      if (t.dataset.sdgo) { const [tab, st] = t.dataset.sdgo.split('|'); o.goto(tab, st); return; }
      if (t.dataset.sdtab) o.goto(t.dataset.sdtab);
    });
    draw();
  }
  window.PSBDashUI = { init, refresh: draw, KEY, GROUPS };
})();
