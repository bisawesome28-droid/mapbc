// Settings for the outdoor campus map (campus.html).
window.CAMPUS = {
  "name": "Boston College",

  // Where the map opens, as [longitude, latitude]. Longitude comes FIRST (the usual mix-up).
  // This is roughly the middle of the Chestnut Hill campus. Move it once you have looked at the map.
  "center": [-71.1685, 42.3355],
  "zoom": 16,

  // Buildings that have an indoor map, and the page to open for each. Matched by building name:
  // not case sensitive, and part of a name is enough. Add a building here when its floor plan is ready.
  "indoor": {
    "Stokes Hall": "index.html"
  },

  // The base map. "osm-dev" draws OpenStreetMap's public tiles. That is fine for trying things out on your own
  // computer, but not for a real launch, because their tile servers are meant for light use. Before launch, swap in
  // self-hosted tiles (see campus/README.md, "Before you launch").
  "basemap": "osm-dev"
};
