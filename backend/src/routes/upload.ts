/**
 * Express router exposing image upload endpoints. Handles decoding multipart payloads, delegating to
 * the UR program generator, and optionally streaming the output to a robot.
 */
import { Router } from 'express';
import multer from 'multer';
import { generateURProgram } from '../services/urGenerator';
import { sendProgramToRobot } from '../services/robotClient';
import { config } from '../config';

/** Multer instance that buffers uploads in memory for further processing. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024, // 10MB upload limit
  },
});

const router = Router();

/**
 * @openapi
 * /api/images:
 *   post:
 *     summary: Generate a UR program from an uploaded greyscale artwork.
 *     tags:
 *       - Images
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Single-channel or RGB image that will be converted to a tufting program.
 *     responses:
 *       '200':
 *         description: UR program generated and robot delivery succeeded or was skipped.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 jobId:
 *                   type: string
 *                 metadata:
 *                   type: object
 *                 program:
 *                   type: string
 *                 robotDelivery:
 *                   type: object
 *       '202':
 *         description: UR program generated, but streaming to the robot failed.
 *       '400':
 *         description: No file was provided in the `image` field.
 *       '500':
 *         description: Unexpected server-side error.
 */
router.post('/', upload.single('image'), async (req, res, next) => {
  if (!req.file) {
    res.status(400).json({ error: 'No image file provided under field "image".' });
    return;
  }

  try {
    const { jobId, metadata, program } = await generateURProgram(req.file.buffer, req.file.originalname, {
      workpieceWidthMm: config.toolpath.workpieceWidthMm,
      workpieceHeightMm: config.toolpath.workpieceHeightMm,
      workpieceBufferMm: config.toolpath.workpieceBufferMm,
      safeHeightMm: config.toolpath.safeHeightMm,
      tuftHeightMm: config.toolpath.tuftHeightMm,
      blackPixelThreshold: config.toolpath.blackPixelThreshold,
      toolOutput: config.robot.toolOutput,
      travelSpeedMmPerSec: config.robot.travelSpeedMmPerSec,
      tuftSpeedMmPerSec: config.robot.tuftSpeedMmPerSec,
      contactForceThresholdN: config.robot.contactForceThresholdN,
      progressCallbackUrl: config.robot.progressCallbackUrl,
    });

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
