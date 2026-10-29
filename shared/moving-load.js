/* shared/moving-load.js — continuous-beam moving-load engine (window.SharedMovingLoad).
   Classic script, no DOM. Moved verbatim from Moving Load Generator.html (2026-10-29); the only edits replace the
   page's DOM reads with arguments (opt), so results are unchanged (tests/engine/moving-load.test.mjs).

   Units: lengths ft, section dimensions in, I in^4, E ksi (EI = E*I/144 kip-ft^2), loads kips and kips/ft,
   moments kip-ft, shears and reactions kips, deflections in.

   props(s, dk)            composite/non-composite section properties of a plate girder segment (+ deck)
   luDecomp(A,n), luSolve(A,n,b)   dense LU (in place) and solve
   analyze(m, opt)         influence lines (beam elements, variable EI by segment), LL envelopes for the vehicle
                           cases (primary with variable spacing, secondary, 2-vehicle multi case, Std. Spec. lane
                           loading), impact (const / Std. Spec. 3.8.2 / AREMA), step solver. m = the page's model
                           (readModel()). opt: {Lb:'span'|'max'|'total'|'user', aL: user L (ft), refine: bool,
                           vehicles: preset table used for m.secondary}. Defaults: 'span', 100, true, SharedVehicles.
                           m.simple: true = independent simple spans (moment release at every interior support;
                           added 2026-10-29). Default (absent/false): continuous over the interior supports, unchanged.
                           Simple: span effects come from that span only; interior support reactions are the left +
                           right span reactions summed; the multi-vehicle case is still gated to M with a negative
                           influence-line total (none in simple spans) and interior reactions (3.6.1.3.1).
   deflection(R, opt)      LL deflection envelope at the 1/20 points from analyze() result R.
                           opt: {mode:'lrfd'|'veh', DF, useIM}.
   absScan(R, analyzeFn)   absolute maxima per span (extra output sections; analyzeFn defaults to analyze).
   staticAnalysis(spec)    dead-load / uniform-load analysis of the same variable-EI beam, any number of spans
                           (added 2026-10-29): moments, shears, reactions and deflections at stations. See its header.
   camber(stages, opt)     dead-load deflection per stage and their sum (camber ordinates), from staticAnalysis. */
