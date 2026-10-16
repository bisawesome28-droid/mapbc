# BC Campus Map: handoff notes

## Read this first: what the latest session did (Oct 15, 2026)
Branch `campus-map` holds everything from this session (it includes the earlier `gps-blue-dot` branch, merged in). Check out
this branch. `node tests.js` should say 53 passed, 0 failed. Three pieces of work were added on top of the Stokes Level 1 indoor map:

1. **GPS blue dot inside the indoor map (index.html).** A crosshair "Locate me" button, a blue dot with an accuracy ring, and a
   "Start there" prompt for the nearest entrance. Built, tested in a headless browser with a pretend location, **never tested with
   real GPS on a phone**, and **not usable until calibrated** (see "GPS blue dot" below).
2. **Outdoor campus map (campus.html).** A MapLibre map of the campus with building search, tap-a-building, an "Open indoor map" button,
   entrances, walking paths and the phone's own blue dot. **It has no BC data yet**: the three data files are empty placeholders.
   The data comes from an OpenStreetMap export that the owner has to run himself (details below).
3. **OSM import tool (tools/osm_to_campus.js).** Turns that export into the three data files and prints a coverage report.

### Who and why
Brandon (BC student) and a friend are building a campus map app. The goal: a big outdoor campus map, tap into a building to see its
indoor floor plans, accurate names, search, routing, and eventually which floor you are on. They want it to scale to other colleges
and plan to pitch schools to supply their own floor plans. Stokes Hall Level 1 is the proof of concept. They plan a real app later
(a website is fine for now). Indoor content is a basic layout (room numbers, stairs, elevators, accessibility), no emergency content.

