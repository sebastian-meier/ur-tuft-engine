import { Router } from 'express';
import { config } from '../config';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

router.post('/', async (_req, res) => {
  const { workpieceWidthMm, workpieceHeightMm, safeHeightMm, workpieceBufferMm } = config.toolpath;
  const centerX = (workpieceBufferMm + (workpieceWidthMm - workpieceBufferMm * 2) / 2) / 1000;
  const centerY = (workpieceBufferMm + (workpieceHeightMm - workpieceBufferMm * 2) / 2) / 1000;
  const safeZ = (safeHeightMm / 1000).toFixed(4);
  const travelSpeed = (config.robot.travelSpeedMmPerSec / 1000).toFixed(4);

  const program = `def tuft_home_center():\n    textmsg("Returning to buffered center")\n    set_digital_out(${config.robot.toolOutput}, False)\n    local current_pose = get_actual_tcp_pose()\n    local target_pose = p[${centerX.toFixed(4)}, ${centerY.toFixed(4)}, ${safeZ}, current_pose[3], current_pose[4], current_pose[5]]\n    movel(target_pose, a=0.8, v=${travelSpeed})\n    textmsg("Buffered center reached")\nend\n\n` + 'tuft_home_center()';

  const robotDelivery = {
    attempted: config.robot.enabled,
    status: 'skipped' as 'skipped' | 'delivered' | 'failed',
    error: undefined as string | undefined,
  };

  if (config.robot.enabled) {
    try {
      await sendProgramToRobot(program);
      robotDelivery.status = 'delivered';
    } catch (error) {
      robotDelivery.status = 'failed';
      robotDelivery.error = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  res.status(robotDelivery.status === 'failed' ? 202 : 200).json({ robotDelivery, program });
});

export default router;
