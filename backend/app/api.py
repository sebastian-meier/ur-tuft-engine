"""FastAPI application exposing the image upload endpoint."""

from __future__ import annotations

from fastapi import FastAPI, File, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from starlette.responses import JSONResponse

from .config import get_config
from .robot_client import RobotCommunicationError, send_program_to_robot
from .ur_generator import URGenerationOptions, URGenerationResult, generate_ur_program


config = get_config()

app = FastAPI(
    title="UR Tuft Engine API",
    version="0.1.0",
    description="Generate URScript programs from bitmap artwork and optionally stream them to a robot.",
)

if config.allow_all_origins:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
else:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=list(config.cors_origins or []),
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


@app.get("/health")
async def health() -> dict[str, str]:
    """Readiness probe used by the frontend and deployment tooling."""

    return {"status": "ok"}


@app.post("/api/images")
async def upload_image(image: UploadFile = File(...)) -> JSONResponse:
    """Accept an image upload, generate a UR program, and optionally stream it to the robot."""

    contents = await image.read()
    if not contents:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='No image file provided under field "image".',
        )

    options = URGenerationOptions(
        workpiece_width_mm=config.toolpath.workpiece_width_mm,
        workpiece_height_mm=config.toolpath.workpiece_height_mm,
        safe_height_mm=config.toolpath.safe_height_mm,
        tuft_height_mm=config.toolpath.tuft_height_mm,
        tool_output=config.robot.tool_output,
        travel_speed_mm_per_sec=config.robot.travel_speed_mm_per_sec,
        tuft_speed_mm_per_sec=config.robot.tuft_speed_mm_per_sec,
        black_pixel_threshold=config.toolpath.black_pixel_threshold,
        contact_force_threshold_n=config.robot.contact_force_threshold_n,
    )

    try:
        result: URGenerationResult = generate_ur_program(
            contents,
            image.filename or "upload",
            options,
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        ) from exc

    robot_delivery = {
        "attempted": config.robot.enabled,
        "status": "skipped",
        "error": None,
    }
    response_status = status.HTTP_200_OK

    if config.robot.enabled:
        try:
            send_program_to_robot(result.program, config.robot)
            robot_delivery["status"] = "delivered"
        except RobotCommunicationError as exc:
            robot_delivery["status"] = "failed"
            robot_delivery["error"] = str(exc)
            response_status = status.HTTP_202_ACCEPTED
        except Exception as exc:  # pragma: no cover - unexpected SDK failures
            robot_delivery["status"] = "failed"
            robot_delivery["error"] = str(exc)
            response_status = status.HTTP_202_ACCEPTED

    metadata = {
        "estimatedCycleTimeSeconds": result.metadata.estimated_cycle_time_seconds,
        "resolution": result.metadata.resolution,
        "imageWidth": result.metadata.image_width,
        "imageHeight": result.metadata.image_height,
        "tuftSegments": result.metadata.tuft_segments,
        "activePixels": result.metadata.active_pixels,
    }

    payload = {
        "jobId": result.job_id,
        "metadata": metadata,
        "program": result.program,
        "robotDelivery": robot_delivery,
    }

    return JSONResponse(payload, status_code=response_status)
