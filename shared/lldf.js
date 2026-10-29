/* shared/lldf.js — AASHTO LRFD live-load distribution factors, Art. 4.6.2.2 (window.SharedLLDF).
   Classic script, no DOM. Moved from lldf.html (the suite's verified LLDF tool) on 2026-10-29; the functions are the page's
   own, line for line. The only edits (fixlog/shared-lldf.md):
     - truckGap(p,t) reads the gaps between adjacent trucks from p.truckGaps (the page passed its state.truckGaps);
     - computeBridge(p) returns { geo, Kg, skew, members }; lldf.html adds its warnings (bridgeWarnings stays in the page:
       it is page text and reads the page's lock state);
     - one read-only output added: rigidMethod returns ecc (the lane eccentricities it already computed);
     - an option p.kgSimple (true = the simplified K_g terms of Table 4.6.2.2.1-3, type (a)), used by apps/steel-bridge;
       lldf.html never sets it, so its results are unchanged.
   Results are bit-identical to the page's before the move (hash harness, fixlog/shared-lldf.md).

   Units: spans, spacings, overhangs, traffic-face offsets, d_e ft; t_s, depth, e_g, b in; I, J, K_g in^4; A in^2; skew degrees.
   Code: AASHTO LRFD Bridge Design Specifications, 10th Ed. (2024): Art. 3.6.1.1.1 (N_L), Table 3.6.1.1.2-1 (m), Art. 4.6.2.2
   (Tables 4.6.2.2.1-1 … 4.6.2.2.3c-1, Eq. 4.6.2.2.1-1, Eq. C4.6.2.2.2d-1), Art. 4.6.2.3 (slab strips), C3.6.1.1.2 (fatigue).

   p (the page's readInputs()): { type: 'a'|'e'|'k'|'f'|'g'|'bc'|'d'|'slab', L, spans, ts, depth, skew (moment θ), skewV (shear θ,
     null = θ), OL, OR (overhangs), rL, rR (deck edge to the interior railing face), Nb, spacings [Nb − 1], I, A, eg, n, boxB, boxI,
     boxJ, truckGaps [ft, ≥ 4], kgSimple (optional) }.
   computeBridge(p) → { geo, Kg, skew, members: [memberDF(...) per girder] }; throws on inputErrors(p).
   Building blocks: geometry(p), skewFactors(p,geo,Kg), memberDF(p,geo,Kg,skew,j), leverConfig(p,geo,j,N), leverAll(p,geo,j),
   leverMulti(p,geo,j), rigidMethod(p,geo,side), empiricalInterior(Kg,L,ts,S,simple), leverContribution(pos,Nb,j,u), designL(spans,region),
   momentSkewNoReduction(thA,thB), momentSkewNoReductionPier(thPrev,thPier,thNext) (4.6.2.2.2e per span and per pier region;
   added for apps/steel-bridge, not used by lldf.html).
   Loaded by: lldf.html, apps/steel-bridge/index.html (adapter apps/steel-bridge/engine/lldf.js). */
