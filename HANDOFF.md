# BC Campus Map: handoff notes

## What's here
- index.html: the map page. Open it in a browser. No server or build step needed.
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

## Current state
- Room ids S01-S11 and N01-N08 are placeholders. Do not change "id". Put the real number in "door" (for example "door": "S195"). Search, labels and routes pick it up.
- The layout is a schematic traced from the Stokes Level 1 brochure. Don't publish the brochure image. It is ignored by git (keep it in reference/).
- All door positions are guesses. Hallways marked "guess": true need checking on site.

## Things to check when walking the building
1. Each room's door position. Edit that room's "doors" in data.js. Each [x, y] is one door.
2. The guessed hallways: north hallway behind S01/S02, west link down to the main hallway,
   north entry vestibule, hall by Stair 2, vestibule by Stair 1, north wing east hallway, hall by Stair 4.
3. Entrances: is the cafe "door" really a door? Is the service entrance public? Where exactly is the north entry?
4. Any steps inside the building (for example by Stair 1, where the brochure says "UP", or at the bridge ends).
   Mark them as a short edge with "kind": "steps".
5. The connector bridge: indoors or outdoors, and level with both wings?

## How to edit the path network (data.js, window.PATHS)
- Add a hallway point to "nodes": {"id": "s_new", "x": 300, "y": 344, "name": "Hall by the vending machines"}
- Join two points with an "edges" line: {"from": "s_new", "to": "s_main_vw"}
- Doors and entrances connect to the nearest hallway line by themselves. You don't wire them.
- Turn on "Show path network" to see the result. Then run `node tests.js`. It flags typos and doors too far from any hallway.

## Next steps
1. Get real room numbers and door positions (the evacuation floor plans in the building should have them).
2. Walk the building and fix the guesses listed above. Set "guess": false or "verified": true as you go.
3. Test with ~5 freshmen against BC's map and log hours per building.
