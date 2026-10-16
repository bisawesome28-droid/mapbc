// Turns an OpenStreetMap export into the three files the campus map reads.
//
//   1. In Overpass Turbo (see campus/README.md) run the query and choose Export > GeoJSON > download.
//   2. Save that file as campus/osm_export.geojson
//   3. node tools/osm_to_campus.js campus/osm_export.geojson
//
// It writes two files and prints a short report of what it found (and what is missing, like buildings with no name):
//   campus/data.js  window.CAMPUS_DATA: buildings, walking paths and entrances (search and directions use these)
//   campus/base.js  window.CAMPUS_BASE: what the map draws around them (grass, roads, parking, water, trees,
//                   nearby houses, and how tall each building is), styled by campus/style.js
// Running it again overwrites campus/data.js, so make hand edits only after you are happy with the import.
//
// The conversion is in a function so tests.js can check it: require('./tools/osm_to_campus.js').convert(...)

var fs = require('fs');
var path = require('path');

// Kinds of "highway" that people walk on. Roads for cars only are left out.
var WALKABLE = {
  footway: 1, path: 1, pedestrian: 1, steps: 1, corridor: 1, cycleway: 1, track: 1,
  service: 1, living_street: 1, residential: 1, unclassified: 1, elevator: 1
};

// Copies only the listed tags, skipping empty ones, so the files stay small and readable.
function pick(props, keys) {
  var out = {};
  keys.forEach(function (k) { if (props[k] != null && props[k] !== '') { out[k] = props[k]; } });
  return out;
}

// Rounds coordinates to 7 decimal places (about 1 cm), which keeps files small.
function round(coords) {
  if (typeof coords[0] === 'number') { return [Math.round(coords[0] * 1e7) / 1e7, Math.round(coords[1] * 1e7) / 1e7]; }
  return coords.map(round);
}

function osmId(f) { return f.id || (f.properties && (f.properties['@id'] || f.properties.id)) || ''; }

// Is a point [lng, lat] inside a polygon ring? (Counts how many edges a line to the right crosses.)
function inRing(pt, ring) {
  var c = false;
  for (var i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    var a = ring[i], b = ring[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) { c = !c; }
  }
  return c;
}
function outerRings(g) { return g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map(function (p) { return p[0]; }); }
function middle(g) {
  var r = outerRings(g)[0], x = 0, y = 0;
  r.forEach(function (c) { x += c[0] / r.length; y += c[1] / r.length; });
  return [x, y];
}

// How tall a building is drawn, in metres: its "height" tag, else its floors ("building:levels") times 3.5 m,
// else a guess from its kind (marked guess: 1 so you can tell). Fix a wrong one by adding the tag in OpenStreetMap.
var SMALL = { house: 8, detached: 8, semidetached_house: 8, terrace: 9, residential: 9, apartments: 12, garage: 3, garages: 3, shed: 3, roof: 5, hut: 3, greenhouse: 4 };
function heightOf(p, onCampusBuilding) {
  var h = parseFloat(p.height);
  if (h > 0) { return { h: Math.round(h * 10) / 10 }; }
  var lv = parseFloat(p['building:levels']);
  if (lv > 0) { return { h: Math.round(lv * 3.5 + 1.5) }; }
  if (SMALL[p.building]) { return { h: SMALL[p.building], guess: 1 }; }
  if (p.building === 'dormitory') { return { h: 17, guess: 1 }; }
  return { h: onCampusBuilding ? 15 : 9, guess: 1 };
}

// What kind of area something is, for colouring: grass, wood, water, parking, pitch, plaza or residential.
function areaClass(p) {
  if (p.amenity === 'parking') { return 'parking'; }
  if (p.natural === 'water' || p.waterway === 'riverbank' || p.waterway === 'dock' || p.landuse === 'reservoir' || p.landuse === 'basin' || p.leisure === 'swimming_pool') { return 'water'; }
  if (p.natural === 'wood' || p.landuse === 'forest') { return 'wood'; }
  if (p.natural === 'wetland' || p.natural === 'scrub' || p.natural === 'grassland') { return 'wood'; }
  if ({ pitch: 1, track: 1, stadium: 1, playground: 1, sports_centre: 1 }[p.leisure]) { return 'pitch'; }
  if ({ grass: 1, meadow: 1, village_green: 1, recreation_ground: 1, cemetery: 1, allotments: 1 }[p.landuse] ||
      { park: 1, garden: 1, golf_course: 1, nature_reserve: 1, common: 1 }[p.leisure]) { return 'grass'; }
  if (p['area:highway'] || (p.highway === 'pedestrian' && p.area === 'yes') || p.place === 'square') { return 'plaza'; }
  if (p.landuse === 'residential') { return 'residential'; }
  return null;
}

