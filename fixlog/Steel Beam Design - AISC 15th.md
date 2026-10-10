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

## 2026-10-09 — PR: claude/steel-beam-composite-ac (PR link added after merge)
Engineer's decisions of 2026-10-09 on open items O8 (rib concrete in A_c) and O9 (stud cover with a haunch).

### A1. Rib concrete in A_c follows §I3.2c: ribs perpendicular → neglected; ribs parallel → b_eff·h_r·w_r/s_r (new input s_r)   [calc change] [more conservative]
- **Where:** `slabArea` (defined once; anchor `function slabArea(cfg,beff){`) and `compositeMn` (defined once; anchor `const sa=slabArea(cfg,beff);out.sa=sa;`). Display and records: `compositeInputs` (new input after "Average rib width"; anchor `'Deck rib spacing  s\u1D63'`), the relabelled `ribFill` input (anchor `'Rib concrete in the wet-slab weight'`), the Excel composite block (anchor `X.line('Rib concrete counted in Ac'`), the user manual paragraph (anchor `The rib concrete in A\u1D9C follows \u00A7I3.2c`), `BATCH_HELP.cOr`, and the drawings (`deckDrawGeom`, `compXsecFig` A_c label, `deckViewNote`, `compElevBlock` / live `compXsecBlock` hints, `drawSchematic` deck title).
- **Problem:** A_c = b_eff (t + f·h_r) used a rib fraction f taken from the `ribFill` input, with blank defaults of 0.50 for ribs perpendicular to the beam and 1.00 for ribs parallel.
  - For perpendicular ribs, §I3.2c says the concrete below the top of the deck is neglected in A_c.
  - For parallel ribs, f = 1.00 counted the whole b_eff × h_r rectangle, voids included, instead of only the rib concrete.
  - Both overstate A_c, and so C′ = 0.85f′_c A_c, whenever concrete crushing governs C.
- **Governing provision:** AISC 360-16 §I3.2c, Formed Steel Deck:
  - ribs perpendicular to the steel beam: the concrete below the top of the steel deck is neglected in the composite section properties and in A_c;
  - ribs parallel: the concrete below the top of the deck is included in A_c.
  - The engineer's decision fixes the parallel rib area as b_eff·h_r·(w_r/s_r).
  - The effect carries through Commentary Eqs. C-I3-6 and C-I3-10 (C, a, PNA, M_n) and the Manual Part 3 lower-bound I_LB (Q_F = ΣQ_n/F_y and Y2 = Y_con − a/2).
- **What the old `ribFill` input does now:** saved as `S.composite.ribFill` (number or null; input key `cpFill`; label was "Rib concrete included in A_c").
  - It was used in two places: A_c (`slabArea`), and the construction-stage wet-concrete weight (`constructionStage`, t_eq = t + f·h_r + haunch, both copies).
  - It is **removed from the A_c path**, because §I3.2c now fixes the rule.
  - It is **kept for the wet-slab weight**, which is a load, not A_c, and is unchanged. The input is relabelled "Rib concrete in the wet-slab weight" and its tooltip now says it no longer affects A_c.
  - The stored field and its format are unchanged.
- **New input:** "Deck rib spacing s_r" (in, centre to centre), saved as the optional field `S.composite.sr`.
  - It is shown when there is a deck. It is not given a default, so projects without it save and load exactly as before (CLAUDE.md §5: additive, no migration needed).
  - Blanking the input deletes the field.
  - Ribs parallel and s_r blank or invalid (s_r ≤ 0, w_r ≤ 0 or w_r > s_r): the rib concrete is **not counted** (conservative). A warning appears in the inputs, in the composite warnings on the M_x tab, and in batch rows.
  - Ribs perpendicular: s_r is used only for the drawings.
  - The drawings use s_r when entered and drop the "illustrative" label.
- **Batch mode:** the template has no rib width or spacing columns. PERP rows now count no rib concrete. PARA rows count none either, with a per-row warning. The `cOr` help text says so. No template columns were added.
- **Before:**
  ```js
  function slabArea(cfg,beff){
    const g=slabGeom(cfg);
    const tAbove=g.tSolid;
    const fill=(cfg.orient==='perp')?(cfg.ribFill!=null?cfg.ribFill:0.5):
               (cfg.orient==='para')?(cfg.ribFill!=null?cfg.ribFill:1.0):0;
    const hr=g.hr;
    return{tAbove,hr,fill,haunch:g.haunch,Ycon:g.Ycon,Ac:beff*(tAbove+hr*fill),
      note:hr>0?('slab above deck '+fmt(tAbove,2)+' in plus '+fmt(100*fill,0)+'% of the '+fmt(hr,2)+' in ribs'):'solid slab'};
  }
  ```
- **After:**
  ```js
  function slabArea(cfg,beff){
    const g=slabGeom(cfg);
    const tAbove=g.tSolid;
    const hr=g.hr;
    /* AISC 360-16 Sec. I3.2c: ... */
    let fill=0,warn=null,note='solid slab';
    if(hr>0&&cfg.orient==='para'){
      const wr=cfg.wr,sr=cfg.sr;
      if(sr>0&&wr>0&&wr<=sr){ fill=wr/sr; note='... w\u1D63/s\u1D63 = ... (\u00A7I3.2c, ribs parallel)'; }
      else{ warn='Deck ribs parallel to the beam: enter the deck rib spacing s\u1D63 ... NOT counted in A\u1D9C ...'; note='...'; }
    }else if(hr>0)note='slab above deck ... only \u2014 the concrete below the top of the deck is neglected (\u00A7I3.2c, ribs perpendicular)';
    const out={tAbove,hr,fill,haunch:g.haunch,Ycon:g.Ycon,Ac:beff*(tAbove+hr*fill),note};
    if(warn)out.warn=warn;
    if(cfg.orient==='para'&&fill>0)out.sr=cfg.sr;
    return out;
  }
  ```
  (full text in the file), and in `compositeMn`, after `const sa=slabArea(cfg,beff);out.sa=sa;`:
  ```js
    if(sa.warn)out.warns.push(sa.warn);
  ```
