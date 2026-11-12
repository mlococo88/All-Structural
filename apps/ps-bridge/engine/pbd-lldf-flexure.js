/* apps/ps-bridge/engine/pbd-lldf-flexure.js — live-load distribution factors distFactors (4.6.2.2), flexure (5.6.3).
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 3161-3295 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): distFactors, flexure.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
function distFactors(inp,g,cp){ // Type (k) I-girder, or NEXT double-tee; LRFD 4.6.2.2
  const S=inp.S, L=inp.L, ts=inp.ts, ld=inp.loads;
  // --- NEXT F double-tee: cross-section type (i)/(j) per LRFD T.4.6.2.2.1-1 (open multi-stem) ---
  if(g.isNext){
    const Wd=g.btf;                                  // deck/beam width, in
    const Nb=Math.max(2,Math.round(+inp.nGirders||4));// number of beams in the bridge
    // For multi-beam decks, distribution may be taken on a per-beam basis using beam width.
    // Use AASHTO type (i) double-tee moment DF (interior), in units of lanes per beam:
    // 1 lane: 0.06+(S/14)^0.4 ... but for spread/adjacent tees the deck-width formula is used.
    const Sf=Wd/12;                                  // beam width, ft (acts as 'S' for tees)
    const th=clamp(+ld.skew||0,0,60), tanT=Math.tan(th*Math.PI/180);
    // Kg term (Table 4.6.2.2.2b-1, types a/e/k and i/j acting as a unit): with a composite CIP
    // topping (ts > 0) Kg = n(I + A·eg²) of the basic beam is available, so the full expression is
    // used, together with the matching skew factors (4.6.2.2.2e c1, 4.6.2.2.3c). With no topping
    // (ts = 0) the "slab" is the integral flange and Kg is not defined here, so the simplified
    // (Kg term = 1) form is kept as before.
    const hasKg=(+ts>0);
    const nEIx=cp.Ecg/Math.max(cp.Ecd,1e-6);
    const egN=hasKg? (g.h+(+inp.th||0)+ts/2)-g.yb : 0;
    const KgN=hasKg? nEIx*(g.I+g.A*egN*egN) : 0;
    const ts3N=hasKg? ts**3 : 1;
    const kgtN=hasKg? Math.pow(KgN/(12*L*ts3N),0.1) : 1;
    const m1=0.06+Math.pow(Sf/14,0.4)*Math.pow(Sf/L,0.3)*kgtN;
    const m2=0.075+Math.pow(Sf/9.5,0.6)*Math.pow(Sf/L,0.2)*kgtN;
    const v1=0.36+Sf/25, v2=0.2+Sf/12-Math.pow(Sf/35,2);
    let skM, skV;
    if(hasKg){
      const c1N=th<30?0:0.25*Math.pow(KgN/(12*L*ts3N),0.25)*Math.pow(Sf/L,0.5);
      skM=1-c1N*Math.pow(tanT,1.5);
      skV=1+0.20*Math.pow(12*L*ts3N/KgN,0.3)*tanT;
    } else {
      skM=th<30?1:1-0.25*Math.pow(tanT,1.5);
      skV=1+0.20*tanT;
    }
    const dfmRaw=Math.max(m1,m2), dfvRaw=Math.max(v1,v2);
    return {Kg:KgN,eg:egN,kgt:kgtN,kgOmitted:!hasKg,m1,m2,v1,v2,skM,skV,th,ext:false,lever:0,eM:0,eV:0,rigid:0,rigidNL:0,
            dfmRaw,dfvRaw,dfm:dfmRaw*skM,dfv:dfvRaw*skV,isNext:true,Sf};
  }
  const nEI=cp.Ecg/cp.Ecd;
  const eg=(g.h+inp.th+ts/2)-g.yb;
  const Kg=nEI*(g.I+g.A*eg*eg);
  const ts3=Math.max(ts**3,1e-6);                    // guard ts=0
  const kgt=Math.pow(Kg/(12*L*ts3),0.1);
  const m1=0.06+Math.pow(S/14,0.4)*Math.pow(S/L,0.3)*kgt;
  const m2=0.075+Math.pow(S/9.5,0.6)*Math.pow(S/L,0.2)*kgt;
  const v1=0.36+S/25;
  const v2=0.2+S/12-Math.pow(S/35,2);
  // skew corrections (4.6.2.2.2e / 4.6.2.2.3c)
  const th=clamp(+ld.skew||0,0,60), tanT=Math.tan(th*Math.PI/180);
  const c1=th<30?0:0.25*Math.pow(Kg/(12*L*ts3),0.25)*Math.pow(S/L,0.5);
  const skM=1-c1*Math.pow(tanT,1.5);
  const skV=1+0.20*Math.pow(12*L*ts3/Kg,0.3)*tanT;
  const ext=ld.pos==='exterior';
  let lever=0,eM=0,eV=0,rigid=0,rigidNL=0,rigid1=0;
  let dfmRaw=Math.max(m1,m2), dfvRaw=Math.max(v1,v2);
  if(ext){
    const de=+ld.de||0;
    // one loaded lane — lever rule, wheels 2 ft & 8 ft inboard of barrier face, m = 1.2
    let R=0; [de-2,de-8].forEach(x=>{ if(x>-S) R+=0.5*(S+x)/S; });
    lever=1.2*R;
    eM=0.77+de/9.1; eV=0.6+de/10;             // 2+ lanes: e × interior DF
    // rigid cross-section special analysis (C4.6.2.2.2d)
    const Nb=Math.max(2,Math.round(+inp.nGirders||2));
    const NLmax=clamp(Math.round(+ld.NL||1),1,4);
    const Xext=(Nb-1)*S/2;
    let sumX2=0; for(let i=0;i<Nb;i++){const xi=-Xext+i*S; sumX2+=xi*xi;}
    const mpf=[1.2,1.0,0.85,0.65];
    for(let NL=1;NL<=NLmax;NL++){
      let sumE=0; for(let j=0;j<NL;j++) sumE+=Xext+de-5-12*j;
      const rr=mpf[NL-1]*(NL/Nb+Xext*sumE/sumX2);
      if(NL===1) rigid1=rr;                     // one loaded lane (m = 1.2) — for the fatigue DF
      if(rr>rigid){rigid=rr;rigidNL=NL;}
    }
    dfmRaw=Math.max(eM*m2, lever, rigid);
    dfvRaw=Math.max(eV*v2, lever, rigid);
  }
  return {Kg,eg,m1,m2,v1,v2,skM,skV,th,ext,lever,eM,eV,rigid,rigidNL,rigid1,dfmRaw,dfvRaw,
          dfm:dfmRaw*skM, dfv:dfvRaw*skV};
}

/* ================= FLEXURE (LRFD 5.6.3) ================= */
function flexure(inp,g,cp,ss,x,Pe_fpe){
  const a_=ss.at(x);
  const Aps=a_.Aps;
  // No effective strand at this section (none defined, or all still inside transfer/debond): zero
  // capacity, but return every field so dv, the MCFT shear and the tables stay finite (was
  // {phiMn:0,phi:1} only → dv = NaN → NaN everywhere downstream).
  if(Aps<=0){ const fcd0=(+inp.ts)>0? inp.mat.fcd : inp.mat.fc;
    return {c:0,a:0,fps:0,fpsFull:0,devGov:false,dp:cp.hc,dpFull:cp.hc,dt:cp.hc,et:0.005,phi:1,rect:true,
            Mn:0,phiMn:0,b1:clamp(0.85-0.05*(fcd0-4),0.65,0.85)}; }
  const fpu=+inp.str.fpu, k=inp.str.lowlax?0.28:0.38;
  // compression material & flange: composite topping if present, else the girder's own top flange
  const hasTop=(+inp.ts)>0;
  const fcd = hasTop? inp.mat.fcd : inp.mat.fc;     // topping f'c, or girder f'c if no topping
  const b1=clamp(0.85-0.05*(fcd-4),0.65,0.85);
  const dp=cp.hc-a_.cgs;
  // flange thickness available in compression: topping + (haunch for I-girders); for NEXT no-topping use the integral flange thickness
  const hf = hasTop? (+inp.ts + (g.isNext?0:+inp.th)) : (g.isNext? g.next.ft : g.d[0]);
  const b=cp.beff, bwT=g.isNext? g.bw : g.btf;       // flange width (b) vs web/stem width below flange
  let c=Aps*fpu/(0.85*fcd*b1*b+k*Aps*fpu/dp), rect=true, Mn;
  if(b1*c>hf){ rect=false;
    c=(Aps*fpu-0.85*fcd*(b-bwT)*hf)/(0.85*fcd*b1*bwT+k*Aps*fpu/dp);
  }
  let a=b1*c, fpsFull=fpu*(1-k*c/dp), dpU=dp;
  if(rect) Mn=Aps*fpsFull*(dp-a/2);
  else Mn=Aps*fpsFull*(dp-a/2)+0.85*fcd*(b-bwT)*hf*(a/2-hf/2);
  /* Strand development, LRFD 5.9.4.3.2. Everything above assumes the strand can
     actually reach fps, which is only true once enough bonded length lies behind
     the section -- ld runs to roughly 13 ft on a 0.6" strand, so at the tenth
     point of a short span the full-development answer is fiction. ss.devForce
     sums A*f_dev over the bond groups and the harped strands; it already carries
     the transfer-length ramp, so it REPLACES the eff-ramped Aps rather than
     multiplying it. Where the available tension falls short the section is
     simply under-reinforced: hold T at what the strand can deliver and re-solve
     the compression block from T = C. At midspan devForce returns exactly
     Aps*fps and nothing below this line changes the answer. */
  const fpeUse=+Pe_fpe||0;
  const dev=(fpeUse>0&&ss.devForce)? ss.devForce(x,fpsFull,fpeUse) : null;
  let devGov=false, fps=fpsFull;
  if(dev && dev.T < Aps*fpsFull-1e-6){
    devGov=true;
    const T=Math.max(dev.T,0);
    fps = Aps>0? T/Aps : 0;                    // section-average developed stress
    dpU = cp.hc-(T>0? dev.cgs : a_.cgs);
    rect=true; a=T/(0.85*fcd*b);
    if(a>hf){ rect=false; a=Math.max((T-0.85*fcd*(b-bwT)*hf)/(0.85*fcd*bwT),0); }
    c=a/b1;
    Mn=Math.max(rect? T*(dpU-a/2) : T*(dpU-a/2)+0.85*fcd*(b-bwT)*hf*(a/2-hf/2), 0);
  }
  const dt=cp.hc-ss.yLow;
  const et=0.003*(dt/Math.max(c,1e-6)-1);
  const phi=clamp(0.75+0.25*(et-0.002)/0.003,0.75,1.0);
  return {c,a,fps,fpsFull,devGov,dp:dpU,dpFull:dp,dt,et,phi,rect,Mn,phiMn:phi*Mn,b1};
}

