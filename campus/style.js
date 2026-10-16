// How the campus map looks: colours and map layers, in MapLibre's style format (the same format the iOS and
// Android versions of MapLibre read, so this file carries over to an app).
//
// To change a colour, change it in PALETTES below (one set for light mode, one for dark mode).
// The layers say what is drawn, in order from the bottom up, and which colour each one uses.
//
// What each layer draws comes from campus/base.js (grass, roads, trees, nearby houses, building heights)
// and campus/data.js (campus buildings), both made by tools/osm_to_campus.js from OpenStreetMap.
// Map labels use the Inter font (vendor/inter-5.3.0, SIL Open Font License).
window.CAMPUS_STYLE = (function () {
  var PALETTES = {
    light: {
      land: '#f3f2ee', campus: '#f5efe9', residential: '#efede8',
      grass: '#d4eac3', wood: '#c3dfb0', pitch: '#c6e6b0', pitchEdge: '#a9d48f', parking: '#e5e7ec', plaza: '#ebe9e4', water: '#a7d0ee',
      roadCasing: '#d3d6dc', road: '#ffffff', major: '#fff4cf', majorCasing: '#e3cf91', path: '#ffffff', pathCasing: '#dcd9d2', steps: '#c9a98a', rail: '#9aa1ad',
      tree: '#9ccc83', treeEdge: '#86b96c',
      building: '#d9dde7', buildingTop: '#e4e8f0', house: '#e6e2db', stokes: '#7d1a2a', selected: '#5b8def',
      label: '#353d4b', labelSoft: '#6a7282', labelGreen: '#4c7a37', halo: '#ffffff', stokesLabel: '#7d1b2b'
    },
    dark: {
      land: '#1a1f2b', campus: '#1d2130', residential: '#1b2029',
      grass: '#1f3326', wood: '#1d3324', pitch: '#22402b', pitchEdge: '#2d5236', parking: '#232937', plaza: '#212634', water: '#16304a',
      roadCasing: '#11151d', road: '#2f3647', major: '#4a4434', majorCasing: '#11151d', path: '#343b4d', pathCasing: '#151a24', steps: '#7a6150', rail: '#566074',
      tree: '#2b4a33', treeEdge: '#355c3e',
      building: '#323b52', buildingTop: '#3a4560', house: '#2c3140', stokes: '#8a2737', selected: '#4d7fe0',
      label: '#d7deeb', labelSoft: '#9aa4b8', labelGreen: '#8fbf7a', halo: '#121620', stokesLabel: '#f0b5bf'
    }
  };

  var Z = function (stops) { return ['interpolate', ['exponential', 1.6], ['zoom']].concat(stops); };
  var isClass = function (c) { return ['==', ['get', 'class'], c]; };
  var notStokes = ['!', ['in', 'Stokes Hall', ['coalesce', ['get', 'name'], '']]];

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
      { id: 'houses-3d', type: 'fill-extrusion', source: 'b-houses', minzoom: 14.5,
        paint: { 'fill-extrusion-color': c.house, 'fill-extrusion-height': ['get', 'h'], 'fill-extrusion-opacity': 0.9, 'fill-extrusion-vertical-gradient': true } },
      { id: 'buildings-3d', type: 'fill-extrusion', source: 'buildings', filter: notStokes,
        paint: { 'fill-extrusion-color': c.building, 'fill-extrusion-height': ['coalesce', ['get', 'h'], 15], 'fill-extrusion-opacity': 0.95, 'fill-extrusion-vertical-gradient': true } },
      { id: 'stokes-3d', type: 'fill-extrusion', source: 'foot',
        paint: { 'fill-extrusion-color': c.stokes, 'fill-extrusion-height': ['coalesce', ['get', 'h'], 20], 'fill-extrusion-opacity': 0.9, 'fill-extrusion-vertical-gradient': true } },
      { id: 'road-names', type: 'symbol', source: 'b-lines', minzoom: 15.5, filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['major', 'minor', 'service']]]],
        layout: { 'symbol-placement': 'line', 'text-field': ['get', 'name'], 'text-font': ['Inter Regular'], 'text-size': Z([15.5, 10, 19, 13]), 'text-max-angle': 30, 'symbol-spacing': 320 },
        paint: { 'text-color': c.labelSoft, 'text-halo-color': c.halo, 'text-halo-width': 1.4 } },
      { id: 'area-names', type: 'symbol', source: 'b-areas', minzoom: 16, filter: ['all', ['has', 'name'], ['in', ['get', 'class'], ['literal', ['grass', 'pitch', 'plaza', 'water', 'wood']]]],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter Italic'], 'text-size': Z([16, 11, 19, 14]), 'text-max-width': 8 },
        paint: { 'text-color': c.labelGreen, 'text-halo-color': c.halo, 'text-halo-width': 1.2 } },
      { id: 'building-names', type: 'symbol', source: 'buildings', minzoom: 15.6, filter: ['all', ['has', 'name'], ['!=', ['get', 'name'], ''], notStokes],
        layout: { 'text-field': ['get', 'name'], 'text-font': ['Inter SemiBold'], 'text-size': Z([15.6, 10, 18, 12.5, 20, 15]), 'text-max-width': 7, 'text-padding': 4 },
        paint: { 'text-color': c.label, 'text-halo-color': c.halo, 'text-halo-width': 1.5 } },
      { id: 'stokes-name', type: 'symbol', source: 'foot-label',
        layout: { 'text-field': 'Stokes Hall', 'text-font': ['Inter Bold'], 'text-size': Z([15, 11, 18, 15]), 'text-allow-overlap': true },
        paint: { 'text-color': c.stokesLabel, 'text-halo-color': c.halo, 'text-halo-width': 1.8 } }
    ];
  }

  return {
    palettes: PALETTES,
    ground: ground,
    top: top,
    // The font names the layers use, and the font weight/style each one is (see the @font-face rules in index.html).
    fonts: { 'Inter Regular': '400 normal', 'Inter SemiBold': '600 normal', 'Inter Bold': '700 normal', 'Inter Italic': '400 italic' }
  };
})();