- **Worked check cases.** Common data: W36X150, A992 (A_s = 44.3 in², F_y = 50 ksi, d = 35.9 in, b_f = 12.0 in, I_x = 9040 in⁴); simple span 30 ft; beam spacing 8 ft each side; b_eff = 2·min(L/8 = 3.75, s/2 = 4.0) = 7.50 ft = 90.0 in; f′_c = 4 ksi; t = 4.5 in above a 3 in deck (h_r = 3.0 in, w_r = 6.0 in); haunch 0; Y_con = 7.50 in; 100 % composite (C = C_max); A_sF_y = 2215 kip. Default trib loads (5 + 5 ft, DL 15 / LL 40 psf); construction stage super DL 15 psf, LL 50 psf. M_u = 112.5 kip-ft.
  - **(a) Ribs perpendicular.**
    - Before (f = 0.50): A_c = 90(4.5 + 0.5·3) = 540 in²; C′ = 0.85·4·540 = 1836 kip < 2215, so C = 1836 kip.
      - a = 1836/(0.85·4·90) = 6.00 in (> t, so the block-into-ribs warning was shown).
      - C_s = (2215 − 1836)/2 = 189.5 kip; x = 189.5/(12.0·50) = 0.316 in; d₁ = 7.50 − 3.00 = 4.50 in; d₂ = 0.158 in; d₃ = 17.95 in.
      - M_n = 1836(4.50 + 0.158) + 2215(17.95 − 0.158) = 47 961 kip-in; **φM_n = 3597.1 kip-ft**; DCR = 112.5/3597.1 = 0.0313.
      - I_LB = 19 159 in⁴; composite LL deflection 0.0164 in, DCR 0.0164.
    - After (f = 0): A_c = 90·4.5 = 405 in²; C′ = 0.85·4·405 = 1377 kip = C.
      - a = 1377/306 = 4.50 in (= t, no warning).
      - C_s = (2215 − 1377)/2 = 419 kip; x = 419/600 = 0.698 in; d₁ = 7.50 − 2.25 = 5.25 in; d₂ = 0.349 in.
      - M_n = 1377(5.25 + 0.349) + 2215(17.95 − 0.349) = 46 696 kip-in; **φM_n = 3502.2 kip-ft (−2.6 %)**; DCR 0.0321.
      - Q_F = 27.54 in², Y_ENA = 26.84 in, **I_LB = 18 181 in⁴ (−5.1 %)**; LL deflection 0.0173 in; total composite deflection DCR 0.0557 → 0.0565.
    - Governing check unchanged (pre-composite flexure, DCR 0.167).
  - **(b) Ribs parallel, s_r = 12 in.**
    - Before (f = 1.00): A_c = 90·7.5 = 675 in²; C′ = 2295 kip > A_sF_y, so C = 2215 kip (PNA in the slab).
      - a = 7.24 in; d₁ = 7.50 − 3.62 = 3.88 in.
      - M_n = 2215(3.881) + 2215(17.95) = 48 355 kip-in; **φM_n = 3626.6 kip-ft**; I_LB = 19 596 in⁴; LL deflection 0.0160 in.
    - After: w_r/s_r = 6/12 = 0.50; A_c = 90(4.5 + 3·0.50) = 540 in²; C′ = 1836 kip = C.
      - The rest is identical to (a) before: a = 6.00 in (the block-into-ribs warning remains, see O11).
      - **φM_n = 3597.1 kip-ft (−0.8 %)**; **I_LB = 19 159 in⁴**; LL deflection 0.0164 in.
    - Governing check unchanged.
  - **(c) Ribs parallel, s_r blank.**
    - Before: as (b) before.
    - After: f = 0 with the warning "enter the deck rib spacing s_r …"; A_c = 405 in², the same as (a) after: **φM_n = 3502.2 kip-ft (−3.4 %)**, I_LB = 18 181 in⁴, LL deflection 0.0173 in.
  - **Q_n / ΣQ_n:** unchanged. §I8.2a stud strength does not depend on A_c. In stud mode only C_max moves, and C = min(ΣQ_n, C_max).
  - **Construction stage:** unchanged; it still uses the `ribFill` weight fraction. For example, (a) t_eq = 4.5 + 0.5·3 = 6.0 in and w_slab = 0.725 kip/ft before and after.
- **Validation tab:**
  - All 25 composite checks, all 30 design-example checks, all 17 analysis benchmarks and all 4 torsion checks still pass; the Validation tab text is identical.
  - One test **input** was corrected, and no published reference value was changed. Design Example I.2 (W24X76 girder, 50 % composite) has the deck ribs parallel to the girder. The test had modelled it as "perpendicular, f = 0.50", which reproduced the published A_c = 540 in² only because 0.50 equals w_r/s_r = 6/12.
  - Under the new rule that old modelling would give A_c = 90·4.5 = 405 in² and 0.85f′_cA_c = 1377 kip. Those would fail the published 540 in² and 1840 kip rows. C = 560 kip, a, x, M_n and φM_n are unaffected because C_max = A_sF_y = 1120 kip.
  - The test now models I.2 as ribs parallel with w_r = 6 in and s_r = 12 in. It gives A_c = 90(4.5) + 90(3)(6/12) = 540 in² and 1836 kip, matching the published values.
  - Examples I.1 and III.1 (perpendicular deck) are unaffected because steel yielding governs C_max. The new rule's A_c for I.1 (120 × 4.5 = 540 in², 1836 kip) is the published I.1 value; that row is not a test.
  - The ENERCALC EC-5 agreement case (perpendicular, f = 5/12) is unaffected because steel governs.
- **Results that change in existing saved projects (intended):** any composite project with a metal deck where 0.85f′_cA_c governed C_max, or would govern after the change.
  - **Ribs perpendicular:** A_c drops by b_eff·h_r·f (f was 0.50 by default, or the entered `ribFill`).
  - **Ribs parallel:** A_c drops to b_eff(t + h_r w_r/s_r). If s_r is not entered (every existing project), it drops to b_eff·t with a warning until s_r is entered.
  - Where steel yielding governs C_max, nothing changes except C′ itself.
  - Solid slabs and non-composite projects: no change.
- **How verified:** same Chromium harness as T1/D1. The 12 regression scenarios plus 4 worked cases (16) were compared against main (926aeaf).
  - Non-composite, solid-slab composite, member, batch-empty and HSS scenarios: `AN`, all output text and the autosave JSON are identical.
  - Deck scenarios: only C′, A_c, the rib fraction, the notes and the new warning change, plus C, a, PNA, M_n, I_LB and deflections where concrete governs.
  - The autosave JSON is identical in all 16 (s_r is stored only when entered).
  - Save/load round trip and the reaction hand-off are identical.
  - An old project with a parallel deck and no s_r, restored from `sbd_autosave_v1`, loads with A_c = 405 in² and the warning.
  - `node --check` on all inline scripts.
