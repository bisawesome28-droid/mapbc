// Turns an OpenStreetMap export into the three files the campus map reads.
//
//   1. In Overpass Turbo (see campus/README.md) run the query and choose Export > GeoJSON > download.
//   2. Save that file as campus/osm_export.geojson
//   3. node tools/osm_to_campus.js campus/osm_export.geojson
//
// It writes campus/buildings.geojson, campus/paths.geojson and campus/entrances.geojson,
// and prints a short report of what it found (and what is missing, like buildings with no name).
// Running it again overwrites those three files, so make hand edits to them only after you are happy with the import.
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

function convert(fc) {
  var buildings = [], paths = [], entrances = [], skipped = 0;
  ((fc && fc.features) || []).forEach(function (f) {
    var g = f.geometry, p = f.properties || {};
    if (!g) { skipped++; return; }
    if ((g.type === 'Polygon' || g.type === 'MultiPolygon') && p.building) {
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
    paths: { type: 'FeatureCollection', features: paths },
    entrances: { type: 'FeatureCollection', features: entrances },
    report: { buildings: buildings.length, namedBuildings: named, paths: paths.length, entrances: entrances.length, skipped: skipped }
  };
}

function main(file) {
  if (!file) { console.error('Usage: node tools/osm_to_campus.js campus/osm_export.geojson'); process.exit(1); }
  var input;
  try { input = JSON.parse(fs.readFileSync(file, 'utf8')); }
  catch (e) { console.error('Could not read ' + file + ': ' + e.message); process.exit(1); }
  if (!input.features) { console.error(file + ' is not GeoJSON. In Overpass Turbo use Export > GeoJSON, not the raw data.'); process.exit(1); }
  var out = convert(input), dir = path.join(__dirname, '..', 'campus');
  fs.writeFileSync(path.join(dir, 'buildings.geojson'), JSON.stringify(out.buildings) + '\n');
  fs.writeFileSync(path.join(dir, 'paths.geojson'), JSON.stringify(out.paths) + '\n');
  fs.writeFileSync(path.join(dir, 'entrances.geojson'), JSON.stringify(out.entrances) + '\n');
  var r = out.report;
  console.log('Buildings: ' + r.buildings + ' (' + r.namedBuildings + ' with a name, ' + (r.buildings - r.namedBuildings) + ' without)');
  console.log('Walking paths: ' + r.paths);
  console.log('Entrances: ' + r.entrances + (r.entrances < r.buildings ? '  (fewer than buildings: most doors still need adding)' : ''));
  console.log('Left out: ' + r.skipped + ' other items (roads, trees, and so on)');
  var unnamed = out.buildings.features.filter(function (b) { return !b.properties.name; }).length;
  if (unnamed) { console.log('\nBuildings with no name will not show a label or turn up in search. Name them in OpenStreetMap or in campus/buildings.geojson.'); }
}

if (require.main === module) { main(process.argv[2]); }
module.exports = { convert: convert };
