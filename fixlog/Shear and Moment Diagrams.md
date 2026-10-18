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

## 2026-10-12 — PR: claude/sweep-sm (open-item sweep; PR link added after merge)

Engineer's instruction (2026-10-12): work through every open item using best judgment, and record anything that needs the engineer. Items handled: O1, O2, O4, O5, O6, O7 (fixed) and O3 (needs the engineer, unchanged). Edits are listed with exact before/after text (each Before occurs once in the file; CRLF line endings kept). Apply them in the order given.

**Verification (all items):**
- `node --check` on every inline script: 3 blocks, 0 failures.
- Headless Chromium (Playwright, `/opt/pw-browsers/chromium`), origin/main against this branch. KaTeX 0.16.9 and plotly-basic 2.27.0 were served locally from the npm packages of the same versions, because the CDN is blocked in the sandbox.
- Scenarios: the default page; each of the 5 templates (ss, 2s, 3s, cant, ff) with section off/on × single/envelope (20 cases); and the F14 check case.
- Compared: stats cards, calculation panel text, table, CSV rows (`resultsRows`), saved project JSON (`gatherProject`) and report text (`buildReport`).
- Result: after mapping the node label "roller" → "pin" (F11) and removing the report timestamp, the only differences are in the 5 envelope + section-on cases and the check case. They are the new deflection-envelope outputs (F14). V, M, R, σ, τ and every single-combination result are identical.
- Separate scripted tests for F9, F10, F11 and F12 are described in each item.
- No page errors. The only console errors are the KaTeX web-font requests that the sandbox blocks (same on main).
- Screenshots of the envelope deflection plot (Plotly and the canvas fallback) and of the converted-units view were checked.

### F9 (O1). Changing units now converts every entered value   [bug fix] [results now correct after a unit change; no change when units are not changed]
- **Where:** new `FKIP` table and `convertUnits()` after `const LCONV=` (anchor `function convertUnits(fu0,lu0,fu1,lu1){`); the `iFU`/`iLU` change listener; the units hint under the selects (replaces the F8 notice).
- **Problem:** changing Force or Length only changed the labels. A beam entered as 20 ft and 2 k/ft, then switched to kN and m, was solved as 20 m and 2 kN/m.
- **Decision:** convert rather than lock the units.
  - Converted: span lengths; point load P and its position; moment M (force × length) and its position; uniform w; trapezoid w1, w2, x1, x2; E, I, c, A, allowable σ; custom x stations; the stored W-shape d and t_w.
  - Not converted (dimensionless): factors and the L/x limit.
  - Each converted value is rounded to the shortest decimal within 1e-9 relative of the exact product, so the inputs stay readable. Converting there and back can leave a drift of about 1e-9 relative (2.0e-9 measured after kip-ft → kN-m → kip-ft).
  - Undo (Ctrl+Z) restores the previous units and values exactly, because the history holds the whole project.
- **Factors:** 1 kip = 4.4482216152605 kN = 1000 lb = 4448.2216152605 N. Length uses the existing `LCONV` (inches → unit: ft 1/12, m 0.0254, cm 2.54).
- **Saved data:** format unchanged. Projects already store values together with `fu`/`lu`, so nothing in a file changes meaning.
- **Governing provision:** n/a (unit conversion; exact definitions: 1 lbf = 4.4482216152605 N, 1 in = 25.4 mm).
- **Before / After:**
  1.
     - Before:
  ```html
      <p class="hint" style="color:#b45309">⚠ Changing units only relabels the inputs — existing spans, loads, E, I, c, A and σ are NOT converted. Re-enter them in the new units.</p>
  ```
     - After:
  ```html
      <p class="hint">Changing units converts every entered value (spans, loads, E, I, c, A, σ, custom x) to the new units. Undo (Ctrl+Z) restores the previous units and values.</p>
  ```
  2.
     - Before:
  ```js
const LCONV={ft:1/12,in:1,m:.0254,cm:2.54}; // inches → unit
  ```
     - After:
  ```js
const LCONV={ft:1/12,in:1,m:.0254,cm:2.54}; // inches → unit
const FKIP={kip:1,lb:.001,kN:1/4.4482216152605,N:1/4448.2216152605}; // kip per force unit (1 kip = 4.4482216152605 kN)
/* Convert every entered value from (fu0, lu0) to (fu1, lu1) when the unit selects change.
   Was: labels only, values kept (fix log F8 / O1). Saved-data format unchanged (values are stored with fu/lu). */
function convertUnits(fu0,lu0,fu1,lu1){
  const rf=FKIP[fu0]/FKIP[fu1],rl=LCONV[lu1]/LCONV[lu0];
  fu=fu1;lu=lu1;
  if(!(rf>0&&rl>0)||(rf===1&&rl===1))return false;
  const r=v=>{for(let p=1;p<=15;p++){const y=+v.toPrecision(p);if(Math.abs(y-v)<=1e-9*Math.abs(v))return y;}return v;}; // shortest value within 1e-9 relative
  const sc=(o,k,f)=>{if(o&&typeof o[k]==='number'&&isFinite(o[k]))o[k]=r(o[k]*f);};
  spans.forEach(sp=>sc(sp,'L',rl));
  loads.forEach(ld=>{
    if(ld.type==='point'){sc(ld,'mag',rf);sc(ld,'pos',rl);}
    else if(ld.type==='moment'){sc(ld,'mag',rf*rl);sc(ld,'pos',rl);}
    else if(ld.type==='uniform')sc(ld,'mag',rf/rl);
    else{sc(ld,'sm',rf/rl);sc(ld,'em',rf/rl);sc(ld,'sx',rl);sc(ld,'ex',rl);}});
  const fv=(id,f)=>{const v=parseFloat(g(id).value);if(isFinite(v)&&v!==0)g(id).value=r(v*f);};
  fv('iE',rf/(rl*rl));fv('iI',rl*rl*rl*rl);fv('iC',rl);fv('iA',rl*rl);fv('iFb',rf/(rl*rl));
  const ux=g('iUX').value;
  if(ux.trim())g('iUX').value=ux.split(',').map(s=>{const v=parseFloat(s.trim());return isNaN(v)?s.trim():String(r(v*rl));}).join(', ');
  if(shpW){shpW.d=r(shpW.d*rl);shpW.tw=r(shpW.tw*rl);}
  return true;
}
  ```
  3.
     - Before:
  ```js
['iFU','iLU'].forEach(id=>g(id).addEventListener('change',()=>{renderCfg();refreshDG();schedule();toast('⚠ Units relabelled only — values were NOT converted');}));
  ```
     - After:
  ```js
['iFU','iLU'].forEach(id=>g(id).addEventListener('change',()=>{const fu0=fu,lu0=lu;
  const cvd=convertUnits(fu0,lu0,g('iFU').value,g('iLU').value);
  renderCfg();renderLoads(true);refreshDG();schedule();
  if(cvd)toast(`Values converted: ${fu0}, ${lu0} → ${fu}, ${lu} (Ctrl+Z to undo)`);}));
  ```
