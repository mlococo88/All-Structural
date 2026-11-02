/* shared/list-input.js — editable list tables in place of comma-separated inputs (window.SharedListInput). Classic script.
   Added 2026-11-02 (engineer decision: no more comma-separated boxes; each short list becomes a small table with one box per
   value, "+ Add" and a "×" remove button per row; a multi-column list gets one box per column).

   Saved data (CLAUDE.md §5): this file never stores anything. A tool keeps its own field and format:
   - a field saved as TEXT (e.g. "2.5, 5") stays text: fromText() reads it with the tool's own separator, toText() writes it back
     in the same form (rows joined by ", " by default), and bindInput() keeps the tool's existing <input> as the hidden source of
     truth, so every line of the tool that reads or writes input.value is unchanged;
   - a field saved as an ARRAY stays an array: fromNumbers() / toNumbers() convert.
   Values are passed on as typed (strings). Checks (not a number, below min, above max) are shown per cell and never change or
   drop a value: the tool's own parser decides what it uses, as before.

   PURE HELPERS (no DOM; tested in Node, tests/engine/list-input.test.mjs)
     splitPaste(text, ncol, { columns, parse }) -> rows   Text pasted or typed into a cell, split into rows of cells:
         several lines or a tab  -> rows by line, cells by tab (Excel); a line without tabs splits at , ; (and spaces when every
                                     column is numeric). A first line with no number where a number is expected (a header) is dropped.
         one line, no tab         -> one column: split at , ; (and spaces when numeric); several columns: o.parse(text) when given
                                     (the tool's own text format, e.g. "20:1.5, 40:1.5"), else split at , ; (spaces) and grouped
                                     ncol at a time.
         Excel copies a column as one value per line, so "1,234" on its own line stays one value.
     fromText(text, { rowSplit = ',', colSplit, ncol }) -> rows   The tool's saved text, split the way the tool splits it.
     toText(rows, { rowSep = ', ', colSep = ', ' }) -> text       Blank rows skipped; cells trimmed.
     fromNumbers(array) -> rows (one column) / fromNumbers(array of arrays) -> rows;  toNumbers(rows, col = 0, num = Number) -> numbers
         (blank and non-numeric cells skipped).
     filled(rows) -> rows without blank rows, cells trimmed strings.   same(a, b, columns) -> true when the filled rows are equal
         (numeric columns compared as numbers).
     checkCell(text, col) -> { level: '' | 'warn' | 'error', msg, value }

   COLUMN SPEC  { label, unit, type: 'number' (default) | 'text', min, max (numbers or functions returning one), minExclusive,
                  maxExclusive, integer, lenient (the tool reads with parseFloat: "5ft" is a warning "read as 5", not an error),
                  rangeNote (text added to a range message, e.g. "outside the beam, not used"), required (in a non-blank row),
                  placeholder, width (CSS, default 7em) }   label and unit may be functions (re-read by relabel()).

   DOM
     mount(host, o) -> ctl     Renders the table into host (an element).
         o = { columns: [spec…], rows: rows or a one-column array of values, onChange(rows, ctl) (filled rows, strings),
               label (accessible name: the table caption), showCaption (default false: caption visually hidden),
               minRows (default 1: a blank row is shown so there is a box to type in), maxRows, addText ('+ Add'),
               cellAttrs(input, r, c) (e.g. a tool's focus-restore key), parse (the tool's one-line text format for pastes),
               rowNumbers (default true) }
         ctl = { el, get() -> filled rows, rows() -> all rows (blanks included), set(rows) (redraw, no onChange),
                 setColumns(cols), relabel() (labels, units and checks again, in place: safe while typing),
                 problems() -> [{ r, c, level, msg }], focus(r, c), destroy() }
         Keyboard: Enter moves down a row and adds one from the last row; in a one-column numeric table "," and ";" do the same.
         Paste or typed text with separators (comma, semicolon, tab, new line) is split into rows (splitPaste) from the cell on.
     bindInput(input, o) -> ctl   For a tool that keeps the list as TEXT in an existing <input>: hides it, mounts the table after
         it, writes toText(rows) back to input.value and fires the input's 'input' and 'change' events when the text changes
         (o.events to choose). A script that sets input.value redraws the table (the instance's value setter is wrapped), so unit
         conversion, undo, project load and drag handles need no change. o.rowSplit / o.colSplit / o.rowSep / o.colSep: the format.
     slot(name) -> '<div data-sli-slot="name"></div>'   for tools that build HTML strings; then mountSlot(root, name, o) -> ctl.
     react(React) -> ListTable component (no JSX, no build step): props { rows, columns, onChange, label, … as mount's o,
         className }. The table is mounted once. When props.rows changes from outside (load, undo, unit change) and differs from
         what the table holds (same()), the table is redrawn; the parent's own echo of a table edit (often with unreadable cells
         dropped, e.g. a number list) is left alone, so a value being typed is never wiped.

   Every element carries data-sli (tests can strip them before comparing a tool's page text). CSS is injected once
   (style[data-sli]) and hidden in print (the tools print their own results). */
