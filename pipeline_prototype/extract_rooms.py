#!/usr/bin/env python3
"""Prototype step 2 of the campus map pipeline: find rooms in a floor plan image.

Idea: floor plans with a color legend can be read automatically. You point the
script at a few swatches in the legend, it learns each color, then finds every
region of that color in the plan, splits regions that are really several rooms
joined together, and writes the result as data plus a review overlay.

Usage example:
  python3 extract_rooms.py plan.png \
    --legend classroom:470,1447 --legend advising:470,1410 \
    --ignore 0,0,2722,95 --ignore 380,1270,1130,1520 \
    --split-x 1520 --out rooms.json --overlay overlay.png
"""
import argparse
import json
import sys

import cv2
import numpy as np
from skimage.segmentation import watershed


def parse_legend(items):
    out = []
    for it in items:
        parts = it.split(":")
        name = parts[0]
        x, y = (int(v) for v in parts[1].split(","))
        tol = float(parts[2]) if len(parts) > 2 else None
        out.append((name, x, y, tol))
    return out


def parse_box(s):
    x0, y0, x1, y1 = (int(v) for v in s.split(","))
    return x0, y0, x1, y1


def to_lab(bgr_uint8):
    f = bgr_uint8.astype(np.float32) / 255.0
    return cv2.cvtColor(f, cv2.COLOR_BGR2LAB)


