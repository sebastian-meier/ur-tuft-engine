# UR Tuft Engine – Backend

Express + TypeScript API for receiving artwork uploads, generating Universal Robots (UR) programs, and optionally streaming them to a robot.

## Scripts

```bash
npm run dev   # start in watch mode with ts-node-dev
npm run build # compile TypeScript to dist/
npm run start # run the compiled JavaScript
npm run docs  # build TypeDoc API documentation into ../docs/backend
npm run test  # run fixture-based tests and snapshot the generated URScript
```

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

- `PORT` (default `4000`) – Port to expose the API.
- `CORS_ORIGIN` – Comma-separated list of allowed origins for the frontend UI.
- `ROBOT_HOST` – Set to the UR controller IP/hostname to enable auto-delivery.
- `ROBOT_PORT` (default `30002`) – Controller TCP port used for program streaming.
- `ROBOT_TOOL_OUTPUT` (default `0`) – Digital output index controlling the tufting end-effector.
- `ROBOT_TRAVEL_SPEED_MM_S` (default `200`) – XY travel speed when not tufting.
- `ROBOT_TUFT_SPEED_MM_S` (default `60`) – XY speed while the tool is engaged.
- `ROBOT_CONTACT_FORCE_THRESHOLD_N` (default `15`) – Force threshold in Newtons signalling surface contact.
- `WORKPIECE_WIDTH_MM` / `WORKPIECE_HEIGHT_MM` (default `500`) – Physical dimensions that the uploaded image spans on the work surface.
- `SAFE_HEIGHT_MM` (default `150`) – Height, in millimetres, for clearance and travel above the surface.
- `TUFT_HEIGHT_MM` (default `5`) – Distance to descend from safe height to contact the surface.
- `BLACK_PIXEL_THRESHOLD` (default `64`) – Greyscale threshold (0–255) that classifies pixels as tuftable.

## API Overview

- `POST /api/images` – Accepts a multipart form field named `image`. Returns the generated UR program, metadata, and delivery status.
- `GET /health` – Basic health probe for uptime checks.
- `GET /docs` – Swagger UI generated from route annotations providing interactive API exploration.

Program generation is handled in `src/services/urGenerator.ts`. It samples the uploaded bitmap column-by-column, toggles the configured output pin when black pixels are encountered, and emits a ready-to-run UR script with estimated cycle time.
