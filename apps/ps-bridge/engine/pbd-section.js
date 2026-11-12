/* apps/ps-bridge/engine/pbd-section.js — section geometry: gross and composite properties, overrides, outline, voids, Ec, creep and torsion helpers.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 2537-2773 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): withOverrides, girderGross, girderGrossBase, halfPolygon, sectionWidthAt, releaseTensionForce, sectionVoids, shapePayload, Ec, relCfacOf, ktdAASHTO, rectTorsionJ, weakAxisAndJ, compositeProps.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ================= GEOMETRY HELPERS ================= */
/* Optional per-property overrides of the gross section (a design aid): the selected shape
   sets A, I, y_b, S_b, S_t and self-weight, but the engineer can pin any of them to a
   measured or hand-computed value. A blank field keeps the shape value; S_b/S_t default to
   I/y unless entered directly; self-weight defaults to A·w_c unless entered. Everything
   downstream -- stresses, losses, camber, flexural and shear capacity -- then uses the
   overridden section, because every caller goes through girderGross. */
function withOverrides(g, inp){
  const o = inp && inp.ovr;
  if(!o || !o.on) return g;
  const num = v => (v!==''&&v!=null&&isFinite(+v)&&+v>0) ? +v : null;
  const A=num(o.A), I=num(o.I), yb=num(o.yb), Sb=num(o.Sb), St=num(o.St), wsw=num(o.wsw);
  const out={...g};
  if(A!=null) out.A=A;
  if(I!=null) out.I=I;
  if(yb!=null){ out.yb=yb; out.yt=out.h-yb; }
  out.Sb = (Sb!=null)? Sb : out.I/out.yb;
  out.St = (St!=null)? St : out.I/out.yt;
  out.wsw = (wsw!=null)? wsw : out.A/144*(+inp.mat.wcLoad||+inp.mat.wc);
  out.ovr = {A:A!=null,I:I!=null,yb:yb!=null,Sb:Sb!=null,St:St!=null,wsw:wsw!=null,
             any:[A,I,yb,Sb,St,wsw].some(v=>v!=null)};
  return out;
}
function girderGross(inp){ return withOverrides(girderGrossBase(inp), inp); }
function girderGrossBase(inp){
  const raw = inp.girder==='Custom'? inp.cust : GIRDERS[inp.girder];
  if(raw.next){
    // NEXT F double-tee: flange (deck) width = actual beam width, taken as girder spacing S×12,
    // clamped to the tabulated min/max. Properties interpolate linearly with width.
    const wAct=clamp(inp.S*12, raw.wMin, raw.wMax);
    const t=(wAct-raw.wMin)/Math.max(raw.wMax-raw.wMin,1e-6);
    const lerp=(a,b)=>a+(b-a)*t;
    const h=+raw.h, A=lerp(raw.pMin.A,raw.pMax.A), I=lerp(raw.pMin.I,raw.pMax.I),
          yb=lerp(raw.pMin.yb,raw.pMax.yb), yt=h-yb;
    const stemCC=60, B=+raw.B, ft=+raw.flangeT;
    // two stems; equivalent web width for shear = 2 stems (use B at base, taper ignored)
    const bwEff=2*B;
    return {h,A,I,yb,yt,Sb:I/yb,St:I/yt,
            bw:bwEff, btf:wAct, bbf:2*B, d:[ft,0,h-ft,0],
            wsw:A/144*(+inp.mat.wcLoad||+inp.mat.wc),
            next:{B,stemCC,ft,wAct,wMin:raw.wMin,wMax:raw.wMax,strandRow:+raw.strandRow,nStems:2},
            isNext:true};
  }
  const g=raw;
  if(g.box||g.deck){
    // Box / adjacent deck beam: rectangular outer profile w×h, published gross A and I.
    // Adjacent beams sit side-by-side; the "spacing" for a composite topping is the beam width w.
    const h=+g.h, A=+g.A, I=+g.I, yb=+g.yb, yt=h-yb, w=+g.w;
    return {h,A,I,yb,yt,Sb:I/yb,St:I/yt,
            bw:+g.bw, btf:w, bbf:w, w,
            d:[0,0,0,0], wsw:A/144*(+inp.mat.wcLoad||+inp.mat.wc),
            isNext:false, isBox:!!g.box, isDeck:!!g.deck,
            box:{w,wall:+g.wall||0,voidW:+g.voidW||0,voidH:+g.voidH||0,
                 solid:!!g.solid,voids:+g.voids||0,voidD:+g.voidD||0}};
  }
  const h=+g.h, A=+g.A, I=+g.I, yb=+g.yb, yt=h-yb;
  return {h,A,I,yb,yt,Sb:I/yb,St:I/yt,bw:+g.bw,btf:+g.btf,bbf:+g.bbf,
          d:g.d||[4,3,5,5], wsw:A/144*(+inp.mat.wcLoad||+inp.mat.wc), isNext:false};
}
function halfPolygon(g){ // half-outline for drawing (x from CL, y from bottom)
  if(g.isNext&&g.next){
    const {B,stemCC,ft}=g.next, h=g.h, wHalf=g.btf/2;
    // trace right half from CL: bottom of right stem -> up outer -> flange underside -> flange edge -> top -> back to CL top
    const sCL=stemCC/2;                 // right stem centerline from beam CL
    const sIn=sCL-B/2, sOut=sCL+B/2;    // stem inner / outer faces
    // polygon (x from CL, y from bottom), right half only; CL handled by mirror in callers
    return [
      [0,h-ft],                         // CL at flange underside
      [sIn,h-ft],                       // to inner stem face (underside flange)
      [sIn,0],                          // down inner stem face
      [sOut,0],                         // across stem bottom
      [sOut,h-ft],                      // up outer stem face
      [wHalf,h-ft],                     // out along flange underside to edge
      [wHalf,h],                        // up flange edge
      [0,h]                             // back across top to CL
    ];
  }
  if(g.isBox||g.isDeck){
    const wHalf=g.w/2, h=g.h;
    return [[0,0],[wHalf,0],[wHalf,h],[0,h]];
  }
  const [ttf,ttf2,tbf,tbf2]=g.d;
  return [[0,0],[g.bbf/2,0],[g.bbf/2,tbf],[g.bw/2,tbf+tbf2],[g.bw/2,g.h-ttf-ttf2],[g.btf/2,g.h-ttf],[g.btf/2,g.h],[0,g.h]];
}
// Gross width (in) at height y (from the bottom), read off the outline. Voids are ignored, which
// only OVER-states the tension area and so the required steel -- conservative for this check.
function sectionWidthAt(g,y){
  const poly=halfPolygon(g); let hw=0;
  for(let i=0;i<poly.length-1;i++){
    const a=poly[i], b=poly[i+1]; const lo=Math.min(a[1],b[1]), hi=Math.max(a[1],b[1]);
    if(y>=lo-1e-9 && y<=hi+1e-9){
      const t=Math.abs(b[1]-a[1])<1e-9? 1 : (y-a[1])/(b[1]-a[1]);
      const x=a[0]+(b[0]-a[0])*t; if(x>hw) hw=x;
    }
  }
  return 2*hw;
}
// Resultant tensile force (kip) of the linear release stress field over the gross section.
// f(y) = fBot + (fTop-fBot)·y/h with + = compression, so concrete tension is where f(y) < 0.
// This is the "tensile force in the concrete computed assuming an uncracked section" of 5.9.2.3.1b.
function releaseTensionForce(g,fTop,fBot){
  const h=g.h, n=240; let T=0;
  for(let i=0;i<n;i++){ const y=(i+0.5)*h/n; const f=fBot+(fTop-fBot)*(y/h);
    if(f<0) T += (-f)*sectionWidthAt(g,y)*(h/n); }
  return T;   // kip
}
// Interior voids of the hollow sections, as plain shapes the drawing side can subtract from the
// outline. Box beams have one rectangular cell sitting on the bottom wall; voided deck slabs have
// round voids on the mid-depth axis, evenly spaced across the width. Solid units return [].
function sectionVoids(g){
  const b=g.box; if(!b) return [];
  if(g.isBox&&b.voidW>0&&b.voidH>0)
    return [{type:'rect',x:0,y:b.wall+b.voidH/2,w:b.voidW,h:b.voidH}];
  if(g.isDeck&&b.voids>0&&b.voidD>0){
    const n=b.voids, out=[];
    for(let k=0;k<n;k++) out.push({type:'circle',x:-b.w/2+b.w*(k+0.5)/n,y:g.h/2,d:b.voidD});
    return out;
  }
  return [];
}
// The girder's true cross-section, in a form another app can draw without knowing anything about
// PS-Beam's girder library: a half-outline (x from the centreline, y up from the soffit, inches),
// its voids, and the composite deck that sits on top. Mirroring the half about x=0 closes it.
function shapePayload(inp,g,cp){
  return { name:inp.girder||'', kind:g.isNext?'next':g.isBox?'box':g.isDeck?'deck':'i',
    h:+g.h, btf:+g.btf, bbf:+g.bbf, bw:+g.bw,
    half:halfPolygon(g).map(p=>[+(+p[0]).toFixed(4),+(+p[1]).toFixed(4)]),
    voids:sectionVoids(g),
    deck:{ beff:+(cp&&cp.beff)||0, ts:+inp.ts||0,
           th:(g.isBox||g.isDeck)?0:(+inp.th||0) } };   // haunch: girder top → deck soffit
}
function Ec(fc,wc){ return 120000*wc*wc*Math.pow(fc,0.33); } // LRFD 5.4.2.4
// Release compression limit factor: opt.relCfac × f'ci (Art. 5.9.2.3.1a value 0.65; blank → 0.65).
function relCfacOf(inp){ const v=inp&&inp.opt&&inp.opt.relCfac; if(v===''||v==null) return 0.65; const n=+v; return (isFinite(n)&&n>0)? n : 0.65; }
// Time-development factor, LRFD Eq. 5.4.2.3.2-5 (2015 Interim onward; 10th Ed.):
//   ktd = t / [12(100 − 4f'ci)/(f'ci + 20) + t]   (t in days, f'ci in ksi)
// (replaces the pre-2015 form t/(61 − 4f'ci + t)).
function ktdAASHTO(t,fci){ return t/(12*(100-4*fci)/(fci+20)+t); }
// Weak-axis (lateral) moment of inertia and St-Venant torsion J of the BARE GIRDER — for the MIDAS
// line-girder model. The deck is NOT a full-width composite flange for one girder's weak-axis bending
// (it spans transversely between girders), so weak-axis I is the girder alone → always < strong-axis
// composite Ic. Approximate; overridable in the MCT app.
function rectTorsionJ(a,b){ const A=Math.max(a,b),B=Math.min(a,b); if(A<=0||B<=0)return 0;
  return A*Math.pow(B,3)*(1/3-0.21*(B/A)*(1-Math.pow(B,4)/(12*Math.pow(A,4)))); }
