/* apps/ps-bridge/engine/pbd-compute.js — computeAll (every check of one girder design), Aps0, psbReportVals.
   MOVED UNCHANGED from the old app (docs/ps-bridge-plan.md §3, PR 2a; engineer decision PS-6): the code below the PBD-VERBATIM line is
   lines 3428-4571 of "Prestressed Bridge Design.html" at commit 8fe8650275b7fc7377fdb87685d3bf0d669a4aa8, byte for byte. Do not edit it here: a change to the
   engine is a later PR of its own (CLAUDE.md §4), made with the slice and this header updated together.
   Classic script, no DOM. Global names it defines, as on the old page (the moved engine keeps its own globals, plan §2.1; a
   planned later cleanup moves them under one namespace): computeAll, Aps0, psbReportVals.
   Tests: tests/engine/psbridge-verbatim.test.mjs (this body = that slice), tests/engine/psbridge-parity.test.mjs (results = the old page's). */
/* ---- PBD-VERBATIM: the code below is the slice named above, byte for byte; do not edit it ---- */
function computeAll(inp){
 try{
  const g=girderGross(inp);
  const cp=compositeProps(inp,g);
  const ss=strandSys(inp,g);
  const L=inp.L, Lin=L*12;
  const fpbt=inp.str.jack*inp.str.fpu;
  // PBD-E: owner load rules (window.PBD.ownLoads): eta = η_D·η_R·η_I on Strength I (1.3.2.1) and the owner's HL-93 design
  // load multiplier mLL on LL+IM at Strength I and Service I / III (RIDOT BDM 3.4.1.2), not on the live load deflection,
  // fatigue or the load rating. AASHTO (and a file without the engine block): eta = mLL = 1, so every expression gives the
  // result it gave before.
  const OL=(window.PBD&&window.PBD.ownLoads)?window.PBD.ownLoads(inp):{owner:'AASHTO',etaD:1,etaR:1,etaI:1,eta:1,mLL:1};
  const eta=OL.eta, mLL=OL.mLL, ownO=OL.owner;

  // input validation warnings (practice-of-construction checks)
  const warns=[];
  // material & geometry sanity
  if(+inp.mat.fci>=+inp.mat.fc)
    warns.push(`Release strength f′ci (${fmt(inp.mat.fci,1)} ksi) ≥ final f′c (${fmt(inp.mat.fc,1)} ksi) — release strength should be below the 28-day strength.`);
  if(+inp.mat.fci<2.5) warns.push(`Release strength f′ci = ${fmt(inp.mat.fci,1)} ksi is unusually low; check the value.`);
  if(+inp.th<0) warns.push(`Haunch height is negative (${fmt(inp.th,2)}″) — set it to 0 or a positive build-up.`);
  if(+inp.ts<0) warns.push(`Deck thickness is negative (${fmt(inp.ts,2)}″).`);
  // Normal-weight concrete only: the app has no concrete density modification factor λ (5.4.2.8), i.e. λ = 1.0
  // in every √f'c term (V_c, f_r, tension limits, interface shear). Normal weight is w_c ≥ 0.135 kcf.
  { const lwG=+inp.mat.wc<0.135, lwD=(+inp.ts>0)&&(+inp.mat.wcd<0.135);
    if(lwG||lwD) warns.push(`Lightweight concrete (${lwG?`girder w_c = ${fmt(+inp.mat.wc,3)} kcf`:''}${lwG&&lwD?', ':''}${lwD?`deck w_cd = ${fmt(+inp.mat.wcd,3)} kcf`:''} < 0.135 kcf): this app is for NORMAL-WEIGHT concrete only. The concrete density modification factor λ (5.4.2.8) is not applied — every √f′c term (V_c, modulus of rupture, tension limits, interface shear) uses λ = 1.0, which is unconservative for lightweight concrete. Check by hand with λ.`); }
  if(!g.isNext&&!g.isBox&&!g.isDeck&&cp.extG&&inp.beffAuto&&!(cp.ohT>0))
    warns.push(`Exterior girder with a deck overhang of 0: the effective flange width and the deck weight use S/2 only (4.6.2.6.1). Enter the overhang (girder CL to deck edge) on the Geometry card.`);
  const noStrands = ss.Ntot<1 || !(ss.Aps>0);
  if(noStrands)
    warns.push(`No prestressing strands defined — the girder is modeled as unstressed. Flexure, shear and stress results are not meaningful; the "Prestressing strands" check fails until at least one strand row (or harped strands) is entered.`);
  { const ys=[...new Set(ss.rows.map(r=>+r.y))].sort((a,b)=>a-b);
    for(let i=1;i<ys.length;i++) if(ys[i]-ys[i-1]<2-1e-9)
      warns.push(`Strand rows at y = ${ys[i-1]}″ and ${ys[i]}″ are closer than the standard 2″ vertical grid.`);
    const maxRow=g.isNext? 2*(Math.floor((g.next.B-4)/2)+1) : (g.isBox||g.isDeck)? Math.floor((g.w-4)/2)+1 : Math.floor((g.bbf-4)/2)+1;
    ss.rows.forEach((r,i)=>{ if(r.n>maxRow)
      warns.push(`Row ${i+1}: ${r.n} strands exceeds ≈${maxRow} that fit ${g.isNext?`two ${fmt(g.next.B,1)}″ stems`:(g.isBox||g.isDeck)?`a ${g.w}″ width`:`a ${g.bbf}″ flange`} on a 2″ grid with 2″ edge cover.`);});
    if(+inp.str.jack>0.751)
      warns.push(`Jacking at ${inp.str.jack}·fpu exceeds the 0.75·fpu limit for low-relaxation strand (Table 5.9.2.2-1).`);
    if(ss.nh>0){
      const Fhd=fpbt*ss.st.Ab*ss.slope;
      if(Fhd>4.0) warns.push(`Hold-down force ≈ ${fmt(Fhd,1)} kip/strand exceeds the ~4 kip typical fabricator limit — flatten the harp or move the harp point.`);
      if(ss.slope>1/6) warns.push(`Harp slope ${fmt(ss.slope,3)} is steeper than ≈1:6 — verify hold-down hardware limits.`);
      if(+ss.hp.yEnd>g.h-2) warns.push(`Harped CG at end (${ss.hp.yEnd}″) is within 2″ of the top of the girder (h = ${g.h}″).`);
      if(+ss.hp.yMid<2) warns.push(`Harped CG at midspan (${ss.hp.yMid}″) is below the standard 2″ minimum from the bottom.`);
    }
    // Debonding (AASHTO LRFD 10th Ed. 5.9.4.3.3). Warnings only: no computed value depends on them.
    // Checked from the strand table: (A) per row ≤ 45% unless the Owner approves more (no limit on the
    // total); (B) terminations per section ≤ 6, or ≤ 4 with 0.7-in. strand or when 10 or fewer strands
    // are debonded; (C) termination sections ≥ 60 d_b apart; (D) symmetry about the vertical CL;
    // (I) single-web flanged sections with > 25% of all strands debonded or b_f/b_w > 4. (G) is checked after ℓ_d below.
    // All debonded strands of a row share one length dbnd, so each distinct dbnd is one termination section.
    if(ss.Ndebond>0){
      const db=ss.st.db;
      ss.rows.forEach((r,i)=>{ if(r.dbnd>0&&r.nd>0){ const pr=100*r.nd/r.n;
        if(pr>45.01) warns.push(`Row ${i+1}: ${r.nd} of ${r.n} debonded (${fmt(pr,0)}%) exceeds the 45% per-row limit of 5.9.4.3.3(A) (permitted only with Owner approval).`);
        if(r.nd%2===1&&r.n%2===0) warns.push(`Row ${i+1}: ${r.nd} of ${r.n} strands debonded — an odd number in a row of an even number of strands cannot be symmetric about the vertical centerline (5.9.4.3.3(D)).`);
        if(r.nd>r.n) warns.push(`Row ${i+1}: debonded count (${r.nd}) exceeds the strands in the row (${r.n}).`);
      }});
      const term={}; ss.rows.forEach(r=>{ if(r.dbnd>0&&r.nd>0) term[r.dbnd]=(term[r.dbnd]||0)+r.nd; });
      const nTermMax=(db>=0.7-1e-9||ss.Ndebond<=10)?4:6;
      const why=db>=0.7-1e-9?'0.7-in. strand':ss.Ndebond<=10?`only ${ss.Ndebond} strands debonded, ≤ 10`:'';
      const locs=Object.keys(term).map(Number).sort((a,b)=>a-b);
      locs.forEach(x=>{ if(term[x]>nTermMax)
        warns.push(`Debonding of ${term[x]} strands terminates at the same section (${fmt(x,2)} ft from each end) — exceeds ${nTermMax} per section${why?` (${why})`:''} (5.9.4.3.3(B)). Stagger the debond lengths.`);});
      for(let k=1;k<locs.length;k++){ const s=(locs[k]-locs[k-1])*12;
        if(s<60*db-1e-9) warns.push(`Debond terminations at ${fmt(locs[k-1],2)} ft and ${fmt(locs[k],2)} ft are ${fmt(s,1)}″ apart — less than 60d_b = 60 × ${db}″ = ${fmt(60*db,1)}″ (5.9.4.3.3(C)).`); }
      const pctTot=100*ss.Ndebond/Math.max(ss.Ntot,1), bfbw=(g.bw>0)?g.bbf/g.bw:0;
      if(!g.isNext&&!g.isBox&&!g.isDeck&&(pctTot>25.01||bfbw>4+1e-9))
        warns.push(`Single-web flanged section with debonding: ${pctTot>25.01?`${ss.Ndebond} of ${ss.Ntot} strands (${fmt(pctTot,0)}%) debonded > 25%`:''}${pctTot>25.01&&bfbw>4+1e-9?' and ':''}${bfbw>4+1e-9?`b_f/b_w = ${fmt(g.bbf,1)}/${fmt(g.bw,1)} = ${fmt(bfbw,2)} > 4`:''} — keep the strands that lie within the web width bonded (5.9.4.3.3(I)). The tool does not check which strands of a row are debonded; verify on the strand pattern.`);
    } }

  // loads (klf)
  const wG=g.wsw, wDk=cp.wdk+(+inp.loads.wNC), wBar=+inp.loads.wBar, wDW=+inp.loads.wDW;
  const MofW=(w,x)=>w*x*(L-x)/2*12;      // closed-form uniform-load moment, kip-in
  const VofW=(w,x)=>w*(L/2-x);           // closed-form uniform-load shear, kip

  // ---- external (MIDAS) demands, if imported & a span is selected ----
  // LL adjustment = DF × MPF, applied to the imported envelope. Impact (IM) is NOT applied here —
  // the MIDAS generator now includes the dynamic load allowance in the imported live load.
  // A blank/missing factor defaults to 1.0; an entered 0 is kept as 0 (it used to become 1.0
  // silently through `||1`) and is flagged below.
  const fac1=(v)=>{ if(v===''||v===null||v===undefined) return 1; const n=+v; return isFinite(n)? n : 1; };
  const _mpf=fac1(inp.loads.extLLmpf);
  const extLL={ pos:fac1(inp.loads.extDFpos)*_mpf,
                neg:fac1(inp.loads.extDFneg)*_mpf,
                v  :fac1(inp.loads.extDFv)*_mpf };
  const ext = inp.external && inp.external._schema==='psbeam-external-demands'
              ? buildExternal({...inp.external, _selSpan:inp.external._selSpan}, L, extLL) : null;
  const useExt = !!ext;
  if(useExt){ const z=[['DF +M',extLL.pos],['DF −M',extLL.neg],['DF V',extLL.v]].filter(q=>!(q[1]>0)).map(q=>q[0]);
    if(z.length) warns.push(`Imported-demand live-load factor ${z.join(', ')} (× MPF) is 0 — that live-load effect is zeroed. Enter the distribution factor (blank = 1.0).`); }
  // An end of the selected span that is an INTERIOR pier: the imported file holds one station per node, so
  // the shear there (and the end reaction sent to Substructure Loading) can be the adjacent span's element
  // end, with the opposite sign. buildExternal interpolates up to that station, so the demands within one
  // station spacing of the pier are affected too. Flag it for a hand check (no value is changed).
  if(useExt){ const spAll=externalSpans(inp.external), sel=ext.sel||{};
    if(spAll.length>1){ const x0s=Math.min(...spAll.map(q=>+q.x0)), x1s=Math.max(...spAll.map(q=>+q.x1)), ends=[];
      if(+sel.x0>x0s+1e-6) ends.push(`left end (x = ${fmt(+sel.x0,2)} ft)`);
      if(+sel.x1<x1s-1e-6) ends.push(`right end (x = ${fmt(+sel.x1,2)} ft)`);
      if(ends.length) warns.push(`MIDAS span ${sel.idx||'?'}: the ${ends.join(' and the ')} ${ends.length>1?'are interior piers':'is an interior pier'}. The import has one station per node there, so the DC2 / DW / LL shear at that end may belong to the adjacent span (MIDAS element end, opposite sign). Check the shear demands near ${ends.length>1?'those piers':'that pier'} and the reactions sent to Substructure Loading by hand.`); } }

  // ---- PBD-G: continuity for the loads applied after continuity (AASHTO LRFD 10th Ed. 5.12.3.3.1): DC2, DW and LL+IM on
  // the continuous unit (window.PBD.contFE: three-moment support moments for the uniform loads, FE influence lines and
  // HL-93 envelopes for LL). The girder self-weight and DC1 stay on the simple non-composite span. Imported MIDAS demands,
  // when present, are the composite-stage analysis and the FE analysis is not used.
  const contOn=!!(inp.cont&&inp.cont.on);
  const contU=contOn?contUnit(inp,L,useExt?ext:null):null;
  const fe=(contOn&&!useExt&&window.PBD&&window.PBD.contFE)?window.PBD.contFE(contU.spans,contU.s):null;
  const useFE=!!fe;
  if(useFE&&contU.assumed) warns.push(`Continuity is on but the bridge has one span: two equal spans of ${fmt(L,1)} ft are assumed for the continuous analysis (this girder in span 1). Enter the spans of the continuous unit in the bridge bar.`);
  if(useFE&&contU.src==='bridge'&&Math.abs(contU.Lbridge-L)>0.005) warns.push(`Continuous analysis: span ${contU.s} is ${fmt(contU.Lbridge,2)} ft in the bridge bar but this design's L = ${fmt(L,2)} ft; the design's L is used for span ${contU.s}.`);
  if(useFE&&!inp.loads.llAuto) warns.push(`Continuity on: the live load is the built-in HL-93 on the continuous unit; the entered M_LL / V_LL (simple-span values) are not used.`);

  // component force-effect functions (kip-in moment, kip shear).
  // App always computes the NON-COMPOSITE loads on the bare girder: girder self-weight AND DC1
  // (deck + haunch + non-composite superimposed). These act before the deck cures, so they belong
  // on the non-composite section — which is why they are NOT taken from MIDAS (whose model is the
  // composite section). MIDAS supplies only the COMPOSITE-stage demands: DC2, DW, and LL+IM.
  const Mg_=(x)=>MofW(wG,x);                          // girder self-weight moment, kip-in
  const Vg_=(x)=>VofW(wG,x);
  // Diaphragm point loads (DC1, on the non-composite simple span). Each {P (kip), a (ft from left brg)}.
  const diaph=(inp.loads.diaph||[]).filter(d=>+d.P>0 && +d.a>=0 && +d.a<=L);
  const Mdia=(x)=>{ let M=0; diaph.forEach(d=>{const P=+d.P,a=+d.a,Rl=P*(L-a)/L;
    M += (x<=a? Rl*x : Rl*x - P*(x-a)); }); return M*12; };          // kip-in
  const Vdia=(x)=>{ let V=0; diaph.forEach(d=>{const P=+d.P,a=+d.a,Rl=P*(L-a)/L;
    V += (x<a? Rl : (x>a? Rl-P : Rl-P/2)); }); return V; };          // kip
  const Pdia=diaph.reduce((s,d)=>s+(+d.P),0);
  const Mdc1_=(x)=>MofW(wDk,x)+Mdia(x);              // non-composite DC1 (deck + haunch + diaphragms)
  const Vdc1_=(x)=>VofW(wDk,x)+Vdia(x);
  const Mdc2_=useExt? ext.M_DC2 : useFE? (x)=>wBar*fe.Mw(x)*12 : (x)=>MofW(wBar,x);  // composite superimposed (barrier) — MIDAS if ext, continuous unit if useFE
  const Vdc2_=useExt? ext.V_DC2 : useFE? (x)=>wBar*fe.Vw(x) : (x)=>VofW(wBar,x);
  const Mdw_ =useExt? ext.M_DW  : useFE? (x)=>wDW*fe.Mw(x)*12 : (x)=>MofW(wDW,x);   // wearing surface — MIDAS if ext, continuous unit if useFE
  const Vdw_ =useExt? ext.V_DW  : useFE? (x)=>wDW*fe.Vw(x) : (x)=>VofW(wDW,x);

  // Aggregate helpers matching the old Mof/Vof semantics used throughout the engine.
  // Channel functions (kip-in moment, kip shear), unambiguous (no value-based dispatch):
  const Mg=Mg_, Vg=Vg_;                       // girder self-weight
  const Mdc1=Mdc1_, Vdc1=Vdc1_;               // deck / non-composite DC1
  const Mdc2=Mdc2_, Vdc2=Vdc2_;               // composite superimposed DC2 (barrier)
  const Mdw=Mdw_, Vdw=Vdw_;                   // wearing surface DW
  // Back-compat shim: Mof(w,x)/Vof(w,x) dispatch by reference identity of the klf token.
  const Mof=(w,x)=> w===wG?Mg(x): w===wDk?Mdc1(x): w===wBar?Mdc2(x): w===wDW?Mdw(x): MofW(w,x);
  const Vof=(w,x)=> w===wG?Vg(x): w===wDk?Vdc1(x): w===wBar?Vdc2(x): w===wDW?Vdw(x): VofW(w,x);
  // Non-composite dead-load moment on the bare girder = girder self-weight + DC1 (always computed).
  const Mnc=(x)=> Mg_(x) + Mdc1_(x);
  const Vnc=(x)=> Vg_(x) + Vdc1_(x);

  // live load (per girder). External: from envelope (DF & IM already applied -> no re-apply).
  const hl=hl93(L), df=distFactors(inp,g,cp);
  const dfm=inp.loads.dfAuto?df.dfm:+inp.loads.dfm;
  const dfv=inp.loads.dfAuto?df.dfv:+inp.loads.dfv;
  // PBD-G (useFE): HL-93 on the continuous unit, per lane with IM (fe.at), × DF_m for moments and DF_v for shears.
  const feM=(x)=>{const p=dfm*fe.at(x,'Mp')*12,n=dfm*fe.at(x,'Mn')*12;return Math.abs(p)>=Math.abs(n)?p:n;};
  const MLLmid = useExt? Math.abs(ext.M_LL(L/2))/12 : useFE? Math.abs(feM(L/2))/12 : (inp.loads.llAuto? hl.M*dfm : +inp.loads.MLL);
  const VLLsup = useExt? Math.max(Math.abs(ext.V_LLpos(0)),Math.abs(ext.V_LLneg(0))) : useFE? dfv*Math.max(Math.abs(fe.at(0,'Vp')),Math.abs(fe.at(0,'Vn'))) : (inp.loads.llAuto? hl.V*dfv : +inp.loads.VLL);
  const MLL=MLLmid;                       // kip-ft (governing positive LL moment near midspan)
  const VLL=VLLsup;                       // kip @ support
  // Built-in LL moment ENVELOPE (exact): the max moment at section x under a moving axle group
  // occurs with one of the axles AT x (the influence line for M(x) is piecewise linear, peaked at
  // x), so the envelope is the max over each axle placed at x, both truck orientations, plus the
  // tandem, with IM (1.33) on the vehicles only, plus the exact lane parabola. The previous
  // parabola-scaled-to-midspan shape was exact for the lane but understated the multi-axle truck
  // envelope by a few % away from midspan. Manual-MLL entry falls back to the parabola (only the
  // midspan value is known).
  const llEnvAt=(x)=>{                                             // k-ft per lane, incl. IM
    const eta=a=>(a<0||a>L)?0:(a<=x? a*(L-x)/L : x*(L-a)/L);       // M(x) influence line
    const Mof=ax=>ax.reduce((s,[a,P])=>s+P*eta(a),0);
    let Mt=0;
    [[[0,8],[14,32],[28,32]],[[0,32],[14,32],[28,8]]].forEach(cfg=>{
      cfg.forEach(([off])=>{ Mt=Math.max(Mt,Mof(cfg.map(([o,P])=>[x-off+o,P]))); });
    });
    let Md=0;
    [[0,25],[4,25]].forEach(([off])=>{ Md=Math.max(Md,Mof([[x-off,25],[x-off+4,25]])); });
    return 1.33*Math.max(Mt,Md)+0.64*x*(L-x)/2;
  };
  const MLLx = useExt? ext.M_LL : useFE? feM
             : inp.loads.llAuto? (x)=>dfm*llEnvAt(x)*12            // exact envelope, kip-in
             : (x)=>MLL*12*4*x*(L-x)/(L*L);                        // manual MLL: parabola fallback
  // Built-in LL shear ENVELOPE magnitude: for a moving load on a simple span the max |shear| at a
  // section is produced by loading from the nearer support, giving VLL·(L−xm)/L where xm is the
  // distance from the NEARER support. This is symmetric (peaks at both supports, min at midspan),
  // unlike a one-directional ramp. Imported (MIDAS) shear already carries the true envelope.
  const VLLx = useExt? ext.V_LL : useFE? (x)=>dfv*Math.max(Math.abs(fe.at(x,'Vp')),Math.abs(fe.at(x,'Vn'))) : (x)=>{const xm=Math.min(x,L-x); return VLL*(L-xm)/L;};
  // LL envelope branches (kip-in moment, kip shear) for the diagrams tab
  const MLLpos = useExt? ext.M_LLpos : useFE? (x)=>dfm*fe.at(x,'Mp')*12 : inp.loads.llAuto? (x)=>dfm*llEnvAt(x)*12 : (x)=>MLL*12*4*x*(L-x)/(L*L);
  const MLLneg = useExt? ext.M_LLneg : useFE? (x)=>dfm*fe.at(x,'Mn')*12 : (x)=>0;
  const VLLpos = useExt? ext.V_LLpos : useFE? (x)=>dfv*fe.at(x,'Vp') : (x)=>VLL*(1-x/L);
  const VLLneg = useExt? ext.V_LLneg : useFE? (x)=>dfv*fe.at(x,'Vn') : (x)=>-VLL*(1-x/L);

  // losses (at midspan, per standard practice)
  const lo=losses(inp,g,cp,ss,Mg(L/2));
  const dfcd=-(Mdc1(L/2)*ss.eMid/g.I + (Mdc2(L/2)+Mdw(L/2))*lo.ref.epc/cp.Ic);
  // ---- Elastic gains (5.9.3.4.3 commentary): loads applied AFTER transfer reduce concrete
  // compression at the strand level, raising strand stress. Credited to f_pe (a gain, not a loss).
  // Each = (Ep/Ec_stage)*(M*e/I) on the section resisting that load. Sign: + = stress increase.
  const Ep=lo.Ep, em=ss.eMid, epc=lo.ref.epc;
  const gainPrecast = (Ep/lo.Ecf)*(Mdc1(L/2)*em/g.I);                 // deck+haunch on non-composite
  const gainComposite = (Ep/lo.Ecf)*((Mdc2(L/2)+Mdw(L/2))*epc/cp.Ic); // DC2+DW on composite
  const gainLive = (Ep/lo.Ecf)*(MLLx(L/2)*epc/cp.Ic);                 // LL on composite (transient)
  // Deck-shrinkage gain (AASHTO 5.9.3.4.3d): the deck, cast later, shrinks against the composite
  // section and relieves strand stress — a gain. Now computed in closed form:
  //   Δf_cdf = -ε_ddf·Ecd·Ad/(1+0.7ψ_d) · [1/Ac - e_pc·e_d/Ic]
  //   Δf_pSS = (Ep/Ec)·Δf_cdf·Kdf·(1+0.7ψ_b(tf,td))      (+ve magnitude = gain)
  let dfSSauto=0;
  if(+inp.ts>0){
    const m=inp.mat, ddt=m.tfin-m.td;
    const ksd=Math.max(1.45-0.13*m.VS,1.0), khsd=2.00-0.014*m.H, khcd=1.56-0.008*m.H, kfd=5/(1+m.fcd);
    const ktdD=ktdAASHTO(ddt,m.fcd);                 // Eq. 5.4.2.3.2-5
    const eDdf=ksd*khsd*kfd*ktdD*0.48e-3;                          // deck free shrinkage strain
    const psiD=1.9*ksd*khcd*kfd*ktdD*Math.pow(1,-0.118);           // deck creep (loaded young, ti≈1d)
    const Acd=cp.beff*(+inp.ts), edd=cp.hc-(+inp.ts)/2-cp.ybc;     // deck area & cg above comp. centroid
    const dfcdf=-eDdf*(cp.Ecd)*Acd/(1+0.7*psiD)*(1/cp.Ac - epc*edd/cp.Ic);   // Δ conc. stress at strand cgs
    dfSSauto=(Ep/lo.Ecf)*dfcdf*lo.ref.Kdf*(1+0.7*lo.ref.psiBDF);   // ksi (+ve = gain)
  }
  const dfSSused = inp.opt.dfpSSauto? dfSSauto : +inp.opt.dfpSS;
  const refFin=lo.finishRefined(dfcd, dfSSused);
  const LT = inp.opt.lossMethod==='refined'? refFin.total : lo.apx.total;
  const totalLoss=lo.dfES+LT;
  // Permanent elastic gains (precast + composite dead load) are credited into the effective
  // prestress for all stages; the live-load gain is credited only in combinations containing LL.
  const gains={precast:gainPrecast, composite:gainComposite, live:gainLive,
               deckShr:dfSSused, deckShrAuto:dfSSauto,
               permanent:gainPrecast+gainComposite};
  const fpe=fpbt-totalLoss, fpi=fpbt-lo.dfES;       // base f_pe (losses only, no gains)
  const fpeGain=fpe+gains.permanent;                // f_pe crediting permanent elastic gains
  const pctLoss=totalLoss/fpbt*100;

  // ---- Per-row strand stresses by stage (each row at its own eccentricity, option 1) ----
  // Eccentricity-dependent components (elastic shortening, creep, elastic gains) scale with the
  // concrete stress at the strand level: stress factor at row i, ri = (1/A + e_i·e_cg/I)/(1/A + e_cg²/I)
  // relative to the group centroid. Shrinkage & relaxation are independent of strand position (uniform).
  const Ab=ss.st.Ab, ecg=ss.eMid, IgS=g.I, AgS=g.A;
  const fcgpDen = 1/AgS + ecg*ecg/IgS;                        // concrete-stress influence at group cg
  const rowFactor = yi => (1/AgS + (g.yb-yi)*ecg/IgS)/fcgpDen; // ratio of conc. stress at row i to group
  // stage loss/gain magnitudes (ksi) at the group centroid:
  const dfES=lo.dfES;
  const dfTDdeck = lo.ref.dfSR + lo.ref.dfCR + lo.ref.dfR1;   // transfer -> deck placement (5.9.3.4.2)
  const eccDepES = true; // elastic shortening scales with eccentricity
  const stageRowsBase = ss.rows.map(r=>({yi:+r.y, n:+r.n, harped:false}));
  if(ss.nh>0) stageRowsBase.push({yi:+ss.hp.yMid, n:ss.nh, harped:true});  // harped group at midspan cg
  const stageRows = stageRowsBase.map(rr=>{
    const yi=rr.yi, ei=g.yb-yi, n=rr.n, A=n*Ab, fac=rowFactor(yi);
    // elastic shortening & creep scale by fac; shrinkage/relaxation uniform; gains scale by fac
    const dES_i  = dfES*fac;
    const dSRrow = lo.ref.dfSR;                               // shrinkage (uniform)
    const dCRrow = lo.ref.dfCR*fac;                           // creep (ecc-dependent)
    const dR1row = lo.ref.dfR1;                               // relaxation 1 (uniform)
    const dTDdeck_i = dSRrow + dCRrow + dR1row;
    // long-term: scale the eccentricity-dependent share (creep + deck-continuity creep) by fac,
    // keep the position-independent share (shrinkage, relaxation, deck-shrinkage gain) uniform.
    const eccShareLT = lo.ref.dfCR + (refFin.dfCD||0);
    const uniShareLT = (totalLoss-dfES) - eccShareLT;
    const dLT = eccShareLT*fac + uniShareLT;
    const gainPerm_i = gains.permanent*fac;                   // gains scale with eccentricity too
    const fpt_i  = fpbt - dES_i;                               // at release
    const fpDeck_i = fpt_i - dTDdeck_i;                        // after transfer->deck TD losses
    const fpe_i  = fpbt - dES_i - dLT;                         // permanent (losses only)
    const fpeG_i = fpe_i + gainPerm_i;                         // permanent w/ gains credited
    return {y:yi, e:ei, n, A, fac, harped:rr.harped,
            fpt:fpt_i, fpDeck:fpDeck_i, fpe:fpe_i, fpeGain:fpeG_i,
            Ppt:fpt_i*A, PpDeck:fpDeck_i*A, Ppe:fpe_i*A, PpeGain:fpeG_i*A,
            dES:dES_i, dTDdeck:dTDdeck_i, dLT};
  });
  const strandStages={rows:stageRows, fpbt, Ab,
    tot:{ n:ss.Ntot, A:ss.Aps,
      Ppt:stageRows.reduce((s,r)=>s+r.Ppt,0), PpDeck:stageRows.reduce((s,r)=>s+r.PpDeck,0),
      Ppe:stageRows.reduce((s,r)=>s+r.Ppe,0), PpeGain:stageRows.reduce((s,r)=>s+r.PpeGain,0)},
    ref:{dfES,dfSR:lo.ref.dfSR,dfCR:lo.ref.dfCR,dfR1:lo.ref.dfR1,dfCD:refFin.dfCD,dfSD:lo.ref.dfSD,
         dfR2:refFin.dfR2,dfSS:refFin.dfSS,ecg,fcgpDen,yb:g.yb,Ig:IgS,Ag:AgS}};

  // ---- PBD-G: restraint moments (AASHTO LRFD 10th Ed. 5.12.3.3.2; creep and deck shrinkage by C5.12.3.3.2, the initial
  // strain method; material properties of 5.4.2.3 per 5.12.3.3.3, with the deck reinforcement per Eq. C5.12.3.3.3-1; age at
  // continuity = t_d per 5.12.3.3.4). Support moments of the continuous unit (k-ft, + sagging); along this span
  // M_r(x) = M_r,A (1 − x/L) + M_r,B x/L. Per 5.12.3.3.2 a combination includes M_r only where it increases the effect:
  // MrP = max(0, M_r) in the positive-moment combinations, MrN = min(0, M_r) in the negative-moment ones; γ = 1.0 (CR, SH:
  // Table 3.4.1-3, non-segmental). Temperature gradient (TG) is not computed. Every value is 0 without restraint.
  let restr=null;
  if(contOn&&inp.cont.restraint&&window.PBD&&window.PBD.restraint&&contU.spans.length>=2){
    const rf=lo.ref, EcG=cp.Ecg, EciG=lo.Eci, dPsi=rf.psiBIF-rf.psiBID;
    const d1=EcG*dPsi/(EciG*(1+0.7*rf.psiBDF)), d2=EcG*dPsi/(EciG*(1+rf.psiBDF));   // Eqs. C5.12.3.3.2-1, -2
    // prestress at transfer (P_i = A_ps(x) f_pi, after elastic shortening) as the imposed hogging curvature EIκ = −P_i e;
    // EI × the free end rotations of this span (Simpson's rule, 120 strips), k-ft²
    const nS=120, hS=L/nS; let pL=0, pR=0;
    for(let k=0;k<=nS;k++){ const x=k*hS, a=ss.at(x), Pe=a.Aps*fpi*a.e/12, wS=(k===0||k===nS)?1:(k%2?4:2); pL+=wS*Pe*(1-x/L); pR+=wS*Pe*x/L; }
    pL*=-hS/3; pR*=-hS/3;
    // differential shrinkage after continuity (initial strain method: each component shrinks freely, then is restored):
    // deck (cast at t_d): ε_ddf of 5.4.2.3.3 as for the 5.9.3.4.3d gain, effective ε_ddf A_d / A_tr, A_tr = A_d + A_s (n − 1),
    // n = E_s / E_c,deck (Eq. C5.12.3.3.3-1); N_d = ε_eff E_cd A_d / (1 + 0.7ψ_d) at the deck centroid, e_d above the composite
    // centroid (sagging). Girder after t_d: ε_bdf = ε_bif − ε_bid (5.9.3.4.3a); N_g = ε_bdf E_c A_g / (1 + 0.7ψ_b(t_f,t_d)) at the
    // girder centroid, e_g = y_bc − y_b below it (hogging). EIκ = N_d e_d − N_g e_g.
    const mt=inp.mat, ddtR=mt.tfin-mt.td, ksdR=Math.max(1.45-0.13*mt.VS,1.0), khsdR=2.00-0.014*mt.H, khcdR=1.56-0.008*mt.H, kfdR=5/(1+mt.fcd), ktdR=ktdAASHTO(ddtR,mt.fcd);
    const eDdf=ksdR*khsdR*kfdR*ktdR*0.48e-3, psiD=1.9*ksdR*khcdR*kfdR*ktdR;
    const Ad=cp.beff*Math.max(+inp.ts,0), Es=29000, nR=Es/cp.Ecd, AsD=Math.max(+inp.cont.As||0,0), Atr=Ad+AsD*(nR-1);
    const eEff=Atr>0? eDdf*Ad/Atr : 0, Nsh=eEff*cp.Ecd*Ad/(1+0.7*psiD), edIn=cp.hc-Math.max(+inp.ts,0)/2-cp.ybc;
    const eBdf=Math.max(rf.eShIF-rf.eShID,0), Ngs=eBdf*EcG*g.A/(1+0.7*rf.psiBDF), egIn=cp.ybc-g.yb;
    const kSh=(Nsh*edIn-Ngs*egIn)/12;                                  // k-ft, + sagging
    const RR=window.PBD.restraint({spans:contU.spans,s:contU.s,wg:wG,wdk:wDk,phiPsL:pL,phiPsR:pR,d1,d2,kSh});
    const iA=contU.s-1, iB=contU.s;
    restr={d1,d2,dPsi,psiBIF:rf.psiBIF,psiBID:rf.psiBID,psiBDF:rf.psiBDF,EcG,EciG,fpi,pL,pR,eDdf,psiD,Ad,Es,nR,AsD,Atr,eEff,Nsh,edIn,
      eShIF:rf.eShIF,eShID:rf.eShID,eBdf,Ngs,egIn,kSh,
      spans:contU.spans,s:contU.s,td:+mt.td,ti:+mt.ti,tf:+mt.tfin,sup:RR,
      A:{Mg:RR.Mg[iA],Mdk:RR.Mdk[iA],Mps:RR.Mps[iA],Mrc:RR.Mrc[iA],Msh:RR.Msh[iA],Mres:RR.Mres[iA]},
      B:{Mg:RR.Mg[iB],Mdk:RR.Mdk[iB],Mps:RR.Mps[iB],Mrc:RR.Mrc[iB],Msh:RR.Msh[iB],Mres:RR.Mres[iB]},
      MrL:RR.Mres[iA], MrR:RR.Mres[iB]};
    if(+mt.td<28) warns.push(`Girder age at continuity t_d = ${fmt(+mt.td,0)} days is below 28 days: 5.12.3.3.1 applies even to spans designed as simple spans, and large positive restraint moments develop (C5.12.3.3.4).`);
  }
  const Mr=(x)=>restr? (restr.MrL*(1-x/L)+restr.MrR*x/L)*12 : 0;      // restraint moment, kip-in
  const MrP=(x)=>restr? Math.max(0,Mr(x)) : 0, MrN=(x)=>restr? Math.min(0,Mr(x)) : 0;
  const VrS=restr? (restr.MrR-restr.MrL)/L : 0;                      // restraint shear, kip (constant along the span)

  // stress limits (5.9.2.3)
  const m=inp.mat;
  // Release compression limit factor (Art. 5.9.2.3.1a, 10th Ed.: 0.65 f'ci for pretensioned members);
  // an input so an owner rule (e.g. 0.60) can be applied. Blank / invalid → 0.65.
  const relCfac=relCfacOf(inp);
  const lim={
    relCfac,
    relC:relCfac*m.fci,
    relT:inp.opt.relBondedReinf? 0.24*sqrt(m.fci) : Math.min(0.0948*sqrt(m.fci),0.2),
    srvC1:0.45*m.fc, srvC2:0.60*m.fc,
    // Table 5.9.2.3.2b-1: severe corrosive conditions 0.0948λ√f'c ≤ 0.3 ksi (the 0.3 ksi cap was missing;
    // it governs only above f'c = 10.0 ksi). Normal-weight concrete, λ = 1.0.
    srvT:inp.opt.corrosion==='severe'? Math.min(0.0948*sqrt(m.fc),0.3) : Math.min(0.19*sqrt(m.fc),0.6),
    dkC1:0.45*m.fcd, dkC2:0.60*m.fcd
  };

  // station grid (0..L, dense) — stresses
  const NPTS=61, xs=[...Array(NPTS)].map((_,i)=>i*L/(NPTS-1));
  const xt=ss.lt/12;
  if(!xs.includes(xt)){xs.push(xt,L-xt);xs.sort((a,b)=>a-b);}
  const useT=!!inp.opt.useTrans, niT=inp.str.Ep/lo.Eci;
  // Per-station elastic stresses at an EXACT x (ft). Used to build the grid and for on-demand
  // queries from the Stress tab, so a typed station is computed, not snapped to a grid point.
  const stationStress=(x)=>{
    const a=ss.at(x), e=a.e;
    const Pi=a.Aps*fpi, Pe=a.Aps*fpe;
    // Service stress checks use the POSITIVE (sagging) LL moment: it maximizes bottom-fiber tension
    // (Service III) and top-fiber compression (Service I) for the simple-span / positive-moment region.
    // Negative LL effects (top tension / pier) are handled by the continuity negative-moment check,
    // not the per-section fiber stresses. Using positive LL also keeps the curve continuous (no
    // envelope-branch jump that the governing |LL| would introduce near the supports).
    const Mg=Mg_(x), Mdk=Mdc1(x), Msd=Mdc2(x)+Mdw(x), Mll=MLLpos(x);
    let relTop,relBot;
    if(useT&&a.Aps>0){ // transformed section, P at fpbt (elastic shortening implicit)
      const At=g.A+(niT-1)*a.Aps;
      const ybt=(g.A*g.yb+(niT-1)*a.Aps*a.cgs)/At;
      const It=g.I+g.A*(ybt-g.yb)**2+(niT-1)*a.Aps*(ybt-a.cgs)**2;
      const eT=ybt-a.cgs, P0=a.Aps*fpbt;
      relTop=P0/At-P0*eT/(It/(g.h-ybt))+Mg/(It/(g.h-ybt));
      relBot=P0/At+P0*eT/(It/ybt)-Mg/(It/ybt);
    }else{
      relTop=Pi/g.A-Pi*e/g.St+Mg/g.St;
      relBot=Pi/g.A+Pi*e/g.Sb-Mg/g.Sb;
    }
    const mrp=MrP(x);                                                 // PBD-G: positive restraint moment (0 without restraint)
    const s1Top=Pe/g.A-Pe*e/g.St+(Mg+Mdk)/g.St+Msd/cp.Stg+mrp/cp.Stg;            // perm only
    const s2Top=s1Top+(mLL*Mll)/cp.Stg;                               // perm + LL (mLL: owner multiplier, 1 for AASHTO)
    const s3Bot=Pe/g.A+Pe*e/g.Sb-(Mg+Mdk)/g.Sb-(Msd+mrp+inp.opt.gLLs3*(mLL*Mll))/cp.Sbc;
    const dkC=(Msd)/cp.Std + (mLL*Mll)/cp.Std + mrp/cp.Std;  // deck: SIDL+LL on composite
    const dkC1=Msd/cp.Std+mrp/cp.Std;
    // PBD-G (continuity on): negative-moment fibers near interior supports (5.12.3.3.5): Service III top of girder with the
    // negative LL envelope, Service I bottom (permanent; full) with it; MrN = negative restraint where it adds.
    const negF=contOn? (()=>{ const Mn=MLLneg(x), mrn=MrN(x);
      const s3TopN=Pe/g.A-Pe*e/g.St+(Mg+Mdk)/g.St+(Msd+mrn+inp.opt.gLLs3*(mLL*Mn))/cp.Stg;
      const s1BotN=Pe/g.A+Pe*e/g.Sb-(Mg+Mdk)/g.Sb-(Msd+mrn)/cp.Sbc;
      const s3BotN=Pe/g.A+Pe*e/g.Sb-(Mg+Mdk)/g.Sb-(Msd+mrn+inp.opt.gLLs3*(mLL*Mn))/cp.Sbc;
      return {Mlln:Mn,mrn,s3TopN,s3BotN,s1BotN,s2BotN:s1BotN-(mLL*Mn)/cp.Sbc}; })() : null;
    return {x,e,Aps:a.Aps,Mg,Mdk,Msd,Mll,relTop,relBot,s1Top,s2Top,s3Bot,dkC,dkC1,
            Mu:eta*(1.25*(Mg+Mdk+Mdc2(x))+1.5*Mdw(x)+1.75*(mLL*Mll)+mrp),...(restr?{mrp}:{}),...(negF||{})};
  };
  const grid=xs.map(stationStress);
  const worst=(key,fn)=>grid.reduce((b,r)=>fn(r[key],b[key])?r:b,grid[0]);
  const wRelC=worst('relBot',(a,b)=>a>b), wRelT=worst('relTop',(a,b)=>a<b);
  const wS1=worst('s1Top',(a,b)=>a>b), wS2=worst('s2Top',(a,b)=>a>b), wS3=worst('s3Bot',(a,b)=>a<b);
  // most-tensile (min) of the fibers that are normally in compression — these can go into tension
  // in the positive-moment region (release bottom at midspan; service top under light prestress).
  const wRelBT=worst('relBot',(a,b)=>a<b);   // release BOTTOM, most tensile (positive-moment region)
  // --- bonded auxiliary reinforcement for the release-tension limit (5.9.2.3.1b) ---
  // The 0.24√f'ci limit only applies where bonded steel can carry the concrete tensile force, the
  // steel proportioned at 0.5fy but not more than 30 ksi. Compute that tensile force at both worst
  // tension stations (top near the ends; bottom at midspan), and the steel each needs.
  const relSteel=(()=>{
    const fs=Math.min(0.5*(+inp.opt.relFy||60),30);            // ksi, per 5.9.2.3.1b proviso
    const Ttop=releaseTensionForce(g,wRelT.relTop,wRelT.relBot);
    const Tbot=releaseTensionForce(g,wRelBT.relTop,wRelBT.relBot);
    const gov=Ttop>=Tbot? {T:Ttop,x:wRelT.x,where:'top (ends)'} : {T:Tbot,x:wRelBT.x,where:'bottom (midspan)'};
    const AsReq=fs>0? gov.T/fs : 0;
    const AsProv=+inp.opt.relAs||0;
    return {fs, Ttop, Tbot, T:gov.T, x:gov.x, where:gov.where, AsReq, AsProv,
            ok:AsProv>=AsReq-1e-6, dc:AsReq>1e-9?(AsProv>0? AsReq/AsProv : 99):0};
  })();
  // PBD-G: with continuity on, the stations of the half span next to an interior support are checked by 5.12.3.3.5 instead
  const nearPierX=x=>contOn&&((contU.s>1&&x<=L/2+1e-9)||(contU.s<contU.spans.length&&x>=L/2-1e-9));
  const gS2T=contOn? grid.filter(r=>!nearPierX(r.x)) : grid;
  const wS2T=gS2T.length? gS2T.reduce((b,r)=>r.s2Top<b.s2Top?r:b,gS2T[0]) : null;      // service TOP (full load), most tensile
  const wDkC=worst('dkC',(a,b)=>a>b);

  // flexure along span — FULL span for the demand/capacity diagram (no mirroring; supports
  // asymmetric continuous-span demands). flexure() capacity is symmetric in geometry but Mu(x)
  // comes straight from the grid, so the diagram shows the true (possibly asymmetric) envelope.
  const flexFull=grid.map(r=>{
    const xeff=clamp(Math.min(r.x,L-r.x), ss.lt/12, L/2);  // avoid x=0 (no developed strand)
    const f=flexure(inp,g,cp,ss,xeff,fpe);
    const x=r.x;
    return {x:r.x,Mu:r.Mu,phiMn:f.phiMn,Mn:f.Mn,fps:f.fps,fpsFull:f.fpsFull,devGov:f.devGov,c:f.c,a:f.a,dp:f.dp,et:f.et,phi:f.phi,b1:f.b1,rect:f.rect,
      // unfactored component moments (k-ft) for the breakdown plot
      mSW:Mg_(x)/12, mDC1:Mdc1(x)/12, mDC2:Mdc2(x)/12, mDW:Mdw(x)/12,
      mLLpos:MLLpos(x)/12, mLLneg:MLLneg(x)/12};
  });
  const flexGrid=flexFull.filter(r=>r.x<=L/2+0.01);
  const fMid=flexGrid[flexGrid.length-1];
  // Over-reinforcement / strain condition (5.5.4.2 + C5.6.3.3): there is no explicit over-reinforced
  // prohibition in current LRFD — instead φ drops from 1.0 (tension-controlled, εt ≥ 0.005) toward
  // 0.75 (compression-controlled, εt ≤ 0.002). Flag it, since a non-tension-controlled prestressed
  // girder is almost always a design smell (too many strands / section too small).
  if(fMid&&fMid.et!==undefined&&fMid.et<0.005){
    warns.push(fMid.et<=0.002
      ? `Midspan section is COMPRESSION-CONTROLLED (εt = ${fmt(fMid.et*1000,2)}‰ ≤ 2.0‰): φ = 0.75. The section is over-reinforced — the concrete crushes before the strands yield. Reduce strands or enlarge the section/deck.`
      : `Midspan section is in the φ TRANSITION zone (εt = ${fmt(fMid.et*1000,2)}‰ < 5.0‰): φ = ${fmt(fMid.phi,3)} < 1.0 per 5.5.4.2. The section is approaching over-reinforced behavior; capacity is already being penalized.`);
  }
  const MuMid=grid.find(r=>Math.abs(r.x-L/2)<0.01).Mu;
  // Mcr (5.6.3.3)
  const fr=0.24*sqrt(m.fc);
  const PeM=ss.at(L/2).Aps*fpe;
  const fcpe=PeM/g.A+PeM*ss.eMid/g.Sb;
  const Mdnc=Mg(L/2)+Mdc1(L/2);
  const Mcr=Math.max(1.0*((1.6*fr+1.1*fcpe)*cp.Sbc-Mdnc*(cp.Sbc/g.Sb-1)),(1.6*fr+1.1*fcpe)*cp.Sbc*0); 
  const minMr=Math.min(Mcr,1.33*MuMid);
  // Strength flexure (5.6.3.2) and minimum reinforcement (5.6.3.3) governed over the FULL span
  // (flexFull), not midspan only: harp points, debond terminations and continuous (MIDAS) demands
  // can put the peak Mu/φMn away from L/2. Only stations with positive Mu are positive-flexure
  // checks; the pier (−M) check is separate (continuity). Mcr per station uses the prestress and
  // eccentricity at that station (ss.at(x), transfer ramp included) and the noncomposite moment there.
  let flexGov=null, minGov=null;
  flexFull.forEach(r=>{
    if(!(r.Mu>0) || !(r.phiMn>0)) return;
    const rf=r.Mu/r.phiMn;
    if(!flexGov || rf>flexGov.r) flexGov={x:r.x,Mu:r.Mu,phiMn:r.phiMn,r:rf};
    const xs_=clamp(Math.min(r.x,L-r.x), 0, L/2), a_=ss.at(xs_);
    const PeX=a_.Aps*fpe, fcpeX=PeX/g.A+PeX*a_.e/g.Sb;
    const MdncX=Mg(r.x)+Mdc1(r.x);
    const McrX=Math.max(1.0*((1.6*fr+1.1*fcpeX)*cp.Sbc-MdncX*(cp.Sbc/g.Sb-1)),0);
    const reqX=Math.min(McrX,1.33*r.Mu), rm=reqX/r.phiMn;
    if(!minGov || rm>minGov.r) minGov={x:r.x,Mu:r.Mu,phiMn:r.phiMn,Mcr:McrX,fcpe:fcpeX,req:reqX,r:rm};
  });
  if(!flexGov) flexGov={x:L/2,Mu:MuMid,phiMn:fMid.phiMn,r:MuMid/fMid.phiMn};
  if(!minGov) minGov={x:L/2,Mu:MuMid,phiMn:fMid.phiMn,Mcr,fcpe,req:minMr,r:minMr/fMid.phiMn};

  // shear (general procedure 5.7.3.4.2) at stations
  const fy=+inp.opt.fy, Av=+inp.opt.stirAv, phiV=0.9, fpo=0.7*inp.str.fpu;
  const Act=tensionSideArea(g);   // concrete on the flexural tension side, for the negative-es recompute (5.7.3.4.2)
  // bearing row at the inside edge of the pad (Lpad/2 from the bearing CL): 5.7.3.5-2 shear-only tie
  // demand there, evaluated with the development length available = Lpad/2 + endOh from the girder end.
  // Remaining rows from the critical section (d_v) inward carry the full 5.7.3.5-1 demand.
  const xBear=Math.max((+inp.opt.Lpad||0)/24, 0);   // inside edge of the bearing pad = Lpad/2 from the CL (ft)
  // Critical section for shear (5.7.3.2): d_v from the INTERNAL FACE of the support, i.e. the inside edge
  // of the bearing pad (xBear), with d_v evaluated at that section (fixed-point iteration from 0.72h_c).
  // (Was 0.72h_c from the bearing centerline.)
  const dvEst=(()=>{ let x=xBear+0.72*cp.hc/12;
    for(let it=0;it<4;it++){ const f=flexure(inp,g,cp,ss,x,fpe);
      const dv=Math.max(f.dp-f.a/2,0.9*f.dp,0.72*cp.hc), xn=xBear+dv/12;
      if(!isFinite(xn)) break; if(Math.abs(xn-x)<1e-4){ x=xn; break; } x=xn; }
    return x; })();
  // Stations cover the FULL span (left half mirrored to the right), so the far/pier end is checked
  // when imported continuous demands are asymmetric. A station is also placed just past each change
  // in stirrup spacing (end of the end zone, both ends) where the wider interior spacing starts.
  const shLeft=[dvEst,0.1*L,0.15*L,0.2*L,0.25*L,0.3*L,0.4*L];
  const ezX=(+inp.opt.endZoneLen||0)*L;
  if(ezX>dvEst && ezX<L/2-0.05 && (+inp.opt.sEnd)!==(+inp.opt.sInt)) shLeft.push(ezX+0.01);
  const shStations=[{x:xBear,isBearing:true},
    ...shLeft.map(x=>({x,isBearing:false})),
    {x:0.5*L,isBearing:false},
    ...shLeft.map(x=>({x:L-x,isBearing:false})),
    {x:L-xBear,isBearing:true}]
    .filter((st,i,a)=>a.findIndex(o=>Math.abs(o.x-st.x)<1e-6&&o.isBearing===st.isBearing)===i)
    .sort((a,b)=>a.x-b.x||(b.isBearing-a.isBearing));
  const shear=shStations.map(({x,isBearing})=>{
    const gr_=grid.reduce((b,q)=>Math.abs(q.x-x)<Math.abs(b.x-x)?q:b,grid[0]);
    const f=flexure(inp,g,cp,ss,x,fpe);
    const dv=Math.max(f.dp-f.a/2,0.9*f.dp,0.72*cp.hc);
    const a_=ss.at(x);
    const Ph=ss.AsHarp*fpe*clamp(Math.min(x,L-x)*12/ss.lt,0,1);
    const Vp=(Math.min(x,L-x)<ss.hp.frac*L && ss.nh>0)? Ph*ss.slope:0;
    const vdl=1.25*(Vg(x)+Vdc1(x)+Vdc2(x))+1.5*Vdw(x);                // PBD-G: + restraint shear VrS only where it increases |V| (5.12.3.3.2)
    const Vu=eta*(Math.max(Math.abs(vdl),Math.abs(vdl+VrS))+1.75*(mLL*VLLx(x)));  // |DL shear| + LL envelope (symmetric magnitude); η, mLL: owner (1 for AASHTO)
    const Mu=Math.max(gr_.Mu,Math.abs(Vu-Vp)*dv);
    // f_po ramps linearly from 0 at the free end to 0.7f_pu at the end of the transfer length (5.7.3.4.2)
    const fpoX=fpo*clamp(Math.min(x,L-x)*12/ss.lt,0,1);
    /* 5.7.3.4.2: a negative es may only be USED once it has been recomputed with
       the concrete on the flexural tension side participating -- the Ec*Act term
       in Eq. 5.7.3.4.2-4 -- and otherwise es is taken as zero. Flooring the raw,
       un-recomputed value at -0.40e-3, which is what this used to do, pegs the
       end-region stations at the most favourable strain the code permits
       anywhere, and beta = 4.8/(1+750es) pays that back as roughly 40% extra Vc
       exactly where the shear is highest. The floor still applies -- but to the
       recomputed value. */
    const esNum=Mu/dv+Math.abs(Vu-Vp)-a_.Aps*fpoX;
    const esDen=inp.str.Ep*a_.Aps;
    const esRaw=esNum/esDen;
    let es=esRaw;
    if(es<0) es=esNum/(esDen+cp.Ecg*Act);
    es=clamp(es,-0.40e-3,6e-3);
    const beta=4.8/(1+750*es), theta=29+3500*es;
    const cot=1/Math.tan(theta*Math.PI/180);
    const Vc=0.0316*beta*sqrt(m.fc)*g.bw*dv;
    const VsReq=Math.max(Vu/phiV-Vc-Vp,0);
    const sReq=VsReq>0? Av*fy*dv*cot/VsReq : Infinity;
    const vu=Math.abs(Vu-phiV*Vp)/(phiV*g.bw*dv);
    const sMax=vu<0.125*m.fc? Math.min(0.8*dv,24):Math.min(0.4*dv,12);
    const sMinR=Av*fy/(0.0316*sqrt(m.fc)*g.bw);
    const sGov=Math.min(sReq,sMax,sMinR);
    const sProv=(Math.min(x,L-x)<=inp.opt.endZoneLen*L)?+inp.opt.sEnd:+inp.opt.sInt;   // end zone at BOTH ends
    const Vs=Av*fy*dv*cot/sProv;
    const Vn=Math.min(Vc+Vs+Vp,0.25*m.fc*g.bw*dv+Vp);
    // Transverse reinforcement is required where Vu > 0.5·φ·(Vc+Vp) (5.7.2.3). WHERE it is required,
    // the provided spacing must not exceed the maximum of 5.7.2.6 nor the A_v,min spacing of 5.7.2.5
    // (sMinR). A provided spacing above that is a code violation even if φVn still exceeds Vu, so it
    // must fail the section -- capacity alone was answering the wrong question here.
    const stirReq=Math.abs(Vu) > 0.5*phiV*(Vc+Vp);
    const sMaxGov=Math.min(sMax,sMinR);
    const spOK=(!stirReq) || (sProv <= sMaxGov+1e-3);
    // longitudinal reinforcement (LRFD 5.7.3.5): demand vs capacity of tension tie.
    const VsCap=Math.min(Vs,Vu/phiV);  // Vs need not exceed Vu/phi
    // The tie is evaluated with the full demand at the critical section (d_v from the face) and
    // beyond. At the inside edge of the bearing 5.7.3.5 permits the reduced (shear-only) demand,
    // handled by the dedicated bearing-face row (isBearing) added to the grid below.
    const Tshear=(Math.abs(Vu)/phiV-0.5*VsCap-Math.abs(Vp))*cot;
    const Tflex=Math.abs(Mu)/(dv*0.9);
    const Tdem= isBearing? Tshear : (Tflex+Tshear);   // kip (phi_f=0.9 flexure)
    // developed strand stress = fpe ramped to fps. ld is a function of the FULL
    // nominal fps, so read fpsFull -- f.fps is now already development-limited and
    // feeding it back in would shorten ld and flatter the tie.
    const fpsFull=f.fpsFull||f.fps||fpe;
    const fpsAvail=ss.devAvg(x,fpsFull,fpe);
    const Tps=ss.devForce(x,fpsFull,fpe).T;   // Σ A·f_dev = A_ps·f_ps with the 5.9.4.3.2 ramp applied ONCE
    // The main shear check is in the positive-moment region (bottom fiber in tension), so the
    // BOTTOM longitudinal mild steel is what contributes to this tie. Top steel serves the
    // negative-moment (pier) region and is applied there via the continuity check.
    const TsMild=(+inp.opt.longAsBot||0)*(+inp.opt.longFy||0);   // As,bot·fy where developed
    const Tcap=Tps + TsMild;   // 5.7.3.5: strand tie force (developed) + bottom mild bars at fy
    const longOK=Tcap>=Tdem-1e-3;
    return {x,isBearing,dv,Vu,Vp,es,esRaw,esRecomp:esRaw<0,Act,beta,theta,Vc,VsReq,sReq,sMax,sMinR,sGov,sProv,Vs,Vn,
            Tdem,Tcap,fpsAvail,TsMild,longOK,cot,phiVn:phiV*Vn,stirReq,sMaxGov,spOK,
            dc:Vu/(phiV*Vn),vu,vuMaxOK:Vu/phiV<=0.25*m.fc*g.bw*dv+Vp,
            ...(contOn?{vc:{g:Vg(x),dc1:Vdc1(x),dc2:Vdc2(x),dw:Vdw(x),ll:VLLx(x),r:VrS,rIn:Math.abs(vdl+VrS)>Math.abs(vdl)}}:{})};   // PBD-G: components for the worked V_u
  });
  // Governing shear-capacity check starts at the critical section (d_v), NOT the bearing face —
  // the bearing row exists only for the 5.7.3.5 longitudinal tie (reduced demand there).
  const wShear=shear.filter(r=>!r.isBearing).reduce((b,r)=>r.dc>b.dc?r:b,shear.find(r=>!r.isBearing));
  const wLong=shear.reduce((b,r)=>(r.Tdem-r.Tcap)>(b.Tdem-b.Tcap)?r:b,shear[0]);
  // Full-span shear demand & capacity for the diagram (Vu(x) from the grid load combo over 0..L,
  // not just the half-span design stations — shows the true continuous-span envelope).
  const shearDiag=grid.map(x0=>{
    const x=x0.x;
    const xeff=clamp(Math.min(x,L-x), ss.lt/12, L/2);
    const f=flexure(inp,g,cp,ss,xeff,fpe);
    const dv=Math.max(f.dp-f.a/2,0.9*f.dp,0.72*cp.hc);
    const xm=Math.min(x,L-x);
    const Ph=ss.AsHarp*fpe*clamp(xm*12/ss.lt,0,1);
    const Vp=(xm<ss.hp.frac*L && ss.nh>0)? Ph*ss.slope:0;
    const vdl=1.25*(Vg(x)+Vdc1(x)+Vdc2(x))+1.5*Vdw(x);                // PBD-G: + restraint shear VrS only where it increases |V| (5.12.3.3.2)
    const Vu=eta*(Math.max(Math.abs(vdl),Math.abs(vdl+VrS))+1.75*(mLL*VLLx(x)));  // |DL shear| + LL envelope (symmetric magnitude); η, mLL: owner (1 for AASHTO)
    const a_=ss.at(Math.max(xeff,ss.lt/12));
    const Apsx=Math.max(a_.Aps,1e-3);
    const Mu=Math.max(x0.Mu,Math.abs(Vu-Vp)*dv);
    const fpoX2=fpo*clamp(Math.min(x,L-x)*12/ss.lt,0,1);   // transfer-length ramp (5.7.3.4.2)
    const esNum2=Mu/dv+Math.abs(Vu-Vp)-Apsx*fpoX2, esDen2=inp.str.Ep*Apsx;
    let es=esNum2/esDen2;
    if(es<0) es=esNum2/(esDen2+cp.Ecg*Act);   // 5.7.3.4.2-4, as at the design stations
    es=clamp(es,-0.40e-3,6e-3);
    const beta=4.8/(1+750*es), theta=29+3500*es, cot=1/Math.tan(theta*Math.PI/180);
    const Vc=0.0316*beta*sqrt(m.fc)*g.bw*dv;
    const sProv=(xm<=inp.opt.endZoneLen*L)?+inp.opt.sEnd:+inp.opt.sInt;
    const Vs=Av*fy*dv*cot/sProv;
    const Vn=Math.min(Vc+Vs+Vp,0.25*m.fc*g.bw*dv+Vp);
    return {x,Vu:Math.abs(Vu),phiVn:phiV*Vn,phiVcp:phiV*(Vc+Vp)};
  });
  // ---- Force-effect diagrams: every component & combination at each station ----
  // Moments in k-ft, shears in kip. Sagging +, signed shear. γLL_s3 per options (Service III).
  const gLs3=+inp.opt.gLLs3;
  const diagrams=grid.map(r=>{
    const x=r.x;
    const mdc1=Mdc1(x)/12, mdc2=Mdc2(x)/12, mdw=Mdw(x)/12, mg=Mg(x)/12;
    const mllp=MLLpos(x)/12, mlln=MLLneg(x)/12;
    const vdc1=Vdc1(x), vdc2=Vdc2(x), vdw=Vdw(x), vg=Vg(x);
    const vllp=VLLpos(x), vlln=VLLneg(x);
    const mDC=mg+mdc1+mdc2, vDC=vg+vdc1+vdc2;     // total DC (incl. girder self-wt)
    // moment combinations (envelope: use the LL branch that maximizes magnitude with same-sign DC)
    const mStrI_p=eta*(1.25*mDC+1.5*mdw+1.75*(mLL*mllp)), mStrI_n=eta*(1.25*mDC+1.5*mdw+1.75*(mLL*mlln));   // η, mLL: owner (1 for AASHTO)
    const mSrvI_p=mDC+mdw+mLL*mllp,               mSrvI_n=mDC+mdw+mLL*mlln;
    const mSrvIII_p=mDC+mdw+gLs3*(mLL*mllp),      mSrvIII_n=mDC+mdw+gLs3*(mLL*mlln);
    const vStrI_p=eta*(1.25*vDC+1.5*vdw+1.75*(mLL*vllp)), vStrI_n=eta*(1.25*vDC+1.5*vdw+1.75*(mLL*vlln));
    const vSrvI_p=vDC+vdw+mLL*vllp,               vSrvI_n=vDC+vdw+mLL*vlln;
    return {x,
      // moments
      M_g:mg, M_DC1:mdc1, M_DC2:mdc2, M_DW:mdw, M_DC:mDC, M_LLpos:mllp, M_LLneg:mlln,
      M_StrI_pos:mStrI_p, M_StrI_neg:mStrI_n, M_SrvI_pos:mSrvI_p, M_SrvI_neg:mSrvI_n,
      M_SrvIII_pos:mSrvIII_p, M_SrvIII_neg:mSrvIII_n,
      // shears
      V_g:vg, V_DC1:vdc1, V_DC2:vdc2, V_DW:vdw, V_DC:vDC, V_LLpos:vllp, V_LLneg:vlln,
      V_StrI_pos:vStrI_p, V_StrI_neg:vStrI_n, V_SrvI_pos:vSrvI_p, V_SrvI_neg:vSrvI_n };
  });
  // strand development length (LRFD 5.9.4.3.2) for reporting
  const fpsM=fMid.fps||fpe;
  const ldBonded=1.6*(fpsM-(2/3)*fpe)*ss.st.db;
  const ldDebond=2.0*(fpsM-(2/3)*fpe)*ss.st.db;
  // Debond length from the beam end, simple spans (10th Ed. 5.9.4.3.3(G)): ≤ min(0.20 L, L/2 − ℓ_d), ℓ_d with κ = 2.0.
  // Warning only. Spans made continuous (continuity on) are left to 5.9.4.3.3(H) / 5.12.3.3.
  if(ss.Ndebond>0&&!(inp.cont&&inp.cont.on)){
    const dbMaxG=Math.min(0.20*L, L/2-ldDebond/12);
    const dbLong=Math.max(...ss.rows.filter(r=>r.dbnd>0&&r.nd>0).map(r=>r.dbnd));
    if(dbLong>dbMaxG+1e-9) warns.push(`Debond length ${fmt(dbLong,2)} ft exceeds min(0.20L, L/2 − ℓ_d) = min(0.20 × ${fmt(L,1)}, ${fmt(L/2,2)} − ${fmt(ldDebond/12,2)}) = ${fmt(dbMaxG,2)} ft for a simple span (5.9.4.3.3(G); ℓ_d of a debonded strand, κ = 2.0, worked on the Shear tab, Strand Development Length card).`);
  }
  // splitting (5.9.4.4) & interface shear (5.7.4)
  const PiTot=ss.Aps*fpi;
  const AsSplit=0.04*PiTot/20;                          // required area (fs limited to 20 ksi)
  const AsSplitProv=(+inp.opt.splitN||0)*(+inp.opt.splitAv||0); // provided legs × area-per-leg within h/4
  const splitPr=AsSplitProv*20;                          // provided resistance (kip), fs=20 ksi cap
  const splitDem=0.04*PiTot;                             // required resistance = 4% of Pi
  const splitDC=splitPr>0? splitDem/splitPr : 99;        // demand/capacity
  const splitN_need=(+inp.opt.splitAv>0)? Math.ceil(AsSplit/(+inp.opt.splitAv)) : 0;
  // 5.9.4.4.1: the reinforcement must lie within h/4 of the end, where h is the overall dimension in
  // the direction splitting is being evaluated -- the overall HEIGHT for I-girders, bulb tees and
  // box/tub girders (vertical reinforcement), but the overall WIDTH for solid or voided slabs
  // (horizontal reinforcement). The required area (4%Pi/20) is the same; only the placement zone and
  // the bar orientation change.
  const splitDir=g.isDeck? 'width' : 'height';
  const splitH=g.isDeck? (+g.w||g.h) : g.h;
  const splitZone=splitH/4;
  /* confinement reinforcement (5.9.4.4.2)
     "For a distance of 1.5d from the end of the beams other than box beams,
      reinforcement shall be placed to confine the prestressing steel in the bottom
      flange. The reinforcement shall not be less than No. 3 deformed bars, with
      spacing not exceeding 6.0 in., and shaped to enclose the strands."
     This is a prescriptive detailing rule, not a force check -- there is no demand to
     compute and no f_s to develop, which is why it used to sit here as a hard-coded
     note. All three limits are dimensional, so each is expressed as a value-vs-limit
     pair in inches (bar size as d_b, so the summary table's units stay honest) and
     the governing one drives the D/C. */
  const conf=(()=>{
    // The code exempts box beams by name. Slab/deck beams are exempt for a different
    // reason -- there is no distinct bottom flange to confine -- and are labelled as such.
    const exempt=!!g.isBox||!!g.isDeck;
    const why=g.isBox? 'box beam — 5.9.4.4.2 applies to beams other than box beams'
             :g.isDeck? 'slab/deck beam — no distinct bottom flange to confine'
             :'';
    const AB={3:0.11,4:0.20,5:0.31,6:0.44,7:0.60,8:0.79,9:1.00,10:1.27,11:1.56};
    const barNo=Math.round(+inp.opt.confBar||0), sSp=+inp.opt.confS||0, nBar=+inp.opt.confN||0;
    const db=barNo/8, Ab=AB[barNo]||0;
    const reqExt=1.5*g.h;                    // d = overall depth of the precast member
    const provExt=Math.max(nBar-1,0)*sSp;    // length covered, first bar at the member end
    const rSize=db>0? 0.375/db : 99;         // bar must be no smaller than a No. 3
    const rSp  =sSp>0? sSp/6.0 : 99;         // spacing must not exceed 6.0 in
    const rExt =provExt>0? reqExt/provExt : 99;
    const parts=[{k:'size',lbl:'Bar size (d_b ≥ No. 3)',v:0.375,lim:db,   r:rSize,ok:rSize<=1.0001,u:'in'},
                 {k:'sp',  lbl:'Spacing (≤ 6.0 in)',    v:sSp,  lim:6.0,  r:rSp,  ok:rSp  <=1.0001,u:'in'},
                 {k:'ext', lbl:'Extent (≥ 1.5d)',       v:reqExt,lim:provExt,r:rExt,ok:rExt <=1.0001,u:'in'}];
    const gov=parts.reduce((b,q)=>q.r>b.r?q:b,parts[0]);
    const nNeed=sSp>0? Math.ceil(reqExt/sSp)+1 : 0;   // bars at this spacing to cover 1.5d
    return {exempt,why,barNo,s:sSp,n:nBar,db,Ab,reqExt,provExt,parts,gov,nNeed,
            dc:exempt?0:gov.r,
            sizeOK:rSize<=1.0001, spOK:rSp<=1.0001, extOK:rExt<=1.0001,
            pass:exempt||gov.r<=1.0001};
  })();
  // Interface shear (5.7.4) at EVERY shear station over the full span (including the station just
  // past each stirrup-spacing change), not only the first three end stations.
  const iface=shear.map(r=>{
    const dvi=r.dv, bvi=g.btf;
    const vui=r.Vu/(bvi*dvi), Vui=vui*bvi*12; // per 12in length
    const c=0.28,mu=1.0,Acv=bvi*12;
    const AvfReq=Math.max((Vui/phiV-c*Acv)/(mu*fy),0.05*Acv/fy*0); // /ft
    const AvfMin=Math.max(0.05*Acv/fy,0); // 5.7.4.2
    const AvfProv=Av*12/r.sProv;
    // Upper cap on nominal interface resistance (5.7.4.3-4/-5): Vni ≤ min(K1·f'c·Acv, K2·Acv),
    // K1=0.3, K2=1.8 ksi for normal-weight concrete on an intentionally roughened surface; f'c of
    // the weaker concrete at the interface (the deck).
    const fcWeak=Math.min(+inp.mat.fcd||m.fc, m.fc);
    const VniCap=Math.min(0.3*fcWeak*Acv, 1.8*Acv);
    const capOK=Vui/phiV<=VniCap;
    // 5.7.4.2: the minimum A_vf may be waived for a roughened (0.25 in. amplitude) girder/slab
    // interface only where the factored interface shear stress v_ui < 0.210 ksi and all vertical
    // shear reinforcement is extended across the interface. (Was: waived when V_ui/φ ≤ c·A_cv,
    // i.e. v_ui ≤ 0.252 ksi.)
    const minWaived=vui<0.210;
    const VniProv=c*Acv+mu*AvfProv*fy;                       // kip/ft (P_c = 0)
    const rStr=(Vui/phiV)/Math.max(VniProv,1e-9), rCap=(Vui/phiV)/Math.max(VniCap,1e-9);
    const rMin=minWaived? 0 : AvfMin/Math.max(AvfProv,1e-9);
    const rIf=Math.max(rStr,rCap,rMin);
    return {x:r.x,vui,Vui,AvfReq:Math.max(AvfReq,0),AvfMin,AvfProv,VniCap,capOK,minWaived,VniProv,rStr,rCap,rMin,r:rIf,
            ok:(AvfProv>=AvfReq-1e-9)&&(minWaived||AvfProv>=AvfMin-1e-9)&&capOK};
  });
  const wIface=iface.reduce((b,q)=>q.r>b.r?q:b,iface[0]);

  // camber & deflections (midspan, inches; + = up)
  const Eci=lo.Eci, Ecf=cp.Ecg, Ig=g.I, IcC=cp.Ic;
  const PiC=ss.Aps*fpi;
  const Ps=ss.AsStraight*fpi, Ph2=ss.AsHarp*fpi;
  const eS=g.yb-ss.cgsStraight, eHm=g.yb-(+ss.hp.yMid), eHe=g.yb-(+ss.hp.yEnd);
  const aH=ss.hp.frac*Lin;
  const dPS=(Ps*eS*Lin*Lin/8 + (ss.nh>0? Ph2*(eHm*Lin*Lin/8-(eHm-eHe)*aH*aH/6):0))/(Eci*Ig);
  const dSW=5*(wG/12)*Lin**4/(384*Eci*Ig);
  const dDK=5*(wDk/12)*Lin**4/(384*Ecf*Ig);
  const dSD=5*((wBar+wDW)/12)*Lin**4/(384*Ecf*IcC);
  // Diaphragm point-load deflection at midspan (DC1, bare girder). For P at a (a<=L/2):
  // δ = P a (3L² - 4a²)/(48 E I); symmetric for a>L/2 by mirroring.
  const dDia=(inp.loads.diaph||[]).reduce((s,d)=>{
    const P=+d.P; let a=+d.a*12; if(!(P>0)||a<0||a>Lin) return s;
    if(a>Lin/2) a=Lin-a;
    return s + P*a*(3*Lin*Lin-4*a*a)/(48*Ecf*Ig);
  },0);
  // PBD-E: owner live load deflection limit (MassDOT Part I 3.5.6.1, typical interior beam: L/1000 with sidewalks, else L/800);
  // 0 = the tool's L/800 as before (AASHTO 2.5.2.6.2)
  const llOwnDen=(ownO==='MassDOT'&&window.PBD&&window.PBD.ownRule&&window.PBD.ownRule('MassDOT','defl.ll')&&!cp.extG)?(inp.opt.sidewalk===true?1000:800):0;
  const mu_=inp.opt.mult;
  const cam={rel:dPS-dSW, erect:mu_.psE*dPS-mu_.swE*dSW,
             afterDeck:mu_.psE*dPS-mu_.swE*dSW-dDK-dDia,
             // MassDOT beam-seat camber: erection mult. on PS & SW, then ALL dead load (deck+haunch,
             // diaphragms, SIDL) subtracted at a 1.0 "locked-in" factor; long-term effects ignored.
             seat:mu_.psE*dPS-mu_.swE*dSW-dDK-dDia-dSD,
             final:mu_.psF*dPS-mu_.swF*dSW-mu_.dkF*dDK-mu_.dkF*dDia-mu_.sdF*dSD,
             dPS,dSW,dDK,dSD,dDia,
             dLL:5*(MLL*12)*Lin*Lin/(48*Ecf*IcC), llLim:Lin/(llOwnDen||800)};
  if(llOwnDen) cam.llDen=llOwnDen;
  if(useFE){ cam.MLLd=inp.loads.llAuto? hl.M*dfm : +inp.loads.MLL; cam.dLL=5*(cam.MLLd*12)*Lin*Lin/(48*Ecf*IcC); }   // PBD-G: simple-span estimate

  // Fatigue I — bottom-fiber stress range in strand (LRFD 5.5.3)
  // Fatigue DF = single-lane interior DF without multiple-presence (÷1.2); IM = 1.15; Fatigue I load factor 1.75 (T.3.4.1-1, 2016+)
  // Fatigue DF: prefer the single-lane value pulled from LLDF (loads.fatM); else approximate as
  // the one-lane moment DF ÷ 1.2 (removes the multiple-presence factor per LRFD 3.6.1.4.3b).
  // Exterior girder (auto DF): the single-lane moment DF is the lever rule (4.6.2.2.2d), also checked against
  // the rigid-section value for one lane (C4.6.2.2.2d), both with m = 1.2 → ÷1.2. (Was the interior m1 for
  // both positions.)
  const dfFatAuto=df.ext? Math.max(df.lever,df.rigid1||0) : df.m1;
  const dfFat=(+inp.loads.fatM>0)? +inp.loads.fatM : (inp.loads.dfAuto? dfFatAuto : +inp.loads.dfm)/1.2;
  const Mfat1=hl.Mfat*1.15*dfFat;            // k-ft, one fatigue truck w/ IM, per girder (unfactored)
  // bottom-fiber concrete stress under: effective prestress + permanent loads + Fatigue I LL (γ=1.75)
  // 5.5.3.1: fatigue of reinforcement need be checked only if the section is cracked under
  // (unfactored perm. + prestress) + Fatigue I; compressive stress trigger 2*fpe basis.
  const Mperm=Mg(L/2)+Mdc1(L/2)+Mdc2(L/2)+Mdw(L/2); // k-in
  const fbPerm=PeM/g.A+PeM*ss.eMid/g.Sb-(Mg(L/2)+Mdc1(L/2))/g.Sb
               -(Mdc2(L/2)+Mdw(L/2))/cp.Sbc;            // +comp
  const dfbFat=1.75*Mfat1*12/cp.Sbc;         // stress change (decompression) from Fatigue I LL (γ=1.75), ksi
  const fbMinFat=fbPerm-dfbFat;              // bottom fiber under perm + Fatigue I
  const frFat=0.095*sqrt(m.fc);              // cracking trigger 5.5.3.1
  const cracksFat=fbMinFat< -frFat;          // tension exceeds 0.095√f'c → cracked, must check strand
  // strand stress range (only meaningful if cracked); uncracked → range ~ n*Δfc, well below limit
  const nFat=inp.str.Ep/cp.Ecg;
  const dfStrand=cracksFat? nFat*dfbFat*1.5 : nFat*dfbFat; // approx; cracked amplifies
  const fatLimit=cracksFat?18.0:18.0;        // 5.5.3.3: 18 ksi for f_min/f_pu type radius (large radius)
  // Concrete compression (5.5.3.1): for fully prestressed components the compressive stress due to the
  // Fatigue I load combination plus one-half the sum of the effective prestress and the permanent loads shall
  // not exceed 0.40 f'c. Girder top fibre at midspan, where the Fatigue I moment acts: ½(f_pe + permanent) +
  // 1.75·M_fat·12/S_tg. Girder bottom fibre: ½(f_pe + permanent), the largest value over the span (live load
  // only relieves the bottom fibre, and the fatigue truck may be off the span). f_pe without elastic gains.
  const ftPermFat=PeM/g.A-PeM*ss.eMid/g.St+(Mg(L/2)+Mdc1(L/2))/g.St+(Mdc2(L/2)+Mdw(L/2))/cp.Stg;   // +comp
  const dftFat=1.75*Mfat1*12/cp.Stg;
  const fcTopFat=0.5*ftPermFat+dftFat;
  const botPermFat=grid.reduce((b,r)=>{ const f=r.s3Bot+(+inp.opt.gLLs3||0)*(mLL*r.Mll)/cp.Sbc; return f>b.f?{f,x:r.x}:b; },{f:-Infinity,x:L/2});
  const fcBotFat=0.5*botPermFat.f;
  const fcFatLim=0.40*m.fc;
  const fcFatTop=fcTopFat>=fcBotFat;
  const fcFat={top:fcTopFat,topPerm:ftPermFat,dTop:dftFat,bot:fcBotFat,botPerm:botPermFat.f,xBot:botPermFat.x,lim:fcFatLim,
               v:fcFatTop?fcTopFat:fcBotFat, x:fcFatTop?L/2:botPermFat.x, where:fcFatTop?'top':'bottom',
               dc:Math.max(fcTopFat,fcBotFat)/fcFatLim, ok:Math.max(fcTopFat,fcBotFat)<=fcFatLim};
  const fat={Mfat:hl.Mfat,dfFat,Mfat1,fbPerm,dfbFat,fbMinFat,frFat,cracksFat,dfStrand,fatLimit,
             dc:dfStrand/fatLimit, ok:dfStrand<=fatLimit, extDF:!!(df.ext&&inp.loads.dfAuto&&!(+inp.loads.fatM>0)), conc:fcFat};

  // handling (lifting/hauling) & deck design (optional modules)
  let handling=null, deck=null;
  if(inp.handling&&inp.handling.on) handling=handlingCalc(inp,g,cp,ss,fpe,fpi,lo.Eci);
  if(inp.deck&&inp.deck.on){ deck=deckCalc(inp,g,cp);
    if(!(+inp.deck.sTop>0)||!(+inp.deck.sBot>0)) warns.push(`Deck bar spacing must be greater than 0 (top ${inp.deck.sTop}″, bottom ${inp.deck.sBot}″) — no deck steel is credited where it is 0.`); }

  // continuity for LL + SIDL: negative moment over the pier (optional)
  let cont=null;
  if(inp.cont&&inp.cont.on){
    const cn=inp.cont, negLL=useFE?null:negMomentHL93(L);
    // dead-load pier moments: from external demands at span ends if present; PBD-G: else the continuous unit (useFE)
    let MDC2n, MDWn, MLLn, llSrc, pier=null;
    if(useExt){
      // most-negative end moment for each component over the selected span (k-ft, per girder)
      const endNeg=(fn)=>{const a=fn(0)/12,b=fn(L)/12; return Math.min(a,b);};
      MDC2n=Math.abs(endNeg(Mdc2)); MDWn=Math.abs(endNeg(Mdw));
      MLLn=Math.abs(ext.pierNegM());                 // already DF & IM applied
      llSrc='MIDAS pier moment';
    }else{
      // PBD-G: the interior-support end(s) of this span on the continuous unit; the end with the larger factored negative
      // moment governs. M_DC2 = −w_bar M_w, M_DW = −w_DW M_w (M_w: three-moment, per klf), M_LL = −DF_m M_LL−/lane (HL-93 with
      // IM, 90 % of two trucks plus the lane between the points of contraflexure, 3.6.1.3.1); a negative restraint moment adds.
      const pe=[fe.pierL?{x:0,nd:fe.endL,side:'left'}:null, fe.pierR?{x:L,nd:fe.endR,side:'right'}:null].filter(Boolean).map(q=>{
        const mdc2=-wBar*q.nd.Mw, mdw=-wDW*q.nd.Mw, mll=-dfm*q.nd.Mn, mrn=restr?Math.max(0,-(q.x===0?restr.MrL:restr.MrR)):0;
        return {...q, MDC2n:mdc2, MDWn:mdw, MLLn:mll, Mrn:mrn, Mu:eta*(1.25*mdc2+1.5*mdw+1.75*(mLL*mll)+mrn)}; });
      pier=pe.reduce((a,b)=>b.Mu>a.Mu?b:a);
      MDC2n=pier.MDC2n; MDWn=pier.MDWn; MLLn=pier.MLLn; llSrc=pier.nd.two?'2 trucks, 0.9 factor':'single truck/tandem';
    }
    // PBD-G: a negative restraint moment at the pier adds to the pier demand (5.12.3.3.2, γ = 1.0); 0 without restraint
    const MrnPier = pier? pier.Mrn : (restr? Math.max(0,-Math.min(restr.MrL,restr.MrR)) : 0);
    const MuN=eta*(1.25*MDC2n+1.5*MDWn+1.75*(mLL*MLLn)+MrnPier)*12;   // kip-in (η, mLL: owner, 1 for AASHTO)
    const As=+cn.As, fyr=+cn.fy, dN=cp.hc-(+cn.dTop);
    const b1g=clamp(0.85-0.05*(m.fc-4),0.65,0.85);
    const aN=As*fyr/(0.85*m.fc*g.bbf), cN=aN/b1g, tbf=g.isNext?g.next.ft:g.d[2];
    const etN=0.003*(dN/cN-1);
    const phiN=clamp(0.75+0.15*(etN-0.002)/0.003,0.75,0.9);
    const MnN=As*fyr*(dN-aN/2), phiMnN=phiN*MnN;
    cont={negLL,MDC2n,MDWn,MLLn,MuN,As,fyr,dN,aN,cN,etN,phiN,MnN,phiMnN,b1g,tbf,llSrc,extPier:useExt,
          aOK:aN<=tbf,dc:MuN/phiMnN};
    if(!cont.aOK) warns.push(`Negative-moment compression block a = ${fmt(aN,1)}″ exceeds the bottom-flange thickness (${fmt(tbf,1)}″) — rectangular-block assumption is unconservative; refine.`);
    cont.unit=contU;
    if(useFE) cont.pier=pier;
    if(restr){ cont.restr=restr; cont.MrnPier=MrnPier; }

    // ---- PBD-G: positive moment connection at the interior support(s) (5.12.3.3.8a: stress in the positive moment
    // continuity reinforcement ≤ 36.0 ksi). Service moment after continuity at the girder end (C5.12.3.3.2: M_res = M_rc +
    // M_sh + M_SIDL; LL per 5.12.3.3.5): M = M_r + M_DC2 + M_DW + m_LL M_LL+ (γ = 1.0); tension T = 0.9 M / (0.9 h_c)
    // (C5.12.3.3.5, h_c = composite depth; axial restraint forces not computed: bearings free longitudinally);
    // A_s,req = T / 36 ksi. Checked when the connection steel A_s,pos is entered (cont.AsPos).
    const pends=[contU.s>1?0:null, contU.s<contU.spans.length?L:null].filter(v=>v!=null);
    const pc=pends.map(x=>{ const mr=restr?(x===0?restr.MrL:restr.MrR):0, mdc2=Mdc2(x)/12, mdw=Mdw(x)/12, mll=Math.max(0,MLLpos(x)/12);
      return {x,mr,mdc2,mdw,mll,M:mr+mdc2+mdw+mLL*mll}; });
    if(pc.length){ const q=pc.reduce((a,b)=>b.M>a.M?b:a), T=q.M>0? 0.9*q.M*12/(0.9*cp.hc) : 0, AsP=+cn.AsPos>0? +cn.AsPos : 0;
      cont.conn={...q, hc:cp.hc, T, fsL:36, AsReq:T/36, AsProv:AsP, fs:AsP>0? T/AsP : null, dc:AsP>0? T/AsP/36 : null}; }

    // ---- PBD-G: Service at interior supports (5.12.3.3.5), the stations of the half span next to an interior support:
    // top of girder, Service III with the negative LL: tension limit of Table 5.9.2.3.1b-1 with f'c for f'ci (bonded
    // reinforcement: 0.24√f'c; without: 0.0948√f'c ≤ 0.2 ksi; the Analysis Options bonded-reinforcement setting); or,
    // alternatively (cont.topRC), designed as reinforced concrete at the strength limit state (the pier check above).
    // Bottom fiber, Service I with the negative LL: compression limits of 5.9.2.3.2a (0.45 f'c permanent, 0.60 f'c full).
    const gp=grid.filter(r=>nearPierX(r.x));
    if(gp.length){
      const bonded=!!inp.opt.relBondedReinf, topLim=bonded? 0.24*sqrt(m.fc) : Math.min(0.0948*sqrt(m.fc),0.2);
      const wT=gp.reduce((b,r)=>r.s3TopN<b.s3TopN?r:b,gp[0]);
      const rB=r=>Math.max(r.s1BotN/lim.srvC1, r.s2BotN/lim.srvC2);
      const wB=gp.reduce((b,r)=>rB(r)>rB(b)?r:b,gp[0]), bPerm=wB.s1BotN/lim.srvC1>=wB.s2BotN/lim.srvC2;
      const fsT=Math.min(0.5*(+inp.opt.relFy||60),30), Ttop=wT.s3TopN<0? releaseTensionForce(g,wT.s3TopN,wT.s3BotN) : 0;
      // bonded reinforcement for the 0.24√f'c limit (Table 5.9.2.3.1b-1): the tension force of the uncracked girder at
      // 0.5 f_y ≤ 30 ksi (f_y of the Analysis Options bonded steel); checked when the steel in the girder top near the
      // interior support is entered (cont.AsTop), else reported
      cont.svc={topRC:!!cn.topRC, bonded, topLim, wT, wB, bPerm, fBot:bPerm?wB.s1BotN:wB.s2BotN, limBot:bPerm?lim.srvC1:lim.srvC2, rBot:rB(wB),
        fsT, Ttop, AsTop:Ttop/fsT, AsTopProv:+cn.AsTop>0? +cn.AsTop : 0};
    }
  }

  // ---- Load rating (LRFR, MBE) — flexure, HL-93 ----
  // RF = (φc·φs·φRn − γDC·DC − γDW·DW) / (γLL·LL(1+IM))   (MBE Eq. 6A.4.2.1-1)
  // Condition factor φc and system factor φs (MBE 6A.4.2.3 / 6A.4.2.4) are inputs (default 1.0); their product
  // is floored at 0.85 (MBE Eq. 6A.4.2.1-3) and capped at 1.0. Applied to the flexure and shear strength
  // ratings and to the user-entered vehicles; not to the Service III rating (a stress limit). (Was 1.0 fixed.)
  const rtF=(v)=>{ if(v===''||v==null) return 1; const n=+v; return (isFinite(n)&&n>0)? n : 1; };
  const phiCraw=rtF(inp.opt.rtPhiC), phiSraw=rtF(inp.opt.rtPhiS);
  const phiCS=clamp(phiCraw*phiSraw,0.85,1.0);
  const phiC=phiCS;
  const RnMid=fMid.phiMn/12;                  // k-ft, factored resistance at midspan
  const MDCmid=(Mg(L/2)+Mdc1(L/2)+Mdc2(L/2))/12; // k-ft
  const MDWmid=Mdw(L/2)/12;
  const MLLr=MLL;                            // k-ft, HL-93 incl. IM & DF (midspan)
  const rateAt=(Rn_,MDC_,MDW_,MLL_,gLL)=>{ const cap=phiC*Rn_-1.25*MDC_-1.50*MDW_; return gLL>0? cap/(gLL*MLL_):0; };
  // Flexure rated at the GOVERNING station of flexFull (lowest inventory RF over the stations where the +LL
  // moment is positive), with φMn, DC, DW and +LL at that station — the strength check already uses flexFull
  // (F5), and debond terminations / development / continuous demands can put the minimum RF off midspan.
  // (Was midspan only.)
  let rGov=null;
  flexFull.forEach(r=>{ const mll=r.mLLpos; if(!(mll>1e-6)||!(r.phiMn>0)) return;
    const mdc=r.mSW+r.mDC1+r.mDC2, mdw=r.mDW, rn=r.phiMn/12, rf=rateAt(rn,mdc,mdw,mll,1.75);
    if(!rGov||rf<rGov.RFinv) rGov={x:r.x,Rn:rn,MDC:mdc,MDW:mdw,MLL:mll,RFinv:rf}; });
  if(!rGov) rGov={x:L/2,Rn:RnMid,MDC:MDCmid,MDW:MDWmid,MLL:MLLr,RFinv:rateAt(RnMid,MDCmid,MDWmid,MLLr,1.75)};
  const Rn=rGov.Rn, MDC=rGov.MDC, MDWr=rGov.MDW;
  const RFinv=rGov.RFinv;                                   // Strength I Inventory
  const RFopr=rateAt(rGov.Rn,rGov.MDC,rGov.MDW,rGov.MLL,1.35); // Strength I Operating
  const RTinv=RFinv*36, RTopr=RFopr*36;      // HL-93 "tons": no MBE basis (HL-93 has no gross weight) — not displayed
  const rating={x:rGov.x,Rn,MDC,MDW:MDWr,MLL:rGov.MLL,RFinv,RFopr,RTinv,RTopr,
                okInv:RFinv>=1.0,okOpr:RFopr>=1.0,
                phiC:phiCraw,phiS:phiSraw,phiCS,phiCSfloor:phiCraw*phiSraw<0.85-1e-9,phiCScap:phiCraw*phiSraw>1+1e-9,
                mid:{Rn:RnMid,MDC:MDCmid,MDW:MDWmid,MLL:MLLr,RFinv:rateAt(RnMid,MDCmid,MDWmid,MLLr,1.75),RFopr:rateAt(RnMid,MDCmid,MDWmid,MLLr,1.35)}};

  // ---- Service III load rating (MBE 6A.5.4.1) — bottom-fiber tension, prestressed concrete ----
  // Rearranges the Service III tension check into RF form at the governing bottom-tension section.
  // Bottom-fiber stress (tension negative here): f = f_ps(+comp) − f_DC − f_DW − γLL·f_LL ≥ −f_r.
  // RF = ( f_r + f_ps − γDC·f_DC − γDW·f_DW ) / ( γLL · f_LL ),  with the MBE Service III factors
  // γDC = γDW = 1.0, γLL = 0.8. f_r is the allowable tension (5.9.2.3.2b, corrosion-dependent).
  const s3sec=wS3;                                   // governing Service III section
  const fps_b = s3sec.Aps>0? (PeM/g.A + PeM*ss.eMid/g.Sb) : (s3sec.Pe? 0:0); // net prestress comp @ bottom
  // recompute the prestress term at THIS section (eccentricity varies), plus load tensions:
  const Pe_s3 = s3sec.Aps*fpe;
  const fPS = Pe_s3/g.A + Pe_s3*s3sec.e/g.Sb;        // +comp, resistance side
  const fDC = (s3sec.Mg+s3sec.Mdk)/g.Sb + s3sec.Msd/cp.Sbc; // bottom tension from DC (girder+deck non-comp, barrier comp)
  const fDW = 0;                                     // DW is inside Msd(=DC2+DW); split below
  // split Msd into barrier(DC2) and wearing(DW) for proper γ factors:
  const MdwB = Mdw(s3sec.x);                         // k-in wearing surface at section
  const Mdc2B = Mdc2(s3sec.x);                       // k-in barrier
  const fDC2 = Mdc2B/cp.Sbc, fDWr = MdwB/cp.Sbc;     // bottom tension (comp section)
  const fDCtot = (s3sec.Mg+s3sec.Mdk)/g.Sb + fDC2;   // all DC bottom tension
  const fLL = s3sec.Mll/cp.Sbc;                      // bottom tension from LL (unfactored, DF+IM incl.)
  const fr_s3 = lim.srvT;                            // allowable Service III tension (ksi)
  const gDCs=1.0, gDWs=1.0, gLLs=0.8;
  const s3rate=(gLL)=>{ const num=fr_s3 + fPS - gDCs*fDCtot - gDWs*fDWr; return gLL>0&&fLL>0? num/(gLL*fLL):(fLL<=0?99:0); };
  const RFs3inv=s3rate(0.8);                         // Service III (inventory-level, MBE γLL=0.8)
  const svcRating={x:s3sec.x, fPS, fDC:fDCtot, fDW:fDWr, fLL, fr:fr_s3, gLL:gLLs,
                   RF:RFs3inv, RT:RFs3inv*36, ok:RFs3inv>=1.0,
                   fbot:fPS - fDCtot - fDWr - gLLs*fLL};   // net Service III bottom stress (+comp)

  // ---- Shear load rating (MBE 6A.5.6) — at the governing shear section ----
  // RF = (φVn − γDC·V_DC − γDW·V_DW) / (γLL·V_LL). Component shears taken at the governing section
  // (where Vu/φVn is max, excluding the bearing face). φVn is the same MCFT capacity the design uses.
  const vsx=wShear.x;
  const V_DCr=Math.abs(Vg(vsx)+Vdc1(vsx)+Vdc2(vsx));   // DC shear magnitude (girder+deck+barrier)
  const V_DWr=Math.abs(Vdw(vsx));                       // DW shear magnitude
  const V_LLr=Math.abs(VLLx(vsx));                      // LL+IM shear (envelope, DF+IM incl.)
  const phiVn_r=phiV*wShear.Vn;
  const shrate=(gLL)=>{ const cap=phiC*phiVn_r-1.25*V_DCr-1.50*V_DWr; return gLL>0&&V_LLr>0? cap/(gLL*V_LLr):(V_LLr<=0?99:0); };   // φc·φs applied (see above)
  const RFvInv=shrate(1.75), RFvOpr=shrate(1.35);
  const shrRating={x:vsx, phiVn:phiVn_r, VDC:V_DCr, VDW:V_DWr, VLL:V_LLr,
                   RFinv:RFvInv, RFopr:RFvOpr, RTinv:RFvInv*36, RTopr:RFvOpr*36,
                   okInv:RFvInv>=1.0, okOpr:RFvOpr>=1.0};

  // ---- User-entered rating vehicles (legal / permit) ----
  // The user supplies the fully-factored LL moment / shear (DF, IM, MPF, and the LRFR live-load
  // factor already applied). Capacity = φMn (flexure, midspan) / φVn (shear, governing section);
  // dead load uses the app's γDC=1.25, γDW=1.50 demands. RF = (φR − γDC·D − γDW·D) / (entered LL).
  // A single entered moment has no station, so the vehicles stay at midspan (φMn and DL there). φc·φs applied.
  const capMflex = phiC*RnMid;                  // k-ft, φc·φs·φMn at midspan
  const capVshear = phiC*phiVn_r;               // kip, φc·φs·φVn at governing shear section
  const D_M_DC = MDCmid, D_M_DW = MDWmid;       // k-ft dead-load moments at midspan
  const D_V_DC = V_DCr, D_V_DW = V_DWr;         // kip dead-load shears (from shear rating above)
  const vehRatings = (inp.rateVeh||[]).map(v=>{
    const Mll=+v.M||0, Vll=+v.V||0, W=+v.W||0;   // W = vehicle gross weight (tons) for tonnage, optional
    const capM = capMflex - 1.25*D_M_DC - 1.50*D_M_DW;
    const capV = capVshear - 1.25*D_V_DC - 1.50*D_V_DW;
    const RFm = Mll>0? capM/Mll : (Mll<=0? 99:0);
    const RFv = Vll>0? capV/Vll : (Vll<=0? 99:0);
    const RF = Math.min(RFm, RFv);
    const gov = RFm<=RFv? 'flexure':'shear';
    return {name:v.name||'Vehicle', M:Mll, V:Vll, W, RFm, RFv, RF, gov,
            RT:W>0? RF*W : null, ok:RF>=1.0};
  });

  // ---- Crack control (5.6.7) — only relevant if Service III bottom is in tension ----
  const wS3v=wS3.s3Bot;                       // governing bottom service stress (+comp)
  const cracked=wS3v<0;
  const fssBot=cracked? -wS3v : 0;            // tensile stress magnitude (ksi) ~ steel service stress proxy
  const dcCrack=2.0;                          // assumed clear cover + half bar (in)
  const betaCr=1+dcCrack/(0.7*(g.h-dcCrack));
  const gammaE=0.75;                          // class 2 exposure (use 1.0 for class 1)
  const fssSteel=cracked? Math.min((inp.str.Ep/cp.Ecg)*fssBot, 0.6*inp.str.fpu):0; // strand stress incr
  const sMaxCrack=cracked? Math.max(700*gammaE/(betaCr*Math.max(fssSteel,1))-2*dcCrack,4):999;
  const crack={cracked,fssBot,betaCr,gammaE,sMaxCrack,
               note:cracked?'Service III section is in tension — verify bonded reinforcement spacing':'Section uncracked under Service III — 5.6.7 spacing check not triggered'};

  // ---- Haunch / screed elevation profile from camber (tenth points) ----
  const haunch=[];
  for(let i=0;i<=10;i++){const xf=i*L/10, par=4*xf*(L-xf)/(L*L); // parabolic shape factor (0 ends,1 mid)
    const buildup=Math.max(inp.th + cam.afterDeck*par,0.5); // haunch needed to hold grade
    haunch.push({x:xf,par,camErect:cam.erect*par,camDeck:cam.afterDeck*par,camSeat:cam.seat*par,buildup});
  }

  // master checks
  const checks=[
    {n:'Release comp',v:wRelC.relBot,lim:lim.relC,r:wRelC.relBot/lim.relC,loc:wRelC.x,u:'ksi'},
    {n:'Release tens',v:wRelT.relTop,lim:-lim.relT,r:wRelT.relTop<0? -wRelT.relTop/lim.relT:0,loc:wRelT.x,u:'ksi'},
    {n:'Release tens (+M, bot)',v:wRelBT.relBot,lim:-lim.relT,r:wRelBT.relBot<0? -wRelBT.relBot/lim.relT:0,loc:wRelBT.x,u:'ksi'},
    {n:'Srv comp (perm)',v:wS1.s1Top,lim:lim.srvC1,r:wS1.s1Top/lim.srvC1,loc:wS1.x,u:'ksi'},
    {n:'Srv comp (full)',v:wS2.s2Top,lim:lim.srvC2,r:wS2.s2Top/lim.srvC2,loc:wS2.x,u:'ksi'},
    ...(wS2T?[{n:'Srv tens (top)',v:wS2T.s2Top,lim:-lim.srvT,r:wS2T.s2Top<0? -wS2T.s2Top/lim.srvT:0,loc:wS2T.x,u:'ksi'}]:[]),
    {n:'Srv III tens',v:wS3.s3Bot,lim:-lim.srvT,r:wS3.s3Bot<0? -wS3.s3Bot/lim.srvT:0,loc:wS3.x,u:'ksi'},
    {n:'Deck comp',v:wDkC.dkC,lim:lim.dkC2,r:wDkC.dkC/lim.dkC2,loc:wDkC.x,u:'ksi'},
    {n:'Flexure',v:flexGov.Mu/12,lim:flexGov.phiMn/12,r:flexGov.r,loc:flexGov.x,u:'k-ft'},
    {n:'Min reinf',v:minGov.req/12,lim:minGov.phiMn/12,r:minGov.r,loc:minGov.x,u:'k-ft'},
    {n:'Shear',v:wShear.Vu,lim:phiV*wShear.Vn,r:wShear.dc,loc:wShear.x,u:'kip'},
    {n:'Long. reinf (5.7.3.5)',v:wLong.Tdem,lim:wLong.Tcap,r:wLong.Tcap>0?wLong.Tdem/wLong.Tcap:0,loc:wLong.x,u:'kip'},
    (wIface.rMin>=wIface.rStr&&wIface.rMin>=wIface.rCap)
      ? {n:'Interface shear (5.7.4)',v:wIface.AvfMin,lim:wIface.AvfProv,r:wIface.r,loc:wIface.x,u:'in²/ft'}
      : {n:'Interface shear (5.7.4)',v:wIface.Vui/phiV,lim:(wIface.rCap>=wIface.rStr?wIface.VniCap:wIface.VniProv),r:wIface.r,loc:wIface.x,u:'kip/ft'},
    {n:'Splitting steel (5.9.4.4)',v:splitDem,lim:splitPr,r:splitDC,loc:0,u:'kip'},
    {n:'Fatigue I (strand)',v:fat.dfStrand,lim:fat.fatLimit,r:fat.dc,loc:L/2,u:'ksi'},
    {n:'Fatigue I (concrete, 5.5.3.1)',v:fat.conc.v,lim:fat.conc.lim,r:fat.conc.dc,loc:fat.conc.x,u:'ksi'},
    {n:'LL deflection',v:cam.dLL,lim:cam.llLim,r:cam.dLL/cam.llLim,loc:L/2,u:'in'},
  ];
  if(noStrands) checks.unshift({n:'Prestressing strands',v:0,lim:1,r:Infinity,loc:0,u:'strands'});
  // Box and slab beams are exempt, so the check is omitted entirely rather than pushed
  // as a trivially-green row that would read as "verified".
  if(!conf.exempt) checks.push({n:'Confinement steel (5.9.4.4.2)',v:conf.gov.v,lim:conf.gov.lim,r:conf.dc,loc:0,u:'in'});
  // Release-tension steel: only meaningful when the higher 0.24√f'ci limit is being claimed. It
  // verifies the provided bonded steel actually carries the concrete tensile force behind that limit.
  if(inp.opt.relBondedReinf) checks.push({n:'Release tens. steel (5.9.2.3.1b)',v:relSteel.AsReq,lim:relSteel.AsProv,r:relSteel.dc,loc:relSteel.x,u:'in²'});
  if(cont) checks.push({n:'Neg flexure (pier)',v:cont.MuN/12,lim:cont.phiMnN/12,r:cont.dc,loc:cont.pier?cont.pier.x:L,u:'k-ft'});
  // PBD-G: continuity checks at interior supports (5.12.3.3.5 Service; 5.12.3.3.8a positive moment connection)
  if(cont&&cont.svc){ const v=cont.svc;
    if(!v.topRC){ checks.push({n:'Srv III top tens (pier, 5.12.3.3.5)',v:v.wT.s3TopN,lim:-v.topLim,r:v.wT.s3TopN<0? -v.wT.s3TopN/v.topLim:0,loc:v.wT.x,u:'ksi'});
      if(v.bonded&&v.Ttop>0&&v.AsTopProv>0) checks.push({n:'Top tens. steel (pier, 5.12.3.3.5)',v:v.AsTop,lim:v.AsTopProv,r:v.AsTop/v.AsTopProv,loc:v.wT.x,u:'in²'}); }
    checks.push({n:'Srv comp (bot, −M, 5.12.3.3.5)',v:v.fBot,lim:v.limBot,r:v.rBot,loc:v.wB.x,u:'ksi'}); }
  if(cont&&cont.conn&&cont.conn.AsProv>0&&cont.conn.T>0)
    checks.push({n:'Pos. moment connection (5.12.3.3.8)',v:cont.conn.fs,lim:cont.conn.fsL,r:cont.conn.dc,loc:cont.conn.x,u:'ksi'});
  if(handling){
    const lf=handling.lift, hl_=handling.haul;
    const wLiftT=Math.min(lf.fMidTop,lf.fMidBot,lf.fSupTop,lf.fSupBot); // most tensile
    const wHaulT=Math.min(hl_.fMidTop,hl_.fMidBot,hl_.fSupTop,hl_.fSupBot);
    checks.push({n:'Lifting stress',v:-wLiftT,lim:handling.limT,r:wLiftT<0?-wLiftT/handling.limT:0,loc:handling.aLift,u:'ksi'});
    checks.push({n:'Lifting FS (crack, screening)',v:1.0,lim:handling.FScrLift,r:handling.FScrLift>0?1.0/handling.FScrLift:9,loc:0,u:'FS'});
    checks.push({n:'Hauling FS (crack, screening)',v:1.0,lim:handling.FScrHaul,r:handling.FScrHaul>0?1.0/handling.FScrHaul:9,loc:0,u:'FS'});
  }
  if(deck){
    checks.push({n:'Deck +M',v:deck.Mu_pos,lim:deck.pos.phiMn,r:deck.pos.dc,loc:0,u:'k-ft/ft'});
    checks.push({n:'Deck −M',v:deck.Mu_neg,lim:deck.neg.phiMn,r:deck.neg.dc,loc:0,u:'k-ft/ft'});
    checks.push({n:'Deck overhang',v:deck.Mu_oh,lim:deck.ohCap.phiMn,r:deck.ohCap.dc,loc:0,u:'k-ft/ft'});
  }
  // ---- PBD-E: owner (DOT) checks, warnings and reported requirements (window.PBD.OWN_RULES). None for AASHTO. ----
  let ownR=null;
  if(ownO!=='AASHTO'&&window.PBD&&window.PBD.ownRule){
    const P_=window.PBD, rr=id=>P_.ownRule(ownO,id), fc=+m.fc, fci=+m.fci, oc=[];
    const push=(r,o)=>{ const c={n:r.nm,...o}; checks.push(c); oc.push({id:r.id,cite:P_.ownCite(r),...c}); };
    // Hold-down force of all draped strands, at jacking (f_pbt): each strand bends at two hold-down points (one with the
    // harp point at midspan), with a vertical force f_pbt·A_b·sin α at each, so the total is 2·n_h·f_pbt·A_b·sin α.
    // Beam weight = w_sw over the girder length L + 2·(girder end beyond the bearing).
    const rHd=rr('hd.max'); let hd=null;
    if(rHd&&ss.nh>0){ const alpha=Math.atan(ss.slope), Fstr=fpbt*ss.st.Ab*Math.sin(alpha), Ftot=2*ss.nh*Fstr;
      const Lg=L+2*(+inp.opt.endOh||0)/12, W=g.wsw*Lg, lim=rHd.value*W;
      hd={nh:ss.nh,slope:ss.slope,alpha,Ab:ss.st.Ab,Fstr,Ftot,Lg,wsw:g.wsw,W,frac:rHd.value,lim};
      push(rHd,{v:Ftot,lim,r:lim>0?Ftot/lim:Infinity,loc:ss.hp.frac*L,u:'kip'}); }
    // Debonded strands, share of all strands
    const rDb=rr('db.max'); let db=null;
    if(rDb&&ss.Ndebond>0){ const pct=ss.Ndebond/Math.max(ss.Ntot,1); db={n:ss.Ndebond,N:ss.Ntot,pct,max:rDb.value};
      push(rDb,{v:100*pct,lim:100*rDb.value,r:pct/rDb.value,loc:0,u:'%'}); }
    // Concrete strengths (a minimum is checked as limit / value, a maximum as value / limit)
    const rFcMin=rr('fc.min');
    if(rFcMin) push(rFcMin,{v:fc,lim:rFcMin.value.min,r:fc>0?rFcMin.value.min/fc:Infinity,loc:0,u:'ksi'});
    const rFcR=rr('fc.range');
    if(rFcR){ const lo=rFcR.value.min, hi=rFcR.value.max, rLo=fc>0?lo/fc:Infinity, rHi=fc/hi;
      push(rFcR,{v:fc,lim:rLo>=rHi?lo:hi,r:Math.max(rLo,rHi),loc:0,u:'ksi'}); }
    const rFciM=rr('fci.max');
    if(rFciM&&rFciM.kind==='shall-check') push(rFciM,{v:fci,lim:rFciM.value.max*fc,r:fc>0?fci/(rFciM.value.max*fc):Infinity,loc:0,u:'ksi'});
    if(rFciM&&rFciM.kind==='should-warning'&&fci>rFciM.value.max*fc+1e-9)
      warns.push(`${P_.ownCite(rFciM)}: release strength f′ci = ${fmt(fci,2)} ksi = ${fmt(fci/fc,2)} f′c is above about ${fmt(rFciM.value.max,2)} f′c = ${fmt(rFciM.value.max*fc,2)} ksi (strength at transfer from the stress calculations, limited to approximately 70% of f′c).`);
    const rFciR=rr('fci.range');
    if(rFciR){ const v=rFciR.value, b=[{lim:v.min*fc,r:fci>0?v.min*fc/fci:Infinity},{lim:v.max*fc,r:fc>0?fci/(v.max*fc):Infinity},{lim:v.cap,r:fci/v.cap}];
      const gv=b.reduce((a,q)=>q.r>a.r?q:a,b[0]); push(rFciR,{v:fci,lim:gv.lim,r:gv.r,loc:0,u:'ksi'}); }
    const rFcX=rr('fc.max');
    if(rFcX&&fc>rFcX.value.max+1e-9) warns.push(`${P_.ownCite(rFcX)}: girder f′c = ${fmt(fc,2)} ksi is above ${fmt(rFcX.value.max,1)} ksi; a strength above 8000 psi needs State Bridge Engineer approval.`);
    const rStd=rr('fc.std');
    if(rStd){ const v=rStd.value;
      if(g.isNext&&(Math.abs(fc-v.next.fc)>1e-9||Math.abs(fci-v.next.fci)>1e-9))
        warns.push(`${P_.ownCite(rStd)}: NEXT beams are designed with f′c = ${fmt(v.next.fc,1)} ksi and f′ci = ${fmt(v.next.fci,1)} ksi (entered ${fmt(fc,2)} / ${fmt(fci,2)} ksi).`);
      else if((g.isBox||g.isDeck)&&!v.std.some(s=>Math.abs(fc-s)<1e-9))
        warns.push(`${P_.ownCite(rStd)}: deck and box beams are designed with f′c = 6.5 ksi (8.0 ksi only to avoid a deeper beam); other strengths are discouraged (entered ${fmt(fc,2)} ksi).`);
      else if((g.isBox||g.isDeck)&&Math.abs(fc-6.5)<1e-9&&fci>v.fci65+1e-9)
        warns.push(`${P_.ownCite(rStd)}: with f′c = 6.5 ksi, f′ci is generally ${fmt(v.fci65,1)} ksi; a higher release strength (up to 0.8 f′c) only if required by design (entered ${fmt(fci,2)} ksi).`); }
    const rRel=rr('srv.relax');
    if(rRel&&inp.opt.corrosion!=='severe'&&Math.abs((+inp.opt.gLLs3)-rRel.value.gLL)>1e-9)
      warns.push(`${P_.ownCite(rRel)}: the 0.19√f′c tension limit (moderate exposure) is used with γLL = ${fmt(+inp.opt.gLLs3,2)} for Service III; MassDOT allows it (only when the next larger beam is the only alternative and the depth is critical) with γLL = 1.0.`);
    // Live load deflection: limit set with cam (MassDOT 3.5.6.1); the preferred L/1000 without sidewalks is a warning
    if(cam.llDen===800&&cam.dLL>Lin/1000+1e-12)
      warns.push(`MassDOT Bridge Manual Part I 3.5.6.1: live load deflection ${fmt(cam.dLL,2)} in is above the preferred L/1000 = ${fmt(Lin/1000,2)} in (no sidewalk: L/800 = ${fmt(Lin/800,2)} in is the limit).`);
    // Continuity
    let contReq=null;
    const rAge=rr('cont.age');
    if(rAge&&cont){ const td=+m.td; push(rAge,{v:td,lim:rAge.value,r:td>0?rAge.value/td:Infinity,loc:L,u:'days'}); }
    const rPos=rr('cont.pos');
    if(rPos&&cont){ // PBD-F: M_cr of the connection = f_r(diaphragm/deck concrete, 5.4.2.6) × composite S_bc (NCHRP 519 basis)
      const fcdC=+inp.mat.fcd, frC=0.24*Math.sqrt(fcdC), Mcr=frC*cp.Sbc/12; contReq={fcd:fcdC,fr:frC,Sbc:cp.Sbc,Mcr,f:rPos.value,req:rPos.value*Mcr,cite:P_.ownCite(rPos)}; }
    const rSim=rr('cont.simple');
    if(rSim&&cont) warns.push(`${P_.ownCite(rSim)}: members of multi-span bridges are designed as simple spans with a continuous deck and no positive moment connection; continuity for live load is on in this design (your choice).`);
    ownR={owner:ownO,eta:OL.eta,etaD:OL.etaD,etaR:OL.etaR,etaI:OL.etaI,mLL:OL.mLL,hd,db,contReq,checks:oc,
          llDen:cam.llDen||null};
  }
  const checksF=checks.map(c=>({...c,pass:c.r<=1.0001}));

  const OUT={g,cp,ss,lo,refFin,LT,totalLoss,fpe,fpeGain,gains,fpi,pctLoss,lim,grid,flexGrid,flexFull,fMid,MuMid,shearDiag,diagrams,
          Mcr,minMr,fcpe,fr,flexGov,minGov,shear,wShear,wLong,ldBonded,ldDebond,iface,wIface,AsSplit,AsSplitProv,splitPr,splitDem,splitDC,splitN_need,splitDir,splitH,splitZone,conf,relSteel,cam,fat,handling,deck,
          rating,svcRating,shrRating,vehRatings,crack,haunch,useExt,ext:useExt?{sel:ext.sel,spanLen:ext.spanLen,nStations:ext.slice.length,
            member:inp.external.member,liveLoadType:inp.external.liveLoadType,
            dfApplied:inp.external.distributionFactorApplied,imApplied:inp.external.impactApplied,
            DF:inp.external.distributionFactor,IM:inp.external.impactFactor}:null,
          ...(useFE?{fe:{spans:fe.spans,s:fe.s,n:fe.n,L:fe.L,MA:fe.MA,MB:fe.MB,Mw1:fe.Mw1,pierL:fe.pierL,pierR:fe.pierR,nEl:fe.nEl,
            mid:fe.mid,endL:fe.endL,endR:fe.endR,Mw:fe.Mw,Vw:fe.Vw}}:{}),
          checks:checksF,hl,df,dfm,dfv,MLL,VLL,
          wG,wDk,wBar,wDW,L,dfcd,phiV,cont,warns,fpbt,useT,Pdia,nDiaph:diaph.length,strandStages,stationStress,
          ...(ownR?{own:ownR}:{}),error:null};
  OUT.rv=psbReportVals(inp,OUT);   // PSRF: the report's intermediate values (moved from ReportTab, 2026-11-01)
  return OUT;
 }catch(err){ return {error:err.message||String(err)}; }
}