- **Other copies of this code:** none (`slabArea` and `compositeMn` are defined once). Both copies of `constructionStage` keep the weight fraction unchanged.

### A2. Stud projection and cover measured from the top of the flange (stud welded to the flange, through the haunch)   [calc change] [more conservative where a haunch is used]
- **Where:** `compositeDetailing` (defined once; anchor `/* the stud is welded to the top of the flange and passes through any haunch and the deck */`); drawings `studDrawLen` and the `studShapes(\u2026)` calls in `compXsecFig` and `compElevFig` (stud base y = 0 instead of y = haunch).
- **Problem:** the checks took the stud as starting at the top of the haunch.
  - Projection check: L_s ≥ h_r + 1½ in.
  - Cover: Y_con − haunch − L_s.
  - The engineer confirmed the studs are welded to the beam flange. With a haunch the projection above the deck was therefore overstated by the haunch depth (unconservative), and the cover was understated.
- **Governing provision:** AISC 360-16 §I3.2c: studs extend at least 1½ in above the top of the steel deck, with at least ½ in of concrete cover above them. §I8.1, L ≥ 4d_sa, is unchanged.
- **Before:**
  ```js
        add('Stud length above deck','\u2265 h\u1D63 + 1\u00BD in = '+fmt(g.hr+1.5,2)+' in',fmt(Ls,2)+' in',Ls>=g.hr+1.5-1e-9,'\u00A7I3.2c');
        ...
        const cov=g.Ycon-g.haunch-Ls;
        add('Cover above stud','\u2265 \u00BD in',fmt(cov,2)+' in',cov>=0.5-1e-9,'\u00A7I3.2c');
  ```
- **After:**
  ```js
        const proj=Ls-g.haunch-g.hr;
        add('Stud projection above the '+(g.hr>0?'deck':(g.haunch>0?'haunch':'flange')),'\u2265 1\u00BD in',
          'L \u2212 haunch \u2212 h\u1D63 = '+...+' = '+fmt(proj,2)+' in',proj>=1.5-1e-9,'\u00A7I3.2c');
        ...
        const cov=g.Ycon-Ls;
        add('Cover above stud','\u2265 \u00BD in','Y\u1D9C\u2092\u2099 \u2212 L = '+...+' = '+fmt(cov,2)+' in',cov>=0.5-1e-9,'\u00A7I3.2c');
  ```
- **Worked check case (d):** W21X50, ribs perpendicular, haunch 1.0 in, h_r = 3.0 in, t = 4.5 in, so Y_con = 8.50 in; stud ¾ in × 5.00 in.
  - Before: 5.00 ≥ 3.00 + 1.50 = 4.50, **OK**; cover = 8.50 − 1.00 − 5.00 = 2.50 in, OK.
  - After: projection = 5.00 − 1.00 − 3.00 = **1.00 in < 1.50, NG**; cover = 8.50 − 5.00 = **3.50 in**, OK.
  - Without a haunch the numbers are unchanged, only shown as expressions. Example (a)–(c): projection 5.00 − 0 − 3.00 = 2.00 in (before: 5.00 ≥ 4.50), cover 7.50 − 5.00 = 2.50 in (unchanged).
  - With no deck and no haunch, projection = L_s, as before.
  - The detailing table is a requirement list on the M_x tab, not a D/C check, so the governing check and the D/C values are unchanged.
  - In the same case A1 also changes C′ = 0.85·4·90·4.5 = 1377 kip (was 1836). C = ΣQ_n = 20 × 21.54 = 430.7 kip and φM_n are unchanged, because the studs govern.
- **How verified:** as A1; screenshots of the detailing table and drawings in `scratchpad/sbdac/`.
- **Other copies of this code:** none.

## 2026-10-09 — PR: claude/steel-beam-rib-block (PR link added after merge)
Engineer's decision of 2026-10-09 on open item O11: compute the concrete compression block through the actual rib concrete.

### R1. Compression block below the top of the deck uses the rib concrete only (ribs parallel, s_r entered)   [calc change] [more conservative]
- **Where:**
  - `compositeMn` (defined once; anchor `/* compression block */`, followed by `let a=C/(0.85*fc*beff),d1=sa.Ycon-a/2;`).
  - Display: the M_x tab "Compression block and plastic neutral axis" equation block (anchor `block continues in the rib concrete`); the d₁ description; the Excel composite block (anchor `if(cmp.ribBlock){`); and the stress-block drawing in `compXsecFig` (anchor `slab part full width, rib part on the drawn ribs only`).
- **Problem:**
  - When C needs a depth a = C/(0.85f′_c b_eff) greater than the solid slab t above the deck, the tool kept a full-width rectangle of depth a and d₁ = Y_con − a/2, and warned "verify by hand".
  - With ribs parallel to the beam, the concrete below the top of the deck is only the rib concrete. The real block is deeper, its centroid is lower, and d₁ (so M_n) was overstated.
  - This can happen only with ribs parallel and s_r entered. With ribs perpendicular, or parallel with s_r blank, A_c = b_eff·t, so a ≤ t always. For a solid slab, h_r = 0.
- **Governing provision:**
  - AISC 360-16 §I3.2a(1), plastic stress distribution: a uniform 0.85f′_c stress on the concrete in compression, Commentary Fig. C-I3.3 and Eq. C-I3-10.
  - §I3.2c(3) as decided in A1: rib concrete b_eff·h_r·w_r/s_r.
  - Manual Part 3 I_LB with Y2 = d₁, the tool's existing definition.
- **Model:**
  - Full width b_eff over the depth t, then the rib width b_rib = b_eff·w_r/s_r for a depth y into the ribs, from 0.85f′_c(b_eff·t + b_rib·y) = C.
  - a = t + y, and d₁ = Y_con − ȳ, where ȳ is the centroid of the two-part block below the slab top.
  - The average rib width w_r is used as a rectangle. The trapezoidal rib shape is not an input; this is stated on the M_x tab.
  - y ≤ h_r always, because C ≤ 0.85f′_c A_c.
  - Everything that uses d₁ follows: M_n (C-I3-10) and Y2 for I_LB, then the composite deflections. The PNA in the steel (x, d₂) does not depend on the concrete block and is unchanged. When C = A_sF_y the PNA is the bottom of the block, a = t + y.
  - The "verify by hand" warning is removed for this case. It stays in the code for any other a > t case, which cannot occur at present.
