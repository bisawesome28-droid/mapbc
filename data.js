// Everything the map shows comes from this file.
// To add a real room number, change "door": "" for that room, for example "door": "195S"
// (Stokes numbers are written as number + wing letter, like 195S in the south wing).
// Fill in "near" (nearest landmark) and "directions" the same way, and set "verified": true after checking on site.
// To show a photo, put the file in a photos folder and set "photo": "photos/name.jpg".
// "id" (like S01) is only an internal name. Leave it alone. The real room number goes in "door".
//
// Map coordinates are pixel positions on the full-size brochure floor plan (2722 x 1812):
// x grows to the right, y grows downward. Tick "Show path network" on the page to see points.
// "shape" is the outline of a room as a list of [x, y] corners.
// "doors" lists where each door of the room is, as [x, y] points on its wall. Routes end there.
//   All door positions are guesses traced from the brochure. Fix them after walking the building.
// Optional drawing extras (they only change how a room looks):
//   "seating": "tiered" | "flat" | "table", "stair": true, "restroom": true,
//   "cars": elevator cars as [x, y, width, height], "partitions": inside walls as [x1, y1, x2, y2].
window.BUILDING = {
  "name": "Stokes Hall",
  "level": "Level 1",
  "note": "Floor plan traced from a published brochure. Room IDs are placeholders until real room numbers are added."
};

// Map units to real feet, used for the distance and walking-time estimates.
// This is a rough guess. To fix it: measure the south wing main hallway on site, from the west door
// to the east doors (about 1265 map units), and set feetPerUnit to real feet divided by 1265.
window.SCALE = {"feetPerUnit": 0.28, "guess": true};

// Outside walls of each wing, traced clockwise.
window.OUTLINES = [
  {"wing": "South", "points": [[61,364],[478,364],[478,305],[437,305],[437,186],[593,186],[603,162],[683,162],[693,186],[1043,186],[1043,118],[1207,118],[1207,257],[1371,257],[1371,745],[1450,745],[1450,815],[1371,815],[1371,1057],[1300,1057],[1290,1093],[1210,1093],[1200,1057],[1136,1057],[1136,1000],[993,1000],[993,1064],[864,1064],[864,1000],[507,1000],[507,1078],[332,1078],[332,1000],[107,1000],[107,590],[61,590]]},
  {"wing": "North", "points": [[1664,690],[1768,690],[1768,532],[2004,532],[2004,600],[2121,600],[2121,680],[2280,680],[2280,880],[2215,880],[2215,1630],[2150,1630],[2150,1710],[1975,1710],[1975,1750],[1775,1750],[1775,1630],[1680,1630],[1680,1436],[1640,1436],[1640,1250],[1680,1250],[1680,820],[1664,820]]}
];

// Columns along the outdoor walkway between the wings (drawing only).
window.PILLARS = [[1440,731],[1518,731],[1597,731],[1668,731],[1440,850],[1518,850],[1597,850],[1668,850]];

// Small rooms drawn for realism. They are not searchable and routes do not go to them.
window.FIXTURES = [
  {"label": "Stor.", "shape": [[121,579],[179,579],[179,602],[121,602]]},
  {"label": "Stor.", "shape": [[371,618],[457,618],[457,690],[371,690]]},
  {"label": "Vend.", "shape": [[371,690],[457,690],[457,768],[371,768]]},
  {"label": "Elec.", "shape": [[586,610],[650,610],[650,690],[586,690]]},
  {"label": "Data", "shape": [[586,690],[650,690],[650,764],[586,764]]},
  {"label": "Stor.", "shape": [[414,829],[507,829],[507,879],[414,879]]},
  {"label": "Office", "shape": [[761,204],[829,204],[829,289],[761,289]]},
  {"label": "Stor.", "shape": [[1021,668],[1079,668],[1079,754],[1021,754]]},
  {"label": "Vestibule", "shape": [[1079,671],[1157,671],[1157,764],[1079,764]]},
  {"label": "Storage", "shape": [[1068,339],[1129,339],[1129,389],[1068,389]]},
  {"label": "Storage", "shape": [[1168,343],[1346,343],[1346,393],[1168,393]]},
  {"label": "Vestibule", "shape": [[1371,745],[1450,745],[1450,815],[1371,815]]},
  {"label": "Stor.", "shape": [[2021,686],[2093,686],[2093,743],[2021,743]]},
  {"label": "Fire pump", "shape": [[2107,950],[2200,950],[2200,1032],[2107,1032]]},
  {"label": "Bldg. stor.", "shape": [[1914,1043],[2071,1043],[2071,1110],[1914,1110]]},
  {"label": "Stor.", "shape": [[1796,1629],[1860,1629],[1860,1660],[1796,1660]]},
  {"label": "Stor.", "shape": [[1914,1629],[1975,1629],[1975,1660],[1914,1660]]}
];