function Aps0(ss,R){ return ss.Aps*R.fpi; }   // P_i at the anchorage (old tab: ss.Aps*R.fpi)
/* PSRF (2026-11-01): the calculation report's intermediate values, moved unchanged from ReportTab ("recomputed intermediates for
   display") into the engine so that R holds them (R.rv) and both report tabs read them, nothing recomputed in a report. Same
   expressions, same inputs (R as computeAll returns it). Values are display intermediates of the engine's own results. */
function psbReportVals(inp,R){
  const g=R.g,cp=R.cp,ss=R.ss,m=inp.mat,lo=R.lo,L=R.L,Lin=L*12,ts=+inp.ts,th=+inp.th,Ep=+inp.str.Ep,fpu=+inp.str.fpu;
  const sh0=R.shear.find(s=>!s.isBearing)||R.shear[0];
  const row=loc=>R.grid.reduce((b,r)=>Math.abs(r.x-loc)<Math.abs(b.x-loc)?r:b,R.grid[0]);
  const cf=n=>R.checks.find(c=>c.n===n)||{loc:0,pass:true};
  const rMid=row(L/2);
  const Ad=cp.beff*cp.n*ts, yd=g.h+th+ts/2, Ah=g.btf*cp.n*th, yh=g.h+th/2;
  const Ic2=g.A*(cp.ybc-g.yb)**2, Ic3=cp.beff*cp.n*ts**3/12, Ic4=Ad*(yd-cp.ybc)**2,
        Ic5=g.btf*cp.n*th**3/12, Ic6=Ah*(yh-cp.ybc)**2;
  const em=ss.eMid, X1=g.I+em*em*g.A, MgM=R.wG*L*L/8*12;
  const ktdID=ktdAASHTO(m.td-m.ti,m.fci), ktdIF=ktdAASHTO(m.tfin-m.ti,m.fci),
        ktdDF=ktdAASHTO(m.tfin-m.td,m.fci), ktdK=12*(100-4*m.fci)/(m.fci+20);
  const gh=1.7-0.01*m.H, gst=5/(1+m.fci);
  const cM=(R.fe||R.useExt)&&R.fMid, Mbar=cM?R.fMid.mDC2*12:inp.loads.wBar*L*L/8*12, Mdw=cM?R.fMid.mDW*12:inp.loads.wDW*L*L/8*12, MLLm=R.MLL*12;   // PBD-G: continuous / imported midspan values
  const PeMid=rMid.Aps*R.fpe;
  const shx=sh0.x, V_=w=>w*(L/2-shx), Vg=V_(R.wG), Vdk=V_(R.wDk), Vbar=V_(R.wBar), Vdw=V_(R.wDW),
        Vll=R.VLL*(1-shx/L), apsX=ss.at(shx).Aps, fpo=0.7*fpu,
        rN=row(shx), MuU=Math.max(rN.Mu,Math.abs(sh0.Vu-sh0.Vp)*sh0.dv),
        cotT=1/Math.tan(sh0.theta*Math.PI/180),
        fgN=R.flexGrid.reduce((b,r)=>Math.abs(r.x-shx)<Math.abs(b.x-shx)?r:b,R.flexGrid[0]);
  const Ps=ss.AsStraight*R.fpi, Ph=ss.AsHarp*R.fpi, eS=g.yb-ss.cgsStraight,
        eHm=g.yb-(+ss.hp.yMid), eHe=g.yb-(+ss.hp.yEnd), aH=ss.hp.frac*Lin,
        d1=Ps*eS*Lin*Lin/(8*lo.Eci*g.I),
        d2=ss.nh>0? Ph*(eHm*Lin*Lin/8-(eHm-eHe)*aH*aH/6)/(lo.Eci*g.I):0;
  const niT=Ep/lo.Eci;
  const transAt=r=>{ const cgs=g.yb-r.e, At=g.A+(niT-1)*r.Aps,
    ybt=(g.A*g.yb+(niT-1)*r.Aps*cgs)/At,
    It=g.I+g.A*(ybt-g.yb)**2+(niT-1)*r.Aps*(ybt-cgs)**2;
    return {At,ybt,It,eT:ybt-cgs,Sbt:It/ybt,Stt:It/(g.h-ybt),P0:r.Aps*R.fpbt}; };
  const tRc=transAt(row(cf('Release comp').loc));
  /* PSRP2 (2026-11-01): the rest of the old tab's display arithmetic, moved here unchanged (LongTieBody, the continuity steps) */
  const tie=R.shear.map(r=>({Tps:r.Tcap-r.TsMild, dc:r.Tcap>0?r.Tdem/r.Tcap:0}));
  let cont=null;
  if(R.cont){ const fe=R.fe, nl=R.cont.negLL, rr=R.cont.restr;
    const MwMid=fe?fe.Mw(R.L/2):null;
    cont={MwMid, Vw0:fe?fe.Vw(0):null, Mdc2Mid:fe?R.wBar*MwMid:null, MdwMid:fe?R.wDW*MwMid:null,
      negC1:nl?1.33*Math.max(nl.M1,nl.Mtd)+nl.Mln:null, negC2:nl?0.9*(1.33*nl.M2+nl.Mln):null, resV:rr?(rr.MrR-rr.MrL)/R.L:null}; }
  /* the evaluated terms of the worked stress and resistance lines (the old tab's display arithmetic, same expressions) */
  const mrA=r=>(r&&r.mrp!=null)?r.mrp:0, mLLo=R.own?R.own.mLL:1, gl=+inp.opt.gLLs3;
  const rRc=row(cf('Release comp').loc), rRt=row(cf('Release tens').loc), rS1=row(cf('Srv comp (perm)').loc), rS3=row(cf('Srv III tens').loc);
  const terms={
    fcgp:[lo.Pi/g.A, lo.Pi*em*em/g.I, MgM*em/g.I],
    relBot:[rRc.Aps*R.fpi/g.A, rRc.Aps*R.fpi*rRc.e/g.Sb, rRc.Mg/g.Sb], relTop:[rRt.Aps*R.fpi/g.A, rRt.Aps*R.fpi*rRt.e/g.St, rRt.Mg/g.St],
    relBotT:[tRc.P0/tRc.At, tRc.P0*tRc.eT/tRc.Sbt, rRc.Mg/tRc.Sbt],
    s1Top:[rS1.Aps*R.fpe/g.A, rS1.Aps*R.fpe*rS1.e/g.St, (rS1.Mg+rS1.Mdk)/g.St, (rS1.Msd+mrA(rS1))/cp.Stg],
    s3Bot:[rS3.Aps*R.fpe/g.A, rS3.Aps*R.fpe*rS3.e/g.Sb, (rS3.Mg+rS3.Mdk)/g.Sb, (rS3.Msd+mrA(rS3)+gl*(mLLo*rS3.Mll))/cp.Sbc],
    fcpe:[PeMid/g.A, PeMid*ss.eMid/g.Sb],
    dv:[fgN.dp-fgN.a/2, 0.9*fgN.dp, 0.72*cp.hc],
    Vn:[sh0.Vc+sh0.Vs+sh0.Vp, 0.25*m.fc*g.bw*sh0.dv+sh0.Vp],
    minR:[R.Mcr/12, 1.33*R.MuMid/12],
    gainPerm:[R.gains.permanent+(+inp.opt.dfpSS), R.fpeGain+(+inp.opt.dfpSS)],
    Pi:Aps0(ss,R), Ptot:0.04*ss.Aps*R.fpi };
  /* the neutral axis of the stress diagram at each stage (fiber stresses linear over the girder depth, + compression) */
  const na=(t,b)=>(t*b<0)?g.h*b/(b-t):null;
  const naSt={rel:na(rRc.relTop,rRc.relBot), s3:na(rS3.s1Top,rS3.s3Bot)};
  return {terms,naSt,tie,cont,Ad,yd,Ah,yh,Ic2,Ic3,Ic4,Ic5,Ic6,em,X1,MgM,ktdID,ktdIF,ktdDF,ktdK,gh,gst,Mbar,Mdw,MLLm,PeMid,shx,Vg,Vdk,Vbar,Vdw,Vll,apsX,fpo,rN,MuU,cotT,fgN,
    Ps,Ph,eS,eHm,eHe,aH,d1,d2,niT,tRc};
}

