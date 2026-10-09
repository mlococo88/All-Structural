# Fix log — Steel Beam Design - AISC 15th.html

Governing basis used for fixes: AISC 360-16 (as stated in the tool), Steel Construction Manual 15th Ed.

Note: the file uses CRLF line endings. Many functions are defined more than once and the **last
definition wins** (see O4). Every edit below was checked to be in the live (last) definition, or in a function defined only once.

## 2026-10-04 — PR: claude/fix-steel-beam (PR link added after merge)

### F1. E7 effective width of I-shape webs used c1/c2 = 0.22/1.49   [calc change] [more conservative]
- **Where:** function `compStrength` (≈ line 1708). Anchor: `if(cc.web.cls==='slender'){const r=beOf(p.hClear,p.tw,`. Also the explanatory text in the user manual (≈ line 3928, anchor `with c₁/c₂ = `) and the worked block's `vars` (≈ line 9576, anchor `['c_1,c_2',`).
- **Problem:** the web is a stiffened element (Table E7.1 case (a), c1 = 0.18, c2 = 1.31). The code used the case (c) values for "all other elements", which overstate b_e and A_e when the web is slender in compression and E7-2 governs. The flange values (0.22/1.49) and the HSS wall values (0.20/1.38) were already correct and were not changed.
- **Governing provision:** AISC 360-16 §E7.1, Eqs. E7-2/E7-3, Table E7.1 case (a).
- **Before:**
  ```js
  if(cc.web.cls==='slender'){const r=beOf(p.hClear,p.tw,cc.web.lam,cc.web.lr,0.22,1.49);
  ```
- **After:**
  ```js
  if(cc.web.cls==='slender'){const r=beOf(p.hClear,p.tw,cc.web.lam,cc.web.lr,0.18,1.31); /* Table E7.1 case (a): stiffened element (web) */
  ```
  Text: `0.22/1.49 for most elements and 0.20/1.38 for square and rectangular HSS walls;` → `0.18/1.31 for I-shape webs (Table E7.1 case (a)), 0.20/1.38 for square and rectangular HSS walls (case (b)), and 0.22/1.49 for all other elements such as flanges (case (c));`. Vars: `'0.22, 1.49 (0.20, 1.38 for HSS walls)'` → `'0.18, 1.31 for I-shape webs; 0.20, 1.38 for HSS walls; 0.22, 1.49 for flanges'`.
- **Check case:** W21X48, A992 (F_y = 50), L_cx = L_cy = L_cz = 10 ft. A_g = 14.1 in², h = 18.76 in, t_w = 0.350 in, h/t_w = 53.6, F_cr = 34.12 ksi.
  - λ_r = 1.49√(29000/50) = 35.88. Threshold λ_r√(F_y/F_cr) = 43.44 < 53.6, so the web is reduced.
  - Before (0.22/1.49): F_el = (1.49·35.88/53.6)²·50 = 49.75 ksi; b_e = 16.635 in; removed area 0.744 in²; A_e = 13.356 in²; φP_n = 0.9(34.12)(13.356) = 410.17 kip.
  - After (0.18/1.31): F_el = (1.31·35.88/53.6)²·50 = 38.46 ksi; √(F_el/F_cr) = 1.0617; b_e = 18.76(1 − 0.18·1.0617)(1.0617) = 16.110 in; removed area (18.76 − 16.110)(0.35) = 0.927 in²; A_e = 13.173 in²; **φP_n = 404.53 kip (−1.4 %)**.
  - W24X55, L_c = 10 ft: φP_n 391.43 → 387.33 kip. At L_c = 20 ft (F_cr = 12.0 ksi) the web is not reduced, so there is no change.
- **How verified:** node run of `compStrength` from the original and the edited script; hand check above. The built-in Validation examples give identical results before and after.
- **Other copies of this code:** none known.

### F2. Built-up I-shape flag now uses the k_c-based flange limits   [calc change] [more conservative]
- **Where:** functions `classifyFlex` (≈ line 1415) and `classifyComp` (≈ line 1436); worked display in the live `classFlexBlock` (≈ line 9489) and the label in the dead earlier copy (≈ line 3156). Anchors: `return{flange:mk(lamF,0.38*rt,1.0*rt,'10')` and `return{flange:mk(lamF,0.56*rt,'1')`.
- **Problem:** with "built-up" checked, the tool still used the rolled-shape limits λ_r = 1.0√(E/F_y) (flexure) and 0.56√(E/F_y) (compression), which are unconservative for welded sections with slender webs. The flag only switched off the §G2.1(a) shear rule. The λ_r values feed F3-1, F4-13 and F5 FLB and the E7 flange effective width.
- **Governing provision:** AISC 360-16 Table B4.1b case 11 (λ_r = 0.95√(k_cE/F_L)); Table B4.1a case 2 (λ_r = 0.64√(k_cE/F_y)); k_c = 4/√(h/t_w), 0.35 ≤ k_c ≤ 0.76 (Table B4.1 note [a]); F_L = 0.7F_y for doubly symmetric sections (S_xt/S_xc = 1, Eq. F4-6a). The tool only builds doubly symmetric I-shapes.
- **Before:**
  ```js
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    return{flange:mk(lamF,0.38*rt,1.0*rt,'10'),web:mk(p.htw,3.76*rt,5.70*rt,'15')};
  ...
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    return{flange:mk(lamF,0.56*rt,'1'),web:mk(p.htw,1.49*rt,'5')};
  ```
- **After:**
  ```js
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    if(p._kind==='I'&&p._built){ /* built-up I: Table B4.1b case 11, lambda_r = 0.95 sqrt(kc E/FL); doubly symmetric, so FL = 0.7Fy (F4-6a) */
      const kc=Math.max(0.35,Math.min(0.76,4/SQ(p.htw))),FL=0.7*Fy;
      const fl=mk(lamF,0.38*rt,0.95*SQ(kc*E/FL),'11');fl.kc=kc;fl.FL=FL;
      return{flange:fl,web:mk(p.htw,3.76*rt,5.70*rt,'15')};
    }
    return{flange:mk(lamF,0.38*rt,1.0*rt,'10'),web:mk(p.htw,3.76*rt,5.70*rt,'15')};
  ...
    const lamF=(p._kind==='I')?p.bf/(2*p.tf):p.bf/p.tf;
    if(p._kind==='I'&&p._built){ /* built-up I: Table B4.1a case 2, lambda_r = 0.64 sqrt(kc E/Fy) */
      const kc=Math.max(0.35,Math.min(0.76,4/SQ(p.htw)));
      const fl=mk(lamF,0.64*SQ(kc*E/Fy),'2');fl.kc=kc;
      return{flange:fl,web:mk(p.htw,1.49*rt,'5')};
    }
    return{flange:mk(lamF,0.56*rt,'1'),web:mk(p.htw,1.49*rt,'5')};
  ```
  Display (live `classFlexBlock`): the flange λ_r expression is `c.flange.case==='11'?'0.95\\sqrt{k_cE/F_L}':'1.0\\sqrt{E/F_y}'`, and for case 11 an extra line shows k_c and F_L. In the dead copy, the label `'Flange (B4.1b case 10)'` → `'Flange (B4.1b case '+D.clsF.flange.case+')'`.
- **Check case:** W21X48, A992, flagged built-up, L_b = 0. b_f/2t_f = 9.465, h/t_w = 53.6, Z_x = 107, S_x = 93.0.
  - k_c = 4/√53.6 = 0.546.
  - Flexure λ_r: before 1.0√(29000/50) = 24.08; after 0.95√(0.546·29000/35) = 20.21. λ_p = 9.15.
  - F3-1: M_n = 5350 − (5350 − 3255)(9.465 − 9.152)/(λ_r − 9.152). Before 5306 kip-in, so **φM_n = 397.95 kip-ft**. After 5291 kip-in, so **φM_n = 396.80 kip-ft**.
  - Compression λ_r: before 0.56√580 = 13.49; after 0.64√(0.546·29000/50) = 11.39 (flange still nonslender).
  - W14X90 built-up (k_c capped at 0.76): flexure λ_r 24.08 → 23.84; φM_n 573.61 → 573.36 kip-ft.
  - Rolled shapes (flag off): unchanged.
- **How verified:** node run of `classifyFlex`, `classifyComp` and `flexFor`, before and after, plus the hand check above.
- **Other copies of this code:** none known.

### F3. Member mode: a blocked flexure check no longer drops out of the interaction   [bug fix] [more conservative]
- **Where:** `memberDesignAll` (≈ line 4433). Anchor: `const rx=C.flexGov.dcr`
- **Problem:** if the major-axis flexure route was blocked (dcr = ∞), the member-mode interaction used rx = 0, so the Interaction check could show PASS. Beam mode already carried ∞ into the interaction.
- **Before:**
  ```js
  const rx=C.flexGov.dcr===Infinity?0:C.flexGov.dcr,ry=C.dcrMy||0,rp=C.dcrP||0;
  ```
- **After:**
  ```js
  const rx=C.flexGov.dcr,ry=C.dcrMy||0,rp=C.dcrP||0;   /* a blocked flexure check (dcr = Infinity) makes the interaction FAIL, as in beam mode */
  ```
- **Check case:** member mode, C12X20.7 A36 with b_f doubled by override (noncompact flange, so the route is blocked), M_ux = 20 kip-ft, V_ux = 5 kip, L_b = 10 ft → before: Interaction H1-1b = 0.000, PASS; after: Interaction = ∞, shown as FAIL with DCR "—". The "One or more flexural routes are blocked" warning shows in both.
- **How verified:** node run of `memberDesignAll`.
- **Other copies of this code:** batch mode already reports BLOCKED. Beam mode already behaved this way.

### F4. Axial tension: clear warning that it is not checked; H3.3 stress sum uses |P_u|   [display + calc change] [more conservative]
- **Where:** `buildDesignChecks` (≈ line 1995, right after the Interaction check push; anchor `const tenC=`); `h33Check` (≈ line 5384, anchor `const fa=`).
- **Problem:** in beam and member modes a negative P_u (tension) was silently ignored. There is no D2 check and no H1.2 interaction. Batch mode already printed a note. Also, `h33Check` used the signed P_u, so a tension **reduced** the H3.3 normal stress f_n (unconservative).
- **Decision:** a D2 check needs net area and shear-lag data that the tool does not collect, so D2/H1.2 were **not** implemented (not clean). A warning is shown instead, per the task.
- **Governing provision:** AISC 360-16 Chapter D, §H1.2, §H3.3(a).
- **Before:**
  ```js
    const fa=(dem.Pu||0)/p.A;
  ```
  (no warning)
- **After:**
  ```js
    const fa=Math.abs(dem.Pu||0)/p.A;   /* magnitude: an axial tension stress adds to the bending stress on the tension side */
  ```
  and in `buildDesignChecks`:
  ```js
  const tenC=D.perCombo.filter(c=>c.man&&(+c.man.Pu||0)<0);
  if(tenC.length)D.warns.push('Axial TENSION (Pᵤ < 0) is entered for: '+tenC.map(c=>c.name).join(', ')+'. Tension is NOT checked: Chapter D (tensile yielding and rupture) and the §H1.2 interaction are not implemented, and the tension is left out of the H1-1 interaction. Check the member in tension and its connections separately.'+(D.perCombo.some(c=>c.h33)?' (The §H3.3 stress sum includes |Pᵤ|/A.)':''));
  ```
- **Check case:** W18X35 A992 (A = 10.3 in²), P_u = −50 kip, M_ux = 60 kip-ft, V_ux = 10 kip, open-section torsion "conc_pp", L = 20 ft, T = 2 kip-ft at midspan:
  - before: f_a = −4.85 ksi, f_n = 26.74 ksi, H3.3 dcr = 26.74/45 = 0.594, no warning;
  - after: f_a = +4.85 ksi, f_n = 36.45 ksi, H3.3 dcr = 0.810, and the tension warning is shown.
  - Hand check: 50/10.3 = 4.85; 26.74 + 2(4.85) = 36.45.
  - Batch mode passes P_u clamped to ≥ 0, so it is unchanged.
