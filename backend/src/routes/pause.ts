import { Router } from 'express';
import { config } from '../config';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

router.post('/', async (_req, res) => {
  const safeZ = (config.toolpath.safeHeightMm / 1000).toFixed(4);
  const travelSpeed = (config.robot.travelSpeedMmPerSec / 1000).toFixed(4);
  const program = `def tuft_pause_program():\n    textmsg("Pausing tufting job")\n    set_digital_out(${config.robot.toolOutput}, False)\n    local current_pose = get_actual_tcp_pose()\n    local target_pose = current_pose\n    target_pose[2] = ${safeZ}\n    movel(target_pose, a=0.8, v=${travelSpeed})\n    textmsg("Pause routine complete")\nend\ntuft_pause_program()`;

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
