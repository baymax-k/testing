import { body, param, query, ValidationChain } from 'express-validator';

// CUID validation helper (Prisma default ID format)
const isCUID = (value: string): boolean => {
  return typeof value === 'string' && /^c[a-z0-9]{24,}$/.test(value);
};

export class ArduinoValidators {
  static submitCompile(): ValidationChain[] {
    return [
      body('problemId')
        .isString()
        .matches(/^[a-z0-9-]+$/)
        .withMessage('Problem ID must be a valid CUID or slug'),
      
      body('code')
        .isString()
        .isLength({ min: 1, max: 50000 })
        .withMessage('Code must be a string between 1 and 50,000 characters'),
      
      body('boardType')
        .optional()
        .isIn(['uno', 'mega'])
        .withMessage('Board type must be either "uno" or "mega"'),
    ];
  }

  static getJobStatus(): ValidationChain[] {
    return [
      param('submissionId')
        .isString()
        .custom(isCUID)
        .withMessage('Submission ID must be a valid CUID'),
    ];
  }

  static getUserSubmissions(): ValidationChain[] {
    return [
      query('problemId')
        .optional()
        .isString()
        .matches(/^[a-z0-9-]+$/)
        .withMessage('Problem ID must be a valid CUID or slug if provided'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a non-negative integer'),
    ];
  }

  static cancelJob(): ValidationChain[] {
    return [
      param('submissionId')
        .isString()
        .custom(isCUID)
        .withMessage('Submission ID must be a valid CUID'),
    ];
  }

  static getProblems(): ValidationChain[] {
    return [
      query('difficulty')
        .optional()
        .isIn(['easy', 'medium', 'hard'])
        .withMessage('Difficulty must be easy, medium, or hard'),
      
      query('limit')
        .optional()
        .isInt({ min: 1, max: 100 })
        .withMessage('Limit must be between 1 and 100'),
      
      query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('Offset must be a non-negative integer'),
    ];
  }

  static getProblem(): ValidationChain[] {
    return [
      param('problemId')
        .isString()
        .matches(/^[a-z0-9-]+$/)
        .withMessage('Problem ID must be a valid CUID or slug'),
    ];
  }
}