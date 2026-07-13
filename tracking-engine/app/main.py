"""FastAPI service for the pro tracking engine.

Run locally on a machine with a GPU:
    pip install -r requirements.txt
    uvicorn app.main:app --host 0.0.0.0 --port 8000

Then point the web app's "Pro Engine URL" (Settings) at http://<this-host>:8000.
CORS is open so the browser app can call it directly on your LAN — no cloud."""

from __future__ import annotations

import os
import tempfile
import threading
import uuid

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware

from .schemas import AnalyzeOptions, Job

app = FastAPI(title="Ball Analysis Pro Tracking Engine", version="1.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

JOBS: dict[str, Job] = {}


@app.get("/health")
def health() -> dict:
    # Report whether the heavy CV stack is importable, without failing startup.
    cv_ready = True
    detail = "ready"
    try:
        import ultralytics  # noqa: F401
        import cv2  # noqa: F401
    except Exception as exc:  # pragma: no cover
        cv_ready = False
        detail = f"CV deps not installed: {exc}"
    return {
        "status": "ok",
        "cv_ready": cv_ready,
        "detail": detail,
        "ai": {
            "mistral": bool(os.environ.get("MISTRAL_API_KEY")),
            "cerebras": bool(os.environ.get("CEREBRAS_API_KEY")),
        },
    }


def _run_job(job_id: str, video_path: str, opts: AnalyzeOptions) -> None:
    from .pipeline import analyze_video

    job = JOBS[job_id]
    job.status = "running"

    def on_progress(p: float, msg: str) -> None:
        job.progress = round(p, 3)
        job.message = msg

    try:
        job.result = analyze_video(video_path, opts, on_progress)
        job.status = "done"
        job.progress = 1.0
        job.message = "done"
    except Exception as exc:  # pragma: no cover
        job.status = "error"
        job.message = str(exc)
    finally:
        try:
            os.remove(video_path)
        except OSError:
            pass


@app.post("/analyze")
async def analyze(
    video: UploadFile = File(...),
    options: str = Form("{}"),
) -> dict:
    opts = AnalyzeOptions.model_validate_json(options)
    suffix = os.path.splitext(video.filename or "clip.mp4")[1] or ".mp4"
    fd, path = tempfile.mkstemp(suffix=suffix)
    with os.fdopen(fd, "wb") as f:
        f.write(await video.read())

    job_id = str(uuid.uuid4())
    JOBS[job_id] = Job(id=job_id, status="queued")
    threading.Thread(target=_run_job, args=(job_id, path, opts), daemon=True).start()
    return {"jobId": job_id}


@app.get("/jobs/{job_id}")
def get_job(job_id: str) -> Job:
    job = JOBS.get(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="job not found")
    return job
