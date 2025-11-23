import { Router } from 'express';
import { config } from '../config';
import { buildSeekProgram, getJobContext } from '../services/jobStore';
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

  const clampedStep = Math.max(0, Math.min(Math.floor(targetStep), context.movementCount - 1));

  const seekProgram = buildSeekProgram(jobId, context, clampedStep);
  if (!seekProgram) {
    res.status(400).json({ error: 'Unable to build seek program for requested step.' });
    return;
  }

  const robotDelivery = {
    attempted: config.robot.enabled,
    status: 'skipped' as 'skipped' | 'delivered' | 'failed',
    error: undefined as string | undefined,
  };

  if (config.robot.enabled) {
    try {
      await sendProgramToRobot(seekProgram);
      robotDelivery.status = 'delivered';
    } catch (error) {
      robotDelivery.status = 'failed';
      robotDelivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  // Override progress to the chosen step so subsequent resumes start there.
  const progressEntry = overrideProgress(jobId, clampedStep);

  res
    .status(robotDelivery.status === 'failed' ? 202 : 200)
    .json({
      robotDelivery,
      program: seekProgram,
      progress: progressEntry,
      targetStep: clampedStep,
    });
});

export default router;