window.ROOMS = [
  {"id": "S01", "door": "", "name": "Classroom S01", "type": "classroom", "wing": "South", "label": "S01", "keywords": "", "where": "South wing, top-left corner, tiered seating, left of S02", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[79,389],[253,389],[253,568],[79,568]], "doors": [[225,568]], "seating": "tiered"},
  {"id": "S02", "door": "", "name": "Classroom S02", "type": "classroom", "wing": "South", "label": "S02", "keywords": "", "where": "South wing, top-left, flat seating, right of S01", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[261,389],[411,389],[411,570],[261,570]], "doors": [[411,462]], "seating": "flat"},
  {"id": "S03", "door": "", "name": "Classroom S03", "type": "classroom", "wing": "South", "label": "S03", "keywords": "", "where": "South wing, west side, middle, tiered seating", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[121,607],[325,607],[325,757],[121,757]], "doors": [[240,757]], "seating": "tiered"},
  {"id": "S04", "door": "", "name": "Classroom S04", "type": "classroom", "wing": "South", "label": "S04", "keywords": "", "where": "South wing, west side, lower, flat seating", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[121,854],[277,854],[285,830],[315,830],[328,856],[328,979],[121,979]], "doors": [[200,854]], "seating": "flat"},
  {"id": "S05", "door": "", "name": "Classroom S05", "type": "classroom", "wing": "South", "label": "S05", "keywords": "", "where": "South wing, bottom left of center, tiered seating", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[332,882],[507,882],[507,1064],[332,1064]], "doors": [[348,882]], "seating": "tiered"},
  {"id": "S06", "door": "", "name": "Classroom S06", "type": "classroom", "wing": "South", "label": "S06", "keywords": "", "where": "South wing, south side, first of three in a row (west)", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[514,832],[639,832],[639,979],[514,979]], "doors": [[576,832]], "seating": "flat"},
  {"id": "S07", "door": "", "name": "Classroom S07", "type": "classroom", "wing": "South", "label": "S07", "keywords": "", "where": "South wing, south side, middle of the row of three", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[646,832],[757,832],[757,979],[646,979]], "doors": [[701,832]], "seating": "flat"},
  {"id": "S08", "door": "", "name": "Classroom S08", "type": "classroom", "wing": "South", "label": "S08", "keywords": "", "where": "South wing, south side, last of three (east)", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[766,830],[880,830],[880,982],[766,982]], "doors": [[823,830]], "seating": "flat"},
  {"id": "S09", "door": "", "name": "Classroom S09", "type": "classroom", "wing": "South", "label": "S09", "keywords": "", "where": "South wing, center-east, upper of two stacked rooms", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[970,386],[1127,386],[1127,496],[970,496]], "doors": [[970,440]], "seating": "table"},
  {"id": "S10", "door": "", "name": "Classroom S10", "type": "classroom", "wing": "South", "label": "S10", "keywords": "", "where": "South wing, center-east, lower of the two stacked rooms", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[970,500],[1127,500],[1127,611],[970,611]], "doors": [[970,555]], "seating": "table"},
  {"id": "S11", "door": "", "name": "Large tiered classroom S11", "type": "classroom", "wing": "South", "label": "S11", "keywords": "lecture hall", "where": "South wing, east side, largest tiered classroom, near the connector", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1132,396],[1346,396],[1346,671],[1132,671]], "doors": [[1145,671],[1150,396]], "seating": "tiered"},
  {"id": "S-ADV-N", "door": "", "name": "Advising offices (north row)", "type": "office", "wing": "South", "label": "Advising\noffices", "keywords": "academic advising first year experience", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[446,204],[593,204],[603,166],[683,166],[693,204],[829,204],[829,289],[446,289]], "doors": [[829,250]], "partitions": [[515,204,515,289],[591,204,591,289],[688,204,688,289],[758,204,758,289],[515,247,591,247],[688,247,758,247]]},
  {"id": "S-ADV-M", "door": "", "name": "Advising offices and workstations", "type": "office", "wing": "South", "label": "Advising\noffices", "keywords": "academic advising first year experience", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[482,321],[793,321],[793,443],[421,443],[421,393],[482,393]], "doors": [[700,443]], "partitions": [[550,321,550,443],[489,393,489,443],[550,382,793,382],[640,321,640,443],[700,321,700,382],[745,321,745,382]]},
  {"id": "S-ADV-S", "door": "", "name": "Advising offices (south row)", "type": "office", "wing": "South", "label": "Advising\noffices", "keywords": "academic advising first year experience", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[414,482],[889,482],[889,575],[414,575]], "doors": [[600,482]], "partitions": [[479,482,479,575],[521,482,521,575],[586,482,586,575],[650,482,650,575],[712,482,712,575],[814,482,814,575]]},
  {"id": "S-SEM", "door": "", "name": "Seminar room", "type": "office", "wing": "South", "label": "Seminar\nroom", "keywords": "", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1061,136],[1189,136],[1189,286],[1061,286]], "doors": [[1100,286]], "seating": "table", "partitions": [[1061,210,1189,210]]},
  {"id": "S-SEAT", "door": "", "name": "Seating and reception", "type": "common", "wing": "South", "label": "Seating /\nreception", "keywords": "", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[871,196],[1057,196],[1057,300],[964,300],[964,471],[793,471],[793,300],[871,300]], "doors": [[960,245]]},
  {"id": "S-LOBBY", "door": "", "name": "Building lobby", "type": "common", "wing": "South", "label": "Building lobby", "keywords": "main lobby entrance", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[880,820],[1136,820],[1136,1000],[880,1000]], "doors": [[1000,900]]},
  {"id": "S-CAFE", "door": "", "name": "Cafe and common area", "type": "common", "wing": "South", "label": "Cafe /\ncommon", "keywords": "cafe coffee food seating", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1136,814],[1371,814],[1371,1057],[1300,1057],[1290,1093],[1210,1093],[1200,1057],[1136,1057]], "doors": [[1250,930]]},
  {"id": "S-STAIR-W", "door": "", "name": "Stair (west-center, south wing)", "type": "core", "wing": "South", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[461,618],[543,618],[543,768],[461,768]], "doors": [[500,768]], "stair": true},
  {"id": "S-STAIR-NE", "door": "", "name": "Stair (north-east, south wing)", "type": "core", "wing": "South", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1214,271],[1346,271],[1346,336],[1214,336]], "doors": [[1214,303]], "stair": true},
  {"id": "S-STAIR-E", "door": "", "name": "Stair (east side, near connector)", "type": "core", "wing": "South", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1164,679],[1293,679],[1293,771],[1164,771]], "doors": [[1230,771]], "stair": true},
  {"id": "S-REST", "door": "", "name": "Restrooms (south wing)", "type": "core", "wing": "South", "label": "Restrooms", "keywords": "bathroom toilet", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[650,610],[893,610],[893,764],[650,764]], "doors": [[770,764]], "restroom": true, "partitions": [[771,610,771,740]]},
  {"id": "S-ELEV", "door": "", "name": "Elevator (south wing)", "type": "core", "wing": "South", "label": "Elev.", "keywords": "lift", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[971,614],[1014,614],[1014,750],[971,750]], "doors": [[971,682]], "cars": [[971,614,43,68],[971,682,43,68]]},
  {"id": "CONN", "door": "", "name": "Outdoor walkway between the wings", "type": "connector", "wing": "Connector", "label": "Outdoor\nwalkway", "keywords": "bridge connector walkway between wings outside", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1450,735],[1681,735],[1681,845],[1450,845]], "doors": [[1565,790]]},
  {"id": "N01", "door": "", "name": "Classroom N01", "type": "classroom", "wing": "North", "label": "N01", "keywords": "", "where": "North wing, top, tiered seating, north end", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1800,550],[1971,550],[1971,714],[1800,714]], "doors": [[1885,714]], "seating": "tiered"},
  {"id": "N02", "door": "", "name": "Classroom N02", "type": "classroom", "wing": "North", "label": "N02", "keywords": "", "where": "North wing, east side, upper, flat seating", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[2107,696],[2275,696],[2275,871],[2107,871]], "doors": [[2107,745]], "seating": "flat"},
  {"id": "N03", "door": "", "name": "Classroom N03", "type": "classroom", "wing": "North", "label": "N03", "keywords": "", "where": "North wing, west column, first classroom from the top", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1696,814],[1850,814],[1850,1000],[1696,1000]], "doors": [[1850,900]], "seating": "flat"},
  {"id": "N04", "door": "", "name": "Classroom N04", "type": "classroom", "wing": "North", "label": "N04", "keywords": "", "where": "North wing, west column, second from the top", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1696,1007],[1850,1007],[1850,1121],[1696,1121]], "doors": [[1850,1060]], "seating": "flat"},
  {"id": "N05", "door": "", "name": "Classroom N05", "type": "classroom", "wing": "North", "label": "N05", "keywords": "", "where": "North wing, west column, third from the top", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1700,1125],[1850,1125],[1850,1246],[1700,1246]], "doors": [[1850,1185]], "seating": "flat"},
  {"id": "N06", "door": "", "name": "Classroom N06", "type": "classroom", "wing": "North", "label": "N06", "keywords": "", "where": "North wing, west column, bottom, near the south entry", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1696,1436],[1854,1436],[1854,1618],[1696,1618]], "doors": [[1854,1527]], "seating": "flat"},
  {"id": "N07", "door": "", "name": "Classroom N07", "type": "classroom", "wing": "North", "label": "N07", "keywords": "", "where": "North wing, south end, left of the pair", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1921,1489],[2068,1489],[2068,1614],[1921,1614]], "doors": [[1995,1489]], "seating": "table"},
  {"id": "N08", "door": "", "name": "Classroom N08", "type": "classroom", "wing": "North", "label": "N08", "keywords": "", "where": "North wing, south-east corner", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[2075,1443],[2196,1443],[2196,1618],[2075,1618]], "doors": [[2075,1465]], "seating": "flat"},
  {"id": "N-PULSE", "door": "", "name": "Pulse (reception and offices)", "type": "office", "wing": "North", "label": "Pulse", "keywords": "pulse reception", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1654,1257],[1850,1257],[1850,1429],[1654,1429]], "doors": [[1850,1300]], "partitions": [[1720,1257,1720,1300],[1654,1300,1720,1300],[1654,1386,1720,1386],[1720,1386,1720,1429],[1770,1365,1770,1429],[1770,1365,1850,1365]]},
  {"id": "N-IT", "door": "", "name": "IT suite", "type": "it", "wing": "North", "label": "IT suite", "keywords": "technology help computers", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1921,1118],[2196,1118],[2196,1243],[1921,1243]], "doors": [[1921,1180]], "partitions": [[2129,1118,2129,1157],[2129,1157,2196,1157],[2140,1157,2140,1243]]},
  {"id": "N-SVC", "door": "", "name": "Service center", "type": "service", "wing": "North", "label": "Service center", "keywords": "help desk", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1921,1254],[2196,1254],[2196,1429],[1921,1429]], "doors": [[1921,1340]], "partitions": [[1989,1300,2196,1300],[1989,1254,1989,1300],[2060,1254,2060,1300],[2130,1254,2130,1300]]},
  {"id": "N-CONF", "door": "", "name": "Conference room (dean and graduate)", "type": "conf", "wing": "North", "label": "Conf.\nroom", "keywords": "dean graduate meeting", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[2107,1039],[2200,1039],[2200,1107],[2107,1107]], "doors": [[2107,1073]], "seating": "table"},
  {"id": "N-ELEV", "door": "", "name": "Elevators (north wing)", "type": "core", "wing": "North", "label": "Elevators", "keywords": "lift", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1918,807],[2064,807],[2064,857],[1918,857]], "doors": [[1991,807]], "cars": [[1918,807,73,50],[1991,807,73,50]]},
  {"id": "N-REST", "door": "", "name": "Restrooms (north wing)", "type": "core", "wing": "North", "label": "Restrooms", "keywords": "bathroom toilet", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1918,857],[2064,857],[2064,1043],[1918,1043]], "doors": [[1918,950]], "restroom": true, "partitions": [[1918,950,2040,950]]},
  {"id": "N-STAIR-N", "door": "", "name": "Stair (north, north wing)", "type": "core", "wing": "North", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[2000,607],[2114,607],[2114,664],[2000,664]], "doors": [[2090,664]], "stair": true},
  {"id": "N-STAIR-S", "door": "", "name": "Stair (south, north wing)", "type": "core", "wing": "North", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1979,1625],[2143,1625],[2143,1700],[1979,1700]], "doors": [[1979,1660]], "stair": true},
  {"id": "N-VEST-W", "door": "", "name": "West entry vestibule (walkway side)", "type": "common", "wing": "North", "label": "West\nentry", "keywords": "entrance connector", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1679,693],[1793,693],[1793,807],[1679,807]], "doors": [[1736,760]]},
  {"id": "N-VEST-S", "door": "", "name": "South entry vestibule", "type": "common", "wing": "North", "label": "South\nentry", "keywords": "entrance", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[1796,1660],[1979,1660],[1979,1743],[1796,1743]], "doors": [[1890,1700]]},
  {"id": "N-SVC-ENT", "door": "", "name": "Service entrance", "type": "core", "wing": "North", "label": "Service\nentry", "keywords": "entrance delivery", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "shape": [[2107,886],[2215,886],[2215,929],[2107,929]], "doors": [[2150,907]]}
];
window.SPOTS = [
  {"id": "P-LOBBY", "label": "South wing building lobby", "keywords": "lobby main entrance", "photo": "", "verified": false, "x": 960, "y": 960},
  {"id": "P-CAFE-ENT", "label": "East doors by the cafe", "keywords": "entrance door cafe east walkway", "photo": "", "verified": false, "x": 1395, "y": 768},
  {"id": "P-W-DOOR", "label": "West door, south wing (verify on site)", "keywords": "entrance door west", "photo": "", "verified": false, "x": 200, "y": 800},
  {"id": "P-STAIR-W", "label": "Stair, west-center of south wing", "keywords": "stairs", "photo": "", "verified": false, "x": 500, "y": 795},
  {"id": "P-BRIDGE", "label": "Outdoor walkway between the wings", "keywords": "bridge walkway between wings outside", "photo": "", "verified": false, "x": 1495, "y": 818},
  {"id": "P-N-ELEV", "label": "North wing elevator lobby", "keywords": "elevator lift", "photo": "", "verified": false, "x": 1990, "y": 780},
  {"id": "P-N-SOUTH", "label": "North wing south entry", "keywords": "entrance door south", "photo": "", "verified": false, "x": 1950, "y": 1725}
];

