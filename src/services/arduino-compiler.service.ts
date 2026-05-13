import axios, { AxiosResponse } from 'axios';

interface ArduinoTestCase {
  id: string;
  label: string;
  type: 'pin_state' | 'serial_output' | 'toggle_count' | 'timing';
  pin?: number;
  expectedState?: 'HIGH' | 'LOW' | 'TOGGLE' | 'PWM';
  atMs?: number;
  toleranceMs?: number;
  minToggles?: number;
  withinMs?: number;
  expectedOutput?: string;
  order: number;
  isHidden: boolean;
}

interface TestResult {
  testCaseId: string;
  passed: boolean;
  actualValue?: string | number;
  expectedValue?: string | number;
  error?: string;
}

interface CompileResponse {
  success: boolean;
  hexFile?: string;
  compileTimeMs: number;
  fqbn?: string;
  sketchName?: string;
  errors?: string[];
  warnings?: string[];
  error?: string;
}

interface SimulateResponse {
  success: boolean;
  results: TestResult[];
  allTestsPassed: boolean;
  simulationTimeMs: number;
  output?: string;
  error?: string;
}

interface Board {
  id: string;
  name: string;
  fqbn: string;
}

interface CodePatterns {
  digitalWrites: string[];
  serialOutputs: string[];
  delays: string[];
  pinModes: string[];
}

interface EducationalFeedback {
  score: number;
  strengths: string[];
  suggestions: string[];
}

interface BoardSpecs {
  flashMemory: number;
  sram: number;
  digitalPins: number;
  analogPins: number;
}

const BOARD_SPECS: Record<string, BoardSpecs> = {
  uno: { flashMemory: 32768, sram: 2048, digitalPins: 14, analogPins: 6 },
  nano: { flashMemory: 32768, sram: 2048, digitalPins: 14, analogPins: 8 },
  mega: { flashMemory: 262144, sram: 8192, digitalPins: 54, analogPins: 16 },
  leonardo: { flashMemory: 28672, sram: 2560, digitalPins: 20, analogPins: 12 },
};

interface BoardsResponse {
  success: boolean;
  boards: Board[];
  error?: string;
}

class ArduinoCompilerService {
  private baseUrl: string;
  private timeout: number;

  constructor() {
    // Get Arduino compiler service URL from environment or default
    this.baseUrl = process.env.ARDUINO_COMPILER_URL || 'http://localhost:3001';
    this.timeout = parseInt(process.env.ARDUINO_COMPILER_TIMEOUT || '30000');
  }

  /**
   * Check if Arduino compiler service is healthy
   */
  async healthCheck(): Promise<{ status: string; version: string } | null> {
    try {
      const response: AxiosResponse = await axios.get(`${this.baseUrl}/health`, {
        timeout: 5000
      });
      return response.data;
    } catch (error) {
      console.error('Arduino compiler health check failed:', error);
      return null;
    }
  }

