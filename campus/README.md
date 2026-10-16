# Outdoor campus map

The outdoor campus map is part of the main page, `index.html`. The Stokes Hall floor plan sits on it in its real spot.
This folder holds the campus side: settings and the campus data (buildings, walking paths, entrances).

## What is in this folder
- `config.js`: campus centre and which base map to use.
- `data.js`: the campus data (buildings, paths, entrances as GeoJSON). It starts empty. Step 1 below fills it.
  It is a .js file so the map works when index.html is opened straight from disk.
- `osm_export.geojson`: the raw export from step 1 (you add this file; it is only the input).
- `../tools/osm_to_campus.js`: turns the raw export into `data.js`.

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

It writes `campus/data.js` and prints a report: how many buildings it found, how many have names, how many
walking paths and entrances. **That report is the honest answer to "how much of campus is already mapped?"**
Entrances in particular are usually sparse in OpenStreetMap, so expect to add most of them yourselves.

Running the import again overwrites `campus/data.js`, so do hand edits after you are happy with the import.

## Step 2: Look at it
Open `index.html`. Walkways show as thin blue lines (steps dashed red), and "My location" routes now follow them instead of a straight line.
The blue-dot button works on an `https://` page (GitHub Pages) or on `localhost`, not from a file on disk.

## Step 3: Fix and fill in what is missing
Edit `campus/data.js` by hand (one feature per line), or fix it at the source in OpenStreetMap so everyone benefits.
- **Building has no name or the wrong name:** set `"name"` in the buildings part of `data.js`.
- **Missing entrance:** add a point to the entrances part of `data.js`. Copy an existing one and change the coordinates. Remember that
  coordinates are written longitude first, then latitude, which is the opposite of what Google Maps shows.
  Add `"name"` and `"wheelchair": "yes"` or `"no"` where you know it.
- **Missing path:** add a line to the paths part of `data.js` with `"highway": "footway"`. Use `"highway": "steps"` for stairs (drawn red and dashed).
  Add `"incline"` for steep ones and `"wheelchair"` where known. BC is hilly, so this is worth recording.

## Before you launch
- **Base map.** `"basemap": "osm-dev"` uses OpenStreetMap's public tile servers. That is fine for you and a friend testing, but their
  tile policy is meant for light use, so replace it before real users arrive. The usual route is to host your own tiles
  (for example Protomaps/PMTiles on cheap static hosting), or pay a provider. Check current pricing and terms when you decide.
- **Credit.** OpenStreetMap data must be credited. The map already shows "OpenStreetMap contributors". Keep it.

## What comes next
1. Import the campus data (step 1), so outdoor routes follow real walkways.
2. Add the next building: trace its floor plan, then fit it onto its OpenStreetMap footprint the same way Stokes was
   (see HANDOFF.md, "How Stokes is placed on the real map").
