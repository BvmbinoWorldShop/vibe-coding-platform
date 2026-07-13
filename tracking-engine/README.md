# Ball Analysis — Pro Tracking Engine

The heavy, "arena-grade" computer vision that a browser can't do well, as a
small local service. **Everything here is open source and runs on your own
machine/GPU — there is no paid computer-vision API.** Your free Mistral /
Cerebras keys are only used for the optional *reasoning* layer (coaching reads).

## What it does

| Capability | How |
|---|---|
| Player + ball detection | **YOLOv8** (COCO `person` + `sports ball`), pick `n/s/m/x` for speed↔accuracy |
| Stable player IDs through contact/occlusion | **ByteTrack** multi-object tracker (`bytetrack.yaml`) |
| Real speed / distance / strides | **Homography** from 4 marked court corners → metric court space |
| Shot make/miss + attribution | Ball-vs-rim trajectory, attributed to the nearest player |
| Output | A `GameSession` JSON that imports directly into the web dashboard |

This is the same class of pipeline pro tools are built on (detector + tracker +
homography + event logic). It is **not** a broadcast system: those add fixed
multi-camera calibrated rigs, models fine-tuned on millions of labeled NBA
frames, and human verification. This gives you a genuine, self-hosted,
free-to-run version you fully control.

## Run it

```bash
cd tracking-engine
python -m venv .venv && source .venv/bin/activate

# For GPU: install the CUDA build of torch FIRST (see https://pytorch.org),
# otherwise it runs on CPU (slower but works).
pip install -r requirements.txt

# optional reasoning layer (free keys)
export MISTRAL_API_KEY=...        # optional
export CEREBRAS_API_KEY=...       # optional

uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Or with Docker:

```bash
docker build -t ball-engine tracking-engine
docker run -p 8000:8000 -e MISTRAL_API_KEY=... ball-engine
```

Check it's alive: `curl http://localhost:8000/health`

## Connect the web app

In the web dashboard → **Settings → Pro Engine URL**, enter
`http://localhost:8000` (or your GPU box's LAN address). Then open
**Pro Engine**, upload a clip, optionally mark the court corners + rim, and
Analyze. The result imports as a normal game — so all the existing analytics,
search, reports and player CRM work on it automatically.

## API

- `GET /health` — status + whether the CV stack and AI keys are present
- `POST /analyze` — multipart: `video` (file) + `options` (JSON `AnalyzeOptions`) → `{ jobId }`
- `GET /jobs/{id}` — job status, progress, and the `AnalysisResult` when done

`AnalyzeOptions`:
```json
{
  "court_type": "full",
  "corners": [{"x":0.1,"y":0.9,"court_x_m":0,"court_y_m":0}, ...4],
  "hoop": {"x":0.5,"y":0.12},
  "detector": "yolov8m",
  "fps_sample": 5.0
}
```

Corners and hoop are optional: without corners you still get tracking + events
(no metric speed); without a hoop, shots aren't auto-detected.

## Roadmap (open-source, still free)

- Pose model (YOLOv8-pose) for shot mechanics, screens, box-outs
- Team classification by jersey-color clustering (already in the web app; can
  move server-side for consistency)
- Jersey OCR (EasyOCR) to auto-number players — dependency is included, commented
- Possession & lineup segmentation from ball ownership over time
