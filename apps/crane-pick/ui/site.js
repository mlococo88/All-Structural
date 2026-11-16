/* apps/crane-pick/ui/site.js — the Site output tab: the plan summary (C1, 2026-11-16). The project, the coordinate system, the plan
   sheets and every drawn item with its properties and computed values (each worked out here, CLAUDE.md §6). Other files add their
   sections through section(fn): fn(P) -> HTML. */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, esc = A.esc;
  let el = null, shown = false, dirty = true;
  const parts = [];
  /* steps(list): worked steps as the bridge apps show them (shared/steps.js line(); each <li id="st-<id>"> is a link target) */
  const steps = list => `<ol class="steps">${(list || []).map(s => `<li id="st-${esc(s.id)}"${s.ok === false ? ' class="no"' : ''}><div class="lbl">${esc(s.label)}${s.ref ? `<span class="ref">${esc(s.ref)}</span>` : ''}</div><div>${window.SharedSteps ? window.SharedSteps.line(s, true) : esc(String(s.value))}</div>${s.note ? `<div class="nt">${esc(window.SharedSteps ? window.SharedSteps.noteText(s.note) : s.note)}</div>` : ''}</li>`).join('')}</ol>`;
  const kv = rows => `<div class="kv">${rows.map(([k, v]) => `<div><span>${esc(k)}</span><span>${v}</span></div>`).join('')}</div>`;
  function draw() {
    if (!el) return; dirty = false;
    const P = A.P, z = G.zone(P.site.zone), t = P.title;
    el.innerHTML = `<div class="sec"><div class="secHead">Project</div><div class="secBody">${kv([['Project', esc(t.name)], ['Project no.', esc(t.number)], ['Location', esc(t.location)], ['Client / owner', esc(t.client)],
        ['Prepared by', esc(t.by)], ['Checked by', esc(t.checker)], ['Date', esc(t.date)], ['Revision', esc(t.rev)]])}
        <p class="note"><b>Lift-planning aid.</b> Results support the lift plan; they do not replace it.</p></div></div>
      <div class="sec"><div class="secHead">Coordinate system</div><div class="secBody">${kv([['Zone', esc(z.name)], ['Stored as', 'grid, US survey feet'], ['Distances', 'grid (no combined scale factor)'], ['Datum on the map', 'NAD 83 shown as WGS 84']])}</div></div>`
      + parts.map(f => { try { return f(P); } catch (e) { console.error(e); return ''; } }).join('');
  }
  function build(p) { el = p; p.classList.add('siteTab'); }
  A.outTab({ id: 'site', label: 'Site', build, show: () => { shown = true; draw(); } });
  const mark = () => { dirty = true; if (A.ui.otab === 'site') draw(); };
  A.on('project', mark); A.on('change', mark);
  A.on('tab', id => { shown = id === 'site'; });
  window.CranePickSite = { section: fn => parts.push(fn), kv, steps, redraw: mark, get dirty() { return dirty; }, get shown() { return shown; } };
})();
