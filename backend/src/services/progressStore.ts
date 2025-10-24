export interface JobProgress {
  jobId: string;
  current: number;
  total: number;
  updatedAt: string;
}

interface JobProgressDetail extends JobProgress {
  lastScriptPosition: number;
  paused: boolean;
}

const progressMap = new Map<string, JobProgressDetail>();

export function getResumePosition(jobId: string): number {
  return progressMap.get(jobId)?.lastScriptPosition ?? 0;
}

export function recordProgress(jobId: string, current: number, total: number): JobProgress {
  const normalisedCurrent = Math.max(0, Math.min(current, total));
  const entry: JobProgressDetail = {
    jobId,
    current: normalisedCurrent,
    total,
    updatedAt: new Date().toISOString(),
    lastScriptPosition: normalisedCurrent,
    paused: false,
  };
  progressMap.set(jobId, entry);
  return entry;
}

export function getProgress(jobId: string): JobProgress | null {
  const entry = progressMap.get(jobId);
  if (!entry) {
    return null;
  }
  const { paused, lastScriptPosition, ...rest } = entry;
  return rest;
}

export function markJobPaused(jobId: string): void {
  const entry = progressMap.get(jobId);
  if (!entry) {
    return;
  }
  progressMap.set(jobId, { ...entry, paused: true, lastScriptPosition: entry.current });
}

export function resumeJob(jobId: string): void {
  const entry = progressMap.get(jobId);
  if (!entry) {
    return;
  }
  progressMap.set(jobId, { ...entry, paused: false });
}

export function overrideProgress(jobId: string, current: number): JobProgress | null {
  const entry = progressMap.get(jobId);
  if (!entry) {
    return null;
  }
  const normalisedCurrent = Math.max(0, Math.min(current, entry.total));
  const updated: JobProgressDetail = {
    ...entry,
    current: normalisedCurrent,
    lastScriptPosition: normalisedCurrent,
    updatedAt: new Date().toISOString(),
  };
  progressMap.set(jobId, updated);
  const { paused, lastScriptPosition, ...rest } = updated;
  return rest;
}
