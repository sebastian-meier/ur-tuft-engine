# UR Tuft Engine – Backend

FastAPI service that receives artwork uploads, generates Universal Robots (UR) programs, and can stream the resulting URScript directly to a controller using the official `ur-rtde` Python SDK.

## Setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
```

The optional `.[dev]` extras install pytest for local regression tests. Environment variables mirror the historical Node backend, so existing deployment configs can be re-used.

## Running the server

```bash
uvicorn app.api:app --host 0.0.0.0 --port 4000
```

The port is overridable via the `PORT` environment variable. When `ROBOT_HOST` is defined, the backend will attempt to deliver generated programs through the official `ur-rtde` client.

## Environment Variables

- `PORT` (`4000`) – Port exposed by uvicorn.
- `CORS_ORIGIN` – Comma-separated list of allowed origins; omit to allow all.
- `ROBOT_HOST` – UR controller IP/hostname. Leave unset to disable delivery.
- `ROBOT_PORT` (`30002`) – Controller TCP port used for program streaming.
- `ROBOT_TOOL_OUTPUT` (`0`) – Digital output index controlling the tufting end-effector.
- `ROBOT_TRAVEL_SPEED_MM_S` (`200`) – XY travel speed when not tufting.
- `ROBOT_TUFT_SPEED_MM_S` (`60`) – XY speed while the tool is engaged.
- `ROBOT_CONTACT_FORCE_THRESHOLD_N` (`15`) – Force threshold in Newtons signalling surface contact.
- `WORKPIECE_WIDTH_MM` / `WORKPIECE_HEIGHT_MM` (`500`) – Physical dimensions represented by the uploaded artwork.
- `SAFE_HEIGHT_MM` (`150`) – Clearance height above the surface.
- `TUFT_HEIGHT_MM` (`5`) – Plunge depth from the safe height.
- `BLACK_PIXEL_THRESHOLD` (`64`) – Greyscale threshold (0–255) that classifies pixels as tuftable.

## API Overview

- `POST /api/images` – Accepts a multipart form field named `image`. Returns the generated UR program, metadata, and delivery status (`delivered`, `skipped`, or `failed`).
- `GET /health` – Basic readiness probe.
- `GET /docs` – FastAPI's automatically generated OpenAPI UI.

Program generation now lives in `app/ur_generator.py`. It mirrors the previous TypeScript logic, ensuring compatibility with existing URScript snapshots and operator expectations.
