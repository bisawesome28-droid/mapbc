// Search and route-finding for the map.
// This file has no drawing code, so the page (index.html) and the tests (tests.js) share it.
// In the browser it becomes window.MapLogic. In Node it is loaded with require('./logic.js').
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MapLogic = api; }
})(this, function () {

  // A door further than this from every hallway line is treated as a data mistake.
  var MAX_SNAP = 45;

  // Edge kinds that a wheelchair user cannot take.
  var NOT_ACCESSIBLE = { steps: true, stair: true };

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
  function buildGraph(paths, rooms, entrances, spots) {
    var nodes = {}, adj = {}, problems = [];
    var attach = []; // for drawing: [{ from: {x,y}, to: {x,y}, d }]

    function addNode(n) { nodes[n.id] = n; adj[n.id] = adj[n.id] || []; }
    function link(a, b, info) {
      var w = dist(nodes[a], nodes[b]);
      adj[a].push({ to: b, w: w, kind: info.kind, guess: !!info.guess });
      adj[b].push({ to: a, w: w, kind: info.kind, guess: !!info.guess });
    }

    (paths.nodes || []).forEach(function (n) {
      if (nodes[n.id]) { problems.push('Duplicate node id: ' + n.id); }
      addNode({ id: n.id, x: n.x, y: n.y, name: n.name || '', guess: !!n.guess, kind: 'hall' });
    });

    var edges = [];
    (paths.edges || []).forEach(function (e, i) {
      if (!nodes[e.from] || !nodes[e.to]) {
        problems.push('Edge ' + i + ' points to a missing node: ' + e.from + ' to ' + e.to);
        return;
      }
      edges.push({ from: e.from, to: e.to, kind: e.kind || 'hall', guess: !!e.guess, stops: [] });
    });

    // Every place a person can start or finish.
    var points = [];
    (rooms || []).forEach(function (r) {
      var doors = r.doors || [];
      if (!doors.length) { problems.push('Room ' + r.id + ' has no doors'); }
      doors.forEach(function (d, k) {
        points.push({ id: 'door:' + r.id + ':' + k, x: d[0], y: d[1], name: (r.door || r.name) + ' door' });
      });
    });
    (entrances || []).forEach(function (en) {
      points.push({ id: 'entrance:' + en.id, x: en.x, y: en.y, name: en.name });
    });
    (spots || []).forEach(function (s) {
      points.push({ id: 'spot:' + s.id, x: s.x, y: s.y, name: s.label });
    });

    points.forEach(function (p) {
      var best = null;
      edges.forEach(function (e) {
        // Doors join plain hallways only, never the middle of a staircase or a set of steps.
        if (NOT_ACCESSIBLE[e.kind]) { return; }
        var pr = project(p, nodes[e.from], nodes[e.to]);
        if (!best || pr.d < best.pr.d) { best = { e: e, pr: pr }; }
      });
      addNode({ id: p.id, x: p.x, y: p.y, name: p.name, kind: 'point' });
      if (!best) { problems.push(p.id + ' has no hallway to connect to'); return; }
      if (best.pr.d > MAX_SNAP) {
        problems.push(p.id + ' is ' + Math.round(best.pr.d) + ' units from the nearest hallway (limit ' + MAX_SNAP + ')');
      }
      best.e.stops.push({ t: best.pr.t, x: best.pr.x, y: best.pr.y, point: p.id, d: best.pr.d });
      attach.push({ from: { x: p.x, y: p.y }, to: { x: best.pr.x, y: best.pr.y }, d: best.pr.d });
    });

    // Split each hallway line at the places where doors join it, in order along the line.
    edges.forEach(function (e, i) {
      e.stops.sort(function (a, b) { return a.t - b.t; });
      var prev = e.from;
      e.stops.forEach(function (s, k) {
        var sid = 'snap:' + i + ':' + k;
        addNode({ id: sid, x: s.x, y: s.y, name: nodes[e.from].name || nodes[e.to].name, kind: 'snap' });
        link(prev, sid, e);
        link(sid, s.point, { kind: 'door', guess: false });
        prev = sid;
      });
      link(prev, e.to, e);
    });

    return { nodes: nodes, adj: adj, problems: problems, attach: attach };
  }

  // ---------- Route finding (Dijkstra's shortest path) ----------

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
    var ids = Object.keys(graph.nodes);
    while (true) {
      var u = null;
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        if (!done[id] && distTo[id] != null && (u === null || distTo[id] < distTo[u])) { u = id; }
      }
      if (u === null) { return null; }
      if (want[u]) { break; }
      done[u] = true;
      // Doors and entrances are dead ends: you can start or finish there, not walk through a room.
      if (u !== from && graph.nodes[u].kind === 'point') { continue; }
      graph.adj[u].forEach(function (e) {
        if (accessible && NOT_ACCESSIBLE[e.kind]) { return; }
        var nd = distTo[u] + e.w;
        if (distTo[e.to] == null || nd < distTo[e.to]) { distTo[e.to] = nd; prev[e.to] = { id: u, edge: e }; }
      });
    }
    var path = [], usesGuess = false, cur = u;
    while (cur) {
      path.unshift(cur);
      if (prev[cur]) { if (prev[cur].edge.guess || graph.nodes[cur].guess) { usesGuess = true; } cur = prev[cur].id; }
      else { cur = null; }
    }
    var names = [];
    path.forEach(function (id) {
      var n = graph.nodes[id].name;
      if (n && names[names.length - 1] !== n) { names.push(n); }
    });
    return {
      ids: path,
      points: path.map(function (id) { return [graph.nodes[id].x, graph.nodes[id].y]; }),
      length: distTo[u],
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
  var SHORT_LEG = 10;      // a jog shorter than this (map units) is folded into the leg before it
  var FEET_PER_MINUTE = 240; // an easy indoor walking pace, about 2.7 mph

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
  // opts.feetPerUnit: map units to feet (data.js SCALE). Returns
  // { steps: [{ kind, turn, text, feet }], feet, minutes }.
  function describe(graph, route, targetName, opts) {
    var fpu = (opts && opts.feetPerUnit) || 1;
    var nodes = route.ids.map(function (id) { return graph.nodes[id]; });
    var legs = [];
    for (var i = 1; i < nodes.length; i++) {
      var a = nodes[i - 1], b = nodes[i], len = dist(a, b);
      if (len < 0.5) { continue; }
      var h = { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
      var cur = legs[legs.length - 1];
      // A short stub (like the few steps from a door to the hallway) absorbs a gentle bend too.
      var bend = cur ? Math.abs(angleBetween(cur.h, h)) : 0;
      if (cur && (bend < TURN_MIN || (cur.len < 25 && bend < 60))) {
        cur.len += len; cur.end = i; cur.h = h;
      } else {
        legs.push({ h: h, len: len, start: i - 1, end: i });
      }
    }
    // Fold tiny jogs into the previous leg so you never read "turn left, 3 ft".
    var kept = [];
    legs.forEach(function (leg, k) {
      var edge = k === 0 || k === legs.length - 1;
      if (!edge && leg.len < SHORT_LEG && kept.length) { kept[kept.length - 1].len += leg.len; kept[kept.length - 1].end = leg.end; }
      else { kept.push(leg); }
    });

    var steps = [{ kind: 'start', turn: '', text: 'Start at ' + (nodes[0].name || 'the entrance'), feet: 0 }];
    var totalUnits = 0;
    kept.forEach(function (leg, k) {
      totalUnits += leg.len;
      var last = k === kept.length - 1;
      var tw = k === 0 ? { turn: 'straight', text: 'Head' } : turnWord(angleBetween(kept[k - 1].h, leg.h));
      var end = nodes[leg.end];
      var text;
      if (last) {
        text = tw.text + ' to ' + targetName;
      } else {
        text = tw.text + ' toward ' + (end.name || 'the end of the hall');
      }
      steps.push({
        kind: last ? 'arrive' : 'walk',
        turn: k === 0 ? 'straight' : tw.turn,
        text: text,
        feet: Math.max(5, Math.round(leg.len * fpu / 5) * 5)
      });
    });
    var feet = Math.round(totalUnits * fpu / 5) * 5;
    return { steps: steps, feet: feet, minutes: Math.max(1, Math.round(feet / FEET_PER_MINUTE)) };
  }

  return {
    MAX_SNAP: MAX_SNAP,
    search: search,
    buildGraph: buildGraph,
    shortest: shortest,
    routeTo: routeTo,
    nearest: nearest,
    describe: describe
  };
});
