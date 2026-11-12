/* apps/ps-bridge/engine/pbd-losses-ll.js — prestress losses (5.9.3), HL-93 simple-span live load hl93, negMomentHL93.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 2872-2965 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): losses, hl93, negMomentHL93.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ================= PRESTRESS LOSSES (LRFD 5.9.3) ================= */
function losses(inp,g,cp,ss,Mg_mid){ // Mg_mid kip-in
  const m=inp.mat, s=inp.str;
  const fpu=+s.fpu, fpy=s.lowlax?0.9*fpu:0.85*fpu;
  const fpbt=s.jack*fpu;
  const Eci=Ec(m.fci,m.wc), Ecf=cp.Ecg, Ep=+s.Ep;
  const Aps=ss.Aps, em=ss.eMid, Ag=g.A, Ig=g.I;
  // Elastic shortening — closed form C5.9.3.2.3a-1
  const dfES=(Aps*fpbt*(Ig+em*em*Ag)-em*Mg_mid*Ag)/(Aps*(Ig+em*em*Ag)+Ag*Ig*Eci/Ep);
  const Pi=Aps*(fpbt-dfES);
  const fcgp=Pi/Ag+Pi*em*em/Ig-Mg_mid*em/Ig;
  const fpt=fpbt-dfES;
  // ---- Approximate method 5.9.3.3 ----
  const gh=1.7-0.01*m.H, gst=5/(1+m.fci);
  const dfR_apx=s.lowlax?2.4:10.0;
  const apx={SH_CR:10*(fpbt*Aps/Ag)*gh*gst+12*gh*gst, R:dfR_apx};
  apx.total=apx.SH_CR+apx.R;
  // ---- Refined method 5.9.3.4 ----
  const ks=Math.max(1.45-0.13*m.VS,1.0);
  const khs=2.00-0.014*m.H, khc=1.56-0.008*m.H, kf=5/(1+m.fci);
  const ktd=t=>ktdAASHTO(t,m.fci);                  // Eq. 5.4.2.3.2-5
  const eShID=ks*khs*kf*ktd(m.td-m.ti)*0.48e-3;
  const eShIF=ks*khs*kf*ktd(m.tfin-m.ti)*0.48e-3;
  const psi=(t,ti)=>1.9*ks*khc*kf*ktd(t-ti)*Math.pow(ti,-0.118);
  const psiBID=psi(m.td,m.ti), psiBIF=psi(m.tfin,m.ti), psiBDF=1.9*ks*khc*kf*ktd(m.tfin-m.td)*Math.pow(m.td,-0.118);
  const epg=em;
  const Kid=1/(1+(Ep/Eci)*(Aps/Ag)*(1+Ag*epg*epg/Ig)*(1+0.7*psiBIF));
  const dfSR=eShID*Ep*Kid;
  const dfCR=(Ep/Eci)*fcgp*psiBID*Kid;
  const dfR1=s.lowlax? Math.max((fpt/30)*(fpt/fpy-0.55),0) : Math.max((fpt/7)*(fpt/fpy-0.55),0);
  const epc=cp.ybc-ss.cgsMid;
  const Kdf=1/(1+(Ep/Eci)*(Aps/cp.Ac)*(1+cp.Ac*epc*epc/cp.Ic)*(1+0.7*psiBIF));
  const eShDF=eShIF-eShID;
  const dfSD=eShDF*Ep*Kdf;
  return {fpbt,fpy,fpt,Eci,Ecf,Ep,dfES,Pi,fcgp,apx,
          ref:{ks,khs,khc,kf,eShID,eShIF,psiBID,psiBIF,psiBDF,Kid,Kdf,dfSR,dfCR,dfR1,dfSD,epc},
          finishRefined(dfcd,dfSSval){ // dfcd: change in conc stress at cgs due to deck+SIDL (negative)
            const dfCD=(Ep/Eci)*fcgp*(psiBIF-psiBID)*Kdf+(Ep/Ecf)*dfcd*psiBDF*Kdf;
            const dfR2=dfR1, dfSS=(dfSSval!==undefined?+dfSSval:+inp.opt.dfpSS)||0;
            const total=dfSR+dfCR+dfR1+dfSD+dfCD+dfR2-dfSS;
            return {dfCD,dfR2,dfSS,total};
          }};
}

