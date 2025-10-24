import { Router } from 'express';
import { getProgress, getResumePosition, recordProgress } from '../services/progressStore';

const router = Router();

router.post('/', (req, res) => {
  const { jobId, current, total } = req.body ?? {};

  if (typeof jobId !== 'string' || jobId.trim().length === 0) {
    res.status(400).json({ error: 'jobId must be provided as a non-empty string.' });
    return;
  }

  if (typeof current !== 'number' || !Number.isFinite(current) || typeof total !== 'number' || !Number.isFinite(total)) {
    res.status(400).json({ error: 'current and total must be finite numbers.' });
    return;
  }

  if (total < 0) {
    res.status(400).json({ error: 'total must be zero or greater.' });
    return;
  }

  const entry = recordProgress(jobId.trim(), current, total);
  res.status(200).json(entry);
});

router.get('/:jobId', (req, res) => {
  const { jobId } = req.params;
  const entry = getProgress(jobId);

  if (!entry) {
    res.status(404).json({ error: 'Progress not found for job.' });
    return;
  }

  res.json(entry);
});

router.get('/:jobId/resume-position', (req, res) => {
  const { jobId } = req.params;
  const position = getResumePosition(jobId);
  res.json({ jobId, position });
});

export default router;
