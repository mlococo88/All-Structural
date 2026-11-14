/* apps/ps-bridge/ui/view3d.js — the "3D view" output tab (window.PSB3DUI). Classic script. Display only: nothing here feeds a result.
   Created 2026-11-13 (docs/ps-bridge-plan.md §5 row 3c, §2.3; PS-3 / PS-6: the Steel Bridge app's 3D view). The pattern (renderer, lights,
   OrbitControls with damping, sprite labels, layer toggles, the camera kept in the page's ui state, Reset view, Save PNG, the "Loading the 3D
   library" wait for the deferred three.js) is copied from apps/steel-bridge/ui/view3d.js (window.SBD3DUI: label, init, saveCam, loop, resize,
   the end of build, css, render), to move to shared/ later (CLAUDE.md §3); the geometry is this app's (geom below). Needs three.js r128 and
   its OrbitControls: the steel app's pinned CDN files (cdnjs three.js/r128, jsdelivr three@0.128.0 examples/js/controls/OrbitControls.js;
   CLAUDE.md §2, no new library, no version change).

   geom(P) (no DOM, no three.js; tests/engine/psbridge-view3d.test.mjs): every dimension read from the project and the moved engine's own
   pure geometry functions, no calculation result:
     girder lines: each girder type on each of its lines (PSBBridge.cells; lines with no type are not drawn), its engine inputs
       (PSBDesign.cellInputs) → the shape of the girder library (girderGross: NEXT flange width from that line's S, halfPolygon outline,
       sectionVoids) extruded between the bearings; line g at its offset from G1 (the bays, unequal allowed), the bearings on the skewed
       support lines (as the Steel Bridge app's framing: x = support station + (z − z_mid) tan θ), the girder length past ℄ bearing
       (opt.endOh) at the abutments;
     deck: t_s (the largest of the types; none when 0), its skewed plan outline from the left to the right deck edge (overhangs); haunch
       t_h over each girder's top width (not for box and deck beams, as the engine); barriers and sidewalks of the Cross-section tab
       (P.xs.dl widths; heights schematic: Decision PS3c-D2);
     diaphragms entered per type (loads.diaph: a from the left ℄ bearing), drawn across the bays next to each line that has one, parallel
       to the supports (schematic depth and thickness, PS3c-D3); spans made continuous (composite): a continuity diaphragm on each pier line
       (PS3c-D4); supports: bearing pads (opt.Lpad), seats and pier caps along the support lines (schematic);
     strands (layer, the girder type shown on the output tabs, on each of its lines): each strand at the position the strand-pattern
       graphic draws it (PSBStrandGfx.xy, the old app's strandXY; NEXT in the two stems, PS-27): straight strands end to end (the debonded
       length of a debonded strand in its own colour), draped strands from y_end at ℄ bearing to y_mid at the hold-down points frac × L from
       each ℄ bearing (PS-13), the rows at their engine y (strandSys).
   Units: inches; x along the bridge from Abut. 1 at the line midway between G1 and G<nb>, y up (0 = the soffit of the deepest girder), z
   across from G1 (the Steel Bridge app's axes).

   Camera: orbit (left drag / one finger), pan (right drag / two fingers), zoom (wheel / pinch); kept in psb2.ui (ui.v3d.cam) and restored on
   reload; layer toggles ui.v3d.lay (psb2.ui; no new storage key, CLAUDE.md §5). render(host, ctx), ctx = { P, ui, saveUi }. */
