import { Router } from 'express';
import { config } from '../config';
import { getProgress, getResumePosition, resumeJob } from '../services/progressStore';
import { getJobContext, buildResumeProgram } from '../services/jobStore';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

router.post('/', async (req, res) => {
  const { jobId } = req.body ?? {};

  if (typeof jobId !== 'string' || jobId.trim().length === 0) {
    res.status(400).json({ error: 'jobId must be provided as a non-empty string.' });
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

  const resumePosition = getResumePosition(jobId);
  const program = buildResumeProgram(jobId, context, resumePosition);

  if (!program) {
    res.status(200).json({ robotDelivery: { attempted: false, status: 'skipped' as const }, resumePosition });
    return;
  }

  const robotDelivery = {
    attempted: config.robot.enabled,
    status: 'skipped' as 'skipped' | 'delivered' | 'failed',
    error: undefined as string | undefined,
  };

  if (config.robot.enabled) {
    try {
      await sendProgramToRobot(program);
      robotDelivery.status = 'delivered';
      resumeJob(jobId);
    } catch (error) {
      robotDelivery.status = 'failed';
      robotDelivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  res.status(robotDelivery.status === 'failed' ? 202 : 200).json({ robotDelivery, resumePosition });
});

export default router;
