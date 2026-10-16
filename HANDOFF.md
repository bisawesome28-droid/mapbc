# BC Campus Map: handoff notes

## What's here
- index.html: the map page, drawn like an architect's floor plan (walls, doors, stairs, seating). Open it in a browser. No server or build step needed.
- data.js: everything the map shows (rooms, doors, entrances, hallway network). Most changes happen here.
- logic.js: search and route finding. Shared by the page and the tests.
- tests.js: run `node tests.js` to check search and routing. Run it after every data.js edit.
- rooms.csv: spreadsheet template for real room data (door numbers, landmarks, verified flag).
- pipeline_prototype/: optional prototype that finds rooms in a color-coded floor plan image.

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
