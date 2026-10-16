// Simple tests for search and routing. Run them with:  node tests.js
// Each test prints PASS or FAIL. The last line says how many passed.
var assert = require('assert');
var ML = require('./logic.js');

// data.js writes to window.*, so give it a pretend window.
global.window = {};
require('./data.js');
var D = global.window;

var passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log('PASS  ' + name); }
  catch (e) { failed++; console.log('FAIL  ' + name + '\n      ' + e.message); }
}

function room(id, rooms) {
  var list = rooms || D.ROOMS;
  for (var i = 0; i < list.length; i++) { if (list[i].id === id) { return list[i]; } }
  throw new Error('No room ' + id);
}
function ids(results) { return results.map(function (m) { return m.o.id; }); }
function copyRooms() { return JSON.parse(JSON.stringify(D.ROOMS)); }

var graph = ML.buildGraph(D.PATHS, D.ROOMS, D.ENTRANCES, D.SPOTS);
function go(entrance, roomId, opts) { return ML.routeTo(graph, entrance, { kind: 'room', o: room(roomId) }, opts); }
function passesNode(r, nodeId) { return r.ids.indexOf(nodeId) > -1; }

// ---------- Search ----------

test('search by placeholder id finds that room first', function () {
  assert.strictEqual(ids(ML.search('S03', D.ROOMS, D.SPOTS))[0], 'S03');
  assert.strictEqual(ids(ML.search('n06', D.ROOMS, D.SPOTS))[0], 'N06');
});

test('search for "restrooms" finds both restrooms', function () {
  var r = ids(ML.search('restrooms', D.ROOMS, D.SPOTS));
  assert.ok(r.indexOf('S-REST') > -1 && r.indexOf('N-REST') > -1, 'got ' + r);
});

test('search by keyword: "lecture hall" finds S11', function () {
  assert.deepStrictEqual(ids(ML.search('lecture hall', D.ROOMS, D.SPOTS)), ['S11']);
});

test('search with several words needs all of them ("north classroom")', function () {
  var r = ML.search('north classroom', D.ROOMS, D.SPOTS);
  assert.ok(r.length >= 8, 'expected all north wing classrooms, got ' + r.length);
  r.forEach(function (m) { assert.strictEqual(m.o.wing, 'North'); });
});

test('empty search and nonsense search return nothing', function () {
  assert.deepStrictEqual(ML.search('   ', D.ROOMS, D.SPOTS), []);
  assert.deepStrictEqual(ML.search('xyzzy', D.ROOMS, D.SPOTS), []);
});

test('adding a real room number (door) makes it searchable, data change only', function () {
  var rooms = copyRooms();
  room('S01', rooms).door = '195';
  assert.strictEqual(ids(ML.search('195', rooms, []))[0], 'S01');
});

test('exact room number is listed before a longer one ("S19" before "S195")', function () {
  var rooms = copyRooms();
  room('S01', rooms).door = 'S195';
  room('S02', rooms).door = 'S19';
  assert.deepStrictEqual(ids(ML.search('S19', rooms, [])).slice(0, 2), ['S02', 'S01']);
});

// ---------- Path network data ----------

test('path network has no data mistakes (missing nodes, far-away doors)', function () {
  assert.deepStrictEqual(graph.problems, []);
});

test('every room has at least one door', function () {
  D.ROOMS.forEach(function (r) { assert.ok(r.doors && r.doors.length, r.id + ' has no doors'); });
});

test('every entrance can reach every room and photo point', function () {
  D.ENTRANCES.forEach(function (en) {
    D.ROOMS.forEach(function (r) {
      assert.ok(ML.routeTo(graph, en.id, { kind: 'room', o: r }), en.id + ' cannot reach ' + r.id);
    });
    D.SPOTS.forEach(function (s) {
      assert.ok(ML.routeTo(graph, en.id, { kind: 'spot', o: s }), en.id + ' cannot reach ' + s.id);
    });
  });
});

// ---------- Routing ----------

test('route starts at the entrance and ends at the room door', function () {
  var r = go('E-S-WEST', 'S04');
  var west = D.ENTRANCES.filter(function (e) { return e.id === 'E-S-WEST'; })[0];
  assert.deepStrictEqual(r.points[0], [west.x, west.y]);
  assert.deepStrictEqual(r.points[r.points.length - 1], room('S04').doors[0]);
});

test('west door to S04 stays in the south wing (no bridge)', function () {
  var r = go('E-S-WEST', 'S04');
  assert.ok(!passesNode(r, 'walk_s'), 'route went to the walkway');
  assert.ok(r.names.indexOf('Main hallway (south wing)') > -1, 'route should use the main hallway');
  assert.ok(r.names.join(' ').indexOf('north wing') === -1, 'route went into the north wing');
});