### New files
- `campus.html`: the outdoor map page. Loads MapLibre GL JS 5 from unpkg.com, reads `campus/config.js` and the three `campus/*.geojson` files with `fetch`.
  It must be served over http (`python3 -m http.server 8000`, then http://localhost:8000/campus.html). It will not load data from `file://` and says so on screen.
- `campus/config.js`: `window.CAMPUS` with `center` as **[longitude, latitude]**, `zoom`, `indoor` (building name to indoor page, matched by name, case-insensitive, partial is fine), `basemap`.
- `campus/buildings.geojson`, `paths.geojson`, `entrances.geojson`: empty FeatureCollections until the import is run. Properties are written by the import (see the tool header), plus `uid` and `hasIndoor` added by the page at load.
- `campus/README.md`: the step-by-step for the owner (Overpass Turbo export, import, run, fix data, before-launch checklist).
- `tools/osm_to_campus.js`: `node tools/osm_to_campus.js campus/osm_export.geojson`. Exports `convert()` so tests can call it.
- Changed: `logic.js` (GPS functions), `index.html` (locate button, blue dot, `?sim=1`), `data.js` (empty `window.GEO`), `tests.js` (15 new tests).

### How the pieces work
- **Indoor coordinates vs real coordinates.** The indoor plan is a picture. `data.js` x/y are pixel positions on the brochure image (2722 x 1812), not
  lat/lng. Everything outdoors (GeoJSON, MapLibre, GPS) is lat/lng, and GeoJSON order is **[lng, lat]**. Mixing these up is the most likely bug.
  `window.GEO.points` in data.js are control points with both (`x`, `y`, `lat`, `lng`) that connect the two worlds.
- **`ML.fitGeo(points)` (logic.js).** Least-squares fit of a move + turn + resize (no stretching, since the plan is drawn to scale) from 2 or more control points.
  Returns `toMap(lat,lng)`, `toGeo(x,y)`, `unitsPerMeter`, `rotationDeg`, and with 3+ points `rmsMeters`, `worstMeters`, `worstIndex` (to spot a typo). Returns null for fewer than 2 usable points.
- **`ML.createSmoother({speed})`.** Accuracy-weighted smoothing of GPS readings in map units. A reading with a small error moves the dot a lot, a poor one barely moves it,
  and the allowed drift grows with time since the last reading (speed = walking pace in map units per second).
- **`ML.describeFix(pos, ctx)`.** Given `{x,y,accuracy(m)}` and `{metersPerUnit, bounds, entrances}`, returns the ring radius in map units, whether you are on the plan,
  how far off it you are, and the nearest entrance. The page's "Start there" prompt uses this.
- **Indoor dot behaviour (index.html).** `watchPosition` feeds `onFix`, which converts with `geo.toMap`, smooths, then `setYou`. The dot shows only on Level 1 (`you.level` is hard-coded to "1"
  because GPS cannot tell floors apart). Outside the plan it says how far away you are and draws nothing. If `geo` is null the button explains that the map is not calibrated.
  `?sim=1` lets you tap the map to place a pretend location (accuracy fixed at 8 m) and needs no GPS or calibration. This is what the headless test used.
- **Outdoor blue dot (campus.html)** is MapLibre's built-in `GeolocateControl`. It works from lat/lng directly and needs no calibration. It is separate from the indoor dot on purpose.
- **Outdoor to indoor handoff.** Tapping a building whose name matches a key in `CAMPUS.indoor` shows "Open indoor map", which just links to that page. Matching buildings are drawn maroon.
- **The importer** keeps polygons with a `building` tag, line features whose `highway` is walkable (roads for cars are dropped), and points with an `entrance` tag. It rounds to 7 decimals,
  sorts named buildings first, and prints how many buildings are unnamed and how few entrances exist.

### What is verified, and what is not
Verified: `node tests.js` (53 pass). The indoor page in headless Chromium with `?sim=1` (dot, ring, nearest-entrance prompt, level 2 hides the dot, Hide clears it).
`campus.html` in headless Chromium with made-up buildings (search, select, open-indoor button, close, entrance dot, dashed steps, geolocate button present, phone width layout).
Not verified: real GPS on a phone, any real BC data, whether OpenStreetMap tiles and the demo font server load for real users (the sandbox had no access to them, so the
screenshots had a blank base map), how complete OpenStreetMap is for BC, and the campus center in `config.js` (an approximate guess, about 42.3355, -71.1685).
The sandbox could not reach OpenStreetMap's data services (Overpass and Nominatim refuse automated fetches), which is why the owner runs the export himself.

### Suggested next tasks (roughly in order)
1. **Import the data.** Owner runs the Overpass export, then `node tools/osm_to_campus.js ...`. Read the report and decide what to fix. Fix names, missing entrances and paths in the geojson files
   (or in OpenStreetMap itself). Expect entrances to be sparse. BC is hilly, so record `incline` and `steps` where known.
2. **Calibrate GPS for Stokes.** Fill `GEO.points` with 3 or 4 far-apart corners from the list in "GPS blue dot" below. Run `node tests.js` and fix any point it flags. Then walk outside Stokes on an https page and check the dot.
   The fitted scale also fixes the guessed `SCALE.feetPerUnit` (the test compares them once `SCALE.guess` is false).
3. **Show the Stokes plan on the campus map.** With calibration done, write a small script that converts the Stokes outlines and room shapes to GeoJSON using `fitGeo(...).toGeo`,
   and draw them in campus.html when zoomed in (hide the plain building polygon then). This is how every indoor map should join the outdoor one, so make the script generic per building.
4. **Outdoor routing.** Build a graph from `paths.geojson` and `entrances.geojson` and reuse the search in `logic.js`. Note `buildGraph` and `shortest` assume map units, so use
   metres (haversine) for lat/lng data. Join outdoor and indoor at entrances (an entrance id in both worlds). Add a step-free option using `steps`, `incline`, `wheelchair`.
5. **Floor detection** (discussed, not built). Plan: barometer for relative floor change, reset at entrances that have a known floor (BC buildings can have entrances on different levels, so tag the floor per entrance),
   use accelerometer to confirm stairs or an elevator ride, and ask the user to confirm when unsure. Wi-Fi fingerprinting only works on Android (iOS blocks Wi-Fi scans). Beacons need hardware, which hurts the scale-to-any-college goal.
6. **Before real users:** replace the OpenStreetMap public tiles (their policy is for light use), for example with self-hosted Protomaps/PMTiles; bundle MapLibre instead of loading from unpkg; add dark mode to campus.html; keep the OpenStreetMap credit.

### Gotchas
- `tests.js` creates a fake `window` and `require`s `data.js` and `campus/config.js`. New data files should write to `window.*` the same way, and `logic.js` has no DOM code, so keep it that way.
- Lat/lng order differs between tools: GeoJSON and MapLibre use [lng, lat], Google Maps shows lat, lng, and `GEO.points` uses named `lat` and `lng`. A test checks that `CAMPUS.center` is plausible for Massachusetts.
- Re-running the importer overwrites the three geojson files, so hand edits should come after the import is final.
- The brochure image is not in the repo on purpose (see "Current state").
- The owner prefers plain, direct explanations organized under clear headings.

## What's here
- index.html: the map page, drawn like an architect's floor plan (walls, doors, stairs, seating). Open it in a browser. No server or build step needed.
- data.js: everything the map shows (rooms, doors, entrances, hallway network). Most changes happen here.
- logic.js: search and route finding. Shared by the page and the tests.
- tests.js: run `node tests.js` to check search and routing. Run it after every data.js edit.
- rooms.csv: spreadsheet template for real room data (door numbers, landmarks, verified flag).
- pipeline_prototype/: optional prototype that finds rooms in a color-coded floor plan image.
- campus.html, campus/, tools/: the outdoor campus map and the OpenStreetMap import (see "Read this first" above).

## What works now
- Search a room (placeholder id, real room number, or words like "restrooms"). It highlights and zooms in.
- "I'm entering from..." picks an entrance. Entrances are the green IN markers. Tapping one picks it too.
- With a room and an entrance chosen, the map draws the shortest route and lists the steps.
- "Accessible route" skips anything marked as steps or stairs. Level 1 has none marked yet, so for now it gives the same route.
- "Show path network" draws every hallway line. Orange dashes = guessed, grey = clear on the brochure.
- Links like `index.html?from=E-S-WEST&room=S03` open straight to a route (could become QR codes at entrances).
- The page remembers the last entrance on that device.
- Turn-by-turn steps ("Turn left toward ...") with distance in feet and a walking-time estimate.
- "Nearest" buttons (Restrooms, Elevators, Cafe, Advising) pick the closest match from the chosen entrance.
- Works on phones (pinch to zoom) and has a light/dark switch.

## Current state
- Room ids S01-S11 and N01-N08 are placeholders. Do not change "id". Put the real number in "door". BC writes Stokes rooms as number + wing letter, for example "door": "195S". Search, labels and routes pick it up.
- The plan is traced from the Stokes Level 1 brochure at full size (2722 x 1812 pixels). Map coordinates in data.js are pixel positions on that image, so you can check any point by opening the image. Don't publish the brochure image. It is ignored by git (keep it in reference/stokes-level1-brochure.png).
- Level 1 has no indoor link between the wings. The architect describes the enclosed bridge as being on Level 2, with walkways at ground level, so routes between wings go outside and the page says so.
- Seating rows, stair treads, elevator X marks and restroom symbols are drawn from simple rules ("seating", "stair", "cars", "restroom" in data.js). They show the kind of room, not exact furniture.
- All door positions are guesses. Hallways marked "guess": true need checking on site.

## GPS blue dot ("Locate me")
The crosshair button above the zoom buttons shows where you are on the plan, with a ring for how far off the GPS might be.
- It asks the phone for its position, turns latitude/longitude into a map spot, smooths out the jumps, and draws the dot.
- It also names the nearest entrance and offers a "Start there" button that sets "I'm entering from".
- Outside the plan it says how far away you are instead. The plan only covers Stokes, so there is no outdoor map to draw the dot on yet.
- GPS cannot tell floors apart, so the dot shows on Level 1 only. Floor detection (barometer) is a separate step.
- Nothing is saved or sent anywhere. Location only works on an https page (or localhost), not when the file is opened straight from disk.

**It needs calibrating before it works for real.** `window.GEO` in data.js is empty. Add 3 or 4 control points: spots on the plan whose
real latitude/longitude you look up on a satellite map (Google Maps: right-click the building corner, click the numbers to copy).
Pick corners far apart. These outside-wall corners from OUTLINES work well:
- South wing, west end: x 61, y 364
- South wing, north bump: x 1207, y 118
- North wing, north-east corner: x 2280, y 680
- North wing, south end: x 1975, y 1750

Then add them like this, and run `node tests.js`. It reports how far the points miss on average and which one is probably a typo:
`{"label": "South wing, west end", "x": 61, "y": 364, "lat": 0.0, "lng": 0.0}` (use the real numbers).
The fitted scale also gives a real feet-per-unit. Once it looks right, compare it with SCALE (above) and fix that too.

**Trying it without calibration:** open the page with `?sim=1` on the end, press the crosshair, then tap the map to place a pretend location.
This tests the dot, the ring and the nearest-entrance prompt from a desk. Press the crosshair again to stop placing (the dot stays), or "Hide" to clear it.

## Floors (levels)
- `window.LEVELS` in data.js lists the floors. Anything without a `"level"` is on Level 1.
- Level 2 is a placeholder for now. It has the outside walls (dashed, copied from Level 1), the 5 staircases and
  2 elevators directly above their Level 1 spots, the enclosed bridge, and a skeleton of hallways. All are guesses.
- How floors connect: a stair or elevator is a pair of points, one on each floor, joined by an edge with
  `"kind": "stair"` or `"kind": "elevator"` and a `"length"` (how "far" the trip feels: stairs 160, elevator 300,
  so the router weighs waiting for an elevator against walking). Example from data.js:
  `{"from": "s_elev_1", "to": "s_elev_2", "kind": "elevator", "length": 300}`
- The step-free route never uses `"stair"` edges, so it automatically walks to an elevator.
- Doors only connect to hallways on their own floor, so a Level 2 room never "falls through" to Level 1.
- To fill in Level 2 for real: trace its rooms and hallways with `"level": "2"` the same way as Level 1, and remove
  `"blank": true` from its entry in LEVELS. A Level 3 works the same way.
- On the page: the 2 / 1 buttons on the map switch floors. Routes that change floor show "Up to Level 2" on the map,
  a "Take the elevator up to Level 2" step with a "Show Level 2" button, and a bar listing the floors used.

## Map scale (distance and time estimates)
`window.SCALE` in data.js turns map units into feet. The value (0.28) is a guess. Measure one real hallway,
for example the south wing main hallway (about 1265 map units from the west door to the east doors), and set
feetPerUnit to real feet divided by 1265. Then set "guess" to false. Time assumes an easy 240 feet per minute.

## Things to check when walking the building
1. Each room's door position. Edit that room's "doors" in data.js. Each [x, y] is one door.
2. The guessed hallways: north hallway behind S01/S02, west link down to the main hallway,
   north entry vestibule, hall by Stair 2, vestibule by Stair 1, north wing east hallway, hall by Stair 4.
3. Entrances: is the cafe "door" really a door? Is the service entrance public? Where exactly is the north entry?
4. Any steps inside the building (for example by Stair 1, where the brochure says "UP", or at the bridge ends).
   Mark them as a short edge with "kind": "steps".
5. The outdoor walkway between the wings: is it covered? Any steps or a ramp at either end?

## How to edit the path network (data.js, window.PATHS)
- Add a hallway point to "nodes": {"id": "s_new", "x": 300, "y": 344, "name": "Hall by the vending machines"}
- Join two points with an "edges" line: {"from": "s_new", "to": "s_main_vw"}
- Doors and entrances connect to the nearest hallway line by themselves. You don't wire them.
- Turn on "Show path network" to see the result. Then run `node tests.js`. It flags typos and doors too far from any hallway.

## Next steps
0. Calibrate GPS (see "GPS blue dot" above), then walk around outside Stokes with the page on https and check the dot lands where you stand.
1. Get real room numbers and door positions (the evacuation floor plans in the building should have them).
2. Walk the building and fix the guesses listed above. Set "guess": false or "verified": true as you go.
3. Test with ~5 freshmen against BC's map and log hours per building.

## Project decisions and growth plan

### Project status
- Stokes Hall Level 1 is traced from the brochure as a real floor plan (walls, doors, stairs, seating).
  Room IDs S01-S11 and N01-N08 are placeholders. Real numbers go in the "door" field using BC's format
  (number + wing letter, like 195S).
- Level 2 is a placeholder floor: outside walls, 5 staircases, 2 elevators, the enclosed bridge, and a
  hallway skeleton, all guesses. Floors connect through "stair" and "elevator" edges. Step-free routes
  use elevators only.
- On Level 1 there is no indoor link between the wings. Routes between wings go outside on the walkway
  (the enclosed bridge is on Level 2, according to the architect).
- Still needed:
  - real room numbers (from the evacuation maps posted in the building)
  - a walk-through to check door positions and guessed hallways
  - measuring one hallway to fix the distance scale
  - a photo of a Level 2 floor plan

### Growth plan (decided)
- Keep building it as a plain static website on GitHub Pages for now. This scales to lots of users for free.
- When testing with real students, turn it into an installable web app (a PWA) so it can be added to the
  home screen and works offline.
- Only move to the App Store / Google Play (for example by wrapping it with Capacitor) if lots of people
  use it. Apple costs $99 a year and needs a Mac. Google costs $25 once.
- Before adding a second building, split the data into one file per building (for example buildings/stokes.json).
- Once there are a few buildings, build a simple click-to-edit map tool so nobody has to type coordinates by hand.
- Talk to Boston College early (Facilities, First Year Experience, or student government) about permission
  and official floor plans, and move away from the traced brochure. Do not use BC's name or brochure in a
  public app store listing without permission.
- Loosely follow a standard indoor map format (Apple's IMDF) so the data can be moved to other tools later.

### How we work
- Two people work on this repo, the owner and a friend, each with their own Claude Code sessions.
- Each person works on their own branch and merges through pull requests. The other person reviews before merging.
- Split the work so nobody edits the same file at the same time (especially data.js).
- Start every session by pulling the latest main.
- HANDOFF.md is the shared notebook: any important decision goes here so every Claude session knows it.
- The owner is not an experienced coder. Always explain things in plain language, show a short plan before
  big changes, and run `node tests.js` before saying something is done.
