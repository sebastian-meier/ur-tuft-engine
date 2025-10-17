"""Bridges between the backend and the Universal Robots Python SDK."""

from __future__ import annotations

from .config import RobotConfig


class RobotCommunicationError(RuntimeError):
    """Raised when program delivery to the robot fails."""


def send_program_to_robot(program: str, config: RobotConfig) -> None:
    """Stream the generated URScript program to the configured robot controller."""

    if not config.enabled:
        return

    try:
        from ur_rtde import rtde_script_client  # type: ignore import-not-found
    except ImportError as exc:  # pragma: no cover - defensive branch
        raise RobotCommunicationError(
            "The 'ur-rtde' package is required for robot communication. "
            "Install it with `pip install ur-rtde` and retry."
        ) from exc

    try:
        client = rtde_script_client.RTDEScriptClient(config.host, config.port)
    except Exception as exc:  # pragma: no cover - depends on SDK internals
        raise RobotCommunicationError(
            f"Failed to initialise RTDE script client for {config.host}:{config.port}"
        ) from exc

    try:
        send_fn = getattr(client, "sendScript", None) or getattr(client, "send_script", None)
        if send_fn is None:
            raise RobotCommunicationError(
                "The RTDEScriptClient implementation does not expose a sendScript method."
            )
        send_fn(program)
    except Exception as exc:
        raise RobotCommunicationError(
            f"Failed to deliver program to robot at {config.host}:{config.port}"
        ) from exc
    finally:
        try:
            client.disconnect()
        except Exception:
            pass
