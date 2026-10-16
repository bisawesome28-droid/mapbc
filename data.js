// Everything the map shows comes from this file.
// To add a real door number, change "door": "" for that room, for example "door": "S195".
// Fill in "near" (nearest landmark) and "directions" the same way, and set "verified": true after checking on site.
// To show a photo, put the file in a photos folder and set "photo": "photos/name.jpg".
// "id" (like S01) is only an internal name. Leave it alone. The real room number goes in "door".
// "doors" lists where each door of the room is, as [x, y] points on the map. Routes end there.
//   All door positions are guesses traced from the brochure. Fix them after walking the building.
// Map coordinates: x grows to the right, y grows downward. The whole map is
//   about 10 to 1000 wide and 40 to 790 tall. Tick "Show path network" on the page to see points.
window.BUILDING = {
  "name": "Stokes Hall",
  "level": "Level 1",
  "note": "Simplified schematic. Room IDs are placeholders until real door numbers are added."
};
window.SHELLS = [[30, 165, 570, 305], [190, 52, 335, 115], [595, 318, 132, 50], [715, 235, 275, 515]];
window.ROOMS = [
  {"id": "S01", "door": "", "name": "Classroom S01", "type": "classroom", "wing": "South", "label": "S01", "keywords": "", "where": "South wing, top-left corner, tiered seating, left of S02", "near": "", "directions": "", "verified": false, "photo": "", "x": 32, "y": 168, "w": 78, "h": 80, "doors": [[71, 248]]},
  {"id": "S02", "door": "", "name": "Classroom S02", "type": "classroom", "wing": "South", "label": "S02", "keywords": "", "where": "South wing, top-left, flat seating, right of S01", "near": "", "directions": "", "verified": false, "photo": "", "x": 112, "y": 168, "w": 68, "h": 80, "doors": [[146, 248]]},
  {"id": "S03", "door": "", "name": "Classroom S03", "type": "classroom", "wing": "South", "label": "S03", "keywords": "", "where": "South wing, west side, middle, tiered seating", "near": "", "directions": "", "verified": false, "photo": "", "x": 52, "y": 263, "w": 90, "h": 68, "doors": [[97, 331]]},
  {"id": "S04", "door": "", "name": "Classroom S04", "type": "classroom", "wing": "South", "label": "S04", "keywords": "", "where": "South wing, west side, lower, flat seating", "near": "", "directions": "", "verified": false, "photo": "", "x": 52, "y": 358, "w": 90, "h": 68, "doors": [[97, 358]]},
  {"id": "S05", "door": "", "name": "Classroom S05", "type": "classroom", "wing": "South", "label": "S05", "keywords": "", "where": "South wing, bottom left of center, tiered seating", "near": "", "directions": "", "verified": false, "photo": "", "x": 145, "y": 383, "w": 75, "h": 82, "doors": [[182, 383]]},
  {"id": "S06", "door": "", "name": "Classroom S06", "type": "classroom", "wing": "South", "label": "S06", "keywords": "", "where": "South wing, south side, first of three in a row (west)", "near": "", "directions": "", "verified": false, "photo": "", "x": 222, "y": 358, "w": 55, "h": 68, "doors": [[249, 358]]},
  {"id": "S07", "door": "", "name": "Classroom S07", "type": "classroom", "wing": "South", "label": "S07", "keywords": "", "where": "South wing, south side, middle of the row of three", "near": "", "directions": "", "verified": false, "photo": "", "x": 278, "y": 358, "w": 52, "h": 68, "doors": [[304, 358]]},
  {"id": "S08", "door": "", "name": "Classroom S08", "type": "classroom", "wing": "South", "label": "S08", "keywords": "", "where": "South wing, south side, last of three (east)", "near": "", "directions": "", "verified": false, "photo": "", "x": 330, "y": 358, "w": 53, "h": 68, "doors": [[356, 358]]},
  {"id": "S09", "door": "", "name": "Classroom S09", "type": "classroom", "wing": "South", "label": "S09", "keywords": "", "where": "South wing, center-east, upper of two stacked rooms", "near": "", "directions": "", "verified": false, "photo": "", "x": 420, "y": 168, "w": 68, "h": 48, "doors": [[420, 192]]},
  {"id": "S10", "door": "", "name": "Classroom S10", "type": "classroom", "wing": "South", "label": "S10", "keywords": "", "where": "South wing, center-east, lower of the two stacked rooms", "near": "", "directions": "", "verified": false, "photo": "", "x": 420, "y": 217, "w": 68, "h": 48, "doors": [[420, 241]]},
  {"id": "S11", "door": "", "name": "Large tiered classroom S11", "type": "classroom", "wing": "South", "label": "S11", "keywords": "lecture hall", "where": "South wing, east side, largest tiered classroom, near the connector", "near": "", "directions": "", "verified": false, "photo": "", "x": 490, "y": 170, "w": 93, "h": 122, "doors": [[510, 292], [536, 170]]},
  {"id": "S-ADV-N", "door": "", "name": "Advising offices (north row)", "type": "office", "wing": "South", "label": "Advising\noffices", "keywords": "academic advising first year experience", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 192, "y": 88, "w": 166, "h": 38, "doors": [[358, 118]]},
  {"id": "S-ADV-M", "door": "", "name": "Advising offices and workstations", "type": "office", "wing": "South", "label": "Advising\noffices", "keywords": "academic advising first year experience", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 208, "y": 135, "w": 168, "h": 60, "doors": [[376, 165]]},
  {"id": "S-ADV-S", "door": "", "name": "Advising offices (south row)", "type": "office", "wing": "South", "label": "Advising\noffices", "keywords": "academic advising first year experience", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 208, "y": 200, "w": 177, "h": 50, "doors": [[300, 250]]},
  {"id": "S-SEM", "door": "", "name": "Seminar room", "type": "office", "wing": "South", "label": "Seminar\nroom", "keywords": "", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 460, "y": 55, "w": 55, "h": 70, "doors": [[487, 125]]},
  {"id": "S-SEAT", "door": "", "name": "Seating and reception", "type": "common", "wing": "South", "label": "Seating /\nreception", "keywords": "", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 380, "y": 85, "w": 80, "h": 65, "doors": [[420, 118]]},
  {"id": "S-LOBBY", "door": "", "name": "Building lobby", "type": "common", "wing": "South", "label": "Building lobby", "keywords": "main lobby entrance", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 395, "y": 370, "w": 105, "h": 45, "doors": [[447, 392]]},
  {"id": "S-CAFE", "door": "", "name": "Cafe and common area", "type": "common", "wing": "South", "label": "Cafe /\ncommon", "keywords": "cafe coffee food seating", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 500, "y": 360, "w": 95, "h": 105, "doors": [[548, 412]]},
  {"id": "S-STAIR-W", "door": "", "name": "Stair (west-center, south wing)", "type": "core", "wing": "South", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 200, "y": 265, "w": 34, "h": 60, "doors": [[217, 265]]},
  {"id": "S-STAIR-NE", "door": "", "name": "Stair (north-east, south wing)", "type": "core", "wing": "South", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 525, "y": 120, "w": 40, "h": 14, "doors": [[525, 134]]},
  {"id": "S-STAIR-E", "door": "", "name": "Stair (east side, near connector)", "type": "core", "wing": "South", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 525, "y": 320, "w": 32, "h": 22, "doors": [[525, 331]]},
  {"id": "S-REST", "door": "", "name": "Restrooms (south wing)", "type": "core", "wing": "South", "label": "Restrooms", "keywords": "bathroom toilet", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 310, "y": 270, "w": 75, "h": 60, "doors": [[348, 330]]},
  {"id": "S-ELEV", "door": "", "name": "Elevator (south wing)", "type": "core", "wing": "South", "label": "Elev.", "keywords": "lift", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 418, "y": 268, "w": 32, "h": 52, "doors": [[418, 294]]},
  {"id": "CONN", "door": "", "name": "Connector bridge", "type": "connector", "wing": "Connector", "label": "Connector\nbridge", "keywords": "bridge walkway between wings", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 595, "y": 318, "w": 132, "h": 50, "doors": [[661, 340]]},
  {"id": "N01", "door": "", "name": "Classroom N01", "type": "classroom", "wing": "North", "label": "N01", "keywords": "", "where": "North wing, top, tiered seating, north end", "near": "", "directions": "", "verified": false, "photo": "", "x": 778, "y": 238, "w": 78, "h": 75, "doors": [[817, 313]]},
  {"id": "N02", "door": "", "name": "Classroom N02", "type": "classroom", "wing": "North", "label": "N02", "keywords": "", "where": "North wing, east side, upper, flat seating", "near": "", "directions": "", "verified": false, "photo": "", "x": 913, "y": 300, "w": 73, "h": 78, "doors": [[913, 340]]},
  {"id": "N03", "door": "", "name": "Classroom N03", "type": "classroom", "wing": "North", "label": "N03", "keywords": "", "where": "North wing, west column, first classroom from the top", "near": "", "directions": "", "verified": false, "photo": "", "x": 733, "y": 350, "w": 70, "h": 83, "doors": [[803, 392]]},
  {"id": "N04", "door": "", "name": "Classroom N04", "type": "classroom", "wing": "North", "label": "N04", "keywords": "", "where": "North wing, west column, second from the top", "near": "", "directions": "", "verified": false, "photo": "", "x": 733, "y": 435, "w": 70, "h": 53, "doors": [[803, 462]]},
  {"id": "N05", "door": "", "name": "Classroom N05", "type": "classroom", "wing": "North", "label": "N05", "keywords": "", "where": "North wing, west column, third from the top", "near": "", "directions": "", "verified": false, "photo": "", "x": 733, "y": 490, "w": 70, "h": 50, "doors": [[803, 515]]},
  {"id": "N06", "door": "", "name": "Classroom N06", "type": "classroom", "wing": "North", "label": "N06", "keywords": "", "where": "North wing, west column, bottom, near the south entry", "near": "", "directions": "", "verified": false, "photo": "", "x": 733, "y": 622, "w": 70, "h": 90, "doors": [[803, 667]]},
  {"id": "N07", "door": "", "name": "Classroom N07", "type": "classroom", "wing": "North", "label": "N07", "keywords": "", "where": "North wing, south end, left of the pair", "near": "", "directions": "", "verified": false, "photo": "", "x": 830, "y": 645, "w": 65, "h": 55, "doors": [[862, 645]]},
  {"id": "N08", "door": "", "name": "Classroom N08", "type": "classroom", "wing": "North", "label": "N08", "keywords": "", "where": "North wing, south-east corner", "near": "", "directions": "", "verified": false, "photo": "", "x": 898, "y": 622, "w": 60, "h": 82, "doors": [[898, 640]]},
  {"id": "N-PULSE", "door": "", "name": "Pulse (reception and offices)", "type": "office", "wing": "North", "label": "Pulse", "keywords": "pulse reception", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 715, "y": 543, "w": 88, "h": 78, "doors": [[803, 582]]},
  {"id": "N-IT", "door": "", "name": "IT suite", "type": "it", "wing": "North", "label": "IT suite", "keywords": "technology help computers", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 833, "y": 503, "w": 118, "h": 38, "doors": [[833, 522], [905, 503]]},
  {"id": "N-SVC", "door": "", "name": "Service center", "type": "service", "wing": "North", "label": "Service center", "keywords": "help desk", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 833, "y": 543, "w": 118, "h": 78, "doors": [[833, 582]]},
  {"id": "N-CONF", "door": "", "name": "Conference room (dean and graduate)", "type": "conf", "wing": "North", "label": "Conf.\nroom", "keywords": "dean graduate meeting", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 913, "y": 450, "w": 48, "h": 30, "doors": [[913, 465]]},
  {"id": "N-ELEV", "door": "", "name": "Elevators (north wing)", "type": "core", "wing": "North", "label": "Elevators", "keywords": "lift", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 830, "y": 350, "w": 65, "h": 20, "doors": [[862, 350]]},
  {"id": "N-REST", "door": "", "name": "Restrooms (north wing)", "type": "core", "wing": "North", "label": "Restrooms", "keywords": "bathroom toilet", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 833, "y": 390, "w": 62, "h": 60, "doors": [[833, 420]]},
  {"id": "N-STAIR-N", "door": "", "name": "Stair (north, north wing)", "type": "core", "wing": "North", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 864, "y": 272, "w": 44, "h": 28, "doors": [[886, 300]]},
  {"id": "N-STAIR-S", "door": "", "name": "Stair (south, north wing)", "type": "core", "wing": "North", "label": "Stair", "keywords": "stairs stairwell", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 860, "y": 710, "w": 55, "h": 25, "doors": [[860, 722]]},
  {"id": "N-VEST-W", "door": "", "name": "Bridge-side vestibule", "type": "common", "wing": "North", "label": "Bridge\nentry", "keywords": "entrance connector", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 727, "y": 305, "w": 45, "h": 40, "doors": [[749, 325]]},
  {"id": "N-VEST-S", "door": "", "name": "South entry vestibule", "type": "common", "wing": "North", "label": "South\nentry", "keywords": "entrance", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 780, "y": 715, "w": 65, "h": 30, "doors": [[812, 730]]},
  {"id": "N-SVC-ENT", "door": "", "name": "Service entrance", "type": "core", "wing": "North", "label": "Service\nentry", "keywords": "entrance delivery", "where": "", "near": "", "directions": "", "verified": false, "photo": "", "x": 915, "y": 385, "w": 44, "h": 25, "doors": [[937, 397]]}
];
window.SPOTS = [
  {"id": "P-LOBBY", "label": "South wing building lobby", "keywords": "lobby main entrance", "photo": "", "verified": false, "x": 447, "y": 430},
  {"id": "P-CAFE-ENT", "label": "South entrance by the cafe", "keywords": "entrance door cafe", "photo": "", "verified": false, "x": 570, "y": 447},
  {"id": "P-W-DOOR", "label": "West door, south wing (verify on site)", "keywords": "entrance door west", "photo": "", "verified": false, "x": 60, "y": 344},
  {"id": "P-STAIR-W", "label": "Stair, west-center of south wing", "keywords": "stairs", "photo": "", "verified": false, "x": 215, "y": 335},
  {"id": "P-BRIDGE", "label": "Connector bridge", "keywords": "bridge between wings", "photo": "", "verified": false, "x": 705, "y": 343},
  {"id": "P-N-ELEV", "label": "North wing elevator lobby", "keywords": "elevator lift", "photo": "", "verified": false, "x": 815, "y": 385},
  {"id": "P-N-SOUTH", "label": "North wing south entry", "keywords": "entrance door south", "photo": "", "verified": false, "x": 838, "y": 766}
];

