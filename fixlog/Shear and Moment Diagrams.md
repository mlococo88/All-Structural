# Fix log — Shear and Moment Diagrams.html

Governing basis used for fixes: structural mechanics (statics / Euler-Bernoulli beam), IBC 2021 §1604.3 (deflection limits use the span length l), AISC 360-16 / Manual 15th–16th Ed. Spec. G2.1 (web shear area A_w = d·t_w), AISC Shapes Database v16.0 (t_w values).

## 2026-10-04 — PR: claude/fix-shear-moment (PR link added after merge)

Verification method for every item: the page was loaded in jsdom from origin/main ("before") and from this branch ("after"). The model was set through the page's own globals, and `readIn(); solve(); updStats(); renderKaTeX()` were run. The report (`buildReport`) and CSV (`resultsRows`) were also generated. `node --check` passes on the inline script. CRLF line endings are kept. No console errors.

### F1. Deflection limit used the total beam length instead of each span's length   [calc change] [more conservative]
- **Where:** new helpers `deflSpans` / `deflGov` (after `readIn`, ≈ line 645), used in `updStats`, `drawDefl`, `plotDefl`, `renderKaTeX` and `buildReport`. Anchor text: `function deflSpans(){`
- **Problem:** `allow = totL/defLim` checked the largest deflection against (total length)/x. For n equal spans that is n times too lenient. Each span's δmax must be compared with its own L/x.
- **Governing provision:** IBC 2021 §1604.3 / Table 1604.3 (l = span length). (The same defect was fixed in Steel Beam Design - AISC 15th.html, "per-span length (defect fix)".)
- **Before:**
  ```js
  // updStats
        if(defLim>0){const allow=totL/defLim;ok=dm<=allow;lim=` / L/${defLim}=${allow.toFixed(4)} ${ok?'✓':'✗'}`;}
  // drawDefl
    if(defLim>0){const lim=totL/defLim;if(lim<=mx){const y=ty(lim);ctx.strokeStyle='#dc2626';ctx.setLineDash([6,3]);ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(PL,y);ctx.lineTo(W-PR,y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#dc2626';ctx.font='bold 9px system-ui';ctx.textAlign='left';ctx.fillText(`L/${defLim}=${lim.toFixed(4)}`,PL+4,y-4);}}
  // plotDefl
      if(defLim>0){const lim=totL/defLim;
        shapes.push({type:'line',xref:'paper',x0:0,x1:1,y0:lim,y1:lim,
          line:{color:'#dc2626',width:1.3,dash:'dash'}});
        anns.push({xref:'paper',x:0.01,y:lim,text:`limit L/${defLim} = ${lim.toFixed(4)} ${lu}`,
          showarrow:false,xanchor:'left',yanchor:'bottom',font:{size:9,color:'#dc2626',family:PFONT.family}});}
  // renderKaTeX
          if(defLim>0){const al=totL/defLim,ok=dm<=al;s6+=kb(`\\delta_{\\text{allow}}=L/${defLim}=${al.toFixed(5)}\\,\\text{${lu}}\\;\\Rightarrow\\;${ok?'\\text{OK}\\;\\checkmark':'\\text{NG}\\;\\times'}`);}
  // buildReport
      const al=defLim>0?totL/defLim:0;
      h+=`<tr><td>δ<sub>max</sub></td><td>${dm.toFixed(6)} ${lu}</td><td>${defLim>0?'L/'+defLim+' = '+al.toFixed(5)+' '+lu:'—'}</td><td>${defLim>0?(dm<=al?'<b style="color:#15803d">OK ✓</b>':'<b style="color:#b91c1c">NG ✗</b>'):'—'}</td></tr>`;}
  ```
- **After:**
  ```js
  /* Deflection check per span: δmax inside each span against that span's own L/x
     (was: total beam length / x). */
  function deflSpans(){
    if(!deD.length)return[];
    return spans.map((sp,i)=>{const xa=nodeX[i],xb=nodeX[i+1];let dm=0,dx=xa;
      deD.forEach(p=>{if(p.x>=xa-1e-9&&p.x<=xb+1e-9&&Math.abs(p.y)>dm){dm=Math.abs(p.y);dx=p.x;}});
      const allow=defLim>0?sp.L/defLim:0;
      return{i,L:sp.L,dm,x:dx,allow,ratio:allow>0?dm/allow:0,ok:allow>0?dm<=allow:true};});
  }
  function deflGov(){const a=deflSpans();return a.length?a.reduce((b,s2)=>s2.ratio>b.ratio?s2:b,a[0]):null;}
  // updStats
        if(defLim>0){const gv=deflGov();ok=deflSpans().every(s2=>s2.ok);lim=` / span ${gv.i+1}: L/${defLim}=${gv.allow.toFixed(4)} ${ok?'✓':'✗'}`;}
  // drawDefl (one limit line per span)
    if(defLim>0)deflSpans().forEach(s2=>{const lim=s2.allow;if(lim<=mx){const y=ty(lim),x1=tx(nodeX[s2.i]),x2=tx(nodeX[s2.i+1]);ctx.strokeStyle='#dc2626';ctx.setLineDash([6,3]);ctx.lineWidth=1.3;ctx.beginPath();ctx.moveTo(x1,y);ctx.lineTo(x2,y);ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#dc2626';ctx.font='bold 9px system-ui';ctx.textAlign='left';ctx.fillText(`L/${defLim}=${lim.toFixed(4)}`,x1+4,y-4);}});
  // plotDefl (one limit line per span)
      if(defLim>0)deflSpans().forEach(s2=>{const lim=s2.allow;
        shapes.push({type:'line',xref:'x',x0:nodeX[s2.i],x1:nodeX[s2.i+1],y0:lim,y1:lim,
          line:{color:'#dc2626',width:1.3,dash:'dash'}});
        anns.push({xref:'x',x:nodeX[s2.i],y:lim,text:`limit L/${defLim} = ${lim.toFixed(4)} ${lu}`,
          showarrow:false,xanchor:'left',yanchor:'bottom',font:{size:9,color:'#dc2626',family:PFONT.family}});});
  // renderKaTeX
          if(defLim>0)deflSpans().forEach(s2=>{s6+=kb(`\\text{Span ${s2.i+1}: }\\delta_{\\max}=${s2.dm.toFixed(5)}\\;${s2.ok?'\\le':'>'}\\;L_{${s2.i+1}}/${defLim}=${s2.L}/${defLim}=${s2.allow.toFixed(5)}\\,\\text{${lu}}\\;\\Rightarrow\\;${s2.ok?'\\text{OK}\\;\\checkmark':'\\text{NG}\\;\\times'}`);});
  // buildReport
      if(defLim>0)deflSpans().forEach(s2=>{h+=`<tr><td>δ<sub>max</sub>, span ${s2.i+1}</td><td>${s2.dm.toFixed(6)} ${lu}</td><td>L/${defLim} = ${s2.L}/${defLim} = ${s2.allow.toFixed(5)} ${lu}</td><td>${s2.ok?'<b style="color:#15803d">OK ✓</b>':'<b style="color:#b91c1c">NG ✗</b>'}</td></tr>`;});
      else h+=`<tr><td>δ<sub>max</sub></td><td>${dm.toFixed(6)} ${lu}</td><td>—</td><td>—</td></tr>`;}
  ```