  analyzeCodePatterns(code: string): CodePatterns {
    const normalized = code.replace(/\s+/g, ' ');
    return {
      digitalWrites: normalized.match(/digitalWrite\s*\(\s*[^)]+\)/gi) || [],
      serialOutputs: normalized.match(/Serial\.(?:print|println)\s*\(\s*[^)]+\)/gi) || [],
      delays: normalized.match(/delay(?:Microseconds)?\s*\(\s*[^)]+\)/gi) || [],
      pinModes: normalized.match(/pinMode\s*\(\s*[^)]+\)/gi) || [],
    };
  }

  validateCodeSyntax(code: string): boolean {
    const openParens = (code.match(/\(/g) || []).length;
    const closeParens = (code.match(/\)/g) || []).length;
    const openBraces = (code.match(/\{/g) || []).length;
    const closeBraces = (code.match(/\}/g) || []).length;

    if (openParens !== closeParens || openBraces !== closeBraces) {
      return false;
    }

    return /void\s+setup\s*\(/i.test(code) && /void\s+loop\s*\(/i.test(code);
  }

  validateCodeStructure(code: string): boolean {
    return /void\s+setup\s*\(/i.test(code) && /void\s+loop\s*\(/i.test(code);
  }

  generateEducationalFeedback(
    code: string,
    problem: {
      expectedPatterns?: {
        pinMode?: string[];
        digitalWrite?: string[];
        delay?: string[];
      };
      timing?: {
        minDelay?: number;
        maxDelay?: number;
      };
      description?: string;
    }
  ): EducationalFeedback {
    const patterns = this.analyzeCodePatterns(code);
    const strengths: string[] = [];
    const suggestions: string[] = [];
    let score = 100;

    if (patterns.pinModes.some((entry) => /pinMode\s*\(\s*13\s*,\s*OUTPUT\s*\)/i.test(entry))) {
      strengths.push('Correctly configured pin 13 as OUTPUT');
    } else if (problem.expectedPatterns?.pinMode?.some((entry) => /pinMode\s*\(\s*13\s*,\s*OUTPUT\s*\)/i.test(entry))) {
      suggestions.push('Add pinMode(13, OUTPUT) in setup()');
      score -= 20;
    }

    const hasHigh = patterns.digitalWrites.some((entry) => /digitalWrite\s*\(\s*13\s*,\s*HIGH\s*\)/i.test(entry));
    const hasLow = patterns.digitalWrites.some((entry) => /digitalWrite\s*\(\s*13\s*,\s*LOW\s*\)/i.test(entry));

    if (hasHigh && hasLow) {
      strengths.push('Proper digitalWrite usage detected');
    } else if (problem.expectedPatterns?.digitalWrite) {
      if (!hasHigh) {
        suggestions.push('Add digitalWrite(13, HIGH) to turn the LED on');
        score -= 15;
      }
      if (!hasLow) {
        suggestions.push('Missing digitalWrite(13, LOW) for complete blink cycle');
        score -= 20;
      }
    }

    const delayValues = patterns.delays
      .map((entry) => Number((entry.match(/\((\d+)/)?.[1] ?? 0)))
      .filter((value) => Number.isFinite(value) && value > 0);

    if (problem.timing && delayValues.some((value) => value < (problem.timing?.minDelay ?? 0))) {
      suggestions.push(`Consider using longer delays (${problem.timing.minDelay}-${problem.timing.maxDelay}ms) for visible blinking`);
      score -= 15;
    }

    if (strengths.length === 0 && suggestions.length === 0) {
      score = Math.max(score - 20, 0);
    }

    return {
      score: Math.max(0, Math.min(100, score)),
      strengths,
      suggestions,
    };
  }

  getSupportedBoards(): string[] {
    return ['uno', 'nano', 'mega', 'leonardo'];
  }

  isValidBoard(boardType: string): boolean {
    return this.getSupportedBoards().includes(boardType);
  }

  getBoardSpecs(boardType: string): BoardSpecs {
    return BOARD_SPECS[boardType] || BOARD_SPECS.uno;
  }

  calculateQualityMetrics(code: string, hexContent: string, boardType: string) {
    const specs = this.getBoardSpecs(boardType);
    const patterns = this.analyzeCodePatterns(code);
    const programSize = Buffer.byteLength(hexContent || '', 'utf8');
    const ramUsage = Math.min(specs.sram, Math.max(0, code.length / 4));
    const codeComplexity = patterns.digitalWrites.length + patterns.delays.length + patterns.pinModes.length > 6
      ? 'high'
      : patterns.digitalWrites.length + patterns.delays.length + patterns.pinModes.length > 3
        ? 'medium'
        : 'low';

    const warnings: string[] = [];
    if (/\[[0-9]{3,}\]/.test(code) || /char\s+\w+\s*\[\s*[0-9]{3,}\s*\]/i.test(code) || code.length > 1000) {
      warnings.push('High RAM usage detected');
    } else if (ramUsage > specs.sram * 0.75) {
      warnings.push('High RAM usage detected');
    }

    return {
      programSize,
      ramUsage,
      codeComplexity,
      warnings,
    };
  }

  /**
   * Compile Arduino code and return hex file
   */
  async compile(
    code: string, 
    boardType: string = 'uno', 
    libraries: string[] = []
  ): Promise<CompileResponse> {
    try {
      const response: AxiosResponse<CompileResponse> = await axios.post(
        `${this.baseUrl}/compile/json`,
        {
          code,
          boardType,
          libraries
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Arduino compilation failed:', error);
      
      // Handle axios errors
      if (error.response) {
        // Server responded with error status
        return error.response.data as CompileResponse;
      } else if (error.request) {
        // Request was made but no response received
        return {
          success: false,
          error: 'Arduino compiler service is unreachable',
          compileTimeMs: 0
        };
      } else {
        // Something else happened
        return {
          success: false,
          error: `Arduino compiler error: ${error.message}`,
          compileTimeMs: 0
        };
      }
    }
  }

  /**
   * Simulate Arduino hex file execution and validate test cases
   */
  async simulate(hexFile: string, testCases: ArduinoTestCase[], code?: string): Promise<SimulateResponse> {
    try {
      const response: AxiosResponse<SimulateResponse> = await axios.post(
        `${this.baseUrl}/simulate`,
        {
          hexFile,
          testCases,
          code
        },
        {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Arduino simulation failed:', error);
      
      // Handle axios errors
      if (error.response) {
        return error.response.data as SimulateResponse;
      } else if (error.request) {
        return {
          success: false,
          results: [],
          allTestsPassed: false,
          simulationTimeMs: 0,
          error: 'Arduino compiler service is unreachable'
        };
      } else {
        return {
          success: false,
          results: [],
          allTestsPassed: false,
          simulationTimeMs: 0,
          error: `Arduino simulation error: ${error.message}`
        };
      }
    }
  }

  /**
   * Get supported Arduino boards
   */
  async getBoards(): Promise<BoardsResponse> {
    try {
      const response: AxiosResponse<BoardsResponse> = await axios.get(
        `${this.baseUrl}/boards`,
        {
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );

      return response.data;
    } catch (error: any) {
      console.error('Failed to get Arduino boards:', error);
      
      if (error.response) {
        return error.response.data as BoardsResponse;
      } else {
        return {
          success: false,
          boards: [],
          error: 'Failed to fetch Arduino boards'
        };
      }
    }
  }

  /**
   * Compile and validate Arduino code in one step
   * This is a convenience method for the full workflow
   */
  async compileAndValidate(
    code: string, 
    testCases: ArduinoTestCase[], 
    boardType: string = 'uno'
  ): Promise<{
    compileResult: CompileResponse;
    simulateResult?: SimulateResponse;
    success: boolean;
  }> {
    // Step 1: Compile the code
    const compileResult = await this.compile(code, boardType);
    
    if (!compileResult.success || !compileResult.hexFile) {
      return {
        compileResult,
        success: false
      };
    }

    // Step 2: Run simulation if compilation succeeded
    const simulateResult = await this.simulate(compileResult.hexFile, testCases);
    
    return {
      compileResult,
      simulateResult,
      success: simulateResult.success && simulateResult.allTestsPassed
    };
  }
}

// Export singleton instance
export const arduinoCompilerService = new ArduinoCompilerService();
export { ArduinoTestCase, TestResult, CompileResponse, SimulateResponse, Board };