- **Before:**
  ```js
    const a=C/(0.85*fc*beff);
    out.a=a;
    if(a>sa.tAbove+1e-9)out.warns.push('The compression block a = '+fmt(a,2)+
      ' in extends below the top of the deck (solid slab depth '+fmt(sa.tAbove,2)+
      ' in). The rectangular-block assumption is no longer exact; verify by hand.');
    out.Ycon=sa.Ycon;
    out.d1=out.Ycon-a/2;
  ```
- **After:**
  ```js
    let a=C/(0.85*fc*beff),d1=sa.Ycon-a/2;
    if(a>sa.tAbove+1e-9&&sa.hr>0&&sa.fill>0){
      /* ribs parallel with s_r entered: ... */
      const t=sa.tAbove,bRib=beff*sa.fill,Areq=C/(0.85*fc),Atop=beff*t;
      const y=Math.min(sa.hr,(Areq-Atop)/bRib),Arib=bRib*y;
      const ybar=(Atop*t/2+Arib*(t+y/2))/(Atop+Arib);
      out.ribBlock={t,bRib,Areq,Atop,y,Arib,ybar,aRect:a};
      a=t+y;
      d1=sa.Ycon-ybar;
    }else if(a>sa.tAbove+1e-9)out.warns.push('The compression block a = '+fmt(a,2)+
      ' in extends below the top of the deck (solid slab depth '+fmt(sa.tAbove,2)+
      ' in). The rectangular-block assumption is no longer exact; verify by hand.');
    out.a=a;
    out.Ycon=sa.Ycon;
    out.d1=d1;
  ```
  (`sa.fill` > 0 only for ribs parallel with a valid s_r, see A1.)
- **Worked check cases.** Common data: W36X150 A992 (A_s = 44.3 in², d = 35.9 in, d₃ = 17.95 in, A_sF_y = 2215 kip); 30 ft simple span; b_eff = 90 in; f′_c = 4 ksi; h_r = 3 in, w_r = 6 in, s_r = 12 in, so b_rib = 90·6/12 = 45 in; M_u = 112.5 kip-ft.
  - **(b) t = 4.5 in, Y_con = 7.5 in, 100 % composite:** A_c = 90(4.5 + 3·0.5) = 540 in²; C = 0.85·4·540 = 1836 kip (< 2215, concrete governs).
    - Rectangle: a = 1836/306 = 6.00 in > t.
    - Required block area = 1836/3.4 = 540 in²; slab part 90·4.5 = 405 in²; y = (540 − 405)/45 = **3.00 in** (the full rib depth); a = 7.50 in.
    - ȳ = (405·2.25 + 135·6.00)/540 = **3.1875 in**.
    - d₁: before 7.50 − 3.00 = 4.50 in → after 7.50 − 3.19 = **4.31 in**.
    - C_s = (2215 − 1836)/2 = 189.5 kip; x = 0.316 in; d₂ = 0.158 in (unchanged).
    - M_n = 1836(4.3125 + 0.158) + 2215(17.95 − 0.158) = 47 617 kip-in (before 47 961).
    - **φM_n = 3597.1 → 3571.3 kip-ft (−0.7 %)**; DCR M_x 0.0313 → 0.0315.
    - Y_ENA 28.12 → 28.04 in; **I_LB = 19 159 → 18 991 in⁴**; composite LL deflection 0.0164 → 0.0165 in; total composite deflection DCR 0.0641 → 0.0642.
    - Governing unchanged: pre-composite flexure, DCR 0.191.
    - Warning "verify by hand" → removed.
  - **(e) Thinner slab, part-way into the ribs: t = 2.5 in, Y_con = 5.5 in, 80 % composite.**
    - A_c = 90(2.5 + 1.5) = 360 in²; C_max = min(1224, 2215) = 1224 kip; C = 0.8·1224 = 979.2 kip.
    - Rectangle: a = 979.2/306 = 3.20 in > t.
    - Required area = 979.2/3.4 = 288.0 in²; slab part 225.0 in²; y = 63.0/45 = **1.40 in**; a = 3.90 in.
    - ȳ = (225·1.25 + 63·(2.5 + 0.7))/288 = **1.677 in**.
    - d₁: before 5.5 − 1.60 = 3.90 in → after 5.5 − 1.677 = **3.823 in**.
    - PNA in the web, x = 2.665 in, d₂ = 0.586 in (unchanged).
    - M_n 42 854 → 42 779 kip-in; **φM_n = 3214.0 → 3208.4 kip-ft (−0.2 %)**; DCR 0.0350 → 0.0351.
    - **I_LB = 15 524 → 15 478 in⁴**; LL deflection 0.0202 → 0.0203 in.
    - Governing unchanged: pre-composite flexure, DCR 0.159.
    - The PNA-in-web warning stays; "verify by hand" is removed.
  - **(f) a ≤ t, unchanged:** W21X50 (A_sF_y = 735 kip), t = 4.5 in, ribs parallel s_r = 12. C = 735 kip (steel governs); a = 735/306 = 2.40 in ≤ 4.5; d₁ = 7.5 − 1.20 = 6.30 in; φM_n = 920.5 kip-ft; I_LB = 3034 in⁴. Identical before and after.
  - Ribs perpendicular, ribs parallel without s_r, and solid slab: identical (A1 cases (a), (c); compSolid).
- **Validation tab:** all 17 benchmarks, 30 design-example, 25 composite and 4 torsion checks pass; the Validation tab text is identical. Design Example I.2 (parallel deck): a = 1.83 in ≤ t, so it is not affected.
- **How verified:** Chromium harness, 18 scenarios against main (1792a13): the 12 regression scenarios, A1 cases (a)–(d), and new cases (e) and (f).
  - Results (`AN`), output text and autosave are identical in every scenario except (b) and (e), where only a, d₁, M_n, φM_n, Y_ENA, I_LB, the composite deflections, the removed warning and the new derivation lines change.
  - Save/load round trip and the reaction hand-off are identical.
  - `node --check` on all inline scripts.
  - The Excel export lines were syntax-checked only; ExcelJS loads from a CDN that is blocked in the test environment.
  - Screenshots in `scratchpad/sbdrib/`.