- **Check case:** two spans, 10 ft + 20 ft, pins at A/B/C, UDL 1 k/ft over the whole beam, E = 4,176,000 ksf, I = 0.02 ft⁴ (EI = 83,520 k·ft²), limit L/360.
  - δmax = 0.01390 ft, in span 2.
  - Before: allowable = 30/360 = **0.0833 ft**, ratio 0.17.
  - After: span 2 allowable = 20/360 = **0.0556 ft**, ratio 0.25; span 1 δ = 0.00142 vs 10/360 = 0.0278. Both are OK here, but any beam with δ between L_span/x and L_total/x now fails, as it should.
- **How verified:** jsdom, old vs new (stats card, KaTeX text, report rows).
- **Other copies of this code:** Steel Beam Design - AISC 15th.html already has the per-span check (separate code, not changed).

### F2. No deflection for a cantilever (single fixed support)   [calc change] [more conservative: a check now exists]
- **Where:** `solve()`, deflection block (≈ line 590). Anchor text: `single fixed support (cantilever): δ = 0 and slope = 0 there`
- **Problem:** the integration constants were only set when `supIdx.length>=2`, so a fixed–free beam showed no deflection and no limit check.
- **Governing provision:** mechanics (δ = 0 and θ = 0 at the fixed support). Same approach as `deflCurve` in Steel Beam Design - AISC 15th.html.
- **Before:**
  ```js
        if(supIdx.length>=2){
          const xa=nodeX[supIdx[0]],xb=nodeX[supIdx[supIdx.length-1]];
          const F2at=x=>{const t=x/totL*400,i0=Math.min(399,Math.floor(t)),fr=t-i0;return F2[i0]+(F2[i0+1]-F2[i0])*fr;};
          // EI·v'' = M (v up) → v=(F2+c1x+c2)/EI ; δ(down) = −v = (−F2+C1x+C2)/EI
          const C1=(F2at(xb)-F2at(xa))/(xb-xa||1),C2=F2at(xa)-C1*xa;
          deD=moD.map((p,i)=>({x:p.x,y:(-F2[i]+C1*p.x+C2)/EI}));
        }
  ```
- **After:** (the interpolation is also generalised to the non-uniform stations of F3)
  ```js
        const xsD=moD.map(p=>p.x);
        const at=(A,x)=>{let lo=0,hi=xsD.length-1;while(hi-lo>1){const md=(lo+hi)>>1;if(xsD[md]<=x)lo=md;else hi=md;}
          const dx=xsD[hi]-xsD[lo];return dx>0?A[lo]+(A[hi]-A[lo])*(x-xsD[lo])/dx:A[lo];};
        const F2at=x=>at(F2,x),F1at=x=>at(F1,x);
        // EI·v'' = M (v up) → v=(F2+c1x+c2)/EI ; δ(down) = −v = (−F2+C1x+C2)/EI
        let C1=null,C2=null;
        if(supIdx.length>=2){
          const xa=nodeX[supIdx[0]],xb=nodeX[supIdx[supIdx.length-1]];
          C1=(F2at(xb)-F2at(xa))/(xb-xa||1);C2=F2at(xa)-C1*xa;
        } else if(supIdx.length===1&&nodes[supIdx[0]].t==='fixed'){
          // single fixed support (cantilever): δ = 0 and slope = 0 there
          const xa=nodeX[supIdx[0]];C1=F1at(xa);C2=F2at(xa)-C1*xa;
        }
        if(C1!==null)deD=moD.map((p,i)=>({x:p.x,y:(-F2[i]+C1*p.x+C2)/EI}));
  ```
  The KaTeX note now reads "…with δ=0 at supports (cantilever: δ=0 and slope=0 at the fixed support):".
