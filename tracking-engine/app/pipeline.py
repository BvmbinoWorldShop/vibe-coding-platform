"""The pro tracking pipeline.

This is the "expensive" part a browser can't do well:
- YOLOv8 detection (COCO person + sports ball)
- BoT-SORT tracking with appearance ReID for stable IDs through occlusion
- A second identity pass: jersey-number OCR + team-color clustering, then
  merging tracks that share a number (re-identification across ID breaks)
- Homography from marked court corners for true metric speed/distance
- Ball-vs-rim shot detection with make/miss and nearest-player attribution

All open source, runs on your own GPU — no paid computer-vision API. Heavy deps
are imported lazily so the FastAPI app still starts without them installed."""

from __future__ import annotations

import datetime
import math
import uuid
from collections import defaultdict
from typing import Callable, Optional

from . import identity
from .schemas import AnalyzeOptions, AnalysisResult, RosterPlayer

CLS_PERSON = 0
CLS_BALL = 32
PALETTE = [
    "#f97316", "#22c55e", "#3b82f6", "#eab308", "#ec4899",
    "#a855f7", "#14b8a6", "#ef4444", "#84cc16", "#06b6d4",
]


def _homography(corners):
    import cv2
    import numpy as np

    src = np.array([[c.x, c.y] for c in corners], dtype="float32")
    dst = np.array([[c.court_x_m, c.court_y_m] for c in corners], dtype="float32")
    return cv2.getPerspectiveTransform(src, dst)


def _to_court(H, x, y):
    import cv2
    import numpy as np

    out = cv2.perspectiveTransform(np.array([[[x, y]]], dtype="float32"), H)
    return float(out[0][0][0]), float(out[0][0][1])


