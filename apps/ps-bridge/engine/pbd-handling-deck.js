/* apps/ps-bridge/engine/pbd-handling-deck.js — handling (lifting and hauling stability), deck Table A4-1 and the deck strip design.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 2966-3160 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): handlingCalc, approxIy, computeZo, A4_1_X, A4_1, deckTableA4, deckDesignSection, deckCalc.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
/* ===== HANDLING: lifting & hauling stability (PCI / Mast) ===== */
function handlingCalc(inp,g,cp,ss,fpe,fpi,Eci){
  const H=inp.handling, L=inp.L, Lin=L*12, m=inp.mat;
  const w=g.wsw;                              // klf girder self-weight
  // ---- overhang stress check at lift/support points ----
  // simple beam with two symmetric overhangs of length a: moments at support (-) and midspan (+)
  const stressAt=(aft)=>{
    const a=aft, Ls=L-2*a;                    // span between pick points (ft)
    const Msup=-w*a*a/2*12;                    // k-in (cantilever at pick)
    const Mmid=(w*Ls*Ls/8 - w*a*a/2)*12;       // k-in midspan
    const Pe=ss.at(L/2).Aps*fpi, e=ss.eMid;    // at release use fpi
    const PeE=ss.at(aft).Aps*fpi, eE=ss.at(aft).e;
    // top/bottom fiber at midspan (sagging) and at pick (hogging)
    const fMidTop=Pe/g.A-Pe*e/g.St+Mmid/g.St;
    const fMidBot=Pe/g.A+Pe*e/g.Sb-Mmid/g.Sb;
    const fSupTop=PeE/g.A-PeE*eE/g.St+Msup/g.St;
    const fSupBot=PeE/g.A+PeE*eE/g.Sb-Msup/g.Sb;
    return {a,Ls,Msup:Msup/12,Mmid:Mmid/12,fMidTop,fMidBot,fSupTop,fSupBot};
  };
  const limC=relCfacOf(inp)*m.fci, limT=0.24*Math.sqrt(m.fci); // release-stage limits, bonded reinf (compression factor: opt.relCfac, default 0.65)
  // ---- lateral stability (Mast) ----
  const Ec=Eci, Iy=approxIy(g);
  const a=H.aLift*12, l1=Lin-2*a;               // pick spacing (in)
  const zo=computeZo(w/12,l1,a,Ec,Iy);          // lateral CG deflection, in
  const ei=H.ei;                                // initial CG eccentricity (sweep), in
  const yLift=g.yt;                             // roll axis above CG (lift loops near top)
  const FScrLift=yLift/(zo+ei);                 // simplified FS against cracking
  // hauling: roll center below, superelevation/road slope
  const ah=H.aHaul*12, l2=Lin-2*ah;
  const zoH=computeZo(w/12,l2,ah,Ec,Iy);
  const yrH=H.hr+g.yb;                           // CG height above roll center, in
  const alpha=H.theta_i;                         // road cross slope, rad
  const FScrHaul=yrH/(zoH+ei+yrH*alpha);
  return {w,limC,limT,Iy,
          lift:stressAt(H.aLift), haul:stressAt(H.aHaul),
          zo,zoH,ei,FScrLift,FScrHaul,
          aLift:H.aLift,aHaul:H.aHaul};
}
function approxIy(g){
  // weak-axis inertia of I-shape: sum of flange & web rectangles about vertical centroid
  const [ttf,ttf2,tbf,tbf2]=g.d;
  const tf=ttf+ttf2, bf=tbf+tbf2, web=g.h-tf-bf;
  const Itf=tf*Math.pow(g.btf,3)/12, Ibf=bf*Math.pow(g.bbf,3)/12, Iw=web*Math.pow(g.bw,3)/12;
  return Itf+Ibf+Iw;
}
function computeZo(w_in,l,a,E,Iy){
  // Mast lateral deflection of CG for beam with overhangs a, span l (all in inches, w in kip/in)
  // zo = w/(E*Iy) * [ l^5/120 - a^2 l^3/12 + a^4 l/4 + 3a^5/20 ] / (l + 2a)  (PCI/Mast form)
  const Lt=l+2*a;
  const num = Math.pow(l,5)/120 - a*a*Math.pow(l,3)/12 + Math.pow(a,4)*l/4 + 3*Math.pow(a,5)/20;
  return w_in/(E*Iy) * num / Lt;
}

