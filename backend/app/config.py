"""Configuration loader for the UR Tuft Engine backend."""

from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from typing import Iterable, Tuple
import os

from dotenv import load_dotenv

load_dotenv()


def _coerce_float(value: str | None, fallback: float, minimum: float | None = None) -> float:
    try:
        parsed = float(value) if value is not None else fallback
    except (TypeError, ValueError):
        parsed = fallback
    if minimum is not None:
        parsed = max(parsed, minimum)
    return parsed


def _coerce_int(value: str | None, fallback: int, minimum: int | None = None) -> int:
    try:
        parsed = int(value) if value is not None else fallback
    except (TypeError, ValueError):
        parsed = fallback
    if minimum is not None:
        parsed = max(parsed, minimum)
    return parsed


def _coerce_threshold(value: str | None, fallback: int) -> int:
    parsed = _coerce_int(value, fallback)
    return max(0, min(255, parsed))


def _parse_cors(origins_env: str | None) -> Tuple[str, ...] | None:
    if origins_env is None or origins_env.strip() == "":
        return None
    parts: Iterable[str] = (origin.strip() for origin in origins_env.split(","))
    return tuple(origin for origin in parts if origin)


@dataclass(frozen=True)
class RobotConfig:
    """Connectivity and motion parameters for the UR controller."""

    host: str | None
    port: int
    tool_output: int
    travel_speed_mm_per_sec: float
    tuft_speed_mm_per_sec: float
    contact_force_threshold_n: float

    @property
    def enabled(self) -> bool:
        return bool(self.host)


@dataclass(frozen=True)
class ToolpathConfig:
    """Scaling and pixel classification options used during toolpath generation."""

    workpiece_width_mm: float
    workpiece_height_mm: float
    safe_height_mm: float
    tuft_height_mm: float
    black_pixel_threshold: int


@dataclass(frozen=True)
class AppConfig:
    """Top-level runtime configuration for the FastAPI service."""

    port: int
    cors_origins: Tuple[str, ...] | None
    robot: RobotConfig
    toolpath: ToolpathConfig

    @property
    def allow_all_origins(self) -> bool:
        return self.cors_origins is None


@lru_cache(maxsize=1)
def get_config() -> AppConfig:
    """Parse the environment once and cache the resulting configuration object."""

    cors_origins = _parse_cors(os.getenv("CORS_ORIGIN"))

    robot_host = os.getenv("ROBOT_HOST")
    robot_port = _coerce_int(os.getenv("ROBOT_PORT"), 30002, minimum=1)

    robot_config = RobotConfig(
        host=robot_host if robot_host else None,
        port=robot_port,
        tool_output=_coerce_int(os.getenv("ROBOT_TOOL_OUTPUT"), 0, minimum=0),
        travel_speed_mm_per_sec=_coerce_float(os.getenv("ROBOT_TRAVEL_SPEED_MM_S"), 200.0, minimum=10.0),
        tuft_speed_mm_per_sec=_coerce_float(os.getenv("ROBOT_TUFT_SPEED_MM_S"), 60.0, minimum=5.0),
        contact_force_threshold_n=_coerce_float(
            os.getenv("ROBOT_CONTACT_FORCE_THRESHOLD_N"),
            15.0,
            minimum=0.5,
        ),
    )

    toolpath_config = ToolpathConfig(
        workpiece_width_mm=_coerce_float(os.getenv("WORKPIECE_WIDTH_MM"), 500.0, minimum=1.0),
        workpiece_height_mm=_coerce_float(os.getenv("WORKPIECE_HEIGHT_MM"), 500.0, minimum=1.0),
        safe_height_mm=_coerce_float(os.getenv("SAFE_HEIGHT_MM"), 150.0, minimum=10.0),
        tuft_height_mm=_coerce_float(os.getenv("TUFT_HEIGHT_MM"), 5.0, minimum=1.0),
        black_pixel_threshold=_coerce_threshold(os.getenv("BLACK_PIXEL_THRESHOLD"), 64),
    )

    return AppConfig(
        port=_coerce_int(os.getenv("PORT"), 4000, minimum=1),
        cors_origins=cors_origins,
        robot=robot_config,
        toolpath=toolpath_config,
    )
