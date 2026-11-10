# Fix log — Shear and Moment Diagrams.html

Governing basis used for fixes: structural mechanics (statics / Euler-Bernoulli beam), IBC 2021 §1604.3 (deflection limits use the span length l), AISC 360-16 / Manual 15th–16th Ed. Spec. G2.1 (web shear area A_w = d·t_w), AISC Shapes Database v16.0 (t_w values).

## 2026-10-04 — PR: claude/fix-shear-moment (PR #12: https://github.com/mlococo88/All-Structural/pull/12)

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

## 2026-10-04 — PR: claude/step1-group4 (PR #30: https://github.com/mlococo88/All-Structural/pull/30)
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

## 2026-10-12 — PR: claude/sweep-sm (open-item sweep; PR #155: https://github.com/mlococo88/All-Structural/pull/155)

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

## 2026-10-12 — PR: claude/sm-12w (PR #159: https://github.com/mlococo88/All-Structural/pull/159)

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

## 2026-10-18 — PR: claude/snm-d11-report — D11: calculation-sheet report (format refresh) and §6 links (Tier 1, display only; PR #276: https://github.com/mlococo88/All-Structural/pull/276)

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


## 2026-11-01 — PR: claude/rpt-smd — Report view in the shared report viewer (SMRP; analysis-only report; display only, no calculation change) (PR #538: https://github.com/mlococo88/All-Structural/pull/538)

Line numbers are approximate; search for the anchor text. Every code site is tagged `SMRP`.

### SMRP. "Report" view tab (shared/report.js, shared/steps.js)   [display only]
- **Engineer request (2026-11-01, report rollout plan):** the shared Report output tab, as Spread Footing and Timber Beam Check. This tool has no output tabs, so a two-button view strip, **Analysis | Report**, is added above the output column. Analysis is the existing page, unchanged. Report shows the report instead. Nothing is moved: `.main.smd-rpt` hides the other children of `.main` while the Report view is shown.
- **Analysis-only report:** the tool checks no member. Only the optional σ ≤ σ_allow and per-span δ ≤ L/x checks it already makes are shown with their D/C ratio.
- **Coordinator decisions recorded:**
  - The D11 "📄 Report" print button and "🖨 Print" (Ctrl+P) from the Analysis view are unchanged. Ctrl+P while the Report view is shown prints the report.
  - Step values are the tool's own numbers: `nodeR`, `shD`, `moD`, `deD`, `env`, `crits`, `tabR`, `deflSpans()`. The maxima, σ = |M|c/I, τ (`tauOf`) and ΣF are taken exactly as the Engineering Calculations cards take them (`renderKaTeX`). Only the substitution strings are formatted.
  - Missing title-block fields: the tool has a project name only, so Project No., Calculated by, Checked by and Checked date show "—". No new saved field was added.
- **Saved data:** none changed. The existing storage keys were left as they are: `smd_saves_v1` / `smd_auto_v1` and the generic legacy keys `beamProSaves` / `beamProAuto` that `smdMigrateKeys` reads (engineer, 2026-11-01). The Analysis / Report choice is kept in memory only (`SMRP.on`). It is not saved, so a reload opens Analysis.
- **Code:**
  - `<script src="shared/steps.js">` and `<script src="shared/report.js">` after the CDN libraries.
  - CSS for `#smdViewTabs` / `.main.smd-rpt` (anchor `SMRP: Analysis / Report view tabs`). `#smdViewTabs` is the first child of `.main`; `#smdRpt` is its last child.
  - A new block before the start-up calls (anchor `REPORT VIEW (SMRP, 2026-11-01)`):
    - `smrModel()` builds the report model.
    - `smrTopics()`, `smrRich()`, `smrRender()` (mount), `smrView(on)`.
    - A `MutationObserver` on `#cOut` rebuilds the report after every recalculation while it is shown.
    - A `beforeprint` listener handles Ctrl+P.
  - Diagrams:
    - The loading diagram is the canvas as drawn. While the Report view hides it, the output is shown for one synchronous redraw and capture, with no paint in between.
    - The V, M and δ diagrams are the Plotly charts through the D11 `diagImg()` (async). They are written into the model so that print has them. Without Plotly, the canvases are used.
- **Sections:**
  1. Summary: results table with § links; D/C for the σ and δ checks.
  2. Model, loads and combinations: geometry, loads, combination factors, section properties.
  3. Analysis. Single combination [stiffness method EI; reactions with ΣF, ΣR and the equilibrium flag; critical points (zero-shear moments, inflection points, |V|max, |M|max); section stresses σ, σ/σ_allow, τ; deflection δmax and per-span ratios]. Envelope [envelope |V|, |M|; σ; deflection per span; reactions max / min]. Also user positions.
  4. Diagrams and tabular results (tenth points).
  5. References (`smdRefs`).
- **How verified (headless Chromium, KaTeX 0.16.9 and Plotly 2.27.0 served locally):**
  - 9 cases: the five templates; two spans with section, σ_allow and L/240; three spans with user positions; cantilever 1.2D+1.6L; fixed-fixed envelope; cantilever envelope; W14×30 shape; unstable; no loads.
  - 0 to 21 steps in up to 5 topics. 0 unresolved or duplicate references, 0 KaTeX errors, no raw TeX, no NaN / undefined.
  - Step values equal the app's (reactions, |V|max, |M|max, ΣR, EI, σ, τ, δmax, per-span δ ratios; envelope R max / min, |V|env, |M|env). The values printed on the Analysis view's result cards and Engineering Calculations card are the same to the shown decimals.
  - Building the report leaves the results unchanged. 0 console errors.
  - The report follows an edit made while it is shown.
  - The diagrams are PNG images of the Plotly charts.
  - Ctrl+P in the Report view prints the report alone with the @page header (PDF 9 pages). From the Analysis view it is unchanged and the analysis output is shown again.
  - origin/main vs the branch, all 9 cases: the result cards, the Engineering Calculations, the tabular results, the loads table, the gathered project and localStorage are identical (6 texts each).
  - `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"` passes.
- **Check case (template "2-span continuous" 15 + 15 ft, DL 1.5 + LL 1.0 kip/ft, Unfactored):** R_A = R_C = 14.0625 kip, R_B = 46.8750 kip, ΣR = ΣF = 75.0000 kip; |M|max = 70.3127 kip-ft at x = 15. These are the same as the Engineering Calculations card (wL²/8 = 2.5 × 15² / 8 = 70.3125; the stations give 70.3127).
- **Open item:** at 390 px the page is wider than the screen (908 px), because of the header buttons. This is the existing layout and is unchanged. The report itself fits the width.
- **Other copies:** none. `shared/README.md` lists the tool as a user of `steps.js` and `report.js`.

Diff (`Shear and Moment Diagrams.html`, `git diff -U0` against origin/main):