function weakAxisAndJ(g){
  let Iy, J;
  if(g.isBox||g.isDeck){
    const w=+g.w||+g.btf||+g.bw, h=+g.h;
    const vw=+g.voidW||0, vh=+g.voidH||0, nv=+g.voids||(vw>0?1:0);
    Iy = h*Math.pow(w,3)/12 - (nv&&vw>0? nv*vh*Math.pow(vw,3)/12 : 0);     // outer minus voids, about vertical CL
    if(vw>0&&vh>0){ const t=+g.wall||5, we=w-t, he=h-t; J = 4*Math.pow(we*he,2)/((2*we+2*he)/t); } // closed single cell
    else J = rectTorsionJ(w,h);
  } else if(g.isNext){
    const B=(g.next&&+g.next.B)||10, cc=(g.next&&+g.next.stemCC)||60, w=+g.btf||+g.w, h=+g.h;
    const hs=Math.max(1,h-8), As=B*hs;                                     // stems (flange ~8"); parallel-axis dominates
    Iy = 2*(B*Math.pow(hs,3)/12 + As*Math.pow(cc/2,2)) + 8*Math.pow(w,3)/12;
    J  = 2*rectTorsionJ(B,hs) + rectTorsionJ(w,8);
  } else {                                                                 // I-shape (AASHTO / bulb-tee)
    Iy = approxIy(g);                                                      // existing bare-girder weak-axis inertia
    const d=g.d||[6,3,6,6], ttf=(+d[0]||0)+(+d[1]||0), tbf=(+d[2]||0)+(+d[3]||0), hw=Math.max(1,g.h-ttf-tbf);
    J  = rectTorsionJ(g.btf,ttf)+rectTorsionJ(g.bbf,tbf)+rectTorsionJ(hw,g.bw);
  }
  const bMax=Math.max(+g.btf||0,+g.bbf||0,+g.w||0);                        // widest fiber for Sy
  return { Iweak:Iy, J:J, Sy: bMax>0? Iy/(bMax/2):0, bMax };
}