// What kind of line something is: major, minor or service road, path, steps, or rail.
var ROAD = { motorway: 'major', trunk: 'major', primary: 'major', secondary: 'major', motorway_link: 'major', trunk_link: 'major', primary_link: 'major', secondary_link: 'major',
  tertiary: 'minor', tertiary_link: 'minor', residential: 'minor', unclassified: 'minor', living_street: 'minor', service: 'service',
  footway: 'path', path: 'path', pedestrian: 'path', cycleway: 'path', track: 'path', corridor: 'path', bridleway: 'path', steps: 'steps' };
var RAIL = { rail: 1, light_rail: 1, tram: 1, subway: 1 };

function round6(coords) {
  if (typeof coords[0] === 'number') { return [Math.round(coords[0] * 1e6) / 1e6, Math.round(coords[1] * 1e6) / 1e6]; }
  return coords.map(round6);
}

// The drawing layer: everything the map shows around the campus buildings. `campusOsm` lists the buildings
// already in CAMPUS_DATA (they are drawn from there, with the heights added here).
function convertBase(fc, campusOsm) {
  var areas = [], lines = [], trees = [], houses = [], heights = {}, guessed = 0, box = [180, 90, -180, -90];
  function grow(c) {
    if (typeof c[0] === 'number') { box[0] = Math.min(box[0], c[0]); box[1] = Math.min(box[1], c[1]); box[2] = Math.max(box[2], c[0]); box[3] = Math.max(box[3], c[1]); return; }
    c.forEach(grow);
  }
  ((fc && fc.features) || []).forEach(function (f) {
    var g = f.geometry, p = f.properties || {};
    if (!g) { return; }
    var poly = g.type === 'Polygon' || g.type === 'MultiPolygon', line = g.type === 'LineString' || g.type === 'MultiLineString';
    if (poly && p.building) {
      var id = osmId(f), ht = heightOf(p, !!campusOsm[id]);
      if (ht.guess) { guessed++; }
      if (campusOsm[id]) { heights[id] = ht; return; }
      var hp = { h: ht.h };
      if (ht.guess) { hp.guess = 1; }
      houses.push({ type: 'Feature', properties: hp, geometry: { type: g.type, coordinates: round6(g.coordinates) } });
    } else if (poly && areaClass(p)) {
      var ap = { 'class': areaClass(p) };
      if (p.name) { ap.name = p.name; }
      areas.push({ type: 'Feature', properties: ap, geometry: { type: g.type, coordinates: round6(g.coordinates) } });
    } else if (line && (ROAD[p.highway] || RAIL[p.railway])) {
      var lp = { 'class': ROAD[p.highway] || 'rail' };
      if (p.name && lp['class'] !== 'path') { lp.name = p.name; }
      if (p.bridge && p.bridge !== 'no') { lp.bridge = 1; }
      if (p.tunnel && p.tunnel !== 'no') { lp.tunnel = 1; }
      lines.push({ type: 'Feature', properties: lp, geometry: { type: g.type, coordinates: round6(g.coordinates) } });
      grow(g.coordinates);
    } else if (g.type === 'Point' && p.natural === 'tree') {
      trees.push(round6(g.coordinates));
    }
  });
  // Big areas are drawn first so small ones (a lawn inside a park) sit on top.
  var order = { residential: 0, wood: 1, grass: 2, pitch: 3, parking: 4, plaza: 5, water: 6 };
  areas.sort(function (a, b) { return order[a.properties['class']] - order[b.properties['class']]; });
  return {
    bounds: box.map(function (v) { return Math.round(v * 1e5) / 1e5; }),
    areas: { type: 'FeatureCollection', features: areas },
    lines: { type: 'FeatureCollection', features: lines },
    houses: { type: 'FeatureCollection', features: houses },
    trees: { type: 'FeatureCollection', features: trees.length ? [{ type: 'Feature', properties: {}, geometry: { type: 'MultiPoint', coordinates: trees } }] : [] },
    heights: heights,
    report: { areas: areas.length, lines: lines.length, trees: trees.length, houses: houses.length, guessedHeights: guessed }
  };
}

