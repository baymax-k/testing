import { Router, type Router as RouterType } from 'express';
import {
  listContests,
  getContest,
  joinContest,
  submitContestDsa,
  getContestMcqQuestions,
  submitContestMcq,
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

// Get MCQ questions for a joined contest
router.get('/:id/mcq', getContestMcqQuestions);

// Join contest
router.post('/join', joinContest);

// Submit DSA solution in contest
router.post('/submit-dsa', submitContestDsa);

// Submit MCQ answers in contest
router.post('/submit-mcq', submitContestMcq);

// Get contest leaderboard
router.get('/:id/leaderboard', getContestLeaderboard);

export default router;