test('north wing south entry to S11 uses the outdoor walkway', function () {
  var r = go('E-N-SOUTH', 'S11');
  assert.ok(passesNode(r, 'walk_n') && passesNode(r, 'walk_s'));
});

test('a room with two doors uses the closer one (S11 from the north entry)', function () {
  var r = go('E-S-NORTH', 'S11');
  assert.deepStrictEqual(r.points[r.points.length - 1], room('S11').doors[1]);
});

test('routes never cut through another room', function () {
  // Only the start (entrance) and the end (door) may be door/entrance points.
  D.ENTRANCES.forEach(function (en) {
    D.ROOMS.forEach(function (rm) {
      var r = ML.routeTo(graph, en.id, { kind: 'room', o: rm });
      r.ids.slice(1, -1).forEach(function (id) {
        assert.ok(graph.nodes[id].kind !== 'point', en.id + ' to ' + rm.id + ' passes through ' + id);
      });
    });
  });
});

test('a nearby entrance gives a shorter route than a far one', function () {
  var direct = go('E-S-WEST', 'S03').length;
  var far = go('E-N-SOUTH', 'S03').length;
  assert.ok(direct < far, 'west door should be closer to S03 than the north wing');
});

test('renaming a room (door number) does not break its route', function () {
  var rooms = copyRooms();
  room('N03', rooms).door = '130';
  var g = ML.buildGraph(D.PATHS, rooms, D.ENTRANCES, D.SPOTS);
  assert.ok(ML.routeTo(g, 'E-S-LOBBY', { kind: 'room', o: room('N03', rooms) }));
});

// ---------- Accessible routes (uses a small made-up map) ----------
//
//   start --steps-- B --hall-- door        (short way, has steps)
//   start --hall--  C --hall-- B           (long way round, step-free)
var mini = {
  nodes: [
    { id: 'A', x: 0, y: 0 }, { id: 'B', x: 100, y: 0 }, { id: 'C', x: 0, y: 200 }, { id: 'D', x: 200, y: 0 }
  ],
  edges: [
    { from: 'A', to: 'B', kind: 'steps' },
    { from: 'A', to: 'C' }, { from: 'C', to: 'B' },
    { from: 'B', to: 'D' }
  ]
};
var miniRoom = { id: 'R1', name: 'Test room', doors: [[200, 10]] };
var miniEntr = { id: 'IN', name: 'Test entrance', x: -10, y: -10 };

test('normal route takes the short way with steps', function () {
  var g = ML.buildGraph(mini, [miniRoom], [miniEntr], []);
  var r = ML.routeTo(g, 'IN', { kind: 'room', o: miniRoom }, { accessible: false });
  assert.ok(!passesNode(r, 'C'));
});

test('accessible route avoids steps and takes the long way', function () {
  var g = ML.buildGraph(mini, [miniRoom], [miniEntr], []);
  var r = ML.routeTo(g, 'IN', { kind: 'room', o: miniRoom }, { accessible: true });
  assert.ok(passesNode(r, 'C'), 'should go round via C');
});

test('accessible route avoids stairs too, and says "no route" if steps are the only way', function () {
  // E --hall-- A --stair-- B --hall-- D(room)
  var only = {
    nodes: mini.nodes.concat([{ id: 'E', x: -100, y: 0 }]),
    edges: [{ from: 'E', to: 'A' }, { from: 'A', to: 'B', kind: 'stair' }, { from: 'B', to: 'D' }]
  };
  var g = ML.buildGraph(only, [miniRoom], [miniEntr], []);
  assert.ok(ML.routeTo(g, 'IN', { kind: 'room', o: miniRoom }, { accessible: false }));
  assert.strictEqual(ML.routeTo(g, 'IN', { kind: 'room', o: miniRoom }, { accessible: true }), null);
});

test('a broken edge (typo in a node id) is reported, not silently ignored', function () {
  var bad = { nodes: mini.nodes, edges: [{ from: 'A', to: 'ZZ' }] };
  var g = ML.buildGraph(bad, [], [], []);
  assert.ok(g.problems.some(function (p) { return p.indexOf('ZZ') > -1; }));
});

