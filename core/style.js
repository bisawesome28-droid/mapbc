// How the map looks: colours and map layers, in MapLibre's style format (the same format the iOS and Android versions
// of MapLibre read, so this file carries over to an app). Two parts:
//   campus: ground() and top(): grass, roads, trees, 3D buildings and names, from a school's campus/base.json and
//           campus/data.json (made by tools/osm_to_campus.js from OpenStreetMap).
//   indoor: indoor(): the floor plans, from the features core/indoor.js makes out of each building file, plus the route,
//           the path network and the markers. What changes while you use the map (which building is open, which floor,
//           the selected room...) is a "state" object; indoorState() turns it into filters and colours.
//
// To change a colour, change it in PALETTES below (one set for light mode, one for dark mode). A school's own colour
// (school.json "accent") is passed in, so a second school gets its own colour without touching this file.
// Map labels use the Inter font (vendor/inter-5.3.0, SIL Open Font License).
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MapStyle = api; }
})(this, function () {
  var PALETTES = {
    light: {
      land: '#f3f2ee', campus: '#f5efe9', residential: '#efede8',
      grass: '#d4eac3', wood: '#c3dfb0', pitch: '#c6e6b0', pitchEdge: '#a9d48f', parking: '#e5e7ec', plaza: '#ebe9e4', water: '#a7d0ee',
      roadCasing: '#d3d6dc', road: '#ffffff', major: '#fff4cf', majorCasing: '#e3cf91', path: '#ffffff', pathCasing: '#dcd9d2', steps: '#c9a98a', rail: '#9aa1ad',
      tree: '#9ccc83', treeEdge: '#86b96c',
      building: '#dcd5ca', buildingTop: '#f4f1ec', house: '#e7e2da', houseTop: '#f1eeea', edge: '#b9b0a2', indoor: '#7d1a2a', selected: '#5b8def', selectedTop: '#8fb0f5',
      label: '#353d4b', labelSoft: '#6a7282', labelGreen: '#4c7a37', halo: '#ffffff', indoorLabel: '#7d1b2b',
      // Inside buildings
      floor: '#ffffff', wall: '#2c3542', fix: '#eceff3', fg: '#0f1722', muted: '#5b6678', surface: '#ffffff', shadow: 0.16,
      textHalo: 'rgba(255,255,255,0.85)', route: '#0a6cff', ok: '#12804d', guess: '#e28a1c', accent: '#8c1d2f',
      rooms: { classroom: '#f7ddd7', office: '#faefc6', service: '#fadbb8', it: '#e7e7c4', common: '#e3eff9', core: '#e9ecf1', conf: '#f4dde9', connector: '#e6e9ee' }
    },
    dark: {
      land: '#1a1f2b', campus: '#1d2130', residential: '#1b2029',
      grass: '#1f3326', wood: '#1d3324', pitch: '#22402b', pitchEdge: '#2d5236', parking: '#232937', plaza: '#212634', water: '#16304a',
      roadCasing: '#11151d', road: '#2f3647', major: '#4a4434', majorCasing: '#11151d', path: '#343b4d', pathCasing: '#151a24', steps: '#7a6150', rail: '#566074',
      tree: '#2b4a33', treeEdge: '#355c3e',
      building: '#343c52', buildingTop: '#4b5772', house: '#2c3140', houseTop: '#394055', edge: '#1a1f2c', indoor: '#8a2737', selected: '#4d7fe0', selectedTop: '#6f98e8',
      label: '#d7deeb', labelSoft: '#9aa4b8', labelGreen: '#8fbf7a', halo: '#121620', indoorLabel: '#f0b5bf',
      floor: '#121a24', wall: '#8fa3bd', fix: '#19222e', fg: '#e8edf5', muted: '#95a2b5', surface: '#111821', shadow: 0.4,
      textHalo: 'rgba(18,26,36,0.85)', route: '#4db3ff', ok: '#5fd39b', guess: '#e28a1c', accent: '#f08a9b',
      rooms: { classroom: '#4d2931', office: '#4b4421', service: '#58391d', it: '#40432a', common: '#1f3b54', core: '#27303b', conf: '#4b2b40', connector: '#1b222c' }
    }
  };

  var Z = function (stops) { return ['interpolate', ['exponential', 1.6], ['zoom']].concat(stops); };
  var isClass = function (c) { return ['==', ['get', 'class'], c]; };
  // Buildings with an indoor map are marked "indoor" (core/school.js) and drawn in the school's colour instead.
  var plain = ['!', ['has', 'indoor']];

  // The ground: everything under the route line and the blue dot.
  function ground(c) {
    var L = [
      { id: 'land', type: 'fill', source: 'b-land', paint: { 'fill-color': c.land } },
      { id: 'area-residential', type: 'fill', source: 'b-areas', filter: isClass('residential'), paint: { 'fill-color': c.residential } },
      { id: 'campus-area', type: 'fill', source: 'campus-area', paint: { 'fill-color': c.campus } },
      { id: 'area-wood', type: 'fill', source: 'b-areas', filter: isClass('wood'), paint: { 'fill-color': c.wood } },
      { id: 'area-grass', type: 'fill', source: 'b-areas', filter: isClass('grass'), paint: { 'fill-color': c.grass } },
      { id: 'area-pitch', type: 'fill', source: 'b-areas', filter: isClass('pitch'), paint: { 'fill-color': c.pitch, 'fill-outline-color': c.pitchEdge } },
      { id: 'area-parking', type: 'fill', source: 'b-areas', filter: isClass('parking'), paint: { 'fill-color': c.parking } },
      { id: 'area-plaza', type: 'fill', source: 'b-areas', filter: isClass('plaza'), paint: { 'fill-color': c.plaza } },
      { id: 'area-water', type: 'fill', source: 'b-areas', filter: isClass('water'), paint: { 'fill-color': c.water } }
    ];
    // Roads and paths: a slightly darker casing under a lighter line, so they read as raised strips.
    var w = {
      major: [14, 3, 16, 7, 18, 20, 20, 60], minor: [14, 1.5, 16, 4, 18, 12, 20, 40], service: [14, 0.8, 16, 2, 18, 7, 20, 24],
      path: [15, 0.6, 17, 1.6, 19, 4, 21, 10]
    };
    var casing = function (s) { return s.map(function (v, i) { return i % 2 ? v + Math.max(1, v * 0.18) : v; }); };
    var line = { 'line-cap': 'round', 'line-join': 'round' };
    L.push(
      { id: 'path-casing', type: 'line', source: 'b-lines', filter: isClass('path'), minzoom: 15, layout: line, paint: { 'line-color': c.pathCasing, 'line-width': Z(casing(w.path)) } },
      { id: 'path', type: 'line', source: 'b-lines', filter: isClass('path'), minzoom: 15, layout: line, paint: { 'line-color': c.path, 'line-width': Z(w.path) } },
      { id: 'steps', type: 'line', source: 'b-lines', filter: isClass('steps'), minzoom: 16, paint: { 'line-color': c.steps, 'line-width': Z(w.path), 'line-dasharray': [0.3, 0.3] } },
      { id: 'service-casing', type: 'line', source: 'b-lines', filter: isClass('service'), layout: line, paint: { 'line-color': c.roadCasing, 'line-width': Z(casing(w.service)) } },
      { id: 'minor-casing', type: 'line', source: 'b-lines', filter: isClass('minor'), layout: line, paint: { 'line-color': c.roadCasing, 'line-width': Z(casing(w.minor)) } },
      { id: 'major-casing', type: 'line', source: 'b-lines', filter: isClass('major'), layout: line, paint: { 'line-color': c.majorCasing, 'line-width': Z(casing(w.major)) } },
      { id: 'service', type: 'line', source: 'b-lines', filter: isClass('service'), layout: line, paint: { 'line-color': c.road, 'line-width': Z(w.service) } },
      { id: 'minor', type: 'line', source: 'b-lines', filter: isClass('minor'), layout: line, paint: { 'line-color': c.road, 'line-width': Z(w.minor) } },
      { id: 'major', type: 'line', source: 'b-lines', filter: isClass('major'), layout: line, paint: { 'line-color': c.major, 'line-width': Z(w.major) } },
      { id: 'rail', type: 'line', source: 'b-lines', filter: isClass('rail'), paint: { 'line-color': c.rail, 'line-width': Z([14, 1, 18, 3]), 'line-dasharray': [2, 2] } },
      // Trees: soft round crowns that grow as you zoom in (about 5 m across).
      { id: 'trees', type: 'circle', source: 'b-trees', minzoom: 15.5,
        paint: { 'circle-color': c.tree, 'circle-opacity': 0.85, 'circle-stroke-color': c.treeEdge, 'circle-stroke-width': 0.6,
          'circle-radius': Z([15.5, 1, 17, 2.5, 19, 9, 21, 34]), 'circle-pitch-alignment': 'map' } }
    );
    return L;
  }

  // Above the route: buildings in 3D (height in metres from base.js), then the names.
  function top(c) {
    return [
      // Each building is a wall block plus a thin lighter roof slab on top, so the roof edge reads clearly.
      { id: 'houses-3d', type: 'fill-extrusion', source: 'b-houses', minzoom: 14.5,
        paint: { 'fill-extrusion-color': c.house, 'fill-extrusion-height': ['-', ['get', 'h'], 0.6], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
      { id: 'houses-roof', type: 'fill-extrusion', source: 'b-houses', minzoom: 14.5,
        paint: { 'fill-extrusion-color': c.houseTop, 'fill-extrusion-base': ['-', ['get', 'h'], 0.6], 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false } },
      { id: 'buildings-edge', type: 'line', source: 'buildings', filter: plain, paint: { 'line-color': c.edge, 'line-width': Z([15, 0.5, 19, 2]), 'line-opacity': 0.8 } },
      { id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', filter: plain,
        paint: { 'fill-extrusion-color': c.building, 'fill-extrusion-height': ['-', ['coalesce', ['get', 'h'], 15], 0.8], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
      { id: 'buildings-roof', type: 'fill-extrusion', source: 'buildings', filter: plain,
        paint: { 'fill-extrusion-color': c.buildingTop, 'fill-extrusion-base': ['-', ['coalesce', ['get', 'h'], 15], 0.8], 'fill-extrusion-height': ['coalesce', ['get', 'h'], 15], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': false } },
      { id: 'indoor-3d', type: 'fill-extrusion', source: 'buildings', filter: ['has', 'indoor'],
        paint: { 'fill-extrusion-color': c.indoor, 'fill-extrusion-height': ['coalesce', ['get', 'h'], 20], 'fill-extrusion-opacity': 1, 'fill-extrusion-vertical-gradient': true } },
      { id: 'road-names', type: 'symbol', source: 'b-lines', minzoom: 15.5, filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['major', 'minor', 'service']]]],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Inter Regular'], 'text-size': Z([15.5, 10, 19, 13]), 'text-max-angle': 30, 'symbol-spacing': 320 },
        paint: { 'text-color': c.labelSoft, 'text-halo-color': c.halo, 'text-halo-width': 1.4 } },
      { id: 'area-names', type: 'symbol', source: 'b-areas', minzoom: 16, filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['grass', 'pitch', 'plaza', 'water', 'wood']]]],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter Italic'], 'text-size': Z([16, 11, 19, 14]), 'text-max-width': 8 },
        paint: { 'text-color': c.labelGreen, 'text-halo-color': c.halo, 'text-halo-width': 1.2 } },
      { id: 'building-names', type: 'symbol', source: 'buildings', minzoom: 15.6, filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], ''], plain],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter SemiBold'], 'text-size': Z([15.6, 10, 18, 12.5, 20, 15]), 'text-max-width': 7, 'text-padding': 4 },
        paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.5 } },
      { id: 'indoor-names', type: 'symbol', source: 'indoor-names',
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter Bold'], 'text-size': Z([15, 11, 18, 15]), 'text-allow-overlap': true },
        paint: { 'text-color': c.indoorLabel, 'text-halo-color': c.halo, 'text-halo-width': 1.8 } }
    ];
  }

  // ---------- Inside buildings ----------
  // Sizes that are real lengths (walls, doors, furniture) are given in metres and turned into screen pixels for each zoom,
  // so the plan grows and shrinks like the map. ppm = screen pixels per metre at a zoom level, at the school's latitude.
  function ppm(z, lat) { return 512 * Math.pow(2, z) / (40075016.686 * Math.cos(lat * Math.PI / 180)); }
  // A width in metres (a number, or ['get', 'w'] for each line's own width), never thinner than minPx on screen.
  function meters(lat, m, minPx) {
    var e = ['interpolate', ['exponential', 2], ['zoom']];
    for (var z = 14; z <= 24; z++) { e.push(z, ['max', minPx || 0, ['*', m, ppm(z, lat)]]); }
    return e;
  }
  var W = ['get', 'w'];
  var WALL = 0.583, ROOM_LINE = 0.146, SEL = 0.39, MATCH = 0.29, HOVER = 0.24; // metres (12, 3, 8, 6 and 5 Stokes plan units)
  var isK = function (k) { return ['==', ['get', 'k'], k]; };
  var LABELS_FROM = 18.3, CLOSE_UP = 19.8; // room names show from LABELS_FROM; small-room names and fixture names from CLOSE_UP

  // The images the app must add to the map before these layers (a native app ships them as a sprite):
  //   mapbc-entry: a white "go in" arrow; mapbc-pill-ok, mapbc-pill-route: stretchable rounded tags (green, blue).
  var IMAGES = ['mapbc-entry', 'mapbc-pill-ok', 'mapbc-pill-route'];

  // Every indoor layer, bottom to top. "metadata.kf" is the layer's own filter; indoorState adds "which building and floor".
  // Sources: indoor (core/indoor.js features of every building), in-net (path network), in-route (route line and tags).
  function indoor(c, lat) {
    var L = function (id, type, source, kf, paint, layout, extra) {
      var l = { id: id, type: type, source: source, metadata: { kf: kf }, filter: kf, paint: paint || {} };
      if (layout) { l.layout = layout; }
      for (var k in (extra || {})) { l[k] = extra[k]; }
      return l;
    };
    var roomColor = ['match', ['get', 'type']];
    Object.keys(c.rooms).forEach(function (t) { roomColor.push(t, c.rooms[t]); });
    roomColor.push(c.rooms.core);
    var text = function (size, font, extra) {
      var l = { 'text-field': ['get', 'text'], 'text-font': [font || 'Inter Bold'], 'text-size': size, 'text-max-width': 8, 'text-line-height': 1.15 };
      for (var k in (extra || {})) { l[k] = extra[k]; }
      return l;
    };
    var roomText = ['interpolate', ['linear'], ['zoom'], LABELS_FROM, 9.5, 18.9, 11.5, 20.2, 11.5, 21, 17, 22, 26];
    return [
      L('in-shadow', 'fill', 'indoor', isK('floor'), { 'fill-color': '#000000', 'fill-opacity': c.shadow * 0.8, 'fill-translate': [0, 7], 'fill-translate-anchor': 'viewport' }),
      L('in-floor', 'fill', 'indoor', isK('floor'), { 'fill-color': c.floor }),
      L('in-pier', 'fill', 'indoor', ['in', ['get', 'k'], ['literal', ['pier', 'pillar']]], { 'fill-color': c.wall }),
      L('in-wall', 'line', 'indoor', ['all', isK('floor'), ['!', ['get', 'guess']]], { 'line-color': c.wall, 'line-width': meters(lat, WALL, 1) }, { 'line-join': 'miter' }),
      L('in-wall-guess', 'line', 'indoor', ['all', isK('floor'), ['get', 'guess']], { 'line-color': c.wall, 'line-opacity': 0.5, 'line-width': meters(lat, WALL, 1), 'line-dasharray': [2, 1.1] }),
      L('in-fixture', 'fill', 'indoor', isK('fixture'), { 'fill-color': c.fix }),
      L('in-fixture-line', 'line', 'indoor', isK('fixture'), { 'line-color': c.wall, 'line-width': meters(lat, ROOM_LINE, 0.5) }),
      L('in-room', 'fill', 'indoor', isK('room'), { 'fill-color': roomColor }),
      L('in-room-line', 'line', 'indoor', isK('room'), { 'line-color': c.wall, 'line-width': meters(lat, ROOM_LINE, 0.5) }, { 'line-join': 'miter' }),
      L('in-partition', 'line', 'indoor', isK('partition'), { 'line-color': c.wall, 'line-width': meters(lat, W, 0.4) }),
      L('in-furn', 'line', 'indoor', isK('furn'), { 'line-color': c.fg, 'line-width': meters(lat, W, 0.4) }, { 'line-cap': 'round' }),
      L('in-furn-fill', 'fill', 'indoor', isK('furn-fill'), { 'fill-color': c.fg }),
      L('in-wc', 'fill', 'indoor', isK('wc'), { 'fill-color': c.fg }),
      L('in-door-gap', 'line', 'indoor', ['in', ['get', 'k'], ['literal', ['door-gap', 'entry-gap']]], { 'line-color': c.floor, 'line-width': meters(lat, W, 1) }),
      L('in-door-leaf', 'line', 'indoor', isK('door-leaf'), { 'line-color': c.wall, 'line-width': meters(lat, W, 0.5) }),
      L('in-door-arc', 'line', 'indoor', isK('door-arc'), { 'line-color': c.wall, 'line-opacity': 0.8, 'line-width': meters(lat, W, 0.4), 'line-dasharray': [2.5, 2] }),
      // Search matches, the room under the mouse, and the selected room (a soft glow under a strong outline).
      L('in-room-match', 'line', 'indoor', ['all', isK('room'), false], { 'line-color': c.accent, 'line-width': meters(lat, MATCH, 2) }),
      L('in-room-hover', 'line', 'indoor', ['all', isK('room'), false], { 'line-color': c.route, 'line-width': meters(lat, HOVER, 2) }),
      L('in-room-glow', 'line', 'indoor', ['all', isK('room'), false], { 'line-color': c.accent, 'line-opacity': 0.45, 'line-blur': 8, 'line-width': meters(lat, SEL * 3, 8) }),
      L('in-room-sel', 'line', 'indoor', ['all', isK('room'), false], { 'line-color': c.accent, 'line-width': meters(lat, SEL, 3) }),
      // Path network ("Show path network"): hallway lines, their points, how doors join them, and floor links.
      L('in-net-attach', 'line', 'in-net', isK('attach'), { 'line-color': c.muted, 'line-width': 1.2, 'line-dasharray': [2, 2] }),
      L('in-net-edge', 'line', 'in-net', ['all', isK('edge'), ['!', ['get', 'guess']]], { 'line-color': c.muted, 'line-width': 2.5 }, { 'line-cap': 'round' }),
      L('in-net-edge-guess', 'line', 'in-net', ['all', isK('edge'), ['get', 'guess']], { 'line-color': c.guess, 'line-width': 2.5, 'line-dasharray': [2.5, 2] }),
      L('in-net-link', 'circle', 'in-net', isK('link'), { 'circle-radius': 12, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': c.route, 'circle-stroke-width': 2.5 }),
      L('in-net-node', 'circle', 'in-net', isK('node'), { 'circle-radius': 4, 'circle-color': ['case', ['get', 'guess'], c.guess, c.muted] }),
      L('in-net-door', 'circle', 'in-net', isK('door'), { 'circle-radius': 3.5, 'circle-color': c.surface, 'circle-stroke-color': c.muted, 'circle-stroke-width': 1.5 }),
      // The route on this floor: a light casing, the blue line, and a dashed line running along it.
      L('in-route-casing', 'line', 'in-route', isK('route'), { 'line-color': c.floor, 'line-opacity': 0.9, 'line-width': 10 }, { 'line-cap': 'round', 'line-join': 'round' }),
      L('in-route-line', 'line', 'in-route', isK('route'), { 'line-color': c.route, 'line-width': 5 }, { 'line-cap': 'round', 'line-join': 'round' }),
      L('in-route-flow', 'line', 'in-route', isK('route'), { 'line-color': '#ffffff', 'line-opacity': 0.8, 'line-width': 1.8, 'line-dasharray': [0.6, 7] }, { 'line-cap': 'round', 'line-join': 'round' }),
      // Names: wings (zoomed out a little), small fixtures (close up), rooms (small rooms only close up, or when selected).
      L('in-label', 'symbol', 'indoor', isK('label'), { 'text-color': c.muted, 'text-opacity': 0.75 },
        text(['interpolate', ['exponential', 2], ['zoom'], LABELS_FROM, 8, CLOSE_UP, 22], 'Inter Bold', { 'text-letter-spacing': 0.3, 'text-max-width': 30 }), { minzoom: LABELS_FROM, maxzoom: CLOSE_UP }),
      L('in-fix-label', 'symbol', 'indoor', isK('fixture-label'), { 'text-color': c.muted },
        text(['interpolate', ['linear'], ['zoom'], CLOSE_UP, 8.5, 21, 12, 22, 18], 'Inter Bold', { 'text-transform': 'uppercase', 'text-letter-spacing': 0.06 }), { minzoom: CLOSE_UP }),
      L('in-room-label', 'symbol', 'indoor', ['all', isK('room-label'), ['!', ['get', 'tiny']]], { 'text-color': c.fg, 'text-halo-color': c.textHalo, 'text-halo-width': 1.6 },
        text(roomText), { minzoom: LABELS_FROM }),
      L('in-room-label-small', 'symbol', 'indoor', ['all', isK('room-label'), ['get', 'tiny']], { 'text-color': c.fg, 'text-halo-color': c.textHalo, 'text-halo-width': 1.6 },
        text(roomText), { minzoom: CLOSE_UP }),
      L('in-room-label-sel', 'symbol', 'indoor', ['all', isK('room-label'), false], { 'text-color': c.fg, 'text-halo-color': c.textHalo, 'text-halo-width': 2 },
        text(roomText, 'Inter Bold', { 'text-allow-overlap': true })),
      // 360 photo points and entrances (green, with a "go in" arrow; the name shows close up or when it is the start).
      L('in-spot', 'circle', 'indoor', isK('spot'), { 'circle-radius': 9.5, 'circle-color': c.surface, 'circle-stroke-color': c.accent, 'circle-stroke-width': 1.5 }, null, { minzoom: LABELS_FROM }),
      L('in-spot-text', 'symbol', 'indoor', isK('spot'), { 'text-color': c.accent },
        { 'text-field': '360', 'text-font': ['Inter Bold'], 'text-size': 7.5, 'text-allow-overlap': true }, { minzoom: LABELS_FROM }),
      L('in-entr-ring', 'circle', 'indoor', ['all', isK('entrance'), false], { 'circle-radius': 14, 'circle-color': 'rgba(0,0,0,0)', 'circle-stroke-color': c.ok, 'circle-stroke-width': 2, 'circle-stroke-opacity': 0.8 }),
      L('in-entr', 'circle', 'indoor', isK('entrance'), { 'circle-radius': 10.5, 'circle-color': c.ok, 'circle-stroke-color': c.surface, 'circle-stroke-width': 2.5 }),
      L('in-entr-icon', 'symbol', 'indoor', isK('entrance'), {}, { 'icon-image': 'mapbc-entry', 'icon-size': 0.5, 'icon-allow-overlap': true, 'icon-ignore-placement': true }),
      L('in-entr-tag', 'symbol', 'indoor', isK('entrance'), { 'text-color': '#ffffff' },
        { 'text-field': ['get', 'name'], 'text-font': ['Inter Bold'], 'text-size': 10.5, 'text-anchor': 'top', 'text-offset': [0, 1.6], 'text-max-width': 20,
          'icon-image': 'mapbc-pill-ok', 'icon-text-fit': 'both', 'icon-text-fit-padding': [3, 8, 3, 8], 'icon-anchor': 'top', 'icon-offset': [0, 0] }, { minzoom: CLOSE_UP }),
      L('in-entr-tag-on', 'symbol', 'indoor', ['all', isK('entrance'), false], { 'text-color': '#ffffff' },
        { 'text-field': ['get', 'name'], 'text-font': ['Inter Bold'], 'text-size': 10.5, 'text-anchor': 'top', 'text-offset': [0, 1.6], 'text-max-width': 20,
          'icon-image': 'mapbc-pill-ok', 'icon-text-fit': 'both', 'icon-text-fit-padding': [3, 8, 3, 8], 'text-allow-overlap': true, 'icon-allow-overlap': true }),
      // Where the route changes floor ("Up to Level 2") and where it ends.
      L('in-route-tag', 'symbol', 'in-route', isK('tag'), { 'text-color': '#ffffff' },
        { 'text-field': ['get', 'text'], 'text-font': ['Inter Bold'], 'text-size': 12, 'text-anchor': 'bottom', 'text-offset': [0, -1.2],
          'icon-image': 'mapbc-pill-route', 'icon-text-fit': 'both', 'icon-text-fit-padding': [4, 10, 4, 10], 'text-allow-overlap': true, 'icon-allow-overlap': true }),
      L('in-route-tag-dot', 'circle', 'in-route', isK('tag'), { 'circle-radius': 6, 'circle-color': c.route, 'circle-stroke-color': c.surface, 'circle-stroke-width': 2.5 }),
      L('in-route-end-ring', 'circle', 'in-route', isK('end'), { 'circle-radius': 16, 'circle-color': c.route, 'circle-opacity': 0.25 }),
      L('in-route-end', 'circle', 'in-route', isK('end'), { 'circle-radius': 7.5, 'circle-color': c.route, 'circle-stroke-color': '#ffffff', 'circle-stroke-width': 3 })
    ];
  }

  // What changes while you use the map, as filters and paint values for the layers above.
  // state: { open: building id or '', level: level id, sel: selected room key ('building/room id') or '',
  //          hover: room key or '', match: list of room keys (while searching) or null, hidden: list of room types turned off,
  //          on: entrance id that is the starting point, or '' }
  // Returns { filters: { layerId: filter }, paint: { layerId: { property: value } } }.
  function indoorState(c, layers, state) {
    var where = ['all', ['==', ['get', 'b'], state.open || ''], ['==', ['get', 'lvl'], state.level || '']];
    var filters = {}, paint = {};
    layers.forEach(function (l) {
      var kf = l.metadata.kf, extra = null;
      if (l.id === 'in-room-match') { extra = ['in', ['get', 'key'], ['literal', state.match || []]]; }
      if (l.id === 'in-room-hover') { extra = ['==', ['get', 'key'], state.hover || '']; }
      if (l.id === 'in-room-glow' || l.id === 'in-room-sel' || l.id === 'in-room-label-sel') { extra = ['==', ['get', 'key'], state.sel || '']; }
      if (l.id === 'in-entr-ring' || l.id === 'in-entr-tag-on') { extra = ['==', ['get', 'eid'], state.on || '']; }
      if (extra) { kf = ['all', kf[0] === 'all' ? kf[1] : kf, extra]; }
      // The route, network and markers live in their own sources: those are already only for the open building.
      filters[l.id] = l.source === 'indoor' ? ['all', where, kf] : ['all', ['==', ['get', 'lvl'], state.level || ''], kf];
    });
    // Faded rooms: a room type turned off in the legend is nearly hidden; while searching or with a room selected,
    // the other rooms are half faded so the ones that matter stand out.
    var keyed = ['has', 'key'];
    var strength = ['case', ['!', keyed], 1, ['in', ['get', 'type'], ['literal', state.hidden || []]], 0.12];
    if (state.match) { strength.push(['in', ['get', 'key'], ['literal', state.match]], 1, 0.5); }
    else if (state.sel) { strength.push(['==', ['get', 'key'], state.sel], 1, 0.5); }
    else { strength.push(1); }
    var times = function (k) { return ['*', k, strength]; };
    paint['in-room'] = { 'fill-opacity': strength };
    paint['in-room-line'] = { 'line-opacity': strength };
    paint['in-partition'] = { 'line-opacity': times(0.75) };
    paint['in-furn'] = { 'line-opacity': times(0.42) };
    paint['in-furn-fill'] = { 'fill-opacity': times(0.42) };
    paint['in-wc'] = { 'fill-opacity': times(0.45) };
    paint['in-door-leaf'] = { 'line-opacity': strength };
    paint['in-room-label'] = { 'text-opacity': strength };
    paint['in-room-label-small'] = { 'text-opacity': strength };
    return { filters: filters, paint: paint };
  }

  return {
    palettes: PALETTES,
    // Sun: from the south-west, fairly low, so walls facing different ways get different shades.
    light: { light: { anchor: 'map', position: [1.4, 215, 38], intensity: 0.5, color: '#fff6e8' }, dark: { anchor: 'map', position: [1.4, 215, 38], intensity: 0.35, color: '#b9c6ff' } },
    ground: ground,
    top: top,
    indoor: indoor,
    indoorState: indoorState,
    images: IMAGES,
    meters: meters,
    zooms: { labels: LABELS_FROM, closeUp: CLOSE_UP },
    // A palette with the school's own colour (school.json "accent", and "accentDark" for dark mode if given).
    palette: function (mode, school) {
      var base = PALETTES[mode === 'dark' ? 'dark' : 'light'], out = {};
      for (var k in base) { out[k] = base[k]; }
      if (school && school.accent && mode !== 'dark') { out.accent = school.accent; }
      if (school && school.accentDark && mode === 'dark') { out.accent = school.accentDark; }
      return out;
    },
    // The font names the layers use, and the font weight/style each one is (see the @font-face rules in web/app.css).
    fonts: { 'Inter Regular': '400 normal', 'Inter SemiBold': '600 normal', 'Inter Bold': '700 normal', 'Inter Italic': '400 italic' }
  };
});
