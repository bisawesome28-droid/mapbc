// Simulated walks with noisy indoor GPS, to test core/snap.js (used by tests.js and tools/snap_report.js).
// These are made-up walks, not real measurements: they show whether snapping helps under assumed GPS error, nothing more.
//
// GPS error model (assumed, metres): a slowly drifting offset (indoor GPS errors last tens of seconds, they are not fresh
// every second) plus a little fresh jitter each reading. The phone reports an accuracy around 8 m.
'use strict';
var ML = require('../core/logic.js');
var MSNAP = require('../core/snap.js');

function rng(seed) { // small seeded random numbers, so every run is the same
  var a = seed >>> 0;
  return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function gauss(r) { var u = 0, v = 0; while (u === 0) { u = r(); } v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// A walk along the hallways of one floor, the way people walk: pick somewhere at least 20 m away, take the shortest way
// there, pick somewhere else. Returns { level, truth: [{x, y, t, seg}] } in plan units, one point a second.
function walk(ix, level, opts) {
  var r = rng(opts.seed || 1), F = ix.levels[level], u = ix.upm, speed = (opts.speed || 1.3) * u, secs = opts.seconds || 180;
  if (!F || !F.segs.length) { return null; }
  var nodes = Object.keys(F.at), pos = {};
  F.segs.forEach(function (s) { pos[s.na] = s.a; pos[s.nb] = s.b; });
  function route(from, to) { // shortest way, as a list of [segment, from-node]
    var dist = {}, prev = {}, done = {}; dist[from] = 0;
    for (;;) {
      var n = null; Object.keys(dist).forEach(function (k) { if (!done[k] && (n === null || dist[k] < dist[n])) { n = k; } });
      if (n === null || n === to) { break; }
      done[n] = true;
      F.at[n].forEach(function (i) { var s = F.segs[i], o = s.na === n ? s.nb : s.na, d = dist[n] + s.len; if (dist[o] == null || d < dist[o]) { dist[o] = d; prev[o] = [i, n]; } });
    }
    if (dist[to] == null) { return null; }
    var out = []; for (var k = to; k !== from; k = prev[k][1]) { out.unshift(prev[k]); }
    return out;
  }
  var here = nodes[Math.floor(r() * nodes.length)], legs = [], out = [], carry = 0, t = 0;
  while (out.length < secs) {
    if (!legs.length) {
      var to = null;
      for (var tries = 0; tries < 30 && !to; tries++) { var c = nodes[Math.floor(r() * nodes.length)], q = pos[c], h = pos[here]; if (Math.hypot(q.x - h.x, q.y - h.y) >= 20 * u) { to = c; } }
      var rt = to ? route(here, to) : null;
      if (!rt || !rt.length) { var s0 = F.segs[F.at[here][0]]; rt = [[s0.i, here]]; }
      legs = rt;
    }
    var leg = legs.shift(), s = F.segs[leg[0]], A = s.na === leg[1] ? s.a : s.b, B = s.na === leg[1] ? s.b : s.a;
    for (var d = carry; d < s.len && out.length < secs; d += speed) { out.push({ x: A.x + (B.x - A.x) * d / s.len, y: A.y + (B.y - A.y) * d / s.len, t: (t++) * 1000, seg: s.i }); }
    carry = Math.max(0, d - s.len);
    here = s.na === leg[1] ? s.nb : s.na;
  }
  return { level: level, truth: out };
}

// Noisy readings for a list of true points: { x, y, acc (m), t }.
function noisy(truth, u, opts) {
  var r = rng((opts && opts.seed) || 7), tau = (opts && opts.tau) || 20, sb = (opts && opts.bias) || 4, sw = (opts && opts.jitter) || 2;
  var acc = (opts && opts.acc) || 8, a = Math.exp(-1 / tau), bx = gauss(r) * sb, by = gauss(r) * sb;
  return truth.map(function (p) {
    bx = a * bx + Math.sqrt(1 - a * a) * sb * gauss(r); by = a * by + Math.sqrt(1 - a * a) * sb * gauss(r);
    return { x: p.x + (bx + gauss(r) * sw) * u, y: p.y + (by + gauss(r) * sw) * u, acc: acc * (0.8 + 0.4 * r()), t: p.t };
  });
}

// Runs readings through the page's pipeline: smoothing (createSmoother, as web/app.js uses it), then snapping.
// Returns { before: [{x,y}], after: [{x,y,mode,seg,room}] }.
function run(ix, level, readings, opts) {
  var u = ix.upm, sm = ML.createSmoother({ speed: 1.4 * u }), tr = MSNAP.createTracker(ix, opts);
  var before = [], after = [], nearest = [], F = ix.levels[level];
  readings.forEach(function (q) {
    var s = sm.update(q.x, q.y, Math.max(q.acc, 3) * u, q.t);
    before.push({ x: s.x, y: s.y });
    after.push(tr.update({ x: s.x, y: s.y, acc: q.acc, t: q.t, level: level }));
    // For comparison only: the simplest snap, straight to the nearest hallway line every reading.
    var best = null;
    F.segs.forEach(function (g) { var p = near(s, g); if (!best || p.d < best.d) { best = p; } });
    nearest.push(best ? { x: best.x, y: best.y, target: best } : { x: s.x, y: s.y });
  });
  return { before: before, after: after, nearest: nearest };
}

function near(p, g) {
  var dx = g.b.x - g.a.x, dy = g.b.y - g.a.y, L2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((p.x - g.a.x) * dx + (p.y - g.a.y) * dy) / L2));
  return { x: g.a.x + t * dx, y: g.a.y + t * dy, d: Math.hypot(p.x - g.a.x - t * dx, p.y - g.a.y - t * dy) };
}