// ---------- Directions (turn-by-turn) ----------
//
//   IN ---- A (corner) ----- B          Walk east from the entrance, turn south at the corner.
//                 |
//                 C (door on the east side of the hall)
var L = {
  nodes: [
    { id: 'A', x: 100, y: 0, name: 'The corner' },
    { id: 'B', x: 200, y: 0, name: 'East end' },
    { id: 'C', x: 100, y: 200, name: 'South end' }
  ],
  edges: [{ from: 'A', to: 'B' }, { from: 'A', to: 'C' }]
};
var lEntr = { id: 'IN', name: 'Front door', x: 0, y: 0 };
function lRoute(doorXY) {
  var rm = { id: 'R', name: 'Room R', doors: [doorXY] };
  var g = ML.buildGraph(L, [rm], [lEntr], []);
  var r = ML.routeTo(g, 'IN', { kind: 'room', o: rm });
  return ML.describe(g, r, 'Room R', { feetPerUnit: 1 });
}

test('directions start with the entrance and end with the room', function () {
  var d = lRoute([130, 150]);
  assert.strictEqual(d.steps[0].text, 'Start at Front door');
  assert.strictEqual(d.steps[d.steps.length - 1].kind, 'arrive');
  assert.ok(/Room R$/.test(d.steps[d.steps.length - 1].text));
});

test('walking south, a door on the east side is on your left', function () {
  // Walking south down the hall, a door on the east side (x bigger) is on your LEFT.
  var d = lRoute([130, 150]);
  var last = d.steps[d.steps.length - 1];
  assert.ok(/^Turn left/.test(last.text), last.text);
  assert.strictEqual(last.turn, 'left');
});

test('a door on the west side, walking south, is a right turn', function () {
  var d = lRoute([70, 150]);
  assert.ok(/^Turn right/.test(d.steps[d.steps.length - 1].text));
});

test('the corner gives a right turn (east then south)', function () {
  var d = lRoute([100, 190]);
  var texts = d.steps.map(function (s) { return s.text; }).join(' | ');
  assert.ok(/Turn right toward South end/.test(texts) || /Turn right to Room R/.test(texts), texts);
});

test('distance and time are worked out from the scale', function () {
  var rm = { id: 'R', name: 'Room R', doors: [[100, 190]] };
  var g = ML.buildGraph(L, [rm], [lEntr], []);
  var r = ML.routeTo(g, 'IN', { kind: 'room', o: rm });
  var d1 = ML.describe(g, r, 'Room R', { feetPerUnit: 1 });
  var d2 = ML.describe(g, r, 'Room R', { feetPerUnit: 2 });
  assert.ok(Math.abs(d1.feet - 290) <= 10, 'about 100 + 190 feet, got ' + d1.feet);
  assert.ok(Math.abs(d2.feet - 2 * d1.feet) <= 10);
  assert.ok(d2.minutes >= d1.minutes && d1.minutes >= 1);
});

test('every real route can be turned into directions', function () {
  var fpu = D.SCALE.feetPerUnit;
  D.ENTRANCES.forEach(function (en) {
    D.ROOMS.forEach(function (rm) {
      var r = ML.routeTo(graph, en.id, { kind: 'room', o: rm });
      var d = ML.describe(graph, r, rm.name, { feetPerUnit: fpu });
      assert.ok(d.steps.length >= 2, en.id + ' to ' + rm.id);
      d.steps.forEach(function (s) { assert.ok(s.text.indexOf('undefined') === -1, s.text); });
    });
  });
});

test('nearest picks the closest restroom for each wing', function () {
  var rests = D.ROOMS.filter(function (r) { return /restroom/i.test(r.name); });
  var fromSouth = ML.nearest(graph, 'E-S-WEST', rests.map(function (o) { return { kind: 'room', o: o }; }));
  var fromNorth = ML.nearest(graph, 'E-N-SOUTH', rests.map(function (o) { return { kind: 'room', o: o }; }));
  assert.strictEqual(fromSouth.target.o.id, 'S-REST');
  assert.strictEqual(fromNorth.target.o.id, 'N-REST');
});

// ---------- Drawing data and the outdoor walkway ----------

function inside(pt, poly) {
  var c = false;
  for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    var a = poly[i], b = poly[j];
    if ((a[1] > pt[1]) !== (b[1] > pt[1]) && pt[0] < (b[0] - a[0]) * (pt[1] - a[1]) / (b[1] - a[1]) + a[0]) { c = !c; }
  }
  return c;
}
function distToOutline(pt, poly) {
  var best = Infinity;
  for (var i = 0; i < poly.length; i++) {
    var a = poly[i], b = poly[(i + 1) % poly.length];
    var dx = b[0] - a[0], dy = b[1] - a[1], len2 = dx * dx + dy * dy;
    var t = Math.max(0, Math.min(1, ((pt[0] - a[0]) * dx + (pt[1] - a[1]) * dy) / len2));
    best = Math.min(best, Math.hypot(pt[0] - a[0] - t * dx, pt[1] - a[1] - t * dy));
  }
  return best;
}

