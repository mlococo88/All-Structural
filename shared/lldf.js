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
   steps: the worked-step writer (SharedLLDF.steps, shared/steps.js format; moved from apps/steel-bridge/engine/lldf.js 2026-11-01).
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

/* ---------- worked steps (SharedLLDF.steps) ----------
   Moved 2026-11-01 from apps/steel-bridge/engine/lldf.js (fixlog/shared-lldf.md, LLST), so that the Steel Bridge app and lldf.html's
   Report tab write the live-load distribution steps with ONE copy. The functions are the Steel Bridge app's, line for line; the only
   edits: each takes its work collector (SharedSteps.work) from the caller (geometry), member() takes SharedLLDF's input q (the page's
   readInputs() form) instead of the app's region input (q.L, q.ts, q.kgSimple, q.Nb are the same values), and its girder label
   prefix (opt.prefix, default 'G'). The steps' ids, labels, equations, substitutions and values are unchanged (step dump of every
   Steel Bridge fixture and variant identical before and after, fixlog/shared-lldf.md). The step VALUES are the engine's own numbers
   (memberDF, skewFactors, geometry, leverConfig, rigidMethod): nothing is computed again here except the lever rule's influence
   ordinates c (withC), which are shown in the substitution only.
   Needs window.SharedSteps (shared/steps.js) at call time. Step format: shared/README.md "Worked steps".
     geometry(w, s, geo)            deck width, roadway, N_L, S_avg, d_e left / right, Σx² (s: { OL, OR, rL, rR, Nb })
     skew(w, s, sk, Kg)             moment reduction r_M and shear correction r_V, beam-slab rows (s: { simple, L, ts, geoSavg, pier };
                                    sk: skewFactors() plus thM, thV (moment / shear θ, deg), noRed, dTh, thMin)
     emp(w, e, S, L, ts, Kg, simple) interior equations, Tables 4.6.2.2.2b-1 / 4.6.2.2.3a-1
     lever(w, id, L, what)          one lever-rule configuration (L from withC)
     rigid(w, rig, Nb)              rigid cross-section, Eq. C4.6.2.2.2d-1
     member(q, geo, Kg, sk, j, w, opt) the factors of girder j (memberDF) mapped to { j, label, type, S, r, gM, gV, fatM, fatV, method, … }
                                    and, with w, its worked steps (beam-slab types a, e, k)
     withC(q, geo, j, L)            a lever-rule result with the influence ordinate c of each wheel line
     other(q, geo, sk, md, w)       the steps of the other cross-section types (f, g, bc, d, slab; added 2026-11-01, lldf.html Report tab) */
