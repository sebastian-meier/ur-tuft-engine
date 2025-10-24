import { Router } from 'express';
import { config } from '../config';
import { getJobContext } from '../services/jobStore';
import { overrideProgress } from '../services/progressStore';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

router.post('/', async (req, res) => {
  const { jobId } = req.body ?? {};

  if (typeof jobId !== 'string' || jobId.trim().length === 0) {
    res.status(400).json({ error: 'jobId must be provided as a non-empty string.' });
    return;
  }

  const context = getJobContext(jobId.trim());
  if (!context) {
    res.status(404).json({ error: 'Unknown job id. Generate a program before starting.' });
    return;
  }

  const robotDelivery = {
    attempted: config.robot.enabled,
    status: 'skipped' as 'skipped' | 'delivered' | 'failed',
    error: undefined as string | undefined,
  };

  if (config.robot.enabled) {
    try {
      await sendProgramToRobot(context.program);
      robotDelivery.status = 'delivered';
    } catch (error) {
      robotDelivery.status = 'failed';
      robotDelivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  if (robotDelivery.status !== 'failed') {
    overrideProgress(jobId.trim(), 0);
  }

  res.status(robotDelivery.status === 'failed' ? 202 : 200).json({ robotDelivery, program: context.program });
});

export default router;