- **Saved projects whose results change (intended):** composite with ribs parallel, s_r entered, and the block deeper than t (concrete crushing governs, or partial composite with a thin slab). Only possible since A1 added s_r.
- **Other copies of this code:** none.

## 2026-10-10 — PR: claude/steel-evalvm-fixed-end (PR link added after merge)
Engineer's decision of 2026-10-10: fix the end-of-beam boundary bug in `evalVM` found during the Timber rebuild, and any other place where the same boundary problem appears. Both functions edited below are defined once (see O4).

### E1. `evalVM` at x = L returns the value just left of the right end (fixed-end moment and end shear)   [calc change] [more conservative]
- **Where:** `evalVM` (defined once; anchor `function evalVM(X,R,fac){`, ≈ line 1156). Three conditions changed: the node loop (anchor `S.geom.nodes.forEach((_,j)=>{if(nX[j]<=X+1e-9)`), the point load (anchor `if(gx<=X+1e-9){V-=P;M-=P*(X-gx);}`) and the concentrated couple (anchor `if(gx<=X+1e-9)M-=ld.mag*fk;`).
- **Problem:**
  - `evalVM` sums everything at or to the left of X. At X = L that included the right-end reaction force and reaction couple, so the free body was the whole beam: **M(L) = 0 and V(L) = 0** for any support at the right end.
  - Fixed right end: the fixed-end moment was missing at the last station. The diagrams snapped back to 0 at x = L. The negative-moment peak, the governing M_u in the last region, M_max in the C_b calculation, and the envelopes only saw the last grid station, about L/240 short of the support. That is unconservative by about V·Δx.
  - Any supported right end: the end shear was missing at the last station. V_u came from the last grid station, short by w·Δx, unless the left end governed.
  - x = 0 was checked and is correct. The left reaction is part of the left free body, so V(0) = R_A and M(0) = −M_A for a fixed left end. A point load at x = 0 is also included, as the value just right of 0.
- **Governing provision:** statics only (internal V and M from the free body to the left of the section). No code provision, factor or unit changes. Downstream checks use AISC 360-16 Ch. F (M_u, C_b Eq. F1-1) and Ch. G (V_u) unchanged.
- **Before:**
  ```js
  function evalVM(X,R,fac){
    const nX=nodeXs(),sp=S.geom.spans;
    let V=0,M=0;
    S.geom.nodes.forEach((_,j)=>{if(nX[j]<=X+1e-9){V+=R[j].v;M+=R[j].v*(X-nX[j])-R[j].m;}});
    ...
        if(gx<=X+1e-9){V-=P;M-=P*(X-gx);}
    ...
        if(gx<=X+1e-9)M-=ld.mag*fk;
  ```
- **After** (comment above the function extended with three lines saying so):
  ```js
  function evalVM(X,R,fac){
    const nX=nodeXs(),sp=S.geom.spans;
    const xEnd=nX[nX.length-1],atEnd=X>=xEnd-1e-9;
    const inc=gx=>atEnd?gx<xEnd-1e-9:gx<=X+1e-9;
    let V=0,M=0;
    S.geom.nodes.forEach((_,j)=>{if(inc(nX[j])){V+=R[j].v;M+=R[j].v*(X-nX[j])-R[j].m;}});
    ...
        if(inc(gx)){V-=P;M-=P*(X-gx);}
    ...
        if(inc(gx))M-=ld.mag*fk;
  ```
  The distributed-load branches are unchanged (they are continuous at L).
- **Check case 1 (the reported example), unfactored:** fixed – pin – fixed, spans 10 + 10 ft, w = 75 plf = 0.075 klf on both spans.
  - By symmetry the interior support does not rotate, so each span is fixed-fixed: M_end = −wL²/12 = −0.075·10²/12 = **−0.625 kip-ft (−625 ft-lb)**; R = 0.375, 0.750, 0.375 kip.
  - Statics at x = 20 ft, left free body: 0.375·20 − 0.625 + 0.750·10 − 0.075·20²/2 = 7.5 − 0.625 + 7.5 − 15.0 = −0.625 kip-ft.
  - Tool: M(20) **0 → −0.625005 kip-ft**; V(20) **0 → −0.375 kip**. (The 0.0008 % excess is the existing 240-strip integration of the fixed-end forces.)
  - Note: the original request quoted −2187.5 ft-lb for this example. That figure was a mistake in the request (confirmed 2026-10-10); the correct value is −wL²/12 = −625 ft-lb.
- **Check case 2 (design), W12X26 A992, pin – fixed, L = 20 ft, C_b calculated, L_b,bot = 20 ft:** loads DL 1.0 + 0.15 + 0.026 (self weight) klf, LL 0.40 klf. Combination 1.2D + 1.6L: w_u = 1.2·1.176 + 1.6·0.40 = 2.0512 klf.
  - M_u at the fixed end = w_uL²/8 = 2.0512·400/8 = **102.56 kip-ft**. Before: 100.43 kip-ft (at x = 19.917 ft, the last grid station). After: 102.56 kip-ft at x = 20.
  - V_u = 5w_uL/8 = 25.64 kip. Before 25.47 kip (x = 19.917); after **25.64 kip** (x = 20).
  - C_b (Eq. F1-1) for the bottom-flange region 15.04 – 20 ft: M_A = 21.395, M_B = 45.299, M_C = 72.354 kip-ft (unchanged).
    - Before: 12.5·100.43/(2.5·100.43 + 3·21.395 + 4·45.299 + 3·72.354) = 1255.39/713.52 = 1.7594.
    - After: 12.5·102.56/(256.40 + 64.19 + 181.19 + 217.06) = 1282.01/718.84 = **1.7834**.
  - φM_n (LTB, L_b = 20 ft): 97.58 → 98.91 kip-ft (higher C_b).
  - **Flexure DCR 1.0292 → 1.0369** (governing; already failing). Shear DCR 0.3026 → 0.3046. H1-1b 1.0292 → 1.0369.
- **Validation tab (built-in benchmarks):** all 17 analysis, 30 design-example, 25 composite and 4 torsion checks still pass, and the tab text is identical. No benchmark evaluates M or V at x = L of a fixed end ("Two equal spans, M_support" uses x = 20 ft, the interior support of a 40 ft beam). Only one stored value moves, below display precision:
  - Fixed-fixed UDL δ_mid = wL⁴/384EI: 0.041377414 → 0.041376954 ft (exact 0.041379310; error −0.0046 % → −0.0057 %, tolerance 1.5 %). This comes from the deflection integration, which now uses the true M at x = L in its last interval. The published comparison is unchanged.
  - All other 16 benchmark values are bit-identical.