/* ===== AASHTO LRFD Table A4-1 — maximum live-load moments per unit width of deck =====
   Values are k-ft/ft. The published table ALREADY includes the multiple presence factors
   and the 33% dynamic load allowance, so these ARE the unfactored LL+IM demands on the
   transverse strip — IM must NOT be applied a second time.
   Rows: girder spacing S = 4'-0" through 15'-0" in 3-in steps.
   Columns: S, then +M, then −M at a design section 0/3/6/9/12/18/24 in from the girder CL.
   Interpolation on S and on the design-section distance is permitted (C4.6.2.1.6). */
const A4_1_X=[0,3,6,9,12,18,24];
const A4_1=[
 [4.00,4.68, 2.68, 2.07, 1.74, 1.60, 1.50, 1.34, 1.25],
 [4.25,4.66, 2.73, 2.25, 1.95, 1.74, 1.57, 1.33, 1.20],
 [4.50,4.63, 3.00, 2.58, 2.19, 1.90, 1.65, 1.32, 1.18],
 [4.75,4.64, 3.38, 2.90, 2.43, 2.07, 1.74, 1.29, 1.20],
 [5.00,4.65, 3.74, 3.20, 2.66, 2.24, 1.83, 1.26, 1.12],
 [5.25,4.67, 4.06, 3.47, 2.89, 2.41, 1.95, 1.28, 0.98],
 [5.50,4.71, 4.36, 3.73, 3.11, 2.58, 2.07, 1.30, 0.99],
 [5.75,4.77, 4.63, 3.97, 3.31, 2.73, 2.19, 1.32, 1.02],
 [6.00,4.83, 4.88, 4.19, 3.50, 2.88, 2.31, 1.39, 1.07],
 [6.25,4.91, 5.10, 4.39, 3.68, 3.02, 2.42, 1.45, 1.13],
 [6.50,5.00, 5.31, 4.57, 3.84, 3.15, 2.53, 1.50, 1.20],
 [6.75,5.10, 5.50, 4.74, 3.99, 3.27, 2.64, 1.58, 1.28],
 [7.00,5.21, 5.98, 5.17, 4.36, 3.56, 2.84, 1.63, 1.37],
 [7.25,5.32, 6.13, 5.31, 4.49, 3.68, 2.96, 1.65, 1.51],
 [7.50,5.44, 6.26, 5.43, 4.61, 3.78, 3.15, 1.88, 1.72],
 [7.75,5.56, 6.38, 5.54, 4.71, 3.88, 3.30, 2.21, 1.94],
 [8.00,5.69, 6.48, 5.65, 4.81, 3.98, 3.43, 2.49, 2.16],
 [8.25,5.83, 6.58, 5.74, 4.90, 4.06, 3.53, 2.74, 2.37],
 [8.50,5.99, 6.66, 5.82, 4.98, 4.14, 3.61, 2.96, 2.58],
 [8.75,6.14, 6.74, 5.90, 5.06, 4.22, 3.67, 3.15, 2.79],
 [9.00,6.29, 6.81, 5.97, 5.13, 4.28, 3.71, 3.31, 3.00],
 [9.25,6.44, 6.87, 6.03, 5.19, 4.40, 3.82, 3.47, 3.20],
 [9.50,6.59, 7.15, 6.31, 5.46, 4.66, 4.04, 3.68, 3.39],
 [9.75,6.74, 7.51, 6.65, 5.80, 4.94, 4.21, 3.89, 3.58],
 [10.00,6.89, 7.85, 6.99, 6.13, 5.26, 4.41, 4.09, 3.77],
 [10.25,7.03, 8.19, 7.32, 6.45, 5.58, 4.71, 4.29, 3.96],
 [10.50,7.17, 8.52, 7.64, 6.77, 5.89, 5.02, 4.48, 4.15],
 [10.75,7.32, 8.83, 7.95, 7.08, 6.20, 5.32, 4.68, 4.34],
 [11.00,7.46, 9.14, 8.26, 7.38, 6.50, 5.62, 4.86, 4.52],
 [11.25,7.60, 9.44, 8.56, 7.68, 6.80, 5.91, 5.04, 4.70],
 [11.50,7.74, 9.72, 8.84, 7.96, 7.08, 6.20, 5.22, 4.87],
 [11.75,7.88, 10.01, 9.12, 8.24, 7.36, 6.47, 5.40, 5.05],
 [12.00,8.01, 10.28, 9.40, 8.51, 7.63, 6.74, 5.56, 5.21],
 [12.25,8.15, 10.55, 9.67, 8.78, 7.90, 7.02, 5.75, 5.38],
 [12.50,8.28, 10.81, 9.93, 9.04, 8.16, 7.28, 5.97, 5.54],
 [12.75,8.41, 11.06, 10.18, 9.30, 8.42, 7.54, 6.18, 5.70],
 [13.00,8.54, 11.31, 10.43, 9.55, 8.67, 7.79, 6.38, 5.86],
 [13.25,8.66, 11.55, 10.67, 9.80, 8.92, 8.04, 6.59, 6.01],
 [13.50,8.78, 11.79, 10.91, 10.03, 9.16, 8.28, 6.79, 6.16],
 [13.75,8.90, 12.02, 11.14, 10.27, 9.40, 8.52, 6.99, 6.30],
 [14.00,9.02, 12.24, 11.37, 10.50, 9.63, 8.76, 7.18, 6.45],
 [14.25,9.14, 12.46, 11.59, 10.72, 9.85, 8.99, 7.38, 6.58],
 [14.50,9.25, 12.67, 11.81, 10.94, 10.08, 9.21, 7.57, 6.72],
 [14.75,9.36, 12.88, 12.02, 11.16, 10.30, 9.44, 7.76, 6.86],
 [15.00,9.47, 13.09, 12.23, 11.37, 10.51, 9.65, 7.94, 7.02]];
