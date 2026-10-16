# BC Campus Map: handoff notes

## What's here
- index.html + data.js: mockup map of Stokes Hall Level 1 (search, legend, zoom, room details). Open index.html in a browser.
- rooms.csv: spreadsheet template for real room data (door numbers, landmarks, verified flag).
- pipeline_prototype/extract_rooms.py: prototype that finds rooms in a color-coded floor plan image (18 of 19 Stokes L1 classrooms found correctly). Optional, not needed for the next steps.

## Current state
- Room IDs S01-S11 (south wing) and N01-N08 (north wing) are placeholders. Real room numbers still needed (from evacuation maps or BC).
- Layout is a schematic traced from the Stokes Level 1 brochure plan (reference only, don't publish the brochure image).

## Next steps
1. Option 1: search a room, highlight it, show marked entrances. No directions.
2. Option 2: automatic routing. Add a walkable path network (hallway lines, door points, entrances, stairs, elevators, connector bridge) and draw the route from a chosen entrance, with an accessible-route toggle (elevators only).
3. Fill in real room numbers, then test with ~5 freshmen against BC's map and log hours per building.