```diff
diff --git a/Shear and Moment Diagrams.html b/Shear and Moment Diagrams.html
index 320e372..a5c90e0 100644
--- a/Shear and Moment Diagrams.html	
+++ b/Shear and Moment Diagrams.html	
@@ -9,0 +10,3 @@
+<!-- SMRP: shared worked steps and the shared report viewer (classic scripts, relative path: keep the shared folder next to this file) -->
+<script src="shared/steps.js"></script>
+<script src="shared/report.js"></script>
@@ -258,0 +262,7 @@ a.wkA:hover{text-decoration:underline}
+/* SMRP: Analysis / Report view tabs above the output column; the Report view hides the analysis output (nothing is moved) */
+#smdViewTabs{display:flex;gap:2px;border-bottom:2px solid #1e40af;flex:none}
+#smdViewTabs button{font:600 12px system-ui,sans-serif;padding:5px 14px;border:1px solid var(--bd);border-bottom:none;border-radius:6px 6px 0 0;background:#f1f5f9;color:#475569;cursor:pointer}
+#smdViewTabs button.on{background:#1e40af;color:#fff;border-color:#1e40af}
+.main.smd-rpt>*:not(#smdViewTabs):not(#smdRpt){display:none!important}
+.main:not(.smd-rpt)>#smdRpt{display:none}
+@media print{#smdViewTabs{display:none!important}}
@@ -358,0 +369 @@ a.wkA:hover{text-decoration:underline}
+  <div id="smdViewTabs" class="noprint" role="tablist" aria-label="Output view"><button type="button" data-v="ana" class="on">Analysis</button><button type="button" data-v="rpt">Report</button></div>
@@ -419,0 +431 @@ a.wkA:hover{text-decoration:underline}
+  <div id="smdRpt"></div>
@@ -2195,0 +2208,169 @@ window.addEventListener('afterprint',()=>{document.body.classList.remove('repMod
+/* ── REPORT VIEW (SMRP, 2026-11-01) ── the calculation report in the shared viewer (shared/report.js: navigation tree,
+   numbered sections §n.m, collapse / expand, search, Print with a title block, running header and page numbers), shown
+   in place of the analysis output by the "Report" view tab above it. Analysis-only report: model, loads, combinations,
+   reactions and equilibrium, critical points, section stresses and deflection, diagrams and the tabular results. Worked
+   steps are shared/steps.js steps grouped by topic (SharedSteps.group). Every value is a value the tool already has
+   (nodeR, shD, moD, deD, env, crits, tabR, deflSpans()); the maxima, σ, τ and ΣF are taken exactly as the Engineering
+   Calculations cards take them (renderKaTeX). Nothing is saved: the report is rebuilt whenever the calculation cards
+   are (after each edit) while the Report view is shown. The "📄 Report" print button (D11) is unchanged. */
+const SMRP={on:false,closed:new Set(),api:null,doc:null};
+const smrE=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
+const smrTx=s=>String(s==null?'':s).replace(/[\\{}$&#%_^~]/g,'');   // text placed inside \text{}
+const smrS=o=>SharedSteps.step(o);
+const smrC=(v,d)=>({t:(typeof v==='number'&&isFinite(v))?v.toFixed(d==null?3:d):'—',n:true});
+const smrDC=(v,ok,key)=>({t:(typeof v==='number'&&isFinite(v))?v.toFixed(3):'—',n:true,cls:ok?(v>=0.9?'hi':'ok'):'ng',key});
+function smrTopics(list,opt){
+  const L=list.filter(t=>t.steps&&t.steps.length),steps=[].concat(...L.map(t=>t.steps));
+  const topics=L.map(t=>{const q=SharedSteps.group(t.steps,[{key:'k',title:t.title,ref:t.ref,ids:()=>true,res:t.res}],{strip:false})[0];
+    return{title:t.title,ref:t.ref||'',n:t.steps.length,cls:q.cls,chip:q.chip,res:q.res};});
+  return Object.assign({type:'steps',scope:'sm',steps,topics},opt||{});
+}
+function smrModel(){
+  const nm=g('projNm').value.trim(),dt=new Date().toISOString().slice(0,10),ns=spans.length,U=`\\text{${smrTx(fu)}}`,FL=fu+'-'+lu;
+  const secs=[],sup=nodes.map((n2,j)=>n2.t!=='free'?j:-1).filter(j=>j>=0);
+  const ldTxt=ld=>{if(ld.type==='point')return`${ld.mag} ${fu} @ a = ${ld.pos} ${lu}`;if(ld.type==='moment')return`${ld.mag} ${fu}·${lu} (+CCW) @ a = ${ld.pos} ${lu}`;
+    if(ld.type==='uniform')return`${ld.mag} ${fu}/${lu}`;return`${ld.sm} → ${ld.em} ${fu}/${lu}, x from ${ld.sx} to ${ld.ex} ${lu}`;};
+  /* ---------- 2. Model, loads and combinations (built first: section 1 links into the later sections) ---------- */
+  const mSubs=[];
+  mSubs.push({title:'Geometry and supports',items:[{type:'table',head:['Span',`Length (${lu})`,'From node','To node'],rows:spans.map((sp,i)=>[String(i+1),smrC(sp.L,3),`${NN[i]} (${nodes[i].t})`,`${NN[i+1]} (${nodes[i+1].t})`])},
+    {type:'note',text:`${ns}-span beam, ${ns+1} nodes, total length ${totL.toFixed(3)} ${lu}. Units: ${fu}, ${lu}.`}]});
+  mSubs.push({title:'Applied loads (unfactored)',items:loads.length?[{type:'table',head:['#','Name','Type','Case','Location','Magnitude','Status'],rows:loads.map((ld,i)=>[String(i+1),ld.nm||'',typeLabel(ld.type),ld.lc,ld.allSpans?'Entire beam':`Span ${Math.min(ld.si||0,ns-1)+1}`,ldTxt(ld),ld.off?'EXCLUDED':'Included'])}].concat(loads.some(l=>l.off)?[{type:'note',warn:true,text:`${loads.filter(l=>l.off).length} load(s) are excluded and contribute nothing to the results.`}]:[]):[{type:'note',text:'No loads entered.'}]});
+  mSubs.push({title:'Load cases and combinations',items:[{type:'table',head:['Combination',...CASES.map(c=>c.id),'Envelope'],rows:combosArr.map(c=>({cls:!envOn&&!caseView&&c.id===cid?'gov':'',cells:[COMBOS[c.id].name,...CASES.map(cs=>c.f[cs.id]?fmtF(c.f[cs.id]):'—'),c.on!==false?'yes':'no']}))},
+    {type:'note',text:`Analysed: ${curName()}. ${CASES.map(c=>c.id+' = '+c.name).join(', ')}. Factors as entered in the combination table (presets: ASCE 7-16 Sec. 2.3.1 / 2.4.1 basic combinations).`}]});
+  if(secOn)mSubs.push({title:'Section properties',items:[{type:'table',head:['Quantity','Value','Unit'],rows:[['E',smrC(Ev,0),`${fu}/${lu}²`],['I',smrC(Iv,6),`${lu}⁴`],['c',smrC(cv,4),lu],['A',smrC(Av,5),`${lu}²`],['Shape',shpW?shpW.nm:'custom section','—'],['Deflection limit',defLim>0?'L/'+defLim:'off','—'],['Allowable stress σ_allow',Fbv>0?String(Fbv):'off',`${fu}/${lu}²`]]}]});
+  /* ---------- 3. Analysis ---------- */
+  const aSubs=[],res=[];   // res: summary rows [quantity, value cell, limit, ratio cell]
+  if(window.unstable)aSubs.push({title:'Stability',items:[{type:'note',warn:true,text:'UNSTABLE STRUCTURE: the support configuration is a mechanism (provide at least one fixed support or two pinned nodes). Results are suppressed.'}]});
+  else if(!loads.length)aSubs.push({title:'Results',items:[{type:'note',text:'Add loads to generate results.'}]});
+  else if(envOn){
+    const T=[],vm=Math.max(...env.per.map(p2=>p2.vm)),mm=Math.max(...env.per.map(p2=>p2.mm)),vg=env.per.find(p2=>p2.vm===vm),mg=env.per.find(p2=>p2.mm===mm);
+    T.push({title:'Envelope of internal forces',ref:'statics; point-wise envelope',res:/\.Menv$/,steps:[
+      smrS({id:'env.Venv',label:`Largest |V| over the enabled combinations (governed by ${vg.name})`,sym:'|V|_{env}',eq:'\\max_{c} |V|_{max,c}',sub:'',value:vm,unit:fu,d:4}),
+      smrS({id:'env.Menv',label:`Largest |M| over the enabled combinations (governed by ${mg.name})`,sym:'|M|_{env}',eq:'\\max_{c} |M|_{max,c}',sub:'',value:mm,unit:FL,d:4})]});
+    res.push(['|V| envelope',{t:vm.toFixed(4)+' '+fu,n:true,key:'sm/env.Venv'},'—','—'],['|M| envelope',{t:mm.toFixed(4)+' '+fu+'·'+lu,n:true,key:'sm/env.Menv'},'—','—']);
+    if(secOn&&Iv>0&&cv>0){const sg=mm*cv/Iv,st=[smrS({id:'env.sig',label:'Bending stress at the extreme fibre',sym:'\\sigma_{env}',eq:'\\frac{|M|_{env}\\,c}{I}',sub:`\\frac{${mm.toFixed(3)} \\times ${cv}}{${Iv}}`,value:sg,unit:`${fu}/${lu}^{2}`,d:4})];
+      if(Fbv>0)st.push(smrS({id:'env.sr',label:'Stress check (σ_allow = '+Fbv+', user input)',sym:'\\frac{\\sigma_{env}}{\\sigma_{allow}}',eq:'',sub:`\\frac{${sg.toFixed(3)}}{${Fbv}}`,value:sg/Fbv,unit:'',d:3,ok:sg<=Fbv}));
+      T.push({title:'Bending stress',ref:'σ = M c / I',res:/\.sig$/,steps:st});
+      res.push(['σ envelope = |M| c / I',{t:sg.toFixed(4)+` ${fu}/${lu}²`,n:true,key:'sm/env.sig'},Fbv>0?Fbv+` ${fu}/${lu}²`:'—',Fbv>0?smrDC(sg/Fbv,sg<=Fbv,'sm/env.sr'):'—']);}
+    if(deD.length){const dm=Math.max(...deD.map(p2=>Math.abs(p2.y))),st=[smrS({id:'env.dm',label:'Largest |δ| over the enabled combinations (double integration of M/EI per combination)',sym:'|\\delta|_{env}',eq:'',sub:'',value:dm,unit:lu,d:6,note:'A factored combination gives a factored deflection: for a service-level check enable only service combinations, or use single-combination mode.'})];
+      if(defLim>0)deflSpans().forEach(s2=>{st.push(smrS({id:'env.dr'+s2.i,label:`Span ${s2.i+1}: |δ|max = ${s2.dm.toFixed(5)} ${lu}${s2.c&&COMBOS[s2.c]?' ('+COMBOS[s2.c].name+')':''} against L/${defLim} = ${s2.L}/${defLim} = ${s2.allow.toFixed(5)} ${lu}`,sym:'\\frac{\\delta_{max}}{L/'+defLim+'}',eq:'',sub:`\\frac{${s2.dm.toFixed(5)}}{${s2.allow.toFixed(5)}}`,value:s2.ratio,unit:'',d:3,ok:s2.ok}));
+        res.push([`δ max, span ${s2.i+1}`,{t:s2.dm.toFixed(6)+' '+lu,n:true},`L/${defLim} = ${s2.allow.toFixed(5)} ${lu}`,smrDC(s2.ratio,s2.ok,'sm/env.dr'+s2.i)]);});
+      else res.push(['|δ| envelope',{t:dm.toFixed(6)+' '+lu,n:true,key:'sm/env.dm'},'—','—']);
+      T.push({title:'Deflection',ref:defLim>0?'limit L/'+defLim+' (user input)':'',res:/\.dm$/,steps:st});}
+    aSubs.push({title:'Envelope results — all enabled combinations',items:[{type:'note',text:'Each enabled combination is solved independently by the direct stiffness method; the envelope is taken point-wise at the analysis stations.'},
+      {type:'table',head:['Combination',`|V|max (${fu})`,`|M|max (${fu}·${lu})`,...(env.D?[`|δ|max (${lu})`]:[])],rows:env.per.map(pc=>({cls:pc===vg||pc===mg?'gov':'',cells:[pc.name,smrC(pc.vm,3),smrC(pc.mm,3),...(env.D?[smrC(pc.dm,5)]:[])]}))},smrTopics(T)]});
+    const RS=[];sup.forEach(j=>{RS.push(smrS({id:'R'+NN[j]+'max',label:`Largest reaction at ${NN[j]} (${COMBOS[env.R[j].mc].name})`,sym:`R_{${NN[j]},max}`,eq:'',sub:'',value:env.R[j].mx,unit:fu,d:4}),
+      smrS({id:'R'+NN[j]+'min',label:`Smallest reaction at ${NN[j]} (${COMBOS[env.R[j].mnc]?COMBOS[env.R[j].mnc].name:''})${env.R[j].mn<-1e-9?' — UPLIFT':''}`,sym:`R_{${NN[j]},min}`,eq:'',sub:'',value:env.R[j].mn,unit:fu,d:4}));
+      res.unshift([`R_${NN[j]} max / min`,{t:env.R[j].mx.toFixed(4)+' / '+env.R[j].mn.toFixed(4)+' '+fu,n:true,key:'sm/R'+NN[j]+'max'},'—','—']);});
+    aSubs.push({title:'Support reactions — envelope max / min',items:[smrTopics([{title:'Reactions',ref:'direct stiffness method',steps:RS}])]});
+  } else {
+    const fac=curFac(),EI=secOn&&Ev>0&&Iv>0?Ev*Iv:1,T=[];
+    T.push({title:'Stiffness method',ref:'Euler-Bernoulli beam elements',steps:[smrS({id:'EI',label:secOn&&Ev>0&&Iv>0?'Flexural stiffness of the elements':'Flexural stiffness (section off: EI = 1; reactions, V and M of a prismatic beam do not depend on EI)',sym:'EI',eq:secOn&&Ev>0&&Iv>0?'E\\,I':'',sub:secOn&&Ev>0&&Iv>0?`${Ev} \\times ${Iv}`:'',value:EI,unit:`${fu}-${lu}^{2}`,d:2,
+      note:'Element stiffness k_e = EI/L³ [12, 6L, −12, 6L; 6L, 4L², −6L, 2L²; …]; global assembly; K_ff d_f = f_f solved by Gaussian elimination; R = f − K d. Supports: '+nodes.map((n2,j)=>NN[j]+' '+n2.t).join(', ')+'.'})]});
+    const tF=loads.reduce((s,ld)=>{const fk=fac[ld.lc]||0;   /* ΣF exactly as the Support Reactions card (renderKaTeX) */
+      if(ld.off||ld.type==='moment')return s;
+      if(ld.allSpans)return s+ld.mag*fk*totL;
+      const spL=spans[Math.min(ld.si||0,ns-1)].L;
+      if(ld.type==='point')return s+ld.mag*fk;
+      if(ld.type==='uniform')return s+ld.mag*fk*spL;
+      return s+((ld.sm+ld.em)/2)*fk*((ld.ex||spL)-(ld.sx||0));},0);
+    const tR=nodeR.reduce((s,r)=>s+(r?.v||0),0),eqOK=Math.abs(tR-tF)<=1e-6*Math.max(1,Math.abs(tF)),RS=[];
+    sup.forEach(j=>{RS.push(smrS({id:'R'+NN[j],label:`Reaction at ${NN[j]} (${nodes[j].t})`+(Math.abs(nodeR[j].m)>1e-6?`; reaction couple M_R = ${nodeR[j].m.toFixed(4)} ${fu}·${lu}`:''),sym:`R_{${NN[j]}}`,eq:'',sub:'',value:nodeR[j].v,unit:fu,d:4}));
+      res.push([`R_${NN[j]}`+(Math.abs(nodeR[j].m)>1e-6?` (M_R = ${nodeR[j].m.toFixed(4)})`:''),{t:nodeR[j].v.toFixed(4)+' '+fu,n:true,key:'sm/R'+NN[j]},'—','—']);});
+    RS.push(smrS({id:'sumF',label:'Total applied vertical load (applied moments excluded)',sym:'\\sum F',eq:'',sub:'',value:tF,unit:fu,d:4}),
+      smrS({id:'sumR',label:'Equilibrium: sum of the reactions'+(eqOK?' = ΣF':' ≠ ΣF: do not use these results; check the model'),sym:'\\sum R',eq:sup.map(j=>`R_{${NN[j]}}`).join(' + '),sub:sup.map(j=>{const v=nodeR[j].v.toFixed(4);return v[0]==='-'?'('+v+')':v;}).join(' + '),value:tR,unit:fu,d:4,ok:eqOK}));
+    T.push({title:'Support reactions and equilibrium',ref:'statics',res:/sumR$/,steps:RS});
+    const mvp=shD.reduce((m,p2)=>Math.abs(p2.y)>Math.abs(m.y)?p2:m,shD[0]),mmp=moD.reduce((m,p2)=>Math.abs(p2.y)>Math.abs(m.y)?p2:m,moD[0]),CS=[];
+    crits.zV.forEach((x,k)=>CS.push(smrS({id:'zV'+k,label:`Zero shear at x = ${x.toFixed(4)} ${lu}: moment extremum`,sym:'M',eq:'',sub:'',value:itp(moD,x),unit:FL,d:4})));
+    if(crits.inf.length)CS.push(smrS({id:'inf',label:'Inflection points (M = 0)',sym:'x',eq:'',sub:'',value:crits.inf.map(x=>x.toFixed(4)).join(', ')+' '+lu,unit:'',d:0}));
+    CS.push(smrS({id:'Vmax',label:`Largest |V| at x = ${mvp.x.toFixed(3)} ${lu}`,sym:'|V|_{max}',eq:'',sub:'',value:Math.abs(mvp.y),unit:fu,d:4}),
+      smrS({id:'Mmax',label:`Largest |M| at x = ${mmp.x.toFixed(3)} ${lu}`,sym:'|M|_{max}',eq:'',sub:'',value:Math.abs(mmp.y),unit:FL,d:4}));
+    T.push({title:'Critical points',ref:'left-segment statics at the analysis stations',res:/Mmax$/,steps:CS});
+    res.push(['|V| max',{t:Math.abs(mvp.y).toFixed(4)+' '+fu,n:true,key:'sm/Vmax'},'—','—'],['|M| max',{t:Math.abs(mmp.y).toFixed(4)+' '+fu+'·'+lu,n:true,key:'sm/Mmax'},'—','—']);
+    if(secOn&&Ev>0&&Iv>0){
+      const mm2=Math.max(...moD.map(p2=>Math.abs(p2.y))),mv2=Math.max(...shD.map(p2=>Math.abs(p2.y))),SS=[];
+      if(cv>0){const sg=mm2*cv/Iv;SS.push(smrS({id:'sig',label:'Bending stress at the extreme fibre',sym:'\\sigma_{max}',eq:'\\frac{|M|_{max}\\,c}{I}',sub:`\\frac{${mm2.toFixed(3)} \\times ${cv}}{${Iv}}`,value:sg,unit:`${fu}/${lu}^{2}`,d:4}));
+        if(Fbv>0)SS.push(smrS({id:'sr',label:`Stress check (σ_allow = ${Fbv} ${fu}/${lu}², user input)`,sym:'\\frac{\\sigma_{max}}{\\sigma_{allow}}',eq:'',sub:`\\frac{${sg.toFixed(3)}}{${Fbv}}`,value:sg/Fbv,unit:'',d:3,ok:sg<=Fbv}));
+        res.push(['σ max = |M| c / I',{t:sg.toFixed(4)+` ${fu}/${lu}²`,n:true,key:'sm/sig'},Fbv>0?Fbv+` ${fu}/${lu}²`:'—',Fbv>0?smrDC(sg/Fbv,sg<=Fbv,'sm/sr'):'—']);}
+      const tq=tauOf(mv2);
+      if(tq){const w=shpW&&shpW.d>0&&shpW.tw>0;SS.push(smrS({id:'tau',label:w?`Average web shear (${shpW.nm}: A_w = d t_w)`:'Shear stress, solid rectangle',sym:'\\tau_{max}',eq:w?'\\frac{|V|_{max}}{d\\,t_{w}}':'\\frac{3|V|_{max}}{2A}',sub:w?`\\frac{${mv2.toFixed(3)}}{${shpW.d.toPrecision(4)} \\times ${shpW.tw.toPrecision(4)}}`:`\\frac{3 \\times ${mv2.toFixed(3)}}{2 \\times ${Av}}`,value:tq.val,unit:`${fu}/${lu}^{2}`,d:4,ref:w?'AISC 360 Sec. G2.1 (edition: verify)':''}));
+        res.push(['τ max = '+tbrStrip(tq.lbl),{t:tq.val.toFixed(4)+` ${fu}/${lu}²`,n:true,key:'sm/tau'},'—','—']);}
+      if(SS.length)T.push({title:'Section stresses',ref:'σ = M c / I',res:/sig$/,steps:SS});
+      if(deD.length){const dm=Math.max(...deD.map(p2=>Math.abs(p2.y))),DS=[smrS({id:'dm',label:'Largest deflection (double integration of M/EI; δ = 0 at the supports, cantilever: δ = 0 and slope = 0 at the fixed support)',sym:'\\delta_{max}',eq:'',sub:'',value:dm,unit:lu,d:6})];
+        if(defLim>0)deflSpans().forEach(s2=>{DS.push(smrS({id:'dr'+s2.i,label:`Span ${s2.i+1}: δmax = ${s2.dm.toFixed(5)} ${lu} at x = ${s2.x.toFixed(3)} against L/${defLim} = ${s2.L}/${defLim} = ${s2.allow.toFixed(5)} ${lu}`,sym:'\\frac{\\delta_{max}}{L/'+defLim+'}',eq:'',sub:`\\frac{${s2.dm.toFixed(5)}}{${s2.allow.toFixed(5)}}`,value:s2.ratio,unit:'',d:3,ok:s2.ok}));
+          res.push([`δ max, span ${s2.i+1}`,{t:s2.dm.toFixed(6)+' '+lu,n:true},`L/${defLim} = ${s2.allow.toFixed(5)} ${lu}`,smrDC(s2.ratio,s2.ok,'sm/dr'+s2.i)]);});
+        else res.push(['δ max',{t:dm.toFixed(6)+' '+lu,n:true,key:'sm/dm'},'—','—']);
+        T.push({title:'Deflection',ref:defLim>0?'limit L/'+defLim+' per span (user input)':'',res:/dm$/,steps:DS});}
+    } else if(secOn)aSubs.push({title:'Section analysis',items:[{type:'note',warn:true,text:'E and I must both be greater than 0: a blank, zero or negative value was entered, so deflection and section results are not computed.'}]});
+    aSubs.unshift({title:`Analysis for ${curName()}`,items:[smrTopics(T),{type:'note',text:'The same values are worked on the Analysis view (Engineering Calculations cards). Units: '+fu+', '+lu+'.'}]});
+  }
+  if(userX.length&&!window.unstable&&loads.length)aSubs.push({title:'User positions',items:[{type:'table',head:[`x (${lu})`,...(envOn?[`V min (${fu})`,`V max (${fu})`,`M min (${fu}·${lu})`,`M max (${fu}·${lu})`]:[`V (${fu})`,`M (${fu}·${lu})`,...(deD.length?[`δ (${lu})`]:[])])],
+    rows:userX.filter(ux=>ux>=0&&ux<=totL).map(ux=>envOn?[smrC(ux,3),smrC(itp(env.V.mn,ux),3),smrC(itp(env.V.mx,ux),3),smrC(itp(env.M.mn,ux),3),smrC(itp(env.M.mx,ux),3)]:[smrC(ux,3),smrC(itp(shD,ux),3),smrC(itp(moD,ux),3),...(deD.length?[smrC(itp(deD,ux),5)]:[])])}]});
+  /* ---------- 4. Diagrams and tabular results ---------- */
+  const dSubs=[];
+  if(!window.unstable&&loads.length){
+    /* the canvases are sized from their on-screen width: while the Report view hides them, show the analysis output for this synchronous redraw and capture (no paint in between) */
+    const mn=document.querySelector('.main'),hid=mn.classList.contains('smd-rpt');if(hid){mn.classList.remove('smd-rpt');drawAll();}
+    /* loading diagram: the canvas as drawn; V, M, δ: the Plotly charts when Plotly is loaded (filled in by smrRender through the D11 diagImg(), as the 📄 Report does), else their canvases */
+    const figs=[['cL','Loading diagram'],['cS','Shear force diagram'],['cM','Bending moment diagram'],['cD','Deflection curve (δ, down positive)']].filter(([id])=>id!=='cD'||(secOn&&deD.length)).map(([id,t])=>{const late=id!=='cL'&&hasPlotly();let u='';if(!late)try{u=g(id).toDataURL('image/png');}catch(e){}
+      return late||(u&&u.length>100)?{type:'figure',_img:late?id:null,svg:smrImg(u,t,late?id:''),caption:t+' ('+curName()+')'}:null;}).filter(Boolean);
+    if(hid)mn.classList.add('smd-rpt');
+    if(figs.length)dSubs.push({title:'Diagrams',items:figs});
+    const eD=!!(env&&env.D);
+    dSubs.push({title:'Tabular results (tenth points'+(userX.length?' and user positions':'')+')',items:[{type:'table',head:envOn?[`x (${lu})`,`V max (${fu})`,`V min (${fu})`,`M max (${fu}·${lu})`,`M min (${fu}·${lu})`,...(eD?[`δ max (${lu})`,`δ min (${lu})`]:[])]:[`x (${lu})`,`V (${fu})`,`M (${fu}·${lu})`,...(deD.length?[`δ (${lu})`]:[])],
+      rows:tabR.map(r=>envOn?[smrC(r.x,3),smrC(r.Vmx,3),smrC(r.Vmn,3),smrC(r.Mmx,3),smrC(r.Mmn,3),...(eD?[smrC(r.Dmx,5),smrC(r.Dmn,5)]:[])]:[smrC(r.x,3),smrC(r.V,3),smrC(r.M,3),...(deD.length?[smrC(r.D||0,5)]:[])])}]});
+  }
+  /* ---------- 1. Summary ---------- */
+  const sItems=[{type:'kv',rows:[['Analysis',curName()],['Spans',`${ns} (total length ${totL.toFixed(3)} ${lu})`],['Units',`${fu}, ${lu}`],['Method','Direct stiffness method, Euler-Bernoulli beam elements; internal forces by left-segment statics; deflection by double integration of M/EI']]}];
+  if(res.length)sItems.push({type:'table',head:['Quantity','Value','Limit','D/C'],rows:res},{type:'note',text:'Each value links to the step where it is taken. The deflection limit L/x and σ_allow are user inputs; the analysis (statics, beam theory) cites no design code.'});
+  else if(window.unstable)sItems.push({type:'note',warn:true,text:'UNSTABLE STRUCTURE: results suppressed.'});
+  secs.push({title:'Summary',subs:[{title:'Results',items:sItems}]});
+  secs.push({title:'Model, loads and combinations',subs:mSubs});
+  secs.push({title:'Analysis',subs:aSubs});
+  if(dSubs.length)secs.push({title:'Diagrams and tabular results',subs:dSubs});
+  secs.push({title:'References',subs:[{title:'Codes and references cited',items:[{type:'table',head:['Reference','Provisions used'],rows:smdRefs().map(r=>r.map(tbrStrip))}]}]});
+  return{title:'Continuous Beam Analysis — Calculation Report',subtitle:nm||'Untitled',code:SMD_TOOL+' — shear, moment and deflection',
+    info:[['Project',nm],['Project No.',''],['Calculated by',''],['Date',dt],['Checked by',''],['Checked date','']],
+    head:{left:'Project No. — — '+(nm||'Beam analysis').slice(0,40),right:'Computed: — '+dt+' · Checked: —',foot:(nm||'Untitled')+' ('+SMD_TOOL+')'},sections:secs};
+}
+const smrImg=(u,t,id)=>`<img${id?` data-smrimg="${id}"`:''} src="${u||'data:,'}" alt="${smrE(t)}" style="width:100%;max-width:7in;border:1px solid #e2e8f0">`;
+function tbrStrip(s){return String(s==null?'':s).replace(/<sub>(.*?)<\/sub>/g,'$1').replace(/<[^>]+>/g,'').replace(/&amp;/g,'&');}
+/* rich-text notation in tables and notes: 'R_A', 'σ_allow', 't_w' → $…$ (subscripts) */
+const smrNot=s=>String(s==null?'':s).replace(/([A-Za-zσδτ])_([A-Za-z0-9]+)/g,(m,a,b)=>'$'+a+'_{'+b+'}$');
+function smrRich(M2){const cell=c=>(c&&typeof c==='object')?Object.assign({},c,{t:smrNot(c.t)}):smrNot(c);
+  M2.sections.forEach(s=>s.subs.forEach(q=>q.items.forEach(it=>{
+    if(it.type==='note')it.text=smrNot(it.text);
+    else if(it.type==='table'){it.head=it.head.map(cell);it.rows=it.rows.map(r=>Array.isArray(r)?r.map(cell):Object.assign({},r,{cells:r.cells.map(cell)}));}
+    else if(it.type==='steps')it.steps.forEach(st=>{st.label=st.label.replace(/_/g,'');st.note=String(st.note||'').replace(/_/g,'');});})));
+  return M2;}
+function smrRender(){
+  const T=g('smdRpt');if(!T||!SMRP.on)return;
+  if(!window.SharedReport||!window.SharedSteps){T.innerHTML='<div class="empty">shared/report.js or shared/steps.js is not loaded: keep the shared folder next to this file.</div>';SMRP.api=null;SMRP.doc=null;return;}
+  const m=document.querySelector('.main'),top=m?m.scrollTop:0;
+  let M2;try{M2=smrRich(smrModel());}catch(e){T.innerHTML='<div class="empty">Report error: '+smrE(e&&e.message)+'</div>';SMRP.api=null;SMRP.doc=null;console.error(e);return;}
+  SMRP.api=SharedReport.mount(T,M2,{closed:SMRP.closed});SMRP.doc=SMRP.api.doc;
+  /* Plotly diagrams as images (async): written into the model (for print) and into the page */
+  const tok=SMRP.tok=(SMRP.tok||0)+1;
+  M2.sections.forEach(sc=>sc.subs.forEach(q=>q.items.forEach(it=>{if(!it._img)return;
+    diagImg(it._img).then(u=>{if(tok!==SMRP.tok)return;it.svg=smrImg(u,it.caption,it._img);const im=T.querySelector(`img[data-smrimg="${it._img}"]`);if(im)im.src=u;}).catch(()=>{});})));
+  if(m)m.scrollTop=top;
+}
+function smrView(on){
+  SMRP.on=!!on;const m=document.querySelector('.main');m.classList.toggle('smd-rpt',SMRP.on);
+  document.querySelectorAll('#smdViewTabs button').forEach(b=>b.classList.toggle('on',(b.dataset.v==='rpt')===SMRP.on));
+  if(SMRP.on){readIn();solve();updStats();renderTable();drawAll();renderKaTeX();smrRender();}   /* the same refresh as the D11 report: results current before the report reads them */
+  else{drawAll();if(hasPlotly())['pS','pM','pD'].forEach(id=>{const d=g(id);if(d&&!d.classList.contains('hidden')&&d.data)try{Plotly.Plots.resize(d);}catch(e){}});}
+  m.scrollTop=0;
+}
+document.querySelectorAll('#smdViewTabs button').forEach(b=>b.addEventListener('click',()=>smrView(b.dataset.v==='rpt')));
+/* the report follows every recalculation: the Engineering Calculations cards (#cOut) are re-rendered after each edit */
+new MutationObserver(()=>{if(SMRP.on&&!document.body.classList.contains('repMode'))smrRender();}).observe(g('cOut'),{childList:true});
+/* Ctrl+P (🖨 Print) while the Report view is shown prints the report alone (shared/report.js print layout and running header);
+   from the Analysis view, and the 📄 Report button (D11), print as before. */
+window.addEventListener('beforeprint',()=>{
+  if(!SMRP.on||!SMRP.doc||document.body.classList.contains('rp-printing')||document.body.classList.contains('repMode'))return;
+  let box=g('rp-print');if(!box){box=document.createElement('div');box.id='rp-print';document.body.appendChild(box);}
+  box.innerHTML='<div class="rp"><article class="rp-doc">'+SharedReport.html(SMRP.doc,{lazy:false})+'</article></div>';
+  document.body.classList.add('rp-printing');
+});
+
```

