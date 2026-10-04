# Fix log — Concrete Beam ASD.html

Governing basis used for fixes: AASHTO Standard Specifications for Highway Bridges, 17th Ed. (2002), Art. 8.15 (Service Load Design); AASHTO Manual for Bridge Evaluation (MBE), Part B (ASD/LFR rating), Art. 6B.6.2.3. MassDOT values kept as-is.

## 2026-10-04 — PR: claude/fix-concrete-asd (PR link added after merge)

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

## 2026-10-04 — PR: claude/step1-group4 (PR link added after merge)
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

## Open items (not changed)
- O1. **Operating fc = 1,900 psi default** (= 0.633f'c at 3,000 psi; MBE 6B.6.2.3 gives 0.60f'c = 1,800 psi). Kept as the default and as a plain input (not auto-computed), per the engineer's instruction. — Needs MassDOT confirmation of the source of 1,900 psi.
- O2. **Steel allowables for grades other than 40/50/60** (e.g. unknown/structural grade 33, Gr 50 operating, Gr 75) have no auto rule: the field keeps whatever is entered and is tagged "(input (no grade rule))". — Confirm the values to use (MBE Table 6B.6.2.3-1) if these grades should be automated.
- O3. **MBE modular-ratio table** (e.g. n = 10 for f'c 3,000–3,999 psi for older bridges) is not applied; the tool uses n = round(29,000,000 / (57,000√f'c)) ≥ 6. — Decide whether the MBE table should govern for rating.
- O4. **Compression steel (8.15.3, 2n·A's) and ASD shear (8.15.5)** are still not modelled. A visible scope note was added. — Implementing them is a feature addition; decide if wanted.
- O5. **CDN dependencies**: Tailwind Play CDN (unpinned, dev-only runtime) and `@phosphor-icons/web` (unpinned, resolves to latest). Not changed (CLAUDE.md §2: no version changes unless asked). — Pin or replace?
- O6. **Negative-moment T-beam** uses b_w; there is no Art. 8.10.1 effective-flange-width check on b_eff. Not changed.
- O7. `renderMathInElement(document.body, …)` re-typesets the whole page on every keystroke (slow but harmless). Not changed.
- O8. No edition is stated in the tool ("AASHTO 8.15.2"). Not changed. — Confirm the Standard Specifications edition to cite.
