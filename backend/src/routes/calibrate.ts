import { Router } from 'express';
import { config } from '../config';
import { sendProgramToRobot } from '../services/robotClient';
import { getStepCoordinates } from '../services/jobStore';
import { getResumePosition } from '../services/progressStore';

const router = Router();

const COORDINATE_STRING = '    global tuft_coords = p[-0.743799, 1.270828, -0.183331, 1.574839, 0.004352, -0.002073]';
const POSE_STRING = '    global current_pose = p[0,0,0,-1.19353,1.19941,1.24224]';

const formatPoseForFrame = (x: number, y: number, z: number) =>
  `pose_trans(tuft_coords, p[${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}, 0, 0, 0])`;

router.post('/', async (req, res) => {
  const { jobId } = req.body ?? {};
  const safeZ = config.toolpath.safeHeightMm / 1000;
  const tuftZ = config.toolpath.tuftHeightMm / 1000; // add manual z-height for testing here
  const travelSpeed = (config.robot.travelSpeedMmPerSec / 1000).toFixed(4);

  const program = `def tuft_calibration_rise():\n` +
  `${COORDINATE_STRING}\n` +
  '    textmsg("Moving to safe height")\n' +
  '    current_pose = get_actual_tcp_pose()\n' +
  '    local_pose = pose_trans(pose_inv(tuft_coords), current_pose)\n' +
  `    target_pose = pose_trans(tuft_coords, p[local_pose[0], local_pose[1], ${safeZ}, 0, 0, 0])\n` +
  `    set_digital_out(${config.robot.toolOutput}, False)\n` +
  `    movel(p[target_pose[0], target_pose[1], target_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=0.8, v=${travelSpeed})\n` +
  '    textmsg("Safe height reached")\n' +
  '    textmsg("Moving to tuft height")\n' +
  '    current_pose = get_actual_tcp_pose()\n' +
  '    local_pose = pose_trans(pose_inv(tuft_coords), current_pose)\n' +
  `    target_pose = pose_trans(tuft_coords, p[local_pose[0], local_pose[1], ${tuftZ}, 0, 0, 0])\n` +
  `    set_digital_out(${config.robot.toolOutput}, False)\n` +
  `    movel(p[target_pose[0], target_pose[1], target_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=0.8, v=${travelSpeed})\n` +
  '    textmsg("tuft height reached")\n' +
  'end\n\n' + 'tuft_calibration_rise()';

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
