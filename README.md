# UR Tuft Engine

A full-stack workspace for converting uploaded tufting artwork into Universal Robots (UR) programs and optionally streaming those programs to a robot on the local network.

## Project Layout

- `backend/` – Express + TypeScript API for receiving images, generating UR scripts from pixel columns, and streaming them to a robot.
- `frontend/` – React + Vite UI for uploading artwork and reviewing the generated UR program.
- `docs/` – Generated TypeDoc documentation for backend and frontend code (`npm run docs`).

## Prerequisites

- Node.js 18.x (LTS) and npm 10+
- A Universal Robots controller reachable on the local network (optional for development)

## Getting Started

### Quick start (root)

```bash
npm install
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
npm run dev
```

`npm run dev` launches the backend and frontend watcher processes in parallel. Adjust the `.env` files before running if you need non-default ports, workspace dimensions, or robot connection details.

Swagger UI is available once the backend is running at `http://localhost:4000/docs`.

### Backend only

```bash
cd backend
npm install
npm run dev
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

### Frontend only

```bash
cd frontend
npm install
npm run dev
```

The frontend expects `VITE_API_URL` in `.env` to point at the running backend (`http://localhost:4000` by default).

## Documentation

- Auto-generated TypeDoc output lives in `docs/backend` and `docs/frontend`. Rebuild with `npm run docs`.
- Interactive API reference is served via Swagger UI at `/docs` while the backend is running.

## Tests

- Run `npm run test` (or `npm run test --workspace backend`) to execute the backend fixture test.
- The test writes the generated URScript for `tests/test-1.jpg` to `tests/output/test-1.urscript` so you can review the program that drives the robot.

## Development Notes

- Toolpath generation decomposes the bitmap into vertical strokes, toggling the configured output pin whenever dark pixels are encountered. Update `backend/src/services/urGenerator.ts` when introducing more advanced toolpath planning.
- Automatic robot delivery can be toggled by setting or omitting `ROBOT_HOST`. Delivery failures are surfaced in the frontend UI.
- When updating dependencies, prefer versions compatible with Node 18 or upgrade Node accordingly.

## Next Steps

1. Implement actual image-to-path processing and UR script generation.
2. Expand the API to persist jobs and expose history.
3. Harden error handling and add automated tests for both layers.
