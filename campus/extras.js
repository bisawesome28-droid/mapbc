// Hand-added campus details that OpenStreetMap does not have: building entrances and lobbies.
// Kept separate from data.js (which the import tool overwrites), and added to it when the page loads.
//
// Only doors and lobbies are here on purpose: they are what you need to walk into a building, and they
// are common areas. Room layouts (bedrooms, suites) from BC's residence hall plans are NOT added, because
// those plans are behind BC's login; ask BC before adding more (see HANDOFF.md, "Project decisions").
//
// Source: BC Residential Life floor plans (first floors), placed on the map by matching the plan's
// outline to the building's OpenStreetMap footprint (within about 1 to 3 m).
// "guess": true = where the door is drawn is clear, but which doors students actually use is not checked yet.
// Coordinates are [longitude, latitude].
window.CAMPUS_EXTRAS = {
  "entrances": {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"name": "Main entrance (north side, into the lobby)", "building": "St. Thomas More Apartments", "entrance": "main", "source": "BC floor plan"}, "geometry": {"type": "Point", "coordinates": [-71.1649031, 42.3398694]}},
    {"type": "Feature", "properties": {"name": "Courtyard entrance (into the lobby)", "building": "St. Thomas More Apartments", "entrance": "yes", "source": "BC floor plan"}, "geometry": {"type": "Point", "coordinates": [-71.1650293, 42.3396184]}},
    {"type": "Feature", "properties": {"name": "East end entrance", "building": "Cheverus Hall", "entrance": "yes", "source": "BC floor plan", "guess": true}, "geometry": {"type": "Point", "coordinates": [-71.1747992, 42.3343741]}},
    {"type": "Feature", "properties": {"name": "West end entrance", "building": "Cheverus Hall", "entrance": "yes", "source": "BC floor plan", "guess": true}, "geometry": {"type": "Point", "coordinates": [-71.1753854, 42.3342758]}},
    {"type": "Feature", "properties": {"name": "Side entrance (east corner of the wing)", "building": "Cheverus Hall", "entrance": "yes", "source": "BC floor plan", "guess": true}, "geometry": {"type": "Point", "coordinates": [-71.1749838, 42.3342941]}},
    {"type": "Feature", "properties": {"name": "Side entrance (west corner of the wing)", "building": "Cheverus Hall", "entrance": "yes", "source": "BC floor plan", "guess": true}, "geometry": {"type": "Point", "coordinates": [-71.1751685, 42.3343005]}}
  ]},
  "lobbies": {"type": "FeatureCollection", "features": [
    {"type": "Feature", "properties": {"name": "Lobby", "building": "St. Thomas More Apartments"}, "geometry": {"type": "Polygon", "coordinates": [[[-71.1648359, 42.3398515], [-71.1647923, 42.3396293], [-71.1649796, 42.339609], [-71.1650232, 42.3398312], [-71.1648359, 42.3398515]]]}}
  ]}
};
