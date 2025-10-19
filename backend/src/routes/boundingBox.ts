import { randomUUID } from 'crypto';
import { Router } from 'express';
import { config } from '../config';
import { BoundingBoxMm, generateBoundingBoxRoutine } from '../services/urGenerator';
import { sendProgramToRobot } from '../services/robotClient';

interface BoundingBoxRequestBody extends Partial<BoundingBoxMm> {
  coordinateFrameVariable?: string;
}

const isFiniteNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

const router = Router();

/**
 * @openapi
 * /api/bounding-box:
 *   post:
 *     summary: Traverse the four corners of the provided tufting bounding box.
 *     tags:
 *       - Robot
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               minX:
 *                 type: number
 *                 description: Minimum X corner in millimetres.
 *               maxX:
 *                 type: number
 *                 description: Maximum X corner in millimetres.
 *               minY:
 *                 type: number
 *                 description: Minimum Y corner in millimetres.
 *               maxY:
 *                 type: number
 *                 description: Maximum Y corner in millimetres.
 *               coordinateFrameVariable:
 *                 type: string
 *                 description: Optional override for the coordinate frame variable (defaults to `tuftCoord`).
 *     responses:
 *       '200':
 *         description: Bounding box routine generated and streaming succeeded or was skipped.
 *       '202':
 *         description: Program generated, but streaming to the robot failed.
 *       '400':
 *         description: Invalid bounding box coordinates supplied.
 *       '500':
 *         description: Unexpected server-side error.
 */
router.post('/', async (req, res, next) => {
  try {
    const { minX, maxX, minY, maxY, coordinateFrameVariable } = req.body as BoundingBoxRequestBody;

    if (![minX, maxX, minY, maxY].every(isFiniteNumber) || minX! >= maxX! || minY! >= maxY!) {
      res
        .status(400)
        .json({ error: 'Bounding box must provide finite numeric min/max coordinates with min < max for each axis.' });
      return;
    }

    const boundingBox: BoundingBoxMm = {
      minX: minX!,
      maxX: maxX!,
      minY: minY!,
      maxY: maxY!,
    };

    const { program, metadata } = generateBoundingBoxRoutine(boundingBox, {
      safeHeightMm: config.toolpath.safeHeightMm,
      travelSpeedMmPerSec: config.robot.travelSpeedMmPerSec,
      coordinateFrameVariable,
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