- **How verified:** node run of `h33Check` and `memberDesignAll`.
- **Other copies of this code:** batch mode (`batchCheckRow`) already had its own tension note; it was not changed.

### F5. H3.3 open-section torsion: warning when flexural buckling governs below yield   [display] [no result change]
- **Where:** `buildDesignChecks` (≈ line 1997, anchor `const h33B=`).
- **Problem:** `h33Check` compares f_n with φF_y and f_v with φ0.6F_y only. §H3.3(c) also requires the buckling limit state. Where LTB or local buckling gives φM_n/S_x < φF_y, the H3.3 check can pass while the member is buckling-critical.
- **Decision:** a full H3.3(c) implementation needs a design decision on how to combine warping normal stress with LTB, so it was **not** implemented. A warning is shown instead, with the governing combination and an indicative ratio (f_bx + σ_w)/(φM_n/S_x), which is labelled "not a code DCR". The DCRs are unchanged.
- **Governing provision:** AISC 360-16 §H3.3(c).
- **Before:** (no warning)
- **After:**
  ```js
  const h33B=D.perCombo.filter(c=>c.h33&&c.flexGov&&!c.flexGov.blocked&&c.flexGov.phiMn>0&&c.flexGov.phiMn*12/D.p.Sx<0.9*D.p.mat.Fy*(1-1e-9));
  if(h33B.length){ ... D.warns.push('§H3.3 open-section torsion: the normal-stress check compares fₙ with φFᵧ only; the buckling limit state of §H3.3(c) is NOT checked. ...'); }
  ```
  (see the file for the full message text)
- **Check case:** member mode, W18X35 A992, L_b = 20 ft, C_b = 1, M_ux = 60 kip-ft, torsion as in F4 → φM_n = 60/0.8667 = 69.2 kip-ft, φM_n/S_x = 69.2·12/57.6 = 14.42 ksi < φF_y = 45 ksi. The H3.3 check still shows dcr 0.70 to 0.81 (PASS), and the new warning shows f_bx + σ_w = 31.60 ksi, indicative ratio 2.19. **This case shows that the existing H3.3 check can pass a member that is far over its LTB capacity once warping stress is added.**
- **How verified:** node run of `memberDesignAll`.
- **Other copies of this code:** batch mode (`batchCheckRow` → `h33Check`) does not show this warning (see O2).

## 2026-10-04 — PR: claude/step1-group4 (PR link added after merge)
### S1. "← All tools" link and shared project info   [feature (no result change)]
- **Date / type:** 2026-10-04, feature (no result change).
- **Where:** CSS after `#projGrid input::placeholder{color:#8FA3BC}`, `#hdr` markup after `<div class="byline">by Mario Lococo</div>`, new `#projShare` row after `<div id="projGrid"></div>`, and two new `<script>` blocks before `</body>`.
- **Purpose:** link back to `tools.html` (`target="_top"`, hidden in print); "Use shared project info" / "Share project info" on the `bridgeSuite.v1.projectMeta` channel (`_schema:"bridge-project-meta"`, HANDOFF.md §4.1). Use reads with `BridgeXfer.read('projectMeta','bridge-project-meta',1)`, shows a confirm listing every field that will be overwritten (old → new), writes only fields this tool has, never blanks a field when the shared value is empty, and skips a non-`YYYY-MM-DD` value for a date input.
- **Field mapping:** S.proj.name (`data-fkey="proj_name"`) → projectName; S.proj.by → preparedBy; S.proj.chk → checkedBy; S.proj.date → date. Not in this tool's inputs (sent as ""): bridgeId, jobNo, client, location. Subject, Task and Checked date are not mapped. (`S.proj.num` / `S.proj.client` are read by the report but have no input, so they are neither sent nor written.)
- **Governing provision:** none (no engineering change). Spec: HANDOFF.md §4.1 and §5.
- **Before / After** (exact; edits applied in this order, each anchor occurs once; line endings preserved):
  1.
     - Before:
  ```html
  #projGrid input::placeholder{color:#8FA3BC}
  ```
     - After:
  ```html
  #projGrid input::placeholder{color:#8FA3BC}
  #hdr .alltools{display:inline-block;margin-top:2px;font-family:var(--font-ui);font-size:8.5pt;color:#C7D4E4;text-decoration:none}
  #hdr .alltools:hover{color:#fff;text-decoration:underline}
  #projShare{display:flex;gap:6px;margin-top:5px}
  #projShare button{font-family:var(--font-ui);font-size:8pt;padding:2px 8px;border:1px solid #ffffff44;border-radius:3px;background:#ffffff14;color:#fff;cursor:pointer}
  #projShare button:hover{background:#ffffff2a}
  @media print{.alltools,#projShare{display:none!important}}
  ```
  2.
     - Before:
  ```html
          <div class="byline">by Mario Lococo</div>
  ```
     - After:
  ```html
          <div class="byline">by Mario Lococo</div>
          <a class="alltools" href="tools.html" target="_top">&larr; All tools</a>
  ```
  3.
     - Before:
  ```html
      <div id="projGrid"></div>
  ```
     - After:
  ```html
      <div id="projGrid"></div>
      <div id="projShare">
        <button type="button" onclick="bxUseProjectInfo()">Use shared project info</button>
        <button type="button" onclick="bxShareProjectInfo()">Share project info</button>
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
    var PRODUCER="Steel Beam Designer", FILE="Steel Beam Design - AISC 15th.html";
    var MAP={projectName:'[data-fkey="proj_name"]', preparedBy:'[data-fkey="proj_by"]', checkedBy:'[data-fkey="proj_chk"]', date:'[data-fkey="proj_date"]'};
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
- **Behaviour notes:** Use dispatches `input` on the `txtInput` fields, so the existing handler sets `S.proj[key]` and calls `schedule()` (recompute, `autosave()`, undo history). The header grows by one short button row.
- **Saved data:** no existing key or format changed. New keys are only the HANDOFF channel keys `bridgeSuite.v1.projectMeta` and `bridgeSuite.v1.projectMeta.updatedAt`, written on "Share project info".
- **Check case:** n/a, no computed result changes. Hand check: open the tool, type a project name, click "Share project info"; open another tool, click "Use shared project info", accept the confirm; the name appears and survives a reload.
- **How verified:** Every plain inline script syntax-checked (Node `vm.Script`, same parser as `node --check`); BridgeXfer block compared byte-for-byte with HANDOFF.md §5; page loaded in jsdom (CDN scripts not loaded) before and after the change with no new errors; Share → Use exercised between tools with jsdom localStorage (ASCE7-16 → ACI Rebar, Steel Beam → Shear and Moment, Concrete Beam Capacity shell against stub tab documents), including cancel, empty shared values (field kept), a non-ISO date on a date input (skipped), an empty channel and a wrong `_schema` (refused). `git diff` shows no removed lines other than the ones listed under Before. No calculation code was touched.
- **Other copies of this code:** none. BridgeXfer v1 is also in: ACI Rebar Development Length.html, ASCE7-16 Load Generator.html, Concrete Beam Capacity.html (shell), Steel Beam Design - AISC 15th.html, Shear and Moment Diagrams.html.

## 2026-10-04 — PR: claude/conn-asce7-steelbeam (PR link added after merge)
### C1. Building-load hand-off receiver: "Pull from ASCE 7-16" and "Import hand-off (JSON)"   [feature: hand-off (no result change)]
- **Date / type:** 2026-10-04, feature: hand-off (no result change).
- **Where:** header `#projShare` row (anchor `onclick="bxShareProjectInfo()">Share project info</button>`); `loadTable()` (anchor `tdN.innerHTML=(ld.nm||'')`); `buildDeriveTab()` first line (anchor `function buildDeriveTab(pg){`, defined once); `buildPrintReport()` after the title block (anchor `pr.appendChild(tb);` followed by `if(isMember())pr.appendChild(`); one new `<script>` block after the shared-project-info script, before `</body>`. File uses CRLF; the inserted lines use CRLF too. All edited functions are defined once (see O4).
- **Purpose:** reads channel `bridgeSuite.v1.buildingLoads` (`_schema:"bridge-building-loads"`, version ≤ 1). The dialog shows producer, time, project and the sender's notes; the user enters the tributary width TW (default = TW_L + TW_R of the Tributary Load Generator), picks the load types, the target case of each, the wind pressure (default roof uplift), all or selected spans, and "replace previously imported loads" (default) or "add". A live summary lists every load that will be removed and added and any new case; nothing changes until **Import** is clicked. Line load w (kip/ft) = p (psf) × TW (ft) / 1000. Imported loads are ordinary unfactored uniform loads tagged `ld.bx`; replace removes only tagged loads of the selected types. The source goes into the new optional field `S.bxSrc.buildingLoads` and is shown in the header, in the Load Derivation tab (with the conversion for every imported load) and at the top of the printed report. `BridgeXfer.markAdopted('buildingLoads','steelbeam',producedAt)` clears the "new data available" marker. Nothing runs on page load except refreshing that marker and the source line.
- **Mapping:**

| HANDOFF field | ASCE7-16 source (sender) | Steel Beam target (receiver) |
|---|---|---|
| `areaLoads.D` | `S.DLroof` (roof dead load input, psf, horizontal projection) | uniform load, case DL (default), w = D·TW/1000 |
| `areaLoads.L` | not computed → `null` | row disabled ("not provided") |
| `areaLoads.Lr` | `S.LrRoof` (roof live input, psf) | uniform load, case LR (created if missing), w = Lr·TW/1000 |
| `areaLoads.S` | `R.snow.balanced` (design balanced roof snow, psf) | uniform load, case SL, w = S·TW/1000 |
| `areaLoads.W.roofUplift` | most negative MWFRS roof pressure, all directions/zones/±GCpi (dashboard envelope) | uniform load, case WL, w = p·TW/1000 (negative = upward) — default wind choice |
| `areaLoads.W.roofDown` | most positive MWFRS roof pressure | same, if chosen |
| `areaLoads.W.wall` | larger of abs(windward wall at h) and abs(most negative leeward/side wall) | same, applied as + (beam load plane), if chosen |
| `areaLoads.W.wallPressure` / `wallSuction` | windward wall at h (max of ±GCpi) / most negative leeward or side wall | same, sign as published, if chosen |
| `areaLoads.R` | not computed → `null` | not imported |
| `seismic.SDS, SD1, SDC` | `R.seis.SDS`, `.SD1`, `.SDC` (`null` if no tabulated Fa/Fv) | shown in the dialog, not imported |
| `seismic.Ie` | `R.site.Ie` | shown, not imported |
| `info.snow` (unbalanced, drift) | `R.snow.unbal`, `R.snow.driftGov` | warning in the dialog only; not imported |