// ---------- Entrances ----------
// These appear in the "I'm entering from..." list and as IN markers on the map.
// x and y are where the outside door is. "guess": true means traced from the brochure
// and not yet checked on site. Change it to false after you walk it.
window.ENTRANCES = [
  {"id": "E-S-WEST", "name": "West door (south wing)", "x": 32, "y": 344, "guess": true, "note": "Door in the west wall at the end of the main hallway."},
  {"id": "E-S-NORTH", "name": "North entry (south wing, by reception)", "x": 395, "y": 54, "guess": true, "note": "Brochure shows an entry vestibule next to the seating area. Exact door spot not clear."},
  {"id": "E-S-LOBBY", "name": "Main lobby doors (south side)", "x": 410, "y": 470, "guess": true, "note": "Brochure shows a doorway bump-out below the building lobby."},
  {"id": "E-S-CAFE", "name": "Cafe door (south side)", "x": 548, "y": 470, "guess": true, "note": "Might be a bay window, not a door. Check on site."},
  {"id": "E-N-BRIDGE", "name": "North wing door by the bridge", "x": 727, "y": 330, "guess": true, "note": "Entry vestibule at the north end of the connector bridge."},
  {"id": "E-N-SOUTH", "name": "North wing south entry", "x": 812, "y": 748, "guess": true, "note": "Entry vestibule at the south end of the north wing."},
  {"id": "E-N-SERVICE", "name": "Service entrance (north wing, east side)", "x": 988, "y": 397, "guess": true, "note": "May be staff only."}
];