def analyze_video(
    path: str,
    opts: AnalyzeOptions,
    on_progress: Optional[Callable[[float, str], None]] = None,
) -> AnalysisResult:
    from ultralytics import YOLO
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

    # --- Pass 1: detect + BoT-SORT track ---
    progress(0.05, "tracking (BoT-SORT + ReID)")
    tracks: dict[int, list[dict]] = defaultdict(list)
    ball_path: list[dict] = []
    frame_idx = 0

    results = model.track(
        source=path,
        tracker="botsort.yaml",
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
            xywh = r.boxes.xywh.tolist()
            for tid, cls, (cx, cy, bw, bh) in zip(ids, clss, xywh):
                if cls == CLS_BALL:
                    ball_path.append({"t": t, "x": cx / W, "y": cy / Hh})
                elif cls == CLS_PERSON:
                    court = _to_court(H, cx, cy + bh / 2) if H is not None else None
                    tracks[tid].append({
                        "frame": frame_idx, "t": t,
                        "x": cx / W, "y": cy / Hh,
                        "px": (int(cx - bw / 2), int(cy - bh / 2), int(cx + bw / 2), int(cy + bh / 2)),
                        "court": court,
                    })
        if total:
            progress(0.05 + 0.6 * (frame_idx / total), "tracking (BoT-SORT + ReID)")
        frame_idx += 1

    duration = frame_idx / src_fps
    stable = {tid: s for tid, s in tracks.items() if len(s) >= 5}

    # --- Pass 2: identity (jersey number OCR + team color) ---
    progress(0.68, "reading jersey numbers")
    number_votes, team_color = _identity_pass(path, stable, opts, W, Hh)
    track_numbers = identity.resolve_numbers(number_votes)
    groups = identity.merge_by_number(track_numbers)
    team_idx = identity.two_team_clusters(team_color)

    # --- Build merged participants ---
    progress(0.85, "building players")
    roster: list[RosterPlayer] = []
    movement: dict[str, dict] = {}
    pid_for_track: dict[int, str] = {}
    used_numbers: set[int] = set()
    fallback = 1

    for gi, (key, tids) in enumerate(sorted(groups.items())):
        pid = str(uuid.uuid4())
        samples: list[dict] = []
        for tid in tids:
            samples.extend(stable[tid])
            pid_for_track[tid] = pid
        samples.sort(key=lambda z: z["t"])

        num = track_numbers.get(tids[0])
        if num is None or num in used_numbers:
            while fallback in used_numbers:
                fallback += 1
            num = fallback
        used_numbers.add(num)

        # Team from the majority of members; color from mean jersey or palette.
        team_votes = [team_idx.get(tid, 0) for tid in tids]
        team_i = round(sum(team_votes) / len(team_votes)) if team_votes else 0
        colors = [team_color[tid] for tid in tids if team_color.get(tid)]
        color = identity.rgb_to_hex(
            tuple(sum(c[j] for c in colors) / len(colors) for j in range(3))
        ) if colors else PALETTE[gi % len(PALETTE)]

        roster.append(RosterPlayer(
            id=pid, name=f"Player {num}", number=num,
            team=f"Team {'A' if team_i == 0 else 'B'}", color=color,
        ))
        movement[pid] = _movement(samples)

    # --- Shots ---
    progress(0.93, "detecting shots")
    events = _detect_shots(ball_path, opts, pid_for_track, stable)
    points = sum({"fg2m": 2, "fg3m": 3, "ftm": 1}.get(e["type"], 0) for e in events)

    session = {
        "id": str(uuid.uuid4()),
        "date": datetime.date.today().isoformat(),
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


def _movement(samples: list[dict]) -> dict:
    dist = 0.0
    max_speed = 0.0
    for a, b in zip(samples, samples[1:]):
        if a["court"] and b["court"]:
            d = math.hypot(b["court"][0] - a["court"][0], b["court"][1] - a["court"][1])
            dt = b["t"] - a["t"]
            if 0 < dt < 2 and d < 12:
                dist += d
                max_speed = max(max_speed, d / dt)
    return {
        "distanceM": round(dist, 1),
        "maxSpeedKmh": round(max_speed * 3.6, 1),
        "strides": round(dist / 2.5) if dist else 0,
    }


def _identity_pass(path, stable, opts: AnalyzeOptions, W, Hh):
    """Sample a few frames per track, read the jersey number and torso color."""
    number_votes: dict[int, list[int]] = defaultdict(list)
    team_color: dict[int, tuple] = {}
    if not stable:
        return number_votes, team_color

    import cv2
    import numpy as np

    # frame_idx -> list of (track_id, bbox_px) to inspect on that frame.
    want: dict[int, list[tuple]] = defaultdict(list)
    for tid, samples in stable.items():
        picks = samples[:: max(1, len(samples) // 5)][:5]
        for s in picks:
            want[s["frame"]].append((tid, s["px"]))

    color_acc: dict[int, list[tuple]] = defaultdict(list)
    cap = cv2.VideoCapture(path)
    for frame_idx in sorted(want.keys()):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ok, frame = cap.read()
        if not ok:
            continue
        for tid, (x1, y1, x2, y2) in want[frame_idx]:
            x1, y1 = max(0, x1), max(0, y1)
            x2, y2 = min(int(W), x2), min(int(Hh), y2)
            crop = identity.torso_crop(frame, x1, y1, x2, y2)
            if crop is None or crop.size == 0:
                continue
            c = identity.mean_color(crop)
            if c:
                color_acc[tid].append(c)
            if opts.read_jerseys:
                num = identity.read_number_from_crop(crop)
                if num is not None:
                    number_votes[tid].append(num)
    cap.release()

    for tid, cols in color_acc.items():
        team_color[tid] = tuple(float(np.mean([c[j] for c in cols])) for j in range(3))
    return number_votes, team_color


def _detect_shots(ball_path, opts: AnalyzeOptions, pid_for_track, stable):
    events = []
    if not opts.hoop or len(ball_path) < 3:
        return events
    hx, hy = opts.hoop["x"], opts.hoop["y"]
    last_t = -1e9
    for i in range(2, len(ball_path)):
        p = ball_path[i]
        if math.hypot(p["x"] - hx, p["y"] - hy) >= 0.07 or p["t"] - last_t < 3:
            continue
        window = ball_path[max(0, i - 6): i + 4]
        came_above = any(w["y"] < hy - 0.01 and abs(w["x"] - hx) < 0.07 for w in window)
        dropped = any(w["y"] > hy + 0.02 and abs(w["x"] - hx) < 0.07 for w in window[-4:])
        made = came_above and dropped
        shooter = _nearest(p, pid_for_track, stable)
        if shooter:
            events.append({
                "id": str(uuid.uuid4()), "t": round(p["t"], 2),
                "playerId": shooter, "type": "fg2m" if made else "fg2x",
                "shot": {"x": round(hx * 100, 1), "y": round(hy * 100, 1)},
            })
        last_t = p["t"]
    return events


def _nearest(ball, pid_for_track, stable):
    best = None
    best_d = 1e9
    for tid, samples in stable.items():
        s = min(samples, key=lambda z: abs(z["t"] - ball["t"]))
        d = math.hypot(s["x"] - ball["x"], s["y"] - ball["y"])
        if d < best_d:
            best_d = d
            best = pid_for_track.get(tid)
    return best