- **User choices (each logged in `S.bxSrc.buildingLoads`):** TW; spans; wind pressure (roofUplift default); target case per type; replace/add. Default ticks: a type is ticked only if it has a non-zero value, the target case is used by an active strength combination, and the Tributary Load Generator does not already apply a pressure to that case (so D is unticked in the default project, which already has 15 psf DL through the generator, and Lr is unticked because no combination uses LR).
- **Validation:** `_schema`, `schemaVersion ≤ 1`, corrupt JSON (BridgeXfer); `units.pressure` must be `psf` or `kPa` (× 20.885434), anything else refused; `factored:true` refused; D, L, Lr, S must be finite and ≥ 0; every W value finite; `W.wall` ≥ 0; SDS, SD1, Ie finite and ≥ 0; TW must be > 0 and ≤ 200 ft; at least one type and one span.
- **Governing provision:** none changed. No formula, factor or default changed; the only effect is adding loads the user confirms. Spec: HANDOFF.md §3, §4.7, §5.
- **Before / After** (exact; each anchor occurs once):
  1. Header buttons.
     - Before:
  ```html
      <button type="button" onclick="bxShareProjectInfo()">Share project info</button>
    </div>
  ```
     - After:
  ```html
      <button type="button" onclick="bxShareProjectInfo()">Share project info</button>
      <button type="button" onclick="bxPullBuildingLoads()" title="Import nominal area loads (psf) from the ASCE 7-16 Load Generator as line loads (HANDOFF.md, channel buildingLoads)">Pull from ASCE 7-16<span id="bxBldNew" style="display:none;color:#FDE68A;font-weight:700"> &#9679; new data available</span></button>
      <button type="button" onclick="document.getElementById('bxBldFile').click()">Import hand-off (JSON)</button><input type="file" id="bxBldFile" accept=".json,application/json" style="display:none" onchange="bxImportBuildingLoads(event)">
      <span id="bxBldSrc" style="font-family:var(--font-ui);font-size:8pt;color:#C7D4E4;align-self:center"></span>
    </div>
  ```
  2. `loadTable()` badge.
     - Before:
  ```js
    tdN.innerHTML=(ld.nm||'')+(locked?'<span class="genBadge">'+(ld.gen.src==='sw'?'auto SW':'trib')+'</span>':'');
  ```
     - After:
  ```js
    tdN.innerHTML=(ld.nm||'')+(locked?'<span class="genBadge">'+(ld.gen.src==='sw'?'auto SW':'trib')+'</span>':'')+(ld.bx?'<span class="genBadge" title="Imported building load (hand-off); see the Load Derivation tab">imported</span>':'');
  ```
  3. `buildDeriveTab()`.
     - Before:
  ```js
function buildDeriveTab(pg){
  if(!S.trib.on&&!S.trib.sw){
  ```
     - After:
  ```js
function buildDeriveTab(pg){
  if(typeof bxDeriveBuilding==='function')bxDeriveBuilding(pg);   /* imported building loads (HANDOFF.md §4.7) */
  if(!S.trib.on&&!S.trib.sw){
  ```
  4. `buildPrintReport()`.
     - Before:
  ```js
  tb.appendChild(tt);
  pr.appendChild(tb);
  if(isMember())pr.appendChild(
  ```
     - After:
  ```js
  tb.appendChild(tt);
  pr.appendChild(tb);
  if(typeof bxSourceLine==='function'&&bxSourceLine())pr.appendChild(el('div','note',bxSourceLine()));   /* hand-off source (HANDOFF.md §3.4) */
  if(isMember())pr.appendChild(
  ```
  5. New script, inserted between the shared-project-info `</script>` and `</body>` (BridgeXfer v1 is already in this file from Step 1 and is reused):
  ```html
<script>
/* Building-load hand-off receiver (HANDOFF.md §4.7, channel buildingLoads, sender: ASCE7-16 Load Generator.html).
   "Pull from ASCE 7-16" / "Import hand-off (JSON)". Nothing is applied on page load: the user opens the dialog,
   enters the tributary width and choices, reviews what will be removed and added, and clicks Import.
   Imported loads are ordinary unfactored uniform loads (positive down) tagged ld.bx = {ch:'buildingLoads', ...}
   so they can be found and replaced later. The source is kept in the new optional field S.bxSrc.buildingLoads. */
(function(){
  var CH='buildingLoads', SCHEMA='bridge-building-loads', MAXV=1, RID='steelbeam';
  var TYPES=['D','L','Lr','S','W'];
  var DEF_CASE={D:'DL',L:'LL',Lr:'LR',S:'SL',W:'WL'};
  var TYPE_LBL={D:'Dead',L:'Live (floor)',Lr:'Roof live',S:'Snow',W:'Wind'};
  var KPA_PSF=20.885434;   /* 1 kPa = 1000 N/m2 x 0.0208854 psf per N/m2 */
  var WIND={
    roofUplift:{lbl:'Roof uplift (most negative MWFRS roof pressure)', short:'roof uplift', abs:false},
    roofDown:{lbl:'Roof downward (most positive MWFRS roof pressure)', short:'roof down', abs:false},
    wall:{lbl:'Wall, governing magnitude (applied as + in the beam\u2019s load plane)', short:'wall', abs:true},
    wallPressure:{lbl:'Wall, windward pressure (as published, + toward the wall)', short:'wall pressure', abs:false},
    wallSuction:{lbl:'Wall, leeward/side suction (as published, \u2212 away from the wall)', short:'wall suction', abs:false}
  };
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function f2(v,d){ return isNum(v) ? (Math.round(v*Math.pow(10,d==null?2:d))/Math.pow(10,d==null?2:d)).toString() : '\u2014'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  function when(iso){ var d=new Date(iso); if(isNaN(d)) return String(iso||'?');
    function p(n){ return (n<10?'0':'')+n; }
    return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())+' '+p(d.getHours())+':'+p(d.getMinutes()); }

  /* ---- validate a payload and convert it to psf; returns {err:[], warn:[], psf:{D,L,Lr,S}, wind:{key:psf}, seis} ---- */
  function check(p){
    var out={err:[],warn:[],psf:{},wind:{},seis:null};
    var e=BridgeXfer.validate(p,SCHEMA,MAXV); if(e){ out.err.push(e); return out; }
    var u=(p.units&&p.units.pressure)||'', k=null;
    if(u==='psf') k=1; else if(u==='kPa') k=KPA_PSF;
    else { out.err.push('Unknown pressure unit "'+u+'". Only psf (or kPa, converted at 1 kPa = '+KPA_PSF+' psf) is accepted.'); return out; }
    if(k!==1) out.warn.push('Pressures converted from kPa to psf (\u00D7 '+KPA_PSF+').');
    if(p.factored===true){ out.err.push('The payload says its values are factored. This tool imports nominal (unfactored) loads only.'); return out; }
    var a=p.areaLoads;
    if(!a || typeof a!=='object'){ out.err.push('The payload has no areaLoads.'); return out; }
    ['D','L','Lr','S'].forEach(function(t){
      var v=a[t]; if(v===null || v===undefined){ out.psf[t]=null; return; }
      if(!isNum(v)){ out.err.push(t+' is not a finite number ('+JSON.stringify(v)+').'); return; }
      if(v<0){ out.err.push(t+' = '+v+' psf is negative; a gravity area load must be \u2265 0.'); return; }
      out.psf[t]=v*k;
    });
    var W=a.W;
    if(W!==null && W!==undefined){
      if(typeof W!=='object') out.err.push('W is not an object.');
      else Object.keys(WIND).forEach(function(key){
        var v=W[key]; if(v===null || v===undefined) return;
        if(!isNum(v)){ out.err.push('W.'+key+' is not a finite number ('+JSON.stringify(v)+').'); return; }
        if(key==='wall' && v<0){ out.err.push('W.wall is a magnitude and must be \u2265 0 (got '+v+').'); return; }
        out.wind[key]=v*k;
      });
      if(isNum(out.wind.roofUplift) && out.wind.roofUplift>0) out.warn.push('W.roofUplift is positive ('+f2(out.wind.roofUplift)+' psf): no MWFRS case gives net uplift.');
    }
    var s=p.seismic;
    if(s && typeof s==='object'){
      ['SDS','SD1','Ie'].forEach(function(key){ var v=s[key]; if(v!==null && v!==undefined && (!isNum(v) || v<0)) out.err.push('seismic.'+key+' is not a non-negative number.'); });
      out.seis=s;
    }
    var any=['D','L','Lr','S'].some(function(t){ return isNum(out.psf[t]); }) || Object.keys(out.wind).length>0;
    if(!out.err.length && !any) out.err.push('The payload contains no area load that can be imported.');
    return out;
  }

  function caseUsed(id){ return S.combos.some(function(c){ return c.on!==false && (c.f[id]||0)!==0; }); }
  function caseExists(id){ return S.cases.some(function(c){ return c.id===id; }); }
  function defaults(chk){
    var tw=(S.trib && (S.trib.twL+S.trib.twR)>0) ? S.trib.twL+S.trib.twR : 10;
    var o={tw:tw, spans:'all', mode:'replace', wind:null, types:{}};
    o.wind=isNum(chk.wind.roofUplift)?'roofUplift':(isNum(chk.wind.wall)?'wall':(Object.keys(chk.wind)[0]||null));
    TYPES.forEach(function(t){
      var v=(t==='W') ? (o.wind?chk.wind[o.wind]:null) : chk.psf[t];
      var cs=DEF_CASE[t];
      var dbl=S.trib && S.trib.on && (S.trib.p[cs]||0)!==0;
      o.types[t]={on: isNum(v) && v!==0 && !dbl && caseUsed(cs), lc:cs};
    });
    return o;
  }
  /* ---- the import plan: exactly what will be removed and added. Pure apart from reading S. ---- */
  function plan(p,chk,o){
    var r={err:[],warn:[],remove:[],add:[],newCases:[],rows:[]};
    var tw=+o.tw;
    if(!isNum(tw) || tw<=0) r.err.push('Enter a tributary width greater than 0 ft.');
    else if(tw>200) r.err.push('Tributary width '+tw+' ft is outside the accepted range (0 to 200 ft).');
    var nsp=S.geom.spans.length, spans=null;
    if(o.spans!=='all'){
      spans=(o.spans||[]).filter(function(i){ return i>=0 && i<nsp; });
      if(!spans.length) r.err.push('Select at least one span.');
    }
    var sel=TYPES.filter(function(t){ return o.types[t] && o.types[t].on; });
    if(!sel.length) r.err.push('Select at least one load type to import.');
    var seenCase={};
    sel.forEach(function(t){
      var psf=(t==='W') ? (o.wind?chk.wind[o.wind]:null) : chk.psf[t];
      if(!isNum(psf)){ r.err.push(t+': no value in the hand-off.'); return; }
      var wdef=(t==='W')?WIND[o.wind]:null;
      var pUse=(wdef && wdef.abs) ? Math.abs(psf) : psf;
      var lc=String(o.types[t].lc||DEF_CASE[t]).toUpperCase().replace(/\W/g,'').slice(0,4);
      if(!lc){ r.err.push(t+': no target load case.'); return; }
      if(!caseExists(lc) && r.newCases.indexOf(lc)<0) r.newCases.push(lc);
      if(seenCase[lc]) r.warn.push(seenCase[lc]+' and '+t+' are both imported into case '+lc+'.');
      seenCase[lc]=t;
      if(caseExists(lc) && !caseUsed(lc)) r.warn.push('No active strength combination includes case '+lc+'; the imported '+t+' load has no effect on strength until you add a factor for '+lc+'.');
      if(!caseExists(lc)) r.warn.push('Case '+lc+' will be created. No combination includes it yet: add its factors (e.g. ASCE 7-16 Sec. 2.3.1: 1.6(Lr or S or R) in combination 3, 0.5(Lr or S or R) in 2 and 4) or the load has no effect.');
      if(S.trib && S.trib.on && (S.trib.p[lc]||0)!==0) r.warn.push('The Tributary Load Generator already applies '+S.trib.p[lc]+' psf to case '+lc+'. The imported '+t+' load acts in addition to it.');
      if(t==='W' && (o.wind==='wall'||o.wind==='wallPressure'||o.wind==='wallSuction')) r.warn.push('Wall wind is applied in this beam\u2019s load plane (the tool\u2019s + direction). Use it only for a member spanning horizontally against the wall (e.g. a girt) and set the bracing to match.');
      var w=pUse*tw/1000;
      r.rows.push({type:t,psf:psf,pUse:pUse,lc:lc,tw:tw,klf:w,wind:(t==='W')?o.wind:null});
      var nm='ASCE7 '+t+((t==='W')?' '+WIND[o.wind].short:'');
      var tag={ch:CH,type:t,psf:pUse,tw:tw,producer:p.producer||'',producedAt:p.producedAt||''};
      if(t==='W') tag.wind=o.wind;
      if(spans===null) r.add.push({nm:nm,type:'uniform',lc:lc,allSpans:true,mag:w,off:false,bx:tag});
      else spans.forEach(function(i){ r.add.push({nm:nm+' Sp'+(i+1),type:'uniform',lc:lc,allSpans:false,si:i,mag:w,off:false,bx:tag}); });
    });
    if(o.mode==='replace') S.loads.forEach(function(ld){ if(ld.bx && ld.bx.ch===CH && sel.indexOf(ld.bx.type)>=0) r.remove.push(ld); });
    if(p.info && p.info.snow && p.info.snow.drift && sel.indexOf('S')>=0)
      r.warn.push('The sender reports a snow drift (peak '+f2(p.info.snow.drift.peak)+' psf at '+p.info.snow.drift.location+'). It is NOT imported; add it as a trapezoidal load if this beam lies in the drift.');
    if(S.mode && S.mode!=='beam') r.warn.push('The tool is in '+S.mode+' mode. Imported loads are used in Beam mode only.');
    return r;
  }
  function apply(p,chk,o,via){
    var r=plan(p,chk,o); if(r.err.length) return r;
    r.newCases.forEach(function(id){ S.cases.push({id:id,name:id}); });
    var rm=r.remove;
    S.loads=S.loads.filter(function(ld){ return rm.indexOf(ld)<0; });
    r.add.forEach(function(ld){ var x=JSON.parse(JSON.stringify(ld)); x.id=newLoadId(); S.loads.push(x); });
    if(!S.bxSrc || typeof S.bxSrc!=='object') S.bxSrc={};
    S.bxSrc.buildingLoads={producer:p.producer||'',producerFile:p.producerFile||'',producedAt:p.producedAt||'',
      project:p.project||{name:'',bridgeId:''},code:p.code||'',via:via||'pull',adoptedAt:new Date().toISOString(),
      tw:+o.tw,spans:(o.spans==='all')?'all':o.spans.slice(),mode:o.mode,wind:o.wind,
      rows:r.rows.map(function(x){ return {type:x.type,psf:x.pUse,lc:x.lc,klf:x.klf,wind:x.wind}; }),
      notes:(p.notes||[]).slice(0,20)};
    BridgeXfer.markAdopted(CH,RID,p.producedAt);
    r.ok=true;
    return r;
  }

  /* ---- dialog ---- */
  function openDialog(p,via){
    var chk=check(p);
    if(chk.err.length){ alert('Building loads hand-off refused:\n  '+chk.err.join('\n  ')); return null; }
    var o=defaults(chk);
    var old=document.getElementById('bxBldOverlay'); if(old) old.remove();
    var ov=el('div'); ov.id='bxBldOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(15,25,40,.45);z-index:60;display:flex;align-items:center;justify-content:center';
    var box=el('div');
    box.style.cssText='background:#fff;border-radius:8px;padding:14px 18px;width:720px;max-width:96vw;max-height:88vh;overflow:auto;font-family:var(--font-ui);font-size:9pt;box-shadow:0 12px 40px rgba(0,0,0,.3)';
    ov.appendChild(box);
    box.appendChild(el('div',null,'<b style="font-size:11pt">Import building loads from '+esc(p.producer||'?')+'</b>'));
    box.appendChild(el('div','note','<b>Source:</b> '+esc(p.producer||'?')+(p.producerFile?' ('+esc(p.producerFile)+')':'')+
      ' &middot; <b>sent</b> '+esc(when(p.producedAt))+' &middot; <b>project</b> '+esc((p.project&&p.project.name)||'\u2014')+
      ' &middot; '+esc(p.code||'')+' &middot; nominal (unfactored) area loads'+(via==='file'?' &middot; from a JSON file':'')));
    if(chk.warn.length) box.appendChild(el('div','warnBox',chk.warn.map(esc).join('<br>')));
    if(p.notes && p.notes.length){
      var nb=el('details'); nb.appendChild(el('summary','hint','Sender notes ('+p.notes.length+') \u2014 read before importing'));
      nb.appendChild(el('div','note',p.notes.map(function(n){ return '&bull; '+esc(n); }).join('<br>'))); nb.open=true; box.appendChild(nb);
    }
    if(chk.seis) box.appendChild(el('div','hint','Seismic (information only, not imported): S<sub>DS</sub> = '+f2(chk.seis.SDS,3)+' g, S<sub>D1</sub> = '+f2(chk.seis.SD1,3)+' g, SDC '+esc(chk.seis.SDC||'\u2014')+', I<sub>e</sub> = '+f2(chk.seis.Ie)+'.'));
    /* tributary width and spans */
    var g=el('div'); g.style.cssText='display:flex;gap:16px;flex-wrap:wrap;align-items:center;margin:8px 0';
    var twl=el('label',null,'<b>Tributary width</b> TW = '); var twi=document.createElement('input'); twi.type='number'; twi.step='0.5'; twi.value=o.tw; twi.style.width='70px'; twi.id='bxBldTW';
    twl.appendChild(twi); twl.appendChild(document.createTextNode(' ft')); g.appendChild(twl);
    var sp=el('div'); sp.innerHTML='<b>Spans:</b> ';
    var ra=document.createElement('input'); ra.type='radio'; ra.name='bxBldSp'; ra.checked=true; ra.id='bxBldSpAll';
    var rs=document.createElement('input'); rs.type='radio'; rs.name='bxBldSp'; rs.id='bxBldSpSel';
    var la=el('label'); la.appendChild(ra); la.appendChild(document.createTextNode(' all (entire beam) '));
    var ls=el('label'); ls.appendChild(rs); ls.appendChild(document.createTextNode(' selected: '));
    sp.appendChild(la); sp.appendChild(ls);
    var spChk=S.geom.spans.map(function(s,i){ var c=document.createElement('input'); c.type='checkbox'; c.checked=true; c.dataset.si=i;
      var l=el('label'); l.appendChild(c); l.appendChild(document.createTextNode(' Sp'+(i+1)+' ('+f2(s.L)+' ft) ')); sp.appendChild(l); return c; });
    g.appendChild(sp); box.appendChild(g);
    box.appendChild(el('div','hint','Default TW is this beam\u2019s tributary width from the Tributary Load Generator (TW\u2097 + TW\u1D63). Line load w = p \u00D7 TW / 1000 (psf \u00D7 ft / 1000 = kip/ft).'));
    /* load-type table */
    var t=el('table','cfg'); t.style.margin='6px 0';
    t.innerHTML='<tr><th>Import</th><th>Type</th><th>p (psf)</th><th>Into case</th><th>Conversion w = p \u00D7 TW / 1000</th></tr>';
    var rowsUI={};
    TYPES.forEach(function(ty){
      var tr=el('tr');
      var cb=document.createElement('input'); cb.type='checkbox'; cb.checked=!!o.types[ty].on; cb.dataset.ty=ty;
      var td0=el('td'); td0.appendChild(cb); tr.appendChild(td0);
      var td1=el('td',null,'<b>'+ty+'</b> '+TYPE_LBL[ty]); tr.appendChild(td1);
      var td2=el('td'); tr.appendChild(td2);
      if(ty==='W'){
        var ws=document.createElement('select'); ws.id='bxBldWind';
        Object.keys(WIND).forEach(function(k){ if(!isNum(chk.wind[k])) return;
          var op=document.createElement('option'); op.value=k; op.textContent=WIND[k].lbl+': '+f2(chk.wind[k])+' psf'; ws.appendChild(op); });
        if(o.wind) ws.value=o.wind;
        if(!ws.options.length){ td2.textContent='not provided'; } else td2.appendChild(ws);
        rowsUI.windSel=ws;
      } else td2.textContent=isNum(chk.psf[ty]) ? f2(chk.psf[ty]) : 'not provided';
      var td3=el('td'); var cs=document.createElement('select'); cs.dataset.ty=ty;
      var ids=S.cases.map(function(c){ return c.id; }); if(ids.indexOf(DEF_CASE[ty])<0) ids.push(DEF_CASE[ty]);
      ids.forEach(function(id){ var op=document.createElement('option'); op.value=id; op.textContent=id+(caseExists(id)?'':' (new case)'); cs.appendChild(op); });
      cs.value=o.types[ty].lc; td3.appendChild(cs); tr.appendChild(td3);
      var td4=el('td'); tr.appendChild(td4);
      var avail=(ty==='W') ? (rowsUI.windSel && rowsUI.windSel.options.length>0) : isNum(chk.psf[ty]);
      if(!avail){ cb.checked=false; cb.disabled=true; cs.disabled=true; }
      rowsUI[ty]={cb:cb,cs:cs,conv:td4};
      t.appendChild(tr);
    });
    box.appendChild(t);
    /* mode */
    var md=el('div'); md.innerHTML='<b>Existing imported loads:</b> ';
    var mr=document.createElement('input'); mr.type='radio'; mr.name='bxBldMode'; mr.checked=true; mr.id='bxBldModeRep';
    var ma=document.createElement('input'); ma.type='radio'; ma.name='bxBldMode'; ma.id='bxBldModeAdd';
    var l1=el('label'); l1.appendChild(mr); l1.appendChild(document.createTextNode(' replace previously imported loads of the selected types '));
    var l2=el('label'); l2.appendChild(ma); l2.appendChild(document.createTextNode(' add (keep them)'));
    md.appendChild(l1); md.appendChild(l2); box.appendChild(md);
    box.appendChild(el('div','hint','Your own loads and the generated (trib / self-weight) loads are never removed. Only loads tagged as imported from this channel can be replaced.'));
    var sum=el('div'); sum.id='bxBldSummary'; box.appendChild(sum);
    var row=el('div','btnRow'); row.style.marginTop='10px';
    var go=el('button','btn primary','Import'); go.id='bxBldGo';
    var ca=el('button','btn','Cancel');
    row.appendChild(go); row.appendChild(ca); box.appendChild(row);

    function read(){
      o.tw=parseFloat(twi.value);
      o.spans=ra.checked ? 'all' : spChk.filter(function(c){ return c.checked; }).map(function(c){ return +c.dataset.si; });
      o.mode=mr.checked ? 'replace' : 'add';
      if(rowsUI.windSel && rowsUI.windSel.options.length) o.wind=rowsUI.windSel.value;
      TYPES.forEach(function(ty){ o.types[ty]={on:rowsUI[ty].cb.checked, lc:rowsUI[ty].cs.value}; });
      return o;
    }
    function refresh(){
      read();
      var r=plan(p,chk,o);
      TYPES.forEach(function(ty){
        var x=r.rows.filter(function(q){ return q.type===ty; })[0];
        var psf=(ty==='W') ? (o.wind?chk.wind[o.wind]:null) : chk.psf[ty];
        var pu=(ty==='W' && o.wind && WIND[o.wind].abs && isNum(psf)) ? Math.abs(psf) : psf;
        rowsUI[ty].conv.innerHTML=(isNum(pu) && isNum(o.tw)) ? (f2(pu)+' \u00D7 '+f2(o.tw)+' / 1000 = <b>'+f2(pu*o.tw/1000,4)+' kip/ft</b>'+(x?'':' <span class="hint">(not imported)</span>')) : '\u2014';
      });
      var h='';
      if(r.err.length) h+='<div class="errBox">'+r.err.map(esc).join('<br>')+'</div>';
      h+='<div class="note"><b>Will remove</b> ('+r.remove.length+'): '+(r.remove.length ? r.remove.map(function(ld){
          return esc(ld.nm)+' ['+esc(ld.lc)+', '+f2(ld.mag,4)+' kip/ft, '+(ld.allSpans?'all spans':'Sp'+((ld.si||0)+1))+']'; }).join('; ') : 'nothing')+
        '<br><b>Will add</b> ('+r.add.length+'): '+(r.add.length ? r.add.map(function(ld){
          return esc(ld.nm)+' ['+esc(ld.lc)+', '+f2(ld.mag,4)+' kip/ft, '+(ld.allSpans?'all spans':'Sp'+(ld.si+1))+']'; }).join('; ') : 'nothing')+
        (r.newCases.length ? '<br><b>New load cases:</b> '+r.newCases.map(esc).join(', ') : '')+
        '<br><b>Also recorded:</b> the source (producer and time) in this project, shown in the header, the Load Derivation tab and the printed report.</div>';
      if(r.warn.length) h+='<div class="warnBox">'+r.warn.map(esc).join('<br>')+'</div>';
      sum.innerHTML=h;
      go.disabled=!!r.err.length;
      return r;
    }
    box.addEventListener('input',refresh); box.addEventListener('change',refresh);
    ca.addEventListener('click',function(){ ov.remove(); });
    go.addEventListener('click',function(){
      var r=apply(p,chk,read(),via);
      if(r.err.length){ refresh(); return; }
      ov.remove();
      schedule(true);
      refreshBar();
      toast('Imported '+r.add.length+' load(s) from '+(p.producer||'hand-off'));
    });
    document.body.appendChild(ov);
    refresh();
    return {overlay:ov, opts:o, chk:chk, refresh:refresh};
  }

  /* ---- source line (header, Load Derivation tab, printed report) ---- */
  function sourceLine(){
    var s=S.bxSrc && S.bxSrc.buildingLoads; if(!s) return '';
    var n=S.loads.filter(function(ld){ return ld.bx && ld.bx.ch===CH; }).length;
    return 'Building loads from '+(s.producer||'?')+', '+when(s.producedAt)+((s.project&&s.project.name)?' ('+s.project.name+')':'')+
      (s.via==='file'?', via JSON file':'')+'; TW = '+f2(s.tw)+' ft'+(n?'':' \u2014 no imported loads remain in the load table');
  }
  function refreshBar(){
    var nd=document.getElementById('bxBldNew'); if(nd) nd.style.display=BridgeXfer.isNew(CH,RID)?'inline':'none';
    var sl=document.getElementById('bxBldSrc'); if(sl) sl.textContent=sourceLine();
  }
  window.bxPullBuildingLoads=function(){
    var r=BridgeXfer.read(CH,SCHEMA,MAXV);
    if(!r.ok){ alert('Pull from ASCE 7-16: '+r.error+(r.empty?'\n\nIn the ASCE 7-16 Load Generator, click "Send to other tools" first.':'')); return null; }
    return openDialog(r.payload,'pull');
  };
  window.bxImportBuildingLoads=function(ev){
    var f=ev && ev.target && ev.target.files && ev.target.files[0]; if(!f) return;
    BridgeXfer.importFile(f,SCHEMA,MAXV,function(r){
      if(!r.ok){ alert('Import hand-off: '+r.error); return; }
      openDialog(r.payload,'file');
    });
    ev.target.value='';
  };
  window.bxDeriveBuilding=function(pg){
    var s=S.bxSrc && S.bxSrc.buildingLoads;
    var lds=S.loads.filter(function(ld){ return ld.bx && ld.bx.ch===CH; });
    if(!s && !lds.length) return;
    mkSection('dvBxBld','Imported Building Loads (hand-off)',function(body){
      body.appendChild(el('div','note',esc(sourceLine())+'. Nominal (unfactored) ASCE 7-16 area loads converted to line loads with the tributary width entered at import: w = p\u00B7TW/1000. Load factors are applied by this tool\u2019s combinations.'));
      lds.forEach(function(ld){
        var b=ld.bx;
        body.appendChild(eqBlock({
          title:ld.nm+' \u2192 case '+ld.lc+(ld.allSpans?' (all spans)':' (span '+((ld.si||0)+1)+')')+(ld.off?' \u2014 switched off':''),
          lines:['w_{'+ld.lc+'} = \\frac{p\\,TW}{1000} = \\frac{'+f2(b.psf)+'\\times'+f2(b.tw)+'}{1000} = \\mathbf{'+f2(ld.mag,4)+'}\\ \\text{kip/ft}'],
          vars:[['p',f2(b.psf)+' psf',b.type+(b.wind?' ('+(WIND[b.wind]?WIND[b.wind].short:b.wind)+')':'')+', from '+(b.producer||'?')+', '+when(b.producedAt)],
                ['TW',f2(b.tw)+' ft','tributary width entered at import']]
        }));
      });
      if(s && s.notes && s.notes.length) body.appendChild(el('div','hint','Sender notes: '+s.notes.map(esc).join(' | ')));
    },pg);
  };
  window.bxSourceLine=sourceLine;
  window.bxBld={check:check,plan:plan,apply:apply,defaults:defaults,openDialog:openDialog,sourceLine:sourceLine,refreshBar:refreshBar};
  refreshBar();
  window.addEventListener('focus',refreshBar);
  window.addEventListener('storage',refreshBar);
  setInterval(refreshBar,2000);
})();
</script>
  ```
