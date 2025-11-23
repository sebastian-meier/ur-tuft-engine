import { Router } from 'express';
import { config } from '../config';
import { sendProgramToRobot } from '../services/robotClient';
import { getResumePosition, markJobPaused } from '../services/progressStore';
import { getLastRecordedCoordinates, getStepCoordinates } from '../services/jobStore';

const router = Router();

const COORDINATE_STRING = '    global tuft_coords = p[-0.743799, 1.270828, -0.183331, 1.574839, 0.004352, -0.002073]';
const POSE_STRING = '    global current_pose = p[0,0,0,-1.19353,1.19941,1.24224]';

const formatPoseForFrame = (x: number, y: number, z: number) =>
  `pose_trans(tuft_coords, p[${x.toFixed(4)}, ${y.toFixed(4)}, ${z.toFixed(4)}, 0, 0, 0])`;

router.post('/', async (req, res) => {
  const { jobId } = req.body ?? {};

  if (typeof jobId !== 'string' || jobId.trim().length === 0) {
    res.status(400).json({ error: 'jobId must be provided to pause the job.' });
    return;
  }

  const trimmedJobId = jobId.trim();
  markJobPaused(trimmedJobId);

  const resumePosition = Math.max(0, getResumePosition(trimmedJobId));
  const coordinates =
    getStepCoordinates(trimmedJobId, resumePosition) ??
    getStepCoordinates(trimmedJobId, Math.max(0, resumePosition - 1)) ??
    getLastRecordedCoordinates(trimmedJobId);

  if (!coordinates) {
    res.status(404).json({ error: 'Unable to determine the last movement position for the job.' });
    return;
  }

  const targetPose = formatPoseForFrame(coordinates.x, coordinates.y, config.toolpath.safeHeightMm / 1000);
  const safeZ = (config.toolpath.safeHeightMm / 1000).toFixed(4);
  const travelSpeed = (config.robot.travelSpeedMmPerSec / 1000).toFixed(4);
  const program = `def tuft_pause_program():\n${COORDINATE_STRING}\n${POSE_STRING}\n    textmsg("Pausing tufting job")\n    set_digital_out(${config.robot.toolOutput}, False)\n    new_pose = ${targetPose}\n    movel(p[new_pose[0], new_pose[1], new_pose[2], current_pose[3], current_pose[4], current_pose[5]], a=0.8, v=${travelSpeed})\n    textmsg("Pause routine complete")\nend\ntuft_pause_program()`;

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
