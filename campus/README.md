# Outdoor campus map

`campus.html` is the big outdoor map. Tap a building, and if it has an indoor map you get an "Open indoor map" button
that goes to the floor plan (today that is `index.html`, the Stokes Hall map).

## What is in this folder
- `config.js`: where the map opens, which buildings have an indoor map, and which base map to use.
- `buildings.geojson`, `paths.geojson`, `entrances.geojson`: the campus data. They start empty. Step 1 below fills them.
- `osm_export.geojson`: the raw export from step 1 (you add this file; it is only the input).
- `../tools/osm_to_campus.js`: turns the raw export into the three files above.

## Step 1: Get the campus data from OpenStreetMap (about 5 minutes)
1. Go to https://overpass-turbo.eu
2. Zoom the map on the right until it shows the whole Chestnut Hill campus (the area you want to map).
3. Replace the text on the left with this, then click **Run**. `{{bbox}}` means "whatever the map is showing", so no
   coordinates are needed:

```
[out:json][timeout:60];
(
  way["building"]({{bbox}});
  relation["building"]({{bbox}});
  way["highway"]({{bbox}});
  node["entrance"]({{bbox}});
);
out geom;
```

4. Click **Export**, then **GeoJSON**, then **download**. Save the file as `campus/osm_export.geojson`.
5. In this repo's folder run:

```
node tools/osm_to_campus.js campus/osm_export.geojson
```

It fills in the three data files and prints a report: how many buildings it found, how many have names, how many
walking paths and entrances. **That report is the honest answer to "how much of campus is already mapped?"**
Entrances in particular are usually sparse in OpenStreetMap, so expect to add most of them yourselves.

Running the import again overwrites the three data files, so do hand edits after you are happy with the import.

## Step 2: Look at it
Browsers will not load the data files when the page is opened straight from disk. Run a tiny local server in the repo folder:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/campus.html. The blue-dot button (top right) works here too, because `localhost` counts as secure.
On a phone it needs an `https://` address.

## Step 3: Fix and fill in what is missing
Edit the data files by hand (they are plain text), or fix it at the source in OpenStreetMap so everyone benefits.
- **Building has no name or the wrong name:** set `"name"` in `buildings.geojson`. Search and labels use this, and so does the
  link to the indoor map.
- **Missing entrance:** add a point to `entrances.geojson`. Copy an existing one and change the coordinates. Remember that
  coordinates are written longitude first, then latitude, which is the opposite of what Google Maps shows.
  Add `"name"` and `"wheelchair": "yes"` or `"no"` where you know it.
- **Missing path:** add a line to `paths.geojson` with `"highway": "footway"`. Use `"highway": "steps"` for stairs (drawn red and dashed).
  Add `"incline"` for steep ones and `"wheelchair"` where known. BC is hilly, so this is worth recording.
- **Connect a building to its indoor map:** add it to `"indoor"` in `config.js`, for example `"Stokes Hall": "index.html"`.
  Buildings with an indoor map are drawn in maroon.

## Before you launch
- **Base map.** `"basemap": "osm-dev"` uses OpenStreetMap's public tile servers. That is fine for you and a friend testing, but their
  tile policy is meant for light use, so replace it before real users arrive. The usual route is to host your own tiles
  (for example Protomaps/PMTiles on cheap static hosting), or pay a provider. Check current pricing and terms when you decide.
- **Credit.** OpenStreetMap data must be credited. The map already shows "OpenStreetMap contributors". Keep it.
- **The page loads MapLibre from unpkg.com.** For an app you would bundle it instead.

## What comes next
1. Put the Stokes floor plan on this map: once its GPS control points are filled in (`GEO` in `data.js`, branch `gps-blue-dot`),
   its floor plan can be converted to real coordinates and drawn exactly where the building is.
2. Turn the walking paths into a route finder, joined to the indoor routes at each entrance.
3. Add the next building's indoor map and list it in `config.js`.
