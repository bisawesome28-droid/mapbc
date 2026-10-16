## Where things live now (read this first)
- `schools/` holds all map data as JSON: one folder per school, one file per building. See `docs/DATA_FORMAT.md`.
- `core/` holds the shared code (routes, search, floor plans as map shapes, map style). A native app uses the same files.
- `web/` holds the web page only (`web/app.js`, `web/app.css`); `index.html` is just the page shell.
- To add a building, follow `docs/ADDING_A_BUILDING.md`. Stokes Hall and McElroy Commons (floors 2 and 3) are mapped.
- McElroy floor 1 is not mapped yet; the page shows it greyed out.

# BC Campus Map: handoff notes

## Read this first: how the map fits together (Oct 16, 2026)
`index.html` is now **one map**: the outdoor campus map (MapLibre + OpenStreetMap) with the Stokes Hall floor plan laid
exactly on top of the real building. Zoomed out, Stokes looks like any other building (with a soft maroon tint: "has an indoor
map"); zoom in and the inside fades in, with rooms, doors, floors, search and routes as before. Campus buildings and walkways
are imported from OpenStreetMap, so routes from your location follow real paths. `node tests.js` should say 64 passed, 0 failed.

**Compass words are real.** The brochure is drawn turned: its right side is real north, its top is real west, its left is real
south, its bottom is real east. Names in data.js use real directions (the old "West door" is the South end door). "South wing" and
"North wing" are Stokes South and Stokes North. The "where" notes copied from rooms.csv still describe the brochure picture.

### Who and why
Brandon (BC student) and a friend are building a campus map app. The goal: a big outdoor campus map, tap into a building to see its
indoor floor plans, accurate names, search, routing, and eventually which floor you are on. They want it to scale to other colleges
and plan to pitch schools to supply their own floor plans. Stokes Hall Level 1 is the proof of concept. They plan a real app later
(a website is fine for now). Indoor content is a basic layout (room numbers, stairs, elevators, accessibility), no emergency content.

### How Stokes is placed on the real map
- The floor plan is a picture: `data.js` x/y are pixel positions on the brochure image (2722 x 1812), not GPS.
- `window.GEO.points` in data.js are 4 corners with both plan x/y and real lat/lng. `ML.fitGeo` turns them into a move + turn + resize
  (`toGeo(x, y)` and `toMap(lat, lng)`).
- **Where the 4 corners came from:** the traced Level 1 outline was fitted onto OpenStreetMap's footprints of "Stokes Hall North" and
  "Stokes Hall South" (from map tiles), maximising the overlap. They overlap by 91%, and the bumps line up. Real north is about 105 degrees
  from the brochure's "up": the brochure's right side is real north (Stokes North is north of Stokes South).
  To redo it: `python3 tools/fit_plan_to_osm.py --center 42.33426,-71.171274 --seed 42.334597,-71.171139 --seed 42.333923,-71.171349`.
- That fit also gave the real scale: **0.159 ft per plan unit** (the old guess of 0.28 was 75% too long). `SCALE` in data.js now uses it.
- Accuracy: about as good as OpenStreetMap's footprint (usually 1 to 3 m). Check by standing at a corner with the blue dot on.

### How the page works
- MapLibre (stored in `vendor/maplibre-gl-5.24.0/`, so nothing loads from a CDN) owns the camera: drag, pinch, scroll.
- The floor plan is still the same SVG drawing. It sits inside the map and is moved with one CSS transform on every map move
  (`applyView` in index.html). Labels and markers undo the building's turn so they stay upright, and keep a steady size on screen.
- Taps go through the map's own click event (`onMapClick`), which only fires when the map was not dragged.
- Version 5 of MapLibre is used on purpose: version 6 only ships as ES modules, which browsers refuse to load from a file opened straight from disk.
- **How the campus looks (3D):** the campus is drawn by us, not by a picture from a tile server. `campus/base.js` has the grass,
  roads, paths, parking, water, trees, nearby houses and each building's height; `campus/style.js` says how each is drawn
  (colours for light and dark mode, line widths, 3D buildings, labels) in MapLibre's standard style format, which the iOS and
  Android versions of MapLibre also read. Restyle the map by editing `PALETTES` in style.js.
- **Tilt (3D is optional):** the map opens flat (2D). The "3D" button next to the zoom buttons tilts it 45 degrees so buildings show in 3D
  (`TILT_PITCH` in index.html); you can also right-drag or ctrl-drag on a laptop, or use two fingers up/down on a phone. The button is
  greyed out while looking inside Stokes. North stays up. The floor plan is flat, so it only shows looking straight down: zooming into Stokes while tilted
  tips the map flat (`flattenIfInside`), and picking a room, "All" and "Show inside" go flat too. Picking a campus building or
  planning a walk keeps whatever tilt you chose.
- **Building heights:** only 36 of about 1,860 buildings in the area have a height or floor count in OpenStreetMap; the rest are
  guesses (campus buildings 15 m, residence halls 17 m, houses 8 m), marked `guess: 1` in base.js. Stokes is drawn 20 m tall
  (`STOKES_HEIGHT` in index.html, a guess). Adding `building:levels` in OpenStreetMap fixes a building on the next import.
- **Labels** (building, road and lawn names) use the Inter font (`vendor/inter-5.3.0/`, SIL Open Font License). In a browser MapLibre
  draws the letters itself from that font, so there are no font files to host. **For a native app** MapLibre needs the font as
  "glyph" files instead: make them once from the same Inter font (MapLibre's font-maker tool) and add a `glyphs` URL to the style.
- **Past the edge of the campus data** (and only there) the map shows OpenStreetMap's own tiles, faded (`CAMPUS.basemap = "osm-dev"`):
  fine for testing, not for launch. The camera cannot wander far past the data (`maxBounds`). Without internet the campus still draws.

### Campus data and outdoor routes
- `campus/data.js` holds the campus boundary, buildings, walking paths and entrances (GeoJSON, **[lng, lat]** order), imported Oct 16, 2026
  (second import, slightly bigger area): 181 buildings inside BC's campus boundary (126 named; buildings outside the boundary are only
  drawn, not searchable), 1,561 roads and walkways, 39 entrances.
  It is a .js file (not .geojson) so the page works from disk.
- To refresh it: `python3 tools/fetch_osm.py` (downloads the BC area from api.openstreetmap.org in small squares), then
  `node tools/osm_to_campus.js campus/osm_export.geojson`. The raw export is not committed (.gitignore).
- "Starting from" is a search box (type "o'neill"; with nothing typed it lists My location and the Stokes doors). The page keeps the chosen place in a hidden `<select id="from">`, so code and tests can still set `#from`.
- "Starting from" has **My location (GPS)**. The route goes outdoors to the best door, then inside (`ML.campusRoute`): it tries every
  ground-floor entrance and keeps the shortest total walk. The step-free option avoids outdoor "steps" paths and paths tagged wheelchair=no.
- Outdoor turns are named after the nearest building (within 30 m), because most campus walkways have no name:
  "Turn left toward Devlin Hall". If the walkways do not connect, the outdoor part falls back to a straight dashed line, labelled.
- Search also finds campus buildings ("gasson"): it outlines the building and gives walking directions from My location or a
  Stokes door, to the building's OpenStreetMap entrance if it has one, else to the walkway nearest its middle. Tapping a building works too.
- The route finder uses a priority queue (fast on thousands of points); a test checks it gives the same answers as the simple method.
- Inside the building, GPS is too rough, so "My location" starts from the nearest door instead.
- **When the inside shows:** only once you have zoomed in past the whole building (its width or its height, whichever is bigger,
  is at least as big as the screen: `buildingFill()` in index.html, `SHOW_INSIDE_AT = 1.0`). It fades in over the next 15% so it does not pop.
  The rule is the same with or without a room or route selected, and on a phone or a laptop. The page opens further out than that,
  so you see campus first; the "All" button, picking a room, or tapping the maroon building zooms in far enough to show it.
- **Residence hall doors and lobbies (`campus/extras.js`):** St. Thomas More Apartments (2 entrances and the lobby) and Cheverus Hall
  (4 entrances, marked as guesses: which doors students use is not checked; Cheverus's first floor has no lobby). Taken from BC
  Residential Life's floor plans, which are behind BC's login, so **only doors and lobbies are on the map, no rooms**, and the plan files
  are not in the repo. Placed by matching each plan's outline to the OpenStreetMap footprint (about 1 to 3 m off at most).
  They join OpenStreetMap's entrances when the page loads, so directions to those buildings end at a real door. Entrances show as
  green dots and lobbies as light blue shapes once you zoom in. Ask BC before adding anything more from those plans.
- **Version label:** the footer of the page says "Map version ..." (`VERSION` in index.html). Bump it whenever you publish a change.
  If someone says "I see no change", ask what version they see: GitHub Pages can take a few minutes, and browsers keep old copies
  (a hard refresh fixes that).
- "Show path network" also shows the campus walkways (steps dashed red).

### Floor detection (discussed, not built)
Plan: barometer for relative floor change, reset at entrances that have a known floor (BC buildings can have entrances on different levels,
so tag the floor per entrance), use the accelerometer to confirm stairs or an elevator ride, and ask the user to confirm when unsure.
Wi-Fi fingerprinting only works on Android (iOS blocks Wi-Fi scans). Beacons need hardware, which hurts the scale-to-any-college goal.

### Gotchas
- `tests.js` creates a fake `window` and `require`s `data.js`, `campus/config.js` and `campus/data.js`. New data files should write to `window.*`
  the same way, and `logic.js` has no DOM code, so keep it that way.
- Lat/lng order differs between tools: GeoJSON and MapLibre use [lng, lat], Google Maps shows lat, lng, and `GEO.points` uses named `lat` and `lng`.
- Re-running the importer overwrites campus/data.js, so hand edits should come after the import is final.
- The brochure image is not in the repo on purpose (see "Current state").
- `window.mapbcMap` is the MapLibre map, for testing and the browser console.
- `?sim=1` on the link: press the locate button, then tap anywhere to place a pretend location (for testing at a desk).

## What's here
- index.html: the main page. The campus map with the Stokes floor plan on it, drawn like an architect's plan (walls, doors, stairs, seating). Open it in a browser. No server or build step needed.
- data.js: everything the map shows (rooms, doors, entrances, hallway network). Most changes happen here.
- logic.js: search and route finding. Shared by the page and the tests.
- tests.js: run `node tests.js` to check search and routing. Run it after every data.js edit.
- rooms.csv: spreadsheet template for real room data (door numbers, landmarks, verified flag).
- pipeline_prototype/: optional prototype that finds rooms in a color-coded floor plan image.
- campus/: campus settings (config.js), campus data for search and directions (data.js), what the map draws around it (base.js), and
  how it all looks (style.js). tools/fetch_osm.py downloads from OpenStreetMap and tools/osm_to_campus.js writes data.js and base.js.
- tools/fit_plan_to_osm.py: places a traced floor plan on the real map by fitting its outline onto OpenStreetMap's footprint (prints GEO points). Used for Stokes; use it for each new building.
- vendor/: the MapLibre map library (version 5.24.0, BSD license) and the Inter font (5.3.0, SIL Open Font License), stored here so the page needs no CDN.
- campus.html: just sends old links to index.html.

## What works now
- Search a room (placeholder id, real room number, or words like "restrooms"). It highlights and zooms in.
- "Starting from" picks an entrance (the green markers; tapping one picks it too), My location (GPS), or **any campus building**
  (the dropdown lists them under "Campus buildings"; or search a building and press "Start from here"). A building start walks from the
  side of that building that faces Stokes, along the real walkways, in the best door, and on to the room. The step list has a
  "Show inside" button that zooms into Stokes. Building to building walking directions work too. Links keep it: `?from=B:way/123&room=S03`.
- With a room and an entrance chosen, the map draws the shortest route and lists the steps.
- "Accessible route" skips anything marked as steps or stairs. Level 1 has none marked yet, so for now it gives the same route.
- "Show path network" draws every hallway line. Orange dashes = guessed, grey = clear on the brochure.
- Links like `index.html?from=E-S-WEST&room=S03` open straight to a route (could become QR codes at entrances).
- The page remembers the last entrance on that device.
- Turn-by-turn steps ("Turn left toward ...") with distance in feet and a walking-time estimate.
- "Nearest" buttons (Restrooms, Elevators, Cafe, Advising) pick the closest match from the chosen entrance.
- Works on phones (pinch to zoom) and has a light/dark switch.

## Current state
- Room ids S01-S11 and N01-N08 are internal names. Do not change "id". The real number is in "door", written as on the signs: wing letter + number, like "S195". Search, labels and routes use it.
- **Level 1 room numbers (Oct 16, 2026)** come from the fire department plans posted in Stokes (photos kept locally, `*.HEIC` is in .gitignore). 23 are filled in: all 19 classrooms plus S139, S189, S102 and N125 (Pulse). The south wing's fire plan is drawn the same way round as the brochure; the north wing's is turned a quarter turn (its entries N105 and N135 and stairs 3 and 4 confirm which way). Not filled in: the advising, IT, service and conference areas (several small rooms each, could not be matched one to one), and the lobby, which the sign also labels "S103", the same as the classroom next to it, so check its real number on site. Entry vestibules on the plans: S112 (west door), S185 (north door), N105 (walkway side), N135 (east end).
- **Levels 2 to 4 (Oct 16, 2026)** are traced from photos of the fire department plans posted in Stokes (kept locally, not committed):
  about 325 rooms with their real numbers (S2xx to S4xx, N2xx to N4xx), the outside walls, hallways, stairs and elevators, and the
  enclosed bridge (Level 2; Level 3 has one too, marked as a guess because it is not drawn the same way on the plan). How: each photo was
  lined up with the traced Level 1 using the stairs and elevators (they sit in the same place on every floor), a program read the
  room-number labels, and each room's outline was cut from the walls in the photo. **Guesses to check on site:** what each room is
  (rooms are called Classroom, Seminar or meeting room, or Office by size only, `useGuess: true`); door positions (put on the wall
  nearest a hallway); the hallway lines; room shapes (squared up where nearly rectangular, a bit lumpy otherwise); and the Level 3
  bridge. The basement and penthouse plans were also photographed but are not traced.
  Redo it with the scripts' method if the plans change: the tracing scripts are not in the repo (they were scratch work).
  **Straightening pass (map version p):** the Level 2 and 3 photos were taken at a slant, so a first pass came out curvy. They were
  re-lined up with Level 4 (a full perspective fit, not just shift and scale), then every wall and room was forced to run only
  horizontal or vertical, and walls that were nearly in line were snapped exactly in line. The outside walls of Level 3 and of the
  Level 2 north wing reuse Level 4's (same building). **Second pass (version q), Levels 2, 3 and 4:** every room is now a clean
  rectangle (its main body, without door-swing bumps), rooms are snapped into shared rows and columns, neighbours share one wall,
  rooms next to the outside wall sit against it, and doors are kept away from room corners. Small rooms get smaller door symbols. A test (`Level 2 and 3 walls and rooms are straight`) fails if a slanted wall sneaks back in.
  **S290 (Level 2):** the fire plan shows ENTRY S290 on Level 2 of the south wing, which is raised, so it is not a room. It is the
  entrance `E-S-290` (`"level": "2"`, `"outdoor": true`): a gap in the Level 2 outside wall, in the "Starting from" list, and used by
  walking directions from outside (`groundEntrances()` in index.html includes entrances marked `outdoor`). Door spot is a guess.
- The plan is traced from the Stokes Level 1 brochure at full size (2722 x 1812 pixels). Map coordinates in data.js are pixel positions on that image, so you can check any point by opening the image. Don't publish the brochure image. It is ignored by git (keep it in reference/stokes-level1-brochure.png).
- Level 1 has no indoor link between the wings. The architect describes the enclosed bridge as being on Level 2, with walkways at ground level, so routes between wings go outside and the page says so.
- Seating rows, stair treads, elevator X marks and restroom symbols are drawn from simple rules ("seating", "stair", "cars", "restroom" in data.js). They show the kind of room, not exact furniture.
- All door positions are guesses. Hallways marked "guess": true need checking on site.

## GPS blue dot ("Locate me")
The crosshair button shows where you are, anywhere on campus, with a faint circle for how far off the GPS might be.
- It asks the phone for its position, smooths out the jumps, and draws the dot on the map.
- It names the nearest entrance and offers "Start there". Or choose "My location (GPS)" in "Starting from" for a route from where you stand.
- GPS cannot tell floors apart. Inside the building it is often off by 5 to 10 m.
- Nothing is saved or sent anywhere. Location only works on an https page (GitHub Pages is https), not from a file on disk.
- It is calibrated (see "How Stokes is placed on the real map" above). Still to do: walk around Stokes with a phone and check the dot.
- `node tests.js` checks the 4 GEO corners agree with each other and with SCALE, and points at a likely typo if one is off.

## Floors (levels)
- `window.LEVELS` in data.js lists the floors. Anything without a `"level"` is on Level 1.
- Levels 2, 3 and 4 are traced from the posted fire department plans (see "Levels 2 to 4" above): rooms with real numbers, hallways,
  and the 5 staircases and 2 elevators directly above their Level 1 spots. The south wing's Stair 1 north end only goes between Levels 1 and 2 (it is not on Levels 3 and 4 in the plans);
  the other stairs and the elevators go all the way up.
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
`window.SCALE` in data.js turns map units into feet: 0.1594 ft per unit, from the fit onto OpenStreetMap (about +/- 5%).
To make it exact, measure the south wing main hallway (about 1265 map units from the west door to the east doors) and set
feetPerUnit to real feet divided by 1265. Time assumes an easy 240 feet per minute.

## Things to check when walking the building
1. Each room's door position. Edit that room's "doors" in data.js. Each [x, y] is one door.
2. The guessed hallways: north hallway behind S01/S02, west link down to the main hallway,
   north entry vestibule, hall by Stair 2, vestibule by Stair 1, north wing east hallway, hall by Stair 4.
3. Entrances: are the North doors (south wing, by the cafe) real doors? Is the service entrance public? Where exactly is the west entry by reception?
4. Any steps inside the building (for example by Stair 1, where the brochure says "UP", or at the bridge ends).
   Mark them as a short edge with "kind": "steps".
5. The outdoor walkway between the wings: is it covered? Any steps or a ramp at either end?

## How to edit the path network (data.js, window.PATHS)
- Add a hallway point to "nodes": {"id": "s_new", "x": 300, "y": 344, "name": "Hall by the vending machines"}
- Join two points with an "edges" line: {"from": "s_new", "to": "s_main_vw"}
- Doors and entrances connect to the nearest hallway line by themselves. You don't wire them.
- Turn on "Show path network" to see the result. Then run `node tests.js`. It flags typos and doors too far from any hallway.

## Next steps
0. Walk around outside Stokes with the page on https (GitHub Pages) and check the blue dot and the route in. Add missing entrances in OpenStreetMap.
1. Level 1 room numbers are in (from the posted fire plans). Still to do: door positions, the lobby's number, and the office suites. Walk Levels 2 to 4 to check the guesses listed above.
2. Walk the building and fix the guesses listed above. Set "guess": false or "verified": true as you go.
3. Test with ~5 freshmen against BC's map and log hours per building.

## Project decisions and growth plan

### Project status
- Stokes Hall Level 1 is traced from the brochure as a real floor plan (walls, doors, stairs, seating).
  Real room numbers (from the fire department plans posted in Stokes) are in the "door" field, like S195.
- Levels 2 to 4 are traced from the posted fire department plans. Floors connect through "stair" and "elevator" edges.
  Step-free routes use elevators only.
- On Level 1 there is no indoor link between the wings. Routes between wings go outside on the walkway
  (the enclosed bridge is on Level 2, according to the architect).
- Still needed:
  - the lobby's number and the office suite numbers (Level 1 classroom numbers are done)
  - a walk-through to check door positions and guessed hallways
  - measuring one hallway to fix the distance scale
  - check Levels 2 to 4 on site (they are traced from the posted fire plans; room types and door spots are guesses)

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
