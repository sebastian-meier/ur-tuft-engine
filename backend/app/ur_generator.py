"""URScript generation logic for bitmap-driven tufting jobs."""

from __future__ import annotations

from dataclasses import dataclass, replace
from typing import List, Sequence, Tuple
import io
import math
from uuid import uuid4

from PIL import Image


@dataclass(frozen=True)
class URGenerationOptions:
    """Configurable parameters affecting how the bitmap is converted into motions."""

    workpiece_width_mm: float = 500.0
    workpiece_height_mm: float = 500.0
    safe_height_mm: float = 150.0
    tuft_height_mm: float = 5.0
    tool_output: int = 0
    travel_speed_mm_per_sec: float = 200.0
    tuft_speed_mm_per_sec: float = 60.0
    black_pixel_threshold: int = 64
    contact_force_threshold_n: float = 15.0


@dataclass(frozen=True)
class URGenerationMetadata:
    """Summary statistics returned alongside the generated program."""

    estimated_cycle_time_seconds: int
    resolution: str
    image_width: int
    image_height: int
    tuft_segments: int
    active_pixels: int


@dataclass(frozen=True)
class URGenerationResult:
    """Output payload containing the URScript program and metadata."""

    program: str
    job_id: str
    metadata: URGenerationMetadata


DEFAULT_OPTIONS = URGenerationOptions()

RAD_ORIENTATION = (0.0, math.pi, 0.0)
MOVE_ACCELERATION = 1.2
APPROACH_ACCELERATION = 0.8
CONTACT_STEP_METERS = 0.001  # 1 mm incremental probing steps.


def _format_pose(x_mm: float, y_mm: float, z_m: float) -> str:
    """Format a Cartesian pose with a fixed orientation."""

    return (
        f"p[{x_mm / 1000:.4f}, {y_mm / 1000:.4f}, {z_m:.4f}, "
        f"{RAD_ORIENTATION[0]:.4f}, {RAD_ORIENTATION[1]:.4f}, {RAD_ORIENTATION[2]:.4f}]"
    )


def _distance_2d(x1: float, y1: float, x2: float, y2: float) -> float:
    """Euclidean distance between two XY points in millimetres."""

    return math.hypot(x2 - x1, y2 - y1)


def _merge_options(overrides: URGenerationOptions | None) -> URGenerationOptions:
    if overrides is None:
        return DEFAULT_OPTIONS
    return replace(DEFAULT_OPTIONS, **overrides.__dict__)