- **Outputs that change:** only for beams with a support (or a point load or couple) at the right end:
  - V and M diagrams (screen and print) end at the true values instead of 0.
  - The "V max / V min / M min" peak table and the strength envelopes.
  - Governing M_u, M_max in the C_b calculation and the unbraced-segment (worst-window) moments for the region touching the right end.
  - V_u, the H3.3 open-section stresses, and the interaction ratios that use them.
  - The "V = 0" list on the Analysis tab: the spurious entry at x = L that came from V(L) ≈ 0 is gone.
  - Deflections of beams with a fixed right end (integration of M/EI in the last interval). Free-left / fixed-right cantilever, tip P = 10 kip, L = 10 ft, I = 100 in⁴: δ_tip 0.16510 → 0.16552 ft (exact PL³/3EI = 0.16552 ft; error −0.25 % → −0.0001 %). In the harness the free-left cantilever (xCantR) moved +0.26 % (deflection DCR 1.3904 → 1.3942); all other cases moved by less than 0.01 %.
  - The station table's last row: V_r at x = L now shows the end shear (same as V_l), not 0. At x = 0 the V_l column already shows the start shear.
  - Ties: on a symmetric beam the end shear at x = L now equals the one at x = 0 exactly. Where the last digit is larger, the reported location of V_u (or of a tied M_min) moves from x = 0 to x = L. The values are unchanged.
- **How verified:** see E2.
- **Other copies of this code:** none in this file. `Shear and Moment Diagrams.html` and the Timber tool have their own solvers. Not checked or changed here (one tool per PR).

### E2. Station just left of each interior support   [calc change] [more conservative]
- **Where:** `stationList` (defined once; anchor `nX.forEach(add);` followed by `const EPS=1e-6;`, ≈ line 1197).
- **Problem:** the station at an interior node gives the value just right of the node. The left-side shear at an interior support (and the left-side moment at a fixed interior node, where M jumps by the reaction couple) was only seen at the previous grid station, Δx = L_total/240 or less away. This was unconservative by w·Δx (or V·Δx for the moment). Point loads and couples already had stations at x ± 10⁻⁶ ft; supports did not.
- **Governing provision:** statics only, as E1.
- **Before:**
  ```js
    nX.forEach(add);
    const EPS=1e-6;
  ```
- **After:**
  ```js
    nX.forEach(add);
    const EPS=1e-6;
    /* just left of each interior node: ... */
    nX.slice(1,-1).forEach(x=>add(x-EPS));
  ```
- **Check case:** W12X26, pin – fixed – pin, spans 10 + 10 ft, DL 1.0 + 0.15 + 0.026 klf, LL 0.40 klf, plus a 5 kip DL point load at 4 ft in span 1. Combination 1.2D + 1.6L:
  - Left-side values at the interior fixed support (x = 10 ft): V = −16.228 kip, M = −35.720 kip-ft (M jumps at the node by the reaction couple).
  - Before: V_u = 16.057 kip and M_u = 35.121 kip-ft (x = 9.917/9.963 ft). After: **V_u = 16.228 kip, M_u = 35.720 kip-ft** at x = 10 ft (shown as 10.00; the station is at 9.999999 ft).
  - Flexure DCR 0.2518 → 0.2561; shear DCR 0.1907 → 0.1928.
  - Two equal spans with pinned supports: M is continuous, so only the V diagram changes (now a vertical jump). On a symmetric beam V_u is unchanged.
- **How verified (E1 + E2):**
  - Reproduced on main (281c438) in headless Chromium by calling `solveFor` and `evalVM` directly: M(20) = 0 for the reported example, and the same for fixed-fixed, pin-fixed and free-fixed beams.
  - Chromium harness, 27 scenarios, main against branch: the 12 regression scenarios from the earlier Steel Beam PRs, the 6 composite cases (A1/R1 a–f), and 9 new boundary cases. The new cases are fixed-pin-fixed (the reported example), fixed-fixed, pin-fixed, fixed-pin, free-fixed and fixed-free cantilevers, 2-span pinned, pin-fixed-pin with a point load, and a simple span with a point load over the right support.
    - Member mode (3 scenarios) and batch mode (2 scenarios): `AN`, every tab's text and autosave are identical.
    - Beam mode: the only differences are the ones listed in E1 and E2. For pinned right ends: V at the last station, the V_u location on ties, the spurious "V = 0 at x = L" entry, and V min on the Analysis tab (it now shows the exact end shear, e.g. −2.800 instead of −2.777 kip in the default project). φM_n, φV_n, and all flexure, deflection, J10 and composite results are identical when there is no fixed right end, no fixed interior node and no point load at the right end.
    - Save/load round trip, autosave, the input panel and the member-reaction hand-off payload are identical. No console errors.
  - Screenshots of the V and M diagrams, before and after, in `scratchpad/followups/steel-evalvm/`.
  - `node --check` on all 5 inline scripts.
- **Saved projects whose results change (intended):** beams with a fixed right end (M_u, C_b, V_u, envelopes, small deflection change), any supported right end where the right reaction governs V_u (V_u up by about w·L/240), and continuous beams where the left-side shear at an interior support governs, or with a fixed interior node.
- **Other copies of this code:** none.

### E3. Round HSS / pipe shear length L_v measured to the point of zero shear within the span   [calc change] [more conservative or equal]
Engineer's decision 2026-10-10 on O13 (closes O13). The rule for point loads was corrected the same day to the usual reading of §G5: a point load whose jump crosses V = 0 is the point of zero shear.
- **Where:**
  - New function `lvFor(cb,A)`, inserted just above the anchor `/* ---------- master design pass ---------- */`.
  - Its one caller is in `designAll` (defined once), in the shear branch for `p._kind==='P'`.
  - `shearMajor` is unchanged (live copy ≈ line 5223, see O4).
- **Problem:**
  - L_v was the distance from the V_u station to the nearest entry of the "V = 0" list (`cb.zV`).
  - That list contains every sign change between neighbouring stations, including the sign change across the shear jump at a support.
  - When V_u was at an interior support, the nearest "zero" was the jump at that same support:
    - on main, L_v came out as one grid step (≈ 0.08 ft for 2 × 20 ft), the least conservative value;
    - after E2, L_v could be exactly 0. `shearMajor` reads 0 as "none" (`LvIn||1e9`), so the derivation printed L_v = 83 333 300 ft.