- **Check case:** 10 ft cantilever, fixed at A, free at B, P = 5 k at the tip, EI = 83,520 k·ft², limit L/180.
  - Before: no deflection.
  - After: δ_tip = **0.019955 ft**. Hand: PL³/3EI = 5 × 1000 / (3 × 83,520) = 0.019955 ft ✓. Compared with 10/180 = 0.0556 ft → OK.
- **How verified:** jsdom, old vs new.
- **Other copies of this code:** none (Steel Beam Design has its own version).

### F3. 401-point grid clipped peaks at point loads, moments and supports   [calc change] [more conservative]
- **Where:** new function `stationList` (before `solveFor`, ≈ line 481); `solveFor` sampling; `solve()` (stations computed after `totL`, envelope loop); global `stX`; combo-label lookups in `drawDia` (cl2) and `peakNote`. Anchor text: `function stationList(){`
- **Problem:** V and M were sampled at 401 uniform points only. A point load, couple or interior support between grid points was not a station, so |M|max under a point load and |V| or |M| beside an interior support were under-reported.
- **Governing provision:** statics (V and M are evaluated exactly at every station by `evalVM`; only the station set changes). Ported from `stationList()` in Steel Beam Design - AISC 15th.html.
- **Before:**
  ```js
  // solveFor
    for(let i=0;i<=400;i++){const X=i/400*totL,e=evalVM(X,R,fac);sh.push({x:X,y:e.V});mo.push({x:X,y:e.M});}
  // solve (envelope)
      for(let i=0;i<=400;i++){
  ...
        const x=i/400*totL;
  // drawDia cl2
      if(envOn&&lblC){const i=Math.round(P.x/totL*400);const ck=lblC[i];if(ck)txt+=` (${COMBOS[ck].name})`;}
  // peakNote
    if(comboLbl){const i=Math.round(P.x/totL*400),ck=comboLbl[i];if(ck&&COMBOS[ck])t+=`<br>${COMBOS[ck].name}`;}
  ```
- **After:**
  ```js
  let stX=[]; // analysis stations (see stationList)
  /* Analysis stations: the uniform 400-division grid used before, plus every node and every
     point-load / moment position (each also at ±ε) and the trapezoid ends, so V and M peaks under
     concentrated loads and beside supports are evaluated exactly instead of being clipped by the grid.
     Same approach as stationList() in Steel Beam Design - AISC 15th.html. Depends only on geometry,
     so every combination shares the same stations (the envelope relies on that). */
  function stationList(){
    const L=totL,set=new Set(),EPS=1e-6;
    const add=x=>{if(x>=-1e-12&&x<=L+1e-12)set.add(Math.max(0,Math.min(L,+x.toFixed(9))));};
    for(let i=0;i<=400;i++)add(i/400*L);
    nodeX.forEach(x=>{add(x-EPS);add(x);add(x+EPS);});
    loads.forEach(ld=>{if(ld.off||ld.allSpans)return;
      const si=Math.min(ld.si||0,spans.length-1),x0=nodeX[si],spL=spans[si].L;
      if(ld.type==='point'||ld.type==='moment'){const gx=x0+Math.max(0,Math.min(spL,ld.pos));add(gx-EPS);add(gx);add(gx+EPS);}
      else if(ld.type==='distributed'){add(x0+(ld.sx||0));add(x0+(ld.ex||spL));}});
    return[...set].sort((a,b)=>a-b);
  }
  // solveFor
    stX.forEach(X=>{const e=evalVM(X,R,fac);sh.push({x:X,y:e.V});mo.push({x:X,y:e.M});});
  // solve(): right after totL=nodeX[nodeX.length-1];
    stX=stationList();
  // solve (envelope)
      for(let i=0;i<stX.length;i++){
  ...
        const x=stX[i];
  // drawDia cl2
      if(envOn&&lblC){const i=d.indexOf(P);const ck=lblC[i];if(ck)txt+=` (${COMBOS[ck].name})`;}
  // peakNote
    if(comboLbl){const i=d.indexOf(P),ck=comboLbl[i];if(ck&&COMBOS[ck])t+=`<br>${COMBOS[ck].name}`;}
  ```
- **Check cases:**
  - (a) Simple span 10 ft, P = 10 k at a = 3.3333 ft (off-grid). Before: |M|max = **22.167** k·ft. After: **22.222** k·ft. Hand: Pab/L = 10 × 3.3333 × 6.6667/10 = 22.222 ✓ (+0.25%).
  - (b) Two spans, 12 ft + 12.3 ft (interior support off-grid), UDL 2 k/ft.
    - Before: M_B = −36.487 k·ft, |V| = 15.245 k.
    - After: M_B = **−36.923** k·ft, |V| = **15.302** k.
    - Hand: three-moment M_B = −w(L₁³ + L₂³)/[8(L₁ + L₂)] = −2(1728 + 1860.87)/194.4 = −36.922 ✓ (+1.2%). V right of B = −15.077 + 30.379 = 15.302 ✓.
  - (c) The F1 case: M_B = −37.282 → **−37.500** (hand −w(10³ + 20³)/(8 × 30) = −37.5 ✓).
  - Reactions are unchanged in every case (they come from the stiffness solution, not the grid). δmax changes only in the 6th significant figure (0.0139028 → 0.0139023 ft) because the integration points changed.
- **How verified:** jsdom, old vs new.
- **Other copies of this code:** Steel Beam Design - AISC 15th.html has its own `stationList` (not changed).

