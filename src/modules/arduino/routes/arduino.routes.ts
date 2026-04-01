import { Router } from 'express';
import { ArduinoController } from '../controllers/arduino.controller';
import { ArduinoValidators } from '../validators/arduino.validators';
import { arduinoCompileRateLimit, generalArduinoRateLimit } from '../../../middleware/rate-limiter';
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';

// Validation middleware
const handleValidationErrors = (req: Request, res: Response, next: NextFunction): void => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
    return;
  }
  next();
};

// Authentication middleware placeholder (should be imported from your auth system)
const requireAuth = (req: Request, res: Response, next: NextFunction): void => {
  // TODO: Replace with your actual authentication middleware
  // For now, this is a placeholder that should be replaced with your existing auth system
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: 'Authentication token required'
    });
    return;
  }

  // Mock user for now - replace with actual token verification
  (req as any).user = {
    id: 'mock-user-id',
    role: 'student' // or 'admin', 'superadmin'
  };
  
  next();
};

const router = Router();
const arduinoController = new ArduinoController();

// Apply general rate limiting to all Arduino routes
router.use(generalArduinoRateLimit.middleware());

// Public routes (no auth required)
router.get(
  '/problems',
  ArduinoValidators.getProblems(),
  handleValidationErrors,
  (req, res) => arduinoController.getProblems(req, res)
);

router.get(
  '/problems/:problemId',
  ArduinoValidators.getProblem(),
  handleValidationErrors,
  (req, res) => arduinoController.getProblem(req, res)
);

// Protected routes (auth required)
router.use(requireAuth);

// Compilation routes with stricter rate limiting
router.post(
  '/compile',
  arduinoCompileRateLimit.middleware(),
  ArduinoValidators.submitCompile(),
  handleValidationErrors,
  (req, res) => arduinoController.submitCompile(req, res)
);

// Job management routes
router.get(
  '/jobs/:submissionId',
  ArduinoValidators.getJobStatus(),
  handleValidationErrors,
  (req, res) => arduinoController.getJobStatus(req, res)
);

router.get(
  '/submissions',
  ArduinoValidators.getUserSubmissions(),
  handleValidationErrors,
  (req, res) => arduinoController.getUserSubmissions(req, res)
);

router.delete(
  '/jobs/:submissionId',
  ArduinoValidators.cancelJob(),
  handleValidationErrors,
  (req, res) => arduinoController.cancelJob(req, res)
);

// Admin routes
router.get(
  '/admin/queue/stats',
  (req, res) => arduinoController.getQueueStats(req, res)
);

export default router;