## 2026-11-02 — PR: claude/phone-print-smd — Phone layout (header wraps) and a print page-break fix in the 📄 Report (PHN; display only, no calculation change) (PR #628: https://github.com/mlococo88/All-Structural/pull/628)

Engineer-approved overnight job (2026-11-02): phone layout at 390 / 768 px and report print polish, one PR per tool. Every code site is tagged `PHN`.

### PHN-1. Header wraps below 860 px   [display only]
- **Problem:** the header is one 50 px row (`header{height:50px;display:flex}`) holding the brand, the project box, the share buttons and eleven buttons/selects. Below the existing 860 px breakpoint the panels already stack, but the header row did not wrap, so the page scrolled sideways: 518 px at 390 px wide, 140 px at 768 px (the right-hand button group was 672 px wide).
- **Where:** the `@media(max-width:860px)` rule, anchor `body{overflow-y:auto;height:auto}#projNm{display:none}`.
- **Before:**
```css
@media(max-width:860px){…body{overflow-y:auto;height:auto}#projNm{display:none}}
```
- **After:**
```css
@media(max-width:860px){…body{overflow-y:auto;height:auto}#projNm{display:none}
  /* PHN (2026-11-02): phone / tablet: the header wraps instead of widening the page */
  header{height:auto;flex-wrap:wrap;padding:6px 10px;row-gap:6px}header>div{flex-wrap:wrap;min-width:0}}
```
- Above 860 px nothing changes (the rule is inside the existing breakpoint).

### PHN-2. 📄 Report print: a sub-heading no longer sits alone at a page foot   [display only]
- **Problem:** with the "3-span w/ point load" template, the 📄 Report (D11 calc sheet) printed "7.3 Critical Points" as the last line of page 6 and its content on page 7. `h3.cr-h2` has `break-after:avoid`, but the card body that follows (`.cr-calc .csb`) is a flex column whose first box is `break-inside:avoid`; Chromium did not honour the avoid across the flex container.
- **Where:** after the rule with anchor `#repView .cr-calc .bxg,#repView .cr-calc .bxr,#repView .cr-calc .bxb,#repView .cr-calc .bxo,#repView .cr-calc .keq,#repView .cr-calc .cload{break-inside:avoid}`.
- **Added:**
```css
@media print{#repView .cr-calc .csb{display:block}#repView .cr-calc .csb>*+*{margin-top:4px}}
```
  (4 px = the flex `gap` it replaces.) Only the printed 📄 Report changes. The screen and the Report view tab (shared viewer) are unchanged.
- **Check case:** template "3-span w/ point load", 📄 Report, print: before, page 6 ends with the heading "7.3 Critical Points"; after, page 7 starts with "7.3 Critical Points" and its boxes (7 pages both).

### Smoke test
- New `tests/smoke/phone-layout.mjs` (tool key `smd`): at 390 and 768 px, on load and after each view tab, the document is no wider than the window. Fails on origin/main (518 / 140 px), passes on this branch.

### How verified (no computed result, saved key or hand-off changed)
- origin/main vs this branch, headless Chromium, file://, template "3-span w/ point load": the page text (`innerText`) on load and on both view tabs at 1280 px, the whole-document `textContent`, and localStorage after load are identical; screenshots at 900 and 1280 px are pixel-identical (0 differing pixels) on load and on both tabs.
- Report view (shared viewer) printed: same 8 pages, same text (pdftotext) before and after.

## 2026-11-02 — PR: claude/smd-report-consolidate, PR #672: https://github.com/mlococo88/All-Structural/pull/672 (SMRX: the 📄 Report (D11 calculation sheet) retired after porting what the Report view lacked; 🖨 Print / Ctrl+P print the Report from either view; display only, no result change)