// ---------- Entrances ----------
// These appear in the "I'm entering from..." list and as green markers on the map.
// x and y are where the outside door is. "guess": true means traced from the brochure
// and not yet checked on site. Change it to false after you walk it.
window.ENTRANCES = [
  {"id": "E-S-WEST", "name": "West door (south wing)", "x": 100, "y": 800, "guess": true, "note": "Door in the west wall at the end of the main hallway."},
  {"id": "E-S-NORTH", "name": "North entry (south wing, by reception)", "x": 852, "y": 190, "guess": true, "note": "Brochure shows an entry vestibule next to the seating area. Exact door spot not clear."},
  {"id": "E-S-LOBBY", "name": "Main lobby doors (south side)", "x": 932, "y": 1062, "guess": true, "note": "Double doors in the bump-out below the building lobby."},
  {"id": "E-S-EAST", "name": "East doors (south wing, by the cafe)", "x": 1452, "y": 790, "guess": true, "note": "Vestibule that opens onto the outdoor walkway to the north wing."},
  {"id": "E-N-BRIDGE", "name": "North wing west doors (walkway side)", "x": 1679, "y": 780, "guess": true, "note": "Entry vestibule at the north end of the outdoor walkway."},
  {"id": "E-N-SOUTH", "name": "North wing south entry", "x": 1892, "y": 1752, "guess": true, "note": "Entry vestibule at the south end of the north wing."},
  {"id": "E-N-SERVICE", "name": "Service entrance (north wing, east side)", "x": 2280, "y": 915, "guess": true, "note": "May be staff only."}
];

