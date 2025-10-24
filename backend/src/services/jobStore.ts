interface ProgressConfig {
  host: string;
  hostHeader: string;
  port: number;
  path: string;
}

export interface JobContext {
  jobId: string;
  movementCommands: string[];
  coordinateFrameVariable: string;
  progressConfig: ProgressConfig | null;
  movementCount: number;
  safeZ: number;
  travelSpeed: number;
  tuftSpeed: number;
  toolOutput: number;
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
  if (startIndex >= context.movementCommands.length) {
    return null;
  }

  const lines: string[] = [];
  lines.push('def tuft_resume_program():');
  lines.push(`    textmsg("Resuming tufting job ${jobId}")`);
  lines.push(`    set_digital_out(${context.toolOutput}, False)`);
  lines.push(`    global travel_speed = ${(context.travelSpeed).toFixed(4)}`);
  lines.push(`    global tuft_speed = ${(context.tuftSpeed).toFixed(4)}`);

  if (context.progressConfig) {
    lines.push(`    global progress_host = "${context.progressConfig.host}"`);
    lines.push(`    global progress_host_header = "${context.progressConfig.hostHeader}"`);
    lines.push(`    global progress_port = ${context.progressConfig.port}`);
    lines.push(`    global progress_path = "${context.progressConfig.path}"`);
    lines.push(`    global progress_total = ${context.movementCount}`);
    lines.push(`    global progress_current = ${startIndex}`);
    lines.push(`    global progress_job_id = "${jobId}"`);
    lines.push('    def report_progress():');
    lines.push('        progress_current = progress_current + 1');
    lines.push(
      '        local payload = "{\\"jobId\\":\\"" + progress_job_id + "\\",\\"current\\":" + to_str(progress_current) + ",\\"total\\":" + to_str(progress_total) + "}"',
    );
    lines.push('        local content_length = strlen(payload)');
    lines.push('        if socket_open(progress_host, progress_port):');
    lines.push('            socket_send_string("POST " + progress_path + " HTTP/1.1\\r\\n")');
    lines.push('            socket_send_string("Host: " + progress_host_header + "\\r\\n")');
    lines.push('            socket_send_string("Content-Type: application/json\\r\\n")');
    lines.push('            socket_send_string("Content-Length: " + to_str(content_length) + "\\r\\n\\r\\n")');
    lines.push('            socket_send_string(payload)');
    lines.push('            socket_close()');
    lines.push('        end');
    lines.push('    end');
  }

  for (let i = startIndex; i < context.movementCommands.length; i += 1) {
    const command = context.movementCommands[i];
    lines.push(command);
    if (context.progressConfig) {
      const indent = command.match(/^(\s*)/)?.[1] ?? '    ';
      lines.push(`${indent}report_progress()`);
    }
  }

  lines.push('    textmsg("Tuft resume finished")');
  lines.push('end');
  lines.push('tuft_resume_program()');

  return lines.join('\n');
}
