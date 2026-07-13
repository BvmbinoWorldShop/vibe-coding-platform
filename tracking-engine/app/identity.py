"""Player identity: jersey-number OCR + team-color clustering.

Stable identity is what makes tracked stats trustworthy. BoT-SORT's ReID keeps
IDs through occlusion; on top of that we read each track's jersey number and
cluster torso colors into two teams, then merge tracks that share a confident
number (re-identifying a player even if their track id ever broke).

EasyOCR is optional — if it isn't installed, numbering is skipped and players
keep sequential numbers. Team-color clustering needs only numpy/opencv."""

from __future__ import annotations

import math
from collections import Counter, defaultdict
from typing import Optional

_reader = None


def _get_reader():
    global _reader
    if _reader is None:
        import easyocr  # lazy, optional

        _reader = easyocr.Reader(["en"], gpu=True, verbose=False)
    return _reader


def read_number_from_crop(crop) -> Optional[int]:
    """Read a 1–2 digit jersey number from a torso crop, or None."""
    try:
        import cv2

        reader = _get_reader()
        up = cv2.resize(crop, None, fx=2.0, fy=2.0, interpolation=cv2.INTER_CUBIC)
        results = reader.readtext(up, allowlist="0123456789", detail=1)
        best: Optional[int] = None
        best_conf = 0.0
        for _, text, conf in results:
            text = text.strip()
            if text.isdigit() and 1 <= len(text) <= 2 and conf > best_conf and conf > 0.4:
                best = int(text)
                best_conf = conf
        return best
    except Exception:
        return None


def torso_crop(frame, x1: int, y1: int, x2: int, y2: int):
    """Central upper region of a person box, where the number sits."""
    w = x2 - x1
    h = y2 - y1
    cx1 = int(x1 + w * 0.25)
    cx2 = int(x1 + w * 0.75)
    cy1 = int(y1 + h * 0.15)
    cy2 = int(y1 + h * 0.5)
    cy1 = max(0, cy1)
    cx1 = max(0, cx1)
    if cx2 <= cx1 or cy2 <= cy1:
        return None
    return frame[cy1:cy2, cx1:cx2]


def mean_color(crop) -> Optional[tuple[float, float, float]]:
    try:
        import numpy as np

        if crop is None or crop.size == 0:
            return None
        # OpenCV is BGR; return RGB.
        b, g, r = [float(np.mean(crop[:, :, c])) for c in range(3)]
        return (r, g, b)
    except Exception:
        return None


def rgb_to_hex(rgb: tuple[float, float, float]) -> str:
    return "#" + "".join(f"{max(0, min(255, int(v))):02x}" for v in rgb)


def _dist(a, b) -> float:
    return math.sqrt(sum((x - y) ** 2 for x, y in zip(a, b)))


def two_team_clusters(colors: dict[int, tuple]) -> dict[int, int]:
    """2-means over per-track mean jersey colors → team index {0,1} per track."""
    items = [(tid, c) for tid, c in colors.items() if c is not None]
    if len(items) < 2:
        return {tid: 0 for tid, _ in items}
    pts = [c for _, c in items]
    cA, cB = pts[0], pts[-1]
    assign = [0] * len(pts)
    for _ in range(6):
        for i, p in enumerate(pts):
            assign[i] = 0 if _dist(p, cA) <= _dist(p, cB) else 1
        for k, cur in ((0, "A"), (1, "B")):
            members = [pts[i] for i in range(len(pts)) if assign[i] == k]
            if members:
                c = tuple(sum(m[j] for m in members) / len(members) for j in range(3))
                if cur == "A":
                    cA = c
                else:
                    cB = c
    return {items[i][0]: assign[i] for i in range(len(items))}


def resolve_numbers(track_number_votes: dict[int, list[int]]) -> dict[int, Optional[int]]:
    """Most-voted number per track (needs >=2 agreeing reads to be trusted)."""
    out: dict[int, Optional[int]] = {}
    for tid, votes in track_number_votes.items():
        if not votes:
            out[tid] = None
            continue
        num, count = Counter(votes).most_common(1)[0]
        out[tid] = num if count >= 2 else None
    return out


def merge_by_number(track_numbers: dict[int, Optional[int]]) -> dict[int, list[int]]:
    """Group track ids that share a confident jersey number (re-identification
    across any ID break). Returns number-or-synthetic-key -> [track ids]."""
    groups: dict[str, list[int]] = defaultdict(list)
    for tid, num in track_numbers.items():
        key = f"num:{num}" if num is not None else f"trk:{tid}"
        groups[key].append(tid)
    return groups