- **Check case:** simple span 20 ft, uniform 2 kip/ft (DL), "Unfactored" combination; switch Force to kN and Length to m.
  - Before: the inputs keep 20 and 2, so the beam is solved as 20 m and 2 kN/m: R = 20.000 kN, M = 100.000 kN·m (wrong).
  - After: L = 6.096 m, w = 2 × 4.4482216 / 0.3048 = 29.1878059 kN/m.
    - R = wL/2 = 88.964 kN (= 20 × 4.44822).
    - M = wL²/8 = 29.1878059 × 6.096² / 8 = 135.582 kN·m (= 100 × 4.44822 × 0.3048).
- **How verified:** scripted test on a 2-span beam with a cantilever, every load type, the W18×50 preset, σ_allow and custom x.
  - After kip-ft → kN-m: R scales by 4.44822, M by 4.44822 × 0.3048, δ by 0.3048, and σ and τ by 4.44822/0.3048², all within 1e-6 relative.
  - Back to kip-ft, every project value is within 2e-9 relative.
  - Undo after a change to inches restores ft and the original spans.
- **Other copies of this code:** none.

### F10 (O7). W-shape preset fills E in any force unit   [bug fix] [results now correct with non-kip force units]
- **Where:** `iShape` change handler (anchor `E = 29,000 ksi in the current units`); label of the shape select.
- **Problem:** E was set only when the force unit was kip. With kN, lb or N the previous E stayed. For example, 4,176,000 entered for kip/ft was read as 4,176,000 kN/m², about 48× too low, so deflection came out 48× too large.
- **Governing provision:** AISC 360-16, Symbols (E = 29,000 ksi, modulus of elasticity of steel).
- **Before / After:**
  1.
     - Before:
  ```html
Standard Shape (auto-fills, kip units)
  ```
     - After:
  ```html
Standard Shape (auto-fills in the current units)
  ```
  2.
     - Before:
  ```js
  if(fu==='kip')g('iE').value=Math.round(29000/(f*f));
  ```
     - After:
  ```js
  g('iE').value=Math.round(29000/FKIP[fu]/(f*f)); // E = 29,000 ksi in the current units (was: set only when fu = kip)
  ```
- **Check case:**
  - Units kN, m; pick W18×50. Before: E unchanged. After: E = 29,000 × 4.4482216 / 0.0254² = 199,947,962 kN/m² (≈ 200 GPa).
  - kip/ft is unchanged: 29,000 × 144 = 4,176,000 (same expression order as before).
  - lb, in: 29,000,000.
- **How verified:** scripted test (kN-m → 199,947,962; lb-in → 29,000,000); kip-ft results identical to main in the 20-case comparison.
- **Other copies of this code:** none.

### F11 (O2). "Roller" support option; rollers are no longer silently turned into pins   [UI] [no result change]
- **Where:** first line of `solve()`; node select in `renderCfg()`; support click-cycle in the load-canvas drag handler (anchor `const cyc=isEnd?`).
- **Problem:** the templates and "+ Add Span" create rollers, but `solve()` rewrote them to pins, and the dropdown had no Roller entry.
- **Decision:** add Roller.
  - It is solved exactly like Pin: only `free` and `fixed` change the constraints in `solveFor` and `deflOf`, so no result changes.
  - The roller symbol and the label "(roller)" now show in the calculation panel and report.
  - Saved projects may now contain `"t":"roller"`. That was already the template value, and Steel Beam Design's S&M import maps roller → pin.
- **Governing provision:** n/a.
- **Before / After:**
  1.
     - Before:
  ```js
  nodes.forEach(n2=>{if(n2.t==='roller')n2.t='pin';}); // pin ≡ roller in this model (no axial DOF)
  ```
     - After:
  ```js
  // 'roller' is kept as entered (was silently changed to 'pin'); it is solved exactly like 'pin' (no axial DOF).
  ```
  2.
     - Before:
  ```html
      <option value="pin" ${nd2.t==='pin'||nd2.t==='roller'?'selected':''}>Pin</option>
  ```
     - After:
  ```html
      <option value="pin" ${nd2.t==='pin'?'selected':''}>Pin</option>
      <option value="roller" ${nd2.t==='roller'?'selected':''}>Roller</option>
  ```
  3.
     - Before:
  ```js
      const cyc=isEnd?['pin','fixed','free']:['pin','fixed'];
  ```
     - After:
  ```js
      const cyc=isEnd?['pin','roller','fixed','free']:['pin','roller','fixed'];
  ```
- **Check case:** 3-span template: reactions 3.5111 / 27.9889 / 27.9889 / 3.5111 kip before and after; node B now reads "Roller".
- **How verified:** 20-case comparison (identical after mapping the label); dropdown test (node B = roller, options pin/roller/fixed).
- **Other copies of this code:** none.

### F12 (O6). Tool-prefixed storage keys, with migration   [saved data] [no result change]
- **Where:** `const LSK=` (saved analyses section); new `smdMigrateKeys()` after `putSaves`; boot IIFE.
- **Problem:** `beamProSaves` / `beamProAuto` are generic names in the shared `file://` origin (CLAUDE.md §5).
- **Change:**
  - New keys: `smd_saves_v1` (named saves) and `smd_auto_v1` (autosave).
  - At start-up, each new key that is absent (`getItem` → null) is filled with a copy of its old key.
  - The old keys are read only for this and are never written or removed. Value formats are unchanged.
- **Governing provision:** CLAUDE.md §5.
- **Before / After:**
  1.
     - Before:
  ```js
const LSK='beamProSaves',LSA='beamProAuto';
  ```
     - After:
  ```js
const LSK='smd_saves_v1',LSA='smd_auto_v1'; // tool-prefixed (CLAUDE.md §5); were the generic 'beamProSaves' / 'beamProAuto'
const LSK_OLD='beamProSaves',LSA_OLD='beamProAuto'; // read once by smdMigrateKeys(), never written or removed
  ```
  2.
     - Before:
  ```js
function putSaves(s){return lsSet(LSK,JSON.stringify(s));}
  ```
     - After:
  ```js
function putSaves(s){return lsSet(LSK,JSON.stringify(s));}
/* One-time migration: copy each old generic key into its new key when the new key does not exist yet. */
function smdMigrateKeys(){[[LSK_OLD,LSK],[LSA_OLD,LSA]].forEach(([o,n])=>{if(lsGet(n)===null){const v=lsGet(o);if(v!==null)lsSet(n,v);}});}
  ```
  3.
     - Before:
  ```js
(function(){
  refreshSaveList();
  try{
    const a=JSON.parse(lsGet(LSA));
  ```
     - After:
  ```js
(function(){
  smdMigrateKeys();
  refreshSaveList();
  try{
    const a=JSON.parse(lsGet(LSA));
  ```
- **Check case:** a browser holding only `beamProAuto` and `beamProSaves`, with project "Old" (18 ft, 3 k/ft).
  - After loading: "Old" is restored and listed under Saved; `smd_auto_v1` and `smd_saves_v1` exist; the old keys are unchanged.
  - Later changes to the old keys are not copied again.
- **How verified:** scripted test as in the check case.
- **Other copies of this code:** none (no other tool reads these keys).