test('every room has an outline and each door sits on (or next to) its own wall', function () {
  D.ROOMS.forEach(function (r) {
    assert.ok(r.shape && r.shape.length >= 3, r.id + ' has no shape');
    r.doors.forEach(function (d) {
      var gap = distToOutline(d, r.shape);
      // Open areas (lobby, cafe, walkway, service corridor) use a point inside instead of a wall door.
      var openArea = r.type === 'common' || r.type === 'connector' || r.id === 'N-SVC-ENT';
      assert.ok(gap <= 2 || (openArea && inside(d, r.shape)), r.id + ' door ' + d + ' is ' + Math.round(gap) + ' units from its wall');
    });
  });
});

test('every room sits inside its wing outline (except the outdoor walkway)', function () {
  D.ROOMS.forEach(function (r) {
    if (r.type === 'connector') { return; }
    var level = r.level || '1';
    var wing = D.OUTLINES.filter(function (o) { return o.wing === r.wing && (o.level || '1') === level; })[0];
    r.shape.forEach(function (p) {
      assert.ok(inside(p, wing.points) || distToOutline(p, wing.points) < 25, r.id + ' corner ' + p + ' is outside the ' + r.wing + ' wing');
    });
  });
});

test('crossing between wings is flagged as outdoors on Level 1', function () {
  var r = go('E-S-WEST', 'N03');
  assert.ok(r.outdoor, 'south to north wing should go outside');
  var d = ML.describe(graph, r, 'N03', { feetPerUnit: D.SCALE.feetPerUnit });
  assert.ok(d.steps.some(function (s) { return s.outdoor && /outside/.test(s.text); }), 'a step should say outside');
  assert.ok(!go('E-S-WEST', 'S03').outdoor, 'staying in one wing is indoors');
});

// ---------- Levels: stairs and elevators ----------
//
//   Level 1:  IN - A ---- B ------------- E          stairs at B, elevator at E
//   Level 2:            B2 ---- D ------- E2         the room's door is near D
var two = {
  nodes: [
    { id: 'A', x: 0, y: 0 }, { id: 'B', x: 100, y: 0 }, { id: 'E', x: 300, y: 0 },
    { id: 'B2', x: 100, y: 0, level: '2' }, { id: 'D', x: 200, y: 0, level: '2' }, { id: 'E2', x: 300, y: 0, level: '2' }
  ],
  edges: [
    { from: 'A', to: 'B' }, { from: 'B', to: 'E' },
    { from: 'B2', to: 'D' }, { from: 'D', to: 'E2' },
    { from: 'B', to: 'B2', kind: 'stair', length: 50 },
    { from: 'E', to: 'E2', kind: 'elevator', length: 200 }
  ]
};
var upRoom = { id: 'UP', name: 'Room upstairs', level: '2', doors: [[200, 10]] };
var twoEntr = { id: 'IN', name: 'Front door', x: -10, y: 0 };
function twoRoute(acc) {
  var g = ML.buildGraph(two, [upRoom], [twoEntr], []);
  return { g: g, r: ML.routeTo(g, 'IN', { kind: 'room', o: upRoom }, { accessible: acc }) };
}

test('a route to another floor takes the stairs when that is quicker', function () {
  var t = twoRoute(false);
  assert.ok(t.r.kinds.indexOf('stair') > -1, 'kinds: ' + t.r.kinds);
  assert.deepStrictEqual([t.r.levels[0], t.r.levels[t.r.levels.length - 1]], ['1', '2']);
});

test('the step-free route takes the elevator instead of the stairs', function () {
  var t = twoRoute(true);
  assert.ok(t.r.kinds.indexOf('elevator') > -1 && t.r.kinds.indexOf('stair') === -1, 'kinds: ' + t.r.kinds);
});

test('directions say "Take the elevator up to Level 2"', function () {
  var t = twoRoute(true);
  var d = ML.describe(t.g, t.r, 'Room upstairs', { feetPerUnit: 1, levelNames: { '2': 'Level 2' } });
  var lvl = d.steps.filter(function (s) { return s.kind === 'level'; });
  assert.strictEqual(lvl.length, 1);
  assert.strictEqual(lvl[0].text, 'Take the elevator up to Level 2');
  assert.strictEqual(lvl[0].turn, 'up');
  assert.strictEqual(d.steps[d.steps.length - 1].level, '2');
});

test('a door only joins hallways on its own level', function () {
  // The upstairs door sits right above the Level 1 hallway, but must join the Level 2 one.
  var g = ML.buildGraph(two, [{ id: 'X', name: 'X', level: '2', doors: [[50, 5]] }], [], []);
  var a = g.attach[0];
  assert.strictEqual(a.level, '2');
  assert.ok(a.to.x >= 100, 'joined at x=' + a.to.x + ', which is on Level 1');
});

