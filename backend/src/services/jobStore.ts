import type { ProgramChunk } from './urGenerator';

interface ProgressConfig {
  host: string;
  port: number;
}

export interface JobContext {
  jobId: string;
  movementBlocks: string[][];
  coordinateFrameVariable: string;
  progressConfig: ProgressConfig | null;
  movementCount: number;
  movelCommandCount: number;
  safeZ: number;
  travelSpeed: number;
  tuftSpeed: number;
  toolOutput: number;
  coordinateString: string;
  poseString: string;
  programChunks: ProgramChunk[];
}

const jobContexts = new Map<string, JobContext>();

export function saveJobContext(jobId: string, context: JobContext): void {
  jobContexts.set(jobId, context);
}

export function getJobContext(jobId: string): JobContext | undefined {
  return jobContexts.get(jobId);
}

export function deleteJobContext(jobId: string): void {
  jobContexts.delete(jobId);
}

export function buildResumeProgram(
  jobId: string,
  context: JobContext,
  startIndex: number,
): string | null {
  if (startIndex >= context.movementBlocks.length) {
    return null;
  }

  const lines: string[] = [];
  lines.push('def tuft_resume_program():');
  lines.push(context.coordinateString);
  lines.push(context.poseString);
  lines.push(`    textmsg("Resuming tufting job ${jobId}")`);
  lines.push(`    set_digital_out(${context.toolOutput}, False)`);
  lines.push(`    global travel_speed = ${(context.travelSpeed).toFixed(4)}`);
  lines.push(`    global tuft_speed = ${(context.tuftSpeed).toFixed(4)}`);

  if (context.progressConfig) {
    lines.push(`    global progress_host = "${context.progressConfig.host}"`);
    lines.push(`    global progress_port = ${context.progressConfig.port}`);
    lines.push(`    global progress_total = ${context.movementCount}`);
    lines.push(`    global progress_current = ${startIndex}`);
    lines.push(`    global progress_job_id = "${jobId}"`);
    lines.push(`    global open=socket_open(progress_host,progress_port)`);
    lines.push(`    while (open ==  False  ):`);
    lines.push(`        global open=socket_open(progress_host,progress_port)`);
    lines.push(`    end`);
    lines.push(`    def report_progress():`);
    lines.push(`        progress_current = progress_current + 1`);
    lines.push(`        global sendToServer="{jobId:" + progress_job_id + ",current:" + to_str(progress_current) + ",total:" + to_str(progress_total) + "}\n"`);
    lines.push(`        socket_send_string(sendToServer)`);
    lines.push(`    end`);
  }

  for (let i = startIndex; i < context.movementBlocks.length; i += 1) {
    const block = context.movementBlocks[i];
    for (const line of block) {
      lines.push(line);
    }
    if (context.progressConfig) {
      const indent = block[block.length - 1].match(/^(\s*)/)?.[1] ?? '    ';
      lines.push(`${indent}report_progress()`);
    }
  }

  lines.push('    textmsg("Tuft resume finished")');
  lines.push('end');
  lines.push('tuft_resume_program()');

  return lines.join('\n');
}

export function buildSeekProgram(
  jobId: string,
  context: JobContext,
  stepIndex: number,
): string | null {
  if (stepIndex < 0 || stepIndex >= context.movementBlocks.length) {
    return null;
  }

  const chunkIndex = context.programChunks.findIndex(
    (chunk) => stepIndex < chunk.progressStart + chunk.blockCount,
  );

  const block = context.movementBlocks[stepIndex];
  if (!block || block.length === 0) {
    return null;
  }

  const lines: string[] = [];
  lines.push('def tuft_seek_program():');
  lines.push(context.coordinateString);
  lines.push(context.poseString);
  lines.push(`    textmsg("Seeking to step ${stepIndex} of job ${jobId}")`);
  lines.push(`    set_digital_out(${context.toolOutput}, False)`);
  if (context.progressConfig) {
    lines.push(`    global progress_host = "${context.progressConfig.host}"`);
    lines.push(`    global progress_port = ${context.progressConfig.port}`);
    lines.push(`    global progress_total = ${context.movementCount}`);
    lines.push(`    global progress_current = ${stepIndex}`);
    lines.push(`    global progress_job_id = "${jobId}"`);
  }
  for (const line of block) {
    if (line.indexOf("set_digital_out") == -1) {
      lines.push(
        line.replace(
          /(pose_trans\([^,]+,\s*p\[\s*-?\d*\.?\d+,\s*-?\d*\.?\d+,\s*)(-?\d*\.?\d+)(\s*,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+,\s*-?\d*\.?\d+\s*\]\))/,
          `$1${context.safeZ.toFixed(4)}$3`,
        ),
      );
    }
  }
  lines.push('    textmsg("Seek movement finished")');
  lines.push('end');
  lines.push('tuft_seek_program()');

  return lines.join('\n');
}

const POSE_TRANS_REGEX = /pose_trans\([^,]+,\s*p\[\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+),\s*(-?\d*\.?\d+)/;

const extractCoordinates = (block: string[]): { x: number; y: number; z: number } | null => {
  const poseLine = block.find((line) => line.includes('pose_trans('));
  if (!poseLine) {
    return null;
  }
  const match = poseLine.match(POSE_TRANS_REGEX);
  if (!match) {
    return null;
  }
  const [, x, y, z] = match;
  return {
    x: Number.parseFloat(x),
    y: Number.parseFloat(y),
    z: Number.parseFloat(z),
  };
};

export function getStepCoordinates(jobId: string, stepIndex: number): { x: number; y: number; z: number } | null {
  const context = jobContexts.get(jobId);
  if (!context) {
    return null;
  }
  if (stepIndex < 0 || stepIndex >= context.movementBlocks.length) {
    return null;
  }
  return extractCoordinates(context.movementBlocks[stepIndex]);
}

export function getLastRecordedCoordinates(jobId: string): { x: number; y: number; z: number } | null {
  const context = jobContexts.get(jobId);
  if (!context || context.movementBlocks.length === 0) {
    return null;
  }
  return extractCoordinates(context.movementBlocks[context.movementBlocks.length - 1]);
}