(function(){
function props(s,dk){
  const d=s.tb+s.D+s.tt;
  const parts=[[s.bb*s.tb,s.tb/2,s.bb*s.tb**3/12],[s.tw*s.D,s.tb+s.D/2,s.tw*s.D**3/12],[s.bt*s.tt,s.tb+s.D+s.tt/2,s.bt*s.tt**3/12]];
  let top=d;
  if(dk.comp){
    if(dk.inclH&&dk.th>0) parts.push([s.bt*dk.th/dk.n,d+dk.th/2,s.bt/dk.n*dk.th**3/12]);
    parts.push([dk.beff*dk.ts/dk.n,d+dk.th+dk.ts/2,dk.beff/dk.n*dk.ts**3/12]);
    top=d+dk.th+dk.ts;
  }
  const A=parts.reduce((a,p)=>a+p[0],0);
  if(!(A>0)) return {A:0,yb:0,I:0,Sbs:0,Sts:0,Sdk:null};
  const yb=parts.reduce((a,p)=>a+p[0]*p[1],0)/A;
  const I=parts.reduce((a,p)=>a+p[2]+p[0]*(p[1]-yb)**2,0);
  return {A,yb,I,Sbs:I/yb,Sts:I/(d-yb),Sdk:dk.comp?dk.n*I/(top-yb):null};
}
function luDecomp(A,n){
  for(let k=0;k<n;k++){const akk=A[k*n+k],rk=k*n;
    for(let i=k+1;i<n;i++){const ri=i*n,f=A[ri+k]/akk;if(f===0)continue;A[ri+k]=f;for(let j=k+1;j<n;j++)A[ri+j]-=f*A[rk+j];}}
}
function luSolve(A,n,b){
  const y=Float64Array.from(b);
  for(let i=0;i<n;i++){let s=y[i];const ri=i*n;for(let j=0;j<i;j++)s-=A[ri+j]*y[j];y[i]=s;}
  for(let i=n-1;i>=0;i--){let s=y[i];const ri=i*n;for(let j=i+1;j<n;j++)s-=A[ri+j]*y[j];y[i]=s/A[ri+i];}
  return y;
}
function analyze(m,opt){
  opt=opt||{}; const P=opt.vehicles||(window.SharedVehicles?window.SharedVehicles.build().presets:{});
  if(isNaN(m.E)) throw new Error('E steel is blank or not a number. Enter E in ksi.');
  if(!(m.E>0)) throw new Error(`E steel = ${m.E} ksi. E must be greater than 0 (the stiffness matrix is singular otherwise).`);
  if(m.spans.some(l=>isNaN(l))) throw new Error(`Every span length must be a number greater than 0; span ${m.spans.findIndex(l=>isNaN(l))+1} is blank or not a number.`);
  if(!m.spans.length||m.spans.some(l=>!(l>0))) throw new Error('Every span length must be greater than 0.');
  if(m.stdLane&&![m.stdLane.w,m.stdLane.PM,m.stdLane.PV].every(v=>isFinite(v)&&v>=0)) throw new Error('Std. Spec. lane loading: w, P moment and P shear must be numbers ≥ 0.');
  const ns=m.spans.length, sup=[0]; m.spans.forEach(l=>sup.push(sup[sup.length-1]+l)); const Lt=sup[ns];
  // Segment bounds
  const sb=[]; let c=0;
  m.segs.forEach((s,i)=>{const last=i===m.segs.length-1,len=last?Math.max(0,Lt-c):Math.max(0,Math.min(s.len,Lt-c));sb.push([c,c+len,s.I]);c+=len;});
  // Mesh: supports, 1/20 points of each span, segment transitions, then subdivide
  const key=[...sup]; m.spans.forEach((l,k)=>{for(let t=1;t<20;t++)key.push(sup[k]+l*t/20);});
  sb.forEach(b=>{if(b[1]>1e-6&&b[1]<Lt-1e-6)key.push(b[1]);});
  if(m.scanKeys)m.scanKeys.forEach(v=>{if(v>1e-6&&v<Lt-1e-6)key.push(v);}); // absolute-maximum refinement pass only
  key.sort((a,b)=>a-b); const ks=[]; key.forEach(v=>{if(!ks.length||v-ks[ks.length-1]>1e-6)ks.push(v);});
  const hmax=Lt/240, x=[ks[0]];
  for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i],n=Math.max(1,Math.ceil((b-a)/hmax-1e-9));for(let j=1;j<=n;j++)x.push(a+(b-a)*j/n);}
  const nn=x.length, nd=2*nn;
  const idxOf=v=>{let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=v)lo=md;else hi=md;}return Math.abs(x[lo]-v)<=Math.abs(x[hi]-v)?lo:hi;};
  const Iat=xx=>{for(const b of sb)if(xx>=b[0]&&xx<b[1])return b[2];return sb[sb.length-1][2];};

  // Simple spans (m.simple, 2026-10-29): the element starting at each interior support has its start rotation released
  // (pinned-fixed element, rotation condensed out), so no moment passes the support. hng[e]=1 marks those elements.
  const hng=new Uint8Array(Math.max(0,nn-1)); if(m.simple&&ns>1)for(let q=1;q<ns;q++)hng[idxOf(sup[q])]=1;
  // Global stiffness (v up, θ CCW), EI in kip-ft²
  const K=new Float64Array(nd*nd), ek=[], el=[];
  for(let e=0;e<nn-1;e++){
    const l=x[e+1]-x[e], k=m.E*Iat((x[e]+x[e+1])/2)/144/(l*l*l); ek.push(k); el.push(l);
    const M=hng[e]?[[3,0,-3,3*l],[0,0,0,0],[-3,0,3,-3*l],[3*l,0,-3*l,3*l*l]]:[[12,6*l,-12,6*l],[6*l,4*l*l,-6*l,2*l*l],[-12,-6*l,12,-6*l],[6*l,2*l*l,-6*l,4*l*l]], D=[2*e,2*e+1,2*e+2,2*e+3];
    for(let a=0;a<4;a++)for(let b=0;b<4;b++)K[D[a]*nd+D[b]]+=k*M[a][b];
  }
  const supNodes=sup.map(idxOf), isSup=new Uint8Array(nd); supNodes.forEach(i=>isSup[2*i]=1);
  const fmap=new Int32Array(nd).fill(-1), free=[];
  for(let d=0;d<nd;d++) if(!isSup[d]){fmap[d]=free.length;free.push(d);}
  const nf=free.length, A=new Float64Array(nf*nf);
  for(let i=0;i<nf;i++){const r=free[i]*nd;for(let j=0;j<nf;j++)A[i*nf+j]=K[r+free[j]];}
  luDecomp(A,nf);

  // Output effects and table rows (1/20 points of each span)
  const effs=[], mKey={}, vKey={}, rows=[];
  for(let k=0;k<ns;k++){const L=m.spans[k],a=sup[k];
    for(let t=0;t<=20;t++){const i=idxOf(a+L*t/20);
      let mi=mKey[i];
      if(mi===undefined){mi=mKey[i]=effs.length;effs.push({t:'M',node:i,x:x[i],spans:t===20&&k<ns-1?[k,k+1]:[k]});}
      const elx=t===20?i-1:i;
      let vi=vKey[elx];
      if(vi===undefined){vi=vKey[elx]=effs.length;effs.push({t:'V',el:elx,cutL:t!==20,x:x[i],spans:[k]});}
      rows.push({k,t,x:x[i],mi,vi});
    }}
  // Plate transitions (segment boundaries) as additional output sections
  const trans=[];
  sb.forEach(b=>{const xb=b[1];if(xb<=1e-6||xb>=Lt-1e-6||sup.some(s=>Math.abs(s-xb)<1e-6))return;
    const i=idxOf(xb);let k=0;while(k<ns-1&&xb>sup[k+1]-1e-9)k++;
    let mi=mKey[i],isNew=false;if(mi===undefined){mi=mKey[i]=effs.length;effs.push({t:'M',node:i,x:x[i],spans:[k]});isNew=true;}
    let vi=vKey[i];if(vi===undefined){vi=vKey[i]=effs.length;effs.push({t:'V',el:i,cutL:true,x:x[i],spans:[k]});isNew=true;}
    if(isNew)rows.push({k,t:20*(x[i]-sup[k])/m.spans[k],x:x[i],mi,vi,tr:true});
    trans.push({x:x[i],k,mi,vi});});
  rows.sort((a,b)=>a.k-b.k||a.x-b.x); rows.trans=trans;
  sup.forEach((s,q)=>effs.push({t:'R',node:supNodes[q],q,x:s,spans:q===0?[0]:q===ns?[ns-1]:[q-1,q],interior:q>0&&q<ns}));
  // Absolute-maximum scan passes only (m.scanM / m.scanV / m.scanKeys; never set for the reported envelope results):
  // extra M sections at the mesh nodes nearest the m.scanM positions, and V just right of every node (m.scanV).
  if(m.scanM||m.scanV){const spanAt=v=>{let k=0;while(k<ns-1&&v>sup[k+1]-1e-9)k++;return k;};
    (m.scanM||[]).forEach(v=>{const i=idxOf(v);if(mKey[i]!==undefined||supNodes.includes(i))return;
      mKey[i]=effs.length;effs.push({t:'M',node:i,x:x[i],spans:[spanAt(x[i])],scan:true});});
    if(m.scanV)for(let e=0;e<nn-1;e++){if(vKey[e]!==undefined)continue;
      vKey[e]=effs.length;effs.push({t:'V',el:e,cutL:true,x:x[e],spans:[spanAt((x[e]+x[e+1])/2)],scan:true});}}

  // Influence lines: unit downward load at every node
  const IL=effs.map(()=>new Float64Array(nn)), d=new Float64Array(nd), b=new Float64Array(nf);
  for(let j=0;j<nn;j++){
    const sq=supNodes.indexOf(j);
    if(sq>=0){effs.forEach((ef,ei)=>{if(ef.t==='R'&&ef.q===sq)IL[ei][j]=1;});continue;}
    b.fill(0); b[fmap[2*j]]=-1;
    const y=luSolve(A,nf,b); d.fill(0); for(let i=0;i<nf;i++)d[free[i]]=y[i];
    effs.forEach((ef,ei)=>{
      let v=0;
      if(ef.t==='M'){
        const e=ef.node<nn-1?ef.node:ef.node-1,l=el[e],k=ek[e],v1=d[2*e],t1=d[2*e+1],v2=d[2*e+2],t2=d[2*e+3];
        v=ef.node<nn-1? (hng[e]?0:-k*(6*l*v1+4*l*l*t1-6*l*v2+2*l*l*t2)) : k*(6*l*v1+2*l*l*t1-6*l*v2+4*l*l*t2);
      } else if(ef.t==='V'){
        const e=ef.el,l=el[e],k=ek[e];
        v=hng[e]?k*(3*d[2*e]-3*d[2*e+2]+3*l*d[2*e+3]):k*(12*d[2*e]+6*l*d[2*e+1]-12*d[2*e+2]+6*l*d[2*e+3]);
      } else {
        const r=2*ef.node; for(let cc=Math.max(0,r-4);cc<Math.min(nd,r+6);cc++) v+=K[r*nd+cc]*d[cc];
      }
      IL[ei][j]=v;
    });
  }
  // Shear IL has a unit jump at the cut: adjust the element containing the cut
  const ends=(ei,j)=>{const f=IL[ei],ef=effs[ei];let a=f[j],bb=f[j+1];if(ef.t==='V'&&j===ef.el){if(ef.cutL)a+=1;else bb-=1;}return [a,bb];};

  // Integrals for uniform loads: cumulative, patterned (+/−), prefix/suffix extremes
  const DER=effs.map((ef,ei)=>{
    const CI=new Float64Array(nn); let lp=0,ln=0;
    for(let j=0;j<nn-1;j++){const h=x[j+1]-x[j],[a,bb]=ends(ei,j);CI[j+1]=CI[j]+(a+bb)/2*h;
      if(a>=0&&bb>=0)lp+=(a+bb)/2*h; else if(a<=0&&bb<=0)ln+=(a+bb)/2*h;
      else{const t=a/(a-bb),A1=a*t*h/2,A2=bb*(1-t)*h/2;if(a>0){lp+=A1;ln+=A2;}else{ln+=A1;lp+=A2;}}}
    const pmin=new Float64Array(nn),pmax=new Float64Array(nn),smin=new Float64Array(nn),smax=new Float64Array(nn);
    pmin[0]=pmax[0]=CI[0]; for(let j=1;j<nn;j++){pmin[j]=Math.min(pmin[j-1],CI[j]);pmax[j]=Math.max(pmax[j-1],CI[j]);}
    smin[nn-1]=smax[nn-1]=CI[nn-1]; for(let j=nn-2;j>=0;j--){smin[j]=Math.min(smin[j+1],CI[j]);smax[j]=Math.max(smax[j+1],CI[j]);}
    return {CI,lp,ln,pmin,pmax,smin,smax,end:CI[nn-1]};
  });
  effs.forEach((ef,ei)=>{ef.neg=ef.t==='M'&&DER[ei].end<-1e-9*Lt*Lt;});

  // Impact per effect
  // AASHTO Std. Spec. 17th Ed. 3.8.2.1: I = 50/(L+125) <= 0.30; L per 3.8.2.2 (isMax: + effect, else − effect)
  const stdL=(ef,isMax)=>{const S=m.spans,k=ef.spans[0];
    if(ef.t==='V'){const a=sup[k],b=sup[k+1];return isMax?b-ef.x:ef.x-a;}
    if(ef.t==='M'&&!isMax&&ns>1){if(ef.spans.length>1)return (S[ef.spans[0]]+S[ef.spans[1]])/2;
      const q=k===0?1:k===ns-1?ns-1:(ef.x-sup[k]<=sup[k+1]-ef.x?k:k+1);return (S[q-1]+S[q])/2;}
    return ef.spans.reduce((a,s)=>a+S[s],0)/ef.spans.length;};
  const imOf=(ef,isMax=true)=>{if(m.imp.method==='std')return 1+Math.min(0.30,50/(Math.max(0,stdL(ef,isMax))+125));
    if(m.imp.method==='const')return m.imp.val;
    const Lb=opt.Lb!=null?opt.Lb:'span';
    const L=Lb==='user'?Math.max(1,opt.aL!=null?opt.aL:100):Lb==='max'?Math.max(...m.spans):Lb==='total'?m.spans.reduce((a,b)=>a+b,0):ef.spans.reduce((a,s)=>a+m.spans[s],0)/ef.spans.length;
    const I=100/m.imp.S+(L<80?40-3*L*L/1600:16+600/(L-30));
    return 1+(m.imp.bal?0.9:1)*I/100;};
  const imArr=effs.map(ef=>imOf(ef,true)), imMinArr=effs.map((ef,i)=>m.imp.method==='std'?imOf(ef,false):imArr[i]);
  const dfOf=(ef,v)=>ef.t==='M'?(v<0&&m.dfNeg>0?m.dfNeg:Math.max(...ef.spans.map(s=>m.dfM[s]))):ef.t==='V'?m.dfV[ef.spans[0]]:Math.max(...ef.spans.map(s=>m.dfV[s]));

  // Independent uniform load (lane patterned, or full length) — constant per effect
  const uw=(m.udl.mode==='lane'||m.udl.mode==='full')?m.udl.w:0;
  const laneMax=effs.map((ef,ei)=>{const uf=m.imp.onUdl?imArr[ei]:1;return m.udl.mode==='lane'?uf*uw*DER[ei].lp:uf*uw*DER[ei].end;});
  const laneMin=effs.map((ef,ei)=>{const uf=m.imp.onUdl?imMinArr[ei]:1;return m.udl.mode==='lane'?uf*uw*DER[ei].ln:uf*uw*DER[ei].end;});

  const res=effs.map(()=>({max:0,maxG:null,min:0,minG:null}));

  // Axle standing exactly at a shear cut (the unit jump in the V influence line): the envelope is the limit of the
  // axle approaching from either side, so count it with the left-side ordinate or the right-side ordinate, whichever
  // gives the larger value for the maximum and the smaller for the minimum. Returns [vMin,vMax], or null if not at the cut.
  const vJump=(cutEl,cutL,f,xp,P)=>{const c=cutL?cutEl:cutEl+1;if(Math.abs(xp-x[c])>1e-6)return null;
    const oL=cutL?f[c]:f[c]-1,u=P*oL,w=P*(oL+1);return [Math.min(u,w),Math.max(u,w)];};
  const cfgs=[];function sweep(cfg){cfgs.push(cfg);
    const nA=cfg.offs.length, Lv=cfg.offs[nA-1], tr=cfg.trail, ext=Lv+(tr?tr.gap:0)+m.step;
    const J=new Int32Array(nA),T=new Float64Array(nA),on=new Uint8Array(nA),XP=new Float64Array(nA);
    const act=[]; effs.forEach((ef,ei)=>{const s=cfg.sel(ef);if(s[0]||s[1])act.push([ei,s[0],s[1],imArr[ei],ef.t==='V'?ef.el:-1,ef.cutL,imMinArr[ei]]);});
    const loc=v=>{let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=v)lo=md;else hi=md;}return lo;};
    for(const dir of m.dirs){
      for(let p=-ext;p<=Lt+ext+1e-9;p+=m.step){
        let any=false;
        for(let a=0;a<nA;a++){const xp=p-dir*cfg.offs[a];
          if(xp<-1e-9||xp>Lt+1e-9){on[a]=0;continue;}
          on[a]=1;any=true;XP[a]=xp;const lo=loc(xp);J[a]=lo;T[a]=Math.min(1,Math.max(0,(xp-x[lo])/(x[lo+1]-x[lo])));}
        let sc=null;
        if(tr){const s0=p-dir*(Lv+tr.gap);if(dir>0){if(s0>0)sc=Math.min(s0,Lt);}else{if(s0<Lt)sc=Math.max(s0,0);}}
        if(!any&&sc===null)continue;
        let jc=0,tc=0; if(sc!==null){jc=loc(sc);tc=(sc-x[jc])/(x[jc+1]-x[jc]);}
        for(const [ei,dMax,dMin,im,cutEl,cutL,imn] of act){
          const f=IL[ei]; let tot=0,ps=0,ng=0,totN=0;
          for(let a=0;a<nA;a++){if(!on[a])continue;const j=J[a];let fa=f[j],fb=f[j+1];
            if(j===cutEl){if(cutL)fa+=1;else fb-=1;}
            const v=cfg.loads[a]*(fa+(fb-fa)*T[a]);
            if(cutEl>=0){const vj=vJump(cutEl,cutL,f,XP[a],cfg.loads[a]);if(vj){tot+=vj[1];totN+=vj[0];if(vj[1]>0)ps+=vj[1];if(vj[0]<0)ng+=vj[0];continue;}}
            tot+=v;totN+=v;if(v>0)ps+=v;else ng+=v;}
          const axMax=m.neglect?ps:tot, axMin=m.neglect?ng:totN;
          let uMax=0,uMin=0;
          if(sc!==null){const D=DER[ei],CIs=D.CI[jc]+(D.CI[jc+1]-D.CI[jc])*tc;
            if(dir>0){if(tr.trunc){uMax=CIs-Math.min(D.pmin[jc],CIs);uMin=CIs-Math.max(D.pmax[jc],CIs);}else uMax=uMin=CIs;}
            else{if(tr.trunc){uMax=Math.max(D.smax[jc+1],CIs)-CIs;uMin=Math.min(D.smin[jc+1],CIs)-CIs;}else uMax=uMin=D.end-CIs;}
            uMax*=tr.w;uMin*=tr.w;}
          const uf=m.imp.onUdl?im:1, ufn=m.imp.onUdl?imn:1;
          const vMax=cfg.scale*(im*axMax+uf*uMax+laneMax[ei]), vMin=cfg.scale*(imn*axMin+ufn*uMin+laneMin[ei]);
          const r=res[ei];
          if(dMax&&vMax>r.max+1e-9){r.max=vMax;r.maxG=gov(cfg,p,dir,on);}
          if(dMin&&vMin<r.min-1e-9){r.min=vMin;r.minG=gov(cfg,p,dir,on);}
        }
      }
    }
    // Shear: also place each axle exactly at the cut (the IL jump), so the limit from either side is always evaluated
    for(const dir of m.dirs)for(const [ei,dMax,dMin,,cutEl,cutL] of act){if(cutEl<0)continue;const xc=x[cutL?cutEl:cutEl+1];
      for(let a=0;a<nA;a++)refineAt(cfg,xc+dir*cfg.offs[a],dir,[[ei,dMax,dMin]]);}
  }
  const gov=(cfg,p,dir,on)=>({lab:cfg.lab,p,dir,pos:cfg.offs.map(o=>p-dir*o).filter((_,a)=>on[a])});
  const mk=(ax,vk,sv)=>{const offs=[0],loads=[ax[0][0]];for(let i=1;i<ax.length;i++){offs.push(offs[i-1]+(i+1===vk&&sv!=null?sv:ax[i][1]));loads.push(ax[i][0]);}return {offs,loads};};
  const rng=(a,bb,s)=>{const r=[];for(let v=a;v<=bb+1e-9;v+=s)r.push(+v.toFixed(3));if(!r.length||r[r.length-1]<bb-1e-9)r.push(bb);return r;};
  const all=()=>[1,1], trail=m.udl.mode==='trail'&&m.udl.w>0?{w:m.udl.w,gap:m.udl.gap,trunc:m.udl.trunc}:null;
  const varOK=m.vK>=2&&m.vK<=m.axles.length&&m.vMax>=m.vMin;
  const base=m.axles.filter(a=>a[0]>0).length===m.axles.length?m.axles:m.axles.map(a=>[Math.max(0,a[0]),a[1]]);

  // Case 1: primary vehicle (with variable spacing)
  (varOK?rng(m.vMin,m.vMax,m.hStep):[null]).forEach(sv=>{
    const v=mk(base,varOK?m.vK:0,sv);
    sweep({...v,trail,scale:1,lab:m.short+(sv!=null?` s=${sv}`:''),sel:all});
  });
  // Case 2: secondary vehicle (lane/uniform applies; trailing load does not)
  if(m.secondary&&P[m.secondary]){const v=mk(P[m.secondary].axles,0,null);sweep({...v,trail:null,scale:1,lab:m.secondary,sel:all});}
  // Case 3: multi-vehicle (negative moment in contraflexure zones + interior reactions)
  if(m.multi&&ns>1){
    const v=mk(base,varOK?m.vK:0,varOK&&m.mFixed>0?m.mFixed:null), Lv=v.offs[v.offs.length-1];
    const Hmax=Math.min(Lt,2*Math.max(...m.spans));
    rng(m.mHmin,Math.max(m.mHmin,Hmax),m.hStep).forEach(H=>{
      const offs=[...v.offs,...v.offs.map(o=>o+Lv+H)], loads=[...v.loads,...v.loads];
      sweep({offs,loads,trail,scale:m.mScale,lab:`${m.mScale}×2 ${m.short} H=${H}`,sel:ef=>[ef.t==='R'&&ef.interior,ef.t==='M'&&ef.neg]});
    });
  }

  // Warnings
  // ── Refinement: spacing/headway at 0.5 ft, then each governing position at 0.1 ft ──
  function refineAt(cfg,p,dir,list){   // function declaration (hoisted): also used by sweep() for the shear-jump positions
    const nA=cfg.offs.length,Lv=cfg.offs[nA-1],tr=cfg.trail,J=[],T=[],Pa=[],pos=[];
    for(let a=0;a<nA;a++){const xp=p-dir*cfg.offs[a];if(xp<-1e-9||xp>Lt+1e-9)continue;
      let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=xp)lo=md;else hi=md;}
      J.push(lo);T.push(Math.min(1,Math.max(0,(xp-x[lo])/(x[lo+1]-x[lo]))));Pa.push(cfg.loads[a]);pos.push(xp);}
    let sc=null;if(tr){const s0=p-dir*(Lv+tr.gap);if(dir>0){if(s0>0)sc=Math.min(s0,Lt);}else if(s0<Lt)sc=Math.max(s0,0);}
    if(!J.length&&sc===null)return;
    let jc=0,tc=0;if(sc!==null){let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=sc)lo=md;else hi=md;}jc=lo;tc=(sc-x[jc])/(x[jc+1]-x[jc]);}
    list.forEach(([ei,dMax,dMin])=>{
      const ef=effs[ei],f=IL[ei],im=imArr[ei],imn=imMinArr[ei],cutEl=ef.t==='V'?ef.el:-1;let tot=0,ps=0,ng=0,totN=0;
      for(let a=0;a<J.length;a++){const j=J[a];let fa=f[j],fb=f[j+1];if(j===cutEl){if(ef.cutL)fa+=1;else fb-=1;}
        const v=Pa[a]*(fa+(fb-fa)*T[a]);
        if(cutEl>=0){const vj=vJump(cutEl,ef.cutL,f,pos[a],Pa[a]);if(vj){tot+=vj[1];totN+=vj[0];if(vj[1]>0)ps+=vj[1];if(vj[0]<0)ng+=vj[0];continue;}}
        tot+=v;totN+=v;if(v>0)ps+=v;else ng+=v;}
      const axMax=m.neglect?ps:tot,axMin=m.neglect?ng:totN;let uMax=0,uMin=0;
      if(sc!==null){const D=DER[ei],CIs=D.CI[jc]+(D.CI[jc+1]-D.CI[jc])*tc;
        if(dir>0){if(tr.trunc){uMax=CIs-Math.min(D.pmin[jc],CIs);uMin=CIs-Math.max(D.pmax[jc],CIs);}else uMax=uMin=CIs;}
        else{if(tr.trunc){uMax=Math.max(D.smax[jc+1],CIs)-CIs;uMin=Math.min(D.smin[jc+1],CIs)-CIs;}else uMax=uMin=D.end-CIs;}
        uMax*=tr.w;uMin*=tr.w;}
      const uf=m.imp.onUdl?im:1,ufn=m.imp.onUdl?imn:1,vMax=cfg.scale*(im*axMax+uf*uMax+laneMax[ei]),vMin=cfg.scale*(imn*axMin+ufn*uMin+laneMin[ei]),r=res[ei];
      if(dMax&&vMax>r.max+1e-9){r.max=vMax;r.maxG={lab:cfg.lab,p,dir,pos:[...pos]};}
      if(dMin&&vMin<r.min-1e-9){r.min=vMin;r.minG={lab:cfg.lab,p,dir,pos:[...pos]};}
    });
  }
  if(opt.refine!==false){
    const have={};cfgs.forEach(c=>have[c.lab]=1);
    const newS=new Set(),newH=new Set();
    res.forEach(r=>[r.maxG,r.minG].forEach(g=>{if(!g)return;
      const s=g.lab.match(/ s=([\d.]+)$/),h=g.lab.match(/ H=([\d.]+)$/);
      for(let dd=-m.hStep+0.5;dd<m.hStep-1e-9;dd+=0.5){if(Math.abs(dd)<1e-9)continue;
        if(s&&varOK){const v=+(+s[1]+dd).toFixed(2);if(v>=m.vMin-1e-9&&v<=m.vMax+1e-9)newS.add(v);}
        if(h){const v=+(+h[1]+dd).toFixed(2);if(v>=m.mHmin-1e-9)newH.add(v);}}}));
    newS.forEach(sv=>{const lab=`${m.short} s=${sv}`;if(!have[lab])sweep({...mk(base,m.vK,sv),trail,scale:1,lab,sel:all});});
    if(m.multi&&ns>1&&newH.size){
      const v=mk(base,varOK?m.vK:0,varOK&&m.mFixed>0?m.mFixed:null),Lv=v.offs[v.offs.length-1];
      newH.forEach(H=>{const lab=`${m.mScale}×2 ${m.short} H=${H}`;if(have[lab])return;
        sweep({offs:[...v.offs,...v.offs.map(o=>o+Lv+H)],loads:[...v.loads,...v.loads],trail,scale:m.mScale,lab,sel:ef=>[ef.t==='R'&&ef.interior,ef.t==='M'&&ef.neg]});});
    }
    const byLab={};cfgs.forEach(c=>byLab[c.lab]=c);
    res.forEach((r,ei)=>[[r.maxG,true],[r.minG,false]].forEach(([g,isMax])=>{if(!g)return;const c=byLab[g.lab];if(!c)return;
      const p0=g.p,dr=g.dir,list=[[ei,isMax,!isMax]];
      for(let q=-m.step;q<=m.step+1e-9;q+=0.1)refineAt(c,+(p0+q).toFixed(3),dr,list);}));
  }

  // ── AASHTO Std. Spec. lane loading, separate case enveloped with the truck (17th Ed. 3.7.1.1, Fig. 3.7.6B, 3.11.3; impact 3.8.1) ──
  // max = I+(w*positive IL area + P*max ordinate); min = I-(w*negative IL area + P*min ordinate [+ P*min ordinate in one other span, negative moment, 2+ spans])
  if(m.stdLane){const SL=m.stdLane;
    effs.forEach((ef,ei)=>{
      const P1=ef.t==='M'?SL.PM:SL.PV, D=DER[ei], spMin=m.spans.map(()=>[0,0]);
      let hi=0,xh=0,lo=0,xl=0,kl=-1,k=0;
      for(let j=0;j<nn-1;j++){const [a,bb]=ends(ei,j),xm=(x[j]+x[j+1])/2;while(k<ns-1&&xm>sup[k+1])k++;
        [[a,x[j]],[bb,x[j+1]]].forEach(([v,xv])=>{if(v>hi){hi=v;xh=xv;}if(v<lo){lo=v;xl=xv;kl=k;}if(v<spMin[k][0])spMin[k]=[v,xv];});}
      let lo2=0,x2=null;
      if(ef.t==='M'&&ns>1&&kl>=0)spMin.forEach(([v,xv],s)=>{if(s!==kl&&v<lo2){lo2=v;x2=xv;}});
      const vMax=imArr[ei]*(SL.w*D.lp+P1*hi), vMin=imMinArr[ei]*(SL.w*D.ln+P1*(lo+lo2)), r=res[ei];
      const lab=`Std. lane ${P1}k`;
      if(vMax>r.max+1e-9){r.max=vMax;r.maxG={lab,p:xh,dir:1,pos:[xh],lane:true};}
      if(vMin<r.min-1e-9){r.min=vMin;r.minG={lab:x2!=null?`Std. lane 2×${P1}k`:lab,p:xl,dir:1,pos:x2!=null?[xl,x2]:[xl],lane:true};}
    });
  }

  const warn=[]; let segSum=0; m.segs.slice(0,-1).forEach(s=>segSum+=s.len);
  if(m.segs.length>1&&segSum>=Lt) warn.push('Segment lengths reach or exceed the girder length, so the last segment has zero length.');
  if(m.segs.some(s=>s.bad)) warn.push('A segment has invalid geometry (zero area or I); a placeholder stiffness was used.');
  if(m.vK>0&&!(m.vK>=2&&m.vK<=m.axles.length)) warn.push(`Variable spacing axle # must be between 2 and ${m.axles.length}; variable spacing was ignored.`);
  if(m.vK>=2&&m.vMax<m.vMin) warn.push('Variable spacing maximum is less than the minimum; variable spacing was ignored.');
  if(m.multi&&ns<2) warn.push('The multi-vehicle case needs at least two spans and is inactive for a single span.');
  if(m.simple&&ns>1) warn.push('Simple spans: each span is analysed as an independent simple span (no moment over the interior supports). An interior support reaction is the left-span plus right-span reaction (pier load per girder line). The multi-vehicle case applies to these interior reactions only (LRFD 3.6.1.3.1); there is no negative moment.');
  if(m.udl.mode!=='none'&&!(m.udl.w>0)) warn.push('A uniform load mode is selected but w = 0.');
  if([...m.dfM,...m.dfV].some(v=>!(v>0))) warn.push('One or more distribution factors are zero or blank.');
  if(m.imp.method==='const'&&m.imp.val<1) warn.push('The impact multiplier is below 1.0.');
  if(m.axles.some(a=>!(a[0]>0))) warn.push('One or more axles have zero or negative load.');
  if(m.short==='Fatigue'){const ll=m.llf,fl=Math.abs(ll-1.75)<1e-9||Math.abs(ll-0.80)<1e-9,fd=m.fatDF;
    if(fd&&!m.rail)warn.push(`LRFD fatigue truck: the fatigue DFs entered under Factors & Analysis are used for this vehicle (moment ${fd.M!=null?fd.M:'= highway span DFs'}, shear ${fd.V!=null?fd.V:'= highway span DFs'}, negative moment ${fd.N!=null?fd.N:fd.M!=null?fd.M:'= highway DF'}); they should be the ONE-LANE DF divided by 1.2 (LRFD 3.6.1.4.3b, C3.6.1.1.2). LLF = ${ll}: use γ = 1.75 (Fatigue I) or 0.80 (Fatigue II), Table 3.4.1-1.${fl?'':' The current LLF is not a fatigue load factor.'}`);
    else warn.push(`LRFD fatigue truck: the distribution factors and live load factor entered (LLF = ${ll}) are applied exactly as given. For fatigue use the ONE-LANE distribution factor divided by 1.2 to remove the multiple presence factor (LRFD 3.6.1.4.3b, C3.6.1.1.2), not the strength (multi-lane) DF, and γ = 1.75 (Fatigue I) or 0.80 (Fatigue II), Table 3.4.1-1.${fl?'':' The current LLF is not a fatigue load factor.'}${m.rail?'':' Enter the fatigue DFs under Factors & Analysis to apply them to this vehicle.'}`);}
  if(m.stdLane)warn.push(`Std. Spec. lane loading (${m.stdLane.w} k/ft + ${m.stdLane.PM} k moment / ${m.stdLane.PV} k shear and reactions; a second ${m.stdLane.PM} k in one other span for negative moment) is checked as a separate case and enveloped with the vehicle, with impact. Where it governs, the case reads "Std. lane" and "@" is the concentrated-load position.`);
  else if(m.short==='HS20'||m.short==='H20')warn.push(`${m.short}: the AASHTO Std. Spec. lane loading is not checked (Load Model Rules). It can govern longer spans (Std. Spec. 17th Ed. Art. 3.7.1.1, Fig. 3.7.6B).`);

  // Engine check: unit uniform load on all spans
  let th={1:[0.125,0.5],2:[-0.125,0.375],3:[-0.1,0.4],4:[-0.1071,0.3929]}[ns]||['n/a','n/a'], L1=m.spans[0];   // 5+ spans: no tabulated theory value (2026-10-29)
  if(m.simple&&ns>1)th=[0,0.5];   // independent simple spans (2026-10-29): M over the support 0, R_A = wL/2
  const mChk=ns>1?mKey[supNodes[1]]:rows.find(r=>r.k===0&&r.t===10).mi;
  const rA=effs.findIndex(ef=>ef.t==='R'&&ef.q===0);
  let sumR=0; effs.forEach((ef,ei)=>{if(ef.t==='R')sumR+=DER[ei].end;});
  const check=`<div>Mesh: ${nn} nodes, ${nn-1} elements (max element ≈ ${hmax.toFixed(2)} ft). Influence lines from ${nn} unit-load solutions.</div>
    <div>Unit uniform load on all spans, L = span 1:</div>
    <div>• ${ns>1?'M at first interior support':'M at midspan'} = <b>${(DER[mChk].end/(L1*L1)).toFixed(4)} wL²</b> (equal spans, uniform section theory: ${th[0]} wL²)</div>
    <div>• R_A = <b>${(DER[rA].end/L1).toFixed(4)} wL</b> (theory: ${th[1]} wL)</div>
    <div>• ΣR / wL_total = <b>${(sumR/Lt).toFixed(4)}</b> (must equal 1.0000)</div>
    <div class="hint">Theory values apply only when spans are equal and the section is uniform. Influence lines are exact at nodes and interpolated linearly between them.</div>`;

  // ── Step-mode solver: actual loads on the girder (exact for the given EI) ──
  const elOf=v=>{let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=v)lo=md;else hi=md;}return lo;};
  const spanOfX=v=>{for(let k=0;k<ns;k++)if(v<=sup[k+1]+1e-9)return k;return ns-1;};
  function solveOne(pl,uW){
    const FEF=new Float64Array(4*(nn-1)), eP=Array.from({length:nn-1},()=>[]);
    pl.forEach(([xp,Pk])=>{if(!Pk)return;const e=elOf(xp),L=el[e],a=Math.min(L,Math.max(0,xp-x[e])),bq=L-a;eP[e].push([a,Pk]);
      FEF[4*e]+=Pk*bq*bq*(3*a+bq)/L**3;FEF[4*e+1]+=Pk*a*bq*bq/(L*L);FEF[4*e+2]+=Pk*a*a*(a+3*bq)/L**3;FEF[4*e+3]-=Pk*a*a*bq/(L*L);});
    if(uW)for(let e=0;e<nn-1;e++){const w=uW[e];if(!w)continue;const L=el[e];FEF[4*e]+=w*L/2;FEF[4*e+1]+=w*L*L/12;FEF[4*e+2]+=w*L/2;FEF[4*e+3]-=w*L*L/12;}
    if(m.simple&&ns>1)for(let e=0;e<nn-1;e++){if(!hng[e])continue;const L=el[e],m0=FEF[4*e+1];   // released start: pinned-fixed fixed-end forces
      FEF[4*e]-=1.5*m0/L;FEF[4*e+2]+=1.5*m0/L;FEF[4*e+3]-=m0/2;FEF[4*e+1]=0;}
    const F=new Float64Array(nd);for(let e=0;e<nn-1;e++)for(let q=0;q<4;q++)F[2*e+q]-=FEF[4*e+q];
    const bb=new Float64Array(nf);for(let i=0;i<nf;i++)bb[i]=F[free[i]];
    const y=luSolve(A,nf,bb),dd=new Float64Array(nd);for(let i=0;i<nf;i++)dd[free[i]]=y[i];
    const f1=new Float64Array(nn-1),m1=new Float64Array(nn-1);
    for(let e=0;e<nn-1;e++){const l=el[e],k=ek[e],v1=dd[2*e],t1=dd[2*e+1],v2=dd[2*e+2],t2=dd[2*e+3];
      if(hng[e]){f1[e]=k*(3*v1-3*v2+3*l*t2)+FEF[4*e];m1[e]=FEF[4*e+1];continue;}
      f1[e]=k*(12*v1+6*l*t1-12*v2+6*l*t2)+FEF[4*e];m1[e]=k*(6*l*v1+4*l*l*t1-6*l*v2+2*l*l*t2)+FEF[4*e+1];}
    const rx=supNodes.map(sn=>{const r=2*sn;let s=0;for(let cc=Math.max(0,r-4);cc<Math.min(nd,r+6);cc++)s+=K[r*nd+cc]*dd[cc];return s-F[r];});
    return {f1,m1,eP,uW,rx};
  }
  // Returns sampled M and V (axle part and uniform part separately, so impact can be applied per span)
  function stepSolve(pl,ul){
    const ulPts=[],uW=new Float64Array(nn-1);
    ul.forEach(([a,bq,w])=>{if(!(w>0)||bq<=a)return;for(let e=elOf(a);e<nn-1&&x[e]<bq;e++){const s0=Math.max(a,x[e]),s1=Math.min(bq,x[e+1]);if(s1-s0<=1e-9)continue;if(s1-s0>=el[e]-1e-6)uW[e]+=w;else ulPts.push([(s0+s1)/2,w*(s1-s0)]);}});
    const S1=solveOne(pl,null),S2=solveOne(ulPts,uW);
    const ev=(S,e,s,inc)=>{let V=S.f1[e],M=-S.m1[e]+S.f1[e]*s;
      for(const [a,Pk] of S.eP[e]){if(a<s-1e-9||(inc&&a<=s+1e-9)){V-=Pk;M-=Pk*(s-a);}}
      if(S.uW){const w=S.uW[e];V-=w*s;M-=w*s*s/2;}return [M,V];};
    const out=[];
    for(let e=0;e<nn-1;e++){const L=el[e],ks=new Set([0,L]);
      [S1,S2].forEach(S=>S.eP[e].forEach(([a])=>{if(a>1e-9&&a<L-1e-9)ks.add(a);}));
      const sp=spanOfX(x[e]+L/2);
      [...ks].sort((p,q)=>p-q).forEach(s=>{const vs=s<=1e-9?[true]:s>=L-1e-9?[false]:[false,true];
        vs.forEach(inc=>{const [Ma,Va]=ev(S1,e,s,inc),[Mu,Vu]=ev(S2,e,s,inc);out.push([x[e]+s,Ma,Mu,Va,Vu,sp]);});});}
    return {pts:out,rAx:S1.rx,rU:S2.rx};
  }
  function stepCase(cs,sv,H){
    if(cs==='s'&&m.secondary&&P[m.secondary]){const v=mk(P[m.secondary].axles,0,null);return {...v,trail:null,scale:1};}
    if(cs==='m'){const v=mk(base,varOK?m.vK:0,varOK?(sv!=null?sv:(m.mFixed>0?m.mFixed:null)):null),Lv=v.offs[v.offs.length-1],h=H!=null?H:m.mHmin;
      return {offs:[...v.offs,...v.offs.map(o=>o+Lv+h)],loads:[...v.loads,...v.loads],trail,scale:m.mScale};}
    const v=mk(base,varOK?m.vK:0,varOK?(sv!=null?sv:m.vMin):null);return {...v,trail,scale:1};
  }
  const imSpan=m.spans.map((_,k)=>imOf({spans:[k]}));
  const effR=effs.filter(ef=>ef.t==='R'), imR=effs.map((ef,i)=>ef.t==='R'?imArr[i]:null).filter(v=>v!==null);

  return {m,effs,res,rows,x,sup,Lt,IL,ends,dfOf,warn,check,supNodes,stepSolve,stepCase,varOK,imSpan,imR,effR,A,nf,fmap,nn};
}
const ENGINE_ANALYZE=analyze;
function deflection(R,opt){
  const m=R.m,{x,nn,Lt,A,nf,fmap,supNodes}=R;
  const loc=v=>{let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=v)lo=md;else hi=md;}return lo;};
  // Sections = the 1/20 points; deflection IL by Maxwell's reciprocal theorem (inches)
  const secs=[],seen={};
  R.rows.forEach(r=>{const i=R.effs[r.mi].node;if(seen[i]===undefined){seen[i]=secs.length;secs.push({node:i,x:x[i],k:r.k});}});
  const G=secs.map(s=>{const g=new Float64Array(nn);if(supNodes.includes(s.node))return g;
    const b=new Float64Array(nf);b[fmap[2*s.node]]=-1;const y=luSolve(A,nf,b);
    for(let j=0;j<nn;j++){const f=fmap[2*j];g[j]=f>=0?12*y[f]:0;}return g;});
  const D=G.map(g=>{const CI=new Float64Array(nn);let lp=0,ln=0;
    for(let j=0;j<nn-1;j++){const h=x[j+1]-x[j],a=g[j],b=g[j+1];CI[j+1]=CI[j]+(a+b)/2*h;
      if(a>=0&&b>=0)lp+=(a+b)/2*h;else if(a<=0&&b<=0)ln+=(a+b)/2*h;else{const t=a/(a-b),A1=a*t*h/2,A2=b*(1-t)*h/2;if(a>0){lp+=A1;ln+=A2;}else{ln+=A1;lp+=A2;}}}
    return {CI,lp,ln,end:CI[nn-1]};});
  const mode=opt.mode,DF=opt.DF,useIM=opt.useIM,im=secs.map(s=>useIM?R.imSpan[s.k]:1);
  const laneOn=m.udl.w>0&&(m.udl.mode==='lane'||m.udl.mode==='full');
  const svs=[];if(R.varOK){for(let v=m.vMin;v<=m.vMax+1e-9;v+=m.hStep)svs.push(+v.toFixed(3));if(svs[svs.length-1]<m.vMax-1e-9)svs.push(m.vMax);}else svs.push(null);
  const cases=[];
  svs.forEach(sv=>{const c=R.stepCase('p',sv,null),lab=m.short+(sv!=null?` s=${sv}`:'');
    if(mode==='lrfd'){cases.push({c,aS:1,lane:false,trail:null,lab});if(laneOn)cases.push({c,aS:0.25,lane:true,trail:null,lab:`25% ${lab} + lane`});}
    else cases.push({c,aS:1,lane:laneOn,trail:c.trail,lab});});
  const res=secs.map(()=>({dn:0,dnG:null,up:0,upG:null}));
  cases.forEach(cc=>{
    const offs=cc.c.offs,loads=cc.c.loads,nA=offs.length,Lv=offs[nA-1],tr=cc.trail,ext=Lv+(tr?tr.gap:0)+m.step;
    for(const dir of m.dirs)for(let p=-ext;p<=Lt+ext+1e-9;p+=m.step){
      const J=[],T=[],Pl=[];
      for(let a=0;a<nA;a++){const xp=p-dir*offs[a];if(xp<-1e-9||xp>Lt+1e-9)continue;const j=loc(xp);J.push(j);T.push(Math.min(1,Math.max(0,(xp-x[j])/(x[j+1]-x[j]))));Pl.push(loads[a]);}
      let sc=null;if(tr){const s0=p-dir*(Lv+tr.gap);if(dir>0){if(s0>0)sc=Math.min(s0,Lt);}else if(s0<Lt)sc=Math.max(s0,0);}
      if(!J.length&&sc===null)continue;
      let jc=0,tc=0;if(sc!==null){jc=loc(sc);tc=(sc-x[jc])/(x[jc+1]-x[jc]);}
      secs.forEach((s,si)=>{const g=G[si];let v=0;for(let a=0;a<J.length;a++){const j=J[a];v+=Pl[a]*(g[j]+(g[j+1]-g[j])*T[a]);}v*=im[si]*cc.aS;
        const uf=m.imp.onUdl&&useIM?im[si]:1;let uDn=0,uUp=0;
        if(sc!==null){const Dd=D[si],CIs=Dd.CI[jc]+(Dd.CI[jc+1]-Dd.CI[jc])*tc,u=(dir>0?CIs:Dd.end-CIs)*tr.w*uf;uDn=uUp=u;}
        if(cc.lane){const w=m.udl.w*uf;uDn+=m.udl.mode==='lane'?w*D[si].ln:w*D[si].end;uUp+=m.udl.mode==='lane'?w*D[si].lp:w*D[si].end;}
        const vd=DF*(v+uDn),vu=DF*(v+uUp),r=res[si];
        if(vd<r.dn-1e-12){r.dn=vd;r.dnG={lab:cc.lab,p,dir};}
        if(vu>r.up+1e-12){r.up=vu;r.upG={lab:cc.lab,p,dir};}});
    }});
  return {secs,res};
}
function absScan(R,analyzeFn){
  const analyze=analyzeFn||ENGINE_ANALYZE;
  const m=R.m,ns=m.spans.length,sup=R.sup,X=R.x;
  const items=RR=>RR.effs.map((ef,ei)=>({ef,r:RR.res[ei],dfOf:RR.dfOf})).filter(o=>o.ef.t!=='R');
  const inSpan=(o,k)=>o.ef.t==='M'?o.ef.x>=sup[k]-1e-6&&o.ef.x<=sup[k+1]+1e-6:o.ef.spans[0]===k;
  const fac=(o,v,f)=>f?m.llf*o.dfOf(o.ef,v)*v:v;
  // Pass 1: same mesh, M at every analysis node and V just right of every node
  const R2=analyze({...m,scanM:[...X],scanV:true});
  let all=[...items(R),...items(R2)];
  // Pass 2: mesh points every 0.1 ft within one element length of each +M / −M candidate (factored and unfactored picks)
  const keys=new Set();
  for(let k=0;k<ns;k++)[false,true].forEach(f=>[true,false].forEach(isMax=>{let b=null;
    all.forEach(o=>{if(o.ef.t!=='M'||!inSpan(o,k))return;const v=fac(o,isMax?o.r.max:o.r.min,f);if(!b||(isMax?v>b.v:v<b.v))b={v,x:o.ef.x};});
    if(!b||Math.abs(b.v)<1e-9||b.x<=sup[k]+1e-6||b.x>=sup[k+1]-1e-6)return;
    let i=0;while(i<X.length-1&&X[i+1]<=b.x+1e-9)i++;const h=Math.max(X[i]-(X[i-1]!=null?X[i-1]:X[i]),(X[i+1]!=null?X[i+1]:X[i])-X[i])+1e-9;
    for(let j=Math.ceil((b.x-h)*10);j<=Math.floor((b.x+h)*10);j++){const v=+(j/10).toFixed(1);if(v>sup[k]+1e-6&&v<sup[k+1]-1e-6)keys.add(v);}}));
  if(keys.size){const R3=analyze({...m,scanKeys:[...keys],scanM:[...keys]});all=all.concat(items(R3).filter(o=>o.ef.scan));}
  return {all,inSpan,fac,nn:R.nn};
}