### F13 (O5). Combination presets: edition stated   [docs] [no result change]
- **Where:** `psLRFD` / `psASD` button titles; hint under the combinations table.
- **Change:**
  - The presets are labelled ASCE 7-16 Sec. 2.3.1 (LRFD) and Sec. 2.4.1 (ASD), D/L/S/W only.
  - The factors were checked against those sections:
    - LRFD: 1.4D; 1.2D+1.6L+0.5S; 1.2D+1.6S+L; 1.2D+1.0W+L+0.5S; 0.9D+1.0W.
    - ASD: D; D+L; D+S; D+0.75L+0.75S; D+0.6W; D+0.75L+0.75S+0.45W; 0.6D+0.6W.
  - The hint also states that the default list's "Unfactored (1.0 All)" row is not a code combination, and that its wind row uses 0.5L (Sec. 2.3.1 Exception 1).
  - The "U" row stays in the default list (the inventory's recommended default).
- **Governing provision:** ASCE 7-16 Sec. 2.3.1 and 2.4.1 (verify the section numbering against the printed standard).
- **Before / After:**
  1.
     - Before:
  ```html
title="Replace all combinations with ASCE 7 strength (LRFD) basics"
  ```
     - After:
  ```html
title="Replace all combinations with the ASCE 7-16 Sec. 2.3.1 strength (LRFD) basic combinations for D, L, S, W"
  ```
  2.
     - Before:
  ```html
title="Replace all combinations with ASCE 7 allowable stress (ASD) basics"
  ```
     - After:
  ```html
title="Replace all combinations with the ASCE 7-16 Sec. 2.4.1 allowable stress (ASD) basic combinations for D, L, S, W"
  ```
  3.
     - Before:
  ```html
  <p class="hint">Names are generated from the factors. The single-combination dropdown and the envelope both follow this table. Verify preset factors against your governing code edition.</p>
  ```
     - After:
  ```html
  <p class="hint">Names are generated from the factors. The single-combination dropdown and the envelope both follow this table. Presets: ASCE 7-16 Sec. 2.3.1 (LRFD) and Sec. 2.4.1 (ASD) basic combinations for D, L, S and W only (Lr, R, E and the alternate snow/wind arrangements are not included). The default list's "Unfactored (1.0 All)" row is not a code combination, and its wind row uses 0.5L (ASCE 7-16 Sec. 2.3.1 Exception 1: only where L<sub>o</sub> ≤ 100 psf, not garages or public assembly). Verify preset factors against your governing code edition.</p>
  ```
- **Check case:** n/a (text only).
- **Other copies of this code:** none.

### F14 (O4). Deflection envelope in envelope mode   [calc: new output] [more conservative: a deflection check now exists in envelope mode]
- **Where:**
  - New `deflOf(mo)` before `mkRow`: the single-mode deflection code moved out of `solve()` unchanged (`moD` → `mo`).
  - `solve()` envelope branch (anchor `deflection envelope over the same enabled combinations`).
  - `mkRow`; `deflSpans` (governing combination `c`); `readIn` (panel visibility); `drawAll`; `updStats` (|δ| env card, `pkD`); `renderTable`; `drawDefl`; `plotDefl`.
  - `renderKaTeX` (per-combination |δ|max column and the deflection block); `resultsRows` (CSV); `buildReport` (checks, diagram, table).
- **Problem:** envelope mode showed no deflection and no L/x check.
- **Decision:**
  - δ is computed for each enabled combination with the same double integration, then enveloped point-wise (max downward, and min).
  - The check takes, at each station, the larger of |δmax| and |δmin|. It is made per span against that span's L/x (as in F1) and names the governing combination.
  - The same enabled set as V/M is used, so factored combinations give factored deflections (conservative). The calculation panel says so, and tells the user to enable only service combinations, or use single-combination mode, for a service-level check.
  - Single-combination results are unchanged (same code, verified identical in all 20 cases).
- **Governing provision:** structural mechanics (Euler-Bernoulli, as F1/F2); limit per IBC 2021 Table 1604.3 with l = span length (F1).
- **Before / After:**
  1.
     - Before:
  ```js
    // deflection (single mode + section on)
    deD=[];
    if(secOn&&Ev>0&&Iv>0){
      const EI=Ev*Iv,n=moD.length,F1=new Array(n).fill(0),F2=new Array(n).fill(0);
      for(let i=1;i<n;i++){const dx=moD[i].x-moD[i-1].x;F1[i]=F1[i-1]+.5*(moD[i-1].y+moD[i].y)*dx;}
      for(let i=1;i<n;i++){const dx=moD[i].x-moD[i-1].x;F2[i]=F2[i-1]+.5*(F1[i-1]+F1[i])*dx;}
      // constants from first & last support nodes: δ(xa)=δ(xb)=0
      const supIdx=nodes.map((nd2,j)=>nd2.t!=='free'?j:-1).filter(j=>j>=0);
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
    }
  }
  ```
     - After:
  ```js
    // deflection (section on)
    deD=deflOf(moD);
  }
  ```
  2.
     - Before:
  ```js
function mkRow(x,t){
  if(envOn)return{x,t,Vmx:itp(env.V.mx,x),Vmn:itp(env.V.mn,x),Mmx:itp(env.M.mx,x),Mmn:itp(env.M.mn,x)};
  ```
     - After:
  ```js
/* Deflection curve (δ down positive) for one moment diagram mo[] (moved out of solve() unchanged, so the
   envelope can use it per combination). [] when the section is off, E or I ≤ 0, or no anchoring support. */
function deflOf(mo){
  let de=[];
  if(secOn&&Ev>0&&Iv>0){
    const EI=Ev*Iv,n=mo.length,F1=new Array(n).fill(0),F2=new Array(n).fill(0);
    for(let i=1;i<n;i++){const dx=mo[i].x-mo[i-1].x;F1[i]=F1[i-1]+.5*(mo[i-1].y+mo[i].y)*dx;}
    for(let i=1;i<n;i++){const dx=mo[i].x-mo[i-1].x;F2[i]=F2[i-1]+.5*(F1[i-1]+F1[i])*dx;}
    // constants from first & last support nodes: δ(xa)=δ(xb)=0
    const supIdx=nodes.map((nd2,j)=>nd2.t!=='free'?j:-1).filter(j=>j>=0);
    const xsD=mo.map(p=>p.x);
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
    if(C1!==null)de=mo.map((p,i)=>({x:p.x,y:(-F2[i]+C1*p.x+C2)/EI}));
  }
  return de;
}
function mkRow(x,t){
  if(envOn)return{x,t,Vmx:itp(env.V.mx,x),Vmn:itp(env.V.mn,x),Mmx:itp(env.M.mx,x),Mmn:itp(env.M.mn,x),
    Dmx:env.D?itp(env.D.mx,x):null,Dmn:env.D?itp(env.D.mn,x):null};
  ```
  3.
     - Before:
  ```js
    shD=env.V.mx;moD=env.M.mx;deD=[];crits={zV:[],inf:[]};nodeR=nodes.map((_,j)=>({v:env.R[j].mx,m:0}));
  ```
     - After:
  ```js
    shD=env.V.mx;moD=env.M.mx;deD=[];crits={zV:[],inf:[]};nodeR=nodes.map((_,j)=>({v:env.R[j].mx,m:0}));
    // deflection envelope over the same enabled combinations (was: none in envelope mode, fix log O4)
    const dd=EK.map(k=>deflOf(res[k].mo));
    if(dd.length&&dd.every(d=>d.length===stX.length)){
      env.D={mx:[],mn:[],mxC:[],mnC:[]};
      for(let i=0;i<stX.length;i++){let a=-1e18,b=1e18,ac='',bc='';
        EK.forEach((k,q)=>{const v=dd[q][i].y;if(v>a){a=v;ac=k}if(v<b){b=v;bc=k}});
        env.D.mx.push({x:stX[i],y:a});env.D.mn.push({x:stX[i],y:b});env.D.mxC.push(ac);env.D.mnC.push(bc);}
      env.per.forEach((pc,q)=>{pc.dm=Math.max(...dd[q].map(p=>Math.abs(p.y)));});
      // governing signed curve: at each station the larger of |δ max| and |δ min|
      deD=env.D.mx.map((p,i)=>Math.abs(env.D.mn[i].y)>Math.abs(p.y)?env.D.mn[i]:p);
    }
  ```
  4.
     - Before:
  ```js
  return spans.map((sp,i)=>{const xa=nodeX[i],xb=nodeX[i+1];let dm=0,dx=xa;
    deD.forEach(p=>{if(p.x>=xa-1e-9&&p.x<=xb+1e-9&&Math.abs(p.y)>dm){dm=Math.abs(p.y);dx=p.x;}});
    const allow=defLim>0?sp.L/defLim:0;
    return{i,L:sp.L,dm,x:dx,allow,ratio:allow>0?dm/allow:0,ok:allow>0?dm<=allow:true};});
  ```
     - After:
  ```js
  return spans.map((sp,i)=>{const xa=nodeX[i],xb=nodeX[i+1];let dm=0,dx=xa,dk=-1;
    deD.forEach((p,k)=>{if(p.x>=xa-1e-9&&p.x<=xb+1e-9&&Math.abs(p.y)>dm){dm=Math.abs(p.y);dx=p.x;dk=k;}});
    const allow=defLim>0?sp.L/defLim:0;
    // envelope: combination that governs δ at that station
    const c=envOn&&env&&env.D&&dk>=0?(Math.abs(env.D.mn[dk].y)>Math.abs(env.D.mx[dk].y)?env.D.mnC[dk]:env.D.mxC[dk]):null;
    return{i,L:sp.L,dm,x:dx,allow,ratio:allow>0?dm/allow:0,ok:allow>0?dm<=allow:true,c};});
  ```
  5.
     - Before:
  ```js
  g('dDefl').classList.toggle('hidden',!(secOn&&!envOn));
  ```
     - After:
  ```js
  g('dDefl').classList.toggle('hidden',!secOn);
  ```
  6.
     - Before:
  ```js
  const showD=secOn&&!envOn&&deD.length;
  ```
     - After:
  ```js
  const showD=secOn&&deD.length;
  ```
  7.
     - Before:
  ```js
      h+=`<div class="sc ${ok?'ctm':'crd'}"><div class="sc-l">σ env</div><div class="sc-v">${sg.toFixed(2)}</div><div class="sc-u">${fu}/${lu}²${Fbv>0?` / ${Fbv} ${ok?'✓':'✗'}`:''}</div></div>`;}
  } else {
  ```
     - After:
  ```js
      h+=`<div class="sc ${ok?'ctm':'crd'}"><div class="sc-l">σ env</div><div class="sc-v">${sg.toFixed(2)}</div><div class="sc-u">${fu}/${lu}²${Fbv>0?` / ${Fbv} ${ok?'✓':'✗'}`:''}</div></div>`;}
    if(deD.length){const dm=Math.max(...deD.map(p=>Math.abs(p.y)));
      let lim='',ok=true;
      if(defLim>0){const gv=deflGov();ok=deflSpans().every(s2=>s2.ok);lim=` / span ${gv.i+1}: L/${defLim}=${gv.allow.toFixed(4)} ${ok?'✓':'✗'}`;}
      h+=`<div class="sc ${ok?'cam':'crd'}"><div class="sc-l">|δ| env</div><div class="sc-v">${dm.toFixed(4)}</div><div class="sc-u">${lu}${lim}</div></div>`;}
  } else {
  ```
  8.
     - Before:
  ```js
  if(envOn){g('pkV').textContent='envelope';g('pkM').textContent='envelope';}
  ```
     - After:
  ```js
  if(envOn){g('pkV').textContent='envelope';g('pkM').textContent='envelope';if(g('pkD'))g('pkD').textContent=deD.length?`|δ|max:${Math.max(...deD.map(p=>Math.abs(p.y))).toFixed(4)} ${lu} (envelope)`:'';}
  ```
  9.
     - Before:
  ```js
    ?`<tr><th>x (${lu})</th><th>Vmax (${fu})</th><th>Vmin (${fu})</th><th>Mmax (${fu}·${lu})</th><th>Mmin (${fu}·${lu})</th><th></th></tr>`
    :`<tr><th>x (${lu})</th><th>V (${fu})</th><th>M (${fu}·${lu})</th>${deD.length?`<th>δ (${lu})</th>`:''}<th></th></tr>`;
  ```
     - After:
  ```js
    ?`<tr><th>x (${lu})</th><th>Vmax (${fu})</th><th>Vmin (${fu})</th><th>Mmax (${fu}·${lu})</th><th>Mmin (${fu}·${lu})</th>${env&&env.D?`<th>δmax (${lu})</th><th>δmin (${lu})</th>`:''}<th></th></tr>`
    :`<tr><th>x (${lu})</th><th>V (${fu})</th><th>M (${fu}·${lu})</th>${deD.length?`<th>δ (${lu})</th>`:''}<th></th></tr>`;
  ```
  10.
     - Before:
  ```js
      ?`<td>${r.x.toFixed(3)}</td><td>${r.Vmx.toFixed(3)}</td><td>${r.Vmn.toFixed(3)}</td><td>${r.Mmx.toFixed(3)}</td><td>${r.Mmn.toFixed(3)}</td><td><span
  ```
     - After:
  ```js
      ?`<td>${r.x.toFixed(3)}</td><td>${r.Vmx.toFixed(3)}</td><td>${r.Vmn.toFixed(3)}</td><td>${r.Mmx.toFixed(3)}</td><td>${r.Mmn.toFixed(3)}</td>${r.Dmx!=null?`<td>${r.Dmx.toFixed(5)}</td><td>${r.Dmn.toFixed(5)}</td>`:''}<td><span
  ```
  11.
     - Before:
  ```js
  const mn=Math.min(...deD.map(p=>p.y),0),mx=Math.max(...deD.map(p=>p.y),0),rng=mx-mn||1e-9;
  ```
     - After:
  ```js
  const DS=envOn&&env&&env.D?[env.D.mx,env.D.mn]:[deD]; // envelope: max and min curves
  const mn=Math.min(...DS.map(d=>Math.min(...d.map(p=>p.y))),0),mx=Math.max(...DS.map(d=>Math.max(...d.map(p=>p.y))),0),rng=mx-mn||1e-9;
  ```
  12.
     - Before:
  ```js
  ctx.beginPath();ctx.moveTo(tx(deD[0].x),z0);deD.forEach(p=>ctx.lineTo(tx(p.x),ty(p.y)));ctx.lineTo(tx(deD[deD.length-1].x),z0);ctx.closePath();ctx.fillStyle=gr;ctx.fill();
  ctx.beginPath();ctx.strokeStyle='#0891b2';ctx.lineWidth=2.2;ctx.lineJoin='round';deD.forEach((p,i)=>i===0?ctx.moveTo(tx(p.x),ty(p.y)):ctx.lineTo(tx(p.x),ty(p.y)));ctx.stroke();
  ```
     - After:
  ```js
  if(DS.length>1)DS.forEach((d,q)=>{ctx.beginPath();ctx.strokeStyle=q?'#dc2626':'#2563eb';ctx.lineWidth=2;ctx.lineJoin='round';d.forEach((p,i)=>i===0?ctx.moveTo(tx(p.x),ty(p.y)):ctx.lineTo(tx(p.x),ty(p.y)));ctx.stroke();});
  else{
  ctx.beginPath();ctx.moveTo(tx(deD[0].x),z0);deD.forEach(p=>ctx.lineTo(tx(p.x),ty(p.y)));ctx.lineTo(tx(deD[deD.length-1].x),z0);ctx.closePath();ctx.fillStyle=gr;ctx.fill();
  ctx.beginPath();ctx.strokeStyle='#0891b2';ctx.lineWidth=2.2;ctx.lineJoin='round';deD.forEach((p,i)=>i===0?ctx.moveTo(tx(p.x),ty(p.y)):ctx.lineTo(tx(p.x),ty(p.y)));ctx.stroke();}
  ```
  13.
     - Before:
  ```js
  if(deD.length){
    traces.push({x:XS(deD),y:YS(deD),name:'δ',type:'scatter',mode:'lines',
      fill:'tozeroy',fillcolor:'rgba(8,145,178,.13)',
      line:{color:'#0891b2',width:2.2},showlegend:false,
      hovertemplate:`x %{x:.3f} ${lu}<br>δ %{y:.5f} ${lu}<extra></extra>`});
  ```
     - After:
  ```js
  const envD=envOn&&env&&env.D;
  if(deD.length){
    if(envD){
      traces.push({x:XS(env.D.mx),y:YS(env.D.mx),name:'Envelope max (down)',type:'scatter',mode:'lines',
        line:{color:'#2563eb',width:2},hovertemplate:`max %{y:.5f} ${lu}<extra></extra>`});
      traces.push({x:XS(env.D.mn),y:YS(env.D.mn),name:'Envelope min',type:'scatter',mode:'lines',
        fill:'tonexty',fillcolor:'rgba(37,99,235,.12)',
        line:{color:'#dc2626',width:2},hovertemplate:`min %{y:.5f} ${lu}<extra></extra>`});
    }else
    traces.push({x:XS(deD),y:YS(deD),name:'δ',type:'scatter',mode:'lines',
      fill:'tozeroy',fillcolor:'rgba(8,145,178,.13)',
      line:{color:'#0891b2',width:2.2},showlegend:false,
      hovertemplate:`x %{x:.3f} ${lu}<br>δ %{y:.5f} ${lu}<extra></extra>`});
  ```
  14.
     - Before:
  ```js
    shapes,annotations:anns,showlegend:false
  },PCFG('deflection'));
  ```
     - After:
  ```js
    shapes,annotations:anns,showlegend:!!envD,
    legend:{orientation:'h',y:1.14,x:0,font:{size:10},bgcolor:'rgba(0,0,0,0)'}
  },PCFG('deflection'));
  ```
  15.
     - Before:
  ```js
    s3+=`<table class="ctb"><thead><tr><th>Combination</th><th>|V|max</th><th>|M|max</th></tr></thead><tbody>`;
    env.per.forEach(pc=>s3+=`<tr><td>${pc.name}</td><td>${pc.vm.toFixed(3)} ${fu}</td><td>${pc.mm.toFixed(3)} ${fu}·${lu}</td></tr>`);
  ```
     - After:
  ```js
    s3+=`<table class="ctb"><thead><tr><th>Combination</th><th>|V|max</th><th>|M|max</th>${env.D?'<th>|δ|max</th>':''}</tr></thead><tbody>`;
    env.per.forEach(pc=>s3+=`<tr><td>${pc.name}</td><td>${pc.vm.toFixed(3)} ${fu}</td><td>${pc.mm.toFixed(3)} ${fu}·${lu}</td>${env.D?`<td>${pc.dm.toFixed(5)} ${lu}</td>`:''}</tr>`);
  ```
  16.
     - Before:
  ```js
    html+=sec(N++,'Envelope Results — All Combinations',s3);
  ```
     - After:
  ```js
    if(deD.length){const dm=Math.max(...deD.map(p2=>Math.abs(p2.y)));
      s3+=`<div class="bxb">${p('<strong>Deflection envelope</strong> — δ by double integration of M/EI for each enabled combination, enveloped point-wise. A factored combination gives a factored deflection: for a service-level check, enable only service combinations or use single-combination mode.')}${kb(`|\\delta|_{\\text{env}}=\\boxed{${dm.toFixed(6)}\\,\\text{${lu}}}`)}`;
      if(defLim>0)deflSpans().forEach(s2=>{s3+=kb(`\\text{Span ${s2.i+1}: }|\\delta|_{\\max}=${s2.dm.toFixed(5)}\\;${s2.ok?'\\le':'>'}\\;L_{${s2.i+1}}/${defLim}=${s2.L}/${defLim}=${s2.allow.toFixed(5)}\\,\\text{${lu}}\\;\\Rightarrow\\;${s2.ok?'\\text{OK}\\;\\checkmark':'\\text{NG}\\;\\times'}\\;\\text{(${s2.c&&COMBOS[s2.c]?COMBOS[s2.c].name:''})}`);});
      s3+=`</div>`;}
    html+=sec(N++,'Envelope Results — All Combinations',s3);
  ```
  17.
     - Before:
  ```js
    rows.push(['x ('+lu+')','Vmax ('+fu+')','Vmin ('+fu+')','Mmax ('+fu+'·'+lu+')','Mmin ('+fu+'·'+lu+')','Type']);
    tabR.forEach(r=>rows.push([r.x.toFixed(4),r.Vmx.toFixed(4),r.Vmn.toFixed(4),r.Mmx.toFixed(4),r.Mmn.toFixed(4),r.t]));
  ```
     - After:
  ```js
    const eD=!!(env&&env.D);
    rows.push(['x ('+lu+')','Vmax ('+fu+')','Vmin ('+fu+')','Mmax ('+fu+'·'+lu+')','Mmin ('+fu+'·'+lu+')',...(eD?['delta max ('+lu+')','delta min ('+lu+')']:[]),'Type']);
    tabR.forEach(r=>rows.push([r.x.toFixed(4),r.Vmx.toFixed(4),r.Vmn.toFixed(4),r.Mmx.toFixed(4),r.Mmn.toFixed(4),...(eD?[r.Dmx.toFixed(6),r.Dmn.toFixed(6)]:[]),r.t]));
  ```
  18.
     - Before:
  ```js
  if(!envOn&&deD.length){const dm=Math.max(...deD.map(p=>Math.abs(p.y)));
    if(defLim>0)deflSpans().forEach(s2=>{h+=`<tr><td>δ<sub>max</sub>, span ${s2.i+1}</td>
  ```
     - After:
  ```js
  if(deD.length){const dm=Math.max(...deD.map(p=>Math.abs(p.y)));
    if(defLim>0)deflSpans().forEach(s2=>{h+=`<tr><td>δ<sub>max</sub>, span ${s2.i+1}${s2.c&&COMBOS[s2.c]?' ('+esc(COMBOS[s2.c].name)+')':''}</td>
  ```
  19.
     - Before:
  ```js
    if(id==='cD'&&!(secOn&&!envOn&&deD.length))continue;
  ```
     - After:
  ```js
    if(id==='cD'&&!(secOn&&deD.length))continue;
  ```
  20.
     - Before:
  ```js
  if(envOn){h+=`<tr><th>x (${lu})</th><th>Vmax (${fu})</th><th>Vmin (${fu})</th><th>Mmax (${fu}·${lu})</th><th>Mmin (${fu}·${lu})</th></tr>`;
    tabR.forEach(r=>h+=`<tr><td>${r.x.toFixed(3)}</td><td>${r.Vmx.toFixed(3)}</td><td>${r.Vmn.toFixed(3)}</td><td>${r.Mmx.toFixed(3)}</td><td>${r.Mmn.toFixed(3)}</td></tr>`);}
  ```
     - After:
  ```js
  if(envOn){const eD=!!(env&&env.D);h+=`<tr><th>x (${lu})</th><th>Vmax (${fu})</th><th>Vmin (${fu})</th><th>Mmax (${fu}·${lu})</th><th>Mmin (${fu}·${lu})</th>${eD?`<th>δmax (${lu})</th><th>δmin (${lu})</th>`:''}</tr>`;
    tabR.forEach(r=>h+=`<tr><td>${r.x.toFixed(3)}</td><td>${r.Vmx.toFixed(3)}</td><td>${r.Vmn.toFixed(3)}</td><td>${r.Mmx.toFixed(3)}</td><td>${r.Mmn.toFixed(3)}</td>${eD?`<td>${r.Dmx.toFixed(5)}</td><td>${r.Dmn.toFixed(5)}</td>`:''}</tr>`);}
  ```
- **Check case:** simple span 20 ft, uniform 2 kip/ft DL, E = 4,176,000 ksf, I = 0.02 ft⁴ (EI = 83,520 kip·ft²), L/360, default combinations, envelope mode.
  - Before: no deflection output.
  - After, |δ|max per combination: Unfactored 0.04989 ft; 1.4D 0.06984 ft; 1.2D(+…) 0.05987 ft; 0.9D+1.0W 0.04490 ft.
  - Result: |δ|env = **0.069843 ft (1.4DL)** > L/360 = 20/360 = 0.05556 ft → **NG**.
  - Hand check: 5wL⁴/(384EI) = 5 × 2.8 × 20⁴ / (384 × 83,520) = 2,240,000 / 32,071,680 = 0.069843 ft ✓.
- **How verified:** check case in Chromium (cards, calculation panel, CSV, report); 20-case comparison; screenshots of the envelope plot (Plotly and the canvas fallback).
- **Other copies of this code:** none.

### Needs engineer (this sweep)
- **O3 (unchanged).** The cantilever deflection limit uses l = overhang length. IBC 2021 Table 1604.3 footnote i takes l = 2 × cantilever length, which is less conservative (the Timber tool uses 2L, R1-c).
  - Question: switch cantilever spans to 2L (with an option)?
  - Recommendation: keep L as the default (conservative). Add a "cantilever l = 2L (IBC)" option only if you want it.
- **New (raised, not changed): the default wind combination uses 0.5L.** `defCombos()` row `12W` is 1.2D + 0.5L + 0.5S + 1.0W.
  - ASCE 7-16 Sec. 2.3.1 Exception 1 permits 0.5L only where L_o ≤ 100 psf, and not for garages or public assembly. Otherwise the factor is 1.0L (the LRFD preset already uses 1.0L).
  - Question: change the default row to 1.0L?
  - Recommendation: yes (the code default, and more conservative). It affects new projects only, because saved projects carry their own combinations. The hint now notes it.
- **F14 follow-up:** should combinations carry a "service" flag, so the deflection envelope uses only service combinations?
  - Recommendation: not needed now; every check names the governing combination.

## 2026-10-12 — PR: claude/sm-12w (PR link added after merge)

### F15 (O8). Default wind combination "12W" uses 1.0L   [CALCULATION CHANGE — default combination list only] [MORE conservative]
- **Engineer's decision (2026-10-12, via coordinator):** change the default "12W" row to 1.2D + 1.0L + 0.5S + 1.0W. Apply it to new projects and defaults only; saved projects keep their lists.
- **Where:** `defCombos()` (anchor `{id:'12W',f:`) and the hint under the combinations table (anchor `Its wind row is combination 4 with 1.0L`).
- **Problem:** the default row was 1.2D + 0.5L + 0.5S + 1.0W. ASCE 7-16 Sec. 2.3.1 combination 4 is 1.2D + 1.0W + L + 0.5(Lr or S or R). The 0.5L factor is only permitted by Exception 1, where L_o ≤ 100 psf, excluding garages and areas of public assembly. The tool cannot know the occupancy, so the default was unconservative for occupancies that do not qualify.
- **Governing provision:** ASCE 7-16 Sec. 2.3.1, combination 4 and Exception 1 (verify the numbering against the printed standard).
- **Scope / saved data:**
  - The row id stays `12W`, so a saved `cid` still points to it. Only the factor values in `defCombos()` change.
  - Projects, autosaves and files store their own `combos` list, and `applyProject` uses it when present. Their results are therefore unchanged.
  - The new factor applies to the start-up default (a browser with no autosave) and any file without a `combos` field.
  - No key or format changed.
- **Before / After:**
  1.
     - Before:
  ```js
 {id:'12W',f:{DL:1.2,LL:.5,SL:.5,WL:1},on:true},
  ```
     - After:
  ```js
 {id:'12W',f:{DL:1.2,LL:1,SL:.5,WL:1},on:true}, // ASCE 7-16 2.3.1 comb. 4 (was 0.5L: Exception 1 only)
  ```
  2.
     - Before:
  ```html
The default list's "Unfactored (1.0 All)" row is not a code combination, and its wind row uses 0.5L (ASCE 7-16 Sec. 2.3.1 Exception 1: only where L<sub>o</sub> ≤ 100 psf, not garages or public assembly).
  ```
     - After:
  ```html
The default list's "Unfactored (1.0 All)" row is not a code combination. Its wind row is combination 4 with 1.0L; where ASCE 7-16 Sec. 2.3.1 Exception 1 applies (L<sub>o</sub> ≤ 100 psf, not garages or public assembly) you may edit the L factor to 0.5.
  ```
- **Check case:** simple span 20 ft; uniform DL 1, LL 1 and WL 1 kip/ft (wind downward); default combinations.
  - "12W" single combination:
    - Before: w = 1.2 + 0.5 + 1.0 = 2.7 kip/ft → R = wL/2 = 27.000 kip, M = wL²/8 = 2.7 × 400/8 = 135.000 kip·ft.
    - After: w = 1.2 + 1.0 + 1.0 = 3.2 kip/ft → R = 32.000 kip, M = 160.000 kip·ft (+18.5%).
  - Envelope:
    - Before: |M| = 150.000 kip·ft, governed by "Unfactored (1.0 All)", w = 3.0.
    - After: |M| = 160.000 kip·ft, governed by 1.2DL+1.0LL+0.5SL+1.0WL.
  - The same project loaded with the old list saved in it: still 150.000 kip·ft and the old 12W factors (unchanged).
- **How verified:**
  - `node --check`: 3 inline scripts, 0 failures.
  - Headless Chromium, origin/main against the branch: the check case above (new project, single 12W, and the saved old list), and the hint text. No page errors.
- **Other copies of this code:** none. Steel Beam Design has its own default list, which is not changed here.

## Open items (not changed)
- O1. **Resolved 2026-10-12 (F9, claude/sweep-sm).** **Unit conversion.** Only a notice was added (F8). Real conversion would scale spans, loads (4 types), E, I, c, A, σ, user stations and the W-shape d/t_w, and would need a decision on saved projects. Recommend it as a separate PR if wanted.
- O2. **Resolved 2026-10-12 (F11, claude/sweep-sm).** **Roller → pin silent conversion** (`solve()`: `nodes.forEach(n2=>{if(n2.t==='roller')n2.t='pin';})`). Log only, as instructed. Pin and roller are mechanically identical in this model (no axial DOF), so no result is affected. The node dropdown offers only Pin/Fixed/Free, and the templates and "+ span" create 'roller', which is converted on the first solve. The only visible effect is the drawn symbol and the saved value. A proper fix means adding a "Roller" option (a UI change); not done.
- O3. **Still open: needs the engineer (see the 2026-10-12 "Needs engineer" list).** **Cantilever spans and IBC footnote.** F1 uses the span length for every span, including a free-end overhang. IBC Table 1604.3 footnote says that for cantilevers l is taken as twice the cantilever length, which gives a larger (less conservative) allowable. Kept at L (conservative); the engineer should decide.
- O4. **Resolved 2026-10-12 (F14, claude/sweep-sm).** **Envelope mode has no deflection** (deflection is computed in single-combination mode only). Not changed.
- O5. **Resolved 2026-10-12 (F13, claude/sweep-sm): edition stated; "U" kept.** **Default combination list includes the all-1.0 "U" combination** in the envelope, and the edition of the "ASCE 7" presets is not stated. Not changed (review item 6, low).
- O6. **Resolved 2026-10-12 (F12, claude/sweep-sm).** **Generic storage keys** `beamProSaves` / `beamProAuto` (shared file:// origin). Not changed: renaming needs a migration and was not in scope.
- O7. **Resolved 2026-10-12 (F10, claude/sweep-sm).** **W-shape presets with non-kip force units** keep the previous E (existing behaviour: E is set only when fu = kip). Part of O1.
- O8. **Resolved 2026-10-12 (F15, claude/sm-12w): default now 1.0L.** (2026-10-12) Default wind combination `12W` uses 0.5L (ASCE 7-16 Sec. 2.3.1 Exception 1). Raised, not changed; see the 2026-10-12 "Needs engineer" list.

## 2026-10-18 — PR: claude/snm-d11-report — D11: calculation-sheet report (format refresh) and §6 links (Tier 1, display only; PR link added after merge)

- **Engineer request:** AUDIT.md D11 (2026-10-14); scope decided 2026-10-18: **format refresh only** of the existing report builder for this tool, no new calculation content. CLAUDE.md §6 "show the work and link to it".
- **Provision:** none. No formula, factor, unit, code reference or computed result changed. No saved-data key or format changed (`smd_saves_v1`, `smd_auto_v1`, the JSON export, `bridgeSuite.v1.*` untouched); no input field was added.

### D11-1. Report rebuilt in the house calculation-sheet format
- **Where:** `buildReport()` (anchor `/* ── ENGINEERING REPORT ── */`, then `async function buildReport(){`) is replaced by the block that starts at `/* D11 (2026-10-18): calculation-sheet report` and ends at the `afterprint` listener. New helpers in that block: `SMD_TOOL`, `smdRefs()`, `smdPageCSS(dt)`, `smdApplyPageCSS(on,dt)`, `smdResultBlock(rows)`. CSS: new block `/* D11 calculation-sheet report (Gusset Plate Rating / ST-Girder format) */` after the existing `#repView` `@media print{…}` block. To re-apply by hand, copy those two blocks from this version.
- **Before:**
  - A blue title box (`<div class="rp-title"><h1>${nm}</h1><div class="rp-sub">Continuous Beam Analysis — Calculation Report</div>` with Date / Combination / Spans / Total length), then `<h2>1. Geometry &amp; Supports</h2>` … `<h2>6. Tabular Results</h2>`, the Method paragraph and the "Generated by Beam Pro" footer.
  - No references, no table of contents, no subsections, no page header/footer, the worked equations of the Engineering Calculations panel not in the report.
  - `window.addEventListener('afterprint',()=>document.body.classList.remove('repMode'));`
- **After:**
  - **Cover:** "Continuous Beam Analysis", project name, "Multi-Span Beam Pro — shear, moment and deflection diagrams · Calculation Report", the old meta line (Combination · Spans · Total length), and a title block Project / Project No. / Calculated by / Date / Checked by / Checked date. The tool has only a project-name field (`#projNm`), so Project No., Calculated by, Checked by and Checked date print "—". Date is the report date (as the old report's "Date:"). **No field added.**
  - **References** (`smdRefs()`, only what the tool cites): ASCE 7-16 Sec. 2.3.1 / 2.4.1 (combination presets and default list; always); IBC, "edition: verify" (only in envelope mode, where the method note says "each IBC combination"); AISC 360 Sec. G2.1, "edition: verify" (only when a W-shape preset is used, τ = V/(d·t_w)). A note says the deflection limit L/x and σ_allow are user inputs with no provision cited.
  - **Numbered table of contents** with links (sections and subsections).
  - **Sections** (the old content, unchanged values): 1 Geometry & Supports; 2 Applied Loads (unfactored); 3 Support Reactions; 4 Governing Results & Checks; 5 Diagrams (5.1 Loading, 5.2 Shear Force, 5.3 Bending Moment, 5.4 Deflection Curve when shown); 6 Tabular Results; 7 Engineering Calculations = the Method paragraph (moved from the end) and the on-screen calculation cards as subsections 7.k (Stiffness Method, Support Reactions, Critical Points, Section Analysis, User Positions; envelope mode: Envelope Results, Support Reactions — Envelope Max / Min). The cards "Configuration" and "Applied Loads (unfactored)" are left out because they repeat §1 and §2. Page breaks before §5, §6 and §7.
  - **Result lines** at the end of §4, only for the checks the tool already makes: "Bending stress σ_max = |M|c/I: D/C = σ/σ_allow (σ_allow …, user input) PASS/FAIL" when σ_allow > 0, and "Deflection δ_max, span i: D/C = δ/(L_i/x) (limit …, user input[; governing combination …]) PASS/FAIL" when L/x > 0. The ratios are the existing `sg/Fbv` (shown as % in the table) and `deflSpans().ratio`; PASS = the table's OK rule (`sg<=Fbv`, `s2.ok`).
  - **Print:** `@page` letter with margin boxes, in a `<style id="smd-page">` inside `@media print`, set when the report is built and cleared on `afterprint`: top "Project No: — / Description: <project>", "Computed By: — / Checked By: —", "Date: <report date> / Date: —"; bottom "<project> (Multi-Span Beam Pro)" and "Page X of Y". The app's own Print button (`bPr`) is unchanged and gets no margin boxes.
  - `buildReport()` now also calls `renderKaTeX()` (the cards are otherwise rendered 600 ms after an edit, so a quick Report could clone stale cards); cards the user had collapsed stay collapsed on screen.
  - `afterprint` → `{document.body.classList.remove('repMode');smdApplyPageCSS(false);}`.

### D11-2. Display fixes in the report (no result change)
1. Table headers were upper-cased (`#repView th{text-transform:uppercase}`), which printed "δmax" as "ΔMAX" (§6, and the envelope table in §7). Now `#repView.crdoc th{text-transform:none;…}`.
2. Plotly diagram images were taken at the on-screen width (≈ 1,000 px), so axis text printed at about 5 pt. `diagImg`: before `width:g(pd).clientWidth||900,`; after `width:Math.min(g(pd).clientWidth||900,820),` (report only; the PNG download button has its own code, unchanged).
3. The light-grey page background (`body` `--bg`) printed below the report on the last page and as a strip at the right edge: `@media print{body.repMode{background:#fff!important}}`.
4. Calculation boxes split across pages: `break-inside:avoid` on the cloned boxes and equations.

### D11-3. §6 links ("Worked in"; "see §7.k" in the report)
- **New helpers** (after `deflGov`, anchor `/* ---- D11 links`): `smdWkCards()`, `smdWorkedIn()`, `smdGoto(card)` and a document click handler for `a.wkA[data-card]` (ignored inside `#repView`). CSS `.wkLink`, `a.wkA`, `.csb.wkFlash`.
- **Link added (one line):** the result cards above the diagrams (`updStats`, `#statsRow`) quote R, |V|, |M|, σ and δ, which are worked in the Engineering Calculations cards at the bottom of the page. A "Worked in:" line under the cards links to them: R → Support Reactions; |V|max, |M|max → Critical Points; σmax, δmax → Section Analysis (only when E, I > 0 and c > 0 / δ computed); envelope mode: R → Support Reactions — Envelope Max / Min; |V|, |M|, σ, |δ| env → Envelope Results — All Combinations. No line when there are no loads or the model is unstable. Before: `g('statsRow').innerHTML=h;` After: `h+=smdWorkedIn();   /* D11 links */` then `g('statsRow').innerHTML=h;`.
- **Click:** expands the card if collapsed, scrolls the output column (only) to it and flashes it.
- **Report:** §3 and §4 end with "Worked in: R: see §7.2" / "|V|max, |M|max: see §7.3 · σmax, δmax: see §7.4" (PDF links). A card not in the printout would read "… (not in this printout)".

### Check case
- **Default (fresh browser, 2 × 12 ft, no loads):** 6 letter pages: cover, references/TOC, §1–§4, §5 (5.1–5.3), §6, §7 ("No calculation cards").
- **Simple span 20 ft, UDL DL 2 kip/ft + point LL 12 kip at 7 ft, 1.2DL+1.6LL, E = 4,176,000 kip/ft², I = 0.02 ft⁴, c = 0.5 ft, A = 0.05 ft², L/360, σ_allow = 3000 kip/ft²:** 8 pages. R_A = 36.4800, R_B = 30.7200 kip; |M|max = 196.6080 kip·ft at x = 7.2; σ = 196.608 × 0.5 / 0.02 = 4915.2 kip/ft² → D/C = 4915.2/3000 = **1.64 FAIL** (table: NG, 163.8%); δmax = 0.093628 ft vs 20/360 = 0.05556 ft → D/C = **1.69 FAIL** (table: NG). Links: "R: see §7.2", "|V|max, |M|max: see §7.3", "σmax, δmax: see §7.4". Same values as origin/main.
- **Envelope, 15 + 25 ft:** 8 pages; references add IBC; σ D/C 1.48 FAIL; δ span 1 0.20 PASS, span 2 0.78 PASS (1.2DL+1.6LL).
- **Cantilever 16 + 6 ft, W16×36:** 9 pages; references add AISC 360 G2.1; δ span 1 0.05 PASS, span 2 0.95 PASS.

### How verified (Tier 1)
- `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`: all scripts pass.
- `node tests/compare.mjs --tool page --file "Shear and Moment Diagrams.html"`: `page.text` same; `page.storage` differs only in the autosave time stamp `t` (identical with `t` zeroed). The only console error on both sides is the blocked plotly-basic CDN script (not in `tests/libs`).
- Headless Chromium (Playwright, tests/lib.mjs helpers, plotly-basic 2.27.0 from its npm package routed to the CDN URL), origin/main vs branch, 6 cases (default; simple span with σ and δ checks; two-span envelope with uplift; cantilever with a W-shape preset and user stations; fixed-fixed with point, moment and trapezoidal loads, section off; three spans, one load excluded, single-case view LL): reactions, V/M/δ arrays, envelope object, `deflSpans()`, tabular rows, the CSV text, the Engineering Calculations text, peak labels and the result-card text (less the new "Worked in" line) are identical, and identical again after the report is built. Run with Plotly and without (canvas diagrams). No console errors.
- Report PDFs (`emulateMedia print`, `preferCSSPageSize`) looked at page by page; every internal link in the report resolves to an element in it. In-app click test: the Section Analysis link expands a collapsed card and scrolls only the output column.

### Other copies
- None.

### Open items (not changed)
- O9. **Title-block fields.** The tool has no Project No., Computed/Checked by or dates; they print "—". Adding optional tool-prefixed fields (absent from saved files until typed) is possible if wanted.
- O10. **τ in envelope mode** is printed in §4 (τ = 1.5|V|/A or V/(d·t_w)) but not worked in any calculation card in envelope mode, so it has no "see §" link (CLAUDE.md §6 gap). Not changed (would add calculation content).
- O11. **On-screen result cards** upper-case their labels (`.sc-l{text-transform:uppercase}`), so "σ max" / "δ max" show as "Σ MAX" / "Δ MAX". On-screen display only, not changed (UI kept as is).
- O3 (cantilever span length for L/x) is still open: the cantilever check case above uses L = 6 ft for the overhang.