const STEPS=(function(){
  const ED = 'AASHTO LRFD 10th Ed.';
  const St = () => window.SharedSteps;
  const n2 = x => St().n(x, 2), n3 = x => St().n(x, 3), n4 = x => St().n(x, 4), g0 = x => St().g(x, 0);
  const withC = (p, geo, j, L) => L ? { ...L, c: L.wheels.map(u => leverContribution(girderU(p, geo), p.Nb, j, u)) } : L;
  function geometry(w, p, geo) {
    w.add({ id: 'Wdeck', label: 'Deck width, out to out', sym: 'W', eq: 'o_{L} + \\sum S + o_{R}', sub: `${n2(p.OL)} + ${n2(geo.beamW)} + ${n2(p.OR)}`, value: geo.Wdeck, unit: 'ft', d: 2 });
    w.add({ id: 'w', label: 'Clear roadway width between the live-load traffic faces', sym: 'w', eq: 'W - r_{L} - r_{R}', sub: `${n2(geo.Wdeck)} - ${n2(p.rL)} - ${n2(p.rR)}`, value: geo.roadway, unit: 'ft', d: 2, ref: `${ED} Art. 3.6.1.1.1` });
    w.add({ id: 'NL', label: 'Number of design lanes', sym: 'N_{L}', eq: geo.twoHalf ? '2\\ \\text{(20 ft} \\le w \\le \\text{24 ft)}' : '\\text{INT}(w/12)', sub: geo.twoHalf ? '' : `\\text{INT}(${n2(geo.roadway)}/12)`, value: geo.NL, unit: '', d: 0, ref: `${ED} Art. 3.6.1.1.1`,
      note: geo.twoHalf ? `Two lanes, each half the roadway: ${n2(geo.laneW)} ft.` : '' });
    w.add({ id: 'Savg', label: 'Average girder spacing', sym: 'S_{avg}', eq: '\\frac{\\sum S}{N_{b} - 1}', sub: `\\frac{${n2(geo.beamW)}}{${p.Nb} - 1}`, value: geo.Savg, unit: 'ft', d: 3 });
    w.add({ id: 'deL', label: 'Distance d_e, left exterior girder web to the traffic face', sym: 'd_{e,L}', eq: 'o_{L} - r_{L}', sub: `${n2(p.OL)} - ${n2(p.rL)}`, value: geo.deL, unit: 'ft', d: 2, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'deR', label: 'Distance d_e, right exterior girder web to the traffic face', sym: 'd_{e,R}', eq: 'o_{R} - r_{R}', sub: `${n2(p.OR)} - ${n2(p.rR)}`, value: geo.deR, unit: 'ft', d: 2, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'sumX2', label: 'Sum of the squared girder offsets from the girder-group centroid', sym: '\\sum x^{2}', eq: '\\sum (x_{i} - \\bar{x})^{2}', sub: geo.xrel.map(x => `(${n2(x)})^{2}`).join(' + '), value: geo.sumX2, unit: 'ft^{2}', d: 2, ref: `${ED} Eq. C4.6.2.2.2d-1` });
  }
  function skew(w, p, sk, Kg) {
    const kt = p.simple ? `${KG_SIMPLE.c1}` : `\\left(\\frac{${g0(Kg)}}{12(${n2(p.L)})(${n2(p.ts)})^{3}}\\right)^{0.25}`;
    if (sk.noRed) w.add({ id: 'noRed', label: p.pier ? 'An adjacent span\'s support lines differ by more than 10°: no moment skew reduction for this pier region' : 'Support lines of this span differ by more than 10°: no moment skew reduction', sym: '|\\theta_{A} - \\theta_{B}|', eq: '', sub: '', value: sk.dTh, unit: 'deg', d: 2, ref: `${ED} Art. 4.6.2.2.2e`,
      note: `The smaller skew θ = ${n2(sk.thMin)}° is not used for the moment (engineer's decisions 2026-10-29: per span; a pier region if either adjacent span differs).` });
    if (Math.min(sk.thM, 60) >= 30) {
      w.add({ id: 'c1', label: 'Skew coefficient c_1 for moment', sym: 'c_{1}', eq: '0.25\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.25}\\left(\\frac{S}{L}\\right)^{0.5}', sub: `0.25${kt}\\left(\\frac{${n3(p.geoSavg)}}{${n2(p.L)}}\\right)^{0.5}`, value: sk.c1, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2e-1` });
      w.add({ id: 'scfM', label: 'Skew reduction factor for moment', sym: 'r_{M}', eq: '1 - c_{1}(\\tan\\theta)^{1.5}', sub: `1 - ${n4(sk.c1)}(\\tan ${n2(Math.min(sk.thM, 60))}^{\\circ})^{1.5}`, value: sk.scfM, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2e-1`, note: sk.thM > 60 ? 'θ > 60°: θ = 60° used.' : '' });
    } else w.add({ id: 'scfM', label: 'Skew reduction factor for moment', sym: 'r_{M}', eq: '1.0', sub: '', value: sk.scfM, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2e-1`, note: sk.noRed ? 'No reduction (Art. 4.6.2.2.2e).' : `θ = ${n2(sk.thM)}° < 30°: no reduction.` });
    if (Math.min(sk.thV, 60) > 0) {
      const vt = p.simple ? `${KG_SIMPLE.v}` : `\\left(\\frac{12(${n2(p.L)})(${n2(p.ts)})^{3}}{${g0(Kg)}}\\right)^{0.3}`;
      w.add({ id: 'scfV', label: 'Skew correction factor for shear (obtuse corner)', sym: 'r_{V}', eq: '1 + 0.20\\left(\\frac{12Lt_{s}^{3}}{K_{g}}\\right)^{0.3}\\tan\\theta', sub: `1 + 0.20${vt}\\tan ${n2(Math.min(sk.thV, 60))}^{\\circ}`, value: sk.scfV, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3c-1` });
    } else w.add({ id: 'scfV', label: 'Skew correction factor for shear', sym: 'r_{V}', eq: '1.0', sub: '', value: sk.scfV, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3c-1`, note: 'No skew.' });
  }
  function emp(w, e, S, L, ts, Kg, simple) {
    w.add({ id: 'kterm', label: 'Stiffness term', sym: '\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.1}', eq: simple ? '1.02\\ \\text{(Table 4.6.2.2.1-3)}' : '', sub: simple ? '' : `\\left(\\frac{${g0(Kg)}}{12(${n2(L)})(${n2(ts)})^{3}}\\right)^{0.1}`, value: e.kterm, unit: '', d: 4, ref: simple ? `${ED} Table 4.6.2.2.1-3` : `${ED} Table 4.6.2.2.2b-1` });
    w.add({ id: 'mom1', label: 'Interior moment equation, one lane loaded', sym: 'g_{M,1}', eq: '0.06 + \\left(\\frac{S}{14}\\right)^{0.4}\\left(\\frac{S}{L}\\right)^{0.3}\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.1}', sub: `0.06 + \\left(\\frac{${n3(S)}}{14}\\right)^{0.4}\\left(\\frac{${n3(S)}}{${n2(L)}}\\right)^{0.3}(${n4(e.kterm)})`, value: e.mom1, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2b-1` });
    w.add({ id: 'mom2', label: 'Interior moment equation, two or more lanes loaded', sym: 'g_{M,2}', eq: '0.075 + \\left(\\frac{S}{9.5}\\right)^{0.6}\\left(\\frac{S}{L}\\right)^{0.2}\\left(\\frac{K_{g}}{12Lt_{s}^{3}}\\right)^{0.1}', sub: `0.075 + \\left(\\frac{${n3(S)}}{9.5}\\right)^{0.6}\\left(\\frac{${n3(S)}}{${n2(L)}}\\right)^{0.2}(${n4(e.kterm)})`, value: e.mom2, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2b-1` });
    w.add({ id: 'shr1', label: 'Interior shear equation, one lane loaded', sym: 'g_{V,1}', eq: '0.36 + \\frac{S}{25}', sub: `0.36 + \\frac{${n3(S)}}{25}`, value: e.shr1, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3a-1` });
    w.add({ id: 'shr2', label: 'Interior shear equation, two or more lanes loaded', sym: 'g_{V,2}', eq: '0.2 + \\frac{S}{12} - \\left(\\frac{S}{35}\\right)^{2}', sub: `0.2 + \\frac{${n3(S)}}{12} - \\left(\\frac{${n3(S)}}{35}\\right)^{2}`, value: e.shr2, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3a-1` });
  }
  function lever(w, id, L, what) {
    if (!L) return;
    w.add({ id: id + '.R', label: `Lever rule, ${L.N} truck${L.N > 1 ? 's' : ''} (${what}): girder reaction per wheel load pair, wheels at ${L.wheels.map(n2).join(', ')} ft from the left deck edge`, sym: 'R', eq: '\\sum 0.5c_{i}', sub: L.c.map(c => `0.5(${n3(c)})`).join(' + '), value: L.R, unit: 'lanes', d: 4, ref: `${ED} Art. 4.6.2.2.1, C4.6.2.2.1` });
    w.add({ id: id + '.g', label: `Lever rule with the multiple presence factor, ${L.N} lane${L.N > 1 ? 's' : ''}`, sym: 'g', eq: 'mR', sub: `${n2(L.m)}(${n4(L.R)})`, value: L.df, unit: '', d: 4, ref: `${ED} Table 3.6.1.1.2-1` });
  }
  function rigid(w, rig, Nb) {
    rig.trials.forEach(t => {
      w.add({ id: `rig${t.n}.R`, label: `Rigid cross-section, ${t.n} lane${t.n > 1 ? 's' : ''} loaded (lane resultants ${rig.ecc.slice(0, t.n).map(n2).join(', ')} ft from the centroid)`, sym: 'R', eq: '\\frac{N_{L}}{N_{b}} + \\frac{X_{ext}\\sum e}{\\sum x^{2}}', sub: `\\frac{${t.n}}{${Nb}} + \\frac{${n2(rig.Xext)}(${n2(t.sumE)})}{${n2(rig.sumX2)}}`, value: t.R, unit: '', d: 4, ref: `${ED} Eq. C4.6.2.2.2d-1` });
      w.add({ id: `rig${t.n}.g`, label: `Rigid cross-section with the multiple presence factor, ${t.n} lane${t.n > 1 ? 's' : ''}`, sym: 'g', eq: 'mR', sub: `${n2(t.m)}(${n4(t.R)})`, value: t.g, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Table 3.6.1.1.2-1` });
    });
    w.add({ id: 'rig', label: 'Rigid cross-section, governing', sym: 'g_{rigid}', eq: '\\max(g)', sub: rig.trials.map(t => n4(t.g)).join(',\\ '), value: rig.g, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d`, note: `${rig.nLoaded} lane${rig.nLoaded > 1 ? 's' : ''} loaded governs.` });
  }
  function member(q, geo, Kg, sk, j, w, opt) {
    const md = memberDF(q, geo, Kg, sk, j), type = md.type, S = md.S, label = ((opt && opt.prefix) || 'G') + (j + 1), e = md.emp, n3b = q.Nb === 3, tooWide = !!md.tooWide;
    if (w) { w.add({ id: 'S', label: type === 'int' ? 'Girder spacing (average of the two adjacent bays)' : 'Girder spacing (the adjacent bay)', sym: 'S', eq: '', sub: '', value: S, unit: 'ft', d: 3 }); emp(w, e, S, q.L, q.ts, Kg, q.kgSimple); }
    if (type === 'int') {
      const lv = md.lvUsed || md.n3info, alt = lv ? { l1: withC(q, geo, j, lv.lv1), l2: withC(q, geo, j, lv.lv2), why: tooWide ? 'S > 16 ft: lever rule' : 'N_b = 3: moment lesser of equation and lever rule; shear by lever rule' } : null;
      let mom1 = e.mom1, mom2 = e.mom2, shr1 = e.shr1, shr2 = e.shr2;   // the factors before the skew factors (as memberDF forms them)
      if (tooWide) { mom1 = shr1 = alt.l1 ? alt.l1.df : 0; mom2 = shr2 = alt.l2 ? alt.l2.df : 0; }
      else if (n3b) { mom1 = Math.min(mom1, alt.l1 ? alt.l1.df : mom1); mom2 = Math.min(mom2, alt.l2 ? alt.l2.df : mom2); shr1 = alt.l1 ? alt.l1.df : shr1; shr2 = alt.l2 ? alt.l2.df : shr2; }
      const o = { j, label, type, S, emp: e, alt, r: { ...md.r }, gM: md.gM, gV: md.gV, fatM: md.fatM, fatV: md.fatV, method: tooWide ? 'lever rule (S > 16 ft)' : n3b ? 'N_b = 3 rules' : 'equations' };
      if (w) memberSteps(w, o, sk, alt, mom1, mom2, shr1, shr2);
      return o;
    }
    const side = md.side, de0 = side === 'L' ? geo.deL : geo.deR, lv = md.lvUsed || md.n3info;
    const alt = lv ? { l2: withC(q, geo, j, lv.lv2), why: tooWide ? 'S > 16 ft: lever rule' : 'N_b = 3' } : null;
    const r = { mom1: md.r.momExt1, mom2: md.r.momExt2, shr1: md.r.shrExt1, shr2: md.r.shrExt2 }, rig = md.rig;
    const l1 = md.lever1 ? md.lever1.df : 0, rig1 = rig.trials && rig.trials.length ? rig.trials[0].g : 0;
    const base = r.mom1 >= r.mom2 ? 'lever rule, one lane' : rig.g > md.mE ? 'rigid cross-section' : 'e-factor';
    const o = { j, label, type, S, side, de0, de: md.de, emp: e, lever1: withC(q, geo, j, md.lever1), eM: md.eM, eV: md.eV, mE: md.mE, vE: md.vE, rig, alt, r, gM: md.gM, gV: md.gV,
      fatM: md.fatM, fatV: md.fatV, rig1, fat1: Math.max(l1, rig1), fatOneM: md.fatOneM, fatOneV: md.fatOneV, method: base };
    if (w) extSteps(w, o, sk, q.Nb);
    return o;
  }
  function memberSteps(w, o, sk, alt, mom1, mom2, shr1, shr2) {
    if (alt) { lever(w, 'lev1', alt.l1, 'one lane'); lever(w, 'lev2', alt.l2, 'two or more lanes, the governing number of trucks'); }
    const why = alt ? alt.why : '';
    w.add({ id: 'gM1', label: 'Moment, one lane loaded, with the skew reduction', sym: 'g_{M,1}', eq: alt ? 'g_{1}r_{M}' : 'g_{M,1}r_{M}', sub: `${n4(mom1)}(${n4(sk.scfM)})`, value: o.r.mom1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.2b-1, 4.6.2.2.2e-1`, note: why });
    w.add({ id: 'gM2', label: 'Moment, two or more lanes loaded, with the skew reduction', sym: 'g_{M,2}', eq: alt ? 'g_{2}r_{M}' : 'g_{M,2}r_{M}', sub: `${n4(mom2)}(${n4(sk.scfM)})`, value: o.r.mom2, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.2b-1, 4.6.2.2.2e-1` });
    w.add({ id: 'gV1', label: 'Shear, one lane loaded, with the skew correction', sym: 'g_{V,1}', eq: alt ? 'g_{1}r_{V}' : 'g_{V,1}r_{V}', sub: `${n4(shr1)}(${n4(sk.scfV)})`, value: o.r.shr1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.3a-1, 4.6.2.2.3c-1` });
    w.add({ id: 'gV2', label: 'Shear, two or more lanes loaded, with the skew correction', sym: 'g_{V,2}', eq: alt ? 'g_{2}r_{V}' : 'g_{V,2}r_{V}', sub: `${n4(shr2)}(${n4(sk.scfV)})`, value: o.r.shr2, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.3a-1, 4.6.2.2.3c-1` });
    finalSteps(w, o);
  }
  function extSteps(w, o, sk, Nb) {
    lever(w, 'lev1', o.lever1, 'one lane');
    w.add({ id: 'de', label: 'd_e used in the e-factors', sym: 'd_{e}', eq: '\\max(d_{e}, -1.0)', sub: `\\max(${n2(o.de0)}, -1.0)`, value: o.de, unit: 'ft', d: 2, ref: `${ED} Table 4.6.2.2.2d-1`, note: o.de0 > 5.5 + 1e-9 ? 'd_e > 5.5 ft: outside the range of applicability.' : '' });
    w.add({ id: 'eM', label: 'Correction factor e for moment', sym: 'e', eq: '0.77 + \\frac{d_{e}}{9.1}', sub: `0.77 + \\frac{${n2(o.de)}}{9.1}`, value: o.eM, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'eV', label: 'Correction factor e for shear', sym: 'e', eq: '0.60 + \\frac{d_{e}}{10}', sub: `0.60 + \\frac{${n2(o.de)}}{10}`, value: o.eV, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3b-1` });
    if (o.alt) lever(w, 'lev2', o.alt.l2, 'two or more lanes, the governing number of trucks');
    w.add({ id: 'mE', label: o.alt ? `Moment, two or more lanes (${o.alt.why})` : 'Moment, two or more lanes: e × interior equation', sym: 'g_{M,2}', eq: o.alt ? '' : 'e\\,g_{M,2,int}', sub: o.alt ? '' : `${n4(o.eM)}(${n4(o.emp.mom2)})`, value: o.mE, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.2d-1` });
    w.add({ id: 'vE', label: o.alt ? `Shear, two or more lanes (${o.alt.why})` : 'Shear, two or more lanes: e × interior equation', sym: 'g_{V,2}', eq: o.alt ? '' : 'e\\,g_{V,2,int}', sub: o.alt ? '' : `${n4(o.eV)}(${n4(o.emp.shr2)})`, value: o.vE, unit: '', d: 4, ref: `${ED} Table 4.6.2.2.3b-1` });
    rigid(w, o.rig, Nb);
    const l1 = o.lever1 ? o.lever1.df : 0;
    w.add({ id: 'gM1', label: 'Moment, one lane: lever rule, with the skew reduction', sym: 'g_{M,1}', eq: 'g_{lever,1}r_{M}', sub: `${n4(l1)}(${n4(sk.scfM)})`, value: o.r.mom1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.2d-1, 4.6.2.2.2e-1` });
    w.add({ id: 'gM2', label: 'Moment, two or more lanes: not less than the rigid cross-section, with the skew reduction', sym: 'g_{M,2}', eq: '\\max(g_{M,2}, g_{rigid})r_{M}', sub: `\\max(${n4(o.mE)}, ${n4(o.rig.g)})(${n4(sk.scfM)})`, value: o.r.mom2, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Table 4.6.2.2.2e-1` });
    w.add({ id: 'gV1', label: 'Shear, one lane: lever rule, with the skew correction', sym: 'g_{V,1}', eq: 'g_{lever,1}r_{V}', sub: `${n4(l1)}(${n4(sk.scfV)})`, value: o.r.shr1, unit: '', d: 4, ref: `${ED} Tables 4.6.2.2.3b-1, 4.6.2.2.3c-1` });
    w.add({ id: 'gV2', label: 'Shear, two or more lanes: not less than the rigid cross-section, with the skew correction', sym: 'g_{V,2}', eq: '\\max(g_{V,2}, g_{rigid})r_{V}', sub: `\\max(${n4(o.vE)}, ${n4(o.rig.g)})(${n4(sk.scfV)})`, value: o.r.shr2, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Table 4.6.2.2.3c-1` });
    finalSteps(w, o);
  }
  function finalSteps(w, o) {
    w.add({ id: 'gM', label: `${o.label}: live-load distribution factor for moment (${o.method})`, sym: 'g_{M}', eq: '\\max(g_{M,1}, g_{M,2})', sub: `\\max(${n4(o.r.mom1)}, ${n4(o.r.mom2)})`, value: o.gM, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2` });
    w.add({ id: 'gV', label: `${o.label}: live-load distribution factor for shear`, sym: 'g_{V}', eq: '\\max(g_{V,1}, g_{V,2})', sub: `\\max(${n4(o.r.shr1)}, ${n4(o.r.shr2)})`, value: o.gV, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.3` });
    if (o.type === 'ext') {   // 4.6.2.2.2d: the exterior factor not less than the rigid cross-section value, also for fatigue (one lane)
      const sM = o.fatOneM / (o.fat1 || 1), l1 = o.lever1 ? o.lever1.df : 0;
      w.add({ id: 'fat1', label: `${o.label}: one-lane factor for fatigue: the larger of the lever rule and the rigid cross-section with one lane loaded`, sym: 'g_{1}', eq: '\\max(g_{lever,1}, g_{rigid,1})', sub: `\\max(${n4(l1)}, ${n4(o.rig1)})`, value: o.fat1, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2d, Eq. C4.6.2.2.2d-1`,
        note: o.rig1 > l1 + 1e-9 ? 'The rigid cross-section governs (it exceeds the one-lane lever rule).' : 'The lever rule governs.' });
      w.add({ id: 'fatM', label: `${o.label}: fatigue factor for moment (one lane, multiple presence 1.2 removed)`, sym: 'g_{fat,M}', eq: '\\frac{g_{1}r_{M}}{1.2}', sub: `\\frac{${n4(o.fat1)}(${n4(sM)})}{1.2}`, value: o.fatM, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2, Art. 4.6.2.2.2d` });
      w.add({ id: 'fatV', label: `${o.label}: fatigue factor for shear`, sym: 'g_{fat,V}', eq: '\\frac{g_{1}r_{V}}{1.2}', sub: `\\frac{${n4(o.fat1)}(${n4(o.fatOneV / (o.fat1 || 1))})}{1.2}`, value: o.fatV, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2, Art. 4.6.2.2.2d` });
      return;
    }
    w.add({ id: 'fatM', label: `${o.label}: fatigue factor for moment (one lane, multiple presence 1.2 removed)`, sym: 'g_{fat,M}', eq: '\\frac{g_{M,1}}{1.2}', sub: `\\frac{${n4(o.r.mom1)}}{1.2}`, value: o.fatM, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2` });
    w.add({ id: 'fatV', label: `${o.label}: fatigue factor for shear`, sym: 'g_{fat,V}', eq: '\\frac{g_{V,1}}{1.2}', sub: `\\frac{${n4(o.r.shr1)}}{1.2}`, value: o.fatV, unit: '', d: 4, ref: `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2` });
  }
  /* ---- other cross-section types (added 2026-11-01 for lldf.html's Report tab; the Steel Bridge app does not call these) ----
     other(q, geo, sk, md, w): the worked steps of girder (web, strip) md = memberDF(q, geo, null, sk, j) for types f, g (adjacent
     boxes), bc (spread boxes), d (CIP multicell box, webs as members) and slab (equivalent strip). Every value is a field of md or sk
     (the engine's own numbers, nothing computed again); the substitutions format those numbers. sk: skewFactors(q, geo, null).
     Ids (inside the caller's work): the interior equations mom1, mom2, shr1, shr2 (before skew), the type's e-factors, rM, rV, then
     gM1, gM2, gV1, gV2 (with skew), gM, gV, fatM, fatV. */
  function skewOther(w, q, sk, md) {
    const T = `${ED} Table 4.6.2.2.2e-1`, TV = `${ED} Table 4.6.2.2.3c-1`;
    if (!sk.active) { w.add({ id: 'rM', label: 'Skew reduction factor for moment', sym: 'r_{M}', eq: '1.0', sub: '', value: 1, unit: '', d: 4, ref: T, note: 'No skew.' });
      w.add({ id: 'rV', label: 'Skew correction factor for shear', sym: 'r_{V}', eq: '1.0', sub: '', value: md.fV != null ? md.fV : sk.scfV, unit: '', d: 4, ref: TV, note: 'No skew.' }); return; }
    w.add({ id: 'rM', label: 'Skew reduction factor for moment', sym: 'r_{M}', eq: '\\min(1.0,\\ 1.05 - 0.25\\tan\\theta)', sub: `\\min(1.0,\\ 1.05 - 0.25\\tan ${n2(sk.thU)}^{\\circ})`, value: sk.scfM, unit: '', d: 4, ref: T,
      note: sk.th > 60 ? 'θ > 60°: θ = 60° used.' : '' });
    const tv = `\\tan ${n2(sk.thVU)}^{\\circ}`, nV = sk.thV > 60 ? 'θ_V > 60°: θ = 60° used.' : '';
    if (sk.kind === 'box') w.add({ id: 'rV', label: 'Skew correction factor for shear (obtuse corner)', sym: 'r_{V}', eq: '1 + \\frac{12L}{90d}\\sqrt{\\tan\\theta}', sub: `1 + \\frac{12(${n2(q.L)})}{90(${n2(q.depth)})}\\sqrt{${tv}}`, value: sk.scfV, unit: '', d: 4, ref: TV, note: nV });
    else if (sk.kind === 'spread') w.add({ id: 'rV', label: 'Skew correction factor for shear (obtuse corner)', sym: 'r_{V}', eq: '1 + \\frac{\\sqrt{Ld/12}}{6S}\\tan\\theta', sub: `1 + \\frac{\\sqrt{${n2(q.L)}(${n2(q.depth)})/12}}{6(${n3(md.S)})}${tv}`, value: md.fV, unit: '', d: 4, ref: TV, note: nV });
    else if (sk.kind === 'multicell') w.add({ id: 'rV', label: md.type === 'ext' ? 'Skew correction factor for shear, exterior web' : 'Skew correction factor for shear, interior web (the first interior web\'s factor)', sym: 'r_{V}',
      eq: md.type === 'ext' ? '1 + \\left(0.25 + \\frac{12L}{70d}\\right)\\tan\\theta' : '1 + \\left(0.042 + \\frac{12L}{420d}\\right)\\tan\\theta',
      sub: md.type === 'ext' ? `1 + \\left(0.25 + \\frac{12(${n2(q.L)})}{70(${n2(q.depth)})}\\right)${tv}` : `1 + \\left(0.042 + \\frac{12(${n2(q.L)})}{420(${n2(q.depth)})}\\right)${tv}`, value: md.fV, unit: '', d: 4, ref: TV, note: nV });
  }
  function otherFinal(w, md, m1, m2, v1, v2) {   // m1 … v2: [eq, sub] of the four factors with skew
    const r = md.r, ext = md.type === 'ext', M1 = ext ? r.momExt1 : r.mom1, M2 = ext ? r.momExt2 : r.mom2, V1 = ext ? r.shrExt1 : r.shr1, V2 = ext ? r.shrExt2 : r.shr2;
    w.add({ id: 'gM1', label: 'Moment, one lane loaded, with the skew reduction', sym: 'g_{M,1}', eq: m1[0], sub: m1[1], value: M1, unit: '', d: 4, ref: m1[2] || '' });
    w.add({ id: 'gM2', label: 'Moment, two or more lanes loaded, with the skew reduction', sym: 'g_{M,2}', eq: m2[0], sub: m2[1], value: M2, unit: '', d: 4, ref: m2[2] || '' });
    w.add({ id: 'gV1', label: 'Shear, one lane loaded, with the skew correction', sym: 'g_{V,1}', eq: v1[0], sub: v1[1], value: V1, unit: '', d: 4, ref: v1[2] || '' });
    w.add({ id: 'gV2', label: 'Shear, two or more lanes loaded, with the skew correction', sym: 'g_{V,2}', eq: v2[0], sub: v2[1], value: V2, unit: '', d: 4, ref: v2[2] || '' });
    w.add({ id: 'gM', label: `${md.label}: live-load distribution factor for moment (${md.method})`, sym: 'g_{M}', eq: '\\max(g_{M,1}, g_{M,2})', sub: `\\max(${n4(M1)}, ${n4(M2)})`, value: md.gM, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.2` });
    w.add({ id: 'gV', label: `${md.label}: live-load distribution factor for shear`, sym: 'g_{V}', eq: '\\max(g_{V,1}, g_{V,2})', sub: `\\max(${n4(V1)}, ${n4(V2)})`, value: md.gV, unit: '', d: 4, ref: `${ED} Art. 4.6.2.2.3` });
    const FR = `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2`;
    if (md.fatNote && /We\/14/.test(md.fatNote)) w.add({ id: 'fatM', label: `${md.label}: fatigue factor for moment (W_e/14 used directly)`, sym: 'g_{fat,M}', eq: 'g_{M,1}', sub: n4(M1), value: md.fatM, unit: '', d: 4, ref: FR, note: 'The engine uses W_e/14 with the skew reduction for the fatigue moment, without removing 1.2 (verify).' });
    else w.add({ id: 'fatM', label: `${md.label}: fatigue factor for moment (one lane, multiple presence 1.2 removed)`, sym: 'g_{fat,M}', eq: '\\frac{g_{M,1}}{1.2}', sub: `\\frac{${n4(M1)}}{1.2}`, value: md.fatM, unit: '', d: 4, ref: FR });
    w.add({ id: 'fatV', label: `${md.label}: fatigue factor for shear`, sym: 'g_{fat,V}', eq: '\\frac{g_{V,1}}{1.2}', sub: `\\frac{${n4(V1)}}{1.2}`, value: md.fatV, unit: '', d: 4, ref: FR });
  }
  function other(q, geo, sk, md, w) {
    const ext = md.type === 'ext', S = md.S, L = q.L, d = q.depth, j = md.j, rM = n4(sk.scfM);
    const T2b = `${ED} Table 4.6.2.2.2b-1`, T3a = `${ED} Table 4.6.2.2.3a-1`, T2d = `${ED} Table 4.6.2.2.2d-1`, T3b = `${ED} Table 4.6.2.2.3b-1`;
    const deStep = (lo, why) => w.add({ id: 'de', label: 'd_e used in the e-factors', sym: 'd_{e}', eq: lo == null ? 'o - f' : `\\max(d_{e}, ${n2(lo)})`, sub: lo == null ? `${n2(md.side === 'L' ? q.OL : q.OR)} - ${n2(md.side === 'L' ? q.rL : q.rR)}` : `\\max(${n2(md.side === 'L' ? geo.deL : geo.deR)}, ${n2(lo)})`, value: md.de, unit: 'ft', d: 2, ref: T2d, note: why || '' });
    const lever1 = () => { const L1 = withC(q, geo, j, md.lever1); lever(w, 'lev1', L1, 'one lane'); return md.lever1 ? md.lever1.df : 0; };
    if (q.type === 'f' || q.type === 'g') {
      const bx = md.bx, b = q.boxB;
      w.add({ id: 'k', label: 'Distribution factor coefficient', sym: 'k', eq: '2.5(N_{b})^{-0.2} \\ge 1.5', sub: `\\max(2.5(${q.Nb})^{-0.2}, 1.5)`, value: bx.k, unit: '', d: 4, ref: T2b });
      w.add({ id: 'IJ', label: 'Ratio of the moment of inertia to the St. Venant torsional constant', sym: '\\frac{I}{J}', eq: '', sub: `\\frac{${g0(q.boxI)}}{${g0(q.boxJ)}}`, value: bx.IJ, unit: '', d: 4, ref: T2b });
      w.add({ id: 'mom1', label: 'Interior moment equation, one lane loaded', sym: 'g_{M,1}', eq: 'k\\left(\\frac{b}{33.3L}\\right)^{0.5}\\left(\\frac{I}{J}\\right)^{0.25}', sub: `${n4(bx.k)}\\left(\\frac{${n2(b)}}{33.3(${n2(L)})}\\right)^{0.5}(${n4(bx.IJ)})^{0.25}`, value: bx.mom1, unit: '', d: 4, ref: T2b });
      w.add({ id: 'mom2', label: 'Interior moment equation, two or more lanes loaded', sym: 'g_{M,2}', eq: 'k\\left(\\frac{b}{305}\\right)^{0.6}\\left(\\frac{b}{12L}\\right)^{0.2}\\left(\\frac{I}{J}\\right)^{0.06}', sub: `${n4(bx.k)}\\left(\\frac{${n2(b)}}{305}\\right)^{0.6}\\left(\\frac{${n2(b)}}{12(${n2(L)})}\\right)^{0.2}(${n4(bx.IJ)})^{0.06}`, value: bx.mom2, unit: '', d: 4, ref: T2b });
      w.add({ id: 'shr1', label: 'Interior shear equation, one lane loaded', sym: 'g_{V,1}', eq: '\\left(\\frac{b}{130L}\\right)^{0.15}\\left(\\frac{I}{J}\\right)^{0.05}', sub: `\\left(\\frac{${n2(b)}}{130(${n2(L)})}\\right)^{0.15}(${n4(bx.IJ)})^{0.05}`, value: bx.shr1, unit: '', d: 4, ref: T3a });
      w.add({ id: 'shr2', label: 'Interior shear equation, two or more lanes loaded', sym: 'g_{V,2}', eq: '\\left(\\frac{b}{156}\\right)^{0.4}\\left(\\frac{b}{12L}\\right)^{0.1}\\left(\\frac{I}{J}\\right)^{0.05}\\left(\\frac{b}{48}\\right)', sub: `\\left(\\frac{${n2(b)}}{156}\\right)^{0.4}\\left(\\frac{${n2(b)}}{12(${n2(L)})}\\right)^{0.1}(${n4(bx.IJ)})^{0.05}(${n4(Math.max(b / 48, 1))})`, value: bx.shr2, unit: '', d: 4, ref: T3a, note: 'b/48 is taken not less than 1.0.' });
      skewOther(w, q, sk, md); const rV = n4(sk.scfV);
      if (!ext) { otherFinal(w, md, ['g_{M,1}r_{M}', `${n4(bx.mom1)}(${rM})`], ['g_{M,2}r_{M}', `${n4(bx.mom2)}(${rM})`], ['g_{V,1}r_{V}', `${n4(bx.shr1)}(${rV})`], ['g_{V,2}r_{V}', `${n4(bx.shr2)}(${rV})`]); return md; }
      deStep(null, md.de > 2 + 1e-9 ? 'd_e > 2.0 ft: outside the range of applicability; the e-equations are extrapolated (not limited).' : '');
      w.add({ id: 'eM1', label: 'Correction factor e for moment, one lane', sym: 'e', eq: '1.125 + \\frac{d_{e}}{30} \\ge 1.0', sub: `\\max(1.125 + \\frac{${n2(md.de)}}{30}, 1.0)`, value: md.eM1, unit: '', d: 4, ref: T2d });
      w.add({ id: 'eM2', label: 'Correction factor e for moment, two or more lanes', sym: 'e', eq: '1.04 + \\frac{d_{e}}{25} \\ge 1.0', sub: `\\max(1.04 + \\frac{${n2(md.de)}}{25}, 1.0)`, value: md.eM2, unit: '', d: 4, ref: T2d });
      w.add({ id: 'eV1', label: 'Correction factor e for shear, one lane', sym: 'e', eq: '1.25 + \\frac{d_{e}}{20} \\ge 1.0', sub: `\\max(1.25 + \\frac{${n2(md.de)}}{20}, 1.0)`, value: md.eV1, unit: '', d: 4, ref: T3b });
      w.add({ id: 'eV2', label: 'Correction factor e for shear, two or more lanes', sym: 'e', eq: '1 + \\left(\\frac{d_{e} + \\frac{b}{12} - 2.0}{40}\\right)^{0.5} \\ge 1.0', sub: `1 + \\left(\\frac{${n2(md.de)} + \\frac{${n2(b)}}{12} - 2.0}{40}\\right)^{0.5}`, value: md.eV2, unit: '', d: 4, ref: T3b, note: md.inV > 0 ? '' : 'The term under the root is not positive: e = 1.0.' });
      w.add({ id: 'capV', label: 'Width factor for exterior shear, two or more lanes', sym: '\\frac{48}{b}', eq: '\\le 1.0', sub: `\\min(\\frac{48}{${n2(b)}}, 1.0)`, value: md.capV, unit: '', d: 4, ref: T3b });
      otherFinal(w, md, ['e\\,g_{M,1}r_{M}', `${n4(md.eM1)}(${n4(bx.mom1)})(${rM})`, T2d], ['e\\,g_{M,2}r_{M}', `${n4(md.eM2)}(${n4(bx.mom2)})(${rM})`, T2d],
        ['e\\,g_{V,1}r_{V}', `${n4(md.eV1)}(${n4(bx.shr1)})(${rV})`, T3b], ['\\frac{48}{b}e\\,g_{V,2}r_{V}', `${n4(md.capV)}(${n4(md.eV2)})(${n4(bx.shr2)})(${rV})`, T3b]);
      return md;
    }
    if (q.type === 'bc') {
      const sp = md.sp, frac = `\\frac{${n3(S)}(${n2(d)})}{12.0(${n2(L)})^{2}}`;
      w.add({ id: 'S', label: ext ? 'Beam spacing (the adjacent bay)' : 'Beam spacing (average of the two adjacent bays)', sym: 'S', eq: '', sub: '', value: S, unit: 'ft', d: 3 });
      w.add({ id: 'mom1', label: 'Interior moment equation, one lane loaded', sym: 'g_{M,1}', eq: '\\left(\\frac{S}{3.0}\\right)^{0.35}\\left(\\frac{Sd}{12.0L^{2}}\\right)^{0.25}', sub: `\\left(\\frac{${n3(S)}}{3.0}\\right)^{0.35}\\left(${frac}\\right)^{0.25}`, value: sp.mom1, unit: '', d: 4, ref: T2b });
      w.add({ id: 'mom2', label: 'Interior moment equation, two or more lanes loaded', sym: 'g_{M,2}', eq: '\\left(\\frac{S}{6.3}\\right)^{0.6}\\left(\\frac{Sd}{12.0L^{2}}\\right)^{0.125}', sub: `\\left(\\frac{${n3(S)}}{6.3}\\right)^{0.6}\\left(${frac}\\right)^{0.125}`, value: sp.mom2, unit: '', d: 4, ref: T2b });
      w.add({ id: 'shr1', label: 'Interior shear equation, one lane loaded', sym: 'g_{V,1}', eq: '\\left(\\frac{S}{10}\\right)^{0.6}\\left(\\frac{d}{12.0L}\\right)^{0.1}', sub: `\\left(\\frac{${n3(S)}}{10}\\right)^{0.6}\\left(\\frac{${n2(d)}}{12.0(${n2(L)})}\\right)^{0.1}`, value: sp.shr1, unit: '', d: 4, ref: T3a });
      w.add({ id: 'shr2', label: 'Interior shear equation, two or more lanes loaded', sym: 'g_{V,2}', eq: '\\left(\\frac{S}{7.4}\\right)^{0.8}\\left(\\frac{d}{12.0L}\\right)^{0.1}', sub: `\\left(\\frac{${n3(S)}}{7.4}\\right)^{0.8}\\left(\\frac{${n2(d)}}{12.0(${n2(L)})}\\right)^{0.1}`, value: sp.shr2, unit: '', d: 4, ref: T3a,
        note: md.tooWide ? 'S > 18 ft: the equations do not apply; the lever rule is used (shown for reference).' : '' });
      skewOther(w, q, sk, md); const fV = n4(md.fV);
      if (!ext) {
        if (md.tooWide) { const lv = md.lvUsed || {}; lever(w, 'lev1', withC(q, geo, j, lv.lv1), 'one lane'); lever(w, 'lev2', withC(q, geo, j, lv.lv2), 'two or more lanes, the governing number of trucks');
          const a = lv.lv1 ? lv.lv1.df : 0, b = lv.lv2 ? lv.lv2.df : 0, TL = `${ED} Table 4.6.2.2.2b-1 (S > 18 ft: lever rule)`;
          otherFinal(w, md, ['g_{1}r_{M}', `${n4(a)}(${rM})`, TL], ['g_{2}r_{M}', `${n4(b)}(${rM})`, TL], ['g_{1}r_{V}', `${n4(a)}(${fV})`, TL], ['g_{2}r_{V}', `${n4(b)}(${fV})`, TL]); return md; }
        otherFinal(w, md, ['g_{M,1}r_{M}', `${n4(sp.mom1)}(${rM})`], ['g_{M,2}r_{M}', `${n4(sp.mom2)}(${rM})`], ['g_{V,1}r_{V}', `${n4(sp.shr1)}(${fV})`], ['g_{V,2}r_{V}', `${n4(sp.shr2)}(${fV})`]); return md;
      }
      const l1 = lever1();
      deStep(0, (md.side === 'L' ? geo.deL : geo.deR) > 4.5 + 1e-9 ? 'd_e > 4.5 ft: outside the range of applicability; the e-equations are extrapolated (not limited).' : '');
      w.add({ id: 'eM', label: 'Correction factor e for moment', sym: 'e', eq: '0.97 + \\frac{d_{e}}{28.5}', sub: `0.97 + \\frac{${n2(md.de)}}{28.5}`, value: md.eM, unit: '', d: 4, ref: T2d });
      w.add({ id: 'eV', label: 'Correction factor e for shear', sym: 'e', eq: '0.80 + \\frac{d_{e}}{10}', sub: `0.80 + \\frac{${n2(md.de)}}{10}`, value: md.eV, unit: '', d: 4, ref: T3b });
      if (md.tooWide) { w.add({ id: 'mE', label: 'Moment and shear, two or more lanes (S > 18 ft: lever rule, the governing of 2 … N_L trucks)', sym: 'g_{2}', eq: '', sub: '', value: md.mE, unit: '', d: 4, ref: T2b }); }
      else { w.add({ id: 'mE', label: 'Moment, two or more lanes: e × interior equation', sym: 'g_{M,2}', eq: 'e\\,g_{M,2,int}', sub: `${n4(md.eM)}(${n4(sp.mom2)})`, value: md.mE, unit: '', d: 4, ref: T2d });
        w.add({ id: 'vE', label: 'Shear, two or more lanes: e × interior equation', sym: 'g_{V,2}', eq: 'e\\,g_{V,2,int}', sub: `${n4(md.eV)}(${n4(sp.shr2)})`, value: md.vE, unit: '', d: 4, ref: T3b }); }
      otherFinal(w, md, ['g_{lever,1}r_{M}', `${n4(l1)}(${rM})`, T2d], ['g_{M,2}r_{M}', `${n4(md.mE)}(${rM})`, T2d], ['g_{lever,1}r_{V}', `${n4(l1)}(${fV})`, T3b], ['g_{V,2}r_{V}', `${n4(md.vE)}(${fV})`, T3b]);
      return md;
    }
    if (q.type === 'd') {
      const mc = md.mc, dl = `\\left(\\frac{${n2(d)}}{12.0(${n2(L)})}\\right)^{0.1}`;
      w.add({ id: 'S', label: ext ? 'Web spacing (the adjacent cell)' : 'Web spacing (average of the two adjacent cells)', sym: 'S', eq: '', sub: '', value: S, unit: 'ft', d: 3 });
      w.add({ id: 'Nc', label: 'Number of cells (webs − 1), as used in the moment equations (not more than 8)', sym: 'N_{c}', eq: '\\min(N_{b} - 1, 8)', sub: `\\min(${q.Nb} - 1, 8)`, value: mc.NcEq, unit: '', d: 0, ref: T2b });
      w.add({ id: 'mom1', label: 'Interior moment equation, one lane loaded', sym: 'g_{M,1}', eq: '\\left(1.75 + \\frac{S}{3.6}\\right)\\left(\\frac{1}{L}\\right)^{0.35}\\left(\\frac{1}{N_{c}}\\right)^{0.45}', sub: `\\left(1.75 + \\frac{${n3(S)}}{3.6}\\right)\\left(\\frac{1}{${n2(L)}}\\right)^{0.35}\\left(\\frac{1}{${mc.NcEq}}\\right)^{0.45}`, value: mc.mom1, unit: '', d: 4, ref: T2b });
      w.add({ id: 'mom2', label: 'Interior moment equation, two or more lanes loaded', sym: 'g_{M,2}', eq: '\\left(\\frac{13}{N_{c}}\\right)^{0.3}\\left(\\frac{S}{5.8}\\right)\\left(\\frac{1}{L}\\right)^{0.25}', sub: `\\left(\\frac{13}{${mc.NcEq}}\\right)^{0.3}\\left(\\frac{${n3(S)}}{5.8}\\right)\\left(\\frac{1}{${n2(L)}}\\right)^{0.25}`, value: mc.mom2, unit: '', d: 4, ref: T2b });
      w.add({ id: 'shr1', label: 'Interior shear equation, one lane loaded', sym: 'g_{V,1}', eq: '\\left(\\frac{S}{9.5}\\right)^{0.6}\\left(\\frac{d}{12.0L}\\right)^{0.1}', sub: `\\left(\\frac{${n3(S)}}{9.5}\\right)^{0.6}${dl}`, value: mc.shr1, unit: '', d: 4, ref: T3a });
      w.add({ id: 'shr2', label: 'Interior shear equation, two or more lanes loaded', sym: 'g_{V,2}', eq: '\\left(\\frac{S}{7.3}\\right)^{0.9}\\left(\\frac{d}{12.0L}\\right)^{0.1}', sub: `\\left(\\frac{${n3(S)}}{7.3}\\right)^{0.9}${dl}`, value: mc.shr2, unit: '', d: 4, ref: T3a });
      skewOther(w, q, sk, md); const fV = n4(md.fV);
      if (!ext) { otherFinal(w, md, ['g_{M,1}r_{M}', `${n4(mc.mom1)}(${rM})`], ['g_{M,2}r_{M}', `${n4(mc.mom2)}(${rM})`], ['g_{V,1}r_{V}', `${n4(mc.shr1)}(${fV})`], ['g_{V,2}r_{V}', `${n4(mc.shr2)}(${fV})`]); return md; }
      const O = md.side === 'L' ? q.OL : q.OR;
      w.add({ id: 'We', label: 'Exterior web width parameter: half the web spacing plus the overhang, not more than S', sym: 'W_{e}', eq: '\\min\\left(o + \\frac{S}{2}, S\\right)', sub: `\\min\\left(${n2(O)} + \\frac{${n3(S)}}{2}, ${n3(S)}\\right)`, value: md.We, unit: 'ft', d: 3, ref: T2d });
      w.add({ id: 'gWe', label: 'Exterior moment, any number of lanes', sym: 'g_{M}', eq: '\\frac{W_{e}}{14}', sub: `\\frac{${n3(md.We)}}{14}`, value: md.gWe, unit: '', d: 4, ref: T2d });
      const l1 = lever1();
      deStep(-2, (md.side === 'L' ? geo.deL : geo.deR) > 5 + 1e-9 ? 'd_e > 5.0 ft: outside the range of applicability; the e-equation is extrapolated (not limited).' : '');
      w.add({ id: 'eV', label: 'Correction factor e for shear', sym: 'e', eq: '0.64 + \\frac{d_{e}}{12.5}', sub: `0.64 + \\frac{${n2(md.de)}}{12.5}`, value: md.eV, unit: '', d: 4, ref: T3b });
      w.add({ id: 'vE', label: 'Shear, two or more lanes: e × interior equation', sym: 'g_{V,2}', eq: 'e\\,g_{V,2,int}', sub: `${n4(md.eV)}(${n4(mc.shr2)})`, value: md.vE, unit: '', d: 4, ref: T3b });
      otherFinal(w, md, ['\\frac{W_{e}}{14}r_{M}', `${n4(md.gWe)}(${rM})`, T2d], ['\\frac{W_{e}}{14}r_{M}', `${n4(md.gWe)}(${rM})`, T2d], ['g_{lever,1}r_{V}', `${n4(l1)}(${fV})`, T3b], ['g_{V,2}r_{V}', `${n4(md.vE)}(${fV})`, T3b]);
      return md;
    }
    // slab, Art. 4.6.2.3
    const r = md.r, L1 = Math.min(L, 60), W1 = Math.min(geo.roadway, 30), W1m = Math.min(geo.roadway, 60), FR = `${ED} Art. 3.6.1.4.3b, C3.6.1.1.2`;
    w.add({ id: 'Es', label: 'Equivalent strip width, one lane loaded (L_1 = min(L, 60 ft), W_1 = min(w, 30 ft))', sym: 'E', eq: '10 + 5\\sqrt{L_{1}W_{1}}', sub: `10 + 5\\sqrt{${n2(L1)}(${n2(W1)})}`, value: r.Es, unit: 'in', d: 1, ref: `${ED} Eq. 4.6.2.3-1` });
    w.add({ id: 'Em', label: 'Equivalent strip width, two or more lanes loaded (W_1 = min(w, 60 ft))', sym: 'E', eq: '\\min\\left(84 + 1.44\\sqrt{L_{1}W_{1}}, \\frac{12w}{N_{L}}\\right)', sub: `\\min\\left(84 + 1.44\\sqrt{${n2(L1)}(${n2(W1m)})}, \\frac{12(${n2(geo.roadway)})}{${geo.NL}}\\right)`, value: r.Em, unit: 'in', d: 1, ref: `${ED} Eq. 4.6.2.3-2`,
      note: 'w is the clear roadway width (as the engine takes it).' });
    w.add({ id: 'gM1', label: 'Distribution factor, one lane, per 1-ft strip', sym: 'g_{1}', eq: '\\frac{12}{E}', sub: `\\frac{12}{${n2(r.Es)}}`, value: r.dS, unit: '', d: 4, ref: `${ED} Art. 4.6.2.3` });
    w.add({ id: 'gM2', label: 'Distribution factor, two or more lanes, per 1-ft strip', sym: 'g_{2}', eq: '\\frac{12}{E}', sub: `\\frac{12}{${n2(r.Em)}}`, value: r.dM, unit: '', d: 4, ref: `${ED} Art. 4.6.2.3` });
    w.add({ id: 'gM', label: `${md.label}: distribution factor per 1-ft strip, moment and shear (${md.method})`, sym: 'g', eq: '\\max(g_{1}, g_{2})', sub: `\\max(${n4(r.dS)}, ${n4(r.dM)})`, value: md.gM, unit: '', d: 4, ref: `${ED} Art. 4.6.2.3` });
    w.add({ id: 'fatM', label: `${md.label}: fatigue factor (one lane, multiple presence 1.2 removed)`, sym: 'g_{fat}', eq: '\\frac{g_{1}}{1.2}', sub: `\\frac{${n4(r.dS)}}{1.2}`, value: md.fatM, unit: '', d: 4, ref: FR });
    return md;
  }
  return { ED, geometry, skew, emp, lever, rigid, member, withC, other };
})();

window.SharedLLDF={multiplePresence,RANGES,BEAM_SLAB,BOX,BOXR,SPREADR,CELLR,FAMILY,KG_SIMPLE,designL,spreadDF,multicellDF,geometry,
  memberType,memberSpacing,girderU,skewFactors,boxDF,empiricalInterior,leverContribution,truckGap,leverConfig,leverAll,leverMulti,
  rigidMethod,memberDF,inputErrors,computeBridge,momentSkewNoReduction,momentSkewNoReductionPier,steps:STEPS};
})();
