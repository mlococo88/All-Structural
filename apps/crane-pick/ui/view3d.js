/* apps/crane-pick/ui/view3d.js — the 3D view (window.CranePickView3D). C3-3 (2026-11-16).
   three.js r128 + OrbitControls (engineer-approved 2026-11-16; the pinned files apps/steel-bridge/index.html uses, CLAUDE.md §2), loaded
   from the CDN the first time the view is opened (as ui/sheets.js loads pdf.js):
     https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js
     https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js
   Shown in the dock under the map (ui/elev.js "3D"), so it follows drags on the plan. The scene: the plan sheets as the ground texture
   (else a grid), obstructions (prisms to their top; height not entered: an outline 30 ft high), exclusion zones (translucent), power
   lines at the lowest-wire elevation with their D_min clearance tubes (height not entered: a vertical plane), each crane setup (carrier /
   carbody, tracks, floats, tail-swing circle), and for the selected pick: the boom at the chosen point, counterweight, load line, hook
   block, load, the swing envelope (the boom's swept surface and the hook path at the travel height) and the 3D clearance flags (closest
   points). Values: CranePickPlace.evalPick (engine/lift.js, elev.js, clear3d.js), the same as the card. Display only; not printed (the
   Report gets a snapshot of the view as last shown). Renders on demand (orbit, drag, change); WebGL unavailable: a message. */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo;
  const EL = () => window.CranePickElev, C3 = () => window.CranePickClear, O = () => window.CranePickOSHA, LF = () => window.CranePickLift, EV = () => window.CranePickElevView;
  const THREE_URL = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js', ORBIT_URL = 'https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js';
  const isNum = v => typeof v === 'number' && isFinite(v);
  let loadP = null, V = null, host = null, args = null, camKey = '', siteKey = '', shot = null, failed = '';
  function load() {
    if (window.THREE && window.THREE.OrbitControls) return Promise.resolve();
    if (loadP) return loadP;
    const add = src => new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('could not load ' + src)); document.head.appendChild(s); });
    loadP = (window.THREE ? Promise.resolve() : add(THREE_URL)).then(() => add(ORBIT_URL)).then(() => { if (!window.THREE || !window.THREE.OrbitControls) throw new Error('three.js did not load'); });
    loadP.catch(() => { loadP = null; });
    return loadP;
  }
  function webgl() { try { const c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl'))); } catch (e) { return false; } }
  function msg(t) { if (host) host.innerHTML = `<p class="note" id="v3Msg">${t}</p>`; }
  /* ---------- the renderer ---------- */
  function init() {
    const T = window.THREE;
    if (!webgl()) { failed = 'WebGL is not available in this browser (or it is turned off), so the 3D view cannot be shown. The elevation view and every check still work.'; return null; }
    let renderer; try { renderer = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); } catch (e) { failed = 'The 3D view could not start (WebGL): ' + A.esc(e.message || String(e)) + '. The elevation view and every check still work.'; return null; }
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); renderer.setClearColor(0xf1f5f9);
    const scene = new T.Scene(), camera = new T.PerspectiveCamera(45, 2, 0.5, 20000);
    scene.add(new T.AmbientLight(0xffffff, 0.75)); const sun = new T.DirectionalLight(0xffffff, 0.6); sun.position.set(300, 600, 200); scene.add(sun);
    const controls = new T.OrbitControls(camera, renderer.domElement); controls.enableDamping = false; controls.screenSpacePanning = true; controls.maxPolarAngle = Math.PI * 0.495;
    const site = new T.Group(), lift = new T.Group(); scene.add(site); scene.add(lift);
    const v = { T, renderer, scene, camera, controls, site, lift, frames: 0 };
    controls.addEventListener('change', () => render(v));
    return v;
  }
  function size(v) { if (!host || !v) return; const w = Math.max(200, host.clientWidth || 600), h = Math.max(220, host.clientHeight || 300); v.renderer.setSize(w, h, false); v.renderer.domElement.style.width = '100%'; v.renderer.domElement.style.height = h + 'px'; v.camera.aspect = w / h; v.camera.updateProjectionMatrix(); }
  function render(v) { if (!v) return; v.renderer.render(v.scene, v.camera); v.frames++; }
  function clear(g) { while (g.children.length) { const o = g.children.pop(); o.traverse(x => { if (x.geometry) x.geometry.dispose(); if (x.material) [].concat(x.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); }); }); } }
  /* ---------- world coordinates: x east, y up (elevation), z south; origin at the first setup's rotation centre and pad ---------- */
  let O0 = { x: 0, y: 0, z: 0 };
  const W3 = (x, y, z) => new window.THREE.Vector3(x - O0.x, z - O0.z, -(y - O0.y));
  function prism(T, pts, z0, z1, mat) {
    const sh = new T.Shape(pts.map(p => new T.Vector2(p.x - O0.x, p.y - O0.y)));
    const g = new T.ExtrudeGeometry(sh, { depth: Math.max(0.05, z1 - z0), bevelEnabled: false }); g.rotateX(-Math.PI / 2); g.translate(0, z0 - O0.z, 0);
    return new T.Mesh(g, mat);
  }
  function line(T, a, b, color, o) { const g = new T.BufferGeometry().setFromPoints([a, b]); return new T.Line(g, new T.LineBasicMaterial(Object.assign({ color }, o || {}))); }
  function poly(T, ps, color, o) { return new T.Line(new T.BufferGeometry().setFromPoints(ps), new T.LineBasicMaterial(Object.assign({ color }, o || {}))); }
  function rod(T, a, b, r, mat) { const d = new T.Vector3().subVectors(b, a), L = d.length(), g = new T.CylinderGeometry(r, r, Math.max(L, 0.01), 16, 1, true), m = new T.Mesh(g, mat);
    m.position.copy(a).addScaledVector(d, 0.5); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize()); return m; }
  const mat = (T, color, o) => new T.MeshLambertMaterial(Object.assign({ color, side: T.DoubleSide }, o || {}));
  /* the site: sheets, grid, items (rebuilt when the items or the sheets change) */
  function buildSite(v, zp) {
    const T = v.T, g = v.site; clear(g);
    const sheets = (A.P.sheets || []).filter(s => s.visible && window.CranePickSheets && window.CranePickSheets.urls.get(s.id));
    sheets.forEach(s => {
      const c = [[0, 0], [s.w, 0], [s.w, s.h], [0, s.h]].map(([x, y]) => G.pxToFt(s.place, x, y)).map(p => W3(p.x, p.y, zp - 0.05));
      const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute([].concat(...[c[0], c[1], c[2], c[0], c[2], c[3]].map(p => [p.x, p.y, p.z])), 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], 2));
      const tex = new T.TextureLoader().load(window.CranePickSheets.urls.get(s.id), () => render(v));
      g.add(new T.Mesh(geo, new T.MeshBasicMaterial({ map: tex, side: T.DoubleSide, transparent: true, opacity: s.opacity })));
    });
    const grid = new T.GridHelper(600, 60, 0x94a3b8, 0xcbd5e1); grid.position.y = zp - O0.z - 0.1; g.add(grid);
    (A.P.items || []).forEach(it => {
      if (it.type === 'obst') { const e = C3().envelope(it, zp, 'v'), base = isNum(it.gradeEl) ? it.gradeEl : zp;
        if (e.known) g.add(prism(T, it.pts, base, e.z1, mat(T, 0x7c3aed, { transparent: true, opacity: 0.55 })));
        else { const m = prism(T, it.pts, base, base + 30, new T.MeshBasicMaterial({ color: 0x7c3aed, wireframe: true, transparent: true, opacity: 0.4 })); g.add(m); } }
      else if (it.type === 'excl') g.add(prism(T, it.pts, zp, zp + 60, mat(T, 0xd97706, { transparent: true, opacity: 0.12, depthWrite: false })));
      else if (it.type === 'power') { const e = C3().envelope(it, zp, 'v'), D = O().clearance({ kv: it.kv, le350: it.le350, setFt: it.setFt }).ft;
        for (let i = 0; i + 1 < it.pts.length; i++) { const a = it.pts[i], b = it.pts[i + 1];
          if (isNum(e.zw)) { const A3 = W3(a.x, a.y, e.zw), B3 = W3(b.x, b.y, e.zw); g.add(line(T, A3, B3, 0xdc2626)); g.add(rod(T, A3, B3, 0.25, mat(T, 0xdc2626)));
            if (isNum(D)) { const t = rod(T, W3(a.x, a.y, e.zw - (e.zw - e.z0) / 2), W3(b.x, b.y, e.zw - (e.zw - e.z0) / 2), D + (it.sway || 0), mat(T, 0xdc2626, { transparent: true, opacity: 0.13, depthWrite: false })); t.userData.tube = true; g.add(t); } }
          else { const L = Math.hypot(b.x - a.x, b.y - a.y), pl = new T.Mesh(new T.PlaneGeometry(L, 120), mat(T, 0xdc2626, { transparent: true, opacity: 0.1, depthWrite: false }));
            pl.position.copy(W3((a.x + b.x) / 2, (a.y + b.y) / 2, zp + 60)); pl.rotation.y = Math.atan2(b.y - a.y, b.x - a.x); g.add(pl); g.add(line(T, W3(a.x, a.y, zp), W3(b.x, b.y, zp), 0xdc2626)); } } }
    });
  }
  /* the cranes and the selected pick at the chosen point */
  function buildLift(v, c, which) {
    const T = v.T, g = v.lift; clear(g);
    (A.P.setups || []).forEach(u => {
      const cr = A.P.cranes.find(x => x.id === u.craneId); if (!cr) return; const fp = LF().footprint(cr.def, u), ge = EL().geomOf(cr.def), zp = EL().padEl(u);
      const bodyH = isNum(ge.cwBot) && ge.cwBot > 0 ? ge.cwBot : 5;
      if (fp.body) g.add(prism(T, fp.body, zp, zp + bodyH, mat(T, 0x64748b)));
      fp.tracks.forEach(t => g.add(prism(T, t, zp, zp + 3.5, mat(T, 0x334155))));
      fp.floats.forEach(f => g.add(prism(T, f, zp, zp + 0.6, mat(T, 0xf59e0b))));
      fp.beams.forEach(([a, b]) => g.add(rod(T, W3(a.x, a.y, zp + 1.2), W3(b.x, b.y, zp + 1.2), 0.5, mat(T, 0x1e3a5f))));
      if (isNum(fp.tail)) g.add(poly(T, LF().circle(u, fp.tail, 64).concat([LF().circle(u, fp.tail, 64)[0]]).map(p => W3(p.x, p.y, zp + 0.1)), 0x7c3aed));
    });
    // C5: the girder lift at its shown step (ui/tandem.js): the girder, both cranes' booms, load lines and blocks, the centre's path
    const tg = window.CranePickTandemUI && window.CranePickTandemUI.draw3d({ T, g, W3, prism, rod, line, poly, mat });
    if (tg && !c && tg.key !== camKey) { camKey = tg.key; const ctr = W3(tg.x, tg.y, tg.z), r = 160; v.controls.target.copy(ctr); v.camera.position.set(ctr.x + r * 0.9, ctr.y + r * 0.7, ctr.z + r * 1.1); v.controls.update(); }
    if (!c) return;
    const { k, u, ev } = c, h = ev.elev; if (!h) return;
    const cr = A.P.cranes.find(x => x.id === u.craneId).def, gm = h.g, zp = EL().padEl(u), E = EL().el0(k), H = E.H || 0;
    const S = EV().stateOf(ev, k, which), q = S.q, R = Math.hypot(q.x - u.x, q.y - u.y), az = G.azimuth(u, q) * Math.PI / 180, sv = { x: Math.sin(az), y: Math.cos(az) };
    const zTip = EL().tipAt(cr, u, LF().cfgAt(cr, u, q, ev.chs), R, gm), foot = { x: u.x + gm.footE * sv.x, y: u.y + gm.footE * sv.y, z: zp + gm.footH };
    // upperworks and counterweight at this slew
    const tl = isNum(gm.tail) ? gm.tail : 10, cwB = zp + gm.cwBot, cwT = isNum(gm.cwTop) ? zp + gm.cwTop : cwB + 6, perp = { x: sv.y, y: -sv.x }, wC = Math.max(4, tl * 0.7) / 2;
    const cwPts = [[-tl, -wC], [-tl * 0.55, -wC], [-tl * 0.55, wC], [-tl, wC]].map(([a, b]) => ({ x: u.x + sv.x * a + perp.x * b, y: u.y + sv.y * a + perp.y * b }));
    const cw = prism(T, cwPts, cwB, cwT, mat(T, 0x475569)); cw.userData.cw = true; g.add(cw);
    // the swing envelope: the boom's swept surface (foot → tip along the path) and the hook path at the travel height
    const pts = ev.path.pts, tipP = [], footP = [], hookP = [];
    pts.forEach(p => { const Rr = Math.hypot(p.x - u.x, p.y - u.y), a2 = G.azimuth(u, p) * Math.PI / 180, zt = EL().tipAt(cr, u, LF().cfgAt(cr, u, p, ev.chs), Rr, gm); if (!isNum(zt)) return;
      tipP.push(W3(p.x, p.y, zt)); footP.push(W3(u.x + gm.footE * Math.sin(a2), u.y + gm.footE * Math.cos(a2), zp + gm.footH)); hookP.push(W3(p.x, p.y, h.trav.z + H)); });
    if (tipP.length > 1) {
      const pos = []; for (let i = 0; i + 1 < tipP.length; i++) [footP[i], tipP[i], tipP[i + 1], footP[i], tipP[i + 1], footP[i + 1]].forEach(p => pos.push(p.x, p.y, p.z));
      const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); sg.computeVertexNormals();
      const env = new T.Mesh(sg, new T.MeshBasicMaterial({ color: 0x2563eb, transparent: true, opacity: 0.1, side: T.DoubleSide, depthWrite: false })); env.userData.envelope = true; g.add(env);
      g.add(poly(T, tipP, 0x2563eb)); g.add(poly(T, hookP, 0x059669, { linewidth: 2 }));
    }
    if (isNum(zTip)) {
      const tip = W3(q.x, q.y, zTip), boom = rod(T, W3(foot.x, foot.y, foot.z), tip, Math.max(0.6, (gm.boomW || 0) / 2), mat(T, 0x0f172a)); boom.userData.boom = true; g.add(boom);
      const zLb = S.lb, zLt = zLb + H, zHk = zLt + h.pick.hr, zBk = zHk + h.pick.hbk;
      g.add(line(T, tip, W3(q.x, q.y, zBk), 0x334155));
      const blk = new T.Mesh(new T.BoxGeometry(1.5, Math.max(0.5, h.pick.hbk), 1.5), mat(T, 0xf59e0b)); blk.position.copy(W3(q.x, q.y, zHk + Math.max(0.5, h.pick.hbk) / 2)); g.add(blk);
      const Lb = Math.max(1, E.L || 0), Wb = Math.max(1, E.W || 0), ld = new T.Mesh(new T.BoxGeometry(Lb, Math.max(0.5, H), Wb), mat(T, 0x2563eb, { transparent: true, opacity: 0.75 }));
      ld.position.copy(W3(q.x, q.y, zLb + Math.max(0.5, H) / 2)); ld.rotation.y = Math.PI / 2 - az; ld.userData.load = true; g.add(ld);
      if (h.pick.hr > 0) [-1, 1].forEach(sx => g.add(line(T, W3(q.x, q.y, zHk), W3(q.x + sv.x * sx * Lb * 0.4, q.y + sv.y * sx * Lb * 0.4, zLt), 0x78350f)));
    }
    // 3D clearance flags: the closest points
    ((ev.c3 && ev.c3.flags) || []).filter(f => f.p && f.level !== 'info').forEach(f => {
      const col = f.level === 'stop' ? 0xdc2626 : 0xd97706, s = new T.Mesh(new T.SphereGeometry(0.9, 12, 8), new T.MeshBasicMaterial({ color: col })); s.position.copy(W3(f.p.x, f.p.y, f.p.z)); s.userData.flag = f.level; g.add(s);
      g.add(line(T, W3(f.p.x, f.p.y, f.p.z), W3(f.q.x, f.q.y, f.q.z), col));
    });
    // the camera: kept while the same pick is shown; set when another pick is chosen
    const ck = k.id; if (ck !== camKey) { camKey = ck; const r = Math.max(40, R, u.boom || 0) * 1.6, ctr = W3((u.x + q.x) / 2, (u.y + q.y) / 2, zp + (isNum(zTip) ? (zTip - zp) / 3 : 10));
      v.controls.target.copy(ctr); v.camera.position.set(ctr.x + r * 0.9, ctr.y + r * 0.7, ctr.z + r * 1.1); v.controls.update(); }
  }
  /* ---------- the dock (ui/elev.js) calls these ---------- */
  function show(el, c, which) {
    host = el; args = { c, which };
    if (failed) { msg(failed); return; }
    if (!window.THREE || !window.THREE.OrbitControls) { if (!host.querySelector('#v3Msg')) msg('Loading the 3D view (three.js)…');
      load().then(() => { if (args) show(host, args.c, args.which); }, e => { msg('three.js could not be loaded (it comes from cdnjs.cloudflare.com / cdn.jsdelivr.net and needs the internet the first time): ' + A.esc(e.message) + '. The elevation view and every check still work.'); }); return; }
    if (!V) { V = init(); if (!V) { msg(failed); return; } }
    if (V.renderer.domElement.parentNode !== host) { host.innerHTML = ''; host.appendChild(V.renderer.domElement); V.renderer.domElement.id = 'v3Canvas';
      if (window.ResizeObserver) { if (V.ro) V.ro.disconnect(); V.ro = new ResizeObserver(() => { if (args) { size(V); render(V); } }); V.ro.observe(host); } }
    const u0 = (A.P.setups || [])[0]; O0 = u0 ? { x: u0.x, y: u0.y, z: EL().padEl(u0) } : { x: 0, y: 0, z: 0 };
    const sk = JSON.stringify([A.P.items, (A.P.sheets || []).map(s => [s.id, s.place, s.visible, s.opacity]), O0]);
    if (sk !== siteKey) { siteKey = sk; buildSite(V, O0.z); }
    buildLift(V, c, which); size(V); render(V);
  }
  function hide() { args = null; }
  /* snapshot(): the view as last shown (a PNG data URL) for the Report, or null */
  function snapshot() { if (!V || !host || !host.isConnected || !args || !args.c) return shot; try { render(V); shot = { pick: args.c.k.id, which: args.which, url: V.renderer.domElement.toDataURL('image/png') }; } catch (e) { /* keep the last */ } return shot; }
  window.CranePickReport && window.CranePickReport.add(P => {
    const s = snapshot(); if (!s) return []; const k = P.picks.find(x => x.id === s.pick); if (!k) return [];
    return [{ id: 'v3', key: 'view3d', title: '3D view', subs: [{ id: 'v3s', title: k.name, items: [{ type: 'figure', svg: `<svg xmlns="http://www.w3.org/2000/svg" width="680" height="340" viewBox="0 0 680 340"><image href="${s.url}" x="0" y="0" width="680" height="340" preserveAspectRatio="xMidYMid meet"/></svg>`,
      caption: `3D view of ${k.name} (${EV().WHICH[s.which] || s.which}) as last shown on the screen: a picture only; the checks and their worked steps are in [[pick-${k.id}]].` }] }] }];
  });
  window.CranePickView3D = { show, hide, load, snapshot, get state() { return V ? { frames: V.frames, site: V.site.children.length, lift: V.lift.children.length, failed } : { failed }; },
    get scene() { return V && V.scene; }, get camera() { return V && V.camera; }, get controls() { return V && V.controls; }, URLS: [THREE_URL, ORBIT_URL] };
})();