### F4. Shear stress used 1.5V/A for W-shape presets   [calc change] [more conservative]
- **Where:** W-shape `<select id="iShape">` (t_w added to each option value); new global `shpW`; new helper `tauOf` (after `deflGov`); the `iShape` change handler; new input listener on `iI`/`iC`/`iA`; `renderKaTeX` and `buildReport` τ lines; `gatherProject`/`applyProject` (optional field). Anchor text: `function tauOf(v){`
- **Problem:** τmax = 3V/(2A) is the solid-rectangle formula. With a W preset (A = gross area) it under-reports web shear stress by about 35% (W18×50: 0.102V vs 0.156V per in²).
- **Governing provision:** AISC 360-16 Spec. G2.1, A_w = d·t_w (average web shear V/(d·t_w)). t_w values are from the AISC Shapes Database v16.0. They were checked against the shape table in Steel Beam Design - AISC 15th.html, which matches v16.0: W8×10 0.170, W10×22 0.240, W12×26 0.230, W14×30 0.270, W16×36 0.295, W18×50 0.355, W21×62 0.400, W24×76 0.440 in.
- **Before:**
  ```html
          <option value="30.8,7.89,2.96">W8×10</option><option value="118,10.2,6.49">W10×22</option>
          <option value="204,12.2,7.65">W12×26</option><option value="291,13.8,8.85">W14×30</option>
          <option value="448,15.9,10.6">W16×36</option><option value="800,18.0,14.7">W18×50</option>
          <option value="1330,21.0,18.3">W21×62</option><option value="2100,23.9,22.4">W24×76</option></select>
  ```
  ```js
  // renderKaTeX
        if(Av>0)s6+=`<div class="bxr">${kb(`\\tau_{\\max}=\\frac{3|V|_{\\max}}{2A}=\\boxed{${(1.5*mv2/Av).toFixed(4)}\\,\\text{${fu}/${lu}^2}}`)}</div>`;
  // buildReport
    if(secOn&&Av>0)h+=`<tr><td>τ<sub>max</sub> = 1.5|V|/A</td><td>${(1.5*vm/Av).toFixed(4)} ${fu}/${lu}²</td><td>—</td><td>—</td></tr>`;
  // iShape handler
    if(!e.target.value)return;
    const[Iin,din,Ain]=e.target.value.split(',').map(Number);
    const f=LCONV[lu];
  // gatherProject
    return{projName:g('projNm').value,spans,nodes,loads,fu,lu,cid,envOn,secOn,Ev,Iv,cv,Av,defLim,Fbv,caseView,cases:CASES,combos:combosArr,userXs:g('iUX').value};
  ```
- **After:**
  ```html
          <option value="30.8,7.89,2.96,0.170">W8×10</option><option value="118,10.2,6.49,0.240">W10×22</option>
          <option value="204,12.2,7.65,0.230">W12×26</option><option value="291,13.8,8.85,0.270">W14×30</option>
          <option value="448,15.9,10.6,0.295">W16×36</option><option value="800,18.0,14.7,0.355">W18×50</option>
          <option value="1330,21.0,18.3,0.400">W21×62</option><option value="2100,23.9,22.4,0.440">W24×76</option></select>
  ```
  ```js
  let shpW=null; // W-shape preset in use: {nm,d,tw} in current length units (null = custom section)
  /* Max shear stress: W-shape preset → average web shear V/(d·tw) (AISC Spec. G2.1, Aw = d·tw);
     custom section → 1.5V/A (solid rectangle). */
  function tauOf(v){
    if(shpW&&shpW.d>0&&shpW.tw>0)return{val:v/(shpW.d*shpW.tw),lbl:'V/(d·t<sub>w</sub>)',
      tex:`\\tau_{\\max}=\\frac{|V|_{\\max}}{d\\,t_w}=\\frac{${v.toFixed(3)}}{${shpW.d.toPrecision(4)}\\times${shpW.tw.toPrecision(4)}}`};
    if(Av>0)return{val:1.5*v/Av,lbl:'1.5|V|/A',tex:`\\tau_{\\max}=\\frac{3|V|_{\\max}}{2A}`};
    return null;
  }
  // renderKaTeX
        const tq=tauOf(mv2);
        if(tq)s6+=`<div class="bxr">${kb(`${tq.tex}=\\boxed{${tq.val.toFixed(4)}\\,\\text{${fu}/${lu}^2}}`)}${shpW?p(`${String(shpW.nm).replace(/[<>&]/g,'')}: average web shear on A<sub>w</sub> = d·t<sub>w</sub> (AISC 360 G2.1).`):''}</div>`;
  // buildReport
    {const tq=secOn?tauOf(vm):null;if(tq)h+=`<tr><td>τ<sub>max</sub> = ${tq.lbl}${shpW?' ('+esc(shpW.nm)+')':''}</td><td>${tq.val.toFixed(4)} ${fu}/${lu}²</td><td>—</td><td>—</td></tr>`;}
  // iShape handler
    if(!e.target.value){shpW=null;schedule();return;}
    const[Iin,din,Ain,twin]=e.target.value.split(',').map(Number);
    const f=LCONV[lu];
    shpW={nm:e.target.selectedOptions[0].text,d:+(din*f).toPrecision(6),tw:+(twin*f).toPrecision(6)};
  // events (after the iE…iFb listener line)
  ['iI','iC','iA'].forEach(id=>g(id).addEventListener('input',()=>{if(shpW){shpW=null;g('iShape').value='';}})); // edited by hand → custom section
  // gatherProject — optional field, only written when a W preset is in use
    return{…,userXs:g('iUX').value,...(shpW?{shape:shpW}:{})};
  // applyProject (after the userXs line)
    shpW=(d.shape&&d.shape.d>0&&d.shape.tw>0)?{nm:String(d.shape.nm||''),d:+d.shape.d,tw:+d.shape.tw}:null; // optional; absent in older files
    {const o=shpW?[...g('iShape').options].find(o2=>o2.text===shpW.nm):null;g('iShape').value=o?o.value:'';}
  ```