/* Interpolated Table A4-1 lookup. S in ft, x = design-section distance from girder CL in in.
   Returns the unfactored LL+IM strip moments, plus flags when S falls outside the table. */
function deckTableA4(S,x){
  const Sn=+S||0, Sc=clamp(Sn,4,15), below=Sn<4, above=Sn>15;
  const t=(Sc-4)/0.25;
  const i0=clamp(Math.floor(t),0,A4_1.length-1), i1=Math.min(i0+1,A4_1.length-1), f=t-i0;
  const row=A4_1[i0].map((v,k)=>v+(A4_1[i1][k]-v)*f);
  const xn=+x||0, xc=clamp(xn,0,24);
  let j=0; while(j<A4_1_X.length-2 && xc>A4_1_X[j+1]) j++;
  const gf=(xc-A4_1_X[j])/(A4_1_X[j+1]-A4_1_X[j]);
  const Mneg=row[2+j]+(row[3+j]-row[2+j])*gf;
  return {Mpos:row[1], Mneg, S:Sn, Sused:Sc, x:xn, xUsed:xc,
          below, above, outOfRange:below||above, xClamped:xn>24};
}
/* Location of the design section for negative moment — LRFD 4.6.2.1.6.
   Precast I-shaped / open box with a top flange: b_tf/3 from the CL of the support,
   but not more than 15 in. Closed box (adjacent box / deck beams): face of the support. */
function deckDesignSection(inp,g){
  const b=+((g&&g.btf)||0);
  if(g&&(g.isBox||g.isDeck)) return {x:clamp(b/2,0,24), rule:'closed box → face of support (b/2)'};
  return {x:clamp(Math.min(b/3,15),0,24), rule:'precast I / open box → b_tf/3 ≤ 15 in'};
}