/* ================= HL-93 & DISTRIBUTION FACTORS ================= */
function hl93(L){
  const mAtMid=(ax)=>{ // ax=[[x,P],...]
    let R=0; ax.forEach(([x,P])=>{if(x>=0&&x<=L)R+=P*(L-x)/L;});
    let M=R*L/2; ax.forEach(([x,P])=>{if(x>=0&&x<L/2)M-=P*(L/2-x);});
    return M;
  };
  let Mtr=0;
  for(let xm=0;xm<=L;xm+=0.1){
    Mtr=Math.max(Mtr,
      mAtMid([[xm-14,8],[xm,32],[xm+14,32]]),
      mAtMid([[xm-14,32],[xm,32],[xm+14,8]]));
  }
  const Mtd=mAtMid([[L/2,25],[L/2+4,25]]);
  const Mln=0.64*L*L/8;
  const Vtr=Math.max(32+32*(L-14)/L+8*(L-28)/L, 32+32*(L-14)/L); // truck at support
  const Vtd=25+25*(L-4)/L;
  const Vln=0.64*L/2;
  // Fatigue truck (3.6.1.4.1): design truck with constant 30-ft rear axle spacing, single lane, no lane load
  let Mfat=0;
  for(let xm=-30;xm<=L+30;xm+=0.25){
    Mfat=Math.max(Mfat,
      mAtMid([[xm,8],[xm+14,32],[xm+44,32]]),
      mAtMid([[xm,32],[xm+30,32],[xm+44,8]]));          // reversed: 32 –30 ft– 32 –14 ft– 8
  }
  return {Mtr,Mtd,Mln,Vtr,Vtd,Vln,Mfat,
          M:1.33*Math.max(Mtr,Mtd)+Mln, V:1.33*Math.max(Vtr,Vtd)+Vln};
}
function negMomentHL93(L){
  // Two equal continuous spans; influence of pier moment: eta(x) = -x(L^2-x^2)/(4L^2), mirrored
  const eta=x=>{const xi=x<=L?x:2*L-x; return -(xi*(L*L-xi*xi))/(4*L*L);};
  const Mof=ax=>ax.reduce((s,[x,P])=>(x>=0&&x<=2*L)?s+P*eta(x):s,0);
  const trk=(x,rev)=>rev?[[x,32],[x+14,32],[x+28,8]]:[[x,8],[x+14,32],[x+28,32]];
  let M1=0,Mtd=0;
  for(let x=0;x<=2*L;x+=0.5){
    M1=Math.min(M1,Mof(trk(x,false)),Mof(trk(x,true)));
    Mtd=Math.min(Mtd,Mof([[x,25],[x+4,25]]));
  }
  let M2=0; // two trucks, >=50 ft clear between trucks (3.6.1.3.1)
  for(let x1=0;x1<=2*L-106;x1+=1)
    for(let x2=x1+78;x2<=2*L-28;x2+=2)
      for(const o1 of [false,true]) for(const o2 of [false,true])
        M2=Math.min(M2,Mof(trk(x1,o1))+Mof(trk(x2,o2)));
  const Mln=-0.64*L*L/8;                       // lane on both spans
  const case1=1.33*Math.min(M1,Mtd)+Mln;
  const case2=0.9*(1.33*M2+Mln);
  return {M1:-M1,Mtd:-Mtd,M2:-M2,Mln:-Mln,
          MLL:-Math.min(case1,case2), gov:case2<case1?'2 trucks, 0.9 factor':'single truck/tandem'};
}

