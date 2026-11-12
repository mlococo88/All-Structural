/* apps/ps-bridge/engine/pbd-strands.js — strand geometry strandSys (rows, debonding, draped strands), tensionSideArea.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 2774-2871 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): strandSys, tensionSideArea.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ================= STRAND GEOMETRY ================= */
function strandSys(inp,g){
  const st=STRANDS[inp.str.size];
  // Each row: n total strands, nd of them debonded (sheathed) for length dbnd from each end.
  // Expand into bond-groups: {n, y, dbnd} where dbnd=0 for the bonded remainder.
  const rows=inp.rows.filter(r=>+r.n>0).map(r=>({n:+r.n,y:+r.y,dbnd:+r.dbnd||0,nd:Math.min(+r.nd||0,+r.n)}));
  const groups=[];
  rows.forEach(r=>{
    const nd=r.dbnd>0? r.nd : 0;          // debonding only meaningful with a length
    if(nd>0) groups.push({n:nd, y:r.y, dbnd:r.dbnd});
    if(r.n-nd>0) groups.push({n:r.n-nd, y:r.y, dbnd:0});
  });
  const hp=inp.harp, nh=+hp.n||0;
  const lt=60*st.db; // transfer length, in
  const Lf=inp.L;
  const eff=(xft,dbnd)=>clamp(((Math.min(xft,Lf-xft)-dbnd)*12)/lt,0,1);
  const yHarp=(xft)=>{
    const a=hp.frac*Lf, xm=Math.min(xft,Lf-xft);
    return xm>=a? +hp.yMid : (+hp.yEnd)+((+hp.yMid)-(+hp.yEnd))*(xm/a);
  };
  function at(xft){
    let N=0,Ny=0,Neff=0;
    groups.forEach(gp=>{const e=eff(xft,gp.dbnd);Neff+=gp.n*e;Ny+=gp.n*e*gp.y;N+=gp.n;});
    if(nh>0){const e=eff(xft,0);Neff+=nh*e;Ny+=nh*e*yHarp(xft);N+=nh;}
    const cgs=Neff>0?Ny/Neff:0;
    return {Aps:Neff*st.Ab, cgs, e:g.yb-cgs, Neff, Ntot:N};
  }
  const Nbond=rows.reduce((s,r)=>s+r.n,0);   // total straight (bonded + debonded) strands
  const Ntot=Nbond+nh;
  const Aps=Ntot*st.Ab;
  const Ndebond=rows.reduce((s,r)=>s+(r.dbnd>0?r.nd:0),0);
  const slope=nh>0? ((+hp.yEnd)-(+hp.yMid))/(hp.frac*Lf*12):0; // for Vp
  const yLow=Math.min(...rows.map(r=>r.y),nh>0?+hp.yMid:1e9);
  // Development length (LRFD 5.9.4.3.2): ld = K(fps - 2/3 fpe) db, K = 1.6 (bonded), 2.0 (debonded)
  // Developed strand stress fps_avail(x) ramps: = fpe over transfer length, then linear to fps over ld.
  // Girder overhang beyond the bearing (ft). The strand free end is this far outside the bearing,
  // so it adds to the bonded length available for development at every section (5.9.4.3.2 / practice).
  const endOh=(+((inp.opt&&inp.opt.endOh)||0))/12;
  const devStress=(xft,fps,fpe,dbnd)=>{
    const K=dbnd>0?2.0:1.6;
    const ld=K*(fps-(2/3)*fpe)*st.db;     // in
    const xb=(Math.min(xft,Lf-xft)+endOh-dbnd)*12; // bonded length from the girder end (incl. overhang), in
    if(xb<=0)return 0;
    if(xb<=lt)return fpe*(xb/lt);          // within transfer length: linear 0 -> fpe
    if(xb>=ld)return fps;                   // fully developed
    return fpe+(fps-fpe)*(xb-lt)/Math.max(ld-lt,1e-6); // linear fpe -> fps
  };
  // Section-average developed stress weighting each bond-group + harped
  const devAvg=(xft,fps,fpe)=>{
    let num=0,den=0;
    groups.forEach(gp=>{num+=gp.n*devStress(xft,fps,fpe,gp.dbnd);den+=gp.n;});
    if(nh>0){num+=nh*devStress(xft,fps,fpe,0);den+=nh;}
    return den>0?num/den:0;
  };
  // Developed strand TENSION at x (kip) and the centroid of that tension, per the
  // same 5.9.4.3.2 ramp. This already carries the transfer-length ramp, so it is
  // used INSTEAD of the eff-ramped Aps that at() returns, never on top of it --
  // multiplying both would square the ramp and count the end regions down twice.
  const devForce=(xft,fps,fpe)=>{
    let T=0,Ty=0;
    groups.forEach(gp=>{const A=gp.n*st.Ab, f=devStress(xft,fps,fpe,gp.dbnd); T+=A*f; Ty+=A*f*gp.y;});
    if(nh>0){const A=nh*st.Ab, f=devStress(xft,fps,fpe,0); T+=A*f; Ty+=A*f*yHarp(xft);}
    return {T, cgs:T>0?Ty/T:0};
  };
  return {st,rows,groups,hp,nh,lt,at,Ntot,Nbond,Ndebond,Aps,slope,yLow,devStress,devAvg,devForce,
          cgsMid:at(Lf/2).cgs, eMid:at(Lf/2).e, eEnd:at(0.001).e,
          AsStraight:Nbond*st.Ab, AsHarp:nh*st.Ab,
          cgsStraight:rows.reduce((s,r)=>s+r.n*r.y,0)/Math.max(1,Nbond)};
}

/* Area of concrete on the flexural tension side of the member -- Act in LRFD
   5.7.3.4.2, the concrete below mid-depth. Only the girder counts: the deck sits
   on the compression side, which is why it is not in here. Computed by clipping
   the half-outline at mid-depth (Sutherland-Hodgman), taking the shoelace area,
   doubling it for the mirrored half, and removing whatever part of each interior
   void falls below the cut. */
function tensionSideArea(g){
  const yc=g.h/2, P=halfPolygon(g), out=[];
  for(let i=0;i<P.length;i++){
    const a=P[i], b=P[(i+1)%P.length], ain=a[1]<=yc, bin=b[1]<=yc;
    if(ain) out.push(a);
    if(ain!==bin){ const t=(yc-a[1])/(b[1]-a[1]); out.push([a[0]+t*(b[0]-a[0]), yc]); }
  }
  if(out.length<3) return 0;
  let sh=0;
  for(let i=0;i<out.length;i++){ const a=out[i], b=out[(i+1)%out.length]; sh+=a[0]*b[1]-b[0]*a[1]; }
  let A=Math.abs(sh/2)*2;
  sectionVoids(g).forEach(v=>{
    if(v.type==='rect'){ const y0=v.y-v.h/2, y1=v.y+v.h/2;
      A-=v.w*Math.max(0,Math.min(y1,yc)-y0);
    } else {                                   // circular segment below the cut
      const r=v.d/2, dy=clamp(yc-v.y,-r,r);
      A-=r*r*Math.acos(-dy/r)+dy*Math.sqrt(Math.max(r*r-dy*dy,0));
    }
  });
  return Math.max(A,0);
}

