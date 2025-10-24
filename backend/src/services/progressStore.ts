export interface JobProgress {
  jobId: string;
  current: number;
  total: number;
  updatedAt: string;
}

const progressMap = new Map<string, JobProgress>();

export function recordProgress(jobId: string, current: number, total: number): JobProgress {
  const normalisedCurrent = Math.max(0, Math.min(current, total));
  const entry: JobProgress = {
    jobId,
    current: normalisedCurrent,
    total,
    updatedAt: new Date().toISOString(),
  };
  progressMap.set(jobId, entry);
  return entry;
}

export function getProgress(jobId: string): JobProgress | null {
  return progressMap.get(jobId) ?? null;
}