def generate_ur_program(
    image_bytes: bytes,
    original_name: str,
    options: URGenerationOptions | None = None,
) -> URGenerationResult:
    """Convert a greyscale bitmap into a URScript program."""

    settings = _merge_options(options)

    if settings.tuft_height_mm >= settings.safe_height_mm:
        raise ValueError("Tuft height must be smaller than the safe height to allow a retract move.")

    safe_z = settings.safe_height_mm / 1000.0
    surface_z = max(0.0, (settings.safe_height_mm - settings.tuft_height_mm) / 1000.0)
    travel_speed = settings.travel_speed_mm_per_sec / 1000.0
    tuft_speed = settings.tuft_speed_mm_per_sec / 1000.0
    threshold = max(0, min(255, int(settings.black_pixel_threshold)))
    contact_force_threshold = max(0.5, float(settings.contact_force_threshold_n))

    image = Image.open(io.BytesIO(image_bytes))
    image = image.convert("L")

    width, height = image.size
    if width == 0 or height == 0:
        raise ValueError("Unable to read uploaded image dimensions.")

    data = image.tobytes()

    pixel_width_mm = settings.workpiece_width_mm / width
    pixel_height_mm = settings.workpiece_height_mm / height

    column_plans: List[Tuple[int, List[Tuple[int, int]]]] = []
    active_pixels = 0

    for column in range(width):
        segments: List[Tuple[int, int]] = []
        row = 0
        while row < height:
            pixel_value = data[row * width + column]
            if pixel_value <= threshold:
                start = row
                while row < height and data[row * width + column] <= threshold:
                    row += 1
                end = row - 1
                segments.append((start, end))
                active_pixels += end - start + 1
            else:
                row += 1
        if segments:
            column_plans.append((column, segments))

    tuft_segments = sum(len(segments) for _, segments in column_plans)

    job_id = str(uuid4())

    program_lines: List[str] = [
        "def tuft_program():",
        f'    textmsg("Starting tufting job {original_name}")',
        f"    set_digital_out({settings.tool_output}, False)",
        f"    global travel_speed = {travel_speed:.4f}",
        f"    global tuft_speed = {tuft_speed:.4f}",
        f"    global contact_force_threshold = {contact_force_threshold:.2f}",
        f"    global contact_probe_step = {CONTACT_STEP_METERS:.4f}",
    ]

    if tuft_segments == 0:
        program_lines.append('    textmsg("No dark pixels detected; nothing to tuft.")')
        program_lines.append("end")
        metadata = URGenerationMetadata(
            estimated_cycle_time_seconds=0,
            resolution=f"{width}x{height}",
            image_width=width,
            image_height=height,
            tuft_segments=tuft_segments,
            active_pixels=active_pixels,
        )
        return URGenerationResult("\n".join(program_lines), job_id, metadata)

    last_safe_x: float | None = None
    last_safe_y: float | None = None
    last_surface_x: float | None = None
    last_surface_y: float | None = None
    tool_active = False

    travel_distance_mm = 0.0
    tuft_distance_mm = 0.0
    vertical_distance_mm = 0.0

    def move_safe(x_mm: float, y_mm: float) -> None:
        nonlocal last_safe_x, last_safe_y, travel_distance_mm
        if last_safe_x is not None and last_safe_y is not None:
            travel_distance_mm += _distance_2d(last_safe_x, last_safe_y, x_mm, y_mm)
        program_lines.append(
            f"    movel({_format_pose(x_mm, y_mm, safe_z)}, a={MOVE_ACCELERATION:.1f}, v={travel_speed:.4f})"
        )
        last_safe_x = x_mm
        last_safe_y = y_mm

    def lower_to_surface(x_mm: float, y_mm: float) -> None:
        nonlocal last_surface_x, last_surface_y, vertical_distance_mm
        vertical_distance_mm += settings.tuft_height_mm
        program_lines.append("    local contact_pose = get_actual_tcp_pose()")
        program_lines.append(
            f"    while norm(get_tcp_force()) < contact_force_threshold and contact_pose[2] > {surface_z:.4f}:"
        )
        program_lines.append("        contact_pose := pose_trans(contact_pose, p[0, 0, -contact_probe_step, 0, 0, 0])")
        program_lines.append(
            f"        movel(contact_pose, a={APPROACH_ACCELERATION:.1f}, v={travel_speed:.4f})"
        )
        program_lines.append("    end")
        program_lines.append(f"    if contact_pose[2] > {surface_z:.4f}:")
        program_lines.append(
            f"        movel({_format_pose(x_mm, y_mm, surface_z)}, a={APPROACH_ACCELERATION:.1f}, v={travel_speed:.4f})"
        )
        program_lines.append("    end")
        last_surface_x = x_mm
        last_surface_y = y_mm

    def move_at_surface(x_mm: float, y_mm: float) -> None:
        nonlocal last_surface_x, last_surface_y, tuft_distance_mm
        if last_surface_x is not None and last_surface_y is not None:
            tuft_distance_mm += _distance_2d(last_surface_x, last_surface_y, x_mm, y_mm)
        program_lines.append(
            f"    movel({_format_pose(x_mm, y_mm, surface_z)}, a={MOVE_ACCELERATION:.1f}, v={tuft_speed:.4f})"
        )
        last_surface_x = x_mm
        last_surface_y = y_mm

    def retract_to_safe(x_mm: float, y_mm: float) -> None:
        nonlocal last_surface_x, last_surface_y, last_safe_x, last_safe_y, vertical_distance_mm
        vertical_distance_mm += settings.tuft_height_mm
        program_lines.append(
            f"    movel({_format_pose(x_mm, y_mm, safe_z)}, a={APPROACH_ACCELERATION:.1f}, v={travel_speed:.4f})"
        )
        last_surface_x = None
        last_surface_y = None
        last_safe_x = x_mm
        last_safe_y = y_mm

    def ensure_tool_state(desired: bool) -> None:
        nonlocal tool_active
        if tool_active == desired:
            return
        program_lines.append(f"    set_digital_out({settings.tool_output}, {'True' if desired else 'False'})")
        tool_active = desired

    first_column, first_segments = column_plans[0]
    first_segment_start, _ = first_segments[0]
    initial_x = (first_column + 0.5) * pixel_width_mm
    initial_y = (first_segment_start + 0.5) * pixel_height_mm
    move_safe(initial_x, initial_y)

    for column_index, segments in column_plans:
        column_x = (column_index + 0.5) * pixel_width_mm
        for start, end in segments:
            start_y = (start + 0.5) * pixel_height_mm
            end_y = (end + 0.5) * pixel_height_mm

            if last_safe_x != column_x or last_safe_y != start_y:
                move_safe(column_x, start_y)

            lower_to_surface(column_x, start_y)
            ensure_tool_state(True)
            move_at_surface(column_x, end_y)
            ensure_tool_state(False)
            retract_to_safe(column_x, end_y)

    if last_safe_x is not None and last_safe_y is not None:
        home_x = 0.0
        home_y = 0.0
        travel_distance_mm += _distance_2d(last_safe_x, last_safe_y, home_x, home_y)
        program_lines.append(
            f"    movel({_format_pose(home_x, home_y, safe_z)}, a={MOVE_ACCELERATION:.1f}, v={travel_speed:.4f})"
        )
        last_safe_x = home_x
        last_safe_y = home_y

    ensure_tool_state(False)
    program_lines.append('    textmsg("Tufting job finished")')
    program_lines.append("end")

    travel_time_seconds = travel_distance_mm / settings.travel_speed_mm_per_sec if settings.travel_speed_mm_per_sec else 0.0
    tuft_time_seconds = tuft_distance_mm / settings.tuft_speed_mm_per_sec if settings.tuft_speed_mm_per_sec else 0.0
    vertical_time_seconds = vertical_distance_mm / settings.travel_speed_mm_per_sec if settings.travel_speed_mm_per_sec else 0.0
    estimated_cycle_time_seconds = int(round(travel_time_seconds + tuft_time_seconds + vertical_time_seconds))

    metadata = URGenerationMetadata(
        estimated_cycle_time_seconds=estimated_cycle_time_seconds,
        resolution=f"{width}x{height}",
        image_width=width,
        image_height=height,
        tuft_segments=tuft_segments,
        active_pixels=active_pixels,
    )

    return URGenerationResult("\n".join(program_lines), job_id, metadata)
