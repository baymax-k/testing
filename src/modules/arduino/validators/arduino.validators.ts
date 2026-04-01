import { body, param, query, ValidationChain } from 'express-validator';

export class ArduinoValidators {
  static submitCompile(): ValidationChain[] {
    return [
      body('problemId')
        .isUUID()
        .withMessage('Problem ID must be a valid UUID'),
      
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
        .isUUID()
        .withMessage('Submission ID must be a valid UUID'),
    ];
  }

  static getUserSubmissions(): ValidationChain[] {
    return [
      query('problemId')
        .optional()
        .isUUID()
        .withMessage('Problem ID must be a valid UUID if provided'),
      
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
        .isUUID()
        .withMessage('Submission ID must be a valid UUID'),
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
        .isUUID()
        .withMessage('Problem ID must be a valid UUID'),
    ];
  }
}