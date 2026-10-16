// Search and route-finding for the map.
// This file has no drawing code, so the page (index.html) and the tests (tests.js) share it.
// In the browser it becomes window.MapLogic. In Node it is loaded with require('./logic.js').
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MapLogic = api; }
})(this, function () {

  // Distances below are in map units. The map is about 2300 units wide (brochure pixels).
  // A door further than this from every hallway line is treated as a data mistake.
  var MAX_SNAP = 100;

  // Edge kinds that a wheelchair user cannot take.
  var NOT_ACCESSIBLE = { steps: true, stair: true };

  // Edge kinds that move between levels. They are the only edges allowed to join two levels.
  var VERTICAL = { stair: true, elevator: true };

  // Everything without a "level" is on level "1".
  function lv(o) { return String(o.level == null ? '1' : o.level); }

  var TYPE_WORDS = {
    classroom: 'Classroom', office: 'Offices', service: 'Service center', it: 'IT suite',
    common: 'Common area', conf: 'Conference room', core: '', connector: 'Connector'
  };

  // ---------- Search ----------

  function tokens(q) {
    return String(q || '').toLowerCase().split(/\s+/)
      .map(function (t) { return t.replace(/s$/, ''); })
      .filter(Boolean);
  }

  function hay(o, kind) {
    if (kind === 'room') {
      return [o.id, o.door, o.name, TYPE_WORDS[o.type] || '', o.wing, o.keywords, o.near]
        .join(' ').toLowerCase();
    }
    return [o.id, o.label, o.keywords].join(' ').toLowerCase();
  }

  // Lower score = better match. An exact room number beats a partial one,
  // so searching "S19" lists S19 before S195.
  function score(o, kind, q) {
    var qq = String(q).trim().toLowerCase();
    var codes = kind === 'room' ? [o.door, o.id] : [o.id];
    for (var i = 0; i < codes.length; i++) {
      var c = String(codes[i] || '').toLowerCase();
      if (c && c === qq) { return 0; }
    }
    for (var j = 0; j < codes.length; j++) {
      var c2 = String(codes[j] || '').toLowerCase();
      if (c2 && c2.indexOf(qq) === 0) { return 1; }
    }
    return 2;
  }

  // Returns a list of { kind: 'room' | 'spot', o: theObject }, best match first.
  function search(q, rooms, spots) {
    var toks = tokens(q);
    if (!toks.length) { return []; }
    var out = [];
    (rooms || []).forEach(function (r, i) {
      var h = hay(r, 'room');
      if (toks.every(function (t) { return h.indexOf(t) > -1; })) {
        out.push({ kind: 'room', o: r, s: score(r, 'room', q), i: i });
      }
    });
    (spots || []).forEach(function (s, i) {
      var h = hay(s, 'spot');
      if (toks.every(function (t) { return h.indexOf(t) > -1; })) {
        out.push({ kind: 'spot', o: s, s: score(s, 'spot', q), i: 1000 + i });
      }
    });
    out.sort(function (a, b) { return a.s - b.s || a.i - b.i; });
    return out.map(function (m) { return { kind: m.kind, o: m.o }; });
  }

  // ---------- Path network ----------

  function dist(a, b) { return Math.sqrt((a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y)); }

  // Closest point on the line from a to b to point p. t runs 0 (at a) to 1 (at b).
  function project(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var len2 = dx * dx + dy * dy;
    var t = len2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2 : 0;
    t = Math.max(0, Math.min(1, t));
    var q = { x: a.x + t * dx, y: a.y + t * dy };
    return { t: t, x: q.x, y: q.y, d: dist(p, q) };
  }

  // Builds the walkable graph from window.PATHS plus every door and entrance.
  // Doors and entrances are not wired by hand: each one is joined to the
  // closest point on the closest hallway line ("snapping").
  // Returns { nodes, adj, problems, attach } where problems lists data mistakes.
  // Each level is its own floor: a door only joins hallways on its own level, and the
  // levels are linked only by "stair" and "elevator" edges.
  function buildGraph(paths, rooms, entrances, spots) {
    var nodes = {}, adj = {}, problems = [];
    var attach = []; // for drawing: [{ from: {x,y}, to: {x,y}, d }]

    function addNode(n) { nodes[n.id] = n; adj[n.id] = adj[n.id] || []; }
    function link(a, b, info) {
      // Stairs and elevators can say how "long" they feel ("length"), since moving up a floor
      // takes time but covers no distance on the map.
      var w = info.length != null ? info.length : dist(nodes[a], nodes[b]);
      adj[a].push({ to: b, w: w, kind: info.kind, guess: !!info.guess });
      adj[b].push({ to: a, w: w, kind: info.kind, guess: !!info.guess });
    }

    (paths.nodes || []).forEach(function (n) {
      if (nodes[n.id]) { problems.push('Duplicate node id: ' + n.id); }
      addNode({ id: n.id, x: n.x, y: n.y, name: n.name || '', guess: !!n.guess, kind: 'hall', level: lv(n) });
    });

    var edges = [];
    (paths.edges || []).forEach(function (e, i) {
      if (!nodes[e.from] || !nodes[e.to]) {
        problems.push('Edge ' + i + ' points to a missing node: ' + e.from + ' to ' + e.to);
        return;
      }
      var kind = e.kind || 'hall', l1 = nodes[e.from].level, l2 = nodes[e.to].level;
      if (l1 !== l2 && !VERTICAL[kind]) {
        problems.push('Edge ' + e.from + ' to ' + e.to + ' joins level ' + l1 + ' and level ' + l2 + '. Give it "kind": "stair" or "elevator".');
      }
      edges.push({ from: e.from, to: e.to, kind: kind, guess: !!e.guess, stops: [], level: l1,
        length: VERTICAL[kind] && e.length != null ? e.length : null });
    });

    // Every place a person can start or finish.
    var points = [];
    (rooms || []).forEach(function (r) {
      var doors = r.doors || [];
      if (!doors.length) { problems.push('Room ' + r.id + ' has no doors'); }
      doors.forEach(function (d, k) {
        points.push({ id: 'door:' + r.id + ':' + k, x: d[0], y: d[1], name: (r.door || r.name) + ' door', level: lv(r) });
      });
    });
    (entrances || []).forEach(function (en) {
      points.push({ id: 'entrance:' + en.id, x: en.x, y: en.y, name: en.name, level: lv(en) });
    });
    (spots || []).forEach(function (s) {
      points.push({ id: 'spot:' + s.id, x: s.x, y: s.y, name: s.label, level: lv(s) });
    });

    points.forEach(function (p) {
      var best = null;
      edges.forEach(function (e) {
        // Doors join plain hallways on their own level only, never a staircase, elevator or steps.
        if (NOT_ACCESSIBLE[e.kind] || VERTICAL[e.kind] || e.level !== p.level) { return; }
        var pr = project(p, nodes[e.from], nodes[e.to]);
        if (!best || pr.d < best.pr.d) { best = { e: e, pr: pr }; }
      });
      addNode({ id: p.id, x: p.x, y: p.y, name: p.name, kind: 'point', level: p.level });
      if (!best) { problems.push(p.id + ' has no hallway to connect to'); return; }
      if (best.pr.d > MAX_SNAP) {
        problems.push(p.id + ' is ' + Math.round(best.pr.d) + ' units from the nearest hallway (limit ' + MAX_SNAP + ')');
      }
      best.e.stops.push({ t: best.pr.t, x: best.pr.x, y: best.pr.y, point: p.id, d: best.pr.d });
      attach.push({ from: { x: p.x, y: p.y }, to: { x: best.pr.x, y: best.pr.y }, d: best.pr.d, level: p.level });
    });

    // Split each hallway line at the places where doors join it, in order along the line.
    edges.forEach(function (e, i) {
      e.stops.sort(function (a, b) { return a.t - b.t; });
      var prev = e.from;
      e.stops.forEach(function (s, k) {
        var sid = 'snap:' + i + ':' + k;
        // A join point is named after where its hallway leads ("to"), so edges are drawn pointing inward.
        addNode({ id: sid, x: s.x, y: s.y, name: nodes[e.to].name || nodes[e.from].name, kind: 'snap', level: e.level });
        link(prev, sid, e);
        link(sid, s.point, { kind: 'door', guess: false });
        prev = sid;
      });
      link(prev, e.to, e);
    });

    return { nodes: nodes, adj: adj, problems: problems, attach: attach };
  }

  // ---------- Route finding (Dijkstra's shortest path) ----------

  // A small "binary heap": a list kept in an order where the smallest item is always first.
  function heapPush(h, item) {
    h.push(item);
    for (var i = h.length - 1; i > 0;) {
      var p = (i - 1) >> 1;
      if (h[p][0] <= h[i][0]) { break; }
      var t = h[p]; h[p] = h[i]; h[i] = t; i = p;
    }
  }
  function heapPop(h) {
    var top = h[0], last = h.pop();
    if (h.length) {
      h[0] = last;
      for (var i = 0; ;) {
        var l = 2 * i + 1, r = l + 1, m = i;
        if (l < h.length && h[l][0] < h[m][0]) { m = l; }
        if (r < h.length && h[r][0] < h[m][0]) { m = r; }
        if (m === i) { break; }
        var t = h[m]; h[m] = h[i]; h[i] = t; i = m;
      }
    }
    return top;
  }

  // from: a node id such as 'entrance:E-S-WEST'.
  // targets: a list of node ids; the route ends at whichever is closest.
  // options.accessible: true skips stairs and steps.
  // Returns null if there is no way through, otherwise
  // { ids, points: [[x,y]...], length, usesGuess, names }.
  function shortest(graph, from, targets, options) {
    var accessible = options && options.accessible;
    if (!graph.nodes[from]) { return null; }
    var want = {};
    targets.forEach(function (t) { want[t] = true; });
    var distTo = {}, prev = {}, done = {};
    distTo[from] = 0;
    // Always look next at the closest place not yet finished. A "heap" keeps them sorted cheaply,
    // so big outdoor networks (thousands of points) stay fast.
    var heap = [[0, from]], u = null;
    while (heap.length) {
      var top = heapPop(heap);
      u = top[1];
      if (done[u] || top[0] > distTo[u]) { u = null; continue; }
      if (want[u]) { break; }
      done[u] = true;
      // Doors and entrances are dead ends: you can start or finish there, not walk through a room.
      if (u !== from && graph.nodes[u].kind === 'point') { u = null; continue; }
      graph.adj[u].forEach(function (e) {
        if (accessible && NOT_ACCESSIBLE[e.kind]) { return; }
        var nd = distTo[u] + e.w;
        if (distTo[e.to] == null || nd < distTo[e.to]) { distTo[e.to] = nd; prev[e.to] = { id: u, edge: e }; heapPush(heap, [nd, e.to]); }
      });
      u = null;
    }
    if (u === null) { return null; }
    var path = [], kinds = [], usesGuess = false, cur = u;
    while (cur) {
      path.unshift(cur);
      if (prev[cur]) {
        kinds.unshift(prev[cur].edge.kind);
        if (prev[cur].edge.guess || graph.nodes[cur].guess) { usesGuess = true; }
        cur = prev[cur].id;
      } else { cur = null; }
    }
    kinds.unshift('');
    var names = [];
    path.forEach(function (id) {
      var n = graph.nodes[id].name;
      if (n && names[names.length - 1] !== n) { names.push(n); }
    });
    return {
      ids: path,
      points: path.map(function (id) { return [graph.nodes[id].x, graph.nodes[id].y]; }),
      levels: path.map(function (id) { return graph.nodes[id].level; }), // level of each point
      length: distTo[u],
      kinds: kinds,              // kinds[i] = kind of the edge that arrives at ids[i]
      outdoor: kinds.indexOf('outdoor') > -1,
      usesGuess: usesGuess,
      names: names
    };
  }

  // Convenience: route from an entrance id to a room or photo point.
  function routeTo(graph, entranceId, target, options) {
    var ends = [];
    if (target.kind === 'room') {
      (target.o.doors || []).forEach(function (d, k) { ends.push('door:' + target.o.id + ':' + k); });
    } else {
      ends.push('spot:' + target.o.id);
    }
    return shortest(graph, 'entrance:' + entranceId, ends, options);
  }

  // The closest of several possible destinations (for example "nearest restroom").
  // Returns { target, route } or null.
  function nearest(graph, entranceId, targets, options) {
    var best = null;
    targets.forEach(function (t) {
      var r = routeTo(graph, entranceId, t, options);
      if (r && (!best || r.length < best.route.length)) { best = { target: t, route: r }; }
    });
    return best;
  }

  // ---------- Turn-by-turn directions ----------

  var TURN_MIN = 30;       // a bend smaller than this many degrees counts as "straight on"
  var SHORT_LEG = 22;      // a jog shorter than this (map units) is folded into the leg before it
  var STUB = 55;           // a first leg this short (a few steps from a door) absorbs a gentle bend
  var FEET_PER_MINUTE = 240; // an easy indoor walking pace, about 2.7 mph
  var MINUTES_PER = { elevator: 0.75, stair: 0.4 }; // waiting for an elevator, climbing one flight

  function angleBetween(h1, h2) {
    // Positive = turning right, negative = turning left. The map's y axis points down.
    var cross = h1.x * h2.y - h1.y * h2.x, dot = h1.x * h2.x + h1.y * h2.y;
    return Math.atan2(cross, dot) * 180 / Math.PI;
  }

  function turnWord(angle) {
    var a = Math.abs(angle), side = angle > 0 ? 'right' : 'left';
    if (a < TURN_MIN) { return { turn: 'straight', text: 'Continue straight' }; }
    if (a > 150) { return { turn: 'around', text: 'Turn around' }; }
    if (a > 110) { return { turn: 'sharp-' + side, text: 'Make a sharp ' + side }; }
    return { turn: side, text: 'Turn ' + side };
  }

  // Turns a route into readable steps.
  // targetName: what the last step should say you are walking to.
  // opts.feetPerUnit: map units to feet (data.js SCALE).
  // opts.levelNames: { "2": "Level 2" } for the "Take the elevator up to ..." steps.
  // opts.fallbackName: what to say when a point has no name (outdoors: "the path"). Returns
  // { steps: [{ kind, turn, text, feet, level }], feet, minutes }.
  function describe(graph, route, targetName, opts) {
    var fpu = (opts && opts.feetPerUnit) || 1;
    var nodes = route.ids.map(function (id) { return graph.nodes[id]; });
    var legs = [];
    for (var i = 1; i < nodes.length; i++) {
      var a = nodes[i - 1], b = nodes[i], len = dist(a, b);
      // A stair or elevator ride is its own step.
      if (route.kinds && VERTICAL[route.kinds[i]] && a.level !== b.level) {
        legs.push({ vertical: true, kind: route.kinds[i], from: a, to: b, len: 0, start: i - 1, end: i });
        continue;
      }
      if (len < 0.5) { continue; }
      var h = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      var cur = legs[legs.length - 1];
      if (cur && cur.vertical) { cur = null; }
      // A short stub (like the few steps from a door to the hallway) absorbs a gentle bend too.
      var bend = cur ? Math.abs(angleBetween(cur.h, h)) : 0;
      var outside = route.kinds && route.kinds[i] === 'outdoor';
      // Going in or out of the building always starts a new step, even in a straight line.
      if (cur && cur.outdoor === outside && (bend < TURN_MIN || (cur.len < STUB && bend < 60))) {
        cur.len += len; cur.end = i; cur.h = h; cur.outdoor = cur.outdoor || outside;
      } else {
        legs.push({ h: h, len: len, start: i - 1, end: i, outdoor: outside });
      }
    }
    // Fold tiny jogs into the previous leg so you never read "turn left, 3 ft".
    var kept = [];
    legs.forEach(function (leg, k) {
      var edge = k === 0 || k === legs.length - 1;
      var before = kept[kept.length - 1];
      if (!edge && !leg.vertical && before && !before.vertical && leg.len < SHORT_LEG && before.outdoor === leg.outdoor) {
        var prevLeg = kept[kept.length - 1];
        prevLeg.len += leg.len; prevLeg.end = leg.end; prevLeg.outdoor = prevLeg.outdoor || leg.outdoor;
      }
      else { kept.push(leg); }
    });

    // A first step of only a few feet (from the door to the hallway) is folded into the next one.
    if (kept.length > 1 && !kept[1].vertical && kept[0].len < STUB / 2) {
      kept[1].len += kept[0].len; kept[1].start = kept[0].start; kept.shift();
    }

    var names = (opts && opts.levelNames) || {};
    var levelName = function (id) { return names[id] || 'Level ' + id; };
    var steps = [{ kind: 'start', turn: '', text: 'Start at ' + (nodes[0].name || 'the entrance'), feet: 0, level: nodes[0].level }];
    var totalUnits = 0, extraMinutes = 0;
    kept.forEach(function (leg, k) {
      if (leg.vertical) {
        var up = parseFloat(leg.to.level) > parseFloat(leg.from.level);
        var how = leg.kind === 'elevator' ? 'the elevator' : (leg.from.name || 'the stairs');
        extraMinutes += MINUTES_PER[leg.kind] || 0;
        steps.push({ kind: 'level', turn: up ? 'up' : 'down', text: 'Take ' + how + (up ? ' up' : ' down') + ' to ' + levelName(leg.to.level),
          feet: 0, level: leg.to.level, fromLevel: leg.from.level });
        return;
      }
      totalUnits += leg.len;
      var last = k === kept.length - 1;
      var fresh = k === 0 || kept[k - 1].vertical; // first step on a floor has no turn
      var tw = fresh ? { turn: 'straight', text: 'Head' } : turnWord(angleBetween(kept[k - 1].h, leg.h));
      var end = nodes[leg.end];
      var text;
      if (last) {
        text = tw.text + ' to ' + targetName;
      } else if (leg.outdoor) {
        text = (fresh ? 'Head' : tw.text) + ' outside along the walkway toward ' + (end.name || 'the next building');
      } else {
        text = tw.text + ' toward ' + (end.name || (opts && opts.fallbackName) || 'the end of the hall');
      }
      steps.push({
        kind: last ? 'arrive' : 'walk',
        turn: fresh ? 'straight' : tw.turn,
        outdoor: !!leg.outdoor,
        level: end.level,
        text: text,
        feet: Math.max(5, Math.round(leg.len * fpu / 5) * 5)
      });
    });
    var feet = Math.round(totalUnits * fpu / 5) * 5;
    return { steps: steps, feet: feet, minutes: Math.max(1, Math.round(feet / FEET_PER_MINUTE + extraMinutes)) };
  }

  // ---------- GPS: from latitude and longitude to map units ----------
  // The floor plan is a picture, so its x and y mean nothing to a phone. To draw a blue dot we tie the
  // picture to the real world with "control points": spots on the plan where we know both the map position
  // (x, y) and the real GPS position (lat, lng). From those we work out how the plan is placed, turned and
  // scaled on the ground. Two points are enough, three or more also tell us how far off the fit is.

  var RAD = Math.PI / 180;

  // Metres in one degree of latitude and of longitude at a given latitude.
  function metersPerDegree(lat) {
    var p = lat * RAD;
    return {
      lat: 111132.92 - 559.82 * Math.cos(2 * p) + 1.175 * Math.cos(4 * p),
      lng: 111412.84 * Math.cos(p) - 93.5 * Math.cos(3 * p)
    };
  }

  function num(v) { return typeof v === 'number' && isFinite(v); }
  function validControl(c) {
    return !!c && num(c.lat) && num(c.lng) && num(c.x) && num(c.y) && Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180;
  }

  // points: [{ lat, lng, x, y }]. Returns null when there are fewer than 2 usable points or they are all
  // in the same place. Otherwise:
  //   toMap(lat, lng) -> { x, y }       toGeo(x, y) -> { lat, lng }
  //   unitsPerMeter      how many map units one real metre covers
  //   rotationDeg        how far the plan is turned from "up is north"
  //   rmsMeters          typical miss of the control points (null with only 2 points: nothing to check against)
  //   worstMeters, worstIndex   the control point that fits worst, for finding a typo
  // The fit keeps the plan's shape (no stretching): move, turn and resize only, because it is a picture of
  // a building drawn to scale.
  function fitGeo(points) {
    var pts = (points || []).filter(validControl);
    if (pts.length < 2) { return null; }
    var n = pts.length, lat0 = 0, lng0 = 0;
    pts.forEach(function (c) { lat0 += c.lat / n; lng0 += c.lng / n; });
    var mp = metersPerDegree(lat0);
    // Local flat plane in metres: e grows east, s grows SOUTH (so it points the same way as map y).
    function toLocal(lat, lng) { return { e: (lng - lng0) * mp.lng, s: -(lat - lat0) * mp.lat }; }
    function fromLocal(e, s) { return { lat: lat0 - s / mp.lat, lng: lng0 + e / mp.lng }; }
    var L = pts.map(function (c) { var l = toLocal(c.lat, c.lng); return { e: l.e, s: l.s, x: c.x, y: c.y }; });
    var me = 0, ms = 0, mx = 0, my = 0;
    L.forEach(function (p) { me += p.e / n; ms += p.s / n; mx += p.x / n; my += p.y / n; });
    var a = 0, b = 0, den = 0;
    L.forEach(function (p) {
      var e = p.e - me, s = p.s - ms, x = p.x - mx, y = p.y - my;
      a += e * x + s * y; b += e * y - s * x; den += e * e + s * s;
    });
    if (den < 1e-6) { return null; }
    // map = [[p, -q], [q, p]] * (e, s) + (tx, ty): a turn plus a resize, written as two numbers.
    var p = a / den, q = b / den;
    var tx = mx - (p * me - q * ms), ty = my - (q * me + p * ms);
    var scale = Math.sqrt(p * p + q * q);
    if (scale < 1e-9) { return null; }

    function localToMap(e, s) { return { x: p * e - q * s + tx, y: q * e + p * s + ty }; }
    function toMap(lat, lng) { var l = toLocal(lat, lng); return localToMap(l.e, l.s); }
    function toGeo(x, y) {
      var dx = x - tx, dy = y - ty, k = scale * scale;
      return fromLocal((p * dx + q * dy) / k, (-q * dx + p * dy) / k);
    }

    var sumSq = 0, worst = -1, worstM = 0;
    pts.forEach(function (c, i) {
      var m = toMap(c.lat, c.lng), miss = Math.sqrt((m.x - c.x) * (m.x - c.x) + (m.y - c.y) * (m.y - c.y)) / scale;
      sumSq += miss * miss;
      if (miss > worstM) { worstM = miss; worst = i; }
    });
    return {
      count: n,
      toMap: toMap, toGeo: toGeo,
      unitsPerMeter: scale,
      rotationDeg: Math.atan2(q, p) / RAD,
      rmsMeters: n >= 3 ? Math.sqrt(sumSq / n) : null,
      worstMeters: n >= 3 ? worstM : null,
      worstIndex: n >= 3 ? worst : -1
    };
  }

  // Phone GPS jumps around by several metres even when you stand still. This keeps a running best guess:
  // a reading with a small error (accuracy) moves the dot a lot, a poor reading barely moves it, and
  // the longer it has been since the last reading the more the dot is allowed to have moved.
  // Positions are in map units. opts.speed is how far a walking person can go per second, in map units.
  function createSmoother(opts) {
    var speed = (opts && opts.speed) || 15, minAcc = (opts && opts.minAccuracy) || 1;
    var s = null;
    return {
      // x, y: reading in map units. acc: its error in map units. t: time in milliseconds.
      update: function (x, y, acc, t) {
        var r = Math.max(acc, minAcc), rv = r * r;
        if (!s) { s = { x: x, y: y, v: rv, t: t }; return { x: s.x, y: s.y, acc: Math.sqrt(s.v) }; }
        var dt = Math.max(0, (t - s.t) / 1000), drift = speed * dt;
        s.v += drift * drift;
        var k = s.v / (s.v + rv);
        s.x += k * (x - s.x); s.y += k * (y - s.y);
        s.v *= 1 - k; s.t = t;
        return { x: s.x, y: s.y, acc: Math.sqrt(s.v) };
      },
      reset: function () { s = null; }
    };
  }

  // Works out what to show for a position on the plan.
  // pos: { x, y, accuracy } with x and y in map units and accuracy in metres.
  // ctx: { metersPerUnit, bounds: { x, y, w, h }, entrances: [...] }
  // Returns { x, y, radius (map units), accuracyMeters, inside, offMapMeters, nearest: { id, name, meters } }.
  // "inside" means the position is on the plan. Otherwise offMapMeters says how far away from it you are.
  function describeFix(pos, ctx) {
    var mpu = ctx.metersPerUnit, b = ctx.bounds;
    var dx = Math.max(b.x - pos.x, 0, pos.x - (b.x + b.w)), dy = Math.max(b.y - pos.y, 0, pos.y - (b.y + b.h));
    var off = Math.sqrt(dx * dx + dy * dy) * mpu;
    var best = null;
    (ctx.entrances || []).forEach(function (en) {
      var d = dist(pos, en) * mpu;
      if (!best || d < best.meters) { best = { id: en.id, name: en.name, meters: d }; }
    });
    return {
      x: pos.x, y: pos.y,
      radius: pos.accuracy / mpu,
      accuracyMeters: pos.accuracy,
      inside: off === 0,
      offMapMeters: off,
      nearest: best
    };
  }

  // ---------- Outdoors: campus walking paths ----------
  // Outdoor data is latitude/longitude. To reuse the same route finder, it is flattened into metres
  // around a centre point: x grows east, y grows SOUTH (the same way round as the floor plan's y).

  function localFrame(lat0, lng0) {
    var mp = metersPerDegree(lat0);
    return {
      toXY: function (lat, lng) { return { x: (lng - lng0) * mp.lng, y: -(lat - lat0) * mp.lat }; },
      toLatLng: function (x, y) { return { lat: lat0 - y / mp.lat, lng: lng0 + x / mp.lng }; }
    };
  }

  // paths: GeoJSON FeatureCollection of LineStrings (from campus/data.js). frame: from localFrame.
  // Returns { nodes, edges } in the same shape as PATHS in data.js, so buildGraph can use it.
  // Lines that share a point (as connected OpenStreetMap ways do) become joined at that point.
  // "steps" paths, and paths tagged wheelchair=no, get kind "steps" so the step-free route avoids them.
  // landmarks (optional): GeoJSON buildings. A path point with no name of its own is named after a
  // building within 30 m, so directions say "Turn right toward Fulton Hall" instead of "toward the path".
  function outdoorNetwork(paths, frame, landmarks) {
    var nodes = [], edges = [], byKey = {};
    function nodeAt(c, name) {
      var key = c[0].toFixed(7) + ',' + c[1].toFixed(7);
      if (!byKey[key]) {
        var p = frame.toXY(c[1], c[0]);
        byKey[key] = { id: 'o' + nodes.length, x: p.x, y: p.y, name: name || '' };
        nodes.push(byKey[key]);
      } else if (name && !byKey[key].name) { byKey[key].name = name; }
      return byKey[key].id;
    }
    ((paths && paths.features) || []).forEach(function (f) {
      var g = f.geometry, p = f.properties || {};
      if (!g) { return; }
      var lines = g.type === 'LineString' ? [g.coordinates] : (g.type === 'MultiLineString' ? g.coordinates : []);
      var kind = p.highway === 'steps' || p.wheelchair === 'no' ? 'steps' : 'path';
      var name = p.name || (p.highway === 'steps' ? 'the steps' : '');
      lines.forEach(function (line) {
        for (var i = 1; i < line.length; i++) {
          var a = nodeAt(line[i - 1], name), b = nodeAt(line[i], name);
          if (a !== b) { edges.push({ from: a, to: b, kind: kind }); }
        }
      });
    });
    nameByLandmarks(nodes, landmarks, frame, 30);
    return { nodes: nodes, edges: edges };
  }

  function nameByLandmarks(nodes, landmarks, frame, maxMeters) {
    var walls = [];
    ((landmarks && landmarks.features) || []).forEach(function (f) {
      var g = f.geometry, name = f.properties && f.properties.name;
      if (!g || !name) { return; }
      var polys = g.type === 'Polygon' ? [g.coordinates] : (g.type === 'MultiPolygon' ? g.coordinates : []);
      polys.forEach(function (poly) {
        var r = poly[0].map(function (c) { return frame.toXY(c[1], c[0]); });
        var b = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity };
        r.forEach(function (p) { b.x0 = Math.min(b.x0, p.x); b.y0 = Math.min(b.y0, p.y); b.x1 = Math.max(b.x1, p.x); b.y1 = Math.max(b.y1, p.y); });
        walls.push({ name: name, ring: r, box: b });
      });
    });
    if (!walls.length) { return; }
    nodes.forEach(function (n) {
      if (n.name) { return; }
      var best = null, bestD = maxMeters;
      walls.forEach(function (w) {
        var b = w.box; // skip buildings that are clearly too far away
        if (n.x < b.x0 - maxMeters || n.x > b.x1 + maxMeters || n.y < b.y0 - maxMeters || n.y > b.y1 + maxMeters) { return; }
        for (var i = 1; i < w.ring.length; i++) {
          var d = project(n, w.ring[i - 1], w.ring[i]).d;
          if (d < bestD) { bestD = d; best = w.name; }
        }
      });
      if (best) { n.name = best; }
    });
  }

  // The best way from a starting point outdoors to a room inside a building.
  // out: the outdoor graph, built by buildGraph with the start point and the building's entrances
  //      as "entrances" (start id "START", entrance ids the same as the indoor ENTRANCES ids).
  // indoor: the indoor graph. entranceIds: which indoor entrances to consider.
  // places: { start: {x, y}, entrances: { id: {x, y} } } in outdoor metres, for the straight-line fallback.
  // metersPerUnit: indoor map units to metres.
  // Tries every entrance and keeps the one with the shortest total walk (outdoors plus indoors).
  // If the outdoor paths do not connect (or there are none yet), it falls back to a straight line
  // and says so with straight: true. Returns null when no entrance leads to the room.
  function campusRoute(out, indoor, entranceIds, target, places, metersPerUnit, options) {
    var best = null;
    entranceIds.forEach(function (id) {
      var inner = routeTo(indoor, id, target, options);
      if (!inner) { return; }
      var outer = out ? shortest(out, 'entrance:START', ['entrance:' + id], options) : null, straight = false;
      if (!outer) {
        var s = places.start, e = places.entrances[id];
        if (!s || !e) { return; }
        straight = true;
        outer = { points: [[s.x, s.y], [e.x, e.y]], length: Math.sqrt((s.x - e.x) * (s.x - e.x) + (s.y - e.y) * (s.y - e.y)), ids: [], kinds: [] };
      }
      // A straight line ignores paths and buildings, so it only wins when nothing better exists.
      var meters = outer.length * (straight ? 1.3 : 1) + inner.length * metersPerUnit;
      if (!best || (best.straight && !straight) || (best.straight === straight && meters < best.meters)) {
        best = { entrance: id, outdoor: outer, indoor: inner, straight: straight, meters: meters };
      }
    });
    return best;
  }

  return {
    MAX_SNAP: MAX_SNAP,
    localFrame: localFrame,
    outdoorNetwork: outdoorNetwork,
    campusRoute: campusRoute,
    search: search,
    buildGraph: buildGraph,
    shortest: shortest,
    routeTo: routeTo,
    nearest: nearest,
    describe: describe,
    fitGeo: fitGeo,
    createSmoother: createSmoother,
    describeFix: describeFix
  };
});
