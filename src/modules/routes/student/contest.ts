import { Router, type Router as RouterType } from 'express';
import {
  listContests,
  getContest,
  joinContest,
  submitContestDsa,
  getContestLeaderboard,
} from '../../controllers/contest.controller.js';
import { requireAuth } from '../../../middleware/auth.js';

const router: RouterType = Router();

// All contest routes require authentication
router.use(requireAuth);

// List contests with pagination and filters
router.get('/', listContests);

// Get contest details (only if joined and active)
router.get('/:id', getContest);

// Join contest
router.post('/join', joinContest);

// Submit DSA solution in contest
router.post('/submit-dsa', submitContestDsa);

// Get contest leaderboard
router.get('/:id/leaderboard', getContestLeaderboard);

export default router;