import { Router } from 'express';
import { config } from '../config';
import { sendProgramToRobot } from '../services/robotClient';

const router = Router();

const COORDINATE_STRING = '    global tuft_coords = p[-0.743799, 1.270828, -0.183331, 1.574839, 0.004352, -0.002073]';

router.post('/', async (_req, res) => {
  const safeZ = (config.toolpath.safeHeightMm / 1000).toFixed(4);
  const travelSpeed = (config.robot.travelSpeedMmPerSec / 1000).toFixed(4);

  const program =
    `def tuft_raise_to_safe_height():\n` +
    `${COORDINATE_STRING}\n` +
    '    textmsg("Moving to safe height")\n' +
    '    current_pose = get_actual_tcp_pose()\n' +
    '    local_pose = pose_trans(pose_inv(tuft_coords), current_pose)\n' +
    `    target_pose = pose_trans(tuft_coords, p[local_pose[0], local_pose[1], ${safeZ}, 0, 0, 0])\n` +
    `    set_digital_out(${config.robot.toolOutput}, False)\n` +
    `    movel(p[target_pose[0], target_pose[1], target_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=0.8, v=${travelSpeed})\n` +
    '    textmsg("Safe height reached")\n' +
    'end\n\n' +
    'tuft_raise_to_safe_height()';

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
