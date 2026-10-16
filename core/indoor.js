// Turns a building's floor plan (its JSON file, in plan units) into map features (GeoJSON, in longitude and latitude),
// so the plan is drawn by the map itself: the same features and the same style (core/style.js) work in the browser and in
// a native app (MapLibre on iOS and Android reads the same format).
//
// No drawing code and no browser code here: it only makes shapes. Seating rows, stair treads, elevator cars, door swings
// and restroom symbols are made from simple rules ("seating", "stair", "cars", "restroom" on a room). They show what kind
// of room it is, not the exact furniture.
//
// Every feature has: b (building id), lvl (level id), k (what it is). Line features also have w: their width in metres,
// so lines grow and shrink with the map like the walls they are. See docs/DATA_FORMAT.md for the building file.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) { module.exports = api; }
  else { root.MapIndoor = api; }
})(this, function () {

  // The drawing rules were made on the Stokes Hall plan, where one plan unit is about 1/20.6 of a metre.
  // Sizes below are in those units and are converted for each building, so every building is drawn at the same real size.
  var STOKES_UNITS_PER_METER = 20.58;
  var WIDTH = { // line widths, in Stokes plan units
    wall: 12, room: 3, partition: 2, fixture: 3, // wall, room and fixture outlines are drawn by core/style.js from the shapes
    doorGap: 7, doorLeaf: 2.5, doorArc: 1.5, entryGap: 16,
    row: 4.5, board: 4, table: 4, tread: 1.6, arrow: 2.5, car: 2
  };

  function lv(o) { return String(o.level == null ? '1' : o.level); }

  function boxOf(pts) {
    var b = [Infinity, Infinity, -Infinity, -Infinity];
    pts.forEach(function (p) { b[0] = Math.min(b[0], p[0]); b[1] = Math.min(b[1], p[1]); b[2] = Math.max(b[2], p[0]); b[3] = Math.max(b[3], p[1]); });
    return { x: b[0], y: b[1], w: b[2] - b[0], h: b[3] - b[1] };
  }

  // Closest wall of a polygon to a point: the foot point, the wall direction and the normal pointing into the polygon.
  function nearestWall(poly, p) {
    var best = null, cx = 0, cy = 0;
    poly.forEach(function (q) { cx += q[0] / poly.length; cy += q[1] / poly.length; });
    for (var i = 0; i < poly.length; i++) {
      var a = poly[i], b = poly[(i + 1) % poly.length];
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
      if (!len) { continue; }
      var t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (len * len)));
      var fx = a[0] + t * dx, fy = a[1] + t * dy, d = Math.hypot(p[0] - fx, p[1] - fy);
      if (!best || d < best.d) {
        var ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
        if ((cx - fx) * nx + (cy - fy) * ny < 0) { nx = -nx; ny = -ny; }
        best = { d: d, x: fx, y: fy, ux: ux, uy: uy, nx: nx, ny: ny };
      }
    }
    return best;
  }

  function circle(cx, cy, r, n) {
    var out = [];
    for (var i = 0; i < (n || 14); i++) { var a = i / (n || 14) * 2 * Math.PI; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
    return out;
  }

  // Makes the features of one building. b: the building, after School.prepare (it needs b.toLngLat and b.unitsPerMeter).
  // Returns a GeoJSON FeatureCollection.
  function features(b) {
    var out = [], s = b.unitsPerMeter / STOKES_UNITS_PER_METER; // plan units per Stokes unit
    var meters = function (stokesUnits) { return Math.round(stokesUnits / STOKES_UNITS_PER_METER * 1000) / 1000; };
    var ll = function (p) { return b.toLngLat(p[0], p[1]); };
    function add(type, coords, props) {
      props.b = b.id;
      out.push({ type: 'Feature', properties: props, geometry: { type: type, coordinates: coords } });
    }
    function poly(pts, props) { var r = pts.map(ll); r.push(r[0]); add('Polygon', [r], props); }
    function line(pts, props, width) { props.w = meters(width); add('LineString', pts.map(ll), props); }
    function point(p, props) { add('Point', ll(p), props); }

    var outlines = b.outlines || [];
    var piers = !(b.style && b.style.piers === false);

    // Floors and outside walls. The wall is the outline drawn as a thick line; rooms are drawn over its inner half.
    outlines.forEach(function (o) {
      var L = lv(o);
      if (piers && o.wing !== 'Bridge' && !o.bridge) { pierShapes(o.points, s).forEach(function (p) { poly(p, { lvl: L, k: 'pier' }); }); }
      poly(o.points, { lvl: L, k: 'floor', guess: !!o.guess });
    });
    (b.pillars || []).forEach(function (g) {
      g.points.forEach(function (p) {
        var r = 10 * s;
        poly([[p[0] - r, p[1] - r], [p[0] + r, p[1] - r], [p[0] + r, p[1] + r], [p[0] - r, p[1] + r]], { lvl: lv(g), k: 'pillar' });
      });
    });
    (b.labels || []).forEach(function (t) { point([t.x, t.y], { lvl: lv(t), k: 'label', text: t.text, kind: t.kind || '' }); });

    // Small rooms that are drawn but not searchable (storage, vending...).
    (b.fixtures || []).forEach(function (fx) {
      var L = lv(fx), bx = boxOf(fx.shape);
      poly(fx.shape, { lvl: L, k: 'fixture' });
      point([bx.x + bx.w / 2, bx.y + bx.h / 2], { lvl: L, k: 'fixture-label', text: fx.label });
    });

    (b.rooms || []).forEach(function (r) {
      var L = lv(r), bx = boxOf(r.shape), key = b.id + '/' + r.id, base = { lvl: L, rid: r.id, key: key, type: r.type };
      var P = function (extra) { var p = { lvl: L, rid: r.id, key: key, type: r.type }; for (var k in extra) { p[k] = extra[k]; } return p; };
      // The room's own walls are its shape drawn as a line (core/style.js), so they are not stored twice.
      poly(r.shape, P({ k: 'room', guess: !!r.useGuess }));
      (r.partitions || []).forEach(function (q) { line([[q[0], q[1]], [q[2], q[3]]], P({ k: 'partition' }), WIDTH.partition); });
      if (r.seating && r.doors && r.doors.length) { seating(r, bx, s, P, line, poly); }
      if (r.stair) { stair(bx, s, P, line, poly); }
      if (r.cars) {
        r.cars.forEach(function (c) {
          var x = c[0] + 5 * s, y = c[1] + 5 * s, w = c[2] - 10 * s, hh = c[3] - 10 * s;
          line([[x, y], [x + w, y], [x + w, y + hh], [x, y + hh], [x, y]], P({ k: 'furn' }), WIDTH.car);
          line([[x, y], [x + w, y + hh]], P({ k: 'furn' }), WIDTH.car);
          line([[x + w, y], [x, y + hh]], P({ k: 'furn' }), WIDTH.car);
        });
      }
      if (r.restroom) {
        var cx = bx.x + bx.w / 2, cy = bx.y + bx.h / 2 + 26 * s;
        [-12, 12].forEach(function (dx, i) {
          var x0 = cx + dx * s;
          poly(circle(x0, cy - 14 * s, 4.5 * s, 10), P({ k: 'wc' }));
          poly(i ? [[x0 - 7 * s, cy + 10 * s], [x0, cy - 8 * s], [x0 + 7 * s, cy + 10 * s]]
                 : [[x0 - 5 * s, cy - 8 * s], [x0 + 5 * s, cy - 8 * s], [x0 + 5 * s, cy + 10 * s], [x0 - 5 * s, cy + 10 * s]], P({ k: 'wc' }));
        });
      }
      var tiny = bx.w < 70 * s || bx.h < 45 * s;
      point([bx.x + bx.w / 2, bx.y + bx.h / 2 - (r.restroom ? 14 * s : 0)], P({ k: 'room-label', text: String(r.door || r.label || r.id), tiny: tiny }));
      // Doors: a gap in the wall, the door leaf, and its swing. Small offices get a smaller door.
      var side = Math.min(bx.w, bx.h) / s, dw = Math.max(12, Math.min(22, Math.round(side * 0.28))) * s;
      (r.doors || []).forEach(function (d) { door(r.shape, d, dw, base, line); });
    });

    // Entrances: a wide gap in the outside wall of the entrance's own floor, and a marker.
    (b.entrances || []).forEach(function (en) {
      var best = null;
      outlines.forEach(function (o) {
        if (lv(o) !== lv(en)) { return; }
        var w = nearestWall(o.points, [en.x, en.y]); if (w && (!best || w.d < best.d)) { best = w; }
      });
      if (best && best.d < 40 * s) {
        line([[best.x - best.ux * 20 * s, best.y - best.uy * 20 * s], [best.x + best.ux * 20 * s, best.y + best.uy * 20 * s]], { lvl: lv(en), k: 'entry-gap' }, WIDTH.entryGap);
      }
      point([en.x, en.y], { lvl: lv(en), k: 'entrance', eid: en.id, name: en.name, guess: !!en.guess });
    });
    (b.spots || []).forEach(function (sp) { point([sp.x, sp.y], { lvl: lv(sp), k: 'spot', sid: sp.id, name: sp.label }); });

    return { type: 'FeatureCollection', features: out };
  }

  // A door: a gap in the wall, the door leaf (hinged at one end of the gap), and its quarter-circle swing.
  function door(shape, p, width, base, line) {
    var w = nearestWall(shape, p);
    if (!w || w.d > 3) { return; }
    var hw = width / 2;
    var h = [w.x - w.ux * hw, w.y - w.uy * hw], e = [w.x + w.ux * hw, w.y + w.uy * hw];
    var tip = [h[0] + w.nx * width, h[1] + w.ny * width];
    var props = function (k) { return { lvl: base.lvl, rid: base.rid, key: base.key, type: base.type, k: k }; };
    line([h, e], props('door-gap'), WIDTH.doorGap);
    line([h, tip], props('door-leaf'), WIDTH.doorLeaf);
    var a0 = Math.atan2(tip[1] - h[1], tip[0] - h[0]), a1 = Math.atan2(e[1] - h[1], e[0] - h[0]), da = a1 - a0;
    while (da > Math.PI) { da -= 2 * Math.PI; } while (da < -Math.PI) { da += 2 * Math.PI; }
    var arc = [];
    for (var i = 0; i <= 8; i++) { var a = a0 + da * i / 8; arc.push([h[0] + width * Math.cos(a), h[1] + width * Math.sin(a)]); }
    line(arc, props('door-arc'), WIDTH.doorArc);
  }

  // Buttresses: small stone piers sticking out of the long outside walls.
  function pierShapes(poly, sc) {
    var out = [], area = 0;
    for (var i = 0; i < poly.length; i++) { var a = poly[i], b = poly[(i + 1) % poly.length]; area += a[0] * b[1] - b[0] * a[1]; }
    for (var k = 0; k < poly.length; k++) {
      var p = poly[k], q = poly[(k + 1) % poly.length];
      var dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy);
      if (len < 150 * sc) { continue; }
      var ux = dx / len, uy = dy / len, nx = area > 0 ? uy : -uy, ny = area > 0 ? -ux : ux;
      var n = Math.floor((len - 60 * sc) / (78 * sc));
      for (var j = 0; j <= n; j++) {
        var s = 30 * sc + (len - 60 * sc) * (n ? j / n : 0.5), cx = p[0] + ux * s, cy = p[1] + uy * s;
        var a1 = 10 * sc, a2 = 8 * sc, o = 13 * sc;
        out.push([[cx - ux * a1, cy - uy * a1], [cx + ux * a1, cy + uy * a1], [cx + ux * a2 + nx * o, cy + uy * a2 + ny * o], [cx - ux * a2 + nx * o, cy - uy * a2 + ny * o]]);
      }
    }
    return out;
  }

  // Which side of the room its first door is on. The front of a classroom is the far side.
  function doorSide(bx, d) {
    var sides = { top: Math.abs(d[1] - bx.y), bottom: Math.abs(d[1] - (bx.y + bx.h)), left: Math.abs(d[0] - bx.x), right: Math.abs(d[0] - (bx.x + bx.w)) };
    return Object.keys(sides).sort(function (a, c) { return sides[a] - sides[c]; })[0];
  }

  // Classroom furniture: a board on the teaching wall, then rows of seats (curved for tiered rooms) or one big table.
  function seating(r, b, s, P, line, poly) {
    var side = doorSide(b, r.doors[0]);
    var vertical = side === 'top' || side === 'bottom';
    var a0 = vertical ? b.x : b.y, a1 = vertical ? b.x + b.w : b.y + b.h;
    var front = { top: b.y + b.h, bottom: b.y, left: b.x + b.w, right: b.x }[side];
    var back = { top: b.y, bottom: b.y + b.h, left: b.x, right: b.x + b.w }[side];
    var dir = back > front ? 1 : -1, depth = Math.abs(back - front);
    var at = function (across, d) { var v = front + dir * d; return vertical ? [across, v] : [v, across]; };
    var span = a1 - a0, m = span * 0.13, mid = (a0 + a1) / 2;
    line([at(mid - span * 0.22, 7 * s), at(mid + span * 0.22, 7 * s)], P({ k: 'furn' }), WIDTH.board);
    if (r.seating === 'table') {
      var t0 = at(a0 + span * 0.24, depth * 0.3), t1 = at(a1 - span * 0.24, depth * 0.78);
      var x0 = Math.min(t0[0], t1[0]), y0 = Math.min(t0[1], t1[1]), x1 = Math.max(t0[0], t1[0]), y1 = Math.max(t0[1], t1[1]);
      line([[x0, y0], [x1, y0], [x1, y1], [x0, y1], [x0, y0]], P({ k: 'furn' }), WIDTH.table);
      return;
    }
    var desk = at(mid, depth * 0.16);
    poly(circle(desk[0], desk[1], 6 * s, 10), P({ k: 'furn-fill' }));
    var start = depth * 0.3, stop = depth * 0.9, gap = 24 * s, rows = Math.max(2, Math.floor((stop - start) / gap));
    for (var i = 0; i <= rows; i++) {
      var dd = start + (stop - start) * i / rows;
      if (r.seating === 'tiered') {
        var bow = (10 + i * 1.5) * s, p0 = at(a0 + m, dd - bow), c = at(mid, dd + bow), p1 = at(a1 - m, dd - bow), pts = [];
        for (var t = 0; t <= 10; t++) {
          var u = t / 10;
          pts.push([(1 - u) * (1 - u) * p0[0] + 2 * (1 - u) * u * c[0] + u * u * p1[0], (1 - u) * (1 - u) * p0[1] + 2 * (1 - u) * u * c[1] + u * u * p1[1]]);
        }
        line(pts, P({ k: 'furn' }), WIDTH.row);
      } else {
        var aisle = span * 0.06;
        line([at(a0 + m, dd), at(mid - aisle, dd)], P({ k: 'furn' }), WIDTH.row);
        line([at(mid + aisle, dd), at(a1 - m, dd)], P({ k: 'furn' }), WIDTH.row);
      }
    }
  }

  // Stair treads across the long side, and an arrow going up.
  function stair(b, s, P, line, poly) {
    var long = b.w > b.h, n = Math.floor((long ? b.w : b.h) * 0.8 / (11 * s));
    for (var i = 0; i <= n; i++) {
      var v = (long ? b.x + b.w * 0.1 : b.y + b.h * 0.1) + i * 11 * s;
      line(long ? [[v, b.y + 6 * s], [v, b.y + b.h - 6 * s]] : [[b.x + 6 * s, v], [b.x + b.w - 6 * s, v]], P({ k: 'furn' }), WIDTH.tread);
    }
    var a = long ? [b.x + b.w * 0.12, b.y + b.h / 2, b.x + b.w * 0.88, b.y + b.h / 2] : [b.x + b.w / 2, b.y + b.h * 0.88, b.x + b.w / 2, b.y + b.h * 0.12];
    line([[a[0], a[1]], [a[2], a[3]]], P({ k: 'furn' }), WIDTH.arrow);
    var dx = a[2] - a[0], dy = a[3] - a[1], len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
    var tip = [a[2] + ux * 5 * s, a[3] + uy * 5 * s], back = [tip[0] - ux * 12.5 * s, tip[1] - uy * 12.5 * s], hw = 6.25 * s;
    poly([tip, [back[0] - uy * hw, back[1] + ux * hw], [back[0] + uy * hw, back[1] - ux * hw]], P({ k: 'furn-fill' }));
  }

  return { features: features, nearestWall: nearestWall, boxOf: boxOf, lv: lv, STOKES_UNITS_PER_METER: STOKES_UNITS_PER_METER };
});