- **Governing provision:** AISC 360-16 §G5, Eq. G5-2a: F_cr = 1.60E / (√(L_v/D)·(D/t)^5/4). L_v is the distance from the location of maximum shear to the location of zero shear. G5-2b and the 0.6F_y cap are unchanged.
- **Rule now used (`lvFor`):**
  1. Start at the max-|V| station. This is the same station as V_u (the first maximum, as `absPk` picks it).
  2. Search along the span in the direction of decreasing |V|.
  3. L_v is the distance to the first point of zero shear:
     - a zero of the continuous shear diagram (linear interpolation between stations), or
     - a point load whose jump crosses V = 0. The load point is then the zero, as for a midspan point load on a simple span.
  4. A point-load jump that does not cross zero is stepped over.
  5. A point-load jump within 10⁻⁴ ft of the start station is not counted.
  6. Support jumps never count as a zero. The search stops at the supports bounding the span, or at a beam end.
  7. **Fallback (conservative):** if no zero is found before the span end, L_v is the distance to that span end. A longer L_v gives a lower G5-2a.
  8. If |V| is level both ways, both directions are searched and the longer result is used.
  9. A non-positive result falls back to the span length. So L_v is never 0, and beam mode never passes the 10⁹ in default.
- **Before:**
  ```js
      let Lv=A.L;cb.zV.forEach(z=>{Lv=Math.min(Lv,Math.abs(z-cb.Vabs.x));});
      C.shearX=shearMajor(p,Lv*12,S.design.stiff);
  ```
- **After:**
  ```js
      const Lv=lvFor(cb,A);
      C.shearX=shearMajor(p,Lv*12,S.design.stiff);
  ```
  plus the new `lvFor` (≈ 50 lines; its header comment states the rule above).
- **When L_v changes F_cr.** F_cr = min(0.6F_y, max(G5-2a, G5-2b)), and only G5-2a depends on L_v. So L_v can change F_cr only when G5-2b < 0.6F_y.
  - In the tool's catalog that is only **HSS26.000X0.313**: D/t = 89.35 with A500 Gr. C (F_y = 46), and D/t = 83.07 with A1085 (F_y = 50).
  - Every other round HSS and pipe has G5-2b ≥ 0.6F_y, so F_cr = 0.6F_y whatever L_v is.
  - For HSS26.000X0.313 A500C, G5-2a drops below 0.6F_y = 27.6 ksi only when L_v > 81.2 ft. It reaches the G5-2b floor (26.78 ksi) at L_v = 86.2 ft.
- **Check case 1 (F_cr changes): HSS26.000X0.313 A500C, two spans 2 × 150 ft, pins, UDL (0.2 klf DL plus default project loads).**
  - 1.2D + 1.6L gives V_u = 109.03 kip at the interior support.
  - L_v: main **0.629 ft** (the support jump, interpolated within one grid step) → branch **93.75 ft**. Hand: the in-span zero is at 0.375·150 = 56.25 ft from the end support, so L_v = 0.625·150 = 93.75 ft.
  - Section: D = 26 in, D/t = 89.35, (D/t)^1.25 = 274.6, (D/t)^1.5 = 844.6, A = 23.5 in².
  - G5-2b = 0.78·29 000/844.6 = 26.78 ksi (both).
  - Main: G5-2a = 313.5 ksi, so F_cr = 0.6F_y = 27.60 ksi.
  - Branch: L_v = 1125 in, √(1125/26) = 6.578, so G5-2a = 46 400/(6.578·274.6) = 25.68 ksi, and F_cr = min(27.6, max(25.68, 26.78)) = **26.78 ksi**.
  - φV_n = 0.9·F_cr·A/2: **291.87 → 283.24 kip** (−3.0 %). Shear DCR 0.3736 → 0.3849.
- **Check case 2 (L_v changes, F_cr does not): Pipe8XS A53B, 2 × 20 ft, pins, UDL.**
  - 1.2D + 1.6L gives V_u = 25.90 kip just right of the interior support.
  - L_v: main **0.0839 ft** → branch **12.50 ft** (0.625·20).
  - Section: D/t = 18.55, (D/t)^1.25 = 38.48, (D/t)^1.5 = 79.9.
  - G5-2a: main 3528 ksi; branch √(150/8.625) = 4.170, so 46 400/(4.170·38.48) = **289.0 ksi**.
  - G5-2b = 283.2 ksi.
  - F_cr = min(0.6·35 = 21.0, …) = **21.0 ksi both**. φV_n = 112.46 kip both; DCR 0.2303 both.
  - HSS26.000X0.313 on the same 2 × 20 ft: L_v 0.0839 → 12.5 ft, G5-2a 858 → 70.3 ksi, F_cr 27.6 ksi both.
- **Check case 3 (point load, no change vs main): HSS26.000X0.313 A500C, simple span 100 ft, 20 kip DL at midspan.**
  - V_u = 58.15 kip.
  - L_v = **50 ft on main and on the branch**: the jump at the load crosses zero, so the load point is the zero.
  - G5-2a = 46 400/(√(600/26)·274.6) = 46 400/(4.804·274.6) = 35.17 ksi, so F_cr = 27.60 ksi and φV_n = 291.87 kip (both).
- **Other cases checked (Pipe8XS unless noted), L_v main → branch, F_cr unchanged in all:**
  - simple span UDL: 10 → 10 ft;
  - fixed-fixed: 10 → 10 ft;
  - pin-fixed: 12.42 (0.083 for two combinations) → 12.5 ft;
  - fixed-free cantilever with a tip load: 10 → 10 ft;
  - simple span with a point load at midspan: 10 → 10 ft;
  - simple span with a point load at L/4: 5 → 5 ft (1.4D), 6.98 → 6.98 ft (1.2D + 1.6L);
  - 3 spans 15 + 20 + 15 ft with a point load: 0.12 → 8.77 ft;
  - HSS26.000X0.313, 100 ft UDL: 50 → 50 ft.
  - So L_v changes only where main picked up a support jump.
