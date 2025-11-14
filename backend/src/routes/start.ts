import { Router } from 'express';
import { config } from '../config';
import { getJobContext } from '../services/jobStore';
import { overrideProgress } from '../services/progressStore';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

router.post('/', async (req, res) => {
  const { jobId, chunkIndex } = req.body ?? {};

  if (typeof jobId !== 'string' || jobId.trim().length === 0) {
    res.status(400).json({ error: 'jobId must be provided as a non-empty string.' });
    return;
  }

  const context = getJobContext(jobId.trim());
  if (!context) {
    res.status(404).json({ error: 'Unknown job id. Generate a program before starting.' });
    return;
  }

  if (!context.programChunks || context.programChunks.length === 0) {
    res.status(400).json({ error: 'No program chunks available for the requested job.' });
    return;
  }

  const resolvedChunkIndex =
    typeof chunkIndex === 'number' && Number.isFinite(chunkIndex)
      ? Math.floor(chunkIndex)
      : 0;

  if (resolvedChunkIndex < 0 || resolvedChunkIndex >= context.programChunks.length) {
    res.status(400).json({ error: 'chunkIndex must reference an available program chunk.' });
    return;
  }

  const chunk = context.programChunks[resolvedChunkIndex];

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

  if (robotDelivery.status !== 'failed') {
    overrideProgress(jobId.trim(), chunk.progressStart);
  }

  res
    .status(robotDelivery.status === 'failed' ? 202 : 200)
    .json({ robotDelivery, program: chunk.program, chunkIndex: resolvedChunkIndex, totalChunks: context.programChunks.length });
});

export default router;