// Numbers for one run, in metres. side: distance from the dot to the hallway the walker is really in. wrongHall: share of
// dots more than 3 m from it. offWalk: share of dots more than 1.5 m from every hallway line and not in a room.
// jumps: times a minute the place the dot is heading for leaps more than 4 m in one reading (switching hallway, or
// flipping between two). The dot itself never leaps; this shows how settled it is.
function score(ix, level, truth, pts) {
  var F = ix.levels[level], u = ix.upm, err = [], off = 0, step = 0;
  var side = 0, wrong = 0;
  pts.forEach(function (p, i) {
    err.push(Math.hypot(p.x - truth[i].x, p.y - truth[i].y) / u);
    // Sideways: how far the dot is from the hallway the walker is really in (along-the-hallway error not counted).
    var sd = near(p, F.segs[truth[i].seg]).d / u; side += sd; if (sd > 3) { wrong++; }
    var dh = Infinity; F.segs.forEach(function (s) { var dx = s.b.x - s.a.x, dy = s.b.y - s.a.y, L2 = dx * dx + dy * dy, t = Math.max(0, Math.min(1, ((p.x - s.a.x) * dx + (p.y - s.a.y) * dy) / L2)); dh = Math.min(dh, Math.hypot(p.x - s.a.x - t * dx, p.y - s.a.y - t * dy)); });
    var inRoom = F.rooms.some(function (rm) { return inPoly(p, rm.shape); });
    if (dh / u > 1.5 && !inRoom) { off++; }
    if (i) { step = Math.max(step, Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y) / u); }
  });
  err.sort(function (a, b) { return a - b; });
  var mean = err.reduce(function (a, b) { return a + b; }, 0) / err.length;
  var jumps = 0;
  for (var k = 1; k < pts.length; k++) { var A = pts[k - 1].target || pts[k - 1], B = pts[k].target || pts[k]; if (Math.hypot(B.x - A.x, B.y - A.y) / u > 4) { jumps++; } }
  return { mean: mean, p90: err[Math.floor(err.length * 0.9)], side: side / pts.length, wrongHall: wrong / pts.length, offWalk: off / pts.length, maxStep: step, jumps: jumps / (pts.length / 60) };
}
function inPoly(p, pts) {
  var inside = false;
  for (var i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    var a = pts[i], b = pts[j];
    if ((a[1] > p.y) !== (b[1] > p.y) && p.x < (b[0] - a[0]) * (p.y - a[1]) / (b[1] - a[1]) + a[0]) { inside = !inside; }
  }
  return inside;
}

// Many random walks over every floor of a building: averaged before/after numbers. Walks skip the first 10 s (locking on).
function building(b, opts) {
  var ix = MSNAP.index(b), res = { before: [], after: [], nearest: [], walks: 0 };
  Object.keys(ix.levels).forEach(function (level, li) {
    if (ix.levels[level].segs.length < 3) { return; }
    for (var k = 0; k < ((opts && opts.walks) || 6); k++) {
      var w = walk(ix, level, { seed: 1000 * li + k + 1, seconds: 150 });
      var rd = noisy(w.truth, ix.upm, Object.assign({ seed: 77 * li + k + 3 }, opts && opts.noise));
      var out = run(ix, level, rd, opts && opts.tracker);
      var tr = w.truth.slice(10);
      res.before.push(score(ix, level, tr, out.before.slice(10)));
      res.after.push(score(ix, level, tr, out.after.slice(10)));
      res.nearest.push(score(ix, level, tr, out.nearest.slice(10)));
      res.walks++;
    }
  });
  function avg(list, k) { return list.reduce(function (a, s) { return a + s[k]; }, 0) / list.length; }
  function sum(list) { return { mean: avg(list, 'mean'), p90: avg(list, 'p90'), side: avg(list, 'side'), wrongHall: avg(list, 'wrongHall'), offWalk: avg(list, 'offWalk'), jumps: avg(list, 'jumps'), maxStep: Math.max.apply(null, list.map(function (s) { return s.maxStep; })) }; }
  return { walks: res.walks, before: sum(res.before), after: sum(res.after), nearest: sum(res.nearest) };
}

module.exports = { rng: rng, gauss: gauss, walk: walk, noisy: noisy, run: run, score: score, building: building };