function compositeProps(inp,g){
  const Ecg=Ec(inp.mat.fc,inp.mat.wc), Ecd=Ec(inp.mat.fcd,inp.mat.wcd);
  const n=Ecd/Ecg;
  const ts=+inp.ts, th=+inp.th;
  // Dead-load deck thickness may differ from the structural (capacity) thickness — e.g. a
  // sacrificial/integral wearing course or overpour that adds weight but isn't part of the
  // composite section. Section props/capacity use ts; the deck-weight term wdk uses tsLoad.
  const tsLoad = inp.tsSeparate ? (+inp.tsDL||ts) : ts;
  if(g.isNext){
    // NEXT F: composite topping over the full flange width. A haunch/build-up of th between the
    // flange top and the topping soffit takes up camber and holds deck grade. Its weight is always
    // carried; it is included in section stiffness only when haunchInProps is set (typical: excluded).
    const beff=g.btf;                          // full flange acts; topping matches flange width
    const incHaunch=!!inp.haunchInProps;
    const hcGap=incHaunch?th:0;                // structural gap flange-top -> topping soffit
    const Ad=ts>0? beff*n*ts:0, yd=g.h+hcGap+ts/2;
    const Ah=(incHaunch&&ts>0)? beff*n*th:0, yh=g.h+th/2;   // haunch full flange width
    const Ac=g.A+Ad+Ah;
    const ybc=(ts>0||Ah>0)? (g.A*g.yb+Ad*yd+Ah*yh)/Ac : g.yb;
    const Ic=g.I+g.A*(ybc-g.yb)**2 + (ts>0? beff*n*ts**3/12+Ad*(yd-ybc)**2:0) + (Ah>0? beff*n*th**3/12+Ah*(yh-ybc)**2:0);
    const hc=g.h+hcGap+ts;
    return {n,beff,Ecg,Ecd,Ac,Ic,ybc,ytc:g.h-ybc,hc,incHaunch,
            Sbc:Ic/ybc, Stg:Ic/(g.h-ybc), Std:ts>0? Ic/(hc-ybc)/n : Ic/(g.h-ybc),
            tsLoad, wdkW:beff, wdkHW:beff,
            wdkDeck:(beff*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), wdkHaunch:(beff*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd),
            wdk:(beff*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd) + (beff*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), isNext:true};
  }
  if(g.isBox||g.isDeck){
    // Adjacent box / deck beam: composite topping (if any) over the beam width.
    // AUTO uses the beam's own width (adjacent beams sit edge-to-edge, each carrying its own
    // strip of topping); MANUAL respects the entered effective width (e.g. partial topping or
    // a shear-lag reduction). With no topping (ts=0) the beam is non-composite.
    const beff=inp.beffAuto? g.w : (+inp.beff||g.w);
    const incHaunch=false;                     // adjacent beams: topping bears directly, no haunch
    const Ad=ts>0? beff*n*ts:0, yd=g.h+ts/2;
    const Ac=g.A+Ad;
    const ybc=ts>0? (g.A*g.yb+Ad*yd)/Ac : g.yb;
    const Ic=g.I+g.A*(ybc-g.yb)**2 + (ts>0? beff*n*ts**3/12+Ad*(yd-ybc)**2:0);
    const hc=g.h+ts;
    return {n,beff,Ecg,Ecd,Ac,Ic,ybc,ytc:g.h-ybc,hc,incHaunch,
            Sbc:Ic/ybc, Stg:Ic/(g.h-ybc), Std:ts>0? Ic/(hc-ybc)/n : Ic/(g.h-ybc),
            tsLoad, wdkW:beff, wdkHW:0,
            wdkDeck:ts>0? (beff*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd) : 0, wdkHaunch:0,
            wdk:ts>0? (beff*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd) : 0, isNext:false, isBox:!!g.isBox, isDeck:!!g.isDeck};
  }
  // Tributary deck width (LRFD 10th Ed. 4.6.2.6.1): interior girder = S; exterior girder = half the
  // adjacent spacing plus the full overhang, S/2 + oh (oh = deck overhang, girder CL to the deck edge,
  // the deck.oh box). Used for the AUTO effective width and for the deck dead-load width. (Was S for
  // both.) A MANUAL b_eff still overrides the effective width only.
  const extG=!!(inp.loads&&inp.loads.pos==='exterior');
  const ohT=extG? Math.max(+((inp.deck&&inp.deck.oh)||0)||0,0) : 0;
  const tribW=extG? (inp.S/2+ohT)*12 : inp.S*12;    // in
  const beff=inp.beffAuto? tribW : +inp.beff;
  // Haunch in composite SECTION PROPERTIES is optional (typical practice excludes it). When
  // excluded, the deck is modeled as bearing directly on the top flange (deck centroid drops by th)
  // and the haunch contributes no transformed area/inertia. Its WEIGHT is always carried (wdk).
  const incHaunch=!!inp.haunchInProps;
  const hcGap=incHaunch?th:0;                       // structural gap between flange top and deck soffit
  const Ad=beff*n*ts, yd=g.h+hcGap+ts/2;            // deck centroid
  const Ah=incHaunch? g.btf*n*th : 0, yh=g.h+th/2;
  const Ac=g.A+Ad+Ah;
  const ybc=(g.A*g.yb+Ad*yd+Ah*yh)/Ac;
  const Ic=g.I+g.A*(ybc-g.yb)**2 + beff*n*ts**3/12+Ad*(yd-ybc)**2 + (incHaunch? g.btf*n*th**3/12+Ah*(yh-ybc)**2 : 0);
  const hc=g.h+hcGap+ts;                            // composite depth used for section moduli
  return {n,beff,Ecg,Ecd,Ac,Ic,ybc,ytc:g.h-ybc,hc,incHaunch,
          Sbc:Ic/ybc, Stg:Ic/(g.h-ybc), Std:Ic/(hc-ybc)/n,
          tsLoad, wdkW:tribW, wdkHW:g.btf, extG, ohT,
          wdkDeck:(tribW*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), wdkHaunch:(g.btf*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd),
          wdk:(tribW*tsLoad/144)*(+inp.mat.wcdLoad||+inp.mat.wcd) + (g.btf*th/144)*(+inp.mat.wcdLoad||+inp.mat.wcd), isNext:false};
}

