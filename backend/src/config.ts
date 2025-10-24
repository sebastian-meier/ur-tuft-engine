/**
 * Application-wide configuration loader. Centralizes environment parsing for robot connectivity,
 * toolpath generation and server behavior so both services and routes can rely on strongly typed
 * runtime values.
 */
import dotenv from 'dotenv';

dotenv.config();

/**
 * Configuration describing how to connect to, and command, the Universal Robot controller.
 */
export interface RobotConfig {
  /** Hostname or IP address for the robot controller. */
  host: string;
  /** Primary TCP port used when streaming generated UR programs. */
  port: number;
  /** Flag indicating whether robot streaming should be attempted. */
  enabled: boolean;
  /** Digital output index for the tufting end-effector. */
  toolOutput: number;
  /** Horizontal travel speed in millimetres per second while disengaged. */
  travelSpeedMmPerSec: number;
  /** Horizontal travel speed in millimetres per second while the tool is engaged. */
  tuftSpeedMmPerSec: number;
  /** Contact force threshold in Newtons that determines when the tool touched the surface. */
  contactForceThresholdN: number;
  /** Optional URL invoked by generated URScript to report progress after each move. */
  progressCallbackUrl: string;
}

/**
 * Configuration controlling scaling between pixel data and robot workspace as well as
 * classification of tuftable pixels.
 */
export interface ToolpathConfig {
  /** Width of the physical workpiece in millimetres represented by the uploaded bitmap. */
  workpieceWidthMm: number;
  /** Height of the physical workpiece in millimetres represented by the uploaded bitmap. */
  workpieceHeightMm: number;
  /** Clearance height in millimetres used for safe travel moves. */
  safeHeightMm: number;
  /** Depth in millimetres from the safe height to reach the surface. */
  tuftHeightMm: number;
  /** Greyscale threshold (0–255) for classifying pixels as active (black). */
  blackPixelThreshold: number;
}

/**
 * Fully hydrated runtime configuration for the backend process.
 */
export interface AppConfig {
  /** Port the HTTP server listens on. */
  port: number;
  /** Allowed CORS origins or `true` to allow all origins. */
  corsOrigins: string[] | true;
  /** Robot connectivity configuration. */
  robot: RobotConfig;
  /** Toolpath and rasterization configuration. */
  toolpath: ToolpathConfig;
}

/** Parses a positive integer port from an environment variable. */
const parsePort = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

/** Parses a numeric environment variable, falling back when necessary. */
const parseNumber = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map((origin) => origin.trim()).filter(Boolean)
  : true;

const robotHost = process.env.ROBOT_HOST;
const robotPort = parsePort(process.env.ROBOT_PORT, 30002);

/**
 * Resolved application configuration, evaluated once at module load so subsequent imports share
 * the same immutable object.
 */
export const config: AppConfig = {
  port: parsePort(process.env.PORT, 4000),
  corsOrigins,
  robot: {
    host: robotHost ?? '127.0.0.1',
    port: robotPort,
    enabled: Boolean(robotHost),
    toolOutput: parseNumber(process.env.ROBOT_TOOL_OUTPUT, 0),
    travelSpeedMmPerSec: Math.max(10, parseNumber(process.env.ROBOT_TRAVEL_SPEED_MM_S, 200)),
    tuftSpeedMmPerSec: Math.max(5, parseNumber(process.env.ROBOT_TUFT_SPEED_MM_S, 60)),
    contactForceThresholdN: Math.max(0.5, parseNumber(process.env.ROBOT_CONTACT_FORCE_THRESHOLD_N, 15)),
    progressCallbackUrl: process.env.ROBOT_PROGRESS_URL?.trim() ?? '',
  },
  toolpath: {
    workpieceWidthMm: Math.max(1, parseNumber(process.env.WORKPIECE_WIDTH_MM, 500)),
    workpieceHeightMm: Math.max(1, parseNumber(process.env.WORKPIECE_HEIGHT_MM, 500)),
    safeHeightMm: Math.max(10, parseNumber(process.env.SAFE_HEIGHT_MM, 150)),
    tuftHeightMm: Math.max(1, parseNumber(process.env.TUFT_HEIGHT_MM, 5)),
    blackPixelThreshold: Math.min(255, Math.max(0, parseNumber(process.env.BLACK_PIXEL_THRESHOLD, 64))),
  },
};
