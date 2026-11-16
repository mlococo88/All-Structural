/* apps/crane-pick/ui/sitetab.js — the "Site & map" input tab (C1, 2026-11-16): the State Plane zone of the project, the base map, and
   "go to" a latitude / longitude or a State Plane coordinate (no address search: that needs a geocoding service). */
(function () {
  'use strict';
  const A = window.CranePickApp, G = window.CranePickGeo, esc = A.esc;
  const MP = () => window.CranePickMap;
  let el = null;
  function build(p) {
    el = p;
    p.innerHTML = `<div class="sec"><div class="secHead">Coordinate system</div><div class="secBody">
        <div class="fRow"><label for="stZone">State Plane zone</label><select id="stZone">${G.ZONES.map(z => `<option value="${z.id}">${esc(z.name)}</option>`).join('')}</select></div>
        <p class="note">Positions are kept as State Plane grid coordinates of this zone (US survey feet; a metre zone is shown and entered in metres). Changing the zone keeps every item at the same place on the ground.</p>
        <p class="note">Distances and bearings are grid values (no combined scale factor). Latitude / longitude: NAD 83, shown on the map as WGS 84 (about 1–1.5 m apart): the map places items, it is not a survey.</p></div></div>
      <div class="sec"><div class="secHead">Base map</div><div class="secBody" id="stBase">${Object.keys(MP().BASES).map(k => `<label style="display:block;margin:3px 0"><input type="radio" name="stBase" value="${k}"> ${esc(MP().BASES[k])}</label>`).join('')}
        <p class="note">Map tiles need the internet. With no tiles (offline) choose None and work on a plan sheet (Plan sheets tab).</p></div></div>
      <div class="sec"><div class="secHead">Go to</div><div class="secBody">
        <div class="note">Latitude, longitude (decimal degrees, or degrees minutes seconds, e.g. 42 21 36 N):</div>
        <div class="goRow"><input type="text" id="goLat" placeholder="Latitude" aria-label="Latitude"><input type="text" id="goLng" placeholder="Longitude" aria-label="Longitude"><button type="button" id="goLL">Go</button></div>
        <div class="note" id="goGridLbl">State Plane coordinate:</div>
        <div class="goRow"><input type="text" id="goE" placeholder="Easting" aria-label="Easting"><input type="text" id="goN" placeholder="Northing" aria-label="Northing"><button type="button" id="goEN">Go</button></div>
        <div class="goRow"><button type="button" id="goFit">Show all items</button><button type="button" id="goHome">Zone default view</button></div>
        <p class="note" id="goMsg" role="status"></p>
        <p class="note">Going to an address needs a geocoding service, which this tool does not use: enter the coordinate instead.</p></div></div>`;
    p.querySelector('#stZone').addEventListener('change', e => setZone(e.target.value));
    p.querySelector('#stBase').addEventListener('change', e => { if (e.target.name === 'stBase') MP().setBase(e.target.value); });
    const say = t => { p.querySelector('#goMsg').textContent = t; };
    p.querySelector('#goLL').onclick = () => {
      const lat = G.parseAngle(p.querySelector('#goLat').value), lng0 = G.parseAngle(p.querySelector('#goLng').value);
      if (!(Math.abs(lat) <= 90) || !(Math.abs(lng0) <= 180)) { say('Enter a latitude (−90 to 90) and a longitude (−180 to 180).'); return; }
      const lng = lng0 > 0 && !/[EW]/i.test(p.querySelector('#goLng').value) && lng0 > 60 ? -lng0 : lng0;   // "71.06" in New England means 71.06° W
      say(MP().goTo(lat, lng) ? `Centered on ${MP().llText({ lat, lng })}${lng !== lng0 ? ' (west longitude assumed)' : ''}.` : 'The map is not available.');
    };
    p.querySelector('#goEN').onclick = () => {
      const E = G.parseNum(p.querySelector('#goE').value), N = G.parseNum(p.querySelector('#goN').value);
      if (!isFinite(E) || !isFinite(N)) { say('Enter an easting and a northing.'); return; }
      if (!window.proj4) { say('The map is not available.'); return; }
      const ll = G.nativeToLl(window.proj4, A.P.site.zone, E, N);
      if (!(Math.abs(ll.lat) <= 90) || !isFinite(ll.lng)) { say('That coordinate is outside the zone.'); return; }
      say(MP().goTo(ll.lat, ll.lng) ? `Centered on E ${E}, N ${N} (${MP().llText(ll)}).` : 'The map is not available.');
    };
    p.querySelector('#goFit').onclick = () => { const pts = []; A.P.items.forEach(i => pts.push(...i.pts)); A.P.sheets.forEach(s => [[0, 0], [s.w, s.h]].forEach(([x, y]) => pts.push(G.pxToFt(s.place, x, y))));
      say(pts.length ? (MP().fit(pts) ? '' : 'The map is not available.') : 'No items or plan sheets yet.'); };
    p.querySelector('#goHome').onclick = () => { MP().setView(MP().home()); say(''); };
  }
  function setZone(to) {
    const from = A.P.site.zone; if (to === from) return;
    if (!window.proj4) { A.notice('The zone cannot be changed while proj4js is not loaded.', 'err'); fill(); return; }
    const has = A.P.items.length + A.P.sheets.length;
    A.update(P => { const Q = G.reproject(window.proj4, P, to); Object.assign(P, Q); }, 'site');
    if (has) A.notice(`Zone changed to ${esc(G.zone(to).name)}: ${has} item(s) and plan sheet(s) were converted (same places on the ground). Undo changes it back.`);
    fill();
  }
  function fill() {
    if (!el) return; const z = G.zone(A.P.site.zone);
    el.querySelector('#stZone').value = z.id;
    el.querySelectorAll('input[name=stBase]').forEach(r => { r.checked = r.value === (A.ui.base || 'sat'); });
    el.querySelector('#goGridLbl').textContent = `State Plane coordinate (${z.short}, ${z.unit === 'm' ? 'metres' : 'US survey feet'}):`;
  }
  A.inTab({ id: 'site', label: 'Site & map', build });
  A.on('project', fill); A.on('change', o => { if (o.kind === 'site') fill(); }); A.on('base', fill);
})();