- **Saved data:** no existing key or format changed (`sbd_autosave_v1`, `sbd_projects_v1` keep their format). New optional fields: `S.bxSrc.buildingLoads` and `ld.bx` on imported loads; old projects without them load unchanged, and `mergeState` carries them through save/load/undo. New keys: only `bridgeSuite.v1.buildingLoads.adopted.steelbeam`.
- **Check case:** default ASCE7-16 project sent; Steel Beam default beam (one 20 ft simple span, W18X50), TW = 8 ft, S + W (roof uplift) + Lr → LR imported. S: 30 × 8 / 1000 = **0.240 kip/ft** → SL-only reaction = 0.240 × 20 / 2 = 2.40 kip (solver gives 2.400). W: −34.43 × 8 / 1000 = **−0.2754 kip/ft** (upward) → WL. Lr: 20 × 8 / 1000 = 0.160 kip/ft → new case LR (not in any combination until the user adds it).
- **How verified:** every plain inline script passes `node --check`. jsdom, shared localStorage stub: (1) no hand-off present → `AN` (V, M, reactions for every combination, service deflections, all DCRs) byte-identical to origin/main; (2) hand-off present but not pulled → identical again (no auto-apply), "new data available" shown; (3) Send (real ASCE7 code) → Pull → dialog defaults → Import: imported loads equal p × TW / 1000, user load and trib/self-weight loads kept, case LR created, `S.bxSrc` saved to `sbd_autosave_v1`, adoption marker written, indicator cleared, source shown in header, Load Derivation tab and printed report; (4) replace on span 2 only removes just the earlier imported S load, add keeps it, Cancel changes nothing, TW ≤ 0 or blank disables Import; (5) Export hand-off (JSON) → Import hand-off (JSON) in a fresh page applies the same values (`via:'file'`); (6) refused: wrong `_schema`, `schemaVersion:2`, corrupt stored JSON, non-numeric S, negative S, negative wall magnitude, unknown unit, `factored:true`, corrupt file, wrong-schema file; kPa converted (1 kPa → 20.885434 psf).
- **Other copies of this code:** none. BridgeXfer v1 (unchanged) is also in ASCE7-16 Load Generator.html and the other Step 1 tools.
- **Open items:** C&C (Ch. 30) pressures are not available from the sender and usually govern purlins/girts; snow drift and unbalanced snow are not imported (warning only); LR is not in the default combinations.

