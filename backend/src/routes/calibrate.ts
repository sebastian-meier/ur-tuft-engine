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
  const calibrationRaise = config.robot.calibrationRaiseMm / 1000;
  const travelSpeed = (config.robot.travelSpeedMmPerSec / 1000).toFixed(4);
  let xMeters: number;
  let yMeters: number;

  if (typeof jobId === 'string' && jobId.trim().length > 0) {
    const resumePosition = Math.max(0, getResumePosition(jobId.trim()) - 1);
    const coordinates = getStepCoordinates(jobId.trim(), resumePosition);
    if (coordinates) {
      xMeters = coordinates.x;
      yMeters = coordinates.y;
    } else {
      xMeters = config.toolpath.workpieceBufferMm / 1000 +
        (config.toolpath.workpieceWidthMm - config.toolpath.workpieceBufferMm * 2) / 2000;
      yMeters = config.toolpath.workpieceBufferMm / 1000 +
        (config.toolpath.workpieceHeightMm - config.toolpath.workpieceBufferMm * 2) / 2000;
    }
  } else {
    xMeters = config.toolpath.workpieceBufferMm / 1000 +
      (config.toolpath.workpieceWidthMm - config.toolpath.workpieceBufferMm * 2) / 2000;
    yMeters = config.toolpath.workpieceBufferMm / 1000 +
      (config.toolpath.workpieceHeightMm - config.toolpath.workpieceBufferMm * 2) / 2000;
  }

  const targetPose = formatPoseForFrame(xMeters, yMeters, -0.02);

  const program = `def tuft_calibration_rise():\n${COORDINATE_STRING}\n${POSE_STRING}\n    textmsg("Starting calibration raise")\n    set_digital_out(${config.robot.toolOutput}, False)\n    new_pose = ${targetPose}\n    movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=0.8, v=${travelSpeed})\n    textmsg("Calibration raise finished")\nend\n\n` + 'tuft_calibration_rise()';

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
