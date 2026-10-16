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
    var wing = D.OUTLINES.filter(function (o) { return o.wing === r.wing; })[0];
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

console.log('\n' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