function convert(fc) {
  var buildings = [], paths = [], entrances = [], campus = [], skipped = 0, outside = 0;
  var all = (fc && fc.features) || [];
  // The campus boundary (amenity=university or college), when the export has it.
  all.forEach(function (f) {
    var g = f.geometry, p = f.properties || {};
    if (g && (g.type === 'Polygon' || g.type === 'MultiPolygon') && (p.amenity === 'university' || p.amenity === 'college')) {
      campus.push({ type: 'Feature', properties: { osm: osmId(f), name: p.name || '' }, geometry: { type: g.type, coordinates: round(g.coordinates) } });
    }
  });
  var rings = [];
  campus.forEach(function (c) { rings = rings.concat(outerRings(c.geometry)); });
  function onCampus(g) {
    if (!rings.length) { return true; } // no boundary in the export: keep everything
    var m = middle(g);
    return rings.some(function (r) { return inRing(m, r); });
  }
  all.forEach(function (f) {
    var g = f.geometry, p = f.properties || {};
    if (!g) { skipped++; return; }
    if (p.amenity === 'university' || p.amenity === 'college') { return; }
    if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && p.building) {
      // Only buildings on campus (inside the campus boundary) go in; the houses and shops around it are drawn from base.js.
      if (!onCampus(g)) { outside++; return; }
      var props = { osm: osmId(f), name: p.name || p.official_name || '' };
      if (p.building !== 'yes') { props.kind = p.building; }
      if (p['building:levels']) { props.levels = p['building:levels']; }
      buildings.push({ type: 'Feature', properties: props, geometry: { type: g.type, coordinates: round(g.coordinates) } });
    } else if ((g.type === 'LineString' || g.type === 'MultiLineString') && WALKABLE[p.highway]) {
      var pp = pick(p, ['name', 'wheelchair', 'incline', 'surface', 'step_count', 'handrail', 'covered', 'lit']);
      pp.osm = osmId(f); pp.highway = p.highway;
      paths.push({ type: 'Feature', properties: pp, geometry: { type: g.type, coordinates: round(g.coordinates) } });
    } else if (g.type === 'Point' && p.entrance) {
      var ep = pick(p, ['name', 'ref', 'wheelchair', 'door', 'level']);
      ep.osm = osmId(f); ep.entrance = p.entrance;
      entrances.push({ type: 'Feature', properties: ep, geometry: { type: 'Point', coordinates: round(g.coordinates) } });
    } else { skipped++; }
  });
  // Named buildings first, in alphabetical order, then the unnamed ones.
  buildings.sort(function (a, b) {
    var an = a.properties.name, bn = b.properties.name;
    if (!an !== !bn) { return an ? -1 : 1; }
    return an ? an.localeCompare(bn) : 0;
  });
  var named = buildings.filter(function (b) { return b.properties.name; }).length;
  return {
    buildings: { type: 'FeatureCollection', features: buildings },
    campus: { type: 'FeatureCollection', features: campus },
    paths: { type: 'FeatureCollection', features: paths },
    entrances: { type: 'FeatureCollection', features: entrances },
    report: { buildings: buildings.length, namedBuildings: named, paths: paths.length, entrances: entrances.length, skipped: skipped, outsideCampus: outside, campusAreas: campus.length }
  };
}