def split_touching_rooms(comp_mask, min_core=150):
    """Split one blob into several rooms when thin necks join them.

    Erode the blob until it falls apart into separate cores, then grow the cores
    back out to the original outline (watershed). Returns a label image.
    """
    comp = comp_mask.astype(np.uint8)
    for k in range(5, 71, 4):
        ker = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
        er = cv2.erode(comp, ker)
        n, cc, st, _ = cv2.connectedComponentsWithStats(er, connectivity=4)
        big = [j for j in range(1, n) if st[j, 4] >= min_core]
        if not big:
            break
        if len(big) > 1:
            markers = np.zeros(comp.shape, dtype=np.int32)
            for idx, j in enumerate(big, 1):
                markers[cc == j] = idx
            dist = cv2.distanceTransform(comp, cv2.DIST_L2, 5)
            return watershed(-dist, markers, mask=comp.astype(bool))
    return comp.astype(np.int32)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("image")
    ap.add_argument("--legend", action="append", required=True,
                    help="name:x,y[:tol] pointing at a legend swatch (tol optional per type)")
    ap.add_argument("--ignore", action="append", default=[],
                    help="x0,y0,x1,y1 region to skip (header, legend, captions, titles)")
    ap.add_argument("--split-x", type=int, default=None,
                    help="x position that separates the left wing from the right wing")
    ap.add_argument("--tol", type=float, default=24.0, help="default max color distance (Lab)")
    ap.add_argument("--close", type=int, default=5, help="kernel that fills furniture lines inside rooms")
    ap.add_argument("--open", type=int, default=5, help="kernel that removes specks")
    ap.add_argument("--min-area", type=int, default=2500)
    ap.add_argument("--min-fill", type=float, default=0.45, help="drop shapes that are mostly empty (text outlines)")
    ap.add_argument("--wall-v", type=int, default=120, help="brightness below which a gray pixel may be a wall")
    ap.add_argument("--wall-s", type=int, default=100, help="color saturation below which a dark pixel may be a wall")
    ap.add_argument("--wall-len", type=int, default=45, help="min length of a dark line to count as a wall, not furniture")
    ap.add_argument("--min-core", type=int, default=700, help="min size of a room core when splitting merged rooms")
    ap.add_argument("--no-split", action="store_true", help="skip the room splitting step")
    ap.add_argument("--out", default="rooms.json")
    ap.add_argument("--overlay", default="overlay.png")
    args = ap.parse_args()

    img = cv2.imread(args.image, cv2.IMREAD_COLOR)
    if img is None:
        sys.exit("could not read image")
    H, W = img.shape[:2]
    lab = to_lab(img)
    hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

    legend = parse_legend(args.legend)
    names, seeds, tols = [], [], []
    for name, x, y, tol in legend:
        patch = img[max(0, y - 3):y + 4, max(0, x - 25):x + 25].reshape(-1, 3)
        med = np.median(patch, axis=0).astype(np.uint8).reshape(1, 1, 3)
        seeds.append(to_lab(med)[0, 0])
        names.append(name)
        tols.append(tol if tol is not None else args.tol)
    seeds = np.stack(seeds)

    dist = np.stack([np.linalg.norm(lab - s, axis=2) for s in seeds], axis=2)
    best = dist.argmin(axis=2)
    bestd = dist.min(axis=2)
    tol_map = np.array(tols, dtype=np.float32)[best]
    label = np.where(bestd < tol_map, best, -1)

    # walls and text: dark, low-color pixels. Removing them keeps neighboring rooms apart.
    dark = ((hsv[..., 2] < args.wall_v) & (hsv[..., 1] < args.wall_s)).astype(np.uint8)
    hk = cv2.getStructuringElement(cv2.MORPH_RECT, (args.wall_len, 1))
    vk = cv2.getStructuringElement(cv2.MORPH_RECT, (1, args.wall_len))
    walls = cv2.bitwise_or(cv2.morphologyEx(dark, cv2.MORPH_OPEN, hk),
                           cv2.morphologyEx(dark, cv2.MORPH_OPEN, vk))
    walls = cv2.dilate(walls, np.ones((3, 3), np.uint8))

    for box in args.ignore:
        x0, y0, x1, y1 = parse_box(box)
        label[y0:y1, x0:x1] = -1

    results = []
    ck = cv2.getStructuringElement(cv2.MORPH_RECT, (args.close, args.close))
    ok = cv2.getStructuringElement(cv2.MORPH_RECT, (args.open, args.open))

    for ti, tname in enumerate(names):
        mask = (label == ti).astype(np.uint8) * 255
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, ck)
        mask[walls > 0] = 0
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, ok)
        n, cc, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=4)
        for i in range(1, n):
            if stats[i, 4] < args.min_area:
                continue
            comp = (cc == i)
            parts = [comp.astype(np.int32)] if args.no_split else [split_touching_rooms(comp, args.min_core)]
            lab_img = parts[0]
            for pid in np.unique(lab_img):
                if pid == 0:
                    continue
                pm = (lab_img == pid).astype(np.uint8)
                area = int(pm.sum())
                if area < args.min_area:
                    continue
                pm = cv2.morphologyEx(pm, cv2.MORPH_OPEN, ok)
                cnts, _ = cv2.findContours(pm, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
                if not cnts:
                    continue
                cnt = max(cnts, key=cv2.contourArea)
                x, y, w, h = cv2.boundingRect(cnt)
                fill = float(cv2.contourArea(cnt)) / float(w * h)
                if fill < args.min_fill or min(w, h) < 28:
                    continue
                eps = 0.012 * cv2.arcLength(cnt, True)
                poly = cv2.approxPolyDP(cnt, eps, True).reshape(-1, 2).tolist()
                M = cv2.moments(cnt)
                cx, cy = M["m10"] / M["m00"], M["m01"] / M["m00"]
                wing = "unknown"
                if args.split_x is not None:
                    wing = "left" if cx < args.split_x else "right"
                results.append({
                    "type": tname, "wing": wing,
                    "bbox": [int(x), int(y), int(w), int(h)],
                    "centroid": [round(cx, 1), round(cy, 1)],
                    "area_px": int(cv2.contourArea(cnt)),
                    "fill_ratio": round(fill, 2),
                    "needs_review": bool(fill < 0.75),
                    "polygon": poly,
                })

    results.sort(key=lambda r: (r["wing"], r["bbox"][1] // 120, r["bbox"][0]))
    palette = [(0, 0, 255), (255, 120, 0), (0, 160, 0), (200, 0, 200), (0, 200, 200), (120, 120, 0), (0, 90, 160)]
    overlay = img.copy()
    for k, r in enumerate(results, 1):
        r["id"] = "R%02d" % k
        col = palette[names.index(r["type"]) % len(palette)]
        pts = np.array(r["polygon"], dtype=np.int32).reshape(-1, 1, 2)
        cv2.polylines(overlay, [pts], True, col, 5)
        cx, cy = (int(v) for v in r["centroid"])
        cv2.putText(overlay, r["id"], (cx - 32, cy + 9), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (0, 0, 0), 6, cv2.LINE_AA)
        cv2.putText(overlay, r["id"], (cx - 32, cy + 9), cv2.FONT_HERSHEY_SIMPLEX, 1.1, (255, 255, 255), 2, cv2.LINE_AA)

    cv2.imwrite(args.overlay, overlay)
    with open(args.out, "w") as f:
        json.dump({"image": args.image, "size": [W, H], "types": names, "regions": results}, f, indent=1)

    counts = {}
    for r in results:
        counts[(r["type"], r["wing"])] = counts.get((r["type"], r["wing"]), 0) + 1
    print("found", len(results), "regions,", sum(1 for r in results if r["needs_review"]), "flagged for review")
    for k in sorted(counts):
        print("  ", k[0], k[1], counts[k])


if __name__ == "__main__":
    main()
