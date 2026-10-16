// Campus data for the outdoor map: buildings, walking paths and building entrances, in GeoJSON.
// Coordinates are [longitude, latitude] (longitude FIRST, the opposite of Google Maps).
// This file is written by tools/osm_to_campus.js from an OpenStreetMap export (see campus/README.md).
// It is a .js file, not .geojson, so the map works when index.html is opened straight from disk.
window.CAMPUS_DATA = {
  "buildings": {"type": "FeatureCollection", "features": []},
  "paths": {"type": "FeatureCollection", "features": []},
  "entrances": {"type": "FeatureCollection", "features": []}
};