test('a plain hallway joining two levels is reported as a mistake', function () {
  var bad = { nodes: two.nodes, edges: [{ from: 'A', to: 'D' }] };
  assert.ok(ML.buildGraph(bad, [], [], []).problems.some(function (p) { return /joins level 1 and level 2/.test(p); }));
});

test('real data: every Level 2 room can be reached step-free, by elevator only', function () {
  D.ROOMS.filter(function (r) { return r.level === '2'; }).forEach(function (rm) {
    D.ENTRANCES.forEach(function (en) {
      var r = ML.routeTo(graph, en.id, { kind: 'room', o: rm }, { accessible: true });
      assert.ok(r, en.id + ' cannot reach ' + rm.id + ' step-free');
      assert.ok(r.kinds.indexOf('stair') === -1 && r.kinds.indexOf('elevator') > -1, en.id + ' to ' + rm.id + ': ' + r.kinds.join(','));
    });
  });
});

test('real data: Level 1 routes never wander upstairs', function () {
  D.ROOMS.filter(function (r) { return !r.level || r.level === '1'; }).forEach(function (rm) {
    var r = go('E-S-WEST', rm.id);
    assert.ok(r.levels.every(function (l) { return l === '1'; }), 'route to ' + rm.id + ' leaves Level 1');
  });
});

// ---------- Outdoor campus map ----------

var OSM = require('./tools/osm_to_campus.js');
var sampleExport = { type: 'FeatureCollection', features: [
  { id: 'way/1', properties: { building: 'university', name: 'Test Hall', 'building:levels': '4' }, geometry: { type: 'Polygon', coordinates: [[[-71.1700, 42.3350], [-71.1698, 42.3350], [-71.1698, 42.3352], [-71.1700, 42.3350]]] } },
  { id: 'way/2', properties: { building: 'yes' }, geometry: { type: 'Polygon', coordinates: [[[-71.1690, 42.3350], [-71.1688, 42.3350], [-71.1688, 42.3352], [-71.1690, 42.3350]]] } },
  { id: 'way/3', properties: { highway: 'footway', surface: 'paved' }, geometry: { type: 'LineString', coordinates: [[-71.1699, 42.3349], [-71.1695, 42.3349]] } },
  { id: 'way/4', properties: { highway: 'steps', step_count: '12' }, geometry: { type: 'LineString', coordinates: [[-71.1695, 42.3349], [-71.1694, 42.3351]] } },
  { id: 'way/5', properties: { highway: 'motorway' }, geometry: { type: 'LineString', coordinates: [[-71.18, 42.33], [-71.17, 42.34]] } },
  { id: 'node/6', properties: { entrance: 'main', name: 'Front door' }, geometry: { type: 'Point', coordinates: [-71.16991234567, 42.3349] } },
  { id: 'node/7', properties: { natural: 'tree' }, geometry: { type: 'Point', coordinates: [-71.169, 42.335] } }
] };

test('campus import: sorts a mixed OpenStreetMap export into buildings, paths and entrances', function () {
  var out = OSM.convert(sampleExport);
  assert.deepStrictEqual(out.report, { buildings: 2, namedBuildings: 1, paths: 2, entrances: 1, skipped: 2 });
  assert.strictEqual(out.buildings.features[0].properties.name, 'Test Hall', 'named buildings come first');
  assert.strictEqual(out.buildings.features[0].properties.kind, 'university');
  assert.strictEqual(out.paths.features[1].properties.step_count, '12');
});

test('campus import: rounds coordinates and keeps longitude first', function () {
  var c = OSM.convert(sampleExport).entrances.features[0].geometry.coordinates;
  assert.deepStrictEqual(c, [-71.1699123, 42.3349]);
});

test('campus import: empty or odd input does not crash', function () {
  assert.strictEqual(OSM.convert({}).report.buildings, 0);
  assert.strictEqual(OSM.convert({ features: [{ properties: {}, geometry: null }] }).report.skipped, 1);
});

test('campus config: centre is [longitude, latitude] and inside Massachusetts', function () {
  require('./campus/config.js');
  var C = global.window.CAMPUS;
  assert.ok(C && C.center && C.center.length === 2, 'CAMPUS.center needs [lng, lat]');
  assert.ok(C.center[0] < -69 && C.center[0] > -74, 'first number should be the longitude (about -71), got ' + C.center[0]);
  assert.ok(C.center[1] > 41 && C.center[1] < 43, 'second number should be the latitude (about 42), got ' + C.center[1]);
});