- **Behaviour note:** editing I, c or A by hand after picking a W shape now resets the shape dropdown to "— Custom —" and goes back to 1.5V/A, because the section is no longer the preset. Old projects have no `shape` field, so they load as custom (old behaviour). Projects without a W preset save exactly as before, so the "unsaved changes" flag is not tripped.
- **Check case:** simple span 20 ft, UDL 2 k/ft (V = 20 k), W18×50 preset in kip-ft (d = 1.5 ft, t_w = 0.029583 ft, A = 0.10208 ft²).
  - Before: τ = 1.5 × 20/0.10208 = **293.83 ksf** (2.04 ksi).
  - After: τ = 20/(1.5 × 0.029583) = **450.70 ksf** (3.13 ksi).
  - Hand: d·t_w = 18 × 0.355 = 6.39 in², 20/6.39 = 3.130 ksi ✓ (+53%).
  - σ is unchanged (1,944.01 ksf).
- **How verified:** jsdom, old vs new; report row "τmax = V/(d·tw) (W18×50)"; autosave round-trip restores the preset; a manual I edit clears it.
- **Other copies of this code:** none.

### F5. Envelope reported maximum reactions only (uplift missed)   [display] [more conservative: uplift now reported]
- **Where:** `solve()` envelope `env.R`; `updStats` envelope card; `renderKaTeX` envelope reactions; `resultsRows` (CSV); `buildReport` section 3. Anchor text: `if(v<mn){mn=v;mnc=k}`
- **Problem:** only max(R) over the combinations was kept, so uplift from, for example, 0.9D + 1.0W was never shown.
- **Governing provision:** n/a (enveloping)
- **Before:**
  ```js
      env.R=nodes.map((_,j)=>{let mx=-1e18,mc='';EK.forEach(k=>{const v=res[k].R[j].v;if(v>mx){mx=v;mc=k}});return{mx,mc};});
  // unstable branch
      env={V:{mx:[],mn:[],mxC:[],mnC:[]},M:{mx:[],mn:[],mxC:[],mnC:[]},R:nodes.map(()=>({mx:0,mc:'U'})),per:[]};
  // updStats
      if(envOn){h+=`<div class="sc ${cl}"><div class="sc-l">R_${NN[j]} max</div><div class="sc-v">${env.R[j].mx.toFixed(3)}</div><div class="sc-u">${fu} · ${COMBOS[env.R[j].mc].name}</div></div>`;}
  // renderKaTeX
      nodes.forEach((nd2,j)=>{if(nd2.t==='free')return;s4+=kb(`R_{${NN[j]},\\max}=\\boxed{${env.R[j].mx.toFixed(4)}\\,\\text{${fu}}}\\;\\text{(${COMBOS[env.R[j].mc].name})}`);});
      html+=sec(N++,'Maximum Support Reactions',s4);
  // resultsRows
    rows.push(envOn?['Node','Rmax ('+fu+')','Governing combo']:['Node','R ('+fu+')','M_R ('+fu+'·'+lu+')']);
      rows.push(envOn?[NN[j],env.R[j].mx.toFixed(4),COMBOS[env.R[j].mc].name]
  // buildReport
    if(envOn){h+=`<tr><th>Node</th><th>Rmax (${fu})</th><th>Governing combination</th></tr>`;
      nodes.forEach((nd2,j)=>{if(nd2.t==='free')return;h+=`<tr><td>${NN[j]}</td><td>${env.R[j].mx.toFixed(4)}</td><td>${COMBOS[env.R[j].mc].name}</td></tr>`;});}
  ```
- **After:**
  ```js
      env.R=nodes.map((_,j)=>{let mx=-1e18,mc='',mn=1e18,mnc='';EK.forEach(k=>{const v=res[k].R[j].v;if(v>mx){mx=v;mc=k}if(v<mn){mn=v;mnc=k}});return{mx,mc,mn,mnc};});
  // unstable branch
      env={V:{mx:[],mn:[],mxC:[],mnC:[]},M:{mx:[],mn:[],mxC:[],mnC:[]},R:nodes.map(()=>({mx:0,mc:'U',mn:0,mnc:'U'})),per:[]};
  // updStats
      if(envOn){const Rj=env.R[j],up=Rj.mn<-1e-9;h+=`<div class="sc ${cl}"><div class="sc-l">R_${NN[j]} max / min</div><div class="sc-v">${Rj.mx.toFixed(3)}</div><div class="sc-u">${fu} · ${COMBOS[Rj.mc].name}<br><span style="${up?'color:#b91c1c;font-weight:700':''}">min ${Rj.mn.toFixed(3)}${up?' UPLIFT':''} · ${COMBOS[Rj.mnc]?COMBOS[Rj.mnc].name:''}</span></div></div>`;}
  // renderKaTeX
      nodes.forEach((nd2,j)=>{if(nd2.t==='free')return;s4+=kb(`R_{${NN[j]},\\max}=\\boxed{${env.R[j].mx.toFixed(4)}\\,\\text{${fu}}}\\;\\text{(${COMBOS[env.R[j].mc].name})}`);
        s4+=kb(`R_{${NN[j]},\\min}=\\boxed{${env.R[j].mn.toFixed(4)}\\,\\text{${fu}}}\\;\\text{(${COMBOS[env.R[j].mnc]?COMBOS[env.R[j].mnc].name:''})}${env.R[j].mn<-1e-9?'\\;\\text{— UPLIFT}':''}`);});
      html+=sec(N++,'Support Reactions — Envelope Max / Min',s4);
  // resultsRows (two columns appended)
    rows.push(envOn?['Node','Rmax ('+fu+')','Governing combo','Rmin ('+fu+')','Governing combo (min)']:['Node','R ('+fu+')','M_R ('+fu+'·'+lu+')']);
      rows.push(envOn?[NN[j],env.R[j].mx.toFixed(4),COMBOS[env.R[j].mc].name,env.R[j].mn.toFixed(4),COMBOS[env.R[j].mnc]?COMBOS[env.R[j].mnc].name:'']
  // buildReport
    if(envOn){h+=`<tr><th>Node</th><th>Rmax (${fu})</th><th>Governing combination</th><th>Rmin (${fu})</th><th>Governing combination (min)</th></tr>`;
      nodes.forEach((nd2,j)=>{if(nd2.t==='free')return;h+=`<tr><td>${NN[j]}</td><td>${env.R[j].mx.toFixed(4)}</td><td>${COMBOS[env.R[j].mc].name}</td><td>${env.R[j].mn.toFixed(4)}${env.R[j].mn<-1e-9?' <b style="color:#b91c1c">UPLIFT</b>':''}</td><td>${COMBOS[env.R[j].mnc]?COMBOS[env.R[j].mnc].name:''}</td></tr>`;});}
  ```
