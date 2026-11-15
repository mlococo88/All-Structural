/* apps/ps-bridge/ui/mctnav.js — the old app's "↩ MCT Analysis" header button (window.PSBMctNav). Classic script. Created 2026-11-15 (batch G9;
   the old app O:9702 and its bridgeNav(null), O:2477-2486).
   The old app showed the button always; here it is shown when the page was opened from the MCT Generator (index.html at the repo root):
   framed by it (window.top is another page), opened by it in a new tab (window.opener set, document.referrer the MCT's file) or with
   "#from=mct" / "?from=mct" in the address. Click: framed, the old message to the parent window { source: 'bridge-suite', embed: null }
   (the MCT shows itself again, as for the old app); otherwise this tab goes to the MCT Generator, ../../index.html (the old app's built-in
   path for the MCT; the old app's appPaths record of where each app was last opened, bridgeSuite.v1.appPaths, is not read: it is part of
   the switch-over). Nothing is saved; no shared key is read or written.
     fromMct(w) -> 'frame' | 'tab' | ''   back(w, how)   mount(btn, w) */
(function () {
  'use strict';
  const MCT = '../../index.html';
  const isMctFile = u => { try { const p = decodeURIComponent(String(u || '').split(/[?#]/)[0]).replace(/\\/g, '/'); return /\/index\.html$/i.test(p) && !/\/apps\/[^/]+\/index\.html$/i.test(p); } catch (e) { return false; } };
  function fromMct(w) {
    if (!w) return '';
    let framed = false; try { framed = w.self !== w.top; } catch (e) { framed = true; }
    if (framed) return 'frame';
    const loc = w.location || {}, flag = /(^|[?#&])from=mct(&|$)/i.test(String(loc.search || '') + String(loc.hash || ''));
    const ref = w.document && w.document.referrer ? isMctFile(w.document.referrer) : false;
    let op = false; try { op = !!w.opener && isMctFile(w.opener.location.href); } catch (e) { op = false; }   // another file:// page: not readable
    return flag || ref || op ? 'tab' : '';
  }
  function back(w, how) {
    if (how === 'frame') { try { w.parent.postMessage({ source: 'bridge-suite', embed: null }, '*'); return 'message'; } catch (e) { /* fall through */ } }
    w.location.href = MCT; return 'navigate';
  }
  function mount(btn, w) {
    if (!btn) return ''; const how = fromMct(w); btn.hidden = !how;
    if (how) btn.onclick = () => back(w, how);
    return how;
  }
  window.PSBMctNav = { MCT, fromMct, back, mount, isMctFile };
})();
