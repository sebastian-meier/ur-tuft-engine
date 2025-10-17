"""Regression tests for the URScript generator."""

from __future__ import annotations

from pathlib import Path

from app.ur_generator import URGenerationOptions, generate_ur_program

ROOT = Path(__file__).resolve().parents[2]
IMAGE_PATH = ROOT / "tests" / "test-1.jpg"
EXPECTED_PROGRAM_PATH = ROOT / "tests" / "output" / "test-1.urscript"


def test_generate_program_matches_snapshot() -> None:
    """Ensure the Python generator matches the historical URScript snapshot."""

    image_bytes = IMAGE_PATH.read_bytes()
    result = generate_ur_program(image_bytes, "test-1.jpg", URGenerationOptions())
    expected_program = EXPECTED_PROGRAM_PATH.read_text()

    assert result.program == expected_program
    assert result.metadata.estimated_cycle_time_seconds > 0
    assert result.metadata.tuft_segments > 0
    assert result.metadata.active_pixels > 0