(function () {
  'use strict';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const LAY = [['girder', 'Girders', true], ['deck', 'Deck and haunch', true], ['app', 'Barriers and sidewalks', true], ['dia', 'Diaphragms', true],
    ['brg', 'Bearings and supports', true], ['str', 'Strands (type shown)', true], ['lbl', 'Labels', true]];
  /* the girder types' colours (concrete tints), in type order */
  const TCOL = ['#a9b4c2', '#c9a27e', '#9fb89a', '#c2a3c4', '#d1c38a', '#8fb3c9', '#c79494', '#a6a6a6'];
  const BAR_H = 32, SW_CURB = 0, DIA_T = 10, CONT_T = 24, PAD_T = 3, SEAT = 42;   // schematic sizes (in): PS3c-D2 … D5
  const isNum = v => typeof v === 'number' && isFinite(v);
  const tan = d => Math.tan((+d || 0) * Math.PI / 180);

  /* geom(P): the bridge in numbers (see the header). { errors, nb, ns, spans, sup, skews, ys, yc, girders, deck, haunch, app, dia, cont, pads,
     seats, strands, labels, types } */
  function geom(P) {
    const out = { errors: [], girders: [], dia: [], cont: [], pads: [], seats: [], strands: [], app: [], haunch: [], types: [] };
    const BR = window.PSBBridge, DS = window.PSBDesign, SG = window.PSBStrandGfx;
    if (!P || !P.xs || !P.spans || !BR || !DS) { out.errors.push('No project.'); return out; }
    const nb = P.xs.nb, spans = P.spans.lengths.map(Number), ns = spans.length, ys = [0];
    (P.xs.bays || []).forEach(b => ys.push(ys[ys.length - 1] + +b));
    const sup = [0]; spans.forEach(L => sup.push(sup[sup.length - 1] + L));
    const skews = sup.map((_, k) => +((P.xs.skews || [])[k]) || 0), yc = ys[ys.length - 1] / 2;
    const xb = (k, z) => (sup[k] + (z - yc) * tan(skews[k])) * 12;   // ℄ bearing of support k at the transverse position z (ft from G1), in
    Object.assign(out, { nb, ns, spans, sup, skews, ys, yc, ohL: +P.xs.ohL || 0, ohR: +P.xs.ohR || 0, cont: [], xb });
    const T = BR.types(P), cells = BR.cells(P), shown = BR.shown(P);
    out.types = T.map((t, k) => ({ k, label: t.label, span: t.span, lines: BR.typeLines(P, k), col: TCOL[k % TCOL.length] }));
    // each type × line: its inputs and section
    cells.forEach(c => {
      let inp, g; try { inp = DS.cellInputs(P, c.k, c.g); g = girderGross(inp); } catch (e) { out.errors.push(`${c.label} on G${c.g}: ${e.message}`); return; }
      const s = c.s, z = ys[c.g - 1] * 12, ka = s - 1, kb = s, oh = (+((inp.opt && inp.opt.endOh) || 0));
      const xa = xb(ka, ys[c.g - 1]), xe = xb(kb, ys[c.g - 1]);
      const th = (g.isBox || g.isDeck) ? 0 : (+inp.th || 0), ts = +inp.ts || 0;
      out.girders.push({ k: c.k, s, g: c.g, label: c.label, girder: inp.girder, z, xa, xb: xe, L: +inp.L, x0: xa - (ka === 0 ? oh : 0), x1: xe + (kb === ns ? oh : 0),
        h: +g.h, th, ts, top: g.isNext ? +g.btf : (g.isBox || g.isDeck) ? +g.w : +g.btf, bot: g.isNext ? +g.next.B : (g.isBox || g.isDeck) ? +g.w : +g.bbf,
        kind: g.isNext ? 'next' : g.isBox ? 'box' : g.isDeck ? 'deck' : 'i', half: halfPolygon(g), voids: sectionVoids(g), next: g.isNext ? { stemCC: g.next.stemCC, B: g.next.B } : null,
        diaph: (inp.loads.diaph || []).filter(d => +d.P > 0 && +d.a >= 0 && +d.a <= +inp.L).map(d => +d.a), Lpad: +((inp.opt && inp.opt.Lpad) || 12), inp, gg: g,
        shown: !!(shown && shown.k === c.k), col: TCOL[c.k % TCOL.length] });
    });
    if (!out.girders.length) { out.errors.push('No girder type on any girder line: assign the girder types (Girders & strands tab).'); return out; }
    // vertical datum: the deck soffit above the deepest girder + haunch
    const yD = Math.max(...out.girders.map(q => q.h + q.th)), ts = Math.max(...out.girders.map(q => q.ts)), yTop = yD + ts;
    out.girders.forEach(q => { q.yBot = yD - q.th - q.h; q.yTop = yD - q.th; if (q.th > 0) out.haunch.push({ s: q.s, g: q.g, x0: q.xa, x1: q.xb, y0: q.yTop, y1: yD, w: q.top, z: q.z }); });
    const zL = -out.ohL * 12, zR = (ys[nb - 1] + out.ohR) * 12;
    out.deck = { ts, yBot: yD, yTop, zL, zR, x: [xb(0, -out.ohL), xb(ns, -out.ohL), xb(ns, ys[nb - 1] + out.ohR), xb(0, ys[nb - 1] + out.ohR)] };
    // barriers and sidewalks (Cross-section tab, P.xs.dl; without it the base design's barrier base width)
    const dl = P.xs.dl, bw = s => dl ? (+((dl['bar' + s] || {}).bw) || 0) * 12 : (+((P.base && P.base.deck && P.base.deck.bBar) || 0)), sw = s => dl ? (dl['sw' + s] || {}) : {};
    [['L', zL, 1], ['R', zR, -1]].forEach(([s, ze, dir]) => { const b = bw(s), w = (+sw(s).w || 0) * 12, t = +sw(s).t || 0;
      if (b > 0) out.app.push({ kind: 'bar', side: s, z0: Math.min(ze, ze + dir * b), z1: Math.max(ze, ze + dir * b), y0: yTop, h: BAR_H });
      if (w > 0 && t > 0) { const a = ze + dir * b; out.app.push({ kind: 'sw', side: s, z0: Math.min(a, a + dir * w), z1: Math.max(a, a + dir * w), y0: yTop, h: t + SW_CURB }); } });
    // diaphragms: in each bay next to a line whose type has one at a (from the left ℄ bearing of each line, parallel to the supports)
    const at = (s, g) => out.girders.find(q => q.s === s && q.g === g);
    for (let s = 1; s <= ns; s++) for (let g = 1; g < nb; g++) { const A = at(s, g), B = at(s, g + 1); if (!A || !B) continue;
      const clear = (B.z - A.z) - (A.top + B.top) / 2; if (clear <= 1) continue;   // adjacent units (boxes, deck beams, NEXT side by side): none
      [...new Set([...A.diaph, ...B.diaph])].sort((p, q) => p - q).forEach(a => { const fa = a * 12, h = 0.75 * Math.min(A.h, B.h);
        out.dia.push({ s, bay: g, a, xa: A.xa + fa, xc: B.xa + fa, za: A.z, zc: B.z, y0: Math.max(A.yTop, B.yTop) - h, y1: Math.min(A.yTop, B.yTop), t: DIA_T }); }); }
    // spans made continuous for composite loads (5.12.3.3, PS-7): a continuity diaphragm on each pier line, between the exterior girders
    if (P.spans.continuity === 'composite' && ns >= 2) for (let k = 1; k < ns; k++) {
      const gs = out.girders.filter(q => q.s === k || q.s === k + 1), y0 = Math.min(...gs.map(q => q.yBot));
      out.cont.push({ k, za: ys[0] * 12, zc: ys[nb - 1] * 12, xa: xb(k, ys[0]), xc: xb(k, ys[nb - 1]), y0, y1: yD, t: CONT_T }); }
    // bearings (pads under each girder end; NEXT: one under each stem) and the seats / pier caps along the support lines
    out.girders.forEach(q => [q.xa, q.xb].forEach(x => { const zs = q.kind === 'next' ? [q.z - q.next.stemCC / 2, q.z + q.next.stemCC / 2] : [q.z], w = q.kind === 'next' ? q.next.B : q.bot;
      zs.forEach(z => out.pads.push({ x, z, l: q.Lpad || 12, w, y0: q.yBot - PAD_T, y1: q.yBot })); }));
    sup.forEach((_, k) => { const gs = out.girders.filter(q => q.s === k || q.s === k + 1), yb = Math.min(...gs.map(q => q.yBot)) - PAD_T;
      out.seats.push({ k, xa: xb(k, -out.ohL - 1), xc: xb(k, ys[nb - 1] + out.ohR + 1), za: zL - 12, zc: zR + 12, y1: yb, y0: yb - SEAT, w: SEAT }); });
    // strands of the girder type shown, on each of its lines (positions: PSBStrandGfx.xy, the strand-pattern graphic's); that type's girders are drawn see-through
    if (SG && SG.xy) out.girders.filter(q => q.shown).forEach(q => {
      const R = { g: q.gg, ss: strandSys(q.inp, q.gg) }, ss = R.ss, Lb = q.xb - q.xa, a = (+ss.hp.frac || 0) * (+q.inp.L) * 12;
      const yE = +ss.hp.yEnd, yM = +ss.hp.yMid, dir = Lb / Math.max(Math.abs(Lb), 1e-9);
      SG.xy(R, yM).forEach(p => { const z = q.z - p.x;
        if (!p.h) { const r = ss.rows[p.ri], db = p.db && r.dbnd > 0 ? r.dbnd * 12 : 0;
          if (db > 0) { out.strands.push({ g: q.g, s: q.s, kind: 'db', pts: [[q.x0, q.yBot + p.y, z], [q.xa + db, q.yBot + p.y, z]] }, { g: q.g, s: q.s, kind: 'db', pts: [[q.xb - db, q.yBot + p.y, z], [q.x1, q.yBot + p.y, z]] });
            out.strands.push({ g: q.g, s: q.s, kind: 's', pts: [[q.xa + db, q.yBot + p.y, z], [q.xb - db, q.yBot + p.y, z]] }); }
          else out.strands.push({ g: q.g, s: q.s, kind: 's', pts: [[q.x0, q.yBot + p.y, z], [q.x1, q.yBot + p.y, z]] });
          return; }
        const dy = p.y - yM, sl = a > 0 ? (yE - yM) / a : 0, Y = y => q.yBot + y + dy;
        out.strands.push({ g: q.g, s: q.s, kind: 'h', pts: [[q.x0, Y(yE + sl * (q.xa - q.x0))], [q.xa, Y(yE)], [q.xa + dir * a, Y(yM)], [q.xb - dir * a, Y(yM)], [q.xb, Y(yE)], [q.x1, Y(yE + sl * (q.x1 - q.xb))]].map(([x, y]) => [x, y, z]) });
      });
    });
    return out;
  }

  /* ---------- three.js (the steel app's view3d.js pattern) ---------- */
  const V = { r: null, scene: null, cam: null, ctl: null, root: null, groups: {}, key: '', raf: 0, home: null, ro: null, ctx: null, info: '', counts: null };
  function label(txt, size, color) {   // (steel view3d.js label)
    const c = document.createElement('canvas'), g = c.getContext('2d'); g.font = 'bold 40px system-ui, sans-serif'; const w = Math.ceil(g.measureText(txt).width) + 16; c.width = w; c.height = 56;
    g.font = 'bold 40px system-ui, sans-serif'; g.fillStyle = 'rgba(255,255,255,0.85)'; g.fillRect(0, 0, w, 56); g.fillStyle = color || '#222'; g.fillText(txt, 8, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false })); sp.scale.set(size * w / 56, size, 1); sp.renderOrder = 10; return sp;
  }
  function init() {   // (steel view3d.js init)
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
  function resize(host) { const W = host.clientWidth || 900, H = host.clientHeight || 560; V.r.setSize(W, H); V.cam.aspect = W / H; V.cam.updateProjectionMatrix(); }

  /* build(G): the scene of geom(P) */
  function build(G) {
    const T = THREE;
    if (V.root) { V.scene.remove(V.root); V.root.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material && o.material.map) o.material.map.dispose(); }); }
    const root = new T.Group(); V.root = root; V.scene.add(root); V.groups = {};
    LAY.forEach(([k]) => { const g = new T.Group(); g.name = k; V.groups[k] = g; root.add(g); });
    const grp = k => V.groups[k], mat = (c, o) => new T.MeshStandardMaterial({ color: c, metalness: 0.05, roughness: 0.85, ...(o || {}) });
    const MT = { deck: mat(0xc8c3b6, { transparent: true, opacity: 0.4, depthWrite: false }), haunch: mat(0xb9b3a4), app: mat(0xb9b5ab), dia: mat(0x8c8676), cont: mat(0x7b7466, { transparent: true, opacity: 0.75 }), brg: mat(0x2f2f2f), sup: mat(0xb3ada0) };
    const TM = {}; const tmat = q => TM[q.k] || (TM[q.k] = mat(new T.Color(q.col), q.shown ? { transparent: true, opacity: 0.5, depthWrite: false } : {}));   // the type shown: see-through, its strands visible
    const add = (g, m) => { grp(g).add(m); return m; };
    const box = (g, x, y, z, dx, dy, dz, mt) => (dx > 0 && dy > 0 && dz > 0) ? add(g, Object.assign(new T.Mesh(new T.BoxGeometry(dx, dy, dz), mt), {})).position.set(x, y, z) : null;
    /* a straight piece from (xa, za) to (xc, zc) in plan, thickness t, from y0 to y1 */
    const wall = (g, xa, za, xc, zc, t, y0, y1, mt) => { const dx = xc - xa, dz = zc - za, L = Math.hypot(dx, dz); if (!(L > 1e-6 && y1 > y0)) return;
      const m = add(g, new T.Mesh(new T.BoxGeometry(L, y1 - y0, t), mt)); m.position.set((xa + xc) / 2, (y0 + y1) / 2, (za + zc) / 2); m.rotation.y = Math.atan2(-dz, dx); };
    // girders: the section outline (voids as holes) extruded between the girder ends
    G.girders.forEach(q => { const sh = new T.Shape(), full = q.half.concat(q.half.slice().reverse().map(p => [-p[0], p[1]]));
      full.forEach((p, i) => (i ? sh.lineTo(p[0], p[1]) : sh.moveTo(p[0], p[1])));
      q.voids.forEach(v => { const hp = new T.Path(); if (v.type === 'rect') { hp.moveTo(v.x - v.w / 2, v.y - v.h / 2); hp.lineTo(v.x + v.w / 2, v.y - v.h / 2); hp.lineTo(v.x + v.w / 2, v.y + v.h / 2); hp.lineTo(v.x - v.w / 2, v.y + v.h / 2); hp.lineTo(v.x - v.w / 2, v.y - v.h / 2); } else hp.absarc(v.x, v.y, v.d / 2, 0, 2 * Math.PI, true); sh.holes.push(hp); });
      const L = q.x1 - q.x0, geo = new T.ExtrudeGeometry(sh, { depth: L, bevelEnabled: false, curveSegments: 16 });
      geo.rotateY(Math.PI / 2);   // shape (u, v), extruded along w → world (x = w, y = v, z = −u)
      const m = add('girder', new T.Mesh(geo, tmat(q))); m.position.set(q.x0, q.yBot, q.z); m.userData = { g: q.g, s: q.s, k: q.k }; });
    // deck (the skewed plan outline), haunch, barriers and sidewalks
    const d = G.deck, prism = (g, za, zb, yb, hgt, mt) => { if (!(zb - za > 1e-6) || !(hgt > 1e-6)) return; const ex = (k, z) => G.xb(k, z / 12), sh = new T.Shape();
      sh.moveTo(ex(0, za), za); sh.lineTo(ex(G.ns, za), za); sh.lineTo(ex(G.ns, zb), zb); sh.lineTo(ex(0, zb), zb); sh.lineTo(ex(0, za), za);
      const geo = new T.ExtrudeGeometry(sh, { depth: hgt, bevelEnabled: false }); geo.rotateX(Math.PI / 2); const ms = new T.Mesh(geo, mt); ms.position.y = yb + hgt; grp(g).add(ms); };
    if (d.ts > 0) prism('deck', d.zL, d.zR, d.yBot, d.ts, MT.deck);
    G.haunch.forEach(h => box('deck', (h.x0 + h.x1) / 2, (h.y0 + h.y1) / 2, h.z, h.x1 - h.x0, h.y1 - h.y0, h.w, MT.haunch));
    G.app.forEach(a => prism('app', a.z0, a.z1, a.y0, a.h, MT.app));
    // diaphragms, continuity diaphragms, bearings, seats and pier caps
    G.dia.forEach(q => wall('dia', q.xa, q.za, q.xc, q.zc, q.t, q.y0, q.y1, MT.dia));
    G.cont.forEach(q => wall('dia', q.xa, q.za, q.xc, q.zc, q.t, q.y0, q.y1, MT.cont));
    G.pads.forEach(p => box('brg', p.x, (p.y0 + p.y1) / 2, p.z, p.l, p.y1 - p.y0, p.w, MT.brg));
    G.seats.forEach(q => wall('brg', q.xa, q.za, q.xc, q.zc, q.w, q.y0, q.y1, MT.sup));
    // strands of the type shown: lines (straight, debonded length, draped)
    const SC = { s: 0x8a5a44, db: 0xdc6b2f, h: 0xb45309 };
    ['s', 'db', 'h'].forEach(kd => { const pos = []; G.strands.filter(q => q.kind === kd).forEach(q => { for (let i = 0; i + 1 < q.pts.length; i++) pos.push(...q.pts[i], ...q.pts[i + 1]); });
      if (!pos.length) return; const geo = new T.BufferGeometry(); geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); add('str', new T.LineSegments(geo, new T.LineBasicMaterial({ color: SC[kd], depthTest: kd !== 'x' }))); });
    // labels: the girder lines at the Abut. 1 end, the supports, the spans
    const Hm = Math.max(...G.girders.map(q => q.h)), Ltot = G.sup[G.sup.length - 1] * 12, lsz = Math.max(16, Hm * 0.35, 0.012 * Ltot);
    for (let g = 1; g <= G.nb; g++) { const q = G.girders.filter(r => r.g === g).sort((a, b) => a.s - b.s)[0]; if (!q) continue; const sp = label(`G${g}`, lsz, '#1f4e8c'); sp.position.set(q.x0 - 4 * lsz, q.yBot + q.h / 2, q.z); grp('lbl').add(sp); }
    G.sup.forEach((_, k) => { const sp = label(k === 0 ? 'Abut. 1' : k === G.ns ? 'Abut. 2' : `Pier ${k}`, lsz, '#333'); sp.position.set(G.xb(k, G.ys[G.nb - 1] + G.ohR), d.yTop + 3 * lsz, d.zR + 2 * lsz); grp('lbl').add(sp); });
    G.spans.forEach((L, i) => { const sp = label(`Span ${i + 1}: L = ${(+L).toFixed(2)} ft${G.ns > 1 ? (G.cont.length ? ' (continuous)' : ' (simple)') : ''}`, lsz, '#333'); sp.position.set((G.xb(i, G.yc) + G.xb(i + 1, G.yc)) / 2, d.yTop + 5 * lsz, G.yc * 12); grp('lbl').add(sp); });
    // camera home (steel build's end)
    const bb = new T.Box3().setFromObject(root), c = bb.getCenter(new T.Vector3()), sz = bb.getSize(new T.Vector3()), R = Math.max(sz.x, sz.y * 4, sz.z) * 0.62, Dh = () => R * 2.1 / Math.min(1, Math.max(0.35, V.cam.aspect || 1));   // farther on a narrow (phone) canvas
    V.home = () => { V.cam.position.copy(c.clone().add(new T.Vector3(-0.55, 0.55, 1).normalize().multiplyScalar(Dh()))); V.cam.near = Math.max(0.5, R / 500); V.cam.far = R * 40; V.cam.updateProjectionMatrix(); if (V.ctl) { V.ctl.target.copy(c); V.ctl.update(); } else V.cam.lookAt(c); };
    V.cam.near = Math.max(0.5, R / 500); V.cam.far = R * 40; V.cam.updateProjectionMatrix();
    V.counts = { girders: G.girders.length, dia: G.dia.length, cont: G.cont.length, pads: G.pads.length, strands: G.strands.length, app: G.app.length };
  }

  function css() {
    if (document.getElementById('psb3d-css')) return;
    const st = document.createElement('style'); st.id = 'psb3d-css';
    st.textContent = `.v3d-bar{display:flex;flex-wrap:wrap;gap:6px 12px;align-items:center;margin:4px 0 8px;font-family:var(--font-ui);font-size:9pt;}
      .v3d-host{width:100%;height:min(68vh,680px);min-height:320px;border:1px solid var(--line);background:#f4f5f7;touch-action:none;overflow:hidden;}
      .v3d-key{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:9pt;margin:6px 0;} .v3d-key i{display:inline-block;width:14px;height:10px;border:1px solid #888;margin-right:5px;vertical-align:-1px;}`;
    document.head.appendChild(st);
  }
  const lines = L => { const r = []; L.forEach(g => { const q = r[r.length - 1]; if (q && q[1] === g - 1) q[1] = g; else r.push([g, g]); }); return r.map(([a, b]) => a === b ? `G${a}` : `G${a}–G${b}`).join(', '); };
  function render(host, ctx) {
    css(); V.ctx = ctx; const ui = ctx.ui; ui.v3d = ui.v3d || {}; ui.v3d.lay = Object.assign(Object.fromEntries(LAY.map(([k, , on]) => [k, on])), ui.v3d.lay || {});
    if (typeof THREE === 'undefined' && document.readyState === 'loading') {   // three.js is loaded with defer: it runs after the page's own script
      host.innerHTML = '<p class="note">Loading the 3D library…</p>'; document.addEventListener('DOMContentLoaded', () => { if (host.isConnected && ctx.ui.otab === '3d') render(host, ctx); }, { once: true }); return; }
    if (typeof THREE === 'undefined' || !THREE.WebGLRenderer) { host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody"><div class="alert err">The 3D library (three.js r128 from cdnjs) could not be loaded: this view needs an internet connection the first time.</div></div></section>`; return; }
    let G; try { G = geom(ctx.P); } catch (e) { G = { errors: [`The model could not be built: ${e.message}`] }; }
    if (G.errors.length) { host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody"><div class="alert err">${G.errors.map(esc).join('<br>')}</div></div></section>`; return; }
    const sh = G.girders.find(q => q.shown), tp = G.types.filter(t => t.lines.length && t.span <= G.ns);
    const key3 = `<div class="v3d-key">${tp.map(t => { const q = G.girders.find(r => r.k === t.k); return `<span><i style="background:${t.col}"></i>${esc(t.label)}: ${esc(q ? q.girder : '')}, span ${t.span}, ${lines(t.lines)}</span>`; }).join('')}</div>`;
    const bar = `<div class="v3d-bar">${LAY.map(([k, l]) => `<label><input type="checkbox" data-v3d="${k}"${ui.v3d.lay[k] ? ' checked' : ''}> ${esc(l)}</label>`).join('')}
      <span style="flex:1"></span><button type="button" id="v3d_reset">Reset view</button><button type="button" id="v3d_png">Save PNG</button></div>`;
    host.innerHTML = `<section class="sec"><div class="secHead">3D view</div><div class="secBody">${bar}<div id="v3d-host" class="v3d-host"></div>${key3}
      <p class="note" id="v3d-note"></p>
      <p class="note">Drag to rotate, right-drag (or two fingers) to pan, wheel (or pinch) to zoom. The view keeps its camera when the inputs change; Reset view frames the bridge. Display only: the girder lines (Cross-section tab), spans, skews and continuity (Bridge layout tab), each girder type's shape (shape library) on its lines (Girders &amp; strands tab); strands of the girder type shown above the output tabs${sh ? ` (${esc(sh.label)}, its girders see-through)` : ''}, at the positions of its <a href="#" data-gotab="loss">strand-pattern graphic</a>. Barrier and sidewalk heights, diaphragm and continuity diaphragm depths, bearing pads and supports are schematic.</p></div></section>`;
    const h = host.querySelector('#v3d-host');
    try {
      if (!V.r) init();
      h.appendChild(V.r.domElement); resize(h);
      const key = JSON.stringify(ctx.P), first = !V.root;
      if (key !== V.key || first) { build(G); V.key = key; }
      LAY.forEach(([k]) => { V.groups[k].visible = !!ui.v3d.lay[k]; });
      if (first) { const cm = ui.v3d.cam; if (cm && cm.p && cm.t) { V.cam.position.fromArray(cm.p); if (V.ctl) { V.ctl.target.fromArray(cm.t); V.ctl.update(); } } else V.home(); }
      const sk = [...new Set(G.skews.map(v => (+v).toFixed(1)))];
      V.info = `${G.nb} girder lines (bays ${G.ys.slice(1).map((y, i) => (y - G.ys[i]).toFixed(2)).join(' / ')} ft), ${G.ns} span${G.ns > 1 ? `s ${G.spans.map(v => (+v).toFixed(2)).join(' + ')} ft, ${G.cont.length ? 'made continuous for composite loads (continuity diaphragms at the piers)' : 'simple'}` : ` of ${(+G.spans[0]).toFixed(2)} ft`}; skew${sk.length > 1 ? 's' : ''} ${G.skews.map(v => (+v).toFixed(1)).join(' / ')}°; deck ${G.deck.ts > 0 ? `${(+G.deck.ts).toFixed(2)} in` : 'none'}; ${G.dia.length} diaphragm${G.dia.length === 1 ? '' : 's'} between girders${sh ? `; ${G.strands.length} strand lines of ${sh.label}` : ''}.`;
      host.querySelector('#v3d-note').textContent = V.info;
      if (window.ResizeObserver) { if (V.ro) V.ro.disconnect(); V.ro = new ResizeObserver(() => resize(h)); V.ro.observe(h); }
      loop();
    } catch (e) { h.innerHTML = `<div class="alert err">The 3D view could not start (WebGL): ${esc(e.message)}</div>`; return; }
    host.querySelectorAll('[data-v3d]').forEach(el => el.addEventListener('change', () => { ui.v3d.lay[el.dataset.v3d] = el.checked; if (V.groups[el.dataset.v3d]) V.groups[el.dataset.v3d].visible = el.checked; ctx.saveUi && ctx.saveUi(); }));
    host.querySelector('#v3d_reset').addEventListener('click', () => { if (V.home) { V.home(); saveCam(); } });
    host.querySelector('#v3d_png').addEventListener('click', () => { V.r.render(V.scene, V.cam); const a = document.createElement('a'); a.href = V.r.domElement.toDataURL('image/png');
      a.download = ((ctx.P.project && ctx.P.project.name) || 'ps-bridge').replace(/[^\w.-]+/g, '_') + '_3d.png'; document.body.appendChild(a); a.click(); a.remove(); });
  }
  /* for tests: the camera, the counts of the last build */
  const camera = () => (V.cam ? { p: V.cam.position.toArray(), t: V.ctl ? V.ctl.target.toArray() : null } : null);
  window.PSB3DUI = { render, geom, camera, LAY, state: () => ({ counts: V.counts, info: V.info }) };
})();