## 2026-10-05 — PR: claude/conn-steelbeam-reactions (PR link added after merge)
### C2. Member-reaction hand-off sender: "Send to other tools" and "Export hand-off (JSON)"   [feature: hand-off (no result change)]
- **Date / type:** 2026-10-05, feature: hand-off (no result change).
- **Where:** header `#projShare` row (anchor `onchange="bxImportBuildingLoads(event)">`, followed by `<span id="bxBldSrc"`); one new `<script>` block at the end of the file, just before `</body>` (anchor `Member-reaction hand-off sender`).
- **Purpose:** publishes channel `bridgeSuite.v1.memberReactions` (`_schema:"bridge-member-reactions"`, v1; HANDOFF.md §4.8) for BasePlateAnchorDesigner and Spread Footing. The dialog lets the user assign each load case to a load type and previews the reactions and notes before sending or exporting.
- **Mapping (what is sent):**

| HANDOFF field | Steel Beam source |
|---|---|
| `supports[].id`, `node`, `x`, `support` | node letter `NN[j]`, node index, `nodeXs()[j]` (ft), `S.geom.nodes[j].t`; free nodes are skipped |
| `supports[].byCase[c].V` | `solveFor({c:1}, Ix).R[j].v` (reaction on the beam, + up) = force of the beam on the support, + down |
| `supports[].byCase[c].M` | `−solveFor({c:1}, Ix).R[j].m` at fixed nodes (moment of the beam on the support, + CCW); 0 at pin/roller |
| `supports[].byLoadType[t]` | sum of `byCase` over the cases assigned to type t |
| `cases`, `caseMap` | `S.cases` with the type chosen in the dialog (default from id/name: DL→D, LL→L, LR→Lr, SL→S, WL→W, EL/EQ→E, else "other") |
| `member` | `S.section.label`, `S.section.grade`, span lengths |
| `project.name` | `S.proj.name` |

