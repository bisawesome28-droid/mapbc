#!/usr/bin/env python3
"""Downloads campus map data from OpenStreetMap and saves it as campus/osm_export.geojson.

It asks OpenStreetMap's main server (api.openstreetmap.org) for a box of the map, in small squares
(the server refuses big ones), keeps buildings, walking paths, entrances and the campus boundary, and writes GeoJSON in the
same shape as an Overpass Turbo export. Then turn it into campus/data.js with:

  python3 tools/fetch_osm.py                      # the default box is Boston College's Chestnut Hill campus
  node tools/osm_to_campus.js campus/osm_export.geojson

Another campus: python3 tools/fetch_osm.py --bbox south,west,north,east   (latitudes and longitudes)
Only needs Python 3 (no extra packages). Please run it rarely: the server is shared by everyone.
OpenStreetMap data is (c) OpenStreetMap contributors, ODbL. Keep the credit on the map.
"""
import argparse, json, math, os, sys, time, urllib.request
import xml.etree.ElementTree as ET

API = 'https://api.openstreetmap.org/api/0.6/map?bbox={w},{s},{e},{n}'
UA = 'mapbc-campus-import/1.0 (student campus map project)'
STEP = 0.004  # degrees per square; small enough to stay under the server's limits
BC = (42.3300, -71.1790, 42.3430, -71.1595)  # south, west, north, east


def fetch(s, w, n, e):
    req = urllib.request.Request(API.format(s=s, w=w, n=n, e=e), headers={'User-Agent': UA})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception as err:  # network hiccup or "too busy": wait and try again
            if attempt == 3:
                raise
            print('  retrying after: %s' % err)
            time.sleep(2 ** attempt * 2)


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--bbox', help='south,west,north,east (default: Boston College Chestnut Hill)')
    ap.add_argument('--out', default=os.path.join(os.path.dirname(__file__), '..', 'campus', 'osm_export.geojson'))
    a = ap.parse_args()
    s0, w0, n0, e0 = map(float, a.bbox.split(',')) if a.bbox else BC

    nodes, ways, rels = {}, {}, {}
    rows, cols = math.ceil((n0 - s0) / STEP), math.ceil((e0 - w0) / STEP)
    for i in range(rows):
        for j in range(cols):
            s, w = s0 + i * STEP, w0 + j * STEP
            n, e = min(s + STEP, n0), min(w + STEP, e0)
            print('Square %d of %d' % (i * cols + j + 1, rows * cols))
            root = ET.fromstring(fetch(round(s, 6), round(w, 6), round(n, 6), round(e, 6)))
            for el in root:
                tags = {t.get('k'): t.get('v') for t in el.findall('tag')}
                if el.tag == 'node':
                    nodes[el.get('id')] = (float(el.get('lon')), float(el.get('lat')), tags)
                elif el.tag == 'way':
                    ways[el.get('id')] = ([nd.get('ref') for nd in el.findall('nd')], tags)
                elif el.tag == 'relation':
                    rels[el.get('id')] = ([(m.get('type'), m.get('ref'), m.get('role')) for m in el.findall('member')], tags)
            time.sleep(1)  # be gentle with the shared server

    def coords(refs):
        return [[nodes[r][0], nodes[r][1]] for r in refs if r in nodes]

    def join_rings(parts):
        # Joins way pieces that share end points into closed rings (how multipolygon outlines are stored).
        parts = [p[:] for p in parts if len(p) > 1]
        rings = []
        while parts:
            ring = parts.pop(0)
            changed = True
            while ring[0] != ring[-1] and changed:
                changed = False
                for k, p in enumerate(parts):
                    if p[0] == ring[-1]: ring += p[1:]
                    elif p[-1] == ring[-1]: ring += p[::-1][1:]
                    elif p[-1] == ring[0]: ring = p[:-1] + ring
                    elif p[0] == ring[0]: ring = p[::-1][:-1] + ring
                    else: continue
                    parts.pop(k); changed = True; break
            if ring[0] == ring[-1] and len(ring) >= 4:
                rings.append(ring)
        return rings

    feats = []
    for wid, (refs, tags) in ways.items():
        c = coords(refs)
        if len(c) < 2:
            continue
        if 'building' in tags and len(c) >= 4 and refs[0] == refs[-1]:
            feats.append({'type': 'Feature', 'id': 'way/' + wid, 'properties': tags, 'geometry': {'type': 'Polygon', 'coordinates': [c]}})
        elif tags.get('amenity') in ('university', 'college') and refs[0] == refs[-1] and len(c) >= 4:
            feats.append({'type': 'Feature', 'id': 'way/' + wid, 'properties': tags, 'geometry': {'type': 'Polygon', 'coordinates': [c]}})
        elif 'highway' in tags:
            feats.append({'type': 'Feature', 'id': 'way/' + wid, 'properties': tags, 'geometry': {'type': 'LineString', 'coordinates': c}})
    for rid, (members, tags) in rels.items():
        campus = tags.get('amenity') in ('university', 'college')
        if ('building' not in tags and not campus) or tags.get('type') != 'multipolygon':
            continue
        outer = join_rings([coords(ways[ref][0]) for t, ref, role in members if t == 'way' and role in ('outer', '') and ref in ways])
        inner = join_rings([coords(ways[ref][0]) for t, ref, role in members if t == 'way' and role == 'inner' and ref in ways])
        if outer:
            geom = {'type': 'Polygon', 'coordinates': [outer[0]] + inner} if len(outer) == 1 else {'type': 'MultiPolygon', 'coordinates': [[r] for r in outer]}
            feats.append({'type': 'Feature', 'id': 'relation/' + rid, 'properties': tags, 'geometry': geom})
    for nid, (lon, lat, tags) in nodes.items():
        if 'entrance' in tags:
            feats.append({'type': 'Feature', 'id': 'node/' + nid, 'properties': tags, 'geometry': {'type': 'Point', 'coordinates': [lon, lat]}})

    with open(a.out, 'w') as f:
        json.dump({'type': 'FeatureCollection', 'features': feats}, f)
    print('Saved %d features to %s' % (len(feats), a.out))
    print('Next: node tools/osm_to_campus.js ' + os.path.relpath(a.out))


if __name__ == '__main__':
    main()
