# Adding a building (indoor map)

1. **Check permission first.** Plans behind a login (BC residence hall plans) cannot go in a public repo without
   permission. Posted emergency or fire plans are on the walls for anyone; they are fine to trace, but keep the
   photos out of git (`*.HEIC` is ignored).
2. **Copy a similar building file** in `schools/<school>/buildings/` and rename it `<id>.json`.
3. **Add the building** to `buildings` in `school.json`, and its OpenStreetMap id to the file's `osm` list.
4. **Trace each floor.** Put plan coordinates in the file (see `docs/DATA_FORMAT.md`). Walls become `outlines`,
   rooms become `rooms` (shape plus door points), hallways become `paths`, and stairs and elevators become
   `rooms` with `stair` or `cars`, linked between floors with a `stair`/`elevator` edge.
5. **Give it GPS points** (`geo`): four corners of its OpenStreetMap footprint are enough.
6. **Run `node tests.js`.** It loads every school and building, and checks that doors join hallways, that every
   room is reachable from every entrance, and that the GPS fit is good. Fix what it reports.
7. **Check in a browser** through a local server or the GitHub Pages link: the floors draw, search finds rooms,
   and a route to a room on each floor works.
8. Mark anything not checked on site with `guess` / `useGuess`, and say so in the file's `about` text.
