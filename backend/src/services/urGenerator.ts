/**
 * Converts greyscale bitmap uploads into Universal Robots motion programs. The generator maps
 * columns of dark pixels into plunge/activate strokes while tracking motion metrics for downstream
 * estimation and reporting.
 */
import { randomUUID } from 'crypto';
import sharp from 'sharp';
import { saveJobContext } from './jobStore';

/** Options controlling how the image is transformed into a robot toolpath. */
export interface URGenerationOptions {
  /** Physical width of the workpiece the image spans, in millimetres. */
  workpieceWidthMm?: number;
  /** Physical height of the workpiece the image spans, in millimetres. */
  workpieceHeightMm?: number;
  /** Buffer from the border. */
  workpieceBufferMm?: number;
  /** Clearance height in millimetres for safe moves above the surface. */
  safeHeightMm?: number;
  /** Distance in millimetres to descend from safe height to contact the surface. */
  tuftHeightMm?: number;
  /** Digital output index used to toggle the tufting end-effector. */
  toolOutput?: number;
  /** Horizontal travel speed in millimetres per second while disengaged. */
  travelSpeedMmPerSec?: number;
  /** Horizontal travel speed in millimetres per second while engaged. */
  tuftSpeedMmPerSec?: number;
  /** Greyscale threshold (0–255) for classifying pixels as active. */
  blackPixelThreshold?: number;
  /** Target contact force in Newtons that determines when the tool has reached the surface. */
  contactForceThresholdN?: number;
  /** URScript variable name referencing the coordinate frame applied to generated poses. */
  coordinateFrameVariable?: string;
  /** URScript variable of the coordinate system pose (as planes are not available from code). */
  coordinateString?: string;
  /** URScript variable of the angle of the tool. */
  poseString?: string;
  /** Optional HTTP URL invoked by the robot after each move to report progress. */
  progressCallbackUrl?: string;
}

/** Structured metadata returned alongside the generated UR program. */
export interface URGenerationResult {
  /** fully formatted URScript program ready for streaming. */
  program: string;
  /** Unique job identifier for correlating uploads and downstream processing. */
  jobId: string;
  /** Collection of metrics describing the generated job. */
  metadata: {
    /** Rounded cycle time estimate in seconds. */
    estimatedCycleTimeSeconds: number;
    /** Pixel resolution of the processed image (e.g., `512x512`). */
    resolution: string;
    /** Width of the processed image in pixels. */
    imageWidth: number;
    /** Height of the processed image in pixels. */
    imageHeight: number;
    /** Number of column segments that will be tufted. */
    tuftSegments: number;
    /** Total count of pixels classified as active/black. */
    activePixels: number;
    /** Bounding box in millimetres covering all black pixels, or `null` when no black pixels were found. */
    boundingBoxMm: BoundingBoxMm | null;
    /** Total number of planned `movel` commands emitted for the tufting job. */
    movementCount: number;
  };
}

export interface PreflightGenerationResult {
  /** fully formatted URScript program executing the preflight path. */
  program: string;
  /** Additional details describing the generated routine. */
  metadata: {
    /** Coordinate frame variable applied to generated poses. */
    coordinateFrame: string;
    /** Total horizontal travel distance across the preflight path, in millimetres. */
    travelDistanceMm: number;
    /** Approximate duration of the routine, in seconds. */
    estimatedCycleTimeSeconds: number;
    /** Per-corner dwell duration, in seconds. */
    cornerDwellSeconds: number;
    /** Ordered waypoint list traversed by the preflight path. */
    waypoints: Array<{ xMm: number; yMm: number; dwellSeconds: number }>;
  };
}

export interface ToolTestGenerationResult {
  /** fully formatted URScript program toggling the tufting gun while jogging along Z. */
  program: string;
  metadata: {
    /** Distance travelled along the Z axis during the test motion, in metres. */
    displacementMeters: number;
    /** Digital output index driven during the test. */
    toolOutput: number;
    /** Duration in seconds the tool output remains active. */
    dwellSeconds: number;
    /** Linear speed used for the motion, in millimetres per second. */
    travelSpeedMmPerSec: number;
  };
}

