import { Router } from 'express';
import { ArduinoController } from '../controllers/arduino.controller';
import { ArduinoHardwareController } from '../controllers/arduino-hardware.controller';
import { ArduinoValidators } from '../validators/arduino.validators';
import { arduinoCompileRateLimit, generalArduinoRateLimit } from '../../../middleware/rate-limiter';
import { validationResult } from 'express-validator';
import { Request, Response, NextFunction } from 'express';
import { requireAuth } from '../../../middleware/auth';

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

const router: Router = Router();
const arduinoController = new ArduinoController();
const hardwareController = new ArduinoHardwareController();

// ========== PUBLIC ROUTES (NO AUTH REQUIRED) ==========

// Health check endpoint - must be accessible for monitoring
router.get('/health', (req, res) => {
  res.json({
    success: true,
    status: 'healthy',
    service: 'arduino-api',
    timestamp: new Date().toISOString()
  });
});

// ========== PROTECTED ROUTES (AUTH REQUIRED) ==========

// Apply authentication to ALL routes below this point
router.use(requireAuth);

// Apply general rate limiting to all authenticated routes
router.use(generalArduinoRateLimit.middleware());

// Board information
router.get('/boards', (req, res) => arduinoController.getBoards(req, res));

// Problem management
router.get(
  '/problems',
  ArduinoValidators.getProblems(),
  handleValidationErrors,
  (req: Request, res: Response) => arduinoController.getProblems(req, res)
);

router.get(
  '/problems/:problemId',
  ArduinoValidators.getProblem(),
  handleValidationErrors,
  (req: Request, res: Response) => arduinoController.getProblem(req, res)
);

// Compilation with stricter rate limiting
router.post(
  '/compile',
  arduinoCompileRateLimit.middleware(),
  ArduinoValidators.submitCompile(),
  handleValidationErrors,
  (req: Request, res: Response) => arduinoController.submitCompile(req, res)
);

// Job management
router.get(
  '/jobs/:submissionId',
  ArduinoValidators.getJobStatus(),
  handleValidationErrors,
  (req: Request, res: Response) => arduinoController.getJobStatus(req, res)
);

router.get(
  '/submissions',
  ArduinoValidators.getUserSubmissions(),
  handleValidationErrors,
  (req: Request, res: Response) => arduinoController.getUserSubmissions(req, res)
);

router.delete(
  '/jobs/:submissionId',
  ArduinoValidators.cancelJob(),
  handleValidationErrors,
  (req: Request, res: Response) => arduinoController.cancelJob(req, res)
);

// Test case validation
router.post(
  '/validate',
  (req, res) => arduinoController.validateSubmission(req, res)
);

// Hardware upload instructions
router.get(
  '/hardware/upload-guide',
  (req, res) => hardwareController.getUploadInstructions(req, res)
);

// Admin routes (require admin role)
router.get(
  '/admin/queue/stats',
  (req, res) => arduinoController.getQueueStats(req, res)
);

export default router;