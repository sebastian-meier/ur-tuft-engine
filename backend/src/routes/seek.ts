import { Router } from 'express';
import { config } from '../config';
import { getJobContext } from '../services/jobStore';
import { overrideProgress } from '../services/progressStore';
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

  const context = getJobContext(jobId);
  if (!context) {
    res.status(404).json({ error: 'Unable to locate job context.' });
    return;
  }

  if (!context.programChunks || context.programChunks.length === 0) {
    res.status(400).json({ error: 'No program chunks available for the requested job.' });
    return;
  }

  const clampedStep = Math.max(0, Math.min(Math.floor(targetStep), context.movementCount - 1));
  const chunkIndex = context.programChunks.findIndex(
    (chunk) => clampedStep >= chunk.startIndex && clampedStep < chunk.endIndex,
  );

  if (chunkIndex === -1) {
    res.status(400).json({ error: 'Unable to locate program chunk for requested step.' });
    return;
  }

  const chunk = context.programChunks[chunkIndex];
  const resolvedStep = chunk.startIndex;

  const robotDelivery = {
    attempted: config.robot.enabled,
    status: 'skipped' as 'skipped' | 'delivered' | 'failed',
    error: undefined as string | undefined,
  };

  if (config.robot.enabled) {
    try {
      await sendProgramToRobot(chunk.program);
      robotDelivery.status = 'delivered';
    } catch (error) {
      robotDelivery.status = 'failed';
      robotDelivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Override progress to the chosen step so subsequent resumes start there.
  const progressEntry = overrideProgress(jobId, resolvedStep);

  res
    .status(robotDelivery.status === 'failed' ? 202 : 200)
    .json({
      robotDelivery,
      program: chunk.program,
      progress: progressEntry,
      chunkIndex,
      targetStep: clampedStep,
      resolvedStep,
    });
});

export default router;