- **User choices:** the load type of each case (remembered in the new optional field `S.bxSend.memberReactions.caseType`). Cases with the same type are added (stated in `notes`); "other" cases go only to `byCase`.
- **Validation:** sends only in Beam mode with a solvable model (no blockers); every V and M must be finite.
- **Governing provision:** none changed. No formula, factor, unit or default changed; the sender only reads the existing solver (`computeAll()`, `solveFor()`).
- **Before / After** (exact; each anchor occurs once):
  1. Header buttons.
     - Before:
  ```html
      <button type="button" onclick="document.getElementById('bxBldFile').click()">Import hand-off (JSON)</button><input type="file" id="bxBldFile" accept=".json,application/json" style="display:none" onchange="bxImportBuildingLoads(event)">
      <span id="bxBldSrc" style="font-family:var(--font-ui);font-size:8pt;color:#C7D4E4;align-self:center"></span>
  ```
     - After:
  ```html
      <button type="button" onclick="document.getElementById('bxBldFile').click()">Import hand-off (JSON)</button><input type="file" id="bxBldFile" accept=".json,application/json" style="display:none" onchange="bxImportBuildingLoads(event)">
      <button type="button" onclick="bxSendMemberReactions('send')" title="Publish the unfactored support reactions by load type for the base plate and spread footing tools (HANDOFF.md, channel memberReactions)">Send to other tools</button>
      <button type="button" onclick="bxSendMemberReactions('export')" title="Save the same support-reaction hand-off as a JSON file">Export hand-off (JSON)</button>
      <span id="bxBldSrc" style="font-family:var(--font-ui);font-size:8pt;color:#C7D4E4;align-self:center"></span>
  ```
  2. New script, inserted just before `</body>` (Before: nothing). After:
  ```html
<script>
/* Member-reaction hand-off sender (HANDOFF.md §4.8, channel memberReactions; receivers: BasePlateAnchorDesigner.html,
   Spread Footing.html). "Send to other tools" / "Export hand-off (JSON)" open a small dialog where the user assigns each
   load case to a load type (D, L, Lr, S, W, E or "other"); the payload is then built from this tool's own stiffness
   solution of each load case ALONE (factor 1.0 on that case, 0 on every other case), i.e. unfactored reactions.
   Read-only with respect to the design: nothing here changes an input or a result. The case-to-type choice is kept
   in the new optional field S.bxSend.memberReactions. */
(function(){
  var CH='memberReactions', SCHEMA='bridge-member-reactions';
  var PRODUCER='Steel Beam Designer', FILE='Steel Beam Design - AISC 15th.html';
  var TYPES=['D','L','Lr','S','W','E'];
  var TYPE_LBL={D:'Dead',L:'Live',Lr:'Roof live',S:'Snow',W:'Wind',E:'Seismic'};
  function isNum(v){ return typeof v==='number' && isFinite(v); }
  function r6(v){ var r=Math.round(v*1e6)/1e6; return (r===0)?0:r; }   /* also turns -0 into 0 */
  function f2(v,d){ return isNum(v) ? v.toFixed(d==null?2:d) : '—'; }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c];}); }
  /* default load type of a case, from its id or name; null = "other" (sent only per case) */
  function guessType(cs){
    var id=String(cs.id||'').toUpperCase(), nm=String(cs.name||'').toLowerCase();
    var BY_ID={D:'D',DL:'D',DEAD:'D',L:'L',LL:'L',LIVE:'L',LR:'Lr',RL:'Lr',ROOF:'Lr',S:'S',SL:'S',SNOW:'S',W:'W',WL:'W',WIND:'W',E:'E',EL:'E',EQ:'E'};
    if(BY_ID[id]) return BY_ID[id];
    if(/^dead/.test(nm)) return 'D';
    if(/^roof\s*live/.test(nm)) return 'Lr';
    if(/^live/.test(nm)) return 'L';
    if(/^snow/.test(nm)) return 'S';
    if(/^wind/.test(nm)) return 'W';
    if(/^(seismic|earthquake)/.test(nm)) return 'E';
    return null;
  }
  function savedMap(){ return (S.bxSend && S.bxSend.memberReactions && S.bxSend.memberReactions.caseType) || {}; }
  function defaultMap(){
    var sv=savedMap(), m={};
    S.cases.forEach(function(cs){ m[cs.id]=Object.prototype.hasOwnProperty.call(sv,cs.id) ? sv[cs.id] : guessType(cs); });
    return m;
  }
  /* ---- build the payload from the current model. caseType: {caseId: 'D'|...|null}. Returns {err:[], payload} ---- */
  function build(caseType){
    var out={err:[],warn:[],payload:null};
    if(S.mode && S.mode!=='beam'){ out.err.push('The tool is in '+S.mode+' mode. Support reactions exist only in Beam mode (a solved beam model).'); return out; }
    var an=computeAll();
    if(!an || (an.blockers && an.blockers.length)){ out.err.push('The beam model cannot be solved: '+((an&&an.blockers)||['no analysis']).join(' ')); return out; }
    var Iin4=an.sect ? an.sect.Ix : 1, nX=nodeXs();
    var sup=[];
    S.geom.nodes.forEach(function(nd,j){ if(nd.t!=='free') sup.push(j); });
    var perCase={};
    S.cases.forEach(function(cs){
      var fac={}; fac[cs.id]=1;
      perCase[cs.id]=solveFor(fac,Iin4).R;
    });
    var used={};
    TYPES.forEach(function(t){ used[t]=S.cases.filter(function(cs){ return caseType[cs.id]===t; }).map(function(cs){ return cs.id; }); });
    var supports=sup.map(function(j){
      var fixed=S.geom.nodes[j].t==='fixed';
      var s={ id:NN[j], node:j, x:r6(nX[j]), support:S.geom.nodes[j].t, byLoadType:{}, byCase:{}, factored:false };
      S.cases.forEach(function(cs){
        var R=perCase[cs.id][j];
        /* R.v = support reaction on the beam, + up; the beam pushes on the support with the same magnitude, so V (+ down on the support) = R.v.
           R.m = reaction couple on the beam, + CCW; the beam exerts -R.m on the support (+ CCW). */
        var V=r6(R.v), M=fixed ? r6(-R.m) : 0;
        if(!isNum(V) || !isNum(M)) out.err.push('Case '+cs.id+' gives a non-finite reaction at support '+NN[j]+'.');
        s.byCase[cs.id]={ V:V, M:M, type:caseType[cs.id]||null, name:cs.name||cs.id };
      });
      TYPES.forEach(function(t){
        if(!used[t].length) return;
        var V=0, M=0; used[t].forEach(function(id){ V+=s.byCase[id].V; M+=s.byCase[id].M; });
        s.byLoadType[t]={ V:r6(V), M:r6(M) };
      });
      return s;
    });
    if(!supports.length) out.err.push('The beam has no supports.');
    var notes=[
      'Unfactored support reactions from Steel Beam Designer’s stiffness analysis of each load case alone (factor 1.0 on that case, 0 on all others). Load factors are applied by the receiving tool.',
      'Sign convention: V + = downward force exerted by the beam on the support (compression into a column or pedestal below); uplift is negative. M (fixed supports only) = moment exerted by the beam on the support, + = counter-clockwise in the beam elevation (x from support '+NN[sup[0]||0]+' toward the last support, y up). Pin and roller supports carry no moment (M = 0).',
      'Beam: '+S.geom.spans.length+' span(s) '+S.geom.spans.map(function(sp){ return f2(sp.L)+' ft'; }).join(' + ')+'; supports '+S.geom.nodes.map(function(n,j){ return NN[j]+' '+n.t; }).join(', ')+'; section '+(S.section.label||'?')+' '+(S.section.grade||'')+'.',
      (S.trib && S.trib.sw) ? 'Self-weight of the beam is included in case DL.' : 'Self-weight of the beam is NOT included (switched off in this tool).',
      'Loads switched off in the load table are excluded. Live load acts on all spans at once (no pattern loading).'
    ];
    TYPES.forEach(function(t){ if(used[t].length>1) notes.push(t+' = sum of cases '+used[t].join(' + ')+'.'); });
    var other=S.cases.filter(function(cs){ return !caseType[cs.id]; }).map(function(cs){ return cs.id; });
    if(other.length) notes.push('Case(s) '+other.join(', ')+' are not assigned to a load type; they are sent only under byCase.');
    var caseMap={}; S.cases.forEach(function(cs){ caseMap[cs.id]=caseType[cs.id]||null; });
    out.payload={
      _schema:SCHEMA, schemaVersion:1, producer:PRODUCER, producerFile:FILE,
      project:{ name:(S.proj&&S.proj.name)||'', bridgeId:'' },
      units:{ force:'kip', moment:'kip-ft', length:'ft' },
      factored:false,
      signConvention:'V: + = downward force of the beam on the support (beam pushing down); uplift negative. M: moment exerted by the beam on a fixed support, + = counter-clockwise in the beam elevation (x along the beam from the first support, y up); 0 at pin/roller supports.',
      member:{ section:S.section.label||'', grade:S.section.grade||'', spans:S.geom.spans.map(function(sp){ return sp.L; }), totalLength:r6(totalL()) },
      cases:S.cases.map(function(cs){ return { id:cs.id, name:cs.name||cs.id, type:caseType[cs.id]||null }; }),
      caseMap:caseMap,
      supports:supports,
      notes:notes
    };
    return out;
  }

  function openDialog(action){
    var old=document.getElementById('bxMrOverlay'); if(old) old.remove();
    if(S.mode && S.mode!=='beam'){ alert('Send support reactions: the tool is in '+S.mode+' mode. Support reactions exist only in Beam mode.'); return null; }
    var map=defaultMap();
    var ov=el('div'); ov.id='bxMrOverlay';
    ov.style.cssText='position:fixed;inset:0;background:rgba(15,25,40,.45);z-index:60;display:flex;align-items:center;justify-content:center';
    var box=el('div');
    box.style.cssText='background:#fff;border-radius:8px;padding:14px 18px;width:760px;max-width:96vw;max-height:88vh;overflow:auto;font-family:var(--font-ui);font-size:9pt;box-shadow:0 12px 40px rgba(0,0,0,.3)';
    ov.appendChild(box);
    box.appendChild(el('div',null,'<b style="font-size:11pt">'+(action==='export'?'Export':'Send')+' support reactions (unfactored, by load type)</b>'));
    box.appendChild(el('div','note','For the Base Plate &amp; Anchor Designer and the Spread Footing tool. Each case is analysed alone with factor 1.0. '+
      '<b>V + = downward on the support</b> (beam pushing down); uplift is negative. <b>M</b> (fixed supports only) = moment of the beam on the support, + counter-clockwise in the beam elevation.'));
    var t=el('table','cfg'); t.style.margin='6px 0';
    var ct=el('div');
    var res=el('div');
    var sels={};
    function drawCases(){
      ct.innerHTML='';
      var tb=el('table','cfg'); tb.innerHTML='<tr><th>Load case</th><th>Send as load type</th></tr>';
      S.cases.forEach(function(cs){
        var tr=el('tr'); tr.appendChild(el('td',null,'<b>'+esc(cs.id)+'</b> '+esc(cs.name||'')));
        var td=el('td'), s=document.createElement('select'); s.dataset.cs=cs.id;
        TYPES.concat(['']).forEach(function(ty){ var o=document.createElement('option'); o.value=ty; o.textContent=ty?ty+' — '+TYPE_LBL[ty]:'other (per case only)'; s.appendChild(o); });
        s.value=map[cs.id]||''; td.appendChild(s); tr.appendChild(td); tb.appendChild(tr); sels[cs.id]=s;
      });
      ct.appendChild(tb);
    }
    drawCases(); box.appendChild(ct);
    box.appendChild(el('div','hint','Cases given the same type are added together (e.g. a superimposed dead case with DL). Give pattern live-load cases the type "other" so they are not added.'));
    box.appendChild(res);
    var row=el('div','btnRow'); row.style.marginTop='10px';
    var go=el('button','btn primary',action==='export'?'Export hand-off (JSON)':'Send to other tools'); go.id='bxMrGo';
    var alt=el('button','btn',action==='export'?'Also send to other tools':'Also export JSON');
    var ca=el('button','btn','Cancel');
    row.appendChild(go); row.appendChild(alt); row.appendChild(ca); box.appendChild(row);
    var cur=null;
    function read(){ Object.keys(sels).forEach(function(id){ map[id]=sels[id].value||null; }); return map; }
    function refresh(){
      cur=build(read());
      var h='';
      if(cur.err.length) h+='<div class="errBox">'+cur.err.map(esc).join('<br>')+'</div>';
      if(cur.payload){
        var p=cur.payload, tys=TYPES.filter(function(ty){ return p.supports.length && p.supports[0].byLoadType[ty]; });
        var hasM=p.supports.some(function(s){ return s.support==='fixed'; });
        h+='<table class="cfg" style="margin:6px 0"><tr><th>Support</th><th>x (ft)</th><th>Type</th>'+tys.map(function(ty){ return '<th>'+ty+' V (kip)'+(hasM?'<br>M (kip·ft)':'')+'</th>'; }).join('')+'</tr>'+
          p.supports.map(function(s){ return '<tr><td>'+esc(s.id)+'</td><td>'+f2(s.x)+'</td><td>'+esc(s.support)+'</td>'+tys.map(function(ty){
            var r=s.byLoadType[ty]; return '<td>'+f2(r.V,3)+(hasM?'<br>'+(s.support==='fixed'?f2(r.M,3):'—'):'')+'</td>'; }).join('')+'</tr>'; }).join('')+'</table>';
        h+='<div class="hint">'+p.notes.map(esc).join('<br>')+'</div>';
      }
      res.innerHTML=h;
      go.disabled=alt.disabled=!!cur.err.length;
    }
    function remember(){
      if(!S.bxSend || typeof S.bxSend!=='object') S.bxSend={};
      var m={}; S.cases.forEach(function(cs){ m[cs.id]=map[cs.id]||null; });
      S.bxSend.memberReactions={ caseType:m };
      if(typeof autosave==='function') autosave();
    }
    function doSend(){
      var r=BridgeXfer.publish(CH,cur.payload,PRODUCER,FILE);
      if(!r.ok){ alert('Send to other tools: '+r.error); return null; }
      cur.payload=r.payload; return r;
    }
    function doExport(){
      var p=cur.payload; if(!p.producedAt){ var st=JSON.parse(JSON.stringify(p)); st.producedAt=new Date().toISOString(); if(!st.notes) st.notes=[]; p=st; }
      return BridgeXfer.exportFile(CH,p);
    }
    box.addEventListener('change',refresh);
    ca.addEventListener('click',function(){ ov.remove(); });
    go.addEventListener('click',function(){
      refresh(); if(cur.err.length) return; remember();
      if(action==='export'){ doExport(); ov.remove(); toast('Reaction hand-off exported'); }
      else if(doSend()){ ov.remove(); toast('Support reactions sent ('+cur.payload.supports.length+' supports)'); }
    });
    alt.addEventListener('click',function(){
      refresh(); if(cur.err.length) return; remember();
      if(action==='export'){ if(doSend()) toast('Support reactions sent'); }
      else { doExport(); toast('Reaction hand-off exported'); }
    });
    document.body.appendChild(ov);
    refresh();
    return { overlay:ov, map:map, refresh:refresh, current:function(){ return cur; } };
  }
  window.bxSendMemberReactions=openDialog;
  window.bxMr={ build:build, defaultMap:defaultMap, guessType:guessType, openDialog:openDialog };
})();
</script>
  ```