- **Check case:** simple span 20 ft, D = 0.5 k/ft down, W = 2 k/ft up (entered as −2), default combinations, envelope on.
  - Before: R_A = R_B max 7.000 (1.4D), and nothing else.
  - After: max 7.000 (1.4D), min **−15.500 UPLIFT** (0.9D + 1.0W).
  - Hand: (0.9 × 0.5 − 2) × 20/2 = −15.5 ✓.
- **How verified:** jsdom (stats, report, CSV).
- **Other copies of this code:** none.

### F6. A blank E or I silently became 1   [robustness] [more conservative]
- **Where:** `readIn` (≈ line 629); error card in `updStats`; note in `renderKaTeX`; `applyProject` E/I restore. Anchor text: `blank/zero/negative → flagged (was silently 1)`
- **Problem:** `parseFloat(...)||1` turned a cleared I field into I = 1 (ft⁴ in kip-ft), so deflection was silently understated by orders of magnitude (the check case below shows 0.000998 ft instead of the real value).
- **Governing provision:** n/a
- **Before:**
  ```js
    Ev=parseFloat(g('iE').value)||1;Iv=parseFloat(g('iI').value)||1;cv=parseFloat(g('iC').value)||0;Av=parseFloat(g('iA').value)||0;
  // applyProject
    Ev=d.Ev||Ev;Iv=d.Iv||Iv;cv=d.cv||cv;Av=d.Av||Av;defLim=d.defLim??360;Fbv=d.Fbv??0;
  // renderKaTeX: the Section Analysis block ended with
        html+=sec(N++,'Section Analysis',s6);
      }
  ```
- **After:**
  ```js
    Ev=parseFloat(g('iE').value);Iv=parseFloat(g('iI').value);if(!(Ev>0))Ev=0;if(!(Iv>0))Iv=0; // blank/zero/negative → flagged (was silently 1)
    cv=parseFloat(g('iC').value)||0;Av=parseFloat(g('iA').value)||0;
  // applyProject — a saved 0 reloads as 0 (flagged) instead of silently becoming the default
    Ev=d.Ev!=null?d.Ev:Ev;Iv=d.Iv!=null?d.Iv:Iv;cv=d.cv||cv;Av=d.Av||Av;defLim=d.defLim??360;Fbv=d.Fbv??0;
  // updStats (first line after let h='';)
    if(secOn&&!(Ev>0&&Iv>0))h+=`<div style="grid-column:1/-1;background:#fff1f2;border:1.5px solid #fda4af;border-radius:9px;padding:10px 14px;color:#9f1239;font-weight:700;font-size:12px">⚠ Section properties: ${!(Ev>0)?'E':''}${!(Ev>0)&&!(Iv>0)?' and ':''}${!(Iv>0)?'I':''} must be greater than 0 (blank, zero or negative entered). Deflection is not computed until this is fixed.</div>`;
  // renderKaTeX
        html+=sec(N++,'Section Analysis',s6);
      } else if(secOn)html+=sec(N++,'Section Analysis',`<div class="bxr">${p('<strong>E and I must both be greater than 0.</strong> A blank, zero or negative value was entered, so deflection and section results are not computed.')}</div>`);
  ```
  V, M and R do not depend on EI for a uniform section, so they are still shown. The solver already used EI = 1 whenever E or I ≤ 0.
- **Check case:** simple span 20 ft, UDL 2 k/ft, E = 4,176,000 ksf, I blank.
  - Before: I = 1 → δ = **0.000998 ft** "OK ✓", σ = 50 ksf.
  - After: red error card "I must be greater than 0"; no deflection and no σ shown.
  - With the intended I = 0.02 ft⁴: δ = 5wL⁴/(384EI) = 5 × 2 × 160,000/(384 × 83,520) = 0.0499 ft, about 50× the silent value.
- **How verified:** jsdom.
- **Other copies of this code:** none.

### F7. The equilibrium check always printed ✓   [display] [no result change]
- **Where:** `renderKaTeX`, Support Reactions block (≈ line 1393). Anchor text: `const eqOK=Math.abs(tR-tF)<=1e-6*Math.max(1,Math.abs(tF));`
- **Before:**
  ```js
      s4+=`<div class="bxg">${kb(`\\sum R=${tR.toFixed(4)}=\\sum F=${tF.toFixed(4)}\\,\\text{${fu}}\\;\\checkmark`)}</div>`;
  ```
