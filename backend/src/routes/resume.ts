import { Router } from 'express';
import { config } from '../config';
import { getProgress, getResumePosition, resumeJob, overrideProgress } from '../services/progressStore';
import { getJobContext } from '../services/jobStore';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

router.post('/', async (req, res) => {
  const { jobId, targetStep } = req.body ?? {};

  if (typeof jobId !== 'string' || jobId.trim().length === 0) {
    res.status(400).json({ error: 'jobId must be provided as a non-empty string.' });
    return;
  }

  if (typeof targetStep !== 'number' || !Number.isFinite(targetStep)) {
    res.status(400).json({ error: 'targetStep must be provided as a finite number.' });
    return;
  }

  if (!getProgress(jobId)) {
    res.status(404).json({ error: 'Unable to resume unknown job.' });
    return;
  }

  const context = getJobContext(jobId);
  if (!context) {
    res.status(404).json({ error: 'Unable to locate job context for resume.' });
    return;
  }

  if (!context.programChunks || context.programChunks.length === 0) {
    res
      .status(400)
      .json({ error: 'No program chunks available for the requested job resume.', robotDelivery: { attempted: false, status: 'skipped' as const } });
    return;
  }

  // const maxProgress = context.movementCount;
  // const resumePosition = Math.max(0, Math.min(getResumePosition(jobId), maxProgress));
  const resumePosition =    Math.max(0, Math.min(Math.floor(targetStep), context.movementCount - 1));

  if (resumePosition >= context.movementCount) {
    res
      .status(200)
      .json({ robotDelivery: { attempted: false, status: 'skipped' as const }, resumePosition, program: null, chunkIndex: null });
    return;
  }

  const chunkIndex = context.programChunks.findIndex(
    (chunk) => resumePosition < chunk.progressStart + chunk.blockCount,
  );
  if (chunkIndex === -1) {
    res.status(400).json({ error: 'Unable to locate program chunk for resume position.' });
    return;
  }

  const chunk = context.programChunks[chunkIndex];
  const resolvedResumePosition = chunk.progressStart;
  const progressEntry = overrideProgress(jobId, resolvedResumePosition);

  const robotDelivery = {
    attempted: config.robot.enabled,
    status: 'skipped' as 'skipped' | 'delivered' | 'failed',
    error: undefined as string | undefined,
  };

  if (config.robot.enabled) {
    try {
      await sendProgramToRobot(chunk.program);
      robotDelivery.status = 'delivered';
      resumeJob(jobId);
    } catch (error) {
      robotDelivery.status = 'failed';
      robotDelivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  res.status(robotDelivery.status === 'failed' ? 202 : 200).json({
    robotDelivery,
    resumePosition: resolvedResumePosition,
    program: chunk.program,
    chunkIndex,
    progress: progressEntry,
  });
});

export default router;
