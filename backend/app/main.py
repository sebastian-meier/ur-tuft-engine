"""Executable entry-point for running the FastAPI application with uvicorn."""

from __future__ import annotations

import uvicorn

from .config import get_config


def run() -> None:
    """Start the uvicorn development server."""

    config = get_config()
    uvicorn.run("app.api:app", host="0.0.0.0", port=config.port, reload=False)


if __name__ == "__main__":
    run()