- **After:**
  ```js
      const eqOK=Math.abs(tR-tF)<=1e-6*Math.max(1,Math.abs(tF));
      s4+=eqOK?`<div class="bxg">${kb(`\\sum R=${tR.toFixed(4)}=\\sum F=${tF.toFixed(4)}\\,\\text{${fu}}\\;\\checkmark`)}</div>`
        :`<div class="bxr">${kb(`\\sum R=${tR.toFixed(4)}\\neq\\sum F=${tF.toFixed(4)}\\,\\text{${fu}}\\;\\times`)}${p('<strong>Equilibrium check failed</strong> — the reactions do not balance the applied loads. Do not use these results; check the model.')}</div>`;
  ```
- **Check case:** P = 10 k on a 10 ft span gives ΣR = 10.0000 = ΣF ✓. With R_A forced to +1 in the test, it shows "ΣR = 11.0000 ≠ ΣF = 10.0000 ×" and the failure note.
- **How verified:** jsdom.
- **Other copies of this code:** none.

### F8. Changing units relabels without converting: notice added   [display] [no result change]
- **Where:** below the Force/Length selects (HTML ≈ line 270), and the `iFU`/`iLU` change listener. Anchor text: `Changing units only relabels the inputs`
- **Problem:** changing the force or length unit only changes the labels; every entered number stays as it is.
- **Decision:** a notice only. Full conversion touches spans, every load type (point, line, trapezoid, couple), E, I, c, A, σ_allow, user stations, the W-shape t_w/d and the saved data. It is not a small or safe change, so it was not attempted (see O1).
- **Before:**
  ```html
          <div class="fg"><label class="lbl">Length</label><select id="iLU">…</select></div>
        </div>
  ```
  ```js
  ['iFU','iLU'].forEach(id=>g(id).addEventListener('change',()=>{renderCfg();refreshDG();schedule();}));
  ```
- **After:**
  ```html
          <div class="fg"><label class="lbl">Length</label><select id="iLU">…</select></div>
        </div>
        <p class="hint" style="color:#b45309">⚠ Changing units only relabels the inputs — existing spans, loads, E, I, c, A and σ are NOT converted. Re-enter them in the new units.</p>
  ```
  ```js
  ['iFU','iLU'].forEach(id=>g(id).addEventListener('change',()=>{renderCfg();refreshDG();schedule();toast('⚠ Units relabelled only — values were NOT converted');}));
  ```
- **Check case:** n/a (display).
- **How verified:** jsdom (no errors).
- **Other copies of this code:** none.

## 2026-10-04 — PR: claude/step1-group4 (PR link added after merge)
### S1. "← All tools" link and shared project info   [feature (no result change)]
- **Date / type:** 2026-10-04, feature (no result change).
- **Where:** CSS after `#projNm{width:200px;font-size:12px}`, header `.brand` line (replaced: link appended inside it), `#projNm` wrapped in a flex `div` with a two-button column, and two new `<script>` blocks before `</body>`.
- **Purpose:** link back to `tools.html` (`target="_top"`, hidden in print); "Use shared project info" / "Share project info" on the `bridgeSuite.v1.projectMeta` channel (`_schema:"bridge-project-meta"`, HANDOFF.md §4.1). Use reads with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing every field that will be overwritten (old → new), writes only fields this tool has, never blanks a field when the shared value is empty, and skips a non-`YYYY-MM-DD` value for a date input.
- **Field mapping:** projNm → projectName. Nothing else maps (sent as ""): bridgeId, jobNo, client, location, preparedBy, checkedBy, date.
- **Governing provision:** none (no engineering change). Spec: HANDOFF.md §4.1 and §5.
- **Before / After** (exact; edits applied in this order, each anchor occurs once; line endings preserved):
  1.
     - Before:
  ```html
  #projNm{width:200px;font-size:12px}
  ```
     - After:
  ```html
  #projNm{width:200px;font-size:12px}
  .alltools{font-size:11px;font-weight:500;color:var(--mu);text-decoration:none;margin-left:6px}
  .alltools:hover{color:var(--bl);text-decoration:underline}
  .pshare{display:flex;flex-direction:column;gap:2px}
  .pshare .btn{font-size:10px;padding:1px 7px}
  @media print{.alltools,.pshare{display:none!important}}
  ```
  2.
     - Before:
  ```html
  <path d="M3 6h18M3 12h18M3 18h18"/></svg>Beam Pro</div>
  ```
     - After:
  ```html
  <path d="M3 6h18M3 12h18M3 18h18"/></svg>Beam Pro<a class="alltools" href="tools.html" target="_top">&larr; All tools</a></div>
  ```
  3.
     - Before:
  ```html
    <input id="projNm" type="text" placeholder="Project name…" value="">
  ```
     - After:
  ```html
    <div style="display:flex;align-items:center;gap:6px">
    <input id="projNm" type="text" placeholder="Project name…" value="">
    <div class="pshare">
      <button class="btn btn-s" type="button" onclick="bxUseProjectInfo()">Use shared project info</button>
      <button class="btn btn-s" type="button" onclick="bxShareProjectInfo()">Share project info</button>
    </div>
    </div>
  ```
  4. Final `</body>`.
     - Before:
  ```html
  </body>
  ```
     - After (the first `<script>` holds BridgeXfer v1 verbatim from HANDOFF.md §5, shown here as a placeholder comment):
  ```html
  <script>
  /* (BridgeXfer v1 verbatim from HANDOFF.md §5) */
  </script>
  <script>
  /* Shared project info (HANDOFF.md §4.1): "Use shared project info" / "Share project info".
     Reads and writes the title-block inputs only, through their normal input events. */
  (function(){
    var PRODUCER="Multi-Span Beam Pro", FILE="Shear and Moment Diagrams.html";
    var MAP={projectName:'#projNm'};
    var KEYS=['projectName','bridgeId','jobNo','client','location','preparedBy','checkedBy','date'];
    var LBL={projectName:'Project name',bridgeId:'Bridge ID',jobNo:'Job no.',client:'Client',location:'Location',
             preparedBy:'Prepared by',checkedBy:'Checked by',date:'Date'};
    function fld(k){ return MAP[k] ? document.querySelector(MAP[k]) : null; }
    window.bxShareProjectInfo=function(){
      var f={};
      KEYS.forEach(function(k){ var e=fld(k); f[k]=e ? String(e.value||'') : ''; });
      var r=BridgeXfer.publish('projectMeta',{_schema:'bridge-project-meta',fields:f},PRODUCER,FILE);
      alert(r.ok ? 'Project info shared. Other tools can load it with "Use shared project info".' : r.error);
    };
    window.bxUseProjectInfo=function(){
      var r=BridgeXfer.read('projectMeta','bridge-project-meta',1);
      if(!r.ok){ alert('Shared project info: '+r.error); return; }
      var f=r.payload.fields||{}, ch=[], skip=[];
      KEYS.forEach(function(k){
        var e=fld(k), v=(f[k]==null) ? '' : String(f[k]);
        if(!e || v==='') return;   /* field not in this tool, or shared value empty: never blank a field */
        if(e.type==='date' && !/^\d{4}-\d{2}-\d{2}$/.test(v)){ skip.push(LBL[k]+' ("'+v+'" is not a YYYY-MM-DD date)'); return; }
        if(e.value!==v) ch.push({e:e,k:k,v:v});
      });
      var head='Shared project info from '+BridgeXfer.describe(r.payload);
      var sk=skip.length ? '\n\nSkipped: '+skip.join('; ') : '';
      if(!ch.length){ alert(head+'\n\nNothing to change: the matching fields already hold these values.'+sk); return; }
      if(!confirm(head+'\n\nThese fields will be overwritten:\n'+ch.map(function(c){
          return '  '+LBL[c.k]+': "'+c.e.value+'" → "'+c.v+'"'; }).join('\n')+sk+'\n\nContinue?')) return;
      ch.forEach(function(c){ c.e.value=c.v; c.e.dispatchEvent(new Event('input',{bubbles:true})); });
    };
  })();
  </script>
  </body>
  ```
