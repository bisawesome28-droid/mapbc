# Map data format

Everything the map shows comes from JSON files in `schools/`. The same files can be read by the web page
and by a future native app. Code lives in `core/` (shared) and `web/` (the web page only).

## Folders
```
schools/index.json            which schools exist and which one opens by default
schools/<school>/school.json  the school: centre, colours, which buildings it has
schools/<school>/campus/      outdoor data: data.json (buildings, walkways, entrances), base.json (grass, roads,
                              trees, houses, heights), extras.json (hand-added entrances and lobbies),
                              categories.json (which kind each building is: academic, library, dining...)
schools/<school>/buildings/   one file per building with an indoor map, e.g. stokes.json, mcelroy.json, oneill.json
```

## Coordinates
- Outdoor: `[longitude, latitude]` (longitude first).
- Indoor plan: `x, y` in plan units, the pixels of the building's posted plan. Stokes is 20.6 units per metre;
  McElroy is 20 per metre; O'Neill about 19.7. `geo.points` ties the plan to latitude and longitude (at least two points, three or four
  is better, and a bad point is flagged by the tests).
- Plans drawn turned: say so in the file's `about` text and use real compass words in names.

## Building file (`buildings/<id>.json`)
| Field | Meaning |
|---|---|
| `id`, `name`, `short`, `osm` | id used in links, display name, short name, OpenStreetMap ids of its footprint(s) |
| `height` | metres for the 3D block (optional) |
| `levels` | floors, bottom to top: `{id, name}`; `"missing": true` marks a floor not mapped yet |
| `defaultLevel` | the floor shown when the building first opens (optional; default: the lowest mapped floor). O'Neill uses "3", its main floor |
| `geo` | GPS control points (see above) |
| `scale` | `feetPerUnit` for walking times |
| `outlines` | outside walls of each floor: `{level, wing, points}` |
| `rooms` | `{id, door, name, type, level, shape, doors, label, keywords, ...}` |
| `fixtures` | small drawn-only rooms (storage, vending): `{level, label, shape}` |
| `entrances` | doors to outside: `{id, name, x, y, level, outdoor?, guess?}` |
| `spots` | 360 photo points |
| `paths` | `{nodes, edges}`: hallway points and the lines between them; `kind` "stair" or "elevator" links floors |

Room `type`: `classroom`, `office`, `service`, `it`, `common`, `conf`, `core` (stairs, elevators, restrooms),
`connector`. Room shape: the room's corners in order. `doors`: points on its walls where people enter.
`useGuess: true` means the name was guessed from the room's size.

## Campus files
`data.json` and `base.json` are written by `tools/osm_to_campus.js` from an OpenStreetMap export
(`schools/<school>/campus/osm_export.geojson`, not committed). Hand additions go in `extras.json`.
A hand-added entrance names its `building` (the OpenStreetMap name). `"wheelchair": "no"` (a stairwell, for example) keeps
step-free routes from using that door; `"guess": true` means not checked on site.

## Building colours
`campus/categories.json` lists building names under `academic`, `library`, `dining`, `garage`, `athletics` and `residence`;
the map colours each kind (colours: `CATEGORIES` in `core/style.js`, the same for every school). A building not listed stays
tan. A building with a floor plan also gets a thin outline in the school's colour. `node tests.js` reports a name that is not
a building in the campus data.