test('campus data: campus/data.js loads and holds valid GeoJSON', function () {
  require('./campus/data.js');
  var C = global.window.CAMPUS_DATA;
  ['buildings', 'paths', 'entrances'].forEach(function (n) {
    assert.strictEqual(C[n].type, 'FeatureCollection', n);
    C[n].features.forEach(function (f) { assert.ok(f.geometry && f.geometry.coordinates, n + ' has a feature with no shape'); });
  });
});

test('campus import: writes a data.js that loads back to the same data', function () {
  var out = OSM.convert(sampleExport), w = {};
  new Function('window', OSM.toDataJs(out))(w);
  assert.deepStrictEqual(w.CAMPUS_DATA.buildings, out.buildings);
  assert.deepStrictEqual(w.CAMPUS_DATA.paths, out.paths);
});

// ---------- GPS blue dot ----------

// Builds control points from a plan placed at a made-up spot on the ground: rotation in degrees,
// units per metre, and the map position of the centre. Lets the tests know the right answer.
function fakeWorld(rotDeg, unitsPerMeter, noiseMeters) {
  var lat0 = 42.335, lng0 = -71.168, mLat = 111000, mLng = 82000, a = rotDeg * Math.PI / 180;
  var seed = 7;
  function rnd() { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; }
  function toMap(lat, lng) {
    var e = (lng - lng0) * mLng, s = -(lat - lat0) * mLat;
    return { x: 1100 + unitsPerMeter * (Math.cos(a) * e - Math.sin(a) * s), y: 900 + unitsPerMeter * (Math.sin(a) * e + Math.cos(a) * s) };
  }
  var spots = [[0, 0], [150, 40], [-90, 120], [60, -110], [-30, -70]];
  var pts = spots.map(function (m) {
    var lat = lat0 - (m[1] + (noiseMeters ? rnd() * 2 * noiseMeters : 0)) / mLat, lng = lng0 + (m[0] + (noiseMeters ? rnd() * 2 * noiseMeters : 0)) / mLng;
    var p = toMap(lat0 - m[1] / mLat, lng0 + m[0] / mLng); // true map position of that real spot
    return { lat: lat, lng: lng, x: p.x, y: p.y };
  });
  return { pts: pts, toMap: toMap, lat0: lat0, lng0: lng0 };
}

test('GPS: a clean fit recovers scale, turn and positions exactly', function () {
  var w = fakeWorld(30, 10, 0);
  var g = ML.fitGeo(w.pts);
  assert.ok(Math.abs(g.unitsPerMeter - 10 * Math.sqrt(1)) < 0.2, 'scale ' + g.unitsPerMeter);
  assert.ok(g.rmsMeters < 0.5, 'rms ' + g.rmsMeters);
  // A spot we did not give it: 40 m east, 25 m north of the centre.
  var lat = w.lat0 + 25 / 111000, lng = w.lng0 + 40 / 82000;
  var want = w.toMap(lat, lng), got = g.toMap(lat, lng);
  assert.ok(Math.abs(want.x - got.x) < 4 && Math.abs(want.y - got.y) < 4, 'got ' + got.x + ',' + got.y + ' want ' + want.x + ',' + want.y);
});

test('GPS: toGeo undoes toMap', function () {
  var g = ML.fitGeo(fakeWorld(-75, 8, 0).pts);
  var m = g.toMap(42.3351, -71.1675), back = g.toGeo(m.x, m.y);
  assert.ok(Math.abs(back.lat - 42.3351) < 1e-9 && Math.abs(back.lng + 71.1675) < 1e-9);
});

test('GPS: two points work but cannot report a fit error; three or more can', function () {
  var w = fakeWorld(10, 12, 0);
  var two = ML.fitGeo(w.pts.slice(0, 2));
  assert.ok(two && two.rmsMeters === null);
  assert.ok(ML.fitGeo(w.pts).rmsMeters !== null);
});

test('GPS: a few metres of noise in the control points shows up as a few metres of error', function () {
  var g = ML.fitGeo(fakeWorld(20, 10, 3).pts);
  assert.ok(g.rmsMeters > 0.2 && g.rmsMeters < 6, 'rms ' + g.rmsMeters);
});

test('GPS: a typo in one control point is flagged as the worst one', function () {
  var pts = fakeWorld(20, 10, 0).pts;
  pts[3].lat += 0.0005; // about 55 m off
  var g = ML.fitGeo(pts);
  assert.strictEqual(g.worstIndex, 3);
  assert.ok(g.worstMeters > 15, 'worst ' + g.worstMeters);
});

