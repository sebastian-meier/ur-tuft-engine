import { Router } from 'express';
import { config } from '../config';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

/**
 * @openapi
 * /api/tool-stop:
 *   post:
 *     summary: Deactivate the tufting gun by forcing the configured digital output low.
 *     tags:
 *       - Robot
 *     responses:
 *       '200':
 *         description: Tufting gun stop command transmitted or skipped successfully.
 *       '202':
 *         description: Stop command generated, but streaming to the robot failed.
 *       '500':
 *         description: Unexpected server-side error.
 */
router.post('/', async (_req, res, next) => {
  try {
    const program =
      `def tuft_tool_stop_program():\n` +
      `    textmsg("Stopping tufting gun")\n` +
      `    set_digital_out(${config.robot.toolOutput}, False)\n` +
      `    textmsg("Tufting gun deactivated")\n` +
      `end\n` +
      `tuft_tool_stop_program()`;

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

    res.status(robotDelivery.status === 'failed' ? 202 : 200).json({ robotDelivery, program });
  } catch (error) {
    next(error);
  }
});

export default router;