- **Saved data:** no existing key or format changed. New optional field `S.bxSend.memberReactions` (carried by `mergeState`). New keys: only `bridgeSuite.v1.memberReactions` and `.updatedAt` (HANDOFF.md §2).
- **Check case (hand check):** default Steel Beam project: one 20 ft simple span (pin–pin), W18X50 (50 plf), tributary DL 15 psf and LL 40 psf on TW = 5 + 5 = 10 ft, self-weight on. w_D = 15 × 10 / 1000 + 50 / 1000 = 0.200 kip/ft → R_D = wL/2 = 0.200 × 20 / 2 = **2.000 kip** at A and B (sent V = 2.000, + down). w_L = 40 × 10 / 1000 = 0.400 kip/ft → R_L = **4.000 kip**. S and W = 0 (0 psf). Fixed–fixed variant: M_end = wL²/12 = 0.200 × 400 / 12 = 6.667 kip·ft; sent M_A = −6.667 (beam on support, CW), M_B = +6.667 (solver: 6.6667, the tool's 240-strip distributed-load integration). Wind −20 psf: V = −0.2 × 20 / 2 = **−2.000 kip** (uplift).
- **How verified:** every plain inline script of the three files passes `node --check` (no JSX in these files). jsdom end-to-end test with one shared localStorage stub (56 assertions, all pass): the default Steel Beam project is sent through the real dialog (`bxSendMemberReactions('send')` → Send), then pulled in BasePlateAnchorDesigner and Spread Footing through their real dialogs and Import buttons; inputs asserted equal to the mapped values; export (`Export hand-off (JSON)` blob) re-imported through `Import hand-off (JSON)` in both receivers; wrong `_schema`, `schemaVersion: 2` (pull and file), `factored: true`, unit `kN`, non-finite V, no supports, and corrupt JSON are all refused with no change. No-result-change check: with no hand-off present, original (origin/main) and modified files give byte-identical results on the default state (Steel Beam `computeAll()` for the default beam and a 2-span pin/pin/fixed beam with wind and snow, plus the rendered tab text; BasePlate `allChecks()`, `generateCombos()` and the print report; Spread Footing `computeAll()`, `computePhase2()` and the print header).
- **Other copies of this code:** none. BridgeXfer v1 (unchanged, from Step 1) is reused.
- **Open items:** reactions are for each case as loaded (live load on all spans, no pattern loading); the sender adds cases of the same type, so pattern cases must be marked "other".

## 2026-10-09 — PR: claude/steel-beam-input-tabs (PR link added after merge)
### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date / type:** 2026-10-09, UI only (no result change). Requested by the engineer on 2026-10-08: "I want the input panel to be split up into different tabs. Similar to some of the more recent apps we've built." The pattern follows `Gusset Plate Rating.html` (tab strip at the top of the input sidebar, one pane per tab, collapsible cards inside), drawn in this tool's own style (the same button-tab look as the output `#tabBar`).
- **How it works:** `rebuildInputs()` still builds every input section into `#inputPanel` exactly as before. At its end, the new `sbdInputTabs(P)` **moves** the finished nodes into one pane per tab. Nothing is rebuilt, so every `data-fkey`, `data-secid`, event handler and bound value is unchanged, and the mode logic (`MSKIP`, `BEAM_HIDDEN`, `MEMBER_HIDDEN`, `BATCH_HIDDEN`, `extraInputSections`) still decides which sections exist. A tab whose pane is empty in the current mode is hidden. A section that is not in the map stays in the tab of the section before it.
- **Tabs (in order) and the sections in each** (`data-secid` in brackets):

| Tab | Beam mode | Member mode | Batch mode |
|---|---|---|---|
| Project | Mode selector, Engineering Assumptions (`inAssume`), Project Save / Load (`inProj`) | same | same |
| Batch | — (hidden) | — (hidden) | Batch Member Check (`inBatch`) |
| Geometry | Geometry & Supports (`inGeom`), Lateral Bracing & C_b (`inBrace2`), Compression Effective Lengths (`inComp`) | Lateral Bracing & C_b (`inBrace2`: member span, L_b, C_b), Compression Effective Lengths (`inComp`) | hidden |
| Section | Section & Material (`inSect`), Composite Action (`inComp2`), Web Stiffeners (`inStiff`) | same | hidden |
| Loads | Load Cases & Combinations (`inCombo`), Tributary Load Generator (`inTrib`), Applied Loads (`inLoads`), Manual Member Demands per Combination (`inMan`), Torsion (`inTor`) | Load Cases — Factored Demands (`inMember`), Beam Self-Weight (`inMemSW`), Torsion (`inTor`) | hidden |
| Checks | Concentrated Forces J10 (`inJ10`), Output Stations (`inOpts`) | Concentrated Forces J10 (`inJ10`), Deflection Check (`inMemDefl`) | hidden |

  (`inBrace` is always skipped by `MSKIP` in this file; it is mapped to Geometry in case it ever shows. `inDesign` exists only in a dead duplicate of `extraInputSections`, see O4; it is mapped to Checks.)
- **Error marker:** a red dot on a tab when one of its inputs needs attention: an `.errBox` inside one of its sections, a number field the browser cannot parse (`validity.badInput`), an analysis blocker that names one of its inputs (span length or mechanism → `inGeom`; member L_b → `inBrace2`; no load case → `inMember`; self-weight span → `inMemSW`; no batch members → `inBatch`), or a blocked composite check (`AN.comp.blocked` → `inComp2`). Refreshed after every rebuild and every recalculation.
- **Keyboard / accessibility:** `role="tablist"`, `role="tab"` with `aria-selected` and `aria-controls`, `role="tabpanel"` with `aria-labelledby`; roving `tabindex`; ←/→ (and ↑/↓), Home and End move between the visible tabs.
- **New storage key:** `sbd_inputTab_v1` (localStorage, plain string: `project`, `batch`, `geom`, `section`, `loads` or `checks`). It remembers the active input tab per browser. Every read and write is in try/catch, and an in-memory copy keeps the tab across rebuilds when storage is blocked. It is **not** stored in `S`, so the autosave (`sbd_autosave_v1`), saved projects (`sbd_projects_v1`), the project JSON export/import and the hand-offs are unchanged. No existing key or format changed.
- **Print:** unchanged. Print hides the whole `#app` (the print report is built separately in `#printReport`), so the input panel and its tab strip do not print, as before.
- **Narrow screens:** the tab strip wraps (`flex-wrap`); it is sticky at the top of the scrolling input panel. No horizontal page scroll at 400 px (document scroll width = 400).
- **Governing provision:** none (no engineering change).
- **Before / After** (exact; file uses CRLF, inserted lines use CRLF; every function edited is defined once in the file — `rebuildInputs`, `schedule`):
  1. CSS. Before (anchor, unchanged):
     ```css
     #inputPanel{flex:0 0 33%;max-width:460px;min-width:340px;overflow-y:auto;border-right:2px solid var(--line);background:var(--panel);padding:9px 10px 40px}
     ```
     After: the following lines inserted right after it (before `#outputPanel{`):
     ```css
     /* input panel tabs (sbdInputTabs) */
     #sbdInTabs{position:sticky;top:-9px;z-index:12;display:flex;flex-wrap:wrap;gap:2px;margin:-9px -10px 8px;padding:7px 10px 0;background:var(--panel);border-bottom:2px solid var(--accent)}
     #sbdInTabs .sbdInTab{display:inline-flex;align-items:center;font-family:var(--font-ui);font-size:9pt;padding:5px 10px;border:1px solid var(--line);border-bottom:none;background:var(--slate-100);color:#41546E;cursor:pointer;border-radius:5px 5px 0 0}
     #sbdInTabs .sbdInTab:hover{background:#EFF4FA}
     #sbdInTabs .sbdInTab[aria-selected="true"]{background:var(--accent);color:#fff;border-color:var(--accent);font-weight:600}
     #sbdInTabs .sbdInTab:focus-visible{outline:2px solid #BFD3F2;outline-offset:1px}
     .sbdInDot{display:none;width:7px;height:7px;border-radius:50%;background:var(--fail);margin-left:6px;box-shadow:0 0 0 1.5px #fff}
     .sbdInTab.has-err .sbdInDot{display:inline-block}
     .sbdInTab[hidden],.sbdInPane[hidden]{display:none!important}
     ```
  2. New functions inserted immediately before `function rebuildInputs(){` (anchor: the comment `/* ---------- input panel tabs (UI only) ----------`): constants `SBD_IN_TABS`, `SBD_IN_SEC`, `SBD_IN_BLOCK`, `SBD_IN_KEY`, and functions `sbdInTabGet`, `sbdInTabSet`, `sbdInputTabs`, `sbdSetInTab`, `sbdInTabKey`, `sbdInputTabMarks` (about 100 lines; copy the block from the file, from that comment down to the line before `function rebuildInputs(){`).
  3. End of `rebuildInputs()`. Before:
     ```js
       __secNum=numHold;
       restoreUI(st);
     }
     ```
     After:
     ```js
       __secNum=numHold;
       sbdInputTabs(P);   /* move the sections just built into the input tabs */
       restoreUI(st);
     }
     ```
  4. `schedule()`. Before:
     ```js
         renderTab();
         autosave();pushHist();
     ```
     After:
     ```js
         renderTab();
         sbdInputTabMarks();   /* refresh the input-tab error dots */
         autosave();pushHist();
     ```
- **Check case:** default project (W18X50, 20 ft simple span, trib 5 + 5 ft, DL 15 / LL 40 psf). Before and after: governing Flexure M_x DCR 0.116 (1.2DL + 1.6LL + 0.5SL, M_u = 44.00 kip-ft, φM_n = 378.75 kip-ft); Shear V_x DCR 0.046 (V_u = 8.80 kip, φV_n = 191.70 kip); Deflection L/240 DCR 0.093. Identical.
- **How verified** (Chromium 1194 headless via Playwright, the CDN libraries served from local copies of the same pinned versions):
  - `node --check` on all 5 inline scripts: pass.
  - 13 scenarios run in the original and the edited file: default; 2-span beam with point, uniform and trapezoidal loads, calculated C_b, stiffeners, J10 bearing lengths, open-section torsion and manual demands; composite with deck perpendicular, deck parallel (stud mode, haunch) and solid slab; member mode (self-weight, deflection, J10, tension case); member mode composite; member mode with a missing L_b (blocked); composite on an HSS (blocked); batch with 4 rows (one unknown shape, one composite); empty batch; HSS. For each: the full analysis object `AN` (JSON), the text of every output tab (16 in beam mode, 13 in member, 3 in batch; includes the Validation tab, i.e. every built-in example check), and the autosave JSON are **identical** before and after.
  - Input inventory (every `data-secid`, `data-fkey`, input/select/textarea/button in the panel): identical lists before and after in every scenario, and each element sits in exactly one tab pane (0 unplaced).
  - Save → Load round trip through the panel's own buttons: state identical; saved copy identical.
  - Hand-off: "Send to other tools" publishes the same `bridgeSuite.v1.memberReactions` payload (minus the timestamp) as before; all five hand-off functions present.
  - Interaction: active tab remembered across rebuilds (e.g. "+ Point"), page reload, and mode switches; keyboard navigation; a non-numeric span length puts a dot on Geometry and clears when fixed; with localStorage throwing, the tab still survives rebuilds; no console errors.
  - Screenshots of every tab in beam, member and batch modes at 1400 px and 400 px widths were checked.
- **Other copies of this code:** none.

### D1. Composite graphics show the slab, the metal deck in its real orientation, and the studs   [drawing only — no calculation change]
- **Date / type:** 2026-10-09, drawing only (no result change). Requested by the engineer on 2026-10-08: "When a composite beam is used, I want the graphics to show the slab as well, and the stay-in-place forms, if selected, should be shown in the correct orientation in the graphic."
- **What the tool already has (inputs used, none added):** composite on/off; deck orientation `S.composite.orient` (`perp` ribs perpendicular to the beam, `para` ribs parallel, `none` solid slab; input "Deck orientation"); rib height h_r (`hr`); average rib width w_r (`wr`); solid concrete above the deck (`tSolid`); haunch (`haunch`); rib fill counted in A_c (`ribFill`); studs: diameter (`dia`), studs per rib (`nRib`, perpendicular deck), length after welding (`studLen`), pitch (`pitch`). Rib spacing is **not** an input, and there is no actual slab-width input (only beam spacings and edge distances), so the drawings use the effective width b_eff and say so.
- **Graphics before:** (1) Beam Schematic (SVG elevation, Schematic tab): the bare beam only. (2) Composite Cross Section (Plotly, M_x tab, `compXsecFig`): slab, haunch and stress blocks, but the deck was a row of rectangles whose width was the counted fraction of rib concrete, with the same look for both orientations. (3) Bare steel cross sections (Schematic, Section, M_x, Compression tabs): unchanged, they show the steel properties.
- **Graphics after:**
  - **Composite Cross Section** (`compXsecFig`): ribs **parallel** to the beam: trapezoidal flutes cut by the section, one rib centred on the beam, deck sheet drawn as a line following the profile. Ribs **perpendicular**: the section is cut through a rib, so the rib concrete is full width, the deck sheet is the line at the bottom of the rib, and the deck high flute beyond the cut is dashed. Solid slab: plain slab. Headed studs drawn on the flange (studs per rib for perpendicular deck, else one; transverse spacing 4d, kept within the flange). The part of h_r counted in A_c is labelled (dotted line when 0 < fill < 1).
  - **New: Partial elevation along the beam** (`compElevFig`, about 4 ft, longitudinal section on the beam centre line, to scale): ribs **perpendicular**: trapezoidal rib profile along the beam with a stud in each rib; ribs **parallel**: cut along the rib over the beam, so the rib concrete is continuous, deck line at the rib bottom, high flute beyond dashed; solid slab: plain. Studs at the entered pitch (12 in, labelled illustrative, when none is entered). Dimensions: d, h_r, t, Y_con, rib spacing or stud pitch, w_r.
  - **New section on the Schematic tab: "Composite Slab and Deck"** (beam mode, composite on and not blocked): the composite cross section without stress blocks, PNA or a (`opts.geomOnly`) plus the partial elevation, and a one-line note of orientation, depths and b_eff.
  - **M_x tab, Composite Cross Section:** the partial elevation added under the existing section.
  - **Beam Schematic (SVG):** when composite is on, a slab band above the beam with the deck: perpendicular ribs drawn as small trapezoids at the illustrative spacing (a dashed line if the spacing is under 4 px), parallel ribs as a continuous band; label "Composite slab · deck ribs ⊥/∥ beam · slab and deck not to vertical scale". The load graphics are lifted 12 px so they sit on top of the slab band.
  - Each plot has a one-line note above it saying what the view shows for the entered orientation; the hint under the composite cross section now says the drawn width is b_eff and that the rib spacing is illustrative.
- **Drawing assumptions (stated on the drawings):** rib spacing p = max(6 in, 2w_r) rounded to 0.5 in, "illustrative"; each concrete rib is a trapezoid of average width w_r, w_r ± f/2 at top/bottom with f = min(0.8h_r, 0.9w_r, 0.9(p − w_r)); stud length = entered length, or h_r + 1.5 in (at least 4d, below the slab top) labelled "length illustrative"; stud head 1.6d wide, 0.375 in thick; the stud base is drawn at the top of the haunch, which is what the existing §I3.2c cover check assumes (cover = Y_con − haunch − L_s), see O9.
- **Governing provision:** none changed. The orientation shown follows AISC 360-16 §I3.2c (deck ribs perpendicular or parallel to the steel beam) as already implemented in the tool.
- **Before / After** (file uses CRLF, inserted lines use CRLF; every edited function is either defined once or the last (live) copy, see O4):
  1. New helpers inserted immediately before the banner `COMPOSITE CROSS SECTION  (Plotly, to scale)` (anchor `function deckDrawGeom(c){`): `deckDrawGeom`, `deckCentres`, `ribPoly`, `deckSheetPath`, `studShapes`, `studDrawLen`. Copy the block from the file.
  2. `compXsecFig` (defined once). Before:
     ```js
       /* --- deck ribs: draw the counted fraction solid, the rest as voids --- */
       if(hr>0){
         const wrIn=Math.max(1,c.wr||6);
         const pitch=wrIn*2;
         const n=Math.max(1,Math.round(beff/pitch));
         const fill=(c.orient==='perp')?(c.ribFill!=null?c.ribFill:0.5):
                    (c.orient==='para')?(c.ribFill!=null?c.ribFill:1.0):0;
         for(let i=0;i<n;i++){
           const x0=-beff/2+i*(beff/n),x1=x0+(beff/n)*Math.max(0.05,Math.min(1,fill));
           shapes.push({type:'rect',x0,x1,y0:ha,y1:ha+hr,fillcolor:CONC,opacity:.75,
             line:{color:CEDGE,width:0.8},layer:'below'});
         }
         shapes.push({type:'rect',x0:-beff/2,x1:beff/2,y0:ha,y1:ha+hr,fillcolor:'rgba(0,0,0,0)',
           line:{color:CEDGE,width:1.2,dash:'dot'}});
         anns.push({x:-beff/2,y:ha+hr/2,text:' deck ribs — '+fmt(100*fill,0)+'% counted',showarrow:false,
           xanchor:'left',font:{size:8.5,color:'#5A6B80'},bgcolor:'rgba(255,255,255,.8)'});
       }
     ```
     After: the block starting `/* --- metal deck, drawn in its real orientation (drawing only) ---` (parallel: `deckCentres` + `ribPoly` + `deckSheetPath`; perpendicular: full-width rib rectangle, deck line at `ha`, dashed line at `ha+hr`; label `A<sub>c</sub> counts …% of h<sub>r</sub> over b<sub>eff</sub>`). After the steel shape, new block `/* --- headed studs across the flange (drawing only) … */`. Also: `if(!opts.noStress){` → `if(!opts.noStress&&!opts.geomOnly){`; the PNA line and label wrapped in `if(!opts.geomOnly){ … }`; `dimV(Ycon-r.a,Ycon,…,'a = '…)` → `if(!opts.geomOnly)dimV(…'a = '…); else dimV(ha+hr,Ycon,…,'t = '…);`; the first hover item shows "Concrete slab, Y_con" when `geomOnly`. The fill fraction and every value read are the same expressions as before.
  3. New `compElevFig`, `deckViewNote` and `compElevBlock`, inserted before the **dead** first copy of `compXsecBlock` (anchor `function compElevFig(p,r,opts){`); each is defined once.
  4. Live (last) `compXsecBlock`: adds `body.appendChild(deckViewNote('x'));` before the plot. Hint before:
     ```js
     'Drawn to scale (equal x and y scales) from the resolved geometry. Red is the plastic compression block, blue the yielded tension zone, and the dash-dot line is the plastic neutral axis that produced Mₙ above. Deck ribs are drawn at the fraction of rib concrete counted in Aᶜ — the drawn rib pitch is indicative, not a deck profile.'
     ```
     After: "Drawn to scale … the drawn slab width is the effective width b_eff, not the full slab." + (unless `geomOnly`) the unchanged stress-block sentence + (if h_r > 0) "The metal deck is drawn in its entered orientation: … The drawn rib spacing is illustrative (not an input)." The dead first copy of `compXsecBlock` is not edited.
  5. `compositeFlexSections` (defined once), section `cpFig`: after `compXsecBlock(…)` add `compElevBlock(body,p,r,{id:'elevComp'});`.
  6. Live (last) `buildSchemTab`: new section `schComp` "Composite Slab and Deck" after `schXsec` (anchor `mkSection('schComp','Composite Slab and Deck'`), shown when `AN.comp&&!AN.comp.blocked&&AN.comp.ew`.
  7. `drawSchematic` (defined once): before `/* loads */`, new block `/* composite slab and deck above the beam … */` and `const nPreLoads=svg.childNodes.length;`; before `/* bracing annotation */`, the load nodes are moved into `<g transform="translate(0,-12)">` and the label is added, both only when composite is on.
- **Check case:** W21X50, A992, 30 ft simple span, trib 5 + 5 ft, composite with b_eff = 7.50 ft (90 in), h_r = 3 in, w_r = 6 in, t = 4.5 in, Y_con = 7.50 in, 60 % composite, studs ¾ in × 5 in, 2 per rib. Before and after: C = 441 kip, a = 1.44 in, PNA 0.450 in below the top of steel (M_x tab), identical. Drawing check: perpendicular ribs → full-width rib concrete in the cross section and a trapezoid every 12 in in the elevation (bottom width 4.8 in, top 7.2 in, average 6.0 in = w_r); parallel ribs → the same trapezoids across the cross section, one on the beam centre line (x = 0), and continuous rib concrete in the elevation.
- **How verified:** the same Chromium harness as T1, against the original file (main): `AN` (all results) and the autosave JSON identical in all 13 scenarios; save/load round trip and the reaction hand-off identical; output-tab text identical except the new notes and hints, the SVG titles of the slab band, and the section numbers after the new Schematic section (every decimal number in the M_x tab text is identical; the Schematic tab only gains the echoed slab depths and b_eff). `node --check` on all inline scripts. Screenshots of the Schematic tab (beam schematic, cross section, Composite Slab and Deck) and the M_x tab composite figures for non-composite, solid slab, deck perpendicular, deck parallel (with a 1 in haunch) and member-mode parallel deck were inspected: the orientations are as described above; the non-composite graphics are pixel-identical to before.
- **Other copies of this code:** none (the dead first `compXsecBlock` keeps its old hint; see O4).

## Open items (not changed)
- O1. **H3.3(c) buckling limit state** is not implemented, only warned (F5). Decide on the method (e.g. f_bx + σ_w ≤ φF_cr with F_cr = M_n/S_x from Chapter F, or a DG 9 interaction) before coding it as a check.
- O2. **Batch mode** has no H3.3 buckling warning and keeps its existing tension note. Decide whether to add a matching batch note.
- O3. **Axial tension (Chapter D / §H1.2)** is not implemented; it needs gross and net area, shear lag U, and the H1.2 interaction. Decide whether to add inputs for A_n and U.
- O4. **Duplicate function definitions** (`TABS` ×4, `renderTab`, `buildSummaryTab`, `shearMajor`, `compositeFor`, `constructionStage`, `buildMxTab`, `buildServiceTab`, `memberDefl`, `openTorsionFor`, `regPlot`, `xsecBlock`, `classFlexBlock`, …). Only the last definition runs. **Not cleaned up**, per instruction. F2 also updated the label in the dead earlier `classFlexBlock` (≈ line 3136) so the two copies do not disagree.
- O5. Calculated-C_b window clipped to the moment-sign region (lines ≈ 1817–1829). Not in scope; the default C_b = 1 is conservative.
- O6. The open-section torque is a single value applied to every strength combination (not scaled per combination). Not in scope.
- O7. **New localStorage key `sbd_inputTab_v1`** (T1, active input tab). The storage-key column of AUDIT.md still lists only `sbd_autosave_v1` and `sbd_projects_v1`; it was not edited in this PR (one tool per PR). Add the key to AUDIT.md in a later housekeeping PR.
- O8. **Rib concrete counted in A_c (defaults 0.50 perpendicular, 1.00 parallel).** Found while drawing D1; **not changed** (calculation). `slabArea` uses A_c = b_eff (t + fill·h_r). With parallel ribs and fill 1.00 this is the full b_eff × h_r rectangle, including the voids between the ribs (about half of it for w_r = 6 in at a 12 in rib spacing). My reading of AISC 360-16 §I3.2c is that concrete below the top of the deck is neglected in A_c for ribs perpendicular to the beam, and included for ribs parallel to the beam, where it is the rib concrete, not the voids. If so, both defaults can overstate A_c, and so C = 0.85f′_c A_c, when concrete crushing governs (the manual says the input only changes the answer then). Please confirm the provision and decide on the defaults; a parallel default of w_r / rib spacing would need a rib-spacing input.
- O9. **Stud base and the §I3.2c cover check with a haunch.** The cover check takes cover = Y_con − haunch − L_s, i.e. the stud starts at the top of the haunch; D1 draws it that way. If studs are welded to the flange through the haunch, the cover is over-estimated by the haunch depth. Not changed; confirm which is intended.
- O10. **Rib spacing is not an input.** The D1 drawings use an illustrative spacing max(6 in, 2w_r), labelled as such. Add an input only if the drawings need to show the real deck profile.
