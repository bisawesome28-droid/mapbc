// Gets a school's data ready to use: the school file, its campus files and one file per building (all JSON, see
// docs/DATA_FORMAT.md). It does not load files itself (the web page uses fetch, a native app its own file reading, the
// tests read from disk): you give it the parsed JSON and it gives back the same data with what every screen needs worked
// out once: where each building sits on the map, its path network, and a list of data mistakes to fix.
(function (root, factory) {
  var api = factory(root.MapLogic || (typeof require === 'function' ? require('./logic.js') : null));
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MapSchool = api; }
})(this, function (ML) {

  function lv(o) { return String(o.level == null ? '1' : o.level); }
  function hidden(o, k, v) { Object.defineProperty(o, k, { value: v, enumerable: false, writable: true, configurable: true }); }

  // The files to load for a school, relative to its folder (schools/<id>/).
  function files(school) {
    var c = school.campus || {};
    return {
      campus: { data: c.data || null, base: c.base || null, extras: c.extras || null },
      buildings: (school.buildings || []).map(function (id) { return 'buildings/' + id + '.json'; })
    };
  }

  // Readies one building. center: [lng, lat] to park a building that has no GPS points yet (it is drawn there, to scale).
  function prepareBuilding(b, center) {
    var problems = [];
    if (!b.id) { problems.push('A building has no "id"'); }
    b.levels = b.levels && b.levels.length ? b.levels : [{ id: '1', name: 'Level 1' }];
    var levelIds = {};
    b.levels.forEach(function (L) { L.id = String(L.id); levelIds[L.id] = true; });
    hidden(b, 'levelNames', {});
    b.levels.forEach(function (L) { b.levelNames[L.id] = L.name || 'Level ' + L.id; });
    ['rooms', 'spots', 'entrances', 'outlines', 'fixtures', 'labels', 'pillars'].forEach(function (k) { b[k] = b[k] || []; });
    b.paths = b.paths || { nodes: [], edges: [] };
    var all = [].concat(b.rooms, b.spots, b.entrances, b.outlines, b.fixtures, b.labels, b.pillars, b.paths.nodes);
    all.forEach(function (o) { if (!levelIds[lv(o)]) { problems.push(b.id + ': ' + (o.id || o.label || o.text || 'an item') + ' is on level ' + lv(o) + ', which is not in "levels"'); } });

    var seen = {};
    b.rooms.forEach(function (r) {
      if (!r.shape) { r.shape = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]]; }
      if (seen[r.id]) { problems.push(b.id + ': room id ' + r.id + ' is used twice'); }
      seen[r.id] = true;
      hidden(r, 'building', b);
    });
    b.spots.forEach(function (s) { hidden(s, 'building', b); });
    b.entrances.forEach(function (e) { hidden(e, 'building', b); });

    // Where the plan sits on the ground.
    var fit = ML.fitGeo((b.geo || {}).points), parked = false;
    if (!fit) {
      var fpu = (b.scale && b.scale.feetPerUnit) || 0.7, m0 = fpu * 0.3048, c = center || [0, 0];
      var f0 = ML.localFrame(c[1], c[0]), a0 = f0.toLatLng(0, 0), b0 = f0.toLatLng(1000 * m0, 0);
      fit = ML.fitGeo([{ x: 0, y: 0, lat: a0.lat, lng: a0.lng }, { x: 1000, y: 0, lat: b0.lat, lng: b0.lng }]);
      parked = true;
      problems.push(b.id + ': no GPS points ("geo"), so the building is parked at the campus centre and the blue dot is off');
    }
    hidden(b, 'fit', fit);
    hidden(b, 'parked', parked);
    hidden(b, 'unitsPerMeter', fit.unitsPerMeter);
    hidden(b, 'feetPerUnit', (b.scale && b.scale.feetPerUnit) || 3.28084 / fit.unitsPerMeter);
    hidden(b, 'toLngLat', function (x, y) { var g = fit.toGeo(x, y); return [Math.round(g.lng * 1e7) / 1e7, Math.round(g.lat * 1e7) / 1e7]; });
    hidden(b, 'toPlan', function (lng, lat) { return fit.toMap(lat, lng); });

    // Box around the building on the plan, from the lowest floor's outside walls (or all of them).
    var pts = [];
    b.outlines.forEach(function (o) { if (lv(o) === b.levels[0].id && o.wing !== 'Bridge') { pts = pts.concat(o.points); } });
    if (!pts.length) { b.outlines.forEach(function (o) { pts = pts.concat(o.points); }); }
    if (!pts.length) { b.rooms.forEach(function (r) { pts = pts.concat(r.shape); }); }
    var box = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach(function (p) { box[0] = Math.min(box[0], p[0]); box[1] = Math.min(box[1], p[1]); box[2] = Math.max(box[2], p[0]); box[3] = Math.max(box[3], p[1]); });
    hidden(b, 'planBox', box);
    hidden(b, 'footPoints', pts.map(function (p) { return b.toLngLat(p[0], p[1]); }));
    var cx = (box[0] + box[2]) / 2, cy = (box[1] + box[3]) / 2;
    hidden(b, 'center', b.toLngLat(cx, cy));

    var graph = ML.buildGraph(b.paths, b.rooms, b.entrances, b.spots, { maxSnap: ML.MAX_SNAP * fit.unitsPerMeter / 20.58 });
    hidden(b, 'graph', graph);
    graph.problems.forEach(function (p) { problems.push(b.id + ': ' + p); });
    hidden(b, 'problems', problems);
    return b;
  }

  // school: school.json. campus: { data, base, extras } (parsed, any can be null). buildings: the building files, in order.
  // Returns { school, campus, buildings, byId, problems }.
  function prepare(school, campus, buildings) {
    campus = campus || {};
    var data = campus.data || { buildings: { type: 'FeatureCollection', features: [] }, paths: { type: 'FeatureCollection', features: [] }, entrances: { type: 'FeatureCollection', features: [] } };
    var extras = campus.extras || {};
    // Hand-added entrances join OpenStreetMap's, so directions to those buildings end at a real door.
    if (extras.entrances && data.entrances) { data.entrances = { type: 'FeatureCollection', features: data.entrances.features.concat(extras.entrances.features) }; }
    var byId = {}, problems = [];
    var list = (buildings || []).map(function (b) { return prepareBuilding(b, school.center); });
    list.forEach(function (b) {
      if (byId[b.id]) { problems.push('Two buildings have the id ' + b.id); }
      byId[b.id] = b;
      problems = problems.concat(b.problems);
    });
    // Campus footprints that have an indoor map: marked so the map colours them and opens their plan.
    var osmToBuilding = {};
    list.forEach(function (b) { (b.osm || []).forEach(function (id) { osmToBuilding[id] = b; }); });
    var found = {};
    ((data.buildings || {}).features || []).forEach(function (f) {
      var b = osmToBuilding[f.properties.osm];
      if (b) { f.properties.indoor = b.id; f.properties.indoorName = b.name; found[f.properties.osm] = true; }
    });
    Object.keys(osmToBuilding).forEach(function (id) { if (!found[id]) { problems.push(osmToBuilding[id].id + ': OpenStreetMap footprint ' + id + ' is not in the campus data'); } });
    return { school: school, campus: { data: data, base: campus.base || null, extras: extras }, buildings: list, byId: byId, problems: problems };
  }

  return { files: files, prepare: prepare, prepareBuilding: prepareBuilding, lv: lv };
});