/* ===== DECK DESIGN: transverse (strip method, LRFD 4.6.2.1 / 9.7) ===== */
function deckCalc(inp,g,cp){
  const D=inp.deck, S=inp.S, ts=inp.ts, m=inp.mat;
  const fcd=m.fcd, fy=+D.fyd, wcd=m.wcd, wcdLd=(+m.wcdLoad||+m.wcd);
  const tsLoad = inp.tsSeparate ? (+inp.tsDL||ts) : ts;   // DL-only deck thickness (capacity still uses ts)
  // dead loads on deck (per ft width)
  const wDLslab=tsLoad/12*wcdLd;                  // DC, ksf -> klf per ft strip
  const wDLws=+D.wsFut;                          // DW, future wearing surface, ksf
  // ---- interior-bay dead-load strip moments (continuous slab over the girder line) ----
  const Ls=S;                                    // c/c girder spacing, ft
  const MDC_neg=wDLslab*Ls*Ls/10, MDC_pos=wDLslab*Ls*Ls/11;   // k-ft/ft
  const MDW_neg=wDLws  *Ls*Ls/10, MDW_pos=wDLws  *Ls*Ls/11;
  const MDL_neg=MDC_neg+MDW_neg,  MDL_pos=MDC_pos+MDW_pos;    // combined, for reporting
  // ---- design section for negative moment (4.6.2.1.6) ----
  const dsAuto=deckDesignSection(inp,g);
  const xnegAuto=dsAuto.x;
  const xneg = (D.xnegAuto===false) ? clamp(+D.xneg||0,0,24) : xnegAuto;
  // ---- live load: AASHTO Table A4-1 (already carries the MPFs and the 33% IM) ----
  const A4=deckTableA4(S,xneg);
  const MLL_pos=A4.Mpos, MLL_neg=A4.Mneg;
  // Equivalent-strip widths (T.4.6.2.1.3-1) retained for reference only — the interior-bay
  // live-load demand now comes straight from Table A4-1, not from a wheel on a strip.
  const SWpos=26+6.6*S, SWneg=48+3.0*S;          // in
  // ---- Strength I: DC 1.25, DW 1.50, LL+IM 1.75 ----
  // PBD-E: owner η and HL-93 multiplier (1 and 1 for AASHTO; see computeAll)
  const OLd=(window.PBD&&window.PBD.ownLoads)?window.PBD.ownLoads(inp):{eta:1,mLL:1}, etaD_=OLd.eta, mLLd=OLd.mLL;
  const Mu_pos=etaD_*(1.25*MDC_pos+1.50*MDW_pos+1.75*(mLLd*MLL_pos));
  const Mu_neg=etaD_*(1.25*MDC_neg+1.50*MDW_neg+1.75*(mLLd*MLL_neg));
  // capacity: bottom bars (positive), top bars (negative)
  const cap=(barA,sp,cover,Mu)=>{
    const As=(+sp>0)? barA*12/sp : 0;            // in^2/ft — spacing ≤ 0 is an input error: no steel credited (was ∞)
    const dbar=Math.sqrt(barA*4/Math.PI);        // equivalent bar diameter, in
    const dEff=ts-cover-dbar/2;                  // to bar centroid
    const a=As*fy/(0.85*fcd*12);
    const b1=clamp(0.85-0.05*(fcd-4),0.65,0.85);
    const c=a/b1, et=0.003*(dEff/c-1);
    // resistance factor per 5.5.4.2 (nonprestressed): 0.75 compression-controlled (εt ≤ 0.002)
    // to 0.90 tension-controlled (εt ≥ 0.005) — not assumed tension-controlled.
    const phi=clamp(0.75+0.15*(et-0.002)/0.003, 0.75, 0.9);
    const Mn=As*fy*(dEff-a/2)/12;                // k-ft/ft
    return {As,dbar,dEff,a,c,et,phi,Mn,phiMn:phi*Mn,Mu,dc:Mu/(phi*Mn),ok:Mu<=phi*Mn};
  };
  const pos=cap(+D.barBot,+D.sBot,+D.coverB,Mu_pos);
  const neg=cap(+D.barTop,+D.sTop,+D.coverT,Mu_neg);
  // ---- overhang (LRFD 13 / A13 design case approximations, gravity only here) ----
  const oh=+D.oh;                                 // overhang, girder CL (or web) to slab edge, ft
  const bBar=Math.max(+D.bBar||0,0), bBarF=bBar/12;   // barrier base width, in -> ft
  const Pbar=Math.max(+D.wBar||0,0);              // barrier weight, klf of edge
  // Wheel sits 1.0 ft from the face of the railing (LRFD 3.6.1.3.1 / A13.4);
  // X is its distance to the point of support, and the overhang strip is 45.0 + 10.0X in.
  const Xoh=Math.max(oh-bBarF-1.0,0);             // ft
  const SWoh=45.0+10.0*Xoh;                       // in — T.4.6.2.1.3-1 overhang strip
  const MohDC=wDLslab*oh*oh/2 + Pbar*Math.max(oh-bBarF/2,0);
  const MohDW=wDLws*Math.pow(Math.max(oh-bBarF,0),2)/2;
  const MohDL=MohDC+MohDW;                        // combined, for reporting
  const MohLL=1.33*1.2*16*Xoh/(SWoh/12);          // IM 1.33, MPF 1.20, 16-kip wheel
  const Mu_oh=etaD_*(1.25*MohDC+1.50*MohDW+1.75*(mLLd*Math.max(MohLL,0)));
  const ohCap=cap(+D.barTop,+D.sTop,+D.coverT,Mu_oh);
  // distribution reinforcement (9.7.3.2): % of bottom = 220/sqrt(S) <= 67%
  const distPct=Math.min(220/Math.sqrt(S*12)*0+ 220/Math.sqrt(S),67); // S in ft per legacy; clamp
  return {wDLslab,wDLws,Ls,SWpos,SWneg,MDL_pos,MDL_neg,MLL_pos,MLL_neg,Mu_pos,Mu_neg,
          MDC_pos,MDC_neg,MDW_pos,MDW_neg,A4,xneg,xnegAuto,dsRule:dsAuto.rule,
          pos,neg,oh,bBar,Pbar,Xoh,SWoh,MohDC,MohDW,MohDL,MohLL,Mu_oh,ohCap,distPct,fcd,fy,ts,
          ...((etaD_!==1||mLLd!==1)?{own:{eta:etaD_,mLL:mLLd}}:{})};
}