// The page reads window.CAMPUS_DATA from a script file (scripts load from disk; fetch() does not).
// One feature per line keeps the file readable and git diffs small.
function toDataJs(out) {
  function fc(c) {
    if (!c.features.length) { return '{"type": "FeatureCollection", "features": []}'; }
    return '{"type": "FeatureCollection", "features": [\n' + c.features.map(function (f) { return '    ' + JSON.stringify(f); }).join(',\n') + '\n  ]}';
  }
  return '// Campus data for the outdoor map: buildings, walking paths and building entrances, in GeoJSON.\n' +
    '// Coordinates are [longitude, latitude] (longitude FIRST, the opposite of Google Maps).\n' +
    '// Written by tools/osm_to_campus.js from an OpenStreetMap export (see campus/README.md).\n' +
    '// Data (c) OpenStreetMap contributors, ODbL. Keep the credit on the map.\n' +
    'window.CAMPUS_DATA = {\n  "campus": ' + fc(out.campus || { features: [] }) + ',\n  "buildings": ' + fc(out.buildings) + ',\n  "paths": ' + fc(out.paths) + ',\n  "entrances": ' + fc(out.entrances) + '\n};\n';
}

function toBaseJs(base) {
  function fc(c) {
    if (!c.features.length) { return '{"type": "FeatureCollection", "features": []}'; }
    return '{"type": "FeatureCollection", "features": [\n' + c.features.map(function (f) { return '    ' + JSON.stringify(f); }).join(',\n') + '\n  ]}';
  }
  return '// What the campus map draws around the buildings: grass, roads, parking, water, trees, nearby houses,\n' +
    '// and how tall each campus building is ("heights", by OpenStreetMap id, in metres; guess: 1 = not in OSM yet).\n' +
    '// Written by tools/osm_to_campus.js from an OpenStreetMap export. Colours and layers are in campus/style.js.\n' +
    '// Data (c) OpenStreetMap contributors, ODbL. Keep the credit on the map.\n' +
    'window.CAMPUS_BASE = {\n  "bounds": ' + JSON.stringify(base.bounds) + ',\n  "heights": ' + JSON.stringify(base.heights) +
    ',\n  "areas": ' + fc(base.areas) + ',\n  "lines": ' + fc(base.lines) + ',\n  "houses": ' + fc(base.houses) + ',\n  "trees": ' + JSON.stringify(base.trees) + '\n};\n';
}

function main(file) {
  if (!file) { console.error('Usage: node tools/osm_to_campus.js campus/osm_export.geojson'); process.exit(1); }
  var input;
  try { input = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(1); }
  if (!input.features) { console.error(file + ' is not GeoJSON. In Overpass Turbo use Export > GeoJSON, not the raw data.'); process.exit(1); }
  var out = convert(input), dir = path.join(__dirname, '..', 'campus');
  fs.writeFileSync(path.join(dir, 'data.js'), toDataJs(out));
  var ids = {};
  out.buildings.features.forEach(function (b) { ids[b.properties.osm] = 1; });
  var base = convertBase(input, ids);
  fs.writeFileSync(path.join(dir, 'base.js'), toBaseJs(base));
  var r = out.report;
  console.log('Buildings: ' + r.buildings + ' (' + r.namedBuildings + ' with a name, ' + (r.buildings - r.namedBuildings) + ' without)');
  console.log('Walking paths: ' + r.paths);
  console.log('Entrances: ' + r.entrances + (r.entrances < r.buildings ? '  (fewer than buildings: most doors still need adding)' : ''));
  if (r.campusAreas) { console.log('Campus boundary: ' + r.campusAreas + ' area(s). Left out ' + r.outsideCampus + ' unnamed buildings outside it (houses nearby).'); }
  console.log('Left out of directions: ' + r.skipped + ' other items (roads, trees, and so on)');
  var q = base.report;
  console.log('Drawn around them (campus/base.js): ' + q.areas + ' areas, ' + q.lines + ' roads and paths, ' + q.trees + ' trees, ' + q.houses + ' nearby houses');
  console.log('Building heights guessed (no "height" or "building:levels" in OpenStreetMap): ' + q.guessedHeights);
  var unnamed = out.buildings.features.filter(function (b) { return !b.properties.name; }).length;
  if (unnamed) { console.log('\nBuildings with no name will not show a label or turn up in search. Name them in OpenStreetMap or in campus/data.js.'); }
}

if (require.main === module) { main(process.argv[2]); }
module.exports = { convert: convert, toDataJs: toDataJs, convertBase: convertBase, toBaseJs: toBaseJs, heightOf: heightOf, areaClass: areaClass };