test('GPS: too few or identical points give no fit', function () {
  assert.strictEqual(ML.fitGeo([]), null);
  assert.strictEqual(ML.fitGeo([{ lat: 42, lng: -71, x: 1, y: 1 }]), null);
  assert.strictEqual(ML.fitGeo([{ lat: 42, lng: -71, x: 1, y: 1 }, { lat: 42, lng: -71, x: 500, y: 500 }]), null);
  assert.strictEqual(ML.fitGeo([{ lat: 'x', lng: -71, x: 1, y: 1 }, { lat: 42, lng: -71, x: 1, y: 1 }]), null);
});

test('GPS: smoother trusts good readings more than bad ones', function () {
  var s = ML.createSmoother({ speed: 10 });
  s.update(100, 100, 5, 0);
  var bad = s.update(300, 100, 200, 1000);   // far-off reading with a huge error
  assert.ok(bad.x < 130, 'bad reading moved the dot to ' + bad.x);
  var s2 = ML.createSmoother({ speed: 10 });
  s2.update(100, 100, 5, 0);
  var good = s2.update(120, 100, 5, 1000);   // reading with the same small error
  assert.ok(good.x > 105 && good.x < 120, 'good reading put the dot at ' + good.x);
});

test('GPS: smoother lets the dot follow someone who keeps walking', function () {
  var s = ML.createSmoother({ speed: 15 }), out;
  for (var t = 0; t <= 20; t++) { out = s.update(100 + t * 14, 100, 10, t * 1000); }
  assert.ok(out.x > 330, 'dot lagged far behind: ' + out.x);
});

test('GPS: describeFix finds the nearest entrance and whether you are on the plan', function () {
  var ctx = { metersPerUnit: 0.1, bounds: { x: 0, y: 0, w: 1000, h: 800 }, entrances: D.ENTRANCES.map(function (e) { return { id: e.id, name: e.name, x: e.x, y: e.y }; }) };
  var near = ML.describeFix({ x: 110, y: 790, accuracy: 6 }, ctx);
  assert.strictEqual(near.nearest.id, 'E-S-WEST');
  assert.ok(near.inside && near.offMapMeters === 0 && Math.abs(near.radius - 60) < 1e-9);
  var far = ML.describeFix({ x: 3000, y: 400, accuracy: 6 }, ctx);
  assert.ok(!far.inside && Math.abs(far.offMapMeters - 200) < 1e-6, 'off ' + far.offMapMeters);
});

test('real data: GPS control points (if any) are usable and fit well', function () {
  var pts = (D.GEO && D.GEO.points) || [];
  if (!pts.length) { return; } // not calibrated yet: fine, the page says so
  var g = ML.fitGeo(pts);
  assert.ok(g, 'GEO.points need at least 2 different points with numeric lat, lng, x and y');
  if (g.rmsMeters !== null) {
    assert.ok(g.rmsMeters < 8, 'control points miss by ' + g.rmsMeters.toFixed(1) + ' m on average; check point ' + g.worstIndex + ' (' + (pts[g.worstIndex].label || '') + ') for a typo');
  }
  // The fitted scale should roughly agree with SCALE.feetPerUnit once that is measured.
  var feetPerUnit = 3.28084 / g.unitsPerMeter; // metres per unit, times feet per metre
  if (D.SCALE && !D.SCALE.guess) { assert.ok(Math.abs(feetPerUnit / D.SCALE.feetPerUnit - 1) < 0.15, 'GPS scale ' + feetPerUnit.toFixed(3) + ' ft/unit vs SCALE ' + D.SCALE.feetPerUnit); }
});

// ---------- Outdoors: walking paths and the way in ----------

var F = ML.localFrame(42.334, -71.171);
function ll(x, y) { var g = F.toLatLng(x, y); return [g.lng, g.lat]; } // metres -> GeoJSON [lng, lat]
function line(pts, props) { return { type: 'Feature', properties: props || { highway: 'footway' }, geometry: { type: 'LineString', coordinates: pts.map(function (p) { return ll(p[0], p[1]); }) } }; }

test('outdoors: lines that share a point are joined, steps are marked', function () {
  var net = ML.outdoorNetwork({ features: [
    line([[0, 0], [100, 0]]), line([[100, 0], [100, 80]], { highway: 'steps' }), line([[100, 0], [200, 0]], { highway: 'footway', wheelchair: 'no' })
  ] }, F);
  assert.strictEqual(net.nodes.length, 4, 'shared corner should be one point, got ' + net.nodes.length);
  assert.deepStrictEqual(net.edges.map(function (e) { return e.kind; }), ['path', 'steps', 'steps']);
  assert.ok(Math.abs(net.nodes[1].x - 100) < 0.01 && Math.abs(net.nodes[1].y) < 0.01, 'metres survive the round trip');
});

