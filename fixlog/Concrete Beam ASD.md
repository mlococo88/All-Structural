# Fix log — Concrete Beam ASD.html

Governing basis used for fixes: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 8.15 (Service Load Design); AASHTO Manual for Bridge Evaluation (MBE), Part B (ASD/LFR rating), Art. 6B.6.2.3. MassDOT values kept as-is.

## 2026-10-04 — PR: claude/fix-concrete-asd (PR #16: https://github.com/mlococo88/All-Structural/pull/16)

All edits were applied by scripted exact-string replacement (each Before block occurs exactly once in the file). Line endings are CRLF and were preserved.

### F1. Allowable stresses tied to f'c and fy (auto, with per-field override)   [calc change] [LESS conservative for Gr 60 steel and for f'c > 3,000 psi; more conservative for nothing at the default inputs (default results unchanged)]
- **Where:** new functions `autoAllowables`, `applyAutoAllowables`, `resetAllowables` (after `inputIds`), listeners in the DOMContentLoaded handler, `calculate()` harvest, allowables block in the sidebar (≈ lines 141–151), report section 3. Anchor: `const AUTO_ALLOW = ['fc_inv', 'fs_inv', 'fs_op'];`
- **Problem:** The four allowables were fixed inputs (1200 / 20000 / 1900 / 28000 psi) and the fy input was never used. Changing f'c or fy left the allowables at the f'c = 3,000 psi / Grade 40 values, so results were silently stale (conservative for Gr 60 and higher f'c, but wrong).
- **Governing provision:** AASHTO Standard Specifications 17th Ed. (2002) Art. 8.15.2.1.1 (fc = 0.40f'c), Art. 8.15.2.2 (fs = 20 ksi Gr 40/50, 24 ksi Gr 60); AASHTO MBE Art. 6B.6.2.3 / Table 6B.6.2.3-1 (operating fs = 28 ksi Gr 40, 36 ksi Gr 60). Operating fc is not auto-computed (MassDOT 1,900 psi kept, see open items).
  Edit `allow-html`:
- **Before:**
  ```js
                              <div class="text-center col-span-2 font-bold text-slate-400 text-[10px] tracking-wider">INVENTORY</div>
                              <div class="inp-group mb-0"><label>fc allow</label><input id="fc_inv" value="1200" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="inp-group mb-0"><label>fs allow</label><input id="fs_inv" value="20000" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="text-center col-span-2 font-bold text-slate-400 text-[10px] tracking-wider mt-2">OPERATING</div>
                              <div class="inp-group mb-0"><label>fc allow</label><input id="fc_op" value="1900" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="inp-group mb-0"><label>fs allow</label><input id="fs_op" value="28000" class="inp-field h-7 py-0 trigger-calc"></div>
                          </div>
  ```
- **After:**
  ```js
                              <div class="text-center col-span-2 font-bold text-slate-400 text-[10px] tracking-wider">INVENTORY</div>
                              <div class="inp-group mb-0"><label>fc allow <span id="fc_inv_src" class="font-normal text-slate-400"></span></label><input id="fc_inv" value="1200" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="inp-group mb-0"><label>fs allow <span id="fs_inv_src" class="font-normal text-slate-400"></span></label><input id="fs_inv" value="20000" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="text-center col-span-2 font-bold text-slate-400 text-[10px] tracking-wider mt-2">OPERATING</div>
                              <div class="inp-group mb-0"><label>fc allow <span class="font-normal text-slate-400">(input)</span></label><input id="fc_op" value="1900" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="inp-group mb-0"><label>fs allow <span id="fs_op_src" class="font-normal text-slate-400"></span></label><input id="fs_op" value="28000" class="inp-field h-7 py-0 trigger-calc"></div>
                              <div class="col-span-2 text-[10px] text-slate-500 mt-1">(auto) = set from f'c / fy: inventory fc = 0.40f'c; fs = 20,000 (Gr 40/50) or 24,000 psi (Gr 60); operating fs = 28,000 (Gr 40) or 36,000 psi (Gr 60). Typing in a field overrides it. Operating fc is always the input value.</div>
                              <button type="button" id="allow-reset" class="col-span-2 text-[10px] text-blue-600 hover:underline text-left">&#8634; Recompute allowables from f'c and fy</button>
                          </div>
  ```
  Edit `auto-fns`:
- **Before:**
  ```js
              'as', 'm_dl', 'm_ll'
          ];
  ```
- **After:**
  ```js
              'as', 'm_dl', 'm_ll'
          ];
  
          // --- Allowable stresses tied to f'c / fy (auto unless the user overrides a field) ---
          // Inventory fc = 0.40 f'c (AASHTO Std. Spec. 8.15.2.1.1).
          // fs: Inventory 20,000 psi Gr 40/50, 24,000 psi Gr 60 (Std. Spec. 8.15.2.2);
          //     Operating 28,000 psi Gr 40, 36,000 psi Gr 60 (MBE 6B.6.2.3).
          // Other grades: no rule here, the field stays as entered. Operating fc is never auto (user / MassDOT value).
          const AUTO_ALLOW = ['fc_inv', 'fs_inv', 'fs_op'];
          const allowOverride = { fc_inv: false, fs_inv: false, fs_op: false };
          let loadNotice = '';
          function autoAllowables(fc, fy) {
              return {
                  fc_inv: fc > 0 ? +(0.40 * fc).toFixed(1) : null,
                  fs_inv: (fy === 40000 || fy === 50000) ? 20000 : (fy === 60000 ? 24000 : null),
                  fs_op: fy === 40000 ? 28000 : (fy === 60000 ? 36000 : null)
              };
          }
          function applyAutoAllowables() {
              const a = autoAllowables(parseFloat(document.getElementById('fc').value) || 0,
                                       parseFloat(document.getElementById('fy').value) || 0);
              const src = {};
              AUTO_ALLOW.forEach(id => {
                  if (!allowOverride[id] && a[id] !== null) document.getElementById(id).value = a[id];
                  src[id] = allowOverride[id] ? 'override' : (a[id] !== null ? 'auto' : 'input (no grade rule)');
                  const tag = document.getElementById(id + '_src');
                  if (tag) tag.textContent = '(' + src[id] + ')';
              });
              return src;
          }
          function resetAllowables() {
              AUTO_ALLOW.forEach(id => allowOverride[id] = false);
              loadNotice = '';
              calculate();
          }
  ```
  Edit `listeners`:
- **Before:**
  ```js
              // Standard Inputs Logic
              document.querySelectorAll('.trigger-calc').forEach(el => {
  ```
- **After:**
  ```js
              // Allowables: typing in an auto field marks it as a user override (registered before calculate)
              AUTO_ALLOW.forEach(id => document.getElementById(id).addEventListener('input', () => { allowOverride[id] = true; }));
              document.getElementById('allow-reset').addEventListener('click', resetAllowables);
  
              // Standard Inputs Logic
              document.querySelectorAll('.trigger-calc').forEach(el => {
  ```
  Edit `harvest`:
- **Before:**
  ```js
              // 1. Harvest Inputs
              inputIds.forEach(id => {
  ```
- **After:**
  ```js
              // 1. Harvest Inputs
              const allowSrc = applyAutoAllowables();
              inputIds.forEach(id => {
  ```
  Edit `res`:
- **Before:**
  ```js
                  rf_inv, rf_op, v, shape, b_calc
              });
  ```
- **After:**
  ```js
                  rf_inv, rf_op, v, shape, b_calc, n_raw, allowSrc
              });
  ```
  Edit `allow-src`:
- **Before:**
  ```js
                          <h4 class="text-sm font-bold text-slate-800 border-b pb-1 mb-2">3. Moment Capacity ($M_{all}$)</h4>
  ```
- **After:**
  ```js
                          <h4 class="text-sm font-bold text-slate-800 border-b pb-1 mb-2">3. Moment Capacity ($M_{all}$)</h4>
                          <p class="text-xs text-slate-500 mb-2">Allowables (psi): $f_{c,inv}$ = ${res.v.fc_inv} (${res.allowSrc.fc_inv === 'auto' ? "0.40f'c" : res.allowSrc.fc_inv}); $f_{s,inv}$ = ${res.v.fs_inv} (${res.allowSrc.fs_inv === 'auto' ? 'by grade' : res.allowSrc.fs_inv}); $f_{c,op}$ = ${res.v.fc_op} (input); $f_{s,op}$ = ${res.v.fs_op} (${res.allowSrc.fs_op === 'auto' ? 'by grade' : res.allowSrc.fs_op}).</p>
  ```
- **Check case:** Default inputs (f'c = 3,000, Gr 40, T-beam b_eff = 90, hf = 7, bw = 14, d = 28.5, As = 8.00, M_DL = 250, M_LL+I = 400): auto allowables = 1200/20000/(1900)/28000 = the old defaults → M_inv 353.3, M_op 494.7, RF 0.258 / 0.612 before and after. **f'c = 4,000, Gr 60, same T-beam:** before allowables 1200/20000/1900/28000 → M_inv = 354.7 k-ft (steel), M_op = 496.6, RF_inv = 0.262, RF_op = 0.616; after 1600/24000/1900/36000 → n = 8, k = 0.200, j = 0.933, M_steel,inv = 8.00·24000·z/12000 = **425.6 k-ft** (z = 26.60 in.), M_op = **638.4**, RF_inv = (425.6 − 250)/400 = **0.439**, RF_op = **0.971** (less conservative; was understated). **Rectangular b = 12, d = 21.5, As = 4.00, f'c = 4,000, Gr 40:** n = 8, ρ = 0.015504, k = 0.3892, kd = 8.369 in., j = 0.8702, z = 18.71 in.; before fc,inv = 1200 → M_conc = 0.5·12·8.369·1200·18.71/12000 = **93.9 k-ft** (concrete governs); after fc,inv = 1600 → M_conc = **125.3**, M_steel = 4·20000·18.71/12000 = **124.7** → M_inv = **124.7 k-ft** (steel now governs), RF_inv −0.390 → −0.313.
- **How verified:** jsdom: page loaded without CDNs, inputs set, `calculate()` run on the original file and the edited file; values above are from those runs and match the hand calc. Override: typing 18000 in fs,inv then changing f'c keeps 18000 (tag shows "(override)"); "Recompute allowables" restores auto values.
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### F2. Modular ratio n not less than 6   [calc change] [more conservative (only f'c > ≈ 8,500 psi)]
- **Where:** `calculate()`, section 2. Anchor: `const n = Math.max(6, n_raw);`
- **Problem:** n = round(Es/Ec) had no lower bound; for f'c above about 8,560 psi it rounds to 5 or less.
- **Governing provision:** AASHTO Standard Specifications 17th Ed. (2002) Art. 8.15.3.4 (n to the nearest whole number, not less than 6).
  Edit `errors`:
- **Before:**
  ```js
              // 2. Constants
              if(v.fc <= 0) v.fc = 3000;
              if(v.d_eff <= 0) v.d_eff = 20;
  
              const Es = 29000000;
              const Ec = 57000 * Math.sqrt(v.fc);
              const n = Math.round(Es / Ec); 
  ```
- **After:**
  ```js
              // 2. Input errors (previously f'c <= 0 was silently replaced by 3000 and d <= 0 by 20)
              const errors = [];
              if (!(v.fc > 0)) errors.push("Concrete strength f'c must be greater than 0.");
              if (!(v.d_eff > 0)) errors.push("Effective depth d must be greater than 0.");
              if (!(b_calc > 0)) errors.push("Section width (" + (shape === 't-beam' && isPosMoment ? "b_eff" : "b_w") + ") must be greater than 0.");
              if (errors.length) { showInputErrors(errors); return; }
  
              const Es = 29000000;
              const Ec = 57000 * Math.sqrt(v.fc);
              const n_raw = Math.round(Es / Ec);
              const n = Math.max(6, n_raw); // AASHTO Std. Spec. 8.15.3.4: nearest whole number, not less than 6
  ```
  Edit `n-note`:
- **Before:**
  ```js
                          <div><strong>Lever Arm ($j$):</strong> $$${res.j.toFixed(3)}$$</div>
                      </div>
  ```
- **After:**
  ```js
                          <div><strong>Lever Arm ($j$):</strong> $$${res.j.toFixed(3)}$$</div>
                      </div>
                      ${res.n_raw < 6 ? `<p class="text-xs text-slate-500 italic">$n = E_s/E_c$ rounds to ${res.n_raw}; the minimum $n = 6$ is used (Std. Spec. 8.15.3.4).</p>` : ''}
  ```
- **Check case:** f'c = 10,000 psi, Gr 40, default T-beam: Ec = 57,000·√10,000 = 5.70e6 psi, Es/Ec = 5.09 → before n = 5 (k = 0.162, j = 0.946, M_inv = 359.5 k-ft, RF_inv 0.274); after n = 6 (k = 0.176, j = 0.941, M_inv = 357.8 k-ft, RF_inv 0.269). (fc,inv is also now 0.40·10,000 = 4,000 psi; steel governs both runs.) f'c ≤ 8,000 psi: unchanged.
- **How verified:** jsdom before/after runs (above).
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### F3. No silent substitution of f'c ≤ 0 → 3000 and d ≤ 0 → 20; show input errors   [bug fix] [no result change for valid inputs]
- **Where:** `calculate()` section 2 and new `showInputErrors()`. Anchor: `// 2. Input errors`
- **Problem:** A blank or zero f'c was silently analysed as 3,000 psi and d ≤ 0 as 20 in., producing plausible-looking but wrong ratings. A zero width gave NaN results.
- **Governing provision:** n/a
  Edit `errors`:
- **Before:**
  ```js
              // 2. Constants
              if(v.fc <= 0) v.fc = 3000;
              if(v.d_eff <= 0) v.d_eff = 20;
  
              const Es = 29000000;
              const Ec = 57000 * Math.sqrt(v.fc);
              const n = Math.round(Es / Ec); 
  ```
- **After:**
  ```js
              // 2. Input errors (previously f'c <= 0 was silently replaced by 3000 and d <= 0 by 20)
              const errors = [];
              if (!(v.fc > 0)) errors.push("Concrete strength f'c must be greater than 0.");
              if (!(v.d_eff > 0)) errors.push("Effective depth d must be greater than 0.");
              if (!(b_calc > 0)) errors.push("Section width (" + (shape === 't-beam' && isPosMoment ? "b_eff" : "b_w") + ") must be greater than 0.");
              if (errors.length) { showInputErrors(errors); return; }
  
              const Es = 29000000;
              const Ec = 57000 * Math.sqrt(v.fc);
              const n_raw = Math.round(Es / Ec);
              const n = Math.max(6, n_raw); // AASHTO Std. Spec. 8.15.3.4: nearest whole number, not less than 6
  ```
  Edit `showerr-fn`:
- **Before:**
  ```js
          // --- UI Renderer ---
          function updateUI(res) {
  ```
- **After:**
  ```js
          // --- Input error display (no results shown) ---
          function showInputErrors(errors) {
              const badge = document.getElementById('control-badge');
              badge.textContent = 'Input error';
              badge.className = 'text-[10px] px-2 py-1 rounded border font-bold bg-red-50 text-red-600 border-red-200';
              ['disp-Mc-inv', 'disp-Mc-op', 'disp-rf-inv', 'disp-rf-op'].forEach(id => document.getElementById(id).textContent = '--');
              document.getElementById('report-content').innerHTML =
                  `<div class="text-sm text-red-700 bg-red-50 p-3 rounded border border-red-200"><strong>Input error — no results.</strong><ul class="list-disc pl-5 mt-1">${errors.map(m => `<li>${m}</li>`).join('')}</ul></div>`;
              document.getElementById('svg-container').innerHTML = '';
          }
  
          // --- UI Renderer ---
          function updateUI(res) {
  ```
- **Check case:** f'c blank: before → results for f'c = 3,000 (M_inv 353.3, RF 0.258); after → badge "Input error", cards "--", report lists "Concrete strength f'c must be greater than 0." d = 0: before M_inv 244.8, RF −0.013; after → error "Effective depth d must be greater than 0."
- **How verified:** jsdom runs.
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### F4. M_LL+I = 0 guard   [robustness] [no result change for M_LL+I ≠ 0]
- **Where:** `calculate()` section 5, `updateUI` (`setRF`, report section 4). Anchor: `// guard M_LL+I = 0`
- **Problem:** M_LL+I = 0 gave RF = ±Infinity printed as "Infinity".
- **Governing provision:** n/a
  Edit `rf`:
- **Before:**
  ```js
              const rf_inv = (M_inv - v.m_dl) / v.m_ll;
              const rf_op = (M_op - v.m_dl) / v.m_ll;
  ```
- **After:**
  ```js
              const rf_inv = v.m_ll !== 0 ? (M_inv - v.m_dl) / v.m_ll : NaN; // guard M_LL+I = 0
              const rf_op = v.m_ll !== 0 ? (M_op - v.m_dl) / v.m_ll : NaN;
  ```
  Edit `setrf`:
- **Before:**
  ```js
                  el.textContent = val.toFixed(3);
                  el.className = `text-3xl font-bold ${val < 1.0 ? 'text-red-300' : 'text-white'}`;
  ```
- **After:**
  ```js
                  el.textContent = isFinite(val) ? val.toFixed(3) : 'n/a';
                  el.className = `text-3xl font-bold ${val < 1.0 ? 'text-red-300' : 'text-white'}`;
  ```
  Edit `rf-note`:
- **Before:**
  ```js
                           <p class="text-sm text-slate-600 mb-2">Using Equation: $$RF = \\frac{C - M_{DL}}{M_{LL+I}}$$</p>
  ```
- **After:**
  ```js
                           <p class="text-sm text-slate-600 mb-2">Using Equation: $$RF = \\frac{C - M_{DL}}{M_{LL+I}}$$</p>
                           ${res.v.m_ll === 0 ? '<p class="text-xs text-red-600 mb-2">M<sub>LL+I</sub> = 0: the rating factor is not defined (n/a).</p>' : ''}
  ```
  Edit `rf-inv-fmt`:
- **Before:**
  ```js
  = \\mathbf{${res.rf_inv.toFixed(3)}}$$</p>
  ```
- **After:**
  ```js
  = \\mathbf{${isFinite(res.rf_inv) ? res.rf_inv.toFixed(3) : '\\text{n/a}'}}$$</p>
  ```
  Edit `rf-op-fmt`:
- **Before:**
  ```js
  = \\mathbf{${res.rf_op.toFixed(3)}}$$</p>
  ```
- **After:**
  ```js
  = \\mathbf{${isFinite(res.rf_op) ? res.rf_op.toFixed(3) : '\\text{n/a}'}}$$</p>
  ```
- **Check case:** M_LL+I = 0: before RF "Infinity"; after "n/a" with a red note. M_LL+I = 400: unchanged (0.258/0.612).
- **How verified:** jsdom runs.
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### F5. Save JSON crash fixed; save includes selects/checkboxes   [bug fix] [no result change]
- **Where:** `saveToJson()`. Anchor: `function saveToJson() {`
- **Problem:** `document.getElementById('calc-name').value` referenced a non-existent element → TypeError, nothing downloaded. It also saved `state.inputs`, which `calculate()` mutates (b_eff overwritten by b_w for rectangular sections).
- **Governing provision:** n/a
  Edit `save-load`:
- **Before:**
  ```js
          function saveToJson() {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.inputs));
              const el = document.createElement('a');
              el.setAttribute("href", dataStr);
              el.setAttribute("download", (document.getElementById('calc-name').value || "bridge-rating") + ".json");
              document.body.appendChild(el);
              el.click();
              el.remove();
          }
  
          function loadFromJson(e) {
              const file = e.target.files[0];
              if(!file) return;
              const reader = new FileReader();
              reader.onload = function(e) {
                  const data = JSON.parse(e.target.result);
                  Object.keys(data).forEach(k => {
                      const el = document.getElementById(k);
                      if(el) el.value = data[k];
                  });
                  calculate();
              };
              reader.readAsText(file);
          }
  ```
- **After:**
  ```js
          function saveToJson() {
              // Same flat {id: value} format as before, read from the form (not from the calc state),
              // plus the selects/checkboxes and the allowable-override flags.
              const data = {};
              inputIds.forEach(id => { data[id] = parseFloat(document.getElementById(id).value) || 0; });
              ['moment_type', 'section_shape', 'bar_count', 'bar_size'].forEach(id => { data[id] = document.getElementById(id).value; });
              ['chk_inv', 'chk_op'].forEach(id => { data[id] = document.getElementById(id).checked; });
              data._allowOverride = Object.assign({}, allowOverride);
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
              const el = document.createElement('a');
              el.setAttribute("href", dataStr);
              const nameEl = document.getElementById('calc-name'); // no such field in this page; keep the fallback name
              el.setAttribute("download", ((nameEl && nameEl.value) || "bridge-rating") + ".json");
              document.body.appendChild(el);
              el.click();
              el.remove();
          }
  
          function loadFromJson(e) {
              const file = e.target.files[0];
              if(!file) return;
              const reader = new FileReader();
              reader.onload = function(ev) {
                  let data;
                  try { data = JSON.parse(ev.target.result); } catch (err) { data = null; }
                  if (!data || typeof data !== 'object') { alert("Could not read JSON file."); return; }
                  Object.keys(data).forEach(k => {
                      const el = document.getElementById(k);
                      if (!el) return;
                      if (el.type === 'checkbox') el.checked = !!data[k];
                      else el.value = data[k];
                  });
                  // Allowable overrides: newer files store the flags. Older files did not, so any saved
                  // allowable that differs from the f'c/fy-based value is kept as an override (not discarded).
                  const a = autoAllowables(parseFloat(data.fc) || 0, parseFloat(data.fy) || 0);
                  const hasFlags = data._allowOverride && typeof data._allowOverride === 'object';
                  AUTO_ALLOW.forEach(id => {
                      allowOverride[id] = hasFlags ? !!data._allowOverride[id]
                          : (data[id] !== undefined && a[id] !== null && parseFloat(data[id]) !== a[id]);
                  });
                  loadNotice = (!hasFlags && AUTO_ALLOW.some(id => allowOverride[id]))
                      ? "Loaded file (older format): its allowable stresses differ from the f'c / fy-based values and were kept as overrides. Use \u201cRecompute allowables\u201d under Edit Allowable Stresses to use the code values."
                      : '';
                  updateVisibility();
                  calculate();
              };
              reader.readAsText(file);
              e.target.value = '';
          }
  ```
- **Check case:** Click Save: before → TypeError "Cannot read properties of null (reading 'value')"; after → downloads bridge-rating.json containing the same flat {id: number} keys as before plus moment_type, section_shape, bar_count, bar_size, chk_inv, chk_op and _allowOverride.
- **How verified:** jsdom (anchor click intercepted, JSON captured).
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### F6. Load JSON: try/catch; restores selects and checkboxes; allowable overrides migrated   [bug fix / robustness] [no result change]
- **Where:** `loadFromJson()`. Anchor: `function loadFromJson(e) {`
- **Problem:** `JSON.parse` had no try/catch; checkboxes were set via `.value` (no effect); visibility was not refreshed. With the new auto allowables, an older file's allowables would otherwise be overwritten by the auto values.
- **Governing provision:** n/a
  Edit `save-load`:
- **Before:**
  ```js
          function saveToJson() {
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state.inputs));
              const el = document.createElement('a');
              el.setAttribute("href", dataStr);
              el.setAttribute("download", (document.getElementById('calc-name').value || "bridge-rating") + ".json");
              document.body.appendChild(el);
              el.click();
              el.remove();
          }
  
          function loadFromJson(e) {
              const file = e.target.files[0];
              if(!file) return;
              const reader = new FileReader();
              reader.onload = function(e) {
                  const data = JSON.parse(e.target.result);
                  Object.keys(data).forEach(k => {
                      const el = document.getElementById(k);
                      if(el) el.value = data[k];
                  });
                  calculate();
              };
              reader.readAsText(file);
          }
  ```
- **After:**
  ```js
          function saveToJson() {
              // Same flat {id: value} format as before, read from the form (not from the calc state),
              // plus the selects/checkboxes and the allowable-override flags.
              const data = {};
              inputIds.forEach(id => { data[id] = parseFloat(document.getElementById(id).value) || 0; });
              ['moment_type', 'section_shape', 'bar_count', 'bar_size'].forEach(id => { data[id] = document.getElementById(id).value; });
              ['chk_inv', 'chk_op'].forEach(id => { data[id] = document.getElementById(id).checked; });
              data._allowOverride = Object.assign({}, allowOverride);
              const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(data));
              const el = document.createElement('a');
              el.setAttribute("href", dataStr);
              const nameEl = document.getElementById('calc-name'); // no such field in this page; keep the fallback name
              el.setAttribute("download", ((nameEl && nameEl.value) || "bridge-rating") + ".json");
              document.body.appendChild(el);
              el.click();
              el.remove();
          }
  
          function loadFromJson(e) {
              const file = e.target.files[0];
              if(!file) return;
              const reader = new FileReader();
              reader.onload = function(ev) {
                  let data;
                  try { data = JSON.parse(ev.target.result); } catch (err) { data = null; }
                  if (!data || typeof data !== 'object') { alert("Could not read JSON file."); return; }
                  Object.keys(data).forEach(k => {
                      const el = document.getElementById(k);
                      if (!el) return;
                      if (el.type === 'checkbox') el.checked = !!data[k];
                      else el.value = data[k];
                  });
                  // Allowable overrides: newer files store the flags. Older files did not, so any saved
                  // allowable that differs from the f'c/fy-based value is kept as an override (not discarded).
                  const a = autoAllowables(parseFloat(data.fc) || 0, parseFloat(data.fy) || 0);
                  const hasFlags = data._allowOverride && typeof data._allowOverride === 'object';
                  AUTO_ALLOW.forEach(id => {
                      allowOverride[id] = hasFlags ? !!data._allowOverride[id]
                          : (data[id] !== undefined && a[id] !== null && parseFloat(data[id]) !== a[id]);
                  });
                  loadNotice = (!hasFlags && AUTO_ALLOW.some(id => allowOverride[id]))
                      ? "Loaded file (older format): its allowable stresses differ from the f'c / fy-based values and were kept as overrides. Use \u201cRecompute allowables\u201d under Edit Allowable Stresses to use the code values."
                      : '';
                  updateVisibility();
                  calculate();
              };
              reader.readAsText(file);
              e.target.value = '';
          }
  ```
  Edit `report-top`:
- **Before:**
  ```js
                  <div class="space-y-6">
                      
                      <!-- Params -->
  ```
- **After:**
  ```js
                  <div class="space-y-6">
  
                      <!-- Scope note -->
                      <div class="text-xs text-amber-800 bg-amber-50 p-3 rounded border border-amber-200"><strong>Scope:</strong> singly reinforced flexure only (working stress, AASHTO Std. Spec. 8.15). Compression steel (8.15.3, 2n&middot;A's) is ignored and ASD shear (8.15.5) is not checked.</div>
                      ${loadNotice ? `<div class="text-xs text-red-700 bg-red-50 p-3 rounded border border-red-200">${loadNotice}</div>` : ''}
  
                      <!-- Params -->
  ```
- **Check case:** Bad JSON → alert "Could not read JSON file." (before: uncaught exception). New file → section_shape = rect and chk_op = false restored. Older-format file {fc: 4000, fy: 60000, fc_inv: 1200, fs_inv: 20000, fc_op: 1900, fs_op: 28000, …} → the saved 1200/20000/28000 are kept as overrides (results identical to before), and a red notice explains how to switch to the code values.
- **How verified:** jsdom (FileReader with in-memory files).
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### F7. Visible scope note: compression steel and ASD shear not modelled   [display] [no result change]
- **Where:** `updateUI` report top. Anchor: `<!-- Scope note -->`
- **Problem:** Doubly reinforced sections and ASD shear were silently not modelled.
- **Governing provision:** AASHTO Standard Specifications 17th Ed. Art. 8.15.3 (2n·A's), Art. 8.15.5 (shear).
  Edit `report-top`:
- **Before:**
  ```js
                  <div class="space-y-6">
                      
                      <!-- Params -->
  ```
- **After:**
  ```js
                  <div class="space-y-6">
  
                      <!-- Scope note -->
                      <div class="text-xs text-amber-800 bg-amber-50 p-3 rounded border border-amber-200"><strong>Scope:</strong> singly reinforced flexure only (working stress, AASHTO Std. Spec. 8.15). Compression steel (8.15.3, 2n&middot;A's) is ignored and ASD shear (8.15.5) is not checked.</div>
                      ${loadNotice ? `<div class="text-xs text-red-700 bg-red-50 p-3 rounded border border-red-200">${loadNotice}</div>` : ''}
  
                      <!-- Params -->
  ```
- **Check case:** Display only.
- **How verified:** jsdom render.
- **Other copies of this code:** The suite's ASD tab in `Concrete Beam Capacity.html` (`suite-frame-asd`) uses the same calculation engine (`compute()`), not the same code. The allowables tie-in and n ≥ 6 are applied there separately in branch `claude/fix-concrete-capacity`.

### N1. "Malformed SVG rebar line" — NOT A BUG / no change
- **Where:** `drawDiagram()`, ≈ line 711 (original). Anchor: `stroke-dasharray="1,5" />`
- **Finding:** the review said the rebar `<line …` was missing `/>`. The full line does end with `stroke-dasharray="1,5" />` — the review's extract was truncated. jsdom parse of the generated SVG shows a closed `<line>` followed by a separate `<text>Steel</text>` element, before and after this PR.
- **Action:** none.

## 2026-10-04 — PR: claude/step1-group4 (PR #30: https://github.com/mlococo88/All-Structural/pull/30)
### S1. "← All tools" link   [feature (no result change)]
- **Date / type:** 2026-10-04, feature (no result change).
- **Where:** Navbar, left group, after the "AASHTO Std. Specs / MassDOT" subtitle block.
- **Purpose:** link back to `tools.html` (`target="_top"`, hidden in print).
- **Field mapping:** **No title block** (no project, job, engineer or date fields), so no shared-project buttons were added and no BridgeXfer copy, per the brief. Link only.
- **Governing provision:** none (no engineering change). Spec: HANDOFF.md §4.1 and §5.
- **Before / After** (exact; edits applied in this order, each anchor occurs once; line endings preserved):
  1.
     - Before:
  ```html
                  <p class="text-[10px] text-slate-400 uppercase tracking-wider">AASHTO Std. Specs / MassDOT</p>
              </div>
  ```
     - After:
  ```html
                  <p class="text-[10px] text-slate-400 uppercase tracking-wider">AASHTO Std. Specs / MassDOT</p>
              </div>
              <a href="tools.html" target="_top" class="no-print text-[11px] text-slate-400 hover:text-white">&larr; All tools</a>
  ```
- **Behaviour notes:** The link has the existing `no-print` class, which the page's `@media print` block hides.
- **Saved data:** unchanged.
- **Check case:** n/a (navigation link only).
- **How verified:** inline script syntax-checked; page loaded in jsdom before/after with no new errors; link found with `target="_top"`. `git diff` adds one line and removes none.
- **Other copies of this code:** none.

## 2026-10-09 — Input panel tabs (branch claude/tabs-concreteasd)
### T1. Input panel split into tabs   [UI only — no calculation change]
- **Date:** 2026-10-09. **Type:** UI only. No calculation change. Engineer's request (2026-10-09): "make sure they are all formatted with the input panel having tabs rather than one long scrolling input panel."
- **What:** when the page starts, `cbasdInputTabs()` moves the four existing input `<section>` nodes of the sidebar into one tab pane each. Nothing is rebuilt, so every id, class (`trigger-calc`, `trigger-bar`, `flange-input`), handler and value stays the same. The **Analysis Mode** box (moment type, section shape, Inventory/Operating checkboxes) stays **above** the tab strip, because the section shape changes which Geometry inputs show. The "v2.2.0 • Build 2025" footer stays below the panes.

  | Tab | Sections (unchanged inside) |
  |---|---|
  | (above the strip, always visible) | Analysis Mode |
  | Materials | Materials: f'c, fy, and the "Edit Allowable Stresses" `<details>` (fc/fs inventory and operating allowables, Recompute button) |
  | Geometry | Section Geometry: b_eff and h_f (hidden for a rectangular section, as today), b_w, h, d |
  | Reinforcement | Reinforcement: bar count, bar size, A_s |
  | Loads | Applied Loads: M_DL, M_LL+I |

  No tab is ever empty: the rectangular-section mode hides only b_eff and h_f, so Geometry still holds b_w, h and d. No tab-hiding logic was needed (the keyboard handler still skips hidden tabs).
- **Storage:** the tool had **no** localStorage/sessionStorage before (Save/Load JSON file only). New key `cbasd_inputTab_v1` (new tool prefix `cbasd_` = Concrete Beam ASD; no other tool uses it). It holds the active input tab (`mat`, `geom`, `reinf` or `loads`), per browser. It is written only when a tab is clicked or picked with the keyboard. Reads and writes are wrapped in try/catch, with an in-memory fallback. An unknown stored value falls back to Materials. The JSON file format written by `saveToJson()` is unchanged; the tab is not in it.
- **Error marker:** a red dot on a tab holding (a) an input named in the input-error list that `calculate()` passes to `showInputErrors()` (f'c ≤ 0 → Materials; d ≤ 0, b_eff ≤ 0 or b_w ≤ 0 → Geometry), (b) a number field with `validity.badInput` (e.g. "400e"), or (c) a non-blank allowable-stress text field (these four inputs have no `type`) that `parseFloat` cannot read (the tool silently uses 0 for it). b_eff and h_f are ignored while hidden for a rectangular section. Marks are refreshed at the start of `showInputErrors()` and after the report is written in `updateUI()`.
- **Keyboard / ARIA:** `role=tablist/tab/tabpanel`, `aria-selected`, `aria-controls`, `aria-labelledby`, roving tabindex. Arrow keys, Home and End move between tabs.
- **Focus / scroll:** the tool has no code that focuses or scrolls to an input (Load JSON only sets values), so nothing else needed to switch tabs.
- **Print:** unchanged. `@media print` already hides `aside` (and it has `no-print`); the tab strip is inside it.
- **Where / Before / After** (all insertions; the Before text is the anchor and is kept; the file's CRLF line endings are preserved):
  1. CSS. Anchor (Before): `        ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }` followed by `    </style>`.
     After: insert between them a blank line and:
  ```css
        /* Input panel tabs (cbasdInputTabs; UI only) */
        #cbasdInTabs { position: sticky; top: 0; z-index: 5; display: flex; flex-wrap: wrap; gap: 0 0.125rem; margin-left: -1rem; margin-right: -1rem; padding: 0.25rem 1rem 0; background: #fff; border-bottom: 1px solid #e2e8f0; }
        .cbasdInTab { display: inline-flex; align-items: center; gap: 0.3rem; margin-bottom: -1px; padding: 0.5rem 0.375rem 0.4rem; background: none; border: 0; border-bottom: 2px solid transparent; font-size: 0.6875rem; font-weight: 700; text-transform: uppercase; color: #64748b; cursor: pointer; white-space: nowrap; }
        .cbasdInTab:hover { color: #334155; }
        .cbasdInTab[aria-selected="true"] { color: #0f172a; border-bottom-color: #2563eb; }
        .cbasdInTab:focus-visible { outline: 2px solid #93c5fd; outline-offset: -2px; border-radius: 0.25rem 0.25rem 0 0; }
        .cbasdInDot { display: none; width: 7px; height: 7px; border-radius: 50%; background: #dc2626; }
        .cbasdInTab.has-err .cbasdInDot { display: inline-block; }
        .cbasdInTab[hidden], .cbasdInPane[hidden] { display: none !important; }
  ```
  2. JS. Anchor (Before): `        // --- Initialization ---` followed by `        document.addEventListener('DOMContentLoaded', () => {`.
     After: insert before `// --- Initialization ---`:
  ```js
        // --- Input panel tabs (UI only) ---
        // The four input <section>s are MOVED (not rebuilt) into one pane per tab, so every
        // id, handler and value is untouched. The Analysis Mode box stays above the tab strip.
        // The active tab is remembered per browser in localStorage 'cbasd_inputTab_v1'
        // (never in the saved JSON file).
        const CBASD_IN_TABS = [['mat', 'Materials', 'fc'], ['geom', 'Geometry', 'b_w'], ['reinf', 'Reinforcement', 'as'], ['loads', 'Loads', 'm_dl']];
        const CBASD_IN_KEY = 'cbasd_inputTab_v1';
        // input errors listed by calculate() -> the input each one names
        const CBASD_IN_ERR = [[/^Concrete strength f'c/, 'fc'], [/^Effective depth d/, 'd_eff'], [/^Section width \(b_eff\)/, 'b_eff'], [/^Section width \(b_w\)/, 'b_w']];
        let cbasdInTabCur = null; // in-memory copy, used when storage is blocked
        function cbasdInTabGet() { if (cbasdInTabCur) return cbasdInTabCur; try { return localStorage.getItem(CBASD_IN_KEY) || ''; } catch (e) { return ''; } }
        function cbasdInTabSet(t) { cbasdInTabCur = t; try { localStorage.setItem(CBASD_IN_KEY, t); } catch (e) {} }
        function cbasdInputTabs() {
            const bar = document.createElement('div');
            bar.id = 'cbasdInTabs';
            bar.setAttribute('role', 'tablist'); bar.setAttribute('aria-label', 'Input groups');
            CBASD_IN_TABS.forEach(([k, lab, key], i) => {
                const sec = document.getElementById(key).closest('section');
                const b = document.createElement('button');
                b.type = 'button'; b.className = 'cbasdInTab'; b.id = 'cbasdInTab_' + k; b.dataset.pane = k;
                b.setAttribute('role', 'tab'); b.setAttribute('aria-controls', 'cbasdInPane_' + k);
                const t = document.createElement('span'); t.textContent = lab; b.appendChild(t);
                const dot = document.createElement('span'); dot.className = 'cbasdInDot'; dot.setAttribute('aria-hidden', 'true'); b.appendChild(dot);
                b.addEventListener('click', () => cbasdSetInTab(k, true));
                b.addEventListener('keydown', cbasdInTabKey);
                bar.appendChild(b);
                const pn = document.createElement('div');
                pn.className = 'cbasdInPane'; pn.id = 'cbasdInPane_' + k; pn.dataset.pane = k;
                pn.setAttribute('role', 'tabpanel'); pn.setAttribute('aria-labelledby', 'cbasdInTab_' + k);
                sec.parentNode.insertBefore(pn, sec);
                if (i === 0) sec.parentNode.insertBefore(bar, pn);
                pn.appendChild(sec);
            });
            let t = cbasdInTabGet();
            if (!CBASD_IN_TABS.some(([k]) => k === t)) t = CBASD_IN_TABS[0][0];
            cbasdSetInTab(t, false);
        }
        function cbasdSetInTab(t, remember) {
            CBASD_IN_TABS.forEach(([k]) => {
                const b = document.getElementById('cbasdInTab_' + k), pn = document.getElementById('cbasdInPane_' + k);
                const on = (k === t);
                b.setAttribute('aria-selected', on ? 'true' : 'false'); b.tabIndex = on ? 0 : -1;
                pn.hidden = !on;
            });
            if (remember) cbasdInTabSet(t);
        }
        function cbasdInTabKey(e) {
            const vis = CBASD_IN_TABS.map(([k]) => document.getElementById('cbasdInTab_' + k)).filter(b => b && !b.hidden);
            const i = vis.indexOf(e.currentTarget); let j = -1;
            if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % vis.length;
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') j = (i - 1 + vis.length) % vis.length;
            else if (e.key === 'Home') j = 0;
            else if (e.key === 'End') j = vis.length - 1;
            if (j < 0) return;
            e.preventDefault(); cbasdSetInTab(vis[j].dataset.pane, true); vis[j].focus();
        }
        // Red dot on a tab holding an input named in calculate()'s input errors, a number field
        // the browser cannot parse, or a non-blank allowable-stress text field that is not a number.
        // Flange inputs hidden for a rectangular section are ignored.
        function cbasdInputTabMarks(errors) {
            if (!document.getElementById('cbasdInTabs')) return;
            const bad = {};
            const mark = el => { const pn = el && el.closest('.cbasdInPane'); if (pn) bad[pn.dataset.pane] = 1; };
            (errors || []).forEach(m => { const r = CBASD_IN_ERR.find(x => x[0].test(m)); if (r) mark(document.getElementById(r[1])); });
            document.querySelectorAll('.cbasdInPane input').forEach(i => {
                const fl = i.closest('.flange-input');
                if (fl && fl.style.display === 'none') return;
                if ((i.validity && i.validity.badInput) || (i.type === 'text' && i.value.trim() !== '' && isNaN(parseFloat(i.value)))) mark(i);
            });
            CBASD_IN_TABS.forEach(([k]) => {
                const b = document.getElementById('cbasdInTab_' + k);
                b.classList.toggle('has-err', !!bad[k]);
                b.title = bad[k] ? 'An input on this tab needs attention' : '';
            });
        }

  ```
     and as the first lines inside the DOMContentLoaded handler (then a blank line):
  ```js
            cbasdInputTabs(); // move the input sections into the input tabs (UI only)
  ```
  3. `showInputErrors()`. Anchor (Before): `        function showInputErrors(errors) {`
     After: add as its first line: `            cbasdInputTabMarks(errors); // input tabs: red dot (UI only)`
  4. `updateUI()`. Anchor (Before): `            document.getElementById('report-content').innerHTML = reportHTML;`
     After: add on the next line: `            cbasdInputTabMarks([]); // input tabs: red dot (UI only)`
- **Problem:** UI request only (one long scrolling input panel). No result change.
- **Governing provision:** none. No formula, factor, unit, code reference or computed result changed.
- **Check case:** not applicable. Results are identical, see below.
- **How verified:**
  - `node --check` on the inline script, main and branch.
  - Headless Chromium (Playwright, Chromium 1194). CDNs are blocked here, so libraries were routed locally: KaTeX 0.16.9 (the pinned version, `npm pack`); `@phosphor-icons/web` 2.1.2 (current version; the tag is unpinned); the unpinned Tailwind Play CDN was replaced by CSS compiled with Tailwind CLI 3.4.19 (current v3) from the main and branch files, injected by a small stand-in script. Google Fonts blocked (same in main; system font fallback).
  - Main and branch compared in 16 states: default, rectangular, negative moment, negative + rectangular, Inventory off, Operating off, Gr 60 with f'c 4000, fs_inv override, override then Recompute, bar picker 5 #10, T-beam action (h_f 3, A_s 14), f'c = 0, d = 0, b_eff = 0, M_LL+I = 0, non-numeric fc_op. In every state these were identical: the text and HTML of `<main>` (cards, report, SVG), the show/hide state of flange inputs and result blocks, all sidebar values, the (auto)/(override) tags, and the saved JSON (`saveToJson` download). Save → Load JSON round trip into a fresh page: identical in main and branch. Loading an older-format file (no `_allowOverride`): identical.
  - All 23 sidebar controls (inputs, selects, button, details/summary) are present in the same order in both; each is in exactly one pane, except the four Analysis Mode controls, which are above the strip by design.
  - No console errors (other than the blocked Google Fonts request, same in main).
  - Checked: keyboard Right/Left (wraps)/Home/End; red dot on and off for f'c = 0, d = 0, b_eff = 0 (not shown when rectangular), fs_op = "abc", M_LL+I "400e"; tab remembered across reload; bogus stored value → Materials; localStorage blocked → tabs still work, results normal; Load JSON keeps the active tab; print media hides `aside`; strip stays stuck at the top of the scrolling sidebar.
  - Screenshots of every tab (and Geometry in rectangular mode) at 1400 px and 400 px. The strip fits on one line at both widths.
- **Other copies:** none.

## 2026-10-09 — PR: claude/pin-concreteasd (PR #78: https://github.com/mlococo88/All-Structural/pull/78)

### L1. CDN library versions pinned   [libraries — no calculation change]
- **Engineer's decision (2026-10-09):** pin the libraries (CLAUDE.md §2: exact versions in CDN URLs). Resolves O5.
- **Where:** the `<head>` of the file, lines ≈ 9 and 11. Anchors: `<!-- Tailwind CSS -->`, `<!-- Phosphor Icons -->`. Each library stays on its existing host.
- **Before / After (exact lines, 4-space indent, CRLF):**
  ```html
  -    <script src="https://cdn.tailwindcss.com"></script>
  +    <script src="https://cdn.tailwindcss.com/3.4.17"></script>
  -    <script src="https://unpkg.com/@phosphor-icons/web"></script>
  +    <script src="https://unpkg.com/@phosphor-icons/web@2.1.2/src/index.js"></script>
  ```
- **Versions chosen (npm registry checked 2026-10-09):**
  - `@phosphor-icons/web` **2.1.2**: the `latest` dist-tag (published 2025-03-31), so it is the version the bare URL serves today. The package has no `unpkg`/`browser` field, so unpkg serves `main` = `src/index.js`; the pinned URL names that file explicitly. That script injects six stylesheets that are already pinned inside the package (`https://cdn.jsdelivr.net/npm/@phosphor-icons/web@2.1.2/src/<weight>/style.css`), which load the icon fonts from the same pinned folder.
  - Tailwind Play CDN **3.4.17** (`cdn.tailwindcss.com/<version>` path form, as already used by `Timber Beam Check.html` and `Concrete Anchor.html`). The page sets no `tailwind.config`.
- **Not changed:** KaTeX 0.16.9 (`katex.min.css`, `katex.min.js`, `contrib/auto-render.min.js` on jsDelivr) is already pinned, and its fonts load relative to the pinned CSS. Google Fonts (`@import` of Inter and JetBrains Mono) is a stylesheet and needs no pin. No other `<script>`/`<link>` tags and no other dynamically loaded URLs in the file (checked for `createElement('script'|'link')`, `import(`, `fetch(`, `.src =`).
- **Check case:** not applicable (no calculation touched). Default inputs give M_all = 353.3 k-ft (Inventory) and 494.7 k-ft (Operating), RF 0.258 / 0.612, identical on main and branch.
- **How verified:**
  - The CDNs are blocked in the test environment, so each URL was served locally in headless Chromium (Playwright, Chromium 1194, `file://`). main: `@phosphor-icons/web` 2.1.2 (what the bare URL serves today, `npm pack`) and Tailwind 3.4.19 CSS (current v3) compiled from the page's classes. Branch: `@phosphor-icons/web` 2.1.2 and Tailwind 3.4.17 CSS compiled from the page's classes (stand-in for the Play CDN script, which is not on npm). Both: KaTeX 0.16.9. A request log confirmed each page fetched exactly its own URLs (main: `cdn.tailwindcss.com/`, `unpkg.com/@phosphor-icons/web`; branch: `cdn.tailwindcss.com/3.4.17`, `unpkg.com/@phosphor-icons/web@2.1.2/src/index.js`; all other URLs the same).
  - The compiled Tailwind 3.4.17 and 3.4.19 CSS for this page differ only in the version banner comment.
  - main vs branch, the same 16 states as the tabs entry (T1) plus loading an older-format JSON: text and HTML of `<main>` (cards, report, SVG), show/hide state, all sidebar values, (auto)/(override) tags, saved JSON, Save → Load round trip, computed style of every element, Phosphor icon glyphs and loaded fonts → **all identical**. Full-page screenshots: identical in one run; in other runs a few states differed only in small bands (header buttons, result numbers) caught mid-transition, a different set each run, visually identical when compared side by side.
  - No console errors other than the blocked Google Fonts request (same on main).
- **Other copies:** none.

## 2026-10-12 — Open-item sweep (branch claude/sweep-cbasd)

Inventory items ASD-O1 … ASD-O9, ASD-A2, ASD-C7 (scratchpad `open_inventory.md` §12). Engineer's instruction (2026-10-12): use best judgment, proceed, and list only what truly needs input. All edits were applied by scripted exact-string replacement (each Before block occurs exactly once); the file's CRLF line endings are preserved. Only this file changed (the suite's ASD tab in `Concrete Beam Capacity.html` is a separate engine and is swept on its own branch; see "Other copies" in each entry).

### F8. Effective flange width limit b_eff ≤ b_w + 12h_f (Std. Spec. 8.10.1.1), option on by default   [calc change] [MORE conservative; only when the entered b_eff exceeds b_w + 12h_f in positive moment] (ASD-O6)
- **Where:** sidebar Geometry section (new checkbox after the h_f input, anchor `id="cbasd_beff_lim"`); `calculate()` (anchors `let b_calc, beffLim = null, beffEntered = null;` and `// Std. Spec. 8.10.1.1: flange overhang`); `updateUI()` report top (anchor `Entered $b_{eff}$`); `saveToJson()` / `loadFromJson()` (anchor `cbasd_beff_lim`).
- **Problem:** b_eff was used exactly as entered. An over-entered b_eff (e.g. the girder spacing on a thin slab) raises ρ's denominator, lowers kd and raises z and the concrete capacity: unconservative.
- **Governing provision:** AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 8.10.1.1: the effective flange overhang on each side of the web shall not exceed six times the slab thickness, nor one-half the clear distance to the next web, and the total effective width shall not exceed one-fourth of the span. Only the 6h_f limit can be applied (the tool has no span or web-spacing input). Art. 8.10.1.2 (slab on one side only: b_w + 6h_f) is not applied, because the tool does not know whether the girder is interior or exterior; the report says so.
- **Behaviour:** positive-moment T-beam only (negative moment and rectangular sections use b_w, unchanged). When b_w > 0 and b_eff > b_w + 12·max(0, h_f): with the option on (default), b_eff = b_w + 12h_f is used for ρ, kd, z, the compression force and the drawing, and an amber note in the report gives the entered value and the limit; with the option off, the entered width is used and a red note says the limit is switched off. In both cases the note says the span/4, web-spacing and one-sided-slab limits are not checked. Default chosen: **on**, because 8.10.1.1 is a code requirement; the switch is there for a case where h_f as entered is not the slab thickness the engineer means.
- **Saved data:** one new optional JSON field `cbasd_beff_lim` (boolean, tool-prefixed). Older files have no such field, so the option is set to its default (on) on load (an old file whose b_eff exceeds the limit now rates with the capped width and shows the note). All other keys and values are unchanged. No storage key change.
  Edit `beff-chk`:
- **Before:**
  ```html
                          <div class="inp-group flange-input">
                              <label>Flange Thk ($h_f$)</label>
                              <input type="number" id="h_f" value="7.0" class="inp-field trigger-calc">
                              <span class="inp-unit">in</span>
                          </div>
  ```
- **After:**
  ```html
                          <div class="inp-group flange-input">
                              <label>Flange Thk ($h_f$)</label>
                              <input type="number" id="h_f" value="7.0" class="inp-field trigger-calc">
                              <span class="inp-unit">in</span>
                          </div>
                          <label class="flange-input col-span-2 -mt-2 text-[10px] text-slate-600 cursor-pointer"><input type="checkbox" id="cbasd_beff_lim" checked class="trigger-vis accent-blue-600"> Limit $b_{eff}$ to $b_w + 12h_f$ (Std. Spec. 8.10.1.1)</label>
  ```
  Edit `beff-decl`:
- **Before:**
  ```js
              let b_calc;
              if (shape === 'rect') {
  ```
- **After:**
  ```js
              let b_calc, beffLim = null, beffEntered = null;
              if (shape === 'rect') {
  ```
  Edit `beff-cap`:
- **Before:**
  ```js
              } else {
                  // T-Beam
                  b_calc = isPosMoment ? v.b_eff : v.b_w; // Pos uses eff width, Neg uses web
              }
  ```
- **After:**
  ```js
              } else {
                  // T-Beam
                  // Std. Spec. 8.10.1.1: flange overhang each side <= 6 h_f, so b_eff <= b_w + 12 h_f (positive moment only;
                  // the span/4 and web-spacing limits are not checked: no inputs). Option, on by default.
                  if (isPosMoment && v.b_w > 0) {
                      beffLim = v.b_w + 12 * Math.max(0, v.h_f);
                      if (v.b_eff > beffLim) {
                          beffEntered = v.b_eff;
                          if (document.getElementById('cbasd_beff_lim').checked) v.b_eff = beffLim;
                      }
                  }
                  b_calc = isPosMoment ? v.b_eff : v.b_w; // Pos uses eff width, Neg uses web
              }
  ```
  Edit `res`:
- **Before:**
  ```js
                  rf_inv, rf_op, v, shape, b_calc, n_raw, allowSrc
              });
  ```
- **After:**
  ```js
                  rf_inv, rf_op, v, shape, b_calc, n_raw, allowSrc, beffLim, beffEntered,
                  beffCapped: beffEntered !== null && v.b_eff === beffLim
              });
  ```
  Edit `save`:
- **Before:**
  ```js
              ['chk_inv', 'chk_op'].forEach(id => { data[id] = document.getElementById(id).checked; });
              data._allowOverride
  ```
- **After:**
  ```js
              ['chk_inv', 'chk_op', 'cbasd_beff_lim'].forEach(id => { data[id] = document.getElementById(id).checked; });
              data._allowOverride
  ```
  Edit `load`:
- **Before:**
  ```js
                      if (el.type === 'checkbox') el.checked = !!data[k];
                      else el.value = data[k];
                  });
  ```
- **After:**
  ```js
                      if (el.type === 'checkbox') el.checked = !!data[k];
                      else el.value = data[k];
                  });
                  // Files saved before the b_eff limit option have no 'cbasd_beff_lim': use the default (on).
                  if (data.cbasd_beff_lim === undefined) document.getElementById('cbasd_beff_lim').checked = true;
  ```
  The report note is part of edit `scope` (F11).
- **§4 callout:**
  - Before: `b_calc = b_eff` (as entered). After: `b_calc = min(b_eff, b_w + 12·h_f)` (positive-moment T-beam, option on).
  - Provision: AASHTO Std. Spec. 17th Ed. (2002) Art. 8.10.1.1.
  - **Check case 1 (flange in compression, steel governs):** f'c = 3,000 psi, Gr 40 (fc,inv 1,200, fs,inv 20,000, fc,op 1,900, fs,op 28,000), b_eff = **120**, h_f = 7, b_w = 14, d = 28.5, A_s = 8.00, M_DL = 250, M_LL+I = 400. n = round(29,000,000 / (57,000·√3000)) = round(9.29) = 9. Limit = 14 + 12·7 = **98 in.**
    - Before (b = 120): ρ = 8/(120·28.5) = 0.002339, ρn = 0.02105, k = √(2·0.02105 + 0.02105²) − 0.02105 = 0.1852, kd = 5.279 in. (< h_f, rectangular), j = 0.9383, z = 26.740 in. M_steel,inv = 8·20,000·26.740/12,000 = **356.5 k-ft** (M_conc,inv 846.9), M_op = 8·28,000·26.740/12,000 = **499.2**; RF_inv = (356.5 − 250)/400 = **0.266**, RF_op = **0.623**.
    - After (b = 98): ρ = 8/(98·28.5) = 0.002864, ρn = 0.02578, k = 0.2027, kd = 5.778 in., j = 0.9324, z = 26.574 in. M_steel,inv = 8·20,000·26.574/12,000 = **354.3 k-ft** (M_conc,inv 752.4), M_op = **496.0**; RF_inv = **0.261**, RF_op = **0.615**. More conservative.
  - **Check case 2 (T-beam action, concrete governs):** same but h_f = 3, A_s = 14.00. Limit = 14 + 36 = **50 in.**
    - Before (b_eff = 120): kd = 8.122 in. (T-beam action), z = 26.876 in.; M_conc,inv 849.6, M_steel,inv **627.1** → M_inv 627.1 k-ft, M_op 877.9; RF 0.943 / 1.570.
    - After (b_eff = 50): kd = 11.843 in., z = 25.894 in.; M_conc,inv **458.9**, M_steel,inv 604.2 → M_inv **458.9 k-ft** (concrete), M_op **726.6** (concrete; steel 845.9); RF_inv = (458.9 − 250)/400 = **0.522**, RF_op = **1.191**. More conservative.
  - Default inputs (b_eff 90 ≤ 98): unchanged (353.3 / 494.7 k-ft, RF 0.258 / 0.612). b_eff = 98 exactly: unchanged (354.3 / 496.0).
  - Note: the previous tests' "T-beam action" state (b_eff 90, h_f 3, A_s 14) is also capped (90 > 50): 622.0 / 870.8, RF 0.930 / 1.552 → 458.9 / 726.6, RF 0.522 / 1.191.
- **How verified:** see "Verification (sweep)" below.
- **Other copies:** the suite ASD tab (`Concrete Beam Capacity.html`, `compute()`) has the same gap; not changed here (separate engine, separate branch).

### F9. Warning when a steel allowable has no grade rule (stale value)   [display / bug] [no result change] (ASD-O2, partial)
- **Where:** `updateUI()`, report section 3, after the "Allowables (psi)" line. Anchor: `has no automatic rule for`.
- **Problem:** for f_y other than 40,000 / 50,000 / 60,000 psi (f_s,inv) or 40,000 / 60,000 psi (f_s,op), `applyAutoAllowables()` leaves the field as it is. The value can therefore be left over from an earlier f_y: e.g. f_y 60,000 → 50,000 keeps the Gr 60 operating value 36,000 psi, and f_y 33,000 keeps 20,000 / 28,000 psi. The only sign was the small "(input (no grade rule))" tag in the collapsed allowables box. Possibly unconservative, and silent.
- **Fix:** a red note in the report for each such allowable, giving f_y and the value used, and asking for a check against MBE Table 6B.6.2.3-1. The values are not changed (the values for those grades need the engineer, see Needs engineer E2).
- **Governing provision:** AASHTO MBE 3rd Ed. Part B, Table 6B.6.2.3-1 (verify table number in the printed edition).
  Edit `allow-warn`:
- **Before:**
  ```js
                          <p class="text-xs text-slate-500 mb-2">Allowables (psi): $f_{c,inv}$ = ${res.v.fc_inv} (${res.allowSrc.fc_inv === 'auto' ? "0.40f'c" : res.allowSrc.fc_inv}); $f_{s,inv}$ = ${res.v.fs_inv} (${res.allowSrc.fs_inv === 'auto' ? 'by grade' : res.allowSrc.fs_inv}); $f_{c,op}$ = ${res.v.fc_op} (input); $f_{s,op}$ = ${res.v.fs_op} (${res.allowSrc.fs_op === 'auto' ? 'by grade' : res.allowSrc.fs_op}).</p>
  ```
- **After:**
  ```js
                          <p class="text-xs text-slate-500 mb-2">Allowables (psi): $f_{c,inv}$ = ${res.v.fc_inv} (${res.allowSrc.fc_inv === 'auto' ? "0.40f'c" : res.allowSrc.fc_inv}); $f_{s,inv}$ = ${res.v.fs_inv} (${res.allowSrc.fs_inv === 'auto' ? 'by grade' : res.allowSrc.fs_inv}); $f_{c,op}$ = ${res.v.fc_op} (input); $f_{s,op}$ = ${res.v.fs_op} (${res.allowSrc.fs_op === 'auto' ? 'by grade' : res.allowSrc.fs_op}).</p>
                          ${['fs_inv', 'fs_op'].filter(id => res.allowSrc[id] === 'input (no grade rule)').map(id => `<p class="text-xs text-red-700 bg-red-50 p-2 rounded border border-red-200 mb-2">$f_y$ = ${res.v.fy} psi has no automatic rule for ${id === 'fs_inv' ? '$f_{s,inv}$' : '$f_{s,op}$'}: the value used (${res.v[id]} psi) is the field's current entry and may be left from an earlier $f_y$. Check it against AASHTO MBE Table 6B.6.2.3-1.</p>`).join('')}
                          ${res.v.fc_op > 0.60 * res.v.fc + 1e-9 ? `<p class="text-xs text-amber-800 bg-amber-50 p-2 rounded border border-amber-200 mb-2">Operating $f_c$ = ${res.v.fc_op} psi is greater than $0.60f'_c$ = ${+(0.60 * res.v.fc).toFixed(1)} psi (AASHTO MBE 6B.6.2.3). Confirm the owner's basis for this value (the 1,900 psi default is a MassDOT value).</p>` : ''}
  ```
  (This edit also carries F10's note, the second added line.)
- **Check case:** f_y = 60,000 then 50,000 (default otherwise): before and after M_op = 636.0 k-ft (fs,op = 36,000 kept), RF_op 0.965; after, the report shows "f_y = 50000 psi has no automatic rule for f_s,op: the value used (36000 psi) is the field's current entry and may be left from an earlier f_y …". f_y = 33,000: notes for both f_s,inv (20,000) and f_s,op (28,000). Results identical to main.
- **Other copies:** suite ASD tab: same auto rule; not changed here.

### F10. Note when operating f_c exceeds 0.60f'c   [display] [no result change] (ASD-O1, partial)
- **Where:** `updateUI()`, report section 3 (second added line of edit `allow-warn` above). Anchor: `Confirm the owner's basis for this value`.
- **Problem:** the operating concrete allowable defaults to 1,900 psi (MassDOT), which is 0.633f'c at 3,000 psi and above the MBE value 0.60f'c = 1,800 psi, with no indication in the report.
- **Fix:** when f_c,op > 0.60f'c, an amber note gives both values and asks for the owner's basis. The 1,900 psi default and the value used are **not** changed (MassDOT value; Needs engineer E1).
- **Governing provision:** AASHTO MBE 3rd Ed. Part B, Art. 6B.6.2.3 (operating f_c = 0.60f'c; verify in the printed edition).
- **Check case:** default (f'c 3,000, f_c,op 1,900): note "Operating f_c = 1900 psi is greater than 0.60f'c = 1800 psi …"; f_c,op = 1,800: no note. Results unchanged (353.3 / 494.7, RF 0.258 / 0.612).
- **Other copies:** suite ASD tab (CBC-O13d): not changed here.

### F11. Basis line (specification and edition) in the report   [docs] [no result change] (ASD-O8)
- **Where:** `updateUI()`, report top, after the scope note. Anchor: `<p class="text-xs text-slate-500">Basis: AASHTO Standard Specifications`.
- **Problem:** the tool cited "AASHTO 8.15.2" with no document or edition.
- **Fix:** one line: "Basis: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 8.15 (service load design) and 8.10.1 (effective flange width); AASHTO Manual for Bridge Evaluation, 3rd Ed., Part B, Art. 6B.6.2.3 (operating allowables)." The editions are the ones this fix log has used since F1 (17th Ed.) and the repository's MBE basis (3rd Ed.). The engineer should confirm (Needs engineer E5). The header badge "AASHTO 8.15.2" and the navbar subtitle are unchanged. The same edit also adds the F8 note.
  Edit `scope`:
- **Before:**
  ```js
                      <div class="text-xs text-amber-800 bg-amber-50 p-3 rounded border border-amber-200"><strong>Scope:</strong> singly reinforced flexure only (working stress, AASHTO Std. Spec. 8.15). Compression steel (8.15.3, 2n&middot;A's) is ignored and ASD shear (8.15.5) is not checked.</div>
  ```
- **After:**
  ```js
                      <div class="text-xs text-amber-800 bg-amber-50 p-3 rounded border border-amber-200"><strong>Scope:</strong> singly reinforced flexure only (working stress, AASHTO Std. Spec. 8.15). Compression steel (8.15.3, 2n&middot;A's) is ignored and ASD shear (8.15.5) is not checked.</div>
                      <p class="text-xs text-slate-500">Basis: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 8.15 (service load design) and 8.10.1 (effective flange width); AASHTO Manual for Bridge Evaluation, 3rd Ed., Part B, Art. 6B.6.2.3 (operating allowables).</p>
                      ${res.beffEntered !== null ? `<div class="text-xs ${res.beffCapped ? 'text-amber-800 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200'} p-3 rounded border">Entered $b_{eff}$ = ${res.beffEntered} in. exceeds the Std. Spec. 8.10.1.1 limit $b_w + 12h_f$ = ${res.v.b_w} + 12&middot;${res.v.h_f} = ${+res.beffLim.toFixed(3)} in. ${res.beffCapped ? `$b_{eff}$ = ${+res.beffLim.toFixed(3)} in. is used.` : '<strong>The limit is switched off: the entered width is used.</strong>'} The span/4 and web-spacing limits (8.10.1.1) and the one-sided-slab limit $b_w + 6h_f$ (8.10.1.2) are not checked here; check them by hand.</div>` : ''}
  ```
- **Check case:** display only; printed with the report.
- **Other copies:** none.

### N2. ASD-O7 "KaTeX re-typesets the whole page on every keystroke" — closed, no change
- **Finding:** `renderMathInElement(document.body, …)` runs on every `calculate()`. After the first run the sidebar and header math is already converted to KaTeX markup (no `$` delimiters left in those text nodes), so later runs only typeset the freshly written report; the rest is a text-node scan. No visible delay in the tests (each state settled within the 50 ms wait). Harmless; the inventory recommendation was "leave". Not changed.

### Verification (sweep)
- `node --check` on the extracted inline script: OK.
- Headless Chromium (Playwright, Chromium 1194, `file://`), main (`origin/main`) vs branch. CDNs blocked, so served locally: KaTeX 0.16.9 (pinned version), `@phosphor-icons/web` 2.1.2 (pinned), Tailwind 3.4.17 CSS compiled from the main and branch files and injected in place of the Play CDN script (same CSS for both). 26 states plus 2 load cases: default, rect, neg, neg+rect, Inventory off, Operating off, Gr 60 + f'c 4,000, f_s,inv override, override + Recompute, 5 #10 bars, T-beam action (h_f 3, A_s 14), f'c 0, d 0, b_eff 0, M_LL+I 0, non-numeric f_c,op, f_c,op 1,800, b_eff 98, b_eff 120, b_eff 120 with the option off, b_eff 120 negative moment, b_eff 120 rectangular, b_eff 120 + T-beam action, h_f 0, f_y 50,000, f_y 60,000 → 50,000, f_y 33,000; loading an older-format file (no `_allowOverride`) and an older file with b_eff 120 (no `cbasd_beff_lim`; option switched off in the session first, to show the load resets it to on).
- Result cards, badge, and the report text with the new notes removed: **identical** in every state except the four where the entered b_eff exceeds b_w + 12h_f with the option on (b_eff 120; b_eff 120 + T-beam action; T-beam action, which has b_eff 90 > 50; older file with b_eff 120), whose values are the F8 check cases. In the h_f = 0 state the capped width equals b_w; results are identical, only the displayed ρ (now on b_w) and the drawn width change.
- Saved JSON: identical except the new `cbasd_beff_lim` field. Save → Load round trip into a fresh page reproduces the same JSON and results in every state (branch). Sidebar values identical (except the new checkbox). localStorage: only the existing `cbasd_inputTab_v1`.
- No console errors or page errors in main or branch.
- Screenshots (Geometry tab with the new checkbox; report with the F8/F9/F10 notes) checked by eye: the checkbox sits under the b_eff/h_f row, hidden for a rectangular section like the flange inputs; the notes render with KaTeX.

### Needs engineer (sweep 2026-10-12)
- **E1 (ASD-O1 / CBC-O13d).** Operating f_c default 1,900 psi: what is the MassDOT source? If none, should the default become 0.60f'c (auto, like f_c,inv)? Recommendation: auto 0.60f'c (MBE 6B.6.2.3) with the field still overridable, unless MassDOT confirms 1,900 psi. A note now shows when f_c,op > 0.60f'c (F10).
- **E2 (ASD-O2).** Steel allowables for f_y other than 40/50/60 ksi (structural/unknown grade, Gr 50 operating, Gr 75): which values from MBE Table 6B.6.2.3-1 should be automated? Recommendation: automate exactly the table rows from the printed MBE; until then the report warns (F9).
- **E3 (ASD-O3).** Should the MBE modular-ratio table (by f'c range) govern instead of n = round(Es/Ec) ≥ 6 (Std. Spec. 8.15.3.4)? Recommendation: add it as an option with the current formula as the default (the effect is mixed: larger n lowers steel-governed capacity slightly and raises concrete-governed capacity).
- **E4 (ASD-O4).** Compression steel (8.15.3, 2n·A's) and ASD shear (8.15.5): wanted? Recommendation: only if doubly reinforced or shear ratings are run in this tool; the scope note stays.
- **E5 (ASD-O8).** Confirm the editions in the new basis line: Std. Spec. 17th Ed. (2002) and MBE 3rd Ed.
- **E6 (ASD-O5 / X-D10).** Tailwind Play CDN (development-only runtime): replace it with an inlined compiled stylesheet? Needs the answer on CDN reachability from the work laptop. Recommendation: inline the compiled CSS (about 24 kB).
- **E7 (ASD-A2).** Engineer's own check of the page styling after the Tailwind pin (L1).
- **E8 (ASD-O9).** Narrow screens: is a stacked (mobile) layout wanted? Recommendation: no, unless the tool is used on a phone/tablet.
- **E9 (ASD-C7).** Retire this standalone tool, or label it as superseded by the suite ASD tab? Recommendation: keep it until the suite tab has the same fixes (F1–F11), then label it.

### Remaining open items (with recommendation, no engineer input needed)
- **R1 (from F8).** The span/4 and web-spacing limits of 8.10.1.1 and the one-sided-slab limit of 8.10.1.2 cannot be checked without inputs. Recommendation: optional "span length" and "web spacing / interior-exterior" inputs (new optional JSON fields, tool-prefixed).

## Open items (not changed)
- O1. (Report note added by F10 on 2026-10-12; value unchanged. See Needs engineer E1.) **Operating fc = 1,900 psi default** (= 0.633f'c at 3,000 psi; MBE 6B.6.2.3 gives 0.60f'c = 1,800 psi). Kept as the default and as a plain input (not auto-computed), per the engineer's instruction. — Needs MassDOT confirmation of the source of 1,900 psi.
- O2. (Report warning added by F9 on 2026-10-12; see Needs engineer E2.) **Steel allowables for grades other than 40/50/60** (e.g. unknown/structural grade 33, Gr 50 operating, Gr 75) have no auto rule: the field keeps whatever is entered and is tagged "(input (no grade rule))". — Confirm the values to use (MBE Table 6B.6.2.3-1) if these grades should be automated.
- O3. **MBE modular-ratio table** (e.g. n = 10 for f'c 3,000–3,999 psi for older bridges) is not applied; the tool uses n = round(29,000,000 / (57,000√f'c)) ≥ 6. — Decide whether the MBE table should govern for rating.
- O4. **Compression steel (8.15.3, 2n·A's) and ASD shear (8.15.5)** are still not modelled. A visible scope note was added. — Implementing them is a feature addition; decide if wanted.
- O5. **CDN dependencies**: versions pinned 2026-10-09 (L1): Tailwind Play CDN 3.4.17, `@phosphor-icons/web@2.1.2`. Still open: the Tailwind Play CDN is meant for development only.
- O6. **Resolved 2026-10-12 by F8** (b_eff ≤ b_w + 12h_f, option on by default). The span/4 and web-spacing limits remain (R1). Negative-moment T-beam uses b_w (unchanged).
- O7. **Closed 2026-10-12 (N2 of the sweep):** harmless; not changed.
- O8. **Basis line added 2026-10-12 (F11).** — Confirm the editions cited (Needs engineer E5).
- O9. **Narrow screens (about 400 px)**: the sidebar is a fixed 380 px column beside `<main>`, so `<main>` is squeezed to a sliver and the navbar text wraps. Same before and after the tabs change (the body has `overflow: hidden`, so there is no page scroll). Not changed (UI layout, CLAUDE.md §6). — Decide whether a stacked mobile layout is wanted.

## 2026-10-18 — PR: claude/asd-d11-report — D11: calculation-sheet report and §6 derivation links (Tier 1, display only; PR #286: https://github.com/mlococo88/All-Structural/pull/286)

Line numbers are approximate; search for the anchor text. The tool file uses CRLF line endings (kept). Edits were scripted exact-string replacements (each anchor found once).

- **Engineer request:** AUDIT.md D11 (2026-10-14; scope 2026-10-18: full report for design-check tools) and the CLAUDE.md §6 "show the work and link to it" guideline.
- **Relation to the suite's ASD tab** (`Concrete Beam Capacity.html`, `#suite-frame-asd`, D11 in PR #275): a different app with the same calculation engine (AUDIT.md §2.1), not a CLAUDE.md §3 shared snippet. The format was copied from it: the same report CSS rules (under `#cbasdPrintReport`), the same `@page` boxes and margins, the same cover heading, the same three sections and the same five Analysis cards in the same order, the same result-line form and PASS rule, the same "see §n.k" rewrite. The code is not byte-identical, and the suite file is not touched.

### D11-1. Calculation-sheet report (what Print / Ctrl+P outputs changes)
- **Before (print):** a dump of the screen: navbar, the two result cards, the section visualizer and the "Checkable Calculation Report" panel (sections 1–4). No cover, references, contents, result lines, page header or footer (default project: 3 pages).
- **After (print):** only `#cbasdPrintReport` prints (the screen is hidden by a print rule); on screen it is hidden. It is rebuilt at the end of `updateUI()` / `showInputErrors()` and on `beforeprint`. The `@page` CSS is applied on `beforeprint` and cleared on `afterprint` (`cbasdApplyPageCSS`).
  - **Cover:** "Concrete Beam Load Rating — ASD", "Untitled", the codes; title block Project / Project No. / Description / Calculated by / Date / Sheet / Checked by / Checked date / Method. The tool has **no project fields** and none was added: every field prints "—", with the note "complete the title block by hand".
  - **References** (`CBASD_REFS`, only what the tool cites): Std. Spec. 17th Ed. (2002) Art. 8.15, 8.15.2, 8.15.3, 8.15.3.4, 8.15.5 (not checked), 8.10.1.1 / 8.10.1.2; MBE 3rd Ed. Part B 6B.6.2.3 / Table 6B.6.2.3-1; MassDOT f_c,op = 1,900 psi. The editions are those of the tool's basis line, marked "edition: verify, fix log E5".
  - **Contents** with links. **1. Input Echo:** 1.1 Analysis Options, 1.2 Materials and Allowable Stresses (with the (auto)/(override) tags), 1.3 Section Geometry, 1.4 Reinforcement, 1.5 Applied Loads, 1.6 Section Diagram (the visualizer's SVG). **2. Summary & Rating:** 2.1 table (level, M_all, controlled by, RF, PASS/FAIL, "see §3.4 / §3.5"); 2.2 the report's scope, basis and notes; 2.3 Key Parameters. **3. Analysis:** 3.1–3.5 are a copy of the rendered on-screen report cards, their "k." replaced by "3.k".
  - **Result lines** ("Results — Load Rating"), one per rating level shown, e.g. "Inventory rating: RF = 0.258 (RF = (C − M_DL)/M_LL+I, §3.5; M_all = 353.3 k-ft, steel controlled, §3.4) FAIL". PASS when RF ≥ 1.00 (the RF card's red-below-1.0 rule); M_LL+I = 0 gives N/A. Input-error state: cover, front matter, 1. Input Echo, 2. Results (the error list).
  - **Page boxes:** top "Project No: — / Description: —", "Computed By: — / Checked By: —", "Date: — / Date: —"; bottom "Untitled (ASD Bridge Rater)" and "Page X of Y".
- **Where:** CSS block anchor `/* D11 calculation-sheet report (Gusset Plate Rating / ST-Girder format).`; `<div id="cbasdPrintReport"></div>` after `</main>`; functions before `// --- Initialization ---` (anchor `/* D11 (2026-10-18): calculation-sheet report`): `CBASD_TOOL`, `CBASD_REFS`, `cbasdEsc`, `cbasdPageCSS`, `cbasdApplyPageCSS`, `cbasdLevels`, `cbasdBuildReport`; print hooks in the DOMContentLoaded handler (anchor `// D11: "Worked in" links on the result cards`). Copy them from this version.

### D11-2. On-screen report: every value worked (display only)
- **calculate()** passes values it already computes (no value change). Before: `let k, kd, j, z, isTBeamAction = false;` and `beffCapped: beffEntered !== null && v.b_eff === beffLim`. After: `let k, kd, j, z, isTBeamAction = false, tsolve = null; // …`, the line `tsolve = { A_q, B_q, C_q, y_bar_wings, y_bar_web, C_web_u, C_wings_u, y_total };` after `j = z / v.d_eff;` (T-beam branch), and `beffCapped: beffEntered !== null && v.b_eff === beffLim,` followed by `Es, Ec, n_ratio: Es / Ec, tsolve // D11: …`.
- **updateUI()** report (anchor `<!-- Elastic section properties (D11`):
  - new card **1. Elastic Section Properties**: E_c = 57,000√f′c, E_s/E_c, n = max(6, round(E_s/E_c)) (the 8.15.3.4 note moved here) and ρ = A_s/(b d), stating which width b is;
  - the old cards are renumbered 2–5 and get ids `cbasdCard_na|z|cap|rf` (`data-cr="card"`);
  - T-beam neutral axis: A_q, B_q, C_q substituted and the quadratic root; T-beam lever arm: C_web, ȳ_web, C_wings, ȳ_wings, ȳ_total, z, j substituted;
  - Moment Capacity: C (½ b kd, or C_web + C_wings) and M_c, M_s for each level shown, symbolic → substituted → result;
  - the notes and Key Parameters are wrapped in `data-cr="notes"` / `data-cr="params"`; long equations scroll sideways on screen.
- **Provision:** none. No formula, factor, unit, code reference or result changed (the equations shown are the code in `calculate()`).

### D11-3. §6 links ("Worked in: → Report · n. Card"; "see §n.k" in print)
- Helpers before `// --- Initialization ---` (anchor `/* ---- D11 links (CLAUDE.md §6, 2026-10-18)`): `CBASD_CARDS`, `CBASD_CARD_NO`, `cbasdLink`, `cbasdWorkedIn`, `cbasdGoto`, and one click handler for `a.wkA` (scrolls `<main>` to the card and flashes it; no page scroll, no hash change).
- Links: Moment Capacity card (M_all → 4. Moment Capacity) and Rating Factors card (RF → 5. Load Rating), in the new placeholders `#cbasdWkCap` / `#cbasdWkRF`; Key Parameters (n, ρ → 1.; k → 2.; j → 3.). In print: "M_all: see §3.4", "RF: see §3.5", "n, ρ: see §3.1 · k: see §3.2 · j: see §3.3".

### D11-4. Display fix (no result change)
- Display math inside running text broke the line ("T-Beam Action Detected (", the formula, ")"; likewise in the Inventory/Operating boxes). Before: `T-Beam Action Detected ($$kd > h_f$$)` and `Concrete Limit ($$f_c = ${res.v.fc_inv}$$): <strong>$$${res.M_conc_inv.toFixed(1)} \\text{ k-ft}$$</strong>` (the same for Steel Limit, Operating and both "Governing:" lines). After: single `$…$` (inline math), e.g. `Concrete Limit ($f_c = ${res.v.fc_inv}$): <strong>$${res.M_conc_inv.toFixed(1)} \\text{ k-ft}$</strong>`.

### Check case
- **Default project** (T-beam, f′c 3,000, Gr 40, b_eff 90, h_f 7, b_w 14, d 28.5, A_s 8.00, M_DL 250, M_LL+I 400): E_c = 57,000√3,000 = 3,122,019 psi; E_s/E_c = 9.29 → n = 9; ρ = 8/(90·28.5) = 0.0031; k = 0.2105, kd = 6.000 in (< h_f: rectangular); j = 0.930, z = 26.500 in; C = ½·90·6.000 = 270 in²; M_c,inv = 270·1,200·26.5/12,000 = 715.5 and M_s,inv = 8·20,000·26.5/12,000 = 353.3 → M_inv = 353.3 k-ft; M_op = 494.7; RF 0.258 / 0.612, unchanged. Report: 7 letter pages (main's print: 3), both levels FAIL.
- **T-beam action** (h_f 3, A_s 14; b_eff capped to 50): A_q 7, B_q 234, C_q −3,753, kd 11.843 in, C_web 82.9, C_wings 94.321, ȳ 2.606, z 25.894; M_inv 458.9 (concrete), M_op 726.6; RF 0.522 FAIL / 1.191 PASS; 8 pages.

### Verification (Tier 1)
- `node tests/check-syntax.mjs "Concrete Beam ASD.html"`: all scripts pass.
- `node tests/compare.mjs --tool page --file "Concrete Beam ASD.html"`: page.storage same; page.text differs only by the new report and link lines and the D11-4 delimiters (all numbers identical). Console errors are only the blocked CDN loads, the same on both sides (the kit has no copies of this tool's libraries).
- Own headless comparison (Playwright, Chromium; KaTeX 0.16.9 and @phosphor-icons/web 2.1.2 from `npm pack`; Tailwind 3.4.17 CSS compiled from both files and injected on both sides), origin/main vs branch, 13 cases (default; rectangular −M; T-beam action; Gr 60 + f′c 4,000, operating only; b_eff 120 capped / limit off; f′c 10,000 (n = 6); M_LL+I = 0; T-beam −M; inventory off; f′c = 0; 5 #10 bars; a passing case): the full `calculate()` result object passed to `updateUI` (without the new fields), the result cards and badge, the SVG, the saved JSON, all inputs and localStorage are **identical**. No console errors.
- Report PDFs (print media, `preferCSSPageSize`) looked at: cover, references and contents, Input Echo, section diagram, Summary, Analysis (rectangular and T-beam), results, input-error report. Every TOC entry and "see §" link resolves; no duplicate ids. In-app clicks scroll the report panel to the card and flash it.

### Other copies
- None. The suite's ASD tab is a different app (see above); it already has its own D11 report (PR #275).

### Open items (not changed)
- The tool has no project / title-block fields, so the title block and page header print "—". Adding optional fields (e.g. tool-prefixed keys in the saved JSON) is a decision for the engineer.
- The suite's ASD tab cites the RF equation as "AASHTO MBE 6B (ASD)" and E_c as Std. Spec. 8.7.1. This tool cites neither, so its report does not either (adding them would be a code-reference change, CLAUDE.md §4).


## 2026-11-01 — PR: claude/retire-cbasd — tool retired: the file is now a redirect page to the ASD tab of Concrete Beam Capacity (CBAR) (PR #562: https://github.com/mlococo88/All-Structural/pull/562)

- **Engineer decision (2026-11-01):** retire "Concrete Beam ASD.html". It becomes a small redirect page to the ASD tab of "Concrete Beam Capacity.html", in the same way as `psbeam.html` and `Steel Bridge Beam Modules.html`.
- **New file content (whole file replaced; the old tool is in git history at the commit before this PR):**
  - The page forwards to `Concrete%20Beam%20Capacity.html` + `?query` + `#asd`. CBC opens its ASD tab for `#asd` (see `fixlog/Concrete Beam Capacity.md`, CBAR).
  - Opened as `Concrete Beam ASD.html#old`, the page does not forward. It shows **"Open an old ASD project file"**: a file picker that reads a .json saved by the old tool and lists every value it holds, with unit and where to enter it in Concrete Beam Capacity. A "Copy as text" button copies the list.
  - The page loads no library and writes no storage.
- **Saved data (§5):**
  - **Browser storage:** the old tool kept no project in browser storage. Its only key is `cbasd_inputTab_v1`, the input tab it showed (UI only). The redirect page does not read, change or delete it. No saved data is lost.
  - **Project files:** the old projects are .json files saved with "Save". Their format is a flat `{id: value}` object: `fc`, `fy` (psi); `fc_inv`, `fs_inv`, `fc_op`, `fs_op` (psi, with `_allowOverride`); `b_eff`, `h_f`, `b_w`, `h_total`, `d_eff` (in); `as` (in²); `m_dl`, `m_ll` (kip-ft); `moment_type`; `section_shape`; `bar_count`; `bar_size`; `chk_inv`; `chk_op`; `cbasd_beff_lim`.
  - **Why the files are not imported:** the ASD tab of Concrete Beam Capacity cannot open these files. Its export / import format is structured (`proj`, `mode`, `allow`, `loads`, `inherit`). Its section, materials and reinforcement are taken live from the Beam Capacity tab (bar layers, not a total A_s and d), and they overwrite the ASD tab's own values. A converted file would therefore be partly overwritten without notice.
  - **What users do instead:** the `#old` reader lists the values, and the user enters them again. This is linked from tools.html, under "Open engineer checks".
- **Other copies:** none.
- **How verified (headless Chromium, 1280 and 390 px):**
  - The redirect lands on `Concrete Beam Capacity.html#asd` with the ASD tab active. The console shows only the "failed to load" messages of the CDN files the test blocks; CBC opened without a hash shows the same.
  - `#old` stays on the page and lists a sample old project file (21 values; allowables marked auto / override).
  - CBC with no hash still opens Beam Capacity; `#dev` opens Development & Splice.
  - tools.html now links to `Concrete%20Beam%20Capacity.html#asd`, and no longer to the old file.
