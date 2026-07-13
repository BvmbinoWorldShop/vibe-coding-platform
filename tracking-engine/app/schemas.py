"""Pydantic schemas. The AnalysisResult intentionally mirrors the web app's
GameSession shape (lib/basketball/store.ts) so a result imports straight into
the existing dashboard, analytics, search and reports with no translation."""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field


class CourtCorner(BaseModel):
    # A corner click in fractional image coords (0..1) paired with its real
    # court coordinate in meters. Four of these define the homography that
    # turns pixel motion into real distance / speed.
    x: float
    y: float
    court_x_m: float
    court_y_m: float


class AnalyzeOptions(BaseModel):
    court_type: Literal["full", "half"] = "full"
    corners: list[CourtCorner] = Field(default_factory=list)  # 0 or 4
    hoop: Optional[dict] = None  # {"x": 0..1, "y": 0..1} image coords of the rim
    detector: Literal["yolov8n", "yolov8s", "yolov8m", "yolov8x"] = "yolov8m"
    read_jerseys: bool = True
    fps_sample: float = 5.0  # analyse this many frames/sec (speed vs accuracy)


class ShotMark(BaseModel):
    x: float
    y: float


class SessionEvent(BaseModel):
    id: str
    t: float
    playerId: str
    type: str
    shot: Optional[ShotMark] = None


class PlayerMovement(BaseModel):
    distanceM: float
    maxSpeedKmh: float
    strides: float


class RosterPlayer(BaseModel):
    id: str
    name: str
    number: int
    position: str = ""
    height: str = ""
    weight: str = ""
    strideLength: float = 2.5
    notes: str = ""
    team: str = "Tracked"
    color: Optional[str] = None


class AnalysisResult(BaseModel):
    # Ready-to-import GameSession, plus the roster of tracked participants the
    # engine created (so the front end can merge them in).
    roster: list[RosterPlayer]
    session: dict  # GameSession (id/date/opponent/location/source/events/movement/teamScore/oppScore/durationS)


class Job(BaseModel):
    id: str
    status: Literal["queued", "running", "done", "error"]
    progress: float = 0.0
    message: str = ""
    result: Optional[AnalysisResult] = None
