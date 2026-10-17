// Keeps the indoor blue dot on the places people can walk: the hallway lines of the floor plan, or inside a room.
// Pure logic with no drawing or page code, so a native app can copy it. In the browser it is window.MapSnap; in Node,
// require('./core/snap.js').
//
// How it decides (all distances in metres; the building's own plan units are converted with its unitsPerMeter):
// - A reading counts for more when the phone says it is accurate (its "accuracy", never trusted below MIN_SIGMA).
// - The dot sticks to the hallway it is on. It moves on to the next piece of the same hallway freely, turns at a
//   junction once the readings lean that way for a moment, and only moves to a different hallway after clear evidence
//   that lasts several seconds. It only ever moves to a hallway CONNECTED to the one it is on (within NET_RADIUS of
//   walking), so two parallel hallways a few metres apart do not swap back and forth with GPS jitter.
// - Rooms win: after several seconds of readings inside a room (reachable from where the dot is) while you have
//   stopped moving, the dot goes into the room and is not pulled out to the hallway. It leaves only after readings stay
//   outside for a while. Walking past a classroom does not pull the dot in.
// - Far from every path, or outside the building, the dot is left alone (mode "free").
// - The dot moves at most MAX_SPEED metres per second, so it never jumps.
// - GPS cannot tell floors apart: the caller says which floor is showing and only that floor's paths are used.
// - Snapping only corrects error ACROSS a hallway. Error ALONG a hallway is unchanged; guessed hallways are flagged.
// - motion(): a place for steps and heading from a native app later. It is stored and ignored for now.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MapSnap = api; }
})(this, function () {

  var P = {
    MIN_SIGMA: 3,          // m: indoor GPS is never treated as better than this
    GATE_SIGMAS: 2.5,      // a hallway counts as "near" within this many sigmas of the reading...
    GATE_MIN: 5,           // ...but at least this far (m)
    GATE_MAX: 20,          // ...and at most this far (m)
    NET_RADIUS: 25,        // m of walking from the dot: a room it can go into must open onto a hallway within this
    DETOUR: 6,             // m: how much a walk along the hallways may differ from how far the reading moved
    SIGMA_SCALE: 0.6,      // the readings' spread, as a share of the phone's accuracy figure (a starting guess: tune on a real walk)
    LEAD_RATIO: 1.5,       // another hallway must be at least this many times as likely as the dot's...
    SWITCH_MIN_TIME: 1.5,  // ...for this many seconds before the dot moves to it
    UNLINKED: 0.002,       // per second: chance of being on a hallway NOT connected to the dot's (see step 3)
    MAX_CANDS: 12,         // at most this many nearby hallway pieces are weighed each reading
    STRAIGHT_DEG: 30,      // the next piece of a hallway within this angle is "the same hallway"
    ENTER_INSIDE: 2,       // s of readings inside the building before snapping starts
    LEAVE_OUTSIDE: 4,      // s of readings clearly outside the building before snapping stops
    OUTSIDE_SLACK: 2,      // m: readings this close outside the walls still count as inside
    RELOCK_AFTER: 6,       // s of readings that do not connect to the dot's hallway before it lets go and looks again
    ROOM_ENTER: 6,         // s of readings inside a room before the dot goes in (more when GPS is poor)
    ROOM_LEAVE: 5,         // s of readings outside it before the dot comes back out
    WALKING_SPEED: 0.6,    // m/s: readings moving faster than this (over MOVING_WINDOW) mean you are walking, not in a room
    MOVING_WINDOW: 5,      // s
    ROOM_DEPTH: 1,         // m: a reading must be at least this far inside the room's walls to count fully
    DOOR_REACH: 6,         // m: a room door this close to a hallway line belongs to that hallway
    MAX_SPEED: 3,          // m/s: the dot never moves faster (a brisk walk, plus room to catch up)
    MAX_DT: 3              // s: a long gap between readings counts as at most this much evidence
  };
  var SKIP_KINDS = { stair: true, elevator: true, outdoor: true }; // edges that are not hallways on one floor

  function lv(o) { return String(o.level == null ? '1' : o.level); }

  // ---------- Geometry (plan units) ----------
  function proj(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, L2 = dx * dx + dy * dy;
    var t = L2 ? ((p.x - a.x) * dx + (p.y - a.y) * dy) / L2 : 0;
    var tc = Math.max(0, Math.min(1, t)), x = a.x + tc * dx, y = a.y + tc * dy;
    return { t: t, tc: tc, x: x, y: y, d: Math.sqrt((p.x - x) * (p.x - x) + (p.y - y) * (p.y - y)) };
  }
  function inPoly(p, pts) {
    var inside = false;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      var a = pts[i], b = pts[j];
      if ((a[1] > p.y) !== (b[1] > p.y) && p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0]) { inside = !inside; }
    }
    return inside;
  }
  function edgeDist(p, pts) {
    var best = Infinity;
    for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      best = Math.min(best, proj(p, { x: pts[j][0], y: pts[j][1] }, { x: pts[i][0], y: pts[i][1] }).d);
    }
    return best;
  }
  // Positive inside the shape (distance to its nearest wall), negative outside.
  function depth(p, pts) { var d = edgeDist(p, pts); return inPoly(p, pts) ? d : -d; }
  // A point inside a room, at least m units from its walls if it can be (nudged toward the room's middle).
  function clampInto(p, room, m) {
    var q = { x: p.x, y: p.y };
    for (var k = 0; k < 8 && depth(q, room.shape) < m; k++) { q.x += (room.cx - q.x) * 0.35; q.y += (room.cy - q.y) * 0.35; }
    return q;
  }

  // ---------- Index: one building's walkable places, per floor ----------
  // b: a building as core/school.js prepares it (paths, rooms, outlines, unitsPerMeter). Returns an object to pass to
  // createTracker. Only plan data is used, so it works the same for every building.
  function index(b) {
    var upm = b.unitsPerMeter || 20, levels = {}, nodes = {};
    function L(id) { if (!levels[id]) { levels[id] = { segs: [], at: {}, rooms: [], outlines: [] }; } return levels[id]; }
    ((b.paths && b.paths.nodes) || []).forEach(function (n) { nodes[n.id] = n; });
    ((b.paths && b.paths.edges) || []).forEach(function (e) {
      var a = nodes[e.from], c = nodes[e.to];
      if (!a || !c || SKIP_KINDS[e.kind] || lv(a) !== lv(c)) { return; }
      var F = L(lv(a)), len = Math.sqrt((c.x - a.x) * (c.x - a.x) + (c.y - a.y) * (c.y - a.y));
      if (!len) { return; }
      var s = { i: F.segs.length, a: { x: a.x, y: a.y }, b: { x: c.x, y: c.y }, na: a.id, nb: c.id, len: len,
        guess: !!e.guess, name: a.name || c.name || '', ux: (c.x - a.x) / len, uy: (c.y - a.y) / len };
      F.segs.push(s);
      (F.at[a.id] = F.at[a.id] || []).push(s.i); (F.at[c.id] = F.at[c.id] || []).push(s.i);
    });
    (b.rooms || []).forEach(function (r) {
      if (r.stair || r.cars || !r.shape || r.shape.length < 3) { return; } // you walk through stairs and elevators
      var F = L(lv(r)), cx = 0, cy = 0;
      r.shape.forEach(function (q) { cx += q[0] / r.shape.length; cy += q[1] / r.shape.length; });
      var room = { id: r.id, name: r.door ? r.door + ' (' + (r.name || 'room') + ')' : (r.name || r.id), shape: r.shape, cx: cx, cy: cy, segs: [], guess: !!r.useGuess };
      // The hallways its doors open onto: the dot can only come into the room from there.
      (r.doors || []).forEach(function (d) {
        var best = null;
        F.segs.forEach(function (s) { var q = proj({ x: d[0], y: d[1] }, s.a, s.b); if (!best || q.d < best.d) { best = { d: q.d, i: s.i }; } });
        if (best && best.d <= P.DOOR_REACH * upm && room.segs.indexOf(best.i) < 0) { room.segs.push(best.i); }
      });
      F.rooms.push(room);
    });
    (b.outlines || []).forEach(function (o) { if (o.points && o.points.length > 2) { L(lv(o)).outlines.push(o.points); } });
    // Rooms whose doors were traced before the hallways on a floor still need their hallway: found now that all are in.
    Object.keys(levels).forEach(function (id) {
      var F = levels[id];
      F.rooms.forEach(function (room) {
        if (room.segs.length) { return; }
        var best = null;
        F.segs.forEach(function (s) { var q = proj({ x: room.cx, y: room.cy }, s.a, s.b); if (!best || q.d < best.d) { best = { d: q.d, i: s.i }; } });
        if (best) { room.segs.push(best.i); }
      });
    });
    return { upm: upm, levels: levels };
  }

  // Walking distance (plan units) between a point on segment i (at t1, 0..1) and one on segment j (at t2), up to limit.
  // Infinity when they are not connected within limit.
  function walkDist(F, i, t1, j, t2, limit, cache) {
    var s = F.segs[i], g = F.segs[j];
    if (i === j) { return Math.abs(t1 - t2) * s.len; }
    var key = i + ':' + t1.toFixed(3), dist = cache[key];
    if (!dist) {
      dist = {}; var queue = [];
      var reach = function (node, d) { if (d <= limit && (dist[node] == null || d < dist[node])) { dist[node] = d; queue.push(node); } };
      reach(s.na, t1 * s.len); reach(s.nb, (1 - t1) * s.len);
      while (queue.length) {
        var n = queue.shift(), d0 = dist[n];
        (F.at[n] || []).forEach(function (k) { var t = F.segs[k]; reach(t.na === n ? t.nb : t.na, d0 + t.len); });
      }
      cache[key] = dist;
    }
    var a = dist[g.na] == null ? Infinity : dist[g.na] + t2 * g.len, b = dist[g.nb] == null ? Infinity : dist[g.nb] + (1 - t2) * g.len;
    return Math.min(a, b);
  }

  // ---------- The tracker: one per building ----------
  // How it follows the hallways: every nearby piece of hallway has a chance of being where you are. Each reading, the
  // chance moves along the hallways only (from where you were to where you might be now, preferring a walk about as long
  // as the straight line), then is weighed by how close the reading is. Two parallel hallways are far apart BY WALKING,
  // so the chance does not jump between them; turning a corner is a short walk, so it follows you. The dot changes
  // hallway only when the new one has clearly won for a moment.
  // ix: from index(). opts: override any of the numbers in P (for tuning), e.g. { ROOM_ENTER: 8 }.
  function createTracker(ix, opts) {
    var C = {}; for (var k in P) { C[k] = opts && opts[k] != null ? opts[k] : P[k]; }
    var u = ix.upm, st = null;

    function fresh(level) {
      return { level: level, mode: 'free', inside: 0, outside: 0, belief: null, seg: -1, lead: -1, leadT: 0, far: 0,
        room: null, roomEv: {}, roomOut: 0, dot: st ? st.dot : null, t: st ? st.t : null, motion: st ? st.motion : null };
    }
    function letGo(why) { st.mode = 'free'; st.belief = null; st.seg = -1; st.lead = -1; st.leadT = 0; st.far = 0; st.room = null; st.roomEv = {}; return why; }

    // fix: { x, y (plan units), acc (metres), t (milliseconds), level (the floor showing) }.
    // Returns { x, y, mode: 'free'|'path'|'room', seg, room, guess, name, raw: {x,y}, target: {x,y}, moved (m), note, sigma }.
    function update(fix) {
      var level = String(fix.level);
      if (!st || st.level !== level) { st = fresh(level); }
      var F = ix.levels[level] || { segs: [], at: {}, rooms: [], outlines: [] };
      var p = { x: fix.x, y: fix.y }, sigma = Math.max(fix.acc || 25, C.MIN_SIGMA), su = sigma * u;
      var dt = st.t == null ? 1 : Math.max(0, Math.min(C.MAX_DT, (fix.t - st.t) / 1000));
      var gate = Math.max(C.GATE_MIN, Math.min(C.GATE_MAX, C.GATE_SIGMAS * sigma)) * u;
      var note = '';

      // 1. Inside the building? Readings a little outside the walls still count; leaving takes a few seconds.
      var wall = -Infinity;
      F.outlines.forEach(function (o) { wall = Math.max(wall, depth(p, o)); });
      var inside = F.outlines.length ? wall >= -C.OUTSIDE_SLACK * u : true;
      if (inside) { st.inside += dt; st.outside = 0; } else { st.outside += dt; if (st.mode === 'free') { st.inside = 0; } }
      if (st.mode !== 'free' && st.outside >= C.LEAVE_OUTSIDE) { note = letGo('left the building'); st.inside = 0; }
      var active = st.mode !== 'free' || (inside && st.inside >= C.ENTER_INSIDE - 1e-9);

      // 2. The hallway pieces near this reading, and how well each fits it.
      var cands = [];
      var se = su * C.SIGMA_SCALE;
      F.segs.forEach(function (s, i) { var q = proj(p, s.a, s.b); if (q.d <= gate) { q.i = i; q.like = Math.exp(-0.5 * (q.d / se) * (q.d / se)); cands.push(q); } });
      cands.sort(function (a, b) { return a.d - b.d; }); cands = cands.slice(0, C.MAX_CANDS);

      if (active && cands.length) {
        // 3. Move the chances along the hallways, then weigh them by the reading.
        var next = {}, total = 0, step = C.MAX_SPEED * Math.max(dt, 0.5) * u, cache = {};
        var moveFix = st.last ? Math.hypot(p.x - st.last.x, p.y - st.last.y) : 0;
        if (st.belief) {
          cands.forEach(function (c) {
            var sum = 0;
            Object.keys(st.belief).forEach(function (k2) {
              var b0 = st.belief[k2], w = walkDist(F, +k2, b0.t, c.i, c.tc, step + gate, cache);
              if (w === Infinity) { return; }
              // A walk about as long as the reading moved is likely; much longer (or shorter) is not.
              sum += b0.p * Math.exp(-Math.abs(w - moveFix) / (C.DETOUR * u));
            });
            // A tiny chance of being somewhere not connected (the dot locked onto the wrong hallway, or GPS was wrong for
            // a while): it only wins after the readings point there clearly for a long time.
            sum += C.UNLINKED * dt;
            next[c.i] = { p: sum * c.like, t: c.tc, x: c.x, y: c.y }; total += next[c.i].p;
          });
        }
        if (total > 0) { st.far = 0; }
        else {
          // Nothing connects to where the dot was: a GPS jump, or you really went somewhere new. Wait a few seconds
          // before believing it, then start again from this reading alone.
          st.far += st.belief ? dt : C.RELOCK_AFTER;
          if (st.far >= C.RELOCK_AFTER - 1e-9) {
            next = {}; total = 0;
            cands.forEach(function (c) { next[c.i] = { p: c.like, t: c.tc, x: c.x, y: c.y }; total += c.like; });
            if (st.belief) { note = 'lost the hallway, looking again'; } else { note = 'found a hallway'; }
            st.seg = -1; st.far = 0;
          } else { next = null; }
        }
        if (next) {
          Object.keys(next).forEach(function (k2) { next[k2].p /= total; if (next[k2].p < 1e-4) { delete next[k2]; } });
          st.belief = next;
          if (st.mode === 'free') { st.mode = 'path'; }
          // 4. Which hallway the dot shows: the best one, but a different one only after it has clearly led for a moment
          // (or straight away if it is the next piece of the same straight hallway, or the old one is out of reach).
          var best = -1;
          Object.keys(next).forEach(function (k2) { if (best < 0 || next[k2].p > next[best].p) { best = +k2; } });
          st.best = best;
          if (st.seg < 0 || !next[st.seg]) { st.seg = best; st.lead = -1; st.leadT = 0; }
          else if (best !== st.seg) {
            if (straightOn(F, st.seg, best, C)) { st.seg = best; st.lead = -1; st.leadT = 0; }
            else {
              st.leadT = st.lead === best && next[best].p >= C.LEAD_RATIO * next[st.seg].p ? st.leadT + dt : (next[best].p >= C.LEAD_RATIO * next[st.seg].p ? dt : 0);
              st.lead = best;
              if (st.leadT >= C.SWITCH_MIN_TIME - 1e-9) { st.seg = best; st.lead = -1; st.leadT = 0; note = note || 'moved to another hallway'; }
            }
          } else { st.lead = -1; st.leadT = 0; }
        }
      } else if (active && st.mode === 'path') {
        // No hallway near this reading. Keep the dot where it is for a while, then let go.
        st.far += dt;
        if (st.far >= C.RELOCK_AFTER - 1e-9) { note = letGo('no hallway near the readings'); }
      }

      // How fast the readings have been moving over the last few seconds (m/s). Someone in a room has mostly stopped;
      // someone walking past it has not. (Later, a phone's step counter can answer this better: see motion().)
      st.hist = (st.hist || []).filter(function (h) { return fix.t - h.t <= C.MOVING_WINDOW * 1000; });
      st.hist.push({ x: p.x, y: p.y, t: fix.t });
      var h0 = st.hist[0], span = (fix.t - h0.t) / 1000;
      var speed = span >= 2 ? Math.hypot(p.x - h0.x, p.y - h0.y) / u / span : 0;
      var walking = speed > C.WALKING_SPEED;

      // 5. Rooms win, after enough time inside one (and stopped) that the dot can reach from its hallway.
      if (active && st.mode !== 'room') {
        var here = st.mode === 'path' && st.belief && st.belief[st.seg] ? st.belief[st.seg] : null, cache2 = {};
        var need = C.ROOM_ENTER * Math.max(1, Math.min(2, sigma / 5)); // poorer GPS: wait longer
        var pick = null;
        F.rooms.forEach(function (room) {
          var dp = depth(p, room.shape) / u;
          var ok = !here || room.segs.some(function (i) { return walkDist(F, st.seg, here.t, i, 0.5, C.NET_RADIUS * u, cache2) < Infinity; });
          var e = st.roomEv[room.id] || 0;
          e = dp > 0 && ok && !walking ? e + dt * Math.min(1, dp / C.ROOM_DEPTH) : Math.max(0, e - (walking && dp > 0 ? 0.5 : 1.5) * dt);
          if (e > 0) { st.roomEv[room.id] = e; } else { delete st.roomEv[room.id]; }
          if (e >= need && (!pick || e > st.roomEv[pick.id])) { pick = room; }
        });
        if (pick) { st.mode = 'room'; st.room = pick; st.roomOut = 0; st.roomEv = {}; note = 'went into ' + pick.name; }
      } else if (st.mode === 'room') {
        st.roomOut = depth(p, st.room.shape) < -C.ROOM_DEPTH * u ? st.roomOut + dt : 0;
        if (st.roomOut >= C.ROOM_LEAVE) {
          // Back out through its door, onto the hallway the door opens onto.
          var back = -1, bq = null;
          st.room.segs.forEach(function (i) { var q = proj(p, F.segs[i].a, F.segs[i].b); if (!bq || q.d < bq.d) { bq = q; back = i; } });
          note = 'came out of ' + st.room.name;
          st.room = null; st.roomOut = 0;
          if (back >= 0) { st.mode = 'path'; st.seg = back; st.belief = {}; st.belief[back] = { p: 1, t: bq.tc, x: bq.x, y: bq.y }; st.lead = -1; st.leadT = 0; } else { letGo(''); }
        }
      }

      // 6. Where the dot should be, then move it there at no more than walking pace.
      var target = p, guess = false, name = '';
      if (st.mode === 'path' && st.seg >= 0) {
        var q2 = proj(p, F.segs[st.seg].a, F.segs[st.seg].b);
        target = { x: q2.x, y: q2.y }; guess = F.segs[st.seg].guess; name = F.segs[st.seg].name;
      } else if (st.mode === 'room') { target = clampInto(p, st.room, 0.6 * u); guess = st.room.guess; name = st.room.name; }
      var moved = 0;
      if (!st.dot) { st.dot = { x: target.x, y: target.y }; }
      else {
        var mx = target.x - st.dot.x, my = target.y - st.dot.y, d = Math.sqrt(mx * mx + my * my), lim = C.MAX_SPEED * Math.max(dt, 0.2) * u;
        var k3 = d > lim ? lim / d : 1;
        st.dot = { x: st.dot.x + mx * k3, y: st.dot.y + my * k3 }; moved = d * k3 / u;
      }
      st.t = fix.t; st.last = p;
      return { x: st.dot.x, y: st.dot.y, mode: st.mode, seg: st.mode === 'path' ? st.seg : -1, room: st.mode === 'room' ? st.room.id : '',
        guess: guess, name: name, raw: { x: p.x, y: p.y }, target: target, best: st.best == null ? -1 : st.best, moved: moved, note: note, sigma: sigma };
    }

    return {
      update: update,
      // Steps and heading from a phone's motion sensors (a native app, later). Stored for now; update() does not use it
      // yet, so callers can start sending it without anything else changing. { t, steps, heading (degrees from north) }
      motion: function (m) { if (st) { st.motion = m; } },
      reset: function () { st = null; },
      state: function () { return st ? { mode: st.mode, seg: st.seg, room: st.room ? st.room.id : '', level: st.level } : null; }
    };
  }

  // Is segment j the next piece of the same straight hallway as segment i (they share an end and point the same way)?
  function straightOn(F, i, j, C) {
    var a = F.segs[i], b = F.segs[j], node = a.na === b.na || a.na === b.nb ? a.na : (a.nb === b.na || a.nb === b.nb ? a.nb : null);
    if (!node) { return false; }
    var da = a.na === node ? -1 : 1, db = b.na === node ? 1 : -1; // both pointing away from... a into node, b out of it
    return (a.ux * da) * (b.ux * db) + (a.uy * da) * (b.uy * db) >= Math.cos(C.STRAIGHT_DEG * Math.PI / 180);
  }

  return { index: index, createTracker: createTracker, defaults: P };
});