(function(){
"use strict";
const f1=x=>(+x).toFixed(1), f3=x=>(+x).toFixed(3);   // lldf.html's formatting helpers (designL's TeX, memberDF's fatNote)

function multiplePresence(nLanes){return nLanes<=1?1.20:nLanes===2?1.00:nLanes===3?0.85:0.65;}

const RANGES={
  S:{min:3.5,max:16.0,label:"S",unit:"ft",name:"Average beam spacing"},
  L:{min:20,max:240,label:"L",unit:"ft",name:"Span length"},
  ts:{min:4.5,max:12.0,label:"t_s",unit:"in",name:"Slab thickness"},
  Nb:{min:4,max:Infinity,label:"N_b",unit:"",name:"Number of beams"},
  Kg:{min:10000,max:7000000,label:"K_g",unit:"in^4",name:"Stiffness parameter"},
};
const BEAM_SLAB=new Set(["a","e","k"]);
const BOX=new Set(["f","g"]);   // adjacent precast box beams in multibeam decks
const BOXR={b:{min:35,max:60,label:"b",unit:"in",name:"Beam width"},
  L:{min:20,max:120,label:"L",unit:"ft",name:"Span length"},
  Nb:{min:5,max:20,label:"N_b",unit:"",name:"Number of beams"},
  J:{min:25000,max:610000,label:"J",unit:"in⁴",name:"Torsional constant"},
  I:{min:40000,max:610000,label:"I",unit:"in⁴",name:"Moment of inertia"}};
const SPREADR={S:{min:6.0,max:18.0,label:"S",unit:"ft",name:"Beam spacing"},
  L:{min:20,max:140,label:"L",unit:"ft",name:"Span length"},
  d:{min:18,max:65,label:"d",unit:"in",name:"Beam depth"},
  Nb:{min:3,max:Infinity,label:"N_b",unit:"",name:"Number of beams"}};
const CELLR={S:{min:7.0,max:13.0,label:"S",unit:"ft",name:"Web spacing"},
  L:{min:60,max:240,label:"L",unit:"ft",name:"Span length"},
  d:{min:35,max:110,label:"d",unit:"in",name:"Box depth"},
  Nc:{min:3,max:Infinity,label:"N_c",unit:"",name:"Number of cells"}};
const FAMILY={a:"Steel I-girder",k:"Precast I / bulb-tee",e:"Concrete T-beam",bc:"Spread box beam",d:"CIP multicell box",
  f:"Precast box beam + deck",g:"Precast box beam (integral)",slab:"Cast-in-place slab"};

/* ---------- design span length per Table C4.6.2.2.1-2 ---------- */
function designL(spans,region){
  if(!spans||!spans.length) return {L:120,tex:"",desc:""};
  if(spans.length===1||!region||region==="s0"&&spans.length===1)
    return {L:spans[0],tex:"",desc:spans.length===1?"":"Span 1"};
  const m=/^([sp])(\d+)$/.exec(region||"s0")||["","s","0"];
  const kind=m[1],i=+m[2];
  if(kind==="p"&&i<spans.length-1){
    const L=(spans[i]+spans[i+1])/2;
    return {L,kind,i,desc:`Support ${i+1}–${i+2} — negative moment / interior reaction`,
      tex:`L=\\tfrac12(L_{${i+1}}+L_{${i+2}})=\\tfrac12(${f1(spans[i])}+${f1(spans[i+1])})=\\boxed{${f1(L)}\\ \\text{ft}}`};
  }
  const k=Math.min(Math.max(i,0),spans.length-1);
  return {L:spans[k],kind:"s",i:k,desc:`Span ${k+1} — positive moment / shear`,
    tex:`L=L_{${k+1}}=\\boxed{${f1(spans[k])}\\ \\text{ft}}`};
}

/* ---------- spread box beams (b/c), Tables 4.6.2.2.2b/3a-1 ---------- */
function spreadDF(p,S){
  const d=p.depth,L=p.L;
  return {mom1:Math.pow(S/3.0,0.35)*Math.pow(S*d/(12.0*L*L),0.25),
    mom2:Math.pow(S/6.3,0.6)*Math.pow(S*d/(12.0*L*L),0.125),
    shr1:Math.pow(S/10.0,0.6)*Math.pow(d/(12.0*L),0.1),
    shr2:Math.pow(S/7.4,0.8)*Math.pow(d/(12.0*L),0.1)};
}
/* ---------- CIP multicell box (d), webs as members, Nc = Nb − 1 ---------- */
function multicellDF(p,S){
  const L=p.L,d=p.depth,NcAct=Math.max(1,p.Nb-1),Nc=Math.min(Math.max(NcAct,1),8);
  return {NcAct,NcEq:Nc,
    mom1:(1.75+S/3.6)*Math.pow(1/L,0.35)*Math.pow(1/Nc,0.45),
    mom2:Math.pow(13/Nc,0.3)*(S/5.8)*Math.pow(1/L,0.25),
    shr1:Math.pow(S/9.5,0.6)*Math.pow(d/(12.0*L),0.1),
    shr2:Math.pow(S/7.3,0.9)*Math.pow(d/(12.0*L),0.1)};
}

/* ---------- geometry from beam table + overhangs + railings ---------- */
function geometry(p){
  const S=p.spacings, Nb=p.Nb;
  const pos=[0]; for(let i=0;i<S.length;i++) pos.push(pos[i]+S[i]);
  const beamW=pos[pos.length-1];
  const Wdeck=p.OL+beamW+p.OR;
  const deL=p.OL-p.rL, deR=p.OR-p.rR;
  const govSide=deR>deL?"R":"L";
  const deGov=Math.max(deL,deR);
  const roadway=Wdeck-p.rL-p.rR;
  /* AASHTO 3.6.1.1.1: N_L = INT(w/12) with w the clear roadway width, EXCEPT that a
     roadway 20.0–24.0 ft wide shall be taken as TWO design lanes each equal to one-half
     the roadway width. INT(w/12) alone would call a 22-ft roadway one lane. The reduced
     lane width propagates to the lever rule (lane-fit gate) and to the rigid method
     (lane-to-lane eccentricity step). At w = 24.0 both rules agree (2 lanes @ 12 ft). */
  const twoHalf=(roadway>=20.0-1e-9 && roadway<=24.0+1e-9);
  const NL=twoHalf?2:Math.max(1,Math.floor(roadway/12));
  const laneW=twoHalf?roadway/2:12;
  const Savg=Nb>1?beamW/(Nb-1):beamW;
  const xc=pos.reduce((a,b)=>a+b,0)/Nb;
  const xrel=pos.map(x=>x-xc);
  const sumX2=xrel.reduce((a,x)=>a+x*x,0);
  const Xext=govSide==="L"?(xc-pos[0]):(pos[Nb-1]-xc);
  const bayGov=govSide==="L"?S[0]:S[S.length-1];
  return {pos,beamW,Wdeck,deL,deR,deGov,govSide,roadway,NL,laneW,twoHalf,Savg,xc,xrel,sumX2,Xext,bayGov};
}

/* ---------- per-member engine ---------- */
function memberType(p,j){ return (j===0||j===p.Nb-1)?"ext":"int"; }
function memberSpacing(p,j){
  if(j===0) return p.spacings[0];
  if(j===p.Nb-1) return p.spacings[p.spacings.length-1];
  return (p.spacings[j-1]+p.spacings[j])/2;
}
function girderU(p,geo){ return geo.pos.map(x=>p.OL+x); }  // girder CL positions from left deck edge

/* Art. 4.6.2.2.2e (AASHTO LRFD 10th Ed.): the moment reduction for skew is not applied where the skews of two adjacent lines of
   supports differ by more than 10°. Engineer's decision 2026-10-29: PER SPAN — a span compares only its own two support lines
   (thA, thB in degrees, signed as entered); true = that span gets no moment skew reduction (its moment θ is taken as 0).
   Added 2026-10-29 for apps/steel-bridge; lldf.html does not call it (it takes the moment θ as entered, or from Bridge
   Geometry's skewDetail.moment), so its results are unchanged. To switch the rule (e.g. to the whole bridge), change only this. */
function momentSkewNoReduction(thA,thB){ return Math.abs(thA-thB)>10+1e-9; }
/* The same rule for a pier (negative-moment) region at support line i (engineer's decision 2026-10-29): no moment skew reduction
   if EITHER adjacent span's two support lines differ by more than 10° (thPrev = support i − 1, thPier = support i, thNext = i + 1;
   a missing neighbour counts as no span on that side). */
function momentSkewNoReductionPier(thPrev,thPier,thNext){
  return (thPrev!=null&&momentSkewNoReduction(thPrev,thPier))||(thNext!=null&&momentSkewNoReduction(thPier,thNext)); }

function skewFactors(p,geo,Kg){
  /* th = skew for the moment reduction (Table 4.6.2.2.2e-1); thV = skew for the shear correction
     (Table 4.6.2.2.3c-1). thV = th unless a separate shear skew is entered (p.skewV): where the
     support skews differ, Art. 4.6.2.2.2e limits the moment reduction (smallest |θ|, none if adjacent
     supports differ by > 10°) while the obtuse-corner shear takes the largest |θ|. Signs are ignored. */
  const th=Math.abs(+p.skew||0), thV=(p.skewV!=null&&isFinite(p.skewV))?Math.abs(+p.skewV):th;
  if(th<=0&&thV<=0) return {active:false,scfM:1,scfV:1,c1:0,thU:0,th:0,thV:0,thVU:0,tanV:0,kind:"none"};
  const thU=Math.min(th,60), rad=thU*Math.PI/180, tan=Math.tan(rad);
  const thVU=Math.min(thV,60), tanV=Math.tan(thVU*Math.PI/180);
  if(BOX.has(p.type)){
    // Table 4.6.2.2.2e-1 (box): 1.05 − 0.25 tanθ ≤ 1.0 ; Table 4.6.2.2.3c-1 (box): 1 + (12L/90d)√tanθ
    const scfM=Math.min(1.0,1.05-0.25*tan);
    const scfV=1.0+(12.0*p.L/(90.0*p.depth))*Math.sqrt(Math.max(0,tanV));
    return {active:true,scfM,scfV,thU,th,tan,thV,thVU,tanV,kind:"box"};
  }
  if(BEAM_SLAB.has(p.type)&&Kg){
    let scfM=1,c1=0;
    if(thU>=30){ c1=0.25*(p.kgSimple?KG_SIMPLE.c1:Math.pow(Kg/(12*p.L*Math.pow(p.ts,3)),0.25))*Math.pow(geo.Savg/p.L,0.5); scfM=1-c1*Math.pow(tan,1.5); }
    const scfV=1+0.20*(p.kgSimple?KG_SIMPLE.v:Math.pow(12*p.L*Math.pow(p.ts,3)/Kg,0.3))*tanV;
    return {active:true,scfM,scfV,c1,thU,th,tan,thV,thVU,tanV,kind:"beamslab"};
  }
  if(p.type==="bc"||p.type==="d"){
    // moment reduction shared with box row of Table 4.6.2.2.2e-1; shear factors computed per member/type
    const scfM=Math.min(1.0,1.05-0.25*tan);
    return {active:true,scfM,scfV:1,thU,th,tan,thV,thVU,tanV,kind:p.type==="bc"?"spread":"multicell"};
  }
  return {active:false,scfM:1,scfV:1,c1:0,thU:0,th:0,tan:0,thV:0,thVU:0,tanV:0,kind:"none"};
}
function boxDF(p,geo){
  const b=p.boxB, I=p.boxI, J=p.boxJ, L=p.L, Nb=p.Nb;
  const k=Math.max(1.5,2.5*Math.pow(Nb,-0.2)), IJ=I/J;
  return {k,IJ,
    mom1:k*Math.pow(b/(33.3*L),0.5)*Math.pow(IJ,0.25),
    mom2:k*Math.pow(b/305,0.6)*Math.pow(b/(12.0*L),0.2)*Math.pow(IJ,0.06),
    shr1:Math.pow(b/(130.0*L),0.15)*Math.pow(IJ,0.05),
    shr2:Math.pow(b/156,0.4)*Math.pow(b/(12.0*L),0.1)*Math.pow(IJ,0.05)*Math.max(b/48,1.0)};
}
function empiricalInterior(Kg,L,ts,S,simple){
  const kterm=simple?KG_SIMPLE.m:Math.pow(Kg/(12*L*Math.pow(ts,3)),0.1);
  return {kterm,
    mom1:0.06+Math.pow(S/14,0.4)*Math.pow(S/L,0.3)*kterm,
    mom2:0.075+Math.pow(S/9.5,0.6)*Math.pow(S/L,0.2)*kterm,
    shr1:0.36+S/25,
    shr2:0.2+S/12-Math.pow(S/35,2)};
}

/* ---- general lever rule (deck hinged over girders), any member, N trucks ---- */
function leverContribution(pos,Nb,j,uw){
  const uj=pos[j];
  if(j<Nb-1 && uw>=uj-1e-9 && uw<=pos[j+1]+1e-9) return (pos[j+1]-uw)/(pos[j+1]-uj);   // right panel
  if(j>0 && uw<=uj+1e-9 && uw>=pos[j-1]-1e-9) return (uw-pos[j-1])/(uj-pos[j-1]);        // left panel
  if(j===0 && Nb>1 && uw<uj) return (pos[1]-uw)/(pos[1]-pos[0]);                          // left overhang
  if(j===Nb-1 && Nb>1 && uw>uj) return (uw-pos[Nb-2])/(pos[Nb-1]-pos[Nb-2]);             // right overhang
  return 0;
}
/* Truck train: N trucks (6-ft axles) with user-set wheel-line gaps between adjacent
   trucks (≥ 4 ft per AASHTO 3.6.1.3.1, default 4 ft). The whole train slides across
   the roadway (outer wheels ≥ 2 ft from each railing face) to maximize girder j's
   reaction. N design lanes must exist for the N-truck case (MPF by N). */
function truckGap(p,t){ return Math.max(4,(p.truckGaps&&+p.truckGaps[t])||4); }   // p.truckGaps: lldf.html state.truckGaps (was read from state)
function leverConfig(p,geo,j,N){
  const pos=girderU(p,geo), Nb=p.Nb;
  const rw0=p.rL, rw1=geo.Wdeck-p.rR;                 // roadway edges (from deck edge)
  const laneW=geo.laneW||12;                          // 10–12 ft on a 20–24 ft roadway (3.6.1.1.1)
  if(laneW*N>rw1-rw0+1e-9) return null;               // N design lanes don't physically fit
  const gaps=[]; for(let t=0;t<N-1;t++) gaps.push(truckGap(p,t));
  const off=[]; let cum=0;
  for(let t=0;t<N;t++){ off.push(cum,cum+6); cum+=6+(t<N-1?gaps[t]:0); }
  const trainLen=off[off.length-1];
  if(trainLen>rw1-rw0-4+1e-9) return null;            // train + 2-ft edge clearances must fit
  let best=null;
  for(let s=rw0+2; s<=rw1-2-trainLen+1e-9; s+=0.25){
    let R=0; for(const o of off) R+=0.5*leverContribution(pos,Nb,j,s+o);
    if(!best||R>best.R+1e-9) best={R,s};
  }
  /* R(s) is piecewise linear in s, with kinks only where a wheel crosses a girder line, so its
     maximum is at such a position or at an end of the travel range. Test those exactly too, so
     the 0.25-ft grid above cannot step over the peak. */
  { const sMin=rw0+2, sMax=rw1-2-trainLen, cand=[sMax];
    for(const u of pos) for(const o of off) cand.push(u-o);
    for(const s of cand){
      if(s<sMin-1e-9||s>sMax+1e-9) continue;
      let R=0; for(const o of off) R+=0.5*leverContribution(pos,Nb,j,s+o);
      if(!best||R>best.R+1e-9) best={R,s};
    } }
  if(!best) return null;
  const m=multiplePresence(N);
  return {N,R:best.R,m,df:best.R*m,wheels:off.map(o=>best.s+o),gaps};
}
function leverAll(p,geo,j){
  const cfgs=[];
  for(let N=1;N<=geo.NL;N++){ const c=leverConfig(p,geo,j,N); if(c) cfgs.push(c); }
  const gov=cfgs.reduce((a,b)=>(!a||b.df>a.df)?b:a,null);
  return {cfgs,gov};
}
/* Governing lever-rule config with two or more trucks (every lane count N = 2..N_L, each with
   its own multiple-presence factor). Used where the lever rule replaces the "2+ lanes" equation. */
function leverMulti(p,geo,j){
  return leverAll(p,geo,j).cfgs.filter(c=>c.N>=2).reduce((a,b)=>(!a||b.df>a.df)?b:a,null);
}

/* ---- rigid cross-section method, per side ---- */
function rigidMethod(p,geo,side){
  const Nb=p.Nb, sumX2=geo.sumX2, NL=geo.NL;
  const Xext=(side==="R")?(geo.pos[Nb-1]-geo.xc):(geo.xc-geo.pos[0]);
  const de=(side==="R")?geo.deR:geo.deL;
  const curb=Xext+de;
  const laneW=geo.laneW||12;   // lanes step by the design lane width, not always 12 ft (3.6.1.1.1)
  // Wheels sit 2 ft and 8 ft from the lane edge either way, so the one-lane resultant stays
  // 5 ft from the curb; only the lane-to-lane step changes.
  const ecc=[]; for(let i=0;i<NL;i++) ecc.push(curb-(5+i*laneW));
  const trials=[]; let best={g:-Infinity};
  for(let n=1;n<=NL;n++){
    const sumE=ecc.slice(0,n).reduce((a,b)=>a+b,0), m=multiplePresence(n);
    const R=n/Nb+(Xext*sumE)/sumX2, g=m*R;
    trials.push({n,m,sumE,R,g}); if(g>best.g) best={g,m,sumE,R,nLoaded:n};
  }
  return {g:best.g,m:best.m,nLoaded:best.nLoaded,sumE:best.sumE,R:best.R,Xext,sumX2,trials,de,side,ecc};   // ecc: added 2026-10-29 (read-only output, the lane eccentricities, for apps/steel-bridge's worked steps)
}

/* ---- per-member design distribution factors ---- */
function memberDF(p,geo,Kg,skew,j){
  const type=memberType(p,j), S=memberSpacing(p,j), label="B"+(j+1);
  const fat=(one)=>typeof one==="number"?one/1.2:null;   // fatigue: strip MPF=1.2 from one-lane value (C3.6.1.1.2)

  if(BEAM_SLAB.has(p.type)){
    const emp=empiricalInterior(Kg,p.L,p.ts,S,p.kgSimple);
    const n3=(p.Nb===3);
    /* Tables 4.6.2.2.2b-1 / 4.6.2.2.3a-1 apply only for 3.5 ≤ S ≤ 16.0 ft. Beyond 16 ft the
       approximate equations are not valid and the lever rule is used instead — the same
       automatic fallback the spread-box path already makes at S > 18 ft. */
    const tooWide=(S>16.0);
    if(type==="int"){
      let mom1=emp.mom1, mom2=emp.mom2, shr1=emp.shr1, shr2=emp.shr2, n3info=null, lvUsed=null;
      if(tooWide){ // S > 16 ft: equations out of range, lever rule governs moment and shear
        const lv1=leverConfig(p,geo,j,1), lv2=leverMulti(p,geo,j);   // lv2 = governing of N = 2..N_L trucks
        lvUsed={lv1,lv2,eq:{mom1,mom2,shr1,shr2}};
        mom1=shr1=(lv1?lv1.df:0); mom2=shr2=(lv2?lv2.df:0);
      } else if(n3){ // Nb=3: moment = lesser of eqn or lever rule; shear = lever rule
        // lv2 = governing of N = 2..N_L trucks (leverMulti), as for S > 16 ft (was 2 trucks only)
        const lv1=leverConfig(p,geo,j,1), lv2=leverMulti(p,geo,j);
        n3info={lv1,lv2,eq:{mom1,mom2}};
        mom1=Math.min(mom1,lv1?lv1.df:mom1); mom2=Math.min(mom2,lv2?lv2.df:mom2);
        shr1=lv1?lv1.df:shr1; shr2=lv2?lv2.df:shr2;
      }
      mom1*=skew.scfM; mom2*=skew.scfM; shr1*=skew.scfV; shr2*=skew.scfV;
      return {j,label,type,S,emp,n3info,tooWide,lvUsed,r:{mom1,mom2,shr1,shr2},gM:Math.max(mom1,mom2),gV:Math.max(shr1,shr2),
        fatM:fat(mom1),fatV:fat(shr1),method:tooWide?"lever (S>16)":(n3?"Nb=3: eqn/lever":"empirical")};
    }
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, bay=(side==="L")?p.spacings[0]:p.spacings[p.spacings.length-1];
    const de=Math.max(de0,-1.0);   // AASHTO 4.6.2.2.2d: limit de to -1.0 if below range
    const lever1=leverConfig(p,geo,j,1);
    const eM=0.77+de/9.1, eV=0.60+de/10;
    let mE=eM*emp.mom2, vE=eV*emp.shr2, n3info=null, lvUsed=null;
    if(tooWide){ // S > 16 ft: the e-factor rides on an out-of-range interior equation, so use the lever rule
      const lv2=leverMulti(p,geo,j); lvUsed={lv2,eq:{mE,vE}};   // governing of N = 2..N_L trucks
      mE=lv2?lv2.df:0; vE=lv2?lv2.df:0;
    } else if(n3){ const lv2=leverMulti(p,geo,j); n3info={lv2,eqM:mE};   // governing of N = 2..N_L trucks
      mE=Math.min(mE,lv2?lv2.df:mE); vE=lv2?lv2.df:vE; }   // Nb=3: moment lesser of eqn/lever; shear lever
    // The rigid cross-section method is a statics check, not an empirical equation, so it
    // still applies (and may govern) when the spacing is out of range.
    const rig=rigidMethod(p,geo,side);
    const l1=lever1?lever1.df:0;
    const momExt1=l1*skew.scfM, momExt2=Math.max(mE,rig.g)*skew.scfM;
    const shrExt1=l1*skew.scfV, shrExt2=Math.max(vE,rig.g)*skew.scfV;
    const base=(momExt1>=momExt2?"lever (1 ln)":(rig.g>mE?"rigid":"e-factor"));
    // Fatigue (one truck): the exterior DF may not be less than the rigid-section value
    // (4.6.2.2.2d), so the one-lane basis is the larger of lever rule and rigid method, n_L = 1.
    const rig1=(rig.trials&&rig.trials.length)?rig.trials[0].g:0, fat1=Math.max(l1,rig1);
    const fatOneM=fat1*skew.scfM, fatOneV=fat1*skew.scfV;
    return {j,label,type,S,de,side,bay,emp,lever1,eM,eV,mE,vE,rig,n3info,tooWide,lvUsed,
      r:{momExt1,momExt2,shrExt1,shrExt2},gM:Math.max(momExt1,momExt2),gV:Math.max(shrExt1,shrExt2),
      fatM:fat(fatOneM),fatV:fat(fatOneV),fatOneM,fatOneV,
      fatNote:(rig1>l1+1e-9)?`One-lane basis = rigid method with one lane loaded (${f3(rig1)}), which exceeds the one-lane lever rule (${f3(l1)}); the exterior DF may not be less than the rigid-section value (4.6.2.2.2d)`:"",
      method:tooWide?(base==="rigid"?"rigid (S>16)":"lever (S>16)"):base};
  }

  if(BOX.has(p.type)){
    const bx=boxDF(p,geo), b=p.boxB;
    if(type==="int"){
      const mom1=bx.mom1*skew.scfM, mom2=bx.mom2*skew.scfM, shr1=bx.shr1*skew.scfV, shr2=bx.shr2*skew.scfV;
      return {j,label,type,S,bx,r:{mom1,mom2,shr1,shr2},gM:Math.max(mom1,mom2),gV:Math.max(shr1,shr2),
        fatM:fat(mom1),fatV:fat(shr1),method:"box eqn (f/g)"};
    }
    // d_e above the 2.0 ft range limit is NOT clamped (the clamp lowered e: unconservative); the
    // e-equations are extrapolated and bridgeWarnings says so.
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=de0;
    const eM1=Math.max(1.0,1.125+de/30), eM2=Math.max(1.0,1.04+de/25);
    const mExt1=eM1*bx.mom1*skew.scfM, mExt2=eM2*bx.mom2*skew.scfM;
    const eV1=Math.max(1.0,1.25+de/20);
    const inV=(de+b/12-2.0)/40, eV2=Math.max(1.0, inV>0?1+Math.sqrt(inV):1.0);
    const capV=Math.min(48/b,1.0);
    const vExt1=eV1*bx.shr1*skew.scfV, vExt2=capV*eV2*bx.shr2*skew.scfV;
    return {j,label,type,S,de,side,bx,eM1,eM2,eV1,eV2,capV,inV,
      r:{momExt1:mExt1,momExt2:mExt2,shrExt1:vExt1,shrExt2:vExt2},
      gM:Math.max(mExt1,mExt2),gV:Math.max(vExt1,vExt2),
      fatM:fat(mExt1),fatV:fat(vExt1),method:"e-factor (f/g)"};
  }

  if(p.type==="bc"){  // spread box beams
    const sp=spreadDF(p,S), tooWide=(S>18.0);
    const fV=skew.active?1.0+(Math.sqrt(p.L*p.depth/12.0)/(6.0*S))*skew.tanV:1.0;  // Table 4.6.2.2.3c-1 (b,c)
    if(type==="int"){
      let mom1,mom2,shr1,shr2,lvUsed=null;
      if(tooWide){ const lv1=leverConfig(p,geo,j,1),lv2=leverMulti(p,geo,j); lvUsed={lv1,lv2};
        mom1=shr1=(lv1?lv1.df:0); mom2=shr2=(lv2?lv2.df:0); }
      else { mom1=sp.mom1; mom2=sp.mom2; shr1=sp.shr1; shr2=sp.shr2; }
      mom1*=skew.scfM; mom2*=skew.scfM; shr1*=fV; shr2*=fV;
      return {j,label,type,S,sp,fV,tooWide,lvUsed,r:{mom1,mom2,shr1,shr2},gM:Math.max(mom1,mom2),gV:Math.max(shr1,shr2),
        fatM:fat(mom1),fatV:fat(shr1),method:tooWide?"lever (S>18)":"spread box eqn"};
    }
    // lower limit 0 kept (raises e); no upper clamp at 4.5 ft (extrapolated; the clamp lowered e)
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.max(de0,0);
    const lever1=leverConfig(p,geo,j,1), l1=lever1?lever1.df:0;
    const eM=0.97+de/28.5, eV=0.80+de/10;
    let mE,vE,lv2=null;
    if(tooWide){ lv2=leverMulti(p,geo,j); mE=lv2?lv2.df:0; vE=lv2?lv2.df:0; }
    else { mE=eM*sp.mom2; vE=eV*sp.shr2; }
    const momExt1=l1*skew.scfM, momExt2=mE*skew.scfM, shrExt1=l1*fV, shrExt2=vE*fV;
    return {j,label,type,S,de,side,sp,fV,tooWide,lever1,eM,eV,mE,vE,
      r:{momExt1,momExt2,shrExt1,shrExt2},gM:Math.max(momExt1,momExt2),gV:Math.max(shrExt1,shrExt2),
      fatM:fat(momExt1),fatV:fat(shrExt1),method:tooWide?"lever (S>18)":"e-factor (b/c)"};
  }

  if(p.type==="d"){  // CIP multicell box — members are webs; Nc = Nb − 1
    const mc=multicellDF(p,S);
    const fVext=skew.active?1.0+(0.25+12.0*p.L/(70.0*p.depth))*skew.tanV:1.0;   // exterior web
    const fVint=skew.active?1.0+(0.042+12.0*p.L/(420.0*p.depth))*skew.tanV:1.0; // first interior web
    if(type==="int"){
      const mom1=mc.mom1*skew.scfM, mom2=mc.mom2*skew.scfM, shr1=mc.shr1*fVint, shr2=mc.shr2*fVint;
      return {j,label,type,S,mc,fV:fVint,r:{mom1,mom2,shr1,shr2},gM:Math.max(mom1,mom2),gV:Math.max(shr1,shr2),
        fatM:fat(mom1),fatV:fat(shr1),method:"multicell eqn"};
    }
    // lower limit −2.0 kept (raises e); no upper clamp at 5.0 ft (extrapolated; the clamp lowered e)
    const side=(j===0)?"L":"R", de0=(side==="L")?geo.deL:geo.deR, de=Math.max(de0,-2.0);
    const O=(side==="L")?p.OL:p.OR, Sadj=(side==="L")?p.spacings[0]:p.spacings[p.spacings.length-1];
    const We=Math.min(O+Sadj/2.0,Sadj);
    const gWe=We/14.0;
    const lever1=leverConfig(p,geo,j,1), l1=lever1?lever1.df:0;
    const eV=0.64+de/12.5, vE=eV*mc.shr2;
    const momExt1=gWe*skew.scfM, momExt2=gWe*skew.scfM;
    const shrExt1=l1*fVext, shrExt2=vE*fVext;
    return {j,label,type,S,de,side,mc,We,gWe,fV:fVext,lever1,eV,vE,
      r:{momExt1,momExt2,shrExt1,shrExt2},gM:Math.max(momExt1,momExt2),gV:Math.max(shrExt1,shrExt2),
      fatM:gWe*skew.scfM,fatV:fat(shrExt1),fatNote:"We/14 used directly for fatigue moment (verify)",method:"We/14 + e-factor"};
  }

  // cast-in-place slab: equivalent strip
  const L1=Math.min(p.L,60), W1s=Math.min(geo.roadway,30), W1m=Math.min(geo.roadway,60);
  const Es=10+5*Math.sqrt(L1*W1s), Em=Math.min(84+1.44*Math.sqrt(L1*W1m),12*geo.roadway/Math.max(1,geo.NL));
  const dS=12/Es, dM=12/Em;
  return {j,label,type,S,gM:Math.max(dS,dM),gV:Math.max(dS,dM),fatM:fat(dS),fatV:fat(dS),
    method:"strip",r:{dS,dM,Es,Em}};
}

/* Inputs that make the equations divide by zero or go non-finite. Blank fields read as 0.
   computeBridge refuses to run with any of these, and run() lists them for the user. */
function inputErrors(p){
  const e=[], bad=v=>!(isFinite(v)&&v>0);
  (p.spans||[]).forEach((L,i)=>{ if(bad(L)) e.push(`${p.spans.length>1?`Span ${i+1} length`:"Span length"} L is blank, zero or negative — enter a span length > 0 ft.`); });
  (p.spacings||[]).forEach((S,i)=>{ if(bad(S)) e.push(`Beam spacing Beam ${i+1} → Beam ${i+2} is blank, zero or negative — enter a spacing > 0 ft.`); });
  if(BEAM_SLAB.has(p.type)){
    if(bad(p.ts)) e.push("Slab thickness t_s is blank, zero or negative — enter t_s > 0 in.");
    if(bad(p.n*(p.I+p.A*p.eg*p.eg))) e.push("K_g = n(I + A·e_g²) is zero or negative — check n, I, A and e_g.");
  }
  if((p.type==="bc"||p.type==="d"||(BOX.has(p.type)&&(p.skew>0||p.skewV>0)))&&bad(p.depth)) e.push("Beam depth d is blank, zero or negative — enter d > 0 in.");
  if(BOX.has(p.type)){
    if(bad(p.boxB)) e.push("Box beam width b is blank, zero or negative.");
    if(bad(p.boxI)) e.push("Box beam I is blank, zero or negative.");
    if(bad(p.boxJ)) e.push("Box beam J is blank, zero or negative.");
  }
  return e;
}

function computeBridge(p){
  const inErr=inputErrors(p);
  if(inErr.length){ const er=new Error("Input error:\n"+inErr.join("\n")); er.inputErrors=inErr; throw er; }
  const geo=geometry(p);
  const Kg=BEAM_SLAB.has(p.type)?p.n*(p.I+p.A*p.eg*p.eg):null;
  const skew=skewFactors(p,geo,Kg);
  const members=[]; for(let j=0;j<p.Nb;j++) members.push(memberDF(p,geo,Kg,skew,j));
  return {geo,Kg,skew,members};   // lldf.html adds warnings: bridgeWarnings(p,geo,Kg)
}

const KG_SIMPLE={m:1.02,c1:1.03,v:0.97};   // Table 4.6.2.2.1-3, type (a): (Kg/12Lts³)^0.1, (Kg/12Lts³)^0.25, (12Lts³/Kg)^0.3

window.SharedLLDF={multiplePresence,RANGES,BEAM_SLAB,BOX,BOXR,SPREADR,CELLR,FAMILY,KG_SIMPLE,designL,spreadDF,multicellDF,geometry,
  memberType,memberSpacing,girderU,skewFactors,boxDF,empiricalInterior,leverContribution,truckGap,leverConfig,leverAll,leverMulti,
  rigidMethod,memberDF,inputErrors,computeBridge,momentSkewNoReduction,momentSkewNoReductionPier};
})();