export interface BoundingBoxMm {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface BoundingBoxRoutineResult {
  /** fully formatted URScript program visiting each corner of the provided bounding box. */
  program: string;
  metadata: {
    /** Bounding box coordinates used to generate the routine, in millimetres. */
    boundingBox: BoundingBoxMm;
    /** Coordinate frame variable applied to generated poses. */
    coordinateFrame: string;
    /** Total planar travel distance across the executed path, in millimetres. */
    travelDistanceMm: number;
  };
}

export function generatePreflightProgram(options: URGenerationOptions = {}): PreflightGenerationResult {
  const settings: Required<URGenerationOptions> = { ...DEFAULT_OPTIONS, ...options };
  const coordinateFrameVariable = resolveCoordinateFrameVariable(settings.coordinateFrameVariable);
  const formatPoseForFrame = (xMm: number, yMm: number, zMeters: number) =>
    formatPose(coordinateFrameVariable, xMm, yMm, zMeters);

  const moveAcceleration = 1.2;
  const safeZ = settings.safeHeightMm / 1000;
  const travelSpeed = settings.travelSpeedMmPerSec / 1000;

  const preflightWaypoints = buildPreflightWaypoints(settings.workpieceWidthMm, settings.workpieceHeightMm, settings.workpieceBufferMm);
  const travelDistanceMm = calculatePreflightTravelDistance(preflightWaypoints);
  const totalDwellSeconds =
    preflightWaypoints.filter((waypoint) => waypoint.dwell).length * PREFLIGHT_DWELL_SECONDS;

  const programLines: string[] = [];
  programLines.push(`def tuft_preflight_program():`);
  programLines.push(settings.coordinateString);
  programLines.push(settings.poseString);
  programLines.push(`    textmsg("Starting tuft preflight routine")`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(
    ...createPreflightMoveLines({
      waypoints: preflightWaypoints,
      indent: '    ',
      formatPoseForFrame,
      moveAcceleration,
      travelSpeed,
      safeZ,
    }),
  );
  programLines.push(`    textmsg("Preflight routine complete")`);
  programLines.push(`end`);
  programLines.push(`tuft_preflight_program()`);

  return {
    program: programLines.join('\n'),
    metadata: {
      coordinateFrame: coordinateFrameVariable,
      travelDistanceMm,
      estimatedCycleTimeSeconds: Math.round(travelDistanceMm / settings.travelSpeedMmPerSec + totalDwellSeconds),
      cornerDwellSeconds: PREFLIGHT_DWELL_SECONDS,
      waypoints: preflightWaypoints.map((waypoint) => ({
        xMm: waypoint.x,
        yMm: waypoint.y,
        dwellSeconds: waypoint.dwell ? PREFLIGHT_DWELL_SECONDS : 0,
      })),
    },
  };
}

export function generateToolTestProgram(options: URGenerationOptions = {}): ToolTestGenerationResult {
  const settings: Required<URGenerationOptions> = { ...DEFAULT_OPTIONS, ...options };
  const moveAcceleration = 1.2;
  const travelSpeed = settings.travelSpeedMmPerSec / 1000;
  const displacementMeters = 0.15;
  const dwellSeconds = 5;
  const formatPoseForFrame = (xMm: number, yMm: number, zMeters: number) =>
    formatPose(settings.coordinateFrameVariable, xMm, yMm, zMeters);
  const effectiveWidthMm = Math.max(0, settings.workpieceWidthMm - 2 * settings.workpieceBufferMm);
  const effectiveHeightMm = Math.max(0, settings.workpieceHeightMm - 2 * settings.workpieceBufferMm);
  const centerX = settings.workpieceBufferMm + effectiveWidthMm / 2;
  const centerY = settings.workpieceBufferMm + effectiveHeightMm / 2;
  const safeZ = settings.safeHeightMm / 1000;

  const programLines: string[] = [];
  programLines.push(`def tuft_tool_test_program():`);
  programLines.push(settings.coordinateString);
  programLines.push(settings.poseString);
  programLines.push(`    textmsg("Starting tufting gun test")`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(`    new_pose = ${formatPoseForFrame(centerX, centerY, safeZ)}`);
  programLines.push(
    `    movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
  );
  programLines.push(
    `    local test_pose_temp = ${formatPoseForFrame(centerX, centerY, safeZ - displacementMeters)}`,
  );
  programLines.push(
    `    local test_pose = p[test_pose_temp[0], test_pose_temp[1], test_pose_temp[2], current_pose[3], current_pose[4], current_pose[5]]`,
  );
  programLines.push(
    `    movel(test_pose, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
  );
  programLines.push(`    set_digital_out(${settings.toolOutput}, True)`);
  programLines.push(`    sleep(${dwellSeconds.toFixed(1)})`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(
    `    movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
  );
  programLines.push(`    textmsg("Tufting gun test finished")`);
  programLines.push(`end`);
  programLines.push(`tuft_tool_test_program()`);

  return {
    program: programLines.join('\n'),
    metadata: {
      displacementMeters,
      toolOutput: settings.toolOutput,
      dwellSeconds,
      travelSpeedMmPerSec: settings.travelSpeedMmPerSec,
    },
  };
}

export function generateBoundingBoxRoutine(
  boundingBox: BoundingBoxMm,
  options: URGenerationOptions = {},
): BoundingBoxRoutineResult {
  const settings: Required<URGenerationOptions> = { ...DEFAULT_OPTIONS, ...options };
  const coordinateFrameVariable = resolveCoordinateFrameVariable(settings.coordinateFrameVariable);
  const formatPoseForFrame = (xMm: number, yMm: number, zMeters: number) =>
    formatPose(coordinateFrameVariable, xMm, yMm, zMeters);

  const moveAcceleration = 1.2;
  const travelSpeed = settings.travelSpeedMmPerSec / 1000;
  const safeZ = settings.safeHeightMm / 1000;

  const corners = [
    { x: boundingBox.minX, y: boundingBox.minY },
    { x: boundingBox.maxX, y: boundingBox.minY },
    { x: boundingBox.maxX, y: boundingBox.maxY },
    { x: boundingBox.minX, y: boundingBox.maxY },
  ];

  let travelDistanceMm = 0;
  for (let index = 1; index < corners.length; index += 1) {
    travelDistanceMm += distance2D(
      corners[index - 1].x,
      corners[index - 1].y,
      corners[index].x,
      corners[index].y,
    );
  }

  const programLines: string[] = [];
  programLines.push(`def tuft_bounding_box_program():`);
  programLines.push(settings.coordinateString);
  programLines.push(settings.poseString);
  programLines.push(`    textmsg("Visiting tufting bounding box corners")`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);

  for (const corner of corners) {
    programLines.push(`    new_pose = ${formatPoseForFrame(corner.x, corner.y, safeZ)}`);
    programLines.push(
      `    movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
  }

  programLines.push(`    textmsg("Bounding box traversal finished")`);
  programLines.push(`end`);
  programLines.push(`tuft_bounding_box_program()`);

  return {
    program: programLines.join('\n'),
    metadata: {
      boundingBox,
      coordinateFrame: coordinateFrameVariable,
      travelDistanceMm,
    },
  };
}

interface ColumnSegment {
  start: number;
  end: number;
}

interface ColumnPlan {
  column: number;
  segments: ColumnSegment[];
}

interface ProgressCallbackConfig {
  host: string;
  hostHeader: string;
  port: number;
  path: string;
}

const parseProgressCallbackUrl = (urlString: string | undefined): ProgressCallbackConfig | null => {
  if (!urlString) {
    return null;
  }

  try {
    const url = new URL(urlString);
    if (url.protocol !== 'http:') {
      return null;
    }

    const host = url.hostname.replace(/"/g, '');
    const port = url.port ? Number(url.port) : 80;
    const hostHeader = url.port ? `${host}:${url.port}` : host;
    const path = (url.pathname || '/') + (url.search || '');

    return {
      host,
      hostHeader,
      port,
      path,
    };
  } catch {
    return null;
  }
};

const escapeStringForUrScript = (value: string): string => value.replace(/"/g, '\\"');

const DEFAULT_OPTIONS: Required<URGenerationOptions> = {
  workpieceWidthMm: 1500,
  workpieceHeightMm: 1050,
  workpieceBufferMm: 50,
  safeHeightMm: 150,
  tuftHeightMm: -2,
  toolOutput: 0,
  travelSpeedMmPerSec: 200,
  tuftSpeedMmPerSec: 60,
  blackPixelThreshold: 64,
  contactForceThresholdN: 15,
  coordinateFrameVariable: 'tuft_coords',
  coordinateString: '    global tuft_coords = p[-0.743799, 1.270828, -0.183331, 1.574839, 0.004352, -0.002073]',
  poseString: '    global current_pose = p[0,0,0,-1.19353,1.19941,1.24224]',
  progressCallbackUrl: '',
};

const RAD_ORIENTATION = {
  rx: 0,
  ry: Math.PI,
  rz: 0,
};

const PREFLIGHT_DWELL_SECONDS = 0.5;

interface PreflightWaypoint {
  x: number;
  y: number;
  dwell: boolean;
}

const COORDINATE_VARIABLE_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

const resolveCoordinateFrameVariable = (variable: string): string =>
  COORDINATE_VARIABLE_PATTERN.test(variable) ? variable : DEFAULT_OPTIONS.coordinateFrameVariable;

/** Formats a cartesian pose relative to the provided coordinate frame via URScript `pose_trans`. */
const formatPose = (frameVariable: string, xMm: number, yMm: number, zMeters: number): string => {
  const x = (xMm / 1000).toFixed(4);
  const y = (yMm / 1000).toFixed(4);
  const z = zMeters.toFixed(4);
  return `pose_trans(${frameVariable}, p[${x}, ${y}, ${z}, 0, 0, 0])`;
};

/**
 * Computes a planar euclidean distance between two millimetre-based points.
 */
const distance2D = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
};

const buildPreflightWaypoints = (workpieceWidthMm: number, workpieceHeightMm: number, workpieceBufferMm: number): PreflightWaypoint[] => [
  { x: workpieceBufferMm, y: workpieceBufferMm, dwell: true },
  { x: workpieceWidthMm - workpieceBufferMm, y: workpieceBufferMm, dwell: true },
  { x: workpieceWidthMm - workpieceBufferMm, y: workpieceHeightMm - workpieceBufferMm, dwell: true },
  { x: workpieceBufferMm, y: workpieceHeightMm - workpieceBufferMm, dwell: true },
  { x: workpieceWidthMm / 2, y: workpieceHeightMm / 2, dwell: false },
];

const calculatePreflightTravelDistance = (waypoints: PreflightWaypoint[]): number => {
  let total = 0;
  for (let index = 1; index < waypoints.length; index += 1) {
    total += distance2D(
      waypoints[index - 1].x,
      waypoints[index - 1].y,
      waypoints[index].x,
      waypoints[index].y,
    );
  }
  return total;
};

const createPreflightMoveLines = ({
  waypoints,
  indent,
  formatPoseForFrame,
  moveAcceleration,
  travelSpeed,
  safeZ,
}: {
  waypoints: PreflightWaypoint[];
  indent: string;
  formatPoseForFrame: (xMm: number, yMm: number, zMeters: number) => string;
  moveAcceleration: number;
  travelSpeed: number;
  safeZ: number;
}): string[] => {
  const lines: string[] = [];

  for (const waypoint of waypoints) {
    lines.push(`new_pose = ${formatPoseForFrame(waypoint.x, waypoint.y, safeZ)}`);
    lines.push(
      `${indent}movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
    if (waypoint.dwell) {
      lines.push(`${indent}sleep(${PREFLIGHT_DWELL_SECONDS.toFixed(1)})`);
    }
  }

  return lines;
};

/**
 * Parses the provided image buffer, extracts vertical stroke segments, and emits a URScript program
 * with move/activation commands that mirror the artwork on the robot workspace.
 *
 * The function is intentionally implemented as a collection of small, nested helpers to keep the
 * main data flow readable:
 *  1. Decode the bitmap into a single-channel greyscale buffer (`sharp`).
 *  2. Walk each column, grouping consecutive dark pixels into tuft segments.
 *  3. Emit move commands for each segment, toggling the configured digital output as required.
 *  4. Accumulate movement distances to approximate cycle time.
 *
 * @param imageBuffer Raw multipart upload content.
 * @param originalName Original filename, used for traceability messages.
 * @param options Optional overrides for workspace scaling and robot behavior.
 * @returns Promise resolving with the UR program text and metadata.
 */
export async function generateURProgram(
  imageBuffer: Buffer,
  originalName: string,
  options: URGenerationOptions = {},
): Promise<URGenerationResult> {
  const settings: Required<URGenerationOptions> = { ...DEFAULT_OPTIONS, ...options };
  const jobId = randomUUID();
  const coordinateFrameVariable = resolveCoordinateFrameVariable(settings.coordinateFrameVariable);
  const formatPoseForFrame = (xMm: number, yMm: number, zMeters: number) =>
    formatPose(coordinateFrameVariable, xMm, yMm, zMeters);
  const progressConfig = parseProgressCallbackUrl(settings.progressCallbackUrl?.trim());

  if (settings.tuftHeightMm >= settings.safeHeightMm) {
    throw new Error('Tuft height must be smaller than the safe height to allow a retract move.');
  }

  const safeZ = settings.safeHeightMm / 1000;
  const surfaceZ = Math.max(0, (settings.safeHeightMm - settings.tuftHeightMm) / 1000);
  const travelSpeed = settings.travelSpeedMmPerSec / 1000;
  const tuftSpeed = settings.tuftSpeedMmPerSec / 1000;
  const threshold = Math.min(255, Math.max(0, settings.blackPixelThreshold));
  const contactForceThreshold = Math.max(0.5, settings.contactForceThresholdN);
  const contactStepMeters = 0.001; // 1 mm incremental descent while probing for contact.

  // STEP 1: Decode the uploaded bitmap into a greyscale buffer we can index per pixel.
  const { data, info } = await sharp(imageBuffer)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const width = info.width ?? 0;
  const height = info.height ?? 0;

  if (width === 0 || height === 0) {
    throw new Error('Unable to read uploaded image dimensions.');
  }

  if (info.channels !== 1) {
    throw new Error('Expected a single greyscale channel after preprocessing.');
  }

  const effectiveWidthMm = Math.max(0, settings.workpieceWidthMm - 2 * settings.workpieceBufferMm);
  const effectiveHeightMm = Math.max(0, settings.workpieceHeightMm - 2 * settings.workpieceBufferMm);
  const pixelWidthMm = width > 0 ? effectiveWidthMm / width : 0;
  const pixelHeightMm = height > 0 ? effectiveHeightMm / height : 0;

  // STEP 2: Group consecutive black pixels column-by-column into tuft segments.
  const columnPlans: ColumnPlan[] = [];
  let activePixels = 0;
  let minColumn = Number.POSITIVE_INFINITY;
  let maxColumn = Number.NEGATIVE_INFINITY;
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;

  for (let column = 0; column < width; column += 1) {
    const segments: ColumnSegment[] = [];
    let row = 0;

    while (row < height) {
      const pixelValue = data[row * width + column];
      if (pixelValue <= threshold) {
        const start = row;
        while (row < height && data[row * width + column] <= threshold) {
          row += 1;
        }
        const end = row - 1;
        segments.push({ start, end });
        activePixels += end - start + 1;

        if (column < minColumn) {
          minColumn = column;
        }
        if (column > maxColumn) {
          maxColumn = column;
        }
        if (start < minRow) {
          minRow = start;
        }
        if (end > maxRow) {
          maxRow = end;
        }
      } else {
        row += 1;
      }
    }

    if (segments.length > 0) {
      columnPlans.push({ column, segments });
    }
  }

  const tuftSegments = columnPlans.reduce((total, plan) => total + plan.segments.length, 0);
  const hasActivePixels = activePixels > 0 && Number.isFinite(minColumn);
  const boundingBoxMm = hasActivePixels
    ? {
        minX: settings.workpieceBufferMm + minColumn * pixelWidthMm,
        maxX: settings.workpieceBufferMm + (maxColumn + 1) * pixelWidthMm,
        minY: settings.workpieceBufferMm + minRow * pixelHeightMm,
        maxY: settings.workpieceBufferMm + (maxRow + 1) * pixelHeightMm,
      }
    : null;

  const programLines: string[] = [];
  const movementBlocks: string[][] = [];
  programLines.push(`def tuft_program():`);
  programLines.push(settings.coordinateString);
  programLines.push(settings.poseString);
  programLines.push(`    textmsg("Starting tufting job ${originalName}")`);
  programLines.push(`    textmsg("Using coordinate frame ${coordinateFrameVariable}")`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(`    global travel_speed = ${travelSpeed.toFixed(4)}`);
  programLines.push(`    global tuft_speed = ${tuftSpeed.toFixed(4)}`);
  programLines.push(`    global contact_force_threshold = ${contactForceThreshold.toFixed(2)}`);
  programLines.push(`    global contact_probe_step = ${contactStepMeters.toFixed(4)}`);

  let progressTotalLineIndex: number | null = null;
  if (progressConfig) {
    const escapedHost = escapeStringForUrScript(progressConfig.host);
    const escapedHostHeader = escapeStringForUrScript(progressConfig.hostHeader);
    const escapedPath = escapeStringForUrScript(progressConfig.path);
    const escapedJobId = escapeStringForUrScript(jobId);
    programLines.push(`    global progress_host = "${escapedHost}"`);
    programLines.push(`    global progress_host_header = "${escapedHostHeader}"`);
    programLines.push(`    global progress_port = ${progressConfig.port}`);
    programLines.push(`    global progress_path = "${escapedPath}"`);
    programLines.push(`    global progress_total = 0`);
    progressTotalLineIndex = programLines.length - 1;
    programLines.push(`    global progress_current = 0`);
    programLines.push(`    global progress_job_id = "${escapedJobId}"`);
    programLines.push(`    def report_progress():`);
    programLines.push(`        progress_current = progress_current + 1`);
    programLines.push(
      `        local payload = "{\\"jobId\\":\\"" + progress_job_id + "\\",\\"current\\":" + to_str(progress_current) + ",\\"total\\":" + to_str(progress_total) + "}"`,
    );
    programLines.push(`        local content_length = strlen(payload)`);
    programLines.push(`        if socket_open(progress_host, progress_port):`);
    programLines.push(`            socket_send_string("POST " + progress_path + " HTTP/1.1\\r\\n")`);
    programLines.push(`            socket_send_string("Host: " + progress_host_header + "\\r\\n")`);
    programLines.push(`            socket_send_string("Content-Type: application/json\\r\\n")`);
    programLines.push(
      `            socket_send_string("Content-Length: " + to_str(content_length) + "\\r\\n\\r\\n")`,
    );
    programLines.push(`            socket_send_string(payload)`);
    programLines.push(`            socket_close()`);
    programLines.push(`        end`);
    programLines.push(`    end`);
  }

  if (tuftSegments === 0) {
    programLines.push(`    textmsg("No dark pixels detected; nothing to tuft.")`);
    programLines.push(`end`);
    return {
      program: programLines.join('\n'),
      jobId: randomUUID(),
      metadata: {
        estimatedCycleTimeSeconds: 0,
        resolution: `${width}x${height}`,
        imageWidth: width,
        imageHeight: height,
        tuftSegments,
        activePixels,
        boundingBoxMm,
        movementCount: 0,
      },
    };
  }

  const moveAcceleration = 1.2;
  const approachAcceleration = 0.8;
  let lastSafeX: number | null = null;
  let lastSafeY: number | null = null;
  let lastSurfaceX: number | null = null;
  let lastSurfaceY: number | null = null;
  let toolActive = false;

  let travelDistanceMm = 0;
  let tuftDistanceMm = 0;
  let verticalDistanceMm = 0;
  let movementCount = 0;

  const emitMove = (
    indent: string,
    xMm: number,
    yMm: number,
    zMeters: number,
    acceleration: number,
    speed: number,
  ) => {
    const poseExpression = formatPoseForFrame(xMm, yMm, zMeters);
    const poseLine = `${indent}new_pose = ${poseExpression}`;
    const moveLine = `${indent}movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=${acceleration.toFixed(1)}, v=${speed.toFixed(4)})`;
    movementBlocks.push([poseLine, moveLine]);
    programLines.push(poseLine);
    programLines.push(moveLine);
    if (progressConfig) {
      programLines.push(`${indent}report_progress()`);
    }
    movementCount += 1;
  };

  // Helper functions keep command emission readable while maintaining motion metrics.
  const moveSafe = (xMm: number, yMm: number) => {
    if (lastSafeX !== null && lastSafeY !== null) {
      const travel = distance2D(lastSafeX, lastSafeY, xMm, yMm);
      travelDistanceMm += travel;
    }
    emitMove('    ', xMm, yMm, safeZ, moveAcceleration, travelSpeed);
    lastSafeX = xMm;
    lastSafeY = yMm;
  };

  const lowerToSurface = (xMm: number, yMm: number) => {
    verticalDistanceMm += settings.tuftHeightMm;
    emitMove('    ', xMm, yMm, surfaceZ, approachAcceleration, travelSpeed);
    lastSurfaceX = xMm;
    lastSurfaceY = yMm;
  };

  const moveAtSurface = (xMm: number, yMm: number) => {
    if (lastSurfaceX !== null && lastSurfaceY !== null) {
      const tuftTravel = distance2D(lastSurfaceX, lastSurfaceY, xMm, yMm);
      tuftDistanceMm += tuftTravel;
    }
    emitMove('    ', xMm, yMm, surfaceZ, moveAcceleration, tuftSpeed);
    lastSurfaceX = xMm;
    lastSurfaceY = yMm;
  };

  const retractToSafe = (xMm: number, yMm: number) => {
    verticalDistanceMm += settings.tuftHeightMm;
    emitMove('    ', xMm, yMm, safeZ, approachAcceleration, travelSpeed);
    lastSurfaceX = null;
    lastSurfaceY = null;
    lastSafeX = xMm;
    lastSafeY = yMm;
  };

  const ensureToolState = (desired: boolean) => {
    if (toolActive === desired) {
      return;
    }
    programLines.push(`    set_digital_out(${settings.toolOutput}, ${desired ? 'True' : 'False'})`);
    toolActive = desired;
  };

  // STEP 3: Emit moves for each tuft segment, toggling the tool output around each stroke.
  const firstColumn = columnPlans[0];
  const firstSegment = firstColumn.segments[0];
  const initialX = settings.workpieceBufferMm + (firstColumn.column + 0.5) * pixelWidthMm;
  const initialY = settings.workpieceBufferMm + (firstSegment.start + 0.5) * pixelHeightMm;

  moveSafe(initialX, initialY);

  for (const plan of columnPlans) {
    const columnX = settings.workpieceBufferMm + (plan.column + 0.5) * pixelWidthMm;

    for (const segment of plan.segments) {
      const startY = settings.workpieceBufferMm + (segment.start + 0.5) * pixelHeightMm;
      const endY = settings.workpieceBufferMm + (segment.end + 0.5) * pixelHeightMm;

      if (lastSafeX !== columnX || lastSafeY !== startY) {
        moveSafe(columnX, startY);
      }

      lowerToSurface(columnX, startY);
      ensureToolState(true);
      moveAtSurface(columnX, endY);
      ensureToolState(false);
      retractToSafe(columnX, endY);
    }
  }

  // STEP 4: Return to home and summarise motion for cycle times.
  if (lastSafeX !== null && lastSafeY !== null) {
    const homeX = 0;
    const homeY = 0;
    travelDistanceMm += distance2D(lastSafeX, lastSafeY, homeX, homeY);
    emitMove('    ', homeX, homeY, safeZ, moveAcceleration, travelSpeed);
    lastSafeX = homeX;
    lastSafeY = homeY;
  }

  movementCount = movementBlocks.length;

  if (progressTotalLineIndex !== null) {
    programLines[progressTotalLineIndex] = `    global progress_total = ${movementCount}`;
  }

  ensureToolState(false);
  programLines.push(`    textmsg("Tufting job finished")`);
  programLines.push('end');

  const travelTimeSeconds = travelDistanceMm / settings.travelSpeedMmPerSec;
  const tuftTimeSeconds = tuftDistanceMm / settings.tuftSpeedMmPerSec;
  const verticalTimeSeconds = verticalDistanceMm / settings.travelSpeedMmPerSec;
  const estimatedCycleTimeSeconds = Math.round(travelTimeSeconds + tuftTimeSeconds + verticalTimeSeconds);

  const fullProgram = programLines.join('\n');

  saveJobContext(jobId, {
    jobId,
    movementBlocks: movementBlocks.map((block) => [...block]),
    coordinateFrameVariable,
    progressConfig,
    movementCount,
    safeZ,
    travelSpeed,
    tuftSpeed,
    toolOutput: settings.toolOutput,
    coordinateString: settings.coordinateString,
    poseString: settings.poseString,
    program: fullProgram,
  });

  return {
    program: fullProgram,
    jobId,
    metadata: {
      estimatedCycleTimeSeconds,
      resolution: `${width}x${height}`,
      imageWidth: width,
      imageHeight: height,
      tuftSegments,
      activePixels,
      boundingBoxMm,
      movementCount,
    },
  };
}
