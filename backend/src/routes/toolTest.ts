import { randomUUID } from 'crypto';
import { Router } from 'express';
import { config } from '../config';
import { generateToolTestProgram } from '../services/urGenerator';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

/**
 * @openapi
 * /api/tool-test:
 *   post:
 *     summary: Move along the Z axis and toggle the tufting tool for diagnostic testing.
 *     tags:
 *       - Robot
 *     responses:
 *       '200':
 *         description: Tool test program generated and streaming succeeded or was skipped.
 *       '202':
 *         description: Program generated, but streaming to the robot failed.
 *       '500':
 *         description: Unexpected server-side error.
 */
router.post('/', async (_req, res, next) => {
  try {
    const { program, metadata } = generateToolTestProgram({
      toolOutput: config.robot.toolOutput,
      travelSpeedMmPerSec: config.robot.travelSpeedMmPerSec,
    });

    const jobId = randomUUID();
    const robotDelivery = {
      attempted: config.robot.enabled,
      status: 'skipped' as 'skipped' | 'delivered' | 'failed',
      error: undefined as string | undefined,
    };

    if (config.robot.enabled) {
      try {
        await sendProgramToRobot(program);
        robotDelivery.status = 'delivered';
      } catch (robotError) {
        robotDelivery.status = 'failed';
        robotDelivery.error = robotError instanceof Error ? robotError.message : 'Unknown error';
      }
    }

    res.status(robotDelivery.status === 'failed' ? 202 : 200).json({
      jobId,
      metadata,
      program,
      robotDelivery,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
