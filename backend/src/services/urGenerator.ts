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
};

const RAD_ORIENTATION = {
  rx: 0,
  ry: Math.PI,
  rz: 0,
};

/**
 * Formats a cartesian pose using the configured orientation for use in URScript `movel` commands.
 */
const formatPose = (xMm: number, yMm: number, zMeters: number): string => {
  const x = (xMm / 1000).toFixed(4);
  const y = (yMm / 1000).toFixed(4);
  const z = zMeters.toFixed(4);
  return `p[${x}, ${y}, ${z}, ${RAD_ORIENTATION.rx.toFixed(4)}, ${RAD_ORIENTATION.ry.toFixed(4)}, ${RAD_ORIENTATION.rz.toFixed(4)}]`;
};

/**
 * Computes a planar euclidean distance between two millimetre-based points.
 */
const distance2D = (x1: number, y1: number, x2: number, y2: number): number => {
  const dx = x2 - x1;
  const dy = y2 - y1;
  return Math.hypot(dx, dy);
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
      } else {
        row += 1;
      }
    }

    if (segments.length > 0) {
      columnPlans.push({ column, segments });
    }
  }

  const tuftSegments = columnPlans.reduce((total, plan) => total + plan.segments.length, 0);

  const programLines: string[] = [];
  programLines.push(`def tuft_program():`);
  programLines.push(`    textmsg("Starting tufting job ${originalName}")`);
  programLines.push(`    set_digital_out(${settings.toolOutput}, False)`);
  programLines.push(`    global travel_speed = ${travelSpeed.toFixed(4)}`);
  programLines.push(`    global tuft_speed = ${tuftSpeed.toFixed(4)}`);
  programLines.push(`    global contact_force_threshold = ${contactForceThreshold.toFixed(2)}`);
  programLines.push(`    global contact_probe_step = ${contactStepMeters.toFixed(4)}`);

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

  // Helper functions keep command emission readable while maintaining motion metrics.
  const moveSafe = (xMm: number, yMm: number) => {
    if (lastSafeX !== null && lastSafeY !== null) {
      const travel = distance2D(lastSafeX, lastSafeY, xMm, yMm);
      travelDistanceMm += travel;
    }
    programLines.push(
      `    movel(${formatPose(xMm, yMm, safeZ)}, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
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
    programLines.push(
      `        movel(${formatPose(xMm, yMm, surfaceZ)}, a=${approachAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
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
    programLines.push(
      `    movel(${formatPose(xMm, yMm, surfaceZ)}, a=${moveAcceleration.toFixed(1)}, v=${tuftSpeed.toFixed(4)})`,
    );
    lastSurfaceX = xMm;
    lastSurfaceY = yMm;
  };

  const retractToSafe = (xMm: number, yMm: number) => {
    verticalDistanceMm += settings.tuftHeightMm;
    programLines.push(
      `    movel(${formatPose(xMm, yMm, safeZ)}, a=${approachAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
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
    programLines.push(
      `    movel(${formatPose(homeX, homeY, safeZ)}, a=${moveAcceleration.toFixed(1)}, v=${travelSpeed.toFixed(4)})`,
    );
    lastSafeX = homeX;
    lastSafeY = homeY;
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
    jobId: randomUUID(),
    metadata: {
      estimatedCycleTimeSeconds,
      resolution: `${width}x${height}`,
      imageWidth: width,
      imageHeight: height,
      tuftSegments,
      activePixels,
    },
  };
}
