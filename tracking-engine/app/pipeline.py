"""The pro tracking pipeline.

This is the "expensive" part that a browser can't do well: a purpose-built
object detector (YOLOv8, COCO person + sports ball) with a real multi-object
tracker (ByteTrack) that keeps stable IDs through contact and occlusion,
homography from marked court corners for true metric speed/distance, and a
ball-vs-rim shot detector. Everything here is open source and runs on your own
GPU — there is no paid computer-vision API.

Heavy deps (ultralytics/torch/opencv) are imported lazily so the FastAPI app
still starts (health check, schema) on a machine that hasn't installed them.
"""

from __future__ import annotations

import math
import uuid
from collections import defaultdict
from typing import Callable, Optional

from .schemas import AnalyzeOptions, AnalysisResult, RosterPlayer

# COCO class ids used by YOLOv8.
CLS_PERSON = 0
CLS_BALL = 32

PALETTE = [
    "#f97316", "#22c55e", "#3b82f6", "#eab308", "#ec4899",
    "#a855f7", "#14b8a6", "#ef4444", "#84cc16", "#06b6d4",
]


def _homography(corners):
    """Build an image->court(meters) transform from 4 marked corners."""
    import cv2  # noqa: WPS433 (lazy import)
    import numpy as np

    src = np.array([[c.x, c.y] for c in corners], dtype="float32")
    dst = np.array([[c.court_x_m, c.court_y_m] for c in corners], dtype="float32")
    return cv2.getPerspectiveTransform(src, dst)


def _to_court(H, x, y):
    import numpy as np

    p = np.array([[[x, y]]], dtype="float32")
    import cv2

    out = cv2.perspectiveTransform(p, H)
    return float(out[0][0][0]), float(out[0][0][1])


