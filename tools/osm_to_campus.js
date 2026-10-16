// Turns an OpenStreetMap export into the three files the campus map reads.
//
//   1. In Overpass Turbo (see campus/README.md) run the query and choose Export > GeoJSON > download.
//   2. Save that file as campus/osm_export.geojson
//   3. node tools/osm_to_campus.js campus/osm_export.geojson
//
// It writes campus/data.js (window.CAMPUS_DATA with buildings, paths and entrances) and prints a short
// report of what it found (and what is missing, like buildings with no name).
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
      // Houses around campus are left out; named buildings are always kept.
      if (!p.name && !onCampus(g)) { outside++; return; }
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

function main(file) {
  if (!file) { console.error('Usage: node tools/osm_to_campus.js campus/osm_export.geojson'); process.exit(1); }
  var input;
  try { input = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(1); }
  if (!input.features) { console.error(file + ' is not GeoJSON. In Overpass Turbo use Export > GeoJSON, not the raw data.'); process.exit(1); }
  var out = convert(input), dir = path.join(__dirname, '..', 'campus');
  fs.writeFileSync(path.join(dir, 'data.js'), toDataJs(out));
  var r = out.report;
  console.log('Buildings: ' + r.buildings + ' (' + r.namedBuildings + ' with a name, ' + (r.buildings - r.namedBuildings) + ' without)');
  console.log('Walking paths: ' + r.paths);
  console.log('Entrances: ' + r.entrances + (r.entrances < r.buildings ? '  (fewer than buildings: most doors still need adding)' : ''));
  if (r.campusAreas) { console.log('Campus boundary: ' + r.campusAreas + ' area(s). Left out ' + r.outsideCampus + ' unnamed buildings outside it (houses nearby).'); }
  console.log('Left out: ' + r.skipped + ' other items (roads, trees, and so on)');
  var unnamed = out.buildings.features.filter(function (b) { return !b.properties.name; }).length;
  if (unnamed) { console.log('\nBuildings with no name will not show a label or turn up in search. Name them in OpenStreetMap or in campus/data.js.'); }
}

if (require.main === module) { main(process.argv[2]); }
module.exports = { convert: convert, toDataJs: toDataJs };
