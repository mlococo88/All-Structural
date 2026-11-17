/* apps/crane-pick/ui/project.js — the Project input tab (C1, 2026-11-16): "Save and open" (shared/projects-ui.js projectBar over the
   list 'crane.projects.v1' = M.KEYS.list, GitHub sync tool 'crane-pick'), the title block, notes, and what the tool is.
   shared/project-registry.js has an entry for this list (def: this file); keep its key / time / sort / tool / label / space / toFile equal. */
(function () {
  'use strict';
  const A = window.CranePickApp, M = window.CranePickModel, esc = A.esc;
  const TB = [['name', 'Project'], ['number', 'Project no.'], ['location', 'Location'], ['client', 'Client / owner'], ['by', 'Prepared by'], ['checker', 'Checked by'], ['date', 'Date'], ['rev', 'Revision']];
  let el = null, ms = null;
  /* the file of a project: Export JSON and the GitHub copy (shared/project-registry.js repeats toFile for the home page) */
  const toFile = i => M.toFile(i);
  /* images: a function the plan-sheet module sets (C1-2) that returns { id: data URL } of the open project's sheets, or null */
  let imagesFor = null, afterImport = null;
  function exportJSON(name) {
    const go = imgs => { const t = JSON.stringify(M.toFile(A.P, imgs), null, 1);
      window.SharedProjectsUI.download(String(name || A.P.title.name || 'crane-pick').replace(/[^\w.-]+/g, '_') + '.crane.json', t); };
    if (imagesFor) imagesFor(A.P).then(go, () => go(null)); else go(null);
  }
  function onImport(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let res; try { res = M.fromFile(JSON.parse(String(r.result))); } catch (x) { A.notice('Import JSON: ' + esc(x.message) + '. Nothing was changed.', 'err'); return; }
      A.loadProject(res.project, '');
      if (afterImport) afterImport(res); A.notice(`Imported "${esc(f.name)}".`);
    };
    r.readAsText(f);
  }
  function build(p) {
    el = p;
    p.innerHTML = `<div class="sec" id="secSave"><div class="secHead">Save and open</div><div class="secBody" id="pbHost"></div></div>
      <div class="sec"><div class="secHead">Title block</div><div class="secBody">${TB.map(([k, l]) => `<div class="fRow"><label for="tb_${k}">${l}</label><input type="text" id="tb_${k}" data-tb="${k}"></div>`).join('')}
        <p class="note">Printed at the top of the Report.</p></div></div>
      <div class="sec"><div class="secHead">Notes</div><div class="secBody"><textarea id="prjNotes" aria-label="Project notes" placeholder="Lift sequence, contacts, site constraints, open questions…"></textarea><p class="note">Printed in the Report.</p></div></div>
      <div class="sec"><div class="secHead">About this tool</div><div class="secBody"><p class="note"><b>Lift-planning aid.</b> Draw the site on the map or on a plan sheet: obstructions,
        power lines (OSHA minimum clearance), buried utilities, culverts and walls, exclusion zones, labels and dimensions. Every item can be dragged and edited, and every change can be undone.</p>
        <p class="note">Cranes (C2): load the crane library (Cranes tab: from GitHub or from files, or paste a chart), add cranes to the project, place them on the map (Lifts tab) and drag the crane, the pick and the set points: radius, chart capacity and % of chart follow live; every pick is listed on the Picks tab and in the Report.</p>
        <p class="note">Girder lifts (C5, Girder lifts tab): a girder (or paired girders with cross-frames) lifted by one crane or by two in tandem, from the truck to the bearings: load share, every step of the path checked for each crane (capacity against the tandem limit, heights, 3D clearances, crane to crane, ground).</p>
        <p class="note">How to use the app: the <a href="#" data-goman="1">Manual</a> tab (quick start, workflows, what each tab does, methods and limits, crane data, troubleshooting).</p>
        <p class="note">Units: US customary (ft, kip, psf / ksf). Positions: State Plane grid, US survey feet (Site &amp; map tab).</p></div></div>`;
    p.addEventListener('click', e => { if (e.target.closest('[data-goman]')) { e.preventDefault(); A.showOTab('man'); } });
    p.addEventListener('change', e => {
      const t = e.target;
      if (t.dataset.tb) A.update(P => { P.title[t.dataset.tb] = t.value; }, 'title');
      else if (t.id === 'prjNotes') A.update(P => { P.notes = t.value; }, 'notes');
    });
    document.getElementById('fImport').addEventListener('change', onImport);
  }
  function fill() {
    if (!el) return;
    TB.forEach(([k]) => { const i = el.querySelector('#tb_' + k); if (i && document.activeElement !== i) i.value = A.P.title[k] || ''; });
    const n = el.querySelector('#prjNotes'); if (n && document.activeElement !== n) n.value = A.P.notes || '';
  }
  A.inTab({ id: 'proj', label: 'Project', build });
  A.on('project', fill); A.on('change', o => { if (o.kind === 'title' || o.kind === 'notes') fill(); });
  A.on('ready', () => {
    if (!window.SharedProjects || !window.SharedProjectsUI) return;
    ms = SharedProjects.mapStore(A.LS, M.KEYS.list, { time: i => i && i.savedAt || null, sort: 'saved' });
    const cloud = A.store && window.SharedGitHubSync ? { cloud: { tool: 'crane-pick', label: 'Crane Pick Analyzer', space: 1, toFile: i => toFile(i), fromFile: f => M.fromFile(f).project } } : {};
    A.pb = SharedProjectsUI.projectBar(Object.assign({ store: ms, storage: A.LS, label: 'Crane Pick Analyzer', id: 'crLibDlg', omit: ['view', 'savedAt'], askUnsaved: 'always',
      getState: () => A.P,
      save: n => { if (window.CranePickCraneUI && !window.CranePickCraneUI.beforeSave(n)) return { ok: false, message: 'Not saved (the project holds crane chart data and the Cloud sync repository is public or not checked: see the Cranes tab).' };   // C2-1
        const it = JSON.parse(JSON.stringify(A.P)); it.savedAt = new Date().toISOString(); const r = ms.save(n, it); if (r.ok) A.setOpen(n); return r; },
      open: n => { const it = ms.get(n); if (!it) return false; A.loadProject(it, n); return true; },
      current: () => A.openName, setCurrent: n => A.setOpen(n),
      displayName: () => A.P.title.name,
      newProject: () => A.loadProject(M.newProject({ zone: A.P.site.zone, view: A.P.view }), ''),
      exportFile: n => exportJSON(n), importFile: () => document.getElementById('fImport').click(),
      header: document.getElementById('hdrBtns'), chipBefore: document.getElementById('hdrUR'), card: true, headerSave: false,
      chipClick: () => { A.showITab('proj'); const c = A.pb && A.pb.el.card; if (c && c.isConnected) c.scrollIntoView({ block: 'nearest' }); }, chipHint: 'the Project tab (Save and open)'
    }, cloud));
    A.pb.mount(document.getElementById('pbHost'));
  });
  window.CranePickProject = { exportJSON, setImages: (f, g) => { imagesFor = f; afterImport = g; } };
})();