def analyze_video(
    path: str,
    opts: AnalyzeOptions,
    on_progress: Optional[Callable[[float, str], None]] = None,
) -> AnalysisResult:
    from ultralytics import YOLO  # lazy
    import cv2

    def progress(p, m=""):
        if on_progress:
            on_progress(p, m)

    progress(0.02, "loading detector")
    model = YOLO(f"{opts.detector}.pt")

    cap = cv2.VideoCapture(path)
    src_fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    W = cap.get(cv2.CAP_PROP_FRAME_WIDTH) or 1280
    Hh = cap.get(cv2.CAP_PROP_FRAME_HEIGHT) or 720
    cap.release()

    step = max(1, int(round(src_fps / max(opts.fps_sample, 1e-3))))
    H = _homography(opts.corners) if len(opts.corners) == 4 else None

    # ByteTrack keeps IDs stable across frames/occlusion. classes= restricts to
    # people + ball so nothing else is tracked. persist=True across the stream.
    progress(0.05, "tracking")
    tracks: dict[int, list[dict]] = defaultdict(list)  # track_id -> samples
    ball_path: list[dict] = []
    frame_idx = 0

    results = model.track(
        source=path,
        tracker="bytetrack.yaml",
        classes=[CLS_PERSON, CLS_BALL],
        stream=True,
        persist=True,
        verbose=False,
    )
    for r in results:
        if frame_idx % step != 0:
            frame_idx += 1
            continue
        t = frame_idx / src_fps
        if r.boxes is not None and r.boxes.id is not None:
            ids = r.boxes.id.int().tolist()
            clss = r.boxes.cls.int().tolist()
            xywh = r.boxes.xywh.tolist()  # center x,y,w,h in pixels
            for tid, cls, (cx, cy, bw, bh) in zip(ids, clss, xywh):
                nx, ny = cx / W, cy / Hh
                if cls == CLS_BALL:
                    ball_path.append({"t": t, "x": nx, "y": ny})
                elif cls == CLS_PERSON:
                    foot_x, foot_y = cx, cy + bh / 2
                    court = _to_court(H, foot_x, foot_y) if H is not None else None
                    tracks[tid].append({"t": t, "x": nx, "y": ny, "court": court})
        if total:
            progress(0.05 + 0.7 * (frame_idx / total), "tracking")
        frame_idx += 1

    duration = frame_idx / src_fps

    # Keep only tracks that persisted long enough to be a real player.
    stable = {tid: s for tid, s in tracks.items() if len(s) >= 5}
    progress(0.78, "computing movement")

    roster: list[RosterPlayer] = []
    movement: dict[str, dict] = {}
    id_map: dict[int, str] = {}
    for i, (tid, samples) in enumerate(sorted(stable.items())):
        pid = str(uuid.uuid4())
        id_map[tid] = pid
        number = i + 1
        roster.append(
            RosterPlayer(
                id=pid,
                name=f"Player {number}",
                number=number,
                team="Tracked",
                color=PALETTE[i % len(PALETTE)],
            )
        )
        dist = 0.0
        max_speed = 0.0
        for a, b in zip(samples, samples[1:]):
            if a["court"] and b["court"]:
                dx = b["court"][0] - a["court"][0]
                dy = b["court"][1] - a["court"][1]
                d = math.hypot(dx, dy)
                dt = b["t"] - a["t"]
                if 0 < dt < 2 and d < 12:  # sane bounds
                    dist += d
                    max_speed = max(max_speed, d / dt)
        movement[pid] = {
            "distanceM": round(dist, 1),
            "maxSpeedKmh": round(max_speed * 3.6, 1),
            "strides": round(dist / 2.5) if dist else 0,
        }

    # Shot detection from the ball path vs the marked rim.
    progress(0.9, "detecting shots")
    events = _detect_shots(ball_path, opts, id_map, stable)

    points = sum(
        {"fg2m": 2, "fg3m": 3, "ftm": 1}.get(e["type"], 0) for e in events
    )
    session = {
        "id": str(uuid.uuid4()),
        "date": __import__("datetime").date.today().isoformat(),
        "opponent": "Tracked session",
        "location": "home",
        "source": "ai",
        "events": events,
        "movement": movement,
        "teamScore": points,
        "oppScore": 0,
        "durationS": round(duration, 1),
    }
    progress(1.0, "done")
    return AnalysisResult(roster=roster, session=session)


def _detect_shots(ball_path, opts: AnalyzeOptions, id_map, stable):
    """A shot = the ball approaching the rim from above and dropping through
    its column (make) or leaving without dropping (miss). Attributed to the
    person nearest the ball just before the attempt."""
    events = []
    if not opts.hoop or len(ball_path) < 3:
        return events
    hx, hy = opts.hoop["x"], opts.hoop["y"]
    last_t = -1e9
    for i in range(2, len(ball_path)):
        p = ball_path[i]
        near = math.hypot(p["x"] - hx, p["y"] - hy) < 0.07
        if not near or p["t"] - last_t < 3:
            continue
        window = ball_path[max(0, i - 6): i + 4]
        came_above = any(w["y"] < hy - 0.01 and abs(w["x"] - hx) < 0.07 for w in window)
        dropped = any(w["y"] > hy + 0.02 and abs(w["x"] - hx) < 0.07 for w in window[-4:])
        made = came_above and dropped
        shooter = _nearest_person(p, opts, id_map, stable)
        if shooter:
            events.append({
                "id": str(uuid.uuid4()),
                "t": round(p["t"], 2),
                "playerId": shooter,
                "type": "fg2m" if made else "fg2x",
                "shot": {"x": round(hx * 100, 1), "y": round(hy * 100, 1)},
            })
        last_t = p["t"]
    return events


def _nearest_person(ball, opts, id_map, stable):
    best = None
    best_d = 1e9
    for tid, samples in stable.items():
        s = min(samples, key=lambda z: abs(z["t"] - ball["t"]))
        d = math.hypot(s["x"] - ball["x"], s["y"] - ball["y"])
        if d < best_d:
            best_d = d
            best = id_map.get(tid)
    return best
