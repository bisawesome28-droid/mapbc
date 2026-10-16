// The web page: the campus map with every mapped building's floor plans, search, directions and the blue dot.
// What it shows comes from the school's data files (schools/<id>/, JSON); how it looks from core/style.js; routes and
// search from core/logic.js; floor plans as map shapes from core/indoor.js. This file is only the web screen around them,
// so a native app reuses everything in core/ and the data, and rewrites only this part.
(function () {
  var ML = window.MapLogic, MI = window.MapIndoor, MS = window.MapSchool, STYLE = window.MapStyle;
  var VERSION = '2026-10-16 v'; // bump when you publish a change, so you can see which copy of the page is running
  var TYPES = {
    classroom: 'Classroom', office: 'Offices', service: 'Service center', it: 'IT suite',
    common: 'Common area', conf: 'Conference room', core: 'Stairs, elevators, restrooms',
    connector: 'Connector'
  };
  var LEGEND = ['classroom', 'office', 'service', 'it', 'common', 'conf', 'core'];
  var QUICK = [['Restrooms', 'restrooms'], ['Elevators', 'elevators'], ['Cafe', 'cafe'], ['Advising', 'advising']];
  var REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  // The inside of a building shows once you are zoomed in past the whole building: its width or its height, whichever
  // is bigger, is at least this share of the map on screen (so you have to want to see inside it).
  var SHOW_INSIDE_AT = 1.0;
  var OPEN_ZOOM = 18.6; // zoomed in this far, the middle of the screen over a building opens it, however small the building is
  var TILT_PITCH = 45, MAX_PITCH = 60; // 3D is optional: the map opens flat and the "3D" button tilts it

  // Icons: plain 24x24 line drawings.
  var ICONS = {
    straight: '<path d="M12 20V5M6 11l6-6 6 6"/>',
    left: '<path d="M18 20v-8a4 4 0 0 0-4-4H6M10 4 6 8l4 4"/>',
    right: '<path d="M6 20v-8a4 4 0 0 1 4-4h8M14 4l4 4-4 4"/>',
    'sharp-left': '<path d="M18 20V10a4 4 0 0 0-4-4H7M10 2 6 6l4 4"/>',
    'sharp-right': '<path d="M6 20V10a4 4 0 0 1 4-4h7M14 2l4 4-4 4"/>',
    around: '<path d="M7 20V9a4 4 0 0 1 8 0v8M11 13l4 4 4-4"/>',
    start: '<circle cx="12" cy="12" r="4.5"/>',
    up: '<path d="M4 20h5v-5h5v-5h6"/><path d="M14 4h6v6M20 4l-7 7"/>',
    down: '<path d="M4 20h5v-5h5v-5h6"/><path d="M13 5v6h6M13 11l7-7"/>',
    arrive: '<path d="M6 21V4M6 4h12l-2.5 4.5L18 13H6"/>',
    route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H14a3 3 0 0 0 0-6h-4a3 3 0 0 1 0-6h5.5"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.800 12 21 12 21z"/><circle cx="12" cy="9.500" r="2.500"/>',
    moon: '<path d="M20.500 14.500A8.500 8.500 0 0 1 9.500 3.500a8.500 8.500 0 1 0 11 11z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.900 4.900l1.400 1.400M17.700 17.700l1.400 1.400M4.900 19.100l1.400-1.400M17.700 6.300l1.400-1.400"/>',
    chev: '<path d="m6 9 6 6 6-6"/>',
    crosshair: '<circle cx="12" cy="12" r="3.500"/><path d="M12 2.500v4M12 17.500v4M2.500 12h4M17.500 12h4"/>'
  };
  function icon(name, cls) {
    var s = document.createElement('span');
    s.className = 'ico' + (cls ? ' ' + cls : '');
    s.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + (ICONS[name] || ICONS.straight) + '</svg>';
    return s;
  }
  function fillIcon(id, name) { var t = document.getElementById(id); t.textContent = ''; t.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICONS[name] + '</svg>'; }
  var $ = function (id) { return document.getElementById(id); };
  function h(tag, attrs, kids) {
    var e = document.createElement(tag);
    for (var k in (attrs || {})) {
      if (k === 'class') { e.className = attrs[k]; } else if (k === 'text') { e.textContent = attrs[k]; } else { e.setAttribute(k, attrs[k]); }
    }
    (kids || []).forEach(function (c) { if (c != null) { e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); } });
    return e;
  }
  function swatch(type, cls) { var s = h('span', { 'class': cls || 'sw' }); s.style.background = 'var(--c-' + type + ')'; return s; }
  function readUrl() {
    var p = {};
    location.search.replace(/^\?/, '').split('&').forEach(function (kv) {
      var i = kv.indexOf('=');
      if (i > 0) { p[kv.slice(0, i)] = decodeURIComponent(kv.slice(i + 1)); }
    });
    return p;
  }
  function showError(text) {
    var bar = $('levelbar');
    bar.style.display = ''; bar.textContent = '';
    bar.appendChild(h('div', { 'class': 'blanknote', text: text }));
  }

  // ---------- Loading the school's data ----------
  // schools/index.json says which schools exist and which opens by default; ?school=<id> picks another one.
  // Every file is JSON, so a native app can read the very same files.
  function getJson(url) {
    return fetch(url + (url.indexOf('?') < 0 ? '?v=' : '&v=') + encodeURIComponent(VERSION), { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) { throw new Error(url + ': ' + r.status); }
      return r.json();
    });
  }
  function load() {
    var want = readUrl().school;
    return getJson('schools/index.json').then(function (idx) {
      var entry = null;
      (idx.schools || []).forEach(function (s) { if (s.id === (want || idx['default'])) { entry = s; } });
      if (!entry) { entry = (idx.schools || [])[0]; }
      var dir = 'schools/' + (entry.folder || entry.id) + '/';
      return getJson(dir + 'school.json').then(function (school) {
        var f = MS.files(school), opt = function (p) { return p ? getJson(dir + p) : Promise.resolve(null); };
        return Promise.all([opt(f.campus.data), opt(f.campus.base), opt(f.campus.extras), opt(f.campus.categories), Promise.all(f.buildings.map(function (p) { return getJson(dir + p); }))])
          .then(function (r) { return MS.prepare(school, { data: r[0], base: r[1], extras: r[2], categories: r[3] }, r[4]); });
      });
    });
  }

  load().then(start, function (err) {
    var local = location.protocol === 'file:';
    showError(local
      ? 'The map data cannot load from a file on disk (browsers block it). Open it through a web server: in this folder run "python3 -m http.server" and go to http://localhost:8000. GitHub Pages works as is.'
      : 'The map data could not load (' + err.message + '). Refresh the page; if it keeps happening, a data file may be missing.');
    if (window.console) { console.error(err); }
  });

  function start(M) {
    var SCHOOL = M.school, BUILDINGS = M.buildings, BY = M.byId;
    var CDATA = M.campus.data, BASE = M.campus.base, EXTRAS = M.campus.extras || {};
    if (M.problems.length && window.console) { console.warn('Map data problems:\n' + M.problems.join('\n')); }
    var ROOMS = [], SPOTS = [], ENTRANCES = [];
    BUILDINGS.forEach(function (b) { ROOMS = ROOMS.concat(b.rooms); SPOTS = SPOTS.concat(b.spots); ENTRANCES = ENTRANCES.concat(b.entrances); });
    var input = $('q');
    var sel = null, hidden = {}, query = '', from = '', accessible = false;
    var route = null, routeB = null, dirs = null, outRoute = null, viaQuick = '', active = -1, shown = [];
    var you = null, locOn = false, watchId = null, smoother = null, locNote = null, centered = false;
    var levelOf = {}; // the floor showing in each building
    // The floor a building opens on: its "defaultLevel" if the file has one (O'Neill: the main floor), else its lowest mapped floor.
    BUILDINGS.forEach(function (b) { levelOf[b.id] = b.defaultLevel && levelById(b, String(b.defaultLevel)) ? String(b.defaultLevel) : groundLevel(b); });
    var openB = null; // the building whose inside is showing (zoomed in on it)
    var hoverKey = '';
    var SIM = readUrl().sim === '1'; // ?sim=1: tap the map to place a pretend location (no GPS needed)
    var FRAME = ML.localFrame(SCHOOL.center[1], SCHOOL.center[0]); // flat metres around the campus centre

    function lv(o) { return String(o.level == null ? '1' : o.level); }
    function bOf(o) { return o.building; }
    function keyOf(o) { return o.building.id + '/' + o.id; }
    // The lowest floor that is mapped (floors marked "missing" are only listed so the floor buttons make sense).
    function groundLevel(b) { var L = b.levels.filter(function (x) { return !x.missing; })[0]; return L ? L.id : b.levels[0].id; }
    function levelById(b, id) { for (var i = 0; i < b.levels.length; i++) { if (b.levels[i].id === id) { return b.levels[i]; } } return null; }
    function levelName(b, id) { var L = b && levelById(b, id); return L ? L.name : 'Level ' + id; }
    function labelFor(r) { return r.door ? r.door : (r.label || r.id); }
    function roomTitle(r) { return r.door ? r.door + ' (' + r.name + ')' : r.name; }
    function titleOf(m) { return m.kind === 'room' ? roomTitle(m.o) : (m.kind === 'building' ? m.o.properties.name : m.o.label); }
    function entranceByKey(key) {
      if (!key) { return null; }
      for (var i = 0; i < ENTRANCES.length; i++) { if (keyOf(ENTRANCES[i]) === key) { return ENTRANCES[i]; } }
      return null;
    }
    // Doors you can reach from outside: on the lowest mapped floor, or marked "outdoor" (like a raised entry upstairs).
    function outsideDoors(b) { return b.entrances.filter(function (en) { return lv(en) === groundLevel(b) || en.outdoor; }); }
    function wingText(r) { return r.wing ? r.wing + (r.wing === 'Connector' ? '' : ' wing') : ''; }
    function placeText(r) { return [bOf(r).name, wingText(r), levelName(bOf(r), lv(r))].filter(Boolean).join(' · '); }
    // The building the screen is about: the one you are looking inside, else the one the selection or route is in.
    function viewB() { return openB || (sel && sel.kind !== 'building' ? bOf(sel.o) : null) || routeB || (entranceByKey(from) ? bOf(entranceByKey(from)) : null); }

    // ---------- Header ----------
    // The header says the campus name, and switches to the building's name while you are looking inside it.
    var headerKey = null;
    function renderHeader() {
      var b = openB, k = (b ? b.id + '/' + levelOf[b.id] : '');
      if (k === headerKey) { return; }
      headerKey = k;
      var campus = SCHOOL.name || 'Campus';
      $('title').textContent = b ? b.name : campus;
      $('subtitle').textContent = b ? campus : 'Campus map';
      $('level').style.display = b ? '' : 'none';
      $('level').textContent = b ? levelName(b, levelOf[b.id]) : '';
      document.title = b ? b.name + ' | ' + campus + ' map' : campus + ' campus map';
    }
    fillIcon('logoico', 'pin'); fillIcon('locico', 'crosshair');

    // ---------- Map ----------
    var map = null, LAYERS = [], indoorReady = false, lastState = {};
    var EMPTY = { type: 'FeatureCollection', features: [] };
    var BASEMAPS = {
      // OpenStreetMap's public tiles: fine while testing, but their servers are not for real launches (see docs/CAMPUS.md).
      'osm-dev': { tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], maxzoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors' }
    };
    function mode() { return document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }
    function palette() { return STYLE.palette(mode(), SCHOOL); }
    var LAT = SCHOOL.center[1];

    function lngLatBounds(pts) {
      var b = null;
      pts.forEach(function (ll) { if (!b) { b = new maplibregl.LngLatBounds(ll, ll); } else { b.extend(ll); } });
      return b;
    }
    function padFor(padding) {
      var w = map.getContainer().clientWidth, hh = map.getContainer().clientHeight;
      return Math.min(padding, w / 4, hh / 4);
    }
    // Moves the camera so a set of [lng, lat] points fills the view. Looking inside goes flat; keepTilt keeps the tilt.
    // minZoom (optional): zoom in at least this far, even if some points end up off screen.
    function fitPoints(pts, padding, maxZoom, keepTilt, minZoom) {
      if (!map || !pts.length) { return; }
      var o = { padding: padFor(padding), maxZoom: maxZoom || 21, pitch: keepTilt ? map.getPitch() : 0, duration: REDUCED ? 0 : 700 };
      var cam = minZoom ? map.cameraForBounds(lngLatBounds(pts), o) : null;
      if (cam && cam.zoom < minZoom) { map.easeTo({ center: cam.center, zoom: minZoom, pitch: o.pitch, duration: o.duration }); return; }
      map.fitBounds(lngLatBounds(pts), o);
    }
    // The zoom at which a building fills the screen enough for its floor plan to show (see applyView), plus a little.
    function zoomToOpen(b) {
      var fr = ML.localFrame(b.center[1], b.center[0]), xy = b.footPoints.map(function (ll) { return fr.toXY(ll[1], ll[0]); });
      var w = Math.max.apply(null, xy.map(function (q) { return q.x; })) - Math.min.apply(null, xy.map(function (q) { return q.x; }));
      var hh = Math.max.apply(null, xy.map(function (q) { return q.y; })) - Math.min.apply(null, xy.map(function (q) { return q.y; }));
      var c = map.getContainer(), mpp = Math.max(w / c.clientWidth, hh / c.clientHeight) / (SHOW_INSIDE_AT * 1.05); // metres per pixel
      return Math.min(OPEN_ZOOM + 0.05, Math.log(40075016.686 * Math.cos(b.center[1] * Math.PI / 180) / (512 * mpp)) / Math.LN2);
    }
    // Plan box [x0, y0, x1, y1] of a building -> its four corners as [lng, lat].
    function boxPoints(b, box) { return [[box[0], box[1]], [box[2], box[1]], [box[2], box[3]], [box[0], box[3]]].map(function (p) { return b.toLngLat(p[0], p[1]); }); }
    // The "see inside" view of a building: a bit closer than the whole building, so the inside shows.
    function showAll(b) {
      b = b || viewB() || (BUILDINGS.length === 1 ? BUILDINGS[0] : nearestToCenter());
      if (!b) { fitPoints(allIndoorPoints(), 60, 18.3, true); return; }
      var x = b.planBox, cx = (x[0] + x[2]) / 2, cy = (x[1] + x[3]) / 2, k = 0.32;
      fitPoints(boxPoints(b, [cx - (x[2] - x[0]) * k, cy - (x[3] - x[1]) * k, cx + (x[2] - x[0]) * k, cy + (x[3] - x[1]) * k]), 40, 21);
    }
    // The mapped building nearest the middle of the screen, if one is on screen at all.
    function nearestToCenter() {
      if (!map) { return null; }
      var c = map.getCenter(), best = null, bd = Infinity, w = map.getContainer().clientWidth;
      BUILDINGS.forEach(function (b) {
        var p = map.project(b.center), q = map.project(c), d = Math.hypot(p.x - q.x, p.y - q.y);
        if (d < bd && d < w * 0.6) { bd = d; best = b; }
      });
      return best;
    }
    function allIndoorPoints() { var pts = []; BUILDINGS.forEach(function (b) { pts = pts.concat(b.footPoints); }); return pts; }

    // How much of the screen a building fills: 0.5 means its width (or height) is half the map's. Only counts when you
    // are looking at it (the middle of the screen is over its box), so zooming in on a neighbour never opens it.
    function fillOf(b) {
      var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      b.footPoints.forEach(function (ll) {
        var p = map.project(ll);
        x0 = Math.min(x0, p.x); x1 = Math.max(x1, p.x); y0 = Math.min(y0, p.y); y1 = Math.max(y1, p.y);
      });
      var c = map.getContainer(), w = c.clientWidth, hh = c.clientHeight;
      var mx = 0.1 * (x1 - x0), my = 0.1 * (y1 - y0); // a little slack, so aiming near the edge still counts
      if (w / 2 < x0 - mx || w / 2 > x1 + mx || hh / 2 < y0 - my || hh / 2 > y1 + my) { return 0; }
      var fill = Math.max((x1 - x0) / w, (y1 - y0) / hh);
      // A small building (the library, McElroy) would only fill the screen when very close: open it at a fixed zoom instead.
      return map.getZoom() >= OPEN_ZOOM ? Math.max(fill, SHOW_INSIDE_AT) : fill;
    }
    window.mapbc = { fillOf: function (id) { return map ? fillOf(BY[id]) : 0; }, open: function () { return openB ? openB.id : ''; }, model: M, version: VERSION };

    // On every move: which building (if any) is open, and so which floor plan shows.
    function applyView() {
      if (!map) { return; }
      var best = null, bestFill = 0;
      if (map.getPitch() <= 0.5) { // the plan is flat: it only shows looking straight down
        BUILDINGS.forEach(function (b) { var f = fillOf(b); if (f >= SHOW_INSIDE_AT && f > bestFill) { best = b; bestFill = f; } });
      }
      $('tilt').disabled = !!best; // looking inside is always flat
      if (best !== openB) {
        openB = best;
        if (openB) { showLevel(levelOf[openB.id], true); }
        refreshIndoor(); drawRoute(); drawNetwork(); renderFloors(); renderBanner();
        $('legend').style.display = openB ? '' : 'none'; // room colours only mean something looking inside
        $('catkey').style.display = openB ? 'none' : ''; // building colours only mean something looking at the campus
      }
      renderHeader();
    }

    function initMap() {
      var bm = BASEMAPS[SCHOOL.basemap] || BASEMAPS['osm-dev'];
      var opts = {
        container: 'world', center: SCHOOL.center, zoom: SCHOOL.zoom || 16, maxZoom: 22, maxPitch: MAX_PITCH,
        attributionControl: false, pitchWithRotate: true, touchPitch: true,
        style: { version: 8, sources: { base: { type: 'raster', tiles: bm.tiles, tileSize: 256, maxzoom: bm.maxzoom, attribution: bm.attribution } },
          layers: [{ id: 'base', type: 'raster', source: 'base' }] }
      };
      // Keep the camera near the campus (the map data stops a little past its edge).
      if (BASE && BASE.bounds) {
        var bb = BASE.bounds, padX = (bb[2] - bb[0]) * 0.15, padY = (bb[3] - bb[1]) * 0.15;
        opts.maxBounds = [[bb[0] - padX, bb[1] - padY], [bb[2] + padX, bb[3] + padY]];
        opts.minZoom = 14;
      }
      map = new maplibregl.Map(opts);
      // North stays up. Tilting is allowed: right-drag or ctrl-drag with a mouse, two fingers up or down on a phone.
      map.touchZoomRotate.disableRotation();
      map.keyboard.disableRotation();
      if (map.dragRotate._mouseRotate) { map.dragRotate._mouseRotate.disable(); }
      map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
      window.mapbcMap = map; // handy for testing and for poking at the map from the browser console
      map.on('move', applyView);
      map.on('moveend', flattenIfInside);
      map.on('pitch', function () { $('tilt').setAttribute('aria-pressed', map.getPitch() > 0.5 ? 'true' : 'false'); });
      map.on('resize', applyView);
      map.on('click', onMapClick);
      // Open on the mapped buildings with campus around them, a little further out than "they fit".
      var cam = map.cameraForBounds(lngLatBounds(allIndoorPoints()), { padding: padFor(40), pitch: 0 });
      if (cam) { map.jumpTo({ center: cam.center, zoom: Math.min(cam.zoom - 1.2, 17.6), pitch: 0 }); }
    }

    // Zoomed in far enough to see inside, but tilted: tip the map back to straight down so the plan shows.
    function flattenIfInside() {
      if (!map || map.getPitch() < 0.5 || map.isMoving()) { return; }
      var any = BUILDINGS.some(function (b) { return fillOf(b) >= SHOW_INSIDE_AT; });
      if (any) { map.easeTo({ pitch: 0, duration: REDUCED ? 0 : 400 }); }
    }

    // Campus buildings with their heights (from base.json) for the 3D layer. Buildings with an indoor map use their own.
    function hashOf(str) { var x = 7; for (var i = 0; i < str.length; i++) { x = (x * 31 + str.charCodeAt(i)) % 100003; } return x; }
    function buildingsWithHeights() {
      var hs = (BASE && BASE.heights) || {};
      ((CDATA.buildings || {}).features || []).forEach(function (f) {
        var h0 = hs[f.properties.osm], ib = f.properties.indoor ? BY[f.properties.indoor] : null;
        // A guessed height gets a little variety (up to 30% either way, the same every time), so rows of buildings
        // are not all identical blocks. A real height from OpenStreetMap is used as is.
        if (h0) { f.properties.h = h0.guess ? Math.round(h0.h * (0.75 + (hashOf(f.properties.osm) % 6) * 0.1)) : h0.h; }
        if (ib && ib.height) { f.properties.h = ib.height; }
      });
      return CDATA.buildings || EMPTY;
    }
    function boundsBox() {
      var b = BASE.bounds;
      return { type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [[[b[0], b[1]], [b[2], b[1]], [b[2], b[3]], [b[0], b[3]], [b[0], b[1]]]] } }] };
    }
    function indoorNames() {
      return { type: 'FeatureCollection', features: BUILDINGS.map(function (b) {
        return { type: 'Feature', properties: { name: b.name, b: b.id, indoor: b.id }, geometry: { type: 'Point', coordinates: b.center } };
      }) };
    }

    // Small pictures the map layers use (core/style.js lists them): the "go in" arrow and rounded tags.
    function addImages() {
      var px = 2;
      function canvas(w, hh, draw) {
        var c = document.createElement('canvas'); c.width = w * px; c.height = hh * px;
        var g = c.getContext('2d'); g.scale(px, px); draw(g);
        return g.getImageData(0, 0, w * px, hh * px);
      }
      var arrow = canvas(24, 24, function (g) {
        g.strokeStyle = '#ffffff'; g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(5, 12); g.lineTo(15, 12); g.moveTo(11, 7.5); g.lineTo(15.5, 12); g.lineTo(11, 16.5); g.moveTo(19, 5.5); g.lineTo(19, 18.5); g.stroke();
      });
      if (!map.hasImage('mapbc-entry')) { map.addImage('mapbc-entry', arrow, { pixelRatio: px }); }
      function pill(name, color) {
        var w = 24, hh = 20, r = 10;
        var img = canvas(w, hh, function (g) {
          g.fillStyle = color; g.beginPath();
          g.moveTo(r, 0); g.lineTo(w - r, 0); g.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2); g.lineTo(r, hh); g.arc(r, r, r, Math.PI / 2, 3 * Math.PI / 2); g.fill();
        });
        if (map.hasImage(name)) { map.removeImage(name); }
        map.addImage(name, img, { pixelRatio: px, stretchX: [[r * px, (w - r) * px]], stretchY: [[r * px - 1, r * px + 1]], content: [r * px * 0.5, 2 * px, (w - r * 0.5) * px, (hh - 2) * px] });
      }
      var c = palette();
      pill('mapbc-pill-ok', c.ok); pill('mapbc-pill-route', c.route);
    }

    function addLayers() {
      var c = palette();
      map.addSource('buildings', { type: 'geojson', data: buildingsWithHeights() });
      map.addSource('paths', { type: 'geojson', data: CDATA.paths || EMPTY });
      map.addSource('indoor-names', { type: 'geojson', data: indoorNames() });
      map.addSource('route-out', { type: 'geojson', data: EMPTY });
      map.addSource('you-acc', { type: 'geojson', data: EMPTY });
      var all = { type: 'FeatureCollection', features: [] };
      BUILDINGS.forEach(function (b) { all.features = all.features.concat(MI.features(b).features); });
      map.addSource('indoor', { type: 'geojson', data: all });
      map.addSource('in-net', { type: 'geojson', data: EMPTY });
      map.addSource('in-route', { type: 'geojson', data: EMPTY });
      var styled = !!BASE;
      if (styled) {
        map.addSource('b-land', { type: 'geojson', data: boundsBox() });
        map.addSource('b-areas', { type: 'geojson', data: BASE.areas });
        map.addSource('b-lines', { type: 'geojson', data: BASE.lines });
        map.addSource('b-houses', { type: 'geojson', data: BASE.houses });
        map.addSource('b-trees', { type: 'geojson', data: BASE.trees });
        map.addSource('campus-area', { type: 'geojson', data: CDATA.campus || EMPTY });
        STYLE.ground(c).forEach(function (l) { map.addLayer(l); });
      }
      var plain = ['!', ['has', 'indoor']];
      // Invisible: tells which building a tap landed on (at any tilt).
      map.addLayer({ id: 'buildings', type: 'fill', source: 'buildings', paint: { 'fill-color': '#0a6cff', 'fill-opacity': 0.01 } });
      // The path network (the "Show path network" switch). Steps are dashed red so you can see where a route is not step-free.
      map.addLayer({ id: 'paths', type: 'line', source: 'paths', filter: ['!=', ['get', 'highway'], 'steps'], layout: { visibility: 'none' },
        paint: { 'line-color': '#2b6cb0', 'line-opacity': 0.45, 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1, 20, 4] } });
      map.addLayer({ id: 'paths-steps', type: 'line', source: 'paths', filter: ['==', ['get', 'highway'], 'steps'], layout: { visibility: 'none' },
        paint: { 'line-color': '#c0392b', 'line-width': ['interpolate', ['linear'], ['zoom'], 15, 1.5, 20, 5], 'line-dasharray': [1, 1] } });
      map.addLayer({ id: 'you-acc', type: 'fill', source: 'you-acc', paint: { 'fill-color': '#0a6cff', 'fill-opacity': 0.12 } });
      map.addLayer({ id: 'you-acc-line', type: 'line', source: 'you-acc', paint: { 'line-color': '#0a6cff', 'line-opacity': 0.4, 'line-width': 1 } });
      // The outdoor part of a route: solid along walkways, dashed when it is only a straight line.
      map.addLayer({ id: 'route-out-casing', type: 'line', source: 'route-out', layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#ffffff', 'line-width': 9, 'line-opacity': 0.9 } });
      map.addLayer({ id: 'route-out', type: 'line', source: 'route-out', filter: ['!', ['get', 'straight']], layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#0a6cff', 'line-width': 5 } });
      map.addLayer({ id: 'route-out-straight', type: 'line', source: 'route-out', filter: ['get', 'straight'], layout: { 'line-cap': 'round' },
        paint: { 'line-color': '#0a6cff', 'line-width': 4, 'line-dasharray': [1.5, 1.5] } });
      if (styled) {
        STYLE.top(c).forEach(function (l) { map.addLayer(l); });
      } else {
        map.addLayer({ id: 'buildings-line', type: 'line', source: 'buildings', paint: { 'line-color': '#8c1d2f', 'line-width': 1.5, 'line-opacity': 0.6 } });
      }
      // Building entrances (green dots) and lobbies, on top of the buildings, once zoomed in.
      map.addSource('entrances', { type: 'geojson', data: CDATA.entrances || EMPTY });
      map.addSource('lobbies', { type: 'geojson', data: EXTRAS.lobbies || EMPTY });
      var before = map.getLayer('road-names') ? 'road-names' : undefined;
      map.addLayer({ id: 'lobby-fill', type: 'fill', source: 'lobbies', minzoom: 17, paint: { 'fill-color': '#e3eff9', 'fill-opacity': 0.95 } }, before);
      map.addLayer({ id: 'lobby-line', type: 'line', source: 'lobbies', minzoom: 17, paint: { 'line-color': '#5b7fa8', 'line-width': 1.2 } }, before);
      map.addLayer({ id: 'entrance-dots', type: 'circle', source: 'entrances', minzoom: 17, filter: plain,
        paint: { 'circle-color': '#12804d', 'circle-radius': ['interpolate', ['linear'], ['zoom'], 17, 3.5, 20, 7], 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 1.5 } }, before);
      if (styled) {
        map.addLayer({ id: 'lobby-name', type: 'symbol', source: 'lobbies', minzoom: 18,
          layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter SemiBold'], 'text-size': 11 },
          paint: { 'text-color': '#2f4a6b', 'text-halo-color': '#ffffff', 'text-halo-width': 1.2 } });
      }
      // Floor plans: shapes under the campus names, names and markers on top of everything.
      addImages();
      LAYERS = STYLE.indoor(c, LAT);
      LAYERS.forEach(function (l) { map.addLayer(l, l.type === 'symbol' || l.type === 'circle' ? undefined : before); });
      indoorReady = true;
      map.on('mousemove', 'in-room', function (e) {
        var f = e.features && e.features[0], k = f ? f.properties.key : '';
        if (k !== hoverKey) { hoverKey = k; refreshIndoor(); }
        map.getCanvas().style.cursor = 'pointer';
      });
      map.on('mouseleave', 'in-room', function () { hoverKey = ''; refreshIndoor(); map.getCanvas().style.cursor = ''; });
      ['in-entr', 'in-spot', 'buildings'].forEach(function (id) {
        if (!map.getLayer(id)) { return; }
        map.on('mouseenter', id, function () { map.getCanvas().style.cursor = 'pointer'; });
        map.on('mouseleave', id, function () { map.getCanvas().style.cursor = ''; });
      });
      mapTheme();
      applyView();
      refreshIndoor();
    }

    // Light or dark: recolour every layer from core/style.js, and fade the fallback base map (it only shows past the
    // edge of the campus data).
    function mapTheme() {
      setCssColours();
      if (!map || !map.getLayer('base')) { return; }
      var dark = mode() === 'dark', c = palette();
      if (STYLE.light) { map.setLight(STYLE.light[dark ? 'dark' : 'light']); }
      map.setPaintProperty('base', 'raster-brightness-min', dark ? 0.78 : 0.25);
      map.setPaintProperty('base', 'raster-brightness-max', dark ? 0.14 : 1);
      map.setPaintProperty('base', 'raster-saturation', dark ? -0.8 : -0.6);
      map.setPaintProperty('base', 'raster-contrast', dark ? 0 : -0.3);
      map.setPaintProperty('base', 'raster-hue-rotate', dark ? 180 : 0);
      var layers = (BASE ? STYLE.ground(c).concat(STYLE.top(c)) : []).concat(STYLE.indoor(c, LAT));
      layers.forEach(function (l) {
        if (!map.getLayer(l.id)) { return; }
        Object.keys(l.paint || {}).forEach(function (k) { map.setPaintProperty(l.id, k, l.paint[k]); });
      });
      if (indoorReady) { addImages(); lastState = {}; refreshIndoor(); }
      highlightBuilding();
    }
    // The page's own colours (room swatches, the school colour) come from the same palette as the map.
    function setCssColours() {
      var c = palette(), st = document.documentElement.style;
      Object.keys(c.rooms).forEach(function (t) { st.setProperty('--c-' + t, c.rooms[t]); });
      st.setProperty('--accent', c.accent);
      c.cats.forEach(function (k) { st.setProperty('--cat-' + k.id, k.color); });
      st.setProperty('--cat-other', c.buildingTop);
    }

    // The building you picked turns blue (in 3D).
    function highlightBuilding() {
      if (!map || !map.getLayer('buildings-3d')) { return; }
      var c = palette(), id = sel && sel.kind === 'building' ? sel.o.properties.osm : '';
      map.setPaintProperty('buildings-3d', 'fill-extrusion-color', ['case', ['==', ['get', 'osm'], id], c.selected, c.buildingSide]);
      map.setPaintProperty('buildings-roof', 'fill-extrusion-color', ['case', ['==', ['get', 'osm'], id], c.selectedTop, c.buildingRoof]);
    }

    // Everything about the floor plans that changes as you use the map: which building and floor show, the selected
    // room, search matches, hidden room types, the starting door. Only what changed is sent to the map.
    function refreshIndoor() {
      if (!indoorReady) { return; }
      var matchKeys = null;
      if (query.trim() !== '') { matchKeys = search(query).filter(function (m) { return m.kind === 'room'; }).map(function (m) { return keyOf(m.o); }); }
      var on = entranceByKey(from);
      var state = {
        open: openB ? openB.id : '', level: openB ? levelOf[openB.id] : '',
        sel: sel && sel.kind === 'room' ? keyOf(sel.o) : '', hover: hoverKey, match: matchKeys,
        hidden: Object.keys(hidden).filter(function (t) { return hidden[t]; }), on: on ? on.id : ''
      };
      if (on && openB && bOf(on) !== openB) { state.on = ''; }
      var st = STYLE.indoorState(palette(), LAYERS, state);
      Object.keys(st.filters).forEach(function (id) {
        var s = JSON.stringify(st.filters[id]);
        if (lastState['f:' + id] !== s) { lastState['f:' + id] = s; map.setFilter(id, st.filters[id]); }
      });
      Object.keys(st.paint).forEach(function (id) {
        Object.keys(st.paint[id]).forEach(function (k) {
          var s = JSON.stringify(st.paint[id][k]);
          if (lastState['p:' + id + k] !== s) { lastState['p:' + id + k] = s; map.setPaintProperty(id, k, st.paint[id][k]); }
        });
      });
      // The open building's own 3D block and name step aside so its floor plan shows.
      var openId = openB ? openB.id : '';
      ['buildings-3d', 'buildings-roof', 'indoor-edge', 'indoor-names'].forEach(function (id) {
        if (!map.getLayer(id)) { return; }
        var f = id === 'indoor-names' ? ['!=', ['get', 'b'], openId] : (id === 'indoor-edge' ? ['all', ['has', 'indoor'], ['!=', ['get', 'indoor'], openId]] : ['!=', ['get', 'indoor'], openId]);
        var s = JSON.stringify(f);
        if (lastState['f:' + id] !== s) { lastState['f:' + id] = s; map.setFilter(id, f); }
      });
    }

    // ---------- Floors ----------
    // The floor buttons belong to the building the screen is about. A floor marked "missing" (not mapped yet) is
    // shown greyed out so the numbers still make sense.
    var floorsFor = null;
    function renderFloors() {
      var b = viewB(), box = $('floors');
      if (b !== floorsFor) {
        floorsFor = b;
        box.textContent = '';
        if (b) {
          b.levels.slice().reverse().forEach(function (L) {
            var btn = h('button', { type: 'button', 'data-level': L.id, 'aria-label': L.name + (L.missing ? ' (not mapped yet)' : ''), title: L.name + (L.missing ? ' (not mapped yet)' : ''), text: L.id });
            if (L.missing) { btn.classList.add('missing'); }
            btn.addEventListener('click', function () { goLevel(L.id); });
            box.appendChild(btn);
          });
        }
      }
      box.style.display = b ? '' : 'none';
      if (b) { box.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x.getAttribute('data-level') === levelOf[b.id] ? 'true' : 'false'); }); }
    }
    function showLevel(id, quiet) {
      var b = viewB();
      if (!b || !levelById(b, id)) { return; }
      levelOf[b.id] = id;
      if (quiet) { return; }
      refreshIndoor(); drawRoute(); drawNetwork(); renderFloors(); renderBanner(); drawYou(); renderHeader();
    }
    function goLevel(id) {
      var b = viewB();
      showLevel(id);
      if (b && !openB) { showAll(b); } else { frame(); }
    }

    // The bar above the legend: which floors the route uses, and a note on placeholder or unmapped floors.
    function renderBanner() {
      var bar = $('levelbar'), b = viewB();
      bar.textContent = '';
      var used = [];
      if (route && routeB === b) { route.levels.forEach(function (l) { if (used.indexOf(l) === -1) { used.push(l); } }); }
      if (used.length > 1) {
        bar.appendChild(h('span', { 'class': 'lbl', text: 'Route uses' }));
        used.forEach(function (l, i) {
          if (i) { bar.appendChild(h('span', { 'class': 'arrow', text: '→' })); }
          var btn = h('button', { type: 'button', 'aria-pressed': l === levelOf[b.id] ? 'true' : 'false', text: levelName(b, l) });
          btn.addEventListener('click', function () { goLevel(l); });
          bar.appendChild(btn);
        });
      }
      var L = b ? levelById(b, levelOf[b.id]) : null;
      if (L && (L.blank || L.missing)) {
        var long = L.note || (L.missing ? L.name + ' of ' + b.name + ' is not mapped yet.' : L.name + ' is a placeholder.');
        bar.appendChild(h('div', { 'class': 'blanknote' }, [
          h('span', { 'class': 'long', text: long }),
          h('span', { 'class': 'short', text: L.missing ? L.name + ' is not mapped yet' : L.name + ' is a placeholder floor (guesses only)' })
        ]));
      }
      bar.style.display = bar.childNodes.length ? '' : 'none';
    }

    // ---------- Route and path network on the floor plan ----------
    function lineFeature(b, pts, props) { return { type: 'Feature', properties: props, geometry: { type: 'LineString', coordinates: pts.map(function (p) { return b.toLngLat(p[0], p[1]); }) } }; }
    function pointFeature(b, p, props) { return { type: 'Feature', properties: props, geometry: { type: 'Point', coordinates: b.toLngLat(p[0], p[1]) } }; }

    // The route inside the open building, one line per floor. Where it changes floor, a tag says "Up to Level 2"
    // (or "From Level 1" on the other floor). The layers show only the current floor's part.
    function drawRoute() {
      if (!indoorReady) { return; }
      var fs = [];
      if (route && routeB && routeB === openB) {
        var b = routeB, run = null, runs = [];
        route.points.forEach(function (p, i) {
          var L = route.levels[i];
          if (!run || run.level !== L) { run = { level: L, pts: [] }; runs.push(run); }
          run.pts.push(p);
        });
        runs.forEach(function (r) { if (r.pts.length > 1) { fs.push(lineFeature(b, r.pts, { k: 'route', lvl: r.level })); } });
        for (var i = 1; i < route.points.length; i++) {
          var a = route.levels[i - 1], c = route.levels[i];
          if (a === c) { continue; }
          var up = parseFloat(c) > parseFloat(a);
          fs.push(pointFeature(b, route.points[i], { k: 'tag', lvl: a, text: (up ? 'Up to ' : 'Down to ') + levelName(b, c) }));
          fs.push(pointFeature(b, route.points[i], { k: 'tag', lvl: c, text: 'From ' + levelName(b, a) }));
        }
        fs.push(pointFeature(b, route.points[route.points.length - 1], { k: 'end', lvl: route.levels[route.levels.length - 1] }));
      }
      map.getSource('in-route').setData({ type: 'FeatureCollection', features: fs });
    }

    // "Show path network": the open building's hallway lines, where doors join them, and stairs or elevators to other floors.
    function drawNetwork() {
      if (!indoorReady) { return; }
      var fs = [], b = openB;
      if (b && $('shownet').checked) {
        var nodeById = {}, linked = {};
        b.paths.nodes.forEach(function (n) { nodeById[n.id] = n; });
        b.graph.attach.forEach(function (a) { fs.push(lineFeature(b, [[a.from.x, a.from.y], [a.to.x, a.to.y]], { k: 'attach', lvl: a.level })); });
        b.paths.edges.forEach(function (e) {
          var a = nodeById[e.from], c = nodeById[e.to];
          if (!a || !c) { return; }
          if (lv(a) !== lv(c)) { linked[a.id] = true; linked[c.id] = true; return; }
          fs.push(lineFeature(b, [[a.x, a.y], [c.x, c.y]], { k: 'edge', lvl: lv(a), guess: !!e.guess }));
        });
        b.paths.nodes.forEach(function (n) {
          if (linked[n.id]) { fs.push(pointFeature(b, [n.x, n.y], { k: 'link', lvl: lv(n) })); }
          fs.push(pointFeature(b, [n.x, n.y], { k: 'node', lvl: lv(n), guess: !!n.guess }));
        });
        b.rooms.forEach(function (r) { (r.doors || []).forEach(function (d) { fs.push(pointFeature(b, d, { k: 'door', lvl: lv(r) })); }); });
      }
      map.getSource('in-net').setData({ type: 'FeatureCollection', features: fs });
    }

    function drawOutRoute() {
      if (!map || !map.getSource('route-out')) { return; }
      map.getSource('route-out').setData(outRoute && outRoute.lnglat && outRoute.lnglat.length ? { type: 'FeatureCollection', features: [
        { type: 'Feature', properties: { straight: !!outRoute.straight }, geometry: { type: 'LineString', coordinates: outRoute.lnglat } }] } : EMPTY);
    }

    // A tap on the map: an entrance, a photo point or a room of the open floor plan, else a campus building.
    // MapLibre only sends "click" when the map was not dragged, so a pan never selects anything by accident.
    function onMapClick(e) {
      if (SIM && locOn) { setYou({ lng: e.lngLat.lng, lat: e.lngLat.lat, accuracy: 8 }); return; }
      var ins = ['in-entr', 'in-spot', 'in-room'].filter(function (id) { return map.getLayer(id); });
      var hit = openB && ins.length ? map.queryRenderedFeatures(e.point, { layers: ins }) : [];
      for (var i = 0; i < hit.length; i++) {
        var p = hit[i].properties, b = BY[p.b];
        if (!b) { continue; }
        if (p.k === 'entrance') { setFrom(b.id + '/' + p.eid); return; }
        if (p.k === 'spot') { var s = find(b.spots, p.sid); if (s) { choose({ kind: 'spot', o: s }); return; } }
        if (p.k === 'room') { var r = find(b.rooms, p.rid); if (r) { choose({ kind: 'room', o: r }); return; } }
      }
      // Not on a floor plan: did the tap land on a campus building? (The 3D layers first, so a tilted roof counts.)
      var layers = ['buildings-3d', 'buildings-roof', 'buildings'].filter(function (id) { return map.getLayer(id); });
      var bh = layers.length ? map.queryRenderedFeatures(e.point, { layers: layers }) : [];
      for (var j = 0; j < bh.length; j++) {
        if (bh[j].properties.indoor && BY[bh[j].properties.indoor]) { if (openB !== BY[bh[j].properties.indoor]) { showAll(BY[bh[j].properties.indoor]); } return; }
        var f = buildingByOsm(bh[j].properties.osm);
        if (f) { choose({ kind: 'building', o: f }); return; }
      }
    }
    function find(list, id) { for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } } return null; }

    // Zooms to the chosen room and the whole route (indoors and outdoors), or to the chosen entrance.
    function frame() {
      var pts = [], b = sel && sel.kind !== 'building' ? bOf(sel.o) : routeB;
      if (sel && sel.kind === 'building') { bldgRings(sel.o).forEach(function (r) { pts = pts.concat(r); }); }
      else if (sel && b && lv(sel.o) === levelOf[b.id]) {
        var o = sel.o;
        if (sel.kind === 'room') { o.shape.forEach(function (p) { pts.push(b.toLngLat(p[0], p[1])); }); } else { pts.push(b.toLngLat(o.x, o.y)); }
      }
      if (route && routeB) { route.points.forEach(function (p, i) { if (route.levels[i] === levelOf[routeB.id]) { pts.push(routeB.toLngLat(p[0], p[1])); } }); }
      if (outRoute && outRoute.lnglat) { pts = pts.concat(outRoute.lnglat); }
      else if (!route && fromBuilding() && !sel) { bldgRings(fromBuilding()).forEach(function (r) { pts = pts.concat(r); }); }
      else if (!route && entranceByKey(from) && !sel) { var en = entranceByKey(from); pts.push(bOf(en).toLngLat(en.x, en.y)); }
      if (!pts.length) { return; }
      // Never zoom in so far that a small room fills the screen: at least about 48 m across.
      var c = pts.reduce(function (a, p) { return [a[0] + p[0] / pts.length, a[1] + p[1] / pts.length]; }, [0, 0]);
      var fr = ML.localFrame(c[1], c[0]), xy = pts.map(function (p) { return fr.toXY(p[1], p[0]); });
      var x0 = Math.min.apply(null, xy.map(function (q) { return q.x; })), x1 = Math.max.apply(null, xy.map(function (q) { return q.x; }));
      var y0 = Math.min.apply(null, xy.map(function (q) { return q.y; })), y1 = Math.max.apply(null, xy.map(function (q) { return q.y; }));
      var minSize = 48, mx = (x0 + x1) / 2, my = (y0 + y1) / 2;
      if (x1 - x0 < minSize) { x0 = mx - minSize / 2; x1 = mx + minSize / 2; }
      if (y1 - y0 < minSize) { y0 = my - minSize / 2; y1 = my + minSize / 2; }
      var corners = [[x0, y0], [x1, y1]].map(function (q) { var g = fr.toLatLng(q[0], q[1]); return [g.lng, g.lat]; });
      highlightBuilding();
      // A campus building or a walk outside keeps the 3D tilt (and does not zoom in too close); a room goes flat.
      var outside = (sel && sel.kind === 'building') || (outRoute && outRoute.lnglat && outRoute.lnglat.length);
      // Indoors, zoom in at least far enough that the floor plan opens (a big building like a library needs it).
      fitPoints(corners, 80, outside ? 18.3 : 21, outside, !outside && b ? zoomToOpen(b) : 0);
    }

    // ---------- Your location (blue dot) ----------
    // The phone gives latitude and longitude. Each building's GPS points ("geo") turn that into a spot on its plan, so we
    // can tell whether you are inside one and which door is nearest. GPS only knows where you are on the ground, not which
    // floor. Nothing is stored or sent anywhere: the position stays in this page.
    function metersBetween(a, b) { var f = ML.localFrame(a[1], a[0]), p = f.toXY(b[1], b[0]); return Math.hypot(p.x, p.y); }
    function feetText(m) {
      var ft = m * 3.28084;
      if (ft >= 1000) { return (ft / 5280).toFixed(1) + ' mi'; }
      return (ft < 50 ? Math.max(5, Math.round(ft / 5) * 5) : Math.round(ft / 10) * 10) + ' ft';
    }
    // pos: { lng, lat, accuracy (metres) }. Works out the nearest building (or the one you are in) and its nearest door.
    function describeYou(pos) {
      var best = null;
      BUILDINGS.forEach(function (b) {
        if (b.parked) { return; }
        var p = b.toPlan(pos.lng, pos.lat), x = b.planBox;
        var d = ML.describeFix({ x: p.x, y: p.y, accuracy: pos.accuracy }, { metersPerUnit: 1 / b.unitsPerMeter, bounds: { x: x[0], y: x[1], w: x[2] - x[0], h: x[3] - x[1] }, entrances: outsideDoors(b) });
        if (!best || d.offMapMeters < best.offMapMeters) { best = d; best.b = b; }
      });
      var out = { lng: pos.lng, lat: pos.lat, accuracyMeters: pos.accuracy, inside: false, offMapMeters: Infinity, b: null, nearest: null };
      if (best) {
        out.b = best.b; out.inside = best.inside; out.offMapMeters = best.offMapMeters; out.x = best.x; out.y = best.y;
        if (best.nearest) { out.nearest = { key: best.b.id + '/' + best.nearest.id, name: best.nearest.name, meters: best.nearest.meters, b: best.b }; }
      }
      return out;
    }

    // The blue dot is a marker on the campus map, so it shows anywhere on campus. The faint circle is how far off the GPS might be.
    var youMarker = null;
    function drawYou() {
      if (!map) { return; }
      if (!you) {
        if (youMarker) { youMarker.remove(); youMarker = null; }
        if (map.getSource('you-acc')) { map.getSource('you-acc').setData(EMPTY); }
        return;
      }
      var ll = [you.lng, you.lat];
      if (!youMarker) {
        var dot = document.createElement('div');
        dot.className = 'you-dot-el';
        dot.setAttribute('aria-label', 'Your location');
        youMarker = new maplibregl.Marker({ element: dot }).setLngLat(ll).addTo(map);
      } else { youMarker.setLngLat(ll); }
      if (map.getSource('you-acc')) {
        var fr = ML.localFrame(ll[1], ll[0]), r = Math.min(you.accuracyMeters, 150), c = [];
        for (var i = 0; i <= 48; i++) { var g = fr.toLatLng(r * Math.cos(i / 48 * 2 * Math.PI), r * Math.sin(i / 48 * 2 * Math.PI)); c.push([g.lng, g.lat]); }
        map.getSource('you-acc').setData({ type: 'FeatureCollection', features: [{ type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [c] } }] });
      }
    }

    // ---------- Routes that start outdoors ----------
    // The campus walkways (campus/data.json) become a path network once, in metres around the campus centre.
    var outNet = null;
    function outdoorNet() {
      if (!outNet) { outNet = ML.outdoorNetwork(CDATA.paths, FRAME, CDATA.buildings); }
      return outNet;
    }

    // "Starting from" is your location ("ME"), a door of a mapped building ("building/door id"), or a campus building
    // ("B:" + its OpenStreetMap id).
    function isBuildingFrom(id) { return typeof id === 'string' && id.indexOf('B:') === 0; }
    function fromBuilding() { return isBuildingFrom(from) ? buildingByOsm(from.slice(2)) : null; }
    var buildingStartName = ''; // set by outdoorStart: the building and which of its doors the walk starts from
    function startLabel() { var b = fromBuilding(), en = entranceByKey(from); return b ? (buildingStartName || b.properties.name) : (en ? en.name : 'your location'); }
    // The point on a campus building's outline closest to where you are going, so a walk starts on the side facing it.
    function edgePointToward(f, towardLL) {
      var t = FRAME.toXY(towardLL[1], towardLL[0]), best = null, bd = Infinity;
      bldgRings(f).forEach(function (r) {
        r.forEach(function (c) { var q = FRAME.toXY(c[1], c[0]), d = Math.hypot(q.x - t.x, q.y - t.y); if (d < bd) { bd = d; best = c; } });
      });
      return best;
    }
    // The mapped doors of a campus building (entrances within 8 m of its outline). A step-free route skips doors
    // marked "wheelchair": "no" (a stairwell, say). Each is { id, ll: [lng, lat], name }.
    function campusDoors(f) {
      var rings = bldgRings(f), out = [];
      ((CDATA.entrances || {}).features || []).forEach(function (e, i) {
        var c = e.geometry.coordinates, pr = e.properties || {};
        if (accessible && pr.wheelchair === 'no') { return; }
        if (rings.some(function (r) { return metersToRing(c, r) < 8; })) { out.push({ id: 'B' + i, ll: c, name: pr.name || '' }); }
      });
      return out;
    }
    // Where an outdoor walk starts: your location, a campus building (its door, or else its side, facing "toward"),
    // or a building's door.
    function outdoorStart(toward) {
      if (from === 'ME') { return you ? { ll: [you.lng, you.lat], name: 'Your location' } : null; }
      var f = fromBuilding();
      if (f) {
        var t = FRAME.toXY(toward[1], toward[0]), best = null, bd = Infinity;
        campusDoors(f).forEach(function (d) { var q = FRAME.toXY(d.ll[1], d.ll[0]), dd = Math.hypot(q.x - t.x, q.y - t.y); if (dd < bd) { bd = dd; best = d; } });
        buildingStartName = f.properties.name + (best && best.name ? ' (' + best.name + ')' : '');
        return { ll: best ? best.ll : edgePointToward(f, toward), name: buildingStartName };
      }
      var en = entranceByKey(from);
      return en ? { ll: bOf(en).toLngLat(en.x, en.y), name: en.name } : null;
    }

    // The whole trip from outdoors to a room (or photo point) in building b: along the walkways to its best door, then
    // inside. Returns null if it cannot (no start yet, or no door leads there). net: an outdoor graph to reuse (optional).
    function planFromOutside(target, st0) {
      var b = bOf(target.o);
      st0 = st0 || outdoorStart(b.center);
      if (!st0) { return null; }
      var net = outdoorNet(), doors = outsideDoors(b), start = FRAME.toXY(st0.ll[1], st0.ll[0]);
      var places = { start: start, entrances: {} }, pts = [{ id: 'START', name: st0.name, x: start.x, y: start.y }];
      doors.forEach(function (en) {
        var ll = b.toLngLat(en.x, en.y), p = FRAME.toXY(ll[1], ll[0]);
        places.entrances[en.id] = p;
        pts.push({ id: en.id, name: en.name, x: p.x, y: p.y });
      });
      var out = net.edges.length ? ML.buildGraph(net, [], pts, []) : null;
      var best = ML.campusRoute(out, b.graph, doors.map(function (en) { return en.id; }), target, places, 1 / b.unitsPerMeter, { accessible: accessible });
      if (best) { best.out = out; best.b = b; }
      return best;
    }

    function describeIndoor(b, r, name) {
      return ML.describe(b.graph, r, name, { feetPerUnit: b.feetPerUnit, levelNames: b.levelNames, unitsPerMeter: b.unitsPerMeter });
    }

    var lastRouteFix = null;
    function routeFromOutside() {
      var b = bOf(sel.o);
      if (from === 'ME' && !you) { return; }
      // Inside the building GPS is too rough to steer by, so start from the nearest door instead.
      if (from === 'ME' && you.inside && you.b === b && you.nearest) {
        route = ML.routeTo(b.graph, you.nearest.key.split('/').slice(1).join('/'), sel, { accessible: accessible });
        if (route) {
          routeB = b; dirs = describeIndoor(b, route, titleOf(sel));
          outRoute = { inside: true, entrance: you.nearest.key, lnglat: [], feet: 0 };
        }
        return;
      }
      var best = planFromOutside(sel);
      if (!best) { return; }
      route = best.indoor; routeB = b;
      dirs = describeIndoor(b, route, titleOf(sel));
      var en = find(b.entrances, best.entrance);
      outRoute = {
        straight: best.straight, entrance: b.id + '/' + best.entrance, startLabel: startLabel(),
        feet: Math.round(best.outdoor.length * 3.28084 / 5) * 5,
        lnglat: best.outdoor.points.map(function (p) { var g = FRAME.toLatLng(p[0], p[1]); return [g.lng, g.lat]; }),
        steps: best.straight ? null : ML.describe(best.out, best.outdoor, en.name, { feetPerUnit: 3.28084, fallbackName: 'the path' }).steps
      };
      if (from === 'ME') { lastRouteFix = [you.lng, you.lat]; }
    }

    // ---------- Campus buildings: search them and walk to them ----------
    // Named buildings from campus/data.json (OpenStreetMap). Buildings with a floor plan open it instead.
    var BLDGS = ((CDATA.buildings || {}).features || []).filter(function (f) { return f.properties && f.properties.name; });
    function indoorOf(f) { return f && f.properties.indoor ? BY[f.properties.indoor] : null; }
    function bldgRings(f) { var g = f.geometry; return g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(function (p) { return p[0]; }); }
    function bldgCenter(f) {
      var r = bldgRings(f)[0], x = 0, y = 0;
      r.forEach(function (c) { x += c[0] / r.length; y += c[1] / r.length; });
      return [x, y];
    }
    function bldgKind(f) {
      var k = f.properties.kind;
      return { dormitory: 'Residence hall', university: 'Campus building', dining_hall: 'Dining hall', school: 'School' }[k] || 'Building';
    }
    function searchBuildings(q) {
      var toks = String(q || '').toLowerCase().split(/\s+/).map(function (t) { return t.replace(/s$/, ''); }).filter(Boolean);
      if (!toks.length) { return []; }
      var seen = {};
      return BLDGS.filter(function (f) {
        var n = f.properties.name.toLowerCase();
        if (!toks.every(function (t) { return n.indexOf(t) > -1; })) { return false; }
        // A building with a floor plan made of several OpenStreetMap shapes is listed once.
        var ib = indoorOf(f);
        if (ib) { if (seen[ib.id]) { return false; } seen[ib.id] = true; }
        return true;
      }).slice(0, 8).map(function (f) { return { kind: 'building', o: f }; });
    }
    function buildingByOsm(id) { for (var i = 0; i < BLDGS.length; i++) { if (BLDGS[i].properties.osm === id) { return BLDGS[i]; } } return null; }
    function extrasFor(f) {
      var n = f.properties.name, out = { doors: 0, lobby: false };
      ((EXTRAS.entrances || {}).features || []).forEach(function (e) { if (e.properties.building === n) { out.doors++; } });
      ((EXTRAS.lobbies || {}).features || []).forEach(function (e) { if (e.properties.building === n) { out.lobby = true; } });
      return out;
    }

    // Distance in metres from a [lng, lat] point to a building outline (0 if inside).
    function metersToRing(c, ring) {
      var p = FRAME.toXY(c[1], c[0]), inside = false, best = Infinity;
      var r = ring.map(function (q) { return FRAME.toXY(q[1], q[0]); });
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        var a = r[i], b = r[j];
        if ((a.y > p.y) !== (b.y > p.y) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) { inside = !inside; }
        var dx = b.x - a.x, dy = b.y - a.y, len2 = dx * dx + dy * dy || 1;
        var t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
        best = Math.min(best, Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy));
      }
      return inside ? 0 : best;
    }

    // Walking directions to a campus building: along the walkways to its nearest mapped entrance,
    // or to the middle of the building when OpenStreetMap has no entrances for it.
    function routeToBuilding(f) {
      if (fromBuilding() === f) { return; } // already there
      var st0 = outdoorStart(bldgCenter(f));
      if (!st0) { return; }
      var net = outdoorNet(), st = FRAME.toXY(st0.ll[1], st0.ll[0]), doors = campusDoors(f);
      if (!doors.length) { doors.push({ id: 'B', ll: bldgCenter(f) }); }
      var pts = [{ id: 'START', name: st0.name, x: st.x, y: st.y }].concat(doors.map(function (d) {
        var p = FRAME.toXY(d.ll[1], d.ll[0]);
        return { id: d.id, name: f.properties.name, x: p.x, y: p.y };
      }));
      var out = net.edges.length ? ML.buildGraph(net, [], pts, []) : null;
      var r = out ? ML.shortest(out, 'entrance:START', doors.map(function (d) { return 'entrance:' + d.id; }), { accessible: accessible }) : null;
      var straight = !r;
      if (straight) { var p1 = pts[1]; r = { points: [[st.x, st.y], [p1.x, p1.y]], length: Math.hypot(st.x - p1.x, st.y - p1.y), ids: [], kinds: [] }; }
      outRoute = {
        straight: straight, toBuilding: true, startLabel: from === 'ME' ? 'your location' : st0.name,
        feet: Math.round(r.length * 3.28084 / 5) * 5,
        lnglat: r.points.map(function (p) { var g = FRAME.toLatLng(p[0], p[1]); return [g.lng, g.lat]; }),
        steps: straight ? null : ML.describe(out, r, f.properties.name, { feetPerUnit: 3.28084, fallbackName: 'the path' }).steps
      };
    }

    function renderBuildingCard(box) {
      var name = sel.o.properties.name;
      if (!from) {
        box.appendChild(h('h2', { text: 'Walk to ' + name }));
        box.appendChild(h('p', { 'class': 'fine', text: 'Choose where you start (My location, a campus building, or a building door) to get walking directions.' }));
        return;
      }
      if (from === 'ME' && !you) {
        box.appendChild(h('h2', { text: 'Finding your location' }));
        box.appendChild(h('p', { 'class': 'fine', text: SIM ? 'Test mode: tap the map to place a pretend location.' : 'Allow location when the browser asks. It is quicker outside.' }));
        return;
      }
      if (!outRoute) {
        box.appendChild(h('h2', { text: 'No route found' }));
        box.appendChild(h('div', { 'class': 'callout', text: fromBuilding() === sel.o ? 'You are already there. Pick a different starting point.' : 'Start from My location, a campus building or a building door to walk to another building.' }));
        return;
      }
      var mins = Math.max(1, Math.round(outRoute.feet / 240));
      box.appendChild(h('div', { 'class': 'sum' }, [
        h('div', { 'class': 'big' }, [String(mins), h('small', { text: 'min walk' })]),
        h('div', { 'class': 'dist', text: '≈ ' + (outRoute.feet >= 1000 ? (outRoute.feet / 5280).toFixed(1) + ' mi' : outRoute.feet + ' ft') })
      ]));
      var badges = h('div', { 'class': 'badges' });
      if (accessible) { badges.appendChild(h('span', { 'class': 'badge ok', text: 'Step-free' })); }
      if (outRoute.straight) { badges.appendChild(h('span', { 'class': 'badge warn', text: 'Straight line' })); }
      box.appendChild(badges);
      var ol = h('ol', { 'class': 'steps' });
      function addStep(kind, ic, text, feet) {
        ol.appendChild(h('li', { 'class': 'step ' + kind }, [icon(ic), h('span', { 'class': 'txt', text: text }), h('span', { 'class': 'ft', text: feet ? feet + ' ft' : '' })]));
      }
      if (outRoute.straight) {
        addStep('start', 'start', 'Start at ' + outRoute.startLabel, 0);
        addStep('arrive', 'arrive', 'Walk to ' + name + ' (straight-line distance)', outRoute.feet);
      } else {
        outRoute.steps.forEach(function (s) {
          var ic = s.kind === 'start' ? 'start' : (s.kind === 'arrive' ? 'arrive' : (s.turn || 'straight'));
          addStep(s.kind, ic, s.kind === 'start' ? 'Start at ' + outRoute.startLabel : s.text, s.feet);
        });
      }
      box.appendChild(ol);
      box.appendChild(h('p', { 'class': 'fine', text: 'Walkways come from OpenStreetMap. Entrances are often missing there, so the route may end at the nearest walkway to the building.' }));
    }

    function setLocBtn() { $('locate').setAttribute('aria-pressed', locOn ? 'true' : 'false'); }

    function renderLoc() {
      var bar = $('locbar');
      bar.textContent = '';
      bar.className = 'locbar';
      var text = '', actions = [];
      if (locNote) {
        text = locNote.text;
        if (locNote.kind === 'warn') { bar.className = 'locbar warn'; }
      } else if (you) {
        var near = you.nearest && you.nearest.meters <= 250 ? you.nearest : null;
        text = you.inside ? 'You are in ' + you.b.name + (SIM ? ' (test location).' : ', within about ' + feetText(you.accuracyMeters) + '.')
                          : (you.b ? 'You are about ' + feetText(you.offMapMeters) + ' from ' + you.b.name + '.' : 'You are on the map.');
        if (near) {
          text += ' Nearest entrance: ' + near.name + ' (' + feetText(near.meters) + ').';
          if (from !== near.key) {
            var use = h('button', { 'class': 'btn', type: 'button', text: 'Start there' });
            use.addEventListener('click', function () { setFrom(near.key); });
            actions.push(use);
          }
        }
      } else { bar.hidden = true; return; }
      bar.hidden = false;
      bar.appendChild(h('span', { 'class': 'msg', text: text }));
      actions.forEach(function (a) { bar.appendChild(a); });
      if (locOn || you) {
        var stop = h('button', { 'class': 'btn', type: 'button', text: 'Hide' });
        stop.addEventListener('click', function () { stopLocate(true); });
        bar.appendChild(stop);
      }
    }

    function setYou(pos) {
      you = describeYou(pos);
      locNote = null;
      drawYou(); renderLoc();
      // First good fix: show the dot (not every fix, or the map would fight your fingers).
      if (!centered && !SIM && map) {
        centered = true;
        if (you.inside) { levelOf[you.b.id] = groundLevel(you.b); }
        map.easeTo({ center: [you.lng, you.lat], zoom: Math.max(map.getZoom(), 18), duration: REDUCED ? 0 : 700 });
      }
      // Following your location: redo the route when you have moved about 5 m (not on every GPS jiggle).
      if (from === 'ME' && sel) {
        var moved5 = !lastRouteFix || metersBetween(lastRouteFix, [you.lng, you.lat]) > 5;
        if (moved5) { update(!lastRouteFix); }
      }
    }

    function onFix(p) {
      var c = p.coords, q = FRAME.toXY(c.latitude, c.longitude);
      // Treat a missing accuracy as poor, and never trust a reading to be better than 3 m.
      var s = smoother.update(q.x, q.y, Math.max(c.accuracy || 25, 3), p.timestamp || Date.now());
      var g = FRAME.toLatLng(s.x, s.y);
      setYou({ lng: g.lng, lat: g.lat, accuracy: s.acc });
    }

    function onLocError(err) {
      var text = 'Your location is not available right now.';
      if (err.code === 1) {
        text = window.isSecureContext === false
          ? 'Location only works on secure (https) pages. Open the map from an https link.'
          : 'Location is blocked for this page. Allow it in your browser settings, then try again.';
        stopLocate(false);
      } else if (err.code === 3) { text = 'Still looking for a GPS signal. It is faster outside.'; }
      locNote = { kind: 'warn', text: text };
      renderLoc();
    }

    function stopLocate(clear) {
      if (watchId != null && navigator.geolocation) { navigator.geolocation.clearWatch(watchId); }
      watchId = null; locOn = false;
      if (clear) { you = null; locNote = null; if (smoother) { smoother.reset(); } }
      setLocBtn(); drawYou(); renderLoc();
    }

    function toggleLocate() {
      if (locOn) { stopLocate(!SIM); return; }
      if (SIM) {
        locOn = true; setLocBtn();
        locNote = you ? null : { kind: 'info', text: 'Test mode: tap the map to place a pretend location.' };
        renderLoc();
        return;
      }
      if (!navigator.geolocation) {
        locNote = { kind: 'warn', text: 'This browser cannot share a location.' };
        renderLoc();
        return;
      }
      locOn = true; centered = false; you = null;
      smoother = ML.createSmoother({ speed: 1.4 }); // walking pace, in metres per second
      locNote = { kind: 'info', text: 'Finding your location...' };
      setLocBtn(); renderLoc();
      watchId = navigator.geolocation.watchPosition(onFix, onLocError, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
    }

    // ---------- Search ----------
    function search(q) { return ML.search(q, ROOMS, SPOTS).concat(searchBuildings(q)); }

    function renderResults() {
      var box = $('results');
      box.textContent = '';
      shown = [];
      if (query.trim() === '') { return; }
      var res = search(query);
      if (!res.length) {
        box.appendChild(h('div', { 'class': 'noneline', text: 'No match. Try a room number, a name, or words like stairs or restrooms.' }));
        return;
      }
      shown = res.slice(0, 6);
      shown.forEach(function (m, i) {
        var sw = m.kind === 'room' ? swatch(m.o.type) : h('span', { 'class': 'sw' }), sub;
        if (m.kind === 'spot') { sw.style.background = 'var(--accent-soft)'; }
        if (m.kind === 'building') { sw.style.background = indoorOf(m.o) ? 'var(--accent)' : 'var(--surface2)'; }
        if (m.kind === 'building') { sub = indoorOf(m.o) ? 'Building · indoor map' : bldgKind(m.o); }
        else if (m.kind === 'room') { sub = [m.o.type === 'core' ? 'Building core' : TYPES[m.o.type], placeText(m.o)].filter(Boolean).join(' · '); }
        else { sub = '360 photo point · ' + bOf(m.o).name; }
        var b = h('button', { 'class': 'res' + (i === active ? ' active' : ''), type: 'button', role: 'option' }, [
          sw, h('span', { 'class': 't' }, [h('b', { text: titleOf(m) }), h('small', { text: sub })]), h('kbd', { text: 'Enter' })
        ]);
        b.addEventListener('click', function () { choose(m); });
        b.addEventListener('mousemove', function () { if (active !== i) { active = i; markActive(); } });
        box.appendChild(b);
      });
      if (res.length > 6) { box.appendChild(h('div', { 'class': 'noneline', text: (res.length - 6) + ' more. Type more words to narrow it down.' })); }
    }
    function markActive() {
      var rows = $('results').querySelectorAll('.res');
      for (var i = 0; i < rows.length; i++) { rows[i].classList.toggle('active', i === active); }
    }
    function refreshStyles() {
      refreshIndoor();
      $('fromfield').classList.toggle('need', !!sel && !from);
      syncFromBox();
    }

    // ---------- Cards ----------
    function renderRouteCard() {
      var box = $('routecard');
      box.textContent = '';
      if (sel && sel.kind === 'building') { renderBuildingCard(box); return; }
      var en = entranceByKey(from), sb = sel ? bOf(sel.o) : null;
      // From your location, a campus building, or a door of another building: walk outside first.
      if (from === 'ME' || fromBuilding() || (en && sb && bOf(en) !== sb)) { renderYouCard(box); return; }
      if (!en && !sel) {
        box.appendChild(h('div', { 'class': 'empty' }, [
          h('span', { 'class': 'bigico' }, [icon('route')]),
          h('div', {}, [h('h2', { text: 'Plan a route' }), h('p', { text: 'Directions appear here, with a line drawn on the map.' })])
        ]));
        box.appendChild(h('ul', { 'class': 'hintlist' }, [
          h('li', {}, [h('i', { text: '1' }), 'Pick where you start: your location or an entrance']),
          h('li', {}, [h('i', { text: '2' }), 'Search a room, or tap one on the map'])
        ]));
        return;
      }
      if (en && !sel) {
        box.appendChild(h('h2', { text: 'Entering from ' + en.name }));
        box.appendChild(h('p', { 'class': 'fine', text: 'Now search for a room above, or tap one on the map.' }));
        return;
      }
      if (!en) {
        box.appendChild(h('h2', { text: 'Where are you coming in?' }));
        box.appendChild(h('p', { 'class': 'fine', text: 'Choose an entrance in the first box, or tap a green marker on the map, to see the way to ' + titleOf(sel) + '.' }));
        return;
      }
      if (!route) {
        box.appendChild(h('h2', { text: 'No route found' }));
        box.appendChild(h('div', { 'class': 'callout', text: accessible
          ? 'No step-free route from ' + en.name + ' in the map data. Try another entrance.'
          : 'No route from ' + en.name + '. The path network may be missing a hallway here.' }));
        return;
      }
      var b = routeB;
      box.appendChild(h('div', { 'class': 'sum' }, [
        h('div', { 'class': 'big' }, [String(dirs.minutes), h('small', { text: 'min walk' })]),
        h('div', { 'class': 'dist', text: '≈ ' + dirs.feet + ' ft' })
      ]));
      var badges = h('div', { 'class': 'badges' });
      if (viaQuick) { badges.appendChild(h('span', { 'class': 'badge info', text: 'Nearest ' + viaQuick })); }
      if (accessible) { badges.appendChild(h('span', { 'class': 'badge ok', text: 'Step-free' })); }
      if (route.outdoor) { badges.appendChild(h('span', { 'class': 'badge info', text: 'Goes outside' })); }
      if (route.levels[0] !== route.levels[route.levels.length - 1]) { badges.appendChild(h('span', { 'class': 'badge info', text: levelName(b, route.levels[0]) + ' → ' + levelName(b, route.levels[route.levels.length - 1]) })); }
      if (route.usesGuess) { badges.appendChild(h('span', { 'class': 'badge warn', text: 'Includes unchecked hallway' })); }
      box.appendChild(badges);
      var ol = h('ol', { 'class': 'steps' });
      dirs.steps.forEach(function (s) {
        var name = s.kind === 'start' ? 'start' : (s.kind === 'arrive' && s.turn === 'straight' ? 'arrive' : s.turn || 'straight');
        var ic = s.kind === 'start' ? 'start' : (s.kind === 'arrive' ? 'arrive' : name), show = null;
        if (s.kind === 'level') {
          show = h('button', { 'class': 'golevel', type: 'button', text: 'Show ' + levelName(b, s.level) });
          show.addEventListener('click', (function (l) { return function () { goLevel(l); }; })(s.level));
        }
        ol.appendChild(h('li', { 'class': 'step ' + s.kind }, [
          icon(ic), h('span', { 'class': 'txt' }, [s.text, s.outdoor ? h('span', { 'class': 'tag', text: 'Outside' }) : null, show]),
          h('span', { 'class': 'ft', text: s.feet ? s.feet + ' ft' : '' })
        ]));
      });
      box.appendChild(ol);
      var acts = h('div', { 'class': 'actions' }), copy = h('button', { 'class': 'btn', type: 'button' }, [icon('link'), 'Copy link']);
      copy.addEventListener('click', function () { copyLink(copy); });
      acts.appendChild(copy);
      box.appendChild(acts);
      var notes = [];
      if (b.scale && b.scale.guess) { notes.push('Distances and times are rough estimates until the map scale is measured on site.'); }
      notes.push('Door positions and some hallways are traced from plans and not checked on site yet' + (route.usesGuess ? ', including parts of this route (orange dashes under "Show path network").' : '.'));
      box.appendChild(h('p', { 'class': 'fine', text: notes.join(' ') }));
    }

    // The route card when starting outdoors (your location, a campus building, or another building's door):
    // to the door, then the indoor steps.
    function renderYouCard(box) {
      var label = startLabel(), mine = from === 'ME';
      if (!sel) {
        box.appendChild(h('h2', { text: 'Starting from ' + label }));
        box.appendChild(h('p', { 'class': 'fine', text: 'Now search for a room above, or tap one on the map.' }));
        return;
      }
      if (mine && !you) {
        box.appendChild(h('h2', { text: 'Finding your location' }));
        box.appendChild(h('p', { 'class': 'fine', text: SIM ? 'Test mode: tap the map to place a pretend location.' : 'Allow location when the browser asks. It is quicker outside.' }));
        return;
      }
      if (!route) {
        box.appendChild(h('h2', { text: 'No route found' }));
        box.appendChild(h('div', { 'class': 'callout', text: accessible ? 'No step-free way in from here in the map data.' : 'No way in from here in the map data.' }));
        return;
      }
      var outFeet = outRoute ? outRoute.feet : 0, levelSteps = dirs.steps.filter(function (s) { return s.kind === 'level'; }).length;
      var total = outFeet + dirs.feet, mins = Math.max(1, Math.round(total / 240 + levelSteps * 0.6));
      box.appendChild(h('div', { 'class': 'sum' }, [
        h('div', { 'class': 'big' }, [String(mins), h('small', { text: 'min walk' })]),
        h('div', { 'class': 'dist', text: '≈ ' + (total >= 1000 ? (total / 5280).toFixed(1) + ' mi' : total + ' ft') })
      ]));
      var badges = h('div', { 'class': 'badges' }, [h('span', { 'class': 'badge info', text: 'From ' + label })]);
      if (viaQuick) { badges.appendChild(h('span', { 'class': 'badge info', text: 'Nearest ' + viaQuick })); }
      if (accessible) { badges.appendChild(h('span', { 'class': 'badge ok', text: 'Step-free' })); }
      if (outRoute && outRoute.straight) { badges.appendChild(h('span', { 'class': 'badge warn', text: 'Straight line outside' })); }
      if (route.usesGuess) { badges.appendChild(h('span', { 'class': 'badge warn', text: 'Includes unchecked hallway' })); }
      box.appendChild(badges);
      var ol = h('ol', { 'class': 'steps' }), door = entranceByKey(outRoute.entrance);
      function addStep(kind, ic, text, feet, tag, button) {
        ol.appendChild(h('li', { 'class': 'step ' + kind }, [icon(ic), h('span', { 'class': 'txt' }, [text, tag ? h('span', { 'class': 'tag', text: tag }) : null, button || null]), h('span', { 'class': 'ft', text: feet ? feet + ' ft' : '' })]));
      }
      if (outRoute.inside) {
        addStep('start', 'start', 'You seem to be inside. Starting from the nearest door: ' + door.name, 0);
      } else if (outRoute.straight) {
        addStep('start', 'start', 'Start at ' + label, 0);
        addStep('walk', 'straight', 'Walk to the ' + door.name + ' (straight-line distance)', outFeet, 'Outside');
      } else {
        outRoute.steps.forEach(function (s) {
          if (s.kind === 'start') { addStep('start', 'start', 'Start at ' + label, 0); return; }
          addStep('walk', s.kind === 'arrive' ? (s.turn === 'straight' ? 'straight' : s.turn) : (s.turn || 'straight'), s.text, s.feet, 'Outside');
        });
      }
      dirs.steps.forEach(function (s) {
        if (s.kind === 'start') {
          if (!outRoute.inside) {
            var look = h('button', { 'class': 'golevel', type: 'button', text: 'Show inside' });
            look.addEventListener('click', zoomToInside);
            addStep('walk', 'start', 'Go in at the ' + door.name + (bOf(door) ? ' of ' + bOf(door).name : ''), 0, null, look);
          }
          return;
        }
        var ic = s.kind === 'arrive' ? 'arrive' : (s.turn || 'straight'), show = null;
        if (s.kind === 'level') {
          show = h('button', { 'class': 'golevel', type: 'button', text: 'Show ' + levelName(routeB, s.level) });
          show.addEventListener('click', (function (l) { return function () { goLevel(l); }; })(s.level));
        }
        addStep(s.kind, ic, s.text, s.feet, null, show);
      });
      box.appendChild(ol);
      var notes = [];
      if (outRoute.straight) { notes.push('The walkways do not connect from here in the map data, so the outdoor part is a straight line, not a walking route.'); }
      if (mine) { notes.push('Your location comes from the phone and can be off by a few metres, more near tall buildings.'); }
      else { notes.push('The walk starts at the side of ' + label + ' that faces ' + routeB.name + '. Walkways come from OpenStreetMap.'); }
      box.appendChild(h('p', { 'class': 'fine', text: notes.join(' ') }));
    }

    // Zooms in on the part of the building the route goes through (it fills the screen, so the inside shows).
    function zoomToInside() {
      if (!route || !routeB) { return; }
      var b = routeB, L = route.levels[route.levels.length - 1];
      levelOf[b.id] = L;
      var box = null;
      route.points.forEach(function (p, i) {
        if (route.levels[i] !== L) { return; }
        box = box ? [Math.min(box[0], p[0]), Math.min(box[1], p[1]), Math.max(box[2], p[0]), Math.max(box[3], p[1])] : [p[0], p[1], p[0], p[1]];
      });
      if (!box) { return; }
      var u = b.unitsPerMeter, cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
      var hw = Math.max((box[2] - box[0]) / 2 + 6 * u, 34 * u), hh = Math.max((box[3] - box[1]) / 2 + 6 * u, 24 * u);
      fitPoints(boxPoints(b, [cx - hw, cy - hh, cx + hw, cy + hh]), 30);
    }

    function copyLink(btn) {
      var done = function () { var old = btn.lastChild.textContent; btn.lastChild.textContent = 'Copied'; setTimeout(function () { btn.lastChild.textContent = old; }, 1600); };
      if (navigator.clipboard && navigator.clipboard.writeText) { navigator.clipboard.writeText(location.href).then(done, function () { window.prompt('Copy this link:', location.href); }); }
      else { window.prompt('Copy this link:', location.href); }
    }

    function row(dl, label, value, empty) {
      dl.appendChild(h('dt', { text: label }));
      dl.appendChild(h('dd', value ? { text: value } : { 'class': 'none', text: empty }));
    }
    function statusBadge(ok) { return h('span', { 'class': 'badge' + (ok ? ' ok' : ''), text: ok ? 'Verified on site' : 'Not verified yet' }); }

    function renderDetail() {
      var box = $('detail');
      box.textContent = '';
      if (!sel) {
        box.appendChild(h('h3', { text: 'Details' }));
        box.appendChild(h('p', { 'class': 'fine', style: 'margin:0', text: 'Select a room to see its details here.' }));
        return;
      }
      var dl = h('dl');
      if (sel.kind === 'building') {
        var bp = sel.o.properties, bsw = h('span', { 'class': 'sw' });
        bsw.style.background = 'var(--surface2)';
        box.appendChild(h('div', { 'class': 'dhead' }, [bsw, h('div', {}, [h('h2', { text: bp.name }), h('small', { text: bldgKind(sel.o) })])]));
        row(dl, 'Floors', bp.levels, 'Not listed');
        var ex = extrasFor(sel.o);
        row(dl, 'Indoor map', ex.doors || ex.lobby ? [ex.doors ? ex.doors + ' entrance' + (ex.doors > 1 ? 's' : '') : '', ex.lobby ? 'lobby' : ''].filter(Boolean).join(' and ') + ' only' : '', 'Not yet');
        row(dl, 'Data from', ex.doors || ex.lobby ? 'OpenStreetMap and ' + (SCHOOL.short || SCHOOL.name) + ' floor plans' : 'OpenStreetMap', '');
        box.appendChild(dl);
        var go = h('button', { 'class': 'btn', type: 'button', style: 'margin-top:14px' }, [icon('start'), 'Start from here']);
        go.addEventListener('click', function () {
          // Make this building the starting point, and leave the "Going to" box free for the room.
          var id = 'B:' + bp.osm;
          sel = null; query = ''; input.value = ''; viaQuick = '';
          setFrom(id);
          input.focus();
        });
        box.appendChild(go);
        return;
      }
      if (sel.kind === 'room') {
        var r = sel.o;
        box.appendChild(h('div', { 'class': 'dhead' }, [swatch(r.type, 'sw'), h('div', {}, [h('h2', { text: roomTitle(r) }), h('small', { text: [r.type === 'core' ? 'Building core' : TYPES[r.type], placeText(r)].filter(Boolean).join(' · ') })])]));
        row(dl, 'Building', bOf(r).name, '');
        row(dl, 'Door number', r.door, 'Not added yet');
        row(dl, 'Nearest landmark', r.near, 'Not added yet');
        row(dl, 'Directions', r.directions, 'Not written yet');
        row(dl, 'Where', r.where, '');
        dl.appendChild(h('dt', { text: 'Status' }));
        dl.appendChild(h('dd', {}, [statusBadge(r.verified)]));
      } else {
        var s = sel.o, sw = h('span', { 'class': 'sw' });
        sw.style.background = 'var(--accent-soft)';
        box.appendChild(h('div', { 'class': 'dhead' }, [sw, h('div', {}, [h('h2', { text: s.label }), h('small', { text: '360 photo point · ' + bOf(s).name })])]));
        dl.appendChild(h('dt', { text: 'Status' }));
        dl.appendChild(h('dd', {}, [statusBadge(s.verified)]));
      }
      box.appendChild(dl);
    }

    function renderPhoto() {
      var box = $('photo');
      box.textContent = '';
      box.appendChild(h('h3', { text: 'Photo' }));
      if (!sel || !sel.o.photo) {
        box.appendChild(h('div', { 'class': 'ph', text: sel ? 'No photo yet. Add a file name to the building\'s data file to show one here.' : 'Select a room or a 360 marker to see its photo.' }));
        return;
      }
      var file = sel.o.photo, msg = h('div', { 'class': 'ph', text: 'Loading photo' }), img = h('img', { alt: 'Photo of ' + titleOf(sel) });
      img.onerror = function () { img.remove(); msg.textContent = 'Photo file not found: ' + file; };
      img.onload = function () { msg.remove(); };
      img.src = file;
      box.appendChild(msg); box.appendChild(img);
    }

    function renderFoot() {
      var box = $('foot');
      var cls = ROOMS.filter(function (r) { return r.type === 'classroom'; });
      var done = cls.filter(function (r) { return r.door; }).length;
      var photos = SPOTS.filter(function (s) { return s.photo; }).length;
      function bar(label, n, total) {
        var i = h('i'); i.style.width = (total ? Math.round(100 * n / total) : 0) + '%';
        return h('div', {}, [h('div', { 'class': 'row' }, [h('span', { text: label }), h('span', { text: n + ' of ' + total })]), h('div', { 'class': 'meter' }, [i])]);
      }
      box.textContent = '';
      box.appendChild(h('h3', { text: 'Data progress', style: 'margin-top:6px' }));
      box.appendChild(h('p', { style: 'margin:0 0 8px', text: 'Indoor maps: ' + BUILDINGS.map(function (b) { return b.name; }).join(', ') }));
      box.appendChild(bar('Classrooms with door numbers', done, cls.length));
      box.appendChild(bar('Photo points with photos', photos, SPOTS.length));
      BUILDINGS.forEach(function (b) { if (b.note) { box.appendChild(h('p', { style: 'margin:0 0 6px', text: b.name + ': ' + b.note })); } });
      box.appendChild(h('p', { style: 'margin:8px 0 0;opacity:.7', id: 'version', text: 'Map version ' + VERSION + ' (if this is older than expected, refresh the page)' }));
    }

    // ---------- State changes ----------
    function findRoute() {
      route = null; routeB = null; dirs = null; outRoute = null;
      if (!sel || !from) { return; }
      if (sel.kind === 'building') { routeToBuilding(sel.o); return; }
      var en = entranceByKey(from), b = bOf(sel.o);
      if (en && bOf(en) === b) {
        route = ML.routeTo(b.graph, en.id, sel, { accessible: accessible });
        if (route) { routeB = b; dirs = describeIndoor(b, route, titleOf(sel)); }
        return;
      }
      routeFromOutside(); // your location, a campus building, or a door of another building
    }

    function update(reframe) {
      findRoute();
      var b = viewB();
      if (reframe && b) {
        // Show the floor where the route starts, else the chosen room's floor, else the entrance's.
        var en = entranceByKey(from);
        var target = route && routeB === b ? route.levels[0] : (sel && sel.kind !== 'building' ? lv(sel.o) : (en && bOf(en) === b ? lv(en) : levelOf[b.id]));
        if (route && routeB === b && outRoute && !outRoute.inside) { target = route.levels[0]; }
        levelOf[b.id] = target;
      }
      refreshIndoor(); drawRoute(); drawNetwork(); renderFloors(); renderBanner(); renderHeader();
      drawOutRoute();
      renderRouteCard(); renderDetail(); renderPhoto(); renderLoc();
      highlightBuilding();
      refreshStyles(); renderResults();
      saveUrl();
      if (reframe) { frame(); }
    }

    function choose(m, quick) {
      if (m.kind === 'building' && indoorOf(m.o)) {
        // A building with a floor plan: open it.
        query = ''; input.value = ''; renderResults(); refreshStyles();
        showAll(indoorOf(m.o));
        input.blur();
        return;
      }
      sel = m; query = ''; active = -1; viaQuick = quick || '';
      input.value = titleOf(m);
      update(true);
      input.blur();
    }

    function setFrom(id) {
      from = entranceByKey(id) || id === 'ME' || (isBuildingFrom(id) && buildingByOsm(id.slice(2))) ? id : '';
      lastRouteFix = null;
      if (from === 'ME' && !you && !locOn) { toggleLocate(); }
      syncFromBox();
      try { localStorage.setItem('mapbc-from', from); } catch (e) { /* storage blocked: fine */ }
      update(true);
    }

    // Quick "nearest" buttons. With a starting point, jump straight to the closest match (in the building you start in,
    // or anywhere when you start outside).
    function quick(term, name) {
      var targets = search(term).filter(function (m) { return m.kind === 'room'; }), en = entranceByKey(from);
      if (!targets.length) { return; }
      if (en) {
        var mine = targets.filter(function (t) { return bOf(t.o) === bOf(en); });
        var best = mine.length ? ML.nearest(bOf(en).graph, en.id, mine, { accessible: accessible }) : null;
        if (best) { choose(best.target, name.toLowerCase()); return; }
      }
      if ((from === 'ME' && you) || fromBuilding() || en) {
        var bestT = null, bestM = Infinity;
        targets.forEach(function (t) { var p = planFromOutside(t); if (p && p.meters < bestM) { bestM = p.meters; bestT = t; } });
        if (bestT) { choose(bestT, name.toLowerCase()); return; }
      }
      query = term; input.value = term; active = 0;
      update(false); input.focus();
    }

    function saveUrl() {
      if (!window.history || !history.replaceState) { return; }
      var p = [], q = readUrl();
      if (q.school) { p.push('school=' + encodeURIComponent(q.school)); }
      if (SIM) { p.push('sim=1'); }
      if (from) { p.push('from=' + encodeURIComponent(from)); }
      if (sel) { p.push(sel.kind === 'building' ? 'bldg=' + encodeURIComponent(sel.o.properties.osm) : (sel.kind === 'room' ? 'room=' : 'spot=') + encodeURIComponent(keyOf(sel.o))); }
      if (accessible) { p.push('accessible=1'); }
      try { history.replaceState(null, '', location.pathname + (p.length ? '?' + p.join('&') : '')); } catch (e) { /* some browsers block this */ }
    }
    // Links are "building/id". Older links (before there were several buildings) only have the id: the first building
    // with that id wins, so shared Stokes links keep working.
    function byKey(list, key) {
      if (!key) { return null; }
      for (var i = 0; i < list.length; i++) { if (keyOf(list[i]) === key) { return list[i]; } }
      for (var j = 0; j < list.length; j++) { if (list[j].id === key) { return list[j]; } }
      return null;
    }
    function oldFrom(id) {
      if (!id) { return ''; }
      if (id === 'ME' || (isBuildingFrom(id) && buildingByOsm(id.slice(2)))) { return id; }
      var en = byKey(ENTRANCES, id);
      return en ? keyOf(en) : '';
    }

    // ---------- "Starting from" search box ----------
    var fromActive = 0, fromShown = [];
    function fromChoices() {
      var out = [{ id: 'ME', name: 'My location (GPS)', sub: 'Use the blue dot' }];
      ENTRANCES.forEach(function (en) { out.push({ id: keyOf(en), name: en.name, sub: bOf(en).name + ' door' + (lv(en) !== groundLevel(bOf(en)) ? ' (' + levelName(bOf(en), lv(en)) + ')' : '') }); });
      BLDGS.forEach(function (f) { if (!indoorOf(f)) { out.push({ id: 'B:' + f.properties.osm, name: f.properties.name, sub: 'Campus building' }); } });
      return out;
    }
    function fromLabel(id) {
      if (id === 'ME') { return 'My location (GPS)'; }
      var en = entranceByKey(id); if (en) { return en.name + (BUILDINGS.length > 1 ? ' (' + bOf(en).short + ')' : ''); }
      var b = isBuildingFrom(id) ? buildingByOsm(id.slice(2)) : null;
      return b ? b.properties.name : '';
    }
    // Matches that start with what you typed first, then ones with a word that starts with it, then the rest.
    function fromSearch(q) {
      q = q.trim().toLowerCase();
      var all = fromChoices();
      if (!q) { return all.slice(0, 1 + ENTRANCES.length); }
      var scored = [];
      all.forEach(function (c) {
        var n = (c.name + ' ' + c.sub).toLowerCase(), i = n.indexOf(q), score = -1;
        if (i === 0) { score = 0; } else if (i > 0 && /[\s\-(]/.test(n.charAt(i - 1))) { score = 1; } else if (i > 0) { score = 2; }
        else if (q.split(/\s+/).every(function (w) { return n.indexOf(w) >= 0; })) { score = 3; }
        if (score >= 0) { scored.push({ c: c, score: score }); }
      });
      scored.sort(function (a, b) { return a.score - b.score || a.c.name.localeCompare(b.c.name); });
      return scored.map(function (x) { return x.c; });
    }
    function startFromSearch() {
      var box = $('fromq'), list = $('fromresults');
      function close() { list.textContent = ''; fromShown = []; box.setAttribute('aria-expanded', 'false'); }
      function show() {
        list.textContent = '';
        var res = fromSearch(box.dataset.typing === '1' ? box.value : '');
        fromShown = res.slice(0, 8);
        box.setAttribute('aria-expanded', fromShown.length ? 'true' : 'false');
        if (!res.length) { list.appendChild(h('div', { 'class': 'noneline', text: 'No match. Try a building name, like "O\'Neill", or "My location".' })); return; }
        fromShown.forEach(function (c, i) {
          var b = h('button', { 'class': 'res' + (i === fromActive ? ' active' : ''), type: 'button', role: 'option' }, [
            h('span', { 'class': 'sw' }), h('span', { 'class': 't' }, [h('b', { text: c.name }), h('small', { text: c.sub })])
          ]);
          b.addEventListener('mousedown', function (e) { e.preventDefault(); }); // keep focus so the click lands
          b.addEventListener('click', function () { pick(c); });
          list.appendChild(b);
        });
        if (res.length > fromShown.length) { list.appendChild(h('div', { 'class': 'noneline', text: (res.length - fromShown.length) + ' more. Type more letters to narrow it down.' })); }
        else if (box.dataset.typing !== '1') { list.appendChild(h('div', { 'class': 'noneline', text: 'Or type a campus building, like "O\'Neill".' })); }
      }
      function pick(c) { box.dataset.typing = '0'; close(); box.blur(); setFrom(c.id); }
      box.addEventListener('focus', function () { box.dataset.typing = '0'; fromActive = 0; box.select(); show(); });
      box.addEventListener('input', function () { box.dataset.typing = '1'; fromActive = 0; show(); });
      box.addEventListener('blur', function () { box.dataset.typing = '0'; close(); syncFromBox(); });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' && fromShown.length) { e.preventDefault(); fromActive = (fromActive + 1) % fromShown.length; show(); }
        else if (e.key === 'ArrowUp' && fromShown.length) { e.preventDefault(); fromActive = (fromActive - 1 + fromShown.length) % fromShown.length; show(); }
        else if (e.key === 'Enter') { e.preventDefault(); if (fromShown.length) { pick(fromShown[fromActive] || fromShown[0]); } }
        else if (e.key === 'Escape') { close(); box.blur(); }
      });
    }
    // The box shows the chosen place, unless you are in the middle of typing.
    function syncFromBox() {
      var box = $('fromq');
      if (!box || document.activeElement === box) { return; }
      box.value = fromLabel(from);
    }

    // ---------- Controls ----------
    function build() {
      startFromSearch();
      $('accessible').addEventListener('change', function () { accessible = $('accessible').checked; update(true); });
      $('shownet').addEventListener('change', function () {
        drawNetwork();
        $('netkey').classList.toggle('on', $('shownet').checked);
        if (map && map.getLayer('paths')) {
          var vis = $('shownet').checked ? 'visible' : 'none';
          map.setLayoutProperty('paths', 'visibility', vis);
          map.setLayoutProperty('paths-steps', 'visibility', vis);
        }
      });
      QUICK.forEach(function (q) {
        var b = h('button', { 'class': 'chip', type: 'button', text: q[0] });
        b.addEventListener('click', function () { quick(q[1], q[0]); });
        $('quick').appendChild(b);
      });
      var ck = $('catkey');
      STYLE.categories.forEach(function (k) { ck.appendChild(h('div', { 'class': 'k' }, [h('span', { 'class': 'sw', style: 'background:var(--cat-' + k.id + ')' }), k.name])); });
      ck.appendChild(h('div', { 'class': 'k' }, [h('span', { 'class': 'sw', style: 'background:var(--cat-other)' }), 'Other']));
      if (BUILDINGS.length) { ck.appendChild(h('div', { 'class': 'k' }, [h('span', { 'class': 'sw edge' }), 'Has an indoor map'])); }
      var lg = $('legend');
      LEGEND.forEach(function (t) {
        var b = h('button', { type: 'button', 'aria-pressed': 'true' }, [swatch(t), TYPES[t]]);
        b.addEventListener('click', function () {
          hidden[t] = !hidden[t];
          b.setAttribute('aria-pressed', hidden[t] ? 'false' : 'true');
          refreshStyles();
        });
        lg.appendChild(b);
      });
      input.addEventListener('input', function () {
        query = input.value; active = query.trim() ? 0 : -1;
        if (query.trim() === '' && sel) { sel = null; viaQuick = ''; update(false); return; }
        refreshStyles(); renderResults();
      });
      input.addEventListener('focus', function () { input.select(); });
      input.addEventListener('keydown', function (e) {
        if (e.key === 'ArrowDown' && shown.length) { e.preventDefault(); active = (active + 1) % shown.length; markActive(); }
        else if (e.key === 'ArrowUp' && shown.length) { e.preventDefault(); active = (active - 1 + shown.length) % shown.length; markActive(); }
        else if (e.key === 'Enter') { if (shown.length) { choose(shown[active >= 0 ? active : 0]); } }
        else if (e.key === 'Escape') { query = ''; input.value = sel ? titleOf(sel) : ''; update(false); input.blur(); }
      });
      $('locate').addEventListener('click', toggleLocate);
      if (SIM) { $('locate').title = 'Test mode: place a pretend location'; }
      $('zin').addEventListener('click', function () { if (map) { map.zoomIn(); } });
      $('zout').addEventListener('click', function () { if (map) { map.zoomOut(); } });
      $('zreset').addEventListener('click', function () { showAll(); });
      $('tilt').addEventListener('click', function () {
        if (!map) { return; }
        map.easeTo({ pitch: map.getPitch() > 0.5 ? 0 : TILT_PITCH, duration: REDUCED ? 0 : 500 });
      });
      $('theme').addEventListener('click', function () {
        var cur = document.documentElement.getAttribute('data-theme') || (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
        setTheme(cur === 'dark' ? 'light' : 'dark', true);
      });
      $('fromq').placeholder = 'My location, a building, or a ' + (BUILDINGS.length === 1 ? BUILDINGS[0].short + ' ' : '') + 'door';
    }

    function setTheme(t, save) {
      document.documentElement.setAttribute('data-theme', t);
      fillIcon('themeico', t === 'dark' ? 'sun' : 'moon');
      mapTheme();
      if (save) { try { localStorage.setItem('mapbc-theme', t); } catch (e) { /* fine */ } }
    }

    // ---------- Start ----------
    build();
    renderFoot();
    var st = readUrl(), saved = '', savedTheme = '';
    try {
      saved = localStorage.getItem('mapbc-from') || localStorage.getItem('stokes-from') || '';
      savedTheme = localStorage.getItem('mapbc-theme') || localStorage.getItem('stokes-theme') || '';
    } catch (e) { /* storage blocked: fine */ }
    setTheme(savedTheme === 'light' || savedTheme === 'dark' ? savedTheme : (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'), false);
    from = oldFrom(st.from) || (entranceByKey(oldFrom(saved)) ? oldFrom(saved) : '');
    syncFromBox();
    accessible = st.accessible === '1';
    $('accessible').checked = accessible;
    var r0 = byKey(ROOMS, st.room), s0 = byKey(SPOTS, st.spot);
    if (r0) { sel = { kind: 'room', o: r0 }; }
    if (st.bldg && buildingByOsm(st.bldg)) { sel = { kind: 'building', o: buildingByOsm(st.bldg) }; }
    if (s0) { sel = { kind: 'spot', o: s0 }; }
    if (sel) { input.value = titleOf(sel); }
    $('legend').style.display = 'none';
    renderFloors(); renderHeader();
    // The map draws its labels with the Inter font, so load it first (at most a second and a half; if it is slow or
    // missing, labels use the phone's own font).
    function fontsReady() {
      if (!document.fonts || !document.fonts.load) { return Promise.resolve(); }
      var f = STYLE.fonts, all = Object.keys(f).map(function (name) {
        var ws = f[name].split(' ');
        return document.fonts.load(ws[1] + ' ' + ws[0] + ' 16px "' + name + '"').catch(function () {});
      });
      return Promise.race([Promise.all(all), new Promise(function (ok) { setTimeout(ok, 1500); })]);
    }
    if (window.maplibregl) {
      fontsReady().then(function () {
        initMap();
        map.on('load', function () {
          addLayers();
          drawYou();
          update(!!sel);
          if (from === 'ME' && !locOn) { toggleLocate(); }
        });
      });
    } else {
      // The map library did not load (it should be in vendor/). Say so instead of failing silently.
      showError('The map could not load (vendor/maplibre-gl-5.24.0/maplibre-gl.js is missing).');
    }
    update(false);
  }
})();