- **Behaviour notes:** Use dispatches `input` on `#projNm`, so the existing listener runs `readIn(); updateDirty(); autoSave();` (`beamProAuto`, unchanged).
- **Saved data:** no existing key or format changed. New keys are only the HANDOFF channel keys `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt`, written on "Share project info".
- **Check case:** n/a, no computed result changes. Hand check: open the tool, type a project name, click "Share project info"; open another tool, click "Use shared project info", accept the confirm; the name appears and survives a reload.
- **How verified:** Every plain inline script syntax-checked (Node `vm.Script`, same parser as `node --check`); BridgeXfer block compared byte-for-byte with HANDOFF.md §5; page loaded in jsdom (CDN scripts not loaded) before and after the change with no new errors; Share → Use exercised between tools with jsdom localStorage (ASCE7-16 → ACI Rebar, Steel Beam → Shear and Moment, Concrete Beam Capacity shell against stub tab documents), including cancel, empty shared values (field kept), a non-ISO date on a date input (skipped), an empty channel and a wrong `_schema` (refused). `git diff` shows no removed lines other than the ones listed under Before. No calculation code was touched.
- **Other copies of this code:** none. BridgeXfer v1 is also in: ACI Rebar Development Length.html, ASCE7-16 Load Generator.html, Concrete Beam Capacity.html (shell), Steel Beam Design - AISC 15th.html, Shear and Moment Diagrams.html.

## Open items (not changed)
- O1. **Unit conversion.** Only a notice was added (F8). Real conversion would scale spans, loads (4 types), E, I, c, A, σ, user stations and the W-shape d/t_w, and would need a decision on saved projects. Recommend it as a separate PR if wanted.
- O2. **Roller → pin silent conversion** (`solve()`: `nodes.forEach(n2=>{if(n2.t==='roller')n2.t='pin';})`). Log only, as instructed. Pin and roller are mechanically identical in this model (no axial DOF), so no result is affected. The node dropdown offers only Pin/Fixed/Free, and the templates and "+ span" create 'roller', which is converted on the first solve. The only visible effect is the drawn symbol and the saved value. A proper fix means adding a "Roller" option (a UI change); not done.
- O3. **Cantilever spans and IBC footnote.** F1 uses the span length for every span, including a free-end overhang. IBC Table 1604.3 footnote says that for cantilevers l is taken as twice the cantilever length, which gives a larger (less conservative) allowable. Kept at L (conservative); the engineer should decide.
- O4. **Envelope mode has no deflection** (deflection is computed in single-combination mode only). Not changed.
- O5. **Default combination list includes the all-1.0 "U" combination** in the envelope, and the edition of the "ASCE 7" presets is not stated. Not changed (review item 6, low).
- O6. **Generic storage keys** `beamProSaves` / `beamProAuto` (shared file:// origin). Not changed: renaming needs a migration and was not in scope.
- O7. **W-shape presets with non-kip force units** keep the previous E (existing behaviour: E is set only when fu = kip). Part of O1.
