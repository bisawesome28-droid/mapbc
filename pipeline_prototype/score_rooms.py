#!/usr/bin/env python3
"""Score extracted classrooms against room centers marked by hand on the plan.

Ground truth here is my own reading of the plan (one point per classroom), so
treat the numbers as a rough check, not a lab result.
"""
import json
import sys

import cv2
import numpy as np

SCALE = 1.36  # points below were read off a 2000px-wide view of the 2722px image

# approximate center of each of the 19 classrooms, on the 2000px-wide view
GT_DISPLAY = {
    "S01": (100, 355), "S02": (245, 355), "S03": (160, 500), "S04": (150, 665),
    "S05": (305, 715), "S06": (425, 665), "S07": (518, 665), "S08": (603, 665),
    "S09": (770, 325), "S10": (770, 405), "S11": (910, 390),
    "N01": (1385, 460), "N02": (1607, 575), "N03": (1300, 660), "N04": (1300, 775),
    "N05": (1300, 870), "N06": (1300, 1120), "N07": (1465, 1140), "N08": (1567, 1125),
}


def main(path):
    data = json.load(open(path))
    regs = [r for r in data["regions"] if r["type"] == "classroom"]
    polys = [np.array(r["polygon"], dtype=np.int32).reshape(-1, 1, 2) for r in regs]
    gt = {k: (v[0] * SCALE, v[1] * SCALE) for k, v in GT_DISPLAY.items()}

    inside = {i: [] for i in range(len(regs))}
    missed = []
    for k, (x, y) in gt.items():
        hit = False
        for i, p in enumerate(polys):
            if cv2.pointPolygonTest(p, (float(x), float(y)), False) >= 0:
                inside[i].append(k)
                hit = True
        if not hit:
            missed.append(k)

    exact = []
    for k in gt:
        covering = [i for i, v in inside.items() if k in v]
        # correct only if exactly one region covers the room and that region covers nothing else
        if len(covering) == 1 and len(inside[covering[0]]) == 1:
            exact.append((regs[covering[0]]["id"], k))
    overlapped = [k for k in gt if len([i for i, v in inside.items() if k in v]) > 1]
    merged = [(regs[i]["id"], v) for i, v in inside.items() if len(v) >= 2]
    fragments = [regs[i]["id"] for i, v in inside.items() if len(v) == 0]
    # a classroom hit by exactly one region that holds only that room counts as correct
    print("classroom regions found:", len(regs), "| rooms on the plan:", len(gt))
    print("correct one-to-one:", len(exact), "of", len(gt), exact)
    print("merged (one region covers several rooms):", merged)
    print("covered by more than one region (overlap or over-split):", overlapped)
    print("missed (no region on the room):", missed)
    print("fragments (region on no room center, usually an over-split):", fragments)


if __name__ == "__main__":
    main(sys.argv[1])