/* staticAnalysis(spec): linear static analysis of a continuous (or simple-span) beam with variable EI, any number of spans.
   Same beam elements, stiffness (EI = E*I/144 kip-ft^2), segment rule and LU solver as analyze(); loads are applied exactly
   (consistent fixed-end forces for uniform loads, point loads at nodes), so results at nodes are exact for the given EI.
   spec: { spans: [ft], E: ksi, segs: [{len (ft; last = remainder), I (in^4)}] (as m.segs) or sb: [[x0, x1, I]],
           simple: true = independent simple spans (default false = continuous over interior supports),
           loads: { w: kips/ft over the whole length, dist: [[x0, x1, w]] partial uniform loads, P: [[x, P]] point loads }
                  (downward positive), stations: [ft] (default: the 1/20 points of each span), hmax: max element (ft, default Lt/240) }
   returns { x, M (kip-ft, sagging +), VL / VR (kips, just left / right of the station; V = sum of forces to the left, up +),
             defl (in, downward +), R (kips per support, upward +), sup, Lt, nn } */
function staticAnalysis(spec){
  const spans=spec.spans.map(Number), ns=spans.length;
  if(!ns||spans.some(l=>!(l>0))) throw new Error('Every span length must be a number greater than 0.');
  if(!(spec.E>0)) throw new Error('E must be greater than 0 (ksi).');
  const sup=[0]; spans.forEach(l=>sup.push(sup[sup.length-1]+l)); const Lt=sup[ns];
  let sb=spec.sb;
  if(!sb){sb=[];let c=0;spec.segs.forEach((s,i)=>{const last=i===spec.segs.length-1,len=last?Math.max(0,Lt-c):Math.max(0,Math.min(s.len,Lt-c));sb.push([c,c+len,s.I]);c+=len;});}
  const ld=spec.loads||{}, dist=(ld.dist||[]).map(d=>[+d[0],+d[1],+d[2]]), pts=(ld.P||[]).map(p=>[+p[0],+p[1]]);
  if(ld.w) dist.push([0,Lt,+ld.w]);
  let st=spec.stations;
  if(!st){st=[];spans.forEach((l,k)=>{for(let t=0;t<=20;t++)st.push(sup[k]+l*t/20);});}
  st=st.map(Number).filter(v=>v>=-1e-9&&v<=Lt+1e-9).sort((a,b)=>a-b).filter((v,i,a)=>!i||v-a[i-1]>1e-6);
  if(spec.simple&&ns>1){   // independent simple spans: each span alone, results joined (VL from the left span, VR from the right one)
    const parts=spans.map((L,k)=>{const a=sup[k],b=sup[k+1],cl=(x0,x1)=>[Math.max(a,x0)-a,Math.min(b,x1)-a];
      const sbk=sb.map(q=>[...cl(q[0],q[1]),q[2]]).filter(q=>q[1]-q[0]>1e-9);
      return staticAnalysis({spans:[L],E:spec.E,sb:sbk.length?sbk:[[0,L,Iof(sb,(a+b)/2)]],hmax:spec.hmax||Lt/240,
        loads:{dist:dist.map(d=>[...cl(d[0],d[1]),d[2]]).filter(d=>d[1]-d[0]>1e-9),P:pts.filter(p=>p[0]>=a-1e-9&&p[0]<=b+1e-9&&(k===ns-1||p[0]<b-1e-9)).map(p=>[p[0]-a,p[1]])},
        stations:st.filter(v=>v>=a-1e-6&&v<=b+1e-6).map(v=>Math.min(L,Math.max(0,v-a)))});});
    const out={x:st,M:[],VL:[],VR:[],defl:[],R:Array(ns+1).fill(0),sup,Lt,nn:0,simple:true};
    parts.forEach((q,k)=>{out.R[k]+=q.R[0];out.R[k+1]+=q.R[1];out.nn+=q.nn;});
    st.forEach(v=>{let k=0;while(k<ns-1&&v>sup[k+1]+1e-6)k++;const q=parts[k],i=q.x.findIndex(u=>Math.abs(u+sup[k]-v)<1e-6);
      const atR=k<ns-1&&Math.abs(v-sup[k+1])<1e-6, r=atR?parts[k+1]:null;
      out.M.push(q.M[i]);out.VL.push(q.VL[i]);out.VR.push(r?r.VR[0]:q.VR[i]);out.defl.push(q.defl[i]);});
    return out;
  }
  // Mesh: supports, stations, segment and load boundaries, point loads; then subdivided to hmax
  const key=[...sup,...st]; sb.forEach(b=>key.push(b[0],b[1])); dist.forEach(d=>key.push(d[0],d[1])); pts.forEach(p=>key.push(p[0]));
  const ks=[]; key.filter(v=>v>=-1e-9&&v<=Lt+1e-9).sort((a,b)=>a-b).forEach(v=>{if(!ks.length||v-ks[ks.length-1]>1e-6)ks.push(v);});
  const hmax=spec.hmax||Lt/240, x=[ks[0]];
  for(let i=1;i<ks.length;i++){const a=ks[i-1],b=ks[i],n=Math.max(1,Math.ceil((b-a)/hmax-1e-9));for(let j=1;j<=n;j++)x.push(a+(b-a)*j/n);}
  const nn=x.length, nd=2*nn;
  const idxOf=v=>{let lo=0,hi=nn-1;while(hi-lo>1){const md=(lo+hi)>>1;if(x[md]<=v)lo=md;else hi=md;}return Math.abs(x[lo]-v)<=Math.abs(x[hi]-v)?lo:hi;};
  const K=new Float64Array(nd*nd), ek=[], el=[], wE=new Float64Array(nn-1), FEF=new Float64Array(4*(nn-1));
  for(let e=0;e<nn-1;e++){
    const l=x[e+1]-x[e], xm=(x[e]+x[e+1])/2, k=spec.E*Iof(sb,xm)/144/(l*l*l); ek.push(k); el.push(l);
    const M=[[12,6*l,-12,6*l],[6*l,4*l*l,-6*l,2*l*l],[-12,-6*l,12,-6*l],[6*l,2*l*l,-6*l,4*l*l]], D=[2*e,2*e+1,2*e+2,2*e+3];
    for(let a=0;a<4;a++)for(let b=0;b<4;b++)K[D[a]*nd+D[b]]+=k*M[a][b];
    let w=0; dist.forEach(d=>{if(xm>d[0]&&xm<d[1])w+=d[2];}); wE[e]=w;
    if(w){FEF[4*e]=w*l/2;FEF[4*e+1]=w*l*l/12;FEF[4*e+2]=w*l/2;FEF[4*e+3]=-w*l*l/12;}
  }
  const F=new Float64Array(nd); for(let e=0;e<nn-1;e++)for(let q=0;q<4;q++)F[2*e+q]-=FEF[4*e+q];
  pts.forEach(p=>{F[2*idxOf(p[0])]-=p[1];});
  const supNodes=sup.map(idxOf), isSup=new Uint8Array(nd); supNodes.forEach(i=>isSup[2*i]=1);
  const free=[]; for(let d=0;d<nd;d++) if(!isSup[d])free.push(d);
  const nf=free.length, A=new Float64Array(nf*nf), bb=new Float64Array(nf);
  for(let i=0;i<nf;i++){const r=free[i]*nd;for(let j=0;j<nf;j++)A[i*nf+j]=K[r+free[j]];bb[i]=F[free[i]];}
  luDecomp(A,nf); const y=luSolve(A,nf,bb), d=new Float64Array(nd); for(let i=0;i<nf;i++)d[free[i]]=y[i];
  const f1=new Float64Array(nn-1), m1=new Float64Array(nn-1);
  for(let e=0;e<nn-1;e++){const l=el[e],k=ek[e],v1=d[2*e],t1=d[2*e+1],v2=d[2*e+2],t2=d[2*e+3];
    f1[e]=k*(12*v1+6*l*t1-12*v2+6*l*t2)+FEF[4*e]; m1[e]=k*(6*l*v1+4*l*l*t1-6*l*v2+2*l*l*t2)+FEF[4*e+1];}
  const R=supNodes.map(sn=>{const r=2*sn;let s=0;for(let cc=Math.max(0,r-4);cc<Math.min(nd,r+6);cc++)s+=K[r*nd+cc]*d[cc];return s-F[r];});
  const out={x:st,M:[],VL:[],VR:[],defl:[],R,sup,Lt,nn};
  st.forEach(v=>{const i=idxOf(v);
    const mR=i<nn-1?-m1[i]:null, l=i>0?el[i-1]:0, w=i>0?wE[i-1]:0;
    const vL=i>0?f1[i-1]-w*l:0, mL=i>0?-m1[i-1]+f1[i-1]*l-w*l*l/2:null;
    out.M.push(mR!=null?mR:mL); out.VL.push(vL); out.VR.push(i<nn-1?f1[i]:0); out.defl.push(-12*d[2*i]);});
  return out;
}
function Iof(sb,xx){for(const b of sb)if(xx>=b[0]&&xx<b[1])return b[2];return sb[sb.length-1][2];}

/* camber(stages, opt): dead-load deflection of each stage (each a staticAnalysis spec with its own EI and loads, e.g. DC1
   on the steel section, DC2 + DW on the long-term composite section) and their sum at the same stations; the camber
   ordinate is the total downward deflection (in). opt.stations overrides each stage's stations.
   returns { x, stages: [defl arrays (in, down +)], total } */
function camber(stages, opt){
  const st=opt&&opt.stations, runs=stages.map(s=>staticAnalysis(st?{...s,stations:st}:s)), x=runs[0].x;
  return {x, stages:runs.map(r=>r.defl), total:x.map((_,i)=>runs.reduce((a,r)=>a+r.defl[i],0))};
}
window.SharedMovingLoad={props,luDecomp,luSolve,analyze,deflection,absScan,staticAnalysis,camber};
})();