### SMRX-1. Content of the 📄 Report ported into the Report view   [display] [no result change]
- **Engineer request (2026-11-02):** retire the old print reports tool by tool where the Report tab is complete, as for lldf (#623) and Light Pole (#625): compare every number and section of the old report against the Report on the tool's test cases, port what is missing (the tool's own values, no recomputation), then remove the old report and print the Report from every tab.
- **Compared:** the 📄 Report (`buildReport()` → `#repView`, print media) on origin/main vs the Report view (`smrModel()`, Print report → `#rp-print`) on the branch, two cases built with `applyProject`: c1 = 2 × 12 ft, point 10 kip @ 4 ft (D), UDL 1.5 kip/ft on span 2 (L), UDL 0.8 kip/ft all spans, trapezoid 1→3 kip/ft from 2 to 10 ft on span 2, moment 5 kip·ft @ 6 ft, section on, σ_allow 30, L/360; c2 = envelope mode, LRFD preset, UDL 1.2 (D) all spans, UDL 2 (L) span 1, point 8 kip (L) @ 6 ft on span 2, section on, L/240. A number counts as present when the Report shows the same value (the same digits, or more digits that round to it).
- **Missing before the port, now in the Report:**
  - Envelope mode, τ: the 📄 Report's §4 table had "τmax = 1.5|V|/A … 1008.0003 kip/ft²" (`tauOf(vm)` with the envelope |V|); the Report had τ only in single-combination mode. Added to `smrModel()`'s envelope branch (anchor `res.push(['σ envelope = |M| c / I'`): a topic "Shear stress" with step `env.tau` (τ_env = 3|V|_env / 2A, or |V|_env / (d t_w) for a W-shape preset, the same forms as the single-combination step `tau`; value `tauOf(vm).val`) and a summary row "τ envelope = …" linking to it. Check (c2): τ_env = 3 × 33.600 / (2 × 0.05) = 1008.0 kip/ft²; the Report shows 1008.0003 kip/ft², the 📄 Report's value.
  - The method wording "(2 DOF/node), Gaussian elimination with partial pivoting … double numerical integration of M/EI anchored at the first and last supports" → Summary, Method row (was a shorter wording).
  - The footer line "Verify all results independently before use in design." → a note at the end of Summary §1.1.
- **Not ported (same information already in the Report):** the utilization percentage in the σ row ("NG ✗ (4276.7%)") is the D/C shown in the Report (42.768); the 📄 Report's section numbers, contents and print-run time stamp; the "Worked in … see §7.k" lines (the Report links each value to its step). Figures: the 📄 Report had the loading, shear, moment and deflection diagrams; the Report has the same four (§4.1).
- **After the port:** 0 numbers of the 📄 Report missing from the Report in either case (apart from its section numbers, the percentage above and the time stamp).

### SMRX-2. 📄 Report removed; Print prints the Report from either view   [display]
- **Removed:**
  - the header button `<button … id="bRp" …>📄 Report</button>`;
  - `<div id="repView"></div>`;
  - CSS from `/* ── report view ── */` (`#repView…`, `body.repMode…`, the D11 `#repView .cr-*` rules) through `@media print{body.repMode{background:#fff!important}}`; a one-line SMRX comment is in its place. Kept: the D11 links CSS (`.wkLink`, `a.wkA`), used on screen;
  - JS `smdPageCSS(dt)`, `smdApplyPageCSS(on,dt)`, `smdResultBlock(rows)`, `async function buildReport()`, the `g('bRp').onclick` handler and the `afterprint` handler that removed `repMode`. Kept: `SMD_TOOL`, `smdRefs()`, `diagImg(id)`, `smdWkCards()` / `smdWorkedIn()` / `smdGoto()` (used by the Report or on screen).
- **Changed:**
  - `g('bPr').onclick=()=>{readIn();window.print();};` → `g('bPr').onclick=()=>{readIn();smrPrint();};`. Ctrl+P already clicks `#bPr`. The tooltip now reads "Print / PDF the calculation report (Ctrl+P), from either view".
  - New `smrPrint()`, before the `beforeprint` handler: it opens the Report view if needed (`SMRP.back`), waits for `SMRP.ready` (the Plotly diagram images), then `SharedReport.print(SMRP.doc)`. With no report (shared files missing), it calls `window.print()` (page as shown).
  - The `beforeprint` handler: before, it ran only when the Report view was shown (`if(!SMRP.on||!SMRP.doc||…rp-printing…||…repMode…)return;`). After: `if(rp-printing)return; if(!SMRP.on){SMRP.back=true;smrView(true);} if(!SMRP.doc)return;` and then it fills `#rp-print` as before. This is the browser's own Print menu. It cannot wait for the async Plotly images, so a Plotly diagram not yet captured prints blank on that path only.
  - New `afterprint` handler: `if(SMRP.back){SMRP.back=false;smrView(false);}`. The Analysis view comes back.
  - `smrRender()`: the image promises are collected and saved as `SMRP.ready=Promise.all(imgs)`.
  - The MutationObserver guard: `&&!document.body.classList.contains('repMode')` dropped, because `repMode` no longer exists.
  - The `a.wkA` click handler: `if(a&&!a.closest('#repView'))` → `if(a)`.
- **Remembered tab:** none. The view (Analysis / Report) is not saved, so there is nothing to redirect.
- **Governing provision:** none changed (display only). No formula, factor, unit, code reference or computed value changed (CLAUDE.md §4).
- **How verified:**
  - `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`: pass.
  - Results and storage, origin/main vs branch, cases c1 and c2 plus the default page (`node tests/compare.mjs --tool page`):
    - `gatherProject()`, `nodeR`, `tabR` and `env` are identical;
    - localStorage is identical (one key, `smd_auto_v1`, apart from its time stamp);
    - page text is identical except the removed "📄 Report" button;
    - console errors are the same (the blocked Plotly CDN in the test kit).
  - Print routing, headless: from the Analysis view and from the Report view, each by the browser's `beforeprint`, the 🖨 Print button and Ctrl+P:
    - `body.rp-printing` is set;
    - `#rp-print` holds the Report (7,465 characters, 4 diagram images);
    - after `afterprint`, the view shown before is back;
    - 0 console errors beyond the blocked CDN.
- **Other copies:** none.

## 2026-11-02 — PR: claude/list-input, PR #681: https://github.com/mlococo88/All-Structural/pull/681 — Custom x: a table with one box per station (LIST)   [display only]
- **Why:** engineer decision 2026-11-02: no comma-separated inputs. First user of `shared/list-input.js` (`fixlog/shared-list-input.md`).
- **Where (1):** the script tags, anchor `<script src="shared/report.js"></script>`. **Added after it:**
```html
<script src="shared/list-input.js"></script>
```
- **Where (2):** after `let cT=null,kT=null;`. **Added:**
```js
/* Custom x: a table with one box per station (shared/list-input.js). #iUX stays, hidden, as the saved text "2.5, 5" (userXs). */
const uxCtl=SharedListInput.bindInput(g('iUX'),{label:'Custom x stations',events:['input'],
  columns:[{label:'x',unit:()=>lu,min:0,max:()=>totL>0?totL:undefined,rangeNote:'outside the beam, not used',lenient:true,placeholder:'2.5',width:'6em'}]});
```
- **Where (3):** `renderTable()`, first line. **Added:** `uxCtl.relabel(); // unit and beam-length checks of the Custom x table`
- **What it does:** the `<input id="iUX">` stays in the page, hidden, and is still the field every line of the tool reads and
  writes (`readIn()` parse, `convertUnits()`, `gatherProject()` → `userXs`, `applyProject()`, the drag handles on the V/M
  diagrams, undo). The table shows one box per station; an edit writes the same text form `"2.5, 5"` into `#iUX` and fires its
  `input` event (→ `schedule()` as before). A script that sets `#iUX.value` (unit change, drag, undo, project load) redraws the
  table. A station outside 0..L is marked "Must be ≤ L (outside the beam, not used)", a value that is not a number "Not a number";
  both were ignored silently before and still are (the tool's parser is unchanged). The table is in the `.noprint` box, like the
  old input.
- **Saved data:** `userXs` stays a string in the same format (`"2.5, 5"`); a project saved before opens unchanged; nothing is
  re-written until a station is edited. Steel Beam Design's import of a Shear and Moment file reads `userXs` the same way.
- **Check case:** template "3-span w/ point load" (L = 40 ft), stations typed 2.5 ↵ 5 ↵ 30 → `#iUX` = `"2.5, 5, 30"`, `userX` = [2.5, 5, 30],
  table rows x = 2.5, 5, 30 marked "User". Length unit ft → in: the boxes read 30, 60 (`"30, 60"`), header "x (in)"; Ctrl+Z: 2.5, 5 ft.
- **How verified:** `node tests/smoke/list-input.mjs --part smd`: origin/main (old box) vs this branch (typed into the table), default
  project and the case above: `tabR`, `userX`, `shD`, `moD`, `deD`, `env`, `nodeR`, the autosave (time stamp removed) and the page
  text (table removed) identical; saved text `"2.5, 5, 30"` on both; 0 console errors; 390 px: no sideways scroll; screenshots at
  1400 and 390 px looked at. `node tests/smoke/phone-layout.mjs --tool smd` passes. `node tests/check-syntax.mjs` passes.
- **Formulas, factors, units, code references:** none (§4 does not apply).

## 2026-11-02 — PR: claude/plib-smd, PR #706: https://github.com/mlococo88/All-Structural/pull/706 — PLIB: "Saved projects…" dialog (Open / Rename / Duplicate / Delete)   [display and storage only]
- **Before:** header 📁 Saved… drop-down (load), 💾 Save (under Project name), 🗑 (delete the saved analysis matching Project name),
  key `smd_saves_v1`, `{ name: { t, d: project } }`; Undo / Redo (↩ ↪, Ctrl+Z / Ctrl+Shift+Z). No rename, no duplicate.
- **Where:**
  - after `<script src="shared/list-input.js"></script>`: `<script src="shared/projects.js"></script>` and `<script src="shared/projects-ui.js"></script>`.
  - right after the startup IIFE of SAVED ANALYSES (anchor `if(a&&a.d){applyProject(a.d);setTimeout(()=>toast('Restored last session'),350);}`,
    after its `})();`): `let SMPL=null; function smdPlibInit(){…} smdPlibInit();` (anchor `/* PLIB (2026-11-02): "Saved projects…" dialog`):
    `mapStore(localStorage, LSK, { unpack: i => i.d, time: i => i.t, sort: 'saved' })`; dialog `open` = the drop-down's load code
    (`applyProject(JSON.parse(JSON.stringify(d)))`, toast `Loaded "…"`); a rename of the open analysis (Project name = old name) sets Project
    name to the new name (`readIn(); autoSave();`), because 💾 Save stores under Project name; after every change the drop-down is redrawn
    (`refreshSaveList(); updateDirty();`). The button "Saved projects…" is inserted after 🗑 (`#bDl2`).
- The file keeps its CRLF line endings.
- The tool's own Undo / Redo is unchanged.
- **Saved data:** keys `smd_saves_v1`, `smd_auto_v1` and their formats unchanged; no new key.
- **How verified:** `node tests/smoke/project-library.mjs --tool smd` (new TOOLS entry; 3-span template, span 1 length + 2 as the change):
  ALL PASS (`tabR`, `nodeR`, `shD`, `moD`, `deD`, `env`, `crits`, `totL` identical to origin/main on load, after an input change, reopened on
  main's storage and opened from the dialog; rename / duplicate byte-identical; quota; 390 px; no new console errors). Rename of the open
  analysis checked headless: Project name, the autosave's `projName` and the drop-down show the new name. Header and 390 px screenshots
  looked at. `node tests/check-syntax.mjs`: pass.
- **Formulas, factors, units, code references:** none changed (§4 does not apply).

## 2026-11-05 — PR: claude/github-sync-rollout (PR #811: https://github.com/mlococo88/All-Structural/pull/811) (GHS: saved projects copied to a private GitHub repository; storage only, no result change)
- **Engineer:** the same saved projects on every device (`docs/github-sync-setup.md`; shared code `shared/github-sync.js`, fix log `shared-github-sync.md`; pilot Spread Footing, PR #808).
- **Where:** after `<script src="shared/projects-ui.js"></script>`, new `<script src="shared/github-sync.js"></script>`; in the PLIB block, `SharedProjectsUI.libraryDialog({` gets a first property `cloud:{tool:'shear-moment-diagrams', …}` (anchor `GHS (2026-11-05): GitHub sync of this list`).
- **File on GitHub:** `projects/shear-moment-diagrams/<name>.json`: `toFile` = `item.d` (`gatherProject()`, the export), indent 1. **Download (fromFile):** any JSON object; stored as `{t: Date.now(), d: file}`; Open then goes through the dialog's existing `open`.
- **Saved data:** `smd_saves_v1` and the autosave unchanged (key and format). With sync off nothing is written and no request is made.
- **How verified:** `node tests/smoke/project-library.mjs` for this tool (origin/main vs branch, sync off): ALL PASS. `node tests/smoke/github-sync-tools.mjs`: Save → file on GitHub; update with sha; a GitHub-only copy opened gives the same results as the saved project; 0 console errors.
- **Formulas, factors, units, code references:** none.

## 2026-11-05 — PR: claude/header-smd (PR #828: https://github.com/mlococo88/All-Structural/pull/828) (SMHD: compact header; project name, saved-analysis / template / file buttons and shared-info buttons moved to a Project card in the sidebar; display only, no result change)
- **Engineer:** clean up the top of the page: the project inputs and the project / hand-off buttons go into the Project input area; the header keeps the title, a read-only project line and the global actions.
- **Where / before → after** (nodes moved, not copied: every id, `onclick`, listener and saved field is the same; the file keeps CRLF):
  - `<header>`: before brand + All tools; `#projNm` and `.pshare` (Use / Share project info); then `#upd`, `#bUndo`, `#bRedo`, `#saveSel`, `#bSv`, `#bDl2`, Saved projects… (PLIB, after `#bDl2`), `#tplSel`, `#bPr`, `#bEx`, `#bIm`, `#fIm`. After: brand + All tools; `<a id="hdrProj">` "Project: <name>"; `#upd`, `#bUndo`, `#bRedo`, Saved projects…, `#bPr`.
  - The tool has no input tabs (one sidebar `.sb`), so a new card `<div id="smdPrj">` "Project" is the last sidebar section (after Section Properties, before the spacer; the sidebar still starts with Spans & Supports): Project name (`#projNm`, full width, hint), Saved analyses (`#saveSel`, `#bSv`, `#bDl2`), Templates (`#tplSel`), Project file (JSON) (`#bEx`, `#bIm`, `#fIm`), Shared project info (`.pshare`, hint).
  - `smdPlibInit()`: `g('bDl2').insertAdjacentElement('afterend',b)` → `g('bRedo').insertAdjacentElement('afterend',b)` (Saved projects… stays in the header).
  - New `smdHdrProj()` (anchor `function smdHdrProj(){`): `#projNm` or "(untitled: enter it in the Project card)"; called on `input` in `#projNm`, in `applyProject()` after the name is set, at the start of `readIn()` (Save's name prompt, rename) and once at start-up. `#hdrProj` click: scrolls the sidebar to the card (below 860 px, the page) and focuses Project name.
  - CSS (anchor `/* SMHD (2026-11-05)`): `#hdrProj`, `#smdPrj` rules. (Below 860 px `#projNm` was hidden; in the card it is shown.)
- **Decisions (pending engineer review):** the Project card is placed at the end of the sidebar, not as a first section, so the page still opens on Spans & Supports; 💾 Save (Ctrl+S still works anywhere), the 📁 Saved… list, 🗑, Templates and Export / Import move with the project name, while Undo / Redo, Saved projects… and Print stay in the header.
- **Governing provision:** none (layout only).
- **Check case / how verified** (headless Chromium, origin/main vs branch, template "3-span w/ point load", Project name "Route 6 Floor Beam"):
  - `{nodeR, shD, moD, deD, env, tabR, crits}`, every localStorage key (save time stamps normalised) and the Report view text: identical; the name is in the Report.
  - Share project info: `bridgeSuite.v1.projectMeta` identical; Use shared project info fills Project name; reload of the autosave identical;
  - header shows "Project: Route 6 Floor Beam"; the link scrolls to the Project card and focuses the name (1920: the sidebar scrolls, the page does not; 390 px: the page scrolls);
  - `phone-layout --tool smd`, `project-library --tool smd`, `github-sync-tools --tool smd`, `check-syntax`: pass; `list-input --part smd`: results and saved data identical, the only difference is the page text (the moved header); no sideways scroll at 390 / 768 px; 0 console errors;
  - before / after screenshots at 1920 and 390 px looked at.
- **Saved data:** no change.

## 2026-11-06 — PR: claude/standard-save-shear-moment (PR #848: https://github.com/mlococo88/All-Structural/pull/848) (STDS) — the standard save: header chip + Save + Saved projects…, "Save and open" card first in the sidebar's Project section, Save as, Ctrl+S   [display / save controls only; no result change]
- **Why:** engineer decision 2026-11-05 (standard save roll-out after the Spread Footing pilot #837). Uses `SharedProjectsUI.projectBar` (shared/projects-ui.js).
- **Header:** before: Beam Pro · All tools · `Project: <Project name>` (read-only link) · ↩ · ↪ · Saved projects… · 🖨 Print. After: Beam Pro · All tools · chip `Project: <open saved analysis> ● saved / unsaved changes / not saved` (+ GitHub badge with sync on) · ↩ · ↪ · **Save (Ctrl+S)** · Saved projects… · 🖨 Print. The read-only project line `#hdrProj` is hidden (`smdHdrProj()` still fills it).
- **Sidebar, Project section (`#smdPrj`):** a new first card **"Save and open"** (`#smdSaveCard`): status line; Save · Save as… · Saved projects… · New; "File on this computer": **Export JSON** · **Import JSON** (`#bEx` / `#bIm`, same handlers; were ⬇ Export / ⬆ Import under "Project file (JSON)"); the two hint lines. The Project card keeps Project name (hint: "Printed on the Report and the diagrams."; was "…; 💾 Save stores the analysis under this name (Ctrl+S)"), Templates and Shared project info. "Saved analyses (this browser)" (📁 Saved… drop-down, 💾 Save, 🗑) is wrapped in a hidden `<div hidden>`: the elements and handlers stay (`refreshSaveList`, `updateDirty` still run), nothing shows them.
- **Keyboard (anchor `e.key==='s'){`):** before `{e.preventDefault();doSave();return;}` after `{if(SMPL&&SMPL.pb)return;/* STDS … */e.preventDefault();doSave();return;}` (Ctrl+S goes to the standard Save; Ctrl+Shift+S = Save as).
- **Import (anchors `g('bIm').onclick=`, `rd.onload=()=>{try{applyProject(`):** `#bIm` → `SMPL.pb.importJSON()` (asks first on unsaved changes); after a successful import `SMPL.pb.setCurrent(null)` (an imported file is not the open saved analysis).
- **Code (PLIB block `smdPlibInit`, anchor `/* STDS (2026-11-06): the standard save`):** `projectBar({ store: mapStore(localStorage,'smd_saves_v1', unpack d), getState: gatherProject (the comparison the old 💾 dirty mark made), save(n): saves[n] = { t: Date.now(), d: gatherProject() }; putSaves (the old write), open: applyProject (as before), newProject: smd_auto_v1 removed and the page reloaded (the page's default inputs), displayName: Project name, exportFile (Save as → File: #bEx under that name), importFile: #fIm, fileButtons: #bEx / #bIm, header: before 🖨 Print, chip before ↩, card: #smdSaveCard, renamed: Project name follows a rename of the open analysis (as before), cloud: <unchanged GHS ctx.cloud> })`. `SMPL = { store, dlg, b, pb }`.
- **Behaviour changes (asked for):** Save saves to the open saved analysis (was: under the Project name field, with a `prompt()` when it was empty); with none open it is Save as (name and where). A new duplicate name at Save as is blocked ("Replace it"); Delete only in Saved projects… (was 🗑 for the analysis named like the Project name); Open / New / Import ask first on unsaved changes.
- **Decision (pending engineer review):** the open analysis's name is kept in the page (found again by content after a reload) instead of being the Project name field, so a save never changes a printed field. New is new for this tool (the page's default inputs; Templates are unchanged). The header's read-only project line is hidden (the chip names the open analysis; Project name stays in the sidebar and on the Report).
- **Saved data (§5):** `smd_saves_v1` ({ name: { t, d } }), `smd_auto_v1` unchanged; Export JSON / GitHub file format unchanged; no new key.
- **Formulas, factors, units, code references:** none (§4 does not apply).
- **How verified:** main vs branch after the same input change: results (`tabR`, `nodeR`, `shD`, `moD`, `deD`, `env`, `crits`, `totL`) identical (0 differences), localStorage keys identical (`smd_auto_v1` identical apart from `t`), Export JSON text identical (1,394 chars), Report text identical (5,961 chars), no console errors. Probe: save → saved; change → unsaved; Ctrl+S saves with no dialog; the Analysis / Report views and section toggles leave "saved"; Open, reload: saved; New → the defaults, not saved.
## 2026-11-06 — PR: claude/hdrs-smd (PR #890: https://github.com/mlococo88/All-Structural/pull/890) (HDRS) — header: Save and Saved projects… removed (in the "Save and open" card only); the chip opens the sidebar's Project card   [display only; no result change]
- **Why:** engineer 2026-11-06: every app's header as in Spread Footing (#884): no Save (Ctrl+S) and Saved projects… buttons in the header; they stay in the "Save and open" card. The header keeps the project chip (click = the sidebar's Project card), Undo, Redo, the app's other global actions and Print. Ctrl+S and Ctrl+Shift+S work from anywhere. No "Recent projects" start strip (Spread Footing only).
- **Where:** the `SharedProjectsUI.projectBar({...})` call, right after the line `header:$s('bUndo').parentNode,chipBefore:$s('bUndo'),headerBefore:$s('bPr'),card:$s('smdSaveCard'),` (a comment `/* HDRS (2026-11-06, …) */` and one line).
  Before: nothing. After:
  `headerSave:false, chipClick:()=>{ const a=document.getElementById("hdrProj"); if(a) a.click(); }, chipHint:"the Project card in the sidebar (Save and open)",`
  Uses the projectBar options of `shared/projects-ui.js` (HDRS, #884; `fixlog/shared-projects.md`): `headerSave:false` (the chip only in the header), `chipClick`, `chipHint` (the chip tooltip's "Click: …").
- **Header before:** chip · ↩ · ↪ · Save · Saved projects… · 🖨 Print; chip click = Saved projects… dialog. **After:** chip · ↩ · ↪ · 🖨 Print; chip click = the sidebar's Project card (the "Save and open" card first; scrolled into view, Project name focused), through the click handler of the hidden header link `#hdrProj` (reused); this app has no Project tab. The card's buttons are unchanged.
- **Problem:** none (layout request). **Governing provision:** none (§4 does not apply).
- **Check case:** default project, another tab open: click the chip → the sidebar's Project card, the "Save and open" card on screen, no dialog; Ctrl+S on another tab (nothing saved yet) → Save as dialog; Ctrl+Shift+S → Save as dialog.
- **How verified:** main vs branch on the default project: every localStorage key (1), page text (3316 chars), Export JSON (1115 chars identical) and the printed report text (print media, 1873 chars) identical (clock times normalised); 0 console errors; chip click → card on screen, no dialog; Ctrl+S / Ctrl+Shift+S → Save as; header at 1280 / 1400 / 1920 / 390 px (390: no sideways scroll), screenshots looked at. `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`; `node tests/smoke/project-library.mjs --tool smd`; `node tests/smoke/github-sync-tools.mjs --tool smd`; `node tests/smoke/home-projects.mjs --tool smd`; `node tests/smoke/phone-layout.mjs --tool smd`: pass. CRLF file: line endings kept (3 CRLF lines added, no other line changed).
- **Saved data:** no key or format changed (§5).
- **Other copies:** none. **Open items:** none.

## 2026-11-07 — PR: claude/sm-combo3 (PR #1082: https://github.com/mlococo88/All-Structural/pull/1082) (CMB3: ASCE 7-16 Sec. 2.3.1 combination 3 in the default list and the LRFD preset; review H1 + M1)   [CALCULATION CHANGE — default combination list and LRFD preset only, new projects] [MORE conservative]
- **Why:** code-compliance review 2026-11-07, findings H1 and M1. The default list had no combination 3 at all; the LRFD preset had 1.2D + 1.0L + 1.6S but not 1.2D + 1.6S + 0.5W, and no 1.2D + 1.6L with snow set to zero.
- **Governing provision:** ASCE 7-16 Sec. 2.3.1, combinations 2 and 3 (= 2018 IBC Sec. 1605.2, Eqs. 16-2 and 16-3); 2018 IBC Sec. 1605.1 (each combination also investigated with one or more variable loads set to zero).
- **Where (1), `defCombos()`, anchor `{id:'12_16S',f:{DL:1.2,LL:1.6,SL:.5},on:true},`:** two rows added after it.
  - Before: `U, 14, 12_16, 12_16S, 12W, 09W`.
  - After: the same, with `{id:'12_16S3',f:{DL:1.2,LL:1,SL:1.6},on:true}` and `{id:'12_16SW',f:{DL:1.2,SL:1.6,WL:.5},on:true}` between `12_16S` and `12W` (each with a `// CMB3` comment).
- **Where (2), `CMB_PRESETS.LRFD`, anchor ` LRFD:[{f:{DL:1.4}},`:**
  - Before: `[{f:{DL:1.4}},{f:{DL:1.2,LL:1.6,SL:.5}},{f:{DL:1.2,LL:1,SL:1.6}},{f:{DL:1.2,LL:1,SL:.5,WL:1}},{f:{DL:.9,WL:1}}]`
  - After: `[{f:{DL:1.4}},{f:{DL:1.2,LL:1.6}},{f:{DL:1.2,LL:1.6,SL:.5}},{f:{DL:1.2,LL:1,SL:1.6}},{f:{DL:1.2,SL:1.6,WL:.5}},{f:{DL:1.2,LL:1,SL:.5,WL:1}},{f:{DL:.9,WL:1}}]`
- **Where (3), new block before `g('psLRFD').onclick=`:** `SMD_CMB3` (the three reference rows 1.2D+1.6L, 1.2D+1.0L+1.6S, 1.2D+1.6S+0.5W with fixed names and ids `12_16`, `12_16S3`, `12_16SW`), `smdCmbMissing()` (the reference rows the current list lacks, compared on the DL / LL / SL / WL factors to 1e-9; returns none unless the list has a row with a 1.2 DL factor and the project has an enabled load in case SL; an unticked row counts as present), `smdCmbAddMissing()` (appends the missing rows, ticked, with a free id; Ctrl+Z undoes) and `smdCmbNoteTxt()` (the note text). `smdCmb3Hide` hides the note for the page session only.
- **Where (4), `updStats()`, before `nodes.forEach((nd2,j)=>{if(nd2.t==='free')return;const cl=CLRS[j%CLRS.length];`:** a full-width amber note `.smd-cmb3` when `smdCmbMissing()` is not empty, with "Add the missing rows" and "Hide" buttons.
- **Where (5), `smrModel()`, the "Load cases and combinations" items:** the same note (warn) appended when rows are missing.
- **Where (6), the hint under the combinations table, anchor `The default list's "Unfactored (1.0 All)" row is not a code combination.`:** one sentence added (default list and LRFD preset include combination 3 since 2026-11-07; old saves keep their list and are offered the rows); "Its wind row" became "The default wind row".
- **Saved data (§5):** no key or format changed. `applyProject` still uses a saved `combos` list when present, so saved projects, autosaves and files keep their own combinations and results (as F15). The new rows apply to the page defaults (New, a browser with no autosave) and any file without `combos`, and to the LRFD preset when it is loaded. A saved list is changed only by the user's click on "Add the missing rows".
- **Check case (H1):** simple span 20 ft, DL = 1 kip/ft, SL = 2 kip/ft, default list, envelope.
  - Before: |M|env = 150.000 kip·ft (governed by Unfactored 1.0 All; 110.0 without it), R = 30.000 kip.
  - After: w = 1.2(1) + 1.6(2) = 4.4 kip/ft → M = 4.4 × 20² / 8 = **220.000 kip·ft**, R = 4.4 × 20 / 2 = 44.000 kip, governed by 1.2DL+1.0LL+1.6SL.
  - The same project with the old default list saved in it: still 150.000 kip·ft; the note names 1.2DL+1.0LL+1.6SL and 1.2DL+1.6SL+0.5WL; after "Add the missing rows": 220.000; Ctrl+Z: 150.000 again.
- **Check case (M1):** the same span with WL = 1 kip/ft downward added.
  - Old LRFD preset list saved: 220.000 kip·ft (unchanged), note names 1.2DL+1.6LL and 1.2DL+1.6SL+0.5WL.
  - New default list: before 200.000 (Unfactored), after (1.2 + 3.2 + 0.5) × 400 / 8 = **245.000 kip·ft**, R = 49.000 kip, governed by 1.2DL+1.6SL+0.5WL.
- **How verified:** headless main vs branch on the 27 review cases (each in single-combination and envelope mode) and 14 extra cases: computed results identical except the new-project cases with snow load (above, and a 3-span mixed case whose end reactions now come from the combination 3 rows); old saves identical apart from the note; 0 console errors. `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`, `node tests/smoke/phone-layout.mjs --tool smd`, `node tests/smoke/project-library.mjs --tool smd`: pass.
- **Decision (pending engineer review):** the note is shown only for an LRFD-type list (a 1.2D row) with snow load, since without snow load the added rows reduce to 1.2D + 1.6L, 1.2D + 1.0L and 1.2D + 0.5W, which the other rows bound for loads of one sign. An ASD list gets no note (the ASD preset already has D + S, D + 0.75L + 0.75S and so on).
- **Other copies:** none (Steel Beam Design has its own list, not changed). **Open items:** none from this change.

## 2026-11-07 — PR: claude/sm-pattern-warn (PR #1084: https://github.com/mlococo88/All-Structural/pull/1084) (PATW: warning that pattern live load is not generated; review H2, interim)   [display only; no result change]
- **Why:** review finding H2: the envelope applies each load case to all of its spans at once. For a continuous beam this under-reports the positive span moments and the end reactions (two 15 ft spans, D = 1, L = 2 kip/ft: tool M⁺ = 69.61 kip·ft and R_A = 24.75 kip; with L on span 1 only, 87.50 and 27.75). This is the quick interim warning. Pattern generation follows in a separate PR.
- **Governing provision:** 2018 IBC Sec. 1607.12 (floor live load placed on the spans that give the greatest effect) and ASCE 7-16 Sec. 4.3.3 (partial loading). Cited and paraphrased only.
- **Where:**
  1. **New, before `function smdCmbNoteTxt(m){`:**
     - `smdPatWarn()` returns true when `spans.length>1` and there is an enabled load in case `LL`.
     - `SMD_PATW_TXT` holds the warning text.
  2. **`updStats()`, before the CMB3 note (anchor `{const mc=smdCmbMissing();if(mc.length&&!smdCmb3Hide)`):** a full-width amber note `.smd-patw`, shown in every view mode.
  3. **`smrModel()`:**
     - the "Load cases and combinations" items: `.concat(smdPatWarn()?[{type:'note',warn:true,text:SMD_PATW_TXT}]:[])` is added after the CMB3 note;
     - the Summary: the same warn note is added before "Verify all results independently…" (not when the beam is unstable).
- **Before / after:** before, no note. After, the note. No computed value changes.
- **Check case:** two 15 ft spans, pin / roller / roller, DL = 1 and LL = 2 kip/ft on both spans. The note shows on the cards and in the Report (Summary and §2). A single-span beam, or a beam with no LL load, shows no note.
- **How verified:**
  - Headless main vs branch on the 27 review cases (single-combination and envelope mode) and 14 extra cases: every computed result identical (0 differences). The statsRow text differs only on the 5 multi-span cases with LL, by the note.
  - 0 console errors.
  - `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`, `node tests/smoke/phone-layout.mjs --tool smd` and `node tests/smoke/project-library.mjs --tool smd` pass.
- **Decision (pending engineer review):** only case `LL` is treated as live load. User cases (for example L1, L2) are taken as the user's own pattern and are not warned about.
- **Saved data:** none changed. **Other copies:** none.

## 2026-11-07 — PR: claude/sm-pattern-ll (PR #1096: https://github.com/mlococo88/All-Structural/pull/1096) (PATL: pattern live load in the envelope; review H2)   [CALCULATION CHANGE — envelope, new projects; old saves opt in] [MORE conservative]
- **Why:** review finding H2 (PATW, the interim warning, was merged first). The envelope applied LL to all of its spans at once. That under-reports the positive span moments, the end reactions and the minimum (uplift) reactions of a continuous beam.
- **Governing provision:** 2018 IBC Sec. 1607.12 (floor live load on the spans that give the greatest effect at each location, dead load on all spans), ASCE 7-16 Sec. 4.3.3 (partial loading), and 2018 IBC Sec. 1605.1 (variable loads also set to zero). Cited and paraphrased only.
- **What the envelope does now (option "Pattern live load (envelope)", `patLL`):**
  - **Which combinations:** every enabled combination with an LL factor ≠ 0.
  - **Which patterns:** S is the set of spans that carry an enabled LL load. Each combination is also solved with its LL loads kept only on each pattern's spans; dead and all other loads stay as entered.
    - S of up to 6 spans: every subset of S except S itself (S itself is the combination as entered), with the empty set (LL off) included.
    - More than 6 spans: the standard set, each taken within S: LL off; alternate spans (odd, and even); each adjacent pair (j, j+1) with every second span beyond it on both sides; and the complement of each such pair pattern (the pattern for the least reaction at support j).
  - **How patterns enter the envelope:** they join the point-wise envelope (V, M, δ, R max / min) as pseudo combinations named "<combination> · LL on spans …" or "… · LL off". Every place that names a governing combination therefore names the pattern.
  - **Per-combination rows:** `env.per` keeps one row per combination: the full-pattern curves (legend traces), and the largest |V|, |M| and |δ| over its patterns. The tables label it "(max of N LL patterns)", and "governed by" names the governing pattern.
  - **Single-combination view:** unchanged. A note says the envelope includes the patterns.
- **Where:**
  1. **`solveFor(fac,lds=loads)` and `evalVM(X,R,fac,lds=loads)`:** an optional load list replaces the two reads of `loads`. With the default, the computation is identical to before, so every existing call is unchanged.
  2. **`solve()`, envelope branch, anchor `/* PATL (2026-11-07): pattern live load.`:**
     - Before: `EK.forEach(k=>{const c=COMBOS[k];res[k]=solveFor(c.f); … env.per.push({id:k,name:c.name,vm,mm,sh:res[k].sh,mo:res[k].mo});});` and then the station, reaction and deflection loops over `EK`.
     - After: the same, plus each pattern of `smdPatSets()` solved with `smdPatLoads(ps)` under the key `k+'|P'+ps.join('.')` (registered in `COMBOS` with `pat:true`, and removed at the start of each solve). `EK` becomes the list of all solved keys, so the loops below are unchanged. Deflection per row: the largest over its keys (anchor `/* PATL: per combination, the largest over its patterns */`).
  3. **New helpers after `function smdPatWarn(){`:** `smdPatSets()`, `smdPatName()`, `smdPatLoads()` (an all-spans uniform LL becomes one uniform per loaded span; other LL loads are kept when their span is loaded), `SMD_PATL_TXT()`, `smdPatSpanCount()`.
  4. **State and saved data:**
     - `let patLL=true;` (page default);
     - `gatherProject` adds `patLL`;
     - `applyProject`: `patLL=d.patLL===undefined?false:!!d.patLL`;
     - the checkbox `#patT` is under "Envelope — run ALL combinations", plus its change handler and `smdPatEnable()`.
  5. **`updStats()`, the PATW note:**
     - option off: the warning with an "Enable pattern live load" button;
     - option on, envelope: an info note (`.smd-patl`) that says what is included;
     - option on, single combination: a warning that this view has no patterns.
  6. **Report:** `smdPatNote()` gives the same three variants in the Summary and in §2.
  7. **Also:** `curName()` reads "Envelope (all enabled combos, with LL patterns)" when patterns are solved. The KaTeX envelope card and the Report envelope table name the governing pattern.
- **Saved data (§5):**
  - New optional field `patLL` in the project JSON, autosave and saved projects; no key changed.
  - Projects, autosaves and files saved before this change have no field and open with the option **off**, so their results are as saved. The warning shows with a one-click enable, and Ctrl+Z undoes it.
  - New projects (page defaults, New) have it on. A file written by this version keeps its setting.
- **Decision (pending engineer review):**
  - the option is on for new projects and off for old saves (visible warning, one-click enable);
  - only case LL is patterned (user cases such as L1 are the user's own patterns; snow drift and unbalanced snow are not generated);
  - exhaustive subsets up to 6 loaded spans, and the standard set beyond that;
  - the empty pattern (LL off) is included.
- **Check case (hand):** two 15 ft spans, pin / roller / roller, D = 1 and L = 2 kip/ft on both spans, new project, default combinations, envelope.
  - Before: M⁺ = 69.61 kip·ft and R_A,max = 24.75 kip (1.2D + 1.6L, LL on both spans).
  - After, governed by 1.2DL+1.6LL · LL on span 1:
    - M_B = −(4.4 + 1.2)(15²)/16 = −78.75 kip·ft;
    - R_A = 4.4 × 7.5 − 78.75/15 = **27.75 kip**;
    - M⁺ = 27.75² / (2 × 4.4) = **87.50 kip·ft** (tool 87.5069; the difference is the 400-strip FER noise of L7).
    - M⁻ = −123.75 is unchanged (both spans loaded).
    - R_A,min: 5.06 → 3.75 kip (LL on span 2 only).
- **Independent check:** the reviewer's solver (`indep.mjs`), exhaustive over every LL subset and every default combination.
  - 2 × 15 ft: M 87.500 / −123.750, R 27.75 / 3.75, 82.5 / 16.875 (tool 87.5069 / −123.7504, R identical to 1e-4).
  - 4 spans 10 / 14 / 12 / 8, fixed far end, LL as a UDL, a point load and a partial trapezoid on separate spans plus an all-spans UDL: M 48.9629 / −61.0993; tool 48.9565 / −61.0995. The 1.3e-4 on M⁺ is station sampling inside the trapezoid; it predates this change. All five R max / min agree to 1e-4.
- **8 equal 10 ft spans (standard set) vs exhaustive (256 subsets, independent solver):** M⁺ 41.1894 vs 41.2009 (3e-4, station sampling); M⁻ −51.0237 vs −51.0236; every R max and R min identical to 1e-4 (for example R_B 52.614 / 9.642, R_C 48.775 / 5.205). Without the complement patterns the interior R_min was missed (R_C,min 8.675 instead of 5.205), so they were added before merge.
- **Speed:** 6 spans with LL everywhere: 315 extra solves, `solve()` about 0.26 s headless (debounced as before).
- **How verified:**
  - Headless main vs branch on the 27 review cases (single and envelope) and 16 extra cases: every result identical except the new-project envelope cases with LL on more than one span (2 × 15, 3-span mixed, 4-span, 8-span), which move as above. Old saves (no `patLL`) are identical.
  - 0 console errors, 0 KaTeX errors.
  - UI: an old save shows the warning; Enable gives 87.507 / 27.750; Ctrl+Z gives 69.609 again; Export holds `patLL:true`.
  - `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`, `node tests/smoke/phone-layout.mjs --tool smd` and `node tests/smoke/project-library.mjs --tool smd` pass.
- **Other copies:** none. Steel Beam Design has its own engine and no pattern loading; not changed.

## 2026-11-07 — PR: claude/sm-case-warn (PR #1108: https://github.com/mlococo88/All-Structural/pull/1108) (CZF + WPM: warning for a load case with no factor in any combination; one-direction wind note; review M2, M3)   [display only; no result change]
### CZF (review M2). A load case with no factor in any combination is flagged
- **Problem:** `addCase()` creates a case with no factor in any combination, so loads put in it are multiplied by `fac[ld.lc]||0` = 0 everywhere. Every combination and the envelope ignored them without a message. Check: one UDL in a new case EQ, envelope: R = M = 0.
- **Where:**
  1. **New `smdZeroCases()` and `smdZeroTxt()`, before `function smdCmbNoteTxt(m){`:**
     - `smdZeroCases()` returns the cases that carry an enabled load but have a factor of 0 or blank in every enabled combination (every combination when none is ticked);
     - `smdZeroTxt()` gives the warning text.
  2. **`updStats()`, before the PATW / PATL block (anchor `if(smdPatWarn()){   /* PATW;`):** a full-width red note `.smd-czf`, shown in every view mode.
  3. **`smrModel()`:** the same warn note in the Summary (after the PATW / PATL note) and in §2 "Load cases and combinations".
- **Governing provision:** none (input completeness); no formula, factor or result changes.
- **Check case:** a 20 ft simple span, DL = 1 and EQ = 1 kip/ft, default combinations, envelope. Results are unchanged (|M| = 70.0 from 1.4D), and the note names EQ.

### WPM (review M3). Wind in one direction per case
- **Problem:** one WL case has one sign in every combination. 0.9D + 1.0W needs uplift and 1.2D + 1.0W + … needs downward wind, and the hint said nothing about direction.
- **Where:**
  1. **The hint under the combinations table, anchor `may edit the L factor to 0.5. Verify preset factors`:** one sentence on two wind cases (for example WL downward, WU uplift entered negative) with the matching combinations, and one sentence on the CZF warning.
  2. **`SMD_WPM_TXT`:** an information note in Report §2 when a WL load exists.
- **Governing provision:** ASCE 7-16 Sec. 2.3.1 (combinations 3, 4 and 6 with W); cited only.
- **Decision (pending engineer review):** no "±" flag on load cases. It would change the saved case format and double the solves; the hint and the note are the conservative minimum asked for. Recorded as an open option.

### How verified
- Headless main vs branch on the 27 review cases (single and envelope) and 16 extras: every computed result identical (0 differences). The card text changes only on the EQ case (the note).
- Report model: CZF note ×2 (Summary and §2), WPM note ×1 when WL loads exist; the Report view shows them.
- 0 console errors.
- `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"`, `node tests/smoke/phone-layout.mjs --tool smd` and `node tests/smoke/project-library.mjs --tool smd` pass.
- **Saved data:** none changed. **Other copies:** none.

## 2026-11-07 — PR: claude/sm-low-items (PR #1115: https://github.com/mlococo88/All-Structural/pull/1115) (review LOW items L1–L6, L8, L9: LV, SMDL, SMDC, MRE, TBS, ZSR, SMD8, SMW)   [L1: results change only for invalid input; L4: new output; L5: table rows; others display only]
Review of 2026-11-07, LOW findings. L7 (closed-form FER) is a separate PR. Every code site is tagged with its item code.

### LV (L1). Solver input check: positions clamped and flagged, NaN blocked, saved data not rewritten   [results change for invalid input only]
- **Problem:**
  - Imported or edited data was not checked in `solve()`.
  - A trapezoid with start > end gave a reversed (upward) load: 176 kip·ft from an 8 kip load.
  - A trapezoid running past its span was integrated with inconsistent FER and statics.
  - A point load off the span was moved without a message.
  - The "all spans" flag on a point load was kept in the statics but left out of the FER.
  - A zero or negative span gave NaN or nonsense with ✓.
- **Where:**
  1. **New `smdSolveLoads()` before `/* SOLVE for one factor set`, and globals `SL`, `smdLoadFlags`.** The solver reads checked copies (`SL`). `loads` (the saved data) is never changed. Each copy:
     - non-number magnitudes or positions: left out;
     - a span index out of range: nearest span;
     - point or couple off the span: moved to the nearer end;
     - trapezoid start > end: turned round with each intensity kept at its own x;
     - ends kept on the span;
     - end x = 0: the span end (as before);
     - zero length: left out;
     - "all spans" only for uniform loads.

     Each change is listed.
  2. **Uses of the checked loads:**
     - defaults of `solveFor(fac,lds=SL)` and `evalVM(X,R,fac,lds=SL)` (were `lds=loads`);
     - `stationList()` reads `SL`;
     - ΣF in the Support Reactions card and the Report reads `SL` (was `loads`);
     - `smdPatLoads()` reads `SL`.
  3. **`solve()`, after `totL=…`:** a span that is not a number > 0 sets `window.smdBad`. The analysis is suppressed through the unstable path, and the cards, the calculation panel and the Report show the message.
  4. **`updStats()`:** an amber note `.smd-lv` lists the changes. The Report has the same note under "Applied loads".
- **Check cases** (20 + 10 ft spans, pin / roller / roller, DL):
  - **Trapezoid 1 kip/ft from 12 to 4 ft (file):**
    - Before: R = −3.947 / −5.760 / 1.707, M −176.0.
    - After: turned round to 4–12 ft, so R = 3.947 / 5.760 / −1.707 (ΣR = 8.0 = 1 × 8), M⁺ 23.575.
    - Hand check: R_A,SS = 8 × (20 − 8)/20 = 4.8 on a 20 ft simple span. The continuity over B gives 3.947, as the independent solver does.
  - **Trapezoid 1 kip/ft from 15 to 25 ft on the 20 ft span 1:**
    - Before: R 0.208 / 9.375 / 0.417 (inconsistent).
    - After: kept on 15–20 ft, so R 0.306 / 5.332 / −0.638 (ΣR = 5.0), flagged.
  - **Point load 10 kip at 25 ft on span 1:** results unchanged (R_B = 10), now flagged.
  - **Valid input:** the 27 review cases and 16 extras are identical to main (0 differences in R, V, M, δ, envelope).
- **Decision (pending engineer review):**
  - a strip that runs past its span is kept on its span (as the UI's own `clampLoad` does), not continued onto the next span;
  - start > end is turned round (load kept) rather than left out.

### SMDL (L2). Deflection: the analysed combination and IBC Table 1604.3   [display only]
- **What changed:**
  - The δ max card names the analysed combination.
  - The Section Analysis deflection box and the Report step say which combination they use. They also say that the L/x limit is user-selected per IBC 2018 Table 1604.3 (l/360 for L only, l/240 for D + L and so on) and that a factored combination gives a factored deflection (`SMD_DEFL_TXT`).
  - The envelope note cites the same table.
- **Provision:** IBC 2018 Table 1604.3, cited only.

### SMDC (L3). Wording and citations   [display / code reference]
- **Envelope card:** "Each IBC combination solved independently" became "Each enabled combination of the combination table solved independently".
- **AISC citations:** "AISC 360 Sec. G2.1 (edition: verify)" and "AISC 360 G2.1" became "AISC 360-16 Sec. G2.1" (Report steps ×2, the τ box).
- **References table (`smdRefs`):**
  - Before: "IBC … edition: verify" (envelope only), and "AISC 360 … edition: verify".
  - After: "IBC 2018: Sec. 1605.1 / 1605.2, Sec. 1607.12, Table 1604.3" (always listed), and "AISC 360-16 … Sec. G2.1".
- **Check:** A_w = d·t_w is the AISC 360-16 Sec. G2.1 definition; no value changes.

### MRE (L4). Envelope of the fixed-support moment reaction   [new output]
- **Where:** `solve()` `env.R` adds `mmx, mmc, mmn, mmnc` (max / min of `R[j].m` over the combinations and patterns). For a fixed node, the reaction card, the Support Reactions — Envelope card and the Report (steps `MR*max/min`, summary row) show M_R max / min (+CCW) with the governing combination.
- **Check case:** fixed–roller 20 ft, D 1, L 2, W −1 kip/ft, envelope: M_R,A max = w L²/8 = 4.4 × 400 / 8 = **220.0 kip·ft** (1.2D + 1.6L), min −5.0 (0.9D + 1.0W: (0.9 − 1) × 400 / 8). The M envelope at x = 0 gives −220.0, the same value.

### TBS (L5). Tabular results: tenth points of each span, both sides of each support   [table rows change]
- **Where:** `solve()`, block `/* TBS`, and `mkRow(x,t,dx=0)`.
  - Before: 11 rows at tenths of the total length.
  - After:
    - each span's tenth points;
    - at an interior node, rows "B left" and "B right", read at x ∓ 1e-6 (the analysis stations beside the support);
    - "End A", and the last end read just left of it (before the closing reaction);
    - user positions as before.
  - The Report table title says so.
- **Check:** 12 / 16 / 12 template. The supports at 12 and 28 ft are now listed: B left V = −10.889, B right V = 17.100.

### ZSR (L6). Zero-shear runs   [display only]
- **What changed:**
  - A run of zero-shear stations longer than 1e-4·L is one interval `crits.zR`, shown once as "Zero shear over an interval (M constant there)" (card and Report), instead of one "moment extremum" per station.
  - The shear peak label leaves out the closing value after the last reaction.
- **Check:** case 22 (couple at a cantilever tip): one interval 0–8 ft, M = 12.000; before, about 400 lines.

### SMD8 (L8, O11). Display items   [display only; one unit conversion shown]
- **Card labels:** σ and δ on the cards are no longer upper-cased to "Σ" / "Δ" (O11).
- **Stress in other units (`smdStrAlt`):** σ (cards, Report) and τ (Report) also in ksi for kip and ft (÷ 144 in²/ft²), psi for lb and ft (÷ 144), MPa for kN and m (÷ 1000).
  - Check: σ = 2500.01 kip/ft² → 17.361 ksi.
- **Mixed envelope:** when the enabled list mixes the "Unfactored (1.0 All)" row with factored rows, the |M| env card, the envelope card and the Report say "mixed service / factored".

### SMW (L9). Reactions and deflection worked (§6)   [display only]
- **`solveFor` also returns:**
  - `FE`: the fixed-end forces per span;
  - `EF = FE − k_e·d_e`: the member end forces (up / CCW +);
  - `dF` and `EI`.

  `deflOf()` attaches `meta = {C1, C2, EI, F2at, xa, xb}` to its result.
- **Support Reactions card and Report:**
  - a table per span of FEF, solved d (v, θ) and member end forces;
  - each reaction worked as the sum of the end forces at its node (R_B = V⁽¹⁾_R + V⁽²⁾_L = … ), and so is a reaction couple.
- **Deflection (card and Report):** δ(x) = [−F₂(x) + C₁x + C₂]/EI, with C₁ and C₂ from the anchors and the substituted numbers at the governing x.
- **Check case:** 12 / 16 / 12 template:
  - R_B = −10.8889 + 38.8778 = 27.9889;
  - beam moment at B = M_R⁽¹⁾ = −M_L⁽²⁾ = −44.2667, equal to the M diagram at B;
  - propped cantilever: −M_L = −100.0003 = M(0).
- **Verified:** the table moments equal the M diagram beside every support in 3 cases.

### How verified (all items)
- **Headless main vs branch:** the 27 review cases (single and envelope) and 16 extras.
  - R, V, M, δ, and the envelope V / M / δ / R max / min with their governing combinations are identical, except the two invalid-input cases (LV).
  - Expected differences: `tabR` rows (TBS), the new `env.R` moment fields (MRE) and card text.
  - 0 console errors, 0 KaTeX errors on the cards and the Report.
- **Tests:**
  - `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"` and `node tests/smoke/phone-layout.mjs --tool smd` pass.
  - `node tests/smoke/project-library.mjs --tool smd` fails against main only on `tabR` (TBS, intended); with `tabR` and the new `crits.zR` / `env.R` moment fields left out of its readout, it passes in full.
- **Saved data:** no key or format changed; LV never writes to `loads`. **Other copies:** none.

## 2026-11-07 — PR: claude/sm-fer-exact (PR #1118: https://github.com/mlococo88/All-Structural/pull/1118) (FERX: closed-form fixed-end forces for uniform and trapezoidal loads; review L7)   [CALCULATION CHANGE — numerical, about 1e-5 relative] [neither more nor less conservative: closer to exact]
- **Problem:** `spanFER()` integrated the fixed-end forces of uniform and linearly varying (partial) loads with a 400-strip midpoint sum. The reported values differed from closed form in the 4th–5th digit:
  - 2-span UDL |M_B| = 70.3127 vs wL²/8 = 70.3125;
  - propped cantilever M_fix = 100.0003 vs 100.
  - A hand checker notices this.
- **Governing provision:** structural mechanics, the standard fixed-end force integrals (AISC Manual Table 3-23 forms, cited only). No code provision.
- **Where:** `spanFER()`, the distributed-load branch (anchor `/* FERX (2026-11-07, review L7)`).
  - Before:
    ```js
          const N=400,dx=(x2-x1)/N;
          for(let k=0;k<N;k++){const s=x1+(k+.5)*dx,w=w1+(w2-w1)*(x2>x1?(s-x1)/(x2-x1):0),b=spL-s,L=spL;
            r[0]+=w*b*b*(L+2*s)/(L*L*L)*dx;r[1]+=w*s*b*b/(L*L)*dx;r[2]+=w*s*s*(3*L-2*s)/(L*L*L)*dx;r[3]-=w*s*s*b/(L*L)*dx;}}});
    ```
  - After: the same four integrands, summed with 3-point Gauss-Legendre over [x1, x2] (nodes mid ± hl·√0.6 and mid, weights 5/9, 8/9, 5/9, hl = (x2 − x1)/2). The integrand (linear w times a cubic in s) has degree 4, and the rule is exact to degree 5, so the result is the closed form to round-off.
- **Check case (hand):** two 15 ft spans, pin / roller / roller, w = 2.5 kip/ft (template "2-span": DL 1.5 + LL 1, Unfactored).

  | | Before | After | Closed form |
  |---|---|---|---|
  | R_A | 14.062485 | 14.062500 | 3wL/8 = 14.0625 |
  | R_B | 46.875029 | 46.875000 | 10wL/8 = 46.875 |
  | M_B | −70.312720 | −70.312500 | −wL²/8 = −70.3125 |
  | M⁺ | 39.550699 | 39.550781 | 9wL²/128 = 39.55078 |
  | δ_max | 0.008205843 | 0.008205960 | (double integration of M; unchanged method) |
- **Other cases:**
  - 4 equal spans: R 5.499995 / 16.00001 / 13 → 5.5 / 16 / 13 exactly (0.393 / 1.143 / 0.929 wL);
  - propped cantilever: M_fix 140.0004 → 140.0 (1.4D);
  - cantilever triangle: M = −45.00014 → −45.0.
- **How verified:** headless main vs branch on the 27 review cases and 16 extras. The largest relative change of any R, V, M, δ or envelope value is 1e-5 (apart from values that are round-off zero, such as −0.00016 → 0 at a free tip). Point and couple loads are unchanged. 0 console errors.
  - `node tests/check-syntax.mjs "Shear and Moment Diagrams.html"` and `node tests/smoke/phone-layout.mjs --tool smd` pass.
  - `node tests/smoke/project-library.mjs --tool smd`: its main-vs-branch "results identical" checks fail by design (`tabR` V changes, for example 3.511105 → 3.511111, the closed form of the 3-span template, R_A = 3.5111 by the independent solver). Its save, undo and dialog checks pass.
- **Saved data:** none changed. **Other copies:** Steel Beam Design has its own engine; not changed.

## 2026-11-07 — PR: claude/sm-verify-test (PR #1120: https://github.com/mlococo88/All-Structural/pull/1120) (SMDV: solver regression test `tests/smd-verify.mjs`; review S3)   [test only; the tool is not changed]
- **What:** new `tests/smd-verify.mjs`, `tests/smd/indep.mjs` (the review's independent solver) and `tests/smd/cases.json` (the review's 27 cases); a section in `tests/README.md`. The test drives the tool headless through its globals, because extracting the inline solver into `shared/` would be a refactor.
- **Checks:**
  - closed forms;
  - the 27 cases against the independent solver;
  - every fix of this review series with its hand values: CMB3 220 / 245 kip·ft; PATL 87.5 kip·ft and R_A 27.75 kip, plus an exhaustive 3-span pattern envelope; MRE 220 / −5 kip·ft; CZF; LV; FERX 70.3125;
  - old saves keep their combinations and the pattern setting off;
  - units;
  - console errors.
- **How verified:**
  - On main (this tool as merged through #1118): ALL PASS, about 10 s.
  - On the review's base a84df4f: it fails on the closed-form FER (FERX), combination 3 (CMB3), pattern loading (PATL) and the envelope M_R (MRE), as it should.
- **Open items (pending the engineer; not changed by this series):**
  - **O3:** the cantilever deflection limit uses l = the overhang length. The IBC 2018 Table 1604.3 footnote (l = 2 × the cantilever length) would be less conservative.
  - **O9:** the Report has no Project No. / Computed by / Checked by fields.

## 2026-11-07 — PR: claude/sm-left-summary (PR #1130: https://github.com/mlococo88/All-Structural/pull/1130) (SMLS: the result cards in a left summary column from 1200 px, as Retaining Wall / Spread Footing / Light Pole)   [display only; no result change]

### SMLS. Results summary column on the left at 1200 px and wider   [display only]
- **Request (engineer, 2026-11-07):** the summary / result cards should move into a left summary panel, as in Retaining Wall Designer (RWDL #959, RWLB #984), Spread Footing (SFLB #988) and Light Pole and Sign Post (LPLB #991).
- **What changed (screen only):**
  - At **1200 px and wider** a new left column `#smdDashCol` (left of the inputs sidebar; **240 px** from 1200 to 1499 px, **280 px** from 1500 px, as SFLB / RWLB / LPLB) holds the "Results summary": one line per result card of `updStats` — R_A, R_B, … (or R max / min in the envelope), |V| max / env, |M| max / env, σ max / env, δ max / |δ| env — styled as the other tools' chips (RWDL / SFDC: 1 px border in the status colour on a tinted background, bold name): expand button, name, value with unit, status. Status: σ and δ **OK / NG** where the allowable σ or the deflection limit is set; an envelope reaction with uplift **UPLIFT** (amber); other values no status. Head: « button, title, count badges ("n NG", "n uplift", or "no NG" where a σ / δ limit passes), and the analysed combination ("Combination: …" or "Envelope (all enabled combos …)", `curName()`).
  - The expand button (▸ / ▾) shows the card's other lines (the governing combinations of the envelope reactions and M_R, σ in ksi and the limit, the deflection limit and span, the combination) and "→ Engineering Calculations · <card>". NG and UPLIFT lines start expanded, as in the other tools.
  - **Click a line (or Enter / Space):** opens the Engineering Calculations card that works the value (`smdGoto`, the D11 "Worked in" targets of `smdWkCards`: Support Reactions / Critical Points / Section Analysis, or the two envelope cards), scrolls it to the top of the output column and flashes it (CLAUDE.md §6). From the Report view the Analysis view opens first.
  - With the column open, the result cards and the "Worked in" line above Applied Loads are hidden (the column has them); the warnings in `#statsRow` (load input adjusted, section properties, load cases not combined, live load patterns, missing combinations, unstable structure) **stay above the loads**. An unstable structure / input error shows "No results: … See the message above the loads." in the column.
  - « shrinks the column to a 42 px strip (vertical title and the count badges); the result cards then show above the loads again. » opens it. The diagrams are redrawn when the output column changes width (collapse, or crossing 1200 px).
  - **Below 1200 px nothing changes** (cards above Applied Loads; tablet and phone layouts as before). Print / PDF prints the Report, which is unchanged (the column is `noprint` and hidden in print).
- **Where (`Shear and Moment Diagrams.html`):**
  - CSS: after `@media print{#smdViewTabs{display:none!important}}`, the block starting `/* SMLS (2026-11-07, engineer: the summary cards in a left summary panel` (rules `#smdDashCol{display:none}`, `@media screen and (min-width:1200px){ body.smdDashWide #smdDashCol{display:block;flex:0 0 280px;width:280px;…}` … `}` and `@media screen and (min-width:1200px) and (max-width:1499.98px){ body.smdDashWide #smdDashCol{flex-basis:240px;width:240px} … }`). The rules that hide the cards there:
```css
 body.smdDashWide:not(.smdDashColl) #statsRow>.sc,body.smdDashWide:not(.smdDashColl) #statsRow>.wkLink{display:none}
 body.smdDashWide:not(.smdDashColl) #statsRow:not(:has(>:not(.sc):not(.wkLink))){display:none}
```
  - HTML: before `<div class="layout">\n <div class="sb">` → after: the `<div class="layout">` line, then
```html
 <aside id="smdDashCol" class="noprint" aria-label="Results summary"><!-- SMLS (2026-11-07): the result cards as a left column on screens 1200 px and wider -->
  <div id="smdDashHead"><button type="button" id="smdDashTgl" aria-controls="smdDash" aria-expanded="true">&laquo;</button><h2 id="smdDashTtl">Results summary</h2><span id="smdDashCnt"></span></div>
  <div id="smdDashSub"></div>
  <div id="smdDash"></div>
 </aside>
```
  - JS, after the `a.wkA[data-card]` click handler (anchor `/* SMRX: the #repView report (whose links were skipped here) is retired */`): new block `/* SMLS … */` with `const SMDD={key:'smd_dashCollapsed_v1',mq:window.matchMedia?window.matchMedia('screen and (min-width:1200px)'):null,…}`, `smdDashRender(items,msg)`, `smdDashPlace()`, `smdDashColl(v,save,redraw)` and a start-up IIFE (as `lppDashPlace` / `lppDashColl`, LPDC).
  - JS, `updStats()`:
    - before `  let h='';` → after `  let h='';const dI=[],wk=smdWkCards();   /* SMLS … */`;
    - after each card's `h+=…` an item is pushed from the **same expressions** as the card, e.g. after `<div class="sc-v">${mv.toFixed(3)}</div><div class="sc-u">${fu}</div></div>`;` → `dI.push({n:'|V| max',v:`${mv.toFixed(3)} ${fu}`,st:'na',d:'',c:(wk[1]||[])[1]});   /* SMLS */` (likewise R / R max / min with `st:up?'warn':'na',s:up?'UPLIFT':''`, |V| env, |M| max / env, σ with `st:Fbv>0?(ok?'pass':'fail'):'na'`, δ with `st:defLim>0?(ok?'pass':'fail'):'na'`);
    - after `  g('statsRow').innerHTML=h;` → added `  smdDashRender(dI);   /* SMLS */`;
    - the two unstable / input-error early returns call `smdDashRender(null,'No results: …')` before `return`.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). The column shows values `updStats` already computes for the cards, with the same rounding.
- **Saved data (§5):** no key or format changed. New per-browser UI key **`smd_dashCollapsed_v1`** ('1' = column shrunk; absent or '0' = open), tool-prefixed; it is written only when « / » is clicked and is not in the project, the autosave or the export (as `sfd_dashCollapsed_v1`, `lpp_dashCollapsed_v1`).
- **Decisions (pending engineer review):**
  1. Breakpoints and widths as RWLB / SFLB / LPLB: column from 1200 px, 240 px to 1499 px, 280 px from 1500 px (SF's width; RW and LP use 292 px there).
  2. The warnings stay in the output column above the loads (as Spread Footing keeps its warnings out of the dashboard): they are long and some carry buttons. The column names them only for an unstable structure / input error.
  3. Shrinking the column (« → 42 px strip) puts the result cards back above the loads, so the results are never hidden (in SF / LP / RW the strip hides the list).
  4. Values with no limit (reactions, |V|, |M|, σ / δ without a limit) show no status word (LP shows "INFO"); an envelope reaction with uplift shows UPLIFT in amber (not a failure; the card showed it in red text).
  5. The column lists what the cards list; no new values (e.g. +M and −M separately are not added: they are in the diagram peak labels and the Engineering Calculations cards).
  6. Phone (≤ 860 px) and tablet are unchanged: the inputs sidebar first, then the output column with the result cards at its top, as before this change (no "results first / Show inputs" reordering as in Retaining Wall: that would be a separate layout change).
- **Check case (default units kip / ft, section on: E 4176000 kip/ft², I 0.02 ft⁴, c 0.5 ft):**
  - Single span 30 ft pin–roller, DL 3 kip/ft uniform, Unfactored, allowable σ 1000 kip/ft², L/360: column lines R_A 45.000 kip↑, R_B 45.000 kip↑, |V| max 45.000 kip, |M| max 337.500 kip·ft (= 3·30²/8), σ max 8437.50 kip/ft² **NG** (= 337.5·0.5/0.02; 58.594 ksi / 1000 ✗), δ max 0.3788 ft **NG** (L/360 = 0.0833 ✗); badge "2 NG" — the same numbers as the cards on main.
  - Envelope, spans 20 / 25 / 8 ft, nodes fixed–roller–roller–free, DL 1.5 + LL 2 kip/ft all spans, WL −30 kip at 4 ft on span 3, σ_allow 3000: R_A 43.252, R_B 123.114, R_C 98.634 kip **UPLIFT** (min −9.669, 0.9DL+1.0WL), |V| env 66.366 kip, |M| env 256.641 kip·ft, σ env 6416.02 kip/ft² **NG**, |δ| env 0.1387 ft **NG** (span 3: L/360 = 0.0222); badges "2 NG", "1 uplift".
- **How verified:**
  - origin/main vs branch, headless Chromium at **1920, 1280 and 1024 px**, four projects (default; the envelope case above; the single-span case above; an unstable roller–free beam): `nodeR`, `shD`, `moD`, `deD`, `env` (R, M, V), `gatherProject()`, `#statsRow` `textContent` (hidden cards included), the tabular results, the Engineering Calculations text, the Report text (Report view) and every localStorage key and value (autosave time stamp masked) **identical**; 0 console errors.
  - Layout at 1920, 1440, 1280, 1024, 390 px (main and branch): no sideways page scroll; at ≥ 1200 px the column (280 / 240 / 240 px) ends at or left of the inputs sidebar, the sidebar at or left of the output column, the Applied Loads card inside the output column (nothing overlaps), the cards hidden there; at 1024 and 390 px no column and the 7 cards above the loads as on main.
  - Click |V| env at 1280 px: the "Envelope Results — All Combinations" card at the top of the output column and flashed; click R_A from the Report view: the Analysis view opens and scrolls to "Support Reactions — Envelope Max / Min". « → 42 px strip, cards back above the loads, `smd_dashCollapsed_v1` = '1'; resizing 1280 → 1024 → 1440 turns the column off and on (240 px) and redraws the diagrams.
  - Screenshots before / after at 1920, 1440, 1280, 1024, 390 px (and the collapsed strip and a clicked line at 1280) looked at.
  - Tests: `tests/check-syntax.mjs`; `tests/smd-verify.mjs` (ALL PASS; its `#statsRow` warning checks still read the warnings, which stay there); `tests/smoke/phone-layout.mjs --tool smd` (390 / 768); `tests/smoke/project-library.mjs --tool smd`.
- **Other copies:** none (the pattern follows LPDC / SFDC; no shared code).

## 2026-11-08 — PR: nl-smd-notes (PR #1211: https://github.com/mlococo88/All-Structural/pull/1211) (SMNL: long notes as a bold lead and a list — combinations dialog, warnings above the loads, Engineering Calculations, Report; display only, no result change)

### SMNL. Long notes split into a lead line and a list   [display only] [no result change]
- **Request (engineer, 2026-11-07):** "There are some sections that just have this block of text. Can we split this up into a numbered list or bullets or some other way so it's not just a text that will likely get overlooked because it's too long." Approved for all tools. Pattern: Spread Footing SFNL-1 / SFNL-2 (#1167).
- **Rule used:** a note is long if it is over ~300 characters, has 3 or more sentences, or carries several facts in one paragraph. It becomes a one-line bold lead, then a list with bold lead words. Every sentence, number, citation and link is kept in the same order (one action line moved first, see 1); new lead words carry no digits, so the digit sequence of each view is unchanged.
- **New helpers** (after `const g=id=>document.getElementById(id);`, anchor `/* SMNL (2026-11-08, engineer:`):
  ```js
  function smdNL(lead,items,o){o=o||{};const L=o.ol?'ol':'ul',li=(items||[]).filter(Boolean).map(x=>'<li>'+(Array.isArray(x)?'<b class="smdNLk">'+x[0]+'</b> '+x[1]:x)+'</li>').join('');
    return (o.act||[]).filter(Boolean).map(a=>'<div class="smdNLa">'+a+'</div>').join('')+(lead?'<div class="smdNLl">'+lead+'</div>':'')+(li?'<'+L+' class="smdNLu">'+li+'</'+L+'>':'');}
  function smdrNL(lead,items,o){o=o||{};const n=t=>o.warn?{type:'note',warn:true,text:t}:{type:'note',text:t};
    return [lead?n(lead):null,...(items||[]).filter(Boolean).map(x=>n('• '+(Array.isArray(x)?x[0]+' '+x[1]:x)))].filter(Boolean);}
  ```
  `smdNL` builds the screen note (inside an element with class `smdNL`); `smdrNL` returns the Report note items (the lead, then one "• lead words: text" note per item; `shared/report.js` is not changed).
- **CSS** (after `.hint{…}`), tool-scoped, colours inherited from the box (the action line uses the tool's existing amber warning colours), print keeps a list item on one page:
  ```css
  .smdNL .smdNLl{font-weight:700;margin:0 0 1px}
  .smdNL .smdNLu{margin:2px 0 3px;padding-left:18px}
  .smdNL .smdNLu>li{margin:1px 0}
  .smdNL .smdNLu>li .btn{font-weight:600}
  .smdNL .smdNLa{background:#fffbeb;border:1px solid #fcd34d;border-radius:5px;color:#92400e;font-weight:700;padding:3px 7px;margin:2px 0 4px}
  @media print{.smdNL .smdNLu>li{break-inside:avoid}}
  ```
- **Notes changed** (anchor = old opening text → new lead → item lead words). Exact before / after: the PR diff.
  1. Load Cases & Combinations dialog, `<p class="hint">Names are generated from the factors.` (1,238 characters) → `<div class="hint smdNL">`: action line "Verify preset factors against your governing code edition." (moved from the end to the top) → lead "Names are generated from the factors. The single-combination dropdown and the envelope both follow this table." → Presets / Unfactored row / Snow rows / Saved projects / Default wind row / Wind direction / Zero factors.
  2. Warning above the loads, pattern live load off (`.smd-patw`): `SMD_PATW_TXT` (string) → `SMD_PATW_NL` ([lead, items]): lead "Live load patterns: Pattern live load is not generated: …at once." with the "Enable pattern live load" button right after the lead → Required / Otherwise. Report (`smdPatNote`): the same lead and items plus "• Setting: pattern live load is off for this project." (was the appended "(Pattern live load is off for this project.)").
  3. Info box, pattern live load in the envelope (`.smd-patl`): `SMD_PATL_TXT()` → `SMD_PATL_NL()`: lead "Pattern live load: each enabled combination with LL is also solved with LL on N pattern(s) of the spans that carry LL." → Other loads / Patterns / Basis / Results. Same in the Report.
  4. Warning, missing snow combinations (`.smd-cmb3`): `smdCmbNoteTxt(m)` → `smdCmbNoteNL(m)`: lead "Load combinations: This project's saved combination list has no …." with the "Add the missing rows" / "Hide" buttons right after the lead → Why / Saved lists. Report: lead, "• Remedy: use “Add the missing rows” on the Analysis view." (moved from the end), Why, Saved lists.
  5. Warning, load cases not combined (`.smd-czf`): `smdZeroTxt(z)` → `smdZeroNL(z)`: lead "Load case(s) … carry/carries loads but has/have a zero factor in every enabled combination." → Remedy (moved before Effect) / Effect. Same in the Report (§1 and §2.3).
  6. Unstable structure box (`updStats`, 3 sentences): lead "⚠ UNSTABLE STRUCTURE — this support configuration is a mechanism (it can move as a rigid body)." → Remedy / Results.
  7. Engineering Calculations, Support Reactions, "Member end forces per span: …" → lead "Member end forces per span: {V_L, M_L, V_R, M_R} = fixed-end forces of the span loads − k_e·d_e." → d / Signs / Support moment.
  8. Engineering Calculations, Section Analysis, "Deflection for … — double integration of M/EI with δ=0 at supports … `SMD_DEFL_TXT`" → lead "Deflection for … — double integration of M/EI." → Boundary conditions / Limit / Load basis. `SMD_DEFL_TXT` is now built from two parts (`SMD_DEFL_LIM`, `SMD_DEFL_CHK`) and stays byte-identical (it is still used by the Report step notes).
  9. Engineering Calculations, envelope, "Deflection envelope — δ by double integration …" (3 sentences) → same lead (first sentence) → Load basis / Limit.
  10. Report §2.3, wind note `SMD_WPM_TXT` → `SMD_WPM_NL`: lead "Wind acts in one direction per load case: …" → Wind both ways / Combinations.
  11. Report, member end forces note "Per span: fixed-end forces (FEF) …" → lead "Member end forces, per span:" → FEF / d / Member end forces / Reactions / Support moment.
- **Not changed:** the Report step notes (`rp-nt`, printed by `shared/report.js` as one italic line under a step: the deflection-limit note, 253 characters, and the envelope deflection note, 397 characters); "Each enabled combination is solved independently …" (2 sentences, under 300 characters); the single-combination pattern warning (2 sentences, 189 characters); "Analysed: …" notes; the load-input-adjusted box (already one line per flag); the left Results summary column (short lines).
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none; no new key.
- **Decisions (pending engineer review):**
  1. Action lines are placed right after the lead (buttons in the warning boxes, "Remedy" items in the Report), not above it, so the action follows the statement of what is wrong; the dialog's "Verify preset factors…" line is placed first, in the amber warning style.
  2. The two long Report step notes (`rp-nt`) are left as they are: splitting a step note needs a change to `shared/report.js` (a shared file used by many tools). Raise separately if wanted. The envelope note also says "a factored combination gives a factored deflection" twice (its own sentence and `SMD_DEFL_TXT`); not changed (wording, not structure).
  3. Report notes are printed one line per item, as Spread Footing (`sfrNL`); the shared renderer gives each line the note spacing.
- **Check case:** default units kip / ft; spans 20 / 25 / 8 ft, nodes fixed–roller–roller–free, DL 1.5 + LL 2 kip/ft all spans, WL −30 kip at 4 ft on span 3, σ_allow 3000, envelope on, project saved without `patLL` (pattern live load off). Above the loads: before one 441-character warning; after the bold lead "Live load patterns: Pattern live load is not generated: each combination applies LL to every span it is entered on at once.", the Enable button, and two bullets carrying "IBC 2018 Sec. 1607.12 and ASCE 7-16 Sec. 4.3.3" and "(for example L1, L2)". Results summary values unchanged: R_A 43.252, R_B 123.114, R_C 98.634 kip (min −9.669 UPLIFT), |V| env 66.366 kip, |M| env 256.641 kip·ft, σ env 6416.02 kip/ft².
- **How verified:** headless Chromium, origin/main vs the branch, 15 projects (simple span with σ / δ limits; the envelope case above with pattern live load off and on; single combination with pattern on and off; an old saved combination list with snow (missing rows); a zero-factor case, single and envelope; a load off the span; an unstable beam; I = 0; cantilever overhang with a couple; lb / in): `nodeR`, `shD`, `moD`, `deD`, `env.R`, `gatherProject()` identical; the digit sequence of `#statsRow`, Engineering Calculations, the tabular results, the diagram notes, the Results summary column, the combinations dialog and the whole Report text identical in all 15. 0 console errors. Screenshots at 1440 and 390 px (no sideways scroll). Tests: `tests/check-syntax.mjs`; `tests/smd-verify.mjs` (ALL PASS); `tests/smoke/phone-layout.mjs --tool smd`; `tests/smoke/project-library.mjs --tool smd`.
- **Other copies:** none.

## 2026-11-08 — PR: claude/shared-step-notes (PR #1240: https://github.com/mlococo88/All-Structural/pull/1240) (SMNL-2: the two long Report step notes as a bold lead and a list; display only, no result change)

### SMNL-2. Deflection step notes of the Report as list notes   [display only] [no result change]
- **Request:** SMNL open item 2 (#1211): the two long Report step notes could not be split without a shared-file change. `shared/steps.js` /
  `shared/report.js` now accept a list note (`{ lead, items }`, same PR; `fixlog/shared-steps.md`, `fixlog/shared-report.md`).
- **Where (1):** after `const SMD_DEFL_TXT=…;` (its comment now says it was the Report step notes), new:
  ```js
  const SMD_DEFL_NOTE=(lead,pre)=>({lead,items:(pre||[]).concat([['Limit:','the '+SMD_DEFL_LIM+'.'],['Load basis:',SMD_DEFL_CHK+'.']])});
  ```
  `SMD_DEFL_TXT` is kept unchanged (byte-identical; no longer used by the Report).
- **Where (2):** `smrModel`, envelope, step `env.dm` ("Largest |δ| over the enabled combinations"). Before:
  `note:'A factored combination gives a factored deflection: for a service-level check enable only service combinations, or use single-combination mode. '+SMD_DEFL_TXT`
  After: `note:SMD_DEFL_NOTE('A factored combination gives a factored deflection:',[['For a service-level check:','enable only service combinations, or use single-combination mode.']])`
  (397 characters → lead + For a service-level check / Limit / Load basis).
- **Where (3):** `smrModel`, single combination, step `dm` ("Largest deflection for …"). Before: `note:SMD_DEFL_TXT` (253 characters). After:
  `note:SMD_DEFL_NOTE('Deflection limit and load basis:')` (lead + Limit / Load basis; the same split as the Analysis view, SMNL item 8).
- **Where (4):** `smrRich` (the '_' removal of step labels and notes), before:
  `st.note=String(st.note||'').replace(/_/g,'');` after: `st.note=st.note&&typeof st.note==='object'?smrNoteU(st.note):String(st.note||'').replace(/_/g,'');`
  with, before `function smrRich(M2){`:
  ```js
  const smrNoteU=n=>{const u=t=>String(t==null?'':t).replace(/_/g,'');const o={lead:u(n.lead),items:(n.items||[]).map(x=>Array.isArray(x)?x.map(u):u(x))};if(n.action!=null)o.action=Array.isArray(n.action)?n.action.map(u):u(n.action);return o;};
  ```
  (without it a list note would print as "[object Object]").
- **Words:** every word and digit kept in order; the dm note's "The deflection limit …" now reads "the deflection limit …" after the lead word "Limit:".
  New lead words carry no digits. Text export (`SharedReport.text`): the step line, then the lead and "• Limit: …", "• Load basis: …" lines.
- **Formulas, factors, units, code references:** none changed (§4 does not apply). **Saved data:** none.
- **Check case:** template "2-span continuous", section on, single combination (Unfactored): δ_max = 0.008206 ft at x = 23.700 ft unchanged; note before one 253-character line,
  after "Deflection limit and load basis:" + 2 bullets (IBC 2018 Table 1604.3, l/360, l/240 unchanged). Envelope on: |δ|_env = 0.014728 ft unchanged; note: 3 bullets.
- **How verified:** origin/main vs branch, both views: every Report step's innerHTML identical except the converted note; `.rp-doc` digit sequence identical;
  0 console / KaTeX errors. Tests: `tests/smd-verify.mjs`, `tests/smoke/phone-layout.mjs`, `tests/smoke/project-library.mjs --tool smd` (see the PR).
  Screenshots: scratchpad `notes/shared/smd-*`.
- **Other copies:** none.

## 2026-11-10 — PR: asm-shear-moment (PR #1316: https://github.com/mlococo88/All-Structural/pull/1316) (SMASM: recorded assumptions and decisions stated as notes on screen and in the Report; display only, no result change)

### SMASM. Assumptions stated where they apply (CLAUDE.md §6, engineer's rule 2026-11-10, #1284)   [display only] [no result change]
- **Request:** every assumption or decision recorded for the tool is also stated in the tool, on screen and in the matching Report section, as a plain statement of what the code does, with the provision where there is one. Template: Steel Bridge SBASM (#1285).
- **Audit:** every "Decision (pending engineer review)", engineer's decision and open item of this fix log, and the PR bodies #155, #1082, #1096, #1108, #1115. The PR table (item → screen → Report → status) is in #1316. No in-app or Report string said "pending engineer review" before this change.
- **Edits** (each Before occurs once; CRLF lines kept):
  1. Spans & Supports hint. Before: `<p class="hint">Set an end node to <b>Free</b> for a cantilever overhang.</p>` After: the same sentence, then `<!-- SMASM (2026-11-10): support basis stated -->Pin and Roller both restrain vertical deflection only and are solved alike (the beam model has no axial degree of freedom); Fixed also restrains rotation.` (F11; `solveFor`: `v` constrained for every non-free node, `θ` only for `fixed`).
  2. Section Properties, after the `iShape` `</select>`: new `<p class="hint" style="margin:3px 0 0"><!-- SMASM (2026-11-10) -->A W-shape fills I, A, c = d/2 and the web t<sub>w</sub> (AISC Shapes Database v16.0) and E = 29,000 ksi (AISC 360-16), in the current units. Editing I, c or A makes it a custom section.</p>` (F4, F10; the `iShape` change handler and the `iI`/`iC`/`iA` input listener).
  3. Combinations dialog hint, item "Saved projects:". Before: `… offer to add the missing rows when it has snow load.</li>` After: `… offer to add the missing rows when it has snow load and an LRFD-type list (a row with 1.2D); without snow load the added rows reduce to rows the other combinations bound for loads of one sign, so no rows are offered.</li>` (CMB3 decision; `smdCmbMissing()`).
  4. `SMD_PATL_NL`, after the `['Results:', …]` item: `['Cases:','only load case LL is patterned; other cases (for example L1, L2 or SL) are applied as entered, and snow drift or unbalanced snow is not generated.']` (PATW / PATL decisions; `smdPatLoads()` patterns `lc==='LL'` only). Screen info box and Report §1 / §2.3.
  5. `SMD_PATW_NL`, after the `['Otherwise:', …]` item: `['Saved projects:','new projects have pattern live load on; a project saved before the option existed (2026-11-07) opens with it off, so its results are as saved.']` (PATL decision; `let patLL=true`, `applyProject`: absent → false). Screen warning and Report.
  6. Before `const SMD_DEFL_NOTE=`: new `const SMD_DEFL_SPAN='each span is checked against its own length L, and a cantilever overhang against the overhang length. IBC 2018 Table 1604.3 footnote i takes l as twice the cantilever length; the overhang length itself gives the smaller, more conservative limit';` and in `SMD_DEFL_NOTE` the item `['Span length:',SMD_DEFL_SPAN+'.']` between Limit and Load basis (Report steps `dm` and `env.dm`). Open item O3 stated as the code has it (`deflSpans()`: `allow = sp.L/defLim` for every span); O3 itself stays open.
  7. `renderKaTeX`: the same `['Span length:',SMD_DEFL_SPAN+'.']` item in the Section Analysis deflection box (after Limit) and in the envelope deflection box (after Limit).
  8. `renderKaTeX`, τ box. Before: `${shpW?p(…AISC 360-16 Sec. G2.1).`):''}` After: `…):p('Custom section: taken as the peak shear stress of a solid rectangle.')}` (F4; `tauOf`: 1.5|V|/A without a preset; the Report step already said "Shear stress, solid rectangle").
  9. `smrModel`, Geometry and supports: after the "`${ns}-span beam …`" note, new note `Supports: pin and roller both restrain vertical deflection only and are solved alike (the beam model has no axial degree of freedom); fixed also restrains rotation; free is unrestrained.`
  10. `smrModel`, Section properties: `items:[{type:'table',…}]` → `items:[{type:'table',…}].concat(shpW?[{type:'note',text:'The W-shape preset fills I, A, c = d/2 and the web thickness (AISC Shapes Database v16.0) and E = 29,000 ksi (AISC 360-16), in the current units; the values in the table are those analysed.'}]:[])`.
- **Governing provisions (paraphrased, cited only):** IBC 2018 Table 1604.3 footnote i (cantilever l); AISC 360-16 (E = 29,000 ksi); AISC Shapes Database v16.0.
- **Code vs decision:** no mismatch found.
- **Check case:** spans 16 + 6 ft, pin / roller / free, DL 1.5 kip/ft, LL 8 kip at the tip, W18×50, L/360, Unfactored. Before and after: δ span 2 = 0.01045 ft ≤ 6/360 = 0.01667 ft; the new "Span length:" item says the 6 ft overhang length is used (with footnote i, 12/360 = 0.03333 ft would be allowed).
- **How verified:** main vs branch, 7 projects. Results identical (`nodeR`, `shD`, `moD`, `deD`, `env.R`, `tabR`). The digit sequences of the Analysis view, the dialog hint and the Report are identical apart from the added notes (2018, 1604.3, d/2, v16.0, 29,000, 360-16, 1.2D, L1, L2, 2026-11-07). 0 console errors. Tests: `check-syntax`, `smd-verify` (ALL PASS), `phone-layout --tool smd`, `project-library --tool smd`. No sideways scroll at 390 px.
- **Saved data:** none. **Other copies:** none.
