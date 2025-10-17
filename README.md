# UR Tuft Engine

A full-stack workspace for converting uploaded tufting artwork into Universal Robots (UR) programs and optionally streaming those programs to a robot on the local network.

## Project Layout

- `backend/` – FastAPI + Python service for receiving images, generating UR scripts from pixel columns, and streaming them to a robot via the official `ur-rtde` client.
- `frontend/` – React + Vite UI for uploading artwork and reviewing the generated UR program.
- `docs/` – Generated TypeDoc documentation for the frontend (`npm run docs`).

## Prerequisites

- Python 3.10+ (backend)
- Node.js 18.x (LTS) and npm 10+ (frontend)
- A Universal Robots controller reachable on the local network (optional for development)

## Getting Started

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cp .env.example .env
uvicorn app.api:app --reload --host 0.0.0.0 --port 4000
```

Key environment variables (see `backend/.env.example` for the full list):

- `ROBOT_TOOL_OUTPUT` – Digital output index for the tufting end-effector.
- `ROBOT_TRAVEL_SPEED_MM_S` / `ROBOT_TUFT_SPEED_MM_S` – Horizontal feed rates.
- `WORKPIECE_WIDTH_MM` / `WORKPIECE_HEIGHT_MM` – Physical coverage of the uploaded bitmap.
- `SAFE_HEIGHT_MM` / `TUFT_HEIGHT_MM` – Clearance height and plunge depth.
- `BLACK_PIXEL_THRESHOLD` – Greyscale cutoff for classifying pixels as tufted.
- `ROBOT_CONTACT_FORCE_THRESHOLD_N` – Force threshold (N) used to detect when the tool touches the surface.

The API exposes:

- `POST /api/images` – Accepts a multipart form field named `image`. Returns the generated UR program and attempts delivery when `ROBOT_HOST` is configured.
- `GET /health` – Lightweight readiness check.
- `GET /docs` – FastAPI OpenAPI explorer.

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend expects `VITE_API_URL` in `.env` to point at the running backend (`http://localhost:4000` by default).

## Documentation

- Auto-generated TypeDoc output for the frontend lives in `docs/frontend` (`npm run docs`).
- Interactive API reference is served via FastAPI's documentation at `/docs` while the backend is running.

## Tests

- Backend: `cd backend && pytest`. Regression tests compare the generated URScript with the historical snapshot in `tests/output/test-1.urscript`.
- Frontend: `cd frontend && npm run test`.

## Development Notes

- Toolpath generation decomposes the bitmap into vertical strokes, toggling the configured output pin whenever dark pixels are encountered. Update `backend/app/ur_generator.py` when introducing more advanced toolpath planning.
- Automatic robot delivery can be toggled by setting or omitting `ROBOT_HOST`. Delivery failures are surfaced in the frontend UI.
- When updating dependencies, ensure both the Python and Node toolchains remain compatible with their respective runtime requirements.

## Next Steps

1. Implement actual image-to-path processing and UR script generation.
2. Expand the API to persist jobs and expose history.
3. Harden error handling and add automated tests for both layers.
