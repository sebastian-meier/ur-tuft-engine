/**
 * Converts greyscale bitmap uploads into Universal Robots motion programs. The generator maps
 * columns of dark pixels into plunge/activate strokes while tracking motion metrics for downstream
 * estimation and reporting.
 */
import { randomUUID } from 'crypto';
import sharp from 'sharp';

/** Options controlling how the image is transformed into a robot toolpath. */
export interface URGenerationOptions {
  /** Physical width of the workpiece the image spans, in millimetres. */
  workpieceWidthMm?: number;
  /** Physical height of the workpiece the image spans, in millimetres. */
  workpieceHeightMm?: number;
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

  const preflightWaypoints = buildPreflightWaypoints(settings.workpieceWidthMm, settings.workpieceHeightMm);
  const travelDistanceMm = calculatePreflightTravelDistance(preflightWaypoints);
  const totalDwellSeconds =
    preflightWaypoints.filter((waypoint) => waypoint.dwell).length * PREFLIGHT_DWELL_SECONDS;

  const programLines: string[] = [];
  programLines.push(`def tuft_preflight_program():`);
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

  const programLines: string[] = [];
  programLines.push(`def tuft_tool_test_program():`);
  programLines.push(`    textmsg("Starting tufting gun test")`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(`    local start_pose = get_actual_tcp_pose()`);
  programLines.push(
    `    local test_pose = pose_trans(start_pose, p[0, 0, -${displacementMeters.toFixed(4)}, 0, 0, 0])`,
  );
  programLines.push(
    `    movel(test_pose, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
  );
  programLines.push(`    set_digital_out(${settings.toolOutput}, True)`);
  programLines.push(`    sleep(${dwellSeconds.toFixed(1)})`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(
    `    movel(start_pose, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
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
  programLines.push(`    textmsg("Visiting tufting bounding box corners")`);
  programLines.push(
    ...corners.map(
      (corner) =>
        `    movel(${formatPoseForFrame(corner.x, corner.y, safeZ)}, a=${moveAcceleration.toFixed(
          1,
        )}, v=${travelSpeed.toFixed(4)})`,
    ),
  );
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
  workpieceWidthMm: 500,
  workpieceHeightMm: 500,
  safeHeightMm: 150,
  tuftHeightMm: 5,
  toolOutput: 0,
  travelSpeedMmPerSec: 200,
  tuftSpeedMmPerSec: 60,
  blackPixelThreshold: 64,
  contactForceThresholdN: 15,
  coordinateFrameVariable: 'tuftCoord',
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
  return `pose_trans(${frameVariable}, p[${x}, ${y}, ${z}, ${RAD_ORIENTATION.rx.toFixed(4)}, ${RAD_ORIENTATION.ry.toFixed(4)}, ${RAD_ORIENTATION.rz.toFixed(4)}])`;
};

/**
 * Computes a planar euclidean distance between two millimetre-based points.
 */
const distance2D = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
};

const buildPreflightWaypoints = (workpieceWidthMm: number, workpieceHeightMm: number): PreflightWaypoint[] => [
  { x: 0, y: 0, dwell: true },
  { x: workpieceWidthMm, y: 0, dwell: true },
  { x: workpieceWidthMm, y: workpieceHeightMm, dwell: true },
  { x: 0, y: workpieceHeightMm, dwell: true },
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
    lines.push(
      `${indent}movel(${formatPoseForFrame(waypoint.x, waypoint.y, safeZ)}, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
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

  const pixelWidthMm = settings.workpieceWidthMm / width;
  const pixelHeightMm = settings.workpieceHeightMm / height;

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
        minX: minColumn * pixelWidthMm,
        maxX: (maxColumn + 1) * pixelWidthMm,
        minY: minRow * pixelHeightMm,
        maxY: (maxRow + 1) * pixelHeightMm,
      }
    : null;

  const programLines: string[] = [];
  programLines.push(`def tuft_program():`);
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

  const emitMove = (line: string) => {
    programLines.push(line);
    if (progressConfig) {
      const indent = line.match(/^(\s*)/)?.[1] ?? '';
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
    emitMove(
      `    movel(${formatPoseForFrame(xMm, yMm, safeZ)}, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
    lastSafeX = xMm;
    lastSafeY = yMm;
  };

  const lowerToSurface = (xMm: number, yMm: number) => {
    verticalDistanceMm += settings.tuftHeightMm;
    programLines.push('    local contact_pose = get_actual_tcp_pose()');
    programLines.push(
      `    while norm(get_tcp_force()) < contact_force_threshold and contact_pose[2] > ${surfaceZ.toFixed(4)}:`,
    );
    programLines.push(
      `        contact_pose := pose_trans(contact_pose, p[0, 0, -contact_probe_step, 0, 0, 0])`,
    );
    programLines.push(
      `        movel(contact_pose, a=${approachAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
    programLines.push('    end');
    programLines.push(`    if contact_pose[2] > ${surfaceZ.toFixed(4)}:`);
    emitMove(
      `        movel(${formatPoseForFrame(xMm, yMm, surfaceZ)}, a=${approachAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
    programLines.push('    end');
    lastSurfaceX = xMm;
    lastSurfaceY = yMm;
  };

  const moveAtSurface = (xMm: number, yMm: number) => {
    if (lastSurfaceX !== null && lastSurfaceY !== null) {
      const tuftTravel = distance2D(lastSurfaceX, lastSurfaceY, xMm, yMm);
      tuftDistanceMm += tuftTravel;
    }
    emitMove(
      `    movel(${formatPoseForFrame(xMm, yMm, surfaceZ)}, a=${moveAcceleration.toFixed(1)}, v=${tuftSpeed.toFixed(4)})`,
    );
    lastSurfaceX = xMm;
    lastSurfaceY = yMm;
  };

  const retractToSafe = (xMm: number, yMm: number) => {
    verticalDistanceMm += settings.tuftHeightMm;
    emitMove(
      `    movel(${formatPoseForFrame(xMm, yMm, safeZ)}, a=${approachAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
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
  const initialX = (firstColumn.column + 0.5) * pixelWidthMm;
  const initialY = (firstSegment.start + 0.5) * pixelHeightMm;

  moveSafe(initialX, initialY);

  for (const plan of columnPlans) {
    const columnX = (plan.column + 0.5) * pixelWidthMm;

    for (const segment of plan.segments) {
      const startY = (segment.start + 0.5) * pixelHeightMm;
      const endY = (segment.end + 0.5) * pixelHeightMm;

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
    emitMove(
      `    movel(${formatPoseForFrame(homeX, homeY, safeZ)}, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
    lastSafeX = homeX;
    lastSafeY = homeY;
  }

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

  return {
    program: programLines.join('\n'),
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