- **Validation tab:** no benchmark uses §G5 (the design examples cover F2, F7, F8, G2, G4, H3 and E3). All 17 + 30 + 25 + 4 checks pass, and the tab text is identical to main.
- **How verified:**
  - The 27-scenario harness (as in E2) gives results identical to the E1 + E2 commit in every scenario, because none of them uses a round section. So main vs branch differs only as listed in E1 and E2.
  - The 12 round-section cases above were run on main, on E1 + E2, and on the final branch. The V_x tab text was checked for the "83 333 300 ft" value: it appears with E1 + E2 alone (3 cases), never on main or on the branch.
  - `node --check` on all inline scripts; no console errors.
- **Not changed:**
  - Member mode still uses the entered L_v, with its existing default of 10⁸ ft when blank (`S.member.Lv!=null?S.member.Lv:1e8`).
  - Batch mode uses L_x.
  - The "V = 0 (moment extrema / Lᵥ stations)" list on the Analysis tab still shows `zV`, which now feeds the C_b sampling only.
- **Saved projects whose results change:** round HSS or pipe in beam mode with V_u at an interior support, or at a fixed end next to a support jump. F_cr changes only for HSS26.000X0.313 when the in-span L_v exceeds about 81 ft (A500C) or about 82 ft (A1085).
- **Other copies of this code:** none.

## Open items (not changed)
- O1. **H3.3(c) buckling limit state** is not implemented, only warned (F5). Decide on the method (e.g. f_bx + σ_w ≤ φF_cr with F_cr = M_n/S_x from Chapter F, or a DG 9 interaction) before coding it as a check.
- O2. **Batch mode** has no H3.3 buckling warning and keeps its existing tension note. Decide whether to add a matching batch note.
- O3. **Axial tension (Chapter D / §H1.2)** is not implemented; it needs gross and net area, shear lag U, and the H1.2 interaction. Decide whether to add inputs for A_n and U.
- O4. **Duplicate function definitions** (`TABS` ×4, `renderTab`, `buildSummaryTab`, `shearMajor`, `compositeFor`, `constructionStage`, `buildMxTab`, `buildServiceTab`, `memberDefl`, `openTorsionFor`, `regPlot`, `xsecBlock`, `classFlexBlock`, …). Only the last definition runs. **Not cleaned up**, per instruction. F2 also updated the label in the dead earlier `classFlexBlock` (≈ line 3136) so the two copies do not disagree.
- O5. Calculated-C_b window clipped to the moment-sign region (lines ≈ 1817–1829). Not in scope; the default C_b = 1 is conservative.
- O6. The open-section torque is a single value applied to every strength combination (not scaled per combination). Not in scope.
- O7. **New localStorage key `sbd_inputTab_v1`** (T1, active input tab). The storage-key column of AUDIT.md still lists only `sbd_autosave_v1` and `sbd_projects_v1`; it was not edited in this PR (one tool per PR). Add the key to AUDIT.md in a later housekeeping PR.
- O8. **Resolved 2026-10-09 by A1** (engineer's decision: perpendicular → 0 %, parallel → w_r/s_r with a new s_r input). **Rib concrete counted in A_c (defaults 0.50 perpendicular, 1.00 parallel).** Found while drawing D1; **not changed** (calculation). `slabArea` uses A_c = b_eff (t + fill·h_r). With parallel ribs and fill 1.00 this is the full b_eff × h_r rectangle, including the voids between the ribs (about half of it for w_r = 6 in at a 12 in rib spacing). My reading of AISC 360-16 §I3.2c is that concrete below the top of the deck is neglected in A_c for ribs perpendicular to the beam, and included for ribs parallel to the beam, where it is the rib concrete, not the voids. If so, both defaults can overstate A_c, and so C = 0.85f′_c A_c, when concrete crushing governs (the manual says the input only changes the answer then). Please confirm the provision and decide on the defaults; a parallel default of w_r / rib spacing would need a rib-spacing input.
- O9. **Resolved 2026-10-09 by A2** (studs are welded to the flange). **Stud base and the §I3.2c cover check with a haunch.** The cover check takes cover = Y_con − haunch − L_s, i.e. the stud starts at the top of the haunch; D1 draws it that way. If studs are welded to the flange through the haunch, the cover is over-estimated by the haunch depth. Not changed; confirm which is intended.
- O10. **Resolved 2026-10-09 by A1** (s_r is now an input; drawings use it). **Rib spacing is not an input.** The D1 drawings use an illustrative spacing max(6 in, 2w_r), labelled as such. Add an input only if the drawings need to show the real deck profile.
- O11. **Resolved 2026-10-09 by R1** (block computed through the rib concrete). **Compression block in the ribs with parallel deck.** When a > t (C reaches into the ribs), the tool keeps a uniform-width block of depth a = C/(0.85f′_c b_eff) and d₁ = Y_con − a/2, and warns "verify by hand". With parallel ribs the true block under the slab is only the rib width, so its centroid is lower. In A1 case (b), the true centroid is 3.19 in below the slab top, not 3.00 in, so d₁ = 4.31 in rather than 4.50 in and M_n is about 0.7 % high. Pre-existing; not changed. Decide whether to compute the block through the ribs.
- O12. **Batch template has no rib width or rib spacing columns.** After A1, batch PERP rows count no rib concrete (§I3.2c) and PARA rows count none either, with a warning. Add `w_r` / `s_r` columns only if batch PARA rows need the rib concrete.
- O13. **Resolved 2026-10-10 by E3** (L_v measured to the point of zero shear within the span; support jumps excluded). **Round HSS / pipe shear length L_v at an interior support** (found while checking E2). The G5 L_v is the distance from the V_u station to the nearest entry in the "V = 0" list. That list includes the sign change across the shear jump at a support, so when V_u is at an interior support, L_v is about 0. Before E2 the jump crossing was interpolated a grid step away, giving L_v ≈ 0.08 ft and F_cr = 0.6F_y. With E2 it lands on the support, L_v can be exactly 0, and `shearMajor` treats 0 as "no zero-shear point" (`LvIn||1e9`): the derivation then shows L_v ≈ 83 000 000 ft and F_cr = max(G5-2b, ~0) ≤ 0.6F_y. For standard pipes and most round HSS (D/t below about 90) G5-2b still exceeds 0.6F_y, so V_n does not change (checked: Pipe8XS and Pipe12STD on 2 × 20 ft spans, F_cr = 21 ksi before and after). For very slender rounds it is lower, which is conservative. Both the old and the new L_v are artefacts. The intended L_v is the distance to the zero-shear point within the span (12.5 ft from the interior support of a 2 × 20 ft UDL beam). Decide whether to exclude support-jump crossings from the L_v search.
