/* apps/steel-bridge/ui/detail3d.js — the 3D detail views of the Field splices tab (the selected splice) and of the Shear & stiffeners tab
   (the selected or governing bearing stiffener) (window.SBDDetail3D). Classic script. Display only: it draws the results its tab already
   built (Field splices: one entry of SBDSplicesUI's list, its R from engine/splices.js compute; Shear & stiffeners: SBDShearUI.build's
   R.BS rows and types from engine/stiffeners.js bearing) and computes nothing that feeds a result.
   Needs three.js r128 and its OrbitControls (the same pinned CDN files as the 3D view tab, ui/view3d.js; CLAUDE.md §2, no new library);
   without them (offline, CDN blocked) or without WebGL the card shows a message.

   Ported 2026-11-02 from GirderDetail ("Steel Bridge Design.html", reference only): the Field splice module's 3D view (anchor
   `function draw3D(R, host) {`: girder ends of both sides with their own flange and web plates, outer and inner flange splice plates,
   fillers on the thinner side, web splice plates, every bolt at the designed gage, pitch and edge distances; layer chips and a girder
   transparency slider) and the Bearing stiffener module's 3D view (anchors `function draw3DB(R, host) {`, `function bsRender3D() {`:
   the girder over the bearing, every pair of bearing stiffeners with their clips, the bearing block). Added here: bolt heads, nuts and
   washers (typical heavy-hex proportions, display only), plate outlines, labels with the plate sizes, view presets (3D, elevation, plan,
   section), reset, Save PNG, the choice of splice / bearing in the card; for the bearing: the fillet welds to the web, the effective
   column of 6.10.11.2.4 highlighted (the web strips 9t_w(F_yw/F_ys) and s_end from the result, with a section cut at mid-depth), the
   top flange at the bearing, a sole plate and bearing schematic, and the support cross-frame stubs where the bearing stiffener is also
   the connection plate (engine/crossframes.js cfCP: the bearing stiffener at the supports).

   Camera: orbit (left drag / one finger), pan (right drag / two fingers), zoom (wheel / pinch), OrbitControls with damping; the camera
   stays where it is while the same splice or bearing is shown. Layer and transparency choices are kept for the page view only (no storage).

   splice(host, ctx, R, sel, onSel): fills <div data-d3="splice"> in host. R = SBDSplicesUI result ({ list }), sel = the selected index,
     onSel(i) selects splice i in the tab (the tab redraws).
   bearing(host, ctx, R, sel, onSel): fills <div data-d3="bearing"> in host. R = SBDShearUI.build result, sel = the tab's selection
     ({ k, i }; k 'bs' picks the bearing, otherwise the governing one), onSel({ k: 'bs', i }) selects bearing i in the tab.
   ctx = { P, g } as the tab's render. state(kind) (tests): what the last scene holds. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const frac = x => (window.SBDSplices && window.SBDSplices.frac ? window.SBDSplices.frac(x) : (+x).toFixed(3));
  const f2 = x => (isFinite(x) ? (+x).toFixed(2) : '—');
  const LAYERS = {
    spl: [['gird', 'Girder ends', '#8b96a5'], ['plates', 'Splice plates', '#3f63d0'], ['fill', 'Fillers', '#d9a441'], ['bolts', 'Bolts', '#222831'], ['lbl', 'Labels', '#1f4e8c']],
    brg: [['gird', 'Girder', '#8b96a5'], ['stiff', 'Bearing stiffeners and welds', '#3f63d0'], ['col', 'Effective column', '#e08a1e'], ['brg', 'Sole plate and bearing', '#55595f'], ['cf', 'Cross-frame stubs', '#3f6f4f'], ['lbl', 'Labels', '#1f4e8c']] };
  const VIEWS = { spl: [['iso', '3D'], ['elev', 'Elevation'], ['plan', 'Plan (top)'], ['sec', 'Section']], brg: [['iso', '3D'], ['elev', 'Elevation'], ['plan', 'Plan (top)'], ['sec', 'Section']] };
  const PREF = { spl: { lay: {}, op: 0.35, view: 'iso' }, brg: { lay: {}, op: 0.35, view: 'iso' } };
  const V = { spl: null, brg: null };   // per kind: { r, scene, cam, ctl, root, groups, mats, key, home, raf, ro, info }

  function css() {
    if (document.getElementById('d3-css')) return;
    const st = document.createElement('style'); st.id = 'd3-css';
    st.textContent = `.d3{border:1px solid var(--line,#e4e7eb);margin:8px 0;background:#fff;}
      .d3-bar{display:flex;flex-wrap:wrap;align-items:center;gap:4px 10px;padding:5px 8px;border-bottom:1px solid var(--line,#e4e7eb);font-family:var(--font-ui,sans-serif);font-size:8.5pt;}
      .d3-bar b{font-size:9pt;margin-right:4px;} .d3-bar label{display:inline-flex;align-items:center;gap:3px;white-space:nowrap;} .d3-bar select{width:auto;max-width:100%;}
      .d3-bar .d3-dot{display:inline-block;width:9px;height:9px;border-radius:50%;} .d3-bar input[type=range]{width:90px;}
      .d3-host{position:relative;width:100%;height:440px;background:#f7f8fa;touch-action:none;overflow:hidden;}
      .d3-host canvas{display:block;}
      .d3-note{margin:4px 8px 6px;font-size:8.5pt;color:#475569;font-family:var(--font-ui,sans-serif);}
      @media (max-width:600px){.d3-host{height:320px;}}`;
    document.head.appendChild(st);
  }
  const ready = () => typeof THREE !== 'undefined' && THREE.WebGLRenderer;
  /* the card; again(): draw the card again once three.js has loaded (defer scripts run after the page's own script) */
  function shell(el, kind, title, pick, again) {
    css();
    if (!ready()) {
      if (document.readyState === 'loading') { el.innerHTML = `<div class="d3"><div class="d3-bar"><b>${esc(title)}</b></div><p class="d3-note">Loading the 3D library…</p></div>`; document.addEventListener('DOMContentLoaded', () => { if (el.isConnected) again(); }, { once: true }); return null; }
      el.innerHTML = `<div class="d3"><div class="d3-bar"><b>${esc(title)}</b></div><div class="alert">The 3D library (three.js r128 from cdnjs) could not be loaded: this view needs an internet connection the first time. The drawings above show the same detail.</div></div>`;
      return null;
    }
    const pf = PREF[kind];
    LAYERS[kind].forEach(([k]) => { if (pf.lay[k] == null) pf.lay[k] = true; });
    el.innerHTML = `<div class="d3"><div class="d3-bar"><b>${esc(title)}</b>${pick}
        <label>View <select data-d3v>${VIEWS[kind].map(([k, l]) => `<option value="${k}"${pf.view === k ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
        <span style="flex:1"></span><button type="button" data-d3reset>Reset view</button><button type="button" data-d3png>Save PNG</button></div>
      <div class="d3-bar">${LAYERS[kind].map(([k, l, c]) => `<label><input type="checkbox" data-d3l="${k}"${pf.lay[k] ? ' checked' : ''}><span class="d3-dot" style="background:${c}"></span>${esc(l)}</label>`).join('')}
        <label>Girder transparency <input type="range" min="0.1" max="1" step="0.05" value="${pf.op}" data-d3op aria-label="Girder opacity"></label></div>
      <div class="d3-host" data-d3host></div><p class="d3-note" data-d3note></p></div>`;
    return el.querySelector('[data-d3host]');
  }

  /* ---------- three.js scene plumbing ---------- */
  function view(kind) {
    if (V[kind]) return V[kind];
    const T = THREE, r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setClearColor(0xf7f8fa);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, 0.5, 20000);
    scene.add(new T.AmbientLight(0xffffff, 0.6)); const dl = new T.DirectionalLight(0xffffff, 0.65); dl.position.set(0.5, 1, 0.8); scene.add(dl); const d2 = new T.DirectionalLight(0xffffff, 0.3); d2.position.set(-0.6, -0.4, -0.7); scene.add(d2);
    r.domElement.style.touchAction = 'none';
    r.domElement.setAttribute('aria-label', `3D view of the ${kind === 'spl' ? 'field splice' : 'bearing stiffener'}: drag to rotate, right-drag or two fingers to pan, wheel or pinch to zoom`);
    const ctl = T.OrbitControls ? new T.OrbitControls(cam, r.domElement) : null;
    if (ctl) { ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.screenSpacePanning = true; ctl.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN }; }
    V[kind] = { r, scene, cam, ctl, root: null, groups: {}, mats: [], key: '', raf: 0, ro: null, home: null, info: {} };
    return V[kind];
  }
  function size(S, h) { const w = h.clientWidth || 800, ht = h.clientHeight || 440; S.r.setSize(w, ht); S.cam.aspect = w / ht; S.cam.updateProjectionMatrix(); }
  function loop(S) {
    cancelAnimationFrame(S.raf);
    const tick = () => { if (!S.r.domElement.isConnected) { S.raf = 0; return; } S.raf = requestAnimationFrame(tick); if (S.ctl) S.ctl.update(); S.r.render(S.scene, S.cam); };
    S.raf = requestAnimationFrame(tick);
  }
  function label(txt, hgt, color) {
    const c = document.createElement('canvas'), g = c.getContext('2d'), F = 'bold 36px system-ui, -apple-system, "Segoe UI", sans-serif'; g.font = F;
    const w = Math.ceil(g.measureText(txt).width) + 16; c.width = w; c.height = 50; g.font = F;
    g.fillStyle = 'rgba(255,255,255,0.88)'; g.fillRect(0, 0, w, 50); g.strokeStyle = color || '#1f4e8c'; g.lineWidth = 2; g.strokeRect(1, 1, w - 2, 48); g.fillStyle = color || '#1f4e8c'; g.fillText(txt, 8, 37);
    // the same size on screen at any zoom (sizeAttenuation off): hgt is a fraction of the view height
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true, sizeAttenuation: false })); sp.scale.set(hgt * w / 50, hgt, 1); sp.userData.s0 = sp.scale.clone(); sp.renderOrder = 20; return sp;
  }
  /* a fresh root with one group per layer; helpers bound to it */
  function kit(S, kind) {
    const T = THREE;
    if (S.root) { S.scene.remove(S.root); S.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
    const root = new T.Group(); S.root = root; S.scene.add(root); S.groups = {}; S.mats = [];
    LAYERS[kind].forEach(([k]) => { const g = new T.Group(); g.name = k; S.groups[k] = g; root.add(g); });
    const pf = PREF[kind];
    const mat = (c, o) => new T.MeshStandardMaterial({ color: c, metalness: 0.2, roughness: 0.62, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1, ...(o || {}) });
    const steel = mat(0xb8c0cc, { transparent: pf.op < 1, opacity: pf.op, depthWrite: pf.op >= 1 }); S.mats.push(steel);
    const edgeM = new T.LineBasicMaterial({ color: 0x334155, transparent: true, opacity: 0.55 });
    const box = (grp, x, y, z, dx, dy, dz, m, edges) => { if (!(dx > 1e-6 && dy > 1e-6 && dz > 1e-6)) return null; const geo = new T.BoxGeometry(dx, dy, dz), b = new T.Mesh(geo, m); b.position.set(x, y, z); S.groups[grp].add(b);
      if (edges !== false) { const e = new T.LineSegments(new T.EdgesGeometry(geo), edgeM); e.position.copy(b.position); S.groups[grp].add(e); } return b; };
    const inst = (grp, pts, geo, m, rot) => { if (!pts.length) return null; const im = new T.InstancedMesh(geo, m, pts.length), o = new T.Object3D(); if (rot) o.rotation.set(...rot); pts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); S.groups[grp].add(im); return im; };
    const lab = (txt, x, y, z, hgt, color) => { const sp = label(txt, hgt, color); sp.position.set(x, y, z); S.groups.lbl.add(sp); return sp; };
    return { T, mat, steel, box, inst, lab, edgeM };
  }
  /* bolts: shank, hex head, hex nut and washer at each point; axis 'y' (head at +dir) or 'z'. Proportions: heavy hex head 1.5d across
     flats and 0.6d high, nut 1.5d / 1.0d, washer 2d outside diameter (typical, display only). pts: [x, y, z] at the outer face (head side);
     grip: to the inner face; dir: +1 the head on the +axis side. */
  function bolts(K, grp, pts, d, grip, axis, dir) {
    const T = K.T, mB = K.mat(0x222831, { metalness: 0.4, roughness: 0.45 }), mW = K.mat(0x5b6470);
    const rc = 0.75 * d / Math.cos(Math.PI / 6), hH = 0.6 * d, hN = 1.0 * d, tW = 0.16, stick = 0.25 + hN + tW;
    const P = (off) => pts.map(p => axis === 'y' ? [p[0], p[1] + dir * off, p[2]] : [p[0], p[1], p[2] + dir * off]);
    const rot = axis === 'y' ? null : [Math.PI / 2, 0, 0];
    const L = grip + stick + hH * 0.3;
    K.inst(grp, P(-(grip + stick) / 2 + hH * 0.15), new T.CylinderGeometry(d / 2, d / 2, L, 12), mB, rot);   // shank
    K.inst(grp, P(hH / 2), new T.CylinderGeometry(rc, rc, hH, 6), mB, rot);                                // head
    K.inst(grp, P(-grip - tW / 2), new T.CylinderGeometry(d, d, tW, 16), mW, rot);                        // washer
    K.inst(grp, P(-grip - tW - hN / 2), new T.CylinderGeometry(rc, rc, hN, 6), mB, rot);                 // nut
    return pts.length;
  }
  /* camera presets: iso, elevation (from +z), plan (from +y), section (from +x), fitted to the bounding sphere of the model (labels left out)
     so the whole detail shows at any width */
  function presets(S) {
    const T = THREE, bx = new T.Box3();
    Object.entries(S.groups).forEach(([k, g]) => { if (k !== 'lbl' && k !== 'cf') bx.expandByObject(g); });   // labels and the schematic cross-frame stubs left out
    const sph = bx.getBoundingSphere(new T.Sphere()), c = sph.center.toArray(), rad = Math.max(1, sph.radius);
    const ext = bx.getSize(new T.Vector3());
    // the orthogonal views use a narrow field of view from far away (nearly parallel projection, so they read as drawings); the 3D view 35°
    return v => { S.cam.fov = v === 'elev' || v === 'plan' || v === 'sec' ? 6 : 35; S.cam.updateProjectionMatrix();
      const kf = Math.tan(S.cam.fov * Math.PI / 360) / Math.tan(35 * Math.PI / 360); S.groups.lbl.children.forEach(sp => sp.scale.copy(sp.userData.s0).multiplyScalar(kf));   // labels: the same size on screen at either field of view
      const asp = Math.max(0.3, S.cam.aspect || 1.6), vf = S.cam.fov * Math.PI / 360, hf = Math.atan(Math.tan(vf) * asp);
      // iso: the bounding sphere (a little inside it: the box corners never all reach the edge); the orthogonal views: the two extents in view
      const fit = (a, b, dep) => Math.max(a / 2 / Math.tan(hf), b / 2 / Math.tan(vf)) * 1.25 + dep / 2;
      const P = { elev: [[0, 0, 1], fit(ext.x, ext.y, ext.z)], plan: [[0, 1, 0.0005], fit(ext.x, ext.z, ext.y)], sec: [[1, 0, 0], fit(ext.z, ext.y, ext.x)] }, q = P[v];
      const u = q ? q[0] : [0.62, 0.42, 0.66], dist = q ? q[1] : rad / Math.sin(Math.min(vf, hf)) * 0.95, n = Math.hypot(...u);
      S.cam.position.set(c[0] + dist * u[0] / n, c[1] + dist * u[1] / n, c[2] + dist * u[2] / n); S.cam.up.set(0, 1, 0); S.cam.near = dist / 100; S.cam.far = dist * 20; S.cam.updateProjectionMatrix();
      if (S.ctl) { S.ctl.target.set(...c); S.ctl.update(); } else S.cam.lookAt(...c); };
  }
  /* wire the card's controls to view S */
  function wire(el, kind, S, png) {
    const pf = PREF[kind], q = s => el.querySelector(s);
    el.querySelectorAll('[data-d3l]').forEach(cb => cb.addEventListener('change', () => { pf.lay[cb.dataset.d3l] = cb.checked; if (S.groups[cb.dataset.d3l]) S.groups[cb.dataset.d3l].visible = cb.checked; }));
    q('[data-d3op]').addEventListener('input', e => { pf.op = +e.target.value; S.mats.forEach(m => { m.opacity = pf.op; m.transparent = pf.op < 1; m.depthWrite = pf.op >= 1; m.needsUpdate = true; }); });
    q('[data-d3v]').addEventListener('change', e => { pf.view = e.target.value; if (S.home) S.home(pf.view); });
    q('[data-d3reset]').addEventListener('click', () => { if (S.home) S.home(pf.view); });
    q('[data-d3png]').addEventListener('click', () => { S.r.render(S.scene, S.cam); const a = document.createElement('a'); a.href = S.r.domElement.toDataURL('image/png'); a.download = png + '.png'; document.body.appendChild(a); a.click(); a.remove(); });
  }
  /* place the canvas in the card, build when the key changed, start the loop */
  function attach(el, kind, h, key, build, png) {
    const S = view(kind), pf = PREF[kind];
    try {
      h.appendChild(S.r.domElement); size(S, h);
      if (key !== S.key) { build(S); S.key = key; S.home(pf.view); }
      LAYERS[kind].forEach(([k]) => { if (S.groups[k]) S.groups[k].visible = !!pf.lay[k]; });
      if (window.ResizeObserver) { if (S.ro) S.ro.disconnect(); S.ro = new ResizeObserver(() => size(S, h)); S.ro.observe(h); }
      loop(S);
    } catch (e) { h.innerHTML = `<div class="alert err">The 3D view could not start (WebGL): ${esc(e.message)}</div>`; S.key = ''; return null; }
    wire(el, kind, S, png);
    return S;
  }
  const slug = P => String((P && P.project && P.project.name) || 'steel-bridge').replace(/[^\w.-]+/g, '_');

  /* ====================================================================================================== */
  /* Field splice (GirderDetail draw3D)                                                                      */
  /* ====================================================================================================== */
  /* x along the girder (0 at the splice ℄), y up (0 at the bottom of the thicker bottom flange), z across (0 at the web ℄) */
  function buildSplice(S, s) {
    const K = kit(S, 'spl'), R = s.R, F = R.fl, W = R.web, gap = R.gap, D = R.D, L = R.secL, Rr = R.secR;
    const mP = K.mat(0x5e7bd8), mI = K.mat(0x4f9a74), mF = K.mat(0xd9a441);
    const Lx = Math.max(F.top.Lpl, F.bot.Lpl) / 2 + 24, tB = Math.max(L.botT, Rr.botT), tT = Math.max(L.topT, Rr.topT), yW0 = tB, yW1 = tB + D, yc = (yW0 + yW1) / 2;
    const tw = Math.max(L.tw, Rr.tw), d = R.bolt.d, lh = Math.max(1.5, Math.min(4, D * 0.032)), info = { bolts: 0, plates: 0, fillers: 0 };
    // girder ends: each side's own flanges and web (flanges flush on the inside faces, as GirderDetail)
    ['L', 'R'].forEach(sd => { const q = sd === 'L' ? L : Rr, x0 = sd === 'L' ? -Lx : gap / 2, x1 = sd === 'L' ? -gap / 2 : Lx, xm = (x0 + x1) / 2, lx = x1 - x0;
      K.box('gird', xm, yW0 - q.botT / 2, 0, lx, q.botT, q.botB, K.steel); K.box('gird', xm, yc, 0, lx, D, q.tw, K.steel); K.box('gird', xm, yW1 + q.topT / 2, 0, lx, q.topT, q.topB, K.steel);
      // fillers on the thinner flange, between the flange and the outer plate
      ['top', 'bot'].forEach(k => { const f = F[k], tf = k === 'top' ? q.topT : q.botT; if (f.fillSide !== sd || !(f.tfill > 1e-6)) return;
        const yF = k === 'top' ? yW1 + tf + f.tfill / 2 : yW0 - tf - f.tfill / 2, lf = f.Lpl / 2 - gap / 2;
        K.box('fill', (sd === 'L' ? -1 : 1) * (gap / 2 + lf / 2), yF, 0, lf, f.tfill, Math.min(f.bo, sd === 'L' ? f.bL : f.bR), mF); info.fillers++; }); });
    // flange splice plates (outer outside, two inner inside) and their bolts
    ['top', 'bot'].forEach(k => { const f = F[k], up = k === 'top', yOut = up ? yW1 + tT + f.to / 2 : yW0 - tB - f.to / 2;
      K.box('plates', 0, yOut, 0, f.Lpl, f.to, f.bo, mP); info.plates++;
      if (f.inner) [1, -1].forEach(sg => { K.box('plates', 0, up ? yW1 - f.ti / 2 : yW0 + f.ti / 2, sg * (f.yiO + f.yiI) / 2, f.Lpl, f.ti, f.yiO - f.yiI, mI); info.plates++; });
      const yo = up ? yW1 + tT + f.to : yW0 - tB - f.to, grip = tT * (up ? 1 : 0) + tB * (up ? 0 : 1) + f.to + (f.inner ? f.ti : 0), pts = [];
      for (const sd of [-1, 1]) for (let r = 0; r < f.nr; r++) for (let q = 0; q < f.nl; q++) for (const sg of [-1, 1]) pts.push([sd * (gap / 2 + f.ef + r * f.s), yo, sg * (f.g0 + q * f.g)]);
      info.bolts += bolts(K, 'bolts', pts, d, grip, 'y', up ? 1 : -1); });
    // web splice plates, one each side of the web, and the web bolts (head on the +z side)
    const wpL = gap + 2 * (W.ew + (W.ncw - 1) * W.sh + W.ewp);
    [1, -1].forEach(sg => { K.box('plates', 0, yc, sg * (tw / 2 + W.twp / 2), wpL, W.hw, W.twp, mP); info.plates++; });
    const ptw = []; W.bolts.forEach(b => [-1, 1].forEach(sd => ptw.push([sd * (gap / 2 + W.xbar) + b.dx, yc + b.dy, tw / 2 + W.twp])));
    info.bolts += bolts(K, 'bolts', ptw, d, tw + 2 * W.twp, 'z', 1);
    // labels (a fixed size on screen: LH of the view height)
    const bw = Math.max(L.topB, Rr.topB, L.botB, Rr.botB), LH = 0.022;
    K.lab(`Top: outer PL ${frac(F.top.bo)} × ${frac(F.top.to)} × ${f2(F.top.Lpl)}`, 0, yW1 + tT + F.top.to + 3 * lh, 0, LH, '#2346c2');
    if (F.top.inner) K.lab(`Top: 2 inner PL ${frac(F.top.bi)} × ${frac(F.top.ti)}`, -Lx * 0.55, yW1 - F.top.ti - 2 * lh, -(bw / 2), LH * 0.9, '#15724a');
    K.lab(`Bottom: outer PL ${frac(F.bot.bo)} × ${frac(F.bot.to)} × ${f2(F.bot.Lpl)}`, 0, yW0 - tB - F.bot.to - 3 * lh, 0, LH, '#2346c2');
    if (F.bot.inner) K.lab(`Bottom: 2 inner PL ${frac(F.bot.bi)} × ${frac(F.bot.ti)}`, -Lx * 0.55, yW0 + F.bot.ti + 2 * lh, -(bw / 2), LH * 0.9, '#15724a');
    K.lab(`Web: 2 PL ${frac(W.hw)} × ${frac(W.twp)} × ${f2(wpL)}`, wpL / 2, yc + W.hw * 0.3, tw / 2 + W.twp, LH, '#2346c2');
    ['top', 'bot'].forEach(k => { const f = F[k]; if (!(f.tfill > 1e-6) || !f.fillSide) return; const up = k === 'top', sx = f.fillSide === 'L' ? -1 : 1;
      K.lab(`Filler ${frac(f.tfill)}`, sx * (gap / 2 + f.Lpl / 4), up ? yW1 + tT + f.to + lh : yW0 - tB - f.to - lh, -bw / 2, LH * 0.9, '#9a6410'); });
    const side = (q, n) => `${n}: top ${frac(q.topB)} × ${frac(q.topT)}, web ${frac(q.tw)}, bottom ${frac(q.botB)} × ${frac(q.botT)}`;
    K.lab(side(L, 'Left'), -Lx * 0.6, yc + D * 0.18, 0, LH * 0.85, '#334155'); K.lab(side(Rr, 'Right'), Lx * 0.6, yc - D * 0.18, 0, LH * 0.85, '#334155');
    const nf = 2 * (F.top.n + F.bot.n), nw = 2 * W.nw;
    S.info = { ...info, nFlange: nf, nWeb: nw, nTotal: nf + nw, name: s.name };
    S.home = presets(S);
    const twTxt = Math.abs(L.tw - Rr.tw) > 1e-6 ? ` The webs differ (${frac(L.tw)} / ${frac(Rr.tw)} in): the web plates sit on the thicker web; the design has no web filler.` : '';
    return `${esc(s.name)}, gap ${frac(gap)} in: ${nf + nw} bolts ${frac(d)} in (${nf} in the flanges, ${nw} in the web, both sides of the joint), ${info.plates} splice plates${info.fillers ? `, ${info.fillers} filler${info.fillers > 1 ? 's' : ''}` : ''}; to scale, from the Field splices design (no recalculation). Bolt heads, nuts and washers drawn to typical heavy-hex proportions.${twTxt} Lower the girder transparency to see the inner plates and bolts inside the joint.`;
  }
  function splice(host, ctx, RG, sel, onSel) {
    const el = host.querySelector('[data-d3="splice"]'); if (!el || !RG || !RG.list) return;
    const list = RG.list, i = list[sel] ? sel : 0, s = list[i];
    const pick = list.length > 1 ? `<label>Splice <select data-d3sel>${list.map((q, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${esc(q.name)}</option>`).join('')}</select></label>` : '';
    const h = shell(el, 'spl', '3D view of the splice', pick, () => splice(host, ctx, RG, sel, onSel)); if (!h) return;
    const sl = el.querySelector('[data-d3sel]'); if (sl && onSel) sl.addEventListener('change', e => onSel(+e.target.value));
    if (!s || !s.R || (s.R.errors && s.R.errors.length)) { h.innerHTML = `<p class="d3-note">${esc(s ? s.name + ': not designed (input error), nothing to show.' : 'No splice.')}</p>`; return; }
    const R = s.R, key = JSON.stringify(['spl', ctx && ctx.g, s.x, R.D, R.gap, R.secL, R.secR, R.bolt.d, ['top', 'bot'].map(k => { const f = R.fl[k]; return [f.nl, f.nr, f.g0, f.g, f.s, f.ef, f.ep, f.bo, f.to, f.inner, f.bi, f.ti, f.tfill, f.fillSide]; }), [R.web.nrw, R.web.ncw, R.web.sv, R.web.sh, R.web.ew, R.web.ewp, R.web.hw, R.web.twp]]);
    let note = '';
    const S = attach(el, 'spl', h, key, Sx => { note = buildSplice(Sx, s); Sx.note = note; }, `${slug(ctx && ctx.P)}_splice_${String(s.name).replace(/[^\w.-]+/g, '_')}_3d`);
    const nt = el.querySelector('[data-d3note]'); if (S && nt) nt.innerHTML = (S.note || '') + ' Drag to rotate, right-drag or two fingers to pan, wheel or pinch to zoom.';
  }

  /* ====================================================================================================== */
  /* Bearing stiffener (GirderDetail draw3DB, bsRender3D)                                                    */
  /* ====================================================================================================== */
  /* x along the girder (0 at the bearing ℄, the middle of the stiffener group), y up (0 at the bottom of the bottom flange), z across */
  function buildBearing(S, R, i, ctx) {
    const K = kit(S, 'brg'), r = R.BS.rows[i], t = R.BS.types[r.type], D = R.D, T = K.T;
    const np = Math.max(1, Math.round(+t.np || 1)), sp = +t.sp || 0, tp = +t.tp, bt = +t.bt, c = +t.c || 0, w = +t.w || 0.3125, grp = (np - 1) * sp + tp, tw = r.tw, tfb = r.tfb || 1, bfb = r.bfb, bft = r.bft || bfb;
    const sup = (R.gm && R.gm.sup) || [], xs = sup[i] != null ? Math.min(Math.max(sup[i], 0.01), sup[sup.length - 1] - 0.01) : null;
    const tft = xs != null && R.gm.zAt && R.gm.zAt(xs).topT > 0 ? R.gm.zAt(xs).topT : 0.75;   // the top flange at the bearing (as the 2D bearing drawing)
    const L0 = -(r.strip9 + grp / 2), L1 = grp / 2 + r.sEnd, ext = Math.max(30, r.strip9 + 12);
    // the girder end is on the outside of the abutment: Abut. 1 at −x, Abut. 2 (and any other end bearing) at +x, as the 2D drawing
    const endL = r.ed > 0 && /^Abut\. 1\b/.test(String(r.name)), endR = r.ed > 0 && !endL;
    const x0 = endL ? -(grp / 2 - tp / 2 + r.ed) : -grp / 2 - ext, x1 = endR ? grp / 2 - tp / 2 + r.ed : grp / 2 + ext;
    const Ls = endL ? -(grp / 2 + r.sEnd) : L0, Le = endL ? grp / 2 + r.strip9 : L1;
    const yW0 = tfb, yW1 = tfb + D, xm = (x0 + x1) / 2, lx = x1 - x0, lh = Math.max(1.6, Math.min(4, D * 0.035));
    const mP = K.mat(0x5e7bd8), mWd = K.mat(0x2346c2), mC = K.mat(0xe08a1e, { transparent: true, opacity: 0.5, depthWrite: false }), mCs = K.mat(0xe08a1e), mSole = K.mat(0x8a9099), mPad = K.mat(0x3a3d42), mPed = K.mat(0xc8c3b6), mX = K.mat(0x3f6f4f, { transparent: true, opacity: 0.8 });
    K.box('gird', xm, tfb / 2, 0, lx, tfb, bfb, K.steel); K.box('gird', xm, yW0 + D / 2, 0, lx, D, tw, K.steel); K.box('gird', xm, yW1 + tft / 2, 0, lx, tft, bft, K.steel);
    // the stiffener plates with their clips (each pair: one plate each side of the web), extruded through t_p
    const sh = new T.Shape(); sh.moveTo(0, c); sh.lineTo(c, 0); sh.lineTo(bt, 0); sh.lineTo(bt, D); sh.lineTo(c, D); sh.lineTo(0, D - c); sh.lineTo(0, c);
    const geo = new T.ExtrudeGeometry(sh, { depth: tp, bevelEnabled: false }), eg = new T.EdgesGeometry(geo); let nPl = 0;
    const xcs = []; for (let k = 0; k < np; k++) xcs.push(-grp / 2 + tp / 2 + k * sp);
    xcs.forEach(xc => [1, -1].forEach(sg => { const m = new T.Mesh(geo, mP); m.rotation.y = sg > 0 ? -Math.PI / 2 : Math.PI / 2; m.position.set(xc + (sg > 0 ? tp / 2 : -tp / 2), yW0, sg * tw / 2); S.groups.stiff.add(m);
      const e = new T.LineSegments(eg, K.edgeM); e.rotation.copy(m.rotation); e.position.copy(m.position); S.groups.stiff.add(e); nPl++;
      // fillet welds to the web, both faces of the plate, between the clips
      const lw = D - 2 * c, a = w * 0.75; [1, -1].forEach(fx => K.box('stiff', xc + fx * (tp / 2 + a / 2), yW0 + D / 2, sg * (tw / 2 + a / 2), a, lw, a, mWd, false)); }));
    // the effective column of 6.10.11.2.4: the web strip (9t_w(F_yw/F_ys) each side, s_end toward the girder end) over the depth, and a cut at mid-depth
    K.box('col', (Ls + Le) / 2, yW0 + D / 2, 0, Le - Ls, D, tw + 0.08, mC, false);
    const yc = yW0 + D / 2, hc = Math.max(0.3, D * 0.012);
    K.box('col', (Ls + Le) / 2, yc, 0, Le - Ls, hc, tw + 0.1, mCs);
    xcs.forEach(xc => [1, -1].forEach(sg => K.box('col', xc, yc, sg * (tw / 2 + bt / 2), tp + 0.1, hc, bt, mCs)));
    // sole plate, bearing and pedestal (schematic: not designed in this app)
    const sL = Math.max(grp + 6, 14), sW = bfb + 2, tS = 1.5, pL = sL - 2, pW = Math.max(bfb - 2, 8), tPd = 3.5;
    K.box('brg', 0, -tS / 2, 0, sL, tS, sW, mSole); K.box('brg', 0, -tS - tPd / 2, 0, pL, tPd, pW, mPad); K.box('brg', 0, -tS - tPd - 3, 0, pL + 12, 6, pW + 12, mPed);
    // the support cross-frame stubs: the bearing stiffener also serves as the cross-frame connection plate at the supports (cfCP)
    const nb = Math.max(0, Math.round((ctx && ctx.P && ctx.P.xs && ctx.P.xs.nb) || 0)), gi = (ctx && ctx.g) || 0, sides = [];
    if (nb >= 2) { if (gi > 0) sides.push(-1); if (gi < nb - 1) sides.push(1); }
    const xcf = xcs.reduce((b, x) => (Math.abs(x) < Math.abs(b) - 1e-9 ? x : b), xcs[0]), yt = yW1 - Math.max(3, 0.1 * D), yb = yW0 + Math.max(3, 0.1 * D), Ls2 = Math.max(12, D * 0.25);
    const rod = (a, b) => { const A = new T.Vector3(...a), B = new T.Vector3(...b), l = A.distanceTo(B), m = new T.Mesh(new T.CylinderGeometry(0.6, 0.6, l, 8), mX); m.position.copy(A.clone().add(B).multiplyScalar(0.5)); m.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), B.clone().sub(A).normalize()); S.groups.cf.add(m); };
    sides.forEach(sg => { const z0 = sg * (tw / 2 + bt); rod([xcf, yt, z0], [xcf, yt, z0 + sg * Ls2]); rod([xcf, yb, z0], [xcf, yb, z0 + sg * Ls2]); rod([xcf, yb, z0], [xcf, yt, z0 + sg * Ls2]); });
    // labels (a fixed size on screen: LH of the view height)
    const LH = 0.022;
    K.lab(`${np} pair${np > 1 ? 's' : ''} PL ${frac(bt)} × ${frac(tp)}${np > 1 ? ` at ${f2(sp)}` : ''}, clip ${frac(c)}`, 0, yW1 + tft + 2 * lh, 0, LH, '#2346c2');
    K.lab(`${frac(w)} fillet welds to the web`, xcs[0], yW0 + D * 0.72, -(tw / 2 + bt), LH * 0.9, '#2346c2');
    K.lab({ milled: 'Milled to bear on the bottom flange', cjp: 'CJP groove weld to the bottom flange', fillet: 'Fillet welds to the bottom flange' }[t.conn] || '', xcs[0], yW0 + 2 * lh, -(tw / 2 + bt), LH * 0.9, '#2346c2');
    K.lab(`Effective column ${f2(r.Ltot)} in, A = ${f2(r.A)} in²`, (Ls + Le) / 2, yc + 2 * lh, tw / 2 + bt, LH, '#b45309');
    K.lab(`Web ${frac(tw)}; bottom flange ${frac(bfb)} × ${frac(tfb)}`, (endL ? x1 : x0) * 0.7, yW0 + D * 0.3, 0, LH * 0.9, '#334155');
    K.lab('Sole plate and bearing (schematic)', 0, -tS - tPd - 6 - lh, 0, LH * 0.9, '#55595f');
    if (sides.length) K.lab('Support cross-frame (schematic)', xcf, yt + 2 * lh, sides[sides.length - 1] * (tw / 2 + bt + Ls2 * 0.7), LH * 0.9, '#3f6f4f');
    if (r.ed > 0) K.lab(`Girder end (e_d = ${f2(r.ed)} in)`, endL ? x0 + 10 : x1 - 10, yW0 + D * 0.55, 0, LH * 0.9, '#b23a2a');
    S.info = { pairs: np, plates: nPl, cf: sides.length, name: r.name, type: r.type };
    S.home = presets(S);
    return `${esc(r.name)} (Type ${esc(r.type)}): ${np} pair${np > 1 ? 's' : ''} of plates ${frac(bt)} × ${frac(tp)} in, clip ${frac(c)} in; R<sub>u</sub> = ${f2(r.Ru)} kip, (R<sub>sb</sub>)<sub>r</sub> = ${f2(r.Rsb)}, P<sub>r</sub> = ${f2(r.Pr)}, welds R<sub>r</sub> = ${f2(r.Rweld)} kip (the results above, no recalculation). Orange: the effective column of 6.10.11.2.4 (web strips ${f2(r.strip9)} in and ${f2(r.sEnd)} in from the result, with a section cut at mid-depth); to scale.${sides.length ? ' The support cross-frame connects to this stiffener (it is the connection plate at the supports; Cross-frames tab): its members are drawn as stubs, schematic.' : ''} The sole plate, bearing and pedestal are schematic (not designed in this app).`;
  }
  function bearing(host, ctx, R, sel, onSel) {
    const el = host.querySelector('[data-d3="bearing"]'); if (!el || !R || !R.BS) return;
    const rows = R.BS.rows || [];
    let i = sel && sel.k === 'bs' && rows[sel.i] ? sel.i : R.bsGov && rows[R.bsGov.i] ? R.bsGov.i : 0;
    const gov = R.bsGov && rows[R.bsGov.i] ? R.bsGov.i : -1;
    const pick = rows.length > 1 ? `<label>Bearing <select data-d3sel>${rows.map((q, k) => `<option value="${k}"${k === i ? ' selected' : ''}>${esc(q.name)} (Type ${esc(q.type)})${k === gov ? ', governing' : ''}</option>`).join('')}</select></label>` : '';
    const h = shell(el, 'brg', '3D view of the bearing stiffener', pick, () => bearing(host, ctx, R, sel, onSel)); if (!h) return;
    const sl = el.querySelector('[data-d3sel]'); if (sl && onSel) sl.addEventListener('change', e => onSel({ k: 'bs', i: +e.target.value }));
    const r = rows[i];
    if (!r || (R.BS.errors && R.BS.errors.length) || !R.BS.types || !R.BS.types[r.type]) { h.innerHTML = `<p class="d3-note">${R.BS.none ? 'No bearing reactions: the bearing stiffeners are not checked.' : 'No bearing stiffener to show (input error).'}</p>`; return; }
    const t = R.BS.types[r.type], key = JSON.stringify(['brg', ctx && ctx.g, i, r.name, r.tw, r.bft, r.bfb, r.tfb, r.ed, r.strip9, r.sEnd, R.D, t, ctx && ctx.P && ctx.P.xs && ctx.P.xs.nb]);
    const S = attach(el, 'brg', h, key, Sx => { Sx.note = buildBearing(Sx, R, i, ctx); }, `${slug(ctx && ctx.P)}_bearing_${String(r.name).replace(/[^\w.-]+/g, '_')}_3d`);
    const nt = el.querySelector('[data-d3note]'); if (S && nt) nt.innerHTML = (S.note || '') + ' Drag to rotate, right-drag or two fingers to pan, wheel or pinch to zoom.';
  }

  const state = kind => (V[kind] ? { key: !!V[kind].key, ...(V[kind].info || {}), meshes: V[kind].root ? V[kind].root.children.reduce((n, g) => n + g.children.length, 0) : 0 } : null);
  window.SBDDetail3D = { splice, bearing, state };
})();