// ---------- Walkable path network ----------
// nodes: points along hallways (corners, junctions, ends). "name" is what the
//   step-by-step directions say when the route passes that point.
// edges: straight hallway lines between two nodes ("from" and "to" are node ids).
//   "kind" can be "hall" (default), "steps" (a few steps in a hallway), or
//   "stair" (a staircase to another floor). The accessible route skips "steps" and "stair".
// You do NOT wire up room doors or entrances here. The map joins each one to the
// nearest hallway line by itself. To move a door, change that room's "doors" list.
// "guess": true = I could not see it clearly on the brochure. Please check on site.
window.PATHS = {
  "nodes": [
    // South wing, main east-west hallway (west door to the bridge)
    {"id": "s_main_w", "x": 45, "y": 344, "name": "Main hallway (south wing)"},
    {"id": "s_main_vw", "x": 160, "y": 344, "name": "Main hallway (south wing)"},
    {"id": "s_main_elev", "x": 405, "y": 344, "name": "Main hallway, by the elevator"},
    {"id": "s_main_lobby", "x": 447, "y": 344, "name": "Main hallway, at the building lobby"},
    {"id": "s_main_s1", "x": 510, "y": 344, "name": "Main hallway, by Stair 1"},
    {"id": "s_main_cafe", "x": 548, "y": 344, "name": "Main hallway, at the cafe"},
    {"id": "s_bridge_s", "x": 597, "y": 344, "name": "Connector bridge"},
    // South wing, hallway behind the north row of classrooms
    {"id": "s_up_w", "x": 60, "y": 256, "name": "North hallway (south wing)", "guess": true},
    {"id": "s_up_vw", "x": 160, "y": 256, "name": "North hallway (south wing)", "guess": true},
    {"id": "s_up_e", "x": 405, "y": 256, "name": "Hallway by S09 and S10"},
    // South wing, north-south hallway by the elevator, up to reception
    {"id": "s_recep", "x": 405, "y": 160, "name": "Reception area"},
    {"id": "s_seat", "x": 420, "y": 118, "name": "Seating and reception"},
    {"id": "s_nvest", "x": 395, "y": 75, "name": "North entry vestibule", "guess": true},
    {"id": "s_adv", "x": 380, "y": 122, "name": "Advising offices hallway", "guess": true},
    {"id": "s_stair2", "x": 520, "y": 148, "name": "Hall by Stair 2", "guess": true},
    // South wing, small vestibule between S11 and Stair 1
    {"id": "s_vest_s11", "x": 510, "y": 300, "name": "Vestibule by Stair 1", "guess": true},
    // South wing, lobby and cafe (open areas)
    {"id": "s_lobby", "x": 447, "y": 392, "name": "Building lobby"},
    {"id": "s_lobby_door", "x": 410, "y": 455, "name": "Lobby doors", "guess": true},
    {"id": "s_cafe", "x": 548, "y": 412, "name": "Cafe"},
    {"id": "s_cafe_door", "x": 548, "y": 455, "name": "Cafe doors", "guess": true},
    // North wing
    {"id": "n_bridge_n", "x": 727, "y": 330, "name": "Connector bridge"},
    {"id": "n_vest", "x": 750, "y": 330, "name": "Bridge-side vestibule (north wing)"},
    {"id": "n_lobby_w", "x": 817, "y": 332, "name": "Elevator lobby (north wing)"},
    {"id": "n_lobby_e", "x": 905, "y": 332, "name": "Elevator lobby (north wing)"},
    {"id": "n_main_it", "x": 817, "y": 522, "name": "Main hallway (north wing)"},
    {"id": "n_main_s", "x": 817, "y": 633, "name": "Main hallway (north wing)"},
    {"id": "n_main_end", "x": 817, "y": 712, "name": "South end of the north wing"},
    {"id": "n_vest_s", "x": 812, "y": 735, "name": "South entry vestibule (north wing)"},
    {"id": "n_stair4", "x": 850, "y": 712, "name": "Hall by Stair 4", "guess": true},
    {"id": "n_south_e", "x": 895, "y": 633, "name": "Hall by N07 and N08", "guess": true},
    {"id": "n_east_svc", "x": 905, "y": 397, "name": "East hallway, by the service entrance", "guess": true},
    {"id": "n_east_end", "x": 905, "y": 490, "name": "East hallway, by the conference room", "guess": true},
    {"id": "n_svc_door", "x": 960, "y": 397, "name": "Service entrance", "guess": true}
  ],
  "edges": [
    {"from": "s_main_w", "to": "s_main_vw"},
    {"from": "s_main_vw", "to": "s_main_elev"},
    {"from": "s_main_elev", "to": "s_main_lobby"},
    {"from": "s_main_lobby", "to": "s_main_s1"},
    {"from": "s_main_s1", "to": "s_main_cafe"},
    {"from": "s_main_cafe", "to": "s_bridge_s"},
    {"from": "s_up_w", "to": "s_up_vw", "guess": true},
    {"from": "s_up_vw", "to": "s_up_e", "guess": true},
    {"from": "s_up_vw", "to": "s_main_vw", "guess": true},
    {"from": "s_up_e", "to": "s_main_elev"},
    {"from": "s_up_e", "to": "s_recep"},
    {"from": "s_recep", "to": "s_seat"},
    {"from": "s_seat", "to": "s_nvest", "guess": true},
    {"from": "s_seat", "to": "s_stair2", "guess": true},
    {"from": "s_seat", "to": "s_adv", "guess": true},
    {"from": "s_main_s1", "to": "s_vest_s11", "guess": true},
    {"from": "s_main_lobby", "to": "s_lobby"},
    {"from": "s_lobby", "to": "s_lobby_door", "guess": true},
    {"from": "s_lobby", "to": "s_cafe"},
    {"from": "s_main_cafe", "to": "s_cafe"},
    {"from": "s_cafe", "to": "s_cafe_door", "guess": true},
    {"from": "s_bridge_s", "to": "n_bridge_n", "guess": true},
    {"from": "n_bridge_n", "to": "n_vest"},
    {"from": "n_vest", "to": "n_lobby_w"},
    {"from": "n_lobby_w", "to": "n_lobby_e"},
    {"from": "n_lobby_w", "to": "n_main_it"},
    {"from": "n_main_it", "to": "n_main_s"},
    {"from": "n_main_s", "to": "n_main_end"},
    {"from": "n_main_end", "to": "n_vest_s"},
    {"from": "n_main_end", "to": "n_stair4", "guess": true},
    {"from": "n_main_s", "to": "n_south_e", "guess": true},
    {"from": "n_lobby_e", "to": "n_east_svc", "guess": true},
    {"from": "n_east_svc", "to": "n_east_end", "guess": true},
    {"from": "n_east_svc", "to": "n_svc_door", "guess": true}
  ]
};