// ---------- Walkable path network ----------
// nodes: points along hallways (corners, junctions, ends). "name" is what the
//   step-by-step directions say when the route passes that point.
// edges: straight hallway lines between two nodes ("from" and "to" are node ids).
//   "kind" can be "hall" (default), "outdoor" (walking outside), "steps" (a few steps in a hallway),
//   or "stair" (a staircase to another floor). The accessible route skips "steps" and "stair".
// Where a door joins a hallway line, the directions name it after the line's "to" end,
// so short lines from an entrance are written pointing into the building.
// You do NOT wire up room doors or entrances here. The map joins each one to the
// nearest hallway line by itself. To move a door, change that room's "doors" list.
// "guess": true = I could not see it clearly on the brochure. Please check on site.
window.PATHS = {
  "nodes": [
    // South wing, main east-west hallway (west door to the east doors)
    {"id": "s_main_w", "x": 125, "y": 800, "name": "Main hallway (south wing)"},
    {"id": "s_main_vw", "x": 348, "y": 800, "name": "Main hallway (south wing)"},
    {"id": "s_main_e", "x": 925, "y": 800, "name": "Main hallway, by the elevator lobby"},
    {"id": "s_main_lobby", "x": 1000, "y": 800, "name": "Main hallway, at the building lobby"},
    {"id": "s_main_s1", "x": 1118, "y": 790, "name": "Main hallway, by Stair 1"},
    {"id": "s_main_cafe", "x": 1250, "y": 795, "name": "Main hallway, at the cafe"},
    {"id": "s_east_vest", "x": 1410, "y": 790, "name": "East vestibule (south wing)"},
    // South wing, hallway between the classrooms and the stairs/restrooms
    {"id": "s_up_w", "x": 225, "y": 592, "name": "North hallway (south wing)", "guess": true},
    {"id": "s_up_vw", "x": 348, "y": 592, "name": "North hallway (south wing)"},
    {"id": "s_up_e", "x": 925, "y": 592, "name": "Hallway by S09 and S10"},
    // South wing, advising hallway and reception
    {"id": "s_adv_w", "x": 420, "y": 462, "name": "Advising hallway", "guess": true},
    {"id": "s_recep", "x": 925, "y": 462, "name": "Reception area"},
    {"id": "s_seat", "x": 960, "y": 245, "name": "Seating area by the north entry"},
    {"id": "s_nvest", "x": 852, "y": 230, "name": "North entry vestibule", "guess": true},
    {"id": "s_ne_hall", "x": 1100, "y": 315, "name": "Hall by Stair 2", "guess": true},
    {"id": "s_stair2", "x": 1190, "y": 310, "name": "Hall by Stair 2", "guess": true},
    {"id": "s_ne_pass", "x": 1148, "y": 365, "name": "Passage to the back of S11", "guess": true},
    {"id": "s_vest", "x": 1118, "y": 700, "name": "Vestibule by Stair 1", "guess": true},
    // South wing, lobby and cafe (open areas)
    {"id": "s_lobby", "x": 1000, "y": 900, "name": "Building lobby"},
    {"id": "s_lobby_door", "x": 932, "y": 1010, "name": "Lobby doors"},
    {"id": "s_cafe", "x": 1250, "y": 930, "name": "Cafe"},
    // Outdoor walkway between the wings (Level 1 has no indoor link; the enclosed bridge is on Level 2)
    {"id": "walk_s", "x": 1455, "y": 790, "name": "East doors (south wing)"},
    {"id": "walk_n", "x": 1675, "y": 780, "name": "North wing west doors"},
    // North wing
    {"id": "n_vest", "x": 1736, "y": 770, "name": "Entry vestibule (north wing)"},
    {"id": "n_lobby_w", "x": 1882, "y": 770, "name": "Elevator lobby (north wing)"},
    {"id": "n_lobby_e", "x": 2085, "y": 770, "name": "Elevator lobby, east end"},
    {"id": "n_stair3", "x": 2090, "y": 690, "name": "Hall by Stair 3", "guess": true},
    {"id": "n_main_mid", "x": 1882, "y": 1180, "name": "Main hallway (north wing)"},
    {"id": "n_main_s", "x": 1882, "y": 1460, "name": "Main hallway (north wing)"},
    {"id": "n_main_end", "x": 1882, "y": 1640, "name": "South end of the north wing"},
    {"id": "n_vest_s", "x": 1892, "y": 1700, "name": "South entry vestibule (north wing)"},
    {"id": "n_stair4", "x": 1960, "y": 1650, "name": "Hall by Stair 4", "guess": true},
    {"id": "n_south_e", "x": 2075, "y": 1460, "name": "Hall by N07 and N08", "guess": true},
    {"id": "n_east_svc", "x": 2085, "y": 907, "name": "East hallway, by the service entrance", "guess": true},
    {"id": "n_east_end", "x": 2085, "y": 1100, "name": "East hallway, by the conference room", "guess": true},
    {"id": "n_svc_door", "x": 2240, "y": 907, "name": "Service entrance", "guess": true}
  ],
  "edges": [
    {"from": "s_main_w", "to": "s_main_vw"},
    {"from": "s_main_vw", "to": "s_main_e"},
    {"from": "s_main_e", "to": "s_main_lobby"},
    {"from": "s_main_lobby", "to": "s_main_s1"},
    {"from": "s_main_s1", "to": "s_main_cafe"},
    {"from": "s_main_cafe", "to": "s_east_vest"},
    {"from": "s_up_w", "to": "s_up_vw", "guess": true},
    {"from": "s_up_vw", "to": "s_up_e"},
    {"from": "s_up_vw", "to": "s_main_vw"},
    {"from": "s_up_e", "to": "s_main_e"},
    {"from": "s_adv_w", "to": "s_recep", "guess": true},
    {"from": "s_recep", "to": "s_up_e"},
    {"from": "s_recep", "to": "s_seat"},
    {"from": "s_nvest", "to": "s_seat", "guess": true},
    {"from": "s_seat", "to": "s_ne_hall", "guess": true},
    {"from": "s_ne_hall", "to": "s_stair2", "guess": true},
    {"from": "s_ne_hall", "to": "s_ne_pass", "guess": true},
    {"from": "s_main_s1", "to": "s_vest", "guess": true},
    {"from": "s_main_lobby", "to": "s_lobby"},
    {"from": "s_lobby_door", "to": "s_lobby"},
    {"from": "s_lobby", "to": "s_cafe"},
    {"from": "s_main_cafe", "to": "s_cafe"},
    {"from": "walk_s", "to": "s_east_vest", "guess": true},
    {"from": "walk_s", "to": "walk_n", "kind": "outdoor", "guess": true},
    {"from": "walk_n", "to": "n_vest"},
    {"from": "n_vest", "to": "n_lobby_w"},
    {"from": "n_lobby_w", "to": "n_lobby_e"},
    {"from": "n_lobby_e", "to": "n_stair3", "guess": true},
    {"from": "n_lobby_w", "to": "n_main_mid"},
    {"from": "n_main_mid", "to": "n_main_s"},
    {"from": "n_main_s", "to": "n_main_end"},
    {"from": "n_vest_s", "to": "n_main_end"},
    {"from": "n_main_end", "to": "n_stair4", "guess": true},
    {"from": "n_main_s", "to": "n_south_e", "guess": true},
    {"from": "n_lobby_e", "to": "n_east_svc", "guess": true},
    {"from": "n_east_svc", "to": "n_east_end", "guess": true},
    {"from": "n_svc_door", "to": "n_east_svc", "guess": true}
  ]
};
