#!/usr/bin/env python3
"""Places a traced floor plan on the real map by fitting its outline onto OpenStreetMap's building footprints.

This is how Stokes Hall got its GPS corners ("geo" in schools/bc/buildings/stokes.json). It:
  1. downloads a small block of OpenStreetMap map tiles around the building (zoom 19, about 0.2 m per pixel),
  2. finds the building shapes in them (OSM draws buildings in one flat colour),
  3. slides, turns and resizes the traced outline ("outlines" in the building's JSON file) until it overlaps those shapes best,
  4. prints 4 GEO control points and the scale, and saves an overlay picture so you can check the fit by eye.

Needs Python 3 with numpy, scipy and Pillow (pip install numpy scipy pillow), node, and internet access to
tile.openstreetmap.org. Use it rarely and lightly: OpenStreetMap's tile servers are for light use.

Example (Stokes Hall; the seeds are one point inside each wing's footprint, as latitude,longitude):
  python3 tools/fit_plan_to_osm.py --center 42.33426,-71.171274 \
      --seed 42.334597,-71.171139 --seed 42.333923,-71.171349 --out stokes_fit.png

Check the printed overlap (above about 85% is good) and look at the overlay picture before using the points.
"""
import argparse, json, math, os, subprocess, sys, tempfile, urllib.request

import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage, optimize

Z = 19                      # tile zoom level
GRID = 6                    # tiles across and down
BUILDING = (217, 208, 201)  # OpenStreetMap's default building colour
UA = 'mapbc-plan-fit/1.0 (student campus map project)'


