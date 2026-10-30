/* apps/steel-bridge/ui/view3d.js — the "3D view" output tab (window.SBD3DUI). Classic script. Display only: nothing here feeds a result.
   Needs three.js r128 and its OrbitControls (the same pinned CDN files as GirderDetail, "Steel Bridge Design.html": cdnjs three.js/r128,
   jsdelivr three@0.128.0 examples/js/controls/OrbitControls.js; CLAUDE.md §2, no new library, no version change), SBDDrawings.model()
   (engine/drawings.js) for the geometry.

   Ported 2026-10-30 from GirderDetail's whole-bridge 3D view (anchors `function v3bBuild() {`, `function v3bLabel(`): girders with their
   plates as built, haunch, connection plates, bearing and intermediate stiffeners, cross-frames (X, K or diaphragms) on their work points,
   bearings and support seats along the skewed support lines, the skewed deck, barriers, curbs, railings, sidewalks and median, shear studs
   by pitch zone. Not ported: the moment and shear diagram fences (they need the analysis), splice plates and bolts (field splice locations
   are shown as markers), the single-girder close-up mode.

   Camera: orbit (left drag / one finger), pan (right drag / two fingers), zoom (wheel / pinch), OrbitControls with damping. The camera keeps
   its position and target when the inputs change and the model is rebuilt (the engineer's request in Base Plate); it is saved in the page's
   ui state (sbd2.ui, field v3d.cam) and restored on reload; "Reset view" frames the whole bridge. Layer toggles (v3d.lay) hide or show a
   group without rebuilding.

   render(host, ctx), ctx = { P, ui, saveUi }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LAY = [['girder', 'Girders and plates', true], ['deck', 'Deck and haunch', true], ['app', 'Barriers, curbs, sidewalks', true], ['xf', 'Cross-frames', true],
    ['stf', 'Stiffeners', true], ['spl', 'Field splices', true], ['stud', 'Shear studs', false], ['brg', 'Bearings and supports', true], ['lbl', 'Labels', true]];
  const V = { r: null, scene: null, cam: null, ctl: null, root: null, groups: {}, key: '', raf: 0, home: null, ro: null, ctx: null, info: '' };

  function label(txt, size, color) {
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 40px system-ui, sans-serif'; const w = Math.ceil(g.measureText(txt).width) + 16; c.width = w; c.height = 56;
    g.font = 'bold 40px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, w, 56); g.fillStyle = color || '#222'; g.fillText(txt, 8, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.set(size * w / 56, size, 1); sp.renderOrder = 10; return sp;
  }
  function init() {
    const T = THREE, r = new T.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true }); r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1)); r.setClearColor(0xf4f5f7);
    const scene = new T.Scene(), cam = new T.PerspectiveCamera(35, 1, 1, 1e6);
    scene.add(new T.AmbientLight(0xffffff, 0.55)); const dl = new T.DirectionalLight(0xffffff, 0.7); dl.position.set(-0.4, 1, 0.6); scene.add(dl); const dl2 = new T.DirectionalLight(0xffffff, 0.25); dl2.position.set(0.5, -0.3, -0.8); scene.add(dl2);
    r.domElement.style.touchAction = 'none'; r.domElement.style.display = 'block'; r.domElement.setAttribute('aria-label', '3D view of the bridge: drag to rotate, right-drag or two fingers to pan, wheel or pinch to zoom');
    const ctl = T.OrbitControls ? new T.OrbitControls(cam, r.domElement) : null;
    if (ctl) { ctl.enableDamping = true; ctl.dampingFactor = 0.12; ctl.screenSpacePanning = true; ctl.touches = { ONE: T.TOUCH.ROTATE, TWO: T.TOUCH.DOLLY_PAN }; ctl.addEventListener('end', saveCam); }
    Object.assign(V, { r, scene, cam, ctl });
  }
  function saveCam() {
    const c = V.ctx; if (!c || !V.cam) return; const t = V.ctl ? V.ctl.target : new THREE.Vector3(), r4 = v => +v.toFixed(2);
    c.ui.v3d.cam = { p: V.cam.position.toArray().map(r4), t: t.toArray().map(r4) }; c.saveUi && c.saveUi();
  }
  function loop() {
    cancelAnimationFrame(V.raf);
    const tick = () => { if (!V.r || !V.r.domElement.isConnected) { V.raf = 0; return; } V.raf = requestAnimationFrame(tick); if (V.ctl) V.ctl.update(); V.r.render(V.scene, V.cam); };
    V.raf = requestAnimationFrame(tick);
  }
  function resize(host) {
    const W = host.clientWidth || 900, H = host.clientHeight || 560; V.r.setSize(W, H); V.cam.aspect = W / H; V.cam.updateProjectionMatrix();
  }

  /* the scene of model G (SBDDrawings.model) */
  function build(G) {
    const T = THREE;
    if (V.root) { V.scene.remove(V.root); V.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); }
    const root = new T.Group(); V.root = root; V.scene.add(root); V.groups = {};
    LAY.forEach(([k]) => { const g = new T.Group(); g.name = k; V.groups[k] = g; root.add(g); });
    const grp = k => V.groups[k];
    const mat = (c, o) => new T.MeshStandardMaterial({ color: c, metalness: 0.15, roughness: 0.7, ...(o || {}) });
    const MT = { steel: mat(0x7d8ea3), stf: mat(0x5f7f9f), deck: mat(0xc8c3b6, { transparent: true, opacity: 0.4, depthWrite: false }), haunch: mat(0xb9b3a4), stud: mat(0xd9b24a), brg: mat(0x2f2f2f), sup: mat(0xb3ada0), xf: mat(0x3f6f4f), app: mat(0xb9b5ab), rail: mat(0x6b7280), spl: mat(0xc0392b) };
    const box = (g, x, y, z, dx, dy, dz, mt) => { if (!(dx > 0 && dy > 0 && dz > 0)) return null; const b = new T.Mesh(new T.BoxGeometry(dx, dy, dz), mt); b.position.set(x, y, z); grp(g).add(b); return b; };
    const rod = (g, p, q, r, mt) => { const a = new T.Vector3(...p), b = new T.Vector3(...q), L = a.distanceTo(b); if (L < 1e-6) return; const c = new T.Mesh(new T.CylinderGeometry(r, r, L, 8), mt); c.position.copy(a.clone().add(b).multiplyScalar(0.5)); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); grp(g).add(c); };
    const inst = (g, pts, geo, mt) => { if (!pts.length) return; const im = new T.InstancedMesh(geo, mt, pts.length), o = new T.Object3D(); pts.forEach((p, i) => { o.position.set(p[0], p[1], p[2]); o.updateMatrix(); im.setMatrixAt(i, o.matrix); }); grp(g).add(im); };
    const FR = G.FR, nb = G.nb, dk = G.deck, Z = i => G.ys[i] * 12, Xg = (g, s) => (g.x0 + s) * 12, segAt = (g, s) => g.segs.find(q => s >= q.s0 - 1e-9 && s <= q.s1 + 1e-9) || g.segs[g.segs.length - 1];
    const Dmax = Math.max(...G.girders.map(g => g.Dmax)), tTmax = Math.max(...G.girders.map(g => g.tTmax)), tBmax = Math.max(...G.girders.map(g => g.tBmax)), yDeckBot = Dmax + tTmax + dk.haunch, yTop = yDeckBot + dk.ts;
    // girders: plates as built; haunch from the top flange to the deck
    G.girders.forEach(g => { const z = Z(g.i);
      g.segs.forEach(s => { const L = (s.s1 - s.s0) * 12, xc = (Xg(g, s.s0) + Xg(g, s.s1)) / 2;
        box('girder', xc, s.D + s.topT / 2, z, L, s.topT, s.topB, MT.steel); box('girder', xc, s.D / 2, z, L, s.D, s.tw, MT.steel); box('girder', xc, -s.botT / 2, z, L, s.botT, s.botB, MT.steel);
        box('deck', xc, (s.D + s.topT + yDeckBot) / 2, z, L, yDeckBot - s.D - s.topT, s.topB, MT.haunch); }); });
    // stiffeners: connection plates, bearing stiffeners, intermediate stiffeners
    const ty = (G.stf && G.stf.transverse && G.stf.transverse.types) || {}, cp = ty.B || { bt: 6, tp: 0.5 }, ts = ty.A || cp, bty = (G.stf && G.stf.bearing && G.stf.bearing.types) || {};
    G.girders.forEach(g => { const z = Z(g.i);
      g.cps.forEach(q => { const s = segAt(g, q.s); box('stf', Xg(g, q.s), s.D / 2, z + q.side * (s.tw / 2 + cp.bt / 2), +cp.tp, s.D, +cp.bt, MT.stf); });
      g.bear.forEach((b, k) => { const bs = (k === 0 || k === g.bear.length - 1 ? bty.A : bty.B) || { np: 1, bt: 7, tp: 0.75, sp: 0 }, s = segAt(g, b), np = Math.max(1, Math.round(+bs.np || 1)), sp = +bs.sp || 0, grp0 = (np - 1) * sp;
        for (let q = 0; q < np; q++) { const x = Xg(g, b) - grp0 / 2 + q * sp; [-1, 1].forEach(sg => box('stf', x, s.D / 2, z + sg * (s.tw / 2 + bs.bt / 2), +bs.tp, s.D, +bs.bt, MT.stf)); } });
      const sg = g.i === 0 ? 1 : -1; g.stiff.forEach(x => { const s = segAt(g, x); box('stf', Xg(g, x), s.D / 2 + 2, z + sg * (s.tw / 2 + ts.bt / 2), +ts.tp, s.D - 4, +ts.bt, MT.stf); }); });
    // field splices: a marker ring around the section at each splice station
    G.girders.forEach(g => { const z = Z(g.i); g.spl.forEach(x => { const s = segAt(g, x), w = Math.max(s.topB, s.botB) + 4;
      box('spl', Xg(g, x), s.D + s.topT + 1, z, 1.5, 2, w, MT.spl); box('spl', Xg(g, x), -s.botT - 1, z, 1.5, 2, w, MT.spl); [-1, 1].forEach(sd => box('spl', Xg(g, x), s.D / 2, z + sd * (s.tw / 2 + 1), 1.5, s.D, 2, MT.spl)); }); });
    // shear studs by pitch zone (rows of nr across the flange, 4d apart)
    { const d = +((G.P.studs || {}).d) || 0.875, hs = +((G.P.studs || {}).h) || 6, pts = [];
      G.girders.forEach(g => { const z = Z(g.i); g.studs.forEach(zn => { const n = Math.max(1, zn.nr || 3), sp = 4 * d, p = zn.p || 12;
        for (let x = zn.s0 * 12 + p / 2; x < zn.s1 * 12 && pts.length < 60000; x += p) { const s = segAt(g, x / 12); for (let q = 0; q < n; q++) pts.push([Xg(g, 0) + x, s.D + s.topT + hs / 2, z + (q - (n - 1) / 2) * sp]); } }); });
      inst('stud', pts, new T.CylinderGeometry(d / 2, d / 2, hs, 8), MT.stud); }
    // cross-frames on their work points (GirderDetail: depth h = the entered height, else 0.8D, at most D_t − 4 in, centered on the girder depth)
    { const Dt = Dmax + tTmax + tBmax, h = Math.min(G.cf.h > 0 ? G.cf.h : Dmax * 0.8, Dt - 4), yb = -tBmax + (Dt - h) / 2, yt = yb + h, r = 1.4, dia = G.cf.dia, ym = -tBmax + Dt / 2;
      FR.frames.forEach(f => { const za = Z(f.bay), zc = Z(f.bay + 1), xa = f.xa * 12, xc = f.xc * 12, A = [xa, yb, za], At = [xa, yt, za], Bb = [xc, yb, zc], Bt = [xc, yt, zc];
        if (dia) { const DX = f.type === 'sup' ? dia.end : dia.int, dx = xc - xa, dz = zc - za, L = Math.hypot(dx, dz), Lm = Math.max(1, L - 2 * dia.gap), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (xa + xc) / 2, cz = (za + zc) / 2;
          const pc = (off, y, sy, sz) => { const b = box('xf', cx - uz * off, y, cz + ux * off, Lm, sy, sz, MT.xf); if (b) b.rotation.y = ry; };
          pc(0, ym, DX.d - 2 * DX.tf, DX.tw); const fo = DX.chS ? (DX.bf - DX.tw) / 2 : 0; pc(fo, ym + (DX.d - DX.tf) / 2, DX.tf, DX.bf); pc(fo, ym - (DX.d - DX.tf) / 2, DX.tf, DX.bf); return; }
        rod('xf', A, Bb, r, MT.xf); rod('xf', At, Bt, r, MT.xf);
        if ((G.cf.type === 'Kb' || G.cf.type === 'K') && f.type !== 'sup') { const Mb = [(xa + xc) / 2, yb, (za + zc) / 2]; rod('xf', At, Mb, r, MT.xf); rod('xf', Bt, Mb, r, MT.xf); }
        else if (G.cf.type === 'Kt' && f.type !== 'sup') { const Mt = [(xa + xc) / 2, yt, (za + zc) / 2]; rod('xf', A, Mt, r, MT.xf); rod('xf', Bb, Mt, r, MT.xf); }
        else { rod('xf', A, Bt, r, MT.xf); rod('xf', At, Bb, r, MT.xf); } }); }
    // bearings and support seats along the skewed support lines
    G.girders.forEach(g => g.bear.forEach(b => box('brg', Xg(g, b), -tBmax - 2, Z(g.i), 20, 4, 16, MT.brg)));
    G.sup.forEach((_, k) => { const ax = FR.xb(k, 0) * 12, az = Z(0), bx = FR.xb(k, nb - 1) * 12, bz = Z(nb - 1), ex = (dk.ohL + 1) * 12, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      const c = new T.Mesh(new T.BoxGeometry(42, 42, L + 2 * ex), MT.sup); c.position.set((ax + bx) / 2, -tBmax - 4 - 21, (az + bz) / 2); c.rotation.y = Math.atan2(ux, uz); grp('brg').add(c); });
    // deck: the skewed plan outline; appurtenances: prisms along the bridge on the deck
    const kN = G.sup.length - 1, ext = (k, zz) => { const ax = FR.xb(k, 0), bx = FR.xb(k, nb - 1), az = G.ys[0], bz = G.ys[nb - 1]; return (ax + (bx - ax) * (zz - az) / (bz - az || 1)) * 12; };
    const prism = (g, za, zb, yb, hgt, mt) => { if (!(zb - za > 1e-6) || !(hgt > 1e-6)) return; const sh = new T.Shape(); sh.moveTo(ext(0, za / 12), za); sh.lineTo(ext(kN, za / 12), za); sh.lineTo(ext(kN, zb / 12), zb); sh.lineTo(ext(0, zb / 12), zb); sh.lineTo(ext(0, za / 12), za);
      const geo = new T.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false }); geo.rotateX(Math.PI / 2); const ms = new T.Mesh(geo, mt); ms.position.y = yb + hgt; grp(g).add(ms); };
    const z0 = -dk.ohL * 12; prism('deck', z0, (G.ys[nb - 1] + dk.ohR) * 12, yTop - dk.ts, dk.ts, MT.deck);
    let nApp = 0;
    if (G.app) G.app.items.forEach(a => { const yb = yTop + a.y0;
      if (a.k === 'sw' || a.k === 'med' || a.k === 'curb' || a.k === 'bar') { prism('app', z0 + a.x0 * 12, z0 + a.x1 * 12, yb, a.h, MT.app); nApp++; }
      else if (a.k === 'rail' || a.k === 'fence') { const z = z0 + a.x * 12; prism('app', z - 1.5, z + 1.5, yb + a.h - 3, 3, MT.rail); prism('app', z - 1.5, z + 1.5, yb + a.h * 0.55 - 1.5, 3, MT.rail);
        const xa = ext(0, z / 12), xb = ext(kN, z / 12), n = Math.max(1, Math.round((xb - xa) / 96)), pts = []; for (let q = 0; q <= n; q++) pts.push([xa + (xb - xa) * q / n, yb + a.h / 2, z]); inst('app', pts, new T.BoxGeometry(3, a.h, 3), MT.rail); nApp++; } });
    // labels: girders at the Abut. 1 end, supports
    const lsz = Math.max(18, Dmax * 0.35);
    G.girders.forEach(g => { const sp = label(g.label, lsz, '#1f4e8c'); sp.position.set(Xg(g, 0) - 6 * lsz, Dmax / 2, Z(g.i)); grp('lbl').add(sp); });
    G.sup.forEach((_, k) => { const sp = label(k === 0 ? 'Abut. 1' : k === kN ? 'Abut. 2' : `Pier ${k}`, lsz, '#333'); sp.position.set(FR.xb(k, nb - 1) * 12, yTop + 3 * lsz, (G.ys[nb - 1] + dk.ohR) * 12 + 2 * lsz); grp('lbl').add(sp); });
    const bb = new T.Box3().setFromObject(root), c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()), R = Math.max(sz.x, sz.y * 4, sz.z) * 0.62;
    V.home = () => { V.cam.position.copy(c.clone().add(new T.Vector3(-0.55, 0.55, 1).normalize().multiplyScalar(R * 1.6))); if (V.ctl) { V.ctl.target.copy(c); V.ctl.update(); } else V.cam.lookAt(c); };
    V.cam.near = Math.max(0.5, R / 500); V.cam.far = R * 40; V.cam.updateProjectionMatrix();
    V.info = `${nb} girders, ${FR.frames.length} ${G.cf.dia ? 'diaphragms' : `cross-frames (type ${G.cf.type})`}, deck ${window.SharedDxf.frac(dk.ts)} in on a ${window.SharedDxf.frac(dk.haunch)} in haunch${nApp ? ', barriers, curbs, railings, sidewalks and median of the Cross-section & loads tab (barrier and railing heights schematic)' : ''}; skews ${G.skews.map(v => (+v).toFixed(1)).join(' / ')}°.`;
  }

  function css() {
    if (document.getElementById('v3d-css')) return;
    const st = document.createElement('style'); st.id = 'v3d-css';
    st.textContent = `.v3d-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-family:var(--font-ui);font-size:9pt;}
      .v3d-host{width:100%;height:min(68vh,680px);min-height:320px;border:1px solid var(--line);background:#f4f5f7;touch-action:none;overflow:hidden;}`;
    document.head.appendChild(st);
  }
  function render(host, ctx) {
    css(); V.ctx = ctx; const ui = ctx.ui; ui.v3d = ui.v3d || {}; ui.v3d.lay = Object.assign(Object.fromEntries(LAY.map(([k, , on]) => [k, on])), ui.v3d.lay || {});
    const bar = `<div class="v3d-bar">${LAY.map(([k, l]) => `<label><input type="checkbox" data-v3d="${k}"${ui.v3d.lay[k] ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      <span style="flex:1"></span><button type="button" id="v3d_reset">Reset view</button><button type="button" id="v3d_png">Save PNG</button></div>`;
    if (typeof THREE === 'undefined' && document.readyState === 'loading') {   // three.js is loaded with defer: it runs after the page's own script
      host.innerHTML = '<p class="note">Loading the 3D library…</p>'; document.addEventListener('DOMContentLoaded', () => { if (host.isConnected && ctx.ui.otab === '3d') render(host, ctx); }, { once: true }); return; }
    if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) { host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody"><div class="alert err">The 3D library (three.js r128 from cdnjs) could not be loaded: this view needs an internet connection the first time.</div></div></section>`; return; }
    let G = null; try { G = window.SBDDrawings.model(ctx.P); } catch (e) { G = { errors: [`The model could not be built: ${e.message}`] }; }
    if (G.errors.length) { host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody"><div class="alert err">${G.errors.map(esc).join('<br>')}</div></div></section>`; return; }
    host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody">${bar}<div id="v3d-host" class="v3d-host"></div>
      <p class="note" id="v3d-note"></p><p class="note">Drag to rotate, right-drag (or two fingers) to pan, wheel (or pinch) to zoom. The view keeps its camera when the inputs change; Reset view frames the bridge. Geometry as on the Drawings tab (see the framing plan for the stations).</p>
      ${G.warnings.length ? `<div class="alert">${G.warnings.map(esc).join('<br>')}</div>` : ''}</div></section>`;
    const h = host.querySelector('#v3d-host');
    try {
      if (!V.r) init();
      h.appendChild(V.r.domElement); resize(h);
      const key = JSON.stringify([ctx.P.spans, ctx.P.xs, ctx.P.girders, ctx.P.deck, ctx.P.framing, ctx.P.crossframes, ctx.P.stiffeners, ctx.P.studs, ctx.P.materials]);
      const first = !V.root;
      if (key !== V.key || first) { build(G); V.key = key; }
      LAY.forEach(([k]) => { V.groups[k].visible = !!ui.v3d.lay[k]; });
      if (first) { const cm = ui.v3d.cam; if (cm && cm.p && cm.t) { V.cam.position.fromArray(cm.p); if (V.ctl) { V.ctl.target.fromArray(cm.t); V.ctl.update(); } } else V.home(); }
      host.querySelector('#v3d-note').textContent = V.info;
      if (window.ResizeObserver) { if (V.ro) V.ro.disconnect(); V.ro = new ResizeObserver(() => resize(h)); V.ro.observe(h); }
      loop();
    } catch (e) { h.innerHTML = `<div class="alert err">The 3D view could not start (WebGL): ${esc(e.message)}</div>`; return; }
    host.querySelectorAll('[data-v3d]').forEach(el => el.addEventListener('change', () => { ui.v3d.lay[el.dataset.v3d] = el.checked; if (V.groups[el.dataset.v3d]) V.groups[el.dataset.v3d].visible = el.checked; ctx.saveUi && ctx.saveUi(); }));
    host.querySelector('#v3d_reset').addEventListener('click', () => { if (V.home) { V.home(); saveCam(); } });
    host.querySelector('#v3d_png').addEventListener('click', () => { V.r.render(V.scene, V.cam); const a = document.createElement('a'); a.href = V.r.domElement.toDataURL('image/png');
      a.download = ((ctx.P.project && ctx.P.project.name) || 'steel-bridge').replace(/[^\w.-]+/g, '_') + '_3d.png'; document.body.appendChild(a); a.click(); a.remove(); });
  }
  /* the camera (tests): { p, t } */
  const camera = () => (V.cam ? { p: V.cam.position.toArray(), t: V.ctl ? V.ctl.target.toArray() : null } : null);

  window.SBD3DUI = { render, camera, LAY };
})();
