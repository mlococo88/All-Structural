/* apps/steel-bridge/ui/view3d.js — the "3D view" output tab (window.SBD3DUI). Classic script. Display only: nothing here feeds a result.
   Needs three.js r128 and its OrbitControls (the same pinned CDN files as GirderDetail, "Steel Bridge Design.html": cdnjs three.js/r128,
   jsdelivr three@0.128.0 examples/js/controls/OrbitControls.js; CLAUDE.md §2, no new library, no version change), SBDDrawings.model()
   (engine/drawings.js) for the geometry.

   Ported 2026-10-30 from GirderDetail's whole-bridge 3D view (anchors `function v3bBuild() {`, `function v3bLabel(`): girders with their
   plates as built, haunch, connection plates, bearing and intermediate stiffeners, cross-frames (X, K or diaphragms) on their work points,
   bearings and support seats along the skewed support lines, the skewed deck, barriers, curbs, railings, sidewalks and median, shear studs
   by pitch zone. Added 2026-10-30 (SB2-DW5, GirderDetail `v3bSeries`, the fences of `v3bBuild`, `V3B.focus`): the moment and shear
   diagrams as fences beside each girder (Strength I, Service II, LL+IM, DC1, DC2 + DW, fatigue moments; Strength I, LL+IM, dead-load
   shears; + moment drawn down by default, scale slider, the value under the pointer), the field splice plates (every bolt in the
   close-up) and the single-girder close-up mode (one girder with its tributary deck strip, studs on, zoom to each splice or bearing).
   The diagrams and splice plates read the results of the Drawings tab (SBDDrawingsUI.results: the analysis and the Field splices
   design of each plate girder, at each girder's own stations); "Calculate results" here runs the same.

   Camera: orbit (left drag / one finger), pan (right drag / two fingers), zoom (wheel / pinch), OrbitControls with damping. The camera keeps
   its position and target when the inputs change and the model is rebuilt (the engineer's request in Base Plate); it is saved in the page's
   ui state (sbd2.ui, field v3d.cam) and restored on reload; "Reset view" frames the whole bridge. Layer toggles (v3d.lay) hide or show a
   group without rebuilding.

   render(host, ctx), ctx = { P, ui, saveUi }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LAY = [['girder', 'Girders and plates', true], ['deck', 'Deck and haunch', true], ['app', 'Barriers, curbs, sidewalks', true], ['xf', 'Cross-frames', true],
    ['stf', 'Stiffeners', true], ['spl', 'Field splices', true], ['stud', 'Shear studs', false], ['brg', 'Bearings and supports', true], ['lbl', 'Labels', true], ['dg', 'Diagram', true]];
  /* the diagrams (GirderDetail V3B_DG) */
  const DG = [['off', 'No diagram'], ['mStr', 'Moment: Strength I envelope'], ['mSvc', 'Moment: Service II envelope'], ['mLL', 'Moment: LL+IM envelope'], ['mDC1', 'Moment: DC1'], ['mSD', 'Moment: DC2 + DW'],
    ['vStr', 'Shear: Strength I envelope'], ['vLL', 'Shear: LL+IM envelope'], ['vDC', 'Shear: DC1 + DC2 + DW'], ['fat', 'Moment: fatigue (max/min)']];
  /* series k of analysis A: { x (analysis ft), hi, lo, u } (engine/sheets.js env: the Flexure tab's Strength I combination) */
  function series(A, k) {
    const E = window.SBDSheets.env(A), V = E.V, add = (a, b) => a.map((v, i) => v + b[i]);
    if (k === 'mStr') return { x: E.x, hi: E.Mp, lo: E.Mn, u: 'kip-ft' }; if (k === 'mSvc') return { x: E.x, hi: E.MSv, lo: E.MSvN, u: 'kip-ft' };
    if (k === 'mLL') return { x: E.x, hi: E.LLp, lo: E.LLn, u: 'kip-ft' }; if (k === 'mDC1') return { x: E.x, hi: E.MDC1, lo: null, u: 'kip-ft' };
    if (k === 'mSD') return { x: E.x, hi: E.MSD, lo: null, u: 'kip-ft' }; if (k === 'fat') return { x: E.x, hi: E.FMp, lo: E.FMn, u: 'kip-ft' };
    if (k === 'vLL') return { x: V.x, hi: V.LLp, lo: V.LLn, u: 'kip' }; if (k === 'vDC') return { x: V.x, hi: add(V.DC, V.DW), lo: null, u: 'kip' };
    return { x: V.x, hi: V.Sx, lo: V.Sn, u: 'kip' };
  }
  const V = { r: null, scene: null, cam: null, ctl: null, root: null, groups: {}, key: '', raf: 0, home: null, ro: null, ctx: null, info: '', fences: [], tg: null, focus: null, dgLbl: '', mode: '' };

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

  /* the scene of model G (SBDDrawings.model); o = { gs (girder index of the close-up, −1 the whole bridge), RS (results), dg, dsc, eng } */
  function build(G, o) {
    const T = THREE; o = o || { gs: -1 }; const single = o.gs >= 0, gl = single ? [G.girders[o.gs]] : G.girders;
    if (V.root) { V.scene.remove(V.root); V.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); }
    const root = new T.Group(); V.root = root; V.scene.add(root); V.groups = {};
    LAY.forEach(([k]) => { const g = new T.Group(); g.name = k; V.groups[k] = g; root.add(g); });
    const grp = k => V.groups[k];
    const mat = (c, o) => new T.MeshStandardMaterial({ color: c, metalness: 0.15, roughness: 0.7, ...(o || {}) });
    const MT = { steel: mat(0x7d8ea3), stf: mat(0x5f7f9f), deck: mat(0xc8c3b6, { transparent: true, opacity: single ? 0.55 : 0.4, depthWrite: false }), plate: mat(0xc9853a), bolt: mat(0x2c2c2c), haunch: mat(0xb9b3a4), stud: mat(0xd9b24a), brg: mat(0x2f2f2f), sup: mat(0xb3ada0), xf: mat(0x3f6f4f), app: mat(0xb9b5ab), rail: mat(0x6b7280), spl: mat(0xc0392b) };
    const box = (g, x, y, z, dx, dy, dz, mt) => { if (!(dx > 0 && dy > 0 && dz > 0)) return null; const b = new T.Mesh(new T.BoxGeometry(dx, dy, dz), mt); b.position.set(x, y, z); grp(g).add(b); return b; };
    const rod = (g, p, q, r, mt) => { const a = new T.Vector3(...p), b = new T.Vector3(...q), L = a.distanceTo(b); if (L < 1e-6) return; const c = new T.Mesh(new T.CylinderGeometry(r, r, L, 8), mt); c.position.copy(a.clone().add(b).multiplyScalar(0.5)); c.quaternion.setFromUnitVectors(new T.Vector3(0, 1, 0), b.clone().sub(a).normalize()); grp(g).add(c); };
    const inst = (g, pts, geo, mt, rot) => { if (!pts.length) return; const im = new T.InstancedMesh(geo, mt, pts.length), ob = new T.Object3D(); if (rot) ob.rotation.set(...rot); pts.forEach((p, i) => { ob.position.set(p[0], p[1], p[2]); ob.updateMatrix(); im.setMatrixAt(i, ob.matrix); }); grp(g).add(im); };
    const FR = G.FR, nb = G.nb, dk = G.deck, Z = i => G.ys[i] * 12, Xg = (g, s) => (g.x0 + s) * 12, segAt = (g, s) => g.segs.find(q => s >= q.s0 - 1e-9 && s <= q.s1 + 1e-9) || g.segs[g.segs.length - 1];
    const Dmax = Math.max(...G.girders.map(g => g.Dmax)), tTmax = Math.max(...G.girders.map(g => g.tTmax)), tBmax = Math.max(...G.girders.map(g => g.tBmax)), yDeckBot = Dmax + tTmax + dk.haunch, yTop = yDeckBot + dk.ts;
    // girders: plates as built; haunch from the top flange to the deck
    gl.forEach(g => { const z = Z(g.i);
      g.segs.forEach(s => { const L = (s.s1 - s.s0) * 12, xc = (Xg(g, s.s0) + Xg(g, s.s1)) / 2;
        box('girder', xc, s.D + s.topT / 2, z, L, s.topT, s.topB, MT.steel); box('girder', xc, s.D / 2, z, L, s.D, s.tw, MT.steel); box('girder', xc, -s.botT / 2, z, L, s.botT, s.botB, MT.steel);
        box('deck', xc, (s.D + s.topT + yDeckBot) / 2, z, L, yDeckBot - s.D - s.topT, s.topB, MT.haunch); }); });
    // stiffeners: connection plates, bearing stiffeners, intermediate stiffeners
    const ty = (G.stf && G.stf.transverse && G.stf.transverse.types) || {}, cp = ty.B || { bt: 6, tp: 0.5 }, ts = ty.A || cp, bty = (G.stf && G.stf.bearing && G.stf.bearing.types) || {};
    gl.forEach(g => { const z = Z(g.i);
      g.cps.forEach(q => { const s = segAt(g, q.s); box('stf', Xg(g, q.s), s.D / 2, z + q.side * (s.tw / 2 + cp.bt / 2), +cp.tp, s.D, +cp.bt, MT.stf); });
      g.bear.forEach((b, k) => { const bs = (k === 0 || k === g.bear.length - 1 ? bty.A : bty.B) || { np: 1, bt: 7, tp: 0.75, sp: 0 }, s = segAt(g, b), np = Math.max(1, Math.round(+bs.np || 1)), sp = +bs.sp || 0, grp0 = (np - 1) * sp;
        for (let q = 0; q < np; q++) { const x = Xg(g, b) - grp0 / 2 + q * sp; [-1, 1].forEach(sg => box('stf', x, s.D / 2, z + sg * (s.tw / 2 + bs.bt / 2), +bs.tp, s.D, +bs.bt, MT.stf)); } });
      const sg = g.i === 0 ? 1 : -1; g.stiff.forEach(x => { const s = segAt(g, x); box('stf', Xg(g, x), s.D / 2 + 2, z + sg * (s.tw / 2 + ts.bt / 2), +ts.tp, s.D - 4, +ts.bt, MT.stf); }); });
    // field splices: the splice plates of the Field splices design (every bolt in the close-up; GirderDetail v3bBuild); a marker ring
    // around the section where the splice is not designed or the results are not calculated
    let nSplP = 0;
    gl.forEach(g => { const z = Z(g.i); g.spl.forEach((x, k) => { const s = segAt(g, x), R = window.SBDDrawings.splR(o.RS, g, k), xc = Xg(g, x);
      if (!R) { const w = Math.max(s.topB, s.botB) + 4; box('spl', xc, s.D + s.topT + 1, z, 1.5, 2, w, MT.spl); box('spl', xc, -s.botT - 1, z, 1.5, 2, w, MT.spl); [-1, 1].forEach(sd => box('spl', xc, s.D / 2, z + sd * (s.tw / 2 + 1), 1.5, s.D, 2, MT.spl)); return; }
      const F = R.fl, Wb = R.web, D = R.D, sl = segAt(g, x - 1e-6), sr = segAt(g, x + 1e-6), tT = Math.max(sl.topT, sr.topT), tB = Math.max(sl.botT, sr.botT), tw = Math.max(sl.tw, sr.tw); nSplP++;
      box('spl', xc, D + tT + F.top.to / 2, z, F.top.Lpl, F.top.to, F.top.bo, MT.plate); box('spl', xc, -tB - F.bot.to / 2, z, F.bot.Lpl, F.bot.to, F.bot.bo, MT.plate);
      const wpL = R.gap + 2 * (Wb.ew + (Wb.ncw - 1) * Wb.sh + Wb.ewp); [-1, 1].forEach(sg => box('spl', xc, D / 2, z + sg * (tw / 2 + Wb.twp / 2), wpL, Wb.hw, Wb.twp, MT.plate));
      if (single) { const rb = (R.bolt.dh || 1) / 2 - 0.03, pts = [], ptw = [];
        [['top', D + tT + F.top.to + 0.4], ['bot', -tB - F.bot.to - 0.4]].forEach(([kk, y]) => { const f = F[kk]; for (const sd of [-1, 1]) for (let r = 0; r < f.nr; r++) for (let q = 0; q < f.nl; q++) [1, -1].forEach(sg => pts.push([xc + sd * (R.gap / 2 + f.ef + r * f.s), y, z + sg * (f.g0 + q * f.g)])); });
        Wb.bolts.forEach(b => [-1, 1].forEach(sd => [-1, 1].forEach(sg => ptw.push([xc + sd * (R.gap / 2 + Wb.xbar) + b.dx, D / 2 + b.dy, z + sg * (tw / 2 + Wb.twp + 0.4)]))));
        inst('spl', pts, new T.CylinderGeometry(rb * 1.5, rb * 1.5, 0.8, 6), MT.bolt); inst('spl', ptw, new T.CylinderGeometry(rb * 1.5, rb * 1.5, 0.8, 6), MT.bolt, [Math.PI / 2, 0, 0]); } }); });
    // shear studs by pitch zone (rows of nr across the flange, 4d apart)
    { const d = +((G.P.studs || {}).d) || 0.875, hs = +((G.P.studs || {}).h) || 6, pts = [];
      gl.forEach(g => { const z = Z(g.i); g.studs.forEach(zn => { const n = Math.max(1, zn.nr || 3), sp = 4 * d, p = zn.p || 12;
        for (let x = zn.s0 * 12 + p / 2; x < zn.s1 * 12 && pts.length < 60000; x += p) { const s = segAt(g, x / 12); for (let q = 0; q < n; q++) pts.push([Xg(g, 0) + x, s.D + s.topT + hs / 2, z + (q - (n - 1) / 2) * sp]); } }); });
      inst('stud', pts, new T.CylinderGeometry(d / 2, d / 2, hs, 8), MT.stud); }
    // cross-frames on their work points (GirderDetail: depth h = the entered height, else 0.8D, at most D_t − 4 in, centered on the girder depth)
    { const Dt = Dmax + tTmax + tBmax, h = Math.min(G.cf.h > 0 ? G.cf.h : Dmax * 0.8, Dt - 4), yb = -tBmax + (Dt - h) / 2, yt = yb + h, r = 1.4, dia = G.cf.dia, ym = -tBmax + Dt / 2;
      if (!single) FR.frames.forEach(f => { const za = Z(f.bay), zc = Z(f.bay + 1), xa = f.xa * 12, xc = f.xc * 12, A = [xa, yb, za], At = [xa, yt, za], Bb = [xc, yb, zc], Bt = [xc, yt, zc];
        if (dia) { const DX = f.type === 'sup' ? dia.end : dia.int, dx = xc - xa, dz = zc - za, L = Math.hypot(dx, dz), Lm = Math.max(1, L - 2 * dia.gap), ry = Math.atan2(-dz, dx), ux = dx / L, uz = dz / L, cx = (xa + xc) / 2, cz = (za + zc) / 2;
          const pc = (off, y, sy, sz) => { const b = box('xf', cx - uz * off, y, cz + ux * off, Lm, sy, sz, MT.xf); if (b) b.rotation.y = ry; };
          pc(0, ym, DX.d - 2 * DX.tf, DX.tw); const fo = DX.chS ? (DX.bf - DX.tw) / 2 : 0; pc(fo, ym + (DX.d - DX.tf) / 2, DX.tf, DX.bf); pc(fo, ym - (DX.d - DX.tf) / 2, DX.tf, DX.bf); return; }
        rod('xf', A, Bb, r, MT.xf); rod('xf', At, Bt, r, MT.xf);
        if ((G.cf.type === 'Kb' || G.cf.type === 'K') && f.type !== 'sup') { const Mb = [(xa + xc) / 2, yb, (za + zc) / 2]; rod('xf', At, Mb, r, MT.xf); rod('xf', Bt, Mb, r, MT.xf); }
        else if (G.cf.type === 'Kt' && f.type !== 'sup') { const Mt = [(xa + xc) / 2, yt, (za + zc) / 2]; rod('xf', A, Mt, r, MT.xf); rod('xf', Bb, Mt, r, MT.xf); }
        else { rod('xf', A, Bt, r, MT.xf); rod('xf', At, Bb, r, MT.xf); } }); }
    // bearings and support seats along the skewed support lines
    gl.forEach(g => g.bear.forEach(b => box('brg', Xg(g, b), -tBmax - 2, Z(g.i), 20, 4, 16, MT.brg)));
    if (!single) G.sup.forEach((_, k) => { const ax = FR.xb(k, 0) * 12, az = Z(0), bx = FR.xb(k, nb - 1) * 12, bz = Z(nb - 1), ex = (dk.ohL + 1) * 12, L = Math.hypot(bx - ax, bz - az), ux = (bx - ax) / L, uz = (bz - az) / L;
      const c = new T.Mesh(new T.BoxGeometry(42, 42, L + 2 * ex), MT.sup); c.position.set((ax + bx) / 2, -tBmax - 4 - 21, (az + bz) / 2); c.rotation.y = Math.atan2(ux, uz); grp('brg').add(c); });
    // deck: the skewed plan outline; appurtenances: prisms along the bridge on the deck
    const kN = G.sup.length - 1, ext = (k, zz) => { const ax = FR.xb(k, 0), bx = FR.xb(k, nb - 1), az = G.ys[0], bz = G.ys[nb - 1]; return (ax + (bx - ax) * (zz - az) / (bz - az || 1)) * 12; };
    const prism = (g, za, zb, yb, hgt, mt) => { if (!(zb - za > 1e-6) || !(hgt > 1e-6)) return; const sh = new T.Shape(); sh.moveTo(ext(0, za / 12), za); sh.lineTo(ext(kN, za / 12), za); sh.lineTo(ext(kN, zb / 12), zb); sh.lineTo(ext(0, zb / 12), zb); sh.lineTo(ext(0, za / 12), za);
      const geo = new T.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false }); geo.rotateX(Math.PI / 2); const ms = new T.Mesh(geo, mt); ms.position.y = yb + hgt; grp(g).add(ms); };
    const z0 = -dk.ohL * 12;
    if (!single) prism('deck', z0, (G.ys[nb - 1] + dk.ohR) * 12, yTop - dk.ts, dk.ts, MT.deck);
    else { const g = gl[0], i = g.i, wL = i === 0 ? dk.ohL * 12 : (G.ys[i] - G.ys[i - 1]) * 6, wR = i === nb - 1 ? dk.ohR * 12 : (G.ys[i + 1] - G.ys[i]) * 6, x0 = Xg(g, g.segs[0].s0), x1 = Xg(g, g.segs[g.segs.length - 1].s1);
      box('deck', (x0 + x1) / 2, yTop - dk.ts / 2, Z(i) + (wR - wL) / 2, x1 - x0, dk.ts, wL + wR, MT.deck); }
    let nApp = 0;
    if (G.app && !single) G.app.items.forEach(a => { const yb = yTop + a.y0;
      if (a.k === 'sw' || a.k === 'med' || a.k === 'curb' || a.k === 'bar') { prism('app', z0 + a.x0 * 12, z0 + a.x1 * 12, yb, a.h, MT.app); nApp++; }
      else if (a.k === 'rail' || a.k === 'fence') { const z = z0 + a.x * 12; prism('app', z - 1.5, z + 1.5, yb + a.h - 3, 3, MT.rail); prism('app', z - 1.5, z + 1.5, yb + a.h * 0.55 - 1.5, 3, MT.rail);
        const xa = ext(0, z / 12), xb = ext(kN, z / 12), n = Math.max(1, Math.round((xb - xa) / 96)), pts = []; for (let q = 0; q <= n; q++) pts.push([xa + (xb - xa) * q / n, yb + a.h / 2, z]); inst('app', pts, new T.BoxGeometry(3, a.h, 3), MT.rail); nApp++; } });
    // labels: girders at the Abut. 1 end, supports
    const lsz = Math.max(18, Dmax * 0.35, 0.012 * (G.sup[G.sup.length - 1] - G.sup[0]) * 12);
    gl.forEach(g => { const sp = label(g.label, lsz, '#1f4e8c'); sp.position.set(Xg(g, 0) - 6 * lsz, Dmax / 2, Z(g.i)); grp('lbl').add(sp); });
    if (!single) G.sup.forEach((_, k) => { const sp = label(k === 0 ? 'Abut. 1' : k === kN ? 'Abut. 2' : `Pier ${k}`, lsz, '#333'); sp.position.set(FR.xb(k, nb - 1) * 12, yTop + 3 * lsz, (G.ys[nb - 1] + dk.ohR) * 12 + 2 * lsz); grp('lbl').add(sp); });
    // moment and shear diagrams: a fence beside each girder (GirderDetail v3bBuild; + moment drawn down by default)
    V.fences = []; V.dgLbl = ''; const dg = o.dg || 'off', haveA = gl.some(g => o.RS && o.RS.pg[g.pg] && o.RS.pg[g.pg].an);
    if (dg !== 'off' && haveA) { const sgn = (o.eng !== false && dg[0] === 'm') ? -1 : 1, all = [], Lsp = Math.max(...G.spans) * 12;
      gl.forEach(g => { const A = o.RS.pg[g.pg] && o.RS.pg[g.pg].an; if (A) all.push([g, series(A, dg)]); });
      const mx = Math.max(1e-9, ...all.flatMap(([, q]) => [...q.hi, ...(q.lo || [])].map(Math.abs))), amp = (+o.dsc || 1) * Math.max(1.2 * Dmax, (single ? 0.12 : 0.08) * Lsp) / mx, lz = single ? Dmax * 0.09 : Dmax * 0.28;
      const fill = c => new T.MeshBasicMaterial({ color: c, transparent: true, opacity: 0.22, side: T.DoubleSide, depthWrite: false, depthTest: false });
      all.forEach(([g, q]) => { const i = g.i, S0 = (nb > 1 ? (i < nb - 1 ? G.ys[i + 1] - G.ys[i] : G.ys[i] - G.ys[i - 1]) : 8) * 12, zf = Z(i) + (i === nb - 1 && nb > 1 ? -1 : 1) * (single ? S0 / 2 + 36 : 0.3 * S0);
        const X = x => Xg(g, window.SBDFraming.toG(FR, i, G.sup, x)), y0 = Dmax / 2, Y = v => y0 + sgn * v * amp;
        const band = (vals, col) => { const pos = []; for (let k = 0; k < vals.length - 1; k++) { const a = [X(q.x[k]), y0, zf], b = [X(q.x[k + 1]), y0, zf], c2 = [X(q.x[k + 1]), Y(vals[k + 1]), zf], d2 = [X(q.x[k]), Y(vals[k]), zf]; pos.push(...a, ...b, ...c2, ...a, ...c2, ...d2); }
          const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); const ms = new T.Mesh(geo, fill(col)); ms.renderOrder = 5; ms.userData = { g, q, X }; grp('dg').add(ms); V.fences.push(ms);
          const ln = new T.Line(new T.BufferGeometry().setFromPoints(q.x.map((x, k) => new T.Vector3(X(x), Y(vals[k]), zf))), new T.LineBasicMaterial({ color: col, depthTest: false })); ln.renderOrder = 6; grp('dg').add(ln); };
        grp('dg').add(new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(X(q.x[0]), y0, zf), new T.Vector3(X(q.x[q.x.length - 1]), y0, zf)]), new T.LineBasicMaterial({ color: 0x555555, depthTest: false })));
        band(q.hi, 0xb23a2a); if (q.lo) band(q.lo, 0x1f4e8c);
        const tick = (xa, dashed) => { const hh = 1.05 * amp * mx, l = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(xa, y0 - hh, zf), new T.Vector3(xa, y0 + hh, zf)]), dashed ? new T.LineDashedMaterial({ color: 0x777777, dashSize: Dmax / 6, gapSize: Dmax / 8 }) : new T.LineBasicMaterial({ color: 0x777777 })); if (dashed) l.computeLineDistances(); grp('dg').add(l); };
        g.bear.forEach(b => tick(Xg(g, b), false)); g.spl.forEach(s => tick(Xg(g, s), true));
        const lab = (k, vals, col) => { const v = vals[k]; if (!(Math.abs(v) > 1e-6)) return; const sp = label(`${v.toFixed(0)}`, single ? Lsp * 0.012 : lz, col); sp.position.set(X(q.x[k]), Y(v) + sgn * Math.sign(v) * lz * 0.8, zf); grp('dg').add(sp); };
        const peak = (vals, col, want) => { let bi = 0; vals.forEach((v, k) => { if (want * v > want * vals[bi]) bi = k; }); lab(bi, vals, col); };
        peak(q.hi, '#b23a2a', 1); if (q.lo) peak(q.lo, '#1f4e8c', -1);
        if (single) { const near = xa => q.x.reduce((b, x, k) => Math.abs(x - xa) < Math.abs(q.x[b] - xa) ? k : b, 0); G.sup.slice(1, -1).forEach(s => lab(near(s), q.lo || q.hi, '#1f4e8c')); G.splices.forEach(s => { const k = near(s); lab(k, q.hi, '#b23a2a'); if (q.lo) lab(k, q.lo, '#1f4e8c'); }); } });
      V.dgLbl = `${(DG.find(d => d[0] === dg) || [])[1]} (${all[0] ? all[0][1].u : ''})`; }
    const bb = new T.Box3().setFromObject(root), c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()), R = Math.max(sz.x, sz.y * 4, sz.z) * 0.62;
    V.home = () => { V.cam.position.copy(c.clone().add((single ? new T.Vector3(-0.35, 0.28, 1) : new T.Vector3(-0.55, 0.55, 1)).normalize().multiplyScalar(R * (single ? 1.6 : 1.9)))); V.cam.near = Math.max(0.5, R / 500); V.cam.far = R * 40; V.cam.updateProjectionMatrix(); if (V.ctl) { V.ctl.target.copy(c); V.ctl.update(); } else V.cam.lookAt(c); };
    // close-up targets of the single girder: its splices and bearings (GirderDetail V3B.focus)
    V.focus = (x, span) => { const g = gl[0], tgt = new T.Vector3(x, Dmax / 2, Z(single ? g.i : 0)), r = span || 180; V.cam.position.copy(tgt.clone().add(new T.Vector3(-0.55, 0.35, 1).normalize().multiplyScalar(r * 1.5))); V.cam.near = r / 400; V.cam.far = Math.max(r * 60, R * 40); V.cam.updateProjectionMatrix(); if (V.ctl) { V.ctl.target.copy(tgt); V.ctl.update(); } };
    V.tg = single ? [['all', 'Whole girder', null], ...gl[0].spl.map((s, k) => [`s${k}`, `Field splice FS${k + 1}`, Xg(gl[0], s)]), ...gl[0].bear.map((b, k) => [`b${k}`, k === 0 ? 'Abutment 1 bearing' : k === gl[0].bear.length - 1 ? 'Abutment 2 bearing' : `Pier ${k} bearing`, Xg(gl[0], b)])] : null;
    V.cam.near = Math.max(0.5, R / 500); V.cam.far = R * 40; V.cam.updateProjectionMatrix();
    V.info = single ? `Girder ${gl[0].label} close-up: plates as built, haunch, tributary deck strip, connection plates, bearing and intermediate stiffeners, ${nSplP ? 'splice plates with every bolt' : 'field splice markers (splice plates after Calculate results)'}, shear studs.` : `${nb} girders, ${FR.frames.length} ${G.cf.dia ? 'diaphragms' : `cross-frames (type ${G.cf.type})`}, deck ${window.SharedDxf.frac(dk.ts)} in on a ${window.SharedDxf.frac(dk.haunch)} in haunch${nApp ? ', barriers, curbs, railings, sidewalks and median of the Cross-section & loads tab (barrier and railing heights schematic)' : ''}; skews ${G.skews.map(v => (+v).toFixed(1)).join(' / ')}°.`;
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
    const st = ui.v3d, nbx = Math.max(0, Math.round((ctx.P.xs || {}).nb || 0)); if (!/^(bridge|g\d+)$/.test(st.mode || '') || (st.mode !== 'bridge' && +String(st.mode).slice(1) > nbx)) st.mode = 'bridge';
    if (!DG.some(d => d[0] === st.dg)) st.dg = 'mStr';
    const RS = window.SBDDrawingsUI && window.SBDDrawingsUI.results ? window.SBDDrawingsUI.results(ctx.P) : null, opt = (v, t, cur) => `<option value="${v}"${String(cur) === String(v) ? ' selected' : ''}>${esc(t)}</option>`;
    const bar = `<div class="v3d-bar"><label for="v3d_mode">View</label><select id="v3d_mode">${opt('bridge', 'Whole bridge', st.mode)}${[...Array(nbx)].map((_, i) => opt(`g${i + 1}`, `Girder G${i + 1} close-up`, st.mode)).join('')}</select>
      <select id="v3d_focus" hidden aria-label="Zoom to"></select>
      <label for="v3d_dg">Diagram</label><select id="v3d_dg">${DG.map(([k, l]) => opt(k, l, st.dg)).join('')}</select>
      <label>Scale <input type="range" id="v3d_dsc" min="0.25" max="4" step="0.25" value="${+st.dsc || 1}" style="width:90px"></label><label><input type="checkbox" id="v3d_eng"${st.eng !== false ? ' checked' : ''}> + moment down</label>
      ${RS ? '' : `<button type="button" id="v3d_calc">Calculate results</button>`}</div>
      <div class="v3d-bar">${LAY.map(([k, l]) => `<label><input type="checkbox" data-v3d="${k}"${ui.v3d.lay[k] ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      <span style="flex:1"></span><button type="button" id="v3d_reset">Reset view</button><button type="button" id="v3d_png">Save PNG</button></div>`;
    if (typeof THREE === 'undefined' && document.readyState === 'loading') {   // three.js is loaded with defer: it runs after the page's own script
      host.innerHTML = '<p class="note">Loading the 3D library…</p>'; document.addEventListener('DOMContentLoaded', () => { if (host.isConnected && ctx.ui.otab === '3d') render(host, ctx); }, { once: true }); return; }
    if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) { host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody"><div class="alert err">The 3D library (three.js r128 from cdnjs) could not be loaded: this view needs an internet connection the first time.</div></div></section>`; return; }
    let G = null; try { G = window.SBDDrawings.model(ctx.P); } catch (e) { G = { errors: [`The model could not be built: ${e.message}`] }; }
    if (G.errors.length) { host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody"><div class="alert err">${G.errors.map(esc).join('<br>')}</div></div></section>`; return; }
    host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody">${bar}<div id="v3d-host" class="v3d-host"></div>
      <p class="note" id="v3d-note"></p><p class="note" id="v3d-dg"></p><p class="note">${RS ? 'Diagrams and splice plates: the results of the Drawings tab (each plate girder\'s analysis, Analysis tab; Strength I as the Flexure tab, AASHTO LRFD 10th Ed. Table 3.4.1-1; splice plates from the Field splices tab), at each girder\'s own stations. Point at a diagram to read its value.' : 'The diagrams and the splice plates need the results (Calculate results: one analysis per plate girder, about 15 s each; the same as the Drawings tab).'} Drag to rotate, right-drag (or two fingers) to pan, wheel (or pinch) to zoom. The view keeps its camera when the inputs change; Reset view frames the bridge. Geometry as on the Drawings tab (see the framing plan for the stations).</p>
      ${G.warnings.length ? `<div class="alert">${G.warnings.map(esc).join('<br>')}</div>` : ''}</div></section>`;
    const h = host.querySelector('#v3d-host');
    try {
      if (!V.r) init();
      h.appendChild(V.r.domElement); resize(h);
      const gs = st.mode === 'bridge' ? -1 : +st.mode.slice(1) - 1;
      const key = JSON.stringify([ctx.P.spans, ctx.P.xs, ctx.P.girders, ctx.P.deck, ctx.P.framing, ctx.P.crossframes, ctx.P.stiffeners, ctx.P.studs, ctx.P.materials, st.mode, st.dg, +st.dsc || 1, st.eng !== false, !!RS]);
      const first = !V.root, modeChg = V.mode !== st.mode;
      if (key !== V.key || first) { build(G, { gs, RS, dg: st.dg, dsc: st.dsc, eng: st.eng }); V.key = key; }
      LAY.forEach(([k]) => { V.groups[k].visible = !!ui.v3d.lay[k]; });
      if (first) { const cm = ui.v3d.cam; if (cm && cm.p && cm.t) { V.cam.position.fromArray(cm.p); if (V.ctl) { V.ctl.target.fromArray(cm.t); V.ctl.update(); } } else V.home(); }
      else if (modeChg) { V.home(); saveCam(); }
      V.mode = st.mode;
      host.querySelector('#v3d-note').textContent = V.info; host.querySelector('#v3d-dg').textContent = V.dgLbl ? `Diagram: ${V.dgLbl}.` : '';
      const fs = host.querySelector('#v3d_focus'); if (V.tg) { fs.innerHTML = V.tg.map(t => `<option value="${t[0]}">${esc(t[1])}</option>`).join(''); fs.hidden = false; }
      if (window.ResizeObserver) { if (V.ro) V.ro.disconnect(); V.ro = new ResizeObserver(() => resize(h)); V.ro.observe(h); }
      loop();
    } catch (e) { h.innerHTML = `<div class="alert err">The 3D view could not start (WebGL): ${esc(e.message)}</div>`; return; }
    host.querySelectorAll('[data-v3d]').forEach(el => el.addEventListener('change', () => { ui.v3d.lay[el.dataset.v3d] = el.checked; if (V.groups[el.dataset.v3d]) V.groups[el.dataset.v3d].visible = el.checked; ctx.saveUi && ctx.saveUi(); }));
    host.querySelector('#v3d_reset').addEventListener('click', () => { if (V.home) { V.home(); saveCam(); } });
    const re = () => { ctx.saveUi && ctx.saveUi(); render(host, ctx); };
    host.querySelector('#v3d_mode').addEventListener('change', e => { st.mode = e.target.value; ui.v3d.lay.stud = st.mode !== 'bridge'; re(); });
    host.querySelector('#v3d_dg').addEventListener('change', e => { st.dg = e.target.value; re(); });
    host.querySelector('#v3d_dsc').addEventListener('change', e => { st.dsc = +e.target.value; re(); });
    host.querySelector('#v3d_eng').addEventListener('change', e => { st.eng = e.target.checked; re(); });
    host.querySelector('#v3d_focus').addEventListener('change', e => { const t = (V.tg || []).find(q => q[0] === e.target.value); if (!t) return; if (t[2] == null) V.home(); else V.focus(t[2]); saveCam(); });
    const cb = host.querySelector('#v3d_calc'); if (cb) cb.addEventListener('click', () => { cb.disabled = true; cb.textContent = 'Calculating…'; setTimeout(() => { window.SBDDrawingsUI.calc(ctx.P); render(host, ctx); }, 30); });
    V.r.domElement.onpointermove = e => { if (!V.fences.length) return; const r = V.r.domElement.getBoundingClientRect(), rc = new THREE.Raycaster(), mv = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      rc.setFromCamera(mv, V.cam); const hit = rc.intersectObjects(V.fences)[0], nt = host.querySelector('#v3d-dg'); if (!hit || !nt) return; const { g, q, X } = hit.object.userData; let k = 0, best = Infinity; q.x.forEach((x, j) => { const d = Math.abs(X(x) - hit.point.x); if (d < best) { best = d; k = j; } });
      nt.textContent = `${g.label}, x = ${q.x[k].toFixed(2)} ft (centerline stations): max ${q.hi[k].toFixed(0)}${q.lo ? `, min ${q.lo[k].toFixed(0)}` : ''} ${q.u} (${V.dgLbl})`; };
    host.querySelector('#v3d_png').addEventListener('click', () => { V.r.render(V.scene, V.cam); const a = document.createElement('a'); a.href = V.r.domElement.toDataURL('image/png');
      a.download = ((ctx.P.project && ctx.P.project.name) || 'steel-bridge').replace(/[^\w.-]+/g, '_') + '_3d.png'; document.body.appendChild(a); a.click(); a.remove(); });
  }
  /* the camera (tests): { p, t } */
  const camera = () => (V.cam ? { p: V.cam.position.toArray(), t: V.ctl ? V.ctl.target.toArray() : null } : null);

  window.SBD3DUI = { render, camera, LAY, DG, series, state: () => ({ fences: V.fences.length, mode: V.mode, tg: V.tg, dg: V.dgLbl }) };
})();