(function () {
  'use strict';
  const W = typeof window !== 'undefined' ? window : globalThis;

  /* ---------------- pure helpers ---------------- */
  const clean = v => (v == null ? '' : String(v)).trim();
  const val = (v, a) => (typeof v === 'function' ? v(a) : v);
  const isNumCol = col => !col || col.type !== 'text';
  const asRow = r => (Array.isArray(r) ? r : [r]).map(clean);
  const blank = r => !r || r.every(c => clean(c) === '');
  function filled(rows) { return (rows || []).map(asRow).filter(r => !blank(r)); }
  const fitRow = (r, n) => { r = r.map(clean); while (r.length < n) r.push(''); return r.length > n ? r.slice(0, n) : r; };

  function splitPaste(text, ncol, o) {
    o = o || {}; ncol = Math.max(1, ncol || 1);
    const cols = o.columns || [];
    const allNum = !cols.length || cols.every(isNumCol);
    const t = String(text == null ? '' : text).replace(/\r\n?/g, '\n');
    const lines = t.split('\n'); while (lines.length && lines[lines.length - 1].trim() === '') lines.pop();
    while (lines.length && lines[0].trim() === '') lines.shift();
    const multi = lines.length > 1, tab = t.indexOf('\t') >= 0;
    const inLine = allNum ? /\s*[,;]\s*|\s+/ : /\s*[,;]\s*/;
    let rows;
    if (ncol === 1) {
      const toks = (multi || tab) ? lines.join('\n').split(/[\t\n]/) : t.split(allNum ? /[,;\s]+/ : /[,;]/);
      rows = toks.map(clean).filter(s => s !== '').map(s => [s]);
    } else if (multi || tab) {
      rows = lines.filter(l => l.trim() !== '').map(l => fitRow(tab ? l.split('\t') : l.trim().split(inLine), ncol));
    } else if (typeof o.parse === 'function') {
      rows = o.parse(t).map(r => fitRow(asRow(r), ncol));
    } else {
      const toks = t.split(allNum ? /[,;\s]+/ : /[,;]/).map(clean).filter(s => s !== '');
      rows = []; for (let i = 0; i < toks.length; i += ncol) rows.push(fitRow(toks.slice(i, i + ncol), ncol));
    }
    // a header line (no number where every numeric column expects one) is dropped
    if (rows.length > 1) {
      const numIdx = []; for (let c = 0; c < ncol; c++) if (isNumCol(cols[c])) numIdx.push(c);
      if (numIdx.length && numIdx.every(c => !isFinite(parseFloat(rows[0][c])))) rows.shift();
    }
    return rows.filter(r => !blank(r));
  }

  function fromText(text, f) {
    f = f || {};
    const rs = f.rowSplit == null ? ',' : f.rowSplit;
    const parts = String(text == null ? '' : text).split(rs).map(clean).filter(s => s !== '');
    if (f.colSplit == null) return parts.map(s => [s]);
    const n = f.ncol || 2;
    return parts.map(s => fitRow(s.split(f.colSplit), n));
  }
  function toText(rows, f) {
    f = f || {};
    const rsep = f.rowSep == null ? ', ' : f.rowSep, csep = f.colSep == null ? ', ' : f.colSep;
    return filled(rows).map(r => r.join(csep)).join(rsep);
  }
  function fromNumbers(a) {
    return (a || []).map(v => (Array.isArray(v) ? v.map(x => (x == null || (typeof x === 'number' && !isFinite(x)) ? '' : String(x)))
      : [v == null || (typeof v === 'number' && !isFinite(v)) ? '' : String(v)]));
  }
  function toNumbers(rows, col, num) {
    col = col || 0; num = num || Number;
    const out = [];
    filled(rows).forEach(r => { const s = r[col]; if (s === '' || s == null) return; const v = num(s); if (typeof v === 'number' && isFinite(v)) out.push(v); });
    return out;
  }
  function same(a, b, columns) {
    const A = filled(a), B = filled(b);
    if (A.length !== B.length) return false;
    for (let i = 0; i < A.length; i++) {
      const n = Math.max(A[i].length, B[i].length);
      for (let c = 0; c < n; c++) {
        const x = A[i][c] == null ? '' : A[i][c], y = B[i][c] == null ? '' : B[i][c];
        if (x === y) continue;
        if (isNumCol(columns && columns[c]) && x !== '' && y !== '' && Number(x) === Number(y) && isFinite(Number(x))) continue;
        return false;
      }
    }
    return true;
  }
  const fmtN = v => String(+(+v).toPrecision(6));
  function checkCell(text, col) {
    col = col || {};
    const s = clean(text);
    if (s === '') return { level: col.required ? 'error' : '', msg: col.required ? 'Required' : '', value: null };
    if (!isNumCol(col)) return { level: '', msg: '', value: s };
    let v = Number(s), level = '', msg = '';
    if (!isFinite(v)) {
      const p = parseFloat(s);
      if (col.lenient && isFinite(p)) { v = p; level = 'warn'; msg = 'Read as ' + fmtN(p); }
      else return { level: 'error', msg: 'Not a number', value: null };
    }
    if (col.integer && !Number.isInteger(v)) return { level: 'error', msg: 'Must be a whole number', value: v };
    const lo = val(col.min), hi = val(col.max), note = col.rangeNote ? ' (' + val(col.rangeNote) + ')' : '';
    if (typeof lo === 'number' && isFinite(lo) && (col.minExclusive ? v <= lo : v < lo))
      return { level: 'error', msg: 'Must be ' + (col.minExclusive ? '> ' : '≥ ') + fmtN(lo) + note, value: v };
    if (typeof hi === 'number' && isFinite(hi) && (col.maxExclusive ? v >= hi : v > hi))
      return { level: 'error', msg: 'Must be ' + (col.maxExclusive ? '< ' : '≤ ') + fmtN(hi) + note, value: v };
    return { level, msg, value: v };
  }

  /* ---------------- DOM ---------------- */
  let cssDone = false, uid = 0;
  function css() {
    if (cssDone || typeof document === 'undefined') return; cssDone = true;
    const s = document.createElement('style'); s.setAttribute('data-sli', 'css');
    s.textContent = [
      '.sli{display:inline-block;max-width:100%;vertical-align:top;font-size:inherit;}',
      '.sli .sli-scroll{max-width:100%;overflow-x:auto;}',
      '.sli table.sli-t{border-collapse:collapse;font-size:inherit;width:auto;margin:0;}',
      '.sli .sli-t th,.sli .sli-t td{padding:1px 3px;border:0;text-align:left;vertical-align:top;background:none;}',
      '.sli .sli-t th{font-weight:600;font-size:.92em;opacity:.8;white-space:nowrap;}',
      '.sli .sli-t td.sli-n{font-size:.85em;opacity:.6;text-align:right;padding-top:5px;min-width:1.4em;}',
      // zero specificity (:where): the tool's own input style, when it has one, wins; the error / warning marks below do not
      ':where(.sli input.sli-in){font:inherit;font-size:inherit;box-sizing:border-box;width:7em;padding:2px 5px;margin:0;border:1px solid rgba(120,120,120,.55);border-radius:3px;background:transparent;color:inherit;}',
      ':where(.sli input.sli-in:focus){outline:2px solid #2563eb;outline-offset:0;}',
      '.sli input.sli-in{box-sizing:border-box;margin:0;min-width:0;}',
      '.sli input.sli-in.sli-error{border-color:#dc2626;background:rgba(220,38,38,.08);}',
      '.sli input.sli-in.sli-warn{border-color:#b45309;}',
      '.sli .sli-msg{font-size:.82em;line-height:1.2;max-width:14em;white-space:normal;}',
      '.sli .sli-msg.sli-error{color:#dc2626;} .sli .sli-msg.sli-warn{color:#b45309;}',
      '.sli button.sli-del,.sli button.sli-add{font:inherit;font-size:.92em;line-height:1.2;cursor:pointer;border:1px solid rgba(120,120,120,.45);border-radius:3px;background:transparent;color:inherit;margin:0;}',
      '.sli button.sli-del{padding:1px 6px;} .sli button.sli-add{padding:1px 8px;margin-top:2px;}',
      '.sli button.sli-del:hover{color:#dc2626;border-color:#dc2626;} .sli button.sli-add:hover{border-color:#2563eb;}',
      '.sli button:disabled{opacity:.4;cursor:default;}',
      '.sli .sli-sr,.sli caption.sli-sr{position:absolute!important;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}',
      '.sli caption.sli-cap{caption-side:top;text-align:left;font-weight:600;padding:0 0 2px;}',
      '@media print{.sli{display:none!important;}}'
    ].join('\n');
    (document.head || document.documentElement).appendChild(s);
  }
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  function mount(host, o) {
    css();
    o = Object.assign({ minRows: 1, addText: '+ Add', rowNumbers: true }, o || {});
    let cols = (o.columns && o.columns.length) ? o.columns : [{ label: 'Value' }];
    const id = 'sli' + (++uid);
    let rows = [];
    const ncol = () => cols.length;
    const pad = () => { while (rows.length < Math.max(0, o.minRows)) rows.push(fitRow([], ncol())); };
    const setRows = rs => { rows = (rs || []).map(r => fitRow(asRow(r), ncol())); pad(); };
    setRows(o.rows);

    const el = document.createElement('div'); el.className = 'sli' + (o.className ? ' ' + o.className : ''); el.setAttribute('data-sli', 'box');
    host.appendChild(el);
    const colName = c => { const cl = cols[c] || {}; const u = val(cl.unit); return clean(val(cl.label)) + (u ? ' (' + u + ')' : ''); };
    const full = () => o.maxRows != null && rows.length >= o.maxRows;

    function draw(focusAt) {
      const cap = clean(val(o.label));
      let h = '<div class="sli-scroll" data-sli="scroll"><table class="sli-t" data-sli="table">';
      if (cap) h += `<caption class="${o.showCaption ? 'sli-cap' : 'sli-sr'}" data-sli="cap">${esc(cap)}</caption>`;
      h += '<thead><tr>' + (o.rowNumbers ? '<th scope="col"><span class="sli-sr">Row</span></th>' : '');
      for (let c = 0; c < ncol(); c++) {
        const u = val(cols[c].unit);
        h += `<th scope="col" data-sli-h="${c}">${esc(val(cols[c].label))}${u ? ' <span class="sli-u">(' + esc(u) + ')</span>' : ''}</th>`;
      }
      h += '<th scope="col"><span class="sli-sr">Remove</span></th></tr></thead><tbody>';
      rows.forEach((r, i) => {
        h += `<tr data-sli-r="${i}">` + (o.rowNumbers ? `<td class="sli-n" aria-hidden="true">${i + 1}</td>` : '');
        for (let c = 0; c < ncol(); c++) {
          const cl = cols[c], mid = `${id}-m${i}-${c}`;
          h += `<td><input type="text" class="sli-in" data-sli-c="${c}" autocomplete="off" spellcheck="false"${isNumCol(cl) ? ' inputmode="decimal"' : ''}`
            + ` style="width:${esc(cl.width || '7em')}" aria-describedby="${mid}" value="${esc(r[c])}"${cl.placeholder != null && i === 0 ? ` placeholder="${esc(cl.placeholder)}"` : ''}>`
            + `<div class="sli-msg" id="${mid}" data-sli="msg"></div></td>`;
        }
        h += `<td><button type="button" class="sli-del" data-sli-del="${i}">×</button></td></tr>`;
      });
      h += `</tbody></table></div><button type="button" class="sli-add" data-sli="add">${esc(o.addText)}</button>`;
      el.innerHTML = h;
      relabel();
      if (o.cellAttrs) el.querySelectorAll('input.sli-in').forEach(inp => o.cellAttrs(inp, +inp.closest('tr').getAttribute('data-sli-r'), +inp.getAttribute('data-sli-c')));
      if (focusAt) focus(focusAt[0], focusAt[1]);
    }
    function paint(inp) {
      const r = +inp.closest('tr').getAttribute('data-sli-r'), c = +inp.getAttribute('data-sli-c');
      const ck = blank(rows[r]) ? { level: '', msg: '' } : checkCell(inp.value, cols[c]);
      inp.classList.toggle('sli-error', ck.level === 'error'); inp.classList.toggle('sli-warn', ck.level === 'warn');
      if (ck.level === 'error') inp.setAttribute('aria-invalid', 'true'); else inp.removeAttribute('aria-invalid');
      const m = inp.parentNode.querySelector('.sli-msg');
      m.textContent = ck.msg || ''; m.className = 'sli-msg' + (ck.level ? ' sli-' + ck.level : '');
      inp.title = ck.msg || '';
    }
    function relabel() {
      el.querySelectorAll('th[data-sli-h]').forEach(th => { const c = +th.getAttribute('data-sli-h'), u = val(cols[c].unit);
        th.innerHTML = esc(val(cols[c].label)) + (u ? ' <span class="sli-u">(' + esc(u) + ')</span>' : ''); });
      const cap = el.querySelector('caption'); if (cap) cap.textContent = clean(val(o.label));
      el.querySelectorAll('input.sli-in').forEach(inp => {
        const r = +inp.closest('tr').getAttribute('data-sli-r'), c = +inp.getAttribute('data-sli-c');
        const tl = clean(val(o.label));
        inp.setAttribute('aria-label', colName(c) + ', row ' + (r + 1) + (tl ? ' — ' + tl : ''));
        paint(inp);
      });
      el.querySelectorAll('button.sli-del').forEach(b => { const r = +b.getAttribute('data-sli-del');
        b.setAttribute('aria-label', 'Remove row ' + (r + 1)); b.title = 'Remove row ' + (r + 1); });
      const add = el.querySelector('button.sli-add'); if (add) { add.disabled = full(); add.setAttribute('aria-label', 'Add a row' + (clean(val(o.label)) ? ' — ' + clean(val(o.label)) : '')); }
    }
    function focus(r, c) {
      const inp = el.querySelector(`tr[data-sli-r="${r}"] input[data-sli-c="${c || 0}"]`);
      if (inp) { inp.focus(); try { const n = inp.value.length; inp.setSelectionRange(n, n); } catch (e) { /* not a text field */ } }
      else { const a = el.querySelector('button.sli-add'); if (a) a.focus(); }
    }
    let last = JSON.stringify(filled(rows));
    function emit() {
      const now = JSON.stringify(filled(rows));
      if (now === last) return; last = now;
      if (o.onChange) o.onChange(filled(rows), ctl);
    }
    function addRow(after) {
      if (full()) return false;
      rows.splice(after == null ? rows.length : after + 1, 0, fitRow([], ncol())); return true;
    }
    function insert(r, c, pasted) {
      let lastAt = [r, c];
      pasted.forEach((pr, k) => {
        const ri = r + k;
        if (ri >= rows.length) { if (full()) return; rows.push(fitRow([], ncol())); }
        pr.forEach((v, j) => { if (c + j < ncol()) { rows[ri][c + j] = v; lastAt = [ri, c + j]; } });
      });
      return lastAt;
    }
    const seps = () => (ncol() === 1 && isNumCol(cols[0])) ? /[,;\t\n\r]/ : /[\t\n\r]/;

    el.addEventListener('input', e => {
      const inp = e.target; if (!inp.classList || !inp.classList.contains('sli-in')) return;
      const r = +inp.closest('tr').getAttribute('data-sli-r'), c = +inp.getAttribute('data-sli-c');
      if (seps().test(inp.value)) {   // separators typed or dropped in: split into rows like a paste
        const p = splitPaste(inp.value, ncol() - c, { columns: cols.slice(c), parse: o.parse });
        rows[r][c] = '';
        const at = insert(r, c, p.length ? p : [['']]); draw(at); emit(); return;
      }
      rows[r][c] = inp.value;
      paint(inp);
      el.querySelectorAll(`tr[data-sli-r="${r}"] input.sli-in`).forEach(paint);
      emit();
    });
    el.addEventListener('paste', e => {
      const inp = e.target; if (!inp.classList || !inp.classList.contains('sli-in')) return;
      const cd = e.clipboardData || W.clipboardData, t = cd ? cd.getData('text') : '';
      const r = +inp.closest('tr').getAttribute('data-sli-r'), c = +inp.getAttribute('data-sli-c');
      const p = splitPaste(t, ncol() - c, { columns: cols.slice(c), parse: o.parse });
      const cells = p.reduce((n, pr) => n + pr.filter(x => x !== '').length, 0);
      if (cells <= 1 && !/[\t\n\r]/.test(t.trim())) return;   // one value: the browser's own paste
      e.preventDefault();
      const at = insert(r, c, p); draw(at); emit();
    });
    el.addEventListener('keydown', e => {
      const inp = e.target; if (!inp.classList || !inp.classList.contains('sli-in')) return;
      const r = +inp.closest('tr').getAttribute('data-sli-r'), c = +inp.getAttribute('data-sli-c');
      const sepKey = (e.key === ',' || e.key === ';') && ncol() === 1 && isNumCol(cols[0]);
      if ((e.key === 'Enter' || sepKey) && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        if (r === rows.length - 1) { if (!addRow()) return; draw([r + 1, 0]); }
        else focus(r + 1, e.key === 'Enter' ? c : 0);
      }
    });
    el.addEventListener('click', e => {
      const b = e.target.closest && e.target.closest('button'); if (!b || !el.contains(b)) return;
      if (b.hasAttribute('data-sli-del')) {
        const r = +b.getAttribute('data-sli-del');
        rows.splice(r, 1); pad();
        draw(null);
        const nb = el.querySelector(`button[data-sli-del="${Math.min(r, rows.length - 1)}"]`);
        (nb || el.querySelector('button.sli-add')).focus();
        emit();
      } else if (b.classList.contains('sli-add')) {
        if (addRow()) draw([rows.length - 1, 0]);
      }
    });

    const ctl = {
      el,
      get: () => filled(rows),
      rows: () => rows.map(r => r.slice()),
      set(rs) { setRows(rs); last = JSON.stringify(filled(rows)); const a = document.activeElement, had = a && el.contains(a); draw(null); if (had) { const b = el.querySelector('button.sli-add'); if (b) b.focus(); } },
      setColumns(cs) { cols = (cs && cs.length) ? cs : cols; rows = rows.map(r => fitRow(r, ncol())); draw(null); },
      relabel,
      problems() {
        const out = [];
        rows.forEach((r, i) => { if (blank(r)) return; r.forEach((v, c) => { const ck = checkCell(v, cols[c]); if (ck.level) out.push({ r: i, c, level: ck.level, msg: ck.msg }); }); });
        return out;
      },
      focus,
      destroy() { el.remove(); }
    };
    draw(null);
    return ctl;
  }

  function bindInput(input, o) {
    o = o || {};
    const fmt = { rowSplit: o.rowSplit, colSplit: o.colSplit, ncol: (o.columns || [1]).length, rowSep: o.rowSep, colSep: o.colSep };
    let proto = Object.getPrototypeOf(input), d = null;
    while (proto && !(d = Object.getOwnPropertyDescriptor(proto, 'value'))) proto = Object.getPrototypeOf(proto);
    const getV = () => d.get.call(input), setV = v => d.set.call(input, v);
    const host = document.createElement('div'); host.style.display = 'contents'; host.setAttribute('data-sli', 'host');
    input.insertAdjacentElement('afterend', host);
    input.hidden = true; input.style.display = 'none'; input.tabIndex = -1; input.setAttribute('aria-hidden', 'true');
    const events = o.events || ['input', 'change'];
    const ctl = mount(host, Object.assign({}, o, {
      rows: fromText(getV(), fmt),
      onChange(rows, c) {
        const t = toText(rows, fmt);
        if (t !== getV()) { setV(t); events.forEach(ev => input.dispatchEvent(new Event(ev, { bubbles: true }))); }
        if (o.onChange) o.onChange(rows, c);
      }
    }));
    Object.defineProperty(input, 'value', {
      configurable: true, enumerable: true,
      get() { return getV(); },
      set(v) { setV(v); const rs = fromText(getV(), fmt); if (toText(rs, fmt) !== toText(ctl.get(), fmt)) ctl.set(rs); }
    });
    ctl.input = input;
    const destroy0 = ctl.destroy;
    ctl.destroy = () => { delete input.value; input.hidden = false; input.style.display = ''; input.removeAttribute('aria-hidden'); input.removeAttribute('tabindex'); destroy0(); host.remove(); };
    return ctl;
  }

  const slot = name => `<div data-sli-slot="${esc(name)}"></div>`;
  function mountSlot(root, name, o) {
    const h = (root || document).querySelector(`[data-sli-slot="${String(name).replace(/["\\]/g, '\\$&')}"]`);
    return h ? mount(h, o) : null;
  }

  let reactCmp = null, reactLib = null;
  function react(React) {
    if (reactCmp && reactLib === React) return reactCmp;
    reactLib = React;
    reactCmp = function ListTable(p) {
      const box = React.useRef(null), ctl = React.useRef(null), pr = React.useRef(p), echo = React.useRef(false), prev = React.useRef(null);
      pr.current = p;
      React.useEffect(() => {
        ctl.current = mount(box.current, Object.assign({}, p, { onChange: (rows, c) => { echo.current = true; if (pr.current.onChange) pr.current.onChange(rows, c); } }));
        return () => { if (ctl.current) ctl.current.destroy(); ctl.current = null; };
      }, []);
      const colKey = JSON.stringify((p.columns || []).map(c => [val(c.label), val(c.unit), val(c.min), val(c.max), c.type]));
      React.useEffect(() => { if (ctl.current) ctl.current.setColumns(p.columns); }, [colKey]);
      React.useEffect(() => {
        // props.rows changed from outside (load, undo, unit change) -> redraw; the parent's echo of the table's own change
        // (often with unreadable cells dropped) is left alone, so a value being typed is never wiped
        const c = ctl.current; if (!c) return;
        const want = (p.rows || []).map(asRow), key = JSON.stringify(want);
        const wasEcho = echo.current; echo.current = false;
        if (key === prev.current) return;
        prev.current = key;
        if (wasEcho) return;
        if (!same(c.get(), want, p.columns)) c.set(want);
      });
      return React.createElement('div', { ref: box, className: p.className, 'data-sli': 'react' });
    };
    return reactCmp;
  }

  W.SharedListInput = { splitPaste, fromText, toText, fromNumbers, toNumbers, filled, same, checkCell, mount, bindInput, slot, mountSlot, react, version: 1 };
})();