// A tiny campus: you start at the west end of a path. Door A is reached by steps, door B by a ramp-free
// longer path. Inside, both doors lead to the same room.
//   START (0,0) ---- (100,0) --steps-- (100,30) -- door A (100,45)
//                       \---- (180,0) ------------------ door B (180,45)
var tinyPaths = { features: [
  line([[0, 0], [100, 0], [180, 0]]), line([[100, 0], [100, 30]], { highway: 'steps' }), line([[100, 30], [100, 40]]), line([[180, 0], [180, 40]])
] };
var tinyIndoor = {
  nodes: [{ id: 'a', x: 0, y: 0 }, { id: 'b', x: 80, y: 0 }, { id: 'c', x: 40, y: 50 }],
  edges: [{ from: 'a', to: 'c' }, { from: 'b', to: 'c' }]
};
var tinyRoom = { id: 'R', name: 'Room', doors: [[40, 60]] };
var tinyDoors = [{ id: 'A', name: 'Door A', x: 0, y: -10 }, { id: 'B', name: 'Door B', x: 80, y: -10 }];
function tinyRoute(acc, paths) {
  var indoor = ML.buildGraph(tinyIndoor, [tinyRoom], tinyDoors, []);
  var places = { start: { x: 0, y: 0 }, entrances: { A: { x: 100, y: 45 }, B: { x: 180, y: 45 } } };
  var outEntr = [{ id: 'START', name: 'Your location', x: 0, y: 0 }, { id: 'A', name: 'Door A', x: 100, y: 45 }, { id: 'B', name: 'Door B', x: 180, y: 45 }];
  var out = ML.buildGraph(ML.outdoorNetwork(paths, F), [], outEntr, []);
  return ML.campusRoute(out, indoor, ['A', 'B'], { kind: 'room', o: tinyRoom }, places, 1, { accessible: acc });
}

test('outdoors to indoors: picks the door with the shortest total walk', function () {
  var r = tinyRoute(false, tinyPaths);
  assert.strictEqual(r.entrance, 'A');
  assert.ok(!r.straight && r.outdoor.kinds.indexOf('steps') > -1);
});

test('outdoors to indoors: step-free avoids outdoor steps and uses the other door', function () {
  var r = tinyRoute(true, tinyPaths);
  assert.strictEqual(r.entrance, 'B');
  assert.ok(r.outdoor.kinds.indexOf('steps') === -1);
});

test('outdoors to indoors: with no paths yet, falls back to a straight line and says so', function () {
  var r = tinyRoute(false, { features: [] });
  assert.ok(r.straight, 'should be marked straight');
  assert.strictEqual(r.entrance, 'A', 'nearest door in a straight line');
  assert.strictEqual(r.outdoor.points.length, 2);
});

test('outdoor directions name unnamed paths sensibly', function () {
  var out = ML.buildGraph(ML.outdoorNetwork(tinyPaths, F), [], [{ id: 'START', name: 'Your location', x: 0, y: 0 }, { id: 'B', name: 'Door B', x: 180, y: 45 }], []);
  var rr = ML.shortest(out, 'entrance:START', ['entrance:B'], { accessible: true });
  var d = ML.describe(out, rr, 'Door B', { feetPerUnit: 3.28084, fallbackName: 'the path' });
  var text = d.steps.map(function (s) { return s.text; }).join(' | ');
  assert.ok(text.indexOf('end of the hall') === -1, text);
  assert.ok(/Door B$/.test(text), text);
});

test('real data: from just west of Stokes, the straight-line fallback picks the west door for S03', function () {
  var geo = ML.fitGeo(D.GEO.points), mpu = 1 / geo.unitsPerMeter;
  var w = geo.toGeo(-300, 800);                         // a spot outside, west of the west door
  var frame = ML.localFrame(w.lat, w.lng), places = { start: { x: 0, y: 0 }, entrances: {} };
  D.ENTRANCES.forEach(function (en) { var g = geo.toGeo(en.x, en.y); places.entrances[en.id] = frame.toXY(g.lat, g.lng); });
  var r = ML.campusRoute(null, graph, D.ENTRANCES.map(function (e) { return e.id; }), { kind: 'room', o: room('S03') }, places, mpu, {});
  assert.strictEqual(r.entrance, 'E-S-WEST');
  assert.ok(r.straight);
  assert.ok(r.outdoor.length > 15 && r.outdoor.length < 40, 'about 300 units = ' + (300 * mpu).toFixed(0) + ' m, got ' + r.outdoor.length.toFixed(1));
});

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