def tile_xy(lat, lng):
    n = 2 ** Z
    return (lng + 180) / 360 * n, (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / math.pi) / 2 * n


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--center', required=True, help='lat,lng roughly in the middle of the building')
    ap.add_argument('--seed', action='append', required=True, help='lat,lng inside each part of the building (repeat)')
    ap.add_argument('--level', default='1', help='which floor outlines to use (default 1)')
    ap.add_argument('--data', default=os.path.join(os.path.dirname(__file__), '..', 'schools', 'bc', 'buildings', 'stokes.json'), help='the building file')
    ap.add_argument('--out', default='plan_fit.png', help='overlay picture to check the fit')
    a = ap.parse_args()

    clat, clng = map(float, a.center.split(','))
    cx, cy = tile_xy(clat, clng)
    x0, y0 = int(cx) - GRID // 2, int(cy) - GRID // 2

    # 1. tiles
    cache = os.path.join(tempfile.gettempdir(), 'mapbc_tiles')
    os.makedirs(cache, exist_ok=True)
    mosaic = Image.new('RGB', (256 * GRID, 256 * GRID), 'white')
    for i in range(GRID):
        for j in range(GRID):
            f = os.path.join(cache, '%d_%d_%d.png' % (Z, x0 + i, y0 + j))
            if not os.path.exists(f):
                req = urllib.request.Request('https://tile.openstreetmap.org/%d/%d/%d.png' % (Z, x0 + i, y0 + j), headers={'User-Agent': UA})
                with urllib.request.urlopen(req, timeout=30) as r, open(f, 'wb') as out:
                    out.write(r.read())
            mosaic.paste(Image.open(f).convert('RGB'), (i * 256, j * 256))
    img = np.asarray(mosaic).astype(int)

    def to_px(lat, lng):
        tx, ty = tile_xy(lat, lng)
        return (tx - x0) * 256, (ty - y0) * 256

    def to_latlng(px, py):
        n = 256 * 2 ** Z
        X, Y = x0 * 256 + px, y0 * 256 + py
        return math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * Y / n)))), X / n * 360 - 180

    # 2. the building's footprint: the building-coloured areas that contain a seed point
    mask = np.all(np.abs(img - BUILDING) < 10, axis=2)
    mask = ndimage.binary_closing(mask, iterations=2)
    lab, _ = ndimage.label(mask)
    keep = set()
    for s in a.seed:
        px, py = to_px(*map(float, s.split(',')))
        v = lab[int(py), int(px)]
        if not v:
            sys.exit('Seed %s is not on a building in the map tiles. Move it inside the footprint.' % s)
        keep.add(v)
    target = ndimage.binary_fill_holes(np.isin(lab, list(keep)))

    # 3. the traced outline, and the best move + turn + resize
    with open(a.data) as f:
        bdata = json.load(f)
    outlines = [o['points'] for o in bdata.get('outlines', []) if str(o.get('level', '1')) == a.level and o.get('wing') != 'Bridge']
    allpts = [p for o in outlines for p in o]
    pcx = sum(p[0] for p in allpts) / len(allpts); pcy = sum(p[1] for p in allpts) / len(allpts)

    def place(params, pts):
        tx, ty, ang, s = params
        c, si = math.cos(ang), math.sin(ang)
        return [(tx + s * (c * (x - pcx) - si * (y - pcy)), ty + s * (si * (x - pcx) + c * (y - pcy))) for x, y in pts]

    def miss(params):
        m = Image.new('L', (img.shape[1], img.shape[0]), 0)
        d = ImageDraw.Draw(m)
        for o in outlines:
            d.polygon(place(params, o), fill=1)
        r = np.asarray(m).astype(bool)
        return 1 - (r & target).sum() / max((r | target).sum(), 1)

    ty, tx = ndimage.center_of_mass(target)
    plan_w = max(p[0] for p in allpts) - min(p[0] for p in allpts)
    plan_h = max(p[1] for p in allpts) - min(p[1] for p in allpts)
    rows, cols = np.nonzero(target)
    size0 = math.hypot(cols.max() - cols.min(), rows.max() - rows.min()) / math.hypot(plan_w, plan_h)
    best = None
    for deg in range(-180, 180, 10):                 # try every way round, then polish the best
        for k in (0.85, 1.0, 1.15):
            p = (tx, ty, math.radians(deg), size0 * k)
            l = miss(p)
            if best is None or l < best[0]:
                best = (l, p)
    res = optimize.minimize(miss, best[1], method='Nelder-Mead', options={'xatol': 0.05, 'fatol': 1e-5, 'maxiter': 3000})
    p = res.x
    overlap = 1 - res.fun

    # 4. results
    mpp = 156543.03392 * math.cos(math.radians(clat)) / 2 ** Z   # metres per tile pixel here
    m_per_unit = mpp * p[3]
    # corners: the outline points furthest apart in four directions
    corners = sorted(allpts, key=lambda q: q[0] + q[1])[:1] + sorted(allpts, key=lambda q: q[0] - q[1])[-1:] + \
        sorted(allpts, key=lambda q: q[0] + q[1])[-1:] + sorted(allpts, key=lambda q: q[0] - q[1])[:1]
    points = []
    for x, y in corners:
        (sx, sy), = place(p, [(x, y)])
        lat, lng = to_latlng(sx, sy)
        points.append({'label': 'Outline corner %d, %d' % (x, y), 'x': x, 'y': y, 'lat': round(lat, 7), 'lng': round(lng, 7)})

    print('Overlap with the OpenStreetMap footprint: %d%%  (above about 85%% is good)' % round(overlap * 100))
    print('Scale: %.4f m per plan unit = %.4f ft per plan unit' % (m_per_unit, m_per_unit / 0.3048))
    print('"geo" points for the building file:')
    for q in points:
        print('  ' + json.dumps(q) + ',')

    ov = mosaic.copy()
    d = ImageDraw.Draw(ov, 'RGBA')
    for o in outlines:
        d.polygon(place(p, o), outline=(200, 0, 40, 255), fill=(200, 0, 40, 60))
    rows, cols = np.nonzero(target)
    pad = 60
    ov = ov.crop((max(cols.min() - pad, 0), max(rows.min() - pad, 0), cols.max() + pad, rows.max() + pad))
    ov.save(a.out)
    print('Overlay picture (red = traced plan): ' + a.out)


if __name__ == '__main__':
    main()
